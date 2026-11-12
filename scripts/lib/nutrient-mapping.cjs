'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {numeric} = require('./nutrient-readers.cjs');

const BLS = {
  fiber:'FIBT', vitc:'VITC', calcium:'CA', iron:'FE', b12:'VITB12', potassium:'K', magnesium:'MG',
  sugars:'SUGAR', starch:'STARCH', polyols:'POLYL', glucose:'GLUS', fructose:'FRUS', galactose:'GALS',
  sucrose:'SUCS', lactose:'LACS', maltose:'MALS', fiber_sol:'FIBSOL', fiber_insol:'FIBINS',
  satfat:'FASAT', mufat:'FAMS', pufat:'FAPU', omega3:'FAPUN3', omega6:'FAPUN6',
  ala:'F18:3CN3', epa:'F20:5CN3', dha:'F22:6CN3', linoleic:'F18:2CN6', arachidonic:'F20:4CN6', cholesterol:'CHORL',
  histidine:'HIS', isoleucine:'ILE', leucine:'LEU', lysine:'LYS', methionine:'MET', phenylalanine:'PHE',
  threonine:'THR', tryptophan:'TRP', valine:'VAL', cysteine:'CYSTE', tyrosine:'TYR',
  vita_rae:'VITAA', retinol:'RETOL', beta_carotene:'CARTB', vitd:'VITD', vite:'VITE', vitk:'VITK',
  b1:'THIA', b2:'RIBF', niacin:'NIA', niacin_ne:'NIAEQ', b5:'PANTAC', b6:'VITB6', biotin:'BIOT',
  folate_dfe:'FOL', folic_acid:'FOLAC', sodium:'NA', chloride:'CLD', phosphorus:'P', zinc:'ZN',
  copper:'CU', manganese:'MN', iodine:'ID', fluoride:'FD', chromium:'CR', molybdenum:'MO', alcohol:'ALC'
};
const USDA = {
  fiber:1079, vitc:1162, calcium:1087, iron:1089, b12:1178, potassium:1092, magnesium:1090,
  starch:1009, glucose:1011, fructose:1012, galactose:1075, sucrose:1010, lactose:1013, maltose:1014,
  fiber_sol:1082, fiber_insol:1084, satfat:1258, mufat:1292, pufat:1293, transfat:1257,
  ala:1404, epa:1278, dha:1272, linoleic:1316, cholesterol:1253, histidine:1221, isoleucine:1212,
  leucine:1213, lysine:1214, methionine:1215, phenylalanine:1217, threonine:1211, tryptophan:1210,
  valine:1219, cysteine:1216, tyrosine:1218, vita_rae:1106, retinol:1105, beta_carotene:1107,
  vitd:1114, vite:1109, vitk:1185, b1:1165, b2:1166, niacin:1167, b5:1170, b6:1175,
  biotin:1176, folate_dfe:1190, folic_acid:1186, choline:1180, sodium:1093, phosphorus:1091,
  zinc:1095, copper:1098, manganese:1101, selenium:1103, iodine:1100, fluoride:1099,
  molybdenum:1102, alcohol:1018, caffeine:1057
};
const CIQUAL = {
  fiber:26, vitc:72, calcium:50, iron:53, b12:82, potassium:58, magnesium:55,
  sugars:18, starch:25, polyols:27, glucose:21, fructose:19, galactose:20, sucrose:24, lactose:22, maltose:23,
  satfat:31, mufat:32, pufat:33, ala:44, epa:46, dha:47, linoleic:43, arachidonic:45, cholesterol:48,
  retinol:63, beta_carotene:64, vitd:65, vite:68, b1:73, b2:74, niacin:75, b5:76, b6:77,
  folate_dfe:78, folic_acid:81, sodium:60, chloride:51, phosphorus:57, zinc:61,
  copper:52, manganese:56, selenium:59, iodine:54, alcohol:29
};
const LEGACY_BLS = {water:'WATER', fiber:'FIBT', vitc:'VITC', calcium:'CA', iron:'FE', b12:'VITB12', potassium:'K', magnesium:'MG', folate:'FOLFD'};
const LEGACY_USDA = {water:1051, fiber:1079, vitc:1162, calcium:1087, iron:1089, b12:1178, potassium:1092, magnesium:1090, folate:1177};
const LEGACY_CIQUAL = {water:13, fiber:26, vitc:72, calcium:50, iron:53, b12:82, potassium:58, magnesium:55, folate:79};
const LEGACY_KEYS = Object.keys(LEGACY_BLS);

function definitions() {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/nutrient-definitions.js'), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.PULS_NUTRIENT_DEFS));
}

function sidecarKeys() {
  return definitions().map(definition => definition.key).filter(key => !LEGACY_KEYS.includes(key));
}

// The legacy Python import rounded decimal CSV amounts to three significant
// digits, ties to even. Binary toPrecision cannot reproduce decimal midpoint ties.
function roundSr(value) {
  const text = String(value), [whole, fraction = ''] = text.split('.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw Error('Unexpected SR amount: ' + text);
  const digits = (whole + fraction).replace(/^0+/, '');
  if (digits.length <= 3) return Number(text);
  const kept = digits.slice(0, 3), rest = digits.slice(3);
  const up = rest[0] > '5' || rest[0] === '5' && (/[1-9]/.test(rest.slice(1)) || Number(kept.at(-1)) % 2 === 1);
  return Number(String(BigInt(kept) + BigInt(up ? 1 : 0)) + 'e' + (digits.length - 3 - fraction.length));
}

const trace = value => typeof value === 'string' && /^(?:<\s*(?:LOD|LOQ|LOD\s+or\s+<LOQ|\d+(?:[.,]\d+)?)|TR|traces)$/i.test(value.trim());

function formulaDependencies(formula, code, knownCodes) {
  if (typeof formula !== 'string' || !formula.trim()) return null;
  const alternatives = formula.replace(/\\[rn]/g, ' ').split(/\bOR\b/);
  const result = [];
  for (const alternative of alternatives) {
    const sides = alternative.split('=');
    if (sides.length !== 2 || !sides[0].trim().startsWith(code + '[')) return null;
    const names = sides[1].replace(/\[[^\]]*\]/g, '').match(/[A-Z][A-Z0-9:]*/g) || [];
    if (!names.length || names.some(name => !knownCodes.has(name) || name === code)) return null;
    result.push([...new Set(names)]);
  }
  return result;
}

function blsValue(row, code, columns, formulas, options = {}, stack = new Set()) {
  const index = columns.get(code);
  if (index === undefined) return null;
  const value = numeric(row[index]);
  if (value === null || value > 0) return value;
  const origin = row[index + 1];
  if (!options.previousRule) {
    if (origin === '-') return null;
    if (origin !== 'Formelberechnung') return value;
  }
  if (!formulas.has(code) || origin === 'Logische Null') return value;
  if (stack.has(code)) return null;
  const alternatives = formulas.get(code);
  if (!alternatives) return null;
  const visiting = new Set(stack); visiting.add(code);
  const complete = alternatives.some(dependencies => dependencies.every(dependency => {
    const cell = row[columns.get(dependency)];
    return trace(cell) || blsValue(row, dependency, columns, formulas, options, visiting) !== null;
  }));
  return complete ? 0 : null;
}

function ciqualValues(row) {
  const values = Object.fromEntries(Object.entries(CIQUAL).map(([key, index]) => [key, numeric(row[index])]));
  const retinol = numeric(row[63]), carotene = numeric(row[64]), k1 = numeric(row[70]), k2 = numeric(row[71]);
  values.vita_rae = retinol !== null && carotene !== null ? retinol + carotene / 12 : null;
  values.vitk = k1 === null ? null : k1 + (k2 === null ? 0 : k2);
  return values;
}

module.exports = {BLS, USDA, CIQUAL, LEGACY_BLS, LEGACY_USDA, LEGACY_CIQUAL, LEGACY_KEYS, definitions, sidecarKeys, roundSr, trace, formulaDependencies, blsValue, ciqualValues};
