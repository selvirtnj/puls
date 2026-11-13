// Sicherheitsnetz für die validData-Kette (Refactor Phase 0, vor Phase 3).
// Lädt die gesamte Web-App in echter index.html-Reihenfolge, sodass die WIRKSAME validData gilt, und prüft
// einen Fallkorpus (tests/fixtures/validdata/cases.json) gegen sie. Ohne Netz, ohne echte Profile.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {loadApp,scriptList,assignmentCount,read}=require('./validdata-env.cjs');

// ---- 1. Alle Glieder der Kette sind geladen -------------------------------------------------------------
const scripts=scriptList(),withAssign=scripts.filter(f=>assignmentCount(read(f))>0);
const totalAssign=scripts.reduce((sum,f)=>sum+assignmentCount(read(f)),0);
const unlisted=fs.readdirSync('js').filter(f=>f.endsWith('.js')&&!scripts.includes('js/'+f)&&assignmentCount(read('js/'+f))>0);
assert.deepEqual(unlisted,[],'Dateien mit validData-Zuweisung, die index.html nicht lädt');
// Es dürfen keine Dateien übersprungen werden: jede Datei der Liste läuft im Stub fehlerfrei.
const base=loadApp();
assert.deepEqual(base.errors,[],'Skripte, die im Stub nicht laufen');
assert.equal(base.loaded.length,scripts.length);
// Jede Datei mit validData-Zuweisung hat die Kette tatsächlich verändert (app.js liefert die Grundfunktion).
assert.deepEqual(base.changedBy,withAssign.filter(f=>f!=='js/app.js'),'Reihenfolge/Menge der Dateien, die validData ersetzen');

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

// ---- 3b. Zwischenstände der Kette ---------------------------------------------------------------------------
// Nach JEDEM Skript muss die bis dahin gebaute Kette alle gültigen Zustände annehmen und darf nicht werfen. Das fängt einen
// Wrapper, der Hilfsfunktionen oder Konstanten aus einer später geladenen Datei braucht (ReferenceError), und deckt auf, was
// ein früher Aufruf während des Ladens (z. B. cloud.js, Ende von app.js) mit einer unvollständigen Kette sieht.
const validStates=Object.entries(fixture.states);
// Bekannt: experience.js lässt das alte plan.pace „extreme“ zu. Bis dahin (enhancements, products, recipes) lehnt die Teilkette es ab.
const EARLY_REJECT=Object.fromEntries(['js/enhancements.js','js/products.js','js/recipes.js'].map(f=>[f,['mit-profil-und-trainingsplan']]));
const stageProblems=[];let stages=0;
loadApp({afterScript(file,app){
 if(typeof app.ctx.validData!=='function')return;stages++;
 const run=evaluator(app);
 for(const [name,state] of validStates){const want=!(EARLY_REJECT[file]||[]).includes(name),r=run(state);if(r.result!==want)stageProblems.push(`nach ${file}: Zustand „${name}“ → ${r.result}${r.thrown?' ('+r.thrown+')':''}`)}
}});
console.log(stageProblems.join('\n'));assert.deepEqual(stageProblems,[],'Zwischenstände der validData-Kette');

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

// ---- 5. Wirkungstest je Wrapper ------------------------------------------------------------------------
// Lässt man genau eine validData-Zuweisung aus, muss mindestens ein Fall sein Ergebnis oder die Veränderung der Eingabe ändern.
// So bleibt jedes Glied der Kette (und später die zusammengelegte Funktion) durch den Korpus abgedeckt.
const signature=r=>r.result+'|'+r.after;
const baseSig=baseline.map(signature);
const untested=[];let variants=0;
for(const file of withAssign.filter(f=>f!=='js/app.js')){
 const count=(read(file).match(/(?<![.\w$])validData\s*=(?!=)/g)||[]).length;
 for(let index=0;index<count;index++){
  variants++;
  const variant=loadApp({skip:{file,index}});assert.deepEqual(variant.errors,[],'Variante '+file+'#'+index);
  const run=evaluator(variant);
  const flipped=built.some(({state},i)=>signature(run(state))!==baseSig[i]);
  if(!flipped)untested.push(file+' (Zuweisung '+(index+1)+')');
 }
}
assert.deepEqual(untested,[],'Wrapper ohne Wirkung im Korpus');

const perFile={};for(const c of fixture.cases)perFile[c.by]=(perFile[c.by]||0)+1;
console.log(`PASS: validData-Kette (${totalAssign} Zuweisungen in ${withAssign.length} Dateien): ${fixture.cases.length} Fälle, ${variants} Wrapper-Wirkungstests, ${stages} Ladezwischenstände, `+
 `${STATE_KEYS.length} state-Schlüssel (ungeprüft: ${UNCHECKED_TODAY.join(', ')}; nur bereinigt: ${SANITIZED_ONLY.join(', ')}), `+
 `${fixture.cases.filter(c=>c.removed).length} Bereinigungsfälle, ${nonBoolean} Ergebnisse ohne Boolean`);
