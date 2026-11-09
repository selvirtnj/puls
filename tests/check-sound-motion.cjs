// v87 Klangwerk, Haptik-Zuordnung und Bewegungs-Helfer in einer synthetischen VM (kein echtes Audio, keine echte Vibration).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

/* ---------- Fake WebAudio: Knoten, Tonhöhen, Hüllkurven und Start/Stop-Zeiten ---------- */
function fakeAudio(log){
  const param=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push(['set',v,t])},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t])},exponentialRampToValueAtTime(v,t){assert(v>0,'exponential ramps need positive targets');this.events.push(['exponential',v,t])}});
  const node=extra=>({connections:[],connect(target){this.connections.push(target)},disconnect(){},...extra});
  return class{
    constructor(){this.state='suspended';this.currentTime=10;this.sampleRate=8000;this.destination=node()}
    resume(){this.state='running';return Promise.resolve()}
    createGain(){let g=node({gain:param()});log.gains.push(g);return g}
    createDynamicsCompressor(){return node({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})}
    createConvolver(){return node({buffer:null})}
    createBiquadFilter(){let f=node({type:'',Q:param(),frequency:param()});log.filters.push(f);return f}
    createBuffer(ch,len){return {sampleRate:this.sampleRate,getChannelData:()=>new Float32Array(len)}}
    createOscillator(){let ctx=this,o=node({type:'',frequency:param(),detune:param(),start(t){log.starts.push(t-ctx.currentTime)},stop(t){log.stops.push(t-ctx.currentTime);log.voices++}});log.oscillators.push(o);return o}
    createBufferSource(){let ctx=this;return node({buffer:null,start(t=ctx.currentTime){log.starts.push(t-ctx.currentTime)},stop(t){if(t!==undefined){log.stops.push(t-ctx.currentTime);log.voices++}}})}
  };
}
const listeners={};
const log={voices:0,starts:[],stops:[],oscillators:[],filters:[],gains:[]},posted=[];
const element=()=>({style:{},classList:{toggle(){},add(){},remove(){},contains:()=>false},setAttribute(){},addEventListener(){},appendChild(){},click(){}});
const c={console,Promise,Date,Math,Number,String,Object,Set,Map,Array,setTimeout,clearTimeout,
  navigator:{audioSession:{type:'auto'}},
  document:{hidden:false,listeners,addEventListener(t,f){(listeners[t]??=[]).push(f)},removeEventListener(t,f){listeners[t]=(listeners[t]||[]).filter(x=>x!==f)},createElement:element,body:element()},
  modal:{open:false,classList:{contains:()=>false}},
};
c.window=c;c.AudioContext=fakeAudio(log);
vm.createContext(c);
const run=code=>vm.runInContext(code,c);
// Ausschnitt der bisherigen Schnittstelle aus interactions.js (globale Bindungen, wie im Browser).
run(`var state={soundEnabled:true,soundVolume:35,display:{}};let pulsAudio=null,audioUnlocked=false,firstSound=false,lastSound=0;
function pulsSound(kind){throw new Error('old engine must be replaced')}
function unlockPulsAudio(){}document.addEventListener('pointerdown',unlockPulsAudio);
var toasts=[];var toast=function(m){toasts.push(m);if(/gespeichert|erfasst|hinzugefügt|250 ml/.test(m))pulsSound('save')};
var openModal=function(){modal.open=true};var dismissSheet=function(){};`);
const engine=fs.readFileSync('js/sound-engine.js','utf8');
run(engine);
assert.equal(listeners.pointerdown.length,1,'old unlock listener is replaced by the new one');
// Ohne Freigabe kein Ton.
run(`pulsSound('save')`);assert.equal(log.voices,0,'no sound before the audio context is unlocked');
run('unlockPulsAudio()');
// Stiller Puffer zählt nicht als Klang.
log.voices=0;log.starts.length=0;log.stops.length=0;
const kinds=[...c.pulsSoundKinds];
for(const kind of ['tap','toggle','toggleOff','open','sheetOpen','sheetClose','save','add','water','set','pr','xp','levelUp','rankUp','streak','start','finish','rest','cancel','nudgeSend','nudgeReceive','warning','scan','error','delete','undo'])assert(kinds.includes(kind),'kind '+kind);
for(const kind of kinds){
  let before=log.voices,oi=log.oscillators.length,gi=log.gains.length,si=log.starts.length;c.pulsSoundLast='';run(`Date.now=()=>${Date.now()}+${kinds.indexOf(kind)*1000}`);run(`pulsSound(${JSON.stringify(kind)})`);
  assert(log.voices>before,'kind '+kind+' produces sound');assert(c.pulsSoundLast,'kind '+kind+' recorded');
  const oscillators=log.oscillators.slice(oi),starts=log.starts.slice(si);
  assert(log.voices-before<=8,'compact sound, no repeated fanfare: '+kind);
  assert(starts.every(t=>t===starts[0]),'one attack instead of repeated notes: '+kind);
  for(const o of oscillators){
    assert(['sine','triangle'].includes(o.type),'warm waveform: '+kind);
    const frequencies=o.frequency.events.length?o.frequency.events.map(e=>e[1]):[o.frequency.value];
    assert(frequencies.every(f=>f>=180&&f<=600),'fundamentals stay in 180–600 Hz: '+kind);
    if(kind==='water')assert(frequencies.length===2&&frequencies[1]<frequencies[0],'water falls gently, never sweeps up');
    // Jeder Ausgangspfad, auch der Raumanteil, muss den gemeinsamen Tiefpass passieren.
    function filtered(n,seen=new Set()){
      if(n.type==='lowpass'&&n.frequency.value===1800)return true;
      if(seen.has(n)||!n.connections.length)return false;
      return n.connections.every(next=>filtered(next,new Set([...seen,n])));
    }
    assert(filtered(o),'all oscillator paths pass the 1.8 kHz lowpass: '+kind);
  }
  const envelopes=log.gains.slice(gi).map(g=>g.gain.events).filter(events=>events.some(e=>e[0]==='linear'));
  assert(envelopes.length,'audible envelope exists: '+kind);
  for(const events of envelopes){
    const attack=events.find(e=>e[0]==='linear'),start=events[0];
    assert(attack[2]-start[2]>=.012-1e-9,'soft attack of at least 12 ms: '+kind);
    assert(attack[1]<=.35*.11*.5+1e-9,'quiet default envelope (base gain halved): '+kind);
  }
  if(kind==='rankUp')assert(Math.abs(envelopes[0][1][1]-.35*.11*.5)<1e-9,'base gain is -6 dB versus the old .22 scale');
  if(['tap','toggle','toggleOff','water'].includes(kind))assert.equal(oscillators.length,1,'single subtle thock/drop: '+kind);
}
assert(Math.max(...log.stops)<.56,'every voice ends within 0.56 s (plus short quiet room tail)');
assert(Math.min(...log.starts)>=0,'no sound starts in the past');
assert(log.filters.some(f=>f.type==='lowpass'&&f.frequency.value===1800),'shared dark lowpass');
for(const f of log.filters)for(const hz of [f.frequency.value,...f.frequency.events.map(e=>e[1])].filter(hz=>hz>0))assert(hz<=1800,'no bright filter cutoff');
run(`Date.now=()=>${Date.now()}+900000`);run(`pulsSound('doesNotExist')`);assert.equal(c.pulsSoundLast,'tap','unknown kinds fall back to tap');
// Klänge aus / Lautstärke 0: kein Ton.
let before=log.voices;run(`state.soundEnabled=false;Date.now=()=>${Date.now()}+990000;pulsSound('finish')`);assert.equal(log.voices,before,'sound switch off is respected');
run(`state.soundEnabled=true;state.soundVolume=0;Date.now=()=>${Date.now()}+995000;pulsSound('finish')`);assert.equal(log.voices,before,'volume 0 is silent');
run('state.soundVolume=35');
// Hidden-Tab, Dedupe und unterbrochener iOS-Kontext bleiben still.
run(`document.hidden=true;Date.now=()=>${Date.now()}+996000;pulsSound('finish')`);assert.equal(log.voices,before,'hidden tab is silent');
run(`document.hidden=false;Date.now=()=>${Date.now()}+997000;pulsSound('save')`);before=log.voices;
run(`pulsSound('save');pulsSound('water');pulsSound('sheetClose');pulsSound('tap')`);assert.equal(log.voices,before,'dedupe prevents immediate duplicate/stacked sounds');
run(`pulsAudio.state='suspended';Date.now=()=>${Date.now()}+998000;pulsSound('finish')`);assert.equal(log.voices,before,'resume does not replay a stale sound');
assert.equal(run('pulsAudio.state'),'running','interrupted audio context is resumed');
// Meldungen: „250 ml“ klingt als Wasser, Löschen als delete, Fehler als error, ohne doppelten Ton.
run(`Date.now=()=>${Date.now()}+1000000`);run(`toast('250 ml Wasser erfasst')`);assert.equal(c.pulsSoundLast,'water');
run(`Date.now=()=>${Date.now()}+1001000`);run(`toast('Rezept gelöscht')`);assert.equal(c.pulsSoundLast,'delete');
run(`Date.now=()=>${Date.now()}+1002000`);run(`toast('Export nicht möglich.')`);assert.equal(c.pulsSoundLast,'error');
run(`Date.now=()=>${Date.now()}+1003000`);run(`toast('Mahlzeit hinzugefügt')`);assert.equal(c.pulsSoundLast,'add');
run(`Date.now=()=>${Date.now()}+1004000`);run(`openModal('x','y')`);assert.equal(c.pulsSoundLast,'sheetOpen');
assert.equal(c.navigator.audioSession.type,'ambient','music keeps playing (ambient audio session)');

/* ---------- Haptik: Zuordnung und Schalter ---------- */
c.webkit={messageHandlers:{pulsNative:{postMessage:m=>posted.push(m)}}};c.pulsNativeFeatures=['haptics'];
run(fs.readFileSync('js/haptics.js','utf8'));
run(`Date.now=()=>${Date.now()}+2000000`);run(`pulsSound('set')`);assert.deepEqual({...posted.at(-1)},{type:'haptic',style:'medium'},'native bridge used in the iOS shell');
run(`Date.now=()=>${Date.now()}+2001000`);run(`pulsSound('rankUp')`);assert.equal(posted.at(-1).style,'heavy');
let count=posted.length;run(`Date.now=()=>${Date.now()}+2002000`);run(`pulsSound('tap')`);assert.equal(posted.length,count,'tap does not vibrate');
c.pulsData87={hapticsEnabled:()=>false};count=posted.length;
run(`Date.now=()=>${Date.now()}+2003000`);run(`pulsSound('finish');pulsHaptic('heavy')`);assert.equal(posted.length,count,'haptics switch off blocks every vibration');
c.pulsData87={hapticsEnabled:()=>true};run(`Date.now=()=>${Date.now()}+2004000`);run(`pulsHaptic('light')`);assert.equal(posted.length,count+1);
run('var hapticKinds=Object.keys(hapticForSound)');for(const kind of c.hapticKinds)assert(kinds.includes(kind),'haptic mapping refers to known sound '+kind);

/* ---------- Bewegung: reduzierte Bewegung und Ladereihenfolge ---------- */
const css=fs.readFileSync('css/motion.css','utf8');
for(const token of ['--motion-fast: 120ms','--motion-base: 200ms','--motion-slow: 320ms','--ease-spring: cubic-bezier(.2, .8, .2, 1)','--ease-out: cubic-bezier(.2, 0, 0, 1)'])assert(css.includes(token),'token '+token);
assert(/html\.reduce-motion \*[^{]*\{[^}]*animation-duration: 1ms !important/.test(css),'reduce-motion stops animations');
assert(!/box-shadow|linear-gradient|radial-gradient|backdrop-filter/.test(css),'design bans respected');
const classes=new Set(),root={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
const m={matches:false,addEventListener(){}};
const mc={console,Date,Math,Number,String,Object,Set,Map,WeakSet,Intl,setTimeout,clearTimeout,requestAnimationFrame:f=>0,performance:{now:()=>0},
  matchMedia:()=>m,addEventListener(){},MutationObserver:class{observe(){}},
  document:{documentElement:root,body:{},querySelectorAll:()=>[],addEventListener(){},getElementById:()=>null}};
mc.window=mc;vm.createContext(mc);
vm.runInContext(`var state={display:{motion:'system'}};var page='today';function render(){}function go(p){page=p}`,mc);
vm.runInContext(fs.readFileSync('js/motion.js','utf8'),mc);
const motion=mc.pulsMotion;
assert.equal(motion.reduced(),false);assert(!classes.has('reduce-motion'));
vm.runInContext(`state.display.motion='reduced';render()`,mc);assert(motion.reduced());assert(classes.has('reduce-motion'),'display.motion reduced sets html.reduce-motion');
const el={textContent:'1.250 kcal',dataset:{count:'1250'},isConnected:true};assert.equal(motion.countUp(el,1250),false,'no counting with reduced motion');
let done=0;motion.remove({isConnected:true},()=>done++);assert.equal(done,1,'remove completes immediately with reduced motion');
vm.runInContext(`state.display.motion='system';render()`,mc);assert(!classes.has('reduce-motion'));
m.matches=true;assert(motion.reduced(),'system preference reduces motion');m.matches=false;
assert.equal(motion.countUp({textContent:'ohne Zahl',dataset:{},isConnected:true},5),false,'never shows a number that is not in the text');
assert.equal(motion.countUp(el,1250),true,'counts up to the real value');assert.equal(el.textContent,'0 kcal');
assert(motion.checkSvg().includes('pathLength="1"'));

const html=fs.readFileSync('index.html','utf8'),at=name=>html.indexOf(name);
assert(at('js/interactions.js')<at('js/sound-engine.js')&&at('js/sound-engine.js')<at('js/haptics.js'),'sound-engine loads after interactions and before haptics');
assert(at('js/motion.js')>at('js/puls-data-v87.js')&&at('css/motion.css')>at('css/friends.css'),'motion loads last');
const sw=fs.readFileSync('sw.js','utf8');for(const file of ['js/sound-engine.js','js/motion.js','css/motion.css'])assert(sw.includes('"'+file+'"'),'offline '+file);
console.log('PASS: v87 sound engine, haptic mapping and motion helpers');
