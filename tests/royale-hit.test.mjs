import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hitRoyaleBody} from '../public/js/royale-hit.js';
const origin=[0,1.3,0],target={x:0,z:10};
const directionTo=(x,y,z)=>{const a=[x,y-1.3,z],length=Math.hypot(...a);return a.map(n=>n/length);};
test('royale shots register at feet, torso and head, including steep close-range aim',()=>{
  for(const distance of [1.5,5,30])for(const height of [.1,.9,1.8])assert.notEqual(hitRoyaleBody(origin,directionTo(0,height,distance),{x:0,z:distance}),null);
});
test('royale body test rejects shots over, beside, behind and beyond opponents',()=>{
  assert.equal(hitRoyaleBody(origin,directionTo(0,3,10),target),null);
  assert.equal(hitRoyaleBody(origin,directionTo(2,1.3,10),target),null);
  assert.equal(hitRoyaleBody(origin,[0,0,-1],target),null);
  assert.equal(hitRoyaleBody(origin,[0,0,1],{x:0,z:200}),null);
});
