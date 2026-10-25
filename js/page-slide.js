/* Tab-Wechsel unten: die alte Seite gleitet hinaus, die neue wischt aus der Richtung des Tabs herein.
   Nur Darstellung; die Richtung kommt aus pageDirection (polish.js). */
const pageSlideGo=go;go=function(next,...args){
  let target=next==='weight'?'account':next,content=$('content');
  if(target===page||!content||matchMedia('(prefers-reduced-motion: reduce)').matches)return pageSlideGo.call(this,next,...args);
  document.querySelectorAll('.pageslideghost').forEach(old=>old.remove());
  // Momentaufnahme der alten Seite, nicht bedienbar. Sie behält id="content" für die Design-Stile, liegt aber
  // hinter dem echten #content, sodass $('content') weiter die echte Seite findet; innere IDs entfallen.
  let rect=content.getBoundingClientRect(),ghost=content.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  ghost.className='pageslideghost';ghost.inert=true;ghost.setAttribute('aria-hidden','true');
  Object.assign(ghost.style,{top:rect.top+'px',left:rect.left+'px',width:rect.width+'px'});
  let result=pageSlideGo.call(this,next,...args);
  ghost.style.setProperty('--page-direction',pageDirection);
  content.after(ghost);
  ghost.addEventListener('animationend',()=>ghost.remove(),{once:true});setTimeout(()=>ghost.remove(),600);
  content.classList.add('pageslide');
  return result;
};
