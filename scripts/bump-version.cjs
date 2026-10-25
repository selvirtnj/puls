// Erhöht die App-Version an allen Stellen auf einmal: node scripts/bump-version.cjs
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = name => path.join(root, name);
const pkg = JSON.parse(fs.readFileSync(file('package.json'), 'utf8'));
const old = parseInt(pkg.version, 10), next = old + 1;
const edits = [
  ['index.html', `?v=${old}`, `?v=${next}`],
  ['sw.js', `puls-static-${old}`, `puls-static-${next}`],
  ['sw.js', `?v=${old}`, `?v=${next}`, true],
  ['package.json', `"version": "${old}.0.0"`, `"version": "${next}.0.0"`],
  ['js/account-refresh.js', `'Version ${old}'`, `'Version ${next}'`],
  ['docs/CURRENT-STATE.md', `?v=${old}`, `?v=${next}`]
];
for (const [name, from, to, optional] of edits) {
  const text = fs.readFileSync(file(name), 'utf8');
  if (!text.includes(from)) { if (optional) continue; throw new Error(`${name}: "${from}" nicht gefunden`); }
  fs.writeFileSync(file(name), text.split(from).join(to));
}
console.log(`Version ${old} -> ${next}. Versionseintrag in docs/CURRENT-STATE.md selbst ergänzen.`);
