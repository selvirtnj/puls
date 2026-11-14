'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const {csv,number,record,auditMeasureTypes}=require('../scripts/import-food-databases.cjs');
const read=f=>fs.readFileSync(f,'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const manifest=JSON.parse(read('catalog/manifest.json')),rows=manifest.files.flatMap(f=>{assert(fs.existsSync(f),f);return JSON.parse(read(f))});
assert.equal(rows.length,manifest.count);assert.equal(manifest.count,20826);assert.equal(new Set(manifest.files).size,manifest.files.length);
assert.equal(new Set(rows.map(r=>r[0])).size,rows.length,'IDs globally unique');
const baseHash=crypto.createHash('sha256');for(let i=0;i<37;i++)baseHash.update(read('catalog/foods-'+i+'.json').replace(/\r\n/g,'\n'));
assert.equal(baseHash.digest('hex'),'cf0e8a509b4ef1a04a91a4a9e8f4a06091ba9c5e30fab92a0142b7a411f8b8ac','existing chunks retain original LF bytes');
const counts={};for(const r of rows){counts[r[7]]=(counts[r[7]]||0)+1;for(const v of [...r.slice(3,7),...Object.values(r[8]||{})])assert(Number.isFinite(v)&&v>=0,r[0]);assert(r[9]===undefined||r[9]==='ml');}
assert.deepEqual(counts,manifest.sources);
const lookup=id=>rows.find(r=>r[0]===id);
// Fixed expectations transcribed from source records, never read from the temp directory.
assert.deepEqual(lookup('CNF_2').slice(3,7),[204,9.54415,5.911,15.7047]);
assert.equal(lookup('CNF_2')[8].fiber,.117);assert.equal(lookup('CNF_2')[8].b12,.60432);
assert(!rows.some(r=>/^(COFID_|FNDDS_)/.test(r[0])||/^(CoFID 2021|USDA FNDDS 2021-2023)/.test(r[7])),'CoFID 2021 and USDA FNDDS 2021-2023 were removed on 14.11.2026 and stay out');
assert(!Object.keys(manifest.sources).some(s=>/^(CoFID 2021|USDA FNDDS 2021-2023)/.test(s)));assert.equal(manifest.sources['CNF 2026'],2573);
assert(!lookup('CNF_14'),'unchanged USDA vinegar (NDB 02053) deduplicated by NDB/FDC mapping');
assert.equal(lookup('167512')[5],41.2,'legacy USDA total carbohydrate remains unchanged');assert.equal(lookup('167512')[8].fiber,1.2);
for(const r of rows.filter(r=>/^CNF_/.test(r[0]))){assert(r[1]&&r[1]===r[1].trim()&&!/[<>]/.test(r[1]),'CNF display name invalid: '+r[0]);assert(r[2]&&typeof r[2]==='string','CNF English search name missing: '+r[0]);assert(Object.keys(r[8]).every(k=>['water','fiber','vitc','calcium','iron','b12','potassium','magnesium','folate'].includes(k)));}
assert.deepEqual(csv('\uFEFFa,b\r\n"quoted, name","line\nwith ""quote"""\r\n'),[['a','b'],['quoted, name','line\nwith "quote"']]);
for(const v of ['',null,'N','Tr','-1','NaN','Infinity'])assert.equal(number(v),undefined);assert.equal(number('0'),0);
assert.equal(record('test','No protein',{kcal:4,c:1,f:0},'fixture'),null);
const portions=JSON.parse(read('catalog/portions.json'));
const cnfPortions=Object.fromEntries(Object.entries(portions).filter(([k])=>k.startsWith('CNF 2026:')));
const otherPortions=Object.fromEntries(Object.entries(portions).filter(([k])=>!k.startsWith('CNF 2026:')));
assert.equal(Object.values(cnfPortions).flat().length,7703);
assert.equal(Object.keys(cnfPortions).length,2511);
assert.equal(2573-Object.keys(cnfPortions).length,62,'CNF foods without a portion');
// Independently rebuilt from only type-6 raw measures, before the four-portion cap.
assert.equal(crypto.createHash('sha256').update(JSON.stringify(cnfPortions)).digest('hex'),'7bfa7379fba08fee81e647c29541a7ac9e642afd5cf5ce7e05f2b75adc141922','Every CNF portion matches the type-6 rebuild, with no refuse/yield measures');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(otherPortions)).digest('hex'),'21bc4dcb468dcd89ff4bb8e0c3118a30cc6d6739645bb338ff22c07c72db832f','All other sources retain their portions; the former FNDDS portions are gone');
assert.deepEqual(cnfPortions['CNF 2026:CNF_130'].map(p=>[p.name,p.amount]),[['1 large egg',50],['100 ml chopped',57.481],['15 ml',8.615],['50 g',50]]);
assert.deepEqual(cnfPortions['CNF 2026:CNF_668'].map(p=>p.amount),[83,125,90],'Refuse, bone and skin excluded before limiting portions');
assert.deepEqual(cnfPortions['CNF 2026:CNF_693'].map(p=>[p.name,p.amount]),[['1/2 bird',133],['55 g',55]],'No 19.45-g yield measure');
const measureTypes=[['3','Refuse'],['6','User-defined'],['9','Yield']].map(([Measure_Type_Code,Measure_Type_Description_EN])=>({Measure_Type_Code,Measure_Type_Description_EN}));
assert.equal(auditMeasureTypes(measureTypes).get('6'),'User-defined');
assert.throws(()=>auditMeasureTypes(measureTypes.map(r=>r.Measure_Type_Code==='6'?{...r,Measure_Type_Description_EN:'Yield'}:r)),/measure type definition/);
assert.throws(()=>auditMeasureTypes(measureTypes.slice(1)),/measure type definition/);
assert.throws(()=>auditMeasureTypes([measureTypes[0],measureTypes[0],measureTypes[2]]),/measure type definition/);
for(const [key,list] of Object.entries(portions).filter(([k])=>k.startsWith('CNF 2026:'))){assert(list.length<=4);assert(lookup(key.slice(key.indexOf(':')+1)));for(const p of list){assert.equal(p.unit,'g');assert(p.amount>0&&p.amount<=10000);assert(p.name.length<=80)}}
assert.equal(portions['CNF 2026:CNF_2'][0].amount,40.152,'2026 measure is grams, no times-100');
assert(!Object.keys(portions).some(k=>/^USDA FNDDS 2021-2023:/.test(k)),'No FNDDS portions');
// Exercise the real v87 option validation/migration without persistence/network.
const c={state:{},window:{},migrate(){},render(){},today:()=> '2026-11-10',console};
vm.createContext(c);vm.runInContext(read('js/puls-data.js'),c);const api=c.window.pulsData87;
// validData (js/app.js) bereinigt die Optionen mit optionDraft/optionCommit und schreibt sie nur nach bestandener Prüfung zurück; hier mit einem Stand-in für die übrigen Abschnitte (accept:false lehnt ab).
c.validData=s=>{const draft=api.optionDraft(s);if(draft.accept===false)return false;api.optionCommit(s,draft);return true};
let s={foodSearch:{sort:'az',sources:['own','bls']},foods:[{id:'keep',nutrients:{fiber:2}}],workouts:[{id:'keep-workout'}]};
const payload=JSON.stringify({foods:s.foods,workouts:s.workouts});assert(c.validData(s));api.migrate(s);
assert.deepEqual(clone(s.foodSearch.sources),['own','bls','cnf']);assert.equal(s.foodSearch.catalogueSourcesVersion,1);
assert.equal(JSON.stringify({foods:s.foods,workouts:s.workouts}),payload);
s.foodSearch.sources=['bls'];const once=JSON.stringify(s);assert(c.validData(s));api.migrate(s);assert.equal(JSON.stringify(s),once,'explicit later opt-out survives');
const restored=clone(s);assert(c.validData(restored));api.migrate(restored);assert.deepEqual(clone(restored.foodSearch.sources),['bls']);
const oldBackup={foodSearch:{sources:[]}};assert(c.validData(oldBackup));api.migrate(oldBackup);assert.deepEqual(clone(oldBackup.foodSearch.sources),['cnf']);
// Saved states that still carry the retired keys stay valid and are not rewritten; unversioned ones only gain cnf.
const retiredKeys={foodSearch:{sort:'az',sources:['bls','cofid','fndds'],catalogueSourcesVersion:1}},retiredBefore=JSON.stringify(retiredKeys.foodSearch);assert(c.validData(retiredKeys));api.migrate(retiredKeys);assert.equal(JSON.stringify(retiredKeys.foodSearch),retiredBefore);
const retiredOld={foodSearch:{sources:['bls','cofid','fndds']}};assert(c.validData(retiredOld));api.migrate(retiredOld);assert.deepEqual(clone(retiredOld.foodSearch.sources),['bls','cofid','fndds','cnf']);assert.equal(retiredOld.foodSearch.catalogueSourcesVersion,1);
assert(read('js/puls-data.js').includes("'cnf','cofid','fndds'];"),'cofid/fndds remain valid stored source keys');
const shared={foodSearch:{sources:['bls'],catalogueSourcesVersion:1}},before=JSON.stringify(shared);assert(!c.validData({...shared,accept:false}));assert.equal(JSON.stringify(shared),before);
// Future sources/versions survive validation, migration, storage and known-source controls.
const future={foodSearch:{sort:'az',sources:['bls','fineli'],catalogueSourcesVersion:2}};
assert(c.validData(future));api.migrate(future);const futurePrefs=JSON.stringify(future.foodSearch);api.migrate(future);
assert.equal(JSON.stringify(future.foodSearch),futurePrefs);assert.equal(JSON.stringify(api.foodSearch(future)),futurePrefs);
for(const sources of [['x'],['Fineli'],['fi-neli'],['fineli','fineli'],Array.from({length:33},(_,i)=>'s'+i)]){
 const bad={foodSearch:{sources,catalogueSourcesVersion:2}};assert(c.validData(bad));assert(!Object.hasOwn(bad.foodSearch,'sources'),'Malformed optional sources are cleaned');
}
const prefsContext={fdField:()=>future.foodSearch,fdEnsure:()=>future.foodSearch,fdDefaults:{foodSearch:{sources:['bls','usda','ciqual','cnf','off','own','puls']}},save(){},fpApplyFilter(){},fpFilterSheet(){},document:{querySelectorAll:()=>[]},fdSound(){},toast(){},fdT:x=>x};
vm.createContext(prefsContext);
vm.runInContext(read('js/food-page.js').split('\n').filter(l=>l.startsWith('const fpSorts=')||l.startsWith('function fpSearchPrefs(')||l.startsWith('function fpToggleSource(')||l.startsWith('function fpResetFilter(')).join('\n')+'\n'+read('js/food-page.js').match(/function fpStoreSearch\(sort,sources\)\{[\s\S]*?\n\}/)[0],prefsContext);
assert.deepEqual(clone(prefsContext.fpSearchPrefs().sources),['bls']);
prefsContext.fpToggleSource('bls');assert.deepEqual(future.foodSearch.sources,['bls','fineli'],'Unknown keys do not satisfy the minimum-known-source rule');
prefsContext.fpToggleSource('cnf');assert.deepEqual(clone(future.foodSearch.sources),['bls','cnf','fineli']);
prefsContext.fpToggleSource('fineli');assert(future.foodSearch.sources.includes('fineli'));
prefsContext.fpResetFilter();assert.equal(future.foodSearch.catalogueSourcesVersion,2);assert.equal(future.foodSearch.sources.at(-1),'fineli');assert.equal(prefsContext.fpSearchPrefs().sources.length,7);
const futureKeys=Array.from({length:32},(_,i)=>'future'+i);
future.foodSearch.sources=[...futureKeys];
prefsContext.fpResetFilter();
assert.deepEqual(clone(future.foodSearch.sources),[...prefsContext.fdDefaults.foodSearch.sources,...futureKeys.slice(0,32-prefsContext.fdDefaults.foodSearch.sources.length)],'All known sources take priority over unknown sources at the 32-key limit');
assert(c.validData(future));
future.foodSearch.sources=['bls',...futureKeys.slice(0,31)];
prefsContext.fpToggleSource('cnf');
assert.deepEqual(clone(future.foodSearch.sources),['bls','cnf',...futureKeys.slice(0,30)]);
prefsContext.fpToggleSource('bls');
const lastKnown=JSON.stringify(future.foodSearch);
prefsContext.fpToggleSource('cnf');
assert.equal(JSON.stringify(future.foodSearch),lastKnown,'Unknown sources cannot permit deselecting the last known database');
// Retired source keys stay stored but are ignored. Only retired keys means "all databases", never an empty list; an explicit empty list is unchanged.
for(const [stored,expected] of [[['fndds'],7],[['cofid','fndds'],7],[['cofid','bls'],1],[[],0]]){future.foodSearch.sources=stored;assert.equal(prefsContext.fpSearchPrefs().sources.length,expected,JSON.stringify(stored));}
future.foodSearch.sources=['fndds'];assert.deepEqual(clone(prefsContext.fpSearchPrefs().sources),[...prefsContext.fdDefaults.foodSearch.sources]);
future.foodSearch.sources=['bls','cofid','fndds'];prefsContext.fpToggleSource('cnf');assert.deepEqual(clone(future.foodSearch.sources),['bls','cnf','cofid','fndds'],'Toggling keeps the retired keys');
assert(!/\['(cofid|fndds)',/.test(read('js/food-page.js').split('\n').find(l=>l.startsWith('const fpSourceNames='))),'No CoFID/FNDDS filter option');
assert(!/'(cofid|fndds)'/.test(read('js/food-diary.js')),'No CoFID/FNDDS default source');
// Product-detail attribution still covers CNF and, for foods saved earlier, the retired sources.
Object.assign(c,{fdT:de=>de,fpAllKey:food=>food.catalogKey});
vm.runInContext(read('js/food-page.js').match(/function fpSourceCredit\(food\)\{[\s\S]*?\n\}/)[0],c);
for(const [source,label] of [['CNF 2026','Health Canada'],['CoFID 2021','Public Health England'],['USDA FNDDS 2021-2023','U.S. Department of Agriculture']])assert(c.fpSourceCredit({catalogKey:source+':fixture'}).includes(label));
// Actual source classification; the retired keys still classify foods saved earlier (FNDDS before /^USDA/).
vm.runInContext(read('js/food-page.js').match(/function fpSourceKeys\(x\)\{[\s\S]*?\n\}/)[0],c);
for(const [source,key] of [['CNF 2026','cnf'],['CoFID 2021','cofid'],['USDA FNDDS 2021-2023','fndds'],['USDA SR Legacy 2018','usda']])assert.deepEqual([...c.fpSourceKeys({source})],[key]);
for(const f of ['js/food-page.js','js/food-diary.js','js/puls-data.js'])assert(read(f).includes("'cnf'"));
const attrs=["Health Canada, Canadian Nutrient File 2026. Contains information licensed under the Open Government Licence – Canada."];
for(const f of ['js/catalog-search.js','js/lifecycle.js','README.md'])assert(!/Public Health England|Dietary Studies|CoFID/.test(read(f)),'Catalogue-wide credit lists only databases that are shipped: '+f);
for(const f of ['js/catalog-search.js','js/lifecycle.js','README.md','docs/FOOD-DATABASES.md'])for(const attr of attrs)assert(read(f).replaceAll("\\'","'").includes(attr),'Attribution '+f);
assert(read('js/food-page.js').includes('esc(foodCatalogueAttribution)'),'attribution accessible in active DE/EN filter sheet');
assert(read('sw.js').includes("CATALOG_CACHE='puls-catalog-v5'"));
// Real worker: English searches, BLS preference, and source filtering before limit.
let replies=[];const worker={postMessage:r=>replies.push(r)};vm.createContext(worker);vm.runInContext(read('js/catalog-worker.js'),worker);
worker.onmessage({data:{type:'init',rows:[...Array(65).fill('milk whole'),'milk whole'],names:Array(66).fill('milk whole'),sources:[...Array(65).fill(['bls']),['cnf']],priorities:[...Array(65).fill(35),0]}});
worker.onmessage({data:{type:'query',id:1,alternatives:[['milk']],sources:['cnf']}});assert.deepEqual(clone(replies.at(-1).indices),[65]);
worker.onmessage({data:{type:'query',id:2,alternatives:[['milk']]}});assert.equal(replies.at(-1).indices[0],0);
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
worker.onmessage({data:{type:'init',rows:rows.map(r=>normalize(r[1]+' '+r[2])),names:rows.map(r=>normalize(r[1])),sources:rows.map(r=>[...c.fpSourceKeys({source:r[7]})]),priorities:rows.map(r=>/^BLS/.test(r[7])?35:0)}});
const start=performance.now();for(const token of ['milk','cheese','apple','chicken','rice']){worker.onmessage({data:{type:'query',id:3,alternatives:[[token]],sources:['cnf']}});assert(replies.at(-1).count>0)}
console.log('PASS: food database counts/IDs, raw-value fixtures, units/portions, CSV/missing values, backup migration, source filters, English worker searches and attribution; 5 worker queries '+Math.round(performance.now()-start)+' ms (Node VM, not iPhone)');
async function loaderTest(){
 let active=0,peak=0;
 const loader={normalizeSearch:normalize,showSearch(){},searchFoods(){},fetch:async url=>{active++;peak=Math.max(peak,active);await new Promise(setImmediate);active--;return {ok:true,json:async()=>JSON.parse(read(url.split('?')[0]))}}};
 vm.createContext(loader);vm.runInContext(read('js/catalog-search.js').split('const fullShowSearch=')[0],loader);await loader.loadFoodCatalogue();
 assert(peak<=4,'bounded downloads');const items=vm.runInContext('localCatalogue',loader);assert.equal(items.length,manifest.count);
  const food=items.find(x=>x.record==='CNF_2');assert(food.search.includes('cheese souffle'),'English name searchable in German UI');
 // No ml food is shipped any more; the saved-unit repair for ml stays covered with synthetic rows.
 const mlRow=(id,name)=>({id:'synthetic_'+id,record:id,name,alias:name,kcal:98,p:4,c:9.6,f:2.3,source:'Synthetic ml fixture',nutrients:{},unit:'ml',search:name.toLowerCase()});
 const drink=mlRow('ML_1','Egg nog'),wrong=mlRow('ML_2','Drink');items.push(drink,wrong);
 Object.assign(loader,{state:{custom:[]},uid:()=> 'saved-drink',save(){},selectFood(){},$:()=>({insertAdjacentHTML(){}}),esc:String});
 vm.runInContext(read('js/catalog-search.js').split('\n').find(line=>line.startsWith('function chooseCatalogueFood(')),loader);
 loader.state.custom.push({id:'existing',catalogKey:wrong.source+':'+wrong.record,unit:'g',name:wrong.name});
 loader.state.foods=[{id:'old-entry',foodRef:'existing',unit:'g',grams:100}];loader.state.meals=[{items:[{unit:'g',amount:100}]}];const snapshots=JSON.stringify([loader.state.foods,loader.state.meals]);
 loader.chooseCatalogueFood(wrong.id);assert.equal(loader.state.custom.find(x=>x.id==='existing').unit,'ml');assert.equal(JSON.stringify([loader.state.foods,loader.state.meals]),snapshots);
 loader.state.custom.shift();
 loader.chooseCatalogueFood(drink.id);assert.equal(loader.state.custom[0].unit,'ml');assert.equal(loader.state.custom[0].catalogKey,'Synthetic ml fixture:ML_1');
 items.length=manifest.count;
 Object.assign(loader,{fpSourceKeys:c.fpSourceKeys,fpSearchPrefs:()=>({sources:['cnf']}),catalogueAlternatives:()=>[['milk']],foodPriority:()=>0,foodRelevance:()=>0,catalogueQuerySerial:1,setTimeout:fn=>setImmediate(fn)});
 vm.runInContext(read('js/food-upgrade.js').split('\n').find(line=>line.startsWith('fallbackCatalogueSearch=')),loader);
 const fallback=await loader.fallbackCatalogueSearch('milk',1,['cnf']);assert(fallback.count>60);assert(fallback.indices.every(i=>items[i].source==='CNF 2026'),'fallback source filter before cap');
 // Exercise actual worker dispatch and final fallback for food page and recipes.
 const query=read('js/lifecycle.js').split('\n').find(l=>l.startsWith('async function queryCatalogueAsync('));
 Object.assign(loader,{fpActive:()=>true,startCatalogueWorker:async()=>true,catalogueResponses:new Map(),clearTimeout,fpSearchPrefs:()=>({sources:['cnf']})});
 loader.setTimeout=setTimeout;
 loader.catalogueWorker={postMessage:message=>{worker.onmessage({data:message});loader.catalogueResponses.get(message.id)(replies.at(-1))}};
 vm.runInContext(query,loader);
 let filtered=await loader.queryCatalogueAsync('milk',1);assert(filtered.indices.every(i=>items[i].source==='CNF 2026'));
 let native=await loader.queryCatalogueAsync('milk','nativeNutrition:1');assert(native.indices.some(i=>items[i].source!=='CNF 2026'));
 loader.fpActive=()=>false;let recipe=await loader.queryCatalogueAsync('milk',1);assert.deepEqual(clone(recipe.indices),clone(native.indices));
 loader.startCatalogueWorker=async()=>false;loader.setTimeout=fn=>setImmediate(fn);
 let recipeFallback=await loader.queryCatalogueAsync('milk',1);assert.equal(recipeFallback.count,recipe.count);
 loader.fpActive=()=>true;let foodFallback=await loader.queryCatalogueAsync('milk',1);assert.equal(foodFallback.count,filtered.count);assert(foodFallback.indices.every(i=>items[i].source==='CNF 2026'));
 console.log('PASS: real catalogue loader uses <=4 downloads, English names and ml persist through selection; final fallback filters before 60-result cap');
}
loaderTest().catch(error=>{console.error(error);process.exitCode=1});

// The new raw-input importer must report differences before any write. This
// comparison uses only synthetic catalogue data and needs neither raw files nor Git.
{
 const {compareOutputs,reviewedPortionChanges}=require('../scripts/import-food-databases.cjs');
 const changes=[{field:'catalog/portions.json.CNF 2026:CNF_130.0.name',old:'total refuse',new:'1 large egg'}];
 assert(reviewedPortionChanges(changes));
 for(const field of ['catalog/portions.json.USDA FNDDS 2021-2023:FNDDS_11111000.0.amount','catalog/foods-42.json:COFID_13-669 (Food).8.iron','catalog/manifest.json.count','serialization/order'])assert(!reviewedPortionChanges([...changes,{field,old:0,new:1}]));
 const readFile=fs.readFileSync,exists=fs.existsSync,write=fs.writeFileSync;
 try {
  fs.existsSync=()=>true;fs.writeFileSync=()=>{throw Error('Unexpected write')};
  fs.readFileSync=()=>JSON.stringify([['same-id','Food','Food',10,1,2,3,'Source',{iron:1}]]);
  const output=[{file:'catalog/foods-37.json',data:[['same-id','Food','Food',10,1,2,3,'Source',{iron:2}]]}];
  assert.deepEqual(compareOutputs(output,[]),[{field:'catalog/foods-37.json:same-id (Food).8.iron',old:1,new:2}]);
  output[0].data[0][8].iron=1;assert.deepEqual(compareOutputs(output,[]),[]);
  fs.readFileSync=()=>JSON.stringify(output[0].data).replace(/,/g,', ');
  assert.equal(compareOutputs(output,[])[0].field,'serialization/order','Even equal data with different serialized output fails LF reproduction');
 } finally {fs.readFileSync=readFile;fs.existsSync=exists;fs.writeFileSync=write;}
}

