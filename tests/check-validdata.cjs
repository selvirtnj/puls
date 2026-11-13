// Sicherheitsnetz für validData (Refactor Phase 0 und 3).
// Lädt die gesamte Web-App in echter index.html-Reihenfolge, sodass die WIRKSAME validData gilt, und prüft
// einen Fallkorpus (tests/fixtures/validdata/cases.json) gegen sie. Ohne Netz, ohne echte Profile.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {loadApp,scriptList,assignmentCount,read,sections,withoutSection}=require('./validdata-env.cjs');

// ---- 1. Genau eine Funktion -----------------------------------------------------------------------------
// Seit Phase 3 gibt es keine Wrapper-Kette mehr: validData wird einmal in js/app.js deklariert und nirgends ersetzt.
const scripts=scriptList(),jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js'));
const definitions=jsFiles.filter(f=>assignmentCount(read('js/'+f))>0).map(f=>f+' x'+assignmentCount(read('js/'+f)));
assert.deepEqual(definitions,['app.js x1'],'validData darf in js/ nur einmal definiert sein (js/app.js)');
// Jede Datei der Liste läuft im Stub fehlerfrei.
const base=loadApp();
assert.deepEqual(base.errors,[],'Skripte, die im Stub nicht laufen');
assert.equal(base.loaded.length,scripts.length);
// Abschnitte der Funktion: Aufbau („//§!“) und einzeln abschaltbare Prüfungen („//§“).
const parts=sections(),checks=parts.filter(s=>!s.structural);
assert.equal(parts.filter(s=>s.structural).length,2,'Vorbereitung und Rückschreiben der Optionen');
assert(checks.length>=27,'Abschnitte der validData: '+checks.length);

// ---- 2. Fallkorpus laden und auflösen ---------------------------------------------------------------------
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8'));
const names=new Set();for(const c of fixture.cases){assert(!names.has(c.name),'doppelter Fallname: '+c.name);names.add(c.name)}
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function resolve(x){
 if(Array.isArray(x))return x.map(resolve);
 if(x&&typeof x==='object'){
  if('$undefined' in x)return undefined;
  if('$num' in x)return Number(x.$num);
  if('$repeat' in x)return (x.$prefix||'')+x.$repeat[0].repeat(x.$repeat[1])+(x.$suffix||'');
  if('$fill' in x)return Array.from({length:x.$fill[1]},()=>resolve(clone(x.$fill[0])));
  return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,resolve(v)]));
 }
 return x;
}
function setPath(target,path,value){
 const parts=path.split('.');let node=target;
 for(let i=0;i<parts.length-1;i++){const part=parts[i];if(node[part]===undefined||node[part]===null||typeof node[part]!=='object')node[part]=/^d+$/.test(parts[i+1])?[]:{};node=node[part]}
 const last=parts.at(-1);if(value===undefined)delete node[last];else node[last]=value;
}
function build(c){
 if('raw' in c)return c.raw;
 const source=fixture.states[c.base];assert(source,'unbekannter Ausgangszustand '+c.base);
 const state=clone(source);
 for(const [path,value] of Object.entries(c.set||{}))setPath(state,path,resolve(value));
 for(const path of c.del||[])setPath(state,path,undefined);
 return state;
}
function expectedAfter(c,state){
 const copy=state&&typeof state==='object'?clone(state):state;
 for(const path of c.removed||[])setPath(copy,path,undefined);
 return JSON.stringify(copy);
}

// ---- 3. Auswerten in der VM -----------------------------------------------------------------------------
// Der Zustand wird in der Realm der App erzeugt (gleiche Prototypen wie im Browser).
function evaluator(app){
 const copy=app.run('(function copy(x){if(Array.isArray(x))return x.map(copy);if(x&&typeof x==="object"){const o={};for(const k of Object.keys(x))o[k]=copy(x[k]);return o}return x})');
 const probe=app.run('(function(s){const before=JSON.stringify(s);let result,thrown=null;try{result=validData(s)}catch(error){thrown=String(error)}return {before,after:JSON.stringify(s),result:thrown===null?!!result:"throws",kind:typeof result,thrown}})');
 return state=>probe(copy(state));
}
const evaluate=evaluator(base);
const built=fixture.cases.map(c=>({c,state:build(c)}));
const baseline=built.map(({c,state})=>evaluate(state));
let wrongResult=[],wrongMutation=[],nonBoolean=0;
built.forEach(({c,state},i)=>{
 const got=baseline[i];
 if(got.result!=='throws'&&got.kind!=='boolean')nonBoolean++;
 if(got.result!==c.expected)wrongResult.push(`${c.name}: erwartet ${c.expected}, erhalten ${got.result}${got.thrown?' ('+got.thrown+')':''}`);
 // Eine Ablehnung verändert die Eingabe nicht; bei Annahme darf nur `removed` verschwinden (Bereinigung durch puls-data-v87.js).
 const wantAfter=c.expected===true?expectedAfter(c,state):got.before;
 if(got.after!==wantAfter)wrongMutation.push(c.name);
});
assert.equal(wrongResult.length,0,'falsches Ergebnis in '+wrongResult.length+' Fällen:\n'+wrongResult.slice(0,25).join('\n'));
assert.equal(wrongMutation.length,0,'unerwartete Veränderung der Eingabe in '+wrongMutation.length+' Fällen:\n'+wrongMutation.slice(0,25).join('\n'));

// ---- 3b. Ladephase ---------------------------------------------------------------------------------------
// Beim Laden von app.js fehlen die Hilfen der später geladenen Dateien. Die Wiederherstellung in app.js ruft deshalb nur validCore
// (Kernprüfung, wie vor Phase 3) und validData wird dort nicht aufgerufen. Der früheste Aufrufer von validData beim Laden ist
// js/cloud.js (syncCloud mit gespeicherter Anmeldung und ungesicherten Änderungen). Ab cloud.js darf validData daher nach
// jedem Skript nicht mehr werfen, wo der fertig geladene Stand nicht wirft.
const validStates=Object.entries(fixture.states);
const countCalls=text=>text.replace('function validData(input){',"function validData(input){globalThis.__validDataCalls=(globalThis.__validDataCalls||0)+1;try{return validDataBody(input)}catch(error){(globalThis.__validDataThrown=globalThis.__validDataThrown||[]).push(String(error));throw error}} function validDataBody(input){");
let coreChecked=0,stageChecks=0,started=false;
const stageProblems=[];
const loading=loadApp({
 transform:{'js/app.js':countCalls},
 afterScript(file,app){
  if(file==='js/app.js'){
   // Nach app.js reicht die Kernprüfung allein: gültige Zustände gelten, nichts wirft.
   for(const [name,state] of validStates){assert.equal(app.run('(s=>validCore(JSON.parse(s)))')(JSON.stringify(state)),true,'validCore nach app.js: '+name);coreChecked++}
  }
  started=started||file==='js/cloud.js';
  if(!started)return;
  const run=evaluator(app);
  built.forEach(({c,state},i)=>{
   const r=run(state);stageChecks++;
   if(r.result==='throws'&&baseline[i].result!=='throws')stageProblems.push('nach '+file+': '+c.name+' wirft ('+r.thrown+')');
  });
  for(const [name,state] of validStates){const r=run(state);if(r.result!==true)stageProblems.push('nach '+file+': gültiger Zustand „'+name+'“ → '+r.result+(r.thrown?' ('+r.thrown+')':''))}
 }});
assert.deepEqual(loading.errors,[]);
assert.deepEqual(stageProblems.slice(0,10),[],'validData beim Laden (ab cloud.js) wirft oder lehnt Gültiges ab: '+stageProblems.length+' Befunde');
assert.equal(loadApp({transform:{'js/app.js':countCalls}}).ctx.__validDataCalls??0,0,'ohne Anmeldung ruft beim Laden niemand validData auf');
// Mit gespeicherter Anmeldung und ungesicherten lokalen Änderungen prüft syncCloud das lokale Profil schon beim Laden von cloud.js.
{
 const app=loadApp({transform:{'js/app.js':countCalls},storage:{'puls-v1':JSON.stringify(fixture.states.full),
  'puls-cloud-session':JSON.stringify({user:{id:'u1',email:'t@example.invalid'},refresh_token:'r',access_token:'a',expires_at:4e9}),'puls-cloud-meta-u1':JSON.stringify({revision:1,dirty:true})}});
 assert.deepEqual(app.errors,[]);
 assert(app.ctx.__validDataCalls>=1,'syncCloud prüft das lokale Profil beim Laden (Voraussetzung dieses Tests)');
 assert.equal(app.ctx.__validDataThrown,undefined,'validData wirft beim Laden aus cloud.js: '+app.ctx.__validDataThrown);
}
// Wiederherstellung beim Laden (puls-v1-recovered): ein gültiger Arbeitsstand wird übernommen, ein ungültiger nicht.
for(const [name,state] of validStates){
 const app=loadApp({storage:{'puls-v1-recovered':JSON.stringify(state)}});assert.deepEqual(app.errors,[]);
 assert.equal(app.run('stateRecoveryPending'),true,'Wiederherstellung beim Laden: '+name);
 assert.equal(app.run('state.foods.length'),state.foods.length,'übernommener Arbeitsstand: '+name); // spätere Dateien ergänzen Standardfelder, daher kein Gesamtvergleich
}
{const broken=clone(fixture.states.full);delete broken.goals;const app=loadApp({storage:{'puls-v1-recovered':JSON.stringify(broken)}});
 assert.equal(app.run('stateRecoveryPending'),false,'ungültiger Arbeitsstand wird nicht übernommen');}

// ---- 4. Schlüsselabdeckung ----------------------------------------------------------------------------
// Alle Top-Level-Schlüssel von state. Neue Schlüssel im Code (state.NAME) lassen den Test hier scheitern.
const STATE_KEYS=['goals','foods','weights','workouts','custom','version','profile','plan','routines','exerciseBook','recipes','meals','workoutSettings',
 'profileHistory','goalHistory','measurements','fasts','mealPlans','foodLogCompleted','checkins','coachingMode','tdeeCalibration','setupPending','onboardingComplete',
 'tutorialVersion','email','displayName','avatarImage','language','iconColor','colorScheme','appDesign','colorTheme','soundEnabled','soundVolume','foodSearch','display','water',
 'waterGoal','microGoals','nativeExtras','progressView','chartLines','chartPeriod','runs','activeRun','runRoutes','runSettings'];
// Heute ohne Ablehnung in validData (nur dokumentiert, nicht nachgerüstet): beliebige Werte gelten als gültig.
const UNCHECKED_TODAY=['version','colorScheme','chartPeriod','chartLines'];
// Heute nur bereinigt: ungültige Teilfelder werden still entfernt (puls-data-v87.js), das Profil bleibt gültig.
const SANITIZED_ONLY=['display','water','foodSearch'];
const NOT_STATE=['js','__pulsRecoveryUploadBlocked']; // „state.js“ im Kommentar, lokales Wiederherstellungs-Flag
const allJs=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>read('js/'+f)).join('\n');
const used=new Set([...allJs.matchAll(/\bstate\.([A-Za-z_]\w*)/g)].map(m=>m[1]));
const unknown=[...used].filter(k=>!STATE_KEYS.includes(k)&&!NOT_STATE.includes(k));
assert.deepEqual(unknown,[],'neue state-Schlüssel im Code; in STATE_KEYS aufnehmen und Fälle ergänzen');
for(const key of STATE_KEYS)assert(new RegExp('\\b'+key+'\\b').test(allJs),'STATE_KEYS enthält einen Schlüssel, den der Code nicht mehr kennt: '+key);
assert.deepEqual(Object.keys(fixture.states.full).sort(),[...STATE_KEYS].sort(),'der volle Zustand muss genau jeden Schlüssel belegen');
const firstKey=path=>path.split('.')[0];
const rejecting=new Set(),sanitized=new Set();
for(const c of fixture.cases){
 const keys=[...Object.keys(c.set||{}),...(c.del||[])].map(firstKey);
 if(c.expected===false)keys.forEach(k=>rejecting.add(k));
 if(c.expected===true&&c.removed)(c.removed).forEach(p=>sanitized.add(firstKey(p)));
}
for(const key of STATE_KEYS){
 if(UNCHECKED_TODAY.includes(key)){assert(!rejecting.has(key),key+' steht unter „heute ungeprüft“, hat aber einen Ablehnungsfall: Liste anpassen');continue}
 if(SANITIZED_ONLY.includes(key)){assert(sanitized.has(key),'kein Bereinigungsfall für '+key);continue}
 assert(rejecting.has(key),'kein Ablehnungsfall für Schlüssel '+key+' (oder in UNCHECKED_TODAY eintragen)');
}

// ---- 5. Wirkungstest je Abschnitt ----------------------------------------------------------------------
// Schaltet man genau einen Abschnitt („//§“) der validData ab, muss mindestens ein Fall sein Ergebnis oder die Veränderung der
// Eingabe ändern. So bleibt jeder Abschnitt durch den Korpus abgedeckt.
const signature=r=>r.result+'|'+r.after;
const baseSig=baseline.map(signature);
const untested=[];let variants=0;
parts.forEach((part,index)=>{
 if(part.structural)return;
 variants++;
 const variant=loadApp({transform:{'js/app.js':text=>withoutSection(text,index)}});assert.deepEqual(variant.errors,[],'Variante '+part.label);
 const run=evaluator(variant);
 if(!built.some(({state},i)=>signature(run(state))!==baseSig[i]))untested.push(part.label);
});
assert.deepEqual(untested,[],'Abschnitte ohne Wirkung im Korpus');
// Jede Datei, die im Korpus Fälle hat, hat einen Abschnitt.
for(const file of new Set(fixture.cases.map(c=>c.by)))assert(!file.startsWith('js/')||parts.some(s=>s.label.startsWith(file)),'kein Abschnitt für Fälle von '+file);

const perFile={};for(const c of fixture.cases)perFile[c.by]=(perFile[c.by]||0)+1;
console.log(`PASS: validData (eine Funktion, ${checks.length} Abschnitte): ${fixture.cases.length} Fälle, ${variants} Abschnittstests, ${coreChecked} Kernprüfungen beim Laden, `+
 `${STATE_KEYS.length} state-Schlüssel (ungeprüft: ${UNCHECKED_TODAY.join(', ')}; nur bereinigt: ${SANITIZED_ONLY.join(', ')}), `+
 `${fixture.cases.filter(c=>c.removed).length} Bereinigungsfälle, ${nonBoolean} Ergebnisse ohne Boolean`);
