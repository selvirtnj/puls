// Hooks für Claude Code (siehe .claude/settings.json). Kein Teil der ausgelieferten App.
//   session-start: entfernt nach dem 16.11.2026 die lokale Fable-Vorgabe, danach gilt Opus 5.5 aus settings.json.
//   verify:        Prüfschleife. Hat ein schreibender Agent Dateien geändert und der Testlauf scheitert,
//                  wird er mit der Fehlerausgabe zurückgeschickt (Claude Code bricht nach 8 Runden selbst ab).
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];

function readInput() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

if (mode === 'session-start') {
  const local = path.join(root, '.claude', 'settings.local.json');
  const fableUntil = new Date('2026-11-17T00:00:00');
  try {
    if (new Date() >= fableUntil && fs.existsSync(local)) {
      const data = JSON.parse(fs.readFileSync(local, 'utf8'));
      if (data.model === 'claude-fable-5-2') {
        delete data.model;
        fs.writeFileSync(local, JSON.stringify(data, null, 2) + '\n');
      }
    }
  } catch { /* Einstellungen nie wegen dieses Hooks blockieren */ }
  process.exit(0);
}

if (mode === 'verify') {
  const input = readInput();
  if (input.stop_hook_active) process.exit(0);
  const cwd = input.cwd && fs.existsSync(path.join(input.cwd, 'scripts', 'check.cjs')) ? input.cwd : root;
  const status = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  if (status.status === 0 && !status.stdout.trim()) process.exit(0); // nichts geändert
  const run = spawnSync(process.execPath, ['scripts/check.cjs'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (run.status === 0) process.exit(0);
  const tail = ((run.stdout || '') + '\n' + (run.stderr || '')).trim().split(/\r?\n/).slice(-25).join('\n');
  console.log(JSON.stringify({ decision: 'block', reason: 'node scripts/check.cjs schlägt fehl. Ursache beheben, nicht den Test abschwächen:\n' + tail }));
  process.exit(0);
}

console.error('Aufruf: node scripts/agent-hooks.cjs session-start|verify');
process.exit(1);
