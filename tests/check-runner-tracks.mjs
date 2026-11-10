import {RUNNER_MOTION} from '../public/js/runner-motion-data.js';
import * as T from 'three';
for(const file of ['MAIN HERO.glb','runner-run.glb','futuristic_soldier_free.glb']){
for(const mode of ['walk','run','fastRun']){console.log(file,mode);for(const track of RUNNER_MOTION[file][mode].tracks.filter(t=>/LeftLeg|calf_l/.test(t.name))){const q=new T.Quaternion().fromArray(track.values);let d=0;for(let i=0;i<track.values.length;i+=4)d=Math.max(d,q.angleTo(new T.Quaternion().fromArray(track.values,i)));console.log(track.name,d,track.values.length);}}
}
