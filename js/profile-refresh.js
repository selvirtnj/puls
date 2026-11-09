/* Profil & Ziele: übersichtliches Formular ohne Erklärtexte. Die Logik bleibt in enhancements/experience/adaptation;
   hier werden nur Abschnitte geordnet, Texte gekürzt und Auswahllisten als Schalter gezeigt (die Selects bleiben die Quelle). */
const profileSegments={
  'pl-mode':{manual:'Selbst',auto:'Berechnet'},
  'pl-direction':{lose:'Abnehmen',maintain:'Halten',gain:'Aufbauen'},
  'pl-pace':{low:'Wenig',medium:'Mittel',high:'Viel',extreme:'Extrem'},
  'pl-macros':{auto:'Pro kg',manual:'Selbst'},
  'pr-method':{mifflin:'Formel',measured:'Gemessen'},
  'pr-kcal-mode':{classic:'Klassisch',baseline:'Grundbedarf + Sport'},
  'pr-baseline-factor':{'1.2':'Sitzend','1.3':'Leicht','1.4':'Aktiv'}
};
// Kurze Erklärung der Kalorienberechnung (ersetzt den längeren Text aus enhancements.js nach jeder Vorschau).
const profileKcalModeText={classic:'Sport steckt im Aktivitätsfaktor. Trainings erhöhen das Tagesziel nicht zusätzlich.',baseline:'Tagesziel = Grundbedarf (Ruheumsatz × Alltag) + geschätzte Sport-kcal des Tages. Erhalt-Lernen ist in diesem Modus aus.'};
const profileLabelText={
  'pr-age':'Alter','pr-height':'Größe (cm)','pr-weight':'Gewicht (kg)','pr-target':'Zielgewicht (kg)',
  'pr-activity':'Aktivität','pr-method':'Ruheumsatz','pr-kcal-mode':'Kalorienberechnung','pr-baseline-factor':'Alltag ohne Sport','pr-rmr':'Gemessener Ruheumsatz (kcal)',
  'pl-mode':'Kalorienziel','pl-direction':'Richtung','pl-pace':'Tempo','manual-kcal':'Kalorien (kcal/Tag)',
  'pl-macros':'Makros','pl-protein':'Protein (g/kg)','pl-fat':'Fett (g/kg)',
  'manual-p':'Protein (g)','manual-c':'Kohlenhydrate (g)','manual-f':'Fett (g)',
  'pl-adaptive':'Ziele bei neuen Gewichtseinträgen anpassen','pl-learn-tdee':'Erhalt aus Tagebuch und Gewicht lernen'
};
const profileActivityText={'1.2':'Sitzend · kaum Sport','1.375':'Leicht aktiv · 1–3 Trainings/Woche','1.55':'Moderat · 3–5 Trainings/Woche','1.725':'Sehr aktiv · viel Training','1.9':'Extrem aktiv · körperliche Arbeit'};

function translatedProfileText(text){return state.language==='en'&&typeof translatedUI==='function'?translatedUI(text):text}
function profileSetLabel(label,text){let node=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(node)node.textContent=text+' ';else label.insertBefore(document.createTextNode(text+' '),label.firstChild)}
// Abschnittstitel ohne Nummern (iOS-Gruppenüberschrift); die Nummer bleibt nur als Parameter für bestehende Aufrufer.
function profileHeading(number,title){return `<span class="label">${esc(title)}</span>`}
function profileSection(form,number,title,nodes){let section=document.createElement('div');section.className='formsection profilesection';section.innerHTML=profileHeading(number,title);for(let node of nodes)if(node)section.appendChild(node);form.insertBefore(section,form.querySelector('.profilefooter'));return section}
function syncProfileSegments(){
  for(let [id] of Object.entries(profileSegments)){
    let select=$(id),group=select?.parentElement?.querySelector(`.segmented[data-for="${id}"]`);if(!group)continue;
    group.querySelectorAll('button').forEach(button=>{let option=[...select.options].find(o=>o.value===button.dataset.value);button.hidden=!option||option.hidden;button.disabled=!!option?.disabled;button.setAttribute('aria-pressed',String(select.value===button.dataset.value))});
    // Im aktuellen Modus irrelevante Auswahl (z. B. Richtung bei selbst gesetzten Kalorien) ganz ausblenden.
    select.closest('label').classList.toggle('profileoff',select.disabled);
  }
  let pace=$('pl-pace'),info=$('pace-info');if(info){let extreme=pace&&!pace.disabled&&pace.value==='extreme';info.textContent=extreme?translatedProfileText('Max. 25 % Defizit, mind. 1.500 kcal'):'';info.classList.toggle('profileoff',!extreme)}
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
  // Erklärtexte ausblenden / entfernen.
  form.querySelectorAll(':scope > .note').forEach(note=>{if(/Alle Angaben sind optional/.test(note.textContent))note.remove()});
  for(let [id,text] of Object.entries(profileLabelText)){let input=$(id),label=input?.closest('label');if(label)profileSetLabel(label,text)}
  let activity=$('pr-activity');if(activity)for(let option of activity.options)if(profileActivityText[option.value])option.textContent=profileActivityText[option.value];
  for(let [id,labels] of Object.entries(profileSegments)){
    let select=$(id);if(!select)continue;select.classList.add('segsource');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    let group=document.createElement('div');group.className='segmented';group.dataset.for=id;group.setAttribute('role','group');group.setAttribute('aria-label',translatedProfileText(profileLabelText[id]||''));
    group.innerHTML=[...select.options].map(o=>`<button type="button" data-value="${esc(o.value)}" aria-pressed="false" onclick="chooseProfileSegment('${id}','${esc(o.value)}')">${esc(labels[o.value]||o.text)}</button>`).join('');
    select.insertAdjacentElement('afterend',group);
    select.closest('.formgrid')?.classList.add('segstack');
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
const profileRefreshPreview=updatePlanPreview;updatePlanPreview=function(...args){let result=profileRefreshPreview.apply(this,args);let info=$('kcal-mode-info'),mode=$('pr-kcal-mode')?.value;if(info){info.textContent='';info.hidden=true}syncProfileSegments();return result};
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
if(typeof englishUI==='object')Object.assign(englishUI,{'Selbst':'Manual','Berechnet':'Calculated','Abnehmen':'Lose','Halten':'Maintain','Aufbauen':'Build','Wenig':'Low','Mittel':'Medium','Viel':'High','Extrem':'Extreme','Pro kg':'Per kg','Formel':'Formula','Gemessen':'Measured','Körper':'Body','Ziel':'Goal','Makros':'Macros','Automatik':'Automation','Ergebnis':'Result','Sicherung':'Backup','Alter':'Age','Größe (cm)':'Height (cm)','Gewicht (kg)':'Weight (kg)','Zielgewicht (kg)':'Target weight (kg)','Aktivität':'Activity','Ruheumsatz':'Resting energy','Gemessener Ruheumsatz (kcal)':'Measured resting energy (kcal)','Kalorienziel':'Calorie target','Richtung':'Direction','Tempo':'Pace','Kalorien (kcal/Tag)':'Calories (kcal/day)','Protein (g/kg)':'Protein (g/kg)','Fett (g/kg)':'Fat (g/kg)','Protein (g)':'Protein (g)','Kohlenhydrate (g)':'Carbs (g)','Fett (g)':'Fat (g)','Ziele bei neuen Gewichtseinträgen anpassen':'Adjust targets with new weigh-ins','Erhalt aus Tagebuch und Gewicht lernen':'Learn maintenance from diary and weight','Sitzend · kaum Sport':'Sedentary · little exercise','Leicht aktiv · 1–3 Trainings/Woche':'Lightly active · 1–3 workouts/week','Moderat · 3–5 Trainings/Woche':'Moderate · 3–5 workouts/week','Sehr aktiv · viel Training':'Very active · lots of training','Extrem aktiv · körperliche Arbeit':'Extremely active · physical work','Klassisch':'Classic','Grundbedarf + Sport':'Baseline + exercise','Kalorienberechnung':'Calorie calculation','Alltag ohne Sport':'Daily life without exercise','Sitzend':'Sedentary','Leicht':'Light','Aktiv':'Active',[profileKcalModeText.classic]:'Exercise is part of the activity factor. Workouts do not add to the daily target.',[profileKcalModeText.baseline]:'Daily target = baseline (resting energy × daily life) + estimated exercise kcal of the day. Learning maintenance is off in this mode.'});
/* Body composition is derived at display time, never written as a measured value.
   US Navy circumference equations, inputs converted from cm to inches:
   https://www.corpscpc.noaa.gov/procedures/corps_directives/chapter_16/ncd_ch16.pdf */
measurementFields.neck=['Hals','cm',15,80]; // toolsValid reads this registry dynamically, including old backups.
function navyBodyFat(profile,measure){
 const valid=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!profile||!measure||profile.sex!=='male'||!valid(profile.height,100,250)||!valid(measure.neck,15,80)||!valid(measure.waist,30,250))return null;
 let circumference=measure.waist-measure.neck;if(circumference<=0)return null;
 let bf=86.010*Math.log10(circumference/2.54)-70.041*Math.log10(profile.height/2.54)+36.76;
 return valid(bf,2,70)?bf:null
}
function bmiBodyFat(profile,kg){
 if(!profile||!Number.isFinite(profile.age)||profile.age<18||!['male','female'].includes(profile.sex)||!Number.isFinite(profile.height)||profile.height<=0||!Number.isFinite(kg)||kg<=0)return null;
 let value=1.2*(kg/(profile.height/100)**2)+.23*profile.age-10.8*(profile.sex==='male'?1:0)-5.4;
 return Number.isFinite(value)&&value>=0&&value<=100?value:null
}
function currentBodyFat(profile=state.profile,rows=state.measurements||[],day=today()){
 const manual=x=>Number.isFinite(x.bodyfat)&&x.bodyfat>=2&&x.bodyfat<=70;
 let dated=rows.filter(x=>x.date<=day).slice().sort((a,b)=>b.date.localeCompare(a.date)||Number(manual(b))-Number(manual(a)));
 // Use one complete measurement day; never combine unrelated dates or invent missing circumferences.
 for(let row of dated){if(manual(row))return {value:row.bodyfat,estimated:false,date:row.date};let value=navyBodyFat(profile,row);if(value!==null)return {value,estimated:true,date:row.date}}
 let weight=null;
 for(let row of state.weights||[])if(row.date<=day&&Number.isFinite(row.kg)&&row.kg>0&&(!weight||row.date>=weight.date))weight=row;
 let kg=weight?.kg??profile?.weight;
 let value=bmiBodyFat(profile,kg);
 return value===null?null:{value,estimated:true,method:'bmi',date:weight?.date||day}
}
// Historical BMI series keep their actual weight and profile context.
if(typeof bodyMetrics==='function'){
 const bmiMetricsBase=bodyMetrics;
 bodyMetrics=function(weight=currentWeight(),profile=state.profile){let result=bmiMetricsBase(weight,profile);return result?{...result,bf:bmiBodyFat(profile,weight)}:result};
}
const navyMeasurementNote='';
if(typeof englishUI==='object')Object.assign(englishUI,{
 'Hals':'Neck','Körperfett':'Body fat','Körperfett geschätzt (US Navy)':'Estimated body fat (US Navy)','Körperfett manuell erfasst':'Manually recorded body fat',
 'Körperfett geschätzt':'Estimated body fat','Körperfett manuell':'Manual body fat','Stand:':'As of:',
});
function bodyFatMarkup(value){return value?'<p class="note">'+translatedProfileText('Körperfett')+': <strong>'+n(round(value.value))+' %</strong></p>':''}
const navyMeasurementsForm=measurementsForm;measurementsForm=function(...args){
 let result=navyMeasurementsForm.apply(this,args),form=$('measure-date')?.closest('form');if(!form)return result;
 let saveButton=form.querySelector('button.btn.full');
 saveButton.insertAdjacentHTML('beforebegin','<div id="navy-preview" aria-live="polite"></div>');
 let footer=document.createElement('div');footer.className='profilefooter';saveButton.before(footer);footer.append(saveButton);
 form.addEventListener('input',previewNavyBodyFat);previewNavyBodyFat();return result
};
function previewNavyBodyFat(){
 let target=$('navy-preview'),day=$('measure-date')?.value;if(!target||!toolDateValid(day)||day>today()){if(target)target.innerHTML='';return}
 let row={...(state.measurements||[]).find(x=>x.date===day),date:day};
 for(let key of ['neck','waist','bodyfat']){let raw=$('measure-'+key)?.value?.trim();if(raw){let v=Number(raw.replace(',','.'));if(!Number.isFinite(v)||v<measurementFields[key][2]||v>measurementFields[key][3]){target.innerHTML='';return}row[key]=v}}
 target.innerHTML=bodyFatMarkup(currentBodyFat(state.profile,[row],day))
}
const navyWeeklyWeightCard=weeklyWeightCard;weeklyWeightCard=function(...args){
 let html=navyWeeklyWeightCard.apply(this,args),bf=currentBodyFat();
 return html.replace(/<span>Körperfett ≈ <strong>.*?<\/strong><\/span>/,'<span>'+translatedProfileText('Körperfett')+' <strong>'+(bf?n(round(bf.value))+' %':'–')+'</strong></span>').replace(/<p(?: class="note")?>Körperfett grob aus BMI und Alter geschätzt, keine Messung\.<\/p>/,'')
};
