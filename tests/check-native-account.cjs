// M8/R: synthetic VM profiles only. No device, credentials, network or live backend.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
const fixture=name=>JSON.parse(fs.readFileSync('tests/fixtures/native-bridge/'+name+'.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),uid=fixture('snapshot').userId;
const source=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0]
  .replace("input=fixture('training-input')","input=fixture('account-input')")
  .replace("'training-polish','running'","'food-flow','training-polish','running'")
  .replace('for(const file of files)',"ctx.window.PULS_CLOUD={url:'https://fixture.supabase.co',publicKey:'sb_publishable_synthetic_fixture_only'};for(const file of files)")
  .replace("run('var englishUI={}')","run(fs.readFileSync('js/i18n.js','utf8'))")
  .replace("run('var setAppLanguage=function(){},chooseAppIcon=function(){}')","run('var chooseAppIcon=function(){}')")
  .replace("['native-state','native-projection','native-training']","['native-state','native-projection','native-training','native-progress','native-activity','native-nutrition','native-account']")
  .replace("['stateBridge','nativeTraining']","['stateBridge','nativeAccount','nativeNutrition']");
const compare=(name,value)=>{if(process.argv.includes('--write-fixtures'))fs.writeFileSync('tests/fixtures/native-bridge/'+name+'.json',JSON.stringify(value,null,2)+'\n');assert.deepEqual(value,fixture(name),name)};
if(process.argv.includes('--write-fixtures')){const input=fixture('nutrition-input');input.profile.measurements=[{id:'fixture-measure',date:'2026-10-27',neck:40,waist:95,bodyfat:23,extra:'preserve'}];input.profile.displayName='Fixture';compare('account-input',input)}
const app=vm.runInNewContext('(function(require){'+source+';return app})(require)',{require,console});
function start(o={}){const t=app(o);t.ctx.document.documentElement.setAttribute=()=>{};for(const id of ['barcode-camera','ff-torch']){t.el(id).classList.contains=()=>false;t.el(id).setAttribute=()=>{}}t.run(fs.readFileSync('js/color-scheme.js','utf8'));
  t.run('date="2026-10-28"');if(o.local)t.run('cloudSession=null');t.start();return t}
const interest=t=>assert.equal(t.ctx.window.pulsNativeSetInterest({projections:['account']}),true);
const projection=t=>t.messages.filter(x=>x.type==='projection'&&x.name==='account').at(-1);
const ask=t=>{assert.equal(t.ctx.window.pulsNativeAccountQuery({requestId:'planner',kind:'planner'}),true);return t.messages.filter(x=>x.type==='accountResult').at(-1).result.expect};
let serial=0;const cmd=(op,args)=>({id:'a0000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),userId:uid,baseSeq:0,op,args});
const ok=a=>assert.equal(a.ok,true,JSON.stringify(a)),code=(a,c)=>{assert.equal(a.ok,false,JSON.stringify(a));assert.equal(a.error.code,c,JSON.stringify(a))};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function mockImages(t){
  let pending=[],draws=0;
  t.ctx.Image=class{constructor(){pending.push(this);this.width=800;this.height=600}set src(v){this.source=v}};
  t.ctx.FileReader=class{};
  const create=t.ctx.document.createElement;
  t.ctx.document.createElement=function(tag){if(tag!=='canvas')return create(tag);return {width:0,height:0,getContext:()=>({drawImage(img,...args){draws++;assert.equal(img.source,'data:image/png;base64,QUJD');assert.deepEqual(args,[100,0,600,600,0,0,160,160])}}),toDataURL(type,q){assert.equal(type,'image/jpeg');assert.equal(q,.85);return 'data:image/jpeg;base64,REVG'}}};
  return {complete(){const jobs=pending;pending=[];for(const img of jobs)img.onload()},get draws(){return draws}};
}
(async()=>{
  for(const opts of [{handler:false},{features:['stateBridge']},{features:['stateBridge','nativeNutrition']},{features:['nativeAccount']}]){
    const t=start(opts);assert.equal(t.ctx.window.pulsNativeAccount,undefined);assert.equal(t.ctx.window.pulsNativeAccountQuery,undefined);assert.equal(projection(t),undefined);
    if(opts.handler!==false&&opts.features.includes('stateBridge'))assert.equal(t.messages[0].ops.includes('profile.name.set'),false);
  }
  let t=start();assert.equal(projection(t),undefined,'account requires interest');let hello=t.messages.find(x=>x.type==='hello');assert(hello.features.includes('nativeAccount'));assert(hello.ops.includes('plan.set'));compare('account-hello',hello);
  interest(t);compare('account-projection',projection(t));const initial=projection(t).account;
  assert.equal(initial.identity.displayName,'Fixture');assert.equal(initial.body.bodyFat.estimated,false);assert.equal(initial.body.bodyFat.value,23);
  assert.equal(initial.cloud.email,undefined);assert.equal(initial.identity.email,undefined);
  t.run('render()');t.tick(300);let builds=0;const build=t.ctx.window.pulsNativeAccount.build;t.ctx.window.pulsNativeAccount.build=(...a)=>{builds++;return build(...a)};
  for(let i=0;i<20;i++)t.run('render()');t.tick(300);assert.equal(builds,0,'pure renders do not rebuild');
  t.run('state.avatarImage="data:image/jpeg;base64,"+"A".repeat(25000);save()');t.tick(300);assert.equal(projection(t).account.identity.avatarImage,null);assert.equal(projection(t).account.identity.avatarOmitted,true);
  t=start();interest(t);let op=cmd('profile.name.set',{name:'  New fixture  ',expect:'Fixture'});compare('apply-account-name',op);const ack=t.apply(op);ok(ack);compare('ack-account-name',ack);assert.equal(t.state().displayName,'New fixture');
  t.store.delete('puls-native-applied');ok(t.apply(op));code(t.apply(cmd('profile.name.set',{name:'Old edit',expect:'Fixture'})),'conflict');
  const beforeWeight=clone(t.state().weights),unknown=clone(t.state().custom);let context=ask(t);compare('account-result-planner',t.messages.filter(x=>x.type==='accountResult').at(-1));
  op=cmd('profile.set',{profile:{height:181,kcalMode:'baseline',baselineFactor:1.3},expect:context});compare('apply-account-profile',op);const profileAck=t.apply(op);ok(profileAck);compare('ack-account-profile',profileAck);assert.equal(t.state().profile.height,181);assert.equal(t.state().profile.kcalMode,'baseline');assert.deepEqual(t.state().weights,beforeWeight);assert.deepEqual(t.state().custom,unknown);
  t.store.delete('puls-native-applied');ok(t.apply(op));code(t.apply(cmd('profile.set',{profile:{height:183},expect:context})),'conflict');
  code(t.apply(cmd('profile.set',{profile:{weight:99},expect:ask(t)})),'invalid');
  context=ask(t);op=cmd('plan.set',{plan:{mode:'manual',macroMode:'manual'},goals:{kcal:2000,p:150,c:215,f:60},expect:context});ok(t.apply(op));assert.equal(t.state().goals.kcal,2000);assert.equal(t.state().goals.xFutureGoalField,'keep-me');t.store.delete('puls-native-applied');ok(t.apply(op));
  op=cmd('adaptive.set',{adaptive:false,learnTdee:false,expect:ask(t)});ok(t.apply(op));assert.equal(t.state().plan.adaptive,false);t.store.delete('puls-native-applied');ok(t.apply(op));assert.deepEqual(t.state().weights,beforeWeight);
  const alone=start({features:['stateBridge','nativeAccount']});assert.equal(alone.messages[0].ops.includes('plan.set'),false);ok(alone.apply(cmd('profile.name.set',{name:'Standalone',expect:'Fixture'})));
  console.log('PASS account: gating, interest/cache, bounded avatar, name/profile/planner/adaptive and replay without invented weights');

  t=start();let row=t.state().measurements[0];op=cmd('measurements.save',{id:row.id,date:row.date,values:{neck:41},expect:row});ok(t.apply(op));assert.equal(t.state().measurements[0].waist,95);assert.equal(t.state().measurements[0].extra,'preserve');t.store.delete('puls-native-applied');ok(t.apply(op));
  code(t.apply(cmd('measurements.save',{id:row.id,date:row.date,values:{neck:42},expect:row})),'conflict');
  op=cmd('measurements.save',{id:'new-measurement',date:'2026-10-28',values:{waist:92,neck:39},expect:null});compare('apply-account-measurements',op);ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));assert.equal(t.state().measurements.length,2);
  interest(t);assert.equal(projection(t).account.body.bodyFat.estimated,true);assert.equal(projection(t).account.body.bodyFat.date,'2026-10-28');
  code(t.apply(cmd('measurements.save',{id:'future',date:'2026-10-29',values:{waist:92},expect:null})),'invalid');
  code(t.apply(cmd('measurements.save',{id:'bad',date:'2026-02-30',values:{neck:10},expect:null})),'invalid');
  row=t.state().measurements[1];op=cmd('measurements.delete',{id:row.id,expect:row});ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));assert.equal(t.state().measurements.length,1);assert.equal(t.run('modal.open'),false);
  t.run('state.measurements=[{id:"old",date:"2026-10-20",neck:40},{id:"other",date:"2026-10-21",waist:95}];save()');interest(t);assert.equal(projection(t).account.body.bodyFat,null,'Navy never combines dates');
  console.log('PASS account: measurement merge/delete/IDs/unknown fields, Navy/manual current-vs-history, invalid dates');

  t=start();op=cmd('appearance.set',{scheme:'light',language:'en',expect:{scheme:'system',language:'de'}});compare('apply-account-appearance',op);const appearanceAck=t.apply(op);ok(appearanceAck);compare('ack-account-appearance',appearanceAck);assert.equal(t.store.get('puls-color-scheme'),'light');assert.equal(t.state().language,'en');assert.equal(t.run('modal.open'),false);t.store.delete('puls-native-applied');ok(t.apply(op));
  code(t.apply(cmd('appearance.set',{scheme:'dark',expect:{scheme:'system',language:'de'}})),'conflict');
  op=cmd('sound.set',{enabled:false,volume:50,expect:{enabled:true,volume:0.6}});ok(t.apply(op));t.store.delete('puls-native-applied');ok(t.apply(op));assert.equal(t.state().soundEnabled,false);assert.equal(t.state().soundVolume,50);
  code(t.apply(cmd('sound.set',{enabled:true,volume:71,expect:{enabled:false,volume:50}})),'invalid');
  for(const key of ['puls-v1','puls-native-applied','puls-native-seq','puls-color-scheme']){
    let fail=false;const r=start({failWrite:k=>fail&&k===key}),before=r.store.get('puls-v1');fail=true;
    code(r.apply(cmd('appearance.set',{scheme:'dark',language:'en',expect:{scheme:'system',language:'de'}})),'persist_failed');
    assert.equal(r.store.get('puls-v1'),before);assert.equal(r.run('getColorScheme()'),'system');assert.equal(r.state().language,'de');assert.equal(r.run('cloudDirty'),false);
  }
  for(const setup of ['stateRecoveryPending=true','cloudUploadBlocked=true','stateUploadBlockPending=true']){t=start();t.run(setup);code(t.apply(cmd('profile.name.set',{name:'Blocked',expect:'Fixture'})),'readonly')}
  t=start({preview:true});code(t.apply(cmd('profile.name.set',{name:'Preview',expect:'Fixture'})),'readonly');
  t=start();code(t.apply({...cmd('profile.name.set',{name:'Other',expect:'Fixture'}),userId:'other'}),'wrong_user');
  t.run('openModal("Existing input","<input>")');code(t.apply(cmd('profile.name.set',{name:'Wait',expect:'Fixture'})),'busy');
  console.log('PASS account: device scheme + language atomic rollback, sound limits, readonly, user/dialog isolation');

  t=start();const images=mockImages(t),avatar=cmd('profile.avatar.set',{dataUrl:'data:image/png;base64,QUJD',expect:null});t.ctx.window.pulsNativeApply(avatar);assert.equal(t.messages.some(x=>x.type==='ack'&&x.id===avatar.id),false);images.complete();await tick();ok(t.messages.filter(x=>x.type==='ack').at(-1));assert.equal(t.state().avatarImage,'data:image/jpeg;base64,REVG');assert.equal(images.draws,1);
  compare('apply-account-avatar',avatar);compare('ack-account-avatar',t.messages.filter(x=>x.type==='ack').at(-1));
  t.store.delete('puls-native-applied');t.ctx.window.pulsNativeApply(avatar);images.complete();await tick();ok(t.messages.filter(x=>x.type==='ack').at(-1));
  const stale=cmd('profile.avatar.set',{...avatar.args,expect:'old'});t.ctx.window.pulsNativeApply(stale);t.run('state.avatarImage="data:image/jpeg;base64,R0hJ";save()');images.complete();await tick();code(t.messages.filter(x=>x.type==='ack').at(-1),'conflict');
  t.ctx.window.pulsNativeApply(cmd('profile.avatar.set',avatar.args));t.run('cloudSession={user:{id:"other"}};cloudStatusChanged()');images.complete();await tick();code(t.messages.filter(x=>x.type==='ack').at(-1),'not_ready');
  console.log('PASS account: actual Web JPEG pipeline/crop, ack after decoding+persist, lost-history replay, async edit/user isolation');

  t=start();t.run('var authCalls=0;cloudAuthForm=function(mode){authCalls++;openModal("Bei PULS anmelden","password-form")};var logoutCalls=0;signOutCloud=function(){logoutCalls++};');
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountSignOut'}),false);assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountSignOut',web:true}),true);assert.equal(t.run('logoutCalls'),0,'navigation does not sign out');
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountImport',web:true}),true);assert.equal(t.run('accountSection'),'manage');
  assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountConflict',web:true}),true);assert.equal(t.run('cloudConflict'),false);
  t=start({local:true});t.run('var authCalls=0;cloudAuthForm=function(){authCalls++;openModal("Bei PULS anmelden","password-form")}');assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountSignIn',web:true}),true);assert.equal(t.run('authCalls'),1);assert.equal(t.messages.filter(x=>x.type==='chrome').at(-1).reason,'modal');assert.equal(t.ctx.window.pulsNativeNavigate({action:'accountDelete',web:true}),false);
  t=start();t.run('openAccountSection("plan")');assert.equal(t.messages.filter(x=>x.type==='openNative').at(-1).screen,'account');assert.equal(t.ctx.window.pulsNativeNavigate({page:'account',section:'plan',web:true}),true);assert.equal(t.run('accountSection'),'plan');
  // Put synthetic secret sentinels only in Auth, never in checked-in profile fixtures. Adapter must not touch them.
  const secret='SYNTHETIC_AUTH_SENTINEL';t.run('cloudSession.user.email="'+secret+'@example.invalid";cloudSession.access_token="'+secret+'";cloudSession.refresh_token="'+secret+'";cloudSession.password="'+secret+'";cloudMessage="'+secret+'"');
  const from=t.messages.length;interest(t);ask(t);ok(t.apply(cmd('profile.name.set',{name:'No secrets',expect:'Fixture'})));
  for(const msg of t.messages.slice(from).filter(x=>['projection','ack','accountResult'].includes(x.type)))assert.equal(JSON.stringify(msg).includes(secret),false);
  for(const file of fs.readdirSync('tests/fixtures/native-bridge').filter(x=>x.startsWith('account-')||x.startsWith('apply-account-')||x.startsWith('ack-account-'))){const text=fs.readFileSync('tests/fixtures/native-bridge/'+file,'utf8');assert(!/access_token|refresh_token|password|SYNTHETIC_AUTH_SENTINEL/.test(text),file)}
  t.run('cloudSession={user:{id:"different"}};cloudStatusChanged()');const count=t.messages.filter(x=>x.type==='projection').length;assert.equal(t.ctx.window.pulsNativeAccountQuery({requestId:'x',kind:'planner'}),false);t.tick(300);assert.equal(t.messages.filter(x=>x.type==='projection').length,count);code(t.apply(cmd('profile.name.set',{name:'Pending',expect:'Fixture'})),'not_ready');
  console.log('PASS account: explicit web exits, Chrome modal gate, no auth data in account messages/fixtures, owner-pending isolation');
  t=start();interest(t);const stateBefore=t.store.get('puls-v1'),seq=t.snapshots().at(-1).seq;ask(t);assert.equal(t.store.get('puls-v1'),stateBefore);assert.equal(t.snapshots().at(-1).seq,seq);
  op=cmd('appearance.set',{scheme:'dark',expect:{scheme:'system',language:'de'}});ok(t.apply(op));compare('account-snapshot-device',t.snapshots().at(-1));assert.equal(t.snapshots().at(-1).device.scheme,'dark');
  const r=start({store:t.store,profile:t.state()});assert.equal(r.snapshots().at(-1).device.scheme,'dark','device preference survives a new document');
  t=start();t.run('state.profile=null;delete state.measurements;delete state.runs;save()');interest(t);assert.equal(projection(t).account.profile,null);assert.equal(projection(t).account.forecast,null);assert.equal(projection(t).account.body.metrics,null);assert.equal(t.state().runs,undefined,'read projection preserves legacy absent runs');
  t=start();t.run('state.profile.age=18;state.profile.height=230;state.profile.weight=30;state.weights=[];save()');interest(t);assert.equal(projection(t).account.body.metrics.bf,null,'unknown body fat is never rounded into zero');
  t=start();t.run('state.goalHistory.push({date:today(),kcal:2300,extra:"preserve-history"});state.profile.extra="preserve-profile"');ok(t.apply(cmd('profile.name.set',{name:'History safe',expect:'Fixture'})));assert.equal(t.state().goalHistory.find(x=>x.date==='2026-10-28').extra,'preserve-history');assert.equal(t.state().profile.extra,'preserve-profile');
  t=start();const asyncImages=mockImages(t);t.ctx.window.pulsNativeApply(cmd('profile.avatar.set',{dataUrl:'data:image/png;base64,QUJD',expect:null}));t.event('window','pagehide');asyncImages.complete();await tick();code(t.messages.filter(x=>x.type==='ack').at(-1),'busy');assert.equal(t.state().avatarImage,undefined);
  t=start();code(t.apply(cmd('profile.avatar.set',{dataUrl:'data:text/html;base64,QUJD',expect:null})),'invalid');code(t.apply(cmd('profile.avatar.set',{dataUrl:'data:image/png;base64,'+'A'.repeat(512*1024),expect:null})),'invalid');
  const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('js/native-account.js')>html.indexOf('js/native-nutrition.js'));assert(fs.readFileSync('sw.js','utf8').includes('"js/native-account.js"'));
  console.log('PASS account: read-only queries, device snapshot/reload effect, legacy missing profile, unknown metrics, history preservation, pagehide and asset integration');
})().catch(e=>{console.error(e);process.exitCode=1});
