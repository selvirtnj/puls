/* M8/R, Phase A: account display/commands. Web remains the only profile/auth/sync owner. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeAccount'))return;
const copy=x=>JSON.parse(JSON.stringify(x)),plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||
  plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
const fields=(a,ks)=>plain(a)&&Object.keys(a).every(k=>ks.includes(k));
const pick=(a,ks)=>Object.fromEntries(ks.filter(k=>a?.[k]!==undefined).map(k=>[k,copy(a[k])]));
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const fail=(code,message)=>({code,message}),busy=p=>({...p,busy:true});
const contextKeys=['profile','plan','goals','weight','tdeeCalibration','date','goalRecord','profileRecord'];
const profileKeys=['age','height','target','activity','method','rmr','kcalMode','baselineFactor'];
const profileEnums={method:['mifflin','measured'],kcalMode:['classic','baseline'],activity:activityOptions.map(x=>x[0]),baselineFactor:[1.2,1.3,1.4]};
const typedProfile=p=>fields(p,profileKeys)&&Object.entries(p).every(([k,v])=>
  Object.hasOwn(profileEnums,k)?profileEnums[k].includes(v):typeof v==='number'&&Number.isFinite(v));
const planKeys=['mode','direction','pace','macroMode','protein','fat','adaptive','learnTdee'];
const macros=['kcal','p','c','f'],event={preventDefault(){}};
const text=x=>{const s=String(x??'');let end=Math.min(s.length,256);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1])&&/[\uDC00-\uDFFF]/.test(s[end]))end--;return s.slice(0,end)};
const label=x=>state.language==='en'&&typeof translatedUI==='function'?translatedUI(x):x;
const shown=x=>Number.isFinite(x)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1}).format(x)):null;
const rounded=x=>Number.isFinite(x)?shown(round(x)):null;
// Legacy run providers initialise runs on read. A projection must not add it to an old profile.
const read=fn=>{const present=Object.hasOwn(state,'runs'),runs=state.runs;try{return fn()}finally{if(present)state.runs=runs;else delete state.runs}};
const value=x=>({value:String(x??'')});
function inputs(values,fn){const base=document.getElementById;document.getElementById=function(k){return Object.hasOwn(values,k)?values[k]:base.call(this,k)};try{return fn()}finally{document.getElementById=base}}
let performing=0,after=[],pendingProfile=null,delegated=false,goalExtras=null,historyExtras=null;
function perform(fn){const base=render;performing++;render=()=>{};try{return fn()}finally{render=base;performing--}}
for(const key of ['toast','pulsSound','unlockPulsAudio']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(performing){after.push(()=>base.apply(this,args));return}return base.apply(this,args)}}
// saveMeasurements opens its editor again; native owns that editor, not a hidden Web dialog.
for(const key of ['measurementsForm','openModal','appearanceSettings','translateUI']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(!performing)return base.apply(this,args)}}
function context(){return {profile:copy(state.profile??null),plan:copy(state.plan??null),goals:copy(state.goals),weight:currentWeight()??null,
  tdeeCalibration:copy(state.tdeeCalibration??null),date:today(),goalRecord:copy(state.goalHistory?.find(x=>x.date===today())??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===today())??null)}}
const validContext=x=>fields(x,contextKeys)&&contextKeys.every(k=>Object.hasOwn(x,k))&&toolDateValid(x.date)&&plain(x.plan)&&plain(x.goals);
const sound=()=>({enabled:state.soundEnabled!==false,volume:state.soundVolume??35});
const appearance=()=>({scheme:getColorScheme(),language:state.language==='en'?'en':'de'});
function plannerInputs(p,pl,g){return Object.fromEntries([
  ...Object.entries({...p,sex:'male',special:false,weight:currentWeight()??p.weight,'kcal-mode':p.kcalMode||'classic','baseline-factor':p.baselineFactor??1.2}).map(([k,v])=>['pr-'+k,value(v)]),
  ...Object.entries({mode:pl.mode,direction:pl.direction,pace:pl.direction==='gain'&&pl.pace==='extreme'?'high':pl.pace,macros:pl.macroMode,protein:pl.protein,fat:pl.fat}).map(([k,v])=>['pl-'+k,value(v)]),
  ...macros.map(k=>['manual-'+k,value(g[k])]),['pr-special',{checked:false}],['pl-adaptive',{checked:pl.adaptive!==false}],['pl-learn-tdee',{checked:!!pl.learnTdee}]])}
function plannerEffect(day){return {...context(),date:day,goalRecord:copy(state.goalHistory?.find(x=>x.date===day)??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===day)??null)}}
const plannerEffective=(s,a,p,r)=>!!r?.effect&&['profile','plan','goals','tdeeCalibration'].every(k=>same(s[k]??null,r.effect[k]??null))&&
  same(s.goalHistory?.find(x=>x.date===r.effect.date)??null,r.effect.goalRecord)&&same(s.profileHistory?.find(x=>x.date===r.effect.date)??null,r.effect.profileRecord);
const small=x=>JSON.stringify(x).length<=24*1024;
// Bounded compressed bytes only; this is a dimension preflight, not an image decoder/validator.
// Unknown/truncated formats still go through Image and its post-decode limit.
function avatarDimensions(url){
  if(typeof atob!=='function')return null;
  const s=atob(url.slice(url.indexOf(',')+1)),b=i=>s.charCodeAt(i),le=(i,n)=>{let v=0;for(let k=0;k<n;k++)v+=b(i+k)*2**(8*k);return v},
    be=(i,n)=>{let v=0;for(let k=0;k<n;k++)v=v*256+b(i+k);return v};
  if(s.length>=24&&s.slice(0,8)==='\x89PNG\r\n\x1a\n'&&s.slice(12,16)==='IHDR'&&be(8,4)===13)return [be(16,4),be(20,4)];
  if(s.length>=4&&b(0)===255&&b(1)===216){
    let i=2;while(i+3<s.length){if(b(i++)!==255)return null;while(b(i)===255)i++;const marker=b(i++);
      if(marker===217||marker===218)return null;if(marker===1||marker>=208&&marker<=215)continue;
      const length=be(i,2);if(length<2||i+length>s.length)return null;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8)return [be(i+5,2),be(i+3,2)];i+=length;
    }
  }
  if(s.length>=20&&s.slice(0,4)==='RIFF'&&s.slice(8,12)==='WEBP'){
    for(let i=12;i+8<=s.length;){const kind=s.slice(i,i+4),length=le(i+4,4),p=i+8;if(p+length>s.length)return null;
      if(kind==='VP8X'&&length>=10)return [le(p+4,3)+1,le(p+7,3)+1];
      if(kind==='VP8L'&&length>=5&&b(p)===47){const bits=le(p+1,4);return [(bits&16383)+1,((bits>>>14)&16383)+1]}
      if(kind==='VP8 '&&length>=10&&s.slice(p+3,p+6)==='\x9d\x01\x2a')return [le(p+6,2)&16383,le(p+8,2)&16383];i=p+length+(length%2);
    }
  }
  return null;
}
function normalizedAvatar(dataUrl,image){
  // Run the actual Web FileReader/Image/canvas pipeline synchronously against a temporary working root.
  // The await (image decoding) has already finished. Never replace/hold state across an await.
  const saved={state,save,render,toast,FileReader:globalThis.FileReader,Image:globalThis.Image,create:document.createElement};
  const marker={width:image.width,height:image.height};let output;
  try{
    state={...state};delete state.avatarImage;save=()=>{};render=()=>{};toast=()=>{};
    globalThis.FileReader=class{readAsDataURL(){this.result=dataUrl;this.onload()}};
    globalThis.Image=class{constructor(){Object.defineProperty(marker,'src',{set(){this.onload()},configurable:true});return marker}};
    // A plain image facade is not a CanvasImageSource; substitute the already decoded Web image at draw time.
    document.createElement=function(tag,...args){const node=saved.create.call(this,tag,...args);if(tag==='canvas'){
      const get=node.getContext;node.getContext=function(...args){const ctx=get.apply(this,args),draw=ctx.drawImage;ctx.drawImage=function(source,...rest){return draw.call(this,source===marker?image:source,...rest)};return ctx}}
      return node};
    saveAvatarFile({type:dataUrl.slice(5,dataUrl.indexOf(';')),size:Math.floor(dataUrl.length*3/4)});output=state.avatarImage;
  }finally{state=saved.state;save=saved.save;render=saved.render;toast=saved.toast;globalThis.FileReader=saved.FileReader;globalThis.Image=saved.Image;document.createElement=saved.create}
  if(typeof output!=='string'||output.length>200000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(output))throw Error('Invalid avatar');return output;
}
const ops={
  'profile.name.set':{
    check(a){if(!fields(a,['name','expect'])||typeof a.name!=='string'||!a.name.trim()||a.name.trim().length>40||!(a.expect===null||typeof a.expect==='string'))return fail('invalid','Name 1–40 Zeichen und expect erforderlich');
      if(setupPending)return fail('busy','Erststart im Web abschließen');const target=a.name.trim();if(state.displayName===target)return {noop:true};
      if((state.displayName??null)!==a.expect)return fail('conflict','Name geändert');return busy({target})},
    run(a,p){perform(()=>inputs({'profile-name':value(p.target)},()=>saveNameProfile(event)))},effective:(s,a)=>s.displayName===a.name.trim()
  },
  'profile.avatar.set':{
    check(a,prepared){if(!fields(a,['dataUrl','expect'])||!(a.expect===null||typeof a.expect==='string'&&a.expect.length<=200000)||
      !(a.dataUrl===null||typeof a.dataUrl==='string'&&a.dataUrl.length<=512*1024&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.dataUrl)))return fail('invalid','Bild bis 512 Ki Zeichen und expect erforderlich');
      if(setupPending)return fail('busy','Erststart im Web abschließen');const target=a.dataUrl===null?null:prepared?.avatarImage;
      if(target!==undefined&&(state.avatarImage??null)===target)return {noop:true,result:{avatarImage:target}};
      // Loss-of-history replay must compare the Web-normalized JPEG before testing the old expectation.
      if(target!==undefined&&(state.avatarImage??null)!==a.expect)return fail('conflict','Profilbild geändert');return busy({target})},
    prepare(a){const dimensions=avatarDimensions(a.dataUrl);if(dimensions&&!dimensions.every(x=>finite(x,1,4096)))throw Error('size');
      return new Promise((resolve,reject)=>{const img=new Image(),cleanup=()=>{clearTimeout(timer);img.onload=null;img.onerror=null},
        timer=setTimeout(()=>{cleanup();img.src='';resolve(fail('busy','Profilbild noch nicht dekodiert – erneut senden'))},5000);
      img.onerror=()=>{cleanup();reject(Error('image'))};img.onload=()=>{cleanup();try{if(!finite(img.width,1,4096)||!finite(img.height,1,4096))throw Error('size');resolve({avatarImage:normalizedAvatar(a.dataUrl,img)})}catch(e){reject(e)}};img.src=a.dataUrl})},
    run(a,p){if(p.target===null)delete state.avatarImage;else state.avatarImage=p.target;return {avatarImage:p.target}},
    effective:(s,a,p,r)=>(s.avatarImage??null)===r.avatarImage
  },
  'profile.set':{
    check(a){if(!fields(a,['profile','expect'])||!typedProfile(a.profile)||!Object.keys(a.profile).length||!validContext(a.expect)||!small(a))return fail('invalid','Typisierte Profilfelder und vollständiger Plan-Kontext erforderlich');
      if(setupPending)return fail('busy','Erststart im Web abschließen');const vals=plannerInputs({...a.expect.profile,...a.profile},a.expect.plan,a.expect.goals);
      const p=inputs(vals,()=>collectProfile()),pl=inputs(vals,()=>collectPlan());const problem=profileError(p)||planError(p,pl,a.expect.goals);if(problem)return fail('invalid',problem);
      const target={...a.expect.profile,...p,updated:today()},observed=context();
      if(same(observed.profile,target)&&observed.weight===a.expect.weight&&same(observed.plan,pl))return busy({vals,already:true});
      if(!same(observed,a.expect))return fail('conflict','Profil oder Plan-Kontext geändert');return busy({vals})},
    run(a,p){return perform(()=>{pendingProfile={date:a.expect.date,goals:copy(state.goals),goalRecord:copy(state.goalHistory?.find(x=>x.date===a.expect.date)??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===a.expect.date)??null)};
      if(!p.already&&inputs(p.vals,()=>commitProfile(event))!==true)throw Error('Profil abgelehnt');return {effect:plannerEffect(a.expect.date)}})},effective:plannerEffective
  },
  'measurements.save':{
    check(a){if(!fields(a,['id','date','values','expect'])||!id(a.id)||!toolDateValid(a.date)||a.date>today()||!fields(a.values,Object.keys(measurementFields))||!Object.keys(a.values).length||
      !Object.entries(a.values).every(([k,v])=>finite(v,measurementFields[k][2],measurementFields[k][3]))||!(a.expect===null||plain(a.expect))||!small(a))return fail('invalid','Datum, stabile ID, Messwerte und expect erforderlich');
      const rows=(state.measurements||[]).filter(x=>x.date===a.date),old=rows[0],target={...(a.expect||{id:a.id,date:a.date}),...a.values};
      if(rows.length>1)return fail('conflict','Mehrere Messungen am selben Tag');if(old&&same(old,target))return {noop:true,target};
      if(!same(old??null,a.expect)||old&&old.id!==a.id||(state.measurements||[]).some(x=>x.id===a.id&&x.date!==a.date))return fail('conflict','Messung geändert');return busy({target})},
    run(a,p){perform(()=>{const vals={'measure-date':value(a.date),...Object.fromEntries(Object.keys(measurementFields).map(k=>['measure-'+k,value(a.values[k]??'')]))};
      inputs(vals,()=>saveMeasurements(event));const row=state.measurements.find(x=>x.date===a.date);if(!row)throw Error('Messung fehlt');row.id=p.target.id})},
    effective:(s,a,p)=>same(s.measurements?.find(x=>x.id===a.id),p.target)
  },
  'measurements.delete':{
    check(a){if(!fields(a,['id','expect'])||typeof a.id!=='string'||!a.id||!plain(a.expect)||a.expect.id!==a.id||!small(a))return fail('invalid','ID und vollständiges expect erforderlich');
      const old=state.measurements?.find(x=>x.id===a.id);if(!old)return {noop:true};if(!same(old,a.expect))return fail('conflict','Messung geändert');return busy({})},
    run(a){perform(()=>inputs({'undo-measurement':{}},()=>removeMeasurement(a.id)))},effective:(s,a)=>!s.measurements?.some(x=>x.id===a.id)
  },
  'appearance.set':{
    check(a){if(!fields(a,['scheme','language','expect'])||!fields(a.expect,['scheme','language'])||!['scheme','language'].every(k=>Object.hasOwn(a.expect,k))||
      !['scheme','language'].some(k=>Object.hasOwn(a,k))||a.scheme!==undefined&&!['system','dark','light'].includes(a.scheme)||a.language!==undefined&&!['de','en'].includes(a.language))return fail('invalid','Schema/Sprache und expect erforderlich');
      const target={...a.expect,...pick(a,['scheme','language'])};if(same(appearance(),target))return localStorage.getItem('puls-color-scheme')===target.scheme?{noop:true,target,result:target}:busy({target});if(!same(appearance(),a.expect))return fail('conflict','Darstellung geändert');return busy({target})},
    run(a,p){perform(()=>{setColorScheme(p.target.scheme);if(a.language!==undefined)setAppLanguage(a.language)});return p.target},
    effective:(s,a,p)=>same(appearance(),p.target)&&(s.language==='en'?'en':'de')===p.target.language&&localStorage.getItem('puls-color-scheme')===p.target.scheme
  },
  'sound.set':{
    check(a){if(!fields(a,['enabled','volume','expect'])||typeof a.enabled!=='boolean'||!finite(a.volume,0,70)||!fields(a.expect,['enabled','volume'])||typeof a.expect.enabled!=='boolean'||!finite(a.expect.volume,0,70))return fail('invalid','Klänge, Lautstärke 0–70 und expect erforderlich');
      const target={enabled:a.enabled,volume:a.volume};if(same(sound(),target))return {noop:true};if(!same(sound(),a.expect))return fail('conflict','Klänge geändert');return busy({})},
    run(a){perform(()=>{if(sound().enabled!==a.enabled)togglePulsSounds();state.soundVolume=a.volume})},effective:(s,a)=>(s.soundEnabled!==false)===a.enabled&&(s.soundVolume??35)===a.volume
  }
};
const nutrition=window.pulsNativeNutrition;
if(nutrition){
  const goalOp=nutrition.ops['goals.set'];
  for(const name of ['plan.set','adaptive.set'])ops[name]={
    check(a){if(name==='adaptive.set'&&(!fields(a,['adaptive','learnTdee','expect'])||typeof a.adaptive!=='boolean'||typeof a.learnTdee!=='boolean'||!validContext(a.expect)))return fail('invalid','Automatik und Plan-Kontext erforderlich');
      const args=name==='adaptive.set'?{plan:{adaptive:a.adaptive,learnTdee:a.learnTdee},goals:pick(a.expect.goals,macros),expect:a.expect}:a;
      const plan=goalOp.check(args);return {...plan,args}},
    run(a,p){delegated=true;return goalOp.run(p.args,p)},effective:(s,a,p,r)=>goalOp.effective(s,p.args,p,r)
  };
}
function build(){
  const p=state.profile,weight=currentWeight(),valid=!!p&&!profileError(p),effective=valid?{...p,weight}:null,g=dayGoals(date),energy=valid?energyFor(effective,weight,state.plan,date):null;
  const measurements=(state.measurements||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)),weights=state.weights.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const bf=currentBodyFat(),observation=tdeeObservation(),avatar=state.avatarImage,avatarAllowed=typeof avatar==='string'&&avatar.length<=24*1024&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar);
  const latest=weights.find(x=>x.date<=today()),week=latest?weights.filter(x=>x.date<=today()&&weekStart(x.date)===weekStart(latest.date)):[];
  const metrics=bodyMetrics(weight),backup=key=>{if(firstRunPreview)return false;try{return localStorage.getItem(key)!==null}catch{return false}};
  const result={language:state.language==='en'?'en':'de',locale:state.language==='en'?'en-GB':'de-DE',today:today(),date,
    identity:{displayName:text(state.displayName?.trim()),avatarImage:avatarAllowed?avatar:null,avatarOmitted:!!avatar&&!avatarAllowed,streak:dailyWorkoutStreak(),...xpProgress(totalWorkoutXP())},
    profile:p?pick(p,[...profileKeys,'weight','sex','special','updated']):null,plan:pick(state.plan,planKeys),goals:pick(g,macros),
    energy:energy?{rmr:Math.round(energy.rmr),tdee:Math.round(energy.tdee),baseline:Number.isFinite(energy.baseline)?Math.round(energy.baseline):null,sport:energy.sport??null,calibrated:!!energy.calibrated}:null,
    forecast:effective?{html:forecastMarkup(effective,g.kcal,state.plan,date).replace(/>([^<>]+)</g,(_,s)=>'>'+label(s)+'<')}:null,
    body:{weight,metrics:metrics?{bmi:rounded(metrics.bmi),bf:rounded(metrics.bf),label:label(metrics.label)}:null,bodyFat:bf?{...bf,value:rounded(bf.value)}:null,
      summary:{date:latest?.date??null,source:latest?'entry':'profile',weekStart:latest?weekStart(latest.date):null,weekCount:week.length,weekMean:week.length?shown(round(week.reduce((sum,x)=>sum+x.kg,0)/week.length)):null},
      measurements:measurements.slice(0,20).map(x=>pick(x,['id','date',...Object.keys(measurementFields)])),
      history:weights.slice(0,100).map(w=>{const historical=(state.profileHistory||[]).filter(p=>p.date<=w.date).sort((a,b)=>b.date.localeCompare(a.date))[0]||p,m=bodyMetrics(w.kg,historical);
        return {id:w.id,date:w.date,kg:shown(w.kg),bmi:rounded(m?.bmi),bodyFat:rounded(m?.bf),estimated:true,method:'bmi-age'}}),
      fields:Object.entries(measurementFields).map(([key,[name,unit,min,max]])=>({key,label:label(name),unit,min,max})),navyNote:label(navyMeasurementNote)},
    adaptive:{enabled:!!state.plan.learnTdee,adaptive:state.plan.adaptive!==false,disabled:p?.kcalMode==='baseline',
      observation:{...pick(observation,['eligible','start','end','coverage','weightCount','mean','slope','estimate','base','low','high']),reason:label(observation.reason)},calibration:state.tdeeCalibration?pick(state.tdeeCalibration,['date','value','base','activity','windowStart','windowEnd']):null},
    appearance:{...appearance(),resolvedScheme:typeof dsCurrentScheme==='function'?dsCurrentScheme():resolveColorScheme(getColorScheme(),!!pulsSchemeMedia?.matches),appIcon:currentAppIcon(),nativeIcon:'dark'},
    sound:{...sound(),haptics:'web'},
    cloud:{signedIn:!!cloudSession,configured:!!cloudConfigured,dirty:!!cloudDirty,conflict:!!cloudConflict,revision:cloudRevision,busy:!!cloudBusy,
      uploadBlocked:!!cloudUploadBlocked||!!stateUploadBlockPending},
    recovery:{pending:!!stateRecoveryPending,corrupt:stateCorruptRaw!==null,uploadBlocked:!!cloudUploadBlocked||!!stateUploadBlockPending,
      localConflictBackup:backup('puls-cloud-conflict-backup'),remoteConflictBackup:backup('puls-cloud-conflict-remote-backup')},
    sections:accountSections.map(x=>({key:x.key,title:label(x.title),note:label(x.note)})),
    navigation:Object.fromEntries(actions.map(action=>[action,{action,web:true}])),omitted:{measurements:Math.max(0,measurements.length-20),history:Math.max(0,weights.length-100)}};
  while(JSON.stringify(result).length>48*1024){if(result.body.history.length){result.body.history.pop();result.omitted.history++}else if(result.body.measurements.length){result.body.measurements.pop();result.omitted.measurements++}else{result.identity.avatarImage=null;result.identity.avatarOmitted=!!avatar;break}}
  return result;
}
const actions=['accountSignIn','accountSignOut','accountConflict','accountImport','accountReset','accountDelete','accountExport','accountCSV','accountRecovery','accountPlan','accountAvatar'];
function navigate(t){if(t.web!==true||!fields(t,['action','web']))return false;
  if(!actions.includes(t.action)||t.action==='accountSignIn'&&(!cloudConfigured||cloudSession||firstRunPreview))return false;
  go('account');openAccountSection(t.action==='accountPlan'?'plan':'manage');
  switch(t.action){
    case 'accountSignIn':if(!cloudConfigured||cloudSession||firstRunPreview)return false;cloudAuthForm('signin');break;
    // Sign-out/conflict/import are deliberately only landings: the existing Web button/choice/file picker decides.
    case 'accountSignOut':case 'accountConflict':case 'accountImport':case 'accountRecovery':break;
    case 'accountReset':accountActionForm('reset');break;
    case 'accountDelete':accountActionForm('delete');break;
    case 'accountExport':exportData();break;
    case 'accountCSV':csvExportForm();break;
    case 'accountPlan':settings();break;
    case 'accountAvatar':nameProfile();break;
    default:return false;
  }return true;
}
window.pulsNativeAccount={ops,build:()=>read(build),actions,queries:['planner'],navigate,device:()=>({scheme:getColorScheme()}),
  query(r){if(!fields(r,['requestId','kind'])||r.kind!=='planner')return null;return {kind:'planner',ok:true,result:{expect:context(),planOps:!!nutrition}}},
  captureUi(){pendingProfile=null;delegated=false;goalExtras=copy(Object.fromEntries(Object.entries(state.goals).filter(([k])=>!macros.includes(k))));
    historyExtras={date:today(),goalRecord:copy(state.goalHistory?.find(x=>x.date===today())??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===today())??null)};
    return {scheme:getColorScheme(),schemeRaw:localStorage.getItem('puls-color-scheme'),nutrition:nutrition?.captureUi()}},
  restoreUi(ui){perform(()=>{setColorScheme(ui.scheme);try{if(ui.schemeRaw===null)localStorage.removeItem('puls-color-scheme');else localStorage.setItem('puls-color-scheme',ui.schemeRaw)}catch{}});if(ui.nutrition)nutrition.restoreUi(ui.nutrition)},
  afterRender(r){if(goalExtras)Object.assign(state.goals,goalExtras);
    if(historyExtras)for(const [array,key] of [['goalHistory','goalRecord'],['profileHistory','profileRecord']]){const row=state[array]?.find(x=>x.date===historyExtras.date),old=historyExtras[key];if(row&&old)Object.assign(row,{...old,...row})}
    if(delegated){nutrition.afterRender(r);return}if(!pendingProfile)return;
    Object.assign(state.goals,Object.fromEntries(Object.entries(pendingProfile.goals).filter(([k])=>!macros.includes(k))));
    for(const [array,key] of [['goalHistory','goalRecord'],['profileHistory','profileRecord']]){const row=state[array]?.find(x=>x.date===pendingProfile.date),old=pendingProfile[key];if(row&&old)Object.assign(row,{...old,...row})}
    if(r)r.effect=plannerEffect(pendingProfile.date)},
  settled(ok){nutrition?.settled(ok);pendingProfile=null;delegated=false;goalExtras=null;historyExtras=null;const pending=after;after=[];if(ok)for(const fn of pending)try{fn()}catch{}}
};
})();
