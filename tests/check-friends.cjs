const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/friends.js','utf8');
const empty=()=>({self:null,friends:[],incoming:[],outgoing:[],nudges:[]});
const enrolled=()=>({...empty(),self:{code:'ABCDEF123456',name:'Test'}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({preview=false,online=true,strength=null,reply=async name=>name==='snapshot'?enrolled():true}={}){
 const nodes=new Map(),events=new Map(),timers=new Map(),intervals=[],requests=[],alerts=[];let timerId=0,refreshSession=async()=>{};
 function node(id=''){
  const n={id,innerHTML:'',textContent:'',value:'',attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},
   addEventListener(k,fn){this[k]=fn},appendChild(child){this.children.push(child);if(child.id)nodes.set(child.id,child)},
   contains:()=>false,remove(){nodes.delete(this.id)}};if(id)nodes.set(id,n);return n;
 }
 const menu=node(),panel=node('puls-friends-panel');node('friends-name').value='Test';node('friends-code').value='FEDCBA654321';node('content');
 const state={workouts:[],goals:{kcal:2200},displayName:'Local',language:'de'};
 const ctx={state,pulsStrength:strength?{summary:()=>strength}:undefined,cloudConfigured:true,firstRunPreview:preview,cloudSession:{user:{id:'fixture-a'},access_token:'fixture-a-token'},
  cloudConfig:{url:'https://example.supabase.co',publicKey:'fixture-public'},cloudRevision:3,cloudBusy:false,cloudApplying:false,
  cloudDirty:false,cloudConflict:false,cloudUploadBlocked:false,stateLoadCorrupt:false,cloudRejectedRevision:null,cloudBaseline:JSON.stringify(state),
  cloudFreshSession:()=>refreshSession(),today:()=>'2026-11-08',
  completedWorkouts:()=>ctx.state.workouts.filter(w=>w.finished&&w.date<=ctx.today()),loggedSets:w=>w.sets||[],
  totalWorkoutXP(){ctx.state.runs??=[];return 825}, // Same legacy lazy default as the real XP chain.
  // The feature must not call the mutating streak helper, save, validData, or storage.
  dailyWorkoutStreak(){throw Error('Shared streak helper mutates legacy profiles')},
  save(){throw Error('No profile writes allowed')},validData(){throw Error('No schema changes allowed')},
  localStorage:{getItem(){throw Error('No storage reads allowed')},setItem(){throw Error('No storage writes allowed')}},
  navigator:{onLine:online},document:{hidden:false,activeElement:null,getElementById:id=>nodes.get(id)||null,
   querySelector:selector=>selector==='.accountoverview .accountmenugroup'?menu:null,
   createElement:()=>node(),body:node(),addEventListener:(name,fn)=>events.set('document:'+name,fn)},
  addEventListener:(name,fn)=>events.set(name,fn),setInterval:(fn,delay)=>intervals.push({fn,delay}),
  setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),
  openModal(title){ctx.modalTitle=title;nodes.set('puls-friends-panel',panel)},toast:msg=>alerts.push(msg),confirm:()=>true,
  esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  AbortController,Date,Intl,console,
  async fetch(url,options){const name=url.split('puls_friends_')[1],body=JSON.parse(options.body);requests.push({name,body,options});
   const result=await reply(name,body,options);
   // Mock HTTP errors: {http:404,detail:{code:'PGRST202'}} simulates a missing migration.
   if(result&&typeof result==='object'&&Number.isInteger(result.http))return {ok:false,status:result.http,json:async()=>result.detail};
   return {ok:true,status:200,json:async()=>result}}
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'friends.js'});
 return {ctx,nodes,panel,menu,events,requests,intervals,alerts,run:s=>vm.runInContext(s,ctx),
  fresh(fn){refreshSession=fn},baseline(){ctx.cloudBaseline=JSON.stringify(ctx.state)},api:ctx.pulsFriends};
}
async function main(){
 // Preview, offline, signed-out and an uninitialized account never call the network.
 for(const options of [{preview:true},{online:false},{}]){
  const f=fixture(options);if(!options.preview&&options.online!==false)f.ctx.cloudSession=null;
  await f.api.refresh(true);assert.equal(f.requests.length,0);assert(!f.nodes.has('puls-friends-link'));
 }
 const fresh=fixture();fresh.ctx.cloudRevision=0;await fresh.api.refresh(true);assert.equal(fresh.requests.length,0);
 // Snapshot alone never enrolls a user. Enrollment needs explicit form submission.
 const disabled=fixture({reply:async name=>name==='snapshot'?empty():true});await disabled.api.refresh(true);await disabled.api.refresh(true);
 assert.deepEqual(disabled.requests.map(r=>r.name),['snapshot','snapshot']);
 await disabled.api.enable({preventDefault(){}});assert(disabled.requests.find(r=>r.name==='publish').body.p_enable);
 // No state mutation on old backups without runs, no revision/dirty/storage writes.
 const f=fixture(),before=JSON.stringify(f.ctx.state);await f.api.refresh(true);await f.api.refresh(true);
 const published=f.requests.find(r=>r.name==='publish');assert(published);assert.equal(published.body.p_last_training,null);
 assert.equal(published.body.p_streak,0);assert.equal(published.body.p_streak_broken,false);assert(!('p_enable' in published.body));
 assert.equal(published.body.p_xp,825);
 assert.equal(f.ctx.pulsFriendsData87.getSnapshot().self.xp,null);
 assert.equal(JSON.stringify(f.ctx.state),before);assert.equal(f.ctx.cloudRevision,3);assert.equal(f.ctx.cloudDirty,false);
 // Snapshot refreshes are throttled; unchanged summaries do not write repeatedly.
 const count=f.requests.length;await f.api.refresh();assert.equal(f.requests.length,count);
 // Uses only completed logged sets + saved activities, unique dates, no future points.
 f.ctx.state.workouts=[{id:'old-id',finished:true,date:'2026-11-02',sets:[{}]},
  {id:'same-day',finished:true,date:'2026-11-05',sets:[{}]},
  {id:'unfinished',finished:false,date:'2026-11-07',sets:[{}]},
  {id:'empty',finished:true,date:'2026-11-07',sets:[]},
  {id:'future',finished:true,date:'2027-01-01',sets:[{}]}];
 f.ctx.state.runs=[{id:'run-id',date:'2026-11-05'},{id:'run2',date:'2026-11-08'}];f.baseline();
 await f.api.refresh(true);const last=f.requests.filter(r=>r.name==='publish').at(-1).body;
 assert.equal(last.p_streak,3);assert.equal(last.p_last_training,'2026-11-08');assert.equal(last.p_streak_broken,false);
 assert.equal(f.ctx.state.workouts[0].id,'old-id');assert.equal(f.ctx.state.runs[0].id,'run-id');
 f.ctx.state.runs=[];f.ctx.state.workouts=[{finished:true,date:'2026-11-04',sets:[{}]}];f.baseline();await f.api.refresh(true);
 assert.equal(f.requests.filter(r=>r.name==='publish').at(-1).body.p_streak_broken,true);
 // Streak must agree with the app at two rest days vs three FULL rest days.
 f.ctx.state.workouts[0].date='2026-11-05';f.baseline();await f.api.refresh(true);
 assert.equal(f.requests.filter(r=>r.name==='publish').at(-1).body.p_streak,1);
 // No publication from dirty/conflicted/busy/recovery/foreign-baseline state.
 for(const key of ['cloudDirty','cloudConflict','cloudUploadBlocked','stateLoadCorrupt','cloudBusy','cloudApplying']){
  const locked=fixture();await locked.api.refresh(true);locked.ctx[key]=true;await locked.api.refresh(true);
  assert(!locked.requests.some(r=>r.name==='publish'),key);
 }
 // Fix 6: render-time defaults (running.js adds state.runs=[]) differ from the byte baseline
 // but are no unsaved change. Only the sync dirty flag blocks publication.
 const mismatch=fixture();await mismatch.api.refresh(true);mismatch.ctx.state.runs=[];mismatch.ctx.state.extraRenderField={};
 await mismatch.api.refresh(true);assert(mismatch.requests.some(r=>r.name==='publish'),'render defaults must not block publish');
 const dirtyAfter=fixture();await dirtyAfter.api.refresh(true);dirtyAfter.ctx.cloudDirty=true;await dirtyAfter.api.enable({preventDefault(){}});
 assert(!dirtyAfter.requests.some(r=>r.name==='publish'));assert.match(dirtyAfter.panel.innerHTML,/Profilsync abschließen/);
 const rejected=fixture();await rejected.api.refresh(true);rejected.ctx.cloudRejectedRevision=4;await rejected.api.refresh(true);await rejected.api.enable({preventDefault(){}});
 assert(!rejected.requests.some(r=>r.name==='publish'));
 // A server refusal of an outdated source revision is not treated as enrollment.
 const outdated=fixture({reply:async name=>name==='snapshot'?empty():false});await outdated.api.refresh(true);await outdated.api.enable({preventDefault(){}});
 assert.equal(outdated.requests.find(r=>r.name==='publish').body.p_source_revision,3);assert.match(outdated.panel.innerHTML,/aktuelle Cloud-Profil/);
 // Disabling must not re-create the deleted mini-profile during its final refresh.
 let enabled=true;
 const d=fixture({reply:async name=>{if(name==='disable'){enabled=false;return true}return name==='snapshot'?(enabled?enrolled():empty()):true}});
 await d.api.refresh(true);await d.api.disable();assert.equal(d.requests.filter(r=>r.name==='publish').length,0);assert.match(d.panel.innerHTML,/Freunde aktivieren/);
 // Refresh-token await may change accounts. Send NO previous owner's summary.
 const race=fixture();await race.api.refresh(true);race.fresh(async()=>{race.ctx.cloudSession={user:{id:'fixture-b'},access_token:'fixture-b-token'}});
 await race.api.refresh(true);assert.equal(race.requests.length,1);assert(!race.panel.innerHTML.includes('ABCDEF123456'));
 // A late response from the old owner must never paint its friends in the new account.
 let release;const late=fixture({reply:()=>new Promise(resolve=>release=resolve)});
 const pending=late.api.refresh(true);await tick();late.ctx.cloudSession={user:{id:'fixture-b'},access_token:'fixture-b-token'};
 release(enrolled());await pending;assert(!late.panel.innerHTML.includes('ABCDEF123456'));
 // Names are escaped; received nudges persist until explicit acknowledgment.
 const inbox={...enrolled(),friends:[{code:'FEDCBA654321',name:'<img onerror="bad">',streak:2,last_training:'2026-10-30',broken:false,updated_at:'2026-10-30'}],
  incoming:[{code:'123456ABCDEF',name:'Pending'}],nudges:[{id:'00000000-0000-0000-0000-000000000001',code:'FEDCBA654321',name:'<b>Friend</b>',sent_at:'2026-11-08T10:00:00Z'}]};
 const n=fixture({reply:async name=>name==='snapshot'?inbox:'ok'});await n.api.refresh(true);
 assert.match(n.panel.innerHTML,/&lt;img/);assert(!n.panel.innerHTML.includes('<img onerror'));
 assert.match(n.panel.innerHTML,/Serie gerissen/);assert.match(n.panel.innerHTML,/Stop slacking off/);
 assert(n.nodes.has('puls-friends-notice'));assert(!n.requests.some(r=>r.name==='read'));
 await n.api.read(inbox.nudges[0].id);assert.deepEqual(n.requests.find(r=>r.name==='read').body.p_ids,[inbox.nudges[0].id]);
 n.ctx.navigator.onLine=false;n.events.get('offline')();assert(!n.nodes.has('puls-friends-notice'));assert(!n.nodes.has('puls-friends-link'));
 const english=fixture();english.ctx.state.language='en';english.baseline();await english.api.refresh(true);assert.match(english.panel.innerHTML,/Your friend code/);
 // Fix 1: 25 emojis = 50 UTF-16 units but 25 characters (server char_length). Must display.
 // One invalid foreign row is filtered; the rest of the inbox and all buttons stay usable.
 const emoji='\u{1F4AA}'.repeat(25),tooLong='x'.repeat(41);
 const mixed={...enrolled(),incoming:[{code:'123456ABCDEF',name:emoji},{code:'BAD',name:'Broken'},{code:'AAAAAAAAAAAA',name:tooLong}],
  friends:[{code:'FEDCBA654321',name:emoji,streak:1,last_training:'2026-11-07',broken:false,updated_at:'2026-11-07'},{code:'FEDCBA654322',name:'x',streak:-5}],
  nudges:[{id:'not-a-uuid',code:'FEDCBA654321',name:'x',sent_at:'2026-11-08'}]};
 const m=fixture({reply:async name=>name==='snapshot'?mixed:'ok'});await m.api.refresh(true);
 assert(m.panel.innerHTML.includes(emoji));assert.match(m.panel.innerHTML,/Annehmen/);assert.match(m.panel.innerHTML,/Freundescode/);
 assert(!m.panel.innerHTML.includes(tooLong));assert(!m.panel.innerHTML.includes('Broken'));assert(!m.panel.innerHTML.includes('not-a-uuid'));
 assert.equal((m.panel.innerHTML.match(/pulsFriends\.action\('123456ABCDEF','accept'\)/g)||[]).length,1);
 // A malformed whole response still fails soft with a message, not an exception.
 const junk=fixture({reply:async name=>name==='snapshot'?{friends:'nope',incoming:null}:true});await junk.api.refresh(true);
 assert.match(junk.panel.innerHTML,/Freunde aktivieren/);
 const emojiName=fixture({reply:async name=>name==='snapshot'?empty():true});await emojiName.api.refresh(true);
 emojiName.nodes.get('friends-name').value=emoji;await emojiName.api.enable({preventDefault(){}});
 assert.equal(emojiName.requests.find(r=>r.name==='publish').body.p_display_name,emoji);
 // Fix 2: outgoing rows show only the code even if a (legacy) server still sent a name.
 const out=fixture({reply:async name=>name==='snapshot'?{...enrolled(),outgoing:[{code:'0123456789AB',name:'Secret Recipient'}]}:'ok'});
 await out.api.refresh(true);assert.match(out.panel.innerHTML,/0123456789AB/);assert(!out.panel.innerHTML.includes('Secret Recipient'));
 // Fix 7: one 60 s interval, and periodic/forced refreshes never serialize the full state.
 const cheap=fixture();assert.deepEqual(cheap.intervals.map(i=>i.delay),[60000]);
 let serialized=0;Object.defineProperty(cheap.ctx.state,'toJSON',{value(){serialized++;return {}}});
 await cheap.api.refresh(true);cheap.intervals[0].fn();await tick();await cheap.api.refresh();
 cheap.events.get('document:visibilitychange')();await tick();assert.equal(serialized,0);
 // Fix 8: explanatory texts instead of a bare reload button; too-long names get an error.
 const waiting=fixture();waiting.ctx.cloudRevision=0;waiting.api.open();await tick();
 assert.match(waiting.panel.innerHTML,/Cloud-Profil laden/);
 const busy=fixture();busy.ctx.cloudBusy=true;busy.api.open();await tick();assert.match(busy.panel.innerHTML,/Profilsync läuft/);
 const long=fixture({reply:async name=>name==='snapshot'?empty():true});await long.api.refresh(true);
 long.nodes.get('friends-name').value='\u{1F4AA}'.repeat(41);await long.api.enable({preventDefault(){}});
 assert(!long.requests.some(r=>r.name==='publish'));assert.match(long.panel.innerHTML,/1 bis 40 Zeichen/);
 // Fix 9: menu entry only after a successful RPC; missing migration hides it for the session.
 const ready=fixture();assert(!ready.menu.children.length);await ready.api.refresh(true);
 assert.equal(ready.menu.children.filter(c=>c.id==='puls-friends-link').length,1);
 const missing=fixture({reply:async()=>({http:404,detail:{code:'PGRST202',message:'Could not find the function'}})});
 await missing.api.refresh(true);assert(!missing.menu.children.length);
 const calls=missing.requests.length;await missing.api.refresh(true);missing.events.get('focus')();await tick();
 assert.equal(missing.requests.length,calls,'no further RPCs once the migration is known missing');
 const flaky=fixture({reply:async()=>({http:503,detail:{}})});await flaky.api.refresh(true);
 assert(!flaky.menu.children.length);const flakyCalls=flaky.requests.length;await flaky.api.refresh(true);
 assert(flaky.requests.length>flakyCalls,'network errors are retried, not cached');
 // v87 rank publication, soft fallback and the isolated board snapshot.
 for(const failure of [{http:404,detail:{}},{http:400,detail:{code:'PGRST202'}}]){
  const legacy=fixture({reply:async(name,body)=>name==='snapshot'?enrolled():Object.hasOwn(body,'p_xp')?failure:true});
  const original=legacy.ctx.state,before=JSON.stringify(original);
  await legacy.api.refresh(true);await legacy.api.refresh(true);
  let pubs=legacy.requests.filter(r=>r.name==='publish');assert.equal(pubs.length,2);
  assert.equal(pubs[0].body.p_xp,825);assert(!Object.hasOwn(pubs[1].body,'p_xp'));
  assert.equal(pubs[1].body.p_source_revision,3);assert.equal(legacy.ctx.state,original);assert.equal(JSON.stringify(original),before);
  legacy.ctx.cloudRevision=4;await legacy.api.refresh(true);pubs=legacy.requests.filter(r=>r.name==='publish');
  assert.equal(pubs.length,3);assert(!Object.hasOwn(pubs.at(-1).body,'p_xp'),'remember unsupported argument for this session');
  assert.equal(legacy.ctx.pulsFriendsData87.getSnapshot().self.xp,null);
  assert(legacy.nodes.has('puls-friends-link'),'rank fallback must not hide working friends');
 }
 for(const total of [-3,25.7,10000001,NaN,Infinity]){
  const rank=fixture();rank.ctx.totalWorkoutXP=()=>total;await rank.api.refresh(true);await rank.api.refresh(true);
  const body=rank.requests.find(r=>r.name==='publish').body;
  if(Number.isFinite(total))assert.equal(body.p_xp,Math.min(10000000,Math.max(0,Math.round(total))));
  else assert(!Object.hasOwn(body,'p_xp'),'invalid local XP must never invent rank zero');
 }
 const friend={code:'FEDCBA654321',name:'Rank Fixture',streak:1,last_training:'2026-11-07',broken:false,updated_at:'2026-11-07'};
 for(const xp of [0,825,10000000,undefined,null,-1,10000001,1.5,'825',NaN]){
  const rank=fixture({reply:async name=>name==='snapshot'?{...enrolled(),self:{...enrolled().self,xp},friends:[{...friend,xp}]}:true});
  await rank.api.refresh(true);const view=rank.ctx.pulsFriendsData87.getSnapshot();
  const expected=Number.isInteger(xp)&&xp>=0&&xp<=10000000?xp:null;
  assert.equal(view.self.xp,expected);assert.equal(view.friends[0].xp,expected);
  view.friends[0].name='Changed by board';assert.equal(rank.ctx.pulsFriendsData87.getSnapshot().friends[0].name,'Rank Fixture');
  rank.ctx.cloudSession={user:{id:'fixture-other'}};assert.equal(rank.ctx.pulsFriendsData87.getSnapshot(),null,'board cannot retain another owner data');
 }
 const fallbackRace=fixture({reply:async(name,body)=>{
  if(name==='snapshot')return enrolled();
  fallbackRace.ctx.cloudSession={user:{id:'fixture-other'},access_token:'fixture-other-token'};
  return {http:404,detail:{code:'PGRST202'}};
 }});
 await fallbackRace.api.refresh(true);await fallbackRace.api.refresh(true);
 assert.equal(fallbackRace.requests.filter(r=>r.name==='publish').length,1,'no old-owner retry after account switch');
 assert.equal(fallbackRace.ctx.pulsFriendsData87.getSnapshot(),null);
 // v88: new -> v87 -> original RPC, remembering capabilities without dropping revision/opt-in.
 const strength={strength_rank:12,lift_ranks:[{key:'bench--barbell',name:'Bench',rankIndex:12,ratio:1.25}]};
 for(const oldest of [false,true]){
  const legacy=fixture({strength,reply:async(name,body)=>name==='snapshot'?enrolled():
   Object.hasOwn(body,'p_strength')||oldest&&Object.hasOwn(body,'p_xp')?{http:404,detail:{code:'PGRST202'}}:true});
  await legacy.api.refresh(true);await legacy.api.refresh(true);
  const pubs=legacy.requests.filter(r=>r.name==='publish');assert.equal(pubs.length,oldest?3:2);
  assert.deepEqual(pubs[0].body.p_strength,strength);assert(!Object.hasOwn(pubs.at(-1).body,'p_strength'));
  assert.equal(Object.hasOwn(pubs.at(-1).body,'p_xp'),!oldest);assert.equal(pubs.at(-1).body.p_source_revision,3);
  legacy.ctx.cloudRevision=4;await legacy.api.refresh(true);
  assert(!Object.hasOwn(legacy.requests.filter(r=>r.name==='publish').at(-1).body,'p_strength'));
 }
 const shared=fixture({strength,reply:async name=>name==='snapshot'?{...enrolled(),friends:[{...friend,strength_rank:12,lift_ranks:[...strength.lift_ranks,{key:'bad key',name:'x',rankIndex:50,ratio:-1}]}]}:true});
 await shared.api.refresh(true);await shared.api.refresh(true);
 assert.deepEqual(shared.requests.find(r=>r.name==='publish').body.p_strength,strength);
 const sanitized=shared.ctx.pulsFriendsData87.getSnapshot().friends[0];assert.equal(sanitized.strength_rank,12);assert.equal(sanitized.lift_ranks.length,1);
 // v93: summaries with rank_scale 2 (stages 0..39). Real toLegacy() from strength-ranks.js.
 const rankCtx={state:{},today:()=>'2026-11-08',exerciseCatalog:[]};rankCtx.window=rankCtx;vm.createContext(rankCtx);
 vm.runInContext(fs.readFileSync('js/strength-ranks.js','utf8'),rankCtx);const toLegacy=rankCtx.pulsStrength.toLegacy;
 const scaledStrength={strength_rank:20,lift_ranks:[{key:'bench--barbell',name:'Bench',rankIndex:39,ratio:2.3},{key:'row--barbell',name:'Row',rankIndex:0,ratio:.1}],rank_scale:2};
 const legacyStrength={strength_rank:13,lift_ranks:[{key:'bench--barbell',name:'Bench',rankIndex:24,ratio:2.3},{key:'row--barbell',name:'Row',rankIndex:0,ratio:.1}]};
 const v88Reject={http:400,detail:{code:'22023',message:'Invalid strength summary'}};
 const withScale=(reply,summary=scaledStrength)=>{const f=fixture({reply});f.ctx.pulsStrength={summary:()=>JSON.parse(JSON.stringify(summary)),toLegacy};return f};
 {
  // friends-strength.sql (v88): extra key/stages above 24 rejected -> converted old indices, publication succeeds.
  const v88=withScale(async(name,body)=>name==='snapshot'?enrolled():body.p_strength&&Object.hasOwn(body.p_strength,'rank_scale')?v88Reject:true);
  await v88.api.refresh(true);await v88.api.refresh(true);
  let pubs=v88.requests.filter(r=>r.name==='publish');assert.equal(pubs.length,2);
  assert.equal(pubs[0].body.p_strength.rank_scale,2);assert.deepEqual(pubs[1].body.p_strength,legacyStrength);
  assert.equal(pubs[1].body.p_xp,825);assert.equal(pubs[1].body.p_source_revision,3,'revision/opt-in fields survive the fallback');
  assert.equal(v88.ctx.pulsFriendsData87.getSnapshot().self.code,'ABCDEF123456');
  v88.ctx.cloudRevision=4;await v88.api.refresh(true);pubs=v88.requests.filter(r=>r.name==='publish');
  assert.equal(pubs.length,3);assert.deepEqual(pubs[2].body.p_strength,legacyStrength,'remember the old scale for this page');
  for(const p of pubs.slice(1)){assert(p.body.p_strength.lift_ranks.every(r=>r.rankIndex<=24));assert(p.body.p_strength.strength_rank<=24)}
  // Explicit clearing stays explicit on the old server.
  const clear=withScale(async(name,body)=>name==='snapshot'?enrolled():body.p_strength&&Object.hasOwn(body.p_strength,'rank_scale')?v88Reject:true,{strength_rank:null,lift_ranks:[],rank_scale:2});
  await clear.api.refresh(true);await clear.api.refresh(true);
  assert.deepEqual(clear.requests.filter(r=>r.name==='publish').at(-1).body.p_strength,{strength_rank:null,lift_ranks:[]});
  // Enabling friends uses the same chain.
  const enable=withScale(async(name,body)=>name==='snapshot'?empty():body.p_strength&&Object.hasOwn(body.p_strength,'rank_scale')?v88Reject:true);
  await enable.api.refresh(true);await enable.api.enable({preventDefault(){}});
  const enrolledPub=enable.requests.filter(r=>r.name==='publish');assert.equal(enrolledPub.length,2);assert(enrolledPub[1].body.p_enable);assert.deepEqual(enrolledPub[1].body.p_strength,legacyStrength);
 }
 {
  // friends-strength-v2.sql: scaled payload accepted and kept.
  const v2=withScale(async name=>name==='snapshot'?enrolled():true);
  await v2.api.refresh(true);await v2.api.refresh(true);v2.ctx.cloudRevision=4;await v2.api.refresh(true);
  const pubs=v2.requests.filter(r=>r.name==='publish');assert.equal(pubs.length,2);
  for(const p of pubs)assert.deepEqual(p.body.p_strength,scaledStrength);
  // Other validation errors (22023 without "strength") are not mistaken for an old scale.
  const bad=withScale(async(name,body)=>name==='snapshot'?enrolled():{http:400,detail:{code:'22023',message:'Invalid friend summary'}});
  await bad.api.refresh(true);await bad.api.refresh(true);
  assert.equal(bad.requests.filter(r=>r.name==='publish').length,1);
  // Pre-strength server (404): drop p_strength entirely, keep XP; scale fallback not involved.
  const pre=withScale(async(name,body)=>name==='snapshot'?enrolled():Object.hasOwn(body,'p_strength')?{http:404,detail:{code:'PGRST202'}}:true);
  await pre.api.refresh(true);await pre.api.refresh(true);
  const prePubs=pre.requests.filter(r=>r.name==='publish');assert.equal(prePubs.length,2);assert(!Object.hasOwn(prePubs[1].body,'p_strength'));assert.equal(prePubs[1].body.p_xp,825);
  // v88 server rejecting scale, then the legacy summary also missing (404) -> no strength at all, still published.
  const chain=withScale(async(name,body)=>name==='snapshot'?enrolled():!body.p_strength?true:Object.hasOwn(body.p_strength,'rank_scale')?v88Reject:{http:404,detail:{code:'PGRST202'}});
  await chain.api.refresh(true);await chain.api.refresh(true);
  const chainPubs=chain.requests.filter(r=>r.name==='publish');assert.equal(chainPubs.length,3);assert(!Object.hasOwn(chainPubs[2].body,'p_strength'));
 }
 {
  // Snapshot: rank_scale 2 allows stages 0..39; missing/other scale stays 0..24 for friends-board mapping.
  const rows=[{...friend,code:'FEDCBA654321',name:'Neu',rank_scale:2,strength_rank:39,lift_ranks:[{key:'a--b',name:'A',rankIndex:39,ratio:2},{key:'c--d',name:'C',rankIndex:40,ratio:2}]},
   {...friend,code:'FEDCBA654322',name:'Alt',strength_rank:30,lift_ranks:[{key:'a--b',name:'A',rankIndex:30,ratio:2},{key:'c--d',name:'C',rankIndex:24,ratio:2}]},
   {...friend,code:'FEDCBA654323',name:'Fremd',rank_scale:3,strength_rank:24,lift_ranks:[]}];
  const snap=fixture({reply:async name=>name==='snapshot'?{...enrolled(),self:{...enrolled().self,rank_scale:2,strength_rank:30,lift_ranks:[]},friends:rows}:true});
  await snap.api.refresh(true);const view=snap.ctx.pulsFriendsData87.getSnapshot(),by=n=>view.friends.find(p=>p.name===n);
  assert.equal(by('Neu').rank_scale,2);assert.equal(by('Neu').strength_rank,39);assert.deepEqual([...by('Neu').lift_ranks.map(r=>r.rankIndex)],[39]);
  assert.equal(by('Alt').rank_scale,null);assert.equal(by('Alt').strength_rank,null);assert.deepEqual([...by('Alt').lift_ranks.map(r=>r.rankIndex)],[24]);
  assert.equal(by('Fremd').rank_scale,null);assert.equal(by('Fremd').strength_rank,24);
  assert.equal(view.self.rank_scale,2);assert.equal(view.self.strength_rank,30);
 }
 // Source contracts supplement mocks; they do NOT execute PostgreSQL or prove live RLS.
 const sql=fs.readFileSync('backend/friends.sql','utf8');
 assert.equal((sql.match(/enable row level security/g)||[]).length,5);
 assert.match(sql,/revoke all on public\.puls_friend_limits,public\.puls_friend_declines from public,anon,authenticated/);
 // Fix 3/4: budget and decline cooldown hang on auth.users (cascade on account deletion),
 // not on the optional friend profile, so disable/enable cannot reset them.
 assert.match(sql,/puls_friend_limits \(\s*user_id uuid primary key references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/puls_friend_declines \(\s*sender uuid not null references auth\.users\(id\) on delete cascade,\s*recipient uuid not null references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/request_count<30/);assert.match(sql,/interval '1 hour'/);
 const disableBody=sql.match(/function public\.puls_friends_disable\(\)[^]*?end \$\$;/)[0];
 assert(!/puls_friend_limits|puls_friend_declines/.test(disableBody),'disable must not reset limits/declines');
 assert.match(sql,/insert into public\.puls_friend_declines\(sender,recipient,retry_after\) values\(other_id,own_id,now\(\)\+interval '7 days'\)/);
 assert.match(sql,/puls_friend_declines where sender=own_id and recipient=other_id and retry_after>now\(\)\) then return 'ok'/);
 // Fix 5: server day is Europe/Berlin, never UTC current_date; client date accepted up to +1 day.
 assert(!/current_date/.test(sql));assert.match(sql,/p_last_training>\(now\(\) at time zone 'Europe\/Berlin'\)::date\+1/);
 // Fix 2: outgoing requests expose only the code, never the recipient's display name.
 assert.match(sql,/'outgoing',coalesce\(\(select jsonb_agg\(jsonb_build_object\('code',p\.friend_code\) order by f\.created_at\)/);
 // Fix 1: server limit counts characters (char_length), matching the client [...name] rule.
 assert.match(sql,/char_length\(btrim\(p_display_name\)\) not between 1 and 40/);
 const functions=[...sql.matchAll(/create or replace function public\.(\w+)\([^]*?end \$\$;/g)];assert.equal(functions.length,6);
 for(const [body,name] of functions){assert.match(body,/security definer set search_path=''/,name);assert.match(body,/own_id uuid := auth.uid\(\)/,name)}
 assert.match(sql,/revoke all on public\.puls_friend_profiles,public\.puls_friendships,public\.puls_friend_nudges from public,anon,authenticated/);
 assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/interval '12 hours'/);assert.match(sql,/if not coalesce\(p_enable,false\)/);
 assert.match(sql,/profile_revision is distinct from p_source_revision/);assert.match(sql,/source_revision<=p_source_revision/);assert.match(sql,/where user_id=own_id for share/);
 assert(!/alter table public\.puls_profiles|create or replace function public\.puls_save_profile/i.test(sql));
 const ranksSql=fs.readFileSync('backend/friends-ranks.sql','utf8');
 assert.match(ranksSql,/begin;[^]*commit;/);assert.match(ranksSql,/add column if not exists xp integer\s+constraint/);
 assert.match(ranksSql,/alter column xp drop not null/);assert.match(ranksSql,/alter column xp drop default/);
 assert(!/add column if not exists xp integer (?:not null|default)|coalesce\(p_xp,0\)/.test(ranksSql),'unknown XP remains NULL on new/legacy enrollment');
 assert.match(ranksSql,/p_streak_broken,p_source_revision,p_xp\)/,'insert uses nullable XP unchanged');
 assert.match(ranksSql,/check \(xp between 0 and 10000000\)/);assert.match(ranksSql,/p_xp not between 0 and 10000000/);
 assert.match(ranksSql,/drop function if exists public\.puls_friends_publish\(text,integer,date,boolean,bigint,boolean\)/);
 assert.match(ranksSql,/p_enable boolean default false,p_xp integer default null/);
 assert.match(ranksSql,/xp=coalesce\(p_xp,xp\)/);assert.match(ranksSql,/xp=coalesce\(p_xp,public\.puls_friend_profiles\.xp\)/);
 assert.match(ranksSql,/profile_revision is distinct from p_source_revision/);assert.match(ranksSql,/source_revision<=p_source_revision/);
 assert.match(ranksSql,/where user_id=own_id for share/);
 assert.match(ranksSql,/'self',result/);assert.match(ranksSql,/'name',p\.display_name,'xp',p\.xp\) into result/);
 assert.match(ranksSql,/'friends'[^]*?'xp',p\.xp[^]*?f\.status='accepted'/);
 assert(!/'incoming'[^]*?'outgoing'/.exec(ranksSql)[0].includes("'xp'"),'pending requests cannot see XP');
 assert.match(ranksSql,/enable row level security/);assert.match(ranksSql,/revoke all on public\.puls_friend_profiles from public,anon,authenticated/);
 for(const [body,name] of ranksSql.matchAll(/create or replace function public\.(\w+)\([^]*?end \$\$;/g)){
  assert.match(body,/security definer set search_path=''/,name);assert.match(body,/own_id uuid := auth.uid\(\)/,name);
 }
 assert.match(ranksSql,/revoke all on function[^]*?from public,anon;/);assert.match(ranksSql,/grant execute on function[^]*?to authenticated;/);
 assert(!/alter table public\.puls_profiles|create or replace function public\.puls_save_profile/i.test(ranksSql));
 for(const file of ['index.html','sw.js'])for(const asset of ['js/friends.js','css/friends.css'])assert(fs.readFileSync(file,'utf8').includes(asset));
 console.log('PASS: friends opt-in, pure legacy summaries, rest-day boundary, conflicts/offline, owner races, XP/fallback, isolated snapshots and SQL source contracts (no live RLS).');
}
main().catch(error=>{console.error(error);process.exitCode=1});
