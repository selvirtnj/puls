const fs34=require('node:fs'),vm34=require('node:vm');
let harness34=fs34.readFileSync('tests/check-premium.cjs','utf8');
let tests34=String.raw`
run('render=function(){}');run(fs.readFileSync('js/progress-metrics.js','utf8'));
run("state=initial();migrate();state.profile={age:30,height:180,weight:80,target:75,sex:'male',activity:1.375,method:'mifflin',special:false};state.weights=[];state.foods=[];state.workouts=[];state.measurements=[];");
assert.equal(run('Object.keys(appDesigns).length'),6);for(const legacy of ['terra','volt','blueprint','nocturne'])assert(run('Object.hasOwn(appDesigns,'+JSON.stringify(legacy)+')'),'legacy design key stays valid');
run("state.workouts=[{id:'one',date:today(),finished:true,durationSeconds:600,exercises:[{id:'a',name:'Bench',exerciseId:'bench',sets:[{kg:50,reps:8,done:true}]}]},{id:'two',date:today(),finished:true,exercises:[{id:'b',name:'High rep',exerciseId:'high',sets:[{kg:20,reps:20,done:true}]}]}];var result=buildProgressMetrics();var value=k=>result.definitions.find(x=>x.key===k).points.at(-1)?.value");
assert.equal(run("value('workouts')"),2);assert.equal(run("value('sets')"),2);assert.equal(run("value('volume')"),800);assert.equal(run("value('reps')"),28);assert.equal(run("value('duration')"),10);assert.equal(run("value('averageDuration')"),10);assert.equal(run("value('density')"),40);
assert.equal(run("result.exerciseDays.get('high').days.get(today()).best"),null);assert.equal(run("result.exerciseDays.get('high').days.get(today()).volume"),400);
assert.equal(run("filteredMetricPoints({points:[{date:today(),value:null}]},'all').length"),0);
run("state.foods=[{id:'f1',date:today(),kcal:100,p:10,c:10,f:2,nutrients:{vitc:0}},{id:'f2',date:daysAgo(1),kcal:200,p:10,c:10,f:2}];state.weights=[{date:today(),kg:81}];result=buildProgressMetrics()");
assert.equal(run("value('food:kcal')"),100);assert.equal(run("result.definitions.find(x=>x.key==='nutrient:vitc').points.length"),1);assert.equal(run("value('nutrient:vitc')"),0);assert(Math.abs(run("value('bmi')")-25)<1e-9);
assert.equal(run("filteredMetricPoints({points:[{date:daysAgo(6),value:1},{date:daysAgo(7),value:2}]},'week').length"),1);
assert(!run("metricPlot([{date:today(),value:0}],'Test','').includes('NaN')"));assert(!run('progressExplorer().includes("Einzelne Übungen")')&&!run('progressExplorer().includes("Messwerte dieser Gruppe")'));
run('state=initial();migrate()');for(let design of ['terra','volt','blueprint','nocturne']){run('state.appDesign='+JSON.stringify(design));assert(liveHome().includes("dshome"));assert(liveNutrition().includes("fdOpenAdd()"));assert(run('validData(state)'));}
console.log('PASS: all progress aggregations, unknown duration and nutrients, high-rep exclusions, BMI, date windows, legacy design keys and chart rendering');
`;
vm34.runInNewContext(harness34+'\n'+tests34,{require,console,__dirname:process.cwd(),process,Buffer},{filename:'refinement34-test'});
// v90: Versionsanzeige nur noch zentral in account-refresh.js; keine tote Kette, keine feste Vorschau-Version, designs-extra.js entfernt.
{
 const version=JSON.parse(fs34.readFileSync('package.json','utf8')).version.split('.')[0];
 {const src=fs34.readFileSync('js/account-refresh.js','utf8');if(!src.includes('const APP_VERSION='+version+';')||!src.includes(".replace(/Version \\d+/g,'Version '+APP_VERSION)"))throw new Error('account-refresh must set the version robustly')}
 for(const file of fs34.readdirSync('js').filter(x=>x.endsWith('.js'))){const src=fs34.readFileSync('js/'+file,'utf8');if(/\.replace\('Version \d+','Version \d+'\)/.test(src))throw new Error(file+' keeps a dead version replace chain')}
 if(/\?v=\d/.test(fs34.readFileSync('js/preview-mode.js','utf8')))throw new Error('preview links must not pin a version');
 if(fs34.existsSync('js/designs-extra.js')||/designs-extra/.test(fs34.readFileSync('index.html','utf8')+fs34.readFileSync('sw.js','utf8')))throw new Error('designs-extra.js must stay removed');
 console.log('PASS: v90 central version stamp, unpinned preview links and removed designs-extra.js');
}
