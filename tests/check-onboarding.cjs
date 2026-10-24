const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
// Reuse the established VM bootstrap, before its mutable regression fixtures.
let bootstrap=fs.readFileSync('tests/check-premium.cjs','utf8').split("run(`state.foods=")[0];
bootstrap=bootstrap.replace('getItem:()=>null','getItem:()=>fixture');
const formDOM=String.raw`
function parseForm(html){
 for(let tag of html.matchAll(/<input\b([^>]*)>/g)){let a=tag[1],id=a.match(/\bid="([^"]*)"/)?.[1];if(!id)continue;let node=el(id);node.value=a.match(/\bvalue="([^"]*)"/)?.[1]||'';node.checked=/\bchecked\b/.test(a);node.required=/\brequired\b/.test(a)}
 for(let tag of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){let node=el(tag[1]);node.options=[...tag[2].matchAll(/<option\b([^>]*)>(.*?)<\/option>/g)].map(x=>({value:x[1].match(/value="([^"]*)"/)?.[1]||'',selected:/\bselected\b/.test(x[1]),textContent:x[2]}));node.value=(node.options.find(x=>x.selected)||node.options[0])?.value||''}
}
function decorate(node){let html=node.innerHTML||'';Object.defineProperty(node,'innerHTML',{get:()=>html,set(value){html=String(value);parseForm(html)}});node.insertAdjacentHTML=(where,value)=>{html=where==='afterbegin'?value+html:html+value;parseForm(value)};node.closest=()=>({set outerHTML(value){parseForm(value)}});node.querySelector=()=>el('submit-button');node.querySelectorAll=()=>[];node.style.removeProperty=()=>{};node.classList={add(){},remove(){},toggle(){}}}
let put=els.set.bind(els);els.set=(id,node)=>{decorate(node);return put(id,node)};for(let node of els.values())decorate(node);
`;
bootstrap=bootstrap.replace("for(let f of ['app.js'",formDOM+"for(let f of ['app.js'");
function app(fixture=null){return vm.runInNewContext('(function(require,fixture){'+bootstrap+String.raw`
run('render=function(){};dismissSheet=function(){};var navSymbols={workout:""};');
ctx.localStorage.removeItem=()=>{};
ctx.document.createElement=()=>({content:{querySelector:()=>null}});
for(let file of ['cloud.js','account-guide.js'])run(fs.readFileSync(file,'utf8'));
return {run,el,saved:()=>storage};
})(require,fixture)`,{require,fixture:fixture&&JSON.stringify(fixture),console},{filename:'onboarding-vm.cjs'})}
const submit='({preventDefault(){}})';
function continueName(test,name=''){test.run('nameProfile()');assert.equal(test.el('profile-name').required,false);test.el('profile-name').value=name;test.run('saveNameProfile('+submit+')');assert.equal(test.el('planner-form').noValidate,true);assert(test.el('planner-form').innerHTML.includes('Alle Angaben sind optional'));assert(!test.el('plan-preview').innerHTML.includes('NaN'))}
function complete(test){test.run('commitProfile('+submit+')');assert.equal(test.run('setupPending'),false);assert.equal(test.run('state.onboardingComplete'),true);assert.equal(test.run('state.setupPending'),false);assert.equal(test.run('page'),'home');assert.equal(test.run('modal.open'),false);assert(test.run('validData(state)'));assert(!test.run('home()').match(/NaN|undefined/));assert(!test.run('accountPage()').match(/NaN|undefined/));return JSON.parse(test.run('JSON.stringify(state)'))}
function fill(test,fields){for(let [id,value] of Object.entries(fields))test.el(id).value=String(value)}
const profile={age:30,height:180,weight:80,target:75,sex:'male',activity:1.375,method:'mifflin',special:false};
const form={'pr-age':30,'pr-height':180,'pr-weight':80,'pr-target':75,'pr-sex':'male','pr-activity':1.375,'pr-method':'mifflin'};
(async()=>{
 let test=app();continueName(test);let defaults=test.run('JSON.stringify(state.goals)'),plan=test.run('JSON.stringify(state.plan)');let blank=complete(test);assert.equal(blank.displayName,'');assert.equal(blank.profile,null);assert.equal(test.run('JSON.stringify(state.goals)'),defaults);assert.equal(test.run('JSON.stringify(state.plan)'),plan);assert.equal(blank.weights.length,0);assert.equal(app(blank).run('setupPending'),false);
 test=app();continueName(test,'  Testname  ');let named=complete(test);assert.equal(named.displayName,'Testname');assert.equal(named.profile,null);assert.equal(app(named).run('setupPending'),false);
 let oldName={...named};delete oldName.onboardingComplete;delete oldName.setupPending;assert.equal(app(oldName).run('setupPending'),false);
 test=app();continueName(test);fill(test,form);let full=complete(test);assert.equal(full.profile.weight,80);assert.equal(full.plan.mode,'auto');assert.equal(full.weights[0].kg,80);assert.equal(full.profileHistory[0].weight,80);assert.equal(app(full).run('setupPending'),false);
 test=app();continueName(test);fill(test,{'pr-height':180,'pr-weight':80});let partial=complete(test);assert.equal(partial.profile,null);assert.deepEqual(partial.goals,blank.goals);assert.equal(partial.profileHistory.length,0);assert.equal(partial.weights.length,0);
 let existing={...blank,goals:{kcal:2400,p:160,c:260,f:75},setupPending:true,onboardingComplete:false,weights:[{id:'keep-weight',date:'2026-10-01',kg:81}]};test=app(existing);fill(test,{'pr-height':180});let preserved=complete(test);assert.deepEqual(preserved.goals,existing.goals);assert.deepEqual(preserved.weights,existing.weights);
 test=app();continueName(test);fill(test,{'pr-age':12,'manual-kcal':''});let invalid=complete(test);assert.equal(invalid.profile,null);assert.deepEqual(invalid.goals,blank.goals);
 // First-run novalidate must not bypass active automatic macro parameter bounds.
 for(let fields of [{'pl-protein':.5},{'pl-fat':0}]){test=app();continueName(test);fill(test,{...form,...fields});let invalidPlan=complete(test);assert.equal(invalidPlan.profile,null);assert.deepEqual(invalidPlan.goals,blank.goals)}
 // Custom macros ignore inactive g/kg inputs and retain valid persisted parameters.
 test=app();continueName(test);fill(test,{...form,'pl-protein':'','pl-fat':0,'pl-macros':'manual'});let customKcal=test.run('planNumbers(collectProfile(),{...collectPlan(),mode:"auto"}).kcal');fill(test,{'manual-c':(customKcal-blank.goals.p*4-blank.goals.f*9)/4});let customMacros=complete(test);assert.equal(customMacros.profile.weight,80);assert.equal(customMacros.plan.protein,1.8);assert.equal(customMacros.plan.fat,.8);assert.equal(customMacros.goals.p,blank.goals.p);
 // Valid profile inputs whose automatic plan is unsupported also cannot trap first run.
 test=app();continueName(test);fill(test,{...form,'pr-target':90});let unsupported=complete(test);assert.equal(unsupported.profile,null);assert.deepEqual(unsupported.goals,blank.goals);
 // Editing in the account retains its existing blocking validation.
 test=app(full);test.run('settings()');fill(test,{'pr-age':12});let before=test.run('JSON.stringify(state)');test.run('commitProfile('+submit+')');assert.equal(test.run('JSON.stringify(state)'),before);assert(test.el('plan-error').textContent);assert.equal(test.run('modal.open'),true);
 for(let tutorialVersion of [undefined,0,1]){
  let old={...full,profile:{...profile},tutorialVersion};delete old.onboardingComplete;delete old.setupPending;test=app(old);assert.equal(test.run('setupPending'),false);assert(test.run('validData(state)'));assert.equal(test.run('typeof startPulsTour'),'undefined');assert.equal(test.run('state.tutorialVersion'),tutorialVersion);
  let preserved=test.run('JSON.stringify(state)');await test.run('importData')({size:100,text:async()=>JSON.stringify(old)});assert(test.run('validData(state)'));assert.equal(test.run('setupPending'),false);assert.equal(test.run('JSON.stringify(state)'),preserved);
 }
 // A completed blank backup must release a currently active first-run modal.
 test=app();continueName(test);await test.run('importData')({size:100,text:async()=>JSON.stringify(blank)});assert.equal(test.run('setupPending'),false);assert.equal(test.run('modal.open'),false);assert.equal(test.run('state.profile'),null);
 test=app();continueName(test);await test.run('importData')({size:100,text:async()=>JSON.stringify(full)});assert.equal(test.run('setupPending'),false);assert.equal(test.run('state.profile.weight'),80);
 let bad={...full,profile:{age:30}};before=test.run('JSON.stringify(state)');await test.run('importData')({size:100,text:async()=>JSON.stringify(bad)});assert.equal(test.run('JSON.stringify(state)'),before);
 test=app({...blank,displayName:'   '});assert(test.run('workoutIdentity()').includes('>P</span>'));assert(test.run('accountPage()').includes('Nutzername wählen'));
 for(let key of ['setupPending','onboardingComplete']){test.run('state.'+key+'="invalid"');assert(!test.run('validData(state)'));test.run('state.'+key+'=false')}
 console.log('PASS: optional first run, reload, complete/incomplete/invalid profiles, unchanged goals, account validation, old tutorial flags and backup import');
})().catch(error=>{console.error(error);process.exitCode=1});
