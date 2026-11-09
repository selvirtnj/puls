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
function fixture({snapshot,xp=6400,language='de',display={},strengthScore=12}={}){
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
 vm.runInContext(fs.readFileSync('js/strength-ranks.js','utf8'),ctx);
 function setStrength(score){
  ctx.state.profile={weight:100};
  const exercises=score===null?[]:[['bench','Barbell Bench Press'],['squat','Barbell Squat'],['row','Barbell Row']].map(([key,name])=>{
   const t=ctx.pulsStrength.standards[key].male,groups=ctx.pulsStrength.ranks;
   const i=groups.findLastIndex(g=>score>=g.stages[0]),start=groups[i].stages[0];
   const ratio=score>=39?t.at(-1):t[i]+(t[i+1]-t[i])*(score-start)/(groups[i+1].stages[0]-start);
   return {name,exerciseId:key,sets:[{kg:ratio*100,reps:1,done:true}]};
  });
  ctx.state.workouts=[{id:'w1',finished:true,date:'2026-11-07',sets:[{}],exercises}];
 }
 setStrength(strengthScore);
 vm.runInContext(xpLine,ctx);vm.runInContext(dataSource,ctx,{filename:'puls-data-v87.js'});
 vm.runInContext(board,ctx,{filename:'friends-board.js'});
 return {ctx,nodes,panel,mount,log,api:ctx.pulsFriendsBoard,setStrength,setXp:v=>{currentXp=v;clock+=2000},setSnap:v=>{snap=v},tick:ms=>{clock+=ms}};
}
const self={code:'ABCDEF123456',name:'Ich'};
const friend=(i,extra={})=>({code:'FEDCBA65432'+i,name:'Freund '+i,strength_rank:6+i,lift_ranks:[{key:'bench-barbell-press--barbell',name:'Barbell Bench Press',rankIndex:6+i,ratio:i/2}],xp:1000*i,streak:i,last_training:'2026-11-0'+(i%7+1),broken:false,updated_at:'2026-11-07T10:00:00Z',...extra});
const snapWith=friends=>({self:{...self,xp:5},friends,incoming:[],outgoing:[],nudges:[]});

// v93: 14 strength groups, 40 stages, one distinct emblem per group; unknown never becomes zero.
{
 const f=fixture({snapshot:snapWith([])}),ranks=f.ctx.pulsData87.ranks;
 assert.equal(ranks.length,18);assert.equal(ranks[13].name,'Tren Cougher');assert.equal(ranks[0].name,'Gym Tourist');
 assert.equal(f.api.rankFor(21).name,'Test Booster Believer I');assert.equal(f.api.rankFor(39).nextAt,null);assert.equal(f.api.rankFor(39).name,'Mr. Olympia');
 assert.equal(f.api.rankFor(null),null);assert.equal(f.api.rankFor(40),null);assert.equal(f.api.rankFor(-1),null);
 const ids=new Set(),looks=new Set();
 const hue=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  if(!d)return {h:0,s:0};const h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s:d/(1-Math.abs(max+min-1))}};
 for(let i=0;i<18;i++)for(const stage of [0,1,2,3]){
  const svg=f.api.emblem(i,stage,40);assert(svg.endsWith('</svg>'));assert(!/gradient|filter=|shadow/i.test(svg));
  const id=svg.match(/clipPath id="([^"]+)"/)[1];assert(!ids.has(id));ids.add(id);
  if(i<17)assert.equal((svg.match(/<circle cx="\d+" cy="67"/g)||[]).length,ranks[i].stages.length);
  else assert(!/<circle cx="\d+" cy="67"/.test(svg),'final rank has no stage dots');
  if(stage===1)looks.add(svg.replace(/fbclip\d+/g,''));
  // Keine Lila-/Violetttöne und keine Neonfarben (Systemfarben wie bisher).
  for(const [color] of svg.matchAll(/#[0-9A-F]{6}/gi)){const {h,s}=hue(color);assert(!(s>.25&&h>=250&&h<=320),'no purple '+color)}
 }
 assert.equal(looks.size,18,'every group has its own emblem');
 assert.match(f.api.emblem(null),/>\?</);assert.match(f.api.emblem(13),/fb-flame/);assert.equal(f.api.emblem(18),f.api.emblem(null));
 for(const i of [0,5,6,8,10])assert(!/fb-flame/.test(f.api.emblem(i)),'new middle ranks stay modest');
 for(const place of [1,2,3])assert.match(f.api.wreath(place),/fb-wreath-l[^]*fb-wreath-r/);
}

// Freundeskarten: Rang/Level, Rang unbekannt, Slacking-Band, Sperr-Restzeit, Escaping, Entfernen-Menü.
{
 const friends=[friend(1,{name:'<img onerror=x>',xp:null,strength_rank:null,last_training:'2026-11-07'}),friend(2,{broken:true,last_training:'2026-11-01',streak:0}),
  friend(3,{broken:true,last_training:'2026-11-01',last_nudge:'2026-11-08T07:00:00Z'})];
 const f=fixture({snapshot:snapWith(friends)}),html=f.mount.innerHTML;
 assert.equal(f.mount.dataset.fb,'1');assert(!html.includes('legacy'),'Board ersetzt Rückfall-Liste');assert.equal(f.panel.firstElementChild,f.mount);
 assert.match(html,/&lt;img onerror=x&gt;/);assert(!html.includes('<img onerror'));
 assert.match(html,/Rang unbekannt/);assert.match(html,/High Melanin I/);assert.match(html,/Zuletzt trainiert: gestern/);
 // Freunde ohne rank_scale (alte App) senden Stufen 0..24: Freund 2 = alt 8 (Low Melanin III) -> neu 11.
 assert.match(html,/Freund 2<\/strong><small>Low Melanin III/);
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
 const list=Array.from({length:count},(_,i)=>friend(i+1,{strength_rank:i===0?null:Math.min(24,12+i),xp:i===0?null:20000*(i+1)}));
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

// Alte (ohne rank_scale) und neue Skala (rank_scale 2) gemischt: Anzeige, Bestenliste und Übungsvergleich auf 40 Stufen.
{
 const old=friend(1,{name:'Alt',strength_rank:13,lift_ranks:[{key:'bench-barbell-press--barbell',name:'Barbell Bench Press',rankIndex:24,ratio:2.3}]});
 const neu=friend(2,{name:'Neu',rank_scale:2,strength_rank:30,lift_ranks:[{key:'bench-barbell-press--barbell',name:'Barbell Bench Press',rankIndex:30,ratio:1.7}]});
 const junk=friend(3,{name:'Kaputt',strength_rank:25,lift_ranks:[{key:'bench-barbell-press--barbell',name:'Barbell Bench Press',rankIndex:26,ratio:1}]});
 const big=friend(4,{name:'Gross',rank_scale:2,strength_rank:39,lift_ranks:[{key:'bench-barbell-press--barbell',name:'Barbell Bench Press',rankIndex:40,ratio:3}]});
 const f=fixture({snapshot:snapWith([old,neu,junk,big]),strengthScore:12}),snap=f.ctx.pulsFriendsData87.getSnapshot();
 const board=f.api.leaderboard(snap,'strength'),by=name=>board.find(p=>p.name===name);
 assert.equal(by('Alt').rank.rankIndex,20,'legacy 13 (Protein Farter II) -> first new stage with the same boundary');
 assert.equal(by('Alt').rank.name,'Protein Farter II');
 assert.equal(by('Neu').rank.rankIndex,30);assert.equal(by('Neu').rank.name,'Superman Cycle II');
 assert.equal(by('Kaputt').rank,null,'legacy indices above 24 stay unknown');assert.equal(by('Gross').rank.name,'Mr. Olympia');
 assert.deepEqual([...board.map(p=>p.name)],['Gross','Neu','Alt','Ich','Kaputt']);
 const lifts=f.api.leaderboard(snap,'strength','bench-barbell-press--barbell');
 assert.deepEqual(JSON.parse(JSON.stringify(lifts.map(p=>[p.name,p.rank.rankIndex]))),[['Alt',39],['Neu',30]],'invalid lift indices are dropped, legacy 24 is Tren Cougher');
 f.api.view('board');assert.match(f.mount.innerHTML,/Superman Cycle II/);
 f.api.view('exercises');f.api.exercise('bench-barbell-press--barbell');assert.match(f.mount.innerHTML,/<strong>Alt<\/strong><small>Mr. Olympia/);assert(!f.mount.innerHTML.includes('Kaputt'));
 assert.equal(snap.friends[0].strength_rank,13,'board never rewrites the shared snapshot');
}

// Ohne aktivierte Freunde bleibt der Rückfall von friends.js unverändert.
{
 const f=fixture({snapshot:null});assert(f.mount.innerHTML.includes('legacy'));assert.equal(f.mount.dataset.fb,undefined);
 const off=fixture({snapshot:{self:null,friends:[],incoming:[],outgoing:[],nudges:[]}});assert(off.mount.innerHTML.includes('legacy'));
}

// Stage promotions depend only on strength; each is celebrated once.
{
 const f=fixture({snapshot:snapWith([]),strengthScore:12});
 assert.equal(f.ctx.state.display.lastRankSeen,12);assert.equal(f.ctx.state.display.rankScale,2);assert.equal(f.log.toasts.length,0);
 f.setXp(99999);assert.equal(f.api.celebrate(),false,'XP cannot raise strength');
 f.setStrength(13);assert.equal(f.api.celebrate(),true);assert.equal(f.ctx.state.display.lastRankSeen,13);
 assert.deepEqual(f.log.toasts,['Neuer Rang: High Melanin II']);assert(f.log.sounds.includes('rankUp'));
 assert.equal(f.api.celebrate(),false);f.api.view('ranks');assert.equal(f.log.toasts.length,1);
 const saves=f.log.saves;
 for(const score of [8,12,13,10,13]){
  f.setStrength(score);assert.equal(f.api.celebrate(),false,'previously seen ranks never celebrate again');
  assert.equal(f.ctx.state.display.lastRankSeen,13,'seen rank is a high-water mark');
 }
 assert.equal(f.log.saves,saves,'lower and recovered ranks do not write profile data');
 f.setStrength(14);assert.equal(f.api.celebrate(),true);assert.equal(f.ctx.state.display.lastRankSeen,14);
 assert.match(f.mount.innerHTML,/Deine Übungen/);assert.match(f.mount.innerHTML,/Noch [^<]+ kg bei/);
 assert.equal((f.mount.innerHTML.match(/class="fb-rung /g)||[]).length,18);
 assert.match(f.mount.innerHTML,/<strong>Mr. Olympia<\/strong><small><\/small>/);assert.match(f.mount.innerHTML,/<strong>Gym Tourist<\/strong><small>I · II · III/);
 assert.match(f.mount.innerHTML,/<strong>Tren Cougher<\/strong><small>I · II<\/small>/);
 assert(!/<strong>Tren Cougher<\/strong><small>I · II · III/.test(f.mount.innerHTML));
 f.setStrength(39);assert.equal(f.api.celebrate(),true);assert.deepEqual(f.log.toasts.at(-1),'Neuer Rang: Mr. Olympia');assert.equal(f.ctx.state.display.lastRankSeen,39);
 const unknown=fixture({snapshot:snapWith([]),strengthScore:null});unknown.api.view('ranks');assert.match(unknown.mount.innerHTML,/Rang unbekannt/);assert.equal(unknown.log.saves,0);
 unknown.api.view('exercises');assert.match(unknown.mount.innerHTML,/Rang unbekannt/);assert(!unknown.mount.innerHTML.includes('kg/KG'));
 f.api.view('exercises');assert.match(f.mount.innerHTML,/pulsFriendsBoard.exercise/);assert.match(f.mount.innerHTML,/kg\/KG/);
}

// v93: old 25-stage marks migrate once (rankScale 2); no false celebration from split stages,
// legacy 25/26 count as not seen (current rank = baseline), scale-2 values are never remapped.
for(const [display,migrated,quiet,celebrates] of [
 [{lastRankSeen:14},22,22,23],          // old High Melanin III -> Protein Farter I boundary; current 8 lower
 [{lastRankSeen:2},8,8,9],              // mapped 4 below current 8: current is the baseline
 [{lastRankSeen:25},8,8,9],[{lastRankSeen:26},8,8,9],
 [{lastRankSeen:30,rankScale:2},30,30,31],
 [{lastRankSeen:39,rankScale:2},39,39,null]
]){
 const f=fixture({snapshot:snapWith([]),display,strengthScore:8});
 assert.equal(f.ctx.state.display.rankScale,2);assert.equal(f.ctx.state.display.lastRankSeen,migrated,JSON.stringify(display));
 assert.equal(f.log.saves,0,'startup migration never saves');assert.equal(f.log.toasts.length,0,'no celebration after the update');
 f.ctx.pulsData87.migrate(f.ctx.state);assert.equal(f.ctx.state.display.lastRankSeen,migrated,'no second migration');
 f.setStrength(quiet);assert.equal(f.api.celebrate(),false,'reaching the migrated mark does not celebrate');
 if(celebrates===null){
  const saved=JSON.stringify(f.ctx.state.display),saves=f.log.saves;
  for(const score of [12,22,38,39]){
   f.setStrength(score);assert.equal(f.api.celebrate(),false);
   const current=f.ctx.pulsStrength.overall(f.ctx.state);assert.equal(current.rankIndex,score);
   f.api.view('ranks');
   assert(f.mount.innerHTML.includes('<strong class="fb-heroname">'+current.name+'</strong>'),'hero shows the recalculated rank');
  }
  assert.equal(JSON.stringify(f.ctx.state.display),saved);assert.equal(f.log.saves,saves);continue;
 }
 f.setStrength(celebrates);assert.equal(f.api.celebrate(),true,'real progress beyond it still celebrates');
 assert.equal(f.ctx.state.display.lastRankSeen,celebrates);
 const restored=JSON.parse(JSON.stringify(f.ctx.state));
 assert(f.ctx.validData(restored));assert.equal(restored.display.lastRankSeen,celebrates);assert.equal(restored.display.rankScale,2);
}
// A profile replaced at runtime (cloud/import) with an unmarked old value is migrated before comparing.
{
 const f=fixture({snapshot:snapWith([]),strengthScore:20});
 f.ctx.state={...f.ctx.state,display:{lastRankSeen:13}};
 assert.equal(f.api.celebrate(),false);assert.equal(f.ctx.state.display.rankScale,2);assert.equal(f.ctx.state.display.lastRankSeen,20);
 assert.equal(f.log.toasts.length,0,'old Protein Farter II -> Creatine Bloater III is not a new rank');
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
 // Profile replacement is a baseline; later local strength improvement still celebrates.
 const f=fixture({snapshot:snapWith([]),strengthScore:12}),saves=f.log.saves;
 f.ctx.state={...f.ctx.state,workouts:[],display:{lastRankSeen:0}};f.setXp(0);
 assert.equal(f.api.localXp(),0);assert.equal(f.api.celebrate(),false);assert.equal(f.log.saves,saves);
 f.setStrength(15);assert.equal(f.api.celebrate(),false);assert.equal(f.log.toasts.length,0);
 f.setStrength(8);assert.equal(f.api.celebrate(),false);
 f.setStrength(15);assert.equal(f.api.celebrate(),false,'profile baseline remains a high-water mark after a decline');
 f.setStrength(18);assert.equal(f.api.celebrate(),true);assert.deepEqual(f.log.toasts,['Neuer Rang: Creatine Bloater II']);

}
async function weightChecks(){
 const f=fixture({snapshot:snapWith([]),strengthScore:8});
 f.ctx.state.profile=null;f.ctx.state.weights=[];
 let opened=0,submit;
 f.ctx.openModal=(_,html)=>{opened++;f.nodes.get('mb').innerHTML=html};
 f.api.openRanks();assert.match(f.nodes.get('mb').innerHTML,/Gewicht eintragen/);
 assert(!f.nodes.get('mb').innerHTML.includes('class="fb-heroname">Rang unbekannt'));
 const modal=node('modal');modal.open=true;f.nodes.set('modal',modal);
 const input=node('wdate');input.closest=()=>({addEventListener:(event,fn)=>{assert.equal(event,'submit');submit=fn}});f.nodes.set('wdate',input);
 let formOpened=0;f.ctx.weightForm=()=>{formOpened++;modal.open=true};
 f.api.weight();assert.equal(formOpened,1);submit();await Promise.resolve();assert.equal(opened,1,'invalid save keeps form');
 f.ctx.state.weights=[{date:'2026-11-07',kg:100}];modal.open=false;submit();await Promise.resolve();
 assert.equal(opened,2);assert(!f.nodes.get('mb').innerHTML.includes('Gewicht eintragen'));
 assert(f.nodes.get('mb').innerHTML.includes('Low Estrogen III'));
}
asyncChecks().then(weightChecks).then(()=>console.log('PASS: friends board (ranks/emblems, cards, slacking band, podium 0/1/2/5, unknown rank, one-time rank-up, wiring, weight entry; no layout/backend).')).catch(error=>{console.error(error);process.exitCode=1});
