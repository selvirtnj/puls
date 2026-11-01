/* M7/P2. Phase A: Web nutrition adapter, no second profile or native nutrition arithmetic. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeNutrition'))return;
const copy=x=>JSON.parse(JSON.stringify(x)),plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||
  plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
const fields=(a,keys)=>plain(a)&&Object.keys(a).every(k=>keys.includes(k));
const id=x=>typeof x==='string'&&x.trim().length>0&&x.length<=256;
const newId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const validRef=x=>fields(x,['id','catalogKey','recipeId'])&&Object.keys(x).length===1&&id(Object.values(x)[0]);
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x};
const text=x=>{const s=String(x??'');let end=Math.min(s.length,256);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1])&&/[\uDC00-\uDFFF]/.test(s[end]))end--;return s.slice(0,end)};
const decimal=x=>Number.isFinite(x)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1}).format(x)):null;
const fail=(code,message)=>({code,message}),busy=p=>({...p,busy:true}),keys=['kcal','p','c','f'];
const entry=id=>state.foods.find(x=>x.id===id),rawGoal=k=>state[k]??null;
const nutrients=x=>Object.fromEntries(Object.entries(x||{}).filter(([,v])=>Number.isFinite(v)));
let performing=0,after=[],previousSelection,previousDrafts,previousGoalsExtra,goalPending=null;
// Web functions still own snapshots/rounding/provenance. Virtual form inputs are synchronous and restored in finally.
function inputs(values,fn){const base=document.getElementById;document.getElementById=function(k){return Object.hasOwn(values,k)?values[k]:base.call(this,k)};try{return fn()}finally{document.getElementById=base}}
const value=x=>({value:String(x)}),event={preventDefault(){}};
function perform(fn,selectedDay=date){const previousDate=date,previousRender=render;performing++;date=selectedDay;render=()=>{};
  try{return fn()}finally{date=previousDate;render=previousRender;performing--}}
// Defer user-visible sound/toast until persistence is confirmed; never leave Web undo timers behind on rollback.
for(const key of ['pulsSound','toast']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(performing){after.push(()=>base.apply(this,args));return}return base.apply(this,args)}}
for(const key of ['showUndoDiary','attachFoodExtras']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(!performing)return base.apply(this,args)}}
for(const key of ['returnToRecipes','recipesPanel','renderRecipeEditor','applyPackageDefault','ffRenderDetail']){const base=globalThis[key];if(typeof base==='function')globalThis[key]=function(...args){if(!performing)return base.apply(this,args)}}
const selectBase=selectFood;selectFood=function(id,...args){if(performing){foodSelection=[...state.custom,...foods].find(x=>x.id===id);return}return selectBase.call(this,id,...args)};
let catalogueReady=false,catalogueLoadAttempt=null;
function ensureCatalogue(){
  if(localCatalogue.length){catalogueReady=true;return Promise.resolve(true)}
  if(catalogueReady)return Promise.resolve(true);
  // Public catalogue loading is independent of the profile/transaction. Coalesce retries; a failed load stays retryable.
  if(!catalogueLoadAttempt)catalogueLoadAttempt=Promise.resolve().then(()=>loadFoodCatalogue()).then(rows=>{
    catalogueReady=localCatalogue.length>0||Array.isArray(rows)&&rows.length===0&&!catalogueError;return catalogueReady;
  }).catch(()=>false).finally(()=>{catalogueLoadAttempt=null});
  return catalogueLoadAttempt;
}
function missingProduct(ref,message){
  if(ref?.catalogKey&&!localCatalogue.length&&!catalogueReady){void ensureCatalogue();return fail('busy','Katalog noch nicht verfügbar; nach dem Laden erneut senden')}
  return fail('gone',message);
}
function resolve(ref){
  if(!validRef(ref))return null;
  if(ref.recipeId){const r=(state.recipes||[]).find(x=>x.id===ref.recipeId);return r?{raw:r,food:{id:r.id,recipeId:r.id,name:r.name,unit:'g',...recipeNutrients(r)},ref}:null}
  const saved=ref.id?[...state.custom,...foods].find(x=>x.id===ref.id):state.custom.find(x=>x.catalogKey===ref.catalogKey);
  if(saved)return {raw:saved,food:!saved.portions&&portionReferences[saved.catalogKey]?{...saved,portions:portionReferences[saved.catalogKey]}:saved,ref};
  const row=ref.catalogKey&&localCatalogue.find(x=>x.source+':'+x.record===ref.catalogKey);
  // Exact synchronous chooseCatalogueFood mutation, without its async portion refresh/save/UI side effects.
  return row?{raw:row,food:{catalogKey:ref.catalogKey,name:row.name.slice(0,100),unit:'g',source:row.source,
    ...Object.fromEntries(keys.map(k=>[k,row[k]])),nutrients:{...row.nutrients},...(portionReferences[ref.catalogKey]?{portions:portionReferences[ref.catalogKey]}:{})},ref,catalog:true}:null;
}
function refOf(x){return x.recipeId?{recipeId:x.recipeId}:x.record?{catalogKey:x.source+':'+x.record}:id(x.id)?{id:x.id}:{catalogKey:x.catalogKey}}
function compactProduct(x){return {ref:refOf(x),name:text(x.name),brand:text(x.brand),unit:ffBase(x),
  ...Object.fromEntries(keys.map(k=>[k,Number.isFinite(x[k])?x[k]:null])),source:text(x.source||ffSourceShort(x)),favorite:!!x.favorite,
  complete:keys.every(k=>Number.isFinite(x[k])),reviewRequired:x.source==='Open Food Facts'&&!x.verified}}
function quantity(food,amount,unit){if(!finite(amount,0.000001,1e10)||typeof unit!=='string')return null;
  const u=ffUnits(food).find(x=>x.key===unit),n=u?amount*u.factor:null;
  return finite(n,.1,10000)?Number(n.toFixed(6)):null;
}
function addQuantity(food,a,replay=false){if(a.portion!==undefined){if(!fields(a.portion,['name','amount','unit','source'])||!/^p\d+$/.test(a.unit)||
  !finite(a.amount,.000001,1e10)||!finite(a.portion.amount,.1,10000)||a.portion.unit!==ffBase(food)||
  !replay&&!same(foodPortions(food)[Number(a.unit.slice(1))],a.portion))return null;
  const n=a.amount*a.portion.amount;return finite(n,.1,10000)?Number(n.toFixed(6)):null}return quantity(food,a.amount,a.unit)}
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
    check(a){if(!fields(a,['id','product','productId','amount','unit','portion','meal','date','expect'])||!id(a.id)||!day(a.date)||!meals.includes(a.meal)||!validRef(a.product)||!plain(a.expect))return fail('invalid','ID, Datum, Mahlzeit und vollständiges Produkt-expect erforderlich');
      const expected=expectedProduct(a),old=entry(a.id);
      if(old){const grams=a.product.recipeId&&a.unit==='whole'&&validRecipe(a.expect)?
          (finite(a.amount*a.expect.yield,.1,10000)?Number((a.amount*a.expect.yield).toFixed(6)):null):addQuantity(expected,a,true),target=grams===null?null:addSnapshot(expected,a,grams);
        return target&&matchEntry(old,target)?{noop:true,target,result:entryResult(old)}:fail('conflict','Eintrags-ID bereits belegt')}
      const p=resolve(a.product);if(!p)return missingProduct(a.product,'Lebensmittel fehlt');
      // A changed source is a conflict even when its new macros/unit would reject the old quantity.
      if(!same(p.raw,a.expect))return fail('conflict','Produkt oder Rezept inzwischen geändert');
      if(p.catalog){if(!id(a.productId))return fail('invalid','Stabile productId für neuen Katalogeintrag erforderlich');p.food.id=a.productId;
        if(state.custom.some(x=>x.id===a.productId))return fail('conflict','Produkt-ID bereits belegt')}
      if(!keys.every(k=>Number.isFinite(p.food[k])))return fail('invalid','Fehlende Nährwerte bitte im Web prüfen');
      const grams=addQuantity(p.food,a);if(grams===null)return fail('invalid','Menge/Einheit ungültig oder Dichte fehlt');
      const target=addSnapshot(p.food,a,grams);
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
      const canonical=canonicalQuantity(a.amount,a.unit,ffBase(old));if(!finite(canonical,.1,10000))return fail('invalid','Menge/Einheit ungültig; keine gespeicherte Tagebuch-Dichte');
      const grams=Number(canonical.toFixed(6));
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
      const p=resolve(a.product);if(!p)return missingProduct(a.product,'Gespeichertes Lebensmittel fehlt');if(p.catalog||p.food.recipeId)return fail('gone','Gespeichertes Lebensmittel fehlt');
      if(!!p.food.favorite===a.favorite)return {noop:true};if(!same(p.raw,a.expect))return fail('conflict','Produkt geändert');return busy(p)},
    run(a,p){perform(()=>{foodSelection=p.food;toggleFoodFavorite()})},
    effective:(s,a)=>{const ref=resolve(a.product)?.food?.id;return !!s.custom?.find(x=>x.id===ref)?.favorite===a.favorite}
  }
};
const custom=id=>state.custom.find(x=>x.id===id),recipe=id=>(state.recipes||[]).find(x=>x.id===id);
const storedProduct=p=>({productId:p.id,product:copy(p)}),storedRecipe=r=>({recipeId:r.id,recipe:copy(r)});
const small=x=>JSON.stringify(x).length<=24*1024;
const name=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=100;
const stampFree=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['verified','labelReviewed','packageChecked'].includes(k)));
function confirmed(fn){const base=globalThis.confirm;globalThis.confirm=()=>true;try{return fn()}finally{globalThis.confirm=base}}
function reviewInputs(prefix,p,checked){const check={querySelector:()=>({checked})},form={querySelector:()=>check};
  return Object.fromEntries(keys.map(k=>[prefix+k,{...value(p[k]),closest:()=>form}]))}
function labelInputs(a){return {...reviewInputs('label-',a.product,a.confirmWarnings),'label-name':value(a.product.name),'label-basis':value(a.label.basis),
  'label-basis-amount':value(a.label.amount),'label-fiber':value(a.product.fiber??''),'label-confirm':{checked:a.label.confirmed}}}
// A persisted native outbox must survive an empty offDrafts cache after reload. Accept only the Web mapper's draft schema.
function validReviewDraft(d,barcode){return fields(d,['barcode','name','brand',...keys,'unit','source','sourceUrl','prepared','fetched','packageAmount','packageUnit','packageChecked','nutrients','portions'])&&
  d.barcode===barcode&&typeof d.name==='string'&&d.name.length<=100&&typeof d.brand==='string'&&d.brand.length<=100&&d.unit===''&&
  // Value bounds follow the Web mapper, not the form: kcal/p/c/f are replaced by the checked product values anyway
  // (kJ conversion can exceed 1000), micros are any finite raw*factor >= 0, portions any amount > 0 up to 10000.
  keys.every(k=>d[k]===null||finite(d[k],0,Number.MAX_VALUE))&&['Open Food Facts','Eigene Eingabe'].includes(d.source)&&
  (d.source==='Open Food Facts'?d.sourceUrl==='https://world.openfoodfacts.org/product/'+barcode:d.sourceUrl===undefined)&&
  (d.prepared===undefined||typeof d.prepared==='boolean')&&['fetched','packageChecked'].every(k=>d[k]===undefined||day(d[k]))&&
  // portions.js packageReference rounds to one decimal and may yield 0 for tiny packages; the saved value comes from product.
  (d.packageAmount===undefined||finite(d.packageAmount,0,10000))&&(d.packageUnit===undefined||['g','ml'].includes(d.packageUnit))&&
  (d.nutrients===undefined||fields(d.nutrients,['fiber','vitc','calcium','iron','b12','potassium','magnesium','folate'])&&Object.values(d.nutrients).every(x=>finite(x,0,Number.MAX_VALUE)))&&
  (d.portions===undefined||Array.isArray(d.portions)&&d.portions.length<=30&&d.portions.every(x=>fields(x,['name','amount','unit','source'])&&
    typeof x.name==='string'&&x.name.length>0&&x.name.length<=80&&finite(x.amount,0,10000)&&x.amount>0&&['g','ml'].includes(x.unit)&&x.source==='Open Food Facts'))}
function checkedProduct(a){
  if(!fields(a,['kind','product','expect','draft','confirmWarnings','label'])||!['custom','review','label'].includes(a.kind)||
    !fields(a.product,['id','name','unit',...keys,'barcode','brand','packageAmount','fiber'])||!newId(a.product.id)||!name(a.product.name)||
    !['g','ml'].includes(a.product.unit)||typeof a.confirmWarnings!=='boolean'||!(a.expect===null||plain(a.expect))||!small(a))return fail('invalid','Produkt, vollständiges expect und confirmWarnings erforderlich');
  const p=a.product,old=custom(p.id),base=a.expect||{},label=a.kind==='label';
  if(a.expect!==null&&base.id!==p.id)return fail('invalid','Bestehende ID erhalten');
  if(a.kind==='custom'&&(Object.hasOwn(base,'catalogKey')||Object.hasOwn(base,'labelReviewed')||/etikett|label|ocr/i.test(base.source||'')||base.barcode))
    return fail('invalid','Custom-Korrektur nur für eigene Produkte ohne Katalog-/Etikettquelle und Barcode; Barcode-Korrektur über review');
  if(p.brand!==undefined&&(typeof p.brand!=='string'||p.brand.length>100)||p.barcode!==undefined&&!validBarcode(p.barcode)||
    p.packageAmount!==undefined&&p.packageAmount!==null&&!finite(p.packageAmount,.1,10000))return fail('invalid','Marke, Barcode oder Packungsmenge ungültig');
  if(!label&&p.fiber!==undefined||a.kind!=='review'&&a.draft!==undefined||!label&&a.label!==undefined)return fail('invalid','Unpassende Review-Felder');
  if(label&&(!fields(a.label,['basis','amount','column','confirmed'])||!['g','ml','portion-g','portion-ml'].includes(a.label.basis)||
    a.label.confirmed!==true||![0,1,2].includes(a.label.column)||a.expect!==null||p.unit!==(a.label.basis.endsWith('ml')?'ml':'g')||
    a.label.basis.startsWith('portion-')&&!finite(a.label.amount,.1,10000)||!a.label.basis.startsWith('portion-')&&a.label.amount!==100||
    p.fiber!==undefined&&!finite(p.fiber,0,1e6)))return fail('invalid','Name/Spalte/Basis/Bezugsmenge müssen ausdrücklich geprüft sein');
  // Use precisely the values saveLabelFood will store, including its floating-point evaluation order.
  const labelValues=label?inputs(labelInputs(a),()=>labelReviewValues()):null;
  const normalized=Object.fromEntries(keys.map(k=>[k,label?labelValues?.[k]:a.kind==='review'?nutrientNumber(p[k],k==='kcal'?1000:100):p[k]]));
  if(!keys.every(k=>finite(p[k],0,label?1e7:k==='kcal'?1000:100)&&finite(normalized[k],0,k==='kcal'?1000:100))||
    label&&p.fiber!==undefined&&labelValues?.nutrients?.fiber>100)return fail('invalid','Fehlende oder ungültige Nährwerte');
  const warnings=foodWarnings(normalized);if(warnings.length&&!a.confirmWarnings)return fail('conflict','Abweichende Werte ausdrücklich mit confirmWarnings bestätigen');
  let target;
  if(a.kind==='review'){
    if(!p.barcode||a.draft!==undefined&&!validReviewDraft(a.draft,p.barcode))return fail('invalid','Gültiger Barcode/Originalentwurf mit ausschließlich Web-OFF-Feldern erforderlich');
    if(state.custom.some(x=>x.barcode===p.barcode&&x.id!==p.id))return fail('conflict','Barcode gehört bereits zu einer anderen Produkt-ID');
    if(a.expect!==null&&base.barcode!==p.barcode)return fail('invalid','Barcode bestehender Produkte bleibt erhalten');
    target={...(a.draft||{}),...base,...normalized,id:p.id,name:p.name.trim(),unit:p.unit,barcode:p.barcode,verified:today(),packageChecked:today()};
  }else if(label)target={id:p.id,name:p.name.trim(),...normalized,unit:p.unit,source:'Eigenes Etikett · OCR geprüft',labelReviewed:today(),
    ...(labelValues?.nutrients?{nutrients:labelValues.nutrients}:{})};
  else target={...base,id:p.id,name:p.name.trim(),...normalized,unit:p.unit};
  if(p.barcode&&a.kind!=='review')return fail('invalid','Barcode-Produkte über review speichern');
  if(p.brand!==undefined)target.brand=p.brand;
  if(a.kind==='review'||p.packageAmount!==undefined){if(p.packageAmount>0&&(!target.packageUnit||target.packageUnit===p.unit)){
    target.packageAmount=p.packageAmount;target.packageUnit=p.unit}else{delete target.packageAmount;delete target.packageUnit}}
  if(!validData({...state,custom:[target]}))return fail('invalid','Produkt verletzt Web-Datenregeln');
  if(old&&same(stampFree(old),stampFree(target)))return {noop:true,target:old,result:storedProduct(old)};
  if(!same(old??null,a.expect))return fail('conflict','Produkt inzwischen geändert');
  if(a.expect!==null&&base.id!==p.id)return fail('invalid','Produkt-ID bleibt erhalten');
  return busy({target});
}
function saveProduct(a,p){return perform(()=>{
  const v=a.product,common=reviewInputs(a.kind==='review'?'off-':'custom-',v,a.confirmWarnings),before=state.custom.length;
  if(a.kind==='review'){
    productDraft={...(a.draft||{}),...(a.expect||{}),id:v.id,barcode:v.barcode,...(v.brand!==undefined?{brand:v.brand}:{})};
    inputs({...common,'off-name':value(v.name),'off-unit':value(v.unit),'off-package':value(p.target.packageAmount||''),'ff-off-unit':null},()=>confirmProduct(event));
  }else if(a.kind==='label'){
    inputs(labelInputs(a),()=>saveLabelFood(event));
  }else if(a.expect===null){
    inputs({...common,foodname:value(v.name),'ff-custom-unit-value':value(v.unit),'custom-package':value(v.packageAmount||''),'ff-detail':null},()=>addCustom(event));
  }else{
    // Non-barcode corrections have no separate Web form; use confirmProduct's same in-place assignment after its review gate.
    if(!inputs(common,()=>checkFoodReview('custom-')))throw Error('Produktprüfung abgelehnt');Object.assign(custom(v.id),p.target);
  }
  let saved=custom(v.id);
  if(a.expect===null&&!saved){if(state.custom.length!==before+1)throw Error('Produkt nicht gespeichert');saved=state.custom.at(-1);saved.id=v.id}
  if(!saved)throw Error('Produkt nicht gespeichert');
  if(!keys.every(k=>saved[k]===p.target[k])||saved.name!==p.target.name||ffBase(saved)!==p.target.unit)throw Error('Web-Produktprüfung hat nicht gespeichert');
  // Keep the exact checked target, including existing unknown fields; generated IDs never escape the transaction.
  for(const k of Object.keys(saved))if(!Object.hasOwn(p.target,k))delete saved[k];Object.assign(saved,copy(p.target));
  return storedProduct(saved);
})}
function recipeTarget(a,importing=false){
  if(!fields(a,importing?['recipe','expect','preview','confirmIngredients']:['recipe','expect'])||!plain(a.recipe)||!newId(a.recipe.id)||
    !(a.expect===null||plain(a.expect))||JSON.stringify(a).length>48*1024||a.expect!==null&&a.expect.id!==a.recipe.id)return fail('invalid','Rezept mit stabiler ID und vollständigem expect erforderlich');
  const target={...(a.expect||{}),...copy(a.recipe),name:String(a.recipe.name??'').trim()};
  if(Array.isArray(target.ingredients))target.ingredients=target.ingredients.map((x,i)=>{
    const old=a.expect?.ingredients?.[i];return old&&x.name===old.name&&x.unit===old.unit?{...copy(old),...x}:x});
  if(importing){if(a.confirmIngredients!==true||!fields(a.preview,['name','lines'])||!name(a.preview.name)||!Array.isArray(a.preview.lines)||a.preview.lines.length>100||
    a.preview.lines.some(x=>typeof x!=='string'||x.length>1000))return fail('invalid','Importvorschau und bestätigte Zutaten/Mengen erforderlich');target.importNotes=a.preview.lines.join('\n')}
  if(!validRecipe(target))return fail('invalid','Rezept benötigt vollständige Zutaten und gewogenes Endgewicht');
  const old=recipe(target.id);if(same(old,target))return {noop:true,target,result:storedRecipe(old)};
  if(!same(old??null,a.expect))return fail('conflict','Rezept inzwischen geändert');return busy({target});
}
function saveRecipeTarget(p){return perform(()=>{state.recipes??=[];recipeDraft=copy(p.target);
  inputs({'recipe-name':value(p.target.name),'recipe-yield':value(p.target.yield)},()=>saveRecipe(event));
  if(!same(recipe(p.target.id),p.target))throw Error('Rezept nicht gespeichert');return storedRecipe(recipe(p.target.id))})}
function goalContext(){return {profile:copy(state.profile??null),plan:copy(state.plan??null),goals:copy(state.goals),weight:currentWeight()??null,
  tdeeCalibration:copy(state.tdeeCalibration??null),date:today(),goalRecord:copy(state.goalHistory?.find(x=>x.date===today())??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===today())??null)}}
function goalInputs(a){const p=a.expect.profile||{},pl={...a.expect.plan,...a.plan},weight=a.expect.weight??p.weight;
  // experience.updatePlanPreview normalizes this selection before collectPlan/commitProfile in the Web form.
  if(pl.direction==='gain'&&pl.pace==='extreme')pl.pace='high';
  return Object.fromEntries([...Object.entries({age:p.age??'',height:p.height??'',weight:weight??'',target:p.target??'',sex:p.sex||'male',activity:p.activity||1.2,
    method:p.method||'mifflin',rmr:p.rmr??'', 'kcal-mode':p.kcalMode||'classic','baseline-factor':p.baselineFactor??1.2}).map(([k,v])=>['pr-'+k,value(v)]),
    ...Object.entries({mode:pl.mode,direction:pl.direction,pace:pl.pace,macros:pl.macroMode,protein:pl.protein,fat:pl.fat}).map(([k,v])=>['pl-'+k,value(v)]),
    ...keys.map(k=>['manual-'+k,value(a.goals[k])]),['pr-special',{checked:!!p.special}],['pl-adaptive',{checked:pl.adaptive!==false}],['pl-learn-tdee',{checked:!!pl.learnTdee}]])}
function goalEffect(date){return {...goalContext(),date,goalRecord:copy(state.goalHistory?.find(x=>x.date===date)??null),profileRecord:copy(state.profileHistory?.find(x=>x.date===date)??null)}}
function persistTarget(p,observed){const target=copy(observed);if(!custom(p.food.id))target.nutrients={...(target.nutrients||{})};return target}
Object.assign(ops,{
  'product.save':{check:checkedProduct,run:saveProduct,effective:(s,a,p,r)=>same(s.custom?.find(x=>x.id===a.product.id),r?.product)},
  'product.extras.set':{
    check(a){if(!fields(a,['product','expect','density','water'])||!validRef(a.product)||!plain(a.expect)||!small(a)||!['density','water'].some(k=>Object.hasOwn(a,k))||
      a.density!==undefined&&a.density!==null&&!finite(a.density,.01,20)||a.water!==undefined&&a.water!==null&&!finite(a.water,0,100))return fail('invalid','Bekannte Dichte/Wasserwerte und expect erforderlich');
      const p=resolve(a.product);if(!p)return missingProduct(a.product,'Gespeichertes Produkt fehlt');if(p.catalog||p.food.recipeId)return fail('gone','Gespeichertes Produkt fehlt');
      if(a.water!==undefined&&ffBase(p.food)!=='ml')return fail('invalid','Getränkewasser nur je 100 ml');
      const target=persistTarget(p,a.expect);
      if(Object.hasOwn(a,'density')){if(a.density===null)delete target.density;else target.density=a.density}
      if(Object.hasOwn(a,'water')){if(a.water===null){if(target.nutrients)delete target.nutrients.water}else{target.nutrients??={};target.nutrients.water=a.water}}
      if(same(p.raw,target))return {noop:true,target,result:storedProduct(p.raw)};
      if(!same(p.raw,a.expect))return fail('conflict','Produkt geändert');return busy({...p,target})},
    run(a,p){return perform(()=>{foodSelection=p.food;
      if(Object.hasOwn(a,'density'))inputs({'ff-detail':null,'food-quantity-unit':null},()=>{const f=persistSelectedFood();if(a.density===null)delete f.density;else f.density=a.density});
      if(Object.hasOwn(a,'water')){persistSelectedFood();setDrinkWater(a.water===null?'':String(a.water))}
      const f=persistSelectedFood();return storedProduct(f)})},
    effective:(s,a,p,r)=>same(s.custom?.find(x=>x.id===r.productId),p.target)
  },
  'portion.save':{
    check(a){if(!fields(a,['product','name','amount','expect'])||!validRef(a.product)||typeof a.name!=='string'||!a.name.trim()||a.name.trim().length>80||!finite(a.amount,.1,10000)||!plain(a.expect)||!small(a))return fail('invalid','Name, belegte Menge und expect erforderlich');
      const p=resolve(a.product);if(!p)return missingProduct(a.product,'Gespeichertes Produkt fehlt');if(p.catalog||p.food.recipeId)return fail('gone','Gespeichertes Produkt fehlt');
      const target={...persistTarget(p,a.expect),portions:[...(a.expect.portions||[]).filter(x=>x.name!==a.name.trim()),{name:a.name.trim(),amount:a.amount,unit:ffBase(p.food),source:'Eigene Portionsangabe'}].slice(-30)};
      if(same(p.raw,target))return {noop:true,target,result:storedProduct(p.raw)};if(!same(p.raw,a.expect))return fail('conflict','Produkt geändert');return busy({...p,target})},
    run(a,p){return perform(()=>{foodSelection=p.food;inputs({'portion-name':value(a.name),'portion-amount':value(a.amount),'ff-detail':null},()=>saveHouseholdPortion());return storedProduct(foodSelection)})},
    effective:(s,a,p,r)=>same(s.custom?.find(x=>x.id===r.productId),p.target)
  },
  'portion.delete':{
    check(a){if(!fields(a,['product','name','expect'])||!validRef(a.product)||typeof a.name!=='string'||!a.name||!plain(a.expect)||!small(a))return fail('invalid','Portionsname und expect erforderlich');
      const p=resolve(a.product);if(!p)return missingProduct(a.product,'Produkt fehlt');if(p.catalog||p.food.recipeId)return fail('gone','Produkt fehlt');const target={...persistTarget(p,a.expect),portions:(a.expect.portions||[]).filter(x=>x.name!==a.name)};
      if(same(p.raw,target))return {noop:true,target,result:storedProduct(p.raw)};if(!same(p.raw,a.expect))return fail('conflict','Produkt geändert');return busy({...p,target})},
    run(a,p){return perform(()=>{foodSelection=p.food;const f=persistSelectedFood();f.portions=(f.portions||[]).filter(x=>x.name!==a.name);return storedProduct(f)})},
    effective:(s,a,p,r)=>same(s.custom?.find(x=>x.id===r.productId),p.target)
  },
  'recipe.save':{check:a=>recipeTarget(a),run:(a,p)=>saveRecipeTarget(p),effective:(s,a,p,r)=>same(s.recipes?.find(x=>x.id===a.recipe.id),r?.recipe)},
  'recipe.import.save':{check:a=>recipeTarget(a,true),run:(a,p)=>saveRecipeTarget(p),effective:(s,a,p,r)=>same(s.recipes?.find(x=>x.id===a.recipe.id),r?.recipe)},
  'recipe.delete':{
    check(a){if(!fields(a,['id','expect'])||!newId(a.id)||!plain(a.expect)||a.expect.id!==a.id)return fail('invalid','ID und vollständiges expect erforderlich');
      const r=recipe(a.id);if(!r)return {noop:true};if(!same(r,a.expect))return fail('conflict','Rezept geändert');return busy({})},
    run:a=>perform(()=>confirmed(()=>ffDeleteRecipe(a.id))),effective:(s,a)=>!s.recipes?.some(x=>x.id===a.id)
  },
  'recipe.copy':{
    check(a){if(!fields(a,['id','sourceId','name','expect'])||!newId(a.id)||!newId(a.sourceId)||a.id===a.sourceId||!validRecipe(a.expect)||a.expect.id!==a.sourceId||JSON.stringify(a).length>48*1024||a.name!==undefined&&!name(a.name))return fail('invalid','Neue stabile ID und Originalrezept erforderlich');
      const target={...copy(a.expect),id:a.id,name:a.name?.trim()||(a.expect.name+' (Kopie)').slice(0,100)},old=recipe(a.id);
      if(same(old,target))return {noop:true,target,result:storedRecipe(old)};if(old)return fail('conflict','Kopie-ID belegt');if(!recipe(a.sourceId))return fail('gone','Originalrezept fehlt');
      if(!same(recipe(a.sourceId),a.expect))return fail('conflict','Originalrezept geändert');return busy({target})},
    run(a,p){return perform(()=>{copyRecipe(a.sourceId);recipeDraft=copy(p.target);return saveRecipeTarget(p)})},effective:(s,a,p,r)=>same(s.recipes?.find(x=>x.id===a.id),r?.recipe)
  },
  'goals.set':{
    check(a){if(!fields(a,['plan','goals','expect'])||!fields(a.plan,['mode','direction','pace','macroMode','protein','fat','adaptive','learnTdee'])||!fields(a.goals,keys)||
      ['adaptive','learnTdee'].some(k=>a.plan[k]!==undefined&&typeof a.plan[k]!=='boolean')||['protein','fat'].some(k=>a.plan[k]!==undefined&&typeof a.plan[k]!=='number')||
      !keys.every(k=>finite(a.goals[k],k==='kcal'?1:0,k==='kcal'?20000:2000))||!fields(a.expect,['profile','plan','goals','weight','tdeeCalibration','date','goalRecord','profileRecord'])||
      !['profile','plan','goals','weight','tdeeCalibration','date','goalRecord','profileRecord'].every(k=>Object.hasOwn(a.expect,k))||!plain(a.expect.plan)||!day(a.expect.date)||!small(a))return fail('invalid','Plan/Ziele und vollständiger Ziel-Kontext erforderlich');
      if(setupPending)return fail('busy','Erststart im Web abschließen');
      const vals=goalInputs(a),targetPlan=inputs(vals,()=>collectPlan()),p=a.expect.profile?{...a.expect.profile,weight:a.expect.weight??a.expect.profile.weight}:null;
      const problem=inputs(vals,()=>planError(p||{age:0},targetPlan,a.goals));if(problem)return fail('invalid',problem);
      const observed=goalContext(),profileSame=same(observed.profile&&Object.fromEntries(Object.entries(observed.profile).filter(([k])=>k!=='updated')),p&&Object.fromEntries(Object.entries(p).filter(([k])=>k!=='updated')));
      const numbers=p?planNumbers(p,targetPlan,a.goals):a.goals;
      if(same(state.plan,targetPlan)&&profileSame&&observed.weight===a.expect.weight&&keys.every(k=>state.goals[k]===numbers[k]))return {already:true,vals};
      if(!same(observed,a.expect))return fail('conflict','Profil, Gewicht, Plan oder Ziele inzwischen geändert');return busy({vals})},
    run(a,p){return perform(()=>{const current=goalEffect(a.expect.date);goalPending={date:a.expect.date,goals:copy(p.already?state.goals:a.expect.goals),goalRecord:current.goalRecord,profileRecord:current.profileRecord};
      if(!p.already&&inputs(p.vals,()=>commitProfile(event))!==true)throw Error('Ziele abgelehnt');return {effect:goalEffect(a.expect.date)}})},
    effective:(s,a,p,r)=>same(s.goals,r.effect.goals)&&same(s.plan,r.effect.plan)&&same(s.profile??null,r.effect.profile)&&same(s.tdeeCalibration??null,r.effect.tdeeCalibration)&&
      same(s.goalHistory?.find(x=>x.date===r.effect.date)??null,r.effect.goalRecord)&&same(s.profileHistory?.find(x=>x.date===r.effect.date)??null,r.effect.profileRecord)
  }
});
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
  const model={stage:'P2',date,today:today(),language:state.language==='en'?'en':'de',locale:appLocale(),
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
function detail(p){const f=p.food,units=ffUnits(f).map(u=>({...u,label:text(u.label),...(/^p\d+$/.test(u.key)?{snapshot:copy(foodPortions(f)[Number(u.key.slice(1))])}:{})}));
  return {product:compactProduct(f),expect:copy(p.raw),units,nutrients:nutrients(f.nutrients),warnings:foodWarnings(f),
    defaultAmount:ffLastAmount(f)??(f.recipeId?250:defaultPortion(f)),base:ffBase(f),newCatalogProduct:p.catalog===true,
    density:f.density??null,packageAmount:ffPackageKnown(f)?f.packageAmount:null};
}
function localDetail(ref,current){const p=resolve(ref);if(!p){const missing=missingProduct(ref,'Lebensmittel fehlt; zunächst lokal suchen');return error('product',missing.code,missing.message)}
  const key=ref.catalogKey||p.food.catalogKey;
  if(key&&!p.food.portions)return loadPortionReferences().then(()=>current()?bounded(result('product',detail(resolve(ref)))):null);
  return bounded(result('product',detail(p)));
}
let searchSerial=0,pendingSearch=null,searchNetwork=null;
const jobs=new Map(),offDrafts=new Map();
function cancelSearch(){pendingSearch?.();pendingSearch=null;searchNetwork?.abort();searchNetwork=null;searchSerial++}
function cancelQueries(){cancelSearch();for(const j of jobs.values())j.abort();jobs.clear();offDrafts.clear()}
async function nativeCatalogueFallback(query,serial,current){
  // Same matching/ranking providers as food-upgrade's fallback, with native-only cancellation. Never borrow or
  // change catalogueQuerySerial: a concurrently typing Web sheet must not cancel an accepted native search.
  const alternatives=catalogueAlternatives(query),matches=[];
  for(let start=0;start<localCatalogue.length;start+=400){
    if(serial!==searchSerial||!current())return null;
    for(let index=start;index<Math.min(start+400,localCatalogue.length);index++){
      const x=localCatalogue[index],text=x.search;
      if(alternatives.every(words=>words.some(word=>text.includes(word)||text.replace(/ /g,'').includes(word))))
        matches.push({index,score:foodPriority(x)+foodRelevance(normalizeSearch(x.name),alternatives)});
    }
    await wait(0);
  }
  if(serial!==searchSerial||!current())return null;
  matches.sort((a,b)=>b.score-a.score||a.index-b.index);return {indices:matches.slice(0,60).map(x=>x.index),count:matches.length};
}
function job(kind,current){jobs.get(kind)?.abort();const c=new AbortController();jobs.set(kind,c);return {controller:c,
  current:()=>current()&&!c.signal.aborted&&jobs.get(kind)===c,close:()=>{if(jobs.get(kind)===c)jobs.delete(kind)}}}
function wait(ms,signal){return new Promise(resolve=>{if(signal?.aborted){resolve(false);return}const abort=()=>{clearTimeout(timer);resolve(false)},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve(true)},ms);signal?.addEventListener('abort',abort,{once:true})})}
const result=(kind,data)=>({kind,ok:true,result:data}),error=(kind,code,message)=>({kind,ok:false,error:{code,message}});
function bounded(answer){return JSON.stringify(answer).length<=48*1024?answer:error(answer.kind,'too_large','Details im Web öffnen')}
const offFields='code,product_name,product_name_de,generic_name,brands,nutriments,nutrition_data,nutrition_data_prepared,product_quantity,product_quantity_unit,quantity,serving_size,serving_quantity,countries_tags';
const offAttribution={name:'Open Food Facts',url:'https://world.openfoodfacts.org',license:'ODbL',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',privacy:'Suchbegriff/Barcode und IP-Adresse; keine Profil- oder Tagebuchdaten.'};
function offCompact(x){return {...compactProduct(x),ref:{barcode:x.barcode},unit:x.unit||null,reviewRequired:true}}
function draftDetail(draft,missing=false){return {product:offCompact(draft),draft:copy(draft),expect:null,reviewRequired:true,missing,base:null,
  warnings:foodWarnings(draft),attribution:offAttribution,units:[],nutrients:nutrients(draft.nutrients)}}
function rememberDraft(x){if(!validBarcode(x.barcode))return;offDrafts.set(x.barcode,copy(x));if(offDrafts.size>60)offDrafts.delete(offDrafts.keys().next().value)}
async function offSearch(q,page,current,controller){
  if(navigator.onLine===false)return {supported:true,status:'offline',items:[],attribution:offAttribution};
  const key=q.toLowerCase()+':'+page;foodSearchTimes=foodSearchTimes.filter(t=>Date.now()-t<60000);
  if(!foodSearchCache.has(key)&&foodSearchTimes.length>=10)return {supported:true,status:'rate_limited',retryAfterMs:Math.max(1,foodSearchTimes[0]+60000-Date.now()+50),items:[],attribution:offAttribution};
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},20000);
  try{let data=foodSearchCache.get(key);
    if(!data){const params=new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'20',page:String(page),fields:offFields,lc:'de',cc:'de',app_name:'PULS'});
      await Promise.resolve();if(!current()||controller.signal.aborted)return null;
      if(navigator.onLine===false)return {supported:true,status:'offline',items:[],attribution:offAttribution};
      foodSearchTimes=foodSearchTimes.filter(t=>Date.now()-t<60000);
      if(foodSearchTimes.length>=10)return {supported:true,status:'rate_limited',retryAfterMs:Math.max(1,foodSearchTimes[0]+60000-Date.now()+50),items:[],attribution:offAttribution};
      const dispatched=fetch('https://world.openfoodfacts.org/cgi/search.pl?'+params,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});foodSearchTimes.push(Date.now());
      const response=await dispatched;if(!response.ok)throw Error();data=await response.json();if(!Array.isArray(data.products))throw Error();
      if(!current()||controller.signal.aborted)return null;foodSearchCache.set(key,data);if(foodSearchCache.size>30)foodSearchCache.delete(foodSearchCache.keys().next().value)}
    if(!current()||controller.signal.aborted)return null;
    return {supported:true,status:'ready',page,hasMore:data.products.length===20,raw:data.products.slice(0,20),items:[],attribution:offAttribution};
  }catch{if(current()&&(timedOut||!controller.signal.aborted))return {supported:true,status:timedOut?'timeout':'unavailable',items:[],attribution:offAttribution};return null}
  finally{clearTimeout(timer)}
}
async function barcodeQuery(r,current){
  jobs.get('barcode')?.abort();jobs.delete('barcode');
  const code=normalizeBarcode(r.product.barcode);if(!validBarcode(code))return error('product','invalid','Prüfziffer oder Barcodeformat ungültig');
  const cached=state.custom.find(x=>x.barcode===code);if(cached)return localDetail({id:cached.id},current);
  if(offDrafts.has(code))return bounded(result('product',draftDetail(offDrafts.get(code))));
  if(navigator.onLine===false)return error('product','offline','Kein lokal gespeichertes Produkt; Barcode später online suchen');
  lookupTimes=lookupTimes.filter(t=>Date.now()-t<60000);if(lookupTimes.length>=12)return error('product','rate_limited','Kurze Pause; Barcode später erneut suchen');
  const j=job('barcode',current),controller=j.controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},12000);
  try{await Promise.resolve();if(!j.current())return null;lookupTimes=lookupTimes.filter(t=>Date.now()-t<60000);
    if(lookupTimes.length>=12)return error('product','rate_limited','Kurze Pause; Barcode später erneut suchen');lookupTimes.push(Date.now());
    const response=await fetch('https://world.openfoodfacts.org/api/v3/product/'+code+'?fields='+offFields+'&lc=de&cc=de&app_name=PULS&app_version=3.0',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!j.current())return null;let body;
    if(response.status!==404){if(!response.ok)return error('product',response.status===429?'rate_limited':'unavailable','Open Food Facts derzeit nicht verfügbar');body=await response.json()}
    if(!j.current())return null;
    const missing=!body?.product,x=missing?{barcode:code,name:'',brand:'',kcal:null,p:null,c:null,f:null,unit:'',source:'Eigene Eingabe'}:mapOffProduct(body.product,code);
    if(!missing)rememberDraft(x);return bounded(result('product',draftDetail(x,missing)));
  }catch{return current()&&(timedOut||!controller.signal.aborted)?error('product',timedOut?'timeout':'unavailable','Barcodeabfrage fehlgeschlagen'):null}
  finally{clearTimeout(timer);j.close()}
}
function publicRecipeURL(raw){try{const u=new URL(raw),h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||
  /^(localhost(?:\.|$)|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/\.(localhost|local|internal)$/.test(h))return null;return u.href}catch{return null}}
async function importPreview(r,current){
  jobs.get('import')?.abort();jobs.delete('import');
  let raw=r.jsonLd??r.text;
  if(r.url){const url=publicRecipeURL(r.url);if(!url)return error(r.kind,'invalid','Öffentliche HTTPS-Rezeptadresse erforderlich');
    if(navigator.onLine===false)return error(r.kind,'offline','URL-Import benötigt eine Verbindung; JSON-LD oder Zutatenliste einfügen');
    const j=job('import',current),controller=j.controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},12000);
    try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'manual'});
      if(!j.current())return null;
      if(response.type==='opaqueredirect'||response.status>=300&&response.status<400)return error(r.kind,'unavailable','Rezept-Redirect nicht unterstützt; JSON-LD oder Zutatenliste einfügen');
      if(!response.ok||response.url&&!publicRecipeURL(response.url))throw Error();
      raw=await response.text();if(!j.current())return null;if(raw.length>2000000)return error(r.kind,'too_large','Rezeptseite zu groß');
      const doc=new DOMParser().parseFromString(raw,'text/html'),found=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(x=>parseRecipeImport(x.textContent)).find(Boolean);
      if(!found)return error(r.kind,'invalid','Keine Recipe-Daten erkannt; JSON-LD oder Zutatenliste einfügen');raw=JSON.stringify(found);
    }catch{return current()&&(timedOut||!controller.signal.aborted)?error(r.kind,timedOut?'timeout':'unavailable','Seite nicht erreichbar oder Browserzugriff/CORS nicht erlaubt; Daten einfügen'):null}
    finally{clearTimeout(timer);j.close()}
  }
  if(!current())return null;const parsed=parseRecipeImport(raw);let lines=parsed?.recipeIngredient;
  if(!parsed){if(r.jsonLd!==undefined||/^[{\[<]/.test(raw.trim()))return error(r.kind,'invalid','Keine gültigen Recipe-Daten erkannt');lines=raw.split('\n').map(x=>x.trim()).filter(Boolean)}
  if(!Array.isArray(lines))lines=[String(lines||'')];lines=lines.slice(0,100).map(x=>String(x));if(!lines.length||lines.some(x=>x.length>1000)||lines.join('\n').length>16000)return error(r.kind,'too_large','Zutatenliste leer oder zu groß');
  const preview={name:String(parsed?.name||'Importiertes Rezept').slice(0,100),lines};
  await loadFoodCatalogue();if(!current())return null;
  const suggestions=lines.map(line=>{const p=parseFoodLine(line),matches=p.assumed?[]:textFoodMatches(p.query,p.unit).filter(x=>keys.every(k=>Number.isFinite(x[k]))).slice(0,5);
    return {line,parsed:p,matches:matches.map(x=>({product:compactProduct(x),ingredient:{name:x.name.slice(0,100),unit:p.unit,amount:p.amount,...Object.fromEntries(keys.map(k=>[k,x[k]]))}}))}});
  const answer=result(r.kind,{preview,suggestions,reviewRequired:true,yield:null,websiteNutrientsUsed:false,omitted:0});
  while(JSON.stringify(answer).length>48*1024&&suggestions.length){suggestions.pop();answer.result.omitted++}return bounded(answer);
}
function validQuery(r){
  if(!plain(r)||!id(r.requestId)||r.requestId.length>100)return false;
  if(r.kind==='search')return fields(r,['requestId','kind','q','filter','limit','online','page'])&&typeof r.q==='string'&&r.q.length<=100&&
    (r.filter===undefined||['all','favorites','recent'].includes(r.filter))&&(r.limit===undefined||Number.isInteger(r.limit)&&r.limit>=1&&r.limit<=60)&&
    (r.online===undefined||typeof r.online==='boolean')&&(r.page===undefined||Number.isInteger(r.page)&&r.page>=1&&r.page<=100);
  if(r.kind==='product')return fields(r,['requestId','kind','product'])&&(validRef(r.product)||fields(r.product,['barcode'])&&typeof r.product.barcode==='string'&&r.product.barcode.length<=40);
  if(r.kind==='recipe'||r.kind==='entry')return fields(r,['requestId','kind','id'])&&id(r.id);
  if(r.kind==='goals')return fields(r,['requestId','kind']);
  if(r.kind==='recipeImport')return fields(r,['requestId','kind','url','jsonLd','text'])&&['url','jsonLd','text'].filter(k=>Object.hasOwn(r,k)).length===1&&
    ['url','jsonLd','text'].every(k=>r[k]===undefined||typeof r[k]==='string'&&r[k].trim().length>0&&r[k].length<=(k==='url'?2048:100000));
  if(r.kind==='labelParse')return fields(r,['requestId','kind','text','lines','column'])&&(r.column===undefined||[0,1,2].includes(r.column))&&
    (typeof r.text==='string'&&r.text.length<=15000&&r.lines===undefined||r.text===undefined&&Array.isArray(r.lines)&&r.lines.length<=500&&
    r.lines.every(x=>typeof x==='string')&&r.lines.join('\n').length<=15000);
  return false;
}
async function search(r,current,emit){
  cancelSearch();const serial=searchSerial,q=r.q.trim(),filter=r.filter||'all',limit=r.limit||60,startedAt=Date.now();
  const waited=await new Promise(resolve=>{const timer=setTimeout(()=>{pendingSearch=null;resolve(true)},q?150:0);pendingSearch=()=>{clearTimeout(timer);resolve(false)}});
  if(!waited||serial!==searchSerial||!current())return null;
  const controller=new AbortController();searchNetwork=controller;
  const active=()=>current()&&serial===searchSerial,onlineEnabled=q.length>=3&&filter==='all'&&r.online!==false&&navigator.onLine!==false;
  let saved=filter==='favorites'?state.custom.filter(x=>x.favorite):filter==='recent'?recentFoodProducts():q?savedFoodMatches(q):recentFoodProducts().length?recentFoodProducts():state.custom.some(x=>x.favorite)?state.custom.filter(x=>x.favorite):foods;
  if(q&&filter!=='all')saved=saved.filter(x=>searchScore(x.name+' '+(x.brand||''),q)>0);
  let rows=q?ffRankFoods(q,saved,[]):uniqueFoods(saved),offRaw=null;
  const answer=result('search',{q,filter,items:[],total:rows.length,omitted:0,
    phase:'local',cataloguePending:!!q&&filter==='all',offline:navigator.onLine===false,catalogueError:text(catalogueError),
    online:{supported:true,status:onlineEnabled?'pending':navigator.onLine===false?'offline':r.online===false?'disabled':'skipped',items:[],attribution:offAttribution},
    attribution:'BLS 4.0 (2025), CC BY 4.0 · USDA SR Legacy/Foundation, Public Domain · Ciqual 2025, CC BY 4.0'});
  const localItems=()=>{answer.result.items=rows.slice(0,limit).filter(x=>validRef(refOf(x))).map(compactProduct);answer.result.total=rows.length;answer.result.omitted=rows.length-answer.result.items.length};
  const onlineItems=()=>{if(!offRaw)return;const online=answer.result.online,nameKey=x=>normalizeSearch(x.name)+'|'+normalizeSearch(x.brand||''),seenCodes=new Set(),seenNames=new Set();online.items=[];delete online.omitted;
    for(const x of [...state.custom,...foods,...rows]){if(x.barcode)seenCodes.add(String(x.barcode));seenNames.add(nameKey(x))}
    for(const p of offRaw){if(!p.code||!(p.product_name_de||p.product_name))continue;const x=mapOffProduct(p,String(p.code)),key=nameKey(x);
      if(!validBarcode(x.barcode)||seenCodes.has(x.barcode)||seenNames.has(key))continue;seenCodes.add(x.barcode);seenNames.add(key);rememberDraft(x);online.items.push(offCompact(x))}};
  const boundSearch=()=>{while(JSON.stringify(answer).length>48*1024){if(answer.result.online.items.length){answer.result.online.items.pop();answer.result.online.omitted=(answer.result.online.omitted||0)+1}else if(answer.result.items.length){answer.result.items.pop();answer.result.omitted++}else return bounded(answer)}return answer};
  const publish=()=>{if(active())emit?.(copy(boundSearch()))};localItems();publish();
  try{
    // Cold catalogue loading/worker startup must not delay saved hits or OFF's 450-ms dispatch.
    const catalogueTask=(async()=>{if(!answer.result.cataloguePending)return;
      await ensureCatalogue();if(!active())return;
      let catalog=[];
      if(localCatalogue.length){const available=await startCatalogueWorker();if(!active())return;
        const found=available?await queryCatalogueAsync(q,'nativeNutrition:'+serial):await nativeCatalogueFallback(q,serial,active);
        if(!active())return;if(found)catalog=found.indices.map(i=>localCatalogue[i]).filter(Boolean)||[];else answer.result.catalogueError='Katalogsuche nicht abgeschlossen';}
      rows=ffRankFoods(q,saved,catalog);localItems();answer.result.cataloguePending=false;answer.result.catalogueError=answer.result.catalogueError||text(catalogueError);onlineItems();publish();
    })();
    const onlineTask=(async()=>{if(!onlineEnabled)return;
      if(!await wait(Math.max(0,450-(Date.now()-startedAt)),controller.signal)||!active())return;
      let online=await offSearch(q,r.page||1,active,controller);
      while(online?.status==='rate_limited'){
        answer.result.online=online;publish();if(!await wait(online.retryAfterMs,controller.signal)||!active())return;
        online=await offSearch(q,r.page||1,active,controller);
      }
      if(!online||!active())return;offRaw=online.raw||null;delete online.raw;answer.result.online=online;onlineItems();publish();
    })();
    await Promise.all([catalogueTask,onlineTask]);if(!active())return null;answer.result.phase='complete';return boundSearch();
  }finally{if(searchNetwork===controller)searchNetwork=null}
}
function query(r,current=()=>true,emit){
  if(r.kind==='search')return search(r,current,emit);
  if(r.kind==='recipeImport')return importPreview(r,current);
  if(r.kind==='goals')return bounded(result(r.kind,{expect:goalContext()}));
  if(r.kind==='labelParse'){const values=parseLabelText(r.text??r.lines.join('\n'),r.column||0);return result(r.kind,{values,reviewRequired:true,basis:null,warnings:foodWarnings(values)})}
  if(r.kind==='entry'){const x=entry(r.id);return bounded(x?result(r.kind,{entry:copy(x),index:state.foods.indexOf(x),canRestore:JSON.stringify(x).length<=24*1024}):error(r.kind,'gone','Eintrag fehlt'))}
  if(r.kind==='recipe'){const rcp=(state.recipes||[]).find(x=>x.id===r.id);return bounded(rcp?result(r.kind,{recipe:copy(rcp),totals:recipeTotals(rcp),per100:recipeNutrients(rcp)}):error(r.kind,'gone','Rezept fehlt'))}
  if(r.product.barcode!==undefined)return barcodeQuery(r,current);
  jobs.get('barcode')?.abort();jobs.delete('barcode');return localDetail(r.product,current);
}
window.pulsNativeNutrition={ops,build,query,validQuery,cancelSearch,cancelQueries,stage:'P2',queries:['search','product','recipe','entry','labelParse','recipeImport','goals'],
  captureUi:()=>{previousSelection=foodSelection;previousDrafts={productDraft,recipeDraft};previousGoalsExtra=copy(Object.fromEntries(Object.entries(state.goals).filter(([k])=>!keys.includes(k))));return {date,foodSelection,undo:undoDiaryItems.slice(),...previousDrafts}},
  restoreUi:ui=>{date=ui.date;foodSelection=ui.foodSelection;undoDiaryItems=ui.undo;productDraft=ui.productDraft;recipeDraft=ui.recipeDraft},
  afterRender:r=>{if(previousGoalsExtra)Object.assign(state.goals,previousGoalsExtra);if(!goalPending)return;
    Object.assign(state.goals,Object.fromEntries(Object.entries(goalPending.goals).filter(([k])=>!keys.includes(k))));
    for(const [array,key] of [['goalHistory','goalRecord'],['profileHistory','profileRecord']]){const row=state[array]?.find(x=>x.date===goalPending.date),old=goalPending[key];if(row&&old){const merged={...old,...row};Object.assign(row,merged)}}
    if(r)r.effect=goalEffect(goalPending.date);
  },
  settled:ok=>{if(previousSelection!==undefined)foodSelection=previousSelection?state.custom.find(x=>x.id===previousSelection.id)||previousSelection:previousSelection;previousSelection=undefined;
    if(previousDrafts){productDraft=previousDrafts.productDraft;recipeDraft=previousDrafts.recipeDraft;previousDrafts=undefined}previousGoalsExtra=undefined;goalPending=null;
    const pending=after;after=[];if(ok)for(const fn of pending)try{fn()}catch{}}};
})();
