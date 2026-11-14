// Refactor Phase 4, Schritt 9: home ist eine Funktion (js/app.js) und ruft den Kern homeDesign aus js/design-system.js, sobald er geladen ist; vorher liefert sie einen leeren Text.
// Die frühere Kette aus 9 wirksamen Definitionen (app, enhancements, experience, portions, insights, flows, flows, refinement, design-system) ist bis auf den Kern aus
// design-system.js entfernt. Entscheidung: Die Zwischenstände von home() während des Ladens sind verzichtbar (home() liefert nur einen Text; render() ruft sie beim Laden mehrfach,
// jeder Aufruf wird beim nächsten Rendern überschrieben); maßgeblich ist, was nach dem vollständigen Laden gilt.
// Beleg „alt = neu“: tests/fixtures/home-order.json wurde an der alten Kette (Commit 5b1e0a1) aufgezeichnet und seitdem NICHT verändert. Verglichen wird:
//   - für 11 Ladevarianten (leer, Erststart, 8 gespeicherte Zustände, Englisch): Seite, Zustand (SHA-256) und sichtbarer Inhalt direkt nach dem Laden; beim Laden entsteht keine Ausnahme;
//   - für viele Zustände nach dem Laden (home() und render()): Glieder, HTML (Länge und SHA-256) und Zustand.
// Das Feld „laden“ des Golden (die 29 home()-Aufrufe beim Laden mit den alten Teilketten) bleibt als Aufzeichnung der alten Kette stehen und wird nur noch so geprüft:
// Aufrufe ab design-system.js sind gleich wie früher, alle früheren Aufrufe liefern jetzt einen leeren Text.
//   node tests/check-home-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben, sonst geht der Beleg verloren)
// Das Golden hängt nicht von der App-Version und nicht von der Uhrzeit ab: Anzeigeversion wird normalisiert, die Uhr der App steht fest.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/home-order.json',OLD_COMMIT='5b1e0a1',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// Name im neuen Code -> Bezeichnung (Datei#Nr. der Definition in der alten Kette).
const LABEL=new Map([['homeDesign','design-system#1']]);

// Jeder Eintritt in ein Glied wird gemeldet; __homeCall umhüllt die beiden Aufrufstellen (renderBase, renderExperience) und meldet den Rückgabewert.
const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};globalThis.__cur=${JSON.stringify(file)};`
 +`globalThis.__fp=globalThis.__fp||function(s){s=String(s).replace(/Version \\d{3,}/g,'Version 100').replace(/\\?v=\\d+/g,'?v=100');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return s.length+':'+h.toString(16)};`
 +`globalThis.__homeCall=globalThis.__homeCall||function(){__ev('call@'+globalThis.__cur);const r=home();__ev('ret '+__fp(r));return r};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});
const callSites=text=>text.replace(/\?home\(\)/g,'?__homeCall()');

// Alter Code: Definitionen `function home(){`, `home=function(){` und die Pfeilfunktion aus enhancements.js melden sich beim Eintritt (Datei#Nr. in Textreihenfolge).
function instrumentOld(file,text){
 let nr=0;const key=fileKey(file);
 text=text.replace(/function home\(\)\{|(?<![.\w$])home=function\(\)\{|home=\(\)=>goalCard\(\)\+originalHome\(\)/g,m=>{
  const label=`${key}#${++nr}`;
  return m.startsWith('home=()=>')?`home=()=>{__ev('${label}');return goalCard()+originalHome()}`:m+`__ev('${label}');`;
 });
 return PREFIX(file)+callSites(text);
}
// Neuer Code: Der Kern homeDesign meldet sich beim Eintritt; weitere home-Glieder darf es nicht mehr geben.
function instrumentNew(file,text){
 text=text.replace(/function (home\w+)\(([^)]*)\)\{/g,(m,name)=>{
  if(!LABEL.has(name))throw Error('Unbekanntes home-Glied: '+name);return m+`__ev(${JSON.stringify(LABEL.get(name))});`;
 });
 return PREFIX(file)+callSites(text);
}
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

// Zustände nach dem Laden: Setup-Code läuft in der App vor jedem Aufruf. kind 'page' liefert home(), kind 'render' den Inhalt nach render().
const RESET="date='2026-11-13';page='home';sessionWorkoutId=null;completionId=null;accountSection='';trainTab='current'";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const DAY='2026-11-13',T0=NOW-25*60000;
const PROFILE="state.profile={age:30,height:180,weight:82,target:75,sex:'male',activity:1.375,method:'mifflin'};state.plan.direction='lose';";
const WEIGHTS="state.weights=[{id:'w1',date:'2026-11-01',kg:84},{id:'w2',date:'2026-11-12',kg:82.2},{id:'w3',date:'2026-11-13',kg:82}];";
const FOODS=`state.foods=[{id:'f1',date:'${DAY}',meal:'Frühstück',name:'Skyr',grams:250,kcal:160,p:27,c:10,f:1,nutrients:{}},{id:'f2',date:'${DAY}',meal:'Snacks',name:'Trinkwasser',grams:500,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:500}},{id:'f3',date:'2026-11-12',meal:'Abendessen',name:'Reis',grams:200,kcal:260,p:5,c:56,f:1,nutrients:{}}];`;
const finished=(id,date,name)=>`{id:'${id}',date:'${date}',name:'${name}',finished:true,startedAt:${T0},finishedAt:${T0+3600000},durationSeconds:3600,exercises:[{id:'e${id}',exerciseId:'bench',name:'Bankdrücken',sets:[{kg:60,reps:8,done:true},{kg:62.5,reps:6,done:true}]}]}`;
const HISTORY=`state.workouts=[${finished('h1',DAY,'Push')},${finished('h2','2026-11-12','Pull')},${finished('h3','2026-11-10','Push')}];`;
const ACTIVE=`state.workouts=[{id:'a1',date:'${DAY}',name:'Aktiv',finished:false,startedAt:${T0},exercises:[{id:'ea',exerciseId:'bench',name:'Bankdrücken',sets:[{kg:60,reps:8,done:true},{kg:'',reps:'',done:false}]}]}];`;
const ROUTINES="state.routines=[{id:'r1',name:'Push',favorite:true,exercises:[{exerciseId:'bench',sets:3,min:6,max:10,restSeconds:90}]},{id:'r2',name:'Pull',exercises:[{exerciseId:'row',sets:3,min:8,max:12}]}];";
const RUNS=`state.runs=[{id:'run-a',date:'${DAY}',distanceKm:5.2,durationSeconds:1800,type:'easy',startedAt:${T0},createdAt:${T0+1800000}}];`;
const scenarios=[];
const add=(name,setup,kind='page')=>scenarios.push({name,setup,kind});
for(const name of Object.keys(CASES)){add('zustand:'+name,loadState(name));add('en:'+name,loadState(name)+"state.language='en';");add('render:'+name,loadState(name),'render')}
const FULL=loadState('full')+PROFILE+WEIGHTS+FOODS+ROUTINES;
add('voll',FULL);add('voll-en',FULL+"state.language='en';");add('voll-render',FULL,'render');
add('verlauf',FULL+HISTORY);add('verlauf-en',FULL+HISTORY+"state.language='en';");add('verlauf-render',FULL+HISTORY,'render');
add('aktiv',FULL+ACTIVE);add('aktiv-render',FULL+ACTIVE,'render');
add('laeufe',FULL+HISTORY+RUNS);add('laeufe-render',FULL+HISTORY+RUNS,'render');
add('anderer-tag',FULL+HISTORY+"date='2026-11-12';");add('leerer-tag',FULL+HISTORY+"date='2026-11-20';");
add('ohne-profil',loadState('initial')+WEIGHTS+FOODS);add('ohne-gewicht',loadState('initial')+PROFILE+FOODS);add('ohne-essen',loadState('initial')+PROFILE+WEIGHTS);
add('wasserziel',FULL+"state.waterGoal=2500;");add('manuell',FULL+"state.plan.mode='manual';state.goals={kcal:1800,p:140,c:180,f:60};");
add('ueber-ziel',FULL+"state.plan.mode='manual';state.goals={kcal:100,p:10,c:10,f:5};");
add('zeitraum-woche',FULL+WEIGHTS+"state.chartPeriod='week';");add('zeitraum-alles',FULL+WEIGHTS+"state.chartPeriod='all';");
add('linien-aus',FULL+"state.chartLines={weight:false,strength:false,kcal:false};");
for(const design of ['classic','apple','cronometer','liftoff','hevy','aurora','mono','unbekannt'])add('design:'+design,FULL+HISTORY+`state.appDesign='${design}';`);
for(const scheme of ['light','dark','system'])add('schema:'+scheme,FULL+`state.colorScheme='${scheme}';state.display={...(state.display||{}),scheme:'${scheme}'};`);
add('page-food',FULL+"page='food';",'render');add('page-workout',FULL+"page='workout';",'render');add('page-account',FULL+"page='account';",'render');

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'beim Laden entsteht eine Ausnahme oder ein Skript läuft im Stub nicht');
 const log=app.ctx.__log,result={laden:[...log]};
 const fp=text=>sha(String(text).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100'));
 result.nachLaden={page:app.run('page'),inhalt:fp(app.run("$('content').innerHTML")),zustand:sha(app.run('JSON.stringify(state)').replace(UUID,'UUID'))};
 if(options.skipScenarios)return result;
 result.faelle={};
 for(const s of scenarios){
  log.length=0;
  let html;
  try{
   app.run(RESET+';'+s.setup);log.length=0;
   html=s.kind==='render'?(app.run('render()'),app.run("$('content').innerHTML")):app.run('home()');
  }catch(error){throw Error(`${s.name}: unerwartete Ausnahme: ${error.message}`)}
  const text=String(html).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100');
  result.faelle[s.name]={ablauf:log.join(' '),laenge:text.length,sha256:sha(text),zustand:sha(app.run('JSON.stringify([date,page,state])').replace(UUID,'UUID'))};
 }
 return result;
}
// Ladevarianten: der Zustand beim Laden bestimmt, was nach dem Laden sichtbar ist.
const stored=(name,extra='')=>{const s=JSON.parse(JSON.stringify(CASES[name]));if(extra==='en')s.language='en';return {'puls-v1':JSON.stringify(s)}};
const VARIANTS={standard:{},erststart:{search:'?erststart=1'},...Object.fromEntries(Object.keys(CASES).map(n=>['gespeichert:'+n,{storage:stored(n),skipScenarios:true}])),
 'gespeichert:full-en':{storage:stored('full','en'),skipScenarios:true}};
const all=mode=>Object.fromEntries(Object.entries(VARIANTS).map(([name,options])=>[name,protocol(mode,options)]));

if(process.argv.includes('--record-old')){
 const data=all('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,varianten:data},null,1)+'\n');
 const n=Object.values(data).reduce((a,v)=>a+1+Object.keys(v.faelle||{}).length,0);
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data).length} Ladevarianten, ${n} Zustände insgesamt, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: home ist nur in js/app.js deklariert; Zuweisungen gibt es keine mehr (der Kern homeDesign steht in js/design-system.js).
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+home\s*\(/.test(code(f))),['js/app.js'],'home darf nur in js/app.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+homeDesign\s*\(/.test(code(f))),['js/design-system.js'],'homeDesign steht nur in js/design-system.js');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])home\s*=\s*(?:async\s*)?(?:function\b|\()/.test(code(f))),[],'home wird von keiner Datei mehr umhüllt');
assert.deepEqual(jsFiles.filter(f=>/=\s*home\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte home-Funktion fest');
assert.deepEqual(jsFiles.filter(f=>/homeSetCore|homeAddLayer|homeCore|homeLayers?\b|homeBase/.test(code(f))),[],'keine Reste der früheren home-Kette');

// 2. Nach dem Laden wie die alte Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=all('new');
if(process.argv.includes('--accept-ui')){const f=l=>l.indexOf('call@js/design-system.js');require('./accept-ui.cjs')(FIXTURE,golden,{alt:golden.alt,varianten:Object.fromEntries(Object.entries(now).map(([k,v])=>[k,{...v,laden:[...golden.varianten[k].laden.slice(0,f(golden.varianten[k].laden)),...v.laden.slice(f(v.laden))]}]))},{html:['laenge','sha256','inhalt'],mask:/ret (?!0:)\d+:[0-9a-f]+/g});process.exit(0)} // nur HTML-Werte neu, nach gewollter UI-Änderung
assert.deepEqual(Object.keys(now),Object.keys(golden.varianten),'Ladevarianten weichen vom Golden ab');
let count=0;
for(const [variant,expected] of Object.entries(golden.varianten)){
 const got=now[variant];
 assert.deepEqual(got.nachLaden,expected.nachLaden,`${variant}: Zustand, Seite oder sichtbarer Inhalt direkt nach dem Laden weichen von der alten Kette (${golden.alt}) ab`);
 // Beim Laden: ab design-system.js wie früher, davor leerer Text statt der früheren Teilketten.
 const from=log=>log.indexOf('call@js/design-system.js');
 assert(from(expected.laden)>=0&&from(got.laden)>=0,`${variant}: home() läuft in design-system.js`);
 assert.deepEqual(got.laden.slice(from(got.laden)),expected.laden.slice(from(expected.laden)),`${variant}: home() ab design-system.js weicht von der alten Kette ab`);
 const before=got.laden.slice(0,from(got.laden));
 assert(before.some(e=>e.startsWith('call@')),`${variant}: home() läuft beim Laden auch früher`);
 assert.deepEqual(before.filter(e=>e.startsWith('ret ')&&e!=='ret 0:811c9dc5'),[],`${variant}: früher als design-system.js liefert home() einen leeren Text`);
 assert.deepEqual(before.filter(e=>!e.startsWith('call@')&&!e.startsWith('ret ')),[],`${variant}: früher als design-system.js läuft kein home-Glied`);
 count++;
 if(!expected.faelle)continue;
 assert.deepEqual(Object.keys(got.faelle),Object.keys(expected.faelle),`${variant}: Zustände weichen vom Golden ab`);
 for(const [name,e] of Object.entries(expected.faelle)){
  const g=got.faelle[name];count++;
  assert.equal(g.ablauf,e.ablauf,`${variant}/${name}: Reihenfolge der Glieder weicht ab`);
  assert.equal(g.laenge,e.laenge,`${variant}/${name}: Länge des HTML weicht ab`);
  assert.equal(g.sha256,e.sha256,`${variant}/${name}: HTML weicht von der alten Kette ab`);
  assert.equal(g.zustand,e.zustand,`${variant}/${name}: Zustand danach weicht ab`);
 }
}
console.log(`PASS: home ist eine Funktion mit dem Kern aus design-system.js; ${count} Läufe (${Object.keys(golden.varianten).length} Ladevarianten ohne Ausnahme, Zustände und HTML nach dem Laden) gleich wie die alte Kette.`);
