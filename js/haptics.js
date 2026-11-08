/* Vibration bei wichtigen Aktionen (nicht bei jedem Antippen). iOS-App: echte iPhone-Haptik über native-bridge;
   Browser: navigator.vibrate (Android) bzw. der WebKit-Schalter-Trick (Safari ab iOS 18, nur bei direktem Antippen). */
// v87: Zuordnung für die Klänge aus sound-engine.js. 'tap' bleibt bewusst ohne Vibration (nicht bei jedem Antippen).
const hapticForSound={set:'medium',save:'success',start:'medium',finish:'success',streak:'success',xp:'success',success:'success',pr:'success',rest:'warning',timer:'warning',cancel:'light',
  toggle:'selection',toggleOff:'selection',sheetOpen:'light',add:'light',food:'light',water:'light',levelUp:'success',rankUp:'heavy',
  nudgeSend:'medium',nudge:'medium',nudgeReceive:'medium',warning:'warning',warn:'warning',scan:'success',error:'error',delete:'warning',remove:'warning',undo:'light'};
const hapticPatterns={light:10,medium:18,heavy:28,selection:6,success:[14,60,22],warning:[24,80,24],error:[30,60,30,60,30]};
let hapticLast=0,hapticSwitch=null;
function pulsHaptic(kind='light'){
  // Schalter „Vibration“ (state.display.hapticsEnabled, Standard an) vor jeder Vibration prüfen.
  let hapticsOn=window.pulsData87?.hapticsEnabled?window.pulsData87.hapticsEnabled():(typeof state==='undefined'||state?.display?.hapticsEnabled!==false);
  if(!hapticsOn)return;
  if(document.hidden||Date.now()-hapticLast<60)return;hapticLast=Date.now();
  try{
    let bridge=window.webkit?.messageHandlers?.pulsNative;
    if(bridge&&(window.pulsNativeFeatures||[]).includes('haptics')){bridge.postMessage({type:'haptic',style:kind});return}
    // Vor der ersten Berührung blockiert der Browser Vibration ohnehin (und meldet einen Konsolenfehler).
    if(navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;
    if(typeof navigator.vibrate==='function'&&navigator.vibrate(hapticPatterns[kind]||10))return;
    // Safari kennt keine Web-Vibration; ein umgeschalteter <input switch> löst dort die System-Haptik aus.
    if(!hapticSwitch){hapticSwitch=document.createElement('label');hapticSwitch.setAttribute('aria-hidden','true');hapticSwitch.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px;top:0';hapticSwitch.innerHTML='<input type="checkbox" switch tabindex="-1">';hapticSwitch.addEventListener('click',event=>event.stopPropagation());document.body.appendChild(hapticSwitch)}
    hapticSwitch.click();
  }catch{}
}
const hapticSound=pulsSound;pulsSound=function(kind='tap',...args){if(hapticForSound[kind])pulsHaptic(hapticForSound[kind]);return hapticSound.call(this,kind,...args)};
// Kleine Rückmeldungen: Schalter, Scroll-Rad und Wischen zum Löschen.
document.addEventListener('click',event=>{if(event.target.closest('.segmented button,.langswitch button,.iconchoices button,.designoption,.restpanel .textbtn,.swipedelete'))pulsHaptic(event.target.closest('.swipedelete')?'medium':'selection')},true);
// Nach dem onchange am Feld: Satz-Abhaken darf zuerst seine stärkere Rückmeldung auslösen.
document.addEventListener('change',event=>{if(event.target.matches('input[type=checkbox]:not([switch])'))pulsHaptic('selection')});
if(typeof buildTimeWheel==='function'){const hapticWheel=buildTimeWheel;buildTimeWheel=function(input,...args){let column=hapticWheel.call(this,input,...args),last=input.value;input.addEventListener('input',()=>{if(input.value!==last){last=input.value;pulsHaptic('selection')}});return column}}
