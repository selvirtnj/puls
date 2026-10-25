/* Bedienelemente: saubere Linien-Symbole statt Textzeichen (⌄ ⌃ × ✕ ‹ ›), knapperes Abschluss-Fenster,
   −30 s und Pausen-Einstellung im laufenden Workout, Scroll-Rad für die Standardpause. Nur Darstellung/Bedienung. */
const controlIcons={
  '⌄':['M6 9l6 6 6-6','Minimieren','Minimize'],'⌃':['M6 15l6-6 6 6','Öffnen','Open'],
  '‹':['M15 6l-6 6 6 6','Zurück','Back'],'›':['M9 6l6 6-6 6','Weiter','Next'],
  '×':['M6.5 6.5l11 11M17.5 6.5l-11 11','Schließen','Close'],'✕':['M6.5 6.5l11 11M17.5 6.5l-11 11','Schließen','Close']
};
function controlIconSvg(glyph){return `<svg class="controlicon" viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden="true"><path d="${controlIcons[glyph][0]}"/></svg>`}
function upgradeControlIcons(root){
  if(!root||root.nodeType!==1)return;
  let walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),hits=[];
  while(walker.nextNode()){let node=walker.currentNode,glyph=node.data.trim();if(controlIcons[glyph]&&node.parentElement&&node.parentElement.childNodes.length===1&&!node.parentElement.closest('input,textarea,select,option'))hits.push([node.parentElement,glyph])}
  for(let [el,glyph] of hits){
    // Beschriftung nur, wenn das Zeichen der einzige Inhalt des Knopfs ist (sonst trägt der sichtbare Text den Namen).
    let target=el.closest('button,a,[role=button]');
    if(target&&target.textContent.trim()===glyph&&!target.getAttribute('aria-label'))target.setAttribute('aria-label',controlIcons[glyph][state.language==='en'?2:1]);
    el.classList.add('hasicon');el.innerHTML=controlIconSvg(glyph);
  }
}
new MutationObserver(records=>{for(let record of records)for(let node of record.addedNodes){if(node.nodeType===1)upgradeControlIcons(node);else if(node.nodeType===3&&controlIcons[node.data.trim()])upgradeControlIcons(node.parentElement?.parentElement||node.parentElement)}}).observe(document.body,{childList:true,subtree:true});
upgradeControlIcons(document.body);

// Workout abschließen: kurze Zusammenfassung statt Erklärtexte.
const controlsFinish=finishWorkout;finishWorkout=function(...args){
  let result=controlsFinish.apply(this,args),form=$('mb')?.querySelector('form[onsubmit^="confirmWorkoutFinish"]');
  if(!form)return result;
  let en=state.language==='en',w=state.workouts.find(x=>x.id===args[0]);
  form.classList.add('finishform');form.querySelectorAll('.note').forEach(n=>n.remove());
  if(w){
    let sets=w.exercises.flatMap(e=>e.sets||[]),done=sets.filter(s=>s.done).length,open=sets.length-done,summary=form.querySelector(':scope > p');
    // Kurz, aber die Warnung bleibt: nicht abgehakte Sätze werden beim Abschließen verworfen.
    if(summary)summary.innerHTML=(en?`${done} of ${sets.length} sets done`:`${done} von ${sets.length} Sätzen erledigt`)+(open?`<br><span class="finishwarn">${en?`${open} open ${open===1?'set is':'sets are'} discarded`:`${open} offene${open===1?'r Satz wird':' Sätze werden'} verworfen`}</span>`:'');
  }
  let label=$('finish-bodyweight')?.closest('label');if(label)label.firstChild.textContent=en?'Body weight · kg (optional) ':'Körpergewicht · kg (optional) ';
  let [submit,back]=form.querySelectorAll('button');if(submit)submit.textContent=en?'Finish workout':'Workout abschließen';if(back)back.textContent=en?'Back':'Zurück';
  return result;
};

// Pause im laufenden Workout: −30 s neben +30 s.
const controlsRestCard=restCard;restCard=function(w,...args){
  let html=controlsRestCard.call(this,w,...args);
  return html.replace(`<button class="textbtn" onclick="extendRest('${w.id}',30)">`,`<button class="textbtn" onclick="shortenRest('${w.id}')">−30 s</button><button class="textbtn" onclick="extendRest('${w.id}',30)">`);
};
function shortenRest(id){let w=state.workouts.find(x=>x.id===id);if(!w?.rest)return;w.rest.endAt=Math.max(Date.now(),w.rest.endAt-30000);save();tickWorkoutClocks()}
// Standardpause direkt im laufenden Workout einstellen.
const controlsSession=renderWorkoutSession;renderWorkoutSession=function(...args){
  let result=controlsSession.apply(this,args),content=document.querySelector('#session-root .sessioncontent');
  if(content&&!content.querySelector('.sessionrestsetting')){
    let seconds=state.workoutSettings?.restSeconds??120,button=document.createElement('button');
    button.type='button';button.className='textbtn sessionrestsetting';button.setAttribute('onclick','globalRestSettings()');
    button.textContent=(state.language==='en'?'Rest timer ':'Pausenzeit ')+formatClock(seconds);
    content.querySelector(':scope > h2')?.insertAdjacentElement('afterend',button);
  }
  return result;
};

// Standardpause: Scroll-Rad wie bei einer Uhrzeit; die Zahlenfelder bleiben (versteckt) die Quelle für saveGlobalRest.
const wheelRow=40;
function buildTimeWheel(input,values,unit){
  let column=document.createElement('div');column.className='wheelcol';column.setAttribute('role','listbox');column.setAttribute('aria-label',unit);column.tabIndex=0;
  column.innerHTML=values.map(v=>`<div class="wheelitem" role="option" data-value="${v}">${String(v).padStart(2,'0')}</div>`).join('');
  let settle;
  let select=(index,scroll)=>{index=Math.max(0,Math.min(values.length-1,index));let value=values[index];[...column.children].forEach((item,i)=>{item.classList.toggle('selected',i===index);item.setAttribute('aria-selected',String(i===index))});if(+input.value!==value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}if(scroll)column.scrollTo({top:index*wheelRow,behavior:'smooth'})};
  column.addEventListener('scroll',()=>{clearTimeout(settle);settle=setTimeout(()=>select(Math.round(column.scrollTop/wheelRow),false),90)});
  column.addEventListener('click',event=>{let item=event.target.closest('.wheelitem');if(item)select([...column.children].indexOf(item),true)});
  column.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();select(values.indexOf(+input.value)+(event.key==='ArrowDown'?1:-1),true)}});
  column.selectValue=value=>select(values.indexOf(value),true);
  requestAnimationFrame(()=>{let index=Math.max(0,values.indexOf(+input.value));column.scrollTop=index*wheelRow;select(index,false)});
  return column;
}
const controlsRestSettings=globalRestSettings;globalRestSettings=function(...args){
  let result=controlsRestSettings.apply(this,args),minutes=$('rest-minutes'),seconds=$('rest-seconds'),row=minutes?.closest('.formrow');
  if(!row)return result;
  let en=state.language==='en',form=row.closest('form');form.classList.add('restsettingsform');
  form.querySelectorAll('.note').forEach(n=>n.remove());
  let intro=form.querySelector(':scope > p');if(intro)intro.textContent=en?'Rest after every completed set':'Pause nach jedem abgeschlossenen Satz';
  let secondValues=[...new Set([...Array.from({length:12},(_,i)=>i*5),+seconds.value])].sort((a,b)=>a-b);
  let wheel=document.createElement('div');wheel.className='timewheel';
  let minCol=buildTimeWheel(minutes,Array.from({length:16},(_,i)=>i),en?'Minutes':'Minuten'),secCol=buildTimeWheel(seconds,secondValues,en?'Seconds':'Sekunden');
  wheel.append(minCol,Object.assign(document.createElement('span'),{className:'wheelcolon',textContent:':'}),secCol);
  wheel.insertAdjacentHTML('beforeend',`<div class="wheellabels" aria-hidden="true"><span>${en?'min':'Min.'}</span><span>${en?'sec':'Sek.'}</span></div>`);
  row.insertAdjacentElement('beforebegin',wheel);row.hidden=true;
  // 15:00 ist das Maximum: bei 15 Minuten springen die Sekunden auf 0.
  minutes.addEventListener('input',()=>{if(+minutes.value===15&&+seconds.value>0)secCol.selectValue(0)});
  seconds.addEventListener('input',()=>{if(+minutes.value===15&&+seconds.value>0)secCol.selectValue(0)});
  let apply=$('rest-apply')?.closest('label');if(apply)apply.lastChild.textContent=en?'Also apply to routines and the running workout':'Auch für Routinen und das laufende Workout';
  let save=form.querySelector('button.btn.full');if(save)save.textContent=en?'Save':'Speichern';
  return result;
};
