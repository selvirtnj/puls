const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Synthetic DOM fixture: the language wrapper has already translated the allowance
// before app-polish.render runs, as in index.html's actual wrapper order.
function calorieFixture(language,consumed,goal,page='food'){
  let shown,removed=false;
  const dial={firstElementChild:{append(value){shown=value}},replaceWith(){}},line={
    textContent:language==='en'?'0 kcal left · 300 kcal above target':'0 kcal übrig · 300 kcal über Ziel',
    querySelector:()=>({textContent:Math.max(0,goal-consumed)+' kcal'}),
    closest:()=>({querySelector:()=>dial}),remove(){removed=true}
  };
  const ctx={state:{language,goals:{kcal:goal}},page,totals:()=>({kcal:consumed}),n:String,
    render(){},save(){},quickAddMenu(){},openModal(){},markFoodDayComplete(){},nutrientTotals(){},waterCard(){},
    modal:{addEventListener(){}},document:{addEventListener(){},
      querySelectorAll:selector=>selector.includes('combinedallowance')?[line]:[],querySelector:()=>null,
      createElement:()=>({append(...values){shown=values.at(-1)}})}};
  vm.runInNewContext(fs.readFileSync('js/app-polish.js','utf8'),ctx);
  assert(removed);
  return shown;
}
for(const language of ['de','en'])for(const page of ['food','home']){
  const over=calorieFixture(language,2500,2200,page);
  assert.equal(over.textContent,'+300 kcal');assert.equal(over.className,'kcalleft over');
  const left=calorieFixture(language,1900,2200,page);
  assert.equal(left.textContent,'300 kcal');assert.equal(left.className,'kcalleft');
  assert.equal(calorieFixture(language,2200,2200,page).textContent,'0 kcal');
}
console.log('PASS: DE/EN calorie surplus, remaining and exact target on food and overview.');

async function ingredientSearchFixture(){
  const timers=new Map(),requests=new Map();let timerId=0,target={innerHTML:'Initial'};
  const ctx={modal:{addEventListener(){}},quickActionPaths:{},englishUI:{},
    state:{language:'de',custom:[]},catalogueQuerySerial:0,
    $:id=>id==='recipe-results'?target:null,
    setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
    localCatalogue:[{id:'old',name:'Old',kcal:100},{id:'new',name:'New',kcal:200}],
    queryCatalogueAsync:q=>new Promise(resolve=>requests.set(q,resolve)),
    savedFoodMatches:()=>[],n:String,esc:String};
  // Unrelated base handlers are never invoked by these search-only fixtures.
  for(const name of ['openModal','foodForm','foodTab','searchFoodDatabase','applyFoodQuantity',
    'syncFoodQuantity','changeFoodQuantityUnit','setFoodDensity','previewFood','attachFoodExtras',
    'saveHouseholdPortion','selectFood','chooseCatalogueFood','stopBarcode','startBarcodeCamera',
    'confirmProduct','addCustom'])ctx[name]=()=>{};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/food-flow.js','utf8'),ctx);
  vm.runInContext('ffRankFoods=(query,saved,catalog)=>catalog',ctx);
  const fireTimer=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);return fn()};
  ctx.filterRecipeIngredients('old');const oldRequest=fireTimer();
  ctx.filterRecipeIngredients('new'); // Its debounce has not fired yet.
  requests.get('old')({indices:[0]});await oldRequest;
  assert.equal(target.innerHTML,'Initial','Old reply must be invalidated immediately on input');
  const newRequest=fireTimer();requests.get('new')({indices:[1]});await newRequest;
  assert(target.innerHTML.includes('New'));assert(!target.innerHTML.includes('Old'));
  assert.equal(vm.runInContext('ffIngredientList[0].id',ctx),'new');

  // A timer from an abandoned picker cannot fill a newly opened picker.
  ctx.filterRecipeIngredients('abandoned');target={innerHTML:'Reopened'};
  await fireTimer();assert(!requests.has('abandoned'));assert.equal(target.innerHTML,'Reopened');
  // Nor may an already running request write after its target was replaced.
  ctx.filterRecipeIngredients('running');const runningRequest=fireTimer();
  target={innerHTML:'Another picker'};requests.get('running')({indices:[0]});await runningRequest;
  assert.equal(target.innerHTML,'Another picker');
  console.log('PASS: recipe ingredient search rejects stale replies during debounce and after picker replacement.');

  let prompt,accepted=false,saves=0,returns=0;
  ctx.confirm=text=>{prompt=text;return accepted};ctx.save=()=>saves++;
  ctx.returnToRecipes=()=>returns++;ctx.toast=()=>{};
  ctx.state.recipes=[{id:'delete-me'},{id:'keep-me'}];
  ctx.state.foods=[{recipeId:'delete-me',kcal:123}];
  ctx.ffDeleteRecipe('delete-me');
  assert.equal(prompt,'Gespeichertes Rezept löschen? Erfasste Portionen bleiben im Tagebuch.');
  assert.equal(ctx.state.recipes.length,2);assert.equal(saves,0);assert.equal(returns,0);
  ctx.state.language='en';accepted=true;ctx.ffDeleteRecipe('delete-me');
  assert.equal(prompt,'Delete saved recipe? Logged servings stay in the diary.');
  assert.equal(ctx.state.recipes.length,1);assert.equal(ctx.state.recipes[0].id,'keep-me');
  assert.equal(ctx.state.foods[0].kcal,123);assert.equal(saves,1);assert.equal(returns,1);
  console.log('PASS: DE/EN recipe delete confirmation, cancellation and preserved diary snapshots.');
}
ingredientSearchFixture().catch(error=>{console.error(error);process.exitCode=1});

function hapticCheckboxFixture(){
  let now=1000;const listeners={},vibrations=[],sounds=[];
  const ctx={Date:{now:()=>now},window:{},navigator:{vibrate(pattern){vibrations.push(pattern);return true}},
    pulsSound:kind=>sounds.push(kind),document:{hidden:false,addEventListener(type,handler){listeners[type]=handler}}};
  vm.runInNewContext(fs.readFileSync('js/haptics.js','utf8'),ctx);
  const checkbox={matches:selector=>selector.includes('input[type=checkbox]'),
    closest:selector=>selector.includes('input[type=checkbox]')?checkbox:null};
  const completeSet=()=>{listeners.click({target:checkbox});ctx.pulsSound('set');listeners.change?.({target:checkbox})};
  completeSet();assert.deepEqual(vibrations,[18],'Set completion must retain medium haptic, not selection');
  assert.deepEqual(sounds,['set']);
  now+=100;listeners.click({target:checkbox});listeners.change?.({target:checkbox});
  assert.deepEqual(vibrations,[18,6],'Ordinary checkboxes/unchecking keep selection feedback');
  now+=100;ctx.document.hidden=true;completeSet();assert.deepEqual(vibrations,[18,6]);
  console.log('PASS: checkbox event order preserves set haptics, ordinary selection feedback and hidden-page suppression.');
}
hapticCheckboxFixture();

function labelEnergyFixture(){
  const ctx={modal:{addEventListener(){}},searchAliases:{},navigator:{},location:{protocol:'file:'}};
  for(const name of ['productReview','confirmProduct','customFood','addCustom','foodForm','foodTab',
    'mapOffProduct','selectFood','chooseCatalogueFood','addFood','showSearch','searchFoodDatabase',
    'validData','parseFoodLine','logTextFood'])ctx[name]=()=>{};
  vm.runInNewContext(fs.readFileSync('js/food-upgrade.js','utf8'),ctx);
  for(const sign of ['<','>','≤','≥','<=','>=','-']){
    assert.equal(ctx.parseLabelText('Energie '+sign+' 1 kcal').kcal,undefined,sign+' is not an exact value');
  }
  assert.equal(ctx.parseLabelText('Energie 840 kJ / 200 kcal').kcal,200);
  assert.equal(ctx.parseLabelText('Energy 0 kcal').kcal,0);
  assert.equal(ctx.parseLabelText('Energy 0,5 kcal').kcal,.5);
  assert.equal(ctx.parseLabelText('Energy < 1 kcal / 20 kcal',0).kcal,undefined);
  assert.equal(ctx.parseLabelText('Energy < 1 kcal / 20 kcal',1).kcal,20);
  assert.equal(ctx.parseLabelText('Energy 20 kcal / ≤ 1 kcal',0).kcal,20);
  assert.equal(ctx.parseLabelText('Energy 20 kcal / ≤ 1 kcal',1).kcal,undefined);
  console.log('PASS: OCR calorie bounds/negative values stay unknown; exact values and column positions remain intact.');
}
labelEnergyFixture();
