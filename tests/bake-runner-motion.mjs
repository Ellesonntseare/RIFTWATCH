import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone,retargetClip} from 'three/addons/utils/SkeletonUtils.js';
import {rigStaticBiped} from '../public/js/biped-motion.js';
import {giveDemonLegs} from '../public/js/fire-demon.js';
async function asset(name){let file='models/web/'+name;try{await fs.access(file);}catch{file='models/'+name;}const bytes=await fs.readFile(file),loader=new GLTFLoader();loader.register(()=>({name:'BakeGeometryOnly',loadTexture:()=>Promise.resolve(new THREE.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const canonical=name=>{const n=name.replace(/^mixamorig\d*[:_]?/i,'').replace(/^Bind_/i,'').replace(/(?:_\d+)+$/,'').toLowerCase();return ({gait_root:'hips',thigh_l:'leftupleg',thigh_r:'rightupleg',calf_l:'leftleg',calf_r:'rightleg',foot_l:'leftfoot',foot_r:'rightfoot'})[n]||n;};
function skin(root){let first;root.traverse(o=>{if(!first&&o.isSkinnedMesh)first=o;});return first;}
const donors=await Promise.all(['runner-run.glb','runner-fast.glb','runner-jump.glb','runner-roll.glb'].map(asset));
const entries=[['run',0],['fastRun',1],['jump',2],['landRoll',3]];
const files=['MAIN HERO.glb','HERO 1.glb','HERO 3.glb','runner-run.glb','runner-fast.glb','runner-jump.glb','runner-roll.glb','futuristic_soldier_free.glb','winter_soldier_-_summer_soldier.glb','crimson_fire_demon_-_triposr_vs_supavoxel.glb','horned_minotaur_demon_-_png_to_stl_-_supavoxel.glb'];
const output={},report=[];
for(const file of files){
 const targetAsset=await asset(file);
 if(file.startsWith('crimson'))targetAsset.scene=rigStaticBiped(giveDemonLegs(targetAsset.scene),{hip:.43});
 if(file.startsWith('horned'))targetAsset.scene=rigStaticBiped(targetAsset.scene,{turn:-Math.PI/2,hip:.46});
 output[file]={};
 for(const [mode,index] of entries){
  const target=clone(targetAsset.scene),source=clone(donors[index].scene);target.updateMatrixWorld(true);source.updateMatrixWorld(true);
  const t=skin(target),s=skin(source);if(!t||!s)continue;
  const names={},sourceNames=new Map(s.skeleton.bones.map(b=>[canonical(b.name),b.name]));
  for(const b of t.skeleton.bones){const name=sourceNames.get(canonical(b.name));if(name)names[b.name]=name;}
  if(Object.keys(names).length<6)continue;
  const localOffsets={};for(const b of t.skeleton.bones){const other=s.skeleton.bones.find(o=>o.name===names[b.name]);if(other)localOffsets[b.name]=new THREE.Matrix4().makeRotationFromQuaternion(other.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion())));}
  const clip=retargetClip(t,s,donors[index].animations[0],{names,localOffsets,hip:sourceNames.get('hips'),fps:30,useFirstFramePosition:true,preserveBonePositions:true});
  clip.name='Runner '+mode;clip.tracks=clip.tracks.filter(track=>/\.quaternion$/.test(track.name)&&(/UpLeg|LeftLeg|RightLeg|Foot|Toe|thigh_|calf_/i.test(track.name)||mode==='landRoll'&&/Hips|Spine|Chest|Neck|Head|Shoulder|Arm|Hand/i.test(track.name)));
  for(const track of clip.tracks)track.name=track.name.replace(/^\.bones\[([^\]]+)\]/,'$1');
  clip.optimize();const json=THREE.AnimationClip.toJSON(clip);delete json.uuid;output[file][mode]=json;
 }
 // Build a relaxed upright stance from each rig's actual leg directions.
 const upright=clone(targetAsset.scene);upright.updateMatrixWorld(true);
 for(const side of ['left','right'])for(const part of ['upleg','leg']){
   let bone;upright.traverse(o=>{if(o.isBone&&canonical(o.name)===side+part)bone=o;});
   if(!bone)continue;
   const child=bone.children.find(o=>o.isBone);if(!child)continue;
   const from=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
   const world=new THREE.Quaternion().setFromUnitVectors(from,new THREE.Vector3(0,-1,0)).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));upright.updateMatrixWorld(true);
 }
 const idleTracks=[];upright.traverse(b=>{if(b.isBone&&/leftupleg|rightupleg|leftleg|rightleg|leftfoot|rightfoot/.test(canonical(b.name)))idleTracks.push(new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',[0,1],[...b.quaternion.toArray(),...b.quaternion.toArray()]));});
 output[file].idle=THREE.AnimationClip.toJSON(new THREE.AnimationClip('Runner upright',1,idleTracks));delete output[file].idle.uuid;
 if(output[file].run){const walk=THREE.AnimationClip.parse(output[file].run);walk.name='Runner walk';
   for(const track of walk.tracks){const bone=upright.getObjectByName(track.name.split('.')[0]);if(!bone)continue;for(let i=0;i<track.values.length;i+=4){const q=bone.quaternion.clone().slerp(new THREE.Quaternion().fromArray(track.values,i),.55);q.toArray(track.values,i);}for(let i=0;i<track.times.length;i++)track.times[i]*=1.6;}
   walk.duration*=1.6;output[file].walk=THREE.AnimationClip.toJSON(walk);delete output[file].walk.uuid;
 }
 report.push({file,clips:Object.fromEntries(Object.entries(output[file]).map(([k,v])=>[k,{tracks:v.tracks.length,duration:v.duration}]))});console.log(JSON.stringify(report.at(-1)));
}
const serialize=JSON.stringify(output,(_,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value);
await fs.writeFile('public/js/runner-motion-data.js','// Generated from user-supplied FBX clips by tests/bake-runner-motion.mjs.\nexport const RUNNER_MOTION = '+serialize+';\n');
await fs.writeFile('tests/runner-motion-report.json',JSON.stringify(report,null,2));
