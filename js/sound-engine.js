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
   Signalweg: Stimmen → DynamicsCompressor → Master-Gain → Ausgang, dazu ein leiser, synthetischer Raumanteil (Convolver).
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
    let comp=c.createDynamicsCompressor(),master=c.createGain(),room=c.createConvolver(),wet=c.createGain();
    comp.threshold.value=-20;comp.knee.value=18;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.18;
    master.gain.value=1;
    // Kurzer, weicher Raum aus abklingendem Rauschen (0,7 s), nur ein Hauch.
    let len=Math.round(c.sampleRate*.7),ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){let d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
    room.buffer=ir;wet.gain.value=.16;
    room.connect(wet);wet.connect(comp);comp.connect(master);master.connect(c.destination);
    bus={c,input:comp,room};return bus;
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
  // FM-Glocke: Träger plus Modulator, dessen Index schnell abklingt (glasiger Anschlag, weicher Nachklang).
  function bell(b,f,t,dur,amp,ratio=3.01,index=1.6,send=.6){
    let c=b.c,car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain();
    car.type='sine';mod.type='sine';car.frequency.value=f;mod.frequency.value=f*ratio;
    mg.gain.setValueAtTime(f*index,t);mg.gain.exponentialRampToValueAtTime(f*.02,t+dur*.55);
    mod.connect(mg);mg.connect(car.frequency);car.connect(g);envelope(g,t,amp,.004,dur);out(b,g,send);
    car.start(t);mod.start(t);car.stop(t+dur+.05);mod.stop(t+dur+.05);
  }
  // Pluck: kurze Dreieckswelle, Tiefpass schließt sich mit der Hüllkurve.
  function pluck(b,f,t,dur,amp,send=.2){
    let c=b.c,o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();
    o.type='triangle';o.frequency.value=f;lp.type='lowpass';lp.Q.value=.7;
    lp.frequency.setValueAtTime(Math.min(16000,f*7),t);lp.frequency.exponentialRampToValueAtTime(Math.max(200,f*1.2),t+dur);
    o.connect(lp);lp.connect(g);envelope(g,t,amp,.003,dur);out(b,g,send);o.start(t);o.stop(t+dur+.03);
  }
  // Gefiltertes Rauschen mit Bandpass-Sweep (Whoosh).
  function whoosh(b,t,dur,from,to,amp,send=.25){
    let c=b.c,s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();
    s.buffer=noiseBuffer(c);bp.type='bandpass';bp.Q.value=1.1;
    bp.frequency.setValueAtTime(from,t);bp.frequency.exponentialRampToValueAtTime(to,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+dur*.45);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(bp);bp.connect(g);out(b,g,send);s.start(t,Math.random()*.5);s.stop(t+dur+.03);
  }
  // Tropfen: Sinus mit schnellem Tonhöhen-Sweep (Wasser klingt nach oben gezogen am natürlichsten).
  function drop(b,t,from,to,dur,amp,send=.35){
    let c=b.c,o=c.createOscillator(),g=c.createGain();o.type='sine';
    o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur*.6);
    o.connect(g);envelope(g,t,amp,.004,dur);out(b,g,send);o.start(t);o.stop(t+dur+.03);
  }
  // Kurzer, heller Rausch-Burst (Plätschern).
  function splash(b,t,dur,amp){
    let c=b.c,s=c.createBufferSource(),hp=c.createBiquadFilter(),g=c.createGain();
    s.buffer=noiseBuffer(c);hp.type='highpass';hp.frequency.value=2600;
    s.connect(hp);hp.connect(g);envelope(g,t,amp,.002,dur);out(b,g,.3);s.start(t,Math.random()*.5);s.stop(t+dur+.02);
  }
  // Verstimmtes Pad: zwei Sägezähne je Ton, Tiefpass öffnet sich langsam.
  function pad(b,freqs,t,dur,amp,attack=.25){
    let c=b.c,lp=c.createBiquadFilter(),g=c.createGain();lp.type='lowpass';lp.Q.value=.5;
    lp.frequency.setValueAtTime(700,t);lp.frequency.linearRampToValueAtTime(2200,t+dur*.6);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+attack);g.gain.setValueAtTime(amp,t+Math.max(attack,dur*.55));
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);lp.connect(g);out(b,g,.7);
    for(let f of freqs)for(let cents of [-7,7]){let o=c.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=cents;o.connect(lp);o.start(t);o.stop(t+dur+.05)}
  }
  // Klarer Beep (Scanner).
  function beep(b,f,t,dur,amp){
    let c=b.c,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.004);g.gain.setValueAtTime(amp,t+dur*.6);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);out(b,g,.15);o.start(t);o.stop(t+dur+.02);
  }
  // Gedämpfter tiefer Ton (Fehler): Dreieck durch festen Tiefpass.
  function muted(b,f,t,dur,amp){
    let c=b.c,o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();o.type='triangle';o.frequency.value=f;
    lp.type='lowpass';lp.frequency.value=900;o.connect(lp);lp.connect(g);envelope(g,t,amp,.006,dur);out(b,g,.15);o.start(t);o.stop(t+dur+.03);
  }

  /* ---------- Klänge (a = Grundpegel aus der Lautstärke) ---------- */
  const voices={
    tap:(b,t,a)=>pluck(b,1320,t,.045,a*.32,.05),
    toggle:(b,t,a)=>{pluck(b,988,t,.06,a*.4,.1);pluck(b,1319,t+.055,.07,a*.4,.1)},
    toggleOff:(b,t,a)=>{pluck(b,1319,t,.06,a*.38,.1);pluck(b,988,t+.055,.07,a*.38,.1)},
    open:(b,t,a)=>{bell(b,784,t,.32,a*.45,2.01,1.1);bell(b,1175,t+.07,.36,a*.35,2.01,1.1)},
    sheetOpen:(b,t,a)=>whoosh(b,t,.22,450,2400,a*.45),
    sheetClose:(b,t,a)=>whoosh(b,t,.2,2400,450,a*.4),
    save:(b,t,a)=>{bell(b,880,t,.36,a*.55);bell(b,1319,t+.07,.42,a*.45)},
    add:(b,t,a)=>{drop(b,t,420,700,.12,a*.5,.25);bell(b,1319,t+.05,.34,a*.35,2.01,1.2)},
    water:(b,t,a)=>{drop(b,t,620,1500,.11,a*.7);splash(b,t+.025,.05,a*.18);drop(b,t+.1,900,1900,.08,a*.3)},
    set:(b,t,a)=>{pluck(b,659,t,.08,a*.55,.15);bell(b,1319,t+.04,.3,a*.42)},
    xp:(b,t,a)=>{bell(b,880,t,.42,a*.45);bell(b,1109,t+.08,.42,a*.42);bell(b,1319,t+.16,.5,a*.45)},
    pr:(b,t,a)=>{bell(b,784,t,.42,a*.45);bell(b,988,t+.08,.42,a*.42);bell(b,1175,t+.16,.45,a*.42);bell(b,1568,t+.25,.55,a*.38)},
    levelUp:(b,t,a)=>{[659,784,988,1319].forEach((f,i)=>bell(b,f,t+i*.07,.5,a*.42));pad(b,[330,494,659],t,1.05,a*.07,.2)},
    rankUp:(b,t,a)=>{pad(b,[220,330,440,554],t,1.15,a*.09,.4);[880,1109,1319,1760].forEach(f=>bell(b,f,t+.34,.7,a*.24,3.01,1.3,.8))},
    streak:(b,t,a)=>{bell(b,587,t,.5,a*.5,2.01,1.2);bell(b,880,t+.12,.56,a*.48,2.01,1.2)},
    start:(b,t,a)=>{pluck(b,392,t,.09,a*.5,.2);bell(b,587,t+.06,.34,a*.42,2.01,1.2);bell(b,880,t+.14,.42,a*.42)},
    finish:(b,t,a)=>{[523,659,784,1047].forEach((f,i)=>bell(b,f,t+i*.1,.55,a*.42));pad(b,[262,392,523,659],t+.05,1.1,a*.08,.3)},
    rest:(b,t,a)=>{bell(b,880,t,.34,a*.5);bell(b,880,t+.22,.34,a*.5);bell(b,1319,t+.44,.55,a*.52)},
    cancel:(b,t,a)=>{pluck(b,523,t,.08,a*.45,.15);pluck(b,392,t+.07,.11,a*.45,.15)},
    nudgeSend:(b,t,a)=>{pluck(b,784,t,.07,a*.55,.15);pluck(b,880,t+.09,.09,a*.55,.15)},
    nudgeReceive:(b,t,a)=>{bell(b,1047,t,.4,a*.45,2.01,1.2);bell(b,1568,t+.06,.45,a*.3,2.01,1.1)},
    warning:(b,t,a)=>{bell(b,698,t,.28,a*.45,1.41,1);bell(b,698,t+.16,.34,a*.42,1.41,1)},
    scan:(b,t,a)=>{beep(b,1760,t,.06,a*.35);beep(b,2349,t+.085,.07,a*.32)},
    error:(b,t,a)=>{muted(b,311,t,.16,a*.6);muted(b,247,t+.11,.2,a*.6)},
    delete:(b,t,a)=>{whoosh(b,t,.2,1900,360,a*.45);pluck(b,220,t+.1,.12,a*.35,.1)},
    undo:(b,t,a)=>{whoosh(b,t,.2,360,1900,a*.42);pluck(b,880,t+.12,.08,a*.35,.1)}
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
    try{let b=makeBus(c),a=Math.min(.7,level/100)*.22;voices[kind](b,c.currentTime+.005,a);window.pulsSoundLast=kind}catch{}
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
  if(typeof openModal==='function'){const engineOpen=openModal;openModal=function(...args){let was=modal?.open;let r=engineOpen.apply(this,args);if(!was)pulsSound('sheetOpen');return r}}
  if(typeof dismissSheet==='function'){const engineDismiss=dismissSheet;dismissSheet=function(...args){let was=modal?.open&&!modal.classList.contains('sheetclosing');let r=engineDismiss.apply(this,args);if(was&&modal.classList.contains('sheetclosing'))pulsSound('sheetClose');return r}}
})();
