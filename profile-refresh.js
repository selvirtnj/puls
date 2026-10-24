/* Profil & Ziele: übersichtliches Formular ohne Erklärtexte. Die Logik bleibt in enhancements/experience/adaptation;
   hier werden nur Abschnitte geordnet, Texte gekürzt und Auswahllisten als Schalter gezeigt (die Selects bleiben die Quelle). */
const profileSegments={
  'pl-mode':{manual:'Selbst',auto:'Berechnet'},
  'pl-direction':{lose:'Abnehmen',maintain:'Halten',gain:'Aufbauen'},
  'pl-pace':{low:'Wenig',medium:'Mittel',high:'Viel',extreme:'Extrem'},
  'pl-macros':{auto:'Pro kg',manual:'Selbst'},
  'pr-method':{mifflin:'Formel',measured:'Gemessen'}
};
const profileLabelText={
  'pr-age':'Alter','pr-height':'Größe (cm)','pr-weight':'Gewicht (kg)','pr-target':'Zielgewicht (kg)',
  'pr-activity':'Aktivität','pr-method':'Ruheumsatz','pr-rmr':'Gemessener Ruheumsatz (kcal)',
  'pl-mode':'Kalorienziel','pl-direction':'Richtung','pl-pace':'Tempo','manual-kcal':'Kalorien (kcal/Tag)',
  'pl-macros':'Makros','pl-protein':'Protein (g/kg)','pl-fat':'Fett (g/kg)',
  'manual-p':'Protein (g)','manual-c':'Kohlenhydrate (g)','manual-f':'Fett (g)',
  'pl-adaptive':'Ziele bei neuen Gewichtseinträgen anpassen','pl-learn-tdee':'Erhalt aus Tagebuch und Gewicht lernen'
};
const profileActivityText={'1.2':'Sitzend · kaum Sport','1.375':'Leicht aktiv · 1–3 Trainings/Woche','1.55':'Moderat · 3–5 Trainings/Woche','1.725':'Sehr aktiv · viel Training','1.9':'Extrem aktiv · körperliche Arbeit'};

function translatedProfileText(text){return state.language==='en'&&typeof translatedUI==='function'?translatedUI(text):text}
function profileSetLabel(label,text){let node=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(node)node.textContent=text+' ';else label.insertBefore(document.createTextNode(text+' '),label.firstChild)}
function profileHeading(number,title){return `<span class="label"><i>${number}</i>${esc(title)}</span>`}
function profileSection(form,number,title,nodes){let section=document.createElement('div');section.className='formsection profilesection';section.innerHTML=profileHeading(number,title);for(let node of nodes)if(node)section.appendChild(node);form.insertBefore(section,form.querySelector('.profilefooter'));return section}
function syncProfileSegments(){
  for(let [id] of Object.entries(profileSegments)){
    let select=$(id),group=select?.parentElement?.querySelector(`.segmented[data-for="${id}"]`);if(!group)continue;
    group.querySelectorAll('button').forEach(button=>{let option=[...select.options].find(o=>o.value===button.dataset.value);button.hidden=!option||option.hidden;button.disabled=!!option?.disabled;button.setAttribute('aria-pressed',String(select.value===button.dataset.value))});
    // Im aktuellen Modus irrelevante Auswahl (z. B. Richtung bei selbst gesetzten Kalorien) ganz ausblenden.
    select.closest('label').classList.toggle('profileoff',select.disabled);
  }
  let pace=$('pl-pace'),info=$('pace-info');if(info)info.classList.toggle('profileoff',!pace||pace.disabled);
  document.querySelectorAll('#planner-form label.checklabel').forEach(label=>label.classList.toggle('profileoff',!!label.querySelector('input')?.disabled));
  document.querySelectorAll('#planner-form .profilesection').forEach(section=>section.classList.toggle('profileoff',![...section.children].some(child=>!child.classList.contains('label')&&!child.classList.contains('profileoff')&&!child.hidden&&getComputedStyle(child).display!=='none')));
  let macros=$('pl-macros');$('auto-macros')?.classList.toggle('profileoff',!!macros&&(macros.disabled||macros.value!=='auto'));
  // Ergebnis: Zahlen und Zieltermin zeigen, Erklär- und Annahmetexte ausblenden.
  let preview=$('plan-preview');if(preview){preview.querySelector('.forecastdetails')?.classList.add('profileoff');preview.querySelectorAll('.note').forEach(n=>n.classList.toggle('profileoff',/Rundungsabweichungen|bitte das Profil|lassen sich auch ohne Profil/.test(n.textContent)))}
}
function chooseProfileSegment(id,value){let select=$(id);if(!select||select.disabled||select.value===value)return;select.value=value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));syncProfileSegments()}

function refineProfileForm(){
  let form=$('planner-form');if(!form||form.dataset.refined)return;form.dataset.refined='1';
  form.closest('#mb')?.classList.add('profilemodal');
  // Erklärtexte ausblenden (per CSS); nur der Erststart-Hinweis bleibt sichtbar.
  form.querySelectorAll(':scope > .note').forEach(note=>{if(/Alle Angaben sind optional/.test(note.textContent))note.classList.add('keepnote')});
  for(let [id,text] of Object.entries(profileLabelText)){let input=$(id),label=input?.closest('label');if(label)profileSetLabel(label,text)}
  let activity=$('pr-activity');if(activity)for(let option of activity.options)if(profileActivityText[option.value])option.textContent=profileActivityText[option.value];
  for(let [id,labels] of Object.entries(profileSegments)){
    let select=$(id);if(!select)continue;select.classList.add('segsource');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    let group=document.createElement('div');group.className='segmented';group.dataset.for=id;group.setAttribute('role','group');group.setAttribute('aria-label',translatedProfileText(profileLabelText[id]||''));
    group.innerHTML=[...select.options].map(o=>`<button type="button" data-value="${esc(o.value)}" aria-pressed="false" onclick="chooseProfileSegment('${id}','${esc(o.value)}')">${esc(labels[o.value]||o.text)}</button>`).join('');
    select.insertAdjacentElement('afterend',group);
  }
  // Abschnitte: 01 Körper · 02 Ziel · 03 Makros · 04 Automatik, Ergebnis und Speichern unten fest.
  let sections=form.querySelectorAll(':scope > .formsection');
  if(sections[0])sections[0].querySelector(':scope > .label').outerHTML=profileHeading('01','Körper');
  if(sections[1])sections[1].querySelector(':scope > .label').outerHTML=profileHeading('02','Ziel');
  let footer=document.createElement('div');footer.className='profilefooter';
  for(let node of [$('plan-error'),form.querySelector(':scope > button.btn.full')])if(node)footer.appendChild(node);
  form.appendChild(footer);
  profileSection(form,'03','Makros',[$('pl-macros')?.closest('label'),$('auto-macros'),$('manual-macros')]);
  profileSection(form,'04','Automatik',[$('pl-adaptive')?.closest('label'),$('pl-learn-tdee')?.closest('label')]);
  profileSection(form,'05','Ergebnis',[$('plan-preview')]);
  syncProfileSegments();
}
function refinePlannerTabs(){let tabs=document.querySelectorAll('#mb .plannertabs button');if(tabs[1])tabs[1].textContent='Sicherung'}

const profileRefreshForm=profileForm;profileForm=function(...args){let result=profileRefreshForm.apply(this,args);refinePlannerTabs();refineProfileForm();return result};
const profileRefreshPreview=updatePlanPreview;updatePlanPreview=function(...args){let result=profileRefreshPreview.apply(this,args);syncProfileSegments();return result};
// Sicherung: nur Export, Wiederherstellen und CSV; Methoden- und Quellentexte entfallen.
const profileRefreshData=dataSettings;dataSettings=function(...args){
  let result=profileRefreshData.apply(this,args);refinePlannerTabs();
  let root=$('profile-form');if(!root)return result;root.classList.add('backuppane');
  let csv=[...root.querySelectorAll('button')].find(b=>/CSV/.test(b.textContent)),restore=[...root.querySelectorAll('label')].find(l=>l.querySelector('input[type=file]'));
  let cut=root.querySelector(':scope > hr');while(cut?.nextSibling)cut.nextSibling.remove();cut?.remove();
  root.querySelectorAll(':scope > .note').forEach(n=>n.remove());
  if(csv&&restore)restore.insertAdjacentElement('afterend',csv);
  return result
};
if(typeof englishUI==='object')Object.assign(englishUI,{'Selbst':'Manual','Berechnet':'Calculated','Abnehmen':'Lose','Halten':'Maintain','Aufbauen':'Build','Wenig':'Low','Mittel':'Medium','Viel':'High','Extrem':'Extreme','Pro kg':'Per kg','Formel':'Formula','Gemessen':'Measured','Körper':'Body','Ziel':'Goal','Makros':'Macros','Automatik':'Automation','Ergebnis':'Result','Sicherung':'Backup','Alter':'Age','Größe (cm)':'Height (cm)','Gewicht (kg)':'Weight (kg)','Zielgewicht (kg)':'Target weight (kg)','Aktivität':'Activity','Ruheumsatz':'Resting energy','Gemessener Ruheumsatz (kcal)':'Measured resting energy (kcal)','Kalorienziel':'Calorie target','Richtung':'Direction','Tempo':'Pace','Kalorien (kcal/Tag)':'Calories (kcal/day)','Protein (g/kg)':'Protein (g/kg)','Fett (g/kg)':'Fat (g/kg)','Protein (g)':'Protein (g)','Kohlenhydrate (g)':'Carbs (g)','Fett (g)':'Fat (g)','Ziele bei neuen Gewichtseinträgen anpassen':'Adjust targets with new weigh-ins','Erhalt aus Tagebuch und Gewicht lernen':'Learn maintenance from diary and weight','Sitzend · kaum Sport':'Sedentary · little exercise','Leicht aktiv · 1–3 Trainings/Woche':'Lightly active · 1–3 workouts/week','Moderat · 3–5 Trainings/Woche':'Moderate · 3–5 workouts/week','Sehr aktiv · viel Training':'Very active · lots of training','Extrem aktiv · körperliche Arbeit':'Extremely active · physical work'});