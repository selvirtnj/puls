/* Optional shell services. The existing profile remains authoritative; no Auth/Sync writes here. */
(function(){
'use strict';
const bridge=window.webkit?.messageHandlers?.pulsNative,features=window.pulsNativeFeatures||[];
if(!bridge||!features.some(f=>['barcodeScanner','healthWrite','healthRead','localReminders'].includes(f)))return;
const has=f=>features.includes(f),pending=new Map();
const session=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let serial=0,scan=null,contextOwner=null,healthActive=false,syncTimer=null,syncing=false,syncAgain=false,statusText='',healthRevision=0,reminderRevision=0,deviceReminders={};
let lastHealthSync=null;
const owner=()=>typeof cloudSession!=='undefined'&&cloudSession?.user?.id?'account:'+cloudSession.user.id:'local';
const preview=()=>typeof firstRunPreview!=='undefined'&&firstRunPreview;
const en=()=>state.language==='en',txt=(de,english)=>en()?english:de;
function request(type,body={},timeout=30000){
  return new Promise((resolve,reject)=>{const requestId=session+'-extras-'+(++serial),timer=setTimeout(()=>{pending.delete(requestId);reject(Error('timeout'))},timeout);
    pending.set(requestId,{resolve,reject,timer});
    try{bridge.postMessage({type,requestId,...body})}catch{clearTimeout(timer);pending.delete(requestId);reject(Error('unavailable'))}
  });
}
window.pulsNativeExtrasReceive=function(message){
  const p=pending.get(message?.requestId);if(!p)return;
  clearTimeout(p.timer);pending.delete(message.requestId);
  if(message.ok===false)p.reject(Error(message.status||'unavailable'));else p.resolve(message);
};
// Gemeinsame Anbindung für js/health-read.js (Lesen aus Apple Health); nur in der Hülle vorhanden.
globalThis.pulsNativeExtras={request,owner,has,preview,safe:()=>safeToExport(),showStatus:text=>showStatus(text)};
// Reuse the final web lookup path, including checksum, cached products and OFF review.
if(has('barcodeScanner')&&typeof startBarcodeCamera==='function'){
  const webStart=startBarcodeCamera,webStop=stopBarcode;
  stopBarcode=function(...args){if(scan){bridge.postMessage({type:'barcodeCancel',scanId:scan});scan=null}return webStop.apply(this,args)};
  startBarcodeCamera=async function(...args){
    stopBarcode();const token=session+'-scan-'+(++serial);scan=token;
    try{
      const result=await request('barcodeScan',{scanId:token},120000);
      if(scan!==token||!$('barcode-input')||!modal.open)return;
      scan=null;
      if(result.status==='unavailable')return webStart.apply(this,args);
      if(result.status==='cancelled')return;
      if(result.status==='denied'){$('barcode-status').textContent=txt('Kamerazugriff in den iOS-Einstellungen erlauben oder Barcode eintippen.','Allow camera access in iOS Settings or enter the barcode.');return}
      const code=normalizeBarcode(result.code||'');
      if(validBarcode(code))return lookupBarcode(null,code);
    }catch{
      if(scan===token&&$('barcode-input')&&modal.open){scan=null;bridge.postMessage({type:'barcodeCancel',scanId:token});return webStart.apply(this,args)}
    }
  };
}
function preferences(){return state.nativeExtras||{}}
const defaultReminder=key=>({enabled:false,time:key==='training'?'18:00':'08:00',days:key==='training'?[2,4,6]:[2]});
function reminder(key){return deviceReminders[key]||defaultReminder(key)}
function safeToExport(){return !preview()&&!(typeof cloudBusy!=='undefined'&&cloudBusy)&&!(typeof cloudApplying!=='undefined'&&cloudApplying)&&!(typeof cloudConflict!=='undefined'&&cloudConflict)&&!(typeof cloudUploadBlocked!=='undefined'&&cloudUploadBlocked)}
function samples(){
  const result=[],now=Date.now(),finite=x=>typeof x==='number'&&Number.isFinite(x);
  for(const w of state.weights||[]){
    // A weight has day resolution only. Health gets the start of that local calendar day.
    if(w.source==='health'||!/^\d{4}-\d{2}-\d{2}$/.test(w.date)||!finite(w.kg)||w.kg<20||w.kg>400)continue;
    const day=new Date(w.date+'T00:00:00'),start=day.getTime();if(!finite(start)||start>now||day.getFullYear()!==Number(w.date.slice(0,4))||day.getMonth()+1!==Number(w.date.slice(5,7))||day.getDate()!==Number(w.date.slice(8,10)))continue;
    result.push({key:'weight:'+w.date,kind:'weight',start,end:start,kg:w.kg,dateOnly:true});
  }
  for(const w of state.workouts||[]){
    if(!w.finished||w.autoFinished||w.timeApprox||!w.id||!finite(w.startedAt)||!finite(w.finishedAt)||!finite(w.durationSeconds)||w.durationSeconds<=0||w.finishedAt>w.startedAt+18000001||w.finishedAt<=w.startedAt||w.finishedAt>now||!w.exercises?.some(e=>e.sets?.some(s=>s.done)))continue;
    result.push({key:'workout:'+w.id,kind:'strength',start:w.startedAt,end:w.finishedAt,duration:w.durationSeconds});
  }
  for(const r of state.runs||[]){
    if(r.source==='health'||!r.id||!finite(r.startedAt)||!finite(r.durationSeconds)||r.durationSeconds<=0)continue;
    if(!finite(r.pauseSeconds)||r.pauseSeconds<0)continue;
    const pause=r.pauseSeconds,end=r.startedAt+(r.durationSeconds+pause)*1000;
    if(end>now||end<=r.startedAt||r.durationSeconds+pause>345600)continue;
    result.push({key:'run:'+r.id,kind:r.type||'run',start:r.startedAt,end,duration:r.durationSeconds,...(finite(r.distanceKm)&&r.distanceKm>0?{distance:r.distanceKm*1000}:{})});
  }
  return result;
}
async function sync(){
  if(preview())return;
  if(syncing){syncAgain=true;return}syncing=true;
  const current=owner();
  try{
    if(contextOwner!==current){
      healthActive=false;deviceReminders={};
      const status=await request('extrasContext',{owner:current});if(owner()!==current)return;
      contextOwner=current;healthActive=!!status.healthEnabled;deviceReminders=status.reminders||{};
    }
    if(!has('healthWrite')||!healthActive||!preferences().healthEnabled||!safeToExport())return;
    // Include every exported value so historical edits are detected even when counts/IDs stay equal.
    const rows=samples(),fingerprint=JSON.stringify(rows),revision=healthRevision;
    if(lastHealthSync?.owner===current&&lastHealthSync.fingerprint===fingerprint)return;
    let successful=true;
    for(let i=0;i<rows.length;i+=50){
      if(owner()!==current||!preferences().healthEnabled||!safeToExport())return;
      const result=await request('healthSync',{owner:current,samples:rows.slice(i,i+50)});
      if(result.status!=='saved')successful=false;
      if(result.status==='denied')statusText=txt('Health-Schreibrechte in der Health-App prüfen.','Check write permissions in the Health app.');
    }
    // Failed/partial exports and stale authorizations must remain retryable.
    if(successful&&owner()===current&&healthRevision===revision&&healthActive&&preferences().healthEnabled&&safeToExport())lastHealthSync={owner:current,fingerprint};
  }catch{statusText=txt('Native Verbindung nicht verfügbar. Erneut versuchen.','Native connection unavailable. Try again.')}
  finally{syncing=false;if(syncAgain){syncAgain=false;schedule()}}
}
function schedule(){clearTimeout(syncTimer);syncTimer=setTimeout(sync,350)}
window.pulsNativeExtrasOpen=function(){
  if(preview()){openModal(txt('iPhone-Funktionen','iPhone features'),`<p class="note">${txt('Vorschau: Health und Erinnerungen werden hier nicht verändert.','Preview: Health and reminders are not changed here.')}</p>`);return}
  const health=has('healthWrite')?`<section class="dsgroup nativeextras-card"><label class="dsrow"><span class="dsrowtext"><span>Apple Health</span><small id="native-health-status">${healthActive&&preferences().healthEnabled?txt('Aktiv · Export','On · Export'):txt('Aus','Off')}</small></span><input class="qaswitch" id="native-health-enabled" type="checkbox" role="switch" aria-label="Apple Health" ${healthActive&&preferences().healthEnabled?'checked':''} onchange="pulsNativeHealthToggle(this.checked)"></label></section>`:`<section class="dsgroup nativeextras-card"><div class="dsrow"><span class="dsrowtext"><span>Apple Health</span><small>${txt('Nicht verfügbar','Unavailable')}</small></span></div></section>`;
  const readRow=has('healthRead')&&typeof window.pulsNativeHealthReadRow==='function'?window.pulsNativeHealthReadRow():'';
  const weekdays=en()?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['So','Mo','Di','Mi','Do','Fr','Sa'];
  const reminders=has('localReminders')?`<form onsubmit="pulsNativeRemindersSave(event)">${['training','weight'].map(key=>{const r=reminder(key),label=key==='training'?txt('Trainings-Erinnerung','Training reminder'):txt('Wiege-Erinnerung','Weight reminder');return `<fieldset class="dsgroup nativeextras-card"><legend>${label}</legend><label class="dsrow"><span class="dsrowtext">${txt('Aktiv','Enabled')}</span><input class="qaswitch" id="native-${key}-enabled" type="checkbox" role="switch" ${r.enabled?'checked':''}></label><label class="dsrow nativeextras-time"><span>${txt('Uhrzeit','Time')}</span><input id="native-${key}-time" type="time" value="${r.time}" required></label><div class="nativeextras-days" role="group" aria-label="${txt('Wochentage','Weekdays')}">${[2,3,4,5,6,7,1].map(day=>`<label><input type="checkbox" name="native-${key}-day" value="${day}" aria-label="${weekdays[day-1]}" ${r.days.includes(day)?'checked':''}><span aria-hidden="true">${weekdays[day-1].slice(0,1)}</span></label>`).join('')}</div></fieldset>`}).join('')}<button class="btn full">${txt('Speichern','Save')}</button></form>`:'';
  openModal(txt('iPhone-Funktionen','iPhone features'),`<div class="nativeextras">${health}${readRow}${reminders}<p id="native-extras-status" class="note" role="status">${statusText}</p></div>`);
};
function paintHealth(){const node=$('native-health-enabled'),active=healthActive&&!!preferences().healthEnabled;if(node)node.checked=active;const status=$('native-health-status');if(status)status.textContent=active?txt('Aktiv · Export','On · Export'):txt('Aus','Off')}
function showStatus(text){statusText=text;const node=$('native-extras-status');if(node)node.textContent=text}
window.pulsNativeHealthToggle=async function(enabled){
  if(preview())return;
  const current=owner(),revision=++healthRevision;
  if(!enabled){healthActive=false;state.nativeExtras={...preferences(),healthEnabled:false};save()}
  try{
    await request('extrasContext',{owner:current});
    if(revision!==healthRevision||owner()!==current)return;
    const r=await request('healthEnable',{owner:current,enabled},120000);if(owner()!==current||revision!==healthRevision)return;
    contextOwner=current;healthActive=!!r.healthEnabled;
    if(enabled&&healthActive)lastHealthSync=null;
    state.nativeExtras={...preferences(),healthEnabled:healthActive};save();
    showStatus(enabled&&!healthActive?txt('Keine Schreibfreigabe. Berechtigungen in Health prüfen.','No write access. Check permissions in Health.'):txt('Gespeichert.','Saved.'));
    paintHealth();schedule();
  }catch{if(owner()===current&&revision===healthRevision){showStatus(txt('Health konnte nicht geändert werden. Erneut versuchen.','Could not change Health. Try again.'));paintHealth()}}
};
window.pulsNativeRemindersSave=async function(event){
  event.preventDefault();if(preview())return;const reminders={};
  for(const key of ['training','weight'])reminders[key]={enabled:$('native-'+key+'-enabled').checked,time:$('native-'+key+'-time').value,days:[...document.querySelectorAll(`input[name="native-${key}-day"]:checked`)].map(x=>Number(x.value))};
  if(!validData({...state,nativeExtras:{...preferences(),reminders}})){showStatus(txt('Bitte Uhrzeit und mindestens einen Wochentag je aktiver Erinnerung wählen.','Choose a time and at least one weekday for each enabled reminder.'));return}
  const current=owner(),revision=++reminderRevision;try{
    await request('extrasContext',{owner:current});
    if(owner()!==current||revision!==reminderRevision)return;
    await request('remindersSet',{owner:current,reminders},120000);if(owner()!==current||revision!==reminderRevision)return;
    deviceReminders=reminders;state.nativeExtras={...preferences(),reminders};save();showStatus(txt('Erinnerungen auf diesem Gerät gespeichert.','Reminders saved on this device.'));
  }catch{if(owner()===current&&revision===reminderRevision){contextOwner=null;schedule();showStatus(txt('Nicht gespeichert. Mitteilungserlaubnis in iOS prüfen und erneut versuchen.','Not saved. Check notification permission in iOS and try again.'))}}
};
if(typeof accountAppearanceCard==='function'){
  const base=accountAppearanceCard;accountAppearanceCard=function(...args){return base.apply(this,args)+`<section class="dsgroup">${accountListRow({label:txt('iPhone-Funktionen','iPhone features'),detail:txt('Apple Health & Erinnerungen','Apple Health & reminders'),action:'pulsNativeExtrasOpen()',chevron:true})}</section>`};
}
for(const name of ['save','render']){
  if(name==='save'){const base=save;save=function(...args){try{return base.apply(this,args)}finally{schedule()}}}
  if(name==='render')globalThis.renderFinallyNativeExtras=schedule;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
window.addEventListener('pageshow',schedule);schedule();
})();
