// Apple Health lesen: Import ohne Doppel, Kraft-Workout nur ergänzt, Gewicht nur bei leerem Tag, Tageswerte nur lokal, Erholungswert, validData alt/neu.
// Mock-Brücke an der echten App; Swift wird hier nur durch Quellprüfungen abgedeckt (kein Nachweis für HealthKit oder Kompilierung).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tests/app-harness.cjs','utf8');
const app=vm.runInNewContext('(function(require){'+harness+';return app})(require)',{require,console});
const extras=fs.readFileSync('js/native-extras.js','utf8'),reader=fs.readFileSync('js/health-read.js','utf8');
const KEY='puls-health-days',SEEN='puls-health-seen';
const ID=n=>`0000000${n}-aaaa-4bbb-8ccc-dddddddddddd`;
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};

function boot({features=['healthWrite','healthRead'],native=true,data={},context={healthEnabled:false,healthReadEnabled:true},enabled=true}={}){
  const t=app({features});t.messages=[];t.data=data;
  if(native)t.ctx.window.webkit={messageHandlers:{pulsNative:{postMessage(m){
    t.messages.push(m);let reply=null;
    if(m.type==='extrasContext')reply=context;else if(m.type==='healthRead')reply=t.data.read?t.data.read(m):{ok:false,status:'unavailable'};
    else if(m.type==='healthReadEnable')reply={healthReadEnabled:m.enabled&&t.data.grant!==false};else if(m.type==='healthSync')reply={status:'saved'};
    if(reply)queueMicrotask(()=>t.ctx.window.pulsNativeExtrasReceive({requestId:m.requestId,...reply}))}}}};
  const before=t.timers.size;
  t.run(extras);t.run(reader);t.timersBefore=before;
  if(enabled)t.run('state.nativeExtras={...state.nativeExtras,healthReadEnabled:true}');
  return t;
}
const now=t=>t.run('Date.now()');
function sample(t){
  const n=now(t);
  return {
    days:[{date:t.run('today()'),steps:8421,activeKcal:512,restingHr:54,hrv:62,sleepMinutes:432,sleepDeep:70,sleepRem:90,sleepCore:250}],
    workouts:[
      {id:ID(1),kind:'run',startedAt:new Date(n-7200e3).toISOString(),durationSeconds:1800,distanceKm:5.02,kcal:410,avgHr:151,maxHr:178,route:[[47.1,8.1],[47.101,8.102],[47.102,8.104]]},
      {id:ID(2),kind:'strength',startedAt:new Date(n-3600e3).toISOString(),durationSeconds:3000,kcal:300,avgHr:112,maxHr:150},
      {id:ID(3),kind:'ride',startedAt:new Date(n-90000e3).toISOString(),durationSeconds:3600,distanceKm:20,kcal:500}
    ],
    weights:[{date:t.run('today()'),kg:81.2},{date:t.run("localISO(new Date(Date.now()-86400000*3))"),kg:80.4}]
  };
}

(async()=>{
  // 1. Ohne Hülle: nichts sichtbar, nichts verändert, keine Zeitgeber.
  {
    const t=boot({features:[],native:false}),before=JSON.stringify(t.state());
    assert.equal(t.timers.size,t.timersBefore,'kein Zeitgeber ohne Hülle');
    assert.equal(t.run('healthReadCard()'),'');assert.equal(t.run("typeof window.pulsNativeHealthReadRow"),'function');assert.equal(t.run('window.pulsNativeHealthReadRow()'),'');
    assert.equal(await t.run('pulsHealthRead.readHealth(true)'),undefined);assert.equal(JSON.stringify(t.state()),before);assert.equal(t.store.get(KEY)??null,null);
    assert.equal(t.run('homeDesign().includes("Gesundheit")'),false);
  }
  console.log('PASS health-read: ohne Hülle inert');

  // 2. Import ohne Doppel, Kraft-Workout ergänzt, Gewicht nur bei leerem Tag, Tageswerte nur lokal.
  {
    const t=boot({context:{healthEnabled:true,healthReadEnabled:true}}),n=now(t),payload=sample(t);t.data.read=()=>({ok:true,status:'ok',...payload});
    t.run(`state.weights.push({id:'mine',date:'${payload.weights[0].date}',kg:82});
      state.workouts.push({id:'gym1',date:today(),name:'Push',finished:true,startedAt:${n-3500e3},finishedAt:${n-700e3},durationSeconds:2800,exercises:[{id:'e1',exerciseId:'bench',name:'Bank',sets:[{kg:60,reps:8,done:true}]}]});
      state.runs=[...(state.runs||[]),{id:'mine-run',date:today(),startedAt:${n-90000e3+120e3},distanceKm:19,durationSeconds:3500,type:'ride'}]`);
    const weightsBefore=t.state().weights.length,runsBefore=t.state().runs.length;
    t.tick(2000);await flush();
    assert.deepEqual(t.messages.filter(m=>m.type==='healthRead').map(m=>[m.days,m.owner]),[[35,'account:'+t.run('cloudSession.user.id')]],'ein Lesen über 35 Tage');
    let s=t.state();
    const imported=s.runs.filter(r=>r.source==='health');assert.equal(imported.length,1,'Lauf einmal; Rad liegt ±5 min neben eigenem Eintrag; Kraft ist kein Lauf');
    const r=imported[0];assert.equal(r.healthId,ID(1));assert.equal(r.type,'run');assert.equal(r.distanceKm,5.02);assert.equal(r.durationSeconds,1800);assert.equal(r.kcal,410);assert.equal(r.avgHr,151);assert.equal(r.maxHr,178);
    assert.equal(r.route,'47.10000,8.10000;47.10100,8.10200;47.10200,8.10400');assert.equal(r.date,t.run(`localISO(new Date(${r.startedAt}))`));assert(!('pauseSeconds' in r),'ohne Pause, damit der Health-Export ihn nicht zurückschreibt');
    assert.equal(s.runs.length,runsBefore+1);
    const gym=s.workouts.find(w=>w.id==='gym1');assert.deepEqual([gym.avgHr,gym.maxHr,gym.kcal],[112,150,300],'überlappendes Kraft-Workout bekommt Puls und Energie');assert.equal(s.workouts.length,t.state().workouts.length);
    assert(!s.workouts.some(w=>w.source==='health'),'kein neuer Kraft-Eintrag');
    assert.equal(s.weights.length,weightsBefore+1);assert.equal(s.weights.find(w=>w.id==='mine').kg,82,'vorhandene Messung unverändert');
    const w=s.weights.find(x=>x.source==='health');assert.equal(w.kg,80.4);assert.equal(w.date,payload.weights[1].date);
    assert(t.run('validData(JSON.parse(JSON.stringify(state)))'),'Zustand bleibt gültig');
    // Tageswerte: nur localStorage, nicht im Zustand.
    const text=JSON.stringify(s);for(const key of ['steps','sleepMinutes','restingHr','activeKcal','"hrv"'])assert(!text.includes(key),key+' darf nicht im Zustand stehen');
    const stored=JSON.parse(t.store.get(KEY));assert.equal(stored.days[0].steps,8421);assert.equal(stored.owner,'account:'+t.run('cloudSession.user.id'));
    assert(!t.store.get('puls-v1').includes('sleepMinutes'),'nicht im gespeicherten Profil');
    assert(t.run('healthReadCard()').includes('8421')||t.run('healthReadCard()').includes('8.421')||t.run('healthReadCard()').includes('8,421'),'Karte zeigt Schritte (dsRow vorhanden)');
    // Zweites Lesen: keine Doppel, auch nicht nach Löschen des Imports (healthId bleibt gemerkt).
    t.run('pulsHealthRead').readHealth&&await t.run('pulsHealthRead.readHealth(true)');await flush();
    assert.equal(t.state().runs.filter(x=>x.source==='health').length,1,'kein Doppelimport');assert.equal(t.state().weights.length,weightsBefore+1);
    t.run(`state.runs=state.runs.filter(x=>x.source!=='health')`);await t.run('pulsHealthRead.readHealth(true)');await flush();
    assert.equal(t.state().runs.filter(x=>x.source==='health').length,0,'gelöschter Import kommt nicht zurück');
    // Health-Export schreibt Importe nicht zurück.
    t.run(`state.runs.push({id:'imp',date:today(),source:'health',healthId:'${ID(9)}',startedAt:${n-5000e3},durationSeconds:600,pauseSeconds:0,distanceKm:1,type:'run'});state.weights.push({id:'iw',date:'2020-01-01',kg:70,source:'health'})`);
    t.run('state.nativeExtras={...state.nativeExtras,healthEnabled:true}');t.run('save()');t.tick(400);await flush();t.tick(400);await flush();
    const sync=t.messages.filter(m=>m.type==='healthSync').flatMap(m=>m.samples.map(x=>x.key));assert(sync.length>0,'Export lief');assert(!sync.includes('run:imp')&&!sync.includes('weight:2020-01-01'),'importierte Einträge werden nicht zurückgeschrieben');
    // Kontowechsel löscht die lokalen Tageswerte.
    t.run("cloudSession={user:{id:'other-user'}}");assert.equal(t.run('healthReadCard()'),'');assert.equal(t.store.get(KEY)??null,null,'Besitzerwechsel löscht Tageswerte');
  }
  console.log('PASS health-read: Import ohne Doppel, Kraft-Overlap, Gewicht nur bei leerem Tag, Tageswerte nur lokal, kein Rückschreiben, Kontowechsel');

  // 3. Ausschalten löscht, fehlender Lesezugriff, abgelehnte Anfrage.
  {
    const t=boot(),payload=sample(t);t.data.read=()=>({ok:true,status:'ok',...payload});
    await t.run('pulsHealthRead.readHealth(true)');assert(t.store.get(KEY));
    await t.run('window.pulsNativeHealthReadToggle(false)');await flush();
    assert.equal(t.store.get(KEY)??null,null);assert.equal(t.state().nativeExtras.healthReadEnabled,false);assert(t.messages.some(m=>m.type==='healthReadEnable'&&m.enabled===false));
    t.data.grant=false;await t.run('window.pulsNativeHealthReadToggle(true)');await flush();assert.equal(t.state().nativeExtras.healthReadEnabled,false,'ohne Freigabe bleibt der Schalter aus');
    t.data.grant=true;t.messages.length=0;await t.run('window.pulsNativeHealthReadToggle(true)');await flush();assert.equal(t.state().nativeExtras.healthReadEnabled,true);assert(t.messages.some(m=>m.type==='healthRead'),'Einschalten liest sofort');assert(t.store.get(KEY));
    // Fehler der Hülle ersetzen vorhandene Tageswerte nicht.
    t.data.read=()=>({ok:false,status:'unavailable'});const kept=t.store.get(KEY);await t.run('pulsHealthRead.readHealth(true)');assert.equal(t.store.get(KEY),kept);
    // Nicht freigegebenes Gerät (Profil sagt an, Gerät aus): nichts lesen, nichts speichern.
    const other=boot({context:{healthReadEnabled:false}});other.data.read=()=>({ok:true,...payload});await other.run('pulsHealthRead.readHealth(true)');
    assert(!other.messages.some(m=>m.type==='healthRead'));assert.equal(other.store.get(KEY)??null,null);
    // Profil ohne Schalter liest nie.
    const off=boot({enabled:false});off.data.read=()=>({ok:true,...payload});off.tick(2000);await flush();assert(!off.messages.some(m=>m.type==='healthRead'));
  }
  console.log('PASS health-read: Ausschalten löscht, Freigabe, Fehlerpfade, Gerätefreigabe');

  // 4. Mindestabstand 10 Minuten.
  {
    const t=boot();t.data.read=()=>({ok:true,status:'ok',days:[],workouts:[],weights:[]});
    const count=()=>t.messages.filter(m=>m.type==='healthRead').length;
    t.tick(2000);await flush();assert.equal(count(),1);
    t.event('document','visibilitychange');await flush();assert.equal(count(),1,'unter 10 Minuten kein zweites Lesen');
    t.clock.now+=601e3;t.event('document','visibilitychange');await flush();assert.equal(count(),2);
  }
  console.log('PASS health-read: Start und Sichtbarwerden, höchstens alle 10 Minuten');

  // 5. Erholungswert.
  {
    const t=boot({features:[]}),score=(days,day)=>t.run(`pulsHealthRead.recoveryScore(${JSON.stringify(days)},${JSON.stringify(day)})`);
    const key=i=>t.run(`localISO(new Date(new Date('2026-11-13T12:00:00').getTime()-${i}*86400000))`);
    const base=(n,extra=()=>({}))=>Array.from({length:n},(_,k)=>({date:key(k+1),hrv:50+(k%2?5:-5),restingHr:55+(k%2?1:-1),sleepMinutes:420+(k%2?30:-30),...extra(k)}));
    const today='2026-11-13';
    assert.equal(score([{date:today,hrv:80,restingHr:50,sleepMinutes:480},...base(6)],today),null,'unter 7 Basistagen kein Wert');
    assert.notEqual(score([{date:today,hrv:50,restingHr:55,sleepMinutes:420},...base(7)],today),null,'ab 7 Tagen');
    assert.equal(score([{date:today,hrv:50,restingHr:55,sleepMinutes:420},...base(28)],today),60,'Mittelwert ergibt 60');
    assert.equal(score([{date:today,hrv:200,restingHr:30,sleepMinutes:600},...base(28)],today),100,'Obergrenze 100');
    assert.equal(score([{date:today,hrv:5,restingHr:90,sleepMinutes:60},...base(28)],today),0,'Untergrenze 0');
    assert.equal(score([{date:today,sleepMinutes:600},...base(28)],today),null,'ohne HRV und Ruhepuls kein Wert');
    assert.equal(score([{date:today,hrv:50},...base(28)],today),60,'nur HRV zählt allein');
    const high=score([{date:today,hrv:200,sleepMinutes:60},...base(28)],today);assert.equal(high,Math.round((.5*100+.2*0)/.7),'fehlender Ruhepuls: HRV und Schlaf neu gewichtet');
    assert.equal(score([{date:today,hrv:50,restingHr:55,sleepMinutes:420},...base(28,k=>({sleepMinutes:undefined}))],today),60,'Schlaf ohne Basis fällt weg');
    assert.equal(score([...base(28)],today),null,'ohne heutigen Eintrag kein Wert');
    assert.equal(score([{date:today,hrv:60,restingHr:55,sleepMinutes:420},...base(28).map(d=>({...d,hrv:50,restingHr:55,sleepMinutes:420}))],today),Math.round((.5*100+.3*60+.2*60)/1),'gleichförmige Basis: Streuungsuntergrenze greift');
    assert.equal(score([{date:today,hrv:50},{date:key(40),hrv:1},...base(5)],today),null,'Tage außerhalb der 28 Vortage zählen nicht');
    assert.equal(score('x',today),null);
  }
  console.log('PASS health-read: Erholungswert (Basis, fehlende Teile, Grenzen 0/100)');

  // 6. validData alt und neu.
  {
    const t=boot({features:[]}),valid=js=>t.run(`validData({...JSON.parse(JSON.stringify(state)),...${js}})`);
    assert(t.run('validData(JSON.parse(JSON.stringify(state)))'),'alte Sicherung ohne neue Felder lädt');
    const run=extra=>`{runs:[{id:'a1',date:'2026-11-01',distanceKm:5,durationSeconds:1800,type:'run',...${JSON.stringify(extra)}}]}`;
    assert(valid(run({source:'health',healthId:ID(1),avgHr:150,maxHr:180,kcal:300})));assert(valid(run({source:'gps'})));
    for(const bad of [{source:'foo'},{source:'health',healthId:7},{healthId:'bad id!'},{avgHr:19},{avgHr:181,maxHr:150},{kcal:300.5}])assert(!valid(run(bad)),JSON.stringify(bad));
    t.run(`state.workouts=[{id:'w1',date:'2026-11-01',name:'Push',finished:true,exercises:[{id:'e',name:'Bank',sets:[]}]}]`);
    const workout=extra=>`{workouts:[{...state.workouts[0],...${JSON.stringify(extra)}}]}`;
    assert(valid(workout({avgHr:120,maxHr:160,kcal:250})));assert(valid(workout({})));
    for(const bad of [{avgHr:300},{avgHr:150,maxHr:140},{kcal:1.5},{kcal:-1},{maxHr:'x'}])assert(!valid(workout(bad)),JSON.stringify(bad));
    assert(valid("{nativeExtras:{healthReadEnabled:true,healthEnabled:false}}"));assert(valid("{nativeExtras:{healthEnabled:true}}"));assert(!valid("{nativeExtras:{healthReadEnabled:'yes'}}"));
    t.run("state.runs=[{id:'h',date:'2026-10-01',distanceKm:5,durationSeconds:1800,type:'run',source:'health',healthId:'"+ID(1)+"'},{id:'n',date:'2026-10-02',distanceKm:5,durationSeconds:1800,type:'run'}]");
    assert.equal(t.run('JSON.stringify(Object.keys(workoutAwards()).filter(k=>k==="h"||k==="n"))'),'["n"]','eigener Lauf zählt, importierter bekommt keine Bestleistungs-XP');
  }
  console.log('PASS health-read: validData alt/neu, strenge Grenzen, keine XP für Importe');

  // 7. Quellprüfungen für Swift und Auslieferung (kein Nachweis für Kompilierung oder HealthKit).
  {
    const swift=fs.readFileSync('ios/PULS/HealthReader.swift','utf8'),controller=fs.readFileSync('ios/PULS/WebViewController.swift','utf8'),exporter=fs.readFileSync('ios/PULS/HealthExporter.swift','utf8'),project=fs.readFileSync('ios/project.yml','utf8');
    assert.equal(swift.split('{').length,swift.split('}').length,'Klammern ausgeglichen');assert.equal(swift.split('(').length,swift.split(')').length);
    assert.match(exporter,/read: \[\]/,'Schreiben bleibt schreibend');assert(!exporter.includes('HKSampleQuery'));
    for(const id of ['stepCount','activeEnergyBurned','restingHeartRate','heartRateVariabilitySDNN','vo2Max','bodyMass','heartRate','sleepAnalysis','workoutType()','workoutRoute()'])assert(swift.includes(id),id);
    assert.match(swift,/requestAuthorization\(toShare: \[\], read: readTypes\)/);assert(!/toShare: (?!\[\])/.test(swift.replace(/requestAuthorization\(toShare: \[\]/g,'')),'nur lesen');
    assert.match(swift,/bundleIdentifier != own/);assert.match(swift,/asleepUnspecified/);assert(!/HKCategoryValueSleepAnalysis\.(asleep|inBed|awake)\b/.test(swift),'nur asleep-Kategorien, keine veralteten Werte');
    assert.match(swift,/guard available, owner == currentOwner, enabled\(owner\), !busy/);assert.match(swift,/DispatchQueue\.main/);assert.match(swift,/group\.notify\(queue: \.main\)/);assert.match(swift,/self\.currentOwner == owner, self\.enabled\(owner\)/);
    assert.match(swift,/requested <= 35/);assert.match(swift,/299/,'höchstens 300 Routenpunkte');assert(!/print\(|NSLog|os_log/.test(swift),'keine Protokollierung von Gesundheitswerten');
    assert.match(swift,/isFinite/);assert(!/\b(value|kg|meters|kcal) ?\?\? ?0\b/.test(swift),'nie 0 erfinden');
    assert.match(controller,/case "healthReadEnable":/);assert.match(controller,/case "healthRead":/);assert.match(controller,/push\('healthWrite','healthRead'\)/);assert.match(controller,/healthReader\.setContext\(owner\)/);assert.match(controller,/min\(35, max\(1/);
    assert.match(controller,/case "healthRead":\s*guard[^\n]*\n\s*owner == extrasOwner/,'gleiche owner-Prüfung wie healthSync');
    assert(!/NSHealthShareUsageDescription: PULS liest keine/.test(project));assert.match(project,/NSHealthShareUsageDescription: PULS liest auf deinen Wunsch/);
    const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('js/health-read.js')>html.indexOf('js/native-extras.js'));assert(fs.readFileSync('sw.js','utf8').includes('"js/health-read.js"'));
    assert(!/healthRead|health-read/.test(fs.readFileSync('js/cloud.js','utf8')),'Tageswerte gehen nicht in den Sync');
  }
  console.log('PASS health-read: Swift- und Auslieferungsverträge (nur Quellprüfung)');
})().catch(error=>{console.error(error);process.exitCode=1});
