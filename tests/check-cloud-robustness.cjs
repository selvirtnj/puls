// Regression: beschädigter lokaler Stand, voller Speicher und Nicht-JSON-Serverantworten (nur lokale Mocks, kein echter Server).
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const files=['js/app.js','js/enhancements.js','js/products.js','js/recipes.js','js/experience.js','js/exercise-catalog.js','js/training.js','js/portions.js','js/insights.js','js/finish.js','js/personal.js'];
function harness({disk=new Map(),fetchImpl,quota=()=>false}={}){
  let nodes=new Map(),log={requests:[],writes:[],toasts:0};
  const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',querySelector:()=>null,remove(){},addEventListener(){},setAttribute(){},insertAdjacentHTML(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
  const context={document:{getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{dataset:{},classList:{add(){},remove(){},toggle(){}}},documentElement:{}},
    localStorage:{getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{if(quota(k))throw Error('QuotaExceededError');log.writes.push({key:k,value:String(v)});disk.set(k,String(v))},removeItem:k=>disk.delete(k)},
    crypto:require('crypto').webcrypto,Date,Intl,console,TextEncoder,window:{scrollTo(){},addEventListener(){},PULS_CLOUD:{url:'https://unit-test.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'}},
    location:{protocol:'file:'},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},navigator:{vibrate(){}},alert(){},confirm:()=>true,AbortController,atob:s=>Buffer.from(s,'base64').toString(),
    fetch:async(url,options)=>{log.requests.push(url);return fetchImpl(url,options)}};
  vm.createContext(context);const run=s=>vm.runInContext(s,context);
  for(let file of files)run(fs.readFileSync(file,'utf8'));context.document.documentElement.style={setProperty(){}};
  for(let file of ['js/navigation.js','js/flows.js','js/cloud.js'])run(fs.readFileSync(file,'utf8'));
  return {run,disk,log};
}
const session=JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'user-1',email:'test@example.com'}});
const remote={goals:{kcal:1900,p:140,c:200,f:60},foods:[],weights:[],workouts:[],custom:[]};
const json=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  // Befund 2: beschädigter Stand wird gesichert, nicht automatisch hochgeladen, Konfliktauswahl bleibt.
  let disk=new Map([['puls-v1','{"goals":{"kcal":21'],['puls-cloud-session',session],['puls-cloud-meta-user-1',JSON.stringify({revision:3,dirty:false,baseline:'x:1'})]]);
  let a=harness({disk,fetchImpl:async url=>url.includes('/rpc/')?json({revision:4}):json([{payload:remote,revision:3}])});
  await tick();await tick();
  assert.equal(disk.get('puls-v1-corrupt'),'{"goals":{"kcal":21','Rohtext muss gesichert werden');assert.equal(disk.get('puls-cloud-upload-blocked'),'1');
  assert(a.run('stateLoadCorrupt'));
  assert(!a.log.requests.some(u=>u.includes('/rpc/')),'leerer Notstand darf nicht hochgeladen werden');
  assert(a.run('cloudConflict'),'Auswahl muss angeboten werden');
  assert.match(a.run('cloudMessage'),/beschädigt/);
  await a.run("resolveCloudConflict('remote')");
  assert.equal(a.run('state.goals.kcal'),1900);assert(!a.run('cloudUploadBlocked'));
  // Bestehende Sicherung wird nicht überschrieben; ungültige Struktur zählt ebenfalls als beschädigt.
  disk=new Map([['puls-v1','[1,2]'],['puls-v1-corrupt','older']]);
  let b=harness({disk,fetchImpl:async()=>json(null)});
  assert.equal(disk.get('puls-v1-corrupt'),'older');assert(b.run('stateLoadCorrupt'));assert.equal(b.run('state.goals.kcal'),2200);
  // Gültiger Stand bleibt unverändert und ist nicht markiert.
  disk=new Map([['puls-v1',JSON.stringify(remote)]]);
  let c=harness({disk,fetchImpl:async()=>json(null)});
  assert(!c.run('stateLoadCorrupt'));assert(!disk.has('puls-v1-corrupt'));assert.equal(c.run('state.goals.kcal'),1900);
  // Befund 3: voller Speicher bricht save() und Konfliktablauf nicht ab, Cloud-Stand ersetzt nichts ohne Sicherung.
  let full=false;disk=new Map([['puls-v1',JSON.stringify(remote)]]);
  let d=harness({disk,quota:()=>full,fetchImpl:async url=>json([{payload:{...remote,goals:{...remote.goals,kcal:2500}},revision:9}])});
  d.run(`cloudSession=${session};cloudRevision=1`);full=true;
  d.run('state.goals.kcal=2100;save()');assert(d.run('cloudDirty'));
  d.run('cloudConflict=true');await d.run("resolveCloudConflict('remote')");
  assert.equal(d.run('state.goals.kcal'),2100,'ohne Sicherung kein Überschreiben');assert.match(d.run('cloudMessage'),/Gerätespeicher voll/);
  // Befund 11: Nicht-JSON-Antworten ergeben eine verständliche Meldung statt SyntaxError.
  let html=harness({fetchImpl:async()=>({ok:false,status:502,text:async()=>'<html>Bad Gateway</html>'})});
  html.run(`cloudSession=${session};cloudDirty=false;cloudRevision=1`);await html.run('syncCloud({forcePull:true})');
  assert.match(html.run('cloudMessage'),/Fehler 502/);assert(!/JSON|token|SyntaxError/i.test(html.run('cloudMessage')));
  let garbage=harness({fetchImpl:async()=>({ok:true,status:200,text:async()=>'nicht json'})});
  garbage.run(`cloudSession=${session};cloudDirty=false;cloudRevision=1`);await garbage.run('syncCloud({forcePull:true})');
  assert.match(garbage.run('cloudMessage'),/Unerwartete Antwort/);
  // Befund 9: recipes.js mit Cache-Version.
  assert(/src="js\/recipes\.js\?v=\d+"/.test(fs.readFileSync('index.html','utf8')));
  // Review 1/2: Sperre ist persistiert und überlebt einen Neustart mit gültigem Ersatzstand.
  assert.equal(a.disk.get('puls-cloud-upload-blocked'),undefined,'Sperre nach Cloud-Übernahme aufgehoben');
  disk=new Map([['puls-v1',JSON.stringify(remote)],['puls-cloud-upload-blocked','1'],['puls-cloud-session',session],['puls-cloud-meta-user-1',JSON.stringify({revision:3,dirty:true,baseline:'x:1'})]]);
  let restart=harness({disk,fetchImpl:async url=>url.includes('/rpc/')?json({revision:4}):json([{payload:remote,revision:3}])});
  await tick();await tick();
  assert(!restart.log.requests.some(u=>u.includes('/rpc/')),'Neustart darf Sperre nicht umgehen');assert(restart.run('cloudConflict'));
  // Review 1/3: Import entsperrt nur bei Erfolg; echter Revisionskonflikt bleibt.
  let file=text=>`({size:${text.length},text:async()=>${JSON.stringify(text)}})`;
  await restart.run(`importData(${file('kaputt')})`);assert(restart.run('cloudUploadBlocked'));assert.equal(disk.get('puls-cloud-upload-blocked'),'1');
  await restart.run(`importData(${file(JSON.stringify({...remote,goals:{...remote.goals,kcal:2050}}))})`);
  assert.equal(restart.run('state.goals.kcal'),2050);assert(!restart.run('cloudUploadBlocked'));assert(!disk.has('puls-cloud-upload-blocked'));assert(!restart.run('cloudConflict'));
  disk=new Map([['puls-v1',JSON.stringify(remote)],['puls-cloud-upload-blocked','1']]);
  let real=harness({disk,fetchImpl:async()=>json(null)});real.run('cloudConflict=true;cloudBlockConflict=false');
  await real.run(`importData(${file(JSON.stringify(remote))})`);assert(real.run('cloudConflict'),'echter Konflikt bleibt erhalten');
  // Review 1/1: fehlgeschlagene Sicherung vor der Anmeldung bricht ab, bevor Daten ersetzt werden.
  let login=harness({quota:k=>k==='puls-cloud-local-before-login',fetchImpl:async()=>json([{payload:remote,revision:5}])});
  login.run('state.goals.kcal=2400');
  await assert.rejects(login.run("activateCloudSession({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:'user-1'}})"),/Anmeldung abgebrochen/);
  assert.equal(login.run('state.goals.kcal'),2400);assert.equal(login.run('cloudSession'),null);assert.equal(login.log.requests.length,0);
  // Review 1/4: Speicherfehler bei der zweiten Abmelde-Sicherung erhält den aktuellen Stand.
  let pendingWrites=0,out;disk=new Map([['puls-cloud-local-before-login',JSON.stringify(remote)]]);
  out=harness({disk,quota:k=>k==='puls-cloud-pending-user-1'&&++pendingWrites>1,fetchImpl:async()=>{out.run('state.goals.kcal=2300');return json({})}});
  out.run(`cloudSession=${session};cloudDirty=true;state.goals.kcal=2100`);await out.run('signOutCloud()');
  assert.equal(out.run('cloudSession'),null);assert.equal(out.run('state.goals.kcal'),2300,'Änderung während Abmeldung bleibt');
  // Review 1/5: scheitert die Rohsicherung, bleibt puls-v1 unangetastet, bis die Sicherung gelingt.
  let blockRaw=true;disk=new Map([['puls-v1','{kaputt']]);
  let raw=harness({disk,quota:k=>blockRaw&&k==='puls-v1-corrupt',fetchImpl:async()=>json(null)});
  raw.run('state.goals.kcal=2200;save()');assert.equal(disk.get('puls-v1'),'{kaputt');assert(!disk.has('puls-v1-corrupt'));
  blockRaw=false;raw.run('save()');assert.equal(disk.get('puls-v1-corrupt'),'{kaputt');assert.notEqual(disk.get('puls-v1'),'{kaputt');
  // R2-1 marker-retry-before-replacement: startup quota, later successful save, then restart.
  for(let markerOnly of [false,true]){
    let blocked=true;disk=new Map([['puls-v1','{new-corrupt'],['puls-cloud-session',session],['puls-cloud-meta-user-1',JSON.stringify({revision:3,dirty:true})]]);
    let locked=harness({disk,quota:k=>blocked&&(!markerOnly||k==='puls-cloud-upload-blocked'),fetchImpl:async()=>json({revision:4})});
    await tick();locked.run('save()');assert.equal(disk.get('puls-v1'),'{new-corrupt');
    blocked=false;locked.run('save()');assert.equal(disk.get('puls-cloud-upload-blocked'),'1');assert.equal(disk.get('puls-v1-corrupt'),'{new-corrupt');
    assert(locked.log.writes.findIndex(x=>x.key==='puls-cloud-upload-blocked')<locked.log.writes.findIndex(x=>x.key==='puls-v1'));
    const again=harness({disk,fetchImpl:async()=>json({revision:4})});await tick();await tick();
    assert(again.run('cloudUploadBlocked'));assert(!again.log.requests.some(u=>u.includes('/rpc/')));
  }
  // R2-2 distinct-raw-backups: exact match only, bounded slots, quota retry, full slots block replacement.
  disk=new Map([['puls-v1','{current'],['puls-v1-corrupt','{older']]);let secondBlocked=true;
  let distinct=harness({disk,quota:k=>secondBlocked&&k==='puls-v1-corrupt-2',fetchImpl:async()=>json(null)});
  distinct.run('save()');assert.equal(disk.get('puls-v1'),'{current');secondBlocked=false;distinct.run('save()');
  assert.equal(disk.get('puls-v1-corrupt'),'{older');assert.equal(disk.get('puls-v1-corrupt-2'),'{current');
  for(let same of [false,true]){
    disk=new Map([['puls-v1','{current'],['puls-v1-corrupt','{older'],['puls-v1-corrupt-2',same?'{current':'{other'],['puls-v1-corrupt-3','{third']]);
    const slots=harness({disk,fetchImpl:async()=>json(null)});slots.run('save()');assert.equal(disk.get('puls-v1')==='{current',!same);
    assert.equal(disk.get('puls-v1-corrupt'),'{older');assert.equal(disk.get('puls-v1-corrupt-3'),'{third');
  }
  console.log('PASS: R2-1 marker-retry-before-replacement + restart; R2-2 distinct-raw-backups + bounded/full slots');
  // Q1 revision-first-poll: unchanged revision transfers no payload; changed revision pulls once.
  let poll,revision=7,payloadReads=0,revisionError=false,editDuringCheck=false;
  poll=harness({fetchImpl:async url=>{if(url.includes('select=revision&')){if(revisionError)throw Error('offline fixture');if(editDuringCheck)poll.run('state.goals.kcal=2150;save()');return json([{revision}])}payloadReads++;return json([{payload:remote,revision}])}});
  poll.run(`cloudSession=${session};cloudRevision=7;cloudBaseline=JSON.stringify(state);modal.close()`);
  await poll.run('syncCloud()');assert.equal(payloadReads,0);assert(poll.log.requests[0].includes('select=revision&'));
  revision=8;await poll.run('syncCloud()');assert.equal(payloadReads,1);assert.equal(poll.run('cloudRevision'),8);
  revisionError=true;await poll.run('syncCloud()');assert.equal(payloadReads,1);assert.match(poll.run('cloudMessage'),/offline fixture/);
  revisionError=false;revision=9;editDuringCheck=true;await poll.run('syncCloud()');assert.equal(payloadReads,1);assert.equal(poll.run('state.goals.kcal'),2150);assert(poll.run('cloudDirty'));
  console.log('PASS: Q1 revision-first-poll, changed revision, request failure and in-flight local edit');
  // Q6 import-migrate-backup-commit: old IDs/snapshots survive; failed preparation/backup/write retains old state.
  const legacy={...remote,workouts:[{id:'old-workout',name:'Legacy',date:'2026-10-01',finished:true,exercises:[{id:'old-exercise',name:'Fixture exercise',sets:[{kg:40,reps:5,done:true}]}]}]};
  let imported=harness({fetchImpl:async()=>json(null)});imported.run('state.goals.kcal=2345');const prior=imported.run('JSON.stringify(state)');
  imported.log.writes.length=0;await imported.run(`importData(${file(JSON.stringify(legacy))})`);
  assert.equal(imported.disk.get('puls-local-before-import'),prior);assert.equal(imported.run('state.workouts[0].id'),'old-workout');assert.equal(imported.run('state.workouts[0].exercises[0].id'),'old-exercise');
  const committed=imported.log.writes.filter(x=>x.key==='puls-v1').map(x=>JSON.parse(x.value));
  assert(committed.length);assert(committed.every(s=>s.version===2&&s.workouts[0].exercises[0].exerciseId&&s.exerciseBook.length));
  assert(imported.log.writes.findIndex(x=>x.key==='puls-local-before-import')<imported.log.writes.findIndex(x=>x.key==='puls-v1'));
  const linked=JSON.parse(imported.run('JSON.stringify(state)'));
  linked.weights=[{id:'weight-history',date:'2026-09-01',kg:81}];
  linked.foods=[{id:'food-snapshot',name:'Fixture snapshot',date:'2026-09-01',meal:'Frühstück',grams:37,kcal:91,p:3,c:13,f:2}];
  const exerciseId=linked.workouts[0].exercises[0].exerciseId;
  linked.routines=[{id:'old-routine',name:'Fixture routine',exercises:[{exerciseId,sets:3,min:5,max:8}]}];
  await imported.run(`importData(${file(JSON.stringify(linked))})`);
  assert.equal(imported.run('state.workouts[0].exercises[0].exerciseId'),exerciseId);assert.equal(imported.run('state.routines[0].exercises[0].exerciseId'),exerciseId);
  assert.equal(imported.run('JSON.stringify(state.foods)'),JSON.stringify(linked.foods));assert.equal(imported.run('JSON.stringify(state.weights)'),JSON.stringify(linked.weights));
  for(let fail of ['migration','validation','backup','write','cancel']){
    let armed=false;const attempt=harness({fetchImpl:async()=>json(null),quota:k=>armed&&(fail==='backup'&&k==='puls-local-before-import'||fail==='write'&&k==='puls-v1')});
    attempt.run('state.goals.kcal=2345;save()');const before=attempt.run('JSON.stringify(state)'),oldDisk=attempt.disk.get('puls-v1');armed=true;
    if(fail==='migration')attempt.run('migrate=()=>{state.goals.kcal=1;throw Error("fixture") }');
    if(fail==='validation')attempt.run('migrate=()=>{state.goals.kcal=-1}');
    if(fail==='cancel')attempt.run('confirm=()=>false');
    await attempt.run(`importData(${file(JSON.stringify(legacy))})`);
    assert.equal(attempt.run('JSON.stringify(state)'),before,fail+' keeps active state');assert.equal(attempt.disk.get('puls-v1'),oldDisk,fail+' keeps disk state');
  }
  console.log('PASS: Q6 import-migrate-backup-commit, legacy IDs, migration/validation/storage failures and cancellation');
  // Q7 local-conflict-remote-backup: backup must precede upload and failing backup retains the conflict/lock.
  for(let fail of [false,true]){
    let conflict;conflict=harness({quota:k=>fail&&k==='puls-cloud-conflict-backup',fetchImpl:async url=>{
      if(url.includes('/rpc/')){assert.equal(conflict.disk.get('puls-cloud-conflict-backup'),JSON.stringify(remote));return json({revision:10})}
      return json([{payload:remote,revision:9}]);
    }});
    conflict.run(`cloudSession=${session};cloudRevision=3;cloudConflict=true;cloudUploadBlocked=true;state.goals.kcal=2450`);
    await conflict.run("resolveCloudConflict('local')");
    assert.equal(conflict.log.requests.some(u=>u.includes('/rpc/')),!fail);assert.equal(conflict.run('cloudConflict'),fail);assert.equal(conflict.run('cloudUploadBlocked'),fail);
    assert.equal(conflict.run('state.goals.kcal'),2450);if(fail)assert.match(conflict.run('cloudMessage'),/Gerätespeicher voll/);
  }
  console.log('PASS: Q7 local-conflict-remote-backup before CAS upload, storage failure keeps lock/conflict');
  // Q8 unsupported-remote-update-hint: invalid future enum never changes local state/revision.
  const future=harness({fetchImpl:async()=>json([{revision:99,payload:{...remote,plan:{mode:'future-mode'}}}])});
  future.run(`cloudSession=${session};cloudRevision=3`);const futureBefore=future.run('JSON.stringify(state)');
  await future.run('syncCloud({forcePull:true})');assert.match(future.run('cloudMessage'),/App aktualisieren/);assert.equal(future.run('JSON.stringify(state)'),futureBefore);assert.equal(future.run('cloudRevision'),3);assert(!future.log.requests.some(u=>u.includes('/rpc/')));
  console.log('PASS: Q8 unsupported-remote-update-hint retains local state and revision');
  // Q12 utf8-byte-limit: ASCII and multibyte data around the 4.5 MB safety limit (< SQL 5 MB).
  assert.match(fs.readFileSync('backend/accounts.sql','utf8'),/octet_length\(payload::text\)<=5000000/);
  for(let [unit,count,uploads] of [['a',4490000,true],['a',4510000,false],['ä',2260000,false],['😀',1130000,false]]){
    const bytes=harness({fetchImpl:async()=>json({revision:4})});bytes.run(`cloudSession=${session};cloudDirty=true;state.fixture=${JSON.stringify(unit)}.repeat(${count})`);
    await bytes.run('syncCloud()');assert.equal(bytes.log.requests.some(u=>u.includes('/rpc/')),uploads,unit+' byte threshold');if(!uploads)assert.match(bytes.run('cloudMessage'),/zu groß/);
  }
  console.log('PASS: Q12 utf8-byte-limit (ASCII, umlaut and supplementary Unicode)');
  await checkNavigationFallback();
  console.log('PASS: corrupt local backup, persisted upload lock, import unlock, login/logout backup failures, storage quota, non-JSON responses, recipes version (local mocks only)');
})().catch(error=>{console.error(error);process.exitCode=1});

async function checkNavigationFallback(){
  const source=fs.readFileSync('sw.js','utf8');
  for(let mode of ['ok','404','503','offline','timeout','late-success','uncached-503','uncached-offline']){
    const handlers={},timers=new Map(),puts=[];let pendingResponse,timerId=0,delay;
    const cached=mode.startsWith('uncached')?null:{body:'cached shell'},fresh={ok:mode==='ok'||mode==='late-success',status:mode.includes('503')?503:404,clone(){return this}};
    const ctx={URL,Promise,self:{registration:{scope:'https://fixture.invalid/puls/'},addEventListener:(name,fn)=>handlers[name]=fn},
      caches:{match:async()=>cached,open:async()=>({put:async(_,r)=>puts.push(r)})},
      setTimeout:(fn,ms)=>{delay=ms;timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
      fetch:()=>mode==='timeout'||mode==='late-success'?new Promise(resolve=>pendingResponse=resolve):mode.endsWith('offline')?Promise.reject(Error('offline')):Promise.resolve(fresh)};
    vm.createContext(ctx);vm.runInContext(source,ctx);
    let work;handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://fixture.invalid/puls/?test=1'},respondWith:p=>work=p,waitUntil(){}});
    assert.equal(delay,4000);
    if(mode==='timeout'||mode==='late-success')for(let fn of timers.values())fn();
    if(mode==='uncached-offline')await assert.rejects(work,/offline/);
    else assert.strictEqual(await work,mode==='ok'||mode==='uncached-503'?fresh:cached,mode);
    if(mode==='late-success'){pendingResponse({...fresh,ok:true});await tick()}
    assert.equal(timers.size,0,'timer cleaned: '+mode);assert.equal(puts.length,mode==='ok'?1:0,'only timely OK response cached');
  }
  console.log('PASS: Q10 navigation-cache-fallback for 404/503/offline/4s timeout, late response, missing cache and timer cleanup');
}
