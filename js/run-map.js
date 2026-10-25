/* Laufen mit Karte: Live-Karte im Lauf-Fenster, Detailansicht je Lauf (Karte, Kilometerzeiten, Pace, km/h)
   und Routenplaner. Leaflet liegt lokal in js/vendor und wird erst beim Öffnen einer Karte geladen.
   Kartenkacheln: OpenStreetMap (kostenlos, ohne Schlüssel, nur online), per CSS dunkel eingefärbt.
   Routen folgen Wegen über den kostenlosen BRouter-Dienst (Profil Wandern); ohne Netz gerade Linien.
   Daten: state.runRoutes [{id,name,line,waypoints,distanceKm,ascentM,createdAt}], optional. */

let runLeaflet=null,runLive={map:null,line:null,dot:null,follow:true},runPlan=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(!runLeaflet)runLeaflet=new Promise((resolve,reject)=>{
    let css=document.createElement('link');css.rel='stylesheet';css.href='css/vendor/leaflet.css';document.head.append(css);
    let script=document.createElement('script');script.src='js/vendor/leaflet.js';script.onload=()=>resolve(window.L);script.onerror=()=>{runLeaflet=null;reject(new Error('leaflet'))};document.head.append(script);
  });
  return runLeaflet;
}
function runAccent(){return getComputedStyle(document.body).getPropertyValue('--lime').trim()||'#bd91ff'}
function runBaseMap(el,options={}){
  let map=L.map(el,{zoomControl:false,attributionControl:true,...options});
  // OSM-Standardkacheln (kostenlos, ohne Schlüssel); dunkle Darstellung per CSS-Filter (.runtiles).
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:'runtiles',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  map.attributionControl.setPrefix(false);
  setTimeout(()=>map.invalidateSize(),320);
  return map;
}
async function runMountMap(id,setup){
  let el=$(id);if(!el)return null;
  try{await loadLeaflet()}catch{el.classList.add('offline');el.textContent=runText('Karte ist offline nicht verfügbar.','Map is not available offline.');return null}
  if(!document.body.contains(el)||el.dataset.ready)return null;el.dataset.ready='1';
  // Karte verschieben darf das Fenster nicht per Wischgeste schließen (interactions.js lauscht am Dialog).
  el.addEventListener('pointerdown',event=>event.stopPropagation());
  let map=runBaseMap(el);setup(map);return map;
}
function runLineLatLngs(line){return String(line||'').split(';').map(x=>x.split(',').map(Number)).filter(p=>p.length===2&&p.every(Number.isFinite))}
function runLineString(latlngs){return latlngs.map(p=>(+p[0]).toFixed(5)+','+(+p[1]).toFixed(5)).join(';')}
function runRouteList(){if(!Array.isArray(state.runRoutes))state.runRoutes=[];return state.runRoutes}
function runRouteById(id){return runRouteList().find(r=>r.id===id)||null}
// Startpunkt für neue Karten: letzte bekannte Strecke, sonst Deutschland.
function runDefaultView(){let r=[...runList()].reverse().find(x=>x.route),p=r?runRoutePoints(r.route)[0]?.[0]:runLineLatLngs(runRouteList().at(-1)?.line)[0];return p?{center:p,zoom:14}:{center:[51.16,10.45],zoom:6}}

// Live-Karte im Lauf-Fenster
function runLiveMapHtml(){return `<div class="runmap live" id="runlivemap"><button type="button" class="runmapbtn" onclick="runLiveRecenter()" aria-label="${runText('Karte auf mich zentrieren','Centre map on me')}">◎</button></div>`}
async function runLiveMapMount(){
  if(runLive.map&&!document.body.contains(runLive.map.getContainer())){runLive.map.remove();runLive.map=null}
  runLive.map=await runMountMap('runlivemap',map=>{
    let accent=runAccent(),view=runDefaultView(),route=runRouteById(state.activeRun?.routeId);
    if(route){let plan=L.polyline(runLineLatLngs(route.line),{color:'#ffffff',opacity:.45,weight:4,dashArray:'6 8'}).addTo(map);map.fitBounds(plan.getBounds(),{padding:[20,20]})}else map.setView(view.center,view.zoom);
    runLive.line=L.polyline([],{color:accent,weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);
    runLive.dot=L.circleMarker([0,0],{radius:7,color:'#fff',weight:3,fillColor:accent,fillOpacity:1,className:'runlivedot'});
    runLive.follow=true;map.on('dragstart',()=>{runLive.follow=false});
  })||runLive.map;
  runLiveMapUpdate();
}
function runLiveRecenter(){runLive.follow=true;runLiveMapUpdate()}
function runLiveMapUpdate(){
  let map=runLive.map;if(!map)return;if(!document.body.contains(map.getContainer())){map.remove();runLive.map=null;return}
  let run=state.activeRun;if(!run?.gps)return;let accepted=runAcceptedPoints(runTrackFor(run)?.points),segs=[];
  for(let p of accepted){if(!segs.length||segs.at(-1).seg!==p[4])segs.push({seg:p[4],pts:[]});segs.at(-1).pts.push([p[1],p[2]])}
  runLive.line.setLatLngs(segs.map(s=>s.pts));
  let last=accepted.at(-1);if(!last)return;
  if(!map.hasLayer(runLive.dot))runLive.dot.addTo(map);runLive.dot.setLatLng([last[1],last[2]]);
  if(runLive.follow)map.setView([last[1],last[2]],Math.max(map.getZoom(),16),{animate:true});
}

// Detailansicht eines Laufs
function runDetail(id){
  let r=runList().find(x=>x.id===id);if(!r)return;
  let speed=r.distanceKm/(r.durationSeconds/3600),splits=r.splits||[],fastest=splits.length?Math.min(...splits):null,slowest=splits.length?Math.max(...splits):null;
  let rows=splits.map((s,i)=>`<div class="runsplit ${s===fastest&&splits.length>1?'best':''}"><span>${i+1}</span><div><i style="width:${Math.max(18,(fastest/s)*100)}%"></i></div><strong>${runPaceText(s)}</strong></div>`).join('')+(r.splitRest?`<div class="runsplit rest"><span>${runKm(r.splitRest[0]/1000)}</span><div><i style="width:${Math.max(18,(fastest||1)/(r.splitRest[1]/(r.splitRest[0]/1000))*100)}%"></i></div><strong>${runPaceText(r.splitRest[1]/(r.splitRest[0]/1000))}</strong></div>`:'');
  let day=new Date(r.date+'T12:00:00').toLocaleDateString(appLocale(),{weekday:'long',day:'numeric',month:'long'});
  openModal(runText('Lauf','Run'),`${r.route?`<div class="runmap detail" id="rundetailmap"></div>`:''}<p class="rundetaildate">${esc(day)}${r.source==='gps'?' · GPS':''}</p><div class="runstats"><div><strong>${runKm(r.distanceKm)}</strong><small>km</small></div><div><strong>${formatClock(r.durationSeconds)}</strong><small>${runText('Zeit','Time')}</small></div><div><strong>${runPaceText(runPace(r)).replace(' /km','')}</strong><small>${runText('Ø Pace /km','Avg pace /km')}</small></div><div><strong>${new Intl.NumberFormat(appLocale(),{maximumFractionDigits:1}).format(speed)}</strong><small>${runText('Ø km/h','Avg km/h')}</small></div></div>${r.note?`<p class="note">${esc(r.note)}</p>`:''}${splits.length?`<h3>${runText('Kilometerzeiten','Splits')}</h3><div class="runsplits">${rows}</div><p class="note">${runText('Schnellster km','Fastest km')} ${runPaceText(fastest)} · ${runText('langsamster','slowest')} ${runPaceText(slowest)}</p>`:''}<div class="runactions"><button type="button" class="btn secondary" onclick="runForm('${esc(r.id)}')">${runText('Bearbeiten','Edit')}</button>${r.route?`<button type="button" class="btn secondary" onclick="runSaveRouteFromRun('${esc(r.id)}')">${runText('Als Route sichern','Save as route')}</button>`:''}</div>`);
  if(r.route)runMountMap('rundetailmap',map=>{
    let accent=runAccent(),segs=runRoutePoints(r.route),line=L.polyline(segs,{color:accent,weight:5,lineCap:'round',lineJoin:'round'}).addTo(map),start=segs[0][0],end=segs.at(-1).at(-1);
    L.circleMarker(start,{radius:6,color:'#fff',weight:2,fillColor:'#3ddc84',fillOpacity:1}).addTo(map);L.circleMarker(end,{radius:6,color:'#fff',weight:2,fillColor:'#ff5c6c',fillOpacity:1}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[18,18]});
  });
}
function runSaveRouteFromRun(id){
  let r=runList().find(x=>x.id===id);if(!r?.route)return;let pts=runRoutePoints(r.route).flat();
  let name=prompt(runText('Name der Route','Route name'),`${runText('Lauf','Run')} ${fmtDate(r.date)}`);if(name===null)return;
  runRouteList().push({id:uid(),name:(name.trim()||runText('Route','Route')).slice(0,60),line:runLineString(pts),distanceKm:r.distanceKm,createdAt:Date.now()});save();toast(runText('Route gesichert','Route saved'));runRoutesSheet();
}

// Routen: Liste, Vorschau, Planer
function runRouteMeta(r){return `${runKm(r.distanceKm)} km${Number.isFinite(r.ascentM)?' · ↑ '+Math.round(r.ascentM)+' m':''}`}
function runRoutesSheet(){
  let routes=runRouteList();
  openModal(runText('Routen','Routes'),`<button type="button" class="btn full" onclick="runPlanner()">＋ ${runText('Neue Route planen','Plan a new route')}</button>${routes.length?`<div class="runlist">${routes.map(r=>`<button type="button" class="searchitem runrow" onclick="runRouteSheet('${esc(r.id)}')"><div>${esc(r.name)}<small>${runRouteMeta(r)}</small></div><span aria-hidden="true">›</span></button>`).join('')}</div>`:`<p class="note">${runText('Tippe auf der Karte Punkte an. Die Route folgt Fuß- und Feldwegen, Distanz und Höhenmeter siehst du sofort.','Tap points on the map. The route follows footpaths and tracks; you see distance and climb instantly.')}</p>`}`);
}
function runRouteSheet(id){
  let r=runRouteById(id);if(!r)return;
  openModal(r.name,`<div class="runmap detail" id="runroutemap"></div><p class="rundetaildate">${runRouteMeta(r)}</p><button type="button" class="btn full" onclick="modal.close();startRunTimer(true,'${esc(r.id)}')">▶ ${runText('Mit dieser Route laufen','Run this route')}</button><div class="runactions">${r.waypoints?`<button type="button" class="btn secondary" onclick="runPlanner('${esc(r.id)}')">${runText('Bearbeiten','Edit')}</button>`:''}<button type="button" class="btn secondary" onclick="runDeleteRoute('${esc(r.id)}')">${runText('Löschen','Delete')}</button></div>`);
  runMountMap('runroutemap',map=>{let line=L.polyline(runLineLatLngs(r.line),{color:runAccent(),weight:5}).addTo(map);if(line.getLatLngs().length)map.fitBounds(line.getBounds(),{padding:[18,18]});else map.setView(runDefaultView().center,runDefaultView().zoom)});
}
function runDeleteRoute(id){if(!confirm(runText('Diese Route löschen?','Delete this route?')))return;state.runRoutes=runRouteList().filter(r=>r.id!==id);save();runRoutesSheet()}

function runPlanner(id=null){
  let existing=id?runRouteById(id):null;
  runPlan={id:existing?.id||null,waypoints:existing?runLineLatLngs(existing.waypoints):[],line:existing?runLineLatLngs(existing.line):[],distanceKm:existing?.distanceKm||0,ascentM:existing?.ascentM,snap:true,serial:0,busy:false,map:null};
  openModal(existing?runText('Route bearbeiten','Edit route'):runText('Route planen','Plan route'),`<div class="runmap planner" id="runplannermap"><button type="button" class="runmapbtn" onclick="runPlannerLocate()" aria-label="${runText('Mein Standort','My location')}">◎</button></div><div class="runplanstats"><div><strong id="runplan-km">0 km</strong><small>${runText('Distanz','Distance')}</small></div><div><strong id="runplan-up">–</strong><small>${runText('Anstieg','Climb')}</small></div><div><strong id="runplan-time">–</strong><small>${runText('bei deiner Pace','at your pace')}</small></div></div><p class="note" id="runplan-hint">${runText('Tippe auf die Karte, um Punkte zu setzen.','Tap the map to add points.')}</p><div class="runplantools"><button type="button" class="btn secondary" id="runplan-snap" aria-pressed="true" onclick="runPlannerSnap()">${runText('Wegen folgen','Follow paths')}</button><button type="button" class="btn secondary" onclick="runPlannerUndo()">↶ ${runText('Zurück','Undo')}</button><button type="button" class="btn secondary" onclick="runPlannerLoop()">⟲ ${runText('Rundkurs','Loop')}</button><button type="button" class="btn secondary" onclick="runPlannerClear()">${runText('Leeren','Clear')}</button></div><form onsubmit="runPlannerSave(event)"><label>${runText('Name','Name')}<input id="runplan-name" maxlength="60" value="${esc(existing?.name||'')}" placeholder="${runText('z. B. Stadtpark-Runde','e.g. City park loop')}"></label><button class="btn full">${runText('Route speichern','Save route')}</button></form>`);
  modal.classList.add('runplannersheet');modal.addEventListener('close',()=>modal.classList.remove('runplannersheet'),{once:true});
  runMountMap('runplannermap',map=>{
    runPlan.map=map;runPlan.layer=L.polyline([],{color:runAccent(),weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);runPlan.marks=L.layerGroup().addTo(map);
    if(runPlan.line.length){map.fitBounds(L.latLngBounds(runPlan.line),{padding:[24,24]})}else{let v=runDefaultView();map.setView(v.center,v.zoom);runPlannerLocate(true)}
    map.on('click',e=>{if(runPlan.waypoints.length>=60){toast(runText('Höchstens 60 Punkte','At most 60 points'));return}runPlan.waypoints.push([e.latlng.lat,e.latlng.lng]);runPlannerRoute()});
    runPlannerDraw();
  });
}
function runPlannerLocate(quiet){if(!navigator.geolocation){if(!quiet)toast(runText('Standort nicht verfügbar','Location not available'));return}navigator.geolocation.getCurrentPosition(pos=>{runPlan?.map?.setView([pos.coords.latitude,pos.coords.longitude],15)},()=>{if(!quiet)toast(runText('Standort nicht erlaubt','Location not allowed'))},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}
function runPlannerSnap(){runPlan.snap=!runPlan.snap;let b=$('runplan-snap');if(b){b.setAttribute('aria-pressed',String(runPlan.snap));b.classList.toggle('off',!runPlan.snap)}runPlannerRoute()}
function runPlannerUndo(){runPlan.waypoints.pop();runPlannerRoute()}
function runPlannerLoop(){if(runPlan.waypoints.length<2)return;runPlan.waypoints.push([...runPlan.waypoints[0]]);runPlannerRoute()}
function runPlannerClear(){if(runPlan.waypoints.length&&!confirm(runText('Alle Punkte entfernen?','Remove all points?')))return;runPlan.waypoints=[];runPlannerRoute()}
function runPlannerDistance(line){let km=0;for(let i=1;i<line.length;i++)km+=runMeters([0,line[i-1][0],line[i-1][1]],[0,line[i][0],line[i][1]])/1000;return km}
async function runPlannerRoute(){
  let plan=runPlan,serial=++plan.serial,pts=plan.waypoints;plan.busy=false;
  if(pts.length<2){plan.line=pts.slice();plan.distanceKm=0;plan.ascentM=undefined;runPlannerDraw();return}
  plan.line=pts.slice();plan.distanceKm=runPlannerDistance(pts);plan.ascentM=undefined;runPlannerDraw();
  if(!plan.snap)return;
  let hint=$('runplan-hint');if(hint)hint.textContent=runText('Route wird berechnet …','Calculating route …');
  plan.busy=true;
  try{
    let lonlats=pts.map(p=>p[1].toFixed(6)+','+p[0].toFixed(6)).join('|'),res=await fetch(`https://brouter.de/brouter?lonlats=${lonlats}&profile=hiking-mountain&alternativeidx=0&format=geojson`);
    if(!res.ok)throw new Error(res.status);let json=await res.json(),feature=json.features?.[0],coords=feature?.geometry?.coordinates;
    if(serial!==plan.serial||runPlan!==plan)return;if(!Array.isArray(coords)||coords.length<2)throw new Error('empty');
    plan.line=coords.map(c=>[c[1],c[0]]);plan.distanceKm=Number(feature.properties?.['track-length'])/1000||runPlannerDistance(plan.line);
    let up=Number(feature.properties?.['filtered ascend']);plan.ascentM=Number.isFinite(up)?up:undefined;
    if(hint)hint.textContent=runText('Route folgt Wegen (BRouter, OpenStreetMap).','Route follows paths (BRouter, OpenStreetMap).');
  }catch{if(serial!==plan.serial)return;if(hint)hint.textContent=runText('Wegeführung nicht erreichbar – gerade Linien.','Routing unavailable – straight lines.')}
  if(serial===plan.serial)plan.busy=false;
  runPlannerDraw();
}
function runPlannerDraw(){
  let plan=runPlan;if(!plan?.map)return;plan.layer.setLatLngs(plan.line);plan.marks.clearLayers();
  plan.waypoints.forEach((p,i)=>L.circleMarker(p,{radius:i===0?7:5,color:'#fff',weight:2,fillColor:i===0?'#3ddc84':runAccent(),fillOpacity:1}).addTo(plan.marks));
  let km=$('runplan-km'),up=$('runplan-up'),time=$('runplan-time'),pace=runTypicalPace();
  if(km)km.textContent=runKm(Math.round(plan.distanceKm*100)/100)+' km';if(up)up.textContent=Number.isFinite(plan.ascentM)?Math.round(plan.ascentM)+' m':'–';
  if(time)time.textContent=pace&&plan.distanceKm>0?formatClock(pace*plan.distanceKm):'–';
}
// Typische Pace: Mittel der letzten fünf Läufe ab 1 km.
function runTypicalPace(){let recent=pastRuns().filter(r=>r.distanceKm>=1).slice(-5);if(!recent.length)return null;return recent.reduce((a,r)=>a+r.durationSeconds,0)/recent.reduce((a,r)=>a+r.distanceKm,0)}
function runPlannerSave(event){
  event.preventDefault();let plan=runPlan;if(plan?.busy){toast(runText('Route wird noch berechnet …','Route is still being calculated …'));return}if(!plan||plan.line.length<2){toast(runText('Setze mindestens zwei Punkte','Add at least two points'));return}
  let step=Math.max(1,Math.ceil(plan.line.length/800)),line=plan.line.filter((p,i)=>i%step===0||i===plan.line.length-1);
  let name=($('runplan-name').value.trim()||runText('Meine Route','My route')).slice(0,60),route=plan.id?runRouteById(plan.id):null;
  if(!route){route={id:uid(),createdAt:Date.now()};runRouteList().push(route)}
  Object.assign(route,{name,line:runLineString(line),waypoints:runLineString(plan.waypoints),distanceKm:Math.min(1000,Math.round(plan.distanceKm*100)/100)});
  if(Number.isFinite(plan.ascentM))route.ascentM=Math.round(plan.ascentM);else delete route.ascentM;
  save();toast(runText('Route gespeichert','Route saved'));runRouteSheet(route.id);render();
}

// Lauf-Auswahl: geplante Routen direkt anbieten.
const runMapChooser=runChooser;runChooser=function(...args){
  let result=runMapChooser.apply(this,args);if(state.activeRun)return result;
  document.querySelector('#mb .runactions.stacked')?.insertAdjacentHTML('beforeend',`<button type="button" class="btn secondary" onclick="runRoutesSheet()">⌖ ${runText('Route wählen oder planen','Choose or plan a route')}<small>${runRouteList().length?runRouteList().length+' '+runText('gespeichert','saved'):runText('Karte mit Wegeführung','Map with path routing')}</small></button>`);
  return result;
};
if(typeof englishUI==='object')Object.assign(englishUI,{'Routen':'Routes'});
