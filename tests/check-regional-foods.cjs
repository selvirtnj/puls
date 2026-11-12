const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {turkish,balkan}=require('./fixtures/regional-foods.cjs');
const supplements=require('./fixtures/regional-food-supplements.cjs');
const groups=[['tr',turkish,'Dyt. Şeyda Ertaş · Rezept-Richtwert'],['ba',balkan,'FitKofer · Rezept-Richtwert'],...supplements.map(s=>[s.group,s.rows,s.source])];
const addedCount=groups.reduce((n,[,refs])=>n+refs.length,0);
const read=f=>fs.readFileSync(f,'utf8');
const manifest=JSON.parse(read('catalog/manifest.json'));
const rows=manifest.files.flatMap(f=>JSON.parse(read(f)));
const portions=JSON.parse(read('catalog/portions.json'));
// App catalogue IDs are positional: preserve the exact original prefix, including order.
assert.equal(crypto.createHash('sha256').update(JSON.stringify(rows.slice(0,18200))).digest('hex'),
 '640030e29f67300c3748011972a324fb328f5a18172e52ff52dd6d6ff03fc4a2');
assert.equal(rows.length,28893);
assert.equal(manifest.count,rows.length);
assert.equal(Object.values(manifest.sources).reduce((a,b)=>a+b,0),rows.length);
assert.equal(new Set(rows.map(r=>r[7]+':'+r[0])).size,rows.length);
const added=rows.slice(18200,18200+addedCount);
assert.equal(new Set(added.map(r=>r[0])).size,addedCount);
for(const [group,refs,source] of groups){
 assert.equal(manifest.sources[source],refs.length);
 for(const [slug,name,alias,g,...values] of refs){
  const row=added.find(r=>r[0]==='PULS_'+group+'_'+slug);
  assert(row,slug);assert.equal(row.length,9);assert.equal(row[1],name);assert.equal(row[2],alias);assert.equal(row[7],source);
  assert.deepEqual(row.slice(3,7),values.slice(0,4).map(n=>Math.round(n*100/g*100)/100));
  assert.deepEqual(row[8],{},'Unknown micronutrients stay unknown');
  for(const [i,n] of row.slice(3,7).entries())assert(Number.isFinite(n)&&n>=0&&n<=(i?100:1000),slug);
  const [kcal,p,c,f]=row.slice(3,7),estimate=4*p+4*c+9*f;
  assert(p+c+f<=100,slug);assert(Math.abs(kcal-estimate)<=estimate*.1,slug+' macro energy');
  assert(!rows.slice(0,18200).some(r=>r[1]===name),'No existing name duplicated: '+name);
  const portion=values[4],actual=portions[source+':'+row[0]];
  if(portion){assert.equal(actual[0].amount,portion);assert.equal(actual[0].unit,'g');if(values[5])assert.equal(actual[0].name,values[5]);else assert.match(actual[0].name,/ca\./)}
  else assert.equal(actual,undefined);
 }
}
// Exercise the shipped loader and worker without network or an actual user profile.
async function checkSearch(){
 const ctx={showSearch(){},searchFoods(){},fetch:async url=>({ok:true,json:async()=>JSON.parse(read(url.split('?')[0]))})};
 vm.createContext(ctx);
 vm.runInContext(read('js/personal.js').split('\n').slice(0,2).join('\n'),ctx);
 vm.runInContext(read('js/catalog-search.js').split('const fullShowSearch=')[0],ctx);
 await vm.runInContext('loadFoodCatalogue()',ctx);
 const foods=vm.runInContext('localCatalogue',ctx);
 assert.equal(foods.length,manifest.count);
 let result;
 const worker={postMessage:x=>result=x};vm.createContext(worker);vm.runInContext(read('js/catalog-worker.js'),worker);
 worker.onmessage({data:{type:'init',rows:foods.map(x=>x.search),names:foods.map(x=>x.name)}});
 const normalize=s=>vm.runInContext('normalizeSearch('+JSON.stringify(s)+')',ctx);
 function query(q){worker.onmessage({data:{type:'query',id:1,alternatives:normalize(q).split(' ').filter(Boolean).map(t=>[t])}});return result.indices}
 for(const row of added){
  const index=rows.indexOf(row);
  assert(query(row[1]).includes(index),'Name found: '+row[1]);
  assert.equal(foods[index].record,row[0]);assert.equal(foods[index].unit,'g');
 }
 for(const [q,id] of [['cevapi','PULS_ba_cevapi'],['ćevapčići','PULS_ba_cevapi'],['borek käse','PULS_tr_peynirli-borek'],['boerek spinat','PULS_tr_ispanakli-borek'],['burek spinat','PULS_tr_ispanakli-borek'],['börek sirnica','PULS_ba_burek-sir'],['burek cheese','PULS_ba_burek-sir'],['manti','PULS_tr_manti'],['krompirusa','PULS_ba_krompirusa'],['djuvec','PULS_ba_duvec'],['sopska','PULS_ba_sopska-salata'],['kunefe','PULS_tr_kunefe'],['doener iskender','PULS_tr_iskender-kebap'],['cig kofte','PULS_tr_komagene-cig-kofte']]){
  assert(query(q).some(i=>rows[i][0]===id),'Alias found: '+q);
 }
 // Existing dishes remain available instead of receiving replacement duplicates.
 for(const q of ['Döner','Lahmacun','Ayran','Baklava','Ajvar'])assert(query(q).length,q);
 for(const [q,id] of [['sucuk','PULS_sucuk_roh'],['adana','PULS_adana_usta'],['doener dueruem kalb','PULS_durum-kalb_mangal'],['döner dürüm hähnchen','PULS_durum-huhn_pommes'],['doener teller','PULS_doenerteller_ohne-brot'],['somun','PULS_lepinja_dondon'],['kiflice','PULS_kiflice_zlatna']])assert(query(q).some(i=>rows[i][0]===id),'Supplement alias found: '+q);
 assert.equal(added.filter(r=>r[0]==='PULS_tr_urfa-kebap').length,1,'Keep the existing Urfa entry');
 console.log('PASS: '+addedCount+' regional foods, unchanged original IDs, reference conversions, portions, macro energy and offline loader/worker search');
}
module.exports=checkSearch();
module.exports.catch(error=>{console.error(error);process.exitCode=1});
