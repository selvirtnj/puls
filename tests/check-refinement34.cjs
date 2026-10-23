const fs34=require('node:fs'),vm34=require('node:vm');
let harness34=fs34.readFileSync('tests/check-premium.cjs','utf8');
let tests34=String.raw`
run('render=function(){}');run(fs.readFileSync('progress-metrics.js','utf8'));run(fs.readFileSync('designs-extra.js','utf8'));
run("state=initial();migrate();state.profile={age:30,height:180,weight:80,target:75,sex:'male',activity:1.375,method:'mifflin',special:false};state.weights=[];state.foods=[];state.workouts=[];state.measurements=[];");
assert.equal(run('Object.keys(appDesigns).length'),10);
run("state.workouts=[{id:'one',date:today(),finished:true,durationSeconds:600,exercises:[{id:'a',name:'Bench',exerciseId:'bench',sets:[{kg:50,reps:8,done:true}]}]},{id:'two',date:today(),finished:true,exercises:[{id:'b',name:'High rep',exerciseId:'high',sets:[{kg:20,reps:20,done:true}]}]}];var result=buildProgressMetrics();var value=k=>result.definitions.find(x=>x.key===k).points.at(-1)?.value");
assert.equal(run("value('workouts')"),2);assert.equal(run("value('sets')"),2);assert.equal(run("value('volume')"),800);assert.equal(run("value('reps')"),28);assert.equal(run("value('duration')"),10);assert.equal(run("value('averageDuration')"),10);assert.equal(run("value('density')"),40);
assert.equal(run("result.exerciseDays.get('high').days.get(today()).best"),null);assert.equal(run("result.exerciseDays.get('high').days.get(today()).volume"),400);
assert.equal(run("filteredMetricPoints({points:[{date:today(),value:null}]},'all').length"),0);
run("state.foods=[{id:'f1',date:today(),kcal:100,p:10,c:10,f:2,nutrients:{vitc:0}},{id:'f2',date:daysAgo(1),kcal:200,p:10,c:10,f:2}];state.weights=[{date:today(),kg:81}];result=buildProgressMetrics()");
assert.equal(run("value('food:kcal')"),100);assert.equal(run("result.definitions.find(x=>x.key==='nutrient:vitc').points.length"),1);assert.equal(run("value('nutrient:vitc')"),0);assert(Math.abs(run("value('bmi')")-25)<1e-9);
assert.equal(run("filteredMetricPoints({points:[{date:daysAgo(6),value:1},{date:daysAgo(7),value:2}]},'week').length"),1);
assert(!run("metricPlot([{date:today(),value:0}],'Test','').includes('NaN')"));assert(run('progressExplorer().includes("Einzelne Übungen")'));
run('state=initial();migrate()');for(let design of ['terra','volt','blueprint','nocturne']){run('state.appDesign='+JSON.stringify(design));assert(run('home().includes("nutrition-track")'));assert(run('nutrition().includes("compactfoodtools")'));assert(run('validData(state)'));}
console.log('PASS: all progress aggregations, unknown duration and nutrients, high-rep exclusions, BMI, date windows, 10 designs and chart rendering');
`;
vm34.runInNewContext(harness34+'\n'+tests34,{require,console,__dirname:process.cwd(),process,Buffer},{filename:'refinement34-test'});
