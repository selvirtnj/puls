/* Strength board: pure local projections and sanitized friend summaries.
 * Only display.lastRankSeen (high-water mark 0..39, with display.rankScale 2) is persisted for celebrations.
 * Friends without rank_scale 2 (older app versions) send stages 0..24; they are mapped via pulsStrength.fromLegacy. */
(function(){
'use strict';
const en=()=>typeof state!=='undefined'&&state?.language==='en';
const t=(de,eng)=>en()?eng:de;
const escape=value=>typeof esc==='function'?esc(String(value)):String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>typeof phIcon==='function'?phIcon(name):'';
const codeOK=value=>typeof value==='string'&&/^[A-F0-9]{12}$/.test(value);
const dayOK=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const number=value=>new Intl.NumberFormat(en()?'en-US':'de-DE').format(value);
const data=()=>window.pulsData87;
// Rangindex (0..17) -> Emblem-Art. Bestehende Ränge behalten ihre Embleme; 10..14 sind die v93-Ränge
// Gym Tourist, Pre-Workout Itcher, Creatine Bloater, Test Booster Believer, Blast & Cruiser (Art 7 bleibt ungenutzt).
const RANK_ART=[10,0,1,2,3,11,12,4,13,5,14,6,8,9,15,16,17,18];
const TOP_GROUP=RANK_ART.length-1;
const maxStage=()=>window.pulsStrength?.maxRankIndex??39;

/* ---------- Rang-Embleme ----------
   Flache Flächen in Systemfarben (Rand dunkel, Fläche, heller Facettenschnitt), keine Verläufe, kein Glow.
   Pracht steigt mit dem Rang: Kreis, Schild, Schild mit Ring, Sechseck, Sechseck mit Ring, Wappen,
   Wappen mit Flügeln, große Flügel, Stern mit Lorbeer, Zacken, zuletzt Flammenkranz und Krone. */
const COLORS=[
 ['#8E8E93','#5C5C61','#C7C7CC','#FFFFFF'],['#A2845E','#6E5434','#CDB592','#FFFFFF'],
 ['#34C759','#1F7A37','#86E3A0','#FFFFFF'],['#30B0C7','#1B7385','#86D6E4','#FFFFFF'],
 ['#007AFF','#004FA8','#6FB3FF','#FFFFFF'],['#3A5A8C','#22385E','#8FA9D1','#FFFFFF'],
 ['#A3264B','#6E1530','#E28AA3','#FFFFFF'],['#FF9500','#B86A00','#FFC46B','#FFFFFF'],
 ['#FF3B30','#B3231B','#FF8C86','#FFFFFF'],['#FFCC00','#A67C00','#FFE47A','#4A3500'],
 // v93: Stein (Gym Tourist, dunkles Symbol), Orange, Oliv, Bronze, Petrol.
 ['#C9BFAE','#857A66','#E8E1D5','#4D4436'],['#FF9500','#B86A00','#FFC46B','#FFFFFF'],
 ['#7D9A3A','#4E6420','#BCD38A','#FFFFFF'],['#B8733A','#7A4A1E','#E2B386','#FFFFFF'],['#1F7A74','#114A46','#7CC6BF','#FFFFFF'],
 // Insulin Gambler, HGH Gut, Open Class Monster, Mr. Olympia.
 ['#D65A35','#85351E','#F4AC84','#FFFFFF'],['#2D8F72','#165740','#83D6B4','#FFFFFF'],
 ['#435C75','#243747','#9CBAD2','#FFFFFF'],['#D8B450','#80631B','#FFF0AB','#372800']];
const SHAPES={
 circle:'M32 8a22 22 0 1 1 0 44a22 22 0 1 1 0-44Z',
 shield:'M32 7L51 13V29C51 41 43 49 32 54C21 49 13 41 13 29V13Z',
 hex:'M32 6L52.8 18V42L32 54L11.2 42V18Z',
 crest:'M32 5L41 9H52V28C52 41 43 50 32 55C21 50 12 41 12 28V9H23Z',
 star:'M32 4L42 10L52 11L54 22V36L46 47L32 56L18 47L10 36V22L12 11L22 10Z'};
const FORMS=[
 {shape:'circle'},{shape:'shield'},{shape:'shield',ring:1},{shape:'hex'},{shape:'hex',ring:1},
 {shape:'crest',wings:1},{shape:'crest',wings:2,ring:1},{shape:'star',wings:2,laurel:1},
 {shape:'star',wings:2,laurel:1,spikes:1,ring:1},{shape:'star',wings:2,laurel:1,spikes:1,ring:1,flames:1},
 {shape:'circle'},{shape:'hex'},{shape:'hex',ring:1},{shape:'crest',ring:1},{shape:'crest',wings:1,ring:1},
 {shape:'star',wings:2,ring:1,spikes:1},{shape:'crest',wings:2,laurel:1,ring:1},
 {shape:'star',wings:2,laurel:1,spikes:1,ring:1},{shape:'star',wings:2,laurel:1,spikes:1,ring:1,flames:1}];
const GLYPHS=[
 // Tropfen, Koffer, Blitz, Shaker, Hantel, Kettlebell, Flexarm, Blatt, Maske, Krone mit Rauch (24er Raster)
 '<path d="M12 2.5C12 2.5 5 10.6 5 15a7 7 0 0 0 14 0C19 10.6 12 2.5 12 2.5Z"/>',
 '<path d="M9 7V5.2C9 4.5 9.5 4 10.2 4h3.6c.7 0 1.2.5 1.2 1.2V7h4.5c.8 0 1.5.7 1.5 1.5v10c0 .8-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5v-10C3 7.7 3.7 7 4.5 7ZM10.6 7h2.8V5.6h-2.8Z" fill-rule="evenodd"/>',
 '<path d="M14 1.5L4.5 13.5H11L9.5 22.5L19.5 10H13Z"/>',
 '<path d="M7.5 3h9l-.8 3H8.3ZM7 7.5h10l-1.6 13c-.1.8-.7 1.5-1.5 1.5H10.1c-.8 0-1.4-.7-1.5-1.5ZM9 11h6v1.6H9Z" fill-rule="evenodd"/>',
 '<path d="M2 10.5h2V8.5h3v7H4v-2H2ZM22 10.5h-2V8.5h-3v7h3v-2h2ZM8 6.5h2.5v11H8ZM13.5 6.5H16v11h-2.5ZM10.5 11h3v2h-3Z"/>',
 '<path d="M8 9.2V7a4 4 0 0 1 8 0v2.2A7 7 0 1 1 8 9.2ZM10 8.3a7 7 0 0 1 4 0V7a2 2 0 0 0-4 0Z" fill-rule="evenodd"/>',
 '<path d="M5 3.5C6.8 2.8 8.6 3.2 9.2 4.6L9.8 6.2C10 7 9.4 7.6 8.6 7.6H8L8.6 11C10.6 9.4 13.8 9 16.4 10.2C19.6 11.6 21.2 14.4 20.6 17.2C20 20 17.4 21 14.6 21H6.6C4.6 21 3.4 19.6 3.6 17.6L4.2 8.4L3.8 6C3.6 4.8 4.1 3.9 5 3.5Z"/><path d="M11 15.5C12.6 14.2 15 14 16.8 15" fill="none" stroke-width="1.3" stroke-linecap="round" stroke="#6E1530"/>',
 '<path d="M4.5 20C4.5 11 10.5 4 20.5 3.5C21 13.5 14 19.5 5.5 19.5L4.5 21ZM8.5 16.8L15.5 8.5L16.3 9.2L9.3 17.5Z" fill-rule="evenodd"/>',
 '<path d="M2.5 7C8 4.8 16 4.8 21.5 7C21.8 14.5 17.6 20 12 20C6.4 20 2.2 14.5 2.5 7ZM6 10.2c1.4-.8 3-.8 4.2 0c-.6 1.6-3.4 1.6-4.2 0ZM13.8 10.2c1.2-.8 2.8-.8 4.2 0c-.8 1.6-3.6 1.6-4.2 0ZM9 15.2c2-1 4-1 6 0L14.4 16c-1.6-.6-3.2-.6-4.8 0Z" fill-rule="evenodd"/>',
 '<path d="M3.5 21.5V19h17v2.5ZM3.5 18L2.5 9.5L7.8 13.2L12 6.5L16.2 13.2L21.5 9.5L20.5 18Z"/><path d="M8 5.5C7 4.4 8.6 3.4 7.6 2M12 4.2C11 3 12.8 2 11.8.5M16 5.5C15 4.4 16.6 3.4 15.6 2" fill="none" stroke-width="1.3" stroke-linecap="round"/>',
 // v93: Kamera, Messlöffel mit Funken, Ballon, Kapsel mit Funkeln, Kreislaufpfeile
 '<path d="M8.6 5h6.8l1.4 2.2H20c.9 0 1.6.7 1.6 1.6v9.6c0 .9-.7 1.6-1.6 1.6H4c-.9 0-1.6-.7-1.6-1.6V8.8c0-.9.7-1.6 1.6-1.6h3.2ZM12 9.2a4.4 4.4 0 1 0 0 8.8a4.4 4.4 0 1 0 0-8.8ZM12 11.2a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8Z" fill-rule="evenodd"/>',
 '<path d="M2.5 11.5h12a6 6 0 0 1-12 0ZM14 12.2L21.2 9.1L22 10.9L14.6 14.1Z"/><path d="M4.2 10.5c.6-2.6 2.2-4 4.3-4s3.7 1.4 4.3 4Z"/><path d="M18.5 2.5l.7 1.7l1.7.7l-1.7.7l-.7 1.7l-.7-1.7l-1.7-.7l1.7-.7Z"/>',
 '<path d="M12 2.5c3.9 0 6.8 3 6.8 7c0 4.3-3.4 7.6-5.6 8.4l.9 1.8H9.9l.9-1.8C8.6 17.1 5.2 13.8 5.2 9.5c0-4 2.9-7 6.8-7ZM9.4 6.2c-1.3.8-2 2.1-2.1 3.6l1.3.1c.1-1.1.6-2 1.5-2.6Z" fill-rule="evenodd"/><path d="M12 20.2c-.9.8-.9 1.4 0 2.2" fill="none" stroke-width="1.3" stroke-linecap="round"/>',
 '<g transform="rotate(-45 12 12)"><path d="M7.5 8h4.5v8H7.5a4 4 0 0 1 0-8Z"/><path d="M12.8 8h3.7a4 4 0 0 1 0 8h-3.7Z" fill-opacity=".55"/></g><path d="M5 2.8l.6 1.5l1.5.6l-1.5.6l-.6 1.5l-.6-1.5l-1.5-.6l1.5-.6Z"/><path d="M19.5 17.6l.4 1l1 .4l-1 .4l-.4 1l-.4-1l-1-.4l1-.4Z"/>',
 '<path d="M18.6 12a6.6 6.6 0 0 1-11.27 4.67M5.4 12a6.6 6.6 0 0 1 11.27-4.67" fill="none" stroke-width="2.4" stroke-linecap="round"/><path d="M5.6 15L9.2 15.7L6.3 18.5Z"/><path d="M18.4 9L14.8 8.3L17.7 5.5Z"/>',
 // Dice, abdomen, Monster, Siegerpokal.
 '<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="'+COLORS[15][1]+'"><circle cx="7" cy="7" r="1.5"/><circle cx="17" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></g>',
 '<path d="M8 2h8l1 5c6 6 5 15-5 15S1 13 7 7Z"/><circle cx="12" cy="14" r="1.5" fill="'+COLORS[16][1]+'"/>',
 '<path d="M3 3l6 4h6l6-4-2 9 2 7-9 4-9-4 2-7Z"/><path d="M6 10l4 2M18 10l-4 2M8 17h8" fill="none" stroke="'+COLORS[17][1]+'" stroke-width="2"/>',
 '<path d="M7 2h10v4h5v4c0 4-3 6-7 6l-1 2v2h4v2H6v-2h4v-2l-1-2c-4 0-7-2-7-6V6h5Zm0 6H4v2c0 2 1 3 3 3Zm10 0v5c2 0 3-1 3-3V8Z"/>'];
const WING={1:'M14 18L4 15L8 23L3 27L10 30L7 36L14 34Z',2:'M13 13L-1 8L5 18L-2 23L7 27L0 33L9 36L4 43L14 40Z'};
const FLAME_OUTER='M32 -7C37 2 45 1 43 -6C53 3 59 14 57 27C62 23 63 17 62 13C70 28 66 47 54 58H10C-2 47 -6 28 2 13C1 17 2 23 7 27C5 14 11 3 21 -6C19 1 27 2 32 -7Z';
const FLAME_INNER='M32 -1C36 6 42 6 41 1C49 9 53 19 51 30H13C11 19 15 9 23 1C22 6 28 6 32 -1Z';
let uid=0;
const around=(scale,d)=>`<path d="${d}" transform="translate(32 30) scale(${scale}) translate(-32 -30)"`;
function laurel(color){
 let out='';
 // Je Seite vier Blätter, beginnend unten und entlang des Schildrands nach oben.
 for(const side of [-1,1])for(let k=0;k<4;k++){
  const deg=side<0?200+k*17:160-k*17,theta=deg*Math.PI/180,r=27;
  const x=32+r*Math.sin(theta),y=31-r*Math.cos(theta),rot=deg+(side<0?-30:30);
  out+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.2" ry="1.9" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}"/>`;
 }
 return out;
}
function emblem(index,stage=1,size=40,{label=''}={}){
 const box='-6 -9 76 84',attrs=`class="fb-emblem" viewBox="${box}" width="${size}" height="${Math.round(size*84/76)}" ${label?`role="img" aria-label="${escape(label)}"`:'aria-hidden="true"'} focusable="false"`;
 if(!Number.isInteger(index)||index<0||index>TOP_GROUP){
  // Fehlende Kraftdaten: Fragezeichen, kein erfundener Rang.
  return `<svg ${attrs}><path d="${SHAPES.circle}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" opacity=".55"/><text x="32" y="38" text-anchor="middle" font-size="22" font-weight="700" fill="currentColor" opacity=".7">?</text></svg>`;
 }
 const art=RANK_ART[index];
 const [base,rim,light,glyph]=COLORS[art],form=FORMS[art],shape=SHAPES[form.shape],clip='fbclip'+(++uid);
 let svg=`<svg ${attrs}>`;
 if(form.flames)svg+=`<path class="fb-flame" d="${FLAME_OUTER}" fill="#FF3B30"/><path class="fb-flame" d="${FLAME_INNER}" fill="#FF9500"/>`;
 if(form.wings){svg+=`<g class="fb-wings" fill="${light}" stroke="${rim}" stroke-width="1.5" stroke-linejoin="round"><path d="${WING[form.wings]}"/><path d="${WING[form.wings]}" transform="matrix(-1 0 0 1 64 0)"/></g>`}
 if(form.laurel)svg+=`<g class="fb-laurel">${laurel(rim)}</g>`;
 if(form.spikes)svg+=`<g fill="${rim}"><path d="M22 12L24 1L29 9Z"/><path d="M28.5 8L32 -4L35.5 8Z"/><path d="M35 9L40 1L42 12Z"/></g>`;
 svg+=`<defs><clipPath id="${clip}">${around(.86,shape)}/></clipPath></defs>`;
 svg+=`<path d="${shape}" fill="${rim}" stroke="${rim}" stroke-width="1.5" stroke-linejoin="round"/>`;
 svg+=`${around(.86,shape)} fill="${base}"/>`;
 // Facettenschnitt: links oben heller (flach, wie geschliffen), kein Verlauf.
 svg+=`<path d="M-10 -10H32V30L-10 64Z" fill="${light}" opacity=".45" clip-path="url(#${clip})"/>`;
 if(form.ring)svg+=`${around(.7,shape)} fill="none" stroke="${light}" stroke-width="1.6"/>`;
 svg+=`<g transform="translate(32 30) scale(${form.shape==='circle'?.95:1.05}) translate(-12 -12)" fill="${glyph}" stroke="${glyph}" stroke-width="0">${GLYPHS[art]}</g>`;
 const stageCount=window.pulsStrength?.ranks[index]?.stages.length??(index===TOP_GROUP?1:index<5?3:2);
 if(stageCount>1)for(let i=0;i<stageCount;i++)svg+=`<circle cx="${32+(i-(stageCount-1)/2)*8}" cy="67" r="2.8" ${i<stage?`fill="${base}" stroke="${rim}"`:`fill="none" stroke="currentColor" opacity=".45"`} stroke-width="1.2"/>`;
 else svg+=`<path d="M32 61.5L35 66.5L32 71.5L29 66.5Z" fill="${base}" stroke="${rim}" stroke-width="1.2"/>`;
 return svg+'</svg>';
}

/* ---------- Lorbeerkränze fürs Podium (eigene Zeichnung) ---------- */
const MEDALS={1:['#FFCC00','#A67C00'],2:['#C7C7CC','#7C7C80'],3:['#D08A52','#8A4F22']};
function wreath(place){
 const [fill,rim]=MEDALS[place]||MEDALS[3];let leaves='';
 for(const side of [-1,1]){
  let branch='';
  for(let k=0;k<8;k++){
   const deg=side<0?198+k*18:162-k*18,theta=deg*Math.PI/180,r=k%2?44:41;
   const x=50+r*Math.sin(theta),y=50-r*Math.cos(theta),rot=deg+(side<0?-28:28);
   const rx=(7.4-k*.35).toFixed(1);
   branch+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="3.1" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  leaves+=`<g class="fb-wreath-half fb-wreath-${side<0?'l':'r'}" fill="${fill}" stroke="${rim}" stroke-width="1">${branch}</g>`;
 }
 return `<svg class="fb-wreath" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${leaves}<circle cx="50" cy="93" r="3.2" fill="${fill}" stroke="${rim}" stroke-width="1"/></svg>`;
}

/* ---------- Eigene Werte (lokal, ohne Zustandsänderung) ---------- */
// Kurzer Cache nur für dasselbe Profilobjekt und dieselben Trainingslisten; Profilwechsel (neues state-Objekt) verwirft ihn.
let xpCache={at:0,value:null,state:null,workouts:null,runs:null};
const currentState=()=>typeof state!=='undefined'?state:null;
function localXp(){
 const s=currentState();
 if(s&&xpCache.state===s&&xpCache.workouts===s.workouts&&xpCache.runs===s.runs&&Date.now()-xpCache.at<800)return xpCache.value;
 let value=null;
 if(typeof totalWorkoutXP==='function'&&typeof state!=='undefined'){
  // totalWorkoutXP nutzt runList(), das alten Profilen runs=[] hinzufügt: auf flacher Kopie rechnen.
  const original=state;
  try{if(!Array.isArray(state.runs))state={...state,runs:[]};const total=totalWorkoutXP();if(typeof total==='number'&&Number.isFinite(total))value=Math.max(0,Math.round(total))}
  catch{value=null}finally{state=original}
 }
 xpCache={at:Date.now(),value,state:s,workouts:s?.workouts,runs:s?.runs};return value;
}
function localStreak(){
 // Gleiche Regel wie friends.js summary(): drei volle Ruhetage unterbrechen die Serie.
 try{
  const days=[...new Set([...completedWorkouts().filter(w=>loggedSets(w).length).map(w=>w.date),
   ...(Array.isArray(state.runs)?state.runs:[]).map(r=>r.date)].filter(d=>dayOK(d)&&d<=today()))].sort();
  const last=days.at(-1)||null,serial=v=>{const [y,m,d]=v.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000};
  let count=0;
  if(last&&serial(today())-serial(last)<4){count=1;for(let i=days.length-2;i>=0;i--){if(serial(days[i+1])-serial(days[i])>=4)break;count++}}
  return {streak:count,last};
 }catch{return {streak:0,last:null}}
}
// rankIndex always on scale 2 (0..39); friend values are normalized in people().
function rankFor(rankIndex){
 if(!Number.isInteger(rankIndex)||rankIndex<0||rankIndex>maxStage())return null;
 return window.pulsStrength?.rankAt(rankIndex)||null;
}
// Older app versions publish without rank_scale: stages 0..24 of the nine-group scale.
function friendStage(value,scale){
 if(!Number.isInteger(value)||value<0)return null;
 if(scale===2)return value<=maxStage()?value:null;
 const map=window.pulsStrength?.fromLegacy;
 return value<=24&&typeof map==='function'?map(value):null;
}
function onScale(p){
 const scale=p.rank_scale===2?2:1;
 const lifts=(Array.isArray(p.lift_ranks)?p.lift_ranks:[]).map(r=>({...r,rankIndex:friendStage(r?.rankIndex,scale)})).filter(r=>r.rankIndex!==null);
 return {...p,strength_rank:friendStage(p.strength_rank,scale),lift_ranks:lifts,rank_scale:2};
}
const ownRank=()=>{const r=window.pulsStrength?.overall();return r?.index==null?null:r};
const rankText=rank=>rank?escape(rank.name):t('Rang unbekannt','Rank unknown');

/* ---------- Daten für die Ansichten ---------- */
const initials=name=>{const parts=String(name).trim().split(/\s+/).filter(Boolean);const chars=parts.length>1?[...parts[0]].slice(0,1).concat([...parts[1]].slice(0,1)):[...(parts[0]||'?')].slice(0,2);return chars.join('').toUpperCase()};
function people(snap){
 if(!snap?.self)return [];
 const own=localStreak(),ownXp=localXp(),strength=window.pulsStrength?.summary()||{strength_rank:null,lift_ranks:[]};
 const me={code:snap.self.code,name:snap.self.name,self:true,...strength,xp:ownXp??snap.self.xp??null,streak:own.streak,last_training:own.last,broken:false};
 const stale=p=>dayOK(p.last_training)&&new Date(today()+'T12:00:00Z')-new Date(p.last_training+'T12:00:00Z')>=4*86400000;
 return [me,...(snap.friends||[]).map(p=>({...onScale(p),self:false,streak:stale(p)?0:Number.isInteger(p.streak)?p.streak:0,slacking:!!p.broken||stale(p)}))];
}
function leaderboard(snap,metric='strength',exerciseKey=null){
 const rows=people(snap).map(p=>{
  const lifts=p.lift_ranks||[],lift=exerciseKey?lifts.find(r=>r.key===exerciseKey):null;
  const ratio=exerciseKey?lift?.ratio:lifts.length?lifts.reduce((n,r)=>n+r.ratio,0)/lifts.length:null;
  const rank=exerciseKey?rankFor(lift?.rankIndex):p.self?ownRank():rankFor(p.strength_rank);
  return {...p,ratio,rank,userLevel:Number.isInteger(p.xp)&&typeof xpProgress==='function'?xpProgress(p.xp).level:null};
 }).filter(p=>!exerciseKey||p.rank);
 const value=p=>metric==='streak'?p.streak:p.rank?.rankIndex??-1;
 return rows.sort((a,b)=>value(b)-value(a)||(metric==='streak'?0:(b.ratio??-1)-(a.ratio??-1))||(b.self-a.self)||String(a.name).localeCompare(String(b.name)))
  .map((p,i)=>({...p,place:i+1}));
}
function lastText(day){
 if(!dayOK(day))return t('Noch kein Training','No training yet');
 const diff=Math.round((new Date(today()+'T12:00:00Z')-new Date(day+'T12:00:00Z'))/86400000);
 if(diff<=0)return t('Zuletzt trainiert: heute','Last trained: today');
 if(diff===1)return t('Zuletzt trainiert: gestern','Last trained: yesterday');
 return t(`Zuletzt trainiert vor ${diff} Tagen`,`Last trained ${diff} days ago`);
}
function cooldownHours(p){
 if(!p.last_nudge)return 0;const left=12*3600000-(Date.now()-Date.parse(p.last_nudge));
 return left>0?Math.max(1,Math.ceil(left/3600000)):0;
}
const flame=(count,cls='')=>`<span class="fb-streak${count>0?' on':''}${cls?' '+cls:''}" aria-label="${t('Serie','Streak')} ${count}">${icon('fire')}<b>${count}</b></span>`;
const MEGAPHONE='<svg class="fb-megaphone" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10v4c0 .6.4 1 1 1h2l1.4 4.6c.2.8 1 1.4 1.9 1.4H10l-1.2-6H10l9 4.5V4.5L10 9H4c-.6 0-1 .4-1 1Z" fill="currentColor"/><path d="M21.5 9.5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/* ---------- Zustand der Ansicht ---------- */
let view='friends',metric='strength',exerciseKey='',animated=new Set();
const anim=key=>{if(animated.has(key))return false;animated.add(key);return true};
function avatar(p,cls=''){
 const color=p.rank?COLORS[RANK_ART[p.rank.index]][0]:'var(--ds-separator)';
 return `<span class="fb-avatar${cls?' '+cls:''}" style="--fb-rank:${color}" aria-hidden="true">${escape(initials(p.name))}</span>`;
}
function meHTML(me){
 const r=me.rank;
 return `<button type="button" class="fb-me" onclick="pulsFriendsBoard.view('ranks')" aria-label="${t('Dein Rang','Your rank')}: ${rankText(r)}">
  <span class="fb-me-emblem" data-fb-own-emblem>${emblem(r?.index,r?.stage,48)}</span>
  <span class="fb-me-text"><strong>${escape(me.name)} <small>(${t('Du','You')})</small></strong><small>${rankText(r)}${me.userLevel!==null?` · Level ${me.userLevel}`:''}</small>
   ${r?`<span class="fb-meter" aria-hidden="true"><i style="width:${Math.round(r.progress*100)}%"></i></span>`:''}</span>
  ${flame(me.streak)}</button>`;
}
function cardHTML(p,i,play){
 const r=p.rank,hours=p.slacking?cooldownHours(p):0,code=codeOK(p.code)?p.code:'';
 const motion=play?` data-motion="enter" style="--motion-i:${Math.min(i,8)}"`:'';
 const band=p.slacking&&code?`<button type="button" class="fb-slack" ${hours?'disabled':''} onclick="pulsFriendsBoard.warn('${code}',this)" aria-label="${escape(p.name)}: ${hours?t(`Bereits gewarnt, wieder in ${hours} h`,`Already warned, again in ${hours} h`):t('Slacking, zum Warnen tippen','Slacking, tap to warn')}">
   <strong>SLACKING!</strong><span>${hours?t(`Gewarnt · wieder in ${hours} h`,`Warned · again in ${hours} h`):t('Zum Warnen tippen','Tap to warn')}${MEGAPHONE}</span></button>`:'';
 return `<li class="fb-card${p.slacking?' slacking':''}${play?' motion-play':''}"${code?` data-code="${code}"`:''}${motion}>
  <div class="fb-cardmain">
   <span class="fb-avatarwrap">${avatar(p)}${p.userLevel!==null?`<span class="fb-lvl" aria-label="Level ${p.userLevel}">${p.userLevel}</span>`:''}</span>
   <span class="fb-cardtext"><strong>${escape(p.name)}</strong><small>${rankText(r)}</small><small>${lastText(p.last_training)}</small></span>
   <span class="fb-cardside">${emblem(r?.index,r?.stage,36)}${flame(p.streak)}</span>
   ${code?`<details class="fb-menu"><summary aria-label="${t('Optionen für','Options for')} ${escape(p.name)}">${icon('dots-three')}</summary><button type="button" class="btn secondary" onclick="pulsFriends.action('${code}','remove')">${t('Entfernen','Remove')}</button></details>`:''}
  </div>${band}</li>`;
}
function friendsHTML(list,play){
 const me=list.find(p=>p.self),friends=list.filter(p=>!p.self).sort((a,b)=>String(b.last_training||'').localeCompare(String(a.last_training||''))||String(a.name).localeCompare(String(b.name)));
 return `${me?meHTML(me):''}
  <h3 class="fb-title">${t('Freunde','Friends')} <small>${friends.length}</small></h3>
  ${friends.length?`<ul class="fb-cards">${friends.map((p,i)=>cardHTML(p,i,play)).join('')}</ul>`:`<p class="fb-empty">${t('Noch keine Freunde. Teile unten deinen Code und schick eine Anfrage.','No friends yet. Share your code below and send a request.')}</p>`}`;
}
function valueHTML(p,small=false){
 if(metric==='streak')return flame(p.streak,small?'sm':'');
 return p.rank?`<span class="fb-xpval">${emblem(p.rank.index,p.rank.stage,small?20:24)}<b>${rankText(p.rank)}</b></span>`:`<span class="fb-xpval unknown">${t('Rang unbekannt','Rank unknown')}</span>`;
}
function boardHTML(list,play){
 const top=list.slice(0,3),rest=list.slice(3),order=[top[1],top[0],top[2]].filter(Boolean);
 const rise=place=>({3:0,2:1,1:2})[place];
 const podium=top.length?`<div class="fb-podium${play?' fb-anim':''}" data-size="${top.length}">${order.map(p=>`
   <div class="fb-pod fb-pod-${p.place}${p.self?' self':''}" style="--motion-i:${rise(p.place)}">
    <div class="fb-pod-person">
     <span class="fb-wreathwrap">${wreath(p.place)}${avatar(p,'lg')}</span>
     <strong class="fb-pod-name">${escape(p.name)}${p.self?` <small>(${t('Du','You')})</small>`:''}</strong>
     ${valueHTML(p)}
    </div>
    <div class="fb-step${play?' motion-play':''}" ${play?'data-motion="rise"':''} style="--motion-i:${rise(p.place)}" aria-label="${t('Platz','Place')} ${p.place}"><span>${p.place}</span></div>
   </div>`).join('')}</div>`:'';
 const rows=rest.map((p,i)=>`<li class="fb-row${p.self?' self':''}${play?' motion-play':''}" ${play?`data-motion="enter" style="--motion-i:${Math.min(i+3,10)}"`:''}>
   <span class="fb-place">${p.place}</span>${avatar(p)}
   <span class="fb-rowtext"><strong>${escape(p.name)}${p.self?` <small>(${t('Du','You')})</small>`:''}</strong><small>${rankText(p.rank)}</small></span>
   ${valueHTML(p,true)}</li>`).join('');
 return `<div class="segmented fb-metric" role="group" aria-label="${t('Kennzahl','Metric')}">
   <button type="button" aria-pressed="${metric==='strength'}" onclick="pulsFriendsBoard.metric('strength')">${t('Rang','Rank')}</button>
   <button type="button" aria-pressed="${metric==='streak'}" onclick="pulsFriendsBoard.metric('streak')">${t('Serie','Streak')}</button></div>
  ${podium}${rows?`<ol class="fb-rows" start="4">${rows}</ol>`:''}
  ${list.length<2?`<p class="fb-empty">${t('Sobald Freunde dabei sind, erscheinen sie hier im Vergleich.','Once friends join, they appear here for comparison.')}</p>`:''}`;
}
function nextText(r){
 if(!r)return t('Rang unbekannt','Rank unknown');
 if(r.nextAt===null)return t('Endrang','Final rank');
 const lift=r.nextLift;
 return lift?t(`Noch ${number(Math.ceil(lift.kg*10)/10)} kg bei ${escape(lift.exerciseName)} × ${lift.reps}`,`${number(Math.ceil(lift.kg*10)/10)} kg more at ${escape(lift.exerciseName)} × ${lift.reps}`):escape(r.nextName||'');
}
function ranksHTML(play){
 const xp=localXp(),r=ownRank(),ranks=data()?.ranks||[];
 const missingWeight=!r&&window.pulsStrength?.weightAt(state,today())===null;
 const weightButton=`<button type="button" class="textbtn" onclick="pulsFriendsBoard.weight()">${t('Gewicht eintragen','Add weight')}</button>`;
 const hero=`<div class="fb-rankhero"><span class="fb-heroemblem" data-fb-own-emblem>${emblem(r?.index,r?.stage,104,{label:r?.name||t('Rang unbekannt','Rank unknown')})}</span>
  <strong class="fb-heroname">${missingWeight?weightButton:rankText(r)}</strong><small>Level ${typeof xpProgress==='function'?xpProgress(xp||0).level:1} · ${number(xp||0)} XP</small>
  ${r?`<span class="fb-meter big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.progress*100)}" aria-label="${t('Fortschritt zur nächsten Stufe','Progress to next stage')}"><i style="width:${Math.round(r.progress*100)}%"></i></span><small>${nextText(r)}</small>`:''}</div>`;
 const own=window.pulsStrength?.all()||[];
 const lifts=own.map(e=>`<li class="fb-liftrow">${emblem(e.index,e.stage,32)}<span><strong>${escape(e.exerciseName)}</strong><small>${escape(e.name)} · ${number(Math.round(e.ratio*100)/100)} ${t('kg/KG','kg/BW')}</small></span></li>`).join('');
 const rungs=[...ranks].reverse().map((g,i)=>{
  const status=!r?'future':g.index<r.index?'done':g.index===r.index?'current':'future';
  const stage=status==='done'?3:status==='current'?r.stage:0;
  return `<li class="fb-rung ${status}${play?' motion-play':''}" ${play?`data-motion="enter" style="--motion-i:${Math.min(i,10)}"`:''}>
   ${emblem(g.index,stage,44)}<span class="fb-rungtext"><strong>${escape(g.name)}</strong><small>${g.stages.length===1?'':g.stages.map((_,j)=>['I','II','III'][j]).join(' · ')}</small></span>
   <span class="fb-rungstate">${status==='current'?`<b>${t('Du','You')}</b>`:status==='done'?icon('check-circle'):''}</span></li>`;
 }).join('');
 return `${hero}<h3 class="fb-title">${t('Deine Übungen','Your exercises')}</h3><ul class="fb-lifts">${lifts||(missingWeight?'':`<li class="fb-empty">${t('Rang unbekannt','Rank unknown')}</li>`)}</ul><h3 class="fb-title">${t('Alle Ränge','All ranks')}</h3><ol class="fb-ladder">${rungs}</ol>`;
}
function exercisesHTML(snap){
 const choices=new Map();for(const p of people(snap))for(const e of p.lift_ranks||[])if(!choices.has(e.key))choices.set(e.key,e.name);
 const sorted=[...choices].sort((a,b)=>a[1].localeCompare(b[1]));
 if(!choices.has(exerciseKey))exerciseKey=sorted[0]?.[0]||'';
 const rows=exerciseKey?leaderboard(snap,'strength',exerciseKey):[];
 return `<label class="fb-exercise-select">${t('Übung','Exercise')}<select onchange="pulsFriendsBoard.exercise(this.value)">${sorted.map(([key,name])=>`<option value="${escape(key)}" ${key===exerciseKey?'selected':''}>${escape(name)}</option>`).join('')}</select></label>
  <ol class="fb-rows">${rows.map(p=>`<li class="fb-row"><span class="fb-place">${p.place}</span>${emblem(p.rank.index,p.rank.stage,32)}<span class="fb-rowtext"><strong>${escape(p.name)}${p.self?` (${t('Du','You')})`:''}</strong><small>${rankText(p.rank)}</small></span><b>${number(p.ratio)} ${t('kg/KG','kg/BW')}</b></li>`).join('')||`<li class="fb-empty">${t('Rang unbekannt','Rank unknown')}</li>`}</ol>`;
}
function tabsHTML(){
 const tab=(key,label)=>`<button type="button" aria-pressed="${view===key}" onclick="pulsFriendsBoard.view('${key}')">${label}</button>`;
 return `<div class="segmented fb-tabs" role="group" aria-label="${t('Ansicht','View')}">${tab('friends',t('Freunde','Friends'))}${tab('board',t('Bestenliste','Leaderboard'))}${tab('exercises',t('Übungen','Exercises'))}${tab('ranks',t('Ränge','Ranks'))}</div>`;
}

/* ---------- Rang-Aufstieg einmalig feiern ---------- */
function persistSeen(index){
 if(typeof state==='undefined'||!state||typeof save!=='function')return false;
 // Nicht während Cloud-Übernahme oder Wiederherstellung schreiben; beim nächsten Anzeigen erneut.
 const flag=read=>{try{return !!read()}catch{return false}};
 if(flag(()=>cloudApplying)||flag(()=>cloudBusy)||flag(()=>stateLoadCorrupt))return false;
 if(!state.display||typeof state.display!=='object'||Array.isArray(state.display))state.display={};
 // Values are always written on scale 2; celebrate() migrates unmarked values first.
 if(state.display.rankScale===2&&Number.isInteger(state.display.lastRankSeen)&&state.display.lastRankSeen>=index)return true;
 state.display.rankScale=2;state.display.lastRankSeen=index;try{save()}catch(error){console.error(error)}return true;
}
// Gefeiert wird nur ein Aufstieg innerhalb desselben Profilobjekts. Nach einem Profilwechsel
// (Login, Cloud-Übernahme, Import) gilt der dann berechnete Rang als Ausgangspunkt.
let rankBase={state:null,index:-1};
function celebrate(root=document){
 const s=currentState(),r=ownRank();if(!r||!s)return false;
 // Old 25-stage marks (no rankScale 2) are mapped once before comparing; see puls-data-v87 migrate.
 if(s.display?.rankScale!==2&&typeof data()?.migrate==='function'){try{data().migrate(s)}catch(error){console.error(error)}}
 const storedSeen=s.display?.rankScale===2?data()?.display?.().lastRankSeen:undefined;
 const seen=Number.isInteger(storedSeen)?Math.min(maxStage(),storedSeen):storedSeen;
 if(!Number.isInteger(seen)){persistSeen(r.rankIndex);rankBase={state:s,index:r.rankIndex};return false} // Erste Anzeige: merken, nicht feiern.
 // App-Start (noch kein Profil gesehen): ungesehener Aufstieg zählt. Wechsel zu einem anderen Profilobjekt: nur Ausgangspunkt.
 if(rankBase.state&&rankBase.state!==s){rankBase={state:s,index:Math.max(r.rankIndex,seen)};return false}
 if(r.rankIndex<=seen||rankBase.state===s&&r.rankIndex<=rankBase.index){rankBase={state:s,index:Math.max(r.rankIndex,seen,rankBase.state===s?rankBase.index:-1)};return false}
 rankBase={state:s,index:r.rankIndex};
 if(!persistSeen(r.rankIndex))return false;
 const target=root.querySelector?.('[data-fb-own-emblem]');
 if(target&&window.pulsMotion?.reveal)window.pulsMotion.reveal(target);else if(typeof pulsSound==='function')pulsSound('rankUp');
 if(typeof toast==='function')toast(t('Neuer Rang: ','New rank: ')+r.name);
 return true;
}

/* ---------- Einhängen ---------- */
function draw(mount,play){
 const snap=window.pulsFriendsData87?.getSnapshot?.();
 if(!snap?.self)return false;
 const list=leaderboard(snap,metric);
 const key=view+'|'+metric,animate=play!==false&&anim(key);
 const body=view==='board'?boardHTML(list,animate):view==='ranks'?ranksHTML(animate):view==='exercises'?exercisesHTML(snap):friendsHTML(list,animate);
 mount.dataset.fb='1';mount.classList.add('fb');mount.setAttribute('data-no-translate','');
 mount.innerHTML=`${tabsHTML()}<div class="fb-view fb-view-${view}">${body}</div>`;
 const panel=document.getElementById('puls-friends-panel');if(panel&&panel.firstElementChild!==mount)panel.prepend(mount);
 if(view!=='board')celebrate(mount);
 return true;
}
function enhance(){
 const mount=document.getElementById('puls-friends-board-mount');
 if(mount&&mount.dataset.fb!=='1')draw(mount);
}
function profileRow(){
 const group=document.querySelector('.accountoverview .accountprofilegroup');
 if(!group||group.querySelector('#fb-profile-rank'))return;
 const r=ownRank();
 group.insertAdjacentHTML('beforeend',`<button type="button" id="fb-profile-rank" class="dsrow fb-profilerank" data-no-translate onclick="pulsFriendsBoard.openRanks()">
  <span class="fb-profile-emblem" data-fb-own-emblem>${emblem(r?.index,r?.stage,40)}</span>
  <span class="dsrowtext"><span>${rankText(r)}</span><small>${nextText(r)}</small></span>
  <span class="dsrowchevron" aria-hidden="true">${icon('caret-right')}</span></button>`);
 celebrate(group);
}
// Gebündelt als Mikroaufgabe (läuft auch bei verdeckter Seite, anders als requestAnimationFrame).
let pending=false;
function schedule(){if(pending)return;pending=true;Promise.resolve().then(()=>{pending=false;try{enhance();profileRow()}catch(error){console.error(error)}})}
function setView(next){
 if(!['friends','board','exercises','ranks'].includes(next))return;
 view=next;const mount=document.getElementById('puls-friends-board-mount');if(mount)draw(mount);
 if(typeof pulsSound==='function')pulsSound('tap');
 mount?.querySelector('.fb-tabs [aria-pressed="true"]')?.focus({preventScroll:true});
}
function setExercise(key){exerciseKey=key;const mount=document.getElementById('puls-friends-board-mount');if(mount)draw(mount,false)}
function setMetric(next){
 if(next==='xp')next='strength';
 if(!['strength','streak'].includes(next))return;
 metric=next;const mount=document.getElementById('puls-friends-board-mount');if(mount)draw(mount);
 mount?.querySelector('.fb-metric [aria-pressed="true"]')?.focus({preventScroll:true});
}
// Erfolgsfeedback erst, wenn der neue Snapshot den Stups bestätigt (last_nudge frisch).
// Bei Limit, noch aktiver Serie, offline oder Fehler zeigt friends.js die Meldung; hier nur ein Warnton.
async function warn(code,button){
 if(!codeOK(code)||button?.disabled||!window.pulsFriends?.nudge)return false;
 const started=Date.now();
 if(button){button.disabled=true;button.classList.add('sent');const label=button.querySelector('span');if(label)label.textContent=t('Wird gesendet …','Sending …')}
 try{await window.pulsFriends.nudge(code)}catch(error){console.error(error)}
 const friend=window.pulsFriendsData87?.getSnapshot?.()?.friends?.find(p=>p.code===code);
 const sent=!!friend?.last_nudge&&Date.parse(friend.last_nudge)>=started-120000;
 if(sent){
  if(typeof pulsSound==='function')pulsSound('nudgeSend'); // haptics.js ergänzt die Haptik (medium).
  const card=document.querySelector(`.fb-card[data-code="${code}"]`);if(card)window.pulsMotion?.success?.(card);
 }else{
  if(typeof pulsSound==='function')pulsSound('warning');
  if(button?.isConnected){button.disabled=false;button.classList.remove('sent');const label=button.querySelector('span');if(label)label.textContent=t('Zum Warnen tippen','Tap to warn')}
 }
 return sent;
}
function openRanks(){
 if(typeof openModal!=='function')return;
 openModal(t('Ränge','Ranks'),`<section class="fb fb-standalone" data-no-translate>${ranksHTML(true)}</section>`);
 celebrate(document.getElementById('mb')||document);
}
function weight(){
 if(typeof weightForm!=='function')return;
 const owner=state;weightForm();
 // After a successful existing form save, return to the recalculated ranks.
 document.getElementById('wdate')?.closest('form')?.addEventListener('submit',()=>{
  Promise.resolve().then(()=>{if(state===owner&&!document.getElementById('modal')?.open)openRanks()});
 });
}
// Modal zu: Animationen dürfen beim nächsten Öffnen wieder spielen.
// Beobachtet das open-Attribut, weil Schließwege der App nicht immer ein close-Ereignis auslösen.
const sheet=document.getElementById('modal');
sheet?.addEventListener('close',()=>{animated=new Set()});
if(typeof MutationObserver==='function'){
 if(sheet)new MutationObserver(()=>{if(!sheet.open)animated=new Set()}).observe(sheet,{attributes:true,attributeFilter:['open']});
 const watch=id=>{const node=document.getElementById(id);if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true})};
 watch('mb');watch('content');
}
try{enhance();profileRow()}catch(error){console.error(error)}
window.pulsFriendsBoard=Object.freeze({view:setView,metric:setMetric,exercise:setExercise,warn,openRanks,weight,emblem,wreath,rankFor,localXp,localStreak,leaderboard,celebrate});
})();
