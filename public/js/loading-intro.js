import * as THREE from 'three';
import {buildMonster,animateMonster,MONSTER_TYPES} from './monsters.js';
// A scripted in-engine scene using already-loaded game models; no video download.
export function createLoadingIntro({panel,caption,skip,reduced=false}){
 let scene=null,camera=null,actors=[],own=[],time=0,shot=0,skipped=false,resolveReady=null;
 const duration=8;
 function stop(){skipped=true;panel.classList.remove('cinematic-loading');skip.hidden=true;if(resolveReady){resolveReady();resolveReady=null;}for(const object of own){object.geometry?.dispose();object.material?.dispose();}for(const a of actors)for(const m of a.mats)m.dispose();scene=null;actors=[];own=[];}
 skip.addEventListener('click',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden&&resolveReady)stop();});
 function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);scene.add(m);own.push(m);return m;}
 let tracer,flare;
 return {
 begin(){stop();skipped=reduced;time=0;shot=0;skip.hidden=reduced;caption.textContent='A SIGNAL. A BREACH. ONE LAST LINE.';if(!reduced)panel.classList.add('cinematic-loading');},
 start(){if(skipped)return;scene=new THREE.Scene();scene.background=new THREE.Color(0x09111a);scene.fog=new THREE.Fog(0x09111a,12,40);camera=new THREE.PerspectiveCamera(48,1,.1,60);
 scene.add(new THREE.HemisphereLight(0x8ed6ff,0x291610,2.2));const key=new THREE.DirectionalLight(0xffc397,3);key.position.set(-4,8,4);scene.add(key);
 mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:0x26353c,roughness:.8}),0,0,0).rotation.x=-Math.PI/2;
 for(let i=0;i<10;i++)mesh(new THREE.BoxGeometry(1.8,1.3+i%3,1.8),new THREE.MeshStandardMaterial({color:i%2?0x3c514e:0x4c4640,roughness:.8}),i%2?5:-5,(1.3+i%3)/2,-i*3+5);
 for(const [type,x,z] of [['sentry',-1,2],['runner',2,-8],['grunt',-2,-11]]){const a={...buildMonster(type),T:MONSTER_TYPES[type],x,y:0,z,moving:true,running:true,dead:false,deadT:0,flash:0,shootAnim:0,attackAnim:0};a.group.position.set(x,0,z);scene.add(a.group);actors.push(a);}
 tracer=mesh(new THREE.BoxGeometry(.025,.025,9),new THREE.MeshBasicMaterial({color:0xffe3a1}),0,1.3,-3);flare=mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xffbd63}),-1,1.3,1);},
 render(renderer,dt){if(!scene||skipped)return false;time+=dt;const t=Math.min(time,duration),phase=t<2?0:t<5?1:2;
 caption.textContent=phase===0?'THE BREACH IS OPEN.':phase===1?'HOLD YOUR GROUND.':'ENTER THE RIFT. COME BACK ALIVE.';
 camera.aspect=renderer.domElement.clientWidth/Math.max(1,renderer.domElement.clientHeight);camera.updateProjectionMatrix();
 if(phase===0)camera.position.set(5-t*.6,1.2+t*.12,7-t*.7);else if(phase===1)camera.position.set(-3+(t-2)*.25,1.65,4);else camera.position.set(2+(t-5)*.5,2+(t-5)*.25,6+(t-5));camera.lookAt(-.3,1.2,-2);
 actors.forEach((a,i)=>{if(i===0){a.moving=t<2;a.group.rotation.y=Math.PI;a.group.position.z=2-Math.min(2,t)*.35;}else{a.moving=t<5;a.group.position.z=a.z+Math.min(5,t)*1.1;if(t>5&&i===1){a.dead=true;a.deadT+=dt;}}animateMonster(a,dt);});
 const firing=t>2&&t<5;shot+=dt;tracer.visible=flare.visible=firing&&(shot%.18)<.055;actors[0].shootAnim=firing?.2:0;
 renderer.clear();renderer.render(scene,camera);if(time>=duration&&resolveReady){resolveReady();resolveReady=null;}return true;},
 finish(){if(skipped||!scene||time>=duration||document.hidden){stop();return Promise.resolve();}return new Promise(resolve=>{resolveReady=resolve;}).then(stop);},
 stop
 };
}
