export function spectatorTarget(snapshot,current,selfId='local',cycle=false){
  const living=snapshot.participants.filter(p=>p.alive&&p.id!==selfId);
  if(!living.length)return null;
  const index=living.findIndex(p=>p.id===current);
  if(cycle)return living[(index+1)%living.length].id;
  if(index>=0)return current;
  const death=[...snapshot.events].reverse().find(e=>e.type==='elimination'&&e.victim===selfId);
  return living.find(p=>p.id===death?.killer)?.id||living[0].id;
}

// Keep the spectator heading separate from the eliminated player's camera.
// Bot headings arrive in simulation steps, so interpolate across the shortest arc.
export function spectatorHeading(previous,target,dt){
  const heading=target.yaw+Math.PI;
  if(!previous||previous.id!==target.id)return {id:target.id,yaw:heading};
  const delta=Math.atan2(Math.sin(heading-previous.yaw),Math.cos(heading-previous.yaw));
  return {id:target.id,yaw:previous.yaw+delta*(1-Math.exp(-Math.max(0,dt)*12))};
}
