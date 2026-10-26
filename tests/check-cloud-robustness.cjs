// Regression: beschädigter lokaler Stand, voller Speicher und Nicht-JSON-Serverantworten (nur lokale Mocks, kein echter Server).
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const files=['js/app.js','js/enhancements.js','js/products.js','js/recipes.js','js/experience.js','js/exercise-catalog.js','js/training.js','js/portions.js','js/insights.js','js/finish.js','js/personal.js'];
function harness({disk=new Map(),fetchImpl,quota=()=>false,removeQuota=()=>false,preview=false}={}){
  let nodes=new Map(),log={requests:[],writes:[],alerts:[],downloads:[],blobs:new Map()};
  const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',querySelector:()=>null,remove(){},addEventListener(){},setAttribute(){},insertAdjacentHTML(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
  const context={document:{getElementById:element,createElement:()=>({click(){log.downloads.push({filename:this.download,blob:log.blobs.get(this.href)})}}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{dataset:{},classList:{add(){},remove(){},toggle(){}}},documentElement:{}},
    localStorage:{getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{if(quota(k))throw Error('QuotaExceededError');log.writes.push({key:k,value:String(v)});disk.set(k,String(v))},removeItem:k=>{if(removeQuota(k))throw Error('Storage removal fixture');disk.delete(k)}},
    crypto:require('crypto').webcrypto,Date,Intl,console,TextEncoder,Blob,URL:{createObjectURL:blob=>{let id='blob:fixture-'+log.blobs.size;log.blobs.set(id,blob);return id},revokeObjectURL(){}},window:{scrollTo(){},addEventListener(){},PULS_CLOUD:{url:'https://unit-test.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'}},
    location:{protocol:'file:',search:preview?'?erststart=1':''},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},navigator:{vibrate(){}},alert:message=>log.alerts.push(message),confirm:()=>true,AbortController,atob:s=>Buffer.from(s,'base64').toString(),
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
  // Review 3/1: raw quota never blocks saving; warn once, retain in memory, offer exact download.
  let blockRaw=true;disk=new Map([['puls-v1','{kaputt']]);
  let raw=harness({disk,quota:k=>blockRaw&&k==='puls-v1-corrupt',fetchImpl:async()=>json(null)});
  raw.run('state.goals.kcal=2200;save();save()');assert.equal(disk.get('puls-v1'),'{kaputt');assert.equal(JSON.parse(disk.get('puls-v1-recovered')).goals.kcal,2200);assert(!disk.has('puls-v1-corrupt'));
  assert.equal(raw.run('stateCorruptRaw'),'{kaputt');assert.equal(raw.log.alerts.length,1);assert.match(raw.log.alerts[0],/Beschädigte Rohdaten herunterladen/);
  raw.run('exportCorruptBackup()');assert.equal(raw.log.downloads.length,1);
  assert.equal(JSON.parse(await raw.log.downloads[0].blob.text()).backups[0].raw,'{kaputt');
  blockRaw=false;raw.run('save()');assert.equal(JSON.parse(disk.get('puls-v1')).goals.kcal,2200);assert.equal(raw.run('stateCorruptRaw'),null);
  // Failure of the separate upload marker also allows saves while preserving the lock in local metadata.
  for(let markerOnly of [false,true]){
    let blocked=true;disk=new Map([['puls-v1','{new-corrupt'],['puls-cloud-session',session],['puls-cloud-meta-user-1',JSON.stringify({revision:3,dirty:true})]]);
    let locked=harness({disk,quota:k=>blocked&&(!markerOnly||k==='puls-cloud-upload-blocked'),fetchImpl:async()=>json({revision:4})});
    await tick();locked.run('save()');
    if(markerOnly){
      assert.equal(JSON.parse(disk.get('puls-v1')).__pulsRecoveryUploadBlocked,true);assert.equal(locked.run('state.__pulsRecoveryUploadBlocked'),undefined);
      locked.run('exportData()');assert.equal(JSON.parse(await locked.log.downloads[0].blob.text()).__pulsRecoveryUploadBlocked,undefined,'Recovery marker is local metadata, not an export field');
      const stillBlocked=harness({disk,quota:k=>k==='puls-cloud-upload-blocked',fetchImpl:async()=>json({revision:4})});await tick();await tick();
      assert(stillBlocked.run('cloudUploadBlocked'));assert(!stillBlocked.log.requests.some(u=>u.includes('/rpc/')));
      await stillBlocked.run(`importData(${file(JSON.stringify({...remote,__pulsRecoveryUploadBlocked:true}))})`);assert(!stillBlocked.run('cloudUploadBlocked'));
      assert.equal(stillBlocked.run('state.__pulsRecoveryUploadBlocked'),undefined);
      assert.equal(JSON.parse(disk.get('puls-v1')).__pulsRecoveryUploadBlocked,undefined,'Explicit import clears fallback metadata');
    }else assert.equal(disk.get('puls-v1'),'{new-corrupt');
    blocked=false;locked.run('save()');assert.equal(disk.get('puls-cloud-upload-blocked'),'1');assert.equal(disk.get('puls-v1-corrupt'),'{new-corrupt');
    assert.equal(JSON.parse(disk.get(markerOnly?'puls-v1':'puls-v1-recovered')).__pulsRecoveryUploadBlocked,markerOnly?undefined:true);
    const again=harness({disk,fetchImpl:async()=>json({revision:4})});await tick();await tick();
    assert(again.run('cloudUploadBlocked'));assert(!again.log.requests.some(u=>u.includes('/rpc/')));
  }
  // Exact existing copies are reused; a full ring replaces the oldest, remembering order across restarts.
  disk=new Map([['puls-v1','{current'],['puls-v1-corrupt','{older']]);let secondBlocked=true;
  let distinct=harness({disk,quota:k=>secondBlocked&&k==='puls-v1-corrupt-2',fetchImpl:async()=>json(null)});
  distinct.run('save()');assert.equal(distinct.run('stateCorruptRaw'),'{current');assert.equal(disk.get('puls-v1'),'{current');secondBlocked=false;distinct.run('save()');
  assert.equal(disk.get('puls-v1-corrupt'),'{older');assert.equal(disk.get('puls-v1-corrupt-2'),'{current');
  for(let same of [false,true]){
    disk=new Map([['puls-v1','{current'],['puls-v1-corrupt','{older'],['puls-v1-corrupt-2',same?'{current':'{other'],['puls-v1-corrupt-3','{third']]);
    const slots=harness({disk,fetchImpl:async()=>json(null)});slots.run('save()');assert.notEqual(disk.get('puls-v1'),'{current');
    assert.equal(disk.get('puls-v1-corrupt'),same?'{older':'{current');assert.equal(disk.get('puls-v1-corrupt-3'),'{third');
    if(!same){disk.set('puls-v1','{next');const next=harness({disk,fetchImpl:async()=>json(null)});next.run('save()');assert.equal(disk.get('puls-v1-corrupt'),'{current');assert.equal(disk.get('puls-v1-corrupt-2'),'{next');
      next.run('exportCorruptBackup()');assert.deepEqual(JSON.parse(await next.log.downloads[0].blob.text()).backups.map(x=>x.raw),['{current','{next','{third']);}
  }
  // Recovery paths must keep working even when raw copies cannot be written.
  for(let recovery of ['import','cloud']){
    disk=new Map([['puls-v1','{unsaved-raw'],...['puls-v1-corrupt','puls-v1-corrupt-2','puls-v1-corrupt-3'].map((k,i)=>[k,'{old-'+i])]);
    const recover=harness({disk,quota:k=>/^puls-v1-corrupt(?:-[23])?$/.test(k),fetchImpl:async()=>json(null)});
    if(recovery==='import')await recover.run(`importData(${file(JSON.stringify(remote))})`);else recover.run(`applyCloudProfile({payload:${JSON.stringify(remote)},revision:8})`);
    assert.equal(recover.run('state.goals.kcal'),1900);assert.equal(JSON.parse(disk.get('puls-v1')).goals.kcal,1900);assert(!disk.has('puls-v1-recovered'));assert.equal(recover.run('stateCorruptRaw'),null);
    assert.equal(recover.log.alerts.length,1);assert(!recover.run('cloudUploadBlocked'));assert.equal(recover.log.downloads.length,1);
  }
  console.log('PASS: Review 3/1 rotating raw backups, memory download + one warning, nonblocking import/cloud/save and persistent upload lock');
  await checkRecoveredPersistence();
  await checkRecoveryStandChoices();
  checkAccountCopyCleanup();
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
  for(let fail of ['migration','validation','write','cancel']){
    let armed=false;const attempt=harness({fetchImpl:async()=>json(null),quota:k=>armed&&(fail==='backup'&&k==='puls-local-before-import'||fail==='write'&&k==='puls-v1')});
    attempt.run('state.goals.kcal=2345;save()');const before=attempt.run('JSON.stringify(state)'),oldDisk=attempt.disk.get('puls-v1');armed=true;
    if(fail==='migration')attempt.run('migrate=()=>{state.goals.kcal=1;throw Error("fixture") }');
    if(fail==='validation')attempt.run('migrate=()=>{state.goals.kcal=-1}');
    if(fail==='cancel')attempt.run('confirm=()=>false');
    await attempt.run(`importData(${file(JSON.stringify(legacy))})`);
    assert.equal(attempt.run('JSON.stringify(state)'),before,fail+' keeps active state');assert.equal(attempt.disk.get('puls-v1'),oldDisk,fail+' keeps disk state');
  }
  console.log('PASS: Q6 import-migrate-backup-commit, legacy IDs, migration/validation/storage failures and cancellation');
  // Review 3/6: keep one pre-import copy through later saves; replace it on the next import.
  const savedPrior=imported.disk.get('puls-local-before-import');imported.run('state.goals.kcal=2301;save()');
  assert.equal(imported.disk.get('puls-local-before-import'),savedPrior);
  const nextPrior=imported.run('JSON.stringify(state)');await imported.run(`importData(${file(JSON.stringify(remote))})`);
  assert.equal(imported.disk.get('puls-local-before-import'),nextPrior);imported.run('save()');assert.equal(imported.disk.get('puls-local-before-import'),nextPrior);
  for(let proceed of [false,true]){
    const fallback=harness({quota:k=>k==='puls-local-before-import',fetchImpl:async()=>json(null)});
    fallback.run(`state.goals.kcal=2345;save();let confirmations=0;confirm=()=>++confirmations===1||${proceed}`);
    const before=fallback.run('JSON.stringify(state)');await fallback.run(`importData(${file(JSON.stringify(remote))})`);
    assert.equal(fallback.log.downloads.length,1);assert.equal(JSON.parse(await fallback.log.downloads[0].blob.text()).goals.kcal,2345);
    assert.equal(fallback.run('confirmations'),2);assert.equal(fallback.run('state.goals.kcal'),proceed?1900:2345);
    if(!proceed)assert.equal(fallback.run('JSON.stringify(state)'),before);
  }
  const noExport=harness({quota:k=>k==='puls-local-before-import',fetchImpl:async()=>json(null)});
  noExport.run('state.goals.kcal=2345;exportData=()=>{throw Error("export fixture")}');await noExport.run(`importData(${file(JSON.stringify(remote))})`);assert.equal(noExport.run('state.goals.kcal'),2345);
  console.log('PASS: Review 3/6 single retained import backup, next-import replacement, quota download/confirm/cancel and failed export');
  // Q7 local-conflict-remote-backup: backup must precede upload and failing backup retains the conflict/lock.
  for(let fail of [false,true]){
    let conflict;conflict=harness({disk:new Map([['puls-cloud-conflict-backup','{"fixture":"local backup"}']]),quota:k=>fail&&k==='puls-cloud-conflict-remote-backup',fetchImpl:async url=>{
      if(url.includes('/rpc/')){assert.equal(conflict.disk.get('puls-cloud-conflict-remote-backup'),JSON.stringify(remote));return json({revision:10})}
      return json([{payload:remote,revision:9}]);
    }});
    conflict.run(`cloudSession=${session};cloudRevision=3;cloudConflict=true;cloudUploadBlocked=true;state.goals.kcal=2450`);
    await conflict.run("resolveCloudConflict('local')");
    assert.equal(conflict.log.requests.some(u=>u.includes('/rpc/')),!fail);assert.equal(conflict.run('cloudConflict'),fail);assert.equal(conflict.run('cloudUploadBlocked'),fail);
    assert.equal(conflict.run('state.goals.kcal'),2450);if(fail)assert.match(conflict.run('cloudMessage'),/Gerätespeicher voll/);
    assert.equal(conflict.disk.get('puls-cloud-conflict-backup'),'{"fixture":"local backup"}');
    if(!fail){conflict.run("exportCloudBackup();exportCloudBackup('remote')");
      assert.equal(await conflict.log.downloads[0].blob.text(),'{"fixture":"local backup"}');assert.equal(await conflict.log.downloads[1].blob.text(),JSON.stringify(remote));
      assert.equal(conflict.log.downloads[1].filename,'puls-cloud-konfliktstand.json');}
  }
  console.log('PASS: Review 3/5 separate local/remote conflict keys and downloads, backup-before-CAS and quota failure');
  // Review 3/7: rejected revisions keep their hint and only transfer revision on subsequent polls.
  let futureRevision=99,futureValid=false,futureFailure=false;
  const future=harness({fetchImpl:async url=>{
    if(url.includes('select=revision&'))return json([{revision:futureRevision}]);
    if(futureFailure)throw Error('payload fixture offline');
    return json([{revision:futureRevision,payload:futureValid?remote:{...remote,plan:{mode:'future-mode'}}}]);
  }});
  const payloadCount=()=>future.log.requests.filter(u=>u.includes('select=payload,')).length;
  future.run(`cloudSession=${session};cloudRevision=3;modal.close()`);const futureBefore=future.run('JSON.stringify(state)');
  await future.run('syncCloud()');assert.equal(payloadCount(),1);assert.match(future.run('cloudMessage'),/App aktualisieren/);
  for(let i=0;i<3;i++)await future.run('syncCloud()');assert.equal(payloadCount(),1);assert.match(future.run('cloudMessage'),/App aktualisieren/);
  await future.run('syncCloud({forcePull:true})');assert.equal(payloadCount(),2);
  futureRevision=100;await future.run('syncCloud()');assert.equal(payloadCount(),3);await future.run('syncCloud()');assert.equal(payloadCount(),3);
  assert.equal(future.run('JSON.stringify(state)'),futureBefore);assert.equal(future.run('cloudRevision'),3);assert(!future.log.requests.some(u=>u.includes('/rpc/')));
  futureRevision=101;futureFailure=true;await future.run('syncCloud()');await future.run('syncCloud()');assert.equal(payloadCount(),5,'Transport errors remain retryable');
  futureFailure=false;futureValid=true;await future.run('syncCloud()');assert.equal(payloadCount(),6);assert.equal(future.run('cloudRevision'),101);assert.equal(future.run('cloudRejectedRevision'),null);
  assert.equal(future.run('state.goals.kcal'),1900);
  future.run('cloudRejectedRevision=999');await future.run('signOutCloud()');assert.equal(future.run('cloudRejectedRevision'),null);
  const switched=harness({fetchImpl:async()=>json([{revision:99,payload:remote}])});switched.run('cloudRejectedRevision=99');
  await switched.run(`activateCloudSession({...${session},expires_in:3600})`);assert.equal(switched.run('cloudRejectedRevision'),null);assert.equal(switched.run('cloudRevision'),99);
  console.log('PASS: Review 3/7 rejected-revision memory, hint retention, forcePull/new revision retry, transport retry and account reset');
  // Review 3/4: UTF-8 byte limit reserves jsonb::text spacing overhead below the SQL 5 MB limit.
  assert.match(fs.readFileSync('backend/accounts.sql','utf8'),/octet_length\(payload::text\)<=5000000/);
  for(let [unit,count,uploads] of [['a',3990000,true],['a',4010000,false],['ä',2010000,false],['😀',1005000,false]]){
    const bytes=harness({fetchImpl:async()=>json({revision:4})});bytes.run(`cloudSession=${session};cloudDirty=true;state.fixture=${JSON.stringify(unit)}.repeat(${count})`);
    await bytes.run('syncCloud()');assert.equal(bytes.log.requests.some(u=>u.includes('/rpc/')),uploads,unit+' byte threshold');if(!uploads)assert.match(bytes.run('cloudMessage'),/zu groß/);
  }
  console.log('PASS: Review 3/4 utf8-byte-limit at 4,000,000 bytes (ASCII, umlaut and supplementary Unicode)');
  checkDownloadEntries();
  await checkNavigationFallback();
  console.log('PASS: corrupt local backup, persisted upload lock, import unlock, login/logout backup failures, storage quota, non-JSON responses, recipes version (local mocks only)');
})().catch(error=>{console.error(error);process.exitCode=1});

async function checkNavigationFallback(){
  const source=fs.readFileSync('sw.js','utf8');
  for(let path of ['', 'index.html', 'icon-install.html', 'other/page'])for(let mode of ['ok','404','503','offline','delayed','uncached-503','uncached-offline']){
    const handlers={},puts=[];let pendingResponse,settled=false;
    const cached=mode.startsWith('uncached')?null:{body:'cached shell'},fresh={ok:mode==='ok'||mode==='delayed',status:mode.includes('503')?503:404,clone(){return this}};
    const ctx={URL,Promise,self:{registration:{scope:'https://fixture.invalid/puls/'},addEventListener:(name,fn)=>handlers[name]=fn},
      caches:{match:async()=>cached,open:async()=>({put:async(url,r)=>puts.push({url:url.href,response:r})})},
      setTimeout(){throw Error('Navigation must not set a timeout')},clearTimeout(){throw Error('Unexpected navigation timer')},
      fetch:()=>mode==='delayed'?new Promise(resolve=>pendingResponse=resolve):mode.endsWith('offline')?Promise.reject(Error('offline')):Promise.resolve(fresh)};
    vm.createContext(ctx);vm.runInContext(source,ctx);
    let work;handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://fixture.invalid/puls/'+path+'?test=1'},respondWith:p=>work=p,waitUntil(){}});
    if(mode==='delayed'){work.then(()=>settled=true);await tick();assert.equal(settled,false,'Still waits for the network');pendingResponse(fresh)}
    if(mode==='uncached-offline')await assert.rejects(work,/offline/);
    else assert.strictEqual(await work,mode==='ok'||mode==='delayed'||mode==='uncached-503'?fresh:cached,mode);
    const shell=path===''||path==='index.html';
    assert.equal(puts.length,shell&&(mode==='ok'||mode==='delayed')?1:0,'Only a successful shell navigation may update index.html: '+path+' '+mode);
    if(puts.length)assert.equal(puts[0].url,'https://fixture.invalid/puls/index.html');
  }
  console.log('PASS: Review 3/2 navigation waits for network without timeout; HTTP/network cache fallback and missing cache');
  console.log('PASS: Review 3/3 only root/index.html navigations update the shell; icon-install.html/other paths never replace it');
}

function checkDownloadEntries(){
  const source=fs.readFileSync('js/account-refresh.js','utf8'),fixture=harness({fetchImpl:async()=>json(null)});
  // Execute the actual standalone render functions with the same storage and recovery helpers.
  fixture.run(source.slice(source.indexOf('function accountManageBody('),source.indexOf('function accountSectionNode(')));
  fixture.run(source.slice(source.indexOf('function accountListRow('),source.indexOf('function accountMenuRow(')));
  const html=()=>fixture.run('accountManageBody({querySelector:()=>null})');
  assert(!html().includes('Beschädigte Rohdaten herunterladen'));assert(!html().includes('Cloud-Konfliktstand herunterladen'));
  fixture.disk.set('puls-v1-corrupt-order','[]');assert(!html().includes('Beschädigte Rohdaten herunterladen'),'Order metadata is not raw data');
  for(let key of ['puls-v1-corrupt','puls-v1-corrupt-2','puls-v1-corrupt-3']){fixture.disk.set(key,'{fixture');assert(html().includes('onclick="exportCorruptBackup()"'));fixture.disk.delete(key)}
  fixture.run('stateCorruptRaw="{memory-fixture"');assert(html().includes('Beschädigte Rohdaten herunterladen'));
  fixture.disk.set('puls-cloud-conflict-remote-backup','{}');assert(html().includes("exportCloudBackup('remote')"));assert(html().includes('Cloud-Konfliktstand herunterladen'));
  assert(!html().includes('Letzte lokale Konflikt-Sicherung herunterladen'));
  fixture.disk.set('puls-cloud-conflict-backup','{}');assert(html().includes('Letzte lokale Konflikt-Sicherung herunterladen'));
  console.log('PASS: Review 3/1 + 3/5 conditional account download entries for raw disk/memory and separate local/remote conflicts');
}

async function checkRecoveredPersistence(){
  const original='{only-damaged-copy',rawQuota=k=>/^puls-v1-corrupt(?:-[23])?$/.test(k);
  const disk=new Map([['puls-v1',original],['puls-cloud-session',session],['puls-cloud-meta-user-1',JSON.stringify({revision:3,dirty:true})]]);
  const make=()=>harness({disk,quota:rawQuota,fetchImpl:async()=>json({revision:4})});
  let fixture=make();await tick();fixture.run('state.goals.kcal=2650;state.weights=[{id:"historical-weight",date:"2026-10-01",kg:81}];save()');
  assert.equal(disk.get('puls-v1'),original);assert.equal(JSON.parse(disk.get('puls-v1-recovered')).goals.kcal,2650);
  assert(fixture.run('cloudUploadBlocked'));assert(!fixture.log.requests.some(u=>u.includes('/rpc/')));
  fixture=make();await tick();assert.equal(fixture.run('state.goals.kcal'),2650);assert.equal(fixture.run('state.weights[0].id'),'historical-weight');
  assert(fixture.run('validData(state)'));assert(fixture.run('cloudUploadBlocked'));assert(!fixture.log.requests.some(u=>u.includes('/rpc/')));
  fixture.run('state.goals.kcal=2700;save();confirm=()=>false;exportCorruptBackup()');
  assert.equal(disk.get('puls-v1'),original);assert.equal(JSON.parse(disk.get('puls-v1-recovered')).goals.kcal,2700);
  assert(JSON.parse(await fixture.log.downloads[0].blob.text()).backups.some(item=>item.raw===original));
  // Even if a raw backup fits later, takeover still needs the requested explicit acknowledgement.
  const room=harness({disk,fetchImpl:async()=>json(null)});room.run('save()');assert.equal(disk.get('puls-v1'),original);assert(disk.has('puls-v1-recovered'));
  assert.equal(room.run('confirmRecoveredState()'),true);assert.equal(JSON.parse(disk.get('puls-v1')).goals.kcal,2700);assert(!disk.has('puls-v1-recovered'));assert(room.run('cloudUploadBlocked'));
  const promoted=make();await tick();assert.equal(promoted.run('state.goals.kcal'),2700);assert(promoted.run('cloudUploadBlocked'));assert(!promoted.log.requests.some(u=>u.includes('/rpc/')));
  // Download plus acknowledgement promotes; failed download or main write must keep recovery available.
  let failMain=false;
  const downloadDisk=new Map([['puls-v1',original]]),download=harness({disk:downloadDisk,quota:k=>rawQuota(k)||failMain&&k==='puls-v1',fetchImpl:async()=>json(null)});
  download.run('state.goals.kcal=2500;save()');failMain=true;download.run('exportCorruptBackup()');
  assert.equal(downloadDisk.get('puls-v1'),original);assert.equal(JSON.parse(downloadDisk.get('puls-v1-recovered')).goals.kcal,2500);
  assert(download.run('stateRecoveryPending'));failMain=false;download.run('exportCorruptBackup()');
  assert.equal(JSON.parse(downloadDisk.get('puls-v1')).goals.kcal,2500);assert(!downloadDisk.has('puls-v1-recovered'));
  const failed=harness({disk:new Map([['puls-v1',original]]),quota:rawQuota,fetchImpl:async()=>json(null)});
  failed.run('save();document.createElement=()=>({click(){throw Error("download fixture")}})');
  assert.throws(()=>failed.run('exportCorruptBackup()'),/download fixture/);assert.equal(failed.disk.get('puls-v1'),original);assert(failed.disk.has('puls-v1-recovered'));
  const full=harness({disk:new Map([['puls-v1',original]]),quota:k=>rawQuota(k)||k==='puls-v1-recovered',fetchImpl:async()=>json(null)});
  full.run('state.goals.kcal=2800;save()');assert.equal(full.disk.get('puls-v1'),original);assert(!full.disk.has('puls-v1-recovered'));assert.equal(full.run('state.goals.kcal'),2800);assert(full.log.alerts.some(x=>/Speichern fehlgeschlagen/.test(x)));
  for(let invalid of ['{broken','null','[]',JSON.stringify({...remote,goals:{...remote.goals,kcal:-1}})]){
    const invalidDisk=new Map([['puls-v1',JSON.stringify(remote)],['puls-v1-recovered',invalid]]);
    const ignore=harness({disk:invalidDisk,fetchImpl:async()=>json(null)});assert.equal(ignore.run('state.goals.kcal'),1900);assert(!ignore.run('stateRecoveryPending'));
  }
  const filled={...remote,foods:[{id:'saved-snapshot',name:'Fixture',date:'2026-10-01',meal:'Frühstück',grams:20,kcal:50,p:3,c:5,f:2}]};
  const selected=harness({disk:new Map([['puls-v1',JSON.stringify(remote)],['puls-v1-recovered',JSON.stringify(filled)]]),fetchImpl:async()=>json(null)});
  assert.equal(selected.run('state.foods[0].id'),'saved-snapshot');assert.equal(selected.run('state.foods[0].kcal'),50);assert(selected.run('cloudUploadBlocked'));
  console.log('PASS: N1 recovered-copy persistence, original raw retention, restart preference + upload lock, download/confirmation, failed promotion/download, quota/RAM and invalid recovery rejection');
}

async function checkRecoveryStandChoices(){
  const original='{last-unsaved-raw',rawQuota=k=>/^puls-v1-corrupt(?:-[23])?$/.test(k);
  const working={...remote,goals:{...remote.goals,kcal:2450},weights:[{id:'old-weight',date:'2026-10-01',kg:81}]};
  const imported={...working,goals:{...remote.goals,kcal:2050}},pending={...working,goals:{...remote.goals,kcal:2250}};
  function scenario(route,{cancel=false,rawProtected=false,failStorage=''}={}){
    const disk=new Map([['puls-v1',original],['puls-v1-recovered',JSON.stringify(working)]]);
    let server={payload:structuredClone(remote),revision:7},uploads=0,armed=false;
    const fetchImpl=async(url,options)=>{
      if(url.includes('/rpc/')){const body=JSON.parse(options.body);assert.equal(body.p_expected_revision,server.revision);server={payload:body.p_payload,revision:server.revision+1};uploads++;return json({revision:server.revision})}
      return json(url.includes('select=revision&')?[{revision:server.revision}]:[server]);
    };
    const fixture=harness({disk,fetchImpl,quota:k=>!rawProtected&&rawQuota(k)||armed&&failStorage==='write'&&k==='puls-v1',removeQuota:k=>armed&&(failStorage==='sidecar'&&k==='puls-v1-recovered'||failStorage==='marker'&&k==='puls-cloud-upload-blocked')});
    fixture.run(`var recoveryPrompts=[];confirm=message=>{recoveryPrompts.push(message);return ${!cancel}||!message.includes('beschädigten Rohdaten')}`);
    if(route!=='login'&&route!=='pending')fixture.run(`cloudSession=${session};cloudRevision=${route==='import'?7:3};cloudConflict=true;cloudBlockConflict=true;cloudDirty=true`);
    else disk.set('puls-cloud-meta-user-1',JSON.stringify({revision:route==='pending'?7:3,dirty:route==='pending'}));
    if(route==='pending'){disk.set('puls-cloud-pending-user-1',JSON.stringify(pending));fixture.run('cloudRevision=3')}
    fixture.run('save()');armed=true;
    const choose=async()=>{
      if(route==='local'||route==='remote')await fixture.run(`resolveCloudConflict('${route}')`);
      else if(route==='login'||route==='pending')await fixture.run(`activateCloudSession({...${session},expires_in:3600})`);
      else if(route==='initialize'){fixture.run('cloudRevision=7;cloudConflict=false');await fixture.run('initializeCloudProfile()')}
      else await fixture.run(`importData({size:1000,text:async()=>${JSON.stringify(JSON.stringify(imported))}})`);
    };
    return {fixture,disk,choose,fetchImpl,uploads:()=>uploads,server:()=>server};
  }
  for(let route of ['local','remote','login','import','pending','initialize']){
    for(let rawProtected of [false,true]){
      const test=scenario(route,{rawProtected}),{fixture,disk}=test;await test.choose();
      const expected=({local:2450,remote:1900,login:1900,import:2050,pending:2250,initialize:2450})[route];
      assert.equal(fixture.run('state.goals.kcal'),expected,route);
      assert.equal(fixture.run('cloudUploadBlocked'),false,route+' unlocks');
      assert(fixture.run('!stateRecoveryPending&&!stateLoadCorrupt&&!stateUploadBlockPending&&!stateCorruptAcknowledged&&stateCorruptRaw===null'),route+' resets recovery flags');
      assert(!disk.has('puls-v1-recovered'));assert(!disk.has('puls-cloud-upload-blocked'));assert.equal(JSON.parse(disk.get('puls-v1')).__pulsRecoveryUploadBlocked,undefined);
      assert.equal(fixture.log.downloads.length,rawProtected?0:1,route+' downloads unsaved raw only');
      if(!rawProtected)assert(JSON.parse(await fixture.log.downloads[0].blob.text()).backups.some(item=>item.raw===original));
      // A normal save and CAS upload after the choice must remain free of recovery state.
      fixture.run('state.goals.kcal+=10;save()');await fixture.run('syncCloud()');
      assert.equal(fixture.run('cloudUploadBlocked'),false);assert(!fixture.run('cloudConflict'));assert.equal(test.server().payload.goals.kcal,expected+10);
      const restarted=harness({disk,quota:rawProtected?()=>false:rawQuota,fetchImpl:test.fetchImpl});await tick();await tick();restarted.run('save()');
      assert.equal(restarted.run('state.goals.kcal'),expected+10,route+' survives restart');assert(!restarted.run('cloudUploadBlocked'));assert(!restarted.run('stateRecoveryPending'));assert(!disk.has('puls-v1-recovered'));assert(!disk.has('puls-cloud-upload-blocked'));
    }
    const cancelled=scenario(route,{cancel:true});await cancelled.choose();
    assert.equal(cancelled.fixture.run('state.goals.kcal'),2450,route+' abort preserves working profile');assert.equal(cancelled.disk.get('puls-v1'),original);
    assert.equal(JSON.parse(cancelled.disk.get('puls-v1-recovered')).goals.kcal,2450);assert(cancelled.fixture.run('cloudUploadBlocked'));assert.equal(cancelled.uploads(),0);
    cancelled.fixture.run('save()');const again=harness({disk:cancelled.disk,quota:rawQuota,fetchImpl:cancelled.fetchImpl});await tick();await tick();
    assert.equal(again.run('state.goals.kcal'),2450);assert(again.run('cloudUploadBlocked'));assert.equal(cancelled.disk.get('puls-v1'),original);assert.equal(cancelled.uploads(),0);
  }
  // A failed durable commit/cleanup must not apply the remote choice or release the lock.
  for(let failure of ['write','sidecar','marker']){
    const test=scenario('remote',{failStorage:failure});await test.choose();
    assert.equal(test.fixture.run('state.goals.kcal'),2450);assert.equal(test.disk.get('puls-v1'),original);assert(test.disk.has('puls-v1-recovered'));assert(test.fixture.run('cloudUploadBlocked'));assert.equal(test.uploads(),0);
  }
  console.log('PASS: recovery stand choices local/remote/login/import (+ pending login/initialize), each save + CAS upload + restart, raw download/confirmation, cancellation and durable cleanup failures');
}

function checkAccountCopyCleanup(){
  const source=fs.readFileSync('js/account-guide.js','utf8'),cleanup=source.slice(source.indexOf('function clearCurrentAccountCopies('),source.indexOf('async function performAccountAction('));
  for(let preview of [false,true]){
    const entries=[['puls-cloud-conflict-remote-backup','remote fixture'],['puls-cloud-conflict-backup','local conflict fixture'],['puls-cloud-pending-self','pending self'],['puls-cloud-meta-self','self meta'],['puls-progress-photos-self','self photos'],['puls-cloud-pending-other','pending other'],['puls-cloud-meta-other','other meta'],['puls-progress-photos-other','other photos'],['puls-local-before-import','device import backup'],['puls-v1-corrupt','{device raw'],['puls-v1-corrupt-2','{second raw'],['puls-v1-corrupt-3','{third raw'],['puls-v1-corrupt-order','[]']];
    const fixture=harness({disk:new Map(entries),preview,fetchImpl:async()=>json(null)});fixture.run(cleanup);fixture.run("clearCurrentAccountCopies('self')");
    for(let [key,value] of entries){const accountCopy=['puls-cloud-conflict-remote-backup','puls-cloud-conflict-backup','puls-cloud-pending-self','puls-cloud-meta-self','puls-progress-photos-self'].includes(key);assert.equal(fixture.disk.get(key),accountCopy&&!preview?undefined:value,key)}
  }
  console.log('PASS: N2 account cleanup removes remote conflict backup, preserves unscoped import/raw device backups and other users, preview stays read-only');
}
