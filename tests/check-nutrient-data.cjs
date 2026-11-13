'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const {numeric, formatNumber, shardFor, readXlsx, csvRows} = require('../scripts/lib/nutrient-readers.cjs');
const {definitions, sidecarKeys, LEGACY_KEYS, roundSr, formulaDependencies, blsValue, ciqualValues} = require('../scripts/lib/nutrient-mapping.cjs');
const {BASE_DIGEST, EXTENSION_DIGEST, SOURCES, sha256, baseFiles, extensionBaseFiles, verifyRaw, compareLegacy} = require('../scripts/import-nutrients.cjs');
const {CNF,FNDDS,COFID} = require('../scripts/lib/nutrient-new-mapping.cjs');
const {auditCnf,auditFndds,auditCofid} = require('../scripts/lib/nutrient-new-sources.cjs');
const expected = require('./fixtures/nutrient-import/expectations.json');
const json = file => JSON.parse(fs.readFileSync(file,'utf8'));
const defs = definitions(), keys = sidecarKeys(), meta = json('catalog/nutrients-v2.json');
assert.deepEqual(keys,defs.map(d=>d.key).filter(key=>!LEGACY_KEYS.includes(key)));
assert.equal(keys.length,67);
assert.equal(new Set(keys).size,keys.length);
assert.deepEqual(keys.slice(0,4),['kcal','p','c','f']);
for (const [index,def] of defs.entries()) {
  assert.equal(def.order,index); assert.equal(def.basis,'per100');
  assert(['g','mg','µg','ml','kcal'].includes(def.unit));
  assert(def.nameDe && def.nameEn && def.group);
  assert.deepEqual(def.reference,{status:'none'});
}
const context = {};vm.runInNewContext(fs.readFileSync('js/nutrient-definitions.js','utf8'),context);
assert.equal(context.PULS_NUTRIENT_DEFS.length,76);
assert(/nutrient-definitions\.js\?v=\d+/.test(fs.readFileSync('index.html','utf8')),'Registry is integrated with an asset version');
assert.equal(sha256(JSON.stringify(baseFiles())),BASE_DIGEST,'Original catalogue retains deployed LF bytes');
assert.equal(baseFiles().length,37);
assert.deepEqual({...Object.fromEntries(baseFiles()),...Object.fromEntries(extensionBaseFiles())},meta.baseFiles,'All 59 food chunks match the unchanged LF catalogue');
assert.equal(sha256(JSON.stringify(extensionBaseFiles())),EXTENSION_DIGEST);
const readBase = fs.readFileSync, normalizedBase = baseFiles();
try {
  for (const ending of ['\n','\r\n']) {
    fs.readFileSync = (file,encoding) => readBase(file,'utf8').replace(/\r\n/g,'\n').replace(/\n/g,ending);
    assert.deepEqual(baseFiles(),normalizedBase,'Base hashes are independent of checkout line endings');
    assert.equal(sha256(JSON.stringify(extensionBaseFiles())),EXTENSION_DIGEST,'Extension hashes are independent of checkout line endings');
  }
  fs.readFileSync = file => readBase(file,'utf8') + ' ';
  assert.notEqual(sha256(JSON.stringify(baseFiles())),BASE_DIGEST,'Content changes still fail the pinned digest');
} finally { fs.readFileSync = readBase; }
assert.equal(meta.schemaVersion,1);assert.equal(meta.shardCount,64);assert.deepEqual(meta.keys,keys);
assert.deepEqual(meta.hash,{algorithm:'FNV-1a-32',encoding:'UTF-8',offsetBasis:'811c9dc5',prime:'01000193',modulus:64});
assert.equal(meta.shards.length,64);
const base = json('catalog/manifest.json').files.flatMap(json);
const byKey = new Map(base.map(row => [row[7] + ':' + row[0],row])), seen = new Map();
const coverage = new Map(SOURCES.map(source => [source.name,Object.fromEntries(keys.map(k => [k,0]))]));
const warnings = [];
const unchangedCells = crypto.createHash('sha256');
let precisionExceptions = 0;
for (const [index,descriptor] of meta.shards.entries()) {
  assert.equal(descriptor.file,'catalog/nutrients-v2-' + String(index).padStart(2,'0') + '.json');
  const data = fs.readFileSync(descriptor.file,'utf8').replace(/\r\n/g,'\n'), shard = JSON.parse(data);
  assert.equal(sha256(data),descriptor.sha256);assert.equal(shard.schemaVersion,1);assert.deepEqual(shard.keys,keys);
  assert(shard.rows && !Array.isArray(shard.rows));
  assert.equal(Object.keys(shard.rows).length,descriptor.rows);
  assert.deepEqual(Object.keys(shard.rows),Object.keys(shard.rows).sort());
  const old = json('catalog/nutrients-v1-'+String(index).padStart(2,'0')+'.json');
  assert.deepEqual(Object.fromEntries(Object.entries(shard.rows).filter(([key])=>SOURCES.slice(0,4).some(s=>key.startsWith(s.name+':')))),old.rows,'All four old sources retain exactly the same row strings');
  for (const [catalogKey,text] of Object.entries(shard.rows)) {
    assert(!seen.has(catalogKey));assert(byKey.has(catalogKey));
    assert.equal(shardFor(catalogKey),index);
    // Independent BigInt reference, including UTF-8 multibyte source names.
    let hash = 2166136261n;for (const byte of Buffer.from(catalogKey)) hash = ((hash ^ BigInt(byte)) * 16777619n) & 0xffffffffn;
    assert.equal(Number(hash % 64n),index);
    assert.equal(typeof text,'string');const fields = text.split(';');assert.equal(fields.length,keys.length);
    const previousFields=[...fields];
    if(catalogKey.startsWith('CNF 2026:'))previousFields[keys.indexOf('niacin_ne')]='';
    unchangedCells.update(JSON.stringify([catalogKey,previousFields.join(';')])+'\n');
    const row = byKey.get(catalogKey), values = {};
    assert.notEqual(row[9],'ml','Never use g-sidecars for ml foods');
    for (const [i,field] of fields.entries()) {
      assert(field === '' || /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(field),'Decimal format ' + catalogKey + '/' + keys[i]);
      values[keys[i]] = field === '' ? null : Number(field);
      if (field !== '') {assert(Number.isFinite(Number(field)));coverage.get(row[7])[keys[i]]++;}
      if (i < 4) assert.equal(values[keys[i]],row[i+3],'Exact macro ' + catalogKey);
      else if (field !== '') assert(field.replace('.','').replace(/^0+/,'').replace(/0+$/,'').length <= 5,'Five significant digits');
      if (i < 4 && field.replace('.','').replace(/^0+/,'').replace(/0+$/,'').length > 5) precisionExceptions++;
    }
    assert(keys.slice(4).some(k => values[k] !== null),'At least one extended value');
    for(const key of LEGACY_KEYS)assert(!Object.hasOwn(values,key),'No legacy nutrient in sidecar');
    if(catalogKey.startsWith('USDA ')&&values.arachidonic!==null&&values.pufat!==null)assert(values.arachidonic<=values.pufat,'USDA arachidonic <= pufat '+catalogKey);
    // Independent plausibility calculation. Source exceptions are pinned below.
    if (['satfat','mufat','pufat'].every(k => values[k] !== null) && values.satfat + values.mufat + values.pufat > values.f * 1.1 + 0.5) warnings.push([catalogKey,'fatFractions']);
    if (values.sugars !== null && values.sugars > values.c * 1.1 + 0.5) warnings.push([catalogKey,'sugars']);
    seen.set(catalogKey,values);
  }
}
assert.equal(precisionExceptions,838,'Exact base macros: six BLS, 830 CNF, two CoFID values');
assert.equal(seen.size,28827);
assert.equal(unchangedCells.digest('hex'),'4d36cec5a483b80745fa901b6fa4743634a5db30ead38d7c2d920410c385df12','Only the CNF niacin_ne column may differ from the reviewed v2 rows');
assert.equal(meta.sources[4].coverage.niacin_ne,2389);
assert.equal(meta.sources[4].diagnostics.definitionChecks,65);
assert.equal(meta.sources[0].diagnostics.previousSuppressedFormulaZeros,2549);
assert.equal(meta.sources[0].diagnostics.suppressedFormulaZeros,2331);
assert.equal(meta.sources[0].diagnostics.suppressedBeforeByOrigin.Rezeptberechnung,208);
assert.equal(meta.sources[0].diagnostics.suppressedBeforeByOrigin.Reskalierung,6);
assert.equal(meta.sources[0].diagnostics.suppressedBeforeByOrigin['Übernommener Wert'],4);
for(const [origin,count]of Object.entries(meta.sources[0].diagnostics.suppressedAfterByOrigin))assert.equal(count,origin==='Formelberechnung'?2331:0);
assert.equal(meta.sources[2].diagnostics.numberAudit.comparedIds,71);
assert.equal(meta.sources[2].diagnostics.numberAudit.jsonChecked,66);
assert.equal(meta.sources[2].diagnostics.numberAudit.numbers[1408],'855');
assert.equal(meta.sources[1].coverage.arachidonic,165);
for (const row of base.filter(row => row[0].startsWith('PULS_'))) assert(!seen.has(row[7] + ':' + row[0]));
const newExceptions = [
  ...['1172','2789','2996','3169','3220','3422','3578','3596','3645','4078','4781','5767','5784','693','7190','775','7928','846'].map(id=>['CNF 2026:CNF_'+id,'fatFractions']),
  ...['151','2976','7740'].map(id=>['CNF 2026:CNF_'+id,'sugars']),
  ...['16-055','19-614'].map(id=>['CoFID 2021:COFID_'+id,'fatFractions']),
  ...['81100500','81101000'].map(id=>['USDA FNDDS 2021-2023:FNDDS_'+id,'sugars'])
];
assert.deepEqual(warnings.sort(),[...expected.plausibilityExceptions.map(x => [...x]),...newExceptions].sort());
assert.deepEqual(meta.plausibilityWarnings.map(x => [x.catalogKey,x.rule]).sort(),warnings);
for (const [i,source] of meta.sources.entries()) {
  assert.equal(source.name,SOURCES[i].name);assert.equal(source.matched,SOURCES[i].count);
  assert.deepEqual(source.rawFiles,SOURCES[i].files.map(([file,sha256]) => ({file,sha256})));
  assert.deepEqual(source.coverage,coverage.get(source.name));
  assert.equal(source.imported,[...seen.keys()].filter(k => k.startsWith(source.name + ':')).length);
  assert.deepEqual(source.selfCheck.unexpectedDifferences,[]);
  assert.equal(source.selfCheck.expectedDifferences.length,i === 2 ? 1 : 0);
}
assert.deepEqual(meta.sources.slice(4).map(s=>[s.imported,s.selfCheck.comparisons,s.selfCheck.presentComparisons]),[[2573,33449,32315],[2624,34268,31210],[5431,70603,70603]]);
assert.equal(meta.sources[5].diagnostics.mlRowsExcluded,12);
assert.deepEqual(meta.sources[5].selfCheck.expectedDifferences,[]);
// Every differing CoFID value must now fail, including the former exceptions.
const report={comparisons:0,presentComparisons:0,expectedDifferences:[],unexpectedDifferences:[]};
compareLegacy(['COFID_13-669','','',62,2.1,5.2,3.8,'CoFID 2021',{vitc:62}],{macros:[62,2.1,5.2,3.8],legacy:{vitc:3}},report);
assert.equal(report.unexpectedDifferences.length,1);
for(const source of ['CNF 2026','USDA FNDDS 2021-2023'])for(const [key,value]of seen)if(key.startsWith(source+':')) {
  if(source.startsWith('USDA'))for(const k of ['ala','linoleic','arachidonic'])assert.equal(value[k],null,'Undifferentiated fatty acids stay unknown');
}
for(const [k,v] of [['vita_rae',null],['folate_dfe',null],['folic_acid',null]])for(const [key,value]of seen)if(key.startsWith('CoFID 2021:'))assert.equal(value[k],v);
for (const sample of expected.samples) for (const [key,value] of Object.entries(sample.values)) assert.equal(seen.get(sample.catalogKey)?.[key],value,sample.catalogKey + '/' + key);
// Direct source samples read separately from CNF Nutrient_Amount, CoFID sheets
// 1.3/1.6/1.12 and FNDDS foodNutrients at development time; not generated at test time.
for(const [catalogKey,values]of [
  ['CNF 2026:CNF_2',{niacin_ne:2.5505,sugars:2.661,vita_rae:193.76,vite:2.0266,folic_acid:5.562,folate_dfe:30.449,linoleic:2.01,ala:0.4522,arachidonic:0.047}],
  ['CNF 2026:CNF_130',{niacin_ne:3.3777}],
  ['CNF 2026:CNF_693',{niacin_ne:6.0483}],
  ['CoFID 2021:COFID_13-145',{sugars:0.8,satfat:null,mufat:null,pufat:null,omega3:0.07,omega6:0.52,beta_carotene:0,vite:null,linoleic:0.57,ala:0.07,arachidonic:0,epa:0,dha:0}],
  ['USDA FNDDS 2021-2023:FNDDS_11111000',{sugars:4.81,vite:0.05,vitd:1.1,folic_acid:0,folate_dfe:0,epa:0.001,dha:0,linoleic:null,ala:null,arachidonic:null}]
])for(const [key,value]of Object.entries(values))assert.equal(seen.get(catalogKey)[key],value,catalogKey+'/'+key);
console.log('PASS: 64 v2 shards, 28,827 rows, old v1 row strings identical, 59 LF-verified base chunks, seven-source coverage, 12 ml exclusions, zero additional-source deviations and 49 pinned plausibility cases');

for (const missing of [undefined,null,'',' ','-','<LOD','<LOQ','<LOD or <LOQ','TR','Tr','traces','< 0,2','N','(0.11)',-1,'-0.2',Infinity,NaN]) assert.equal(numeric(missing),null);
const cnfDictionary = new Map(Object.values(CNF).map(([id,Nutrient_Unit,Nutrient_Name_EN,Tagname])=>[String(id),{Nutrient_Unit,Nutrient_Name_EN,Tagname}]));
auditCnf(cnfDictionary);
assert.deepEqual(CNF.niacin_ne,[409,'Niacin Equivalents','Total niacin equivalent','NIAEQ']);
for(const unit of ['Milligram','NE','Gram']){
  cnfDictionary.get('409').Nutrient_Unit=unit;
  assert.throws(()=>auditCnf(cnfDictionary),/definition\/unit/,'Code 409 requires its exact raw unit label');
}
cnfDictionary.get('409').Nutrient_Unit='Niacin Equivalents';
cnfDictionary.get('406').Nutrient_Unit='Niacin Equivalents';assert.throws(()=>auditCnf(cnfDictionary),/definition\/unit/,'No other code accepts the special unit');
cnfDictionary.get('406').Nutrient_Unit='Milligram';
cnfDictionary.get('328').Nutrient_Unit='International Unit';assert.throws(()=>auditCnf(cnfDictionary),/definition\/unit/);
const [id,number,unitName,name]=FNDDS.vitd;
auditFndds({id,number,unitName,name},FNDDS.vitd);
for(const patch of [{number:'324'},{unitName:'IU'},{name:'Vitamin D IU'},{id:1110}])assert.throws(()=>auditFndds({id,number,unitName,name,...patch},FNDDS.vitd),/definition\/number\/unit/);
for(const mapping of Object.values(COFID)) {
  const specs=Object.values(mapping),rows=[specs.map(s=>s[1]),specs.map(s=>s[0]),specs.map(s=>s[2])];
  assert.equal(auditCofid(rows,mapping).size,specs.length);rows[0][0]+=' wrong basis';assert.throws(()=>auditCofid(rows,mapping),/definition\/unit/);
}
assert.equal(numeric(0),0);assert.equal(numeric('0'),0);assert.equal(numeric('0,05'),0.05);
assert.equal(numeric('2.7E-2'),0.027);
for (const [raw,text] of [[0,'0'],[0.000000000123456,'0.00000000012346'],[1.4999999999999999e-2,'0.015'],[4934.36/1000,'4.9344'],[12345678,'12346000']]) assert.equal(formatNumber(raw),text);
assert.equal(roundSr('14.25'),14.2);assert.equal(roundSr('64.35'),64.4);assert.equal(roundSr('0.001555'),0.00156);
assert.deepEqual([...csvRows('id,name,amount\r\n1,"a, b\n\"\"quoted\"\"",0\r\n')],[['id','name','amount'],['1','a, b\n"quoted"','0']]);
const columns = new Map([['SUM',0],['A',3],['B',6],['C',9]]);
const formulas = new Map([['SUM',formulaDependencies('SUM[g]=A[g]+B[g]','SUM',columns)]]);
assert.equal(blsValue([0,'Formelberechnung',null,'-',null,null,0], 'SUM',columns,formulas),null);
assert.equal(blsValue([0,'Logische Null',null,'-',null,null,0], 'SUM',columns,formulas),0);
for(const origin of ['Rezeptberechnung','Reskalierung','Übernommener Wert','Analyse']){
  const row=[0,origin,null,'-',null,null,0];
  assert.equal(blsValue(row,'SUM',columns,formulas),0,'Non-formula provenance preserves zero');
  assert.equal(blsValue(row,'SUM',columns,formulas,{previousRule:true}),null,'Previous rule suppressed non-formula zero');
}
assert.equal(blsValue([0,'-',null,0,null,null,0],'SUM',columns,formulas),null);
assert.equal(blsValue([0,'Formelberechnung',null,'<LOD',null,null,'TR'], 'SUM',columns,formulas),0);
assert.equal(blsValue([1,'Formelberechnung',null,'-',null,null,0], 'SUM',columns,formulas),1);
formulas.set('A',formulaDependencies('A[g]=C[g]','A',columns));
assert.equal(blsValue([0,'Formelberechnung',null,0,'Formelberechnung',null,0,null,null,'-'],'SUM',columns,formulas),null,'Nested missing formula input');
formulas.set('SUM',formulaDependencies('SUM[g]=A[g]+B[g] OR\\r\\nSUM[g]=C[g]','SUM',columns));
assert.equal(blsValue([0,'Formelberechnung',null,'-',null,null,'-',null,null,0],'SUM',columns,formulas),0,'Complete alternative formula');
assert.equal(formulaDependencies('SUM[g]=UNKNOWN[g]','SUM',columns),null);
formulas.set('SUM',null);assert.equal(blsValue([0,'Formelberechnung'],'SUM',columns,formulas),null);
const ci = [];ci[63]='12';ci[64]='24';ci[70]='1';ci[71]='-';
assert.equal(ciqualValues(ci).vita_rae,14);assert.equal(ciqualValues(ci).vitk,1);
ci[71]='2';assert.equal(ciqualValues(ci).vitk,3);ci[63]='< 0,1';assert.equal(ciqualValues(ci).vita_rae,null);
const read = fs.readFileSync;
try {
  fs.readFileSync = () => Buffer.from('changed raw input');
  assert.throws(() => verifyRaw('synthetic-unreadable-raw-root'),/Raw SHA-256 mismatch/);
} finally { fs.readFileSync = read; }
console.log('PASS: missing/zero/negative/trace values, exact legacy decimal rounding, R3 nested/alternative/logical zeros, Ciqual derivation and raw hash refusal (in memory)');

// Small valid XLSX ZIP assembled entirely in memory. Exercises both ZIP methods,
// shared/inline strings, rich text, numeric cells, absent cells and empty values.
function workbookZip(entries) {
  const locals = [], directories = [];let offset = 0;
  for (const [name,text,method] of entries) {
    const filename = Buffer.from(name), raw = Buffer.from(text), packed = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);
    local.writeUInt32LE(zlib.crc32(raw),14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(filename.length,26);
    const directory = Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);
    directory.writeUInt16LE(method,10);directory.writeUInt32LE(zlib.crc32(raw),16);directory.writeUInt32LE(packed.length,20);
    directory.writeUInt32LE(raw.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    locals.push(local,filename,packed);directories.push(directory,filename);offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(directories), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
const workbook = workbookZip([
  ['xl/workbook.xml','<workbook><sheets><sheet name="First" r:id="rId1"/><sheet name="Named &amp; sheet" r:id="rId2"/></sheets></workbook>',8],
  ['xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet77.xml"/></Relationships>',8],
  ['xl/worksheets/sheet77.xml','<worksheet><sheetData><row r="1"><c r="A1"><v>7</v></c></row></sheetData></worksheet>',8],
  ['xl/sharedStrings.xml','<sst><si><t>A &amp; B</t></si><si><r><t>rich</t></r><r><t> text</t></r></si></sst>',8],
  ['xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0</v></c><c r="C1"><v></v></c><c r="E1" t="inlineStr"><is><t>&lt;LOD</t></is></c><c r="F1" t="s"><v>1</v></c><c r="G1"/><c r="H1"><v>2.7E-2</v></c></row></sheetData></worksheet>',0]
]);
try {
  fs.readFileSync = () => workbook;
  const row = readXlsx('synthetic-in-memory.xlsx')[0];
  assert.equal(row[0],'A & B');assert.equal(row[1],0);assert.equal(row[2],null);assert.equal(row[3],undefined);
  assert.equal(row[4],'<LOD');assert.equal(row[5],'rich text');assert.equal(row[6],null);assert.equal(row[7],0.027);
  assert.equal(readXlsx('synthetic-in-memory.xlsx','Named & sheet')[0][0],7,'Named worksheets follow workbook relationships');
  assert.throws(()=>readXlsx('synthetic-in-memory.xlsx','missing'),/worksheet missing/);
} finally { fs.readFileSync = read; }
console.log('PASS: package-free XLSX parser with compressed/stored entries, sparse/shared/inline cells, entities, blank cells and real zeros');
