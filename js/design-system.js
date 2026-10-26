/* PULS Designsystem, Schritt 1 (docs/DESIGN-SYSTEM.md). Wird zuletzt geladen.
   Nur Darstellung: Tab-Leiste, Seitentitel, neue Übersicht, Passwort anzeigen/verbergen, Offline-Hinweis
   und die Einstellung „Darstellung“. Daten, Sync und gespeicherte Felder bleiben unverändert. */

function dsText(de,en){return typeof state!=='undefined'&&state?.language==='en'?en:de}
function dsKcal(value){return n(Math.round(value))}

/* ---------- Fortschrittsring (ersetzt den früheren Verlaufsring) ---------- */
function dsRing(percent,over=false){
  let value=Math.max(0,Math.min(100,Number(percent)||0));
  return `<svg class="dsring${over?' dsover':''}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle class="dsringtrack" cx="50" cy="50" r="44" pathLength="100"/>${value>0?`<circle class="dsringvalue" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${value} 100" transform="rotate(-90 50 50)"/>`:''}</svg>`;
}

/* ---------- Übersicht ---------- */
function dsRow({label,detail='',value='',icon='',action='',chevron=false,cls=''}){
  let tag=action?'button':'div',attrs=action?` type="button" onclick="${action}"`:'';
  return `<${tag} class="dsrow${icon?' dsiconrow':''}${cls?' '+cls:''}"${attrs}>${icon?`<span class="dsrowicon" aria-hidden="true">${phIcon(icon)}</span>`:''}<span class="dsrowtext"><span>${label}</span>${detail?`<small>${detail}</small>`:''}</span>${value!==''?`<span class="dsrowvalue">${value}</span>`:''}${chevron?`<span class="dsrowchevron" aria-hidden="true">${phIcon('caret-right')}</span>`:''}</${tag}>`;
}
function dsGroup(title,rows,foot=''){return `${title?`<h2 class="dsgrouptitle">${title}</h2>`:''}<div class="dsgroup">${rows}</div>${foot?`<p class="dsgroupfoot">${foot}</p>`:''}`}
function dsDayGoals(){return (typeof dayGoals==='function'?dayGoals(date):state.goals)||{}}
/* Makros einheitlich in Akzentfarbe; Orange nur, wenn ein Ziel überschritten ist. */
function dsMacroRows(t,g){
  return `<div class="dsmacros">${[['p',dsText('Protein','Protein')],['c',dsText('Kohlenhydrate','Carbs')],['f',dsText('Fett','Fat')]].map(([k,label])=>{
    let target=Number(g[k])||0,value=t[k]||0,width=target>0?Math.min(100,value/target*100):0,isOver=target>0&&value>target;
    return `<div class="dsmacro"><span>${label}</span><strong>${n(Math.round(value))}${target>0?' / '+n(target):''} g</strong><div class="dsmeter" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${target||100}" aria-valuenow="${Math.min(target,Math.max(0,Math.round(value)))}" aria-valuetext="${n(Math.round(value))}${target>0?' / '+n(target):''} g"><i class="${isOver?'dsover':''}" style="width:${width}%"></i></div></div>`;
  }).join('')}</div>`;
}
function dsEnergyFacts(t,g){
  let goal=Number(g.kcal)||0,eaten=t.kcal,over=goal>0&&eaten>goal,left=goal-eaten;
  return {goal,eaten,over,percent:goal>0?eaten/goal*100:0,
    big:goal>0?(over?'+'+dsKcal(eaten-goal):dsKcal(left))+' kcal':dsKcal(eaten)+' kcal',
    caption:goal>0?(over?dsText('über dem Tagesziel','over your daily target'):dsText('übrig','left')):dsText('gegessen, kein Tagesziel','eaten, no daily target')};
}
function dsEnergyCard(){
  let t=totals(),g=dsDayGoals(),e=dsEnergyFacts(t,g);
  return `<div class="dsgroup dsenergy"><div class="dsenergytop"><div class="dsringwrap">${dsRing(e.percent,e.over)}<div class="dsringlabel"><strong>${dsKcal(e.eaten)}</strong><small>${e.goal>0?dsText('von','of')+' '+dsKcal(e.goal):'kcal'}</small></div></div><div class="dsenergyfacts"><span class="dsbig${e.over?' dsover':''}">${e.big}</span><span class="dscaption">${e.caption}</span></div></div>${dsMacroRows(t,g)}<button type="button" class="btn full dsprimary" onclick="foodForm();if(typeof foodTab==='function')foodTab('search')">${dsText('Essen eintragen','Log food')}</button></div>`;
}
function dsFoodGroup(){
  let entries=state.foods.filter(x=>x.date===date),shown=entries.slice(-5).reverse();
  let rows=shown.map(x=>typeof swipeDiaryEntry==='function'?swipeDiaryEntry(x):dsRow({label:esc(x.name),detail:`${n(x.grams)} ${x.unit==='ml'?'ml':'g'}`,value:dsKcal(x.kcal)+' kcal'})).join('');
  if(!rows)rows=dsRow({label:dsText('Noch nichts eingetragen.','Nothing logged yet.'),cls:'dsempty'});
  rows+=dsRow({label:entries.length>shown.length?dsText(`Alle ${entries.length} anzeigen`,`Show all ${entries.length}`):dsText('Zum Ernährungstagebuch','Open food diary'),action:"go('food')",chevron:true,cls:'dsaction'});
  return dsGroup(date===today()?dsText('Heute eingetragen','Logged today'):dsText('Eingetragen','Logged'),rows);
}
function dsTrainingGroup(){
  let active=typeof activeWorkout==='function'?activeWorkout():null,rows='';
  // Laufende oder minimierte Aktivität (Lauf, Rad …) mit Live-Uhr wie bisher in quickTraining (running.js).
  if(state.activeRun&&typeof openRunView==='function'){
    let clock=typeof formatClock==='function'&&typeof runElapsed==='function'?formatClock(runElapsed()):'';
    rows+=dsRow({label:dsText('Aktivität läuft','Activity in progress'),detail:typeof actTypeName==='function'&&state.activeRun.type?esc(actTypeName(state.activeRun.type)):'',icon:'person-simple-run',action:'openRunView()',value:clock?`<span data-runclock>${clock}</span>`:dsText('Öffnen','Open'),chevron:true});
  }
  if(active)rows+=dsRow({label:esc(active.name||'Workout'),detail:dsText('Laufendes Training','Workout in progress'),icon:'barbell',action:typeof openWorkoutSession==='function'?`openWorkoutSession('${esc(active.id)}')`:"trainTab='current';go('workout')",value:dsText('Fortsetzen','Resume'),chevron:true});
  else{
    for(let r of (state.routines||[]).slice(0,3))rows+=dsRow({label:esc(r.name),detail:`${(r.exercises||[]).length} ${dsText((r.exercises||[]).length===1?'Übung':'Übungen',(r.exercises||[]).length===1?'exercise':'exercises')}`,icon:'barbell',action:`startRoutine('${esc(r.id)}')`,value:dsText('Starten','Start'),chevron:true});
    rows+=dsRow({label:dsText('Freies Training','Empty workout'),icon:'plus-circle',action:'startWorkout()',chevron:true});
  }
  rows+=dsRow({label:dsText('Alle Routinen','All routines'),action:"trainTab='routines';go('workout')",chevron:true,cls:'dsaction'});
  let foot='';
  if(typeof activeMinutesWeek==='function'){
    let mins=Math.floor(activeMinutesWeek()),goal=typeof activeMinutesGoal==='function'?activeMinutesGoal():0;
    foot=dsText('Aktiv diese Woche','Active this week')+': '+n(mins)+(goal?' / '+n(goal):'')+' min';
    if(typeof runWeekRange==='function'&&typeof runKmBetween==='function'&&typeof runKm==='function'){let {start,end}=runWeekRange();foot+=' · '+runKm(Math.round(runKmBetween(start,end)*10)/10)+' km'}
  }
  return dsGroup(dsText('Training','Training'),rows,foot);
}
function dsBodyGroup(){
  let latest=[...state.weights].filter(x=>x.date<=today()).sort((a,b)=>b.date.localeCompare(a.date))[0];
  let rows=dsRow({label:dsText('Gewicht','Weight'),detail:latest?dsText('Zuletzt','Last')+' '+esc(friendlyDay(latest.date)):dsText('Noch kein Eintrag','No entry yet'),icon:'scales',value:latest?n(latest.kg)+' kg':''});
  rows+=dsRow({label:dsText('Gewicht erfassen','Log weight'),action:'weightForm()',chevron:true,cls:'dsaction'});
  return dsGroup(dsText('Körper','Body'),rows);
}
/* Verlaufsdiagramm: frühere Pastelltöne durch die Systemfarben des aktuellen Schemas ersetzen. */
function dsSeriesColors(html){
  let dark=document.documentElement.dataset.scheme==='dark';
  let map={'#a3b9fb':dark?'#0A84FF':'#007AFF','#c3f86b':dark?'#30D158':'#248A3D','#f2b87d':dark?'#FF9F0A':'#C93400','#343b2e':dark?'#38383A':'#D1D1D6','#9ba68f':dark?'#AEAEB2':'#636366','#30362b':dark?'#38383A':'#D1D1D6'};
  return String(html).replace(/#(a3b9fb|c3f86b|f2b87d|343b2e|9ba68f|30362b)\b/gi,m=>map[m.toLowerCase()]||m);
}
if(typeof progressChart==='function'){const dsChartBase=progressChart;progressChart=function(...args){return dsSeriesColors(dsChartBase.apply(this,args))}}
home=function(){
  let chart=typeof progressChart==='function'?`<h2 class="dsgrouptitle">${dsText('Verlauf','Progress')}</h2><div class="dschart">${progressChart()}</div>`:'';
  return `<div class="dshome">${dsEnergyCard()}${dsFoodGroup()}${dsTrainingGroup()}${dsBodyGroup()}${chart}</div>`;
};

/* ---------- Passwort anzeigen/verbergen ---------- */
function dsPasswordToggle(button){
  let input=button.parentElement?.querySelector('input');if(!input)return;
  let show=input.type==='password';input.type=show?'text':'password';dsPasswordState(button,show);
}
function dsPasswordState(button,shown){
  button.setAttribute('aria-pressed',String(shown));
  button.setAttribute('aria-label',shown?dsText('Passwort verbergen','Hide password'):dsText('Passwort anzeigen','Show password'));
  button.innerHTML=phIcon(shown?'eye-slash':'eye');
}
function dsDecoratePasswords(root=document){
  root.querySelectorAll('input[type=password]:not([data-ds-password])').forEach(input=>{
    input.dataset.dsPassword='1';
    let wrap=document.createElement('span');wrap.className='dspassword';input.before(wrap);wrap.append(input);
    let button=document.createElement('button');button.type='button';button.className='dspasswordtoggle';
    if(input.id)button.setAttribute('aria-controls',input.id);
    button.setAttribute('onclick','dsPasswordToggle(this)');dsPasswordState(button,false);wrap.append(button);
  });
}
// Beim Absenden wird jedes angezeigte Passwort wieder verborgen (vor den bestehenden Formular-Handlern).
document.addEventListener('submit',event=>{
  event.target?.querySelectorAll?.('.dspassword input[data-ds-password]').forEach(input=>{
    input.type='password';let button=input.parentElement.querySelector('.dspasswordtoggle');if(button)dsPasswordState(button,false);
  });
},true);

/* ---------- Offline-Hinweis ---------- */
function dsConnectivityText(status=window.pulsConnectivity){
  if(!status)return '';
  if(!status.online)return {icon:'cloud-slash',text:dsText('Offline, wird später synchronisiert','Offline, will sync later')};
  if(status.pendingSync&&typeof cloudSession!=='undefined'&&cloudSession)return {icon:'arrows-clockwise',text:dsText('Wird synchronisiert','Syncing')};
  return '';
}
function dsRenderConnectivity(status){
  let node=$('ds-connectivity'),content=$('content');
  if(!node&&content){node=document.createElement('div');node.id='ds-connectivity';node.className='dsofflinestatus';node.setAttribute('role','status');node.setAttribute('aria-live','polite');content.before(node)}
  if(!node)return;
  let info=dsConnectivityText(status),html=info?`${phIcon(info.icon)}<span>${info.text}</span>`:'';
  if(node.innerHTML!==html)node.innerHTML=html;
}
window.addEventListener('puls:connectivity',event=>dsRenderConnectivity(event.detail||window.pulsConnectivity));

/* ---------- Dateiauswahl: gestalteter Knopf statt „Choose File“ ----------
   Das echte <input type=file> bleibt im Knopf (visuell versteckt, fokussierbar, für VoiceOver erreichbar);
   ein Tippen auf den Knopf öffnet die Auswahl. Handler und Attribute des Inputs bleiben unverändert. */
function dsFileLabel(input){
  let accept=input.getAttribute('accept')||'';
  if(/image/.test(accept))return dsText('Foto auswählen','Choose photo');
  if(/json/.test(accept))return dsText('Sicherungsdatei auswählen','Choose backup file');
  return dsText('Datei auswählen','Choose file');
}
function dsDecorateFileInputs(root){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll('input[type=file]:not([data-ds-file])').forEach(input=>{
    input.dataset.dsFile='1';
    // Das Profilbild im Konto ist bereits ein runder Bildknopf und bleibt so.
    if(input.closest('.avatarpicker'))return;
    let button=document.createElement('span');button.className='dsfilebutton';
    let text=document.createElement('span');text.className='dsfiletext';text.textContent=dsFileLabel(input);
    button.innerHTML=phIcon(/image/.test(input.getAttribute('accept')||'')?'image':'upload-simple');button.append(text);
    let label=input.closest('label');
    if(label){input.before(button);button.prepend(input)}
    else{let wrap=document.createElement('label');wrap.className='dsfilewrap';input.before(wrap);wrap.append(button);button.prepend(input)}
    if(!input.getAttribute('aria-label')){let own=label?[...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.nodeValue.trim()).join(' ').trim():'';input.setAttribute('aria-label',own||text.textContent)}
    input.addEventListener('change',()=>{let file=input.files?.[0];text.textContent=file?file.name:dsFileLabel(input)});
  });
}

/* ---------- Dezimalfelder: Komma oder Punkt ----------
   Die iPhone-Tastatur liefert „78,5“; type=number lehnt das in Safari ab. Felder mit Dezimalstellen werden zu
   type=text inputmode=decimal. Beim Tippen wird das Komma zum Punkt, damit alle bestehenden Handler weiter
   eine gewöhnliche Zahl lesen. min/max prüft setCustomValidity, damit das Formular wie bisher blockiert.
   Das laufende Workout (#session-root) und seine Satzfelder bleiben unverändert. */
function dsDecimalCheck(input){
  let value=String(input.value).trim(),message='';
  if(value!==''){
    let number=/^(\d+[.,]?\d*|[.,]\d+)$/.test(value)?Number(value.replace(',','.')):NaN,min=input.getAttribute('min'),max=input.getAttribute('max');
    if(!Number.isFinite(number))message=dsText('Bitte eine Zahl eingeben.','Please enter a number.');
    else if(min!==null&&min!==''&&number<Number(min))message=dsText(`Der Wert muss mindestens ${min} sein.`,`The value must be at least ${min}.`);
    else if(max!==null&&max!==''&&number>Number(max))message=dsText(`Der Wert darf höchstens ${max} sein.`,`The value must be at most ${max}.`);
  }
  input.setCustomValidity(message);
}
function dsDecorateDecimals(root){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll('input[type=number]:not([data-ds-decimal])').forEach(input=>{
    if(input.closest('#session-root,.liveset'))return;
    let step=input.getAttribute('step')||'1';
    if(input.getAttribute('inputmode')!=='decimal'&&!/\.|any/.test(step))return;
    input.dataset.dsDecimal='1';
    input.type='text';
    input.setAttribute('inputmode','decimal');
    input.setAttribute('pattern','[0-9]*[.,]?[0-9]*');
    input.setAttribute('autocomplete','off');
    dsDecimalCheck(input);
  });
}
document.addEventListener('input',event=>{
  let input=event.target;
  if(!input?.dataset?.dsDecimal)return;
  // Nur eindeutige Dezimalnotation (Ziffern mit höchstens einem Komma oder Punkt) wird umgeschrieben; alles andere bleibt stehen und wird als ungültig gemeldet.
  let raw=input.value;
  if(/^\d*,\d*$/.test(raw)){let caret=input.selectionStart;input.value=raw.replace(',','.');try{if(caret!==null)input.setSelectionRange(caret,caret)}catch{}}
  dsDecimalCheck(input);
},true);
// Wert per Code geändert (z. B. Feld geleert): vor dem Absenden alle Dezimalfelder des Formulars neu prüfen.
function dsRecheckDecimals(target){
  let scope=target?.closest?.('form')||document;
  scope.querySelectorAll?.('[data-ds-decimal]').forEach(dsDecimalCheck);
}
document.addEventListener('click',event=>{if(event.target?.closest?.('button,input[type=submit]'))dsRecheckDecimals(event.target)},true);
document.addEventListener('keydown',event=>{if(event.key==='Enter')dsRecheckDecimals(event.target)},true);

/* ---------- Aktivitäts- und Steuersymbole aus Phosphor ---------- */
const dsRunIcons={run:'person-simple-run',trail:'mountains',walk:'person-simple-walk',hike:'person-simple-hike',mountain:'mountains',ride:'bicycle',tabletennis:'ping-pong',soccer:'soccer-ball',mma:'boxing-glove',padel:'tennis-ball',inline:'sneaker-move',other:'dots-three-circle',route:'path',locate:'crosshair',lock:'lock-simple',play:'play',pause:'pause',stop:'stop',down:'caret-down',lap:'flag-checkered'};
if(typeof runIcon==='function'){const dsRunIconBase=runIcon;runIcon=function(key){return dsRunIcons[key]?phIcon(dsRunIcons[key]):dsRunIconBase(key)}}
const dsControlGlyphs={'⌄':'caret-down','⌃':'caret-up','‹':'caret-left','›':'caret-right','×':'x','✕':'x'};
if(typeof controlIconSvg==='function')controlIconSvg=function(glyph){return phIcon(dsControlGlyphs[glyph]||'x','controlicon')};

/* ---------- Essen: Kopf als ruhige Liste (kleiner Ring, Restwert, Makro-Balken) ---------- */
if(typeof combinedNutrition==='function')combinedNutrition=function(){
  let t=totals(),g=dsDayGoals(),e=dsEnergyFacts(t,g);
  return `<div class="dsenergytop dsenergysmall"><div class="dsringwrap">${dsRing(e.percent,e.over)}</div><div class="dsenergyfacts"><span class="dsbig${e.over?' dsover':''}">${e.big}</span><span class="dscaption">${e.goal>0?dsKcal(e.eaten)+' '+dsText('von','of')+' '+dsKcal(e.goal)+' kcal · '+e.caption:e.caption}</span></div></div>${dsMacroRows(t,g)}${typeof baselineEnergyLine==='function'?baselineEnergyLine(date):''}`;
};
if(typeof nutritionSlides==='function'&&typeof microBars==='function'){
  nutritionSlides=function(){
    let labels=[dsText('Energie & Makros','Energy & macros'),dsText('Mikronährstoffe','Micronutrients')];
    return `<section class="nutritiondeck"><div class="segmented slidedots dsslideswitch" role="group" aria-label="${dsText('Ansicht','View')}">${labels.map((label,i)=>`<button type="button" class="${nutrientSlide===i?'selected':''}" aria-pressed="${nutrientSlide===i}" onclick="setNutrientSlide(${i})" data-no-translate>${label}</button>`).join('')}</div><div class="nutritiontrack" id="nutrition-track" onscroll="nutritionSlideChanged(this)"><article class="nutritionslide">${combinedNutrition()}</article><article class="nutritionslide" aria-label="${labels[1]}">${microBars()}</article></div></section>`;
  };
  const dsSlideChanged=nutritionSlideChanged;nutritionSlideChanged=function(...args){let result=dsSlideChanged.apply(this,args);document.querySelectorAll('.dsslideswitch button').forEach((el,i)=>el.setAttribute('aria-pressed',String(i===nutrientSlide)));return result};
}

/* ---------- Tab-Leiste und Seitenrahmen ---------- */
const dsTabs=[['workout','barbell','Training','Training'],['home','house','Übersicht','Overview'],['add','plus-circle','Hinzufügen','Add'],['food','fork-knife','Essen','Food'],['account','user-circle','Konto','Account']];
let dsLastPage=null;
function dsChrome(){
  let nav=$('nav');
  if(nav)nav.innerHTML=dsTabs.map(([id,icon,de,en])=>{let current=page===id;return `<button type="button" class="${current?'active ':''}${id==='add'?'centraladd':''}" ${current?'aria-current="page"':''} onclick="${id==='add'?'quickAddMenu()':`go('${id}')`}"><span class="ico" aria-hidden="true">${phIcon(icon)}</span><span class="navlabel">${dsText(de,en)}</span></button>`}).join('');
  let title=$('title'),subtitle=$('subtitle'),tab=dsTabs.find(x=>x[0]===page);
  if(title&&tab)title.textContent=dsText(tab[2],tab[3]);
  if(subtitle)subtitle.textContent='';
  if(title)title.hidden=page==='account'&&typeof accountSection!=='undefined'&&!!accountSection;
  let identity=$('workout-identity');if(identity&&page!=='workout')identity.hidden=true;
  let content=$('content');
  content?.querySelectorAll('.caloriedial:not([data-ds-ring])').forEach(dial=>{
    dial.dataset.dsRing='1';let fill=parseFloat(dial.style.getPropertyValue('--fill'))||0;
    dial.insertAdjacentHTML('afterbegin',dsRing(fill,totals().kcal>((typeof dayGoals==='function'?dayGoals(date):state.goals)?.kcal||Infinity)));
  });
  if(dsLastPage!==page){dsLastPage=page;content?.querySelectorAll('.dsring').forEach(ring=>ring.classList.add('dsringanimate'))}
  dsDecorateFileInputs(content);
  dsDecorateDecimals(content);
  dsDecoratePasswords(content||document);
  dsRenderConnectivity(window.pulsConnectivity);
}
const dsRenderBase=render;render=function(...args){let result=dsRenderBase.apply(this,args);dsChrome();return result};

/* Fenster: Schließen-Symbol, Passwortfelder, Anmeldung im neuen Stil. */
function dsDecorateSheet(){
  let body=$('mb');if(!body)return;
  let close=document.querySelector('#modal .modalhead button.quiet');
  if(close&&!close.querySelector('.pulsicon')){close.innerHTML=phIcon('x');if(!close.getAttribute('aria-label'))close.setAttribute('aria-label',dsText('Schließen','Close'))}
  if($('cloud-email'))body.querySelector('form')?.classList.add('dsauth');
  dsDecoratePasswords(body);dsDecorateFileInputs(body);dsDecorateDecimals(body);
}
const dsOpenModal=openModal;openModal=function(...args){let result=dsOpenModal.apply(this,args);dsDecorateSheet();return result};

/* ---------- Darstellung: System / Hell / Dunkel ---------- */
function dsCurrentScheme(){
  try{if(typeof getColorScheme==='function')return getColorScheme()}catch{}
  return ['system','light','dark'].includes(state?.colorScheme)?state.colorScheme:'system';
}
function dsChooseScheme(mode){
  if(typeof setColorScheme!=='function')return;
  setColorScheme(mode);render();
  document.querySelector(`.dsappearance [data-scheme-choice="${mode}"]`)?.focus({preventScroll:true});
}
function dsAppearanceCard(){
  let current=dsCurrentScheme();
  return `<section class="card dsappearance"><h3>${dsText('Farbschema','Colour scheme')}</h3><div class="segmented dsscheme" role="group" aria-label="${dsText('Darstellung','Appearance')}">${[['system',dsText('System','System')],['light',dsText('Hell','Light')],['dark',dsText('Dunkel','Dark')]].map(([key,label])=>`<button type="button" data-scheme-choice="${key}" aria-pressed="${current===key}" onclick="dsChooseScheme('${key}')" data-no-translate>${label}</button>`).join('')}</div><p class="note">${dsText('System folgt der Einstellung deines Geräts.','System follows your device setting.')}</p></section>`;
}
if(typeof accountAppearanceCard==='function'){const dsAppearanceBase=accountAppearanceCard;accountAppearanceCard=function(...args){return dsAppearanceCard()+dsAppearanceBase.apply(this,args)}}
if(typeof accountSections!=='undefined'){let entry=accountSections.find(x=>x.key==='design');if(entry){entry.title='Darstellung';entry.note='Hell, Dunkel, Sprache & App-Icon'}}
// Frühere Design- und Farbauswahl ist ohne Oberfläche; der Platzhalter hält den Kontobereich „Darstellung“ erreichbar.
designChooser=function(){return '<section class="card designchooser" hidden></section>'};

// Spät hinzugefügte Fenster-Inhalte (Tabs, Suchergebnisse) bekommen ebenfalls den gestalteten Dateiknopf.
if($('mb'))new MutationObserver(()=>{dsDecorateFileInputs($('mb'));dsDecorateDecimals($('mb'))}).observe($('mb'),{childList:true,subtree:true});
// Das Erststart-Fenster öffnet sich schon vor diesem Skript.
if(modal?.open)dsDecorateSheet();

// Übersetzungen für Texte, die in Schritt 2 ihre Symbole verloren haben oder neu sind.
// Bestehende Einträge mit Pfeil/Häkchen/Plus gelten auch ohne das Zeichen; vorhandene Übersetzungen bleiben unangetastet.
function dsAddEnglish(map){if(typeof englishUI!=='object')return;for(let [key,value] of Object.entries(map))if(!(key in englishUI))englishUI[key]=value}
if(typeof englishUI==='object'){
  let derived={};
  for(let [key,value] of Object.entries(englishUI)){
    let plain=key.replace(/^[＋★☆♫▥◎⌁↓←‹●]\s*/u,'').replace(/\s*[↗→✓›]$/u,'').trim();
    if(plain&&plain!==key)derived[plain]=String(value).replace(/^[＋★☆♫▥◎⌁↓←‹●+]\s*/u,'').replace(/\s*[↗→✓›]$/u,'').trim();
  }
  dsAddEnglish(derived);
}
dsAddEnglish({'Foto aufnehmen':'Take photo','Aus Fotos wählen':'Choose from photos','Bitte eine Zahl eingeben.':'Please enter a number.','Beenden':'Finish','Workout öffnen':'Open workout','Starten':'Start','Fertig':'Done','Abgeschlossen':'Completed','Bestleistung':'Personal best','Übung hinzufügen':'Add exercise','Satz hinzufügen':'Add set','Satz':'Set','Erledigt':'Done','Leeres Workout starten':'Start empty workout','Routine':'Routine','Routine erstellen':'Create routine','Alle Routinen':'All routines','Plan anpassen':'Adjust plan','Gesamtwasser':'Total water','250 ml Wasser hinzufügen':'Add 250 ml water','250 ml Wasser erfasst':'250 ml water logged','Essen hinzufügen':'Add food','Nährwertfoto':'Label photo','Dein Ziel':'Your goal','Körper':'Body','Plan & Entwicklung':'Plan & development','Einstellungen':'Settings','Ziele anpassen':'Edit goals','Zielgewicht':'Target weight','Gewicht erfassen':'Log weight','Angemeldet':'Signed in','Nicht angemeldet':'Not signed in','Nur auf diesem Gerät gespeichert':'Stored on this device only','Foto auswählen':'Choose photo','Datei auswählen':'Choose file','Sicherungsdatei auswählen':'Choose backup file','Anstieg':'Ascent','Höhenmeter':'Elevation gain','Gewicht':'Weight','Tag vollständig':'Day complete','Eingetragen':'Logged','Workout abgeschlossen':'Workout completed','Neue Leistung':'New best','Zum Workout':'Back to workout','Geglätteter Trend':'Smoothed trend','Messwerte':'Measurements','Konto zurücksetzen':'Reset account','Vorherige':'Previous','Weitere Produkte':'More products','Mit Kamera scannen':'Scan with camera','Originalprodukt ansehen':'View original product','Öffnen':'Open','Heute gegessen':'Eaten today','Mikronährstoffe':'Micronutrients'});
if(typeof englishUI==='object')Object.assign(englishUI,{'Darstellung':'Appearance','Farbschema':'Colour scheme','Hell, Dunkel, Sprache & App-Icon':'Light, dark, language & app icon','Übersicht':'Overview','Essen':'Food','Konto':'Account','Hinzufügen':'Add'});

render();
