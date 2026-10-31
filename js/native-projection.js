/* Read-only display adapter. All planning, totals and training metrics remain Web-owned. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||
  !Array.isArray(window.pulsNativeFeatures)||!window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeOverview'))return;
// n() uses Intl with maximumFractionDigits:1. Intl rounding also matters for negative deltas.
const decimal=value=>Number.isFinite(value)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1}).format(value)):null;
const integer=value=>Number.isFinite(value)?Math.round(value):null;
const text=value=>{const valueString=String(value??'');let end=Math.min(256,valueString.length);if(end<valueString.length&&/[\uD800-\uDBFF]/.test(valueString[end-1])&&/[\uDC00-\uDFFF]/.test(valueString[end]))end--;return valueString.slice(0,end)};
// Never shorten an ID into another actionable ID. Pathological legacy IDs are omitted from this view only.
const identifiable=value=>value&&typeof value.id==='string'&&value.id.length<=256;
const routine=value=>identifiable(value)?{id:value.id,name:text(value.name),exerciseCount:(value.exercises||[]).length}:null;
const workout=value=>identifiable(value)?{id:value.id,name:text(value.name||'Workout'),date:value.date,routineId:typeof value.routineId==='string'&&value.routineId.length<=256?value.routineId:null}:null;
let cachedChart=null,chartKey=null,chartState=null,chartRefs=[];
window.pulsNativeBuildOverview=function(context){
  const day=today(),goals=dsDayGoals(),eaten=totals(),energy=dsEnergyFacts(eaten,goals),nt=nutrientTotals(),refs=referenceMicros();
  const foods=state.foods.filter(x=>x.date===date),active=activeWorkout(),recommendation=routineRecommendation();
  const key=context?JSON.stringify([context.seq,context.revision,day,state.chartPeriod]):null,chartInputs=[state.foods,state.weights,state.workouts];
  if(!key||key!==chartKey||state!==chartState||chartInputs.some((value,index)=>value!==chartRefs[index])){
    cachedChart={weeks:weeklyWeights(),trend:weightTrend().at(-1),rows:trendData()};chartKey=key;chartState=state;chartRefs=chartInputs;
  }
  const {weeks,trend,rows}=cachedChart,latest=[...state.weights].filter(x=>x.date<=day).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const week=activityPeriodStats('week'),range=runWeekRange(),run=state.activeRun,elapsed=run?runElapsed():null;
  const micros=Object.fromEntries(Object.entries(nutrientLabels).map(([key,[,unit]])=>{
    const target=state.microGoals?.[key]||refs?.[key]||null,known=nt.coverage[key]||0;
    return [key,{labelKey:'nutrient.'+key,unit,value:known?decimal(round(nt.totals[key])):null,known,total:nt.count,
      target:target===null?null:decimal(target),targetSource:state.microGoals?.[key]?'custom':refs?.[key]?'reference':null}];
  }));
  const overview={
    date,today:day,isToday:date===day,language:state.language==='en'?'en':'de',locale:appLocale(),
    colorScheme:typeof dsCurrentScheme==='function'?dsCurrentScheme():'system',
    connectivity:{online:typeof window.pulsConnectivity?.online==='boolean'?window.pulsConnectivity.online:null},
    page,tabs:dsTabs.map(([id,icon])=>({id,icon,labelKey:'tab.'+id})),
    goals:{values:Object.fromEntries(['kcal','p','c','f'].map(key=>[key,key==='kcal'?integer(goals[key]):decimal(goals[key])])),
      mode:state.plan?.mode||'manual',macroMode:state.plan?.macroMode||'manual',calorieMode:state.profile?.kcalMode||'classic',
      source:goals===state.goals?'state.goals':'dayGoals'},
    eaten:Object.fromEntries(['kcal','p','c','f'].map(key=>[key,integer(eaten[key])])),
    remaining:Object.fromEntries(['kcal','p','c','f'].map(key=>[key,integer(goals[key]-eaten[key])])),
    energy:{hasGoal:energy.goal>0,over:energy.over,percent:energy.percent,
      displayValue:integer(energy.goal>0?Math.abs(energy.goal-energy.eaten):energy.eaten),
      captionKey:energy.goal>0?(energy.over?'energy.over':'energy.left'):'energy.noGoal'},
    macros:Object.fromEntries(['p','c','f'].map(key=>[key,{over:goals[key]>0&&eaten[key]>goals[key],
      percent:goals[key]>0?Math.min(100,eaten[key]/goals[key]*100):0}])),
    micros,
    water:{value:nt.coverage.water?integer(nt.totals.water):null,displayValue:integer(nt.totals.water),
      known:nt.coverage.water||0,total:nt.count,target:state.waterGoal?decimal(state.waterGoal):null,
      estimated:integer(nt.estimatedWater||0),unknownDrinks:nt.unknownDrinks||0},
    food:{total:foods.length,entries:foods.slice(-200).filter(identifiable).reverse().map(x=>({id:x.id,name:text(x.name),
      amount:decimal(x.grams),unit:x.unit==='ml'?'ml':'g',kcal:integer(x.kcal),meal:text(x.meal)})),
      previewIds:foods.slice(-5).filter(identifiable).reverse().map(x=>x.id),omitted:0,complete:!!state.foodLogCompleted?.includes(date)},
    training:{activeWorkout:workout(active),activeRun:run?{type:text(run.type||'run'),elapsedSeconds:elapsed,
        paused:run.pausedAt!=null,clock:typeof formatClock==='function'?formatClock(elapsed):null}:null,
      routines:(state.routines||[]).slice(0,3).map(routine).filter(Boolean),routineCount:(state.routines||[]).length,
      lastWorkout:workout(recommendation.last),nextRoutine:routine(recommendation.next),
      week:{start:week.start,end:week.end,sessions:week.count,workouts:week.entries.filter(x=>x.kind==='workout').length,
        activities:week.entries.filter(x=>x.kind==='activity').length,activeMinutes:Math.floor(activeMinutesWeek()),
        minutesGoal:activeMinutesGoal(),runKm:decimal(Math.round((Array.isArray(state.runs)?runKmBetween(range.start,range.end):0)*10)/10)}},
    weight:{current:latest?{id:typeof latest.id==='string'&&latest.id.length<=256?latest.id:null,date:latest.date,kg:decimal(latest.kg)}:null,
      trend:trend?{date:trend.date,kg:decimal(Math.round(trend.trend*10)/10)}:null,
      weeklyMean:weeks[0]?{start:weeks[0].day,kg:decimal(round(weeks[0].kg)),count:weeks[0].count}:null,
      weeklyChange:weeks.length>1?{kg:decimal(round(weeks[0].kg-weeks[1].kg)),from:weeks[1].day,to:weeks[0].day}:null},
    // Raw series from the actual chart provider; native must not reimplement the Web's index chart in M3.
    progress:{period:state.chartPeriod||'month',lines:Object.fromEntries(['weight','strength','kcal'].map(key=>[key,state.chartLines?.[key]!==false])),
      rows:rows.slice(-400).map(x=>({date:x.date,weight:decimal(x.weight),strength:decimal(x.strength),kcal:integer(x.kcal)})),
      total:rows.length,omitted:Math.max(0,rows.length-400),navigation:{page:'home',web:true}},
    actions:{addFood:{action:'addFood'},diary:{page:'food'},routines:{action:'routines'},
      startWorkout:{action:'startWorkout'},addWeight:{action:'addWeight'},quickAdd:{action:'quickAdd'}}
  };
  // At most 200 compact foods, 400 chart days, 3 routines and 256-code-unit names. Also enforce a hard
  // 48 Ki code-unit limit (<=144 KiB UTF-8), dropping oldest detail rows, never totals or stored data.
  overview.food.omitted=foods.length-overview.food.entries.length;
  while(JSON.stringify(overview).length>48*1024){
    if(overview.progress.rows.length){overview.progress.rows.shift();overview.progress.omitted++}
    else if(overview.food.entries.length){overview.food.entries.pop();overview.food.omitted++}
    else throw Error('Overview exceeds message budget');
  }
  const included=new Set(overview.food.entries.map(x=>x.id));
  overview.food.previewIds=overview.food.previewIds.filter(id=>included.has(id));
  return overview;
};
})();
