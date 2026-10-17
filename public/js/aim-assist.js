export function chooseAssistTarget(position,yaw,pitch,targets,visible){
 let best=null,score=.28;
 for(const target of targets){if(target.dead)continue;const dx=target.x-position.x,dy=target.y-position.y,dz=target.z-position.z,d=Math.hypot(dx,dz);if(d<.5||d>55)continue;
 const y=Math.atan2(-dx,-dz),p=Math.atan2(dy,d),delta=Math.atan2(Math.sin(y-yaw),Math.cos(y-yaw)),error=Math.hypot(delta,p-pitch);
 if(error<score&&visible(target)){score=error;best={yaw:yaw+delta,pitch:p};}}
 return best;
}
