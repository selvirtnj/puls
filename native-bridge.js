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
function syncNativeRest(){
  try{
    let w=activeRest();
    if(!w){if(sent!==null){sent=null;bridge.postMessage({type:'restCancel'})}return}
    if(sent&&sent.rest===w.rest&&sent.endAt===w.rest.endAt)return;
    // „+30 s“ verlängert dasselbe rest-Objekt; ein neu abgehakter Satz legt ein neues an.
    let startsAt=sent&&sent.rest===w.rest?sent.startsAt:Date.now();
    sent={rest:w.rest,endAt:w.rest.endAt,startsAt};
    let current=(w.exercises||[]).find(e=>e.id===w.rest.exerciseId);
    bridge.postMessage({type:'restStart',startsAt,endsAt:w.rest.endAt,workout:w.name||'Workout',...nextSetInfo(w,current)});
  }catch(error){console.warn('PULS native bridge',error)}
}
// Kurzer Takt, damit die Live-Aktivität angelegt wird, solange die App noch im Vordergrund ist.
setInterval(syncNativeRest,400);
document.addEventListener('visibilitychange',syncNativeRest);
window.addEventListener('pagehide',syncNativeRest);
syncNativeRest();
})();
