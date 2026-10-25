/* Vibration bei wichtigen Aktionen (nicht bei jedem Antippen). iOS-App: echte iPhone-Haptik über native-bridge;
   Browser: navigator.vibrate (Android) bzw. der WebKit-Schalter-Trick (Safari ab iOS 18, nur bei direktem Antippen). */
const hapticForSound={set:'medium',save:'success',start:'medium',finish:'success',streak:'success',xp:'success',rest:'warning',cancel:'light'};
const hapticPatterns={light:10,medium:18,heavy:28,selection:6,success:[14,60,22],warning:[24,80,24],error:[30,60,30,60,30]};
let hapticLast=0,hapticSwitch=null;
function pulsHaptic(kind='light'){
  if(document.hidden||Date.now()-hapticLast<60)return;hapticLast=Date.now();
  try{
    let bridge=window.webkit?.messageHandlers?.pulsNative;
    if(bridge&&(window.pulsNativeFeatures||[]).includes('haptics')){bridge.postMessage({type:'haptic',style:kind});return}
    if(typeof navigator.vibrate==='function'&&navigator.vibrate(hapticPatterns[kind]||10))return;
    // Safari kennt keine Web-Vibration; ein umgeschalteter <input switch> löst dort die System-Haptik aus.
    if(!hapticSwitch){hapticSwitch=document.createElement('label');hapticSwitch.setAttribute('aria-hidden','true');hapticSwitch.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px;top:0';hapticSwitch.innerHTML='<input type="checkbox" switch tabindex="-1">';hapticSwitch.addEventListener('click',event=>event.stopPropagation());document.body.appendChild(hapticSwitch)}
    hapticSwitch.click();
  }catch{}
}
const hapticSound=pulsSound;pulsSound=function(kind='tap',...args){if(hapticForSound[kind])pulsHaptic(hapticForSound[kind]);return hapticSound.call(this,kind,...args)};
// Kleine Rückmeldungen: Schalter, Scroll-Rad und Wischen zum Löschen.
document.addEventListener('click',event=>{if(event.target.closest('.segmented button,.langswitch button,.iconchoices button,.designoption,.restpanel .textbtn,.swipedelete,input[type=checkbox]:not([switch])'))pulsHaptic(event.target.closest('.swipedelete')?'medium':'selection')},true);
if(typeof buildTimeWheel==='function'){const hapticWheel=buildTimeWheel;buildTimeWheel=function(input,...args){let column=hapticWheel.call(this,input,...args),last=input.value;input.addEventListener('input',()=>{if(input.value!==last){last=input.value;pulsHaptic('selection')}});return column}}
