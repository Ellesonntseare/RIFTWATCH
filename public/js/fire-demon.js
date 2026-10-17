import * as THREE from 'three';
// Keep the original flame torso; remove its sculpted pedestal and add two legs.
export function giveDemonLegs(source){
 source.rotation.y-=Math.PI/2;source.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),c=bounds.getCenter(new THREE.Vector3()),floor=bounds.min.y,cut=floor+size.y*.43;
 const root=new THREE.Group();
 source.traverse(m=>{if(!m.isMesh)return;const g=m.geometry.clone().applyMatrix4(m.matrixWorld),a=g.attributes.position,indices=[];
 for(let i=0;i<(g.index?.count||a.count);i+=3){const ids=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k);if(ids.every(j=>a.getY(j)>=cut))indices.push(...ids);}
 g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();root.add(new THREE.Mesh(g,m.material));});
 const armor=new THREE.MeshStandardMaterial({color:0x3a1116,metalness:.6,roughness:.5}),lava=new THREE.MeshStandardMaterial({color:0xe83716,emissive:0xff3008,emissiveIntensity:.9});
 for(const side of [-1,1]){const x=c.x+side*size.x*.105;
 const limb=(y,h,r1,r2,z=0)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,6),armor);m.position.set(x,y,c.z+z);root.add(m);};
 limb(floor+size.y*.32,size.y*.24,size.x*.075,size.x*.055);
 limb(floor+size.y*.115,size.y*.20,size.x*.06,size.x*.04);
 const knee=new THREE.Mesh(new THREE.IcosahedronGeometry(size.x*.064,0),lava);knee.position.set(x,floor+size.y*.22,c.z+size.z*.045);root.add(knee);
 const foot=new THREE.Mesh(new THREE.BoxGeometry(size.x*.12,size.y*.055,size.z*.26),armor);foot.position.set(x,floor+size.y*.0275,c.z+size.z*.055);root.add(foot);
 }
 return root;
}
