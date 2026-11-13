/* PULS Bewegung (v87): kleine, generische Helfer für Mikroanimationen. Lädt ganz zuletzt; Stile in css/motion.css.
   Zeiten/Kurven nur als Tokens: --motion-fast 120ms, --motion-base 200ms, --motion-slow 320ms, --motion-count 700ms,
   --ease-spring cubic-bezier(.2,.8,.2,1), --ease-out cubic-bezier(.2,0,0,1).

   Reduzierte Bewegung: prefers-reduced-motion oder state.display.motion==='reduced' setzt <html class="reduce-motion">;
   dann laufen keine Bewegungen, nur Einblenden über Opazität bis 120 ms. Alle Helfer prüfen das selbst.

   Automatisch (kein Aufruf nötig, nur Markup):
     data-motion="bar"    Balken wächst beim Öffnen der Seite (auch vorhandene .dsmeter > i)
     data-motion="fill"   füllt sich von unten (Wasserglas)
     data-motion="ring"   SVG mit Kreis .motion-ring-value (pathLength="100") füllt sich
     data-motion="rise"   steigt auf (Podium), Reihenfolge über style="--motion-i:0|1|2"
     data-motion="enter"  blendet sich ein (Listeneintrag), Staffelung über --motion-i
     data-motion="check"  SVG-Häkchen zeichnet sich (Pfade mit pathLength="1")
     data-motion="pop"    kurzer Erfolgs-Puls
     data-count="1234.5"  Zahl zählt beim ersten Anzeigen einmal hoch (nur zu echten Werten); optional data-count-decimals,
                          data-motion-key (sitzungsweit eindeutig). Der sichtbare Text muss die Zahl enthalten.
     data-motion-indicator  Container; aktives Kind ([aria-selected=true], [aria-pressed=true], .active, .on) bekommt
                          einen gleitenden Hintergrund .motion-indicator.
     data-motion-tap="off"  schaltet das Eindrücken (scale .97) an einem Knopf ab.
   Bar/fill/ring/rise/enter/check/pop spielen einmal je Seitenbesuch und Position; data-motion-key macht sie sitzungsweit einmalig.

   Klassen zum direkten Setzen: .motion-enter, .motion-success, .motion-reveal, .motion-push-in, .motion-push-out,
     .motion-deck (Folien mit Einrasten), .motion-scanline (Scanlinie, Höhe über --scan-travel), .motion-check.

   window.pulsMotion:
     reduced()                         true bei reduzierter Bewegung
     countUp(el, to, {from, decimals, duration})  zählt Zahl im Text hoch, stellt danach den Originaltext her
     flip(mutate, {selector})          FLIP für Listen: Elemente mit data-flip-id gleiten an neue Plätze, neue blenden ein
     enter(el)                         Eintrag einblenden
     remove(el, done)                  Eintrag zusammenklappen und ausblenden, danach done()
     success(target)                   Erfolgs-Puls; target Element oder Selektor (wird nach dem nächsten render gesucht)
     reveal(el, {sound})               Rang-Enthüllung (Skalierung) plus Klang, Standard 'rankUp' (sound:false = still)
     push(el) / pop(el, done)          Seiten-Push herein / hinaus
     indicator(container)              Indikator neu ausrichten (sonst automatisch nach jedem render)
     deckTo(track, index)              Deck zu Folie scrollen
     checkSvg(cls)                     gestricheltes Häkchen-SVG für .motion-check
     scan(root)                        automatische Klassen sofort anwenden (läuft sonst per MutationObserver) */
(function(){
  const media=matchMedia('(prefers-reduced-motion: reduce)'),DUR={fast:120,base:200,slow:320,count:700};
  const SPRING='cubic-bezier(.2,.8,.2,1)',OUT='cubic-bezier(.2,0,0,1)';
  const reduced=()=>media.matches||(typeof state!=='undefined'&&state?.display?.motion==='reduced');
  function syncReduced(){try{document.documentElement.classList.toggle('reduce-motion',reduced())}catch{}}
  media.addEventListener?.('change',syncReduced);syncReduced();

  const pageKey=()=>typeof page!=='undefined'?String(page):'';
  let visitSeen=new Set(),sessionSeen=new Set(),counting=new WeakSet();
  const types={bar:'[data-motion~="bar"],.dsmeter > i',fill:'[data-motion~="fill"]',ring:'[data-motion~="ring"]',rise:'[data-motion~="rise"]',
    enter:'[data-motion~="enter"]',check:'[data-motion~="check"]',pop:'[data-motion~="pop"]'};

  function numberFormat(d){let lang=typeof state!=='undefined'&&state?.language==='en'?'en-US':'de-DE';return new Intl.NumberFormat(lang,{minimumFractionDigits:d,maximumFractionDigits:d})}
  function countUp(el,to,{from=0,decimals,duration=DUR.count}={}){
    to=Number(to);if(!el||!Number.isFinite(to)||reduced()||counting.has(el))return false;
    let d=Number.isInteger(decimals)?decimals:(String(el.dataset?.count??to).split('.')[1]||'').length,fmt=numberFormat(Math.min(3,d));
    let original=el.textContent,target=fmt.format(to),at=original.indexOf(target);
    if(at<0)return false; // keine passende Zahl im Text: lieber nichts animieren als etwas Falsches zeigen
    let before=original.slice(0,at),after=original.slice(at+target.length),start=performance.now();counting.add(el);
    let step=now=>{
      if(!el.isConnected){counting.delete(el);return}
      let p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3);
      el.textContent=p<1?before+fmt.format(from+(to-from)*e)+after:original;
      if(p<1)requestAnimationFrame(step);else counting.delete(el);
    };
    el.textContent=before+fmt.format(from)+after;requestAnimationFrame(step);return true;
  }

  function play(el){el.classList.remove('motion-play');void el.offsetWidth;el.classList.add('motion-play')}
  function scan(root=document){
    if(!root?.querySelectorAll)return;
    let isReduced=reduced(),key=pageKey(),counters={};
    for(let [type,selector] of Object.entries(types)){
      let all=document.querySelectorAll(selector);
      all.forEach((el,i)=>{
        if(!root.contains(el)&&root!==el)return;
        if(el.classList.contains('motion-play'))return;
        let own=el.dataset.motionKey,id=own?'k|'+own+'|'+type:key+'|'+type+'|'+i,set=own?sessionSeen:visitSeen;
        if(set.has(id))return;set.add(id);
        if(!isReduced||type==='enter'||type==='rise')play(el);
      });
    }
    if(!isReduced)document.querySelectorAll('[data-count]').forEach((el,i)=>{
      if(root!==document&&!root.contains(el))return;
      let id='c|'+(el.dataset.motionKey||key+'|'+i);if(sessionSeen.has(id))return;sessionSeen.add(id);
      countUp(el,el.dataset.count,{decimals:el.dataset.countDecimals!==undefined?Number(el.dataset.countDecimals):undefined});
    });
    root.querySelectorAll?.('[data-motion-indicator]').forEach(indicator);
    if(root.matches?.('[data-motion-indicator]'))indicator(root);
  }

  function indicator(container){
    if(!container)return;
    let active=container.querySelector(':scope > [aria-selected="true"],:scope > [aria-pressed="true"],:scope > .active,:scope > .on');
    let bar=container.querySelector(':scope > .motion-indicator');
    if(!active){bar?.remove();return}
    if(!bar){bar=document.createElement('span');bar.className='motion-indicator';bar.setAttribute('aria-hidden','true');container.prepend(bar);
      // Erste Position ohne Gleiten setzen.
      bar.style.transition='none';requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.removeProperty('transition')))}
    let set=()=>{bar.style.setProperty('--mi-x',active.offsetLeft+'px');bar.style.setProperty('--mi-y',active.offsetTop+'px');bar.style.setProperty('--mi-w',active.offsetWidth+'px');bar.style.setProperty('--mi-h',active.offsetHeight+'px')};
    set();
  }

  function flip(mutate,{selector='[data-flip-id]'}={}){
    if(reduced()||typeof mutate!=='function')return mutate?.();
    let before=new Map();document.querySelectorAll(selector).forEach(el=>before.set(el.dataset.flipId,el.getBoundingClientRect()));
    let result=mutate();
    document.querySelectorAll(selector).forEach(el=>{
      let old=before.get(el.dataset.flipId);
      if(!old){enter(el);return}
      let now=el.getBoundingClientRect(),dx=old.left-now.left,dy=old.top-now.top;
      if(Math.abs(dx)+Math.abs(dy)>1&&el.animate)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:DUR.slow,easing:SPRING});
    });
    return result;
  }
  function enter(el){if(!el)return;el.classList.remove('motion-enter');void el.offsetWidth;el.classList.add('motion-enter');el.addEventListener('animationend',()=>el.classList.remove('motion-enter'),{once:true})}
  function remove(el,done){
    let finish=()=>{try{done?.()}catch(error){console.error(error)}};
    if(!el||!el.isConnected||reduced()||!el.animate){finish();return}
    let h=el.getBoundingClientRect().height,cs=getComputedStyle(el),called=false,end=()=>{if(!called){called=true;finish()}};
    el.classList.add('motion-leaving');
    let anim=el.animate([{opacity:1,height:h+'px',marginTop:cs.marginTop,marginBottom:cs.marginBottom,transform:'none'},
      {opacity:0,height:'0px',marginTop:'0px',marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px',transform:'translateX(-12px)'}],{duration:DUR.base,easing:OUT,fill:'forwards'});
    anim.onfinish=end;setTimeout(end,DUR.base+120);
  }
  function resolve(target){return typeof target==='string'?document.querySelector(target):target}
  function success(target){
    let run=()=>{let el=resolve(target);if(!el||reduced())return;el.classList.remove('motion-success');void el.offsetWidth;el.classList.add('motion-success');el.addEventListener('animationend',()=>el.classList.remove('motion-success'),{once:true})};
    typeof target==='string'?requestAnimationFrame(run):run();
  }
  function reveal(el,{sound='rankUp'}={}){
    el=resolve(el);if(!el)return;
    el.classList.remove('motion-reveal');void el.offsetWidth;el.classList.add('motion-reveal');
    if(sound&&typeof pulsSound==='function')pulsSound(sound);
  }
  function push(el){el=resolve(el);if(!el||reduced())return;el.classList.remove('motion-push-out');el.classList.add('motion-push-in');el.addEventListener('animationend',()=>el.classList.remove('motion-push-in'),{once:true})}
  function pop(el,done){
    el=resolve(el);let called=false,end=()=>{if(!called){called=true;try{done?.()}catch(error){console.error(error)}}};
    if(!el||reduced()){end();return}
    el.classList.add('motion-push-out');el.addEventListener('animationend',end,{once:true});setTimeout(end,DUR.base+120);
  }
  function deckTo(track,index){track=resolve(track);let slide=track?.children?.[index];if(!slide)return;track.scrollTo({left:slide.offsetLeft-track.offsetLeft,behavior:reduced()?'auto':'smooth'})}
  function checkSvg(cls=''){return `<svg class="motion-check${cls?' '+cls:''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>`}

  // Tabwechsel: neue Seite hebt sich herein; Bewegungen je Seitenbesuch neu erlauben.
  if(typeof go==='function'){globalThis.goBeforeMotion=function goBeforeMotion(){return pageKey()};globalThis.goAfterMotion=function goAfterMotion(before){
    if(pageKey()!==before){visitSeen=new Set();let content=document.getElementById('content');
      if(content&&!reduced()){content.classList.remove('motion-page-in');void content.offsetWidth;content.classList.add('motion-page-in');clearTimeout(content.motionTimer);content.motionTimer=setTimeout(()=>content.classList.remove('motion-page-in'),DUR.base+DUR.fast*2+200)}
      scan(document)}
  }}
  const viewKey=()=>[pageKey(),typeof accountSection==='undefined'?'':accountSection,typeof qaPage==='undefined'?'':qaPage,pageKey()==='workout'&&typeof trainTab!=='undefined'?trainTab:''].join('/');
  let currentView=viewKey();
  if(typeof render==='function'){globalThis.renderAfterMotion=function renderAfterMotion(){
    let next=viewKey();syncReduced();
    if(next!==currentView){currentView=next;scrollViewTop()}
  }}
  // Sheet entry points converge here after the earlier decorators and focus work.
  if(typeof openModal==='function'){globalThis.openModalAfterMotion=function openModalAfterMotion(){scrollViewTop(modal)}}
  if(typeof foodTab==='function'){const motionFoodTab=foodTab;foodTab=function(...args){let result=motionFoodTab.apply(this,args);scrollViewTop(modal);return result}}

  // Neu eingefügte Elemente gesammelt einmal pro Bild prüfen.
  let pending=new Set(),frame=0;
  const flush=()=>{frame=0;let roots=[...pending];pending.clear();syncReduced();for(let root of roots)if(root.isConnected)scan(root)};
  new MutationObserver(list=>{
    for(let m of list)for(let node of m.addedNodes)if(node.nodeType===1&&!node.classList?.contains('motion-indicator')){
      pending.add(node);
      if(node.matches?.('dialog,#session-root,#run-root'))scrollViewTop(node);
      if(m.target.id==='foodbody')scrollViewTop(modal);
    }
    if(pending.size&&!frame)frame=requestAnimationFrame(flush);
  }).observe(document.body,{childList:true,subtree:true});
  addEventListener('resize',()=>document.querySelectorAll('[data-motion-indicator]').forEach(indicator),{passive:true});
  document.addEventListener('click',event=>{let box=event.target.closest?.('[data-motion-indicator]');if(box)requestAnimationFrame(()=>indicator(box))},true);
  scan(document);

  window.pulsMotion=Object.freeze({reduced,countUp,flip,enter,remove,success,reveal,push,pop,indicator,deckTo,checkSvg,scan,tokens:Object.freeze({...DUR,spring:SPRING,out:OUT})});
})();
