const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(file,'utf8');
function appFixture(profile=null,preview=false,stored=[]){
 const nodes=new Map(),disk=new Map([...(profile?[['puls-v1',JSON.stringify(profile)]]:[]),...stored]),events=[],listeners=new Map(),properties=new Map();
 let reads=0,fetchHandler=async()=>{throw Error('offline')};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},insertAdjacentHTML(){},remove(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
 const root={attrs:{},style:{setProperty:(k,v)=>properties.set(k,v)},setAttribute(k,v){this.attrs[k]=v}},meta={setAttribute(k,v){this[k]=v}};
 const media={matches:false,addEventListener(type,fn){this.change=fn}};
 const ctx={console,Date,Intl,URL,AbortController,crypto:require('node:crypto').webcrypto,
  location:{search:preview?'?erststart=1':'',protocol:'https:'},navigator:{onLine:false},
  document:{readyState:'loading',documentElement:root,body:node('body'),createElement:()=>node('created'),getElementById:node,querySelector:s=>s==='meta[name="theme-color"]'?meta:null,querySelectorAll:()=>[],addEventListener(){}},
  localStorage:{getItem(k){reads++;return disk.get(k)||null},setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)},
  matchMedia:()=>media,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},alert(){},confirm:()=>true,scrollTo(){},
  addEventListener(type,fn){let list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)},
  dispatchEvent(event){events.push(event);for(let fn of listeners.get(event.type)||[])fn(event)},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},
  fetch:(...args)=>fetchHandler(...args)};
 ctx.window=ctx;vm.createContext(ctx);
 const run=source=>vm.runInContext(source,ctx),load=file=>run(read(file));
 load('js/color-scheme.js');
 const earlyScheme=root.attrs['data-scheme'];
 for(let file of ['app','enhancements','products','recipes','experience','exercise-catalog','training','portions','insights','finish','personal','navigation','flows','visuals','designs-extra'])load('js/'+file+'.js');
 return {ctx,run,load,disk,media,root,meta,events,properties,earlyScheme,reads:()=>reads,setFetch:fn=>fetchHandler=fn};
}
function base(){return {goals:{kcal:2200,p:150,c:250,f:70},foods:[],weights:[],workouts:[],custom:[],onboardingComplete:true}}
async function checkSchemeAndConnectivity(){
 for(let design of ['classic','apple','cronometer','liftoff','hevy','aurora','mono','terra','volt','blueprint','nocturne']){
  const original={...base(),appDesign:design,colorTheme:'rose'},fixture=appFixture(original),{run,disk}=fixture;
  const expected=['terra','blueprint'].includes(design)?'light':'system';
  assert.equal(run('getColorScheme()'),expected);assert.equal(run('state.colorScheme'),undefined);assert.equal(run('state.appDesign'),design);assert.equal(run('state.colorTheme'),'rose');
  assert.equal(disk.get('puls-color-scheme'),expected);assert.deepEqual(JSON.parse(disk.get('puls-v1')),original,'Startup never saves/changes the old profile');
  assert.equal(fixture.earlyScheme,'light');assert(run('validData(state)'));
  assert(run('validData('+JSON.stringify(original)+')'),'Old backups remain accepted without mutation');
  assert.equal(run('currentDesign()'),'classic');assert.equal(fixture.ctx.document.body.dataset.appDesign,undefined);
  assert.equal(fixture.properties.size,0,'Legacy design/accent palette no longer sets CSS variables');
  run('chooseAppDesign("volt");chooseColorTheme("mint");render()');assert.equal(run('state.appDesign'),design);assert.equal(run('state.colorTheme'),'rose');
 }
 const test=appFixture({...base(),appDesign:'terra',colorScheme:'ignored-legacy-value'},false,[['puls-color-scheme','dark']]),{run,media,root,meta}=test;
 assert.equal(test.earlyScheme,'dark');assert.equal(run('getColorScheme()'),'dark');
 for(let mode of ['system','light','dark'])for(let dark of [false,true])assert.equal(run(`resolveColorScheme('${mode}',${dark})`),mode==='system'?(dark?'dark':'light'):mode);
 for(let legacy of [null,'system','dark','sepia',1,{},['dark']])assert.equal(run('validData({...state,colorScheme:'+JSON.stringify(legacy)+'})'),true,'Legacy scheme fields never reject a backup');
 assert.equal(run('setColorScheme("sepia")'),false);assert.equal(run('getColorScheme()'),'dark');
 run('setColorScheme("system")');assert.equal(root.attrs['data-scheme'],'light');assert.equal(meta.content,'#f2f2f7');
 media.matches=true;media.change();assert.equal(root.attrs['data-scheme'],'dark');assert.equal(meta.content,'#000000');
 run('setColorScheme("light")');media.change();assert.equal(root.attrs['data-scheme'],'light');
 assert.equal(test.disk.get('puls-color-scheme'),'light');assert.equal(JSON.parse(test.disk.get('puls-v1')).colorScheme,'ignored-legacy-value');
 const preview=appFixture({...base(),appDesign:'terra',colorScheme:'dark'},true);
 assert.equal(preview.reads(),0);assert.equal(preview.run('getColorScheme()'),'system');assert.equal(preview.earlyScheme,'light');preview.run('setColorScheme("dark")');assert.equal(preview.disk.has('puls-color-scheme'),false);
 // Imported/cloud profiles never replace the device preference; IDs/snapshots survive.
 const old={...base(),appDesign:'blueprint',colorTheme:'blue',weights:[{id:'historical-weight',date:'2026-10-01',kg:80}],custom:[{id:'food-known',name:'Fixture',kcal:123,p:1,c:2,f:3}]};
 run('setColorScheme("dark")');await run('importData')({size:500,text:async()=>JSON.stringify(old)});
 assert.equal(run('getColorScheme()'),'dark');assert.equal(run('state.colorScheme'),undefined);assert.equal(run('state.weights[0].id'),'historical-weight');assert.equal(run('state.custom[0].kcal'),123);
 test.load('js/cloud.js');test.load('js/connectivity.js');
 run('cloudSession={user:{id:"fixture-user"},expires_at:Date.now()/1000+9999};cloudBaseline=JSON.stringify(state);state.goals.kcal=2300;save()');
 assert.equal(test.ctx.pulsConnectivity.pendingSync,true);assert.equal(test.ctx.pulsConnectivity.online,false);
 let count=test.events.length;run('window.pulsRefreshConnectivity()');assert.equal(test.events.length,count,'No duplicate change event');
 await run('syncCloud()');assert.equal(test.ctx.pulsConnectivity.pendingSync,true,'Failure preserves pending work');
 // The request handler below replaces only the transport; the real CAS sync logic runs.
 run('cloudRequest=async()=>null');await run('syncCloud()');assert.equal(run('cloudConflict'),true);assert.equal(test.ctx.pulsConnectivity.pendingSync,true);
 run('cloudConflict=false;cloudRequest=async(path,options)=>({revision:options.body.p_expected_revision+1})');await run('syncCloud()');
 assert.equal(test.ctx.pulsConnectivity.pendingSync,false);
 run('cloudDirty=true;cloudRequest=async(path,options)=>{state.goals.kcal++;save();return {revision:options.body.p_expected_revision+1}}');await run('syncCloud()');
 assert.equal(test.ctx.pulsConnectivity.pendingSync,true,'Edits during an upload stay pending');
 run('cloudRequest=async()=>({payload:'+JSON.stringify({...base(),appDesign:'terra'})+',revision:50});fetchCloudProfile=cloudRequest');await run('resolveCloudConflict("remote")');
 assert.equal(run('getColorScheme()'),'dark');assert.equal(run('state.colorScheme'),undefined);assert.equal(test.ctx.pulsConnectivity.pendingSync,false);assert(test.disk.has('puls-cloud-conflict-backup'));
 test.ctx.navigator.onLine=true;test.ctx.dispatchEvent({type:'online'});assert.equal(test.ctx.pulsConnectivity.online,true);
 test.ctx.navigator.onLine=false;test.ctx.dispatchEvent({type:'offline'});assert.equal(test.ctx.pulsConnectivity.online,false);
 assert(test.events.some(e=>e.type==='puls:connectivity'&&e.detail.pendingSync));
 run('render=function(){};dismissSheet=function(){};var navSymbols={workout:""}');test.load('js/account-guide.js');
 run('state=cleanFitnessState()');assert.equal(run('getColorScheme()'),'dark');assert.equal(run('state.colorScheme'),undefined);
 const client=appFixture(base()),messages=[],swListeners={};
 client.load('js/cloud.js');client.ctx.navigator.onLine=true;
 client.ctx.navigator.serviceWorker={ready:Promise.resolve({active:{postMessage:message=>messages.push(message)}}),addEventListener:(type,fn)=>swListeners[type]=fn};
 client.load('js/connectivity.js');assert.equal(messages.length,0,'Preload waits for successful window load');
 client.ctx.dispatchEvent({type:'load'});await Promise.resolve();assert.equal(messages[0].type,'puls:cache-catalogue');
 swListeners.controllerchange();await Promise.resolve();assert.equal(messages.length,2,'Newly activated SW receives preload request');
 preview.load('js/cloud.js');preview.ctx.navigator.onLine=true;
 preview.ctx.navigator.serviceWorker={get ready(){throw Error('Preview must not contact SW')},addEventListener(){throw Error('Preview must not attach SW listeners')}};
 preview.load('js/connectivity.js');preview.ctx.dispatchEvent({type:'online'});
 console.log('PASS: device-only scheme preference, legacy backup tolerance/IDs, resolver/OS listener, preview isolation, inert legacy palettes, connectivity and real sync conflict/in-flight paths with mock transport');
}
async function checkCleanStartup(){
 const fingerprint=text=>{let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return (value>>>0).toString(16)+':'+text.length};
 for(let appDesign of ['classic','terra','blueprint']){
  // Normalize only unrelated historical migrations, as in the review reproduction.
  const warm=appFixture({...base(),appDesign}),old=JSON.parse(warm.run('JSON.stringify(state)'));
  assert.equal(old.colorScheme,undefined);
  const fixture=appFixture(old),{run,ctx,disk}=fixture,calls=[];
  const before=run('JSON.stringify(state)');assert.equal(before,JSON.stringify(old));
  disk.set('puls-cloud-session',JSON.stringify({user:{id:'fixture-user'},access_token:'fixture-only',refresh_token:'fixture-only',expires_at:Date.now()/1000+9999}));
  disk.set('puls-cloud-meta-fixture-user',JSON.stringify({revision:7,dirty:false,baseline:fingerprint(JSON.stringify(old))}));
  ctx.PULS_CLOUD={url:'https://fixture.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
  fixture.setFetch(async(url,options)=>{
   calls.push({url,method:options.method});
   assert(!url.includes('/rpc/'),'Clean startup must not upload with the stale revision');
   return {ok:true,text:async()=>JSON.stringify([{payload:{...old,goals:{...old.goals,kcal:2400}},revision:9}])};
  });
  fixture.load('js/cloud.js');assert.equal(run('cloudDirty'),false);
  for(let i=0;i<10&&run('cloudBusy');i++)await new Promise(setImmediate);
  assert.equal(run('cloudBusy'),false);assert.equal(run('cloudDirty'),false);assert.equal(run('cloudConflict'),false);
  assert.equal(run('cloudRevision'),9);assert.equal(run('state.goals.kcal'),2400);
  assert.equal(calls.length,1);assert(calls[0].url.includes('/puls_profiles?'));assert.equal(calls[0].method,'GET');
  run('setColorScheme("dark")');assert.equal(run('cloudDirty'),false);assert.equal(run('state.colorScheme'),undefined);assert.equal(calls.length,1);
  assert.equal(disk.get('puls-color-scheme'),'dark');
  const reloaded=appFixture(JSON.parse(disk.get('puls-v1')),false,[['puls-color-scheme',disk.get('puls-color-scheme')]]);
  assert.equal(reloaded.run('getColorScheme()'),'dark');
 }
 const interim=appFixture({...base(),appDesign:'terra',colorScheme:'dark'});
 assert.equal(interim.run('getColorScheme()'),'light','Intermediate synced field is tolerated but ignored');
 console.log('PASS: old profile + clean meta baseline stays clean, no upload/stale-revision conflict, newer cloud revision pulls normally, schema changes stay local and survive reload');
}
async function checkWorker(){
 const stores=new Map(),base='https://fixture.invalid/puls/';let online=true,failChunk=false,failPut=false,requests=[];
 const key=value=>new URL(typeof value==='string'?value:value.url||value.href,base).pathname;
 function cacheApi(name){
  if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);
  return {match:async value=>entries.get(key(value))?.clone(),put:async(value,response)=>{if(failPut)throw Error('Quota exceeded');entries.set(key(value),response.clone())},addAll:async files=>{for(let file of files){let url=new URL(file,base),local=file==='./'?'index.html':file;entries.set(key(url),new Response(fs.readFileSync(local),{status:200}))}}};
 }
 function worker(source=read('sw.js')){
  const listeners={},ctx={URL,console,Promise,self:{registration:{scope:base},addEventListener:(type,fn)=>listeners[type]=fn,skipWaiting(){},clients:{claim(){}}},
   caches:{open:async name=>cacheApi(name),match:async value=>{for(let name of stores.keys()){let hit=await cacheApi(name).match(value);if(hit)return hit}},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},
   fetch:async value=>{const path=key(value);requests.push(path);if(!online||failChunk&&path.endsWith('foods-3.json'))throw Error('offline');return new Response(fs.readFileSync('.'+path.slice('/puls'.length)),{status:200})}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {listeners,staticName:vm.runInContext('CACHE',ctx),catalogName:vm.runInContext('CATALOG_CACHE',ctx)};
 }
 let current=worker();
 async function lifecycle(type){let work;current.listeners[type]({waitUntil:p=>work=p});await work}
 async function preload(){let work;current.listeners.message({data:{type:'puls:cache-catalogue'},waitUntil:p=>work=p});await work}
 const responseFor=async(path,mode='cors')=>{let response;current.listeners.fetch({request:{method:'GET',url:new URL(path,base).href,mode},respondWith:p=>response=p,waitUntil(){}});return response&&await response};
 failChunk=true;await preload();let catalogue=stores.get(current.catalogName);
 assert(catalogue.has('/puls/catalog/foods-0.json'));assert(!catalogue.has('/puls/catalog/foods-3.json'));
 failChunk=false;requests=[];await preload();assert(requests.includes('/puls/catalog/foods-3.json'));assert(!requests.includes('/puls/catalog/foods-0.json'),'Completed chunks are reused');
 const catalogueFiles=fs.readdirSync('catalog');for(let file of catalogueFiles)assert(catalogue.has('/puls/catalog/'+file),'Cached '+file);
 assert.equal(catalogue.size,catalogueFiles.length,'Only catalogue files cached by preload');
 await lifecycle('install');const oldStatic=current.staticName;
 assert(![...stores.get(oldStatic).keys()].some(path=>path.includes('/catalog/')),'Catalogue is separate from static assets');
 // Simulate bump-version without changing source files or the precache list.
 current=worker(read('sw.js').replace(/puls-static-\d+/, 'puls-static-99999'));
 await lifecycle('install');await lifecycle('activate');
 assert(!stores.has(oldStatic));assert.strictEqual(stores.get(current.catalogName),catalogue,'App update preserves the exact catalogue cache');
 requests=[];await preload();assert.equal(requests.length,0,'App update causes no catalogue re-download');
 online=false;
 const manifest=await responseFor('catalog/manifest.json?v=14');assert.equal((await manifest.json()).count,18200);
 for(let file of catalogueFiles){const response=await responseFor('catalog/'+file+'?v=32');assert(response.ok);assert(await response.json())}
 for(let match of read('index.html').matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^\"]*)?"/g))assert((await responseFor(match[1]+'?offline-check=1')).ok,'Every startup script/style is cached: '+match[1]);
 for(let path of ['https://fixture.supabase.co/auth/v1/token','photos/private.jpg','api/profile'])assert.equal(await responseFor(path),undefined);
 const staticCache=cacheApi(current.staticName);
 await staticCache.put(new URL('js/app.js',base),new Response('cached-js'));assert.equal(await (await responseFor('js/app.js?v=64')).text(),'cached-js');
 await staticCache.put(new URL('index.html',base),new Response('cached-shell'));assert.equal(await (await responseFor('./?offline=1','navigate')).text(),'cached-shell');
 online=true;failPut=true;
 assert((await (await responseFor('js/app.js?v=64')).text()).includes('const initial='),'Fresh network JS survives failed cache.put');
 assert.equal(await (await staticCache.match(new URL('js/app.js',base))).text(),'cached-js','Failed put leaves stale cache intact without serving it online');
 catalogue.delete('/puls/catalog/foods-0.json');assert((await responseFor('catalog/foods-0.json')).ok,'Fresh catalogue response survives failed cache.put');
 failPut=false;
 const oldCatalogueName=current.catalogName;
 current=worker(read('sw.js').replace(/puls-catalog-v\d+/, 'puls-catalog-v99999'));
 await lifecycle('activate');assert(!stores.has(oldCatalogueName),'Only a catalogue version change removes its predecessor');
 console.log('PASS: 39 catalogue files cached separately, interrupted retry, cache survives app-version activation without re-download, catalogue-version cleanup, offline shell/JS/catalogue, put-failure fallback and auth/API/photo exclusions (mock SW/cache)');
}
(async()=>{await checkSchemeAndConnectivity();await checkCleanStartup();await checkWorker()})().catch(error=>{console.error(error);process.exitCode=1});
