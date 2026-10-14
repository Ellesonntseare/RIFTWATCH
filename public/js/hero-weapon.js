import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createWeaponGrip} from './arm-ik.js';
const files=['low-poly_colt_m4a1.glb','chg_laser_machine_gun.glb'];
let templates;
export async function createHeroWeapon(root,model){
  templates ||= Promise.all(files.map(file=>new GLTFLoader().loadAsync('/models/'+file)));
  const loaded=await templates,mount=new THREE.Group(),muzzles=[],grips=[];
  for(let i=0;i<loaded.length;i++){
    const gun=loaded[i].scene.clone(true);gun.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(gun),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    let stock,barrel;gun.traverse(o=>{if(/stock/i.test(o.name))stock=o;if(/barrel|muzzle|flash.hider/i.test(o.name))barrel=o;});
    const axis=size.x>=size.z?'x':'z',front=barrel?new THREE.Box3().setFromObject(barrel).getCenter(new THREE.Vector3())[axis]:stock?center[axis]*2-new THREE.Box3().setFromObject(stock).getCenter(new THREE.Vector3())[axis]:center[axis]+1;
    const direction=new THREE.Vector3();direction[axis]=Math.sign(front-center[axis])||1;
    gun.quaternion.setFromUnitVectors(direction,new THREE.Vector3(0,0,1));gun.updateMatrixWorld(true);
    gun.scale.multiplyScalar((i===0?.75:.6)/new THREE.Box3().setFromObject(gun).getSize(new THREE.Vector3()).z);gun.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gun),c=box.getCenter(new THREE.Vector3());gun.position.sub(c);
    const group=new THREE.Group();group.add(gun);group.visible=i===0;mount.add(group);
    muzzles.push(new THREE.Vector3(0,(box.max.y-c.y)*.3,box.max.z-c.z));
    gun.updateMatrixWorld(true);let trigger,foreend;
    gun.traverse(o=>{if(/(?:^|[ _])grip[ _]|LaserMchGun_Handle/i.test(o.name))trigger=o;if(/handguard/i.test(o.name))foreend=o;});
    const right=trigger?new THREE.Box3().setFromObject(trigger).getCenter(new THREE.Vector3()):new THREE.Vector3(0,-.065,-.07);
    const left=foreend?new THREE.Box3().setFromObject(foreend).getCenter(new THREE.Vector3()):new THREE.Vector3(0,0,.14);
    right.y+=.055;left.y-=.035;left.z-=.03;grips.push({right,left});
  }
  root.add(mount);
  const light=new THREE.PointLight(0xffcc8a,0,2);mount.add(light);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xffdd99}));mount.add(flash);flash.visible=false;
  model.traverse(o=>{if(o.isMesh&&/^Object_14[2-6]$/.test(o.name))o.visible=false;});
  const grip=createWeaponGrip(model,root),baseY=model.position.y;
  let selected=0,flashTime=0;
  const position=new THREE.Vector3();
  return {
    update(dt,weapon=0,pitch=0){selected=weapon===1?1:0;mount.children.slice(0,2).forEach((g,i)=>g.visible=i===selected);mount.position.set(-.15,1.31+model.position.y-baseY,.32);mount.rotation.x=-pitch;root.updateMatrixWorld(true);const right=grips[selected].right.clone().applyQuaternion(mount.quaternion).add(mount.position),left=grips[selected].left.clone().applyQuaternion(mount.quaternion).add(mount.position);grip(right,left,pitch);flashTime=Math.max(0,flashTime-dt);flash.position.copy(muzzles[selected]);light.position.copy(flash.position);flash.visible=flashTime>0;light.intensity=flash.visible?1.5:0;root.updateMatrixWorld(true);},
    muzzle(){return mount.localToWorld(muzzles[selected].clone());},
    flash(){flashTime=.055;}
  };
}
