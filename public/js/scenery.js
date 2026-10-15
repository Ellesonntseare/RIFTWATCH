import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const cache = new Map();
export async function prop(file, height) {
  if (!cache.has(file)) cache.set(file, new GLTFLoader().loadAsync('/models/' + file));
  const gltf = await cache.get(file), object = gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = height / size.y, group = new THREE.Group();
  object.scale.multiplyScalar(scale); object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(object); return group;
}

function sign(text, sub) {
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#10272b';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#a4ffe1';ctx.fillRect(0,0,15,256);ctx.font='bold 64px sans-serif';ctx.fillText(text,50,110);ctx.fillStyle='#b2c8c6';ctx.font='30px monospace';ctx.fillText(sub,50,178);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(4.5,1.12,.1),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));mesh.position.y=2.1;
  const group=new THREE.Group();group.add(mesh);
  for(const x of [-1.8,1.8]) {const post=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,2.3,6),new THREE.MeshStandardMaterial({color:0x56686b}));post.position.set(x,1.15,0);group.add(post);}
  return group;
}

export async function dressMap(state, floorAt, buildCollision) {
  const group=new THREE.Group(); group.name='RIFTWATCH field architecture'; state.world.add(group);
  const add=async(file,height,x,z,rotation=0,solid=true)=>{
    const ground=state.collMesh ? floorAt(x,z,(state.map.startY||0)+0.6,2) : 0;
    if(ground===null) return;
    try { const p=await prop(file,height);p.position.set(x,ground,z);p.rotation.y=rotation;if(!solid)p.traverse(o=>{if(o.isMesh)o.userData.dynamic=true;});group.add(p);return p; }
    catch(e){console.warn('Scenery unavailable:',file,e.message);}
  };
  if(state.mapKey==='island'){
    const rabbits=await Promise.all([
      add('office_is_old_abandoned_free.glb',3.7,105,70,Math.PI/3),
      add('old_gun_cabinet_with_animations.glb',1.9,19,14,Math.PI/2),
      add('rabbit_-_realistic_3d_model_demo_free.glb',.65,-25,-38,.7,false),
      add('rabbit_-_realistic_3d_model_demo_free.glb',.65,42,-48,2.4,false),
      add('rabbit_-_realistic_3d_model_demo_free.glb',.65,-70,62,1.2,false),
    ]);
    state.wildlife=rabbits.slice(2).filter(Boolean).map((object,i)=>({object,y:object.position.y,phase:i*2.1}));
  }else if(state.mapKey==='outpost') {
    await Promise.all([
      add('office_is_old_abandoned_free.glb',3.65,-17,48,Math.PI/2),
      add('office_is_old_abandoned_free.glb',3.65,18,52,-Math.PI/2),
      add('office_is_old_abandoned_free.glb',3.65,-22,15,Math.PI),
      add('new_york_hot_dog_cart.glb',2.03,7,59,Math.PI/2),
      add('old_gun_cabinet_with_animations.glb',2.0,-7,64,Math.PI/2),
    ]);
    const marker=sign('FORWARD BASE','HERO DIVISION / SECTOR 01');marker.position.set(-7,0,74);group.add(marker);
    const checkpoint=sign('OLD QUARTER','NORTH ROUTE / HOSTILE TERRITORY');checkpoint.position.set(8,0,12);group.add(checkpoint);
    // Lane markings and sidewalks establish human scale along the main route.
    const paint=new THREE.MeshStandardMaterial({color:0xc8c7a5,roughness:1});
    for(let z=-90;z<90;z+=9) {const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.12,3.5),paint);stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.035,z);group.add(stripe);}
    for(const x of [-5.5,5.5]) {const curb=new THREE.Mesh(new THREE.BoxGeometry(1,.12,190),new THREE.MeshStandardMaterial({color:0x767d77,roughness:1}));curb.position.set(x,.06,0);group.add(curb);}
  } else if(!state.map.open) {
    await add('old_gun_cabinet_with_animations.glb',1.95,state.mapKey==='yard' ? -5 : 3,state.mapKey==='yard' ? 23 : 3,Math.PI/2);
  } else {
    // Place small supplied props only on flat clear ground; never drop a building on a street.
    const sx=state.map.start[0],sz=state.map.start[1],sy=state.map.startY||0;
    const spots=[];
    for(let i=0;i<60&&spots.length<3;i++) {
      const a=i*2.39996,r=7+(i%5)*2,x=sx+Math.cos(a)*r,z=sz+Math.sin(a)*r;
      const heights=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>floorAt(x+dx,z+dz,sy+.6,2));
      if(heights.some(y=>y===null || Math.abs(y-sy)>.18)||spots.some(p=>Math.hypot(p[0]-x,p[1]-z)<5)) continue;
      spots.push([x,z]);
    }
    const files=[['new_york_hot_dog_cart.glb',2.03],['old_gun_cabinet_with_animations.glb',1.95],['old_gun_cabinet_with_animations.glb',1.95]];
    await Promise.all(spots.map(([x,z],i)=>add(...files[i],x,z,Math.atan2(sx-x,sz-z))));
  }
  state.world.updateMatrixWorld(true);
  if(state.map.open) { state.extraCollMesh=buildCollision(group);state.wallMeshes.push(state.extraCollMesh); }
  else {
    // Procedural arenas already have collision boxes. Rebuilding a BVH from every
    // tree, prop and floor triangle can stall deployment on slower devices.
    state.wallMeshes.push(group);
    state.map.startY=0;state.minY=-30;
  }
}
