'use strict';
const fs = require('node:fs'), path = require('node:path');
const {readXlsx,csvRows,numeric} = require('./nutrient-readers.cjs');
const {LEGACY_KEYS} = require('./nutrient-mapping.cjs');
const {CNF,FNDDS,COFID} = require('./nutrient-new-mapping.cjs');
const CNF_DIR = 'cnf-2026/cnf_fcen_all-files-data_2026_extracted/';
const EXTRA_SOURCES = [
  {name:'CNF 2026',edition:'Canadian Nutrient File 2026',count:2573,files:[
    ['cnf-2026/cnf_fcen_all-files-data_2026.zip','f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd'],
    [CNF_DIR+'Food_Name.csv','ee75a3208e8b79ee523ec5adffcf149f3f21806ac5d9942a9449077efe414c6c'],
    [CNF_DIR+'Nutrient_Amount.csv','c53803c72faadbdec9750ccaa1fc9a9cfd8732e0c784d2a66c62cd27d09b22d2'],
    [CNF_DIR+'Nutrient_Name.csv','708a942fc8a6a4913b106cd964f4f3b116845ec72942a936477241be8889f785'],
    [CNF_DIR+'Measure_Name.csv','429cf2e8d4bbd2b732a6e9acf35427ce6d3b4e9447aabaf86b427c48833b112f'],
    [CNF_DIR+'Measure_Weight_Conversion.csv','9d41fac4ba1471fddd25ea7e51a8352aec66de4f3c88802b0a2e02a85ebc3e6f']
  ]},
  {name:'CoFID 2021',edition:'CoFID 2021',count:2636,files:[
    ['cofid-2021/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx','436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d']
  ]},
  {name:'USDA FNDDS 2021-2023',edition:'Survey Foods 2021-2023, JSON 2024-10-31',count:5431,files:[
    ['usda-fndds/FoodData_Central_survey_food_json_2024-10-31_extracted/surveyDownload.json','2e7eb9fda92adf1d4d784dba5eaa3a7fd4418cd86ccff383c7c9294d79e9b808']
  ]}
];
// Existing 7a01611 catalogue anomalies established by the stopped first audit.
// Preserve those snapshots; additional fields are joined to the correct raw food.
const KNOWN_BASE_DIFFERENCES = [
  ['COFID_13-669','vitc',62,3], ['COFID_13-669','calcium',138,24],
  ['COFID_13-669','iron',0.72,0.49], ['COFID_13-669','potassium',300,389],
  ['COFID_13-669','magnesium',16,27], ['COFID_13-669','folate',43,20],
  ['COFID_14-377','iron',null,0.07]
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
function auditFndds(nutrient,expected) {
  const [id,number,unit,name] = expected;
  if (nutrient.id !== id || nutrient.number !== number || nutrient.unitName !== unit || nutrient.name !== name) throw Error('FNDDS definition/number/unit mismatch '+id);
}
function auditCofid(rows,mapping) {
  const columns = new Map();
  for(const [key,[code,header,name]] of Object.entries(mapping)) {
    const indices = rows[1].map((value,i) => value === code ? i : -1).filter(i => i >= 0);
    if (indices.length !== 1 || rows[0][indices[0]] !== header || rows[2][indices[0]] !== name) throw Error('CoFID definition/unit mismatch '+key+'/'+code);
    columns.set(key,indices[0]);
  }
  return columns;
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
function readCofid(root) {
  const file = path.join(root,EXTRA_SOURCES[1].files[0][0]), merged = new Map();
  const diagnostics = {negativeCells:0,parenthesizedUnknown:0,definitionChecks:0,mlRowsExcluded:0,duplicateCodes:['13-669 (Aubergine / Watercress), joined by code and exact food name']};
  for(const [sheet,mapping] of Object.entries(COFID)) {
    const rows = readXlsx(file,sheet), columns = auditCofid(rows,mapping), records = unique(rows.slice(3),r=> 'COFID_'+r[0]+':'+r[1]);
    diagnostics.definitionChecks += columns.size;
    if(records.size !== 2887)throw Error('Unexpected CoFID sheet record count '+sheet);
    if(merged.size && (records.size !== merged.size || [...records.keys()].some(id => !merged.has(id))))throw Error('CoFID sheet IDs differ '+sheet);
    for(const [id,row] of records) {
      if(!merged.has(id))merged.set(id,{});
      for(const [key,i] of columns) merged.get(id)[key] = numeric(row[i]);
      for(const cell of row.slice(7)) {
        if(/^\s*\(.*\)\s*$/.test(String(cell)))diagnostics.parenthesizedUnknown++;
        if(Number(cell)<0)diagnostics.negativeCells++;
      }
    }
  }
  return {records:merged,diagnostics,get(id,name) {const row=merged.get(id+':'+name);return row ? split(row) : null;}};
}
function readFndds(root) {
  const foods = JSON.parse(fs.readFileSync(path.join(root,EXTRA_SOURCES[2].files[0][0]),'utf8')).SurveyFoods;
  const records = unique(foods,r=>'FNDDS_'+r.foodCode), amounts = new Map(), spec = new Map(Object.values(FNDDS).map(s=>[s[0],s]));
  const diagnostics = {negativeCells:0,definitionChecks:0};
  for(const [id,row] of records) {
    const food = new Map();
    for(const n of row.foodNutrients) {
      if(food.has(n.nutrient.id))throw Error('Duplicate FNDDS nutrient '+id+'/'+n.nutrient.id);
      if(spec.has(n.nutrient.id)) {auditFndds(n.nutrient,spec.get(n.nutrient.id));diagnostics.definitionChecks++;}
      food.set(n.nutrient.id,numeric(n.amount));if(n.amount<0)diagnostics.negativeCells++;
    }
    if(food.size && [...spec.keys()].some(id => !food.has(id)))throw Error('Missing FNDDS mapped nutrient '+id);
    amounts.set(id,food);
  }
  return {records,diagnostics,get(id) {
    if(!records.has(id))return null;
    return split(Object.fromEntries(Object.entries(FNDDS).map(([key,[code]])=>[key,amounts.get(id).get(code) ?? null])));
  }};
}
module.exports = {EXTRA_SOURCES,CNF_DIR,KNOWN_BASE_DIFFERENCES,csvObjects,auditCnf,auditFndds,auditCofid,readCnf,readCofid,readFndds};
