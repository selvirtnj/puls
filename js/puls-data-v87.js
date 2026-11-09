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
 *   rankForLevel(level), rankForXp(xp), rankFor(xp) ->
 *     {index:0..9, key, name, stage:1..3, stageLevel, userLevel, level,
 *      nextAt:number|null, progress:0..1}. stageLevel is the stage threshold;
 *     level remains its compatibility alias; userLevel is the actual XP level.
 *     name includes I/II/III except Tren Cougher; nextAt is cumulative XP for
 *     the next STAGE, null at the final rank. ranks contains 10 frozen groups
 *     {index,key,name,levels:[...],xp:[...]} (stage thresholds).
 *   hapticsEnabled(source=state) -> boolean (default true); gates pulsHaptic.
 * Global aliases: PULS_RANKS, pulsWaterTarget, pulsRankForLevel, pulsRankForXp,
 * pulsRankFor, pulsHapticsEnabled. No rank/XP or calculated water is persisted.
 */
(function(){
'use strict';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const finite=(x,min=0,max=Infinity)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const integer=(x,min,max)=>Number.isInteger(x)&&finite(x,min,max);
const text=(x,max,min=0)=>typeof x==='string'&&x.length<=max&&x.trim().length>=min;
const views=['energy','micros','week'],sources=['bls','usda','ciqual','off','own','puls'];
const highlighted=['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'];
const subset=(x,keys,max=keys.length)=>Array.isArray(x)&&x.length<=max&&new Set(x).size===x.length&&x.every(k=>keys.includes(k));
const ratioOK=x=>object(x)&&['p','c','f'].every(k=>integer(x[k],5,80))&&x.p+x.c+x.f===100;
const copy=x=>Array.isArray(x)?x.map(copy):object(x)?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)])):x;
const optionKeys=['water','display','foodSearch','plan'];
function optionCopy(s){const draft={...s};for(const key of optionKeys)if(s[key]!==undefined)draft[key]=copy(s[key]);return draft}
const displayDefaults=()=>({summaryViews:[...views],showRemaining:false,highlighted:[...highlighted],hapticsEnabled:true,motion:'system'});
const displayRules={summaryViews:x=>subset(x,views),showRemaining:x=>typeof x==='boolean',
 highlighted:x=>subset(x,typeof nutrientLabels==='object'?Object.keys(nutrientLabels):highlighted,8),
 hapticsEnabled:x=>typeof x==='boolean',motion:x=>['system','reduced'].includes(x),lastRankSeen:x=>integer(x,0,9)};
function cleanObject(source,key,rules){
 if(source[key]===undefined)return;
 if(!object(source[key])){delete source[key];return}
 for(const field of Object.keys(source[key]))if(!Object.hasOwn(rules,field)||!rules[field](source[key][field]))delete source[key][field];
}
function cleanOptions(s){
 cleanObject(s,'water',{mode:x=>['auto','manual'].includes(x),glassMl:x=>integer(x,100,1000)});
 cleanObject(s,'display',displayRules);
 cleanObject(s,'foodSearch',{sort:x=>['best','az','za','recent','frequent'].includes(x),sources:x=>subset(x,sources)});
 if(object(s.plan)){
  if(s.plan.macroInput!==undefined&&!['grams','ratio'].includes(s.plan.macroInput))delete s.plan.macroInput;
  if(s.plan.ratio!==undefined&&!ratioOK(s.plan.ratio))delete s.plan.ratio;
  if(s.plan.macroInput==='ratio'&&!ratioOK(s.plan.ratio))delete s.plan.macroInput;
 }
}
function mealsOK(value){
 return Array.isArray(value)&&value.length<=200&&value.every(m=>object(m)&&text(m.id,60,1)&&text(m.name,100,1)&&
  Array.isArray(m.items)&&m.items.length>=1&&m.items.length<=50&&m.items.every(x=>object(x)&&text(x.name,120,1)&&
   finite(x.grams,0,5000)&&x.grams>0&&['g','ml'].includes(x.unit)&&['kcal','p','c','f'].every(k=>finite(x[k]))&&
   (x.nutrients===undefined||object(x.nutrients)&&Object.values(x.nutrients).every(v=>finite(v)))&&
   ['source','barcode','foodRef','recipeId'].every(k=>x[k]===undefined||typeof x[k]==='string')&&
   (x.aiEstimate===undefined||typeof x.aiEstimate==='boolean')));
}
const baseValid=validData;
validData=function(s){
 if(!object(s))return false;
 // Native commands validate {...state,...}; never clean their shared subobjects.
 const draft=optionCopy(s);cleanOptions(draft);
 if(s.meals!==undefined&&!mealsOK(s.meals))return false;
 if(!baseValid(draft))return false;
 for(const key of optionKeys)if(draft[key]===undefined)delete s[key];else s[key]=draft[key];
 return true;
};
function display(s=state){const draft=optionCopy(s||{});cleanOptions(draft);return {...displayDefaults(),...draft.display}}
function water(s=state){
 const draft=optionCopy(s||{});cleanOptions(draft);
 return {mode:finite(s?.waterGoal,1,10000)?'manual':draft.water?.mode||'auto',glassMl:draft.water?.glassMl??250};
}
function meals(s=state){return Array.isArray(s?.meals)?copy(s.meals.filter(m=>mealsOK([m]))):[]}
function foodSearch(s=state){const draft=optionCopy(s||{});cleanOptions(draft);return {sort:'best',sources:[...sources],...draft.foodSearch}}
function migrate87(s=state){
 if(!object(s))return s;
 cleanOptions(s);
 // Do not persist a derived mode: older water forms only update waterGoal.
 s.water??={};s.water.glassMl??=250;
 if(s.meals===undefined)s.meals=[];
 s.display??={};
 const defaults=displayDefaults();
 for(const [key,value] of Object.entries(defaults))s.display[key]??=value;
 if(object(s.plan))s.plan.macroInput??='grams';
 s.foodSearch??={};s.foodSearch.sort??='best';s.foodSearch.sources??=[...sources];
 return s;
}
const baseMigrate=migrate;
migrate=function(...args){const result=baseMigrate.apply(this,args);migrate87(state);return result};
// Cloud login/logout replace state inside their functions before rendering.
// This also covers reset/import and preserves their existing save/CAS ordering.
const baseRender=render;
render=function(...args){migrate87(state);return baseRender.apply(this,args)};
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

const xpAt=level=>250*(level-1)+25*(level-1)*(level-2)/2;
const groups=[['high-estrogen','High Estrogen',[1,2,3]],['gym-tourist','Gym-Tourist',[4,5,6]],
 ['pump-chaser','Pump Chaser',[7,8,9]],['protein-junkie','Protein-Junkie',[10,12,14]],
 ['gym-rat','Gym Rat',[16,18,20]],['iron-addict','Iron Addict',[22,24,26]],
 ['mass-monster','Mass Monster',[28,31,34]],['natty-limit','Natty Limit',[37,40,43]],
 ['fake-natty','Fake Natty',[46,49,52]],['tren-cougher','Tren Cougher',[55]]];
const ranks=Object.freeze(groups.map(([key,name,levels],index)=>Object.freeze({index,key,name,
 levels:Object.freeze(levels),xp:Object.freeze(levels.map(xpAt))})));
const stages=ranks.flatMap(r=>r.levels.map((level,i)=>({index:r.index,key:r.key,name:r.name+(r.index===9?'':' '+['I','II','III'][i]),stage:i+1,level,xp:r.xp[i]})));
function rankForXp(value){
 const xp=finite(value)?Math.floor(value):0;
 let i=0;while(i+1<stages.length&&xp>=stages[i+1].xp)i++;
 const entry=stages[i],nextAt=stages[i+1]?.xp??null;
 const userLevel=typeof xpProgress==='function'?xpProgress(xp).level:Math.floor((Math.sqrt(361+.32*xp)-19)/2)+1;
 return {index:entry.index,key:entry.key,name:entry.name,stage:entry.stage,level:entry.level,stageLevel:entry.level,userLevel,nextAt,
  progress:nextAt===null?1:Math.max(0,Math.min(1,(xp-entry.xp)/(nextAt-entry.xp)))};
}
function rankForLevel(value){return rankForXp(xpAt(finite(value,1)?Math.floor(value):1))}
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
 pulsData87:Object.freeze({migrate:migrate87,display,water,meals,foodSearch,waterTarget,waterRecommendation,rankForLevel,rankForXp,rankFor:rankForXp,ranks,hapticsEnabled})});
})();
