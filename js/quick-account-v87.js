/* PULS v87 · Plus-Menü und Konto im Stil einer „Mehr“-Übersicht.
   Plus-Menü: Kachelreihe (Suchen, Barcode, Foto, Training) plus Liste; alle Einträge rufen vorhandene Abläufe auf
   (food-page/food-flow, recipes, quick-units, running). Kein Sprachprotokoll, keine Notiz, kein Fasten.
   Konto: Übersicht mit Unterseiten Konto, Profil, Ziele, Darstellung und dem Bereich „Entdecken“. Die Unterseiten
   bauen auf accountListRow, accountManageBody, accountGoalSummary und den bestehenden Formularen auf; die alten
   Bereiche (accountSections) bleiben unverändert über openAccountSection erreichbar und kehren zur Unterseite zurück.
   Neue Einstellungen werden über window.pulsData87 gelesen und nur mit gültigen Werten gespeichert (save()).
   Lädt nach food-page.js und vor motion.js; window.pulsMotion wird erst beim Klick benutzt. */

let qaPage='',qaParent='',qaScroll=0,qaAnimate='',qaRatioOpen=false;
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
  ['search','magnifying-glass',qaT('Suchen','Search'),"foodForm();foodTab('search')"],
  ['barcode','barcode',qaT('Barcode','Barcode'),"foodForm();foodTab('barcode')"],
  ['photo','camera',qaT('Foto','Photo'),"foodForm();foodTab('photo')"],
  ['training','barbell',qaT('Training','Workout'),'quickAddWorkout()']
]}
function qaQuickRows(){
  let glass=qaWater().glassMl,rows=[
    ['water','drop',qaT('Wasser','Water'),`+ ${qaNum(glass)} ml`,'qaQuickWater()'],
    ['weight','scales',qaT('Gewicht','Weight'),qaT('Messwert erfassen','Log a measurement'),'weightForm()'],
    ['ruler','ruler',qaT('Körpermaße','Body measurements'),qaT('Maße & Biometrie','Measures & biometrics'),'measurementsForm()']
  ];
  if(typeof quickAddRun==='function')rows.push(['run','person-simple-run',qaT('Aktivität','Activity'),qaT('Laufen, Rad & mehr','Running, cycling & more'),'quickAddRun()']);
  rows.push(
    ['meal','list-plus',qaT('Eigene Mahlzeit','Custom meal'),qaT('Kombi aus mehreren Lebensmitteln','Combo of several foods'),'qaQuickMeal()'],
    ['recipe','cooking-pot',qaT('Eigenes Rezept','Custom recipe'),qaT('Zutaten kombinieren','Combine ingredients'),'recipeEditor()'],
    ['custom','pencil-simple',qaT('Eigenes Lebensmittel','Custom food'),qaT('Nährwerte selbst eingeben','Enter nutrition values'),"foodForm();foodTab('custom')"]
  );
  // Später ergänzte Einträge anderer Module bleiben erhalten.
  if(typeof quickAddActions!=='undefined'&&Array.isArray(quickAddActions))for(let [key,label,note,action] of quickAddActions)if(!qaKnownQuick.has(key)&&typeof action==='string')rows.push([key,typeof quickAddIcons!=='undefined'&&quickAddIcons[key]||'plus-circle',label,note,action]);
  return rows;
}
function qaQuickHTML(){
  let i=0,tile=([key,icon,label,action])=>`<button type="button" class="qatile motion-enter" style="--motion-i:${i++}" data-qa-quick="${key}" onclick="${action}"><span class="qatileicon" aria-hidden="true">${qaIcon(icon)}</span><span>${label}</span></button>`;
  let row=([key,icon,label,note,action])=>`<button type="button" class="dsrow dsiconrow motion-enter" style="--motion-i:${Math.min(i++,10)}" data-qa-quick="${key}" onclick="${action}"><span class="dsrowicon" aria-hidden="true">${qaIcon(icon)}</span><span class="dsrowtext"><span>${label}</span><small>${note}</small></span></button>`;
  return `<div class="qaquick"><div class="qatiles" role="group" aria-label="${qaT('Erfassen','Log')}">${qaQuickTiles().map(tile).join('')}</div><div class="dsgroup dsactionlist qaquicklist">${qaQuickRows().map(row).join('')}</div></div>`;
}
function qaQuickWater(){let ml=qaWater().glassMl;if(typeof modal!=='undefined')modal.close();document.body.classList.remove('quickaddopen');if(typeof addWaterGlass==='function')addWaterGlass(ml);qaSound('water')}
function qaQuickMeal(){foodForm();if(typeof fpMealEdit==='function')fpMealEdit();else if(typeof fpBackTo==='function')fpBackTo('meals')}
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
  targets:{title:['Ziele','Targets'],icon:'target',body:()=>qaTargetsBody()},
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
  let names={system:qaT('System','System'),light:qaT('Hell','Light'),dark:qaT('Dunkel','Dark')};
  return (names[scheme]||names.system)+' · '+(state.language==='en'?'English':'Deutsch');
}
function qaMainRows(){
  let detail={account:typeof accountCloudDetail==='function'?accountCloudDetail():qaT('Anmeldung & Daten','Sign-in & data'),profile:qaProfileDetail(),targets:qaTargetsDetail(),display:qaDisplayDetail()};
  return Object.entries(qaPages).map(([key,page])=>qaRow({label:esc(qaPageTitle(key)),detail:esc(detail[key]),icon:page.icon,action:`qaOpen('${key}')`,chevron:true,cls:'accountmenulink qamenulink',id:'qa-link-'+key}));
}
function qaDiscoverRows(){
  let rows=[
    {label:qaT('Trainingsfortschritt','Training progress'),detail:qaT('Statistik, Muskeln & Rückblick','Stats, muscles & recap'),icon:'chart-line-up',action:"qaGoTrain('insights')"},
    {label:qaT('Kalender','Calendar'),detail:qaT('Trainings & Aktivitäten','Workouts & activities'),icon:'calendar-blank',action:"qaGoTrain('calendar')"},
    {label:qaT('Level & Rekorde','Level & records'),detail:qaT('XP, Bestleistungen & Serien','XP, personal bests & streaks'),icon:'trophy',action:"qaGoTrain('records')"},
    {label:qaT('Körper & Entwicklung','Body & progress'),detail:qaT('Gewichtstrend, Wochenmittel & Maße','Weight trend, weekly averages & measurements'),icon:'scales',action:"qaSection('body')"},
    {label:qaT('Rezepte','Recipes'),detail:qaT('Eigene Rezepte verwalten','Manage your recipes'),icon:'book-open',action:"qaFood('recipes')"},
    {label:qaT('Kombis','Combos'),detail:qaT('Eigene Mahlzeiten aus mehreren Lebensmitteln','Custom meals from several foods'),icon:'list-plus',action:"qaFood('meals')"}
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
  let edit='settings()',value=(x,unit='')=>Number.isFinite(x)?qaNum(x)+unit:'–';
  let rows=[
    qaRow({label:qaT('Alter','Age'),value:value(p.age),action:edit,chevron:true}),
    qaRow({label:qaT('Geschlecht','Sex'),value:qaSexLabel(p.sex),action:edit,chevron:true}),
    qaRow({label:qaT('Größe','Height'),value:value(h,' cm'),action:edit,chevron:true}),
    qaRow({label:qaT('Gewicht','Weight'),value:value(w,' kg'),action:'weightForm()',chevron:true}),
    qaRow({label:qaT('Zielgewicht','Target weight'),value:value(p.target,' kg'),action:edit,chevron:true}),
    qaRow({label:qaT('Body-Mass-Index (BMI)','Body mass index (BMI)'),value:bmi===null?'–':qaNum(Math.round(bmi*10)/10)}),
    qaRow({label:qaT('Körperfett','Body fat'),detail:bf?esc((bf.estimated?qaT('Geschätzt (US Navy)','Estimated (US Navy)'):qaT('Gemessen','Measured'))+' · '+(typeof fmtDate==='function'?fmtDate(bf.date):bf.date)):'',value:bf?qaNum(Math.round(bf.value*10)/10)+' %':'–',action:'measurementsForm()',chevron:true})
  ].join('');
  let body=[
    qaRow({label:qaT('Gewichtsverlauf & Wochenmittel','Weight trend & weekly average'),icon:'chart-line-up',action:"qaSection('body')",chevron:true}),
    qaRow({label:qaT('Körpermaße & Biometrie','Body measurements & biometrics'),icon:'ruler',action:'measurementsForm()',chevron:true}),
    qaRow({label:qaT('Gewicht erfassen','Log weight'),icon:'scales',action:'weightForm()',chevron:true,cls:'dsaction'})
  ].join('');
  return qaGroup('',rows,'qaprofile',qaT('Alter, Geschlecht, Größe und Zielgewicht änderst du in „Profil & Ziele“. Der BMI wird berechnet.','Change age, sex, height and target weight in “Profile & goals”. BMI is calculated.'))+qaGroup(qaT('Körper & Entwicklung','Body & progress'),body);
}

/* ---------- Unterseite Ziele ---------- */
const qaPaceNames={low:['Wenig','Low'],medium:['Mittel','Medium'],high:['Viel','High'],extreme:['Extrem','Extreme']};
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
function qaMacroRows(g){
  let kcal=+g?.kcal||0,pct=(grams,factor)=>kcal>0?Math.round(grams*factor/kcal*100)+' %':'';
  return [['p',qaT('Protein','Protein'),4],['c',qaT('Kohlenhydrate','Carbohydrates'),4],['f',qaT('Fett','Fat'),9]].map(([k,label,factor])=>qaRow({label,detail:pct(+g?.[k]||0,factor),value:Number.isFinite(g?.[k])?qaNum(g[k])+' g':'–'})).join('');
}
function qaMacroEditor(){
  let plan=state.plan||{},g=state.goals||{},ratio=plan.macroInput==='ratio'&&qaRatioValid(plan.ratio),open=ratio||qaRatioOpen,r=qaRatioValid(plan.ratio)?plan.ratio:qaRatioFromGoals(g);
  let seg=`<div class="segmented qaseg" role="group" aria-label="${qaT('Makro-Eingabe','Macro input')}" data-motion-indicator><button type="button" aria-pressed="${!open}" onclick="qaMacroInput('grams',this)">${qaT('Gramm','Grams')}</button><button type="button" aria-pressed="${open}" onclick="qaMacroInput('ratio',this)">${qaT('Verhältnis','Ratio')}</button></div>`;
  let input=(k,label)=>`<label class="qaratiofield">${label}<span class="qaratioinput"><input id="qa-ratio-${k}" type="number" inputmode="numeric" min="5" max="80" step="1" required value="${r[k]}" oninput="qaRatioPreview()"><span aria-hidden="true">%</span></span></label>`;
  let form=`<form class="qaratio" id="qa-ratio-form" onsubmit="qaSaveRatio(event)" ${open?'':'hidden'}><div class="qaratiogrid">${input('p',qaT('Protein','Protein'))}${input('c',qaT('Kohlenh.','Carbs'))}${input('f',qaT('Fett','Fat'))}</div><p class="note" id="qa-ratio-preview" role="status"></p><button type="submit" class="btn full">${qaT('Verhältnis übernehmen','Apply ratio')}</button></form>`;
  let grams=`<div id="qa-grams-edit" ${open?'hidden':''}>${qaGroup('',qaRow({label:qaT('Gramm bearbeiten','Edit grams'),action:'settings()',chevron:true,cls:'dsaction'}))}</div>`;
  return `<div class="qamacroedit">${seg}${form}${grams}</div>`;
}
function qaEnergyGroup(){
  let p=state.profile;if(!p||typeof energyFor!=='function'||(typeof profileError==='function'&&profileError(p)))return '';
  let e=null;try{let w=typeof currentWeight==='function'?currentWeight():null;e=energyFor(p,Number.isFinite(w)?w:p.weight,state.plan,typeof today==='function'?today():undefined)}catch{}
  if(!e||!Number.isFinite(e.rmr))return '';
  let rows=qaRow({label:qaT('Ruheumsatz','Resting energy'),value:qaNum(Math.round(e.rmr))+' kcal'});
  if(p.kcalMode==='baseline'&&Number.isFinite(e.baseline)){rows+=qaRow({label:qaT('Grundbedarf mit Alltag','Baseline incl. daily activity'),value:qaNum(Math.round(e.baseline))+' kcal'});rows+=qaRow({label:qaT('Sport heute','Exercise today'),value:qaNum(Math.round(e.sport||0))+' kcal'})}
  if(Number.isFinite(e.tdee))rows+=qaRow({label:qaT('Erhalt geschätzt','Estimated maintenance'),value:qaNum(Math.round(e.tdee))+' kcal'});
  return qaGroup(qaT('Energieverbrauch','Energy expenditure'),rows,'',qaT('Schätzung aus deinem Profil. Bearbeitet wird in „Profil & Ziele“.','Estimate from your profile. Edit it in “Profile & goals”.'));
}
function qaWaterGroup(){
  let w=qaWater(),rec=null;try{rec=window.pulsData87?.waterRecommendation?.()}catch{}
  let goal=rec&&Number.isFinite(rec.ml)?qaNum(rec.ml)+' ml':'–',mode=w.mode==='manual'?qaT('Eigenes Ziel','Custom'):rec?.mode==='standard'?qaT('Standard ohne Gewicht','Default without weight'):qaT('Automatisch','Automatic');
  let action=typeof fdWaterInfo==='function'?'fdWaterInfo()':'waterGoalForm()';
  return qaGroup(qaT('Wasser','Water'),qaRow({label:qaT('Wasserziel','Water target'),detail:esc(mode),value:goal,icon:'drop',action,chevron:true})+qaRow({label:qaT('Glasgröße','Glass size'),value:qaNum(w.glassMl)+' ml',action,chevron:true}));
}
function qaHighlightGroup(){
  if(typeof nutrientLabels!=='object')return '';
  let list=qaDisplay().highlighted||[],full=list.length>=qaHighlightMax;
  let chips=Object.entries(nutrientLabels).map(([key,[label]])=>{let on=list.includes(key);return `<button type="button" class="qachip" data-qa-nutrient="${esc(key)}" aria-pressed="${on}" ${!on&&full?'aria-disabled="true"':''} onclick="qaHighlight('${esc(key)}',this)">${esc(label)}</button>`}).join('');
  return `<h2 class="dsgrouptitle">${qaT('Hervorgehobene Nährstoffe','Highlighted nutrients')}</h2><section class="dsgroup qachips" role="group" aria-label="${qaT('Hervorgehobene Nährstoffe','Highlighted nutrients')}">${chips}</section><p class="dsgroupfoot" id="qa-highlight-count" role="status">${qaHighlightNote(list.length)}</p>`;
}
function qaHighlightNote(count){return qaT(`${count} von ${qaHighlightMax} ausgewählt · erscheinen auf der Mikro-Folie im Essen-Tab`,`${count} of ${qaHighlightMax} selected · shown on the micronutrient slide in Food`)}
function qaTargetsBody(){
  let plan=state.plan||{},auto=plan.mode==='auto',g=qaGoals();
  let goal=typeof accountGoalSummary==='function'?accountGoalSummary():'';
  let planRows=qaRow({label:qaT('Richtung','Direction'),value:auto?qaName(qaDirectionNames,plan.direction):qaT('Selbst festgelegt','Set manually'),action:'settings()',chevron:true});
  if(auto&&plan.direction!=='maintain')planRows+=qaRow({label:qaT('Zieltempo','Goal pace'),value:qaName(qaPaceNames,plan.pace),action:'settings()',chevron:true});
  if(typeof planTargetDate==='function'&&auto)planRows+=qaRow({label:qaT('Zielgewicht voraussichtlich','Target weight expected'),value:esc(planTargetDate())});
  planRows+=qaRow({label:qaT('Plan im Detail','Plan details'),action:"qaSection('plan')",chevron:true,cls:'dsaction'});
  let macroFoot=qaManualMacros(plan)?qaT('Eingabe in Gramm oder als Verhältnis der Kalorien. Gramm werden aus dem Verhältnis berechnet.','Enter grams or a ratio of calories. Grams are calculated from the ratio.'):qaT(`Automatisch pro kg Körpergewicht: Protein ${qaNum(plan.protein)} g, Fett ${qaNum(plan.fat)} g. Kohlenhydrate füllen den Rest.`,`Automatic per kg body weight: protein ${qaNum(plan.protein)} g, fat ${qaNum(plan.fat)} g. Carbs fill the rest.`);
  let macros=qaGroup(qaT('Makros','Macros'),qaMacroRows(g),'qamacros',macroFoot)+(qaManualMacros(plan)?qaMacroEditor():qaGroup('',qaRow({label:qaT('Makros anpassen','Adjust macros'),action:'settings()',chevron:true,cls:'dsaction'})));
  let nutrients=qaGroup(qaT('Nährstoffziele','Nutrient targets'),qaRow({label:qaT('Eigene Nährstoffziele','Custom nutrient targets'),detail:qaT('Vitamine, Mineralstoffe & mehr','Vitamins, minerals & more'),icon:'list-plus',action:'microTargetForm()',chevron:true}));
  let adaptive=typeof accountSections!=='undefined'&&accountSections.some(x=>x.key==='adaptive')?qaGroup(qaT('Automatik','Automation'),qaRow({label:qaT('Adaptiver Erhalt','Adaptive maintenance'),detail:qaT('Verlauf & Kalibrierung','History & calibration'),icon:'chart-line-up',action:"qaSection('adaptive')",chevron:true})):'';
  return goal+qaGroup(qaT('Plan','Plan'),planRows)+macros+qaEnergyGroup()+qaWaterGroup()+nutrients+qaHighlightGroup()+adaptive;
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
  return qaGroup(qaT('Folien der Tagesübersicht','Daily summary slides'),fixed+rows,'qaviews',qaT('Reihenfolge und Sichtbarkeit der Folien im Essen-Tab.','Order and visibility of the slides in Food.'));
}
function qaDisplayBody(){
  let d=qaDisplay(),scheme='system';try{if(typeof getColorScheme==='function')scheme=getColorScheme()}catch{}
  let appearance=`<h2 class="dsgrouptitle">${qaT('Farbschema','Colour scheme')}</h2>${qaSeg('scheme',[['system',qaT('System','System')],['light',qaT('Hell','Light')],['dark',qaT('Dunkel','Dark')]],scheme,qaT('Farbschema','Colour scheme'))}`;
  let language=qaGroup('',qaRow({label:qaT('Sprache & App-Icon','Language & app icon'),detail:state.language==='en'?'English':'Deutsch',icon:'text-aa',action:"qaSection('design')",chevron:true}));
  let remaining=`<h2 class="dsgrouptitle">${qaT('Kalorien anzeigen als','Show calories as')}</h2>${qaSeg('remaining',[['eaten',qaT('Gegessen','Eaten')],['remaining',qaT('Übrig','Remaining')]],d.showRemaining?'remaining':'eaten',qaT('Kalorien anzeigen als','Show calories as'))}`;
  let volume=state.soundVolume??35;
  let feedback=qaSwitch('qa-sound',qaT('Klänge','Sounds'),state.soundEnabled!==false,'qaSetSwitch(\'sound\',this.checked)',qaT('Dezente Töne für Aktionen und Erfolge','Subtle sounds for actions and achievements'))
    +`<label class="dsrow qavolume"><span class="dsrowtext"><span>${qaT('Lautstärke','Volume')}</span></span><input type="range" min="0" max="70" step="5" value="${volume}" aria-label="${qaT('Lautstärke','Volume')}" oninput="qaVolume(this.value)" onchange="typeof testPulsSound==='function'&&testPulsSound()"></label>`
    +(typeof testPulsSound==='function'?qaRow({label:qaT('Probehören','Preview'),icon:'speaker-high',action:'testPulsSound()',cls:'dsaction'}):'')
    +qaSwitch('qa-haptics',qaT('Haptik','Haptics'),d.hapticsEnabled!==false,'qaSetSwitch(\'haptics\',this.checked)',qaT('Vibration bei Aktionen, wenn das Gerät sie unterstützt','Vibration for actions where supported'));
  let motion=`<h2 class="dsgrouptitle">${qaT('Bewegung','Motion')}</h2>${qaSeg('motion',[['system',qaT('Wie System','Like system')],['reduced',qaT('Reduziert','Reduced')]],d.motion==='reduced'?'reduced':'system',qaT('Bewegung','Motion'))}<p class="dsgroupfoot">${qaT('Reduziert schaltet Animationen ab und blendet nur noch kurz ein.','Reduced turns animations off and only fades briefly.')}</p>`;
  return appearance+language+qaViewsGroup()+remaining+qaGroup(qaT('Klänge & Haptik','Sounds & haptics'),feedback,'qafeedback')+motion;
}

/* ---------- Navigation ---------- */
function qaOpen(key){
  if(!qaPages[key])return;
  qaScroll=window.scrollY||0;qaPage=key;qaParent='';qaRatioOpen=false;qaAnimate='push';
  render();window.scrollTo(0,0);document.getElementById('account-section-title')?.focus({preventScroll:true});
}
function qaBack(){
  let from=qaPage,el=document.querySelector('#content .qadetail');
  let done=()=>{if(qaPage!==from)return;qaPage='';qaRatioOpen=false;render();window.scrollTo(0,qaScroll);document.getElementById('qa-link-'+from)?.focus({preventScroll:true})};
  let motion=qaMotion();if(el&&motion?.pop)motion.pop(el,done);else done();
}
// Bestehender Bereich aus einer Unterseite heraus: Zurück führt wieder zur Unterseite.
function qaSection(key){
  if(typeof openAccountSection!=='function')return;
  qaParent=qaPage;qaAnimate='push';openAccountSection(key);
  if(typeof accountSection==='undefined'||!accountSection){qaParent='';qaAnimate=''}
}
function qaGoTrain(tab){trainTab=tab;go('workout')}
function qaFood(pane){foodForm();if(typeof fpBackTo==='function')fpBackTo(pane);else if(typeof foodTab==='function')foodTab('recipes')}

if(typeof closeAccountSection==='function'){
  const qaCloseBase=closeAccountSection;
  closeAccountSection=function(...args){
    let parent=qaPages[qaParent]?qaParent:'',el=document.querySelector('#content .accountdetail'),motion=qaMotion();
    let done=()=>{
      if(!parent){qaParent='';return qaCloseBase.apply(this,args)}
      let previous=accountSection;qaParent='';accountSection='';qaPage=parent;render();window.scrollTo(0,0);
      (document.getElementById('account-link-'+previous)||document.getElementById('account-section-title'))?.focus({preventScroll:true});
    };
    if(el&&motion?.pop&&!motion.reduced())motion.pop(el,done);else done();
  };
}
if(typeof go==='function'){const qaGo=go;go=function(next,...args){let before=typeof page!=='undefined'?page:'';qaPage='';qaParent='';qaRatioOpen=false;if(next==='account'&&before!=='account')qaAnimate='list';return qaGo.call(this,next,...args)}}

if(typeof accountPage==='function'){
  const qaAccountBase=accountPage;
  accountPage=function(...args){
    let html=qaAccountBase.apply(this,args);
    if(typeof accountSection!=='undefined'&&accountSection){
      if(qaPages[qaParent])html=html.replace(/(<button type="button" class="accountback"[^>]*>[\s\S]*?<span>)Konto(<\/span>)/,`$1${esc(qaPageTitle(qaParent))}$2`);
      return html;
    }
    if(qaPages[qaPage])return qaDetail(qaPage);
    let template=document.createElement('template');template.innerHTML=html;
    return qaOverview(template);
  };
}
// Nach dem Zeichnen: Seitentitel bei Unterseiten ausblenden, Push und gestaffelte Liste nur nach Navigation.
if(typeof render==='function'){
  const qaRender=render;
  render=function(...args){
    let result=qaRender.apply(this,args);
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
    return result;
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
  if(on)qaMotion()?.success?.(button);
}
function qaMacroInput(mode,button){
  let form=document.getElementById('qa-ratio-form'),grams=document.getElementById('qa-grams-edit');
  if(mode==='grams'){
    qaRatioOpen=false;
    if(state.plan?.macroInput==='ratio'){state.plan.macroInput='grams';save()}
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
  out.textContent=qaT(`Bei ${qaNum(kcal)} kcal: P ${qaNum(g.p)} g · KH ${qaNum(g.c)} g · F ${qaNum(g.f)} g`,`At ${qaNum(kcal)} kcal: P ${qaNum(g.p)} g · C ${qaNum(g.c)} g · F ${qaNum(g.f)} g`);
}
function qaSaveRatio(event){
  event?.preventDefault?.();
  let r=qaRatioRead(),kcal=+state.goals?.kcal;
  if(!qaRatioValid(r)){qaRatioPreview();if(typeof toast==='function')toast(qaT('Verhältnis prüfen: 5 bis 80 % je Wert, zusammen 100 %','Check ratio: 5 to 80 % each, 100 % in total'));qaSound('warning');return false}
  if(!qaManualMacros()||!(kcal>=1000&&kcal<=20000)){if(typeof toast==='function')toast(qaT('Zuerst eigene Makros und ein Kalorienziel festlegen','Set custom macros and a calorie target first'));return false}
  state.plan.macroInput='ratio';state.plan.ratio={p:r.p,c:r.c,f:r.f};
  state.goals={...state.goals,...qaGramsFromRatio(kcal,r)};
  if(typeof recordGoalHistory==='function')recordGoalHistory(state.goals,typeof currentWeight==='function'?currentWeight():undefined);
  save();qaSound('save');qaRatioOpen=false;render();
  if(typeof toast==='function')toast(qaT('Makros aus Verhältnis gespeichert','Macros saved from ratio'));
  qaMotion()?.success?.('.qamacros');
  return true;
}
// Wird das Kalorienziel im Planer geändert, folgen die Gramm dem gespeicherten Verhältnis.
// Werden dort Gramm direkt geändert, gilt wieder die Eingabe in Gramm.
if(typeof commitProfile==='function'){
  const qaCommit=commitProfile;
  commitProfile=function(...args){
    let before={...(state.goals||{})},result=qaCommit.apply(this,args);
    try{
      let plan=state.plan;
      if(result===true&&plan?.macroInput==='ratio'&&qaManualMacros(plan)&&qaRatioValid(plan.ratio)){
        let g=state.goals||{};
        if(['p','c','f'].some(k=>g[k]!==before[k])){plan.macroInput='grams';save()}
        else if(g.kcal!==before.kcal&&g.kcal>=1000&&g.kcal<=20000){state.goals={...g,...qaGramsFromRatio(g.kcal,plan.ratio)};if(typeof recordGoalHistory==='function')recordGoalHistory(state.goals,typeof currentWeight==='function'?currentWeight():undefined);save();render()}
      }
    }catch(error){console.error(error)}
    return result;
  };
}

if(typeof englishUI==='object')Object.assign(englishUI,{'Entdecken':'Discover','Schnell hinzufügen':'Quick add'});
if(typeof page!=='undefined'&&page==='account'&&typeof render==='function')render();
