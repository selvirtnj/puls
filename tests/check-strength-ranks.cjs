const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={state:{},today:()=>'2026-11-09',exerciseCatalog:[]};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/strength-ranks.js','utf8'),ctx);
const api=ctx.pulsStrength,clone=x=>JSON.parse(JSON.stringify(x));
const entry=(name,kg,reps=1,id=name)=>({exerciseId:id,name,sets:[{kg,reps,done:true}]});
const sample=(exercises,bw=100)=>({profile:bw?{weight:bw}:undefined,workouts:[{id:'import-id',finished:true,importSource:'workout-csv',date:'2026-11-08',exercises}]});
const rank=(name,kg,reps=1,bw=100)=>api.all(sample([entry(name,kg,reps)],bw))[0];
// v94: 18 groups, 40 stages (scale 2), names in product order.
assert.deepEqual(clone(api.ranks.map(r=>r.name)),['Gym Tourist','High Estrogen','Low Estrogen','Low Melanin','High Melanin','Pre-Workout Itcher','Creatine Bloater','Protein Farter','Test Booster Believer','BPC-157 Considerer','Blast & Cruiser','Batman Cycle','Superman Cycle','Tren Cougher','Insulin Gambler','HGH Gut','Open Class Monster','Mr. Olympia']);
assert.equal(api.scale,2);assert.equal(api.maxRankIndex,39);assert.deepEqual([...api.ranks.at(-1).stages],[39]);
assert.equal(new Set(api.ranks.map(r=>r.key)).size,18);assert.equal(api.ranks[10].key,'blast-cruiser');
for(const standard of Object.values(api.standards))for(const sex of ['male','female']){
 assert.equal(standard[sex].length,18);assert(standard[sex].every((n,i,a)=>i===0||n>a[i-1]));
}
assert.equal(rank('Barbell Bench Press',200,1,70).index,17);
assert(rank('Barbell Bench Press',200,1,200).index<17,'same weight at higher BW ranks lower');
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
for(const name of ['Assistierter Klimmzug','Klimmzug assistiert','Gravitron Klimmzug','Negativ Klimmzug','Negative Pull-Up','Eccentric Pull-Up','Negative Chin-Up','Eccentric Dips','Negative Dips','Negativ Dipmaschine','Australian Pull-Up','Inverted Pull-Up','Assistierte Dips','Assisted Dip Machine','Assistierte Dipmaschine','Pull-Up Machine','Klimmzug Maschine','Chin-Up Machine','Banded Squat','Squat with Bands']){
 assert.equal(api.classify({name}),null,name);
 const s=sample([entry(name,30,8)],80),saved=JSON.stringify(s);
 assert.equal(api.all(s).length,0,name);
 assert.equal(api.summary(s).strength_rank,null,name);
 assert.equal(JSON.stringify(s),saved,'excluded history remains unchanged');
}
for(const name of ['Pull-Up','Chin-Up','Klimmzug'])assert.equal(api.classify({name,equipment:'Machine'}),null,'equipment also excludes machine pull-ups');
for(const name of ['Negativ-Bankdrücken','Negativbankdrücken','Negative Bench Press','Decline Bench Press']){
 assert.equal(api.classify({name}).type,'bench',name);
 assert.equal(rank(name,100).e1rm,100,name);
}
for(const ex of [{name:'Dip Machine'},{name:'Dipmaschine'},{name:'Seated Dip Machine'},{name:'Dips',equipment:'Machine'}]){
 const model=api.classify(ex);assert.equal(model.type,'triceps',ex.name);assert.equal(model.bodyweight,false);
 const s=sample([entry(ex.name,30,8)]);s.exerciseBook=[{id:ex.name,...ex}];
 assert.equal(api.all(s)[0].e1rm,30*(1+8/30),'machine dips use recorded load without bodyweight');
}
assert.equal(api.classify({name:'Squat',equipment:'Bands'}),null);
assert.equal(rank('Weighted Pull-Up',30,8,80).e1rm,110*(1+8/30),'free pull-ups still add explicitly recorded extra load');
assert.equal(rank('Weighted Dips',30,8,80).e1rm,110*(1+8/30));
assert.equal(rank('Jump Squat',20),undefined);assert.equal(rank('Unknown Specialty Lift',20),undefined);
assert.equal(rank('Calf Press On The Leg Press Machine',100),undefined);
assert.equal(api.all(sample([entry('Barbell Bench Press',100)],null)).length,0);
assert.equal(api.overall(sample([entry('Barbell Bench Press',100)],null)).name,'Rang unbekannt');
for(const reps of [0,13,1.5,'',null])assert.equal(rank('Barbell Bench Press',100,reps),undefined);
for(const kg of ['',null,true,'   '])assert.equal(rank('Pullups',kg),undefined,'missing external load is not invented zero');
const history=sample([entry('Barbell Bench Press',100)]);history.weights=[{date:'2026-11-07',kg:80},{date:'2026-11-09',kg:50}];
assert.equal(api.all(history)[0].bodyweight,80,'future measurement excluded');
history.weights=[{date:'2026-11-09',kg:50}];assert.equal(api.all(history)[0].bodyweight,100,'profile fallback');
delete history.profile;
history.weights=[{date:'2026-11-11',kg:90},{date:'2026-11-10',kg:80},{date:'2026-11-10',kg:82},{date:'2026-11-09',kg:19},{date:'2026-11-09',kg:'75'}];
const fallbackBefore=JSON.stringify(history);
assert.equal(api.all(history)[0].bodyweight,82,'earliest valid measurement, last entry on ties, unlocks older imports');
assert.notEqual(api.overall(history).rankIndex,null);
assert.equal(JSON.stringify(history),fallbackBefore,'fallback never writes historical measurements or a profile');
history.weights.push({date:'2026-11-08',kg:85});
assert.equal(api.all(history)[0].bodyweight,85,'contemporaneous measurement retains priority');
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
 assert(Number.isInteger(payload.strength_rank)&&payload.strength_rank>=0&&payload.strength_rank<=39);
 assert.deepEqual(Object.keys(payload).sort(),['lift_ranks','rank_scale','strength_rank']);assert.equal(payload.rank_scale,2);
 assert(payload.lift_ranks.length>=1&&payload.lift_ranks.length<=40);
 for(const lift of payload.lift_ranks){
  assert.deepEqual(Object.keys(lift).sort(),['key','name','rankIndex','ratio']);
  assert.match(lift.key,/^[a-z0-9-]{1,180}$/);assert(lift.name.trim().length>=1&&[...lift.name].length<=120);
  assert(Number.isInteger(lift.rankIndex)&&lift.rankIndex>=0&&lift.rankIndex<=39);
  assert(lift.ratio>0&&lift.ratio<=1000&&Math.abs(lift.ratio*100-Math.round(lift.ratio*100))<1e-9);
 }
}
multi.workouts[0].exercises.push(entry('Dumbbell Bench Press',30));assert.equal(api.overall(multi).score,overall.score,'only best per group counts');
multi.workouts[0].exercises.push(entry('Barbell Deadlift',200),entry('Barbell Curl',50),entry('Triceps Pushdown',60));
assert.equal(api.overall(multi).exercises.length,5);
assert.deepEqual(clone(api.ranks.flatMap(r=>r.stages)),Array.from({length:40},(_,i)=>i));
assert.deepEqual(clone(api.ranks.map(r=>r.stages.length)),[3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,1]);
for(const g of api.ranks)for(const [j,i] of g.stages.entries()){
 const r=api.rankAt(i);assert.equal(r.rankIndex,i);assert.equal(r.stage,j+1);assert.equal(r.index,g.index);
 assert.equal(r.name,g.name+(g.stages.length===1?'':' '+['I','II','III'][j]));
 if(i<39)assert.equal(r.nextName,api.rankAt(i+1).name);
}
assert.equal(api.rankAt(39).nextAt,null);assert.equal(api.rankAt(39).name,'Mr. Olympia');
assert.equal(api.rankAt(38).nextName,'Mr. Olympia');assert.equal(api.rankAt(99).rankIndex,39);
assert.equal(api.rankAt(0).name,'Gym Tourist I');
const edge=rank('Barbell Bench Press',api.standards.bench.male[2]*100);
assert.equal(edge.name,'Low Estrogen I');assert.equal(edge.progress,0);
// Legacy stage mapping (scale 1 -> 2): same strength boundary, monotonic, round-trip via toLegacy.
assert.deepEqual(Array.from({length:25},(_,i)=>api.fromLegacy(i)),[0,2,4,6,7,8,9,10,11,12,14,16,18,20,22,24,26,28,30,32,34,36,37,38,39]);
for(let i=0;i<=24;i++)assert.equal(api.toLegacy(api.fromLegacy(i)),i);
for(let n=0;n<=39;n++){const i=api.toLegacy(n);assert(api.fromLegacy(i)<=n&&(i===24||api.fromLegacy(i+1)>n),'stage '+n)}
for(const bad of [-1,25,26,1.5,null,'3'])assert.equal(api.fromLegacy(bad),null);
for(const bad of [-1,40,2.5,null])assert.equal(api.toLegacy(bad),null);
// Legacy conversion retains the exact v93 numeric contract after the name redistribution.
assert.equal(api.rankAt(api.fromLegacy(24)).name,'Mr. Olympia');
const skip=sample([entry('Barbell Bench Press',300)]);skip.workouts[0].finished=false;assert.equal(api.all(skip).length,0);
skip.workouts[0].finished=true;skip.workouts[0].exercises[0].sets[0].done=false;assert.equal(api.all(skip).length,0);
const summary=api.summary(multi);assert.equal(summary.strength_rank,api.overall(multi).rankIndex);assert(summary.lift_ranks.every(r=>Math.abs(r.ratio*100-Math.round(r.ratio*100))<1e-9));
const many=sample(Array.from({length:45},(_,i)=>entry('Barbell Bench Press Variant '+i,50+i)));
assert.equal(api.all(many).length,45);assert.equal(api.summary(many).lift_ranks.length,40);
assert.deepEqual(clone(api.summary({})),{strength_rank:null,lift_ranks:[],rank_scale:2});
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
// Synthetic cohorts, independent of private histories. Ratios are e1RM/BW.
for(const [label,ratios,lo,hi] of [
 ['beginner',[.3,.45,.3],0,6],['hobby',[1.2,1.55,.97],18,21],
 ['advanced',[1.6,2.05,1.3],26,28],['elite',[2,2.6,1.65],34,36],
 ['exceptional',[2.4,3.1,2],39,39]
]){
 const source=sample(['Barbell Bench Press','Barbell Squat','Barbell Row'].map((name,i)=>entry(name,ratios[i]*100)));
 const saved=JSON.stringify(source),r=api.overall(source);
 assert(r.rankIndex>=lo&&r.rankIndex<=hi,label+' stage '+r.rankIndex);
 assert.equal(JSON.stringify(source),saved);
}
for(const name of ['Machine Chest Press','Cable Chest Press','Smith Machine Bench Press','Leg Press','Machine Lateral Raise','Triceps Pushdown']){
 const r=rank(name,1000);assert.equal(r.rankIndex,22,name);assert.equal(r.nextRatio,null);
 const s=sample([entry(name,1000)]);assert.equal(api.overall(s).nextLift,null,'no unreachable kg target');
}
assert.equal(api.classify({name:'Cable Hammer Curl'}).loadFactor,1);
assert.equal(api.classify({name:'Rope Hammer Curl'}).loadFactor,1);
assert.equal(api.classify({name:'Hammer Curl'}).loadFactor,2);
assert.equal(rank('Barbell Bench Press',240).rankIndex,39,'free weights can reach the top');
assert(rank('Barbell Bench Press',240).score>rank('Barbell Bench Press',160).score);
// Threshold inversion and continuity at every group/stage boundary, both sexes.
for(const sex of ['male','female'])for(const [i,g] of api.ranks.entries()){
 if(i===0)continue; // Zero external load is unranked for barbell movements.
 const s=sample([entry('Barbell Bench Press',api.standards.bench[sex][i]*100)]);s.profile.sex=sex;
 assert.equal(api.all(s)[0].rankIndex,g.stages[0]);
}
const sql2=fs.readFileSync('backend/friends-strength-v2.sql','utf8');
assert.match(sql2,/^begin;$/m);assert.match(sql2,/^commit;$/m);
assert.equal((sql2.match(/create or replace function public\.puls_friends_publish\(/g)||[]).length,1);
assert.equal((sql2.match(/create or replace function public\.puls_friends_snapshot\(/g)||[]).length,1);
assert.equal((sql2.match(/create or replace function public\.puls_valid_lift_ranks\(value jsonb,max_rank integer\)/g)||[]).length,1);
assert.match(sql2,/drop function if exists public\.puls_valid_lift_ranks\(jsonb\);/,'old one-argument validator removed, no overload');
assert(sql2.indexOf('drop constraint if exists puls_friend_profiles_lift_ranks_check')<sql2.indexOf('drop function if exists public.puls_valid_lift_ranks(jsonb)'),'constraint dropped before its function');
assert.match(sql2,/add column if not exists rank_scale smallint/);
assert.match(sql2,/check \(rank_scale is null or rank_scale=2\)/);
assert.match(sql2,/check \(strength_rank between 0 and case when rank_scale=2 then 39 else 24 end\)/);
assert.match(sql2,/puls_valid_lift_ranks\(lift_ranks,case when rank_scale=2 then 39 else 24 end\)/);
assert.match(sql2,/rank_value not between 0 and max_rank/);assert.match(sql2,/max_rank not in \(24,39\)/);
assert.match(sql2,/p_xp integer default null,p_strength jsonb default null\)/);
assert.match(sql2,/drop function if exists public\.puls_friends_publish\(text,integer,date,boolean,bigint,boolean,integer\);/);
// PL/pgSQL ends an IF condition at the first THEN, so a CASE inside it must be parenthesized.
assert.match(sql2,/<>\(case when p_strength \? 'rank_scale' then 3 else 2 end\)/);
assert.match(sql2,/\(p_strength->>'rank_scale'\)::numeric<>2/);assert.match(sql2,/scale_value := 2; max_rank := 39;/);
assert.match(sql2,/rank_scale=case when p_strength is null then rank_scale else scale_value end/);
assert.match(sql2,/rank_scale=case when p_strength is null then public\.puls_friend_profiles\.rank_scale else excluded\.rank_scale end/);
assert.match(sql2,/strength_rank,lift_ranks,rank_scale\)/);assert.match(sql2,/p_strength->'lift_ranks',scale_value\)/);
assert.match(sql2,/where user_id=own_id for share/);assert.match(sql2,/profile_revision is distinct from p_source_revision/);
assert.match(sql2,/source_revision<=p_source_revision/);assert.match(sql2,/source_revision<=excluded\.source_revision/);
for(const name of ['publish','snapshot'])assert.match(sql2,new RegExp('function public.puls_friends_'+name+'[^]*?security definer set search_path=\'\''));
assert.match(sql2,/function public\.puls_valid_lift_ranks[^]*?immutable set search_path=''/);
assert.match(sql2,/'lift_ranks',p\.lift_ranks,'rank_scale',p\.rank_scale\) into result/);
assert.match(sql2,/'lift_ranks',p\.lift_ranks,'rank_scale',p\.rank_scale,'streak'/);
assert(!sql2.slice(sql2.indexOf("'incoming'")).includes("'lift_ranks'")&&!sql2.slice(sql2.indexOf("'incoming'")).includes("'rank_scale'"),'pending recipients never get lifts');
assert.match(sql2,/enable row level security/);assert.match(sql2,/revoke all on public\.puls_friend_profiles from public,anon,authenticated/);
assert.match(sql2,/revoke all on function public\.puls_valid_lift_ranks\(jsonb,integer\) from public,anon,authenticated/);
assert.match(sql2,/grant execute on function public\.puls_friends_publish\(text,integer,date,boolean,bigint,boolean,integer,jsonb\),public\.puls_friends_snapshot\(\) to authenticated/);
assert(!/alter table public\.puls_profiles|puls_save_profile|service_role/.test(sql2));
assert.equal((sql2.match(/\$\$/g)||[]).length,6);
console.log('PASS: strength standards, contemporaneous BW, Epley/DB/bodyweight, sex, stages, imported/finished sets, muscle diversity, purity and SQL source contracts.');
