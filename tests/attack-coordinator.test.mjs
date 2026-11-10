import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAttackCoordinator} from '../public/js/attack-coordinator.js';
const enemies=()=>Array.from({length:8},(_,id)=>({id,target:'player',visible:true,dead:false,distance:id+2}));
test('at most three attackers; each death releases a slot for a replacement',()=>{
  const c=createAttackCoordinator(3),bots=enemies();
  for(let t=0;t<2;t+=.5)c.update(bots,t);
  assert.equal(bots.filter(b=>c.allows(b.id)).length,3);
  for(let i=0;i<5;i++){
    const victim=bots.find(b=>c.allows(b.id));victim.dead=true;
    c.update(bots,2+i*.6);
    assert.equal(c.allows(victim.id),false);
    assert.equal(bots.filter(b=>c.allows(b.id)).length,Math.min(3,bots.filter(b=>!b.dead).length));
  }
});
test('hidden targets cannot retain attack slots and reset clears previous match',()=>{
  const c=createAttackCoordinator(),bots=enemies();c.update(bots,0);
  bots[0].visible=false;c.update(bots,.5);assert.equal(c.allows(0),false);
  c.clear();assert.ok(bots.every(b=>!c.allows(b.id)));
});
