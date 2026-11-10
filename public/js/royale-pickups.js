import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

let armorPromise;
export async function prepareRoyalePickups(rifle){
  armorPromise ||= new GLTFLoader().loadAsync('/models/modern_tactical_vest__plate_carrier.glb').catch(error=>{armorPromise=null;throw error;});
  return createRoyalePickupFactory(rifle,(await armorPromise).scene);
}

// Merge authored supply details by material; every pickup shares these resources.
function supplyModel(medical){
  const parts=new Map(),root=new THREE.Group();
  function part(geometry,color,x,y,z){geometry.translate(x,y,z);const key=String(color);if(!parts.has(key))parts.set(key,[]);parts.get(key).push(geometry);}
  const box=(w,h,d,color,x,y,z)=>part(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.1),color,x,y,z);
  if(medical){
    box(.48,.55,.18,0x72705a,0,.3,0);
    for(const x of [-.17,.17])box(.06,.43,.035,0x303b33,x,.3,.11);
    for(const y of [.16,.32])box(.32,.09,.05,0x545946,0,y,.12);
    box(.19,.19,.025,0x252e29,0,.47,.12);
    box(.04,.14,.015,0xc54944,0,.47,.14);box(.14,.04,.015,0xc54944,0,.47,.14);
    box(.25,.035,.035,0x2a3028,0,.585,0);
  }else{
    box(.52,.29,.32,0x4d6040,0,.15,0);box(.57,.045,.36,0x637249,0,.32,0);
    for(const x of [-.18,0,.18])box(.025,.23,.025,0x374b30,x,.15,.17);
    box(.18,.035,.035,0x222b24,0,.2,.19);
    for(let i=0;i<7;i++){
      const x=-.2+i*.065;part(new THREE.CylinderGeometry(.022,.022,.14,6),0xc3a257,x,.42,0);
      part(new THREE.ConeGeometry(.022,.045,6),0x996b40,x,.512,0);
    }
  }
  for(const [color,geometries] of parts){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());root.add(new THREE.Mesh(merged,new THREE.MeshStandardMaterial({color:Number(color),roughness:.72,metalness:medical?.08:.45})));}
  return root;
}
function normalized(source,length){
  const object=source.clone(true);object.visible=true;
  object.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(length/Math.max(size.x,size.y,size.z));object.updateMatrixWorld(true);
  const scaled=new THREE.Box3().setFromObject(object),center=scaled.getCenter(new THREE.Vector3());object.position.add(new THREE.Vector3(-center.x,-scaled.min.y,-center.z));
  const group=new THREE.Group();group.add(object);return group;
}
export function createRoyalePickupFactory(rifle,armor){
  const templates={rifle:normalized(rifle,.8),smg:normalized(rifle,.62),armor:normalized(armor,.64),med:supplyModel(true),ammo:supplyModel(false)};
  const ringGeometry=new THREE.TorusGeometry(.42,.015,4,24);ringGeometry.rotateX(Math.PI/2);
  const colors={rifle:0xe9c276,smg:0xe9c276,armor:0x67b5e4,med:0x7bde9d,ammo:0xf1d887};
  const rings=Object.fromEntries(Object.entries(colors).map(([kind,color])=>[kind,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false})]));
  return kind=>{
    if(!templates[kind])throw Error('Unknown royale pickup: '+kind);
    const root=new THREE.Group();root.name='royale-pickup-'+kind;
    const model=templates[kind].clone(true);model.position.y=.08;root.add(model);
    const ring=new THREE.Mesh(ringGeometry,rings[kind]);ring.position.y=.025;root.add(ring);
    root.userData.sharedPickup=true;return root;
  };
}
