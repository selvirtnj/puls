/* M7/P1. Phase A: local nutrition adapter, no second profile or native nutrition arithmetic. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeNutrition'))return;
const copy=x=>JSON.parse(JSON.stringify(x)),plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||
  plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
const fields=(a,keys)=>plain(a)&&Object.keys(a).every(k=>keys.includes(k));
const id=x=>typeof x==='string'&&x.trim().length>0&&x.length<=256;
const validRef=x=>fields(x,['id','catalogKey','recipeId'])&&Object.keys(x).length===1&&id(Object.values(x)[0]);
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x};
const text=x=>{const s=String(x??'');let end=Math.min(s.length,256);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1])&&/[\uDC00-\uDFFF]/.test(s[end]))end--;return s.slice(0,end)};
const decimal=x=>Number.isFinite(x)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1}).format(x)):null;
const fail=(code,message)=>({code,message}),busy=p=>({...p,busy:true}),keys=['kcal','p','c','f'];
const entry=id=>state.foods.find(x=>x.id===id),rawGoal=k=>state[k]??null;
const nutrients=x=>Object.fromEntries(Object.entries(x||{}).filter(([,v])=>Number.isFinite(v)));
let performing=0,after=[],previousSelection;
// Web functions still own snapshots/rounding/provenance. Virtual form inputs are synchronous and restored in finally.
function inputs(values,fn){const base=document.getElementById;document.getElementById=function(k){return Object.hasOwn(values,k)?values[k]:base.call(this,k)};try{return fn()}finally{document.getElementById=base}}
const value=x=>({value:String(x)}),event={preventDefault(){}};
function perform(fn,selectedDay=date){const previousDate=date,previousRender=render;performing++;date=selectedDay;render=()=>{};
  try{return fn()}finally{date=previousDate;render=previousRender;performing--}}
// Defer user-visible sound/toast until persistence is confirmed; never leave Web undo timers behind on rollback.
for(const key of ['pulsSound','toast']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(performing){after.push(()=>base.apply(this,args));return}return base.apply(this,args)}}
for(const key of ['showUndoDiary','attachFoodExtras']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(!performing)return base.apply(this,args)}}
function resolve(ref){
  if(!validRef(ref))return null;
  if(ref.recipeId){const r=(state.recipes||[]).find(x=>x.id===ref.recipeId);return r?{raw:r,food:{id:r.id,recipeId:r.id,name:r.name,unit:'g',...recipeNutrients(r)},ref}:null}
  const saved=ref.id?[...state.custom,...foods].find(x=>x.id===ref.id):state.custom.find(x=>x.catalogKey===ref.catalogKey);
  if(saved)return {raw:saved,food:saved,ref};
  const row=ref.catalogKey&&localCatalogue.find(x=>x.source+':'+x.record===ref.catalogKey);
  // Exact synchronous chooseCatalogueFood mutation, without its async portion refresh/save/UI side effects.
  return row?{raw:row,food:{catalogKey:ref.catalogKey,name:row.name.slice(0,100),unit:'g',source:row.source,
    ...Object.fromEntries(keys.map(k=>[k,row[k]])),nutrients:{...row.nutrients}},ref,catalog:true}:null;
}
function refOf(x){return x.recipeId?{recipeId:x.recipeId}:x.record?{catalogKey:x.source+':'+x.record}:id(x.id)?{id:x.id}:{catalogKey:x.catalogKey}}
function compactProduct(x){return {ref:refOf(x),name:text(x.name),brand:text(x.brand),unit:ffBase(x),
  ...Object.fromEntries(keys.map(k=>[k,Number.isFinite(x[k])?x[k]:null])),source:text(x.source||ffSourceShort(x)),favorite:!!x.favorite,
  complete:keys.every(k=>Number.isFinite(x[k])),reviewRequired:x.source==='Open Food Facts'&&!x.verified}}
function quantity(food,amount,unit){if(!finite(amount,0.000001,1e10)||typeof unit!=='string')return null;
  const u=ffUnits(food).find(x=>x.key===unit),n=u?amount*u.factor:null;
  return finite(n,.1,10000)?Number(n.toFixed(6)):null;
}
function addSnapshot(food,a,grams){const x={id:a.id,name:food.name,grams,date:a.date,meal:a.meal,
  ...Object.fromEntries(keys.map(k=>[k,round(food[k]*grams/100)])),unit:ffBase(food),foodRef:food.id};
  if(food.source)x.source=String(food.source).slice(0,150);if(food.barcode)x.barcode=food.barcode;if(food.recipeId)x.recipeId=food.recipeId;
  const n=Object.fromEntries(Object.entries(nutrients(food.nutrients)).map(([k,v])=>[k,v*grams/100]));if(Object.keys(n).length)x.nutrients=n;
  return x;
}
const matchEntry=(x,target)=>!!x&&Object.keys(target).every(k=>same(x[k],target[k]));
// Ack supplies Web-rounded effect values; Native never needs a second snapshot/scaling formula for §7.
function entryResult(x){return {entryId:x.id,effect:Object.fromEntries(['grams','unit',...keys,'nutrients','foodRef','recipeId','loggedAt'].map(k=>[k,x[k]===undefined?null:copy(x[k])]))}}
function expectedProduct(a){
  if(a.product?.recipeId&&validRecipe(a.expect)&&a.expect.id===a.product.recipeId)return {id:a.expect.id,recipeId:a.expect.id,name:a.expect.name,unit:'g',...recipeNutrients(a.expect)};
  if(a.product?.catalogKey&&a.expect.source+':'+a.expect.record===a.product.catalogKey&&id(a.productId))return {
    id:a.productId,catalogKey:a.product.catalogKey,name:String(a.expect.name).slice(0,100),unit:'g',source:a.expect.source,
    ...Object.fromEntries(keys.map(k=>[k,a.expect[k]])),nutrients:{...a.expect.nutrients}};
  return a.expect;
}
const ops={
  'food.add':{
    check(a){if(!fields(a,['id','product','productId','amount','unit','meal','date','expect'])||!id(a.id)||!day(a.date)||!meals.includes(a.meal)||!validRef(a.product)||!plain(a.expect))return fail('invalid','ID, Datum, Mahlzeit und vollständiges Produkt-expect erforderlich');
      const expected=expectedProduct(a),old=entry(a.id);
      if(old){const grams=a.product.recipeId&&a.unit==='whole'&&validRecipe(a.expect)?
          (finite(a.amount*a.expect.yield,.1,10000)?Number((a.amount*a.expect.yield).toFixed(6)):null):quantity(expected,a.amount,a.unit),target=grams===null?null:addSnapshot(expected,a,grams);
        return target&&matchEntry(old,target)?{noop:true,target,result:entryResult(old)}:fail('conflict','Eintrags-ID bereits belegt')}
      const p=resolve(a.product);if(!p)return fail('gone','Lebensmittel fehlt');
      if(p.catalog){if(!id(a.productId))return fail('invalid','Stabile productId für neuen Katalogeintrag erforderlich');p.food.id=a.productId;
        if(state.custom.some(x=>x.id===a.productId))return fail('conflict','Produkt-ID bereits belegt')}
      if(!keys.every(k=>Number.isFinite(p.food[k])))return fail('invalid','Fehlende Nährwerte bitte im Web prüfen');
      const grams=quantity(p.food,a.amount,a.unit);if(grams===null)return fail('invalid','Menge/Einheit ungültig oder Dichte fehlt');
      const target=addSnapshot(p.food,a,grams);
      // Compare with the original source first: a changed product must never recreate different historical nutrients.
      if(!same(p.raw,a.expect))return fail('conflict','Produkt oder Rezept inzwischen geändert');
      return busy({...p,grams,target});
    },
    run(a,p){return perform(()=>{foodSelection=p.food;const count=state.foods.length;
      inputs({grams:value(p.grams),meal:value(a.meal),'food-quantity':null},()=>addFood(event));
      if(state.foods.length!==count+1)throw Error('Essen nicht hinzugefügt');state.foods.at(-1).id=a.id;
      if(!matchEntry(state.foods.at(-1),p.target))throw Error('Web-Snapshot weicht ab');return entryResult(state.foods.at(-1));
    },a.date)},
    effective:(s,a,p)=>matchEntry(s.foods?.find(x=>x.id===a.id),p.target)
  },
  'food.update':{
    check(a){if(!fields(a,['id','amount','unit','expect'])||!id(a.id)||!plain(a.expect)||a.expect.id!==a.id)return fail('invalid','Vollständiger Eintrag als expect erforderlich');
      const old=entry(a.id);if(!old)return fail('gone','Eintrag fehlt');
      // Diary does not store density. Editing may scale within its canonical dimension only, just like the Web editor.
      const grams=canonicalQuantity(a.amount,a.unit,ffBase(old));if(!finite(grams,.1,10000))return fail('invalid','Menge/Einheit ungültig; keine gespeicherte Tagebuch-Dichte');
      const target=copy(a.expect),factor=grams/target.grams;for(const k of keys)target[k]=round(target[k]*factor);target.grams=grams;
      if(target.nutrients)for(const k of Object.keys(target.nutrients))target.nutrients[k]*=factor;
      if(same(old,target))return {noop:true,target,result:entryResult(old)};if(!same(old,a.expect))return fail('conflict','Eintrag inzwischen geändert');return busy({target,grams});
    },
    run(a,p){return perform(()=>{inputs({'diary-amount':value(p.grams)},()=>saveDiaryAmount(event,a.id));return entryResult(entry(a.id))})},
    effective:(s,a,p)=>same(s.foods?.find(x=>x.id===a.id),p.target)
  },
  'food.delete':{
    check(a){if(!fields(a,['id','expect'])||!id(a.id)||!plain(a.expect)||a.expect.id!==a.id)return fail('invalid','Vollständiger Eintrag als expect erforderlich');
      const old=entry(a.id);if(!old)return {noop:true};if(!same(old,a.expect))return fail('conflict','Eintrag inzwischen geändert');
      if(JSON.stringify(old).length>24*1024)return fail('invalid','Eintrag für sicheres natives Undo zu groß – im Web löschen');return busy({})},
    run(a){perform(()=>{const undo=undoDiaryItems;undoDiaryItems=[];try{deleteSwipeDiary(a.id)}finally{undoDiaryItems=undo}})},
    effective:(s,a)=>!s.foods?.some(x=>x.id===a.id)
  },
  'food.restore':{
    check(a){if(!fields(a,['entry','index','expect'])||!plain(a.entry)||!id(a.entry.id)||!day(a.entry.date)||a.expect!==null||!Number.isInteger(a.index)||a.index<0||a.index>1e6||JSON.stringify(a.entry).length>24*1024||
      !validData({...state,foods:[a.entry]}))return fail('invalid','Originalsnapshot, Index und expect:null erforderlich');
      const old=entry(a.entry.id);if(old)return same(old,a.entry)?{noop:true}:fail('conflict','Eintrags-ID bereits belegt');return busy({})},
    // Same insertion as undoDiaryDelete, without sharing its transient UI stack with the native outbox.
    run(a){perform(()=>state.foods.splice(Math.min(a.index,state.foods.length),0,copy(a.entry)))},
    effective:(s,a)=>same(s.foods?.find(x=>x.id===a.entry.id),a.entry)
  },
  'water.add':{
    check(a){if(!fields(a,['id','date','ml','expect'])||!id(a.id)||!day(a.date)||!finite(a.ml,1,10000)||a.expect!==null)return fail('invalid','Stabile ID, Datum, ml 1–10000 und expect:null erforderlich');
      const target={id:a.id,date:a.date,meal:'Snacks',name:'Trinkwasser',grams:a.ml,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:a.ml}},old=entry(a.id);
      if(old)return same(old,target)?{noop:true,target,result:entryResult(old)}:fail('conflict','Eintrags-ID bereits belegt');return busy({target})},
    run(a){return perform(()=>{const count=state.foods.length;inputs({'water-amount':value(a.ml)},()=>logWater(event));
      if(state.foods.length!==count+1)throw Error('Wasser nicht hinzugefügt');state.foods.at(-1).id=a.id;return entryResult(state.foods.at(-1))},a.date)},
    effective:(s,a,p)=>same(s.foods?.find(x=>x.id===a.id),p.target)
  },
  'day.complete':{
    check(a){if(!fields(a,['date','done','expect'])||!day(a.date)||typeof a.done!=='boolean'||typeof a.expect!=='boolean')return fail('invalid','Datum, done und expect als Boolean erforderlich');
      const old=!!state.foodLogCompleted?.includes(a.date);if(old===a.done)return {noop:true};if(old!==a.expect)return fail('conflict','Tagesabschluss geändert');return busy({})},
    run(a){perform(()=>markFoodDayComplete(),a.date)},
    effective:(s,a)=>!!s.foodLogCompleted?.includes(a.date)===a.done
  },
  'microGoals.set':{
    check(a){if(!fields(a,['goals','expect'])||!fields(a.goals,Object.keys(nutrientLabels))||Object.values(a.goals).some(x=>!finite(x,0,1e6))||!(a.expect===null||plain(a.expect)))return fail('invalid','Mikroziele 0–1000000 und vollständiges expect erforderlich');
      const target={...Object.fromEntries(Object.entries(state.microGoals||{}).filter(([k])=>!Object.hasOwn(nutrientLabels,k))),...Object.fromEntries(Object.entries(a.goals).filter(([,v])=>v>0))};if(same(rawGoal('microGoals'),target))return {noop:true,target};
      if(!same(rawGoal('microGoals'),a.expect))return fail('conflict','Mikroziele geändert');return busy({target})},
    run(a,p){perform(()=>{inputs(Object.fromEntries(Object.keys(nutrientLabels).map(k=>['micro-'+k,value(a.goals[k]||'')])),()=>saveMicroTargets(event));state.microGoals=p.target})},
    effective:(s,a,p)=>same(s.microGoals,p.target)
  },
  'waterGoal.set':{
    check(a){if(!fields(a,['ml','expect'])||!Number.isInteger(a.ml)||!finite(a.ml,0,10000)||!(a.expect===null||finite(a.expect,0,10000)))return fail('invalid','Wasserziel 0–10000 (ganzzahlig) und expect erforderlich');
      if(state.waterGoal===a.ml)return {noop:true};if(!same(rawGoal('waterGoal'),a.expect))return fail('conflict','Wasserziel geändert');return busy({})},
    // waterGoalForm has an inline submit handler; this is that exact mutation, followed by the common transaction.
    run(a){state.waterGoal=a.ml},effective:(s,a)=>s.waterGoal===a.ml
  },
  'product.favorite':{
    check(a){if(!fields(a,['product','favorite','expect'])||typeof a.favorite!=='boolean'||!plain(a.expect))return fail('invalid','Produkt, favorite und vollständiges expect erforderlich');
      const p=resolve(a.product);if(!p||p.catalog||p.food.recipeId)return fail('gone','Gespeichertes Lebensmittel fehlt');
      if(!!p.food.favorite===a.favorite)return {noop:true};if(!same(p.raw,a.expect))return fail('conflict','Produkt geändert');return busy(p)},
    run(a,p){perform(()=>{foodSelection=p.food;toggleFoodFavorite()})},
    effective:(s,a)=>{const ref=resolve(a.product)?.food?.id;return !!s.custom?.find(x=>x.id===ref)?.favorite===a.favorite}
  }
};
let cached=null,cacheKey=null;
function build(){
  // Only called for an interested projection. Ordinary renders compare references/scalars in native-state only.
  // Baseline goals also depend on historical weight and completed sport. Cache their Web result, not a duplicate
  // calorie formula or an expensive serialization of the entire workout/GPS history.
  const g=dayGoals(date);
  const key=JSON.stringify([date,today(),state.language,g,state.goals,state.profile,state.plan,state.foods,state.custom,state.recipes,state.microGoals,state.waterGoal,state.foodLogCompleted]);
  if(key===cacheKey)return copy(cached);
  const nt=nutrientTotals(),refs=referenceMicros(),list=state.foods.filter(x=>x.date===date),t=totals();
  const favorites=state.custom.filter(x=>x.favorite),recent=recentFoodProducts(),recipes=state.recipes||[];
  const model={stage:'P1',date,today:today(),language:state.language==='en'?'en':'de',locale:appLocale(),
    goals:{values:Object.fromEntries(keys.map(k=>[k,g[k]??null])),mode:state.plan?.mode||'manual',macroMode:state.plan?.macroMode||'manual'},
    totals:t,micros:Object.fromEntries(Object.entries(nutrientLabels).map(([k,[label,unit]])=>[k,{label:text(label),unit,
      value:nt.coverage[k]?decimal(round(nt.totals[k])):null,known:nt.coverage[k]||0,total:nt.count,
      target:state.microGoals?.[k]||refs?.[k]||null,targetSource:state.microGoals?.[k]?'custom':refs?.[k]?'reference':null}])),
    water:{value:nt.coverage.water?Math.round(nt.totals.water):null,displayValue:Math.round(nt.totals.water),known:nt.coverage.water||0,total:nt.count,
      estimated:Math.round(nt.estimatedWater||0),unknownDrinks:nt.unknownDrinks||0,target:state.waterGoal||null,estimatedDisplayOnly:true},
    foodLogCompleted:!!state.foodLogCompleted?.includes(date),
    entries:list.slice(-200).filter(x=>id(x.id)).reverse().map(x=>({id:x.id,name:text(x.name),date:x.date,meal:text(x.meal),amount:x.grams,unit:ffBase(x),
      ...Object.fromEntries(keys.map(k=>[k,x[k]])),nutrients:nutrients(x.nutrients),foodRef:id(x.foodRef)?x.foodRef:null,recipeId:id(x.recipeId)?x.recipeId:null,source:text(x.source)})),
    entryCount:list.length,favorites:favorites.slice(0,60).filter(x=>validRef(refOf(x))).map(compactProduct),recent:recent.filter(x=>validRef(refOf(x))).map(compactProduct),
    recipes:recipes.slice(0,60).filter(x=>id(x.id)).map(r=>({id:r.id,name:text(r.name),yield:r.yield,ingredients:r.ingredients.length,...recipeNutrients(r)})),
    settings:{waterGoal:state.waterGoal??null,microGoals:Object.fromEntries(Object.keys(nutrientLabels).filter(k=>Object.hasOwn(state.microGoals||{},k)).map(k=>[k,state.microGoals[k]]))},
    omitted:{entries:0,favorites:0,recent:0,recipes:0},navigation:{page:'food',web:true}};
  const counts={entries:list.length,favorites:favorites.length,recent:recent.length,recipes:recipes.length};
  const recount=()=>{for(const k of Object.keys(counts))model.omitted[k]=counts[k]-model[k].length};recount();
  while(JSON.stringify(model).length>48*1024){const k=['entries','favorites','recent','recipes'].find(k=>model[k].length);if(!k)throw Error('Nutrition budget');model[k].pop();recount()}
  cached=copy(model);cacheKey=key;return model;
}
function detail(p){const f=p.food,units=ffUnits(f).map(u=>({...u,label:text(u.label)}));
  return {product:compactProduct(f),expect:copy(p.raw),units,nutrients:nutrients(f.nutrients),warnings:foodWarnings(f),
    defaultAmount:ffLastAmount(f)??defaultPortion(f),base:ffBase(f),newCatalogProduct:p.catalog===true,
    density:f.density??null,packageAmount:ffPackageKnown(f)?f.packageAmount:null};
}
let searchSerial=0,pendingSearch=null;
function cancelSearch(){pendingSearch?.();pendingSearch=null;searchSerial++}
const result=(kind,data)=>({kind,ok:true,result:data}),error=(kind,code,message)=>({kind,ok:false,error:{code,message}});
function bounded(answer){return JSON.stringify(answer).length<=48*1024?answer:error(answer.kind,'too_large','Details im Web öffnen')}
function validQuery(r){
  if(!plain(r)||!id(r.requestId)||r.requestId.length>100)return false;
  if(r.kind==='search')return fields(r,['requestId','kind','q','filter','limit'])&&typeof r.q==='string'&&r.q.length<=100&&
    (r.filter===undefined||['all','favorites','recent'].includes(r.filter))&&(r.limit===undefined||Number.isInteger(r.limit)&&r.limit>=1&&r.limit<=60);
  if(r.kind==='product')return fields(r,['requestId','kind','product'])&&validRef(r.product);
  if(r.kind==='recipe'||r.kind==='entry')return fields(r,['requestId','kind','id'])&&id(r.id);
  if(r.kind==='labelParse')return fields(r,['requestId','kind','text','lines','column'])&&(r.column===undefined||[0,1,2].includes(r.column))&&
    (typeof r.text==='string'&&r.text.length<=15000&&r.lines===undefined||r.text===undefined&&Array.isArray(r.lines)&&r.lines.length<=500&&
    r.lines.every(x=>typeof x==='string')&&r.lines.join('\n').length<=15000);
  return false;
}
async function search(r,current){
  cancelSearch();const serial=searchSerial,q=r.q.trim(),filter=r.filter||'all',limit=r.limit||60;
  const waited=await new Promise(resolve=>{const timer=setTimeout(()=>{pendingSearch=null;resolve(true)},q?150:0);pendingSearch=()=>{clearTimeout(timer);resolve(false)}});
  if(!waited||serial!==searchSerial||!current())return null;
  // Shared Web worker with a disjoint response key: never increments/cancels the Web sheet's query serial.
  if(filter==='all'&&q){await loadFoodCatalogue();if(!current()||serial!==searchSerial)return null}
  let rows=filter==='favorites'?state.custom.filter(x=>x.favorite):filter==='recent'?recentFoodProducts():q?savedFoodMatches(q):recentFoodProducts().length?recentFoodProducts():state.custom.some(x=>x.favorite)?state.custom.filter(x=>x.favorite):foods;
  if(q&&filter!=='all')rows=rows.filter(x=>searchScore(x.name+' '+(x.brand||''),q)>0);
  let catalog=[];
  if(q&&filter==='all'&&localCatalogue.length){const available=await startCatalogueWorker();if(!current()||serial!==searchSerial)return null;
    const found=available?await queryCatalogueAsync(q,'nativeNutrition:'+serial):await fallbackCatalogueSearch(q,catalogueQuerySerial);
    if(!found||!current()||serial!==searchSerial)return null;catalog=found.indices.map(i=>localCatalogue[i]).filter(Boolean)||[]}
  rows=q?ffRankFoods(q,rows,catalog):uniqueFoods(rows);
  const items=rows.slice(0,limit).filter(x=>validRef(refOf(x))).map(compactProduct),answer=result('search',{q,filter,items,total:rows.length,omitted:Math.max(0,rows.length-items.length),
    offline:navigator.onLine===false,catalogueError:text(catalogueError),online:{supported:false,reason:'P2',provider:'Open Food Facts'},
    attribution:'BLS 4.0 (2025), CC BY 4.0 · USDA SR Legacy/Foundation, Public Domain · Ciqual 2025, CC BY 4.0'});
  while(JSON.stringify(answer).length>48*1024&&items.length){items.pop();answer.result.omitted++}return answer;
}
function query(r,current=()=>true){
  if(r.kind==='search')return search(r,current);
  if(r.kind==='labelParse'){const values=parseLabelText(r.text??r.lines.join('\n'),r.column||0);return result(r.kind,{values,reviewRequired:true,basis:null,warnings:foodWarnings(values)})}
  if(r.kind==='entry'){const x=entry(r.id);return bounded(x?result(r.kind,{entry:copy(x),index:state.foods.indexOf(x),canRestore:JSON.stringify(x).length<=24*1024}):error(r.kind,'gone','Eintrag fehlt'))}
  if(r.kind==='recipe'){const rcp=(state.recipes||[]).find(x=>x.id===r.id);return bounded(rcp?result(r.kind,{recipe:copy(rcp),totals:recipeTotals(rcp),per100:recipeNutrients(rcp)}):error(r.kind,'gone','Rezept fehlt'))}
  const p=resolve(r.product);return bounded(p?result(r.kind,detail(p)):error(r.kind,'gone','Lebensmittel fehlt; zunächst lokal suchen'));
}
window.pulsNativeNutrition={ops,build,query,validQuery,cancelSearch,queries:['search','product','recipe','entry','labelParse'],
  captureUi:()=>{previousSelection=foodSelection;return {date,foodSelection,undo:undoDiaryItems.slice()}},
  restoreUi:ui=>{date=ui.date;foodSelection=ui.foodSelection;undoDiaryItems=ui.undo},
  settled:ok=>{if(previousSelection!==undefined)foodSelection=previousSelection?state.custom.find(x=>x.id===previousSelection.id)||previousSelection:previousSelection;previousSelection=undefined;
    const pending=after;after=[];if(ok)for(const fn of pending)try{fn()}catch{}}};
})();
