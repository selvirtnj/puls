/* Phase A: Web owns the profile. Old iOS apps and browsers remain entirely untouched. */
(function(){
'use strict';
const bridge=window.webkit?.messageHandlers?.pulsState;
if(typeof bridge?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||!window.pulsNativeFeatures.includes('stateBridge'))return;
const preview=typeof firstRunPreview!=='undefined'&&firstRunPreview;
const seqKey='puls-native-seq',appliedKey='puls-native-applied',ownerPendingKey='puls-native-owner-pending';
const webVersion=document.currentScript?.src?.match(/[?&]v=([^&#]+)/)?.[1]||'';
let ready=false,seq=0,timer=null,pending=null,contextReason=null,applying=false,rollingBack=false,saveDepth=0,activating=false,activationProfile=null,adoptingLocal=false,helloOwnerPending;
let projectionTimer=null,projectionSeq=0,projectionRevision=0;
let progressTimer=null,progressIdle=false;
let interests=new Set(['overview','training']);
let chromeRequested=false,chromeSessionHold=false,pageHidden=false,lastChrome=null,reportedPage;
let trainingConfirmed=false,trainingApplying=false;
let activityConfirmed=false,activityPreparing=false;
const feature=name=>Array.isArray(window.pulsNativeFeatures)&&window.pulsNativeFeatures.includes(name);
// M4: injected at document start; without it no training wrapper, op, projection or global is installed.
const trainingFeature=feature('nativeTraining');
const trainingAdapter=()=>trainingFeature&&typeof window.pulsNativeTraining?.build==='function'?window.pulsNativeTraining:null;
const progressFeature=feature('nativeProgress');
const progressAdapter=()=>progressFeature&&typeof window.pulsNativeProgress?.build==='function'?window.pulsNativeProgress:null;
const activityFeature=feature('nativeActivity');
const activityAdapter=()=>activityFeature&&typeof window.pulsNativeActivity?.build==='function'?window.pulsNativeActivity:null;
const nutritionFeature=feature('nativeNutrition');
const nutritionAdapter=()=>nutritionFeature&&typeof window.pulsNativeNutrition?.build==='function'?window.pulsNativeNutrition:null;
const accountFeature=feature('nativeAccount');
const accountAdapter=()=>accountFeature&&typeof window.pulsNativeAccount?.build==='function'?window.pulsNativeAccount:null;
const completionFeature=feature('nativeCompletion'),extrasFeature=feature('nativeExtras');
let nativeCompleting=false;
let accountPreparing=false;
const currentAccountSection=()=>page==='account'&&typeof accountSection==='string'&&accountSection?accountSection:null;
const copy=value=>JSON.parse(JSON.stringify(value));
const userId=()=>typeof cloudSession!=='undefined'?cloudSession?.user?.id??null:null;
let stateOwner=userId();
// A failed login persists its Auth session before fetching the profile. Keep that ambiguity across reloads.
if(!preview&&stateOwner!==null)try{if(localStorage.getItem(ownerPendingKey)===stateOwner)stateOwner=undefined}catch{stateOwner=undefined}
const profileReady=()=>!activating&&stateOwner===userId();
function hello(force=false){
  const ownerPending=!profileReady();
  if(ready&&(ownerPending||force))resetNativeCursors();
  if(ownerPending){for(const view of Object.values(views))view.last=null;chromeRequested=false;chromeSessionHold=false;trainingConfirmed=false;activityConfirmed=false;syncNativeChrome()}
  if(!ready||!force&&ownerPending===helloOwnerPending)return;
  const training=trainingAdapter(),progress=progressAdapter(),activity=activityAdapter(),nutrition=nutritionAdapter(),account=accountAdapter();
  if(post({type:'hello',webVersion,ops:['weight.upsert','weight.delete',...[training,progress,activity,nutrition,account].flatMap(x=>x?Object.keys(x.ops):[]),...(completionFeature?['completion.dismiss']:[])],
    screens:['body',...(training?['training']:[]),...(progress?['calendar','progress']:[]),...(activity?['activity']:[]),...(nutrition?['nutrition']:[]),...(account?['account']:[])],
    projections:['overview',...(training?['training']:[]),...(progress?['progress']:[]),...(activity?['activity']:[]),...(nutrition?['nutrition']:[]),...(account?['account']:[])],
    features:['nativeTabs',...(training?['nativeTraining']:[]),...(progress?['nativeProgress']:[]),...(activity?['nativeActivity']:[]),...(nutrition?['nativeNutrition']:[]),...(account?['nativeAccount']:[]),...(completionFeature?['nativeCompletion']:[]),...(extrasFeature?['nativeExtras']:[])],
    ...(completionFeature||extrasFeature?{extras:{queries:[...(completionFeature?['completion']:[]),...(extrasFeature?['page','pageItem','indexChart','export','share']:[])],ops:completionFeature?['completion.dismiss']:[]}}:{}),
    ...(nutrition?{nutrition:{stage:nutrition.stage,queries:nutrition.queries}}:{}),
    ...(account?{account:{queries:account.queries,webActions:account.actions}}:{}),ownerPending})){
    helloOwnerPending=ownerPending;
    if(!ownerPending)queueProjection('ready',true);
  }
}
function claimProfile(){stateOwner=userId();if(!preview)try{localStorage.removeItem(ownerPendingKey)}catch{}hello()}
const uploadConfirmed=(user,revision)=>user!==null&&user===userId()&&cloudRevision>revision&&!cloudDirty&&!cloudConflict;
function restoreState(target,backup){for(const key of Object.keys(target))if(!Object.hasOwn(backup,key))delete target[key];Object.assign(target,copy(backup))}
function flags(){return {preview:!!preview,
  recovery:!!((typeof stateRecoveryPending!=='undefined'&&stateRecoveryPending)||(typeof stateCorruptRaw!=='undefined'&&stateCorruptRaw!==null)),
  uploadBlocked:!!((typeof cloudUploadBlocked!=='undefined'&&cloudUploadBlocked)||(typeof stateUploadBlockPending!=='undefined'&&stateUploadBlockPending))}}
function cloud(){return {signedIn:userId()!==null,revision:typeof cloudRevision!=='undefined'?cloudRevision:0,
  dirty:typeof cloudDirty!=='undefined'&&!!cloudDirty,conflict:typeof cloudConflict!=='undefined'&&!!cloudConflict}}
function post(message){try{bridge.postMessage({protocol:1,...message});return true}catch(error){console.warn('PULS state bridge',error);return false}}
function chromeState(){
  const visible=selector=>{const node=document.querySelector(selector);return !!node&&!node.hidden&&!!node.getClientRects?.().length};
  let reason='none';
  if((typeof runView!=='undefined'&&runView)||visible('#run-root'))reason='run';
  else if((typeof sessionWorkoutId!=='undefined'&&sessionWorkoutId)||(typeof completionId!=='undefined'&&completionId)||
    (typeof activityDoneId!=='undefined'&&activityDoneId)||visible('#session-root'))reason='session';
  else if((typeof modal!=='undefined'&&modal.open)||document.querySelector('dialog[open]'))reason='modal';
  else if(typeof calendarEditing==='function'&&calendarEditing())reason='editing';
  return {blocking:reason!=='none',reason,page,accountSection:currentAccountSection()};
}
function syncNativeChrome(current=chromeState()){
  const fullscreen=current.reason==='session'||current.reason==='run';
  if(!fullscreen)chromeSessionHold=false;
  document.documentElement.classList.toggle('puls-native-tabs',!pageHidden&&ready&&helloOwnerPending===false&&profileReady()&&
    feature('nativeTabs')&&(chromeRequested||chromeSessionHold&&fullscreen));
}
function reportChrome(){
  // A training op briefly opens Web sheets (finish, superset); report only the final state after the op.
  if(!ready||trainingApplying)return;
  const current=chromeState(),stamp=JSON.stringify(current);syncNativeChrome(current);
  if(stamp!==lastChrome&&post({type:'chrome',...current}))lastChrome=stamp;
}
window.pulsNativeSetChrome=function(active){
  if(typeof active!=='boolean')return false;
  if(!active){
    const current=chromeState();
    chromeSessionHold=(chromeRequested||chromeSessionHold)&&(current.reason==='session'||current.reason==='run');
    chromeRequested=false;syncNativeChrome(current);return true;
  }
  if(!ready||pageHidden||helloOwnerPending!==false||!profileReady()||!feature('nativeTabs'))return false;
  chromeRequested=true;chromeSessionHold=false;syncNativeChrome();return true;
};
function reportNavigation(forceWeb=false){
  if(ready&&!trainingApplying&&(page!==reportedPage||forceWeb)&&post({type:'navigate',page,...(openingWeb?{web:true}:{})}))reportedPage=page;
}
// Loaded after account-refresh and page-slide; later scripts do not replace these entry points.
// Scope the Web escape to this call, never to a later click or the lifetime of the section.
let openingWeb=false;
if(typeof openAccountSection==='function'){
  const base=openAccountSection;
  openAccountSection=function(key,...args){
    if(!openingWeb&&ready&&helloOwnerPending===false&&profileReady()&&accountAdapter()&&!chromeState().blocking&&
      ['plan','body','adaptive','design','sounds','manage'].includes(key)&&post({type:'openNative',screen:'account',section:key}))return;
    if(key==='body'&&!openingWeb&&ready&&helloOwnerPending===false&&profileReady()&&
      Array.isArray(window.pulsNativeFeatures)&&window.pulsNativeFeatures.includes('nativeBody')&&
      post({type:'openNative',screen:'body'}))return;
    return base.call(this,key,...args);
  };
}
window.pulsNativeNavigate=function(target){
  if(!target||typeof target!=='object'||Array.isArray(target))return false;
  const current=chromeState();reportChrome();
  const closingQuickAdd=target.action==='quickAdd'&&current.reason==='modal'&&document.body.classList.contains('quickaddopen');
  if(current.blocking&&!closingQuickAdd)return false;
  if(target.action!==undefined){
    if(!ready||!profileReady()||typeof target.action!=='string'||target.page!==undefined||target.section!==undefined)return false;
    // These are Web UI entry points, never an eval string or a second mutation API.
    const actions={
      ...(accountAdapter()?Object.fromEntries(accountAdapter().actions.map(action=>[action,()=>accountAdapter().navigate(target)])):{}),
      ...(progressAdapter()?Object.fromEntries(progressAdapter().actions.map(action=>[action,()=>progressAdapter().navigate(target)])):{}),
      ...(activityAdapter()?Object.fromEntries(activityAdapter().actions.map(action=>[action,()=>activityAdapter().navigate(target)])):{}),
      quickAdd:()=>{quickAddMenu();return true},
      addFood:()=>{go('food');foodForm();if(typeof foodTab==='function')foodTab('search');return true},
      editFood:()=>{if(!state.foods.some(x=>x.id===target.id&&x.date===date))return false;go('food');editDiaryFood(target.id);return true},
      // web:true opens the Web session for this call only (native training fallback), never for later entries.
      resumeWorkout:()=>{const active=activeWorkout();if(!active||active.id!==target.id)return false;if(typeof openWorkoutSession==='function'){const previous=openingWeb;openingWeb=target.web===true;try{openWorkoutSession(active.id)}finally{openingWeb=previous}}else{trainTab='current';go('workout')}return true},
      resumeRun:()=>{if(!state.activeRun||typeof openRunView!=='function')return false;openRunView();return true},
      startRoutine:()=>{if(!state.routines.some(x=>x.id===target.id))return false;go('workout');startRoutine(target.id);return true},
      startWorkout:()=>{go('workout');startWorkout();return true},
      routines:()=>{trainTab='routines';go('workout');return true},
      addWeight:()=>{weightForm();return true}
    };
    if(!Object.hasOwn(actions,target.action))return false;
    const previous=openingWeb;openingWeb=target.web===true;
    try{return actions[target.action]()}finally{openingWeb=previous;reportChrome()}
  }
  if(!['workout','home','food','account'].includes(target.page))return false;
  if(target.section!==undefined&&(target.page!=='account'||typeof accountSections==='undefined'||
    !accountSections.some(entry=>entry.key===target.section)||typeof openAccountSection!=='function'))return false;
  const previous=openingWeb;openingWeb=target.web===true;
  try{go(target.page);if(target.section!==undefined)openAccountSection(target.section);return true}finally{openingWeb=previous;reportChrome()}
};
window.pulsNativeSetDate=function(day){reportChrome();if(!ready||!profileReady()||chromeState().blocking||!validDay(day))return false;setDate(day);return true};
function overviewInputs(){
  // References/counts and explicit view settings are cheap. In-place profile mutations invalidate via save/queue.
  return [projectionRevision,state,date,today(),state.language,state.chartPeriod,...['weight','strength','kcal'].map(k=>state.chartLines?.[k]),
    state.goals,state.profile,state.plan,state.foods,state.foods.length,state.weights,state.weights.length,state.workouts,state.workouts.length,
    state.routines,state.routines?.length,state.runs,state.runs?.length,state.microGoals,state.waterGoal,state.foodLogCompleted,state.foodLogCompleted?.length,
    state.activeRun,state.activeRun?.pausedAt,state.activeRun?.pausedSeconds,typeof dsCurrentScheme==='function'?dsCurrentScheme():null,window.pulsConnectivity?.online];
}
function trainingInputs(){
  // Set edits are in place; every persisted training change passes save()/queue() and bumps projectionRevision.
  return [projectionRevision,state,today(),state.language,state.workouts,state.workouts?.length,state.routines,state.routines?.length,
    state.exerciseBook,state.exerciseBook?.length,state.workoutSettings,state.workoutSettings?.restSeconds];
}
function progressInputs(){
  return [projectionRevision,state,today(),state.language,state.progressView,state.progressView?.group,state.progressView?.range,state.progressView?.metric,
    state.chartPeriod,...['weight','strength','kcal'].map(k=>state.chartLines?.[k]),state.workouts,state.workouts?.length,state.runs,state.runs?.length,
    state.exerciseBook,state.exerciseBook?.length,state.weights,state.weights?.length,state.foods,state.foods?.length,state.measurements,state.measurements?.length,
    state.runSettings,state.profile,typeof recapMode==='string'?recapMode:null,typeof recapOffset==='number'?recapOffset:null,
    typeof actMode==='string'?actMode:null,typeof actOffset==='number'?actOffset:null,typeof actFilter==='string'?actFilter:null];
}
function activityInputs(){return [projectionRevision,state,today(),state.language,state.runSettings,state.runRoutes,state.runs,...activityAdapter().inputKey()]}
function nutritionInputs(){return [projectionRevision,state,date,today(),state.language,state.goals,state.profile,state.plan,state.foods,state.foods.length,
  state.custom,state.custom.length,state.recipes,state.recipes?.length,state.microGoals,state.waterGoal,state.foodLogCompleted,window.pulsConnectivity?.online]}
function accountInputs(){return [projectionRevision,state,date,today(),state.language,state.profile,state.plan,state.goals,state.measurements,state.weights,
  state.displayName,state.avatarImage,state.soundEnabled,state.soundVolume,typeof getColorScheme==='function'?getColorScheme():null,
  resolveColorScheme(getColorScheme(),!!pulsSchemeMedia?.matches),typeof cloudBusy!=='undefined'&&cloudBusy]}
const sameInputs=(a,b)=>!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
// One cache/dedup record per projection name; projectionSeq is shared and monotonic per document.
const views={
  overview:{feature:'nativeOverview',section:true,inputs:overviewInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>typeof window.pulsNativeBuildOverview==='function'?window.pulsNativeBuildOverview:null},
  training:{feature:'nativeTraining',section:false,inputs:trainingInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>trainingAdapter()?.build||null},
  progress:{feature:'nativeProgress',section:false,inputs:progressInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>progressAdapter()?.build||null},
  activity:{feature:'nativeActivity',section:false,inputs:activityInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>activityAdapter()?.build||null},
  nutrition:{feature:'nativeNutrition',section:false,inputs:nutritionInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>nutritionAdapter()?.build||null},
  account:{feature:'nativeAccount',section:true,inputs:accountInputs,last:null,lastSection:undefined,cache:null,cachedInputs:null,force:false,
    builder:()=>accountAdapter()?.build||null}
};
const supportedViews=()=>Object.entries(views).filter(([,view])=>feature(view.feature)&&view.builder());
const enabledViews=()=>supportedViews().filter(([name])=>interests.has(name));
const setInputActive=()=>!!document.activeElement?.matches?.('input,textarea,select')&&!!document.activeElement?.closest?.('.liveset,.set,.sessioncontent');
function scheduleProgress(){
  clearTimeout(progressTimer);progressTimer=null;progressIdle=false;
  if(!interests.has('progress')||!progressAdapter())return;
  progressTimer=setTimeout(()=>{progressTimer=null;progressIdle=true;if(setInputActive()){scheduleProgress();return}projection('idle','progress')},1000);
}
window.pulsNativeSetInterest=function(request){
  if(!ready||pageHidden||!profileReady()||!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==1||!Object.hasOwn(request,'projections')||
    !Array.isArray(request.projections)||request.projections.length>supportedViews().length||new Set(request.projections).size!==request.projections.length||
    Array.from(request.projections).some(name=>typeof name!=='string'||!supportedViews().some(([key])=>key===name)))return false;
  const previous=interests;interests=new Set(request.projections);
  for(const [name,view] of supportedViews())if(interests.has(name)&&!previous.has(name))view.force=true;
  if(!interests.has('progress')){clearTimeout(progressTimer);progressTimer=null;progressIdle=false}
  else if(!previous.has('progress'))scheduleProgress();
  projection('interest');return true;
};
function projection(reason,force=false){
  clearTimeout(projectionTimer);projectionTimer=null;
  if(!ready||helloOwnerPending!==false||!profileReady()||applying||rollingBack||saveDepth)return;
  for(const [name,view] of enabledViews()){
    if((name==='activity'||name==='nutrition'||name==='account')&&(pageHidden||activityPreparing||accountPreparing))continue;
    if(name==='progress'&&(!progressIdle||setInputActive()||pageHidden))continue;
    const build=view.builder();
    try{
      const inputs=view.inputs();
      if(!sameInputs(inputs,view.cachedInputs)){view.cache=build({seq,revision:projectionRevision});view.cachedInputs=inputs}
      const status={userId:userId(),flags:flags(),cloud:cloud(),...(view.section?{accountSection:currentAccountSection()}:{})},stamp=JSON.stringify([status,view.cache]);
      if(force!==true&&force!==name&&!view.force&&stamp===view.last)continue;
      if(post({type:'projection',name,projectionSeq:projectionSeq+1,seq,...status,ownerPending:false,reason,[name]:view.cache})){
        projectionSeq++;view.last=stamp;view.lastSection=status.accountSection;view.force=false;
      }
    }catch{ /* A projection failure must not interrupt saving or the existing Web UI. */ }
  }
}
function queueProjection(reason='render',force=false){
  const list=enabledViews();if(!list.length)return;
  if(force)for(const [,view] of list)view.force=true;
  if(list.some(([name,view])=>name==='progress'&&(view.force||!sameInputs(view.inputs(),view.cachedInputs)))&&!progressTimer)scheduleProgress();
  if(!list.some(([,view])=>view.force||!sameInputs(view.inputs(),view.cachedInputs)||view.section&&currentAccountSection()!==view.lastSection))return;
  clearTimeout(projectionTimer);
  if(ready&&!applying&&!rollingBack)projectionTimer=setTimeout(()=>{if(pending)flush();projection(reason)},300);
}
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
  const message={type:'snapshot',seq:next,userId:userId(),state:profile,cloud:cloud(),flags:flags(),reason,ownerPending:false,
    ...(accountAdapter()?{device:accountAdapter().device()}: {})};
  if(!preview)localStorage.setItem(seqKey,String(next));
  seq=next;return message;
}
function flush(){
  clearTimeout(timer);timer=null;
  if(!ready||!pending||applying||!profileReady())return;
  try{const message=snapshot(pending);pending=null;post(message);projection(message.reason)}catch(error){console.warn('PULS state snapshot',error)}
}
function queue(reason='save'){
  projectionRevision++;
  scheduleProgress();
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

// Training ops may return a small result (e.g. the Web-generated workout ID); weight acks keep their v1 shape.
function ack(id,code,message,result){
  // The complete immutable completion remains in the existing owner-bound replay record. Large routes/wins are
  // read in chunks; do not post a multi-megabyte ack. Ordinary/old-IPA acknowledgements keep their exact shape.
  if(completionFeature&&result?.completion&&JSON.stringify(result).length>40*1024){const c=result.completion;
    result={...result,completion:{kind:c.kind,id:c.id,...(c.cycleId?{cycleId:c.cycleId}:{}),xp:c.xp,durationXp:c.durationXp,level:c.level,streak:c.streak,chunked:true}}}
  post({type:'ack',id,ok:!code,seq,...(code?{error:{code,message}}:result!==undefined?{result}:{})});
}
function applied(){
  if(preview)return [];
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
  if(activityPreparing||accountPreparing){ack(id,'busy','Ein asynchroner Web-Abschluss läuft');return}
  const history=applied(),known=history.find(x=>x.id===id&&x.userId===cmd.userId);
  if(known){ack(id,undefined,undefined,known.result);queue('apply');flush();return}
  if(completionFeature&&cmd.op==='completion.dismiss'){
    const a=cmd.args;
    if(!nativeFields(a,['id','cycleId'])||!nativeId(a.id)||a.cycleId!==undefined&&!nativeId(a.cycleId)){ack(id,'invalid','Abschluss-ID und gültiger optionaler Zyklus erforderlich');return}
    const completion=a.cycleId===undefined?completionFor(a.id):history.findLast(x=>x.userId===cmd.userId&&x.result?.completion?.id===a.id&&x.result.completion.cycleId===a.cycleId)?.result.completion;
    if(!completion){ack(id,'gone','Abschlusszyklus nicht mehr im Replay-Speicher');return}
    commit(cmd,history,{run:()=>({dismissedId:a.id,...(completion.cycleId?{dismissedCycleId:completion.cycleId}:{})}),verify:()=>true});return;
  }
  const training=trainingAdapter(),trainingOp=training&&typeof cmd.op==='string'&&Object.hasOwn(training.ops,cmd.op)?training.ops[cmd.op]:null;
  if(trainingOp){applyTraining(cmd,history,training,trainingOp);return}
  const progress=progressAdapter(),progressOp=progress&&typeof cmd.op==='string'&&Object.hasOwn(progress.ops,cmd.op)?progress.ops[cmd.op]:null;
  if(progressOp){applyTraining(cmd,history,progress,progressOp);return}
  const activity=activityAdapter(),activityOp=activity&&typeof cmd.op==='string'&&Object.hasOwn(activity.ops,cmd.op)?activity.ops[cmd.op]:null;
  if(activityOp){if(activityOp.prepare)void prepareActivity(cmd,history,activity,activityOp);else applyTraining(cmd,history,activity,activityOp);return}
  const nutrition=nutritionAdapter(),nutritionOp=nutrition&&typeof cmd.op==='string'&&Object.hasOwn(nutrition.ops,cmd.op)?nutrition.ops[cmd.op]:null;
  if(nutritionOp){applyTraining(cmd,history,nutrition,nutritionOp);return}
  const account=accountAdapter(),accountOp=account&&typeof cmd.op==='string'&&Object.hasOwn(account.ops,cmd.op)?account.ops[cmd.op]:null;
  if(accountOp){if(accountOp.prepare)void prepareAccount(cmd,history,account,accountOp);else applyTraining(cmd,history,account,accountOp);return}
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
  // app.js:addWeight removes the day's old entry and appends the new one; finish.js:removeEntry filters by ID.
  // Native already confirmed the action, so use those exact mutations without opening a Web form/confirmation.
  commit(cmd,history,{run(){
    if(cmd.op==='weight.upsert'){
      state.weights=state.weights.filter(x=>x.id!==args.id&&x.date!==args.date);
      state.weights.push({id:args.id,date:args.date,kg:args.kg});
    }else state.weights=state.weights.filter(x=>x.id!==args.id);
  },verify:stored=>Array.isArray(stored?.weights)&&(cmd.op==='weight.delete'?!stored.weights.some(x=>x.id===args.id):
    stored.weights.some(x=>x.id===args.id&&x.date===args.date&&x.kg===args.kg)&&stored.weights.filter(x=>x.date===args.date).length===1)});
};
// M4: the save/render wrappers of native-bridge.js/insights.js report rest, workout timer and run Live Activity state
// synchronously. During a training op those messages stay in this document until the op is confirmed: then only the
// final state per kind is delivered once (if it differs from what Native already has); after a rollback none is.
// Rest/workout messages are pure state, so an equivalent repeat (the bridge correcting itself) is always dropped.
const nativeKind=(handler,message)=>handler==='pulsWorkout'?'workout':['restStart','restCancel','workoutActive'].includes(message?.type)?'rest':message?.type==='runActivity'?'run':
  activityFeature&&['runGpsStart','runGpsStop'].includes(message?.type)?'gps':activityFeature&&message?.type==='runGpsSync'?'gpsSync':(activityFeature||nutritionFeature||accountFeature)&&message?.type==='haptic'?'haptic':null;
// Identity of the rest a restStart describes: same selection as native-bridge.js activeRest(), read when the bridge
// posts (synchronously from the current state). Two rests with equal end time and label stay different rests.
const nativeRestKey=()=>{
  const now=Date.now(),w=(state.workouts||[]).filter(x=>!x.finished&&x.rest?.endAt>now).sort((a,b)=>a.rest.endAt-b.rest.endAt)[0];
  return w?JSON.stringify([w.id,w.rest.exerciseId??null,w.rest.endAt]):null;
};
const nativeSame=(kind,a,b)=>{
  if(!a||!b)return false;
  if(kind==='rest'){
    // Within the same rest identity, startsAt/cancelRest only describe how the bridge reached the state
    // (e.g. its correction after a rolled-back op). A different rest is always a new restStart.
    if(a.message.type==='restStart'&&a.key!==b.key)return false;
    const plainState=({startsAt,cancelRest,...value})=>value;return JSON.stringify(plainState(a.message))===JSON.stringify(plainState(b.message));
  }
  return JSON.stringify(a.message)===JSON.stringify(b.message);
};
const nativeSent=new Map();let nativeBuffer=null;
function gateNativeHandler(name){
  const handler=window.webkit?.messageHandlers?.[name];
  if(!handler||typeof handler.postMessage!=='function')return;
  const send=handler.postMessage,deliver=record=>{send.call(handler,record.message);if(record.kind)nativeSent.set(record.kind,{...record,message:copy(record.message)})};
  try{
    handler.postMessage=function(message){
      const kind=nativeKind(name,message),record={kind,message,deliver,key:message?.type==='restStart'?nativeRestKey():null};
      if(kind&&nativeBuffer){nativeBuffer.push(record);return}
      if((kind==='rest'||kind==='workout')&&nativeSame(kind,nativeSent.get(kind),record))return;
      deliver(record);
    };
  }catch{ /* A read-only handler keeps the previous, unbuffered behaviour. */ }
}
function releaseNative(confirmed){
  const buffered=nativeBuffer||[];nativeBuffer=null;
  if(!confirmed)return;
  const last=new Map();for(const record of buffered){last.delete(record.kind);last.set(record.kind,record)}
  // A haptic is an event, not a state: an equal earlier haptic never suppresses the confirmed one.
  for(const record of last.values())if(record.kind==='haptic'||!nativeSame(record.kind,nativeSent.get(record.kind),record))try{record.deliver(record)}catch{}
}
if(trainingFeature||activityFeature||nutritionFeature||accountFeature){gateNativeHandler('pulsNative');gateNativeHandler('pulsWorkout')}
const webDialogOpen=()=>(typeof modal!=='undefined'&&!!modal.open)||!!document.querySelector('dialog[open]');
// Finish pauses/persists exactly as the Web button and asynchronously drains the existing native recorder.
// Never hold a rollback copy across await: a cloud takeover or Web edit must not be undone by an old command.
async function prepareActivity(cmd,history,adapter,op){
  const args=cmd.args;
  if(!args||typeof args!=='object'||Array.isArray(args)){ack(cmd.id,'invalid','Ungültige Argumente');return}
  let plan;try{plan=op.check(args)}catch{plan={code:'invalid',message:'Ungültige Argumente'}}
  if(plan.code){ack(cmd.id,plan.code,plan.message);return}
  if(webDialogOpen()||['run','session'].includes(chromeState().reason)){ack(cmd.id,'busy','Ein Web-Ablauf ist geöffnet');return}
  const owner=userId(),profile=state,run=state.activeRun;
  activityPreparing=true;
  try{
    const result=await op.prepare(args,plan);
    if(!profileReady()||owner!==userId()){ack(cmd.id,'not_ready','Profilzuordnung geändert');return}
    // A replaced profile with the same run still active is retryable (busy); only a different/no run is final (gone).
    if(profile!==state||run!==state.activeRun){const same=state.activeRun?.startedAt===args.startedAt;
      ack(cmd.id,same?'busy':'gone',same?'Profil während GPS-Abschluss neu geladen – erneut senden':'Aktivität während GPS-Abschluss geändert');return}
    if(Object.values(flags()).some(Boolean)){ack(cmd.id,'readonly','Profil ist schreibgeschützt');return}
    if(result?.code){ack(cmd.id,result.code,result.message);return}
    // Recheck current args/ownership/dialog state after receiving all points. Only the final synchronous part is atomic.
    applyTraining(cmd,history,adapter,op);
  }catch{ack(cmd.id,'busy','GPS-Abschluss noch nicht bestätigt')}
  finally{activityPreparing=false;reportChrome();queueProjection('activity')}
}
async function prepareAccount(cmd,history,adapter,op){
  let plan;try{plan=op.check(cmd.args)}catch{plan={code:'invalid',message:'Ungültige Argumente'}}
  if(plan.code){ack(cmd.id,plan.code,plan.message);return}
  cmd={...cmd,args:copy(cmd.args)};
  if(plan.noop||!cmd.args.dataUrl){applyTraining(cmd,history,adapter,op);return}
  if(chromeState().blocking){ack(cmd.id,'busy','Ein Web-Ablauf ist geöffnet');return}
  const owner=userId(),profile=state;accountPreparing=true;
  try{
    const prepared=await op.prepare(cmd.args);
    if(!profileReady()||owner!==userId()){ack(cmd.id,'not_ready','Profilzuordnung geändert');return}
    if(pageHidden){ack(cmd.id,'busy','Web-Dokument ist ausgeblendet');return}
    if(profile!==state){ack(cmd.id,'busy','Profil neu geladen – erneut senden');return}
    if(Object.values(flags()).some(Boolean)){ack(cmd.id,'readonly','Profil ist schreibgeschützt');return}
    if(prepared?.code){ack(cmd.id,prepared.code,prepared.message);return}
    applyTraining(cmd,history,adapter,op,prepared);
  }catch{ack(cmd.id,'invalid','Profilbild konnte nicht gelesen werden')}
  finally{accountPreparing=false;queueProjection('account')}
}
function applyTraining(cmd,history,training,op,prepared){
  const id=cmd.id,args=cmd.args;
  if(!args||typeof args!=='object'||Array.isArray(args)){ack(id,'invalid','Ungültige Argumente');return}
  // lifecycle.js closes sessions older than five hours on focus/visibility; do the same before acting on one.
  try{if(training===trainingAdapter()&&typeof sweepLongWorkouts==='function')sweepLongWorkouts()}catch{}
  let plan;try{
    // blur may commit a Web onchange/save: validate expect only after that event has finished.
    if(training===progressAdapter()&&!webDialogOpen()&&!['run','session'].includes(chromeState().reason))document.activeElement?.blur?.();
    plan=op.check(args,prepared);
  }catch{plan={code:'invalid',message:'Ungültige Argumente'}}
  if(plan.code){ack(id,plan.code,plan.message);return}
  // These Web functions close #modal; never discard an unrelated open Web form. Native retries after chrome changes.
  if(plan.busy&&(webDialogOpen()||(training===progressAdapter()||training===activityAdapter())&&['run','session'].includes(chromeState().reason)||
    (training===nutritionAdapter()||training===accountAdapter())&&chromeState().blocking)){ack(id,'busy','Ein Web-Ablauf ist geöffnet');return}
  if(prepared)plan.prepared=prepared;
  commit(cmd,history,{ui:training,completion:!plan.noop&&completionFeature&&['workout.finish','run.summary.save'].includes(cmd.op),run:()=>{
    const result=plan.noop?plan.result:op.run(args,plan);
    if(completionFeature&&(cmd.op==='workout.finish'||cmd.op==='run.summary.save')){
      const kind=cmd.op==='workout.finish'?'workout':'run',id=kind==='workout'?args.workoutId:result?.runId;
      const cached=completionFor(id,kind);
      // A lost replay log may still find an already finished entry. Never invent/recalculate its original award.
      const completion=plan.noop?cached:buildCompletion(kind,id,cmd.id);
      if(!plan.noop)clearCompletion();
      return {...(result||{}),...(kind==='workout'?{workoutId:id}:{}),...(completion?{completion}:{completionUnavailable:true})};
    }
    return result;
  },verify:(stored,result)=>op.effective(stored,args,plan,result)});
}
function commit(cmd,history,{run,verify,ui,completion=false}){
  const id=cmd.id;
  let before,target,raw,oldHistory,metaKey,metaRaw,dirty,message,view,result,wrote=false,failed=false,code='persist_failed',reason;
  const previousReason=contextReason,waiting=pending,previousCompleting=nativeCompleting;
  try{
    raw=localStorage.getItem('puls-v1');try{oldHistory=localStorage.getItem(appliedKey)}catch{oldHistory=null}
    metaKey=userId()===null?null:cloudStorageKey(userId());if(metaKey)metaRaw=localStorage.getItem(metaKey);
    dirty=typeof cloudDirty!=='undefined'?cloudDirty:undefined;message=typeof cloudMessage!=='undefined'?cloudMessage:undefined;
    before=copy(state);target=state;view=ui?ui.captureUi():undefined;applying=true;trainingApplying=!!ui;contextReason='apply';
    nativeCompleting=completion;
    if(ui)nativeBuffer=[];
    // Training ops call Web functions; an exception there is a rejected command, not a storage problem.
    try{result=run()}catch(error){if(ui){code='invalid';reason=error?.message}throw error}
    if(!validData(state)){code='invalid';throw Error('Ungültiges Profil')}
    // The effective render chain invokes adaptiveGoals(), including goal history/calibration and its nested saves.
    // Validate again afterwards and save once more so the final derived state is persisted as well.
    render();
    if(ui?.afterRender)ui.afterRender(result);
    if(!validData(state)){code='invalid';throw Error('Ungültiges Profil nach Neuberechnung')}
    wrote=true;save();
    const stored=JSON.parse(localStorage.getItem('puls-v1')||'null');
    if(!verify(stored,result)||JSON.stringify(stored)!==JSON.stringify(state))throw Error('Profil nicht vollständig gespeichert');
    localStorage.setItem(appliedKey,JSON.stringify([...history,{id,userId:cmd.userId,...(result!==undefined?{result}:{})}].slice(-200)));
    // Reserve a stored sequence before confirming. WebKit may flush localStorage to disk later (see protocol).
    const confirmed=snapshot('apply');clearTimeout(timer);timer=null;pending=null;
    ack(id,undefined,undefined,result);
    post(confirmed);
  }catch(error){
    failed=true;
    if(before){
      // Redraw the previous profile, but don't let a rollback render persist derived targets.
      rollingBack=true;restoreState(target,before);if(view)ui.restoreUi(view);
      try{render()}catch{}finally{restoreState(target,before);rollingBack=false}
      // render/adaptiveGoals may already have saved before a later validation or history write failed.
      try{if(wrote||localStorage.getItem('puls-v1')!==raw){if(raw===null)localStorage.removeItem('puls-v1');else localStorage.setItem('puls-v1',raw)}}catch{}
      try{if(oldHistory===null)localStorage.removeItem(appliedKey);else localStorage.setItem(appliedKey,oldHistory)}catch{}
      if(dirty!==undefined)cloudDirty=dirty;if(message!==undefined)cloudMessage=message;
      try{if(metaKey){if(metaRaw===null)localStorage.removeItem(metaKey);else localStorage.setItem(metaKey,metaRaw)}}catch{}
      try{if(typeof cloudStatusChanged==='function')cloudStatusChanged()}catch{}
    }
    clearTimeout(timer);timer=null;pending=waiting;
    ack(id,code,code==='invalid'?(reason?'Web-Ablauf hat den Befehl abgelehnt: '+reason:'Ergebnis ist kein gültiges Profil'):'Speichern nicht bestätigt');
  }finally{
    // After the ack: one reconciliation from the final state, or nothing at all after a rollback.
    if(ui)releaseNative(!failed);
    if(ui?.settled)ui.settled(!failed);
    applying=false;trainingApplying=false;nativeCompleting=previousCompleting;contextReason=previousReason;if(failed&&pending)queue(pending);if(!failed)projection('apply');
    if(ui){reportNavigation();reportChrome()}
  }
}
// N1: one demand-only query envelope, sharing the existing ownership/transaction gates. No profile schema change.
const nativeId=x=>typeof x==='string'&&x.length>0&&x.length<=256;
const nativeFields=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k));
const nativeError=(kind,code,message)=>({kind,ok:false,error:{code,message}});
function clearCompletion(){
  if(typeof completionId!=='undefined')completionId=null;
  if(typeof completionStep!=='undefined')completionStep=0;
  if(typeof activityDoneId!=='undefined')activityDoneId=null;
  if(typeof xpCelebrationPending!=='undefined')xpCelebrationPending=null;
  if(typeof completionReview!=='undefined')completionReview=false;
}
function completionFor(id,kind){
  if(!id)return null;
  return applied().findLast(x=>x.userId===userId()&&x.result?.completion?.id===id&&(!kind||x.result.completion.kind===kind))?.result.completion??null;
}
function buildCompletion(kind,id,cycleId){
  const w=kind==='workout'?state.workouts.find(x=>x.id===id&&x.finished):(state.runs||[]).find(x=>x.id===id);
  if(!w)throw Error('Abschluss fehlt');
  // The Web has a derived XP model, not an incrementing ledger. Capture one award-map result here, once after
  // the final finish chain. Replay/query NEVER calls workoutAwards again for this completion.
  const awards=workoutAwards(),award=awards[id]||{xp:0,wins:[]},level=xpProgress(Object.values(awards).reduce((n,a)=>n+a.xp,0));
  const summary=kind==='workout'?{name:w.name,date:w.date,durationSeconds:w.durationSeconds??null,
    durationClock:w.durationSeconds==null?null:formatClock(w.durationSeconds),bodyweight:w.bodyweight??null,
    exerciseCount:w.exercises.filter(e=>e.sets.length).length,...workoutStats([w])}:
    {...activityAdapter().query({kind:'run',id,requestId:'completion'}).result,
      durationClock:formatClock(w.durationSeconds),paceSeconds:runPace(w),distanceText:runKm(w.distanceKm)};
  const weekStartDay=weekStart(today()),trained=new Set(completedWorkouts().map(x=>x.date));
  const week=Array.from({length:7},(_,i)=>{const d=new Date(weekStartDay+'T12:00:00');d.setDate(d.getDate()+i);const day=localISO(d);return {date:day,trained:trained.has(day),today:day===today()}});
  return {kind,id,cycleId,xp:award.xp,durationXp:award.durationXp??0,wins:copy(award.wins||[]),level,
    streak:dailyWorkoutStreak(),weekStreak:trainingStreak(),week,summary,webStateCleared:true};
}
let nativeCursorSerial=0,nativeCursorContext=null;
// An old document's cursor must never accidentally address a newly issued cursor after reload.
const nativeCursorEpoch=completionFeature||extrasFeature?Math.random().toString(36).slice(2)+Date.now().toString(36):'';
const nativeCursors=completionFeature||extrasFeature?new Map():null;
const nativeQueryCache=new Map();
function nativeCached(key,build){
  if(nativeQueryCache.has(key))return nativeQueryCache.get(key);
  const value=build();nativeQueryCache.set(key,value);
  if(nativeQueryCache.size>32)nativeQueryCache.delete(nativeQueryCache.keys().next().value);
  return value;
}
function resetNativeCursors(){nativeCursors?.clear();nativeQueryCache.clear();nativeCursorContext=null}
function queryContext(){
  const values=[state,userId(),seq,projectionRevision,today(),state.language,state.chartPeriod,JSON.stringify(state.chartLines)];
  if(!nativeCursorContext||values.some((v,i)=>v!==nativeCursorContext[i])){nativeCursors.clear();nativeQueryCache.clear();nativeCursorContext=values}
}
function touchCursor(token){
  const cursor=nativeCursors.get(token);
  if(cursor){nativeCursors.delete(token);nativeCursors.set(token,cursor)}
  return cursor;
}
function cursorFor(scope,offset,afterItemCursor=null){
  const token='n1-'+nativeCursorEpoch+'-'+(++nativeCursorSerial);nativeCursors.set(token,{scope,offset,afterItemCursor});
  if(nativeCursors.size>64)nativeCursors.delete(nativeCursors.keys().next().value);return token;
}
function offsetFor(r,scope){
  if(r.cursor===undefined||r.cursor===null)return 0;
  if(typeof r.cursor!=='string'||r.cursor.length>100)return null;
  const c=nativeCursors.get(r.cursor);
  if(c?.scope!==scope)return null;
  touchCursor(r.cursor);if(c.afterItemCursor)touchCursor(c.afterItemCursor);
  return c.offset;
}
function chunkNative(r,value,scope,meta={}){
  const content=nativeCached('content:'+scope,()=>typeof value==='string'?value:JSON.stringify(value)),offset=offsetFor(r,scope);
  if(offset===null)return nativeError(r.kind,'stale_cursor','Datenstand geändert; erneut ab der ersten Seite lesen');
  // The page continuation belongs to this row's active chunk chain. Refresh its LRU position before allocating
  // another chunk cursor, otherwise a row of >64 chunks would evict the page cursor needed after that row.
  const afterItemCursor=meta.afterItemCursor??nativeCursors.get(r.cursor)?.afterItemCursor??null;
  if(afterItemCursor)touchCursor(afterItemCursor);
  let end=Math.min(content.length,offset+12*1024);
  while(JSON.stringify(content.slice(offset,end)).length>38*1024)end=offset+Math.floor((end-offset)/2);
  // JSON file text is itself chunked: keep both short escapes and complete \uXXXX sequences together.
  const slash=content.lastIndexOf('\\',end-1);
  if(end<content.length&&slash>=offset&&end-slash<=5){let begin=slash;while(begin>offset&&content[begin-1]==='\\')begin--;
    if((slash-begin+1)%2===1&&(end===slash+1||content[slash+1]==='u'&&/^[0-9a-f]{4}$/i.test(content.slice(slash+2,slash+6))&&end<slash+6))end=slash;
  }
  if(end<content.length&&/[\uD800-\uDBFF]/.test(content[end-1])&&/[\uDC00-\uDFFF]/.test(content[end]))end--;
  return {kind:r.kind,ok:true,result:{...meta,encoding:typeof value==='string'?'text':'json',content:content.slice(offset,end),offset,totalLength:content.length,
    nextCursor:end<content.length?cursorFor(scope,end,afterItemCursor):null}};
}
const nativeCollections={diary:['date'],recipes:[],monthEntries:['month'],metricPoints:['metric','range'],historyDays:[],records:[],activityEntries:['mode','offset','filter'],exerciseHistory:['exerciseId'],bodyHistory:[],measurements:[]};
function nativeRows(r,scope){
  const adapter=['diary','recipes'].includes(r.collection)?nutritionAdapter():['bodyHistory','measurements'].includes(r.collection)?accountAdapter():progressAdapter();
  if(!adapter?.pageRows)return {code:'unavailable',message:'Provider nicht verfügbar'};
  return nativeCached('rows:'+scope,()=>adapter.pageRows(r));
}
function nativePage(r){
  const keys=Object.hasOwn(nativeCollections,r.collection)?nativeCollections[r.collection]:null;
  if(!keys||!nativeFields(r,['requestId','kind','collection','cursor','limit',...keys])||!keys.every(k=>Object.hasOwn(r,k))||
    r.limit!==undefined&&(!Number.isInteger(r.limit)||r.limit<1||r.limit>200))return null;
  const scope=JSON.stringify([r.collection,...keys.map(k=>r[k])]),offset=offsetFor(r,scope);
  if(offset===null)return nativeError(r.kind,'stale_cursor','Datenstand geändert; erneut laden');
  const rows=nativeRows(r,scope);
  if(rows===null)return null;
  if(rows.code)return nativeError(r.kind,rows.code,rows.message);
  const items=[];let length=0;
  for(const item of rows.slice(offset,offset+(r.limit??60))){const size=JSON.stringify(item).length;
    // Oversize individual rows (e.g. imported exercise with thousands of sets) can be read losslessly in chunks.
    if(!items.length&&size>38*1024){
      const afterItemCursor=offset+1<rows.length?cursorFor(scope,offset+1):null;
      return chunkNative({...r,cursor:undefined},item,scope+':item:'+offset,{collection:r.collection,itemIndex:offset,total:rows.length,
        itemCursor:cursorFor(scope+':item:'+offset,0,afterItemCursor),afterItemCursor});
    }
    if(length+size>38*1024)break;items.push(item);length+=size;
  }
  const end=offset+items.length;
  return {kind:r.kind,ok:true,result:{collection:r.collection,items,total:rows.length,nextCursor:end<rows.length?cursorFor(scope,end):null}};
}
function nativeIndex(){
  // experience.js:progressChart normalization, using the LAST effective trendData (weekly weight wrapper included).
  // Keep full precision just as the SVG; Swift only plots these values, never normalizes them.
  const data=trendData(),series={};
  for(const k of ['weight','strength','kcal'].filter(k=>state.chartLines?.[k]!==false)){
    const baseline=data.find(x=>x[k]!==null&&x[k]>0)?.[k];
    series[k]=baseline?data.filter(x=>x[k]!==null).map(x=>({date:x.date,raw:x[k],v:x[k]/baseline*100})):[];
  }
  const points=Object.values(series).flat();
  return {period:state.chartPeriod||'month',series,min:points.length?Math.min(90,...points.map(x=>x.v))-5:80,max:points.length?Math.max(110,...points.map(x=>x.v))+5:120,
    first:data[0]?.date??null,last:data.at(-1)?.date??null};
}
function nativeExport(r){
  if(!nativeFields(r,['requestId','kind','format','csvOptions','cursor'])||!['json','csv'].includes(r.format)||
    r.format==='json'&&r.csvOptions!==undefined||r.format==='csv'&&(!nativeFields(r.csvOptions,['kind'])||!['foods','workouts','weights','measurements'].includes(r.csvOptions.kind)))return null;
  const scope=JSON.stringify(['export',r.format,r.csvOptions?.kind??null]);
  const {content,name,type}=nativeCached(scope,()=>{let content,name,type;
  if(r.format==='json'){
    // Only state, never localStorage/Auth/session/cloud keys. Unknown ordinary profile fields remain lossless.
    content=JSON.stringify(state,(key,value)=>/(?:password|token|secret|session|cloud|supabase|authorization|authentication|credential|api[_-]?key)/i.test(key)||/^(?:auth|jwt)$/i.test(key)?undefined:value,2);
    name='puls-sicherung-'+today()+'.json';type='application/json';
  }else{
    const base=downloadText;downloadText=(filename,text,mime)=>{name=filename;content=text;type=mime};
    try{csvExport(r.csvOptions.kind)}finally{downloadText=base}
  }
    return {content,name,type};
  });
  return chunkNative(r,content,scope,{name,type});
}
if(completionFeature||extrasFeature){
  window.pulsNativeQuery=function(request){
    if(!ready||pageHidden||helloOwnerPending!==false||!profileReady()||applying||rollingBack||activityPreparing||accountPreparing||saveDepth||
      !nativeFields(request,['requestId','kind','collection','cursor','limit','date','month','metric','range','mode','offset','filter','exerciseId','id','format','csvOptions','itemIndex'])||
      typeof request.requestId!=='string'||!request.requestId.trim()||request.requestId.length>100)return false;
    const r=copy(request);queryContext();let answer;
    try{
      if(r.kind==='completion'&&completionFeature&&nativeFields(r,['requestId','kind','collection','id','cursor'])&&nativeId(r.id)&&
        (r.collection===undefined||['workout','run'].includes(r.collection))){
        const history=applied(),index=history.findLastIndex(x=>x.userId===userId()&&x.result?.completion?.id===r.id&&(!r.collection||x.result.completion.kind===r.collection)),
          c=index<0?null:history[index].result.completion,dismissed=(c?.cycleId?history:history.slice(index+1)).some(x=>x.userId===userId()&&x.result?.dismissedId===r.id&&(!c?.cycleId||x.result.dismissedCycleId===c.cycleId));
        answer=c?chunkNative(r,c,'completion:'+c.kind+':'+r.id,{id:r.id,dismissed}):nativeError(r.kind,'gone','Kein gespeicherter Abschluss; niemals XP erneut berechnen');
      }
      if(extrasFeature){
        if(r.kind==='page')answer=nativePage(r);
        if(r.kind==='pageItem'&&Number.isInteger(r.itemIndex)&&r.itemIndex>=0){
          const keys=Object.hasOwn(nativeCollections,r.collection)?nativeCollections[r.collection]:null;
          if(keys&&nativeFields(r,['requestId','kind','collection','cursor','itemIndex',...keys])&&keys.every(k=>Object.hasOwn(r,k))){
            const baseScope=JSON.stringify([r.collection,...keys.map(k=>r[k])]),rows=nativeRows(r,baseScope),scope=baseScope+':item:'+r.itemIndex;
            if(rows?.code)answer=nativeError(r.kind,rows.code,rows.message);
            else if(rows){const row=rows[r.itemIndex];answer=row?chunkNative(r,row,scope):nativeError(r.kind,'gone','Zeile fehlt')}
          }
        }
        if(r.kind==='indexChart'&&nativeFields(r,['requestId','kind','cursor']))answer=chunkNative(r,nativeCached('indexChart',nativeIndex),'indexChart');
        if(r.kind==='export')answer=nativeExport(r);
        if(r.kind==='share'&&nativeFields(r,['requestId','kind','collection','id','cursor'])&&['workout','run'].includes(r.collection)&&nativeId(r.id)){
          const w=r.collection==='workout'?state.workouts.find(x=>x.id===r.id&&x.finished):(state.runs||[]).find(x=>x.id===r.id);
          if(!w)answer=nativeError(r.kind,'gone','Eintrag fehlt');
          else if(r.collection==='workout')answer=chunkNative(r,{title:'PULS',text:workoutShareText(r.id)},'share:workout:'+r.id);
          // There is no Web run share formatter. Supply its existing detail data/labels for the native share sheet,
          // explicitly no invented "Web share text" and no second pace/calorie computation.
          else {const data=activityAdapter()?.query({requestId:r.requestId,kind:'run',id:r.id})?.result;
            answer=data?chunkNative(r,{title:'PULS',text:null,data},'share:run:'+r.id):nativeError(r.kind,'unavailable','Aktivitätsprovider fehlt')}
        }
      }
    }catch{return false}
    return !!answer&&post({type:'nativeResult',requestId:r.requestId,seq,userId:userId(),ownerPending:false,flags:flags(),cloud:cloud(),language:state.language==='en'?'en':'de',...answer});
  };
  window.addEventListener('pagehide',resetNativeCursors);
}
function loaded(){
  if(ready)return;
  // design-system.js replaces home/render AFTER this script; wrap only the final chain on load.
  const baseRender=render;render=function(...args){const result=baseRender.apply(this,args);reportNavigation();reportChrome();queueProjection();return result};
  if(completionFeature){
    // Wrap the final Web definitions after every app script has loaded. Suppress before any completion paints,
    // including nested render() inside confirmWorkoutFinish and activityDoneShow. Outside a native finish op,
    // explicit historical Web reviews keep their existing path.
    if(typeof workoutSummary==='function'){const base=workoutSummary;workoutSummary=function(...args){if(nativeCompleting&&!rollingBack){clearCompletion();return}return base.apply(this,args)}}
    if(typeof activityDoneShow==='function'){const base=activityDoneShow;activityDoneShow=function(...args){if(nativeCompleting&&!rollingBack){clearCompletion();return}return base.apply(this,args)}}
    if(typeof renderWorkoutSession==='function'){const base=renderWorkoutSession;renderWorkoutSession=function(...args){if(nativeCompleting&&!rollingBack)clearCompletion();return base.apply(this,args)}}
  }
  const baseGo=go;go=function(...args){const previous=reportedPage,result=baseGo.apply(this,args);reportNavigation(openingWeb&&previous===page);return result};
  const baseDate=setDate;setDate=function(...args){const result=baseDate.apply(this,args);projection('date','overview');return result};
  const baseModal=openModal;openModal=function(...args){const result=baseModal.apply(this,args);reportChrome();return result};
  if(typeof renderWorkoutSession==='function'){const base=renderWorkoutSession;renderWorkoutSession=function(...args){const result=base.apply(this,args);reportChrome();return result}}
  if(typeof renderRunView==='function'){const base=renderRunView;renderRunView=function(...args){const result=base.apply(this,args);reportChrome();return result}}
  if(activityFeature&&typeof updateRunLive==='function'){const base=updateRunLive;updateRunLive=function(...args){const result=base.apply(this,args);if(interests.has('activity'))queueProjection('activity');return result}}
  if(activityFeature&&typeof openRunView==='function'){
    const base=openRunView;
    openRunView=function(...args){
      if(activityConfirmed&&!openingWeb&&ready&&!pageHidden&&helloOwnerPending===false&&profileReady()&&activityAdapter()&&
        post({type:'openNative',screen:'activity',startedAt:state.activeRun?.startedAt??null})){
        if(typeof modal!=='undefined'&&modal.open)modal.close();return;
      }
      return base.apply(this,args);
    };
  }
  if(activityFeature&&typeof runSelectRoute==='function'){
    // "Use this route" in the Web route sheet sets runView='ready' directly (past openRunView). With confirmed native
    // activity, Native presents its start view with this route preselected; a running activity is shown as is.
    const base=runSelectRoute;
    runSelectRoute=function(id,...args){
      const routeId=typeof id==='string'&&typeof runRouteById==='function'&&runRouteById(id)?id:null,active=state.activeRun?.startedAt??null;
      // null (the Web start view's "remove route" chip) stays inside that Web view.
      if(id!==null&&activityConfirmed&&!openingWeb&&ready&&!pageHidden&&helloOwnerPending===false&&profileReady()&&activityAdapter()&&
        post({type:'openNative',screen:'activity',startedAt:active,...(active===null&&routeId?{routeId}:{})})){
        if(typeof modal!=='undefined'&&modal.open)modal.close();return;
      }
      return base.call(this,id,...args);
    };
  }
  if(trainingFeature&&typeof openWorkoutSession==='function'){
    // Confirmed native training owns the strength session: Web entries (dock, overview, quick add, startRoutine)
    // ask Native to present it. Ops never open a Web session; Native presents after its ack.
    const base=openWorkoutSession;
    openWorkoutSession=function(id,...args){
      if(trainingApplying)return;
      if(trainingConfirmed&&!openingWeb&&typeof id==='string'&&activeWorkout()?.id===id&&trainingReady()&&
        post({type:'openNative',screen:'training',workoutId:id})){if(typeof modal!=='undefined'&&modal.open)modal.close();return}
      return base.call(this,id,...args);
    };
  }
  // Native shows its own rest-end alert while it owns training; the Web still clears the rest and plays its sound.
  if(trainingFeature&&typeof showRestPopup==='function'){const base=showRestPopup;showRestPopup=function(...args){if(trainingConfirmed&&trainingReady())return;return base.apply(this,args)}}
  if(typeof MutationObserver==='function'&&document.body)new MutationObserver(reportChrome).observe(document.body,
    {subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','class']});
  ready=true;hello();reportNavigation();reportChrome();pending='load';flush();
}
const trainingReady=()=>ready&&!pageHidden&&helloOwnerPending===false&&profileReady()&&!!trainingAdapter();
if(trainingFeature){
  // M4: Native confirms that it presents training itself (never persisted). true only without a Web block;
  // false is always allowed and makes every Web entry open the Web session again (fallback).
  window.pulsNativeSetTraining=function(active){
    if(typeof active!=='boolean')return false;
    if(!active){trainingConfirmed=false;return true}
    if(!trainingReady()||chromeState().blocking)return false;
    trainingConfirmed=true;return true;
  };
  window.pulsNativeExerciseSearch=function(request){
    const training=trainingAdapter();
    if(!training||!ready||helloOwnerPending!==false||!profileReady()||!request||typeof request!=='object'||Array.isArray(request)||
      typeof request.requestId!=='string'||!request.requestId||request.requestId.length>100)return false;
    let result;try{result=training.search(request)}catch{return false}
    return !!result&&post({type:'exerciseSearch',requestId:request.requestId,...result});
  };
}
if(progressFeature)window.pulsNativeProgressQuery=function(request){
  const adapter=progressAdapter();
  if(!adapter||!ready||pageHidden||helloOwnerPending!==false||!profileReady()||applying||rollingBack||saveDepth||
    !request||typeof request!=='object'||Array.isArray(request)||typeof request.requestId!=='string'||
    !request.requestId.trim()||request.requestId.length>100)return false;
  let result;try{result=adapter.query(request,{seq,revision:projectionRevision})}catch{return false}
  return !!result&&post({type:'progressResult',requestId:request.requestId,seq,userId:userId(),ownerPending:false,
    flags:flags(),cloud:cloud(),language:state.language==='en'?'en':'de',...result});
};
if(accountFeature)window.pulsNativeAccountQuery=function(request){
  const adapter=accountAdapter();
  if(!adapter||!ready||pageHidden||helloOwnerPending!==false||!profileReady()||applying||rollingBack||activityPreparing||accountPreparing||saveDepth||
    !request||typeof request!=='object'||Array.isArray(request)||typeof request.requestId!=='string'||!request.requestId.trim()||request.requestId.length>100)return false;
  let result;try{result=adapter.query(copy(request))}catch{return false}
  if(!result||JSON.stringify(result).length>48*1024)return false;
  return post({type:'accountResult',requestId:request.requestId,seq,userId:userId(),ownerPending:false,flags:flags(),cloud:cloud(),...result});
};
if(nutritionFeature){
  let queryEpoch=0;
  const invalidateQueries=()=>{queryEpoch++;nutritionAdapter()?.cancelQueries()};
  window.pulsNativeNutritionQuery=function(request){
    const adapter=nutritionAdapter();
    if(!adapter||!ready||pageHidden||helloOwnerPending!==false||!profileReady()||applying||rollingBack||activityPreparing||saveDepth||!adapter.validQuery(request))return false;
    const epoch=queryEpoch,owner=userId(),profile=state,revision=projectionRevision;
    const current=()=>epoch===queryEpoch&&!pageHidden&&ready&&helloOwnerPending===false&&profileReady()&&owner===userId()&&profile===state&&revision===projectionRevision&&!applying&&!rollingBack;
    const send=answer=>!!answer&&current()&&post({type:'nutritionResult',requestId:request.requestId,seq,userId:userId(),ownerPending:false,
      flags:flags(),cloud:cloud(),language:state.language==='en'?'en':'de',...answer});
    request=copy(request);
    try{const answer=adapter.query(request,current,send);if(answer&&typeof answer.then==='function'){void answer.then(send).catch(()=>{
      if(current())send({kind:request.kind,ok:false,error:{code:'unavailable',message:'Lokale Suche derzeit nicht verfügbar'}})});return true}return !!send(answer)}catch{return false}
  };
  window.addEventListener('pagehide',invalidateQueries);
  // Even a transient account switch must invalidate old requests before returning to the same account.
  const baseHello=hello;hello=function(...args){if(!profileReady())invalidateQueries();return baseHello(...args)};
}
if(activityFeature){
  window.pulsNativeSetActivity=function(active){
    if(typeof active!=='boolean')return false;
    if(!active){activityConfirmed=false;return true}
    if(!ready||pageHidden||helloOwnerPending!==false||!profileReady()||!activityAdapter())return false;
    // After a reload the Web reopens its live view by itself (run-session.js). That view and the start view hold no
    // unsaved input, so Native may minimise them exactly like the Web close button. Countdown, summary, dialogs,
    // workout sessions and the activity end screen keep blocking.
    const current=chromeState(),webRunView=current.reason==='run'&&typeof runView!=='undefined'&&['live','ready'].includes(runView)&&
      typeof closeRunView==='function'&&!webDialogOpen();
    if(current.blocking&&!webRunView)return false;
    // The Web lock overlay belongs to the Web view; closeRunView keeps runLocked, which would block native laps.
    if(webRunView){if(typeof runLocked!=='undefined')runLocked=false;closeRunView();if(chromeState().blocking)return false}
    activityConfirmed=true;reportChrome();return true;
  };
  window.pulsNativeActivityQuery=function(request){
    const adapter=activityAdapter();
    if(!adapter||!ready||pageHidden||helloOwnerPending!==false||!profileReady()||applying||rollingBack||activityPreparing||saveDepth||
      !request||typeof request!=='object'||Array.isArray(request)||typeof request.requestId!=='string'||!request.requestId.trim()||request.requestId.length>100)return false;
    let result;try{result=adapter.query(request)}catch{return false}
    return !!result&&post({type:'activityResult',requestId:request.requestId,seq,userId:userId(),ownerPending:false,
      flags:flags(),cloud:cloud(),language:state.language==='en'?'en':'de',...result});
  };
}
window.addEventListener('pagehide',()=>{pageHidden=true;flush();projection('background');chromeRequested=false;chromeSessionHold=false;trainingConfirmed=false;activityConfirmed=false;syncNativeChrome()});
window.addEventListener('pageshow',event=>{
  const restored=pageHidden||event.persisted===true;pageHidden=false;
  if(restored){chromeRequested=false;chromeSessionHold=false;trainingConfirmed=false;activityConfirmed=false;syncNativeChrome();hello(true)}
  reportChrome();queueProjection('foreground');
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){flush();projection('background')}else queueProjection()});
for(const event of ['close','toggle'])document.addEventListener(event,reportChrome,true);
for(const event of ['focusin','focusout'])document.addEventListener(event,()=>setTimeout(reportChrome,0),true);
window.addEventListener('puls:connectivity',()=>queueProjection('connectivity'));
if(accountFeature&&typeof pulsSchemeMedia!=='undefined'&&pulsSchemeMedia){
  const changed=()=>queueProjection('scheme');
  if(pulsSchemeMedia.addEventListener)pulsSchemeMedia.addEventListener('change',changed);
  else pulsSchemeMedia.addListener?.(changed);
}
if(document.readyState==='complete')loaded();else window.addEventListener('load',loaded,{once:true});
})();
