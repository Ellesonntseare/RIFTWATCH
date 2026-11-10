// Rendering-independent perception. Only observations enter memory; never retain live target objects.
export function createBrain(random=Math.random,difficulty='standard') {
  const easy=difficulty==='relaxed';
  return {reaction:(easy?.65:.3)+random()*.35,range:easy?32:48,fov:Math.cos(Math.PI*.36),
    caution:random(),curiosity:.35+random()*.6,side:random()<.5?-1:1,
    target:null,memory:null,pending:new Map(),next:0,heard:new Set(),state:'patrol'};
}
export function perceive(brain,self,candidates,now,visible,sounds=[],random=Math.random) {
  if(now<brain.next)return;
  brain.next=now+.22+random()*.15;
  const noticed=[];
  for(const other of candidates){
    if(other.dead||other.id===self.id||self.team!==undefined&&self.team===other.team)continue;
    const dx=other.x-self.x,dz=other.z-self.z,d=Math.hypot(dx,dz);
    if(d>brain.range||(d>.01&&(dx*Math.sin(self.yaw)+dz*Math.cos(self.yaw))/d<brain.fov)||!visible(other,d))continue;
    noticed.push(other);
    if(!brain.pending.has(other.id))brain.pending.set(other.id,now);
  }
  const ids=new Set(noticed.map(p=>p.id));
  for(const id of brain.pending.keys())if(!ids.has(id))brain.pending.delete(id);
  const ready=noticed.filter(p=>now-brain.pending.get(p.id)>=brain.reaction);
  const target=ready.find(p=>p.id===brain.target)||ready.sort((a,b)=>Math.hypot(a.x-self.x,a.z-self.z)-Math.hypot(b.x-self.x,b.z-self.z))[0];
  brain.target=target?.id??null;
  if(target){brain.memory={x:target.x,y:target.y||0,z:target.z,until:now+6,kind:'sight'};brain.state='engage';}
  else {
    if(brain.memory?.until<now)brain.memory=null;
    for(const sound of sounds){
      if(sound.until<now||brain.heard.has(sound.id)||Math.hypot(sound.x-self.x,sound.z-self.z)>55)continue;
      brain.heard.add(sound.id);
      if(!brain.memory&&random()<brain.curiosity){const angle=random()*Math.PI*2,r=3+random()*5;brain.memory={x:sound.x+Math.sin(angle)*r,z:sound.z+Math.cos(angle)*r,y:self.y||0,until:now+5,kind:'sound'};}
    }
    brain.state=brain.memory?'investigate':'patrol';
  }
  if(brain.heard.size>100)brain.heard=new Set(sounds.map(s=>s.id));
}

// Decisions use an observed enemy, never a global player-location lookup.
// Keep a maneuver long enough to carry it out instead of changing it every frame.
export function combatPlan(brain,self,enemy,now,world,canAttack=true){
  const health=(self.hp||0)/(self.maxhp||100),distance=Math.hypot(enemy.x-self.x,enemy.z-self.z)||1;
  const urgent=health<.2+brain.caution*.25;
  if(brain.tactic&&brain.tactic.target===enemy.id&&now<brain.tactic.until&&brain.tactic.urgent===urgent&&brain.tactic.canAttack===canAttack)return brain.tactic;
  const nx=(enemy.x-self.x)/distance,nz=(enemy.z-self.z)/distance,preferred=12+brain.caution*12;
  let state=urgent?'retreat':!canAttack?'flank':distance>preferred+5?'approach':distance<7?'retreat':'reposition';
  let goal={x:self.x,z:self.z};
  if(state==='retreat')goal={x:self.x-nx*7-nz*brain.side*3,z:self.z-nz*7+nx*brain.side*3};
  else if(state==='approach')goal={x:enemy.x-nx*preferred-nz*brain.side*4,z:enemy.z-nz*preferred+nx*brain.side*4};
  else goal={x:self.x-nz*brain.side*6,z:self.z+nx*brain.side*6};
  // Reloading and wounded bots prioritize a nearby occluded position.
  if(urgent||self.reloading||self.ammo!==undefined&&self.ammo<6){
    let best=null,score=Infinity;
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,p={x:self.x+Math.sin(angle)*6,z:self.z+Math.cos(angle)*6};
      if(!world.walkable(p.x,p.z)||world.visible(p,enemy))continue;
      const value=Math.hypot(p.x-goal.x,p.z-goal.z);if(value<score){best=p;score=value;}
    }
    if(best){goal=best;state='cover';}
  }
  if(!world.walkable(goal.x,goal.z)){
    brain.side*=-1;goal={x:self.x+nz*brain.side*4,z:self.z-nx*brain.side*4};
    if(!world.walkable(goal.x,goal.z))goal={x:self.x,z:self.z};
  }
  return brain.tactic={target:enemy.id,state,goal,urgent,canAttack,until:now+1.5+brain.caution*.8};
}

// Bounded A*: each edge is checked using the world's actual collision query.
// No diagonal corner cutting; failure returns no path rather than a path through a wall.
export function findRoute(start,goal,clear,{step=2,maxNodes=220}={}) {
  const key=(x,z)=>x+','+z, nodes=new Map(),open=[];
  const first={x:0,z:0,g:0,f:0,parent:null};open.push(first);nodes.set('0,0',first);
  const point=n=>({x:start.x+n.x*step,z:start.z+n.z*step});
  for(let count=0;open.length&&count<maxNodes;count++){
    open.sort((a,b)=>a.f-b.f);const current=open.shift(),p=point(current);current.closed=true;
    if(Math.hypot(p.x-goal.x,p.z-goal.z)<step*1.5&&clear(p,goal)){
      const route=[{x:goal.x,z:goal.z}];for(let n=current;n.parent;n=n.parent)route.unshift(point(n));return route;
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=current.x+dx,z=current.z+dz,k=key(x,z),old=nodes.get(k),q={x:start.x+x*step,z:start.z+z*step};
      if(old?.closed||!clear(p,q))continue;
      if(dx&&dz&&(!clear(p,{x:q.x,z:p.z})||!clear(p,{x:p.x,z:q.z})))continue;
      const g=current.g+Math.hypot(dx,dz)*step;
      if(old&&g>=old.g)continue;
      const n=old||{x,z};Object.assign(n,{g,f:g+Math.hypot(q.x-goal.x,q.z-goal.z),parent:current});
      if(!old){nodes.set(k,n);open.push(n);}
    }
  }
  return [];
}
