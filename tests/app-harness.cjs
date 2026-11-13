// Gemeinsames App-Harness für VM-Tests: lädt die echte App mit synthetischem Profil. Wird als Quelltext eingelesen, nicht per require.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/app-harness/'+name+'.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const assetVersion=fs.readFileSync('index.html','utf8').match(/js\/native-bridge\.js\?v=(\d+)/)[1];
const sessionId=fixture('snapshot').userId,input=fixture('training-input');
const bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split('run(`state.foods=')[0]
  .replace("protocol:'file:'","protocol:'file:',search:options.preview?'?erststart=1':''")
  .replace("value:'',dataset", "focus(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []},value:'',dataset")
  .replace('style:{setProperty(){}}','style:{setProperty(){},removeProperty(){}}');
// Same order as index.html for every file in the training chains (setValue, finish, start, rest, picker, superset).
const files=['interactions','lifecycle','workout-polish','comfort','tracker-tools','nutrition-input','adaptation','food-search','catalog-search','food-upgrade','cloud',
  'account-guide','quick-units','progress-metrics','machine-library','profile-refresh','rest-popup','workout-controls','exercise-muscles','training-polish','running','run-metrics'];
function app(options={}){
  const test=vm.runInNewContext('(function(require,options){'+bootstrap+';return {ctx,run,el}})(require,options)',{require,options,console});
  const {ctx,run,el}=test,events={window:{},document:{}},timers=new Map(),writes=[],observers=[];
  const clock={now:options.now??input.now},RealDate=Date;
  ctx.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock.now]))}static now(){return clock.now}};run('date=today()');
  const store=options.store||new Map();let time=0,timerId=0;
  const on=(surface,name,fn)=>{(events[surface][name]??=[]).push(fn)};
  const event=(surface,name,data={})=>{for(const fn of events[surface][name]||[])fn(data)};
  Object.assign(ctx.localStorage,{getItem:key=>store.get(key)??null,setItem(key,value){writes.push(key);if(options.failWrite?.(key))throw Error('quota');store.set(key,String(value))},removeItem:key=>store.delete(key)});
  ctx.document.visibilityState='visible';ctx.document.readyState='loading';ctx.document.documentElement.dataset={scheme:'dark'};
  ctx.document.currentScript={src:'http://localhost/js/native-bridge.js?v='+assetVersion};
  ctx.document.addEventListener=(name,fn)=>on('document',name,fn);ctx.window.addEventListener=(name,fn)=>on('window',name,fn);
  const htmlClasses=new Set();ctx.document.documentElement.classList={add:x=>htmlClasses.add(x),remove:x=>htmlClasses.delete(x),toggle(x,v){if(v)htmlClasses.add(x);else htmlClasses.delete(x)},contains:x=>htmlClasses.has(x)};
  ctx.document.head={appendChild(){}};ctx.document.createElement=()=>({content:{querySelector:()=>null}});
  ctx.document.body.classList.toggle=()=>{};ctx.document.body.classList.contains=()=>false;
  for(const id of ['workout-dock','session-root']){el(id).remove=()=>{};el(id).querySelector=()=>null}
  ctx.MutationObserver=class{constructor(callback){observers.push(callback)}observe(){}};
  run('render=function(){adaptiveGoals()};dismissSheet=function(){};var navSymbols={workout:""};');
  // i18n.js (DOM translator) is not loaded; its englishUI table is, so later files add their entries as in the app.
  run('var englishUI={}');
  for(const file of files){run(fs.readFileSync('js/'+file+'.js','utf8'));run('render=function(){adaptiveGoals()}')}
  run('var setAppLanguage=function(){},chooseAppIcon=function(){}');
  for(const file of ['account-refresh','compact','app-polish']){run(fs.readFileSync('js/'+file+'.js','utf8'));run('render=function(){adaptiveGoals()}')}
  run('var phIcon=function(){return ""},pulsIcon=phIcon');run(fs.readFileSync('js/design-system.js','utf8'));run('render=function(){adaptiveGoals()}');
  // The rest-end dialog is DOM-only; count its calls instead (its wrapper chain in rest-popup.js stays real).
  run('var popupCalls=0;showRestPopup=function(){popupCalls++}');
  run('state.onboardingComplete=true;state.setupPending=false;setupPending=false;modal.close();');
  run('state='+JSON.stringify(options.profile??input.profile));
  if(!options.preview)store.set('puls-v1',run('JSON.stringify(state)'));
  run('cloudSession={user:{id:'+JSON.stringify(sessionId)+'}};cloudRevision=17;cloudDirty=false;cloudConflict=false');
  ctx.setTimeout=(fn,delay=0)=>{const id=++timerId;timers.set(id,{fn,at:time+delay});return id};ctx.clearTimeout=id=>timers.delete(id);
  ctx.requestAnimationFrame=fn=>fn();ctx.console={...console,warn(){}};
  ctx.window.pulsNativeFeatures=options.features??[];
  const load=()=>{ctx.document.readyState='complete';event('window','load')};
  const tick=ms=>{time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}};
  return {...test,options,clock,store,writes,timers,event,tick,load,mutate:()=>observers.forEach(fn=>fn([])),
    state:()=>JSON.parse(run('JSON.stringify(state)'))};
}
