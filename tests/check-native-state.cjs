const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+name+'.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),source=fs.readFileSync('js/native-state.js','utf8');
const assetVersion=fs.readFileSync('index.html','utf8').match(/js\/native-state\.js\?v=(\d+)/)[1];
const sessionId=fixture('snapshot').userId;
// Established DOM bootstrap; use actual persistence, validators, planner, cloud, import and reset functions.
const bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split('run(`state.foods=')[0]
  .replace("protocol:'file:'","protocol:'file:',search:options.preview?'?erststart=1':''")
  .replace("value:'',dataset", "focus(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []},value:'',dataset")
  .replace('style:{setProperty(){}}','style:{setProperty(){},removeProperty(){}}');
function app(options={}){
  const test=vm.runInNewContext('(function(require,options){'+bootstrap+';return {ctx,run,el}})(require,options)',{require,options,console});
  const {ctx,run,el}=test,messages=[],events={window:{},document:{}},timers=new Map(),writes=[],reads=[];
  const store=options.store||new Map();let time=0,timerId=0;
  const on=(surface,name,fn)=>{(events[surface][name]??=[]).push(fn)};
  const event=(surface,name)=>{for(const fn of events[surface][name]||[])fn({})};
  Object.assign(ctx.localStorage,{getItem(key){reads.push(key);return store.get(key)??null},setItem(key,value){writes.push(key);if(options.failWrite?.(key))throw Error('quota');store.set(key,String(value))},removeItem:key=>store.delete(key)});
  ctx.document.visibilityState='visible';ctx.document.readyState='loading';
  ctx.document.currentScript={src:'http://localhost/js/native-state.js?v='+assetVersion};
  ctx.document.addEventListener=(name,fn)=>on('document',name,fn);
  ctx.window.addEventListener=(name,fn)=>on('window',name,fn);
  ctx.document.documentElement.classList={add(){}};ctx.document.head={appendChild(){}};
  ctx.document.createElement=()=>({content:{querySelector:()=>null}});
  ctx.document.body.classList.toggle=()=>{};
  for(const id of ['workout-dock','session-root']){el(id).remove=()=>{};el(id).querySelector=()=>null}
  run('render=function(){adaptiveGoals()};dismissSheet=function(){};var navSymbols={workout:""};');
  // Same order as index.html, retaining every file which extends validData and all save wrappers.
  for(const file of ['interactions','lifecycle','comfort','tracker-tools','nutrition-input','adaptation','food-search','catalog-search','food-upgrade','cloud','account-guide','quick-units','progress-metrics','designs-extra','profile-refresh','running','run-metrics']){
    run(fs.readFileSync('js/'+file+'.js','utf8'));run('render=function(){adaptiveGoals()}');
  }
  run('var setAppLanguage=function(){},chooseAppIcon=function(){}');
  run(fs.readFileSync('js/account-refresh.js','utf8'));run('render=function(){adaptiveGoals()}');
  run('state.onboardingComplete=true;state.setupPending=false;setupPending=false;');
  if(options.profile)run('state='+JSON.stringify(options.profile));
  else if(!options.preview&&store.has('puls-v1'))run('state='+store.get('puls-v1'));
  else run('state.weights='+JSON.stringify(fixture('snapshot').state.weights)+';state.xUnknown={keep:true}');
  if(!options.preview)store.set('puls-v1',run('JSON.stringify(state)'));
  if(options.signedIn!==false)run('cloudSession={user:{id:'+JSON.stringify(sessionId)+'}};cloudRevision=17;cloudDirty=false;cloudConflict=false');
  ctx.setTimeout=(fn,delay=0)=>{const id=++timerId;timers.set(id,{fn,at:time+delay});return id};
  ctx.clearTimeout=id=>timers.delete(id);
  ctx.console={...console,warn(){}};
  ctx.window.pulsNativeFeatures=options.features??['stateBridge'];
  if(options.handler!==false)ctx.window.webkit={messageHandlers:{pulsState:{postMessage:msg=>messages.push(clone(msg))}}};
  if(options.restBridge){ctx.window.webkit.messageHandlers.pulsNative={postMessage(){}};run(fs.readFileSync('js/native-bridge.js','utf8'))}
  const load=()=>{ctx.document.readyState='complete';event('window','load')};
  const tick=ms=>{time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}};
  const apply=cmd=>{ctx.window.pulsNativeApply(clone(cmd));return messages.filter(x=>x.type==='ack').at(-1)};
  const snapshots=()=>messages.filter(x=>x.type==='snapshot');
  const start=()=>{run(source);if(!options.deferLoad)load()};
  return {...test,options,store,messages,writes,reads,timers,events,event,tick,load,start,apply,snapshots,state:()=>JSON.parse(run('JSON.stringify(state)'))};
}
const upsert=()=>fixture('apply-weight-upsert'),del=()=>fixture('apply-weight-delete');
function started(options){const test=app(options);test.start();return test}
function latest(test,reason){const snapshot=test.snapshots().at(-1);assert.equal(snapshot.reason,reason);return snapshot}

(async()=>{
  const bodyFeatures=['stateBridge','nativeBody'];
  const openings=t=>t.messages.filter(x=>x.type==='openNative');
  for(const options of [{handler:false,features:bodyFeatures},{features:['nativeBody']},{features:['stateBridge']},{features:['stateBridge','native:body']}]){
    const n=started(options);n.run("go('account');openAccountSection('body')");
    assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,0);
  }
  let n=started({features:bodyFeatures,deferLoad:true});
  n.run("go('account');openAccountSection('body')");assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,0);
  n.load();n.run("closeAccountSection();openAccountSection('body')");
  assert.equal(n.run('accountSection'),'');assert.deepEqual(openings(n),[{protocol:1,type:'openNative',screen:'body'}]);
  n.run("openAccountSection('plan')");assert.equal(n.run('accountSection'),'plan');
  const navigate=target=>n.ctx.window.pulsNativeNavigate(target);
  navigate({page:'account',section:'body',web:true});assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,1);
  n.run('render()');assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,1);
  navigate({page:'home'});assert.equal(n.run('page'),'home');assert.equal(n.run('accountSection'),'');
  navigate({page:'account',section:'body'});assert.equal(n.run('accountSection'),'');assert.equal(openings(n).length,2);
  navigate({page:'account',section:'body',web:true});n.run("closeAccountSection();openAccountSection('body')");assert.equal(openings(n).length,3);
  navigate({page:'food',web:true});navigate({page:'account',section:'body'});assert.equal(openings(n).length,4,'unused bypass never survives navigation');
  const navBefore=n.run('[page,accountSection]').join();
  for(const target of [null,'account',[],{}, {page:'unknown'},{page:'weight'},{page:'account',section:'unknown'},{page:'home',section:'body'}])navigate(target);
  assert.equal(n.run('[page,accountSection]').join(),navBefore);assert.equal(openings(n).length,4);
  // Always call the current go/section wrappers, and clear the bypass even if opening throws.
  n.run('var navigateCalls=[];const navigationGo=go;go=function(p){navigateCalls.push(p);return navigationGo(p)};const navigationSection=openAccountSection;openAccountSection=function(k){navigateCalls.push(k);return navigationSection(k)}');
  navigate({page:'account',section:'body',web:true});assert.deepEqual(clone(n.run('navigateCalls')),['account','body']);
  n.run('const navigationRender=render;render=function(){throw Error("render failed")}');
  assert.throws(()=>navigate({page:'account',section:'body',web:true}),/render failed/);
  n.run("render=navigationRender;closeAccountSection();openAccountSection('body')");assert.equal(openings(n).length,5);
  for(const flag of ['stateRecoveryPending=true','stateCorruptRaw="broken"','cloudUploadBlocked=true','stateUploadBlockPending=true']){
    const r=started({features:bodyFeatures});r.run(flag+";go('account');openAccountSection('body')");assert.equal(openings(r).length,1,flag);
  }
  n=started({features:bodyFeatures,preview:true});n.run("go('account');openAccountSection('body')");assert.equal(openings(n).length,1);
  n=started({features:bodyFeatures,store:new Map([['puls-native-owner-pending',sessionId]])});
  n.run("go('account');openAccountSection('body')");assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,0);
  n=started({features:bodyFeatures,signedIn:false});let endLogin;
  n.ctx.pendingBodyLogin=new Promise(resolve=>{endLogin=resolve});n.run('fetchCloudProfile=function(){return pendingBodyLogin}');
  const bodyLogin=n.run('activateCloudSession')({user:{id:sessionId}});
  n.run("go('account');openAccountSection('body')");assert.equal(n.run('accountSection'),'body');assert.equal(openings(n).length,0);
  endLogin({revision:18,payload:fixture('profile-full')});await bodyLogin;
  n.run("closeAccountSection();openAccountSection('body')");assert.equal(openings(n).length,1);
  // A throwing handler has not sent hello; an openNative delivery failure falls back to Web.
  n=app({features:bodyFeatures});n.ctx.window.webkit.messageHandlers.pulsState.postMessage=()=>{throw Error('handler unavailable')};n.start();
  n.run("go('account');openAccountSection('body')");assert.equal(n.run('accountSection'),'body');
  n=started({features:bodyFeatures});n.ctx.window.webkit.messageHandlers.pulsState.postMessage=()=>{throw Error('handler unavailable')};
  n.run("go('account');openAccountSection('body')");assert.equal(n.run('accountSection'),'body');
  console.log('PASS: nativeBody readiness/feature gates, readonly routing, one-opening Web escape, current navigation wrappers and invalid destination rejection');
  for(const options of [{handler:false},{features:[]},{features:'stateBridge'}]){
    const t=app(options),before=t.run('[save,render,applyCloudProfile,importData,performAccountAction,migrate,closeOverlongWorkouts,cloudStatusChanged,activateCloudSession,signOutCloud,cloudClearUploadBlock,initializeCloudProfile,syncCloud,resolveCloudConflict,openAccountSection,go]');
    const reads=t.reads.length,writes=t.writes.length,listeners=JSON.stringify(t.events);
    t.start();assert.equal(t.ctx.window.pulsNativeApply,undefined);assert.equal(t.ctx.window.pulsNativeNavigate,undefined);assert.equal(t.messages.length,0);
    assert.equal(t.reads.length,reads);assert.equal(t.writes.length,writes);assert.equal(JSON.stringify(t.events),listeners);
    t.run('[save,render,applyCloudProfile,importData,performAccountAction,migrate,closeOverlongWorkouts,cloudStatusChanged,activateCloudSession,signOutCloud,cloudClearUploadBlock,initializeCloudProfile,syncCloud,resolveCloudConflict,openAccountSection,go]').forEach((fn,i)=>assert.equal(fn,before[i]));
  }
  let t=started({profile:fixture('profile-full'),restBridge:true,deferLoad:true});
  assert.equal(t.messages.length,0);assert.equal(t.apply(upsert()).error.code,'not_ready');t.load();
  assert.deepEqual(t.messages.find(x=>x.type==='hello'),{...fixture('hello'),webVersion:assetVersion});
  let snapshot=latest(t,'load');assert.deepEqual(snapshot.state,fixture('profile-full'));
  assert.deepEqual(snapshot.cloud,fixture('snapshot').cloud);assert.deepEqual(snapshot.flags,fixture('snapshot').flags);
  assert.equal(snapshot.userId,sessionId);assert.equal(snapshot.seq,1);assert.equal(snapshot.protocol,1);
  assert.equal(snapshot.ownerPending,false);
  // The full fixture must pass every actual Web validator without dropping unknown fields.
  const fullProfile=fixture('profile-full');
  assert.equal(t.run('validData(state)'),true,'profile-full.json must pass the complete validData wrapper chain');
  assert.deepEqual(t.state(),fullProfile,'validation must preserve the complete fixture, including nested unknown fields');
  for(const weight of fixture('snapshot').state.weights)assert.deepEqual(fullProfile.weights.find(x=>x.id===weight.id),weight);
  assert.equal(upsert().userId,sessionId);assert.equal(del().userId,sessionId);
  assert(fullProfile.weights.some(x=>x.id===del().args.id),'delete fixture targets an existing full-profile weight');
  assert(fullProfile.weights.some(x=>x.date===upsert().args.date),'upsert fixture exercises replacement of an existing day');
  assert.equal(fullProfile.weights.find(x=>x.date===upsert().args.date).id,upsert().args.expect);
  assert.equal(fixture('snapshot').state.weights.find(x=>x.date===upsert().args.date).id,upsert().args.expect);
  assert(!fullProfile.weights.some(x=>x.id===upsert().args.id),'upsert fixture uses a new entry ID');
  console.log('PASS: full native profile fixture passes the complete Web validator, retains unknown fields and matches snapshot/apply fixtures');
  const count=t.snapshots().length;
  t.run('state.xFutureTopLevel.deep.big++;save();save()');t.tick(299);assert.equal(t.snapshots().length,count);
  t.tick(1);snapshot=latest(t,'save');assert.deepEqual(snapshot.state,JSON.parse(t.store.get('puls-v1')));assert.equal(snapshot.seq,2);
  t.run('save()');t.event('window','pagehide');assert.equal(latest(t,'save').seq,3);t.tick(300);assert.equal(t.snapshots().length,count+2);
  t.run('save()');t.ctx.document.visibilityState='hidden';t.ctx.document.hidden=true;t.event('document','visibilitychange');assert.equal(latest(t,'save').seq,4);
  t.run('save()');assert.equal(latest(t,'save').seq,5,'already hidden saves flush immediately');
  const shared=new Map(t.store);shared.delete('puls-v1');t=started({store:shared});assert.equal(latest(t,'load').seq,6,'sequence survives reload');
  // Persistent snapshots must not expose later unpersisted mutations.
  t.run('state.xUnknown.keep=false;save();state.xUnknown.keep=true');t.tick(300);assert.equal(latest(t,'save').state.xUnknown.keep,false);
  console.log('PASS: native state activation, hello, exact fixture snapshots, debounce, leave/hidden flush and persistent sequence');

  t=started({restBridge:true});assert(t.run('validData(state)'));
  let cmd=upsert();
  assert.equal(t.apply(cmd).ok,true);const {expect,...entry}=cmd.args;assert.deepEqual(t.state().weights.find(x=>x.id===cmd.args.id),entry);
  assert.equal(t.state().weights.filter(x=>x.date===cmd.args.date).length,1);assert.equal(latest(t,'apply').state.xUnknown.keep,true);
  assert.deepEqual(latest(t,'apply').state,JSON.parse(t.store.get('puls-v1')));
  let before=t.store.get('puls-v1'),writes=t.writes.filter(x=>x==='puls-v1').length;
  assert.equal(t.apply({...cmd,args:{...cmd.args,kg:110}}).ok,true);assert.equal(t.store.get('puls-v1'),before);
  assert.equal(t.writes.filter(x=>x==='puls-v1').length,writes,'replay does not execute');
  let reloaded=started({store:t.store});before=reloaded.store.get('puls-v1');assert.equal(reloaded.apply({...cmd,args:{...cmd.args,kg:111}}).ok,true);assert.equal(reloaded.store.get('puls-v1'),before);assert.equal(reloaded.state().weights.find(x=>x.id===cmd.args.id).kg,cmd.args.kg);
  const moving={...upsert(),id:'d0000000-0000-4000-8000-000000000001',baseSeq:0,args:{...cmd.args,date:'2026-10-25',expect:null}};
  assert.equal(t.apply(moving).ok,true);assert.equal(t.state().weights.filter(x=>x.id===cmd.args.id).length,1);assert.equal(t.state().weights.find(x=>x.id===cmd.args.id).date,'2026-10-25');
  assert.equal(t.apply(del()).ok,true);assert(!t.state().weights.some(x=>x.id===del().args.id));
  const missing={...del(),id:'d0000000-0000-4000-8000-000000000002'};assert.equal(t.apply(missing).ok,true);
  for(let i=0;i<202;i++)assert.equal(t.apply({...missing,id:'d0000000-0000-4000-8000-'+String(i+10).padStart(12,'0')}).ok,true);
  assert.equal(JSON.parse(t.store.get('puls-native-applied')).length,200);
  t.run('cloudSession={user:{id:"another-user"}}');assert.equal(t.apply(cmd).error.code,'not_ready','no commands before the new user owns the profile');
  console.log('PASS: weight upsert/delete, one entry per day, moved IDs, stale baseSeq, reload replay and 200-command history');

  for(const name of fs.readdirSync('tests/fixtures/native-bridge').filter(x=>x.startsWith('invalid-')&&x.endsWith('.json'))){
    t=started();const bad=fixture(name.slice(0,-5)),before=t.store.get('puls-v1');
    if(name==='invalid-message-no-type.json'){
      // This is Web→Native malformed input (README: ignored natively), not an apply command.
      const count=t.messages.length;t.event('window','message');assert.equal(t.messages.length,count);assert.equal(bad.type,undefined);continue;
    }
    assert.equal(t.apply(bad).error.code,name.includes('unknown-op')?'unknown_op':name.includes('wrong-user')?'wrong_user':name.includes('conflict')?'conflict':'invalid',name);
    assert.equal(t.store.get('puls-v1'),before);
  }
  for(const args of [{id:'',date:'2026-10-26',kg:80},{id:'ok',date:'2026-02-30',kg:80},{id:'ok',date:'2026-10-26',kg:'80'},{id:'unsafe!',date:'2026-10-26',kg:80}])assert.equal(started().apply({...upsert(),args:{expect:upsert().args.expect,...args}}).error.code,'invalid');
  for(const value of [null,{},[],{...upsert(),id:'not-a-uuid'}])assert.equal(started().apply(value).error.code,'invalid');
  for(const kg of [20,400])assert.equal(started().apply({...upsert(),args:{...upsert().args,kg}}).ok,true);
  t=started({signedIn:false});assert.equal(t.apply({...upsert(),userId:null}).ok,true);assert.equal(latest(t,'apply').userId,null);
  for(const flag of ['stateRecoveryPending=true','stateCorruptRaw="broken"','cloudUploadBlocked=true','stateUploadBlockPending=true']){
    t=started();t.run(flag);before=t.store.get('puls-v1');assert.equal(t.apply(upsert()).error.code,'readonly');assert.equal(t.store.get('puls-v1'),before);
  }
  t=started({preview:true});assert.equal(latest(t,'load').flags.preview,true);assert.equal(t.apply(upsert()).error.code,'readonly');assert(!t.reads.includes('puls-v1'));assert.equal(t.writes.length,0);
  t=app();t.store.set('puls-v1','broken raw');t.run('stateRecoveryPending=true;stateCorruptRaw="broken raw"');t.start();
  assert.equal(latest(t,'load').flags.recovery,true);assert.deepEqual(latest(t,'load').state,t.state());assert.equal(t.store.get('puls-v1'),'broken raw');assert.equal(t.apply(upsert()).error.code,'readonly');
  t=app();t.store.delete('puls-v1');t.start();assert.deepEqual(latest(t,'load').state,t.state());
  console.log('PASS: invalid fixtures, calendar/number/ID validation, bounds, user isolation, local mode and readonly flags');

  for(const fail of ['all','puls-v1','puls-native-applied','puls-native-seq']){
    t=started();before=t.store.get('puls-v1');const memory=t.run('JSON.stringify(state)');t.options.failWrite=key=>fail==='all'||key===fail;
    assert.equal(t.apply(upsert()).error.code,'persist_failed',fail);assert.equal(t.run('JSON.stringify(state)'),memory);assert.equal(t.store.get('puls-v1'),before);assert(!t.store.has('puls-native-applied'));
    delete t.options.failWrite;assert.equal(t.apply(upsert()).ok,true,'failure remains retryable');
  }
  t=started();before=t.store.get('puls-v1');t.ctx.localStorage.setItem=(key,value)=>{if(key!=='puls-v1')t.store.set(key,String(value))};assert.equal(t.apply(upsert()).error.code,'persist_failed');assert.equal(t.store.get('puls-v1'),before);
  t=started();const read=t.ctx.localStorage.getItem;t.ctx.localStorage.getItem=key=>{if(key==='puls-v1')throw Error('storage unavailable');return read(key)};
  assert.equal(t.apply(upsert()).error.code,'persist_failed');assert(!t.store.has('puls-native-applied'));
  t=started();before=t.store.get('puls-v1');t.run('render=function(){state.goals.kcal=-1}');assert.equal(t.apply(upsert()).error.code,'invalid');assert.equal(t.store.get('puls-v1'),before);
  console.log('PASS: swallowed/throwing/no-op persistence failures, history quota rollback, invalid derived profile and safe retry');

  // Actual Web functions, including cloudSaveBase bypass and async import/reset wrappers.
  t=started();const cloudProfile=t.state();cloudProfile.weights.push({id:'remote',date:'2026-10-22',kg:82});
  assert.equal(t.run('applyCloudProfile({revision:18,payload:'+JSON.stringify(cloudProfile)+'})'),true);t.tick(300);
  assert.equal(latest(t,'cloud').cloud.revision,18);assert.deepEqual(latest(t,'cloud').state,JSON.parse(t.store.get('puls-v1')));
  const imported=t.state();imported.xImported={keep:true};await t.run('importData')({size:100,text:async()=>JSON.stringify(imported)});t.tick(300);assert.equal(latest(t,'import').state.xImported.keep,true);
  t.run('cloudSession=null;$("account-action-confirm").value="RESET";$("account-action-ack").checked=true;');
  await t.run('performAccountAction({preventDefault(){}},"reset")');t.tick(300);assert.equal(latest(t,'reset').state.weights.length,0);
  t.run('delete state.version;migrate();save()');t.tick(300);assert.equal(latest(t,'migrate').state.version,2);
  t.run('state.workouts.push({id:"overlong",name:"Test",date:today(),startedAt:Date.now()-6*60*60*1000,finished:false,exercises:[]});closeOverlongWorkouts()');t.tick(300);assert.equal(latest(t,'autofinish').state.workouts[0].autoFinished,true);
  // Upsert and Web UI perform the same mutation/derived planning; only the source of the entry ID differs.
  const web=started({signedIn:false}),native=started({signedIn:false});
  const plan='state.profile={age:30,sex:"male",height:180,weight:84,target:75,activity:1.55,method:"mifflin",rmr:0,special:false};state.plan={mode:"auto",direction:"lose",pace:"medium",macroMode:"auto",protein:1.8,fat:.8,adaptive:true};state.goalHistory=[];state.weights=[];';
  for(const test of [web,native])test.run(plan);
  const args={id:'native-weight',date:web.run('today()'),kg:82,expect:null};
  web.el('wdate').value=args.date;web.el('kg').value='82';web.run('addWeight({preventDefault(){}})');
  assert.equal(native.apply({...upsert(),userId:null,args}).ok,true);
  const webState=web.state(),nativeState=native.state();webState.weights[0].id=args.id;assert.deepEqual(nativeState,webState);assert.equal(nativeState.goalHistory.length,1);
  assert.deepEqual(JSON.parse(native.store.get('puls-v1')),nativeState);
  console.log('PASS: real cloud/import/reset/migration/autofinish hooks and Web-equivalent weight planning/history');

  // Restart replay: a surviving history answers without execution; a lost/unreadable history re-executes safely.
  for(const history of ['missing','broken','object','unreadable']){
    t=started();assert.equal(t.apply(upsert()).ok,true);const saved=t.store.get('puls-v1'),store=t.store;
    if(history==='missing')store.delete('puls-native-applied');else store.set('puls-native-applied',history==='object'?'{}':'not JSON');
    t=started({store});if(history==='unreadable'){const get=t.ctx.localStorage.getItem;t.ctx.localStorage.getItem=key=>{if(key==='puls-native-applied')throw Error('unreadable');return get(key)}}
    const beforeWrites=t.writes.filter(x=>x==='puls-v1').length;
    assert.equal(t.apply(upsert()).ok,true,history);assert(t.writes.filter(x=>x==='puls-v1').length>beforeWrites,history+' executes again');
    assert.equal(t.store.get('puls-v1'),saved,'replay preserves the already-persisted result');
  }
  t=started();cmd=upsert();delete cmd.args.expect;assert.equal(t.apply(cmd).error.code,'invalid');
  for(const expect of [undefined,123,'']){t=started();assert.equal(t.apply({...upsert(),args:{...upsert().args,expect}}).error.code,'invalid')}
  t=started();before=t.store.get('puls-v1');assert.equal(t.apply({...upsert(),args:{...upsert().args,expect:null}}).error.code,'conflict');assert.equal(t.store.get('puls-v1'),before);
  t=started();t.run('state.weights=state.weights.filter(x=>x.date!=="2026-10-26");save()');assert.equal(t.apply(upsert()).error.code,'conflict','expected entry was deleted');
  assert.equal(t.apply({...upsert(),args:{...upsert().args,expect:null}}).ok,true,'null expectation creates on an empty day');
  t=started();assert.equal(t.apply({...del(),args:{...del().args,expect:null}}).error.code,'conflict');assert.equal(t.apply({...del(),args:{...del().args,expect:del().args.id}}).ok,true);
  t.store.delete('puls-native-applied');assert.equal(t.apply({...del(),args:{...del().args,expect:del().args.id}}).ok,true,'already-absent deletion remains replayable');
  console.log('PASS: restart replay with lost/corrupt/unreadable history, required expect, stale-day conflicts and idempotent delete expectations');

  t=started();const metaKey='puls-cloud-meta-'+sessionId,metaRaw='{"revision":17,"dirty":false,"baseline":"before","xMeta":{"keep":true}}';
  t.store.set(metaKey,metaRaw);t.run('var sharedStateRef=state;var refChecks=0;const refRender=render;render=function(){if(state!==sharedStateRef)throw Error("state reference replaced");refChecks++;return refRender()}');
  before=t.run('JSON.stringify(state)');t.options.failWrite=key=>key==='puls-native-applied';
  assert.equal(t.apply(upsert()).error.code,'persist_failed');assert.equal(t.run('sharedStateRef===state'),true);assert.equal(t.run('JSON.stringify(state)'),before);assert(t.run('refChecks')>0);
  assert.equal(t.store.get(metaKey),metaRaw);assert.equal(t.run('cloudDirty'),false);assert(t.writes.filter(x=>x===metaKey).length>=2,'dirty metadata was written, then restored');
  delete t.options.failWrite;assert.equal(t.apply(upsert()).ok,true);assert.equal(t.run('sharedStateRef===state'),true,'successful apply keeps root reference');
  t=started();t.run('state.xUnknown.savedBeforeCommand=true;save()');const countBefore=t.snapshots().length;
  t.options.failWrite=key=>key==='puls-native-applied';assert.equal(t.apply(upsert()).error.code,'persist_failed');delete t.options.failWrite;t.tick(300);
  assert.equal(t.snapshots().length,countBefore+1);assert.equal(latest(t,'save').state.xUnknown.savedBeforeCommand,true);assert(!latest(t,'save').state.weights.some(x=>x.id===upsert().args.id));
  t=started();let migrationCount=t.snapshots().length;
  t.run('var stateSerializations=0;const originalStringify=JSON.stringify;JSON.stringify=function(value,...args){if(value===state)stateSerializations++;return originalStringify(value,...args)};migrate();migrate();JSON.stringify=originalStringify');assert.equal(t.run('stateSerializations'),0);t.tick(300);assert.equal(t.snapshots().length,migrationCount,'unchanged migrate queues no snapshot');
  t.run('trainTab="current";workoutPage();workoutPage()');t.tick(300);assert.equal(t.snapshots().length,migrationCount,'ordinary training renders do not emit full snapshots');
  t.run('state.xUnknown.saved=true;save();workoutPage();migrate()');t.tick(300);latest(t,'save');
  t.run('delete state.version;migrate();save()');t.tick(300);assert.equal(latest(t,'migrate').state.version,2);
  t.run('state.exerciseBook.push({id:"existing-exercise",name:"Migration Test",target:0});state.workouts.push({id:"migration-workout",name:"Test",date:today(),finished:false,exercises:[{id:"migration-exercise",name:"Migration Test",sets:[]}]});migrate();save()');t.tick(300);
  assert.equal(latest(t,'migrate').state.workouts[0].exercises[0].exerciseId,'existing-exercise','in-place exercise ID assignment detected even without book growth');
  console.log('PASS: in-place state/ref preservation, raw cloud metadata rollback, retained pending snapshot and cheap migration detection without render/save churn');

  const response={user:{id:sessionId},access_token:'synthetic-token',expires_in:3600};
  const remote=fixture('profile-full');remote.xAccount='remote';
  for(const fail of [false,true]){
    t=started({signedIn:false});let resolveFetch,rejectFetch;
    t.ctx.loginFetch=new Promise((resolve,reject)=>{resolveFetch=resolve;rejectFetch=reject});t.run('fetchCloudProfile=function(){return loginFetch}');
    const snapshotsBefore=t.snapshots().length,login=t.run('activateCloudSession')(response);
    assert.equal(t.messages.filter(x=>x.type==='hello').at(-1).ownerPending,true);assert(!t.messages.filter(x=>x.type==='hello').at(-1).state);
    t.run('state.xUnknown.duringLogin=true;save();cloudStatusChanged()');t.tick(1000);t.event('window','pagehide');
    assert.equal(t.snapshots().length,snapshotsBefore);assert.equal(t.apply(upsert()).error.code,'not_ready');
    if(fail){
      rejectFetch(Error('fetch failed'));await assert.rejects(login,/fetch failed/);t.run('cloudStatusChanged();save()');t.tick(1000);t.event('window','pagehide');
      assert.equal(t.snapshots().length,snapshotsBefore,'failed login must never label local data with the new account');assert.equal(t.apply(upsert()).error.code,'not_ready');
      const restarted=started({store:new Map(t.store)});assert.equal(restarted.snapshots().length,0,'failed-login ownership remains unresolved after reload');assert.equal(restarted.messages.find(x=>x.type==='hello').ownerPending,true);assert.equal(restarted.apply(upsert()).error.code,'not_ready');
      t.run('applyCloudProfile({revision:19,payload:'+JSON.stringify(remote)+'})');t.tick(300);
    }else{resolveFetch({revision:19,payload:clone(remote)});await login}
    const result=latest(t,'cloud');assert.equal(result.userId,sessionId);assert.equal(result.state.xAccount,'remote');assert.equal(result.state.xUnknown,undefined);
    assert.equal(result.ownerPending,false);assert.equal(t.messages.filter(x=>x.type==='hello').at(-1).ownerPending,false);
    assert.equal(t.store.has('puls-native-owner-pending'),false);
    for(const sent of t.snapshots().slice(snapshotsBefore))assert.equal(sent.state.xAccount,'remote');
    assert.equal(t.apply(upsert()).ok,true);
  }
  // Empty accounts cannot label local data as theirs until the existing Web adoption action is chosen.
  t=started({signedIn:false});const emptyCount=t.snapshots().length;t.run('fetchCloudProfile=async function(){return null}');await t.run('activateCloudSession')(response);t.tick(300);
  assert.equal(t.snapshots().length,emptyCount);assert.equal(t.apply(upsert()).error.code,'not_ready');
  t.run('cloudRequest=async function(){return {revision:1}}');await t.run('initializeCloudProfile()');t.tick(300);assert.equal(latest(t,'cloud').userId,sessionId);assert.equal(t.apply(upsert()).ok,true);
  // Pending account profiles use cloudSaveBase directly during activation.
  t=started({signedIn:false});t.store.set('puls-cloud-meta-'+sessionId,JSON.stringify({dirty:true,revision:17}));t.store.set('puls-cloud-pending-'+sessionId,JSON.stringify(remote));
  t.run('cloudRequest=async function(){return {revision:18}}');await t.run('activateCloudSession')(response);assert.equal(latest(t,'cloud').state.xAccount,'remote');
  console.log('PASS: delayed/failed login blocks commands/snapshots, recovered account ownership, explicit empty-account adoption and pending-profile activation');

  // Reproduce: failed login -> fetch with equal revision (no profile replacement) -> clean successful upload.
  t=started({signedIn:false});t.store.set('puls-cloud-meta-'+sessionId,JSON.stringify({revision:17,dirty:false}));
  t.run('fetchCloudProfile=async function(){throw Error("login fetch failed")}');await assert.rejects(t.run('activateCloudSession')(response),/login fetch failed/);
  const blockedSnapshots=t.snapshots().length;
  t.run('fetchCloudProfile=async function(){return {revision:17,payload:'+JSON.stringify(remote)+'}};modal.close()');await t.run('syncCloud({forcePull:true})');t.tick(300);
  assert.equal(t.snapshots().length,blockedSnapshots);assert.equal(t.store.get('puls-native-owner-pending'),sessionId);assert.equal(t.apply(upsert()).error.code,'not_ready','same-revision fetch alone cannot adopt local data');
  t.run('state.xUnknown.uploadedLocal=true;save();cloudRequest=async function(path){if(!path.includes("puls_save_profile"))throw Error("unexpected request");return {revision:18}}');
  await t.run('syncCloud()');t.tick(300);snapshot=latest(t,'cloud');
  assert.equal(snapshot.ownerPending,false);assert.equal(snapshot.cloud.revision,18);assert.equal(snapshot.cloud.dirty,false);assert.equal(snapshot.state.xUnknown.uploadedLocal,true);
  assert.deepEqual(snapshot.state,JSON.parse(t.store.get('puls-v1')));assert.equal(t.store.has('puls-native-owner-pending'),false);assert.equal(t.messages.filter(x=>x.type==='hello').at(-1).ownerPending,false);assert.equal(t.apply(upsert()).ok,true);

  // A failed upload or one overtaken by edits must leave the pending owner blocked.
  t=started({store:new Map([['puls-native-owner-pending',sessionId]])});t.run('state.xUnknown.pendingUpload=true;save();cloudRequest=async function(){throw Error("offline")}');
  await t.run('syncCloud()');t.tick(300);assert.equal(t.snapshots().length,0);assert.equal(t.apply(upsert()).error.code,'not_ready');
  let finishUpload;t.ctx.uploadResult=new Promise(resolve=>{finishUpload=resolve});t.run('cloudRequest=function(){return uploadResult}');
  const uploading=t.run('syncCloud()');t.run('state.xUnknown.editedDuringUpload=true;save()');finishUpload({revision:18});await uploading;t.tick(300);
  assert.equal(t.run('cloudRevision'),18);assert.equal(t.run('cloudDirty'),true);assert.equal(t.store.get('puls-native-owner-pending'),sessionId);assert.equal(t.snapshots().length,0);
  t.run('cloudRequest=async function(){return {revision:19}}');await t.run('syncCloud()');t.tick(300);assert.equal(latest(t,'cloud').state.xUnknown.editedDuringUpload,true);assert.equal(t.store.has('puls-native-owner-pending'),false);

  for(const accepted of [false,true]){
    t=started({store:new Map([['puls-native-owner-pending',sessionId]])});
    t.run('cloudConflict=true;fetchCloudProfile=async function(){return {revision:20,payload:'+JSON.stringify(remote)+'}};cloudRequest=async function(){return '+(accepted?'{revision:21}':'null')+'}');
    await t.run('resolveCloudConflict("local")');t.tick(300);
    if(accepted){assert.equal(latest(t,'cloud').cloud.revision,21);assert.equal(t.store.has('puls-native-owner-pending'),false);assert.equal(t.apply(upsert()).ok,true)}
    else{assert.equal(t.snapshots().length,0);assert.equal(t.store.get('puls-native-owner-pending'),sessionId);assert.equal(t.apply(upsert()).error.code,'not_ready')}
  }
  // resolveCloudConflict also confirms ownership when sync completes through another existing caller/wrapper.
  t=started({store:new Map([['puls-native-owner-pending',sessionId]])});
  t.run('cloudConflict=true;fetchCloudProfile=async function(){return {revision:20,payload:'+JSON.stringify(remote)+'}};syncCloud=async function(){cloudRevision=21;cloudDirty=false;cloudConflict=false}');
  await t.run('resolveCloudConflict("local")');t.tick(300);assert.equal(latest(t,'cloud').ownerPending,false);assert.equal(t.store.has('puls-native-owner-pending'),false);
  console.log('PASS: same-revision login recovery via clean upload/local conflict choice, ownerPending hello/snapshot updates and no premature claim on failure/in-flight edits');
})().catch(error=>{console.error(error);process.exitCode=1});
