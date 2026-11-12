/* Data contract only. Not loaded by the app until the runtime integration. */
var PULS_NUTRIENT_DEFS = (function () {
  'use strict';
  const groups = [
    ['energy', [
      ['kcal','kcal','Energie','Energy'], ['p','g','Protein','Protein'],
      ['c','g','Kohlenhydrate','Carbohydrates'], ['f','g','Fett','Fat']
    ]],
    ['legacy', [
      ['water','ml','Wasser','Water'], ['fiber','g','Ballaststoffe','Fibre'],
      ['vitc','mg','Vitamin C','Vitamin C'], ['calcium','mg','Calcium','Calcium'],
      ['iron','mg','Eisen','Iron'], ['b12','µg','Vitamin B12','Vitamin B12'],
      ['potassium','mg','Kalium','Potassium'], ['magnesium','mg','Magnesium','Magnesium'],
      ['folate','µg','Folat','Folate']
    ]],
    ['carbohydrates', [
      ['sugars','g','Zucker','Sugars'], ['starch','g','Stärke','Starch'],
      ['polyols','g','Zuckeralkohole','Polyols'], ['glucose','g','Glucose','Glucose'],
      ['fructose','g','Fructose','Fructose'], ['galactose','g','Galactose','Galactose'],
      ['sucrose','g','Saccharose','Sucrose'], ['lactose','g','Lactose','Lactose'],
      ['maltose','g','Maltose','Maltose'], ['fiber_sol','g','Lösliche Ballaststoffe','Soluble fibre'],
      ['fiber_insol','g','Unlösliche Ballaststoffe','Insoluble fibre']
    ]],
    ['fats', [
      ['satfat','g','Gesättigte Fettsäuren','Saturated fatty acids'],
      ['mufat','g','Einfach ungesättigte Fettsäuren','Monounsaturated fatty acids'],
      ['pufat','g','Mehrfach ungesättigte Fettsäuren','Polyunsaturated fatty acids'],
      ['transfat','g','Transfettsäuren','Trans fatty acids'],
      ['omega3','g','Omega-3-Fettsäuren','Omega-3 fatty acids'],
      ['omega6','g','Omega-6-Fettsäuren','Omega-6 fatty acids'],
      ['ala','g','Alpha-Linolensäure (ALA)','Alpha-linolenic acid (ALA)'],
      ['epa','g','Eicosapentaensäure (EPA)','Eicosapentaenoic acid (EPA)'],
      ['dha','g','Docosahexaensäure (DHA)','Docosahexaenoic acid (DHA)'],
      ['linoleic','g','Linolsäure','Linoleic acid'],
      ['arachidonic','g','Arachidonsäure','Arachidonic acid'],
      ['cholesterol','mg','Cholesterin','Cholesterol']
    ]],
    ['aminoAcids', [
      ['histidine','g','Histidin','Histidine'], ['isoleucine','g','Isoleucin','Isoleucine'],
      ['leucine','g','Leucin','Leucine'], ['lysine','g','Lysin','Lysine'],
      ['methionine','g','Methionin','Methionine'], ['phenylalanine','g','Phenylalanin','Phenylalanine'],
      ['threonine','g','Threonin','Threonine'], ['tryptophan','g','Tryptophan','Tryptophan'],
      ['valine','g','Valin','Valine'], ['cysteine','g','Cystein','Cysteine'],
      ['tyrosine','g','Tyrosin','Tyrosine']
    ]],
    ['vitamins', [
      ['vita_rae','µg','Vitamin A (RAE)','Vitamin A (RAE)'], ['retinol','µg','Retinol','Retinol'],
      ['beta_carotene','µg','Beta-Carotin','Beta-carotene'], ['vitd','µg','Vitamin D','Vitamin D'],
      ['vite','mg','Vitamin E (Alpha-Tocopherol)','Vitamin E (alpha-tocopherol)'],
      ['vitk','µg','Vitamin K','Vitamin K'], ['b1','mg','Vitamin B1','Vitamin B1'],
      ['b2','mg','Vitamin B2','Vitamin B2'], ['niacin','mg','Niacin','Niacin'],
      ['niacin_ne','mg','Niacin-Äquivalent','Niacin equivalents'],
      ['b5','mg','Vitamin B5','Vitamin B5'], ['b6','mg','Vitamin B6','Vitamin B6'],
      ['biotin','µg','Biotin','Biotin'], ['folate_dfe','µg','Folat-Äquivalent (DFE)','Folate equivalents (DFE)'],
      ['folic_acid','µg','Folsäure','Folic acid'], ['choline','mg','Cholin','Choline']
    ]],
    ['minerals', [
      ['sodium','mg','Natrium','Sodium'], ['chloride','mg','Chlorid','Chloride'],
      ['phosphorus','mg','Phosphor','Phosphorus'], ['zinc','mg','Zink','Zinc'],
      ['copper','mg','Kupfer','Copper'], ['manganese','mg','Mangan','Manganese'],
      ['selenium','µg','Selen','Selenium'], ['iodine','µg','Iod','Iodine'],
      ['fluoride','µg','Fluorid','Fluoride'], ['chromium','µg','Chrom','Chromium'],
      ['molybdenum','µg','Molybdän','Molybdenum']
    ]],
    ['other', [['alcohol','g','Alkohol','Alcohol'], ['caffeine','mg','Koffein','Caffeine']]]
  ];
  const notes = {
    c: {bls:'Verfügbare Kohlenhydrate.', usda:'Carbohydrate by difference, einschließlich Ballaststoffen.', ciqual:'Glucides, ohne Ballaststoffe.'},
    water: {all:'Legacy-Einheit ml. Quellenwasser in g wird nicht erneut importiert. Bestehende Snapshots bleiben unverändert.'},
    folate: {bls:'Legacy FOLFD (natürliches Folat).', usda:'Legacy Folate, total.', ciqual:'Legacy Folates totaux.', all:'Keine neuen Sidecarwerte für diesen Legacy-Schlüssel.'},
    fiber: {bls:'Legacy FIBT aus Basiskatalog oder Snapshot, keine Sidecarwerte.', usda:'Legacy 1079 aus Basiskatalog oder Snapshot, kein Ersatz durch andere AOAC-Fraktionen.'},
    vitk: {bls:'K1 + K2.', usda:'Phyllochinon (K1).', ciqual:'K1, zuzüglich K2 nur wenn K2 numerisch bekannt ist.'},
    cysteine: {bls:'Cystein.', usda:'Cystine, als abweichende Quelldefinition erhalten. Keine Umrechnung.'},
    vita_rae: {ciqual:'Abgeleitet aus Retinol + Beta-Carotin/12, nur wenn beide Werte numerisch bekannt sind.', bls:'VITAA enthält zusätzlich andere Provitamin-A-Carotinoide gemäß Quellenformel.'},
    iodine: {bls:'Quellenbezeichnung Iodid.'},
    b6: {bls:'µg werden durch 1000 geteilt.'},
    copper: {bls:'µg werden durch 1000 geteilt.'},
    manganese: {bls:'µg werden durch 1000 geteilt.'},
    vite: {all:'Nur Alpha-Tocopherol, keine Tocopherol-Äquivalente.'},
    ala: {usda:'Nur explizit n-3-spezifische ID 1404. Kein Ersatz durch undifferenziertes/cis-only 18:3.'},
    linoleic: {usda:'Nur explizit n-6-spezifische ID 1316.'},
    arachidonic: {usda:'ID 1408, Nährstoffnummer 855, in beiden Quellen. Die SR-Beschriftungen für 1406/853 und 1408/855 sind fehlerhaft. 1406 gehört zu 20:3 n-6.'}
  };
  let order = 0;
  return Object.freeze(groups.flatMap(([group, rows]) => rows.map(([key, unit, nameDe, nameEn]) => Object.freeze({
    key, unit, nameDe, nameEn, group, order:order++, basis:'per100',
    reference:Object.freeze({status:'none'}),
    ...(notes[key] ? {sourceNotes:Object.freeze(notes[key])} : {})
  }))));
})();
