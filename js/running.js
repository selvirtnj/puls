/* Laufen: Läufe manuell eintragen oder mit Timer erfassen (optional mit GPS), Wochenziel in km,
   Anzeige in Workout-Tab, Kalender, Fortschritt und Übersicht. Läufe halten die Trainingsserie
   und geben 25 XP bei persönlicher Bestleistung (weiter bei mindestens gleicher Pace oder schneller
   bei mindestens gleicher Distanz als alle bisherigen Läufe). Daten: state.runs, state.activeRun,
   state.runSettings; alle optional, alte Sicherungen bleiben gültig. */

const runText=(de,en)=>state.language==='en'?en:de;
function runList(){if(!Array.isArray(state.runs))state.runs=[];return state.runs}
function runKm(x){return new Intl.NumberFormat(appLocale(),{maximumFractionDigits:2}).format(x)}
function runPace(r){return r.durationSeconds/r.distanceKm}
function runPaceText(seconds){if(!(Number.isFinite(seconds)&&seconds>0))return '–';let total=Math.round(seconds);return Math.floor(total/60)+':'+String(total%60).padStart(2,'0')+' /km'}
function runGoalKm(){let goal=state.runSettings?.weeklyGoalKm;return typeof goal==='number'&&goal>0?goal:null}
function pastRuns(){let now=today();return runList().map((r,i)=>({r,i})).filter(x=>x.r.date<=now).sort((a,b)=>a.r.date.localeCompare(b.r.date)||(a.r.createdAt||a.i)-(b.r.createdAt||b.i)).map(x=>x.r)}
// Laufen im engeren Sinn (Laufen, Trailrun): Wochenziel, Bestzeiten, XP. Andere Aktivitäten zählen für die Serie.
function runIsRun(r){let type=r?.type??'run';return typeof runActivityType==='function'?runActivityType(type).category==='run':type==='run'||type==='trail'}
function runTypeUsesGps(type){return typeof runActivityType==='function'?runActivityType(type).gps:['run','trail','walk','hike','mountain','ride','inline'].includes(type??'run')}
function runKmBetween(start,end){return runList().filter(r=>runIsRun(r)&&r.date>=start&&r.date<=end).reduce((a,r)=>a+r.distanceKm,0)}
function runWeekRange(offset=0){let d=new Date(weekStart(today())+'T12:00:00');d.setDate(d.getDate()+offset*7);let start=localISO(d);d.setDate(d.getDate()+6);return {start,end:localISO(d)}}
function runElapsed(run=state.activeRun){if(!run)return 0;return Math.max(0,Math.floor(((run.pausedAt??Date.now())-run.startedAt)/1000-(run.pausedSeconds||0)))}
// MMA settings: work/rest in seconds, count rounds. Laps are cumulative active
// seconds (manual splits), separate from kilometre splits and round phase.
function runRoundsSettings(){return {...{work:180,rest:60,count:5},...state.runSettings?.rounds}}
function runSetRounds(rounds){
  if(!rounds||!Number.isInteger(rounds.work)||rounds.work<10||rounds.work>3600||!Number.isInteger(rounds.rest)||rounds.rest<0||rounds.rest>1800||!Number.isInteger(rounds.count)||rounds.count<1||rounds.count>100)return false;
  state.runSettings={...state.runSettings,rounds:{work:rounds.work,rest:rounds.rest,count:rounds.count}};save();return true;
}
function runRoundState(run=state.activeRun,elapsed=runElapsed(run)){
  let settings=run?.rounds??runRoundsSettings(),{work,rest,count}=settings,total=work*count+rest*(count-1),seconds=Math.max(0,elapsed),cycle=work+rest,index=Math.min(count-1,Math.floor(seconds/cycle)),within=seconds-index*cycle,done=seconds>=total;
  return {round:index+1,count,phase:done?'done':within<work?'work':'rest',remainingSeconds:done?0:Math.ceil((within<work?work:cycle)-within),totalSeconds:total};
}
function runAddLap(){let run=state.activeRun,seconds=runElapsed(run);if(!run||seconds<=0||seconds>172800||(run.laps?.length||0)>=1000||seconds<=(run.laps?.at(-1)||0))return null;(run.laps??=[]).push(seconds);save();return seconds}

// Bestleistung: kein bisheriger Lauf war mindestens genauso weit und mindestens genauso schnell.
function runAwards(){let previous=[],awards={};for(let r of pastRuns().filter(x=>runIsRun(x)&&x.distanceKm>0)){let pace=runPace(r),best=r.distanceKm>=1&&previous.length&&!previous.some(p=>p.distanceKm>=r.distanceKm&&runPace(p)<=pace);awards[r.id]={xp:best?25:0,wins:best?[runText('Lauf','Run')+' · '+runKm(r.distanceKm)+' km']:[],run:true};previous.push(r)}return awards}
const runningAwardsBase=workoutAwards;workoutAwards=function(...args){let awards=Object.assign(runAwards(),runningAwardsBase.apply(this,args));if(typeof activityDurationAwards==='function')for(let [id,a] of Object.entries(activityDurationAwards())){let old=awards[id]||{xp:0,wins:[],run:a.run};awards[id]={...old,xp:old.xp+a.xp,durationXp:a.xp}}return awards};

// Trainingsserie: Lauftage zählen wie Trainingstage (drei volle Tage Pause unterbrechen weiterhin).
const runningDailyStreakBase=dailyWorkoutStreak;dailyWorkoutStreak=function(...args){
  let runs=pastRuns();if(!runs.length)return runningDailyStreakBase.apply(this,args);
  let days=[...new Set([...completedWorkouts().filter(w=>loggedSets(w).length).map(w=>w.date),...runs.map(r=>r.date)])].sort().reverse();
  const serial=value=>{let [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000};
  if(serial(today())-serial(days[0])>=4)return 0;let count=1;for(let i=1;i<days.length;i++){if(serial(days[i-1])-serial(days[i])>=4)break;count++}return count;
};
const runningWeekStreakBase=trainingStreak;trainingStreak=function(...args){
  let runs=pastRuns();if(!runs.length)return runningWeekStreakBase.apply(this,args);
  let weeks=new Set([...completedWorkouts().map(w=>weekStart(w.date)),...runs.map(r=>weekStart(r.date))]),d=new Date(weekStart(today())+'T12:00:00');
  if(!weeks.has(localISO(d)))d.setDate(d.getDate()-7);let count=0;while(weeks.has(localISO(d))){count++;d.setDate(d.getDate()-7)}return count;
};

// Persistenz: neue Felder optional und streng geprüft.
const runningValid=validData;validData=function(s){
  if(!runningValid(s))return false;
  const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max,day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x),opt=(x,ok)=>x===undefined||ok(x),typeId=x=>typeof x==='string'&&/^[a-z]{2,20}$/.test(x);
  // laps: strictly increasing cumulative ACTIVE elapsed seconds (not epoch times),
  // <= entry duration. Independent of GPS kilometre splits; old missing fields valid.
  const laps=(x,max=172800)=>Array.isArray(x)&&x.length<=1000&&x.every((t,i)=>finite(t,0,max)&&t>0&&(i===0||t>x[i-1]));
  const rounds=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Number.isInteger(x.work)&&finite(x.work,10,3600)&&Number.isInteger(x.rest)&&finite(x.rest,0,1800)&&Number.isInteger(x.count)&&finite(x.count,1,100);
  const marker=x=>x===1;
  const profileOk=p=>!p||(opt(p.kcalMode,x=>['classic','baseline'].includes(x))&&opt(p.baselineFactor,x=>[1.2,1.3,1.4].includes(x)));
  if(!profileOk(s.profile)||!(s.profileHistory||[]).every(profileOk)||!(s.workouts||[]).every(w=>opt(w.durationXpVersion,marker)))return false;
  let runsOk=s.runs===undefined||(Array.isArray(s.runs)&&s.runs.every(r=>r&&typeof r.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(r.id)&&day(r.date)&&finite(r.distanceKm,0,1000)&&finite(r.durationSeconds,1,172800)&&opt(r.type,typeId)&&opt(r.startedAt,x=>finite(x,0,1e15))&&opt(r.pauseSeconds,x=>finite(x,0,172800))&&opt(r.kcal,x=>Number.isInteger(x)&&finite(x,0,20000))&&opt(r.feeling,x=>Number.isInteger(x)&&finite(x,1,5))&&opt(r.terrain,typeId)&&opt(r.elevationGain,x=>finite(x,0,20000))&&opt(r.elevationMax,x=>finite(x,-500,9000))&&opt(r.maxSpeed,x=>finite(x,0,150))&&(r.note===undefined||(typeof r.note==='string'&&r.note.length<=200))&&(r.createdAt===undefined||finite(r.createdAt,0,1e15))&&opt(r.source,x=>['gps','manual','watch'].includes(x))&&opt(r.avgHr,x=>finite(x,20,250))&&opt(r.maxHr,x=>finite(x,20,250))&&!(Number.isFinite(r.avgHr)&&Number.isFinite(r.maxHr)&&r.avgHr>r.maxHr)&&opt(r.laps,x=>laps(x,r.durationSeconds))&&opt(r.durationXpVersion,marker)&&(r.route===undefined||(typeof r.route==='string'&&r.route.length<=8000&&/^[-0-9.,;|]*$/.test(r.route)))&&(r.splits===undefined||(Array.isArray(r.splits)&&r.splits.length<=1000&&r.splits.every(x=>Number.isInteger(x)&&finite(x,1,86400))))&&(r.splitRest===undefined||(Array.isArray(r.splitRest)&&r.splitRest.length===2&&finite(r.splitRest[0],1,999)&&finite(r.splitRest[1],1,86400)))));
  let a=s.activeRun,activeOk=a===undefined||a===null||(typeof a==='object'&&finite(a.startedAt,0,1e15)&&(a.pausedAt===undefined||a.pausedAt===null||finite(a.pausedAt,0,1e15))&&(a.pausedSeconds===undefined||finite(a.pausedSeconds,0,1e10))&&(a.gps===undefined||typeof a.gps==='boolean')&&(a.segment===undefined||(Number.isInteger(a.segment)&&finite(a.segment,0,10000)))&&(a.segmentStartedAt===undefined||finite(a.segmentStartedAt,0,1e15))&&(a.routeId===undefined||(typeof a.routeId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(a.routeId)))&&opt(a.type,typeId)&&opt(a.laps,x=>laps(x))&&opt(a.rounds,rounds)&&opt(a.durationXpVersion,marker));
  const coords=(x,max)=>typeof x==='string'&&x.length<=max&&/^[-0-9.,;]*$/.test(x);
  let routesOk=s.runRoutes===undefined||(Array.isArray(s.runRoutes)&&s.runRoutes.length<=200&&s.runRoutes.every(r=>r&&typeof r.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(r.id)&&typeof r.name==='string'&&r.name.length<=60&&coords(r.line,20000)&&(r.waypoints===undefined||coords(r.waypoints,2000))&&finite(r.distanceKm,0,1000)&&(r.ascentM===undefined||finite(r.ascentM,0,100000))&&(r.createdAt===undefined||finite(r.createdAt,0,1e15))));
  let g=s.runSettings,settingsOk=g===undefined||(g&&typeof g==='object'&&(g.weeklyGoalKm===undefined||g.weeklyGoalKm===null||finite(g.weeklyGoalKm,.1,1000))&&opt(g.lastType,typeId)&&opt(g.weekMinutesGoal,x=>finite(x,0,10080))&&opt(g.rounds,rounds));
  return runsOk&&activeOk&&settingsOk&&routesOk;
};

// GPS: Punkte [Zeit, Breite, Länge, Genauigkeit m, Abschnitt] liegen nur lokal (puls-run-track), nicht im synchronisierten Profil.
// iOS-App (pulsNativeFeatures 'runGps'): nativer CLLocationManager, auch im Hintergrund; die Web-App holt die Punkte ab.
// Browser: watchPosition nur bei offener App; Wake-Lock hält den Bildschirm an. Pausen beginnen einen neuen Abschnitt.
let runTrack=null,runGpsWatch=null,runGpsState='',runGpsAccuracy=null,runWakeLock=null,runNativeStarted='',runPendingRoute=null,runPendingSplits=null,runNativeTotal=0,runOwnedKey='';
const runNativeBridge=()=>window.webkit?.messageHandlers?.pulsNative;
const runNativeGps=()=>!!runNativeBridge()&&(window.pulsNativeFeatures||[]).includes('runGps');
// Nur das Gerät, das den Lauf gestartet hat, misst GPS (ein per Sync übernommener Lauf startet keine fremde Ortung).
// Gerätezuordnung lokal und nicht synchronisiert; die Erststart-Vorschau schreibt nichts (sonst verlöre ein echter Lauf sein Gerät).
function runDeviceKey(value){try{if(typeof firstRunPreview!=='undefined'&&firstRunPreview)return '';if(value===undefined)return localStorage.getItem('puls-run-device')||'';if(value===null)localStorage.removeItem('puls-run-device');else localStorage.setItem('puls-run-device',value)}catch{}return ''}
function runOwnedHere(run=state.activeRun){if(!run)return false;let key=String(run.startedAt);return runOwnedKey===key||runDeviceKey()===key}
function runOwnsGps(run=state.activeRun){return !!run?.gps&&runTypeUsesGps(run.type)&&runOwnedHere(run)}
// iOS-App (pulsNativeFeatures 'runActivity'): Live-Aktivität und km-Mitteilungen. Nur das startende Gerät meldet.
let runActivitySent='',runActivityAt=0;
// finalValues: gespeicherter Endstand (Distanz/Zeit aus dem Formular), damit die Insel nicht weiterzählt.
function syncRunActivity(force=false,finished=false,finalValues=null){
  let bridge=runNativeBridge();if(!bridge||!(window.pulsNativeFeatures||[]).includes('runActivity'))return;
  let run=state.activeRun,owned=runOwnedHere(run);
  if(!owned){if(runActivitySent!=='off'){bridge.postMessage({type:'runActivity',active:false,finished,...(finished&&finalValues?{finalKm:finalValues.distanceKm,finalSeconds:finalValues.durationSeconds}:{})});runActivitySent='off'}return}
  let key=[run.startedAt,run.pausedAt,run.pausedSeconds,run.gps].join(':');if(!force&&key===runActivitySent&&Date.now()-runActivityAt<10000)return;
  let route=typeof runRouteById==='function'?runRouteById(run.routeId):null;
  bridge.postMessage({type:'runActivity',active:true,runKey:String(run.startedAt),startedAt:run.startedAt,pausedSeconds:run.pausedSeconds||0,pausedAt:run.pausedAt||null,gps:!!run.gps,distanceKm:Math.round(runGpsKm()*1000)/1000,title:route?.name||(typeof runTypeInfo==='function'?runTypeName(runTypeInfo(run.type)):runText('Lauf','Run')),...(route?{routeKm:route.distanceKm}:{})});
  runActivitySent=key;runActivityAt=Date.now();
}
function claimRunGps(run){runOwnedKey=String(run.startedAt);runDeviceKey(runOwnedKey)}
function runTrackFor(run=state.activeRun){
  if(!run)return null;let key=String(run.startedAt);if(runTrack?.key===key)return runTrack;
  try{let saved=JSON.parse(appStore.getItem('puls-run-track'));runTrack=saved?.key===key&&Array.isArray(saved.points)?saved:{key,points:[],native:0}}catch{runTrack={key,points:[],native:0}}
  return runTrack;
}
function storeRunTrack(){if(runTrack)try{appStore.setItem('puls-run-track',JSON.stringify(runTrack))}catch{}}
function clearRunTrack(){runTrack=null;runPendingRoute=null;runPendingSplits=null;runNativeTotal=0;runOwnedKey='';try{appStore.setItem('puls-run-track','null')}catch{}runDeviceKey(null)}
function runMeters(a,b){const rad=Math.PI/180,dLat=(b[1]-a[1])*rad,dLon=(b[2]-a[2])*rad,h=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))}
// Distanz: ungenaue Punkte (> 35 m), Zitter-Schritte (< 4 m) und unmögliche Sprünge (> 12 m/s) fließen nicht ein.
function runAcceptedPoints(points){let out=[],last=null;for(let p of points||[]){if(!(p[3]<=35))continue;if(last&&last[4]===p[4]){let m=runMeters(last,p),dt=(p[0]-last[0])/1000;if(m<4||(dt>0?m/dt>12:true))continue}out.push(p);last=p}return out}
function runTrackKm(points){let km=0,accepted=runAcceptedPoints(points);for(let i=1;i<accepted.length;i++)if(accepted[i][4]===accepted[i-1][4])km+=runMeters(accepted[i-1],accepted[i])/1000;return km}
// Kilometerzeiten in Sekunden aus der Bewegungszeit (Pausen zählen nicht); letzter Teil-Kilometer nur ab 100 m.
function runSplits(points){
  let accepted=runAcceptedPoints(points),splits=[],meters=0,seconds=0,nextMark=1000,markSeconds=0;
  for(let i=1;i<accepted.length;i++){
    let a=accepted[i-1],b=accepted[i];if(a[4]!==b[4])continue;let m=runMeters(a,b),s=Math.max(0,(b[0]-a[0])/1000);
    while(m>0&&meters+m>=nextMark){let at=seconds+s*(nextMark-meters)/m;splits.push(Math.max(1,Math.round(at-markSeconds)));markSeconds=at;nextMark+=1000}
    meters+=m;seconds+=s;
  }
  let rest=meters-(nextMark-1000);return {splits,restMeters:rest>=100?Math.min(999,Math.round(rest)):0,restSeconds:rest>=100?Math.max(1,Math.round(seconds-markSeconds)):0};
}
// Kompakte Strecke: höchstens 300 Punkte, 5 Nachkommastellen (~1 m), Pausenabschnitte mit „|“ getrennt.
function runRouteString(points,limit=300){
  let accepted=runAcceptedPoints(points);if(accepted.length<2)return '';
  let kept=null;for(let step=Math.max(1,Math.ceil(accepted.length/limit));step<=accepted.length;step++){let pick=accepted.filter((p,i)=>i%step===0||i===accepted.length-1||accepted[i+1]?.[4]!==p[4]||accepted[i-1]?.[4]!==p[4]);if(pick.length<=limit){kept=pick;break}}
  if(!kept){let step=Math.ceil(accepted.length/limit);kept=accepted.filter((p,i)=>i%step===0).slice(0,limit)}
  let parts=[];for(let p of kept){let pair=p[1].toFixed(5)+','+p[2].toFixed(5);if(parts.length&&parts.at(-1).seg===p[4])parts.at(-1).pts.push(pair);else parts.push({seg:p[4],pts:[pair]})}
  return parts.map(x=>x.pts.join(';')).join('|');
}
function runRoutePoints(route){return String(route||'').split('|').map(s=>s.split(';').map(x=>x.split(',').map(Number)).filter(p=>p.length===2&&p.every(Number.isFinite))).filter(s=>s.length>1)}
function runRouteSvg(route){
  let segs=runRoutePoints(route);if(!segs.length)return '';
  let all=segs.flat(),lat0=all.reduce((a,p)=>a+p[0],0)/all.length,k=Math.cos(lat0*Math.PI/180),xs=all.map(p=>p[1]*k),ys=all.map(p=>p[0]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max(maxX-minX,maxY-minY)||1e-6;
  let pt=p=>`${(10+(p[1]*k-minX)/span*180+(180-(maxX-minX)/span*180)/2).toFixed(1)},${(10+(maxY-p[0])/span*180+(180-(maxY-minY)/span*180)/2).toFixed(1)}`;
  return `<svg class="runroute" viewBox="0 0 200 200" role="img" aria-label="${runText('Strecke','Route')}">${segs.map(s=>`<polyline points="${s.map(pt).join(' ')}"/>`).join('')}<circle cx="${pt(segs[0][0]).split(',')[0]}" cy="${pt(segs[0][0]).split(',')[1]}" r="4"/></svg>`;
}
// Zwischengespeicherte Positionen von vor dem Lauf- bzw. Abschnittsbeginn werden verworfen.
// Höhe (run-metrics.js): alt in m, altAcc in m; altAcc -1 = unbekannt (gleiche Konvention wie RunTracker.swift).
function addRunPoint(t,lat,lon,acc,seg,alt,altAcc){
  let run=state.activeRun;if(!run?.gps||![t,lat,lon,acc].every(Number.isFinite))return;
  let segment=seg??run.segment??0,start=segment===(run.segment||0)?(run.segmentStartedAt||run.startedAt):run.startedAt;if(t<start-1000)return;
  let track=runTrackFor(run);if(track.points.length>=30000)return;
  let hasAlt=Number.isFinite(alt)&&Number.isFinite(altAcc)&&altAcc>=0;
  track.points.push([Math.round(t),Math.round(lat*1e6)/1e6,Math.round(lon*1e6)/1e6,Math.round(acc),segment,hasAlt?Math.round(alt*10)/10:0,hasAlt?Math.round(altAcc):-1]);runGpsAccuracy=acc;runGpsState='on';
}
window.pulsRunGpsReceive=function(data){
  let run=state.activeRun;if(!run?.gps||!data||String(data.runKey)!==String(run.startedAt))return;
  let track=runTrackFor(run);
  if(data.from===track.native&&Array.isArray(data.points)){for(let p of data.points)addRunPoint(p[0],p[1],p[2],p[3],p[4],p[5],p[6]);track.native+=data.points.length;storeRunTrack()}
  if(Number.isInteger(data.total))runNativeTotal=data.total;
  // Größerer Rückstand (z. B. nach langer Sperre): sofort weiter abholen.
  if(data.points?.length&&track.native<runNativeTotal)runNativeBridge()?.postMessage({type:'runGpsSync',runKey:String(run.startedAt),since:track.native});
  if(data.status==='denied')runGpsState='denied';else if(data.status==='pending'&&!track.points.length)runGpsState='pending';
  updateRunLive();
};
function runNativeStop(clear){let bridge=runNativeBridge();if(bridge&&runNativeGps())bridge.postMessage({type:'runGpsStop',clear});runNativeStarted=''}
async function runKeepAwake(on){try{if(on&&!runWakeLock&&navigator.wakeLock&&document.visibilityState==='visible'){runWakeLock=await navigator.wakeLock.request('screen');runWakeLock.addEventListener?.('release',()=>{runWakeLock=null})}else if(!on&&runWakeLock){let lock=runWakeLock;runWakeLock=null;await lock.release()}}catch{runWakeLock=null}}
function syncRunGps(){
  let run=state.activeRun,owned=runOwnsGps(run),live=owned&&!run.pausedAt;
  if(runNativeGps()){
    let bridge=runNativeBridge(),key=live?run.startedAt+':'+(run.segment||0):'';
    if(key!==runNativeStarted){if(live)bridge.postMessage({type:'runGpsStart',runKey:String(run.startedAt),segment:run.segment||0,since:run.segmentStartedAt||run.startedAt});else if(runNativeStarted)bridge.postMessage({type:'runGpsStop',clear:false});runNativeStarted=key}
    if(owned)bridge.postMessage({type:'runGpsSync',runKey:String(run.startedAt),since:runTrackFor(run).native});
    return;
  }
  if(live&&document.visibilityState==='visible'){
    if(runGpsWatch===null&&navigator.geolocation){if(!runGpsState)runGpsState='pending';runGpsWatch=navigator.geolocation.watchPosition(pos=>{addRunPoint(pos.timestamp||Date.now(),pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy,undefined,pos.coords.altitude??NaN,pos.coords.altitudeAccuracy??NaN);storeRunTrack();updateRunLive()},error=>{runGpsState=error.code===1?'denied':'weak';updateRunLive()},{enableHighAccuracy:true,maximumAge:0,timeout:30000})}
    else if(!navigator.geolocation)runGpsState='unsupported';
    runKeepAwake(true);
  }else{if(runGpsWatch!==null){navigator.geolocation.clearWatch(runGpsWatch);runGpsWatch=null}runKeepAwake(false)}
}
// Vor dem Abschluss alle nativen Punkte abholen (höchstens ~4 s warten). false = unvollständig, Lauf bleibt erhalten.
async function drainRunGps(run){
  if(!runNativeGps()||!runOwnsGps(run))return true;let track=runTrackFor(run),until=Date.now()+4000;
  runNativeTotal=-1;runNativeBridge().postMessage({type:'runGpsSync',runKey:String(run.startedAt),since:track.native});
  while(Date.now()<until&&(runNativeTotal<0||track.native<runNativeTotal)){await new Promise(r=>setTimeout(r,120));if(track.native<runNativeTotal)runNativeBridge().postMessage({type:'runGpsSync',runKey:String(run.startedAt),since:track.native})}
  return runNativeTotal>=0&&track.native>=runNativeTotal;
}
function runGpsKm(){let run=state.activeRun;return run?.gps?runTrackKm(runTrackFor(run).points):0}
function runGpsLabel(){
  let run=state.activeRun;if(!run?.gps)return '';if(!runOwnsGps(run))return runText('GPS misst auf dem Gerät, auf dem der Lauf gestartet wurde','GPS is measured on the device that started the run');
  if(run.pausedAt)return runText('GPS pausiert','GPS paused');
  if(runGpsState==='denied')return runText('Standort nicht erlaubt – Distanz am Ende eintragen','Location not allowed – enter distance at the end');
  if(runGpsState==='unsupported')return runText('GPS nicht verfügbar','GPS not available');
  if(runGpsState==='on'&&Number.isFinite(runGpsAccuracy))return runAccuracyOk()?runText('GPS aktiv','GPS active')+' · ±'+Math.round(runGpsAccuracy)+' m':runText('GPS-Signal schwach','Weak GPS signal')+' · ±'+Math.round(runGpsAccuracy)+' m';
  return runText('GPS sucht Signal …','GPS searching …');
}
function runAccuracyOk(){return Number.isFinite(runGpsAccuracy)&&runGpsAccuracy<=35}
function updateRunLive(){
  if(!state.activeRun)return;let elapsed=runElapsed(),km=runGpsKm(),text=formatClock(elapsed);
  document.querySelectorAll('[data-runclock]').forEach(x=>{if(x.textContent!==text)x.textContent=text});
  document.querySelectorAll('[data-rundist]').forEach(x=>{let value=runKm(Math.round(km*100)/100)+' km';if(x.textContent!==value)x.textContent=value});
  document.querySelectorAll('[data-runpace]').forEach(x=>{let value=km>=.05?runPaceText(elapsed/km):'–';if(x.textContent!==value)x.textContent=value});
  document.querySelectorAll('[data-rungps]').forEach(x=>{let value=runGpsLabel();if(x.textContent!==value)x.textContent=value});
  if(typeof runLiveMapUpdate==='function')runLiveMapUpdate();
  if(typeof runViewTick==='function')runViewTick();
}

// Aufzeichnung: Start, Pause, Abschluss. Die Oberfläche (Vollbild mit Karte, Countdown, Zusammenfassung) liegt in run-session.js.
const runViewRefresh=()=>{if(typeof renderRunView==='function')renderRunView()};
function startRunTimer(gps=true,routeId=null,type='run'){
  if(!state.activeRun){
    clearRunTrack();runGpsState='';runGpsAccuracy=null;
    let typeId=type==null?'run':/^[a-z]{2,20}$/.test(type)?type:'other';
    state.activeRun={startedAt:Date.now(),pausedAt:null,pausedSeconds:0,gps:!!gps&&runTypeUsesGps(typeId),segment:0,laps:[],durationXpVersion:1,type:typeId};
    if(type==='mma')state.activeRun.rounds=runRoundsSettings();
    if(routeId&&/^[A-Za-z0-9_-]{1,100}$/.test(routeId))state.activeRun.routeId=routeId;
    claimRunGps(state.activeRun);save();
  }
  syncRunGps();syncRunActivity(true);runViewRefresh();render();
}
function toggleRunPause(){let run=state.activeRun;if(!run)return;if(run.pausedAt){run.pausedSeconds=(run.pausedSeconds||0)+Math.max(0,(Date.now()-run.pausedAt)/1000);run.pausedAt=null;run.segment=(run.segment||0)+1;run.segmentStartedAt=Date.now()}else run.pausedAt=Date.now();save();syncRunGps();syncRunActivity(true);runViewRefresh();render()}
// Beenden: pausieren, alle GPS-Punkte abholen, dann die Zusammenfassung öffnen (Speichern erst dort).
async function finishRunTimer(){
  let run=state.activeRun;if(!run)return;
  // GPS-Rohpunkte gibt es nur auf dem aufzeichnenden Gerät; hier beenden würde die Strecke verlieren.
  if(run.gps&&!runOwnedHere(run)){toast(runText('Beende die Aktivität auf dem Gerät, das sie aufzeichnet.','Finish the activity on the recording device.'));return}
  if(!run.pausedAt){run.pausedAt=Date.now();save();syncRunGps()}
  syncRunActivity(true);
  if(run.gps&&runOwnsGps(run)){
    document.querySelectorAll('[onclick="finishRunTimer()"]').forEach(b=>{b.disabled=true;b.textContent=runText('GPS wird abgeschlossen …','Finishing GPS …')});
    if(!await drainRunGps(run)){if(state.activeRun===run){runViewRefresh();toast(runText('GPS-Daten kommen noch – tippe gleich nochmal auf Beenden.','GPS data still arriving – tap Finish again in a moment.'))}return}
  }
  if(state.activeRun!==run)return;
  let points=run.gps?runTrackFor(run).points:[],km=run.gps?Math.round(runTrackKm(points)*100)/100:0;
  runPendingRoute=run.gps&&km>=.01?runRouteString(points):null;runPendingSplits=run.gps&&km>=1?runSplits(points):null;
  if(typeof runOpenSummary==='function')runOpenSummary(run,points,km);
}
// Gespeicherte Aktivität aus der Zusammenfassung übernehmen; räumt Aufzeichnung, natives GPS und Live-Aktivität auf.
function commitRunActivity(fields){
  let run=state.activeRun;if(!run)return null;
  let before=Object.values(runAwards()).reduce((a,x)=>a+x.xp,0),owned=runOwnsGps(run);
  let r={id:uid(),createdAt:Date.now(),startedAt:run.startedAt,date:localISO(new Date(run.startedAt)),type:run.type??'run',...fields,...(run.durationXpVersion===1?{durationXpVersion:1}:{}),...(run.laps?{laps:run.laps.filter(t=>t<=fields.durationSeconds)}:{})};
  if(run.gps&&owned){r.source='gps';if(runPendingRoute)r.route=runPendingRoute;if(runPendingSplits?.splits.length){r.splits=runPendingSplits.splits;if(runPendingSplits.restMeters)r.splitRest=[runPendingSplits.restMeters,runPendingSplits.restSeconds]}}
  for(let key of Object.keys(r))if(r[key]===undefined||r[key]===null||r[key]==='')delete r[key];
  runList().push(r);
  state.activeRun=null;if(owned)runNativeStop(true);clearRunTrack();syncRunGps();syncRunActivity(true,true,{distanceKm:r.distanceKm,durationSeconds:r.durationSeconds});
  save();render();
  let gained=Object.values(runAwards()).reduce((a,x)=>a+x.xp,0)-before;
  toast(gained>0?runText('Gespeichert · Bestleistung +25 XP','Saved · personal best +25 XP'):runText('Aktivität gespeichert','Activity saved'));
  return r;
}
function discardRunTimer(){if(!state.activeRun)return false;if(!confirm(runText('Aktivität verwerfen? Zeit und Strecke werden nicht gespeichert.','Discard this activity? Time and route will not be saved.')))return false;let owned=runOwnsGps();state.activeRun=null;if(owned)runNativeStop(true);clearRunTrack();save();syncRunGps();syncRunActivity(true);modal.close();render();toast(runText('Aktivität verworfen','Activity discarded'));return true}
setInterval(()=>{if(state.activeRun?.gps||runNativeStarted||runGpsWatch!==null)syncRunGps();updateRunLive();syncRunActivity()},1000);
document.addEventListener('visibilitychange',()=>{syncRunGps();updateRunLive();syncRunActivity(true)});
function deleteRun(id){if(!confirm(runText('Diesen Lauf löschen?','Delete this run?')))return;state.runs=runList().filter(x=>x.id!==id);save();modal.close();render();toast(runText('Lauf gelöscht','Run deleted'))}
function runGoalForm(){let goal=runGoalKm(),minutes=typeof activeMinutesGoal==='function'?activeMinutesGoal():150;openModal(runText('Wochenziele','Weekly goals'),`<form onsubmit="saveRunGoal(event)"><label>${runText('Aktive Minuten pro Woche','Active minutes per week')}<input id="run-goal-min" type="number" inputmode="numeric" min="0" max="10080" step="5" value="${minutes||''}" placeholder="150"></label><p class="note">${runText('Alle Aktivitäten und Gym-Workouts zählen. Die WHO empfiehlt Erwachsenen mindestens 150 Minuten moderate Bewegung pro Woche. Leer = kein Ziel.','All activities and gym workouts count. The WHO recommends at least 150 minutes of moderate activity per week for adults. Empty = no goal.')}</p><label>${runText('Lauf-Kilometer pro Woche','Running kilometres per week')}<input id="run-goal" type="number" inputmode="decimal" min="0.1" max="1000" step="0.1" value="${goal??''}" placeholder="${runText('z. B. 20','e.g. 20')}"></label><p class="note">${runText('Leer lassen für kein Ziel. Die Woche beginnt am Montag.','Leave empty for no goal. Weeks start on Monday.')}</p><button class="btn full">${runText('Ziele speichern','Save goals')}</button></form>`)}
function saveRunGoal(event){event.preventDefault();let raw=$('run-goal').value,goal=raw===''?null:Number(raw),rawMin=$('run-goal-min')?.value??'',minutes=rawMin===''?0:Number(rawMin);if(goal!==null&&!(goal>=.1&&goal<=1000)){toast(runText('Bitte 0,1 bis 1000 km eingeben','Please enter 0.1 to 1000 km'));return}if(!(Number.isInteger(minutes)&&minutes>=0&&minutes<=10080)){toast(runText('Bitte 0 bis 10080 ganze Minuten eingeben','Please enter 0 to 10080 whole minutes'));return}state.runSettings={...(state.runSettings||{}),weeklyGoalKm:goal===null?null:Math.round(goal*10)/10};if(typeof setActiveMinutesGoal==='function')setActiveMinutesGoal(minutes);save();modal.close();render();toast(runText('Wochenziele gespeichert','Weekly goals saved'))}
// Kurze Wochenzeile: aktive Minuten (alle Aktivitäten + Gym) mit Ziel, dazu Lauf-km.
function activityWeekLine(){
  let mins=typeof activeMinutesWeek==='function'?Math.floor(activeMinutesWeek()):0,goal=typeof activeMinutesGoal==='function'?activeMinutesGoal():0,{start,end}=runWeekRange(),km=runKmBetween(start,end),kmGoal=runGoalKm();
  return `<div class="runweek actweek"><div class="actweekhead"><strong>${n(mins)}${goal?' / '+n(goal):''} min</strong><small>${runText('aktiv diese Woche','active this week')}</small><span class="actweekkm">${runKm(Math.round(km*10)/10)}${kmGoal?' / '+runKm(kmGoal):''} km ${runText('Laufen','running')}</span></div>${goal?`<div class="runbar" role="progressbar" aria-label="${runText('Wochenziel aktive Minuten','Weekly active minutes goal')}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${mins}"><i style="width:${Math.min(100,mins/goal*100)}%"></i></div>`:''}</div>`;
}

// Darstellung
function runWeekLine(){let {start,end}=runWeekRange(),km=runKmBetween(start,end),goal=runGoalKm();return goal?`<div class="runweek"><div><strong>${runKm(km)} / ${runKm(goal)} km</strong><small>${runText('diese Woche','this week')}</small></div><div class="runbar" role="progressbar" aria-label="${runText('Wochenziel','Weekly goal')}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.round(km*100)/100}"><i style="width:${Math.min(100,km/goal*100)}%"></i></div></div>`:`<div class="runweek"><div><strong>${runKm(km)} km</strong><small>${runText('diese Woche','this week')}</small></div></div>`}
function runRow(r){let t=typeof runTypeInfo==='function'?runTypeInfo(r.type):null,name=t?(state.language==='en'?t.en:t.de):runText('Lauf','Run');return `<button type="button" class="searchitem runrow" onclick="runDetail('${esc(r.id)}')">${t&&typeof runIcon==='function'?`<span class="runrowicon">${runIcon(t.icon)}</span>`:''}<div>${esc(name)} · ${r.distanceKm>0?runKm(r.distanceKm)+' km · ':''}${formatClock(r.durationSeconds)}<small>${r.distanceKm>0?runPaceText(runPace(r)):''}${Number.isFinite(r.kcal)?(r.distanceKm>0?' · ':'')+r.kcal+' kcal':''}${r.note?' · '+esc(r.note):''}</small></div><span aria-hidden="true">›</span></button>`}
function runCard(){
  let active=state.activeRun,dayRuns=runList().filter(r=>r.date===date);
  let actions=active?`<button type="button" class="runlive" onclick="openRunView()"><span class="badge runningbadge"><i aria-hidden="true"></i>${active.pausedAt?runText('Pausiert','Paused'):runText('Läuft','Running')}</span><strong data-runclock>${formatClock(runElapsed())}</strong>${active.gps?`<small data-rundist>${runKm(Math.round(runGpsKm()*100)/100)} km</small>`:''}<span>${runText('Öffnen','Open')} ${uiIcon('caret-right')}</span></button>`:`<button type="button" class="btn full runopen" onclick="openRunView()">${uiIcon('play')} ${runText('Aktivität starten','Start activity')}</button>`;
  return `<section class="card runcard"><div class="cardhead"><h2>${runText('Aktivitäten','Activities')}</h2><span class="runheadactions">${typeof runRoutesSheet==='function'?`<button type="button" class="textbtn" onclick="runRoutesSheet()">${runText('Routen','Routes')}</button>`:''}<button type="button" class="textbtn" onclick="runGoalForm()">${runText('Ziele','Goals')}</button></span></div>${activityWeekLine()}${actions}${dayRuns.length?`<div class="runlist">${dayRuns.map(runRow).join('')}</div>`:''}</section>`;
}
// Bestzeiten aus GPS-Kilometerzeiten: schnellste zusammenhängende 1, 5, 10 und 21 km innerhalb eines Laufs.
function runBestEfforts(){let best={};for(let r of pastRuns().filter(runIsRun)){let s=r.splits||[];for(let k of [1,5,10,21]){for(let i=0;i+k<=s.length;i++){let sum=s.slice(i,i+k).reduce((a,x)=>a+x,0);if(!best[k]||sum<best[k].seconds)best[k]={seconds:sum,run:r}}}}return best}
function runBestEffortsHtml(){let best=runBestEfforts(),keys=[1,5,10,21].filter(k=>best[k]);if(!keys.length)return '';return `<h3>${runText('Bestzeiten · GPS','Best efforts · GPS')}</h3><div class="runbests">${keys.map(k=>`<button type="button" onclick="runDetail('${esc(best[k].run.id)}')"><small>${k===21?runText('Halbmarathon*','Half marathon*'):k+' km'}</small><strong>${formatClock(best[k].seconds)}</strong><span>${fmtDate(best[k].run.date)}</span></button>`).join('')}</div>${best[21]?`<p class="note">${runText('* 21 volle Kilometer, ohne die letzten 97,5 m.','* 21 full kilometres, without the last 97.5 m.')}</p>`:''}`}
function runProgressCard(){
  let runs=pastRuns().filter(runIsRun);if(!runs.length)return `<section class="card runcard"><div class="cardhead"><h2>${runText('Laufen','Running')}</h2></div><p class="note">${runText('Noch kein Lauf erfasst. Starte einen Lauf oder trage ihn im Workout-Tab ein.','No run logged yet. Start or log one in the Workout tab.')}</p></section>`;
  let week=runWeekRange(),d=new Date(today()+'T12:00:00'),monthStart=localISO(new Date(d.getFullYear(),d.getMonth(),1)),total=runs.reduce((a,r)=>a+r.distanceKm,0),longest=runs.reduce((a,r)=>r.distanceKm>a.distanceKm?r:a),eligible=runs.filter(r=>r.distanceKm>=1),fastest=eligible.length?eligible.reduce((a,r)=>runPace(r)<runPace(a)?r:a):null,month=runs.filter(r=>r.date>=monthStart),monthKm=month.reduce((a,r)=>a+r.distanceKm,0),monthSec=month.reduce((a,r)=>a+r.durationSeconds,0);
  let weeks=Array.from({length:8},(_,i)=>{let range=runWeekRange(i-7);return {label:new Date(range.start+'T12:00:00').toLocaleDateString(appLocale(),{day:'numeric',month:'numeric'}),km:runKmBetween(range.start,range.end)}}),max=Math.max(runGoalKm()||0,...weeks.map(w=>w.km),1);
  return `<section class="card runcard"><div class="cardhead"><h2>${runText('Laufen','Running')}</h2><span class="badge">${runs.length} ${runs.length===1?runText('Lauf','run'):runText('Läufe','runs')} · ${runKm(Math.round(total*10)/10)} km</span></div>${runWeekLine()}<div class="metrictiles"><div><strong>${runKm(Math.round(monthKm*10)/10)} km</strong><small>${runText('Dieser Monat','This month')}</small></div><div><strong>${monthKm>0?runPaceText(monthSec/monthKm):'–'}</strong><small>${runText('Ø Pace Monat','Avg pace month')}</small></div><div><strong>${runKm(longest.distanceKm)} km</strong><small>${runText('Längster Lauf','Longest run')}</small></div><div><strong>${fastest?runPaceText(runPace(fastest)):'–'}</strong><small>${runText('Beste Pace · ab 1 km','Best pace · 1 km+')}</small></div></div>${runBestEffortsHtml()}<h3>${runText('Kilometer pro Woche','Kilometres per week')}</h3><div class="runweeks">${weeks.map(w=>`<div><i style="height:${Math.max(w.km>0?4:0,w.km/max*100)}%" title="${runKm(w.km)} km"></i><small>${esc(w.label)}</small></div>`).join('')}</div><p class="note">${runText('Pace = Dauer ÷ Distanz, ohne GPS so genau wie deine Eingabe. 25 XP, wenn ein Lauf ab 1 km weiter bei mindestens gleicher Pace oder schneller bei mindestens gleicher Distanz ist als alle bisherigen; der erste Lauf setzt die Basis.','Pace = duration ÷ distance, as accurate as your input (no GPS). 25 XP when a run of 1 km or more is longer at equal or better pace, or faster at equal or longer distance than all previous runs; the first run sets the baseline.')}</p></section>`;
}

// Workout-Tab: Laufkarte unter den Routinen.
const runningWorkoutPage=workoutPage;workoutPage=function(...args){
  let html=runningWorkoutPage.apply(this,args);if(trainTab!=='current')return html;
  let template=document.createElement('template');template.innerHTML=html;let body=template.content.querySelector('.workoutbody');if(!body)return html;
  body.insertAdjacentHTML('beforeend',runCard());return template.innerHTML;
};
// Kalender: Lauftage markieren und am gewählten Tag auflisten.
const runningCalendar=trainingCalendar;trainingCalendar=function(...args){
  let html=runningCalendar.apply(this,args),runs=runList();if(!runs.length)return html;
  let template=document.createElement('template');template.innerHTML=html;
  template.content.querySelectorAll('.calday').forEach(button=>{
    let day=(button.getAttribute('onclick')||'').match(/\d{4}-\d{2}-\d{2}/)?.[0],dayRuns=day?runs.filter(r=>r.date===day):[];if(!dayRuns.length)return;
    button.classList.add('hasworkout','hasrun');let label=dayRuns.map(r=>runKm(r.distanceKm)+' km').join(' · '),names=button.querySelector('.calroutines');
    if(names)names.textContent+=' · '+label;else{let span=document.createElement('span');span.className='calroutines';span.textContent=label;button.append(span)}
  });
  let selected=runs.filter(r=>r.date===calendarSelected);
  if(selected.length){let head=template.content.querySelector('.sectionhead');let note=head?.parentElement?.querySelector(':scope > p.note');note?.remove();let list=document.createElement('div');list.className='runlist';list.innerHTML=selected.map(runRow).join('');(head?.parentElement||template.content).append(list)}
  return template.innerHTML;
};
// Fortschritt: Laufkarte am Ende der Auswertung.
// Seit Version 64 ersetzt der Bereich „Aktivitäten“ (activity-overview.js) die Laufkarte; Filter „Laufen“ zeigt sie weiter.
const runningAnalytics=analyticsPage;analyticsPage=function(...args){return runningAnalytics.apply(this,args)+(typeof activityOverviewCard==='function'?activityOverviewCard():runProgressCard())};
// Übersicht: kurze Laufzeile in der Trainingskarte.
const runningQuickTraining=quickTraining;quickTraining=function(...args){
  let html=runningQuickTraining.apply(this,args),i=html.lastIndexOf('</section>');if(i<0)return html;
  let active=state.activeRun,{start,end}=runWeekRange(),km=runKmBetween(start,end),mins=typeof activeMinutesWeek==='function'?Math.floor(activeMinutesWeek()):0,minGoal=typeof activeMinutesGoal==='function'?activeMinutesGoal():0;
  let line=active?`<button type="button" class="runline" onclick="openRunView()"><span>${runText('Aktivität läuft','Activity in progress')}</span><strong data-runclock>${formatClock(runElapsed())}</strong></button>`:`<button type="button" class="runline" onclick="trainTab='current';go('workout')"><span>${runText('Aktiv diese Woche','Active this week')}</span><strong>${n(mins)}${minGoal?' / '+n(minGoal):''} min · ${runKm(Math.round(km*10)/10)} km</strong></button>`;
  return html.slice(0,i)+line+html.slice(i);
};
// Plus-Menü
function quickAddRun(){openRunView()}
if(typeof quickActionPaths==='object')quickActionPaths.run='<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5M6 12l3-4 4 1 2 4 3 1M11 15l-1-4"/>';
if(typeof quickAddActions!=='undefined'&&Array.isArray(quickAddActions)){let list=quickAddActions,at=list.findIndex(x=>x[0]==='workout');list.splice(at<0?list.length:at+1,0,['run','Lauf','Starten oder eintragen','quickAddRun()'])}
if(typeof englishUI==='object')Object.assign(englishUI,{'Lauf':'Run','Starten oder eintragen':'Start or log'});
render();
