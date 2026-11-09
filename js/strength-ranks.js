/* PULS strength model. Pure projections: no save, storage, Auth or profile mutation.
 * Ratio = best Epley e1RM / bodyweight on the workout day (1 rep uses actual load).
 * Product thresholds, not population percentiles; see docs/STRENGTH-RANKS.md.
 * Scale 2 (v94): index = group 0..17; rankIndex = stage 0..39; score = continuous stage 0..39.
 * v94: thresholds recalibrated on the same scale (more headroom, 18 groups on the same 40 stages).
 * Scale 1 (v88-v92, still sent by older friends/backups): group 0..8, stage 0..24; see fromLegacy/toLegacy.
 */
(function(){
'use strict';
const names=['Gym Tourist','High Estrogen','Low Estrogen','Low Melanin','High Melanin','Pre-Workout Itcher','Creatine Bloater','Protein Farter',
 'Test Booster Believer','BPC-157 Considerer','Blast & Cruiser','Batman Cycle','Superman Cycle','Tren Cougher','Insulin Gambler','HGH Gut','Open Class Monster','Mr. Olympia'];
const SCALE=2,TOP=names.length-1,MAX=39;
const STAGE_COUNTS=Object.freeze([3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,1]);
let firstStage=0;
const ranks=Object.freeze(names.map((name,index)=>{
 const stages=Object.freeze(Array.from({length:STAGE_COUNTS[index]},(_,i)=>firstStage+i));firstStage+=stages.length;
 return Object.freeze({index,key:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,stages});
}));
const groupFor=stage=>ranks.findLast(r=>stage>=r.stages[0]);
// New group lower bounds expressed as continuous stages of the old 25-stage scale (v93 split:
// Gym Tourist, Pre-Workout Itcher, Creatine Bloater, Test Booster Believer and Blast & Cruiser
// each took one half of an old group interval). Index mapping only; v94 thresholds differ.
const LEGACY_BOUNDS=Object.freeze([0,1.5,3,6,9,10.5,12,13.5,15,16.5,18,19.5,21,24]);
// Old continuous stage 0..24 -> new continuous stage 0..39 (same position on the old scale).
function fromLegacyScore(s){
 if(!(s>0))return 0;if(s>=24)return MAX;
 let k=0;while(k<LEGACY_BOUNDS.length-2&&s>=LEGACY_BOUNDS[k+1])k++;
 return k*3+3*(s-LEGACY_BOUNDS[k])/(LEGACY_BOUNDS[k+1]-LEGACY_BOUNDS[k]);
}
// Stage indices: old stage i covers new stages fromLegacy(i)..fromLegacy(i+1)-1.
const fromLegacy=i=>Number.isInteger(i)&&i>=0&&i<=24?Math.round(fromLegacyScore(i)):null;
function toLegacy(n){
 if(!Number.isInteger(n)||n<0||n>MAX)return null;
 let i=0;while(i<24&&fromLegacy(i+1)<=n)i++;return i;
}
// v94 calibration: six male levels per exercise (e1RM/BW), roughly following common public
// strength-standard tables: beginner, novice, intermediate, advanced, elite, world class.
// They sit on fixed stages 7/13/20/27/35/39: a multi-year intermediate lands mid-scale (~20),
// advanced at 27, elite at 35, exceptional competition-level ratios at 39.
const LEVEL_STAGES=Object.freeze([0,7,13,20,27,35,39]);
const definitions={
 bench:['chest',[.6,.85,1.2,1.6,2,2.4],.65],
 incline:['chest',[.5,.72,1,1.35,1.7,2.05],.65],
 squat:['quads',[.8,1.15,1.55,2.05,2.6,3.1],.75],
 deadlift:['posterior',[1,1.4,1.85,2.4,3,3.5],.75],
 rdl:['posterior',[.8,1.15,1.55,2,2.5,2.9],.75],
 overhead:['shoulders',[.4,.57,.78,1.03,1.3,1.55],.65],
 row:['back',[.5,.7,.97,1.3,1.65,2],.65],
 pullup:['back',[1,1.13,1.38,1.65,1.95,2.25],.75],
 pulldown:['back',[.5,.7,.97,1.3,1.65,2],.65],
 dip:['chest',[1,1.2,1.45,1.75,2.1,2.45],.7],
 legpress:['quads',[1.1,1.7,2.5,3.5,4.6,5.6],.75],
 curl:['biceps',[.25,.38,.55,.78,1,1.2],.6],
 triceps:['triceps',[.2,.33,.5,.72,.95,1.15],.65],
 lateral:['shoulders',[.12,.22,.36,.54,.75,.9],.65],
 fly:['chest',[.35,.58,.9,1.3,1.75,2.1],.65],
 legcurl:['posterior',[.35,.53,.77,1.07,1.43,1.75],.75],
 legextension:['quads',[.38,.62,.93,1.3,1.73,2.1],.75],
 hipthrust:['posterior',[.6,1.05,1.6,2.3,3.1,3.7],.8]
};
// Group lower bounds on the fixed 40-stage scale, interpolated between performance levels.
const expand=levels=>{const points=[0,...levels];return ranks.map(g=>{
 const s=g.stages[0];let j=0;while(j<LEVEL_STAGES.length-2&&s>LEVEL_STAGES[j+1])j++;
 return +(points[j]+(points[j+1]-points[j])*(s-LEVEL_STAGES[j])/(LEVEL_STAGES[j+1]-LEVEL_STAGES[j])).toFixed(4);
})};
// Stack labels and lever arms are not standardized. Device-only scores stop at mid-scale.
const DEVICE_LIMIT=22;
const standards=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([key,[group,anchors,factor]])=>{
 const male=expand(anchors);
 return [key,Object.freeze({group,male:Object.freeze(male),female:Object.freeze(male.map(x=>+(x*factor).toFixed(4)))})];
})));
const current=()=>typeof state==='undefined'?{}:state;
const day=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const canonical=x=>norm(x).replace(/\bpull ups?\b/g,'pullup').split(' ').map(x=>x.length>3&&x.endsWith('s')&&!x.endsWith('ss')?x.slice(0,-1):x).sort().join('-');
const catalog=()=>typeof exerciseCatalog==='undefined'?[]:exerciseCatalog;
function weightAt(s,date){
 let latest=null,earliest=null;
 for(const w of s.weights||[])if(typeof w?.date==='string'&&numeric(w.kg)&&w.kg>=20&&w.kg<=400){
  if(w.date<=date&&(!latest||w.date>=latest.date))latest=w;
  if(!earliest||w.date<=earliest.date)earliest=w;
 }
 // Last-resort approximation for older imports, without creating measurements.
 return latest?.kg??(numeric(s.profile?.weight)&&s.profile.weight>=20&&s.profile.weight<=400?s.profile.weight:earliest?.kg??null);
}
function classify(ex){
 const n=norm(ex?.name),equipment=norm(ex?.equipment),all=n+' '+equipment;
 // Assisted/counterbalanced/bodyweight-only movements and ambiguous specialty
 // lifts are not comparable by a positive recorded external load.
 if(!n||/assist|unterstutzt|gravitron|australian|inverted|\bband(?:s|ed)?\b|push up|pushup|plyo|jump|isometric|one arm chin|one arm pull|muscle up|bench dip|sissy|split squat|bulgarian|pistol|lunge|thruster|clean|snatch|jerk|good morning|calf|waden|rowing/.test(all))return null;
 if(/pullup|pull up|chin up|chinup|klimmzug|\bdips?\b|dipmaschine/.test(n)&&/negativ|eccentric/.test(all))return null;
 if(/pullup|pull up|chin up|chinup|klimmzug/.test(n)&&/machine|maschine/.test(all))return null;
 let type;
 if(/romanian|rumanisch|\brdl\b|stiff leg/.test(n))type='rdl';
 else if(/deadlift|kreuzheben/.test(n))type='deadlift';
 else if(/leg press|beinpresse/.test(n))type='legpress';
 else if(/squat|kniebeuge/.test(n))type='squat';
 else if(/hip thrust/.test(n))type='hipthrust';
 else if(/pullup|pull up|chin up|chinup|klimmzug/.test(n))type='pullup';
 else if(/pulldown|pull down|latzug|latziehen/.test(n)&&!/straight arm|stiff arm|gestreckt/.test(n))type='pulldown';
 else if(/\bdips?\b|dipmaschine/.test(n))type=/machine|maschine|leverage|plate loaded/.test(all)?'triceps':'dip';
 else if(/lateral raise|side lateral|seitheben/.test(n))type='lateral';
 else if(/fly|flies|butterfly|pec deck|peck deck|cable cross|kabel.*cross/.test(n))type=/rear|reverse/.test(n)?null:'fly';
 else if(/row|rudern/.test(n)&&!/upright|aufrecht/.test(n))type='row';
 else if(/leg curl|hamstring curl|beinbeug/.test(n))type='legcurl';
 else if(/leg extension|knee extension|beinstreck/.test(n))type='legextension';
 else if(/curl/.test(n)&&!/wrist|reverse|leg/.test(n))type='curl';
 else if(/tricep|trizeps|pushdown|push down|skull ?crusher/.test(n))type='triceps';
 else if(/shoulder.*press|military.*press|overhead.*press|schulter.*press|schulterdruck|arnold.*press/.test(n))type='overhead';
 else if(/incline.*(?:press|bench)|schragbank/.test(n))type='incline';
 else if(/bench.*press|chest.*press|bankdrucken|brustpress|brustdruck|floor press/.test(n))type='bench';
 if(!type||/kettlebell|resistance band|exercise ball|medicine ball/.test(equipment)||/goblet|single dumbbell|one dumbbell/.test(n))return null;
 // v94: "Cable/Machine/Rope Hammer Curl" is a stack load, not a per-hand dumbbell load.
 const dumbbell=/dumbbell|kurzhantel|\bkh\b/.test(all)||/hammer curl/.test(n)&&!/cable|kabel|machine|maschine|rope|seil/.test(all),single=/single arm|one arm|single leg|one leg|einarm|einbein/.test(n);
 const kind=/smith|multipresse/.test(all)?'smith':dumbbell?'dumbbell':/cable|kabel/.test(all)?'cable':/machine|maschine|leverage|plate loaded|iso lateral|hack squat|leg press|leg curl|leg extension|butterfly/.test(all)?'machine':'barbell';
 const bodyweight=type==='pullup'||type==='dip';
 if(/body only|bodyweight|body weight|eigengewicht/.test(all)&&!bodyweight)return null;
 // Convert DB-per-hand to combined load; unilateral machines/cables use half
 // the bilateral standard. DB aggregate standards are 80% of barbell presses,
 // 90% of rows/hinges/squats; isolation standards already use aggregate load.
 let factor=kind==='smith'?1.05:kind==='machine'?1.15:kind==='cable'?.9:1;
 if(kind==='dumbbell')factor=['bench','incline','overhead'].includes(type)?.8:['row','squat','deadlift','rdl'].includes(type)?.9:type==='fly'?.75:1;
 if(['legpress','legcurl','legextension','pulldown','lateral','fly','triceps'].includes(type)&&kind==='machine')factor=1;
 if(type==='squat'&&/front/.test(n))factor*=.8;
 if(single&&kind!=='dumbbell')factor*=.5;
 const device=['machine','cable','smith'].includes(kind)||['pulldown','legpress','legcurl','legextension'].includes(type)||
  /pushdown|push down|rope|seil|butterfly|pec deck|peck deck|cross ?over|hack squat/.test(all);
 return {type,group:standards[type].group,kind,factor,loadFactor:dumbbell?2:1,bodyweight,device};
}
function rankAt(score,extra={}){
 const value=numeric(score)?Math.max(0,Math.min(MAX,score)):null;
 if(value===null)return {index:null,rankIndex:null,key:null,name:current().language==='en'?'Rank unknown':'Rang unbekannt',stage:null,score:null,ratio:null,nextRatio:null,nextAt:null,nextName:null,progress:0,...extra};
 const rankIndex=Math.min(MAX,Math.floor(value+1e-9)),g=groupFor(rankIndex),index=g.index,stage=rankIndex-g.stages[0]+1;
 const next=rankIndex===MAX?null:rankAtName(rankIndex+1);
 return {index,rankIndex,key:g.key,name:rankAtName(rankIndex),stage,score:value,ratio:null,nextRatio:null,
  nextAt:rankIndex===MAX?null:rankIndex+1,nextName:next,progress:rankIndex===MAX?1:Math.max(0,value-rankIndex),...extra};
}
function rankAtName(i){const g=groupFor(i);return g.name+(g.stages.length===1?'':' '+['I','II','III'][i-g.stages[0]])}
function scoreFor(ratio,thresholds){
 let i=0;while(i<TOP&&ratio>=thresholds[i+1]-1e-10)i++;
 if(i===TOP)return MAX;
 const start=ranks[i].stages[0],width=ranks[i+1].stages[0]-start;
 return start+width*(ratio-thresholds[i])/(thresholds[i+1]-thresholds[i]);
}
function ratioFor(score,t){
 if(score>=MAX)return t[TOP];
 const i=groupFor(score).index,start=ranks[i].stages[0],width=ranks[i+1].stages[0]-start;
 return t[i]+(t[i+1]-t[i])*(score-start)/width;
}
function evaluate(s=current(),until=day()){
 const byId=new Map(),byName=new Map();
 for(const e of catalog()){byId.set(e.id,e);byName.set(canonical(e.name),e)}
 const book=new Map((s.exerciseBook||[]).map(e=>[e.id,e])),best=new Map(),sex=s.profile?.sex==='female'?'female':'male';
 for(const w of s.workouts||[]){
  if(!w.finished||typeof w.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(w.date)||w.date>until)continue;
  const bw=weightAt(s,w.date);if(bw===null)continue;
  for(const e of w.exercises||[]){
   const b=book.get(e.exerciseId),name=b?.name||e.name,lib=byId.get(e.exerciseId)||byName.get(canonical(name));
   const meta={...lib,...b,name},model=classify(meta);if(!model)continue;
   // Name-based canonical keys also match imported/custom equivalents across
   // accounts without sharing local UUIDs. Equipment stays part of the key.
   const key=canonical(lib?.name||name)+'--'+model.kind;
   const thresholds=standards[model.type][sex].map(x=>x*model.factor);
   for(const set of e.sets||[]){
    const entered=v=>typeof v==='number'||typeof v==='string'&&v.trim()!=='';
    if(!set.done||!entered(set.kg)||!entered(set.reps))continue;
    const kg=Number(set.kg),reps=Number(set.reps);
    if(!Number.isFinite(kg)||kg<0||!Number.isInteger(reps)||reps<1||reps>12)continue;
    const load=model.bodyweight?bw+kg:kg*model.loadFactor;if(!(load>0))continue;
    const e1rm=load*(reps===1?1:1+reps/30),ratio=e1rm/bw,score=Math.min(model.device?DEVICE_LIMIT:MAX,scoreFor(ratio,thresholds));
    const before=best.get(key);
    // Best estimated maximum, normalized with the weight on that workout day.
    if(before&&(before.e1rm>e1rm||before.e1rm===e1rm&&before.ratio>=ratio))continue;
    const r=rankAt(score,{ratio,limit:model.device?DEVICE_LIMIT:MAX,nextRatio:score>=(model.device?DEVICE_LIMIT:MAX)?null:ratioFor(Math.min(MAX,Math.floor(score+1e-9)+1),thresholds),
     exerciseName:name,exerciseId:e.exerciseId,key,rankKey:groupFor(score).key,group:model.group,
     e1rm,bodyweight:bw,date:w.date,thresholds,loadFactor:model.loadFactor,reps,
     repFactor:reps===1?1:1+reps/30});
    best.set(key,r);
   }
  }
 }
 return [...best.values()].sort((a,b)=>b.score-a.score||b.ratio-a.ratio||a.key.localeCompare(b.key));
}
function overallFrom(all){
 const groups=new Map();for(const r of all)if(!groups.has(r.group))groups.set(r.group,r);
 const chosen=[...groups.values()].slice(0,5);
 if(!chosen.length)return rankAt(null,{exercises:chosen,groups:0});
 const score=chosen.reduce((n,r)=>n+r.score,0)/chosen.length,ratio=chosen.reduce((n,r)=>n+r.ratio,0)/chosen.length;
 const r=rankAt(score,{ratio,exercises:chosen,groups:chosen.length});
 if(r.nextAt!==null){
  const increase=(r.nextAt-score)*chosen.length;
  r.nextLift=chosen.filter(x=>x.nextRatio!==null&&x.score+increase<=x.limit+1e-9).map(x=>{
   const nextRatio=ratioFor(Math.min(MAX,x.score+increase),x.thresholds);
   return {exerciseName:x.exerciseName,key:x.key,kg:Math.max(0,(nextRatio-x.ratio)*x.bodyweight/x.loadFactor/x.repFactor),reps:x.reps,nextRatio};
  }).sort((a,b)=>a.kg-b.kg)[0]||null;
 }
 return r;
}
const all=(s=current(),until=day())=>evaluate(s,until);
function exerciseRank(exId,s=current(),until=day()){
 const list=all(s,until),direct=list.find(r=>r.exerciseId===exId||r.key===exId);if(direct)return direct;
 const ex=(s.exerciseBook||[]).find(e=>e.id===exId)||catalog().find(e=>e.id===exId);
 if(!ex)return rankAt(null);
 const lib=catalog().find(e=>canonical(e.name)===canonical(ex.name)),model=classify({...lib,...ex});
 return model?list.find(r=>r.key===canonical(lib?.name||ex.name)+'--'+model.kind)||rankAt(null):rankAt(null);
}
const overall=(s=current(),until=day())=>overallFrom(all(s,until));
function workoutSource(workoutId,s,include){
 const at=(s.workouts||[]).findIndex(w=>w.id===workoutId),workout=s.workouts?.[at];
 if(!workout)return {...s,workouts:[]};
 return {...s,workouts:s.workouts.filter((w,i)=>{
  if(w.id===workoutId)return include;
  if(w.date!==workout.date)return w.date<workout.date;
  const time=w.startedAt??w.finishedAt,target=workout.startedAt??workout.finishedAt;
  return numeric(time)&&numeric(target)&&time!==target?time<target:i<at;
 })};
}
const progressToNext=rank=>rank?.rankIndex===null||!numeric(rank?.progress)?0:Math.max(0,Math.min(1,rank.progress));
function workoutProgress(exId,workoutId,s=current()){
 const workout=s.workouts?.find(w=>w.id===workoutId),until=workout?.date||day();
 const before=exerciseRank(exId,workoutSource(workoutId,s,false),until),after=exerciseRank(exId,workoutSource(workoutId,s,true),until);
 return {before,after,from:progressToNext(before),to:progressToNext(after),promoted:before.rankIndex!==null&&after.rankIndex>before.rankIndex};
}
function summary(s=current(),until=day()){
 const list=all(s,until),rank=overallFrom(list);
 // rank_scale marks the 40-stage indices for friends; older servers get toLegacy() values from friends.js.
 return {strength_rank:rank.rankIndex,lift_ranks:list.map(r=>({key:r.key,name:r.exerciseName,rankIndex:r.rankIndex,ratio:Math.round(r.ratio*100)/100}))
  .filter(r=>/^[a-z0-9-]{1,180}$/.test(r.key)&&[...r.name].length<=120&&r.ratio>0&&r.ratio<=1000).slice(0,40),rank_scale:SCALE};
}
window.pulsStrength=Object.freeze({ranks,standards,classify,weightAt,rankAt,exerciseRank,all,overall,summary,progressToNext,workoutProgress,
 scale:SCALE,maxRankIndex:MAX,fromLegacy,toLegacy});
})();
