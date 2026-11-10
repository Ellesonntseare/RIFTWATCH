import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
const source=readFileSync(new URL('../public/js/main.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function moveBody('),source.indexOf('const attackCoordinator='));
test('swept player and enemy movement cannot cross thin mesh walls on a long frame',()=>{
  const geometry=new THREE.BoxGeometry(.04,4,10),wall=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  wall.position.set(1,2,0);wall.updateMatrixWorld(true);
  const context=vm.createContext({THREE,state:{collMesh:wall},resolveCircle:()=>0,
    castRay:(o,d,far)=>new THREE.Raycaster(o,d,0,far).intersectObject(wall)[0]});
  vm.runInContext(body,context);
  for(const climb of [true,false]){const p={x:0,z:0};context.moveBody(p,8,0,.35,0,climb);assert.ok(p.x<.98);}
  const free={x:0,z:0};context.moveBody(free,0,3,.35,0,true);assert.ok(Math.abs(free.z-3)<1e-6);
  geometry.dispose();wall.material.dispose();
});
test('movement rejects a missing floor rather than entering terrain',()=>{
  const context=vm.createContext({THREE,state:{collMesh:{}},castRay:()=>null,resolveCircle:()=>-1e9});
  vm.runInContext(body,context);const p={x:0,z:0};context.moveBody(p,4,0,.35,0,false);assert.equal(p.x,0);
});
