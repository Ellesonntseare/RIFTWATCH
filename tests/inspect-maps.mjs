import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
for(const [file,fit] of [['skibidi_toilet_77_map.glb',700],['map_ep_73.glb',300]]){
 const bytes=await fs.readFile('models/'+file),loader=new GLTFLoader();loader.register(()=>({name:'GeometryOnly',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(g.scene),size=box.getSize(new T.Vector3()),k=fit/Math.max(size.x,size.z);console.log(file,'raw',size.toArray(),'oldScale',k);
 const rows=[];g.scene.traverse(o=>{if(!o.isMesh)return;const name=o.name+' '+(Array.isArray(o.material)?o.material.map(m=>m.name).join(' '):o.material.name);if(/water|door|bench|car_|window|building_03|brick|plaster/i.test(name)&&rows.length<16){const s=new T.Box3().setFromObject(o).getSize(new T.Vector3());rows.push({name,size:s.toArray(),scaled:s.multiplyScalar(k).toArray()});}});console.log(JSON.stringify(rows));
}
