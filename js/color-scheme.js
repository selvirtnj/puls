/* Device preference, loaded synchronously before styles. Never changes the synced profile.
   v89: two extra palettes on top of light/dark: 'fresh' (light) and 'midnight' (dark). They keep data-scheme
   light/dark for all existing CSS and add data-palette for the token overrides in design-system.css. */
const pulsSchemeModes=['system','light','dark','fresh','midnight'],pulsSchemePalettes={fresh:'light',midnight:'dark'};
function colorSchemePreference(profile){
  return ['terra','blueprint'].includes(profile?.appDesign)?'light':'system';
}
function resolveColorScheme(mode,systemDark){
  if(pulsSchemePalettes[mode])return pulsSchemePalettes[mode];
  return mode==='light'||mode==='dark'?mode:systemDark?'dark':'light';
}
const pulsSchemeMedia=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;
const pulsSchemeKey='puls-color-scheme',pulsSchemePreview=/[?&]erststart=1(?:&|$)/.test(location.search||'');
let pulsSchemeMode='system';
function getColorScheme(){return pulsSchemeMode}
/* v92: Home-Bildschirm-Web-App (iOS standalone). Ohne Angabe zeichnet iOS eine eigene, im hellen Systemmodus weiße
   Statusleiste über der App. Dunkel/Mitternacht: black-translucent, die Seite (html = --ds-bg) läuft unter die Leiste,
   main und Kopfzeilen halten env(safe-area-inset-top) frei. Hell/Frisch: default, damit Uhrzeit und Symbole dunkel
   und lesbar bleiben (black-translucent erzwingt weiße Schrift). iOS liest den Wert beim Start, daher früh im <head>. */
function applyStatusBarStyle(resolved){
  try{
    let meta=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if(!meta){
      let head=document.head;if(!head||typeof document.createElement!=='function')return;
      meta=document.createElement('meta');meta.setAttribute('name','apple-mobile-web-app-status-bar-style');head.appendChild(meta);
    }
    meta.setAttribute('content',resolved==='dark'?'black-translucent':'default');
  }catch{}
}
function applyColorScheme(){
  let resolved=resolveColorScheme(getColorScheme(),!!pulsSchemeMedia?.matches),root=document.documentElement;
  root.setAttribute('data-scheme',resolved);
  let palette=pulsSchemePalettes[getColorScheme()]?getColorScheme():'';
  if(palette)root.setAttribute('data-palette',palette);else root.removeAttribute?.('data-palette');
  root.style.colorScheme=resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette==='midnight'?'#0B1120':palette==='fresh'?'#F3F6F2':resolved==='dark'?'#000000':'#f2f2f7');
  applyStatusBarStyle(resolved);
  if(typeof applyAppIcon==='function')applyAppIcon();
  return resolved;
}
function setColorScheme(mode){
  if(!pulsSchemeModes.includes(mode))return false;
  pulsSchemeMode=mode;
  try{if(!pulsSchemePreview)localStorage.setItem(pulsSchemeKey,mode)}catch{}
  applyColorScheme();if(typeof render==='function')render();return true;
}
try{
  if(!pulsSchemePreview){
    let stored=localStorage.getItem(pulsSchemeKey);
    if(pulsSchemeModes.includes(stored))pulsSchemeMode=stored;
    else{
      pulsSchemeMode=colorSchemePreference(JSON.parse(localStorage.getItem('puls-v1')));
      localStorage.setItem(pulsSchemeKey,pulsSchemeMode);
    }
  }
}catch{}
applyColorScheme();
if(pulsSchemeMedia?.addEventListener)pulsSchemeMedia.addEventListener('change',()=>applyColorScheme());
else pulsSchemeMedia?.addListener?.(()=>applyColorScheme());
