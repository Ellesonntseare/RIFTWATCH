const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const THREE = require('three');
const source = fs.readFileSync('public/js/operations.js','utf8').replace("import * as THREE from 'three';",'').replace('export function','function');
const elements = new Map();
const document = { getElementById(id) { if(!elements.has(id)) elements.set(id,{style:{},textContent:'',classList:{toggle(){}}}); return elements.get(id); } };
const create = new Function('THREE','document',source+'; return createOperations;')(THREE,document);
function setup() {
  const state={world:new THREE.Group(),map:{size:[200,200]},monsters:[],toSpawn:2,bossQueued:false};
  const P={pos:new THREE.Vector3(),hp:50,maxHp:100}; let credits=0,ammo=0;
  const api={state,P,camera:new THREE.PerspectiveCamera(),floorAt:()=>0,clearPath:()=>true,blocked:()=>false,banner:()=>{},reward:n=>credits+=n,refill:()=>ammo++,sound:()=>{}};
  const ops=create(api); ops.start(1);
  return {state,P,ops,api,get credits(){return credits},get ammo(){return ammo}};
}
test('mission requires data recovery, all enemies, and deliberate extraction',()=>{
  const ctx=setup(),{ops,P,state}=ctx;
  P.pos.copy(ops.items.find(i=>i.kind==='relay').pos); ops.input(true);
  ops.update(2.1); assert.equal(ctx.credits,150); assert.equal(ops.ready,false);
  state.toSpawn=0; state.monsters=[{dead:false}]; ops.update(4); assert.equal(ops.ready,false);
  state.monsters[0].dead=true; ops.input(false); ops.update(0.1); assert.equal(ops.ready,false);
  ops.input(true); ops.update(3.1); assert.equal(ops.ready,true); assert.equal(ctx.credits,500);
  ops.update(10); assert.equal(ctx.credits,500,'reward cannot repeat');
});
test('medkits clamp health and timed effects expire only during updates',()=>{
  const {ops,P}=setup(); P.hp=90; P.pos.copy(ops.items.find(i=>i.kind==='med').pos);ops.update(0.1); assert.equal(P.hp,100);
  P.pos.copy(ops.items.find(i=>i.kind==='damage').pos);ops.update(0.1);assert.equal(ops.buffs.damage,20);
  ops.update(21);assert.equal(ops.buffs.damage,0);
});
test('health pickups hover subtly at reduced size and restore 55 health',()=>{
  const {ops,P}=setup(),meds=ops.items.filter(i=>i.kind==='med');assert.equal(meds.length,3);
  const med=meds[0];ops.update(1);assert(med.body.position.y>=.68&&med.body.position.y<=.76);assert.equal(med.group.scale.x,.75);
  for(const item of ops.items)if(item!==med)assert(Math.hypot(item.pos.x-med.pos.x,item.pos.z-med.pos.z)>=9);
  P.hp=20;P.pos.copy(med.pos);ops.update(.1);assert.equal(P.hp,75);assert(!ops.items.includes(med));
});
test('mystery cache requires interaction and can only be opened once',()=>{
  const {ops,P}=setup(),item=ops.items.find(i=>i.kind==='cache');P.pos.copy(item.pos);ops.update(0.1);assert(ops.items.includes(item));
  ops.input(true);ops.update(0.1);assert(!ops.items.includes(item));
});
test('new sector cleans up field objects and temporary effects',()=>{
  const {ops,state}=setup();ops.buffs.speed=20;ops.start(2);assert.equal(ops.buffs.speed,0);assert.equal(state.world.children.length,ops.items.length);assert.equal(ops.items.filter(i=>i.kind==='relay').length,1);
});
test('blocked terrain falls back to current reachable position without inaccessible supplies',()=>{
  const ctx=setup();ctx.api.clearPath=()=>false;
  const ops=create({...ctx.api,clearPath:()=>false});ops.start(1);
  assert.equal(ops.items.length,1);assert(ops.items[0].pos.equals(ctx.P.pos));
});
test('the winter soldier and heavy monsters advance while bosses defend their positions',async()=>{
  const text=fs.readFileSync('public/js/monsters.js','utf8');
  const types=new Function(text.slice(text.indexOf('export const MONSTER_TYPES'),text.indexOf('const FILES')).replace('export const','const')+'return MONSTER_TYPES;')();
  for(const key of ['boss']) {assert.equal(types[key].stationary,true,key);assert.equal(types[key].speed,0,key);}
  for(const key of ['sniper','demon','brute']) {assert.equal(!!types[key].stationary,false,key);assert(types[key].speed>0,key);}
  assert(types.grunt.speed>0);assert(types.runner.speed>0);
});

test('ground guns require E, equip the selected gun and are consumed only once',()=>{
  const {ops,P,api}=setup(),equipped=[];api.equipWeapon=i=>equipped.push(i);
  for(const kind of ['gun0','gun1']){const item=ops.items.find(i=>i.kind===kind);assert(item);P.pos.copy(item.pos);ops.update(.1);assert(ops.items.includes(item));assert.equal(item.body.position.y,.085);ops.input(true);ops.update(.1);ops.input(false);assert(!ops.items.includes(item));ops.update(.1);}
  assert.deepEqual(equipped,[0,1]);
});

test('a multiplayer weapon claim removes the shared gun and grants it to its receiver',()=>{
  const {ops,api}=setup(),grants=[];api.grantPickup=(id,kind)=>grants.push({id,kind});const item=ops.items.find(i=>i.kind==='gun1');ops.claim(item.id,'friend',item.pos);ops.claim(item.id,'friend',item.pos);assert.deepEqual(grants,[{id:'friend',kind:'gun1'}]);
});

test('recoil stabilizer is collectible, lasts 20 seconds, and resets for a new sector',()=>{
 const {ops,P}=setup();const item=ops.items.find(i=>i.kind==='recoil');assert(item);
 P.pos.copy(item.pos);ops.update(.1);assert.equal(ops.buffs.recoil,20);assert(!ops.items.includes(item));
 ops.update(5);assert.equal(ops.buffs.recoil,15);ops.update(16);assert.equal(ops.buffs.recoil,0);
 ops.grant('recoil');ops.start(2);assert.equal(ops.buffs.recoil,0);
});

test('supply caches stay grounded and their locator beam fades outside proximity',()=>{
  const {ops,P}=setup();const cache=ops.items.find(i=>i.kind==='cache');
  assert(cache);const beam=cache.group.getObjectByName('supply-beacon');assert(beam);
  P.pos.copy(cache.pos).add(new THREE.Vector3(10,0,0));ops.update(.1);
  assert.equal(beam.visible,true);assert.equal(cache.body.position.y,.52);assert.equal(cache.body.rotation.y,0);
  P.pos.copy(cache.pos).add(new THREE.Vector3(100,0,0));ops.update(.1);assert.equal(beam.visible,false);
});
