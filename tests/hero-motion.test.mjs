import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {heroMotionClips,createHeroMotion} from '../public/js/hero-motion.js';
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

async function asset(name){const delivery='models/web/'+name;const file=process.env.RIFTWATCH_WEB_MODELS==='1'&&await fs.access(delivery).then(()=>true,()=>false)?delivery:'models/'+name;const bytes=await fs.readFile(file),loader=new GLTFLoader();loader.register(()=>({name:'GeometryOnlyTest',loadTexture:()=>Promise.resolve(new THREE.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const soldier=await asset('futuristic_soldier_free.glb');
for(const hero of HEROES)test((hero.role||hero.name)+' walks, runs, stops and keeps boot soles on the ground',async()=>{
  const template=await asset(hero.file);const clips=await heroMotionClips(hero.file,template.scene,soldier);
  assert(clips.walk?.tracks.length>=6,'retargeted walking leg tracks exist');assert(clips.run?.tracks.length>=6);
  const model=clone(template.scene),discard=[];model.traverse(o=>{if(o.isMesh&&/floor/i.test(o.name))discard.push(o);});discard.forEach(o=>o.removeFromParent());
  const root=new THREE.Group();root.add(model);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),scale=1.8/(box.max.y-box.min.y);model.scale.multiplyScalar(scale);model.position.y=-box.min.y*scale;root.updateMatrixWorld(true);
  const leg=model.getObjectByName(clips.walk.tracks[0].name.split('.')[0]),idle=leg.quaternion.clone();
  const motion=createHeroMotion(model,root,clips);
  for(const speed of [4,8]){
    const rotations=[];
    for(let i=0;i<35;i++){motion(1/30,true,speed);rotations.push(leg.quaternion.clone());const bottom=new THREE.Box3().setFromObject(model,true).min.y;assert(Math.abs(bottom)<.035,'boot soles stay within 3.5 cm of the floor: '+bottom);}
    assert(rotations.some(q=>q.angleTo(rotations[0])>.1),'legs change pose during '+(speed===4?'walk':'run'));
  }
  for(let i=0;i<15;i++)motion(1/30,false,0);
  assert(leg.quaternion.angleTo(idle)<.001,'stopping restores the standing pose');
  root.position.y=3;motion(1/30,false,0);assert(Math.abs(new THREE.Box3().setFromObject(model,true).min.y-3)<.035,'grounding follows the character elevation');
});
test('every mobile enemy has a working locomotion clip; stationary defenders do not translate',async()=>{
  await loadMonsterModels({loadAsync:url=>asset(decodeURIComponent(url.slice('/models/'.length)))});
  for(const [type,T]of Object.entries(MONSTER_TYPES)){
    const built=buildMonster(type),rig=built.group.userData.rig;
    if(T.stationary){assert.equal(T.speed,0,type);continue;}
    assert(rig.actions[T.clip],type+' has a locomotion action');
    const monster={...built,T,moving:true,shootAnim:0,attackAnim:0,flash:0,dead:false};
    const nodes=[];rig.inner.traverse(o=>{nodes.push({node:o,rotation:o.quaternion.clone(),position:o.position.clone()});});
    for(let i=0;i<12;i++)animateMonster(monster,1/30);
    assert(nodes.some(o=>o.rotation.angleTo(o.node.quaternion)>.03||o.position.distanceTo(o.node.position)>.01),type+' skeleton moves');
    assert.equal(rig.cur,T.clip,type+' uses its locomotion clip');
    monster.moving=false;for(let i=0;i<12;i++)animateMonster(monster,1/30);
    assert.equal(rig.cur,T.idle||'idleWgun',type+' returns to idle');
  }
});


