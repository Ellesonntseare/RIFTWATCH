import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {aimsAtEnemy} from '../public/js/aim-target.js';
test('enemy aim feedback rejects misses and enemies hidden by walls',()=>{
  const enemy=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());enemy.position.z=-5;enemy.updateMatrixWorld(true);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(3,3,.2),new THREE.MeshBasicMaterial());wall.position.z=-2;wall.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1),0,100);
  assert(aimsAtEnemy(ray,[enemy],[]));assert(!aimsAtEnemy(ray,[enemy],[wall]));
  wall.geometry.userData.bulletPass=new Uint8Array(12).fill(1);assert(aimsAtEnemy(ray,[enemy],[wall]));
  ray.ray.direction.set(1,0,0);assert(!aimsAtEnemy(ray,[enemy],[]));
});
