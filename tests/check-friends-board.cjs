// v87 Freunde-Bestenliste, Rang-Embleme, Slacking-Band und einmalige Rang-Feier in einer synthetischen VM.
// Prüft keine echte Darstellung (Layout/Animation) und kein Backend; dafür Browser-Test bei 390 × 844.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const board=fs.readFileSync('js/friends-board.js','utf8'),dataSource=fs.readFileSync('js/puls-data-v87.js','utf8');
const xpLine=fs.readFileSync('js/workout-polish.js','utf8').split('\n').find(line=>line.startsWith('function xpProgress('));
assert(xpLine,'xpProgress source');

function node(id=''){
 return {id,innerHTML:'',dataset:{},attrs:{},children:[],firstElementChild:null,
  classList:{set:new Set(),add(c){this.set.add(c)},remove(c){this.set.delete(c)},contains(c){return this.set.has(c)}},
  setAttribute(k,v){this.attrs[k]=v},addEventListener(){},querySelector(){return null},prepend(child){this.firstElementChild=child},
  insertAdjacentHTML(_,html){this.innerHTML+=html}};
}
function fixture({snapshot,xp=6400,language='de',display={}}={}){
 const nodes=new Map(),log={saves:0,toasts:[],sounds:[],nudges:[],actions:[]};let clock=Date.parse('2026-11-08T12:00:00Z');
 class FakeDate extends Date{constructor(...a){super(...(a.length?a:[clock]))}static now(){return clock}}
 const add=id=>{const n=node(id);nodes.set(id,n);return n};
 const panel=add('puls-friends-panel'),mount=add('puls-friends-board-mount');add('mb');add('content');
 mount.innerHTML='<h3>Freunde</h3><ul class="friends-list"><li>legacy</li></ul>';
 const state={language,workouts:[{id:'w1',finished:true,date:'2026-11-07',sets:[{}]}],display:{...display},displayName:'Me'};
 let currentXp=xp,snap=snapshot;
 const ctx={state,console,Intl,Math,JSON,Number,String,Object,Array,Set,Map,Promise,Date:FakeDate,
  today:()=>'2026-11-08',completedWorkouts:()=>ctx.state.workouts.filter(w=>w.finished),loggedSets:w=>w.sets||[],
  totalWorkoutXP(){return currentXp},validData:()=>true,migrate:()=>{},render:()=>{},
  save(){log.saves++},toast:m=>log.toasts.push(m),pulsSound:k=>log.sounds.push(k),
  esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  phIcon:name=>`<svg data-icon="${name}"></svg>`,requestAnimationFrame:fn=>{fn();return 1},
  document:{getElementById:id=>nodes.get(id)||null,querySelector:()=>null},
  pulsFriends:{nudge:code=>{log.nudges.push(code);return Promise.resolve()},action:(c,k)=>log.actions.push([c,k])},
  pulsFriendsData87:{getSnapshot:()=>snap?JSON.parse(JSON.stringify(snap)):null}};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
 vm.runInContext(xpLine,ctx);vm.runInContext(dataSource,ctx,{filename:'puls-data-v87.js'});
 vm.runInContext(board,ctx,{filename:'friends-board.js'});
 return {ctx,nodes,panel,mount,log,api:ctx.pulsFriendsBoard,setXp:v=>{currentXp=v;clock+=2000},setSnap:v=>{snap=v},tick:ms=>{clock+=ms}};
}
const self={code:'ABCDEF123456',name:'Ich'};
const friend=(i,extra={})=>({code:'FEDCBA65432'+i,name:'Freund '+i,xp:1000*i,streak:i,last_training:'2026-11-0'+(i%7+1),broken:false,updated_at:'2026-11-07T10:00:00Z',...extra});
const snapWith=friends=>({self:{...self,xp:5},friends,incoming:[],outgoing:[],nudges:[]});

// Ränge: Tabelle aus pulsData87, Schwellen entsprechen xpProgress.
{
 const f=fixture({snapshot:snapWith([])}),ranks=f.ctx.pulsData87.ranks;
 assert.equal(ranks.length,10);assert.equal(ranks[0].name,'High Estrogen');assert.equal(ranks[9].name,'Tren Cougher');
 for(const g of ranks)g.levels.forEach((level,k)=>assert.equal(f.ctx.xpProgress(g.xp[k]).level,level,g.name));
 const r=f.api.rankFor(825);assert.equal(r.name,'Gym-Tourist I');assert.equal(r.userLevel,4);assert.equal(r.nextName,'Gym-Tourist II');
 assert.equal(f.api.rankFor(3149).nextName,'Protein-Junkie I');assert.equal(f.api.rankFor(49275).nextAt,null);
 assert.equal(f.api.rankFor(null),null,'unbekanntes XP erfindet keinen Rang');
 // Embleme: alle Ränge × Stufen wohlgeformt, flach (keine Verläufe), eindeutige Clip-IDs, unbekannt = Fragezeichen.
 const ids=new Set();
 for(let i=0;i<10;i++)for(const stage of [0,1,2,3]){
  const svg=f.api.emblem(i,stage,40);
  assert.equal((svg.match(/<svg/g)||[]).length,1);assert(svg.endsWith('</svg>'));assert(!/gradient|filter=|shadow/i.test(svg),'flat emblem');
  const id=svg.match(/clipPath id="([^"]+)"/)[1];assert(!ids.has(id));ids.add(id);
  if(i<9)assert.equal((svg.match(/<circle cx="\d+" cy="67"/g)||[]).length,3,'drei Stufen-Punkte');
 }
 assert.match(f.api.emblem(null),/>\?</);assert.match(f.api.emblem(9,1,40),/fb-flame/);assert(!/fb-flame|fb-wings/.test(f.api.emblem(0,1,40)));
 for(const place of [1,2,3])assert.match(f.api.wreath(place),/fb-wreath-l[^]*fb-wreath-r/);
}

// Freundeskarten: Rang/Level, Rang unbekannt, Slacking-Band, Sperr-Restzeit, Escaping, Entfernen-Menü.
{
 const friends=[friend(1,{name:'<img onerror=x>',xp:null,last_training:'2026-11-07'}),friend(2,{broken:true,last_training:'2026-11-01',streak:0}),
  friend(3,{broken:true,last_training:'2026-11-01',last_nudge:'2026-11-08T07:00:00Z'})];
 const f=fixture({snapshot:snapWith(friends)}),html=f.mount.innerHTML;
 assert.equal(f.mount.dataset.fb,'1');assert(!html.includes('legacy'),'Board ersetzt Rückfall-Liste');assert.equal(f.panel.firstElementChild,f.mount);
 assert.match(html,/&lt;img onerror=x&gt;/);assert(!html.includes('<img onerror'));
 assert.match(html,/Rang unbekannt/);assert.match(html,/Pump Chaser III/);assert.match(html,/Zuletzt trainiert: gestern/);
 assert.equal((html.match(/class="fb-slack"/g)||[]).length,2);
 assert.match(html,/Gewarnt · wieder in 7 h/);assert.match(html,/pulsFriendsBoard\.warn\('FEDCBA654322',this\)/);
 assert.match(html,/Zuletzt trainiert vor 7 Tagen/);assert.match(html,/pulsFriends\.action\('FEDCBA654321','remove'\)/);
 assert.match(html,/Ich <small>\(Du\)/);
 // Warnen: bestehende nudge-RPC, Ton nudgeSend, Knopf sofort gesperrt; ungültige Codes werden ignoriert.
 const button={disabled:false,classList:{add(){}},querySelector:()=>({textContent:''}),closest:()=>null};
 f.api.warn('FEDCBA654322',button);f.api.warn('FEDCBA654322',button);f.api.warn("x');alert(1);//",{});
 assert.deepEqual(f.log.nudges,['FEDCBA654322']);assert(button.disabled);assert.equal(f.log.sounds.filter(s=>s==='nudgeSend').length,0,'kein Erfolgston vor dem RPC');
 assert.match(html,/data-code="FEDCBA654322"/);
 const english=fixture({snapshot:snapWith(friends),language:'en'});assert.match(english.mount.innerHTML,/Tap to warn|Warned · again in 7 h/);assert.match(english.mount.innerHTML,/Rank unknown/);
}

// Bestenliste robust bei 0, 1, 2 und 5 Freunden; man selbst zählt mit (lokales XP).
for(const count of [0,1,2,5]){
 const list=Array.from({length:count},(_,i)=>friend(i+1,{xp:i===0?null:20000*(i+1)}));
 const f=fixture({snapshot:snapWith(list),xp:6400});f.api.view('board');const html=f.mount.innerHTML;
 assert(!/data-count=/.test(html),'motion.js würde Zähler-Text überschreiben');const people=count+1;assert.match(html,new RegExp(`fb-podium[^"]*" data-size="${Math.min(3,people)}"`));
 assert.equal((html.match(/<li class="fb-row[ "]/g)||[]).length,Math.max(0,people-3));
 if(people<2)assert.match(html,/Sobald Freunde dabei sind/);
 const order=f.api.leaderboard(f.ctx.pulsFriendsData87.getSnapshot(),'xp');
 assert.equal(order.length,people);assert(order.some(p=>p.self&&p.xp===6400),'eigene Person mit lokalem XP');
 assert.deepEqual([...order].map(p=>p.place),[...order].map((_,i)=>i+1));
 if(count)assert.equal(order.at(-1).xp,null,'Rang unbekannt steht hinten');
 f.api.metric('streak');assert.match(f.mount.innerHTML,/aria-pressed="true" onclick="pulsFriendsBoard\.metric\('streak'\)"/);
 const streaks=[...f.api.leaderboard(f.ctx.pulsFriendsData87.getSnapshot(),'streak')].map(p=>p.streak);
 assert.deepEqual(streaks,[...streaks].sort((a,b)=>b-a));
}

// Ohne aktivierte Freunde bleibt der Rückfall von friends.js unverändert.
{
 const f=fixture({snapshot:null});assert(f.mount.innerHTML.includes('legacy'));assert.equal(f.mount.dataset.fb,undefined);
 const off=fixture({snapshot:{self:null,friends:[],incoming:[],outgoing:[],nudges:[]}});assert(off.mount.innerHTML.includes('legacy'));
}

// Rang-Aufstieg: erste Anzeige merkt nur den Ausgangsrang; Aufstieg wird genau einmal gefeiert.
{
 const f=fixture({snapshot:snapWith([]),xp:6400}),before=JSON.stringify({...f.ctx.state,display:undefined});
 assert.equal(f.ctx.state.display.lastRankSeen,4);assert.equal(f.log.saves,1);assert.equal(f.log.toasts.length,0);
 f.setXp(10500);assert.equal(f.api.celebrate(),true);assert.equal(f.ctx.state.display.lastRankSeen,5);
 assert.deepEqual(f.log.toasts,['Neuer Rang: Iron Addict I']);assert(f.log.sounds.includes('rankUp'));
 f.tick(2000);assert.equal(f.api.celebrate(),false);f.api.view('ranks');assert.equal(f.log.toasts.length,1,'nur einmal');
 assert.equal(JSON.stringify({...f.ctx.state,display:undefined}),before,'keine weiteren Zustandsänderungen');
 assert(f.ctx.validData(f.ctx.state),'lastRankSeen bleibt gültig');
 assert.match(f.mount.innerHTML,/Noch 1\.575 XP bis Iron Addict II/);assert.match(f.mount.innerHTML,/Alle Ränge/);
 assert.equal((f.mount.innerHTML.match(/class="fb-rung /g)||[]).length,10);
 const busy=fixture({snapshot:snapWith([]),xp:6400,display:{lastRankSeen:2}});
 assert.equal(busy.ctx.state.display.lastRankSeen,4,'Aufstieg beim ersten Öffnen gefeiert');assert.equal(busy.log.toasts.length,1);
}

// Einbindung: eigene Dateien, Reihenfolge nach friends.js/puls-data-v87.js und vor motion.js, Offline-Cache.
{
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 const at=s=>{const i=html.indexOf(s);assert(i>=0,s);return i};
 assert(at('js/friends.js')<at('js/friends-board.js')&&at('js/puls-data-v87.js')<at('js/friends-board.js')&&at('js/friends-board.js')<at('js/motion.js'));
 assert(at('css/design-system.css')<at('css/friends-board.css'));
 for(const file of ['js/friends-board.js','css/friends-board.css'])assert(sw.includes('"'+file+'"'),file);
 assert.match(fs.readFileSync('js/friends.js','utf8'),/<section id="puls-friends-board-mount">/);
 const css=fs.readFileSync('css/friends-board.css','utf8').replace(/\/\*[^]*?\*\//g,'');
 assert(!/gradient|box-shadow|backdrop-filter/.test(css),'Designsystem: keine Verläufe/Schatten');
 for(const [, rule] of css.matchAll(/animation:([^;]+);/g))assert(/!important/.test(rule)&&(/none|var\(--motion/.test(rule)),'Animation nur mit Tokens und !important');
 assert.match(css,/html\.reduce-motion[^{]*fb-wreath-half[^{]*\{ animation: none !important/);
}
async function asyncChecks(){
 // Warnen: Erfolgston nur nach bestätigtem Stups (frisches last_nudge im neuen Snapshot); sonst Warnton und Knopf wieder frei.
 const target=friend(2,{broken:true,last_training:'2026-11-01',streak:0});
 for(const outcome of ['sent','limited','throws']){
  const f=fixture({snapshot:snapWith([target])});f.ctx.console={...console,error:()=>{}};
  f.ctx.pulsFriends.nudge=async code=>{f.log.nudges.push(code);if(outcome==='throws')throw Error('offline');
   if(outcome==='sent')f.setSnap(snapWith([{...target,last_nudge:new Date(Date.parse('2026-11-08T12:00:02Z')).toISOString()}]))};
  const label={textContent:''},classes=new Set(),button={disabled:false,isConnected:true,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},querySelector:()=>label};
  const ok=await f.api.warn('FEDCBA654322',button);
  assert.equal(ok,outcome==='sent',outcome);assert.deepEqual(f.log.nudges,['FEDCBA654322']);
  assert.equal(f.log.sounds.includes('nudgeSend'),outcome==='sent',outcome);assert.equal(f.log.sounds.includes('warning'),outcome!=='sent',outcome);
  if(outcome!=='sent'){assert.equal(button.disabled,false);assert.equal(label.textContent,'Zum Warnen tippen')}
 }
 // Profilwechsel: kein veralteter XP-Cache, keine Feier, kein Speichern des falschen Rangs.
 const f=fixture({snapshot:snapWith([]),xp:6400});assert.equal(f.ctx.state.display.lastRankSeen,4);const saves=f.log.saves;
 f.setXp(0);f.tick(-1999); // innerhalb der früheren 800-ms-Cache-Zeit
 f.ctx.state={...f.ctx.state,workouts:[],display:{lastRankSeen:0}};
 assert.equal(f.api.localXp(),0,'Cache gilt nur für dasselbe Profil');
 assert.equal(f.api.celebrate(),false);assert.equal(f.ctx.state.display.lastRankSeen,0);assert.equal(f.log.saves,saves);assert.equal(f.log.toasts.length,0);
 // Neues Profil bekommt XP aus einem fremden Gerät/Pull (anderes Objekt): nur Ausgangspunkt, keine Feier.
 f.ctx.state={...f.ctx.state,workouts:[...f.ctx.state.workouts]};f.setXp(10500);
 assert.equal(f.api.celebrate(),false);assert.equal(f.log.toasts.length,0);
 // Echter Aufstieg im selben Profil wird weiterhin genau einmal gefeiert.
 f.ctx.state.display.lastRankSeen=5;f.setXp(15525);f.ctx.state.workouts=[...f.ctx.state.workouts];
 assert.equal(f.api.celebrate(),true);assert.deepEqual(f.log.toasts,['Neuer Rang: Mass Monster I']);assert.equal(f.ctx.state.display.lastRankSeen,6);
}
asyncChecks().then(()=>console.log('PASS: friends board (ranks/emblems, cards, slacking band, podium 0/1/2/5, unknown rank, one-time rank-up, wiring; no layout/backend).')).catch(error=>{console.error(error);process.exitCode=1});
