import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { HEROES,selectedHero } from './roster.js';
import { buildPersonalHead } from './personal-head.js';
import {heroMotionClips,createHeroMotion} from './hero-motion.js';
import {createHeroWeapon} from './hero-weapon.js';
import {createBlobShadow} from './monsters.js';
const templates=new Map();let faceTexture;
export async function loadHero(file='MAIN HERO.glb') {
  if(!templates.has(file))templates.set(file,new GLTFLoader().loadAsync('/models/'+file));
  faceTexture ||= new THREE.TextureLoader().loadAsync('/assets/hero-face.png');
  return Promise.all([templates.get(file),faceTexture]);
}
export function selectedSkin() { return selectedHero().id; }
export async function buildHero(skin=selectedSkin(),options={}) {
  const config=HEROES.find(h=>h.id===skin)||HEROES[0];
  const [gltf,texture]=await loadHero(config.file),root=new THREE.Group(),model=SkeletonUtils.clone(gltf.scene);
  const discard=[];model.traverse(o=>{if(o.isMesh && /floor/i.test(o.name))discard.push(o);});for(const o of discard)o.removeFromParent();
  root.add(model);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const scale=1.8/(model.userData.referenceHeight||size.y);model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);root.updateMatrixWorld(true);
  let bone;
  model.traverse(o=>{
    if(o.isBone && /Head_\d+$/.test(o.name)) bone=o;
    if(!o.isMesh)return;
    o.castShadow=true;o.frustumCulled=false;
    const names=(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.name);
    if(skin==='personal' && names.some(n=>['helmet','face','eyes','mask','night_vis_goggles'].includes(n)))o.visible=false;
  });
  if(skin==='personal') {
    const head=await buildPersonalHead(texture);head.scale.setScalar(.92);
    root.add(head);root.updateMatrixWorld(true);
    const base=bone ? bone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0,1.56,0);
    head.position.set(base.x,1.625,base.z-.01);root.updateMatrixWorld(true);
    if(bone)bone.attach(head);
    model.traverse(o=>{if(!o.isMesh || head.getObjectById(o.id))return;const wasArray=Array.isArray(o.material),arr=wasArray?o.material:[o.material];const materials=arr.map(m=>{const material=m.clone();if(['uniform','pouch','boots','gloves'].includes(m.name)&&material.color)material.color.multiplyScalar(.66);return material;});o.material=wasArray?materials:materials[0];});
  }
  if(options.preview){
    let motion=null,requested=false;
    return {root,update(dt,moving=false,speed=0){
      if(moving&&!requested){requested=true;heroMotionClips(config.file,gltf.scene).then(clips=>{motion=createHeroMotion(model,root,clips);}).catch(e=>console.warn('Preview animation',e));}
      if(motion)motion(dt,moving,speed);
    }};
  }
  const clips=await heroMotionClips(config.file,gltf.scene),motion=createHeroMotion(model,root,clips),weapon=await createHeroWeapon(root,model);root.add(createBlobShadow(.6));
  return {root,update(dt,moving=false,speed=0,weaponIndex=0,pitch=0){motion(dt,moving,speed);weapon.update(dt,weaponIndex,pitch);},muzzle:()=>weapon.muzzle(),flash:()=>weapon.flash(),skin};
}
