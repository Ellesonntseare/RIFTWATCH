import * as THREE from 'three';

// Follow real sole vertices instead of ankle pivots, which sit above the floor.
// Sample once at load time; only a few dozen vertices are skinned per frame.
export function createFootGrounding(model,root){
  root.updateMatrixWorld(true);
  const buckets=new Map(),point=new THREE.Vector3();
  model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.visible)return;
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
    if(!position||!skinIndex||!skinWeight)return;
    const feet=new Map(mesh.skeleton.bones.map((bone,i)=>[i,/left.*(foot|toe)/i.test(bone.name)?'left':/right.*(foot|toe)/i.test(bone.name)?'right':null]));
    for(let i=0;i<position.count;i++){
      let side=null,weight=0;
      for(let j=0;j<4;j++){const candidate=feet.get(skinIndex.getComponent(i,j)),w=skinWeight.getComponent(i,j);if(candidate&&w>weight){side=candidate;weight=w;}}
      if(!side||weight<.35)continue;
      mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);
      const key=mesh.uuid+side;if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push({mesh,index:i,y:point.y,point:point.clone()});
    }
  });
  const samples=[];
  for(const candidates of buckets.values()){
    const bottom=Math.min(...candidates.map(v=>v.y)),sole=candidates.filter(v=>v.y<=bottom+.025);
    for(let i=0;i<Math.min(32,sole.length);i++)samples.push(sole[Math.floor(i*sole.length/Math.min(32,sole.length))]);
    // Include toe/heel extremes: tilted boots can contact the ground at a
    // vertex that was above the sole in the initial standing pose.
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      if(!x&&!y&&!z)continue;let best=candidates[0],score=-Infinity;
      for(const v of candidates){const dot=v.point.x*x+v.point.y*y+v.point.z*z;if(dot>score){score=dot;best=v;}}
      if(!samples.includes(best))samples.push(best);
    }
  }
  if(!samples.length)return ()=>{};
  const lowest=()=>{let y=Infinity;for(const s of samples){s.mesh.getVertexPosition(s.index,point);point.applyMatrix4(s.mesh.matrixWorld);y=Math.min(y,point.y);}return y;};
  const offset=lowest()-root.getWorldPosition(point).y;
  return ()=>{
    root.updateMatrixWorld(true);
    const ground=root.getWorldPosition(point).y;
    model.position.y-=lowest()-ground-offset;
    root.updateMatrixWorld(true);
  };
}
