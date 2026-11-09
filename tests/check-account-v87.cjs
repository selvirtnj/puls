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
 accountGoalSummary:()=>'<section class="accountgoal"></section>',planTargetDate:()=>'März 2027',profileError:()=>'',
 energyFor:()=>({rmr:1800,tdee:2600}),recordGoalHistory(){calls.push('history')},
 quickAddRun(){},weightForm(){},measurementsForm(){},recipeEditor(){},foodForm(){calls.push('foodForm')},foodTab(){},fpMealEdit(){calls.push('meal')},fpBackTo(p){calls.push('pane:'+p)},
 accountPage:()=>'<div class="accountcompact accountrefresh accountoverview"></div>',
 openAccountSection(key){c.accountSection=key;c.render()},closeAccountSection(){c.accountSection='';c.render()},
 go(next){c.page=next;c.render()},render(){renders++}};
c.window.pulsData87={display:()=>({...state.display}),water:()=>({mode:'auto',glassMl:state.water.glassMl}),waterRecommendation:()=>({ml:2450,mode:'auto'})};
vm.createContext(c);
vm.runInContext(fs.readFileSync('js/quick-account-v87.js','utf8'),c,{filename:'js/quick-account-v87.js'});
const run=code=>vm.runInContext(code,c);

// Plus-Menü: Kacheln und Liste, keine Sprachnotiz, keine Notiz, kein Fasten; fremde Einträge bleiben.
run('quickAddMenu()');
assert.equal(modal.title,'Schnell hinzufügen');assert(bodyClasses.has('quickaddopen'));assert.equal(sounds.at(-1),'sheetOpen');
for(const key of ['search','barcode','photo','training','water','weight','ruler','run','meal','recipe','custom','extra'])assert(modal.html.includes(`data-qa-quick="${key}"`),key);
assert(modal.html.includes('class="dsgroup dsactionlist'),'app-polish erkennt das Menü weiter');
assert(modal.html.includes('+ 300 ml'),'Glasgröße aus pulsData87');
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
test.run('state.onboardingComplete=true;state.setupPending=false;setupPending=false;state.profile=null;state.plan={mode:"manual",direction:"lose",pace:"medium",macroMode:"manual",protein:1.8,fat:.8,macroInput:"ratio",ratio:{p:30,c:40,f:30}};state.goals={kcal:2000,p:150,c:200,f:67};page="home"');
test.run(fs.readFileSync('js/quick-account-v87.js','utf8'));
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
assert(test.run('qaMacroEditor()').includes('bezogen auf Grundziel '+test.run('qaNum(state.goals.kcal)')+' kcal'));
assert(test.run('qaMacroEditor()').includes('manuelle Makroziele bleiben unverändert'));
`,{require,console});

// Trainingsblatt ruft die bestehenden Wege auf und zeigt sichere Routinenamen.
c.activeWorkout=()=>null;c.startWorkout=()=>calls.push('empty');c.quickAddWorkout=()=>calls.push('resume');
state.routines=[{id:'routine-1',name:'Push <A>'}];
run('qaQuickTraining()');
for(const action of ['startWorkout()','qaQuickRoutines()','quickAddRun()'])assert(modal.html.includes(action),action);
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
run("qaOpen('display')");html=run('accountPage()');
for(const text of ['Farbschema','Folien der Tagesübersicht','Haptik','Bewegung','Sprache & App-Icon'])assert(html.includes(text),text);
run("qaOpen('profile')");html=run('accountPage()');assert(html.includes('25.3'),'BMI berechnet');

// Bestehender Bereich aus einer Unterseite: Zurück führt zur Unterseite, Zurück-Text nennt sie.
c.accountPage=undefined;run("qaOpen('targets');qaSection('plan')");assert.equal(c.accountSection,'plan');assert.equal(run('qaParent'),'targets');
run('closeAccountSection()');assert.equal(c.accountSection,'');assert.equal(run('qaPage'),'targets');assert.equal(run('qaParent'),'');
run("go('home')");assert.equal(run('qaPage'),'');

// Einbindung: nach food-page.js, vor motion.js (bleibt letztes Skript); Offline-Liste vollständig.
const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
assert(index.indexOf('js/quick-account-v87.js')>index.indexOf('js/food-page.js'));
assert(index.indexOf('js/quick-account-v87.js')<index.indexOf('js/motion.js'));
assert(index.lastIndexOf('<script')===index.indexOf('<script src="js/motion.js'));
assert(index.indexOf('css/quick-account-v87.css')>index.indexOf('css/design-system.css'));
for(const asset of ['js/quick-account-v87.js','css/quick-account-v87.css'])assert(sw.includes(`"${asset}"`),asset);

console.log('PASS: v87 Plus-Menü, Konto-Unterseiten, Verhältnis-Makros und Darstellung');
