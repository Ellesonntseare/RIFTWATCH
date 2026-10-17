// Keep the same transparent-fence policy as shooting. Walls still hide enemies.
export function aimsAtEnemy(ray,enemies,walls){
  const enemy=ray.intersectObjects(enemies,true)[0];if(!enemy)return false;
  const wall=ray.intersectObjects(walls,true).find(hit=>!hit.object.geometry?.userData.bulletPass?.[hit.faceIndex]);
  return !wall||enemy.distance<wall.distance;
}
