/* Browser connectivity is a hint; pendingSync remains true on failures/conflicts. */
window.pulsConnectivity={online:navigator.onLine!==false,pendingSync:!!cloudDirty};
window.pulsRefreshConnectivity=function(){
  let next={online:navigator.onLine!==false,pendingSync:!!cloudDirty},current=window.pulsConnectivity;
  if(next.online===current.online&&next.pendingSync===current.pendingSync)return current;
  Object.assign(current,next);
  window.dispatchEvent(new CustomEvent('puls:connectivity',{detail:{...next}}));
  return current;
};
function preloadOfflineCatalogue(){
  if(firstRunPreview||navigator.onLine===false||!navigator.serviceWorker)return;
  navigator.serviceWorker.ready.then(registration=>{
    registration.active?.postMessage({type:'puls:cache-catalogue'});
  }).catch(()=>{});
}
window.addEventListener('online',()=>{window.pulsRefreshConnectivity();preloadOfflineCatalogue()});
window.addEventListener('offline',()=>window.pulsRefreshConnectivity());
if(!firstRunPreview&&navigator.serviceWorker){
  navigator.serviceWorker.addEventListener('controllerchange',preloadOfflineCatalogue);
  if(document.readyState==='complete')preloadOfflineCatalogue();
  else window.addEventListener('load',preloadOfflineCatalogue,{once:true});
}
