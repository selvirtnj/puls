/* Local name heuristics only; existing muscle assignments always take precedence. */
function muscleExerciseName(name){
 return String(name||'').toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// The catalog is fully loaded before this file. Never rescan it during rendering.
const exerciseMuscleCatalogNames=new Map();
for(const exercise of exerciseCatalog){
 const key=muscleExerciseName(exercise.name);
 if(!exerciseMuscleCatalogNames.has(key))exerciseMuscleCatalogNames.set(key,[...new Set(exercise.muscles||[])]);
}
const exerciseMuscleInferenceCache=new Map();
// Specific movements precede generic curl/raise/press matches.
const exerciseMuscleRules=[
  [/beinbeug|\bleg curls?\b|hamstring|\bnordic\b/,['hamstrings']],
  [/unterarm|handgelenk|\bwrist\b|\breverse curls?\b|\bforearms?\b/,['forearms']],
  [/waden|\bwade\b|\bcalf\b|\bcalves\b/,['calves']],
  [/abdukt|\babduct/,['abductors']],
  [/addukt|\badduct/,['adductors']],
  [/hip ?thrust|glute|gesaess|po bruecke|beckenheb|\bbutt\b/,['glutes']],
  [/bauch|crunch|plank|pallof|\bsit ups?\b|\bleg raises?\b|beinheb|\bab wheel\b|\babdom/,['abdominals']],
  [/rueckenstreck|hyperextension|\bback extensions?\b|\blower back\b|\bgood mornings?\b/,['lower back']],
  [/\bromanian\b|\brdl\b|rumaenisch/,['hamstrings','glutes']],
  [/\b(?:brust|chest) dips?\b|\bdips? (?:brust|chest)\b/,['chest','triceps']],
  [/trizeps|triceps?|\bdips?\b|pushdown|push down|skull crush|french press/,['triceps']],
  [/schulterheb|shrug|trapez|\btraps?\b/,['traps']],
  [/nackendrueck|\bneck press|\bbehind (?:the )?neck press|\breverse butterfly\b/,['shoulders']],
  [/\bupright rows?\b|aufrechte[smnr]? rudern/,['shoulders','traps']],
  [/schulter|seitheb|frontheb|\bshoulder|\blateral raise|\bfront raise|\brear delt|\breverse fl|\bface pull|\boverhead press|\bmilitary press|\barnold press/,['shoulders']],
  [/nacken|\bneck\b/,['neck']],
  [/rudern|\brows?\b|\browing\b|\bmiddle back\b/,['middle back']],
  [/klimmzug|klimmzueg|latzug|latzieh|\blats?\b|\bpull ?ups?\b|\bchin ?ups?\b|\bpull ?downs?\b|\bpullover\b/,['lats']],
  [/kniebeug|squat|hackenschmidt|beinpresse|beinstreck|\bleg press|\bleg extension|\blunges?\b|ausfallschritt|quadrizeps|\bquads?\b/,['quadriceps']],
  [/bizeps|biceps?|curl/,['biceps']],
  [/bankdrueck|brust|\bbench\b|\bchest\b|butterfly|\bpec\b|\bpush ?ups?\b|liegestuetz|\b(?:fly|flys|flyes|flies)\b|\bpress\b/,['chest']],
  [/kreuzheb|\bdeadlift/,['lower back']]
];
function inferExerciseMuscles(name){
 const text=muscleExerciseName(name);
 if(!exerciseMuscleInferenceCache.has(text)){
  // An exact library name is more specific than any keyword (e.g. Cuban Press).
  const catalog=exerciseMuscleCatalogNames.get(text);
  const muscles=catalog?.length?catalog:exerciseMuscleRules.find(([pattern])=>pattern.test(text))?.[1]||[];
  // Bound memory for long sessions with many different search/import names.
  if(exerciseMuscleInferenceCache.size>=2048)exerciseMuscleInferenceCache.delete(exerciseMuscleInferenceCache.keys().next().value);
  exerciseMuscleInferenceCache.set(text,muscles);
 }
 // Callers may edit their copy without poisoning later results.
 return exerciseMuscleInferenceCache.get(text).slice();
}

// Derived copies keep imported/offline profiles intact and also feed progress-metrics.
const exerciseMusclesBookFor=bookFor;
bookFor=function(e){
 const b=exerciseMusclesBookFor(e);
 if(!b||b.muscles?.length)return b;
 const muscles=inferExerciseMuscles(b.name);
 return muscles.length?{...b,muscles}:b;
};

// Automatic assignments are derived, including for newly created exercises.
// Keep training.js's original creation path; renames and improved rules can then
// update the inference without confusing it with an explicit/manual assignment.

// Reuse the existing Monday-based week/month recap instead of a second counter.
muscleChart=function(ws){
 const counts=muscleCounts(ws),max=Math.max(1,...counts.map(([,count])=>count));
 const heading=recapMode==='week'?(recapOffset===0?'Diese Woche · Sätze pro Muskelgruppe':'Woche · Sätze pro Muskelgruppe'):'Monat · Sätze pro Muskelgruppe';
 return `<div class="exercise-muscle-chart"><h3>${heading}</h3>${counts.map(([m,count])=>`<div class="musclerow"><span>${esc(muscleNames[m]||(m==='unassigned'?'Nicht zugeordnet':m))}</span><div><i style="width:${count/max*100}%"></i></div><strong>${count}</strong></div>`).join('')||'<p class="note">Noch keine abgeschlossenen Sätze.</p>'}<p class="note">Primäre Muskelgruppen. Ein Satz kann mehrere Gruppen zählen.</p><p class="note">Eigene Übungen werden anhand des Namens zugeordnet. Bei Bedarf im Übungsverlauf anpassen.</p></div>`;
};
if(typeof englishUI==='object')Object.assign(englishUI,{
 'Diese Woche · Sätze pro Muskelgruppe':'This week · Sets per muscle group',
 'Woche · Sätze pro Muskelgruppe':'Week · Sets per muscle group',
 'Monat · Sätze pro Muskelgruppe':'Month · Sets per muscle group',
 'Primäre Muskelgruppen. Ein Satz kann mehrere Gruppen zählen.':'Primary muscle groups. A set can count toward multiple groups.',
 'Eigene Übungen werden anhand des Namens zugeordnet. Bei Bedarf im Übungsverlauf anpassen.':'Custom exercises are assigned by name. Adjust in exercise history if needed.',
 'Noch keine abgeschlossenen Sätze.':'No completed sets yet.',
 'Nicht zugeordnet':'Unassigned',
 'Bauch':'Abs','Abduktoren':'Abductors','Adduktoren':'Adductors','Bizeps':'Biceps',
 'Waden':'Calves','Brust':'Chest','Unterarme':'Forearms','Gesäß':'Glutes',
 'Beinbeuger':'Hamstrings','Latissimus':'Lats','Unterer Rücken':'Lower back',
 'Mittlerer Rücken':'Middle back','Nacken':'Neck','Quadrizeps':'Quadriceps',
 'Schultern':'Shoulders','Trapez':'Traps','Trizeps':'Triceps'
});
