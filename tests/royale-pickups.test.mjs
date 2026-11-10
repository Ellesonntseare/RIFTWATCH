import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRoyalePickupFactory} from '../public/js/royale-pickups.js';
test('royale loot uses shared gun and vest models plus detailed supply meshes at ground height',()=>{
  const gun=new THREE.Mesh(new THREE.BoxGeometry(1,.2,.1),new THREE.MeshBasicMaterial());
  const vest=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.2),new THREE.MeshBasicMaterial());
  const create=createRoyalePickupFactory(gun,vest);
  for(const kind of ['rifle','smg','armor','med','ammo']){
    const first=create(kind),second=create(kind);first.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(first.children[0]);
    assert.ok(bounds.min.y>=.07);assert.ok(bounds.max.y<1);
    assert.notEqual(first,second);assert.equal(first.children[0].children[0].geometry,second.children[0].children[0].geometry);
    if(['med','ammo'].includes(kind))assert.ok(first.children[0].children.length>=3,'supplies contain multiple modeled material groups');
  }
});
