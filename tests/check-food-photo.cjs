// Synthetic images/profiles and mocked Auth/Gemini only. No production credentials/network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const sample={name:'Reis mit Hähnchen',grams:400,kcal:620,p:40,c:70,f:20,components:['Reis','Hähnchen','Öl'],uncertainty:'high',kcalMin:450,kcalMax:800,gramsMin:300,gramsMax:500,note:'Öl und Portionsgröße sind unsicher.'};
const jpeg=Buffer.from([255,216,255,217]).toString('base64');
const clone=x=>JSON.parse(JSON.stringify(x));
function server(options={}){
 const calls=[],exports={};
 let source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/food-photo/index.ts','utf8'))
  .replaceAll('export ','');assert(!source.includes('import.meta'));assert(source.includes("typeof Deno !== 'undefined'"));
 vm.runInNewContext(source+';Object.assign(exports,{createHandler,validEstimate,responseSchema})',{exports,Request,Response,TextDecoder,AbortSignal,atob,fetch:()=>{throw Error('Unexpected real fetch')}});
 const fetcher=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return Response.json(options.user??{id:'synthetic-user'}, {status:options.authStatus||200});
  if(url.includes('/rpc/'))return Response.json(options.quota??true,{status:options.quotaStatus||200});
  if(options.throw)throw Error('mock');
  if(options.providerStatus)return Response.json({error:'private upstream detail'},{status:options.providerStatus});
  return Response.json({candidates:[{finishReason:options.finish||'STOP',content:{parts:[{text:JSON.stringify({recognized:true,...(options.estimate??sample)})}]}}]});
 };
 const env=k=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-public',GEMINI_API_KEY:'fixture-not-a-real-key',...options.env})[k];
 const handler=exports.createHandler(env,fetcher);
 const request=(changes={},headers={},method='POST')=>handler(new Request('https://fixture.supabase.co/functions/v1/food-photo',{
  method,headers:{Origin:'https://selvirtnj.github.io',Authorization:'Bearer fixture-not-a-token','Content-Type':'application/json',...headers},
  ...(method==='POST'?{body:JSON.stringify({image:jpeg,mimeType:'image/jpeg',text:'Reis, Hähnchen, Öl',language:'de',...changes})}:{})
 }));
 return {request,calls,exports,handler};
}
let harness=fs.readFileSync('tests/app-harness.cjs','utf8')
 .replace('const {ctx,run,el}=test,','ctxConfig(test);const {ctx,run,el}=test,');
const app=vm.runInNewContext('(function(require,ctxConfig){'+harness+';return app})(require,ctxConfig)',{require,console,ctxConfig(test){test.ctx.window.PULS_CLOUD={url:'https://fixture.supabase.co',publicKey:'sb_publishable_fixture_public_configuration'};}});
function client(){
 const t=app({handler:false,features:[]}),c=t.ctx;let calls=0,reply=()=>({ok:true,status:200,json:async()=>({estimate:clone(sample)})});
 c.AbortController=AbortController;c.fetch=async(...args)=>{calls++;return reply(...args)};
 c.URL={createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}};
 c.Image=class{naturalWidth=2048;naturalHeight=1536;set src(value){queueMicrotask(()=>this.onload())}};
 const dimensions=[];c.document.createElement=tag=>tag==='canvas'?{getContext:()=>({fillRect(){},drawImage(){}}),toDataURL(){dimensions.push([this.width,this.height]);return 'data:image/jpeg;base64,'+jpeg}}:{};
 t.run('var englishUI={};cloudFreshSession=async function(){};cloudSession={user:{id:"synthetic-user"},access_token:"fixture-not-a-token"};');
 t.run(fs.readFileSync('js/food-flow.js','utf8'));t.run(fs.readFileSync('js/food-photo.js','utf8'));
 t.el('foodbody').insertAdjacentHTML=(where,html)=>t.el('foodbody').innerHTML+=html;
 for(const id of ['barcode-camera','foodpreview'])t.el(id).classList.contains=()=>false;
 t.el('ff-torch').setAttribute=()=>{};
 c.navigator.onLine=true;t.el('modal').open=true;
 const open=()=>{t.el('modal').open=true;c.window.foodPhotoOpen();t.el('food-photo-text').value='Reis, Hähnchen, Öl';};
 const read=()=>c.window.foodPhotoRead({type:'image/jpeg',size:4});
 const form=(changes={})=>{const values={...sample,...changes};for(const k of ['grams','kcal','p','c','f','name'])t.el('food-photo-'+k).value=String(values[k]);t.el('food-photo-confirm').checked=true;t.el('meal').value='Snacks';};
 return {...t,c,open,read,form,dimensions,calls:()=>calls,reply:fn=>reply=fn};
}
(async()=>{
 let s=server(),response=await s.request();assert.equal(response.status,200);assert.deepEqual((await response.json()).estimate,sample);
 assert.equal(s.calls.length,3);const upstream=JSON.parse(s.calls[2].init.body);assert(upstream.generationConfig.responseJsonSchema.required.includes('uncertainty'));assert.equal(upstream.generationConfig.responseJsonSchema.properties.kcal.type,'number');assert(!('responseSchema' in upstream.generationConfig));assert.equal(upstream.generationConfig.responseMimeType,'application/json');assert.equal(upstream.generationConfig.thinkingConfig.thinkingLevel,'LOW');assert(s.calls[2].url.includes('gemini-3.8-flash:generateContent'));assert.equal(s.calls[0].init.headers.apikey,'fixture-public');
 assert(!JSON.stringify(s.calls[2].init).includes('fixture-not-a-token'),'user JWT never reaches Google');
 s=server({env:{GEMINI_MODEL:'gemini-2.5-flash'}});assert.equal((await s.request()).status,200);assert(!('thinkingConfig' in JSON.parse(s.calls[2].init.body).generationConfig),'no thinkingLevel on older models');
 s=server();assert.equal((await s.request({}, {apikey:'sb_publishable_fixture_public_configuration'})).status,200);assert.equal(s.calls[0].init.headers.apikey,'sb_publishable_fixture_public_configuration');
 s=server();assert.equal((await s.request({}, {apikey:'not-a-public-key'})).status,200);assert.equal(s.calls[0].init.headers.apikey,'fixture-public');
 s=server({estimate:{...sample,recognized:false}});let noFood=await s.request();assert.equal(noFood.status,422);assert.equal((await noFood.json()).error,'no_food');
 s=server({env:{GEMINI_MODEL:'gemini-x; drop'}});assert.equal((await s.request()).status,503);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://selvirtnj.github.io');assert.equal(response.headers.get('Cache-Control'),'no-store');
 for(const [options,status] of [[{authStatus:401},401],[{quota:false},429],[{quotaStatus:403},503],[{providerStatus:429},429],[{providerStatus:500},502],[{finish:'SAFETY'},422],[{estimate:{...sample,kcal:-1}},422],[{estimate:{...sample,grams:0}},422],[{estimate:{...sample,p:999}},422],[{env:{GEMINI_API_KEY:''}},503],[{throw:true},502]])assert.equal((await server(options).request()).status,status);
 s=server();assert.equal((await s.request({}, {Origin:'https://untrusted.example'})).status,403);assert.equal(s.calls.length,0);assert.equal((await s.request({}, {Authorization:''})).status,401);assert.equal(s.calls.length,0);
 for(const changes of [{image:'A'.repeat(1400001)},{image:'AAAA'},{text:'x'.repeat(1201)},{mimeType:'image/png'},{language:'fr'}])assert.equal((await server().request(changes)).status,400);
 s=server();assert.equal((await s.request({}, {},'OPTIONS')).status,204);assert.equal(s.calls.length,0);
 assert.equal((await server().request({}, {Origin:'http://127.0.0.1:4173'})).status,200);
 s=server({estimate:{...sample,privateExtra:'must not be relayed'}});assert(!('privateExtra' in (await (await s.request()).json()).estimate));
 console.log('PASS photo server: Auth/origin/preflight, bounded JPEG/text, quota/fail-closed/provider errors, schema/response validation and explicit projection (mock fetch only)');

 let t=client(),before=JSON.stringify(t.state());t.open();assert(t.el('foodbody').innerHTML.includes('Google Gemini'));assert(t.el('foodbody').innerHTML.includes('Was ist drin?'));
 await t.read();assert.deepEqual(t.dimensions,[[1024,768]]);assert.equal(t.el('food-photo-preview').hidden,false);
 await t.c.window.foodPhotoSend();assert(t.el('food-photo-review').innerHTML.includes('foodPhotoConfirm'));assert(t.el('food-photo-review').innerHTML.includes('450–800'));assert.equal(JSON.stringify(t.state()),before,'no save before explicit confirmation');
 t.form({grams:350,kcal:555,p:35,c:60,f:19});t.el('food-photo-confirm').checked=false;t.c.window.foodPhotoConfirm({preventDefault(){}});assert.equal(JSON.stringify(t.state()),before);
 t.el('food-photo-confirm').checked=true;t.c.window.foodPhotoConfirm({preventDefault(){}});
 let item=t.state().foods.at(-1);assert.equal(item.kcal,555);assert.equal(item.grams,350);assert.equal(item.p,35);assert.equal(item.aiEstimate,true);assert.equal(item.source,'KI-Schätzung · Google Gemini');assert(!item.nutrients||!Object.keys(item.nutrients).length);assert(t.run('validData(state)'));assert(t.run('validData(JSON.parse(JSON.stringify(state)))'));
 const after=t.state();assert.equal(JSON.stringify(after.workouts),JSON.stringify(JSON.parse(before).workouts),'workout/exercise IDs retained');
 t.run('state.foods.at(-1).aiEstimate="yes"');assert(!t.run('validData(state)'));t.run('state.foods.at(-1).aiEstimate=true;state.foods.at(-1).nutrients={vitc:1}');assert(!t.run('validData(state)'));
 assert(!JSON.stringify(after).includes('base64'));assert(!JSON.stringify(after).includes('Reis, Hähnchen, Öl'));
 console.log('PASS photo client: bounded EXIF-free canvas path, editable whole-meal values, explicit confirmation, real addFood snapshot/provenance chain, no micros/photo/text persistence, legacy/new validation and IDs');

 for(const language of ['de','en']){
  t=client();t.run('state.language='+JSON.stringify(language));t.open();
  t.c.navigator.onLine=false;await t.c.window.foodPhotoSend();assert.match(t.el('food-photo-status').textContent,language==='de'?/Internetverbindung/:/internet connection/);assert.equal(t.calls(),0);
  t.c.navigator.onLine=true;t.run('cloudSession=null');t.open();await t.c.window.foodPhotoSend();assert.match(t.el('food-photo-status').textContent,language==='de'?/anmelden/:/Sign in/);assert.equal(t.calls(),0);
 }
 for(const [status,pattern] of [[401,/Anmeldung abgelaufen/],[404,/nicht eingerichtet/],[429,/Limit/],[503,/nicht eingerichtet/],[422,/Kein Essen erkannt/],[502,/Keine gültige/]]){t=client();t.open();await t.read();t.reply(async()=>({ok:false,status}));await t.c.window.foodPhotoSend();assert.match(t.el('food-photo-status').textContent,pattern);assert(!t.el('food-photo-send').disabled);assert(!t.el('food-photo-review').innerHTML)}
 t=client();t.open();await t.read();t.reply(async()=>{throw new TypeError('network')});await t.c.window.foodPhotoSend();assert.match(t.el('food-photo-status').textContent,/Keine gültige/);assert(!t.el('food-photo-send').disabled);
 t=client();t.open();await t.read();t.reply(async()=>({ok:true,json:async()=>({estimate:{...sample,kcal:'unknown'}})}));await t.c.window.foodPhotoSend();assert(!t.el('food-photo-review').innerHTML);assert.match(t.el('food-photo-status').textContent,/Keine gültige/);
 t=client();t.open();await t.read();await t.c.window.foodPhotoSend();t.el('food-photo-text').value+=' 10 g Öl';await t.c.window.foodPhotoSend();assert.equal(t.calls(),2);
 for(const change of ['cloudSession={user:{id:"other"}}','state={...state}','date="2026-01-01"',"foodTab('search')"]){
  t=client();t.open();await t.read();let finish;t.reply(()=>new Promise(resolve=>finish=resolve));let op=t.c.window.foodPhotoSend();await Promise.resolve();await Promise.resolve();t.run(change);finish({ok:true,json:async()=>({estimate:sample})});await op;assert.equal(t.el('food-photo-review').innerHTML,'','late reply ignored: '+change);
 }
 console.log('PASS photo client: DE/EN offline/no-account, limit/auth/setup/malformed responses, retry and account/profile/date/tab stale-response guards');
 const sql=fs.readFileSync('backend/food-photo.sql','utf8');assert(sql.includes('auth.uid()'));assert(sql.includes('on conflict (user_id) do update'));assert(sql.includes('enable row level security'));assert(!sql.includes('puls_profiles'));
 // These are source assertions, not a live SQL/RLS or Swift compilation/device test.
 const swift=fs.readFileSync('ios/PULS/BarcodeScanner.swift','utf8');assert(swift.includes('device.hasTorch'));assert(swift.includes('flashlight.on.fill'));assert(swift.includes('flashlight.off.fill'));assert(swift.includes('turnTorchOff()'));assert(swift.includes('isTorchModeSupported(.on)'));assert.equal((swift.match(/turnTorchOff\(\)/g)||[]).length,3,'torch off on fallback and finish');
 const photo=fs.readFileSync('js/food-photo.js','utf8');assert(!photo.includes('id="meal"'),'meal comes from the open food sheet, no duplicate #meal');
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');assert(html.indexOf('js/food-flow.js')<html.indexOf('js/food-photo.js'));assert(sw.includes('"js/food-photo.js"'));
 console.log('PASS photo/scanner source guards: separate atomic quota migration and native hardware/cleanup controls; live SQL, Swift build and device checks remain separate');
})().catch(error=>{console.error(error);process.exitCode=1});
