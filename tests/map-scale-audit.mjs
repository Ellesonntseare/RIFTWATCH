import fs from 'node:fs';
import * as THREE from 'three';
import {MAPS} from '../public/js/maps.js';
const report=[];
for(const [key,map] of Object.entries(MAPS)){
 if(!map.glb){report.push({map:key,size:map.size,buildingHeights:[...new Set(map.blocks.filter(b=>b[0]==='roof').map(b=>b[5]))],cars:map.cars?.length||0});continue;}
 const path='models/'+map.glb.split('/').at(-1);if(!fs.existsSync(path))continue;
 const fd=fs.openSync(path,'r'),header=Buffer.alloc(20);fs.readSync(fd,header,0,20,0);const length=header.readUInt32LE(12),chunk=Buffer.alloc(length);fs.readSync(fd,chunk,0,length,20);fs.closeSync(fd);const data=JSON.parse(chunk.toString('utf8'));
 const refs=[];
 function visit(index,parent){const n=data.nodes[index],local=new THREE.Matrix4();if(n.matrix)local.fromArray(n.matrix);else local.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));const matrix=parent.clone().multiply(local);
 if(n.mesh!==undefined&&/door|bench|car\b|vehicle|container|chair/i.test(n.name||'')){const box=new THREE.Box3();for(const p of data.meshes[n.mesh].primitives){const a=data.accessors[p.attributes.POSITION];if(a.min&&a.max)box.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(matrix));}if(!box.isEmpty()){const v=box.getSize(new THREE.Vector3()).multiplyScalar(map.worldScale||1);refs.push({name:n.name,metres:v.toArray().map(x=>+x.toFixed(2))});}}
 for(const child of n.children||[])visit(child,matrix);}
 for(const n of data.scenes[data.scene||0].nodes)visit(n,new THREE.Matrix4());
 report.push({map:key,worldScale:map.worldScale,references:refs.slice(0,30)});
}
fs.writeFileSync('tests/map-scale-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
