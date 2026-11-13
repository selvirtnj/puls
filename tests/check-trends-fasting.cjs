// Hält das HEUTIGE Verhalten fest (Audit 13.11.2026, Punkt 14 in docs/ISSUES.md):
// trendData (Verlaufsdaten), fdWeekStats (7-Tage-Mittel Essen), weightTrend (geglätteter Gewichtstrend)
// und der Fasten-Timer. Lädt die komplette App in echter index.html-Reihenfolge, damit die WIRKSAMEN
// Definitionen gelten. "Heute" ist fest auf 13.11.2026 (lokaler Mittag) gesetzt; die Fixtures liegen so,
// dass der Test in jeder Zeitzone gleich läuft. Synthetische Daten, keine Netz- oder Profildaten.
const path=require('node:path'),assert=require('node:assert/strict');
process.chdir(path.join(__dirname,'..'));
const {loadApp}=require('./validdata-env.cjs');

const NOW=new Date(2026,10,13,12,0,0).getTime();
const app=loadApp({now:NOW});
assert.deepEqual(app.errors,[],'App lädt im Stub nicht vollständig');
const {run,ctx}=app;
const plain=x=>JSON.parse(JSON.stringify(x));
const round6=v=>typeof v==='number'?Math.round(v*1e6)/1e6:v;
const S=()=>run('state');
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,`${label}: ${actual} != ${expected}`);

const food=(date,kcal,extra={})=>({date,name:'Test',unit:'g',grams:100,kcal,p:0,c:0,f:0,...extra});
const ex=(exerciseId,name,sets)=>({id:'e'+exerciseId+sets.length,exerciseId,name,sets});
const workout=(date,exercises)=>({id:'w'+date+exercises.map(e=>e.exerciseId).join(''),date,name:'Training',finished:true,exercises});

// Fixture (sieben Tage mit Daten, zwei Wochen, ältere Trainings, eine Vergleichszeile ohne Wert):
// Woche 02.11.–08.11.: Gewicht 81 und 79 am 03.11., 80 am 08.11. -> Wochenmittel 80
// Woche 09.11.–15.11.: Gewicht 79,5 am 09.11., 78 am 13.11. -> Wochenmittel 78,75
function fixture(){
 return {
  chartPeriod:'all',
  weights:[{id:'k1',date:'2026-11-03',kg:81},{id:'k2',date:'2026-11-03',kg:79},{id:'k3',date:'2026-11-08',kg:80},
   {id:'k4',date:'2026-11-09',kg:79.5},{id:'k5',date:'2026-11-13',kg:78}],
  foods:[food('2026-11-03',600),food('2026-11-03',400),food('2026-11-04',1200),food('2026-11-05',999),
   food('2026-11-08',450),food('2026-11-11',700),food('2026-11-11',300)],
  workouts:[
   workout('2026-11-03',[ex('bench','Bankdrücken',[{kg:100,reps:5,done:true},{kg:110,reps:12,done:true}])]),
   workout('2026-11-03',[ex('squat','Kniebeugen',[{kg:140,reps:3,done:true}])]),
   workout('2026-11-05',[ex('bench','Bankdrücken',[{kg:110,reps:5,done:true}])]),
   workout('2026-11-09',[ex('squat','Kniebeugen',[{kg:150,reps:3,done:true}])]),
   workout('2026-11-13',[ex('bench','Bankdrücken',[{kg:100,reps:5,done:true},{kg:200,reps:5,done:false}])])],
  fasts:[]
 };
}
const setState=patch=>Object.assign(S(),fixture(),patch);
const rowsOf=()=>plain(run('trendData()')).map(r=>({...r,weight:round6(r.weight),strength:round6(r.strength)}));

// ---- 1. trendData ----------------------------------------------------------------------------------------
// Erwartung für Zeitraum „Gesamt“. Zeilen nur für Tage mit Eintrag. strength: Index 100 am ersten Trainingstag,
// Basis je Übung = erstes bestes e1RM; ein Tag mit Training zählt den Durchschnitt aller bisher bekannten Übungen.
const EXPECT_ALL=[
 {date:'2026-11-03',weight:null,kcal:1000,strength:100},
 {date:'2026-11-04',weight:null,kcal:1200,strength:null},
 {date:'2026-11-05',weight:null,kcal:999,strength:105},
 {date:'2026-11-08',weight:80,kcal:450,strength:null},
 {date:'2026-11-09',weight:null,kcal:null,strength:108.571429},
 {date:'2026-11-11',weight:null,kcal:1000,strength:null},
 {date:'2026-11-13',weight:78.75,kcal:null,strength:108.571429}
];

setState({});
assert.deepEqual(rowsOf(),EXPECT_ALL);
// Leerer Stand und nur Zukunftsdaten ergeben keine Zeilen.
setState({weights:[],foods:[],workouts:[]});assert.deepEqual(plain(run('trendData()')),[]);
setState({weights:[{id:'z',date:'2026-11-14',kg:70}],foods:[food('2026-11-14',500)],workouts:[workout('2026-11-14',[ex('bench','B',[{kg:100,reps:5,done:true}])])]});
assert.deepEqual(plain(run('trendData()')),[],'Zukunftseinträge fehlen vollständig');
// Zeitraum „Woche“: ältere Tage fehlen, ältere Trainings bleiben in der Kraft-Basis (E: 108,57 statt 100).
// Grenzen liegen bewusst fern vom Tagesgrenzfall (siehe Hinweis bei der Zeitzone unten).
setState({chartPeriod:'week'});
assert.deepEqual(rowsOf(),[
 {date:'2026-11-08',weight:80,kcal:450,strength:null},
 {date:'2026-11-09',weight:null,kcal:null,strength:108.571429},
 {date:'2026-11-11',weight:null,kcal:1000,strength:null},
 {date:'2026-11-13',weight:78.75,kcal:null,strength:108.571429}
]);
// Unbekannter Zeitraum und „Monat“ fallen auf 30 Tage zurück; alle Fixture-Tage liegen darin.
setState({chartPeriod:'bogus'});assert.deepEqual(rowsOf(),EXPECT_ALL);
setState({chartPeriod:'month'});assert.deepEqual(rowsOf(),EXPECT_ALL);
// Zukunftsdaten: Zeilen fehlen, Trainings der Zukunft fließen nicht in die Basis (Index bleibt 108,57).
// BUG (Audit 13.11.2026): flows.js Zeile 60 (weeklyWeights) nimmt ALLE Gewichte der Woche, auch künftige.
// Das Gewicht vom 13.11. wird hier durch die 100-kg-Messung vom 15.11. auf 85,83 verschoben. So wird es hier
// festgehalten, bis es korrigiert ist (Fix: in weeklyWeights nur Einträge mit date <= today()).
setState({
 foods:[...fixture().foods,food('2026-11-14',2000)],
 weights:[...fixture().weights,{id:'future',date:'2026-11-15',kg:100}],
 workouts:[...fixture().workouts,workout('2026-11-15',[ex('bench','Bankdrücken',[{kg:200,reps:1,done:true}])])]
});
assert.deepEqual(rowsOf(),EXPECT_ALL.map((r,i)=>i===6?{...r,weight:85.833333}:r),'Zukunftswerte: Wochenmittel-BUG festgehalten');
// Mehrere Gewichte am selben Tag und mehrere Workouts: 03.11. zählt beide Messungen in den Wochenschnitt (80,
// nicht 80,5), und der Tag 03.11. erhält selbst kein Gewicht (nicht der letzte Messtag der Woche).
// Hinweis: Der Audit-Text nennt „erstes Gewicht per find“. Das gilt nur für die Basisfunktion in experience.js:15;
// die wirksame Version (flows.js:88) überschreibt weight. Dieser Test prüft die wirksame Version.
// Mehrere Workouts am 03.11. (Bank + Kniebeuge) ergeben den Index 100.
// Tage ohne Training: strength null (08.11., 11.11.).
console.log('PASS: trendData, Gesamtzeitraum, Woche, Zukunftsdaten, Wochenmittel und Kraftindex.');

// ---- 2. fdWeekStats ----------------------------------------------------------------------------------
// Sieben Kalendertage bis einschließlich endDay; Wasser (Trinkwasser, ml, 0 kcal) zählt nicht; nur Tage mit
// Einträgen zählen als Tag, der Mittelwert teilt durch diese Tage (nicht durch 7).
setState({foods:[
 food('2026-11-13',200,{p:20,c:10,f:5}),
 food('2026-11-10',300,{p:10,c:40,f:10}),
 food('2026-11-10',0,{name:'Trinkwasser',unit:'ml'}),
 food('2026-11-07',500,{p:30,c:50,f:20}),
 food('2026-11-06',9999,{p:999,c:999,f:999}),
 food('2026-11-12',0,{name:'Trinkwasser',unit:'ml'})
]});
const fd=plain(run("fdWeekStats('2026-11-13')"));
assert.equal(fd.days,3,'nur Tage mit Essen, Wasser zählt nicht; 06.11. liegt außerhalb der 7 Tage');
near(fd.avg.kcal,1000/3,'kcal');near(fd.avg.p,20,'p');near(fd.avg.c,100/3,'c');near(fd.avg.f,35/3,'f');
assert.deepEqual(plain(run("fdWeekStats('2000-01-01')")),{days:0,avg:{kcal:0,p:0,c:0,f:0}},'ohne Einträge: 0 Tage, Mittel 0');
console.log('PASS: fdWeekStats, 7-Tage-Fenster, Wasser ausgeschlossen, Mittel nur über Tage mit Essen.');

// ---- 3. weightTrend ----------------------------------------------------------------------------------
// Geglätteter Trend: erster Wert = erster kg-Wert; danach trend += (1-e^(-gap/7))·(kg-trend), gap in Tagen
// zwischen den Messungen, auf 1..30 begrenzt. Ungültige kg und Zukunftsdaten fallen raus; gleiche Tage werden
// zu einer Zeile (der später eingegebene Wert gewinnt).
const wt=arr=>plain(run('weightTrend')(arr));
assert.deepEqual(wt([]),[]);
const one=wt([{date:'2026-11-01',kg:80}]);assert.deepEqual(one,[{date:'2026-11-01',kg:80,trend:80}]);
const two=wt([{date:'2026-11-02',kg:81},{date:'2026-11-01',kg:80}]);
assert.deepEqual(two.map(x=>x.date),['2026-11-01','2026-11-02'],'nach Datum sortiert, Eingabe unsortiert');
near(two[1].trend,80+(1-Math.exp(-1/7))*(81-80),'Trend nach 1 Tag');
const gap=wt([{date:'2026-10-01',kg:80},{date:'2026-11-01',kg:90}]);
near(gap[1].trend,80+(1-Math.exp(-30/7))*10,'Abstand über 30 Tage wird auf 30 begrenzt');
assert.deepEqual(wt([{date:'2026-11-01',kg:80},{date:'2026-11-01',kg:82}]),[{date:'2026-11-01',kg:82,trend:82}],'gleicher Tag: letzter Eintrag gewinnt');
assert.deepEqual(wt([{date:'2026-11-01',kg:null},{date:'2026-11-02',kg:'82'},{date:'2026-11-03',kg:NaN},{date:'2026-11-04',kg:Infinity},{date:'2026-11-14',kg:70}]),[],'ungültige kg und Zukunft fehlen');
assert.equal(wt([{date:'2026-11-01',kg:0}]).length,1,'0 kg ist eine endliche Zahl und bleibt');
const input=[{date:'2026-11-02',kg:81},{date:'2026-11-01',kg:80}];const before=JSON.stringify(input);wt(input);
assert.equal(JSON.stringify(input),before,'Eingabe bleibt unverändert');
setState({weights:[{id:'a',date:'2026-11-01',kg:80},{id:'b',date:'2026-11-02',kg:81}]});
assert.deepEqual(plain(run('weightTrend()')).map(x=>x.date),['2026-11-01','2026-11-02'],'Standard: state.weights');
console.log('PASS: weightTrend, geglätteter Trend, Abstandsgrenze, Sortierung, ungültige und künftige Werte.');

// ---- 4. Fasten-Timer --------------------------------------------------------------------------------
// Es gibt keine eigene Rechenfunktion für Dauer oder Fortschritt. Geprüft werden die beobachtbaren Ergebnisse:
// currentFast, startFast, stopFast, fastingForm (Anzeige) und formatClock (training.js).
const pad=n=>String(n).padStart(2,'0');
const ldt=ms=>{const d=new Date(ms);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const H=h=>NOW-h*3600000;
const $el=id=>run(`document.getElementById(${JSON.stringify(id)})`);
ctx.toastLog=[];run('toast=m=>toastLog.push(m)');
run('openModal=(t,h)=>{globalThis.lastModalHtml=h}');
const modalHtml=()=>run('lastModalHtml');
const startFast=(value,hours=16)=>{$el('fast-start').value=value;$el('fast-hours').value=String(hours);const before=S().fasts.length;run('startFast')({preventDefault(){}});return S().fasts.length-before};

assert.equal(run('formatClock(0)'),'00:00');assert.equal(run('formatClock(59.9)'),'00:59');assert.equal(run('formatClock(3600)'),'1:00:00');
assert.equal(run('formatClock(3661.7)'),'1:01:01');assert.equal(run('formatClock(-5)'),'00:00');

setState({fasts:[]});
assert.equal(run('currentFast()'),undefined,'ohne Fasten: kein aktiver Timer');
run('stopFast()');assert.equal(S().fasts.length,0,'Beenden ohne aktives Fasten ist ohne Wirkung');
run('fastingForm()');
assert.ok(modalHtml().includes('value="2026-11-13T12:00:00"'),'Startvorschlag ist jetzt');
assert.ok(modalHtml().includes('<option value="12" selected>12 h</option>'),'Standardziel 12 Stunden');

// Gültiger Start vor zwei Stunden, Ziel 16 h.
assert.equal(startFast(ldt(H(2)),16),1);
const active=plain(run('currentFast()'));
assert.equal(active.startedAt,H(2));assert.equal(active.targetHours,16);assert.equal(typeof active.id,'string');assert.equal(active.endedAt,undefined);
run('fastingForm()');
assert.ok(modalHtml().includes('data-fast-clock>2:00:00<'),'Anzeige: 2 Stunden verstrichen');
assert.ok(modalHtml().includes('Ziel: 16 Stunden'));
// Zweiter Start, solange eines läuft, wird abgelehnt.
assert.equal(startFast(ldt(H(1)),12),0,'nur ein aktives Fasten');
// Beenden: Ende = jetzt, danach kein aktiver Timer mehr; die Liste zeigt die Dauer.
run('stopFast()');
const done=plain(S().fasts)[0];assert.equal(done.endedAt,NOW);assert.equal(run('currentFast()'),undefined);
run('fastingForm()');
assert.ok(modalHtml().includes('<strong>2:00:00</strong>'),'beendetes Fasten: 2:00:00 in der Liste');
console.log('PASS: Fasten starten, Dauer und Anzeige, nur ein aktives Fasten, Beenden und Liste.');

// Ablehnungen (jeweils ohne Eintrag und mit Hinweis): Zukunft, älter als 24 h, unzulässiges Ziel, leerer Beginn.
const rejected=(value,hours)=>{setState({fasts:[]});const n=ctx.toastLog.length;const added=startFast(value,hours);assert.equal(added,0,`abgelehnt: ${value} / ${hours}`);assert.equal(ctx.toastLog.length,n+1,'Hinweis angezeigt')};
rejected(ldt(NOW+3600000),16);
rejected(ldt(H(25)),16);
rejected(ldt(H(2)),13);
rejected(ldt(H(2)),0);
rejected('',16);
// Grenzen innerhalb der 24 h und erlaubte Ziele werden angenommen (23 h vor, 24 h Ziel).
setState({fasts:[]});assert.equal(startFast(ldt(H(23)),24),1,'23 Stunden zurück und 24 Stunden Ziel sind gültig');
// Über Mitternacht: Start 12.11. 22:30, jetzt 13.11. 12:00 -> 13:30 verstrichen.
setState({fasts:[]});assert.equal(startFast(ldt(H(13.5)),16),1);
run('fastingForm()');
assert.ok(modalHtml().includes('data-fast-clock>13:30:00<'),'über Mitternacht zählt die Dauer weiter');
console.log('PASS: Fasten-Grenzen (Zukunft, 24 h, Ziele, leerer Beginn), Mitternacht und Anzeige der Dauer.');

// ---- Hinweise ----------------------------------------------------------------------------------------
// Zeitzone: Bis Version 107 bildete trendData den Stichtag über toISOString() (UTC); ab UTC+13 fiel die Grenze
// einen Tag früher. Seit Version 108 zählen lokale Datumsteile. Die Fixture-Tage liegen weiter fern der Grenze.
// Nicht geprüft: setInterval-Aktualisierung des Fasten-Timers (im Stub nicht ausführbar), echte Benachrichtigungen.
