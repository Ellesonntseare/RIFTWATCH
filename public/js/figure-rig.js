import * as THREE from 'three';

// The supplied figure is an unrigged front/back reconstruction. Preserve its
// original UVs and clothing while adding body volume and an anatomical rig.
export function rigFigure(scene){
  const root=new THREE.Group(),bones=[],lookup=new Map(),world=new Map();
  root.userData.proceduralFigure=true;root.userData.referenceHeight=1.751;
  const add=(name,parent,pos,end)=>{
    const bone=new THREE.Bone();bone.name='mixamorig'+name+'_0';bones.push(bone);lookup.set(name,bones.length-1);
    const point=new THREE.Vector3(...pos),direction=new THREE.Vector3(...end).sub(point).normalize();
    const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    const matrix=new THREE.Matrix4().compose(point,orientation,new THREE.Vector3(1,1,1));world.set(name,matrix);
    if(parent){const p=bones[lookup.get(parent)];p.add(bone);new THREE.Matrix4().copy(world.get(parent)).invert().multiply(matrix).decompose(bone.position,bone.quaternion,bone.scale);}else{root.add(bone);matrix.decompose(bone.position,bone.quaternion,bone.scale);}
  };
  add('Hips',null,[0,.89,0],[0,1.03,0]);add('Spine','Hips',[0,1.03,0],[0,1.2,0]);add('Spine1','Spine',[0,1.2,0],[0,1.38,0]);add('Spine2','Spine1',[0,1.38,0],[0,1.49,0]);add('Neck','Spine2',[0,1.49,0],[0,1.59,0]);add('Head','Neck',[0,1.59,0],[0,1.77,0]);
  for(const [side,s]of [['Left',1],['Right',-1]]){
    add(side+'Shoulder','Spine2',[s*.12,1.4,0],[s*.19,1.37,0]);add(side+'Arm',side+'Shoulder',[s*.19,1.37,0],[s*.25,1.11,0]);add(side+'ForeArm',side+'Arm',[s*.25,1.11,0],[s*.29,.88,0]);add(side+'Hand',side+'ForeArm',[s*.29,.88,0],[s*.30,.79,0]);
    add(side+'UpLeg','Hips',[s*.1,.87,0],[s*.11,.49,0]);add(side+'Leg',side+'UpLeg',[s*.11,.49,0],[s*.12,.14,0]);add(side+'Foot',side+'Leg',[s*.12,.14,0],[s*.12,.105,.11]);add(side+'ToeBase',side+'Foot',[s*.12,.105,.11],[s*.12,.105,.17]);
  }
  root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
  const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
  function mix(a,b,t){return [[a,1-t],[b,t]];}
  const armBlend=(x,y)=>y>.70&&y<1.47?smooth(y>1.33?.145:y>1.13?.155:.19,(y>1.33?.145:y>1.13?.155:.19)+.035,Math.abs(x)):0;
  function torsoWeights(y,side){
    if(y>1.51)return mix('Neck','Head',smooth(1.51,1.59,y));
    if(y<.91){
      if(y<.21)return mix(side+'Foot',side+'Leg',smooth(.15,.21,y));
      if(y<.55)return mix(side+'Leg',side+'UpLeg',smooth(.43,.55,y));
      return mix(side+'UpLeg','Hips',smooth(.79,.91,y));
    }
    if(y<1.11)return mix('Hips','Spine',smooth(.97,1.11,y));
    if(y<1.3)return mix('Spine','Spine1',smooth(1.13,1.3,y));
    if(y<1.47)return mix('Spine1','Spine2',smooth(1.32,1.44,y));
    return mix('Spine2','Neck',smooth(1.47,1.52,y));
  }
  function bodyWeights(x,y){
    const side=x>=0?'Left':'Right',ax=Math.abs(x);
    const amount=armBlend(x,y),body=torsoWeights(y,side);if(!amount)return body;
    const arm=y<.98?mix(side+'Hand',side+'ForeArm',smooth(.88,.98,y)):y<1.2?mix(side+'ForeArm',side+'Arm',smooth(1.08,1.2,y)):mix(side+'Arm',side+'Shoulder',smooth(1.35,1.43,y));
    return [...arm.map(([b,w])=>[b,w*amount]),...body.map(([b,w])=>[b,w*(1-amount)])];
  }
  const profile=[[0,.08],[.21,.078],[.55,.09],[.79,.10],[.98,.12],[1.3,.13],[1.45,.10],[1.51,.065],[1.6,.095],[1.8,.09]];
  const bodyDepth=y=>{for(let i=1;i<profile.length;i++)if(y<=profile[i][0])return THREE.MathUtils.lerp(profile[i-1][1],profile[i][1],smooth(profile[i-1][0],profile[i][0],y));return .09;};
  scene.updateMatrixWorld(true);
  scene.traverse(original=>{
    if(!original.isMesh)return;
    const geometry=original.geometry.clone();geometry.applyMatrix4(original.matrixWorld);
    const p=geometry.attributes.position,indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
    // Preserve the supplied face, hair and clothes. Rebuild only the arms and
    // fingers whose photo silhouette cannot bend into a weapon grip cleanly.
    const triangles=[],index=geometry.index;
    const removed=i=>armBlend(p.getX(i),p.getY(i))>.45;
    for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(!removed(a)&&!removed(b)&&!removed(c))triangles.push(a,b,c);}
    geometry.setIndex(triangles);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const depth=THREE.MathUtils.lerp(bodyDepth(y),.068,armBlend(x,y));
      let px=x,py=y,pz=z*depth/.0684;
      if(y>1.5){
        const blend=smooth(1.5,1.58,y),angle=THREE.MathUtils.degToRad(8)*blend,cy=y-1.64;
        px=(x*Math.cos(angle)-cy*Math.sin(angle))*THREE.MathUtils.lerp(1,1.10,blend);
        py=1.64+x*Math.sin(angle)+cy*Math.cos(angle)+(y-1.51)*.08*blend;
        // Give the cranium an elliptical cross-section and a gentle jaw taper.
        const skull=Math.sqrt(Math.max(.04,1-(x/.083)**2));
        pz*=THREE.MathUtils.lerp(1,.65+.35*skull,blend)*THREE.MathUtils.lerp(1,1.08,blend);
      }
      p.setXYZ(i,px,py,pz);
      const influence=bodyWeights(x,y);influence.forEach(([name,weight],j)=>{indices[i*4+j]=lookup.get(name);weights[i*4+j]=weight;});
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=original.material.clone();material.roughness=.85;material.metalness=0;material.transparent=false;material.opacity=1;material.depthWrite=true;material.side=THREE.DoubleSide;material.alphaTest=0;
    const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Civilian_'+original.name;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton,new THREE.Matrix4());
  });
  const skin=new THREE.MeshStandardMaterial({color:0x8c573b,roughness:.8}),shirt=new THREE.MeshStandardMaterial({color:0x1c1e20,roughness:.95});
  function limb(side,part,next,radiusA,radiusB,sleeve=false){
    const bone=bones[lookup.get(side+part)],child=bones[lookup.get(side+next)],a=bone.getWorldPosition(new THREE.Vector3()),b=child.getWorldPosition(new THREE.Vector3()),direction=b.clone().sub(a).normalize();
    const across=new THREE.Vector3(0,0,1).cross(direction).normalize(),depth=direction.clone().cross(across).normalize();
    const positions=[],normals=[],uv=[],ids=[],values=[],triangles=[],segments=12,rings=12;
    const geo=new THREE.BufferGeometry();
    for(let j=0;j<=rings;j++){
      const t=j/rings,center=a.clone().lerp(b,t),radius=THREE.MathUtils.lerp(radiusA,radiusB,t)*(1+.08*Math.sin(t*Math.PI));
      for(let k=0;k<=segments;k++){
        const angle=k/segments*Math.PI*2,n=across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(depth,Math.sin(angle)),p=center.clone().addScaledVector(n,radius);
        positions.push(...p.toArray());normals.push(...n.toArray());uv.push(k/segments,t);
        const blend=smooth(.75,1,t);ids.push(lookup.get(side+part),lookup.get(side+next),0,0);values.push(1-blend,blend,0,0);
      }
    }
    for(let j=0;j<rings;j++){const start=triangles.length;for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;triangles.push(a,b,a+1,a+1,b,b+1);}geo.addGroup(start,triangles.length-start,sleeve&&j<6?1:0);}
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));geo.setIndex(triangles);
    const mesh=new THREE.SkinnedMesh(geo,[skin,shirt]);mesh.name=side+part+'Anatomy';mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton,new THREE.Matrix4());
  }
  const sphere=new THREE.SphereGeometry(1,12,8);
  function segment(parent,a,b,r){const d=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.001,d.length()-r*2),4,8),skin);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(mesh);}
  for(const side of ['Left','Right']){
    limb(side,'Arm','ForeArm',.057,.046,true);limb(side,'ForeArm','Hand',.045,.029);
    for(const [part,radius,material]of [['Arm',.057,shirt],['ForeArm',.043,skin],['Hand',.028,skin]]){const joint=new THREE.Mesh(sphere,material);joint.scale.setScalar(radius);bones[lookup.get(side+part)].add(joint);}
    const hand=bones[lookup.get(side+'Hand')],palm=new THREE.Mesh(sphere,skin);palm.scale.set(.032,.047,.021);palm.position.y=.042;hand.add(palm);
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.016,start=new THREE.Vector3(x,.066,.004),joint=new THREE.Vector3(x,.092,-.008),tip=new THREE.Vector3(x,.077,-.032);
      segment(hand,start,joint,.007);segment(hand,joint,tip,.006);
    }
    const sign=side==='Left'?1:-1;segment(hand,new THREE.Vector3(sign*.026,.022,.008),new THREE.Vector3(sign*.038,.048,.025),.010);segment(hand,new THREE.Vector3(sign*.038,.048,.025),new THREE.Vector3(sign*.017,.065,.033),.008);
  }
  root.updateMatrixWorld(true);return root;
}
