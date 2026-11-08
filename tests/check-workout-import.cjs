const fsImport=require('node:fs'),vmImport=require('node:vm');
// Use the actual profile validators, catalogue, workout analytics and existing DOM harness.
vmImport.runInNewContext(fsImport.readFileSync('tests/check-premium.cjs','utf8')+String.raw`
ctx.TextEncoder=TextEncoder;
run('render=function(){}');run(fs.readFileSync('js/machine-library.js','utf8'));
run('var accountManageBody=()=>\'<h2 class="dsgrouptitle">Daten</h2><section class="dsgroup ">existing</section>\';var accountListRow=({action,label})=>\'<button onclick="\'+action+\'">\'+label+\'</button>\';');ctx.cloudSession=null;
run(fs.readFileSync('js/workout-import.js','utf8'));
run('state=initial();migrate();window.workoutImportForm();var importApi=window.pulsWorkoutImport;var importSaveBase=save;var saveCount=0;save=()=>saveCount++;window.modal=modal;');
const header='Date,Duration,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE,Notes';
const fixture=header+'\r\n2026-06-11 23:12:30,00 hours 39 minutes 53 seconds,,"Lateral Raise (Machine)",1,143.30047042025,10,,,8,"line 1\nline 2, ""quoted"""\r\n2026-06-11 23:12:30,00 hours 39 minutes 53 seconds,,"Lateral Raise (Machine)",2,143.8516260757125,8,,,,\r\n2026-06-12 12:00:00,00:10:00,Custom,Fixture Unlisted Motion,1,,5,,,,\r\n';
ctx.csvFixture=fixture;
(async()=>{
 const before=run('JSON.stringify(state)'),parsed=await run('importApi.parse(csvFixture)');ctx.parsedImport=parsed;
 assert.equal(run('JSON.stringify(state)'),before,'parse must not mutate profile');
 assert.equal(parsed.sessions.length,2);assert.equal(parsed.unit,'lbs');assert(parsed.omitted);
 run('var importPlan=importApi.plan(parsedImport,"lbs",state)');
 assert.equal(run('importPlan.workouts.length'),2);assert.equal(run('importPlan.sets'),3);assert.equal(run('importPlan.mapped'),1);assert.equal(run('importPlan.fresh'),1);
 assert.equal(run('importPlan.workouts[0].exercises[0].exerciseId'),run('exerciseCatalog.find(x=>x.name==="Machine Lateral Raise").id'));
 assert.equal(run('importPlan.workouts[0].exercises[0].sets[0].kg'),65);assert.equal(run('importPlan.workouts[0].exercises[0].sets[1].kg'),65.25);
 assert.equal(run('importPlan.workouts[0].durationSeconds'),2393);assert.equal(run('importPlan.workouts[0].date'),'2026-06-11');assert.equal(run('importPlan.workouts[1].exercises[0].sets[0].kg'),'');
 assert.equal(run('importApi.kg(10.126,"kg")'),10.1);
 assert(run('accountManageBody().includes("workoutImportForm()")'));
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');
 assert.equal(run('JSON.stringify(state)'),before,'preview must not mutate profile');
 assert(el('workout-import-preview').innerHTML.includes('Import bestätigen'));
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
 ctx.strongCsv='Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Notes\n2026-06-11 10:00:00;Strong;30m;Machine Lateral Raise;1;65;10;\n';assert.equal((await run('importApi.parse(strongCsv)')).sessions.length,1);
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
 ctx.pluralCsv=header+'\n2026-06-11 10:00:00,00:10:00,Plural,Fixture Boxes Presses,1,50,10,,,,\n';ctx.pluralParsed=await run('importApi.parse(pluralCsv)');
 assert.equal(run('importApi.plan(pluralParsed,"kg",{workouts:[],exerciseBook:[{id:"plural-existing",name:"Fixture Box Press",target:0}]}).workouts[0].exercises[0].exerciseId'),'plural-existing');
 for(const name of ['Bench Press','Squat','Lat Pulldown']){ctx.ambiguousCsv=header+'\n2026-06-11 10:00:00,00:10:00,Ambiguous,'+name+',1,50,10,,,,\n';ctx.ambiguousParsed=await run('importApi.parse(ambiguousCsv)');assert.equal(run('importApi.plan(ambiguousParsed,"kg",initial()).fresh'),1,name+' must remain a custom exercise')}
 ctx.unnamedCsv=fixture+'2026-06-13 10:00:00,00:10:00,,,1,10,5,,,,\n';assert.equal((await run('importApi.parse(unnamedCsv)')).skippedRows,1);
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
 run('state.workouts.at(-1).importSource="bad"');assert(!run('validData(state)'));run('delete state.workouts.at(-1).importSource');assert(run('validData(state)'));
 // Exercise the real save/cloud wrapper with a local mocked CAS conflict and pending offline profile.
 delete ctx.cloudSession;ctx.window.PULS_CLOUD={url:'https://unit-test.supabase.co',publicKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
 ctx.AbortController=AbortController;ctx.atob=s=>Buffer.from(s,'base64').toString();let importDisk=new Map(),casCalls=0;
 Object.assign(ctx.localStorage,{getItem:k=>importDisk.get(k)||null,setItem:(k,v)=>importDisk.set(k,v),removeItem:k=>importDisk.delete(k)});
 ctx.fetch=async(url,options)=>{if(url.includes('/rpc/puls_save_profile')){casCalls++;assert.equal(JSON.parse(options.body).p_expected_revision,7)}return {ok:true,text:async()=>'null'}};
 run('save=importSaveBase;state=initial();migrate()');run(fs.readFileSync('js/cloud.js','utf8'));
 run('cloudSession={expires_at:Date.now()/1000+3600,user:{id:"synthetic-import-owner"}};cloudRevision=7;window.workoutImportForm()');
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('state.goals.kcal=2300;window.confirmWorkoutImport()');
 assert(run('cloudDirty'));assert.equal(JSON.parse(importDisk.get('puls-v1')).workouts.length,2);assert.equal(run('state.goals.kcal'),2300);
 await run('syncCloud()');assert.equal(casCalls,1);assert(run('cloudConflict'));assert.equal(run('cloudRevision'),7);assert.equal(run('state.workouts.length'),2);
 await run('syncCloud()');assert.equal(casCalls,1,'conflict must stop repeated uploads');
 await run('signOutCloud()');assert.equal(JSON.parse(importDisk.get('puls-cloud-pending-synthetic-import-owner')).workouts.length,2);
 console.log('PASS: workout CSV preview, units, mapping, append-only confirmation, dedup, backup, owner races, validation and historical analytics.');
})()
`,{require,console,process,TextEncoder,AbortController,Buffer},{filename:'workout-import-harness'}).catch(error=>{console.error(error);process.exitCode=1});
