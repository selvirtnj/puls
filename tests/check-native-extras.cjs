// N1: synthetic profiles, real final Web providers/finish chains. No credentials, accounts, network or device.
process.env.TZ='Europe/Berlin';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const clone=x=>JSON.parse(JSON.stringify(x)),fixture=n=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+n+'.json','utf8'));
const owner=fixture('snapshot').userId;
const features=['stateBridge','nativeTraining','nativeProgress','nativeActivity','nativeNutrition','nativeAccount','nativeCompletion','nativeExtras'];
const harness=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("input=fixture('training-input')","input=fixture('account-input')")
  .replace("'training-polish','running'","'food-flow','training-polish','running'")
  .replace("'running','run-metrics'];","'running','run-metrics','run-map','run-session','activity-overview'];")
  .replace("['workout-dock','session-root']","['workout-dock','session-root','run-root']")
  .replace('el(id).remove=()=>{};', 'el(id).remove=()=>{};el(id).scrollTo=()=>{};')
  .replace("['native-state','native-projection','native-training']","['native-state','native-projection','native-training','native-progress','native-activity','native-nutrition','native-account']");
// Optional in-memory mutation checks: production files are never edited by this harness.
const mutations={
  preview:['js/native-state.js','if(preview)return [];',''],
  share:['js/native-state.js',"text:workoutShareText(r.id)","text:'wrong share text'"],
  workoutSuppression:['js/native-state.js',"if(typeof workoutSummary==='function'){const base=workoutSummary;workoutSummary=function(...args){if(nativeCompleting&&!rollingBack){clearCompletion();return}return base.apply(this,args)}}",''],
  activitySuppression:['js/native-state.js',"if(typeof activityDoneShow==='function'){const base=activityDoneShow;activityDoneShow=function(...args){if(nativeCompleting&&!rollingBack){clearCompletion();return}return base.apply(this,args)}}",''],
  sessionSuppression:['js/native-state.js','if(nativeCompleting&&!rollingBack)clearCompletion();',''],
  scopeReset:['js/native-state.js','nativeCompleting=previousCompleting;',''],
  dismissal:['js/native-state.js','(!c?.cycleId||x.result.dismissedCycleId===c.cycleId)','true'],
  cycleNoop:['js/native-state.js','const completion=plan.noop?cached:buildCompletion(kind,id,cmd.id);','const completion=plan.noop?{...cached,cycleId:cmd.id}:buildCompletion(kind,id,cmd.id);'],
  cycleHead:['js/native-state.js','...(c.cycleId?{cycleId:c.cycleId}:{}),',''],
  bodyContext:['js/native-account.js','bodyMetrics(w.kg,historical)','bodyMetrics(w.kg,state.profile)'],
  authKeys:['js/native-state.js','/^(?:auth|jwt)$/i.test(key)','false'],
  rowCache:['js/native-state.js',"return nativeCached('rows:'+scope,()=>adapter.pageRows(r));",'return adapter.pageRows(r);'],
  exportCache:['js/native-state.js','const {content,name,type}=nativeCached(scope,()=>{let content,name,type;','const {content,name,type}=(()=>{let content,name,type;'],
  cursorLimit:['js/native-state.js','nativeCursors.size>64','nativeCursors.size>640'],
  afterItemLRU:['js/native-state.js','if(cursor){nativeCursors.delete(token);nativeCursors.set(token,cursor)}','if(false){nativeCursors.delete(token);nativeCursors.set(token,cursor)}'],
  escapes:['js/native-state.js',"if(end<content.length&&slash>=offset&&end-slash<=5)","if(false)"],
  surrogate:['js/native-state.js','if(end<content.length&&/[','if(false&&/['],
  routeLimit:['js/native-activity.js',"(state.runRoutes?.length||0)>=200","(state.runRoutes?.length||0)>=2000"],
  routeBusy:['js/native-activity.js',"return busy({});\n  },\n  run(a,p)","return {};\n  },\n  run(a,p)"]
};
const mutation=process.env.PULS_N1_MUTATION;
if(mutation)assert(Object.hasOwn(mutations,mutation),'known mutation');
const harnessRequire=name=>name==='node:fs'?{...fs,readFileSync(path,...args){let source=fs.readFileSync(path,...args);
  if(mutation&&path===mutations[mutation][0]){source=source.replaceAll('\r\n','\n');const [,before,after]=mutations[mutation];assert(source.includes(before),'mutation must match source');source=source.replaceAll(before,after);
    if(mutation==='exportCache')source=source.replace('return {content,name,type};\n  });','return {content,name,type};\n  })();');
  }return source;
}}:require(name);
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require:harnessRequire,console});
function start(o={}){
  const t=app({features,...o});t.ctx.matchMedia=()=>({matches:false,addEventListener(){}});
  let generated=0;t.ctx.crypto={randomUUID:()=>('d1000000-0000-4000-8000-'+String(++generated).padStart(12,'0'))};
  for(const id of ['barcode-camera','ff-torch']){t.el(id).classList.contains=()=>false;t.el(id).setAttribute=()=>{}}
  t.ctx.document.documentElement.setAttribute=()=>{};
  t.el('session-root').setAttribute=()=>{};
  t.run(fs.readFileSync('js/color-scheme.js','utf8'));t.run('date="2026-10-28"');t.start();
  const apply=t.apply,state=t.state;t.apply=a=>clone(apply(a));t.state=()=>clone(state());return t;
}
let serial=0;
const cmd=(op,args)=>({id:'b1000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),userId:owner,baseSeq:0,op,args});
const ok=a=>{assert.equal(a?.ok,true,JSON.stringify(a));return a},code=(a,c)=>{assert.equal(a?.ok,false,JSON.stringify(a));assert.equal(a.error.code,c)};
function query(t,kind,args={}){
  assert.equal(t.ctx.window.pulsNativeQuery({requestId:'n1-query',kind,...args}),true,kind+' '+JSON.stringify(args));
  const r=t.messages.filter(x=>x.type==='nativeResult').at(-1);assert(JSON.stringify(r).length<48*1024);return clone(r);
}
function whole(t,kind,args={}){
  let content='',cursor=null,meta;
  do{const r=ok(query(t,kind,{...args,...(cursor?{cursor}:{})}));meta=r.result;assert.equal(meta.offset,content.length);content+=meta.content;cursor=meta.nextCursor;
    assert(!/[\uD800-\uDBFF]$/.test(meta.content),'chunk never ends with a lone high surrogate');
    if(cursor){const slashes=content.match(/(\\+)$/)?.[1].length??0,unicode=content.match(/(\\+)u[0-9a-f]{0,3}$/i);
      assert.equal(slashes%2,0,'chunk never splits a short escape');assert(!unicode||unicode[1].length%2===0,'chunk never splits a Unicode escape');}
  }while(cursor);
  assert.equal(content.length,meta.totalLength);return meta.encoding==='json'?JSON.parse(content):content;
}
function pages(t,collection,args={}){
  const rows=[];let cursor=null,total;
  do{const r=ok(query(t,'page',{collection,limit:31,...args,...(cursor?{cursor}:{})})).result;total=r.total;rows.push(...r.items);cursor=r.nextCursor}while(cursor);
  assert.equal(rows.length,total);return rows;
}
function compare(name,value){
  value=clone(value);if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/'+name+'.json',JSON.stringify(value,null,2)+'\n');
  assert.deepEqual(value,fixture(name));
}
const applyAsync=async(t,a)=>{const before=t.messages.length;t.ctx.window.pulsNativeApply(clone(a));await new Promise(resolve=>setImmediate(resolve));return t.messages.slice(before).filter(x=>x.type==='ack').at(-1)};
(async()=>{
  for(const o of [{handler:false},{features:['stateBridge']},{features:['nativeExtras','nativeCompletion']},{features:features.filter(x=>!['nativeExtras','nativeCompletion'].includes(x))}]){
    const t=start(o);assert.equal(t.ctx.window.pulsNativeQuery,undefined);
    assert.equal(t.ctx.window.pulsNativeNutrition?.pageRows,undefined);assert.equal(t.ctx.window.pulsNativeAccount?.pageRows,undefined);
    if(t.ctx.window.pulsNativeApply)code(t.apply(cmd('completion.dismiss',{id:'missing'})),'unknown_op');
  }
  let t=start();compare('n1-hello',{...t.messages.find(x=>x.type==='hello'),webVersion:'80'});
  assert.equal(t.ctx.window.pulsNativeQuery({requestId:'x',kind:'export',format:'json',unexpected:1}),false);
  assert.equal(t.ctx.window.pulsNativeQuery({requestId:'x',kind:'page',collection:'diary',date:'2026-10-28',limit:201}),false);
  const onlyCompletion=start({features:['stateBridge','nativeCompletion']});
  code(query(onlyCompletion,'completion',{id:'missing'}),'gone');
  assert.equal(onlyCompletion.ctx.window.pulsNativeQuery({requestId:'x',kind:'export',format:'json'}),false);
  assert.equal(onlyCompletion.messages.find(x=>x.type==='hello').ops.includes('exercise.settings.set'),false);
  console.log('PASS N1: feature/handler isolation, additive capabilities, strict request shapes');

  const training=fixture('training-input').profile,W=training.workouts.find(w=>!w.finished).id;
  t=start({profile:training});
  const finished=cmd('workout.finish',{workoutId:W,confirmUnfinished:true,bodyweight:84.2}),a=ok(t.apply(finished));
  compare('n1-workout-completion',a);
  assert.equal(a.result.completion.cycleId,finished.id);
  const web=start({profile:training,features:features.filter(x=>x!=='nativeCompletion')});ok(web.apply(finished));
  assert.deepEqual(t.state(),web.state(),'native completion preserves the exact Web finish profile');
  assert.equal(web.run('completionId'),W);assert.equal(t.run('completionId'),null);assert.equal(t.run('completionStep'),0);
  assert.equal(t.run('activityDoneId'),null);assert.equal(t.run('xpCelebrationPending'),null);
  assert.equal(a.result.completion.xp,t.run('workoutAwards()["'+W+'"].xp'));
  assert.deepEqual(clone(a.result.completion.level),clone(t.run('xpProgress(totalWorkoutXP())')));
  assert.deepEqual(a.result.completion.summary.volume,t.run('workoutStats([state.workouts.find(w=>w.id==="'+W+'")]).volume'));
  t.run('var completionAwardCalls=0;const n1Awards=workoutAwards;workoutAwards=function(){completionAwardCalls++;return n1Awards()}');
  const calls=t.run('completionAwardCalls');assert.deepEqual(whole(t,'completion',{id:W}),a.result.completion);assert.equal(t.run('completionAwardCalls'),calls,'queries do not recalculate awards');
  const stored=t.store.get('puls-v1');assert.deepEqual(ok(t.apply(finished)).result,a.result);assert.equal(t.store.get('puls-v1'),stored);
  assert.deepEqual(ok(t.apply({...finished,id:cmd('',{}).id})).result.completion,a.result.completion,'lost command ID uses original award');
  const reboot=start({profile:t.state(),store:t.store});assert.deepEqual(whole(reboot,'completion',{id:W}),a.result.completion,'reload retains the frozen completion');
  const dismiss=cmd('completion.dismiss',{id:W});ok(reboot.apply(dismiss));ok(reboot.apply(dismiss));assert.equal(query(reboot,'completion',{id:W}).result.dismissed,true);
  const noopAfterDismiss=cmd('workout.finish',finished.args),nooped=ok(reboot.apply(noopAfterDismiss));
  assert.equal(nooped.result.completion.cycleId,finished.id,'new command ID for noop retains original finish cycle');
  assert.equal(query(reboot,'completion',{id:W}).result.dismissed,true,'appending a noop receipt after dismiss cannot reopen the cycle');
  assert.equal(ok(reboot.apply(noopAfterDismiss)).result.completion.cycleId,finished.id,'known replay also retains cycle');
  const dismissedRestart=start({profile:reboot.state(),store:reboot.store});assert.equal(query(dismissedRestart,'completion',{id:W}).result.dismissed,true);
  t.store.delete('puls-native-applied');const noAward=ok(t.apply({...finished,id:cmd('',{}).id}));assert.equal(noAward.result.completionUnavailable,true);code(query(t,'completion',{id:W}),'gone');
  console.log('PASS N1: workout completion equals Web, no Web completion state, frozen XP/level, replay/reload/dismiss, lost history never recalculates award');

  let reject=false;t=start({profile:training,failWrite:k=>reject&&k==='puls-native-applied'});const raw=t.store.get('puls-v1');reject=true;
  code(t.apply(finished),'persist_failed');assert.equal(t.store.get('puls-v1'),raw);assert.equal(t.state().workouts.find(w=>w.id===W).finished,false);code(query(t,'completion',{id:W}),'gone');
  reject=false;ok(t.apply(finished));
  // Suppression applies only to the native finish transaction, never an unrelated op or rollback render.
  t.run('completionId='+JSON.stringify(W)+';completionStep=2;xpCelebrationPending={id:completionId,levelup:false};var savedN1Render=render;render=function(){renderWorkoutSession();savedN1Render()}');
  const settingsRow=t.state().exerciseBook[0];
  ok(t.apply(cmd('exercise.settings.set',{exerciseId:settingsRow.id,e1rmTarget:180,expect:settingsRow})));
  assert.equal(t.run('completionId'),W);assert.equal(t.run('completionStep'),2);
  ok(t.apply({...finished,id:cmd('',{}).id}));assert.equal(t.run('completionId'),W,'finish noop cannot close an explicit Web review');
  t.run('completionId=null;xpCelebrationPending=null');
  console.log('PASS N1: failed completion persistence rolls back profile/UI/history, retry commits once');

  // Install spies BEFORE loaded() wraps the final providers; render the real session chain, not the harness stub.
  const paintApp=profile=>{const x=start({profile,deferLoad:true});x.run(`
    var n1Paint={workout:0,activity:0,session:0},n1Summary=workoutSummary,n1Done=activityDoneShow,n1Session=renderWorkoutSession;
    workoutSummary=function(...a){n1Paint.workout++;return n1Summary(...a)};
    activityDoneShow=function(...a){n1Paint.activity++;return n1Done(...a)};
    renderWorkoutSession=function(...a){if(completionId||activityDoneId)n1Paint.session++;return n1Session(...a)};
    render=function(){renderWorkoutSession();adaptiveGoals()};
  `);x.load();return x};
  const painted=paintApp(training);
  painted.run('var n1Confirm=confirmWorkoutFinish;confirmWorkoutFinish=function(...a){n1Confirm(...a);completionId=a[1];completionStep=1;renderWorkoutSession()}');
  ok(painted.apply(finished));assert.deepEqual(clone(painted.run('n1Paint')),{workout:0,activity:0,session:0});
  painted.run('workoutSummary('+JSON.stringify(W)+')');assert.equal(painted.run('n1Paint.workout'),1);assert(painted.run('n1Paint.session')>0);assert.equal(painted.run('completionId'),W);
  const paintedRun=paintApp(fixture('account-input').profile),paintKey=ok(paintedRun.apply(cmd('run.start',{type:'soccer',expect:{lastRunId:paintedRun.state().runs?.at(-1)?.id??null}}))).result.startedAt;
  paintedRun.clock.now+=90000;ok(await applyAsync(paintedRun,cmd('run.finish',{startedAt:paintKey})));
  const paintSave=ok(paintedRun.apply(cmd('run.summary.save',{startedAt:paintKey,pausedAt:paintedRun.state().activeRun.pausedAt,feeling:null,terrain:null,note:''})));
  assert.equal(paintedRun.run('n1Paint.activity'),0);assert.equal(paintedRun.run('n1Paint.session'),0);
  paintedRun.run('activityDoneShow('+JSON.stringify(paintSave.result.runId)+')');assert.equal(paintedRun.run('n1Paint.activity'),1);assert.equal(paintedRun.run('activityDoneId'),paintSave.result.runId);
  console.log('PASS N1 review: real finish/session paint suppression and subsequent real Web completions (scope reset)');

  const cycles=start({profile:training});ok(cycles.apply(finished));ok(cycles.apply(cmd('completion.dismiss',{id:W})));
  code(cycles.apply(cmd('completion.dismiss',{id:'foreign-completion'})),'gone');
  cycles.run('reopenWorkout('+JSON.stringify(W)+');state.workouts.find(w=>w.id==='+JSON.stringify(W)+').exercises[0].sets[0].kg=100;save()');
  const second=ok(cycles.apply({...finished,id:cmd('',{}).id}));assert.notEqual(second.result.completion.xp,a.result.completion.xp);
  assert.notEqual(second.result.completion.cycleId,finished.id);
  assert.equal(query(cycles,'completion',{id:W}).result.dismissed,false,'old dismissal cannot hide a new finish cycle');
  const oldCycleDismiss=ok(cycles.apply(cmd('completion.dismiss',{id:W,cycleId:finished.id})));
  assert.equal(oldCycleDismiss.result.dismissedCycleId,finished.id);assert.equal(query(cycles,'completion',{id:W}).result.dismissed,false,'late old-cycle dismissal cannot dismiss new cycle');
  code(cycles.apply(cmd('completion.dismiss',{id:W,cycleId:'unknown-cycle'})),'gone');
  const boundHistory=JSON.parse(cycles.store.get('puls-native-applied'));
  boundHistory.push({id:cmd('',{}).id,userId:'foreign-owner',result:{completion:{...second.result.completion,xp:99999}}},{id:cmd('',{}).id,userId:'foreign-owner',result:{dismissedId:W}});
  cycles.store.set('puls-native-applied',JSON.stringify(boundHistory));assert.equal(whole(cycles,'completion',{id:W}).xp,second.result.completion.xp);assert.equal(query(cycles,'completion',{id:W}).result.dismissed,false);
  code(cycles.apply({...cmd('completion.dismiss',{id:W}),userId:'foreign-owner'}),'wrong_user');
  const onlyForeign=start({profile:training,store:new Map([['puls-native-applied',JSON.stringify(boundHistory.filter(x=>x.userId==='foreign-owner'))]])});
  code(query(onlyForeign,'completion',{id:W}),'gone');code(onlyForeign.apply(cmd('completion.dismiss',{id:W})),'gone');
  console.log('PASS N1 review: dismiss follows latest completion cycle, foreign IDs/users/receipts never match');

  const huge=clone(training);huge.workouts.find(w=>w.id===W).name='Synthetic 😀'.repeat(6000);
  t=start({profile:huge});const bigAck=ok(t.apply(finished));assert.equal(bigAck.result.completion.chunked,true);assert(JSON.stringify(bigAck).length<48*1024);
  assert.equal(bigAck.result.completion.cycleId,finished.id,'chunked head carries the same explicit cycle key');
  assert.equal(whole(t,'completion',{collection:'workout',id:W}).summary.name,huge.workouts.find(w=>w.id===W).name);
  ok(t.apply(cmd('completion.dismiss',{id:W,cycleId:finished.id})));
  t.run('reopenWorkout('+JSON.stringify(W)+');state.workouts.find(w=>w.id==='+JSON.stringify(W)+').name='+JSON.stringify('Changed synthetic 😀'.repeat(6000))+';save()');
  const largeAgain=cmd('workout.finish',finished.args),largeAgainAck=ok(t.apply(largeAgain));
  assert.equal(largeAgainAck.result.completion.chunked,true);assert.equal(largeAgainAck.result.completion.cycleId,largeAgain.id);
  assert.equal(largeAgainAck.result.completion.xp,bigAck.result.completion.xp,'same reward values are a real new cycle after reopen');
  assert.equal(query(t,'completion',{id:W}).result.dismissed,false);assert.equal(t.run('completionId'),null);
  const largeAgainFull=whole(t,'completion',{id:W});assert.equal(largeAgainFull.cycleId,largeAgain.id);assert.equal(largeAgainFull.summary.name,'Changed synthetic 😀'.repeat(6000));
  assert.equal(ok(t.apply(cmd('workout.finish',finished.args))).result.completion.cycleId,largeAgain.id);
  code(query(t,'completion',{collection:'run',id:W}),'gone');
  assert.equal(t.ctx.window.pulsNativeQuery({requestId:'q',kind:'completion',collection:'bad',id:W}),false);
  console.log('PASS N1: large completions use bounded acks and lossless chunks, completion kind checked');

  t=start();const begun=ok(t.apply(cmd('run.start',{type:'soccer',expect:{lastRunId:t.state().runs?.at(-1)?.id??null}}))).result.startedAt;
  t.clock.now+=90000;ok(await applyAsync(t,cmd('run.finish',{startedAt:begun})));
  const save=cmd('run.summary.save',{startedAt:begun,pausedAt:t.state().activeRun.pausedAt,feeling:4,terrain:null,note:'Synthetic N1 run'});
  const saved=ok(t.apply(save));assert.equal(t.run('activityDoneId'),null);assert.equal(t.run('runView'),null);
  const c=saved.result.completion;assert.equal(c.kind,'run');assert.equal(c.summary.durationSeconds,90);assert.equal(c.summary.note,'Synthetic N1 run');
  assert.equal(c.cycleId,save.id);assert.equal(ok(t.apply({...save,id:cmd('',{}).id})).result.completion.cycleId,save.id);
  assert.deepEqual(whole(t,'completion',{id:saved.result.runId}),clone(c));assert.deepEqual(ok(t.apply(save)).result,clone(saved.result));
  console.log('PASS N1: real activity finish/save chain supplies summary and frozen award, no activity Web end screen');

  t=start({features:[...features,'runGps','runActivity','runActivityEndState']});
  const gpsKey=ok(t.apply(cmd('run.start',{type:'run',expect:{lastRunId:t.state().runs?.at(-1)?.id??null}}))).result.startedAt;
  t.clock.now+=600000;
  t.ctx.window.pulsRunGpsReceive({runKey:String(gpsKey),from:0,total:4,points:[[gpsKey,51,10,10,0],[gpsKey+200000,51.004,10,10,0],[gpsKey+400000,51.008,10,10,0],[gpsKey+600000,51.012,10,10,0]]});
  ok(t.apply(cmd('run.lap',{startedAt:gpsKey,expect:{laps:[]}})));
  const gpsFinish=cmd('run.finish',{startedAt:gpsKey});t.ctx.window.pulsNativeApply(gpsFinish);
  t.ctx.window.pulsRunGpsReceive({runKey:String(gpsKey),from:4,total:4,points:[]});t.tick(120);await new Promise(resolve=>setImmediate(resolve));
  ok(t.messages.filter(x=>x.type==='ack'&&x.id===gpsFinish.id).at(-1));
  const gpsSaved=ok(t.apply(cmd('run.summary.save',{startedAt:gpsKey,pausedAt:t.state().activeRun.pausedAt,feeling:3,terrain:'forest',note:'GPS fixture'}))),gpsRow=t.state().runs.find(x=>x.id===gpsSaved.result.runId);
  assert(gpsRow.route);assert(gpsRow.splits.length>0);
  for(const key of ['route','distanceKm','durationSeconds','splits','splitRest','laps'])assert.deepEqual(gpsSaved.result.completion.summary[key],gpsRow[key]??null,key);
  assert.equal(gpsSaved.result.completion.summary.paceSeconds,t.run('runPace(state.runs.at(-1))'));
  assert.equal(t.run('activityDoneId'),null);assert.deepEqual(whole(t,'completion',{collection:'run',id:gpsRow.id}),gpsSaved.result.completion);
  console.log('PASS N1: real GPS drain/save preserves full route, splits, laps and Web pace in frozen native completion');

  const p=clone(fixture('account-input').profile),day='2026-10-28';
  p.foods=Array.from({length:237},(_,i)=>({...p.foods[0],id:'diary-'+i,date:day}));
  p.recipes=Array.from({length:75},(_,i)=>({...p.recipes[0],id:'recipe-'+i}));
  p.weights=Array.from({length:131},(_,i)=>({id:'weight-'+i,date:day,kg:70+i/100}));
  p.measurements=Array.from({length:71},(_,i)=>({id:'measurement-'+i,date:day,neck:40}));
  const old=clone(fixture('progress-input').profile.workouts.find(w=>w.finished));
  p.workouts=Array.from({length:239},(_,i)=>({...clone(old),id:'history-'+i,date:day}));
  p.exerciseBook=Array.from({length:81},(_,i)=>({...clone(p.exerciseBook[0]),id:'book-'+i}));
  t=start({profile:p});const unchanged=JSON.stringify(t.state());
  assert.deepEqual(pages(t,'diary',{date:day}).map(x=>x.id),p.foods.slice().reverse().map(x=>x.id));
  assert.deepEqual(pages(t,'recipes').map(x=>x.id),p.recipes.map(x=>x.id));
  assert.deepEqual(pages(t,'monthEntries',{month:'2026-10'}).filter(x=>x.kind==='workout').map(x=>x.id),p.workouts.map(x=>x.id));
  assert.deepEqual(pages(t,'bodyHistory').map(x=>x.id),p.weights.map(x=>x.id));assert.deepEqual(pages(t,'measurements').map(x=>x.id),p.measurements.map(x=>x.id));
  assert.equal(pages(t,'records').length,81);assert.equal(pages(t,'activityEntries',{mode:'month',offset:0,filter:'gym'}).length,239);
  const exerciseId=t.state().workouts[0].exercises[0].exerciseId;
  // The same Web matching rules include legacy names, not only exercise IDs.
  t.run('state.exerciseBook.push('+JSON.stringify(fixture('progress-input').profile.exerciseBook.find(b=>b.id===exerciseId))+')');
  assert.equal(pages(t,'exerciseHistory',{exerciseId}).length,239);
  assert(pages(t,'metricPoints',{metric:'volume',range:'all'}).length>0);assert(pages(t,'historyDays').length>0);
  t.run('state.exerciseBook.pop()');assert.equal(JSON.stringify(t.state()),unchanged,'page reads never mutate legacy profiles');
  let first=query(t,'page',{collection:'diary',date:day,limit:13});assert.equal(first.result.items.length,13);assert.equal(first.result.total,237);
  code(query(t,'page',{collection:'recipes',cursor:first.result.nextCursor}),'stale_cursor');
  t.run('save()');code(query(t,'page',{collection:'diary',date:day,cursor:first.result.nextCursor}),'stale_cursor');
  first=query(t,'page',{collection:'diary',date:day,limit:13});t.event('window','pagehide');assert.equal(t.ctx.window.pulsNativeQuery({requestId:'q',kind:'export',format:'json'}),false);t.event('window','pageshow',{persisted:true});
  code(query(t,'page',{collection:'diary',date:day,cursor:first.result.nextCursor}),'stale_cursor');
  const priorCursor=query(t,'page',{collection:'diary',date:day,limit:13}).result.nextCursor,reloaded=start({profile:p});
  query(reloaded,'page',{collection:'diary',date:day,limit:13});
  code(query(reloaded,'page',{collection:'diary',date:day,cursor:priorCursor}),'stale_cursor');
  const oldest=query(t,'page',{collection:'diary',date:day,limit:1}).result.nextCursor;
  for(let i=0;i<64;i++)query(t,'page',{collection:'diary',date:day,limit:1});
  code(query(t,'page',{collection:'diary',date:day,cursor:oldest}),'stale_cursor');
  for(const invalid of [{collection:'diary',date:'2026-13-01'},{collection:'monthEntries',month:'2026-13'},
    {collection:'metricPoints',metric:'invalid-metric',range:'all'},{collection:'metricPoints',metric:'weight',range:'invalid'},
    {collection:'activityEntries',mode:'x',offset:0,filter:'all'}]){
    for(const kind of ['page','pageItem']){const before=t.messages.length;assert.equal(t.ctx.window.pulsNativeQuery({requestId:'invalid',kind,...invalid,...(kind==='pageItem'?{itemIndex:0}:{})}),false);assert.equal(t.messages.length,before);}
  }
  code(query(t,'page',{collection:'exerciseHistory',exerciseId:'deleted-id'}),'gone');
  code(query(t,'pageItem',{collection:'exerciseHistory',exerciseId:'deleted-id',itemIndex:0}),'gone');
  assert.deepEqual(pages(t,'activityEntries',{mode:'month',offset:0,filter:'unknown'}),pages(t,'activityEntries',{mode:'month',offset:0,filter:'all'}),'Web normalizes an unknown activity filter');
  console.log('PASS N1: every collection beyond old caps, stable order/ties, totals, unchanged profiles, wrong-filter/save/pagehide cursors rejected');

  const mixed=clone(fixture('progress-input').profile),dates=['2026-10-26','2026-10-28','2026-10-27','2026-10-28'];
  mixed.weights=dates.map((date,i)=>({id:'weight-order-'+i,date,kg:70+i}));
  mixed.measurements=dates.map((date,i)=>({id:'measure-order-'+i,date,neck:39+i}));
  mixed.profileHistory=[{...mixed.profile,date:'2026-10-01',height:180,age:30},{...mixed.profile,date:'2026-10-27',height:200,age:45}];
  const mixedBase=clone(mixed.workouts.find(w=>w.finished));
  mixed.workouts=dates.map((date,i)=>({...clone(mixedBase),id:'workout-order-'+i,date,finishedAt:100+i,exercises:mixedBase.exercises.map(e=>({...clone(e),sets:[{kg:50+i,reps:5+i,done:true}]}))}));
  mixed.runs=[{id:'run-order',date:'2026-10-27',type:'run',distanceKm:1,durationSeconds:400}];
  t=start({profile:mixed});
  assert.deepEqual(pages(t,'measurements',{limit:1}).map(x=>x.id),['measure-order-1','measure-order-3','measure-order-2','measure-order-0']);
  const bodyRows=pages(t,'bodyHistory',{limit:1});assert.deepEqual(bodyRows.map(x=>x.id),['weight-order-1','weight-order-3','weight-order-2','weight-order-0']);
  assert.equal(bodyRows.at(-1).bmi,21.6);assert.equal(bodyRows.at(-1).bodyFat,16.6,'old profile height/age, not current profile');
  assert.equal(bodyRows[0].bmi,17.8);assert.equal(bodyRows[0].bodyFat,15.4,'new historical profile at measurement date');
  assert.deepEqual(pages(t,'monthEntries',{month:'2026-10',limit:1}).map(x=>x.id),['workout-order-0','workout-order-2','run-order','workout-order-1','workout-order-3']);
  assert.deepEqual(pages(t,'activityEntries',{mode:'month',offset:0,filter:'all',limit:1}).map(x=>x.id),['workout-order-3','workout-order-1','workout-order-2','run-order','workout-order-0']);
  const mixedExercise=mixedBase.exercises[0].exerciseId;
  const expectedHistory=clone(t.run('exerciseHistory(state.exerciseBook.find(x=>x.id==='+JSON.stringify(mixedExercise)+')).slice().reverse().map(x=>({workoutId:x.w.id,date:x.w.date,name:x.w.name,e1rm:x.best?Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(x.best)):null,volume:Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(x.volume)),sets:x.sets.map(s=>({kg:s.kg,reps:s.reps}))}))'));
  assert.deepEqual(pages(t,'exerciseHistory',{exerciseId:mixedExercise,limit:1}),expectedHistory);assert.deepEqual(expectedHistory.map(x=>x.workoutId),['workout-order-3','workout-order-1','workout-order-2','workout-order-0']);
  // The optimized record provider and the row builder must each execute once during pagination.
  t.run('var n1RecordCalls=0,n1RecordBase=strengthRecord;strengthRecord=function(...a){n1RecordCalls++;return n1RecordBase(...a)}');
  let recordBuilds=0;const rowProvider=t.ctx.window.pulsNativeProgress.pageRows;
  t.ctx.window.pulsNativeProgress.pageRows=r=>{if(r.collection==='records')recordBuilds++;return rowProvider(r)};
  const allRecords=pages(t,'records',{limit:1}),recordCalls=t.run('n1RecordCalls');assert(allRecords.length>1);assert.equal(recordBuilds,1);pages(t,'records',{limit:1});assert.equal(t.run('n1RecordCalls'),recordCalls);assert.equal(recordBuilds,1);
  t.run('state.exerciseBook[0].target=999;save()');assert.equal(pages(t,'records',{limit:1})[0].target,999);assert.equal(recordBuilds,2);
  console.log('PASS N1 review: mixed dates/ties preserve exact orders, historical body context and complete exercise values; record page cache invalidates on save');

  const oversized=clone(fixture('progress-input').profile),oversizedWorkout=oversized.workouts.find(w=>w.finished),oversizedExercise=oversizedWorkout.exercises[0];
  oversizedExercise.sets=Array.from({length:3000},()=>({kg:50,reps:8,done:true}));
  t=start({profile:oversized});const oversizedBook=oversized.exerciseBook.find(b=>b.id===oversizedExercise.exerciseId),historyArgs={collection:'exerciseHistory',exerciseId:oversizedBook.id};
  const historyPage=ok(query(t,'page',historyArgs)).result;assert.equal(historyPage.encoding,'json');assert.equal(historyPage.itemIndex,0);
  const largeRow=whole(t,'pageItem',{...historyArgs,itemIndex:0,cursor:historyPage.itemCursor});assert.equal(largeRow.sets.length,3000);
  assert.equal(JSON.stringify(t.state()),JSON.stringify(oversized));
  console.log('PASS N1: oversized individual history rows are lossless via pageItem, without changing the profile');

  const longProfile=clone(oversized),longWorkout=longProfile.workouts.find(w=>w.id===oversizedWorkout.id);
  longWorkout.exercises[0].sets=Array.from({length:50000},()=>({kg:50,reps:8,done:true}));
  // Two matching sessions guarantee a real page continuation after the giant first history row.
  longProfile.workouts=longProfile.workouts.filter(w=>w.finished);
  longProfile.workouts.push({...clone(longWorkout),id:'after-large-row',date:'2026-01-01',exercises:longWorkout.exercises.map(e=>({...clone(e),sets:[{kg:40,reps:6,done:true}]}))});
  const longApp=start({profile:longProfile}),longFirst=ok(query(longApp,'page',historyArgs)).result;
  assert(longFirst.afterItemCursor);let longChunk=longFirst,assembled='',chunkCount=0,lastChunkCursor;
  do{
    assert.equal(longChunk.offset,assembled.length);assembled+=longChunk.content;chunkCount++;
    if(!longChunk.nextCursor)break;
    lastChunkCursor=longChunk.nextCursor;
    longChunk=ok(query(longApp,'pageItem',{...historyArgs,itemIndex:longFirst.itemIndex,cursor:lastChunkCursor})).result;
  }while(true);
  assert(chunkCount>64,'regression must exceed the entire cursor budget');assert.equal(JSON.parse(assembled).sets.length,50000);
  const afterLong=ok(query(longApp,'page',{...historyArgs,cursor:longFirst.afterItemCursor})).result;
  assert(afterLong.items.some(x=>x.workoutId==='after-large-row'),'page resumes after >64 chunks without restarting');
  longApp.run('save()');
  code(query(longApp,'page',{...historyArgs,cursor:longFirst.afterItemCursor}),'stale_cursor');
  code(query(longApp,'pageItem',{...historyArgs,itemIndex:longFirst.itemIndex,cursor:lastChunkCursor}),'stale_cursor');
  console.log('PASS N1 follow-up: >64 row chunks retain afterItemCursor via LRU, save still invalidates the whole chain');

  const manyDays=clone(fixture('progress-input').profile);manyDays.chartPeriod='all';
  manyDays.weights=Array.from({length:451},(_,i)=>({id:'daily-weight-'+i,date:new Date(Date.UTC(2025,0,1)+i*86400000).toISOString().slice(0,10),kg:70+i/1000}));
  t=start({profile:manyDays});t.run('var n1MetricBuilds=0,n1MetricBase=buildProgressMetrics;buildProgressMetrics=function(...a){n1MetricBuilds++;return n1MetricBase(...a)}');
  const metricRows=pages(t,'metricPoints',{metric:'weight',range:'all'});assert.equal(metricRows.length,451);assert.equal(t.run('n1MetricBuilds'),1,'one metric build across full page walk');
  const expectedMetric=clone(t.run('filteredMetricPoints(n1MetricBase().definitions.find(x=>x.key==="weight"),"all").map(x=>({date:x.date,value:Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(round(x.value)))}))'));
  assert.deepEqual(metricRows,expectedMetric);
  assert.deepEqual(pages(t,'historyDays'),clone(t.run('trendData().map(x=>({date:x.date,weight:Number.isFinite(x.weight)?Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(x.weight)):null,strength:Number.isFinite(x.strength)?Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(x.strength)):null,kcal:Number.isFinite(x.kcal)?Math.round(x.kcal):null}))')));
  assert.equal(pages(t,'bodyHistory').length,451);
  const staleMetric=query(t,'page',{collection:'metricPoints',metric:'weight',range:'all',limit:1}).result.nextCursor;
  t.run('state.weights[0].kg=90;save()');code(query(t,'page',{collection:'metricPoints',metric:'weight',range:'all',cursor:staleMetric}),'stale_cursor');
  assert.notDeepEqual(pages(t,'metricPoints',{metric:'weight',range:'all'}),metricRows);assert.equal(t.run('n1MetricBuilds'),2);
  console.log('PASS N1: measurement/history series beyond 400 points remain complete over pages');

  t=start({profile:fixture('progress-input').profile});const chart=whole(t,'indexChart');
  const svg=t.run('progressChart()'),rows=clone(t.run('trendData()'));
  for(const [key,points] of Object.entries(chart.series)){
    const baseline=rows.find(x=>x[key]!==null&&x[key]>0)?.[key];assert.deepEqual(points,baseline?rows.filter(x=>x[key]!==null).map(x=>({date:x.date,raw:x[key],v:x[key]/baseline*100})):[]);
    for(const x of points){const xpx=45+(Date.parse(x.date)-Date.parse(chart.first))/Math.max(86400000,Date.parse(chart.last)-Date.parse(chart.first))*630,ypx=210-(x.v-chart.min)/(chart.max-chart.min)*175;assert(svg.includes('cx="'+xpx+'" cy="'+ypx+'"'),'plotted point equals the effective Web SVG')}
  }
  t.run('state.chartLines={weight:false,strength:false,kcal:false};save()');assert.deepEqual(whole(t,'indexChart').series,{});
  console.log('PASS N1: index uses final weekly-weight trendData, full precision and exact effective Web SVG coordinates; hidden lines respected');

  t=start({profile:fixture('training-input').profile});const book=t.state().exerciseBook[0],settings=cmd('exercise.settings.set',{exerciseId:book.id,e1rmTarget:130,repMin:5,repMax:9,loadStep:1.25,muscles:['chest'],expect:book});
  const settingsAck=ok(t.apply(settings));const b=t.state().exerciseBook.find(x=>x.id===book.id);assert.deepEqual(settingsAck.result.exercise,b);assert.equal(b.target,130);assert.equal(b.repMin,5);assert.equal(b.repMax,9);assert.equal(b.loadStep,1.25);assert.deepEqual(b.muscles,['chest']);
  t.store.delete('puls-native-applied');ok(t.apply(settings));code(t.apply(cmd(settings.op,{...settings.args,e1rmTarget:140})),'conflict');
  for(const patch of [{repMin:0},{repMax:31},{loadStep:0},{e1rmTarget:2001},{muscles:['invented']},{repMin:null}])code(t.apply(cmd(settings.op,{...settings.args,...patch,expect:b})),'invalid');
  t.run('modal.open=true');code(t.apply(cmd(settings.op,{...settings.args,expect:b,e1rmTarget:140})),'busy');t.run('modal.open=false');
  console.log('PASS N1: exercise settings use Web saveProgression, raw expect/conflicts, rules, replay and modal isolation');

  const rp=clone(fixture('account-input').profile);rp.runs=[{id:'route-run',date:day,type:'run',distanceKm:1,durationSeconds:400,route:'51,10;51.001,10.001'}];
  t=start({profile:rp});const route=cmd('route.fromRun',{runId:'route-run',routeId:'n1-stable-route',name:' Synthetic route '});
  ok(t.apply(route));const line=clone(t.state().runRoutes.at(-1));assert.equal(line.id,'n1-stable-route');assert.equal(line.name,'Synthetic route');
  t.store.delete('puls-native-applied');ok(t.apply(route));assert.equal(t.state().runRoutes.filter(x=>x.id===line.id).length,1);
  code(t.apply(cmd(route.op,{...route.args,name:'Different'})),'conflict');
  console.log('PASS N1: route.fromRun uses Web conversion, stable ID and replay without duplication, collision conflict');
  const routeBusy=start({profile:rp});routeBusy.run('modal.open=true');code(routeBusy.apply(route),'busy');assert.equal(routeBusy.state().runRoutes?.some(x=>x.id===route.args.routeId)??false,false);
  const fullRoutes=clone(rp);fullRoutes.runRoutes=Array.from({length:200},(_,i)=>({...line,id:'full-'+i}));
  const capped=start({profile:fullRoutes});capped.run('var n1RouteCalls=0,n1RouteBase=runSaveRouteFromRun;runSaveRouteFromRun=function(...a){n1RouteCalls++;return n1RouteBase(...a)}');
  code(capped.apply(route),'invalid');assert.equal(capped.run('n1RouteCalls'),0,'route limit rejects before calling Web mutation');assert.equal(capped.state().runRoutes.length,200);

  for(const [profile,command] of [[fixture('training-input').profile,settings],[rp,route]]){
    let rejectN1=false;const failed=start({profile,failWrite:k=>rejectN1&&k==='puls-native-applied'}),before=failed.store.get('puls-v1');rejectN1=true;
    code(failed.apply(command),'persist_failed');assert.equal(failed.store.get('puls-v1'),before);assert.deepEqual(failed.state(),profile);
    rejectN1=false;ok(failed.apply(command));code(failed.apply({...command,id:cmd('',{}).id,userId:'synthetic-other'}),'wrong_user');
  }
  console.log('PASS N1: settings/route atomic rollback, retry, wrong-owner rejection');

  t=start();let captured;t.ctx.captureCSV=(name,content,type)=>{captured={name,content,type}};
  t.run('var n1Download=downloadText;downloadText=function(...args){captureCSV(...args)};csvExport("foods");downloadText=n1Download');
  assert.equal(whole(t,'export',{format:'csv',csvOptions:{kind:'foods'}}),captured.content);
  assert.equal(t.run('downloadText===n1Download'),true);
  t.run('var n1CsvBase=csvExport;csvExport=function(){throw Error("synthetic CSV failure")}');
  assert.equal(t.ctx.window.pulsNativeQuery({requestId:'badcsv',kind:'export',format:'csv',csvOptions:{kind:'weights'}}),false);assert.equal(t.run('downloadText===n1Download'),true);t.run('csvExport=n1CsvBase');
  const json=whole(t,'export',{format:'json'});assert.equal(json,t.run('JSON.stringify(state,null,2)'));
  t.run('state.foods[0].name='+JSON.stringify('=HYPERLINK("fixture")')+';state.extension={auth:{private:1},jwt:"synthetic jwt",access_token:"synthetic forbidden marker",cloudMeta:{secret:"synthetic"},keep:7};save()');
  assert(whole(t,'export',{format:'csv',csvOptions:{kind:'foods'}}).includes("'="));
  const filtered=JSON.parse(whole(t,'export',{format:'json'}));assert.deepEqual(filtered.extension,{keep:7});
  // Put an emoji / JSON Unicode escape deliberately across the nominal 12-Ki boundary, not just by chance.
  const boundary=start();boundary.run('state.largeFixture="BOUNDARY";save()');
  const prefix=whole(boundary,'export',{format:'json'}).indexOf('BOUNDARY');assert(prefix>0);
  for(const [value,lead] of [['😀',1],['\u0001',2]]){
    const target=(Math.floor(prefix/(12*1024))+1)*12*1024,padding=target-prefix-lead;
    boundary.run('state.largeFixture='+JSON.stringify('a'.repeat(padding)+value+'b'.repeat(30000))+';save()');
    assert.equal(JSON.parse(whole(boundary,'export',{format:'json'})).largeFixture,'a'.repeat(padding)+value+'b'.repeat(30000));
  }
  t.run('state.largeFixture="😀\\u0001".repeat(30000);save();var n1Serializes=0,n1Stringify=JSON.stringify;JSON.stringify=function(value,...a){if(value===state)n1Serializes++;return n1Stringify(value,...a)}');
  assert.equal(JSON.parse(whole(t,'export',{format:'json'})).largeFixture.length,90000);assert.equal(t.run('n1Serializes'),1,'one full export serialization across all chunks');
  t.run('state.largeFixture+="changed";save();n1Serializes=0');assert(JSON.parse(whole(t,'export',{format:'json'})).largeFixture.endsWith('changed'));assert.equal(t.run('n1Serializes'),1);
  // Sharing workouts delegates to the exact formatter; run has no Web share-text provider, so it supplies Web data.
  const sharing=start({profile:fixture('progress-input').profile}),finishedId=sharing.state().workouts.find(w=>w.finished).id;
  assert.equal(whole(sharing,'share',{collection:'workout',id:finishedId}).text,sharing.run('workoutShareText('+JSON.stringify(finishedId)+')'));
  const runId=t.state().runs?.[0]?.id;if(runId){const s=whole(t,'share',{collection:'run',id:runId});assert.equal(s.text,null);assert.equal(s.data.id,runId)}
  const reads=[],get=t.ctx.localStorage.getItem,writes=t.writes.length;t.ctx.localStorage.getItem=k=>{reads.push(k);assert(!/(?:auth|token|session|supabase)/i.test(k),'no auth storage access');return get(k)};
  whole(t,'export',{format:'json'});whole(t,'export',{format:'csv',csvOptions:{kind:'workouts'}});whole(t,'indexChart');
  assert.equal(t.writes.length,writes,'queries do not write to storage');assert.equal(reads.some(k=>k.includes('cloud')),false);
  const noOwner=start();noOwner.run('cloudSession={user:{id:"synthetic-other-owner"}};cloudStatusChanged()');assert.equal(noOwner.ctx.window.pulsNativeQuery({requestId:'q',kind:'export',format:'json'}),false);
  const ro=start({preview:true});const previewGet=ro.ctx.localStorage.getItem,previewReads=[];
  ro.ctx.localStorage.getItem=k=>{previewReads.push(k);return previewGet(k)};
  assert.equal(query(ro,'export',{format:'json'}).ok,true);code(query(ro,'completion',{id:W}),'gone');code(ro.apply(settings),'readonly');
  assert(!previewReads.includes('puls-native-applied'),'preview never reads real receipts, even if applied() catches read exceptions');
  console.log('PASS N1: JSON/CSV Web parity, injection protection, recursive auth-key exclusion, bounded Unicode chunks, sharing, owner/readonly gates');
})().catch(error=>{console.error(error);process.exitCode=1});
