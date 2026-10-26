/* Zurück per Wisch vom linken Rand (wie in iOS). Nur dort, wo ein sichtbarer Zurück-Knopf steht; ausgelöst wird
   genau dieser Knopf (.click()), es gibt keine eigene Navigationslogik. Nur Touch-Ereignisse: Maus und Trackpad
   bleiben unberührt. Ohne Bewegung (prefers-reduced-motion) wird nur ausgelöst, die Ansicht läuft nicht mit. */
const edgeBack={
  edge:24,       // Startzone am linken Rand in px
  slop:10,       // ab dieser Strecke steht die Richtung fest
  ratio:.35,     // Anteil der Fensterbreite zum Auslösen
  flick:.5,      // px/ms: schneller Wisch löst auch bei kürzerer Strecke aus
  flickMin:40,
  // Zurück-Knöpfe in Prüfreihenfolge. Knöpfe ohne eigene Klasse brauchen zusätzlich eine Zurück-Beschriftung.
  buttons:['.accountback','.ffback','button[onclick^="closeExercisePicker"]','button[onclick^="renderRecipeEditor"]','button[onclick^="closeExerciseOrder"]','button[onclick^="cancelRecipe"]','button[onclick^="mealPlanning"]','button[onclick^="profileForm"]'],
  label:/zurück|back|abbrechen|cancel/i,
  // Hier bleibt die Geste aus: Eingaben, Karten, Wisch-Zeilen, Scroll-Räder und horizontale Karussells.
  ignore:'input,textarea,select,[contenteditable],.leaflet-container,.swipediary,.timewheel,.wheelcol,.nutritiontrack,[data-edge-back-ignore]',
  // Andere offene Dialoge sperren immer; Vollbild-Ebenen (Laufen, laufendes Workout) nur, solange kein Fenster darüber liegt.
  dialogs:'dialog[open]:not(#modal)',
  blockers:'#run-root,#session-root',
  gesture:null,  // laufende Geste (Finger auf dem Glas)
  settle:null    // Abschlussphase der vorigen Geste (Hinausgleiten oder Zurückfedern)
};
function edgeBackAxis(dx,dy){
  if(Math.abs(dx)<edgeBack.slop&&Math.abs(dy)<edgeBack.slop)return 'wait';
  return dx>0&&dx>Math.abs(dy)*1.5?'track':'abort';
}
function edgeBackOutcome(dx,velocity,width){return dx>=width*edgeBack.ratio||dx>=edgeBack.flickMin&&velocity>=edgeBack.flick}
function edgeBackLayer(){
  if(typeof setupPending!=='undefined'&&setupPending)return null;
  if(document.querySelector(edgeBack.dialogs))return null;
  let modal=document.getElementById('modal');
  if(modal?.open)return {root:modal,move:document.getElementById('mb')||modal,modal:true};
  for(let el of document.querySelectorAll(edgeBack.blockers))if(el.getClientRects().length)return null;
  let content=document.getElementById('content');
  if(!content||content.closest('[inert]'))return null;
  return {root:content,move:content,modal:false};
}
function edgeBackButton(root){
  for(let selector of edgeBack.buttons)for(let el of root.querySelectorAll(selector)){
    if(el.disabled||el.closest('[hidden],[inert]')||!el.getClientRects().length)continue;
    if(!selector.startsWith('.')&&!edgeBack.label.test((el.textContent||'')+' '+(el.getAttribute('aria-label')||'')))continue;
    return el;
  }
  return null;
}
function edgeBackScrollsX(el,stop){
  for(let node=el;node&&node!==stop&&node.nodeType===1;node=node.parentElement){
    if(node.scrollWidth>node.clientWidth+1){let overflow=getComputedStyle(node).overflowX;if(overflow==='auto'||overflow==='scroll')return true}
  }
  return false;
}
// Mit !important, weil das Designsystem #content sonst fest auf transform:none setzt.
function edgeBackShift(el,x){el.style.setProperty('transform',`translateX(${x}px)`,'important')}
function edgeBackTime(event){return Number.isFinite(event.timeStamp)?event.timeStamp:Date.now()}
function edgeBackTouch(list,id){for(let touch of list||[])if(touch.identifier===id)return touch;return null}
// Dieselbe Ebene und derselbe aktive Zurück-Knopf wie beim Start (gleiche Suche). Ein geschlossenes Fenster,
// ein neu geöffneter Dialog (z. B. Pausen-Popup) oder ein neu gerenderter Knopf machen die Geste ungültig.
function edgeBackValid(g){let layer=edgeBackLayer();return !!layer&&layer.root===g.root&&edgeBackButton(layer.root)===g.button}
// Gegenseitiger Ausschluss mit dem Fensterziehen (interactions.js), dem Sortieren (comfort.js) und den Wisch-Zeilen (compact.js).
function edgeBackOtherDrag(sheet=true){
  return sheet&&typeof dragSheet!=='undefined'&&!!dragSheet&&dragSheet.dy>0||typeof orderDrag!=='undefined'&&!!orderDrag||typeof diarySwipe!=='undefined'&&!!diarySwipe?.dragging;
}
// Erkannte Kantengeste: begonnenes Fensterziehen verwerfen, damit dessen pointerup weder schließt noch verschoben lässt.
function edgeBackStopSheetDrag(){
  if(typeof dragSheet==='undefined'||!dragSheet)return;
  dragSheet=null;document.getElementById('modal')?.style.removeProperty('transform');
}
function edgeBackClear(g){
  let el=g.move;if(el.edgeBackOwner!==g)return; // eine neuere Geste besitzt das Element bereits
  el.edgeBackOwner=null;el.classList.remove('edgebackdragging','edgebacksettle');el.style.removeProperty('transform');g.root.classList.remove('edgebackactive');
}
// Beendet die Abschlussphase sofort: Timer und Listener weg, aufräumen, nur bei gültiger Ebene zurückklicken.
function edgeBackSettleDone(){
  let s=edgeBack.settle;if(!s)return;
  edgeBack.settle=null;clearTimeout(s.timer);s.g.move.removeEventListener('transitionend',s.onEnd);
  edgeBackClear(s.g);
  if(s.back&&edgeBackValid(s.g))s.g.button.click();
}
function edgeBackAbort(){let g=edgeBack.gesture;if(!g)return;edgeBack.gesture=null;if(g.locked)edgeBackFinish(g,false)}
function edgeBackStart(event){
  edgeBackSettleDone();   // vorige Geste vollständig abschließen, bevor eine neue beginnt
  edgeBackAbort();        // zweiter Finger: laufende Geste zurückfedern
  if(event.touches?.length!==1)return;
  let touch=event.touches[0],target=event.target;
  if(!touch||touch.clientX>edgeBack.edge||!target?.closest)return;
  if(target.closest(edgeBack.ignore)||edgeBackOtherDrag())return;
  let layer=edgeBackLayer();if(!layer)return;
  if(layer.modal){
    if(!layer.root.contains(target))return;
    let rect=layer.root.getBoundingClientRect();if(touch.clientY<rect.top||touch.clientY>rect.bottom)return;
  }else if(!target.closest('main')||target.closest('nav'))return;
  if(edgeBackScrollsX(target,layer.root))return;
  let button=edgeBackButton(layer.root);if(!button)return;
  let now=edgeBackTime(event);
  edgeBack.gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,lastX:touch.clientX,lastT:now,v:0,dx:0,locked:false,
    button,root:layer.root,move:layer.move,width:window.innerWidth||layer.move.getBoundingClientRect().width||390,
    reduced:!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches};
}
function edgeBackMove(event){
  let g=edgeBack.gesture;if(!g)return;
  let touch=edgeBackTouch(event.changedTouches,g.id);if(!touch)return;
  if(!edgeBackValid(g)){edgeBackAbort();return}
  let dx=touch.clientX-g.x,dy=touch.clientY-g.y;
  if(!g.locked){
    let axis=edgeBackAxis(dx,dy);if(axis==='wait')return;
    // Sortieren oder Wisch-Zeile hat inzwischen übernommen: aussteigen. Ein Fensterziehen übernimmt dagegen die Kantengeste.
    if(axis==='abort'||edgeBackOtherDrag(false)){edgeBack.gesture=null;return}
    g.locked=true;g.move.edgeBackOwner=g;g.root.classList.add('edgebackactive');
    edgeBackStopSheetDrag();
    if(!g.reduced)g.move.classList.add('edgebackdragging');
  }
  // Erst nach eindeutig horizontaler Erkennung: Seite nicht scrollen, andere Wischgesten nicht auslösen.
  if(event.cancelable!==false)event.preventDefault();
  event.stopPropagation();
  let now=edgeBackTime(event),gap=now-g.lastT,step=(touch.clientX-g.lastX)/Math.max(1,gap);
  // Schwung nur aus der jüngsten Bewegung: nach einer Pause zählt allein der letzte Schritt.
  g.v=gap>80?step:g.v*.4+step*.6;g.lastX=touch.clientX;g.lastT=now;g.dx=Math.max(0,dx);
  if(!g.reduced)edgeBackShift(g.move,g.dx);
}
function edgeBackEnd(event){
  let g=edgeBack.gesture;if(!g)return;
  if(!edgeBackTouch(event.changedTouches,g.id))return;
  edgeBack.gesture=null;if(!g.locked)return;
  if(edgeBackTime(event)-g.lastT>100)g.v=0; // Finger stand vor dem Loslassen still: kein schneller Wisch
  edgeBackFinish(g,event.type!=='touchcancel'&&edgeBackValid(g)&&edgeBackOutcome(g.dx,g.v,g.width));
}
function edgeBackFinish(g,back){
  edgeBackSettleDone();
  edgeBack.settle={g,back,timer:0,onEnd:event=>{if(!event||event.target===g.move)edgeBackSettleDone()}};
  if(g.reduced||!g.dx){edgeBackSettleDone();return}
  let el=g.move;el.classList.remove('edgebackdragging');el.classList.add('edgebacksettle');
  edgeBackShift(el,back?g.width:0);
  el.addEventListener('transitionend',edgeBack.settle.onEnd);
  edgeBack.settle.timer=setTimeout(edgeBackSettleDone,280);
}
// Fenster schließt während der Geste: abbrechen und aufräumen.
document.getElementById('modal')?.addEventListener('close',()=>{
  if(edgeBack.gesture?.root.id==='modal')edgeBackAbort();
  if(edgeBack.settle?.g.root.id==='modal')edgeBackSettleDone();
});
document.addEventListener('touchstart',edgeBackStart,{capture:true,passive:true});
document.addEventListener('touchmove',edgeBackMove,{capture:true,passive:false});
document.addEventListener('touchend',edgeBackEnd,{capture:true,passive:true});
document.addEventListener('touchcancel',edgeBackEnd,{capture:true,passive:true});