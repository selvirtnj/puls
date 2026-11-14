// Refactor Phase 4, Schritt 4: workoutPage ist eine Funktion (js/flows.js); die frühere Kette aus 14 Gliedern besteht aus dem Kern workoutPageBase (flows.js)
// und fünf benannten Gliedern in ihren Dateien (workoutPageAfter…, je Datei; jedes bekommt den HTML-Text des Vorgängers und gibt den neuen zurück).
// Beleg „alt = neu“: tests/fixtures/workoutpage-order.json enthält für die Ladezeit und für viele Zustände (Sprache, Routinen, Verlauf, aktives Workout,
// Lauf, Tabs, Kalender, Erststart) die Reihenfolge der Glieder, den zurückgegebenen HTML-Text (Länge und SHA-256) und den Zustand danach.
// Aufgezeichnet an der alten Kette (Commit f1c5541):
//   node tests/check-workoutpage-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Das Golden hängt nicht von der App-Version (Version N, ?v=N) und nicht von der Uhrzeit ab: Anzeigeversion wird normalisiert, die Uhr der App steht fest.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/workoutpage-order.json',OLD_COMMIT='f1c5541',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// [Datei, Nr. des alten Wrappers in der Datei (nur `const x=workoutPage;` zählt), Name des neuen Glieds]. Der Kern der alten Kette war flows.js#3 (workoutPage=function…),
// er rief seinen Vorgänger nie. Darunter lagen app.js (Kern), enhancements, training (Ersatz), insights, finish (Ersatz), personal, flows#1 und flows#2; sie liefen nie und sind weggefallen.
const GLIEDER=[
 ['tracker-tools',1,'workoutPageAfterTrackerTools'],['account-guide',1,'workoutPageAfterAccountGuide'],['refinement',1,'workoutPageAfterRefinement'],
 ['training-polish',1,'workoutPageAfterTrainingPolish'],['running',1,'workoutPageAfterRunning']
];
const LABEL=new Map(GLIEDER.map(([file,nr,name])=>[name,`${file}#${nr}`]));LABEL.set('workoutPageBase','kern:flows');

const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};__ev('@'+${JSON.stringify(file)});`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');const r=fn.apply(this,a);__ev(name+'<');return r}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Wrapper hält seinen Vorgänger als `const x=workoutPage;`; der Test meldet „>“ vor und „<“ nach dessen normaler Rückkehr (wirft der Vorgänger, läuft das Glied nicht). Die Umwandlung der Antwort
// passiert nach dem Aufruf des Vorgängers; darum zählt nur „<“. Kerne und Ersatz-Funktionen melden sich selbst (kern:…), auch die, die nie laufen.
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=workoutPage;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(`${fileKey(file)}#${++nr}`)},workoutPage);`);
 const kern={'js/app.js':['function workoutPage(){','app'],'js/training.js':['workoutPage=function(){','training'],'js/finish.js':['workoutPage=function(){','finish'],'js/flows.js':['workoutPage=function(){let tabs=','flows']};
 if(kern[file]){const [needle,name]=kern[file],at=text.lastIndexOf(needle);if(at<0)throw Error('Kern nicht gefunden: '+file);
  const brace=at+needle.indexOf('{')+1;text=text.slice(0,brace)+`__ev('kern:${name}');`+text.slice(brace)}
 return PREFIX(file)+text;
}
// Neuer Code: Jedes Glied meldet sich beim Eintritt.
function instrumentNew(file,text){
 text=text.replace(/function (workoutPage(?:Base|After\w+))\(([^)]*)\)\{/g,(m,name)=>LABEL.has(name)?m+`__ev(${JSON.stringify(LABEL.get(name))});`:m); // nur die Glieder der alten Kette
 return PREFIX(file)+text;
}
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const canon=events=>[...events].filter(e=>!/>$/.test(e)).map(e=>e.replace(/<$/,''));

// Zustände: Setup-Code läuft in der App vor jedem Aufruf. kind 'page' liefert workoutPage(), kind 'render' den Inhalt nach render().
const RESET="trainTab='current';calendarSelected='2026-11-13';calendarMonth='2026-11';date='2026-11-13';page='workout';sessionWorkoutId=null;completionId=null";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();state.workoutSettings??={restSeconds:120};`; // Letzteres setzt training.js beim Laden einmal auf den damaligen Zustand
const DAY='2026-11-13',T0=NOW-25*60000;
const ROUTINES="state.routines=[{id:'r1',name:'Push',favorite:true,exercises:[{exerciseId:'bench',sets:3,min:6,max:10,restSeconds:90}]},{id:'r2',name:'Pull',exercises:[{exerciseId:'row',sets:3,min:8,max:12},{exerciseId:'curl',sets:2,min:10,max:15}]},{id:'r3',name:'Beine',exercises:[{exerciseId:'squat',sets:1,min:5,max:5}]}];";
const finished=(id,date,name,extra='')=>`{id:'${id}',date:'${date}',name:'${name}',finished:true,startedAt:${T0-86400000*Number(id.slice(1))},finishedAt:${T0-86400000*Number(id.slice(1))+3600000},durationSeconds:3600,exercises:[{id:'e${id}',exerciseId:'bench',name:'Bankdrücken',sets:[{kg:60,reps:8,done:true},{kg:62.5,reps:6,done:true}]}]${extra}}`;
const HISTORY=`state.workouts=[${finished('h1',DAY,'Push')},${finished('h2','2026-11-12','Pull')},${finished('h3','2026-11-10','Push')},${finished('h4',DAY,'Beine')}];`;
const active=(id,sets,extra='')=>`{id:'${id}',date:'${DAY}',name:'Aktiv',finished:false,startedAt:${T0},exercises:[{id:'ea',exerciseId:'bench',name:'Bankdrücken',sets:${sets}}]${extra}}`;
const SETS="[{kg:60,reps:8,done:true},{kg:60,reps:7,done:false},{kg:'',reps:'',done:false}]";
const ACTIVE_NO_SETS=`state.workouts=[{id:'a0',date:'${DAY}',name:'Leer',finished:false,startedAt:${T0},exercises:[]}];`;
const ACTIVE=`state.workouts=[${active('a1',SETS)}];`;
const ACTIVE_REST=`state.workouts=[${active('a2',SETS,`,rest:{endAt:${NOW+75000}}`)}];`;
const ACTIVE_NOSTART=`state.workouts=[{id:'a3',date:'${DAY}',name:'Ohne Start',finished:false,exercises:[{id:'ea',exerciseId:'bench',name:'Bankdrücken',sets:${SETS}}]}];`;
const ACTIVE_PLUS_HISTORY=`state.workouts=[${active('a4',SETS)},${finished('h1',DAY,'Push')},${finished('h2','2026-11-12','Pull')}];`;
const RUNS=`state.runs=[{id:'run-a',date:'${DAY}',distanceKm:5.2,durationSeconds:1800,type:'easy',startedAt:${T0},createdAt:${T0+1800000}},{id:'run-b',date:'2026-11-10',distanceKm:8,durationSeconds:2900,type:'easy',startedAt:${T0-86400000*3},createdAt:${T0-86400000*3+2900000}}];`;
const ACTIVERUN=`state.activeRun={startedAt:${NOW-600000},pausedAt:null,pausedSeconds:0,type:'easy'};`;
const scenarios=[];
const add=(name,setup,kind='page')=>scenarios.push({name,setup,kind});
for(const name of Object.keys(CASES))add('zustand:'+name,loadState(name));
for(const name of ['initial','full','mit-profil-und-trainingsplan'])add('en:'+name,loadState(name)+"state.language='en';");
add('routinen',loadState('initial')+ROUTINES);
add('routinen-en',loadState('initial')+ROUTINES+"state.language='en';");
add('routinen-pause',loadState('initial')+ROUTINES+"state.workoutSettings.restSeconds=90;");
add('verlauf',loadState('initial')+ROUTINES+HISTORY);
add('verlauf-en',loadState('initial')+ROUTINES+HISTORY+"state.language='en';");
add('verlauf-anderer-tag',loadState('initial')+ROUTINES+HISTORY+"date='2026-11-12';");
add('aktiv-ohne-saetze',loadState('initial')+ROUTINES+ACTIVE_NO_SETS);
add('aktiv',loadState('initial')+ROUTINES+ACTIVE);
add('aktiv-en',loadState('initial')+ROUTINES+ACTIVE+"state.language='en';");
add('aktiv-pausenuhr',loadState('initial')+ROUTINES+ACTIVE_REST);
add('aktiv-pausenuhr-abgelaufen',loadState('initial')+ROUTINES+ACTIVE_REST.replace(String(NOW+75000),String(NOW-5000)));
add('aktiv-ohne-startzeit',loadState('initial')+ROUTINES+ACTIVE_NOSTART);
add('aktiv-und-verlauf',loadState('initial')+ROUTINES+ACTIVE_PLUS_HISTORY);
add('aktiv-anderer-tag',loadState('initial')+ROUTINES+ACTIVE+HISTORY.replace('state.workouts=[','state.workouts=[...state.workouts,')+"date='2026-11-12';");
add('lauf-aktiv',loadState('initial')+ROUTINES+ACTIVERUN);
add('lauf-aktiv-en',loadState('initial')+ROUTINES+ACTIVERUN+"state.language='en';");
add('lauf-aktiv-und-workout',loadState('initial')+ROUTINES+ACTIVE+ACTIVERUN);
add('laeufe-und-verlauf',loadState('initial')+ROUTINES+HISTORY+RUNS);
add('laeufe-und-aktiv',loadState('initial')+ROUTINES+ACTIVE_REST+RUNS);
add('design-classic',loadState('full')+"state.appDesign='classic';");
add('design-liftoff',loadState('full')+ROUTINES+HISTORY+"state.appDesign='liftoff';");
add('favoriten',loadState('full')+ROUTINES+"state.routines.forEach(r=>{r.favorite=r.id!=='r1'});");
add('favoriten-keine',loadState('full')+ROUTINES+"state.routines.forEach(r=>{delete r.favorite});");
add('favoriten-en',loadState('full')+ROUTINES+"state.language='en';");
for(const tab of ['routines','calendar','insights','records','unbekannt']){
 add('tab:'+tab+':leer',loadState('initial')+`trainTab='${tab}';`);
 add('tab:'+tab+':verlauf',loadState('full')+ROUTINES+HISTORY+RUNS+`trainTab='${tab}';`);
 add('tab:'+tab+':verlauf-en',loadState('full')+ROUTINES+HISTORY+RUNS+`state.language='en';trainTab='${tab}';`);
 add('tab:'+tab+':aktiv',loadState('initial')+ROUTINES+ACTIVE_REST+RUNS+`trainTab='${tab}';`);
}
add('kalender:tag-mit-workout',loadState('initial')+ROUTINES+HISTORY+"trainTab='calendar';calendarSelected='2026-11-12';");
add('kalender:tag-mit-zwei-workouts',loadState('initial')+ROUTINES+HISTORY+"trainTab='calendar';calendarSelected='2026-11-13';");
add('kalender:tag-mit-lauf',loadState('initial')+ROUTINES+HISTORY+RUNS+"trainTab='calendar';calendarSelected='2026-11-10';");
add('kalender:leerer-tag',loadState('initial')+ROUTINES+HISTORY+RUNS+"trainTab='calendar';calendarSelected='2026-11-20';");
add('kalender:anderer-monat',loadState('initial')+ROUTINES+HISTORY+RUNS+"trainTab='calendar';calendarMonth='2026-10';calendarSelected='2026-10-05';");
add('kalender:en',loadState('initial')+ROUTINES+HISTORY+RUNS+"state.language='en';trainTab='calendar';calendarSelected='2026-11-13';");
add('render:training',loadState('full')+ROUTINES+HISTORY+"page='workout';",'render');
add('render:training-aktiv',loadState('initial')+ROUTINES+ACTIVE_REST+RUNS+"page='workout';",'render');
add('render:training-lauf',loadState('initial')+ROUTINES+ACTIVERUN+"page='workout';",'render');
add('render:training-en',loadState('full')+ROUTINES+HISTORY+"state.language='en';page='workout';",'render');
add('render:kalender',loadState('full')+ROUTINES+HISTORY+RUNS+"page='workout';trainTab='calendar';calendarSelected='2026-11-13';",'render');
add('render:routinen',loadState('full')+ROUTINES+"page='workout';trainTab='routines';",'render');
add('render:fortschritt',loadState('full')+ROUTINES+HISTORY+"page='workout';trainTab='insights';",'render');
add('go:training',loadState('full')+ROUTINES+HISTORY+"page='home';go('workout');",'render');

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 const log=app.ctx.__log,result={};
 // Während des Ladens darf kein workoutPage laufen (page ist dann „home“); alles, was auftaucht, wird festgehalten.
 result.laden=canon(log.filter(e=>!e.startsWith('@')));
 const sections=options.search?[{name:'erststart',setup:loadState('initial'),kind:'page'},{name:'erststart-render',setup:loadState('initial')+"page='workout';",kind:'render'},{name:'erststart-kalender',setup:loadState('initial')+"trainTab='calendar';",kind:'page'}]:scenarios;
 result.faelle={};
 for(const s of sections){
  log.length=0;
  let html;
  try{
   app.run(RESET+';'+s.setup);
   html=s.kind==='render'?(app.run('render()'),app.run("$('content').innerHTML")):app.run('workoutPage()');
  }catch(error){html='!'+error.message}
  const text=String(html).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100'); // Anzeigeversion und Cache-Parameter dürfen weiterzählen
  result.faelle[s.name]={ablauf:canon(log.filter(e=>!e.startsWith('@'))).join(' '),laenge:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex'),
   zustand:crypto.createHash('sha256').update(app.run('JSON.stringify([trainTab,calendarSelected,calendarMonth,date,page,state])').replace(UUID,'UUID')).digest('hex')};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: workoutPage ist nur in js/flows.js deklariert und wird nirgends mehr überschrieben.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+workoutPage\s*\(/.test(code(f))),['js/flows.js'],'workoutPage darf nur in js/flows.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])workoutPage\s*=(?!=)/.test(code(f))),[],'workoutPage wird nirgends mehr überschrieben');
assert.deepEqual(jsFiles.filter(f=>/=\s*workoutPage\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte workoutPage-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
if(process.argv.includes('--accept-ui')){require('./accept-ui.cjs')(FIXTURE,golden,{alt:golden.alt,...now},{html:['laenge','sha256']});process.exit(0)} // nur HTML-Werte neu, nach gewollter UI-Änderung
assert.deepEqual(Object.keys(now.standard.faelle),Object.keys(golden.standard.faelle),'Zustände weichen vom Golden ab');
for(const group of ['standard','erststart']){
 assert.deepEqual(now[group].laden,golden[group].laden,`${group}: Aufrufe von workoutPage während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  assert.equal(got.ablauf,expected.ablauf,`${group}/${name}: Reihenfolge der Glieder weicht von der alten Kette (${golden.alt}) ab`);
  assert.equal(got.laenge,expected.laenge,`${group}/${name}: Länge des HTML weicht ab`);
  assert.equal(got.sha256,expected.sha256,`${group}/${name}: HTML weicht von der alten Kette ab`);
  assert.equal(got.zustand,expected.zustand,`${group}/${name}: Zustand (trainTab, Datum, Seite, Daten) danach weicht ab`);
 }
}
const full=Object.values(golden.standard.faelle).find(f=>f.ablauf.startsWith('kern:flows')).ablauf.split(' ');
assert.equal(full[0],'kern:flows');assert.equal(full.at(-1),'running#1');
console.log(`PASS: workoutPage ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Zustände liefern Ablauf und HTML wie die alte Kette (${full.length} Glieder im Vollauf).`);
