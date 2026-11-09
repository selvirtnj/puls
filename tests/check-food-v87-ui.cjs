// v87 Essen-Tab und Hinzufügen-Seite: reine Logik (Wasser, Wochenschnitt, Filter, Kombis) ohne echtes Layout.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const day='2026-11-09',localISO=d=>d.toISOString().slice(0,10);
const state={foods:[],custom:[],recipes:[],goals:{kcal:2000,p:150,c:250,f:70},waterGoal:0};
const c={console,Date,Math,Number,String,Object,Array,Set,Map,JSON,Promise,isFinite,parseFloat,state,date:day,page:'home',englishUI:{},
 localISO,today:()=>day,round:x=>Math.round(x*10)/10,uid:(()=>{let i=0;return()=>'id'+(++i)})(),n:String,esc:s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
 modal:{classList:{toggle(){},remove(){},contains:()=>false},addEventListener(){},open:false,close(){}},
 document:{querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body:{classList:{toggle(){}}}},
 window:{addEventListener(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},
 $:()=>null,save(){},render(){},toast(){},phIcon:()=>'',validNutrients:()=>true};
c.window.pulsData87={waterRecommendation:(s)=>({ml:2450,mode:'auto'})};
for(const name of ['openModal','foodForm','foodTab','showSearch','foodResultHTML','ffAutoOnline','ffRenderDetail','previewFood','productReview','customFood','barcodePanel','lookupBarcode','addFood','nutrition'])c[name]=()=>'';
vm.createContext(c);
vm.runInContext(fs.readFileSync('js/flows.js','utf8').match(/function addWaterGlass[^\n]*/)[0],c);
for(const file of ['js/food-diary.js','js/food-page.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});

// Energie liegt links von Makros; Öffnen und Tageswechsel starten trotzdem mit Makros.
state.display={summaryViews:['week','energy','energy','micros']};
assert.deepEqual([...c.fdViews()],['energy','macros','week','micros']);
assert.deepEqual(state.display.summaryViews,['week','energy','energy','micros']);
c.document.documentElement={classList:{contains:()=>false}};
vm.runInContext("page='food';fdSlide=3;render()",c);assert.equal(vm.runInContext('fdSlide',c),1);
vm.runInContext('fdSlide=2;render()',c);assert.equal(vm.runInContext('fdSlide',c),2);
vm.runInContext("date='2026-11-08';render()",c);assert.equal(vm.runInContext('fdSlide',c),1);
vm.runInContext("date='2026-11-09';page='home';render()",c);
state.display.summaryViews=[];assert.deepEqual([...c.fdViews()],['macros']);delete state.display;
c.friendlyDay=()=> 'Heute';assert(!c.fdHead().includes('fdToggleDay'));

// addWaterGlass nimmt die Glasgröße an und fällt bei Unsinn auf 250 ml zurück.
c.addWaterGlass(300);c.addWaterGlass(0);c.addWaterGlass();
assert.deepEqual(state.foods.map(x=>x.grams),[300,250,250]);
assert(state.foods.every(x=>x.name==='Trinkwasser'&&x.unit==='ml'&&x.kcal===0&&x.nutrients.water===x.grams));

// Wasserziel kommt aus pulsData87, Gläser zählen nur Trinkwasser.
let w=c.fdWaterState(day);
assert.equal(w.goal,2450);assert.equal(w.mode,'auto');assert.equal(w.drink,800);assert.equal(w.filled,3);assert.equal(w.count,7);assert(Math.abs(w.partial-.2)<1e-9);
c.window.pulsData87={};state.waterGoal=1500;w=c.fdWaterState(day);assert.equal(w.goal,1500);assert.equal(w.mode,'manual');
state.water={mode:'manual',glassMl:5000};assert.equal(c.fdWaterState(day).glassMl,250,'ungültige Glasgröße fällt auf 250 ml zurück');
delete state.water;

// Auch oberhalb der sichtbaren Gläser bleibt Hinzufügen mit derselben Glasgröße möglich.
state.foods.push({id:'overflow',date:day,name:'Trinkwasser',grams:3000,unit:'ml',kcal:0,nutrients:{water:3000}});
c.nutrientTotals=()=>({totals:{water:3800}});
assert.equal(c.fdWaterState(day).count,7);
assert.match(c.fdWaterCard(),/fdGlassTap\(15\)/);
c.fdGlassTap(c.fdWaterState(day).filled);assert.equal(state.foods.at(-1).grams,250);
state.foods=state.foods.filter(x=>x.id!=='overflow');

// v90: „−“ liegt immer auf dem letzten sichtbaren vollen Glas und entfernt genau eine Glasgröße (ein Klang, ein Rückgängig).
{
 const saved=JSON.parse(JSON.stringify(state.foods)),undoBase=c.fdUndoToast,soundBase=c.fdSound,pulsBase=c.window.pulsData87,openBase=c.openModal;
 let undo=null,sounds=[];c.fdUndoToast=(text,action)=>{undo=action};c.fdSound=k=>sounds.push(k);
 const water=(id,ml,t)=>({id,date:day,meal:'Snacks',name:'Trinkwasser',grams:ml,unit:'ml',kcal:0,p:0,c:0,f:0,nutrients:{water:ml},loggedAt:t});
 state.foods=[water('a',250,1),water('b',500,2),{id:'food',date:day,name:'Reis',grams:100,unit:'g',kcal:130,p:3,c:28,f:0,loggedAt:3}];
 assert.equal(c.fdWaterState(day).filled,3);
 c.fdGlassTap(0);
 assert.deepEqual(state.foods.map(x=>[x.id,x.grams,x.nutrients?.water]),[['a',250,250],['b',250,250],['food',100,undefined]],'larger entry shrinks by one glass');
 assert.deepEqual(sounds,['delete'],'exactly one delete sound');
 undo();assert.deepEqual(state.foods.map(x=>[x.id,x.grams]),[['a',250],['b',500],['food',100]],'undo restores the entry');
 c.fdGlassTap(1);c.fdGlassTap(0);assert.deepEqual(state.foods.map(x=>[x.id,x.grams]),[['a',250],['food',100]],'entry of glass size is deleted');
 state.foods=[water('a',500,1),water('b',100,2)];c.fdGlassTap(0);
 assert.deepEqual(state.foods.map(x=>[x.id,x.grams]),[['a',350]],'smaller newest entries: one glass across entries');
 undo();assert.deepEqual(state.foods.map(x=>[x.id,x.grams]),[['a',500],['b',100]]);
 state.foods=[water('big',2500,1)];let w=c.fdWaterState(day);assert.equal(w.filled,10);assert.equal(w.count,7);
 assert.equal((c.fdWaterCard().match(/fdglassminus/g)||[]).length,1,'one minus from 8+ glasses');
 assert.match(c.fdGlass(6,w,false),/fdglassminus/,'minus on the last visible full glass');
 c.fdGlassTap(6);assert.equal(state.foods[0].grams,2250);assert.equal(state.foods[0].nutrients.water,2250);
 // Wasserziel-Info zeigt bei eigenem Ziel den echten Automatikwert.
 let body='';c.openModal=(title,html)=>{body=html};
 c.window.pulsData87={waterRecommendation:s=>Number(s.waterGoal)>0?{ml:s.waterGoal,mode:'manual'}:{ml:2450,mode:'auto'}};
 state.waterGoal=1800;state.water={mode:'manual',glassMl:250};c.fdWaterInfo();
 assert.match(body,/2450 ml/,'automatic value ignores the custom goal');
 delete state.water;state.waterGoal=0;
 // v90-Review: Restmengen bleiben validData-konform (0,1-ml-Raster, sonst Eintrag löschen).
 c.validData=s=>s.foods.every(x=>Number.isFinite(x.grams)&&x.grams>=.1);
 state.foods=[water('odd',250.05,1)];c.fdGlassTap(0);assert.deepEqual(state.foods,[],'rest below 0.1 ml deletes the entry');assert(c.validData(state));
 state.foods=[water('odd2',500.04,1)];c.fdGlassTap(0);assert.equal(state.foods[0].grams,250);assert.equal(state.foods[0].nutrients.water,250);
 c.validData=s=>s.foods.every(x=>x.grams!==250);state.foods=[water('rule',500,1)];c.fdGlassTap(0);assert.deepEqual(state.foods,[],'rest rejected by validData deletes the entry');
 delete c.validData;
 // v90-Review: Undo nimmt nur den unveränderten Zwischenstand zurück, sonst still verwerfen.
 state.foods=[water('u',500,1)];c.fdGlassTap(0);state.foods[0]={...state.foods[0],grams:1000,nutrients:{water:1000}};
 assert.equal(undo(),false,'changed entry blocks undo');assert.equal(state.foods[0].grams,1000);
 state.foods=[water('d',250,1)];c.fdGlassTap(0);state.foods.push(water('d',250,1));assert.equal(undo(),false,'reappeared entry blocks undo');assert.equal(state.foods.length,1);
 state.foods=[water('p',500,1)];c.fdGlassTap(0);c.state=JSON.parse(JSON.stringify(state));assert.equal(undo(),false,'replaced profile blocks undo');assert.equal(c.state.foods[0].grams,250);c.state=state;
 state.foods=[water('ok',500,1)];c.fdGlassTap(0);assert.notEqual(undo(),false);assert.equal(state.foods[0].grams,500,'unchanged state still undoes');
 c.fdUndoToast=undoBase;c.fdSound=soundBase;c.window.pulsData87=pulsBase;c.openModal=openBase;state.foods=saved;
}

// v90: „Heute eingetragen“ der Übersicht zeigt kein Wasser.
{
 const ds={state,date:day,today:()=>day,fdIsWater:c.fdIsWater,dsText:(de)=>de,dsKcal:String,n:String,esc:String,dsRow:({label})=>'<row>'+label+'</row>',dsGroup:(title,rows)=>rows};
 vm.createContext(ds);vm.runInContext(fs.readFileSync('js/design-system.js','utf8').match(/function dsFoodGroup\(\)\{[\s\S]*?\n\}/)[0],ds);
 const saved=state.foods;state.foods=[{id:'w',date:day,name:'Trinkwasser',grams:250,unit:'ml',kcal:0},{id:'r',date:day,name:'Reis',grams:100,unit:'g',kcal:130}];
 const html=vm.runInContext('dsFoodGroup()',ds);assert(html.includes('Reis'));assert(!html.includes('Trinkwasser'),'water hidden from logged today');
 state.foods=saved;
}

// Wochenschnitt nur über Tage mit Einträgen; Wasser zählt nicht.
state.foods.push({id:'a',date:day,name:'Reis',grams:100,unit:'g',kcal:400,p:10,c:80,f:2},{id:'b',date:'2026-11-07',name:'Skyr',grams:100,unit:'g',kcal:200,p:20,c:4,f:0},{id:'old',date:'2026-10-01',name:'Alt',grams:1,unit:'g',kcal:9999,p:0,c:0,f:0});
let week=c.fdWeekStats(day);assert.equal(week.days,2);assert.equal(week.avg.kcal,300);assert.equal(week.avg.p,15);

// Quellen und Filter.
assert.deepEqual([...c.fpSourceKeys({source:'BLS 4.0'})],['bls']);
assert.deepEqual([...c.fpSourceKeys({source:'x',barcode:'4001'})],['off']);
assert.deepEqual([...c.fpSourceKeys({id:'base3'})],['puls']);
assert.deepEqual([...c.fpSourceKeys({kind:'meal'})],['own']);
state.foodSearch={sort:'az',sources:['bls','own']};
let sorted=c.fpFilterSort([{id:'1',name:'Zwieback',source:'BLS 4.0'},{id:'2',name:'Apfel',source:'BLS 4.0'},{id:'3',name:'Cola',barcode:'1'}],new Map());
assert.deepEqual(sorted.map(x=>x.name),['Apfel','Zwieback']);
delete state.foodSearch;

// Kombis: Schema-Prüfung und Skalierung ohne erfundene Werte.
const item={name:'Haferflocken',grams:50,unit:'g',kcal:186,p:6.8,c:29.4,f:3.5,nutrients:{fiber:5}};
assert.equal(c.fpMealsOK([{id:'combo-1',name:'Frühstück',items:[item]}]),true);
assert.equal(c.fpMealsOK([{id:'combo-1',name:'Leer',items:[]}]),false);
assert.equal(c.fpMealsOK([{id:'combo-1',name:'Dichte',items:[{...item,unit:'l'}]}]),false);
assert.equal(c.fpMealsOK([{id:'combo-1',name:'NaN',items:[{...item,kcal:NaN}]}]),false);
let scaled=c.fpScaled(item,100);assert.equal(scaled.kcal,372);assert.equal(scaled.p,13.6);assert.equal(scaled.nutrients.fiber,10);
assert.equal(Object.keys(c.fpScaled({...item,nutrients:{}},25).nutrients).length,0,'fehlende Nährstoffe bleiben fehlend');

// Getter-Fallback: fehlende v87-Felder nach Profilwechsel brechen nichts.
delete state.meals;delete state.display;assert.equal(c.fdField('meals').length,0);assert.equal(c.fdField('display').showRemaining,false);

// Review-Befunde: keine Daten-IDs in Inline-JavaScript.
const evil="');globalThis.probe=1;//";
const rowHTML=c.fpMealRow({id:evil,name:'X',items:[item]},0);
assert.doesNotMatch(rowHTML,/onclick/);assert.match(rowHTML,/data-fp-meal="&#39;\);globalThis\.probe=1;\/\/"/);
assert.equal(c.fpMealsOK([{id:evil,name:'X',items:[item]}]),true,'Schema lässt solche IDs zu, daher muss die Oberfläche sie entschärfen');
const diaryHTML=c.fdDiaryRow({id:evil,name:'Y',grams:10,unit:'g',kcal:1},false);
assert.doesNotMatch(diaryHTML,/onclick/);assert.match(diaryHTML,/data-fd-action="delete"/);
for(const file of ['js/food-page.js','js/food-diary.js']){const src=fs.readFileSync(file,'utf8');assert.doesNotMatch(src,/on(click|submit|input|change)="[^"]*'\$\{esc\(/,file+': esc() in Inline-Handler')}

// Schnellbuchung: angezeigte Standardmenge = Detail-Standardmenge (zuletzt, sonst 100).
c.ffLastAmount=x=>x.id==='used'?40:null;c.ffBase=x=>x.unit==='ml'?'ml':'g';c.ffPortionName=String;c.foodPortions=()=>[{name:'Stück',amount:50}];
assert.equal(c.fpDefaultAmount({id:'used'}),40);assert.equal(c.fpDefaultAmount({id:'new'}),100);
assert.match(c.fpAmountLine({id:'new',kcal:200,unit:'g'}),/^100 g · 200 kcal$/,'erste Portion wird nicht als Standard angezeigt');
assert.match(c.fpAmountLine({id:'used',kcal:200,unit:'g'}),/40 g · 80 kcal$/);

// Häufig: Quellenfilter unabhängig von der Sortierung.
state.foodSearch={sort:'best',sources:['bls']};
assert.deepEqual(c.fpFilterSources([{id:'1',source:'BLS 4.0'},{id:'2',barcode:'9'}]).map(x=>x.id),['1']);
delete state.foodSearch;

// Kombis behalten Herkunft und KI-Kennzeichen.
const ai={name:'Foto',grams:300,unit:'g',kcal:500,p:20,c:50,f:20,source:'KI-Schätzung · Test',aiEstimate:true,recipeId:'r1',foodRef:'f1',barcode:'123'};
const snap=c.fpSnapshot(ai,300);for(const k of ['source','aiEstimate','recipeId','foodRef','barcode'])assert.equal(snap[k],ai[k],k);
assert.equal(c.fpMealsOK([{id:'combo-2',name:'KI',items:[snap]}]),true);
assert.equal(c.fpMealsOK([{id:'combo-2',name:'KI',items:[{...snap,aiEstimate:'ja'}]}]),false);
const v87=fs.readFileSync('js/puls-data-v87.js','utf8');assert.match(v87,/aiEstimate===undefined\|\|typeof x\.aiEstimate==='boolean'/);assert.match(v87,/'foodRef','recipeId'/);

// Wasser „Automatisch“ löscht ein früheres eigenes Ziel.
const inputs={'fd-water-mode':{value:'auto'},'fd-water-glass':{value:'300'},'fd-water-goal':{value:'2500'}};
c.$=id=>inputs[id]||null;state.waterGoal=3000;state.water={mode:'manual',glassMl:250};
c.fdSaveWater({preventDefault(){}});assert.equal(state.waterGoal,0);assert.equal(state.water.mode,'auto');assert.equal(state.water.glassMl,300);
inputs['fd-water-mode'].value='manual';c.fdSaveWater({preventDefault(){}});assert.equal(state.waterGoal,2500);

// Undo-Hinweis liegt im offenen Dialog (außerhalb wäre er inert).
const made=[];const el=()=>({id:'',parentElement:null,classList:{add(){},remove(){}},setAttribute(){},remove(){},set innerHTML(v){},get offsetWidth(){return 0}});
const host=name=>({name,appendChild(x){x.parentElement=this;made.push(name)},contains:x=>x.parentElement?.name===name});
c.document.body=host('body');c.document.createElement=el;c.modal.open=true;Object.assign(c.modal,host('modal'));c.$=()=>null;
c.fdUndoToast('Test',()=>{});assert.deepEqual([...made],['modal']);

console.log('PASS: v87 Essen-Tab, Wasser-Gläser, Filter, Kombis und Review-Befunde (Injektion, Schnellmenge, Herkunft, Wasser-Auto, Undo im Dialog)');
