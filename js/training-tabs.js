/* Workout = Starten, Routinen = Verwalten. Nur Darstellung und bestehende Editor-Aktionen;
   Session, IDs und gespeicherte Routinen bleiben bei ihren bisherigen Handlern. */
let trainingRoutinesCollapsed=false; // Nur für diese Sitzung, kein Profilfeld.

function trainingRoutineActions(id){
  let routine=state.routines.find(r=>r.id===id);if(!routine)return;
  let en=state.language==='en';
  openModal(routine.name,`<div class="exerciseactions trainingroutineactions"><div class="actiongroup"><button class="actionrow" data-routine-action="edit">${uiIcon('pencil-simple')}<span>${en?'Edit':'Bearbeiten'}</span></button><button class="actionrow" data-routine-action="copy">${uiIcon('list-plus')}<span>${en?'Duplicate':'Duplizieren'}</span></button><button class="actionrow actiondanger" data-routine-action="delete">${uiIcon('trash')}<span>${en?'Delete':'Löschen'}</span></button></div><button class="actioncancel" onclick="modal.close()">${en?'Cancel':'Abbrechen'}</button></div>`);
  document.querySelectorAll('.trainingroutineactions [data-routine-action]').forEach(button=>button.addEventListener('click',()=>{
    if(!state.routines.some(r=>r.id===id))return;
    let action=button.dataset.routineAction;
    if(action==='delete'){
      // Der vorhandene Handler bestätigt das Löschen und erhält historische Workouts.
      deleteRoutine(id);if(!state.routines.some(r=>r.id===id))modal.close();return;
    }
    routineForm(id);
    if(action==='copy'){
      // Erst im bestehenden Editor prüfen und über saveRoutine speichern.
      // routineForm erzeugt einen tiefen Entwurf; die Quelle bleibt unverändert.
      routineDraft.id=uid();delete routineDraft.favorite; // Kopie startet ohne Favoritenstern.
      let suffix=en?' (copy)':' (Kopie)';
      routineDraft.name=routineDraft.name.slice(0,80-suffix.length)+suffix;
      renderPersonalRoutine();
    }
  }));
}

function refineTrainingTabs(){
  let root=document.querySelector('#content .designworkouts'),body=root?.querySelector('.workoutbody');
  if(!root||!body||page!=='workout')return;
  let tab=['routines','calendar','insights','records'].includes(trainTab)?trainTab:'current';
  root.dataset.trainTab=tab;
  if(tab!=='current'||body.dataset.quickstart)return;body.dataset.quickstart='1';
  let head=body.querySelector(':scope > .sectionhead'),title=head?.querySelector('h2');
  let cards=[...body.querySelectorAll(':scope > .routinepreview')],en=state.language==='en';
  if(title)title.textContent=en?'Routines':'Routinen';
  let empty=body.querySelector(':scope > [onclick^="startWorkout"]');
  if(empty){
    // startWorkout öffnet die Namenseingabe, deren Submit startEmptyWorkout nutzt.
    empty.classList.add('quickempty');
    empty.innerHTML=uiIcon('plus')+'<span>'+(en?'Start empty workout':'Leeres Workout starten')+'</span>';
    body.prepend(empty);
  }
  if(head){
    let group=document.createElement('details'),summary=document.createElement('summary');
    group.className='quickroutines';group.open=!trainingRoutinesCollapsed;
    summary.textContent=(en?'My routines':'Meine Routinen')+' ('+cards.length+')';group.appendChild(summary);
    head.insertAdjacentElement('afterend',group);
    // Die Überschrift wird zur Gruppenzeile; die eine Aktion „Neue Routine“ bleibt am Ende der Liste.
    head.remove();
    group.addEventListener('toggle',()=>{trainingRoutinesCollapsed=!group.open});
    for(let card of cards){
      let start=card.querySelector('.actionrow [onclick^="startRoutine"]');
      let routine=state.routines.find(r=>start?.getAttribute('onclick')===`startRoutine('${r.id}')`);
      if(!start||!routine)continue;
      card.classList.add('quickstart');card.dataset.motion='enter';
      let cardhead=card.querySelector(':scope > .cardhead');
      cardhead?.querySelector('.textbtn')?.remove();
      let menu=document.createElement('button');menu.type='button';menu.className='textbtn quickroutineoptions';
      menu.setAttribute('aria-label',(en?'Options for ':'Optionen für ')+routine.name);
      menu.setAttribute('aria-haspopup','dialog');menu.innerHTML=uiIcon('dots-three');
      menu.addEventListener('click',()=>trainingRoutineActions(routine.id));cardhead?.appendChild(menu);
      let preview=document.createElement('p');preview.className='quickroutinepreview';preview.setAttribute('data-no-translate','');
      preview.textContent=routine.exercises.map(e=>exerciseBookItem(e.exerciseId)?.name||(en?'Exercise':'Übung')).join(', ');
      start.textContent=en?'Start routine':'Routine starten';start.classList.add('full','quickroutinestart');
      // Den originalen Startknopf samt Handler erhalten, nur seine Position ändern.
      card.appendChild(start);
      card.querySelectorAll(':scope > .routinepreviewrow,:scope > details,:scope > .actionrow').forEach(el=>el.remove());
      cardhead?.insertAdjacentElement('afterend',preview);group.appendChild(card);
    }
    let blank=body.querySelector(':scope > .card.empty');if(blank)group.appendChild(blank);
    // Außerhalb der aufklappbaren Gruppe, damit „Neue Routine“ auch zugeklappt erreichbar bleibt.
    let add=body.querySelector(':scope > .routineadd');if(add)group.after(add);
  }
  let done=[...body.querySelectorAll(':scope > h3')].find(h=>h.nextElementSibling?.classList.contains('completedworkout'));
  if(done){done.classList.add('donehead');let day=done.textContent.split('·').slice(1).join('·').trim();done.textContent=(date===today()?(en?'Done today':'Heute erledigt'):(en?'Done':'Erledigt'))+(day?' · '+day:'')}
  window.pulsMotion?.scan?.(body);
}
globalThis.renderAfterTrainingTabs=function renderAfterTrainingTabs(){refineTrainingTabs()};
refineTrainingTabs();
if(typeof englishUI==='object')Object.assign(englishUI,{'Neue Routine':'New routine','Routine starten':'Start routine','Heute erledigt':'Done today','Erledigt':'Done'});
