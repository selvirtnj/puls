// Refactor Phase 4, Schritt 8: go ist eine Funktion (js/app.js). Die frühere Kette aus 7 Definitionen besteht aus dem Kern goBase (app.js) und fünf benannten Gliedern
// in ihren Dateien (goBefore… je Datei, goAfterMotion; gesetzt dort, wo früher der Wrapper installiert wurde, mit derselben Bedingung).
// go() läuft beim Laden nie (Beleg: der Test unten verlangt für alle Ladevarianten ein leeres Ablaufprotokoll); die Glieder sind trotzdem wie bei
// openModal nur wirksam, wenn ihre Datei geladen ist.
// Verhalten der alten Kette, das erhalten bleibt: experience.js bildet „weight“ auf „account“ ab; account-refresh.js, polish.js und experience.js geben nur das erste Argument weiter
// (weitere Argumente erreichen den Kern nie); der Rückgabewert ist immer undefined; motion.js misst pageKey() vor dem Aufruf und handelt danach.
// Beleg „alt = neu“: tests/fixtures/go-order.json enthält für viele Aufrufe (Seiten, Argumentlisten, Konto-Unterseiten, Sprache) die Reihenfolge der Glieder, die Argumente des Kerns,
// die Wirkungen (Klassen und Stil am Inhalt, Zeitgeber, scrollViewTop, Abfragen), Rückgabewert, Variablen danach und das gerenderte HTML, aufgezeichnet an der alten Kette (Commit 5b1e0a1):
//   node tests/check-go-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Das Golden hängt nicht von der App-Version und nicht von der Uhrzeit ab.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/go-order.json',OLD_COMMIT='5b1e0a1',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// Name im neuen Code -> Bezeichnung im Protokoll (Datei#Nr. des alten Wrappers; „<“ = nach der Rückkehr des Vorgängers).
const LABEL=new Map([['goBeforeExperience','experience#1'],['goBeforePolish','polish#1'],['goBeforeAccountRefresh','account-refresh#1'],['goBeforeQuickAccount','quick-account#1'],
 ['goBeforeMotion','motion#1'],['goAfterMotion','motion#1<']]);

const PREFIX=()=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};`
 +`globalThis.__a=globalThis.__a||function(a){return 'kern('+a.length+','+Array.from(a).map(x=>typeof x==='string'?JSON.stringify(x):typeof x+':'+String(x)).join(',')+')'};`
 +`globalThis.__wrapGo=globalThis.__wrapGo||function(name,fn){return function(...a){const r=fn.apply(this,a);__ev(name+'<');return r}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});
// render() meldet sich in beiden Ständen gleich (Text unverändert).
const renderMark=text=>text.replace(/^function render\(\)\{/m,m=>m+"__ev('render');");

// Alter Code: Kern und Wrapper melden den Eintritt; der Wrapper aus motion.js meldet zusätzlich die Rückkehr seines Vorgängers.
function instrumentOld(file,text){
 let nr=0;const key=fileKey(file);
 text=text.replace(/function go\(p\)\{/,m=>m+"__ev(__a(arguments));");
 text=text.replace(/(?<![.\w$])go=function\(([^)]*)\)\{/g,m=>m+`__ev('${key}#${++nr}');`);
 if(file==='js/motion.js')text=text.replace('const motionGo=go;','const motionGo=__wrapGo("motion#1",go);');
 return PREFIX()+renderMark(text);
}
// Neuer Code: Glieder und Kern melden den Eintritt (goAfterMotion die Rückkehr).
function instrumentNew(file,text){
 text=text.replace(/function (go(?:Base|Before\w+|After\w+))\(([^)]*)\)\{/g,(m,name)=>{
  if(name==='goBase')return m+"__ev(__a(arguments));";
  if(!LABEL.has(name))throw Error('Unbekanntes go-Glied: '+name);return m+`__ev(${JSON.stringify(LABEL.get(name))});`;
 });
 return PREFIX()+renderMark(text);
}
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const normalize=text=>String(text).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100');
// Alte Ereignisse „x<“ zählen nur für motion#1; die übrigen Rückkehrmeldungen gibt es im neuen Code nicht.
const canon=events=>events.filter(e=>!/<$/.test(e)||e==='motion#1<');

// Wirkungen am Inhaltsbereich und an Hilfsfunktionen werden aufgezeichnet; die Funktionen selbst bleiben die echten.
function harness(app){
 const fx=[],push=s=>fx.push(s),content=app.run("$('content')"),classes=new Set();
 content.classList={add(...c){push('content.add '+c);c.forEach(x=>classes.add(x))},remove(...c){push('content.remove '+c);c.forEach(x=>classes.delete(x))},
  toggle(c,f){push(`content.toggle ${c} ${f}`);return true},contains:c=>classes.has(c)};
 content.style={setProperty:(p,v)=>push(`content.style ${p}=${v}`),removeProperty:p=>push('content.style.remove '+p)};
 Object.defineProperty(content,'offsetWidth',{get:()=>{push('content.offsetWidth');return 0},configurable:true});
 let html='';Object.defineProperty(content,'innerHTML',{get:()=>html,set:v=>{html=v;push('content.html '+sha(normalize(v)).slice(0,12))},configurable:true});
 app.ctx.setTimeout=(f,d)=>{push('setTimeout '+d);return 1};app.ctx.clearTimeout=()=>push('clearTimeout');
 app.ctx.document.querySelectorAll=s=>{push('querySelectorAll '+s);return []};
 app.ctx.__fx=push;
 app.run("globalThis.__rec=(n,f)=>function(...a){__fx(n+'('+a.map(x=>typeof x==='function'?'fn':x&&typeof x==='object'?'obj':String(x)).join(',')+')');return f.apply(this,a)};"
  +['scrollViewTop','polishChrome','syncReduced'].map(n=>`if(typeof ${n}==='function')${n}=__rec('${n}',${n});`).join(''));
 return {fx,classes,reset(initial=[]){classes.clear();initial.forEach(c=>classes.add(c));html='';fx.length=0;app.ctx.__log.length=0}};
}

const VARS="[page,accountSection,qaPage,qaParent,qaRatioOpen,qaAnimate,pageDirection,animatedPage,trainTab]";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const PROFILE="state.profile={age:30,height:180,weight:82,target:75,sex:'male',activity:1.375,method:'mifflin'};state.plan.direction='lose';";
const BASE=loadState('full')+PROFILE;
const ARGS=["'home'","'food'","'workout'","'account'","'weight'","'unknown'","","'account','extra',1","'home',{a:1}","null","undefined,'account'","''","'weight','extra'","'workout',true","7"];
const STARTS=['home','food','workout','account','weight'];
const scenarios=[];
const add=(name,setup,call,classes)=>scenarios.push({name,setup,call,classes});
for(const start of STARTS)for(const args of ARGS)add(`${start}->go(${args})`,BASE+`page='${start}';`,`go(${args})`);
for(const start of STARTS)for(const args of ["'home'","'account'","'weight'","'food'"]){
 add(`en:${start}->go(${args})`,BASE+`state.language='en';page='${start}';`,`go(${args})`);
 add(`konto-unterseite:${start}->go(${args})`,BASE+`page='${start}';accountSection='plan';qaPage='profile';qaParent='account';qaRatioOpen=true;qaAnimate='';`,`go(${args})`);
 add(`erststart-leer:${start}->go(${args})`,loadState('initial')+`page='${start}';`,`go(${args})`);
 add(`bewegung-aus:${start}->go(${args})`,BASE+`page='${start}';state.display={...(state.display||{}),motion:'reduced'};`,`go(${args})`);
 add(`inhalt-animiert:${start}->go(${args})`,BASE+`page='${start}';`,`go(${args})`,['motion-page-in','pagearriving']);
}
add('konto-tab:account->go(account)',BASE+"page='account';accountSection='design';qaPage='x';qaAnimate='list';","go('account')");
add('kette:alle-seiten',BASE+"page='home';","go('workout');go('food');go('weight');go('home');go('account');go('home')");
add('this:go.call',BASE+"page='food';","go.call({x:1},'workout')");
add('dazwischen:training-tab',BASE+"page='home';trainTab='calendar';","go('workout')");
add('dazwischen:training-tab-routines',BASE+"page='home';trainTab='routines';","go('workout')");

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 const result={laden:canon(app.ctx.__log).filter(e=>/^(kern|render$)/.test(e)||/#1<?$/.test(e)).join(' '),faelle:{}};
 const h=harness(app);
 for(const s of scenarios){
  h.reset(s.classes);
  let value;
  try{
   app.run("accountSection='';qaPage='';qaParent='';qaRatioOpen=false;qaAnimate='';"+s.setup);h.fx.length=0;app.ctx.__log.length=0;
   value=app.run(`(()=>{const r=(()=>{${s.call.includes(';')?s.call+';return undefined':'return '+s.call}})();return typeof r+':'+String(r)})()`);
  }catch(error){throw Error(`${s.name}: unerwartete Ausnahme: ${error.message}`)}
  result.faelle[s.name]={glieder:canon(app.ctx.__log).join(' '),wirkung:h.fx.join(' | '),rueckgabe:value,variablen:JSON.stringify(app.run(VARS)),
   inhalt:sha(normalize(app.run("$('content').innerHTML"))),klassen:[...h.classes].sort().join(' '),zustand:sha(app.run('JSON.stringify(state)').replace(UUID,'UUID'))};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: go ist nur in js/app.js deklariert; Zuweisungen gibt es keine mehr.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+go\s*\(/.test(code(f))),['js/app.js'],'go darf nur in js/app.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])go\s*=\s*(?:async\s*)?function\b/.test(code(f))),[],'go wird von keiner Datei mehr umhüllt');
assert.deepEqual(jsFiles.filter(f=>/=\s*go\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte go-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
if(process.argv.includes('--accept-ui')){require('./accept-ui.cjs')(FIXTURE,golden,{alt:golden.alt,...now},{html:['inhalt'],mask:/content\.html[0-9a-f]{12}/g});process.exit(0)} // nur HTML-Werte neu, nach gewollter UI-Änderung
for(const group of ['standard','erststart']){
 assert.equal(golden[group].laden.includes('kern('),false,`${group}: go() läuft beim Laden nicht`);
 assert.deepEqual(Object.keys(now[group].faelle),Object.keys(golden[group].faelle),`${group}: Zustände weichen vom Golden ab`);
 assert.equal(now[group].laden,golden[group].laden,`${group}: Aufrufe von go während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  for(const key of ['glieder','wirkung','rueckgabe','variablen','inhalt','klassen','zustand'])assert.equal(got[key],expected[key],`${group}/${name}: ${key} weicht von der alten Kette (${golden.alt}) ab`);
 }
}
const full=Object.values(golden.standard.faelle).find(f=>f.glieder.startsWith('motion#1 quick-account#1')).glieder.split(' ');
assert.deepEqual(full.slice(0,5),['motion#1','quick-account#1','account-refresh#1','polish#1','experience#1']);assert.equal(full.at(-1),'motion#1<');
assert(Object.values(golden.standard.faelle).some(f=>f.glieder.includes('kern(1,"account")')&&f.wirkung.includes('scrollViewTop')),'weight wird zu account');
console.log(`PASS: go ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Aufrufe liefern Glieder, Wirkungen, Rückgabe und HTML wie die alte Kette (${full.length} Meldungen im Vollauf).`);
