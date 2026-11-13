const $=id=>document.getElementById(id),modal=$('modal');
// Phosphor-Symbol für Quell-Markup; vor dem Laden von icons.js leer, der abschließende render() setzt es ein.
function uiIcon(name,cls=''){return typeof phIcon==='function'?pulsIcon(name,cls):''}
function appLocale(){return typeof state!=='undefined'&&state?.language==='en'?'en-GB':'de-DE'}
const today=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const initial=()=>({goals:{kcal:2200,p:150,c:250,f:70},foods:[],weights:[],workouts:[],custom:[]});
const firstRunPreview=typeof location.search==='string'&&/[?&]erststart=1(?:&|$)/.test(location.search);
const appStore=firstRunPreview?{getItem:()=>null,setItem(){},removeItem(){}}:localStorage;
let state,stateLoadCorrupt=false,stateCorruptRaw=null,stateCorruptAlerted=false,stateUploadBlockPending=false;
const stateCorruptKeys=['puls-v1-corrupt','puls-v1-corrupt-2','puls-v1-corrupt-3'];
let stateCorruptOrder=[],stateRecoveryPending=false,stateCorruptAcknowledged=false;
// Raw backups rotate; quota failures retain the raw text in memory without stopping saves.
function preserveCorruptState(){
 if(stateUploadBlockPending)try{appStore.setItem('puls-cloud-upload-blocked','1');stateUploadBlockPending=false}catch{}
 if(stateCorruptRaw===null)return;
 try{
  if(!stateCorruptKeys.some(key=>appStore.getItem(key)===stateCorruptRaw)){
   if(!stateCorruptOrder.length)try{let saved=JSON.parse(appStore.getItem('puls-v1-corrupt-order')||'[]');if(Array.isArray(saved))stateCorruptOrder=[...new Set(saved.filter(key=>stateCorruptKeys.includes(key)))]}catch{}
   stateCorruptOrder=[...new Set([...stateCorruptOrder,...stateCorruptKeys])];
   let key=stateCorruptKeys.find(key=>appStore.getItem(key)===null)||stateCorruptOrder[0];
   appStore.setItem(key,stateCorruptRaw);
   stateCorruptOrder=stateCorruptOrder.filter(item=>item!==key).concat(key);
   try{appStore.setItem('puls-v1-corrupt-order',JSON.stringify(stateCorruptOrder))}catch{}
  }
  stateCorruptRaw=null;
 }catch{
  if(!stateCorruptAlerted){stateCorruptAlerted=true;alert('Beschädigte Rohdaten konnten nicht zusätzlich gesichert werden. Das Original bleibt erhalten; dein Arbeitsstand wird getrennt gespeichert. Bitte unter Konto → Konto verwalten → Daten „Beschädigte Rohdaten herunterladen“ wählen.')}
 }
}
// This flag is local storage metadata only; it never enters state, exports or cloud payloads.
function writeLocalState(data){
 if(stateRecoveryPending||stateCorruptRaw!==null&&!stateCorruptAcknowledged){
  stateRecoveryPending=true;stateUploadBlockPending=true;
  try{cloudUploadBlocked=true}catch{} // cloud.js may not have loaded yet.
  try{appStore.setItem('puls-cloud-upload-blocked','1')}catch{}
  appStore.setItem('puls-v1-recovered',JSON.stringify({...data,__pulsRecoveryUploadBlocked:true}));return;
 }
 appStore.setItem('puls-v1',JSON.stringify(stateUploadBlockPending?{...data,__pulsRecoveryUploadBlocked:true}:data));
}
{let raw=null;try{raw=appStore.getItem('puls-v1')}catch{}try{let parsed=raw===null?null:JSON.parse(raw);if(raw!==null&&!(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)))throw Error('invalid');/* Ohne Grundgerüst bricht der Start ab; so ein Stand gilt als beschädigt und wird gesichert. */if(parsed&&!(parsed.goals&&typeof parsed.goals==='object'&&['foods','weights','workouts','custom'].every(k=>Array.isArray(parsed[k]))))throw Error('invalid');if(parsed?.__pulsRecoveryUploadBlocked===true){stateLoadCorrupt=true;stateUploadBlockPending=true;preserveCorruptState()}if(parsed)delete parsed.__pulsRecoveryUploadBlocked;state=parsed||initial()}catch{state=initial();stateLoadCorrupt=true;stateCorruptRaw=raw;stateUploadBlockPending=true;preserveCorruptState()}}let date=today(),page='home',foodSelection=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>new Intl.NumberFormat(appLocale(),{maximumFractionDigits:1}).format(x),uid=()=>crypto.randomUUID(),round=x=>Math.round(x*10)/10;
function save(){preserveCorruptState();try{writeLocalState(state)}catch{alert(stateRecoveryPending?'Speichern fehlgeschlagen. Dein Arbeitsstand ist nur im Arbeitsspeicher; das beschädigte Original bleibt erhalten. Bitte exportiere deine Daten.':'Speichern fehlgeschlagen. Bitte exportiere deine Daten.')}}
function corruptBackups(){let backups=[];for(let key of stateCorruptKeys)try{let raw=appStore.getItem(key);if(raw!==null)backups.push({source:key,raw})}catch{}if(stateCorruptRaw!==null&&!backups.some(item=>item.raw===stateCorruptRaw))backups.push({source:'Arbeitsspeicher',raw:stateCorruptRaw});return backups}
// Persist the chosen profile before releasing recovery, regardless of the caller (cloud/import/download).
function finishRecovery(data,{releaseUpload=true,rawAcknowledged=false}={}){
 if(!validData(data))throw Error('Standwahl abgebrochen: ungültiges Profil. Deine Arbeitskopie bleibt erhalten.');
 preserveCorruptState();
 if(stateCorruptRaw!==null&&!stateCorruptAcknowledged&&!rawAcknowledged){
  if(!downloadCorruptBackups()||!confirm('Sind die beschädigten Rohdaten als Datei gesichert? Den gewählten Stand jetzt übernehmen und das beschädigte Original ersetzen?'))return false;
 }
 const previous=appStore.getItem('puls-v1'),recovered=appStore.getItem('puls-v1-recovered'),blocked=appStore.getItem('puls-cloud-upload-blocked');
 let chosen={...data};delete chosen.__pulsRecoveryUploadBlocked;if(!releaseUpload)chosen.__pulsRecoveryUploadBlocked=true;
 try{
  appStore.setItem('puls-v1',JSON.stringify(chosen));
  appStore.removeItem('puls-v1-recovered');
  if(releaseUpload)appStore.removeItem('puls-cloud-upload-blocked');else try{appStore.setItem('puls-cloud-upload-blocked','1')}catch{}
 }catch(error){
  try{if(previous===null)appStore.removeItem('puls-v1');else appStore.setItem('puls-v1',previous)}catch{}
  try{if(recovered!==null)appStore.setItem('puls-v1-recovered',recovered)}catch{}
  try{if(blocked!==null)appStore.setItem('puls-cloud-upload-blocked',blocked)}catch{}
  throw Error('Standwahl abgebrochen: Speichern nicht möglich. Deine Arbeitskopie bleibt erhalten.');
 }
 stateRecoveryPending=false;stateCorruptRaw=null;stateCorruptAcknowledged=false;stateLoadCorrupt=false;stateCorruptAlerted=false;stateUploadBlockPending=false;
 try{if(typeof cloudUploadBlocked==='boolean')cloudUploadBlocked=!releaseUpload}catch{}
 return true;
}
function confirmRecoveredState({rawDownloaded=false}={}){
 if(!stateRecoveryPending&&stateCorruptRaw===null)return false;
 try{
  if(stateCorruptRaw!==null&&!rawDownloaded&&!downloadCorruptBackups())return false;
  if(!confirm('Sind die beschädigten Rohdaten als Datei gesichert? Wiederhergestellten Stand jetzt als Hauptstand übernehmen und das beschädigte Original ersetzen?'))return false;
  return finishRecovery(state,{releaseUpload:false,rawAcknowledged:true});
 }catch{alert('Übernahme fehlgeschlagen. Dein Arbeitsstand bleibt getrennt gespeichert oder im Arbeitsspeicher. Bitte exportiere deine Daten.');return false}
}
function downloadCorruptBackups(){let backups=corruptBackups();if(!backups.length)return false;let url=URL.createObjectURL(new Blob([JSON.stringify({format:'puls-corrupt-backups-v1',backups},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='puls-beschaedigte-rohdaten.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}
function exportCorruptBackup(){if(downloadCorruptBackups()&&stateRecoveryPending)confirmRecoveredState({rawDownloaded:true})}
// Dezimalwert für Eingabefelder: deutsche Oberfläche zeigt Komma, gespeichert bleibt die Zahl (UI-9).
// Zahl mit Einzahl/Mehrzahl („1 Übung“, „2 Übungen“, UI-8); i18n.js übersetzt beide Formen.
function countText(count,one,many){return `${count} ${Number(count)===1?one:many}`}
function fieldDecimal(x){let text=x==null?'':String(x);return appLocale()==='de-DE'&&/^\d*\.\d+$|^\d+\.$/.test(text.trim())?text.replace('.',','):text}
/* Tippen in Satzfeldern: State sofort aktuell, Speichern gebündelt (400 ms); beim Verlassen wird sofort gespeichert. */
let pendingSaveTimer=null,setValueLive=false;
function scheduleSave(){clearTimeout(pendingSaveTimer);pendingSaveTimer=setTimeout(flushPendingSave,400)}
function flushPendingSave(){if(pendingSaveTimer===null)return;clearTimeout(pendingSaveTimer);pendingSaveTimer=null;save()}
function cancelPendingSave(){clearTimeout(pendingSaveTimer);pendingSaveTimer=null}
if(typeof addEventListener==='function'){addEventListener('pagehide',flushPendingSave);addEventListener('beforeunload',flushPendingSave)}document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingSave()});
function setLiveValue(w,e,i,k,v){setValueLive=true;try{setValue(w,e,i,k,v)}finally{setValueLive=false}}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2400)}
function setDate(d){date=d;$('date').value=d;render()}function moveDay(v){let d=new Date(date+'T12:00:00');d.setDate(d.getDate()+v);setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}$('date').onchange=e=>{if(e.target.value)setDate(e.target.value)};
const foods=[['Haferflocken',372,13.5,58.7,7],['Skyr natur',63,11,4,0.2],['Banane',89,1.1,20.2,.3],['Hähnchenbrust, roh',110,23,0,1.5],['Reis, gekocht',130,2.7,28,.3],['Ei',143,12.6,.7,9.5],['Vollkornbrot',230,8.5,41,3.3],['Magerquark',67,12,4,.2],['Lachs, roh',208,20,0,13],['Brokkoli',34,2.8,4,.4],['Olivenöl',884,0,0,100],['Apfel',52,.3,11.4,.2],['Mandeln',579,21.2,9,49.9],['Kartoffeln, gekocht',77,2,15,0.1],['Tofu natur',144,15.7,1.5,8.7],['Whey Protein',390,78,8,6]].map((v,i)=>({id:'base'+i,name:v[0],kcal:v[1],p:v[2],c:v[3],f:v[4]}));
const meals=['Frühstück','Mittagessen','Abendessen','Snacks'];const icons=['☀','◒','☾','◈'];
function totals(){return state.foods.filter(x=>x.date===date).reduce((a,x)=>{['kcal','p','c','f'].forEach(k=>a[k]+=x[k]);return a},{kcal:0,p:0,c:0,f:0})}
// Reset the actual scroll containers, including nested full-screen sheets.
// Repeat after layout and ignore callbacks superseded by another navigation.
let scrollViewRevision=0;
function scrollViewTop(...targets){
  const revision=++scrollViewRevision;
  const reset=()=>{
    if(revision!==scrollViewRevision)return;
    if(!targets.length){window.scrollTo({top:0,left:0,behavior:'instant'});if(document.scrollingElement)document.scrollingElement.scrollTop=0}
    for(let target of targets){
      const root=typeof target==='string'?document.getElementById(target):target;
      if(!root)continue;
      if(root.scrollTo)root.scrollTo({top:0,left:root.scrollLeft||0,behavior:'instant'});else root.scrollTop=0;
      for(const node of root.querySelectorAll?.('*')||[])if(node.scrollTop){
        if(node.scrollTo)node.scrollTo({top:0,left:node.scrollLeft||0,behavior:'instant'});else node.scrollTop=0;
      }
    }
  };
  reset();if(typeof requestAnimationFrame==='function')requestAnimationFrame(reset);
}
function goBase(p){page=p;render();scrollViewTop()}
// Die eine go() (Refactor Phase 4). Sie ersetzt die frühere Kette aus 7 überschriebenen go-Funktionen. Jedes Glied ist eine benannte Funktion in seiner Datei
// (goBefore…/goAfterMotion, gesetzt dort, wo früher der Wrapper installiert wurde, mit derselben Bedingung); aufgerufen wird nur, was schon gesetzt ist.
// Reihenfolge wie die alte Verschachtelung (zuletzt geladener Wrapper außen): vorher motion, quick-account, account-refresh, polish, experience, dann der Kern, nachher motion.
// Erhalten bleibt, was die Wrapper am Aufruf änderten: Das erste Argument geht an quick-account, polish und experience; weitere Argumente erreichten den Kern nie
// (account-refresh gab nur das erste weiter). experience bildet „weight“ auf „account“ ab; das Ergebnis bekommt der Kern. Der Rückgabewert war
// immer undefined.
function go(...args){
 const call=(name,...a)=>typeof globalThis[name]==='function'?globalThis[name](...a):undefined,next=args[0];
 const before=call('goBeforeMotion');
 call('goBeforeQuickAccount',next);call('goBeforeAccountRefresh');call('goBeforePolish',next);
 goBase(typeof globalThis.goBeforeExperience==='function'?globalThis.goBeforeExperience(next):next);
 call('goAfterMotion',before);
}
function renderBase(){let nav=[['home','◫','Übersicht'],['food','◉','Ernährung'],['workout','⌁','Training'],['weight','↗','Gewicht']];$('nav').innerHTML=nav.map(([id,ic,s])=>`<button class="${page===id?'active':''}" onclick="go('${id}')"><span class="ico">${ic}</span>${s}</button>`).join('');$('title').textContent=({home:'Heute zählt.',food:'Gut versorgt.',workout:'Stärker werden.',weight:'Dein Verlauf.'})[page];$('subtitle').textContent=({home:'Kleine Schritte. Stärkeres Ich.',food:'Deine Ernährung. Auf einen Blick.',workout:'Jeder Satz ist ein Schritt nach vorn.',weight:'Fortschritt braucht Zeit. Gib sie dir.'})[page];$('content').innerHTML=page==='home'?home():page==='food'?nutrition():page==='weight'?weightPage():workoutPage()}
// Die eine render() (Refactor Phase 4). Sie ersetzt die frühere Kette aus 25 überschriebenen render-Funktionen. Jedes Glied ist eine
// benannte Funktion in seiner Datei (renderBefore…/renderAfter…/renderFinally…, gesetzt dort, wo früher der Wrapper installiert wurde).
// Aufgerufen wird nur, was schon gesetzt ist: Ein render() während des Ladens läuft so mit genau der Teilkette von damals.
// Reihenfolge wie die alte Verschachtelung (zuletzt geladener Wrapper außen): vorher außen→innen, Kern, nachher innen→außen.
// Kern ist renderBase (hier) und ab experience.js renderExperience; der Wrapper aus recipes.js lag nur über renderBase.
// Der Rückgabewert war auch früher immer undefined.
function render(){
 const call=(name,...args)=>typeof globalThis[name]==='function'?globalThis[name](...args):undefined;
 call('renderBeforeFoodDiary');call('renderBeforeData');
 try{try{
  let previous=call('renderBeforePolish');call('renderBeforeTracker');
  if(typeof renderExperience==='function')renderExperience();else{call('renderBeforeRecipes');renderBase()}
  for(const name of ['renderAfterFinish','renderAfterPersonal','renderAfterNavigation','renderAfterFlowsSession','renderAfterFlowsIdentity','renderAfterFlowsDesign','renderAfterInteractions'])call(name);
  call('renderAfterPolish',previous);
  for(const name of ['renderAfterComfort','renderAfterLanguage','renderAfterTrainingTabs','renderAfterAppPolish','renderAfterRunSession'])call(name);
 }finally{call('renderFinallyNativeBridge')}}finally{call('renderFinallyNativeExtras')}
 for(const name of ['renderAfterDesignSystem','renderAfterFoodDiary','renderAfterQuickAccount','renderAfterMotion'])call(name);
}
function chart(){let ws=[...state.weights].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);if(ws.length<2)return '<div class="empty">Dein Verlauf beginnt mit dir.<br>Erfasse mindestens zwei Gewichtseinträge.</div>';let vals=ws.map(x=>x.kg),min=Math.min(...vals)-.5,max=Math.max(...vals)+.5;let pts=vals.map((v,i)=>`${10+i/(vals.length-1)*380},${85-(v-min)/(max-min)*70}`).join(' ');return `<svg class="chart" viewBox="0 0 400 100" role="img" aria-label="Gewichtsverlauf von ${n(vals[0])} bis ${n(vals.at(-1))} Kilogramm"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c3f86b" stop-opacity=".18"/><stop offset="1" stop-color="#c3f86b" stop-opacity="0"/></linearGradient></defs><path d="M10 25H390M10 60H390M10 95H390" stroke="#30362b" stroke-dasharray="3 5"/><polygon points="10,100 ${pts} 390,100" fill="url(#fade)"/><polyline points="${pts}" fill="none" stroke="#c3f86b" stroke-width="2.5"/></svg><div class="axis"><span>${fmtDate(ws[0].date)}</span><span>${fmtDate(ws.at(-1).date)}</span></div>`}
function fmtDate(d){return new Date(d+'T12:00:00').toLocaleDateString(appLocale(),{day:'numeric',month:'short'})}
function weightCard(){let w=[...state.weights].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);return `<section class="card"><div class="cardhead"><h2>Dein Gewicht</h2><span class="badge">${w?fmtDate(w.date):'Noch kein Eintrag'}</span></div><div class="weightbig"><strong class="big">${w?n(w.kg):'–'}</strong><span>kg</span></div>${chart()}<button class="btn secondary full" onclick="weightForm()">＋ Gewicht erfassen</button></section>`}
// Die eine home() (Refactor Phase 4): Die Übersicht kommt aus design-system.js (homeDesign). Frühere Definitionen davor sind entfernt; ein Aufruf während des Ladens liefert bis dahin einen leeren Text.
function home(){return typeof homeDesign==='function'?homeDesign():''}
function openModalBase(title,body){$('mt').textContent=title;$('mb').innerHTML=body;if(!modal.open)modal.showModal();scrollViewTop(modal)}
// Die eine openModal() (Refactor Phase 4). Sie ersetzt die frühere Kette aus 17 überschriebenen openModal-Funktionen. Jedes Glied ist eine benannte
// Funktion in seiner Datei (openModalBefore…/openModalAfter…, gesetzt dort, wo früher der Wrapper installiert wurde, mit derselben Bedingung).
// Aufgerufen wird nur, was schon gesetzt ist: Ein openModal() während des Ladens läuft so mit genau der Teilkette von damals.
// Reihenfolge wie die alte Verschachtelung (zuletzt geladener Wrapper außen): vorher außen→innen, Kern, nachher innen→außen.
// Kein Glied ändert Titel oder Inhalt; die Wrapper mit „vorher und nachher“ (app-polish, sound-engine) reichen ihren Zustand vom Vorher zum Nachher durch.
// Die alten Wrapper gaben nur den Rückgabewert des Vorgängers weiter; der Kern und der Wrapper aus i18n.js geben nichts zurück, also war es immer undefined.
// Zusätzliche Argumente erreichten nie jemanden, der sie liest.
function openModal(title,body){
 const call=(name,...args)=>typeof globalThis[name]==='function'?globalThis[name](...args):undefined;
 call('openModalBeforeFoodPage',title);
 const was=call('openModalBeforeSound'),quick=call('openModalBeforeAppPolish');
 call('openModalBeforeTrainingPolish');call('openModalBeforeFoodFlow',title);call('openModalBeforeWorkoutPolish',title);call('openModalBeforeCompact',title);
 call('openModalBeforeInteractions');call('openModalBeforeProducts');
 openModalBase(title,body);
 for(const name of ['openModalAfterFlows','openModalAfterPolish','openModalAfterPreviewMode','openModalAfterComfort','openModalAfterLanguage'])call(name);
 call('openModalAfterAppPolish',quick);call('openModalAfterSound',was);call('openModalAfterDesignSystem');call('openModalAfterMotion');
}
function foodForm(meal='Frühstück'){foodSelection=null;openModal('Essen hinzufügen',`<label>Mahlzeit<select id="meal">${meals.map(m=>`<option ${m===meal?'selected':''}>${m}</option>`).join('')}</select></label><div class="tabs"><button class="btn secondary" onclick="showSearch()">Lebensmittel suchen</button><button class="btn secondary" onclick="customFood()">Eigene Nährwerte</button></div><div id="foodbody"></div>`);showSearch()}
function showSearch(){$('foodbody').innerHTML='<label>Basislebensmittel & eigene Lebensmittel<input id="search" placeholder="z. B. Skyr, Haferflocken …" oninput="searchFoods(this.value)"></label><div id="results"></div>';searchFoods('')}
function searchFoods(q){let list=[...foods,...state.custom].filter(x=>x.name.toLowerCase().includes(q.toLowerCase()));$('results').innerHTML=list.length?list.map(x=>`<button class="searchitem" onclick="selectFood('${x.id}')"><div>${esc(x.name)}<small>Protein ${n(x.p)} · KH ${n(x.c)} · Fett ${n(x.f)} g</small></div><span>${n(x.kcal)} kcal ＋</span></button>`).join(''):'<p class="empty">Nicht gefunden? Nutze „Eigene Nährwerte“.</p>'}
function selectFood(id){foodSelection=[...foods,...state.custom].find(x=>x.id===id);$('foodbody').innerHTML=`<h3>${esc(foodSelection.name)}</h3><p class="note">${n(foodSelection.kcal)} kcal pro 100 g</p><form onsubmit="addFood(event)"><label>Menge in Gramm<input id="grams" type="number" step="0.1" min="0.1" max="10000" value="100" required oninput="previewFood()"></label><p id="foodpreview"></p><button class="btn full">Zum Tagebuch hinzufügen</button></form>`;previewFood()}
function previewFood(){let v=Number($('grams').value)/100;$('foodpreview').textContent=`${n(round(foodSelection.kcal*v))} kcal · ${n(round(foodSelection.p*v))} g Protein · ${n(round(foodSelection.c*v))} g KH · ${n(round(foodSelection.f*v))} g Fett`}
function customFood(){$('foodbody').innerHTML=`<form onsubmit="addCustom(event)"><label>Lebensmittelname<input id="foodname" maxlength="100" required placeholder="z. B. Mein Protein-Joghurt"></label><p class="note">Nährwerte pro 100 g laut Verpackung</p><div class="formgrid">${[['kcal','Kalorien (kcal)'],['p','Protein (g)'],['c','Kohlenhydrate (g)'],['f','Fett (g)']].map(([k,l])=>`<label>${l}<input id="custom-${k}" type="number" min="0" max="${k==='kcal'?1000:100}" step="0.1" required></label>`).join('')}</div><button class="btn full">Speichern & Menge wählen</button></form>`}
function addCustom(e){e.preventDefault();let x={id:uid(),name:$('foodname').value.trim()};if(!x.name)return;['kcal','p','c','f'].forEach(k=>x[k]=Number($('custom-'+k).value));state.custom.push(x);save();selectFood(x.id)}
function addFood(e){e.preventDefault();let grams=Number($('grams').value);if(!Number.isFinite(grams)||grams<=0)return;let x={id:uid(),name:foodSelection.name,grams,date,meal:$('meal').value};['kcal','p','c','f'].forEach(k=>x[k]=round(foodSelection[k]*grams/100));state.foods.push(x);save();modal.close();render();toast('Mahlzeit gespeichert')}
function removeEntry(key,id){if(!confirm('Diesen Eintrag löschen?'))return;state[key]=state[key].filter(x=>x.id!==id);save();render()}
function weightForm(){let w=state.weights.find(x=>x.date===date);openModal('Gewicht erfassen',`<form onsubmit="addWeight(event)"><label>Datum<input id="wdate" type="date" value="${date}" required></label><label>Gewicht in kg<input id="kg" type="text" data-ds-decimal="1" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" min="20" max="400" value="${w?w.kg:''}" placeholder="z. B. 78,5" required></label><button class="btn full">Gewicht speichern</button></form>`)}
function addWeight(e){e.preventDefault();let d=$('wdate').value,raw=String($('kg').value).trim(),kg=/^\d+[.,]?\d*$/.test(raw)?Number(raw.replace(',','.')):NaN;if(!Number.isFinite(kg)||kg<20||kg>400){toast('Bitte ein Gewicht zwischen 20 und 400 kg eingeben.');return}state.weights=state.weights.filter(x=>x.date!==d);state.weights.push({id:uid(),date:d,kg});save();modal.close();render();toast('Gewicht gespeichert')}
function weightPage(){let ws=[...state.weights].sort((a,b)=>b.date.localeCompare(a.date));return `<div class="grid">${weightCard()}<section class="card"><span class="label">MIT WEITBLICK</span><h2 style="margin-top:18px">Der Verlauf zählt.</h2><div class="weightbig" style="margin-top:28px"><strong class="big">${ws.length>=2?n(round(ws[0].kg-ws.at(-1).kg)):'–'}</strong><span>kg seit erstem Eintrag</span></div></section></div><div class="sectionhead"><h2>Deine Einträge</h2><span class="badge">${ws.length} Einträge</span></div><section class="card">${ws.length?ws.map(x=>`<div class="entry"><div>${fmtDate(x.date)} ${x.date.slice(0,4)}</div><strong>${n(x.kg)} kg</strong><button class="delete" aria-label="Gewichtseintrag löschen" onclick="removeEntry('weights','${x.id}')">×</button></div>`).join(''):'<div class="empty">Noch keine Einträge. Erfasse dein erstes Gewicht.</div>'}</section>`}
const templates={upper:['Bankdrücken','Latziehen','Schulterdrücken','Rudern','Seitheben','Bizepscurls'],lower:['Kniebeugen','Rumänisches Kreuzheben','Beinpresse','Beinbeuger','Wadenheben'],full:['Kniebeugen','Bankdrücken','Latziehen','Rumänisches Kreuzheben']};
function startWorkout(){openModal('Training starten',`<form onsubmit="createWorkout(event)"><label>Name<input id="workname" maxlength="80" value="Mein Training" required></label><label>Vorlage<select id="template"><option value="upper">Oberkörper</option><option value="lower">Unterkörper</option><option value="full">Ganzkörper</option><option value="empty">Eigenes Training</option></select></label><button class="btn full">Los geht’s →</button></form>`)}
function createWorkout(e){e.preventDefault();let name=$('workname').value.trim();if(!name)return;state.workouts.push({id:uid(),date,name,finished:false,exercises:(templates[$('template').value]||[]).map(name=>({id:uid(),name,sets:Array.from({length:3},()=>({kg:'',reps:'',done:false}))}))});save();modal.close();go('workout')}
function exerciseOf(wid,eid){return state.workouts.find(x=>x.id===wid).exercises.find(x=>x.id===eid)}
function setValue(w,e,i,k,v){let s=exerciseOf(w,e).sets[i];if(k==='done'){if(v&&(s.kg===''||s.reps===''||Number(s.reps)<1)){toast('Bitte Gewicht und Wiederholungen erfassen');render();return}s.done=v}else{if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<(k==='kg'?0:1)||Number(v)>1000||(k==='reps'&&!Number.isInteger(Number(v))))){if(setValueLive)return;toast('Bitte einen gültigen Wert eingeben');render();return}s[k]=v===''?'':Number(v);if(v==='')s.done=false}if(setValueLive&&k!=='done'){scheduleSave();return}cancelPendingSave();save()}
function addSet(wid,eid){let w=state.workouts.find(x=>x.id===wid);if(!w||w.finished)return;let e=exerciseOf(wid,eid),old=typeof previousPerformance==='function'?previousPerformance(w,e)?.sets[e.sets.length]:null,source=old||e.sets.at(-1);e.sets.push({kg:source?.kg??'',reps:source?.reps??'',done:false});save();render()}
function deleteExercise(w,e){if(!confirm('Übung mit allen Sätzen entfernen?'))return;let x=state.workouts.find(x=>x.id===w);x.exercises=x.exercises.filter(x=>x.id!==e);save();render()}
function exerciseForm(w){openModal('Übung hinzufügen',`<form onsubmit="addExercise(event,'${w}')"><label>Name der Übung<input id="exercise" maxlength="100" required placeholder="z. B. Kabelrudern"></label><button class="btn full">Übung hinzufügen</button></form>`)}
function addExercise(e,w){e.preventDefault();let name=$('exercise').value.trim();if(!name)return;state.workouts.find(x=>x.id===w).exercises.push({id:uid(),name,sets:[{kg:'',reps:'',done:false}]});save();modal.close();render()}
function finishWorkout(id){let w=state.workouts.find(x=>x.id===id);if(!w.exercises.some(e=>e.sets.some(s=>s.done))){toast('Erfasse zuerst mindestens einen abgeschlossenen Satz');return}w.finished=true;save();render();toast('Training abgeschlossen. Stark gemacht!')}
function reopenWorkout(id){state.workouts.find(x=>x.id===id).finished=false;save();render()}
function settings(){openModal('Ziele & Daten',`<form onsubmit="saveGoals(event)"><div class="formgrid">${[['kcal','Kalorien (kcal)'],['p','Protein (g)'],['c','Kohlenhydrate (g)'],['f','Fett (g)']].map(([k,l])=>`<label>${l}<input id="goal-${k}" type="number" step="1" min="1" max="${k==='kcal'?20000:2000}" value="${state.goals[k]}" required></label>`).join('')}</div><p id="goalcalc" class="note">Makroenergie: ${state.goals.p*4+state.goals.c*4+state.goals.f*9} kcal. Kalorien- und Makroziele sind getrennt einstellbar.</p><button class="btn full">Ziele speichern</button></form><hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><h3>Deine Daten gehören dir.</h3><p class="note">Speicherung ausschließlich in diesem Browser. Kein Geräteabgleich. Beim Löschen der Browserdaten können Einträge verloren gehen. Sichere sie regelmäßig als Datei.</p><button class="btn secondary full" onclick="exportData()">↓ Sicherung exportieren</button><label style="margin-top:15px">Sicherung wiederherstellen<input type="file" accept="application/json,.json" onchange="importData(this.files[0])"></label><p class="note">Auf dem iPhone: In Safari öffnen → Teilen → Zum Home-Bildschirm. Die installierte Web-App kann einen eigenen Datenspeicher verwenden; bei Bedarf Sicherung importieren.</p>`)}
function saveGoals(e){e.preventDefault();['kcal','p','c','f'].forEach(k=>state.goals[k]=Number($('goal-'+k).value));save();modal.close();render();toast('Ziele gespeichert')}
function exportData(){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.href=u;a.download='puls-sicherung-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
// Gemeinsame Kernprüfung. Beim Laden von app.js (Wiederherstellung weiter unten) fehlen die Hilfen der später geladenen Dateien noch; dort gilt wie bisher nur sie.
function validCore(s){const finite=(v,min=0)=>typeof v==='number'&&Number.isFinite(v)&&v>=min;const str=x=>typeof x==='string';const day=x=>str(x)&&/^\d{4}-\d{2}-\d{2}$/.test(x);const nutrients=x=>['kcal','p','c','f'].every(k=>finite(x[k]));return s&&s.goals&&nutrients(s.goals)&&finite(s.goals.kcal,1)&&['p','c','f'].every(k=>finite(s.goals[k]))&&['foods','weights','workouts','custom'].every(k=>Array.isArray(s[k]))&&s.foods.every(x=>str(x.id)&&str(x.name)&&day(x.date)&&meals.includes(x.meal)&&finite(x.grams,.1)&&nutrients(x))&&s.weights.every(x=>str(x.id)&&day(x.date)&&finite(x.kg,20)&&x.kg<=400)&&s.custom.every(x=>str(x.id)&&str(x.name)&&nutrients(x))&&s.workouts.every(w=>str(w.id)&&str(w.name)&&day(w.date)&&typeof w.finished==='boolean'&&Array.isArray(w.exercises)&&w.exercises.every(e=>str(e.id)&&str(e.name)&&Array.isArray(e.sets)&&e.sets.every(s=>(s.kg===''||finite(s.kg))&&(s.reps===''||finite(s.reps,1))&&typeof s.done==='boolean')))}
// Einzige vollständige Prüfung der Profildaten (Refactor Phase 3, früher eine Kette aus 30 Wrappern in 26 Dateien). Neue gespeicherte Felder kommen hier als eigener Abschnitt dazu.
// Die Abschnitte laufen in der Auswertungsreihenfolge der früheren Kette; Kurzschluss und Fehlerverhalten bleiben damit gleich. „//§“ trennt die Abschnitte, tests/check-validdata.cjs schaltet sie einzeln ab.
// Aufrufe nach dem Laden brauchen alle Dateien aus index.html; window.pulsData87 und window.pulsNutrients fehlen nur in Test-Teilladungen, dann entfallen deren Abschnitte.
function validData(input){
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const v87=window.pulsData87,nx=window.pulsNutrients;
 //§! Vorbereitung: Optionen (water, display, foodSearch, plan) werden auf einer Kopie bereinigt; native Befehle prüfen {...state,...} und dürfen geteilte Unterobjekte nie verändern
 if(!object(input))return false;
 const s=v87?v87.optionDraft(input):input;
 //§ js/puls-data.js (Kombis)
 if(v87&&input.meals!==undefined&&!v87.mealsOK(input.meals))return false;
 //§ js/nutrient-resolver.js (ck/nx in Einträgen, Produkten, Kombis)
 if(nx&&!(['foods','custom'].every(key=>Array.isArray(s[key])&&s[key].every(nx.validFields))&&(s.meals===undefined||Array.isArray(s.meals)&&s.meals.every(meal=>Array.isArray(meal?.items)&&meal.items.every(nx.validFields)))))return false;
 //§ js/app.js (Kern)
 if(!validCore(s))return false;
 //§ js/enhancements.js (Profil, Plan, Übungsbuch, Routinen; pace „extreme“ gilt als „high“, wie früher in experience.js)
 {const text=x=>typeof x==='string'&&x.length<=200,finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;if(s.profile&&!(!profileError(s.profile)&&typeof s.profile.special==='boolean'))return false;if(s.plan&&(!['manual','auto'].includes(s.plan.mode)||!['lose','maintain','gain'].includes(s.plan.direction)||!['low','medium','high'].includes(s.plan.pace==='extreme'?'high':s.plan.pace)||!['manual','auto'].includes(s.plan.macroMode)||!finite(s.plan.protein,1.4,2.2)||!finite(s.plan.fat,.5,1.5)))return false;if(s.exerciseBook&&(!Array.isArray(s.exerciseBook)||!s.exerciseBook.every(b=>text(b.id)&&text(b.name)&&finite(b.target,0,2000))))return false;if(s.routines&&(!Array.isArray(s.routines)||!s.routines.every(r=>text(r.id)&&text(r.name)&&Array.isArray(r.exercises)&&r.exercises.every(e=>s.exerciseBook?.some(b=>b.id===e.exerciseId)&&Number.isInteger(e.sets)&&e.sets>=1&&e.sets<=12&&Number.isInteger(e.min)&&Number.isInteger(e.max)&&e.min>=1&&e.max<=100&&e.max>=e.min))))return false;}
 //§ js/enhancements.js (sichere IDs)
 {const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);if(!(['foods','weights','custom','workouts','exerciseBook','routines'].every(k=>(s[k]||[]).every(x=>safeId(x.id)))&&s.workouts.every(w=>w.exercises.every(e=>safeId(e.id)&&(!e.exerciseId||safeId(e.exerciseId))))))return false}
 //§ js/products.js
 if(!(s.custom.every(x=>(x.unit===undefined||['g','ml'].includes(x.unit))&&(x.barcode===undefined||validBarcode(x.barcode))&&(x.sourceUrl===undefined||x.sourceUrl==='https://world.openfoodfacts.org/product/'+x.barcode))&&s.foods.every(x=>x.unit===undefined||['g','ml'].includes(x.unit))))return false;
 //§ js/recipes.js
 if(!((s.recipes===undefined||(Array.isArray(s.recipes)&&s.recipes.every(validRecipe)))))return false;
 //§ js/experience.js (Verläufe)
 if(!((s.profileHistory===undefined||(Array.isArray(s.profileHistory)&&s.profileHistory.every(p=>!profileError(p))))&&(s.goalHistory===undefined||(Array.isArray(s.goalHistory)&&s.goalHistory.every(g=>typeof g.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(g.date)&&Number.isFinite(g.kcal)&&g.kcal>0)))))return false;
 //§ js/training.js (Training)
 {const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;if(!((!s.workoutSettings||finite(s.workoutSettings.restSeconds,0,900))&&s.workouts.every(w=>(w.startedAt===undefined||finite(w.startedAt,0,1e15))&&(w.finishedAt===undefined||finite(w.finishedAt,0,1e15))&&(w.durationSeconds===undefined||w.durationSeconds===null||finite(w.durationSeconds,0,1e10))&&(!w.rest||finite(w.rest.endAt,0,1e15))&&w.exercises.every(e=>e.restSeconds===undefined||finite(e.restSeconds,0,900)))))return false}
 //§ js/training.js (Pausen, Übungsmetadaten)
 {let rest=value=>value===undefined||(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=900);if(!((s.routines||[]).every(r=>r.exercises.every(e=>rest(e.restSeconds)))&&(s.exerciseBook||[]).every(b=>(b.muscles===undefined||(Array.isArray(b.muscles)&&b.muscles.every(x=>typeof x==='string'&&x.length<=100)))&&(b.equipment===undefined||(typeof b.equipment==='string'&&b.equipment.length<=100)))))return false}
 //§ js/portions.js
 if(!(s.custom.every(x=>(x.packageAmount===undefined||(Number.isFinite(x.packageAmount)&&x.packageAmount>0&&x.packageAmount<=10000))&&(x.packageUnit===undefined||['g','ml'].includes(x.packageUnit)))))return false;
 //§ js/insights.js
 if(!((s.exerciseBook||[]).every(b=>(b.repMin===undefined||Number.isInteger(b.repMin)&&b.repMin>=1&&b.repMin<=30)&&(b.repMax===undefined||Number.isInteger(b.repMax)&&b.repMax>=(b.repMin||1)&&b.repMax<=30)&&(b.loadStep===undefined||Number.isFinite(b.loadStep)&&b.loadStep>=.25&&b.loadStep<=25))))return false;
 //§ js/personal.js
 if(!((s.displayName===undefined||typeof s.displayName==='string'&&s.displayName.length<=40)))return false;
 //§ js/navigation.js
 if(!((s.colorTheme===undefined||Object.hasOwn(colorThemes,s.colorTheme))&&(s.avatarImage===undefined||typeof s.avatarImage==='string'&&s.avatarImage.length<=200000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.avatarImage))))return false;
 //§ js/flows.js
 if(!(s.foods.every(x=>validNutrients(x.nutrients))&&s.custom.every(x=>validNutrients(x.nutrients))&&s.workouts.every(w=>w.bodyweight===undefined||Number.isFinite(w.bodyweight)&&w.bodyweight>=20&&w.bodyweight<=400)&&(s.microGoals===undefined||validNutrients(s.microGoals))&&(s.waterGoal===undefined||Number.isFinite(s.waterGoal)&&s.waterGoal>=0&&s.waterGoal<=10000)))return false;
 //§ js/flows.js (2)
 if(!((s.email===undefined||typeof s.email==='string'&&s.email.length<=254)&&(s.setupPending===undefined||typeof s.setupPending==='boolean')&&(s.onboardingComplete===undefined||typeof s.onboardingComplete==='boolean')))return false;
 //§ js/flows.js (3)
 if(!((s.appDesign===undefined||Object.hasOwn(appDesigns,s.appDesign))))return false;
 //§ js/interactions.js
 if(!((s.soundEnabled===undefined||typeof s.soundEnabled==='boolean')&&(s.soundVolume===undefined||Number.isFinite(s.soundVolume)&&s.soundVolume>=0&&s.soundVolume<=70)))return false;
 //§ js/comfort.js
 if(!((s.language===undefined||['de','en'].includes(s.language))&&(s.iconColor===undefined||mappedAppIcon(s.iconColor)!==null)))return false;
 //§ js/tracker-tools.js (Maße, Fasten, Essenspläne)
 {let safeId=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id),finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;if(s.measurements&&(!Array.isArray(s.measurements)||s.measurements.length>10000||!s.measurements.every(x=>safeId(x.id)&&toolDateValid(x.date)&&Object.entries(measurementFields).every(([k,[,,min,max]])=>x[k]===undefined||finite(x[k],min,max)))))return false;if(s.fasts&&(!Array.isArray(s.fasts)||s.fasts.filter(x=>!x.endedAt).length>1||!s.fasts.every(x=>safeId(x.id)&&finite(x.startedAt,0,1e15)&&finite(x.targetHours,1,24)&&(x.endedAt===undefined||finite(x.endedAt,x.startedAt,1e15)))))return false;if(s.mealPlans&&(!Array.isArray(s.mealPlans)||s.mealPlans.length>10000||!s.mealPlans.every(x=>safeId(x.id)&&toolDateValid(x.date)&&typeof x.name==='string'&&x.name.length<=100&&['g','ml'].includes(x.unit)&&finite(x.grams,.1,10000)&&['kcal','p','c','f'].every(k=>finite(x[k],0,100000))&&validNutrients(x.nutrients))))return false;if(!(s.workouts.every(w=>w.exercises.every(e=>e.superset===undefined||safeId(e.superset)))))return false}
 //§ js/adaptation.js (Logbuch, TDEE, Check-ins)
 {if(s.foodLogCompleted&&(!Array.isArray(s.foodLogCompleted)||s.foodLogCompleted.length>30000||!s.foodLogCompleted.every(toolDateValid)))return false;if(s.plan?.learnTdee!==undefined&&typeof s.plan.learnTdee!=='boolean')return false;let c=s.tdeeCalibration;if(c&&(!s.profile||!toolDateValid(c.date)||!toolDateValid(c.windowStart)||!toolDateValid(c.windowEnd)||!Number.isFinite(c.value)||c.value<1200||c.value>6000||!Number.isFinite(c.base)||c.base<500||c.base>10000||!Number.isFinite(c.activity)||c.activity<1||c.activity>3))return false;if(s.coachingMode!==undefined&&typeof s.coachingMode!=='boolean')return false;if(!(!s.checkins||Array.isArray(s.checkins)&&s.checkins.every(x=>typeof x.id==='string'&&/^[\w-]{1,100}$/.test(x.id)&&toolDateValid(x.date)&&Number.isInteger(x.energy)&&x.energy>=1&&x.energy<=5&&Number.isInteger(x.hunger)&&x.hunger>=1&&x.hunger<=5&&typeof x.note==='string'&&x.note.length<=1000)))return false}
 //§ js/food-upgrade.js
 if(!(s.custom.every(x=>(x.favorite===undefined||typeof x.favorite==='boolean')&&(x.portions===undefined||Array.isArray(x.portions)&&x.portions.length<=30&&x.portions.every(p=>p&&typeof p.name==='string'&&p.name.length<=80&&['g','ml'].includes(p.unit)&&Number.isFinite(p.amount)&&p.amount>0&&p.amount<=10000)))))return false;
 //§ js/account-guide.js
 if(!((s.tutorialVersion===undefined||s.tutorialVersion===0||s.tutorialVersion===1)))return false;
 //§ js/quick-units.js
 if(!(s.custom.every(x=>x.density===undefined||Number.isFinite(x.density)&&x.density>=.01&&x.density<=20)))return false;
 //§ js/progress-metrics.js (lädt nach cloud.js, das validData schon beim Laden aufrufen kann: fehlen die Tabellen noch, entfällt ihre Prüfung)
 {let v=s.progressView;if(!((v===undefined||v&&typeof v==='object'&&!Array.isArray(v)&&(v.group===undefined||typeof progressGroups!=='object'||Object.hasOwn(progressGroups,v.group))&&(v.range===undefined||typeof progressRanges!=='object'||Object.hasOwn(progressRanges,v.range))&&(v.metric===undefined||typeof v.metric==='string'&&v.metric.length<=160))))return false}
 //§ js/food-photo.js
 if(!(['foods','custom'].every(key=>s[key].every(x=>x.aiEstimate===undefined||x.aiEstimate===true&&typeof x.source==='string'&&x.source.startsWith('KI-Schätzung')&&(!x.nutrients||Object.keys(x.nutrients).length===0)))))return false;
 //§ js/running.js (Läufe, Aktivitäten, Routen)
 {
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
  if(!(runsOk&&activeOk&&settingsOk&&routesOk))return false;
 }
 //§ js/native-extras.js (nativeExtras)
 if(s.nativeExtras!==undefined){
  const p=s.nativeExtras;
  if(!object(p)||p.healthEnabled!==undefined&&typeof p.healthEnabled!=='boolean')return false;
  if(p.reminders!==undefined&&!(object(p.reminders)&&Object.entries(p.reminders).every(([key,r])=>['training','weight'].includes(key)&&object(r)&&typeof r.enabled==='boolean'&&typeof r.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)&&Array.isArray(r.days)&&r.days.length<=7&&r.days.every(d=>Number.isInteger(d)&&d>=1&&d<=7)&&new Set(r.days).size===r.days.length&&(!r.enabled||r.days.length>0))))return false;
 }
 //§ js/workout-import.js (Workout-CSV)
 {
  const fieldsOK=value=>value===undefined||value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([k,v])=>k.length<=200&&typeof v==='string'&&v.length<=4000000 /* MAX_BYTES in workout-import.js */);
  if(!((s.routines||[]).every(r=>r.importWorkoutId===undefined||typeof r.importWorkoutId==='string'&&/^wi_[a-f0-9]{64}$/.test(r.importWorkoutId))&&s.workouts.every(w=>(w.importSource===undefined||w.importSource==='workout-csv'&&/^wi_[a-f0-9]{64}$/.test(w.id))&&(w.csvRows===undefined||Array.isArray(w.csvRows)&&w.csvRows.every(fieldsOK))&&w.exercises.every(e=>e.sets.every(set=>(set.setOrder===undefined||typeof set.setOrder==='string'&&set.setOrder.length<=200)&&fieldsOK(set.csvFields))))))return false;
 }
 //§! Rückschreiben der bereinigten Optionen, nur nach vollständig bestandener Prüfung
 if(v87)v87.optionCommit(input,s);
 //§ js/routine-favorites.js
 return (input.routines||[]).every(r=>r.favorite===undefined||typeof r.favorite==='boolean');
}
async function importData(file){if(!file)return;try{if(file.size>5000000)throw Error();let s=JSON.parse(await file.text());if(!validData(s))throw Error();delete s.__pulsRecoveryUploadBlocked;if(typeof prepareImportedData==='function')s=prepareImportedData(s);if(!validData(s))throw Error();if(!confirm('Alle aktuellen Daten durch diese Sicherung ersetzen?'))return;preserveCorruptState();try{appStore.setItem('puls-local-before-import',JSON.stringify(state))}catch{try{exportData()}catch{toast('Export nicht möglich. Wiederherstellen abgebrochen.');return}if(!confirm('Gerätespeicher voll. Der bisherige Stand wurde als Datei zum Download angeboten. Bitte die Datei sichern. Trotzdem mit dem Import fortfahren?'))return}try{if(!finishRecovery(s)){toast('Wiederherstellen abgebrochen. Deine Arbeitskopie bleibt erhalten.');return}}catch{toast('Wiederherstellen abgebrochen: Speichern nicht möglich. Bitte Gerätespeicher freigeben.');return}state=s;save();modal.close();render();toast('Sicherung wiederhergestellt')}catch{toast('Ungültige Sicherung. Daten bleiben erhalten.')}}
// Prefer the separately saved working copy only after the core validator and meal names are ready.
try{let recovered=JSON.parse(appStore.getItem('puls-v1-recovered')||'null');if(recovered&&validCore(recovered)){delete recovered.__pulsRecoveryUploadBlocked;state=recovered;stateRecoveryPending=true;stateLoadCorrupt=true;stateUploadBlockPending=true;preserveCorruptState()}}catch{}
setDate(date);

