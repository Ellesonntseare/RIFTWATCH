// Bearing in screen space: front=0, right=PI/2, rear=PI, left=-PI/2.
export function damageBearing(player,yaw,source){
  if(!source||!Number.isFinite(source.x)||!Number.isFinite(source.z))return null;
  const dx=source.x-player.x,dz=source.z-player.z;if(Math.hypot(dx,dz)<.001)return null;
  return Math.atan2(Math.cos(yaw)*dx-Math.sin(yaw)*dz,-Math.sin(yaw)*dx-Math.cos(yaw)*dz);
}
