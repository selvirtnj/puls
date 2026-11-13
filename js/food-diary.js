/* PULS v87 · Essen-Tab als Tagebuch: Kopfzeile (Datum, Plus), wischbares Zusammenfassungs-Deck
   (Start bei Makro-Zielen, Energie links davon), Wasserkarte mit Gläsern und chronologisches Tagebuch ohne Kategorien.
   Ist die einzige nutrition() (Refactor Phase 4; die frühere Kette aus 14 überschriebenen Funktionen lag unter ihr und lief nie). Datenwege bleiben die bestehenden: addWaterGlass(ml), waterForm/logWater,
   editDiaryFood, deleteSwipeDiary/undoDiaryDelete (Rückgängig), markFoodDayComplete, microTargetForm.
   Optionale v87-Felder (display, water, meals, foodSearch) werden nur über geschützte Getter gelesen. */

/* ---------- Geschützte Getter für v87-Felder (nach Profilwechsel evtl. undefined) ---------- */
const fdDefaults={display:{summaryViews:['energy','micros','week'],showRemaining:false,highlighted:['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'],hapticsEnabled:true,motion:'system'},water:{mode:'auto',glassMl:250},foodSearch:{sort:'best',sources:['bls','usda','ciqual','off','own','puls','cnf']}};
function fdField(key){
  try{let getter=window.pulsData87?.[key];if(typeof getter==='function'){let value=getter.call(window.pulsData87);if(value!==undefined&&value!==null)return value}}catch{}
  let value=state?.[key];
  if(key==='meals')return Array.isArray(value)?value:[];
  let base=fdDefaults[key]||{};
  return value&&typeof value==='object'&&!Array.isArray(value)?{...base,...value}:{...base};
}
function fdDisplay(){return fdField('display')}
function fdWaterSettings(){return fdField('water')}
// Vor dem Schreiben sicherstellen, dass das Objekt existiert (Standardwerte nur im Speicher).
function fdEnsure(key){
  if(state[key]&&typeof state[key]==='object')return state[key];
  try{window.pulsData87?.migrate?.(state)}catch{}
  if(!state[key]||typeof state[key]!=='object')state[key]=key==='meals'?[]:JSON.parse(JSON.stringify(fdDefaults[key]||{}));
  return state[key];
}
function fdT(de,en){return state?.language==='en'?en:de}
function fdSound(kind){try{if(typeof pulsSound==='function')pulsSound(kind)}catch{}}
function fdReduced(){return document.documentElement.classList.contains('reduce-motion')||!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
function fdIsWater(x){return !!x&&x.name==='Trinkwasser'&&x.unit==='ml'&&!(Number(x.kcal)>0)}
function fdDayFoods(day=date){return (state.foods||[]).filter(x=>x.date===day)}
function fdNum(value,digits=0){let f=10**digits;return n(Math.round((Number(value)||0)*f)/f)}

/* ---------- Rückgängig-Hinweis (auch für Add Food genutzt) ---------- */
let fdUndoTimer=null,fdUndoAction=null;
if(typeof modal!=='undefined')modal.addEventListener('close',()=>{let box=$('fd-undo');if(box&&modal.contains(box))document.body.appendChild(box)});
function fdUndoToast(text,undo){
  clearTimeout(fdUndoTimer);fdUndoAction=undo;
  let box=$('fd-undo');
  // Im offenen modalen Dialog ist alles außerhalb inert; der Hinweis muss daher im Dialog liegen.
  let host=typeof modal!=='undefined'&&modal.open?modal:document.body;
  if(!box){box=document.createElement('div');box.id='fd-undo';box.setAttribute('role','status')}
  if(box.parentElement!==host)host.appendChild(box);
  box.innerHTML=`<span data-no-translate>${esc(text)}</span><button type="button" onclick="fdUndoRun()">${fdT('Rückgängig','Undo')}</button>`;
  box.classList.remove('fdundoin');void box.offsetWidth;box.classList.add('fdundoin');
  fdUndoTimer=setTimeout(()=>{box.remove();fdUndoAction=null},8000);
}
function fdUndoRun(){let action=fdUndoAction;fdUndoAction=null;clearTimeout(fdUndoTimer);$('fd-undo')?.remove();if(typeof action==='function'&&action()!==false)fdSound('undo')}

/* ---------- Kopf ---------- */
function fdHead(){
  let label=esc(friendlyDay(date));
  // v89: sichtbar kompakt (So., 8.11.), damit links Platz für den Titel bleibt; vorgelesen wird das volle Datum.
  let short=date===today()?label:esc(new Date(date+'T12:00:00').toLocaleDateString(typeof appLocale==='function'?appLocale():'de-DE',date.slice(0,4)!==today().slice(0,4)?{day:'numeric',month:'numeric',year:'2-digit'}:{weekday:'short',day:'numeric',month:'numeric'}));
  return `<div class="fdhead"><h1 class="fdtitle">${fdT('Essen','Food')}</h1><div class="fddate"><button type="button" class="fdicon" aria-label="${fdT('Vorheriger Tag','Previous day')}" onclick="moveDay(-1)">${phIcon('caret-left')}</button><button type="button" class="fddaylabel" aria-label="${fdT('Datum auswählen','Choose date')}: ${label}" onclick="pickDiaryDate()"><span>${short}</span></button><button type="button" class="fdicon" aria-label="${fdT('Nächster Tag','Next day')}" onclick="moveDay(1)">${phIcon('caret-right')}</button></div><button type="button" class="fdicon fdplus" aria-label="${fdT('Lebensmittel hinzufügen','Add food')}" onclick="fdOpenAdd()">${phIcon('plus')}</button></div>`;
}
let fdJustChecked=false;
function fdToggleDay(){fdJustChecked=true;setTimeout(()=>fdJustChecked=false,0);let was=(state.foodLogCompleted||[]).includes(date);markFoodDayComplete();fdSound(was?'toggle':'save')}
function fdOpenAdd(){fdSound('sheetOpen');foodForm();if(typeof foodTab==='function')foodTab('search')}

/* ---------- Deck ---------- */
let fdSlide=0,fdLastKey='',fdEnter=false,fdSlideFrame=0;
function fdViews(){let saved=fdDisplay().summaryViews,list=Array.isArray(saved)?saved.filter(v=>['energy','micros','week'].includes(v)):fdDefaults.display.summaryViews;return [...(list.includes('energy')?['energy']:[]),'macros',...new Set(list.filter(v=>v!=='energy'))]}
const fdViewNames={macros:['Makro-Ziele','Macro targets'],energy:['Energie','Energy'],micros:['Nährstoffe','Nutrients'],week:['Woche','Week']};
function fdBar(label,value,goal,unit,cls=''){
  let remaining=fdDisplay().showRemaining===true,over=goal>0&&value>goal+1e-9,pct=goal>0?Math.min(100,value/goal*100):0,digits=unit==='kcal'?0:1;
  let right=goal>0?(over?'+'+fdNum(value-goal,digits)+' '+unit+' '+fdT('über Ziel','over'):remaining?fdNum(goal-value,digits)+' '+unit+' '+fdT('übrig','left'):fdNum(value,digits)+' / '+fdNum(goal,digits)+' '+unit):fdNum(value,digits)+' '+unit;
  return `<div class="fdbar ${cls}${over?' fdover':''}"><div class="fdbarline"><span>${label}</span><strong>${right}</strong></div><div class="fdmeter" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="--w:${pct}%"></i></div></div>`;
}
function fdSlideMacros(){
  let t=totals(),g=(typeof dayGoals==='function'?dayGoals(date):state.goals)||{},remaining=fdDisplay().showRemaining===true;
  return `<div class="fdslidehead"><h2>${fdT('Makro-Ziele','Macro targets')}</h2><div class="fdswitch" role="group" aria-label="${fdT('Anzeige','Display')}"><button type="button" aria-pressed="${!remaining}" onclick="fdSetRemaining(false)">${fdT('Gegessen','Eaten')}</button><button type="button" aria-pressed="${remaining}" onclick="fdSetRemaining(true)">${fdT('Übrig','Left')}</button></div></div>`+
    fdBar(fdT('Energie','Energy'),t.kcal,Number(g.kcal)||0,'kcal','fdkcal')+fdBar('Protein',t.p,Number(g.p)||0,'g','fdp')+fdBar(fdT('Kohlenhydrate','Carbohydrates'),t.c,Number(g.c)||0,'g','fdc')+fdBar(fdT('Fett','Fat'),t.f,Number(g.f)||0,'g','fdf');
}
function fdSetRemaining(value){let d=fdEnsure('display');if(d.showRemaining===value)return;d.showRemaining=value;save();fdSound('toggle');render()}
function fdBurn(){
  let p=state.profile;if(!p||typeof profileError!=='function'||profileError(p)||typeof energyFor!=='function')return null;
  try{let w=(typeof currentWeight==='function'&&currentWeight())||p.weight,e=energyFor({...p,weight:w},w,state.plan,date);return Number.isFinite(e?.tdee)&&e.tdee>0?e.tdee:null}catch{return null}
}
function fdRingCell(value,percent,label,over=false,sub=''){return `<div class="fdringcell"><div class="fdringwrap">${dsRing(percent,over)}<div class="fdringval"><strong>${fdNum(value)}</strong><small>kcal</small></div></div><span>${label}</span>${sub?`<small>${sub}</small>`:''}</div>`}
function fdSlideEnergy(){
  let t=totals(),goal=Number(((typeof dayGoals==='function'?dayGoals(date):state.goals)||{}).kcal)||0,burn=fdBurn(),left=goal-t.kcal;
  let cells=fdRingCell(t.kcal,goal>0?t.kcal/goal*100:0,fdT('Gegessen','Eaten'),goal>0&&t.kcal>goal);
  cells+=burn?fdRingCell(burn,100,fdT('Verbrauch','Burned'),false,fdT('Schätzung','Estimate')):`<div class="fdringcell fdmissing"><button type="button" class="textbtn" onclick="${typeof profileForm==='function'?'profileForm()':'settings()'}">${fdT('Profil ergänzen','Complete profile')}</button><small>${fdT('für den Verbrauch','for energy use')}</small></div>`;
  cells+=goal>0?fdRingCell(Math.abs(left),left>=0?left/goal*100:100,left>=0?fdT('Übrig','Left'):fdT('Über Ziel','Over'),left<0):`<div class="fdringcell fdmissing"><small>${fdT('Kein Tagesziel','No daily target')}</small></div>`;
  return `<div class="fdslidehead"><h2>${fdT('Energie','Energy')}</h2></div><div class="fdrings">${cells}</div>`;
}
function fdHighlighted(){let keys=fdDisplay().highlighted;return (Array.isArray(keys)?keys:fdDefaults.display.highlighted).filter(k=>typeof nutrientLabels==='object'&&nutrientLabels[k]).slice(0,8)}
function fdMicroGoal(key){let own=Number(state.microGoals?.[key]);if(own>0)return own;let refs=typeof referenceMicros==='function'?referenceMicros():null;return Number(refs?.[key])||0}
function fdSlideMicros(){
  let nt=nutrientTotals(),keys=fdHighlighted();
  let cells=keys.map(k=>{let [label,unit]=nutrientLabels[k],goal=fdMicroGoal(k),has=(nt.coverage?.[k]||0)>0,value=nt.totals?.[k]||0,pct=goal>0?value/goal*100:0;
    return `<div class="fdmicro${has?'':' fdunknown'}"><div class="fdbarline"><span>${label}</span><strong>${has?(goal>0?Math.round(pct)+' %':fdNum(value,1)+' '+unit):fdT('keine Angabe','no data')}</strong></div><div class="fdmeter"><i style="--w:${has&&goal>0?Math.min(100,pct):0}%"></i></div></div>`}).join('');
  return `<div class="fdslidehead"><h2>${fdT('Hervorgehobene Nährstoffe','Highlighted nutrients')}</h2><button type="button" class="textbtn" onclick="microTargetForm()">${fdT('Ziele','Targets')}</button></div><div class="fdmicros">${cells}</div>${fdAllButton()}`;
}

/* ---------- Alle Nährstoffe (nur lesend; nichts Neues wird gespeichert) ---------- */
// Gruppen der Anzeige; der erste Schlüssel einer Makrogruppe ist die Hauptzeile, die übrigen sind „davon“-Zeilen.
const fdAllGroups=[
  ['Kohlenhydrate','Carbohydrates',['c','sugars','glucose','fructose','galactose','sucrose','lactose','maltose','starch','polyols','fiber','fiber_sol','fiber_insol'],true],
  ['Fette','Fats',['f','satfat','mufat','pufat','omega3','omega6','ala','epa','dha','linoleic','arachidonic','transfat','cholesterol'],true],
  ['Eiweiß und Aminosäuren','Protein and amino acids',['p','histidine','isoleucine','leucine','lysine','methionine','phenylalanine','threonine','tryptophan','valine','cysteine','tyrosine'],true],
  ['Vitamine','Vitamins',['vita_rae','retinol','beta_carotene','vitd','vite','vitk','b1','b2','niacin','niacin_ne','b5','b6','biotin','folate','folate_dfe','folic_acid','b12','vitc','choline'],false],
  ['Mineralstoffe','Minerals',['sodium','salt','chloride','potassium','calcium','magnesium','phosphorus','iron','zinc','copper','manganese','selenium','iodine','fluoride','chromium','molybdenum'],false],
  ['Sonstiges','Other',['alcohol','caffeine'],false]
];
// Ohne Zielbalken (Vorgabe): Zucker, gesättigte Fettsäuren, Natrium und Salz.
const fdNoBar=new Set(['sugars','satfat','sodium','salt']);
function fdNutrientDef(key){
  if(key==='salt')return {key,unit:'g',nameDe:'Salz',nameEn:'Salt'};
  return (window.pulsNutrients?.definitions()||[]).find(d=>d.key===key)||null;
}
// Bis zu zwei signifikante Nachkommastellen für kleine Werte, ganze Zahlen ab 100. Unbekannt nie als 0.
function fdNutrientAmount(value){
  if(!Number.isFinite(value))return '–';
  let digits=value===0||value>=100?0:value>=1?1:value>=.1?2:3,shown=Math.round(value*10**digits)/10**digits;
  let fmt=x=>typeof appLocale==='function'?new Intl.NumberFormat(appLocale(),{maximumFractionDigits:digits}).format(x):String(x);
  return value===0||shown>0?fmt(shown):'< '+fmt(10**-digits);
}
// Liefert die Zeilen einer Gruppe: [{key,label,unit,value,known,total,sub}] nur für bekannte Werte.
function fdNutrientRows(get){
  return fdAllGroups.map(([de,en,keys,macro])=>{
    let rows=keys.map((key,i)=>{let def=fdNutrientDef(key),v=get(key==='salt'?'sodium':key);if(!def||!v||!Number.isFinite(v.value))return null;
      return {key,label:fdT(def.nameDe,def.nameEn),unit:def.unit,value:key==='salt'?v.value*.0025:v.value,known:v.known,total:v.total,sub:macro&&i>0}}).filter(Boolean);
    return {title:fdT(de,en),rows};
  }).filter(g=>g.rows.length);
}
function fdNutrientGoal(key){
  if(fdNoBar.has(key)||key==='water')return 0;
  if(typeof nutrientLabels==='object'&&nutrientLabels[key])return fdMicroGoal(key);
  return Number(window.pulsNutrientRefs?.reference(key,state.profile))||0;
}
function fdAllButton(){return `<button type="button" class="fdallbtn" onclick="fdAllNutrients()"><span>${fdT('Alle Nährstoffe','All nutrients')}</span>${phIcon('caret-right')}</button>`}
function fdAllDayEntries(){return fdDayFoods().filter(x=>!fdIsWater(x))}
function fdAllNutrients(){
  let api=window.pulsNutrients;if(!api)return;
  fdSound('sheetOpen');
  let token=String(++fdAllOpenCount),day=date,profile=state;
  openModal(fdT('Alle Nährstoffe','All nutrients'),`<div class="fdall" id="fd-all" data-day="${esc(date)}" data-open="${token}"></div>`);
  fdAllRender();
  // Bei jedem Öffnen nachladen: geladene Dateien kehren sofort zurück, fehlgeschlagene werden erneut versucht.
  // Neu gezeichnet wird nur dasselbe offene Sheet für denselben Tag und dasselbe Profil.
  Promise.resolve(api.ensureForEntries(fdAllDayEntries())).catch(()=>{}).then(()=>{let box=$('fd-all');if(box&&box.dataset.open===token&&date===day&&state===profile)fdAllRender()});
}
let fdAllOpenCount=0;
function fdAllRender(){
  let box=$('fd-all'),api=window.pulsNutrients;if(!box||!api)return;
  let entries=fdAllDayEntries(),t=api.totals(entries);
  let groups=fdNutrientRows(key=>{let x=t.nutrients[key];return x&&x.known>0?{value:x.value,known:x.known,total:x.total}:null});
  let row=r=>{let goal=fdNutrientGoal(r.key),pct=goal>0?r.value/goal*100:0,partial=r.known<r.total;
    return `<div class="fdallrow${r.sub?' fdsub':''}${goal>0?' fdhasgoal':''}"><div class="fdbarline"><span>${esc(r.label)}</span><strong>${fdNutrientAmount(r.value)} ${r.unit}${goal>0?`<small class="fdpct">· ${Math.round(pct)} %</small>`:''}${partial?`<small class="fdcover" title="${r.known}/${r.total} ${fdT('Einträge mit Wert','entries with data')}" >${r.known}/${r.total}</small>`:''}</strong></div>${goal>0?`<div class="fdmeter"><i style="--w:${Math.min(100,pct)}%"></i></div>`:''}</div>`};
  let body=groups.map(g=>`<section class="fdallgroup"><h4>${esc(g.title)}</h4><div class="fdallrows">${g.rows.map(row).join('')}</div></section>`).join('');
  box.innerHTML=body||(t.pending?fdAllPlaceholder():`<p class="fdempty">${fdT('Keine Angaben','No data')}</p>`);
  if(body&&t.pending)box.insertAdjacentHTML('beforeend',fdAllPlaceholder());
}
function fdAllPlaceholder(){return `<div class="fdallwait" aria-busy="true" aria-label="${fdT('Wird geladen','Loading')}"><i></i><i></i><i></i></div>`}
// Übersicht: dieselbe Zeile unter den Mikronährstoffen (microBars in flows.js/design-system.js).
if(typeof microBars==='function'){const fdMicroBarsBase=microBars;microBars=function(...args){return fdMicroBarsBase.apply(this,args)+fdAllButton()}}
function fdWeekStats(endDay=date){
  let sums={kcal:0,p:0,c:0,f:0},days=0,end=new Date(endDay+'T12:00:00');
  for(let i=0;i<7;i++){let d=new Date(end);d.setDate(d.getDate()-i);let key=localISO(d),items=fdDayFoods(key).filter(x=>!fdIsWater(x));if(!items.length)continue;days++;for(let x of items)for(let k of Object.keys(sums))sums[k]+=Number(x[k])||0}
  let avg=Object.fromEntries(Object.entries(sums).map(([k,v])=>[k,days?v/days:0]));
  return {days,avg};
}
function fdSlideWeek(){
  let {days,avg}=fdWeekStats(),g=(typeof dayGoals==='function'?dayGoals(date):state.goals)||{};
  let body=days?fdBarPlain(fdT('Energie','Energy'),avg.kcal,Number(g.kcal)||0,'kcal','fdkcal')+fdBarPlain('Protein',avg.p,Number(g.p)||0,'g','fdp')+fdBarPlain(fdT('Kohlenhydrate','Carbohydrates'),avg.c,Number(g.c)||0,'g','fdc')+fdBarPlain(fdT('Fett','Fat'),avg.f,Number(g.f)||0,'g','fdf'):`<p class="fdempty">${fdT('In den letzten 7 Tagen noch keine Einträge.','No entries in the last 7 days.')}</p>`;
  return `<div class="fdslidehead"><h2>${fdT('Wochenschnitt','Weekly average')}</h2><small>${days} ${days===1?fdT('Tag mit Einträgen','day with entries'):fdT('Tage mit Einträgen','days with entries')}</small></div>${body}`;
}
function fdBarPlain(label,value,goal,unit,cls){let over=goal>0&&value>goal,pct=goal>0?Math.min(100,value/goal*100):0,digits=unit==='kcal'?0:1;return `<div class="fdbar ${cls}${over?' fdover':''}"><div class="fdbarline"><span>${label}</span><strong>${fdNum(value,digits)}${goal>0?' / '+fdNum(goal,digits):''} ${unit}</strong></div><div class="fdmeter"><i style="--w:${pct}%"></i></div></div>`}
function fdDeck(){
  let views=fdViews();fdSlide=Math.max(0,Math.min(views.length-1,fdSlide));
  let make={macros:fdSlideMacros,energy:fdSlideEnergy,micros:fdSlideMicros,week:fdSlideWeek};
  let slides=views.map((v,i)=>`<article class="fdslide" data-view="${v}" role="group" aria-roledescription="${fdT('Folie','slide')}" aria-label="${fdT(...fdViewNames[v])} (${i+1}/${views.length})">${make[v]()}</article>`).join('');
  let dots=views.map((v,i)=>`<button type="button" class="fddot" aria-label="${fdT(...fdViewNames[v])}" aria-current="${i===fdSlide}" onclick="fdGoSlide(${i})"></button>`).join('');
  return `<section class="fddeck"><div class="fdtrack" id="fd-track" onscroll="fdSlideChanged(this)">${slides}</div><div class="fddecknav"><button type="button" class="fdicon fdarrow" aria-label="${fdT('Vorherige Ansicht','Previous view')}" onclick="fdGoSlide(fdSlide-1)">${phIcon('caret-left')}</button><div class="fddots">${dots}</div><button type="button" class="fdicon fdarrow" aria-label="${fdT('Nächste Ansicht','Next view')}" onclick="fdGoSlide(fdSlide+1)">${phIcon('caret-right')}</button></div></section>`;
}
function fdMarkDots(){document.querySelectorAll('.fddeck .fddot').forEach((el,i)=>el.setAttribute('aria-current',String(i===fdSlide)))}
function fdSlideChanged(track){cancelAnimationFrame(fdSlideFrame);fdSlideFrame=requestAnimationFrame(()=>{let i=Math.max(0,Math.min(track.children.length-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));if(i!==fdSlide){fdSlide=i;fdMarkDots()}})}
function fdGoSlide(i){let track=$('fd-track');if(!track)return;let max=track.children.length-1;i=i<0?max:i>max?0:i;fdSlide=i;fdMarkDots();track.scrollTo({left:i*track.clientWidth,behavior:fdReduced()?'auto':'smooth'});fdSound('tap')}

/* ---------- Wasser ---------- */
function fdWaterState(day=date){
  let rec=null;try{rec=window.pulsData87?.waterRecommendation?.(state,day)}catch{}
  if(!rec||!Number.isFinite(rec.ml)){let goal=Number(state.waterGoal)||0;rec={ml:goal>0?goal:2000,mode:goal>0?'manual':'standard'}}
  let glassMl=Number(fdWaterSettings().glassMl);if(!Number.isInteger(glassMl)||glassMl<100||glassMl>1000)glassMl=250;
  let drink=fdDayFoods(day).filter(fdIsWater).reduce((s,x)=>s+(Number(x.grams)||0),0);
  let filled=Math.floor(drink/glassMl+1e-9),total=Math.max(1,Math.ceil(rec.ml/glassMl)),count=Math.min(7,Math.max(total,filled+1));
  return {goal:rec.ml,mode:rec.mode,glassMl,drink,filled,count,partial:Math.max(0,Math.min(1,(drink-filled*glassMl)/glassMl))};
}
let fdWaterMemory={key:'',filled:-1};
function fdGlass(i,w,fresh){
  let full=i<w.filled,next=i===w.filled,level=full?1:next?w.partial:0;
  let label=full?`${fdT('Glas','Glass')} ${i+1}, ${fdT('getrunken. Tippen entfernt das letzte Glas.','logged. Tap to remove the last glass.')}`:`${fdT('Glas','Glass')} ${i+1}. ${fdT('Tippen fügt','Tap adds')} ${n(w.glassMl)} ml ${fdT('hinzu.','')}`.replace(' .','.');
  return `<button type="button" class="fdglass${full?' fdfull':''}${next?' fdnext':''}${fresh?' fdfill':''}" style="--level:${level}" aria-label="${label}" onclick="fdGlassTap(${i})"><svg viewBox="0 0 24 32" aria-hidden="true"><path class="fdglasswater" d="M4.4 4h15.2l-2.1 24.3a1.8 1.8 0 0 1-1.8 1.7H8.3a1.8 1.8 0 0 1-1.8-1.7Z"/><path class="fdglassline" d="M3.2 2.8h17.6l-2.2 25.6a2.8 2.8 0 0 1-2.8 2.6H8.2a2.8 2.8 0 0 1-2.8-2.6Z"/></svg>${next?`<span class="fdglassplus">${phIcon('plus')}</span>`:i===Math.min(w.filled,w.count)-1?`<span class="fdglassplus fdglassminus">${phIcon('minus')}</span>`:''}</button>`;
}
function fdWaterCard(){
  let w=fdWaterState(),nt=nutrientTotals(),total=nt.totals?.water||0,key=date,fresh=fdWaterMemory.key===key&&w.filled>fdWaterMemory.filled?w.filled-1:-1;
  fdWaterMemory={key,filled:w.filled};
  let glasses=Array.from({length:w.count},(_,i)=>fdGlass(i,w,i===fresh)).join('');
  if(w.filled>=w.count)glasses+=`<button type="button" class="fdicon" aria-label="${fdT('Wasser hinzufügen','Add water')} ${w.glassMl} ml" onclick="fdGlassTap(${w.filled})">${phIcon('plus')}</button>`;
  let pct=w.goal>0?Math.min(100,total/w.goal*100):0;
  return `<section class="fdcard fdwater"><div class="fdcardhead"><div><h2>${fdT('Wasser','Water')}</h2><small>${fdNum(w.drink)} / ${fdNum(w.goal)} ml</small></div><div class="fdcardactions"><button type="button" class="fdicon" aria-label="${fdT('Wasserziel und Glasgröße','Water target and glass size')}" onclick="fdWaterInfo()">${phIcon('info')}</button><button type="button" class="fdicon" aria-label="${fdT('Freie Menge Wasser eintragen','Log custom water amount')}" onclick="waterForm()">${phIcon('plus')}</button></div></div><div class="fdglasses" role="group" aria-label="${fdT('Wassergläser','Water glasses')}">${glasses}</div><div class="fdbar fdtotalwater"><div class="fdbarline"><span>${fdT('Gesamtwasser','Total water')}</span><strong>${fdNum(total)} / ${fdNum(w.goal)} ml</strong></div><div class="fdmeter"><i style="--w:${pct}%"></i></div></div></section>`;
}
function fdGlassTap(i){
  let w=fdWaterState();
  if(i<w.filled){fdWaterRemoveGlass(w);return}
  addWaterGlass(w.glassMl);fdSound('water');
}
// v90: „−“ entfernt genau eine Glasgröße, beginnend beim jüngsten Trinkwasser-Eintrag:
// Einträge bis zur Restmenge werden gelöscht, ein größerer Eintrag wird verkleinert. Ein Klang, ein Rückgängig.
function fdWaterRemoveGlass(w=fdWaterState()){
  let list=state.foods.map((x,index)=>({x,index})).filter(({x})=>x.date===date&&fdIsWater(x)&&Number(x.grams)>0).sort((a,b)=>(Number(a.x.loggedAt)||0)-(Number(b.x.loggedAt)||0)||a.index-b.index);
  let left=w.glassMl,touched=[],removed=new Set(),replaced=new Map();
  for(let k=list.length-1;k>=0&&left>1e-9;k--){
    let {x,index}=list[k],ml=Number(x.grams);
    touched.push({index,copy:JSON.parse(JSON.stringify(x))});
    // Rest auf 0,1 ml runden; unter der gültigen Mindestmenge (validData: 0,1) wird der Eintrag ganz gelöscht.
    let raw=ml-left,rest=Math.round(raw*10)/10;
    if(ml<=left+1e-9||!(raw>=.1-1e-9)||!(rest>=.1)){removed.add(x.id);left-=ml;continue}
    let f=rest/ml,next=JSON.parse(JSON.stringify(x));
    for(let key of ['kcal','p','c','f'])if(Number.isFinite(Number(next[key])))next[key]=Number(next[key])*f;
    if(next.nutrients&&typeof next.nutrients==='object')for(let [key,v] of Object.entries(next.nutrients))if(Number.isFinite(v))next.nutrients[key]=key==='water'&&v===ml?rest:v*f;
    next.grams=rest;replaced.set(x.id,next);left=0;
  }
  if(!touched.length)return;
  const apply=()=>state.foods.filter(x=>!removed.has(x.id)).map(x=>replaced.get(x.id)||x);
  let foods=apply();
  // Ein vorher gültiger Zustand muss gültig bleiben (Sicherung/Cloud-Pull); sonst verkleinerten Eintrag ganz löschen.
  if(typeof validData==='function'&&replaced.size){let ok=s=>{try{return validData(JSON.parse(JSON.stringify(s)))}catch{return false}};if(ok(state)&&!ok({...state,foods})){for(let id of replaced.keys())removed.add(id);replaced.clear();foods=apply()}}
  state.foods=foods;
  const profile=state,owner=fdOwner(),expected=[...replaced.values()].map(x=>[x.id,JSON.stringify(x)]),gone=[...removed];
  save();render();fdSound('delete');
  fdUndoToast(fdT(`${n(w.glassMl)} ml Wasser entfernt`,`${n(w.glassMl)} ml water removed`),()=>{
    // Nur exakt den Zwischenstand direkt nach dem Minus zurücknehmen; spätere Änderungen (z. B. Cloud) still behalten.
    if(state!==profile||fdOwner()!==owner||gone.some(id=>state.foods.some(x=>x.id===id))||expected.some(([id,json])=>{let x=state.foods.find(y=>y.id===id);return !x||JSON.stringify(x)!==json}))return false;
    for(let {index,copy} of touched.slice().sort((a,b)=>a.index-b.index)){let at=state.foods.findIndex(x=>x.id===copy.id);if(at>=0)state.foods[at]=copy;else state.foods.splice(Math.min(index,state.foods.length),0,copy)}
    save();render();
  });
}
function fdOwner(){try{return typeof cloudSession!=='undefined'?cloudSession?.user?.id||'local':'local'}catch{return 'local'}}
function fdWaterInfo(){
  let s=fdWaterSettings(),w=fdWaterState(),manual=s.mode==='manual',rec=null;try{rec=window.pulsData87?.waterRecommendation?.({...state,waterGoal:0,water:{...s,mode:'auto'}},date)}catch{}
  let auto=rec?(rec.mode==='auto'?fdNum(rec.ml)+' ml':fdT('2.000 ml Standard (kein Gewicht)','2,000 ml default (no weight)')):'–';
  openModal(fdT('Wasserziel','Water target'),`<form class="fdwaterform" onsubmit="fdSaveWater(event)"><div class="segmented fdmode" role="group" aria-label="${fdT('Ziel','Target')}"><button type="button" data-mode="auto" aria-pressed="${!manual}" onclick="fdWaterMode('auto')">${fdT('Automatisch','Automatic')}</button><button type="button" data-mode="manual" aria-pressed="${manual}" onclick="fdWaterMode('manual')">${fdT('Eigenes Ziel','Custom')}</button></div><input type="hidden" id="fd-water-mode" value="${manual?'manual':'auto'}"><p class="note">${fdT('Automatisch heute','Automatic today')}: <strong>${auto}</strong></p><label id="fd-water-goal-row" ${manual?'':'hidden'}>${fdT('Eigenes Tagesziel · ml','Custom daily target · ml')}<input id="fd-water-goal" type="number" inputmode="numeric" min="500" max="10000" step="1" value="${Number(state.waterGoal)>0?state.waterGoal:Math.round(w.goal)}"></label><label>${fdT('Glasgröße · ml','Glass size · ml')}<input id="fd-water-glass" type="number" inputmode="numeric" min="100" max="1000" step="1" required value="${w.glassMl}"></label><button class="btn full">${fdT('Speichern','Save')}</button></form>`);
}
function fdWaterMode(mode){if(!$('fd-water-mode'))return;$('fd-water-mode').value=mode;document.querySelectorAll('.fdmode [data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('fd-water-goal-row').hidden=mode!=='manual';fdSound('toggle')}
function fdSaveWater(event){
  event.preventDefault();let mode=$('fd-water-mode').value==='manual'?'manual':'auto',glass=Math.round(Number($('fd-water-glass').value)),goal=Math.round(Number($('fd-water-goal').value));
  if(!(glass>=100&&glass<=1000)){toast(fdT('Glasgröße 100 bis 1.000 ml','Glass size 100 to 1,000 ml'));return}
  if(mode==='manual'&&!(goal>=500&&goal<=10000)){toast(fdT('Ziel 500 bis 10.000 ml','Target 500 to 10,000 ml'));return}
  let water=fdEnsure('water');water.mode=mode;water.glassMl=glass;state.waterGoal=mode==='manual'?goal:0;
  save();modal.close();render();fdSound('save');
}

/* ---------- Tagebuch ---------- */
let fdKnownIds=null;
// IDs stehen nur in data-Attributen, nie in Inline-JavaScript (importierte IDs sind fremde Daten).
document.addEventListener('click',event=>{let el=event.target.closest?.('[data-fd-action]'),id=el?.closest('[data-diary-id]')?.dataset.diaryId;if(!id)return;if(el.dataset.fdAction==='delete'){deleteSwipeDiary(id);fdSound('delete')}else if(el.dataset.fdAction==='edit')editDiaryFood(id)});
function fdDiaryRow(x,fresh){
  let unit=x.unit==='ml'?'ml':'g';
  return `<div class="swipediary fdentry${fresh?' fdnew':''}" data-diary-id="${esc(x.id)}"><button type="button" class="swipedelete" aria-label="${esc(x.name)} ${fdT('löschen','delete')}" data-fd-action="delete">${phIcon('trash')}<span>${fdT('Löschen','Delete')}</span></button><button type="button" class="diaryrow fdentryrow" data-fd-action="edit"><span class="fdentrytext"><strong data-no-translate>${esc(x.name)}</strong><small>${fdNum(x.grams,1)} ${unit}</small></span><span class="fdentrykcal">${fdNum(x.kcal)}<small>kcal</small></span></button></div>`;
}
function fdDiaryList(){
  let items=fdDayFoods().filter(x=>!fdIsWater(x)),ids=new Set(items.map(x=>x.id)),known=fdKnownIds?.key===date?fdKnownIds.ids:null;
  fdKnownIds={key:date,ids};
  let rows=items.map(x=>fdDiaryRow(x,!!known&&!known.has(x.id))).join('');
  let kcal=items.reduce((s,x)=>s+(Number(x.kcal)||0),0);
  let head=`<div class="fdcardhead"><div><h2>${fdT('Tagebuch','Diary')}</h2><small>${items.length} ${items.length===1?fdT('Eintrag','entry'):fdT('Einträge','entries')} · ${fdNum(kcal)} kcal</small></div></div>`;
  let body=rows?`<div class="fdentries">${rows}</div>`:`<div class="fdemptystate"><p>${fdT('Noch nichts eingetragen.','Nothing logged yet.')}</p><button type="button" class="btn" onclick="fdOpenAdd()">${phIcon('plus')} ${fdT('Lebensmittel hinzufügen','Add food')}</button></div>`;
  let done=(state.foodLogCompleted||[]).includes(date);
  return `<section class="fdcard fddiary">${head}${body}${done?`<p class="fdnote fddonenote">${phIcon('check-circle')} ${fdT('Tag vollständig erfasst','Day complete')}</p>`:''}</section>`;
}
function fdSaveCombo(){foodForm();if($('foodbody')&&typeof fpMealEdit==='function')fpMealEdit(null,true)}

/* ---------- Seite ---------- */
function nutrition(){
  let suggestion='';try{suggestion=typeof foodSuggestionCard==='function'?foodSuggestionCard():''}catch{}
  return `<div class="fdroot${fdEnter&&!fdReduced()?' fdenter':''}">${fdHead()}${fdDeck()}${fdWaterCard()}${fdDiaryList()}<div class="fdextras">${suggestion}${typeof productAttribution==='string'?productAttribution:''}</div></div>`;
}
globalThis.renderBeforeFoodDiary=function renderBeforeFoodDiary(){
  let key=page==='food'?'food|'+date:'';
  fdEnter=!!key&&key!==fdLastKey;if(fdEnter){fdSlide=fdViews().indexOf('macros');fdKnownIds=null;fdWaterMemory={key:'',filled:-1}}
  fdLastKey=key;
};
globalThis.renderAfterFoodDiary=function renderAfterFoodDiary(){
  document.body.classList.toggle('fdpage',page==='food');
  if(page==='food'){let track=$('fd-track');if(track){let left=fdSlide*track.clientWidth;if(Math.abs(track.scrollLeft-left)>1)track.scrollTo({left,behavior:'auto'})}}
};
window.addEventListener('resize',()=>{let track=$('fd-track');if(track)track.scrollTo({left:fdSlide*track.clientWidth,behavior:'auto'})});

if(typeof englishUI==='object')for(let [k,v] of Object.entries({'Tagebuch':'Diary','Wasser':'Water','Makro-Ziele':'Macro targets','Gegessen':'Eaten','Übrig':'Left','Wochenschnitt':'Weekly average','Hervorgehobene Nährstoffe':'Highlighted nutrients','Lebensmittel hinzufügen':'Add food','Als Kombi':'As combo','Wasserziel':'Water target','Rückgängig':'Undo'}))if(!(k in englishUI))englishUI[k]=v;
if(typeof page!=='undefined'&&page==='food')render();
