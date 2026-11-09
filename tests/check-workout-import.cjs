const fsImport=require('node:fs'),vmImport=require('node:vm');
// Use the actual profile validators, catalogue, workout analytics and existing DOM harness.
vmImport.runInNewContext(fsImport.readFileSync('tests/check-premium.cjs','utf8')+String.raw`
ctx.TextEncoder=TextEncoder;
run('render=function(){}');run(fs.readFileSync('js/machine-library.js','utf8'));
run('var accountManageBody=()=>\'<h2 class="dsgrouptitle">Daten</h2><section class="dsgroup ">existing</section>\';var accountListRow=({action,label})=>\'<button onclick="\'+action+\'">\'+label+\'</button>\';');ctx.cloudSession=null;
run(fs.readFileSync('js/workout-import.js','utf8'));
run(fs.readFileSync('js/strength-ranks.js','utf8'));
run('window.pulsFriendsBoard={emblem:(index,stage,size,{label})=>\'<svg data-import-emblem="\'+index+\'" aria-label="\'+esc(label)+\'"></svg>\'}');
run('state=initial();migrate();window.workoutImportForm();var importApi=window.pulsWorkoutImport;var importSaveBase=save;var saveCount=0;save=()=>saveCount++;window.modal=modal;');
const header='Date,Duration,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE,Notes';
const fixture=header+'\r\n2026-06-11 23:12:30,00 hours 39 minutes 53 seconds,,"Lateral Raise (Machine)",1,143.30047042025,10,,,8,"line 1\nline 2, ""quoted"""\r\n2026-06-11 23:12:30,00 hours 39 minutes 53 seconds,,"Lateral Raise (Machine)",2,143.8516260757125,8,,,,\r\n2026-06-12 12:00:00,00:10:00,Custom,Fixture Unlisted Motion,1,,5,,,,\r\n';
ctx.csvFixture=fixture;
(async()=>{
 const before=run('JSON.stringify(state)'),parsed=await run('importApi.parse(csvFixture)');ctx.parsedImport=parsed;
 assert.equal(run('JSON.stringify(state)'),before,'parse must not mutate profile');
 assert.equal(parsed.sessions.length,2);assert.equal(parsed.unit,'lbs');assert(!parsed.omitted);
 run('var importPlan=importApi.plan(parsedImport,"lbs",state)');
 assert.equal(run('importPlan.workouts.length'),2);assert.equal(run('importPlan.sets'),3);assert.equal(run('importPlan.mapped'),1);assert.equal(run('importPlan.fresh'),1);
 assert.equal(run('importPlan.workouts[0].exercises[0].exerciseId'),run('exerciseCatalog.find(x=>x.name==="Machine Lateral Raise").id'));
 assert.equal(run('importPlan.workouts[0].exercises[0].sets[0].kg'),65);assert.equal(run('importPlan.workouts[0].exercises[0].sets[1].kg'),65.25);
 assert.equal(run('importPlan.workouts[0].durationSeconds'),2393);assert.equal(run('importPlan.workouts[0].date'),'2026-06-11');assert.equal(run('importPlan.workouts[1].exercises[0].sets[0].kg'),'');
 assert.equal(run('importPlan.workouts[0].exercises[0].sets[0].csvFields.rpe'),'8');
 assert.equal(run('importPlan.workouts[0].exercises[0].sets[0].csvFields.notes'),'line 1\nline 2, "quoted"');
 assert.equal(run('importPlan.workouts[0].exercises[0].sets[0].setOrder'),'1');
 assert.equal(run('importPlan.routines.length'),1,'named workouts create a routine even once');
 assert.equal(run('importApi.kg(10.126,"kg")'),10.1);
 assert(run('accountManageBody().includes("workoutImportForm()")'));
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');
 assert.equal(run('JSON.stringify(state)'),before,'preview must not mutate profile');
 assert(el('workout-import-preview').innerHTML.includes('Import bestätigen'));
 assert(!el('workout-import-preview').innerHTML.includes('<select'),'weights are detected without a unit selector');
 assert(!el('workout-import-preview').innerHTML.includes('workoutImportUnit('),'certain Liftoff imports hide unit buttons');
 run('window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),2);assert.equal(run('saveCount'),1);assert(run('validData(state)'));assert(run('validData(JSON.parse(JSON.stringify(state)))'));
 // Imported workouts can be reopened and edited through the real existing handler.
 run('reopenWorkout(state.workouts[0].id)');assert.equal(run('state.workouts[0].finished'),false);assert(run('validData(state)'));assert(run('validData(JSON.parse(JSON.stringify(state)))'));
 run('state.workouts[0].finished=true;saveCount=1');
 assert.equal(run('Object.values(workoutAwards()).reduce((n,a)=>n+a.xp,0)'),0);
 run('var historicalCopy=JSON.parse(JSON.stringify(state.workouts[0]));historicalCopy.id="wi_"+"a".repeat(64);historicalCopy.date="2026-06-13";historicalCopy.exercises[0].sets=[{kg:100,reps:12,done:true}];state.workouts.push(historicalCopy)');
 assert.equal(run('workoutAwards()[historicalCopy.id].xp'),0,'an improved imported workout must not award PR XP');
 run('state.workouts.pop()');
 // Stronger imported history must not erase PR XP earned by ordinary workouts.
 run('var savedImportedWorkouts=state.workouts;var genuineA=JSON.parse(JSON.stringify(state.workouts[0]));delete genuineA.importSource;genuineA.id="genuine-a";genuineA.date="2026-06-14";genuineA.exercises[0].sets=[{kg:40,reps:10,done:true}];var genuineB=JSON.parse(JSON.stringify(genuineA));genuineB.id="genuine-b";genuineB.date="2026-06-15";genuineB.exercises[0].sets[0].kg=45;state.workouts=[genuineA,genuineB];var genuineAwardsBefore=JSON.stringify(workoutAwards());state.workouts=[...savedImportedWorkouts,...state.workouts];');
 assert.equal(run('workoutAwards()[genuineB.id].xp'),25);
 assert.equal(run('JSON.stringify(Object.fromEntries(Object.entries(workoutAwards()).filter(([id])=>id.startsWith("genuine-"))))'),run('genuineAwardsBefore'));
 assert(run('exerciseHistory(state.exerciseBook.find(b=>b.id===genuineA.exercises[0].exerciseId)).some(x=>x.w.importSource==="workout-csv"&&x.best>0)'));
 assert.equal(run('previousPerformance(genuineA,genuineA.exercises[0]).sets[0].kg'),65,'prefills still use imported history');
 run('state.workouts=savedImportedWorkouts');
 assert(run('completedWorkouts().length===2'));assert(run('loggedSets(state.workouts[0]).length===2'));
 assert(run('previousPerformance({id:"future",date:"2026-07-01"},state.workouts[0].exercises[0]).sets[0].kg===65'));
 assert.equal(run('importApi.plan(parsedImport,"kg",state).workouts.length'),0,'unit changes must not bypass dedup');
 // Idempotent after JSON backup/restore, preserving existing IDs and offline edits.
 run('state=JSON.parse(JSON.stringify(state));state.workouts.push({id:"offline",name:"Offline",date:"2026-06-13",finished:false,exercises:[]});window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),3);assert.equal(run('saveCount'),1);
 // Account change / cloud profile replacement while file read is pending cannot import into new profile.
 run('window.workoutImportForm();var resolveImport;var deferredImport=window.workoutImportFile({size:100,text:()=>new Promise(r=>resolveImport=r)});state=initial();migrate();resolveImport(csvFixture)');await run('deferredImport');
 run('window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),0);
 run('window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('cloudSession={user:{id:"different"}};window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),0);run('cloudSession=null');
 // Local edits added after preview survive confirmation. Cancel does not save.
 run('window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('modal.close();window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),0);
 run('window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('state.workouts.push({id:"latest",name:"Latest",date:"2026-06-13",finished:false,exercises:[]});window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),3);assert.equal(run('state.workouts[0].id'),'latest');
 for(const bad of [fixture.replace('2026-06-11','2026-02-30'),fixture.replace('143.30047042025','-12'),fixture.replace(',10,',',1.5,'),fixture+'"unterminated',header+'\nwrong',header]){ctx.badCsv=bad;await assert.rejects(run('importApi.parse(badCsv)'))}
 ctx.hevyCsv='title,start_time,end_time,exercise_title,set_index,weight_kg,reps,duration_seconds\nMorning,"11 Jun 2026, 10:00","11 Jun 2026, 10:30",Machine Lateral Raise,0,65,10,\n';
 const hevy=await run('importApi.parse(hevyCsv)');assert.equal(hevy.unit,'kg');assert.equal(hevy.sessions[0].seconds,1800);
 // Session duration uses the maximum, including missing values, regardless of row order.
 const durationRows=['01 hours 38 minutes 23 seconds','01 hours 38 minutes 24 seconds',''].map((d,i)=>'2026-06-11 23:12:30,'+d+',Duration,Chest Press,'+(i+1)+',40,8,,,,');
 ctx.durationCsv=header+'\n'+durationRows.join('\n');ctx.durationParsed=await run('importApi.parse(durationCsv)');
 assert.equal(ctx.durationParsed.sessions[0].seconds,5904);
 ctx.durationCsv=header+'\n'+durationRows.toReversed().join('\n');
 assert.equal((await run('importApi.parse(durationCsv)')).sessions[0].id,ctx.durationParsed.sessions[0].id);
 ctx.durationCsv=header+'\n'+durationRows.map(row=>row.replace(/23 seconds|,,Duration/,m=>m==='23 seconds'?'24 seconds':',01 hours 38 minutes 24 seconds,Duration')).join('\n');
 const uniformDuration=await run('importApi.parse(durationCsv)');
 const legacySignature=JSON.stringify(['2026-06-11T23:12:30','Duration',5904,[1,2,3].map(i=>JSON.stringify(['chest press',i,40,8])).sort()]);
 assert.equal(uniformDuration.sessions[0].id,'wi_'+require('node:crypto').createHash('sha256').update(legacySignature).digest('hex'),'uniform exports retain the pre-fix signature');
 assert.equal(uniformDuration.sessions[0].id,ctx.durationParsed.sessions[0].id);
 assert.equal(run('importApi.plan(durationParsed,"kg",{...initial(),workouts:importApi.plan(durationParsed,"kg",initial()).workouts}).duplicates'),1);
 // Contradictory end stamps retain source text without inventing an overnight interval.
 ctx.overnightCsv='title,start_time,end_time,exercise_title,set_index,weight_kg,reps,duration\nNight,2026-06-11 23:50:00,2026-06-11 00:10:00,Plank,0,,,1200\n';
 ctx.overnightParsed=await run('importApi.parse(overnightCsv)');
 assert.equal(ctx.overnightParsed.sessions[0].seconds,1200);
 assert.equal(run('importApi.plan(overnightParsed,"kg",initial()).workouts[0].exercises[0].sets[0].csvFields["end time"]'),'2026-06-11 00:10:00');
 ctx.overnightCsv=ctx.overnightCsv.replace(',1200\n',',\n');
 assert.equal((await run('importApi.parse(overnightCsv)')).sessions[0].seconds,undefined);
 ctx.cardioCsv=header+'\n2026-06-11,600,Cardio,Plank,1,,,,60,,\n2026-06-11,600,Cardio,Running,1,,0,1000,,,\n';
 ctx.cardioParsed=await run('importApi.parse(cardioCsv)');
 run('var cardioPlan=importApi.plan(cardioParsed,"kg",initial())');
 assert(run('cardioPlan.workouts[0].exercises.every(e=>e.sets[0].kg===""&&e.sets[0].reps==="")'));
 assert.equal(run('cardioPlan.workouts[0].exercises[0].sets[0].csvFields.seconds'),'60');
 assert.equal(run('cardioPlan.workouts[0].exercises[1].sets[0].csvFields.distance'),'1000');
 run('var cardioProfile={...initial(),workouts:cardioPlan.workouts,exerciseBook:cardioPlan.added,routines:cardioPlan.routines}');
 assert(run('validData(JSON.parse(JSON.stringify(cardioProfile)))'));
 // Unit headers win over grid evidence and format; unlabelled grids are inferred.
 for(const [weightHeader,value,expected] of [['Weight (kg)','143.30047042025','kg'],['weight_kg','143.30047042025','kg'],['Weight (lbs)','65','lbs'],['weight_lbs','65','lbs'],['Weight (lb)','65','lbs']]){
  ctx.unitCsv=header.replace('Weight,',weightHeader+',')+'\n2026-06-11,600,Units,Chest Press,1,'+value+',10,,,,\n';
  assert.equal((await run('importApi.parse(unitCsv)')).unit,expected,weightHeader);
 }
 ctx.metricCsv=header.replace('Seconds','Set Seconds')+'\n'+['65','65.5','65.25','0',''].map((v,i)=>'2026-06-11,600,Metric,Chest Press,'+(i+1)+','+v+',10,,,,').join('\n');
 ctx.metricParsed=await run('importApi.parse(metricCsv)');assert.equal(ctx.metricParsed.unit,'kg','clear fractional metric grid in a non-Liftoff schema');
 assert.equal(run('importApi.plan(metricParsed,metricParsed.unit,initial()).workouts[0].exercises[0].sets[2].kg'),65.25);
 ctx.tieCsv=header+'\n2026-06-11,600,Tie,Chest Press,1,0,10,,,,\n';
 assert.equal((await run('importApi.parse(tieCsv)')).unit,'lbs','no evidence uses Liftoff fallback');
 ctx.noisyCsv=header+'\n'+['143.3004705','144.4027817','143.8516261','19.123'].map((v,i)=>'2026-06-11,600,Noisy,Chest Press,'+(i+1)+','+v+',10,,,,').join('\n');
 assert.equal((await run('importApi.parse(noisyCsv)')).unit,'lbs','converted kg grid tolerates rounding and an outlier');
 // Prior manual-unit imports retain raw-source identities, kg values and local edits.
 run('var legacyMetric=importApi.plan(metricParsed,"kg",initial());legacyMetric.workouts[0].exercises[0].sets[0].kg=99');
 assert.equal(run('importApi.plan(metricParsed,metricParsed.unit,{...initial(),workouts:legacyMetric.workouts}).workouts.length'),0);
 assert.equal(run('legacyMetric.workouts[0].exercises[0].sets[0].kg'),99);
 ctx.strongCsv='Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Notes\n2026-06-11 10:00:00;Strong;30m;Machine Lateral Raise;1;65;10;\n';assert.equal((await run('importApi.parse(strongCsv)')).sessions.length,1);
 // Exact Liftoff schema always stores pounds, even when the numbers look metric.
 for(const values of [[135,185,225,45],[137.5],[49.6,110.2,220.5],[102.06,22.68,31.8],[20,22.5,100]]){
  ctx.unitCsv=header+'\n'+values.map((v,i)=>'2026-06-11,600,Units,Chest Press,'+(i+1)+','+v+',8,,,,').join('\n');
  const p=await run('importApi.parse(unitCsv)');assert.equal(p.unit,'lbs');assert.equal(p.unitUncertain,false);
 }
 const strongHeader='Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Notes';
 for(const [values,expected] of [[[135,185,225,45],'lbs'],[[49.6,110.2,220.5],'lbs'],[[20,22.5,100],'kg']]){
  ctx.unitCsv=strongHeader+'\n'+values.map((v,i)=>'2026-06-11;Units;30m;Bench Press (Barbell);'+(i+1)+';'+v+';8;').join('\n');
  const p=await run('importApi.parse(unitCsv)');assert.equal(p.unit,expected);assert.equal(p.unitUncertain,false);
  run('state=initial();migrate();window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>unitCsv})');
  assert(!el('workout-import-preview').innerHTML.includes('workoutImportUnit('),'certain Strong imports hide unit buttons');
 }
 // Plausible kg loads stay uncertain, including ordinary 2.5 kg machine increments.
 for(const lifts of [
  [['Bench Press (Barbell)',160],['Squat (Barbell)',220],['Deadlift (Barbell)',260]],
  [47.5,52.5,57.5,62.5].map(v=>['Leg Press (Machine)',v]),
  [['Bench Press (Barbell)',137.5]],
  [['Bench Press (Barbell)',230],['Squat (Barbell)',320],['Deadlift (Barbell)',350]]
 ]){
  ctx.unitCsv=strongHeader+'\n'+lifts.map(([name,v],i)=>'2026-06-11;Units;30m;'+name+';'+(i+1)+';'+v+';8;').join('\n');
  const parsed=await run('importApi.parse(unitCsv)');assert.equal(parsed.unit,'kg');assert.equal(parsed.unitUncertain,true);
  run('state=initial();migrate();window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>unitCsv})');
  assert.equal((el('workout-import-preview').innerHTML.match(/onclick="workoutImportUnit/g)||[]).length,2);
 }
 // Extreme loads require multiple sessions. Repeated sets or lifts in one session do not suffice.
 for(const [dates,expected] of [[['2026-06-11','2026-06-12'],false],[['2026-06-11','2026-06-11'],true]]){
  ctx.unitCsv=strongHeader+'\n'+dates.map((date,i)=>date+';Heavy;30m;'+['Bench Press (Barbell)','Squat (Barbell)'][i]+';1;'+[240,330][i]+';8;').join('\n');
  const parsed=await run('importApi.parse(unitCsv)');assert.equal(parsed.unit,'lbs');assert.equal(parsed.unitUncertain,expected);
 }
 // Uncertain exports offer only compact kg/lbs buttons; choice changes conversion, never IDs.
 ctx.uncertainCsv=ctx.strongCsv.replace(';65;10;',';60;10;');
 const uncertain=await run('importApi.parse(uncertainCsv)');assert.equal(uncertain.unit,'kg');assert.equal(uncertain.unitUncertain,true);
 run('state=initial();migrate();window.workoutImportForm()');const beforeChoice=run('JSON.stringify(state)');
 await run('window.workoutImportFile({size:1000,text:async()=>uncertainCsv})');
 assert(!el('workout-import-preview').innerHTML.includes('<select'));
 assert.equal((el('workout-import-preview').innerHTML.match(/onclick="workoutImportUnit/g)||[]).length,2);
 assert(el('workout-import-preview').innerHTML.includes('aria-pressed="true" onclick="workoutImportUnit(\'kg\')"'));
 run('window.workoutImportUnit("lbs")');assert(el('workout-import-preview').innerHTML.includes('aria-pressed="true" onclick="workoutImportUnit(\'lbs\')"'));
 run('window.workoutImportUnit("invalid")');assert.equal(run('JSON.stringify(state)'),beforeChoice);
 run('window.confirmWorkoutImport();window.workoutImportUnit("kg")');assert.equal(run('state.workouts[0].exercises[0].sets[0].kg'),27.2);
 assert.equal(run('state.workouts[0].id'),uncertain.sessions[0].id);
 run('window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>uncertainCsv})');
 run('window.workoutImportUnit("kg");window.confirmWorkoutImport()');assert.equal(run('state.workouts.length'),1);assert.equal(run('state.workouts[0].exercises[0].sets[0].kg'),27.2);
 // Same unlabelled columns in a different order are not the exact Liftoff schema.
 ctx.unitCsv=header.replace('Date,Duration','Duration,Date')+'\n600,2026-06-11,Units,Chest Press,1,60,8,,,,\n';
 const reorderedSchema=await run('importApi.parse(unitCsv)');assert.equal(reorderedSchema.liftoff,false);assert.equal(reorderedSchema.unitUncertain,true);
 ctx.strongLetterCsv=ctx.strongCsv.replace(';1;65;10;',';W;20;12;')+'2026-06-11 10:00:00;Strong;30m;Machine Lateral Raise;1;65;10;\n';
 ctx.strongLetterParsed=await run('importApi.parse(strongLetterCsv)');
 assert.equal(run('importApi.plan(strongLetterParsed,"kg",initial()).sets'),2);
 assert.equal(run('importApi.plan(strongLetterParsed,"kg",initial()).workouts[0].exercises[0].sets[0].kg'),20,'letter-labelled sets keep their source position and values');
 // Exact catalogue targets for all coordinator-approved equipment-specific aliases.
 const aliasPairs=[['Leg Extension','Leg Extensions'],['Lying Leg Curl','Lying Leg Curls'],['Seated Cable Row','Seated Cable Rows'],['Hammer Curl','Hammer Curls'],['Tricep Pushdown','Triceps Pushdown'],['Pull Ups','Pullups'],['Single Leg Extension','Single-Leg Leg Extension'],['Cable Overhead Tricep Extension','Cable Overhead Triceps Extension (Rope)'],['Machine Shoulder Press','Machine Shoulder (Military) Press'],['Machine Reverse Fly','Reverse Machine Flyes'],['Chest Press','Machine Bench Press'],['Incline Machine Bench Press','Leverage Incline Chest Press'],['Machine Row','Machine Seated Row'],['Hip Abduction','Thigh Abductor'],['Hip Adduction','Thigh Adductor'],['Machine Seated Crunch','Ab Crunch Machine'],['Iso-Lateral Row','Leverage Iso Row'],['Iso-Lateral High Row','Leverage High Row'],['Sled Leg Press','Leg Press']];
 for(const [source,target] of aliasPairs){
  ctx.aliasCsv=header+'\n2026-06-11 10:00:00,00:10:00,Aliases,'+source+',1,50,10,,,,\n';ctx.aliasParsed=await run('importApi.parse(aliasCsv)');ctx.aliasTarget=target;
  assert(run('exerciseCatalog.some(x=>x.name===aliasTarget)'),target+' missing from catalogue');
  assert.equal(run('importApi.plan(aliasParsed,"kg",initial()).workouts[0].exercises[0].exerciseId'),run('exerciseCatalog.find(x=>x.name===aliasTarget).id'),source);
 }
 // v90: Strong/Hevy-Schreibweise „Name (Equipment)“ auf exakte Katalognamen.
 const equipmentPairs=[['Bench Press (Barbell)','Barbell Bench Press - Medium Grip'],['Overhead Press (Barbell)','Standing Military Press'],['Lat Pulldown (Cable)','Wide-Grip Lat Pulldown'],['Incline Bench Press (Dumbbell)','Incline Dumbbell Press'],['Triceps Pushdown (Cable)','Triceps Pushdown'],['Romanian Deadlift (Barbell)','Romanian Deadlift'],['Lateral Raise (Dumbbell)','Side Lateral Raise'],['Bench Press (Dumbbell)','Dumbbell Bench Press'],['Incline Bench Press (Barbell)','Barbell Incline Bench Press - Medium Grip'],['Shoulder Press (Dumbbell)','Dumbbell Shoulder Press'],['Bicep Curl (Barbell)','Barbell Curl'],['Hammer Curl (Dumbbell)','Hammer Curls'],['Chest Fly (Dumbbell)','Dumbbell Flyes'],['Leg Extension (Machine)','Leg Extensions'],['Seated Leg Curl (Machine)','Seated Leg Curl'],['Hip Thrust (Barbell)','Barbell Hip Thrust'],['Front Squat (Barbell)','Front Squat (Clean Grip)'],['Bent Over Row (Dumbbell)','Bent Over Two-Dumbbell Row'],['Face Pull (Cable)','Face Pull'],['Triceps Rope Pushdown','Triceps Pushdown - Rope Attachment'],['Skullcrusher (EZ Bar)','EZ-Bar Skullcrusher'],['Shrug (Dumbbell)','Dumbbell Shrug'],['Standing Calf Raise (Machine)','Standing Calf Raises'],['Chest Press (Machine)','Machine Bench Press']];
 for(const [source,target] of equipmentPairs){
  ctx.aliasCsv=header+'\n2026-06-11 10:00:00,00:10:00,Aliases,"'+source+'",1,50,10,,,,\n';ctx.aliasParsed=await run('importApi.parse(aliasCsv)');ctx.aliasTarget=target;
  assert(run('exerciseCatalog.some(x=>x.name===aliasTarget)'),target+' missing from catalogue');
  assert.equal(run('importApi.plan(aliasParsed,"kg",initial()).workouts[0].exercises[0].exerciseId'),run('exerciseCatalog.find(x=>x.name===aliasTarget).id'),source);
 }
 assert.equal(run('importPlan.workouts[0].name'),'Liftoff-Import 2026-06-11','unnamed Liftoff sessions keep their label');
 ctx.unnamedStrongCsv='Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Notes\n2026-06-11 10:00:00;;30m;Machine Lateral Raise;1;65;10;\n';
 ctx.unnamedStrongParsed=await run('importApi.parse(unnamedStrongCsv)');
 assert.equal(run('importApi.plan(unnamedStrongParsed,"kg",initial()).workouts[0].name'),'Import 2026-06-11','non-Liftoff sessions are named neutrally');
 ctx.pluralCsv=header+'\n2026-06-11 10:00:00,00:10:00,Plural,Fixture Boxes Presses,1,50,10,,,,\n';ctx.pluralParsed=await run('importApi.parse(pluralCsv)');
 assert.equal(run('importApi.plan(pluralParsed,"kg",{workouts:[],exerciseBook:[{id:"plural-existing",name:"Fixture Box Press",target:0}]}).workouts[0].exercises[0].exerciseId'),'plural-existing');
 for(const name of ['Bench Press','Squat','Lat Pulldown']){ctx.ambiguousCsv=header+'\n2026-06-11 10:00:00,00:10:00,Ambiguous,'+name+',1,50,10,,,,\n';ctx.ambiguousParsed=await run('importApi.parse(ambiguousCsv)');assert.equal(run('importApi.plan(ambiguousParsed,"kg",initial()).fresh'),1,name+' must remain a custom exercise')}
 ctx.unnamedCsv=fixture+'2026-06-13 10:00:00,00:10:00,,,1,10,5,,,,\n';ctx.unnamedParsed=await run('importApi.parse(unnamedCsv)');assert.equal(ctx.unnamedParsed.skippedRows,1);
 assert.equal(ctx.unnamedParsed.sessions.length,2,'sessions without exercises are skipped');
 assert.equal(run('importApi.plan(unnamedParsed,"kg",initial()).workouts.length'),2);
 assert.equal(run('importApi.plan(unnamedParsed,"kg",{workouts:importApi.plan(unnamedParsed,"kg",initial()).workouts}).workouts.length'),0,'reimport also skips empty sessions');
 ctx.zeroCsv=header+'\n2026-07-01 10:00:00,600,Zero,Chest Press,1,40,8,0,0, , \n2026-07-01 10:00:00,600,Zero,Chest Press,2,40,0,100,30,8,kept\n';
 ctx.zeroParsed=await run('importApi.parse(zeroCsv)');
 assert.equal(run('importApi.plan(zeroParsed,"kg",initial()).workouts[0].exercises[0].sets[0].csvFields'),undefined,'zero and blank extras take no persisted space');
 assert.equal(run('importApi.plan(zeroParsed,"kg",initial()).workouts[0].exercises[0].sets[1].csvFields.seconds'),'30');
 assert.equal(run('importApi.plan(zeroParsed,"kg",initial()).workouts[0].exercises[0].sets[1].csvFields.reps'),undefined);
 // Repeated unnamed patterns, outliers, latest values, routine opt-out and restore dedup.
 ctx.patternCsv=header.replace('Weight,','Weight (kg),')+'\n'+[
 '2026-07-01 10:00:00,600,,Chest Press,2,40,8,,,7,older',
 '2026-07-01 10:00:00,600,,Chest Press,1,45,6,,,,',
 '2026-07-01 10:00:00,600,,Machine Shoulder Press,1,20,10,,,,',
 '2026-07-02 10:00:00,600,,Fixture Odd Movement,1,10,5,,,,',
 '2026-07-03 10:00:00,600,,Chest Press,2,50,9,100,30,9,latest',
 '2026-07-03 10:00:00,600,,Chest Press,1,55,7,,,,',
 '2026-07-03 10:00:00,600,,Machine Shoulder Press,1,25,12,,,8,press'
 ].join('\n')+'\n';
 ctx.patternParsed=await run('importApi.parse(patternCsv)');run('var patternPlan=importApi.plan(patternParsed,"kg",initial())');
 assert.equal(run('patternPlan.routines.length'),1);assert.equal(run('patternPlan.routines[0].name'),'Push');
 assert.equal(run('patternPlan.routines[0].exercises[0].sets'),2);assert.equal(run('patternPlan.routines[0].exercises[0].min'),7);assert.equal(run('patternPlan.routines[0].exercises[0].max'),9);
 assert.equal(run('patternPlan.workouts[2].exercises[0].sets[0].kg'),55,'source set order controls imported sets');
 assert.equal(run('patternPlan.workouts[2].exercises[0].sets[1].csvFields.distance'),'100');assert.equal(run('patternPlan.workouts[2].exercises[0].sets[1].csvFields.seconds'),'30');
 run('state=initial();migrate();window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>patternCsv})');
 assert(el('workout-import-preview').innerHTML.includes('workoutImportRoutines(this.checked)'));
 run('window.workoutImportRoutines(false);window.confirmWorkoutImport()');assert.equal(run('state.routines.length'),0);assert.equal(run('state.workouts.length'),3);
 assert(run('state.workouts.every(w=>w.routineId===undefined)'),'routine opt-out leaves no dangling reference');
 run('window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>patternCsv})');
 const confirmDisabled=()=>/onclick="confirmWorkoutImport\(\)" disabled/.test(el('workout-import-preview').innerHTML);
 assert(!confirmDisabled());run('window.workoutImportRoutines(false)');assert(confirmDisabled(),'routine-only reimport disables confirm after opt-out');
 assert(!el('workout-import-preview').innerHTML.includes('Push ·'));
 run('window.workoutImportRoutines(true)');assert(!confirmDisabled(),'opt-in enables routine-only import again');run('window.confirmWorkoutImport()');
 assert.equal(run('state.routines.length'),1,'routines can be added after an earlier opt-out');assert.equal(run('state.workouts.length'),3);
 assert(run('importApi.plan(patternParsed,"kg",{...initial(),routines:state.routines},false).workouts.every(w=>!w.routineId||state.routines.some(r=>r.id===w.routineId))'),'opt-out can reference an existing routine');
 assert(run('importApi.plan(patternParsed,"kg",{...initial(),routines:state.routines},false).workouts.some(w=>w.routineId===state.routines[0].id)'));
 run('state=JSON.parse(JSON.stringify(state));var patternRoutineId=state.routines[0].id;state.routines[0].name="Edited locally";window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>patternCsv})');run('window.confirmWorkoutImport()');
 assert.equal(run('state.routines.length'),1);assert.equal(run('state.routines[0].name'),'Edited locally');assert.equal(run('state.routines[0].id'),run('patternRoutineId'));
 run('for(let w of state.workouts)delete w.routineId;var competing=JSON.parse(JSON.stringify(state.workouts[2]));competing.id="unrelated-later";delete competing.importSource;competing.date="2026-07-04";competing.exercises[0].sets[0].kg=99;state.workouts.push(competing)');
 run('date="2026-07-04";sessionWorkoutId=null;completionId=null;startRoutine(patternRoutineId)');
 assert.equal(run('state.workouts.at(-1).exercises[0].sets[0].kg'),55);assert.equal(run('state.workouts.at(-1).exercises[0].sets[1].reps'),9);assert(!run('state.workouts.at(-1).exercises[0].sets[0].done'));assert(run('validData(state)'));
 run('state.workouts[0].exercises[0].sets[0].csvFields={notes:42}');assert(!run('validData(state)'));run('delete state.workouts[0].exercises[0].sets[0].csvFields');
 run('state=initial();migrate();state.language="en"');ctx.legCsv=ctx.patternCsv.replaceAll('Chest Press','Leg Extension').replaceAll('Machine Shoulder Press','Lying Leg Curl');ctx.legParsed=await run('importApi.parse(legCsv)');assert.equal(run('importApi.plan(legParsed,"kg",state).routines[0].name'),'Legs');
 ctx.dayOnlyCsv=header+'\n2026-06-11,,,Machine Lateral Raise,1,65,10,,,,\n';ctx.dayOnlyParsed=await run('importApi.parse(dayOnlyCsv)');
 assert(run('importApi.plan(dayOnlyParsed,"kg",initial()).workouts.every(w=>w.startedAt===undefined&&w.finishedAt===undefined&&w.durationSeconds===undefined)'));
 // Formatting and row ordering do not change stable session identities.
 ctx.reorderedCsv=header+'\n'+fixture.split('\r\n').slice(1,-1).reverse().join('\n');
 assert.equal((await run('importApi.parse(reorderedCsv)')).sessions[0].id,parsed.sessions[0].id);
 // Current library IDs win even when the source matches a catalogue alias.
 run('var aliasSource=exerciseCatalog.find(x=>x.name==="Machine Lateral Raise");var existingBookEntry={id:"existing-local-id",name:aliasSource.name,target:100};');
 assert.equal(run('importApi.plan(parsedImport,"lbs",{workouts:[],exerciseBook:[existingBookEntry]}).workouts[0].exercises[0].exerciseId'),'existing-local-id');
 assert.equal(run('existingBookEntry.target'),100,'existing exercise settings stay unchanged');
 // New metadata rejects malformed marker, old profile remains accepted.
 run('state.workouts=patternPlan.workouts;state.exerciseBook=patternPlan.added;state.routines=patternPlan.routines');
 run('state.workouts.at(-1).importSource="bad"');assert(!run('validData(state)'));run('delete state.workouts.at(-1).importSource');assert(run('validData(state)'));
 // Onboarding: optional step after profile commit, existing Skip, cancel, preview and confirm.
 for(const language of ['de','en']){
  ctx.onboardingLanguage=language;
  run('state=initial();migrate();state.language=onboardingLanguage;setupPending=true;state.setupPending=true;finishOnboarding()');
  assert(el('mb').innerHTML.includes(language==='de'?'Aus Liftoff importieren':'Import from Liftoff'));
  assert(el('mb').innerHTML.includes('finishWorkoutImportOnboarding()'),'Continue is available without importing');
  assert(run('setupPending'));assert(!run('state.onboardingComplete'));
  run('window.workoutImportForm(true);window.cancelWorkoutImport()');
  assert(el('mb').innerHTML.includes('workoutImportForm(true)'),'cancel returns to optional step');
  run('window.finishWorkoutImportOnboarding()');assert(!run('setupPending'));assert(run('state.onboardingComplete'));assert.equal(run('state.workouts.length'),0);
 }
 run('state=initial();migrate();setupPending=true;finishOnboarding();window.workoutImportForm(true)');
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');
 assert(el('workout-import-preview').innerHTML.includes('workoutImportRoutines(this.checked)'));
 run('window.confirmWorkoutImport()');assert(run('setupPending'));assert(el('mb').innerHTML.includes('Weiter'));run('window.finishWorkoutImportResult()');assert(!run('setupPending'));assert(run('state.onboardingComplete'));assert.equal(run('state.workouts.length'),2);
 assert.equal(run('state.workouts[0].exercises[0].sets[0].kg'),65);
 run('state=initial();migrate();setupPending=true;finishOnboarding();window.workoutImportForm(true)');
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('skipOnboarding();window.confirmWorkoutImport()');
 assert(run('state.onboardingComplete'));assert.equal(run('state.workouts.length'),0,'Skip cancels unconfirmed import');
 // Real strength projection on confirmed imports, localized result and one opt-in refresh.
 ctx.rankCsv=header+'\n'+['Chest Press','Leg Extension','Seated Cable Row','Hammer Curl','Machine Shoulder Press','Lying Leg Curl'].map((name,i)=>'2026-06-11,600,Ranks,'+name+',1,'+(40+i*5)+',8,,,,').join('\n');
 run('var refreshCount=0;window.pulsFriends={refresh:force=>{if(force)refreshCount++}};window.pulsFriendsData87={getSnapshot:()=>({self:{code:"ABCDEF123456"}})}');
 for(const language of ['de','en']){
  ctx.rankLanguage=language;
  run('state=initial();migrate();state.language=rankLanguage;state.weights=[{id:"rank-weight",date:"2026-01-01",kg:80}];window.workoutImportForm()');
  await run('window.workoutImportFile({size:1000,text:async()=>rankCsv})');
  const count=run('refreshCount');run('window.confirmWorkoutImport()');assert.equal(run('refreshCount'),count+1);
  assert.equal(run('window.pulsStrength.all().length'),6);assert.notEqual(run('window.pulsStrength.overall().rankIndex'),null);
  assert(el('mb').innerHTML.includes(run('window.pulsStrength.overall().name')));assert(el('mb').innerHTML.includes('data-import-emblem'));
  assert.equal((el('mb').innerHTML.match(/class="dsrow"/g)||[]).length,5);
  assert(el('mb').innerHTML.includes(language==='de'?'Fertig':'Done'));assert(!el('mb').innerHTML.includes('finishWorkoutImportResult(true)'));
  run('window.confirmWorkoutImport()');assert.equal(run('refreshCount'),count+1,'double confirmation does not publish again');
  run('window.finishWorkoutImportResult()');
 }
 run('window.pulsFriendsData87={getSnapshot:()=>null};state=initial();migrate();delete state.profile;state.weights=[];window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>rankCsv})');
 const countWithoutFriends=run('refreshCount');run('window.confirmWorkoutImport()');assert.equal(run('refreshCount'),countWithoutFriends);
 assert(el('mb').innerHTML.includes('Gewicht eintragen'));assert(!el('mb').innerHTML.includes('data-import-emblem'));
 run('var originalWeightForm=weightForm;var importWeightCalls=0;weightForm=()=>importWeightCalls++;window.finishWorkoutImportResult(true);weightForm=originalWeightForm');assert.equal(run('importWeightCalls'),1);
 // Actual post-import form saves only the entered measurement, plus a profile fallback.
 for(const onboarding of [false,true]){
  ctx.weightOnboarding=onboarding;
  run('state=initial();migrate();delete state.profile;state.weights=[];date=today();setupPending=weightOnboarding;if(weightOnboarding)finishOnboarding();window.workoutImportForm(weightOnboarding)');
  await run('window.workoutImportFile({size:1000,text:async()=>rankCsv})');run('window.confirmWorkoutImport();window.finishWorkoutImportResult(true)');
  assert(el('mb').innerHTML.includes('onsubmit="workoutImportWeight(event)"'));
  assert.equal(run('window.pulsStrength.weightAt(state,"2026-06-11")'),null);
  const weightSaveCount=run('saveCount');
  run('$("wdate").value=today();$("kg").value="0";window.workoutImportWeight({preventDefault(){}})');
  assert.equal(run('state.weights.length'),0);assert.equal(run('saveCount'),weightSaveCount);assert(!run('state.profile'));
  run('$("kg").value="80,5";window.workoutImportWeight({preventDefault(){}})');
  assert.equal(run('state.weights.length'),1);assert.equal(run('state.weights[0].date'),run('today()'));assert(!run('state.profile'),'weight entry must not create an incomplete profile');
  assert.equal(run('saveCount'),weightSaveCount+1);assert.equal(run('window.pulsStrength.weightAt(state,"2026-06-11")'),80.5);
  assert.notEqual(run('window.pulsStrength.overall().rankIndex'),null);assert(run('validData(state)'));assert(run('validData(JSON.parse(JSON.stringify(state)))'));
  assert(!run('state.profile'));assert(!run('validData({...state,profile:{weight:80}})'));assert(!run('setupPending'));
  assert(!run('validData({...state,profile:{weight:19}})'));assert(!run('validData({...state,profile:{weight:401}})'));assert(!run('validData({...state,profile:{weight:"80"}})'));
  assert(!run('validData({...state,profile:{weight:80,age:30}})'),'other incomplete profiles remain invalid');
 }
 // Existing profile values are preserved; an account switch invalidates the form.
 run('state=initial();migrate();state.profile={age:30,height:180,weight:75,target:75,sex:"male",activity:1.375,method:"mifflin",rmr:0,special:false};state.weights=[];window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>rankCsv})');run('window.confirmWorkoutImport();window.finishWorkoutImportResult(true);$("wdate").value=today();$("kg").value="80";window.workoutImportWeight({preventDefault(){}})');
 assert.equal(run('state.profile.weight'),75);assert.equal(run('state.weights[0].kg'),80);assert(run('validData(state)'));
 run('state=initial();migrate();window.workoutImportForm()');await run('window.workoutImportFile({size:1000,text:async()=>rankCsv})');
 run('window.confirmWorkoutImport();window.finishWorkoutImportResult(true);cloudSession={user:{id:"switched-weight-owner"}};window.workoutImportWeight({preventDefault(){}})');
 assert.equal(run('state.weights.length'),0);assert(!run('state.profile'));run('cloudSession=null');
 // Escape source/custom exercise names in the result and keep JSON restoration rank-equivalent.
 ctx.escapeRankCsv=header+'\n2026-06-11,600,Ranks,<img src=x onerror=alert(1)> Chest Press,1,40,8,,,,\n';
 run('state=initial();migrate();state.weights=[{id:"rank-weight",date:"2026-01-01",kg:80}];window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>escapeRankCsv})');run('window.confirmWorkoutImport()');
 assert(!el('mb').innerHTML.includes('<img src=x'));assert(el('mb').innerHTML.includes('&lt;img'));
 assert.equal(run('JSON.stringify(window.pulsStrength.all())'),run('JSON.stringify(window.pulsStrength.all(JSON.parse(JSON.stringify(state))))'));
 run('state=initial();migrate();window.finishWorkoutImportResult(true)');assert.equal(run('importWeightCalls'),1,'result from a replaced profile cannot act');
 // Exercise the real save/cloud wrapper with a local mocked CAS conflict and pending offline profile.
 delete ctx.cloudSession;ctx.window.PULS_CLOUD={url:'https://unit-test.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
 ctx.AbortController=AbortController;ctx.atob=s=>Buffer.from(s,'base64').toString();let importDisk=new Map(),casCalls=0;
 Object.assign(ctx.localStorage,{getItem:k=>importDisk.get(k)||null,setItem:(k,v)=>importDisk.set(k,v),removeItem:k=>importDisk.delete(k)});
 ctx.fetch=async(url,options)=>{if(url.includes('/rpc/puls_save_profile')){casCalls++;assert.equal(JSON.parse(options.body).p_expected_revision,7)}return {ok:true,text:async()=>'null'}};
 run('save=importSaveBase;state=initial();migrate()');run(fs.readFileSync('js/cloud.js','utf8'));
 run('cloudSession={expires_at:Date.now()/1000+3600,user:{id:"synthetic-import-owner"}};cloudRevision=7;window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('state.goals.kcal=2300;window.confirmWorkoutImport()');
 assert(run('cloudDirty'));assert.equal(JSON.parse(importDisk.get('puls-v1')).workouts.length,2);assert.equal(run('state.goals.kcal'),2300);
 run('window.finishWorkoutImportResult(true);$("wdate").value=today();$("kg").value="80";window.workoutImportWeight({preventDefault(){}})');
 assert(run('cloudDirty'));ctx.savedWeightPayload=JSON.parse(importDisk.get('puls-v1'));
 assert(!ctx.savedWeightPayload.profile);assert.equal(ctx.savedWeightPayload.weights[0].kg,80);assert.equal(ctx.savedWeightPayload.weights.length,1);assert(run('validData(savedWeightPayload)'));
 await run('syncCloud()');assert.equal(casCalls,1);assert(run('cloudConflict'));assert.equal(run('cloudRevision'),7);assert.equal(run('state.workouts.length'),2);
 await run('syncCloud()');assert.equal(casCalls,1,'conflict must stop repeated uploads');
 await run('signOutCloud()');assert.equal(JSON.parse(importDisk.get('puls-cloud-pending-synthetic-import-owner')).workouts.length,2);
 assert(!JSON.parse(importDisk.get('puls-cloud-pending-synthetic-import-owner')).profile);assert.equal(JSON.parse(importDisk.get('puls-cloud-pending-synthetic-import-owner')).weights[0].kg,80);
 console.log('PASS: workout CSV preview, units, mapping, append-only confirmation, dedup, backup, owner races, validation and historical analytics.');
})()
`,{require,console,process,TextEncoder,AbortController,Buffer},{filename:'workout-import-harness'}).catch(error=>{console.error(error);process.exitCode=1});
