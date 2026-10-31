// M4 package J: native training projection and ops. VM only (mock handlers); no real layout, RLS or device behaviour.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+name+'.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const assetVersion=fs.readFileSync('index.html','utf8').match(/js\/native-state\.js\?v=(\d+)/)[1];
const sessionId=fixture('snapshot').userId,input=fixture('training-input');
const bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split('run(`state.foods=')[0]
  .replace("protocol:'file:'","protocol:'file:',search:options.preview?'?erststart=1':''")
  .replace("value:'',dataset", "focus(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []},value:'',dataset")
  .replace('style:{setProperty(){}}','style:{setProperty(){},removeProperty(){}}');
// Same order as index.html for every file in the training chains (setValue, finish, start, rest, picker, superset).
const files=['interactions','lifecycle','workout-polish','comfort','tracker-tools','nutrition-input','adaptation','food-search','catalog-search','food-upgrade','cloud',
  'account-guide','quick-units','progress-metrics','designs-extra','machine-library','profile-refresh','rest-popup','workout-controls','exercise-muscles','training-polish','running','run-metrics'];
function app(options={}){
  const test=vm.runInNewContext('(function(require,options){'+bootstrap+';return {ctx,run,el}})(require,options)',{require,options,console});
  const {ctx,run,el}=test,messages=[],native=[],events={window:{},document:{}},timers=new Map(),writes=[],observers=[];
  const clock={now:options.now??input.now},RealDate=Date;
  ctx.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock.now]))}static now(){return clock.now}};run('date=today()');
  const store=options.store||new Map();let time=0,timerId=0;
  const on=(surface,name,fn)=>{(events[surface][name]??=[]).push(fn)};
  const event=(surface,name,data={})=>{for(const fn of events[surface][name]||[])fn(data)};
  Object.assign(ctx.localStorage,{getItem:key=>store.get(key)??null,setItem(key,value){writes.push(key);if(options.failWrite?.(key))throw Error('quota');store.set(key,String(value))},removeItem:key=>store.delete(key)});
  ctx.document.visibilityState='visible';ctx.document.readyState='loading';ctx.document.documentElement.dataset={scheme:'dark'};
  ctx.document.currentScript={src:'http://localhost/js/native-state.js?v='+assetVersion};
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
  ctx.window.pulsNativeFeatures=options.features??['stateBridge','nativeTraining'];
  if(options.handler!==false){
    ctx.window.webkit={messageHandlers:{pulsState:{postMessage:msg=>messages.push(clone(msg))},pulsNative:{postMessage:msg=>native.push(clone(msg))}}};
    run(fs.readFileSync('js/native-bridge.js','utf8'));
  }
  const load=()=>{ctx.document.readyState='complete';event('window','load')};
  const tick=ms=>{time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}};
  const apply=cmd=>{ctx.window.pulsNativeApply(clone(cmd));return messages.filter(x=>x.type==='ack').at(-1)};
  const start=()=>{for(const file of ['native-state','native-projection','native-training'])run(fs.readFileSync('js/'+file+'.js','utf8'));if(!options.deferLoad)load()};
  return {...test,options,clock,store,messages,native,writes,timers,event,tick,load,start,apply,mutate:()=>observers.forEach(fn=>fn([])),
    state:()=>JSON.parse(run('JSON.stringify(state)')),snapshots:()=>messages.filter(x=>x.type==='snapshot'),
    training:()=>messages.filter(x=>x.type==='projection'&&x.name==='training').at(-1)};
}
const started=options=>{const t=app(options);t.start();return t};
let serial=0;const cid=()=>'c0000000-0000-4000-8000-'+String(++serial).padStart(12,'0');
const cmd=(op,args,id=cid())=>({id,userId:sessionId,baseSeq:0,op,args});
const W='o0000000-0000-4000-8000-000000000003',BENCH='e0000000-0000-4000-8000-000000000011',FLY='e0000000-0000-4000-8000-000000000012',ROUTINE='t0000000-0000-4000-8000-000000000001';
const workout=t=>t.state().workouts.find(w=>w.id===W),exercise=(t,id)=>workout(t).exercises.find(e=>e.id===id);
const ok=(ack,label)=>{assert.equal(ack.ok,true,label+': '+JSON.stringify(ack.error));return ack};
const code=(ack,expected,label)=>{assert.equal(ack.ok,false,label);assert.equal(ack.error.code,expected,label+': '+ack.error.message);return ack};
const TRAINING_OPS=['workout.start','set.update','set.add','set.remove','exercise.add','exercise.remove','exercise.move','superset.set','rest.adjust','rest.skip',
  'workout.finish','workout.discard','routine.save','routine.delete','exercise.create'];

(async()=>{
  // Browser, old IPA (M2/M3 features) and missing handler: no training globals, wrappers or ops.
  for(const options of [{handler:false},{features:['stateBridge']},{features:['stateBridge','nativeOverview','nativeTabs','nativeBody']},{features:['nativeTraining']}]){
    const t=app(options),before=t.run('[openWorkoutSession,showRestPopup,setValue,startRoutine,confirmWorkoutFinish]');t.start();
    for(const name of ['pulsNativeTraining','pulsNativeSetTraining','pulsNativeExerciseSearch'])assert.equal(t.ctx.window[name],undefined,name);
    t.run('[openWorkoutSession,showRestPopup,setValue,startRoutine,confirmWorkoutFinish]').forEach((fn,i)=>assert.equal(fn,before[i]));
    assert.equal(t.messages.some(x=>x.type==='projection'&&x.name==='training'),false);
    if(options.features?.includes('stateBridge')&&options.handler!==false){
      assert.deepEqual(t.messages.find(x=>x.type==='hello'),{...fixture('hello'),webVersion:assetVersion},'hello unchanged without nativeTraining');
      const stored=t.store.get('puls-v1');code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:true,expect:{kg:80,reps:7,done:false}})),'unknown_op','old IPA');
      assert.equal(t.store.get('puls-v1'),stored);
    }
  }
  console.log('PASS: no training globals, wrappers, ops or projection without stateBridge + nativeTraining');

  let t=started();
  const hello=t.messages.find(x=>x.type==='hello');
  assert.deepEqual(hello.ops,['weight.upsert','weight.delete',...TRAINING_OPS]);assert.deepEqual(hello.screens,['body','training']);
  assert.deepEqual(hello.projections,['overview','training']);assert.deepEqual(hello.features,['nativeTabs','nativeTraining']);
  const view=t.training();
  assert.deepEqual(view,fixture('training-projection'),'shared deterministic training projection fixture');
  assert.equal(t.run('validData(state)'),true);assert.deepEqual(t.state(),input.profile,'projection never mutates the profile');
  const bench=view.training.active.exercises[0];
  assert.deepEqual(bench.sets.map(s=>s.previous),[{kg:80,reps:8,shownKg:80},{kg:80,reps:7,shownKg:80},null],'Web "Vorher" column by index');
  assert.equal(bench.sets[2].kg,'',"empty values stay ''");assert.deepEqual(bench.supersetWith,[FLY]);
  assert.equal(view.training.active.rest.endAt,input.now+60000);assert.equal(view.training.active.autoFinishAt,input.profile.workouts[1].startedAt+5*3600000);
  assert.equal(view.training.identity.level,t.run('xpProgress(totalWorkoutXP()).level'));assert.equal(view.training.recommendation.nextRoutineId,t.run('routineRecommendation().next?.id??null'));
  assert(!('overview' in view)&&!('accountSection' in view),'training envelope carries only its own body');
  // Cheap renders: unchanged inputs never rebuild; saves rebuild once per debounce and only resend on change.
  // The first render persists derived adaptive goals (a real save); later renders are pure.
  t.run('render()');t.tick(300);t.run('var trainingBuilds=0;const countedBuild=window.pulsNativeTraining.build;window.pulsNativeTraining.build=function(...a){trainingBuilds++;return countedBuild(...a)}');
  const sentBefore=t.messages.filter(x=>x.type==='projection').length;
  for(let i=0;i<5;i++){t.run('render();go("food");render()');t.tick(300)}
  assert.equal(t.run('trainingBuilds'),0);assert.equal(t.messages.filter(x=>x.type==='projection').length,sentBefore);
  t.run('state.xUnknown={changed:true};save();save()');t.tick(300);assert.equal(t.run('trainingBuilds'),1);
  assert.equal(t.messages.filter(x=>x.type==='projection').length,sentBefore,'unchanged training data is not resent');
  console.log('PASS: training hello, exact projection fixture (prefill hints, \'\' values, supersets, rest, XP), cheap renders and dedup');

  // set.update: exact Web chain incl. rest start/Live Activity message, conflicts, idempotent replay.
  const solo=clone(input.profile);for(const e of solo.workouts[1].exercises)delete e.superset;
  t=started({profile:solo});
  let update=cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,kg:82.5,reps:8,done:true,expect:{kg:80,reps:7,done:false}});
  t.run('render()');t.tick(300);// native-bridge already reported the running rest (400 ms interval in the app)
  const nativeBefore=t.native.length;ok(t.apply(update),'set.update');
  assert.deepEqual(exercise(t,BENCH).sets[1],{kg:82.5,reps:8,done:true});
  assert.deepEqual(workout(t).rest,{endAt:input.now+120000,exerciseId:BENCH},'exercise rest 120 s starts');
  const starts=t.native.slice(nativeBefore).filter(x=>x.type==='restStart');
  assert.equal(starts.filter(x=>x.endsAt===input.now+120000).length,1,'one restStart for the new rest');assert.equal(starts.at(-1).endsAt,input.now+120000);
  assert.equal(t.snapshots().at(-1).reason,'apply');assert.deepEqual(t.snapshots().at(-1).state,JSON.parse(t.store.get('puls-v1')));
  assert.equal(t.training().reason,'apply');assert.deepEqual(t.training().training.active.exercises[0].sets[1].kg,82.5);
  let stored=t.store.get('puls-v1');ok(t.apply(update),'replay by ID');assert.equal(t.store.get('puls-v1'),stored);
  t.store.delete('puls-native-applied');ok(t.apply({...update,id:cid()}),'replay without history is harmless');
  assert.deepEqual(workout(t).rest,{endAt:input.now+120000,exerciseId:BENCH},'already done: no second rest');
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,kg:90,expect:{kg:80,reps:7,done:false}})),'conflict','stale expect');
  assert.equal(exercise(t,BENCH).sets[1].kg,82.5);
  for(const args of [{kg:-1},{kg:1001},{kg:'80'},{reps:0},{reps:1.5},{done:'yes'},{},{kg:'',done:true}])
    code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:2,...args,expect:{kg:'',reps:'',done:false}})),'invalid',JSON.stringify(args));
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:2,done:true,expect:{kg:'',reps:'',done:false}})),'invalid','done without kg/reps');
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:2,kg:80})),'invalid','expect required');
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:9,kg:80,expect:{kg:'',reps:'',done:false}})),'gone','set index');
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:'missing',setIndex:0,kg:80,expect:{kg:'',reps:'',done:false}})),'gone','exercise');
  ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:false,expect:{kg:82.5,reps:8,done:true}})),'undo done');
  assert.equal(workout(t).rest,null,'unchecking the resting set ends its rest');
  ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:0,kg:'',expect:{kg:80,reps:8,done:true}})),'empty kg');
  assert.deepEqual(exercise(t,BENCH).sets[0],{kg:'',reps:8,done:false},'emptied value clears done like the Web');
  // Superset (tracker-tools.js): an open round starts no rest, the completed round starts the partner's rest.
  t=started();ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:true,expect:{kg:80,reps:7,done:false}})),'superset part');
  assert.equal(workout(t).rest,null);
  ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:FLY,setIndex:0,done:true,expect:{kg:15,reps:12,done:false}})),'superset round');
  assert.deepEqual(workout(t).rest,{endAt:input.now+90000,exerciseId:FLY});
  // Same values via the Web functions produce the same profile.
  const web=started({profile:solo});web.run(`setValue('${W}','${BENCH}',1,'kg','82,5');setValue('${W}','${BENCH}',1,'reps','8');setValue('${W}','${BENCH}',1,'done',true)`);
  const nativeTwin=started({profile:solo});ok(nativeTwin.apply(update),'twin');assert.deepEqual(nativeTwin.state(),web.state(),'op equals Web input path');
  console.log('PASS: set.update via final setValue chain, rest/restStart once, superset rest, expect conflicts, replay and Web equivalence');

  // set.add/remove with Web prefill, counts and the one-set minimum.
  t=started();
  let add=cmd('set.add',{workoutId:W,exerciseId:FLY,expect:{setCount:2}});
  assert.deepEqual(ok(t.apply(add),'set.add').result,{setIndex:2});assert.deepEqual(exercise(t,FLY).sets[2],{kg:'',reps:'',done:false},'copies the last set when no previous set exists');
  ok(t.apply(cmd('set.add',{workoutId:W,exerciseId:BENCH,expect:{setCount:3}})),'add bench');
  assert.deepEqual(exercise(t,BENCH).sets[3],{kg:'',reps:'',done:false});
  t.store.delete('puls-native-applied');assert.deepEqual(ok(t.apply({...add,id:cid()}),'replay').result,{setIndex:2});assert.equal(exercise(t,FLY).sets.length,3);
  code(t.apply(cmd('set.add',{workoutId:W,exerciseId:FLY,expect:{setCount:0}})),'conflict','count');
  ok(t.apply(cmd('set.remove',{workoutId:W,exerciseId:FLY,expect:{setCount:3}})),'remove');assert.equal(exercise(t,FLY).sets.length,2);
  ok(t.apply(cmd('set.remove',{workoutId:W,exerciseId:FLY,expect:{setCount:3}})),'remove replay');assert.equal(exercise(t,FLY).sets.length,2);
  t.run(`state.workouts.find(w=>w.id==='${W}').exercises[1].sets.pop();save()`);
  code(t.apply(cmd('set.remove',{workoutId:W,exerciseId:FLY,expect:{setCount:1}})),'invalid','one set stays');
  t=started();t.run(`state.workouts.find(w=>w.id==='${W}').exercises[0].sets[2]={kg:70,reps:5,done:true};save()`);
  ok(t.apply(cmd('set.remove',{workoutId:W,exerciseId:BENCH,expect:{setCount:3}})),'remove completed last set without Web confirm');
  assert.equal(t.run('typeof confirm()'),'boolean');assert.equal(exercise(t,BENCH).sets.length,2);
  console.log('PASS: set.add/remove with Web prefill source, counts, replay, minimum one set and confirmed removal');

  // Exercises: catalog/library/own entries, order, removal, superset.
  t=started();
  const catalog=t.run('exerciseCatalog.find(x=>x.name==="Machine Lateral Raise").id');
  let added=ok(t.apply(cmd('exercise.add',{workoutId:W,libraryId:catalog,expect:{exerciseCount:2}})),'catalog add').result;
  assert.equal(added.libraryId,catalog);assert(t.state().exerciseBook.some(b=>b.id===catalog),'ensureBook adds the catalog entry');
  assert.deepEqual(exercise(t,added.exerciseId).sets,[{kg:'',reps:'',done:false}]);assert.equal(exercise(t,added.exerciseId).restSeconds,90);
  const own=ok(t.apply(cmd('exercise.add',{workoutId:W,name:'  Meine Spezialpresse ',expect:{exerciseCount:3}})),'own add').result;
  assert.equal(t.state().exerciseBook.find(b=>b.id===own.libraryId).name,'Meine Spezialpresse');
  code(t.apply(cmd('exercise.add',{workoutId:W,libraryId:'unknown',expect:{exerciseCount:4}})),'invalid','unknown');
  code(t.apply(cmd('exercise.add',{workoutId:W,libraryId:catalog,expect:{exerciseCount:2}})),'conflict','count');
  t.store.delete('puls-native-applied');assert.deepEqual(ok(t.apply(cmd('exercise.add',{workoutId:W,name:'meine spezialpresse',expect:{exerciseCount:3}})),'own replay').result,own);
  t.run('openModal("Fremdes Formular","<input>")');code(t.apply(cmd('exercise.add',{workoutId:W,libraryId:catalog,expect:{exerciseCount:4}})),'busy','open Web dialog');
  assert.equal(t.run('modal.open'),true,'unrelated Web form stays open');t.run('modal.close()');
  const order=[BENCH,FLY,added.exerciseId,own.exerciseId];
  ok(t.apply(cmd('exercise.move',{workoutId:W,exerciseId:own.exerciseId,toIndex:0,expect:{order}})),'move');
  assert.deepEqual(workout(t).exercises.map(e=>e.id),[own.exerciseId,BENCH,FLY,added.exerciseId]);
  ok(t.apply(cmd('exercise.move',{workoutId:W,exerciseId:own.exerciseId,toIndex:0,expect:{order}})),'move replay');
  code(t.apply(cmd('exercise.move',{workoutId:W,exerciseId:BENCH,toIndex:3,expect:{order}})),'conflict','stale order');
  ok(t.apply(cmd('superset.set',{workoutId:W,exerciseId:added.exerciseId,partnerId:own.exerciseId})),'superset');
  assert.equal(exercise(t,added.exerciseId).superset,exercise(t,own.exerciseId).superset);assert.equal(typeof exercise(t,own.exerciseId).superset,'string');
  ok(t.apply(cmd('superset.set',{workoutId:W,exerciseId:added.exerciseId,partnerId:null})),'unlink');assert.equal(exercise(t,added.exerciseId).superset,undefined);
  code(t.apply(cmd('superset.set',{workoutId:W,exerciseId:added.exerciseId,partnerId:added.exerciseId})),'invalid','self');
  code(t.apply(cmd('exercise.remove',{workoutId:W,exerciseId:BENCH,expect:{doneSets:0}})),'conflict','done sets changed');
  ok(t.apply(cmd('exercise.remove',{workoutId:W,exerciseId:BENCH,expect:{doneSets:1}})),'remove');
  assert(!workout(t).exercises.some(e=>e.id===BENCH));assert.equal(workout(t).rest,null,'the rest of a removed exercise ends');
  ok(t.apply(cmd('exercise.remove',{workoutId:W,exerciseId:BENCH,expect:{doneSets:1}})),'remove idempotent');
  assert.equal(t.run('modal.open'),false);
  t=started();ok(t.apply(cmd('exercise.remove',{workoutId:W,exerciseId:BENCH,expect:{doneSets:1}})),'remove resting exercise');assert.equal(workout(t).rest,null,'its rest ends');
  console.log('PASS: exercise add (catalog/library/own), busy protection, move, superset, remove incl. rest and replays');

  // Rest: ±30 s, skip, stale rests, Live Activity cancel exactly once.
  t=started();const endAt=input.now+60000;
  assert.deepEqual(ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt}})),'+30').result,{endAt:endAt+30000});
  code(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt}})),'gone','stale rest');
  ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:-30,expect:{endAt:endAt+30000}})),'-30');assert.equal(workout(t).rest.endAt,endAt);
  code(t.apply(cmd('rest.adjust',{workoutId:W,seconds:15,expect:{endAt}})),'invalid','only 30 s');
  let cancels=t.native.filter(x=>x.type==='restCancel').length;
  ok(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt}})),'skip');assert.equal(workout(t).rest,null);
  ok(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt}})),'skip replay');t.run('save();render()');
  assert.equal(t.native.filter(x=>x.type==='restCancel').length,cancels+1,'restCancel exactly once');
  t.clock.now=input.now+10000;t.run(`state.workouts.find(w=>w.id==='${W}').rest={endAt:${input.now+20000},exerciseId:'${BENCH}'};save()`);
  ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:-30,expect:{endAt:input.now+20000}})),'-30 ends a short rest');assert.equal(workout(t).rest,null);
  console.log('PASS: rest ±30 s, stale rest gone, skip idempotent, short rest ended, restCancel once');

  // Finish: same chain as the Web sheet, identical XP/completion data, rest/Live Activity end once.
  t=started();
  code(t.apply(cmd('workout.finish',{workoutId:W,bodyweight:null})),'conflict','unchecked sets need confirmation');
  code(t.apply(cmd('workout.finish',{workoutId:W,bodyweight:19,confirmUnfinished:true})),'invalid','bodyweight');
  cancels=t.native.filter(x=>x.type==='restCancel').length;const chromeBefore=t.messages.filter(x=>x.type==='chrome').length;
  const finish=cmd('workout.finish',{workoutId:W,bodyweight:83.4,confirmUnfinished:true});ok(t.apply(finish),'finish');
  let done=workout(t);assert.equal(done.finished,true);assert.equal(done.bodyweight,83.4);assert.equal(done.rest,null);
  assert.deepEqual(done.exercises.map(e=>e.sets),[[{kg:80,reps:8,done:true}],[]],'unchecked sets dropped like the Web');
  assert.equal(done.durationSeconds,1200);assert.equal(t.state().weights.filter(x=>x.date===done.date).map(x=>x.kg).join(),'83.4');
  assert.equal(t.run('completionId'),W,'Web completion screen follows');assert.equal(t.run('sessionWorkoutId'),null);assert.equal(t.run('modal.open'),false);
  assert.equal(t.native.filter(x=>x.type==='restCancel').length,cancels+1,'Live Activity ended once');t.run('save();render()');
  assert.equal(t.native.filter(x=>x.type==='restCancel').length,cancels+1);
  const chromes=t.messages.filter(x=>x.type==='chrome').slice(chromeBefore);assert(!chromes.some(x=>x.reason==='modal'),'no transient modal chrome');
  assert.equal(t.training().training.active,null);ok(t.apply(finish),'replay');ok(t.apply({...finish,id:cid()}),'finished workout: noop');
  const webFinish=started();webFinish.run(`finishWorkout('${W}');$('finish-bodyweight').value='83.4';confirmWorkoutFinish({preventDefault(){}},'${W}')`);
  const a=t.state(),b=webFinish.state(),strip=s=>{s.weights=s.weights.map(({id,...x})=>x);return s};
  assert.deepEqual(strip(a),strip(b),'native finish equals the Web finish flow');assert.deepEqual(clone(t.run('workoutAwards()')),clone(webFinish.run('workoutAwards()')),'identical XP awards');
  t=started();t.run(`state.workouts.find(w=>w.id==='${W}').exercises.forEach(e=>e.sets.forEach(s=>s.done=false));save()`);
  code(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'invalid','no logged set');assert.equal(workout(t).finished,false);
  console.log('PASS: workout.finish via finishWorkout/confirmWorkoutFinish, Web-identical XP/data, completion, one restCancel, no modal chrome, replay');

  // Five-hour rule runs before any op; no op revives the session.
  t=started();t.clock.now=input.profile.workouts[1].startedAt+5*3600000+1;
  code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:true,expect:{kg:80,reps:7,done:false}})),'gone','after 5 h');
  done=workout(t);assert.equal(done.autoFinished,true);assert.equal(done.durationSeconds,18000);assert.equal(done.exercises[0].sets.length,3,'auto-finish keeps inputs');
  code(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'gone','auto-finished');
  t.tick(300);assert.equal(t.snapshots().at(-1).reason,'autofinish');
  const next=ok(t.apply(cmd('workout.start',{routineId:ROUTINE})),'start after auto-finish').result;assert.equal(next.started,true);
  console.log('PASS: 5-h sweep before ops, gone for set/finish, autofinish snapshot, new start allowed');

  // Start: no double session, prefill never done, IDs from the routine, no Web session opened.
  t=started({profile:{...clone(input.profile),workouts:[input.profile.workouts[0]]}});
  const startCmd=cmd('workout.start',{routineId:ROUTINE});const startedNow=ok(t.apply(startCmd),'start').result;
  assert.equal(startedNow.started,true);let fresh=t.state().workouts.find(w=>w.id===startedNow.workoutId);
  assert.equal(fresh.routineId,ROUTINE);assert.equal(fresh.durationXpVersion,1);assert.equal(fresh.startedAt,input.now);
  assert.deepEqual(fresh.exercises.map(e=>e.exerciseId),input.profile.routines[0].exercises.map(e=>e.exerciseId));
  assert.deepEqual(fresh.exercises[0].sets,[{kg:80,reps:8,done:false},{kg:80,reps:7,done:false},{kg:'',reps:'',done:false}],'prefill from the last workout, never done');
  assert.equal(fresh.exercises[1].superset,input.profile.routines[0].exercises[1].superset);
  assert.equal(t.run('sessionWorkoutId'),null,'ops never open the Web session');
  assert.deepEqual(ok(t.apply(startCmd),'replay').result,startedNow);
  assert.deepEqual(ok(t.apply(cmd('workout.start',{routineId:ROUTINE})),'second start').result,{workoutId:startedNow.workoutId,started:false});
  assert.equal(t.state().workouts.filter(w=>!w.finished).length,1,'no duplicate session');
  ok(t.apply(cmd('workout.discard',{workoutId:startedNow.workoutId})),'discard');
  const empty=ok(t.apply(cmd('workout.start',{routineId:null,name:'  Freies Training '})),'empty start').result;
  fresh=t.state().workouts.find(w=>w.id===empty.workoutId);assert.equal(fresh.name,'Freies Training');assert.deepEqual(fresh.exercises,[]);assert.equal(t.run('modal.open'),false);
  code(t.apply(cmd('workout.start',{routineId:null,name:' '})),'invalid','empty name');
  t.run('state.workouts=state.workouts.filter(w=>w.finished);save()');code(t.apply(cmd('workout.start',{routineId:'t-missing'})),'gone','routine gone');
  const webStart=started({profile:{...clone(input.profile),workouts:[input.profile.workouts[0]]}});webStart.run(`startRoutine('${ROUTINE}')`);
  const nativeStart=started({profile:{...clone(input.profile),workouts:[input.profile.workouts[0]]}});ok(nativeStart.apply(cmd('workout.start',{routineId:ROUTINE})),'twin');
  const ids=s=>{for(const w of s.workouts){if(!w.finished)w.id='new';for(const e of w.exercises)if(!w.finished)e.id='new'}return s};
  assert.deepEqual(ids(nativeStart.state()),ids(webStart.state()),'native start equals Web startRoutine');
  // Discard: Web confirmation action, idempotent, Live Activity cancel once, finished workouts untouched.
  t=started();cancels=t.native.filter(x=>x.type==='restCancel').length;ok(t.apply(cmd('workout.discard',{workoutId:W})),'discard');
  assert.equal(workout(t),undefined);assert.equal(t.native.filter(x=>x.type==='restCancel').length,cancels+1);
  ok(t.apply(cmd('workout.discard',{workoutId:W})),'missing is ok');code(t.apply(cmd('workout.discard',{workoutId:input.profile.workouts[0].id})),'gone','finished');
  assert(t.state().workouts.some(w=>w.id===input.profile.workouts[0].id));
  console.log('PASS: workout.start (routine/empty) without second session, prefill never done, routine IDs, Web-equal start, discard');

  // Routines and own exercises.
  t=started();const routine=clone(input.profile.routines[0]);
  const created=ok(t.apply(cmd('exercise.create',{name:'Kabelrudern eng'})),'create').result;assert.equal(created.created,true);
  assert.deepEqual(ok(t.apply(cmd('exercise.create',{name:'kabelrudern ENG '})),'by name').result,{libraryId:created.libraryId,created:false});
  const fresh2={id:'t0000000-0000-4000-8000-000000000099',name:' Rücken ',exercises:[{exerciseId:created.libraryId,sets:3,min:8,max:12,restSeconds:75}],xKeep:{deep:1}};
  ok(t.apply(cmd('routine.save',{routine:fresh2,expect:null})),'create routine');
  assert.deepEqual(t.state().routines.at(-1),{...fresh2,name:'Rücken'},'unknown fields kept, name trimmed');assert.equal(t.run('trainTab'),'routines');
  code(t.apply(cmd('routine.save',{routine:{...fresh2,name:'Anders'},expect:null})),'conflict','exists');
  const edited={...routine,name:'Push B',exercises:[...routine.exercises].reverse()};
  ok(t.apply(cmd('routine.save',{routine:edited,expect:routine})),'edit');assert.deepEqual(t.state().routines[0],edited);
  ok(t.apply(cmd('routine.save',{routine:edited,expect:routine})),'edit replay');
  code(t.apply(cmd('routine.save',{routine:{...edited,name:'Push C'},expect:routine})),'conflict','stale');
  for(const bad of [{exercises:[]},{name:''},{exercises:[{...routine.exercises[0],sets:13}]},{exercises:[{...routine.exercises[0],max:5,min:6}]},{exercises:[{...routine.exercises[0],exerciseId:'unknown'}]},{exercises:[{...routine.exercises[0],restSeconds:901}]}])
    code(t.apply(cmd('routine.save',{routine:{...edited,...bad},expect:edited})),'invalid',JSON.stringify(bad));
  ok(t.apply(cmd('routine.delete',{routineId:fresh2.id})),'delete');assert(!t.state().routines.some(r=>r.id===fresh2.id));
  ok(t.apply(cmd('routine.delete',{routineId:fresh2.id})),'delete idempotent');
  assert(t.state().workouts.some(w=>w.routineId===ROUTINE),'history keeps routine IDs');
  // exercise.create {catalogKey}: same library entry as ensureBook in the Web; existing entries are reused.
  t=started();const lateral=t.run('exerciseCatalog.find(x=>x.name==="Machine Lateral Raise").id');
  const fromCatalog=cmd('exercise.create',{catalogKey:lateral});
  assert.deepEqual(ok(t.apply(fromCatalog),'catalog create').result,{libraryId:lateral,created:true});
  const webBook=started();webBook.run(`ensureBook('${lateral}')`);
  assert.deepEqual(t.state().exerciseBook.at(-1),webBook.state().exerciseBook.at(-1),'entry equals Web ensureBook (name, muscles, equipment)');
  assert.deepEqual(t.state().exerciseBook.at(-1).muscles,['shoulders']);assert.equal(t.state().exerciseBook.at(-1).equipment,'machine');
  assert.deepEqual(ok(t.apply(fromCatalog),'replay').result,{libraryId:lateral,created:true});
  assert.deepEqual(ok(t.apply(cmd('exercise.create',{catalogKey:lateral})),'again').result,{libraryId:lateral,created:false});
  assert.deepEqual(ok(t.apply(cmd('exercise.create',{catalogKey:'x0000000-0000-4000-8000-000000000001'})),'library ID').result,{libraryId:'x0000000-0000-4000-8000-000000000001',created:false});
  const sameName=t.run('exerciseCatalog.find(x=>x.name==="Machine Bench Press")');
  const named=ok(t.apply(cmd('exercise.create',{name:sameName.name.toUpperCase()})),'own entry first').result;
  assert.deepEqual(ok(t.apply(cmd('exercise.create',{catalogKey:sameName.id})),'same name').result,{libraryId:named.libraryId,created:false},'bookByName like ensureBook');
  const books=t.state().exerciseBook.length;
  for(const args of [{catalogKey:'unknown'},{catalogKey:''},{catalogKey:lateral,name:'x'},{}])code(t.apply(cmd('exercise.create',args)),'invalid',JSON.stringify(args));
  assert.equal(t.state().exerciseBook.length,books);
  t=started();assert.equal(ok(t.apply(fixture('apply-training-exercise-create')),'fixture').result.created,true);
  console.log('PASS: routine.save create/edit/conflict/rules with unknown fields, delete idempotent, exercise.create by name and catalogKey');

  // Failure paths roll back profile, history and Web UI state.
  for(const fail of ['puls-v1','puls-native-applied']){
    t=started();const memory=t.run('JSON.stringify(state)'),raw=t.store.get('puls-v1');t.options.failWrite=key=>key===fail;
    code(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'persist_failed',fail);
    assert.equal(t.run('JSON.stringify(state)'),memory);assert.equal(t.store.get('puls-v1'),raw);assert.equal(t.run('completionId'),null);assert.equal(t.run('modal.open'),false);
    delete t.options.failWrite;ok(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'retry');
  }
  t=started();const before=t.run('JSON.stringify(state)');t.run('const realAddSet=addSet;addSet=function(){realAddSet.apply(this,arguments);throw Error("boom")}');
  code(t.apply(cmd('set.add',{workoutId:W,exerciseId:FLY,expect:{setCount:2}})),'invalid','throwing Web function');assert.equal(t.run('JSON.stringify(state)'),before);
  for(const flag of ['stateRecoveryPending=true','cloudUploadBlocked=true']){t=started();t.run(flag);code(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt:input.now+60000}})),'readonly',flag)}
  t=started({preview:true});code(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt:input.now+60000}})),'readonly','preview');assert.equal(t.writes.length,0);
  t=started();code(t.apply({...cmd('rest.skip',{workoutId:W,expect:{endAt:input.now+60000}}),userId:null}),'wrong_user','user');
  console.log('PASS: persist_failed/invalid rollback incl. UI state, readonly, preview and wrong_user');

  // Chrome/session model: confirmed native training receives Web session entries; fallback stays the Web session.
  t=started({features:['stateBridge','nativeTraining','nativeTabs','nativeOverview']});
  const opens=()=>t.messages.filter(x=>x.type==='openNative');
  assert.equal(t.ctx.window.pulsNativeSetTraining('yes'),false);
  t.run(`openWorkoutSession('${W}')`);assert.equal(t.run('sessionWorkoutId'),W,'unconfirmed: Web session');
  assert.equal(t.ctx.window.pulsNativeSetTraining(true),false,'not while the Web session blocks');t.run('minimizeSession()');
  assert.equal(t.ctx.window.pulsNativeSetTraining(true),true);
  t.run('openModal("Quick add","")');t.run(`openWorkoutSession('${W}')`);
  assert.deepEqual(opens().at(-1),{protocol:1,type:'openNative',screen:'training',workoutId:W});assert.equal(t.run('sessionWorkoutId'),null);assert.equal(t.run('modal.open'),false);
  t.run('openWorkoutSession("not-active")');assert.equal(opens().length,1);
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'resumeWorkout',id:W,web:true}),true);assert.equal(t.run('sessionWorkoutId'),W,'explicit Web fallback for one call');
  t.run('minimizeSession()');t.run(`openWorkoutSession('${W}')`);assert.equal(opens().length,2,'fallback does not persist');
  t.clock.now=input.now+61000;t.run('tickWorkoutClocks()');assert.equal(t.run('popupCalls'),0,'native owns the rest-end alert');assert.equal(workout(t).rest,null,'Web still clears the rest');
  t.event('window','pagehide');t.event('window','pageshow');t.run(`openWorkoutSession('${W}')`);assert.equal(t.run('sessionWorkoutId'),W,'pagehide revokes');
  t.run('minimizeSession()');assert.equal(t.ctx.window.pulsNativeSetTraining(true),true);assert.equal(t.ctx.window.pulsNativeSetTraining(false),true);
  t.run(`openWorkoutSession('${W}')`);assert.equal(t.run('sessionWorkoutId'),W,'false falls back to the Web session');
  t.run(`state.workouts.find(w=>w.id==='${W}').rest={endAt:${input.now+62000},exerciseId:'${BENCH}'};save()`);t.clock.now=input.now+63000;t.run('tickWorkoutClocks()');
  assert.equal(t.run('popupCalls'),1,'without native ownership the Web rest popup returns');
  t=started({store:new Map([['puls-native-owner-pending',sessionId]])});assert.equal(t.ctx.window.pulsNativeSetTraining(true),false,'ownerPending');
  assert.equal(t.messages.some(x=>x.type==='projection'),false);
  console.log('PASS: pulsNativeSetTraining gates, openNative routing, one-call Web fallback, revocation and rest popup ownership');

  // Exercise search with the Web ranking and filters.
  t=started();assert.equal(t.ctx.window.pulsNativeExerciseSearch({requestId:'r1',query:'Seitheben',equipment:'machine',limit:5}),true);
  let found=t.messages.at(-1);assert.equal(found.type,'exerciseSearch');assert.equal(found.requestId,'r1');assert(found.items.length<=5&&found.total>=1);
  const expected=t.run('exerciseEquipmentFilter="machine";var r=exerciseOptions("Seitheben").slice(0,5).map(x=>x.id);exerciseEquipmentFilter="all";r');
  assert.deepEqual(found.items.map(x=>x.id),clone(expected));assert.equal(t.run('exerciseEquipmentFilter'),'all');
  t.ctx.window.pulsNativeExerciseSearch({requestId:'r2',query:'Bench Press'});found=t.messages.at(-1);assert.equal(found.canCreate,false);assert(found.items.some(x=>x.inLibrary));
  t.ctx.window.pulsNativeExerciseSearch({requestId:'r3',query:'Zzz eigene Übung'});assert.equal(t.messages.at(-1).canCreate,true);
  for(const bad of [null,{query:'x'},{requestId:'',query:'x'},{requestId:'r',equipment:'rope'},{requestId:'r',limit:0}])assert.equal(t.ctx.window.pulsNativeExerciseSearch(bad),false);
  // Display labels from the Web translations; keys stay unchanged. Equipment has no Web translation.
  t.ctx.window.pulsNativeExerciseSearch({requestId:'fixture',query:'Seitheben',equipment:'machine',limit:3});
  assert.deepEqual(t.messages.at(-1),fixture('exercise-search'),'shared search fixture (de)');
  for(const item of t.messages.at(-1).items){assert.equal(item.muscleLabels.length,item.muscles.length);assert.equal(item.equipmentLabel,item.equipment)}
  const label=key=>{t.ctx.window.pulsNativeExerciseSearch({requestId:'l',query:'Machine Lateral Raise',limit:1});return t.messages.at(-1).items[0]};
  assert.deepEqual(label().muscleLabels,[t.run('muscleNames.shoulders')]);assert.equal(t.messages.at(-1).language,'de');
  t.run('state.language="en"');assert.deepEqual(label().muscleLabels,[t.run('englishUI[muscleNames.shoulders]')]);assert.equal(label().muscleLabels[0],'Shoulders');
  assert.equal(t.messages.at(-1).language,'en');assert.deepEqual(label().muscles,['shoulders'],'keys unchanged');
  t.run('state.language="de"');t.ctx.window.pulsNativeExerciseSearch({requestId:'tib',query:'Tibialis Raise Machine',limit:1});
  assert.deepEqual(t.messages.at(-1).items[0].muscleLabels,t.messages.at(-1).items[0].muscles,'no Web translation: key as in the Web picker');
  console.log('PASS: exercise search mirrors Web ranking/filter/own-exercise hint without changing the picker state');

  // Review J/P2: native side effects (rest notification, Live Activity) leave an op only once, from the final state.
  const delivered=(test,from)=>test.native.slice(from).map(x=>x.type);
  t=started();ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt:input.now+60000}})),'seed delivered rest');
  let mark=t.native.length;
  ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:true,expect:{kg:80,reps:7,done:false}})),'open superset round');
  assert.deepEqual(delivered(t,mark),['restCancel'],'no intermediate restStart before the superset cancel');assert.equal(workout(t).rest,null);
  t.run('render();save()');assert.deepEqual(delivered(t,mark),['restCancel']);
  // Rolled-back op with workoutTimer: neither the intermediate workoutActive nor the bridge correction reaches Native.
  t=started({features:['stateBridge','nativeTraining','workoutTimer']});ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt:input.now+60000}})),'seed');
  const seeded=t.native.at(-1);assert.equal(seeded.type,'restStart');mark=t.native.length;
  t.options.failWrite=key=>key==='puls-native-applied';code(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt:input.now+90000}})),'persist_failed','skip fails');
  delete t.options.failWrite;assert.equal(workout(t).rest.endAt,input.now+90000);assert.deepEqual(delivered(t,mark),[],'no orphaned workoutActive');
  t.run('render();save()');t.event('document','visibilitychange');assert.deepEqual(delivered(t,mark),[],'bridge correction to the old state is dropped');
  ok(t.apply(cmd('rest.skip',{workoutId:W,expect:{endAt:input.now+90000}})),'skip succeeds');
  assert.deepEqual(t.native.slice(mark).map(x=>[x.type,x.cancelRest]),[['workoutActive',true]],'one workoutActive from the final state');
  // Failed finish: no restCancel followed by a new restStart.
  t=started();ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt:input.now+60000}})),'seed');mark=t.native.length;
  t.options.failWrite=key=>key==='puls-v1';code(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'persist_failed','finish fails');
  delete t.options.failWrite;t.run('render();save()');assert.deepEqual(delivered(t,mark),[],'Live Activity untouched by the failed finish');
  ok(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'finish');assert.deepEqual(delivered(t,mark),['restCancel']);
  // Rollback must not rely on a working render: the later bridge correction is still recognised as the old state.
  t=started({profile:solo});ok(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt:input.now+60000}})),'seed');mark=t.native.length;
  t.run('var breakRender=false;const keepRender=render;render=function(){if(breakRender)throw Error("render down");return keepRender.apply(this,arguments)}');
  t.run('breakRender=true');code(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,done:true,expect:{kg:80,reps:7,done:false}})),'invalid','render down');
  t.run('breakRender=false');assert.deepEqual(exercise(t,BENCH).sets[1],{kg:80,reps:7,done:false});assert.equal(workout(t).rest.endAt,input.now+90000);
  t.event('document','visibilitychange');t.run('render()');assert.deepEqual(delivered(t,mark),[],'nothing of the rolled-back rest reaches Native');
  // Review J/P2: an expired rest that the Web tick has not cleared yet is gone, never revived by ±30 s.
  t=started();t.clock.now=input.now+60001;const restBefore=clone(workout(t).rest);
  code(t.apply(cmd('rest.adjust',{workoutId:W,seconds:30,expect:{endAt:input.now+60000}})),'gone','expired rest');
  assert.deepEqual(workout(t).rest,restBefore);code(t.apply(cmd('rest.adjust',{workoutId:W,seconds:-30,expect:{endAt:input.now+60000}})),'gone','expired rest −30');
  // Review J/P3: a failed finish restores the completion review flag and the celebration state of the finish chain.
  t=started();t.run('completionReview=true;finishAudio={xp:true,streak:true};xpCelebrationPending={id:"older",levelup:false}');
  t.options.failWrite=key=>key==='puls-v1';code(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'persist_failed','finish fails');delete t.options.failWrite;
  assert.deepEqual(clone(t.run('[completionReview,finishAudio,xpCelebrationPending]')),[true,{xp:true,streak:true},{id:'older',levelup:false}]);
  assert.equal(t.run('completionId'),null);
  ok(t.apply(cmd('workout.finish',{workoutId:W,confirmUnfinished:true})),'finish');assert.equal(t.run('completionReview'),false,'a fresh finish is no review');
  // Review J/P3b: a new rest with the same end time and label (A 120 s, after 60 s B 60 s, same name) is a new restStart.
  const twin=clone(input.profile),A='e0000000-0000-4000-8000-0000000000a1',B='e0000000-0000-4000-8000-0000000000b1';
  twin.workouts[1].rest=null;twin.workouts[1].exercises=[A,B].map((id,i)=>({id,exerciseId:'x0000000-0000-4000-8000-000000000001',name:'Bench Press',restSeconds:i?60:120,
    sets:[{kg:80,reps:8,done:false},{kg:80,reps:8,done:false}]}));
  for(const viaOp of [true,false]){
    t=started({profile:twin});const t0=input.now,doneSet=id=>viaOp?ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:id,setIndex:0,done:true,expect:{kg:80,reps:8,done:false}})),'done '+id):t.run(`setValue('${W}','${id}',0,'done',true)`);
    doneSet(A);let rest=t.native.filter(x=>x.type==='restStart').at(-1);assert.deepEqual([rest.endsAt,rest.startsAt],[t0+120000,t0]);
    t.clock.now=t0+60000;mark=t.native.length;doneSet(B);
    assert.deepEqual(workout(t).rest,{endAt:t0+120000,exerciseId:B});
    const starts=t.native.slice(mark).filter(x=>x.type==='restStart');
    assert.equal(starts.length,1,'rest switch reaches Native '+(viaOp?'(op)':'(Web)'));assert.deepEqual([starts[0].endsAt,starts[0].startsAt],[t0+120000,t0+60000],'new time base');
    assert.deepEqual((({startsAt,...x})=>x)(starts[0]),(({startsAt,...x})=>x)(rest),'identical end time and label');
    t.run('render();save()');assert.equal(t.native.slice(mark).filter(x=>x.type==='restStart').length,1,'no repeat afterwards');
  }
  console.log('PASS: review J: buffered native side effects (superset, rolled-back workoutActive/finish, failing render), no revived rest, restored finish UI state');

  // Shared op fixtures decode and apply.
  t=started();
  for(const name of ['apply-training-set-update','apply-training-start']){
    const f=fixture(name);assert.equal(f.userId,sessionId);
    if(name==='apply-training-start'){t.run('state.workouts=state.workouts.filter(w=>w.finished);save()');const ack=ok(t.apply(f),name);
      assert.deepEqual(Object.keys(ack).sort(),Object.keys(fixture('ack-training-start')).sort());assert.equal(ack.result.started,true)}
    else ok(t.apply(f),name);
  }
  assert(Buffer.byteLength(JSON.stringify(started().training()),'utf8')<150*1024);
  t=started();t.run('for(let i=0;i<900;i++)state.exerciseBook.push({id:"bulk-"+i,name:"Übung "+"x".repeat(60)+i,target:0});save()');t.tick(300);
  const big=t.training();assert(JSON.stringify(big.training).length<=48*1024);assert(big.training.omitted.library>0);assert.equal(big.training.active.exercises.length,2,'active session never shortened');
  console.log('PASS: shared training op fixtures and bounded projection budget');
  t=started();t.run('render()');t.tick(300);
  const oldRecent=clone(t.training().training.recent),oldLibrary=clone(t.training().training.library),oldRoutines=clone(t.training().training.routines);
  t.run('var cacheAwardCalls=0,cachePreviousCalls=0;const cacheAwards=workoutAwards,cachePrevious=previousPerformance;workoutAwards=function(...args){cacheAwardCalls++;return cacheAwards(...args)};previousPerformance=function(...args){cachePreviousCalls++;return cachePrevious(...args)}');
  ok(t.apply(cmd('set.update',{workoutId:W,exerciseId:BENCH,setIndex:1,kg:81,expect:{kg:80,reps:7,done:false}})),'cached active edit');
  assert.equal(t.run('cacheAwardCalls'),0);assert.equal(t.run('cachePreviousCalls'),0);
  assert.deepEqual(t.training().training.recent,oldRecent);assert.deepEqual(t.training().training.library,oldLibrary);assert.deepEqual(t.training().training.routines,oldRoutines);
  t.run('state.workouts.find(w=>w.finished).exercises[0].sets[0].kg+=5;save()');t.tick(300);
  assert.equal(t.run('cacheAwardCalls'),1);assert(t.run('cachePreviousCalls')>0,'historical edits refresh previous values');
  assert.notDeepEqual(t.training().training.recent,oldRecent);
  console.log('PASS: granular training caches skip awards/history/library on active edits, invalidate in-place historical changes');
})().catch(error=>{console.error(error);process.exitCode=1});
