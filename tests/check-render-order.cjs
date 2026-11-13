// Refactor Phase 4, Schritt 1: render ist eine Funktion (js/app.js); die 25 früheren Wrapper sind benannte Glieder in ihren Dateien.
// Beleg „alt = neu“: tests/fixtures/render-order.json enthält, in welcher Reihenfolge die Glieder laufen: während des ganzen Ladens
// (jede Datei, mit der Teilkette, die dort galt) und bei render() auf jeder Seite. Aufgezeichnet an der alten Kette (Commit 35b35a3):
//   node tests/check-render-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht, z. B. neue oder entfernte Glieder, neu schreiben)
// Das Glied-Protokoll des neuen Codes entsteht, indem jedem Glied beim Laden eine Protokollzeile vorangestellt wird.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/render-order.json',OLD_COMMIT='35b35a3';

// [Datei, Nr. des alten Wrappers in der Datei, Funktion vorher, Funktion nachher]. Nur die Glieder, die im Stub laufen
// (native-bridge, native-extras und native-state sind ohne iOS-Brücke untätig; ihre Reihenfolge prüfen check-native-scanner und check-shell-extras).
const GLIEDER=[
 ['recipes',1,'renderBeforeRecipes',null],['training',1,'renderBeforeTracker',null],['finish',1,null,'renderAfterFinish'],
 ['personal',1,null,'renderAfterPersonal'],['navigation',1,null,'renderAfterNavigation'],['flows',1,null,'renderAfterFlowsSession'],
 ['flows',2,null,'renderAfterFlowsIdentity'],['flows',3,null,'renderAfterFlowsDesign'],['interactions',1,null,'renderAfterInteractions'],
 ['polish',1,'renderBeforePolish','renderAfterPolish'],['comfort',1,null,'renderAfterComfort'],['i18n',1,null,'renderAfterLanguage'],
 ['training-tabs',1,null,'renderAfterTrainingTabs'],['app-polish',1,null,'renderAfterAppPolish'],['run-session',1,null,'renderAfterRunSession'],
 ['design-system',1,null,'renderAfterDesignSystem'],['puls-data',1,'renderBeforeData',null],['food-diary',1,'renderBeforeFoodDiary','renderAfterFoodDiary'],
 ['quick-account',1,null,'renderAfterQuickAccount'],['motion',1,null,'renderAfterMotion']
];
const KERNE=[['experience','renderExperience'],['app','renderBase']];
const label=(file,nr)=>`${file}#${nr}`;
const FUNCTION_LABEL=new Map();
for(const [file,nr,before,after] of GLIEDER){if(before)FUNCTION_LABEL.set(before,label(file,nr)+'.vorher');if(after)FUNCTION_LABEL.set(after,label(file,nr)+'.nachher')}
for(const [file,name] of KERNE)FUNCTION_LABEL.set(name,'kern:'+file);

const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};__ev('@'+${JSON.stringify(file)});`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');try{return fn.apply(this,a)}finally{__ev(name+'<')}}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Aufruf der inneren Funktion eines Wrappers (`const x=render;`) meldet „vorher“ (>) und „nachher“ (<); die Kerne melden sich selbst.
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=render;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(label(fileKey(file),++nr))},render);`);
 if(file==='js/experience.js')text=text.replace('render=function(){if(!state.plan||!state.exerciseBook)migrate();',"render=function(){__ev('kern:experience');if(!state.plan||!state.exerciseBook)migrate();");
 if(file==='js/app.js')text=text.replace('function render(){let nav=',"function render(){__ev('kern:app');let nav=");
 return PREFIX(file)+text;
}
// Neuer Code: Jedes Glied meldet sich zu Beginn.
function instrumentNew(file,text){
 text=text.replace(/(globalThis\.(render(?:Before|After)\w+)=function \2\([^)]*\)\{|globalThis\.renderExperience=function renderExperience\(\)\{|function renderBase\(\)\{)/g,(m)=>{
  const name=/function (render\w+)\(/.exec(m)[1];return m+`__ev(${JSON.stringify(FUNCTION_LABEL.get(name))});`;
 });
 return PREFIX(file)+text;
}

const HAS_BEFORE=new Set(GLIEDER.filter(g=>g[2]).map(g=>label(g[0],g[1]))),HAS_AFTER=new Set(GLIEDER.filter(g=>g[3]).map(g=>label(g[0],g[1])));
// Alte Ereignisse „name>“ / „name<“ werden zu „name.vorher“ / „name.nachher“, aber nur dort, wo der Wrapper etwas vor bzw. nach dem inneren Aufruf tat.
function canon(events){
 const out=[];
 for(const e of events){
  const m=/^(.+)([><])$/.exec(e);
  if(!m){out.push(e);continue}
  if(m[2]==='>'&&HAS_BEFORE.has(m[1]))out.push(m[1]+'.vorher');
  if(m[2]==='<'&&HAS_AFTER.has(m[1]))out.push(m[1]+'.nachher');
 }
 return out;
}

function protocol(mode){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 // Nach dem Laden: render() auf jeder Seite, ein Fehler im Stub wird mitprotokolliert.
 for(const page of ['home','food','workout','account']){
  app.ctx.__log.push('@render:'+page);
  try{app.run(`page=${JSON.stringify(page)};render()`)}catch(error){app.ctx.__log.push('!'+error.message)}
 }
 app.run("page='home'");
 const lines=[];let name=null,list=[];
 const flush=()=>{if(name!==null&&list.length)lines.push(name+': '+list.join(' '));list=[]};
 for(const e of mode==='old'?canon(app.ctx.__log):app.ctx.__log){if(e.startsWith('@')){flush();name=e.slice(1)}else list.push(e)}
 flush();
 return lines;
}

if(process.argv.includes('--record-old')){
 const lines=protocol('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,ablauf:lines},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${lines.length} Abschnitte, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: render ist nur in js/app.js deklariert; Zuweisungen gibt es nur im untätigen native-state.js.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+render\s*\(/.test(code(f))),['js/app.js'],'render darf nur in js/app.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])render\s*=\s*(?:async\s*)?function\b/.test(code(f))),['js/native-state.js'],'render wird nur vom untätigen native-state.js noch umhüllt');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])const\s+\w+\s*=\s*render\s*;\s*render\s*=/.test(code(f))&&f!=='js/native-state.js'),[],'keine Datei hält mehr eine alte render-Funktion fest');

// 2. Reihenfolge der Glieder wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8'));
const lines=protocol('new');
assert.deepEqual(lines,golden.ablauf,`Reihenfolge der render-Glieder weicht von der alten Kette (${golden.alt}) ab. Bei Absicht: node tests/check-render-order.cjs --record-old nur für die alte Kette; neue Glieder bewusst im Test und in der Datei nachziehen.`);
const full=lines.find(l=>l.startsWith('render:home: ')).split(' ').slice(1);
assert.equal(full.at(0),'food-diary#1.vorher');assert.equal(full.at(-1),'motion#1.nachher');assert(full.includes('kern:experience')&&!full.includes('kern:app'));
console.log(`PASS: render ist eine Funktion; ${lines.length} Abschnitte (Ladezeit und alle Seiten) rufen die Glieder in der Reihenfolge der alten Kette auf (${full.length} Glieder im Vollauf).`);
