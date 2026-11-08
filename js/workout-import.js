/* Append-only CSV import. Preview has no profile side effects; save uses the normal sync path. */
(function(){
'use strict';
const MAX_BYTES=4000000,MAX_ROWS=40000;
const tr=(de,en)=>state.language==='en'?en:de;
const fail=()=>{throw Error(tr('CSV nicht unterstützt oder ungültig. Bitte Datum, Übung und Satzwerte prüfen.','Unsupported or invalid CSV. Check dates, exercises and set values.'))};
const key=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Token order handles e.g. Machine Lateral Raise / Lateral Raise (Machine), without fuzzy muscle guesses.
const exerciseKey=s=>key(s).replace(/\bpull ups?\b/g,'pullup').split(' ').map(word=>{
 if(/^(?:flies|flyes)$/.test(word))return 'fly';
 if(word.endsWith('ies'))return word.slice(0,-3)+'y';
 if(/(?:sses|ches|shes|xes|zes|oes)$/.test(word))return word.slice(0,-2);
 return word.length>3&&word.endsWith('s')&&!/(?:ss|us)$/.test(word)?word.slice(0,-1):word;
}).sort().join(' ');
// Deliberate equipment-specific translations, checked against exact bundled catalogue names.
const importAliases=new Map([
 ['Leg Extension','Leg Extensions'],['Lying Leg Curl','Lying Leg Curls'],
 ['Seated Cable Row','Seated Cable Rows'],['Hammer Curl','Hammer Curls'],
 ['Tricep Pushdown','Triceps Pushdown'],['Pull Ups','Pullups'],
 ['Single Leg Extension','Single-Leg Leg Extension'],
 ['Cable Overhead Tricep Extension','Cable Overhead Triceps Extension (Rope)'],
 ['Machine Shoulder Press','Machine Shoulder (Military) Press'],
 ['Machine Reverse Fly','Reverse Machine Flyes'],['Chest Press','Machine Bench Press'],
 ['Incline Machine Bench Press','Leverage Incline Chest Press'],['Machine Row','Machine Seated Row'],
 ['Hip Abduction','Thigh Abductor'],['Hip Adduction','Thigh Adductor'],
 ['Machine Seated Crunch','Ab Crunch Machine'],['Iso-Lateral Row','Leverage Iso Row'],
 ['Iso-Lateral High Row','Leverage High Row'],['Sled Leg Press','Leg Press']
].map(([name,target])=>[exerciseKey(name),target]));
const ambiguousNames=new Set(['Bench Press','Squat','Lat Pulldown'].map(exerciseKey));
function csvRows(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)fail();
 text=text.replace(/^\uFEFF/,'');let first=text.split(/\r?\n/,1)[0],sep=first.includes(';')?';':',',rows=[],row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  let c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c==='"'){if(cell||closed)fail();quoted=true;continue}
  if(c===sep||c==='\r'||c==='\n'){
   row.push(cell);cell='';closed=false;
   if(c!==sep){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;if(rows.length>MAX_ROWS+1)fail()}
  }else{if(closed&&!/\s/.test(c))fail();if(!closed)cell+=c}
 }
 if(quoted)fail();row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2||rows.length>MAX_ROWS+1)fail();return rows;
}
function localDate(value){
 let m=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
 if(!m){let n=value.trim().match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{2}):(\d{2})(?::(\d{2}))?$/),month=n&&['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(n[2].toLowerCase());if(!n||month<0)fail();m=[n[0],n[3],String(month+1).padStart(2,'0'),n[1].padStart(2,'0'),n[4],n[5],n[6]]}
 let parts=m.slice(1).map(x=>Number(x||0)),[y,mo,d,h,mi,s]=parts;
 if(y<1900||y>2200||mo<1||mo>12||d<1||d>new Date(y,mo,0).getDate()||h>23||mi>59||s>59)fail();
 return {stamp:`${m[1]}-${m[2]}-${m[3]}T${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}`,day:`${m[1]}-${m[2]}-${m[3]}`,hasTime:m[4]!==undefined,time:new Date(y,mo-1,d,h,mi,s).getTime()};
}
function number(value,min,max,integer=false){if(value.trim()==='')return '';if(!/^\d+(?:[.,]\d+)?$/.test(value.trim()))fail();let n=Number(value.trim().replace(',','.'));if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))fail();return n}
function duration(value){
 if(!value.trim())return undefined;
 let v=value.trim(),m=v.match(/^(\d+):(\d{2}):(\d{2})$/),total;
 if(m){if(+m[2]>59||+m[3]>59)fail();total=+m[1]*3600+ +m[2]*60+ +m[3]}
 else if(/^\d+(?:\.\d+)?$/.test(v))total=Number(v);
 else{m=v.match(/^(?:(\d+)\s*(?:hours?|h)\s*)?(?:(\d+)\s*(?:minutes?|m)\s*)?(?:(\d+)\s*(?:seconds?|s)\s*)?$/i);if(!m||!m.slice(1).some(x=>x!==undefined))fail();total=+(m[1]||0)*3600+ +(m[2]||0)*60+ +(m[3]||0)}
 if(total>1e10)fail();return total;
}
async function digest(value){let bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
async function parse(text){
 let rows=csvRows(text),headers=rows.shift().map(key);if(new Set(headers).size!==headers.length)fail();
 const column=(...names)=>headers.findIndex(x=>names.includes(x));
 let cols={date:column('date','start time'),end:column('end time'),name:column('workout name','title'),exercise:column('exercise name','exercise title'),order:column('set order','set index'),weight:column('weight','weight lbs','weight kg'),reps:column('reps'),duration:column('duration','workout duration')};
 if(cols.date<0||cols.exercise<0||cols.weight<0||cols.reps<0)fail();
 let liftoff=headers.includes('set order')&&headers.includes('seconds')&&headers.includes('workout name'),unit=headers[cols.weight]==='weight kg'?'kg':headers[cols.weight]==='weight lbs'||liftoff?'lbs':'kg',groups=new Map(),omitted=false,skippedRows=0;
 for(let row of rows){
  if(row.length!==headers.length)fail();let get=k=>cols[k]<0?'':row[cols[k]].trim(),dt=localDate(get('date')),name=get('name'),exercise=get('exercise');if(exercise.length>200||name.length>200)fail();
  if(!exercise){skippedRows++;continue}
  let groupKey=JSON.stringify([dt.stamp,name]),g=groups.get(groupKey),seconds=duration(get('duration'));
  if(cols.end>=0&&row[cols.end].trim()){let end=localDate(row[cols.end]);if(!dt.hasTime||!end.hasTime||end.time<dt.time)fail();seconds=(end.time-dt.time)/1000}
  if(!g){g={...dt,name,seconds,rows:[]};groups.set(groupKey,g)}else if(g.seconds!==seconds)fail();
  let orderValue=get('order'),weight=number(get('weight'),0,100000),reps=number(get('reps'),0,100000,true),order=/^[a-z]+$/i.test(orderValue)?'':number(orderValue,0,MAX_ROWS,true);
  // Zero reps denotes a timed/distance set in some exports. Leave reps unknown in PULS.
  g.rows.push({exercise,weight,reps:reps===0?'':reps,order});
  if(headers.some((h,i)=>['distance','distance km','distance meters','seconds','duration seconds','rpe','notes','exercise notes','workout notes','set type'].includes(h)&&row[i].trim()))omitted=true;
 }
 let sessions=[];for(let g of groups.values()){
  let canonical=g.rows.map(r=>JSON.stringify([key(r.exercise),r.order,r.weight,r.reps])).sort();
  g.id='wi_'+await digest(JSON.stringify([g.stamp,g.name,g.seconds??null,canonical]));sessions.push(g);
 }
 if(!sessions.length)fail();sessions.sort((a,b)=>a.stamp.localeCompare(b.stamp)||a.id.localeCompare(b.id));return {sessions,unit,omitted,skippedRows};
}
function kg(value,unit){if(value==='')return '';let n=unit==='lbs'?value/2.20462262185:value,q=Math.round(n*4)/4;return Math.abs(n-q)<0.00001?q:Math.round(n*10)/10}
function plan(parsed,unit,profile){
 if(!['kg','lbs'].includes(unit))fail();let ids=new Set(profile.workouts.map(w=>w.id)),book=[...(profile.exerciseBook||[])],added=[],workouts=[],mapped=new Set(),fresh=new Set(),used=new Set(book.map(b=>b.id));
 let candidates=[...book,...exerciseCatalog],matches=new Map(),exactMatches=new Map(),localNames=new Map(),localExact=new Map(),created=new Map();
 for(let b of book){if(!localNames.has(exerciseKey(b.name)))localNames.set(exerciseKey(b.name),b);if(!localExact.has(key(b.name)))localExact.set(key(b.name),b)}
 for(let b of candidates)for(let name of [b.name,...(b.aliases||[])]){
  let k=exerciseKey(name),entry=localNames.get(exerciseKey(b.name))||b;
  if(!matches.has(k))matches.set(k,entry);if(!exactMatches.has(key(name)))exactMatches.set(key(name),entry);
 }
 const match=name=>{
  let k=exerciseKey(name),local=localExact.get(key(name))||localNames.get(k)||created.get(k);if(local)return local;
  if(ambiguousNames.has(k))return null;
  let target=importAliases.get(k),source=target&&exerciseCatalog.find(b=>b.name===target);
  return source?(localNames.get(exerciseKey(source.name))||source):exactMatches.get(key(name))||matches.get(k);
 };
 for(let session of parsed.sessions){
  if(ids.has(session.id))continue;ids.add(session.id);let exercises=[],byName=new Map();
  for(let row of session.rows){let k=exerciseKey(row.exercise),b=match(row.exercise);
   if(!b){let id='wi_ex_'+session.id.slice(3)+'_'+byName.size;b={id,name:row.exercise,target:0};created.set(k,b);fresh.add(k)}else if(!fresh.has(k))mapped.add(k);
   if(!used.has(b.id)){let entry={id:b.id,name:b.name,target:0};if(b.muscles)entry.muscles=[...b.muscles];if(b.equipment)entry.equipment=b.equipment;added.push(entry);used.add(b.id)}
   let e=byName.get(k);if(!e){e={id:session.id+'_e'+exercises.length,exerciseId:b.id,name:b.name,sets:[]};byName.set(k,e);exercises.push(e)}
   e.sets.push({kg:kg(row.weight,unit),reps:row.reps,done:true,_order:row.order});
  }
  for(let e of exercises){if(e.sets.every(s=>s._order!==''))e.sets.sort((a,b)=>a._order-b._order);for(let s of e.sets)delete s._order}
  let w={id:session.id,date:session.day,name:session.name||'Liftoff-Import '+session.day,finished:true,importSource:'workout-csv',exercises};
  if(session.hasTime)w.startedAt=session.time;
  if(session.seconds!==undefined){w.durationSeconds=session.seconds;if(session.hasTime)w.finishedAt=session.time+session.seconds*1000}workouts.push(w);
 }
 return {workouts,added,mapped:mapped.size,fresh:fresh.size,duplicates:parsed.sessions.length-workouts.length,sets:workouts.reduce((n,w)=>n+w.exercises.reduce((n,e)=>n+e.sets.length,0),0)};
}
const baseValid=validData;
validData=function(s){return baseValid(s)&&s.workouts.every(w=>w.importSource===undefined||w.importSource==='workout-csv'&&/^wi_[a-f0-9]{64}$/.test(w.id))};
const baseAwards=workoutAwards;
workoutAwards=function(...args){let awards=baseAwards.apply(this,args);for(let w of state.workouts)if(w.importSource==='workout-csv'&&awards[w.id])awards[w.id]={...awards[w.id],xp:0,wins:[],durationXp:0};return awards};
// Only this new feature wraps account rendering; existing controls and handlers remain intact.
const baseManage=accountManageBody;
accountManageBody=function(...args){let html=baseManage.apply(this,args),row=accountListRow({label:tr('Workout-CSV importieren','Import workout CSV'),action:'workoutImportForm()',cls:'dsaction',chevron:true});return html.replace(/(<h2 class="dsgrouptitle">(?:Daten|Data)<\/h2><section class="dsgroup[^\"]*">)/,'$1'+row)};
let pending=null,serial=0;
const owner=()=>typeof cloudSession!=='undefined'?cloudSession?.user?.id||'local':'local';
function current(p){return pending===p&&p.profile===state&&p.owner===owner()&&modal.open&&!!$('workout-import-preview')}
window.workoutImportForm=function(){
 let p=pending={profile:state,owner:owner(),serial:++serial,parsed:null};
 openModal(tr('Workout-CSV importieren','Import workout CSV'),`<div data-no-translate><p class="note">${tr('Liftoff, Hevy oder Strong. Erst Vorschau, dann speichern. Bestehende Einträge bleiben erhalten.','Liftoff, Hevy or Strong. Preview before saving. Existing entries are preserved.')}</p><label>${tr('CSV-Datei','CSV file')}<input type="file" accept=".csv,text/csv" onchange="workoutImportFile(this.files[0])"></label><div id="workout-import-preview" aria-live="polite"></div></div>`);return p;
};
window.workoutImportFile=async function(file){
 let p=pending;if(!p||!file)return;let request=++serial;p.serial=request;p.parsed=null;
 $('workout-import-preview').textContent=tr('Datei wird geprüft …','Checking file …');
 try{if(file.size>MAX_BYTES)fail();let parsed=await parse(await file.text());if(!current(p)||request!==p.serial)return;p.parsed=parsed;p.unit=parsed.unit;preview()}
 catch(e){if(current(p)&&request===p.serial)$('workout-import-preview').textContent=e.message}
};
function preview(){let p=pending;if(!current(p)||!p.parsed)return;let result=plan(p.parsed,p.unit,state),days=p.parsed.sessions.map(s=>s.day).sort();
 $('workout-import-preview').innerHTML=`<div data-no-translate><label>${tr('Gewichte in der Datei','Weights in file')}<select onchange="workoutImportUnit(this.value)"><option value="lbs" ${p.unit==='lbs'?'selected':''}>lbs</option><option value="kg" ${p.unit==='kg'?'selected':''}>kg</option></select></label><p>${result.workouts.length} ${tr('neue Sessions','new sessions')} · ${result.sets} ${tr('Sätze','sets')}<br>${result.mapped} ${tr('zugeordnete','matched')} / ${result.fresh} ${tr('neue Übungen','new exercises')}<br>${esc(days[0])} – ${esc(days.at(-1))}<br>${result.duplicates} ${tr('bereits importiert','already imported')}</p><p class="note">${tr('Keine rückwirkenden XP oder PR-Feiern. Historische Werte zählen für Statistik und Vorbelegung.','No retroactive XP or PR celebrations. Historical values count towards statistics and prefills.')}</p>${p.parsed.skippedRows?`<p class="note">${p.parsed.skippedRows} ${tr('Zeilen ohne Übungsnamen werden übersprungen.','rows without exercise names will be skipped.')}</p>`:''}${p.parsed.omitted?`<p class="note">${tr('Distanz, Satzzeit, RPE, Notizen und Satztyp werden vom Kraftsatz-Modell nicht unterstützt und ausgelassen.','Distance, set duration, RPE, notes and set type are unsupported by the strength set model and omitted.')}</p>`:''}<p class="note">${tr('Gewichte werden in kg gespeichert: auf 0,1 kg gerundet, exakte 0,25-kg-Schritte bleiben erhalten.','Weights are stored in kg: rounded to 0.1 kg, preserving exact 0.25 kg increments.')}</p><button type="button" class="btn full" onclick="confirmWorkoutImport()" ${result.workouts.length?'':'disabled'}>${tr('Import bestätigen','Confirm import')}</button><button type="button" class="btn secondary full" onclick="modal.close()">${tr('Abbrechen','Cancel')}</button></div>`;
}
window.workoutImportUnit=function(unit){if(!pending||!['kg','lbs'].includes(unit))return;pending.unit=unit;preview()};
window.confirmWorkoutImport=function(){
 let p=pending;if(!p?.parsed||!current(p)){toast(tr('Profil geändert. Bitte Datei erneut auswählen.','Profile changed. Please select the file again.'));return}
 try{let result=plan(p.parsed,p.unit,state);if(!result.workouts.length){preview();return}
  let next={...state,exerciseBook:[...(state.exerciseBook||[]),...result.added],workouts:[...state.workouts,...result.workouts]};
  if(!validData(next)||new TextEncoder().encode(JSON.stringify(next)).length>MAX_BYTES)fail();
  // Append to the latest profile only after explicit confirmation, with one ordinary save.
  state.exerciseBook=next.exerciseBook;state.workouts=next.workouts;pending=null;save();modal.close();render();toast(tr('Workouts importiert','Workouts imported'));
 }catch(e){toast(e.message)}
};
// Pure parsing/planning hooks also used by synthetic local regression tests.
window.pulsWorkoutImport={parse,plan,kg};
})();
