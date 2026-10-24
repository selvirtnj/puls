/* Training: Tab „Workout“ ist zum Starten da (kompakte Routinenzeilen, klar abgesetzt „Heute erledigt“),
   Tab „Routinen“ bleibt die Verwaltung. Nur Darstellung; Handler und Daten stammen aus flows.js/enhancements.js. */
function refineTrainingTabs(){
  let root=document.querySelector('#content .designworkouts'),body=root?.querySelector('.workoutbody');
  if(!root||!body||page!=='workout')return;
  let tab=['routines','calendar','insights','records'].includes(trainTab)?trainTab:'current';
  root.dataset.trainTab=tab;
  if(tab!=='current'||body.dataset.quickstart)return;body.dataset.quickstart='1';
  let head=body.querySelector(':scope > .sectionhead'),title=head?.querySelector('h2');
  let cards=[...body.querySelectorAll(':scope > .routinepreview')];
  let en=state.language==='en';
  if(title)title.textContent=en?'Start training':'Training starten';
  // Neue Routinen legt man im Tab „Routinen“ an; ohne Routinen bleibt der Knopf hier sichtbar.
  if(cards.length)head?.querySelector('.btn')?.classList.add('quickhidden');
  for(let card of cards){
    card.classList.add('quickstart');
    // Sprachunabhängig über den Handler finden; die Texte übersetzt i18n.js bereits vorher.
    let start=card.querySelector('.actionrow [onclick^="startRoutine"]');
    if(start){start.textContent='Start';card.querySelector(':scope > .cardhead')?.appendChild(start)}
    else card.classList.remove('quickstart');
  }
  let empty=body.querySelector(':scope > [onclick^="startWorkout"]');
  if(empty&&cards.length)cards.at(-1).insertAdjacentElement('afterend',empty);
  let done=[...body.querySelectorAll(':scope > h3')].find(h=>h.nextElementSibling?.classList.contains('completedworkout'));
  if(done){done.classList.add('donehead');let day=done.textContent.split('·').slice(1).join('·').trim();done.textContent=(date===today()?(en?'Done today':'Heute erledigt'):(en?'Done':'Erledigt'))+(day?' · '+day:'')}
}
const trainingTabsRender=render;render=function(...args){let result=trainingTabsRender.apply(this,args);refineTrainingTabs();return result};
refineTrainingTabs();
if(typeof englishUI==='object')Object.assign(englishUI,{'Training starten':'Start training','Start':'Start','Heute erledigt':'Done today','Erledigt':'Done'});
