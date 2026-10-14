import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {isWaterSurface,submergedFloor,mapWorldScale} from '../public/js/terrain.js';import {MAPS} from '../public/js/maps.js';
const main=fs.readFileSync('public/js/main.js','utf8');
const source=main.slice(main.indexOf('function buildCollision('),main.indexOf('const tick ='));
const build=new Function('THREE','BVH','isWaterSurface',source+'return buildCollision;')(THREE,null,isWaterSurface);
test('collision separates water from solid floors even when water is opaque',()=>{
 const root=new THREE.Group(),floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial()),water=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial());
 water.material.name='WaterBasicNighttime';floor.name='ground';root.add(floor,water);root.updateMatrixWorld(true);
 const dry=build(root),wet=build(root,true);assert.equal(dry.geometry.attributes.position.count,4);assert.equal(wet.geometry.attributes.position.count,4);
 assert(isWaterSurface(water));assert(!isWaterSurface(floor));
});
test('water rejects submerged ground but permits bridges above its surface',()=>{
 assert(submergedFloor(-2,0));assert(submergedFloor(null,0));assert(!submergedFloor(2,0));assert(!submergedFloor(0,undefined));
});
test('world scales restore human-sized benches and shipping containers',()=>{
 assert.equal(mapWorldScale({fit:300},{x:150,z:100}),2);
 assert(Math.abs(mapWorldScale(MAPS.skibidi,{x:4464,z:4317})*5.239588-2.619794)<1e-6);
 assert.equal(mapWorldScale(MAPS.ep73,{x:284,z:152}),1);
});
