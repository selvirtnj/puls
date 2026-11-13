/* PULS v87 · Plus-Menü und Konto im Stil einer „Mehr“-Übersicht.
   Plus-Menü: Essen suchen, Barcode, KI-Foto, Aktivität, Training plus Liste; alle Einträge rufen vorhandene Abläufe auf
   (food-page/food-flow, recipes, quick-units, running). Kein Sprachprotokoll, keine Notiz, kein Fasten.
   Konto: Übersicht mit Unterseiten Konto, Profil, Ziele, Darstellung und dem Bereich „Entdecken“. Die Unterseiten
   bauen auf accountListRow, accountManageBody, accountGoalSummary und den bestehenden Formularen auf; die alten
   Bereiche (accountSections) bleiben unverändert über openAccountSection erreichbar und kehren zur Unterseite zurück.
   Neue Einstellungen werden über window.pulsData87 gelesen und nur mit gültigen Werten gespeichert (save()).
   Lädt nach food-page.js und vor motion.js; window.pulsMotion wird erst beim Klick benutzt. */

let qaPage='',qaParent='',qaAnimate='',qaRatioOpen=false;
const qaViewKeys=['energy','micros','week'];
const qaHighlightMax=8;

function qaT(de,en){return typeof state!=='undefined'&&state?.language==='en'?en:de}
function qaIcon(name){return typeof phIcon==='function'?phIcon(name):typeof uiIcon==='function'?uiIcon(name):''}
function qaSound(kind){try{if(typeof pulsSound==='function')pulsSound(kind)}catch{}}
function qaNum(x){return typeof n==='function'?n(x):String(x)}
function qaObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function qaMotion(){return typeof window!=='undefined'?window.pulsMotion:null}
function qaDisplay(){
  try{let d=window.pulsData87?.display?.();if(qaObj(d))return d}catch{}
  let d=qaObj(state?.display)?state.display:{};
  return {summaryViews:Array.isArray(d.summaryViews)?d.summaryViews:[...qaViewKeys],showRemaining:d.showRemaining===true,highlighted:Array.isArray(d.highlighted)?d.highlighted:[],hapticsEnabled:d.hapticsEnabled!==false,motion:d.motion==='reduced'?'reduced':'system'};
}
function qaWater(){try{let w=window.pulsData87?.water?.();if(qaObj(w))return w}catch{}return {mode:Number(state?.waterGoal)>0?'manual':'auto',glassMl:250}}
// Objekt vor dem Schreiben sicherstellen; Standardwerte kommen aus der Datenschicht (nur im Speicher).
function qaEnsure(key){
  if(!qaObj(state[key])){try{window.pulsData87?.migrate?.(state)}catch{}}
  if(!qaObj(state[key]))state[key]=key==='display'?{...qaDisplay()}:{};
  return state[key];
}
function qaRow(o){return typeof accountListRow==='function'?accountListRow(o):`<div class="dsrow"><span class="dsrowtext"><span>${o.label}</span></span></div>`}
function qaGroup(title,rows,cls='',foot=''){return `${title?`<h2 class="dsgrouptitle">${title}</h2>`:''}<section class="dsgroup${cls?' '+cls:''}">${rows}</section>${foot?`<p class="dsgroupfoot">${foot}</p>`:''}`}
function qaManualMacros(plan=state?.plan){return !!plan&&(plan.mode==='manual'||plan.macroMode==='manual')}
function qaGoals(){try{if(typeof dayGoals==='function')return dayGoals(typeof today==='function'?today():undefined)||state.goals}catch{}return state.goals||{}}

/* ---------- Plus-Menü ---------- */
const qaKnownQuick=new Set(['food','barcode','camera','recipe','water','weight','workout','run','ruler']);
function qaQuickTiles(){return [
  ['search','magnifying-glass',qaT('Essen suchen','Find food'),"foodForm();foodTab('search')"],
  ['barcode','barcode',qaT('Barcode','Barcode'),"foodForm();foodTab('barcode')"],
  ['photo','camera',qaT('KI-Foto','AI photo'),'qaQuickPhoto()'],
  ['run','person-simple-run',qaT('Aktivität','Activity'),'quickAddRun()'],
  ['training','barbell',qaT('Training','Workout'),'qaQuickTraining()']
]}
// Öffnet direkt die KI-Schätzung aus food-photo.js; ohne sie bleibt der normale Foto-Reiter.
function qaQuickPhoto(){foodForm();foodTab('photo');if(typeof foodPhotoOpen==='function')foodPhotoOpen()}
function qaQuickRows(){
  let rows=[['weight','scales',qaT('Gewicht','Weight'),qaT('Messwert erfassen','Log a measurement'),'weightForm()']];
  rows.push(
    ['meal','list-plus',qaT('Eigene Mahlzeit','Custom meal'),qaT('Kombi aus mehreren Lebensmitteln','Combo of several foods'),'qaQuickMeal()'],
    ['recipe','cooking-pot',qaT('Eigenes Rezept','Custom recipe'),qaT('Zutaten kombinieren','Combine ingredients'),'recipeEditor()'],
    ['custom','pencil-simple',qaT('Eigenes Lebensmittel','Custom food'),qaT('Nährwerte selbst eingeben','Enter nutrition values'),"foodForm();foodTab('custom')"]
  );
  // Später ergänzte Einträge anderer Module bleiben erhalten.
  if(typeof quickAddActions!=='undefined'&&Array.isArray(quickAddActions))for(let [key,label,note,action] of quickAddActions)if(!qaKnownQuick.has(key)&&typeof action==='string')rows.push([key,typeof quickAddIcons!=='undefined'&&quickAddIcons[key]||'plus-circle',label,note,action]);
  rows.push(['ruler','ruler',qaT('Körpermaße erfassen','Log body measurements'),qaT('Maße & Biometrie','Measures & biometrics'),'measurementsForm()']);
  return rows;
}
function qaQuickHTML(){
  let i=0,tile=([key,icon,label,action])=>`<button type="button" class="qatile motion-enter" style="--motion-i:${i++}" data-qa-quick="${key}" onclick="${action}"><span class="qatileicon" aria-hidden="true">${qaIcon(icon)}</span><span>${label}</span></button>`;
  let row=([key,icon,label,note,action])=>`<button type="button" class="dsrow dsiconrow motion-enter" style="--motion-i:${Math.min(i++,10)}" data-qa-quick="${key}" onclick="${action}"><span class="dsrowicon" aria-hidden="true">${qaIcon(icon)}</span><span class="dsrowtext"><span>${label}</span><small>${note}</small></span></button>`;
  return `<div class="qaquick"><div class="qatiles" role="group" aria-label="${qaT('Erfassen','Log')}">${qaQuickTiles().map(tile).join('')}</div><div class="dsgroup dsactionlist qaquicklist">${qaQuickRows().map(row).join('')}</div></div>`;
}
function qaQuickMeal(){foodForm();if(typeof fpMealEdit==='function')fpMealEdit();else if(typeof fpBackTo==='function')fpBackTo('meals')}
function qaQuickTraining(){
  if(activeWorkout())return quickAddWorkout();
  document.body.classList.remove('quickaddopen');
  let rows=[
    qaRow({label:qaT('Leeres Workout starten','Start empty workout'),icon:'barbell',action:'startQuickEmptyWorkout()',chevron:true}),
    qaRow({label:qaT('Routine starten','Start routine'),icon:'list-plus',action:'qaQuickRoutines()',chevron:true}),
    qaRow({label:qaT('Aktivität / Lauf starten','Start activity / run'),icon:'person-simple-run',action:'quickAddRun()',chevron:true})
  ].join('');
  return openModal(qaT('Training starten','Start training'),qaGroup('',rows));
}
function qaQuickRoutines(){
  // Indizes statt IDs im Inline-Handler; Namen werden wie sonst über esc ausgegeben.
  let rows=state.routines.map((r,i)=>qaRow({label:esc(r.name),action:`modal.close();startRoutine(state.routines[${i}].id)`,chevron:true})).join('');
  return openModal(qaT('Routine starten','Start routine'),rows?qaGroup('',rows):`<p class="note">${qaT('Noch keine Routinen vorhanden.','No routines yet.')}</p>`);
}
// Ersetzt die Definition aus refinement.js; Umschalten und body.quickaddopen aus app-polish.js bleiben hier erhalten.
quickAddMenu=function(){
  if(typeof modal!=='undefined'&&modal.open&&document.body.classList.contains('quickaddopen')){if(typeof dismissSheet==='function')dismissSheet();else modal.close();return}
  let result=openModal(qaT('Schnell hinzufügen','Quick add'),qaQuickHTML());
  document.body.classList.add('quickaddopen');qaSound('sheetOpen');return result;
};

/* ---------- Konto: Übersicht ---------- */
const qaPages={
  account:{title:['Konto','Account'],icon:'user-gear',body:()=>qaAccountBody()},
  profile:{title:['Profil','Profile'],icon:'user-circle',body:()=>qaProfileBody()},
  targets:{title:['Deine Ziele','Your targets'],icon:'target',body:()=>qaTargetsBody()},
  display:{title:['Darstellung','Display'],icon:'circle-half',body:()=>qaDisplayBody()}
};
function qaPageTitle(key){let t=qaPages[key]?.title;return t?qaT(t[0],t[1]):''}
function qaSexLabel(sex){return sex==='male'?qaT('Männlich','Male'):sex==='female'?qaT('Weiblich','Female'):'–'}
function qaProfileDetail(){
  let p=state.profile,w=typeof currentWeight==='function'?currentWeight():null,parts=[];
  if(Number.isFinite(p?.age))parts.push(p.age+' '+qaT('Jahre','years'));
  if(Number.isFinite(p?.height))parts.push(qaNum(p.height)+' cm');
  if(Number.isFinite(w))parts.push(qaNum(w)+' kg');
  return parts.length?parts.join(' · '):qaT('Körperdaten ergänzen','Add body data');
}
function qaTargetsDetail(){let g=qaGoals();return Number.isFinite(g?.kcal)?`${qaNum(g.kcal)} kcal · P ${qaNum(g.p)} · ${qaT('KH','C')} ${qaNum(g.c)} · F ${qaNum(g.f)} g`:qaT('Kalorien & Makros','Calories & macros')}
function qaDisplayDetail(){
  let scheme='system';try{if(typeof getColorScheme==='function')scheme=getColorScheme()}catch{}
  let names={system:qaT('System','System'),light:qaT('Hell','Light'),dark:qaT('Dunkel','Dark'),fresh:qaT('Frisch','Fresh'),midnight:qaT('Mitternacht','Midnight')};
  return (names[scheme]||names.system)+' · '+(state.language==='en'?'English':'Deutsch');
}
function qaMainRows(){
  let detail={account:typeof accountCloudDetail==='function'?accountCloudDetail():qaT('Anmeldung & Daten','Sign-in & data'),profile:qaProfileDetail(),targets:qaTargetsDetail(),display:qaDisplayDetail()};
  return Object.entries(qaPages).map(([key,page])=>qaRow({label:esc(qaPageTitle(key)),detail:esc(detail[key]),icon:page.icon,action:`qaOpen('${key}')`,chevron:true,cls:'accountmenulink qamenulink',id:'qa-link-'+key}));
}
function qaDiscoverRows(){
  let rows=[
    {label:qaT('Körper & Entwicklung','Body & progress'),detail:qaT('Gewichtstrend & Wochenmittel','Weight trend & weekly averages'),icon:'scales',action:"qaSection('body')"}
  ];
  return rows.map(r=>qaRow({...r,label:esc(r.label),detail:esc(r.detail),chevron:true,cls:'qamenulink'})).join('');
}
function qaOverview(template){
  let content=template?.content,identity=content?.querySelector?.('.accountprofilegroup')?.outerHTML||'',version=content?.querySelector?.('.versionstamp')?.outerHTML||'';
  // „Entdecken“ trägt die Klasse accountmenugroup, damit friends.js die Zeile „Freunde“ dort einhängt.
  return `<div class="accountcompact accountrefresh accountoverview qapage qamore">${identity}<nav class="dsgroup qamenu" aria-label="${qaT('Einstellungen','Settings')}">${qaMainRows().join('')}</nav><h2 class="dsgrouptitle" id="qa-discover-title">${qaT('Entdecken','Discover')}</h2><nav class="dsgroup accountmenugroup qadiscover" aria-labelledby="qa-discover-title">${qaDiscoverRows()}</nav>${version}</div>`;
}
function qaDetail(key){
  let body='';try{body=qaPages[key].body()}catch(error){console.error(error);body=`<p class="note">${qaT('Dieser Bereich konnte nicht geladen werden.','This section could not be loaded.')}</p>`}
  return `<div class="accountcompact accountrefresh accountdetail qapage qadetail" data-qa-page="${key}"><div class="accountdetailhead"><button type="button" class="accountback" onclick="qaBack()">${qaIcon('caret-left')}<span>${qaT('Konto','Account')}</span></button></div><h1 id="account-section-title" tabindex="-1">${esc(qaPageTitle(key))}</h1><div class="accountdetailcontent">${body}</div></div>`;
}

/* ---------- Unterseite Konto ---------- */
function qaAccountBody(){
  let name=state.displayName?.trim();
  let profile=qaRow({label:qaT('Name','Name'),value:name?esc(name):qaT('Nicht festgelegt','Not set'),icon:'user',action:'nameProfile()',chevron:true});
  let manage='';
  try{
    if(typeof accountRefreshBase==='function'&&typeof accountManageBody==='function'){
      let template=document.createElement('template');template.innerHTML=accountRefreshBase();
      let root=template.content.querySelector('.accountcompact');if(root)manage=accountManageBody(root);
    }
  }catch(error){console.error(error)}
  if(!manage)manage=qaGroup('',qaRow({label:qaT('Konto verwalten','Manage account'),action:"qaSection('manage')",chevron:true,cls:'dsaction'}));
  let shell=typeof window!=='undefined'&&window.webkit?.messageHandlers?.pulsNative&&typeof pulsNativeExtrasOpen==='function';
  let native=shell?qaGroup('iPhone',qaRow({label:qaT('Erinnerungen & Apple Health','Reminders & Apple Health'),icon:'heartbeat',action:'pulsNativeExtrasOpen()',chevron:true})):'';
  return qaGroup(qaT('Profil','Profile'),profile)+manage+native;
}

/* ---------- Unterseite Profil ---------- */
function qaProfileBody(){
  let p=state.profile||{},w=typeof currentWeight==='function'?currentWeight():null,h=p.height;
  let bmi=Number.isFinite(w)&&Number.isFinite(h)&&h>0?w/(h/100)**2:null,bf=null;
  try{if(typeof currentBodyFat==='function')bf=currentBodyFat()}catch{}
  let value=(x,unit='')=>Number.isFinite(x)?qaNum(x)+unit:'–';
  let rows=[
    qaRow({label:qaT('Alter','Age'),value:value(p.age),action:"qaEdit('age')",chevron:true}),
    qaRow({label:qaT('Geschlecht','Sex'),value:qaSexLabel(p.sex),action:"qaEdit('sex')",chevron:true}),
    qaRow({label:qaT('Größe','Height'),value:value(h,' cm'),action:"qaEdit('height')",chevron:true}),
    qaRow({label:qaT('Gewicht','Weight'),value:value(w,' kg'),action:"qaEdit('weight')",chevron:true}),
    qaRow({label:qaT('Zielgewicht','Target weight'),value:value(p.target,' kg'),action:"qaEdit('target')",chevron:true}),
    qaRow({label:qaT('Body-Mass-Index (BMI)','Body mass index (BMI)'),value:bmi===null?'–':qaNum(Math.round(bmi*10)/10)}),
    qaRow({label:qaT('Körperfett','Body fat'),value:bf?qaNum(Math.round(bf.value*10)/10)+' %':'–',action:'measurementsForm()',chevron:true})
  ].join('');
  let body=[
    qaRow({label:qaT('Gewichtsverlauf & Wochenmittel','Weight trend & weekly average'),icon:'chart-line-up',action:"qaSection('body')",chevron:true}),
    qaRow({label:qaT('Körpermaße & Biometrie','Body measurements & biometrics'),icon:'ruler',action:'measurementsForm()',chevron:true}),
    qaRow({label:qaT('Gewicht erfassen','Log weight'),icon:'scales',action:'weightForm()',chevron:true,cls:'dsaction'})
  ].join('');
  let full=typeof settings==='function'?`<button type="button" class="btn full qafullsetup" onclick="qaFullSetup()"><span aria-hidden="true">${qaIcon('pencil-simple')}</span><span>${qaT('Alles eintragen','Fill in everything')}</span></button>`:'';
  return full+qaGroup('',rows,'qaprofile')+qaGroup(qaT('Körper & Entwicklung','Body & progress'),body);
}
// v92: öffnet denselben Profil-&-Ziele-Bogen wie der Erststart (settings → profileForm), vorausgefüllt aus state.
// Ohne setupPending: Schließen verwirft alle Eingaben, nur „Speichern“ übernimmt sie über die bestehende commitProfile-Kette.
function qaFullSetup(){if(typeof settings==='function')settings()}
// experience.js ersetzt das Geschlecht im Planer durch ein verstecktes Feld „male“ und blendet „special“ aus.
// Gespeicherte Werte vorbelegen, damit Speichern im vollen Bogen sie nicht überschreibt; neue Profile bleiben beim bisherigen Standard.
if(typeof profileForm==='function'){
  globalThis.profileFormAfterQuickAccount=function profileFormAfterQuickAccount(){
    try{
      let sex=document.getElementById('pr-sex'),saved=state.profile?.sex;
      if(sex&&sex.type==='hidden'&&['male','female'].includes(saved))sex.value=saved;
      let special=document.getElementById('pr-special');if(special&&special.hidden)special.checked=state.profile?.special===true;
      // Die Vorschau wurde in der Basis schon mit „male“ berechnet; mit den gespeicherten Werten neu rechnen.
      if(document.getElementById('plan-preview')&&typeof updatePlanPreview==='function')updatePlanPreview();
    }catch(error){console.error(error)}
  };
}

/* Small sheets use the existing planner's inputs and complete commit chain.
   Related labels are moved together out of the hidden backing form. No draft is
   written to state, and closing the sheet discards all unsaved inputs. */
const qaFields={
  age:['pr-age','Alter','Age'],sex:['pr-sex','Geschlecht','Sex'],height:['pr-height','Größe','Height'],
  weight:['pr-weight','Gewicht','Weight'],target:['pr-target','Zielgewicht','Target weight'],
  kcal:['manual-kcal','Kalorienziel','Calorie target'],mode:['pl-mode','Modus','Mode'],
  direction:['pl-direction','Richtung','Direction'],pace:['pl-pace','Zieltempo','Goal pace'],
  macroMode:['pl-macros','Makro-Modus','Macro mode'],protein:['pl-protein','Protein pro kg','Protein per kg'],
  fat:['pl-fat','Fett pro kg','Fat per kg'],p:['manual-p','Protein','Protein'],c:['manual-c','Kohlenhydrate','Carbohydrates'],f:['manual-f','Fett','Fat'],
  method:['pr-method','Ruheumsatz','Resting energy'],rmr:['pr-rmr','Gemessener Ruheumsatz','Measured resting energy'],
  activity:['pr-activity','Aktivität','Activity'],kcalMode:['pr-kcal-mode','Kalorienberechnung','Energy calculation'],
  baseline:['pr-baseline-factor','Alltag ohne Sport','Daily activity'],adaptive:['pl-adaptive','Gewichtsanpassung','Weight adaptation']
};
let qaEditKey='';
function qaEdit(key){
  if(key==='direction')key='target';
  let config=qaFields[key];if(!config)return;
  qaEditKey=key;
  openModal(qaT(config[1],config[2]),`<div id="profile-form" hidden inert></div><form class="qaedit" id="qa-edit-form" onsubmit="qaSubmitEdit(event)"><div id="qa-edit-fields"></div><p id="qa-edit-preview" class="note" role="status"></p><button class="btn full" type="submit">${qaT('Speichern','Save')}</button></form>`);
  profileForm();
  // experience.js replaces sex with a fixed male hidden input. Restore the
  // actual saved parameter for every small sheet, including unrelated edits.
  let sex=document.getElementById('pr-sex');
  if(sex)sex.outerHTML=`<label>${qaT('Geschlecht','Sex')}<select id="pr-sex">${state.profile?'':`<option value="" selected>${qaT('Auswählen','Choose')}</option>`}<option value="female" ${state.profile?.sex==='female'?'selected':''}>${qaT('Weiblich','Female')}</option><option value="male" ${state.profile?.sex==='male'?'selected':''}>${qaT('Männlich','Male')}</option></select></label>`;
  let special=document.getElementById('pr-special');if(special)special.checked=state.profile?.special===true;
  qaMountEditField(key);
  document.getElementById('qa-edit-form').addEventListener('input',qaEditPreview);
}
function qaMountEditField(key){
  let config=qaFields[key];if(!config)return;qaEditKey=key;
  document.getElementById('mt').textContent=qaT(config[1],config[2]);
  let fields=document.getElementById('qa-edit-fields'),backing=document.getElementById('planner-form');
  // A previously skipped empty profile is completed one field at a time in
  // this same unsaved form. It is committed only once the full profile is valid.
  for(let label of fields.querySelectorAll(':scope > label'))backing.append(label);
  let input=document.getElementById(config[0]),label=input?.closest('label');
  if(!label||!fields)return;
  // The backing planner may disable controls that are inactive in its current mode.
  if(key==='kcal')document.getElementById('pl-mode').value='manual';
  if(key==='pace')document.getElementById('pl-mode').value='auto';
  if(['p','c','f'].includes(key))document.getElementById('pl-macros').value='manual';
  if(['protein','fat'].includes(key))document.getElementById('pl-macros').value='auto';
  if(key==='rmr')document.getElementById('pr-method').value='measured';
  let keys=key==='target'?['direction','target']:key==='method'?['method','rmr']:[key];
  for(let fieldKey of keys)qaExposeEditField(fieldKey,fields);
  let error=document.getElementById('plan-error');if(error){error.setAttribute('role','alert');fields.after(error)}
  qaEditPreview();input.focus({preventScroll:true});
}
function qaExposeEditField(key,fields){
  let input=document.getElementById(qaFields[key][0]),label=input.closest('label');
  input.disabled=false;label.hidden=false;label.classList.remove('profileoff');
  label.querySelectorAll('.segmented').forEach(el=>el.remove());
  input.classList.remove('segsource');input.removeAttribute('aria-hidden');input.removeAttribute('tabindex');
  if(input.tagName==='INPUT'&&input.type==='number'){input.type='text';input.inputMode=key==='age'?'numeric':'decimal'}
  fields.append(label);
}
function qaEditNumbers(){
  for(let id of ['pr-age','pr-height','pr-weight','pr-target','pr-rmr','manual-kcal','manual-p','manual-c','manual-f','pl-protein','pl-fat']){
    let input=document.getElementById(id);if(input)input.value=input.value.replace(',','.');
  }
  // Keep the current calorie budget when editing one macro; show the balancing
  // macro before saving. A calorie edit keeps the current energy proportions.
  let key=qaEditKey,g=state.goals||{},read=id=>Number(document.getElementById(id)?.value);
  if(key==='kcal'){
    let kcal=read('manual-kcal'),r=qaRatioValid(state.plan?.ratio)&&state.plan?.macroInput==='ratio'?state.plan.ratio:qaRatioFromGoals(g);
    let grams=state.plan?.macroInput==='ratio'&&qaRatioValid(state.plan.ratio)?g:qaGramsFromRatio(kcal,r);for(let k of ['p','c','f'])document.getElementById('manual-'+k).value=grams[k];
  }else if(['p','c','f'].includes(key)){
    let grams={p:g.p,c:g.c,f:g.f,[key]:read('manual-'+key)},balance=key==='c'?'f':'c';
    let kcal=state.plan?.mode==='auto'?planNumbers(collectProfile(),collectPlan(),g).kcal:g.kcal;
    grams[balance]=Math.round((kcal-Object.entries(grams).filter(([k])=>k!==balance).reduce((sum,[k,v])=>sum+v*(k==='f'?9:4),0))/(balance==='f'?9:4)*10)/10;
    for(let k of ['p','c','f'])if(k!==key)document.getElementById('manual-'+k).value=grams[k];
  }
}
function qaEditPreview(){
  qaEditNumbers();let out=document.getElementById('qa-edit-preview');if(!out)return;
  if(qaEditKey==='method'){
    let rmr=document.getElementById('pr-rmr'),measured=document.getElementById('pr-method').value==='measured';
    rmr.closest('label').hidden=!measured;rmr.disabled=!measured;
  }
  let button=document.querySelector('#qa-edit-form button[type=submit]');
  if(button)button.textContent=!state.profile&&['age','sex','height','weight','target'].some(key=>key!==qaEditKey&&!document.getElementById(qaFields[key][0])?.value.trim())?qaT('Weiter','Continue'):qaT('Speichern','Save');
  if(['kcal','p','c','f'].includes(qaEditKey)){
    let m=collectManual();out.textContent=`P ${qaNum(m.p)} g · ${qaT('KH','C')} ${qaNum(m.c)} g · F ${qaNum(m.f)} g`;
  }else out.textContent='';
}
function qaSubmitEdit(event){
  event.preventDefault();qaEditNumbers();
  let input=document.getElementById(qaFields[qaEditKey]?.[0]),raw=input?.value?.trim();
  if(input?.tagName==='INPUT'&&input.type==='text'&&(!raw||!Number.isFinite(Number(raw))||(qaEditKey==='age'&&!Number.isInteger(Number(raw))))){
    document.getElementById('plan-error').textContent=qaT('Bitte einen gültigen Wert eingeben.','Enter a valid value.');return false;
  }
  if(!state.profile&&['age','sex','height','weight','target'].includes(qaEditKey)){
    let bounds={age:[18,100],height:[120,230],weight:[30,300],target:[30,300]},valid=key=>{let value=document.getElementById(qaFields[key][0]).value.trim();return key==='sex'?['male','female'].includes(value):value!==''&&Number.isFinite(Number(value))&&Number(value)>=bounds[key][0]&&Number(value)<=bounds[key][1]&&(key!=='age'||Number.isInteger(Number(value)))};
    if(!valid(qaEditKey)){document.getElementById('plan-error').textContent=qaT('Bitte einen gültigen Wert eingeben.','Enter a valid value.');return false}
    let next=['age','sex','height','weight','target'].find(key=>!valid(key));
    if(next){document.getElementById('plan-error').textContent='';qaMountEditField(next);return false}
  }
  if(qaEditKey==='target'){
    let target=Number(document.getElementById('pr-target').value),weight=Number(document.getElementById('pr-weight').value),direction=document.getElementById('pl-direction').value;
    if((direction==='maintain'&&target!==weight)||(direction==='lose'&&target>=weight)||(direction==='gain'&&target<=weight)){
      document.getElementById('plan-error').textContent=qaT('Zielgewicht und Zielrichtung passen nicht zusammen.','Target weight and direction do not match.');return false;
    }
  }
  return commitProfile(event);
}

/* ---------- Unterseite Ziele ---------- */
const qaDirectionNames={lose:['Abnehmen','Lose'],maintain:['Halten','Maintain'],gain:['Aufbauen','Build']};
function qaName(map,key){let x=map[key];return x?qaT(x[0],x[1]):'–'}
// Prozentanteile der Makroenergie, auf ganze Zahlen mit Summe 100 gebracht (nur Vorbelegung, keine Speicherung).
function qaRatioFromGoals(g){
  let e={p:(+g?.p||0)*4,c:(+g?.c||0)*4,f:(+g?.f||0)*9},sum=e.p+e.c+e.f;
  if(!(sum>0))return {p:30,c:40,f:30};
  let r={p:Math.round(e.p/sum*100),f:Math.round(e.f/sum*100)};
  r.p=Math.min(80,Math.max(5,r.p));r.f=Math.min(80,Math.max(5,r.f));r.c=100-r.p-r.f;
  if(r.c<5){let over=5-r.c;r.c=5;if(r.p>=r.f)r.p-=over;else r.f-=over}
  if(r.c>80){let over=r.c-80;r.c=80;r.p+=over}
  return r;
}
function qaRatioValid(r){return qaObj(r)&&['p','c','f'].every(k=>Number.isInteger(r[k])&&r[k]>=5&&r[k]<=80)&&r.p+r.c+r.f===100}
// Gramm aus Kalorien und Verhältnis: Protein und Kohlenhydrate 4 kcal/g, Fett 9 kcal/g.
function qaGramsFromRatio(kcal,r){return {p:Math.round(kcal*r.p/100/4),c:Math.round(kcal*r.c/100/4),f:Math.round(kcal*r.f/100/9)}}
function qaMacroEditor(){
  let plan=state.plan||{},g=state.goals||{},ratio=plan.macroInput==='ratio'&&qaRatioValid(plan.ratio),open=ratio||qaRatioOpen,r=qaRatioValid(plan.ratio)?plan.ratio:qaRatioFromGoals(g);
  let seg=`<div class="segmented qaseg" role="group" aria-label="${qaT('Makro-Eingabe','Macro input')}" data-motion-indicator><button type="button" aria-pressed="${!open}" onclick="qaMacroInput('grams',this)">${qaT('Gramm','Grams')}</button><button type="button" aria-pressed="${open}" onclick="qaMacroInput('ratio',this)">${qaT('Verhältnis','Ratio')}</button></div>`;
  let input=(k,label)=>`<label class="qaratiofield">${label}<span class="qaratioinput"><input id="qa-ratio-${k}" type="number" inputmode="numeric" min="5" max="80" step="1" required value="${r[k]}" oninput="qaRatioPreview()"><span aria-hidden="true">%</span></span></label>`;
  let form=`<form class="qaratio" id="qa-ratio-form" onsubmit="qaSaveRatio(event)" ${open?'':'hidden'}><div class="qaratiogrid">${input('p',qaT('Protein','Protein'))}${input('c',qaT('Kohlenh.','Carbs'))}${input('f',qaT('Fett','Fat'))}</div><p class="note" id="qa-ratio-preview" role="status"></p><button type="submit" class="btn full">${qaT('Verhältnis übernehmen','Apply ratio')}</button></form>`;
  let grams=`<div id="qa-grams-edit" ${open?'hidden':''}>${qaGroup('',qaRow({label:qaT('Gramm bearbeiten','Edit grams'),action:"qaEdit('p')",chevron:true,cls:'dsaction'}))}</div>`;
  return `<div class="qamacroedit">${seg}${form}${grams}</div>`;
}
function qaWaterGroup(){
  let w=qaWater(),rec=null;try{rec=window.pulsData87?.waterRecommendation?.()}catch{}
  let goal=rec&&Number.isFinite(rec.ml)?qaNum(rec.ml)+' ml':'–',mode=w.mode==='manual'?qaT('Eigenes Ziel','Custom'):rec?.mode==='standard'?qaT('Standard ohne Gewicht','Default without weight'):qaT('Automatisch','Automatic');
  let action="qaWaterSheet('goal')";
  return qaGroup(qaT('Wasser','Water'),qaRow({label:qaT('Wasserziel','Water target'),detail:esc(mode),value:goal,icon:'drop',action,chevron:true})+qaRow({label:qaT('Glasgröße','Glass size'),value:qaNum(w.glassMl)+' ml',action:"qaWaterSheet('glass')",chevron:true}));
}
function qaWaterSheet(key){
  let w=qaWater(),glass=key==='glass',rec=window.pulsData87?.waterRecommendation?.();
  openModal(glass?qaT('Glasgröße','Glass size'):qaT('Wasserziel','Water target'),`<form class="qaedit" onsubmit="qaSaveWater(event,'${glass?'glass':'goal'}')">${glass?'':`<label>${qaT('Modus','Mode')}<select id="qa-water-mode" onchange="document.getElementById('qa-water-value-row').hidden=this.value==='auto'"><option value="auto" ${w.mode!=='manual'?'selected':''}>${qaT('Automatisch','Automatic')}</option><option value="manual" ${w.mode==='manual'?'selected':''}>${qaT('Eigenes Ziel','Custom')}</option></select></label>`}<label id="qa-water-value-row" ${!glass&&w.mode!=='manual'?'hidden':''}>${qaT(glass?'Glasgröße · ml':'Tagesziel · ml',glass?'Glass size · ml':'Daily target · ml')}<input id="qa-water-value" type="text" inputmode="numeric" value="${glass?w.glassMl:state.waterGoal||rec?.ml||2000}"></label><button class="btn full">${qaT('Speichern','Save')}</button></form>`);
}
function qaSaveWater(event,key){
  event.preventDefault();let raw=document.getElementById('qa-water-value').value.trim(),v=Number(raw),mode=document.getElementById('qa-water-mode')?.value;
  if((key==='glass'||mode==='manual')&&(!raw||!Number.isInteger(v)||v<(key==='glass'?100:500)||v>(key==='glass'?1000:10000))){toast(qaT('Bitte einen gültigen Wert eingeben.','Enter a valid value.'));return false}
  let w=qaEnsure('water');if(key==='glass')w.glassMl=v;else{w.mode=mode==='manual'?'manual':'auto';state.waterGoal=mode==='manual'?v:0}
  save();modal.close();render();qaSound('save');return true;
}
function qaHighlightGroup(){
  if(typeof nutrientLabels!=='object')return '';
  let list=qaDisplay().highlighted||[],full=list.length>=qaHighlightMax;
  let chips=Object.entries(nutrientLabels).map(([key,[label]])=>{let on=list.includes(key);return `<button type="button" class="qachip" data-qa-nutrient="${esc(key)}" aria-pressed="${on}" ${!on&&full?'aria-disabled="true"':''} onclick="qaHighlight('${esc(key)}',this)">${esc(label)}</button>`}).join('');
  return `<h2 class="dsgrouptitle">${qaT('Hervorgehobene Nährstoffe','Highlighted nutrients')}</h2><section class="dsgroup qachips" role="group" aria-label="${qaT('Hervorgehobene Nährstoffe','Highlighted nutrients')}">${chips}</section><p class="dsgroupfoot" id="qa-highlight-count" role="status">${qaHighlightNote(list.length)}</p>`;
}
function qaHighlightNote(count){return `${count} / ${qaHighlightMax}`}
function qaTargetRow(key,label,value){return qaRow({label,value,action:`qaEdit('${key}')`,chevron:true})}
function qaForecast(){
  let p=state.profile,w=currentWeight();if(!p||profileError(p)||!Number.isFinite(w)||p.special)return '–';
  let days=forecastDays(w,p.target,energyFor(p,w,state.plan,today()).tdee,qaGoals().kcal);
  return days===null?'–':days===0?qaT('Erreicht','Reached'):dateAfter(days);
}
function qaPaceValue(plan=state.plan){
  let p=state.profile;if(!p||profileError(p))return '–';
  let x=planNumbers({...p,weight:currentWeight()}, {...plan,mode:'auto'},state.goals);
  return Number.isFinite(x.change)?(x.change>0?'+':x.change<0?'−':'')+qaNum(Math.round(Math.abs(x.change)*100))+' %':'–';
}
function qaTargetsBody(){
  let p=state.profile||{},plan=state.plan||{},g=qaGoals(),base=state.goals||{},e=null;
  try{if(state.profile&&!profileError(p))e=energyFor(p,currentWeight(),plan,today())}catch{}
  let row=qaTargetRow;
  let energy=row('kcal',qaT('Kalorienziel','Calorie target'),qaNum(base.kcal)+' kcal')
    +row('mode',qaT('Modus','Mode'),plan.mode==='auto'?qaT('Berechnet','Calculated'):qaT('Selbst','Custom'))
    +row('direction',qaT('Richtung','Direction'),qaName(qaDirectionNames,plan.direction))
    +row('pace',qaT('Zieltempo','Goal pace'),qaPaceValue(plan))
    +row('target',qaT('Zielgewicht','Target weight'),Number.isFinite(p.target)?qaNum(p.target)+' kg':'–')
    +qaRow({label:qaT('Prognose','Forecast'),value:qaForecast(),action:'qaForecastSheet()',chevron:true})
    +row('kcalMode',qaT('Kalorienberechnung','Energy calculation'),p.kcalMode==='baseline'?qaT('Grundbedarf + Sport','Baseline + exercise'):qaT('Klassisch','Classic'))
    +row('method',qaT('Ruheumsatz','Resting energy'),e?qaNum(Math.round(e.rmr))+' kcal':'–')
    +(p.method==='measured'?row('rmr',qaT('Gemessener Ruheumsatz','Measured resting energy'),qaNum(p.rmr)+' kcal'):'')
    +(p.kcalMode==='baseline'?row('baseline',qaT('Alltag ohne Sport','Daily activity'),qaNum(p.baselineFactor||1.2)):row('activity',qaT('Aktivität','Activity'),Number.isFinite(p.activity)?qaNum(p.activity):'–'))
    +row('adaptive',qaT('Gewichtsanpassung','Weight adaptation'),plan.adaptive===false?qaT('Aus','Off'):qaT('An','On'));
  let macros=row('macroMode',qaT('Modus','Mode'),qaManualMacros(plan)?qaT('Selbst','Custom'):qaT('Pro kg','Per kg'))
    +qaRow({label:qaT('Gramm / Verhältnis','Grams / ratio'),value:plan.macroInput==='ratio'&&qaRatioValid(plan.ratio)?['p','c','f'].map(k=>plan.ratio[k]).join(' / ')+' %':qaT('Gramm','Grams'),action:'qaRatioSheet()',chevron:true})
    +['p','c','f'].map((k,i)=>row(k,[qaT('Protein','Protein'),qaT('Kohlenhydrate','Carbohydrates'),qaT('Fett','Fat')][i],qaNum(base[k])+' g')).join('');
  if(!qaManualMacros(plan))macros+=row('protein',qaT('Protein pro kg','Protein per kg'),qaNum(plan.protein)+' g')+row('fat',qaT('Fett pro kg','Fat per kg'),qaNum(plan.fat)+' g');
  let nutrients=Object.entries(typeof nutrientLabels==='object'?nutrientLabels:{}).map(([key,[label,unit]])=>qaRow({label:esc(label),value:Number.isFinite(state.microGoals?.[key])?qaNum(state.microGoals[key])+' '+esc(unit):'–',action:`qaNutrientSheet('${key}')`,chevron:true})).join('');
  let highlighted=(qaDisplay().highlighted||[]).length;
  let adaptive=typeof accountSections!=='undefined'&&accountSections.some(x=>x.key==='adaptive')?qaGroup('',qaRow({label:qaT('Adaptiver Erhalt','Adaptive maintenance'),value:e?qaNum(Math.round(e.tdee))+' kcal':'–',action:"qaSection('adaptive')",chevron:true})):'';
  return qaGroup(qaT('Energie','Energy'),energy)+qaGroup(qaT('Makros','Macros'),macros,'qamacros')+qaWaterGroup()+qaGroup(qaT('Nährstoffziele','Nutrient targets'),nutrients)+qaGroup('',qaRow({label:qaT('Hervorgehobene Nährstoffe','Highlighted nutrients'),value:highlighted+' / '+qaHighlightMax,action:'qaHighlightSheet()',chevron:true}))+adaptive;
}
function qaForecastSheet(){openModal(qaT('Prognose','Forecast'),qaGroup('',qaRow({label:qaT('Zielgewicht','Target weight'),value:Number.isFinite(state.profile?.target)?qaNum(state.profile.target)+' kg':'–',action:"qaEdit('target')",chevron:true})+qaRow({label:qaT('Datum','Date'),value:qaForecast()})))}
function qaRatioSheet(){qaRatioOpen=true;openModal(qaT('Makro-Verhältnis','Macro ratio'),qaMacroEditor());qaRatioPreview()}
function qaHighlightSheet(){openModal(qaT('Hervorgehobene Nährstoffe','Highlighted nutrients'),qaHighlightGroup())}
function qaNutrientSheet(key){
  if(!Object.hasOwn(nutrientLabels,key))return;
  microTargetForm();let input=document.getElementById('micro-'+key),form=input?.closest('form');if(!form)return;
  form.classList.add('qaedit');form.querySelectorAll('label').forEach(label=>{label.hidden=label!==input.closest('label')});form.querySelectorAll('.note').forEach(el=>el.remove());
  input.type='text';input.inputMode='decimal';
  form.onsubmit=event=>{event.preventDefault();let raw=input.value.trim().replace(',','.');if(raw&&!Number.isFinite(Number(raw))){toast(qaT('Bitte einen gültigen Wert eingeben.','Enter a valid value.'));return}input.value=raw;saveMicroTargets(event)};
  document.getElementById('mt').textContent=nutrientLabels[key][0];input.focus({preventScroll:true});
}

/* ---------- Unterseite Darstellung ---------- */
function qaSwitch(id,label,checked,handler,detail=''){return `<label class="dsrow qaswitchrow" for="${id}"><span class="dsrowtext"><span>${label}</span>${detail?`<small>${detail}</small>`:''}</span><input id="${id}" class="qaswitch" type="checkbox" role="switch" ${checked?'checked':''} onchange="${handler}"></label>`}
function qaSeg(group,options,current,label){return `<div class="segmented qaseg" role="group" aria-label="${label}" data-motion-indicator>${options.map(([value,text])=>`<button type="button" data-qa-value="${value}" aria-pressed="${value===current}" onclick="qaSetSeg('${group}','${value}',this)">${text}</button>`).join('')}</div>`}
function qaViewOrder(){let d=qaDisplay(),on=(d.summaryViews||[]).filter(k=>qaViewKeys.includes(k));return {on,list:[...on,...qaViewKeys.filter(k=>!on.includes(k))]}}
function qaViewName(key){return ({macros:qaT('Makro-Ziele','Macro targets'),energy:qaT('Energie','Energy'),micros:qaT('Mikronährstoffe','Micronutrients'),week:qaT('Wochenschnitt','Weekly average')})[key]||key}
function qaViewsGroup(){
  let {on,list}=qaViewOrder();
  let fixed=`<div class="dsrow qaviewrow" data-flip-id="view-macros"><span class="dsrowtext"><span>${qaViewName('macros')}</span><small>${qaT('Immer an erster Stelle','Always first')}</small></span></div>`;
  let rows=list.map(key=>{let active=on.includes(key),i=on.indexOf(key);return `<div class="dsrow qaviewrow" data-flip-id="view-${key}"><span class="dsrowtext"><span>${qaViewName(key)}</span></span>${active?`<span class="qamove"><button type="button" class="qaicon" aria-label="${qaViewName(key)} ${qaT('nach oben','up')}" ${i===0?'disabled':''} onclick="qaViewMove('${key}',-1)">${qaIcon('caret-up')}</button><button type="button" class="qaicon" aria-label="${qaViewName(key)} ${qaT('nach unten','down')}" ${i===on.length-1?'disabled':''} onclick="qaViewMove('${key}',1)">${qaIcon('caret-down')}</button></span>`:''}<input class="qaswitch" type="checkbox" role="switch" aria-label="${qaViewName(key)}" ${active?'checked':''} onchange="qaViewToggle('${key}',this.checked)"></div>`}).join('');
  return qaGroup(qaT('Folien der Tagesübersicht','Daily summary slides'),fixed+rows,'qaviews');
}
// v89: zwei zusätzliche Farbstile (color-scheme.js), als Auswahlliste unter System/Hell/Dunkel.
function qaPaletteGroup(scheme){
  let row=(key,label)=>`<button type="button" class="dsrow dsiconrow qapalette" data-qa-palette="${key}" aria-pressed="${scheme===key}" onclick="qaSetPalette('${key}')"><span class="dsrowicon qaswatch qaswatch-${key}" aria-hidden="true"></span><span class="dsrowtext"><span>${label}</span></span>${scheme===key?`<span class="dsrowvalue qapalettecheck" aria-hidden="true">${qaIcon('check')}</span>`:''}</button>`;
  return `<section class="dsgroup qapalettes" role="group" aria-label="${qaT('Farbstil','Colour style')}">${row('fresh',qaT('Frisch','Fresh'))}${row('midnight',qaT('Mitternacht','Midnight'))}</section>`;
}
function qaSetPalette(mode){if(['fresh','midnight'].includes(mode)&&typeof setColorScheme==='function'){setColorScheme(mode);qaSound('toggle')}}
function qaDisplayBody(){
  let d=qaDisplay(),scheme='system';try{if(typeof getColorScheme==='function')scheme=getColorScheme()}catch{}
  let appearance=`<h2 class="dsgrouptitle">${qaT('Farbschema','Colour scheme')}</h2>${qaSeg('scheme',[['system',qaT('System','System')],['light',qaT('Hell','Light')],['dark',qaT('Dunkel','Dark')]],scheme,qaT('Farbschema','Colour scheme'))}`+qaPaletteGroup(scheme);
  let language=qaGroup('',qaRow({label:qaT('Sprache & App-Icon','Language & app icon'),detail:state.language==='en'?'English':'Deutsch',icon:'text-aa',action:"qaSection('design')",chevron:true}));
  let remaining=`<h2 class="dsgrouptitle">${qaT('Kalorien anzeigen als','Show calories as')}</h2>${qaSeg('remaining',[['eaten',qaT('Gegessen','Eaten')],['remaining',qaT('Übrig','Remaining')]],d.showRemaining?'remaining':'eaten',qaT('Kalorien anzeigen als','Show calories as'))}`;
  let volume=state.soundVolume??35;
  let feedback=qaSwitch('qa-sound',qaT('Klänge','Sounds'),state.soundEnabled!==false,'qaSetSwitch(\'sound\',this.checked)')
    +`<label class="dsrow qavolume"><span class="dsrowtext"><span>${qaT('Lautstärke','Volume')}</span></span><input type="range" min="0" max="70" step="5" value="${volume}" aria-label="${qaT('Lautstärke','Volume')}" oninput="qaVolume(this.value)" onchange="typeof testPulsSound==='function'&&testPulsSound()"></label>`
    +(typeof testPulsSound==='function'?qaRow({label:qaT('Probehören','Preview'),icon:'speaker-high',action:'testPulsSound()',cls:'dsaction'}):'')
    +qaSwitch('qa-haptics',qaT('Haptik','Haptics'),d.hapticsEnabled!==false,'qaSetSwitch(\'haptics\',this.checked)');
  let motion=`<h2 class="dsgrouptitle">${qaT('Bewegung','Motion')}</h2>${qaSeg('motion',[['system',qaT('Wie System','Like system')],['reduced',qaT('Reduziert','Reduced')]],d.motion==='reduced'?'reduced':'system',qaT('Bewegung','Motion'))}`;
  return appearance+language+qaViewsGroup()+remaining+qaGroup(qaT('Klänge & Haptik','Sounds & haptics'),feedback,'qafeedback')+motion;
}

/* ---------- Navigation ---------- */
function qaOpen(key){
  if(!qaPages[key])return;
  qaPage=key;qaParent='';qaRatioOpen=false;qaAnimate='push';
  render();window.scrollTo(0,0);document.getElementById('account-section-title')?.focus({preventScroll:true});
}
function qaBack(){
  let from=qaPage,el=document.querySelector('#content .qadetail');
  let done=()=>{if(qaPage!==from)return;qaPage='';qaRatioOpen=false;render();window.scrollTo(0,0);document.getElementById('qa-link-'+from)?.focus({preventScroll:true})};
  let motion=qaMotion();if(el&&motion?.pop&&!(typeof edgeBack!=='undefined'&&edgeBack.completing))motion.pop(el,done);else done();
}
// Bestehender Bereich aus einer Unterseite heraus: Zurück führt wieder zur Unterseite.
function qaSection(key){
  if(typeof openAccountSection!=='function')return;
  qaParent=qaPage;qaAnimate='push';openAccountSection(key);
  if(typeof accountSection==='undefined'||!accountSection){qaParent='';qaAnimate=''}
}

if(typeof closeAccountSection==='function'){
  const qaCloseBase=closeAccountSection;
  closeAccountSection=function(...args){
    let parent=qaPages[qaParent]?qaParent:'',el=document.querySelector('#content .accountdetail'),motion=qaMotion();
    let done=()=>{
      if(!parent){qaParent='';return qaCloseBase.apply(this,args)}
      let previous=accountSection;qaParent='';accountSection='';qaPage=parent;render();window.scrollTo(0,0);
      (document.getElementById('account-link-'+previous)||document.getElementById('account-section-title'))?.focus({preventScroll:true});
    };
    if(el&&motion?.pop&&!motion.reduced()&&!(typeof edgeBack!=='undefined'&&edgeBack.completing))motion.pop(el,done);else done();
  };
}
if(typeof go==='function'){globalThis.goBeforeQuickAccount=function goBeforeQuickAccount(next){let before=typeof page!=='undefined'?page:'';qaPage='';qaParent='';qaRatioOpen=false;if(next==='account'&&before!=='account')qaAnimate='list'}}

if(typeof accountPage==='function'){
  globalThis.accountPageAfterQuickAccount=function accountPageAfterQuickAccount(html){
    if(typeof accountSection!=='undefined'&&accountSection){
      if(qaPages[qaParent])html=html.replace(/(<button type="button" class="accountback"[^>]*>[\s\S]*?<span>)Konto(<\/span>)/,`$1${esc(qaPageTitle(qaParent))}$2`);
      if(accountSection==='body')html=html.replace(/<button class="textbtn" onclick="measurementsForm\(\)">Körpermaße erfassen<\/button><button class="textbtn" onclick="measurementsForm\(\)">Biometrie<\/button>/,'<button class="textbtn" onclick="measurementsForm()">'+qaT('Körpermaße & Biometrie','Body measurements & biometrics')+'</button>');
      return html;
    }
    if(qaPages[qaPage])return qaDetail(qaPage);
    let template=document.createElement('template');template.innerHTML=html;
    return qaOverview(template);
  };
}
// Nach dem Zeichnen: Seitentitel bei Unterseiten ausblenden, Push und gestaffelte Liste nur nach Navigation.
if(typeof render==='function'){
  globalThis.renderAfterQuickAccount=function renderAfterQuickAccount(){
    try{
      let title=document.getElementById('title');if(title&&typeof page!=='undefined'&&page==='account'&&qaPage)title.hidden=true;
      if(qaAnimate&&typeof page!=='undefined'&&page==='account'){
        let kind=qaAnimate,motion=qaMotion(),root=document.querySelector('#content .qapage, #content .accountdetail');qaAnimate='';
        if(root&&motion&&!motion.reduced()){
          if(kind==='push')motion.push(root);
          let items=kind==='push'?root.querySelectorAll(':scope .accountdetailcontent > *'):root.querySelectorAll(':scope > .dsgroup:not(nav), :scope > nav.dsgroup > .dsrow');
          items.forEach((el,i)=>{if(i<14){el.style.setProperty('--motion-i',String(Math.min(i,10)));motion.enter(el)}});
        }
      }
    }catch(error){console.error(error)}
  };
}

/* ---------- Einstellungen speichern ---------- */
function qaSetSwitch(kind,checked){
  checked=!!checked;
  if(kind==='sound'){
    if(!checked)qaSound('toggleOff');
    state.soundEnabled=checked;save();
    if(checked){if(typeof unlockPulsAudio==='function')unlockPulsAudio();qaSound('toggle')}
  }else if(kind==='haptics'){
    let d=qaEnsure('display');d.hapticsEnabled=checked;save();qaSound(checked?'toggle':'toggleOff');
  }
}
function qaVolume(value){let v=Math.round(Number(value));if(Number.isFinite(v)&&v>=0&&v<=70){state.soundVolume=v;save()}}
function qaPress(button){button?.parentElement?.querySelectorAll(':scope > button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));try{qaMotion()?.indicator?.(button?.parentElement)}catch{}}
function qaSetSeg(group,value,button){
  if(group==='scheme'){if(!['system','light','dark'].includes(value)||typeof setColorScheme!=='function')return;setColorScheme(value)}
  else if(group==='remaining'){let d=qaEnsure('display'),next=value==='remaining';if(d.showRemaining!==next){d.showRemaining=next;save()}}
  else if(group==='motion'){
    if(!['system','reduced'].includes(value))return;let d=qaEnsure('display');d.motion=value;save();
    try{document.documentElement.classList.toggle('reduce-motion',value==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches)}catch{}
  }else return;
  qaPress(button);qaSound('toggle');
}
function qaViewsSave(list){let d=qaEnsure('display');d.summaryViews=[...new Set(list)].filter(k=>qaViewKeys.includes(k));save()}
function qaRerender(){let motion=qaMotion(),y=window.scrollY;if(motion?.flip)motion.flip(()=>render());else render();window.scrollTo(0,y)}
function qaViewToggle(key,checked){
  if(!qaViewKeys.includes(key))return;let {on}=qaViewOrder();
  qaViewsSave(checked?[...on,key]:on.filter(k=>k!==key));qaSound(checked?'toggle':'toggleOff');qaRerender();
}
function qaViewMove(key,dir){
  let {on}=qaViewOrder(),i=on.indexOf(key),j=i+dir;if(i<0||j<0||j>=on.length)return;
  [on[i],on[j]]=[on[j],on[i]];qaViewsSave(on);qaRerender();
  document.querySelector(`[data-flip-id="view-${key}"] button[aria-label$="${dir<0?qaT('nach oben','up'):qaT('nach unten','down')}"]:not([disabled])`)?.focus({preventScroll:true});
}
function qaHighlight(key,button){
  if(typeof nutrientLabels!=='object'||!Object.hasOwn(nutrientLabels,key))return;
  let d=qaEnsure('display'),list=(Array.isArray(d.highlighted)?d.highlighted:[]).filter(k=>Object.hasOwn(nutrientLabels,k));
  if(list.includes(key))list=list.filter(k=>k!==key);
  else if(list.length>=qaHighlightMax){if(typeof toast==='function')toast(qaT(`Höchstens ${qaHighlightMax} Nährstoffe`,`At most ${qaHighlightMax} nutrients`));qaSound('warning');return}
  else list.push(key);
  d.highlighted=list;save();
  let on=list.includes(key);qaSound(on?'toggle':'toggleOff');
  let box=button?.closest?.('.qachips');
  if(box){box.querySelectorAll('[data-qa-nutrient]').forEach(b=>{let active=list.includes(b.dataset.qaNutrient);b.setAttribute('aria-pressed',String(active));if(!active&&list.length>=qaHighlightMax)b.setAttribute('aria-disabled','true');else b.removeAttribute('aria-disabled')})}
  let note=document.getElementById('qa-highlight-count');if(note)note.textContent=qaHighlightNote(list.length);
  if(button?.closest?.('#mb'))render();
  if(on)qaMotion()?.success?.(button);
}
function qaMacroInput(mode,button){
  let form=document.getElementById('qa-ratio-form'),grams=document.getElementById('qa-grams-edit');
  if(mode==='grams'){
    qaRatioOpen=false;
  }else if(mode==='ratio'){qaRatioOpen=true}else return;
  if(form)form.hidden=mode!=='ratio';if(grams)grams.hidden=mode==='ratio';
  qaPress(button);qaSound('toggle');if(mode==='ratio'){qaRatioPreview();qaMotion()?.enter?.(form)}
}
function qaRatioRead(){let r={};for(let k of ['p','c','f'])r[k]=Number(document.getElementById('qa-ratio-'+k)?.value);return r}
function qaRatioPreview(){
  let out=document.getElementById('qa-ratio-preview');if(!out)return;
  let r=qaRatioRead(),sum=r.p+r.c+r.f,kcal=+state.goals?.kcal||0;
  if(!qaRatioValid(r)){out.textContent=Number.isFinite(sum)?qaT(`Summe ${sum} %. Jeder Wert 5 bis 80 %, zusammen 100 %.`,`Total ${sum} %. Each 5 to 80 %, together 100 %.`):qaT('Bitte ganze Zahlen eingeben.','Please enter whole numbers.');out.classList.add('qaerror');return}
  out.classList.remove('qaerror');let g=qaGramsFromRatio(kcal,r);
  out.textContent=qaT(`${qaNum(kcal)} kcal · P ${qaNum(g.p)} g · KH ${qaNum(g.c)} g · F ${qaNum(g.f)} g`,`${qaNum(kcal)} kcal · P ${qaNum(g.p)} g · C ${qaNum(g.c)} g · F ${qaNum(g.f)} g`);
}
function qaSaveRatio(event){
  event?.preventDefault?.();
  let r=qaRatioRead(),kcal=+state.goals?.kcal;
  if(!qaRatioValid(r)){qaRatioPreview();if(typeof toast==='function')toast(qaT('Verhältnis prüfen: 5 bis 80 % je Wert, zusammen 100 %','Check ratio: 5 to 80 % each, 100 % in total'));qaSound('warning');return false}
  if(!(kcal>=1000&&kcal<=20000)){if(typeof toast==='function')toast(qaT('Zuerst eigene Makros und ein Kalorienziel festlegen','Set custom macros and a calorie target first'));return false}
  state.plan.macroMode='manual';state.plan.macroInput='ratio';state.plan.ratio={p:r.p,c:r.c,f:r.f};
  state.goals={...state.goals,...qaGramsFromRatio(kcal,r)};
  if(typeof recordGoalHistory==='function')recordGoalHistory(state.goals,typeof currentWeight==='function'?currentWeight():undefined);
  save();qaSound('save');qaRatioOpen=false;if(typeof modal!=='undefined'&&modal.open)modal.close();render();
  if(typeof toast==='function')toast(qaT('Makros aus Verhältnis gespeichert','Macros saved from ratio'));
  qaMotion()?.success?.('.qamacros');
  return true;
}
// Wird das Kalorienziel im Planer geändert, folgen die Gramm dem gespeicherten Verhältnis.
// Werden dort Gramm direkt geändert, gilt wieder die Eingabe in Gramm.
if(typeof commitProfile==='function'&&typeof collectManual==='function'){
  const qaCollectManual=collectManual;
  const qaGramsChanged=m=>['p','c','f'].some(k=>m[k]!==state.goals?.[k]);
  // Vorschau und Commit erhalten dieselben abgeleiteten Gramm VOR planError (4/4/9).
  // Nur unveränderte Gramm folgen dem Verhältnis; direkte Eingaben behalten Vorrang.
  collectManual=function(...args){
    let m=qaCollectManual.apply(this,args),plan=collectPlan();
    if(plan.macroInput!=='ratio'||!qaManualMacros(plan)||!qaRatioValid(plan.ratio)||qaGramsChanged(m))return m;
    let kcal=m.kcal;
    if(plan.mode==='auto'){
      let p=collectProfile();if(profileError(p))return m;
      kcal=planNumbers(p,plan,m).kcal;
    }
    return kcal>=1000&&kcal<=20000?{...m,...qaGramsFromRatio(kcal,plan.ratio)}:m;
  };
  const qaCommit=commitProfile;
  commitProfile=function(...args){
    let changed=qaGramsChanged(qaCollectManual()),result=qaCommit.apply(this,args);
    try{
      let plan=state.plan;
      if(result===true&&plan?.macroInput==='ratio'&&qaManualMacros(plan)&&qaRatioValid(plan.ratio)){
        if(changed){plan.macroInput='grams';save()}
      }
    }catch(error){console.error(error)}
    return result;
  };
}

if(typeof englishUI==='object')Object.assign(englishUI,{'Entdecken':'Discover','Schnell hinzufügen':'Quick add'});
if(typeof page!=='undefined'&&page==='account'&&typeof render==='function')render();
