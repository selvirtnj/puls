// Gewichtsverlauf und "Sprache & App-Icon" nach Apple-HIG-Überarbeitung: Risikofälle ohne und mit vielen Daten, Deutsch und Englisch.
// Es ändern sich keine gespeicherten Felder; geprüft wird, dass leere, alte und künftige Daten nur Text und keine Fehlerwerte ergeben.
const assert=require('node:assert/strict');
const {loadApp}=require('./validdata-env.cjs');
const app=loadApp({now:Date.UTC(2026,10,13,12)});
assert.deepEqual(app.errors,[],'Skripte laufen im Stub');
const html=setup=>{app.run("accountSection='';qaPage='';qaParent='';cloudSession=null;page='home';"+setup);return String(app.run('accountPage()'))};
const BAD=/undefined|NaN|\[object|null kg|Infinity/;
const weeks=n=>`state.weights=[${Array.from({length:n*7},(_,i)=>`{id:'w${i}',date:new Date(Date.UTC(2026,10,13)-${i}*864e5).toISOString().slice(0,10),kg:${80}+${i%5}/10}`).join(',')}];`;
for(const lang of ['de','en']){
  const en=lang==='en',base=`state.language='${lang}';state.profile={age:30,height:180,weight:80,target:75,sex:'male',activity:1.375,method:'mifflin'};`;
  // 1. Leer: keine Einträge, Erfassen-Knopf und Hinweis bleiben, nichts Ungültiges.
  let page=html(base+"state.weights=[];accountSection='body';");
  assert(!BAD.test(page),lang+': leerer Gewichtsverlauf ohne Fehlerwerte');
  assert(page.includes('qabodylog'),lang+': Gewicht erfassen bleibt erreichbar');
  assert(page.includes(en?'No weight entries yet':'Noch keine Gewichtseinträge'),lang+': Leerzustand');
  assert(page.includes('onclick="closeAccountSection()"'),lang+': Zurück bleibt erreichbar');
  // 2. Ein Eintrag und Zukunftsdatum.
  page=html(base+"state.weights=[{id:'a',date:'2026-11-12',kg:81.5},{id:'f',date:'2027-01-01',kg:70}];accountSection='body';");
  assert(!BAD.test(page),lang+': Zukunftsdatum ohne Fehlerwerte');
  // 3. Viele Wochen: sechs Zeilen sichtbar, der Rest in "Alle Wochen".
  page=html(base+weeks(12)+"accountSection='body';");
  assert(!BAD.test(page),lang+': zwölf Wochen ohne Fehlerwerte');
  assert(page.includes('qaweeksmore')&&page.includes(en?'All weeks':'Alle Wochen'),lang+': ältere Wochen in aufklappbarer Gruppe');
  if(en)assert(!/Gewicht erfassen|Wochenmittel|Gewichtsverlauf/.test(page),'englische Seite ohne deutsche Reste');
  // 4. Sprache und App-Icon: beide Sprachen und beide Icons bleiben wählbar, Fokus-Gruppen sind erkennbar.
  html(base);page=String(app.run("accountAppearanceCard()"));
  assert(!BAD.test(page),lang+': Sprache & App-Icon ohne Fehlerwerte');
  assert(page.includes('langswitch')&&page.includes('iconchoices'),lang+': Umschalter und Icon-Auswahl vorhanden');
  assert(page.includes('icon-install.html?icon='),lang+': Icon zum Home-Bildschirm bleibt erreichbar');
  assert(page.includes(en?'Language':'Sprache'),lang+': Titel Sprache');
}
console.log('PASS: Gewichtsverlauf und Sprache & App-Icon: leer, Zukunft, viele Wochen, Deutsch und Englisch ohne Fehlerwerte');
