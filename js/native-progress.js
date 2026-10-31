/* M5 Phase A: bounded display data and queries, never a second history or formula engine. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeProgress'))return;
const limit=48*1024;
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=256;
const text=x=>{const s=String(x??'');let end=Math.min(256,s.length);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1])&&/[\uDC00-\uDFFF]/.test(s[end]))end--;return s.slice(0,end)};
const number=(x,digits=1)=>Number.isFinite(x)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:digits}).format(x)):null;
const shown=x=>Number.isFinite(x)?number(round(x)):null;
// Legacy profiles may omit runs. Web runList() initializes it; a read projection/query must not persist that side effect.
const read=fn=>{const present=Object.hasOwn(state,'runs'),runs=state.runs;try{return fn()}finally{if(present)state.runs=runs;else delete state.runs}};
const same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||
  plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
const fail=(code,message)=>({code,message});
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const label=x=>text(state.language==='en'?(typeof translatedUI==='function'?translatedUI(String(x??'')):
  typeof englishUI==='object'&&typeof englishUI[x]==='string'?englishUI[x]:x):x);
const muscleLabel=x=>label(muscleNames[x]||(x==='unassigned'?'Nicht zugeordnet':x));
// Exact (possibly extended) expectations come from the lossless snapshot, never from these compact settings.
const settings=()=>({progressView:state.progressView?Object.fromEntries(['group','range','metric'].filter(k=>Object.hasOwn(state.progressView,k)).map(k=>[k,text(state.progressView[k])])):null,
  chartPeriod:state.chartPeriod??null,chartLines:state.chartLines?Object.fromEntries(['weight','strength','kcal'].filter(k=>Object.hasOwn(state.chartLines,k)).map(k=>[k,state.chartLines[k]])):null});
const goals=()=>({weeklyGoalKm:runGoalKm(),weekMinutesGoal:activeMinutesGoal()});
const stats=ws=>{const s=workoutStats(ws);return {...s,volume:number(s.volume),averageClock:s.average===null?null:formatClock(s.average),durationClock:formatClock(s.duration)}};
const muscles=ws=>muscleCounts(ws).map(([key,sets])=>({key:text(key),label:muscleLabel(key),sets}));
const award=(w,awards)=>{const a=awards[w.id]||{xp:0,wins:[]};return {xp:a.xp,durationXp:a.durationXp??0,wins:a.wins.slice(0,100).map(text),winsOmitted:Math.max(0,a.wins.length-100)}};
const session=(w,awards)=>({id:w.id,name:text(w.name),date:w.date,durationSeconds:Number.isFinite(w.durationSeconds)?w.durationSeconds:null,
  durationClock:Number.isFinite(w.durationSeconds)?formatClock(w.durationSeconds):null,timeApprox:!!w.timeApprox,autoFinished:!!w.autoFinished,
  exerciseCount:w.exercises.length,...stats([w]),...award(w,awards)});
// Build the expensive providers only after explicit invalidation; ordinary renders/date/forced Hellos reuse them.
const parts=new Map();
function memo(name,keys,build){const prior=parts.get(name);if(prior&&keys.length===prior.keys.length&&keys.every((x,i)=>x===prior.keys[i]))return prior.value;const value=build();parts.set(name,{keys,value});return value}
const queryCache=new Map();
// These signatures are evaluated only on demand, never in render or save wrappers. Split active edits from history.
function inputs(){return {day:today(),language:state.language,history:JSON.stringify(state.workouts.filter(w=>w.finished)),
  workouts:JSON.stringify(state.workouts),runs:JSON.stringify(state.runs||[]),book:JSON.stringify(state.exerciseBook),
  weights:JSON.stringify(state.weights),foods:JSON.stringify(state.foods),measurements:JSON.stringify(state.measurements),profile:JSON.stringify(state.profile)}}
function withAwards(d,fn){const original=workoutAwards,completed=completedWorkouts;workoutAwards=()=>d.awards;completedWorkouts=()=>d.workouts;
  try{return fn()}finally{workoutAwards=original;completedWorkouts=completed}}
function data(context,metrics=false,chart=false){
  const k=inputs(),workouts=memo('workouts',[state,k.day,k.history],()=>completedWorkouts());
  const awards=memo('awards',[state,k.day,k.history,k.runs],()=>workoutAwards()),d={k,workouts,awards};
  memo('queryToken',[state,...Object.values(k),JSON.stringify(state.runSettings)],()=>{queryCache.clear();return true});
  if(metrics)d.metrics=memo('metrics',[state,k.day,k.language,k.history,k.runs,k.book,k.foods,k.weights,k.measurements,k.profile],()=>withAwards(d,()=>buildProgressMetrics()));
  if(chart)d.chart=memo('chart',[state,k.day,k.workouts,k.foods,k.weights,state.chartPeriod],()=>trendData());
  return d;
}
// One pass indexes exercise sources; Web strengthRecord/exerciseHistory/forecast/progression still do all mathematics.
function exerciseProviders(d,fn){
  const index=memo('exerciseIndex',[state,d.k.day,d.k.workouts,d.k.history],()=>{
    const ids=new Map(),names=new Map(),sessions=new Map(),legacy=new Map();let order=0;
    const add=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value)};
    for(const w of state.workouts)if(w.date<=d.k.day)for(const e of w.exercises)for(const s of e.sets)if(s.done){const item={order:order++,set:{...s,date:w.date}};
      if(e.exerciseId)add(ids,e.exerciseId,item);else add(names,e.name.toLocaleLowerCase('de'),item)}
    for(const w of d.workouts){const seen=new Set(),old=new Set();for(const e of w.exercises){if(e.exerciseId)seen.add(e.exerciseId);else old.add(e.name.toLowerCase())}
      for(const key of seen)add(sessions,key,w);for(const key of old)add(legacy,key,w)}
    return {ids,names,sessions,legacy,histories:new Map(),records:new Map()};
  });
  const originalSets=exerciseSets,originalHistory=exerciseHistory,originalRecord=strengthRecord,completed=completedWorkouts;
  exerciseSets=(key,name)=>[...(index.ids.get(key)||[]),...(index.names.get(name.toLocaleLowerCase('de'))||[])].sort((a,b)=>a.order-b.order).map(x=>x.set);
  exerciseHistory=b=>{const key=JSON.stringify([b.id,b.name]);if(!index.histories.has(key)){
    const candidates=new Set([...(index.sessions.get(b.id)||[]),...(index.legacy.get(b.name.toLowerCase())||[])]);
    completedWorkouts=()=>d.workouts.filter(w=>candidates.has(w));try{index.histories.set(key,originalHistory(b))}finally{completedWorkouts=completed}
  }return index.histories.get(key)};
  strengthRecord=b=>{const key=JSON.stringify([b.id,b.name]);if(!index.records.has(key))index.records.set(key,originalRecord(b));return index.records.get(key)};
  try{return fn()}finally{exerciseSets=originalSets;exerciseHistory=originalHistory;strengthRecord=originalRecord;completedWorkouts=completed}
}
function record(b){
  // strengthRecord intentionally includes done sets in unfinished workouts, just like Web recordsPage/rankHtml.
  const r=strengthRecord(b),rank=levelFor(r.best?.est||0,b.target);
  return {id:b.id,name:text(b.name),target:Number.isFinite(b.target)?number(b.target):null,best:r.best?{date:r.best.date,e1rm:shown(r.best.est)}:null,
    heaviest:r.heaviest?{date:r.heaviest.date,kg:number(Number(r.heaviest.kg)),reps:Number(r.heaviest.reps)}:null,
    rank:{level:rank.level,name:label(rank.name),percent:number(rank.pct)},forecast:label(rankForecast(b)),suggestion:label(progression(b))};
}
function activityRow(x){
  const e=x.entry,known=Number.isFinite(e.durationSeconds)&&e.durationSeconds>0&&!e.autoFinished;
  const kcal=x.kind==='workout'?workoutKcalEstimate(e):Number.isFinite(e.kcal)?e.kcal:runCaloriesEstimate({type:e.type,movingSeconds:e.durationSeconds,
    distanceKm:e.distanceKm,weightKg:runLatestWeight(state,e.date),ascentM:e.elevationGain});
  return {kind:x.kind,type:text(x.type),id:e.id,date:e.date,name:text(x.kind==='workout'?e.name:actTypeName(x.type)),
    durationSeconds:known?e.durationSeconds:null,durationClock:known?formatClock(e.durationSeconds):null,
    distanceKm:x.kind==='activity'&&Number.isFinite(e.distanceKm)?number(e.distanceKm,2):null,kcal:Number.isFinite(kcal)?kcal:null,estimatedKcal:true};
}
function activitySummary(s){
  return {count:s.count,durationSeconds:s.durationSeconds,durationLabel:actDuration(s.durationSeconds),minutes:Math.round(s.durationSeconds/60),
    distanceKm:number(Math.round(s.distanceKm*10)/10,2),recapDistanceKm:number(Math.round(s.distanceKm*100)/100),kcal:Math.round(s.kcal),
    unknownDurationCount:s.unknownDurationCount,unknownKcalCount:s.unknownKcalCount};
}
function activity(mode,offset,filter='all'){
  return activityBetween(mode,offset,filter,activityPeriodRange(mode,today(),offset));
}
function activityBetween(mode,offset,filter,range){
  const s={...range,...activityStatsBetween(range.start,range.end)},empty={count:0,durationSeconds:0,distanceKm:0,kcal:0,unknownDurationCount:0,unknownKcalCount:0};
  const allTypes=[...new Set(activityEntries('0000-01-01',today()).map(x=>x.type))];
  if(filter!=='all'&&!allTypes.includes(filter))filter='all';
  const rows=s.entries.filter(x=>filter==='all'||x.type===filter),view=filter==='all'?s:s.byType[filter]||empty;
  return {mode,offset,filter,start:s.start,end:s.end,summary:activitySummary(view),activeDays:[...new Set(rows.map(x=>x.entry.date))].sort(),
    types:allTypes.sort((a,b)=>a==='gym'?-1:b==='gym'?1:actTypeName(a).localeCompare(actTypeName(b),appLocale())).map(type=>({type:text(type),label:text(actTypeName(type))})),
    byType:Object.entries(s.byType).sort((a,b)=>b[1].durationSeconds-a[1].durationSeconds||b[1].count-a[1].count)
      .map(([type,v])=>({type:text(type),label:text(actTypeName(type)),...activitySummary(v)})),
    entries:rows.slice(-60).reverse().filter(x=>id(x.entry.id)).map(activityRow),omitted:rows.length-rows.slice(-60).filter(x=>id(x.entry.id)).length};
}
function recap(mode,offset,d){
  return recapBetween(mode,offset,activityPeriodRange(mode,today(),offset),d);
}
function recapBetween(mode,offset,range,d){
  const ws=d.workouts.filter(w=>w.date>=range.start&&w.date<=range.end);
  const runs=(state.runs||[]).filter(r=>r.date>=range.start&&r.date<=range.end);
  return {mode,offset,...range,stats:stats(ws),xp:[...ws,...runs].reduce((n,w)=>n+(d.awards[w.id]?.xp||0),0),
    muscles:muscles(ws),activity:activitySummary(activityStatsBetween(range.start,range.end))};
}
function runningSummary(){
  const runs=pastRuns().filter(runIsRun),eligible=runs.filter(r=>r.distanceKm>=1),range=activityPeriodRange('month'),month=runs.filter(r=>r.date>=range.start),
    monthKm=month.reduce((n,r)=>n+r.distanceKm,0),monthSeconds=month.reduce((n,r)=>n+r.durationSeconds,0),
    longest=runs.length?runs.reduce((a,b)=>b.distanceKm>a.distanceKm?b:a):null,
    fastest=eligible.length?eligible.reduce((a,b)=>runPace(b)<runPace(a)?b:a):null;
  return {count:runs.length,totalKm:number(Math.round(runs.reduce((n,r)=>n+r.distanceKm,0)*10)/10,2),monthKm:number(Math.round(monthKm*10)/10,2),
    monthPaceText:runPaceText(monthKm>0?monthSeconds/monthKm:null),
    longest:longest?{id:id(longest.id)?longest.id:null,date:longest.date,distanceKm:number(longest.distanceKm,2)}:null,
    fastest:fastest?{id:id(fastest.id)?fastest.id:null,date:fastest.date,paceText:runPaceText(runPace(fastest))}:null,
    weeks:Array.from({length:8},(_,i)=>{const r=runWeekRange(i-7);return {...r,km:number(runKmBetween(r.start,r.end),2)}})};
}
function metricView(d){
  const v=state.progressView||{},group=Object.hasOwn(progressGroups,v.group)?v.group:'training',range=Object.hasOwn(progressRanges,v.range)?v.range:'month';
  const list=d.metrics.definitions.filter(x=>x.group===group),m=list.find(x=>x.key===v.metric)||list.find(x=>x.key===({training:'volume',food:'food:kcal',body:'weight'}[group]))||list[0];
  const points=m?filteredMetricPoints(m,range):[],values=points.map(x=>x.value);
  return {group,range,metric:m?text(m.key):null,groups:Object.entries(progressGroups).map(([key,name])=>({key,label:label(name)})),
    ranges:Object.entries(progressRanges).map(([key,[name]])=>({key,label:label(name)})),
    definitions:list.slice(0,160).map(x=>({key:text(x.key),label:label(x.label),unit:label(x.unit),note:label(x.note)})),
    points:points.slice(-400).map(x=>({date:x.date,value:shown(x.value)})),total:points.length,omitted:Math.max(0,points.length-400),
    definitionsOmitted:Math.max(0,list.length-160),latest:points.length?shown(values.at(-1)):null,
    average:points.length?shown(values.reduce((a,b)=>a+b,0)/points.length):null,high:points.length?shown(values.reduce((a,b)=>Math.max(a,b),-Infinity)):null};
}
function build(context){
  const d=data(context,true,true),k=d.k;
  return memo('projection',[state,...Object.values(k),JSON.stringify(settings()),JSON.stringify(state.runSettings),recapMode,recapOffset,actMode,actOffset,actFilter],()=>buildFresh(d));
}
function buildFresh(d){
  const k=d.k,book=state.exerciseBook||[],records=memo('records',[state,k.day,k.language,k.workouts,k.book],()=>exerciseProviders(d,()=>book.filter(b=>id(b.id)).slice(0,60).map(record))),chart=d.chart;
  const range=runWeekRange(),efforts=runBestEfforts();
  const p={language:state.language==='en'?'en':'de',locale:appLocale(),today:today(),settings:settings(),
    identity:memo('identity',[state,k.day,k.history,k.runs],()=>({...xpProgress(Object.values(d.awards).reduce((sum,a)=>sum+a.xp,0)),streak:dailyWorkoutStreak(),weekStreak:trainingStreak()})),stats:memo('stats',[state,k.day,k.history],()=>stats(d.workouts)),
    records,recordCount:book.length,metrics:metricView(d),
    chart:{period:state.chartPeriod||'month',lines:Object.fromEntries(['weight','strength','kcal'].map(k=>[k,state.chartLines?.[k]!==false])),
      rows:chart.slice(-400).map(x=>({date:x.date,weight:number(x.weight),strength:number(x.strength),kcal:Number.isFinite(x.kcal)?Math.round(x.kcal):null})),
      total:chart.length,omitted:Math.max(0,chart.length-400)},
    recap:recap(recapMode,recapOffset,d),recaps:[recap('week',0,d),recap('month',0,d)],
    activity:activity(actMode,actOffset,actFilter),weeklyGoals:{...goals(),...range,activeMinutes:Math.floor(activeMinutesWeek()),runKm:number(Math.round(runKmBetween(range.start,range.end)*10)/10,2)},
    running:runningSummary(),runRecords:Object.entries(efforts).filter(([,x])=>id(x.run.id)).map(([km,x])=>({km:Number(km),seconds:x.seconds,clock:formatClock(x.seconds),runId:x.run.id,date:x.run.date})),
    omitted:{records:book.length-records.length,muscles:0,activityTypes:0},navigation:{calendar:{action:'calendar'},progress:{action:'progress'},records:{action:'records'},weeklyGoals:{action:'weeklyGoals'}}};
  const trim=[()=>{if(p.chart.rows.length){p.chart.omitted++;return p.chart.rows.shift()}},
    ()=>{if(p.metrics.points.length){p.metrics.omitted++;return p.metrics.points.shift()}},
    ()=>{if(p.activity.entries.length){p.activity.omitted++;return p.activity.entries.pop()}},
    ()=>{if(p.records.length){p.omitted.records++;return p.records.pop()}},
    ()=>{if(p.metrics.definitions.length){p.metrics.definitionsOmitted++;return p.metrics.definitions.pop()}},
    ()=>{for(const r of [p.recap,...p.recaps])if(r.muscles.length){p.omitted.muscles++;return r.muscles.pop()}},
    ()=>{if(p.activity.types.length){p.omitted.activityTypes++;return p.activity.types.pop()}if(p.activity.byType.length){p.omitted.activityTypes++;return p.activity.byType.pop()}}];
  let size=JSON.stringify(p).length;
  while(size>limit){
    let removed;for(const fn of trim){removed=fn();if(removed)break}
    if(!removed)throw Error('Progress exceeds message budget');
    size-=JSON.stringify(removed).length+1;if(size<=limit)size=JSON.stringify(p).length;
  }
  return p;
}
function workoutQuery(w,d){
  const exercises=w.exercises.filter(e=>id(e.id)).slice(0,100).map(e=>({id:e.id,libraryId:id(e.exerciseId)?e.exerciseId:null,name:text(e.name),
    sets:e.sets.slice(0,200).map(s=>({kg:s.kg,reps:s.reps,done:s.done,shownKg:s.kg===''?null:number(Number(s.kg)),e1rm:number(e1rm(s))})),
    omitted:Math.max(0,e.sets.length-200)}));
  return {...session(w,d.awards),bodyweight:Number.isFinite(w.bodyweight)?number(w.bodyweight):null,exercises,omitted:w.exercises.length-exercises.length};
}
function exerciseQuery(b){
  const h=exerciseHistory(b),points=h.filter(x=>x.best>0),history=h.slice(-120).reverse().map(x=>({workoutId:id(x.w.id)?x.w.id:null,date:x.w.date,name:text(x.w.name),
    e1rm:x.best?number(x.best):null,volume:number(x.volume),sets:x.sets.slice(0,100).map(s=>({kg:s.kg,reps:s.reps})),omitted:Math.max(0,x.sets.length-100)}));
  return {...record(b),bestE1rm:number(h.reduce((v,x)=>Math.max(v,x.best),0)||null),history,total:h.length,omitted:h.length-history.length,
    points:points.slice(-400).map(x=>({date:x.w.date,workoutId:id(x.w.id)?x.w.id:null,value:number(x.best)})),pointsOmitted:Math.max(0,points.length-400)};
}
function query(r,context){
  if(!['month','workout','exercise','run'].includes(r.kind))return null;
  const allowed=r.kind==='month'?['requestId','kind','month','day','activityMode','activityFilter']:['requestId','kind','id'];
  if(Object.keys(r).some(k=>!allowed.includes(k)))return null;
  if(r.kind==='month'?(typeof r.month!=='string'||!/^\d{4}-\d{2}$/.test(r.month)||!day(r.month+'-01')):!id(r.id))return null;
  if(r.kind==='month'&&r.day!==undefined&&(!day(r.day)||!r.day.startsWith(r.month+'-')))return null;
  if(r.kind==='month'&&(r.activityMode!==undefined&&!['week','month'].includes(r.activityMode)||
    r.activityFilter!==undefined&&(typeof r.activityFilter!=='string'||!/^[a-z]{2,20}$/.test(r.activityFilter))))return null;
  const d=data(context),cacheKey=JSON.stringify([r.kind,r.id??r.month,r.day??null,r.activityMode??'month',r.activityFilter??'all']);
  if(queryCache.has(cacheKey))return queryCache.get(cacheKey);
  let result;
  if(r.kind==='month'){
    const start=r.month+'-01',dateValue=new Date(start+'T12:00:00Z');dateValue.setUTCMonth(dateValue.getUTCMonth()+1);dateValue.setUTCDate(0);const end=r.month+'-'+String(dateValue.getUTCDate()).padStart(2,'0');
    // The Web calendar includes imported future sessions, unlike the progress/activity providers.
    const entries=[...state.workouts.filter(w=>w.finished&&w.date>=start&&w.date<=end).map(entry=>({kind:'workout',type:'gym',entry})),
      ...(state.runs||[]).filter(r=>r.date>=start&&r.date<=end).map(entry=>({kind:'activity',type:entry.type??'run',entry}))].sort((a,b)=>a.entry.date.localeCompare(b.entry.date));
    const days=Array.from({length:dateValue.getUTCDate()},(_,i)=>{const date=r.month+'-'+String(i+1).padStart(2,'0'),rows=entries.filter(x=>x.entry.date===date);return {date,workouts:rows.filter(x=>x.kind==='workout').length,activities:rows.filter(x=>x.kind==='activity').length}});
    const rows=entries.slice(0,200).filter(x=>id(x.entry.id)).map(activityRow);
    result={month:r.month,start,end,days,entries:rows,total:entries.length,omitted:entries.length-rows.length,
      stats:stats(state.workouts.filter(w=>w.finished&&w.date>=start&&w.date<=end)),activity:activitySummary(activityStatsBetween(start,end)),
      recaps:{month:recapBetween('month',null,{start,end},d),week:recapBetween('week',null,activityPeriodRange('week',r.day??start),d)},
      activityView:activityBetween(r.activityMode??'month',null,r.activityFilter??'all',r.activityMode==='week'?activityPeriodRange('week',r.day??start):{start,end})};
  }else{
    const item=r.kind==='workout'?state.workouts.find(w=>w.id===r.id&&w.finished):r.kind==='exercise'?state.exerciseBook.find(b=>b.id===r.id):(state.runs||[]).find(x=>x.id===r.id);
    if(!item)return {kind:r.kind,ok:false,error:{code:'gone',message:'Eintrag nicht mehr vorhanden'}};
    if(r.kind==='workout')result=workoutQuery(item,d);
    if(r.kind==='exercise')result=exerciseProviders(d,()=>exerciseQuery(item));
    if(r.kind==='run')result={...activityRow({kind:'activity',type:item.type??'run',entry:item}),
      paceText:runPaceText(runPace(item)),maxSpeed:number(item.maxSpeed),elevationGain:number(item.elevationGain),elevationMax:number(item.elevationMax),
      pauseSeconds:Number.isFinite(item.pauseSeconds)?item.pauseSeconds:null,note:text(item.note),feeling:item.feeling??null,terrain:typeof item.terrain==='string'?text(item.terrain):null,
      hasRoute:!!item.route,...award(item,d.awards),navigation:{action:'runDetail',id:item.id}};
  }
  // Bound complete response bodies as well as projections. No stored history/ID is ever changed.
  const out={kind:r.kind,ok:true,result};
  let size=JSON.stringify(out).length;
  while(size>limit){
    let removed;
    if(r.kind==='month'&&result.entries.length){removed=result.entries.pop();result.omitted++}
    else if(r.kind==='month'&&result.activityView.entries.length){removed=result.activityView.entries.pop();result.activityView.omitted++}
    else if(r.kind==='exercise'&&result.history.length){removed=result.history.pop();result.omitted++}
    else if(r.kind==='exercise'&&result.points.length){removed=result.points.shift();result.pointsOmitted++}
    else if(r.kind==='month'&&[result.recaps.month,result.recaps.week].some(x=>x.muscles.length)){
      const recap=[result.recaps.month,result.recaps.week].find(x=>x.muscles.length);removed=recap.muscles.pop();recap.musclesOmitted=(recap.musclesOmitted||0)+1;
    }
    else if(r.kind==='month'&&(result.activityView.types.length||result.activityView.byType.length)){
      removed=result.activityView.types.length?result.activityView.types.pop():result.activityView.byType.pop();
      result.activityView.typesOmitted=(result.activityView.typesOmitted||0)+1;
    }
    else if(r.kind==='workout'&&result.exercises.some(e=>e.sets.length)){
      const e=result.exercises.findLast(e=>e.sets.length);removed=e.sets.pop();e.omitted++;
    }else if(r.kind==='workout'&&result.exercises.length){removed=result.exercises.pop();result.omitted++}
    else throw Error('Progress result exceeds message budget');
    size-=JSON.stringify(removed).length+1;
    if(size<=limit)size=JSON.stringify(out).length; // include changes in omitted-counter digit widths
  }
  if(queryCache.size>=8)queryCache.delete(queryCache.keys().next().value);
  queryCache.set(cacheKey,out);return out;
}
function metricExists(key,group){
  if(group==='training')return ['workouts','totalWorkouts','sets','reps','volume','totalVolume','duration','averageDuration','load','repsPerSet','density','exercises','xp','totalXP','level','wins','strength','streak'].includes(key);
  if(group==='food')return ['kcal','p','c','f','entries'].some(k=>key==='food:'+k)||Object.hasOwn({...nutrientLabels,water:[]},key.replace(/^nutrient:/,''))&&key.startsWith('nutrient:');
  if(group==='body')return ['weight','weightTrend','bmi','bodyfatEstimate'].includes(key)||key.startsWith('body:')&&Object.hasOwn(measurementFields,key.slice(5));
  if(group!=='muscles')return false;
  const match=key.match(/^muscle:(.+):(sets|volume)$/);if(!match)return false;
  return read(()=>completedWorkouts().some(w=>loggedSets(w).some(s=>(bookFor(s.exercise)?.muscles?.length?bookFor(s.exercise).muscles:['unassigned']).includes(match[1]))));
}
const ops={
  'progress.view.set':{
    check(a){
      if(!['group','range','metric'].includes(a.key)||typeof a.value!=='string'||
        (a.key==='group'?!Object.hasOwn(progressGroups,a.value):a.key==='range'?!Object.hasOwn(progressRanges,a.value):
          a.value.length>160||!metricExists(a.value,state.progressView?.group||'training'))||
        !Object.hasOwn(a,'expect')||a.expect!==null&&!plain(a.expect))return fail('invalid','Ungültige Fortschrittsansicht oder Erwartung');
      const target={...(state.progressView||{}),[a.key]:a.value};if(a.key==='group')delete target.metric;
      if(same(state.progressView??null,target))return {noop:true,target};
      return same(state.progressView??null,a.expect)?{busy:true,target}:fail('conflict','Fortschrittsansicht geändert');
    },
    run:a=>setProgressView(a.key,a.value),effective:(s,a,p)=>same(s?.progressView,p.target)
  },
  'progress.chart.set':{
    check(a){
      if(!plain(a.expect)||!Object.hasOwn(a.expect,'period')||!Object.hasOwn(a.expect,'lines')||
        !Object.hasOwn(a,'period')&&!Object.hasOwn(a,'lines')||a.period!==undefined&&!Object.hasOwn(periods19,a.period)||
        a.lines!==undefined&&(!plain(a.lines)||!['weight','strength','kcal'].every(k=>typeof a.lines[k]==='boolean')||Object.keys(a.lines).length!==3))return fail('invalid','Ungültige Kurveneinstellung');
      const target={period:a.period??state.chartPeriod??null,lines:a.lines?{...(state.chartLines||{}),...a.lines}:state.chartLines??null};
      const current={period:state.chartPeriod??null,lines:state.chartLines??null};
      if(same(current,target))return {noop:true,target};
      return same(current,a.expect)?{busy:true,target}:fail('conflict','Kurveneinstellung geändert');
    },
    run(a){if(a.period!==undefined)setChartPeriod(a.period);if(a.lines)for(const k of ['weight','strength','kcal'])if((state.chartLines?.[k]!==false)!==a.lines[k]||state.chartLines?.[k]===undefined){
      // toggleChartLine implements the Web's missing=true default; materialize true via two toggles if necessary.
      if((state.chartLines?.[k]!==false)===a.lines[k])toggleChartLine(k);toggleChartLine(k);
    }},
    effective:(s,a,p)=>same({period:s?.chartPeriod??null,lines:s?.chartLines??null},p.target)
  },
  'progress.goal.set':{
    check(a){
      if(a.weeklyGoalKm!==null&&!(typeof a.weeklyGoalKm==='number'&&Number.isFinite(a.weeklyGoalKm)&&a.weeklyGoalKm>=.1&&a.weeklyGoalKm<=1000)||
        !Number.isInteger(a.weekMinutesGoal)||a.weekMinutesGoal<0||a.weekMinutesGoal>10080||!plain(a.expect))return fail('invalid','Wochenziel außerhalb der Web-Grenzen');
      const target={weeklyGoalKm:a.weeklyGoalKm===null?null:Math.round(a.weeklyGoalKm*10)/10,weekMinutesGoal:a.weekMinutesGoal};
      if(same(goals(),target))return {noop:true,target};
      return same(goals(),a.expect)?{busy:true,target}:fail('conflict','Wochenziele geändert');
    },
    run(a){runGoalForm();const km=$('run-goal'),minutes=$('run-goal-min');if(!km||!minutes)throw Error('Wochenzielformular fehlt');
      km.value=a.weeklyGoalKm===null?'':String(a.weeklyGoalKm);minutes.value=String(a.weekMinutesGoal);saveRunGoal({preventDefault(){}})},
    effective:(s,a,p)=>same({weeklyGoalKm:s?.runSettings?.weeklyGoalKm??null,weekMinutesGoal:s?.runSettings?.weekMinutesGoal??150},p.target)
  }
};
const actions=['calendar','progress','records','reviewWorkout','editWorkout','shareWorkout','exerciseHistory','exerciseSettings','weeklyGoals','runDetail','editRun'];
function navigate(t){
  if(['calendar','progress','records'].includes(t.action)){trainTab=t.action==='progress'?'insights':t.action;go('workout');return true}
  if(t.action==='weeklyGoals'){runGoalForm();return true}
  if(!id(t.id))return false;
  if(['reviewWorkout','editWorkout','shareWorkout'].includes(t.action)){
    const w=state.workouts.find(w=>w.id===t.id&&w.finished);if(!w)return false;
    if(t.action==='editWorkout'){setDate(w.date);trainTab='current';go('workout')}
    else reviewWorkout(w.id); // Web review contains the existing Share button, preserving the browser gesture.
    return true;
  }
  if(['exerciseHistory','exerciseSettings'].includes(t.action)){
    if(!state.exerciseBook.some(b=>b.id===t.id))return false;
    if(t.action==='exerciseHistory')performanceHistory(t.id);else progressionSettings(t.id);return true;
  }
  if(!(state.runs||[]).some(r=>r.id===t.id))return false;
  if(t.action==='runDetail')runDetail(t.id);else if(t.action==='editRun')runEditForm(t.id);else return false;return true;
}
window.pulsNativeProgress={build:context=>read(()=>build(context)),query:(request,context)=>read(()=>query(request,context)),ops,actions,navigate,
  captureUi:()=>({page,tab:trainTab,modal:!!modal.open}),
  restoreUi(ui){page=ui.page;trainTab=ui.tab;if(!ui.modal&&modal.open)modal.close()}};
})();
