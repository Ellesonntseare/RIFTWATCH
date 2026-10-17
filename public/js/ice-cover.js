import * as THREE from 'three';
export function createIceCover(state){
 let frost=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#6c9ba9';ctx.fillRect(0,0,256,256);
  let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1800;i++){const x=random()*256,y=random()*256,r=1+random()*12;ctx.fillStyle='rgba(222,250,255,'+(random()*.08)+')';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<14;i++){let x=random()*256,y=random()*256;ctx.strokeStyle='rgba(235,255,255,.55)';ctx.lineWidth=.6+random();ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=(random()-.5)*38;y+=12+random()*22;ctx.lineTo(x,y);}ctx.stroke();}
  frost=new THREE.CanvasTexture(canvas);frost.colorSpace=THREE.SRGBColorSpace;frost.wrapS=frost.wrapT=THREE.RepeatWrapping;frost.repeat.set(.55,.55);
 }
 const walls=[],cooldowns=new Map(),shards=[];let sequence=0,preview=null;
 const shardGeo=new THREE.IcosahedronGeometry(.12,0),shardMat=new THREE.MeshStandardMaterial({color:0x9ce8ff,roughness:.2,metalness:.2});
 function shatter(w){for(let i=0;i<12;i++){if(shards.length>=48)break;const mesh=new THREE.Mesh(shardGeo,shardMat);mesh.position.set(w.x+(Math.random()-.5)*4,w.y+.5+Math.random()*1.4,w.z);state.world.add(mesh);shards.push({mesh,v:new THREE.Vector3((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*5),life:.8});}}
 function cracks(w){const damage=1-w.hp/300;for(const mesh of w.meshes){mesh.material.emissiveIntensity=.35+damage*.6;const lines=mesh.children[0];if(lines)lines.material.opacity=.34+damage*.66;}if(w.crackLines)w.crackLines.visible=damage>.25;}

 function remove(w){w.root.removeFromParent();for(const mesh of w.meshes){const i=state.wallMeshes.indexOf(mesh);if(i>=0)state.wallMeshes.splice(i,1);mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}w.crackLines?.geometry.dispose();w.crackLines?.material.dispose();const index=walls.indexOf(w);if(index>=0)walls.splice(index,1);}
 function add(data){
  const root=new THREE.Group(),meshes=[];root.position.set(data.x,data.y,data.z);root.rotation.y=data.yaw;
  // Seven interlocking, bevelled crystal plates with uneven frost crowns.
  for(let i=0;i<7;i++){
   const h=2.05+Math.sin(i*2.1)*.22,shape=new THREE.Shape();shape.moveTo(-.39,0);shape.lineTo(.39,0);shape.lineTo(.40,h-.24);shape.lineTo(.12,h+.12);shape.lineTo(-.28,h-.04);shape.lineTo(-.39,h-.32);shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.10,bevelThickness:.08});
   const mat=new THREE.MeshStandardMaterial({transparent:!!data.preview,opacity:data.preview?.28:1,map:frost,bumpMap:frost,bumpScale:.08,color:i%2?0x85d1e2:0xb6edf1,metalness:.25,roughness:.23,emissive:0x123e51,emissiveIntensity:.35,flatShading:true});
   const mesh=new THREE.Mesh(geo,mat);mesh.position.set((i-3)*.65,0,-.24+Math.abs(i-3)*.065);root.add(mesh);meshes.push(mesh);mesh.userData.iceId=data.id;if(!data.preview)state.wallMeshes.push(mesh);else mesh.raycast=()=>{};
   const seams=new THREE.LineSegments(new THREE.EdgesGeometry(geo,28),new THREE.LineBasicMaterial({color:0xe2ffff,transparent:true,opacity:.34}));seams.raycast=()=>{};mesh.add(seams);
  }
  const points=[];for(let i=0;i<7;i++){const x=(i-3)*.65;points.push(x-.2,.5,.42,x+.12,1.0,.42,x+.12,1,.42,x-.16,1.55,.42,x-.16,1.55,.42,x+.2,1.95,.42,x+.12,1,.42,x+.33,.82,.42);}
  const crackLines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.LineBasicMaterial({color:0x19495d}));crackLines.visible=false;crackLines.raycast=()=>{};root.add(crackLines);
  state.world.add(root);const w={hp:300,...data,root,meshes,crackLines,age:0};if(!data.preview)walls.push(w);root.updateMatrixWorld(true);cracks(w);return w;
 }
 return {walls,
  damage(id,amount){const w=walls.find(w=>w.id===id);if(!w||!Number.isFinite(amount)||amount<=0)return false;w.hp=Math.max(0,w.hp-amount);cracks(w);if(!w.hp){shatter(w);remove(w);}return true;},
  preview(pos,yaw,valid){if(!pos){if(preview)preview.root.visible=false;return;}if(!preview)preview=add({x:pos.x,y:pos.y,z:pos.z,yaw,preview:true});preview.root.visible=true;preview.root.position.copy(pos);preview.root.rotation.y=yaw;for(const mesh of preview.meshes)mesh.material.color.setHex(valid?0x80f7cf:0xff5656);},
  deploy(pos,yaw,owner,time){if(time-(cooldowns.get(owner)??-Infinity)<25||walls.length>=8)return false;cooldowns.set(owner,time);add({id:++sequence,x:pos.x,y:pos.y,z:pos.z,yaw,left:18});return true;},
  remaining(owner,time){return Math.max(0,25-(time-(cooldowns.get(owner)??-Infinity)));},
  update(dt){for(let i=shards.length-1;i>=0;i--){const s=shards[i];s.life-=dt;if(s.life<=0){s.mesh.removeFromParent();shards.splice(i,1);continue;}s.v.y-=12*dt;s.mesh.position.addScaledVector(s.v,dt);s.mesh.rotation.x+=dt*4;s.mesh.rotation.z+=dt*3;}for(const w of [...walls]){w.left-=dt;w.age+=dt;if(w.left<=0){shatter(w);remove(w);continue;}w.root.scale.y=Math.min(1,w.age/.42);w.root.updateMatrixWorld(true);}},
  resolve(pos,r,y){for(const w of walls){if(y>w.y+2.4||y+2<w.y)continue;const c=Math.cos(w.yaw),s=Math.sin(w.yaw),dx=pos.x-w.x,dz=pos.z-w.z;let x=c*dx-s*dz,z=s*dx+c*dz;const a=2.5+r,b=.62+r;if(Math.abs(x)>=a||Math.abs(z)>=b)continue;if(a-Math.abs(x)<b-Math.abs(z))x=Math.sign(x||1)*a;else z=Math.sign(z||1)*b;pos.x=w.x+c*x+s*z;pos.z=w.z-s*x+c*z;}},
  snapshot(){return walls.map(({id,x,y,z,yaw,left,hp})=>({id,x,y,z,yaw,left,hp}));},
  apply(data=[]){const ids=new Set(data.map(w=>w.id));for(const w of [...walls])if(!ids.has(w.id)){shatter(w);remove(w);}for(const d of data){const w=walls.find(w=>w.id===d.id);if(w){w.left=d.left;w.hp=d.hp??300;cracks(w);}else add(d);}},
  reset(){for(const w of [...walls])remove(w);if(preview){remove(preview);preview=null;}for(const s of shards)s.mesh.removeFromParent();shards.length=0;cooldowns.clear();}
 };
}
