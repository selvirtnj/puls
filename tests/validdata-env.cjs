// Lädt die komplette Web-App (alle Skripte aus index.html in echter Reihenfolge) in eine node:vm.
// Gemeinsame Umgebung für check-validdata.cjs und die Tests, die validData prüfen; keine Netz-, Speicher- oder DOM-Wirkung nach außen.
const fs=require('node:fs'),vm=require('node:vm');

const read=file=>fs.readFileSync(file,'utf8');
const scriptList=()=>[...read('index.html').matchAll(/<script src="([^"?#]+)/g)].map(m=>m[1]);
// Zuweisungen an validData im Quelltext: Funktionsdeklaration oder `validData=` / `validData =` (nicht `.validData`, nicht `==`).
const ASSIGN=/(?<![.\w$])validData\s*=(?!=)|function\s+validData\s*\(/g;
const assignmentCount=text=>(text.match(ASSIGN)||[]).length;

// Die eine validData steht in js/app.js und reicht von „function validData(“ bis zur schließenden Klammer in Spalte 0.
// Ihre Abschnitte beginnen mit einer Zeile „ //§ Name“ („ //§! Name“ = Aufbau der Funktion, nicht einzeln abschaltbar).
function validDataSource(text=read('js/app.js')){
 const start=text.search(/^function validData\(/m),end=text.indexOf('\n}',start)+2;
 return {start,end,source:text.slice(start,end)};
}
function sections(text=read('js/app.js')){
 const lines=validDataSource(text).source.split(/\r?\n/),found=[];
 lines.forEach((line,i)=>{const m=/^ \/\/§(!?) (.*)$/.exec(line);if(m)found.push({line:i,structural:m[1]==='!',label:m[2]})});
 return found.map((s,i)=>({...s,end:i+1<found.length?found[i+1].line:lines.length-1}));
}
// app.js-Text ohne den Abschnitt Nr. index (Zeilen bis zum nächsten Abschnitt).
function withoutSection(text,index){
 const {start,end,source}=validDataSource(text),lines=source.split(/\r?\n/),s=sections(text)[index];
 return text.slice(0,start)+lines.filter((_,i)=>i<s.line||i>=s.end).join('\n')+text.slice(end);
}

function stubElement(el){
 return {value:'',dataset:{},style:{setProperty(){},removeProperty(){}},innerHTML:'',textContent:'',
  classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},removeEventListener(){},
  showModal(){this.open=true},close(){this.open=false},remove(){},querySelector:()=>null,querySelectorAll:()=>[],
  get content(){return el('c'+Math.random())},appendChild(){},setAttribute(){},getAttribute:()=>null,focus(){},scrollIntoView(){}};
}

// Die eine render() steht in js/app.js (Refactor Phase 4) und reicht von „function render(){“ bis zur schließenden Klammer in Spalte 0.
// Tests, die einzelne Dateien mit render-Gliedern in einen Stub laden, führen sie dort aus; der Stub liefert nur den Kern als renderBase().
const renderSource=(text=read('js/app.js'))=>{const start=text.search(/^function render\(\)\{/m);if(start<0)throw Error('render fehlt in js/app.js');return text.slice(start,text.indexOf('\n}',start)+2)};

// options.transform: {Datei: text=>neuerText} ändert Quelltexte vor dem Laden. options.storage: Startinhalt von localStorage.
// options.afterScript(file, {ctx, run}) läuft nach jedem Skript (Zwischenstände während des Ladens).
function loadApp(options={}){
 const els=new Map(),el=id=>{if(!els.has(id))els.set(id,stubElement(el));return els.get(id)};
 const store=new Map(Object.entries(options.storage||{}));
 const ctx={
  document:{getElementById:el,addEventListener(){},removeEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,
   createElement:()=>el('x'+Math.random()),documentElement:el('html'),body:el('body'),head:el('head'),activeElement:null,
   hidden:false,visibilityState:'visible',readyState:'complete'},
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v))},removeItem:k=>{store.delete(k)}},
  crypto:require('node:crypto').webcrypto,Date,Intl,console:{log(){},warn(){},error(){}},
  location:{protocol:'file:',search:'',href:'',hash:''},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  navigator:{vibrate(){},onLine:true},alert(){},confirm:()=>true,TextEncoder,TextDecoder,URL,Blob,
  fetch:()=>Promise.reject(Error('kein Netz im Test')),matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
  requestAnimationFrame:()=>1,cancelAnimationFrame(){},getComputedStyle:()=>({getPropertyValue:()=>''}),
  history:{pushState(){},replaceState(){}},Image:function(){},
  MutationObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},
  CustomEvent:class{},Event:class{},addEventListener(){},removeEventListener(){}
 };
 ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;ctx.scrollTo=()=>{};ctx.innerWidth=390;
 vm.createContext(ctx);
 const run=text=>vm.runInContext(text,ctx),loaded=[],errors=[];
 for(const file of scriptList()){
  let text=read(file);
  if(options.transform&&options.transform[file])text=options.transform[file](text);
  try{vm.runInContext(text,ctx,{filename:file});loaded.push(file)}catch(error){errors.push(file+': '+error.message)}
  if(options.afterScript)options.afterScript(file,{ctx,run});
 }
 return {ctx,run,loaded,errors,store};
}
// Die echte validData der vollständig geladenen App für Tests einzelner Dateien. Die Eingabe wird in die Realm der App kopiert,
// das Ergebnis ist ein Boolean. Wirft die Funktion, wirft auch der Aufruf. baseState(name) ist ein gültiger Zustand aus tests/fixtures/validdata/cases.json (Standard: der kleinste).
let shared;
function appValidator(){
 shared??=loadApp();
 if(shared.errors.length)throw Error('App lädt nicht im Stub: '+shared.errors.join('; '));
 const copy=shared.run('(function copy(x){if(Array.isArray(x))return x.map(copy);if(x&&typeof x==="object"){const o={};for(const k of Object.keys(x))o[k]=copy(x[k]);return o}return x})');
 const call=shared.run('(function(s){return !!validData(s)})');
 const fn=s=>call(copy(s));
 fn.after=s=>{const c=copy(s);call(c);return JSON.parse(JSON.stringify(c))};
 return fn;
}
const baseState=(name='initial')=>JSON.parse(JSON.stringify(JSON.parse(read('tests/fixtures/validdata/cases.json')).states[name]));
module.exports={renderSource,loadApp,scriptList,assignmentCount,read,ASSIGN,validDataSource,sections,withoutSection,appValidator,baseState};
