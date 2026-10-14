import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHero } from './hero.js';
const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.shadowMap.enabled=false;renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x08191e);scene.fog=new THREE.Fog(0x08191e,6,15);
scene.add(new THREE.HemisphereLight(0xe5ffff,0x26362f,2.4));const key=new THREE.DirectionalLight(0xffedda,3);key.position.set(3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x70ffcf,2);rim.position.set(-3,3,-3);scene.add(rim);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);camera.position.set(.25,1.18,3.9);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.92,0);controls.enableDamping=true;controls.minDistance=.5;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.55;
const platform=new THREE.Mesh(new THREE.CylinderGeometry(.64,.7,.07,64),new THREE.MeshStandardMaterial({color:0x213a3c,metalness:.6,roughness:.4}));platform.position.y=-.045;scene.add(platform);
const ringMaterial=new THREE.MeshBasicMaterial({color:0xa4ffe1});
const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.008,8,64),ringMaterial);ring.rotation.x=Math.PI/2;scene.add(ring);
const grid=new THREE.GridHelper(40,80,0x385551,0x152d30);grid.position.y=-.09;scene.add(grid);
let hero,close=false,previewWalk=false;
function resetCamera(){close=false;camera.position.set(.25,1.18,3.9);controls.target.set(0,.92,0);$('inspect').textContent='INSPECT FACE +';}
export async function loadPreview(config){return buildHero(config.id,{preview:true});}
export function displayPreview(next){if(hero)scene.remove(hero.root);hero=next;scene.add(hero.root);resetCamera();}
export function selectPreview(config){if(hero)hero.root.visible=false;ringMaterial.color.setHex(config.accent);rim.color.setHex(config.accent);}
$('inspect').onclick=()=>{if(close)resetCamera();else{close=true;camera.position.set(.06,1.65,.75);controls.target.set(0,1.64,0);$('inspect').textContent='FULL BODY −';}};
$('walk-preview').onclick=()=>{previewWalk=!previewWalk;$('walk-preview').textContent=previewWalk?'STOP WALK PREVIEW':'WALK PREVIEW';};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
let previous=performance.now();function frame(now){requestAnimationFrame(frame);if(document.hidden||now-previous<1000/30)return;const dt=Math.min(.05,(now-previous)/1000||0);previous=now;if(hero)hero.update(dt,previewWalk,previewWalk?4:0);controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);

