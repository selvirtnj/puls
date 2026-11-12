/* Rebuild only the CNF/CoFID/FNDDS extension. Raw inputs are never executed/copied.
 * Usage: node scripts/import-food-databases.cjs [raw-data-directory]
 * Standard-library only; deterministic, safe to rerun. See docs/FOOD-DATABASES.md.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
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
function importDatabases(rawDir=String.raw`C:\Users\selvir\AppData\Local\Temp\puls-fooddb`){
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
 for(const x of objects(read('cnf/extracted/Nutrient_Amount.csv'))){const key=nutrients[x.Nutrient_Code],value=number(x.Nutrient_Amount);if(key&&value!==undefined){if(!cnf.has(x.Food_Code))cnf.set(x.Food_Code,{});cnf.get(x.Food_Code)[key]=value}}
 const importedCnf=new Set();
 for(const x of objects(read('cnf/extracted/Food_Name.csv'))){
  // Only unchanged USDA data: Canadian adaptations (1/3/4/6/10 etc.) stay.
  if(['0','11'].includes(x.Food_Source_Code)&&legacyNdb.has(String(Number(x.USDA_NDB_Code)))){stats[sources[0]].skipped++;stats[sources[0]].duplicates++;continue}
  if(add(record('CNF_'+x.Food_Code,x.Food_Description_EN,cnf.get(x.Food_Code)||{},sources[0]),sources[0]))importedCnf.add(x.Food_Code);
 }
 const measures=new Map(objects(read('cnf/extracted/Measure_Name.csv')).map(x=>[x.Measure_Code,x.Measure_Description_and_Unit_EN]));
 // 2026 structure guide p17: this is weight of the measure, NOT the old /100 factor.
 for(const x of objects(read('cnf/extracted/Measure_Weight_Conversion.csv')))if(importedCnf.has(x.Food_Code))portion('CNF_'+x.Food_Code,sources[0],measures.get(x.Measure_Code),number(x.Measure_Weight_Conversion));
 function cofid(file){const data=read('cofid/CoFID_2021__'+file+'.csv'),keys=data[1].map((k,i)=>k.trim()||data[0][i].trim()||'Food Code');return data.slice(3).map(row=>Object.fromEntries(keys.map((k,i)=>[k,row[i]??''])))}
 const minerals=new Map(cofid('1.4 Inorganics').map(x=>[x['Food Code'],x])),vitamins=new Map(cofid('1.5 Vitamins').map(x=>[x['Food Code'],x]));
 for(const x of cofid('1.3 Proximates')){
  const values={...x,...minerals.get(x['Food Code']),...vitamins.get(x['Food Code'])},n={};
  for(const [key,code] of Object.entries({kcal:'KCALS',p:'PROT',c:'CHO',f:'FAT',water:'WATER',fiber:'AOACFIB',vitc:'VITC',calcium:'CA',iron:'FE',b12:'VITB12',potassium:'K',magnesium:'MG',folate:'FOLT'})){
   // Tr is a positive but unspecified trace, not a measured zero. N/blank also omitted.
   const value=number(values[code]);if(value!==undefined)n[key]=value;
  }
  // Do not substitute NSP (ENGFIB) for total dietary fibre (AOACFIB).
  // Appendix B p26: alcoholic beverages are group Q (all subgroups).
  add(record('COFID_'+x['Food Code'],x['Food Name'],n,sources[1],/^Q/.test(x.Group)?'ml':'g'),sources[1]);
 }
 const survey=JSON.parse(fs.readFileSync(path.join(rawDir,'fndds/extracted/surveyDownload.json'),'utf8')).SurveyFoods;
 for(const x of survey){const n={};for(const v of x.foodNutrients){const key=nutrients[Number(v.nutrient.number)],value=number(v.amount);if(key&&value!==undefined)n[key]=value}const id='FNDDS_'+x.foodCode;if(add(record(id,x.description,n,sources[2]),sources[2]))for(const p of x.foodPortions||[])portion(id,sources[2],p.portionDescription,number(p.gramWeight))}
 const ids=new Set();for(const r of [...original.flatMap(x=>x.rows),...rows]){if(ids.has(r[0]))throw Error('Duplicate ID '+r[0]);ids.add(r[0])}
 const files=original.map(x=>x.file),start=Math.max(...files.map(f=>Number(f.match(/foods-(\d+)/)[1])))+1;
 const outputs=[];for(let offset=0;offset<rows.length;offset+=500)outputs.push({file:'catalog/foods-'+(start+offset/500)+'.json',data:rows.slice(offset,offset+500)});
 // Compute/validate everything before writing. Never rewrite existing base chunks.
 for(const output of outputs)fs.writeFileSync(path.join(root,output.file),JSON.stringify(output.data));
 for(const file of oldExtension)if(!outputs.some(o=>o.file===file))fs.unlinkSync(path.join(root,file));
 manifest.files=[...files,...outputs.map(o=>o.file)];manifest.count=ids.size;
 manifest.sources=Object.fromEntries(Object.entries(manifest.sources).filter(([s])=>!sources.includes(s)));
 for(const source of sources)manifest.sources[source]=stats[source].imported;
 fs.writeFileSync(path.join(root,'catalog/manifest.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(root,'catalog/portions.json'),JSON.stringify(portions));
 console.log(JSON.stringify({count:manifest.count,stats,catalogueBytes:fs.readdirSync(path.join(root,'catalog')).reduce((n,f)=>n+fs.statSync(path.join(root,'catalog',f)).size,0)},null,2));
 return stats;
}
module.exports={csv,number,record,importDatabases};
if(require.main===module)importDatabases(process.argv[2]);
