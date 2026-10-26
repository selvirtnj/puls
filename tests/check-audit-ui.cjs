const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
// Regression for UI-2/UI-3 (docs/audit/UI-AUDIT.md): live set input stays quiet on invalid intermediates and only batches persisting.
let bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split("run(`state.foods=")[0];
const swap=(from,to)=>{assert(bootstrap.includes(from),'bootstrap changed: '+from);bootstrap=bootstrap.replace(from,to)};
swap('const ctx={document:{getElementById:el,addEventListener(){}','const listeners={},timers=new Map();let timerId=0;const ctx={addEventListener(t,f){(listeners["win:"+t]??=[]).push(f)},document:{getElementById:el,addEventListener(t,f){(listeners[t]??=[]).push(f)}');
swap('setTimeout:()=>1,clearTimeout(){}','setTimeout:(f)=>{timers.set(++timerId,f);return timerId},clearTimeout:(id)=>{timers.delete(id)}');
swap('setItem:(k,v)=>storage=v','setItem:(k,v)=>{storage=v;ctx.saves=(ctx.saves||0)+1}');
const test=vm.runInNewContext('(function(require){'+bootstrap+'return {run,ctx,listeners,timers,saved:()=>storage};})(require)',{require,console},{filename:'audit-ui-vm.cjs'});
const {run,ctx,listeners,timers,saved}=test;
run(`toast=function(){toastCount=(globalThis.toastCount||0)+1};render=function(){renderCount=(globalThis.renderCount||0)+1};
state.workouts=[{id:'w1',date:today(),name:'Test',exercises:[{id:'e1',exerciseId:'x1',name:'Bank',sets:[{kg:'',reps:'',done:false}]}]}];
toastCount=0;renderCount=0;`);
const set=()=>JSON.parse(run('JSON.stringify(state.workouts[0].exercises[0].sets[0])'));
const pendingSave=()=>[...timers.entries()].filter(([,f])=>f===run('flushPendingSave'));
const fire=id=>{let f=timers.get(id);timers.delete(id);f()};
ctx.saves=0;
// UI-2: invalid intermediate values while typing: no toast, no re-render, value kept.
for(let [key,value] of [['reps','0'],['kg','.'],['kg','-'],['reps','1.5']])run(`setLiveValue('w1','e1',0,'${key}','${value}')`);
assert.equal(run('toastCount'),0);assert.equal(run('renderCount'),0);assert.deepEqual(set(),{kg:'',reps:'',done:false});assert.equal(ctx.saves,0);
// The final change event still validates and reports.
run(`setValue('w1','e1',0,'reps','0')`);assert.equal(run('toastCount'),1);assert.equal(run('renderCount'),1);assert.equal(set().reps,'');
// UI-3: valid keystrokes update state immediately but persist once after the debounce.
run('toastCount=0;renderCount=0');ctx.saves=0;
for(let value of ['1','12','12'])run(`setLiveValue('w1','e1',0,'reps','${value}')`);
for(let value of ['6','62','62.5'])run(`setLiveValue('w1','e1',0,'kg','${value}')`);
assert.deepEqual(set(),{kg:62.5,reps:12,done:false});assert.equal(ctx.saves,0);assert.equal(pendingSave().length,1);assert.equal(run('toastCount'),0);
fire(pendingSave()[0][0]);assert.equal(ctx.saves,1);assert.deepEqual(JSON.parse(saved()).workouts[0].exercises[0].sets[0],{kg:62.5,reps:12,done:false});
// Leaving the page flushes a pending save immediately; nothing is lost.
run(`setLiveValue('w1','e1',0,'reps','10')`);assert.equal(ctx.saves,1);ctx.document.visibilityState='hidden';for(let f of listeners.visibilitychange||[])f();assert.equal(ctx.saves,2);assert.equal(pendingSave().length,0);
run(`setLiveValue('w1','e1',0,'reps','11')`);for(let f of listeners['win:pagehide']||[])f();assert.equal(ctx.saves,3);assert.equal(pendingSave().length,0);
// Change and done save at once and cancel the pending debounce.
run(`setLiveValue('w1','e1',0,'reps','12')`);run(`setValue('w1','e1',0,'reps','12')`);assert.equal(ctx.saves,4);assert.equal(pendingSave().length,0);
run(`setValue('w1','e1',0,'done',true)`);assert(ctx.saves>=5);assert.equal(pendingSave().length,0);assert.equal(set().done,true);
// Clearing a field while typing still unchecks the set (existing rule), persisted after the debounce.
run(`setLiveValue('w1','e1',0,'reps','')`);assert.equal(set().done,false);assert.equal(pendingSave().length,1);
// The rendered live set fields use the quiet input path plus a validating change handler.
let polish=fs.readFileSync('js/workout-polish.js','utf8');
for(let key of ['kg','reps']){assert(polish.includes(`oninput="setLiveValue('\${w.id}','\${e.id}',\${i},'${key}',this.value)" onchange="setValue('\${w.id}','\${e.id}',\${i},'${key}',this.value)"`),'live set field '+key)}
console.log('PASS: audit UI-2/UI-3 quiet live set input, debounced persisting, flush on leave');
