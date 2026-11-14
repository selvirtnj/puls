const fs=require('node:fs'),vm=require('node:vm');
// Established app bootstrap only; all data below are synthetic local fixtures.
const bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split('run(`state.foods=')[0];
vm.runInNewContext(bootstrap+String.raw`
run('render=function(){};var soundNotes={}');
el('modal').classList={toggle(){}};
for(let file of ['js/workout-polish.js','js/tracker-tools.js','js/i18n.js','js/progress-metrics.js','js/machine-library.js','js/exercise-muscles.js'])run(fs.readFileSync(file,'utf8'));
const infer=name=>JSON.parse(run('JSON.stringify(inferExerciseMuscles('+JSON.stringify(name)+'))'));
for(let [name,expected] of [
 ['Meine Bankdrücken Variante',['chest']],['My bench press',['chest']],['Meine Brustpresse',['chest']],
 ['My press',['chest']],['Mein Rudern',['middle back']],['My cable row',['middle back']],
 ['Mein Latzug',['lats']],['Mein Klimmzug',['lats']],['Meine Kniebeuge',['quadriceps']],
 ['My squat',['quadriceps']],['Meine Beinpresse',['quadriceps']],['My leg press',['quadriceps']],
 ['My curl',['biceps']],['Mein Trizepsdrücken',['triceps']],['My dips',['triceps']],['My pushdown',['triceps']],
 ['Meine Schulterpresse',['shoulders']],['My overhead press',['shoulders']],['Mein Seitheben',['shoulders']],
 ['My lateral raise',['shoulders']],['Meine Wade',['calves']],['My calf raise',['calves']],
 ['Mein Bauchtraining',['abdominals']],['My crunch',['abdominals']],['My plank',['abdominals']],
 ['Mein Hip thrust',['glutes']],['Mein Gesäßtraining',['glutes']],['Mein Beinbeuger',['hamstrings']],
 ['My leg curl',['hamstrings']],['Mein Wrist Curl',['forearms']],['Mein Rückenstrecker',['lower back']],
 ['Mein Abduktor',['abductors']],['Mein Adduktor',['adductors']],['Meine Shrugs',['traps']],
 ['Reverse Butterfly',['shoulders']],['Schulterheben',['traps']],['Kurzhantel Schulterheben',['traps']],
 ['Nackendrücken',['shoulders']],['Upright Row',['shoulders','traps']],['Aufrechtes Rudern',['shoulders','traps']],
 ['Brust Dips',['chest','triceps']],['Latziehen',['lats']],['Hipthrust',['glutes']],
 ['Cable Flies',['chest']],['Hackenschmidt',['quadriceps']],
 ['My Romanian deadlift',['hamstrings','glutes']],['Private Variante X',[]],['Isolation X',[]],['',[]]
])assert.deepEqual(infer(name),expected,name);
assert.deepEqual(infer('Cuban Press'),JSON.parse(run('JSON.stringify(exerciseCatalog.find(x=>x.name==="Cuban Press").muscles)')));
run('inferExerciseMuscles("Meine Bankdrücken Variante");var cacheSize=exerciseMuscleInferenceCache.size;inferExerciseMuscles("MEINE BANKDRUECKEN VARIANTE").push("neck")');
assert.equal(run('exerciseMuscleInferenceCache.size'),run('cacheSize'));
assert.deepEqual(infer('Meine Bankdrücken Variante'),['chest']);
// Catalog matching never scans or normalizes catalog rows again after loading.
run('var originalCatalogFind=exerciseCatalog.find;exerciseCatalog.find=()=>{throw Error("Unexpected catalog scan")};inferExerciseMuscles("Cuban Press");inferExerciseMuscles("Neue unbekannte Variante");exerciseCatalog.find=originalCatalogFind');
run('state=initial();migrate();state.workoutSettings={restSeconds:120};exercisePickerContext={kind:"routine"};routineDraft={id:"r",name:"Test",exercises:[]}');
el('library-custom').value='Meine Beinbeuger Variante';run('addOwnLibraryExercise()');
assert(run('state.exerciseBook.at(-1).muscles===undefined'));assert(run('validData(state)'));
assert.equal(JSON.parse(storage).exerciseBook.at(-1).muscles,undefined);
assert.equal(run('bookFor({exerciseId:state.exerciseBook.at(-1).id,name:state.exerciseBook.at(-1).name}).muscles[0]'),'hamstrings');
run('state.exerciseBook.at(-1).name="Meine Schulterheben Variante"');
assert.equal(run('bookFor({exerciseId:state.exerciseBook.at(-1).id,name:"Alter Name"}).muscles[0]'),'traps');
run('state.exerciseBook.at(-1).name="Meine Beinbeuger Variante"');
// Duplicate exercises and manual assignments remain untouched.
run('var ownId=state.exerciseBook.at(-1).id;state.exerciseBook.at(-1).muscles=["chest"];var bookLength=state.exerciseBook.length;addOwnLibraryExercise()');
assert.equal(run('state.exerciseBook.length'),run('bookLength'));assert(run('state.exerciseBook.at(-1).id===ownId&&state.exerciseBook.at(-1).muscles[0]==="chest"'));
el('library-custom').value='Unbekannte Variante X';run('addOwnLibraryExercise()');assert(run('state.exerciseBook.at(-1).muscles===undefined'));assert(run('validData(state)'));
ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-25T12:00:00']))}static now(){return new Date('2026-10-25T12:00:00').getTime()}};
run('state.exerciseBook=[{id:"legacy",name:"Mein Bankdrücken",target:0},{id:"manual",name:"My curl",target:0,muscles:["triceps","triceps"]},{id:"empty",name:"My leg curl",target:0,muscles:[]}]');
run('var backupBefore=JSON.stringify(state.exerciseBook);var setFixture=(done=true)=>({kg:20,reps:8,done});var workoutFixture=(id,date,finished=true)=>({id,date,name:"Fixture",finished,exercises:[{id:"e"+id,exerciseId:"legacy",name:"Mein Bankdrücken",sets:[setFixture(),setFixture(),setFixture(false)]}]});state.workouts=[workoutFixture("sunBefore","2026-10-18"),workoutFixture("monday","2026-10-19"),workoutFixture("sunday","2026-10-25"),workoutFixture("future","2026-10-26"),workoutFixture("active","2026-10-25",false)]');
assert.equal(run('weekStart(today())'),'2026-10-19');
assert.equal(run('weekStart("2026-10-26")'),'2026-10-26');
const storedBefore=storage;
const weekly='completedWorkouts().filter(w=>w.date>=recapRange().start&&w.date<=recapRange().end)';
run('recapMode="week";recapOffset=0');
assert.equal(run('JSON.stringify(muscleCounts('+weekly+'))'),'[["chest",4]]');
assert(run('muscleChart('+weekly+').includes("Diese Woche · Sätze pro Muskelgruppe")'));
assert(!run('muscleChart('+weekly+').includes("Verlauf → Einstellungen")'));
run('recapOffset=-1');assert.equal(run('JSON.stringify(muscleCounts('+weekly+'))'),'[["chest",2]]');assert(run('muscleChart('+weekly+').includes("Woche · Sätze pro Muskelgruppe")'));run('recapOffset=0');
assert.equal(run('JSON.stringify(muscleCounts([{exercises:[{exerciseId:"manual",name:"My curl",sets:[setFixture()]}]}]))'),'[["triceps",1]]');
assert.equal(run('JSON.stringify(muscleCounts([{exercises:[{exerciseId:"empty",name:"My leg curl",sets:[setFixture()]}]}]))'),'[["hamstrings",1]]');
assert.equal(run('JSON.stringify(muscleCounts([{exercises:[{name:"Isolation X",sets:[setFixture()]}]}]))'),'[["unassigned",1]]');
// The progress explorer uses the same derived book entry, without a migration/save.
assert(run('buildProgressMetrics().definitions.some(x=>x.key==="muscle:chest:sets")'));
assert(!run('buildProgressMetrics().definitions.some(x=>x.key==="muscle:unassigned:sets")'));
assert.equal(run('JSON.stringify(state.exerciseBook)'),run('backupBefore'));
assert.equal(storage,storedBefore);
assert(run('validData(state)'));run('state=JSON.parse(JSON.stringify(state))');assert(run('validData(state)'));
assert.equal(run('translatedUI("Diese Woche · Sätze pro Muskelgruppe")'),'This week · Sets per muscle group');
assert.equal(run('translatedUI("Beinbeuger")'),'Hamstrings');
assert.equal(run('translatedUI("Eigene Übungen werden anhand des Namens zugeordnet. Bei Bedarf im Übungsverlauf anpassen.")'),'Custom exercises are assigned by name. Adjust in exercise history if needed.');
run('recapMode="month"');assert(run('muscleChart([]).includes("Monat · Sätze pro Muskelgruppe")'));assert(run('muscleChart([]).includes("Noch keine abgeschlossenen Sätze.")'));
// Historical workouts may reference no surviving book entry; never fabricate one.
run('state.exerciseBook=[];state.workouts=[{id:"orphan",name:"Fixture",date:today(),finished:true,exercises:[{id:"orphan-e",name:"Bankdrücken",sets:[setFixture()]}]}]');
assert.equal(run('bookFor(state.workouts[0].exercises[0])'),undefined);
assert.doesNotThrow(()=>run('exerciseCard(state.workouts[0],state.workouts[0].exercises[0],0)'));
assert(run('validData(state)'));

// Muskel-Erholung: Modell (48 h bis 6 Sätze, linear bis 72 h ab 12 Sätzen), Karte und Figur.
run('state.exerciseBook=[{id:"rc",name:"Mein Bankdrücken",target:0}];state.language="de";var RNOW=Date.UTC(2026,9,25,10),H=3600000;var rsets=(n,done=true)=>Array.from({length:n},()=>({kg:20,reps:8,done}));'
 +'var rw=(id,hoursAgo,sets,finished=true)=>({id,name:"Fixture",date:"2026-10-24",finished,finishedAt:RNOW-hoursAgo*H,exercises:[{id:"e"+id,exerciseId:"rc",name:"Mein Bankdrücken",sets}]});'
 +'var chestAfter=(...ws)=>{state.workouts=ws;return muscleRecovery(RNOW).chest}');
assert.equal(run('Object.keys(muscleRecovery(RNOW)).join()'),run('Object.keys(muscleNames).join()'));
run('state.workouts=[]');
assert.equal(run('muscleRecoveryCard(RNOW)'),'');assert.equal(run('Object.values(muscleRecovery(RNOW)).every(v=>v===null)'),true);
assert.equal(run('workoutPageAfterExerciseMuscles("<x></x>")'),'<x></x>');
assert.equal(run('chestAfter(rw("a",24,rsets(6)))'),50);
assert.equal(run('chestAfter(rw("a",80,rsets(6)))'),100);
assert.equal(run('chestAfter(rw("a",36,rsets(12)))'),50);
assert.equal(run('chestAfter(rw("a",30,rsets(9)))'),50);
assert.equal(run('chestAfter(rw("a",5,rsets(3)))'),10);
assert.equal(run('chestAfter(rw("a",24+8*24,rsets(6)))'),null);
assert.equal(run('chestAfter(rw("a",24,rsets(5,false)))'),null);
assert.equal(run('chestAfter(rw("a",24,[...rsets(1,false),...rsets(6)].slice(0,6)))'),run('chestAfter(rw("a",24,rsets(5)))'));
assert.equal(run('chestAfter(rw("a",24,rsets(6),false))'),null);
assert.equal(run('chestAfter(rw("a",20,rsets(12)),rw("b",60,rsets(6)))'),27);
assert.equal(run('muscleRecovery(RNOW).triceps'),null);
assert.equal(run('chestAfter(rw("a",24,rsets(6)));Object.entries(muscleRecovery(RNOW)).filter(([,v])=>v!==null).length'),1);
const cardNow=run('state.workouts=[rw("a",24,rsets(6))];muscleRecoveryCard(RNOW)');
for(const [key,name] of Object.entries(JSON.parse(run('JSON.stringify(muscleNames)'))))assert(cardNow.includes('role="img" aria-label="'+name+' '+(key==='chest'?'50 % erholt':'frisch')+'"><title>'),'Figur ohne beschriftete Form: '+name);
assert(cardNow.includes('<li><i class="mr-mid" aria-hidden="true"></i><span>Brust</span><strong>50 %</strong></li>'));
assert(cardNow.includes('mr-high')===false&&cardNow.includes('<ul class="recoverylist">'));
assert(run('state.language="en";muscleRecoveryCard(RNOW)').includes('aria-label="Chest 50 % recovered"'));run('state.language="de"');
// Alles erholt: Figur grün, keine Liste. Einbau in den Training-Tab: tests/check-workoutpage-order.cjs.
const calm=run('state.workouts=[rw("a",80,rsets(6))];muscleRecoveryCard(RNOW)');assert(calm.includes('mr-high')&&!calm.includes('recoverylist'));
// Einbau am Ende von .workoutbody (der DOM-Stub kennt kein echtes template): nur in der Startansicht und nur mit abgeschlossenem Workout.
run('document.createElement=()=>{let t={content:{querySelector:()=>({insertAdjacentHTML:(where,html)=>{t.added=html}})},set innerHTML(v){t.base=v},get innerHTML(){return t.base+t.added}};return t};'
 +'var stepOut=()=>workoutPageAfterExerciseMuscles("<div class=\\"workoutbody\\"></div>");Date.now=()=>RNOW');
run('trainTab="current";state.workouts=[rw("a",24,rsets(6))]');
assert.match(run('stepOut()'),/^<div class="workoutbody"><\/div><section class="card recoverycard">.*<\/section>$/s);
assert.equal((run('stepOut()').match(/class="card recoverycard"/g)||[]).length,1);
run('trainTab="routines"');assert.equal(run('stepOut()'),'<div class="workoutbody"></div>');
run('trainTab="current";state.workouts=[rw("a",24,rsets(6),false)]');assert.equal(run('stepOut()'),'<div class="workoutbody"></div>');
run('state.workouts=[]');assert.equal(run('stepOut()'),'<div class="workoutbody"></div>');

// Compare identical 300-workout histories with explicit versus inferred muscles.
// Generous timing allowance absorbs host jitter; call counts also enforce O(lookups),
// not O(lookups * catalog size), without relying on wall time alone.
run('state.exerciseBook=Array.from({length:30},(_,i)=>({id:"perf"+i,name:"Meine Bankdrücken Variante "+i,target:0}));state.workouts=Array.from({length:300},(_,i)=>({id:"perf-w"+i,name:"Fixture",date:today(),finished:true,exercises:state.exerciseBook.map((b,j)=>({id:"perf-e"+i+"-"+j,exerciseId:b.id,name:b.name,sets:[setFixture()]}))}));var realMuscleName=muscleExerciseName;var normalizationCalls=0;muscleExerciseName=function(name){normalizationCalls++;return realMuscleName(name)}');
const clock=require('node:perf_hooks').performance;
const measure=source=>{const start=clock.now();run(source);return clock.now()-start};
run('for(var b of state.exerciseBook)b.muscles=["chest"]');
measure('muscleCounts(completedWorkouts())');
const baseCounts=measure('muscleCounts(completedWorkouts())');
const baseMetrics=measure('buildProgressMetrics()');
run('for(var b of state.exerciseBook)delete b.muscles;normalizationCalls=0');
const inferredCounts=measure('muscleCounts(completedWorkouts())');
assert.equal(run('normalizationCalls'),9000);
run('normalizationCalls=0');
const inferredMetrics=measure('buildProgressMetrics()');
assert.equal(run('normalizationCalls'),18000);
assert(inferredCounts<baseCounts*15+200,'muscleCounts too slow: '+inferredCounts.toFixed(1)+' ms vs '+baseCounts.toFixed(1)+' ms');
assert(inferredMetrics<baseMetrics*5+500,'buildProgressMetrics too slow: '+inferredMetrics.toFixed(1)+' ms vs '+baseMetrics.toFixed(1)+' ms');
assert.equal(run('JSON.stringify(muscleCounts(completedWorkouts()))'),'[["chest",9000]]');
console.log('PASS: 300 workouts / 30 exercises: muscleCounts '+baseCounts.toFixed(1)+' -> '+inferredCounts.toFixed(1)+' ms; progress metrics '+baseMetrics.toFixed(1)+' -> '+inferredMetrics.toFixed(1)+' ms (explicit -> inferred).');
console.log('PASS: custom muscle rules, cached catalog/name lookup, manual precedence, derived creation/renames, lossless backups, orphan exercise rendering, weekly sets and translations.');
`,{require,console,process},{filename:'exercise-muscles-harness'});
