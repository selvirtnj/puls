// Explicit local benchmark, not a timing assertion in CI. Synthetic valid profile; no browser/storage/network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('tests/check-native-progress.cjs','utf8').split('const start=o=>')[0];
const app=vm.runInNewContext('(function(require){'+source+';return app})(require)',{require,console});
const input=JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/progress-input.json','utf8')),clone=x=>JSON.parse(JSON.stringify(x));
const n=Number(process.argv[2])||300,p=clone(input.profile),base=p.workouts.find(w=>w.finished),active=clone(p.workouts.find(w=>!w.finished));
const day=i=>new Date(Date.UTC(2026,9,28)-i*86400000).toISOString().slice(0,10);
p.workouts=Array.from({length:n},(_,i)=>({...clone(base),id:'perf-w-'+i,date:day(Math.floor(i*1.2)),
  exercises:Array.from({length:6},(_,j)=>({...clone(base.exercises[0]),id:'perf-e-'+i+'-'+j,exerciseId:p.exerciseBook[j%p.exerciseBook.length].id,
    sets:Array.from({length:4},()=>({kg:60+i%20,reps:8,done:true}))}))}));
p.exerciseBook.push(...Array.from({length:60},(_,j)=>({...clone(p.exerciseBook[0]),id:'perf-b-'+j,name:'Exercise '+j})));
p.foods=Array.from({length:n*5},(_,i)=>({...clone(input.profile.foods[0]),id:'perf-f-'+i,date:day(Math.floor(i/5))}));
p.weights=Array.from({length:n},(_,i)=>({id:'perf-weight-'+i,date:day(i),kg:80}));
p.runs=Array.from({length:Math.floor(n/2)},(_,i)=>({...clone(input.profile.runs[0]),id:'perf-r-'+i,date:day(i*2)}));
active.startedAt=input.now-60000;active.date='2026-10-28';p.workouts.push(active);
const t=app({profile:p,features:['stateBridge','nativeProgress','nativeOverview','nativeTraining']});t.start();assert(t.run('validData(state)'));
const measure=(name,fn)=>{const start=performance.now();fn();const ms=performance.now()-start;console.log(name+': '+ms.toFixed(2)+' ms');return ms};
measure('progress cold (explicit direct build)',()=>t.run('window.pulsNativeProgress.build({revision:1})'));
measure('progress unchanged follow-up',()=>t.run('window.pulsNativeProgress.build({revision:2})'));
measure('overview fresh',()=>t.run('window.pulsNativeBuildOverview({seq:100,revision:100})'));
measure('training unchanged',()=>t.run('window.pulsNativeTraining.build({revision:100})'));
t.ctx.perfNow=()=>performance.now();
t.run('var projectionCost=0,projectionCounts={};for(const [name,obj,key] of [["overview",window,"pulsNativeBuildOverview"],["training",window.pulsNativeTraining,"build"],["progress",window.pulsNativeProgress,"build"]]){const original=obj[key];obj[key]=function(...args){const started=perfNow();try{return original(...args)}finally{projectionCost+=perfNow()-started;projectionCounts[name]=(projectionCounts[name]||0)+1}}}');
for(const interests of [['training'],['overview','training']]){
  t.ctx.window.pulsNativeSetInterest({projections:interests});t.run('projectionCost=0;projectionCounts={}');
  const s=t.state().workouts.find(w=>w.id===active.id).exercises[0].sets[0];
  const ack=t.apply({id:'aa000000-0000-4000-8000-'+String(interests.length).padStart(12,'0'),userId:JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/snapshot.json','utf8')).userId,
    op:'set.update',args:{workoutId:active.id,exerciseId:active.exercises[0].id,setIndex:0,kg:Number(s.kg)+1,expect:{kg:s.kg,reps:s.reps,done:s.done}}});
  assert(ack.ok,JSON.stringify(ack));t.tick(1200);
  console.log('set.update projection cost ['+interests+']: '+t.run('projectionCost').toFixed(2)+' ms '+t.run('JSON.stringify(projectionCounts)'));
  assert.equal(t.run('projectionCounts.training'),1,'the benchmark must actually build the changed session');
  assert(!t.run('projectionCounts.progress'),'inactive progress must not build');
}
