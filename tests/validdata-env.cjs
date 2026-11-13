// Lädt die komplette Web-App (alle Skripte aus index.html in echter Reihenfolge) in eine node:vm.
// Gemeinsame Umgebung für check-validdata.cjs; keine Netz-, Speicher- oder DOM-Wirkung nach außen.
const fs=require('node:fs'),vm=require('node:vm');

const read=file=>fs.readFileSync(file,'utf8');
const scriptList=()=>[...read('index.html').matchAll(/<script src="([^"?#]+)/g)].map(m=>m[1]);
// Zuweisungen an validData im Quelltext: Funktionsdeklaration oder `validData=` / `validData =` (nicht `.validData`, nicht `==`).
const ASSIGN=/(?<![.\w$])validData\s*=(?!=)|function\s+validData\s*\(/g;
const assignmentCount=text=>(text.match(ASSIGN)||[]).length;

// Eine Zuweisung (Nr. index, nullbasiert, ohne die Deklaration in app.js) wird zu einer toten Zuweisung,
// die Kette überspringt dieses Glied. Dient dem Wrapper-Wirkungstest.
function skipAssignment(text,index){
 let seen=-1;
 return text.replace(/(?<![.\w$])validData(\s*=)(?!=)/g,(all)=>++seen===index?'globalThis.__skippedValidData=':all);
}

function stubElement(el){
 return {value:'',dataset:{},style:{setProperty(){},removeProperty(){}},innerHTML:'',textContent:'',
  classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},removeEventListener(){},
  showModal(){this.open=true},close(){this.open=false},remove(){},querySelector:()=>null,querySelectorAll:()=>[],
  get content(){return el('c'+Math.random())},appendChild(){},setAttribute(){},getAttribute:()=>null,focus(){},scrollIntoView(){}};
}

// options.skip: {file, index} lässt eine validData-Zuweisung aus. options.storage: Startinhalt von localStorage.
// options.afterScript(file, {ctx, run}) läuft nach jedem Skript (Zwischenstände der Wrapper-Kette).
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
 const run=text=>vm.runInContext(text,ctx),loaded=[],errors=[],changedBy=[];
 let previous;
 for(const file of scriptList()){
  let text=read(file);
  if(options.skip&&options.skip.file===file)text=skipAssignment(text,options.skip.index);
  try{vm.runInContext(text,ctx,{filename:file});loaded.push(file)}catch(error){errors.push(file+': '+error.message)}
  if(options.afterScript)options.afterScript(file,{ctx,run});
  if(ctx.validData!==previous){if(previous!==undefined)changedBy.push(file);previous=ctx.validData}
 }
 return {ctx,run,loaded,errors,changedBy,store};
}
module.exports={loadApp,scriptList,assignmentCount,read,ASSIGN};
