// Zurück per Wisch vom linken Rand: Kantenstart, Richtung, Schwelle, schneller Wisch, Ausschlüsse.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Kleiner Selektor-Abgleich für die im Skript benutzten einfachen Selektoren (tag, #id, .klasse, [attr], [attr^="v"]).
function matchesPart(el,part){
  let m=part.trim().match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)(:not\(#[\w-]+\))?$/i);if(!m)return false;
  let [,tag,id,classes,attrs,not]=m;
  if(tag&&el.tag!==tag)return false;
  if(id&&el.id!==id.slice(1))return false;
  for(let c of classes.split('.').filter(Boolean))if(!el.classList.contains(c))return false;
  for(let a of attrs.match(/\[[^\]]+\]/g)||[]){
    let [,name,op,value]=a.match(/^\[([\w-]+)(?:(\^?=)"?([^"]*)"?)?\]$/);
    if(!(name in el.attrs))return false;
    if(op==='='&&el.attrs[name]!==value)return false;
    if(op==='^='&&!String(el.attrs[name]).startsWith(value))return false;
  }
  if(not&&el.id===not.slice(5,-1))return false;
  return true;
}
class El{
  constructor(tag,{id='',cls=[],attrs={},text='',visible=true,rect={top:0,bottom:844,left:0,right:390,width:390}}={}){
    this.tag=tag;this.id=id;this.attrs={...attrs};this.textContent=text;this.visible=visible;this.rect=rect;this.parentElement=null;this.children=[];
    this.nodeType=1;this.scrollWidth=0;this.clientWidth=0;this.overflowX='visible';this.disabled=false;this.clicks=0;this.listeners={};this.open=false;
    let set=new Set(cls);this.classList={contains:c=>set.has(c),add:(...c)=>c.forEach(x=>set.add(x)),remove:(...c)=>c.forEach(x=>set.delete(x)),has:set};
    let styles={};this.style={removeProperty:k=>{delete styles[k]},setProperty:(k,v,p)=>{styles[k]=v;this.priority=p},get transform(){return styles.transform||''},set transform(v){styles.transform=v}};
  }
  append(...kids){for(let k of kids){k.parentElement=this;this.children.push(k)}return this}
  get isConnected(){return true}
  matches(sel){return sel.split(',').some(part=>matchesPart(this,part))}
  closest(sel){for(let n=this;n;n=n.parentElement)if(n.matches(sel))return n;return null}
  contains(el){for(let n=el;n;n=n.parentElement)if(n===this)return true;return false}
  all(){return this.children.flatMap(k=>[k,...k.all()])}
  querySelectorAll(sel){return this.all().filter(n=>n.matches(sel))}
  getAttribute(k){return k in this.attrs?this.attrs[k]:null}
  getClientRects(){return this.visible?[this.rect]:[]}
  getBoundingClientRect(){return this.rect}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn)}
  dispatch(type,ev={}){for(let fn of [...(this.listeners[type]||[])])fn({type,target:this,...ev})}
  click(){this.clicks++}
}

function setup({reduced=false,setupPending=false}={}){
  let html=new El('html'),body=new El('body'),main=new El('main'),content=new El('div',{id:'content'}),nav=new El('nav',{id:'nav'}),modal=new El('dialog',{id:'modal',rect:{top:300,bottom:844,left:0,right:390,width:390}}),mb=new El('div',{id:'mb'});
  html.append(body);body.append(main,nav,modal);main.append(content);modal.append(mb);
  let listeners={},timers=new Map(),timerId=0;
  const document={
    documentElement:html,
    addEventListener(type,fn,opts){listeners[type]={fn,opts}},
    getElementById:id=>[html,...html.all()].find(n=>n.id===id)||null,
    querySelector:sel=>html.all().find(n=>n.matches(sel))||null,
    querySelectorAll:sel=>html.all().filter(n=>n.matches(sel))
  };
  const ctx={document,window:{innerWidth:390,matchMedia:q=>({matches:reduced&&/reduce/.test(q)})},getComputedStyle:el=>({overflowX:el.overflowX}),
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),Date,Math,setupPending,console};
  // Zeit vergeht: fällige Timer laufen, abgebrochene (clearTimeout) nicht.
  const runTimers=()=>{let due=[...timers.values()];timers.clear();due.forEach(fn=>fn())};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/edge-back.js','utf8'),ctx);
  let id=0;
  const touch=(type,target,x,y,t)=>{let point={identifier:1,clientX:x,clientY:y},ev={type,target,timeStamp:t,cancelable:true,defaultPrevented:false,stopped:false,
    touches:type==='touchend'||type==='touchcancel'?[]:[point],changedTouches:[point],preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true}};
    listeners[type].fn(ev);return ev};
  // Wischt von (x0,y) über die Punkte path (je [x,y,ms]) und lässt los.
  const swipe=(target,x0,y,path,{cancel=false,settle=true}={})=>{let moves=[];touch('touchstart',target,x0,y,0);for(let [x,yy,t] of path)moves.push(touch('touchmove',target,x,yy,t));let last=path.at(-1)||[x0,y,0];touch(cancel?'touchcancel':'touchend',target,last[0],last[1],last[2]+1);if(settle)runTimers();return moves};
  return {ctx,listeners,html,body,main,content,nav,modal,mb,swipe,touch,runTimers,timers,gesture:()=>vm.runInContext('edgeBack.gesture',ctx),settle:()=>vm.runInContext('edgeBack.settle',ctx)};
}
const slow=(dx,y=400)=>[[12,y,50],[40,y+2,200],[dx*0.6,y+3,500],[dx,y+4,900]];   // langsam, ohne Schwung
const fast=[[12,400,10],[40,401,25],[70,402,40]];                          // kurz, aber schnell

// Listener: Start passiv, Bewegung nicht passiv (nur dann wird preventDefault benutzt), alles in der Capture-Phase.
{let s=setup();assert.equal(s.listeners.touchstart.opts.passive,true);assert.equal(s.listeners.touchmove.opts.passive,false);
 for(let t of ['touchstart','touchmove','touchend','touchcancel'])assert.equal(s.listeners[t].opts.capture,true,t);
 assert.equal(s.listeners.pointerdown,undefined,'Maus/Pointer bleibt unberührt')}

// Reine Entscheidungen.
{let s=setup(),axis=(dx,dy)=>vm.runInContext(`edgeBackAxis(${dx},${dy})`,s.ctx),out=(dx,v)=>vm.runInContext(`edgeBackOutcome(${dx},${v},390)`,s.ctx);
 assert.equal(axis(5,3),'wait');assert.equal(axis(30,5),'track');assert.equal(axis(-30,2),'abort');assert.equal(axis(12,20),'abort');assert.equal(axis(15,10),'abort');
 assert.equal(out(390*.35,0),true);assert.equal(out(100,.1),false);assert.equal(out(60,.9),true);assert.equal(out(30,2),false)}

// Konto → Darstellung: Kantenstart, horizontal, über 35 % → derselbe Zurück-Knopf wird geklickt.
{let s=setup(),back=new El('button',{cls:['accountback'],text:'Konto'}),row=new El('div',{cls:['dsrow']});s.content.append(back,row);
 let moves=s.swipe(row,8,400,slow(200));assert.equal(back.clicks,1);
 assert.equal(moves[0].defaultPrevented,false,'vor der Richtungserkennung bleibt alles frei');
 assert.equal(moves[1].defaultPrevented,true,'nach eindeutiger Erkennung wird das Scrollen blockiert');assert.equal(moves[1].stopped,true);
 assert.equal(s.content.priority,'important','gegen transform:none!important des Designsystems');assert.equal(s.content.style.transform,'','Transform wird zurückgesetzt');assert.equal(s.content.classList.contains('edgebackdragging'),false);assert.equal(s.gesture(),null)}

// Zu kurz und langsam → zurückfedern, kein Klick.
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);let row=new El('div');s.content.append(row);
 s.swipe(row,8,400,slow(100));assert.equal(back.clicks,0);assert.equal(s.content.style.transform,'')}

// Kurzer, schneller Wisch → auslösen.
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);let row=new El('div');s.content.append(row);
 s.swipe(row,8,400,fast);assert.equal(back.clicks,1)}

// Schnell angezogen, dann gehalten und unter der Schwelle losgelassen → kein Klick (alter Schwung zählt nicht).
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);let row=new El('div');s.content.append(row);
 s.swipe(row,8,400,[[30,400,30],[120,402,60],[125,402,560],[125,402,800]]);assert.equal(back.clicks,0)}

// touchcancel löst nie aus.
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);let row=new El('div');s.content.append(row);
 s.swipe(row,8,400,slow(300),{cancel:true});assert.equal(back.clicks,0)}

// Start außerhalb der Kante, vertikale Bewegung oder Bewegung nach links → nichts, Scrollen bleibt frei.
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);let row=new El('div');s.content.append(row);
 s.swipe(row,40,400,slow(300));assert.equal(back.clicks,0,'Start bei 40 px');
 let vertical=s.swipe(row,8,400,[[10,430,30],[14,520,80],[200,560,300]]);assert.equal(back.clicks,0,'vertikal');assert.equal(vertical.some(e=>e.defaultPrevented),false,'vertikales Scrollen nicht blockiert');
 s.swipe(row,20,400,[[2,401,30],[1,401,60]]);assert.equal(back.clicks,0,'nach links')}

// Hauptseiten ohne Zurück-Knopf: keine Geste, kein preventDefault (Tab-Wechsel und Scrollen unverändert).
{let s=setup(),row=new El('div');s.content.append(row);let moves=s.swipe(row,8,400,slow(300));assert.equal(s.gesture(),null);assert.equal(moves.some(e=>e.defaultPrevented),false)}

// Ausgeschlossene Ziele: Eingaben, Range, Karte, Wisch-Zeilen, Scroll-Rad, Karussell, horizontal scrollende Bereiche, Tab-Leiste.
{let s=setup(),back=new El('button',{cls:['accountback']});s.content.append(back);
 let targets=[new El('input',{attrs:{type:'range'}}),new El('textarea'),new El('select'),new El('div',{attrs:{contenteditable:'true'}})];
 let map=new El('div',{cls:['leaflet-container']}),swipeRow=new El('div',{cls:['swipediary']}),wheel=new El('div',{cls:['timewheel']}),track=new El('div',{cls:['nutritiontrack']}),chips=new El('div');
 chips.scrollWidth=600;chips.clientWidth=300;chips.overflowX='auto';
 for(let box of [map,swipeRow,wheel,track,chips]){let inner=new El('span');box.append(inner);targets.push(inner)}
 s.content.append(...targets.filter(t=>!t.parentElement),map,swipeRow,wheel,track,chips);
 for(let target of targets){let moves=s.swipe(target,8,400,slow(300));assert.equal(back.clicks,0,target.tag+' '+[...(target.parentElement?.classList.has||[])].join('.'));assert.equal(moves.some(e=>e.defaultPrevented),false)}
 let tabbar=new El('button');s.nav.append(tabbar);s.swipe(tabbar,8,800,slow(300,800));assert.equal(back.clicks,0,'Tab-Leiste')}

// Unsichtbare, versteckte oder deaktivierte Zurück-Knöpfe zählen nicht.
{let s=setup(),row=new El('div');let hidden=new El('button',{cls:['accountback'],visible:false}),wrap=new El('div',{attrs:{hidden:''}}),inner=new El('button',{cls:['accountback']}),off=new El('button',{cls:['accountback']});off.disabled=true;wrap.append(inner);s.content.append(hidden,wrap,off,row);
 s.swipe(row,8,400,slow(300));assert.equal(hidden.clicks+inner.clicks+off.clicks,0)}

// Vollbild-Ebenen (Laufen, laufendes Workout) und Erststart-Einrichtung blockieren.
for(let id of ['run-root','session-root']){let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);s.html.children[0].append(new El('div',{id}));s.swipe(row,8,400,slow(300));assert.equal(back.clicks,0,id)}
{let s=setup({setupPending:true}),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);s.swipe(row,8,400,slow(300));assert.equal(back.clicks,0,'setupPending')}

// Offenes Fenster: nur dessen Zurück-Knopf zählt, der Inhalt (#mb) bewegt sich; Seite dahinter bleibt.
{let s=setup(),pageBack=new El('button',{cls:['accountback']}),ff=new El('button',{cls:['ffback'],attrs:{'aria-label':'Zurück'}}),row=new El('div');s.content.append(pageBack);s.mb.append(ff,row);s.modal.open=true;
 s.swipe(row,8,500,slow(250,500));assert.equal(ff.clicks,1);assert.equal(pageBack.clicks,0);
 s.swipe(row,8,200,slow(250,200));assert.equal(ff.clicks,1,'Start oberhalb des Fensters')}
{let s=setup(),pageBack=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(pageBack);s.mb.append(row);s.modal.open=true;s.swipe(row,8,500,slow(250,500));assert.equal(pageBack.clicks,0,'Fenster ohne Zurück-Knopf')}
// Knöpfe ohne Klasse brauchen eine Zurück-Beschriftung (z. B. Übungsauswahl, Zutatensuche).
{let s=setup(),wrong=new El('button',{attrs:{onclick:'profileForm()'},text:'Profil bearbeiten'}),right=new El('button',{attrs:{onclick:'closeExercisePicker()'},text:'Zurück'}),row=new El('div');s.mb.append(wrong,right,row);s.modal.open=true;
 s.swipe(row,8,500,slow(250,500));assert.equal(wrong.clicks,0);assert.equal(right.clicks,1)}

// Übungsauswahl über dem laufenden Workout: das Fenster liegt oben, dort gilt die Geste; ein minimiertes (unsichtbares) Workout sperrt nicht.
{let s=setup(),pick=new El('button',{attrs:{onclick:'closeExercisePicker()'},text:'Zurück'}),row=new El('div');s.html.children[0].append(new El('div',{id:'session-root'}));s.mb.append(pick,row);s.modal.open=true;
 s.swipe(row,8,500,slow(250,500));assert.equal(pick.clicks,1)}
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);s.html.children[0].append(new El('div',{id:'session-root',visible:false}));s.swipe(row,8,400,slow(300));assert.equal(back.clicks,1)}
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);let other=new El('dialog',{attrs:{open:''}});s.html.children[0].append(other);s.swipe(row,8,400,slow(300));assert.equal(back.clicks,0,'anderer Dialog offen')}

// prefers-reduced-motion: keine Mitlauf-Bewegung, aber Auslösen.
{let s=setup({reduced:true}),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);
 let seen=[],orig=s.content.style.setProperty;s.content.style.setProperty=(...a)=>{seen.push(a);orig(...a)};
 s.swipe(row,8,400,slow(250));assert.equal(back.clicks,1);assert.deepEqual(seen,[]);assert.equal(s.content.classList.contains('edgebackdragging'),false)}

// --- Überlappende Gesten: die Abschlussphase der vorigen Geste darf die neue nicht beschädigen. ---
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);
 s.swipe(row,8,400,slow(250),{settle:false});                       // A: entschieden „zurück“, gleitet noch hinaus
 assert.ok(s.settle(),'A ist in der Abschlussphase');assert.equal(s.timers.size,1);s.ctx.__gA=s.settle().g;
 s.touch('touchstart',row,8,400,1000);                              // B beginnt innerhalb der 280 ms
 assert.equal(back.clicks,1,'A wird vor B vollständig abgeschlossen (gleiche Ebene, gleicher Knopf)');
 assert.equal(s.timers.size,0,'Timer von A abgebrochen');assert.equal(s.settle(),null);
 s.touch('touchmove',row,30,400,1030);s.touch('touchmove',row,100,401,1100);
 assert.equal(s.content.style.transform,'translateX(92px)');assert.ok(s.content.classList.contains('edgebackdragging'));
 s.content.dispatch('transitionend');s.runTimers();vm.runInContext('edgeBackClear(__gA)',s.ctx); // verspätetes Ende bzw. Aufräumen von A
 assert.equal(s.content.style.transform,'translateX(92px)','B behält transform');assert.ok(s.content.classList.contains('edgebackdragging'),'B behält Klassen');
 assert.ok(s.gesture()?.locked,'B läuft weiter');
 s.touch('touchend',row,100,401,1400);s.runTimers();assert.equal(back.clicks,1,'B (kurz, langsam) federt zurück');assert.equal(s.content.style.transform,'')}
// transitionend eines Kindelements beendet die Abschlussphase nicht vorzeitig; das eigene Ende schon.
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);
 s.swipe(row,8,400,slow(250),{settle:false});s.content.listeners.transitionend.forEach(fn=>fn({type:'transitionend',target:row}));
 assert.equal(back.clicks,0);assert.ok(s.settle());s.content.dispatch('transitionend');assert.equal(back.clicks,1);assert.equal(s.timers.size,0)}

// --- Ebene weg oder neue Ebene: kein Klick in eine ungültige Ansicht. ---
// Fenster wirklich geschlossen während des Hinausgleitens (Kinder bleiben im DOM, isConnected bleibt true).
{let s=setup(),pick=new El('button',{attrs:{onclick:'closeExercisePicker()'},text:'Zurück'}),row=new El('div');s.mb.append(pick,row);s.modal.open=true;
 s.swipe(row,8,500,slow(250,500),{settle:false});s.modal.open=false;s.modal.dispatch('close');
 assert.equal(pick.clicks,0,'close-Ereignis: kein Klick');assert.equal(s.settle(),null);assert.equal(s.timers.size,0);assert.equal(s.mb.style.transform,'');s.runTimers();assert.equal(pick.clicks,0)}
{let s=setup(),pick=new El('button',{attrs:{onclick:'closeExercisePicker()'},text:'Zurück'}),row=new El('div');s.mb.append(pick,row);s.modal.open=true;
 s.swipe(row,8,500,slow(250,500),{settle:false});s.modal.open=false;s.runTimers();assert.equal(pick.clicks,0,'ohne close-Ereignis: Prüfung vor dem Klick')}
// Neues Pausen-Popup (eigener <dialog open>) über dem Fenster bzw. über der Seite.
for(let inModal of [true,false]){let s=setup(),btn=inModal?new El('button',{cls:['ffback']}):new El('button',{cls:['accountback']}),row=new El('div');
 (inModal?s.mb:s.content).append(btn,row);s.modal.open=inModal;
 s.swipe(row,8,500,slow(250,500),{settle:false});s.body.append(new El('dialog',{id:'rest-popup',attrs:{open:''}}));s.runTimers();
 assert.equal(btn.clicks,0,'Rest-Popup '+(inModal?'über Fenster':'über Seite'));assert.equal((inModal?s.mb:s.content).style.transform,'')}
// Fenster schließt mitten in der Geste: abbrechen, aufräumen, Loslassen klickt nicht.
{let s=setup(),ff=new El('button',{cls:['ffback']}),row=new El('div');s.mb.append(ff,row);s.modal.open=true;
 s.touch('touchstart',row,8,500,0);s.touch('touchmove',row,40,500,30);s.touch('touchmove',row,200,501,90);assert.ok(s.gesture()?.locked);
 s.modal.open=false;s.modal.dispatch('close');assert.equal(s.gesture(),null);s.runTimers();assert.equal(s.mb.style.transform,'');assert.equal(s.mb.classList.contains('edgebackdragging'),false);assert.equal(s.modal.classList.contains('edgebackactive'),false);
 s.touch('touchend',row,200,501,120);s.runTimers();assert.equal(ff.clicks,0)}
// Knopf neu gerendert (andere Ansicht) mitten in der Geste: nächste Bewegung bricht ab, kein Klick.
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);
 s.touch('touchstart',row,8,400,0);s.touch('touchmove',row,40,400,30);back.visible=false;let fresh=new El('button',{cls:['accountback']});s.content.append(fresh);
 let ev=s.touch('touchmove',row,200,401,90);assert.equal(ev.defaultPrevented,false);assert.equal(s.gesture(),null);s.touch('touchend',row,200,401,120);s.runTimers();
 assert.equal(back.clicks+fresh.clicks,0);assert.equal(s.content.style.transform,'')}

// --- Konkurrenz mit dem Fensterziehen (echter Code aus interactions.js) und dem Sortieren. ---
function withSheetDrag(s){
  let src=fs.readFileSync('js/interactions.js','utf8'),start=src.indexOf('let outsideSheet=false,dragSheet'),end=src.indexOf('\n',src.indexOf("modal.addEventListener('pointercancel'"));
  assert.ok(start>=0&&end>start,'Fensterziehen in interactions.js gefunden');
  let dismissed=0;s.ctx.modal=s.modal;s.ctx.dismissSheet=()=>dismissed++;s.modal.scrollTop=0;
  vm.runInContext(src.slice(start,end),s.ctx);
  const pointer=(type,target,x,y)=>s.modal.listeners[type].forEach(fn=>fn({type,target,clientX:x,clientY:y,preventDefault(){}}));
  return {pointer,dismissed:()=>dismissed};
}
// Diagonal begonnen: Fensterziehen hat schon verschoben, die Kantengeste wird erkannt und übernimmt allein.
{let s=setup(),ff=new El('button',{cls:['ffback']}),row=new El('div');s.mb.append(ff,row);s.modal.open=true;let d=withSheetDrag(s);
 d.pointer('pointerdown',row,8,500);s.touch('touchstart',row,8,500,0);
 d.pointer('pointermove',row,38,512);assert.equal(s.modal.style.transform,'translateY(12px)','Fensterziehen hat begonnen');
 s.touch('touchmove',row,38,512,30);assert.ok(s.gesture()?.locked);assert.equal(vm.runInContext('dragSheet',s.ctx),null,'dragSheet abgebrochen');assert.equal(s.modal.style.transform,'');
 for(let [x,y,t] of [[120,520,90],[250,530,200]]){d.pointer('pointermove',row,x,y);s.touch('touchmove',row,x,y,t)}
 assert.equal(s.modal.style.transform,'','kein translateY mehr');assert.equal(s.mb.style.transform,'translateX(242px)');
 d.pointer('pointerup',row,250,530);s.touch('touchend',row,250,530,210);s.runTimers();
 assert.equal(d.dismissed(),0,'Fenster wird nicht geschlossen');assert.equal(ff.clicks,1,'nur Zurück')}
// Fenster wird schon gezogen bzw. Sortieren läuft: keine Kantengeste.
{let s=setup(),ff=new El('button',{cls:['ffback']}),row=new El('div'),head=new El('div',{cls:['modalhead']});s.mb.append(ff,row);s.modal.append(head);s.modal.open=true;let d=withSheetDrag(s);
 d.pointer('pointerdown',head,200,320);d.pointer('pointermove',head,200,380);assert.equal(vm.runInContext('dragSheet.dy',s.ctx),60);
 s.swipe(row,8,500,slow(250,500));assert.equal(ff.clicks,0,'laufendes Fensterziehen');assert.equal(s.mb.style.transform,'')}
{let s=setup(),back=new El('button',{cls:['accountback']}),row=new El('div');s.content.append(back,row);vm.runInContext('var orderDrag={pointer:1}',s.ctx);
 let moves=s.swipe(row,8,400,slow(250));assert.equal(back.clicks,0,'laufendes Sortieren');assert.equal(moves.some(e=>e.defaultPrevented),false)}

console.log('PASS: edge back swipe');
