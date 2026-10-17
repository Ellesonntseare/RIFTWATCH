import * as THREE from 'three';

// Bend in the character's forward plane, not each imported bone's arbitrary X axis.
export function legClips(scene) {
  scene.updateMatrixWorld(true);
  const joints = [];
  scene.traverse(bone => {
    if (!bone.isBone) return;
    const match = /^(thigh|calf|foot)_([lr])(?:_|$)/i.exec(bone.name);
    if (match) joints.push({bone, part:match[1], side:match[2], rest:bone.quaternion.clone(),
      axis:new THREE.Vector3(1,0,0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert())});
  });
  if (joints.length !== 6) return [];
  return [['walk',1.05,.38,.65],['run',.68,.68,1.05],['idleWgun',1,0,0]].map(([name,duration,stride,bend]) => {
    const tracks=joints.map(({bone,part,side,rest,axis})=>{
      const times=[],values=[];
      for(let i=0;i<=16;i++) {
        const phase=i/16*Math.PI*2+(side==='r'?Math.PI:0);
        const thigh=-Math.sin(phase)*stride;
        const knee=Math.max(0,Math.cos(phase))*bend;
        const angle=part==='thigh'?thigh:part==='calf'?knee:-thigh*.4-knee*.55;
        times.push(i/16*duration);
        values.push(...rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,angle)).toArray());
      }
      return new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,values);
    });
    return new THREE.AnimationClip(name,duration,tracks);
  });
}

// The scanned monsters have no skeleton. Bind their existing vertices to two
// three-joint legs once during loading; animation then runs on the GPU.
export function rigStaticBiped(source,{turn=0,hip=.47,knee=.24,ankle=.07,base=0}={}) {
  source.rotation.y+=turn;source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const root=new THREE.Group(),pelvis=new THREE.Bone();pelvis.name='gait_root';root.add(pelvis);
  const bones=[pelvis];
  for(const [side,sign] of [['l',1],['r',-1]]) {
    const thigh=new THREE.Bone(),calf=new THREE.Bone(),foot=new THREE.Bone();
    thigh.name='thigh_'+side;calf.name='calf_'+side;foot.name='foot_'+side;
    thigh.position.set(center.x+sign*size.x*.16,bounds.min.y+size.y*hip,center.z);
    calf.position.y=size.y*(knee-hip);foot.position.y=size.y*(ankle-knee);
    pelvis.add(thigh);thigh.add(calf);calf.add(foot);bones.push(thigh,calf,foot);
  }
  root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
  source.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),p=geometry.attributes.position;
    const indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
    for(let i=0;i<p.count;i++) {
      const y=(p.getY(i)-bounds.min.y)/size.y,side=p.getX(i)>=center.x?1:4;
      let a=0,b=side,w=THREE.MathUtils.smoothstep(y,hip-.08,hip+.07);
      if(y<hip-.08){a=side;b=side+1;w=1-THREE.MathUtils.smoothstep(y,knee-.06,knee+.06);}
      else w=1-w;
      if(y<knee-.06){a=side+1;b=side+2;w=1-THREE.MathUtils.smoothstep(y,ankle-.025,ankle+.035);}
      if(y<base){a=0;b=0;w=0;} // baked pedestal stays on the ground
      // Blend the centre seam so a continuous skirt/loincloth cannot tear
      // when the left and right legs move in opposite directions.
      const blend=.5+.5*THREE.MathUtils.smoothstep(Math.abs(p.getX(i)-center.x),0,size.x*.065);
      const other=index=>index===0?0:index<=3?index+3:index-3;
      indices[i*4]=a;indices[i*4+1]=b;indices[i*4+2]=other(a);indices[i*4+3]=other(b);
      weights[i*4]=(1-w)*blend;weights[i*4+1]=w*blend;
      weights[i*4+2]=(1-w)*(1-blend);weights[i*4+3]=w*(1-blend);
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const skinned=new THREE.SkinnedMesh(geometry,mesh.material);skinned.name=mesh.name;root.add(skinned);skinned.bind(skeleton);
  });
  root.updateMatrixWorld(true);return root;
}
