import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone,retargetClip} from 'three/addons/utils/SkeletonUtils.js';
import {createFootGrounding} from './foot-grounding.js';
const cache=new Map();let source;
// GLTFLoader strips colons from Mixamo names when it creates animation bindings.
const canonical=name=>name.replace(/^mixamorig\d*[:_]?/i,'').replace(/^Bind_/i,'').replace(/(?:_\d+)+$/,'').toLowerCase();
function firstSkin(root){let skin;root.traverse(o=>{if(!skin&&o.isSkinnedMesh)skin=o;});return skin;}
export async function heroMotionClips(file,targetTemplate,sourceTemplate=null){
  if(cache.has(file))return cache.get(file);
  const task=(async()=>{
    source ||= sourceTemplate ? Promise.resolve(sourceTemplate) : new GLTFLoader().loadAsync('/models/futuristic_soldier_free.glb');
    const donor=sourceTemplate||await source,target=clone(targetTemplate),actor=clone(donor.scene);
    target.updateMatrixWorld(true);actor.updateMatrixWorld(true);
    const targetSkin=firstSkin(target),sourceSkin=firstSkin(actor);if(!targetSkin||!sourceSkin)return {};
    const sourceNames=new Map(sourceSkin.skeleton.bones.map(b=>[canonical(b.name),b.name]));
    const names={};for(const bone of targetSkin.skeleton.bones){const mapped=sourceNames.get(canonical(bone.name));if(mapped)names[bone.name]=mapped;}
    if(Object.keys(names).length<10)return {};
    // Different rigs orient their ankle/knee axes differently. Transfer the
    // change from the donor's resting pose, preserving the target's foot axes.
    const localOffsets={};
    for(const bone of targetSkin.skeleton.bones){const other=sourceSkin.skeleton.bones.find(b=>b.name===names[bone.name]);if(other){const offset=other.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));localOffsets[bone.name]=new THREE.Matrix4().makeRotationFromQuaternion(offset);}}
    const result={};
    for(const mode of ['walk','run']){
      const original=donor.animations.find(c=>c.name===mode);if(!original)continue;
      const clip=retargetClip(targetSkin,sourceSkin,original,{names,localOffsets,hip:sourceNames.get('hips'),fps:30,useFirstFramePosition:true,preserveBonePositions:true});
      clip.name='Hero '+mode;
      // Retain the supplied gun-holding pose in the upper body. Transfer the
      // walking leg rotations; root travel belongs to the player controller.
      clip.tracks=clip.tracks.filter(t=>/\.quaternion$/.test(t.name)&&(mode==='hold'?/(Shoulder|Arm|Hand)/i:/(UpLeg|LeftLeg|RightLeg|Foot|Toe)/i).test(t.name));
      // Bind by bone node name because the mixer root is the whole model group.
      for(const track of clip.tracks)track.name=track.name.replace(/^\.bones\[([^\]]+)\]/,'$1');
      if(clip.tracks.length)result[mode]=clip;
    }
    return result;
  })().catch(e=>{console.warn('Hero walk retarget',e.message);return {};});
  cache.set(file,task);return task;
}
export function createHeroMotion(model,root,clips){
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const [name,clip]of Object.entries(clips)){actions[name]=mixer.clipAction(clip);actions[name].setEffectiveWeight(name==='hold'?1:0).play();}
  const groundFeet=createFootGrounding(model,root);
  let active=null;
  return (dt,moving,speed)=>{
    const desired=moving?(speed>7&&actions.run?'run':'walk'):null;
    if(desired!==active){if(active&&actions[active])actions[active].fadeOut(.15);if(desired&&actions[desired])actions[desired].reset().setEffectiveWeight(1).fadeIn(.15).play();active=desired;}
    if(active&&actions[active])actions[active].timeScale=THREE.MathUtils.clamp((speed||4)/(active==='run'?8:4),.6,1.65);
    mixer.update(dt);groundFeet();
  };
}
