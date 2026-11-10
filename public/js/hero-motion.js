import {RUNNER_MOTION} from './runner-motion-data.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone,retargetClip} from 'three/addons/utils/SkeletonUtils.js';
import {createFootGrounding} from './foot-grounding.js';
import {createWeaponGrip} from './arm-ik.js';
import {createCorpseGrounding} from './corpse-grounding.js';
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
    // The equipped soldier's locomotion and rifle clips retain a planted gun pose.
    // The showcase pack's jump and gunfire twist the whole body during combat.
    const soldierModes=[['walk','walk'],['run','run'],['jump','jump'],['strafe','strafeRight'],['fireRifle','shooting'],['death','death']];
    const movementModes=(full?MOVEMENT_PREVIEWS:MOVEMENT_PREVIEWS.filter(([mode])=>['startWalk',...COMBAT_MOVES].includes(mode)))
      .filter(([mode])=>!['jump','strafe','fireRifle'].includes(mode));
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
        clip.tracks=clip.tracks.filter(t=>/\.quaternion$/.test(t.name)&&(
          mode==='fireRifle'||mode==='throw'||mode==='punch'?/(Spine|Chest|Neck|Head|Shoulder|Arm|Hand|Finger)/i.test(t.name):
          !['walk','run','strafe','startWalk','jump'].includes(mode)||/(UpLeg|LeftLeg|RightLeg|Foot|Toe)/i.test(t.name)
        ));
        for(const track of clip.tracks)track.name=track.name.replace(/^\.bones\[([^\]]+)\]/,'$1');
        if(clip.tracks.length)result[mode]=clip;
      }
    }
    for(const [mode,data] of Object.entries(RUNNER_MOTION[file]||{}))result[mode]=THREE.AnimationClip.parse({...data,uuid:THREE.MathUtils.generateUUID()});
    return result;
  })().catch(e=>{console.warn('Hero animation retarget',e.message);return {};});
  cache.set(key,task);return task;
}
export function createHeroMotion(model,root,clips){
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const [name,clip]of Object.entries(clips))actions[name]=mixer.clipAction(clip);
  const groundFeet=createFootGrounding(model,root),punchGrip=createWeaponGrip(model,root);
  const punchRight=new THREE.Vector3(),punchLeft=new THREE.Vector3();let punchDuration=.65;
  let active=null,oneShot=null,remaining=0,wasJumping=false,wasDead=false,deathTime=0,deathFloor=0,groundCorpse,deathSettled=false,corpseOffset=0,airTime=0,wasAirborne=false;
  function play(name,duration){
    const action=actions[name];if(!action)return false;
    if(!['fireRifle','throw','punch'].includes(name)&&active){actions[active].fadeOut(.1);active=null;}
    if(oneShot)actions[oneShot].fadeOut(.1);
    action.reset().setLoop(THREE.LoopOnce,1).setEffectiveWeight(1).fadeIn(.12).play();action.clampWhenFinished=true;
    action.timeScale=duration?clips[name].duration/duration:1;
    oneShot=name;remaining=duration||clips[name].duration;if(name==='punch')punchDuration=remaining;return true;
  }
  const update=(dt,moving,speed,{airborne=false,lateral=false,jumping=false,running,dead=false}={})=>{
    if(dead){
      if(!wasDead){deathSettled=false;deathTime=0;deathFloor=root.position.y;mixer.stopAllAction();active=null;oneShot=null;if(actions.death){actions.death.reset().setLoop(THREE.LoopOnce,1).play();actions.death.clampWhenFinished=true;}groundCorpse ||= createCorpseGrounding(model,root);}
      wasDead=true;update.handsBusy=true;if(deathSettled){root.position.y=deathFloor+corpseOffset;return;}deathTime+=dt;mixer.update(dt);deathSettled=deathTime>=(clips.death?.duration||1.5);groundCorpse(deathFloor,deathSettled);corpseOffset=root.position.y-deathFloor;return;
    }
    if(wasDead){mixer.stopAllAction();wasDead=false;active=null;oneShot=null;}
    if(airborne)airTime+=dt;
    if(!airborne&&wasAirborne){if(airTime>.85&&actions.landRoll)play('landRoll',1.05);airTime=0;}
    wasAirborne=airborne;
    if(jumping&&!wasJumping)play('jump',.65);
    wasJumping=jumping;
    if(!airborne&&oneShot==='jump'){actions.jump.fadeOut(.12);oneShot=null;}
    if(oneShot){remaining-=dt;if(remaining<=.16&&!(oneShot==='jump'&&airborne)){actions[oneShot].fadeOut(.15);oneShot=null;}}
    moving=!!moving&&speed>.15;
    const blocksLocomotion=oneShot&&!['fireRifle','throw','punch'].includes(oneShot);
    const desired=blocksLocomotion?null:moving?(lateral&&actions.strafe?'strafe':(running??speed>7)&&actions.run?(actions.fastRun?'fastRun':'run'):'walk'):(actions.idle?'idle':null);
    if(desired!==active){if(active)actions[active].fadeOut(.15);if(desired){const previous=active?actions[active]:null,phase=previous?previous.time/previous.getClip().duration:0;const next=actions[desired];next.reset();if(previous&&['walk','run','fastRun','strafe'].includes(active))next.time=(phase%1)*next.getClip().duration;next.setEffectiveWeight(1).fadeIn(.22).play();}active=desired;}
    if(active&&active!=='idle')actions[active].timeScale+=(THREE.MathUtils.clamp((speed||4)/(['run','fastRun'].includes(active)?8:4),.6,1.65)-actions[active].timeScale)*(1-Math.exp(-dt*10));
    update.handsBusy=!!oneShot&&oneShot!=='fireRifle';
    mixer.update(dt);
    if(oneShot==='punch'){
      const phase=1-remaining/punchDuration,extension=Math.max(0,Math.sin(Math.min(1,phase/.68)*Math.PI));
      punchRight.set(-.18+extension*.08,1.34,.23+extension*.53);punchLeft.set(.24,1.28,.25);
      punchGrip(punchRight,punchLeft);
    }
    if(!airborne&&(!oneShot||['punch','fireRifle','throw','landRoll'].includes(oneShot)))groundFeet();
  };
  update.play=play;
  return update;
}
