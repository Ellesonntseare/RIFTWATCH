import test from 'node:test';
import assert from 'node:assert/strict';
import {damageBearing} from '../public/js/damage-direction.js';
test('incoming damage follows facing direction and never lights every side',()=>{
 const p={x:0,z:0};
 assert.equal(damageBearing(p,0,{x:0,z:-5}),0);
 assert.equal(damageBearing(p,0,{x:5,z:0}),Math.PI/2);
 assert.equal(damageBearing(p,0,{x:-5,z:0}),-Math.PI/2);
 assert.equal(Math.abs(damageBearing(p,0,{x:0,z:5})),Math.PI);
 assert(Math.abs(damageBearing(p,Math.PI/2,{x:-5,z:0}))<1e-8);
 assert.equal(damageBearing(p,0,p),null);
 assert.equal(damageBearing(p,0,{x:NaN,z:1}),null);
});
