/* PULS Klangwerk (v87): eigene, per WebAudio synthetisierte Klänge. Keine Audiodateien, keine Samples, kein Dienst.
   Lädt nach interactions.js und vor haptics.js. haptics.js umschließt pulsSound danach automatisch (hapticForSound).

   API (global):
     pulsSound(kind)            spielt einen Klang; unbekannte kinds klingen wie 'tap'. Kein Ton bei state.soundEnabled===false,
                                Lautstärke 0, verstecktem Tab oder noch nicht freigegebenem AudioContext (iOS: erste Berührung).
     pulsSoundKinds             Liste aller Klangnamen (eigene plus Aliasse).
     unlockPulsAudio()          kompatibel zu interactions.js; gibt den AudioContext bei einer Berührung frei.
   Klangnamen: tap, toggle, toggleOff, open, sheetOpen, sheetClose, save, add, water, set, pr, xp, success, levelUp, rankUp,
     streak, start, finish, rest, cancel, nudgeSend, nudgeReceive, warning, scan, error, delete, undo.
   Aliasse: timer→rest, complete/workout→finish, food→add, nudge→nudgeSend, warn→warning, remove→delete.
   Signalweg: Stimmen + leiser Raumanteil → Tiefpass (1,8 kHz) → DynamicsCompressor → Master-Gain → Ausgang.
   Lauf-Pieptöne in run-session.js bleiben eigenständig. */
(function(){
  const Ctor=window.AudioContext||window.webkitAudioContext;
  try{if(navigator.audioSession)navigator.audioSession.type='ambient'}catch{}
  let bus=null,noise=null,lastAt=0,lastKind='',lastNonTap=0,override=null;

  function ctx(){
    if(!Ctor)return null;
    try{if(!pulsAudio)pulsAudio=new Ctor({latencyHint:'interactive'})}catch{try{pulsAudio=new Ctor()}catch{return null}}
    return pulsAudio;
  }
  function makeBus(c){
    if(bus&&bus.c===c)return bus;
    let comp=c.createDynamicsCompressor(),master=c.createGain(),room=c.createConvolver(),wet=c.createGain(),lp=c.createBiquadFilter();
    lp.type='lowpass';lp.frequency.value=1800;lp.Q.value=.5;
    comp.threshold.value=-20;comp.knee.value=18;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.18;
    master.gain.value=1;
    // Kurzer, dunkler Raum (0,3 s); auch der Hall läuft durch den Tiefpass.
    let len=Math.round(c.sampleRate*.3),ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){let d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
    room.buffer=ir;wet.gain.value=.08;
    room.connect(wet);wet.connect(lp);lp.connect(comp);comp.connect(master);master.connect(c.destination);
    bus={c,input:lp,room};return bus;
  }
  function noiseBuffer(c){
    if(noise&&noise.sampleRate===c.sampleRate)return noise;
    let len=c.sampleRate;noise=c.createBuffer(1,len,c.sampleRate);let d=noise.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return noise;
  }
  function out(b,node,send=.5){node.connect(b.input);if(send>0){let g=b.c.createGain();g.gain.value=send;node.connect(g);g.connect(b.room)}}
  function envelope(g,t,peak,attack,dur){
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+attack);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  }

  /* ---------- Bausteine ---------- */
  // Warmer Ton: überwiegend Sinus mit leisem Triangle-Anteil, ohne helle FM-Seitenbänder.
  function bell(b,f,t,dur,amp,send=.2){
    let c=b.c,g=c.createGain();envelope(g,t,amp,.015,dur);out(b,g,send);
    for(let [type,mix] of [['sine',.8],['triangle',.2]]){
      let o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.value=f;v.gain.value=mix;
      o.connect(v);v.connect(g);o.start(t);o.stop(t+dur+.025);
    }
  }
  // Pluck: kurze Dreieckswelle, Tiefpass schließt sich mit der Hüllkurve.
  function pluck(b,f,t,dur,amp,send=.2){
    let c=b.c,o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();
    o.type='triangle';o.frequency.value=f;lp.type='lowpass';lp.Q.value=.7;
    lp.frequency.setValueAtTime(1500,t);lp.frequency.exponentialRampToValueAtTime(350,t+dur);
    o.connect(lp);lp.connect(g);envelope(g,t,amp,.012,dur);out(b,g,send);o.start(t);o.stop(t+dur+.025);
  }
  // Gefiltertes Rauschen mit Bandpass-Sweep (Whoosh).
  function whoosh(b,t,dur,from,to,amp,send=.25){
    let c=b.c,s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();
    s.buffer=noiseBuffer(c);bp.type='bandpass';bp.Q.value=.6;
    bp.frequency.setValueAtTime(from,t);bp.frequency.exponentialRampToValueAtTime(to,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+dur*.45);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(bp);bp.connect(g);out(b,g,send);s.start(t,Math.random()*.5);s.stop(t+dur+.03);
  }
  // Ein einzelner weicher Tropfen: tiefer Sinus, sanft fallende Tonhöhe.
  function drop(b,t,from,to,dur,amp,send=.35){
    let c=b.c,o=c.createOscillator(),g=c.createGain();o.type='sine';
    o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur*.6);
    o.connect(g);envelope(g,t,amp,.015,dur);out(b,g,send);o.start(t);o.stop(t+dur+.025);
  }
  // Ein kompakter Akkord statt Fanfare; Gesamtpegel unabhängig von der Anzahl der Töne.
  function pad(b,freqs,t,dur,amp,attack=.035){
    let c=b.c,g=c.createGain();envelope(g,t,amp,attack,dur);out(b,g,.25);
    for(let f of freqs)for(let [type,mix] of [['sine',.8],['triangle',.2]]){
      let o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.value=f;v.gain.value=mix/freqs.length;
      o.connect(v);v.connect(g);o.start(t);o.stop(t+dur+.025);
    }
  }
  // Ein kurzer, weicher Sinus (Scanner).
  function beep(b,f,t,dur,amp){
    let c=b.c,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;
    envelope(g,t,amp,.015,dur);
    o.connect(g);out(b,g,.15);o.start(t);o.stop(t+dur+.02);
  }
  // Gedämpfter tiefer Ton (Fehler): Dreieck durch festen Tiefpass.
  function muted(b,f,t,dur,amp){
    let c=b.c,o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();o.type='triangle';o.frequency.value=f;
    lp.type='lowpass';lp.frequency.value=900;lp.Q.value=.5;o.connect(lp);lp.connect(g);envelope(g,t,amp,.015,dur);out(b,g,.1);o.start(t);o.stop(t+dur+.025);
  }

  /* ---------- Klänge (a = Grundpegel aus der Lautstärke) ---------- */
  const voices={
    tap:(b,t,a)=>pluck(b,220,t,.055,a*.22,0),
    toggle:(b,t,a)=>pluck(b,294,t,.07,a*.28,.03),
    toggleOff:(b,t,a)=>pluck(b,220,t,.07,a*.26,.03),
    open:(b,t,a)=>bell(b,330,t,.18,a*.35),
    sheetOpen:(b,t,a)=>whoosh(b,t,.13,300,600,a*.22,.08),
    sheetClose:(b,t,a)=>whoosh(b,t,.12,600,300,a*.2,.08),
    save:(b,t,a)=>pad(b,[262,330,392],t,.24,a*.45),
    add:(b,t,a)=>bell(b,392,t,.16,a*.4,.12),
    water:(b,t,a)=>drop(b,t,360,220,.18,a*.48,.12),
    set:(b,t,a)=>bell(b,330,t,.16,a*.42,.12),
    xp:(b,t,a)=>pad(b,[262,330,392],t,.28,a*.45),
    pr:(b,t,a)=>pad(b,[294,370,440],t,.36,a*.48),
    levelUp:(b,t,a)=>pad(b,[262,330,392,523],t,.45,a*.5,.045),
    rankUp:(b,t,a)=>pad(b,[220,277,330,440],t,.5,a*.5,.05),
    streak:(b,t,a)=>pad(b,[294,440],t,.28,a*.42),
    start:(b,t,a)=>pad(b,[294,392],t,.22,a*.42),
    finish:(b,t,a)=>pad(b,[262,330,392,523],t,.45,a*.48,.045),
    rest:(b,t,a)=>pad(b,[330,440],t,.32,a*.48),
    cancel:(b,t,a)=>drop(b,t,294,220,.13,a*.32,.08),
    nudgeSend:(b,t,a)=>pluck(b,330,t,.1,a*.35,.08),
    nudgeReceive:(b,t,a)=>bell(b,440,t,.22,a*.38,.15),
    warning:(b,t,a)=>muted(b,247,t,.22,a*.42),
    scan:(b,t,a)=>beep(b,523,t,.09,a*.3),
    error:(b,t,a)=>drop(b,t,247,185,.23,a*.45,.08),
    delete:(b,t,a)=>whoosh(b,t,.14,550,220,a*.26,.08),
    undo:(b,t,a)=>bell(b,294,t,.16,a*.32,.1)
  };
  const aliases={success:'xp',timer:'rest',complete:'finish',workout:'finish',food:'add',nudge:'nudgeSend',warn:'warning',remove:'delete'};
  const ambient=new Set(['sheetOpen','sheetClose']);

  function play(kind='tap'){
    if(typeof state==='undefined'||state?.soundEnabled===false||document.hidden)return;
    let level=Number(state.soundVolume??35);if(!(level>0))return;
    if(override&&kind==='save'&&Date.now()<override.until){kind=override.kind;override.used=true}
    kind=aliases[kind]||kind;if(!voices[kind])kind='tap';
    let now=Date.now();
    if(kind==='tap'&&now-lastAt<65)return;
    if(kind===lastKind&&now-lastAt<40)return;
    // Fensterklänge treten zurück, wenn gerade ein bedeutsamer Klang lief (z. B. Speichern schließt das Fenster).
    if(ambient.has(kind)&&now-lastNonTap<180)return;
    // Kein Stapeln: zwei bedeutsame Klänge innerhalb von 90 ms (z. B. Meldung plus direkter Aufruf) spielen nur einmal.
    if(kind!=='tap'&&!ambient.has(kind)&&now-lastNonTap<90)return;
    let c=pulsAudio;if(!c||c.state!=='running'){if(c&&c.state!=='closed')c.resume?.().catch(()=>{});return}
    lastAt=now;lastKind=kind;if(kind!=='tap'&&!ambient.has(kind))lastNonTap=now;
    try{let b=makeBus(c),a=Math.min(.7,level/100)*.11;voices[kind](b,c.currentTime+.005,a);window.pulsSoundLast=kind}catch{}
  }

  // Freigabe: bei jeder Geste erneut versuchen (iOS kann den Kontext nach Unterbrechungen anhalten).
  const oldUnlock=typeof unlockPulsAudio==='function'?unlockPulsAudio:null;
  if(oldUnlock){document.removeEventListener('pointerdown',oldUnlock);document.removeEventListener('keydown',oldUnlock)}
  unlockPulsAudio=function(){
    if(typeof state==='undefined'||state?.soundEnabled===false)return;
    let c=ctx();if(!c)return;
    try{
      if(c.state!=='running'){
        // Ein stiller Puffer innerhalb der Geste schaltet WebAudio auf iOS zuverlässig frei.
        let s=c.createBufferSource();s.buffer=c.createBuffer(1,1,22050);s.connect(c.destination);s.start(0);
        c.resume().then(()=>{audioUnlocked=c.state==='running';if(audioUnlocked)makeBus(c);if(firstSound&&audioUnlocked){firstSound=false;pulsSound('open')}}).catch(()=>{});
      }else{audioUnlocked=true;makeBus(c);firstSound=false}
    }catch{}
  };
  for(let type of ['pointerdown','touchend','keydown'])document.addEventListener(type,()=>unlockPulsAudio(),{passive:true,capture:true});

  pulsSound=play;
  window.pulsSoundKinds=Object.freeze([...Object.keys(voices),...Object.keys(aliases)]);

  /* ---------- Zuordnung in bestehenden Abläufen ---------- */
  // Meldungen: interactions.js spielt bei „gespeichert/hinzugefügt/250 ml“ 'save'; hier passender Klang statt dessen.
  if(typeof toast==='function'){
    const engineToast=toast;
    toast=function(message,...args){
      let text=String(message??''),kind=/250 ml|Wasser|Glas/i.test(text)?'water':/fehlgeschlagen|nicht möglich|ungültig|konnte nicht|Fehler/i.test(text)?'error':/wiederhergestellt|rückgängig gemacht/i.test(text)?'undo':/gelöscht|entfernt|verworfen/i.test(text)?'delete':/hinzugefügt|eingetragen/i.test(text)?'add':null;
      if(!kind)return engineToast.call(this,message,...args);
      override={kind,until:Date.now()+80,used:false};
      let result=engineToast.call(this,message,...args),used=override.used;override=null;
      if(!used)pulsSound(kind);
      return result;
    };
  }
  // Fenster: sanftes Hochgleiten und Hinausgleiten.
  if(typeof openModal==='function'){globalThis.openModalBeforeSound=function openModalBeforeSound(){return modal?.open};globalThis.openModalAfterSound=function openModalAfterSound(was){if(!was)pulsSound('sheetOpen')}}
  if(typeof dismissSheet==='function'){const engineDismiss=dismissSheet;dismissSheet=function(...args){let was=modal?.open&&!modal.classList.contains('sheetclosing');let r=engineDismiss.apply(this,args);if(was&&modal.classList.contains('sheetclosing'))pulsSound('sheetClose');return r}}
})();
