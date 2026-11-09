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
let backendAvailable=null,refreshTimer=null,rankPublishAvailable=null,strengthPublishAvailable=null; // Per-page capabilities.
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
 const liftOK=r=>r&&typeof r.key==='string'&&/^[a-z0-9-]{1,180}$/.test(r.key)&&
  typeof r.name==='string'&&r.name.trim().length>0&&[...r.name].length<=120&&
  Number.isInteger(r.rankIndex)&&r.rankIndex>=0&&r.rankIndex<=24&&typeof r.ratio==='number'&&Number.isFinite(r.ratio)&&r.ratio>0&&r.ratio<=1000;
 const ranked=p=>{
  const seen=new Set(),lifts=[];
  for(const r of Array.isArray(p.lift_ranks)?p.lift_ranks.slice(0,40):[])if(liftOK(r)&&!seen.has(r.key)){
   seen.add(r.key);lifts.push({key:r.key,name:r.name,rankIndex:r.rankIndex,ratio:Math.round(r.ratio*100)/100});
  }
  return {...p,xp:Number.isInteger(p.xp)&&p.xp>=0&&p.xp<=10000000?p.xp:null,
   strength_rank:Number.isInteger(p.strength_rank)&&p.strength_rank>=0&&p.strength_rank<=24?p.strength_rank:null,lift_ranks:lifts};
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
function personRows(rows,kind){
 return rows.map(p=>{
  let actions='';
  if(kind==='incoming')actions=button(text('Annehmen','Accept'),`pulsFriends.action('${p.code}','accept')`,false,acting)+button(text('Ablehnen','Decline'),`pulsFriends.action('${p.code}','decline')`,true,acting);
  if(kind==='outgoing')actions=button(text('Zurückziehen','Cancel'),`pulsFriends.action('${p.code}','remove')`,true,acting);
  if(kind==='friends'){
   const stale=dayOK(p.last_training)&&new Date(today()+'T12:00:00Z')-new Date(p.last_training+'T12:00:00Z')>=4*86400000;
   const cooldown=p.last_nudge&&Date.now()-Date.parse(p.last_nudge)<12*3600000;
   if(p.broken||stale)actions+=button(cooldown?text('Bereits gestupst','Already nudged'):'Stop slacking off',`pulsFriends.nudge('${p.code}')`,false,acting||!!cooldown);
   actions+=button(text('Entfernen','Remove'),`pulsFriends.action('${p.code}','remove')`,true,acting);
   const count=stale?0:Number.isInteger(p.streak)?p.streak:0;
   const status=p.broken||stale?text('Serie gerissen','Streak broken'):p.last_training?text('Serie aktiv','Streak active'):text('Noch kein Training','No training yet');
   return `<li><strong data-no-translate>${esc(p.name)}</strong><p>${count} ${text('Trainingstage · ','training days · ')}${status}</p><p class="note">${text('Letztes Training: ','Last training: ')}${dayOK(p.last_training)?esc(p.last_training):'–'}</p><p class="note">${text('Stand: ','Updated: ')}${esc(p.updated_at?.slice(0,10)||'–')}</p><div class="friends-actions">${actions}</div></li>`;
  }
  return `<li><strong data-no-translate>${esc(kind==='outgoing'?p.code:p.name)}</strong><div class="friends-actions">${actions}</div></li>`;
 }).join('');
}
function panelHTML(){
 if(!context())return `<p>${text('Freunde sind nur angemeldet und online verfügbar.','Friends require sign-in and an internet connection.')}</p>`;
 const status=`<p class="note" role="status">${esc(message)}</p>`;
 if(!snapshot)return `<p class="note" role="status">${esc(message||waitingMessage())}</p>`+button(text('Erneut laden','Reload'),'pulsFriends.refresh(true)');
 if(!snapshot.self)return `<p>${text('Freunde sehen deinen Namen, deine Trainingsserie, das letzte Trainingsdatum und deine Kraftränge mit Übungsnamen und kg/KG-Verhältnis. Anfragen zeigen deinen Namen.','Friends see your name, training streak, last training date and strength ranks with exercise names and kg/BW ratios. Requests show your name.')}</p><form onsubmit="pulsFriends.enable(event)"><label>${text('Anzeigename für Freunde','Name for friends')}<input id="friends-name" maxlength="80" required autocomplete="off" value="${esc(state.displayName||'')}"></label><button class="btn full" ${acting?'disabled':''}>${text('Freunde aktivieren','Enable friends')}</button></form>${status}`;
 return `<div class="friends-code"><small>${text('Dein Freundescode','Your friend code')}</small><strong data-no-translate>${snapshot.self.code}</strong>${button(text('Code teilen / kopieren','Share / copy code'),'pulsFriends.share()')}</div><p class="note">${text('Stupse erscheinen beim Öffnen oder Fokussieren der App. Kein Hintergrund-Push. Ein Stups je Freund alle 12 Stunden.','Nudges appear when opening or focusing the app. No background push. One nudge per friend every 12 hours.')}</p><form onsubmit="pulsFriends.add(event)"><label>${text('Freundescode','Friend code')}<input id="friends-code" maxlength="12" minlength="12" pattern="[A-Fa-f0-9]{12}" autocapitalize="characters" autocomplete="off" spellcheck="false" required></label><button class="btn full" ${acting?'disabled':''}>${text('Anfrage senden','Send request')}</button></form>${status}
  ${snapshot.nudges.length?`<h3>${text('Stupse','Nudges')}</h3><ul class="friends-list">${snapshot.nudges.map(p=>`<li><strong data-no-translate>${esc(p.name)}</strong><p>Stop slacking off</p><small>${esc(p.sent_at?.slice(0,10)||'')}</small>${button(text('Gelesen','Dismiss'),`pulsFriends.read('${esc(p.id)}')`,true,acting)}</li>`).join('')}</ul>`:''}
  ${snapshot.incoming.length?`<h3>${text('Anfragen','Requests')}</h3><ul class="friends-list">${personRows(snapshot.incoming,'incoming')}</ul>`:''}
  ${snapshot.outgoing.length?`<h3>${text('Gesendet','Sent')}</h3><ul class="friends-list">${personRows(snapshot.outgoing,'outgoing')}</ul>`:''}
  <section id="puls-friends-board-mount"><h3>${text('Freunde','Friends')}</h3><ul class="friends-list">${personRows(snapshot.friends,'friends')||`<li>${text('Noch keine Freunde. Teile deinen Code.','No friends yet. Share your code.')}</li>`}</ul></section>
  <p class="note">${text('Trainingstage der Serie; drei volle Ruhetage unterbrechen sie. Kennzahlen werden nach dem Profilsync aktualisiert.','Training days in the streak; three full rest days break it. Summaries update after profile sync.')}</p>
  ${button(text('Aktualisieren','Refresh'),'pulsFriends.refresh(true)',true,acting)}
  ${button(text('Freunde deaktivieren','Disable friends'),'pulsFriends.disable()',true,acting)}`;
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
 if(menu&&!link){const row=document.createElement('button');row.id='puls-friends-link';row.type='button';row.className='dsrow dsaction';row.setAttribute('data-no-translate','');row.textContent=text('Freunde','Friends');row.addEventListener('click',open);menu.appendChild(row)}
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
 try{if(navigator.share)await navigator.share({title:'PULS',text:text('Mein PULS-Freundescode: ','My PULS friend code: ')+code});else{await navigator.clipboard.writeText(code);toast(text('Code kopiert','Code copied'))}}catch(error){if(error.name!=='AbortError')toast(text('Bitte den angezeigten Code kopieren.','Please copy the displayed code.'))}
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
