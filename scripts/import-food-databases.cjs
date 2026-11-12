/* Rebuild and compare only the CNF/CoFID/FNDDS extension, without writing files.
 * Usage: node scripts/import-food-databases.cjs [raw-data-directory]
 * Standard-library only; deterministic, safe to rerun. See docs/FOOD-DATABASES.md.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readXlsx}=require('./lib/nutrient-readers.cjs');
const {EXTRA_SOURCES,CNF_DIR}=require('./lib/nutrient-new-sources.cjs');
const {sha256}=require('./import-nutrients.cjs');
const root=path.resolve(__dirname,'..');
const sources=['CNF 2026','CoFID 2021','USDA FNDDS 2021-2023'];
const nutrients={208:'kcal',203:'p',204:'f',205:'c',255:'water',291:'fiber',401:'vitc',301:'calcium',303:'iron',418:'b12',306:'potassium',304:'magnesium',417:'folate'};
// RFC 4180, including quoted newlines, commas, escaped quotes and UTF-8 BOM.
function csv(text){
 const rows=[];let row=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(field);field='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[]}}
  else field+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 if(field||row.length){row.push(field);rows.push(row)}return rows;
}
function number(value){if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:undefined;const s=String(value??'').trim();if(!/^\d+(?:\.\d+)?$/.test(s))return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined}
function objects(rows){const header=rows[0];return rows.slice(1).map(row=>Object.fromEntries(header.map((k,i)=>[k,row[i]??''])))}
function record(id,name,n,source,unit='g'){
 // Positional macros cannot be omitted: require all four rather than invent zeros.
 if(!name||!['kcal','p','c','f'].every(k=>Number.isFinite(n[k])&&n[k]>=0))return null;
 const micro=Object.fromEntries(Object.values(nutrients).filter(k=>!['kcal','p','c','f'].includes(k)&&Number.isFinite(n[k])).map(k=>[k,n[k]]));
 const row=[id,name,name,n.kcal,n.p,n.c,n.f,source,micro];if(unit!=='g')row.push(unit);return row;
}
function importDatabases(rawDir=path.join(root,'catalog-raw')){
 for(const source of EXTRA_SOURCES)for(const [file,hash]of source.files)if(sha256(fs.readFileSync(path.join(rawDir,file)))!==hash)throw Error('Raw SHA-256 mismatch: '+file);
 const read=file=>csv(fs.readFileSync(path.join(rawDir,file),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'catalog/manifest.json'),'utf8'));
 const original=[],oldExtension=[];
 for(const file of manifest.files){const rows=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));if(rows.some(r=>sources.includes(r[7]))){if(!rows.every(r=>sources.includes(r[7])))throw Error('Mixed extension chunk');oldExtension.push(file)}else original.push({file,rows})}
 const legacyIds=new Set(original.flatMap(x=>x.rows).filter(r=>r[7]==='USDA SR Legacy 2018').map(r=>r[0]));
 const ndbMap=require('./usda-sr-legacy-ndb.json').ndbToFdc;
 const legacyNdb=new Set(Object.entries(ndbMap).filter(([,fdc])=>legacyIds.has(fdc)).map(([ndb])=>String(Number(ndb))));
 const portions=JSON.parse(fs.readFileSync(path.join(root,'catalog/portions.json'),'utf8'));
 for(const key of Object.keys(portions))if(sources.some(s=>key.startsWith(s+':')))delete portions[key];
 const rows=[],stats=Object.fromEntries(sources.map(s=>[s,{imported:0,skipped:0,duplicates:0,incomplete:0,portions:0}]));
 function add(row,source){if(!row){stats[source].skipped++;stats[source].incomplete++;return false}rows.push(row);stats[source].imported++;return true}
 function portion(id,source,name,amount){if(!name||!(amount>0&&amount<=10000))return;const key=source+':'+id,list=portions[key]??=[];name=name.trim().slice(0,80);if(list.length<4&&!list.some(p=>p.name===name&&p.amount===amount)){list.push({name,amount,unit:'g',source});stats[source].portions++}}
 const cnf=new Map();
 for(const x of objects(read(CNF_DIR+'Nutrient_Amount.csv'))){const key=nutrients[x.Nutrient_Code],value=number(x.Nutrient_Amount);if(key&&value!==undefined){if(!cnf.has(x.Food_Code))cnf.set(x.Food_Code,{});cnf.get(x.Food_Code)[key]=value}}
 const importedCnf=new Set();
 for(const x of objects(read(CNF_DIR+'Food_Name.csv'))){
  // Only unchanged USDA data: Canadian adaptations (1/3/4/6/10 etc.) stay.
  if(['0','11'].includes(x.Food_Source_Code)&&legacyNdb.has(String(Number(x.USDA_NDB_Code)))){stats[sources[0]].skipped++;stats[sources[0]].duplicates++;continue}
  if(add(record('CNF_'+x.Food_Code,x.Food_Description_EN,cnf.get(x.Food_Code)||{},sources[0]),sources[0]))importedCnf.add(x.Food_Code);
 }
 const measures=new Map(objects(read(CNF_DIR+'Measure_Name.csv')).map(x=>[x.Measure_Code,x.Measure_Description_and_Unit_EN]));
 // 2026 structure guide p17: this is weight of the measure, NOT the old /100 factor.
 for(const x of objects(read(CNF_DIR+'Measure_Weight_Conversion.csv')))if(importedCnf.has(x.Food_Code))portion('CNF_'+x.Food_Code,sources[0],measures.get(x.Measure_Code),number(x.Measure_Weight_Conversion));
 function cofid(sheet){const data=readXlsx(path.join(rawDir,EXTRA_SOURCES[1].files[0][0]),sheet),keys=Array.from({length:data[0].length},(_,i)=>String(data[1][i]??'').trim()||String(data[0][i]??'').trim()||'Food Code');return data.slice(3).map(row=>Object.fromEntries(keys.map((k,i)=>[k,row[i]??''])))}
 // Food Code 13-669 occurs for two distinct foods in the official workbook.
 // Joining on the exact food name as well prevents the old cross-food overwrite.
 const cofidKey=x=>x['Food Code']+':'+x['Food Name'];
 const minerals=new Map(cofid('1.4 Inorganics').map(x=>[cofidKey(x),x])),vitamins=new Map(cofid('1.5 Vitamins').map(x=>[cofidKey(x),x]));
 for(const x of cofid('1.3 Proximates')){
  const values={...x,...minerals.get(cofidKey(x)),...vitamins.get(cofidKey(x))},n={};
  for(const [key,code] of Object.entries({kcal:'KCALS',p:'PROT',c:'CHO',f:'FAT',water:'WATER',fiber:'AOACFIB',vitc:'VITC',calcium:'CA',iron:'FE',b12:'VITB12',potassium:'K',magnesium:'MG',folate:'FOLT'})){
   // Tr is a positive but unspecified trace, not a measured zero. N/blank also omitted.
   const value=number(values[code]);if(value!==undefined)n[key]=value;
  }
  // Do not substitute NSP (ENGFIB) for total dietary fibre (AOACFIB).
  // Appendix B p26: alcoholic beverages are group Q (all subgroups).
  add(record('COFID_'+x['Food Code'],x['Food Name'],n,sources[1],/^Q/.test(x.Group)?'ml':'g'),sources[1]);
 }
 const survey=JSON.parse(fs.readFileSync(path.join(rawDir,EXTRA_SOURCES[2].files[0][0]),'utf8')).SurveyFoods;
 for(const x of survey){const n={};for(const v of x.foodNutrients){const key=nutrients[Number(v.nutrient.number)],value=number(v.amount);if(key&&value!==undefined)n[key]=value}const id='FNDDS_'+x.foodCode;if(add(record(id,x.description,n,sources[2]),sources[2]))for(const p of x.foodPortions||[])portion(id,sources[2],p.portionDescription,number(p.gramWeight))}
 const ids=new Set();for(const r of [...original.flatMap(x=>x.rows),...rows]){if(ids.has(r[0]))throw Error('Duplicate ID '+r[0]);ids.add(r[0])}
 const files=original.map(x=>x.file),start=Math.max(...files.map(f=>Number(f.match(/foods-(\d+)/)[1])))+1;
 const outputs=[];for(let offset=0;offset<rows.length;offset+=500)outputs.push({file:'catalog/foods-'+(start+offset/500)+'.json',data:rows.slice(offset,offset+500)});
 manifest.files=[...files,...outputs.map(o=>o.file)];manifest.count=ids.size;
 manifest.sources=Object.fromEntries(Object.entries(manifest.sources).filter(([s])=>!sources.includes(s)));
 for(const source of sources)manifest.sources[source]=stats[source].imported;
 outputs.push({file:'catalog/manifest.json',data:manifest},{file:'catalog/portions.json',data:portions});
 const differences=compareOutputs(outputs,oldExtension);
 if(differences.length){console.error(JSON.stringify({reproducible:false,differences},null,2));throw Error('Base import differs; no files written');}
 // An existing catalogue is a verification target. Do not even rewrite identical
 // files (or change checkout line endings). A separate reviewed migration is
 // required to accept different values; never rewrite foods-0...36 here.
 console.log(JSON.stringify({count:manifest.count,stats,catalogueBytes:fs.readdirSync(path.join(root,'catalog')).reduce((n,f)=>n+fs.statSync(path.join(root,'catalog',f)).size,0)},null,2));
 return {stats,reproducible:true};
}
function compareOutputs(outputs,oldExtension){
 const differences=[];
 function compare(old,value,location){
  if(JSON.stringify(old)===JSON.stringify(value))return;
  if(old&&value&&typeof old==='object'&&typeof value==='object'){
   for(const key of new Set([...Object.keys(old),...Object.keys(value)]))compare(old[key],value[key],location+'.'+key);
  }else differences.push({field:location,old:old??null,new:value??null});
 }
 for(const {file,data}of outputs){
  if(!fs.existsSync(path.join(root,file))){differences.push({file,missing:true});continue}
  const text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
  if(text===JSON.stringify(data))continue;
  const old=JSON.parse(text),start=differences.length;
  if(Array.isArray(data)&&Array.isArray(old)){
   const byId=new Map(old.map(r=>[r[0],r]));
   for(const row of data)compare(byId.get(row[0]),row,file+':'+row[0]+' ('+row[1]+')');
   for(const row of old)if(!data.some(r=>r[0]===row[0]))differences.push({file,food:row[0],removed:true});
  }else compare(old,data,file);
  if(differences.length===start)differences.push({file,field:'serialization/order',oldSha256:sha256(text),newSha256:sha256(JSON.stringify(data))});
 }
 for(const file of oldExtension)if(!outputs.some(o=>o.file===file))differences.push({file,removed:true});
 return differences;
}
module.exports={csv,number,record,importDatabases,compareOutputs};
if(require.main===module){try{importDatabases(process.argv[2])}catch(error){console.error(error.message);process.exitCode=1}}
