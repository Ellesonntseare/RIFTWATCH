// Per-target attack leases: other enemies may maneuver, but cannot deal attacks.
export function createAttackCoordinator(limit=3){
  const leases=new Map(),rest=new Map();let nextAdmission=0;
  return {update(enemies,now){
    const valid=new Map(enemies.filter(e=>!e.dead&&e.target!==null&&e.visible).map(e=>[e.id,e]));
    for(const [id,lease] of leases){
      const e=valid.get(id);
      if(!e||e.target!==lease.target||now>=lease.until){leases.delete(id);rest.set(id,now+2);}
    }
    const waiting=[...valid.values()].filter(e=>!leases.has(e.id)&&(rest.get(e.id)||0)<=now).sort((a,b)=>a.distance-b.distance);
    if(now>=nextAdmission)for(const e of waiting){
      if([...leases.values()].filter(l=>l.target===e.target).length>=limit)continue;
      leases.set(e.id,{target:e.target,until:now+6});nextAdmission=now+.45;break;
    }
    for(const id of rest.keys())if(!valid.has(id)&&rest.get(id)<now)rest.delete(id);
  },allows(id){return leases.has(id);},clear(){leases.clear();rest.clear();nextAdmission=0;}};
}
