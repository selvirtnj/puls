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

// addWaterGlass nimmt die Glasgröße an und fällt bei Unsinn auf 250 ml zurück.
c.addWaterGlass(300);c.addWaterGlass(0);c.addWaterGlass();
assert.deepEqual(state.foods.map(x=>x.grams),[300,250,250]);
assert(state.foods.every(x=>x.name==='Trinkwasser'&&x.unit==='ml'&&x.kcal===0&&x.nutrients.water===x.grams));

// Wasserziel kommt aus pulsData87, Gläser zählen nur Trinkwasser.
let w=c.fdWaterState(day);
assert.equal(w.goal,2450);assert.equal(w.mode,'auto');assert.equal(w.drink,800);assert.equal(w.filled,3);assert.equal(w.count,10);assert(Math.abs(w.partial-.2)<1e-9);
c.window.pulsData87={};state.waterGoal=1500;w=c.fdWaterState(day);assert.equal(w.goal,1500);assert.equal(w.mode,'manual');
state.water={mode:'manual',glassMl:5000};assert.equal(c.fdWaterState(day).glassMl,250,'ungültige Glasgröße fällt auf 250 ml zurück');
delete state.water;

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
