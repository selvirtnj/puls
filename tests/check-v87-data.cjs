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
let haptics=0;c.pulsHaptic=()=>++haptics;
const oldValidator=c.validData;
let writes=0;c.localStorage.setItem=()=>{writes++};
const source=fs.readFileSync('js/puls-data-v87.js','utf8');run(fs.readFileSync('js/strength-ranks.js','utf8'));run(source);
const api=c.window.pulsData87,clone=x=>JSON.parse(JSON.stringify(x));
const old=()=>JSON.parse(run('JSON.stringify(initial())'));
const validate=s=>c.validData(s);
assert.equal(writes,0,'startup must not persist defaults');
let s=old();assert(validate(s));assert(!('water' in s),'validation does not add defaults');
s.waterGoal=1800;api.migrate(s);assert.equal(api.water(s).mode,'manual');assert.equal(s.water.mode,undefined);assert.equal(s.water.glassMl,250);
assert.deepEqual(clone(s.meals),[]);assert.equal(s.plan?.macroInput,undefined);
assert.equal(api.waterTarget(s),1800);const once=JSON.stringify(s);api.migrate(s);assert.equal(JSON.stringify(s),once);
s=old();s.waterGoal=0;api.migrate(s);assert.equal(api.water(s).mode,'auto');assert.equal(s.water.mode,undefined);
s.waterGoal=1950;assert.equal(api.waterTarget(s),1950,'legacy form/native goal set after migration takes precedence');
s.water.mode='auto';assert.equal(api.water(s).mode,'manual');assert.equal(api.waterTarget(s),1950,'manual goal wins even over a stored auto mode');
s.waterGoal=0;assert.equal(api.water(s).mode,'auto');
const item={name:'Fixture',grams:50,unit:'g',kcal:120,p:4,c:20,f:3,nutrients:{fiber:2},source:'Fixture',foodRef:'food-1'};
const optional={water:{mode:'auto',glassMl:400},meals:[{id:'combo-1',name:'Kombi',items:[item]}],
 display:{summaryViews:['week','energy'],showRemaining:true,highlighted:['fiber','iron'],hapticsEnabled:false,motion:'reduced',lastRankSeen:9},
 foodSearch:{sort:'frequent',sources:['own','bls']}};
s={...old(),...clone(optional)};
s.waterGoal=1900;s.displayName='Fixture identity';
run('var plan87=JSON.parse(JSON.stringify(state.plan))');
s.plan={...clone(c.plan87),macroInput:'ratio',ratio:{p:25,c:50,f:25}};
assert(validate(s));assert(oldValidator(s),'older validator accepts the new optional fields too');
const saved=JSON.stringify(s);api.migrate(s);assert.equal(JSON.stringify(s),saved,'valid values and nutrient snapshots remain exact');
assert.equal(api.hapticsEnabled(s),false);assert.equal(api.hapticsEnabled(old()),true);
for(const keepIdentity of [true,false]){
 const clean=c.cleanFitnessState(s,keepIdentity);
 assert.deepEqual(clone(clean.meals),[]);assert(!Object.hasOwn(clean,'waterGoal'));assert.deepEqual(clone(clean.water),{glassMl:400});
 assert(!Object.hasOwn(clean.plan,'macroInput'));assert(!Object.hasOwn(clean.plan,'ratio'));
 assert(!Object.hasOwn(clean.display,'lastRankSeen'));assert.equal(clean.display.hapticsEnabled,false);
 assert.deepEqual(clone(clean.foodSearch),clone(s.foodSearch));assert.equal(clean.displayName,keepIdentity?s.displayName:undefined);assert(validate(clean));
}
// Exercise app.js's actual download path, independent of the reset cleaner.
let exported;const priorURL=c.URL,priorBlob=c.Blob,priorCreate=c.document.createElement;
c.Blob=class{constructor(parts){exported=parts.join('')}};c.URL={createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}};
c.document.createElement=()=>({click(){}});c.exportFixture87=clone(s);run('var beforeExport87=state;state=exportFixture87;exportData();state=beforeExport87');
assert.deepEqual(JSON.parse(exported),clone(s),'JSON export preserves every field and snapshot');
c.URL=priorURL;c.Blob=priorBlob;c.document.createElement=priorCreate;
// Getters work before migration and never change their source or leak references.
const legacy=old(),legacyText=JSON.stringify(legacy);
assert.equal(api.display(legacy).hapticsEnabled,true);assert.equal(api.water(legacy).glassMl,250);
assert.deepEqual(clone(api.meals(legacy)),[]);assert.equal(api.foodSearch(legacy).sort,'best');assert.equal(JSON.stringify(legacy),legacyText);
const read=api.display(s);read.summaryViews.push('micros');assert.deepEqual(clone(s.display.summaryViews),['week','energy']);
api.meals(s)[0].items[0].nutrients.fiber=99;assert.equal(s.meals[0].items[0].nutrients.fiber,2);
run('state.display.hapticsEnabled=false;pulsHaptic("success")');assert.equal(haptics,0);
run('state.display.hapticsEnabled=true;pulsHaptic("success")');assert.equal(haptics,1);
s={...old(),water:'bad',display:false,foodSearch:[],plan:{...clone(c.plan87),macroInput:'wrong',ratio:{p:50,c:50,f:50}}};
assert(validate(s));for(const key of ['water','display','foodSearch'])assert(!Object.hasOwn(s,key));
assert(!Object.hasOwn(s.plan,'macroInput'));assert(!Object.hasOwn(s.plan,'ratio'));
// Shallow probes used by native nutrition/reminders cannot clean live objects,
// whether the full candidate is accepted or rejected.
for(const failure of [null,'weights','nativeExtras']){
 const valid=failure===null;
 const shared={...old(),water:{glassMl:20},display:{motion:'broken'},foodSearch:{sort:'broken'},plan:{...clone(c.plan87),macroInput:'ratio',ratio:{p:100,c:0,f:0}}};
 const before=JSON.stringify(shared),probe={...shared};if(failure==='weights')probe.weights=[{id:'invalid',date:'2026-11-01',kg:10}];
 if(failure==='nativeExtras')probe.nativeExtras={reminders:{training:{enabled:true,time:'25:99',days:[]}}};
 assert.equal(validate(probe),valid);assert.equal(JSON.stringify(shared),before,'shallow validation cannot mutate source subobjects');
 if(!valid)assert.equal(probe.plan,shared.plan,'failed validation does not partially replace fields');
}
s={...old(),display:{hapticsEnabled:'false',motion:'bad',lastRankSeen:27,unknown:'discard',highlighted:['injected'],summaryViews:['week','week']},
 water:{mode:'bad',glassMl:99},foodSearch:{sort:'bad',sources:['fake']},plan:{...clone(c.plan87),macroInput:'ratio'}};
assert(validate(s));assert.deepEqual(clone(s.display),{});assert.deepEqual(clone(s.water),{});assert.deepEqual(clone(s.foodSearch),{});assert(!Object.hasOwn(s.plan,'macroInput'));
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
assert.equal(water({weight:70,age:30},{water:{mode:'auto'},waterGoal:900}).ml,900);
// Strength is independent of XP; old entry points retain independent user levels.
const ranks=api.ranks;assert.equal(ranks.length,9);assert.equal(ranks[0].name,'High Estrogen');assert.equal(ranks[8].name,'Tren Cougher');
for(const xp of [0,250,4000,5000,10000,60000,10000000]){
 assert.equal(api.rankForXp(xp).userLevel,c.xpProgress(xp).level);
 assert.equal(api.rankForXp(xp).index,api.rankForXp(0).index);
}
assert.equal(api.rankForLevel(60).userLevel,60);assert.equal(api.rankForLevel(60).stageLevel,null);
for(const seen of [0,9,24,25,26]){const probe={...old(),display:{lastRankSeen:seen}};assert(validate(probe));assert.equal(probe.display.lastRankSeen,seen)}
for(const file of ['index.html','sw.js'])assert(fs.readFileSync(file,'utf8').includes('js/puls-data-v87.js'));
assert(fs.readFileSync('index.html','utf8').indexOf('js/puls-data-v87.js')>fs.readFileSync('index.html','utf8').indexOf('js/friends.js'));
// Real startup with mixed malformed local combos: preserve all valid snapshots.
const repairedHarness={require,console};vm.runInNewContext(setup+'\nglobalThis.fixture87={ctx,run};',repairedHarness);
const repaired=repairedHarness.fixture87;repaired.ctx.seedMeals87=[clone(optional.meals[0]),{}, {...clone(optional.meals[0]),id:'second-valid'}, {id:'bad',name:'Bad',items:[]}];
repaired.run('state.meals=seedMeals87');let warnings=0,repairWrites=0;
repaired.ctx.console={...console,warn(message){warnings++;assert(!message.includes('Fixture'))}};
repaired.ctx.localStorage.setItem=()=>repairWrites++;repaired.run(source);
assert.deepEqual(JSON.parse(repaired.run('JSON.stringify(state.meals)')),[optional.meals[0],{...optional.meals[0],id:'second-valid'}]);
assert(repaired.run('validData(state)'));assert.equal(warnings,1);assert.equal(repairWrites,0);
console.log('PASS: v87 getters, reset deletion, full export, mutation-safe validation, local combo repair, haptic gate, water modes and XP rank levels.');

async function cloudRoundTrip(){
 // Actual cloud apply/CAS/conflict paths against the existing synthetic transport.
 const base=fs.readFileSync('tests/check-cloud.cjs','utf8'),h={require,console,AbortController,Buffer};
 vm.runInNewContext(base.slice(0,base.indexOf('(async()=>'))+`
 globalThis.fixture87={context,run,disk,getServer:()=>server,setServer:v=>server=v,setConflict:v=>conflict=v};`,h);
 const {context:cc,run:cr,disk,getServer,setServer,setConflict}=h.fixture87;
 let renderChecks=0;
 cc.assertV87Ready=s=>{
  assert.equal(typeof s.display.hapticsEnabled,'boolean');assert(s.water.glassMl>=100&&s.water.glassMl<=1000);
  assert(Array.isArray(s.meals));assert.equal(typeof s.foodSearch.sort,'string');
  renderChecks++;
 };
 // Observe the inner render: defaults must exist before any UI accesses them.
 cr('var innerRender87=render;render=function(...args){assertV87Ready(state);return innerRender87.apply(this,args)}');
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
 // Existing explicit glass sizes survive the pull as well.
 assert.equal(cr('state.meals[0].items[0].grams'),80);assert.equal(cr('state.water.glassMl'),350);
 assert.equal(JSON.parse(disk.get('puls-cloud-conflict-backup')).meals[0].items[0].grams,90);
 assert.equal(cr('cloudConflict'),false);assert.equal(cr('state.plan.ratio.c'),50);
 const corrupt=clone(remote);corrupt.meals[0].items[0].grams=-1;
 assert.throws(()=>cc.applyCloudProfile({payload:corrupt,revision:3}));assert.equal(cr('cloudRejectedRevision'),3);
 assert.equal(cr('state.meals[0].items[0].grams'),80,'rejected remote leaves local state intact');
 const legacyRemote=clone(remote);for(const key of ['display','water','waterGoal','meals','foodSearch'])delete legacyRemote[key];
 delete legacyRemote.plan.macroInput;delete legacyRemote.plan.ratio;
 cc.legacyRemote87=legacyRemote;setConflict(false);
 assert.equal(cr('applyCloudProfile({payload:legacyRemote87,revision:4})'),true);
 assert.equal(cr('state.display.hapticsEnabled'),true);assert.equal(cr('cloudDirty'),false);
 assert.equal(cr('cloudBaseline===JSON.stringify(state)'),true,'pull baseline includes migration before rendering');
 // Dirty pending data for a different owner is restored before rendering and
 // uploaded by the original CAS path, without carrying the previous settings.
 const pending=clone(legacyRemote);pending.meals=[clone(optional.meals[0])];
 cr('cloudSession=null;state.display.hapticsEnabled=false');
 disk.set('puls-cloud-meta-fixture-pending',JSON.stringify({revision:5,dirty:true}));
 disk.set('puls-cloud-pending-fixture-pending',JSON.stringify(pending));
 await cr(`activateCloudSession({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,user:{id:'fixture-pending'}})`);
 assert.equal(cr('state.display.hapticsEnabled'),true);assert.equal(cr('state.meals[0].id'),'combo-1');
 assert.equal(cr('cloudRevision'),6);assert.equal(cr('cloudDirty'),false);
 // Logout restores the previous local profile, whose optional fields can also
 // be absent. No settings from the cloud account may survive that replacement.
 disk.set('puls-cloud-local-before-login',JSON.stringify(legacyRemote));
 cr('state.display.hapticsEnabled=false');await cr('signOutCloud()');
 assert.equal(cr('cloudSession'),null);assert.equal(cr('state.display.hapticsEnabled'),true);assert.equal(cr('state.meals.length'),0);
 assert(renderChecks>=4,'cloud pull, conflict restore, pending login and logout render only after defaults');
 console.log('PASS: v87 cloud CAS/conflict backups, rejected combos, legacy pull, pending login and logout defaults before rendering (mock transport only).');
}
cloudRoundTrip().catch(error=>{console.error(error);process.exitCode=1});
