const fs35=require('node:fs'),vm35=require('node:vm');let base35=fs35.readFileSync('tests/check-premium.cjs','utf8');
vm35.runInNewContext(base35+String.raw`
run('render=function(){}');let originalLength=run('exerciseCatalog.length');run(fs.readFileSync('machine-library.js','utf8'));
assert(run('machineExercisesAdded>=80'));assert.equal(run('exerciseCatalog.length'),originalLength+run('machineExercisesAdded'));
assert.equal(run('new Set(exerciseCatalog.map(x=>x.id)).size'),run('exerciseCatalog.length'));
assert.equal(run('new Set(exerciseCatalog.map(x=>normalizeSearch(x.name))).size'),run('exerciseCatalog.length'));
run("state=initial();migrate();exerciseEquipmentFilter='machine'");assert(run("exerciseOptions('').length>=130"));assert(run("exerciseOptions('Seitheben').some(x=>x.name==='Machine Lateral Raise')"));
assert(run("exerciseOptions('Beinstrecker').some(x=>x.name==='Leg Extensions')"));assert(run("exerciseOptions('Brustpresse').some(x=>x.id==='lib_Machine_Bench_Press')"));
run("exerciseEquipmentFilter='smith'");assert(run("exerciseOptions('').every(x=>x.name.includes('Smith'))"));
run("exerciseEquipmentFilter='cable'");assert(run("exerciseOptions('').every(x=>/cable/i.test(x.name+' '+x.equipment))"));
run("exerciseEquipmentFilter='all';var machineId=exerciseCatalog.find(x=>x.name==='Machine Lateral Raise').id;ensureBook(machineId)");assert(run('state.exerciseBook.some(x=>x.id===machineId&&x.equipment==="machine"&&x.muscles.includes("shoulders"))'));assert(run('validData(state)'));
run("exercisePicker('routine')");assert(el('mb').innerHTML.includes('exercise-equipment'));run("setExerciseEquipment('machine')");assert(el('library-results').innerHTML.includes('Weitere Übungen anzeigen'));let beforeResults=el('library-results').innerHTML;run('showMoreExercises()');assert(el('library-results').innerHTML.length>beforeResults.length);
console.log('PASS: '+run('machineExercisesAdded')+' additions, unique IDs/names, equipment filters, German search, previous-ID aliases, saved metadata and pagination.');
`,{require,console,process},{filename:'machines35-harness'});
