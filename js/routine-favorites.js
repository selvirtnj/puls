/* v93: Routinen favorisieren. Persistiert nur routine.favorite===true (false wird beim Umschalten entfernt).
   Favoriten stehen in jeder Routinenliste oben; innerhalb beider Gruppen bleibt die gespeicherte Reihenfolge.
   state.routines selbst wird nie umsortiert (Vorschlagsreihenfolge, IDs und Sync bleiben unverändert). */
(function(){
  const isFavorite=r=>r?.favorite===true;
  // Stabile Aufteilung: erst Favoriten, dann der Rest, jeweils in bisheriger Reihenfolge.
  function routinesByFavorite(list){list=Array.isArray(list)?list:[];return [...list.filter(isFavorite),...list.filter(r=>!isFavorite(r))]}
  window.routinesByFavorite=routinesByFavorite;

  const favValid=validData;
  validData=function(s){return favValid(s)&&(s.routines||[]).every(r=>r.favorite===undefined||typeof r.favorite==='boolean')};

  // Gefüllter Stern (Phosphor „star-fill“) neben dem vorhandenen Umriss „star“.
  if(typeof phosphorRegular==='object'&&!phosphorRegular['star-fill'])phosphorRegular['star-fill']='<path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/>';

  const en=()=>state.language==='en';
  function favoriteButton(id){
    let r=(state.routines||[]).find(x=>x.id===id);if(!r)return '';
    let on=isFavorite(r),label=(en()?'Favorite: ':'Favorit: ')+esc(r.name);
    return `<button type="button" class="routinefav${on?' on':''}" data-routine-fav="${id}" aria-pressed="${on}" aria-label="${label}" data-no-translate onclick="toggleRoutineFavorite('${id}')">${uiIcon(on?'star-fill':'star')}</button>`;
  }

  window.toggleRoutineFavorite=function(id){
    let r=(state.routines||[]).find(x=>x.id===id);if(!r)return;
    let on=!isFavorite(r);if(on)r.favorite=true;else delete r.favorite;
    save();render();
    try{if(typeof pulsSound==='function')pulsSound(on?'toggle':'toggleOff')}catch{}
    // Fokus nach dem Neuaufbau (auch nach verzögerten Render-Durchläufen) auf denselben Stern legen.
    const refocus=()=>document.querySelector?.(`.routinefav[data-routine-fav="${id}"]`)?.focus?.({preventScroll:true});
    refocus();setTimeout(refocus,0);
  };

  // Für reine Darstellungsfunktionen: state.routines kurz durch die sortierte Kopie ersetzen.
  // Sie speichern nicht; zurückgesetzt wird nur, wenn niemand state/routines inzwischen ersetzt hat.
  function sortedView(fn){return function(...args){
    let s=state,original=s?.routines;
    if(!Array.isArray(original)||!original.some(isFavorite))return fn.apply(this,args);
    let view=routinesByFavorite(original);s.routines=view;
    try{return fn.apply(this,args)}finally{if(s.routines===view)s.routines=original}
  }}

  // Routinen-Tab und Schnellstart im Workout-Tab (training-tabs.js baut dieselben Karten um).
  const favRoutinesPage=sortedView(routinesPage);
  routinesPage=function(...args){
    return favRoutinesPage.apply(this,args).replace(/<button class="textbtn" onclick="routineForm\('([A-Za-z0-9_-]{1,100})'\)">/g,(m,id)=>favoriteButton(id)+m);
  };
  // Übersicht: die ersten drei Routinen.
  if(typeof dsTrainingGroup==='function')dsTrainingGroup=sortedView(dsTrainingGroup);
  // „Workout starten“-Liste; bei laufendem Workout öffnet startWorkout nur die Sitzung (mit Render/Speichern).
  if(typeof startWorkout==='function'){const sortedStart=sortedView(startWorkout),plainStart=startWorkout;startWorkout=function(...args){return (typeof activeWorkout==='function'&&activeWorkout()?plainStart:sortedStart).apply(this,args)}}
  // Plus-Menü: Inline-Handler nutzen den Index in state.routines, daher Originalindex behalten.
  if(typeof qaQuickRoutines==='function')qaQuickRoutines=function(){
    let list=state.routines||[],order=routinesByFavorite(list.map((r,i)=>({favorite:r.favorite,r,i})));
    let rows=order.map(({r,i})=>qaRow({label:esc(r.name),action:`modal.close();startRoutine(state.routines[${i}].id)`,chevron:true})).join('');
    return openModal(qaT('Routine starten','Start routine'),rows?qaGroup('',rows):`<p class="note">${qaT('Noch keine Routinen vorhanden.','No routines yet.')}</p>`);
  };
  if(typeof render==='function'&&typeof page!=='undefined'&&page==='workout')render();
})();
