import * as THREE from 'three';
const indicesCache=new WeakMap();
// Sample the surface during a fall; take one exact bound when the body settles.
export function createCorpseGrounding(model,root){
  const samples=[],p=new THREE.Vector3(),box=new THREE.Box3();
  model.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible)return;
    const geometry=mesh.geometry,positions=geometry.attributes.position;if(!positions)return;
    let indices=indicesCache.get(geometry);
    if(!indices){
      indices=new Set();for(let i=0;i<64;i++)indices.add(Math.floor(i*positions.count/64));
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
        let best=0,value=-Infinity;for(let i=0;i<positions.count;i++){const v=positions.getComponent(i,axis)*sign;if(v>value){value=v;best=i;}}indices.add(best);
      }
      indicesCache.set(geometry,indices);
    }
    for(const index of indices)samples.push({mesh,index});
  });
  return (floor,settled=false)=>{
    root.updateMatrixWorld(true);let lowest=Infinity;
    if(settled){box.makeEmpty();model.traverse(mesh=>{if(mesh.isMesh&&mesh.visible)box.expandByObject(mesh,true);});lowest=box.min.y;}
    else for(const {mesh,index}of samples){mesh.getVertexPosition(index,p);p.applyMatrix4(mesh.matrixWorld);lowest=Math.min(lowest,p.y);}
    if(Number.isFinite(lowest)){root.position.y+=floor-lowest;root.updateMatrixWorld(true);}
  };
}
