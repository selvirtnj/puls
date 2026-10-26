/* Nur noch das Original-Design, ruhigeres Öffnen/Schließen der Fenster (Plus-Menü), eigene Optik für die Essen-Seite. */

// Legacy design selection stays inert; saved backup fields remain untouched.
chooseAppDesign=function(){};

// Fenster schließen mit derselben Gleitbewegung wie beim Wischen (X oben rechts statt hartem Schließen).
dismissSheet=function(){
  if(typeof setupPending!=='undefined'&&setupPending)return;
  clearTimeout(sheetClosingTimer);document.body.classList.remove('quickaddopen');modal.classList.add('sheetclosing');
  sheetClosingTimer=setTimeout(()=>{modal.close();modal.classList.remove('sheetclosing');modal.style.removeProperty('transform')},matchMedia('(prefers-reduced-motion: reduce)').matches?0:260);
};
document.addEventListener('click',event=>{
  let close=event.target.closest('#modal .modalhead button[onclick="modal.close()"]');
  if(!close||(typeof setupPending!=='undefined'&&setupPending))return;
  event.preventDefault();event.stopImmediatePropagation();dismissSheet();
},true);

// Plus-Menü: Knopf dreht sich zum ×, Kacheln erscheinen nacheinander.
const polishQuickAdd=quickAddMenu;quickAddMenu=function(...args){
  if(modal.open&&document.body.classList.contains('quickaddopen')){dismissSheet();return}
  let result=polishQuickAdd.apply(this,args);document.body.classList.add('quickaddopen');return result;
};
modal.addEventListener('close',()=>document.body.classList.remove('quickaddopen'));
const polishOpenSheet=openModal;openModal=function(...args){let quick=document.body.classList.contains('quickaddopen');let result=polishOpenSheet.apply(this,args);if(quick&&!modal.querySelector('.quickactiongrid,.dsactionlist'))document.body.classList.remove('quickaddopen');return result};

// Essen-Seite: eigene Überschrift, damit sie sich beim Wechsel von der Übersicht sofort unterscheidet.
const polishRender=render;render=function(...args){
  let result=polishRender.apply(this,args);
  // „Nährstoffwerte & Ziele im Detail“ entfällt auf der Essen-Seite.
  if(page==='food')document.querySelectorAll('#content details.card').forEach(card=>{if(/Nährstoffwerte|Nutrient values/.test(card.querySelector('summary')?.textContent||''))card.remove()});
  // Übrige Kalorien nur als Zahl: Essen rechts neben „0 von 2.200 kcal“, Übersicht direkt unter dem Ring.
  document.querySelectorAll('#content .nutritionslide .combinedallowance').forEach(line=>{
    let strong=line.querySelector('strong'),excess=totals().kcal-dayGoals(date).kcal,over=excess>0?n(Math.round(excess)):null;if(!strong)return;
    let value=document.createElement('strong');value.className='kcalleft'+(over?' over':'');value.textContent=over?'+'+over+' kcal':strong.textContent;
    let dial=line.closest('.nutritionslide').querySelector('.caloriedial');
    if(page==='food'&&dial?.firstElementChild){dial.firstElementChild.append(value);line.remove();return}
    if(dial){let column=document.createElement('div');column.className='dialcolumn';dial.replaceWith(column);column.append(dial,value);line.remove()}
  });
  if(page==='food'){let title=document.querySelector('#content .nutritiondeck .nutritionslide:first-child > h2');if(title)title.textContent=state.language==='en'?'Eaten today':'Heute gegessen'}
  return result;
};
// Getränke ohne bekannten Wasserwert (z. B. Orangina aus Open Food Facts): Wasseranteil aus den bekannten Nährwerten
// schätzen – Menge minus Kohlenhydrate, Eiweiß, Fett und Ballaststoffe (1 g ≈ 1 ml). Gespeicherte Einträge bleiben unverändert.
function estimatedDrinkWater(x){
  if(x.unit!=='ml'||Number.isFinite(x.nutrients?.water)||!(x.grams>0))return null;
  let solids=[x.p,x.c,x.f,x.nutrients?.fiber].map(Number).filter(Number.isFinite);
  return solids.length>=3?Math.max(0,x.grams-solids.reduce((sum,v)=>sum+v,0)):null;
}
const polishNutrientTotals=nutrientTotals;nutrientTotals=function(...args){
  let result=polishNutrientTotals.apply(this,args),estimated=0,count=0;
  for(let x of state.foods.filter(item=>item.date===date)){let water=estimatedDrinkWater(x);if(water!==null){estimated+=water;count++}}
  if(count){result.totals.water+=estimated;result.coverage.water+=count;result.unknownDrinks=Math.max(0,result.unknownDrinks-count);result.estimatedWater=estimated}
  return result;
};
const polishWaterCard=waterCard;waterCard=function(...args){let html=polishWaterCard.apply(this,args),est=nutrientTotals().estimatedWater;return est?html.replace(/<\/p>(?![\s\S]*<\/p>)/,` ${state.language==='en'?'Including':'Davon'} ${n(Math.round(est))} ml ${state.language==='en'?'estimated from drink nutrients.':'aus Getränke-Nährwerten geschätzt.'}</p>`):html};
// „Tag als vollständig markieren“: Seite bleibt an derselben Stelle, Fokus bleibt auf dem Knopf.
const polishMarkDay=markFoodDayComplete;markFoodDayComplete=function(...args){
  let y=window.scrollY,result=polishMarkDay.apply(this,args),restore=()=>window.scrollTo(0,y);
  restore();requestAnimationFrame(()=>{restore();document.querySelector('#content [onclick^="markFoodDayComplete"]')?.focus({preventScroll:true})});
  return result;
};
if(typeof englishUI==='object')Object.assign(englishUI,{'Heute gegessen':'Eaten today','Sicherung & Export':'Backup & export','Anmeldung, Sicherung & Löschen':'Sign-in, backup & delete'});
render();
