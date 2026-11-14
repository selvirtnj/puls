// Runde 2 HIG, Essen-Fenster: Quellprüfung der Regeln, die im Browser leicht wieder kaputtgehen (kein echtes Layout).
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');
const page=read('css/food-page.css'),style=read('css/style.css'),js=read('js/food-page.js'),flow=read('js/food-flow.js');

// Die deckende Fläche hinter dem klebenden Knopf darf nicht über den Rand hinausreichen: sonst verdeckt sie Hinweise darunter (Quelle, ODbL).
const cover=page.match(/\.ffsubmit::before \{[^}]*inset: ([^;]+);/);
assert.ok(cover,'Deckfläche des klebenden Knopfs fehlt');
assert.ok(/calc\(-8px - env\(safe-area-inset-bottom\)\)$/.test(cover[1].trim()),'Deckfläche reicht zu weit nach unten: '+cover[1]);
assert.ok(/#modal\.fpage #foodbody:has\(> :is\([^)]*\.ffreview[^)]*\)\) \{ padding-bottom: 0 !important; \}/.test(page),'Fußabstand der Seiten mit klebendem Knopf muss im Inhalt liegen');
assert.ok(/ffAttribution='[^']*ODbL/.test(flow),'ODbL-Hinweis bleibt');

// Reiterleiste der Essen-Seite: mindestens 13 px, nirgends 10 oder 11 px.
for(const rule of style.match(/[^{}]*\.foodtabs[^{}]*\{[^}]*\}/g))assert.ok(!/font-size:\s*1[01]px/.test(rule),'Reiterschrift unter 13 px: '+rule.trim().slice(0,90));

// Titel und Schließen stehen in einer Titelzeile; der Kopf der Suche trägt nur Suche, Filter und Scan.
assert.ok(/className='fptitlebar'/.test(js)&&/class="fptitle"/.test(js)&&/onclick="fpClose\(\)"/.test(js));
assert.ok(!/head\.innerHTML=`<button type="button" class="fdicon"/.test(js),'Schließen nicht mehr im Suchkopf');
console.log('PASS food HIG round 2: sticky cover, tab font size, title bar, ODbL source');
