const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const main=fs.readFileSync('public/js/main.js','utf8');
test('run needs a held button or explicit lock, forward movement, and no aiming',()=>{
  const keys={},touch={x:0,y:0};let aiming=false;
  const source=main.slice(main.indexOf('let runLocked=false;'),main.indexOf('function isStrafing()'));
  const controls=new Function('keys','touchMove','isAiming','document',source+'return {isSprinting,setRunLock};')(keys,touch,()=>aiming,{querySelector:()=>null});
  keys.KeyW=true;assert(!controls.isSprinting());keys.ShiftLeft=true;assert(controls.isSprinting());keys.ShiftLeft=false;assert(!controls.isSprinting());
  controls.setRunLock(true);assert(controls.isSprinting());aiming=true;assert(!controls.isSprinting());aiming=false;
  keys.KeyW=false;assert(!controls.isSprinting());touch.y=-1;assert(controls.isSprinting());controls.setRunLock(false);assert(!controls.isSprinting());
});
test('punch deals one close-range hit on contact, but misses behind targets and walls',async()=>{
  const THREE=await import('three'),hits=[],sounds=[];
  const enemy={x:0,z:-1.5,y:0,T:{h:1.8,radius:.4},dead:false};
  const state={monsters:[enemy],wallMeshes:[],collMesh:null,gameMode:'campaign'},P={pos:new THREE.Vector3(),yaw:0,dead:false};let blocked=false;
  const source=main.slice(main.indexOf('function applyMeleeDamage('),main.indexOf('const _bx ='));
  const create=new Function('THREE','state','P','network','operations','up','damageMonster','sfx','castRay',`const MELEE_DAMAGE=35,MELEE_RANGE=2.5;let meleeTimer=0,rifleAnimTimer=0,meleeContact=0;${source};return {applyMeleeDamage,updateMelee,arm:()=>meleeContact=.22};`);
  const c=create(THREE,state,P,{role:null},{buffs:{damage:0}},{dmg:0},(m,d)=>hits.push(d),{punchHit:()=>sounds.push(1)},()=>blocked);
  c.arm();c.updateMelee(.1);assert.equal(hits.length,0);c.updateMelee(.13);c.updateMelee(.4);assert.deepEqual(hits,[35]);assert.equal(sounds.length,1);
  enemy.z=1.5;c.applyMeleeDamage(P.pos,0);assert.equal(hits.length,1);
  enemy.z=-1.5;state.collMesh={};blocked=true;c.applyMeleeDamage(P.pos,0);assert.equal(hits.length,1);
  blocked=false;enemy.z=-10;c.applyMeleeDamage(P.pos,0);assert.equal(hits.length,1);
});
