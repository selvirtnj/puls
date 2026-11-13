// Synthetic rendered markup and real i18n. No layout, real clipboard or iOS claims.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(file,'utf8');
const {renderSource}=require('./validdata-env.cjs');
let harness=read('tests/check-native-training.cjs').split('const started=options=>')[0]
 .replace("run('var englishUI={}');","run(fs.readFileSync('js/i18n.js','utf8'));");
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const t=app({handler:false,features:[],preview:true});
for(const name of ['food-diary','quick-account-v87','food-flow','food-photo','workout-import'])t.run(read('js/'+name+'.js'));
for(const id of ['barcode-camera','foodpreview'])t.el(id).classList.contains=()=>false;
t.el('ff-torch').setAttribute=()=>{};
const german=/[äöüßÄÖÜ]|\b(?:und|dein|deine|deinen|für|nicht|Gewicht|Menge|Ziele|Einträge|erfassen|erfasst|gespeichert|Bitte|Keine|Kein|Woche|Sätze|Wiederholungen)\b/;
function english(name,html){
 assert.equal(typeof html,'string',name);
 const texts=[...html.matchAll(/>([^<>]+)</g),...html.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map(m=>m[1]);
 for(const text of texts){
  const translated=t.run('translatedUI('+JSON.stringify(text)+')');
  assert(!german.test(translated),name+' contains German UI text: '+translated);
 }
}
for(const language of ['de','en']){
 t.run('state.language='+JSON.stringify(language));
 for(const expression of ['qaDisplayBody()','qaProfileBody()','qaTargetsBody()','qaQuickHTML()','accountAppearanceCard()','home()','nutrition()','workoutPage()']){
  const html=t.run(expression);assert(html.length>0,expression);
  if(language==='en')english(expression,html);
 }
 t.ctx.window.workoutImportForm();
 if(language==='en')english('CSV import',t.el('mb').innerHTML);
 t.run('nameProfile()');
 if(language==='en')english('Onboarding name',t.el('mb').innerHTML);
 t.el('modal').open=true;t.ctx.window.foodPhotoOpen();
 if(language==='en')english('AI photo',t.el('foodbody').innerHTML);
}
const boardHarness=read('tests/check-friends-board.cjs').split('const self=')[0];
const board=vm.runInNewContext('(function(require){'+boardHarness+';return fixture})(require)',{require,console});
const boardFixture=board({language:'en',snapshot:{self:{code:'ABCDEF123456',name:'Sample',strength_rank:12},friends:[],incoming:[],outgoing:[],nudges:[]}});
for(const view of ['friends','board','exercises','ranks']){
 boardFixture.api.view(view);english('Friends '+view,boardFixture.mount.innerHTML);
}
// Shared literal validation/toast/status messages must be covered too.
for(const name of fs.readdirSync('js').filter(f=>f.endsWith('.js')&&!f.startsWith('native-')&&f!=='i18n.js')){
 for(const match of read('js/'+name).matchAll(/(?:toast\(|return |textContent=)'([^'<>]+)'|\b(?:aria-label|placeholder|title|alt)="([^"${}]+)"/g)){
  const text=match[1]??match[2];if(!german.test(text)||text.includes('${'))continue;
  const translated=t.run('translatedUI('+JSON.stringify(text)+')');
  assert(!german.test(translated),name+' has untranslated message: '+text);
 }
}
// The same native form IDs, weekday values and save handlers remain authoritative.
const extrasHarness=read('tests/check-shell-extras.cjs').split('(async()=>{')[0];
const extras=vm.runInNewContext('(function(require){'+extrasHarness+';return fixture})(require)',{require,console});
for(const language of ['de','en']){
 const f=extras({features:['healthWrite','localReminders'],state:{language,workouts:[],weights:[]}});
 f.c.window.pulsNativeExtrasOpen();const html=f.html();
 assert.equal((html.match(/role="switch"/g)||[]).length,3);
 for(const key of ['training','weight']){
  assert(html.includes('id="native-'+key+'-time"'));
  assert.equal((html.match(new RegExp('name="native-'+key+'-day"','g'))||[]).length,7);
 }
 assert(!html.includes('Local notifications.')&&!html.includes('Lokale Mitteilungen.'));
 if(language==='en')english('iPhone features',html);
}
// Sharing sends only the code. Rejected share falls back to exact clipboard text.
const friendsHarness=read('tests/check-friends.cjs').split('async function main(){')[0];
const friends=vm.runInNewContext('(function(require){'+friendsHarness+';return fixture})(require)',{require,console,AbortController,setImmediate});
(async()=>{
 const f=friends();f.ctx.state.language='en';await f.api.refresh(true);
 english('Friends',f.panel.innerHTML);
 let shared,copied;
 f.ctx.navigator.share=async value=>{shared=value};await f.api.share();
 assert.deepEqual(JSON.parse(JSON.stringify(shared)),{text:'ABCDEF123456'});
 f.ctx.navigator.share=async()=>{throw Error('unavailable')};
 f.ctx.navigator.clipboard={writeText:async value=>{copied=value}};await f.api.share();
 assert.equal(copied,'ABCDEF123456');assert.equal(f.alerts.at(-1),'Copied');
 delete f.ctx.navigator.share;copied=null;await f.api.share();assert.equal(copied,'ABCDEF123456');
 assert(!read('js/page-slide.js').includes('cloneNode'),'no duplicate page snapshot');
 assert(!read('js/design-system.js').includes('dsAppearanceBase'),'one owner for colour controls');
 // Real helper resets nested scrollers immediately and after layout, preserving horizontal position.
 const helper=read('js/app.js').slice(read('js/app.js').indexOf('let scrollViewRevision='),read('js/app.js').indexOf('function go(p)'));
 const frames=[],nested={scrollTop:140,scrollLeft:25,scrollTo(options){assert.equal(options.behavior,'instant');this.scrollTop=options.top;this.scrollLeft=options.left}};
 const root={scrollTop:80,scrollLeft:0,querySelectorAll:()=>[nested]};let pageTop=60;
 const c={window:{scrollTo:options=>{pageTop=options.top}},document:{scrollingElement:{scrollTop:60}},requestAnimationFrame:fn=>frames.push(fn)};
 vm.createContext(c);vm.runInContext(helper,c);c.scrollViewTop(root);assert.equal(root.scrollTop,0);assert.equal(nested.scrollTop,0);assert.equal(nested.scrollLeft,25);assert.equal(pageTop,60);
 root.scrollTop=90;frames.shift()();assert.equal(root.scrollTop,0);
 c.scrollViewTop();assert.equal(pageTop,0);
 // Exercise the final render wrapper. Routine repaints preserve position, subtab visits reset it.
 let resets=0;
 const motionContext={console,Date,Math,Number,String,Object,Set,Map,WeakSet,Intl,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,matchMedia:()=>({matches:true,addEventListener(){}}),addEventListener(){},
  MutationObserver:class{observe(){}},scrollViewTop:()=>{resets++},
  document:{documentElement:{classList:{toggle(){}}},body:{},querySelectorAll:()=>[],addEventListener(){},getElementById:()=>null}};
 motionContext.window=motionContext;vm.createContext(motionContext);
 vm.runInContext("var state={display:{motion:'system'}},page='workout',trainTab='current',qaPage='',accountSection='';function renderBase(){}",motionContext);vm.runInContext(renderSource(),motionContext);
 vm.runInContext(read('js/motion.js'),motionContext);
 vm.runInContext('render()',motionContext);assert.equal(resets,0);
 for(const tab of ['routines','calendar','insights','current']){
  const before=resets;vm.runInContext('trainTab='+JSON.stringify(tab)+';render()',motionContext);assert.equal(resets,before+1);
  vm.runInContext('render()',motionContext);assert.equal(resets,before+1);
 }
 console.log('PASS: DE/EN rendered views, form/status messages, native controls, exact friend code, single-layer transitions and nested scroll reset (VM)');
})().catch(error=>{console.error(error);process.exitCode=1});
