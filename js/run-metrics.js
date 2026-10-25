/* Shared activity metrics; load after running.js. Estimators and aggregations do
   not mutate data; the explicit goal setter and final render are integration hooks.
   MET source: 2024 Adult Compendium of Physical Activities (ages 19–59):
   https://pacompendium.com/running/ (12020), /walking/ (17160,17080,17035),
   /bicycling/ (01014), /sports/ (15660,15610,15591),
   /conditioning-exercise/ (02064). Trail uses general jogging as a baseline;
   mountain uses moderate uphill walking. These are population estimates.
   Other uses home exercise only as a catalogue baseline; calories remain unknown
   because an unspecified activity has no defensible intensity. */
const RUN_ACTIVITIES=Object.freeze([
  {id:'run',de:'Laufen',en:'Running',icon:'run',gps:true,category:'run',met:7.5},
  {id:'trail',de:'Trailrun',en:'Trail running',icon:'trail',gps:true,category:'run',met:7.5},
  {id:'walk',de:'Spazieren',en:'Walking',icon:'walk',gps:true,category:'walk',met:3.5},
  {id:'hike',de:'Wandern',en:'Hiking',icon:'hike',gps:true,category:'walk',met:6},
  {id:'mountain',de:'Berggehen',en:'Mountain walking',icon:'mountain',gps:true,category:'walk',met:7},
  {id:'ride',de:'Radfahren',en:'Cycling',icon:'ride',gps:true,category:'ride',met:7},
  {id:'tabletennis',de:'Tischtennis',en:'Table tennis',icon:'tabletennis',gps:false,category:'other',met:4},
  {id:'soccer',de:'Fußball',en:'Soccer',icon:'soccer',gps:false,category:'other',met:7},
  // https://pacompendium.com/sports/ (2024): 15120 boxing sparring;
  // MMA proxy, not an MMA-specific measurement. 15680 tennis doubles: Padel proxy.
  {id:'mma',de:'MMA',en:'MMA',icon:'mma',gps:false,category:'other',met:7.8},
  {id:'padel',de:'Padel',en:'Padel',icon:'padel',gps:false,category:'other',met:6},
  {id:'inline',de:'Inlineskaten',en:'Inline skating',icon:'inline',gps:true,category:'other',met:7.5},
  {id:'other',de:'Sonstiges',en:'Other',icon:'other',gps:false,category:'other',met:3.8}
].map(a=>Object.freeze({...a,pick:!['trail','ride','inline','other'].includes(a.id)})));

function runActivityType(id){return RUN_ACTIVITIES.find(a=>a.id===(id==null?'run':id))||RUN_ACTIVITIES.find(a=>a.id==='other')}
function runPickableActivities(){return RUN_ACTIVITIES.filter(a=>a.pick)}

/* Gross energy, including resting expenditure: MET × kg × hours (conventional
   approximation 1 MET ≈ 1 kcal/kg/h). Running: interpolate Compendium 2024
   speed entries (12028–12130); below 6.6 km/h use general jogging, above
   17.7 km/h hold the highest reference MET rather than extrapolating.
   Walking: level-speed entries 17151–17231; uphill entries 17034–17036
   only at 3–5.6 km/h and positive mean ascent/distance <=20%. Total ascent
   is a route-average proxy, not a measured constant gradient. Hiking uses
   17081/17082/17080 by pace, taking the larger uphill estimate if applicable.
   No downhill correction or guessed ascent, no additional trail multiplier. */
function runActivityMet({type,movingSeconds,distanceKm,ascentM}={}){
  if(!Number.isFinite(movingSeconds)||movingSeconds<=0)return null;
  let activity=runActivityType(type),met=activity.met;
  if(activity.id==='other')return null;
  const speed=Number.isFinite(distanceKm)&&distanceKm>0?distanceKm*3600/movingSeconds:null;
  if(speed!==null&&activity.category==='run'){
    const levels=[[6.6,6.5],[7.3,7.8],[8.2,8.5],[9.1,9],[9.9,9.3],[10.8,10.5],[11.3,11],[12.1,11.8],[12.9,12],[13.8,12.5],[14.5,13],[15.2,14.8],[16.1,14.8],[17.7,16.8]];
    if(speed>levels.at(-1)[0])met=levels.at(-1)[1];
    else if(speed>=levels[0][0]){
      let i=1;while(i<levels.length-1&&speed>levels[i][0])i++;
      const [s0,m0]=levels[i-1],[s1,m1]=levels[i];met=m0+(m1-m0)*(speed-s0)/(s1-s0);
    }
  }else if(speed!==null&&activity.category==='walk'){
    if(activity.id==='walk')met=speed<3.2?2.3:speed<4?2.8:speed<4.5?3:speed<5.6?3.8:speed<6.4?4.8:speed<7.2?5.5:speed<8?7:8.5;
    else met=speed<3.2?3.8:speed<5.6?5.3:6;
    if(Number.isFinite(ascentM)&&ascentM>0&&speed>=3&&speed<=5.6){
      const grade=ascentM/(distanceKm*1000);
      if(grade>=.01&&grade<=.2)met=Math.max(met,grade<=.05?5.3:grade<=.1?7:8.8);
    }
  }
  return met;
}
function runCaloriesEstimate(options={}){let {weightKg,movingSeconds}=options,met=runActivityMet(options);return Number.isFinite(weightKg)&&weightKg>=30&&weightKg<=300&&met!==null?Math.round(met*weightKg*movingSeconds/3600):null}

// 2024 Compendium https://pacompendium.com/conditioning-exercise/, 02054:
// multiple resistance exercises, 8–15 reps, varied resistance (3.5 MET).
// Session duration includes ordinary between-set rests; no calories from volume.
const WORKOUT_MET=3.5;
function workoutKcalEstimate(workout){
  if(!workout?.finished||workout.autoFinished||!(workout.durationSeconds>0)||!Number.isFinite(workout.durationSeconds))return null;
  let kg=runLatestWeight(state,workout.date);return kg>=30&&kg<=300?Math.round(WORKOUT_MET*kg*workout.durationSeconds/3600):null;
}
// Uses the same speed/ascent MET as gross estimates; never subtract resting energy
// from an already rounded or edited historical kcal snapshot. Does not mutate it.
function activityNetKcal(entry){
  if(!entry||('finished' in entry&&entry.finished!==true)||!Number.isFinite(entry.durationSeconds)||entry.durationSeconds<=0||entry.autoFinished)return null;
  let kg=runLatestWeight(state,entry.date),met=entry.finished===true?WORKOUT_MET:runActivityMet({type:entry.type,movingSeconds:entry.durationSeconds,distanceKm:entry.distanceKm,ascentM:entry.elevationGain});
  return kg>=30&&kg<=300&&met!==null?Math.round(Math.max(0,met-1)*kg*entry.durationSeconds/3600):null;
}
function dayActivityKcal(dateKey){return activityEntries(dateKey,dateKey).reduce((sum,x)=>sum+(activityNetKcal(x.entry)??0),0)}

// Shared, non-mutating overview input. Unknown durations stay null, not invented.
function activityEntries(start,end){
  let inRange=x=>x.date>=start&&x.date<=end&&x.date<=today();
  return [...(state.runs||[]).filter(inRange).map(entry=>({kind:'activity',type:entry.type??'run',entry})),
    ...(state.workouts||[]).filter(w=>w.finished&&inRange(w)).map(entry=>({kind:'workout',type:'gym',entry}))]
    .sort((a,b)=>a.entry.date.localeCompare(b.entry.date)||(a.entry.startedAt||a.entry.finishedAt||a.entry.createdAt||0)-(b.entry.startedAt||b.entry.finishedAt||b.entry.createdAt||0)||String(a.entry.id).localeCompare(String(b.entry.id)));
}
function activityPeriodRange(mode='week',dateKey=today(),offset=0){
  let d=new Date(dateKey+'T12:00:00');
  if(mode==='month'){d.setDate(1);d.setMonth(d.getMonth()+offset);let start=localISO(d);d.setMonth(d.getMonth()+1);d.setDate(0);return {start,end:localISO(d)}}
  d.setDate(d.getDate()-(d.getDay()+6)%7+offset*7);let start=localISO(d);d.setDate(d.getDate()+6);return {start,end:localISO(d)};
}
function activityStatsBetween(start,end){
  let rows=activityEntries(start,end),byType={},days=new Set();
  const empty=()=>({count:0,durationSeconds:0,unknownDurationCount:0,distanceKm:0,kcal:0,netKcal:0,unknownKcalCount:0});let total=empty();
  for(let x of rows){let e=x.entry,gross=x.kind==='workout'?workoutKcalEstimate(e):Number.isFinite(e.kcal)?e.kcal:runCaloriesEstimate({type:e.type,movingSeconds:e.durationSeconds,distanceKm:e.distanceKm,weightKg:runLatestWeight(state,e.date),ascentM:e.elevationGain}),net=activityNetKcal(e);
    days.add(e.date);let group=byType[x.type]??=empty();
    for(let s of [total,group]){s.count++;if(Number.isFinite(e.durationSeconds)&&e.durationSeconds>0&&!e.autoFinished)s.durationSeconds+=e.durationSeconds;else s.unknownDurationCount++;s.distanceKm+=x.kind==='activity'&&Number.isFinite(e.distanceKm)?e.distanceKm:0;s.kcal+=gross??0;s.netKcal+=net??0;if(gross===null)s.unknownKcalCount++}
  }
  return {...total,minutes:total.durationSeconds/60,byType,activeDays:[...days].sort(),entries:rows};
}
function activityPeriodStats(mode='week',dateKey=today(),offset=0){let range=activityPeriodRange(mode,dateKey,offset);return {...range,...activityStatsBetween(range.start,range.end)}}
function activeMinutesWeek(dateKey=today()){return activityPeriodStats('week',dateKey).minutes}
function activeMinutesGoal(){return state.runSettings?.weekMinutesGoal??150}
function setActiveMinutesGoal(minutes){if(!Number.isFinite(minutes)||minutes<0||minutes>10080)return false;state.runSettings={...state.runSettings,weekMinutesGoal:minutes};save();return true}

// Only sessions explicitly created by this version qualify. Editing/reopening an
// old entry never adds this marker. Deterministic date/start/id order shares the
// 100 XP daily cap across gym and activities; record XP remain separate.
function activityDurationAwards(){
  let used={},awards={};for(let x of activityEntries('0000-01-01',today())){let e=x.entry;if(e.durationXpVersion!==1||e.autoFinished||!Number.isFinite(e.durationSeconds)||e.durationSeconds<=0)continue;
    let met=x.kind==='workout'?WORKOUT_MET:runActivityMet({type:e.type,movingSeconds:e.durationSeconds,distanceKm:e.distanceKm,ascentM:e.elevationGain});
    if(met===null)continue;let xp=Math.min(Math.max(0,100-(used[e.date]||0)),Math.round(e.durationSeconds/60*met/5));used[e.date]=(used[e.date]||0)+xp;awards[e.id]={xp,durationXp:xp,wins:[],run:x.kind==='activity'};
  }return awards;
}

// Last recorded weight on/before an ISO calendar date; never substitute a future
// measurement or profile default. Same-day duplicates use the last array entry.
function runLatestWeight(state,date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  let latest=null;
  for(const w of Array.isArray(state?.weights)?state.weights:[]){
    if(w&&typeof w.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(w.date)&&w.date<=date&&Number.isFinite(w.kg)&&w.kg>=20&&w.kg<=400&&(!latest||w.date>=latest.date))latest=w;
  }
  return latest?latest.kg:null;
}

/* Points: [t milliseconds,lat,lon,accM,seg,altM,altAccM]. Old five-field
   points remain valid. Native altAccM=-1 means unknown (altM=0 placeholder).
   Missing/null accuracy is allowed if altitude exists; never coerce null to 0.
   Break on missing/unreliable height or segment boundary. At least five useful
   consecutive accepted fixes per group; centred five-fix mean, 3 m reversal
   hysteresis. Extrema also use smoothed heights, in metres. */
function runElevation(points){
  const accepted=runAcceptedPoints(points),groups=[];let group=[];
  for(const p of accepted){
    const usable=Number.isFinite(p[5])&&(p[6]==null||(Number.isFinite(p[6])&&p[6]>=0&&p[6]<=20));
    if(!usable||(group.length&&group.at(-1)[4]!==p[4])){if(group.length>=5)groups.push(group);group=[]}
    if(usable)group.push(p);
  }
  if(group.length>=5)groups.push(group);
  if(!groups.length)return null;
  let gain=0,loss=0,max=-Infinity,min=Infinity;
  for(const g of groups){
    const heights=g.map((_,i)=>{let sum=0,n=0;for(let j=Math.max(0,i-2);j<=Math.min(g.length-1,i+2);j++){sum+=g[j][5];n++}return sum/n});
    let low=heights[0],high=low,direction=0;
    for(const h of heights){
      max=Math.max(max,h);min=Math.min(min,h);
      if(direction===0){
        if(h-low>=3){direction=1;high=h}else if(high-h>=3){direction=-1;low=h}else{low=Math.min(low,h);high=Math.max(high,h)}
      }else if(direction===1){
        if(h>high)high=h;else if(high-h>=3){gain+=high-low;low=h;direction=-1}
      }else{
        if(h<low)low=h;else if(h-low>=3){loss+=high-low;high=h;direction=1}
      }
    }
    if(direction===1)gain+=high-low;else if(direction===-1)loss+=high-low;
  }
  return {gain:Math.round(gain),loss:Math.round(loss),max:Math.round(max),min:Math.round(min)};
}

/* Maximum trailing 20-second mean path speed, >=3 fixes, within one segment.
   Linear interpolation at the window boundary avoids sample-rate bias. This
   deliberately reports sustained speed, not a single GPS interval peak. */
function runMaxSpeed(points){
  const accepted=runAcceptedPoints(points);let group=[],best=null;
  function measure(g){
    let left=0;
    for(let right=2;right<g.length;right++){
      const end=g[right],start=end.t-20000;
      if(start<g[0].t)continue;
      while(left+1<right&&g[left+1].t<=start)left++;
      if(right-left<2)continue;
      const a=g[left],b=g[left+1],at=a.m+(b.m-a.m)*(start-a.t)/(b.t-a.t),speed=(end.m-at)/20*3.6;
      if(Number.isFinite(speed))best=best===null?speed:Math.max(best,speed);
    }
  }
  for(let i=0;i<accepted.length;i++){
    const p=accepted[i],prev=accepted[i-1];
    if(prev&&(prev[4]!==p[4]||p[0]<=prev[0])){measure(group);group=[]}
    group.push({t:p[0],m:group.length?group.at(-1).m+runMeters(prev,p):0});
  }
  measure(group);return best===null?null:Math.round(best*10)/10;
}

// Time between accepted fixes in the same segment; includes unmarked stops and
// signal gaps. This is segment time, not an inferred auto-pause measurement.
function runMovingStats(points){
  const accepted=runAcceptedPoints(points);let movingSeconds=0,meters=0;
  for(let i=1;i<accepted.length;i++){
    const a=accepted[i-1],b=accepted[i];if(a[4]!==b[4])continue;
    movingSeconds+=Math.max(0,(b[0]-a[0])/1000);meters+=runMeters(a,b);
  }
  return {movingSeconds,distanceKm:meters/1000};
}

// Baseline goals wait for this complete activity module; earlier render calls
// must not persist a temporary target without sport. Later renders are idempotent.
if(state.profile?.kcalMode==='baseline')render();
