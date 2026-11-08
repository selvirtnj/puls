const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Reuse only the established synthetic VM setup (no premium test execution).
const premium=fs.readFileSync('tests/check-premium.cjs','utf8');
const setup=premium.slice(0,premium.indexOf('run(`state.foods='));
const harness={require,console};
vm.runInNewContext(setup+'\nglobalThis.fixture87={ctx,run};',harness,{filename:'v87-fixture.cjs'});
const {ctx:c,run}=harness.fixture87;
// Actual account reset cleaner and actual XP implementation, without UI wrappers.
run(fs.readFileSync('js/account-guide.js','utf8').split('\n').find(line=>line.startsWith('function cleanFitnessState(')));
run(fs.readFileSync('js/workout-polish.js','utf8').split('\n').find(line=>line.startsWith('function xpProgress(')));
run(fs.readFileSync('js/native-extras.js','utf8'));
const oldValidator=c.validData;
let writes=0;c.localStorage.setItem=()=>{writes++};
const source=fs.readFileSync('js/puls-data-v87.js','utf8');run(source);
const api=c.window.pulsData87,clone=x=>JSON.parse(JSON.stringify(x));
const old=()=>JSON.parse(run('JSON.stringify(initial())'));
const validate=s=>c.validData(s);
assert.equal(writes,0,'startup must not persist defaults');
let s=old();assert(validate(s));assert(!('water' in s),'validation does not add defaults');
s.waterGoal=1800;api.migrate(s);assert.equal(s.water.mode,'manual');assert.equal(s.water.glassMl,250);
assert.deepEqual(clone(s.meals),[]);assert.equal(s.plan?.macroInput,undefined);
assert.equal(api.waterTarget(s),1800);const once=JSON.stringify(s);api.migrate(s);assert.equal(JSON.stringify(s),once);
s=old();s.waterGoal=0;api.migrate(s);assert.equal(s.water.mode,'auto');
const item={name:'Fixture',grams:50,unit:'g',kcal:120,p:4,c:20,f:3,nutrients:{fiber:2},source:'Fixture',foodRef:'food-1'};
const optional={water:{mode:'auto',glassMl:400},meals:[{id:'combo-1',name:'Kombi',items:[item]}],
 display:{summaryViews:['week','energy'],showRemaining:true,highlighted:['fiber','iron'],hapticsEnabled:false,motion:'reduced',lastRankSeen:9},
 foodSearch:{sort:'frequent',sources:['own','bls']}};
s={...old(),...clone(optional)};
run('var plan87=JSON.parse(JSON.stringify(state.plan))');
s.plan={...clone(c.plan87),macroInput:'ratio',ratio:{p:25,c:50,f:25}};
assert(validate(s));assert(oldValidator(s),'older validator accepts the new optional fields too');
const saved=JSON.stringify(s);api.migrate(s);assert.equal(JSON.stringify(s),saved,'valid values and nutrient snapshots remain exact');
assert.equal(api.hapticsEnabled(s),false);assert.equal(api.hapticsEnabled(old()),true);
let clean=c.cleanFitnessState(s);for(const key of [...Object.keys(optional),'waterGoal'])if(s[key]!==undefined)assert.deepEqual(clone(clean[key]),clone(s[key]),key);
assert.equal(clean.plan.macroInput,'ratio');assert.deepEqual(clone(clean.plan.ratio),{p:25,c:50,f:25});assert(validate(clean));
s={...old(),water:'bad',display:false,foodSearch:[],plan:{...clone(c.plan87),macroInput:'wrong',ratio:{p:50,c:50,f:50}}};
assert(validate(s));for(const key of ['water','display','foodSearch'])assert(!Object.hasOwn(s,key));
assert(!Object.hasOwn(s.plan,'macroInput'));assert(!Object.hasOwn(s.plan,'ratio'));
s={...old(),display:{hapticsEnabled:'false',motion:'bad',lastRankSeen:10,unknown:'discard',highlighted:['injected'],summaryViews:['week','week']},
 water:{mode:'bad',glassMl:99},foodSearch:{sort:'bad',sources:['fake']},plan:{...clone(c.plan87),macroInput:'ratio'}};
assert(validate(s));assert.deepEqual(s.display,{});assert.deepEqual(s.water,{});assert.deepEqual(s.foodSearch,{});assert(!Object.hasOwn(s.plan,'macroInput'));
for(const bad of [null,{},[{}],[{id:'bad',name:'Bad',items:[]}],
 [{id:'bad',name:'Bad',items:[{...item,grams:0}]}],[{id:'bad',name:'Bad',items:[{...item,unit:'kg'}]}],
 [{id:'bad',name:'Bad',items:[{...item,p:NaN}]}],[{id:'bad',name:'Bad',items:[{...item,nutrients:{fiber:-1}}]}],
 Array.from({length:201},()=>({id:'combo',name:'Bad',items:[item]}))])assert(!validate({...old(),meals:bad}));
// Core corruption must still fail. No new defaults can make bad health data valid.
s=old();s.weights=[{id:'historic',date:'2026-11-01',kg:10}];assert(!validate(s));
run('var migration87=JSON.parse(JSON.stringify(state));delete state.water;delete state.display;delete state.meals;delete state.foodSearch;migrate()');
assert.equal(run('state.water.glassMl'),250);assert.equal(writes,0,'migration must not save');
// Formula fixtures: total water, never gram/ml conversion or inferred food water.
const day='2026-11-08',water=(profile={},extra={})=>api.waterRecommendation({profile,weights:[],workouts:[],runs:[],water:{mode:'auto'},...extra},day);
assert.equal(water().ml,2000);assert.equal(water().mode,'standard');
assert.equal(water({weight:70,age:30}).ml,2150);assert.equal(water({weight:70,age:51}).ml,1800);
assert.equal(water({weight:30,age:51}).ml,1500);assert.equal(water({weight:200,age:30}).ml,5000);
assert.equal(water({weight:70,age:30},{runs:[{date:day,durationSeconds:36000}]}).sportMl,1500);
assert.equal(water({weight:70,age:30},{runs:[{date:day,durationSeconds:3600}]}).ml,2650);
assert.equal(water({weight:70,age:30},{runs:[{date:'2026-11-07',durationSeconds:3600}]}).sportMl,0);
const start=+new Date(day+'T10:00:00'),workout={id:'stable-workout',finished:true,date:day,startedAt:start,finishedAt:start+3600000,durationSeconds:3600};
assert.equal(water({weight:70,age:30},{workouts:[workout]}).sportMl,500);
for(const override of [{finished:false},{autoFinished:true},{timeApprox:true},{startedAt:undefined},{finishedAt:start-1}])
 assert.equal(water({weight:70,age:30},{workouts:[{...workout,...override}]}).sportMl,0);
assert.equal(water({weight:70,age:30},{weights:[{date:'2026-11-07',kg:80},{date:'2026-11-09',kg:100}]}).weightKg,80);
assert.equal(water({weight:70,age:30},{water:{mode:'manual'},waterGoal:900}).ml,900,'manual always wins, even outside auto clamp');
// Every stage against xpProgress, including the XP immediately before it.
const ranks=api.ranks;assert.equal(ranks.length,10);assert.equal(ranks[0].name,'High Estrogen');assert.equal(ranks[9].name,'Tren Cougher');
for(const rank of ranks)for(let i=0;i<rank.levels.length;i++){
 const level=rank.levels[i],xp=rank.xp[i];assert.equal(c.xpProgress(xp).level,level);
 const at=api.rankForXp(xp);assert.equal(at.index,rank.index);assert.equal(at.stage,i+1);assert.equal(at.progress,xp===ranks[9].xp[0]?1:0);
 assert.deepEqual(at,api.rankForLevel(level));if(xp>0)assert.equal(c.xpProgress(xp-1).level,level-1);
 if(at.nextAt!==null){assert(api.rankForXp(at.nextAt-1).progress<1);assert.notEqual(api.rankForXp(at.nextAt).name,at.name)}
}
assert.equal(api.rankForXp(0).name,'High Estrogen I');assert.equal(api.rankForXp(250).name,'High Estrogen II');
assert.equal(api.rankForXp(Infinity).name,'High Estrogen I');assert.equal(api.rankForXp(10000000).name,'Tren Cougher');
assert.equal(api.rankForXp(10000000).nextAt,null);
for(const file of ['index.html','sw.js'])assert(fs.readFileSync(file,'utf8').includes('js/puls-data-v87.js'));
assert(fs.readFileSync('index.html','utf8').indexOf('js/puls-data-v87.js')>fs.readFileSync('index.html','utf8').indexOf('js/friends.js'));
console.log('PASS: v87 optional data, legacy migration without save, backup/reset preservation, invalid combos, total-water formula and every XP rank threshold.');

async function cloudRoundTrip(){
 // Actual cloud apply/CAS/conflict paths against the existing synthetic transport.
 const base=fs.readFileSync('tests/check-cloud.cjs','utf8'),h={require,console,AbortController,Buffer};
 vm.runInNewContext(base.slice(0,base.indexOf('(async()=>'))+`
 globalThis.fixture87={context,run,disk,getServer:()=>server,setServer:v=>server=v,setConflict:v=>conflict=v};`,h);
 const {context:cc,run:cr,disk,getServer,setServer,setConflict}=h.fixture87;
 const before=[...disk.entries()];cr(source);assert.deepEqual([...disk.entries()],before,'data startup leaves cloud storage intact');
 assert.equal(cr('cloudDirty'),false);assert.equal(cr('cloudRevision'),0);
 cr(`cloudSession={access_token:'synthetic-test-access',refresh_token:'synthetic-test-refresh',expires_at:Date.now()/1000+3600,user:{id:'fixture-87'}};
 state.meals=[{id:'combo-stable',name:'Fixture',items:[{name:'Known snapshot',grams:75,unit:'ml',kcal:40,p:1,c:5,f:2,nutrients:{water:60}}]}];
 state.water={mode:'manual',glassMl:350};state.waterGoal=2100;state.display.hapticsEnabled=false;
 state.plan.macroInput='ratio';state.plan.ratio={p:25,c:50,f:25};cloudDirty=true;`);
 await cr('syncCloud()');assert.equal(cr('cloudRevision'),1);
 assert.equal(getServer().payload.meals[0].id,'combo-stable');assert.equal(getServer().payload.meals[0].items[0].nutrients.water,60);
 assert.equal(getServer().payload.display.hapticsEnabled,false);
 // Local offline changes survive a revision conflict and remain in the backup
 // after the user chooses the remote copy; no invented/converted quantities.
 cr("state.meals[0].items[0].grams=90;state.foodSearch.sort='recent';save()");
 assert.equal(cr('cloudDirty'),true);setConflict(true);await cr('syncCloud()');
 assert.equal(cr('cloudConflict'),true);assert.equal(cr('state.meals[0].items[0].grams'),90);
 const remote=clone(getServer().payload);remote.meals[0].items[0].grams=80;
 setServer({payload:remote,revision:2});await cr("resolveCloudConflict('remote')");
 assert.equal(cr('state.meals[0].items[0].grams'),80);assert.equal(cr('state.water.glassMl'),350);
 assert.equal(JSON.parse(disk.get('puls-cloud-conflict-backup')).meals[0].items[0].grams,90);
 assert.equal(cr('cloudConflict'),false);assert.equal(cr('state.plan.ratio.c'),50);
 const corrupt=clone(remote);corrupt.meals[0].items[0].grams=-1;
 assert.throws(()=>cc.applyCloudProfile({payload:corrupt,revision:3}));assert.equal(cr('cloudRejectedRevision'),3);
 assert.equal(cr('state.meals[0].items[0].grams'),80,'rejected remote leaves local state intact');
 console.log('PASS: v87 real cloud-wrapper CAS upload, local conflict retention, separate backup, remote restoration and malformed-combo rejection (mock transport only).');
}
cloudRoundTrip().catch(error=>{console.error(error);process.exitCode=1});
