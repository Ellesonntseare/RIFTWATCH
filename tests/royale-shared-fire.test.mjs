import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRoyale} from '../public/js/royale-rules.js';

test('campaign and royale use the same trigger, cadence and fire animation path',()=>{
  const main=fs.readFileSync(new URL('../public/js/main.js',import.meta.url),'utf8');
  const source=main.slice(main.indexOf('function handleShooting(dt)'),main.indexOf('function playAttack(',main.indexOf('function handleShooting(dt)')));
  for(const mode of ['campaign','royale']){
    let shots=0,animations=0;
    const P={dead:false,unarmed:false,ammo:30,fireCd:0,reloading:0},state={gameMode:mode};
    const context=vm.createContext({P,state,icePlacement:false,mouseDown:true,meleeTimer:0,rifleAnimTimer:0,CFG:{gun:{rpm:700}},sfx:{empty(){}},fire(){shots++;},playAttack(){animations++;},startReload(){},startMelee(){}});
    vm.runInContext(source,context);context.handleShooting(.016);context.handleShooting(.016);
    assert.equal(shots,1);assert.equal(animations,1);assert.ok(P.fireCd>0);
    assert.equal(P.ammo,mode==='royale'?30:29,'royale authority owns its ammo decrement');
  }
});

test('royale rendered-mesh hit consumes one round and applies damage once; wall misses do no damage',()=>{
  const spawns=[{x:0,z:0},{x:25,z:0},{x:-25,z:25}];let index=0,result=null,queries=0;
  const match=createRoyale({players:[{id:'human'},{id:'other'}],botCount:1,seed:41,duration:600,
    world:{radius:150,walkable:()=>true,visible:(a,b)=>!('alive' in b),spawn:()=>spawns[index++%3],raycast:()=>{queries++;return result;}}});
  for(let i=0;i<110;i++)match.tick(.1);
  let snapshot=match.snapshot(),p=snapshot.participants.find(p=>p.id==='human');
  const rifle=snapshot.loot.find(l=>l.kind==='rifle'&&Math.hypot(l.x-p.x,l.z-p.z)<9);
  for(let i=0;i<100&&Math.hypot(p.x-rifle.x,p.z-rifle.z)>1;i++){
    const d=Math.hypot(rifle.x-p.x,rifle.z-p.z),step=Math.min(.8,d);
    match.move('human',p.x+(rifle.x-p.x)/d*step,p.z+(rifle.z-p.z)/d*step,.1);p=match.snapshot().participants.find(p=>p.id==='human');
  }
  assert.ok(match.pickup('human',rifle.id));
  for(let i=0;i<100;i++)match.tick(.1);
  const before=match.snapshot().participants.find(p=>p.id==='human');
  result={id:'other',head:false};
  assert.ok(match.fire('human',[1,0,0],[before.x+.1,1.3,before.z]));
  snapshot=match.snapshot();
  assert.equal(snapshot.participants.find(p=>p.id==='human').ammo,before.ammo-1);
  assert.equal(snapshot.participants.find(p=>p.id==='other').hp,75);
  assert.equal(queries,1);
  assert.equal(match.fire('human',[1,0,0]),false,'no second shot inside cooldown');
  match.tick(.1);result=null;
  assert.ok(match.fire('human',[1,0,0]));
  assert.equal(match.snapshot().participants.find(p=>p.id==='other').hp,75);
  match.tick(.1);
  assert.equal(match.fire('human',[1,0,0],[999,1.3,999]),false);
  assert.equal(queries,2,'invalid remote origins never reach the ray query');
});
