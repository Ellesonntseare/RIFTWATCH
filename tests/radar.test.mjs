import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radarPoint} from '../public/js/radar.js';
const player={pos:{x:10,z:20},yaw:0};
test('radar keeps forward contacts above the player at all headings',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,0.7]){
  const p={...player,yaw},point=radarPoint(p.pos.x-Math.sin(yaw)*10,p.pos.z-Math.cos(yaw)*10,p);
  assert(Math.abs(point.x)<1e-8);assert(point.y<0);assert.equal(point.outside,false);
 }
});
test('radar clips distant hostiles but keeps objectives on its circular edge',()=>{
 assert.equal(radarPoint(1000,1000,player),null);
 const edge=radarPoint(1000,1000,player,94,true);assert(edge.outside);assert(Math.abs(Math.hypot(edge.x,edge.y)-87)<1e-8);
 const center=radarPoint(10,20,player);assert.equal(center.x,0);assert.equal(center.y,0);
});
test('radar preserves relative contact positions when player and world move together',()=>{
 const a=radarPoint(17,16,player),b=radarPoint(27,26,{...player,pos:{x:20,z:30}});assert.deepEqual(a,b);
});
