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
function runTypeList(){return typeof RUN_ACTIVITIES!=='undefined'&&Array.isArray(RUN_ACTIVITIES)?RUN_ACTIVITIES:[runTypeInfo('run')]}
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
  root.className='runview '+runView+(state.activeRun?.pausedAt?' paused':'');root.innerHTML=html;
  if(map){let slot=root.querySelector('#runviewmap');slot?.replaceWith(map)}else{runViewMapKey=mapKey;runMountViewMap()}
  updateRunLive();runViewTick();
}
function runMountViewMap(){
  if(!$('runviewmap'))return;
  if(runView==='live'&&typeof runLiveMapMount==='function'){runLiveMapMount('runviewmap');return}
  if(runView==='summary'){runMountSummaryMap();return}
  if(typeof runMountMap!=='function')return;
  runMountMap('runviewmap',map=>{
    runPreviewMap=map;let route=runRouteById(runViewRouteId);
    if(route){let line=L.polyline(runLineLatLngs(route.line),{color:runAccent(),weight:5,opacity:.9}).addTo(map);map.fitBounds(line.getBounds(),{padding:[30,30]})}
    else{let v=runDefaultView();map.setView(runPreviewPos?[runPreviewPos.lat,runPreviewPos.lon]:v.center,runPreviewPos?16:v.zoom)}
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
  ${t.gps?`<button type="button" class="runround runlocate" onclick="runPreviewRecenter()" aria-label="${runText('Auf mich zentrieren','Centre on me')}">${runIcon('locate')}</button>`:''}
  <section class="runpanel">
    <div class="runpanelstats"><div><strong>00:00</strong><small>${runText('Zeit','Time')}</small></div><div><strong>–</strong><small>${runText('Ø Pace','Avg pace')}</small></div><div><strong>${t.gps?'0,00':'–'}</strong><small>${runText('Distanz (km)','Distance (km)')}</small></div></div>
    ${route?`<div class="runroutechip">${runIcon('route')}<span>${esc(route.name)} · ${runKm(route.distanceKm)} km</span><button type="button" onclick="runSelectRoute(null)" aria-label="${runText('Route entfernen','Remove route')}">✕</button></div>`:''}
    <div class="runcontrols">
      <button type="button" class="runside" onclick="runTypePicker()"><span class="runsideicon">${runIcon(t.icon)}</span><small>${esc(runTypeName(t))}</small></button>
      <button type="button" class="runstart" onclick="runCountdownStart()" aria-label="${runText('Start','Start')}">${runIcon('play')}</button>
      <button type="button" class="runside" onclick="runRoutesSheet()" ${t.gps?'':'disabled'}><span class="runsideicon">${runIcon('route')}</span><small>${route?runText('Route ✓','Route ✓'):runText('Route','Route')}</small></button>
    </div>
  </section>`;
}
function runTypePicker(){
  let current=runCurrentType().id,groups={run:runText('Laufen & Gehen','Run & walk'),walk:runText('Laufen & Gehen','Run & walk'),ride:runText('Rad','Cycling'),other:runText('Weitere','More')};
  let list=runTypeList(),seen=new Set(),html='';
  for(let key of ['run','walk','ride','other']){let items=list.filter(t=>(t.category==='walk'?'run':t.category)===(key==='walk'?'run':key)&&!seen.has(t.id));if(!items.length||seen.has('group:'+groups[key]))continue;seen.add('group:'+groups[key]);items.forEach(t=>seen.add(t.id));
    html+=`<h3 class="runpickhead">${groups[key]}</h3>`+items.map(t=>`<button type="button" class="runpick ${t.id===current?'on':''}" onclick="runChooseType('${esc(t.id)}')"><span>${runIcon(t.icon)}</span>${esc(runTypeName(t))}${t.id===current?'<b>✓</b>':''}</button>`).join('')}
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
function runCountdownGo(){runCountdownCancel();runPreviewStop();let t=runCurrentType();runView='live';startRunTimer(!!t.gps,t.gps?runViewRouteId:null,t.id);if(typeof pulsHaptic==='function')pulsHaptic('success')}
function runCountdownHtml(){
  return `<div class="runviewmap blur" id="runviewmap"></div><div class="runcountdown"><small>${esc(runTypeName(runCurrentType()))}</small><strong data-runcount class="tick">${runCountdownLeft()}</strong><div class="runcountactions"><button type="button" class="btn secondary" onclick="runCountdownAdd()">＋10 ${runText('Sekunden','seconds')}</button><button type="button" class="btn" onclick="runCountdownGo()">${runText('Jetzt starten','Start now')} →</button></div><button type="button" class="textbtn" onclick="runCountdownCancel();runView='ready';renderRunView()">${runText('Abbrechen','Cancel')}</button></div>`;
}

// Live
function runLiveHtml(){
  let run=state.activeRun,t=runTypeInfo(run.type),paused=!!run.pausedAt,route=runRouteById(run.routeId);
  return `<header class="runviewtop solid"><button type="button" class="runround" onclick="closeRunView()" aria-label="${runText('Minimieren','Minimise')}">${runIcon('down')}</button><span class="runlivetitle">${runIcon(t.icon)}${esc(runTypeName(t))}${route?' · '+esc(route.name):''}</span><span class="runlivestate">${paused?runText('Pausiert','Paused'):runText('Läuft','Live')}</span></header>
  <div class="runliveclock"><strong data-runclock>${formatClock(runElapsed())}</strong><small>${runText('Dauer','Duration')}</small></div>
  <div class="runlivegrid">${t.gps?`<div><strong data-rundistnum>0,00</strong><small>${runText('Distanz (km)','Distance (km)')}</small></div>`:''}<div><strong data-runkcal>–</strong><small>${runText('Kalorien','Calories')}*</small></div>${t.gps?`<div><strong data-runpacenum>–</strong><small>${runText('Ø Pace (min/km)','Avg pace (min/km)')}</small></div>`:''}</div>
  ${t.gps?`<div class="runviewmap" id="runviewmap"><button type="button" class="runround runlocate" onclick="runLiveRecenter()" aria-label="${runText('Auf mich zentrieren','Centre on me')}">${runIcon('locate')}</button></div><p class="rungpsline" data-rungps></p>`:`<div class="runviewmap nomap"><span class="runbigicon">${runIcon(t.icon)}</span></div>`}
  <footer class="runlivebar">${run.gps&&!runOwnedHere(run)?`<p class="note">${runText('Diese Aktivität zeichnet ein anderes Gerät auf – beende sie dort.','Another device is recording this activity – finish it there.')}</p>`:paused?`<button type="button" class="btn secondary" onclick="finishRunTimer()">${runText('Beenden','Finish')}</button><button type="button" class="btn" onclick="toggleRunPause()">${runText('Weiter','Resume')}</button>`:`<button type="button" class="runpausebtn" onclick="toggleRunPause()" aria-label="${runText('Pause','Pause')}">${runIcon('pause')}</button>`}</footer>`;
}
// Jede Sekunde (running.js updateRunLive): Zahlen ohne Neuaufbau aktualisieren.
function runViewTick(){
  let chip=document.querySelector('[data-rungpschip]');if(chip){let html=runGpsChip();if(chip.innerHTML!==html)chip.innerHTML=html}
  let run=state.activeRun;if(!run||runView!=='live')return;
  let elapsed=runElapsed(),km=run.gps?runGpsKm():0,kcal=runKcal(run.type,elapsed,km);
  let set=(sel,v)=>document.querySelectorAll(sel).forEach(x=>{if(x.textContent!==v)x.textContent=v});
  set('[data-rundistnum]',runKm(Math.round(km*100)/100));set('[data-runpacenum]',km>=.05?runPaceText(elapsed/km).replace(' /km',''):'–');set('[data-runkcal]',kcal===null?'–':String(kcal));
}

// Zusammenfassung
const RUN_FEELINGS=[[1,'😫','Erschöpft','Exhausted'],[2,'😕','Schwer','Hard'],[3,'🙂','Normal','Normal'],[4,'😀','Gut','Good'],[5,'💪','Stark','Strong']];
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
    [runText('Höhenmeter ↑','Elevation gain'),Number.isFinite(x.gain)?Math.round(x.gain)+' m':'–'],
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
    <div class="runfeel">${RUN_FEELINGS.map(([v,e,de,en])=>`<button type="button" class="${x.feeling===v?'on':''}" onclick="runSummarySet('feeling',${v})"><span>${e}</span><small>${state.language==='en'?en:de}</small></button>`).join('')}</div>
    ${t.category!=='other'?`<h3>${runText('Untergrund','Terrain')}</h3><div class="runchips">${RUN_TERRAINS.map(([k,de,en])=>`<button type="button" class="${x.terrain===k?'on':''}" onclick="runSummarySet('terrain','${k}')">${state.language==='en'?en:de}</button>`).join('')}</div>`:''}
    <label class="runnote">${runText('Notiz (optional)','Note (optional)')}<textarea id="runsum-note" maxlength="200" rows="2" oninput="runSummary.note=this.value;runDraftSave()" placeholder="${runText('z. B. Intervalle, Wetter, Schuhe','e.g. intervals, weather, shoes')}">${esc(x.note||'')}</textarea></label>
    <h3>${runText('Details','Details')}</h3>
    ${runDetailRows({km:x.km,moving:x.moving,maxSpeed:x.maxSpeed,gain:x.elev?.gain,max:x.elev?.max,pause:x.pause,kcal:x.kcal})}
    ${runSplitsHtml(splits?.splits,splits?.restMeters?[splits.restMeters,splits.restSeconds]:null)}
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
  runSummary=null;runDraftClear();runView=null;renderRunView();if(saved)runDetail(saved.id);
}
function runMountSummaryMap(){
  if(!runPendingRoute||typeof runMountMap!=='function')return;
  runMountMap('runviewmap',map=>{let segs=runRoutePoints(runPendingRoute),line=L.polyline(segs,{color:runAccent(),weight:5}).addTo(map);L.circleMarker(segs[0][0],{radius:6,color:'#fff',weight:2,fillColor:'#3ddc84',fillOpacity:1}).addTo(map);L.circleMarker(segs.at(-1).at(-1),{radius:6,color:'#fff',weight:2,fillColor:'#ff5c6c',fillOpacity:1}).addTo(map);map.fitBounds(line.getBounds(),{padding:[18,18]})});
}

// Gespeicherte Aktivität ansehen und nachträglich Gefühl, Untergrund, Notiz ändern.
function runDetail(id){
  let r=runList().find(x=>x.id===id);if(!r)return;let t=runTypeInfo(r.type),start=r.startedAt?new Date(r.startedAt):new Date(r.date+'T12:00:00');
  let when=start.toLocaleDateString(appLocale(),{weekday:'long',day:'numeric',month:'long'})+(r.startedAt?' · '+start.toLocaleTimeString(appLocale(),{hour:'2-digit',minute:'2-digit'}):'');
  let feel=RUN_FEELINGS.find(f=>f[0]===r.feeling),terrain=RUN_TERRAINS.find(x=>x[0]===r.terrain);
  openModal(runTypeName(t),`${r.route?`<div class="runmap detail" id="rundetailmap"></div>`:''}<p class="rundetaildate">${esc(when)}${feel?' · '+feel[1]+' '+(state.language==='en'?feel[3]:feel[2]):''}${terrain?' · '+(state.language==='en'?terrain[2]:terrain[1]):''}</p><div class="runsumbig compact">${r.distanceKm>0?`<div><strong>${runKm(r.distanceKm)}</strong><small>km</small></div>`:''}<div><strong>${formatClock(r.durationSeconds)}</strong><small>${runText('Dauer','Duration')}</small></div><div><strong>${Number.isFinite(r.kcal)?r.kcal:'–'}</strong><small>kcal*</small></div></div>${r.note?`<p class="note">${esc(r.note)}</p>`:''}${runDetailRows({km:r.distanceKm,moving:r.durationSeconds,maxSpeed:r.maxSpeed,gain:r.elevationGain,max:r.elevationMax,pause:r.pauseSeconds,kcal:r.kcal})}${runSplitsHtml(r.splits,r.splitRest)}<div class="runactions"><button type="button" class="btn secondary" onclick="runEditForm('${esc(r.id)}')">${runText('Bearbeiten','Edit')}</button>${r.route?`<button type="button" class="btn secondary" onclick="runSaveRouteFromRun('${esc(r.id)}')">${runText('Als Route sichern','Save as route')}</button>`:''}</div><p class="note">* ${runText('Kalorien geschätzt.','Calories estimated.')}</p>`);
  if(r.route&&typeof runMountMap==='function')runMountMap('rundetailmap',map=>{let segs=runRoutePoints(r.route),line=L.polyline(segs,{color:runAccent(),weight:5}).addTo(map);L.circleMarker(segs[0][0],{radius:6,color:'#fff',weight:2,fillColor:'#3ddc84',fillOpacity:1}).addTo(map);L.circleMarker(segs.at(-1).at(-1),{radius:6,color:'#fff',weight:2,fillColor:'#ff5c6c',fillOpacity:1}).addTo(map);map.fitBounds(line.getBounds(),{padding:[18,18]})});
}
function runEditForm(id){
  let r=runList().find(x=>x.id===id);if(!r)return;
  openModal(runText('Bearbeiten','Edit'),`<form onsubmit="runEditSave(event,'${esc(r.id)}')"><label>${runText('Aktivität','Activity')}<select id="runedit-type">${runTypeList().map(t=>`<option value="${esc(t.id)}" ${t.id===(r.type||'run')?'selected':''}>${esc(runTypeName(t))}</option>`).join('')}</select></label><label>${runText('Gefühl','Feeling')}<select id="runedit-feel"><option value="">–</option>${RUN_FEELINGS.map(([v,e,de,en])=>`<option value="${v}" ${r.feeling===v?'selected':''}>${e} ${state.language==='en'?en:de}</option>`).join('')}</select></label><label>${runText('Untergrund','Terrain')}<select id="runedit-terrain"><option value="">–</option>${RUN_TERRAINS.map(([k,de,en])=>`<option value="${k}" ${r.terrain===k?'selected':''}>${state.language==='en'?en:de}</option>`).join('')}</select></label><label>${runText('Notiz','Note')}<input id="runedit-note" maxlength="200" value="${esc(r.note||'')}"></label><button class="btn full">${runText('Speichern','Save')}</button><button type="button" class="textbtn rundiscard" onclick="deleteRun('${esc(r.id)}')">${runText('Aktivität löschen','Delete activity')}</button></form>`);
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
