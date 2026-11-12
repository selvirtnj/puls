'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {numeric, formatNumber, shardFor, readXlsx, csvRows} = require('../scripts/lib/nutrient-readers.cjs');
const {definitions, sidecarKeys, LEGACY_KEYS, roundSr, formulaDependencies, blsValue, ciqualValues} = require('../scripts/lib/nutrient-mapping.cjs');
const {BASE_DIGEST, SOURCES, sha256, baseFiles, verifyRaw} = require('../scripts/import-nutrients.cjs');
const expected = require('./fixtures/nutrient-import/expectations.json');
const json = file => JSON.parse(fs.readFileSync(file,'utf8'));
const defs = definitions(), keys = sidecarKeys(), meta = json('catalog/nutrients-v1.json');
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
assert.deepEqual(meta.baseFiles,Object.fromEntries(baseFiles()));
const readBase = fs.readFileSync, normalizedBase = baseFiles();
try {
  for (const ending of ['\n','\r\n']) {
    fs.readFileSync = (file,encoding) => readBase(file,'utf8').replace(/\r\n/g,'\n').replace(/\n/g,ending);
    assert.deepEqual(baseFiles(),normalizedBase,'Base hashes are independent of checkout line endings');
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
let precisionExceptions = 0;
for (const [index,descriptor] of meta.shards.entries()) {
  assert.equal(descriptor.file,'catalog/nutrients-v1-' + String(index).padStart(2,'0') + '.json');
  const data = fs.readFileSync(descriptor.file), shard = JSON.parse(data);
  assert.equal(sha256(data),descriptor.sha256);assert.equal(shard.schemaVersion,1);assert.deepEqual(shard.keys,keys);
  assert(shard.rows && !Array.isArray(shard.rows));
  assert.equal(Object.keys(shard.rows).length,descriptor.rows);
  assert.deepEqual(Object.keys(shard.rows),Object.keys(shard.rows).sort());
  for (const [catalogKey,text] of Object.entries(shard.rows)) {
    assert(!seen.has(catalogKey));assert(byKey.has(catalogKey));
    assert.equal(shardFor(catalogKey),index);
    // Independent BigInt reference, including UTF-8 multibyte source names.
    let hash = 2166136261n;for (const byte of Buffer.from(catalogKey)) hash = ((hash ^ BigInt(byte)) * 16777619n) & 0xffffffffn;
    assert.equal(Number(hash % 64n),index);
    assert.equal(typeof text,'string');const fields = text.split(';');assert.equal(fields.length,keys.length);
    const row = byKey.get(catalogKey), values = {};
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
assert.equal(precisionExceptions,6);
assert.equal(seen.size,18199);
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
assert.deepEqual(warnings.sort(),expected.plausibilityExceptions.map(x => [...x]).sort());
assert.deepEqual(meta.plausibilityWarnings.map(x => [x.catalogKey,x.rule]).sort(),warnings);
for (const [i,source] of meta.sources.entries()) {
  assert.equal(source.name,SOURCES[i].name);assert.equal(source.matched,SOURCES[i].count);
  assert.deepEqual(source.rawFiles,SOURCES[i].files.map(([file,sha256]) => ({file,sha256})));
  assert.deepEqual(source.coverage,coverage.get(source.name));
  assert.equal(source.imported,[...seen.keys()].filter(k => k.startsWith(source.name + ':')).length);
  assert.deepEqual(source.selfCheck.unexpectedDifferences,[]);
  assert.equal(source.selfCheck.expectedDifferences.length,i === 2 ? 1 : 0);
}
for (const sample of expected.samples) for (const [key,value] of Object.entries(sample.values)) assert.equal(seen.get(sample.catalogKey)?.[key],value,sample.catalogKey + '/' + key);
console.log('PASS: 64 nutrient shards, 67 keys without legacy nutrients, exact IDs/macros/base bytes, checksums, coverage, 18 source samples including independent references, arachidonic bound and 24 plausibility exceptions');

for (const missing of [undefined,null,'',' ','-','<LOD','<LOQ','<LOD or <LOQ','TR','traces','< 0,2','N',-1,'-0.2',Infinity,NaN]) assert.equal(numeric(missing),null);
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
  ['xl/sharedStrings.xml','<sst><si><t>A &amp; B</t></si><si><r><t>rich</t></r><r><t> text</t></r></si></sst>',8],
  ['xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0</v></c><c r="C1"><v></v></c><c r="E1" t="inlineStr"><is><t>&lt;LOD</t></is></c><c r="F1" t="s"><v>1</v></c><c r="G1"/><c r="H1"><v>2.7E-2</v></c></row></sheetData></worksheet>',0]
]);
try {
  fs.readFileSync = () => workbook;
  const row = readXlsx('synthetic-in-memory.xlsx')[0];
  assert.equal(row[0],'A & B');assert.equal(row[1],0);assert.equal(row[2],null);assert.equal(row[3],undefined);
  assert.equal(row[4],'<LOD');assert.equal(row[5],'rich text');assert.equal(row[6],null);assert.equal(row[7],0.027);
} finally { fs.readFileSync = read; }
console.log('PASS: package-free XLSX parser with compressed/stored entries, sparse/shared/inline cells, entities, blank cells and real zeros');
