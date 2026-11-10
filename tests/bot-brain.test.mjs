import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrain,perceive,findRoute} from '../public/js/bot-brain.js';
const self={id:'bot',x:0,z:0,yaw:0,team:1};
const target={id:'human',x:0,z:10,team:2};
const random=()=>.5;
function observe(b,c,t,visible=()=>true,sounds=[]){perceive(b,self,c,t,visible,sounds,random);}
test('vision needs field of view, line of sight and recognition time',()=>{
  const b=createBrain(random);observe(b,[target],0);assert.equal(b.target,null);
  observe(b,[target],1);assert.equal(b.target,'human');
  observe(b,[{...target,z:-10}],2);assert.equal(b.target,null);
  observe(b,[target],3,()=>false);assert.equal(b.target,null);
});
test('lost targets leave detached last-seen memory that expires',()=>{
  const b=createBrain(random),p={...target};observe(b,[p],0);observe(b,[p],1);
  p.x=90;observe(b,[p],2);assert.equal(b.memory.x,0);assert.equal(b.target,null);
  observe(b,[],8);assert.equal(b.memory,null);
});
test('teammates are excluded and targets stay committed',()=>{
  const b=createBrain(random);observe(b,[target,{...target,id:'friend',team:1}],0);observe(b,[target],1);
  observe(b,[target,{...target,id:'other',z:4}],2);observe(b,[target,{...target,id:'other',z:4}],3);
  assert.equal(b.target,'human');
});
test('hearing gives an uncertain point without shooter identity',()=>{
  const b=createBrain(random),s={id:1,x:12,z:0,until:2};observe(b,[],0,()=>true,[s]);
  assert.equal(b.target,null);assert.equal(b.memory.kind,'sound');
  assert.ok(Math.hypot(b.memory.x-s.x,b.memory.z-s.z)>=3);
});
test('route travels around a building without crossing its walls',()=>{
  const clear=(a,b)=>{for(let t=0;t<=1;t+=.05){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(x>3&&x<9&&z>-5&&z<5)return false;}return true;};
  const start={x:0,z:0},goal={x:12,z:0},route=findRoute(start,goal,clear);
  assert.ok(route.length>1);let previous=start;for(const p of route){assert.ok(clear(previous,p));previous=p;}
  assert.deepEqual(route.at(-1),goal);
  assert.deepEqual(findRoute(start,goal,()=>false),[]);
});
