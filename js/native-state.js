/* Phase A: Web owns the profile. Old iOS apps and browsers remain entirely untouched. */
(function(){
'use strict';
const bridge=window.webkit?.messageHandlers?.pulsState;
if(typeof bridge?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||!window.pulsNativeFeatures.includes('stateBridge'))return;
const preview=typeof firstRunPreview!=='undefined'&&firstRunPreview;
const seqKey='puls-native-seq',appliedKey='puls-native-applied',ownerPendingKey='puls-native-owner-pending';
const webVersion=document.currentScript?.src?.match(/[?&]v=([^&#]+)/)?.[1]||'';
let ready=false,seq=0,timer=null,pending=null,contextReason=null,applying=false,rollingBack=false,saveDepth=0,activating=false,activationProfile=null,adoptingLocal=false,helloOwnerPending;
const copy=value=>JSON.parse(JSON.stringify(value));
const userId=()=>typeof cloudSession!=='undefined'?cloudSession?.user?.id??null:null;
let stateOwner=userId();
// A failed login persists its Auth session before fetching the profile. Keep that ambiguity across reloads.
if(!preview&&stateOwner!==null)try{if(localStorage.getItem(ownerPendingKey)===stateOwner)stateOwner=undefined}catch{stateOwner=undefined}
const profileReady=()=>!activating&&stateOwner===userId();
function hello(){const ownerPending=!profileReady();if(!ready||ownerPending===helloOwnerPending)return;if(post({type:'hello',webVersion,ops:['weight.upsert','weight.delete'],screens:['body'],ownerPending}))helloOwnerPending=ownerPending}
function claimProfile(){stateOwner=userId();if(!preview)try{localStorage.removeItem(ownerPendingKey)}catch{}hello()}
const uploadConfirmed=(user,revision)=>user!==null&&user===userId()&&cloudRevision>revision&&!cloudDirty&&!cloudConflict;
function restoreState(target,backup){for(const key of Object.keys(target))if(!Object.hasOwn(backup,key))delete target[key];Object.assign(target,copy(backup))}
function flags(){return {preview:!!preview,
  recovery:!!((typeof stateRecoveryPending!=='undefined'&&stateRecoveryPending)||(typeof stateCorruptRaw!=='undefined'&&stateCorruptRaw!==null)),
  uploadBlocked:!!((typeof cloudUploadBlocked!=='undefined'&&cloudUploadBlocked)||(typeof stateUploadBlockPending!=='undefined'&&stateUploadBlockPending))}}
function cloud(){return {signedIn:userId()!==null,revision:typeof cloudRevision!=='undefined'?cloudRevision:0,
  dirty:typeof cloudDirty!=='undefined'&&!!cloudDirty,conflict:typeof cloudConflict!=='undefined'&&!!cloudConflict}}
function post(message){try{bridge.postMessage({protocol:1,...message});return true}catch(error){console.warn('PULS state bridge',error);return false}}
// Loaded after account-refresh and page-slide; later scripts do not replace these entry points.
// Scope the Web escape to this call, never to a later click or the lifetime of the section.
let openingWeb=false;
if(typeof openAccountSection==='function'){
  const base=openAccountSection;
  openAccountSection=function(key,...args){
    if(key==='body'&&!openingWeb&&ready&&helloOwnerPending===false&&profileReady()&&
      Array.isArray(window.pulsNativeFeatures)&&window.pulsNativeFeatures.includes('nativeBody')&&
      post({type:'openNative',screen:'body'}))return;
    return base.call(this,key,...args);
  };
}
window.pulsNativeNavigate=function(target){
  if(!target||typeof target!=='object'||Array.isArray(target)||!['workout','home','food','account'].includes(target.page))return;
  if(target.section!==undefined&&(target.page!=='account'||typeof accountSections==='undefined'||
    !accountSections.some(entry=>entry.key===target.section)||typeof openAccountSection!=='function'))return;
  const previous=openingWeb;openingWeb=target.web===true;
  try{go(target.page);if(target.section!==undefined)openAccountSection(target.section)}finally{openingWeb=previous}
};
function readSeq(){if(preview)return seq;let value=Number(localStorage.getItem(seqKey));return Number.isSafeInteger(value)&&value>=0?value:0}
try{seq=readSeq()}catch{}
function persistedProfile(){
  // Preview must never read a real profile. A new, not-yet-saved profile has only an in-memory state.
  if(preview)return copy(state);
  const raw=localStorage.getItem('puls-v1');
  if(raw===null)return copy(state);
  try{
    const profile=JSON.parse(raw);
    if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('No persisted profile');
    return profile;
  }catch(error){
    // Corrupt raw text cannot be a JSON snapshot. Report the working copy with recovery:true instead.
    if(flags().recovery)return copy(state);
    throw error;
  }
}
function snapshot(reason){
  if(!profileReady())throw Error('Profile owner not ready');
  const profile=persistedProfile(),next=Math.max(seq,readSeq())+1;
  if(!Number.isSafeInteger(next))throw Error('Sequence exhausted');
  const message={type:'snapshot',seq:next,userId:userId(),state:profile,cloud:cloud(),flags:flags(),reason,ownerPending:false};
  if(!preview)localStorage.setItem(seqKey,String(next));
  seq=next;return message;
}
function flush(){
  clearTimeout(timer);timer=null;
  if(!ready||!pending||applying||!profileReady())return;
  try{const message=snapshot(pending);pending=null;post(message)}catch(error){console.warn('PULS state snapshot',error)}
}
function queue(reason='save'){
  // A render nested inside a cloud/import/apply action must not hide its more specific reason.
  if(reason!=='save'||!pending)pending=reason;
  clearTimeout(timer);timer=null;
  if(ready&&!applying&&!saveDepth&&profileReady()){if(document.visibilityState==='hidden')flush();else timer=setTimeout(flush,300)}
}
const baseSave=save;
save=function(...args){if(rollingBack)return;const reason=contextReason;contextReason=reason||'save';saveDepth++;try{return baseSave.apply(this,args)}finally{saveDepth--;queue(contextReason);contextReason=reason}};

// These paths bypass the current save wrapper (cloudSaveBase), or don't save themselves (migrate).
if(typeof applyCloudProfile==='function'){
  const base=applyCloudProfile;
  applyCloudProfile=function(...args){const reason=contextReason;contextReason='cloud';try{const result=base.apply(this,args);if(result){claimProfile();queue('cloud')}return result}finally{contextReason=reason}};
}
if(typeof importData==='function'){
  const base=importData;
  importData=async function(...args){const before=state;try{return await base.apply(this,args)}finally{if(state!==before){claimProfile();queue('import')}}};
}
if(typeof performAccountAction==='function'){
  const base=performAccountAction;
  performAccountAction=async function(...args){const before=state;try{return await base.apply(this,args)}finally{if(state!==before){claimProfile();queue('reset')}}};
}
if(typeof migrate==='function'){
  const base=migrate;
  // Match migrate's actual writes without serializing foods, routes or the rest of the full profile.
  const stamp=()=>[state.version,state.profile,state.plan,state.routines,state.exerciseBook,state.exerciseBook?.length,
    state.workouts.reduce((n,w)=>n+w.exercises.filter(e=>e.exerciseId==null).length,0)];
  migrate=function(...args){const before=stamp(),result=base.apply(this,args),after=stamp();if(before.some((value,index)=>value!==after[index]))queue(contextReason||'migrate');return result};
}
if(typeof closeOverlongWorkouts==='function'){
  const base=closeOverlongWorkouts;
  closeOverlongWorkouts=function(...args){const reason=contextReason;contextReason='autofinish';try{return base.apply(this,args)}finally{contextReason=reason}};
}
// Session changes also replace the local profile via cloudSaveBase. Metadata can change without save().
if(typeof cloudStatusChanged==='function'){
  const base=cloudStatusChanged;let previous=JSON.stringify([userId(),cloud(),flags()]);
  cloudStatusChanged=function(...args){const result=base.apply(this,args),next=JSON.stringify([userId(),cloud(),flags()]);hello();if(next!==previous){previous=next;queue(contextReason||'cloud')}return result};
}
if(typeof syncCloud==='function'){
  const base=syncCloud;
  syncCloud=async function(...args){
    const user=userId(),revision=cloudRevision,upload=cloudDirty&&!args[0]?.forcePull;
    try{return await base.apply(this,args)}finally{if(upload&&uploadConfirmed(user,revision)){claimProfile();queue('cloud')}}
  };
}
if(typeof resolveCloudConflict==='function'){
  const base=resolveCloudConflict;
  resolveCloudConflict=async function(choice,...args){
    const user=userId(),revision=cloudRevision;
    try{return await base.call(this,choice,...args)}finally{if(choice==='local'&&uploadConfirmed(user,revision)){claimProfile();queue('cloud')}}
  };
}
if(typeof activateCloudSession==='function'){
  const base=activateCloudSession;
  activateCloudSession=async function(...args){
    if(activating)throw Error('Anmeldung läuft bereits');
    activating=true;activationProfile=null;hello();
    try{
      if(!preview&&!userId()&&typeof args[0]?.user?.id==='string')localStorage.setItem(ownerPendingKey,args[0].user.id);
      return await base.apply(this,args);
    }finally{
      // Pending account copies bypass applyCloudProfile, but pass through cloudClearUploadBlock before assignment.
      if(activationProfile===state)claimProfile();
      activating=false;activationProfile=null;hello();queue('cloud');flush();
    }
  };
}
if(typeof cloudClearUploadBlock==='function'){
  const base=cloudClearUploadBlock;
  cloudClearUploadBlock=function(data=state,...args){const result=base.call(this,data,...args);if(result){if(activating)activationProfile=data;if(adoptingLocal&&data===state)claimProfile()}return result};
}
if(typeof initializeCloudProfile==='function'){
  const base=initializeCloudProfile;
  initializeCloudProfile=async function(...args){adoptingLocal=true;try{return await base.apply(this,args)}finally{adoptingLocal=false;queue('cloud')}};
}
if(typeof signOutCloud==='function'){
  const base=signOutCloud;
  signOutCloud=async function(...args){try{return await base.apply(this,args)}finally{if(userId()===null)claimProfile();queue('cloud')}};
}

function ack(id,code,message){post({type:'ack',id,ok:!code,seq,...(code?{error:{code,message}}:{})})}
function applied(){
  try{
    const rows=JSON.parse(localStorage.getItem(appliedKey)||'[]');
    return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&(x.userId===null||typeof x.userId==='string')).slice(-200):[];
  }catch{return []}
}
function validDay(day){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const value=new Date(day+'T12:00:00Z');return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===day;
}
window.pulsNativeApply=function(cmd){
  const id=typeof cmd?.id==='string'?cmd.id:null;
  if(!ready||!profileReady()){ack(id,'not_ready','Web-Profil noch nicht bereit');return}
  if(!cmd||typeof cmd!=='object'||Array.isArray(cmd)||!id||!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)){ack(id,'invalid','Ungültige Befehls-ID');return}
  if(Object.values(flags()).some(Boolean)){ack(id,'readonly','Profil ist schreibgeschützt');return}
  if(cmd.userId!==userId()){ack(id,'wrong_user','Befehl gehört zu einem anderen Konto');return}
  const history=applied();
  if(history.some(x=>x.id===id&&x.userId===cmd.userId)){ack(id);queue('apply');flush();return}
  if(!['weight.upsert','weight.delete'].includes(cmd.op)){ack(id,'unknown_op','Unbekannter Befehl');return}
  const args=cmd.args;
  const validExpect=value=>value===null||typeof value==='string'&&value.trim().length>0;
  if(!args||typeof args!=='object'||Array.isArray(args)||typeof args.id!=='string'||!args.id.trim()||
    (cmd.op==='weight.upsert'&&(!validDay(args.date)||!Number.isFinite(args.kg)||args.kg<20||args.kg>400||!Object.hasOwn(args,'expect')))||
    (Object.hasOwn(args,'expect')&&!validExpect(args.expect))){ack(id,'invalid','Ungültiger Gewichtseintrag (Datum, Erwartung oder kg außerhalb 20–400)');return}
  if(cmd.op==='weight.upsert'){
    const day=state.weights.filter(x=>x.date===args.date),alreadyApplied=day.length===1&&day[0].id===args.id&&day[0].kg===args.kg;
    if(!alreadyApplied&&(day.length>1||(day[0]?.id??null)!==args.expect)){ack(id,'conflict','Gewicht für diesen Tag wurde inzwischen geändert');return}
  }else if(Object.hasOwn(args,'expect')){
    const actual=state.weights.find(x=>x.id===args.id)?.id??null;
    if(actual!==null&&actual!==args.expect){ack(id,'conflict','Gewicht wurde inzwischen geändert');return}
  }
  let before,target,raw,oldHistory,metaKey,metaRaw,dirty,message,wrote=false,failed=false,code='persist_failed';
  const previousReason=contextReason,waiting=pending;
  try{
    raw=localStorage.getItem('puls-v1');try{oldHistory=localStorage.getItem(appliedKey)}catch{oldHistory=null}
    metaKey=userId()===null?null:cloudStorageKey(userId());if(metaKey)metaRaw=localStorage.getItem(metaKey);
    dirty=typeof cloudDirty!=='undefined'?cloudDirty:undefined;message=typeof cloudMessage!=='undefined'?cloudMessage:undefined;
    before=copy(state);target=state;applying=true;contextReason='apply';
    // app.js:addWeight removes the day's old entry and appends the new one; finish.js:removeEntry filters by ID.
    // Native already confirmed the action, so use those exact mutations without opening a Web form/confirmation.
    if(cmd.op==='weight.upsert'){
      state.weights=state.weights.filter(x=>x.id!==args.id&&x.date!==args.date);
      state.weights.push({id:args.id,date:args.date,kg:args.kg});
    }else state.weights=state.weights.filter(x=>x.id!==args.id);
    if(!validData(state)){code='invalid';throw Error('Ungültiges Profil')}
    // The effective render chain invokes adaptiveGoals(), including goal history/calibration and its nested saves.
    // Validate again afterwards and save once more so the final derived state is persisted as well.
    render();
    if(!validData(state)){code='invalid';throw Error('Ungültiges Profil nach Neuberechnung')}
    wrote=true;save();
    const stored=JSON.parse(localStorage.getItem('puls-v1')||'null');
    const effective=Array.isArray(stored?.weights)&&(cmd.op==='weight.delete'?!stored.weights.some(x=>x.id===args.id):
      stored.weights.some(x=>x.id===args.id&&x.date===args.date&&x.kg===args.kg)&&stored.weights.filter(x=>x.date===args.date).length===1);
    if(!effective||JSON.stringify(stored)!==JSON.stringify(state))throw Error('Profil nicht vollständig gespeichert');
    localStorage.setItem(appliedKey,JSON.stringify([...history,{id,userId:cmd.userId}].slice(-200)));
    // Reserve a stored sequence before confirming. WebKit may flush localStorage to disk later (see protocol).
    const result=snapshot('apply');clearTimeout(timer);timer=null;pending=null;
    ack(id);
    post(result);
  }catch(error){
    failed=true;
    if(before){
      // Redraw the previous profile, but don't let a rollback render persist derived targets.
      rollingBack=true;restoreState(target,before);
      try{render()}catch{}finally{restoreState(target,before);rollingBack=false}
      // render/adaptiveGoals may already have saved before a later validation or history write failed.
      try{if(wrote||localStorage.getItem('puls-v1')!==raw){if(raw===null)localStorage.removeItem('puls-v1');else localStorage.setItem('puls-v1',raw)}}catch{}
      try{if(oldHistory===null)localStorage.removeItem(appliedKey);else localStorage.setItem(appliedKey,oldHistory)}catch{}
      if(dirty!==undefined)cloudDirty=dirty;if(message!==undefined)cloudMessage=message;
      try{if(metaKey){if(metaRaw===null)localStorage.removeItem(metaKey);else localStorage.setItem(metaKey,metaRaw)}}catch{}
      try{if(typeof cloudStatusChanged==='function')cloudStatusChanged()}catch{}
    }
    clearTimeout(timer);timer=null;pending=waiting;
    ack(id,code,code==='invalid'?'Ergebnis ist kein gültiges Profil':'Speichern nicht bestätigt');
    return;
  }finally{applying=false;contextReason=previousReason;if(failed&&pending)queue(pending)}
};
function loaded(){if(ready)return;ready=true;hello();pending='load';flush()}
window.addEventListener('pagehide',flush);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
if(document.readyState==='complete')loaded();else window.addEventListener('load',loaded,{once:true});
})();
