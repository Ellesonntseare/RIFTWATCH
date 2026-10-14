import * as THREE from 'three';

// Two-bone arm IK: wrists follow weapon grips, elbows bend out/down.
export function createWeaponGrip(model,root){
  const limbs=[];
  for(const [side,sign]of [['Right',-1],['Left',1]]){
    let upper,lower,hand;model.traverse(o=>{if(!o.isBone)return;if(new RegExp(side+'Arm_\\d+$').test(o.name))upper=o;if(new RegExp(side+'ForeArm_\\d+$').test(o.name))lower=o;if(new RegExp(side+'Hand_\\d+$').test(o.name))hand=o;});
    if(!upper||!lower||!hand)continue;
    root.updateMatrixWorld(true);
    const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
    let finger=hand.children.find(o=>/Middle1/.test(o.name))||hand.children.find(o=>o.isBone);
    const palm=finger?finger.getWorldPosition(new THREE.Vector3()).sub(c).normalize():new THREE.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
    limbs.push({side,sign,upper,lower,hand,l1:a.distanceTo(b),l2:b.distanceTo(c),rest:[upper.quaternion.clone(),lower.quaternion.clone(),hand.quaternion.clone()],palm:palm.applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert())});
  }
  function point(b){return b.getWorldPosition(new THREE.Vector3());}
  function rotateTo(bone,current,desired){
    const rotation=new THREE.Quaternion().setFromUnitVectors(current.normalize(),desired.normalize()).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));root.updateMatrixWorld(true);
  }
  return (right,left,pitch=0)=>{
    for(const limb of limbs){
      const {upper,lower,hand,l1,l2,rest,sign}=limb;
      [upper,lower,hand].forEach((bone,i)=>bone.quaternion.copy(rest[i]));root.updateMatrixWorld(true);
      const target=root.localToWorld((limb.side==='Right'?right:left).clone()),shoulder=point(upper),delta=target.clone().sub(shoulder),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.001,l1+l2-.001),direction=delta.normalize();
      const bend=new THREE.Vector3(sign*.8,-.7,-.25).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));bend.addScaledVector(direction,-bend.dot(direction)).normalize();
      const along=(l1*l1+distance*distance-l2*l2)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
      const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,height);
      rotateTo(upper,point(lower).sub(shoulder),elbow.clone().sub(shoulder));
      rotateTo(lower,point(hand).sub(point(lower)),target.clone().sub(point(lower)));
      const palm=limb.palm.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
      const desired=new THREE.Vector3(0,limb.side==='Right'?-1:.15,limb.side==='Right'?.25:1).applyAxisAngle(new THREE.Vector3(1,0,0),-pitch).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      if(model.userData.proceduralFigure)rotateTo(hand,palm,desired);
    }
  };
}
