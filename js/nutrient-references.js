/* PULS · Referenzwerte für die neuen Nährstoffschlüssel (nur Anzeige, nichts wird gespeichert).
   Quelle ausschließlich DGE-Referenzwerte für Erwachsene (ab 19 Jahren), je Altersgruppe und Geschlecht
   wie auf der jeweiligen DGE-Seite angegeben. Abgerufen am 12.11.2026.
   Bewusst ohne Referenzwert: Vitamin D (DGE-Schätzwert gilt nur bei fehlender Eigensynthese),
   Zink (DGE-Wert hängt zusätzlich von der Phytatzufuhr ab), Kupfer, Mangan, Chrom, Molybdän (nur Spannen),
   Fettsäuren (Anteil an der Energie), Zucker, gesättigte Fettsäuren, Natrium/Salz und alle Schlüssel ohne DGE-Seite.
   Die acht bisherigen Mikroziele bleiben in referenceMicros() (flows.js). */
var PULS_NUTRIENT_REFS = (function () {
  'use strict';
  // Altersgruppen der DGE für Erwachsene: 19–<25, 25–<51, 51–<65, ab 65.
  const ages = [[19, 25], [25, 51], [51, 65], [65, Infinity]];
  const table = {
    // https://www.dge.de/wissenschaft/referenzwerte/vitamin-a/ (abgerufen 12.11.2026), µg Retinolaktivitätsäquivalent (RAE)
    vita_rae: {m: [850, 850, 850, 800], w: [700, 700, 700, 700]},
    // https://www.dge.de/wissenschaft/referenzwerte/vitamin-e/ (abgerufen 12.11.2026), Schätzwert mg RRR-α-Tocopherol
    vite: {m: [8, 8, 8, 8], w: [8, 8, 8, 8]},
    // https://www.dge.de/wissenschaft/referenzwerte/vitamin-k/ (abgerufen 12.11.2026), Schätzwert µg
    vitk: {m: [70, 70, 80, 80], w: [60, 60, 65, 65]},
    // https://www.dge.de/wissenschaft/referenzwerte/thiamin/ (abgerufen 12.11.2026), mg
    b1: {m: [1.3, 1.2, 1.2, 1.1], w: [1.0, 1.0, 1.0, 1.0]},
    // https://www.dge.de/wissenschaft/referenzwerte/riboflavin/ (abgerufen 12.11.2026), mg
    b2: {m: [1.4, 1.4, 1.3, 1.3], w: [1.1, 1.1, 1.0, 1.0]},
    // https://www.dge.de/wissenschaft/referenzwerte/niacin/ (abgerufen 12.11.2026), mg Niacin-Äquivalente
    niacin_ne: {m: [16, 15, 15, 14], w: [13, 12, 11, 11]},
    // https://www.dge.de/wissenschaft/referenzwerte/pantothensaeure/ (abgerufen 12.11.2026), Schätzwert mg
    b5: {m: [5, 5, 5, 5], w: [5, 5, 5, 5]},
    // https://www.dge.de/wissenschaft/referenzwerte/vitamin-b6/ (abgerufen 12.11.2026), mg
    b6: {m: [1.6, 1.6, 1.6, 1.6], w: [1.4, 1.4, 1.4, 1.4]},
    // https://www.dge.de/wissenschaft/referenzwerte/biotin/ (abgerufen 12.11.2026), Schätzwert µg
    biotin: {m: [40, 40, 40, 40], w: [40, 40, 40, 40]},
    // https://www.dge.de/wissenschaft/referenzwerte/folat/ (abgerufen 12.11.2026), µg Folat-Äquivalente
    folate_dfe: {m: [300, 300, 300, 300], w: [300, 300, 300, 300]},
    // https://www.dge.de/wissenschaft/referenzwerte/chlorid/ (abgerufen 12.11.2026), Schätzwert mg
    chloride: {m: [2300, 2300, 2300, 2300], w: [2300, 2300, 2300, 2300]},
    // https://www.dge.de/wissenschaft/referenzwerte/phosphor/ (abgerufen 12.11.2026), Schätzwert mg
    phosphorus: {m: [550, 550, 550, 550], w: [550, 550, 550, 550]},
    // https://www.dge.de/wissenschaft/referenzwerte/selen/ (abgerufen 12.11.2026), Schätzwert µg
    selenium: {m: [70, 70, 70, 70], w: [60, 60, 60, 60]},
    // https://www.dge.de/wissenschaft/referenzwerte/jod/ (abgerufen 12.11.2026), µg
    iodine: {m: [150, 150, 150, 150], w: [150, 150, 150, 150]},
    // https://www.dge.de/wissenschaft/referenzwerte/fluorid/ (abgerufen 12.11.2026), angemessene Gesamtzufuhr 3,5 / 3,0 mg = 3500 / 3000 µg
    fluoride: {m: [3500, 3500, 3500, 3500], w: [3000, 3000, 3000, 3000]}
  };
  Object.values(table).forEach(row => { Object.freeze(row.m); Object.freeze(row.w); Object.freeze(row); });
  Object.freeze(table);
  // Profil: age (Zahl) und sex ('male'/'female'). Ohne passende Angabe gibt es keinen Wert.
  function reference(key, profile) {
    const row = table[key], age = Number(profile?.age);
    if (!row || !Number.isFinite(age) || age < ages[0][0]) return null;
    const index = ages.findIndex(([from, to]) => age >= from && age < to);
    if (index < 0) return null;
    const sex = profile?.sex === 'male' ? 'm' : profile?.sex === 'female' ? 'w' : null;
    if (sex) return row[sex][index];
    // Ohne Geschlecht nur dann ein Wert, wenn die DGE für beide denselben angibt.
    return row.m[index] === row.w[index] ? row.m[index] : null;
  }
  return Object.freeze({keys: () => Object.keys(table), reference});
})();
if (typeof window !== 'undefined') window.pulsNutrientRefs = PULS_NUTRIENT_REFS;
