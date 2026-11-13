// Refactor Phase 4, Schritt 6: profileForm ist eine Funktion (js/enhancements.js); die frühere Kette aus 10 Gliedern besteht aus dem Kern profileFormBase (enhancements.js)
// und neun benannten Gliedern in ihren Dateien (profileFormAfter…, je Datei; jedes läuft nach dem Kern und den Gliedern davor und arbeitet am Formular).
// Beleg „alt = neu“: tests/fixtures/profileform-order.json enthält für die Ladezeit und für viele Zustände (Profil leer/voll, Einheiten und Modi, Sprache, Erststart, Aufrufer mit und ohne
// Argumente, Einstellungs-Dialog, Schnellbearbeitung) die Reihenfolge der Glieder, alle DOM-Zugriffe der Glieder in Reihenfolge (Aufrufe mit Argumenten, geschriebene Eigenschaften),
// den Rückgabewert, das Formular-HTML und den Zustand danach. Aufgezeichnet an der alten Kette (Commit 216f3dd):
//   node tests/check-profileform-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Das Golden hängt nicht von der App-Version (Version N, ?v=N) und nicht von der Uhrzeit ab: Anzeigeversion wird normalisiert, die Uhr der App steht fest.
// Der DOM ist ein kleines Protokoll-Modell (siehe makeDom): Elemente entstehen aus den ids im geschriebenen HTML (Werte, Optionen, Typ), jeder Zugriff wird aufgezeichnet.
// Eine unerwartete Ausnahme in einem Zustand macht den Test ungültig; sie wird nicht als Ergebnis aufgezeichnet.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/profileform-order.json',OLD_COMMIT='216f3dd',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// [Datei, Nr. des alten Wrappers in der Datei (nur `const x=profileForm;` zählt), Name des neuen Glieds], innen nach außen (Ladereihenfolge).
// Kern der alten Kette war enhancements.js (function profileForm); alle neun Wrapper riefen ihren Vorgänger zuerst und taten danach ihre Arbeit.
const GLIEDER=[
 ['experience',1,'profileFormAfterExperience'],['experience',2,'profileFormAfterExperiencePersonal'],['flows',1,'profileFormAfterFlowsRefined'],['flows',2,'profileFormAfterFlowsOnboarding'],
 ['lifecycle',1,'profileFormAfterLifecycle'],['workout-polish',1,'profileFormAfterWorkoutPolish'],['adaptation',1,'profileFormAfterAdaptation'],['profile-refresh',1,'profileFormAfterProfileRefresh'],
 ['quick-account',1,'profileFormAfterQuickAccount']
];
const LABEL=new Map(GLIEDER.map(([file,nr,name])=>[name,`${file}#${nr}`]));LABEL.set('profileFormBase','kern:enhancements');

const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};__ev('@'+${JSON.stringify(file)});`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');const r=fn.apply(this,a);__ev(name+'<');return r}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Wrapper hält seinen Vorgänger als `const x=profileForm;`; der Test meldet „>“ vor und „<“ nach dessen normaler Rückkehr (wirft der Vorgänger, läuft das Glied nicht).
// Die Arbeit des Glieds folgt nach „<“. Der Kern meldet sich selbst.
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=profileForm;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(`${fileKey(file)}#${++nr}`)},profileForm);`);
 if(file==='js/enhancements.js'){const needle='function profileForm(){',at=text.indexOf(needle);if(at<0)throw Error('Kern nicht gefunden');text=text.slice(0,at+needle.length)+"__ev('kern:enhancements');"+text.slice(at+needle.length)}
 return PREFIX(file)+text;
}
// Neuer Code: Jedes Glied und der Kern melden sich beim Eintritt.
function instrumentNew(file,text){
 text=text.replace(/function (profileForm(?:Base|After\w+))\(([^)]*)\)\{/g,(m,name)=>m+`__ev(${JSON.stringify(LABEL.get(name))});`);
 return PREFIX(file)+text;
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const norm=s=>String(s).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100');
const canon=events=>[...events].filter(e=>!e.startsWith('@')&&!/>$/.test(e)).map(e=>e.replace(/<$/,''));
const isStep=e=>/^(kern:|[\w-]+#\d+$)/.test(e);

// ---- DOM-Protokollmodell ----
// Elemente entstehen aus den ids im geschriebenen HTML (innerHTML, outerHTML, insertAdjacentHTML): Tag, Typ, Wert, Optionen. getElementById liefert das zuletzt geschriebene Element.
// Jeder Zugriff (Methodenaufruf, geschriebene Eigenschaft) wird mit seinen Argumenten ins Protokoll geschrieben; lange Texte als Länge und Hash.
const STATIC_IDS=new Set(['modal','mb','mt','content','title','subtitle','date','nav','toast']);
function makeDom(ctx,log){
 const reg=new Map();let counter=0;
 const fmt=v=>typeof v==='string'?(v.length>60?`s${v.length}:${sha(v).slice(0,10)}`:JSON.stringify(v)):typeof v==='function'?'fn':v&&typeof v==='object'&&v.__name?`<${v.__name}>`:v===undefined?'undef':JSON.stringify(v);
 const attrsOf=s=>{const a={};for(const m of s.matchAll(/([\w-]+)(?:="([^"]*)")?/g))a[m[1]]=m[2]??'';return a};
 function parse(html,host){
  for(const m of String(html).matchAll(/<(\w+)((?:[^>"]|"[^"]*")*)>/g)){
   const attrs=attrsOf(m[2]);if(!attrs.id||/^\//.test(m[1]))continue;
   const init={tagName:m[1].toUpperCase(),type:attrs.type??(m[1]==='select'?'select-one':''),value:attrs.value??'',checked:'checked' in attrs,hidden:'hidden' in attrs,disabled:'disabled' in attrs,attrs};
   if(m[1]==='select'){
    const rest=String(html).slice(m.index+m[0].length),body=rest.slice(0,rest.indexOf('</select>')),options=[];
    for(const o of body.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)){const oa=attrsOf(o[1]);options.push(node(`${attrs.id}#option${options.length}`,{tagName:'OPTION',value:oa.value??o[2],text:o[2],textContent:o[2],selected:'selected' in oa}))}
    init.options=options;init.value=(options.find(o=>o.selected)||options[0])?.value??'';
   }
   reg.set(attrs.id,node(attrs.id,init));
  }
 }
 function node(name,init={}){
  const store={tagName:'DIV',type:'',value:'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',outerHTML:'',scrollTop:0,open:false,attrs:{},options:[],dataset:{},...init},kids=new Map(),classes=new Set();
  const note=s=>log.push(`${name}.${s}`);
  const kid=(key,init)=>{if(!kids.has(key))kids.set(key,node(`${name}>${key}`,init));return kids.get(key)};
  const list=key=>[0,1].map(i=>{const k=kid(`${key}#${i}`);return k});
  const methods={
   closest:sel=>{note(`closest(${sel})`);return kid(`closest(${sel})`)},
   querySelector:sel=>{note(`querySelector(${sel})`);return kid(`qs(${sel})`)},
   querySelectorAll:sel=>{note(`querySelectorAll(${sel})`);const l=list(`qsa(${sel})`);if(sel==='p'){l[0].textContent='Der Parameter gehört zur ursprünglichen Mifflin-Formel.';l[1].textContent='Anderer Absatz'}return l},
   insertAdjacentHTML:(pos,html)=>{note(`insertAdjacentHTML(${pos},${fmt(html)})`);if(store.tagName==='SELECT'&&pos==='beforeend'){for(const o of String(html).matchAll(/<option([^>]*)>([^<]*)<\/option>/g)){const oa=attrsOf(o[1]);store.options.push(node(`${name}#option${store.options.length}`,{tagName:'OPTION',value:oa.value??o[2],text:o[2],textContent:o[2],selected:'selected' in oa}))}}else parse(html)},
   insertAdjacentElement:(pos,el)=>{note(`insertAdjacentElement(${pos},${fmt(el)})`);return el},
   appendChild:el=>{note(`appendChild(${fmt(el)})`);return el},
   append:(...els)=>{note(`append(${els.map(fmt).join(',')})`)},
   remove:()=>{note('remove()')},before:(...els)=>{note(`before(${els.map(fmt).join(',')})`)},after:(...els)=>{note(`after(${els.map(fmt).join(',')})`)},prepend:(...els)=>{note(`prepend(${els.map(fmt).join(',')})`)},
   replaceWith:(...els)=>{note(`replaceWith(${els.map(fmt).join(',')})`)},insertBefore:(a,b)=>{note(`insertBefore(${fmt(a)},${fmt(b)})`);return a},replaceChildren:(...els)=>{note(`replaceChildren(${els.map(fmt).join(',')})`)},
   addEventListener:(type,fn)=>{note(`addEventListener(${fmt(type)},${fmt(fn)})`)},
   removeEventListener:(type)=>{note(`removeEventListener(${fmt(type)})`)},
   dispatchEvent:ev=>{note('dispatchEvent()');return true},
   setAttribute:(k,v)=>{note(`setAttribute(${fmt(k)},${fmt(v)})`);store.attrs[k]=String(v)},
   getAttribute:k=>{note(`getAttribute(${fmt(k)})`);return store.attrs[k]??null},
   removeAttribute:k=>{note(`removeAttribute(${fmt(k)})`);delete store.attrs[k]},
   contains:()=>false,focus:()=>{note('focus()')},scrollTo:()=>{note('scrollTo()')},scrollIntoView:()=>{note('scrollIntoView()')},
   showModal:()=>{note('showModal()');store.open=true},close:()=>{note('close()');store.open=false}
  };
  const classList={add:(...c)=>{note(`classList.add(${c.join(',')})`);c.forEach(x=>classes.add(x))},remove:(...c)=>{note(`classList.remove(${c.join(',')})`);c.forEach(x=>classes.delete(x))},
   toggle:(c,force)=>{note(`classList.toggle(${c},${fmt(force)})`);const on=force===undefined?!classes.has(c):!!force;on?classes.add(c):classes.delete(c);return on},contains:c=>classes.has(c)};
  const dataset=new Proxy(store.dataset,{set(t,k,v){note(`dataset.${String(k)}=${fmt(v)}`);t[k]=v;return true}});
  const style={setProperty(){},removeProperty(){}};
  return new Proxy({},{
   get(_,p){
    if(p==='__name')return name;
    if(typeof p==='symbol'||p==='then')return undefined;
    if(Object.hasOwn(methods,p))return methods[p];
    if(p==='classList')return classList;if(p==='dataset')return dataset;if(p==='style')return style;
    if(p==='content')return kid('content');
    if(p==='childNodes')return [kid('text',{nodeType:3,textContent:'Beschriftung'})];
    if(p==='children')return [];
    if(p==='firstChild'||p==='parentElement'||p==='parentNode'||p==='nextElementSibling'||p==='previousElementSibling')return kid(p);
    return store[p];
   },
   set(_,p,v){
    note(`${p}=${fmt(v)}`);
    if(p==='innerHTML'||p==='outerHTML'){store[p]=String(v);parse(v)}
    else if(p==='value'&&store.tagName==='SELECT'){store.value=v;for(const o of store.options)o.selected=o.value===String(v)}
    else store[p]=v;
    return true;
   }
  });
 }
 const get=id=>{if(!reg.has(id))reg.set(id,node(id));return reg.get(id)};
 let tabs=[];
 const reset=()=>{for(const id of [...reg.keys()])if(!STATIC_IDS.has(id))reg.delete(id);counter=0;tabs=[0,1].map(i=>node(`plannerTab${i}`,{tagName:'BUTTON',dataset:{plannerTab:['profile','data'][i]}}));reg.set('profile-form',node('profile-form'));get('modal').open=false};
 // Beim Laden der Skripte gilt der einfache Stub von loadApp (die Skripte dekorieren dort bereits vorhandene Elemente); das Protokollmodell gilt ab activate().
 const doc=ctx.document,stub={getElementById:doc.getElementById,createElement:doc.createElement,querySelectorAll:doc.querySelectorAll};let live=false;
 doc.getElementById=id=>live?get(id):stub.getElementById(id);
doc.createTextNode=text=>live?node('text'+(++counter),{nodeType:3,textContent:String(text)}):undefined;
 doc.createElement=tag=>live?node('created'+(++counter),{tagName:String(tag).toUpperCase()}):stub.createElement(tag);
 doc.querySelectorAll=sel=>live?(/planner-tab|plannertabs/.test(sel)?tabs:[]):stub.querySelectorAll(sel);
 return {reset,get,activate:()=>{live=true}};
}

// ---- Zustände ----
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const PROFILE="state.profile={age:34,sex:'female',height:171,weight:66,target:60,activity:1.55,method:'mifflin',special:false,kcalMode:'classic',baselineFactor:1.2,rmr:''};state.plan={...state.plan,mode:'auto',direction:'lose',pace:'medium',macroMode:'auto',protein:1.8,fat:0.9};state.goals={kcal:2000,p:130,c:220,f:60};";
const reset="setupPending=false;onboardingPlanMode='auto';";
const scenarios=[];
const add=(name,setup,call='profileForm()')=>scenarios.push({name,setup:reset+setup,call});
for(const name of Object.keys(CASES))add('zustand:'+name,loadState(name));
for(const name of ['initial','full','mit-profil-und-trainingsplan'])add('en:'+name,loadState(name)+"state.language='en';");
add('profil',loadState('initial')+PROFILE);
add('profil-en',loadState('initial')+PROFILE+"state.language='en';");
add('profil-maenner',loadState('initial')+PROFILE.replace("sex:'female'","sex:'male'"));
add('profil-schwanger',loadState('initial')+PROFILE.replace("special:false","special:true"));
add('profil-baseline',loadState('initial')+PROFILE.replace("kcalMode:'classic',baselineFactor:1.2","kcalMode:'baseline',baselineFactor:1.4"));
add('profil-gemessen',loadState('initial')+PROFILE.replace("method:'mifflin'","method:'measured'").replace("rmr:''","rmr:1450"));
add('profil-aktiv-niedrig',loadState('initial')+PROFILE.replace("activity:1.55","activity:1.2"));
add('profil-aktiv-hoch',loadState('initial')+PROFILE.replace("activity:1.55","activity:1.9"));
add('profil-unvollstaendig',loadState('initial')+"state.profile={age:34,height:171};");
add('plan-manuell',loadState('initial')+PROFILE+"state.plan.mode='manual';state.goals={kcal:2600,p:150,c:300,f:80};");
add('plan-makros-manuell',loadState('initial')+PROFILE+"state.plan.macroMode='manual';state.goals={kcal:2100,p:140,c:200,f:70};");
add('plan-zunehmen',loadState('initial')+PROFILE+"state.plan.direction='gain';state.plan.pace='high';");
add('plan-halten',loadState('initial')+PROFILE+"state.plan.direction='maintain';");
add('plan-extrem',loadState('initial')+PROFILE+"state.plan.pace='extreme';");
add('plan-schnell',loadState('initial')+PROFILE+"state.plan.pace='low';");
add('plan-nicht-adaptiv',loadState('initial')+PROFILE+"state.plan.adaptive=false;");
add('plan-lernen',loadState('initial')+PROFILE+"state.plan.learnTdee=true;");
add('plan-lernen-en',loadState('initial')+PROFILE+"state.plan.learnTdee=true;state.language='en';");
add('gewicht-verlauf',loadState('initial')+PROFILE+"state.weights=[{id:'w1',date:'2026-11-01',kg:68},{id:'w2',date:'2026-11-12',kg:66.4}];");
add('design-liftoff',loadState('full')+"state.appDesign='liftoff';");
add('erststart-name',loadState('initial')+"setupPending=true;state.setupPending=true;");
add('erststart-name-profil',loadState('initial')+PROFILE+"setupPending=true;state.setupPending=true;");
add('einrichtung-auto',loadState('initial')+"setupPending=true;onboardingPlanMode='auto';");
add('einrichtung-manuell',loadState('initial')+"setupPending=true;onboardingPlanMode='manual';");
add('einrichtung-en',loadState('initial')+"setupPending=true;onboardingPlanMode='manual';state.language='en';");
add('einrichtung-profil',loadState('initial')+PROFILE+"setupPending=true;onboardingPlanMode='auto';");
for(const call of ["profileForm(1,'x',{a:1})","profileForm(undefined,null)","profileForm.call({tag:1})","profileForm.apply(null,[{}])","[profileForm,profileForm].forEach(f=>f(5))","profileForm();profileForm()"]){
 add('aufruf:'+call,loadState('initial')+PROFILE,call);
 add('aufruf-leer:'+call,loadState('initial'),call);
 add('aufruf-einrichtung:'+call,loadState('initial')+"setupPending=true;onboardingPlanMode='manual';",call);
}
add('rueckgabe',loadState('initial')+PROFILE,'JSON.stringify(profileForm())');
add('einstellungen',loadState('initial')+PROFILE,'settings()');
add('einstellungen-leer',loadState('initial'),'settings()');
add('einstellungen-en',loadState('full'),'settings()');
add('einstellungen-einrichtung',loadState('initial')+"setupPending=true;onboardingPlanMode='auto';",'settings()');
add('einstellungen-zweimal',loadState('initial')+PROFILE,'settings();settings()');
add('einstellungen-daten',loadState('initial')+PROFILE,'settings();dataSettings();profileForm()');
for(const key of ['age','sex','height','weight','target','kcal','mode','direction','pace','macroMode','protein','fat','p','c','f','method','rmr','activity','kcalMode','baseline','adaptive'])add('schnell:'+key,loadState('initial')+PROFILE,`qaEdit(${JSON.stringify(key)})`);
add('schnell:alter-leer',loadState('initial'),"qaEdit('age')");
add('schnell:groesse-en',loadState('full'),"qaEdit('height')");
add('schnell:vollstaendig',loadState('initial')+PROFILE,'qaFullSetup()');
add('schnell:vollstaendig-leer',loadState('initial'),'qaFullSetup()');

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 let dom,log=[];
 const app=loadApp({transform,now:NOW,setup:ctx=>{ctx.__log=log;dom=makeDom(ctx,log)},...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 dom.activate();
 const result={};
 // Während des Ladens kann profileForm laufen (Einrichtung); alles, was dann passiert, wird festgehalten.
 result.laden=canon(log).join(' ');
 result.ladenOps=sha(log.filter(e=>!e.startsWith('@')&&!/[<>]$/.test(e)&&!isStep(e)).join('\n'));
 const sections=options.search?[{name:'erststart',setup:reset+loadState('initial'),call:'profileForm()'},{name:'erststart-einrichtung',setup:reset+loadState('initial')+"setupPending=true;state.setupPending=true;",call:'profileForm()'},{name:'erststart-einstellungen',setup:reset+loadState('initial'),call:'settings()'},{name:'erststart-profil',setup:reset+loadState('initial')+PROFILE,call:'profileForm()'}]:scenarios;
 result.faelle={};
 for(const s of sections){
  dom.reset();
  app.run(s.setup);
  log.length=0;
  const cut=s.call.lastIndexOf(';'),ret=app.run(`(function(){${s.call.slice(0,cut+1)}const r=${s.call.slice(cut+1)};return r===undefined?'undefined':JSON.stringify(r)})()`);
  const events=canon(log),ops=log.filter(e=>!e.startsWith('@')&&!/[<>]$/.test(e)&&!isStep(e)),form=dom.get('profile-form').innerHTML;
  result.faelle[s.name]={ablauf:events.filter(isStep).join(' '),ops:ops.length,opsSha256:sha(ops.join('\n')),rueckgabe:ret,formLaenge:norm(form).length,formSha256:sha(norm(form)),
   zustand:sha(app.run('JSON.stringify([setupPending,onboardingPlanMode,state])').replace(UUID,'UUID'))};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: profileForm ist nur in js/enhancements.js deklariert und wird nirgends mehr überschrieben.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+profileForm\s*\(/.test(code(f))),['js/enhancements.js'],'profileForm darf nur in js/enhancements.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(^|[;{}\n])\s*profileForm\s*=(?!=)/.test(code(f))),[],'profileForm wird nirgends mehr überschrieben');
assert.deepEqual(jsFiles.filter(f=>/=\s*profileForm\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte profileForm-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
assert.deepEqual(Object.keys(now.standard.faelle),Object.keys(golden.standard.faelle),'Zustände weichen vom Golden ab');
for(const group of ['standard','erststart']){
 assert.equal(now[group].laden,golden[group].laden,`${group}: Aufrufe von profileForm während des Ladens weichen ab`);
 assert.equal(now[group].ladenOps,golden[group].ladenOps,`${group}: DOM-Zugriffe während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  assert.equal(got.ablauf,expected.ablauf,`${group}/${name}: Reihenfolge der Glieder weicht von der alten Kette (${golden.alt}) ab`);
  assert.equal(got.ops,expected.ops,`${group}/${name}: Zahl der DOM-Zugriffe weicht ab`);
  assert.equal(got.opsSha256,expected.opsSha256,`${group}/${name}: DOM-Zugriffe (Reihenfolge, Argumente) weichen von der alten Kette ab`);
  assert.equal(got.rueckgabe,expected.rueckgabe,`${group}/${name}: Rückgabewert weicht ab`);
  assert.equal(got.formLaenge,expected.formLaenge,`${group}/${name}: Länge des Formular-HTML weicht ab`);
  assert.equal(got.formSha256,expected.formSha256,`${group}/${name}: Formular-HTML weicht von der alten Kette ab`);
  assert.equal(got.zustand,expected.zustand,`${group}/${name}: Zustand (Einrichtung, Daten) danach weicht ab`);
 }
}
const full=Object.values(golden.standard.faelle).find(f=>f.ablauf.startsWith('kern:enhancements')).ablauf.split(' ');
assert.equal(full[0],'kern:enhancements');assert.equal(full.at(-1),'quick-account#1');assert.equal(full.length,10);
console.log(`PASS: profileForm ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Zustände liefern Ablauf, DOM-Zugriffe und Formular wie die alte Kette (${full.length} Glieder im Vollauf).`);
