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
 return `<div class="exercise-muscle-chart"><h3>${heading}</h3>${counts.map(([m,count])=>`<div class="musclerow"><span>${esc(muscleNames[m]||(m==='unassigned'?'Nicht zugeordnet':m))}</span><div><i style="width:${count/max*100}%"></i></div><strong>${count}</strong></div>`).join('')||'<p class="note">Noch keine abgeschlossenen Sätze.</p>'}</div>`;
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

// Muskel-Erholung (Training-Tab, Startansicht). Einfaches Modell, nur abgeschlossene Workouts und erledigte Sätze:
// Belastung einer Gruppe = erledigte Sätze der Einheit (das Mapping kennt keinen Haupt-/Nebenmuskel, also zählt jede Gruppe voll);
// Erholungszeit 48 h bis 6 Sätze, linear bis 72 h ab 12 Sätzen; Erholung = vergangene Zeit / Erholungszeit, höchstens 100 %.
// Mehrere Einheiten: niedrigster Wert. Nicht in den letzten 7 Tagen trainiert: null (frisch, kein erfundener Wert).
// shortcut: Workouts ohne Zeitstempel zählen ab 12:00 ihres Tages; genauer geht es erst mit gespeicherter Uhrzeit.
function muscleRecovery(now=Date.now()){
 const result=Object.fromEntries(Object.keys(muscleNames).map(m=>[m,null]));
 for(const w of completedWorkouts()){
  const end=w.finishedAt||(w.startedAt?w.startedAt+(w.durationSeconds||0)*1e3:Date.parse(w.date+'T12:00:00')),age=now-end;
  if(!(age<=7*864e5))continue;
  const sets={};
  for(const e of w.exercises||[]){
   const done=(e.sets||[]).filter(s=>s.done).length;if(!done)continue;
   for(const m of new Set(bookFor(e)?.muscles||[]))if(Object.hasOwn(result,m))sets[m]=(sets[m]||0)+done;
  }
  for(const [m,count] of Object.entries(sets)){
   const hours=48+24*Math.min(1,Math.max(0,(count-6)/6)),pct=Math.min(100,Math.floor(Math.max(0,age)/(hours*36e5)*100+1e-6));
   result[m]=result[m]===null?pct:Math.min(result[m],pct);
  }
 }
 return result;
}
// Abgerundete Formen [Gruppe, x, y, Breite, Höhe, Radius, mittig]; paarige Muskeln werden an der Mittelachse (x=50) gespiegelt, 'mittig' (1) nicht.
const recoveryShapes={
 front:[['neck',44,24,12,9,4,1],['shoulders',21,34,15,15,7],['chest',37,36,12,16,5],['biceps',21,51,12,20,5],['forearms',18,73,12,24,5],['abdominals',40,55,20,30,6,1],
  ['abductors',25,88,7,20,3.5],['quadriceps',32,90,13,40,6],['adductors',45,96,10,26,4,1],['calves',33,134,11,34,5]],
 back:[['traps',38,28,24,16,6,1],['shoulders',21,34,15,15,7],['lats',31,48,10,26,5],['middle back',42,46,16,16,5,1],['lower back',42,64,16,16,5,1],
  ['triceps',19,51,12,20,5],['forearms',17,73,12,24,5],['glutes',34,82,15,18,7],['hamstrings',33,102,15,32,6],['calves',34,138,12,32,5]]
};
function muscleRecoveryName(m){const name=muscleNames[m]||m;return state.language==='en'&&typeof englishUI==='object'?englishUI[name]||name:name}
function muscleRecoveryLabel(m,v){const en=state.language==='en',name=muscleRecoveryName(m);return v===null?`${name} ${en?'fresh':'frisch'}`:`${name} ${v} % ${en?'recovered':'erholt'}`}
function muscleRecoveryFigure(values){
 const rect=(m,x,y,w,h,r)=>{const v=values[m],label=esc(muscleRecoveryLabel(m,v));return `<rect class="mr mr-${v===null?'none':v<50?'low':v<100?'mid':'high'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"><title>${label}</title></rect>`};
 const view=(shapes,dx)=>`<g transform="translate(${dx} 0)"><circle class="mrbase" cx="50" cy="14" r="10"/><rect class="mrbase" x="34" y="32" width="32" height="68" rx="12"/>${shapes.map(([m,x,y,w,h,r,center])=>rect(m,x,y,w,h,r)+(center?'':rect(m,100-x-w,y,w,h,r))).join('')}</g>`;
 const en=state.language==='en',open=muscleRecoveryOpen(values),summary=open.length?open.map(([m,v])=>muscleRecoveryLabel(m,v)).join(', '):(en?'all fresh':'alles frisch');
 return `<svg class="mrfigure" viewBox="0 0 220 172" role="img" aria-label="${esc((en?'Muscle recovery':'Muskel-Erholung')+': '+summary)}">${view(recoveryShapes.front,0)}${view(recoveryShapes.back,120)}</svg>`;
}
function muscleRecoveryOpen(values){return Object.entries(values).filter(([,v])=>v!==null&&v<100).sort((a,b)=>a[1]-b[1]||muscleRecoveryName(a[0]).localeCompare(muscleRecoveryName(b[0])))}
function muscleRecoveryCard(now=Date.now()){
 if(!completedWorkouts().length)return '';
 const values=muscleRecovery(now),open=muscleRecoveryOpen(values);
 return `<section class="card recoverycard"><div class="cardhead"><h2>${state.language==='en'?'Recovery':'Erholung'}</h2></div>${muscleRecoveryFigure(values)}${open.length?`<ul class="recoverylist">${open.map(([m,v])=>`<li><i class="mr-${v<50?'low':'mid'}" aria-hidden="true"></i><span>${esc(muscleRecoveryName(m))}</span><strong>${v} %</strong></li>`).join('')}</ul>`:''}</section>`;
}
// Letztes Glied von workoutPage (js/flows.js): Karte unter den Inhalten der Startansicht; ohne abgeschlossenes Workout bleibt alles unverändert.
globalThis.workoutPageAfterExerciseMuscles=function workoutPageAfterExerciseMuscles(html){
 if(trainTab!=='current')return html;
 const card=muscleRecoveryCard();if(!card)return html;
 const template=document.createElement('template');template.innerHTML=html;
 const body=template.content.querySelector('.workoutbody');if(!body)return html;
 body.insertAdjacentHTML('beforeend',card);return template.innerHTML;
};
if(typeof englishUI==='object')Object.assign(englishUI,{'Erholung':'Recovery'});
