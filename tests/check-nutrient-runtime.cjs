'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {sidecarKeys} = require('../scripts/lib/nutrient-mapping.cjs');
const {shardFor} = require('../scripts/lib/nutrient-readers.cjs');
const frozenV94 = require('./fixtures/nutrient-runtime/v94-validation.cjs');
const keys = sidecarKeys();
const clone = x => JSON.parse(JSON.stringify(x));
const sourceKey = 'BLS 4.0:FIXTURE';
const base = {kcal:100,p:10,c:12.34,f:1.01,fiber:5,sugars:2,satfat:0,sodium:20,b6:0.12};
function fixture(options = {}) {
  const requests = [];
  const context = {window:{},state:{custom:[]},localCatalogue:[],validData:() => true,Math,Map,Set,Promise,unescape,encodeURIComponent,
    fetch:async url => {
      requests.push(url);
      if (options.fetch) return options.fetch(url);
      const index = Number(/-(\d+)\.json$/.exec(url)[1]);
      const rows = index === shardFor(sourceKey) ? {[sourceKey]:keys.map(k => (options.base || base)[k] ?? '').join(';')} : {};
      return {ok:true,json:async () => ({schemaVersion:1,keys,rows})};
    }};
  vm.createContext(context);
  for (const file of ['nutrient-definitions','nutrient-resolver']) vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
  return {c:context,api:context.window.pulsNutrients,requests};
}
function entry(changes = {}) {
  return {id:'entry',name:'Fixture',date:'2026-11-12',meal:'Snacks',grams:150,unit:'g',ck:sourceKey,
    kcal:150,p:15,c:18.5,f:1.5,nutrients:{fiber:7.5},...changes};
}
function product(changes = {}) { return {id:'product',name:'Fixture',catalogKey:sourceKey,unit:'g',kcal:100,p:10,c:12.34,f:1.01,nutrients:{fiber:5},...changes}; }
function assertValue(result,key,value,origin) {
  assert.equal(result.values[key],value,key);if (origin) assert.equal(result.origin[key],origin,key+' origin');
}

// Real app entry paths and validators, with synthetic state/storage and no network.
const harness = fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("'exercise-muscles','training-polish'","'exercise-muscles','food-flow','training-polish'");
const app = vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
function fullApp() {
  const t = app({handler:false});
  const readState=t.state;t.state=()=>clone(readState());
  t.run('cloudSession=null;state=initial();migrate();render=function(){};');
  for (const file of ['food-photo','native-extras','workout-import','strength-ranks','puls-data-v87','routine-favorites','nutrient-definitions','nutrient-resolver']) {
    t.run(fs.readFileSync('js/'+file+'.js','utf8'));t.run('render=function(){}');
  }
  return t;
}

(async () => {
  let t = fixture(), api = t.api;
  assert.equal(api.definitions().length,76);
  assert.equal(api.resolveEntry(entry()).pending,true);
  const before = JSON.stringify(t.c.state);
  const [first,second] = await Promise.all([api.ensure([sourceKey]),api.ensureForEntries([entry()])]);
  assert.deepEqual(clone(first),{ready:[sourceKey],unavailable:[]});assert.deepEqual(clone(first),clone(second));assert.equal(t.requests.length,1);
  assert.equal(JSON.stringify(t.c.state),before,'Loading does not mutate profile');
  let result = api.resolveEntry(entry());assert.equal(result.pending,false);
  assertValue(result,'sugars',3,'catalog');assertValue(result,'satfat',0,'catalog');assertValue(result,'fiber',7.5,'snapshot');
  assertValue(result,'selenium',null,'unknown');assertValue(result,'c',18.5,'snapshot');
  result = api.resolveEntry(entry({nx:{sugars:0,sodium:10}}));
  assertValue(result,'sugars',0,'snapshot');assertValue(result,'sodium',15,'snapshot');
  assertValue(api.resolveEntry(entry({unit:'ml'})),'sugars',null);
  assertValue(api.resolveEntry(entry({kcal:151})),'sugars',null);
  assertValue(api.resolveEntry(entry({nutrients:{fiber:9}})),'sugars',3);
  assertValue(api.resolveEntry(entry({nutrients:{fiber:9}})),'fiber',9,'snapshot');
  assertValue(api.resolveEntry(entry({nutrients:undefined})),'fiber',null,'unknown');
  assertValue(api.resolveEntry(entry({unit:undefined})),'sugars',3);
  for (const fields of [{recipeId:'r'},{aiEstimate:true,source:'KI-Schätzung · Test'}]) {
    const r = api.resolveEntry(entry({...fields,nx:{sugars:5}}));assertValue(r,'sugars',null);assert.equal(r.pending,false);
  }
  t.c.state.custom = [product()];
  const old = entry({ck:undefined,foodRef:'product'});
  assertValue(api.resolveEntry(old),'sugars',3);
  delete t.c.state.custom[0].catalogKey;Object.assign(t.c.state.custom[0],{record:'FIXTURE',source:'BLS 4.0'});
  assertValue(api.resolveEntry(old),'sugars',3,'catalog');
  t.c.state.custom[0].p = 11;assertValue(api.resolveEntry(old),'sugars',null);
  assertValue(api.resolveEntry(entry({foodRef:'product'})),'sugars',3,'catalog');
  t.c.state.custom = [product({nx:{sugars:2}})];assertValue(api.resolveEntry(old),'sugars',null);
  assertValue(api.resolveEntry(entry({foodRef:'product'})),'sugars',3,'catalog');
  t.c.state.custom = [];
  assertValue(api.resolveEntry(entry({foodRef:'deleted'})),'sugars',3,'catalog');
  assertValue(api.resolveProduct(product(),{amount:200,unit:'g'}),'sugars',4,'catalog');
  assertValue(api.resolveProduct(product({nx:{sugars:2},unit:'ml'}),{amount:250,unit:'ml'}),'sugars',5,'snapshot');
  assertValue(api.resolveProduct(product(),{amount:200,unit:'ml'}),'sugars',null);
  assertValue(api.resolveProduct(product(),{amount:NaN}),'kcal',null,'unknown');
  assertValue(api.resolveProduct(product(),{unit:'ml'}),'kcal',null,'unknown');
  const summary = api.totals([entry(),entry({ck:undefined,nutrients:undefined})]);
  assert.deepEqual(clone(summary.nutrients.sugars),{value:3,known:1,total:2,snapshot:0,catalog:1});
  assert.deepEqual(clone(summary.nutrients.satfat),{value:0,known:1,total:2,snapshot:0,catalog:1});
  assert.equal(summary.nutrients.selenium.value,null);
  // Absolute capture error OR density error after a proportional amount edit.
  assertValue(api.resolveEntry(entry({c:18.51 + 0.049999})),'sugars',3);
  assertValue(api.resolveEntry(entry({c:18.51 + 0.05001})),'sugars',3);
  assertValue(api.resolveEntry(entry({c:18.51 + 0.75001})),'sugars',null);
  const editBase={...base,c:12.4}, edited=fixture({base:editBase});
  await edited.api.ensure([sourceKey]);
  for (const [initial,amount] of [[35,70],[7,70],[150,600]]) {
    const captured = Object.fromEntries(['kcal','p','c','f'].map(k => [k,Math.round(editBase[k]*initial/100*10)/10*amount/initial]));
    assertValue(edited.api.resolveEntry(entry({grams:amount,...captured})),'sugars',editBase.sugars*amount/100,'catalog');
  }
  const cucumber = fixture({base:{kcal:12,p:0.6,c:1.8,f:0.1,sugars:1.7}});
  await cucumber.api.ensure([sourceKey]);
  assertValue(cucumber.api.resolveEntry(entry({grams:300,kcal:36,p:2,c:5,f:0})),'sugars',5.1,'catalog');
  assertValue(cucumber.api.resolveEntry(entry({grams:300,kcal:36,p:2,c:5,f:4})),'sugars',null);
  assertValue(api.resolveProduct(product({p:10.001})),'sugars',null,'unknown');
  assert.equal(api.keyFor(product()),sourceKey);assert.equal(api.keyFor({}),null);
  const futureKey='Future database:record:42';
  assert.equal(api.keyFor(product({catalogKey:futureKey})),futureKey);
  const requestsBefore=t.requests.length;
  assert.deepEqual(clone(await api.ensure([futureKey])),{ready:[],unavailable:[futureKey]});
  assert.equal(t.requests.length,requestsBefore,'Unknown sources never trigger a shard request');
  const futureEntry=entry({ck:futureKey,nx:{future_nutrient:12.345678}});
  assertValue(api.resolveEntry(futureEntry),'sugars',null,'unknown');
  assert.equal(api.resolveEntry(futureEntry).pending,false);
  assert.equal(api.totals([futureEntry]).nutrients.future_nutrient,undefined);
  assert.deepEqual(clone(api.copyFields(futureEntry,{})),{ck:futureKey,nx:futureEntry.nx});
  assert.doesNotThrow(()=>api.capture(product({nx:{invalid:-1}}),{}));
  assert.doesNotThrow(()=>api.capture(product({nx:{sugars:2}}),Object.freeze({})));
  const rounded={};api.setLabelValues(rounded,{sodium:492.00000000000006,future_nutrient:12.345678});
  assert.deepEqual(clone(rounded.nx),{sodium:492,future_nutrient:12.346});
  assertValue(api.resolveEntry(entry({grams:300,kcal:300,p:30,c:37,f:3,nutrients:{fiber:15}})),'sugars',6);
  t = fixture({fetch:async () => {throw Error('offline');}});
  assert.deepEqual(clone(await t.api.ensure([sourceKey])),{ready:[],unavailable:[sourceKey]});
  assert.equal(t.api.resolveEntry(entry()).pending,false);assert.equal(t.api.resolveEntry(entry()).values.sugars,null);
  await t.api.ensure([sourceKey]);assert.equal(t.requests.length,2,'Failed download retries');
  for (const response of [{ok:false},{ok:true,json:async()=>({schemaVersion:2})}]) {
    const bad = fixture({fetch:async()=>response});assert.equal((await bad.api.ensure([sourceKey])).unavailable.length,1);
  }
  const empty = fixture({fetch:async()=>({ok:true,json:async()=>({schemaVersion:1,keys,rows:{}})})});
  assert.equal((await empty.api.ensure([sourceKey])).unavailable.length,1);
  assert.equal(empty.api.resolveEntry(entry()).pending,false,'Loaded shard without record has no pending work');
  assert.equal(empty.api.resolveProduct(product()).pending,false);
  const legacySchema=fixture({fetch:async()=>({ok:true,json:async()=>({schemaVersion:1,keys:require('../scripts/lib/nutrient-mapping.cjs').definitions().map(d=>d.key),rows:{}})})});
  assert.equal((await legacySchema.api.ensure([sourceKey])).unavailable.length,1,'Reject superseded 76-column cache entries');
  assertValue(api.resolveEntry(entry({grams:undefined,nx:{sugars:2}})),'sugars',null,'unknown');
  console.log('PASS: resolver priority, per100 scaling, 0/unknown coverage, rounding boundary, old foodRef/record links, altered/ml/recipe/AI exclusions, coalescing and offline retry');

  const full = fullApp();const run = full.run, c = full.ctx;
  const sourceRow = {id:'catalog_0',record:'FIXTURE',source:'BLS 4.0',name:'Fixture',...base,unit:'g',nutrients:{fiber:5}};
  run('localCatalogue='+JSON.stringify([sourceRow]));
  run('state.custom='+JSON.stringify([product()]));
  run('foodSelection=state.custom[0]');full.el('grams').value='150';full.el('meal').value='Snacks';
  run('addFood({preventDefault(){}})');
  let logged = full.state().foods.at(-1);assert.equal(logged.ck,sourceKey);assert(run('validData(state)'));
  const label = product({catalogKey:undefined,nx:{sugars:2,satfat:0,sodium:300}});
  run('state.custom.push('+JSON.stringify({...label,id:'label'})+');foodSelection=state.custom.at(-1)');
  full.el('grams').value='200';run('addFood({preventDefault(){}})');
  logged = full.state().foods.at(-1);assert.deepEqual(logged.nx,label.nx);assert.equal(logged.ck,undefined);
  run('state.custom.at(-1).nx.sugars=99');assert.equal(full.state().foods.at(-1).nx.sugars,2);
  full.el('diary-amount').value='300';run('saveDiaryAmount({preventDefault(){}},state.foods.at(-1).id)');
  assert.equal(full.state().foods.at(-1).nx.sugars,2);assert.equal(c.window.pulsNutrients.resolveEntry(full.state().foods.at(-1)).values.sugars,6);
  run('state.foods[0].ck="Future database:record:42";state.foods[0].nx={future_nutrient:12.345678}');
  const valid = full.state();
  assert(run('validData(state)'));
  for (const [field,value] of [['nx',{sugars:-1}],['nx',{sugars:Infinity}],['nx',{Uppercase:1}],['nx',[]],['nx',new Date()],['nx',Object.fromEntries(Array.from({length:41},(_,i)=>['key'+i,1]))],['nx',{sugars:1e9+1}],['ck','invalid'],['ck','x:'],['ck',':x'],['ck','x:\n'],['ck',5]]) {
    c.candidate=clone(valid);c.candidate.foods[0][field]=value;assert.equal(run('validData(candidate)'),false,field+' rejected');
  }
  c.candidate=clone(valid);delete c.candidate.foods[0].ck;delete c.candidate.foods[1].nx;assert(run('validData(candidate)'));
  const oldKeys = ['water','fiber','vitc','calcium','iron','b12','potassium','magnesium','folate'];
  const oldNutrients = value => value === undefined || value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([k,v]) => oldKeys.includes(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9);
  assert(valid.foods.every(e=>oldNutrients(e.nutrients)));assert(valid.custom.every(e=>oldNutrients(e.nutrients)));
  assert.equal(Object.keys(run('nutrientLabels')).length,8);assert(run('validData(state)'));
  // Frozen ad92acf core and nutrient rules, explicitly a subset of its wrappers.
  const oldProfile=clone(valid);assert(frozenV94(oldProfile));assert.deepEqual(oldProfile,valid);
  const badOld=clone(valid);badOld.foods[0].nutrients={sugars:1};assert.equal(frozenV94(badOld),false);
  run('state='+JSON.stringify(valid));run('var roundTrip=prepareImportedData(JSON.parse(JSON.stringify(state)))');assert.equal(run('roundTrip.foods[1].nx.sugars'),2);
  let exported;
  c.Blob=class {constructor(parts){exported=parts.join('');}};
  c.URL={createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}};
  const createElement=c.document.createElement;c.document.createElement=()=>({click(){}});
  run('exportData()');c.document.createElement=createElement;
  assert.deepEqual(JSON.parse(exported).foods,valid.foods,'Actual JSON export preserves optional fields');
  run('textFoodDraft=[{amountConfirmed:true,selected:0,amount:125,unit:"g",matches:[state.custom[1]]}]');
  c.textButton={};run('logTextFood(0,textButton)');
  assert.deepEqual(full.state().foods.at(-1).nx,valid.custom[1].nx,'Text capture freezes current product values');
  assert(Buffer.byteLength(JSON.stringify({...entry({ck:undefined}),ck:sourceKey}))-Buffer.byteLength(JSON.stringify(entry({ck:undefined}))) <= 45);
  assert(Buffer.byteLength(JSON.stringify({...entry({ck:undefined}),nx:{sugars:2,satfat:0,sodium:300}}))-Buffer.byteLength(JSON.stringify(entry({ck:undefined}))) <= 70);
  console.log('PASS: real add/edit/frozen snapshots, future fields/export, strict validation, frozen ad92acf core/nutrient rules, import and size budgets');

  run(fs.readFileSync('js/food-diary.js','utf8'));run('render=function(){}');
  run(fs.readFileSync('js/food-page.js','utf8'));run('render=function(){};fdUndoToast=function(){}');
  const item = full.state().foods[1];c.comboSource=clone(item);
  const combo = clone(run('fpSnapshot(comboSource,comboSource.grams)'));assert.deepEqual(combo.nx,item.nx);
  c.comboSource.nx.sugars=22;assert.equal(combo.nx.sugars,2,'Combo snapshot is independent');
  c.combo=combo;assert.deepEqual(clone(run('fpScaled(combo,600).nx')),item.nx);
  run('state.meals=[{id:"combo",name:"Combo",items:[combo]}]');full.el('fp-item-0').value='600';run('fpLogMeal({preventDefault(){}},"combo")');
  const combined=full.state().foods.at(-1);assert.deepEqual(combined.nx,item.nx);assert.equal(combined.grams,600);
  assert.equal(c.window.pulsNutrients.resolveEntry(combined).values.sugars,12);
  assert(run('validData(state)'));
  run('state.meals[0].items[0].nx={sugars:-1}');assert.equal(run('validData(state)'),false);
  console.log('PASS: combo snapshot, scaling and logging preserve per100 fields without aliases; malformed combo extras rejected');

  function off(nutriments) {return clone(run('mapOffProduct('+JSON.stringify({product_name:'Fixture',nutriments})+',"123")'));}
  assert.deepEqual(off({sugars_100g:0,'saturated-fat_100g':2,sodium_100g:0.1,salt_100g:1}).nx,{sugars:0,satfat:2,sodium:100});
  assert.deepEqual(off({salt_100g:1}).nx,{sodium:400});assert.equal(off({sugars_100g:' ',sodium_100g:'<0.1'}).nx,undefined);
  const hiddenOff=['starch','polyols','monounsaturated-fat','polyunsaturated-fat','trans-fat','omega-3-fat','omega-6-fat','alpha-linolenic-acid','eicosapentaenoic-acid','docosahexaenoic-acid','linoleic-acid','arachidonic-acid','cholesterol'];
  assert.equal(off(Object.fromEntries(hiddenOff.map(key=>[key+'_100g',1]))).nx,undefined);
  assert.deepEqual(off({sodium_100g:0.49200000000000005}).nx,{sodium:492});
  c.hiddenDraft={...off({sugars_100g:3,salt_100g:1}),prepared:true,nx:{sugars:3,sodium:400,starch:12,future_nutrient:9}};
  run('productDraft=hiddenDraft');
  for(const [key,value] of Object.entries({unit:'g',name:'Prepared OFF',kcal:100,p:10,c:10,f:2,sugars:3,satfat:'',salt:1}))full.el('off-'+key).value=String(value);
  full.el('off-kcal').closest=()=>null;
  run('var testSelectFood=selectFood;selectFood=function(){};confirmProduct({preventDefault(){}});selectFood=testSelectFood');
  assert.deepEqual(full.state().custom.at(-1).nx,{sugars:3,sodium:400},'OFF saves only displayed confirmed fields');
  for(const [text,key,expected] of [
    ['Gesättigte Fettsäuren <0,1 g\nEinfach ungesättigte Fettsäuren 6 g','satfat',undefined],
    ['Monounsaturated fat 6 g\nSaturated fat 1 g','satfat',1],
    ['Polyunsaturated fat 6 g\nUnsaturated fat 5 g\nof which saturates 2 g','satfat',2],
    ['davon mehrfach ungesättigte Fettsäuren 6 g','satfat',undefined],
    ['Sugar alcohols 5 g\nSugars 3 g','sugars',3],
    ['Zuckeralkohole 5 g\nmehrwertige Alkohole 6 g\nPolyole 4 g\ndavon Zucker 2 g','sugars',2],
    ['Polyols 6 g\nof which sugars 1 g','sugars',1]
  ]){c.ocrText=text;assert.equal(run('parseLabelText(ocrText)')[key],expected,text);}
  for (const text of ['Fett 10 g\ndavon gesättigte Fettsäuren 2 g\nKohlenhydrate 20 g\ndavon Zucker 8 g\nSalz 1,5 g','Fat 10 g\nof which saturates 2 g\nCarbohydrates 20 g\nof which sugars 8 g\nSalt 1.5 g']) {
    c.ocrText=text;const parsed=clone(run('parseLabelText(ocrText)'));assert.equal(parsed.f,10);assert.equal(parsed.c,20);assert.equal(parsed.sugars,8);assert.equal(parsed.satfat,2);assert.equal(parsed.salt,1.5);
  }
  c.ocrText='Sugars <0.5 g\nSaturated fat 20 mg\nSalt -1 g';assert.equal(run('parseLabelText(ocrText).sugars'),undefined);assert.equal(run('parseLabelText(ocrText).satfat'),undefined);assert.equal(run('parseLabelText(ocrText).salt'),undefined);
  full.el('label-basis').value='portion-ml';full.el('label-basis-amount').value='50';
  for (const [k,v] of Object.entries({kcal:100,p:1,c:10,f:2,fiber:'',sugars:4,satfat:1,salt:0.25}))full.el('label-'+k).value=String(v);
  assert.deepEqual(clone(run('labelReviewValues().nx')),{sugars:8,satfat:2,sodium:200});
  const html=fs.readFileSync('index.html','utf8'), worker=fs.readFileSync('sw.js','utf8');
  assert(html.indexOf('js/flows.js') < html.indexOf('js/nutrient-definitions.js'));assert(html.indexOf('js/nutrient-definitions.js') < html.indexOf('js/nutrient-resolver.js'));
  assert.match(html,/js\/nutrient-resolver\.js\?v=\d+/);assert(worker.includes('js/nutrient-resolver.js'));
  console.log('PASS: OFF normalized units/salt fallback, DE/EN OCR specific lines, malformed/unknown values, portion-to-per100 labels and unchanged v94 asset integration');

  const nativeSetup=fs.readFileSync('tests/check-native-nutrition.cjs','utf8').split('const interest=t=>')[0];
  const startNative=vm.runInNewContext('(function(require){'+nativeSetup+';return start})(require)',{require,console,process:{argv:[]},AbortController,URLSearchParams});
  const native=startNative();
  for(const file of ['nutrient-definitions','nutrient-resolver'])native.run(fs.readFileSync('js/'+file+'.js','utf8'));
  native.run('state.custom[0].nx={sugars:2,satfat:0,sodium:300}');
  const owner=JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/snapshot.json','utf8')).userId;
  let serial=100;
  function apply(op,args){native.ctx.window.pulsNativeApply({id:'f0000000-0000-4000-8000-'+String(serial++).padStart(12,'0'),userId:owner,baseSeq:0,op,args});const ack=native.messages.filter(m=>m.type==='ack').at(-1);assert.equal(ack.ok,true,JSON.stringify(ack));}
  apply('food.add',{id:'nx-native-entry',product:{id:'product'},amount:100,unit:'g',meal:'Snacks',date:'2026-10-28',expect:clone(native.state().custom[0])});
  let added=clone(native.state().foods.at(-1));assert.deepEqual(added.nx,{sugars:2,satfat:0,sodium:300});
  apply('food.update',{id:added.id,amount:200,unit:'g',expect:added});
  assert.equal(native.ctx.window.pulsNutrients.resolveEntry(clone(native.state().foods.at(-1))).values.sugars,4);
  native.run('var extraDraft=mapOffProduct({product_name:"OFF fixture",nutriments:{"energy-kcal_100g":100,proteins_100g:10,carbohydrates_100g:10,fat_100g:2,sugars_100g:3,"saturated-fat_100g":1,salt_100g:0.5}},"3017620422003")');
  const draft=clone(native.run('extraDraft'));draft.prepared=true;draft.nx.starch=12;draft.nx.future_nutrient=9;draft.nx.sodium=200.00000000000003;
  apply('product.save',{kind:'review',product:{id:'native-off',name:draft.name,unit:'g',barcode:draft.barcode,kcal:100,p:10,c:10,f:2},draft,expect:null,confirmWarnings:true});
  assert.deepEqual(clone(native.state().custom.at(-1).nx),{sugars:3,satfat:1,sodium:200});
  console.log('PASS: native add/update preserve per100 labels and OFF review uses the same three Web fields');
})().catch(error => {console.error(error);process.exitCode=1;});
