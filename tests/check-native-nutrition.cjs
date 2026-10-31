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
    {requestId:'x',kind:'product',product:{barcode:'4006381333931'}},{requestId:'x',kind:'labelParse',text:'x',lines:['x']},
    {requestId:'x',kind:'recipeImport',url:'https://example.com'},{requestId:'x',kind:'entry',id:'old',exec:'evil'},
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
  t.tick(150);await microtask();let answer=t.messages.filter(m=>m.type==='nutritionResult').at(-1);assert.equal(answer.requestId,'latest');assert.equal(answer.result.offline,true);assert.equal(answer.result.online.supported,false);
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
})().catch(e=>{console.error(e);process.exit(1)});
