import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone,retargetClip} from 'three/addons/utils/SkeletonUtils.js';
import {createFootGrounding} from './foot-grounding.js';
const cache=new Map();let source,movementSource;
export const MOVEMENT_PACK_URL='/models/mixamo-movement-pack.glb?v=20261015-14';
export const MOVEMENT_PREVIEWS=[
  ['jump','Jump'],['catwalk','Catwalk Walk Forward HighKnees'],['daggers','Double Dagger Stab'],
  ['dropKick','Drop Kick'],['kneeCombo','Flying Knee Punch Combo'],['elbow','Illegal Elbow Punch'],['punch','Punching'],
  ['fireRifle','Firing Rifle'],['strafe','Strafe'],['startWalk','Start Walking'],['throw','Throw Grenade'],
  ['swim','Swimming'],['flex','Mutant Flexing Muscles'],['punchBag','Punching Bag']
];
export const COMBAT_MOVES=['punch','elbow','kneeCombo','dropKick','daggers','fireRifle','throw'];
// GLTFLoader strips colons from Mixamo names when it creates animation bindings.
const canonical=name=>name.replace(/^mixamorig\d*[:_]?/i,'').replace(/^Bind_/i,'').replace(/(?:_\d+)+$/,'').toLowerCase();
function firstSkin(root){let skin;root.traverse(o=>{if(!skin&&o.isSkinnedMesh)skin=o;});return skin;}
export async function heroMotionClips(file,targetTemplate,sourceTemplate=null,movementTemplate=null,full=false){
  const key=file+(full?':preview':':game');
  if(cache.has(key))return cache.get(key);
  const task=(async()=>{
    source ||= sourceTemplate ? Promise.resolve(sourceTemplate) : new GLTFLoader().loadAsync('/models/futuristic_soldier_free.glb');
    movementSource ||= movementTemplate ? Promise.resolve(movementTemplate) : new GLTFLoader().loadAsync(MOVEMENT_PACK_URL);
    const donor=sourceTemplate||await source,target=clone(targetTemplate);
    let movementDonor;
    try{movementDonor=movementTemplate||await movementSource;}
    catch(error){console.warn('Optional movement pack unavailable',error);}
    target.updateMatrixWorld(true);
    const result={};
    const soldierModes=[['walk','walk'],['run','run']];
    const movementModes=full?MOVEMENT_PREVIEWS:MOVEMENT_PREVIEWS.filter(([mode])=>mode==='jump'||COMBAT_MOVES.includes(mode));
    for(const [asset,modes] of [[donor,soldierModes],...(movementDonor?[[movementDonor,movementModes]]:[])]){
      const actor=clone(asset.scene);actor.updateMatrixWorld(true);
      const targetSkin=firstSkin(target),sourceSkin=firstSkin(actor);if(!targetSkin||!sourceSkin)continue;
      const sourceNames=new Map(sourceSkin.skeleton.bones.map(b=>[canonical(b.name),b.name]));
      const names={};for(const bone of targetSkin.skeleton.bones){const mapped=sourceNames.get(canonical(bone.name));if(mapped)names[bone.name]=mapped;}
      if(Object.keys(names).length<10)continue;
      // Transfer rotation changes from the donor's rest pose to this operator.
      const localOffsets={};
      for(const bone of targetSkin.skeleton.bones){const other=sourceSkin.skeleton.bones.find(b=>b.name===names[bone.name]);if(other){const offset=other.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));localOffsets[bone.name]=new THREE.Matrix4().makeRotationFromQuaternion(offset);}}
      for(const [mode,assetName] of modes){
        const original=asset.animations.find(c=>c.name===assetName);if(!original)continue;
        const clip=retargetClip(targetSkin,sourceSkin,original,{names,localOffsets,hip:sourceNames.get('hips'),fps:30,useFirstFramePosition:true,preserveBonePositions:true});
        clip.name='Hero '+mode;
        // Position is controlled by the player physics. Walk/run keep the gun pose.
        clip.tracks=clip.tracks.filter(t=>/\.quaternion$/.test(t.name)&&(mode!=='walk'&&mode!=='run'||/(UpLeg|LeftLeg|RightLeg|Foot|Toe)/i.test(t.name)));
        for(const track of clip.tracks)track.name=track.name.replace(/^\.bones\[([^\]]+)\]/,'$1');
        if(clip.tracks.length)result[mode]=clip;
      }
    }
    if(file==='mixamo-movement-pack.glb'){
      // The supplied mannequin has no idle clip. Use its bind pose with
      // lowered arms, while leaving its authored leg stance undisturbed.
      const tracks=firstSkin(target).skeleton.bones.map(bone=>{
        const pose=bone.quaternion.clone();
        if(/mixamorig(?:Left|Right)Arm$/.test(bone.name))pose.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),1));
        return new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,1],[...pose.toArray(),...pose.toArray()]);
      });
      result.idle=new THREE.AnimationClip('Hero idle',1,tracks);
    }
    return result;
  })().catch(e=>{console.warn('Hero animation retarget',e.message);return {};});
  cache.set(key,task);return task;
}
export function createHeroMotion(model,root,clips){
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const [name,clip]of Object.entries(clips))actions[name]=mixer.clipAction(clip);
  const groundFeet=createFootGrounding(model,root);
  let active=null,oneShot=null,remaining=0,wasAirborne=false;
  function play(name,duration){
    const action=actions[name];if(!action)return false;
    if(active){actions[active].fadeOut(.1);active=null;}
    if(oneShot)actions[oneShot].fadeOut(.1);
    action.reset().setLoop(THREE.LoopOnce,1).setEffectiveWeight(1).fadeIn(.1).play();
    action.timeScale=duration?clips[name].duration/duration:1;
    oneShot=name;remaining=duration||clips[name].duration;return true;
  }
  const update=(dt,moving,speed,{airborne=false}={})=>{
    if(airborne&&!wasAirborne)play('jump');
    wasAirborne=airborne;
    if(oneShot){remaining-=dt;if(remaining<=.16){actions[oneShot].fadeOut(.15);oneShot=null;}}
    const desired=oneShot?null:moving?(speed>7&&actions.run?'run':'walk'):(actions.idle?'idle':null);
    if(desired!==active){if(active)actions[active].fadeOut(.15);if(desired)actions[desired].reset().setEffectiveWeight(1).fadeIn(.15).play();active=desired;}
    if(active&&active!=='idle')actions[active].timeScale=THREE.MathUtils.clamp((speed||4)/(active==='run'?8:4),.6,1.65);
    mixer.update(dt);if(!airborne&&!oneShot)groundFeet();
  };
  update.play=play;
  return update;
}
