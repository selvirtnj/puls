/* iOS-App (ios/): meldet laufende Pausen an die native Hülle für Mitteilung und Live-Aktivität. Im Browser wirkungslos. */
(function(){
const bridge=window.webkit?.messageHandlers?.pulsNative;
if(!bridge)return;
// undefined = noch nichts gemeldet: Der erste Abgleich ohne Pause räumt Reste aus einem früheren Seitenleben ab.
let sent;
const openSet=e=>(e.sets||[]).findIndex(s=>!s.done);
const info=e=>({exercise:e.name||'Nächste Übung',detail:`Satz ${openSet(e)+1} von ${e.sets.length}`});
function nextSetInfo(w,current){
  let list=w.exercises||[];
  // Superset: als Nächstes die Gruppenübung mit dem frühesten offenen Satz (A2 vor B2).
  if(current?.superset){
    let group=list.filter(e=>e.superset===current.superset&&openSet(e)>=0);
    if(group.length)return info(group.reduce((a,b)=>openSet(b)<openSet(a)?b:a));
  }
  let start=Math.max(0,list.indexOf(current));
  let next=list.slice(start).concat(list.slice(0,start)).find(e=>openSet(e)>=0);
  return next?info(next):{exercise:w.name||'Workout',detail:'Alle Sätze erledigt'};
}
function activeRest(now=Date.now()){
  return (state.workouts||[]).filter(w=>!w.finished&&w.rest?.endAt>now).sort((a,b)=>a.rest.endAt-b.rest.endAt)[0]||null;
}
// Neuere iOS-App (window.pulsNativeFeatures): ohne Pause zeigt die Live-Aktivität die Workout-Zeit.
const workoutTimer=(window.pulsNativeFeatures||[]).includes('workoutTimer');
function runningWorkout(){
  return (state.workouts||[]).filter(w=>!w.finished&&Number.isFinite(w.startedAt)).sort((a,b)=>b.startedAt-a.startedAt)[0]||null;
}
function syncNativeRest(){
  try{
    let w=activeRest(),running=workoutTimer?runningWorkout():null;
    if(!w){
      if(running){
        let info={workoutStartsAt:running.startedAt,workout:running.name||'Workout',...nextSetInfo(running)},key='workout'+JSON.stringify(info);
        // Mitteilung nur bei vorzeitig beendeter Pause zurückziehen, nie kurz vor dem regulären Pausenende.
        if(sent?.key!==key){let cancelRest=sent?.endAt>Date.now();sent={key};bridge.postMessage({type:'workoutActive',cancelRest,...info})}
        return;
      }
      if(sent!==null){sent=null;bridge.postMessage({type:'restCancel'})}return}
    let current=(w.exercises||[]).find(e=>e.id===w.rest.exerciseId);
    let info={endsAt:w.rest.endAt,workout:w.name||'Workout',...nextSetInfo(w,current),...(workoutTimer&&Number.isFinite(w.startedAt)?{workoutStartsAt:w.startedAt}:{})},key=JSON.stringify(info);
    // Dieselbe Pause: „+30 s“ verlängert dasselbe rest-Objekt; ein Cloud-Abgleich ersetzt es mit gleicher Endzeit.
    // Ein neu abgehakter Satz legt ein neues Objekt mit neuer Endzeit an.
    let same=sent&&sent.workoutId===w.id&&sent.exerciseId===w.rest.exerciseId&&(sent.rest===w.rest||sent.endAt===w.rest.endAt);
    if(same&&sent.key===key){sent.rest=w.rest;return}
    let startsAt=same?sent.startsAt:Date.now();
    sent={rest:w.rest,workoutId:w.id,exerciseId:w.rest.exerciseId,endAt:w.rest.endAt,startsAt,key};
    bridge.postMessage({type:'restStart',startsAt,...info});
  }catch(error){console.warn('PULS native bridge',error)}
}
// App-Icon: Die native Huelle verwendet ein festes dunkles Symbol.
// Eigener try-Block: ein Fehler hier darf die Pausen-Meldungen unten nie verhindern.
try{
  document.documentElement.classList.add('nativeapp');
  let iconStyle=document.createElement('style');
  iconStyle.textContent='.nativeapp .preferences .iconchoices~.note,.nativeapp .preferences a[href^="icon-install"]{display:none!important}';
  document.head.appendChild(iconStyle);
}catch(error){console.warn('PULS native icon',error)}
// Kurzer Takt, damit die Live-Aktivität angelegt wird, solange die App noch im Vordergrund ist.
setInterval(syncNativeRest,400);
function syncNativeState(){try{syncNativeRest();if(typeof syncRunActivity==='function')syncRunActivity()}catch(error){console.warn('PULS native state',error)}}
// Ende/Verwerfen sofort melden, bevor iOS die WebView nach dem nächsten Wechsel schlafen legt.
for(const name of ['save','render']){
  if(name==='save'&&typeof save==='function'){const base=save;save=function(...args){try{return base.apply(this,args)}finally{syncNativeState()}}}
  if(name==='render'&&typeof render==='function'){const base=render;render=function(...args){try{return base.apply(this,args)}finally{syncNativeState()}}}
}
document.addEventListener('visibilitychange',syncNativeState);
window.addEventListener('pagehide',syncNativeState);
window.addEventListener('pageshow',syncNativeState);
syncNativeState();
})();
