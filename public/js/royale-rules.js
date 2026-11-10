import {hitRoyaleBody} from './royale-hit.js';
import {createAttackCoordinator} from './attack-coordinator.js';
import {createBrain,perceive,findRoute,combatPlan} from './bot-brain.js';
// Engine-independent match authority, shared by the browser (solo) and server.
// The world adapter owns walkability and line of sight; it must not come from clients.
export function createRoyale({players,botCount=20,duration=600,seed=1,difficulty='standard',world}){
  if(!world?.walkable||!world?.visible||!world?.spawn)throw Error('Royale requires authoritative world queries');
  if(!Array.isArray(players)||!players.length||players.length>4)throw Error('Royale needs 1–4 human competitors');
  if(new Set(players.map(p=>p.id)).size!==players.length)throw Error('Duplicate participant id');
  botCount=Math.max(1,Math.min(40,Math.floor(Number(botCount)||20)));
  duration=Math.max(120,Math.min(1800,Number(duration)||600));
  const random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const contestants=new Map(),loot=new Map(),events=[],sounds=[];
  const attacks=createAttackCoordinator(3);
  let soundId=0;
  let time=0,phase='prepare',winner=null,eventId=0,zonePhase=-1,zoneStart=0;
  const initialRadius=world.radius,zone={x:0,z:0,radius:initialRadius,nextX:0,nextZ:0,nextRadius:initialRadius,closing:false,countdown:10};
  const tuning=difficulty==='relaxed'?{sight:28,accuracy:.22,reaction:.8}:{sight:44,accuracy:.42,reaction:.4};
  function emit(type,data){events.push({seq:++eventId,time,type,...data});if(events.length>100)events.shift();}
  function spawn(){for(let i=0;i<1000;i++){const p=world.spawn(random);if(world.walkable(p.x,p.z)&&[...contestants.values()].every(o=>distance(p,o)>14))return p;}throw Error('Not enough reachable, separated spawn locations');}
  for(const entry of [...players.map(p=>({...p,bot:false})),...Array.from({length:botCount},(_,i)=>({id:'bot-'+i,name:'Hunter '+(i+1),bot:true}))]){
    const pos=spawn();contestants.set(entry.id,{id:entry.id,name:String(entry.name||'Operator').slice(0,24),bot:entry.bot,...pos,hp:100,armor:0,kills:0,alive:true,placement:null,survival:0,weapon:null,ammo:0,reserve:0,meds:0,reload:0,nextShot:0,think:0,target:null,memory:null,goal:null,state:'prepare',aggression:.3+random()*.7,accuracy:tuning.accuracy*(.8+random()*.4),yaw:random()*Math.PI*2,moving:false});
  }
  let lootId=0;
  function addLoot(kind,p){const id='loot-'+(++lootId);loot.set(id,{id,kind,x:p.x,z:p.z});}
  // A useful first weapon lies near every competitor; contested locations get extra loot.
  for(const p of contestants.values()){let placed=false;for(let i=0;i<24&&!placed;i++){const a=random()*Math.PI*2,r=3+random()*5,q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};if(world.walkable(q.x,q.z)&&world.visible(p,q)){addLoot('rifle',q);placed=true;}}if(!placed)addLoot('rifle',p);}
  for(let i=0;i<(botCount+players.length)*4;i++){const p=world.spawn(random);if(world.walkable(p.x,p.z))addLoot(['ammo','med','armor','rifle','smg'][i%5],p);}
  function living(){return [...contestants.values()].filter(p=>p.alive);}
  function finish(){const alive=living();if(phase==='active'&&alive.length<=1){phase='finished';winner=alive[0]?.id||null;if(alive[0]){alive[0].placement=1;alive[0].survival=time;}emit('result',{winner});}}
  function damage(victimId,amount,killerId=null,weapon='zone'){
    if(phase!=='active'||!Number.isFinite(amount)||amount<=0)return false;
    const p=contestants.get(victimId),killer=contestants.get(killerId);if(!p?.alive||killerId===victimId||killerId&&!killer?.alive)return false;
    if(time<20&&weapon!=='zone'&&weapon!=='disconnect')return false;
    if(killer&&p.brain){p.brain.tactic=null;p.brain.caution=Math.min(1,p.brain.caution+.08);}
    const absorb=weapon==='zone'?0:Math.min(p.armor,amount*.6);p.armor-=absorb;p.hp=Math.max(0,p.hp-(amount-absorb));
    if(!p.hp){p.alive=false;p.moving=false;p.state='eliminated';p.placement=living().length+1;p.survival=time;if(killer)killer.kills++;emit('elimination',{killer:killerId,killerName:killer?.name||'Safe zone',victim:p.id,victimName:p.name,weapon});if(p.weapon)addLoot(p.weapon,p);if(p.reserve)addLoot('ammo',p);finish();}return true;
  }
  function pickup(id,itemId){const p=contestants.get(id),item=loot.get(itemId);if(phase!=='active'||!p?.alive||!item||distance(p,item)>2.5||!world.visible(p,item))return false;
    if(item.kind==='med'&&p.meds>=2||item.kind==='armor'&&p.armor>=100||item.kind==='ammo'&&p.reserve>=180)return false;
    if(item.kind==='rifle'||item.kind==='smg'){p.weapon=item.kind;p.ammo=item.kind==='smg'?35:30;p.reserve=Math.min(180,p.reserve+60);p.reload=0;}
    else if(item.kind==='ammo')p.reserve=Math.min(180,p.reserve+60);else if(item.kind==='med')p.meds++;else p.armor=100;
    loot.delete(itemId);emit('pickup',{participant:id,item:itemId});return true;
  }
  function heal(id){const p=contestants.get(id);if(phase!=='active'||!p?.alive||!p.meds||p.hp>=100)return false;p.meds--;p.hp=Math.min(100,p.hp+50);return true;}
  function reload(id){const p=contestants.get(id);if(phase!=='active'||!p?.alive||!p.weapon||p.reload||!p.reserve||p.ammo>=(p.weapon==='smg'?35:30))return false;p.reload=1.3;return true;}
  function fire(id,direction,shotOrigin=null,renderFraction=0){const p=contestants.get(id);
    const shotTime=time+(!p?.bot&&Number.isFinite(renderFraction)?Math.max(0,Math.min(.05,renderFraction)):0);
    if(phase!=='active'||!p?.alive||!p.weapon||!p.ammo||p.reload||shotTime+1e-8<p.nextShot||!Array.isArray(direction)||direction.length!==3||!direction.every(Number.isFinite))return false;
    const length=Math.hypot(...direction);if(length<.9||length>1.1)return false;
    const origin=shotOrigin||[p.x,1.3,p.z];
    if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isFinite)||Math.hypot(origin[0]-p.x,origin[2]-p.z)>2.5||origin[1]<0||origin[1]>5)return false;
    p.ammo--;const interval=p.bot?(p.weapon==='smg'?.1:.16):60/700;
    p.nextShot=p.bot?time+interval:Math.max(p.nextShot,shotTime-1/30)+interval;sounds.push({id:++soundId,x:p.x,z:p.z,until:time+2});
    let target,head=false;
    if(!p.bot&&world.raycast){
      const result=world.raycast(origin,direction,250);const actor=contestants.get(result?.id);
      if(actor?.alive&&actor.id!==id){target=actor;head=!!result.head;}
    }else{
      const candidates=living().filter(q=>q.id!==id).map(q=>({q,along:hitRoyaleBody(origin,direction,q)})).filter(({q,along})=>along!==null&&world.visible(p,q)).sort((a,b)=>a.along-b.along);
      target=candidates[0]?.q;
    }
    const hit=target?damage(target.id,(p.weapon==='smg'?15:25)*(head?4:1),id,p.weapon):false;
    emit('shot',{participant:id,x:p.x,z:p.z,dx:direction[0],dy:direction[1],dz:direction[2],target:hit?target.id:null,weapon:p.weapon});return true;
  }
  function move(id,x,z,dt){const p=contestants.get(id);if(phase!=='active'||!p?.alive||![x,z,dt].every(Number.isFinite)||dt<=0)return false;const d=distance(p,{x,z});if(d>10*Math.min(.25,dt)+.1)return false;
    const n=Math.max(1,Math.ceil(d/.4));for(let i=1;i<=n;i++)if(!world.walkable(p.x+(x-p.x)*i/n,p.z+(z-p.z)*i/n))return false;
    if(d>.01)p.yaw=Math.atan2(x-p.x,z-p.z);p.moving=d>.01;p.x=x;p.z=z;return true;}
  let routeBudget=0;
  function clearRoute(a,b){const d=distance(a,b),n=Math.max(1,Math.ceil(d/.3));for(let i=1;i<=n;i++)if(!world.walkable(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
  function walk(p,goal,dt){
    p.moving=false;
    if(p.route?.length&&distance(p,p.route[0])<.6)p.route.shift();
    if(time>=(p.routeAt||0)&&routeBudget>0){
      routeBudget--;p.routeAt=time+1+random()*.5;
      p.route=clearRoute(p,goal)?[]:findRoute(p,goal,clearRoute,{step:2,maxNodes:180});
    }
    const waypoint=p.route?.[0]||goal,angle=Math.atan2(waypoint.x-p.x,waypoint.z-p.z);
    for(const turn of [0,.65,-.65,1.25,-1.25]){const a=angle+turn,step=Math.min(distance(p,waypoint),dt*4.3);
      if(move(p.id,p.x+Math.sin(a)*step,p.z+Math.cos(a)*step,dt)){p.stuck=0;return;}}
    p.stuck=(p.stuck||0)+dt;
    if(p.stuck>1.5){p.goal=null;p.route=null;p.routeAt=0;p.memory=null;p.stuck=0;}
  }
  function think(p,dt){
    const outside=distance(p,zone)>zone.radius-5;
    if(outside){p.state='escape-zone';p.goal={x:zone.nextX,z:zone.nextZ};walk(p,p.goal,dt);return;}
    p.think-=dt;if(p.think<=0){p.think=.25+random()*.2;
      p.brain ||= createBrain(random,difficulty);
      perceive(p.brain,p,living(),time,q=>world.visible(p,q),sounds,random);
      if(p.target!==p.brain.target)p.nextShot=Math.max(p.nextShot,time+p.brain.reaction);
      p.target=p.brain.target;p.memory=p.brain.memory;

    }
    const enemy=contestants.get(p.target);
    if(p.hp<45&&p.meds&&(!enemy||!world.visible(p,enemy))){p.state='heal';heal(p.id);return;}
    if(enemy?.alive&&p.weapon&&p.ammo&&world.visible(p,enemy)){
      const plan=combatPlan(p.brain,p,enemy,time,world,attacks.allows(p.id));p.state=plan.state;
      if(distance(p,plan.goal)>1)walk(p,plan.goal,dt);else p.moving=false;
      if(p.ammo<6&&p.reserve&&!p.reload&&p.state==='cover'&&!world.visible(p,enemy))reload(p.id);
      p.yaw=Math.atan2(enemy.x-p.x,enemy.z-p.z);
      if(attacks.allows(p.id)&&time>=20&&world.visible(p,enemy)){const angle=Math.atan2(enemy.x-p.x,enemy.z-p.z)+(random()>p.accuracy?(random()-.5)*.35:0);if(fire(p.id,[Math.sin(angle),0,Math.cos(angle)])){p.burst=(p.burst||0)+1;if(p.burst>=2){p.burst=0;p.nextShot=time+(difficulty==='relaxed'?2.2:1.3)+random()*.5;}}}return;
    }
    if(p.weapon&&!p.ammo&&p.reserve){p.state='reload';reload(p.id);return;}
    const needed=[...loot.values()].filter(l=>(!p.weapon?['rifle','smg'].includes(l.kind):l.kind==='ammo'&&p.reserve<60||l.kind==='med'&&p.meds<2||l.kind==='armor'&&p.armor<40)&&distance(p,l)<35&&world.visible(p,l)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(needed){p.state='loot';if(!pickup(p.id,needed.id))walk(p,needed,dt);return;}
    if(p.memory){p.state='investigate';walk(p,p.memory,dt);if(distance(p,p.memory)<2)p.memory=null;return;}
    p.state='explore';if(!p.goal||distance(p,p.goal)<2||random()<.005){for(let i=0;i<20;i++){const goal=world.spawn(random);if(world.walkable(goal.x,goal.z)&&distance(goal,zone)<zone.radius){p.goal=goal;break;}}}if(p.goal)walk(p,p.goal,dt);
  }
  function tick(dt){if(!Number.isFinite(dt)||dt<=0||phase==='finished')return;dt=Math.min(.1,dt);time+=dt;routeBudget=1;
    if(phase==='prepare'){zone.countdown=Math.max(0,10-time);if(time>=10){phase='active';emit('start',{});}return;}
    const elapsed=time-10,cycle=duration/5,index=Math.min(4,Math.floor(elapsed/cycle)),fraction=Math.min(1,(elapsed%cycle)/cycle);
    if(index!==zonePhase){zonePhase=index;zoneStart=zone.radius;zone.nextRadius=initialRadius*[.72,.48,.28,.12,.025][index];
      for(let i=0;i<100;i++){const angle=random()*Math.PI*2,r=random()*Math.max(0,zone.radius-zone.nextRadius),x=zone.x+Math.cos(angle)*r,z=zone.z+Math.sin(angle)*r;if(world.walkable(x,z)){zone.nextX=x;zone.nextZ=z;break;}}
      zone.fromX=zone.x;zone.fromZ=zone.z;emit('zone',{phase:index+1});}
    zone.closing=fraction>.4;zone.countdown=cycle*(zone.closing?1-fraction:.4-fraction);
    const k=elapsed>=duration?1:Math.max(0,(fraction-.4)/.6);zone.x=zone.fromX+(zone.nextX-zone.fromX)*k;zone.z=zone.fromZ+(zone.nextZ-zone.fromZ)*k;zone.radius=zoneStart+(zone.nextRadius-zoneStart)*k;
    if(elapsed>=duration)zone.radius=Math.max(0,zone.nextRadius-(elapsed-duration)*.3);
    attacks.update([...contestants.values()].filter(p=>p.bot).map(p=>({id:p.id,dead:!p.alive,target:p.target,visible:!!p.target&&contestants.get(p.target)?.alive&&world.visible(p,contestants.get(p.target)),distance:p.target&&contestants.has(p.target)?distance(p,contestants.get(p.target)):Infinity})),time);
    for(const p of contestants.values()){if(!p.alive)continue;if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload){const amount=Math.min((p.weapon==='smg'?35:30)-p.ammo,p.reserve);p.ammo+=amount;p.reserve-=amount;}}
      if(distance(p,zone)>zone.radius)damage(p.id,(2+zonePhase*3)*dt);
      if(p.alive&&p.bot&&phase==='active')think(p,dt);}
    while(sounds.length&&sounds[0].until<time)sounds.shift();finish();
  }
  function snapshot(){return {time,phase,winner,zone:{...zone},remaining:living().length,participants:[...contestants.values()].map(({route,routeAt,stuck,brain,think,target,memory,goal,accuracy,nextShot,...p})=>({...p})),loot:[...loot.values()].map(l=>({...l})),events:events.map(e=>({...e}))};}
  return {tick,move,fire,pickup,reload,heal,snapshot,disconnect(id){const p=contestants.get(id);if(p?.alive){if(phase==='prepare'){p.alive=false;p.hp=0;p.placement=living().length+1;}else damage(id,10000,null,'disconnect');}}};
}
