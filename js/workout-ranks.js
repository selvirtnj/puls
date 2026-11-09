/* Fourth completion page. Uses existing saved workouts and pure strength projections. */
(function(){
'use strict';
const t=(de,en)=>state.language==='en'?en:de;
const escape=value=>esc(String(value));
const emblem=rank=>window.pulsFriendsBoard.emblem(rank.index,rank.stage,52);
function rows(id){
 const workout=state.workouts.find(w=>w.id===id),seen=new Set();let legacyRanks;
 return (workout?.exercises||[]).filter(e=>e.sets?.some(s=>s.done)).flatMap(e=>{
  const exerciseId=e.exerciseId||(legacyRanks??=window.pulsStrength.all(state,workout.date)).find(r=>r.exerciseName===e.name)?.key||e.name;
  if(seen.has(exerciseId))return [];seen.add(exerciseId);
  const rank=window.pulsStrength.workoutProgress(exerciseId,id),key=rank.after.key||exerciseId;
  if(key!==exerciseId&&seen.has(key))return [];seen.add(key);
  return [{...rank,name:e.name}];
 });
}
let pageRows=null;
function html(id){
 const workout=state.workouts.find(w=>w.id===id);
 const bodyweight=window.pulsStrength.weightAt(state,workout?.date);
 if(pageRows?.id!==id||pageRows.state!==state||pageRows.workout!==workout||pageRows.profile!==state.profile||pageRows.bodyweight!==bodyweight){
  pageRows={id,state,workout,profile:state.profile,bodyweight,rows:rows(id)};
 }
 const ranks=pageRows.rows;
 return `<div class="completion workout-ranks" data-no-translate data-completion-step="3"><h1>${t('Deine Übungsränge','Your exercise ranks')}</h1><div class="wr-list">${ranks.map((r,i)=>{
  const known=r.after.rankIndex!==null,isNew=known&&r.before.rankIndex===null,percent=Math.round(r.to*100);
  return `<section class="wr-row" data-wr-row="${i}"><div class="wr-emblem">${emblem(r.after)}</div><div class="wr-details"><h2>${escape(r.name)}</h2><div class="wr-rank">${known?escape(r.after.name):bodyweight===null?`<button type="button" class="textbtn" onclick="pulsWorkoutRanks.weight()">${t('Gewicht eintragen','Add weight')}</button>`:t('ohne Rang','unranked')}</div>${isNew?`<strong class="wr-promotion">${t('Neu','New')}</strong>`:r.promoted?`<strong class="wr-promotion">${t('Aufgestiegen','Rank up')}</strong>`:''}${known?`<div class="wr-meter" role="progressbar" aria-label="${escape(r.name)} · ${t('Rangfortschritt','Rank progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${r.to*100}%"></i></div><small>${r.after.nextName?escape(r.after.nextName)+' · '+percent+'%':t('Höchster Rang','Highest rank')}</small>`:''}</div></section>`;
 }).join('')}</div><button type="button" class="btn full completioncontinue" onclick="minimizeSession();trainTab='current';go('workout')">${t('Fertig','Done')}</button></div>`;
}
const baseCompletion=completionHtml;
completionHtml=function(id,step){
 if(typeof completionReview!=='undefined'&&completionReview)return baseCompletion.apply(this,arguments);
 if(step===3){
  try{return html(id)}catch(e){pageRows=null;return baseCompletion.call(this,id,2)}
 }
 const result=baseCompletion.apply(this,arguments);
 if(step!==2)return result;
 return result.replace(/(<button class="btn full completioncontinue" )[^>]*>[^<]*<\/button>/,`$1onclick="completionStep=3;renderWorkoutSession()">${t('Weiter','Next')}</button>`);
};
const baseSession=renderWorkoutSession;
// Once per mounted page, so ordinary renders cannot repeat sounds or animations.
let played=null;
renderWorkoutSession=function(){
 const result=baseSession.apply(this,arguments),root=document.querySelector('#session-root .workout-ranks');
 if(!root){played=null;pageRows=null;return result}
 const key=pageRows;
 if(played===key)return result;played=key;
 const reduced=window.pulsMotion?.reduced?.()??true;
 let sounded=false;
 try{for(const [i,r] of (pageRows?.id===completionId?pageRows.rows:[]).entries()){
  const row=root.querySelector(`[data-wr-row="${i}"]`),bar=row?.querySelector('.wr-meter i'),badge=row?.querySelector('.wr-emblem');
  if(!row)continue;
  if(!reduced&&bar?.animate){
   // Complete the old interval before resetting to the new rank's interval.
   const frames=r.promoted?[{width:r.from*100+'%',offset:0},{width:'100%',offset:.45},{width:'0%',offset:.46},{width:r.to*100+'%',offset:1}]:[{width:r.from*100+'%'},{width:r.to*100+'%'}];
   bar.animate(frames,{duration:900,easing:'ease-in-out'});
  }
  if(r.promoted){
   if(!reduced&&badge?.animate){
    badge.innerHTML=emblem(r.before);
    badge.animate([{transform:'scale(1)'},{transform:'scale(.75)'},{transform:'scale(1)'}],{duration:450});
    setTimeout(()=>{try{if(badge.isConnected){badge.innerHTML=emblem(r.after);window.pulsMotion?.reveal?.(badge,{sound:false})}}catch(e){}},450);
   }
   if(!sounded&&typeof pulsSound==='function'){pulsSound('rankUp');sounded=true}
  }
 }}catch(e){}
 return result;
};
function weight(){
 const workout=state.workouts.find(w=>w.id===completionId);
 if(!workout||typeof weightForm!=='function')return;
 weightForm();
 // Reuse the existing validated save/sync path, with the actual workout day.
 const input=document.getElementById('wdate');if(input)input.value=workout.date;
 const kg=document.getElementById('kg');if(kg)kg.value=state.weights?.find(w=>w.date===workout.date)?.kg??'';
}
window.pulsWorkoutRanks=Object.freeze({rows,html,weight});
})();
