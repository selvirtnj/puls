// Refactor Phase 4, Schritt 5: nutrition ist eine Funktion (js/food-diary.js); die frühere Kette aus 14 überschriebenen nutrition-Funktionen ist weggefallen.
// Die äußerste Definition (food-diary.js, zuletzt geladen) rief ihren Vorgänger nie; die 13 Glieder darunter (app, products, recipes, experience, insights, flows x4, compact,
// tracker-tools, adaptation, refinement) liefen nie. Beleg „alt = neu“: tests/fixtures/nutrition-order.json enthält für die Ladezeit und für viele Zustände (Sprache, Tage,
// Einträge, Ziele, Wasser, Mikronährstoffe, Designs, Seiten, Erststart) die Reihenfolge der Glieder, den zurückgegebenen HTML-Text (Länge und SHA-256) und den Zustand danach.
// Aufgezeichnet an der alten Kette (Commit 216f3dd):
//   node tests/check-nutrition-order.cjs --record-old   (braucht den Git-Verlauf; nur bei Absicht neu schreiben)
// Das Golden hängt nicht von der App-Version (Version N, ?v=N) und nicht von der Uhrzeit ab: Anzeigeversion wird normalisiert, die Uhr der App steht fest.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {loadApp,scriptList}=require('./validdata-env.cjs');
const FIXTURE='tests/fixtures/nutrition-order.json',OLD_COMMIT='216f3dd',NOW=Date.UTC(2026,10,13,12);
const CASES=JSON.parse(fs.readFileSync('tests/fixtures/validdata/cases.json','utf8')).states;

const PREFIX=file=>`globalThis.__ev=globalThis.__ev||function(s){(globalThis.__log=globalThis.__log||[]).push(s)};__ev('@'+${JSON.stringify(file)});`
 +`globalThis.__wrap=globalThis.__wrap||function(name,fn){return function(...a){__ev(name+'>');const r=fn.apply(this,a);__ev(name+'<');return r}};`;
const fileKey=file=>file.replace(/^js\//,'').replace(/\.js$/,'');
const oldText=file=>execFileSync('git',['show',`${OLD_COMMIT}:${file}`],{encoding:'utf8',maxBuffer:1<<26});

// Alter Code: Jeder Wrapper hält seinen Vorgänger als `const x=nutrition;` (gemeldet als Datei#Nr.: „>“ vor, „<“ nach dem Vorgänger). Jede Definition, die den Vorgänger nicht hält
// (app.js: function nutrition, experience.js#1, flows.js#1, food-diary.js: nutrition=function), meldet sich selbst als kern:Datei.
const KERNE={'js/app.js':'function nutrition(){','js/experience.js':'nutrition=function(){return `${macroCard()}','js/flows.js':'nutrition=function(){return `<div class="dashboardstack">','js/food-diary.js':'nutrition=function(){'};
function instrumentOld(file,text){
 let nr=0;
 text=text.replace(/const (\w+)=nutrition;/g,(m,name)=>`const ${name}=__wrap(${JSON.stringify(`${fileKey(file)}#${++nr}`)},nutrition);`);
 const needle=KERNE[file];
 if(needle){const at=text.indexOf(needle);if(at<0)throw Error('Kern nicht gefunden: '+file);const brace=at+needle.indexOf('{')+1;text=text.slice(0,brace)+`__ev('kern:${fileKey(file)}');`+text.slice(brace)}
 return PREFIX(file)+text;
}
// Neuer Code: Es gibt genau eine Funktion nutrition (js/food-diary.js); sie meldet sich beim Eintritt.
function instrumentNew(file,text){
 text=text.replace(/function nutrition\(\)\{/g,m=>m+`__ev('kern:${fileKey(file)}');`);
 return PREFIX(file)+text;
}
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const canon=events=>[...events].filter(e=>!/>$/.test(e)).map(e=>e.replace(/<$/,''));

// Zustände: Setup-Code läuft in der App vor jedem Aufruf. kind 'page' liefert nutrition(), 'render' den Inhalt nach render(), 'go' den Inhalt nach dem go('food') im Setup.
const RESET="date='2026-11-13';page='food';fdSlide=0;fdLastKey='';fdEnter=false;fdKnownIds=null;fdWaterMemory={key:'',filled:-1}";
const loadState=name=>`state=${JSON.stringify(CASES[name])};migrate();`;
const DAY='2026-11-13';
const food=(id,day,meal,name,kcal,p,c,f,extra='')=>`{id:'${id}',date:'${day}',meal:'${meal}',name:'${name}',grams:100,unit:'g',kcal:${kcal},p:${p},c:${c},f:${f}${extra}}`;
const micro=(o)=>`,nutrients:${JSON.stringify(o)}`;
const FOODS=`state.foods=[${food('f1',DAY,'Frühstück','Haferflocken',370,13,60,7,micro({water:10,fiber:10,vitc:0,iron:4.2,calcium:54,b12:0,folate:87,potassium:429,magnesium:140}))},${food('f2',DAY,'Mittagessen','Hähnchen',165,31,0,3.6,micro({iron:1,potassium:256,b12:0.3}))},${food('f3',DAY,'Snacks','Apfel',52,0.3,14,0.2,micro({fiber:2.4,vitc:4.6}))},${food('f4','2026-11-12','Abendessen','Reis',130,2.7,28,0.3)}];`;
const WATER=`state.foods.push({id:'w1',date:'${DAY}',meal:'Snacks',name:'Trinkwasser',grams:250,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:250}},{id:'w2',date:'${DAY}',meal:'Snacks',name:'Trinkwasser',grams:500,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:500}});`;
const MANY=`state.foods=Array.from({length:14},(_,i)=>({id:'m'+i,date:'${DAY}',meal:['Frühstück','Mittagessen','Abendessen','Snacks'][i%4],name:'Eintrag '+i,grams:50+i*10,unit:'g',kcal:100+i*20,p:5+i,c:10+i,f:2+i,nutrients:{fiber:i,iron:i/2,calcium:30+i}}));`;
const OVER=`state.foods=[${food('o1',DAY,'Snacks','Torte',3200,20,400,150)}];`;
const AI="state.foods=[{id:'ai1',date:'"+DAY+"',meal:'Snacks',name:'KI Snack',grams:100,unit:'g',kcal:200,p:5,c:20,f:10,aiEstimate:true,source:'KI-Schätzung (Foto)'}];";
const GOALS="state.goals={kcal:2400,p:160,c:260,f:80};";
const NOGOALS="state.goals={kcal:0,p:0,c:0,f:0};";
const PROFILE=`state.profile={age:30,sex:'male',height:180,weight:80,target:75,activity:1.55,method:'mifflin'};state.plan={...state.plan,mode:'auto',direction:'lose',pace:'medium',macroMode:'auto',protein:1.8,fat:0.9};`;
const scenarios=[];
const add=(name,setup,kind='page')=>scenarios.push({name,setup,kind});
for(const name of Object.keys(CASES)){add('zustand:'+name,loadState(name));add('zustand-render:'+name,loadState(name),'render')}
for(const name of ['initial','full','mit-profil-und-trainingsplan'])add('en:'+name,loadState(name)+"state.language='en';");
add('leer',loadState('initial'));
add('eintraege',loadState('initial')+FOODS);
add('eintraege-en',loadState('initial')+FOODS+"state.language='en';");
add('eintraege-anderer-tag',loadState('initial')+FOODS+"date='2026-11-12';");
add('eintraege-leerer-tag',loadState('initial')+FOODS+"date='2026-11-20';");
add('eintraege-zukunft',loadState('initial')+FOODS+"date='2027-01-05';");
add('eintraege-voriges-jahr',loadState('initial')+FOODS+"date='2025-12-31';");
add('viele-eintraege',loadState('initial')+MANY);
add('ueber-ziel',loadState('initial')+OVER+GOALS);
add('ki-eintrag',loadState('initial')+AI);
add('ziele-gesetzt',loadState('initial')+FOODS+GOALS);
add('ziele-leer',loadState('initial')+FOODS+NOGOALS);
add('ziele-leer-ohne-eintraege',loadState('initial')+NOGOALS);
add('ziele-profil',loadState('initial')+FOODS+PROFILE);
add('ziele-profil-en',loadState('initial')+FOODS+PROFILE+"state.language='en';");
add('ziele-pro-tag',loadState('initial')+FOODS+GOALS+"state.goalHistory=[{date:'2026-11-01',goals:{kcal:2000,p:120,c:200,f:60}}];");
add('wasser',loadState('initial')+FOODS+WATER);
add('wasser-ziel',loadState('initial')+FOODS+WATER+"state.waterGoal=2500;");
add('wasser-manuell',loadState('initial')+FOODS+WATER+"state.water={mode:'manual',glassMl:330};state.waterGoal=3000;");
add('wasser-erreicht',loadState('initial')+FOODS+WATER+"state.waterGoal=700;");
add('wasser-en',loadState('initial')+FOODS+WATER+"state.waterGoal=2500;state.language='en';");
add('nur-wasser',loadState('initial')+WATER.replace('state.foods.push','state.foods=[];state.foods.push'));
add('mikro-ziele',loadState('initial')+FOODS+"state.microGoals={fiber:30,iron:15,calcium:1000};");
add('mikro-hervorgehoben',loadState('initial')+FOODS+"state.display={...state.display,highlighted:['fiber','iron','calcium','zinc']};");
add('mikro-keine',loadState('initial')+FOODS+"state.display={...state.display,highlighted:[]};");
add('verbleibend',loadState('initial')+FOODS+GOALS+"state.display={...state.display,showRemaining:true};");
add('verbleibend-en',loadState('initial')+FOODS+GOALS+"state.display={...state.display,showRemaining:true};state.language='en';");
for(const views of [['week','energy'],['micros'],['energy'],['week','micros','energy'],[]]){
 add('ansichten:'+views.join('+')+':makro',loadState('initial')+FOODS+GOALS+`state.display={...state.display,summaryViews:${JSON.stringify(views)}};`);
 for(const slide of [0,1,2,3])add('ansichten:'+views.join('+')+':folie'+slide,loadState('initial')+FOODS+GOALS+`state.display={...state.display,summaryViews:${JSON.stringify(views)}};fdLastKey='food|'+date;fdSlide=${slide};`);
}
add('tag-abgeschlossen',loadState('initial')+FOODS+"state.foodLogCompleted=['"+DAY+"'];");
add('tag-abgeschlossen-en',loadState('initial')+FOODS+"state.foodLogCompleted=['"+DAY+"'];state.language='en';");
add('mahlzeiten',loadState('full')+FOODS);
add('mahlzeiten-en',loadState('full')+FOODS+"state.language='en';");
add('rezepte',loadState('initial')+FOODS+"state.recipes=[{id:'rc1',name:'Bowl',items:[{name:'Skyr',grams:150,unit:'g',kcal:100,p:17,c:6,f:0.3}]}];");
add('plaene-fasten',loadState('mit-tracker-werkzeugen')+FOODS+"state.fasts=[{id:'fa1',startedAt:"+(NOW-3600000)+",endedAt:null,hours:16}];state.mealPlans=[{id:'mp1',date:'"+DAY+"',meal:'Abendessen',name:'Lachs'}];");
add('vorschlaege-offen',loadState('initial')+GOALS+"state.foods=[];");
add('vorschlaege-fast-voll',loadState('initial')+GOALS+"state.foods=[{id:'v1',date:'"+DAY+"',meal:'Snacks',name:'Menü',grams:100,unit:'g',kcal:2380,p:158,c:258,f:78}];");
add('wiedereintrag-eintragung',loadState('initial')+FOODS+"state.foods.forEach(x=>x.known=true);fdKnownIds={key:date,ids:new Set(state.foods.filter(x=>x.date===date).map(x=>x.id))};fdLastKey='food|'+date;");
add('einstieg-animation',loadState('initial')+FOODS+"fdLastKey='';fdEnter=true;");
for(const design of ['classic','apple','cronometer','liftoff','hevy','aurora','mono','terra','volt','blueprint','nocturne']){
 add('design:'+design,loadState('full')+FOODS+`state.appDesign='${design}';`);
}
add('design-en',loadState('full')+FOODS+"state.appDesign='liftoff';state.language='en';");
add('seite-home',loadState('initial')+FOODS+"page='home';");
add('render:essen',loadState('full')+FOODS+GOALS,'render');
add('render:essen-en',loadState('full')+FOODS+GOALS+"state.language='en';",'render');
add('render:essen-leer',loadState('initial'),'render');
add('render:essen-wasser',loadState('initial')+FOODS+WATER+"state.waterGoal=2500;",'render');
add('render:essen-anderer-tag',loadState('initial')+FOODS+"date='2026-11-12';",'render');
add('render:essen-design',loadState('full')+FOODS+"state.appDesign='liftoff';",'render');
add('render:home',loadState('full')+FOODS+"page='home';",'render');
add('go:essen',loadState('full')+FOODS+"page='home';go('food');",'go');
add('go:essen-leer',loadState('initial')+"page='home';go('food');",'go');
add('go:essen-en',loadState('full')+FOODS+"page='home';state.language='en';go('food');",'go');

function protocol(mode,options={}){
 const transform={};
 for(const file of scriptList())transform[file]=text=>mode==='old'?instrumentOld(file,oldText(file)):instrumentNew(file,text);
 const app=loadApp({transform,now:NOW,...options});
 assert.deepEqual(app.errors,[],'Skripte, die im Stub nicht laufen');
 const log=app.ctx.__log,result={};
 // Während des Ladens darf keine nutrition-Definition laufen (page ist dann „home“); alles, was auftaucht, wird festgehalten.
 result.laden=canon(log.filter(e=>!e.startsWith('@')));
 const sections=options.search?[{name:'erststart',setup:loadState('initial'),kind:'page'},{name:'erststart-render',setup:loadState('initial'),kind:'render'},{name:'erststart-go',setup:loadState('initial')+"page='home';go('food');",kind:'go'},{name:'erststart-eintraege',setup:loadState('initial')+FOODS,kind:'page'}]:scenarios;
 result.faelle={};
 for(const s of sections){
  log.length=0;
  // Unerwartete Ausnahmen (z. B. ein fehlender Methodenaufruf im DOM-Stub) gelten nicht als Ergebnis, sondern machen den Test ungültig.
  app.run(RESET+';'+s.setup);
  const html=s.kind==='page'?app.run('nutrition()'):(s.kind==='render'&&app.run('render()'),app.run("$('content').innerHTML"));
  const text=String(html).replace(/Version \d{3,}/g,'Version 100').replace(/\?v=\d+/g,'?v=100'); // Anzeigeversion und Cache-Parameter dürfen weiterzählen
  result.faelle[s.name]={ablauf:canon(log.filter(e=>!e.startsWith('@'))).join(' '),laenge:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex'),
   zustand:crypto.createHash('sha256').update(app.run('JSON.stringify([date,page,fdSlide,fdLastKey,fdEnter,fdKnownIds&&{key:fdKnownIds.key,ids:[...fdKnownIds.ids]},state])').replace(UUID,'UUID')).digest('hex')};
 }
 return result;
}
const both=mode=>({standard:protocol(mode),erststart:protocol(mode,{search:'?erststart=1'})});

if(process.argv.includes('--record-old')){
 const data=both('old');
 fs.writeFileSync(FIXTURE,JSON.stringify({alt:OLD_COMMIT,...data},null,1)+'\n');
 console.log(`Aufgezeichnet: ${FIXTURE} (${Object.keys(data.standard.faelle).length+Object.keys(data.erststart.faelle).length} Zustände, alte Kette aus ${OLD_COMMIT})`);process.exit(0);
}

// 1. Genau eine Definition: nutrition ist nur in js/food-diary.js deklariert und wird nirgends mehr überschrieben.
const code=file=>fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
const jsFiles=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f);
assert.deepEqual(jsFiles.filter(f=>/(?<![.\w$])function\s+nutrition\s*\(/.test(code(f))),['js/food-diary.js'],'nutrition darf nur in js/food-diary.js deklariert sein');
assert.deepEqual(jsFiles.filter(f=>/(^|[;{}\n])\s*nutrition\s*=(?!=)/.test(code(f))),[],'nutrition wird nirgends mehr überschrieben');
assert.deepEqual(jsFiles.filter(f=>/=\s*nutrition\s*;/.test(code(f))),[],'keine Datei hält mehr eine alte nutrition-Funktion fest');

// 2. Ablauf und Ergebnis wie in der alten Kette.
const golden=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),now=both('new');
if(process.argv.includes('--accept-ui')){require('./accept-ui.cjs')(FIXTURE,golden,{alt:golden.alt,...now},{html:['laenge','sha256']});process.exit(0)} // nur HTML-Werte neu, nach gewollter UI-Änderung
assert.deepEqual(Object.keys(now.standard.faelle),Object.keys(golden.standard.faelle),'Zustände weichen vom Golden ab');
for(const group of ['standard','erststart']){
 assert.deepEqual(now[group].laden,golden[group].laden,`${group}: Aufrufe von nutrition während des Ladens weichen ab`);
 for(const [name,expected] of Object.entries(golden[group].faelle)){
  const got=now[group].faelle[name];
  assert.equal(got.ablauf,expected.ablauf,`${group}/${name}: Reihenfolge der Glieder weicht von der alten Kette (${golden.alt}) ab`);
  assert.equal(got.laenge,expected.laenge,`${group}/${name}: Länge des HTML weicht ab`);
  assert.equal(got.sha256,expected.sha256,`${group}/${name}: HTML weicht von der alten Kette ab`);
  assert.equal(got.zustand,expected.zustand,`${group}/${name}: Zustand (Datum, Seite, Tagebuch-Ansicht, Daten) danach weicht ab`);
 }
}
// Im alten Stand lief ausschließlich die äußerste Definition; alle Glieder darunter wurden nie aufgerufen (Beleg für die gelöschten 13 Glieder).
const alle=new Set(Object.values(golden.standard.faelle).concat(Object.values(golden.erststart.faelle)).flatMap(f=>f.ablauf.split(' ').filter(Boolean)));
assert.deepEqual([...alle],['kern:food-diary'],'alte Kette: nur food-diary.js lief');
console.log(`PASS: nutrition ist eine Funktion; ${Object.keys(golden.standard.faelle).length+Object.keys(golden.erststart.faelle).length} Zustände liefern Ablauf und HTML wie die alte Kette (nur kern:food-diary lief, 13 Glieder darunter waren tot).`);
