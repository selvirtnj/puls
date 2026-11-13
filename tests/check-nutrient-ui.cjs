// Anzeige der erweiterten Nährwerte: DGE-Referenzen, Einbindung, Etikett-Reihenfolge, keine neuen Speicherfelder.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const read = file => fs.readFileSync(file, 'utf8');

// Referenzwerte: nur DGE-Tabelle, Alter ab 19, Geschlecht nötig, wenn m und w abweichen.
const ctx = {}; vm.runInNewContext(read('js/nutrient-references.js'), ctx);
const refs = ctx.PULS_NUTRIENT_REFS, ref = (k, p) => refs.reference(k, p);
assert.strictEqual(ref('vita_rae', {age: 30, sex: 'male'}), 850);
assert.strictEqual(ref('vita_rae', {age: 70, sex: 'male'}), 800);
assert.strictEqual(ref('vita_rae', {age: 70, sex: 'female'}), 700);
assert.strictEqual(ref('niacin_ne', {age: 22, sex: 'male'}), 16);
assert.strictEqual(ref('niacin_ne', {age: 55, sex: 'female'}), 11);
assert.strictEqual(ref('b1', {age: 25, sex: 'male'}), 1.2);
assert.strictEqual(ref('vitk', {age: 51, sex: 'female'}), 65);
assert.strictEqual(ref('fluoride', {age: 40, sex: 'female'}), 3000);
assert.strictEqual(ref('vite', {age: 40}), 8, 'Gleicher Wert für beide Geschlechter braucht keine Geschlechtsangabe');
assert.strictEqual(ref('selenium', {age: 40}), null, 'Abweichende Werte ohne Geschlecht: kein Referenzwert');
assert.strictEqual(ref('b6', {age: 18, sex: 'male'}), null, 'Nur Erwachsene ab 19');
assert.strictEqual(ref('b6', {sex: 'male'}), null, 'Ohne Alter kein Referenzwert');
assert.strictEqual(ref('b6', null), null);
for (const key of ['sugars', 'satfat', 'sodium', 'salt', 'vitd', 'zinc', 'copper', 'manganese', 'chromium', 'molybdenum', 'niacin', 'folate', 'vitc', 'fiber', 'iron', 'calcium', 'b12', 'potassium', 'magnesium'])
  assert.strictEqual(ref(key, {age: 30, sex: 'male'}), null, 'Kein neuer Referenzwert für ' + key);
const src = read('js/nutrient-references.js');
for (const key of refs.keys()) {
  const line = src.split('\n').findIndex(l => new RegExp('^\\s+' + key + ':').test(l));
  assert(line > 0 && /https:\/\/www\.dge\.de\/wissenschaft\/referenzwerte\/[a-z0-9-]+\/ \(abgerufen 12\.11\.2026\)/.test(src.split('\n')[line - 1]), 'Quelle und Abrufdatum für ' + key);
}
const defs = (() => { const c = {}; vm.runInNewContext(read('js/nutrient-definitions.js'), c); return c.PULS_NUTRIENT_DEFS; })();
for (const key of refs.keys()) assert(defs.some(d => d.key === key), 'Registrierter Schlüssel ' + key);

// Einbindung und Offline-Liste.
const html = read('index.html');
assert(html.indexOf('js/nutrient-definitions.js') < html.indexOf('js/nutrient-references.js?v='));
assert(html.indexOf('js/nutrient-references.js') < html.indexOf('js/food-diary.js'));
assert(read('sw.js').includes('"js/nutrient-references.js"'));

// Formulare: Etikett-Reihenfolge, gleiche IDs wie readLabelFields.
const flow = read('js/food-flow.js');
const grid = flow.slice(flow.indexOf('function ffLabelGrid'), flow.indexOf('function ffSegment'));
const order = ["main('kcal'", "main('f'", "optional('satfat'", "main('c'", "optional('sugars'", "optional('fiber'", "main('p'", "optional('salt'"].map(x => grid.indexOf(x));
assert(order.every(i => i > 0) && order.every((i, k) => k === 0 || i > order[k - 1]), 'Etikett-Reihenfolge');
for (const prefix of ['off-', 'custom-', 'label-']) assert(flow.includes("ffLabelGrid('" + prefix + "'"), 'Formular ' + prefix);
assert(!/labelFields\(/.test(flow), 'Keine doppelten Zusatzfelder');

// Anzeige speichert nichts: keine Schreibzugriffe in den neuen Anzeigefunktionen.
const diary = read('js/food-diary.js'), page = read('js/food-page.js');
const all = diary.slice(diary.indexOf('/* ---------- Alle Nährstoffe'), diary.indexOf('function fdWeekStats')) + page.slice(page.indexOf('function fpAllKey'), page.indexOf('/* ---------- Produkt prüfen'));
assert(all.length > 500 && !/save\(|state\.[a-zA-Z]+\s*=|microGoals\s*=|highlighted\s*=|\.nx\s*=/.test(all), 'Anzeige ohne Speichern');

// Formatierung: unbekannt nie 0, kleine Werte lesbar.
const fmt = {n: x => String(x)}; vm.runInNewContext(diary.match(/function fdNutrientAmount[\s\S]*?\n}/)[0], fmt);
assert.strictEqual(fmt.fdNutrientAmount(null), '–');
assert.strictEqual(fmt.fdNutrientAmount(0), '0');
assert.strictEqual(fmt.fdNutrientAmount(0.0004), '< 0.001');
assert.strictEqual(fmt.fdNutrientAmount(0.123), '0.12');
assert.strictEqual(fmt.fdNutrientAmount(12.34), '12.3');
assert.strictEqual(fmt.fdNutrientAmount(1234.5), '1235');
// Ablauf: erster Ladeversuch scheitert (offline), erneutes Öffnen lädt erneut und zeigt die Werte.
// Echte Resolver-, Tagebuch- und Detailfunktionen in einer VM; DOM, Modal und Netz sind Attrappen.
(async () => {
  // Spaltenliste wie in den ausgelieferten Dateien (ohne Altschlüssel, falls der Import sie ausnimmt).
  const key = 'BLS 4.0:FIXTURE', keys = JSON.parse(read('catalog/nutrients-v2-00.json')).keys;
  const per100 = {kcal: 100, p: 10, c: 12.4, f: 1, sugars: 2, sodium: 400, b1: 0.6};
  const shardOf = k => { let h = 0x811c9dc5; for (const b of Buffer.from(k, 'utf8')) h = Math.imul(h ^ b, 0x01000193) >>> 0; return h % 64; };
  let online = false; const requests = [];
  const el = () => ({innerHTML: '', dataset: {}, hidden: false, isConnected: true, insertAdjacentHTML(_, h) { this.innerHTML += h; }});
  const dom = {};
  const ctx = {
    window: {}, Math, Map, Set, Promise, unescape, encodeURIComponent, Number, String, Object, Array, Intl,
    state: {custom: [], foods: [], profile: {age: 30, sex: 'male'}}, date: '2026-11-12', validData: () => true,
    fetch: async url => {
      requests.push(url);
      if (!online) throw new Error('offline');
      const index = Number(/-(\d+)\.json$/.exec(url)[1]);
      const rows = index === shardOf(key) ? {[key]: keys.map(k => per100[k] ?? '').join(';')} : {};
      return {ok: true, redirected: false, json: async () => ({schemaVersion: 1, keys, rows})};
    },
    $: id => dom[id] || null, esc: x => String(x), n: x => String(x), appLocale: () => 'de-DE', phIcon: () => '',
    fdT: de => de, fdSound() {}, fdIsWater: () => false, fdMicroGoal: () => 0, nutrientLabels: {},
    fdDayFoods() { return ctx.state.foods.filter(x => x.date === ctx.date); },
    openModal(title, body) { dom['fd-all'] = el(); dom['fd-all'].dataset.open = /data-open="(\d+)"/.exec(body)[1]; },
    ffBase: x => x?.unit === 'ml' ? 'ml' : 'g'
  };
  vm.createContext(ctx);
  for (const file of ['nutrient-definitions', 'nutrient-references', 'nutrient-resolver']) vm.runInContext(read('js/' + file + '.js'), ctx);
  vm.runInContext(diary.slice(diary.indexOf('/* ---------- Alle Nährstoffe'), diary.indexOf('function fdWeekStats(')), ctx);
  vm.runInContext(page.slice(page.indexOf('function fpAllKey'), page.indexOf('/* ---------- Produkt prüfen')), ctx);
  const tick = () => new Promise(r => setTimeout(r, 0));
  const settle = async () => { for (let i = 0; i < 5; i++) await tick(); };

  // Tagesansicht
  ctx.state.foods.push({id: 'e1', date: '2026-11-12', name: 'Fixture', grams: 50, unit: 'g', ck: key, kcal: 50, p: 5, c: 6.2, f: 0.5});
  vm.runInContext('fdAllNutrients()', ctx); await settle();
  assert.strictEqual(requests.length, 1, 'Erster Versuch');
  assert(!/Zucker/.test(dom['fd-all'].innerHTML) && !/fdallwait/.test(dom['fd-all'].innerHTML), 'Offline: kein Katalogwert, kein endloser Platzhalter');
  online = true;
  vm.runInContext('fdAllNutrients()', ctx); await settle();
  assert.strictEqual(requests.length, 2, 'Erneutes Öffnen lädt erneut');
  assert(/Zucker/.test(dom['fd-all'].innerHTML) && /Salz/.test(dom['fd-all'].innerHTML), 'Werte nach erneutem Öffnen sichtbar');
  vm.runInContext('fdAllNutrients()', ctx); await settle();
  assert.strictEqual(requests.length, 2, 'Geladene Datei wird nicht erneut geholt');

  // Veraltete Antwort: Tageswechsel vor Abschluss zeichnet nicht neu.
  vm.runInContext('fdAllNutrients()', ctx); dom['fd-all'].innerHTML = 'alt'; ctx.date = '2026-11-13'; await settle();
  assert.strictEqual(dom['fd-all'].innerHTML, 'alt', 'Kein Neuzeichnen nach Tageswechsel');
  ctx.date = '2026-11-12';

  // Produktdetail in einer frischen Umgebung: offline verschwindet der Abschnitt, erneutes Öffnen zeigt ihn.
  const ctx2 = Object.assign({}, ctx); online = false; requests.length = 0;
  vm.createContext(ctx2);
  for (const file of ['nutrient-definitions', 'nutrient-references', 'nutrient-resolver']) vm.runInContext(read('js/' + file + '.js'), ctx2);
  vm.runInContext(diary.slice(diary.indexOf('/* ---------- Alle Nährstoffe'), diary.indexOf('function fdWeekStats(')), ctx2);
  vm.runInContext(page.slice(page.indexOf('function fpAllKey'), page.indexOf('/* ---------- Produkt prüfen')), ctx2);
  const product = {id: 'p1', catalogKey: key, unit: 'g', kcal: 100, p: 10, c: 12.4, f: 1};
  const open = () => { dom['fp-all'] = el(); dom['fp-all'].hidden = true; dom['fp-all-body'] = el(); dom.grams = {value: '200'}; ctx2.foodSelection = product; vm.runInContext('fpAllUpdate();fpAllEnsure(foodSelection)', ctx2); };
  open(); await settle();
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(dom['fp-all'].hidden, true, 'Offline ohne Zusatzwerte: Abschnitt weg');
  online = true; open(); await settle();
  assert.strictEqual(requests.length, 2, 'Erneutes Öffnen des Details lädt erneut');
  assert.strictEqual(dom['fp-all'].hidden, false);
  assert(/Zucker<\/span><strong>4 g/.test(dom['fp-all-body'].innerHTML), 'Wert folgt der Menge (200 g)');
  // Produktwechsel vor Abschluss: alte Antwort zeichnet nicht in das neue Produkt.
  const other = {id: 'p2', unit: 'g', kcal: 1, p: 0, c: 0, f: 0};
  open(); dom['fp-all-body'].innerHTML = 'neu'; ctx2.foodSelection = other; await settle();
  assert.strictEqual(dom['fp-all-body'].innerHTML, 'neu', 'Kein Neuzeichnen nach Produktwechsel');
  console.log('Nährwert-Anzeige: Referenzen, Einbindung, Formulare und erneutes Nachladen geprüft.');
})().catch(error => { console.error(error); process.exit(1); });

// Quellenangabe im Produktdetail: nur Katalog-Lebensmittel, deutsch und englisch.
{
  const c = {esc: x => String(x), window: {}, state: {language: 'de'}};
  c.fdT = (de, en) => c.state.language === 'en' ? en : de;
  vm.createContext(c);
  vm.runInContext(page.match(/function fpAllKey[^\n]*/)[0] + '\n' + page.match(/function fpSourceCredit[\s\S]*?\n}/)[0], c);
  const credit = p => vm.runInContext('fpSourceCredit(x)', Object.assign(c, {x: p}));
  assert.strictEqual(credit({catalogKey: 'BLS 4.0:C133000'}), 'Quelle: Max Rubner-Institut (2025), Bundeslebensmittelschlüssel (BLS) 4.0 · CC BY 4.0');
  assert.strictEqual(credit({source: 'Ciqual 2025', record: '1'}), 'Quelle: ANSES, Table de composition nutritionnelle des aliments Ciqual 2025 · Licence Ouverte 2.0');
  assert.strictEqual(credit({catalogKey: 'USDA Foundation 2026:1'}), 'Quelle: U.S. Department of Agriculture, Agricultural Research Service, FoodData Central · gemeinfrei (CC0)');
  c.state.language = 'en';
  assert.strictEqual(credit({catalogKey: 'USDA SR Legacy 2018:1'}), 'Source: U.S. Department of Agriculture, Agricultural Research Service, FoodData Central · public domain (CC0)');
  for (const p of [{id: 'own'}, {recipeId: 'r', catalogKey: 'BLS 4.0:X'}, {barcode: '4000000000000', source: 'Open Food Facts'}, null]) assert.strictEqual(credit(p), '', 'Keine Quellenzeile');
}
