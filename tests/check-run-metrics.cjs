const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Synthetic fixtures only; same wrapper stubs as check-running.cjs. Both files
// share a VM lexical scope, matching classic script loading in index.html.
const state={workouts:[],weights:[]};
const localISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const c={state,today:()=>'2026-10-25',localISO,weekStart:()=>'2026-10-19',
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
assert.equal(c.runActivityType('unknown').id,'other');assert.equal(c.runActivityType(null).id,'run');
assert.deepEqual(plain(c.runPickableActivities().map(a=>a.id)),['run','walk','hike','mountain','tabletennis','soccer','mma','padel']);
assert.equal(c.runActivityType('unknown').gps,false);assert.equal(c.runIsRun({type:'unknown'}),false);assert.equal(c.runIsRun({}),true);
assert.equal(c.runActivityType('mma').met,7.8);assert.equal(c.runActivityType('padel').met,6);
console.log('PASS: activity catalogue, required types, valid MET/labels/icons, immutable entries and fallback.');

const kcal=opts=>c.runCaloriesEstimate({type:'run',movingSeconds:3000,distanceKm:10,weightKg:70,...opts});
const run=kcal({});assert.ok(run>=650&&run<=800,`10 km / 50 min / 70 kg: ${run}`);
assert.equal(kcal({type:'trail'}),run);
assert.ok(kcal({distanceKm:20})>=run,'faster running cannot fall back to low general-jogging MET');
const pingpong=kcal({type:'tabletennis',movingSeconds:3600});assert.equal(pingpong,280);
for(const weightKg of [undefined,null,0,29,301,'70',NaN,Infinity])assert.equal(kcal({weightKg}),null);
for(const movingSeconds of [undefined,null,0,-1,NaN,Infinity,'3000'])assert.equal(kcal({movingSeconds}),null);
assert.equal(c.runCaloriesEstimate(),null);assert.equal(kcal({type:'other'}),null);
assert.equal(kcal({type:'unknown'}),null);
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

// New optional data must round-trip, and malformed future-watch fields fail.
const entry={id:'new',date:'2026-10-25',type:'mma',durationSeconds:3600,distanceKm:0,source:'watch',avgHr:130,maxHr:180,laps:[180,420],durationXpVersion:1,kcal:546};
const backup={workouts:[],runs:[entry],profile:{kcalMode:'baseline',baselineFactor:1.3},runSettings:{weekMinutesGoal:150,rounds:{work:180,rest:60,count:5}},activeRun:{startedAt:1,type:'mma',laps:[180],rounds:{work:180,rest:60,count:5},durationXpVersion:1}};
let serial=JSON.stringify(backup);assert.equal(c.validData(backup),true);assert.equal(JSON.stringify(backup),serial);
assert.equal(c.validData({workouts:[]}),true);
for(const patch of [{source:'import'},{avgHr:NaN},{maxHr:251},{avgHr:181,maxHr:180},{laps:[20,10]},{laps:[10,10]},{laps:[3601]},{laps:[-1]},{durationXpVersion:2}])assert.equal(c.validData({...backup,runs:[{...entry,...patch}]}),false,JSON.stringify(patch));
for(const patch of [{weekMinutesGoal:-1},{weekMinutesGoal:Infinity},{rounds:{work:0,rest:60,count:5}},{rounds:{work:180,rest:-1,count:5}},{rounds:{work:180,rest:60,count:1.5}}])assert.equal(c.validData({...backup,runSettings:patch}),false);
assert.equal(c.validData({...backup,activeRun:{...backup.activeRun,laps:[NaN]}}),false);
assert.equal(c.validData({...backup,activeRun:{...backup.activeRun,rounds:{work:180,rest:60,count:0}}}),false);
assert.equal(c.validData({...backup,profile:{kcalMode:'new'}}),false);
assert.equal(c.validData({...backup,profile:{baselineFactor:1.5}}),false);
assert.equal(c.validData({...backup,workouts:[{durationXpVersion:'1'}]}),false);
for(const source of ['gps','manual','watch'])assert.equal(c.validData({...backup,runs:[{...entry,source}]}),true);
console.log('PASS: optional watch/lap/round/profile fields, non-mutating legacy validation and invalid bounds.');

state.weights=[{date:'2026-10-24',kg:70},{date:'2026-10-26',kg:90}];
const workout={id:'gym',date:'2026-10-25',durationSeconds:3600,finished:true,exercises:[],durationXpVersion:1};
assert.equal(c.workoutKcalEstimate(workout),245);assert.equal(c.activityNetKcal(workout),175);
assert.equal(c.activityNetKcal(entry),476);assert.equal(c.activityNetKcal({...entry,kcal:9999}),476,'net never derives from edited/rounded gross snapshot');
assert.equal(c.activityNetKcal({...entry,type:'mystery'}),null);
assert.equal(c.workoutKcalEstimate({...workout,autoFinished:true}),null);assert.equal(c.activityNetKcal({...workout,autoFinished:true}),null);
for(const w of [{...workout,finished:false},{...workout,durationSeconds:undefined},{...workout,date:'2026-10-01'}])assert.equal(c.workoutKcalEstimate(w),null);
assert.equal(c.activityNetKcal({...workout,finished:false}),null);
state.runs=[entry];state.workouts=[workout];
assert.equal(c.dayActivityKcal('2026-10-25'),651);assert.equal(c.dayActivityKcal('2026-10-24'),0);
assert.equal(c.activeMinutesWeek('2026-10-25'),120);assert.equal(c.activeMinutesGoal(),150);
let periodStats=c.activityPeriodStats('month','2026-10-25');assert.equal(periodStats.count,2);assert.equal(periodStats.kcal,791);assert.equal(periodStats.netKcal,651);assert.equal(periodStats.byType.gym.durationSeconds,3600);
assert.deepEqual(plain(periodStats.activeDays),['2026-10-25']);assert.deepEqual(plain(c.activityPeriodRange('week','2026-01-01')),{start:'2025-12-29',end:'2026-01-04'});
assert.deepEqual(plain(c.activityPeriodRange('month','2026-03-31',-1)),{start:'2026-02-01',end:'2026-02-28'});
state.workouts.push({...workout,id:'auto',autoFinished:true},{...workout,id:'missing',durationSeconds:undefined});
assert.equal(c.activeMinutesWeek('2026-10-25'),120);assert.equal(c.activityPeriodStats('week','2026-10-25').unknownDurationCount,2);
state.runs.push({...entry,id:'future',date:'2026-10-26'});assert.equal(c.dayActivityKcal('2026-10-26'),0,'future sessions excluded');
console.log('PASS: gross/net kcal, historical weight, auto-finish/unknown gates, daily/week/month aggregation including gym.');

state.runs=[{...entry,id:'a',startedAt:1}];state.workouts=[{...workout,id:'b',startedAt:2}];
let awards=c.activityDurationAwards();assert.equal(awards.a.xp,94);assert.equal(awards.b.xp,6);assert.equal(Object.values(c.workoutAwards()).reduce((s,a)=>s+a.xp,0),100);
state.runs.reverse();state.workouts.reverse();assert.deepEqual(plain(c.activityDurationAwards()),plain(awards));
state.runs=[{...entry,id:'legacy',durationXpVersion:undefined,startedAt:Date.now(),finishedAt:Date.now()}];state.workouts=[{...workout,durationXpVersion:undefined}];assert.deepEqual(plain(c.activityDurationAwards()),{});
state.runs=[{...entry,id:'new',date:'2026-10-24',startedAt:1}];state.workouts=[{...workout,id:'newgym',startedAt:2}];assert.equal(c.activityDurationAwards().new.xp,94);assert.equal(c.activityDurationAwards().newgym.xp,42);
state.workouts[0].autoFinished=true;assert.equal(c.activityDurationAwards().newgym,undefined);
state.workouts=[];state.runs=[{id:'oldrun',date:'2026-10-24',distanceKm:5,durationSeconds:3600},{...entry,type:'tabletennis',id:'first',startedAt:1,durationSeconds:7200},{id:'pr',type:'run',date:'2026-10-25',distanceKm:6,durationSeconds:3600,startedAt:2,durationXpVersion:1}];
assert.equal(c.workoutAwards().pr.xp,29,'PR 25 XP are additional to the remaining 4 daily duration XP');assert.equal(Object.values(c.workoutAwards()).reduce((s,a)=>s+a.xp,0),125);
state.runs=[];state.workouts=[];
assert.deepEqual(plain(c.runRoundsSettings()),{work:180,rest:60,count:5});assert.equal(c.runSetRounds({work:120,rest:0,count:3}),true);assert.equal(c.runSetRounds({work:0,rest:0,count:3}),false);
const mma={rounds:{work:180,rest:60,count:5}};assert.equal(c.runRoundState(mma,180).phase,'rest');assert.equal(c.runRoundState(mma,240).round,2);assert.equal(c.runRoundState(mma,1140).phase,'done');assert.equal(c.runRoundState(mma,1140).remainingSeconds,0);
state.activeRun={startedAt:Date.now()-20000,pausedAt:Date.now()-10000,laps:[]};assert.equal(c.runAddLap(),10);assert.equal(c.runAddLap(),null);assert.equal(state.activeRun.laps.length,1);state.activeRun=null;
assert.equal(c.setActiveMinutesGoal(180),true);assert.equal(c.activeMinutesGoal(),180);assert.equal(c.setActiveMinutesGoal(-1),false);assert.equal(c.activeMinutesGoal(),180);
console.log('PASS: shared daily duration XP cap, stable order, no retroactive XP, separate days, MMA phases and active-time laps.');

// Exercise actual edit functions with hidden and unknown stored IDs. No layout mock
// can prove the visual dropdown, but its selected value and saved data must survive.
let editHtml='';const controls={};c.openModal=(title,html)=>{editHtml=html};c.runTypeList=()=>c.runPickableActivities();c.runTypeInfo=c.runActivityType;c.runTypeName=t=>t.de;c.$=id=>controls[id];c.runDetail=()=>{};c.toast=()=>{};
vm.runInContext('const RUN_FEELINGS=[],RUN_TERRAINS=[];',c);
const sessionSource=fs.readFileSync('js/run-session.js','utf8');
vm.runInContext(sessionSource.slice(sessionSource.indexOf('function runMmaState('),sessionSource.indexOf('// Ton (WebAudio')),c);
const markedMma={startedAt:1,type:'mma',rounds:{work:180,rest:60,count:5},laps:[10,20,30,40,50]};
assert.equal(c.runMmaState(markedMma,20).round,3);assert.equal(c.runMmaState(markedMma,20).phase,'work');assert.equal(c.runMmaState(markedMma,50).phase,'done');
assert.equal(c.validData({workouts:[],activeRun:markedMma}),true,'manual MMA round marks use valid cumulative active seconds');
assert.equal(c.validData({workouts:[],runs:[{...entry,durationSeconds:50,laps:markedMma.laps}]}),true,'final MMA mark may equal duration');
assert.equal(c.validData({workouts:[],runs:[{...entry,durationSeconds:49,laps:markedMma.laps}]}),false,'no future lap beyond saved duration');
assert.equal(c.validData({workouts:[],activeRun:{...markedMma,laps:[10,10]}}),false,'same-second duplicate remains invalid');
vm.runInContext(sessionSource.slice(sessionSource.indexOf('function runEditForm('),sessionSource.indexOf('// Andere Vollbilder')),c);
for(const type of ['trail','ride','inline','other','mystery']){
  state.runs=[{...entry,type,kcal:123}];c.runEditForm('new');assert.ok(editHtml.includes('value="'+type+'" selected'),type);
  Object.assign(controls,{'runedit-type':{value:type},'runedit-feel':{value:''},'runedit-terrain':{value:''},'runedit-note':{value:'kept'}});
  c.runEditSave({preventDefault(){}},'new');assert.equal(state.runs[0].type,type);assert.equal(state.runs[0].kcal,123);assert.equal(state.runs[0].source,'watch');assert.deepEqual(state.runs[0].laps,[180,420]);
}
state.runs=[];state.runSettings={rounds:{work:180,rest:60,count:5}};
c.startRunTimer(true,null,'mma');assert.equal(state.activeRun.gps,false);assert.equal(state.activeRun.durationXpVersion,1);assert.deepEqual(plain(state.activeRun.rounds),{work:180,rest:60,count:5});
state.activeRun.laps=[10,20];const saved=c.commitRunActivity({distanceKm:0,durationSeconds:30});assert.equal(saved.durationXpVersion,1);assert.deepEqual(plain(saved.laps),[10,20]);assert.equal(state.activeRun,null);
state.activeRun={startedAt:Date.now(),type:'mma',pausedAt:Date.now()};const legacy=c.commitRunActivity({distanceKm:0,durationSeconds:30});assert.equal(legacy.durationXpVersion,undefined,'old active sessions do not acquire marker when finishing');
c.startRunTimer(true,null,'mystery');assert.equal(state.activeRun.gps,false);assert.equal(state.activeRun.type,'mystery');state.activeRun=null;
c.startRunTimer(true,null,'INVALID!');assert.equal(state.activeRun.gps,false);assert.equal(state.activeRun.type,'other');state.activeRun=null;
state.runs=[];state.runSettings={};
console.log('PASS: edit/save preserves hidden/unknown types and snapshots; new session marker/laps/rounds persist, legacy sessions and unknown GPS stay safe.');

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
