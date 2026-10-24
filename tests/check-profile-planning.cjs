const fsPlan=require('node:fs'),vmPlan=require('node:vm');
// Use the first-run harness's parsed form controls, without executing its fixtures.
let harnessPlan=fsPlan.readFileSync('tests/check-onboarding.cjs','utf8').split('(async()=>{')[0];
harnessPlan=harnessPlan.replace('var navSymbols={workout:""};','');
harnessPlan=harnessPlan.replace("for(let file of ['js/cloud.js','js/account-guide.js'])",String.raw`
el('workout-dock').remove=()=>{};el('workout-dock').querySelector=()=>null;el('session-root').querySelector=()=>null;
ctx.document.body.classList.toggle=()=>{};
for(let file of ['js/interactions.js','js/polish.js','js/compact.js','js/lifecycle.js','js/workout-polish.js','js/comfort.js','js/tracker-tools.js','js/nutrition-input.js','js/adaptation.js'])run(fs.readFileSync(file,'utf8'));
for(let file of ['js/cloud.js','js/account-guide.js'])`);
const casesPlan=String.raw`
const profilePlan={...profile,rmr:1650.5},autoPlan={mode:'auto',direction:'lose',pace:'medium',macroMode:'auto',protein:1.8,fat:.8,adaptive:true,learnTdee:false};
function seeded(p=profilePlan,pl=autoPlan){let test=app();test.run('state.onboardingComplete=true;state.setupPending=false;setupPending=false;state.profile='+JSON.stringify(p)+';state.plan='+JSON.stringify(pl)+';state.weights=[];state.goalHistory=[];state.profileHistory=[];settings()');return test}
function stateJSON(test){return JSON.parse(test.run('JSON.stringify(state)'))}
function assertUnchanged(test){let before=test.run('JSON.stringify(state)');test.run('commitProfile('+submit+')');assert.equal(test.run('JSON.stringify(state)'),before);assert(test.el('plan-error').textContent);assert.equal(test.run('modal.open'),true)}
function savePlan(test){test.run('updatePlanPreview();commitProfile('+submit+')');assert.equal(test.run('modal.open'),false,test.el('plan-error').textContent);assert(test.run('validData(JSON.parse(JSON.stringify(state)))'));return stateJSON(test)}

// Reopen with all saved planning values and the newest real, non-future weight.
let test=seeded(profilePlan,{...autoPlan,pace:'extreme',protein:1.85,fat:.85,adaptive:false,learnTdee:true});
test.run("state.weights=[{id:'old-weight',date:daysBefore(today(),1),kg:81.25},{id:'future-weight',date:daysBefore(today(),-1),kg:90}];settings()");
for(let [id,value] of Object.entries({'pr-age':30,'pr-height':180,'pr-weight':81.25,'pr-target':75,'pr-rmr':1650.5,'pl-protein':1.85,'pl-fat':.85,'pl-pace':'extreme'}))assert.equal(test.el(id).value,String(value));
assert.equal(test.el('pl-adaptive').checked,false);assert.equal(test.el('pl-learn-tdee').checked,true);
assert(test.el('profile-form').innerHTML.includes('step="any"'));
let savedPlan=savePlan(test);assert.equal(savedPlan.weights.length,2);assert.equal(savedPlan.profile.weight,81.25);assert.equal(savedPlan.goalHistory.length,1);assert.equal(savedPlan.profileHistory.length,1);
test=app(savedPlan);test.run('settings()');assert.equal(test.el('pl-pace').value,'extreme');assert.equal(test.el('pl-learn-tdee').checked,true);assert.equal(test.el('pl-adaptive').checked,false);assert.equal(test.el('pr-rmr').value,'1650.5');
fill(test,{'pl-direction':'gain','pr-target':90});test.run('updatePlanPreview()');assert.equal(test.el('pl-pace').value,'high');assert(!test.el('pace-info').textContent.includes('Extreme Weight Loss'));

// Legacy backups stay valid; startup and the hidden form use the personal male profile by coordinator decision.
let legacy=JSON.parse(JSON.stringify(savedPlan));legacy.profile={...profilePlan,sex:'female',special:true};legacy.plan={...autoPlan,mode:'manual'};legacy.goals={kcal:2200,p:150,c:250,f:70};
test=app(legacy);assert(test.run('validData('+JSON.stringify(legacy)+')'));assert.equal(test.run('state.profile.sex'),'male');assert.equal(test.run('state.profile.special'),false);
// Also cover a legacy profile arriving after startup, as with an import or cloud pull.
test.run('state.profile='+JSON.stringify(legacy.profile)+';settings()');assert.equal(test.el('pr-sex').value,'male');assert.equal(test.el('pr-special').checked,false);savedPlan=savePlan(test);assert.equal(savedPlan.profile.sex,'male');assert.equal(savedPlan.profile.special,false);
test.run('settings()');test.el('pl-mode').value='auto';savedPlan=savePlan(test);assert.equal(savedPlan.plan.mode,'auto');

// Profile exclusions, direction, bounds and remaining carbohydrate are checked before any state changes.
for(let fields of [
 {'pr-target':90},{'pl-direction':'gain','pr-target':70},{'pr-age':17},{'pr-weight':NaN},
 {'pl-protein':.5},{'pl-fat':0},{'pl-protein':NaN},{'pr-method':'measured','pr-rmr':499},
 {'pr-method':'measured','pr-rmr':500,'pl-direction':'maintain'},
 {'pr-method':'measured','pr-rmr':1000,'pl-protein':2.2,'pl-fat':1.5},
 {'pr-target':50}
]){test=seeded();fill(test,fields);test.run('updatePlanPreview()');assert(!test.el('plan-preview').innerHTML.match(/NaN|undefined/));assertUnchanged(test)}
test=seeded();test.el('pr-special').checked=true;assertUnchanged(test);

// Maintain ignores target/pace; the formula ignores RMR. Inactive macro parameters never poison backups.
test=seeded();fill(test,{'pl-direction':'maintain','pl-pace':'','pr-target':'','pr-rmr':-50});test.run('updatePlanPreview()');assert.equal(test.el('pr-target').disabled,true);assert.equal(test.el('pl-pace').disabled,true);assert.equal(test.el('pr-rmr').disabled,true);savedPlan=savePlan(test);assert.equal(savedPlan.profile.target,80);assert.equal(savedPlan.plan.pace,'medium');assert.equal(savedPlan.profile.rmr,1650.5);
test=seeded(profilePlan,{...autoPlan,mode:'manual'});fill(test,{'pl-protein':'','pl-fat':-1});test.run('updatePlanPreview()');for(let id of ['pl-protein','pl-fat','pl-direction','pl-pace','pl-macros','pl-adaptive','pl-learn-tdee'])assert.equal(test.el(id).disabled,true,id);savedPlan=savePlan(test);assert.equal(savedPlan.plan.protein,1.8);assert.equal(savedPlan.plan.fat,.8);
test=seeded(profilePlan,{...autoPlan,macroMode:'manual'});let calculated=test.run('planNumbers(state.profile,state.plan).kcal');fill(test,{'pl-protein':'','pl-fat':NaN,'manual-kcal':NaN,'manual-p':100,'manual-f':40,'manual-c':(calculated-760)/4});savedPlan=savePlan(test);assert.equal(savedPlan.plan.protein,1.8);assert.equal(savedPlan.goals.kcal,calculated);
test=seeded(profilePlan,{...autoPlan,macroMode:'manual'});savedPlan=savePlan(test);assert.equal(savedPlan.goals.p,150);assert.equal(savedPlan.goals.c,250);assert.equal(savedPlan.goals.f,70);

// Manual targets can be saved without a profile. Inconsistent new targets are rejected; old backups remain valid.
test=seeded(null,{...autoPlan,mode:'manual'});savedPlan=savePlan(test);assert.equal(savedPlan.profile,null);assert.equal(savedPlan.weights.length,0);assert.equal(savedPlan.goalHistory.length,1);assert.equal(savedPlan.goalHistory[0].weight,undefined);
for(let fields of [{'manual-kcal':1000},{'manual-p':NaN},{'manual-c':-1},{'manual-f':2001}]){test=seeded(null,{...autoPlan,mode:'manual'});fill(test,fields);assertUnchanged(test)}
test=seeded(null,{...autoPlan,mode:'manual'});test.run('state.goals={kcal:2400,p:100,c:100,f:50}');assert(test.run('validData(state)'));

// 4/4/9 checks apply to edited custom macros in either calorie mode; unchanged legacy targets remain editable.
for(let mode of ['manual','auto']){
 test=seeded(profilePlan,{...autoPlan,mode,macroMode:'manual'});test.run('state.goals={kcal:2400,p:100,c:100,f:50};settings()');assert.equal(test.el('plan-error').textContent,'');
 fill(test,{'pr-weight':79});savedPlan=savePlan(test);assert.equal(savedPlan.profile.weight,79);assert.equal(savedPlan.goals.p,100);assert.equal(savedPlan.goals.c,100);assert.equal(savedPlan.goals.f,50);if(mode==='manual')assert.equal(savedPlan.goals.kcal,2400);
 test.run('settings()');fill(test,{'manual-p':101});test.run('updatePlanPreview()');let previewError=test.el('plan-error').textContent;assert.equal(previewError,'Kalorien und Makros passen noch nicht zusammen.');assertUnchanged(test);assert.equal(test.el('plan-error').textContent,previewError);
 test=seeded(profilePlan,{...autoPlan,mode,macroMode:'manual'});test.run('state.goals={kcal:2400,p:100,c:100,f:50};settings()');fill(test,{'pl-mode':mode==='manual'?'auto':'manual'});assertUnchanged(test);
 // The 50 kcal boundary is accepted; a 51 kcal difference is rejected when a macro field changes.
 for(let difference of [50,51]){test=seeded(profilePlan,{...autoPlan,mode,macroMode:'manual'});let kcal=mode==='manual'?2200:test.run('planNumbers(collectProfile(),collectPlan()).kcal');fill(test,{'manual-c':(kcal+difference-150*4-70*9)/4});if(difference===50)savePlan(test);else assertUnchanged(test)}
}
test=seeded(profilePlan,{...autoPlan,macroMode:'auto'});fill(test,{'pl-macros':'manual'});assertUnchanged(test);

// Partly filled manual profiles show the same blocking error in preview and submit, without the no-profile hint.
for(let fields of [{'pr-age':30},{'pr-height':180},{'pr-target':75}]){
 test=seeded(null,{...autoPlan,mode:'manual'});fill(test,fields);test.run('updatePlanPreview()');let previewError=test.el('plan-error').textContent;assert(previewError);assert(!test.el('plan-preview').innerHTML.includes('Manuelle Ziele lassen sich auch ohne Profil speichern.'));assertUnchanged(test);assert.equal(test.el('plan-error').textContent,previewError);
 fill(test,Object.fromEntries(Object.keys(fields).map(id=>[id,''])));test.run('updatePlanPreview()');assert.equal(test.el('plan-error').textContent,'');savePlan(test);
}

// Weight edits update only today's actual measurement, preserving IDs and prior measurements; history is per day.
test=seeded();test.run("state.weights=[{id:'keep-old',date:daysBefore(today(),1),kg:80}];settings()");savedPlan=savePlan(test);assert.equal(savedPlan.weights.length,1);
test.run('settings()');fill(test,{'pr-weight':79});savedPlan=savePlan(test);assert.equal(savedPlan.weights.length,2);let todayID=savedPlan.weights[1].id;assert.equal(savedPlan.weights[0].id,'keep-old');assert.equal(savedPlan.weights[1].kg,79);
test.run('settings()');fill(test,{'pr-weight':78});savedPlan=savePlan(test);assert.equal(savedPlan.weights[1].id,todayID);assert.equal(savedPlan.weights[1].kg,78);assert.equal(savedPlan.goalHistory.length,1);assert.equal(savedPlan.profileHistory.length,1);

// The current form plan controls calibrated energy, including forecast, without mutating persisted state.
test=seeded();test.run("state.tdeeCalibration={date:today(),value:2700,base:formulaEnergyFor(state.profile).tdee,activity:state.profile.activity,windowStart:daysBefore(today(),28),windowEnd:daysBefore(today(),1)};settings()");
let formula=test.run('formulaEnergyFor(state.profile).tdee'),before=test.run('JSON.stringify(state)');
test.el('pl-learn-tdee').checked=true;test.run('updatePlanPreview()');assert.equal(test.run('planNumbers(collectProfile(),collectPlan()).tdee'),2700);assert.equal(test.run('JSON.stringify(state)'),before);
assert(test.el('plan-preview').innerHTML.includes(test.run('forecastMarkup(collectProfile(),planNumbers(collectProfile(),collectPlan()).kcal,collectPlan())')));
test.el('pl-learn-tdee').checked=false;test.run('updatePlanPreview()');assert.equal(test.run('planNumbers(collectProfile(),collectPlan()).tdee'),formula);
test.el('pl-learn-tdee').checked=true;savedPlan=savePlan(test);assert.equal(savedPlan.goals.kcal,Math.round(2700*.85));
test.run('settings()');test.el('pl-learn-tdee').checked=false;savedPlan=savePlan(test);assert.equal(savedPlan.goals.kcal,Math.round(formula*.85));
test.run('settings()');fill(test,{'pr-method':'measured','pr-rmr':1600});test.run('updatePlanPreview()');assert.equal(test.el('pl-learn-tdee').disabled,true);assert.equal(test.run('planNumbers(collectProfile(),collectPlan()).tdee'),2200);savedPlan=savePlan(test);assert.equal(savedPlan.tdeeCalibration,undefined);

// A failed submit must not create/refresh calibration or change local data through outer wrappers.
test=seeded(profilePlan,{...autoPlan,learnTdee:true});test.run("tdeeObservation=function(){return {eligible:true,base:2400,estimate:2600,start:daysBefore(today(),28),end:daysBefore(today(),1)}}");fill(test,{'pr-target':90});assertUnchanged(test);assert.equal(test.run('state.tdeeCalibration'),undefined);
// Changed profile inputs invalidate calibration before render/adaptive goals can reuse it.
test=seeded(profilePlan,{...autoPlan,learnTdee:true});test.run("state.tdeeCalibration={date:today(),value:2700,base:formulaEnergyFor(state.profile).tdee,activity:state.profile.activity,windowStart:daysBefore(today(),28),windowEnd:daysBefore(today(),1)};settings()");fill(test,{'pr-age':31});savedPlan=savePlan(test);assert.equal(savedPlan.tdeeCalibration,undefined);assert.equal(savedPlan.goals.kcal,Math.round(test.run('formulaEnergyFor(state.profile).tdee')*.85));

// Adaptive goals follow the latest weight, retain custom macros and stop at the target; exclusions and invalid outputs stop updates.
test=seeded();test.run("state.weights=[{id:'last',date:today(),kg:74}];adaptiveGoals()");assert.equal(test.run('state.goals.kcal'),Math.round(test.run('energyFor({...state.profile,weight:74}).tdee')));assert.equal(test.run('state.goalHistory[0].weight'),74);
test=seeded(profilePlan,{...autoPlan,macroMode:'manual'});test.run("state.weights=[{id:'last',date:today(),kg:79}];adaptiveGoals()");assert.equal(test.run('state.goals.p'),150);assert.equal(test.run('state.goals.c'),250);assert.equal(test.run('state.goals.f'),70);
for(let change of ["state.plan.adaptive=false","state.profile.special=true","state.profile.target=50","state.profile.method='measured';state.profile.rmr=500","state.plan.protein=NaN"]){test=seeded();test.run(change);before=test.run('JSON.stringify(state.goals)');test.run('adaptiveGoals()');assert.equal(test.run('JSON.stringify(state.goals)'),before)}
test=seeded(profilePlan,{...autoPlan,pace:'extreme'});let extreme=test.run('planNumbers(state.profile,state.plan)');assert(extreme.kcal>=1500);assert(extreme.tdee-extreme.kcal<=Math.min(extreme.tdee*.25,80*.01*7700/7,1000)+.5);
// An extreme plan's 1500 kcal floor must never turn requested weight loss into a calorie surplus.
test=seeded({...profilePlan,age:100,height:160,weight:60,target:50,activity:1.2},{...autoPlan,pace:'extreme'});assertUnchanged(test);before=test.run('JSON.stringify(state.goals)');test.run('adaptiveGoals()');assert.equal(test.run('JSON.stringify(state.goals)'),before);
console.log('PASS: complete profile wrapper chain, conditional validation, legacy round trips, real weight/history preservation, calibration preview/save/failure, adaptive exclusions and target bounds');
`;
vmPlan.runInNewContext(harnessPlan+casesPlan,{require,console,process},{filename:'profile-planning-harness.cjs'});
