/* v87 data API (no storage, network, render, save or Auth side effects).
 * window.pulsData87:
 *   migrate(source=state) -> source; adds missing defaults IN MEMORY, idempotent.
 *     Existing migrate() and the render boundary also call this after profile
 *     replacement (cloud pull, pending login, logout, import and reset).
 *   display(source=state), water(source=state), meals(source=state),
 *   foodSearch(source=state) -> independent, cleaned copies with defaults;
 *     never mutate source or save. Positive waterGoal always selects manual;
 *     otherwise water.mode falls back to the explicit setting or auto.
 *   waterTarget(source=state, day=today()) -> ml (number).
 *   waterRecommendation(source=state, day=today()) ->
 *     {ml, mode:'auto'|'manual'|'standard', weightKg:number|null, basisMl, sportMl}.
 *   rankForLevel(level), rankForXp(xp), rankFor(xp) -> strength overall rank;
 *     userLevel/level retain independent XP-level information. No XP rank thresholds.
 *     ranks: 14 groups from pulsStrength (40 stages, rankIndex 0..39, scale 2).
 *   display.lastRankSeen: celebration high-water mark. display.rankScale===2 marks
 *     the 40-stage scale; older values (0..24, legacy 25/26) migrate once in migrate().
 *   hapticsEnabled(source=state) -> boolean (default true); gates pulsHaptic.
 *   optionDraft(s) -> copy with cleaned options, optionCommit(s,draft) writes them back, mealsOK(list) -> boolean;
 *     used only by validData in js/app.js (single validator).
 * Global aliases: PULS_RANKS, pulsWaterTarget, pulsRankForLevel, pulsRankForXp,
 * pulsRankFor, pulsHapticsEnabled. No rank/XP or calculated water is persisted.
 */
(function(){
'use strict';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const finite=(x,min=0,max=Infinity)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const integer=(x,min,max)=>Number.isInteger(x)&&finite(x,min,max);
const text=(x,max,min=0)=>typeof x==='string'&&x.length<=max&&x.trim().length>=min;
const views=['energy','micros','week'],sources=['bls','usda','ciqual','off','own','puls','cnf','cofid','fndds'];
const highlighted=['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'];
const subset=(x,keys,max=keys.length)=>Array.isArray(x)&&x.length<=max&&new Set(x).size===x.length&&x.every(k=>keys.includes(k));
const ratioOK=x=>object(x)&&['p','c','f'].every(k=>integer(x[k],5,80))&&x.p+x.c+x.f===100;
const copy=x=>Array.isArray(x)?x.map(copy):object(x)?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)])):x;
const optionKeys=['water','display','foodSearch','plan'];
function optionCopy(s){const draft={...s};for(const key of optionKeys)if(s[key]!==undefined)draft[key]=copy(s[key]);return draft}
const displayDefaults=()=>({summaryViews:[...views],showRemaining:false,highlighted:[...highlighted],hapticsEnabled:true,motion:'system'});
const displayRules={summaryViews:x=>subset(x,views),showRemaining:x=>typeof x==='boolean',
 highlighted:x=>subset(x,typeof nutrientLabels==='object'?Object.keys(nutrientLabels):highlighted,8),
 // lastRankSeen 0..39 covers scale 2 and old backups (0..24 plus legacy 25/26); migrate87 maps unmarked values.
 hapticsEnabled:x=>typeof x==='boolean',motion:x=>['system','reduced'].includes(x),lastRankSeen:x=>integer(x,0,39),rankScale:x=>x===2};
function cleanObject(source,key,rules){
 if(source[key]===undefined)return;
 if(!object(source[key])){delete source[key];return}
 for(const field of Object.keys(source[key]))if(!Object.hasOwn(rules,field)||!rules[field](source[key][field]))delete source[key][field];
}
function cleanOptions(s){
 cleanObject(s,'water',{mode:x=>['auto','manual'].includes(x),glassMl:x=>integer(x,100,1000)});
 cleanObject(s,'display',displayRules);
 cleanObject(s,'foodSearch',{sort:x=>['best','az','za','recent','frequent'].includes(x),sources:x=>Array.isArray(x)&&x.length<=32&&new Set(x).size===x.length&&x.every(k=>typeof k==='string'&&/^[a-z][a-z0-9]{1,15}$/.test(k)),catalogueSourcesVersion:x=>integer(x,1,Infinity)});
 if(object(s.plan)){
  if(s.plan.macroInput!==undefined&&!['grams','ratio'].includes(s.plan.macroInput))delete s.plan.macroInput;
  if(s.plan.ratio!==undefined&&!ratioOK(s.plan.ratio))delete s.plan.ratio;
  if(s.plan.macroInput==='ratio'&&!ratioOK(s.plan.ratio))delete s.plan.macroInput;
 }
}
function mealsOK(value){
 return Array.isArray(value)&&value.length<=200&&value.every(m=>object(m)&&text(m.id,60,1)&&text(m.name,100,1)&&
  Array.isArray(m.items)&&m.items.length>=1&&m.items.length<=50&&m.items.every(x=>object(x)&&(!window.pulsNutrients||window.pulsNutrients.validFields(x))&&text(x.name,120,1)&&
   finite(x.grams,0,5000)&&x.grams>0&&['g','ml'].includes(x.unit)&&['kcal','p','c','f'].every(k=>finite(x[k]))&&
   (x.nutrients===undefined||object(x.nutrients)&&Object.values(x.nutrients).every(v=>finite(v)))&&
   ['source','barcode','foodRef','recipeId'].every(k=>x[k]===undefined||typeof x[k]==='string')&&
   (x.aiEstimate===undefined||typeof x.aiEstimate==='boolean')));
}
// Optionen werden auf einer Kopie bereinigt und erst nach bestandener Prüfung zurückgeschrieben; validData (js/app.js) ruft beides auf.
function optionDraft(s){const draft=optionCopy(s);cleanOptions(draft);return draft}
function optionCommit(s,draft){for(const key of optionKeys)if(draft[key]===undefined)delete s[key];else s[key]=draft[key]}
function display(s=state){const draft=optionCopy(s||{});cleanOptions(draft);return {...displayDefaults(),...draft.display}}
function water(s=state){
 const draft=optionCopy(s||{});cleanOptions(draft);
 return {mode:finite(s?.waterGoal,1,10000)?'manual':draft.water?.mode||'auto',glassMl:draft.water?.glassMl??250};
}
function meals(s=state){return Array.isArray(s?.meals)?copy(s.meals.filter(m=>mealsOK([m]))):[]}
function foodSearch(s=state){const draft=optionCopy(s||{});cleanOptions(draft);return {sort:'best',sources:[...sources],...draft.foodSearch}}
// v93: one-time move of the celebration mark to the 40-stage scale (rankScale 2 prevents repeats).
// Old stage i maps to the first new stage with the same strength boundary; the currently computed
// rank is the minimum, so a split stage never celebrates without real progress. Legacy 25/26 or
// impossible old values count as "not seen yet": the current rank becomes the baseline.
function migrateRankScale(s){
 const d=s.display,strength=window.pulsStrength;
 if(!object(d)||d.rankScale===2||typeof strength?.fromLegacy!=='function')return;
 const old=d.lastRankSeen;
 if(Number.isInteger(old)){
  let current=null;try{current=strength.overall(s)?.rankIndex??null}catch{current=null}
  const seen=Math.max(strength.fromLegacy(old)??-1,Number.isInteger(current)?current:-1);
  if(seen>=0)d.lastRankSeen=seen;else delete d.lastRankSeen;
 }
 d.rankScale=2;
}
function migrate87(s=state){
 if(!object(s))return s;
 cleanOptions(s);
 // Do not persist a derived mode: older water forms only update waterGoal.
 s.water??={};s.water.glassMl??=250;
 if(s.meals===undefined)s.meals=[];
 s.display??={};
 const defaults=displayDefaults();
 for(const [key,value] of Object.entries(defaults))s.display[key]??=value;
 migrateRankScale(s);
 if(object(s.plan))s.plan.macroInput??='grams';
 s.foodSearch??={};s.foodSearch.sort??='best';s.foodSearch.sources??=[...sources];
 // One-time addition, preserving previous exclusions and future explicit deselection.
 if(!integer(s.foodSearch.catalogueSourcesVersion,1,Infinity)){s.foodSearch.sources=[...new Set([...s.foodSearch.sources,'cnf'])].slice(0,32);s.foodSearch.catalogueSourcesVersion=1;}
 return s;
}
const baseMigrate=migrate;
migrate=function(...args){const result=baseMigrate.apply(this,args);migrate87(state);return result};
// Cloud login/logout replace state inside their functions before rendering.
// This also covers reset/import and preserves their existing save/CAS ordering.
globalThis.renderBeforeData=function renderBeforeData(){migrate87(state)};
if(typeof applyCloudProfile==='function'){
 const baseApply=applyCloudProfile;
 applyCloudProfile=function(row,...args){
  // Validate first, so a rejected remote revision still follows the original
  // rejection/backup path. Migrate before the accepted profile's baseline/save.
  if(row?.payload&&validData(optionCopy(row.payload)))row={...row,payload:migrate87(optionCopy(row.payload))};
  return baseApply.call(this,row,...args);
 };
}
// Defaults do not set dirty flags, increment revisions or force a storage write.
// Startup alone repairs malformed local combos; imports/cloud stay strict.
if(state.meals!==undefined){
 const repaired=Array.isArray(state.meals)?state.meals.filter(m=>mealsOK([m])):[];
 if(!Array.isArray(state.meals)||repaired.length!==state.meals.length){
  console.warn('PULS v87: Ungültige lokale Kombi-Einträge verworfen.');
  state.meals=repaired;
 }
}
migrate87(state);

// Legacy XP/level entry points retain call compatibility, but rank always comes
// from strength. XP only supplies the independent userLevel compatibility field.
const ranks=window.pulsStrength?.ranks||Object.freeze([]);
function rankForXp(value){
 const rank=window.pulsStrength?.overall()||{index:null,rankIndex:null,name:'Rang unbekannt',stage:null,progress:0,nextAt:null};
 const xp=finite(value)?Math.floor(value):0;
 const userLevel=typeof xpProgress==='function'?xpProgress(xp).level:1;
 return {...rank,userLevel,level:userLevel,stageLevel:null};
}
function rankForLevel(value){return {...rankForXp(0),userLevel:finite(value,1)?Math.floor(value):1,level:finite(value,1)?Math.floor(value):1}}
function hapticsEnabled(s=state){return s?.display?.hapticsEnabled!==false}
if(typeof pulsHaptic==='function'){
 const baseHaptic=pulsHaptic;
 pulsHaptic=function(...args){if(hapticsEnabled())return baseHaptic.apply(this,args)};
}
function waterRecommendation(s=state,day=today()){
 if(finite(s.waterGoal,1,10000))return {ml:s.waterGoal,mode:'manual',weightKg:null,basisMl:0,sportMl:0};
 // Newest actual measurement on/before the requested day takes precedence over
 // the profile's original weight. Same-day duplicates retain the last record.
 let latest=null;
 for(const w of s.weights||[])if(w&&typeof w.date==='string'&&w.date<=day&&finite(w.kg,20,400)&&(!latest||w.date>=latest.date))latest=w;
 const weight=latest?.kg??(finite(s.profile?.weight,20,400)?s.profile.weight:null);
 if(weight===null)return {ml:2000,mode:'standard',weightKg:null,basisMl:0,sportMl:0};
 let seconds=0;
 const start=new Date(day+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
 for(const w of s.workouts||[]){
  // Legacy/auto-finished approximations do not become invented exercise time.
  if(!w.finished||w.autoFinished||w.timeApprox||!finite(w.startedAt)||!finite(w.finishedAt)||w.finishedAt<=w.startedAt)continue;
  const overlap=Math.max(0,Math.min(w.finishedAt,+end)-Math.max(w.startedAt,+start));
  const duration=finite(w.durationSeconds,0)?Math.min(w.durationSeconds,(w.finishedAt-w.startedAt)/1000):(w.finishedAt-w.startedAt)/1000;
  seconds+=duration*overlap/(w.finishedAt-w.startedAt);
 }
 for(const r of s.runs||[])if(r.date===day&&!r.autoFinished&&!r.timeApprox&&finite(r.durationSeconds,0))seconds+=r.durationSeconds;
 const basisMl=weight*(finite(s.profile?.age,51)?30:35)-300,sportMl=Math.min(1500,seconds/3600*500);
 return {ml:Math.round(Math.max(1500,Math.min(5000,basisMl+sportMl))/50)*50,mode:'auto',weightKg:weight,basisMl,sportMl};
}
const waterTarget=(s=state,day=today())=>waterRecommendation(s,day).ml;
Object.assign(window,{PULS_RANKS:ranks,pulsWaterTarget:waterTarget,pulsRankForLevel:rankForLevel,
 pulsRankForXp:rankForXp,pulsRankFor:rankForXp,pulsHapticsEnabled:hapticsEnabled,
 pulsData87:Object.freeze({migrate:migrate87,display,water,meals,foodSearch,waterTarget,waterRecommendation,rankForLevel,rankForXp,rankFor:rankForXp,ranks,hapticsEnabled,optionDraft,optionCommit,mealsOK})});
})();
