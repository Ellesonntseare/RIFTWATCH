const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const main=fs.readFileSync('public/js/main.js','utf8');
const source=main.slice(main.indexOf('function mouseLockFailed()'),main.indexOf('async function startGame'));
function setup(request){
 const state={mode:'playing',paused:true,shopOpen:false},document={pointerLockElement:null,body:{classList:{remove(){},add(){}}}},canvas={requestPointerLock:request},status={textContent:''},keys={};
 const factory=new Function('state','document','renderer','$','network','operations','keys','touchDevice','touchMove',`let locked=false,mouseDown=false,aimHeld=false,aimToggle=false;${source};return {lock,mouseLockFailed,get locked(){return locked}};`);
 const controls=factory(state,document,{domElement:canvas},()=>({textContent:'',classList:{add(){},remove(){}},...status}),{role:null},{input(){}},keys,false,{x:0,y:0});
 return {state,document,canvas,controls};
}
test('failed pointer capture stays paused and a second click retries capture',async()=>{
 let attempts=0;const c=setup(()=>{attempts++;return Promise.reject(Error('User gesture needed'));});
 c.controls.lock();await Promise.resolve();assert(c.state.paused);assert.equal(c.controls.locked,false);
 c.controls.lock();await Promise.resolve();assert.equal(attempts,2);assert(c.state.paused);
});
test('requesting pointer capture does not resume before the browser confirms it',()=>{
 const c=setup(()=>Promise.resolve());c.controls.lock();assert(c.state.paused);assert.equal(c.controls.locked,false);
});
test('an obsolete pointer error does not pause an already captured mouse',()=>{
 const c=setup(()=>{});c.document.pointerLockElement=c.canvas;c.state.paused=false;c.controls.mouseLockFailed();assert.equal(c.state.paused,false);assert.equal(c.controls.locked,true);
});
