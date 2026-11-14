/* Optional, separate social summaries. Never writes state, saves, revisions or Auth storage.
   DOM/lifecycle listeners intentionally leave the shared render/save/Auth wrappers intact. */
(function(){
'use strict';
const text=(de,en)=>state.language==='en'?en:de;
const codeOK=value=>typeof value==='string'&&/^[A-F0-9]{12}$/.test(value);
const dayOK=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const nameOK=value=>typeof value==='string'&&[...value].length>=1&&[...value].length<=40;
const owner=()=>cloudConfigured&&!firstRunPreview&&navigator.onLine!==false?cloudSession?.user?.id||null:null;
let currentOwner=null,snapshot=null,lastPublished='',lastAttempt=0,loading=false,acting=false,message='',timer=null;
let backendAvailable=null,refreshTimer=null,rankPublishAvailable=null,strengthPublishAvailable=null,strengthScaleAvailable=null; // Per-page capabilities.
// v93 summaries carry rank_scale 2 (stages 0..39). Servers before friends-strength-v2.sql accept
// only {strength_rank,lift_ranks} with stages 0..24: convert to the old scale instead of failing.
function legacyStrength(value){
 const toLegacy=window.pulsStrength?.toLegacy;
 if(!value||typeof value!=='object'||typeof toLegacy!=='function')return null;
 const lifts=(Array.isArray(value.lift_ranks)?value.lift_ranks:[]).map(r=>({...r,rankIndex:toLegacy(r.rankIndex)})).filter(r=>Number.isInteger(r.rankIndex));
 const rank=value.strength_rank===null?null:toLegacy(value.strength_rank);
 // An unconvertible rank must never become the explicit "clear" summary.
 if(value.strength_rank!==null&&rank===null)return null;
 return {strength_rank:rank,lift_ranks:lifts};
}
const scaled=body=>!!body?.p_strength&&typeof body.p_strength==='object'&&Object.hasOwn(body.p_strength,'rank_scale');
function withLegacyStrength(body){
 const next={...body},legacy=legacyStrength(body.p_strength);
 if(legacy)next.p_strength=legacy;else delete next.p_strength; // NULL keeps the previous server summary.
 return next;
}
const controllers=new Set();
function context(){
 const next=owner();
 if(next!==currentOwner){
  for(const controller of controllers)controller.abort();
  controllers.clear();currentOwner=next;snapshot=null;lastPublished='';lastAttempt=0;message='';
  // An old modal must not display another account's friends or continue an action.
  const panel=document.getElementById('puls-friends-panel');if(panel)panel.innerHTML='';
 }
 return next;
}
async function rpc(name,body,expected=currentOwner){
 // Strip only unsupported optional summary fields; owner/revision checks stay intact.
 if(name==='publish'&&strengthPublishAvailable===false&&body){body={...body};delete body.p_strength;}
 if(name==='publish'&&strengthScaleAvailable===false&&scaled(body))body=withLegacyStrength(body);
 if(name==='publish'&&rankPublishAvailable===false&&body&&Object.hasOwn(body,'p_xp')){body={...body};delete body.p_xp}
 if(!expected||context()!==expected)throw Error('context');
 await cloudFreshSession();
 if(context()!==expected)throw Error('context');
 // Capture the existing session only for this request. Never store tokens in a second
 // place/native bridge. cloudRequest awaits its refresh internally; this explicit
 // boundary binds the summary to its original owner even during sign-out/sign-in.
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 controllers.add(controller);
 try{
  const response=await fetch(cloudConfig.url+'/rest/v1/rpc/puls_friends_'+name,{
   method:'POST',headers:{apikey:cloudConfig.publicKey,'Content-Type':'application/json',Authorization:'Bearer '+cloudSession.access_token},
   body:JSON.stringify(body||{}),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal
  });
  if(context()!==expected)throw Error('context');
  if(!response.ok){
   let detail;try{detail=await response.json()}catch{}
   // friends-strength.sql (v88) rejects the extra key and stages above 24 with 22023 "Invalid strength ...".
   if(name==='publish'&&scaled(body)&&response.status===400&&detail?.code==='22023'&&/strength/i.test(String(detail?.message||''))){
    strengthScaleAvailable=false;return await rpc(name,withLegacyStrength(body),expected);
   }
   if(name==='publish'&&body&&Object.hasOwn(body,'p_strength')&&(response.status===404||detail?.code==='PGRST202'||detail?.code==='42883')){
    strengthPublishAvailable=false;const previous={...body};delete previous.p_strength;return await rpc(name,previous,expected);
   }
   if(name==='publish'&&body&&Object.hasOwn(body,'p_xp')&&(response.status===404||detail?.code==='PGRST202')){
    rankPublishAvailable=false;const legacy={...body};delete legacy.p_xp;return await rpc(name,legacy,expected);
   }
   if(response.status===404&&(detail?.code==='PGRST202'||detail?.code==='42883')){backendAvailable=false;throw Error('setup')}
   throw Error(response.status===401?'auth':'network');
  }
  const result=await response.json();
  if(context()!==expected)throw Error('context');
  backendAvailable=true;
  if(name==='publish'&&body&&Object.hasOwn(body,'p_strength'))strengthPublishAvailable=true;
  if(name==='publish'&&scaled(body))strengthScaleAvailable=true;
  if(name==='publish'&&body&&Object.hasOwn(body,'p_xp'))rankPublishAvailable=true;
  return result;
 }finally{clearTimeout(timeout);controllers.delete(controller)}
}
function errorText(error){
 return error.message==='setup'?text('Freunde sind noch nicht eingerichtet.','Friends are not set up yet.'):
  error.message==='auth'?text('Bitte erneut anmelden.','Please sign in again.'):
  text('Freunde gerade nicht erreichbar. Bitte später erneut versuchen.','Friends are unavailable. Please try again later.');
}
function canPublish(){
 return !!context()&&cloudRevision>0&&!cloudBusy&&!cloudApplying&&!cloudDirty&&!cloudConflict&&!cloudUploadBlocked&&
  !stateLoadCorrupt&&cloudRejectedRevision===null;
}
function summary(name){
 // Pure projection of dailyWorkoutStreak (workout-polish + running). The shared
 // helper calls runList(), which lazily adds state.runs to old backups.
 const days=[...new Set([...completedWorkouts().filter(w=>loggedSets(w).length).map(w=>w.date),
  ...(Array.isArray(state.runs)?state.runs:[]).map(r=>r.date)].filter(d=>dayOK(d)&&d<=today()))].sort();
 const last=days.at(-1)||null,serial=value=>{const [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000};
 let count=0;
 if(last&&serial(today())-serial(last)<4){count=1;for(let i=days.length-2;i>=0;i--){if(serial(days[i+1])-serial(days[i])>=4)break;count++}}
 // totalWorkoutXP uses runList(), which adds runs=[] on legacy profiles.
 // Evaluate its existing wrapper chain against a shallow read view in that case,
 // and restore the authoritative state synchronously even if calculation throws.
 let xp=null;
 if(typeof totalWorkoutXP==='function'){
  const original=state;
  try{if(!Array.isArray(state.runs))state={...state,runs:[]};const total=totalWorkoutXP();
   if(typeof total==='number'&&Number.isFinite(total))xp=Math.min(10000000,Math.max(0,Math.round(total)));
  }finally{state=original}
 }
 const strength=window.pulsStrength?.summary?.();
 return {...(xp===null?{}:{p_xp:xp}),...(strength?{p_strength:strength}:{}),p_display_name:name,p_streak:Math.min(100000,count),p_last_training:last,p_streak_broken:!!last&&count===0,p_source_revision:cloudRevision};
}
function cleanSnapshot(value){
 if(!value||typeof value!=='object')throw Error('network');
 const person=p=>p&&codeOK(p.code)&&nameOK(p.name),stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
 const rows=(key,valid)=>Array.isArray(value[key])?value[key].filter(valid):[];
 // null is deliberately distinct from 0: the UI must show Rang unbekannt.
 // rank_scale 2 = stages 0..39; missing = older app/server with stages 0..24 (friends-board maps them).
 const stageOK=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
 const liftOK=(r,max)=>r&&typeof r.key==='string'&&/^[a-z0-9-]{1,180}$/.test(r.key)&&
  typeof r.name==='string'&&r.name.trim().length>0&&[...r.name].length<=120&&
  stageOK(r.rankIndex,max)&&typeof r.ratio==='number'&&Number.isFinite(r.ratio)&&r.ratio>0&&r.ratio<=1000;
 const ranked=p=>{
  const scale=p.rank_scale===2?2:null,max=scale===2?39:24,seen=new Set(),lifts=[];
  for(const r of Array.isArray(p.lift_ranks)?p.lift_ranks.slice(0,40):[])if(liftOK(r,max)&&!seen.has(r.key)){
   seen.add(r.key);lifts.push({key:r.key,name:r.name,rankIndex:r.rankIndex,ratio:Math.round(r.ratio*100)/100});
  }
  return {...p,xp:Number.isInteger(p.xp)&&p.xp>=0&&p.xp<=10000000?p.xp:null,
   strength_rank:stageOK(p.strength_rank,max)?p.strength_rank:null,lift_ranks:lifts,rank_scale:scale};
 };
 // One malformed foreign row must not disable requests or the rest of the inbox.
 return {self:person(value.self)?ranked(value.self):null,
  friends:rows('friends',p=>person(p)&&Number.isInteger(p.streak)&&p.streak>=0&&p.streak<=100000&&
   (p.last_training===null||dayOK(p.last_training))&&typeof p.broken==='boolean'&&stamp(p.updated_at)&&
   (p.last_nudge==null||stamp(p.last_nudge))).map(ranked),
  incoming:rows('incoming',person),outgoing:rows('outgoing',p=>p&&codeOK(p.code)).map(p=>({code:p.code})),
  nudges:rows('nudges',p=>person(p)&&typeof p.id==='string'&&/^[a-f0-9-]{36}$/i.test(p.id)&&stamp(p.sent_at))};
}
// Read-only data access for friends-board.js. No raw server or Auth state escapes.
// Missing/invalid XP stays null; the board labels it "Rang unbekannt".
window.pulsFriendsData87=Object.freeze({getSnapshot(){
 return context()&&snapshot?JSON.parse(JSON.stringify(snapshot)):null;
}});
function waitingMessage(){return cloudBusy||cloudApplying?text('Profilsync läuft. Bitte kurz warten.','Profile sync is running. Please wait.'):
 cloudRevision<=0?text('Bitte zuerst dein Cloud-Profil laden oder die lokalen Daten ins Konto übernehmen.','First load your cloud profile or transfer your local data to this account.'):
 text('Freunde werden geladen.','Loading friends.')}
async function refresh(force=false){
 const expected=context();mount();
 if(!expected||document.hidden||loading||acting)return;
 if(backendAvailable===false){message=errorText(Error('setup'));paint();return}
 if(cloudBusy||cloudApplying||cloudRevision<=0){message=waitingMessage();paint();return}
 // Throttle before projecting training history. Never serialize the full profile.
 if(!force&&Date.now()-lastAttempt<55000)return;
 let payload=snapshot?.self&&canPublish()?summary(snapshot.self.name):null,signature=payload?JSON.stringify(payload):'';
 loading=true;lastAttempt=Date.now();
 try{
  if(payload&&signature!==lastPublished){await rpc('publish',payload,expected);lastPublished=signature}
  snapshot=cleanSnapshot(await rpc('snapshot',{},expected));message='';
  // First start discovers opt-in; publish on the next lifecycle pass, never enroll silently.
 }catch(error){if(context()===expected&&error.message!=='context')message=errorText(error)}
 finally{loading=false;if(context()===expected){mount();paint()}}
}
function button(label,action,secondary=true,disabled=false){return `<button type="button" class="btn${secondary?' secondary':''}" onclick="${action}" ${disabled?'disabled':''}>${label}</button>`}
// Textknopf innerhalb einer Zeile (iOS-Aktion am Zeilenende); `strong` hebt die Hauptaktion der Zeile hervor.
function rowButton(label,action,{strong=false,disabled=false}={}){return `<button type="button" class="friends-act${strong?' strong':''}" onclick="${action}" ${disabled?'disabled':''}>${label}</button>`}
function groupList(rows,title=''){return `${title?`<h2 class="dsgrouptitle">${title}</h2>`:''}<ul class="dsgroup friends-list">${rows}</ul>`}
function personRows(rows,kind){
 return rows.map(p=>{
  if(kind==='incoming')return `<li class="dsrow friends-row"><span class="dsrowtext"><span data-no-translate>${esc(p.name)}</span></span><span class="friends-actions">${rowButton(text('Annehmen','Accept'),`pulsFriends.action('${p.code}','accept')`,{strong:true,disabled:acting})}${rowButton(text('Ablehnen','Decline'),`pulsFriends.action('${p.code}','decline')`,{disabled:acting})}</span></li>`;
  if(kind==='outgoing')return `<li class="dsrow friends-row"><span class="dsrowtext"><span data-no-translate>${esc(p.code)}</span></span><span class="friends-actions">${rowButton(text('Zurückziehen','Cancel'),`pulsFriends.action('${p.code}','remove')`,{disabled:acting})}</span></li>`;
  // Rückfallliste, falls die Bestenliste (friends-board.js) nicht geladen ist.
  const stale=dayOK(p.last_training)&&new Date(today()+'T12:00:00Z')-new Date(p.last_training+'T12:00:00Z')>=4*86400000;
  const cooldown=p.last_nudge&&Date.now()-Date.parse(p.last_nudge)<12*3600000;
  let actions='';
  if(p.broken||stale)actions+=rowButton(cooldown?text('Bereits gestupst','Already nudged'):'Stop slacking off',`pulsFriends.nudge('${p.code}')`,{strong:true,disabled:acting||!!cooldown});
  actions+=rowButton(text('Entfernen','Remove'),`pulsFriends.action('${p.code}','remove')`,{disabled:acting});
  const count=stale?0:Number.isInteger(p.streak)?p.streak:0;
  const status=p.broken||stale?text('Serie gerissen','Streak broken'):p.last_training?text('Serie aktiv','Streak active'):text('Noch kein Training','No training yet');
  return `<li class="dsrow friends-row friends-person"><span class="dsrowtext"><span data-no-translate>${esc(p.name)}</span><small>${count} ${text('Trainingstage · ','training days · ')}${status}</small><small>${text('Letztes Training: ','Last training: ')}${dayOK(p.last_training)?esc(p.last_training):'–'} · ${text('Stand: ','Updated: ')}${esc(p.updated_at?.slice(0,10)||'–')}</small></span><span class="friends-actions">${actions}</span></li>`;
 }).join('');
}
function stateHTML(icon,message,extra=''){return `<div class="friends-state">${typeof phIcon==='function'?`<span class="friends-stateicon" aria-hidden="true">${phIcon(icon)}</span>`:''}<p role="status">${message}</p>${extra}</div>`}
function panelHTML(){
 if(!context())return stateHTML('cloud-slash',text('Freunde sind nur angemeldet und online verfügbar.','Friends require sign-in and an internet connection.'));
 const status=`<p class="dsgroupfoot friends-status" role="status">${esc(message)}</p>`;
 if(!snapshot)return stateHTML('arrows-clockwise',esc(message||waitingMessage()),button(text('Erneut laden','Reload'),'pulsFriends.refresh(true)'));
 if(!snapshot.self)return `<form class="friends-enable" onsubmit="pulsFriends.enable(event)"><section class="dsgroup"><label class="dsrow friends-field"><span class="dsrowtext"><span>${text('Anzeigename für Freunde','Name for friends')}</span></span><input id="friends-name" maxlength="80" required autocomplete="off" placeholder="${text('Name','Name')}" value="${esc(state.displayName||'')}"></label></section><p class="dsgroupfoot">${text('Freunde sehen deinen Namen, deine Trainingsserie, das letzte Trainingsdatum und deine Kraftränge mit Übungsnamen und kg/KG-Verhältnis. Anfragen zeigen deinen Namen.','Friends see your name, training streak, last training date and strength ranks with exercise names and kg/BW ratios. Requests show your name.')}</p><button class="btn full" ${acting?'disabled':''}>${text('Freunde aktivieren','Enable friends')}</button></form>${status}`;
 const nudges=snapshot.nudges.length?groupList(snapshot.nudges.map(p=>`<li class="dsrow friends-row"><span class="dsrowtext"><span data-no-translate>${esc(p.name)}</span><small data-no-translate>Stop slacking off · ${esc(p.sent_at?.slice(0,10)||'')}</small></span><span class="friends-actions">${rowButton(text('Gelesen','Dismiss'),`pulsFriends.read('${esc(p.id)}')`,{disabled:acting})}</span></li>`).join(''),text('Stupse','Nudges')):'';
 const incoming=snapshot.incoming.length?groupList(personRows(snapshot.incoming,'incoming'),text('Anfragen','Requests')):'';
 const outgoing=snapshot.outgoing.length?groupList(personRows(snapshot.outgoing,'outgoing'),text('Gesendet','Sent')):'';
 return `<section id="puls-friends-board-mount"><h2 class="dsgrouptitle">${text('Freunde','Friends')}</h2>${groupList(personRows(snapshot.friends,'friends')||`<li class="dsrow dsempty">${text('Noch keine Freunde. Teile deinen Code.','No friends yet. Share your code.')}</li>`)}</section>
  ${status}<div class="friends-manage"><h2 class="dsgrouptitle">${text('Dein Freundescode','Your friend code')}</h2><section class="dsgroup friends-code"><div class="dsrow"><span class="dsrowtext"><strong data-no-translate>${snapshot.self.code}</strong></span>${rowButton(text('Teilen','Share'),'pulsFriends.share()',{strong:true})}</div></section>
  <form onsubmit="pulsFriends.add(event)"><h2 class="dsgrouptitle">${text('Freund hinzufügen','Add a friend')}</h2><section class="dsgroup"><label class="dsrow friends-field"><span class="dsrowtext"><span>${text('Freundescode','Friend code')}</span></span><input id="friends-code" placeholder="${text('Code eingeben','Enter code')}" maxlength="12" minlength="12" pattern="[A-Fa-f0-9]{12}" autocapitalize="characters" autocomplete="off" spellcheck="false" required></label></section><button class="btn full" ${acting?'disabled':''}>${text('Anfrage senden','Send request')}</button></form>
  ${nudges}${incoming}${outgoing}
  <section class="dsgroup friends-foot"><button type="button" class="dsrow dsaction" onclick="pulsFriends.refresh(true)" ${acting?'disabled':''}>${text('Aktualisieren','Refresh')}</button><button type="button" class="dsrow dangertext" onclick="pulsFriends.disable()" ${acting?'disabled':''}>${text('Freunde deaktivieren','Disable friends')}</button></section></div>`;
}
function paint(force=false){
 const panel=document.getElementById('puls-friends-panel');
 if(panel&&(force||!panel.contains(document.activeElement)))panel.innerHTML=panelHTML();
 const old=document.getElementById('puls-friends-notice'),count=context()?snapshot?.nudges.length||0:0;
 if(!count){old?.remove();return}
 if(old)return;
 const notice=document.createElement('div');notice.id='puls-friends-notice';notice.setAttribute('role','status');notice.setAttribute('data-no-translate','');
 notice.innerHTML=`<span>${text('Ein Freund stupst dich an:','A friend nudged you:')} <strong>Stop slacking off</strong></span>${button(text('Ansehen','View'),'pulsFriends.open()')}`;
 document.body.appendChild(notice);
}
function mount(){
 const available=context()&&backendAvailable===true,link=document.getElementById('puls-friends-link');
 if(!available){link?.remove();document.getElementById('puls-friends-notice')?.remove();return}
 const menu=document.querySelector('.accountoverview .accountmenugroup');
 // Wie die Zeilen darüber: Symbol, Titel, Chevron. Der onclick-Verweis hält die Trainings-Blau-Regel für „riend“-Zeilen (css/design-system.css) wirksam.
 if(menu&&!link){
  const row=document.createElement('button'),icon=typeof phIcon==='function';
  row.id='puls-friends-link';row.type='button';row.className='dsrow'+(icon?' dsiconrow':'')+' accountmenulink qamenulink';row.setAttribute('data-no-translate','');row.setAttribute('onclick','pulsFriends.open()');
  row.innerHTML=`${icon?`<span class="dsrowicon" aria-hidden="true">${phIcon('trophy')}</span>`:''}<span class="dsrowtext"><span>${text('Freunde & Bestenliste','Friends & leaderboard')}</span></span>${icon?`<span class="dsrowchevron" aria-hidden="true">${phIcon('caret-right')}</span>`:''}`;
  menu.appendChild(row);
 }
}
function open(){
 if(!context())return;
 openModal(text('Freunde','Friends'),'<section id="puls-friends-panel" data-no-translate></section>');paint(true);refresh(true);
}
async function mutate(name,body){
 const expected=context();if(!expected||acting)return null;
 if(loading){message=text('Bitte kurz warten.','Please wait.');return null}
 acting=true;message='';
 try{return await rpc(name,body,expected)}catch(error){if(context()===expected&&error.message!=='context')message=errorText(error);return null}
 finally{acting=false}
}
async function complete(result){
 if(result===null){paint(true);return}
 await refresh(true);
 if(result===false)message=text('Bitte zuerst das aktuelle Cloud-Profil laden.','Please load the current cloud profile first.');
 if(result==='limited')message=text('Limit erreicht. Bitte später erneut versuchen.','Limit reached. Please try again later.');
 if(result==='unavailable')message=text('Code oder Anfrage nicht verfügbar.','Code or request unavailable.');
 if(result==='exists')message=text('Es gibt bereits eine Verbindung oder Anfrage.','A connection or request already exists.');
 if(result==='active')message=text('Die Trainingsserie ist noch aktiv.','The training streak is still active.');
 paint(true);
}
async function enable(event){
 event.preventDefault();if(!canPublish()){message=text('Bitte zuerst den Profilsync abschließen oder Konflikte lösen.','Please finish profile sync or resolve conflicts first.');paint(true);return}
 const input=document.getElementById('friends-name'),name=input.value.trim();
 if(!nameOK(name)){
  message=text('Bitte einen Namen mit 1 bis 40 Zeichen eingeben.','Please enter a name with 1 to 40 characters.');
  paint(true);const field=document.getElementById('friends-name');if(field)field.value=input.value;return;
 }
 const result=await mutate('publish',{...summary(name),p_enable:true});await complete(result);
}
async function add(event){event.preventDefault();const code=document.getElementById('friends-code').value.trim().toUpperCase();if(codeOK(code))await complete(await mutate('action',{p_code:code,p_action:'request'}))}
async function action(code,kind){
 if(!codeOK(code)||!['accept','decline','remove'].includes(kind))return;
 if(kind==='remove'&&!confirm(text('Verbindung oder Anfrage entfernen?','Remove connection or request?')))return;
 await complete(await mutate('action',{p_code:code,p_action:kind}));
}
async function nudge(code){if(codeOK(code))await complete(await mutate('nudge',{p_code:code}))}
async function read(id){if(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id))await complete(await mutate('read',{p_ids:[id]}))}
async function disable(){
 if(!confirm(text('Freunde, Anfragen und Stupse löschen und Teilen beenden?','Delete friends, requests and nudges and stop sharing?')))return;
 const result=await mutate('disable',{});
 if(result===true){snapshot=null;lastPublished=''}
 await complete(result);
}
async function share(){
 const code=context()&&snapshot?.self?.code;if(!codeOK(code))return;
 if(navigator.share){
  try{await navigator.share({text:code});return}catch(error){if(error.name==='AbortError')return}
 }
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(code);
  else{
   const field=document.createElement('textarea');field.value=code;field.setAttribute('readonly','');
   Object.assign(field.style,{position:'fixed',top:'0',left:'0',opacity:'0'});modal.appendChild(field);
   try{field.focus({preventScroll:true});field.select();if(!document.execCommand('copy'))throw Error('copy')}finally{field.remove()}
  }
  toast(text('Kopiert','Copied'));
 }catch{toast(text('Bitte den angezeigten Code kopieren.','Please copy the displayed code.'))}
}
window.pulsFriends={open,refresh,enable,add,action,nudge,read,disable,share};
// Frequent workout DOM paints only mount the entry; network/summary work has its
// own minute check; completed profile syncs and focus changes can refresh earlier.
function schedule(){clearTimeout(timer);timer=setTimeout(mount,500)}
if(typeof MutationObserver==='function'){
 const content=document.getElementById('content');if(content)new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
}
window.addEventListener('focus',()=>refresh(true));window.addEventListener('online',()=>refresh(true));
window.addEventListener('offline',()=>{context();mount();paint(true)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
window.addEventListener('puls:connectivity',event=>{
 schedule();
 if(event.detail?.pendingSync===false){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(true),500)}
});
setInterval(()=>{context();mount();refresh();},60000);
schedule();setTimeout(()=>refresh(),0);
})();
