import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {heroMotionClips,createHeroMotion,MOVEMENT_PREVIEWS} from '../public/js/hero-motion.js';
import {HEROES} from '../public/js/roster.js';
import {loadMonsterModels,buildMonster,animateMonster,MONSTER_TYPES} from '../public/js/monsters.js';

// These are geometry/animation tests running in Node, not a browser renderer.
// Provide only the canvas surface needed for a non-rendered blob-shadow texture.
if (typeof document === 'undefined') globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw Error('Unexpected DOM requirement: ' + tag);
    return {
      width: 64, height: 64,
      getContext(kind) {
        if (kind !== '2d') throw Error('Unexpected canvas context: ' + kind);
        return {
          createRadialGradient() { return {addColorStop() {}}; },
          fillRect() {},
          set fillStyle(_) {}
        };
      }
    };
  }
};

async function asset(name){const delivery='models/web/'+name,source='models/'+name;const deliveryExists=await fs.access(delivery).then(()=>true,()=>false),sourceExists=await fs.access(source).then(()=>true,()=>false);const file=deliveryExists&&(process.env.RIFTWATCH_WEB_MODELS==='1'||!sourceExists)?delivery:source;const bytes=await fs.readFile(file),loader=new GLTFLoader();loader.register(()=>({name:'GeometryOnlyTest',loadTexture:()=>Promise.resolve(new THREE.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const soldier=await asset('futuristic_soldier_free.glb'),movementPack=await asset('mixamo-movement-pack.glb');
for(const hero of HEROES)test((hero.role||hero.name)+' walks, runs, stops and keeps boot soles on the ground',async()=>{
  const template=await asset(hero.file);const clips=await heroMotionClips(hero.file,template.scene,soldier,movementPack,true);
  assert(clips.walk?.tracks.length>=6,'retargeted walking leg tracks exist');assert(clips.run?.tracks.length>=6);
  for(const [move] of MOVEMENT_PREVIEWS)assert(clips[move]?.tracks.length>=(['jump','strafe','startWalk','fireRifle','throw'].includes(move)?6:20),move+' transfers to '+hero.role);
  const gameplay=await heroMotionClips(hero.file,template.scene,soldier,movementPack);
  for(const move of ['punch','elbow','kneeCombo','dropKick','daggers','fireRifle','throw'])assert(gameplay[move]?.tracks.length>=20,move+' is available during matches');
  for(const move of ['jump','strafe','startWalk'])assert(gameplay[move]?.tracks.length>=6,move+' is available during movement');
  assert(gameplay.fireRifle.tracks.every(track=>!/(Hips|Leg|Foot|Toe)/i.test(track.name)),'firing cannot lift the operator’s legs');
  assert(gameplay.throw.tracks.every(track=>!/(Hips|Leg|Foot|Toe)/i.test(track.name)),'throwing cannot lift the operator’s legs');
  const model=clone(template.scene),discard=[];model.traverse(o=>{if(o.isMesh&&/floor/i.test(o.name))discard.push(o);});discard.forEach(o=>o.removeFromParent());
  const root=new THREE.Group();root.add(model);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),scale=1.8/(box.max.y-box.min.y);model.scale.multiplyScalar(scale);model.position.y=-box.min.y*scale;root.updateMatrixWorld(true);
  const leg=model.getObjectByName(clips.walk.tracks[0].name.split('.')[0]);
  const motion=createHeroMotion(model,root,clips);
  for(let i=0;i<20;i++)motion(1/30,false,0);const idle=leg.quaternion.clone();
  const jumpRotations=[];for(let i=0;i<15;i++){motion(1/30,false,0,{airborne:true,jumping:true});jumpRotations.push(leg.quaternion.clone());}
  assert(jumpRotations.some(q=>q.angleTo(jumpRotations[0])>.1),'jump visibly moves the operator’s legs');
  for(let i=0;i<70;i++)motion(1/30,false,0);
  for(const speed of [4,8]){
    const rotations=[];
    const knee=model.getObjectByName(gameplay.walk.tracks.find(track=>/(?:Left|Right)Leg[^.]*\.quaternion/i.test(track.name))?.name.split('.')[0]),kneeRotations=[];
    for(let i=0;i<35;i++){motion(1/30,true,speed);rotations.push(leg.quaternion.clone());const bottom=new THREE.Box3().setFromObject(model,true).min.y;assert(Math.abs(bottom)<.035,'boot soles stay within 3.5 cm of the floor: '+bottom);}
    assert(rotations.some(q=>q.angleTo(rotations[0])>.1),'legs change pose during '+(speed===4?'walk':'run'));
    if(knee){for(let i=0;i<30;i++){motion(1/30,true,speed);kneeRotations.push(knee.quaternion.clone());}assert(kneeRotations.some(q=>q.angleTo(kneeRotations[0])>.08),'knee bends during '+(speed===4?'walk':'run'));}
  }
  const strafeRotations=[];for(let i=0;i<25;i++){motion(1/30,true,4,{lateral:true});strafeRotations.push(leg.quaternion.clone());}
  assert(strafeRotations.some(q=>q.angleTo(strafeRotations[0])>.1),'sideways movement animates the legs');
  for(let i=0;i<15;i++)motion(1/30,false,0);
  const firingBones=gameplay.fireRifle.tracks.filter(track=>/(Arm|Shoulder)/i.test(track.name)).map(track=>model.getObjectByName(track.name.split('.')[0])).filter(Boolean);
  const firingPose=firingBones.map(bone=>bone.quaternion.clone()),standingLeg=leg.quaternion.clone();
  assert(motion.play('fireRifle',.65),'rifle firing starts on the operator');
  let visibleShot=false;for(let i=0;i<15;i++){motion(1/30,false,0);if(firingBones.some((bone,index)=>bone.quaternion.angleTo(firingPose[index])>.05))visibleShot=true;}
  assert(visibleShot,'rifle firing visibly moves the operator’s arms');
  assert(leg.quaternion.angleTo(standingLeg)<.01,'rifle firing leaves the planted legs alone');
  for(let i=0;i<20;i++)motion(1/30,false,0);
  assert(leg.quaternion.angleTo(idle)<.001,'stopping restores the standing pose');
  assert(gameplay.punch.tracks.every(track=>!/(Hips|Leg|Foot|Toe)/i.test(track.name)),'punch cannot lift the rear leg');
  const planted=leg.quaternion.clone();assert(motion.play('punch',.65));
  for(let i=0;i<8;i++)motion(1/30,false,0);
  assert(motion.handsBusy,'punch releases weapon arm IK');
  assert(leg.quaternion.angleTo(planted)<.01,'punch keeps the legs planted');
  for(let i=0;i<30;i++)motion(1/30,false,0);
  assert(!motion.handsBusy,'gun grip returns after punching');
  assert(gameplay.death?.tracks.length>20,'operator has a death animation');
  root.position.y=3;motion(1/30,false,0);assert(Math.abs(new THREE.Box3().setFromObject(model,true).min.y-3)<.035,'grounding follows the character elevation');
});
test('every mobile enemy has a working locomotion clip; stationary defenders do not translate',async()=>{
  await loadMonsterModels({loadAsync:url=>asset(decodeURIComponent(url.slice('/models/'.length)))});
  for(const [type,T]of Object.entries(MONSTER_TYPES)){
    const built=buildMonster(type),rig=built.group.userData.rig;
    if(T.stationary){assert.equal(T.speed,0,type);continue;}
    assert(!rig.mixer||rig.actions[T.clip],type+' has a locomotion action or procedural gait');
    const monster={...built,T,moving:true,shootAnim:0,attackAnim:0,flash:0,dead:false};
    const nodes=[];rig.inner.traverse(o=>{nodes.push({node:o,rotation:o.quaternion.clone(),position:o.position.clone()});});
    for(let i=0;i<12;i++)animateMonster(monster,1/30);
    assert(nodes.some(o=>o.rotation.angleTo(o.node.quaternion)>.03||o.position.distanceTo(o.node.position)>.01),type+' skeleton moves');
    if(rig.mixer)assert.equal(rig.cur,T.clip,type+' uses its locomotion clip');
    monster.moving=false;for(let i=0;i<12;i++)animateMonster(monster,1/30);
    if(rig.mixer)assert.equal(rig.cur,T.idle||'idleWgun',type+' returns to idle');
  }
});

test('orange-arm soldier and scanned monsters step with both feet and bend both knees when walking and running',async()=>{
  await loadMonsterModels({loadAsync:url=>asset(decodeURIComponent(url.slice('/models/'.length)))});
  for(const type of ['sniper','demon','brute']){
    const built=buildMonster(type),rig=built.group.userData.rig;
    const monster={...built,T:MONSTER_TYPES[type],moving:true,shootAnim:0,attackAnim:0,flash:0,dead:false};
    for(const running of [false,true]){
      monster.running=running;
      const samples={l:[],r:[]},knees={l:[],r:[]};
      for(let frame=0;frame<50;frame++){
        animateMonster(monster,1/30);built.group.updateMatrixWorld(true);
        for(const side of ['l','r']){
          let foot,knee;rig.inner.traverse(o=>{if(o.isBone&&new RegExp('^foot_'+side+'(?:_|$)').test(o.name))foot=o;if(o.isBone&&new RegExp('^calf_'+side+'(?:_|$)').test(o.name))knee=o;});
          assert(foot&&knee,type+' has both leg chains');
          samples[side].push(foot.getWorldPosition(new THREE.Vector3()).z);knees[side].push(knee.quaternion.clone());
        }
      }
      assert.equal(rig.cur,running?(rig.actions.fastRun?'fastRun':'run'):'walk');
      for(const side of ['l','r']){
        assert(Math.max(...samples[side])-Math.min(...samples[side])>.12,type+' '+side+' foot steps forwards and backwards');
        assert(knees[side].some(q=>q.angleTo(knees[side][0])>.2),type+' '+side+' knee bends');
      }
      assert(samples.l.some((z,i)=>Math.abs(z-samples.r[i])>.12),type+' feet alternate instead of hopping together');
    }
  }
});

test('enemy deaths touch the floor immediately, settle, and stay visible',async()=>{
  await loadMonsterModels({loadAsync:url=>asset(decodeURIComponent(url.slice('/models/'.length)))});
  for(const type of ['grunt','sniper','brute','boss','drone']){
    const built=buildMonster(type),rig=built.group.userData.rig;
    const m={...built,T:MONSTER_TYPES[type],moving:false,shootAnim:0,attackAnim:0,flash:0,dead:true,deadT:0,y:0};
    animateMonster(m,.016);built.group.updateMatrixWorld(true);
    assert(Math.abs(new THREE.Box3().setFromObject(rig.inner,true).min.y)<.025,type+' touches floor on first death frame');
    for(let frame=0;frame<100;frame++){m.deadT+=.05;animateMonster(m,.05);}
    built.group.updateMatrixWorld(true);assert(rig.corpseSettled,type+' stops animating');
    assert(Math.abs(new THREE.Box3().setFromObject(rig.inner,true).min.y)<.025,type+' corpse lies on floor');
    const position=built.group.position.clone();m.deadT=30;animateMonster(m,25);
    assert(built.group.visible);assert(built.group.position.equals(position),type+' corpse does not sink away');
  }
});


