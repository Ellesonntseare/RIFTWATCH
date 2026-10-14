export function isWaterSurface(object){
  const materials=Array.isArray(object.material)?object.material:[object.material];
  return /water|ocean|river|pond/i.test([object.name,...materials.map(m=>m?.name||'')].join(' '));
}
export function submergedFloor(groundY,waterY){return Number.isFinite(waterY)&&(groundY===null||waterY>groundY+.03);}
export function mapWorldScale(map,size){return map.worldScale??map.fit/Math.max(size.x,size.z);}
