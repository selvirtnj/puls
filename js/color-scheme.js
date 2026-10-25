/* Device preference, loaded synchronously before styles. Never changes the synced profile. */
function colorSchemePreference(profile){
  return ['terra','blueprint'].includes(profile?.appDesign)?'light':'system';
}
function resolveColorScheme(mode,systemDark){
  return mode==='light'||mode==='dark'?mode:systemDark?'dark':'light';
}
const pulsSchemeMedia=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;
const pulsSchemeKey='puls-color-scheme',pulsSchemePreview=/[?&]erststart=1(?:&|$)/.test(location.search||'');
let pulsSchemeMode='system';
function getColorScheme(){return pulsSchemeMode}
function applyColorScheme(){
  let resolved=resolveColorScheme(getColorScheme(),!!pulsSchemeMedia?.matches),root=document.documentElement;
  root.setAttribute('data-scheme',resolved);
  root.style.colorScheme=resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#000000':'#f2f2f7');
  return resolved;
}
function setColorScheme(mode){
  if(!['system','light','dark'].includes(mode))return false;
  pulsSchemeMode=mode;
  try{if(!pulsSchemePreview)localStorage.setItem(pulsSchemeKey,mode)}catch{}
  applyColorScheme();if(typeof render==='function')render();return true;
}
try{
  if(!pulsSchemePreview){
    let stored=localStorage.getItem(pulsSchemeKey);
    if(['system','light','dark'].includes(stored))pulsSchemeMode=stored;
    else{
      pulsSchemeMode=colorSchemePreference(JSON.parse(localStorage.getItem('puls-v1')));
      localStorage.setItem(pulsSchemeKey,pulsSchemeMode);
    }
  }
}catch{}
applyColorScheme();
if(pulsSchemeMedia?.addEventListener)pulsSchemeMedia.addEventListener('change',()=>applyColorScheme());
else pulsSchemeMedia?.addListener?.(()=>applyColorScheme());
