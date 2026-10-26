/* Training: eigene Übung direkt in der Übungssuche, sichtbare Standardpause, Kalender öffnet die Auswertung,
   laufendes Workout mit grünem „Läuft“. Nur Darstellung/Bedienung; Daten und Abläufe bleiben unverändert. */

// Übung suchen und eigene Übung anlegen in einem: Ohne Treffer steht der Vorschlag oben, sonst unter der Liste.
const polishExercisePicker=exercisePicker;exercisePicker=function(...args){
  let result=polishExercisePicker.apply(this,args),custom=$('library-custom');
  custom?.closest('.formsection')?.setAttribute('hidden','');
  let search=$('library-search');if(search){search.placeholder=state.language==='en'?'Search or name a new exercise':'Übung suchen oder neu benennen';search.focus({preventScroll:true})}
  return result;
};
function addTypedExercise(){let name=$('library-search')?.value.trim(),custom=$('library-custom');if(!name||!custom)return;custom.value=name.slice(0,100);addOwnLibraryExercise()}
const polishExerciseOptions=renderExerciseOptions;renderExerciseOptions=function(query,...args){
  let result=polishExerciseOptions.call(this,query,...args),list=$('library-results'),name=String(query||'').trim();
  if(list&&name){
    let exact=exerciseOptions(name).some(x=>normalizeSearch(x.name)===normalizeSearch(name)),none=!list.querySelector('.searchitem');
    if(!exact){
      let button=document.createElement('button');button.type='button';button.className='searchitem ownexercise';button.setAttribute('onclick','addTypedExercise()');
      button.innerHTML=`<div>${esc(name)}<small>${state.language==='en'?'Add as your own exercise':'Als eigene Übung hinzufügen'}</small></div><span>${uiIcon('plus')}</span>`;
      if(none)list.prepend(button);else list.append(button);
      list.querySelector(':scope > p.note:last-child')?.remove();
    }
  }
  return result;
};

// Kalender: ein abgeschlossenes Workout öffnet direkt die Auswertung.
const polishWorkoutPage=workoutPage;workoutPage=function(...args){
  let html=polishWorkoutPage.apply(this,args);
  if(trainTab!=='calendar'||typeof calendarSelected==='undefined')return html;
  let template=document.createElement('template');template.innerHTML=html;
  let pool=state.workouts.filter(w=>w.finished&&w.date===calendarSelected);
  template.content.querySelectorAll('.searchitem[onclick^="setDate("]').forEach(button=>{
    let name=button.querySelector('div')?.firstChild?.textContent.trim(),index=pool.findIndex(w=>(w.name||'')===name);
    if(index<0)return;let w=pool.splice(index,1)[0];button.setAttribute('onclick',`workoutSummary('${w.id}')`);
  });
  return template.innerHTML;
};

// Laufendes Workout: grünes, pulsierendes „Läuft“.
const polishWorkoutCard=workoutCard;workoutCard=function(w,...args){
  let html=polishWorkoutCard.call(this,w,...args);
  return w&&!w.finished?html.replace(/<span class="badge">(Läuft|Running)<\/span>/,'<span class="badge runningbadge"><i aria-hidden="true"></i>$1</span>'):html;
};
if(typeof englishUI==='object')Object.assign(englishUI,{'Übung suchen oder neu benennen':'Search or name a new exercise','Als eigene Übung hinzufügen':'Add as your own exercise'});
