import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../public/js/maps.js';
test('royale doubles the battlefield dimensions without enlarging people or existing architecture',()=>{
  assert.deepEqual(MAPS.royale.size,MAPS.outpost.size.map(n=>n*2));
  const roofs=map=>map.blocks.filter(b=>b[0]==='roof');
  // Both maps also receive three imported office buildings from scenery.js.
  assert.equal(roofs(MAPS.royale).length+3,(roofs(MAPS.outpost).length+3)*3);
  assert.equal(MAPS.royale.cars.length,18);
  for(const b of roofs(MAPS.royale)){assert.ok(b[5]>=3&&b[5]<=6);assert.ok(Math.abs(b[1])+b[3]/2<200);assert.ok(Math.abs(b[2])+b[4]/2<200);}
});
