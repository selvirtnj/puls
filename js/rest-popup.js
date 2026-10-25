/* Pausenende: Pop-up mit Bestätigung statt kurzem Hinweis. Erscheint, wenn eine Satzpause in der offenen App abläuft
   oder beim Zurückkehren innerhalb von 10 Minuten nach dem Ende. Ton und Vibration bleiben wie bisher. */
const restPopupMaxAge=10*60*1000;
function restPopupNext(w,exerciseId){
  let list=w.exercises||[],current=list.find(e=>e.id===exerciseId),open=e=>(e.sets||[]).findIndex(s=>!s.done);
  if(current?.superset){let group=list.filter(e=>e.superset===current.superset&&open(e)>=0);if(group.length)current=group.reduce((a,b)=>open(b)<open(a)?b:a)}
  let start=Math.max(0,list.indexOf(current)),next=[...list.slice(start),...list.slice(0,start)].find(e=>open(e)>=0);
  return next?{exercise:next.name||'',detail:`Satz ${open(next)+1} von ${next.sets.length}`}:null;
}
let restPopupReturnFocus=null;
function closeRestPopup(){
  let overlay=$('rest-popup');if(!overlay||overlay.classList.contains('closing'))return;
  overlay.classList.add('closing');
  setTimeout(()=>{if(overlay.open)overlay.close();overlay.remove();if(restPopupReturnFocus?.isConnected&&!restPopupReturnFocus.matches?.('input,textarea,select,[contenteditable]'))restPopupReturnFocus.focus({preventScroll:true});restPopupReturnFocus=null},220);
}
function showRestPopup(next){
  let old=$('rest-popup');if(old){if(old.open)old.close();old.remove()}
  restPopupReturnFocus=document.activeElement;
  // Eigener <dialog> mit showModal(): liegt immer über einem bereits offenen Fenster (#modal) und hält den Fokus.
  let en=state.language==='en',overlay=document.createElement('dialog');
  overlay.id='rest-popup';overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-labelledby','rest-popup-title');
  overlay.innerHTML=`<div class="restpopupcard"><div class="restpopupring" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M20 33.5l8 8 16-17"/></svg></div><h2 id="rest-popup-title">${en?'Rest is over':'Pause vorbei'}</h2>${next?`<p class="restpopupnext">${en?'Next':'Als Nächstes'}</p><p class="restpopupexercise">${esc(next.exercise)}</p><p class="restpopupdetail">${esc(en?next.detail.replace('Satz','Set').replace(' von ',' of '):next.detail)}</p>`:`<p class="restpopupdetail">${en?'All sets done':'Alle Sätze erledigt'}</p>`}<button type="button" class="btn full" onclick="closeRestPopup()">OK</button></div>`;
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeRestPopup()});
  overlay.addEventListener('cancel',event=>{event.preventDefault();closeRestPopup()});
  overlay.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();closeRestPopup()}});
  document.body.appendChild(overlay);
  try{overlay.showModal()}catch{overlay.setAttribute('open','')}
  requestAnimationFrame(()=>overlay.querySelector('button')?.focus({preventScroll:true}));
}
// Der bisherige kurze Hinweis entfällt; Ton (interactions.js) und Vibration bleiben.
const restPopupToast=toast;toast=function(message,...args){if(/Pause vorbei/.test(message)&&restPopupSuppressToast){if(typeof pulsSound==='function')pulsSound('rest');return}return restPopupToast(message,...args)};
let restPopupSuppressToast=false;
const restPopupTick=tickWorkoutClocks;tickWorkoutClocks=function(...args){
  let now=Date.now(),ending=state.workouts.filter(w=>!w.finished&&w.rest?.endAt&&w.rest.endAt<=now).map(w=>({w,exerciseId:w.rest.exerciseId,endAt:w.rest.endAt}));
  // Hinweis nur ersetzen, wenn das Pop-up auch kommt; ältere Pausenenden behalten den kurzen Hinweis.
  restPopupSuppressToast=ending.some(x=>now-x.endAt<restPopupMaxAge);
  try{restPopupTick.apply(this,args)}finally{restPopupSuppressToast=false}
  let fresh=ending.filter(x=>!x.w.rest&&now-x.endAt<restPopupMaxAge);
  if(!fresh.length)return;
  let last=fresh.at(-1);
  // Im Hintergrund vormerken und beim Zurückkehren zeigen (nur, solange kein neuer Satz läuft).
  if(document.hidden)restPopupPending={...last};else{restPopupPending=null;showRestPopup(restPopupNext(last.w,last.exerciseId))}
};
let restPopupPending=null;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||!restPopupPending)return;
  let pending=restPopupPending;restPopupPending=null;
  if(Date.now()-pending.endAt<restPopupMaxAge&&state.workouts.includes(pending.w)&&!pending.w.finished&&!pending.w.rest)showRestPopup(restPopupNext(pending.w,pending.exerciseId));
});
clearInterval(workoutTickHandle);workoutTickHandle=setInterval(tickWorkoutClocks,1000);
