// Runde 3 HIG: Abschlussseiten, Verwerfen-Bestätigung, Import-Vorschau. Es ändern sich keine gespeicherten Felder;
// geprüft werden Einzahl/Mehrzahl, Zahlen der Fortschrittsseite und Sprache (Deutsch und Englisch) ohne Fehlerwerte.
const assert=require('node:assert/strict');
const {loadApp}=require('./validdata-env.cjs');
const app=loadApp({now:Date.UTC(2026,10,13,12)});
assert.deepEqual(app.errors,[],'Skripte laufen im Stub');
const BAD=/undefined|NaN|\[object|Infinity/;
const wk=(id,sets)=>`{id:'${id}',date:today(),name:'Test <b>',startedAt:Date.now()-60000,finished:false,exercises:[{id:'e${id}',exerciseId:'bench',name:'Bench',sets:[${Array.from({length:sets},()=>"{kg:50,reps:8,done:true}").join(',')}]}]}`;
for(const lang of ['de','en']){
  const en=lang==='en';
  app.run(`state.language='${lang}';sessionWorkoutId=null;completionId=null;state.workouts=[${wk('one',1)},${wk('many',3)}];`);
  // Verwerfen: Einzahl und Mehrzahl, roter Knopf mit der bestehenden Funktion, Name maskiert.
  for(const [id,text] of [['one',en?'1 completed set':'1 abgeschlossenen Satz'],['many',en?'3 completed sets':'3 abgeschlossene Sätze']]){
    app.run(`requestDiscardWorkout('${id}')`);
    const html=String(app.run("document.getElementById('mb').innerHTML"));
    assert(html.includes(text),lang+' '+id+': '+text);
    assert(html.includes(`discardAccidentalWorkout('${id}')`)&&html.includes('actiondanger'),lang+': Verwerfen bleibt ausführbar');
    assert(html.includes('Test &lt;b&gt;'),lang+': Workout-Name maskiert');
    assert(!BAD.test(html),lang+': ohne Fehlerwerte');
  }
  // Abschlussseiten Serie und Fortschritt: Level-Zeilen aus xpProgress, Fortschrittsbalken mit Werten.
  app.run("state.workouts=[];");
  app.run(`state.workouts=[{...${wk('done',2)},finished:true,durationSeconds:3600}]`);
  for(const step of [0,1,2]){
    const html=String(app.run(`completionHtml('done',${step})`));
    assert(!BAD.test(html),lang+' Schritt '+step+': ohne Fehlerwerte');
    assert(html.includes('completioncontinue'),lang+' Schritt '+step+': Weiter bleibt');
  }
  const progress=String(app.run("completionHtml('done',2)"));
  assert(/role="progressbar"[^>]*aria-valuenow="\d+"/.test(progress),lang+': Fortschrittsbalken mit Wert');
  assert(progress.includes(en?'To level 2':'Bis Level 2')&&progress.includes('completionrows'),lang+': Level-Zeilen');
  assert(progress.includes('XP-Aufschlüsselung'),lang+': Aufschlüsselung bleibt');
  const streak=String(app.run("completionHtml('done',1)"));
  assert(streak.includes(en?'week with at least one workout':'Woche mit mindestens einem Workout')||streak.includes(en?'weeks with':'Wochen mit'),lang+': Serientext');
}
console.log('PASS HIG round 3: Verwerfen (Einzahl/Mehrzahl, DE/EN), Abschlussseiten Serie und Fortschritt ohne Fehlerwerte');
