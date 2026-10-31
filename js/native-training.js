/* M4 Phase A: training projection and ops for native screens. The Web stays the data owner:
   every op runs the last effective Web function; native-state.js validates, persists, acknowledges and rolls back. */
(function(){
'use strict';
if(typeof window.webkit?.messageHandlers?.pulsState?.postMessage!=='function'||!Array.isArray(window.pulsNativeFeatures)||
  !window.pulsNativeFeatures.includes('stateBridge')||!window.pulsNativeFeatures.includes('nativeTraining'))return;
// Same display helpers as native-projection.js: n() rounding with at most one fraction digit, Unicode-safe 256-unit names.
const decimal=value=>Number.isFinite(value)?Number(new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1}).format(value)):null;
const text=value=>{const valueString=String(value??'');let end=Math.min(256,valueString.length);if(end<valueString.length&&/[\uD800-\uDBFF]/.test(valueString[end-1])&&/[\uDC00-\uDFFF]/.test(valueString[end]))end--;return valueString.slice(0,end)};
const isId=value=>typeof value==='string'&&value.length>0&&value.length<=256;
const int=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
// app.js:setValue accepts '' or kg 0–1000 and integer reps 1–1000; stored values stay numbers or ''.
const kgValue=value=>value===''||finite(value,0,1000),repsValue=value=>value===''||int(value,1,1000);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>JSON.parse(JSON.stringify(value));
// Key order independent: Swift dictionaries do not keep JSON key order.
function same(a,b){
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));
  if(!plain(a)||!plain(b))return false;
  const keys=Object.keys(a).filter(k=>a[k]!==undefined),other=Object.keys(b).filter(k=>b[k]!==undefined);
  return keys.length===other.length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
}
const fail=(code,message)=>({code,message});
const expectHas=(args,...keys)=>plain(args.expect)&&keys.every(key=>Object.hasOwn(args.expect,key));
const setView=s=>({kg:s.kg,reps:s.reps,done:s.done});
// Native already asked the user; the Web function stays the one that mutates.
const confirmed=fn=>{const original=globalThis.confirm;globalThis.confirm=()=>true;try{return fn()}finally{globalThis.confirm=original}};
const findWorkout=id=>state.workouts.find(w=>w.id===id);
function activeTarget(args){
  if(!isId(args.workoutId))return fail('invalid','Ungültige Workout-ID');
  const w=findWorkout(args.workoutId);
  // The Web session only ever shows activeWorkout(); finished, discarded or auto-finished sessions are gone.
  if(!w||w.finished||activeWorkout()!==w)return fail('gone','Workout ist nicht mehr aktiv');
  return {w};
}
function exerciseTarget(args){
  const target=activeTarget(args);if(target.code)return target;
  if(!isId(args.exerciseId))return fail('invalid','Ungültige Übungs-ID');
  const e=target.w.exercises.find(x=>x.id===args.exerciseId);
  return e?{...target,e}:fail('gone','Übung ist nicht mehr im Workout');
}
const storedWorkout=(profile,id)=>Array.isArray(profile?.workouts)?profile.workouts.find(w=>w?.id===id):undefined;
const storedExercise=(profile,wid,eid)=>{const list=storedWorkout(profile,wid)?.exercises;return Array.isArray(list)?list.find(e=>e?.id===eid):undefined};
const orderOf=w=>w.exercises.map(e=>e.id);
const countCheck=(args,key,min)=>expectHas(args,key)&&int(args.expect[key],min,1e6);

// check(args) → {code,message} or a plan. Plans with noop:true are already in effect (replay without history) and
// run no Web function. busy:true ops call Web functions that close #modal and are refused while a Web dialog is open.
// effective(storedProfile,…) is also the native outbox definition of a visible effect (protocol §5).
const ops={
  'workout.start':{
    check(args){
      if(args.routineId!==null&&!isId(args.routineId))return fail('invalid','Ungültige Routine');
      const name=typeof args.name==='string'?args.name.trim():'';
      if(args.routineId===null&&(!name||name.length>80))return fail('invalid','Name mit 1–80 Zeichen erforderlich');
      // training.js:openExistingWorkout: an active workout is opened instead of starting a second session.
      const active=activeWorkout();
      if(active)return {noop:true,result:{workoutId:active.id,started:false}};
      if(args.routineId!==null&&!state.routines.some(r=>r.id===args.routineId))return fail('gone','Routine existiert nicht mehr');
      return {busy:args.routineId===null,name};
    },
    run(args,plan){
      const before=new Set(state.workouts.map(w=>w.id));
      if(args.routineId!==null)startRoutine(args.routineId);
      else{
        startWorkout();const input=$('empty-workout-name');if(!input)throw Error('Startformular fehlt');
        input.value=plan.name;startEmptyWorkout({preventDefault(){}});
      }
      const w=activeWorkout();if(!w||before.has(w.id))throw Error('Workout wurde nicht gestartet');
      return {workoutId:w.id,started:true};
    },
    effective:(stored,args,plan,result)=>storedWorkout(stored,result?.workoutId)?.finished===false
  },
  'set.update':{
    check(args){
      const target=exerciseTarget(args);if(target.code)return target;
      const index=args.setIndex,fields=['kg','reps','done'].filter(key=>Object.hasOwn(args,key));
      if(!int(index,0,1e6))return fail('invalid','Ungültiger Satz');
      if(!fields.length||fields.includes('kg')&&!kgValue(args.kg)||fields.includes('reps')&&!repsValue(args.reps)||fields.includes('done')&&typeof args.done!=='boolean')
        return fail('invalid','kg 0–1000, Wiederholungen 1–1000 ganzzahlig oder leer, erledigt als Boolean');
      if(!expectHas(args,'kg','reps','done')||!(args.expect.kg===''||Number.isFinite(args.expect.kg))||!(args.expect.reps===''||Number.isFinite(args.expect.reps))||typeof args.expect.done!=='boolean')
        return fail('invalid','expect {kg,reps,done} erforderlich');
      const s=target.e.sets[index];if(!s)return fail('gone','Satz existiert nicht mehr');
      const next={kg:fields.includes('kg')?args.kg:s.kg,reps:fields.includes('reps')?args.reps:s.reps,done:fields.includes('done')?args.done:s.done};
      // app.js:setValue clears done for an emptied field and refuses done without kg and reps >= 1.
      if(fields.includes('kg')&&args.kg===''||fields.includes('reps')&&args.reps===''){if(args.done===true)return fail('invalid','Erledigt braucht kg und Wiederholungen');next.done=false}
      if(next.done&&(next.kg===''||next.reps===''||Number(next.reps)<1))return fail('invalid','Erledigt braucht kg und Wiederholungen');
      const current=setView(s);
      if(same(current,next))return {noop:true,next};
      if(!same(current,setView(args.expect)))return fail('conflict','Satz wurde inzwischen geändert');
      return {next,fields};
    },
    run(args,plan){
      // Final setValue chain: comma parsing, validation, rest start/cancel, superset rest, sounds, save and render.
      for(const key of plan.fields)setValue(args.workoutId,args.exerciseId,args.setIndex,key,args[key]);
      const s=exerciseOf(args.workoutId,args.exerciseId)?.sets[args.setIndex];
      if(!s||!same(setView(s),plan.next))throw Error('Satz wurde nicht übernommen');
    },
    effective(stored,args,plan){const s=storedExercise(stored,args.workoutId,args.exerciseId)?.sets?.[args.setIndex];return !!s&&same(setView(s),plan.next)}
  },
  'set.add':{
    check(args){
      const target=exerciseTarget(args);if(target.code)return target;
      if(!countCheck(args,'setCount',0))return fail('invalid','expect.setCount erforderlich');
      const count=target.e.sets.length,expected=args.expect.setCount;
      if(count===expected+1)return {noop:true,result:{setIndex:count-1}};
      return count===expected?{}:fail('conflict','Satzanzahl wurde inzwischen geändert');
    },
    run(args){
      addSet(args.workoutId,args.exerciseId);
      const sets=exerciseOf(args.workoutId,args.exerciseId).sets;if(sets.length!==args.expect.setCount+1)throw Error('Satz wurde nicht hinzugefügt');
      return {setIndex:sets.length-1};
    },
    effective:(stored,args)=>storedExercise(stored,args.workoutId,args.exerciseId)?.sets?.length===args.expect.setCount+1
  },
  'set.remove':{
    check(args){
      const target=exerciseTarget(args);if(target.code)return target;
      if(!countCheck(args,'setCount',2))return fail('invalid','expect.setCount ab 2 erforderlich; ein Satz bleibt immer erhalten');
      const count=target.e.sets.length,expected=args.expect.setCount;
      if(count===expected-1)return {noop:true};
      return count===expected?{}:fail('conflict','Satzanzahl wurde inzwischen geändert');
    },
    run(args){
      // training.js:removeLastSet removes only the last set and confirms a completed one.
      confirmed(()=>removeLastSet(args.workoutId,args.exerciseId));
      if(exerciseOf(args.workoutId,args.exerciseId).sets.length!==args.expect.setCount-1)throw Error('Satz wurde nicht entfernt');
    },
    effective:(stored,args)=>storedExercise(stored,args.workoutId,args.exerciseId)?.sets?.length===args.expect.setCount-1
  },
  'exercise.add':{
    check(args){
      const target=activeTarget(args);if(target.code)return target;
      const byId=Object.hasOwn(args,'libraryId'),byName=Object.hasOwn(args,'name');
      if(byId===byName)return fail('invalid','Genau eines von libraryId oder name');
      let name='',libraryId=null;
      if(byId){
        if(!isId(args.libraryId))return fail('invalid','Ungültige Übung');
        const book=exerciseBookItem(args.libraryId),source=book?null:exerciseCatalog.find(x=>x.id===args.libraryId);
        if(!book&&!source)return fail('invalid','Unbekannte Übung');
        // training.js:ensureBook reuses a same-named library entry for a catalog exercise.
        libraryId=book?book.id:bookByName(source.name)?.id??source.id;
      }else{
        name=typeof args.name==='string'?args.name.trim():'';
        if(!name||name.length>100)return fail('invalid','Name mit 1–100 Zeichen erforderlich');
        libraryId=bookByName(name)?.id??null;
      }
      if(!countCheck(args,'exerciseCount',0))return fail('invalid','expect.exerciseCount erforderlich');
      const count=target.w.exercises.length,expected=args.expect.exerciseCount,last=target.w.exercises.at(-1);
      if(count===expected+1&&libraryId!==null&&last?.exerciseId===libraryId)return {noop:true,result:{exerciseId:last.id,libraryId}};
      return count===expected?{busy:true,name}:fail('conflict','Übungen wurden inzwischen geändert');
    },
    run(args,plan){
      const previous=exercisePickerContext;exercisePickerContext={kind:'workout',id:args.workoutId};
      try{
        if(Object.hasOwn(args,'libraryId'))pickExercise(args.libraryId);
        else{
          // training.js:addOwnLibraryExercise without its DOM field: reuse by name, otherwise the same new entry.
          let b=bookByName(plan.name);if(!b){b={id:uid(),name:plan.name,target:0};state.exerciseBook.push(b);save()}
          appendPickedExercise(b);
        }
      }finally{exercisePickerContext=previous}
      const w=findWorkout(args.workoutId),last=w?.exercises.at(-1);
      if(!w||w.exercises.length!==args.expect.exerciseCount+1)throw Error('Übung wurde nicht hinzugefügt');
      return {exerciseId:last.id,libraryId:last.exerciseId};
    },
    effective:(stored,args,plan,result)=>!!storedExercise(stored,args.workoutId,result?.exerciseId)
  },
  'exercise.remove':{
    check(args){
      const target=activeTarget(args);if(target.code)return target;
      if(!isId(args.exerciseId))return fail('invalid','Ungültige Übungs-ID');
      if(!countCheck(args,'doneSets',0))return fail('invalid','expect.doneSets erforderlich');
      const index=target.w.exercises.findIndex(e=>e.id===args.exerciseId);
      if(index<0)return {noop:true};
      if(target.w.exercises[index].sets.filter(s=>s.done).length!==args.expect.doneSets)return fail('conflict','Übung hat inzwischen andere abgeschlossene Sätze');
      return {busy:true,index};
    },
    run(args,plan){
      // workout-polish.js:removeOrderedExercise also ends a rest that belongs to this exercise.
      const previous=exerciseOrderContext;exerciseOrderContext={kind:'workout',id:args.workoutId,index:plan.index};
      try{removeOrderedExercise()}finally{exerciseOrderContext=previous}
      if(findWorkout(args.workoutId)?.exercises.some(e=>e.id===args.exerciseId))throw Error('Übung wurde nicht entfernt');
    },
    effective:(stored,args)=>Array.isArray(storedWorkout(stored,args.workoutId)?.exercises)&&!storedExercise(stored,args.workoutId,args.exerciseId)
  },
  'exercise.move':{
    check(args){
      const target=activeTarget(args);if(target.code)return target;
      const seen=args.expect?.order;
      if(!isId(args.exerciseId)||!expectHas(args,'order')||!Array.isArray(seen)||!seen.every(isId)||new Set(seen).size!==seen.length)return fail('invalid','expect.order erforderlich');
      const from=seen.indexOf(args.exerciseId);
      if(from<0||!int(args.toIndex,0,seen.length-1))return fail('invalid','Ungültige Position');
      // workout-polish.js:placeExercise removes the exercise, then inserts it at toIndex.
      const wanted=[...seen];wanted.splice(args.toIndex,0,wanted.splice(from,1)[0]);
      const current=orderOf(target.w);
      if(same(current,wanted))return {noop:true,wanted};
      return same(current,seen)?{busy:true,wanted,index:from}:fail('conflict','Reihenfolge wurde inzwischen geändert');
    },
    run(args,plan){
      const previous=exerciseOrderContext;exerciseOrderContext={kind:'workout',id:args.workoutId,index:plan.index};
      try{placeExercise(args.toIndex)}finally{exerciseOrderContext=previous}
      if(!same(orderOf(findWorkout(args.workoutId)),plan.wanted))throw Error('Reihenfolge wurde nicht übernommen');
    },
    effective(stored,args,plan){const list=storedWorkout(stored,args.workoutId)?.exercises;return Array.isArray(list)&&same(list.map(e=>e?.id),plan.wanted)}
  },
  'superset.set':{
    check(args){
      const target=exerciseTarget(args);if(target.code)return target;
      if(args.partnerId!==null&&!isId(args.partnerId)||args.partnerId===args.exerciseId)return fail('invalid','Ungültige Partnerübung');
      const partner=args.partnerId===null?null:target.w.exercises.find(e=>e.id===args.partnerId);
      if(args.partnerId!==null&&!partner)return fail('gone','Partnerübung ist nicht mehr im Workout');
      if(partner?!!target.e.superset&&target.e.superset===partner.superset:target.e.superset===undefined)return {noop:true};
      return {busy:true};
    },
    run(args){
      // tracker-tools.js:supersetForm/saveSuperset, including group reuse and one-sided removal.
      supersetForm(args.workoutId,args.exerciseId);
      const select=$('superset-partner');if(!select)throw Error('Supersatz-Formular fehlt');
      select.value=args.partnerId??'';if((select.value||'')!==(args.partnerId??''))throw Error('Partnerübung nicht wählbar');
      saveSuperset(args.workoutId,args.exerciseId);
    },
    effective(stored,args){
      const e=storedExercise(stored,args.workoutId,args.exerciseId);if(!e)return false;
      if(args.partnerId===null)return e.superset===undefined;
      const partner=storedExercise(stored,args.workoutId,args.partnerId);return !!e.superset&&e.superset===partner?.superset;
    }
  },
  'rest.adjust':{
    check(args){
      const target=activeTarget(args);if(target.code)return target;
      if(args.seconds!==30&&args.seconds!==-30)return fail('invalid','Nur +30 oder −30 Sekunden');
      if(!expectHas(args,'endAt')||!finite(args.expect.endAt,0,1e15))return fail('invalid','expect.endAt erforderlich');
      // extendRest would restart an expired rest from now; an ended rest is gone even before the Web tick clears it.
      return target.w.rest?.endAt&&target.w.rest.endAt===args.expect.endAt&&target.w.rest.endAt>Date.now()?{}:fail('gone','Diese Pause läuft nicht mehr');
    },
    run(args){
      // training.js:extendRest / workout-controls.js:shortenRest; −30 s on a nearly finished rest may end it.
      if(args.seconds>0)extendRest(args.workoutId,30);else if(typeof shortenRest==='function')shortenRest(args.workoutId);else throw Error('−30 s nicht verfügbar');
      return {endAt:findWorkout(args.workoutId)?.rest?.endAt??null};
    },
    effective(stored,args,plan,result){const w=storedWorkout(stored,args.workoutId);return !!w&&(result?.endAt===null?!w.rest:w.rest?.endAt===result?.endAt)}
  },
  'rest.skip':{
    check(args){
      const target=activeTarget(args);if(target.code)return target;
      if(!expectHas(args,'endAt')||!finite(args.expect.endAt,0,1e15))return fail('invalid','expect.endAt erforderlich');
      if(!target.w.rest)return {noop:true};
      return target.w.rest.endAt===args.expect.endAt?{}:fail('gone','Inzwischen läuft eine andere Pause');
    },
    run(args){stopRest(args.workoutId)},
    effective(stored,args){const w=storedWorkout(stored,args.workoutId);return !!w&&(!w.rest||w.rest.endAt!==args.expect.endAt)}
  },
  'workout.finish':{
    check(args){
      if(!isId(args.workoutId))return fail('invalid','Ungültige Workout-ID');
      if(Object.hasOwn(args,'bodyweight')&&args.bodyweight!==null&&!finite(args.bodyweight,20,400))return fail('invalid','Körpergewicht 20–400 kg');
      if(Object.hasOwn(args,'confirmUnfinished')&&typeof args.confirmUnfinished!=='boolean')return fail('invalid','confirmUnfinished muss Boolean sein');
      const w=findWorkout(args.workoutId);
      if(!w)return fail('gone','Workout existiert nicht mehr');
      if(w.finished)return w.autoFinished?fail('gone','Workout wurde nach 5 Stunden automatisch beendet'):{noop:true};
      if(activeWorkout()!==w)return fail('gone','Workout ist nicht mehr aktiv');
      // flows.js:finishWorkout gate; confirmWorkoutFinish itself would otherwise drop every unchecked set.
      if(!loggedSets(w).length)return fail('invalid','Noch kein abgeschlossener Satz; Workout verwerfen statt abschließen');
      if(w.exercises.some(e=>e.sets.some(s=>!s.done))&&args.confirmUnfinished!==true)return fail('conflict','Nicht abgehakte Sätze würden verworfen');
      return {busy:true};
    },
    run(args){
      // Same flow as the Web button: finish sheet, optional body weight, confirmWorkoutFinish chain (XP, streak,
      // completion screen, sounds, rest/Live Activity end via save).
      finishWorkout(args.workoutId);
      const input=$('finish-bodyweight');if(!input)throw Error('Abschlussformular fehlt');
      input.value=args.bodyweight==null?'':String(args.bodyweight);
      confirmWorkoutFinish({preventDefault(){}},args.workoutId);
      if(!findWorkout(args.workoutId)?.finished)throw Error('Workout wurde nicht abgeschlossen');
    },
    effective(stored,args,plan){const w=storedWorkout(stored,args.workoutId);return w?.finished===true&&(!!plan.noop||args.bodyweight==null||w.bodyweight===args.bodyweight)}
  },
  'workout.discard':{
    check(args){
      if(!isId(args.workoutId))return fail('invalid','Ungültige Workout-ID');
      const w=findWorkout(args.workoutId);
      if(!w)return {noop:true};
      return w.finished?fail('gone','Workout ist bereits abgeschlossen'):{busy:true};
    },
    run(args){
      // interactions.js:discardAccidentalWorkout is the action behind the Web confirmation.
      discardAccidentalWorkout(args.workoutId);
      if(findWorkout(args.workoutId))throw Error('Workout wurde nicht verworfen');
    },
    effective:(stored,args)=>Array.isArray(stored?.workouts)&&!storedWorkout(stored,args.workoutId)
  },
  'routine.save':{
    check(args){
      const r=args.routine;
      if(!plain(r)||!isId(r.id)||r.id.length>200||typeof r.name!=='string')return fail('invalid','Ungültige Routine');
      const name=r.name.trim();
      if(!name||name.length>80)return fail('invalid','Name mit 1–80 Zeichen erforderlich');
      if(!Array.isArray(r.exercises)||!r.exercises.length)return fail('invalid','Mindestens eine Übung erforderlich');
      // enhancements.js:saveRoutine rules plus the effective validData chain (known library entry, rest 0–900 s).
      for(const e of r.exercises)if(!plain(e)||!isId(e.exerciseId)||!exerciseBookItem(e.exerciseId)||!int(e.sets,1,12)||!int(e.min,1,100)||!int(e.max,1,100)||e.max<e.min||
        e.restSeconds!==undefined&&!finite(e.restSeconds,0,900)||e.superset!==undefined&&!isId(e.superset))
        return fail('invalid','Sätze 1–12, Wiederholungen 1–100 (bis ≥ von), Pause 0–900 s und bekannte Übung erforderlich');
      if(!Object.hasOwn(args,'expect')||args.expect!==null&&!plain(args.expect))return fail('invalid','expect erforderlich: null oder bisherige Routine');
      const target={...copy(r),name},current=state.routines.find(x=>x.id===r.id);
      if(current&&same(current,target))return {noop:true,target};
      if(args.expect===null?!!current:!current||!same(current,args.expect))return fail('conflict','Routine wurde inzwischen geändert');
      return {busy:true,target};
    },
    run(args,plan){
      const previous=routineDraft;routineDraft=copy(args.routine);
      try{saveRoutine()}finally{routineDraft=previous}
      if(!same(state.routines.find(x=>x.id===args.routine.id),plan.target))throw Error('Routine wurde nicht gespeichert');
    },
    effective:(stored,args,plan)=>Array.isArray(stored?.routines)&&same(stored.routines.find(x=>x?.id===args.routine.id),plan.target)
  },
  'routine.delete':{
    check(args){
      if(!isId(args.routineId))return fail('invalid','Ungültige Routine');
      return state.routines.some(r=>r.id===args.routineId)?{}:{noop:true};
    },
    run(args){
      confirmed(()=>deleteRoutine(args.routineId));
      if(state.routines.some(r=>r.id===args.routineId))throw Error('Routine wurde nicht gelöscht');
    },
    effective:(stored,args)=>Array.isArray(stored?.routines)&&!stored.routines.some(r=>r?.id===args.routineId)
  },
  'exercise.create':{
    check(args){
      const byName=Object.hasOwn(args,'name'),byCatalog=Object.hasOwn(args,'catalogKey');
      if(byName===byCatalog)return fail('invalid','Genau eines von name oder catalogKey');
      if(byCatalog){
        // catalogKey is an item id from pulsNativeExerciseSearch: a catalog ID or an existing library ID.
        if(!isId(args.catalogKey))return fail('invalid','Ungültige Katalogübung');
        if(exerciseBookItem(args.catalogKey))return {noop:true,result:{libraryId:args.catalogKey,created:false}};
        const source=exerciseCatalog.find(x=>x.id===args.catalogKey);if(!source)return fail('invalid','Unbekannte Katalogübung');
        const existing=bookByName(source.name);
        return existing?{noop:true,result:{libraryId:existing.id,created:false}}:{catalogKey:args.catalogKey};
      }
      const name=typeof args.name==='string'?args.name.trim():'';
      if(!name||name.length>100)return fail('invalid','Name mit 1–100 Zeichen erforderlich');
      const existing=bookByName(name);
      return existing?{noop:true,result:{libraryId:existing.id,created:false}}:{name};
    },
    run(args,plan){
      if(plan.catalogKey){
        // training.js:ensureBook, as when picking a catalog exercise in the Web routine editor: catalog ID, name,
        // muscles and equipment; a same-named library entry is reused.
        const count=state.exerciseBook.length,b=ensureBook(plan.catalogKey);if(!b)throw Error('Katalogübung nicht übernommen');
        return {libraryId:b.id,created:state.exerciseBook.length>count};
      }
      // training.js:addOwnLibraryExercise / enhancements.js:routineAddNew: reuse by name, otherwise a new entry.
      let b=bookByName(plan.name),created=false;
      if(!b){b={id:uid(),name:plan.name,target:0};state.exerciseBook.push(b);save();created=true}
      return {libraryId:b.id,created};
    },
    effective:(stored,args,plan,result)=>Array.isArray(stored?.exerciseBook)&&stored.exerciseBook.some(b=>b?.id===result?.libraryId)
  }
};

function build(){
  const settings=state.workoutSettings??{restSeconds:120},restDefault=settings.restSeconds,book=state.exerciseBook||[];
  const bookName=id=>book.find(b=>b.id===id)?.name;
  const previousSet=s=>s?{kg:s.kg,reps:s.reps,shownKg:decimal(Number(s.kg))}:null;
  const w=activeWorkout();let active=null;
  if(w&&isId(w.id)){
    const exercises=w.exercises.filter(e=>isId(e.id)),sets=w.exercises.flatMap(e=>e.sets);
    active={id:w.id,name:text(w.name),date:w.date,routineId:isId(w.routineId)?w.routineId:null,
      startedAt:Number.isFinite(w.startedAt)?w.startedAt:null,
      autoFinishAt:Number.isFinite(w.startedAt)&&typeof FIVE_HOURS_MS==='number'?w.startedAt+FIVE_HOURS_MS:null,
      timeApprox:!!w.timeApprox,durationXpVersion:w.durationXpVersion===1?1:null,
      rest:w.rest?.endAt?{endAt:w.rest.endAt,exerciseId:isId(w.rest.exerciseId)?w.rest.exerciseId:null}:null,
      loggedSets:loggedSets(w).length,openSets:sets.filter(s=>!s.done).length,totalSets:sets.length,
      complete:exercises.length===w.exercises.length,
      exercises:exercises.map(e=>{
        // Same source as the Web "Vorher" column and copy button: previous done sets, by set index.
        const previous=previousPerformance(w,e),group=e.superset?w.exercises.filter(x=>x.superset===e.superset):[];
        return {id:e.id,libraryId:isId(e.exerciseId)?e.exerciseId:null,name:text(e.name),
          restSeconds:typeof e.restSeconds==='number'?e.restSeconds:null,effectiveRestSeconds:e.restSeconds??restDefault,
          repMin:Number.isFinite(e.repMin)?e.repMin:null,repMax:Number.isFinite(e.repMax)?e.repMax:null,
          superset:typeof e.superset==='string'?e.superset:null,
          supersetWith:group.length>1?group.filter(x=>x!==e&&isId(x.id)).map(x=>x.id):[],
          previous:previous?{date:previous.date,sets:previous.sets.map(previousSet)}:null,
          sets:e.sets.map((s,i)=>({...setView(s),previous:previousSet(previous?.sets[i])}))};
      })};
  }
  const awards=workoutAwards(),recent=completedWorkouts().slice(-10).reverse().filter(x=>isId(x.id)).map(x=>{
    const stats=workoutStats([x]);
    return {id:x.id,name:text(x.name),date:x.date,routineId:isId(x.routineId)?x.routineId:null,
      durationSeconds:Number.isFinite(x.durationSeconds)?x.durationSeconds:null,sets:stats.sets,reps:stats.reps,volume:decimal(stats.volume),
      xp:awards[x.id]?.xp||0,autoFinished:!!x.autoFinished};
  });
  const {last,next}=routineRecommendation(),routines=(state.routines||[]).filter(r=>isId(r.id)),library=book.filter(b=>isId(b.id));
  const xp=typeof xpProgress==='function'&&typeof totalWorkoutXP==='function'?xpProgress(totalWorkoutXP()):null;
  const training={
    language:state.language==='en'?'en':'de',locale:appLocale(),today:today(),settings:{restSeconds:restDefault},active,
    routines:routines.map(r=>({id:r.id,name:text(r.name),exerciseCount:r.exercises.length,setCount:r.exercises.reduce((a,e)=>a+e.sets,0),
      exercises:r.exercises.map(e=>({libraryId:isId(e.exerciseId)?e.exerciseId:null,name:bookName(e.exerciseId)==null?null:text(bookName(e.exerciseId)),
        sets:e.sets,min:e.min,max:e.max,restSeconds:typeof e.restSeconds==='number'?e.restSeconds:null,superset:typeof e.superset==='string'?e.superset:null}))})),
    routineCount:(state.routines||[]).length,
    recommendation:{nextRoutineId:isId(next?.id)?next.id:null,
      last:last&&isId(last.id)?{id:last.id,name:text(last.name),date:last.date,routineId:isId(last.routineId)?last.routineId:null}:null},
    library:library.map(b=>({id:b.id,name:text(b.name),muscles:Array.isArray(b.muscles)?b.muscles.map(text):[],equipment:typeof b.equipment==='string'?text(b.equipment):null,
      target:Number.isFinite(b.target)?b.target:0,repMin:Number.isFinite(b.repMin)?b.repMin:null,repMax:Number.isFinite(b.repMax)?b.repMax:null,loadStep:Number.isFinite(b.loadStep)?b.loadStep:null})),
    libraryCount:book.length,recent,
    identity:xp?{level:xp.level,current:xp.current,needed:xp.needed,total:xp.total,streak:typeof dailyWorkoutStreak==='function'?dailyWorkoutStreak():null}:null,
    omitted:{routines:(state.routines||[]).length-routines.length,library:book.length-library.length,recent:0}
  };
  // Same 48 Ki code-unit budget as the overview. The active session is never shortened; oldest history goes first.
  const limit=48*1024;let size=JSON.stringify(training).length;
  for(const key of ['recent','library','routines'])while(size>limit&&training[key].length){size-=JSON.stringify(training[key].pop()).length+1;training.omitted[key]++}
  while(JSON.stringify(training).length>limit){
    const key=['recent','library','routines'].find(name=>training[name].length);if(!key)throw Error('Training exceeds message budget');
    training[key].pop();training.omitted[key]++;
  }
  return training;
}

// Exact Web picker ranking (aliases, German terms, equipment filter); read only.
function search(request){
  const query=typeof request.query==='string'?request.query.slice(0,100):'',equipment=request.equipment??'all',limit=request.limit??60;
  const filtered=typeof exerciseEquipmentFilter!=='undefined';
  if(!['all','machine','cable','smith'].includes(equipment)||equipment!=='all'&&!filtered||!int(limit,1,200))return null;
  const previous=filtered?exerciseEquipmentFilter:undefined,name=query.trim();let matches,exact;
  if(filtered)exerciseEquipmentFilter=equipment;
  try{
    matches=exerciseOptions(query);
    exact=!!name&&exerciseOptions(name).some(x=>normalizeSearch(x.name)===normalizeSearch(name));
  }finally{if(filtered)exerciseEquipmentFilter=previous}
  return {query,equipment,total:matches.length,canCreate:!!name&&!exact,language:state.language==='en'?'en':'de',
    items:matches.slice(0,limit).filter(x=>isId(x.id)).map(x=>{
      const muscles=(x.muscles||[]).map(text),gear=typeof x.equipment==='string'?text(x.equipment):null;
      return {id:x.id,name:text(x.name),muscles,muscleLabels:muscles.map(muscleLabel),equipment:gear,equipmentLabel:gear===null?null:equipmentLabel(gear),
        inLibrary:!!exerciseBookItem(x.id)};
    })};
}
// Display labels from the existing Web translations: insights.js muscleNames (German), englishUI (i18n.js and
// exercise-muscles.js) for English. Without a Web translation the stored key is shown, exactly as the Web picker does.
function muscleLabel(key){
  const german=typeof muscleNames==='object'&&typeof muscleNames[key]==='string'?muscleNames[key]:null;
  if(german===null)return key;
  if(state.language!=='en')return text(german);
  // English: the Web translation of the German label; the catalog key is already English otherwise.
  return typeof englishUI==='object'&&typeof englishUI?.[german]==='string'?text(englishUI[german]):key;
}
// The Web has no per-value equipment translation: its picker shows the catalog value in both languages. Keep that.
const equipmentLabel=key=>key;

// Document-local Web UI state touched by the Web functions; restored on rollback.
function captureUi(){
  return {session:typeof sessionWorkoutId!=='undefined'?sessionWorkoutId:undefined,completion:typeof completionId!=='undefined'?completionId:undefined,
    step:typeof completionStep!=='undefined'?completionStep:undefined,tab:typeof trainTab!=='undefined'?trainTab:undefined,page,
    draft:typeof routineDraft!=='undefined'?routineDraft:undefined,picker:typeof exercisePickerContext!=='undefined'?exercisePickerContext:undefined,
    order:typeof exerciseOrderContext!=='undefined'?exerciseOrderContext:undefined,modal:typeof modal!=='undefined'&&!!modal.open,
    // Completion/celebration state of the finish chain (training-polish, interactions, workout-polish).
    review:typeof completionReview!=='undefined'?completionReview:undefined,
    audio:typeof finishAudio!=='undefined'&&finishAudio?{...finishAudio}:undefined,
    celebration:typeof xpCelebrationPending!=='undefined'?xpCelebrationPending:undefined};
}
function restoreUi(ui){
  if(typeof sessionWorkoutId!=='undefined')sessionWorkoutId=ui.session;if(typeof completionId!=='undefined')completionId=ui.completion;
  if(typeof completionStep!=='undefined')completionStep=ui.step;if(typeof trainTab!=='undefined')trainTab=ui.tab;page=ui.page;
  if(typeof routineDraft!=='undefined')routineDraft=ui.draft;if(typeof exercisePickerContext!=='undefined')exercisePickerContext=ui.picker;
  if(typeof exerciseOrderContext!=='undefined')exerciseOrderContext=ui.order;
  if(typeof completionReview!=='undefined')completionReview=ui.review;
  if(typeof finishAudio!=='undefined'&&ui.audio)finishAudio={...ui.audio};
  if(typeof xpCelebrationPending!=='undefined')xpCelebrationPending=ui.celebration;
  try{if(!ui.modal&&typeof modal!=='undefined'&&modal.open)modal.close()}catch{}
}
window.pulsNativeTraining={ops,build,search,captureUi,restoreUi};
})();
