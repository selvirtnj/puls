// Refactor Phase 4, Schritt 2: accountPage ist eine Funktion (js/experience.js); die frühere Kette aus 20 Gliedern besteht aus benannten
// Gliedern in ihren Dateien (accountPageBase in flows.js, accountPageAfter… je Datei; jedes bekommt den HTML-Text des Vorgängers und gibt den neuen zurück).
// Beleg „alt = neu“: tests/fixtures/accountpage-order.json enthält für die Ladezeit und für viele Zustände (Sprache, Profil, Unterseiten, Anmeldung, Erststart)
// die Reihenfolge der Glieder und den zurückgegebenen HTML-Text (Länge und SHA-256). Aufgezeichnet an der alten Kette (Commit fa69804):
//   node tests/check-accountpage-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Die Uhr der App steht fest (NOW), damit Datumstexte stabil sind.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/accountpage-order.json',OLD_COMMIT='fa69804',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// [Datei, Nr. des alten Wrappers in der Datei, Name des neuen Glieds]. experience (Kern, Anhang), finish, personal und navigation lagen in der alten
// Kette unter flows.js#1, das accountPage ohne Aufruf des Vorgängers ersetzte; sie liefen nie und sind weggefallen (der Test sähe sie sonst im alten Ablauf).
const GLIEDER=[
 ['flows',1,'accountPageAfterFlowsPlan'],['flows',2,'accountPageAfterFlowsDesign'],['flows',3,'accountPageAfterFlowsLayout'],['flows',4,'accountPageAfterFlowsStreak'],
 ['interactions',1,'accountPageAfterInteractions'],['workout-polish',1,'accountPageAfterWorkoutPolish'],['comfort',1,'accountPageAfterComfort'],
 ['tracker-tools',1,'accountPageAfterTrackerTools'],['adaptation',1,'accountPageAfterAdaptation'],['cloud',1,'accountPageAfterCloud'],
 ['account-guide',1,'accountPageAfterAccountGuide'],['refinement',1,'accountPageAfterRefinement'],['account-refresh',1,'accountPageAfterAccountRefresh'],
 ['quick-account',1,'accountPageAfterQuickAccount']
];
const LABEL=new Map(GLIEDER.map(([file,nr,name])=>[name,`${file}#${nr}`]));LABEL.set('accountPageBase','kern:flows');

const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};__ev('@'+${JSON.stringify(file)});`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');try{return fn.apply(this,a)}finally{__ev(name+'<')}}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Wrapper hält seinen Vorgänger als `const x=accountPage;`; der Test meldet „>“ vor und „<“ nach dessen Aufruf.
// Die Umwandlung der Antwort passiert nach dem Aufruf des Vorgängers; darum zählt nur „<“. Kerne melden sich selbst.
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=accountPage;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(`${fileKey(file)}#${++nr}`)},accountPage);`);
 if(file==='js/experience.js')text=text.replace('function accountPage(){return `<div class="dashboardstack">',"function accountPage(){__ev('kern:experience');return `<div class=\"dashboardstack\">");
 if(file==='js/flows.js')text=text.replace('accountPage=function(){let p=state.profile,erhalt=',"accountPage=function(){__ev('kern:flows');let p=state.profile,erhalt=");
 return PREFIX(file)+text;
}
// Neuer Code: Jedes Glied meldet sich beim Eintritt.
function instrumentNew(file,text){
 // Das frühere „Ende des Vorgängers“ meldeten die Wrapper selbst; im neuen Code melden es hier rerun() von account-guide.js (zweiter Aufruf des Vorgängers)
 // und accountRefreshBase() von account-refresh.js (quick-account.js ruft es für „Konto verwalten“ auf).
 if(file==='js/experience.js')text=text.replace('()=>accountPageBuild(i)',()=>`()=>{const r=accountPageBuild(i);__ev(${JSON.stringify(Object.fromEntries(LABEL))}[accountPageSteps[i]]);return r}`);
 if(file==='js/account-refresh.js')text=text.replace("const accountRefreshBase=()=>accountPageBuild(accountPageSteps.indexOf('accountPageAfterAccountRefresh'));",()=>"const accountRefreshBase=()=>{const r=accountPageBuild(accountPageSteps.indexOf('accountPageAfterAccountRefresh'));__ev('account-refresh#1');return r};");
 text=text.replace(/globalThis\.(accountPage(?:Base|After\w+))=function \1\(([^)]*)\)\{/g,(m,name)=>m+`__ev(${JSON.stringify(LABEL.get(name))});`);
 return PREFIX(file)+text;
}
const canon=events=>[...events].filter(e=>!/>$/.test(e)).map(e=>e.replace(/<$/,''));

// Zustände: Setup-Code läuft in der App vor jedem Aufruf. kind 'page' liefert accountPage(), kind 'render' den Inhalt nach render().
const RESET="accountSection='';qaPage='';qaParent='';qaRatioOpen=false;cloudSession=null;page='home'";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const PROFILE="state.profile={age:30,height:180,weight:82,target:75,sex:'male',activity:1.375,method:'mifflin'};state.plan.direction='lose';";
const WEIGHTS="state.weights=[{id:'w1',date:'2026-11-01',kg:84},{id:'w2',date:'2026-11-05',kg:83.4},{id:'w3',date:'2026-11-10',kg:82.6},{id:'w4',date:'2026-11-12',kg:82.2}];";
const WORKOUTS="state.workouts=[{id:'a',date:'2026-11-12',name:'Gym',finished:true,exercises:[{id:'e1',name:'Bench',sets:[{kg:40,reps:8,done:true}]}]},{id:'b',date:'2026-11-13',name:'Gym',finished:true,exercises:[{id:'e2',name:'Squat',sets:[{kg:60,reps:5,done:true}]}]}];";
const SESSION="cloudSession={user:{email:'a@example.test',id:'u1'},expires_at:9e9};";
const scenarios=[];
const add=(name,setup,kind='page')=>scenarios.push({name,setup,kind});
for(const name of Object.keys(CASES))add('zustand:'+name,loadState(name));
for(const name of ['initial','full','mit-profil-und-trainingsplan'])add('en:'+name,loadState(name)+"state.language='en';");
add('profil',loadState('initial')+PROFILE+WEIGHTS+WORKOUTS+"state.displayName='Selvir';state.email='s@example.test';");
add('profil-avatar',loadState('mit-profil-und-trainingsplan')+WEIGHTS+WORKOUTS+"state.avatarImage='data:image/png;base64,AAAA';state.colorTheme='blue';");
add('profil-en',loadState('initial')+PROFILE+WEIGHTS+WORKOUTS+"state.language='en';state.displayName='  ';");
add('ton-aus',loadState('full')+"state.soundEnabled=false;state.appDesign='liftoff';");
for(const key of ['plan','body','adaptive','design','sounds','manage','unbekannt']){
 add('bereich:'+key,loadState('full')+PROFILE+WEIGHTS+WORKOUTS+`accountSection='${key}';`);
 add('bereich-en:'+key,loadState('mit-profil-und-trainingsplan')+WEIGHTS+`state.language='en';accountSection='${key}';`);
}
for(const key of ['account','profile','targets','display','unbekannt'])add('qa:'+key,loadState('full')+PROFILE+`qaPage='${key}';`);
add('qa-eltern-body',loadState('full')+PROFILE+"accountSection='body';qaParent='targets';");
add('qa-eltern-plan',loadState('full')+PROFILE+"accountSection='plan';qaParent='account';");
add('qa-bereich-vor-seite',loadState('full')+PROFILE+"accountSection='design';qaPage='profile';");
add('anmeldung',loadState('full')+PROFILE+SESSION);
add('anmeldung-manage',loadState('full')+PROFILE+SESSION+"accountSection='manage';");
add('anmeldung-qa',loadState('full')+SESSION+"qaPage='account';");
add('render:konto',loadState('full')+PROFILE+WEIGHTS+WORKOUTS+"page='account';",'render');
add('render:konto-bereich',loadState('full')+PROFILE+"page='account';accountSection='manage';",'render');
add('render:konto-en',loadState('mit-profil-und-trainingsplan')+"state.language='en';page='account';",'render');

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 const log=app.ctx.__log,result={};
 // Während des Ladens darf kein accountPage laufen (page ist dann „home“); alles, was auftaucht, wird festgehalten.
 result.laden=canon(log.filter(e=>!e.startsWith('@')));
 const sections=options.search?[{name:'erststart',setup:loadState('initial')+PROFILE,kind:'page'},{name:'erststart-render',setup:loadState('initial')+"page='account';",kind:'render'}]:scenarios;
 result.faelle={};
 for(const s of sections){
  log.length=0;
  let html;
  try{
   app.run(RESET+';'+s.setup);
   html=s.kind==='render'?(app.run('render()'),app.run("$('content').innerHTML")):app.run('accountPage()');
  }catch(error){html='!'+error.message}
  const text=String(html).replace(/Version \d{3,}/g,'Version 100'); // Golden entstand bei Version 100; die Anzeigeversion darf weiterzählen
  result.faelle[s.name]={ablauf:canon(log.filter(e=>!e.startsWith('@'))).join(' '),laenge:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex'),
   zustand:app.run('[accountSection,qaPage,qaParent].join("|")')};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: accountPage ist nur in js/experience.js deklariert und wird nirgends mehr überschrieben.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+accountPage\s*\(/.test(code(f))),['js/experience.js'],'accountPage darf nur in js/experience.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])accountPage\s*=(?!=)/.test(code(f))),[],'accountPage wird nirgends mehr überschrieben');
assert.deepEqual(jsFiles.filter(f=>/=\s*accountPage\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte accountPage-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
assert.deepEqual(Object.keys(now.standard.faelle),Object.keys(golden.standard.faelle),'Zustände weichen vom Golden ab');
for(const group of ['standard','erststart']){
 assert.deepEqual(now[group].laden,golden[group].laden,`${group}: Aufrufe von accountPage während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  assert.equal(got.ablauf,expected.ablauf,`${group}/${name}: Reihenfolge der Glieder weicht von der alten Kette (${golden.alt}) ab`);
  assert.equal(got.zustand,expected.zustand,`${group}/${name}: accountSection/qaPage/qaParent danach weichen ab`);
  assert.equal(got.laenge,expected.laenge,`${group}/${name}: Länge des HTML weicht ab`);
  assert.equal(got.sha256,expected.sha256,`${group}/${name}: HTML weicht von der alten Kette ab`);
 }
}
const full=Object.values(golden.standard.faelle).find(f=>f.ablauf.startsWith('kern:flows')).ablauf.split(' ');
assert.equal(full[0],'kern:flows');assert.equal(full.at(-1),'quick-account#1');
console.log(`PASS: accountPage ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Zustände liefern Ablauf und HTML wie die alte Kette (${full.length} Glieder im Vollauf).`);
