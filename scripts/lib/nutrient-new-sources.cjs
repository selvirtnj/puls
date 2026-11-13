'use strict';
const fs = require('node:fs'), path = require('node:path');
const {csvRows,numeric} = require('./nutrient-readers.cjs');
const {LEGACY_KEYS} = require('./nutrient-mapping.cjs');
const {CNF} = require('./nutrient-new-mapping.cjs');
const CNF_DIR = 'cnf-2026/cnf_fcen_all-files-data_2026_extracted/';
const EXTRA_SOURCES = [
  {name:'CNF 2026',edition:'Canadian Nutrient File 2026',count:2573,files:[
    ['cnf-2026/cnf_fcen_all-files-data_2026.zip','f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd'],
    [CNF_DIR+'Food_Name.csv','ee75a3208e8b79ee523ec5adffcf149f3f21806ac5d9942a9449077efe414c6c'],
    [CNF_DIR+'Nutrient_Amount.csv','c53803c72faadbdec9750ccaa1fc9a9cfd8732e0c784d2a66c62cd27d09b22d2'],
    [CNF_DIR+'Nutrient_Name.csv','708a942fc8a6a4913b106cd964f4f3b116845ec72942a936477241be8889f785'],
    [CNF_DIR+'Measure_Type.csv','ce6ecd0f370820d6800d7b7b88ae5710691b5d7b358c0503273d36a1a878f977'],
    [CNF_DIR+'Measure_Name.csv','429cf2e8d4bbd2b732a6e9acf35427ce6d3b4e9447aabaf86b427c48833b112f'],
    [CNF_DIR+'Measure_Weight_Conversion.csv','9d41fac4ba1471fddd25ea7e51a8352aec66de4f3c88802b0a2e02a85ebc3e6f']
  ]}
];
function csvObjects(file) {
  const rows = [...csvRows(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))], header = rows.shift();
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(header.map((k,i) => [k,r[i] ?? ''])));
}
function unique(rows,key) {
  const result = new Map();
  for (const row of rows) { const id = String(key(row)); if(result.has(id))throw Error('Duplicate raw ID '+id); result.set(id,row); }
  return result;
}
function auditCnf(dictionary) {
  for (const [key,[id,unit,name,tag]] of Object.entries(CNF)) {
    const raw = dictionary.get(String(id));
    if (!raw || raw.Nutrient_Unit !== unit || raw.Nutrient_Name_EN !== name || raw.Tagname !== tag) throw Error('CNF definition/unit mismatch '+key+'/'+id);
  }
}
function split(values) {
  return {values:Object.fromEntries(Object.entries(values).filter(([k]) => !['kcal','p','c','f',...LEGACY_KEYS].includes(k))),
    legacy:Object.fromEntries(LEGACY_KEYS.map(k => [k,values[k] ?? null])),macros:['kcal','p','c','f'].map(k => values[k] ?? null)};
}
function readCnf(root) {
  const read = name => csvObjects(path.join(root,CNF_DIR+name+'.csv'));
  const records = unique(read('Food_Name'),r => 'CNF_'+r.Food_Code), dictionary = unique(read('Nutrient_Name'),r=>r.Nutrient_Code);
  auditCnf(dictionary);
  const amounts = new Map(), diagnostics = {negativeCells:0,definitionChecks:Object.keys(CNF).length};
  for (const r of read('Nutrient_Amount')) {
    const id = 'CNF_'+r.Food_Code;
    if (!records.has(id) || !dictionary.has(r.Nutrient_Code)) throw Error('Unknown CNF food/nutrient ID');
    if (!amounts.has(id)) amounts.set(id,new Map());
    const food = amounts.get(id);if(food.has(r.Nutrient_Code))throw Error('Duplicate CNF nutrient '+id+'/'+r.Nutrient_Code);
    food.set(r.Nutrient_Code,numeric(r.Nutrient_Amount));
    if (Number(r.Nutrient_Amount)<0) diagnostics.negativeCells++;
  }
  return {records,diagnostics,get(id) {
    if(!records.has(id))return null;
    return split(Object.fromEntries(Object.entries(CNF).map(([key,[code]]) => [key,amounts.get(id)?.get(String(code)) ?? null])));
  }};
}
module.exports = {EXTRA_SOURCES,CNF_DIR,csvObjects,auditCnf,readCnf};
