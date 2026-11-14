// Synthetic DOM and real routine editor/save/delete handlers. No browser layout or real profiles.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {renderSource}=require('./validdata-env.cjs');
class Element{
  constructor(tag='div',cls=''){this.tag=tag;this.className=cls;this.children=[];this.dataset={};this.attrs={};this.events={};this.textContent=''}
  get classList(){return {add:(...keys)=>{this.className=[...new Set([...this.className.split(' '),...keys])].join(' ')},contains:key=>this.className.split(' ').includes(key)}}
  setAttribute(key,value){this.attrs[key]=value}
  getAttribute(key){return this.attrs[key]??null}
  appendChild(el){el.remove();el.parent=this;this.children.push(el);return el}
  prepend(el){el.remove();el.parent=this;this.children.unshift(el)}
  remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null}
  insertAdjacentElement(position,el){assert.equal(position,'afterend');let parent=this.parent;el.remove();el.parent=parent;parent.children.splice(parent.children.indexOf(this)+1,0,el)}
  get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn)}
  fire(type){for(const fn of this.events[type]||[])fn({target:this})}
  matches(selector){
    let attr=selector.match(/\[([^=\]^]+)(\^?=)?(?:"([^"]*)")?\]/);
    if(attr){let value=this.getAttribute(attr[1]);if(value===null)return false;if(attr[2]==='='&&value!==attr[3])return false;if(attr[2]==='^='&&!value.startsWith(attr[3]))return false;selector=selector.replace(attr[0],'')}
    let tag=selector.match(/^\w+/)?.[0];if(tag&&this.tag!==tag)return false;
    return [...selector.matchAll(/\.([\w-]+)/g)].every(m=>this.classList.contains(m[1]));
  }
  querySelectorAll(selector){
    const descendants=el=>el.children.flatMap(child=>[child,...descendants(child)]);
    let result=[];
    for(let part of selector.split(',')){
      let direct=part.startsWith(':scope > ');part=part.replace(':scope > ','');
      let split=part.indexOf(' ');
      let found=split<0?(direct?this.children:descendants(this)).filter(el=>el.matches(part)):
        (direct?this.children:descendants(this)).filter(el=>el.matches(part.slice(0,split))).flatMap(el=>el.querySelectorAll(part.slice(split+1)));
      result.push(...found);
    }
    return [...new Set(result)];
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
}
const el=(tag,cls,parent)=>{let result=new Element(tag,cls);parent?.appendChild(result);return result};
function fixture(language='de',count=2,tab='current'){
  let root,body,starts=[],empty,active,done,actions=[],modalCloses=0,saves=0,scans=0;
  let state={language,routines:Array.from({length:count},(_,i)=>({id:'r'+i,name:i?'Push':'<Pull & Back>',exercises:[{exerciseId:'e1',sets:2,min:6,max:10,superset:'a'},{exerciseId:'e2',sets:1,min:6,max:10,superset:'a'}]})),workouts:[{id:'historic',routineId:'r0',finished:true}],display:{motion:'reduced'}};
  function makeDOM(){
    root=el('div','designworkouts');body=el('div','workoutbody',root);starts=[];
    active=el('section','card active',body);
    let head=el('div','sectionhead',body);el('h2','',head);let create=el('button','btn',head);create.setAttribute('onclick','routineForm()');
    state.routines.forEach(r=>{
      let card=el('section','card routinepreview',body),head=el('div','cardhead',card),title=el('div','',head);
      el('h2','',title).textContent=r.name;el('small','',title);el('button','textbtn',head);
      el('div','routinepreviewrow',card);el('details','',card);
      let row=el('div','actionrow',card),start=el('button','btn',row);start.setAttribute('onclick',`startRoutine('${r.id}')`);starts.push(start);
      el('button','textbtn',row).setAttribute('onclick',`deleteRoutine('${r.id}')`);
    });
    if(!state.routines.length)el('section','card empty',body);
    done=el('h3','',body);done.textContent='Abgeschlossen · 09.11.';el('section','card completedworkout',body);
    empty=el('button','btn secondary full',body);empty.setAttribute('onclick','startWorkout()');el('section','card runcard',body);
  }
  makeDOM();
  let c={state,page:'workout',trainTab:tab,date:'2026-11-09',today:()=> '2026-11-09',englishUI:{},
    uiIcon:key=>`<svg data-icon="${key}"></svg>`,exerciseBookItem:id=>({name:id==='e1'?'<Cable & Row>':'Pull-up'}),
    renderBase(){makeDOM()},save(){saves++},go(){},toast(){},confirm:()=>false,uid:()=> 'copy-id',routineDraft:null,renderPersonalRoutine(){},
    modal:{close(){modalCloses++}},openModal(title,html){actions=['edit','copy','delete'].map(action=>{let b=el('button');b.dataset.routineAction=action;return b});c.lastModal={title,html}},
    $:()=>({textContent:''}),document:{createElement:tag=>el(tag),querySelector:()=>root,querySelectorAll:()=>actions},
    pulsMotion:{scan(){scans++}}};c.window=c;
  vm.createContext(c);vm.runInContext(renderSource(),c);
  // Load the actual base handlers; the tested UI must delegate, without a second persistence path.
  for(const [file,prefix] of [['js/training.js','routineForm=function'],['js/enhancements.js','function saveRoutine('],['js/enhancements.js','function deleteRoutine(']]){
    vm.runInContext(fs.readFileSync(file,'utf8').split(/\r?\n/).find(line=>line.startsWith(prefix)),c);
  }
  vm.runInContext(fs.readFileSync('js/training-tabs.js','utf8'),c);
  return {c,get root(){return root},get body(){return body},get starts(){return starts},get empty(){return empty},get active(){return active},get done(){return done},get actions(){return actions},get modalCloses(){return modalCloses},get saves(){return saves},get scans(){return scans}};
}
for(const lang of ['de','en']){
  const f=fixture(lang),before=JSON.stringify(f.c.state),group=f.body.querySelector('.quickroutines');
  assert.equal(f.body.children[0],f.empty);assert.equal(f.empty.getAttribute('onclick'),'startWorkout()');
  assert.equal(group.querySelector('summary').textContent,lang==='en'?'My routines (2)':'Meine Routinen (2)');
  assert.equal(f.body.querySelector('.quicknewroutine'),null,'Neue Routine steht nur einmal, als Zeile der Routinen-Gruppe (Apple HIG, ein Ort, eine Aktion)');
  assert.equal(f.active.parent,f.body);assert.equal(f.done.parent,f.body);assert(f.body.querySelector('.runcard'));
  for(const [i,card] of group.querySelectorAll('.quickstart').entries()){
    assert.equal(card.children.at(-1),f.starts[i]);assert.equal(card.querySelector('.actionrow'),null);
    assert.equal(card.querySelector('.quickroutinepreview').textContent,'<Cable & Row>, Pull-up');
    assert.equal(f.starts[i].textContent,lang==='en'?'Start routine':'Routine starten');
    assert.equal(card.querySelector('.quickroutineoptions').getAttribute('aria-haspopup'),'dialog');
  }
  assert.equal(JSON.stringify(f.c.state),before,'render must not change profile/session data');
  f.c.refineTrainingTabs();assert.equal(group.querySelectorAll('.quickstart').length,2,'idempotent refinement');
  group.open=false;group.fire('toggle');f.c.render();assert.equal(f.body.querySelector('.quickroutines').open,false,'collapse survives render');
  f.c.trainTab='calendar';f.c.render();assert.equal(f.body.querySelector('.quickroutines'),null);
  f.c.trainTab='current';f.c.render();assert.equal(f.body.querySelector('.quickroutines').open,false,'collapse survives tab switch');
  f.c.trainingRoutineActions('r0');f.actions.find(b=>b.dataset.routineAction==='copy').fire('click');
  assert.equal(f.c.routineDraft.id,'copy-id');assert(f.c.routineDraft.name.endsWith(lang==='en'?' (copy)':' (Kopie)'));
  f.c.routineDraft.exercises[0].sets=3;assert.equal(f.c.state.routines[0].exercises[0].sets,2,'independent draft');assert.equal(f.saves,0);
  f.c.saveRoutine();assert.equal(f.saves,1);assert.equal(f.c.state.routines.length,3);assert.equal(f.c.state.routines[2].exercises[0].superset,'a');
  f.c.trainingRoutineActions('r0');f.actions.find(b=>b.dataset.routineAction==='edit').fire('click');assert.equal(f.c.routineDraft.id,'r0');
  f.c.trainingRoutineActions('r0');f.actions.find(b=>b.dataset.routineAction==='delete').fire('click');assert.equal(f.c.state.routines.length,3,'cancel deletion');
  f.c.confirm=()=>true;f.actions.find(b=>b.dataset.routineAction==='delete').fire('click');assert.equal(f.c.state.routines.length,2);assert.equal(f.c.state.workouts[0].routineId,'r0','history preserved');
  f.c.state.routines[0].name='x'.repeat(80);f.c.trainingRoutineActions('r1');f.actions.find(b=>b.dataset.routineAction==='copy').fire('click');assert.equal(f.c.routineDraft.name.length,80);
}
const zero=fixture('de',0);assert.equal(zero.body.querySelector('.quickroutines summary').textContent,'Meine Routinen (0)');assert(zero.body.querySelector('.quickroutines .empty'));
for(const tab of ['routines','calendar','insights','records']){let f=fixture('de',1,tab);assert.equal(f.root.dataset.trainTab,tab);assert.equal(f.body.querySelector('.quickroutines'),null)}
console.log('PASS: Workout cards DE/EN, original start handlers, empty state, session-only collapse, editor copies/save/cancel, confirmed delete and history preservation (synthetic DOM).');
