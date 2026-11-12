'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {sidecarKeys} = require('../scripts/lib/nutrient-mapping.cjs');
const {shardFor} = require('../scripts/lib/nutrient-readers.cjs');
const frozenV94 = require('./fixtures/nutrient-runtime/v94-validation.cjs');

// Frozen original rules, captured during development; no Git or raw data at test time.
const frozenOlderRules = {
  "v94": {
    "commit": "ad92acf",
    "sha256": "15709bdcf010cd524ecea10f5eaa64c6a5e85f71be122248a4beabc1f707e860",
    "code": "const productValidData=validData;validData=function(s){return productValidData(s)&&s.custom.every(x=>(x.unit===undefined||['g','ml'].includes(x.unit))&&(x.barcode===undefined||validBarcode(x.barcode))&&(x.sourceUrl===undefined||x.sourceUrl==='https://world.openfoodfacts.org/product/'+x.barcode))&&s.foods.every(x=>x.unit===undefined||['g','ml'].includes(x.unit))};\n(function(){\n'use strict';\nconst object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);\nconst finite=(x,min=0,max=Infinity)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;\nconst integer=(x,min,max)=>Number.isInteger(x)&&finite(x,min,max);\nconst text=(x,max,min=0)=>typeof x==='string'&&x.length<=max&&x.trim().length>=min;\nconst views=['energy','micros','week'],sources=['bls','usda','ciqual','off','own','puls'];\nconst highlighted=['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'];\nconst subset=(x,keys,max=keys.length)=>Array.isArray(x)&&x.length<=max&&new Set(x).size===x.length&&x.every(k=>keys.includes(k));\nconst ratioOK=x=>object(x)&&['p','c','f'].every(k=>integer(x[k],5,80))&&x.p+x.c+x.f===100;\nconst copy=x=>Array.isArray(x)?x.map(copy):object(x)?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)])):x;\nconst optionKeys=['water','display','foodSearch','plan'];\nfunction optionCopy(s){const draft={...s};for(const key of optionKeys)if(s[key]!==undefined)draft[key]=copy(s[key]);return draft}\nconst displayDefaults=()=>({summaryViews:[...views],showRemaining:false,highlighted:[...highlighted],hapticsEnabled:true,motion:'system'});\nconst displayRules={summaryViews:x=>subset(x,views),showRemaining:x=>typeof x==='boolean',\n highlighted:x=>subset(x,typeof nutrientLabels==='object'?Object.keys(nutrientLabels):highlighted,8),\n // lastRankSeen 0..39 covers scale 2 and old backups (0..24 plus legacy 25/26); migrate87 maps unmarked values.\n hapticsEnabled:x=>typeof x==='boolean',motion:x=>['system','reduced'].includes(x),lastRankSeen:x=>integer(x,0,39),rankScale:x=>x===2};\nfunction cleanObject(source,key,rules){\n if(source[key]===undefined)return;\n if(!object(source[key])){delete source[key];return}\n for(const field of Object.keys(source[key]))if(!Object.hasOwn(rules,field)||!rules[field](source[key][field]))delete source[key][field];\n}\nfunction cleanOptions(s){\n cleanObject(s,'water',{mode:x=>['auto','manual'].includes(x),glassMl:x=>integer(x,100,1000)});\n cleanObject(s,'display',displayRules);\n cleanObject(s,'foodSearch',{sort:x=>['best','az','za','recent','frequent'].includes(x),sources:x=>subset(x,sources)});\n if(object(s.plan)){\n  if(s.plan.macroInput!==undefined&&!['grams','ratio'].includes(s.plan.macroInput))delete s.plan.macroInput;\n  if(s.plan.ratio!==undefined&&!ratioOK(s.plan.ratio))delete s.plan.ratio;\n  if(s.plan.macroInput==='ratio'&&!ratioOK(s.plan.ratio))delete s.plan.macroInput;\n }\n}\nfunction mealsOK(value){\n return Array.isArray(value)&&value.length<=200&&value.every(m=>object(m)&&text(m.id,60,1)&&text(m.name,100,1)&&\n  Array.isArray(m.items)&&m.items.length>=1&&m.items.length<=50&&m.items.every(x=>object(x)&&text(x.name,120,1)&&\n   finite(x.grams,0,5000)&&x.grams>0&&['g','ml'].includes(x.unit)&&['kcal','p','c','f'].every(k=>finite(x[k]))&&\n   (x.nutrients===undefined||object(x.nutrients)&&Object.values(x.nutrients).every(v=>finite(v)))&&\n   ['source','barcode','foodRef','recipeId'].every(k=>x[k]===undefined||typeof x[k]==='string')&&\n   (x.aiEstimate===undefined||typeof x.aiEstimate==='boolean')));\n}\nconst baseValid=validData;\nvalidData=function(s){\n if(!object(s))return false;\n // Native commands validate {...state,...}; never clean their shared subobjects.\n const draft=optionCopy(s);cleanOptions(draft);\n if(s.meals!==undefined&&!mealsOK(s.meals))return false;\n if(!baseValid(draft))return false;\n for(const key of optionKeys)if(draft[key]===undefined)delete s[key];else s[key]=draft[key];\n return true;\n};\n})();\n"
  },
  "v95": {
    "commit": "2ad15cb",
    "sha256": "e6a95906d391a54c88647e9052dde2a65abf800fc729e4bb1da8d6b45debd098",
    "code": "const productValidData=validData;validData=function(s){return productValidData(s)&&s.custom.every(x=>(x.unit===undefined||['g','ml'].includes(x.unit))&&(x.barcode===undefined||validBarcode(x.barcode))&&(x.sourceUrl===undefined||x.sourceUrl==='https://world.openfoodfacts.org/product/'+x.barcode))&&s.foods.every(x=>x.unit===undefined||['g','ml'].includes(x.unit))};\n(function(){\n'use strict';\nconst object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);\nconst finite=(x,min=0,max=Infinity)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;\nconst integer=(x,min,max)=>Number.isInteger(x)&&finite(x,min,max);\nconst text=(x,max,min=0)=>typeof x==='string'&&x.length<=max&&x.trim().length>=min;\nconst views=['energy','micros','week'],sources=['bls','usda','ciqual','off','own','puls'];\nconst highlighted=['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'];\nconst subset=(x,keys,max=keys.length)=>Array.isArray(x)&&x.length<=max&&new Set(x).size===x.length&&x.every(k=>keys.includes(k));\nconst ratioOK=x=>object(x)&&['p','c','f'].every(k=>integer(x[k],5,80))&&x.p+x.c+x.f===100;\nconst copy=x=>Array.isArray(x)?x.map(copy):object(x)?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)])):x;\nconst optionKeys=['water','display','foodSearch','plan'];\nfunction optionCopy(s){const draft={...s};for(const key of optionKeys)if(s[key]!==undefined)draft[key]=copy(s[key]);return draft}\nconst displayDefaults=()=>({summaryViews:[...views],showRemaining:false,highlighted:[...highlighted],hapticsEnabled:true,motion:'system'});\nconst displayRules={summaryViews:x=>subset(x,views),showRemaining:x=>typeof x==='boolean',\n highlighted:x=>subset(x,typeof nutrientLabels==='object'?Object.keys(nutrientLabels):highlighted,8),\n // lastRankSeen 0..39 covers scale 2 and old backups (0..24 plus legacy 25/26); migrate87 maps unmarked values.\n hapticsEnabled:x=>typeof x==='boolean',motion:x=>['system','reduced'].includes(x),lastRankSeen:x=>integer(x,0,39),rankScale:x=>x===2};\nfunction cleanObject(source,key,rules){\n if(source[key]===undefined)return;\n if(!object(source[key])){delete source[key];return}\n for(const field of Object.keys(source[key]))if(!Object.hasOwn(rules,field)||!rules[field](source[key][field]))delete source[key][field];\n}\nfunction cleanOptions(s){\n cleanObject(s,'water',{mode:x=>['auto','manual'].includes(x),glassMl:x=>integer(x,100,1000)});\n cleanObject(s,'display',displayRules);\n cleanObject(s,'foodSearch',{sort:x=>['best','az','za','recent','frequent'].includes(x),sources:x=>subset(x,sources)});\n if(object(s.plan)){\n  if(s.plan.macroInput!==undefined&&!['grams','ratio'].includes(s.plan.macroInput))delete s.plan.macroInput;\n  if(s.plan.ratio!==undefined&&!ratioOK(s.plan.ratio))delete s.plan.ratio;\n  if(s.plan.macroInput==='ratio'&&!ratioOK(s.plan.ratio))delete s.plan.macroInput;\n }\n}\nfunction mealsOK(value){\n return Array.isArray(value)&&value.length<=200&&value.every(m=>object(m)&&text(m.id,60,1)&&text(m.name,100,1)&&\n  Array.isArray(m.items)&&m.items.length>=1&&m.items.length<=50&&m.items.every(x=>object(x)&&(!window.pulsNutrients||window.pulsNutrients.validFields(x))&&text(x.name,120,1)&&\n   finite(x.grams,0,5000)&&x.grams>0&&['g','ml'].includes(x.unit)&&['kcal','p','c','f'].every(k=>finite(x[k]))&&\n   (x.nutrients===undefined||object(x.nutrients)&&Object.values(x.nutrients).every(v=>finite(v)))&&\n   ['source','barcode','foodRef','recipeId'].every(k=>x[k]===undefined||typeof x[k]==='string')&&\n   (x.aiEstimate===undefined||typeof x.aiEstimate==='boolean')));\n}\nconst baseValid=validData;\nvalidData=function(s){\n if(!object(s))return false;\n // Native commands validate {...state,...}; never clean their shared subobjects.\n const draft=optionCopy(s);cleanOptions(draft);\n if(s.meals!==undefined&&!mealsOK(s.meals))return false;\n if(!baseValid(draft))return false;\n for(const key of optionKeys)if(draft[key]===undefined)delete s[key];else s[key]=draft[key];\n return true;\n};\n})();\n(function(){\nconst plain = x => {\n  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;\n  const prototype = Object.getPrototypeOf(x);\n  return prototype === null || Object.getPrototypeOf(prototype) === null;\n};\nconst finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1e9;\nconst validKey = key => typeof key === 'string' && key.length >= 3 && key.length <= 140 && !/[\\u0000-\\u001f\\u007f-\\u009f]/.test(key) && key.indexOf(':') > 0 && key.indexOf(':') < key.length - 1;\nfunction validLabelValues(values) {\n  return plain(values) && Object.keys(values).length <= 40 && Object.entries(values).every(([key,value]) => /^[a-z][a-z0-9_]{0,31}$/.test(key) && finite(value));\n}\nfunction validFields(item) {\n  return plain(item) && (item.ck === undefined || validKey(item.ck)) && (item.nx === undefined || validLabelValues(item.nx));\n}\nconst baseValid = validData;\nvalidData = function (source) {\n  return plain(source) && ['foods','custom'].every(key => Array.isArray(source[key]) && source[key].every(validFields)) &&\n    (source.meals === undefined || Array.isArray(source.meals) && source.meals.every(meal => Array.isArray(meal?.items) && meal.items.every(validFields))) && baseValid(source);\n};\n\nwindow.pulsNutrients={validFields};})();"
  }
};

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
  assert(t.requests.every(url=>/^catalog\/nutrients-v2-\d{2}\.json$/.test(url)),'Only immutable v2 URLs are loaded');
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

  // Real v2 shards for each new source, plus the volume-basis exclusion.
  const manifest=JSON.parse(fs.readFileSync('catalog/manifest.json','utf8'));
  const catalogue=manifest.files.flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8')));
  const selected=['CNF_2','COFID_13-145','COFID_17-793','FNDDS_11111000'].map(id=>catalogue.find(r=>r[0]===id));
  const newFoods=selected.map((r,i)=>({id:'compat-'+i,name:r[1],catalogKey:r[7]+':'+r[0],source:r[7],record:r[0],unit:r[9]||'g',kcal:r[3],p:r[4],c:r[5],f:r[6],nutrients:r[8]}));
  const real=fixture({fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))})});
  await real.api.ensure(newFoods.map(p=>p.catalogKey));
  for(const p of newFoods) {
    const result=real.api.resolveProduct(p);
    if(p.unit==='ml') {assertValue(result,'sugars',null);assert.equal(result.pending,false);}
    else {assert.equal(result.origin.sugars,'catalog');assert.equal(result.pending,false);}
  }
  for(const key of ['CNF 2026:123','CoFID 2021:123','USDA FNDDS 2021-2023:123']) {
    const count=real.requests.length;assert.equal((await real.api.ensure([key])).unavailable.length,1);assert.equal(real.requests.length,count,'Malformed new record prefix does not trigger a fetch');
  }
  const wrongShape=fixture({fetch:async()=>({ok:true,json:async()=>({schemaVersion:1,keys,rows:[]})})});
  assert.equal((await wrongShape.api.ensure([newFoods[0].catalogKey])).unavailable.length,1);

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
  const compatProfile={...clone(valid),foodSearch:{sort:'az',sources:['bls','cnf','cofid','fndds'],catalogueSourcesVersion:1},custom:clone(newFoods),meals:[],foods:newFoods.map((p,i)=>({...entry({id:'compat-entry-'+i,ck:p.catalogKey,foodRef:p.id,unit:p.unit,grams:100}),name:p.name,kcal:p.kcal,p:p.p,c:p.c,f:p.f,nutrients:clone(p.nutrients)}))};
  const compatBefore=clone(compatProfile);
  c.compatProfile=clone(compatProfile);assert(run('validData(compatProfile)'),'Current full validator accepts v96 fixture');
  for(const [version,rules]of Object.entries(frozenOlderRules)) {
    assert.equal(require('node:crypto').createHash('sha256').update(rules.code).digest('hex'),rules.sha256);
    const legacy={window:{},validData:frozenV94};vm.createContext(legacy);vm.runInContext(rules.code,legacy);
    const old=clone(compatProfile);assert(legacy.validData(old),rules.commit+' accepts new source records and ml');
    const expected=clone(compatProfile);delete expected.foodSearch.sources;delete expected.foodSearch.catalogueSourcesVersion;
    assert.deepEqual(clone(old),expected,version+' only discards the unknown source options');
    assert.deepEqual(old.custom,compatBefore.custom);assert.deepEqual(old.foods,compatBefore.foods);
    // Simulate old-device upload, then the actual current import/migration path.
    c.compatReturn=clone(old);run('compatReturn=prepareImportedData(compatReturn)');
    const restored=clone(run('compatReturn'));
    assert.deepEqual(restored.custom,compatBefore.custom);assert.deepEqual(restored.foods,compatBefore.foods);
    assert.equal(restored.foodSearch.catalogueSourcesVersion,1);
    assert.deepEqual(restored.foodSearch.sources,['bls','usda','ciqual','off','own','puls','cnf','cofid','fndds'],'Source preferences reset to defaults after older-device sync');
  }
  console.log('PASS: frozen ad92acf / 2ad15cb core, nutrient, unit and option rules accept v96 sources/g/ml/ck; older sync loses source preferences, retains all food IDs and snapshots');
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
