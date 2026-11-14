/* Apple Health lesen (nur iOS-Hülle, Kennzeichen healthRead; Gegenstück ios/PULS/HealthReader.swift).
   Tageswerte (Schritte, Schlaf, Ruhepuls, HRV …) liegen nur im localStorage dieses Geräts (puls-health-days), nie in state, Sync oder Export,
   und werden beim Ausschalten, Abmelden und Kontowechsel gelöscht. Fremde Workouts und Gewichte werden als normale Einträge übernommen
   (runs[].source:'health', healthId; weights[].source:'health'). Ohne Hülle bleibt dieser Code ohne Wirkung; die reinen Funktionen sind für Tests exportiert. */
(function(){
'use strict';
const DAYS_KEY='puls-health-days',SEEN_KEY='puls-health-seen',GAP=600000,WINDOW=35;
const finite=v=>typeof v==='number'&&Number.isFinite(v),inRange=(v,a,b)=>finite(v)&&v>=a&&v<=b,dayRe=/^\d{4}-\d{2}-\d{2}$/;
const X=()=>globalThis.pulsNativeExtras,txt=(de,en)=>state.language==='en'?en:de,prefs=()=>state.nativeExtras||{};
const shift=(key,days)=>{const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+days);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

// Erholung 0–100: je Teil z = Abweichung vom eigenen Mittel der 28 Vortage in Standardabweichungen (HRV und Schlaf höher = besser, Ruhepuls niedriger = besser);
// Teilwert = 60 + 20·z, auf 0–100 begrenzt, gewichtet HRV 50 %, Ruhepuls 30 %, Schlaf 20 %. Fehlt ein Teil (heute kein Wert oder unter 7 Basistage), fällt er weg und der Rest wird neu gewichtet.
// Ohne HRV und ohne Ruhepuls gibt es keinen Wert (null). Die Streuung hat eine Untergrenze (HRV 5 % des Mittels, Ruhepuls 1 bpm, Schlaf 20 min), damit gleichförmige Tage nicht explodieren.
const PARTS=[['hrv',.5,1,m=>Math.max(1,m*.05)],['restingHr',.3,-1,()=>1],['sleepMinutes',.2,1,()=>20]];
function recoveryScore(days,todayKey){
  const list=Array.isArray(days)?days:[],now=list.find(d=>d?.date===todayKey);if(!now)return null;
  const from=shift(todayKey,-28);let sum=0,weight=0,core=0;
  for(const [key,w,sign,floor] of PARTS){
    if(!finite(now[key]))continue;
    const base=list.filter(d=>d?.date<todayKey&&d.date>=from&&finite(d[key])).map(d=>d[key]);
    if(base.length<7)continue;
    const mean=base.reduce((a,v)=>a+v,0)/base.length,sd=Math.sqrt(base.reduce((a,v)=>a+(v-mean)**2,0)/base.length);
    sum+=w*Math.min(100,Math.max(0,60+20*sign*(now[key]-mean)/Math.max(sd,floor(mean))));weight+=w;if(key!=='sleepMinutes')core++;
  }
  return core?Math.round(sum/weight):null;
}

const LIMITS={steps:[1,200000],activeKcal:[1,20000],restingHr:[20,250],hrv:[1,500],sleepMinutes:[1,1440],sleepDeep:[1,1440],sleepRem:[1,1440],sleepCore:[1,1440],vo2max:[10,100]};
function cleanDays(list){
  const out=[],seen=new Set();
  for(const d of Array.isArray(list)?list:[]){
    if(!d||typeof d.date!=='string'||!dayRe.test(d.date)||seen.has(d.date))continue;
    const row={date:d.date};for(const [key,[a,b]] of Object.entries(LIMITS))if(inRange(d[key],a,b))row[key]=Math.round(d[key]*10)/10;
    if(Object.keys(row).length>1){out.push(row);seen.add(d.date)}
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)).slice(-40);
}

const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const write=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}};
// Gespeicherte Daten gehören genau einem Besitzer; bei Wechsel oder Abmeldung werden sie hier gelöscht.
function cachedDays(owner){const c=read(DAYS_KEY);if(!c)return [];if(c.owner!==owner||!Array.isArray(c.days)){write(DAYS_KEY,null);return []}return c.days}
function seenIds(owner){const c=read(SEEN_KEY);if(!c)return {};if(c.owner!==owner||!c.ids||typeof c.ids!=='object'){write(SEEN_KEY,null);return {}}return c.ids}

// Übernahme. Läufe: wie commitRunActivity ein normaler Eintrag in state.runs, aber ohne laufende Aufzeichnung; ohne pauseSeconds, damit der Health-Export ihn nicht zurückschreibt.
const heartOk=v=>inRange(v,20,250);
function routeString(points){
  if(!Array.isArray(points))return '';
  const list=points.filter(p=>Array.isArray(p)&&inRange(p[0],-90,90)&&inRange(p[1],-180,180)).slice(0,300);
  return list.length>=2?list.map(p=>p[0].toFixed(5)+','+p[1].toFixed(5)).join(';'):'';
}
function attachStrength(w,start,duration){
  const end=start+duration*1000;let best=null,most=59999;
  for(const k of state.workouts||[]){
    if(!k.finished||k.autoFinished||k.timeApprox||!finite(k.startedAt)||!finite(k.finishedAt))continue;
    const overlap=Math.min(end,k.finishedAt)-Math.max(start,k.startedAt);if(overlap>most){best=k;most=overlap}
  }
  if(!best)return false;let changed=false;
  if(best.avgHr===undefined&&heartOk(w.avgHr)){best.avgHr=Math.round(w.avgHr);changed=true}
  if(best.maxHr===undefined&&heartOk(w.maxHr)&&w.maxHr>=(best.avgHr??0)){best.maxHr=Math.round(w.maxHr);changed=true}
  if(best.kcal===undefined&&Number.isInteger(w.kcal)&&w.kcal>0&&w.kcal<=20000){best.kcal=w.kcal;changed=true}
  return changed;
}
function importWorkouts(list,owner){
  if(!Array.isArray(list))return false;
  const ids=seenIds(owner),runs=()=>Array.isArray(state.runs)?state.runs:[];let changed=false,added=false;
  for(const w of list){
    const id=typeof w?.id==='string'&&/^[0-9A-Fa-f-]{36}$/.test(w.id)?w.id:null,start=Date.parse(w?.startedAt),duration=Math.round(w?.durationSeconds);
    if(!id||ids[id]||!finite(start)||start>Date.now()||!inRange(duration,1,172800))continue;
    if(w.kind==='strength'){if(attachStrength(w,start,duration))changed=true;continue}
    if(runs().some(r=>r.healthId===id||finite(r.startedAt)&&Math.abs(r.startedAt-start)<=300000))continue;
    const r={id:uid(),createdAt:Date.now(),startedAt:start,date:localISO(new Date(start)),type:runActivityType(w.kind).id,source:'health',healthId:id,
      distanceKm:inRange(w.distanceKm,.01,1000)?Math.round(w.distanceKm*100)/100:0,durationSeconds:duration};
    if(Number.isInteger(w.kcal)&&w.kcal>0&&w.kcal<=20000)r.kcal=w.kcal;
    if(heartOk(w.avgHr)){r.avgHr=Math.round(w.avgHr);if(heartOk(w.maxHr)&&w.maxHr>=r.avgHr)r.maxHr=Math.round(w.maxHr)}else if(heartOk(w.maxHr))r.maxHr=Math.round(w.maxHr);
    const route=routeString(w.route);if(route)r.route=route;
    if(!validData({...state,runs:[...runs(),r]}))continue;
    runList().push(r);ids[id]=start;changed=added=true;
  }
  if(added){const keep=Date.now()-60*86400000;for(const id of Object.keys(ids))if(ids[id]<keep)delete ids[id];write(SEEN_KEY,{owner,ids})}
  return changed;
}
// Gewicht: nur für Tage ohne PULS-Eintrag; vorhandene Messungen bleiben unverändert.
function importWeights(list){
  if(!Array.isArray(list))return false;
  const have=new Set((state.weights||[]).map(x=>x.date));let changed=false;
  for(const w of list){
    if(!w||typeof w.date!=='string'||!dayRe.test(w.date)||w.date>today()||!inRange(w.kg,20,400)||have.has(w.date))continue;
    state.weights.push({id:uid(),date:w.date,kg:Math.round(w.kg*10)/10,source:'health'});have.add(w.date);changed=true;
  }
  return changed;
}

let reading=false,lastRead=0,ctxOwner=null,ctxActive=false,toggleRevision=0,pending=null,tries=0;
const active=()=>{const x=X();return !!x&&ctxOwner===x.owner()&&ctxActive&&!!prefs().healthReadEnabled};
function flush(){
  const x=X();if(!pending||!x)return;
  if(x.owner()!==pending.owner||!prefs().healthReadEnabled){pending=null;return}
  if(!x.safe()){if(++tries<=12)setTimeout(flush,5000);else pending=null;return}
  const r=pending;pending=null;tries=0;
  const workouts=importWorkouts(r.workouts,r.owner),weights=importWeights(r.weights);
  if(workouts||weights){save();render()}
}
async function ensureContext(x,current){
  if(ctxOwner===current)return;
  const r=await x.request('extrasContext',{owner:current});
  if(x.owner()!==current)throw Error('owner');
  ctxOwner=current;ctxActive=!!r.healthReadEnabled;
}
// Liest die letzten 35 Tage. true = Daten erhalten, false = Antwort ohne Daten, undefined = nicht gelesen.
async function readHealth(force=false){
  const x=X();if(!x||!x.has('healthRead')||x.preview()||reading)return;
  const current=x.owner();cachedDays(current);seenIds(current);
  if(!prefs().healthReadEnabled){write(DAYS_KEY,null);return}
  if(!force&&Date.now()-lastRead<GAP)return;
  reading=true;
  try{
    await ensureContext(x,current);
    if(!ctxActive){write(DAYS_KEY,null);return}
    const r=await x.request('healthRead',{owner:current,days:WINDOW},90000);
    if(x.owner()!==current||!prefs().healthReadEnabled)return;
    lastRead=Date.now();
    const days=cleanDays(r.days);write(DAYS_KEY,{owner:current,fetchedAt:lastRead,days});
    pending={owner:current,workouts:r.workouts,weights:r.weights};tries=0;flush();render();
    return days.length>0||(r.workouts?.length||0)>0||(r.weights?.length||0)>0;
  }catch{}finally{reading=false}
}

// Übersicht: kompakte Gruppe nur mit gelesenen Werten für heute und letzte Nacht (Bereichsfarbe Körper).
globalThis.healthReadCard=function(){
  const x=X();if(!x||!x.has('healthRead')||x.preview()||typeof dsRow!=='function')return '';
  if(!prefs().healthReadEnabled){if(read(DAYS_KEY))write(DAYS_KEY,null);return ''}
  const days=cachedDays(x.owner()),now=days.find(d=>d.date===today());if(!now)return '';
  const score=recoveryScore(days,today()),rows=[],row=(label,icon,value)=>rows.push(dsRow({label,icon,value}));
  if(score!==null)row(txt('Erholung','Recovery'),'lightning',String(score));
  if(finite(now.sleepMinutes)){const m=Math.round(now.sleepMinutes);row(txt('Schlaf','Sleep'),'moon',Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min')}
  if(finite(now.restingHr))row(txt('Ruhepuls','Resting heart rate'),'heartbeat',Math.round(now.restingHr)+' bpm');
  if(finite(now.hrv))row('HRV','chart-line-up',Math.round(now.hrv)+' ms');
  if(finite(now.steps))row(txt('Schritte','Steps'),'sneaker-move',n(Math.round(now.steps)));
  return rows.length?dsGroup(txt('Gesundheit','Health'),rows.join(''),'','dscat dscatbody'):'';
};

function paintRow(){const node=$('native-healthread-enabled'),on=active();if(node)node.checked=on;const status=$('native-healthread-status');if(status)status.textContent=on?txt('Aktiv · Import','On · Import'):txt('Aus','Off')}
window.pulsNativeHealthReadRow=function(){
  const x=X(),on=active();if(!x||!x.has('healthRead'))return '';
  if(ctxOwner!==x.owner())ensureContext(x,x.owner()).then(paintRow,()=>{});
  return `<section class="dsgroup nativeextras-card"><label class="dsrow"><span class="dsrowtext"><span>${txt('Aus Apple Health lesen','Read from Apple Health')}</span><small id="native-healthread-status">${on?txt('Aktiv · Import','On · Import'):txt('Aus','Off')}</small></span><input class="qaswitch" id="native-healthread-enabled" type="checkbox" role="switch" aria-label="${txt('Aus Apple Health lesen','Read from Apple Health')}" ${on?'checked':''} onchange="pulsNativeHealthReadToggle(this.checked)"></label></section>`;
};
window.pulsNativeHealthReadToggle=async function(enabled){
  const x=X();if(!x||x.preview())return;
  const current=x.owner(),revision=++toggleRevision;
  if(!enabled){ctxActive=false;state.nativeExtras={...prefs(),healthReadEnabled:false};save();write(DAYS_KEY,null);render()}
  try{
    await x.request('extrasContext',{owner:current});
    if(revision!==toggleRevision||x.owner()!==current)return;
    const r=await x.request('healthReadEnable',{owner:current,enabled},120000);
    if(revision!==toggleRevision||x.owner()!==current)return;
    ctxOwner=current;ctxActive=!!r.healthReadEnabled;
    state.nativeExtras={...prefs(),healthReadEnabled:ctxActive};save();paintRow();
    if(enabled&&!ctxActive){x.showStatus(txt('Kein Lesezugriff. Berechtigungen in Health prüfen.','No read access. Check permissions in Health.'));return}
    x.showStatus(txt('Gespeichert.','Saved.'));
    if(ctxActive&&await readHealth(true)===false)x.showStatus(txt('Keine Daten erhalten. Lesezugriff in Health prüfen.','No data received. Check read access in Health.'));
  }catch{if(x.owner()===current&&revision===toggleRevision){x.showStatus(txt('Health konnte nicht geändert werden. Erneut versuchen.','Could not change Health. Try again.'));paintRow()}}
};

globalThis.pulsHealthRead={recoveryScore,cleanDays,importWorkouts,importWeights,readHealth,cachedDays,DAYS_KEY,SEEN_KEY};
const x=X();
if(x&&x.has('healthRead')){
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)readHealth()});
  setTimeout(readHealth,2000);
}
})();
