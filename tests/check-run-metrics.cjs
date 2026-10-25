const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Synthetic fixtures only; same wrapper stubs as check-running.cjs. Both files
// share a VM lexical scope, matching classic script loading in index.html.
const state={workouts:[],weights:[]};
const c={state,today:()=>'2026-10-25',localISO:()=>'',weekStart:()=>'',
  appLocale:()=>'de-DE',formatClock:String,esc:String,n:String,uid:()=>'new',
  completedWorkouts:()=>[],loggedSets:()=>[],workoutAwards:()=>({}),
  dailyWorkoutStreak:()=>0,trainingStreak:()=>0,validData:()=>true,
  workoutPage:()=>'',trainingCalendar:()=>'',analyticsPage:()=>'',quickTraining:()=>'',
  render(){},save(){},setInterval(){},window:{},navigator:{},
  appStore:{getItem:()=>null,setItem(){}},document:{addEventListener(){},querySelectorAll:()=>[]},
  quickActionPaths:{},quickAddActions:[['workout']],englishUI:{},Intl,Date,Math,Number,String,Object,Array,Set};
vm.createContext(c);
for(const file of ['js/running.js','js/run-metrics.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
const plain=x=>JSON.parse(JSON.stringify(x));
const activities=vm.runInContext('RUN_ACTIVITIES',c);
assert.equal(new Set(activities.map(a=>a.id)).size,activities.length);
for(const id of ['run','trail','walk','hike','mountain','ride','tabletennis','other'])assert.ok(activities.some(a=>a.id===id));
for(const a of activities){
  assert.match(a.id,/^[a-z]+$/);assert.ok(a.de&&a.en&&a.icon);
  assert.equal(typeof a.gps,'boolean');assert.ok(['run','walk','ride','other'].includes(a.category));
  assert.ok(Number.isFinite(a.met)&&a.met>0);assert.equal(c.runActivityType(a.id),a);
  assert.ok(Object.isFrozen(a));
}
assert.equal(c.runActivityType('unknown').id,'run');assert.equal(c.runActivityType(null).id,'run');
console.log('PASS: activity catalogue, required types, valid MET/labels/icons, immutable entries and fallback.');

const kcal=opts=>c.runCaloriesEstimate({type:'run',movingSeconds:3000,distanceKm:10,weightKg:70,...opts});
const run=kcal({});assert.ok(run>=650&&run<=800,`10 km / 50 min / 70 kg: ${run}`);
assert.equal(kcal({type:'trail'}),run);
assert.ok(kcal({distanceKm:20})>=run,'faster running cannot fall back to low general-jogging MET');
const pingpong=kcal({type:'tabletennis',movingSeconds:3600});assert.equal(pingpong,280);
for(const weightKg of [undefined,null,0,29,301,'70',NaN,Infinity])assert.equal(kcal({weightKg}),null);
for(const movingSeconds of [undefined,null,0,-1,NaN,Infinity,'3000'])assert.equal(kcal({movingSeconds}),null);
assert.equal(c.runCaloriesEstimate(),null);assert.equal(kcal({type:'other'}),null);
assert.equal(kcal({type:'run',distanceKm:null}),438,'missing distance uses general jogging, never coerces null');
assert.equal(kcal({type:'tabletennis',distanceKm:100,ascentM:1000}),233,'non-GPS activity ignores distance/ascent');
const walk=opts=>kcal({type:'walk',movingSeconds:3600,distanceKm:5,...opts});
assert.ok(walk({distanceKm:6})>walk({distanceKm:3}));
assert.ok(walk({ascentM:400})>walk({ascentM:0}));
assert.equal(walk({ascentM:-100}),walk({ascentM:0}));
assert.equal(walk({ascentM:Infinity}),walk({ascentM:0}));
assert.equal(walk({ascentM:5000}),walk({ascentM:0}),'unsupported grade uses level baseline');
for(const type of ['hike','mountain','ride','soccer','inline'])assert.ok(kcal({type})>0);
console.log(`PASS: calorie estimates (${run} kcal run, ${pingpong} kcal table tennis), invalid inputs, speed/uphill and unknown activity.`);

const weights=[{date:'2026-10-23',kg:72},{date:'2026-10-20',kg:74},{date:'2026-11-01',kg:70},{date:'2026-10-23',kg:71.5}];
assert.equal(c.runLatestWeight({weights},'2026-10-24'),71.5);
assert.equal(c.runLatestWeight({weights},'2026-10-20'),74);
assert.equal(c.runLatestWeight({weights},'2026-10-19'),null);
assert.equal(c.runLatestWeight({},'2026-10-24'),null);
assert.equal(c.runLatestWeight({weights},null),null);
assert.equal(c.runLatestWeight({weights:[{date:'2026-10-23',kg:null}]},'2026-10-24'),null);
assert.equal(c.runLatestWeight({weights:[{date:'2026-10-23',kg:350}]},'2026-10-24'),350,'recorded weight preserved; calorie function enforces its own range');
console.log('PASS: latest historical weight, unsorted/duplicate days, missing/future/invalid measurements.');

// 5 m per 2 s: accepted by existing distance filters, with altitude independent
// of horizontal coordinates. Keep every synthetic point well above the 4 m gate.
const point=(i,alt=100,seg=0,altAcc=5)=>[i*2000,52.5+i*5/111195,13.4,5,seg,alt,altAcc];
const climb=Array.from({length:101},(_,i)=>point(i,100+i*.5+[0,1,-1,1,-1][i%5]));
const snapshot=JSON.stringify(climb),elev=c.runElevation(climb);
assert.ok(elev.gain>=45&&elev.gain<=55,JSON.stringify(elev));assert.ok(elev.loss<=3);
assert.ok(elev.min>=99&&elev.min<=103);assert.ok(elev.max>=147&&elev.max<=152);
const downhill=climb.map(p=>[...p.slice(0,5),250-p[5],p[6]]);
assert.ok(c.runElevation(downhill).loss>=45&&c.runElevation(downhill).loss<=55);
const flat=Array.from({length:101},(_,i)=>point(i,100+[0,1,-1,1,-1][i%5]));
assert.equal(c.runElevation(flat).gain,0);assert.equal(c.runElevation(flat).loss,0);
for(const pts of [[],climb.slice(0,4),climb.map(p=>p.slice(0,5)),climb.map(p=>[...p.slice(0,5),null,null]),
  climb.map(p=>[...p.slice(0,5),0,-1]),climb.map(p=>[...p.slice(0,6),21])])assert.equal(c.runElevation(pts),null);
assert.ok(c.runElevation(climb.map(p=>p.slice(0,6))).gain>=45,'altitude without accuracy supported');
assert.ok(c.runElevation(climb.map(p=>[...p.slice(0,6),null])).gain>=45);
const stepped=[...Array.from({length:10},(_,i)=>point(i,100,0)),...Array.from({length:10},(_,i)=>point(i+100,300,1))];
assert.deepEqual(plain(c.runElevation(stepped)),{gain:0,loss:0,min:100,max:300});
const gap=stepped.map((p,i)=>[...p.slice(0,4),0,i===10?null:p[5],p[6]]);
assert.equal(c.runElevation(gap).gain,0,'missing elevation breaks continuity');
const badHeight=flat.map(p=>p.slice());badHeight[50][3]=80;badHeight[50][5]=10000;
assert.equal(c.runElevation(badHeight).gain,0,'rejected GPS fix cannot contribute height');
assert.equal(JSON.stringify(climb),snapshot,'metrics never mutate raw points');
console.log('PASS: smoothed noisy +/-50 m, hysteresis, missing/legacy/native-unknown heights, accuracy, segment and gap boundaries.');

assert.equal(c.runMaxSpeed(climb),9);
assert.equal(c.runMaxSpeed([]),null);assert.equal(c.runMaxSpeed(climb.slice(0,5)),null);
assert.equal(c.runMaxSpeed([point(0),point(20)]),null,'at least three fixes required');
const spike=climb.map(p=>p.slice());spike[40][1]+=.1;
assert.equal(c.runMaxSpeed(spike),9,'impossible single GPS spike filtered');
// A short but horizontally plausible spike is averaged across the 20 s window.
const shortSpike=climb.map(p=>p.slice());shortSpike[40][1]+=10/111195;
assert.ok(c.runMaxSpeed(shortSpike)<12,'no single-interval 27 km/h maximum');
assert.equal(c.runMaxSpeed(stepped),null,'short segments cannot combine across pause');
const longSegments=[...climb.slice(0,30),...climb.slice(0,30).map(p=>[p[0]+600000,p[1]+.1,p[2],p[3],1])];
assert.equal(c.runMaxSpeed(longSegments),9);
const stats=c.runMovingStats(longSegments);
assert.equal(stats.movingSeconds,116);assert.ok(Math.abs(stats.distanceKm-.29)<.001);
assert.equal(c.runMovingStats([]).movingSeconds,0);
assert.deepEqual(plain(c.runMovingStats([])),{movingSeconds:0,distanceKm:0});
assert.ok(Math.abs(c.runMovingStats(climb).distanceKm-c.runTrackKm(climb))<1e-12);
console.log('PASS: sustained max speed, single-spike suppression, minimum duration/fixes, pause boundaries and segment-time distance.');
