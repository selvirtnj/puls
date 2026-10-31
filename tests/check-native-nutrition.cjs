// M7/P1: synthetic profile, real last-effective nutrition chains, no account/network/device access.
const fs=require('node:fs'),vm=require('node:vm'),strict=require('node:assert/strict');
const clone=x=>JSON.parse(JSON.stringify(x)),assert=Object.assign((v,m)=>strict(v,m),strict,{deepEqual:(a,b,m)=>strict.deepEqual(clone(a),clone(b),m)});
const fixture=n=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+n+'.json','utf8'));
const seed=fixture('training-input'),uid=fixture('snapshot').userId;
const profile=clone(seed.profile);profile.workouts=[];profile.foods=[
  {id:'drink',date:'2026-10-28',meal:'Snacks',name:'Synthetic drink',grams:500,unit:'ml',kcal:100,p:0,c:25,f:0,nutrients:{vitc:0},unknown:{keep:true}},
  {id:'old',date:'2026-10-28',meal:'Snacks',name:'Old snapshot',grams:100,kcal:99,p:10,c:10,f:2},
  {id:'other-day',date:'2026-10-27',meal:'Snacks',name:'Other day',grams:100,kcal:300,p:20,c:30,f:10}];
profile.custom=[{id:'product',name:'Synthetic product',unit:'g',kcal:200,p:20,c:30,f:0,nutrients:{water:40,vitc:0},density:1.2,
  portions:[{name:'Weighed serving',amount:30,unit:'g',source:'Synthetic fixture'}],favorite:true,extra:{keep:true}}];
profile.recipes=[{id:'recipe',name:'Synthetic recipe',yield:200,ingredients:[{name:'Fixture ingredient',unit:'g',amount:100,kcal:200,p:20,c:30,f:0}],extra:'preserve'}];
delete profile.foodLogCompleted;delete profile.waterGoal;profile.microGoals={water:12};
const input={now:seed.now,profile};
const harness=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("input=fixture('training-input')","input=fixture('nutrition-input')")
  .replace("'training-polish','running'","'food-flow','training-polish','running'")
  .replace("['native-state','native-projection','native-training']","['native-state','native-projection','native-training','native-progress','native-activity','native-nutrition']")
  .replace("['stateBridge','nativeTraining']","['stateBridge','nativeNutrition']");
const compare=(name,value)=>{if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/'+name+'.json',JSON.stringify(value,null,2)+'\n');assert.deepEqual(value,fixture(name),name)};
if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/nutrition-input.json',JSON.stringify(input,null,2)+'\n');
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const start=o=>{const t=app(o);t.ctx.AbortController=AbortController;t.ctx.URLSearchParams=URLSearchParams;
  t.run('date="2026-10-28"');t.start();t.nutrition=()=>t.messages.filter(m=>m.type==='projection'&&m.name==='nutrition').at(-1);return t};
const interest=t=>assert.equal(t.ctx.window.pulsNativeSetInterest({projections:['nutrition']}),true);
let serial=0;const cmd=(op,args)=>({id:'f0000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),userId:uid,baseSeq:0,op,args});
const ok=a=>assert.equal(a.ok,true,JSON.stringify(a)),code=(a,c)=>{assert.equal(a.ok,false,JSON.stringify(a));assert.equal(a.error.code,c,JSON.stringify(a))};
const query=(t,kind,args={})=>{assert.equal(t.ctx.window.pulsNativeNutritionQuery({requestId:'q',kind,...args}),true);return t.messages.filter(x=>x.type==='nutritionResult').at(-1)};
const addArgs=(t,extra={})=>({id:'new-entry',date:'2026-10-28',meal:'Snacks',product:{id:'product'},amount:2,unit:'p0',expect:t.state().custom[0],...extra});
const microtask=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
async function checkP2(){
  const fresh=o=>{const t=app(o);Object.assign(t.ctx,{AbortController,URLSearchParams,URL,fetch:async()=>{throw Error('fixture offline')},
    DOMParser:class{parseFromString(raw){return {querySelectorAll:()=>[...raw.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(x=>({textContent:x[1]}))}}}});
    t.run('date="2026-10-28";navigator.onLine=true;catalogueLoading=Promise.resolve(localCatalogue)');t.start();return t};
  const advance=async(t,ms)=>{t.clock.now+=ms;t.tick(ms);await microtask()};
  const response=(t,id='p2')=>t.messages.filter(x=>x.type==='nutritionResult'&&x.requestId===id).at(-1);
  const ask=(t,kind,args={},id='p2')=>{assert.equal(t.ctx.window.pulsNativeNutritionQuery({requestId:id,kind,...args}),true);return response(t,id)};
  const productArgs=(extra={})=>({kind:'custom',product:{id:'p2-product',name:'Fixture custom',unit:'ml',kcal:200,p:20,c:30,f:0,packageAmount:500},expect:null,confirmWarnings:false,...extra});
  const off={code:'4006381333931',product_name_de:'OFF fixture drink',brands:'Fixture brand',nutriments:{'energy-kcal_100g':200,proteins_100g:20,carbohydrates_100g:30,fat_100g:0},product_quantity:330,product_quantity_unit:'ml',serving_size:'165 ml'};
  let t=fresh(),requests=[];
  t.ctx.fetch=async(url,options)=>{requests.push({url:String(url),options});return {ok:true,json:async()=>({products:[off,{...off,code:'3017620422003',product_name_de:'Synthetic product',brands:''}]})}};
  ask(t,'search',{q:'OFF fixture'});await advance(t,150);assert.equal(response(t).result.phase,'local');assert.equal(requests.length,0);
  await advance(t,299);assert.equal(requests.length,0);await advance(t,1);assert.equal(requests.length,1);let found=response(t);
  assert.equal(found.result.online.status,'ready');assert.equal(found.result.online.items.length,1,'Web local-first name deduplication');assert.equal(found.result.online.items[0].unit,null,'OFF basis remains unknown');
  assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.referrerPolicy,'no-referrer');assert(requests[0].url.includes('page_size=20'));
  compare('nutrition-p2-result-search',found);
  const cold=fresh();let coldFetch=0;cold.run('var resolveCold;catalogueLoading=new Promise(resolve=>{resolveCold=resolve})');
  cold.ctx.fetch=async()=>{coldFetch++;return {ok:true,json:async()=>({products:[off]})}};
  ask(cold,'search',{q:'Synthetic'});await advance(cold,150);assert.equal(response(cold).result.items[0].ref.id,'product');assert.equal(response(cold).result.cataloguePending,true);
  await advance(cold,300);assert.equal(coldFetch,1,'cold catalogue must not delay the OFF timer');assert.equal(response(cold).result.online.status,'ready');
  cold.run('resolveCold([])');await microtask();assert.equal(response(cold).result.phase,'complete');
  ask(t,'product',{product:{barcode:off.code}});await microtask();let draft=response(t).result;assert.equal(draft.reviewRequired,true);assert.equal(requests.length,1,'search draft reused without barcode fetch');
  compare('nutrition-p2-result-off-product',response(t));
  const reviewArgs={kind:'review',product:{id:'off-saved',name:draft.draft.name,unit:'ml',kcal:200,p:20,c:30,f:0,barcode:off.code,packageAmount:330},draft:draft.draft,expect:null,confirmWarnings:false};
  let op=cmd('product.save',reviewArgs);compare('apply-nutrition-product-save',op);let ack=t.apply(op);ok(ack);compare('ack-nutrition-product-save',ack);
  assert.equal(t.state().custom.at(-1).id,'off-saved');assert.equal(t.state().custom.at(-1).packageUnit,'ml');assert.equal(t.state().custom.at(-1).portions[0].amount,165);
  t.store.delete('puls-native-applied');ok(t.apply(op));assert.equal(t.state().custom.filter(x=>x.barcode===off.code).length,1);
  ask(t,'product',{product:{barcode:off.code}});await microtask();assert.equal(response(t).result.expect.id,'off-saved');assert.equal(requests.length,1,'saved barcode first');
  ask(t,'product',{product:{barcode:'4006381333932'}});await microtask();assert.equal(response(t).error.code,'invalid');assert.equal(requests.length,1,'check digit before dispatch');
  ask(t,'search',{q:'OFF fixture'});await advance(t,150);await advance(t,300);assert.equal(requests.length,1,'shared OFF cache');
  t.run('foodSearchCache.clear();foodSearchTimes=Array(10).fill(Date.now())');ask(t,'search',{q:'Rate limited'});await advance(t,150);await advance(t,300);assert.equal(response(t).result.online.status,'rate_limited');assert.equal(requests.length,1);
  await advance(t,60000);assert.equal(requests.length,2,'same request resumes after Web rate-limit quiet period');
  t=fresh();requests=[];t.ctx.fetch=(url,{signal})=>{requests.push(String(url));return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('abort'),{name:'AbortError'})),{once:true}))};
  ask(t,'search',{q:'timeout'});await advance(t,150);await advance(t,300);await advance(t,20000);assert.equal(response(t).result.online.status,'timeout');
  ask(t,'search',{q:'cancelled'},'old-search');await advance(t,150);await advance(t,300);ask(t,'search',{q:'new',online:false},'new-search');await advance(t,150);assert.equal(response(t,'old-search').result.phase,'local');
  ask(t,'product',{product:{barcode:off.code}},'barcode-timeout');await microtask();await advance(t,12000);assert.equal(response(t,'barcode-timeout').error.code,'timeout');
  ask(t,'product',{product:{barcode:'3017620422003'}},'barcode-owner');await microtask();t.run('cloudSession={user:{id:"different"}};cloudStatusChanged()');await microtask();assert.equal(response(t,'barcode-owner'),undefined);
  t=fresh();let dispatches=0;t.ctx.fetch=async()=>{dispatches++;return {status:404,ok:false}};ask(t,'product',{product:{barcode:off.code}});await microtask();assert.equal(response(t).result.missing,true);
  t.run('navigator.onLine=false');ask(t,'product',{product:{barcode:'3017620422003'}});await microtask();assert.equal(response(t).error.code,'offline');assert.equal(dispatches,1);
  t.run('navigator.onLine=true;lookupTimes=Array(12).fill(Date.now())');ask(t,'product',{product:{barcode:'3017620422003'}});await microtask();assert.equal(response(t).error.code,'rate_limited');assert.equal(dispatches,1);
  console.log('PASS P2: OFF debounce/cache/limit/resume/timeout/abort, local dedup, barcode check-digit/local-first/404/offline/owner');

  t=fresh();op=cmd('product.save',productArgs());ok(t.apply(op));let p=t.state().custom.at(-1);assert.equal(p.unit,'ml');assert.equal(p.packageUnit,'ml');assert.equal(p.packageAmount,500);assert.equal(p.id,'p2-product');
  t.store.delete('puls-native-applied');ok(t.apply(op));assert.equal(t.state().custom.length,2);
  code(t.apply(cmd('product.save',productArgs({product:{...productArgs().product,id:'bad',kcal:null}}))),'invalid');
  const warned=productArgs({product:{...productArgs().product,id:'warned',kcal:300}});code(t.apply(cmd('product.save',warned)),'conflict');ok(t.apply(cmd('product.save',{...warned,confirmWarnings:true})));
  let current=t.state().custom[0],oldDiary=clone(t.state().foods);ok(t.apply(cmd('product.save',{kind:'custom',product:{id:'product',name:'Correction',unit:'g',kcal:220,p:25,c:30,f:0},expect:current,confirmWarnings:false})));
  assert.deepEqual(t.state().foods,oldDiary);assert.equal(t.state().custom[0].extra.keep,true);
  code(t.apply(cmd('product.save',{kind:'custom',product:{id:'product',name:'Stale',unit:'g',kcal:220,p:25,c:30,f:0},expect:current,confirmWarnings:false})),'conflict');
  const label={kind:'label',product:{id:'label',name:'Vision fixture',unit:'g',kcal:100,p:10,c:15,f:0,fiber:2},label:{basis:'portion-g',amount:50,column:1,confirmed:true},expect:null,confirmWarnings:false};
  code(t.apply(cmd('product.save',{...label,label:{...label.label,confirmed:false}})),'invalid');const labelOp=cmd('product.save',label);compare('apply-nutrition-label-save',labelOp);
  const labelAck=t.apply(labelOp);ok(labelAck);compare('ack-nutrition-label-save',labelAck);let l=t.state().custom.find(x=>x.id==='label');assert.equal(l.kcal,200);assert.equal(l.nutrients.fiber,4);assert.equal(l.source,'Eigenes Etikett · OCR geprüft');
  // Existing products without a nutrient object must not acquire an invented one through portion/density edits.
  p=t.state().custom.find(x=>x.id==='p2-product');ok(t.apply(cmd('product.extras.set',{product:{id:p.id},water:null,expect:p})));assert.equal(t.state().custom.find(x=>x.id===p.id).nutrients,undefined);
  ok(t.apply(cmd('portion.save',{product:{id:p.id},name:'First',amount:50,expect:p})));
  p=t.state().custom.find(x=>x.id===p.id);assert.equal(p.nutrients,undefined);ok(t.apply(cmd('product.extras.set',{product:{id:p.id},density:1.05,expect:p})));
  p=t.state().custom.find(x=>x.id===p.id);assert.equal(p.nutrients,undefined);ok(t.apply(cmd('portion.delete',{product:{id:p.id},name:'First',expect:p})));
  current=t.state().custom.find(x=>x.id==='p2-product');op=cmd('product.extras.set',{product:{id:current.id},density:1.1,water:80,expect:current});ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));
  p=t.state().custom.find(x=>x.id===current.id);assert.equal(p.density,1.1);assert.equal(p.nutrients.water,80);
  const portion=cmd('portion.save',{product:{id:p.id},name:'Measured cup',amount:150,expect:p});ok(t.apply(portion));t.store.delete('puls-native-applied');ok(t.apply(portion));
  p=t.state().custom.find(x=>x.id===p.id);assert.equal(p.portions.length,1);op=cmd('portion.delete',{product:{id:p.id},name:'Measured cup',expect:p});ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));
  assert.equal(t.state().custom.find(x=>x.id===p.id).portions.length,0);
  // Source portions are display-only until selected/saved; raw expect remains unchanged.
  t.run(`localCatalogue=[{id:'catalog_0',record:'source',name:'Source portion fixture',unit:'g',source:'BLS fixture',kcal:200,p:20,c:30,f:0,nutrients:{}}];portionReferencePromise=Promise.resolve(portionReferences={'BLS fixture:source':[{name:'Source weighed portion',amount:40,unit:'g',source:'Fixture source'}]})`);
  ask(t,'product',{product:{catalogKey:'BLS fixture:source'}});await microtask();const sourced=response(t).result;assert.equal(sourced.units.find(x=>x.key==='p0').snapshot.amount,40);assert.equal(sourced.expect.portions,undefined);
  op=cmd('food.add',{id:'source-entry',product:{catalogKey:'BLS fixture:source'},productId:'source-product',amount:2,unit:'p0',portion:sourced.units.find(x=>x.key==='p0').snapshot,date:'2026-10-28',meal:'Snacks',expect:sourced.expect});
  ok(t.apply(op));assert.equal(t.state().foods.at(-1).grams,80);t.run('portionReferences={}');t.store.delete('puls-native-applied');ok(t.apply(op));
  console.log('PASS P2: custom/review/label saving, explicit warning/basis confirmation, snapshot preservation, portions/density/water and replay');

  t=fresh();const original=t.state().recipes[0],r={...clone(original),id:'new-recipe',name:'Saved recipe'};op=cmd('recipe.save',{recipe:r,expect:null});ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));
  assert.equal(t.state().recipes.filter(x=>x.id===r.id).length,1);ok(t.apply(cmd('recipe.save',{recipe:{...r,name:'Updated'},expect:r})));code(t.apply(cmd('recipe.save',{recipe:{...r,name:'Stale'},expect:r})),'conflict');
  const copied=cmd('recipe.copy',{id:'copy',sourceId:'recipe',expect:original});ok(t.apply(copied));assert.equal(t.state().recipes.find(x=>x.id==='copy').extra,'preserve');
  t.run('state.recipes.find(x=>x.id==="recipe").yield=300');t.store.delete('puls-native-applied');ok(t.apply(copied));
  const del=cmd('recipe.delete',{id:'copy',expect:t.state().recipes.find(x=>x.id==='copy')});ok(t.apply(del));t.store.delete('puls-native-applied');ok(t.apply(del));
  code(t.apply(cmd('recipe.save',{recipe:{...r,yield:0},expect:null})),'invalid');
  const largeRecipe={id:'large-recipe',name:'Hundred ingredients',yield:10000,ingredients:Array.from({length:100},(_,i)=>({name:('Ingredient '+i+' ').padEnd(100,'x'),unit:'g',amount:100,kcal:200,p:20,c:30,f:0}))};
  ok(t.apply(cmd('recipe.save',{recipe:largeRecipe,expect:null})));ok(t.apply(cmd('recipe.save',{recipe:{...largeRecipe,name:'Hundred edited'},expect:largeRecipe})));
  const jsonLd=JSON.stringify({'@context':'https://schema.org','@type':'Recipe',name:'Imported fixture',recipeIngredient:['100 g Synthetic product','2 eggs'],nutrition:{calories:'999 kcal'}});
  const beforeImport=t.state();ask(t,'recipeImport',{jsonLd});await microtask();const imported=response(t);assert.equal(imported.result.websiteNutrientsUsed,false);assert.equal(imported.result.yield,null);assert.deepEqual(t.state(),beforeImport);compare('nutrition-p2-result-import',imported);
  ask(t,'recipeImport',{jsonLd:'{"@type":"Recipe",bad'});await microtask();assert.equal(response(t).error.code,'invalid');
  const saveImport={recipe:{...r,id:'imported',name:'Imported fixture'},expect:null,preview:imported.result.preview,confirmIngredients:true};code(t.apply(cmd('recipe.import.save',{...saveImport,confirmIngredients:false})),'invalid');
  op=cmd('recipe.import.save',saveImport);compare('apply-nutrition-recipe-import-save',op);const importAck=t.apply(op);ok(importAck);compare('ack-nutrition-recipe-import-save',importAck);assert.equal(t.state().recipes.at(-1).importNotes,'100 g Synthetic product\n2 eggs');t.store.delete('puls-native-applied');ok(t.apply(op));
  let importedFetch=0;t.ctx.fetch=async(url,opts)=>{importedFetch++;assert.equal(opts.credentials,'omit');return {ok:true,url,text:async()=>'<html><script type="application/ld+json">'+jsonLd+'</script></html>'}};
  ask(t,'recipeImport',{url:'https://recipes.example/fixture'});await microtask();assert.equal(response(t).result.preview.name,'Imported fixture');assert.equal(importedFetch,1);
  for(const url of ['http://recipes.example','https://user:pass@recipes.example','https://127.0.0.1','https://172.16.0.1','https://[::1]']){ask(t,'recipeImport',{url});await microtask();assert.equal(response(t).error.code,'invalid')}
  assert.equal(importedFetch,1);t.ctx.fetch=async()=>{throw Error('CORS')};ask(t,'recipeImport',{url:'https://recipes.example/blocked'});await microtask();assert.equal(response(t).error.code,'unavailable');
  t.ctx.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}));
  ask(t,'recipeImport',{url:'https://recipes.example/slow'});await advance(t,12000);assert.equal(response(t).error.code,'timeout');
  console.log('PASS P2: recipe save/delete/copy/import stable IDs, conflicts, unknown fields, reviewed preview, ignored website nutrients, URL/CORS');

  t=fresh();const weights=clone(t.state().weights);ask(t,'goals');let context=response(t).result.expect;
  const goalArgs={plan:{mode:'manual',macroMode:'manual'},goals:{kcal:2000,p:150,c:215,f:60},expect:context};op=cmd('goals.set',goalArgs);compare('apply-nutrition-goals-set',op);const goalAck=t.apply(op);ok(goalAck);compare('ack-nutrition-goals-set',goalAck);assert.equal(t.state().goals.kcal,2000);assert.equal(t.state().plan.mode,'manual');assert.deepEqual(t.state().weights,weights,'goal settings never create a measurement');
  assert.equal(t.state().goals.xFutureGoalField,'keep-me');assert.equal(t.state().goalHistory.find(x=>x.date==='2026-10-28').kcal,2000);
  compare('nutrition-p2-result-goals',ask(t,'goals'));
  t.store.delete('puls-native-applied');ok(t.apply(op));code(t.apply(cmd('goals.set',{...goalArgs,goals:{...goalArgs.goals,kcal:2100}})),'invalid');
  ask(t,'goals');context=response(t).result.expect;op=cmd('goals.set',{plan:{mode:'auto',macroMode:'auto',direction:'lose',pace:'medium'},goals:{kcal:2000,p:150,c:215,f:60},expect:context});ok(t.apply(op));
  assert.equal(t.state().plan.mode,'auto');assert.equal(t.state().goals.kcal,t.run('planNumbers({...state.profile,weight:currentWeight()},state.plan).kcal'));assert.deepEqual(t.state().weights,weights);
  t.store.delete('puls-native-applied');ok(t.apply(op));ask(t,'goals');const stale=response(t).result.expect;t.run('state.weights.at(-1).kg=82;save()');code(t.apply(cmd('goals.set',{plan:{mode:'manual'},goals:goalArgs.goals,expect:stale})),'conflict');
  ok(t.apply(cmd('product.save',productArgs())));assert.equal(t.state().goals.xFutureGoalField,'keep-me','unrelated nutrition op preserves extra goal fields through adaptive render');
  const baseline=clone(profile);baseline.profile.kcalMode='baseline';baseline.profile.baselineFactor=1.2;t=fresh({profile:baseline});ask(t,'goals');context=response(t).result.expect;
  ok(t.apply(cmd('goals.set',{plan:{mode:'auto',macroMode:'auto'},goals:goalArgs.goals,expect:context})));assert.equal(t.state().goals.kcal,t.run('dayGoals(today()).kcal'));
  console.log('PASS P2: goals via Web planner, manual/auto/baseline, histories/extensions, conflict and no invented weight');

  for(const operation of ['product.save','recipe.save','recipe.copy','goals.set']){
    t=fresh();let block=true;t.options.failWrite=k=>block&&k==='puls-native-applied';const before=t.state(),raw=t.store.get('puls-v1');let args;
    if(operation==='product.save')args=productArgs();else if(operation==='recipe.save')args={recipe:r,expect:null};else if(operation==='recipe.copy')args={id:'copy',sourceId:'recipe',expect:before.recipes[0]};else{ask(t,'goals');args={...goalArgs,expect:response(t).result.expect}}
    op=cmd(operation,args);code(t.apply(op),'persist_failed');assert.deepEqual(t.state(),before);assert.equal(t.store.get('puls-v1'),raw);block=false;ok(t.apply(op));
  }
  t=fresh();t.run('modal.open=true');code(t.apply(cmd('product.save',productArgs())),'busy');t.run('modal.open=false;stateRecoveryPending=true');code(t.apply(cmd('recipe.save',{recipe:r,expect:null})),'readonly');
  console.log('PASS P2: product/recipe/planner transaction rollback, safe retry, dialog/read-only isolation');
}
(async()=>{
  for(const opts of [{handler:false},{features:['stateBridge']},{features:['nativeNutrition']},{features:['stateBridge','nativeOverview']}]){
    const t=app(opts),before=t.run('[addFood,saveDiaryAmount,deleteSwipeDiary,markFoodDayComplete,pulsSound,toast]');t.start();
    t.run('[addFood,saveDiaryAmount,deleteSwipeDiary,markFoodDayComplete,pulsSound,toast]').forEach((fn,i)=>assert.equal(fn,before[i],'nutrition wrapper absent without feature/handler'));
    assert.equal(t.ctx.window.pulsNativeNutrition,undefined);assert.equal(t.ctx.window.pulsNativeNutritionQuery,undefined);assert(!t.messages.some(m=>m.name==='nutrition'));
    if(t.ctx.window.pulsNativeApply)code(t.apply(cmd('water.add',{})),'unknown_op');
    if(opts.features?.length===1&&opts.features[0]==='stateBridge')assert.deepEqual(t.messages.find(x=>x.type==='hello'),{...fixture('hello'),webVersion:fs.readFileSync('index.html','utf8').match(/js\/native-state\.js\?v=(\d+)/)[1]});
  }
  let t=start();const before=t.state();assert.equal(t.nutrition(),undefined);interest(t);let p=t.nutrition();assert(p);assert.deepEqual(t.state(),before,'projection is read-only');
  compare('nutrition-hello',{...t.messages.find(m=>m.type==='hello'),webVersion:'78'});
  compare('nutrition-projection',p);assert.equal(p.nutrition.micros.vitc.value,0);assert.equal(p.nutrition.micros.calcium.value,null);
  assert.equal(p.nutrition.water.estimated,475);assert.equal(t.state().foods[0].nutrients.water,undefined,'estimated water never persisted');
  assert.equal(p.nutrition.foodLogCompleted,false);assert.equal(p.nutrition.settings.waterGoal,null);
  assert.deepEqual(p.nutrition.totals,t.run('totals()'));assert.equal(p.nutrition.goals.values.kcal,t.run('dayGoals(date).kcal'));
  compare('nutrition-result-product',query(t,'product',{product:{id:'product'}}));
  compare('nutrition-result-recipe',query(t,'recipe',{id:'recipe'}));
  compare('nutrition-result-label',query(t,'labelParse',{text:'Energie 840 kJ / 200 kcal\nFett 0 g\nKohlenhydrate 30 g\nEiweiß 20 g\nBallaststoffe <1 g'}));
  assert.equal(query(t,'entry',{id:'drink'}).result.entry.unknown.keep,true);
  assert.equal(query(t,'product',{product:{id:'absent'}}).error.code,'gone');
  for(const r of [null,{},[],{requestId:'x',kind:'search',q:'a'.repeat(101)},{requestId:'x',kind:'search',q:'x',filter:'off'},
    {requestId:'x',kind:'product',product:{barcode:'4006381333931',id:'product'}},{requestId:'x',kind:'labelParse',text:'x',lines:['x']},
    {requestId:'x',kind:'recipeImport',url:'https://example.com',text:'duplicate'},{requestId:'x',kind:'entry',id:'old',exec:'evil'},
    {requestId:'x',kind:'labelParse',lines:[{text:'x',x:0,y:0}]}])assert.equal(t.ctx.window.pulsNativeNutritionQuery(r),false);
  t.run('render()');t.tick(300);t.run('var builds=0;const buildNativeNutrition=window.pulsNativeNutrition.build;window.pulsNativeNutrition.build=function(){builds++;return buildNativeNutrition()}');
  for(let i=0;i<8;i++){t.run('render();go("food")');t.tick(300)}assert.equal(t.run('builds'),0);
  t.run('save();save()');t.tick(300);assert.equal(t.run('builds'),1);
  t.ctx.window.pulsNativeSetInterest({projections:[]});t.run('state.foods[0].kcal++;save()');t.tick(300);assert.equal(t.run('builds'),1);
  interest(t);assert.equal(t.nutrition().nutrition.totals.kcal,p.nutrition.totals.kcal+1);
  t.run('setDate("2026-10-27")');t.tick(300);assert.equal(t.nutrition().nutrition.entries[0].id,'other-day');
  t.run('var originalDayGoals=dayGoals;dayGoals=function(d){return {...originalDayGoals(d),kcal:9999}};save()');t.tick(300);
  assert.equal(t.nutrition().nutrition.goals.values.kcal,9999,'derived goal changes invalidate the adapter even with unchanged nutrition source data');
  console.log('PASS: nutrition isolation/interest, Web values, unknown vs zero, pure queries, bounded schemas and cache');

  t=start();let a=cmd('food.add',addArgs(t));compare('apply-nutrition-food-add',a);const original=t.state().custom[0];
  let ack=t.apply(a);ok(ack);compare('ack-nutrition-food-add',ack);let x=t.state().foods.at(-1);
  assert.equal(x.id,'new-entry');assert.equal(x.grams,60);assert.equal(x.kcal,120);assert.equal(x.nutrients.water,24);assert.equal(x.nutrients.vitc,0);
  assert.equal(ack.result.effect.grams,x.grams);assert.deepEqual(ack.result.effect.nutrients,x.nutrients);assert.equal(ack.result.effect.loggedAt,x.loggedAt);
  const snapshot=clone(x),count=t.state().foods.length;ok(t.apply(a));assert.equal(t.state().foods.length,count);
  t.store.delete('puls-native-applied');t.run('state.custom[0].kcal=250');ok(t.apply({...a,id:cmd('',{}).id}));assert.deepEqual(t.state().foods.at(-1),snapshot,'lost-history replay uses original snapshot even after product correction');
  code(t.apply(cmd('food.add',addArgs(t,{id:'different',expect:original}))),'conflict');
  let up=cmd('food.update',{id:x.id,amount:120,unit:'g',expect:x});const updateAck=t.apply(up);ok(updateAck);x=t.state().foods.at(-1);assert.equal(x.kcal,240);assert.equal(x.nutrients.water,48);assert.equal(x.nutrients.vitc,0);assert.equal(updateAck.result.effect.kcal,x.kcal);
  t.store.delete('puls-native-applied');ok(t.apply(up));assert.equal(t.state().foods.at(-1).nutrients.water,48,'no double scaling');
  code(t.apply(cmd('food.update',{id:x.id,amount:150,unit:'g',expect:snapshot})),'conflict');
  code(t.apply(cmd('food.update',{id:x.id,amount:150,unit:'ml',expect:x})),'invalid');
  const index=t.state().foods.findIndex(e=>e.id===x.id);let del=cmd('food.delete',{id:x.id,expect:x});ok(t.apply(del));assert(!t.state().foods.some(e=>e.id===x.id));
  assert.equal(t.run('undoDiaryItems.length'),0,'native undo does not contaminate Web undo stack');t.store.delete('puls-native-applied');ok(t.apply(del));
  const restore=cmd('food.restore',{entry:x,index,expect:null});ok(t.apply(restore));assert.deepEqual(t.state().foods[index],x);t.store.delete('puls-native-applied');ok(t.apply(restore));assert.equal(t.state().foods.length,count);
  t.run('state.foods.find(x=>x.id==="new-entry").extra="newer"');code(t.apply(cmd('food.delete',{id:x.id,expect:x})),'conflict');
  t=start();ok(t.apply(cmd('food.add',addArgs(t,{amount:50,unit:'ml'}))));assert.equal(t.state().foods.at(-1).grams,60,'known density is used');
  t=start();t.run('delete state.custom[0].density');code(t.apply(cmd('food.add',addArgs(t,{amount:50,unit:'ml'}))),'invalid');
  ok(t.apply(cmd('food.add',addArgs(t,{product:{recipeId:'recipe'},amount:1,unit:'whole',expect:t.state().recipes[0]}))));
  assert.equal(t.state().foods.at(-1).recipeId,'recipe');assert.equal(t.state().foods.at(-1).kcal,200);assert.equal(t.state().foods.at(-1).nutrients,undefined,'no invented recipe micros');
  const recipeReplay=cmd('food.add',addArgs(t,{product:{recipeId:'recipe'},amount:1,unit:'whole',expect:t.state().recipes[0]}));
  t.run('state.recipes[0].yield=300');t.store.delete('puls-native-applied');ok(t.apply(recipeReplay));assert.equal(t.state().foods.at(-1).grams,200,'recipe replay uses original yield');
  t=start();const canonicalBefore=t.state();let w=cmd('water.add',{id:'water',date:'2026-10-27',ml:330,expect:null});ok(t.apply(w));
  assert.equal(t.run('date'),'2026-10-28');assert.equal(t.state().foods.at(-1).date,'2026-10-27');assert.equal(t.state().foods.at(-1).nutrients.water,330);
  t.store.delete('puls-native-applied');ok(t.apply(w));assert.equal(t.state().foods.length,canonicalBefore.foods.length+1);
  ok(t.apply(cmd('day.complete',{date:'2026-10-27',done:true,expect:false})));assert.deepEqual(t.state().foodLogCompleted,['2026-10-27']);
  ok(t.apply(cmd('day.complete',{date:'2026-10-27',done:true,expect:false})));
  ok(t.apply(cmd('waterGoal.set',{ml:2500,expect:null})));code(t.apply(cmd('waterGoal.set',{ml:2000,expect:null})),'conflict');
  ok(t.apply(cmd('microGoals.set',{goals:{calcium:1000,vitc:0},expect:t.state().microGoals})));assert.deepEqual(t.state().microGoals,{water:12,calcium:1000});
  ok(t.apply(cmd('product.favorite',{product:{id:'product'},favorite:false,expect:t.state().custom[0]})));assert.equal(t.state().custom[0].favorite,false);assert.equal(t.state().custom[0].extra.keep,true);
  for(const [op,args] of [['water.add',{id:'bad',date:'2026-02-30',ml:250,expect:null}],['water.add',{id:'bad',date:'2026-10-28',ml:250}],
    ['food.add',addArgs(t,{amount:0})],['waterGoal.set',{ml:0.2,expect:2500}],['microGoals.set',{goals:{invented:1},expect:{}}],
    ['day.complete',{date:'2026-10-28',done:true}],['food.restore',{entry:{id:'bad'},index:0,expect:null}]])code(t.apply(cmd(op,args)),'invalid');
  console.log('PASS: food snapshots/add/edit/delete/restore, replay without history, density/units, recipe use, water/day/goals/favorite');

  for(const failKey of ['puls-v1','puls-native-applied','puls-native-seq']){
    t=start();let enabled=false;t.options.failWrite=k=>enabled&&k===failKey;
    const old=t.state(),raw=t.store.get('puls-v1'),native=t.native.length;enabled=true;
    const command=cmd('food.add',addArgs(t));code(t.apply(command),'persist_failed');assert.deepEqual(t.state(),old);assert.equal(t.store.get('puls-v1'),raw);assert.equal(t.native.length,native);
    enabled=false;ok(t.apply(command));assert.equal(t.state().foods.filter(e=>e.id==='new-entry').length,1);
  }
  const feedback=app({features:['stateBridge','nativeNutrition','haptics']}),timeline=[];
  feedback.run(fs.readFileSync('js/haptics.js','utf8'));
  for(const handler of ['pulsState','pulsNative']){const h=feedback.ctx.window.webkit.messageHandlers[handler],send=h.postMessage;h.postMessage=m=>{if(m.type==='ack')timeline.push('ack:'+m.ok);if(m.type==='haptic')timeline.push('haptic');send(m)}}
  feedback.start();let blockHistory=true;feedback.options.failWrite=k=>blockHistory&&k==='puls-native-applied';
  const deleteFeedback=cmd('food.delete',{id:'drink',expect:feedback.state().foods[0]});code(feedback.apply(deleteFeedback),'persist_failed');assert.deepEqual(timeline,['ack:false']);
  blockHistory=false;ok(feedback.apply(deleteFeedback));assert.deepEqual(timeline,['ack:false','ack:true','haptic'],'exactly one feedback only after confirmed ack');
  t=start();const raw=t.state();t.run('var nativeSoundCalls=0;pulsSound=function(){nativeSoundCalls++}');
  t.run('modal.open=true');code(t.apply(cmd('water.add',{id:'water',date:'2026-10-28',ml:250,expect:null})),'busy');assert.deepEqual(t.state(),raw);
  t.run('modal.open=false;calendarEditing=function(){return true}');code(t.apply(cmd('waterGoal.set',{ml:0,expect:null})),'busy');
  for(const o of [{preview:true},{features:['stateBridge','nativeNutrition']}]){
    const r=start(o);if(!o.preview)r.run('stateRecoveryPending=true');code(r.apply(cmd('waterGoal.set',{ml:0,expect:null})),'readonly');interest(r);assert(r.nutrition());
  }
  t=start();const wrong=cmd('waterGoal.set',{ml:0,expect:null});wrong.userId='other';code(t.apply(wrong),'wrong_user');
  t.run('cloudSession={user:{id:"other"}};cloudStatusChanged()');code(t.apply(cmd('waterGoal.set',{ml:0,expect:null})),'not_ready');assert.equal(t.ctx.window.pulsNativeNutritionQuery({requestId:'q',kind:'entry',id:'old'}),false);
  console.log('PASS: persist/history/sequence failure rollback, busy/readonly, owner/user isolation');

  t=start();t.run('catalogueLoading=Promise.resolve(localCatalogue);navigator.onLine=false');
  assert.equal(t.ctx.window.pulsNativeNutritionQuery({requestId:'first',kind:'search',q:'Synthet'}),true);
  assert.equal(t.ctx.window.pulsNativeNutritionQuery({requestId:'latest',kind:'search',q:'Synthetic'}),true);
  t.tick(150);await microtask();let answer=t.messages.filter(m=>m.type==='nutritionResult').at(-1);assert.equal(answer.requestId,'latest');assert.equal(answer.result.offline,true);assert.equal(answer.result.online.supported,true);assert.equal(answer.result.online.status,'offline');
  assert.equal(answer.result.items[0].ref.id,'product');compare('nutrition-result-search',answer);
  const results=t.messages.filter(m=>m.type==='nutritionResult').length;
  t.ctx.window.pulsNativeNutritionQuery({requestId:'stale',kind:'search',q:'product'});t.event('window','pagehide');t.tick(150);await microtask();assert.equal(t.messages.filter(m=>m.type==='nutritionResult').length,results);
  t.event('window','pageshow',{persisted:true});t.ctx.window.pulsNativeNutritionQuery({requestId:'stale-save',kind:'search',q:'product'});t.run('save()');t.tick(150);await microtask();assert.equal(t.messages.filter(m=>m.type==='nutritionResult').length,results);
  t.ctx.window.pulsNativeNutritionQuery({requestId:'stale-owner',kind:'search',q:'product'});
  t.run('cloudSession={user:{id:"other"}};cloudStatusChanged();cloudSession={user:{id:'+JSON.stringify(uid)+'}};cloudStatusChanged()');t.tick(150);await microtask();
  assert.equal(t.messages.filter(m=>m.type==='nutritionResult').length,results,'transient switch back to same user still cancels old requests');
  // Worker response keys are namespaced, shared Web serial is not changed. Worker transport is mocked only.
  t=start();t.run(`localCatalogue=[{id:'catalog_0',record:'fixture',name:'Synthetic raw',alias:'',search:'synthetic raw',unit:'g',source:'BLS fixture',kcal:100,p:10,c:15,f:0,nutrients:{vitc:0}}];catalogueLoading=Promise.resolve(localCatalogue);
    var calls=[];startCatalogueWorker=async()=>true;queryCatalogueAsync=async(q,id)=>{calls.push(id);return {indices:[0],count:1}}`);
  const serialBefore=t.run('catalogueQuerySerial');t.ctx.window.pulsNativeNutritionQuery({requestId:'catalog',kind:'search',q:'Synthetic'});t.tick(150);await microtask();assert.equal(t.run('catalogueQuerySerial'),serialBefore);assert(t.run('calls[0].startsWith("nativeNutrition:")'));
  t.run('portionReferences["BLS fixture:fixture"]=[]');
  const cp=query(t,'product',{product:{catalogKey:'BLS fixture:fixture'}});assert.equal(cp.result.newCatalogProduct,true);
  const ca=cmd('food.add',{id:'catalog-entry',product:{catalogKey:'BLS fixture:fixture'},productId:'catalog-product',date:'2026-10-28',meal:'Snacks',amount:100,unit:'g',expect:cp.result.expect});
  ok(t.apply(ca));assert.equal(t.state().foods.at(-1).foodRef,'catalog-product');assert.equal(t.state().custom.at(-1).catalogKey,'BLS fixture:fixture');t.store.delete('puls-native-applied');ok(t.apply(ca));
  console.log('PASS: debounced stale query cancellation, offline results, shared Web worker namespace, stable catalog product IDs');

  const nutrientKeys=t.run('Object.keys(nutrientLabels)'),big=clone(profile);big.foods=Array.from({length:600},(_,i)=>({...clone(profile.foods[0]),id:'entry-'+i,name:'x'.repeat(255)+'😀',nutrients:Object.fromEntries(nutrientKeys.map((k,j)=>[k,j]))}));
  t=start({profile:big});interest(t);p=t.nutrition().nutrition;assert(JSON.stringify(p).length<=48*1024);assert(p.omitted.entries>0);assert.equal(p.entryCount,600);assert.equal(p.totals.kcal,60000);assert.equal(t.state().foods.length,600);
  assert(t.run('validData(state)'),'large fixture passes full Web validator');
  t=start();t.run('state.foods[0].largeUnknown="x".repeat(26000)');let large=query(t,'entry',{id:'drink'});assert.equal(large.result.canRestore,false);
  code(t.apply(cmd('food.delete',{id:'drink',expect:large.result.entry})),'invalid');assert(t.state().foods.some(x=>x.id==='drink'),'never delete a snapshot too large for native undo');
  t.run('state.foods[0].largeUnknown="x".repeat(60000)');assert.equal(query(t,'entry',{id:'drink'}).error.code,'too_large');
  const noRecipes=clone(profile);delete noRecipes.recipes;t=start({profile:noRecipes});interest(t);query(t,'recipe',{id:'missing'});assert.equal(t.state().recipes,undefined,'legacy optional recipes stay absent on read');
  const perf=clone(profile);perf.foods=Array.from({length:1500},(_,i)=>({...clone(profile.foods[i%3]),id:'perf-'+i}));
  const measured=start({profile:perf}),clock=require('node:perf_hooks').performance;let began=clock.now();interest(measured);const cold=clock.now()-began;
  began=clock.now();measured.run('window.pulsNativeNutrition.build()');const warm=clock.now()-began;
  console.log(`PERF (Node VM, 1500 valid foods): projection cold ${cold.toFixed(2)} ms, unchanged adapter ${warm.toFixed(2)} ms; ordinary renders do not build.`);
  console.log('PASS: projection budget/truncation, complete totals, Unicode and legacy profiles');
  console.log('PASS: M7/P1 native nutrition (VM; no live RLS, actual Worker/browser layout, camera or Vision proof)');
  await checkP2();
})().catch(e=>{console.error(e);process.exit(1)});
