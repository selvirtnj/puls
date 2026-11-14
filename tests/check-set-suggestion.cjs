// Importierte RPE/Notizen je Satz, über die echte App-Harness. Den früheren Ziel-Vorschlag gibt es nicht mehr.
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
const card=(curSets,finished=false)=>{setup([{kg:80,reps:8,done:true},{kg:80,reps:7,done:true}],curSets,finished);return t.run('exerciseCard(state.workouts.at(-1),state.workouts.at(-1).exercises[0],0)')};
// RPE/Notiz escaped und nur bei Sätzen mit csvFields; kein Ziel-Knopf, auch wenn ein Vortraining existiert.
let html=card([{csvFields:{RPE:'8',Notes:'<b>x</b> "q"'}},{}]);
assert(html.includes('<span>RPE</span> 8'),'RPE shown');
assert(html.includes('&lt;b&gt;x&lt;/b&gt; &quot;q&quot;'),'notes escaped');
assert(!html.includes('<b>x</b>'),'no raw notes');
assert.equal((html.match(/class="setnote"/g)||[]).length,1,'only the set with csvFields shows notes');
assert(!html.includes('setsuggest')&&!html.includes('<span>Ziel</span>'),'no target button');
html=card([{kg:80,reps:8,done:true,csvFields:{notiz:'gut'}},{}]);
assert(html.includes('<span>Notiz</span>: gut'),'Notiz key lowercase');
html=card([{csvFields:{RPE:'8'}},{}],true);
assert(html.includes('<span>RPE</span> 8'),'finished workout shows RPE');
setup(null,[{},{}]);
html=t.run('exerciseCard(state.workouts.at(-1),state.workouts.at(-1).exercises[0],0)');
assert(!html.includes('setnote'),'no new markup without data');
console.log('PASS: imported set notes, no target button');
