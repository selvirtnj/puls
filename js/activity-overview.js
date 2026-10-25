/* Fortschritt: Bereich „Aktivitäten“ (ersetzt seit Version 64 die Laufkarte). Woche/Monat mit Vor/Zurück,
   Zeit, Anzahl, kcal, Distanz, Aufteilung nach Art inkl. Gym, Kalender aktiver Tage und Verlauf mit Filter.
   Daten nur lesend über run-metrics.js (activityPeriodStats, activityEntries); Filter „Laufen“ zeigt zusätzlich
   die bisherige Laufstatistik (runProgressCard). Auswahl ist reiner Ansichtszustand, nichts wird gespeichert. */

let actMode='week',actOffset=0,actFilter='all';
function actTypeName(type){if(type==='gym')return 'Gym';let t=runActivityType(type);return state.language==='en'?t.en:t.de}
function actIcon(type){return typeof runIcon==='function'?runIcon(type==='gym'?'gym':runActivityType(type).icon):''}
function actDuration(seconds){let m=Math.round((seconds||0)/60);if(m<60)return m+' min';return Math.floor(m/60)+' h'+(m%60?' '+String(m%60).padStart(2,'0')+' min':'')}
function actRangeLabel(start,end){
  let a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00'),loc=appLocale();
  if(actMode==='month')return a.toLocaleDateString(loc,{month:'long',year:'numeric'});
  let head=actOffset===0?runText('Diese Woche','This week'):actOffset===-1?runText('Letzte Woche','Last week'):'';
  let span=a.getMonth()===b.getMonth()?a.toLocaleDateString(loc,{day:'numeric'})+'.–'+b.toLocaleDateString(loc,{day:'numeric',month:'short'}):a.toLocaleDateString(loc,{day:'numeric',month:'short'})+' – '+b.toLocaleDateString(loc,{day:'numeric',month:'short'});
  if(state.language==='en')span=a.toLocaleDateString(loc,{day:'numeric',month:'short'})+' – '+b.toLocaleDateString(loc,{day:'numeric',month:'short'});
  return head?`${head} · ${span}`:span;
}
function actSetMode(mode){if(mode===actMode)return;actMode=mode;actOffset=0;render()}
function actShift(step){actOffset=Math.min(0,actOffset+step);render()}
function actSetFilter(type){actFilter=actFilter===type&&type!=='all'?'all':type;render()}
function actOpen(kind,id){if(kind==='workout'){if(typeof workoutSummary==='function')workoutSummary(id)}else runDetail(id)}

function actCalendar(start,end,days){
  let first=new Date(start+'T12:00:00'),now=today(),loc=appLocale(),cells=[];
  let names=Array.from({length:7},(_,i)=>{let d=new Date(2024,0,1+i,12);return d.toLocaleDateString(loc,{weekday:'narrow'})});
  if(actMode==='month')for(let i=0;i<(first.getDay()+6)%7;i++)cells.push('<span class="actday blank"></span>');
  for(let d=new Date(first);localISO(d)<=end;d.setDate(d.getDate()+1)){
    let key=localISO(d),on=days.has(key);
    cells.push(`<span class="actday ${on?'on':''} ${key===now?'today':''} ${key>now?'future':''}" ${on?`aria-label="${esc(d.toLocaleDateString(loc,{weekday:'long',day:'numeric',month:'long'}))} · ${runText('aktiv','active')}"`:''}>${d.getDate()}</span>`);
  }
  return `<div class="actcal ${actMode}"><div class="actcalhead">${names.map(x=>`<small>${esc(x)}</small>`).join('')}</div><div class="actcalgrid">${cells.join('')}</div></div>`;
}
function actRow(x){
  let e=x.entry,name=x.kind==='workout'?(e.name||'Workout'):actTypeName(x.type),known=Number.isFinite(e.durationSeconds)&&e.durationSeconds>0&&!e.autoFinished;
  let kcal=x.kind==='workout'?workoutKcalEstimate(e):Number.isFinite(e.kcal)?e.kcal:runCaloriesEstimate({type:e.type,movingSeconds:e.durationSeconds,distanceKm:e.distanceKm,weightKg:runLatestWeight(state,e.date),ascentM:e.elevationGain});
  let bits=[known?formatClock(e.durationSeconds):runText('Dauer unbekannt','Duration unknown')];
  if(x.kind==='activity'&&e.distanceKm>0)bits.push(runKm(e.distanceKm)+' km');
  if(Number.isFinite(kcal))bits.push(kcal+' kcal');
  let day=new Date(e.date+'T12:00:00').toLocaleDateString(appLocale(),{weekday:'short',day:'numeric',month:'short'});
  return `<button type="button" class="searchitem runrow actrow" onclick="actOpen('${x.kind}','${esc(e.id)}')"><span class="runrowicon">${actIcon(x.type)}</span><div>${esc(name)}<small>${esc(day)} · ${bits.join(' · ')}</small></div><span aria-hidden="true">›</span></button>`;
}
function activityOverviewCard(){
  if(typeof activityPeriodStats!=='function')return runProgressCard();
  let s=activityPeriodStats(actMode,today(),actOffset),filter=actFilter;
  let allTypes=[...new Set(activityEntries('0000-01-01',today()).map(x=>x.type))];
  if(filter!=='all'&&!allTypes.includes(filter))filter=actFilter='all';
  let empty={count:0,durationSeconds:0,distanceKm:0,kcal:0,unknownKcalCount:0,unknownDurationCount:0},view=filter==='all'?s:(s.byType[filter]||empty);
  let rows=s.entries.filter(x=>filter==='all'||x.type===filter),days=new Set(rows.map(x=>x.entry.date));
  let showKm=filter==='all'?view.distanceKm>0||rows.some(x=>x.kind==='activity'&&runTypeUsesGps(x.type)):filter!=='gym'&&runTypeUsesGps(filter);
  let tiles=`<div class="metrictiles acttiles"><div><strong>${actDuration(view.durationSeconds)}</strong><small>${runText('Zeit','Time')}</small></div><div><strong>${view.count}</strong><small>${view.count===1?runText('Einheit','Session'):runText('Einheiten','Sessions')}</small></div><div><strong>${n(Math.round(view.kcal))}</strong><small>kcal*</small></div>${showKm?`<div><strong>${runKm(Math.round(view.distanceKm*10)/10)} km</strong><small>${runText('Distanz','Distance')}</small></div>`:''}</div>`;
  let types=Object.entries(s.byType).sort((a,b)=>b[1].durationSeconds-a[1].durationSeconds||b[1].count-a[1].count),max=Math.max(1,...types.map(([,x])=>x.durationSeconds));
  let bars=types.length?`<h3>${runText('Nach Art','By type')}</h3><div class="actbars">${types.map(([type,x])=>`<button type="button" class="actbar ${filter===type?'on':''}" onclick="actSetFilter('${esc(type)}')" aria-pressed="${filter===type}"><span class="acticon">${actIcon(type)}</span><span class="actbarname">${esc(actTypeName(type))}<small>${x.count}×</small></span><span class="actbartrack"><i style="width:${Math.max(x.durationSeconds?4:0,x.durationSeconds/max*100)}%"></i></span><strong>${actDuration(x.durationSeconds)}</strong></button>`).join('')}</div>`:'';
  let chips=allTypes.length>1?`<div class="actfilters" role="group" aria-label="${runText('Nach Art filtern','Filter by type')}">${['all',...allTypes.sort((a,b)=>a==='gym'?-1:b==='gym'?1:actTypeName(a).localeCompare(actTypeName(b),appLocale()))].map(t=>`<button type="button" class="${filter===t?'on':''}" aria-pressed="${filter===t}" onclick="actSetFilter('${esc(t)}')">${t==='all'?runText('Alle','All'):`${actIcon(t)}${esc(actTypeName(t))}`}</button>`).join('')}</div>`:'';
  let list=rows.length?`<div class="runlist actlist">${[...rows].reverse().slice(0,60).map(actRow).join('')}</div>`:`<p class="note">${filter==='all'?runText('Keine Aktivitäten in diesem Zeitraum.','No activities in this period.'):runText('Keine Einträge dieser Art in diesem Zeitraum.','No entries of this type in this period.')}</p>`;
  let notes=[runText('* kcal geschätzt aus Art, Dauer und letztem Gewicht.','* kcal estimated from type, duration and latest body weight.')];
  if(view.unknownKcalCount)notes.push(runText(`${view.unknownKcalCount} ohne Schätzung (z. B. kein Gewicht).`,`${view.unknownKcalCount} without estimate (e.g. no body weight).`));
  if(view.unknownDurationCount)notes.push(runText(`${view.unknownDurationCount} ohne nutzbare Dauer.`,`${view.unknownDurationCount} without usable duration.`));
  let card=`<section class="card runcard actcard"><div class="cardhead"><h2>${runText('Aktivitäten','Activities')}</h2><div class="segmented actmode" role="group" aria-label="${runText('Zeitraum','Period')}"><button type="button" aria-pressed="${actMode==='week'}" onclick="actSetMode('week')">${runText('Woche','Week')}</button><button type="button" aria-pressed="${actMode==='month'}" onclick="actSetMode('month')">${runText('Monat','Month')}</button></div></div>
    <div class="actperiod"><button type="button" class="actnav" onclick="actShift(-1)" aria-label="${actMode==='week'?runText('Vorherige Woche','Previous week'):runText('Vorheriger Monat','Previous month')}">‹</button><strong>${esc(actRangeLabel(s.start,s.end))}</strong><button type="button" class="actnav" onclick="actShift(1)" ${actOffset>=0?'disabled':''} aria-label="${actMode==='week'?runText('Nächste Woche','Next week'):runText('Nächster Monat','Next month')}">›</button></div>
    ${chips}${tiles}${actMode==='week'&&actOffset===0&&filter==='all'?activityWeekLine():''}${filter==='all'?bars:''}
    <h3>${runText('Aktive Tage','Active days')} · ${days.size}</h3>${actCalendar(s.start,s.end,days)}
    <h3>${runText('Verlauf','History')}</h3>${list}
    <p class="note">${notes.join(' ')}</p></section>`;
  return card+(filter==='run'?runProgressCard():'');
}

// Heute (Baseline-Modus): Aufteilung so zeigen, dass sie zum Tagesziel aufgeht: Grundbedarf ± Zielanpassung + Sport = Ziel.
// Nur Darstellung; Rechenwerte kommen unverändert aus energyFor()/dayGoals() (enhancements.js).
if(typeof baselineEnergyLine==='function'){const actBaselineLine=baselineEnergyLine;baselineEnergyLine=function(dateKey=today(),...rest){
  let html=actBaselineLine.call(this,dateKey,...rest);if(!html||typeof dayGoals!=='function')return html;
  try{
    let p=state.profile,weight=state.plan?.adaptive===false?p.weight:(typeof runLatestWeight==='function'?runLatestWeight(state,dateKey):null)??p.weight,e=energyFor(p,weight,state.plan,dateKey);
    if(!Number.isFinite(e.baseline)||!Number.isFinite(e.sport))return html;
    let base=Math.round(e.baseline),sport=Math.round(e.sport),auto=state.plan?.mode==='auto',goal=auto?dayGoals(dateKey)?.kcal:null,adj=Number.isFinite(goal)?goal-sport-base:0;
    if(!auto||!Number.isFinite(goal)||Math.abs(adj)>base*.5)adj=0;
    let pct=adj?Math.round(adj/base*100):0,en=state.language==='en';
    return `<p class="note baselineenergy"><span>${en?'Baseline':'Grundbedarf'} ${n(base)}</span>${pct?`<span>${pct>0?'+':'−'}${Math.abs(pct)} % ${en?'goal':'Ziel'}</span>`:''}<span>+ ${en?'exercise':'Sport'} ${n(sport)}</span>${auto&&Number.isFinite(goal)?`<b>= ${n(goal)} kcal</b>`:'<b>kcal</b>'}<small>${en?'estimated':'geschätzt'}</small></p>`;
  }catch{return html}
}}
