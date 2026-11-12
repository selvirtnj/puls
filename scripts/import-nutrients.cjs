'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {readXlsx, csvRows, numeric, formatNumber, shardFor} = require('./lib/nutrient-readers.cjs');
const {BLS, USDA, CIQUAL, LEGACY_BLS, LEGACY_USDA, LEGACY_CIQUAL, sidecarKeys, roundSr, formulaDependencies, blsValue, ciqualValues} = require('./lib/nutrient-mapping.cjs');
const {EXTRA_SOURCES,readCnf,readCofid,readFndds} = require('./lib/nutrient-new-sources.cjs');

const ROOT = path.resolve(__dirname, '..');
const BASE_DIGEST = 'b628e42785483adeae717bfdc15c9026306445f3ca37fb39da463937fc884a2d';
const EXTENSION_DIGEST = '6214fff77c679a8a502002efa481197f2028d7a6f26ecd1c7c070ffb16894587';
const BLS_DIR = 'bls-4.0/BLS_4_0_2025_DE_extracted/BLS_4_0_2025_DE/';
const SR_DIR = 'usda-sr-legacy-2018/FoodData_Central_sr_legacy_food_csv_2018-04_extracted/FoodData_Central_sr_legacy_food_csv_2018-04/';
const SOURCES = [
  {name:'BLS 4.0', edition:'BLS 4.0, 2025 DE', count:7090, files:[
    [BLS_DIR + 'BLS_4_0_Daten_2025_DE.xlsx', '524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60'],
    [BLS_DIR + 'BLS_4_0_Components_DE_EN.xlsx', '359aefcd2086f45e62ff3dbd0c8536306e594a5806ac325d8bf86f484561bdf4']
  ]},
  {name:'USDA SR Legacy 2018', edition:'SR Legacy April 2018', count:7793, files:[
    [SR_DIR + 'food.csv', 'de8b0390058db4f102368c9fbdfde144790b480ff4cb0507c0e060ef99805dee'],
    [SR_DIR + 'food_nutrient.csv', '6d07e6fc062b09750c4d95112be5a5cdb56a2346efcfd0c96b7a7d705812d4bd'],
    [SR_DIR + 'nutrient.csv', '466ab9d011094cc1ad8d939b246693988b56817c42d0e40a98820723695c6084']
  ]},
  {name:'USDA Foundation 2026', edition:'Foundation JSON 2026-10-29', count:311, files:[
    ['usda-foundation-2026-10-json/FoodData_Central_foundation_food_json_2026-10-29_extracted/FoodData_Central_foundation_food_json_2026-10-29.json', '990e7731dcec30cecbbb212896a0fe4333f38c65ce7f525e2b679f0dc27658a1'],
    ['usda-foundation/FoodData_Central_foundation_food_csv_2026-10-29_extracted/FoodData_Central_foundation_food_csv_2026-10-29/nutrient.csv', '226ba937d1a73e8c87bd7fdcdd577524699bef4025c9232ee474b7d3083498ff']
  ]},
  {name:'Ciqual 2025', edition:'Ciqual 2025, FR 2025-11-03', count:3006, files:[
    ['ciqual-2025/Table_Ciqual_2025_FR_2025_11_03.xlsx', '5555c572fa3735991298d832d0427788fa69a11b4fd20a5d580d58942369fbb0']
  ]}, ...EXTRA_SOURCES
];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function baseFiles() {
  // Only the original 37 food chunks underpin nutrients-v1; manifest/portions may grow.
  return Array.from({length:37}, (_, i) => 'foods-' + i + '.json').sort()
    // Git may check these text files out as CRLF. Pin the deployed LF bytes.
    .map(f => [f, sha256(fs.readFileSync(path.join(ROOT, 'catalog', f), 'utf8').replace(/\r\n/g, '\n'))]);
}
function verifyBase() {
  const files = baseFiles();
  if (sha256(JSON.stringify(files)) !== BASE_DIGEST) throw Error('Base catalogue differs from pinned original 37 food chunks (ad92acf LF bytes)');
  return Object.fromEntries(files);
}
function extensionBaseFiles() {
  return Array.from({length:22},(_,i) => 'foods-'+(37+i)+'.json').sort()
    .map(f => [f,sha256(fs.readFileSync(path.join(ROOT,'catalog',f),'utf8').replace(/\r\n/g,'\n'))]);
}
function verifyRaw(root) {
  for (const source of SOURCES) for (const [file, expected] of source.files) {
    if (sha256(fs.readFileSync(path.join(root, file))) !== expected) throw Error('Raw SHA-256 mismatch: ' + file);
  }
}
function uniqueMap(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const id = String(key(row));
    if (result.has(id)) throw Error('Duplicate raw record ' + id);
    result.set(id, row);
  }
  return result;
}

function readBls(root) {
  const data = readXlsx(path.join(root, SOURCES[0].files[0][0]));
  const components = readXlsx(path.join(root, SOURCES[0].files[1][0]));
  const columns = new Map();
  data[0].forEach((header, index) => { if (index >= 3 && (index - 3) % 3 === 0) columns.set(header.split(' ')[0], index); });
  const formulas = new Map();
  for (const row of components.slice(1)) if (/immer berechnet|teilweise berechnet/.test(row[8] || '')) {
    formulas.set(row[1], formulaDependencies(row[7], row[1], columns));
  }
  const records = uniqueMap(data.slice(1), row => row[0]);
  const diagnostics = {negativeCells:0, suppressedFormulaZeros:0, previousSuppressedFormulaZeros:0,
    suppressedBeforeByOrigin:{}, suppressedAfterByOrigin:{},
    unparsedFormulas:[...formulas].filter(([,v]) => v === null).map(([k]) => k)};
  for (const row of records.values()) for (const index of columns.values()) if (typeof row[index] === 'number' && row[index] < 0) diagnostics.negativeCells++;
  return {
    records, diagnostics,
    get(id) {
      const row = records.get(id);
      if (!row) return null;
      const values = {};
      for (const [key, code] of Object.entries(BLS)) {
        const raw = row[columns.get(code)], value = blsValue(row, code, columns, formulas);
        if (numeric(raw) === 0) {
          const origin = row[columns.get(code) + 1] ?? '(missing)';
          diagnostics.suppressedBeforeByOrigin[origin] ??= 0;
          diagnostics.suppressedAfterByOrigin[origin] ??= 0;
          if (blsValue(row,code,columns,formulas,{previousRule:true}) === null) {
            diagnostics.previousSuppressedFormulaZeros++;
            diagnostics.suppressedBeforeByOrigin[origin]++;
          }
          if (value === null) {
            diagnostics.suppressedFormulaZeros++;
            diagnostics.suppressedAfterByOrigin[origin]++;
          }
        }
        values[key] = value === null ? null : value / (['b6','copper','manganese'].includes(key) ? 1000 : 1);
      }
      return {values, legacy:Object.fromEntries(Object.entries(LEGACY_BLS).map(([k,code]) => [k,numeric(row[columns.get(code)])])),
        macros:['ENERCC','PROT625','CHO','FAT'].map(code => numeric(row[columns.get(code)]))};
    }
  };
}

function readSr(root) {
  const foods = [...csvRows(fs.readFileSync(path.join(root, SOURCES[1].files[0][0]), 'utf8'))];
  const records = uniqueMap(foods.slice(1), row => row[0]);
  const nutrients = new Map();
  let negativeCells = 0;
  const lines = csvRows(fs.readFileSync(path.join(root, SOURCES[1].files[1][0]), 'utf8')); lines.next();
  for (const row of lines) {
    if (!records.has(row[1])) continue;
    if (!nutrients.has(row[1])) nutrients.set(row[1], new Map());
    const food = nutrients.get(row[1]), id = Number(row[2]);
    if (food.has(id)) throw Error('Duplicate SR nutrient ' + row[1] + '/' + id);
    food.set(id, row[3]);
    if (Number(row[3]) < 0) negativeCells++;
  }
  return {
    records, diagnostics:{negativeCells},
    get(id) {
      if (!records.has(id)) return null;
      // SR labels 1406/1408 are corrupt. Nutrient number 855 identifies 20:4 n-6.
      const food = nutrients.get(id) || new Map(), mapping = {...USDA, sugars:2000, arachidonic:1408};
      const oldValue = n => food.has(n) && numeric(food.get(n)) !== null ? roundSr(food.get(n)) : null;
      return {values:Object.fromEntries(Object.entries(mapping).map(([k,n]) => [k,numeric(food.get(n))])),
        legacy:Object.fromEntries(Object.entries(LEGACY_USDA).map(([k,n]) => [k,oldValue(n)])),
        macros:[1008,1003,1005,1004].map(oldValue)};
    }
  };
}

function readFoundation(root) {
  const foods = JSON.parse(fs.readFileSync(path.join(root, SOURCES[2].files[0][0]), 'utf8')).FoundationFoods;
  const records = uniqueMap(foods, row => row.fdcId), nutrients = new Map();
  const diagnostics = {negativeCells:0, duplicateIds:0, sugarDefinitionConflicts:0, cysteine1232Omitted:0,
    numberAudit:auditUsdaNumbers(root,foods)};
  for (const row of foods) {
    const mapped = new Map();
    for (const item of row.foodNutrients || []) {
      if (mapped.has(item.nutrient.id)) { diagnostics.duplicateIds++; throw Error('Duplicate Foundation nutrient ' + row.fdcId + '/' + item.nutrient.id); }
      mapped.set(item.nutrient.id, numeric(item.amount));
      if (typeof item.amount === 'number' && item.amount < 0) diagnostics.negativeCells++;
    }
    if (mapped.get(1063) !== null && mapped.get(2000) !== undefined && mapped.get(1063) !== mapped.get(2000)) diagnostics.sugarDefinitionConflicts++;
    if (mapped.get(1232) !== undefined && mapped.get(1232) !== null) diagnostics.cysteine1232Omitted++;
    nutrients.set(String(row.fdcId), mapped);
  }
  return {
    records, diagnostics,
    get(id) {
      if (!records.has(id)) return null;
      const food = nutrients.get(id), get = n => food.get(n) ?? null;
      const mapping = {...USDA, sugars:1063, arachidonic:1408};
      return {values:Object.fromEntries(Object.entries(mapping).map(([k,n]) => [k,get(n)])),
        legacy:Object.fromEntries(Object.entries(LEGACY_USDA).map(([k,n]) => [k,get(n)])),
        macros:[get(1008) ?? get(2048) ?? get(2047),get(1003),get(1005),get(1004)]};
    }
  };
}

function auditUsdaNumbers(root, foods) {
  function dictionary(file) {
    const rows = [...csvRows(fs.readFileSync(path.join(root,file),'utf8'))];
    const header = rows.shift(), numberIndex = header.indexOf('nutrient_nbr'), unitIndex = header.indexOf('unit_name');
    if (numberIndex < 0 || unitIndex < 0) throw Error('USDA nutrient dictionary header mismatch');
    return new Map(rows.map(row => [Number(row[0]),{number:String(Number(row[numberIndex])),unit:row[unitIndex].toUpperCase()}]));
  }
  const sr = dictionary(SOURCES[1].files[2][0]), foundation = dictionary(SOURCES[2].files[1][0]);
  const ids = [...new Set([...Object.values(USDA),...Object.values(LEGACY_USDA),1008,1003,1005,1004,1408,2000,1063])].sort((a,b)=>a-b);
  const numbers = {};
  let jsonChecked = 0;
  const json = new Map(foods.flatMap(food => (food.foodNutrients || []).map(item => [item.nutrient.id,item.nutrient])));
  for (const id of ids) {
    const previous = sr.get(id), current = foundation.get(id);
    if (!previous || !current || previous.number !== current.number || previous.unit !== current.unit) throw Error('USDA number/unit mismatch for ' + id);
    numbers[id] = current.number;
    if (json.has(id)) {
      if (String(Number(json.get(id).number)) !== current.number) throw Error('USDA JSON nutrient number mismatch for ' + id);
      jsonChecked++;
    }
  }
  if (numbers[1408] !== '855' || sr.get(1406)?.number !== '853' || foundation.get(1406)?.number !== '853') throw Error('Unexpected USDA fatty acid numbers');
  return {comparedIds:ids.length,jsonChecked,numbers};
}

function readCiqual(root) {
  const rows = readXlsx(path.join(root, SOURCES[3].files[0][0]));
  if (rows[0][6] !== 'alim_code' || !rows[0][10].includes('kcal') || !rows[0][14].includes('Jones') || !rows[0][60].includes('Sodium')) throw Error('Unexpected Ciqual header');
  const records = uniqueMap(rows.slice(1), row => row[6]);
  let negativeCells = 0;
  for (const row of records.values()) for (const value of row.slice(9,83)) if (typeof value === 'string' && /^-\s*\d/.test(value)) negativeCells++;
  return {records, diagnostics:{negativeCells}, get(id) {
    const row = records.get(id);
    if (!row) return null;
    return {values:ciqualValues(row), legacy:Object.fromEntries(Object.entries(LEGACY_CIQUAL).map(([k,index]) => [k,numeric(row[index])])),
      macros:[10,14,16,17].map(index => numeric(row[index]))};
  }};
}

function compareLegacy(row, raw, report) {
  const expected = {kcal:row[3], p:row[4], c:row[5], f:row[6], ...row[8]};
  const actual = {kcal:raw.macros[0], p:raw.macros[1], c:raw.macros[2], f:raw.macros[3], ...raw.legacy};
  for (const [key, value] of Object.entries(actual)) {
    const existing = expected[key] ?? null;
    report.comparisons++;
    if (existing !== null) report.presentComparisons++;
    if (existing === value) continue;
    const issue = {catalogKey:row[7] + ':' + row[0], key, catalog:existing, raw:value};
    if (row[7] === 'USDA Foundation 2026' && row[0] === '2747669' && key === 'b12' && existing === 1.57 && value === 1.63) report.expectedDifferences.push(issue);
    else report.unexpectedDifferences.push(issue);
  }
}

function plausibility(values) {
  const issues = [];
  if (['satfat','mufat','pufat'].every(k => values[k] !== undefined && values[k] !== null)) {
    const sum = values.satfat + values.mufat + values.pufat;
    if (sum > values.f * 1.1 + 0.5) issues.push('fatFractions');
  }
  if (values.sugars !== undefined && values.sugars !== null && values.sugars > values.c * 1.1 + 0.5) issues.push('sugars');
  return issues;
}

function main(rawRoot = path.join(ROOT, 'catalog-raw')) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw Error('Node 24+ required');
  const baseline = verifyBase(), extension = extensionBaseFiles();
  if (sha256(JSON.stringify(extension)) !== EXTENSION_DIGEST) throw Error('Extension catalogue differs from pinned corrected v96 LF bytes');
  const rawPath = path.resolve(rawRoot); verifyRaw(rawPath);
  const keys = sidecarKeys();
  const readers = [readBls(rawPath),readSr(rawPath),readFoundation(rawPath),readCiqual(rawPath),readCnf(rawPath),readCofid(rawPath),readFndds(rawPath)];
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog/manifest.json'), 'utf8'));
  const rows = manifest.files.flatMap(file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')));
  const shards = Array.from({length:64}, () => ({schemaVersion:1,keys,rows:{}}));
  const sourceReports = SOURCES.map(source => ({name:source.name, edition:source.edition,
    rawFiles:source.files.map(([file,sha256]) => ({file,sha256})), matched:0, imported:0,
    coverage:Object.fromEntries(keys.map(key => [key,0])),
    selfCheck:{comparisons:0,presentComparisons:0,expectedDifferences:[],unexpectedDifferences:[]}}));
  const warnings = [];
  for (const row of [...rows].sort((a,b) => (a[7] + ':' + a[0]) < (b[7] + ':' + b[0]) ? -1 : 1)) {
    const index = SOURCES.findIndex(source => source.name === row[7]);
    if (index < 0) continue;
    const report = sourceReports[index], raw = readers[index].get(String(row[0]),row[1]);
    if (!raw) throw Error('Raw record missing: ' + row[7] + ':' + row[0]);
    report.matched++; compareLegacy(row,raw,report.selfCheck);
    if (row[9] === 'ml') { report.diagnostics = readers[index].diagnostics; report.diagnostics.mlRowsExcluded++; continue; }
    const values = Object.fromEntries(keys.map(key => [key,null]));
    keys.slice(0,4).forEach((key,i) => { values[key] = row[i + 3]; });
    for (const [key,value] of Object.entries(raw.values)) if (keys.includes(key)) values[key] = value;
    if (!keys.slice(4).some(key => values[key] !== null)) continue;
    const fields = keys.map((key,i) => values[key] === null ? '' : i < 4 ? String(values[key]) : formatNumber(values[key]));
    const catalogKey = row[7] + ':' + row[0];
    shards[shardFor(catalogKey)].rows[catalogKey] = fields.join(';');
    report.imported++;
    keys.forEach((key,i) => { if (fields[i] !== '') report.coverage[key]++; });
    const rounded = Object.fromEntries(keys.map((key,i) => [key,fields[i] === '' ? null : Number(fields[i])]));
    for (const rule of plausibility(rounded)) warnings.push({catalogKey,rule});
  }
  sourceReports.forEach((report,i) => {
    report.diagnostics = readers[i].diagnostics;
    if (report.matched !== SOURCES[i].count || report.selfCheck.unexpectedDifferences.length) {
      console.error(JSON.stringify(report.selfCheck,null,2)); throw Error('Source self-check failed: ' + report.name);
    }
  });
  verifyBase();
  // v1 remains deployable for still-open v95 pages. Old source rows in v2 must
  // be byte-for-byte equal strings; never silently regenerate changed history.
  for(let i=0;i<64;i++) {
    const previous = JSON.parse(fs.readFileSync(path.join(ROOT,'catalog/nutrients-v1-'+String(i).padStart(2,'0')+'.json'),'utf8'));
    for(const [key,text] of Object.entries(previous.rows)) if(shards[i].rows[key] !== text)throw Error('v1 row changed: '+key);
    for(const key of Object.keys(shards[i].rows)) if(SOURCES.slice(0,4).some(s=>key.startsWith(s.name+':')) && previous.rows[key] !== shards[i].rows[key])throw Error('Old source row added: '+key);
  }
  const files = shards.map((shard,i) => {
    const file = 'catalog/nutrients-v2-' + String(i).padStart(2,'0') + '.json', text = JSON.stringify(shard) + '\n';
    return {file, text, rows:Object.keys(shard.rows).length, sha256:sha256(text)};
  });
  const meta = {schemaVersion:1,keys,shardCount:64,hash:{algorithm:'FNV-1a-32',encoding:'UTF-8',offsetBasis:'811c9dc5',prime:'01000193',modulus:64},
    precision:{extendedSignificantDigits:5,baseMacros:'Exact catalogue values, including 838 values with more than five significant digits (BLS 6, CNF 830, CoFID 2)'},
    baseFiles:{...baseline,...Object.fromEntries(extension)},shards:files.map(({file,rows,sha256}) => ({file,rows,sha256})),sources:sourceReports,plausibilityWarnings:warnings};
  // All raw hashes, identity checks and legacy comparisons finish before writes.
  for (const file of files) fs.writeFileSync(path.join(ROOT,file.file),file.text);
  fs.writeFileSync(path.join(ROOT,'catalog/nutrients-v2.json'),JSON.stringify(meta,null,2) + '\n');
  verifyBase();
  console.log(JSON.stringify({sources:sourceReports,plausibilityWarnings:warnings.length,bytes:files.reduce((sum,file) => sum + Buffer.byteLength(file.text),0)},null,2));
  return meta;
}

if (require.main === module) {
  try { main(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {main, SOURCES, BASE_DIGEST, EXTENSION_DIGEST, sha256, baseFiles, extensionBaseFiles, verifyRaw, compareLegacy, plausibility};
