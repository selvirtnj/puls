// Regression: beschädigter lokaler Stand, voller Speicher und Nicht-JSON-Serverantworten (nur lokale Mocks, kein echter Server).
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const files=['js/app.js','js/enhancements.js','js/products.js','js/recipes.js','js/experience.js','js/exercise-catalog.js','js/training.js','js/portions.js','js/insights.js','js/finish.js','js/personal.js'];
function harness({disk=new Map(),fetchImpl,quota=()=>false}={}){
  let nodes=new Map(),log={requests:[],toasts:0};
  const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',querySelector:()=>null,remove(){},addEventListener(){},setAttribute(){},insertAdjacentHTML(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
  const context={document:{getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{dataset:{},classList:{add(){},remove(){},toggle(){}}},documentElement:{}},
    localStorage:{getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{if(quota(k))throw Error('QuotaExceededError');disk.set(k,String(v))},removeItem:k=>disk.delete(k)},
    crypto:require('crypto').webcrypto,Date,Intl,console,window:{scrollTo(){},addEventListener(){},PULS_CLOUD:{url:'https://unit-test.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'}},
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
  assert.equal(disk.get('puls-v1-corrupt'),'{"goals":{"kcal":21','Rohtext muss gesichert werden');
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
  console.log('PASS: corrupt local backup, upload lock, storage quota, non-JSON responses, recipes version (local mocks only)');
})().catch(error=>{console.error(error);process.exitCode=1});
