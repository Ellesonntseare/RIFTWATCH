const TARGET_KILLS=5;
const RESPAWN_MS=4000;
function shotHit(from,to,feet){
  const dx=to[0]-from[0],dz=to[2]-from[2],length=dx*dx+dz*dz;
  if(length<.01)return null;
  const t=Math.max(0,Math.min(1,((feet[0]-from[0])*dx+(feet[2]-from[2])*dz)/length));
  if(t<.002||t>.998)return null;
  const x=from[0]+dx*t,z=from[2]+dz*t,y=from[1]+(to[1]-from[1])*t;
  if(Math.hypot(x-feet[0],z-feet[2])>.62||y<feet[1]-.1||y>feet[1]+1.95)return null;
  return {head:y>feet[1]+1.43,point:[x,y,z]};
}
module.exports={shotHit,TARGET_KILLS,RESPAWN_MS};
