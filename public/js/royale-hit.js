// Match the upright 1.85 m gunner instead of testing only a point on the ground.
export function hitRoyaleBody(origin,direction,target,maxDistance=180){
  let near=0,far=maxDistance;
  const low=[target.x-.48,(target.y||0)+.05,target.z-.48];
  const high=[target.x+.48,(target.y||0)+1.9,target.z+.48];
  for(let axis=0;axis<3;axis++){
    const d=direction[axis],p=origin[axis];
    if(Math.abs(d)<1e-8){if(p<low[axis]||p>high[axis])return null;continue;}
    const a=(low[axis]-p)/d,b=(high[axis]-p)/d;
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
    if(near>far)return null;
  }
  return far>0&&near<maxDistance?near:null;
}
