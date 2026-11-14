'use strict';
// Rezepte aggregieren Zusatznährwerte ihrer Zutaten; unbekannt bleibt unbekannt, alte Rezepte rechnen wie bisher.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {sidecarKeys} = require('../scripts/lib/nutrient-mapping.cjs');
const {shardFor} = require('../scripts/lib/nutrient-readers.cjs');

const keys = sidecarKeys();
const clone = x => JSON.parse(JSON.stringify(x));
const keyA = 'BLS 4.0:RECA', keyB = 'BLS 4.0:RECB';
const rowA = {kcal:100,p:10,c:12,f:1,sugars:3,satfat:0,sodium:20};
const rowB = {kcal:200,p:20,c:0,f:10,sugars:1,selenium:5};
const rows = {[keyA]:rowA,[keyB]:rowB};

function fixture(options = {}) {
  const requests = [];
  const context = {window:{},state:{custom:[],recipes:[]},localCatalogue:[],validData:() => true,Math,Map,Set,Promise,unescape,encodeURIComponent,
    fetch:async url => {
      requests.push(url);
      if (options.offline) throw Error('offline');
      const index = Number(/-(\d+)\.json$/.exec(url)[1]);
      const shard = Object.fromEntries(Object.entries(rows).filter(([key]) => shardFor(key) === index).map(([key,row]) => [key,keys.map(k => row[k] ?? '').join(';')]));
      return {ok:true,json:async () => ({schemaVersion:1,keys,rows:shard})};
    }};
  vm.createContext(context);
  for (const file of ['nutrient-definitions','nutrient-resolver']) vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
  return {c:context,api:context.window.pulsNutrients,requests};
}
const ingredient = (name,row,amount,extra = {}) => ({name,unit:'g',amount,kcal:row.kcal,p:row.p,c:row.c,f:row.f,...extra});
function recipe(ingredients,yieldGrams) { return {id:'r1',name:'Pfanne',yield:yieldGrams,ingredients}; }
// Eintrag wie addFood ihn aus dem Rezept erzeugt: Makros je 100 g Fertiggericht mal Portion, auf 0,1 gerundet.
function portion(r,grams,changes = {}) {
  const per = k => r.ingredients.reduce((s,x) => s + x[k] * x.amount / 100,0) * 100 / r.yield;
  return {id:'e1',name:r.name,date:'2026-11-13',meal:'Mittagessen',grams,unit:'g',recipeId:r.id,
    ...Object.fromEntries(['kcal','p','c','f'].map(k => [k,Math.round(per(k) * grams / 100 * 10) / 10])),...changes};
}
const near = (a,b) => assert(Math.abs(a - b) < 1e-9,a + ' != ' + b);

(async () => {
  // Zwei Katalogzutaten: 200 g A + 100 g B, fertig 240 g; Portion 120 g = die Hälfte.
  const t = fixture(), api = t.api;
  const r = recipe([ingredient('A',rowA,200,{ck:keyA}),ingredient('B',rowB,100,{ck:keyB})],240);
  t.c.state.recipes = [r];
  const e = portion(r,120);
  assert.equal(e.kcal,200);
  const before = api.resolveEntry(e);
  assert.equal(before.pending,true,'Shards noch nicht geladen');
  assert.equal(before.values.sugars,null);
  await api.ensureForEntries([e]);
  assert(t.requests.length >= 1 && t.requests.length <= 2,'nur die Shards der Zutaten werden geladen');
  const res = api.resolveEntry(e);
  assert.equal(res.pending,false);
  near(res.values.sugars,(3 * 2 + 1 * 1) * 120 / 240);
  assert.equal(res.origin.sugars,'catalog');
  assert.equal(res.values.sodium,null,'sodium kennt nur Zutat A: unbekannt statt Teilsumme');
  assert.equal(res.values.selenium,null,'selenium kennt nur Zutat B: unbekannt');
  assert.equal(res.values.satfat,null,'satfat 0 bei A, unbekannt bei B: unbekannt statt 0');
  assert.equal(res.values.kcal,200);

  // Totals: Anteil der Einträge mit Wert wird gezählt, ein Eintrag ohne Wert zählt nicht als 0.
  const plain = {id:'e2',name:'Apfel',date:'2026-11-13',meal:'Snacks',grams:100,unit:'g',kcal:50,p:0,c:12,f:0};
  const sum = api.totals([e,plain]);
  assert.deepEqual(clone(sum.nutrients.sugars),{value:3.5,known:1,total:2,snapshot:0,catalog:1});
  assert.equal(sum.nutrients.satfat.value,null);

  // Zutat ohne Katalogwert (eigene Werte): alles Katalog-Zusätzliche wird unbekannt.
  const own = recipe([...r.ingredients,ingredient('Eigene',{kcal:50,p:1,c:5,f:2},50)],290);
  t.c.state.recipes = [own];
  assert.equal(api.resolveEntry(portion(own,100)).values.sugars,null);

  // Zutat mit Etikettwerten (z. B. Open Food Facts) zählt wie ein Einzel-Eintrag mit nx.
  const label = recipe([ingredient('A',rowA,100,{ck:keyA}),ingredient('Etikett',{kcal:100,p:5,c:10,f:2},100,{nx:{sugars:2}})],200);
  t.c.state.recipes = [label];
  const labelResult = api.resolveEntry(portion(label,100));
  near(labelResult.values.sugars,2.5);assert.equal(labelResult.origin.sugars,'catalog');
  assert.equal(labelResult.values.satfat,null);
  const onlyLabels = recipe([ingredient('E1',{kcal:100,p:5,c:10,f:2},100,{nx:{sugars:2,sodium:40}}),ingredient('E2',{kcal:100,p:5,c:10,f:2},100,{nx:{sugars:4}})],200);
  t.c.state.recipes = [onlyLabels];
  const labelsOnly = api.resolveEntry(portion(onlyLabels,50));
  near(labelsOnly.values.sugars,1.5);assert.equal(labelsOnly.origin.sugars,'snapshot');assert.equal(labelsOnly.values.sodium,null);

  // Zusatzwerte der Altschlüssel (nutrients je 100 g) werden ebenfalls summiert, nur wenn jede Zutat sie hat.
  const legacy = recipe([ingredient('A',rowA,100,{ck:keyA,nutrients:{fiber:2}}),ingredient('B',rowB,100,{ck:keyB,nutrients:{fiber:1}})],200);
  t.c.state.recipes = [legacy];
  near(api.resolveEntry(portion(legacy,100)).values.fiber,1.5);
  legacy.ingredients[1].nutrients = {vitc:3};
  assert.equal(api.resolveEntry(portion(legacy,100)).values.fiber,null);

  // Altes Rezept ohne neue Felder: Makros wie bisher, nichts Zusätzliches, nichts geraten.
  const old = recipe([ingredient('A',rowA,200),ingredient('B',rowB,100)],240);
  t.c.state.recipes = [old];
  const oldEntry = portion(old,120);
  const oldResult = api.resolveEntry(oldEntry);
  assert.equal(oldResult.pending,false);
  assert.deepEqual(clone(oldResult.values),clone(api.resolveEntry({...oldEntry,recipeId:undefined}).values));
  assert.equal(oldResult.values.kcal,200);

  // Sicherungen: geänderte Makros, Rezept gelöscht, ml-Eintrag, zu kleine Portion stark vergrößert.
  t.c.state.recipes = [r];
  assert.equal(api.resolveEntry({...e,kcal:e.kcal + 20}).values.sugars,null,'Eintrag passt nicht mehr zum Rezept');
  assert.equal(api.resolveEntry({...e,unit:'ml'}).values.sugars,null);
  assert.equal(api.resolveEntry({...e,recipeId:'weg'}).values.sugars,null,'gelöschtes Rezept: nur noch Snapshot-Makros');
  assert.equal(api.resolveEntry({...e,recipeId:'weg'}).values.kcal,200);
  const tiny = portion(r,5);
  const enlarged = {...tiny,grams:500};
  assert.equal(api.resolveEntry(enlarged).values.sugars,null,'Eintrag <10 g stark vergrößert verliert die Zusatzwerte');
  assert(api.resolveEntry(portion(r,500)).values.sugars > 0);

  // Zutat verändert sich später im Katalogwert: keine fremden Katalogwerte.
  const drifted = recipe([ingredient('A',{...rowA,kcal:120},200,{ck:keyA}),ingredient('B',rowB,100,{ck:keyB})],240);
  t.c.state.recipes = [drifted];
  assert.equal(api.resolveEntry(portion(drifted,120)).values.sugars,null,'Zutat passt nicht zur Katalogzeile');

  // Offline: kein Wert, kein Absturz, Makros bleiben.
  const off = fixture({offline:true});
  off.c.state.recipes = [r];
  await off.api.ensureForEntries([e]);
  const offline = off.api.resolveEntry(e);
  assert.equal(offline.pending,false);assert.equal(offline.values.sugars,null);assert.equal(offline.values.kcal,200);
  console.log('PASS: Rezept-Einträge summieren Zusatznährwerte anteilig; unbekannt, alte Rezepte, geänderte/gelöschte Rezepte und Offline bleiben sicher');

  // validData mit der echten App: alte Rezepte laden, neue Zutatenfelder werden geprüft, ffPickIngredient übernimmt sie.
  const harness = fs.readFileSync('tests/app-harness.cjs','utf8').replace("'exercise-muscles','training-polish'","'exercise-muscles','food-flow','training-polish'");
  const app = vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
  const full = app({handler:false});
  const readState = full.state;full.state = () => clone(readState());
  full.run('cloudSession=null;state=initial();migrate();render=function(){};');
  for (const file of ['food-photo','native-extras','workout-import','strength-ranks','puls-data','routine-favorites','nutrient-definitions','nutrient-resolver']) {
    full.run(fs.readFileSync('js/'+file+'.js','utf8'));full.run('render=function(){}');
  }
  const ctx = full.ctx;
  const good = clone(r);good.ingredients[0].nx = {sugars:1};good.ingredients[0].nutrients = {fiber:2};
  ctx.profile = {...full.state(),recipes:[clone(old),good]};
  assert(full.run('validData(profile)'),'alte und neue Rezepte laden');
  for (const [field,value] of [['ck','ungueltig'],['ck',5],['nx',{sugars:-1}],['nx',[]],['nutrients',{sugars:1}],['nutrients',{fiber:-1}]]) {
    ctx.candidate = clone(ctx.profile);ctx.candidate.recipes[1].ingredients[0][field] = value;
    assert.equal(full.run('validData(candidate)'),false,field + ' ' + JSON.stringify(value) + ' abgelehnt');
  }
  // Zutat aus dem Katalog wählen: ck und nutrients werden gespeichert, Makros bleiben exakt.
  const catalogRow = {id:'catalog_0',record:'RECA',source:'BLS 4.0',name:'Zutat A',...rowA,unit:'g',nutrients:{fiber:2}};
  full.run('localCatalogue='+JSON.stringify([catalogRow])+';ffIngredientList=localCatalogue;recipeDraft={id:"r9",name:"x",yield:0,ingredients:[]};renderRecipeEditor=function(){};ffPickIngredient(0)');
  const picked = clone(full.run('recipeDraft.ingredients[0]'));
  assert.equal(picked.ck,keyA);assert.deepEqual(picked.nutrients,{fiber:2});assert.equal(picked.kcal,100);assert.equal(picked.nx,undefined);
  ctx.profile.recipes = [{id:'r9',name:'x',yield:100,ingredients:[picked]}];
  assert(full.run('validData(profile)'));
  full.run('recipeDraft={id:"r8",name:"x",yield:0,ingredients:[]};ffIngredientList=[{name:"Eigen",unit:"g",kcal:1,p:1,c:1,f:1}];ffPickIngredient(0)');
  assert.deepEqual(clone(full.run('recipeDraft.ingredients[0]')),{name:'Eigen',unit:'g',amount:100,kcal:1,p:1,c:1,f:1},'Zutat ohne Katalogbezug bekommt keine neuen Felder');
  console.log('PASS: validData akzeptiert alte Rezepte und prüft ck/nx/nutrients der Zutaten; Zutatenauswahl speichert Katalogschlüssel');
})().catch(error => {console.error(error);process.exitCode = 1;});
