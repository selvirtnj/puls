// v87 Plus-Menü und Konto-Übersicht: reine Logik und Markup ohne echtes Layout (VM mit Stubs).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const day='2026-11-09';
const state={language:'de',foods:[],goals:{kcal:2000,p:150,c:200,f:67},plan:{mode:'manual',direction:'lose',pace:'medium',macroMode:'auto',protein:1.8,fat:.8},
 profile:{age:34,sex:'male',height:180,weight:82,target:76},weights:[],display:{summaryViews:['energy','micros','week'],showRemaining:false,highlighted:['fiber','iron'],hapticsEnabled:true,motion:'system'},water:{glassMl:300},soundEnabled:true};
const calls=[],sounds=[];let saves=0,renders=0,dismissed=0;
const modal={open:false,html:'',title:'',close(){modal.open=false},classList:{contains:()=>false,add(){},remove(){},toggle(){}}};
const bodyClasses=new Set();
const c={console,Math,Number,String,Object,Array,Set,Map,JSON,isFinite,state,date:day,page:'account',accountSection:'',trainTab:'current',englishUI:{},
 today:()=>day,n:x=>String(x),esc:x=>String(x).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]),round:x=>Math.round(x*10)/10,
 modal,save(){saves++},toast(m){calls.push('toast:'+m)},pulsSound(k){sounds.push(k)},phIcon:k=>`<i data-icon="${k}"></i>`,
 openModal(title,html){modal.open=true;modal.title=title;modal.html=html},dismissSheet(){dismissed++;modal.open=false},
 document:{body:{classList:{add:k=>bodyClasses.add(k),remove:k=>bodyClasses.delete(k),contains:k=>bodyClasses.has(k)}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],documentElement:{classList:{toggle(){}}},
  createElement:()=>({innerHTML:'',content:{querySelector:()=>null}})},
 window:{scrollY:0,scrollTo(){},pulsData87:null},matchMedia:()=>({matches:false}),
 nutrientLabels:Object.fromEntries(['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium','zinc','sodium'].map(k=>[k,[k.toUpperCase(),'mg']])),
 quickAddActions:[['food'],['barcode'],['camera'],['recipe'],['water'],['weight'],['workout'],['run'],['ruler'],['extra','Extra','Neues Modul','extraAction()']],
 quickAddIcons:{},currentWeight:()=>82,dayGoals:()=>state.goals,accountCloudDetail:()=>'Nur auf diesem Gerät gespeichert',
 accountSections:[{key:'plan'},{key:'body'},{key:'adaptive'},{key:'design'},{key:'sounds'},{key:'manage'}],
 accountListRow:({label,detail='',value='',action='',id='',cls=''})=>`<${action?'button':'div'} class="dsrow ${cls}"${id?` id="${id}"`:''}${action?` onclick="${action}"`:''}>${label}${detail?`<small>${detail}</small>`:''}${value!==''?`<span class="dsrowvalue">${value}</span>`:''}</${action?'button':'div'}>`,
 accountGoalSummary:()=>'<section class="accountgoal"></section>',planTargetDate:()=>'März 2027',profileError:()=>'',forecastDays:()=>90,dateAfter:()=>'7. Feb. 2027',
 energyFor:()=>({rmr:1800,tdee:2600}),planNumbers:()=>({change:-.15,kcal:2000}),recordGoalHistory(){calls.push('history')},
 quickAddRun(){},weightForm(){},measurementsForm(){},recipeEditor(){},foodForm(){calls.push('foodForm')},foodTab(){},fpMealEdit(){calls.push('meal')},fpBackTo(p){calls.push('pane:'+p)},
 // accountPage ist seit Phase 4 eine Funktion: Kern aus flows.js (hier der Stub-Text), darüber das Glied aus quick-account.js.
 accountPage:()=>c.accountPageAfterQuickAccount('<div class="accountcompact accountrefresh accountoverview"></div>'),
 openAccountSection(key){c.accountSection=key;c.render()},closeAccountSection(){c.accountSection='';c.render()},
 // go ist seit Phase 4 eine Funktion: Kern (hier der Stub-Text), davor das Glied aus quick-account.js.
 go(next){c.goBeforeQuickAccount?.(next);c.page=next;c.render()},render(){renders++}};
c.window.pulsData87={display:()=>({...state.display}),water:()=>({mode:'auto',glassMl:state.water.glassMl}),waterRecommendation:()=>({ml:2450,mode:'auto'})};
vm.createContext(c);
vm.runInContext(fs.readFileSync('js/quick-account.js','utf8'),c,{filename:'js/quick-account.js'});
const run=code=>vm.runInContext(code,c);

// Plus-Menü: Kacheln und Liste, keine Sprachnotiz, keine Notiz, kein Fasten; fremde Einträge bleiben.
run('quickAddMenu()');
assert.equal(modal.title,'Schnell hinzufügen');assert(bodyClasses.has('quickaddopen'));assert.equal(sounds.at(-1),'sheetOpen');
for(const key of ['search','barcode','photo','training','weight','ruler','run','meal','recipe','custom','extra'])assert(modal.html.includes(`data-qa-quick="${key}"`),key);
assert(modal.html.includes('class="dsgroup dsactionlist'),'app-polish erkennt das Menü weiter');
assert(!modal.html.includes('data-qa-quick="water"'),'v89: KI-Foto ersetzt Wasser');
assert.deepEqual(Array.from(run('qaQuickTiles().map(x=>x[0])')),['search','barcode','photo','run','training']);
{let tabs=[];c.foodTab=t=>tabs.push(t);c.foodPhotoOpen=()=>tabs.push('ai');run('qaQuickPhoto()');assert.deepEqual(tabs,['photo','ai']);c.foodTab=()=>{};delete c.foodPhotoOpen}
assert.equal(run('qaQuickRows().at(-1)[0]'),'ruler');
assert(!run('qaQuickRows().some(x=>x[0]==="water"||x[0]==="run")'));
c.addWaterGlass=ml=>calls.push('water:'+ml);
run('quickAddMenu()');
assert(!/voice|microphone|Notiz|Fasten|Sprach/i.test(modal.html));
run('quickAddMenu()');assert.equal(dismissed,1,'zweites Tippen schließt das Menü');
run('qaQuickMeal()');assert.deepEqual(calls.slice(-2),['foodForm','meal']);

// Verhältnis: Gramm aus Kalorien, Gültigkeit, Vorbelegung mit Summe 100.
assert.deepEqual({...run('qaGramsFromRatio(2000,{p:30,c:40,f:30})')},{p:150,c:200,f:67});
assert.equal(run('qaRatioValid({p:30,c:40,f:30})'),true);
assert.equal(run('qaRatioValid({p:30,c:40,f:31})'),false);
assert.equal(run('qaRatioValid({p:4,c:66,f:30})'),false);
assert.equal(run('qaRatioValid({p:30.5,c:39.5,f:30})'),false);
for(const g of [{p:150,c:200,f:67},{p:400,c:0,f:0},{p:0,c:0,f:0},{p:10,c:500,f:5}]){const r=run(`qaRatioFromGoals(${JSON.stringify(g)})`);assert.equal(run(`qaRatioValid(${JSON.stringify(r)})`),true,JSON.stringify(g))}

// Verhältnis speichern nur bei eigenen Makros und gültigem Kalorienziel.
let ratioInputs={p:'25',c:'45',f:'30'};c.document.getElementById=id=>/^qa-ratio-[pcf]$/.test(id)?{value:ratioInputs[id.slice(9)]}:null;
assert.equal(run('qaSaveRatio()'),true);
assert.equal(state.plan.macroInput,'ratio');assert.deepEqual({...state.plan.ratio},{p:25,c:45,f:30});assert.deepEqual([state.goals.p,state.goals.c,state.goals.f],[125,225,67]);
ratioInputs={p:'50',c:'50',f:'10'};const before=JSON.stringify(state.goals);assert.equal(run('qaSaveRatio()'),false);assert.equal(JSON.stringify(state.goals),before);
c.document.getElementById=()=>null;

// Echter Planer samt 4/4/9-Prüfung und Commit, kein Commit-Stub (bestehender Formular-Harness).
const plannerHarness=fs.readFileSync('tests/check-onboarding.cjs','utf8').split('(async()=>{')[0];
vm.runInNewContext(plannerHarness+String.raw`
let test=app();
// Persisted formula parameters survive a real save/restart through the bootstrap.
for(const sex of ['female','male']){
 let original=app();
 original.run('state.onboardingComplete=true;state.setupPending=false;state.profile={...'+JSON.stringify(profile)+',sex:'+JSON.stringify(sex)+'};save()');
 let restarted=app(JSON.parse(original.saved()));
 assert.equal(restarted.run('state.profile.sex'),sex);
 assert(restarted.run('validData(state)'));
 restarted.run('save()');
 assert.equal(app(JSON.parse(restarted.saved())).run('state.profile.sex'),sex);
}
// The legacy fallback still normalizes missing/invalid values, preserving the existing special=false normalization.
const startupNormalization=fs.readFileSync('js/experience.js','utf8').split('const priorPlanNumbers')[0];
for(const sex of [undefined,null,'invalid','']){
 let fixture={profile:{sex,special:true},plan:{}};
 vm.runInNewContext(startupNormalization,{state:fixture});
 assert.equal(fixture.profile.sex,'male');assert.equal(fixture.profile.special,false);
}
test.run('state.onboardingComplete=true;state.setupPending=false;setupPending=false;state.profile=null;state.plan={mode:"manual",direction:"lose",pace:"medium",macroMode:"manual",protein:1.8,fat:.8,macroInput:"ratio",ratio:{p:30,c:40,f:30}};state.goals={kcal:2000,p:150,c:200,f:67};page="home"');
test.run(fs.readFileSync('js/quick-account.js','utf8'));
test.run('settings()');fill(test,{'manual-kcal':2400});
assert.equal(test.run('planError(collectProfile(),collectPlan(),collectManual())'),'');
assert.equal(test.run('commitProfile('+submit+')'),true);
assert.deepEqual(JSON.parse(test.run('JSON.stringify(state.goals)')),{kcal:2400,p:180,c:240,f:80});
assert.equal(test.run('state.plan.macroInput'),'ratio');
assert.equal(test.run('state.goalHistory.at(-1).p'),180);
// Unpassende direkte Gramm sperren weiterhin und verändern keine Ziele.
test.run('settings()');fill(test,{'manual-p':300});
let before=test.run('JSON.stringify(state)');
assert.equal(test.run('commitProfile('+submit+')'),false);
assert.equal(test.run('JSON.stringify(state)'),before);
// Ausgeglichene direkte Grammeingabe schaltet zurück auf Gramm.
fill(test,{'manual-p':190,'manual-c':230});
assert.equal(test.run('commitProfile('+submit+')'),true);
assert.equal(test.run('state.plan.macroInput'),'grams');
// Tagesprojektion im echten Baseline-Modus: Sport erhöht kcal, manuelle Gramm bleiben Basiswerte.
test.run('state.profile={...'+JSON.stringify(profile)+',kcalMode:"baseline",baselineFactor:1.2};state.plan.mode="auto";state.plan.direction="maintain";state.plan.macroInput="ratio";dayActivityKcal=()=>400');
assert.equal(test.run('dayGoals().p'),190);
assert.equal(test.run('dayGoals().c'),230);
assert(test.run('dayGoals().kcal')>test.run('state.goals.kcal'));
assert(!test.run('qaMacroEditor()').includes('Grundziel'));
// v92 „Alles eintragen“: gespeichertes Geschlecht ersetzt das versteckte „male“ aus experience.js,
// und die Vorschau wird danach mit genau diesen Werten berechnet (sonst zeigt sie den Männer-Wert).
test.run('state.profile={...'+JSON.stringify(profile)+',sex:"female",special:false,age:30,height:180,weight:80,target:75,activity:1.375,kcalMode:"classic"};state.plan={mode:"auto",direction:"lose",pace:"medium",macroMode:"auto",protein:1.8,fat:.8,adaptive:false};state.weights=[];dayActivityKcal=()=>0');
test.el('pr-sex').type='hidden';test.el('pr-special').hidden=true;
test.run('qaFullSetup()');
assert.equal(test.el('pr-sex').value,'female');
let femaleKcal=test.run('planNumbers(collectProfile(),collectPlan(),collectManual()).kcal');
let maleKcal=test.run('planNumbers({...collectProfile(),sex:"male"},collectPlan(),collectManual()).kcal');
assert.notEqual(femaleKcal,maleKcal);
assert(test.el('plan-preview').innerHTML.includes(test.run('n('+femaleKcal+')')),'Vorschau nutzt das gespeicherte Geschlecht');
assert(!test.el('plan-preview').innerHTML.includes(test.run('n('+maleKcal+')')),'keine veraltete Männer-Vorschau');
assert.equal(test.run('commitProfile('+submit+')'),true);
assert.equal(test.run('state.profile.sex'),'female');
assert.equal(test.run('state.goals.kcal'),femaleKcal);
// Small sheets keep the real collectProfile/planError/commitProfile/save chain.
// Only label movement is simulated here. Browser QA covers actual visibility.
function sheet(key){
 test.run('settings()');
 test.run([
  '  var sheetLabels=new Map();',
  '  for(let key of Object.keys(qaFields)){',
  '   let node=document.getElementById(qaFields[key][0]);',
  '   let label={hidden:false,classList:{remove(){}},querySelectorAll:()=>[]};',
  '   sheetLabels.set(qaFields[key][0],label);node.closest=()=>label;',
  '   node.tagName=key==="method"||key==="direction"?"SELECT":"INPUT";',
  '   node.type=node.tagName==="INPUT"?"number":"";',
  '   node.removeAttribute=()=>{};node.focus=()=>{};',
  '  }',
  '  var sheetFields=document.getElementById("qa-edit-fields");sheetFields.children=[];',
  '  sheetFields.append=label=>sheetFields.children.push(label);sheetFields.after=()=>{};',
  '  document.getElementById("plan-error").setAttribute=()=>{};',
 ].join('\n'));
 test.run('qaMountEditField('+JSON.stringify(key)+')');
}
test.run('state.profile={...'+JSON.stringify(profile)+',target:80};state.plan={mode:"auto",direction:"maintain",pace:"medium",macroMode:"auto",protein:1.8,fat:.8,adaptive:false};state.weights=[]');
sheet('target');
assert.equal(test.el('qa-edit-fields').children.length,2);
fill(test,{'pr-target':75});
let heldBefore=test.run('JSON.stringify(state)');
assert.equal(test.run('qaSubmitEdit('+submit+')'),false,'Halten must not silently discard a different target');
assert.equal(test.run('JSON.stringify(state)'),heldBefore);
assert(test.el('plan-error').textContent);
fill(test,{'pl-direction':'lose'});
assert.equal(test.run('qaSubmitEdit('+submit+')'),true);
assert.equal(test.run('state.profile.target'),75);
assert.equal(test.run('state.plan.direction'),'lose');
assert(test.run('validData(state)'));
// Switching from loss to gain validates both inputs before any state is written.
sheet('target');fill(test,{'pl-direction':'gain','pr-target':75});
let gainBefore=test.run('JSON.stringify(state)');
assert.equal(test.run('qaSubmitEdit('+submit+')'),false);
assert.equal(test.run('JSON.stringify(state)'),gainBefore);
fill(test,{'pr-target':'85,5'});
assert.equal(test.run('qaSubmitEdit('+submit+')'),true);
assert.equal(test.run('state.profile.target'),85.5);
assert.equal(test.run('state.plan.direction'),'gain');
assert(test.run('validData(state)'));
sheet('target');fill(test,{'pl-direction':'maintain','pr-target':80});
assert.equal(test.run('qaSubmitEdit('+submit+')'),true);
assert.equal(test.run('state.profile.target'),80);
// RMR appears as soon as measured is selected, before the first save attempt.
sheet('method');
assert.equal(test.run('sheetLabels.get("pr-rmr").hidden'),true);
fill(test,{'pr-method':'measured','pr-rmr':''});test.run('qaEditPreview()');
assert.equal(test.run('sheetLabels.get("pr-rmr").hidden'),false);
assert.equal(test.el('pr-rmr').disabled,false);
let rmrBefore=test.run('JSON.stringify(state)');
assert.equal(test.run('qaSubmitEdit('+submit+')'),false);
assert.equal(test.run('JSON.stringify(state)'),rmrBefore);
fill(test,{'pr-rmr':1700});
assert.equal(test.run('qaSubmitEdit('+submit+')'),true);
assert.equal(test.run('state.profile.method'),'measured');
assert.equal(test.run('state.profile.rmr'),1700);
assert(test.run('validData(state)'));
assert.equal(app(JSON.parse(test.saved())).run('state.profile.rmr'),1700);
`,{require,console});

// Trainingsblatt ruft die bestehenden Wege auf und zeigt sichere Routinenamen.
c.activeWorkout=()=>null;c.startWorkout=()=>calls.push('empty');c.quickAddWorkout=()=>calls.push('resume');
state.routines=[{id:'routine-1',name:'Push <A>'}];
run('qaQuickTraining()');
for(const action of ['startQuickEmptyWorkout()','qaQuickRoutines()','quickAddRun()'])assert(modal.html.includes(action),action);
assert(!bodyClasses.has('quickaddopen'));
run('qaQuickRoutines()');assert(modal.html.includes('Push &lt;A&gt;'));assert(modal.html.includes('startRoutine(state.routines[0].id)'));
state.routines=[];run('qaQuickRoutines()');assert(modal.html.includes('Noch keine Routinen'));
c.activeWorkout=()=>({id:'active'});run('qaQuickTraining()');assert.equal(calls.at(-1),'resume');

// Hervorgehobene Nährstoffe: höchstens acht, nur bekannte Schlüssel.
state.display.highlighted=['fiber','vitc','iron','calcium','b12','folate','potassium','magnesium'];
run("qaHighlight('zinc',null)");assert.equal(state.display.highlighted.length,8);assert.equal(sounds.at(-1),'warning');
run("qaHighlight('iron',null)");assert(!state.display.highlighted.includes('iron'));
run("qaHighlight('zinc',null)");assert(state.display.highlighted.includes('zinc'));
run("qaHighlight('unknown',null)");assert(!state.display.highlighted.includes('unknown'));

// Folien: Ein/Aus und Reihenfolge; Makro-Ziele bleiben fest vorn (nicht gespeichert).
run("qaViewToggle('micros',false)");assert.deepEqual([...state.display.summaryViews],['energy','week']);
run("qaViewMove('week',-1)");assert.deepEqual([...state.display.summaryViews],['week','energy']);
run("qaViewToggle('micros',true)");assert.deepEqual([...state.display.summaryViews],['week','energy','micros']);
run("qaViewToggle('macros',false)");assert.deepEqual([...state.display.summaryViews],['week','energy','micros']);

// Schalter und Auswahl speichern gültige Werte.
run("qaSetSwitch('haptics',false)");assert.equal(state.display.hapticsEnabled,false);
run("qaSetSwitch('sound',false)");assert.equal(state.soundEnabled,false);assert.equal(sounds.at(-1),'toggleOff');
run("qaSetSeg('remaining','remaining',null)");assert.equal(state.display.showRemaining,true);
run("qaSetSeg('motion','reduced',null)");assert.equal(state.display.motion,'reduced');
run("qaSetSeg('motion','fast',null)");assert.equal(state.display.motion,'reduced');
run('qaVolume(90)');assert.equal(state.soundVolume,undefined);run('qaVolume(40)');assert.equal(state.soundVolume,40);

// Konto: Übersicht mit vier Unterseiten und „Entdecken“ (Freunde hängen sich an .accountmenugroup).
let html=run('accountPage()');
for(const key of ['account','profile','targets','display'])assert(html.includes(`id="qa-link-${key}"`),key);
assert(html.includes('accountoverview')&&html.includes('class="dsgroup accountmenugroup qadiscover"'));
assert(!/Fasten|Check-in|Coaching|Progress-Foto/.test(html));
for(const key of ['account','profile','targets','display']){run(`qaOpen('${key}')`);html=run('accountPage()');assert(html.includes(`data-qa-page="${key}"`),key);assert(!html.includes('konnte nicht geladen'),key)}
run("qaOpen('targets')");html=run('accountPage()');
for(const text of ['Makros','Wasserziel','2450 ml','Hervorgehobene Nährstoffe','Ruheumsatz','Verhältnis'])assert(html.includes(text),text);
for(const key of ['kcal','mode','direction','pace','target','p','c','f'])assert(html.includes(`qaEdit('${key}')`),key);
assert(!/settings\(\)|Grundziel|Plan im Detail/.test(html));
run("qaOpen('display')");html=run('accountPage()');
for(const text of ['Farbschema','Folien der Tagesübersicht','Haptik','Bewegung','Sprache & App-Icon'])assert(html.includes(text),text);
run("qaOpen('profile')");html=run('accountPage()');assert(html.includes('25.3'),'BMI berechnet');
for(const key of ['age','sex','height','weight','target'])assert(html.includes(`qaEdit('${key}')`),key);
assert(!html.includes('settings()'));
assert(!/Rezepte|Kombis|Kalender|Trainingsfortschritt|Level & Rekorde/.test(run('qaDiscoverRows()')));

// BMI fallback: sex parameter, current non-future weight, no writes, measurement priority.
const profileSource=fs.readFileSync('js/profile-refresh.js','utf8');
vm.runInContext(profileSource.slice(profileSource.indexOf('function navyBodyFat('),profileSource.indexOf('const navyMeasurementNote')),c);
const snapshot=JSON.stringify(state);
let bf=run('currentBodyFat()');assert.equal(bf.method,'bmi');
assert(Math.abs(bf.value-(1.2*(82/1.8**2)+.23*34-10.8-5.4))<1e-9);
assert(Math.abs(run('currentBodyFat({...state.profile,sex:"female"}).value')-bf.value-10.8)<1e-9);
assert.equal(run('currentBodyFat({...state.profile,age:undefined})'),null);
assert.equal(run('currentBodyFat({...state.profile,sex:undefined})'),null);
assert.equal(run('currentBodyFat({...state.profile,height:undefined})'),null);
assert.equal(run('currentBodyFat({...state.profile,weight:undefined})'),null);
assert.equal(run('currentBodyFat(state.profile,[{date:today(),bodyfat:18}]).value'),18);
assert.notEqual(run('currentBodyFat(state.profile,[{date:today(),neck:40,waist:90}]).method'),'bmi');
assert.equal(JSON.stringify(state),snapshot);
state.weights=[{date:'2026-11-08',kg:80},{date:'2026-11-10',kg:100}];
assert(Math.abs(run('currentBodyFat().value')-(1.2*(80/1.8**2)+.23*34-10.8-5.4))<1e-9);state.weights=[];

// Bestehender Bereich aus einer Unterseite: Zurück führt zur Unterseite, Zurück-Text nennt sie.
c.accountPage=undefined;run("qaOpen('targets');qaSection('plan')");assert.equal(c.accountSection,'plan');assert.equal(run('qaParent'),'targets');
run('closeAccountSection()');assert.equal(c.accountSection,'');assert.equal(run('qaPage'),'targets');assert.equal(run('qaParent'),'');
run("go('home')");assert.equal(run('qaPage'),'');

// Einbindung: nach food-page.js, vor motion.js (bleibt letztes Skript); Offline-Liste vollständig.
const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert(index.indexOf('js/quick-account.js')>index.indexOf('js/food-page.js'));
assert(index.indexOf('js/quick-account.js')<index.indexOf('js/motion.js'));
assert(index.lastIndexOf('<script')===index.indexOf('<script src="js/motion.js'));
assert(index.indexOf('css/quick-account.css')>index.indexOf('css/design-system.css'));
for(const asset of ['js/quick-account.js','css/quick-account.css'])assert(sw.includes(`"${asset}"`),asset);

console.log('PASS: v87 Plus-Menü, Konto-Unterseiten, Verhältnis-Makros und Darstellung');
