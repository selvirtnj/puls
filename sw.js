/* Static assets only. Auth, API responses and photos are never cached here. */
const CACHE='puls-static-75',ASSETS=["js/color-scheme.js","js/edge-back.js","css/edge-back.css","js/connectivity.js","js/running.js","js/run-metrics.js","js/run-session.js","js/run-map.js","js/activity-overview.js","js/vendor/leaflet.js","css/vendor/leaflet.css","css/running.css","js/exercise-muscles.js","css/exercise-muscles.css","js/food-flow.js","css/food-flow.css","js/training-polish.js","css/training-polish.css","js/app-polish.js","css/app-polish.css","js/haptics.js","js/page-slide.js","css/page-slide.css","js/workout-controls.js","css/workout-controls.css","js/rest-popup.js","css/rest-popup.css","js/training-tabs.js","css/training-tabs.css","js/profile-refresh.js","css/profile-refresh.css","css/food-refresh.css","js/session-focus.js","css/session-focus.css","js/native-bridge.js","js/native-state.js","js/native-projection.js","js/native-training.js","css/native-shell.css","css/training-refresh.css","css/overview-refresh.css","js/account-refresh.js","css/account-refresh.css","js/machine-library.js","js/refinement.js","css/refinement.css","js/progress-metrics.js","css/progress-metrics.css","js/designs-extra.js","css/design-system.css","js/icons.js","js/design-system.js","js/quick-units.js","css/quick-units.css","js/account-guide.js","css/account-guide.css","./","index.html","js/adaptation.js","js/app.js","js/catalog-search.js","js/catalog-worker.js","js/cloud-config.js","js/cloud.js","css/comfort.css","js/comfort.js","css/compact.css","js/compact.js","js/enhancements.js","js/exercise-catalog.js","js/experience.js","css/finish.css","js/finish.js","css/flows.css","js/flows.js","js/food-search.js","css/food-upgrade.css","js/food-upgrade.js","js/i18n.js","icon.svg","icon-install.html","icons/light-180.png","icons/light-512.png","icons/light.svg","icons/light.webmanifest","icons/dark-180.png","icons/dark-512.png","icons/dark.svg","icons/dark.webmanifest","js/insights.js","css/interactions.css","js/interactions.js","css/lifecycle.css","js/lifecycle.js","manifest.webmanifest","css/navigation.css","js/navigation.js","js/nutrition-input.js","css/personal.css","js/personal.js","css/polish.css","js/polish.js","js/portions.js","js/preview-mode.js","js/products.js","js/recipes.js","css/style.css","js/tracker-tools.js","js/training.js","css/workout-polish.css","js/workout-polish.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
// Independent of app releases. Bump only when bundled catalogue content changes.
const CATALOG_CACHE='puls-catalog-v1',CATALOG_PATH=/^catalog\/(foods-\d+|manifest|portions)\.json$/;
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('puls-static-')&&k!==CACHE||k.startsWith('puls-catalog-')&&k!==CATALOG_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Optional background work after a successful app load. A partial download can resume
// on the next start/online event; catalogue availability never blocks shell installation.
let cataloguePreload=null;
async function cacheFullCatalogue(){
 const cache=await caches.open(CATALOG_CACHE),base=new URL(self.registration.scope);
 async function ensure(path){
  const url=new URL(path,base);
  let response=await cache.match(url,{ignoreSearch:true});
  if(!response){
   response=await fetch(url,{credentials:'omit'});
   if(!response.ok||response.redirected)throw Error('Catalogue unavailable');
   await cache.put(url,response.clone());
  }
  return response;
 }
 const manifest=await (await ensure('catalog/manifest.json')).json();
 if(!Array.isArray(manifest.files)||manifest.files.length>1000||!manifest.files.every(path=>typeof path==='string'&&/^catalog\/foods-\d+\.json$/.test(path)))throw Error('Invalid catalogue manifest');
 const files=[...new Set([...manifest.files,'catalog/portions.json'])];
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
  let response=await fetch(request);
  if(response.ok)try{await cache.put(request,response.clone())}catch{}
  return response;
 }));
});
