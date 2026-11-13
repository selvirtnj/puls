const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {appValidator,baseState}=require('./validdata-env.cjs');
// validData ist eine Funktion in js/app.js: die nativeExtras-Regeln werden an der echten, vollständig geladenen App geprüft.
const fullValidData=appValidator(),validate=s=>fullValidData({...baseState(),...s});
const source=fs.readFileSync('js/native-extras.js','utf8');
function fixture({features=[],native=true,state,reply,preview=false}={}){
  const messages=[],timers=new Map(),nodes=new Map(),events={};let id=0,saves=0,webStarts=0,webStops=0,lookups=[],html='';
  const c={console,Date,Math,Promise,Set,Map,firstRunPreview:preview,cloudSession:null,cloudBusy:false,cloudConflict:false,cloudApplying:false,cloudUploadBlocked:false,
    state:state||{weights:[],workouts:[],runs:[],custom:[]},validData:s=>s&&Array.isArray(s.workouts),
    save(){saves++;return 7},render(){return 8},accountAppearanceCard:()=>'<p>base</p>',accountListRow:()=>'<button>iPhone</button>',
    startBarcodeCamera(){webStarts++},stopBarcode(){webStops++},normalizeBarcode:s=>s,validBarcode:s=>s==='3017620422003',lookupBarcode:(event,code)=>lookups.push(code),
    modal:{open:true},$:id=>nodes.get(id)||null,openModal(title,body){html=body},
    setTimeout(fn,delay){const key=++id;timers.set(key,{fn,delay});return key},clearTimeout:key=>timers.delete(key),
    document:{hidden:false,querySelectorAll:()=>[],addEventListener:(key,fn)=>events[key]=fn},
    window:{pulsNativeFeatures:features,addEventListener:(key,fn)=>events[key]=fn}};
  if(native)c.window.webkit={messageHandlers:{pulsNative:{postMessage(message){messages.push(message);if(reply){const response=reply(message);if(response)queueMicrotask(()=>c.window.pulsNativeExtrasReceive({requestId:message.requestId,...response}))}}}}};
  const webStart=c.startBarcodeCamera,webStop=c.stopBarcode,save=c.save,render=c.render;
  vm.createContext(c);vm.runInContext(source,c);
  const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve()};
  const tick=async()=>{for(const [key,t] of [...timers])if(t.delay===350){timers.delete(key);t.fn()}await flush()};
  const answer=(message,body)=>c.window.pulsNativeExtrasReceive({requestId:message.requestId,...body});
  return {c,messages,nodes,events,timers,tick,flush,answer,original:{webStart,webStop,save,render},counts:()=>({saves,webStarts,webStops,lookups}),html:()=>html};
}
(async()=>{
  for(const options of [{native:false},{features:['workoutTimer','haptics']},{features:['stateBridge','nativeWebPages']}]){
    const f=fixture(options),before=JSON.stringify(f.c.state);
    assert.equal(f.c.save,f.original.save);assert.equal(f.c.render,f.original.render);
    assert.equal(f.c.startBarcodeCamera,f.original.webStart);assert.equal(f.timers.size,0);assert.equal(f.messages.length,0);
    assert(validate({workouts:[]}));assert.equal(JSON.stringify(f.c.state),before);
    assert(!validate({workouts:[],nativeExtras:{healthEnabled:'yes'}}));
  }
  const f=fixture();
  for(const value of [{},{healthEnabled:false},{reminders:{weight:{enabled:true,time:'08:15',days:[1,3,7]}}}])assert(validate({workouts:[],nativeExtras:value}));
  for(const value of [null,[],{reminders:[]},{reminders:{bad:{enabled:false,time:'08:00',days:[]}}},{reminders:{weight:{enabled:true,time:'08:00',days:[]}}},{reminders:{weight:{enabled:true,time:'24:00',days:[2]}}},{reminders:{weight:{enabled:true,time:'08:00',days:[2,2]}}},{reminders:{weight:{enabled:true,time:'08:00',days:[8]}}}])assert(!validate({workouts:[],nativeExtras:value}));
  assert(!fullValidData({nativeExtras:{}}),'base validator remains authoritative');
  assert(!validate({workouts:[],nativeExtras:{reminders:{weight:{enabled:true,time:['08:00'],days:[2]}}}}),'time must be a string');
  console.log('PASS extras: old backups, strict optional settings, inert Browser/old shell and no startup writes');

  {
    // Reuse the established synthetic-profile bootstrap with the actual validation wrapper chain.
    const harness=fs.readFileSync('tests/check-native-training.cjs','utf8').split('const started=options=>')[0];
    const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
    const t=app({handler:false,features:[]}),before=JSON.stringify(t.state());t.run(source);
    assert(t.run('validData(state)'),'real old profile remains valid');assert.equal(JSON.stringify(t.state()),before,'loading does not migrate or dirty old profile');
    t.run('state.nativeExtras={healthEnabled:true,reminders:{training:{enabled:true,time:"18:30",days:[2,4,6]},weight:{enabled:false,time:"08:00",days:[]}}}');
    assert(t.run('validData(JSON.parse(JSON.stringify(state)))'),'new preferences round-trip through actual validator chain');
    const after=t.state();delete after.nativeExtras;assert.equal(JSON.stringify(after),before,'all profile fields and IDs retained');
    t.run('state.nativeExtras.reminders.training.days=[0]');assert(!t.run('validData(state)'),'actual chain rejects malformed new preference');
  }
  console.log('PASS extras: actual profile validator chain, old/new backup round-trip and lossless profile/ID preservation');

  {
    const f=fixture({features:['barcodeScanner']});f.nodes.set('barcode-input',{});f.nodes.set('barcode-status',{});
    let operation=f.c.startBarcodeCamera(),request=f.messages.at(-1);assert.equal(request.type,'barcodeScan');
    f.answer(request,{status:'scanned',code:'3017620422003'});await operation;assert.deepEqual(f.counts().lookups,['3017620422003']);
    operation=f.c.startBarcodeCamera();request=f.messages.at(-1);f.c.stopBarcode();f.answer(request,{status:'scanned',code:'3017620422003'});await operation;assert.equal(f.counts().lookups.length,1,'closed scanner ignores late result');
    operation=f.c.startBarcodeCamera();request=f.messages.at(-1);f.answer(request,{status:'unavailable'});await operation;assert.equal(f.counts().webStarts,1,'native failure uses existing web scanner');
    operation=f.c.startBarcodeCamera();request=f.messages.at(-1);f.answer(request,{status:'denied'});await operation;assert.equal(f.counts().webStarts,1,'denial stays manual');assert.match(f.nodes.get('barcode-status').textContent,/iOS/);
    operation=f.c.startBarcodeCamera();request=f.messages.at(-1);f.answer(request,{status:'scanned',code:'invalid'});await operation;assert.equal(f.counts().lookups.length,1,'checksum gate stays active');
    const other=fixture({features:['barcodeScanner']});other.nodes.set('barcode-input',{});const p=other.c.startBarcodeCamera();assert.notEqual(request.requestId,other.messages.at(-1).requestId,'document sessions do not reuse request IDs');other.answer(other.messages.at(-1),{status:'cancelled'});await p;
  }
  console.log('PASS extras: native scanner shared lookup, unavailable fallback, denial, checksum and stale/session replies');

  {
    const now=Date.now(),state={weights:[{id:'one',date:'2026-01-01',kg:80},{id:'bad-date',date:'2026-02-31',kg:80}],workouts:[
      {id:'done',finished:true,startedAt:now-60000,finishedAt:now-1000,durationSeconds:59,exercises:[{sets:[{done:true}]}]},
      {id:'legacy',finished:true,exercises:[{sets:[{done:true}]}]},
      {id:'auto',finished:true,autoFinished:true,startedAt:now-18000001,finishedAt:now-1,durationSeconds:18000,exercises:[{sets:[{done:true}]}]},
      {id:'approx',finished:true,timeApprox:true,startedAt:now-60000,finishedAt:now-1000,durationSeconds:59,exercises:[{sets:[{done:true}]}]},
      {id:'active',finished:false,startedAt:now-60000,finishedAt:now-1000,durationSeconds:59,exercises:[{sets:[{done:true}]}]}
    ],runs:[{id:'run',startedAt:now-120000,durationSeconds:60,pauseSeconds:30,distanceKm:1,type:'walk'},{id:'no-time',date:'2026-01-01',durationSeconds:60},{id:'no-pause',startedAt:now-120000,durationSeconds:60}],nativeExtras:{healthEnabled:true}};
    const f=fixture({features:['healthWrite','localReminders'],state,reply:m=>m.type==='extrasContext'?{healthEnabled:true}:{status:'saved'}}),before=JSON.stringify(state);
    await f.tick();assert.equal(f.counts().saves,0);assert.equal(JSON.stringify(state),before);
    const rows=f.messages.find(x=>x.type==='healthSync').samples;assert.deepEqual(Array.from(rows,x=>x.key),['weight:2026-01-01','workout:done','run:run']);
    assert.equal(rows[2].end,now-30000,'known pause included, summary save time excluded');assert.equal(rows[2].distance,1000);assert.equal(rows[0].dateOnly,true);assert(!rows.some(x=>'kcal'in x));
    assert(!f.messages.some(x=>['healthEnable','remindersSet'].includes(x.type)),'startup never requests authorization or plans reminders');
    state.weights[0].id='replacement-id';state.weights[0].kg=81;f.c.save();await f.tick();assert.equal(f.messages.filter(x=>x.type==='healthSync').at(-1).samples[0].key,'weight:2026-01-01','same day edit preserves Health identity without mutating web ID');
    state.weights[0].kg=82;
    const count=f.messages.length;f.c.cloudConflict=true;f.c.save();await f.tick();assert.equal(f.messages.length,count,'unresolved cloud conflicts do not export');
    f.c.cloudConflict=false;f.c.cloudBusy=true;f.c.render();await f.tick();assert.equal(f.messages.length,count,'in-flight cloud work does not export');
    f.c.cloudBusy=false;f.c.cloudSession={user:{id:'other-user'}};f.c.render();await f.tick();assert.equal(f.messages.findLast(x=>x.type==='extrasContext').owner,'account:other-user');
    const preview=fixture({features:['healthWrite','localReminders'],preview:true,reply:()=>({healthEnabled:true})});await preview.tick();await preview.c.window.pulsNativeHealthToggle(true);await preview.c.window.pulsNativeRemindersSave({preventDefault(){}});preview.c.window.pulsNativeExtrasOpen();assert.equal(preview.messages.length,0,'preview cannot invoke Health/reminders even via settings');
  }
  console.log('PASS extras: write-only sample mapping, stable weight/day and workout/run IDs, no invented times/energy, conflict/cloud-busy/preview gates');

  {
    let outcome='saved';
    const state={weights:[{id:'old',date:'2026-01-01',kg:80}],workouts:[],runs:[],nativeExtras:{healthEnabled:true}};
    const f=fixture({features:['healthWrite'],state,reply:m=>m.type==='extrasContext'?{healthEnabled:true}:m.type==='healthEnable'?{healthEnabled:m.enabled}:outcome==='error'?{ok:false,status:'unavailable'}:{status:outcome}});
    const count=()=>f.messages.filter(m=>m.type==='healthSync').length;
    await f.tick();assert.equal(count(),1);
    for(let i=0;i<3;i++){f.c.render();f.c.save();await f.tick()}
    assert.equal(count(),1,'unchanged renders/saves do not send Health batches');
    state.unrelated='setting';state.runs.push({id:'legacy',durationSeconds:60});f.c.save();await f.tick();assert.equal(count(),1,'non-exportable changes do not sync');
    state.weights[0].kg=81;f.c.save();await f.tick();assert.equal(count(),2,'historical value edit with unchanged count/ID syncs');
    state.weights[0].kg=82;outcome='denied';f.c.save();await f.tick();assert.equal(count(),3);
    outcome='saved';f.c.render();await f.tick();assert.equal(count(),4,'denied batch does not advance successful fingerprint');
    state.weights[0].kg=83;outcome='error';f.c.save();await f.tick();assert.equal(count(),5);
    outcome='saved';f.c.render();await f.tick();assert.equal(count(),6,'transport failure remains retryable');
    await f.c.window.pulsNativeHealthToggle(false);await f.tick();assert.equal(count(),6);
    await f.c.window.pulsNativeHealthToggle(true);await f.tick();assert.equal(count(),7,'explicit enable forces sync even with identical data');
    f.c.render();await f.tick();assert.equal(count(),7,'forced sync is remembered after success');
    f.c.cloudSession={user:{id:'other'}};f.c.render();await f.tick();assert.equal(count(),8,'successful fingerprint is scoped to its owner');
  }
  console.log('PASS extras: Health fingerprint skips unchanged exports, detects historical edits, retries failures and resets on enable/owner');

  {
    const f=fixture({features:['healthWrite']});
    const on=f.c.window.pulsNativeHealthToggle(true);f.answer(f.messages.at(-1),{healthEnabled:false});await f.flush();const onRequest=f.messages.at(-1);assert.equal(onRequest.type,'healthEnable');
    const off=f.c.window.pulsNativeHealthToggle(false);f.answer(f.messages.at(-1),{healthEnabled:false});await f.flush();const offRequest=f.messages.at(-1);f.answer(offRequest,{healthEnabled:false});await off;
    f.answer(onRequest,{healthEnabled:true});await on;assert.equal(f.c.state.nativeExtras.healthEnabled,false,'old authorization cannot override newer OFF');
    const p=f.c.window.pulsNativeHealthToggle(true);f.answer(f.messages.at(-1),{healthEnabled:false});await f.flush();const request=f.messages.at(-1);f.c.cloudSession={user:{id:'new'}};f.answer(request,{healthEnabled:true});await p;assert.equal(f.c.state.nativeExtras.healthEnabled,false,'old owner reply cannot modify new profile');
  }
  console.log('PASS extras: delayed authorization respects latest OFF and account ownership');

  {
    const f=fixture({features:['localReminders'],state:{workouts:[],nativeExtras:{reminders:{training:{enabled:true,time:'15:00',days:[3]}}}},reply:m=>m.type==='extrasContext'?{reminders:{}}:{status:'saved'}});
    await f.tick();f.c.window.pulsNativeExtrasOpen();assert(!/id="native-training-enabled"[^>]*checked/.test(f.html()),'cloud/backup preference never appears as an active device plan');
    for(const key of ['training','weight']){f.nodes.set('native-'+key+'-enabled',{checked:false});f.nodes.set('native-'+key+'-time',{value:'08:00'})}
    await f.c.window.pulsNativeRemindersSave({preventDefault(){}});assert.equal(f.messages.at(-1).type,'remindersSet');assert.equal(f.c.state.nativeExtras.reminders.training.enabled,false);assert.equal(f.counts().saves,1,'explicit accepted device plan persists through normal save');
    const old=JSON.stringify(f.c.state);f.c.window.webkit.messageHandlers.pulsNative.postMessage=m=>{f.messages.push(m);queueMicrotask(()=>f.answer(m,m.type==='extrasContext'?{reminders:{}}:{ok:false,status:'denied'}))};
    f.nodes.get('native-training-enabled').checked=true;f.c.document.querySelectorAll=()=>[{value:'2'}];await f.c.window.pulsNativeRemindersSave({preventDefault(){}});assert.equal(JSON.stringify(f.c.state),old,'failed schedule does not persist desired state');
  }
  console.log('PASS extras: device reminder display, explicit save and denied planning preserve profile');

  // Static contracts supplement VM tests; they do not prove Swift compilation or HealthKit/UN behavior.
  const swift=fs.readFileSync('ios/PULS/HealthExporter.swift','utf8');
  assert.match(swift,/HKMetadataKeySyncIdentifier/);assert.match(swift,/HKMetadataKeySyncVersion/);assert.match(swift,/provisionAllowsHealth\(\)/);assert.match(swift,/authorizationRevision == revision/);assert.match(swift,/read: \[\]/);assert(!swift.includes('HKSampleQuery'));
  const reminders=fs.readFileSync('ios/PULS/ReminderScheduler.swift','utf8');assert(!/removeAllPending|puls-rest|delegate\s*=/.test(reminders));assert.match(reminders,/revision == self.generation/);assert.match(reminders,/UUID\(\).uuidString/);
  const delegate=fs.readFileSync('ios/PULS/AppDelegate.swift','utf8');assert.match(delegate,/id\.hasPrefix\("puls-reminder-training-"\) \|\| id\.hasPrefix\("puls-reminder-weight-"\)/);assert.match(delegate,/completionHandler\(\[\.banner, \.sound\]\)/);assert.match(delegate,/else\s*\{\s*completionHandler\(\[\]\)/);
  const project=fs.readFileSync('ios/project.yml','utf8');assert.match(project,/ENABLE_USER_SCRIPT_SANDBOXING: "NO"/);assert.match(project,/inputFiles:\s*\n\s*- \$\(SRCROOT\)\/PULS\/PULS.entitlements/);
  const controller=fs.readFileSync('ios/PULS/WebViewController.swift','utf8');assert(!/pulsNativeFeatures[^\n]*(?:stateBridge|nativeWebPages)/.test(controller));
  assert(fs.readFileSync('index.html','utf8').indexOf('js/native-extras.js')>fs.readFileSync('index.html','utf8').indexOf('js/food-flow.js'));assert(fs.readFileSync('sw.js','utf8').includes('"js/native-extras.js"'));
  console.log('PASS extras: native metadata, write-only/entitlement and notification-isolation contracts (source checks only)');
})().catch(error=>{console.error(error);process.exitCode=1});
