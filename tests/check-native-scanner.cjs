const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Run the actual bridge with synthetic workouts and event hooks, without a real account.
function bridgeFixture(workouts=[],overrides={}){
  const messages=[],events={},state={workouts};
  const c={state,Date,console,setInterval(){},save(){},render(){},
    document:{documentElement:{classList:{add(){}}},createElement:()=>({}),head:{appendChild(){}},addEventListener:(e,f)=>events[e]=f},
    window:{pulsNativeFeatures:['workoutTimer'],webkit:{messageHandlers:{pulsNative:{postMessage:m=>messages.push(m)}}},addEventListener:(e,f)=>events[e]=f}};
  Object.assign(c,overrides);vm.runInNewContext(fs.readFileSync('js/native-bridge.js','utf8'),c);
  return {c,state,messages,events};
}

{
  const original=new Error('original render failure'),warnings=[];
  const f=bridgeFixture([],{save:()=>42,render(){throw original},console:{warn:(...args)=>warnings.push(args)}});
  f.c.syncRunActivity=()=>{throw Error('bridge failure')};
  assert.equal(f.c.save(),42,'bridge exception cannot override save return value');
  assert.throws(()=>f.c.render(),error=>error===original,'bridge exception cannot replace original render exception');
  assert.equal(warnings.length,2);
}
const workout=()=>({id:'w',name:'Test',startedAt:Date.now()-60000,finished:false,exercises:[{id:'e',name:'Bank',sets:[{done:false}]}]});
{
  let f=bridgeFixture();assert.equal(f.messages.at(-1).type,'restCancel','startup cleans orphaned workout activities');
  let w=workout();f.state.workouts.push(w);f.c.save();assert.equal(f.messages.at(-1).type,'workoutActive');
  w.rest={endAt:Date.now()+30000,exerciseId:'e'};f.c.render();assert.equal(f.messages.at(-1).type,'restStart');
  let count=f.messages.length;f.events.pagehide();assert.equal(f.messages.length,count,'same rest is deduplicated');
  w.finished=true;f.c.save();assert.equal(f.messages.at(-1).type,'restCancel','finish is sent synchronously on save');
  f=bridgeFixture([workout()]);f.state.workouts=[];f.c.render();assert.equal(f.messages.at(-1).type,'restCancel','discard is sent on render');
  f=bridgeFixture([workout()]);f.state.workouts[0].finished=true;f.events.visibilitychange();assert.equal(f.messages.at(-1).type,'restCancel','background transition reconciles state');
}

// Exercise actual canvas rotation/cadence/cleanup. Decoding itself and optics need a real camera.
{
  let tick,delay,cleared=false,angle=0,attempts=[],accepted=[],transforms=[];
  let width=0,height=0,resizes=0;
  const canvas={get width(){return width},set width(v){width=v;resizes++},get height(){return height},set height(v){height=v;resizes++},getContext:()=>({setTransform(...x){transforms.push(x)},rotate(x){angle=x},drawImage(){}})};
  const c={document:{visibilityState:'visible',createElement:()=>canvas},setInterval:(f,ms)=>{tick=f;delay=ms;return 7},clearInterval:id=>{assert.equal(id,7);cleared=true}};
  const source=fs.readFileSync('js/products.js','utf8');
  vm.runInNewContext(source.slice(source.indexOf('function startRotatedBarcodeScan('),source.indexOf('function loadBarcodeLibrary(')),c);
  const reader={decodeFromCanvas(image){attempts.push([angle,image.width,image.height]);if(attempts.length<3)throw Error('not found');return {getText:()=>'3017620422003'}}};
  const video={videoWidth:1280,videoHeight:720,readyState:2},stop=c.startRotatedBarcodeScan(reader,video,x=>accepted.push(x));
  assert.equal(delay,400);tick();tick();tick();
  assert.deepEqual(attempts,[[Math.PI/2,540,960],[3*Math.PI/2,540,960],[Math.PI/2,540,960]]);
  assert.equal(resizes,2,'same-size frames reuse the canvas pixel buffer');
  assert.equal(accepted.length,1);assert.equal(transforms[0][4],270);assert.equal(transforms[0][5],480);
  c.document.visibilityState='hidden';tick();assert.equal(attempts.length,3,'hidden camera does not decode');
  c.document.visibilityState='visible';video.readyState=1;tick();assert.equal(attempts.length,3);
  video.readyState=2;video.videoWidth=720;video.videoHeight=1280;tick();
  assert.deepEqual(attempts.at(-1),[3*Math.PI/2,960,540]);assert.equal(resizes,4,'resize once per dimension after camera orientation changes');
  stop();assert(cleared);
}
console.log('PASS: native workout startup/finish/discard/background reconciliation; scanner rotation, cadence and cleanup (mock canvas, no real camera).');
