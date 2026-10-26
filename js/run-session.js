/* Aktivität als eigene Vollbild-Ansicht (wie das laufende Workout), Vorbild Strava/adidas Running:
   Start: Karte, Aktivitätsart links, Start mittig, Route rechts → Countdown (+10 s, sofort starten)
   → Live: Dauer, Distanz, Kalorien (geschätzt), Ø Pace, Karte, Pause → pausiert Beenden/Weiter
   → Zusammenfassung: Gefühl, Untergrund, Notiz, Ø/Max-Geschwindigkeit, Höhenmeter, Pausen, km-Zeiten.
   Aufzeichnung und Speichern: running.js (startRunTimer, toggleRunPause, finishRunTimer, commitRunActivity);
   Rechenwerte: run-metrics.js; Karten: run-map.js. */

let runView=null,runViewType=null,runViewRouteId=null,runCountdown=null,runSummary=null,runPreviewWatch=null,runPreviewTimer=null,runViewMapKey='';

const RUN_ICON_PATHS={
  run:'<circle cx="14.5" cy="4" r="2"/><path d="m8 21 3.2-6 3.3 2.4V22M5.5 11.5 9 8l4.5 1 2.5 4 3.5 1M11.2 15 10 10"/>',
  trail:'<circle cx="14.5" cy="4" r="2"/><path d="m8 18 3.2-5 3.3 2.4V19M5.5 9.5 9 6l4.5 1 2.5 4 3.5 1M2 22l5-3 4 2 5-3 6 3"/>',
  walk:'<circle cx="13" cy="4" r="2"/><path d="m10 22 2-6 3 3v3M9 13l2-5 3 1 2 4M11 8l-3 3"/>',
  hike:'<circle cx="11" cy="4" r="2"/><path d="m8 22 2-7 3 3v4M7 12l2-4 3 1 2 4M17 9v13M15 9h3"/>',
  mountain:'<path d="m2 20 7-12 4 6 3-4 6 10Z"/><path d="m7 11 2 2 2-2"/>',
  ride:'<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><circle cx="15" cy="4.5" r="1.5"/><path d="M5.5 17 9 9h5l4.5 8M9 9l3 8h-6.5M13 6.5 14 9"/>',
  tabletennis:'<circle cx="9" cy="9" r="6"/><path d="m13.5 13.5 5 5a1.5 1.5 0 0 1-2 2l-5-5"/><circle cx="19" cy="5" r="2"/>',
  soccer:'<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10Z"/><path d="M12 3v4M21 10l-5 0M17.5 19l-3-4.5M6.5 19l3-4.5M3 10h5"/>',
  inline:'<path d="M4 16h14a2 2 0 0 0 2-2v-1l-6-2-2-5H8v8H4Z"/><circle cx="7" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  swim:'<circle cx="16" cy="6" r="2"/><path d="m4 13 5-4 4 3 2-2M2 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/>',
  mma:'<path d="M7 11V7.5A4.5 4.5 0 0 1 11.5 3h2A4.5 4.5 0 0 1 18 7.5V13a5 5 0 0 1-5 5h-2a4 4 0 0 1-4-4Z"/><path d="M7 11h3.5a2 2 0 0 1 0 4H7M8.5 18v3h7.5v-3.5M11 7h4"/>',
  padel:'<path d="M11 2.5c3.6 0 6 2.6 6 6.3 0 3.4-2.3 5.9-6 5.9s-6-2.5-6-5.9c0-3.7 2.4-6.3 6-6.3Z"/><path d="M11 14.7V21M9.4 21h3.2"/><path d="M9 6.5h.01M13 6.5h.01M11 9h.01M9 11.2h.01M13 11.2h.01" stroke-width="2.2"/><circle cx="19" cy="18" r="2.2"/>',
  gym:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  stop:'<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
  lap:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6l1.5-1.5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  other:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  play:'<path d="M8 5v14l11-7Z" fill="currentColor"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  locate:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="7"/>'
};
function runIcon(key){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RUN_ICON_PATHS[key]||RUN_ICON_PATHS.other}</svg>`}
function runTypeInfo(id){
  if(typeof runActivityType==='function')return runActivityType(id||'run');
  return {id:'run',de:'Laufen',en:'Run',icon:'run',gps:true,category:'run'};
}
function runTypeName(t){return state.language==='en'?t.en:t.de}
function runTypeList(){if(typeof runPickableActivities==='function')return runPickableActivities();return typeof RUN_ACTIVITIES!=='undefined'&&Array.isArray(RUN_ACTIVITIES)?RUN_ACTIVITIES:[runTypeInfo('run')]}
function runCurrentType(){return runTypeInfo(state.activeRun?.type||runViewType||state.runSettings?.lastType||'run')}
function runWeight(){return typeof runLatestWeight==='function'?runLatestWeight(state,today()):null}
function runKcal(type,movingSeconds,distanceKm,ascentM){if(typeof runCaloriesEstimate!=='function')return null;try{let v=runCaloriesEstimate({type,movingSeconds,distanceKm,weightKg:runWeight(),ascentM});return Number.isFinite(v)?Math.min(20000,Math.max(0,Math.round(v))):null}catch{return null}}
// Entwurf der Zusammenfassung (Gefühl, Untergrund, Notiz, Ersatzdistanz) lokal sichern, damit ein Neuladen nichts verliert.
function runDraftSave(){if(!runSummary)return;try{if(typeof firstRunPreview!=='undefined'&&firstRunPreview)return;localStorage.setItem('puls-run-summary',JSON.stringify({key:runSummary.key,feeling:runSummary.feeling,terrain:runSummary.terrain,note:runSummary.note,manualKm:runSummary.manualKm}))}catch{}}
function runDraftLoad(key){try{if(typeof firstRunPreview!=='undefined'&&firstRunPreview)return null;let d=JSON.parse(localStorage.getItem('puls-run-summary'));return d?.key===key?d:null}catch{return null}}
function runDraftClear(){try{if(typeof firstRunPreview!=='undefined'&&firstRunPreview)return;localStorage.removeItem('puls-run-summary')}catch{}}

// Öffnen / Schließen
function openRunView(){if(modal.open)modal.close();runView=state.activeRun?'live':'ready';if(runView==='ready'){runViewType=state.runSettings?.lastType||runViewType||'run';runPreviewStart()}renderRunView()}
function closeRunView(){if(runView==='countdown')runCountdownCancel();runPreviewStop();runView=null;renderRunView();render()}
function renderRunView(){
  if(runView==='live'&&!state.activeRun)runView=runSummary?'summary':null;
  if(runView&&state.activeRun&&runView==='ready')runView='live';
  document.querySelectorAll('main,aside').forEach(el=>el.inert=!!runView);
  let root=$('run-root');
  if(!runView){root?.remove();document.body.classList.remove('runviewopen');runViewMapKey='';return}
  if(!root){root=document.createElement('div');root.id='run-root';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');document.body.append(root)}
  document.body.classList.add('runviewopen');
  let html=runView==='ready'?runReadyHtml():runView==='countdown'?runCountdownHtml():runView==='live'?runLiveHtml():runSummaryHtml();
  // Karte nur neu aufbauen, wenn sich Ansicht oder Route ändern (sonst flackert sie bei Pause/Weiter).
  let mapKey=runView+':'+(state.activeRun?.routeId||runViewRouteId||'')+':'+runCurrentType().gps,keepMap=runViewMapKey===mapKey&&root.querySelector('#runviewmap')&&runView!=='summary';
  let map=keepMap?root.querySelector('#runviewmap'):null;
  if(runView!=='live')runLocked=false;
  // Neuaufbau (Pause/Weiter, Sperre, Sync) zeigt wieder „Beenden“ – die Bestätigung beginnt dann neu.
  runFinishArm=0;clearTimeout(runFinishTimer);
  root.className='runview '+runView+(state.activeRun?.pausedAt?' paused':'')+(runView==='live'&&state.activeRun?' kind-'+runLiveKind(state.activeRun):'')+(runLocked?' locked':'');root.innerHTML=html;
  if(map){let slot=root.querySelector('#runviewmap');slot?.replaceWith(map);map.inert=false;map.removeAttribute('aria-hidden')}else{runViewMapKey=mapKey;runMountViewMap()}
  if(runView==='live'){runSheetBind();runLockBind()}
  updateRunLive();runViewTick();
}
function runMountViewMap(){
  if(!$('runviewmap'))return;
  if(runView==='live'&&typeof runLiveMapMount==='function'){runLiveMapMount('runviewmap');return}
  if(runView==='summary'){runMountSummaryMap();return}
  if(typeof runMountMap!=='function')return;
  runMountMap('runviewmap',map=>{
    runPreviewMap=map;map.attributionControl.setPosition('topleft');let route=runRouteById(runViewRouteId);
    if(route){let line=L.polyline(runLineLatLngs(route.line),{color:runAccent(),weight:5,opacity:.9}).addTo(map);map.fitBounds(line.getBounds(),{padding:[30,30]})}
    else{let v=runDefaultView(),here=Number.isFinite(runPreviewPos?.lat);map.setView(here?[runPreviewPos.lat,runPreviewPos.lon]:v.center,here?16:v.zoom)}
    runPreviewDraw();
  });
}

// Standort vor dem Start (Karte + GPS-Stärke). iOS-App: nativ (runLocate), Browser: watchPosition.
let runPreviewPos=null,runPreviewMap=null,runPreviewDot=null;
window.pulsRunLocateReceive=function(data){if(data?.status==='denied'){runPreviewPos={denied:true};runViewTick();return}if(Number.isFinite(data?.lat)&&Number.isFinite(data?.lon)){let first=!runPreviewPos?.lat;runPreviewPos={lat:data.lat,lon:data.lon,acc:data.acc};runPreviewDraw(first);runViewTick()}};
function runPreviewStart(){
  runPreviewStop();let bridge=runNativeBridge(),native=bridge&&(window.pulsNativeFeatures||[]).includes('runLocate');
  if(native){bridge.postMessage({type:'runLocate'});runPreviewTimer=setInterval(()=>bridge.postMessage({type:'runLocate'}),5000);return}
  if(navigator.geolocation)runPreviewWatch=navigator.geolocation.watchPosition(pos=>window.pulsRunLocateReceive({lat:pos.coords.latitude,lon:pos.coords.longitude,acc:pos.coords.accuracy}),error=>{if(error.code===1)window.pulsRunLocateReceive({status:'denied'})},{enableHighAccuracy:true,maximumAge:5000,timeout:30000});
}
function runPreviewStop(){if(runPreviewWatch!==null){navigator.geolocation?.clearWatch(runPreviewWatch);runPreviewWatch=null}clearInterval(runPreviewTimer);runPreviewTimer=null}
function runPreviewDraw(center){
  let map=runPreviewMap;if(!map||!document.body.contains(map.getContainer())||!runPreviewPos?.lat)return;
  let ll=[runPreviewPos.lat,runPreviewPos.lon];
  if(!runPreviewDot||!map.hasLayer(runPreviewDot))runPreviewDot=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:runAccent(),fillOpacity:1,className:'runlivedot'}).addTo(map);else runPreviewDot.setLatLng(ll);
  if(center&&!runViewRouteId)map.setView(ll,16);
}
function runPreviewRecenter(){if(runPreviewPos?.lat&&runPreviewMap)runPreviewMap.setView([runPreviewPos.lat,runPreviewPos.lon],16);else runPreviewStart()}
function runGpsChip(){
  if(!runCurrentType().gps)return '';let acc=runPreviewPos?.acc,state='search',label='GPS';
  if(runPreviewPos?.denied){state='off';label=runText('Standort aus','Location off')}else if(Number.isFinite(acc))state=acc<=15?'good':acc<=35?'ok':'weak';
  return `<span class="rungpschip ${state}"><i></i><i></i><i></i>${label}</span>`;
}

// Startansicht
function runReadyHtml(){
  let t=runCurrentType(),route=runRouteById(runViewRouteId);
  return `<div class="runviewmap ${t.gps?'':'nomap'}" id="${t.gps?'runviewmap':'runnomap'}">${t.gps?'':`<span class="runbigicon">${runIcon(t.icon)}</span>`}</div>
  <header class="runviewtop"><button type="button" class="runround" onclick="closeRunView()" aria-label="${runText('Schließen','Close')}">${runIcon('down')}</button><span data-rungpschip>${runGpsChip()}</span></header>
  ${t.gps?`<div class="runmaptools"><button type="button" class="runround runlocate" onclick="runPreviewRecenter()" aria-label="${runText('Auf mich zentrieren','Centre on me')}">${runIcon('locate')}</button>${runTrailsButton()}</div>`:''}
  <section class="runpanel">
    ${t.id==='mma'?runRoundsPanel():`<div class="runpanelstats"><div><strong>00:00</strong><small>${runText('Zeit','Time')}</small></div>${t.gps?`<div><strong>–</strong><small>${t.category==='run'?runText('Ø Pace','Avg pace'):runText('Ø km/h','Avg km/h')}</small></div><div><strong>${new Intl.NumberFormat(appLocale(),{minimumFractionDigits:2}).format(0)}</strong><small>${runText('Distanz (km)','Distance (km)')}</small></div>`:`<div><strong>–</strong><small>${runText('Kalorien','Calories')}</small></div>`}</div>`}
    ${route?`<div class="runroutechip">${runIcon('route')}<span>${esc(route.name)} · ${runKm(route.distanceKm)} km</span><button type="button" onclick="runSelectRoute(null)" aria-label="${runText('Route entfernen','Remove route')}">${uiIcon('x')}</button></div>`:''}
    <div class="runcontrols">
      <button type="button" class="runside" onclick="runTypePicker()"><span class="runsideicon">${runIcon(t.icon)}</span><small>${esc(runTypeName(t))}</small></button>
      <button type="button" class="runstart" onclick="runCountdownStart()" aria-label="${runText('Start','Start')}">${runIcon('play')}</button>
      <button type="button" class="runside" onclick="runRoutesSheet()" ${t.gps?'':'disabled'}><span class="runsideicon">${runIcon('route')}</span><small>${runText('Route','Route')}</small>${route?`<span class="dsvisuallyhidden">${runText('gewählt','selected')}</span>`:''}</button>
    </div>
  </section>`;
}
function runTypePicker(){
  let current=runCurrentType().id,groups={run:runText('Laufen & Gehen','Run & walk'),walk:runText('Laufen & Gehen','Run & walk'),ride:runText('Rad','Cycling'),other:runText('Weitere','More')};
  let list=runTypeList(),seen=new Set(),html='';
  for(let key of ['run','walk','ride','other']){let items=list.filter(t=>(t.category==='walk'?'run':t.category)===(key==='walk'?'run':key)&&!seen.has(t.id));if(!items.length||seen.has('group:'+groups[key]))continue;seen.add('group:'+groups[key]);items.forEach(t=>seen.add(t.id));
    html+=`<h3 class="runpickhead">${groups[key]}</h3>`+items.map(t=>`<button type="button" class="runpick ${t.id===current?'on':''}" onclick="runChooseType('${esc(t.id)}')"><span>${runIcon(t.icon)}</span>${esc(runTypeName(t))}${t.id===current?`<b>${uiIcon('check')}</b>`:''}</button>`).join('')}
  openModal(runText('Aktivität wählen','Choose activity'),`<div class="runpicklist">${html}</div>`);
}
function runChooseType(id){runViewType=id;state.runSettings={...(state.runSettings||{}),lastType:id};save();if(!runTypeInfo(id).gps)runViewRouteId=null;modal.close();runViewMapKey='';renderRunView()}
function runSelectRoute(id){runViewRouteId=id&&runRouteById(id)?id:null;if(modal.open)modal.close();if(!runView||runView==='ready'){runView='ready';if(!runPreviewTimer&&runPreviewWatch===null)runPreviewStart()}runViewMapKey='';renderRunView()}

// Countdown
function runCountdownStart(){runView='countdown';runCountdown={endsAt:Date.now()+10000,timer:setInterval(runCountdownTick,200)};renderRunView()}
function runCountdownAdd(){if(!runCountdown)return;runCountdown.endsAt+=10000;runCountdownTick()}
function runCountdownCancel(){clearInterval(runCountdown?.timer);runCountdown=null}
function runCountdownLeft(){return runCountdown?Math.max(0,Math.ceil((runCountdown.endsAt-Date.now())/1000)):0}
function runCountdownTick(){let left=runCountdownLeft(),el=document.querySelector('[data-runcount]');if(el&&el.textContent!==String(left)){el.textContent=left;el.classList.remove('tick');void el.offsetWidth;el.classList.add('tick');if(left<=3&&left>0&&typeof pulsHaptic==='function')pulsHaptic('light')}if(left<=0)runCountdownGo()}
function runCountdownGo(){runCountdownCancel();runPreviewStop();let t=runCurrentType();runView='live';runSheetOpen=false;runLocked=false;startRunTimer(!!t.gps,t.gps?runViewRouteId:null,t.id);if(t.id==='mma')runBeep('work');else if(typeof pulsHaptic==='function')pulsHaptic('success')}
function runCountdownHtml(){
  return `<div class="runviewmap blur" id="runviewmap"></div><div class="runcountdown"><small>${esc(runTypeName(runCurrentType()))}</small><strong data-runcount class="tick">${runCountdownLeft()}</strong><div class="runcountactions"><button type="button" class="btn secondary" onclick="runCountdownAdd()">+10 ${runText('Sekunden','seconds')}</button><button type="button" class="btn" onclick="runCountdownGo()">${runText('Jetzt starten','Start now')}</button></div><button type="button" class="textbtn" onclick="runCountdownCancel();runView='ready';renderRunView()">${runText('Abbrechen','Cancel')}</button></div>`;
}

// MMA: Runden vor dem Start einstellen (runRoundsSettings/runSetRounds in running.js).
function runShortClock(seconds){seconds=Math.max(0,Math.round(seconds));let h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):m+':'+String(s).padStart(2,'0')}
function runRoundsPanel(){
  let r=runRoundsSettings();
  return `<button type="button" class="runpanelstats runroundset" onclick="runRoundsForm()" aria-label="${runText('Runden einstellen','Set rounds')}"><div><strong>${r.count}</strong><small>${runText('Runden','Rounds')}</small></div><div><strong>${runShortClock(r.work)}</strong><small>${runText('Rundenlänge','Round length')}</small></div><div><strong>${runShortClock(r.rest)}</strong><small>${runText('Pause','Rest')}</small></div><span class="runroundedit">${runText('Ändern','Edit')}</span></button>`;
}
function runRoundsForm(){
  let r=runRoundsSettings(),opt=(values,current,label)=>values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${label(v)}</option>`).join('');
  let works=[...new Set([30,60,90,120,150,180,240,300,360,420,480,600,r.work])].sort((a,b)=>a-b),rests=[...new Set([0,15,30,45,60,90,120,180,r.rest])].sort((a,b)=>a-b),counts=[...new Set([...Array.from({length:12},(_,i)=>i+1),15,20,r.count])].sort((a,b)=>a-b);
  openModal(runText('Runden','Rounds'),`<form onsubmit="runRoundsSave(event)"><label>${runText('Rundenlänge','Round length')}<select id="runround-work">${opt(works,r.work,v=>runShortClock(v)+' min')}</select></label><label>${runText('Pause zwischen Runden','Rest between rounds')}<select id="runround-rest">${opt(rests,r.rest,v=>v?runShortClock(v)+' min':runText('Keine','None'))}</select></label><label>${runText('Anzahl Runden','Number of rounds')}<select id="runround-count">${opt(counts,r.count,v=>String(v))}</select></label><p class="note">${runText('Beim Wechsel zwischen Runde und Pause gibt es Ton und Vibration. „Nächste Runde“ springt sofort weiter.','Sound and vibration mark each switch between round and rest. “Next round” skips ahead immediately.')}</p><button class="btn full">${runText('Übernehmen','Apply')}</button></form>`);
}
function runRoundsSave(event){
  event.preventDefault();let rounds={work:Number($('runround-work').value),rest:Number($('runround-rest').value),count:Number($('runround-count').value)};
  if(!runSetRounds(rounds)){toast(runText('Bitte gültige Werte wählen','Please choose valid values'));return}
  modal.close();renderRunView();
}
// Rundenstand inkl. „Nächste Runde“: Jede Runde-Markierung (laps) startet sofort die nächste Runde; ohne Markierungen identisch mit runRoundState.
function runMmaState(run=state.activeRun,elapsed=runElapsed(run)){
  let {work,rest,count}=run?.rounds||runRoundsSettings(),round=1,start=0,doneAt=null;
  const settle=t=>{while(round<count&&t>=start+work+rest){start+=work+rest;round++}if(round===count&&t>=start+work&&doneAt===null)doneAt=start+work};
  for(let lap of run?.laps||[]){if(lap>elapsed)break;settle(lap);if(doneAt!==null)break;if(round<count){round++;start=lap}else{doneAt=lap;break}}
  if(doneAt===null)settle(elapsed);
  if(doneAt!==null&&elapsed>=doneAt)return {round:count,count,phase:'done',remainingSeconds:0,phaseSeconds:0};
  let within=elapsed-start;
  return within<work?{round,count,phase:'work',remainingSeconds:Math.ceil(work-within),phaseSeconds:work}:{round,count,phase:'rest',remainingSeconds:Math.ceil(work+rest-within),phaseSeconds:rest};
}
// Ton (WebAudio, kurz) + Vibration beim Phasenwechsel. Respektiert die Ton-Einstellung der App.
let runAudio=null;
function runBeep(kind){
  if(typeof pulsHaptic==='function')pulsHaptic(kind==='rest'?'warning':kind==='done'?'success':'heavy');
  if(state.soundEnabled===false)return;
  try{
    let A=window.AudioContext||window.webkitAudioContext;if(!A)return;
    let ctx=typeof pulsAudio!=='undefined'&&pulsAudio?pulsAudio:(runAudio??=new A());if(ctx.state!=='running')ctx.resume?.();
    let notes=kind==='work'?[[880,0,.16],[880,.22,.16],[1320,.44,.32]]:kind==='rest'?[[660,0,.22],[520,.28,.4]]:[[880,0,.18],[1100,.22,.18],[1320,.44,.5]],now=ctx.currentTime,vol=Math.max(.06,Math.min(1,(state.soundVolume??35)/100))*.32;
    for(let [hz,delay,duration] of notes){let osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='triangle';osc.frequency.value=hz;gain.gain.setValueAtTime(0,now+delay);gain.gain.linearRampToValueAtTime(vol,now+delay+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+delay);osc.stop(now+delay+duration+.03)}
  }catch{}
}
let runRoundSignal='';
function runRoundWatch(run){
  if(run?.type!=='mma'){runRoundSignal='';return}
  let s=runMmaState(run),key=run.startedAt+'|'+s.round+':'+s.phase,prefix=run.startedAt+'|';
  if(runRoundSignal.startsWith(prefix)&&runRoundSignal!==key&&!run.pausedAt)runBeep(s.phase);
  runRoundSignal=key;
}

// Live: Werte je Art. Laufen: Zeit, Distanz, Tempo, Ø-Tempo, kcal. Gehen/Wandern/Berg: Zeit, Distanz, Höhenmeter, Höhe, Ø km/h, kcal.
// Ohne GPS: große Zeit, kcal, Uhrzeit (MMA zusätzlich Runden). GPS-Arten: Vollbild-Karte mit hochziehbarer Wertekarte.
let runSheetOpen=false,runLocked=false,runFinishArm=0,runFinishTimer=null,runElevCache={key:'',gain:null,alt:null};
function runLiveKind(run){let t=runTypeInfo(run?.type);if(t.id==='mma')return 'mma';if(!run?.gps)return 'plain';return t.category==='run'?'run':'walk'}
function runLiveFields(kind){
  const f={time:runText('Zeit','Time'),dist:runText('Distanz (km)','Distance (km)'),pace:runText('Tempo (/km)','Pace (/km)'),avgpace:runText('Ø Tempo (/km)','Avg pace (/km)'),gain:runText('Höhenmeter','Elevation gain'),alt:runText('Höhe','Altitude'),speed:runText('Ø km/h','Avg km/h'),kcal:runText('kcal*','kcal*'),clock:runText('Uhrzeit','Time of day')};
  let keys=kind==='run'?['time','dist','pace','avgpace','kcal']:kind==='walk'?['time','dist','gain','alt','speed','kcal']:['kcal','clock'];
  return keys.map(k=>[k,f[k]]);
}
// Aktuelles Tempo: Strecke der letzten ~30 s im aktuellen Abschnitt; veraltete oder zu kurze Daten → keine Angabe.
function runCurrentPace(accepted){
  let last=accepted.at(-1);if(!last||Date.now()-last[0]>20000)return null;let i=accepted.length-1,m=0;
  while(i>0&&accepted[i-1][4]===last[4]&&last[0]-accepted[i-1][0]<=30000){m+=runMeters(accepted[i-1],accepted[i]);i--}
  let dt=(last[0]-accepted[i][0])/1000;return dt>=8&&m>=15?dt/(m/1000):null;
}
function runLiveData(run){
  let elapsed=runElapsed(run),kind=runLiveKind(run),d={time:formatClock(elapsed),clock:new Date().toLocaleTimeString(appLocale(),{hour:'2-digit',minute:'2-digit'})},km=0,gain=null;
  if(run.gps){
    let points=runTrackFor(run).points,accepted=runAcceptedPoints(points);
    for(let i=1;i<accepted.length;i++)if(accepted[i][4]===accepted[i-1][4])km+=runMeters(accepted[i-1],accepted[i])/1000;
    let ck=run.startedAt+':'+points.length;if(runElevCache.key!==ck){let e=typeof runElevation==='function'?runElevation(points):null,lastAlt=[...accepted].reverse().find(p=>Number.isFinite(p[5])&&p[6]>=0);runElevCache={key:ck,gain:e?.gain??null,alt:lastAlt?Math.round(lastAlt[5]):null}}
    gain=runElevCache.gain;
    let pace=run.pausedAt?null:runCurrentPace(accepted);
    d.dist=runKm(Math.round(km*100)/100);d.pace=pace?runPaceText(pace).replace(' /km',''):'–';d.avgpace=km>=.05?runPaceText(elapsed/km).replace(' /km',''):'–';
    d.gain=Number.isFinite(gain)?gain+' m':'–';d.alt=Number.isFinite(runElevCache.alt)?runElevCache.alt+' m':'–';d.speed=km>=.05&&elapsed>0?n(Math.round(km/(elapsed/3600)*10)/10):'–';
  }
  let kcal=runKcal(run.type,elapsed,km,gain);d.kcal=kcal===null?'–':String(kcal);
  if(kind==='mma'){let s=runMmaState(run,elapsed);d.roundleft=s.phase==='done'?runText('Fertig','Done'):runShortClock(s.remainingSeconds);d.phase=s.phase==='done'?runText(`Alle ${s.count} Runden geschafft`,`All ${s.count} rounds done`):runText(`Runde ${s.round} / ${s.count}`,`Round ${s.round} / ${s.count}`)+' · '+(s.phase==='work'?runText('Kampf','Fight'):runText('Pause','Rest'));d._round=s}
  else if(run.laps){let laps=run.laps,since=laps.at(-1)||0;d.lap=runText('Runde','Lap')+' '+(laps.length+1)+' · '+formatClock(Math.max(0,elapsed-since))}
  return d;
}
function runLiveTitle(run,t,route){return `<span class="runlivetitle">${runIcon(t.icon)}${esc(runTypeName(t))}${route?' · '+esc(route.name):''}</span>`}
function runLiveBar(run){
  let paused=!!run.pausedAt;
  if(run.gps&&!runOwnedHere(run))return `<footer class="runlivebar"><p class="note">${runText('Diese Aktivität zeichnet ein anderes Gerät auf – beende sie dort.','Another device is recording this activity – finish it there.')}</p></footer>`;
  return `<footer class="runlivebar"><button type="button" class="runbarbtn" onclick="runLockOn()"><span class="runbaricon">${runIcon('lock')}</span><small>${runText('Sperren','Lock')}</small></button><button type="button" class="runpausebtn ${paused?'resume':''}" onclick="toggleRunPause()" aria-label="${paused?runText('Weiter','Resume'):runText('Pause','Pause')}">${runIcon(paused?'play':'pause')}</button><button type="button" class="runbarbtn stop" data-runfinish onclick="runFinishTap()"><span class="runbaricon">${runIcon('stop')}</span><small data-runfinishlabel>${runText('Beenden','Finish')}</small></button></footer>`;
}
function runLockHtml(){
  if(!runLocked)return '';
  return `<div class="runlock" role="dialog" aria-modal="true" aria-label="${runText('Bildschirm gesperrt','Screen locked')}"><div class="runlocktime"><small>${runText('Gesperrt','Locked')}</small><strong data-runclock>${formatClock(runElapsed())}</strong></div><button type="button" class="rununlock" data-rununlock aria-label="${runText('Zum Entsperren 1 Sekunde halten','Hold for 1 second to unlock')}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="44"/><circle class="prog" cx="50" cy="50" r="44"/></svg><span>${runIcon('lock')}</span></button><p>${runText('Zum Entsperren 1 s halten','Hold 1 s to unlock')}</p></div>`;
}
function runLiveHtml(){
  let run=state.activeRun,t=runTypeInfo(run.type),paused=!!run.pausedAt,route=runRouteById(run.routeId),kind=runLiveKind(run),data=runLiveData(run);
  let top=`<header class="runviewtop ${run.gps?'floating':'solid'}"><button type="button" class="runround" onclick="closeRunView()" aria-label="${runText('Minimieren','Minimise')}">${runIcon('down')}</button>${runLiveTitle(run,t,route)}<span class="runlivestate">${paused?runText('Pausiert','Paused'):runText('Läuft','Live')}</span></header>`;
  let val=([k,label],cls='')=>`<div class="runval ${cls}"><strong data-runval="${k}">${esc(data[k]??'–')}</strong><small>${esc(label)}</small></div>`;
  if(run.gps){
    let fields=runLiveFields(kind),more=fields.slice(2);
    return `<div class="runviewmap livemap" id="runviewmap"></div>${top}
    <div class="runmaptools"><button type="button" class="runround runlocate" onclick="runLiveRecenter()" aria-label="${runText('Auf mich zentrieren','Centre on me')}">${runIcon('locate')}</button>${runTrailsButton()}</div>
    <section class="runsheet ${runSheetOpen?'open':''}" id="runsheet">
      <button type="button" class="runsheetgrip" data-runsheetgrip aria-expanded="${runSheetOpen}" aria-controls="runsheetmore" aria-label="${runSheetOpen?runText('Werte einklappen','Collapse values'):runText('Alle Werte zeigen','Show all values')}"><i></i></button>
      <div class="runsheetmain">${fields.slice(0,2).map(f=>val(f,'primary')).join('')}</div>
      <div class="runsheetmore" id="runsheetmore"><div class="runsheetmoreinner m${more.length}">${more.map(f=>val(f)).join('')}</div></div>
      <div class="runsheetfoot"><p class="rungpsline" data-rungps></p>${runOwnedHere(run)?`<button type="button" class="runlapbtn" onclick="runLiveLap()" aria-label="${runText('Runde markieren','Mark lap')}">${runIcon('lap')}<span data-runval="lap">${esc(data.lap||runText('Runde','Lap'))}</span></button>`:''}</div>
      ${runLiveBar(run)}
    </section>${runLockHtml()}`;
  }
  let mma=kind==='mma'?`<div class="runroundbox ${data._round.phase}" data-runroundbox><small data-runval="phase">${esc(data.phase)}</small><strong data-runval="roundleft">${esc(data.roundleft)}</strong><div class="runroundbar"><i data-runroundbar></i></div></div>`:'';
  return `${top}<div class="runplain ${kind}">${kind==='plain'?`<span class="runplainicon">${runIcon(t.icon)}</span>`:''}${mma}
    <div class="runliveclock"><strong data-runclock>${formatClock(runElapsed())}</strong><small>${runText('Dauer','Duration')}</small></div>
    <div class="runplainvals">${runLiveFields(kind).map(f=>val(f)).join('')}</div>
    ${kind==='mma'&&data._round.phase!=='done'?`<button type="button" class="runlapbtn big" onclick="runLiveLap()">${runText('Nächste Runde','Next round')}</button>`:''}
  </div>${runLiveBar(run)}${runLockHtml()}`;
}
// Jede Sekunde (running.js updateRunLive): Zahlen ohne Neuaufbau aktualisieren; MMA-Signale auch bei minimierter Ansicht.
function runViewTick(){
  let chip=document.querySelector('[data-rungpschip]');if(chip){let html=runGpsChip();if(chip.innerHTML!==html)chip.innerHTML=html}
  let run=state.activeRun;if(!run)return;
  runRoundWatch(run);
  if(runView!=='live')return;
  let data=runLiveData(run);
  document.querySelectorAll('#run-root [data-runval]').forEach(x=>{let v=data[x.dataset.runval];if(v!==undefined&&x.textContent!==v)x.textContent=v});
  let s=data._round,box=document.querySelector('[data-runroundbox]');
  if(s&&box){if(!box.classList.contains(s.phase)){box.classList.remove('work','rest','done');box.classList.add(s.phase);if(s.phase==='done')document.querySelector('#run-root .runlapbtn.big')?.remove()}let bar=box.querySelector('[data-runroundbar]'),w=s.phaseSeconds?Math.round((1-s.remainingSeconds/s.phaseSeconds)*1000)/10+'%':'100%';if(bar&&bar.style.width!==w)bar.style.width=w}
}
// Runde / Zwischenzeit (GPS) bzw. nächste Runde (MMA): kumulative aktive Sekunden in activeRun.laps.
function runLiveLap(){
  let run=state.activeRun;if(!run)return;
  if(run.type==='mma'&&runMmaState(run).phase==='done')return;
  let before=run.laps?.length||0,at=runAddLap();if(at===null){toast(runText('Gerade eben schon markiert','Just marked'));return}
  if(run.type==='mma'){runViewTick();return}
  let prev=run.laps[before-1]||0;if(typeof pulsHaptic==='function')pulsHaptic('medium');
  toast(runText('Runde','Lap')+' '+(before+1)+' · '+formatClock(at-prev));
  if(!document.querySelector('#run-root .runlapbtn'))renderRunView();else runViewTick();
}
// Beenden mit Bestätigung: erstes Tippen fragt nach, zweites Tippen (innerhalb 3 s) beendet.
function runFinishTap(){
  let button=document.querySelector('[data-runfinish]'),label=document.querySelector('[data-runfinishlabel]');
  if(Date.now()-runFinishArm<3000){clearTimeout(runFinishTimer);runFinishArm=0;if(label&&state.activeRun?.gps)label.textContent=runText('GPS wird abgeschlossen …','Finishing GPS …');if(button)button.disabled=true;finishRunTimer();return}
  runFinishArm=Date.now();button?.classList.add('armed');if(label)label.textContent=runText('Nochmal tippen','Tap again');if(typeof pulsHaptic==='function')pulsHaptic('warning');
  clearTimeout(runFinishTimer);runFinishTimer=setTimeout(()=>{runFinishArm=0;let b=document.querySelector('[data-runfinish]'),l=document.querySelector('[data-runfinishlabel]');b?.classList.remove('armed');if(l&&!b?.disabled)l.textContent=runText('Beenden','Finish')},3000);
}
// Hochziehbare Wertekarte: Ziehen am Griff (nach oben = ausklappen, nach unten = einklappen) oder Antippen.
function runSheetSet(open){
  runSheetOpen=open;let sheet=$('runsheet');if(!sheet)return;sheet.classList.toggle('open',open);sheet.style.transform='';
  let grip=sheet.querySelector('[data-runsheetgrip]');if(grip){grip.setAttribute('aria-expanded',String(open));grip.setAttribute('aria-label',open?runText('Werte einklappen','Collapse values'):runText('Alle Werte zeigen','Show all values'))}
}
function runSheetBind(){
  let sheet=$('runsheet'),grip=sheet?.querySelector('[data-runsheetgrip]');if(!sheet||!grip)return;
  let startY=null,dy=0,moved=false,onGrip=false;
  const down=e=>{if(e.target.closest('button:not([data-runsheetgrip])'))return;startY=e.clientY;dy=0;moved=false;onGrip=!!e.target.closest('[data-runsheetgrip]');sheet.classList.add('dragging');try{sheet.setPointerCapture(e.pointerId)}catch{}};
  const move=e=>{if(startY===null)return;dy=e.clientY-startY;if(Math.abs(dy)>6)moved=true;if(moved){let limit=runSheetOpen?Math.max(0,Math.min(160,dy)):Math.min(0,Math.max(-120,dy))*.6;sheet.style.transform=limit?`translateY(${limit}px)`:''}};
  const up=()=>{if(startY===null)return;sheet.classList.remove('dragging');let wasTap=!moved;startY=null;
    if(wasTap){if(onGrip)runSheetSet(!runSheetOpen);else sheet.style.transform='';return}
    if(dy<-30)runSheetSet(true);else if(dy>30)runSheetSet(false);else runSheetSet(runSheetOpen)};
  sheet.addEventListener('pointerdown',down);sheet.addEventListener('pointermove',move);sheet.addEventListener('pointerup',up);sheet.addEventListener('pointercancel',()=>{startY=null;sheet.classList.remove('dragging');runSheetSet(runSheetOpen)});
  // Tastatur: Griff ist ein normaler Button (Enter/Leertaste lösen click aus, Zeiger-Tippen wird oben behandelt).
  grip.addEventListener('click',e=>{if(e.detail===0)runSheetSet(!runSheetOpen)});
}
// Sperre: Overlay fängt alle Berührungen ab; Entsperren durch 1 s Halten (Fortschrittsring).
function runLockOn(){runLocked=true;runFinishArm=0;if(typeof pulsHaptic==='function')pulsHaptic('medium');renderRunView()}
function runLockBind(){
  let button=document.querySelector('[data-rununlock]');if(!button)return;let timer=null,lock=button.closest('.runlock');
  // Gesperrt: alles hinter dem Overlay unerreichbar (auch per Tastatur/Bildschirmleser), Fokus bleibt im Overlay.
  [...($('run-root')?.children||[])].forEach(el=>{if(el!==lock){el.inert=true;el.setAttribute('aria-hidden','true')}});
  lock?.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();button.focus({preventScroll:true})}});
  const start=e=>{e.preventDefault();if(timer)return;button.classList.add('holding');timer=setTimeout(()=>{timer=null;runLocked=false;if(typeof pulsHaptic==='function')pulsHaptic('success');renderRunView()},1000)};
  const stop=()=>{clearTimeout(timer);timer=null;button.classList.remove('holding')};
  button.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(t=>button.addEventListener(t,stop));
  button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)start(e)});button.addEventListener('keyup',stop);
  button.addEventListener('contextmenu',e=>e.preventDefault());
  button.closest('.runlock')?.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-rununlock]'))e.preventDefault()});
  setTimeout(()=>button.focus({preventScroll:true}),50);
}
function runLapsHtml(laps,duration){
  if(!Array.isArray(laps)||!laps.length)return '';let marks=[...laps.filter(t=>t>0&&t<duration),duration],parts=marks.map((t,i)=>t-(marks[i-1]||0)).filter(x=>x>0);if(parts.length<2)return '';let fastest=Math.min(...parts);
  return `<h3>${runText('Runden','Laps')}</h3><div class="runsplits">${parts.map((s,i)=>`<div class="runsplit ${s===fastest?'best':''}"><span>${i+1}</span><div><i style="width:${Math.max(18,fastest/s*100)}%"></i></div><strong>${formatClock(s)}</strong></div>`).join('')}</div>`;
}

// Zusammenfassung
const RUN_FEELINGS=[[1,'smiley-x-eyes','Erschöpft','Exhausted'],[2,'smiley-sad','Schwer','Hard'],[3,'smiley-meh','Normal','Normal'],[4,'smiley','Gut','Good'],[5,'lightning','Stark','Strong']];
const RUN_TERRAINS=[['road','Straße','Road'],['forest','Wald','Forest'],['mixed','Gemischt','Mixed'],['trail','Trail','Trail'],['track','Bahn','Track'],['treadmill','Laufband','Treadmill']];
function runOpenSummary(run,points,km){
  let previous=runSummary?.key===run.startedAt?runSummary:runDraftLoad(run.startedAt);
  let moving=Math.max(1,runElapsed(run)),pause=Math.max(0,Math.round(((run.pausedAt||Date.now())-run.startedAt)/1000-moving)),elev=typeof runElevation==='function'&&run.gps?runElevation(points):null;
  runSummary={key:run.startedAt,type:run.type||'run',km,moving,pause,elev,maxSpeed:typeof runMaxSpeed==='function'&&run.gps?runMaxSpeed(points):null,feeling:previous?.feeling??null,terrain:previous?.terrain??null,note:previous?.note||'',manualKm:previous?.manualKm||''};
  runSummary.kcal=runKcal(runSummary.type,moving,km,elev?.gain);
  runView='summary';renderRunView();$('run-root')?.scrollTo(0,0);
}
function runDetailRows(x){
  let speed=x.km>0?x.km/(x.moving/3600):null,rows=[
    [runText('Ø Pace','Avg pace'),x.km>0?runPaceText(x.moving/x.km):'–'],
    [runText('Ø Geschwindigkeit','Avg speed'),speed?n(Math.round(speed*10)/10)+' km/h':'–'],
    [runText('Max. Geschwindigkeit','Max speed'),Number.isFinite(x.maxSpeed)?n(x.maxSpeed)+' km/h':'–'],
    [runText('Höhenmeter','Elevation gain'),Number.isFinite(x.gain)?Math.round(x.gain)+' m':'–'],
    [runText('Max. Höhe','Max elevation'),Number.isFinite(x.max)?Math.round(x.max)+' m':'–'],
    [runText('Pause','Paused'),formatClock(x.pause||0)],
    [runText('Kalorien (geschätzt)','Calories (estimate)'),Number.isFinite(x.kcal)?x.kcal+' kcal':runText('– · Gewicht eintragen','– · add body weight')]];
  return `<div class="rundetaillist">${rows.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>`;
}
function runSplitsHtml(splits,rest){
  if(!splits?.length)return '';let fastest=Math.min(...splits);
  return `<h3>${runText('Kilometerzeiten','Splits')}</h3><div class="runsplits">${splits.map((s,i)=>`<div class="runsplit ${s===fastest&&splits.length>1?'best':''}"><span>${i+1}</span><div><i style="width:${Math.max(18,fastest/s*100)}%"></i></div><strong>${runPaceText(s)}</strong></div>`).join('')}${rest?`<div class="runsplit rest"><span>${runKm(rest[0]/1000)}</span><div><i style="width:${Math.max(18,fastest/(rest[1]/(rest[0]/1000))*100)}%"></i></div><strong>${runPaceText(rest[1]/(rest[0]/1000))}</strong></div>`:''}</div>`;
}
function runSummaryHtml(){
  let x=runSummary,run=state.activeRun;if(!x||!run)return '';let t=runTypeInfo(x.type),start=new Date(run.startedAt);
  let when=start.toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'})+' · '+start.toLocaleTimeString(appLocale(),{hour:'2-digit',minute:'2-digit'});
  let splits=runPendingSplits;
  return `<header class="runviewtop solid"><button type="button" class="btn secondary runresume" onclick="runSummaryResume()">${runText('Weiter','Resume')}</button><span class="runlivetitle">${runText('Speichern','Save')}</span><span></span></header>
  <div class="runsummary">
    <p class="runsumwhen">${runIcon(t.icon)} ${esc(runTypeName(t))} · ${esc(when)}</p>
    ${runPendingRoute?`<div class="runviewmap summarymap" id="runviewmap"></div>`:''}
    <div class="runsumbig">${t.gps?`<div><strong>${runKm(x.km)}</strong><small>km</small></div>`:''}<div><strong>${formatClock(x.moving)}</strong><small>${runText('Dauer','Duration')}</small></div><div><strong>${Number.isFinite(x.kcal)?x.kcal:'–'}</strong><small>kcal*</small></div></div>
    ${t.gps&&x.km<.01?`<label class="runkmfix">${runText('GPS hat keine Strecke erfasst – Distanz in km (optional)','GPS recorded no distance – distance in km (optional)')}<input id="runsum-km" type="number" inputmode="decimal" min="0" max="1000" step="0.01" placeholder="0,00" value="${esc(x.manualKm||'')}" oninput="runSummary.manualKm=this.value;runDraftSave()"></label>`:''}
    <h3>${runText('Wie hat es sich angefühlt?','How did it feel?')}</h3>
    <div class="runfeel">${RUN_FEELINGS.map(([v,e,de,en])=>`<button type="button" class="${x.feeling===v?'on':''}" onclick="runSummarySet('feeling',${v})" aria-pressed="${x.feeling===v}"><span aria-hidden="true">${uiIcon(e)}</span><small>${state.language==='en'?en:de}</small></button>`).join('')}</div>
    ${t.category!=='other'?`<h3>${runText('Untergrund','Terrain')}</h3><div class="runchips">${RUN_TERRAINS.map(([k,de,en])=>`<button type="button" class="${x.terrain===k?'on':''}" onclick="runSummarySet('terrain','${k}')">${state.language==='en'?en:de}</button>`).join('')}</div>`:''}
    <label class="runnote">${runText('Notiz (optional)','Note (optional)')}<textarea id="runsum-note" maxlength="200" rows="2" oninput="runSummary.note=this.value;runDraftSave()" placeholder="${runText('z. B. Intervalle, Wetter, Schuhe','e.g. intervals, weather, shoes')}">${esc(x.note||'')}</textarea></label>
    <h3>${runText('Details','Details')}</h3>
    ${runDetailRows({km:x.km,moving:x.moving,maxSpeed:x.maxSpeed,gain:x.elev?.gain,max:x.elev?.max,pause:x.pause,kcal:x.kcal})}
    ${runSplitsHtml(splits?.splits,splits?.restMeters?[splits.restMeters,splits.restSeconds]:null)}
    ${x.type!=='mma'?runLapsHtml(run.laps,x.moving):''}
    <p class="note">* ${runText('Kalorien sind eine Schätzung aus Aktivität, Zeit, Tempo und deinem letzten Gewicht.','Calories are an estimate from activity, time, pace and your latest body weight.')}</p>
  </div>
  <footer class="runlivebar stacked"><button type="button" class="btn full" onclick="runSummarySave()">${runText('Aktivität speichern','Save activity')}</button><button type="button" class="textbtn rundiscard" onclick="runSummaryDiscard()">${runText('Verwerfen','Discard')}</button></footer>`;
}
function runSummarySet(key,value){if(!runSummary)return;runSummary.note=$('runsum-note')?.value??runSummary.note;runSummary[key]=runSummary[key]===value?null:value;runDraftSave();let y=$('run-root')?.scrollTop;renderRunView();if(y)$('run-root').scrollTop=y}
function runSummaryResume(){runSummary&&(runSummary.note=$('runsum-note')?.value||'');runView='live';toggleRunPause()}
function runSummaryDiscard(){if(discardRunTimer()){runSummary=null;runDraftClear();runView=null;renderRunView()}}
function runSummarySave(){
  let x=runSummary;if(!x||!state.activeRun)return;
  // Inzwischen andere Aktivität (z. B. per Sync übernommen): alte Zusammenfassung nicht darauf speichern.
  if(x.key!==state.activeRun.startedAt){runSummary=null;runView='live';renderRunView();toast(runText('Die Aktivität hat sich geändert – bitte erneut beenden.','The activity changed – please finish again.'));return}
  let note=($('runsum-note')?.value||'').trim().slice(0,200),km=x.km;
  let fixValue=$('runsum-km')?.value??x.manualKm;if(!(x.km>=.01)&&fixValue!==''&&fixValue!==undefined&&fixValue!==null){let v=Number(fixValue);if(!(v>=0&&v<=1000)){toast(runText('Bitte eine gültige Distanz eingeben','Please enter a valid distance'));return}km=Math.round(v*100)/100;x.kcal=runKcal(x.type,x.moving,km,x.elev?.gain)}
  let saved=commitRunActivity({distanceKm:km,durationSeconds:Math.min(172800,x.moving),pauseSeconds:Math.min(172800,x.pause),kcal:Number.isFinite(x.kcal)?x.kcal:undefined,feeling:x.feeling||undefined,terrain:x.terrain||undefined,note:note||undefined,elevationGain:Number.isFinite(x.elev?.gain)?Math.round(x.elev.gain):undefined,elevationMax:Number.isFinite(x.elev?.max)?Math.round(x.elev.max):undefined,maxSpeed:Number.isFinite(x.maxSpeed)?x.maxSpeed:undefined});
  runSummary=null;runDraftClear();runView=null;renderRunView();if(saved)activityDoneShow(saved.id);
}
function runMountSummaryMap(){
  if(!runPendingRoute||typeof runMountMap!=='function')return;
  runMountMap('runviewmap',map=>{let segs=runRoutePoints(runPendingRoute),line=L.polyline(segs,{color:runAccent(),weight:5}).addTo(map);L.circleMarker(segs[0][0],{radius:6,color:'#fff',weight:2,fillColor:'#34C759',fillOpacity:1}).addTo(map);L.circleMarker(segs.at(-1).at(-1),{radius:6,color:'#fff',weight:2,fillColor:'#FF3B30',fillOpacity:1}).addTo(map);map.fitBounds(line.getBounds(),{padding:[18,18]})});
}

// Gespeicherte Aktivität ansehen und nachträglich Gefühl, Untergrund, Notiz ändern.
function runDetail(id){
  let r=runList().find(x=>x.id===id);if(!r)return;let t=runTypeInfo(r.type),start=r.startedAt?new Date(r.startedAt):new Date(r.date+'T12:00:00');
  let when=start.toLocaleDateString(appLocale(),{weekday:'long',day:'numeric',month:'long'})+(r.startedAt?' · '+start.toLocaleTimeString(appLocale(),{hour:'2-digit',minute:'2-digit'}):'');
  let feel=RUN_FEELINGS.find(f=>f[0]===r.feeling),terrain=RUN_TERRAINS.find(x=>x[0]===r.terrain);
  openModal(runTypeName(t),`${r.route?`<div class="runmap detail" id="rundetailmap"></div>`:''}<p class="rundetaildate">${esc(when)}${feel?' · '+(state.language==='en'?feel[3]:feel[2]):''}${terrain?' · '+(state.language==='en'?terrain[2]:terrain[1]):''}</p><div class="runsumbig compact">${r.distanceKm>0?`<div><strong>${runKm(r.distanceKm)}</strong><small>km</small></div>`:''}<div><strong>${formatClock(r.durationSeconds)}</strong><small>${runText('Dauer','Duration')}</small></div><div><strong>${Number.isFinite(r.kcal)?r.kcal:'–'}</strong><small>kcal*</small></div></div>${r.note?`<p class="note">${esc(r.note)}</p>`:''}${runDetailRows({km:r.distanceKm,moving:r.durationSeconds,maxSpeed:r.maxSpeed,gain:r.elevationGain,max:r.elevationMax,pause:r.pauseSeconds,kcal:r.kcal})}${runSplitsHtml(r.splits,r.splitRest)}${r.type!=='mma'?runLapsHtml(r.laps,r.durationSeconds):''}<div class="runactions"><button type="button" class="btn secondary" onclick="runEditForm('${esc(r.id)}')">${runText('Bearbeiten','Edit')}</button>${r.route?`<button type="button" class="btn secondary" onclick="runSaveRouteFromRun('${esc(r.id)}')">${runText('Als Route sichern','Save as route')}</button>`:''}</div><p class="note">* ${runText('Kalorien geschätzt.','Calories estimated.')}</p>`);
  if(r.route&&typeof runMountMap==='function')runMountMap('rundetailmap',map=>{let segs=runRoutePoints(r.route),line=L.polyline(segs,{color:runAccent(),weight:5}).addTo(map);L.circleMarker(segs[0][0],{radius:6,color:'#fff',weight:2,fillColor:'#34C759',fillOpacity:1}).addTo(map);L.circleMarker(segs.at(-1).at(-1),{radius:6,color:'#fff',weight:2,fillColor:'#FF3B30',fillOpacity:1}).addTo(map);map.fitBounds(line.getBounds(),{padding:[18,18]})});
}
function runEditForm(id){
  let r=runList().find(x=>x.id===id);if(!r)return;
  let types=typeof runPickableActivities==='function'?runPickableActivities():runTypeList(),savedType=r.type??'run';
  if(!types.some(t=>t.id===savedType))types=[...types,{...runTypeInfo(savedType),id:savedType}];
  openModal(runText('Bearbeiten','Edit'),`<form onsubmit="runEditSave(event,'${esc(r.id)}')"><label>${runText('Aktivität','Activity')}<select id="runedit-type">${types.map(t=>`<option value="${esc(t.id)}" ${t.id===savedType?'selected':''}>${esc(runTypeName(t))}</option>`).join('')}</select></label><label>${runText('Gefühl','Feeling')}<select id="runedit-feel"><option value="">–</option>${RUN_FEELINGS.map(([v,e,de,en])=>`<option value="${v}" ${r.feeling===v?'selected':''}>${state.language==='en'?en:de}</option>`).join('')}</select></label><label>${runText('Untergrund','Terrain')}<select id="runedit-terrain"><option value="">–</option>${RUN_TERRAINS.map(([k,de,en])=>`<option value="${k}" ${r.terrain===k?'selected':''}>${state.language==='en'?en:de}</option>`).join('')}</select></label><label>${runText('Notiz','Note')}<input id="runedit-note" maxlength="200" value="${esc(r.note||'')}"></label><button class="btn full">${runText('Speichern','Save')}</button><button type="button" class="textbtn rundiscard" onclick="deleteRun('${esc(r.id)}')">${runText('Aktivität löschen','Delete activity')}</button></form>`);
}
function runEditSave(event,id){
  event.preventDefault();let r=runList().find(x=>x.id===id);if(!r)return;
  let type=$('runedit-type').value,feel=Number($('runedit-feel').value),terrain=$('runedit-terrain').value,note=$('runedit-note').value.trim().slice(0,200);
  if(/^[a-z]{2,20}$/.test(type))r.type=type;if(feel>=1&&feel<=5)r.feeling=feel;else delete r.feeling;if(RUN_TERRAINS.some(x=>x[0]===terrain))r.terrain=terrain;else delete r.terrain;if(note)r.note=note;else delete r.note;
  save();render();runDetail(id);toast(runText('Gespeichert','Saved'));
}

// Andere Vollbilder (laufendes Workout) setzen inert nach jedem render() zurück; solange die Aktivität offen ist, bleibt der Hintergrund gesperrt.
const runSessionRender=render;render=function(...args){let result=runSessionRender.apply(this,args);if(runView)document.querySelectorAll('main,aside').forEach(el=>el.inert=true);return result};
// Nach Neuladen mit laufender Aktivität: Ansicht wieder öffnen, damit Pause/Beenden sofort erreichbar sind.
if(state.activeRun&&runOwnedHere(state.activeRun)){runView='live';renderRunView()}
if(typeof quickAddActions!=='undefined'&&Array.isArray(quickAddActions)){let item=quickAddActions.find(x=>x[0]==='run');if(item){item[1]='Aktivität';item[2]='Laufen, Rad & mehr'}}
if(typeof englishUI==='object')Object.assign(englishUI,{'Aktivität':'Activity','Laufen, Rad & mehr':'Run, ride & more'});

// Endscreen nach dem Speichern einer Aktivität: gleiche Bausteine wie der Workout-Abschluss (#session-root, .completion),
// aber ohne Serie. XP und Werte kommen aus workoutAwards() und der gespeicherten Aktivität; es wird nichts neu vergeben.
let activityDoneId=null;
function activityDoneShow(id){if(!runList().some(x=>x.id===id))return;activityDoneId=id;$('toast').style.display='none';render();$('session-root')?.focus({preventScroll:true})}
function activityDoneClose(after){let id=activityDoneId;activityDoneId=null;let root=$('session-root');if(root)delete root.dataset.activityDone;render();if(after==='detail'&&id)runDetail(id)}
function activityDoneHtml(id){
  let r=runList().find(x=>x.id===id);if(!r)return '';
  let t=runTypeInfo(r.type??'run'),award=workoutAwards()[id]||{xp:0,wins:[]},level=xpProgress(totalWorkoutXP());
  let start=r.startedAt?new Date(r.startedAt):new Date(r.date+'T12:00:00'),when=start.toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'});
  let tiles=[];
  if(Number.isFinite(r.durationSeconds)&&r.durationSeconds>0)tiles.push([runText('Dauer','Duration'),formatClock(r.durationSeconds)]);
  tiles.push([runText('Fortschritt','Progress'),`+${award.xp} XP`]);
  if(t.gps&&r.distanceKm>0){tiles.push([runText('Distanz','Distance'),`${runKm(r.distanceKm)} km`]);if(r.durationSeconds>0)tiles.push(['Pace',runPaceText(runPace(r))])}
  if(Number.isFinite(r.kcal)&&r.kcal>0)tiles.push([runText('Kalorien','Calories'),`${r.kcal} kcal`]);
  return `<div class="completion activitydone"><button class="quiet completionclose" aria-label="${runText('Abschluss schließen','Close summary')}" onclick="activityDoneClose()">${uiIcon('x')}</button><div class="celebration" aria-hidden="true">${uiIcon('check-circle')}</div><h1>${runText('Stark gemacht!','Well done!')}</h1><p>${esc(runTypeName(t))} · ${esc(when)}</p><div class="completiontiles">${tiles.map(([label,value])=>`<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>${(award.wins||[]).map(x=>`<p class="recordwin">${uiIcon('arrow-up')} ${runText('Bestleistung','Personal best')} · ${esc(x)}</p>`).join('')}<h2>Level ${level.level}</h2><div class="completionxp" role="progressbar" aria-label="${runText('Level-Fortschritt','Level progress')}" aria-valuemin="0" aria-valuemax="${level.needed}" aria-valuenow="${level.current}"><i style="width:${level.current/level.needed*100}%"></i></div><p>${level.current} / ${level.needed} XP</p><button class="btn full completioncontinue" onclick="activityDoneClose()">${runText('Fertig','Done')}</button><button class="textbtn" onclick="activityDoneClose('detail')">${runText('Details ansehen','View details')}</button></div>`;
}
const activityDoneBase=renderWorkoutSession;renderWorkoutSession=function(...args){
  if(!activityDoneId)return activityDoneBase.apply(this,args);
  if(!runList().some(x=>x.id===activityDoneId)){activityDoneId=null;return activityDoneBase.apply(this,args)}
  document.querySelectorAll('main,aside').forEach(el=>el.inert=true);
  let root=sessionRoot();document.body.classList.add('sessionopen');
  if(root.dataset.activityDone!==activityDoneId){root.dataset.activityDone=activityDoneId;root.setAttribute('aria-label',runText('Aktivität abgeschlossen','Activity finished'));root.innerHTML=activityDoneHtml(activityDoneId);root.scrollTop=0}
};
