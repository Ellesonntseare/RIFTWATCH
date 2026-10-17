import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {createIceCover} from '../public/js/ice-cover.js';
test('ice cover rises, blocks bullets and movement, expires, syncs and enforces cooldown',()=>{
 const state={world:new THREE.Group(),wallMeshes:[]},ice=createIceCover(state),p=new THREE.Vector3();
 assert(ice.deploy(p,0,'a',0));assert(!ice.deploy(p,0,'a',1));ice.update(.5);state.world.updateMatrixWorld(true);
 assert(new THREE.Raycaster(new THREE.Vector3(0,1,4),new THREE.Vector3(0,0,-1),0,8).intersectObjects(state.wallMeshes).length>0);
 const body={x:0,z:0};ice.resolve(body,.4,0);assert(Math.abs(body.z)>1);
 const remote=createIceCover({world:new THREE.Group(),wallMeshes:[]});remote.apply(ice.snapshot());assert.equal(remote.walls.length,1);
 ice.update(18);assert.equal(ice.walls.length,0);assert.equal(state.wallMeshes.length,0);remote.apply(ice.snapshot());assert.equal(remote.walls.length,0);
 assert(ice.deploy(p,Math.PI/2,'a',26));ice.reset();assert.equal(state.world.children.length,0);
});
