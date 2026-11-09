/* PULS strength model. Pure projections: no save, storage, Auth or profile mutation.
 * Ratio = best Epley e1RM / bodyweight on the workout day (1 rep uses actual load).
 * Product thresholds, not population percentiles; see docs/STRENGTH-RANKS.md.
 * index = group 0..8; rankIndex = stage 0..24; score = continuous stage 0..24.
 */
(function(){
'use strict';
const names=['High Estrogen','Low Estrogen','Low Melanin','High Melanin','Protein Farter','BPC-157 Considerer','Batman Cycle','Superman Cycle','Tren Cougher'];
const ranks=Object.freeze(names.map((name,index)=>Object.freeze({index,key:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,
 stages:Object.freeze(index===8?[24]:[index*3,index*3+1,index*3+2])})));
// Lower bound for each group; below the second bound remains group 0.
const definitions={
 bench:['chest',[0,.4,.65,.9,1.15,1.4,1.65,1.9,2.2],.65],
 incline:['chest',[0,.35,.55,.75,1,1.2,1.4,1.65,1.9],.65],
 squat:['quads',[0,.6,.9,1.2,1.5,1.8,2.1,2.5,3],.75],
 deadlift:['posterior',[0,.8,1.1,1.5,1.8,2.2,2.6,3,3.5],.75],
 rdl:['posterior',[0,.6,.85,1.1,1.4,1.7,2,2.3,2.7],.75],
 overhead:['shoulders',[0,.25,.4,.55,.7,.85,1,1.15,1.35],.65],
 row:['back',[0,.35,.55,.75,1,1.2,1.4,1.65,1.9],.65],
 pullup:['back',[0,.65,.85,1,1.2,1.4,1.6,1.85,2.1],.75],
 pulldown:['back',[0,.4,.6,.8,1,1.2,1.4,1.65,1.9],.65],
 dip:['chest',[0,.65,.85,1,1.2,1.45,1.7,2,2.3],.7],
 legpress:['quads',[0,1,1.5,2,2.75,3.5,4.25,5,6],.75],
 // v90: Isolationen nachkalibriert, damit typische Mittelwerte (z. B. Seitheben 12 kg KH × 12
 // oder 27 kg Maschine × 12 bei 85 kg) im mittleren Bereich statt in den Spitzenrängen landen.
 curl:['biceps',[0,.2,.3,.42,.55,.68,.82,1,1.2],.6],
 triceps:['triceps',[0,.25,.38,.5,.65,.8,.95,1.12,1.35],.65],
 lateral:['shoulders',[0,.12,.2,.27,.33,.4,.5,.62,.75],.65],
 fly:['chest',[0,.22,.38,.55,.72,.9,1.1,1.32,1.55],.65],
 legcurl:['posterior',[0,.25,.4,.55,.7,.9,1.1,1.3,1.5],.75],
 legextension:['quads',[0,.3,.5,.7,.9,1.1,1.3,1.55,1.8],.75],
 hipthrust:['posterior',[0,.6,1,1.4,1.8,2.2,2.6,3,3.5],.8]
};
const standards=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([key,[group,male,factor]])=>[key,Object.freeze({group,
 male:Object.freeze(male),female:Object.freeze(male.map(x=>+(x*factor).toFixed(4)))})])));
const current=()=>typeof state==='undefined'?{}:state;
const day=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const canonical=x=>norm(x).replace(/\bpull ups?\b/g,'pullup').split(' ').map(x=>x.length>3&&x.endsWith('s')&&!x.endsWith('ss')?x.slice(0,-1):x).sort().join('-');
const catalog=()=>typeof exerciseCatalog==='undefined'?[]:exerciseCatalog;
function weightAt(s,date){
 let latest=null;
 for(const w of s.weights||[])if(typeof w?.date==='string'&&w.date<=date&&numeric(w.kg)&&w.kg>=20&&w.kg<=400&&(!latest||w.date>=latest.date))latest=w;
 return latest?.kg??(numeric(s.profile?.weight)&&s.profile.weight>=20&&s.profile.weight<=400?s.profile.weight:null);
}
function classify(ex){
 const n=norm(ex?.name),equipment=norm(ex?.equipment),all=n+' '+equipment;
 // Assisted/counterbalanced/bodyweight-only movements and ambiguous specialty
 // lifts are not comparable by a positive recorded external load.
 if(!n||/assist|unterstutzt|gravitron|negativ|eccentric|australian|inverted|\bband(?:s|ed)?\b|push up|pushup|plyo|jump|isometric|one arm chin|one arm pull|muscle up|bench dip|sissy|split squat|bulgarian|pistol|lunge|thruster|clean|snatch|jerk|good morning|calf|waden|rowing/.test(all))return null;
 if(/pullup|pull up|chin up|chinup|klimmzug|\bdips?\b|dipmaschine/.test(n)&&/machine|maschine/.test(all))return null;
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
 const dumbbell=/dumbbell|kurzhantel|\bkh\b/.test(all)||/hammer curl/.test(n),single=/single arm|one arm|single leg|one leg|einarm|einbein/.test(n);
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
 return {type,group:standards[type].group,kind,factor,loadFactor:dumbbell?2:1,bodyweight};
}
function rankAt(score,extra={}){
 const value=numeric(score)?Math.max(0,Math.min(24,score)):null;
 if(value===null)return {index:null,rankIndex:null,key:null,name:current().language==='en'?'Rank unknown':'Rang unbekannt',stage:null,score:null,ratio:null,nextRatio:null,nextAt:null,nextName:null,progress:0,...extra};
 const rankIndex=Math.min(24,Math.floor(value+1e-9)),index=Math.min(8,Math.floor(rankIndex/3)),stage=index===8?1:rankIndex%3+1,g=ranks[index];
 const next=rankIndex===24?null:rankAtName(rankIndex+1);
 return {index,rankIndex,key:g.key,name:g.name+(index===8?'':' '+['I','II','III'][stage-1]),stage,score:value,ratio:null,nextRatio:null,
  nextAt:rankIndex===24?null:rankIndex+1,nextName:next,progress:rankIndex===24?1:Math.max(0,value-rankIndex),...extra};
}
function rankAtName(i){const g=ranks[Math.floor(i/3)];return g.name+(i===24?'':' '+['I','II','III'][i%3])}
function scoreFor(ratio,thresholds){
 let i=0;while(i<8&&ratio>=thresholds[i+1]-1e-10)i++;
 return i===8?24:i*3+3*(ratio-thresholds[i])/(thresholds[i+1]-thresholds[i]);
}
function ratioFor(score,t){if(score>=24)return t[8];const i=Math.floor(score/3);return t[i]+(t[i+1]-t[i])*(score-i*3)/3}
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
    const e1rm=load*(reps===1?1:1+reps/30),ratio=e1rm/bw,score=scoreFor(ratio,thresholds);
    const before=best.get(key);
    // Best estimated maximum, normalized with the weight on that workout day.
    if(before&&(before.e1rm>e1rm||before.e1rm===e1rm&&before.ratio>=ratio))continue;
    const r=rankAt(score,{ratio,nextRatio:score>=24?null:ratioFor(Math.min(24,Math.floor(score+1e-9)+1),thresholds),
     exerciseName:name,exerciseId:e.exerciseId,key,rankKey:ranks[Math.min(8,Math.floor(score/3))].key,group:model.group,
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
  r.nextLift=chosen.filter(x=>x.score+increase<=24+1e-9).map(x=>{
   const nextRatio=ratioFor(Math.min(24,x.score+increase),x.thresholds);
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
 return {strength_rank:rank.rankIndex,lift_ranks:list.map(r=>({key:r.key,name:r.exerciseName,rankIndex:r.rankIndex,ratio:Math.round(r.ratio*100)/100}))
  .filter(r=>/^[a-z0-9-]{1,180}$/.test(r.key)&&[...r.name].length<=120&&r.ratio>0&&r.ratio<=1000).slice(0,40)};
}
window.pulsStrength=Object.freeze({ranks,standards,classify,weightAt,rankAt,exerciseRank,all,overall,summary,progressToNext,workoutProgress});
})();
