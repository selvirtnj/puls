/* Laufendes Workout: echte Kopfzeilenhöhe (Safe Area, Dynamic Island, Design) als --session-head-h für den klebenden Pausentimer. */
function syncSessionHead(){let root=document.getElementById('session-root'),head=root?.querySelector('.sessionhead');if(head)root.style.setProperty('--session-head-h',Math.ceil(head.getBoundingClientRect().height)+'px')}
const sessionFocusRender=renderWorkoutSession;renderWorkoutSession=function(...args){let result=sessionFocusRender.apply(this,args);requestAnimationFrame(syncSessionHead);return result};
window.addEventListener('resize',()=>requestAnimationFrame(syncSessionHead));
window.addEventListener('orientationchange',()=>setTimeout(syncSessionHead,250));
