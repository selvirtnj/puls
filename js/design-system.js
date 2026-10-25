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
function dsEnergyCard(){
  let t=totals(),g=(typeof dayGoals==='function'?dayGoals(date):state.goals)||{},goal=Number(g.kcal)||0,eaten=t.kcal,over=goal>0&&eaten>goal,left=goal-eaten;
  let percent=goal>0?eaten/goal*100:0;
  let big=goal>0?(over?'+'+dsKcal(eaten-goal):dsKcal(left))+' kcal':dsKcal(eaten)+' kcal';
  let caption=goal>0?(over?dsText('über dem Tagesziel','over your daily target'):dsText('übrig','left')):dsText('gegessen, kein Tagesziel','eaten, no daily target');
  let macros=[['p',dsText('Protein','Protein')],['c',dsText('Kohlenhydrate','Carbs')],['f',dsText('Fett','Fat')]].map(([k,label])=>{
    let target=Number(g[k])||0,value=t[k]||0,width=target>0?Math.min(100,value/target*100):0,isOver=target>0&&value>target;
    return `<div class="dsmacro"><span>${label}</span><strong>${n(Math.round(value))}${target>0?' / '+n(target):''} g</strong><div class="dsmeter" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${target||0}" aria-valuenow="${Math.round(value)}"><i class="${isOver?'dsover':''}" style="width:${width}%"></i></div></div>`;
  }).join('');
  return `<div class="dsgroup dsenergy"><div class="dsenergytop"><div class="dsringwrap">${dsRing(percent,over)}<div class="dsringlabel"><strong>${dsKcal(eaten)}</strong><small>${goal>0?dsText('von','of')+' '+dsKcal(goal):'kcal'}</small></div></div><div class="dsenergyfacts"><span class="dsbig${over?' dsover':''}">${big}</span><span class="dscaption">${caption}</span></div></div><div class="dsmacros">${macros}</div><button type="button" class="btn full dsprimary" onclick="foodForm();if(typeof foodTab==='function')foodTab('search')">${dsText('Essen eintragen','Log food')}</button></div>`;
}
function dsFoodGroup(){
  let entries=state.foods.filter(x=>x.date===date),shown=entries.slice(-5).reverse();
  let rows=shown.map(x=>dsRow({label:esc(x.name),detail:`${n(x.grams)} ${x.unit==='ml'?'ml':'g'}`,value:dsKcal(x.kcal)+' kcal'})).join('');
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

/* ---------- Emoji-Symbole in App-eigenen Bausteinen durch Phosphor ersetzen ----------
   Nur feste App-Beschriftungen (Serien-Zähler, Wasser-Überschrift); Nutzerinhalte, Eingaben und Lebensmittelnamen
   werden nie verändert. Nur die direkten Textknoten dieser Elemente, Leerzeichen bleiben erhalten. */
const dsEmojiIcons={'🔥':'fire','💧':'drop'};
const dsEmojiTargets='.identitystreak > strong, .accountstreak > strong, .watercompact .waterinline h3, .watercard > .cardhead > h3';
function dsReplaceEmoji(root){
  if(!root?.querySelectorAll)return;
  for(let element of root.querySelectorAll(dsEmojiTargets)){
    if(element.isContentEditable||element.closest('input,textarea,[contenteditable]'))continue;
    for(let node of [...element.childNodes]){
      if(node.nodeType!==3||!/🔥|💧/.test(node.nodeValue))continue;
      let frag=document.createDocumentFragment();
      for(let part of node.nodeValue.split(/(🔥|💧)/)){
        if(dsEmojiIcons[part]){let span=document.createElement('span');span.className='dsinlineicon';span.setAttribute('aria-hidden','true');span.innerHTML=phIcon(dsEmojiIcons[part]);frag.append(span)}
        else if(part)frag.append(document.createTextNode(part));
      }
      node.replaceWith(frag);
    }
  }
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
  dsReplaceEmoji(content);dsReplaceEmoji(identity);
  dsDecoratePasswords(content||document);
  dsRenderConnectivity(window.pulsConnectivity);
}
const dsRenderBase=render;render=function(...args){let result=dsRenderBase.apply(this,args);dsChrome();return result};

/* Fenster: Schließen-Symbol, Passwortfelder, Anmeldung im neuen Stil. */
function dsDecorateSheet(){
  let body=$('mb');if(!body)return;
  let close=document.querySelector('#modal .modalhead button.quiet');
  if(close&&!close.querySelector('svg')){close.innerHTML=phIcon('x');if(!close.getAttribute('aria-label'))close.setAttribute('aria-label',dsText('Schließen','Close'))}
  if($('cloud-email'))body.querySelector('form')?.classList.add('dsauth');
  dsDecoratePasswords(body);dsReplaceEmoji(body);
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

if(typeof englishUI==='object')Object.assign(englishUI,{'Darstellung':'Appearance','Farbschema':'Colour scheme','Hell, Dunkel, Sprache & App-Icon':'Light, dark, language & app icon','Übersicht':'Overview','Essen':'Food','Konto':'Account','Hinzufügen':'Add'});

render();
