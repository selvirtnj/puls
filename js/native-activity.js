/* M6 / Phase A: activity UI adapter. Web owns data and calculations; RunTracker remains the only iOS recorder. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeActivity'))return;
const copy=x=>JSON.parse(JSON.stringify(x)),plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const text=x=>{const s=String(x??'');let end=Math.min(256,s.length);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1])&&/[\uDC00-\uDFFF]/.test(s[end]))end--;return s.slice(0,end)};
const same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||
  plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
const fail=(code,message)=>({code,message}),busy=plan=>({...plan,busy:true});
const fields=(a,allowed)=>plain(a)&&Object.keys(a).every(k=>allowed.includes(k));
const rounds=x=>fields(x,['work','rest','count'])&&['work','rest','count'].every(k=>Number.isInteger(x[k]))&&finite(x.work,10,3600)&&finite(x.rest,0,1800)&&finite(x.count,1,100);
const saved=id=>(state.runs||[]).find(r=>r.id===id),route=id=>(state.runRoutes||[]).find(r=>r.id===id);
const editable=r=>({type:r.type??'run',feeling:r.feeling??null,terrain:r.terrain??null,note:r.note??''});
const inputFields=['feeling','terrain','note'];
function validEdit(a){return (a.feeling===null||Number.isInteger(a.feeling)&&finite(a.feeling,1,5))&&
  (a.terrain===null||RUN_TERRAINS.some(t=>t[0]===a.terrain))&&typeof a.note==='string'&&a.note.length<=200}
function target(a){
  if(!finite(a.startedAt,0,1e15))return fail('invalid','startedAt erforderlich');
  const run=state.activeRun;
  if(!run||run.startedAt!==a.startedAt)return fail('gone','Aktivität ist nicht mehr aktiv');
  if(run.gps&&!runOwnedHere(run))return fail('conflict','Aktivität zeichnet auf einem anderen Gerät auf');
  return {run};
}
// Read-only Web helpers historically initialize these optional arrays. Keep old profiles byte-for-byte intact.
function read(fn){const keys=['runs','runRoutes'],before=keys.map(k=>[k,Object.hasOwn(state,k),state[k]]);try{return fn()}finally{for(const [k,p,v] of before)if(p)state[k]=v;else delete state[k]}}
let performing=0,after=[];
let finishingRun=null;
function perform(fn){performing++;try{return fn()}finally{performing--}}
// The constant Web $ helper resolves through getElementById. Scope only these form values synchronously,
// without opening a Web sheet or replacing the shared helper. Always restore the DOM provider, also on throw.
function inputs(values,fn){const base=document.getElementById;document.getElementById=function(key){return Object.hasOwn(values,key)?{value:values[key]}:base.call(this,key)};try{return fn()}finally{document.getElementById=base}}
function confirmed(fn){const base=globalThis.confirm;globalThis.confirm=()=>true;try{return fn()}finally{globalThis.confirm=base}}
// Suppress only activity UI created by an op; unrelated Web dialogs are checked by the transaction before running.
for(const key of ['runDetail','runRouteSheet','runRoutesSheet']){
  const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(!performing)return base.apply(this,args)};
}
const baseView=renderRunView;renderRunView=function(...args){if(performing)runView=null;return baseView.apply(this,args)};
const baseBeep=runBeep;runBeep=function(...args){if(performing){after.push(()=>baseBeep.apply(this,args));return}return baseBeep.apply(this,args)};
const baseSummary=runOpenSummary;runOpenSummary=function(run,...args){return finishingRun===run?perform(()=>baseSummary.call(this,run,...args)):baseSummary.call(this,run,...args)};
const ops={
  'run.start':{
    check(a){
      if(!fields(a,['type','routeId','rounds','expect'])||!runTypeList().some(t=>t.id===a.type)||
        a.routeId!==undefined&&a.routeId!==null&&!id(a.routeId)||a.rounds!==undefined&&(!rounds(a.rounds)||a.type!=='mma')||
        !fields(a.expect,['lastRunId'])||!Object.hasOwn(a.expect,'lastRunId')||a.expect.lastRunId!==null&&!id(a.expect.lastRunId))return fail('invalid','Art, Route, Runden oder expect.lastRunId ungültig');
      if(state.activeRun)return {noop:true,result:{startedAt:state.activeRun.startedAt,started:false}};
      if((state.runs?.at(-1)?.id??null)!==a.expect.lastRunId)return fail('conflict','Aktivitätsverlauf hat sich geändert');
      if(a.routeId&&(!runTypeInfo(a.type).gps||!route(a.routeId)))return fail('gone','Route nicht verfügbar');
      if(runCountdown)return fail('busy','Web-Countdown läuft');
      return busy({});
    },
    run(a){return perform(()=>{
      if(a.rounds&&!runSetRounds(a.rounds))throw Error('Runden ungültig');
      // Countdown is native UI. At zero (or Start now), use the exact Web Go path, including MMA signal/haptic.
      runViewType=a.type;runViewRouteId=a.routeId??null;runCountdownGo();
      if(!state.activeRun)throw Error('Aktivität nicht gestartet');
      return {startedAt:state.activeRun.startedAt,started:true};
    })},
    effective:(s,a,p,r)=>s?.activeRun?.startedAt===r?.startedAt||(s?.runs||[]).some(x=>x.startedAt===r?.startedAt)
  },
  'run.pause':{
    check(a){if(!fields(a,['startedAt','expect'])||!fields(a.expect,['pausedAt','segment'])||a.expect.pausedAt!==null||!Number.isInteger(a.expect.segment)||!finite(a.expect.segment,0,10000))return fail('invalid','expect {pausedAt:null,segment} erforderlich');
      const p=target(a);if(p.code)return p;if(p.run.pausedAt&&(p.run.segment||0)===a.expect.segment)return {noop:true,result:{startedAt:a.startedAt,pausedAt:p.run.pausedAt,segment:p.run.segment||0}};
      if(!same({pausedAt:p.run.pausedAt??null,segment:p.run.segment||0},a.expect))return fail('conflict','Pausenstand geändert');return busy(p)},
    run(a){return perform(()=>{toggleRunPause();return {startedAt:a.startedAt,pausedAt:state.activeRun.pausedAt,segment:state.activeRun.segment||0}})},
    effective:(s,a,p,r)=>s?.activeRun?.startedAt===a.startedAt&&s.activeRun.pausedAt===r.pausedAt&&(s.activeRun.segment||0)===r.segment
  },
  'run.resume':{
    check(a){if(!fields(a,['startedAt','expect'])||!fields(a.expect,['pausedAt','segment'])||!finite(a.expect.pausedAt,1,1e15)||!Number.isInteger(a.expect.segment)||!finite(a.expect.segment,0,9999))return fail('invalid','expect {pausedAt,segment} erforderlich');
      const p=target(a);if(p.code)return p;
      if(!p.run.pausedAt&&(p.run.segment||0)===a.expect.segment+1)return {noop:true,result:{startedAt:a.startedAt,pausedAt:null,segment:p.run.segment}};
      if(!same({pausedAt:p.run.pausedAt??null,segment:p.run.segment||0},a.expect))return fail('conflict','Pausenstand geändert');
      if((p.run.segment||0)>=10000)return fail('invalid','Abschnittslimit erreicht');return busy(p)},
    run(a){return perform(()=>{runSummary=null;runView='live';toggleRunPause();return {startedAt:a.startedAt,pausedAt:null,segment:state.activeRun.segment||0}})},
    effective:(s,a,p,r)=>s?.activeRun?.startedAt===a.startedAt&&!s.activeRun.pausedAt&&(s.activeRun.segment||0)===r.segment
  },
  'run.lap':{
    check(a){if(!fields(a,['startedAt','expect'])||!fields(a.expect,['laps'])||!Array.isArray(a.expect.laps)||a.expect.laps.length>1000||a.expect.laps.some((x,i)=>!finite(x,1,172800)||i>0&&x<=a.expect.laps[i-1]))return fail('invalid','expect.laps erforderlich');
      const p=target(a);if(p.code)return p;const laps=p.run.laps||[];
      // Web offers laps only in GPS live views (recording device) and MMA "next round"; plain timers have no lap button.
      if(!p.run.gps&&p.run.type!=='mma')return fail('invalid','Runden nur bei GPS-Aktivitäten und MMA');
      if(laps.length===a.expect.laps.length+1&&same(laps.slice(0,-1),a.expect.laps))return {noop:true,result:{lap: laps.at(-1)}};
      if(!same(laps,a.expect.laps))return fail('conflict','Runden geändert');
      const seconds=runElapsed(p.run);if(p.run.pausedAt||runLocked||seconds<=0||seconds>172800||laps.length>=1000||seconds<=(laps.at(-1)||0)||p.run.type==='mma'&&runMmaState(p.run).phase==='done')return fail('gone','Runde derzeit nicht möglich');return busy(p)},
    run(){return perform(()=>{const n=state.activeRun.laps?.length||0;runLiveLap();if(state.activeRun.laps?.length!==n+1)throw Error('Runde nicht markiert');return {lap:state.activeRun.laps.at(-1)}})},
    effective:(s,a,p,r)=>s?.activeRun?.startedAt===a.startedAt&&same(s.activeRun.laps,[...a.expect.laps,r.lap])
  },
  'run.finish':{
    check(a){if(!fields(a,['startedAt']))return fail('invalid','Nur startedAt erlaubt');const p=target(a);return p.code?p:busy(p)},
    // Preparation deliberately uses the Web finish path: it pauses/saves, stops GPS without clearing, and drains.
    // A failed drain keeps that pause and every local point, just like the Web Finish button; no successful ack.
    async prepare(a){const run=state.activeRun;let pausedAt;finishingRun=run;try{const pending=perform(()=>finishRunTimer());pausedAt=run.pausedAt;await pending}finally{finishingRun=null}
      if(state.activeRun!==run)return fail('gone','Aktivität während GPS-Abschluss geändert');
      if(!pausedAt||run.pausedAt!==pausedAt)return fail('conflict','Aktivität während GPS-Abschluss fortgesetzt');
      if(!runSummary||runSummary.key!==a.startedAt)return fail('busy','GPS-Daten kommen noch');
      return {}},
    run(a){if(!runSummary||runSummary.key!==a.startedAt||!state.activeRun.pausedAt)throw Error('Zusammenfassung fehlt');return {startedAt:a.startedAt,pausedAt:state.activeRun.pausedAt}},
    effective:(s,a,p,r)=>s?.activeRun?.startedAt===a.startedAt&&s.activeRun.pausedAt===r.pausedAt
  },
  'run.summary.save':{
    check(a){
      if(!fields(a,['startedAt','pausedAt',...inputFields,'manualKm'])||!finite(a.startedAt,0,1e15)||!finite(a.pausedAt,0,1e15)||!validEdit(a)||
        a.manualKm!==undefined&&a.manualKm!==''&&!finite(a.manualKm,0,1000))return fail('invalid','Zusammenfassung ungültig');
      const existing=(state.runs||[]).find(r=>r.startedAt===a.startedAt);
      if(existing){const wanted={type:existing.type??'run',feeling:a.feeling,terrain:a.terrain,note:a.note.trim()};
        if(!same(editable(existing),wanted)||a.manualKm!==undefined&&a.manualKm!==''&&existing.distanceKm!==Math.round(a.manualKm*100)/100)return fail('conflict','Gespeicherte Aktivität geändert');
        return {noop:true,result:{runId:existing.id,startedAt:a.startedAt}}}
      const p=target(a);if(p.code)return p;
      if(p.run.pausedAt!==a.pausedAt)return fail('conflict','Aktivität inzwischen fortgesetzt');
      if(!runSummary||runSummary.key!==a.startedAt||runSummary.moving!==Math.max(1,runElapsed(p.run)))return fail('gone','Bitte erneut Beenden wählen');
      if(a.manualKm!==undefined&&a.manualKm!==''&&(!p.run.gps||runSummary.km>=.01))return fail('invalid','Ersatzdistanz nur bei GPS ohne Strecke');
      // Durations above 48 h are clamped by runSummarySave exactly as in the Web; only an impossible distance is rejected.
      if(runSummary.km>1000)return fail('invalid','Web-Distanzlimit überschritten');
      return busy(p);
    },
    run(a){return perform(()=>{
      Object.assign(runSummary,{feeling:a.feeling,terrain:a.terrain,note:a.note,manualKm:a.manualKm??''});
      inputs({'runsum-note':a.note,'runsum-km':a.manualKm??''},()=>runSummarySave());
      const r=(state.runs||[]).find(r=>r.startedAt===a.startedAt);if(!r)throw Error('Nicht gespeichert');return {runId:r.id,startedAt:a.startedAt};
    })},
    effective:(s,a,p,r)=>(s?.runs||[]).some(x=>x.id===r?.runId&&x.startedAt===a.startedAt)&&s?.activeRun?.startedAt!==a.startedAt
  },
  'run.discard':{
    check(a){if(!fields(a,['startedAt'])||!finite(a.startedAt,0,1e15))return fail('invalid','startedAt erforderlich');
      if((state.runs||[]).some(r=>r.startedAt===a.startedAt))return fail('gone','Aktivität bereits gespeichert');
      if(state.activeRun?.startedAt!==a.startedAt)return {noop:true};const p=target(a);return p.code?p:busy(p)},
    run(){return perform(()=>{confirmed(()=>runSummaryDiscard());if(state.activeRun)throw Error('Nicht verworfen')})},
    effective:(s,a)=>s?.activeRun?.startedAt!==a.startedAt
  },
  'run.edit':{
    check(a){if(!fields(a,['id','type',...inputFields,'expect'])||!id(a.id)||!validEdit(a)||!fields(a.expect,['type',...inputFields])||!validEdit(a.expect)||typeof a.expect.type!=='string')return fail('invalid','Bearbeitung oder expect ungültig');
      const r=saved(a.id);if(!r)return fail('gone','Aktivität fehlt');
      if(!runTypeList().some(t=>t.id===a.type)&&a.type!==(r.type??'run'))return fail('invalid','Aktivitätsart nicht auswählbar');
      const next={type:a.type,feeling:a.feeling,terrain:a.terrain,note:a.note.trim()};
      if(same(editable(r),next))return {noop:true,next};if(!same(editable(r),a.expect))return fail('conflict','Aktivität geändert');return busy({next})},
    run(a){return perform(()=>inputs({'runedit-type':a.type,'runedit-feel':a.feeling??'','runedit-terrain':a.terrain??'','runedit-note':a.note},()=>runEditSave({preventDefault(){}},a.id)))},
    effective:(s,a,p)=>!!s?.runs?.some(r=>r.id===a.id&&same(editable(r),p.next))
  },
  // Same entry as the Web edit form's "Delete activity" (deleteRun). expect = editExpect from the run query/snapshot.
  'run.delete':{
    check(a){if(!fields(a,['id','expect'])||!id(a.id)||!fields(a.expect,['type',...inputFields])||!validEdit(a.expect)||typeof a.expect.type!=='string')return fail('invalid','ID und expect erforderlich');
      const r=saved(a.id);if(!r)return {noop:true};if(!same(editable(r),a.expect))return fail('conflict','Aktivität geändert');return busy({})},
    run(a){return perform(()=>{confirmed(()=>deleteRun(a.id));if(saved(a.id))throw Error('Nicht gelöscht')})},
    effective:(s,a)=>!(s?.runs||[]).some(r=>r.id===a.id)
  },
  'runSettings.set':{
    check(a){if(!fields(a,['lastType','rounds','expect'])||a.lastType===undefined&&a.rounds===undefined||a.lastType!==undefined&&!runTypeList().some(t=>t.id===a.lastType)||
      a.rounds!==undefined&&!rounds(a.rounds)||!Object.hasOwn(a,'expect')||a.expect!==null&&!plain(a.expect))return fail('invalid','Einstellungen ungültig');
      const current=state.runSettings??null,next={...(a.expect||{}),...(a.lastType===undefined?{}:{lastType:a.lastType}),...(a.rounds===undefined?{}:{rounds:a.rounds})};
      if(same(current,next))return {noop:true,next};if(!same(current,a.expect))return fail('conflict','Einstellungen geändert');return busy({next})},
    run(a){return perform(()=>{if(a.lastType!==undefined)runChooseType(a.lastType);if(a.rounds&&!runSetRounds(a.rounds))throw Error('Runden ungültig')})},
    effective:(s,a,p)=>same(s?.runSettings,p.next)
  },
  'route.save':{
    check(a){
      if(!fields(a,['route','expect'])||!fields(a.route,['id','name','line','waypoints','distanceKm','ascentM'])||!id(a.route.id)||typeof a.route.name!=='string'||!a.route.name.trim()||a.route.name.trim().length>60||
        !coordinates(a.route.line,800)||!coordinates(a.route.waypoints,60)||!finite(a.route.distanceKm,0,1000)||a.route.ascentM!==undefined&&!finite(a.route.ascentM,0,100000)||
        !Object.hasOwn(a,'expect')||a.expect!==null&&!plain(a.expect))return fail('invalid','Route ungültig');
      const current=route(a.route.id)??null;
      const next={...(a.expect||{}),id:a.route.id,name:a.route.name.trim(),line:runLineString(a.route.line),waypoints:runLineString(a.route.waypoints),distanceKm:Math.round(a.route.distanceKm*100)/100};
      if(a.route.ascentM!==undefined)next.ascentM=Math.round(a.route.ascentM);else delete next.ascentM;
      if(current&&same({...current,createdAt:null},{...next,createdAt:null}))return {noop:true,next:current,result:{routeId:current.id}};
      if(!same(current,a.expect))return fail('conflict','Route geändert');if(!current&&(state.runRoutes?.length||0)>=200)return fail('invalid','Höchstens 200 Routen');
      return busy({next});
    },
    run(a,p){return perform(()=>{
      const previous=runPlan;
      // Same creation as runPlannerSave, with a stable caller ID so replay without applied-history cannot duplicate.
      if(!route(a.route.id))runRouteList().push({id:a.route.id,createdAt:Date.now()});
      try{runPlan={id:a.route.id,line:a.route.line,waypoints:a.route.waypoints,distanceKm:a.route.distanceKm,ascentM:a.route.ascentM,busy:false};
        inputs({'runplan-name':a.route.name},()=>runPlannerSave({preventDefault(){}}));
      }finally{runPlan=previous}
      const r=route(a.route.id);if(!r)throw Error('Route nicht gespeichert');p.next=copy(r);return {routeId:r.id};
    })},
    effective:(s,a,p)=>s?.runRoutes?.some(r=>r.id===a.route.id&&same(r,p.next))===true
  },
  'route.delete':{
    check(a){if(!fields(a,['id','expect'])||!id(a.id)||!Object.hasOwn(a,'expect')||a.expect!==null&&!plain(a.expect))return fail('invalid','Route und expect erforderlich');
      const current=route(a.id);if(!current)return {noop:true};if(!same(current,a.expect))return fail('conflict','Route geändert');return busy({})},
    run(a){return perform(()=>confirmed(()=>runDeleteRoute(a.id)))},effective:(s,a)=>!(s?.runRoutes||[]).some(r=>r.id===a.id)
  }
};
function coordinates(x,max){return Array.isArray(x)&&x.length>=2&&x.length<=max&&x.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0],-90,90)&&finite(p[1],-180,180))}
// A Web "Resume" keeps its old runSummary in memory; only a summary of the current pause is a valid draft basis.
const currentSummary=()=>!!runSummary&&state.activeRun?.startedAt===runSummary.key&&!!state.activeRun.pausedAt&&runSummary.moving===Math.max(1,runElapsed(state.activeRun));
function summary(details=false){return currentSummary()?copy({...runSummary,elev:runSummary.elev??null,maxSpeed:runSummary.maxSpeed??null,kcal:runSummary.kcal??null,
  manualDistanceAllowed:!!state.activeRun.gps&&runSummary.km<.01,...(details?{route:runPendingRoute,splits:runPendingSplits?.splits??[],splitRest:runPendingSplits?.restMeters?[runPendingSplits.restMeters,runPendingSplits.restSeconds]:null,laps:state.activeRun.laps??[]}: {})}):null}
function compact(r){return {id:r.id,date:r.date,type:r.type??'run',name:text(runTypeName(runTypeInfo(r.type))),startedAt:r.startedAt??null,distanceKm:r.distanceKm,durationSeconds:r.durationSeconds,
  paceText:runPaceText(runPace(r)),kcal:Number.isFinite(r.kcal)?r.kcal:null,hasRoute:!!r.route}}
function build(){return read(()=>{
  const run=state.activeRun,types=runTypeList().map(t=>({id:t.id,label:text(runTypeName(t)),icon:t.icon,gps:t.gps,category:t.category}));let active=null;
  if(run){const own=runOwnedHere(run),elapsed=runElapsed(run),km=run.gps&&own?runGpsKm():null,planned=route(run.routeId),data=run.gps&&own||!run.gps?runLiveData(run):null;
    if(data)delete data._round; // internal render helper; the same values are in active.mma
    active={startedAt:run.startedAt,paused:!!run.pausedAt,pausedAt:run.pausedAt??null,pausedSeconds:run.pausedSeconds||0,segment:run.segment||0,segmentStartedAt:run.segmentStartedAt??null,
      type:run.type??'run',gps:!!run.gps,recordingDevice:own,controlsEnabled:!run.gps||own,locked:!!runLocked,laps:[...(run.laps||[])],rounds:run.rounds??null,
      mma:run.type==='mma'?{...runMmaState(run,elapsed),elapsedSeconds:elapsed,observedAt:Date.now()}:null,
      routeId:run.routeId??null,routeProgress:planned?{distanceKm:km,routeKm:planned.distanceKm,fraction:km===null||!(planned.distanceKm>0)?null:Math.min(1,km/planned.distanceKm)}:null,
      distanceKm:km===null?null:Math.round(km*100)/100,paceText:data?.avgpace??null,currentPaceText:data?.pace??null,values:data,gpsLabel:run.gps?text(runGpsLabel()):null,
      elapsedSeconds:elapsed,observedAt:Date.now(),durationLimitSeconds:172800};
  }
  const routes=(state.runRoutes||[]).map(r=>({id:r.id,name:text(r.name),distanceKm:r.distanceKm,ascentM:r.ascentM??null,editable:!!r.waypoints}));
  const recent=(state.runs||[]).slice(-20).reverse().map(compact);
  const model={language:state.language==='en'?'en':'de',locale:appLocale(),today:today(),types,settings:{lastType:state.runSettings?.lastType??'run',rounds:runRoundsSettings(),countdownSeconds:10},active,summary:summary(),
    routes,recent,omitted:{routes:0,recent:Math.max(0,(state.runs?.length||0)-recent.length)},navigation:{start:{action:'activity'},routes:{action:'activityRoutes'},planner:{action:'routePlanner'}},    // Same free routing service/parameters as run-map.js runPlannerRoute (no key); typical pace from runTypicalPace().
    planner:{provider:'brouter',url:'https://brouter.de/brouter',profile:'hiking-mountain',maxWaypoints:60,maxLinePoints:800,typicalPaceSeconds:runTypicalPace(),native:true}};
  // Bound small lists, never truncate active laps/time bases or the summary.
  while(JSON.stringify(model).length>48*1024){const key=model.recent.length?'recent':model.routes.length?'routes':null;if(!key)throw Error('Aktivität zu groß');model[key].pop();model.omitted[key]++}
  return model;
})}
function query(q){
  if(!fields(q,['requestId','kind','id'])||!['run','route','summary'].includes(q.kind)||q.kind!=='summary'&&!id(q.id)||q.kind==='summary'&&q.id!==undefined)return null;
  let result;
  if(q.kind==='summary')result=read(()=>summary(true));
  if(q.kind==='route'){const r=route(q.id);result=r?{id:r.id,name:text(r.name),line:r.line,waypoints:r.waypoints??null,distanceKm:r.distanceKm,ascentM:r.ascentM??null,createdAt:r.createdAt??null}:null}
  if(q.kind==='run'){const r=saved(q.id);result=r?{...compact(r),...editable(r),route:r.route??null,laps:r.laps??[],splits:r.splits??[],splitRest:r.splitRest??null,pauseSeconds:r.pauseSeconds??null,
    maxSpeed:r.maxSpeed??null,elevationGain:r.elevationGain??null,elevationMax:r.elevationMax??null,navigation:{action:'runDetail',id:r.id},editExpect:editable(r)}:null}
  return result?{kind:q.kind,ok:true,result}:{kind:q.kind,ok:false,error:{code:'gone',message:'Detail nicht verfügbar'}};
}
const actions=['activity','activityRoutes','routePlanner','runDetail','editRun'];
function navigate(t){
  if(t.action==='activity'){openRunView();return true}
  if(t.action==='activityRoutes'){runRoutesSheet();return true}
  if(t.action==='routePlanner'){if(t.id!==undefined&&(!id(t.id)||!route(t.id)?.waypoints))return false;runPlanner(t.id??null);return true}
  if(!id(t.id)||!saved(t.id))return false;
  if(t.action==='runDetail')runDetail(t.id);else if(t.action==='editRun')runEditForm(t.id);else return false;return true;
}
// Only activity-owned local keys; never inspect auth storage or another profile.
const localKeys=['puls-run-device','puls-run-track','puls-run-ended','puls-run-summary'];
function captureUi(){return {view:runView,type:runViewType,route:runViewRouteId,summary:runSummary?copy(runSummary):null,track:runTrack?copy(runTrack):null,pendingRoute:runPendingRoute,pendingSplits:runPendingSplits,
  owned:runOwnedKey,started:runNativeStarted,total:runNativeTotal,ended:runActivityEndedKey,sent:runActivitySent,at:runActivityAt,gps:runGpsState,accuracy:runGpsAccuracy,signal:runRoundSignal,locked:runLocked,
  done:activityDoneId,local:localKeys.map(k=>[k,localStorage.getItem(k)])}}
function restoreUi(v){runView=v.view;runViewType=v.type;runViewRouteId=v.route;runSummary=v.summary;runTrack=v.track;runPendingRoute=v.pendingRoute;runPendingSplits=v.pendingSplits;
  runOwnedKey=v.owned;runNativeStarted=v.started;runNativeTotal=v.total;runActivityEndedKey=v.ended;runActivitySent=v.sent;runActivityAt=v.at;runGpsState=v.gps;runGpsAccuracy=v.accuracy;runRoundSignal=v.signal;runLocked=v.locked;activityDoneId=v.done;
  for(const [k,x] of v.local)try{if(x===null)localStorage.removeItem(k);else localStorage.setItem(k,x)}catch{}after=[]}
function settled(ok){const callbacks=after;after=[];if(ok)for(const fn of callbacks)try{fn()}catch{}}
function inputKey(){const r=state.activeRun,mma=r?.type==='mma'?runMmaState(r):null;return [r,r?.startedAt,r?.pausedAt,r?.pausedSeconds,r?.segment,r?.laps?.length,runSummary,runLocked,mma?.round,mma?.phase,
  // Running clocks are native; these buckets only refresh Web estimates (current pace 10 s, kcal of timers 30 s), never while paused.
  r?.gps&&runOwnedHere(r)?runTrackFor(r)?.points.length:null,r&&!r.pausedAt?Math.floor(Date.now()/(r.gps?10000:30000)):null,runGpsState,runGpsAccuracy]}
window.pulsNativeActivity={ops,build,query,actions,navigate,captureUi,restoreUi,settled,inputKey};
})();
