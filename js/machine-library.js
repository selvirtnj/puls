/* PULS-maintained exercise names; no images, external API or subscription. */
const machineExerciseGroups=[
 ['chest',[
 ['Machine Chest Press','Brustpresse sitzend'],['Machine Incline Chest Press','Schrägbank Brustpresse'],['Machine Decline Chest Press','negative Brustpresse'],['Machine Chest Fly','Butterfly Pec Deck Brustfliegen'],['Single-Arm Machine Chest Press','einarmige Brustpresse'],['Single-Arm Machine Chest Fly','einarmiger Butterfly'],['Plate-Loaded Chest Press','scheibenbeladene Brustpresse'],['Plate-Loaded Incline Chest Press','scheibenbeladene Schrägbank Brustpresse'],['Plate-Loaded Decline Chest Press','scheibenbeladene negative Brustpresse'],['Iso-Lateral Chest Press','unabhängige Brustpresse'],['Iso-Lateral Incline Chest Press','unabhängige Schrägbank Brustpresse'],['Machine Chest Press (Neutral Grip)','Brustpresse neutraler Griff'],['Seated Cable Chest Press','Brustpresse sitzend Kabel'],['Standing Cable Chest Press','Brustpresse stehend Kabel']]],
 ['lats',[
 ['Machine Lat Pulldown','Latzug Maschine'],['Machine Pullover','Überzugmaschine Pullover'],['Single-Arm Machine Lat Pulldown','einarmiger Latzug Maschine'],['Plate-Loaded Lat Pulldown','scheibenbeladener Latzug'],['Iso-Lateral Front Lat Pulldown','unabhängiger Latzug vorne'],['Machine Lat Pulldown (Neutral Grip)','Latzug neutraler Griff'],['Assisted Pull-Up Machine','Klimmzugmaschine unterstützt'],['Assisted Chin-Up Machine','Klimmzugmaschine Untergriff unterstützt'],['Single-Arm Cable Lat Pulldown','einarmiger Latzug Kabel'],['Kneeling Cable Lat Pulldown','kniender Latzug Kabel']]],
 ['middle back',[
 ['Machine Seated Row','Rudermaschine sitzend'],['Machine Chest-Supported Row','Rudermaschine brustgestützt'],['Machine Low Row','tiefe Rudermaschine'],['Machine High Row','hohe Rudermaschine'],['Single-Arm Machine Row','einarmige Rudermaschine'],['Plate-Loaded Seated Row','scheibenbeladenes Rudern sitzend'],['Plate-Loaded High Row','scheibenbeladenes hohes Rudern'],['Machine Wide-Grip Row','Rudermaschine breiter Griff'],['Machine Neutral-Grip Row','Rudermaschine neutraler Griff'],['Seated Cable Row (Wide Grip)','Kabelrudern breit'],['Seated Cable Row (Neutral Grip)','Kabelrudern neutral'],['Single-Arm Seated Cable Row','einarmiges Kabelrudern sitzend']]],
 ['shoulders',[
 ['Machine Lateral Raise','Seitheben Maschine Schulter'],['Single-Arm Machine Lateral Raise','einarmiges Seitheben Maschine'],['Machine Rear Delt Fly','Reverse Butterfly hintere Schulter Pec Deck'],['Single-Arm Machine Rear Delt Fly','einarmiger Reverse Butterfly'],['Plate-Loaded Shoulder Press','scheibenbeladene Schulterpresse'],['Single-Arm Machine Shoulder Press','einarmige Schulterpresse'],['Machine Shoulder Press (Neutral Grip)','Schulterpresse neutraler Griff'],['Machine Front Raise','Frontheben Maschine'],['Seated Cable Lateral Raise','Seitheben Kabel sitzend'],['Behind-the-Back Cable Lateral Raise','Seitheben Kabel hinter Rücken'],['Cable Y Raise','Y Heben Kabel Schulter']]],
 ['biceps',[
 ['Single-Arm Machine Preacher Curl','einarmiger Bizeps Scottcurl Maschine'],['Machine Biceps Curl (Neutral Grip)','Bizepsmaschine neutraler Griff Hammer Curl'],['Plate-Loaded Preacher Curl','scheibenbeladener Scottcurl Bizeps'],['Cable Preacher Curl','Scottcurl Kabel Bizeps'],['Bayesian Cable Curl','Bayesian Bizeps Kabel Curl'],['Single-Arm Cable Preacher Curl','einarmiger Scottcurl Kabel']]],
 ['triceps',[
 ['Machine Triceps Press','Trizepspresse Maschine'],['Machine Overhead Triceps Extension','Trizepsmaschine über Kopf'],['Single-Arm Machine Triceps Extension','einarmige Trizepsmaschine'],['Assisted Dip Machine','Dipmaschine unterstützt'],['Plate-Loaded Dip Machine','scheibenbeladene Dipmaschine'],['Cable Overhead Triceps Extension (Rope)','Trizepsstrecken über Kopf Seil Kabel'],['Single-Arm Cable Overhead Triceps Extension','einarmiges Trizepsstrecken über Kopf Kabel']]],
 ['quadriceps',[
 ['Pendulum Squat Machine','Pendulum Kniebeuge Pendel Squat Maschine'],['Belt Squat Machine','Gürtelkniebeuge Belt Squat'],['V-Squat Machine','V Kniebeuge Maschine'],['Horizontal Leg Press','horizontale Beinpresse'],['Vertical Leg Press','vertikale Beinpresse'],['45-Degree Leg Press','45 Grad Beinpresse'],['Single-Leg Leg Press','einbeinige Beinpresse'],['Single-Leg Hack Squat','einbeiniger Hack Squat'],['Reverse Hack Squat','umgekehrter Hack Squat'],['Machine Sissy Squat','Sissy Kniebeuge Maschine'],['Smith Machine Front Squat','Multipresse Frontkniebeuge'],['Smith Machine Bulgarian Split Squat','Multipresse bulgarische Kniebeuge']]],
 ['hamstrings',[
 ['Single-Leg Seated Leg Curl','einbeiniger Beinbeuger sitzend'],['Single-Leg Lying Leg Curl','einbeiniger Beinbeuger liegend'],['Kneeling Leg Curl Machine','kniender Beinbeuger Maschine'],['Single-Leg Standing Leg Curl','einbeiniger Beinbeuger stehend'],['Smith Machine Romanian Deadlift','Multipresse rumänisches Kreuzheben']]],
 ['glutes',[
 ['Hip Thrust Machine','Hip Thrust Glute Drive Gesäßmaschine'],['Plate-Loaded Hip Thrust','Hip Thrust scheibenbeladen'],['Glute Kickback Machine','Po Gesäß Kickback Maschine'],['Standing Hip Abduction Machine','Abduktorenmaschine stehend'],['Single-Leg Hip Thrust Machine','einbeiniger Hip Thrust Maschine'],['Cable Pull-Through','Kabel Pull Through Gesäß'],['Smith Machine Hip Thrust','Multipresse Hip Thrust']]],
 ['calves',[
 ['Standing Calf Raise Machine','Wadenheben stehend Maschine'],['Single-Leg Seated Calf Raise','einbeiniges Wadenheben sitzend'],['Single-Leg Calf Press','einbeinige Wadenpresse Beinpresse'],['Donkey Calf Raise Machine','Donkey Wadenheben Maschine'],['Tibialis Raise Machine','Schienbein Tibialis Maschine']]],
 ['abdominals',[
 ['Seated Ab Crunch Machine','Bauchpresse sitzend'],['Rotary Torso Machine','Rumpfrotation Bauch Maschine'],['Standing Cable Crunch','Bauchpressen stehend Kabel'],['Machine Leg Raise','Beinheben Bauchmaschine'],['Cable Pallof Press','Pallof Press Antirotation Kabel']]],
 ['lower back',[
 ['Back Extension Machine','Rückenstrecker Maschine'],['Seated Back Extension Machine','Rückenstrecker sitzend Maschine'],['Plate-Loaded Back Extension','Rückenstrecker scheibenbeladen']]]
];
const machineNameAliases={
 'Machine Chest Press':'Machine Bench Press',
 'Machine Incline Chest Press':'Leverage Incline Chest Press',
 'Machine Decline Chest Press':'Leverage Decline Chest Press',
 'Machine Chest Fly':'Butterfly',
 'Machine Rear Delt Fly':'Reverse Machine Flyes',
 'Machine High Row':'Leverage High Row',
 'Standing Calf Raise Machine':'Standing Calf Raises',
 'Seated Ab Crunch Machine':'Ab Crunch Machine'
};
const existingMachineAliases={
 'Leg Extensions':'Beinstrecker Leg Extension Maschine',
 'Single-Leg Leg Extension':'einbeiniger Beinstrecker Maschine',
 'Seated Leg Curl':'Beinbeuger sitzend Maschine',
 'Lying Leg Curls':'Beinbeuger liegend Maschine',
 'Standing Leg Curl':'Beinbeuger stehend Maschine',
 'Thigh Abductor':'Abduktorenmaschine Hip Abduction äußere Hüfte',
 'Thigh Adductor':'Adduktorenmaschine Hip Adduction innere Oberschenkel',
 'Machine Bicep Curl':'Bizepsmaschine Biceps Curl',
 'Machine Preacher Curls':'Scottcurl Bizepsmaschine',
 'Machine Shoulder (Military) Press':'Schulterpresse Shoulder Press Maschine',
 'Machine Triceps Extension':'Trizepsmaschine Trizepsstrecken',
 'Hack Squat':'Hackenschmidt Kniebeuge Maschine',
 'Smith Machine Incline Bench Press':'Multipresse Schrägbankdrücken',
 'Smith Machine Bench Press':'Multipresse Bankdrücken',
 'Smith Machine Squat':'Multipresse Kniebeuge',
 'Seated Calf Raise':'Wadenheben sitzend Maschine',
 'Dip Machine':'Dipmaschine Trizepspresse'
};
let machineExercisesAdded=0;
for(let [muscle,rows] of machineExerciseGroups)for(let [name,aliases] of rows){let canonical=machineNameAliases[name]||name,existing=exerciseCatalog.find(x=>normalizeSearch(x.name)===normalizeSearch(canonical));if(existing){existing.aliases=[...(existing.aliases||[]),name,aliases];continue}exerciseCatalog.push({id:'puls_machine_'+normalizeSearch(name).replaceAll(' ','_'),name,muscles:[name==='Tibialis Raise Machine'?'tibialis anterior':muscle],equipment:name.includes('Cable')?'cable':'machine',category:'strength',aliases:[aliases],source:'PULS'});machineExercisesAdded++}
for(let e of exerciseCatalog)if(existingMachineAliases[e.name])e.aliases=[...(e.aliases||[]),existingMachineAliases[e.name]];
let exerciseEquipmentFilter='all',exerciseResultLimit=60;
function isMachineExercise(x){return /machine|smith|leverage/i.test(x.equipment+' '+x.name)}
function matchesExerciseEquipment(x){return exerciseEquipmentFilter==='all'||exerciseEquipmentFilter==='machine'&&isMachineExercise(x)||exerciseEquipmentFilter==='cable'&&/cable/i.test(x.equipment+' '+x.name)||exerciseEquipmentFilter==='smith'&&/smith/i.test(x.name)}
exerciseOptions=function(query=''){let merged=new Map(),byId=new Map(exerciseCatalog.map(x=>[x.id,x])),byName=new Map(exerciseCatalog.map(x=>[normalizeSearch(x.name),x]));for(let x of [...state.exerciseBook,...exerciseCatalog]){let key=normalizeSearch(x.name);if(merged.has(key))continue;let catalog=byId.get(x.id)||byName.get(key);merged.set(key,{...catalog,...x,aliases:catalog?.aliases||x.aliases||[]})}return [...merged.values()].filter(matchesExerciseEquipment).map(x=>({x,score:searchScore([x.name,...x.aliases,...(x.muscles||[]),x.equipment||'',isMachineExercise(x)?'Maschine Maschinen Gerät Geräte':''].join(' '),query)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.x.name.localeCompare(b.x.name)).map(x=>x.x)};
function setExerciseEquipment(value){if(!['all','machine','cable','smith'].includes(value))return;exerciseEquipmentFilter=value;exerciseResultLimit=60;renderExerciseOptions($('library-search').value)}
function showMoreExercises(){exerciseResultLimit+=60;renderExerciseOptions($('library-search').value,true)}
exercisePicker=function(kind,id){exercisePickerContext={kind,id};exerciseEquipmentFilter='all';exerciseResultLimit=60;openModal('Übung auswählen',`<label>Übung, Muskel oder Equipment<input id="library-search" type="search" placeholder="z. B. Seitheben, Latzug, chest press" oninput="renderExerciseOptions(this.value)"></label><div id="exercise-equipment" class="toolactions" role="group" aria-label="Equipment filtern"></div><div id="library-results"></div><div class="formsection"><label>Eigene Übung<input id="library-custom" maxlength="100" placeholder="Exercise name"></label><button class="btn secondary full" onclick="addOwnLibraryExercise()">＋ Eigene Übung hinzufügen</button></div><button class="textbtn full" onclick="closeExercisePicker()">← Zurück</button><p class="note">${exerciseCatalog.length} Übungen · Free Exercise DB und ergänzte PULS-Maschinenübungen. Englische Namen, auch mit deutschen Suchbegriffen auffindbar. Lokal verfügbar.</p>`);renderExerciseOptions('')};
renderExerciseOptions=function(query,keepLimit=false){if(!keepLimit)exerciseResultLimit=60;let matches=exerciseOptions(query);$('exercise-equipment').innerHTML=[['all','Alle'],['machine','Maschinen'],['cable','Kabelzug'],['smith','Smith / Multipresse']].map(([key,label])=>`<button class="btn ${exerciseEquipmentFilter===key?'':'secondary'}" type="button" style="padding:8px 10px;min-height:38px;font-size:11px" aria-pressed="${exerciseEquipmentFilter===key}" onclick="setExerciseEquipment('${key}')">${label}</button>`).join('');$('library-results').innerHTML=`<p class="note">${matches.length} Treffer${matches.length>exerciseResultLimit?' · '+exerciseResultLimit+' angezeigt':''}</p><div class="librarylist">${matches.slice(0,exerciseResultLimit).map(x=>`<button class="searchitem" onclick="pickExercise('${x.id}')"><div data-no-translate>${esc(x.name)}<small>${esc((x.muscles||[]).join(', '))}${x.equipment?' · '+esc(x.equipment):''}</small></div><span>＋</span></button>`).join('')||'<p class="note">Keine passenden Übungen. Probiere einen kürzeren Begriff oder „Alle“.</p>'}</div>${matches.length>exerciseResultLimit?'<button class="btn secondary full" onclick="showMoreExercises()">Weitere Übungen anzeigen</button>':''}`};
if(typeof englishUI==='object')Object.assign(englishUI,{'Maschinen':'Machines','Kabelzug':'Cable','Smith / Multipresse':'Smith machine','Equipment filtern':'Filter equipment','Weitere Übungen anzeigen':'Show more exercises','Keine passenden Übungen. Probiere einen kürzeren Begriff oder „Alle“.':'No matching exercises. Try a shorter term or All.'});
