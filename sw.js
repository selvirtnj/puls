/* Static assets only. Auth, API responses and photos are never cached here. */
const CACHE='puls-static-97',ASSETS=[
"js/workout-ranks.js","css/workout-ranks.css",
"js/routine-favorites.js",
"js/nutrient-definitions.js","js/nutrient-references.js","js/nutrient-resolver.js",
"css/v90-ui.css",
"js/workout-import.js","js/strength-ranks.js", "js/puls-data-v87.js","js/sound-engine.js","js/motion.js","css/motion.css","js/friends.js","css/friends.css","js/color-scheme.js","js/edge-back.js","css/edge-back.css","js/connectivity.js","js/running.js","js/run-metrics.js","js/run-session.js","js/run-map.js","js/activity-overview.js","js/vendor/leaflet.js","css/vendor/leaflet.css","css/running.css","js/exercise-muscles.js","js/food-flow.js","js/food-photo.js","js/training-polish.js","js/app-polish.js","js/haptics.js","js/page-slide.js","js/workout-controls.js","js/rest-popup.js","js/training-tabs.js","js/profile-refresh.js","js/session-focus.js","js/native-bridge.js","js/native-extras.js","js/native-state.js","js/native-projection.js","js/native-training.js","js/native-progress.js","js/native-activity.js","js/native-nutrition.js","js/native-account.js","css/native-shell.css","js/account-refresh.js","js/machine-library.js","js/refinement.js","js/progress-metrics.js","css/design-system.css","js/icons.js","js/design-system.js","js/quick-units.js","js/account-guide.js","./","index.html","js/adaptation.js","js/app.js","js/catalog-search.js","js/catalog-worker.js","js/cloud-config.js","js/cloud.js","js/comfort.js","js/compact.js","js/enhancements.js","js/exercise-catalog.js","js/experience.js","js/finish.js","js/flows.js","js/food-search.js","js/food-upgrade.js","js/i18n.js","icon.svg","icon-install.html","icons/light-180.png","icons/light-512.png","icons/light.svg","icons/light.webmanifest","icons/dark-180.png","icons/dark-512.png","icons/dark.svg","icons/dark.webmanifest","js/insights.js","js/interactions.js","js/lifecycle.js","manifest.webmanifest","js/navigation.js","js/nutrition-input.js","js/personal.js","js/polish.js","js/portions.js","js/preview-mode.js","js/products.js","js/recipes.js","css/style.css","js/tracker-tools.js","js/training.js","js/workout-polish.js","js/food-diary.js","css/food-diary.css","js/food-page.js","css/food-page.css","js/friends-board.js","css/friends-board.css","js/quick-account-v87.js","css/quick-account-v87.css"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
// Independent of app releases. Bump only when bundled catalogue content changes.
const CATALOG_CACHE='puls-catalog-v3',CATALOG_PATH=/^catalog\/(foods-\d+|manifest|portions|nutrients-v2(?:-\d{2})?)\.json$/;
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith('puls-static-')&&k!==CACHE||k.startsWith('puls-catalog-')&&k!==CATALOG_CACHE).map(k=>caches.delete(k)));
 const cache=await caches.open(CATALOG_CACHE),base=new URL(self.registration.scope);
 // Keep the shared catalogue generation, remove only superseded sidecars.
 await Promise.all((await cache.keys()).filter(request=>{
  const url=new URL(request.url);return url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&/^catalog\/nutrients-v1(?:-\d{2})?\.json$/.test(url.pathname.slice(base.pathname.length));
 }).map(request=>cache.delete(request)));
 await self.clients.claim();
})()));
// Optional background work after a successful app load. A partial download can resume
// on the next start/online event; catalogue availability never blocks shell installation.
let cataloguePreload=null;
async function cacheFullCatalogue(){
 const cache=await caches.open(CATALOG_CACHE),base=new URL(self.registration.scope);
 async function ensure(path){
  const url=new URL(path,base);
  let response=await cache.match(url,{ignoreSearch:true});
  if(!response){
   response=await fetch(url,{credentials:'omit',cache:'no-cache'});
   if(!response.ok||response.redirected)throw Error('Catalogue unavailable');
   await cache.put(url,response.clone());
  }
  return response;
 }
 const manifest=await (await ensure('catalog/manifest.json')).json();
 if(!Array.isArray(manifest.files)||manifest.files.length>1000||!manifest.files.every(path=>typeof path==='string'&&/^catalog\/foods-\d+\.json$/.test(path)))throw Error('Invalid catalogue manifest');
 const nutrientFiles=Array.from({length:64},(_,i)=>'catalog/nutrients-v2-'+String(i).padStart(2,'0')+'.json');
 const files=[...new Set([...manifest.files,'catalog/portions.json','catalog/nutrients-v2.json',...nutrientFiles])];
 // Limit concurrent downloads, especially on phones. Keep successful chunks on failure.
 let cursor=0;
 await Promise.allSettled(Array.from({length:3},async()=>{while(cursor<files.length)await ensure(files[cursor++])}));
}
self.addEventListener('message',event=>{
 if(event.data?.type!=='puls:cache-catalogue')return;
 if(!cataloguePreload)cataloguePreload=cacheFullCatalogue().catch(()=>{}).finally(()=>{cataloguePreload=null});
 event.waitUntil(cataloguePreload);
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),base=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const path=url.pathname.slice(base.pathname.length),catalogue=CATALOG_PATH.test(path);
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(!response.ok){const cached=await caches.match(new URL('index.html',base));return cached||response}
    if(path===''||path==='index.html'){let copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(new URL('index.html',base),copy)).catch(()=>{}))}
    return response;
   }catch(error){const cached=await caches.match(new URL('index.html',base));if(cached)return cached;throw error}
  })());return;
 }
 if(!ASSETS.includes(path)&&!catalogue)return;
 event.respondWith(caches.open(catalogue?CATALOG_CACHE:CACHE).then(async cache=>{
  if(/\.(js|css|webmanifest)$/.test(path)){
   let fresh;
   try{fresh=await fetch(request)}catch{
    let cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
    throw Error('Offline asset unavailable');
   }
   // A quota/storage failure must not replace a successful network response.
   if(fresh.ok)try{await cache.put(new URL(path,base),fresh.clone())}catch{}
   return fresh;
  }
  let hit=await cache.match(request,{ignoreSearch:true});if(hit)return hit;
  let response=await fetch(request,catalogue?{cache:'no-cache'}:undefined);
  if(response.ok)try{await cache.put(request,response.clone())}catch{}
  return response;
 }));
});
