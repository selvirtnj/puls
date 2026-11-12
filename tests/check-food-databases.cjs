'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const {csv,number,record}=require('../scripts/import-food-databases.cjs');
const read=f=>fs.readFileSync(f,'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const manifest=JSON.parse(read('catalog/manifest.json')),rows=manifest.files.flatMap(f=>{assert(fs.existsSync(f),f);return JSON.parse(read(f))});
assert.equal(rows.length,manifest.count);assert.equal(manifest.count,28893);assert.equal(new Set(manifest.files).size,manifest.files.length);
assert.equal(new Set(rows.map(r=>r[0])).size,rows.length,'IDs globally unique');
const baseHash=crypto.createHash('sha256');for(let i=0;i<37;i++)baseHash.update(fs.readFileSync('catalog/foods-'+i+'.json'));
assert.equal(baseHash.digest('hex'),'1bb7f716807bd9965109a7c7e8b22ee7facf0beaa2845f4a4b3328980bc28e7b','existing chunks byte-identical');
const counts={};for(const r of rows){counts[r[7]]=(counts[r[7]]||0)+1;for(const v of [...r.slice(3,7),...Object.values(r[8]||{})])assert(Number.isFinite(v)&&v>=0,r[0]);assert(r[9]===undefined||r[9]==='ml');}
assert.deepEqual(counts,manifest.sources);
const lookup=id=>rows.find(r=>r[0]===id);
// Fixed expectations transcribed from source records, never read from the temp directory.
assert.deepEqual(lookup('CNF_2').slice(3,7),[204,9.54415,5.911,15.7047]);
assert.equal(lookup('CNF_2')[8].fiber,.117);assert.equal(lookup('CNF_2')[8].b12,.60432);
assert.deepEqual(lookup('COFID_13-145').slice(3,7),[151,2.9,.8,15.2]);
assert.equal(lookup('COFID_13-145')[8].potassium,270);assert.equal(lookup('COFID_13-145')[8].vitc,30);
assert(!Object.hasOwn(lookup('COFID_13-145')[8],'fiber'),'blank AOACFIB / unknown NSP never becomes zero');
assert.deepEqual(lookup('COFID_17-793').slice(3,7),[98,4,9.6,2.3]);assert.equal(lookup('COFID_17-793')[9],'ml');
assert.deepEqual(lookup('FNDDS_11111000').slice(3,7),[61,3.27,4.63,3.2]);assert.equal(lookup('FNDDS_11111000')[8].b12,.54);
assert(!lookup('FNDDS_11000000'),'no invented human milk profile');
assert(!lookup('CNF_14'),'unchanged USDA vinegar (NDB 02053) deduplicated by NDB/FDC mapping');
assert(!lookup('COFID_13-146'),'unquantified trace carbohydrate never becomes an invented zero macro');
assert.equal(lookup('167512')[5],41.2,'legacy USDA total carbohydrate remains unchanged');assert.equal(lookup('167512')[8].fiber,1.2);
for(const r of rows.filter(r=>/^(CNF_|COFID_|FNDDS_)/.test(r[0]))){assert.equal(r[1],r[2]);assert(Object.keys(r[8]).every(k=>['water','fiber','vitc','calcium','iron','b12','potassium','magnesium','folate'].includes(k)));}
assert.deepEqual(csv('\uFEFFa,b\r\n"quoted, name","line\nwith ""quote"""\r\n'),[['a','b'],['quoted, name','line\nwith "quote"']]);
for(const v of ['',null,'N','Tr','-1','NaN','Infinity'])assert.equal(number(v),undefined);assert.equal(number('0'),0);
assert.equal(record('test','No protein',{kcal:4,c:1,f:0},'fixture'),null);
const portions=JSON.parse(read('catalog/portions.json'));
const originalPortions=Object.fromEntries(Object.entries(portions).filter(([k])=>!k.startsWith('CNF 2026:')&&!k.startsWith('USDA FNDDS 2021-2023:')));
assert.equal(crypto.createHash('sha256').update(JSON.stringify(originalPortions)).digest('hex'),'21bc4dcb468dcd89ff4bb8e0c3118a30cc6d6739645bb338ff22c07c72db832f','all old portion values preserved');
for(const [key,list] of Object.entries(portions).filter(([k])=>/^(CNF 2026:|USDA FNDDS 2021-2023:)/.test(k))){assert(list.length<=4);assert(lookup(key.slice(key.indexOf(':')+1)));for(const p of list){assert.equal(p.unit,'g');assert(p.amount>0&&p.amount<=10000);assert(p.name.length<=80)}}
assert.equal(portions['CNF 2026:CNF_2'][0].amount,40.152,'2026 measure is grams, no times-100');
assert.equal(portions['USDA FNDDS 2021-2023:FNDDS_11111000'].find(p=>p.name==='1 cup').amount,244);
assert.equal(lookup('FNDDS_11830150')[5],57.9);assert.equal(lookup('FNDDS_11830150')[8].fiber,37,'FNDDS KH includes fibre, no subtraction');
// Exercise the real v87 option validation/migration without persistence/network.
const c={state:{},window:{},validData:s=>s.accept!==false,migrate(){},render(){},today:()=> '2026-11-10',console};
vm.createContext(c);vm.runInContext(read('js/puls-data-v87.js'),c);const api=c.window.pulsData87;
let s={foodSearch:{sort:'az',sources:['own','bls']},foods:[{id:'keep',nutrients:{fiber:2}}],workouts:[{id:'keep-workout'}]};
const payload=JSON.stringify({foods:s.foods,workouts:s.workouts});assert(c.validData(s));api.migrate(s);
assert.deepEqual(clone(s.foodSearch.sources),['own','bls','cnf','cofid','fndds']);assert.equal(s.foodSearch.catalogueSourcesVersion,1);
assert.equal(JSON.stringify({foods:s.foods,workouts:s.workouts}),payload);
s.foodSearch.sources=['bls'];const once=JSON.stringify(s);assert(c.validData(s));api.migrate(s);assert.equal(JSON.stringify(s),once,'explicit later opt-out survives');
const restored=clone(s);assert(c.validData(restored));api.migrate(restored);assert.deepEqual(clone(restored.foodSearch.sources),['bls']);
const oldBackup={foodSearch:{sources:[]}};assert(c.validData(oldBackup));api.migrate(oldBackup);assert.deepEqual(clone(oldBackup.foodSearch.sources),['cnf','cofid','fndds']);
const shared={foodSearch:{sources:['bls'],catalogueSourcesVersion:1}},before=JSON.stringify(shared);assert(!c.validData({...shared,accept:false}));assert.equal(JSON.stringify(shared),before);
// Actual source classification, independently selectable FNDDS (before /^USDA/).
vm.runInContext(read('js/food-page.js').match(/function fpSourceKeys\(x\)\{[\s\S]*?\n\}/)[0],c);
for(const [source,key] of [['CNF 2026','cnf'],['CoFID 2021','cofid'],['USDA FNDDS 2021-2023','fndds'],['USDA SR Legacy 2018','usda']])assert.deepEqual([...c.fpSourceKeys({source})],[key]);
for(const f of ['js/food-page.js','js/food-diary.js','js/puls-data-v87.js'])for(const key of ['cnf','cofid','fndds'])assert(read(f).includes("'"+key+"'"));
const attrs=["Health Canada, Canadian Nutrient File 2026. Contains information licensed under the Open Government Licence – Canada.","Public Health England, McCance and Widdowson's Composition of Foods Integrated Dataset 2021. Contains public sector information licensed under the Open Government Licence v3.0.","U.S. Department of Agriculture, Agricultural Research Service. 2024. USDA Food and Nutrient Database for Dietary Studies 2021-2023."];
for(const f of ['js/catalog-search.js','js/lifecycle.js','js/native-nutrition.js','README.md','docs/FOOD-DATABASES.md'])for(const attr of attrs)assert(read(f).replaceAll("\\'","'").includes(attr),'Attribution '+f);
assert(read('js/food-page.js').includes('esc(foodCatalogueAttribution)'),'attribution accessible in active DE/EN filter sheet');
assert(read('sw.js').includes("CATALOG_CACHE='puls-catalog-v3'"));
// Real worker: English searches, BLS preference, and source filtering before limit.
let replies=[];const worker={postMessage:r=>replies.push(r)};vm.createContext(worker);vm.runInContext(read('js/catalog-worker.js'),worker);
worker.onmessage({data:{type:'init',rows:[...Array(65).fill('milk whole'),'milk whole'],names:Array(66).fill('milk whole'),sources:[...Array(65).fill(['bls']),['fndds']],priorities:[...Array(65).fill(35),0]}});
worker.onmessage({data:{type:'query',id:1,alternatives:[['milk']],sources:['fndds']}});assert.deepEqual(clone(replies.at(-1).indices),[65]);
worker.onmessage({data:{type:'query',id:2,alternatives:[['milk']]}});assert.equal(replies.at(-1).indices[0],0);
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
worker.onmessage({data:{type:'init',rows:rows.map(r=>normalize(r[1]+' '+r[2])),names:rows.map(r=>normalize(r[1])),sources:rows.map(r=>[...c.fpSourceKeys({source:r[7]})]),priorities:rows.map(r=>/^BLS/.test(r[7])?35:0)}});
const start=performance.now();for(const token of ['milk','cheese','apple','chicken','rice']){worker.onmessage({data:{type:'query',id:3,alternatives:[[token]],sources:['cnf','cofid','fndds']}});assert(replies.at(-1).count>0)}
console.log('PASS: food database counts/IDs, raw-value fixtures, units/portions, CSV/missing values, backup migration, source filters, English worker searches and attribution; 5 worker queries '+Math.round(performance.now()-start)+' ms (Node VM, not iPhone)');
async function loaderTest(){
 let active=0,peak=0;
 const loader={normalizeSearch:normalize,showSearch(){},searchFoods(){},fetch:async url=>{active++;peak=Math.max(peak,active);await new Promise(setImmediate);active--;return {ok:true,json:async()=>JSON.parse(read(url.split('?')[0]))}}};
 vm.createContext(loader);vm.runInContext(read('js/catalog-search.js').split('const fullShowSearch=')[0],loader);await loader.loadFoodCatalogue();
 assert(peak<=4,'bounded downloads');const items=vm.runInContext('localCatalogue',loader);assert.equal(items.length,manifest.count);
 const drink=items.find(x=>x.record==='COFID_17-793');assert.equal(drink.unit,'ml');assert(drink.search.includes('egg nog'));
 const food=items.find(x=>x.record==='FNDDS_11111000');assert(food.search.includes('milk whole'),'English name searchable in German UI');
 Object.assign(loader,{state:{custom:[]},uid:()=> 'saved-drink',save(){},selectFood(){},$:()=>({insertAdjacentHTML(){}}),esc:String});
 vm.runInContext(read('js/catalog-search.js').split('\n').find(line=>line.startsWith('function chooseCatalogueFood(')),loader);
 loader.chooseCatalogueFood(drink.id);assert.equal(loader.state.custom[0].unit,'ml');assert.equal(loader.state.custom[0].catalogKey,'CoFID 2021:COFID_17-793');
 Object.assign(loader,{fpSourceKeys:c.fpSourceKeys,fpSearchPrefs:()=>({sources:['fndds']}),catalogueAlternatives:()=>[['milk']],foodPriority:()=>0,foodRelevance:()=>0,catalogueQuerySerial:1,setTimeout:fn=>setImmediate(fn)});
 vm.runInContext(read('js/food-upgrade.js').split('\n').find(line=>line.startsWith('fallbackCatalogueSearch=')),loader);
 const fallback=await loader.fallbackCatalogueSearch('milk',1);assert(fallback.count>60);assert(fallback.indices.every(i=>items[i].source==='USDA FNDDS 2021-2023'),'fallback source filter before cap');
 console.log('PASS: real catalogue loader uses <=4 downloads, English names and ml persist through selection; final fallback filters before 60-result cap');
}
loaderTest().catch(error=>{console.error(error);process.exitCode=1});
