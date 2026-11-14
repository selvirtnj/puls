// "Gestern nochmal" / "Vortag übernehmen": kopiert die Essens-Einträge des Vortags auf einen leeren Tag.
// Läuft über das echte Harness mit food-diary.js; ohne Layout und ohne Netz.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/app-harness.cjs','utf8');
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const t=app({handler:false,features:[],preview:true});
t.run(fs.readFileSync('js/food-diary.js','utf8'));
t.ctx.document.body.appendChild=()=>{}; // Hinweis-Box braucht kein echtes DOM; Inhalt prüft der Test über den Zustand

const day='2026-11-10',prev='2026-11-09';
const apple={id:'11111111-aaaa-4bbb-8ccc-000000000001',name:'Apfel',grams:120,unit:'g',date:prev,meal:'Snacks',kcal:62.4,p:.5,c:14.2,f:.2,ck:'bls:B123',nx:{vitc:4.2},nutrients:{vitc:4.2,fiber:2.4},foodRef:'prod-1',loggedAt:1000};
const rice={id:'11111111-aaaa-4bbb-8ccc-000000000002',name:'Reis',grams:200,unit:'g',date:prev,meal:'Snacks',kcal:260,p:5,c:56,f:.6};
const water={id:'11111111-aaaa-4bbb-8ccc-000000000003',date:prev,meal:'Snacks',name:'Trinkwasser',grams:500,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:500}};
const originals=JSON.stringify([apple,rice,water]);
const setFoods=foods=>t.run('state.foods='+JSON.stringify(foods));
const dayFoods=()=>t.state().foods.filter(x=>x.date===day);
const isReal=x=>x.name!=='Trinkwasser';

// Ausgangslage: angezeigter Tag leer, Vortag gefüllt. Wasser von heute zählt nicht als Tagebuch.
t.run('date='+JSON.stringify(day));
setFoods([apple,rice,water]);
let html=t.run('fdRepeatButton()');
assert(html.includes('fdrepeat'),'Knopf erscheint bei leerem Tag mit gefülltem Vortag');
assert(html.includes(t.run('date===today()')?'Gestern nochmal':'Vortag übernehmen'),'Beschriftung je nach Tag');
assert(t.run('fdDiaryList()').includes('fdrepeat'),'Knopf steht in der leeren Tagebuchliste');

// Nur Wasser heute: Knopf bleibt, weil das Tagebuch leer ist.
setFoods([apple,rice,water,{...water,id:'11111111-aaaa-4bbb-8ccc-0000000000ff',date:day}]);
assert(t.run('fdRepeatButton()').includes('fdrepeat'),'reines Wasser heute zählt nicht als Eintrag');

// Heute schon ein Eintrag: kein Knopf.
const today1={...rice,id:'11111111-aaaa-4bbb-8ccc-0000000000aa',date:day};
setFoods([apple,rice,water,today1]);
assert.equal(t.run('fdRepeatButton()'),'','kein Knopf, sobald ein Essens-Eintrag heute existiert');
assert(!t.run('fdDiaryList()').includes('fdrepeat'));

// Vortag ohne Essen (nur Wasser): kein Knopf.
setFoods([water]);
assert.equal(t.run('fdRepeatButton()'),'','kein Knopf ohne Essen am Vortag');

// Kopie: neue IDs, Datum des Tages, Werte und Snapshots gleich, Originale unverändert.
setFoods([apple,rice,water]);
t.run('fdRepeatDay()');
const after=t.state().foods,copies=after.filter(x=>x.date===day);
assert.equal(copies.length,2,'genau die beiden Essens-Einträge werden kopiert, kein Wasser');
assert(copies.every(isReal));
const ids=new Set(copies.map(x=>x.id));
assert.equal(ids.size,2,'neue, eindeutige IDs');
for(const id of ids){assert(/^[a-zA-Z0-9_-]{1,100}$/.test(id),'ID im App-Muster'); assert(!originals.includes(id),'ID ist neu')}
const copyApple=copies.find(x=>x.name==='Apfel'),copyRice=copies.find(x=>x.name==='Reis');
for(const key of ['kcal','p','c','f','unit','grams','meal','ck','nx','nutrients','foodRef'])
  assert.equal(JSON.stringify(copyApple[key]),JSON.stringify(apple[key]),'Apfel: '+key+' gleich');
assert.equal(copyRice.kcal,rice.kcal);
assert.equal(copyApple.date,day);assert.equal(copyRice.date,day);
assert.notEqual(copyApple.loggedAt,apple.loggedAt,'loggedAt wird wie beim Hinzufügen neu gesetzt');
assert.equal(copyRice.loggedAt,undefined,'ohne loggedAt bleibt das Feld weg');
assert.equal(JSON.stringify(after.filter(x=>x.date===prev)),JSON.stringify([apple,rice,water]),'Originale unverändert');
assert.equal(t.run('validData(JSON.parse(JSON.stringify(state)))'),true,'kopierter Stand besteht validData');

// Knopf verschwindet nach der Kopie (Tagebuch nicht mehr leer).
assert.equal(t.run('fdRepeatButton()'),'');

// Rückgängig entfernt genau die Kopien.
t.el('fd-undo').remove=()=>{}; // Hinweis-Box ist im Harness nur ein Stub
t.run('fdUndoRun()');
const undone=t.state().foods;
assert.equal(undone.filter(x=>x.date===day).length,0,'Rückgängig entfernt genau die Kopien');
assert.equal(JSON.stringify(undone.filter(x=>x.date===prev)),JSON.stringify([apple,rice,water]));

console.log('PASS: Vortag übernehmen (Knopf, Kopie, Originale, Rückgängig, validData)');
