// M5 package L. Real Web providers in the existing training VM harness; synthetic fixtures only.
const fs=require('node:fs'),vm=require('node:vm'),assert=Object.assign((value,message)=>require('node:assert/strict')(value,message),require('node:assert/strict'),{deepEqual:(a,b,message)=>require('node:assert/strict').deepStrictEqual(clone(a),clone(b),message)});
const clone=x=>JSON.parse(JSON.stringify(x)),fixture=n=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+n+'.json','utf8'));
const input=fixture('progress-input'),uid=fixture('snapshot').userId;
// Reuse the established harness/last-effective Web chains without running M4's test cases.
const harness=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("run('var englishUI={}')","run(fs.readFileSync('js/i18n.js','utf8'))")
  .replace("input=fixture('training-input')","input=fixture('progress-input')")
  .replace("'running','run-metrics'];","'running','run-metrics','run-session','activity-overview'];")
  .replace("['native-state','native-projection','native-training']","['native-state','native-projection','native-training','native-progress']")
  .replace("['stateBridge','nativeTraining']","['stateBridge','nativeProgress']");
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const start=o=>{const t=app(o);t.start();t.progress=()=>t.messages.filter(m=>m.type==='projection'&&m.name==='progress').at(-1);return t};
let serial=0;
const cmd=(op,args)=>({id:'d0000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),userId:uid,baseSeq:0,op,args});
const ok=(a)=>assert.equal(a.ok,true,JSON.stringify(a)),code=(a,c)=>{assert.equal(a.ok,false);assert.equal(a.error.code,c)};
const query=(t,kind,args={})=>{assert.equal(t.ctx.window.pulsNativeProgressQuery({requestId:'q',kind,...args}),true);return t.messages.filter(m=>m.type==='progressResult').at(-1)};
const compareFixture=(name,value)=>{if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/'+name+'.json',JSON.stringify(value,null,2)+'\n');assert.deepEqual(value,fixture(name))};

(async()=>{
  for(const options of [{handler:false},{features:['stateBridge']},{features:['nativeProgress']},{features:['stateBridge','nativeTraining','nativeOverview']}]){
    const t=start(options);assert.equal(t.ctx.window.pulsNativeProgress,undefined);assert.equal(t.ctx.window.pulsNativeProgressQuery,undefined);
    assert.equal(t.progress(),undefined);if(t.ctx.window.pulsNativeApply)code(t.apply(cmd('progress.goal.set',{})),'unknown_op');
    if(options.features?.length===1&&options.features[0]==='stateBridge')assert.deepEqual(t.messages.find(m=>m.type==='hello'),{...fixture('hello'),webVersion:fs.readFileSync('index.html','utf8').match(/js\/native-state\.js\?v=(\d+)/)[1]});
  }
  let t=start(),p=t.progress();assert(p,'progress projection sent');
  compareFixture('progress-projection',p);
  assert.equal(t.run('validData(state)'),true);assert.deepEqual(t.state(),input.profile,'read providers preserve old/unknown profile fields');
  assert.deepEqual(t.messages.find(m=>m.type==='hello').ops,['weight.upsert','weight.delete','progress.view.set','progress.chart.set','progress.goal.set']);
  assert.deepEqual(t.messages.find(m=>m.type==='hello').screens,['body','calendar','progress']);
  assert.deepEqual(p.progress.identity,clone(t.run('({...xpProgress(totalWorkoutXP()),streak:dailyWorkoutStreak(),weekStreak:trainingStreak()})')));
  assert.equal(p.progress.stats.volume,t.run('Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(workoutStats(completedWorkouts()).volume))'));
  assert.equal(p.progress.metrics.latest,t.run('Number(new Intl.NumberFormat("en-US",{useGrouping:false,maximumFractionDigits:1}).format(round(filteredMetricPoints(buildProgressMetrics().definitions.find(x=>x.key==="strength"),"all").at(-1).value)))'));
  assert.deepEqual(p.progress.recap.muscles,clone(t.run('muscleCounts(completedWorkouts().filter(w=>w.date>=recapRange().start&&w.date<=recapRange().end)).map(([key,sets])=>({key,sets}))')).map(x=>({...x,label:p.progress.recap.muscles.find(m=>m.key===x.key).label})));
  assert.equal(p.progress.weeklyGoals.activeMinutes,t.run('Math.floor(activeMinutesWeek())'));
  assert.equal(p.progress.runRecords[0].seconds,t.run('runBestEfforts()[1].seconds'));
  assert(p.progress.activity.summary.unknownKcalCount>0,'unknown kcal remain explicit');
  const month=query(t,'month',{month:'2026-10'});compareFixture('progress-result-month',month);
  assert.equal(month.result.days.length,31);assert.equal(month.result.total,input.profile.workouts.filter(w=>w.finished).length+input.profile.runs.length);
  const wid=input.profile.workouts.find(w=>w.finished).id,bid=input.profile.exerciseBook[0].id,rid=input.profile.runs[0].id;
  compareFixture('progress-result-workout',query(t,'workout',{id:wid}));
  compareFixture('progress-result-exercise',query(t,'exercise',{id:bid}));
  compareFixture('progress-result-run',query(t,'run',{id:rid}));
  const unknown=query(t,'run',{id:input.profile.runs[1].id});assert.equal(unknown.result.kcal,null);assert.equal(unknown.result.paceText,'–');
  const selectedWeek=query(t,'month',{month:'2026-10',day:'2026-10-26'}).result.recaps.week;
  assert.equal(selectedWeek.start,'2026-10-26');assert.equal(selectedWeek.end,'2026-11-01');
  const activityWeek=query(t,'month',{month:'2026-10',day:'2026-10-26',activityMode:'week',activityFilter:'run'}).result.activityView;
  assert.equal(activityWeek.summary.count,1);assert.equal(activityWeek.start,'2026-10-26');assert.equal(activityWeek.filter,'run');
  assert.equal(activityWeek.summary.kcal,input.profile.runs[0].kcal);assert.equal(activityWeek.entries.length,1);
  assert.equal(query(t,'month',{month:'2024-02'}).result.days.length,29);
  assert.equal(query(t,'month',{month:'2026-02'}).result.days.length,28);
  assert.equal(query(t,'month',{month:'2026-12',day:'2026-12-31'}).result.recaps.week.end,'2027-01-03');
  const old=clone(input.profile);delete old.runs;delete old.runSettings;
  const legacy=start({profile:old});assert.deepEqual(legacy.state(),old);query(legacy,'month',{month:'2026-10'});assert.deepEqual(legacy.state(),old,'legacy optional runs remain absent after read-only providers');
  const english=start({profile:{...clone(input.profile),language:'en'}}),en=english.progress().progress;
  assert.equal(en.metrics.groups.find(g=>g.key==='food').label,'Nutrition');
  assert.equal(en.records[0].suggestion,english.run('translatedUI(progression(state.exerciseBook[0]))'));
  assert.equal(en.recaps[1].muscles.find(m=>m.key==='chest').label,'Chest');
  assert.equal(query(t,'workout',{id:'absent'}).error.code,'gone');
  const before=t.messages.length;
  for(const q of [null,{},[],{requestId:'x',kind:'month',month:'2026-13'},{requestId:'x',kind:'month',month:'2026-02',code:'evil()'},
    {requestId:'x',kind:'eval',id:wid},{requestId:'x',kind:'month',month:'2026-10',day:'2026-11-01'},
    {requestId:'x',kind:'workout',id:'x'.repeat(257)},{requestId:' '.repeat(2),kind:'month',month:'2026-10'}])
    assert.equal(t.ctx.window.pulsNativeProgressQuery(q),false);
  assert.equal(t.messages.length,before,'invalid query never posts');
  console.log('PASS: feature isolation, shared projection/results, Web values, read-only data, unknowns, validated queries');

  // Existing save invalidation; no heavy provider work during ordinary render/tab/date/forced hello.
  t.run('render()');t.tick(300);
  t.run('var builds=0,metricsBuilds=0;const oldBuild=window.pulsNativeProgress.build;window.pulsNativeProgress.build=function(...a){builds++;return oldBuild(...a)};const oldMetrics=buildProgressMetrics;buildProgressMetrics=function(...a){metricsBuilds++;return oldMetrics(...a)}');
  for(let i=0;i<5;i++){t.run('render();go("food");setDate("2026-10-25")');t.tick(300)}
  assert.equal(t.run('builds'),0);assert.equal(t.run('metricsBuilds'),0);
  query(t,'month',{month:'2026-09'});query(t,'month',{month:'2026-10'});assert.equal(t.run('metricsBuilds'),0);
  t.event('window','pagehide');t.event('window','pageshow',{persisted:true});t.tick(300);assert.equal(t.run('builds'),0);
  t.run('save();save()');t.tick(300);assert.equal(t.run('builds'),1);assert.equal(t.run('metricsBuilds'),1);
  // Native refuses requests during ownership ambiguity/load; no old user's result leaks.
  const waiting=app({deferLoad:true});waiting.start();assert.equal(waiting.ctx.window.pulsNativeProgressQuery({requestId:'x',kind:'month',month:'2026-10'}),false);
  t.run('cloudSession={user:{id:"other"}};cloudStatusChanged()');t.tick(300);
  assert.equal(t.ctx.window.pulsNativeProgressQuery({requestId:'x',kind:'month',month:'2026-10'}),false);
  assert.equal(t.messages.filter(m=>m.type==='hello').at(-1).ownerPending,true);
  const both=start({features:['stateBridge','nativeTraining','nativeProgress','nativeOverview']});
  const projections=both.messages.filter(m=>m.type==='projection');assert.deepEqual(projections.map(m=>m.name),['overview','training','progress']);
  assert.deepEqual(projections.map(m=>m.projectionSeq),[1,2,3]);
  console.log('PASS: cached providers, cheap renders and queries, save invalidation, bfcache, owner readiness');

  t=start();let a=cmd('progress.view.set',{key:'range',value:'year',expect:input.profile.progressView});ok(t.apply(a));
  const stored=t.store.get('puls-v1');ok(t.apply(a));assert.equal(t.store.get('puls-v1'),stored);
  t.store.delete('puls-native-applied');ok(t.apply({...a,id:cmd('',{}).id}));
  code(t.apply(cmd('progress.view.set',{key:'range',value:'week',expect:input.profile.progressView})),'conflict');
  code(t.apply(cmd('progress.view.set',{key:'range',value:'bogus',expect:t.state().progressView})),'invalid');
  ok(t.apply(cmd('progress.view.set',{key:'group',value:'muscles',expect:t.state().progressView})));assert(!('metric' in t.state().progressView));
  code(t.apply(cmd('progress.view.set',{key:'metric',value:'evil()',expect:t.state().progressView})),'invalid');
  let settings=t.state();a=cmd('progress.chart.set',{period:'week',lines:{weight:false,strength:true,kcal:false},expect:{period:settings.chartPeriod??null,lines:settings.chartLines??null}});
  ok(t.apply(a));assert.equal(t.state().chartPeriod,'week');assert.deepEqual(t.state().chartLines,{weight:false,strength:true,kcal:false});
  t.store.delete('puls-native-applied');ok(t.apply({...a,id:cmd('',{}).id}));
  code(t.apply(cmd('progress.chart.set',{period:'all',expect:a.args.expect})),'conflict');
  code(t.apply(cmd('progress.chart.set',{lines:{evil:true},expect:{period:'week',lines:t.state().chartLines}})),'invalid');
  a=cmd('progress.goal.set',{weeklyGoalKm:25.15,weekMinutesGoal:180,expect:{weeklyGoalKm:20,weekMinutesGoal:150}});ok(t.apply(a));
  assert.equal(t.state().runSettings.weeklyGoalKm,25.2);assert.equal(t.state().runSettings.weekMinutesGoal,180);assert.deepEqual(t.state().runSettings.xFutureSetting,{keep:true});
  t.store.delete('puls-native-applied');ok(t.apply({...a,id:cmd('',{}).id}));
  code(t.apply(cmd('progress.goal.set',{weeklyGoalKm:null,weekMinutesGoal:0,expect:a.args.expect})),'conflict');
  ok(t.apply(cmd('progress.goal.set',{weeklyGoalKm:null,weekMinutesGoal:0,expect:{weeklyGoalKm:25.2,weekMinutesGoal:180}})));
  for(const extra of [{weeklyGoalKm:0},{weeklyGoalKm:1001},{weekMinutesGoal:1.5},{weekMinutesGoal:10081}])
    code(t.apply(cmd('progress.goal.set',{weeklyGoalKm:20,weekMinutesGoal:150,expect:{weeklyGoalKm:null,weekMinutesGoal:0},...extra})),'invalid');
  assert.equal(t.run('validData(state)'),true);
  assert.deepEqual(t.snapshots().at(-1).state,JSON.parse(t.store.get('puls-v1')));
  for(const name of ['view','chart','goal']){const example=start(),ack=example.apply(fixture('apply-progress-'+name));ok(ack);if(name==='goal')compareFixture('ack-progress-goal',ack)}
  console.log('PASS: view/chart/weekly-goal ops, Web setters, replay with/without history, conflict, validation, persistence');

  for(const op of [cmd('progress.view.set',{key:'range',value:'year',expect:input.profile.progressView}),
    cmd('progress.chart.set',{period:'week',expect:{period:input.profile.chartPeriod??null,lines:input.profile.chartLines??null}}),
    cmd('progress.goal.set',{weeklyGoalKm:10,weekMinutesGoal:90,expect:{weeklyGoalKm:20,weekMinutesGoal:150}})]){
    let failWrite=true;const failed=start({failWrite:k=>failWrite&&k==='puls-native-applied'}),before=failed.state(),raw=failed.store.get('puls-v1');
    code(failed.apply(op),'persist_failed');assert.deepEqual(failed.state(),before);assert.equal(failed.store.get('puls-v1'),raw);assert.equal(failed.run('modal.open'),false);
    failWrite=false;ok(failed.apply(op));
    const preview=start({preview:true});code(preview.apply(op),'readonly');assert.equal(preview.writes.includes('puls-v1'),false);
    const recovery=start();recovery.run('stateRecoveryPending=true');code(recovery.apply(op),'readonly');
    const blocked=start();blocked.run('cloudUploadBlocked=true');code(blocked.apply(op),'readonly');
    const wrong=start();code(wrong.apply({...op,userId:'other'}),'wrong_user');
    const busy=start();busy.run('modal.open=true');code(busy.apply(op),'busy');
    const session=start();session.run('sessionWorkoutId='+JSON.stringify(input.profile.workouts[1].id));code(session.apply(op),'busy');
  }
  console.log('PASS: rollback after history failure, preview/recovery/upload lock, wrong user, unrelated Web dialog');

  t=start();t.run('var called=[];reviewWorkout=function(id){called.push(["review",id])};runEditForm=function(id){called.push(["editRun",id])};performanceHistory=function(id){called.push(["history",id])}');
  for(const [action,id] of [['reviewWorkout',wid],['shareWorkout',wid],['editRun',rid],['exerciseHistory',bid]])assert.equal(t.ctx.window.pulsNativeNavigate({action,id,web:true}),true);
  assert.deepEqual(clone(t.run('called')),[['review',wid],['review',wid],['editRun',rid],['history',bid]]);
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'editWorkout',id:wid,web:true}),true);assert.equal(t.run('date'),input.profile.workouts.find(w=>w.id===wid).date);
  assert.equal(t.state().workouts.find(w=>w.id===wid).finished,true,'navigation never silently reopens a workout');
  t.run('modal.open=true');assert.equal(t.ctx.window.pulsNativeNavigate({action:'calendar'}),false);t.run('modal.open=false');
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'progress',web:true}),true);assert.equal(t.run('trainTab'),'insights');assert.equal(t.messages.filter(m=>m.type==='navigate').at(-1).web,true);
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'runDetail',id:'missing'}),false);

  const large=clone(input.profile),base=large.workouts.find(w=>w.finished);large.workouts=Array.from({length:450},(_,i)=>({...clone(base),id:'large-'+i,date:'2026-10-'+String(i%27+1).padStart(2,'0'),name:'😀'.repeat(300)}));
  large.exerciseBook.push({id:'long'.repeat(100),name:'legacy',target:0});
  t=start({profile:large});assert(t.progress());assert(JSON.stringify(t.progress().progress).length<=48*1024);
  const m=query(t,'month',{month:'2026-10'});assert(JSON.stringify(m).length<50*1024);assert.equal(m.result.total,452);assert(m.result.omitted>0);
  assert.equal(m.result.days.reduce((n,x)=>n+x.workouts+x.activities,0),452,'unabridged day counts');
  assert(m.result.entries.every(x=>!/\uD800$/.test(x.name)));assert(t.progress().progress.omitted.records>0);
  const longWorkout=clone(input.profile);longWorkout.workouts[0].exercises=Array.from({length:100},(_,i)=>({...clone(base.exercises[0]),id:'exercise-'+i,sets:Array.from({length:200},()=>({kg:80,reps:8,done:true}))}));
  t=start({profile:longWorkout});const detail=query(t,'workout',{id:longWorkout.workouts[0].id});assert(JSON.stringify(detail.result).length<=48*1024);assert(detail.result.exercises.some(e=>e.omitted>0));
  const gap=clone(input.profile);gap.workouts[0].durationSeconds=null;gap.workouts[0].autoFinished=true;
  gap.workouts[0].exercises[0].sets.forEach(s=>s.reps=12);gap.progressView={group:'training',range:'all',metric:'duration'};
  t=start({profile:gap});assert.equal(t.progress().progress.metrics.latest,null);assert.deepEqual(t.progress().progress.metrics.points,[]);
  const history=query(t,'exercise',{id:bid}).result;assert.equal(history.history[0].e1rm,null);assert.deepEqual(history.points,[],'high reps do not invent an e1RM point');
  const future=clone(input.profile);future.runs.push({...clone(future.runs[0]),id:'future',date:'2026-10-31'});
  t=start({profile:future});assert(query(t,'month',{month:'2026-10'}).result.entries.some(x=>x.id==='future'),'Web calendar keeps future imports');
  assert.equal(t.progress().progress.running.count,input.profile.runs.filter(r=>r.type==='run').length,'progress excludes future imports');
  console.log('PASS: Web navigation and chrome guard, bounded histories/queries, accurate omitted counts and day totals');
})().catch(error=>{console.error(error);process.exitCode=1});
