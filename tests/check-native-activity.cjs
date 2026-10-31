// M6 package N: synthetic data, effective Web run/route functions, mocked native GPS transport. No device/RLS proof.
process.env.TZ='Europe/Berlin';
const fs=require('node:fs'),vm=require('node:vm'),assert=Object.assign((v,m)=>require('node:assert/strict')(v,m),require('node:assert/strict'),{deepEqual:(a,b,m)=>require('node:assert/strict').deepStrictEqual(clone(a),clone(b),m)});
const clone=x=>JSON.parse(JSON.stringify(x)),fixture=n=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+n+'.json','utf8'));
const input=fixture('progress-input'),owner=fixture('snapshot').userId;
const harness=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("['workout-dock','session-root']","['workout-dock','session-root','run-root']")
  .replace('el(id).remove=()=>{};', 'el(id).remove=()=>{};el(id).scrollTo=()=>{};')
  .replace("input=fixture('training-input')","input=fixture('progress-input')")
  .replace("'running','run-metrics'];","'running','run-metrics','run-map','run-session','activity-overview'];")
  .replace("['native-state','native-projection','native-training']","['native-state','native-projection','native-training','native-progress','native-activity']")
  .replace("['stateBridge','nativeTraining']","['stateBridge','nativeActivity','runGps','runActivity','runActivityEndState']");
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const profile=()=>{const s=clone(input.profile);s.workouts=s.workouts.filter(w=>w.finished);s.runSettings={lastType:'run',rounds:{work:180,rest:60,count:5},future:{retained:true}};return s};
const start=o=>{const t=app({profile:profile(),...o});t.start();return t};
const projection=t=>t.messages.filter(m=>m.type==='projection'&&m.name==='activity').at(-1);
const interest=t=>assert.equal(t.ctx.window.pulsNativeSetInterest({projections:['activity']}),true);
let serial=0;const cmd=(op,args)=>({id:'a6000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),userId:owner,baseSeq:0,op,args});
const ok=a=>{assert.equal(a?.ok,true,JSON.stringify(a));return a},code=(a,c)=>{assert.equal(a?.ok,false,JSON.stringify(a));assert.equal(a.error.code,c)};
const runStart=(t,type='run',extra={})=>{const a=cmd('run.start',{type,expect:{lastRunId:t.state().runs?.at(-1)?.id??null},...extra});return {a,ack:ok(t.apply(a))}};
const applyAsync=async(t,a)=>{const before=t.messages.length;t.ctx.window.pulsNativeApply(clone(a));await new Promise(resolve=>setImmediate(resolve));return t.messages.slice(before).filter(m=>m.type==='ack').at(-1)};
const query=(t,kind,args={})=>{assert.equal(t.ctx.window.pulsNativeActivityQuery({requestId:'q',kind,...args}),true);return t.messages.filter(m=>m.type==='activityResult').at(-1)};
const compare=(name,value)=>{if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/'+name+'.json',JSON.stringify(value,null,2)+'\n');assert.deepEqual(clone(value),fixture(name))};

(async()=>{
  for(const options of [{handler:false},{features:['stateBridge']},{features:['nativeActivity']},{features:['stateBridge','nativeOverview','nativeTraining','nativeProgress']}]){
    const t=app({profile:profile(),...options}),before=t.run('[openRunView,startRunTimer,toggleRunPause,finishRunTimer,runBeep,renderRunView]');t.start();
    for(const key of ['pulsNativeActivity','pulsNativeSetActivity','pulsNativeActivityQuery'])assert.equal(t.ctx.window[key],undefined);
    // The existing state-bridge Chrome observer wraps renderRunView even without M6; other run functions stay exact.
    t.run('[openRunView,startRunTimer,toggleRunPause,finishRunTimer,runBeep]').forEach((fn,i)=>assert.equal(fn,before[i]));
    assert.equal(projection(t),undefined);if(t.ctx.window.pulsNativeApply)code(t.apply(cmd('run.start',{})),'unknown_op');
  }
  let t=start();assert.equal(projection(t),undefined);assert.equal(t.run('validData(state)'),true);
  t.run('var builds=0;const baseBuild=window.pulsNativeActivity.build;window.pulsNativeActivity.build=function(...a){builds++;return baseBuild(...a)}');
  t.run('save();render();updateRunLive()');t.tick(300);assert.equal(t.run('builds'),0);
  interest(t);assert.equal(t.run('builds'),1);const p=projection(t);compare('activity-projection',p);
  assert.equal(p.activity.types.length,8);assert.deepEqual(p.activity.types.map(x=>x.id),['run','walk','hike','mountain','tabletennis','soccer','mma','padel']);
  const original=JSON.stringify(t.state());t.run('render()');t.tick(300);const count=t.run('builds');
  for(let i=0;i<10;i++){t.run('render();updateRunLive()');t.tick(300)}assert.equal(t.run('builds'),count);assert.equal(JSON.stringify(t.state()),original);
  t.ctx.window.pulsNativeSetInterest({projections:[]});t.run('save();updateRunLive()');t.tick(300);assert.equal(t.run('builds'),count);
  const legacy=profile();delete legacy.runs;delete legacy.runRoutes;delete legacy.runSettings;
  const old=start({profile:legacy});interest(old);assert.equal(old.run('Object.hasOwn(state,"runs")'),false);assert.equal(old.run('Object.hasOwn(state,"runRoutes")'),false);
  for(const r of [null,{},[],{requestId:'q',kind:'eval'},{requestId:'q',kind:'run',id:'bad!'},{requestId:'q',kind:'summary',extra:1}])assert.equal(t.ctx.window.pulsNativeActivityQuery(r),false);
  console.log('PASS: M6 isolation, demand only, eight types, cheap renders, old profiles, strict queries');

  t=start();interest(t);assert.equal(t.ctx.window.pulsNativeSetActivity(true),true);t.run('openRunView()');
  assert.deepEqual(t.messages.filter(m=>m.type==='openNative').at(-1),{protocol:1,type:'openNative',screen:'activity',startedAt:null});assert.equal(t.run('runView'),null);
  const {a,ack}=runStart(t);compare('apply-run-start',a);compare('ack-run-start',ack);
  const key=ack.result.startedAt;assert.equal(t.run('runView'),null);assert.equal(t.state().activeRun.type,'run');assert.equal(t.store.get('puls-run-device'),String(key));
  assert.equal(t.native.filter(m=>m.type==='runGpsStart').length,1);assert(t.native.some(m=>m.type==='runActivity'&&m.active));
  ok(t.apply(a));assert.equal(t.native.filter(m=>m.type==='runGpsStart').length,1,'known start never starts recorder twice');
  const double=runStart(t,'walk').ack;assert.equal(double.result.started,false);assert.equal(double.result.startedAt,key);
  t.clock.now+=20000;
  // The existing GPS receiver accepts native points, preserving accuracy/jump filtering and segments.
  t.ctx.window.pulsRunGpsReceive({runKey:String(key),from:0,total:4,points:[[key,51,10,10,0],[key+10000,51.0005,10,10,0],[key+15000,51.00051,10,10,0],[key+20000,52,10,50,0]]});t.tick(300);
  const live=projection(t).activity.active;assert.equal(live.recordingDevice,true);assert.equal(live.distanceKm,t.run('Math.round(runGpsKm()*100)/100'));
  assert.equal(live.values.avgpace,t.run('runLiveData(state.activeRun).avgpace'));assert(live.distanceKm>0);compare('activity-live',projection(t));
  const pause=cmd('run.pause',{startedAt:key,expect:{pausedAt:null,segment:0}});ok(t.apply(pause));assert.equal(t.state().activeRun.pausedAt,t.clock.now);
  const pausedAt=t.state().activeRun.pausedAt;t.clock.now+=4000;
  ok(t.apply(cmd('run.resume',{startedAt:key,expect:{pausedAt,segment:0}})));assert.equal(t.state().activeRun.segment,1);assert.equal(t.state().activeRun.pausedSeconds,4);
  code(t.apply({...pause,id:cmd('',{}).id}),'conflict'); // old null/segment must not pause a newer segment
  code(t.apply(cmd('run.resume',{startedAt:key,expect:{pausedAt:pausedAt-1,segment:1}})),'conflict');
  t.clock.now+=3000;const lap=cmd('run.lap',{startedAt:key,expect:{laps:[]}});ok(t.apply(lap));assert.deepEqual(t.state().activeRun.laps,[23]);
  t.store.delete('puls-native-applied');ok(t.apply(lap));assert.equal(t.state().activeRun.laps.length,1);
  t.run('runOwnedKey="";runDeviceKey(null)');code(t.apply(cmd('run.pause',{startedAt:key,expect:{pausedAt:null,segment:1}})),'conflict');
  code(await applyAsync(t,cmd('run.finish',{startedAt:key})),'conflict');t.run('save()');t.tick(300);assert.equal(projection(t).activity.active.distanceKm,null);
  t.run('claimRunGps(state.activeRun)');
  console.log('PASS: native routing, Web start, GPS receiver, no duplicate start, segments, lap replay, foreign device');

  // Real asynchronous Web finish: only pause/stop/sync before reply; a complete native response permits summary.
  const finish=cmd('run.finish',{startedAt:key}),beforeAck=t.messages.length;
  t.ctx.window.pulsNativeApply(clone(finish));assert(!t.messages.slice(beforeAck).some(m=>m.type==='ack'));
  assert(t.native.some(m=>m.type==='runGpsStop'&&m.clear===false));
  code(t.apply(cmd('run.discard',{startedAt:key})),'busy');
  t.ctx.window.pulsRunGpsReceive({runKey:String(key),from:4,total:4,points:[]});t.tick(120);await new Promise(resolve=>setImmediate(resolve));
  ok(t.messages.filter(m=>m.type==='ack'&&m.id===finish.id).at(-1));assert.equal(t.run('runView'),null);
  const summary=query(t,'summary');assert.equal(summary.result.key,key);assert.equal(summary.result.moving,23);compare('activity-result-summary',summary);
  const save=cmd('run.summary.save',{startedAt:key,pausedAt:t.state().activeRun.pausedAt,feeling:4,terrain:'forest',note:' Testnotiz '});
  const savedAck=ok(t.apply(save)),runId=savedAck.result.runId;assert.equal(t.state().activeRun,null);
  const r=t.state().runs.find(r=>r.id===runId);assert.equal(r.note,'Testnotiz');assert.equal(r.source,'gps');assert.equal(r.startedAt,key);assert(r.route);
  assert(t.native.some(m=>m.type==='runGpsStop'&&m.clear===true));assert.equal(t.run('activityDoneId'),runId,'existing Web success screen retained');
  assert.equal(t.store.get('puls-run-track'),'null');t.store.delete('puls-native-applied');ok(t.apply(save));assert.equal(t.state().runs.filter(r=>r.startedAt===key).length,1);
  code(t.apply(a),'conflict','completed start must never create another run after history loss');
  const details=query(t,'run',{id:runId});assert.equal(details.result.route,r.route);assert.deepEqual(details.result.laps,[23]);
  const edit=cmd('run.edit',{id:runId,type:'hike',feeling:null,terrain:null,note:'Geändert',expect:details.result.editExpect});
  t.run('activityDoneId=null');ok(t.apply(edit));assert.equal(t.state().runs.find(r=>r.id===runId).type,'hike');assert.equal(t.state().runs.find(r=>r.id===runId).kcal,r.kcal,'stored estimate unchanged by edit');
  code(t.apply(cmd('run.edit',{...edit.args,note:'anderer Text'})),'conflict');
  console.log('PASS: drain before ack, in-flight guard, summary/save, saved IDs/GPS/laps, replay, Web endscreen, edit conflicts');

  const mma=start();interest(mma);const mk=runStart(mma,'mma',{rounds:{work:10,rest:0,count:2}}).ack.result.startedAt;
  mma.clock.now+=11000;mma.run('save()');mma.tick(300);assert.equal(projection(mma).activity.active.mma.round,2);
  assert.equal(projection(mma).activity.active.mma.phase,'work');ok(mma.apply(cmd('run.lap',{startedAt:mk,expect:{laps:[]}})));
  mma.clock.now+=1000;code(mma.apply(cmd('run.lap',{startedAt:mk,expect:{laps:mma.state().activeRun.laps}})),'gone');
  ok(await applyAsync(mma,cmd('run.finish',{startedAt:mk})));code(mma.apply(cmd('run.summary.save',{startedAt:mk,pausedAt:mma.state().activeRun.pausedAt,feeling:null,terrain:null,note:'',manualKm:0})),'invalid');
  ok(mma.apply(cmd('run.discard',{startedAt:mk})));assert.equal(mma.state().activeRun,null);
  // Timers over five hours are valid activities; the five-hour sweep belongs to strength, not runs.
  const long=start();const lk=runStart(long,'soccer').ack.result.startedAt;long.clock.now+=6*3600000;ok(await applyAsync(long,cmd('run.finish',{startedAt:lk})));
  assert.equal(query(long,'summary').result.moving,21600);
  console.log('PASS: MMA time bases/rest=0/signals, limits, discard, no accidental strength 5h rule');

  const routes=start(),routeCount=routes.state().runRoutes?.length||0;const routeCmd=cmd('route.save',{route:{id:'native_route_1',name:' Testweg ',line:[[51,10],[51.001,10.001]],waypoints:[[51,10],[51.001,10.001]],distanceKm:.14,ascentM:0},expect:null});
  ok(routes.apply(routeCmd));const rr=query(routes,'route',{id:'native_route_1'}).result;assert.equal(rr.ascentM,0);assert.equal(rr.name,'Testweg');
  routes.store.delete('puls-native-applied');ok(routes.apply(routeCmd));assert.equal(routes.state().runRoutes.length,routeCount+1);
  code(routes.apply(cmd('route.save',{...routeCmd.args,route:{...routeCmd.args.route,name:'Änderung'}})),'conflict');
  const remove=cmd('route.delete',{id:rr.id,expect:routes.state().runRoutes.find(r=>r.id===rr.id)});ok(routes.apply(remove));ok(routes.apply(remove));assert.equal(routes.state().runRoutes.length,routeCount);
  const setting=cmd('runSettings.set',{rounds:{work:10,rest:0,count:1},lastType:'mma',expect:routes.state().runSettings});ok(routes.apply(setting));assert.equal(routes.state().runSettings.rounds.rest,0);assert.deepEqual(routes.state().runSettings.future,{retained:true});
  console.log('PASS: route save/delete exact Web functions, stable IDs, replay, 0 ascent/rest, unknown settings retained');

  // Native recorder destructive actions only leave the bridge after successful profile/history persistence.
  let reject=false;const rollback=start({failWrite:k=>reject&&k==='puls-native-applied'});const rk=runStart(rollback).ack.result.startedAt;
  const before=rollback.store.get('puls-v1'),track=rollback.store.get('puls-run-track'),device=rollback.store.get('puls-run-device'),nativeBefore=rollback.native.length;
  reject=true;code(rollback.apply(cmd('run.discard',{startedAt:rk})),'persist_failed');assert.equal(rollback.store.get('puls-v1'),before);assert.equal(rollback.store.get('puls-run-track'),track);assert.equal(rollback.store.get('puls-run-device'),device);
  assert(!rollback.native.slice(nativeBefore).some(m=>m.type==='runGpsStop'&&m.clear===true));
  for(const flags of [{preview:true},{recovery:true},{uploadBlocked:true}]){const ro=start(flags);if(flags.recovery)ro.run('stateRecoveryPending=true');if(flags.uploadBlocked)ro.run('cloudUploadBlocked=true');code(ro.apply(cmd('run.discard',{startedAt:1})),'readonly')}
  const modal=start();modal.run('modal.open=true');code(modal.apply(cmd('run.start',{type:'run',expect:{lastRunId:modal.state().runs.at(-1).id}})),'busy');assert.equal(modal.ctx.window.pulsNativeSetActivity(true),false);
  const ownerPending=start();ownerPending.run('cloudSession={user:{id:"other"}};cloudStatusChanged()');assert.equal(ownerPending.ctx.window.pulsNativeActivityQuery({requestId:'q',kind:'summary'}),false);
  const life=start();assert.equal(life.ctx.window.pulsNativeSetActivity(true),true);life.event('window','pagehide');life.event('window','pageshow',{persisted:true});
  life.run('openRunView=function(){runView="ready"}'); // direct navigation fallback separately validated by the bridge
  assert.equal(life.messages.filter(m=>m.type==='hello').length,2);
  console.log('PASS: persistence rollback preserves track/device, no recorder clear on failure, readonly, modal, ownership, bfcache');

  const timeout=start();const tk=runStart(timeout).ack.result.startedAt;timeout.clock.now+=1000;
  const timed=cmd('run.finish',{startedAt:tk});timeout.ctx.window.pulsNativeApply(clone(timed));timeout.clock.now+=4001;timeout.tick(120);await new Promise(resolve=>setImmediate(resolve));
  code(timeout.messages.filter(m=>m.id===timed.id).at(-1),'busy');assert(timeout.state().activeRun.pausedAt);assert.equal(timeout.store.get('puls-run-device'),String(tk));assert.equal(timeout.run('runSummary'),null);
  const raced=start();const raceKey=runStart(raced).ack.result.startedAt;raced.clock.now+=1000;
  const racing=cmd('run.finish',{startedAt:raceKey});raced.ctx.window.pulsNativeApply(clone(racing));
  const newer=profile();newer.untouched='cloud';raced.run('state='+JSON.stringify(newer));raced.clock.now+=4001;raced.tick(120);await new Promise(resolve=>setImmediate(resolve));
  code(raced.messages.filter(m=>m.id===racing.id).at(-1),'gone');assert.equal(raced.state().untouched,'cloud','no rollback of a cloud takeover across await');
  const transitioning=start();interest(transitioning);runStart(transitioning,'mma',{rounds:{work:10,rest:5,count:2}});transitioning.clock.now+=10000;transitioning.run('updateRunLive()');transitioning.tick(300);
  assert.equal(projection(transitioning).activity.active.mma.phase,'rest','phase updates without saving a ticking clock');transitioning.clock.now+=5000;transitioning.run('updateRunLive()');transitioning.tick(300);assert.equal(projection(transitioning).activity.active.mma.round,2);
  let failStart=true;const badStart=start({failWrite:k=>failStart&&k==='puls-native-applied'}),beforeStart=badStart.store.get('puls-v1');
  code(badStart.apply(cmd('run.start',{type:'run',expect:{lastRunId:badStart.state().runs.at(-1).id}})),'persist_failed');assert.equal(badStart.store.get('puls-v1'),beforeStart);
  assert(!badStart.native.some(m=>m.type==='runGpsStart'));assert.equal(badStart.store.get('puls-run-device'),undefined);
  const zero=start();const zk=runStart(zero).ack.result.startedAt;zero.clock.now+=1000;
  // No GPS points, but an explicit native total=0 is required before finishing.
  const zf=cmd('run.finish',{startedAt:zk});zero.ctx.window.pulsNativeApply(clone(zf));zero.ctx.window.pulsRunGpsReceive({runKey:String(zk),from:0,total:0,points:[]});zero.tick(120);await new Promise(resolve=>setImmediate(resolve));
  ok(zero.messages.filter(m=>m.id===zf.id).at(-1));const zs=cmd('run.summary.save',{startedAt:zk,pausedAt:zero.state().activeRun.pausedAt,feeling:null,terrain:null,note:'',manualKm:0});
  ok(zero.apply(zs));assert.equal(zero.state().runs.at(-1).distanceKm,0);assert.equal(zero.state().runs.at(-1).note,undefined);
  const bigProfile=profile();bigProfile.runRoutes=Array.from({length:200},(_,i)=>({id:'route_'+i,name:'😀'.repeat(30),line:'51,10;51.001,10.001',distanceKm:1,extension:'x'.repeat(10000)}));
  const big=start({profile:bigProfile});interest(big);assert(JSON.stringify(projection(big).activity).length<=48*1024);assert(JSON.stringify(query(big,'route',{id:'route_0'})).length<48*1024);
  console.log('PASS: failed drain retains pause, async takeover, MMA phase invalidation, failed start, explicit 0 distance, bounded routes');
  // Review additions (Claude, M6 N): Web lap parity, equal confirmed haptics, Web clamp at 48 h, stale summary, delete, reload takeover.
  const extra=start();extra.run('var pulsHaptic=function(k){window.webkit.messageHandlers.pulsNative.postMessage({type:"haptic",style:k})}');
  const ek=runStart(extra).ack.result.startedAt;extra.clock.now+=5000;ok(extra.apply(cmd('run.lap',{startedAt:ek,expect:{laps:[]}})));
  extra.clock.now+=5000;ok(extra.apply(cmd('run.lap',{startedAt:ek,expect:{laps:extra.state().activeRun.laps}})));
  assert.equal(extra.native.filter(m=>m.type==='haptic'&&m.style==='medium').length,2,'an equal earlier haptic never swallows a confirmed one');
  let failLap=true;const quiet=start({failWrite:k=>failLap&&k==='puls-native-applied'});quiet.run('var pulsHaptic=function(k){window.webkit.messageHandlers.pulsNative.postMessage({type:"haptic",style:k})}');
  failLap=false;const qk=runStart(quiet).ack.result.startedAt;quiet.clock.now+=5000;failLap=true;
  code(quiet.apply(cmd('run.lap',{startedAt:qk,expect:{laps:[]}})),'persist_failed');assert(!quiet.native.some(m=>m.type==='haptic'&&m.style==='medium'),'rolled-back lap stays silent');
  const plain=start();const pk=runStart(plain,'soccer').ack.result.startedAt;plain.clock.now+=5000;
  code(plain.apply(cmd('run.lap',{startedAt:pk,expect:{laps:[]}})),'invalid');
  plain.clock.now+=49*3600000;ok(await applyAsync(plain,cmd('run.finish',{startedAt:pk})));
  ok(plain.apply(cmd('run.summary.save',{startedAt:pk,pausedAt:plain.state().activeRun.pausedAt,feeling:null,terrain:null,note:''})));
  assert.equal(plain.state().runs.at(-1).durationSeconds,172800,'Web clamps durations to 48 h instead of losing the activity');
  const res=start();const rk2=runStart(res,'padel').ack.result.startedAt;res.clock.now+=2000;ok(await applyAsync(res,cmd('run.finish',{startedAt:rk2})));
  assert.equal(query(res,'summary').ok,true);const stalePause=res.state().activeRun.pausedAt;res.run('runSummaryResume()');res.clock.now+=2000;
  assert.equal(query(res,'summary').ok,false,'old Web summary after Resume is no draft basis');
  code(res.apply(cmd('run.summary.save',{startedAt:rk2,pausedAt:stalePause,feeling:null,terrain:null,note:''})),'conflict');
  const victim=routes.state().runs[0],victimExpect=query(routes,'run',{id:victim.id}).result.editExpect,runCount=routes.state().runs.length;
  code(routes.apply(cmd('run.delete',{id:victim.id,expect:{...victimExpect,note:victimExpect.note+'x'}})),'conflict');
  const del=cmd('run.delete',{id:victim.id,expect:victimExpect});ok(routes.apply(del));assert.equal(routes.state().runs.length,runCount-1);
  routes.store.delete('puls-native-applied');ok(routes.apply(del));assert.equal(routes.state().runs.length,runCount-1);
  code(routes.apply(cmd('run.delete',{id:'bad!',expect:victimExpect})),'invalid');
  const take=start();runStart(take);take.run('runView="live"'); // as run-session.js does after a reload
  assert.equal(take.ctx.window.pulsNativeSetActivity(true),true);assert.equal(take.run('runView'),null,'Web live view minimised for Native');
  take.ctx.window.pulsNativeSetActivity(false);
  for(const view of ['countdown','summary']){take.run('runView='+JSON.stringify(view));assert.equal(take.ctx.window.pulsNativeSetActivity(true),false,view+' keeps blocking')}
  take.run('runView="live";modal.open=true');assert.equal(take.ctx.window.pulsNativeSetActivity(true),false,'open Web dialog keeps blocking');take.run('modal.open=false;runView=null');
  assert.deepEqual(Object.keys(extra.ctx.window.pulsNativeActivity.ops).sort(),['route.delete','route.save','run.delete','run.discard','run.edit','run.finish','run.lap','run.pause','run.resume','run.start','run.summary.save','runSettings.set']);
  assert(extra.messages.find(m=>m.type==='hello').ops.includes('run.delete'));
  console.log('PASS: lap parity, confirmed haptics, 48 h clamp, stale summary, delete conflict/replay, reload takeover');
  // Review be4e4a3: stale summary after Web Resume, Web lock on takeover, packet-driven rebuilds, replaced profile, route sheet.
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const f1=start();const fk=runStart(f1).ack.result.startedAt;f1.clock.now+=5000;
  const fin=cmd('run.finish',{startedAt:fk});f1.ctx.window.pulsNativeApply(clone(fin));f1.ctx.window.pulsRunGpsReceive({runKey:String(fk),from:0,total:0,points:[]});f1.tick(120);await settle();
  ok(f1.messages.filter(m=>m.id===fin.id).at(-1));f1.run('runSummaryResume()');assert.equal(f1.run('runSummary.key'),fk,'Web Resume keeps its old summary');
  assert.equal(f1.ctx.window.pulsNativeSetActivity(true),true);f1.clock.now+=60000;
  const fin2=cmd('run.finish',{startedAt:fk});f1.ctx.window.pulsNativeApply(clone(fin2));f1.clock.now+=4001;f1.tick(120);await settle();
  code(f1.messages.filter(m=>m.id===fin2.id).at(-1),'busy');assert.equal(query(f1,'summary').ok,false,'incomplete drain never exposes the old summary');
  const fin3=cmd('run.finish',{startedAt:fk});f1.ctx.window.pulsNativeApply(clone(fin3));f1.ctx.window.pulsRunGpsReceive({runKey:String(fk),from:0,total:0,points:[]});f1.tick(120);await settle();
  ok(f1.messages.filter(m=>m.id===fin3.id).at(-1));assert.equal(query(f1,'summary').result.moving,65);
  const locked=start();const lk2=runStart(locked).ack.result.startedAt;locked.run('runView="live";runLocked=true');locked.clock.now+=5000;
  assert.equal(locked.ctx.window.pulsNativeSetActivity(true),true);assert.equal(locked.run('runLocked'),false,'Web lock ends with the Web view');
  ok(locked.apply(cmd('run.lap',{startedAt:lk2,expect:{laps:[]}})));
  locked.run('runLocked=true');locked.clock.now+=5000;ok(locked.apply(cmd('run.lap',{startedAt:lk2,expect:{laps:[5]}})),'leftover Web lock flag never swallows a native lap');
  const replaced=start();const rpk=runStart(replaced).ack.result.startedAt;replaced.clock.now+=1000;
  const rf=cmd('run.finish',{startedAt:rpk});replaced.ctx.window.pulsNativeApply(clone(rf));replaced.run('state=JSON.parse(JSON.stringify(state))');
  replaced.ctx.window.pulsRunGpsReceive({runKey:String(rpk),from:0,total:0,points:[]});replaced.tick(120);await settle();
  code(replaced.messages.filter(m=>m.id===rf.id).at(-1),'busy');assert.equal(replaced.state().activeRun.startedAt,rpk);
  const rf2=cmd('run.finish',{startedAt:rpk});replaced.ctx.window.pulsNativeApply(clone(rf2));replaced.ctx.window.pulsRunGpsReceive({runKey:String(rpk),from:0,total:0,points:[]});replaced.tick(120);await settle();
  ok(replaced.messages.filter(m=>m.id===rf2.id).at(-1));
  const packets=start();interest(packets);const pk2=runStart(packets).ack.result.startedAt;
  packets.run('var builds=0;const pb=window.pulsNativeActivity.build;window.pulsNativeActivity.build=function(...a){builds++;return pb(...a)}');
  for(let i=0,from=0;i<30;i++,from++){packets.clock.now+=1000;packets.ctx.window.pulsRunGpsReceive({runKey:String(pk2),from,total:from+1,points:[[packets.clock.now,51+from*0.00005,10,8+(i%5),0]]});packets.run('updateRunLive()');packets.tick(1000)}
  assert(packets.run('builds')<=4,'GPS packets rebuild at most every 10 s: '+packets.run('builds'));
  const sel=start();interest(sel);const routeId=sel.state().runRoutes[0].id;assert.equal(sel.ctx.window.pulsNativeSetActivity(true),true);
  sel.run('runSelectRoute('+JSON.stringify(routeId)+')');assert.deepEqual(sel.messages.filter(m=>m.type==='openNative').at(-1),{protocol:1,type:'openNative',screen:'activity',startedAt:null,routeId});
  assert.equal(sel.run('runView'),null);sel.ctx.window.pulsNativeSetActivity(false);sel.run('runSelectRoute('+JSON.stringify(routeId)+')');
  assert.equal(sel.run('runView'),'ready');assert.equal(sel.run('runViewRouteId'),routeId,'without confirmation the Web start view opens as before');
  console.log('PASS: review be4e4a3 stale summary, Web lock, packet rebuilds, replaced profile retry, route sheet to Native');
  console.log('PASS: native activity contract (VM only)');
})().catch(error=>{console.error(error);process.exit(1)});
