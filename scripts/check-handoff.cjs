// Prüft, dass Übergabedokumente, Agenten und gemeinsame Skills vorhanden und stimmig sind.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert'),vm=require('node:vm');
for(let file of ['scripts/new-worktree.cjs','scripts/agent-hooks.cjs'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
const docs=['docs/START-HERE.md','docs/README.md','docs/PROGRESS.md','docs/DECISIONS.md','docs/ISSUES.md','docs/AI-TEAM.md'];
const required=['AGENTS.md','CLAUDE.md',...docs,'docs/BACKEND-HANDOFF.md','.codex/config.toml','.claude/settings.json'];
for(let file of required)assert(fs.existsSync(file),'Missing '+file);
JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));
// Gemeinsame Skills: eine Quelle für Claude, Codex und Gemini.
const skills=['frontend','backend','test-runner','code-review','reflect'];
for(let skill of skills){let file='.claude/skills/'+skill+'/SKILL.md',text=fs.readFileSync(file,'utf8');assert(new RegExp('^---\\r?\\nname: '+skill+'\\r?\\ndescription: .+\\r?\\n---').test(text),file+' frontmatter');}
// Claude-Agenten: Name passt zur Datei, Modell gesetzt, genannte Skills existieren.
for(let file of fs.readdirSync('.claude/agents').filter(x=>x.endsWith('.md'))){let text=fs.readFileSync('.claude/agents/'+file,'utf8'),head=(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)||[])[1]||'';assert(head.includes('name: '+file.replace(/\.md$/,'')),file+' name');assert(/^description: .+$/m.test(head),file+' description');assert(/^model: (haiku|sonnet|opus|fable|inherit)$/m.test(head),file+' model');for(let match of head.matchAll(/^\s+- ([\w-]+)$/gm))assert(fs.existsSync('.claude/skills/'+match[1]+'/SKILL.md'),file+' unknown skill '+match[1]);}
// Codex-Rollen verweisen auf dieselben Skills und erben Modell und Rechte.
for(let role of ['puls_builder','puls_reviewer']){let file='.codex/agents/'+role+'.toml',text=fs.readFileSync(file,'utf8');assert(text.includes('name = "'+role+'"'),file+' name');assert(/^description = ".+"$/m.test(text),file+' description');assert(/developer_instructions = '''[\s\S]+'''\s*$/.test(text),file+' instructions');assert(!/^(?:model|model_reasoning_effort|sandbox_mode|approval_policy)\s*=/m.test(text),file+' must inherit settings');for(let match of text.matchAll(/\.claude\/skills\/[\w-]+\/SKILL\.md/g))assert(fs.existsSync(match[0]),file+' -> '+match[0]);}
for(let file of docs){let text=fs.readFileSync(file,'utf8');for(let match of text.matchAll(/\]\(([^)]+)\)/g)){let ref=match[1];if(/^(?:https?:|#)/.test(ref))continue;assert(fs.existsSync(path.resolve(path.dirname(file),ref.split('#')[0])),'Broken link '+file+' -> '+ref)}}
console.log('PASS: handoff documents, relative links, shared skills, Claude agents and Codex roles.');
