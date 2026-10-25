const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Synthetic VM fixture for js/running.js: base functions are minimal stand-ins for the earlier wrapper chain.
function load(state,now='2026-10-25'){
  const localISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const ctx={state,today:()=>now,localISO,
    weekStart(value){let d=new Date(value+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return localISO(d)},
    appLocale:()=>'de-DE',formatClock:s=>String(s),esc:String,n:String,uid:()=>'new',
    completedWorkouts:()=>state.workouts.filter(w=>w.finished&&w.date<=now),loggedSets:w=>w.sets||[],
    workoutAwards:()=>({w1:{xp:25,wins:['Bank']}}),dailyWorkoutStreak:()=>-1,trainingStreak:()=>-1,
    validData:s=>!!s&&Array.isArray(s.workouts),workoutPage:()=>'',trainingCalendar:()=>'',analyticsPage:()=>'',quickTraining:()=>'',
    render(){},save(){},setInterval(){},window:{},navigator:{},appStore:{getItem:()=>null,setItem(){}},
    document:{addEventListener(){},querySelectorAll:()=>[]},quickActionPaths:{},quickAddActions:[['workout']],englishUI:{},Intl,Date,Math,Number,String,Object,Array,Set};
  vm.runInNewContext(fs.readFileSync('js/running.js','utf8'),ctx);
  return ctx;
}

// Persistenz: alte Sicherungen ohne Laufdaten bleiben gültig, fehlerhafte Laufdaten werden abgelehnt.
{
  const c=load({workouts:[]});
  assert.equal(c.validData({workouts:[]}),true);
  const run={id:'a',date:'2026-10-20',distanceKm:5,durationSeconds:1500};
  assert.equal(c.validData({workouts:[],runs:[run],activeRun:null,runSettings:{weeklyGoalKm:20}}),true);
  assert.equal(c.validData({workouts:[],runs:[{...run,note:'Park',createdAt:1}],activeRun:{startedAt:1,pausedAt:null,pausedSeconds:0},runSettings:{weeklyGoalKm:null}}),true);
  for(const bad of [{...run,distanceKm:-1},{...run,type:'Run!'},{...run,kcal:12.5},{...run,feeling:6},{...run,maxSpeed:200},{...run,terrain:'<b>'},{...run,distanceKm:'5'},{...run,durationSeconds:0},{...run,durationSeconds:172801},{...run,date:'20.10.2026'},{...run,id:5},{...run,note:'x'.repeat(201)}])
    assert.equal(c.validData({workouts:[],runs:[bad]}),false);
  assert.equal(c.validData({workouts:[],runs:[{...run,id:"');alert(1);//"}]}),false,'run ids are safe for inline handlers');
  assert.equal(c.validData({workouts:[],runs:[{...run,source:'gps',route:'52.52000,13.40500;52.52100,13.40600|52.53000,13.41000;52.53100,13.41100'}],activeRun:{startedAt:1,gps:true,segment:2}}),true);
  assert.equal(c.validData({workouts:[],runs:[{...run,route:'<svg>'}]}),false);
  assert.equal(c.validData({workouts:[],runs:[{...run,source:'watch'}]}),true);
  assert.equal(c.validData({workouts:[],activeRun:{startedAt:1,gps:'yes'}}),false);
  assert.equal(c.validData({workouts:[],runs:[{...run,distanceKm:0,type:'tabletennis',kcal:280,feeling:4,terrain:'road',pauseSeconds:30,startedAt:1,elevationGain:12,elevationMax:470,maxSpeed:14.2}],activeRun:{startedAt:1,type:'walk'},runSettings:{lastType:'hike'}}),true,'activity without distance and summary fields');
  assert.equal(c.validData({workouts:[],runs:{}}),false);
  assert.equal(c.validData({workouts:[],activeRun:{startedAt:'x'}}),false);
  assert.equal(c.validData({workouts:[],runSettings:{weeklyGoalKm:0}}),false);
  assert.equal(c.validData({runs:[]}),false,'base validation still applies');
}
console.log('PASS: running data accepted optionally, invalid runs/timer/goal rejected, old backups valid.');

// XP: erster Lauf setzt die Basis; Bestleistung nur ab 1 km und wenn kein früherer Lauf weiter und schneller war.
{
  const state={workouts:[],runs:[
    {id:'r1',date:'2026-10-01',distanceKm:5,durationSeconds:1500},  // 5:00 base
    {id:'r2',date:'2026-10-03',distanceKm:6,durationSeconds:1860},  // longer, slower -> best
    {id:'r3',date:'2026-10-05',distanceKm:4,durationSeconds:1300},  // shorter and slower than r1 -> no
    {id:'r4',date:'2026-10-07',distanceKm:.5,durationSeconds:100},  // fast but < 1 km -> no
    {id:'r5',date:'2026-10-09',distanceKm:5,durationSeconds:1400},  // same distance, faster -> best
    {id:'r6',date:'2026-10-30',distanceKm:50,durationSeconds:1000}  // future -> ignored
  ]};
  const c=load(state),awards=c.workoutAwards();
  assert.deepEqual(Object.fromEntries(['r1','r2','r3','r4','r5'].map(id=>[id,awards[id].xp])),{r1:0,r2:25,r3:0,r4:0,r5:25});
  assert.equal(awards.r6,undefined);
  assert.equal(awards.w1.xp,25,'workout awards preserved');
}
console.log('PASS: run XP baseline, personal bests, 1 km minimum, future runs ignored, workout XP kept.');

// Serie: Lauftage zählen; ohne Läufe bleibt die bisherige Berechnung.
{
  const empty=load({workouts:[]});
  assert.equal(empty.dailyWorkoutStreak(),-1);assert.equal(empty.trainingStreak(),-1);
  const state={workouts:[{date:'2026-10-21',finished:true,sets:[1]}],runs:[{id:'a',date:'2026-10-24',distanceKm:3,durationSeconds:900},{id:'b',date:'2026-10-14',distanceKm:3,durationSeconds:900}]};
  const c=load(state);
  assert.equal(c.dailyWorkoutStreak(),2,'run on 24th + workout on 21st, gap to 14th breaks');
  assert.equal(c.trainingStreak(),2,'weeks of 19th and 12th');
  state.runs=[{id:'a',date:'2026-10-20',distanceKm:3,durationSeconds:900}];state.workouts=[];
  assert.equal(c.dailyWorkoutStreak(),0,'four days without training breaks the streak');
}
console.log('PASS: runs extend daily and weekly streaks with the existing rest-day rule.');

// GPS: Distanz ohne ungenaue Punkte, Zitterschritte, Sprünge und ohne Linie über Pausen; Strecke kompakt und gültig.
{
  const state={workouts:[],runs:[],activeRun:{startedAt:1000,gps:true,segment:0,pausedSeconds:0,pausedAt:null}};
  const c=load(state),lat=52.5,dLat=100/111195; // 100 m nach Norden
  const pts=[[0,lat,13.4,5,0],[30000,lat+dLat,13.4,5,0],[31000,lat+dLat+1e-6,13.4,5,0],[60000,lat+2*dLat,13.4,80,0],[60000,lat+2*dLat,13.4,5,0],
    [61000,lat+12*dLat,13.4,5,0],[120000,lat+3*dLat,13.4,5,0],[400000,lat+20*dLat,13.4,5,1],[430000,lat+21*dLat,13.4,5,1]];
  assert.ok(Math.abs(c.runTrackKm(pts)-.4)<.002,'3x100 m + 100 m after pause, outliers ignored: '+c.runTrackKm(pts));
  const route=c.runRouteString(pts);
  assert.match(route,/^[-0-9.,;|]+$/);assert.equal(route.split('|').length,2,'pause splits route');
  assert.equal(c.validData({workouts:[],runs:[{id:'g',date:'2026-10-20',distanceKm:.4,durationSeconds:200,source:'gps',route}]}),true);
  const many=Array.from({length:2000},(_,i)=>[i*3000,lat+i*dLat/10,13.4,5,0]);
  assert.ok(c.runRouteString(many).split(';').length<=300,'route simplified');
  const segs=Array.from({length:1000},(_,i)=>[i*60000,lat+i*dLat,13.4,5,i]),segRoute=c.runRouteString(segs.flatMap((p,i)=>[p,[p[0]+30000,p[1]+dLat/2,13.4,5,i]]));
  assert.ok(segRoute.length<=8000&&segRoute.split(/[;|]/).every(x=>/^-?\d+\.\d{5},-?\d+\.\d{5}$/.test(x)),'many pause segments stay within budget without cut coordinates');
  // Splits: 2,5 km gleichmäßig in 750 s -> zwei volle km à 300 s, Rest 500 m in 150 s.
  const even=Array.from({length:26},(_,i)=>[i*30000,lat+i*dLat,13.4,5,0]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.runSplits(even))),{splits:[300,300],restMeters:500,restSeconds:150});
  // Rest knapp unter 1 km bleibt gültig (höchstens 999 m).
  const almost=Array.from({length:21},(_,i)=>[i*30000,lat+i*dLat*0.99998,13.4,5,0]);const al=c.runSplits(almost);
  assert.ok(al.restMeters<=999,'rest '+al.restMeters);
  // Veralteter Fix von vor dem Laufbeginn zählt nicht.
  c.addRunPoint(-60000,lat-10*dLat,13.4,5,0);assert.equal(c.runTrackFor().points.length,0);
  assert.match(c.runRouteSvg(route),/^<svg class="runroute"[^]*<polyline points="[0-9., ]+"\/>/);
  // Native Punkte werden nur lückenlos übernommen (from == bisherige Anzahl) und nur für den laufenden Lauf.
  c.pulsRunGpsReceive=c.window.pulsRunGpsReceive;
  c.window.pulsRunGpsReceive({runKey:'1000',from:0,points:[[0,lat,13.4,5,0],[30000,lat+dLat,13.4,5,0]],status:'on'});
  c.window.pulsRunGpsReceive({runKey:'1000',from:0,points:[[0,lat,13.4,5,0]],status:'on'});
  c.window.pulsRunGpsReceive({runKey:'999',from:2,points:[[60000,lat+5*dLat,13.4,5,0]],status:'on'});
  assert.ok(Math.abs(c.runGpsKm()-.1)<.002,'only the matching, contiguous batch counts');
}
console.log('PASS: GPS distance filters, pause segments, compact valid route and native batch handling.');

// iOS-Brücke: nur das startende Gerät startet GPS und meldet die Live-Aktivität; Ende räumt Rohpunkte auf.
{
  const msgs=[],run={startedAt:5000,gps:true,segment:0,pausedSeconds:0,pausedAt:null};
  const c=load({workouts:[],runs:[],activeRun:run});
  c.window.webkit={messageHandlers:{pulsNative:{postMessage:m=>msgs.push(m)}}};c.window.pulsNativeFeatures=['runGps','runActivity'];
  c.syncRunGps();c.syncRunActivity(true);
  assert.equal(msgs.filter(m=>m.type==='runGpsStart').length,0,'synced foreign run starts no GPS');
  assert.deepEqual(msgs.map(m=>m.type+':'+m.active),['runActivity:false']);
  msgs.length=0;c.claimRunGps(run);c.syncRunGps();c.syncRunActivity(true);
  assert.deepEqual(msgs.map(m=>m.type),['runGpsStart','runGpsSync','runActivity']);
  assert.equal(msgs[0].since,5000);assert.equal(msgs[2].active,true);assert.equal(msgs[2].gps,true);
  msgs.length=0;c.state.activeRun=null;c.runNativeStop(true);c.syncRunActivity(true,true);
  assert.deepEqual(JSON.parse(JSON.stringify(msgs)),[{type:'runGpsStop',clear:true},{type:'runActivity',active:false,finished:true}]);
}
console.log('PASS: native bridge only on the starting device, live activity start/end and raw-point cleanup.');
