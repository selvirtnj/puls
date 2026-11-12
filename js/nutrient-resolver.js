/* Extended values stay outside the v94 nutrient whitelist. Reads never save. */
(function () {
'use strict';
const defs = PULS_NUTRIENT_DEFS;
const keys = defs.map(d => d.key);
const macros = ['kcal','p','c','f'];
const legacy = ['water','fiber','vitc','calcium','iron','b12','potassium','magnesium','folate'];
const catalogKeys = keys.filter(key => !legacy.includes(key));
const extra = new Set(keys.filter(k => !macros.includes(k) && !legacy.includes(k)));
const shards = new Map(), loading = new Map(), failed = new Set();
const plain = x => {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  const prototype = Object.getPrototypeOf(x);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};
const finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1e9;
const validKey = key => typeof key === 'string' && key.length >= 3 && key.length <= 140 && !/[\u0000-\u001f\u007f-\u009f]/.test(key) && key.indexOf(':') > 0 && key.indexOf(':') < key.length - 1;
const knownKey = key => validKey(key) && /^(?:BLS 4\.0|USDA SR Legacy 2018|USDA Foundation 2026|Ciqual 2025):[A-Za-z0-9_-]{1,60}$/.test(key);
const excluded = x => !!(x?.recipeId || x?.aiEstimate || /^KI-Schätzung/.test(x?.source || ''));
const baseUnit = x => x?.unit === undefined ? 'g' : x.unit;
const products = () => typeof state === 'object' && Array.isArray(state.custom) ? state.custom : [];
function labelValues(product) { return plain(product?.nx) ? {...product.nx} : {}; }
function validLabelValues(values) {
  return plain(values) && Object.keys(values).length <= 40 && Object.entries(values).every(([key,value]) => /^[a-z][a-z0-9_]{0,31}$/.test(key) && finite(value));
}
function setLabelValues(product, values) {
  if (!plain(product) || !validLabelValues(values)) throw TypeError('Invalid label nutrients');
  if (Object.keys(values).length) product.nx = Object.fromEntries(Object.entries(values).map(([key,value]) => [key,Number(value.toPrecision(5))])); else delete product.nx;
  return product;
}
function validFields(item) {
  return plain(item) && (item.ck === undefined || validKey(item.ck)) && (item.nx === undefined || validLabelValues(item.nx));
}
function copyFields(source, target) {
  if (source.ck !== undefined) target.ck = source.ck;
  if (source.nx !== undefined) target.nx = {...source.nx};
  return target;
}
function catalogKey(product) {
  const key = product?.catalogKey || (product?.record !== undefined && typeof product.source === 'string' ? product.source + ':' + product.record : null);
  return validKey(key) ? key : null;
}
function linkedProduct(entry) { return products().find(p => p.id === entry?.foodRef); }
function entryKey(entry) {
  if (!entry || excluded(entry) || baseUnit(entry) !== 'g') return null;
  return validKey(entry.ck) ? entry.ck : catalogKey(linkedProduct(entry));
}
function shardFor(key) {
  let hash = 0x811c9dc5;
  const bytes = unescape(encodeURIComponent(key));
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes.charCodeAt(i), 0x01000193) >>> 0;
  return hash % 64;
}
function rowFor(key) { return knownKey(key) ? shards.get(shardFor(key))?.get(key) : undefined; }
function decodeShard(data) {
  if (!plain(data) || data.schemaVersion !== 1 || !Array.isArray(data.keys) || data.keys.length !== catalogKeys.length || !catalogKeys.every((key,i) => data.keys[i] === key) || !plain(data.rows)) throw Error('Invalid nutrient shard');
  const result = new Map();
  for (const [key,text] of Object.entries(data.rows)) {
    if (!knownKey(key) || typeof text !== 'string') throw Error('Invalid nutrient record');
    const fields = text.split(';');
    if (fields.length !== catalogKeys.length) throw Error('Invalid nutrient columns');
    const row = {};
    fields.forEach((field,i) => {
      if (field === '') return;
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(field) || !finite(Number(field))) throw Error('Invalid nutrient amount');
      row[catalogKeys[i]] = Number(field);
    });
    if (!macros.every(k => finite(row[k]))) throw Error('Missing base macros');
    result.set(key,row);
  }
  return result;
}
async function loadShard(index) {
  if (shards.has(index)) return true;
  if (loading.has(index)) return loading.get(index);
  const work = Promise.resolve().then(async () => {
    try {
      const response = await fetch('catalog/nutrients-v1-' + String(index).padStart(2,'0') + '.json', {credentials:'omit'});
      if (!response.ok || response.redirected) throw Error('Unavailable nutrient shard');
      const decoded = decodeShard(await response.json());
      if ([...decoded.keys()].some(key => shardFor(key) !== index)) throw Error('Wrong nutrient shard');
      shards.set(index,decoded); failed.delete(index); return true;
    } catch { failed.add(index); return false; }
    finally { loading.delete(index); }
  });
  loading.set(index,work);
  return work;
}
async function ensure(catalogKeys) {
  const requested = [...new Set(Array.isArray(catalogKeys) ? catalogKeys : [])];
  const valid = requested.filter(knownKey);
  await Promise.all([...new Set(valid.map(shardFor))].map(loadShard));
  return {ready:requested.filter(key => knownKey(key) && rowFor(key)), unavailable:requested.filter(key => !knownKey(key) || !rowFor(key))};
}
function ensureForEntries(entries) { return ensure((Array.isArray(entries) ? entries : []).map(entryKey).filter(Boolean)); }

function consistent(item, row, amount, product = false) {
  if (!row || !Number.isFinite(amount) || amount <= 0 || baseUnit(item) !== 'g' || excluded(item)) return false;
  if (Object.keys(labelValues(item)).length) return false;
  const factor = amount / 100;
  // Capture rounds to 0.1. Proportional edits preserve density error, which
  // is at most 0.5 per100 when the initial amount was at least 10 g.
  if (!macros.every(k => {
    if (!Number.isFinite(item[k])) return false;
    const error = Math.abs(item[k] - row[k] * factor);
    const epsilon = 1e-9 + 1e-10 * Math.abs(item[k]);
    return product ? error <= epsilon : error <= 0.05 + epsilon || Math.abs(item[k] / factor - row[k]) <= 0.5 + 1e-9;
  })) return false;
  return true;
}
function originalRow(key) {
  return typeof localCatalogue !== 'undefined' ? localCatalogue.find(r => r.source + ':' + r.record === key) : null;
}
function capture(product, entry) {
  // Called after the existing addFood save. Optional metadata cannot break it.
  try {
    if (!product || !entry || excluded(product)) return entry;
    const labels = labelValues(product);
    if (validLabelValues(labels) && Object.keys(labels).length) entry.nx = {...labels};
    const key = catalogKey(product), original = originalRow(key);
    const reference = original || rowFor(key);
    if (key && consistent(product,reference,100,true)) entry.ck = key;
  } catch { /* Preserve the already captured entry if optional metadata fails. */ }
  return entry;
}
function initialValues(item, amount, isProduct) {
  const values = Object.fromEntries(keys.map(key => [key,null]));
  const origin = Object.fromEntries(keys.map(key => [key,'unknown']));
  const factor = isProduct ? amount / 100 : 1;
  for (const key of macros) if (finite(item?.[key])) { values[key] = item[key] * factor; origin[key] = 'snapshot'; }
  for (const key of legacy) if (finite(item?.nutrients?.[key])) { values[key] = item.nutrients[key] * factor; origin[key] = 'snapshot'; }
  if (!excluded(item) && Number.isFinite(amount) && amount > 0) for (const [key,value] of Object.entries(labelValues(item))) if (extra.has(key) && finite(value) && Number.isFinite(value * amount / 100)) {
    values[key] = value * amount / 100; origin[key] = 'snapshot';
  }
  return {values,origin,pending:false};
}
function resolveEntry(entry) {
  const amount = entry?.grams;
  const result = initialValues(entry,amount,false);
  const key = entryKey(entry);
  if (!knownKey(key)) return result;
  const row = rowFor(key), linked = validKey(entry.ck) ? null : linkedProduct(entry);
  if (linked && (catalogKey(linked) !== key || !consistent(linked,row,100,true))) {
    if (row || failed.has(shardFor(key))) return result;
  }
  if (!row) { result.pending = !shards.has(shardFor(key)) && !failed.has(shardFor(key)); return result; }
  if (linked && !consistent(linked,row,100,true) || !consistent(entry,row,amount)) return result;
  for (const key of catalogKeys) if (result.values[key] === null && finite(row[key]) && Number.isFinite(row[key] * amount / 100)) {
    result.values[key] = row[key] * amount / 100; result.origin[key] = 'catalog';
  }
  return result;
}
function resolveProduct(product, options = {}) {
  const amount = options.amount ?? 100, unit = options.unit ?? baseUnit(product);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const result = initialValues(product,validAmount ? amount : 0,true);
  if (!validAmount || unit !== baseUnit(product)) return {values:Object.fromEntries(keys.map(k => [k,null])),origin:Object.fromEntries(keys.map(k => [k,'unknown'])),pending:false};
  const key = catalogKey(product);
  if (!knownKey(key) || unit !== 'g' || excluded(product)) return result;
  const row = rowFor(key);
  if (!row) { result.pending = !shards.has(shardFor(key)) && !failed.has(shardFor(key)); return result; }
  if (!consistent(product,row,100,true)) return result;
  for (const key of catalogKeys) if (result.values[key] === null && finite(row[key]) && Number.isFinite(row[key] * amount / 100)) {
    result.values[key] = row[key] * amount / 100; result.origin[key] = 'catalog';
  }
  return result;
}
function totals(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const nutrients = Object.fromEntries(keys.map(k => [k,{value:null,known:0,total:list.length,snapshot:0,catalog:0}]));
  let pending = false;
  for (const entry of list) {
    const resolved = resolveEntry(entry); pending ||= resolved.pending;
    for (const key of keys) if (resolved.values[key] !== null) {
      const total = nutrients[key]; total.value = (total.value ?? 0) + resolved.values[key]; total.known++;
      total[resolved.origin[key]]++;
    }
  }
  return {nutrients,pending};
}
const baseValid = validData;
validData = function (source) {
  return plain(source) && ['foods','custom'].every(key => Array.isArray(source[key]) && source[key].every(validFields)) &&
    (source.meals === undefined || Array.isArray(source.meals) && source.meals.every(meal => Array.isArray(meal?.items) && meal.items.every(validFields))) && baseValid(source);
};
window.pulsNutrients = Object.freeze({definitions:() => defs, ensure, ensureForEntries, resolveEntry, resolveProduct, totals,
  labelValues, setLabelValues, validLabelValues, validFields, copyFields, capture, keyFor:catalogKey});
})();
