const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={state:{},today:()=>'2026-11-09',exerciseCatalog:[]};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/strength-ranks.js','utf8'),ctx);
const api=ctx.pulsStrength,clone=x=>JSON.parse(JSON.stringify(x));
const entry=(name,kg,reps=1,id=name)=>({exerciseId:id,name,sets:[{kg,reps,done:true}]});
const sample=(exercises,bw=100)=>({profile:bw?{weight:bw}:undefined,workouts:[{id:'import-id',finished:true,importSource:'workout-csv',date:'2026-11-08',exercises}]});
const rank=(name,kg,reps=1,bw=100)=>api.all(sample([entry(name,kg,reps)],bw))[0];
assert.equal(api.ranks.length,9);assert.equal(api.ranks.at(-1).name,'Tren Cougher');
for(const standard of Object.values(api.standards))for(const sex of ['male','female']){
 assert.equal(standard[sex].length,9);assert(standard[sex].every((n,i,a)=>i===0||n>a[i-1]));
}
assert.equal(rank('Barbell Bench Press',200,1,70).index,8);
assert(rank('Barbell Bench Press',200,1,200).index<8,'same weight at higher BW ranks lower');
assert.equal(rank('Barbell Bench Press',100,6).e1rm,120);
const maxima=sample([entry('Barbell Bench Press',100)]);maxima.weights=[{date:'2026-11-07',kg:50},{date:'2026-11-08',kg:100}];
maxima.workouts.push({finished:true,date:'2026-11-07',exercises:[entry('Barbell Bench Press',90)]});
assert.equal(api.all(maxima)[0].e1rm,100,'best e1RM, with contemporaneous BW, determines the lift');
assert.equal(rank('Dumbbell Bench Press',40).ratio,.8,'DB input is per hand');
assert.equal(rank('Dumbbell Bench Press',40).rankIndex,rank('Barbell Bench Press',100).rankIndex,'DB aggregate standard scales to 80%');
assert.equal(rank('Smith Machine Bench Press',105).rankIndex,rank('Barbell Bench Press',100).rankIndex);
assert.equal(rank('Machine Chest Press',115).rankIndex,rank('Barbell Bench Press',100).rankIndex);
assert.equal(rank('Cable Chest Press',90).rankIndex,rank('Barbell Bench Press',100).rankIndex);
ctx.exerciseCatalog.push({id:'library-bench',name:'Metadata Bench Press',equipment:'dumbbell'});
assert.equal(api.all(sample([entry('Metadata Bench Press',40,1,'library-bench')]))[0].ratio,.8,'library equipment participates');
assert.equal(rank('Single-Arm Dumbbell Row',30).ratio,.6);
assert.equal(rank('Pullups',20).ratio,1.2);assert.equal(rank('Dips',0).ratio,1);
assert.equal(rank('Pull-Up (Bodyweight)',0).ratio,1,'existing explicitly logged free pull-ups stay supported');
assert.equal(rank('Assisted Pull-Up Machine',20),undefined);
assert.equal(rank('Jump Squat',20),undefined);assert.equal(rank('Unknown Specialty Lift',20),undefined);
assert.equal(rank('Calf Press On The Leg Press Machine',100),undefined);
assert.equal(api.all(sample([entry('Barbell Bench Press',100)],null)).length,0);
assert.equal(api.overall(sample([entry('Barbell Bench Press',100)],null)).name,'Rang unbekannt');
for(const reps of [0,13,1.5,'',null])assert.equal(rank('Barbell Bench Press',100,reps),undefined);
for(const kg of ['',null,true,'   '])assert.equal(rank('Pullups',kg),undefined,'missing external load is not invented zero');
const history=sample([entry('Barbell Bench Press',100)]);history.weights=[{date:'2026-11-07',kg:80},{date:'2026-11-09',kg:50}];
assert.equal(api.all(history)[0].bodyweight,80,'future measurement excluded');
history.weights=[{date:'2026-11-09',kg:50}];assert.equal(api.all(history)[0].bodyweight,100,'profile fallback');
const female=sample([entry('Barbell Bench Press',100)]);female.profile.sex='female';
assert(api.all(female)[0].score>rank('Barbell Bench Press',100).score);
const multi=sample([entry('Barbell Bench Press',100),entry('Barbell Squat',150),entry('Barbell Row',100)]);
const before=JSON.stringify(multi),overall=api.overall(multi);
assert.equal(overall.groups,3);assert.equal(overall.score,api.all(multi).reduce((n,r)=>n+r.score,0)/3);
assert(overall.nextLift.kg>0);assert.equal(JSON.stringify(multi),before,'pure projection retains IDs/data');
const sameGroup=sample([entry('Barbell Bench Press',100),entry('Incline Bench Press',90),entry('Dips',30)]);
assert.equal(api.overall(sameGroup).groups,1,'three chest variants get only one vote');
assert.equal(api.overall(sameGroup).score,api.all(sameGroup)[0].score);
const first=sample([entry('Cable Crossover',15,10)],80);
first.onboardingComplete=true;first.weights=[];
assert.equal(api.overall(first).groups,1);assert.equal(api.overall(first).score,api.all(first)[0].score);
const skipped=clone(first);skipped.profile=null;
assert.equal(api.overall(skipped).rankIndex,null,'skip never invents BW');
skipped.weights=[{date:'2026-11-08',kg:80}];
assert.equal(api.overall(skipped).score,api.overall(first).score,'existing measurement unlocks first workout');
for(const [name,type] of [['Cable Cross-Over','fly'],['Peck Deck (Machine)','fly'],['Hamstring Curl (Machine)','legcurl'],['Knee Extension (Machine)','legextension'],['Latziehen (Kabel)','pulldown'],['Brustdrücken (Maschine)','bench'],['Schulterdrücken (Kurzhantel)','overhead'],['Beinbeugen (Maschine)','legcurl']]){
 assert.equal(api.classify({name}).type,type,name);assert(rank(name,20,10,80),name);
}
for(const name of ['Assisted Chest Press','Bodyweight Squat','Cable Straight Arm Pulldown','Band Chest Press','Reverse Peck Deck','Goblet Squat'])assert.equal(rank(name,20),undefined,name);
const two=sample([entry('Machine Chest Press',60,10),entry('Seated Cable Row',30,10)],80);
assert.equal(api.overall(two).groups,2);
assert.equal(api.overall(two).score,api.all(two).reduce((n,r)=>n+r.score,0)/2,'missing groups add no bonus');
for(const source of [first,two]){
 const payload=clone(api.summary(source));
 assert(Number.isInteger(payload.strength_rank)&&payload.strength_rank>=0&&payload.strength_rank<=24);
 assert(payload.lift_ranks.length>=1&&payload.lift_ranks.length<=40);
 for(const lift of payload.lift_ranks){
  assert.deepEqual(Object.keys(lift).sort(),['key','name','rankIndex','ratio']);
  assert.match(lift.key,/^[a-z0-9-]{1,180}$/);assert(lift.name.trim().length>=1&&[...lift.name].length<=120);
  assert(Number.isInteger(lift.rankIndex)&&lift.rankIndex>=0&&lift.rankIndex<=24);
  assert(lift.ratio>0&&lift.ratio<=1000&&Math.abs(lift.ratio*100-Math.round(lift.ratio*100))<1e-9);
 }
}
multi.workouts[0].exercises.push(entry('Dumbbell Bench Press',30));assert.equal(api.overall(multi).score,overall.score,'only best per group counts');
multi.workouts[0].exercises.push(entry('Barbell Deadlift',200),entry('Barbell Curl',50),entry('Triceps Pushdown',60));
assert.equal(api.overall(multi).exercises.length,5);
for(let i=0;i<25;i++){const r=api.rankAt(i);assert.equal(r.rankIndex,i);assert.equal(r.stage,i===24?1:i%3+1)}
assert.equal(api.rankAt(24).nextAt,null);assert.equal(api.rankAt(24).name,'Tren Cougher');
const edge=rank('Barbell Bench Press',40);assert.equal(edge.name,'Low Estrogen I');assert.equal(edge.progress,0);
assert.equal(rank('Barbell Bench Press',40+25/3).name,'Low Estrogen II');
const skip=sample([entry('Barbell Bench Press',300)]);skip.workouts[0].finished=false;assert.equal(api.all(skip).length,0);
skip.workouts[0].finished=true;skip.workouts[0].exercises[0].sets[0].done=false;assert.equal(api.all(skip).length,0);
const summary=api.summary(multi);assert.equal(summary.strength_rank,api.overall(multi).rankIndex);assert(summary.lift_ranks.every(r=>Math.abs(r.ratio*100-Math.round(r.ratio*100))<1e-9));
const many=sample(Array.from({length:45},(_,i)=>entry('Barbell Bench Press Variant '+i,50+i)));
assert.equal(api.all(many).length,45);assert.equal(api.summary(many).lift_ranks.length,40);
assert.deepEqual(clone(api.summary({})),{strength_rank:null,lift_ranks:[]});
// SQL source contracts: no PostgreSQL/RLS claim; detect corrupted duplicate functions and insert omissions.
const sql=fs.readFileSync('backend/friends-strength.sql','utf8');
assert.equal((sql.match(/create or replace function public.puls_friends_publish/g)||[]).length,1);
assert.equal((sql.match(/create or replace function public.puls_friends_snapshot/g)||[]).length,1);
assert.equal((sql.match(/\$\$/g)||[]).length,6);assert.match(sql,/begin;[^]*commit;/);
assert.match(sql,/p_xp integer default null,p_strength jsonb default null/);
assert.match(sql,/source_revision,xp,strength_rank,lift_ranks\)/);assert.match(sql,/p_xp,\(p_strength->>'strength_rank'\)::smallint,p_strength->'lift_ranks'\)/);
assert.match(sql,/jsonb_array_length\(value\)>40/);assert.match(sql,/octet_length\(value::text\)>32768/);
assert.match(sql,/rank_value not between 0 and 24/);assert.match(sql,/ratio_value<>round\(ratio_value,2\)/);
assert.match(sql,/where user_id=own_id for share/);assert.match(sql,/profile_revision is distinct from p_source_revision/);
assert.match(sql,/source_revision<=p_source_revision/);assert.match(sql,/source_revision<=excluded.source_revision/);
assert.match(sql,/strength_rank=case when p_strength is null then strength_rank else/);
assert.match(sql,/drop function if exists public.puls_friends_publish\(text,integer,date,boolean,bigint,boolean,integer\)/);
for(const name of ['publish','snapshot'])assert.match(sql,new RegExp('function public.puls_friends_'+name+'[^]*?security definer set search_path=\'\''));
assert(!sql.slice(sql.indexOf("'incoming'")).includes("'lift_ranks'"),'pending recipients never get lifts');
assert(!/alter table public\.puls_profiles|puls_save_profile/.test(sql));
// v90: Isolationen nachkalibriert (Beispiele aus dem Audit, 85 kg), Grundübungen unverändert.
assert.equal(rank('Dumbbell Lateral Raise',12,12,85).name,'Protein Farter III');
assert.equal(rank('Machine Lateral Raise',27,12,85).name,'BPC-157 Considerer II');
assert.equal(rank('Dumbbell Flyes',14,12,85).name,'High Melanin II');
assert.deepEqual([...api.standards.bench.male],[0,.4,.65,.9,1.15,1.4,1.65,1.9,2.2]);
assert.deepEqual([...api.standards.squat.male],[0,.6,.9,1.2,1.5,1.8,2.1,2.5,3]);
assert.deepEqual([...api.standards.legextension.male],[0,.3,.5,.7,.9,1.1,1.3,1.55,1.8]);
console.log('PASS: strength standards, contemporaneous BW, Epley/DB/bodyweight, sex, stages, imported/finished sets, muscle diversity, purity and SQL source contracts.');
