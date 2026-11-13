// Golden-Test für die Wrapper-Ketten: Welche Datei definiert oder ersetzt ein globales Symbol, in index.html-Reihenfolge.
// Eine unbeabsichtigte Änderung der Kette oder der Ladereihenfolge fällt auf. Bei Absicht (Refactor Phase 3/4):
//   node tests/check-wrapper-order.cjs --update   schreibt tests/fixtures/wrapper-order.json neu; den Diff dann ansehen.
const fs=require('node:fs'),assert=require('node:assert/strict');
const NAMES=['validData','render','accountPage','openModal','workoutPage','nutrition','profileForm','home','go'];
const GOLDEN='tests/fixtures/wrapper-order.json';
const scripts=[...fs.readFileSync('index.html','utf8').matchAll(/<script src="([^"?#]+)/g)].map(m=>m[1]);
// Kommentare entfernen (Block- und ganze Zeilenkommentare), damit Erwähnungen nicht zählen.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
// Gezählt werden: `function NAME(` und Zuweisungen `NAME=` / `window.NAME=`, deren rechte Seite eine Funktion ist (function, async, Pfeil).
// Nicht gezählt: Aufrufe, Vergleiche, `x.NAME`, lokale `const/let/var NAME`, Wiederherstellungen (`render=base`) und leere Zwischen-Ersetzungen (`render=()=>{}`).
const RHS=String.raw`\s*(?!\(\)\s*=>\s*\{\})(?:async\s+)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)`;
const pattern=name=>new RegExp(String.raw`(?<![.\w$])(?:async\s+)?function\s+${name}\s*\(|(?<![.\w$])(?<!\b(?:const|let|var)\s+)${name}\s*=(?![=>])${RHS}|(?<![\w$])window\.${name}\s*=(?![=>])${RHS}`,'g');
const found={};
for(const name of NAMES){
 found[name]=[];
 for(const file of scripts){const hits=(code(file).match(pattern(name))||[]).length;for(let i=1;i<=hits;i++)found[name].push(`${file}#${i}`)}
}
if(process.argv.includes('--update')){fs.writeFileSync(GOLDEN,JSON.stringify(found,null,1)+'\n');console.log('Golden-Datei geschrieben: '+GOLDEN);process.exit(0)}
const golden=JSON.parse(fs.readFileSync(GOLDEN,'utf8'));
assert.deepEqual(Object.keys(golden),NAMES,'Golden-Datei enthält andere Symbole');
for(const name of NAMES)assert.deepEqual(found[name],golden[name],`Kette von ${name} weicht von ${GOLDEN} ab (Reihenfolge oder Anzahl der Definitionen). Absicht: node tests/check-wrapper-order.cjs --update`);
console.log('PASS: Wrapper-Ketten '+NAMES.map(name=>`${name} ${found[name].length}x`).join(', '));
