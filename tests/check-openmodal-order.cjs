// Refactor Phase 4, Schritt 3: openModal ist eine Funktion (js/app.js); die frühere Kette aus 17 Gliedern besteht aus benannten Gliedern in ihren
// Dateien (openModalBase = alter Kern in app.js; openModalBefore…/openModalAfter… je Datei, gesetzt dort, wo früher der Wrapper installiert wurde).
// Beleg „alt = neu“: tests/fixtures/openmodal-order.json enthält für die Ladezeit und für viele echte Aufrufer (Deutsch/Englisch, Erststart, schon offenes
// Fenster, Schnellmenü offen, direkte Aufrufe mit verschiedenen Titeln und zusätzlichen Argumenten) zweierlei, aufgezeichnet an der alten Kette (Commit 81343a3):
//   - die Reihenfolge der Glieder (Eintritt in jedes Glied) und die Reihenfolge der Wirkungen (Klassen am Fenster, scrollTop, Aufrufe von stopBarcode,
//     translateUI, pulsSound usw., Schreiben von Titel und Inhalt),
//   - Titel, Inhalt (Länge und SHA-256), Rückgabewert und die Zustände danach (Klassen, offen).
//   node tests/check-openmodal-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Das Golden hängt nicht von der App-Version (Version N, ?v=N) und nicht von der Uhrzeit ab: Anzeigeversion wird normalisiert, die Uhr der App steht fest.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/openmodal-order.json',OLD_COMMIT='81343a3',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

// [Datei, Nr. des alten Wrappers in der Datei, Glied vorher, Glied nachher].
const GLIEDER=[
 ['products',1,'openModalBeforeProducts',null],['flows',1,null,'openModalAfterFlows'],['interactions',1,'openModalBeforeInteractions',null],
 ['polish',1,null,'openModalAfterPolish'],['compact',1,'openModalBeforeCompact',null],['preview-mode',1,null,'openModalAfterPreviewMode'],
 ['workout-polish',1,'openModalBeforeWorkoutPolish',null],['comfort',1,null,'openModalAfterComfort'],['i18n',1,null,'openModalAfterLanguage'],
 ['food-flow',1,'openModalBeforeFoodFlow',null],['training-polish',1,'openModalBeforeTrainingPolish',null],['app-polish',1,'openModalBeforeAppPolish','openModalAfterAppPolish'],
 ['sound-engine',1,'openModalBeforeSound','openModalAfterSound'],['design-system',1,null,'openModalAfterDesignSystem'],
 ['food-page',1,'openModalBeforeFoodPage',null],['motion',1,null,'openModalAfterMotion']
];
const label=(file,nr)=>`${file}#${nr}`;
const FUNCTION_LABEL=new Map([['openModalBase','kern:app']]);
for(const [file,nr,before,after] of GLIEDER){if(before)FUNCTION_LABEL.set(before,label(file,nr)+'.vorher');if(after)FUNCTION_LABEL.set(after,label(file,nr)+'.nachher')}
const HAS_BEFORE=new Set(GLIEDER.filter(g=>g[2]).map(g=>label(g[0],g[1]))),HAS_AFTER=new Set(GLIEDER.filter(g=>g[3]).map(g=>label(g[0],g[1])));

const PREFIX=()=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');try{return fn.apply(this,a)}finally{__ev(name+'<')}}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Wrapper hält seinen Vorgänger als `const x=openModal;`; der Test meldet „>“ vor und „<“ nach dessen Aufruf.
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=openModal;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(label(fileKey(file),++nr))},openModal);`);
 if(file==='js/app.js')text=text.replace("function openModal(title,body){$('mt')","function openModal(title,body){__ev('kern:app');$('mt')");
 return PREFIX()+text;
}
// Neuer Code: Jedes Glied meldet sich zu Beginn.
function instrumentNew(file,text){
 text=text.replace(/(globalThis\.(openModal(?:Before|After)\w+)=function \2\([^)]*\)\{|function openModalBase\([^)]*\)\{)/g,m=>{
  const name=/(openModal\w+)\(/.exec(m)[1];return m+`__ev(${JSON.stringify(FUNCTION_LABEL.get(name))});`;
 });
 return PREFIX()+text;
}
// Alte Ereignisse „name>“ / „name<“ werden zu „name.vorher“ / „name.nachher“, aber nur dort, wo der Wrapper etwas vor bzw. nach dem inneren Aufruf tat.
function canon(events,mode){
 if(mode!=='old')return [...events];
 const out=[];
 for(const e of events){
  const m=/^(.+)([><])$/.exec(e);
  if(!m){out.push(e);continue}
  if(m[2]==='>'&&HAS_BEFORE.has(m[1]))out.push(m[1]+'.vorher');
  if(m[2]==='<'&&HAS_AFTER.has(m[1]))out.push(m[1]+'.nachher');
 }
 return out;
}
const normalize=text=>String(text).replace(/Version \d+/g,'Version N').replace(/\?v=\d+/g,'?v=N').replace(/APP_VERSION=\d+/g,'APP_VERSION=N');
const digest=text=>({laenge:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex')});

// Wirkungen, die jedes Glied haben kann, werden mit Aufzeichnung umhüllt (die Funktionen selbst bleiben die echten) und das Fenster bekommt zustandsbehaftete Attrappen.
const EFFECT_FUNCTIONS=['stopBarcode','cancelLookup','applyAppIcon','translateUI','pulsSound','dsDecorateSheet','scrollViewTop','decorateFirstRunPreview'];
function harness(app){
 const fx=[],push=s=>fx.push(s),flags={grid:false};
 const modal=app.run('modal'),mt=app.run("$('mt')"),mb=app.run("$('mb')"),body=app.ctx.document.body;
 const classList=(name,set)=>({add(...c){push(`${name}.add ${c}`);c.forEach(x=>set.add(x))},remove(...c){push(`${name}.remove ${c}`);c.forEach(x=>set.delete(x))},
  toggle(c,force){push(`${name}.toggle ${c} ${force}`);const on=force===undefined?!set.has(c):!!force;on?set.add(c):set.delete(c);return on},contains:c=>set.has(c)});
 const modalClasses=new Set(),bodyClasses=new Set();
 modal.classList=classList('modal',modalClasses);body.classList=classList('body',bodyClasses);
 modal.style={setProperty(){},removeProperty:p=>push('modal.style.removeProperty '+p)};
 let scrollTop=0,title='',html='';
 Object.defineProperty(modal,'scrollTop',{get:()=>scrollTop,set:v=>{scrollTop=v;push('modal.scrollTop='+v)},configurable:true});
 Object.defineProperty(modal,'offsetWidth',{get:()=>{push('modal.offsetWidth');return 0},configurable:true});
 Object.defineProperty(mt,'textContent',{get:()=>title,set:v=>{title=v;push('title='+normalize(v))},configurable:true});
 Object.defineProperty(mb,'innerHTML',{get:()=>html,set:v=>{html=v;const t=normalize(v);push(`body=${t.length}:${digest(t).sha256.slice(0,12)}`)},configurable:true});
 modal.showModal=function(){push('modal.showModal');this.open=true};
 modal.querySelector=selector=>{push('modal.querySelector '+selector);return flags.grid?{}:null};
 app.ctx.clearTimeout=()=>push('clearTimeout');
 app.ctx.__fx=push;app.ctx.__modal=modal;
 app.run("globalThis.__rec=(n,f)=>function(...a){__fx(n+'('+a.map(x=>x===__modal?'modal':typeof x==='function'?'fn':x&&typeof x==='object'?'obj':String(x)).join(',')+')');return f.apply(this,a)};"
  +EFFECT_FUNCTIONS.map(n=>`if(typeof ${n}==='function')${n}=__rec('${n}',${n});`).join(''));
 return {fx,flags,modal,get title(){return title},get html(){return html},
  reset(opt={}){modalClasses.clear();bodyClasses.clear();(opt.modalClasses||[]).forEach(c=>modalClasses.add(c));(opt.bodyClasses||[]).forEach(c=>bodyClasses.add(c));
   modal.open=!!opt.open;flags.grid=!!opt.grid;title='';html='';scrollTop=0;fx.length=0;app.ctx.__log.length=0},
  snapshot:()=>({modal:[...modalClasses].sort().join(' '),body:[...bodyClasses].sort().join(' '),offen:!!modal.open})};
}

// Echte Aufrufer. Zustand wird vor dem Aufruf aus den Fixtures geladen; das Fenster ist zu Beginn geschlossen, sofern nichts anderes verlangt ist.
const RESET="accountSection='';qaPage='';qaParent='';qaRatioOpen=false;cloudSession=null;page='home'";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const PROFILE="state.profile={age:30,height:180,weight:82,target:75,sex:'male',activity:1.375,method:'mifflin'};state.plan.direction='lose';";
const WEIGHTS="state.weights=[{id:'w1',date:'2026-11-01',kg:84},{id:'w2',date:'2026-11-12',kg:82.2},{id:'w3',date:'2026-11-13',kg:82}];";
const WORKOUT="state.workouts=[{id:'wa',date:'2026-11-13',name:'Gym',finished:false,exercises:[{id:'ea',name:'Bench',sets:[{kg:40,reps:8,done:false}]}]}];";
const CALLERS=['foodForm()',"foodForm('Abendessen')",'weightForm()','settings()','quickAddMenu()',"exerciseForm('wa')",'waterForm()','waterGoalForm()','microTargetForm()',
 'nameProfile()','globalRestSettings()','appearanceSettings()','pickDiaryDate()','csvExportForm()','measurementsForm()','fastingForm()','liftingTools()','runGoalForm()',
 "accountActionForm('reset')","accountActionForm('delete')","cloudAuthForm('signin')",'nutritionInputForm()','recipeImportForm()','qaForecastSheet()','qaHighlightSheet()','qaRatioSheet()',
 'progressPhotos()','recipeIngredientPicker()','recipeOwnIngredient()'];
const scenarios=[];
const add=(name,setup,call,flags={})=>scenarios.push({name,setup,call,flags});
for(const call of CALLERS){
 add('de:'+call,loadState('full')+PROFILE+WEIGHTS+WORKOUT,call);
 add('en:'+call,loadState('full')+PROFILE+WEIGHTS+WORKOUT+"state.language='en';",call);
}
add('leer:foodForm',loadState('initial'),'foodForm()');
add('profil:settings-en',loadState('mit-profil-und-trainingsplan')+"state.language='en';",'settings()');
add('offen:weightForm',loadState('full')+PROFILE+WEIGHTS,'weightForm()',{open:true});
add('offen:foodForm',loadState('full')+PROFILE,'foodForm()',{open:true,modalClasses:['sheetclosing','exercisesheet','foodsheet']});
add('schnellmenue-offen:foodForm',loadState('full')+PROFILE,'foodForm()',{bodyClasses:['quickaddopen']});
add('schnellmenue-offen-mit-raster:foodForm',loadState('full')+PROFILE,'foodForm()',{bodyClasses:['quickaddopen'],grid:true});
add('schnellmenue-zweimal',loadState('full')+PROFILE,"quickAddMenu();quickAddMenu();quickAddMenu()");
add('altes-fenster:weightForm',loadState('full')+PROFILE+WEIGHTS,'weightForm()',{modalClasses:['planningsheet','ffsheet','fpage','sheetarriving','exercisesheet']});
for(const t of ['Essen hinzufügen','Mein Rezept','Zutat hinzufügen','Eigene Zutat','Rezept importieren','Text & Sprache','Dein Profil & deine Ziele','Etwas anderes','','Quick add'])
 add('direkt:'+t,loadState('full'),`openModal(${JSON.stringify(t)},'<p>'+${JSON.stringify(t)}+'</p>')`);
add('direkt:zusatzargumente',loadState('full'),"openModal('Essen hinzufügen','<i>x</i>',1,{a:2},'drei')");
add('direkt:ohne-argumente',loadState('full'),'openModal()');
add('direkt:nur-titel',loadState('full'),"openModal('Nur Titel')");
add('direkt:this',loadState('full'),"openModal.call({x:1},'Mit this','<b>this</b>')");
add('direkt:offen-zweimal',loadState('full'),"openModal('A','<i>A</i>');openModal('B','<i>B</i>')");
add('direkt:zusammensetzen',loadState('full'),"[openModal('A','a'),openModal('Dein Profil & deine Ziele','b'),openModal('Essen hinzufügen','c')].join('|')");

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 const result={laden:canon(app.ctx.__log,mode)};
 const h=harness(app);
 result.faelle={};
 for(const s of scenarios){
  h.reset(s.flags);
  let value;
  try{
   app.run(RESET+';'+s.setup);h.fx.length=0;app.ctx.__log.length=0;
   value=app.run(`(()=>{let r=(()=>{${s.call.includes(';')?s.call+';return undefined':'return '+s.call}})();return typeof r+':'+String(r)})()`);
  }catch(error){value='!'+error.message}
  const text=normalize(h.html);
  result.faelle[s.name]={glieder:canon(app.ctx.__log,mode).join(' '),wirkung:h.fx.join(' | '),titel:normalize(h.title),...digest(text),rueckgabe:normalize(value),danach:h.snapshot()};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: openModal ist nur in js/app.js deklariert; Zuweisungen gibt es keine mehr.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+openModal\s*\(/.test(code(f))),['js/app.js'],'openModal darf nur in js/app.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])openModal\s*=\s*(?:async\s*)?function\b/.test(code(f))),[],'openModal wird von keiner Datei mehr umhüllt');
assert.deepEqual(jsFiles.filter(f=>/=\s*openModal\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte openModal-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
if(process.argv.includes('--accept-ui')){require('./accept-ui.cjs')(FIXTURE,golden,{alt:golden.alt,...now},{html:['laenge','sha256'],mask:/body=\d+:[0-9a-f]{12}/g});process.exit(0)} // nur HTML-Werte neu, nach gewollter UI-Änderung
for(const group of ['standard','erststart']){
 assert.deepEqual(Object.keys(now[group].faelle),Object.keys(golden[group].faelle),`${group}: Zustände weichen vom Golden ab`);
 assert.deepEqual(now[group].laden,golden[group].laden,`${group}: Aufrufe von openModal während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  assert.equal(got.glieder,expected.glieder,`${group}/${name}: Reihenfolge der Glieder weicht von der alten Kette (${golden.alt}) ab`);
  assert.equal(got.wirkung,expected.wirkung,`${group}/${name}: Reihenfolge der Wirkungen weicht ab`);
  assert.equal(got.titel,expected.titel,`${group}/${name}: Titel weicht ab`);
  assert.equal(got.laenge,expected.laenge,`${group}/${name}: Länge des Inhalts weicht ab`);
  assert.equal(got.sha256,expected.sha256,`${group}/${name}: Inhalt weicht ab`);
  assert.equal(got.rueckgabe,expected.rueckgabe,`${group}/${name}: Rückgabewert weicht ab`);
  assert.deepEqual(got.danach,expected.danach,`${group}/${name}: Zustand danach weicht ab`);
 }
}
const full=Object.values(golden.standard.faelle).find(f=>f.glieder.startsWith('food-page#1.vorher')).glieder.split(' ');
assert.equal(full.at(0),'food-page#1.vorher');assert.equal(full.at(-1),'motion#1.nachher');assert(full.includes('kern:app'));
console.log(`PASS: openModal ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Zustände liefern Ablauf, Wirkungen und Inhalt wie die alte Kette (${full.length} Glieder im Vollauf).`);
