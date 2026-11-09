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
 ['Iso-Lateral High Row','Leverage High Row'],['Sled Leg Press','Leg Press'],
 // v90: Strong/Hevy-Schreibweise „Name (Equipment)“ auf exakte Katalognamen.
 ['Bench Press (Barbell)','Barbell Bench Press - Medium Grip'],['Bench Press (Dumbbell)','Dumbbell Bench Press'],
 ['Bench Press (Smith Machine)','Smith Machine Bench Press'],['Decline Bench Press (Barbell)','Decline Barbell Bench Press'],
 ['Incline Bench Press (Barbell)','Barbell Incline Bench Press - Medium Grip'],['Incline Bench Press (Dumbbell)','Incline Dumbbell Press'],
 ['Chest Press (Machine)','Machine Bench Press'],['Chest Fly (Dumbbell)','Dumbbell Flyes'],
 ['Overhead Press (Barbell)','Standing Military Press'],['Overhead Press (Dumbbell)','Dumbbell Shoulder Press'],
 ['Shoulder Press (Dumbbell)','Dumbbell Shoulder Press'],['Shoulder Press (Machine)','Machine Shoulder (Military) Press'],
 ['Lateral Raise (Dumbbell)','Side Lateral Raise'],['Lat Pulldown (Cable)','Wide-Grip Lat Pulldown'],
 ['Bent Over Row (Dumbbell)','Bent Over Two-Dumbbell Row'],['Face Pull (Cable)','Face Pull'],
 ['Triceps Pushdown (Cable)','Triceps Pushdown'],['Triceps Rope Pushdown','Triceps Pushdown - Rope Attachment'],
 ['Triceps Extension (Machine)','Machine Triceps Extension'],['Skullcrusher (EZ Bar)','EZ-Bar Skullcrusher'],
 ['Bicep Curl (Barbell)','Barbell Curl'],['Bicep Curl (Machine)','Machine Bicep Curl'],
 ['Hammer Curl (Dumbbell)','Hammer Curls'],['Preacher Curl (Barbell)','Preacher Curl'],
 ['Romanian Deadlift (Barbell)','Romanian Deadlift'],['Hip Thrust (Barbell)','Barbell Hip Thrust'],
 ['Front Squat (Barbell)','Front Squat (Clean Grip)'],['Hack Squat (Machine)','Hack Squat'],['Leg Press (Machine)','Leg Press'],
 ['Leg Extension (Machine)','Leg Extensions'],['Lying Leg Curl (Machine)','Lying Leg Curls'],['Seated Leg Curl (Machine)','Seated Leg Curl'],
 ['Shrug (Barbell)','Barbell Shrug'],['Shrug (Dumbbell)','Dumbbell Shrug'],['Standing Calf Raise (Machine)','Standing Calf Raises']
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
function weightUnit(header,sessions,liftoff){
 if(header==='weight kg')return 'kg';
 if(header==='weight lbs'||header==='weight lb')return 'lbs';
 // Ignore blanks/bodyweight zeros. Converted Liftoff pounds retain the original kg grid.
 let values=sessions.flatMap(s=>s.rows.map(r=>r.weight)).filter(n=>typeof n==='number'&&n>0);
 const onGrid=n=>Math.abs(n-Math.round(n*4)/4)<1e-4;
 let metric=values.filter(onGrid).length,pounds=values.filter(n=>onGrid(n/2.20462262185)).length;
 if(metric>pounds)return 'kg';
 if(pounds>metric)return 'lbs';
 return liftoff?'lbs':'kg';
}
async function parse(text){
 let rows=csvRows(text),headers=rows.shift().map(key);if(new Set(headers).size!==headers.length)fail();
 const column=(...names)=>headers.findIndex(x=>names.includes(x));
 let explicitWeight=column('weight lbs','weight lb','weight kg');
 let cols={date:column('date','start time'),end:column('end time'),name:column('workout name','title'),exercise:column('exercise name','exercise title'),order:column('set order','set index'),weight:explicitWeight>=0?explicitWeight:column('weight'),reps:column('reps'),duration:column('duration','workout duration')};
 if(cols.date<0||cols.exercise<0||cols.weight<0||cols.reps<0)fail();
 let liftoff=headers.includes('set order')&&headers.includes('seconds')&&headers.includes('workout name'),groups=new Map(),omitted=false,skippedRows=0;
 for(let row of rows){
  if(row.length!==headers.length)fail();let get=k=>cols[k]<0?'':row[cols[k]].trim(),dt=localDate(get('date')),name=get('name'),exercise=get('exercise');if(exercise.length>200||name.length>200)fail();
  let groupKey=JSON.stringify([dt.stamp,name]),g=groups.get(groupKey),seconds=duration(get('duration')),ignoredEnd=false;
  if(cols.end>=0&&row[cols.end].trim()){
   let end=localDate(row[cols.end]);
   // A contradictory end stamp is not evidence of an overnight duration.
   if(dt.hasTime&&end.hasTime&&end.time>=dt.time)seconds=(end.time-dt.time)/1000;else ignoredEnd=true;
  }
  // Liftoff can round the same session's duration differently across set rows.
  // Max is independent of row order; uniform-duration exports retain their IDs.
  if(!g){g={...dt,name,seconds,rows:[],extraRows:[]};groups.set(groupKey,g)}else if(seconds!==undefined)g.seconds=g.seconds===undefined?seconds:Math.max(g.seconds,seconds);
  if(!exercise){skippedRows++;g.extraRows.push(Object.fromEntries(headers.map((h,i)=>[h,row[i]])));continue}
  let orderValue=get('order'),weight=number(get('weight'),0,100000),reps=number(get('reps'),0,100000,true),order=/^[a-z]+$/i.test(orderValue)?'':number(orderValue,0,MAX_ROWS,true);
  // Zero reps denotes a timed/distance set in some exports. Leave reps unknown in PULS.
  // Keep source-only fields verbatim, including units in their headers and multiline notes.
  let csvFields=Object.fromEntries(headers.flatMap((h,i)=>{
   const value=row[i].trim(),numeric=Number(value.replace(',','.'));
   return (!Object.values(cols).includes(i)||ignoredEnd&&i===cols.end)&&value&&(!Number.isFinite(numeric)||numeric>0)?[[h,row[i]]]:[];
  }));
  g.rows.push({exercise,weight,reps:reps===0?'':reps,order,setOrder:orderValue,csvFields});
 }
 let sessions=[];for(let g of groups.values()){
  if(!g.rows.length)continue;
  let canonical=g.rows.map(r=>JSON.stringify([key(r.exercise),r.order,r.weight,r.reps])).sort();
  g.id='wi_'+await digest(JSON.stringify([g.stamp,g.name,g.seconds??null,canonical]));sessions.push(g);
 }
 if(!sessions.length)fail();sessions.sort((a,b)=>a.stamp.localeCompare(b.stamp)||a.id.localeCompare(b.id));
 let routineGroups=[];
 for(let session of sessions){
  let group=session.name?routineGroups.find(g=>g.name===session.name):null;
  if(!group){group={name:session.name,sessions:[]};routineGroups.push(group)}
  group.sessions.push(session.id);
 }
 for(let group of routineGroups)group.id='wi_r_'+await digest(group.name?'name:'+group.name:group.sessions[0]);
 let familyIds={};for(let family of ['push','pull','legs','core','upper','full'])familyIds[family]='wi_r_'+await digest('family:'+family);
 return {sessions,unit:weightUnit(headers[cols.weight],sessions,liftoff),omitted,skippedRows,routineGroups,familyIds,liftoff};
}
function kg(value,unit){if(value==='')return '';let n=unit==='lbs'?value/2.20462262185:value,q=Math.round(n*4)/4;return Math.abs(n-q)<0.00001?q:Math.round(n*10)/10}
function plan(parsed,unit,profile,includeRoutines=true){
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
  if(!session.rows.length||ids.has(session.id))continue;ids.add(session.id);let exercises=[],byName=new Map();
  for(let row of session.rows){let k=exerciseKey(row.exercise),b=match(row.exercise);
   if(!b){let id='wi_ex_'+session.id.slice(3)+'_'+byName.size;b={id,name:row.exercise,target:0};created.set(k,b);fresh.add(k)}else if(!fresh.has(k))mapped.add(k);
   if(!used.has(b.id)){let entry={id:b.id,name:b.name,target:0};if(b.muscles)entry.muscles=[...b.muscles];if(b.equipment)entry.equipment=b.equipment;added.push(entry);used.add(b.id)}
   let e=byName.get(k);if(!e){e={id:session.id+'_e'+exercises.length,exerciseId:b.id,name:b.name,sets:[]};byName.set(k,e);exercises.push(e)}
   let set={kg:kg(row.weight,unit),reps:row.reps,done:true,_order:row.order,setOrder:row.setOrder};
   if(Object.keys(row.csvFields).length)set.csvFields={...row.csvFields};
   e.sets.push(set);
  }
  for(let e of exercises){if(e.sets.every(s=>s._order!==''))e.sets.sort((a,b)=>a._order-b._order);for(let s of e.sets)delete s._order}
  let w={id:session.id,date:session.day,name:session.name||(parsed.liftoff?'Liftoff-Import ':'Import ')+session.day,finished:true,importSource:'workout-csv',exercises};
  if(session.extraRows?.length)w.csvRows=session.extraRows.map(row=>({...row}));
  if(session.hasTime)w.startedAt=session.time;
  if(session.seconds!==undefined){w.durationSeconds=session.seconds;if(session.hasTime)w.finishedAt=session.time+session.seconds*1000}workouts.push(w);
 }
 let routines=[],allWorkouts=[...profile.workouts,...workouts],allBook=[...book,...added],routineNames=new Map(),groups=(parsed.routineGroups||[]).filter(g=>g.name).map(g=>({...g}));
 for(let session of parsed.sessions.filter(s=>!s.name)){
  let w=allWorkouts.find(w=>w.id===session.id),family=routineFamily(w?.exercises||[],allBook);
  if(!w?.exercises.length)continue;
  family??='custom:'+w.exercises.map(e=>e.exerciseId).sort().join('|');
  let group=groups.find(g=>g.family===family);
  if(!group){group={family,id:parsed.familyIds[family]||parsed.routineGroups.find(g=>g.sessions.includes(session.id)).id,name:'',sessions:[]};groups.push(group)}group.sessions.push(session.id);
 }
 for(let group of groups){
  if(!group.name&&group.sessions.length<2)continue;
  let history=group.sessions.map(id=>allWorkouts.find(w=>w.id===id)).filter(Boolean),last=history.at(-1);if(!last)continue;
  let counts=new Map();for(let w of history)for(let id of new Set(w.exercises.map(e=>e.exerciseId)))counts.set(id,(counts.get(id)||0)+1);
  let exercises=last.exercises.filter(e=>group.name||counts.get(e.exerciseId)>=Math.max(2,Math.ceil(history.length*.3)));
  if(!exercises.length)continue;
  // Average source position keeps the group's usual order, with last-session values.
  const position=id=>{
   const indices=history.flatMap(w=>{let i=w.exercises.findIndex(e=>e.exerciseId===id);return i<0?[]:[i]});
   return indices.reduce((a,b)=>a+b,0)/indices.length;
  };
  exercises.sort((a,b)=>position(a.exerciseId)-position(b.exerciseId));
  let name=group.name||routineName(group.family),count=(routineNames.get(name)||0)+1;routineNames.set(name,count);
  if(!group.name&&count>1)name+=' '+count;
  let existing=(profile.routines||[]).find(r=>r.id===group.id||group.name&&r.name===group.name),id=existing?.id||group.id;
  if(existing||includeRoutines)for(let w of workouts)if(group.sessions.includes(w.id))w.routineId=id;
  if(existing)continue;
  routines.push({id,name,importWorkoutId:last.id,exercises:exercises.map(e=>{
   let reps=e.sets.map(s=>s.reps).filter(n=>Number.isInteger(n)&&n>=1&&n<=100);
   return {exerciseId:e.exerciseId,sets:Math.min(12,e.sets.length),min:reps.length?Math.min(...reps):1,max:reps.length?Math.max(...reps):100,restSeconds:profile.workoutSettings?.restSeconds??120};
  })});
 }
 return {workouts,added,routines,mapped:mapped.size,fresh:fresh.size,duplicates:parsed.sessions.length-workouts.length,sets:workouts.reduce((n,w)=>n+w.exercises.reduce((n,e)=>n+e.sets.length,0),0)};
}
function routineFamily(exercises,book){
 let totals={push:0,pull:0,legs:0,core:0};
 for(let e of exercises){let b=book.find(b=>b.id===e.exerciseId),muscles=(b?.muscles||[]).join(' ').toLowerCase();
  if(/quadriceps|hamstrings|glutes|calves|adductors|abductors/.test(muscles))totals.legs++;
  else if(/chest|shoulders|triceps/.test(muscles))totals.push++;
  else if(/back|lats|biceps|traps|forearms/.test(muscles))totals.pull++;
  else if(/abdominals|abs|core/.test(muscles))totals.core++;
 }
 let [dominant,count]=Object.entries(totals).sort((a,b)=>b[1]-a[1])[0],total=Object.values(totals).reduce((a,b)=>a+b,0);
 if(!total)return null;
 if(count/total>=.6)return dominant;
 return totals.legs/total<.25?'upper':'full';
}
function routineName(family){return {push:'Push',pull:'Pull',legs:tr('Beine','Legs'),core:tr('Rumpf','Core'),upper:tr('Oberkörper','Upper body'),full:tr('Ganzkörper','Full body')}[family]||tr('Training','Workout')}
// Imported routines use their own latest session, through the existing prefill entry point.
const basePrefill=prefillExerciseSets;
prefillExerciseSets=function(w,e){
 if(w.routineId?.startsWith('wi_r_')){
  const routine=state.routines.find(r=>r.id===w.routineId);
  let previous=state.workouts.filter(x=>x.finished&&(x.routineId===w.routineId||x.id===routine?.importWorkoutId)&&x.date<=w.date).sort((a,b)=>b.date.localeCompare(a.date)||(b.startedAt||0)-(a.startedAt||0))[0];
  let values=previous?.exercises.find(x=>x.exerciseId===e.exerciseId)?.sets;
  if(values){for(let [i,s] of e.sets.entries())if(values[i]&&s.kg===''&&s.reps===''&&!s.done){s.kg=values[i].kg;s.reps=values[i].reps}return}
 }
 return basePrefill(w,e);
};
const baseValid=validData;
validData=function(s){
 const fieldsOK=value=>value===undefined||value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([k,v])=>k.length<=200&&typeof v==='string'&&v.length<=MAX_BYTES);
 return baseValid(s)&&(s.routines||[]).every(r=>r.importWorkoutId===undefined||typeof r.importWorkoutId==='string'&&/^wi_[a-f0-9]{64}$/.test(r.importWorkoutId))&&s.workouts.every(w=>
  (w.importSource===undefined||w.importSource==='workout-csv'&&/^wi_[a-f0-9]{64}$/.test(w.id))&&
  (w.csvRows===undefined||Array.isArray(w.csvRows)&&w.csvRows.every(fieldsOK))&&w.exercises.every(e=>e.sets.every(set=>(set.setOrder===undefined||typeof set.setOrder==='string'&&set.setOrder.length<=200)&&fieldsOK(set.csvFields))));
};
const baseAwards=workoutAwards;
workoutAwards=function(...args){let awards=baseAwards.apply(this,args);for(let w of state.workouts)if(w.importSource==='workout-csv'&&awards[w.id])awards[w.id]={...awards[w.id],xp:0,wins:[],durationXp:0};return awards};
// Only this new feature wraps account rendering; existing controls and handlers remain intact.
const baseManage=accountManageBody;
accountManageBody=function(...args){let html=baseManage.apply(this,args),row=accountListRow({label:tr('Workout-CSV importieren','Import workout CSV'),action:'workoutImportForm()',cls:'dsaction',chevron:true});return html.replace(/(<h2 class="dsgrouptitle">(?:Daten|Data)<\/h2><section class="dsgroup[^\"]*">)/,'$1'+row)};
let pending=null,importResult=null,serial=0;
const owner=()=>typeof cloudSession!=='undefined'?cloudSession?.user?.id||'local':'local';
function current(p){return pending===p&&p.profile===state&&p.owner===owner()&&(!p.onboarding||setupPending&&onboardingImport?.profile===state&&onboardingImport.owner===owner())&&modal.open&&!!$('workout-import-preview')}
// flows.js finishes only after committing optional profile/weight inputs. Later wrappers
// retain that entry point; Skip continues to use the original skipOnboarding handler.
const baseFinishOnboarding=finishOnboarding;
let onboardingImport=null;
finishOnboarding=function(){
 if(!setupPending)return baseFinishOnboarding();
 pending=null;onboardingImport={profile:state,owner:owner()};
 openModal(tr('Training','Training'),`<div data-no-translate><button type="button" class="btn full" onclick="workoutImportForm(true)">${tr('Aus Liftoff importieren','Import from Liftoff')}</button><button type="button" class="btn secondary full" onclick="finishWorkoutImportOnboarding()">${tr('Weiter','Continue')}</button></div>`);
};
window.finishWorkoutImportOnboarding=function(){
 if(!setupPending||onboardingImport?.profile!==state||onboardingImport.owner!==owner())return;
 pending=null;onboardingImport=null;baseFinishOnboarding();
};
window.cancelWorkoutImport=function(){let p=pending;pending=null;if(p?.onboarding&&setupPending&&p.profile===state&&p.owner===owner())finishOnboarding();else modal.close()};
window.workoutImportForm=function(onboarding=false){
 importResult=null;
 onboarding=onboarding===true&&setupPending&&onboardingImport?.profile===state&&onboardingImport.owner===owner();
 let p=pending={profile:state,owner:owner(),serial:++serial,parsed:null,routines:true,onboarding};
 openModal(tr('Workout-CSV importieren','Import workout CSV'),`<div data-no-translate><label>${tr('CSV-Datei','CSV file')}<input type="file" accept=".csv,text/csv" onchange="workoutImportFile(this.files[0])"></label><div id="workout-import-preview" aria-live="polite"></div><button type="button" class="btn secondary full" onclick="cancelWorkoutImport()">${tr('Zurück','Back')}</button></div>`);return p;
};
window.workoutImportFile=async function(file){
 let p=pending;if(!p||!file)return;let request=++serial;p.serial=request;p.parsed=null;
 $('workout-import-preview').textContent=tr('Datei wird geprüft …','Checking file …');
 try{if(file.size>MAX_BYTES)fail();let parsed=await parse(await file.text());if(!current(p)||request!==p.serial)return;p.parsed=parsed;p.unit=parsed.unit;preview()}
 catch(e){if(current(p)&&request===p.serial)$('workout-import-preview').textContent=e.message}
};
function preview(){let p=pending;if(!current(p)||!p.parsed)return;let result=plan(p.parsed,p.unit,state,p.routines),days=p.parsed.sessions.map(s=>s.day).sort();
 $('workout-import-preview').innerHTML=`<div data-no-translate><p>${result.workouts.length} ${tr('neue Sessions','new sessions')} · ${result.sets} ${tr('Sätze','sets')}<br>${result.mapped} ${tr('zugeordnete','matched')} / ${result.fresh} ${tr('neue Übungen','new exercises')}<br>${esc(days[0])} – ${esc(days.at(-1))}<br>${result.duplicates} ${tr('bereits importiert','already imported')}</p><label><input type="checkbox" ${p.routines?'checked':''} onchange="workoutImportRoutines(this.checked)"> ${tr('Routinen übernehmen','Import routines')}</label>${(p.routines?result.routines:[]).map(r=>`<div>${esc(r.name)} · ${r.exercises.length} ${tr('Übungen','exercises')}</div>`).join('')}${p.parsed.skippedRows?`<p>${p.parsed.skippedRows} ${tr('Zeilen ohne Übung','rows without exercise')}</p>`:''}<button type="button" class="btn full" onclick="confirmWorkoutImport()" ${result.workouts.length||p.routines&&result.routines.length?'':'disabled'}>${tr('Import bestätigen','Confirm import')}</button></div>`;
}
window.workoutImportRoutines=function(value){if(pending){pending.routines=!!value;preview()}};
function showImportResult(p){
 importResult={profile:state,owner:owner(),onboarding:p.onboarding};
 const strength=window.pulsStrength,all=strength?.all(state)||[],rank=strength?.overall(state);
 const hasWeight=!!strength&&state.workouts.some(w=>w.finished&&strength.weightAt(state,w.date)!=null);
 const badge=r=>window.pulsFriendsBoard?.emblem(r.index,r.stage,56,{label:r.name})||'';
 const ranks=hasWeight&&rank?`<div style="text-align:center">${badge(rank)}<h3>${esc(rank.name)}</h3></div><div class="dsgroup">${all.slice(0,5).map(r=>`<div class="dsrow"><div class="dsrowtext"><span>${esc(r.exerciseName)}</span><small>${esc(r.name)}</small></div></div>`).join('')}</div>`:'';
 openModal(tr('Import abgeschlossen','Import complete'),`<div data-no-translate>${ranks}${!hasWeight?`<button type="button" class="btn full" onclick="finishWorkoutImportResult(true)">${tr('Gewicht eintragen','Enter weight')}</button>`:''}<button type="button" class="btn ${hasWeight?'':'secondary '}full" onclick="finishWorkoutImportResult()">${p.onboarding?tr('Weiter','Continue'):tr('Fertig','Done')}</button></div>`);
}
window.finishWorkoutImportResult=function(enterWeight=false){
 const p=importResult;if(!p||p.profile!==state||p.owner!==owner()||p.onboarding&&(!setupPending||onboardingImport?.profile!==state||onboardingImport.owner!==owner()))return;
 importResult=null;
 if(p.onboarding)window.finishWorkoutImportOnboarding();else{modal.close();render()}
 if(enterWeight===true)weightForm();
};
window.confirmWorkoutImport=function(){
 let p=pending;if(!p?.parsed||!current(p)){toast(tr('Profil geändert. Bitte Datei erneut auswählen.','Profile changed. Please select the file again.'));return}
 try{let result=plan(p.parsed,p.unit,state,p.routines);if(!result.workouts.length&&(!p.routines||!result.routines.length)){preview();return}
  let next={...state,exerciseBook:[...(state.exerciseBook||[]),...result.added],workouts:[...state.workouts,...result.workouts],routines:[...(state.routines||[]),...(p.routines?result.routines:[])]};
  if(!validData(next)||new TextEncoder().encode(JSON.stringify(next)).length>MAX_BYTES)fail();
  // Append to the latest profile only after explicit confirmation, with one ordinary save.
  state.exerciseBook=next.exerciseBook;state.workouts=next.workouts;state.routines=next.routines;pending=null;save();
  // refresh uses the existing opt-in, dirty/revision/conflict gates; sync completion
  // already schedules another pass when the newly imported profile is uploaded.
  if(window.pulsFriendsData87?.getSnapshot()?.self){try{Promise.resolve(window.pulsFriends?.refresh(true)).catch(()=>{})}catch{}}
  showImportResult(p);
  toast(tr('Workouts importiert','Workouts imported'));
 }catch(e){toast(e.message)}
};
// Pure parsing/planning hooks also used by synthetic local regression tests.
window.pulsWorkoutImport={parse,plan,kg};
})();
