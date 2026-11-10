import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spectatorTarget,spectatorHeading} from '../public/js/royale-spectator.js';
test('spectator follows killer, cycles survivors and switches when watched competitor dies',()=>{
  const s={participants:[{id:'local',alive:false},{id:'a',alive:true},{id:'b',alive:true}],events:[{type:'elimination',victim:'local',killer:'b'}]};
  assert.equal(spectatorTarget(s,null),'b');assert.equal(spectatorTarget(s,'b','local',true),'a');
  assert.equal(spectatorTarget(s,'a'),'a');s.participants[1].alive=false;
  assert.equal(spectatorTarget(s,'a'),'b');s.participants[2].alive=false;assert.equal(spectatorTarget(s,'b'),null);
});
test('spectator turns smoothly across the angle boundary and resets when changing survivor',()=>{
  const prior={id:'a',yaw:Math.PI-.02};
  const next=spectatorHeading(prior,{id:'a',yaw:-Math.PI*2+.02},1/60);
  assert.ok(next.yaw>prior.yaw&&next.yaw-prior.yaw<.02);
  assert.deepEqual(spectatorHeading(prior,{id:'b',yaw:0},1/60),{id:'b',yaw:Math.PI});
});
