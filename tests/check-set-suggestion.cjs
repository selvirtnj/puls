// Satzvorschlag (doppelte Progression) und importierte RPE/Notizen je Satz, über die echte App-Harness.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/app-harness.cjs','utf8');
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const t=app({preview:true,features:[]});
const open=curSets=>curSets.map(s=>({kg:'',reps:'',done:false,...s}));
// Vorheriges Training (finished, älter) und aktuelles Workout mit Id "c" und Übung "ec".
function setup(prevSets,curSets,finished=false){
  let list=[];
  if(prevSets)list.push({id:'p',date:'2026-11-01',name:'Push',finished:true,exercises:[{id:'ep',exerciseId:'bench',name:'Bench Press',sets:open(prevSets)}]});
  list.push({id:'c',date:'2026-11-10',name:'Push',finished,exercises:[{id:'ec',exerciseId:'bench',name:'Bench Press',sets:open(curSets)}]});
  t.run('state.workouts='+JSON.stringify(list));
}
const suggest=(prevSets,index=0)=>{setup(prevSets,[{},{}]);return JSON.parse(t.run(`JSON.stringify(nextSetSuggestion(state.workouts.at(-1),state.workouts.at(-1).exercises[0],${index}))`))};
// Kein früherer Satz oder nur unerledigte Sätze: nichts erfinden.
assert.equal(suggest(null),null,'no previous workout');
assert.equal(suggest([{kg:80,reps:8,done:false}]),null,'unfinished previous set ignored');
assert.equal(suggest([{kg:80,reps:8,done:true}],1),null,'no previous set at this index');
assert.equal(suggest([{kg:80,reps:'',done:true}]),null,'missing reps');
// Doppelte Progression.
assert.deepEqual(suggest([{kg:80,reps:8,done:true}]),{kg:80,reps:9});
assert.deepEqual(suggest([{kg:80,reps:12,done:true}]),{kg:82.5,reps:8});
assert.deepEqual(suggest([{kg:10,reps:12,done:true}]),{kg:11,reps:8});
assert.deepEqual(suggest([{kg:20,reps:12,done:true}]),{kg:22.5,reps:8});
// Körpergewicht: nur Wiederholungen erhöhen.
assert.deepEqual(suggest([{kg:'',reps:12,done:true}]),{kg:'',reps:13});
assert.deepEqual(suggest([{kg:0,reps:8,done:true}]),{kg:0,reps:9});
// Rendering: Vorschlag nur bei offenen Sätzen, RPE/Notiz escaped und nur bei Sätzen mit csvFields.
const card=(curSets,finished=false)=>{setup([{kg:80,reps:8,done:true},{kg:80,reps:7,done:true}],curSets,finished);return t.run('exerciseCard(state.workouts.at(-1),state.workouts.at(-1).exercises[0],0)')};
let html=card([{csvFields:{RPE:'8',Notes:'<b>x</b> "q"'}},{}]);
assert(html.includes('<span>RPE</span> 8'),'RPE shown');
assert(html.includes('&lt;b&gt;x&lt;/b&gt; &quot;q&quot;'),'notes escaped');
assert(!html.includes('<b>x</b>'),'no raw notes');
assert.equal((html.match(/class="setnote"/g)||[]).length,1,'only the set with csvFields shows notes');
assert.equal((html.match(/class="setsuggest"/g)||[]).length,2,'both open sets with a previous value show a target');
assert(html.includes('<span>Ziel</span> 80 × 8'),'second set target from previous 80 × 7');
assert(html.includes('<span>Ziel</span> 80 × 9'),'target text');
// Erledigter Satz zeigt keinen Vorschlag; Notiz mit Kleinschreibung bleibt sichtbar.
html=card([{kg:80,reps:8,done:true,csvFields:{notiz:'gut'}},{}]);
assert.equal((html.match(/class="setsuggest"/g)||[]).length,1,'done set gets no target');
assert(html.includes('<span>Notiz</span>: gut'),'Notiz key lowercase');
// Abgeschlossenes Workout: RPE ja, Vorschlag nein.
html=card([{csvFields:{RPE:'8'}},{}],true);
assert(html.includes('<span>RPE</span> 8'),'finished workout shows RPE');
assert(!html.includes('class="setsuggest"'),'finished workout has no target');
// Ohne csvFields und ohne Vorwert: keine neuen Elemente.
setup(null,[{},{}]);
html=t.run('exerciseCard(state.workouts.at(-1),state.workouts.at(-1).exercises[0],0)');
assert(!html.includes('setnote')&&!html.includes('setsuggest'),'no new markup without data');
// Antippen trägt Werte ein, markiert nie als erledigt.
setup([{kg:80,reps:8,done:true}],[{},{}]);
t.run("applySetSuggestion('c','ec',0)");
assert.deepEqual(JSON.parse(t.run('JSON.stringify(state.workouts.at(-1).exercises[0].sets[0])')),{kg:80,reps:9,done:false},'tap copies target without marking done');
console.log('PASS: set suggestion and imported set notes');
