// v93: Routinen-Favoriten mit echter validData-Kette, Routinenliste, Startliste und Liftoff-Wiederimport.
const fsFav=require('node:fs'),vmFav=require('node:vm');
vmFav.runInNewContext(fsFav.readFileSync('tests/check-premium.cjs','utf8')+String.raw`
ctx.TextEncoder=TextEncoder;
run('render=function(){}');run(fs.readFileSync('js/machine-library.js','utf8'));
run('var accountManageBody=()=>\'\';var accountListRow=()=>\'\';');ctx.cloudSession=null;
run(fs.readFileSync('js/workout-import.js','utf8'));
// Plus-Menü-Helfer aus quick-account-v87.js als schlanke Attrappen.
run('var qaT=(de,en)=>de;var qaRow=({label,action})=>\'<button onclick="\'+action+\'">\'+label+\'</button>\';var qaGroup=(t,rows)=>rows;var qaQuickRoutines=()=>null;');
run(fs.readFileSync('js/routine-favorites.js','utf8'));
run('state=initial();migrate();var favSaves=0;save=()=>favSaves++;');
const routines=JSON.stringify([{id:'r_a',name:'A',exercises:[]},{id:'r_b',name:'B',exercises:[]},{id:'r_c',name:'C',exercises:[]},{id:'r_d',name:'D',exercises:[]}]);
run('state.routines='+routines);
// validData: alte Sicherungen ohne Feld, neue mit true/false, ungültige Werte abgelehnt.
assert(run('validData(JSON.parse(JSON.stringify(state)))'),'old backup without favorite stays valid');
run('state.routines[2].favorite=true');assert(run('validData(JSON.parse(JSON.stringify(state)))'),'favorite:true is valid');
run('state.routines[1].favorite=false');assert(run('validData(state)'),'favorite:false is valid');
for(const bad of ['"yes"','1','null','{}']){run('state.routines[1].favorite='+bad);assert(!run('validData(state)'),'invalid favorite '+bad+' rejected')}
run('delete state.routines[1].favorite');
// Stabile Sortierung: Favoriten oben, sonst bisherige Reihenfolge.
run('state.routines[3].favorite=true');
assert.equal(run('routinesByFavorite(state.routines).map(r=>r.id).join()'),'r_c,r_d,r_a,r_b');
assert.equal(run('state.routines.map(r=>r.id).join()'),'r_a,r_b,r_c,r_d','stored order unchanged');
// Routinenliste: Reihenfolge, Sternknöpfe, gespeicherte Reihenfolge bleibt.
let html=run('routinesPage()');let pos=id=>html.indexOf("startRoutine('"+id+"')");
assert(pos('r_c')<pos('r_d')&&pos('r_d')<pos('r_a')&&pos('r_a')<pos('r_b'),'favorites first in routinesPage');
assert.equal((html.match(/class="routinefav/g)||[]).length,4);
assert(html.includes('data-routine-fav="r_c" aria-pressed="true"'));assert(html.includes('data-routine-fav="r_a" aria-pressed="false"'));
assert.equal(run('state.routines.map(r=>r.id).join()'),'r_a,r_b,r_c,r_d');
// Startliste „Workout starten“.
run('state.workouts=[];startWorkout()');let mb=el('mb').innerHTML;assert(mb.indexOf("startRoutine('r_c')")<mb.indexOf("startRoutine('r_a')"),'start list sorted');
// Plus-Menü: Originalindex im Inline-Handler bleibt korrekt.
let qa=run('qaQuickRoutines()')===undefined?el('mb').innerHTML:el('mb').innerHTML;
assert(qa.indexOf('state.routines[2].id')<qa.indexOf('state.routines[0].id'),'quick add sorted with original indices');
assert(qa.indexOf('>C<')<qa.indexOf('>A<')&&/state\.routines\[2\]\.id\)">C</.test(qa));
// Umschalten: nur true wird gespeichert, false entfernt das Feld.
run('favSaves=0;window.toggleRoutineFavorite("r_a")');assert.equal(run('state.routines[0].favorite'),true);assert.equal(run('favSaves'),1);
run('window.toggleRoutineFavorite("r_a")');assert.equal(run('Object.hasOwn(state.routines[0],"favorite")'),false);assert.equal(run('favSaves'),2);
run('window.toggleRoutineFavorite("missing")');assert.equal(run('favSaves'),2);
console.log('PASS: routine favorites validate, sort stably and toggle without reordering stored routines');
// Liftoff-Wiederimport erhält favorite.
run('state=initial();migrate();save=()=>{};window.workoutImportForm();var importApi=window.pulsWorkoutImport;');
const header='Date,Duration,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE,Notes';
ctx.csvFixture=header+'\r\n2026-06-12 12:00:00,00:10:00,Custom,Fixture Unlisted Motion,1,10,5,,,,\r\n';
(async()=>{
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('window.confirmWorkoutImport()');
 assert.equal(run('state.routines.length'),1);run('state.routines[0].favorite=true;var favId=state.routines[0].id');
 ctx.csvFixture=header+'\r\n2026-06-12 12:00:00,00:10:00,Custom,Fixture Unlisted Motion,1,10,5,,,,\r\n2026-06-19 12:00:00,00:10:00,Custom,Fixture Unlisted Motion,1,12,5,,,,\r\n';
 await run('window.workoutImportFile({size:1000,text:async()=>csvFixture})');run('window.confirmWorkoutImport()');
 assert.equal(run('state.routines.length'),1,'reimport keeps one routine');assert.equal(run('state.routines[0].id'),run('favId'));
 assert.equal(run('state.routines[0].favorite'),true,'reimport keeps favorite');assert(run('validData(JSON.parse(JSON.stringify(state)))'));
 console.log('PASS: Liftoff reimport keeps routine id and favorite');
})().catch(e=>{console.error(e);process.exit(1)});
`,{require,process,console,TextEncoder});
