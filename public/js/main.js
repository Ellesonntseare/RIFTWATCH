import {downloadMap,downloadLabel} from './map-download.js?v=20261014-progress';
import {isWaterSurface,submergedFloor,mapWorldScale} from './terrain.js';
import {renderRadar} from './radar.js';
import * as THREE from 'three';
import { createOperations } from './operations.js';
import { dressMap } from './scenery.js';
import { buildHero } from './hero.js';
import { selectedHero } from './roster.js';
import { createNetwork } from './network.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS } from './maps.js';
import { MONSTER_TYPES, buildMonster, animateMonster, loadMonsterModels } from './monsters.js';
import { initAudio, sfx, toggleAudio, setAmbience,setMusicVolume } from './audio.js';

let BVH = null;   // makes raycasts on million-triangle maps fast
try { BVH = await import('three-mesh-bvh'); THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast; } catch (e) { console.warn('three-mesh-bvh unavailable - big maps will be slow', e); }

// ------------------------------------------------------------------ config
const WEAPONS = [
  { name: 'M4A1', model: 'gun', orient: 'back', len: 0.75, mag: 30, reserve: 120, rpm: 700, dmg: 25, headMul: 4, spread: 0.012, reload: 2.0, range: 250, recoil: 0.02, tracer: 0xffdd88, snd: 'shot' },
  { name: 'LASER MG', model: 'laser', orient: 'front', len: 0.6, mag: 60, reserve: 240, rpm: 1100, dmg: 14, headMul: 3.5, spread: 0.02, reload: 2.4, range: 250, recoil: 0.012, tracer: 0x55ddff, snd: 'laser' },
];
const CFG = {
  playerRadius: 0.4, eye: 1.65, walk: 6, sprint: 9.5, jump: 8, gravity: 24, maxHealth: 100,
  gun: WEAPONS[0],
  c4: { start: 2, dmg: 220, radius: 7, throwSpeed: 14 },
  barrel: { hp: 30, dmg: 180, radius: 6 },
  wave: { intermission: 6 },
};

const $ = id => document.getElementById(id);
const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch');
const touchMove = {x:0,y:0};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleLerp = (a, b, t) => a + ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * t;

// ------------------------------------------------------------------ renderer / scenes
const renderer = new THREE.WebGLRenderer({ antialias: !touchDevice });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 150);
camera.rotation.order = 'YXZ';
const viewScene = new THREE.Scene();           // gun is drawn in its own pass so it never clips walls
const viewCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
viewScene.environment = envTex;
scene.environment = envTex;
scene.environmentIntensity = 0.25;
viewScene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.2));
const viewSun = new THREE.DirectionalLight(0xffffff, 2); viewSun.position.set(1, 2, 1); viewScene.add(viewSun);

const shotLight = new THREE.PointLight(0xffaa55, 0, 25, 2);   // constant light count => no shader recompiles

function resizeGame() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = viewCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); viewCam.updateProjectionMatrix();
}
addEventListener('resize', resizeGame);
addEventListener('orientationchange', () => setTimeout(resizeGame, 100));

// ------------------------------------------------------------------ state
const state = {
  mode: 'menu', paused: false, time: 0, mapKey: 'yard', map: null, world: null,
  colliders: [], wallMeshes: [], barrels: [], monsters: [], c4s: [], particles: [], bloodStains: [], tracers: [], fx: [], fxLights: [], fxLightIdx: 0,
  wave: 0, toSpawn: 0, spawnTimer: 0, inter: 0, score: 0, kills: 0,
  hurt: 0, shake: 0, hitT: 0, hitKill: false, flashT: 0, bannerT: 0,
};
const P = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, kick: 0, bob: 0, onGround: true,
  hp: 100, ammo: 30, reserve: 120, c4: 2, fireCd: 0, reloading: 0, dead: false, deadT: 0, swayX: 0, swayY: 0, gk: 0,
};
const keys = {};
Object.assign(state, { collMesh: null, floaters: [], shots: 0, hits: 0, heads: 0, hitHead: false, gameMode: 'campaign', minY: -1e9, matchT: 0 });
Object.assign(state, { projs: [], rings: [], credits: 0, shopOpen: false, bossQueued: false, bossT: 0 });
Object.assign(state, { cameraMode: 'shoulder', thirdPerson: true, difficulty: 'relaxed' });
Object.assign(P, { weapon: 0, won: false, maxHp: 100, reloadDur: 2 });
const up = { dmg: 0, head: 0, mag: 0, hp: 0, reload: 0, c4: 0 };
const magSize = (w = CFG.gun) => Math.round(w.mag * (1 + 0.2 * up.mag));
const ws = WEAPONS.map(w => ({ ammo: w.mag, reserve: w.reserve }));
let mouseDown = false, locked = false,aimHeld=false,aimToggle=false;
const isAiming=()=>aimHeld||aimToggle;
let scopeEffect=localStorage.getItem('riftwatch-scope')!=='off';
let playerAvatar = null;
const ray = new THREE.Raycaster(); ray.firstHitOnly = true;

// ------------------------------------------------------------------ models
const models = { gun: null, laser: null, barrel: null, c4: null };
const props = { barrel: null, c4: null };
const gunPivot = new THREE.Group(); viewScene.add(gunPivot);
const gunBase = new THREE.Vector3(0.2, -0.21, -0.6);
const muzzlePos = new THREE.Vector3(0, 0.02, -0.4);
let flashMesh = null, muzzleLight = null;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,190,80,.8)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

async function loadAll() {
  const loader = new GLTFLoader();
  const list = [['gun', '/models/low-poly_colt_m4a1.glb'], ['laser', '/models/chg_laser_machine_gun.glb'], ['barrel', '/models/explosive_barrel.glb'], ['c4', '/models/chg_c4.glb']];
  let done = 0; const total = list.length + 5;
  const step = () => { $('loadtxt').textContent = `Loading models ${++done}/${total}`; };
  await Promise.all([
    ...list.map(async ([k, url]) => { try { models[k] = (await loader.loadAsync(url)).scene; } catch (e) { console.warn('model failed', url, e); } step(); }),
    loadMonsterModels(loader, step, BVH),
  ]);
  buildGuns(); buildProps();
}

const gunGroups = [], muzzles = [];
function buildGuns() {
  WEAPONS.forEach((w, i) => {
    const model = models[w.model], grp = new THREE.Group(), mz = new THREE.Vector3(0, 0.02, -0.4);
    if (model) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const axis = size.x >= size.z ? 'x' : 'z';
      const find = re => { let r = null; model.traverse(o => { if (!r && re.test(o.name)) r = o; }); return r; };
      const cen = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      const back = find(/stock/i), front = find(/barrel|muzzle|flash hider/i);
      let sign = 1;
      if (w.orient === 'back' && back) sign = Math.sign(center[axis] - cen(back)[axis]) || 1;
      else if (front) sign = Math.sign(cen(front)[axis] - center[axis]) || 1;
      const f = new THREE.Vector3(); f[axis] = sign;
      model.quaternion.setFromUnitVectors(f, new THREE.Vector3(0, 0, -1));
      model.updateMatrixWorld(true);
      const s2 = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      model.scale.setScalar(w.len / s2.z);
      model.updateMatrixWorld(true);
      const b3 = new THREE.Box3().setFromObject(model), c3 = b3.getCenter(new THREE.Vector3());
      model.position.sub(c3);
      mz.set(0, (b3.max.y - c3.y) * 0.3, b3.min.z - c3.z);
      model.traverse(o => { o.frustumCulled = false; });
      grp.add(model);
    } else grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x333333 })));
    gunPivot.add(grp); gunGroups.push(grp); muzzles.push(mz);
  });
  flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flashMesh.visible = false; gunPivot.add(flashMesh);
  muzzleLight = new THREE.PointLight(0xffaa44, 0, 3, 2); if(!touchDevice&&graphicsMode==='quality')gunPivot.add(muzzleLight);
  setWeaponVisual(0);
}
function setWeaponVisual(i) {
  gunGroups.forEach((g, k) => { g.visible = k === i; });
  if (!flashMesh) return;
  flashMesh.position.copy(muzzles[i]).z -= 0.05; muzzleLight.position.copy(muzzles[i]).z -= 0.1;
  flashMesh.material.color.setHex(i === 1 ? 0x66ddff : 0xffffff);
}
function switchWeapon(i) {
  if (i === P.weapon || P.dead) return;
  ws[P.weapon] = { ammo: P.ammo, reserve: P.reserve };
  P.weapon = i; CFG.gun = WEAPONS[i]; P.ammo = ws[i].ammo; P.reserve = ws[i].reserve;
  P.reloading = 0; P.fireCd = 0.25; P.gk = 1; sfx.swap(); setWeaponVisual(i);
}
function giveAmmo() {
  WEAPONS.forEach((w, i) => {
    const add = w.mag * 2, cap = w.reserve * 2;
    if (i === P.weapon) P.reserve = Math.min(cap, P.reserve + add); else ws[i].reserve = Math.min(cap, ws[i].reserve + add);
  });
}

function normalizeProp(src, { height, width, flat }) {
  src.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
  if (flat) {                                                   // make thinnest axis point up
    if (size.x < size.y && size.x < size.z) src.rotation.z = Math.PI / 2;
    else if (size.z < size.x && size.z < size.y) src.rotation.x = Math.PI / 2;
    src.updateMatrixWorld(true);
    size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
  }
  src.scale.setScalar(height ? height / size.y : width / Math.max(size.x, size.z));
  const wrap = new THREE.Group(); wrap.add(src); wrap.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(wrap);
  src.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrap;
}

function buildProps() {
  if (models.barrel) props.barrel = normalizeProp(models.barrel, { height: 1.1 });
  else { props.barrel = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0xaa2222 })); m.position.y = 0.55; props.barrel.add(m); }
  if (models.c4) props.c4 = normalizeProp(models.c4, { width: 0.32, flat: true });
  else { props.c4 = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x556b2f })); m.position.y = 0.04; props.c4.add(m); }
}

// ------------------------------------------------------------------ map building
function panelTexture(hex, rep) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const col = new THREE.Color(hex);
  x.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, 126, 126);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}

function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 2, uv.getY(k) * dims[f][1] / 2); }
  return g;
}

function loadMap(key) {
  if (state.world) scene.remove(state.world);
  const map = MAPS[key]; state.map = map; state.collMesh = null; state.extraCollMesh = null; state.waterMesh=null; state.nextMonsterId=0; state.sharedBarrelsInitialized=false; state.lastSharedShop=0;
  camera.far = Math.max(150, map.fog[2] + 30); camera.updateProjectionMatrix();
  const world = new THREE.Group(); scene.add(world); state.world = world;
  Object.assign(state, { colliders: [], wallMeshes: [], barrels: [], monsters: [], c4s: [], particles: [], bloodStains: [], tracers: [], fx: [], fxLights: [], fxLightIdx: 0, projs: [], rings: [] });

  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.Fog(map.fog[0], map.fog[1], map.fog[2]);
  world.add(new THREE.HemisphereLight(map.hemi[0], map.hemi[1], map.hemi[2]));

  const [W, D] = map.size, h = W / 2, ext = map.open ? 40 : Math.min(h, 40);
  const sun = new THREE.DirectionalLight(map.sun[0], map.sun[1]);
  sun.position.set(20, 45, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 120 });
  sun.shadow.bias = -0.0005; world.add(sun); world.add(sun.target); state.sun = sun;   // follows the player
  if(!touchDevice&&graphicsMode==='quality')for (const [x, y, z, col, inten] of map.lights) { const l = new THREE.PointLight(col, inten, 18, 2); l.position.set(x, y, z); world.add(l); }
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff8833, 0, 30, 2); if(!touchDevice&&graphicsMode==='quality')world.add(l); state.fxLights.push(l); }

  if (!map.open) { const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: panelTexture(map.colors.ground, [W / 4, D / 4]), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground); state.wallMeshes.push(ground); }

  const mats = {};
  for (const k of ['wall', 'crate', 'pillar']) mats[k] = new THREE.MeshStandardMaterial({ map: panelTexture(map.colors[k]), roughness: 0.85 });
  mats.trunk = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1 });
  mats.leaf = new THREE.MeshStandardMaterial({ color: map.colors.leaf || 0x2f5a2a, roughness: 1 });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3, 6), canopyGeo = new THREE.ConeGeometry(1.8, 5, 7);
  const addBlock = (kind, x, z, w, d, hh) => {
    if (kind === 'road') {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: panelTexture(map.colors.road || 0x26272a, [w / 4, d / 4]), roughness: 1 }));
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, z); r.receiveShadow = true; world.add(r); return;
    }
    if (kind === 'roof') {
      const r = new THREE.Mesh(boxGeo(w, 0.3, d), mats.wall);
      r.position.set(x, hh + 0.15, z); r.castShadow = true; r.receiveShadow = true; world.add(r); state.wallMeshes.push(r); return;
    }
    if (kind === 'tree') {
      const s = 0.8 + (Math.abs(Math.round(x * 7 + z * 13)) % 5) / 10;
      const tr = new THREE.Mesh(trunkGeo, mats.trunk); tr.scale.setScalar(s); tr.position.set(x, 1.5 * s, z); tr.castShadow = true;
      const cn = new THREE.Mesh(canopyGeo, mats.leaf); cn.scale.setScalar(s); cn.position.set(x, 5.5 * s, z); cn.castShadow = true;
      world.add(tr, cn); state.wallMeshes.push(tr);
      state.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, h: 3 * s }); return;
    }
    const m = new THREE.Mesh(boxGeo(w, hh, d), mats[kind]);
    m.position.set(x, hh / 2, z); m.castShadow = true; m.receiveShadow = true; world.add(m); state.wallMeshes.push(m);
    state.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: hh });
  };
  const t = 2;
  if (!map.open) { addBlock('wall', 0, -(D / 2 + t / 2), W + 2 * t, t, 8); addBlock('wall', 0, D / 2 + t / 2, W + 2 * t, t, 8); }
  if (!map.open) { addBlock('wall', -(W / 2 + t / 2), 0, t, D, 8); addBlock('wall', W / 2 + t / 2, 0, t, D, 8); }
  for (const b of map.blocks) addBlock(...b);
  for (const [x, z] of map.barrels) spawnBarrel(x, z);
  buildMinimap();
}

// ------------------------------------------------------------------ open-world maps (GLB)
const mapCache = {};
function releaseUnusedMaps(keepKey){
  if(!touchDevice&&graphicsMode!=='performance')return;
  for(const [key,cached] of Object.entries(mapCache)){
    if(key===keepKey)continue;
    cached.root.removeFromParent();
    const textures=new Set(),materials=new Set(),geometries=new Set();
    cached.root.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material)materials.add(material);
    });
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
    for(const texture of textures)texture.dispose();
    for(const geometry of geometries)geometry.dispose();
    cached.collMesh.geometry.dispose();cached.waterMesh.geometry.dispose();
    delete mapCache[key];
  }
}
function buildCollision(root,waterOnly=false) {
  const meshes = []; let nv = 0, ni = 0;
  root.traverse(o => {
    if (!o.isMesh || o.userData.dynamic || !o.geometry.attributes.position) return;
    if(isWaterSurface(o)!==waterOnly)return;
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!waterOnly && mt && mt.transparent && mt.opacity < 0.9) return;
    meshes.push(o); nv += o.geometry.attributes.position.count; ni += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
  });
  const pos = new Float32Array(nv * 3), idx = new Uint32Array(ni), v = new THREE.Vector3();
  let vo = 0, io = 0;
  for (const o of meshes) {
    const g = o.geometry, a = g.attributes.position, m = o.matrixWorld;
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); const k = (vo + i) * 3; pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z; }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < a.count; i++) idx[io++] = vo + i;
    vo += a.count;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  if (BVH && ni) geo.boundsTree = new BVH.MeshBVH(geo);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}
const tick = () => new Promise(r => setTimeout(r, 30));
function loadingStage(stage, message) {
  $('loading-status').textContent = message;
  $('loadtxt').textContent = message;
  const order = ['download','decode','collision','prepare'];
  const active = order.indexOf(stage);
  document.querySelectorAll('.loading-stages li').forEach((item, i) => {
    item.classList.toggle('active', i === active);
    item.classList.toggle('complete', i < active);
  });
}
function showMapLoading(key, map) {
  $('loading-map-name').textContent = map.name;
  $('loading-map-desc').textContent = map.desc;
  $('loading-sector-art').className = `map-art map-${key}`;
  $('map-download-progress').hidden = true;
  loadingStage(map.open ? 'download' : 'prepare', map.open ? `Connecting to ${map.name}…` : 'Preparing arena…');
  $('map-loading').classList.remove('hidden');
}
async function loadOpenWorld(map) {
  let c = mapCache[state.mapKey];
  if (!c) {
    const progress = $('map-download-progress');
    progress.hidden = false; progress.removeAttribute('value');
    loadingStage('download', `Connecting to download ${map.name}…`);
    let data;
    try {
      data = await downloadMap(map.glb, status => {
        loadingStage('download', downloadLabel(map.name, status));
        if(status.total) { progress.max = status.total; progress.value = status.loaded; }
        else progress.removeAttribute('value');
      });
    } finally { progress.hidden = true; }
    loadingStage('decode', `Decoding ${map.name} scene…`);
    await tick();
    const gltf = await new GLTFLoader().parseAsync(data, new URL('.', new URL(map.glb, location.href)).href);
    const root = gltf.scene; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = mapWorldScale(map,size);
    root.scale.setScalar(k); root.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k); root.updateMatrixWorld(true);
    root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    loadingStage('collision', 'Building solid ground and water boundaries…'); await tick();
    c = mapCache[state.mapKey] = { root, collMesh: buildCollision(root), waterMesh:buildCollision(root,true), w: size.x * k, d: size.z * k, top: size.y * k + 20 };
  }
  state.world.add(c.root); state.waterMesh=c.waterMesh;state.mapTop=c.top; state.collMesh = c.collMesh; state.wallMeshes = [c.collMesh]; state.minY = -60;
  map.size = [c.w, c.d];
  if (!c.start) {                                               // find open ground near the middle
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const x = (Math.random() - 0.5) * c.w * 0.6, z = (Math.random() - 0.5) * c.d * 0.6;
      _o.set(x, c.top, z); const h = castRay(_o, DOWN, c.top + 100);
      if (h && h.face.normal.y > 0.85 && !waterAt(x,z,h.point.y)) pts.push([x, z, h.point.y]);
    }
    pts.sort((a, b) => a[2] - b[2]);
    const g = pts.length ? pts[Math.floor(pts.length * 0.25)][2] : 0, ok = pts.filter(p => Math.abs(p[2] - g) < 1.5).sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    if(!ok.length)throw Error('No dry deployment area found. Choose another map.');
    c.ground = g; c.start = ok.find(p => DIRS.every(d => !castRay(_o.set(p[0], p[2] + 1, p[1]), d, 2.5))) || ok[0] || [0, 0, g];
  }
  map.start = [c.start[0], c.start[1]]; map.startY = c.start[2];
  for (let i = 0, n = 0; i < 200 && n < 28; i++) {              // scatter explosive barrels
    const a = Math.random() * 6.283, r = 12 + Math.random() * 110, x = c.start[0] + Math.cos(a) * r, z = c.start[1] + Math.sin(a) * r;
    const f = floorAt(x, z, c.start[2] + 4, 20); if (f !== null && Math.abs(f - c.start[2]) < 3) { spawnBarrel(x, z, f); n++; }
  }
}

// ------------------------------------------------------------------ collision
const _r = new THREE.Ray(), _rc = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
const DIRS = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4)));
function castRay(o, d, far) {
  const cm = state.collMesh; if (!cm) return null;
  if (cm.geometry.boundsTree) {
    _r.origin.copy(o); _r.direction.copy(d);
    const base=cm.geometry.boundsTree.raycastFirst(_r,THREE.DoubleSide,0,far),extra=state.extraCollMesh?.geometry.boundsTree?.raycastFirst(_r,THREE.DoubleSide,0,far);
    return extra && (!base || extra.distance<base.distance) ? extra : base || null;
  }
  _rc.set(o, d); _rc.far = far; return _rc.intersectObject(cm)[0] || null;
}
function waterAt(x,z,groundY){
  const cm=state.waterMesh;if(!cm?.geometry.attributes.position.count)return false;
  const origin=new THREE.Vector3(x,Math.max(state.mapTop||100,groundY===null?0:groundY+2),z);
  let h;
  if(cm.geometry.boundsTree){const ray=new THREE.Ray(origin,DOWN);h=cm.geometry.boundsTree.raycastFirst(ray,THREE.DoubleSide,0,100000);}
  else{const ray=new THREE.Raycaster(origin,DOWN,0,100000);h=ray.intersectObject(cm)[0];}
  return h?submergedFloor(groundY,h.point.y):false;
}
function floorAt(x,z,fromY,far=400){_o.set(x,fromY,z);const h=castRay(_o,DOWN,far);return h&&!waterAt(x,z,h.point.y)?h.point.y:null;}
function resolveOpen(pos, r, feetY, player) {
  const y0 = feetY || 0, hs = player ? [0.5, 1.2] : [0.6], stp = player ? 1 : 2;
  for (const hy of hs) for (let i = 0; i < 8; i += stp) {
    _o.set(pos.x, y0 + hy, pos.z); const h = castRay(_o, DIRS[i], r);
    if (h && Math.abs(h.face.normal.y) < 0.65) { const push = r - h.distance; pos.x -= DIRS[i].x * push; pos.z -= DIRS[i].z * push; }
  }
  for (const b of state.barrels) {
    if (!b.alive || y0 - (b.y || 0) >= 1.1) continue;
    const dx = pos.x - b.x, dz = pos.z - b.z, d = Math.hypot(dx, dz), min = r + 0.4;
    if (d < min && d > 1e-6) { pos.x = b.x + dx / d * min; pos.z = b.z + dz / d * min; }
  }
  _o.set(pos.x, y0 + 0.6, pos.z); const h = castRay(_o, DOWN, 300);
  return h && !waterAt(pos.x,pos.z,h.point.y) ? h.point.y : -1e9;
}
function resolveCircle(pos, r, feetY, canClimb) {
  if (state.collMesh) return resolveOpen(pos, r, feetY, canClimb);
  let floor = 0;
  for (const c of state.colliders) {
    const cx = clamp(pos.x, c.minX, c.maxX), cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (canClimb && feetY >= c.h - 0.35) { floor = Math.max(floor, c.h); continue; }
    if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
    else {
      const l = pos.x - c.minX, rr = c.maxX - pos.x, tt = pos.z - c.minZ, b = c.maxZ - pos.z, m = Math.min(l, rr, tt, b);
      if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === tt) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
    }
  }
  for (const b of state.barrels) {
    if (!b.alive || feetY >= 1.1) continue;
    const dx = pos.x - b.x, dz = pos.z - b.z, d = Math.hypot(dx, dz), min = r + 0.4;
    if (d < min && d > 1e-6) { pos.x = b.x + dx / d * min; pos.z = b.z + dz / d * min; }
  }
  return floor;
}

// ------------------------------------------------------------------ particles / fx
const partGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
const bloodDropGeo = new THREE.SphereGeometry(0.06,6,4);
const bloodStainGeo = new THREE.CircleGeometry(1,12);
const bloodStainMat = new THREE.MeshBasicMaterial({color:0x390609,transparent:true,opacity:.67,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
const partMats = {
  blood: new THREE.MeshBasicMaterial({ color: 0x760b12 }), bloodBright: new THREE.MeshBasicMaterial({color:0xae1820}), fire: new THREE.MeshBasicMaterial({ color: 0xffa030 }),
  spark: new THREE.MeshBasicMaterial({ color: 0xffe080 }), smoke: new THREE.MeshBasicMaterial({ color: 0x222222 }),
  debris: new THREE.MeshBasicMaterial({ color: 0x555555 }),
};
const unitSphere = new THREE.SphereGeometry(1, 16, 12);
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.7, fog: false });

function emit(kind, pos, count, speed, life, size = 1, up = 0.5) {
  const gy = state.collMesh ? (floorAt(pos.x, pos.z, pos.y + 0.6, 40) ?? pos.y - 2) : 0;
  const limit=touchDevice?96:graphicsMode==='performance'?180:500;
  if(touchDevice||graphicsMode==='performance')count=Math.max(1,Math.ceil(count*(touchDevice ? .3 : .6)));
  for (let i = 0; i < count; i++) {
    if (state.particles.length >= limit) return;
    const m = new THREE.Mesh(kind==='blood'?bloodDropGeo:partGeo, kind==='blood'&&Math.random()<.25?partMats.bloodBright:partMats[kind]); m.position.copy(pos);
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1) + up, rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
    const s = size * rand(0.6, 1.4); m.scale.setScalar(s);if(kind==='blood')m.scale.set(s*.65,s*1.45,s*.65);
    state.world.add(m);
    state.particles.push({ m, v, life: life * rand(0.6, 1), max: life, grav: kind === 'smoke' ? -1 : 12, size: s, gy });
  }
}
function addBloodStain(m){
  const ground=state.collMesh?floorAt(m.x,m.z,(m.y||0)+2,5):0;
  if(ground===null)return;
  const max=touchDevice?10:graphicsMode==='performance'?18:35;
  if(state.bloodStains.length>=max){const old=state.bloodStains.shift();state.world.remove(old.mesh);}
  const mesh=new THREE.Mesh(bloodStainGeo,bloodStainMat),radius=rand(.35,.8);
  mesh.rotation.x=-Math.PI/2;mesh.rotation.z=rand(0,Math.PI*2);mesh.scale.set(radius,radius*rand(.65,1.25),1);mesh.position.set(m.x+rand(-.25,.25),ground+.025,m.z+rand(-.25,.25));
  state.world.add(mesh);state.bloodStains.push({mesh,life:touchDevice?8:14});
}
function updateParticles(dt) {
  for(let i=state.bloodStains.length-1;i>=0;i--){const stain=state.bloodStains[i];stain.life-=dt;if(stain.life<=0){state.world.remove(stain.mesh);state.bloodStains.splice(i,1);}}
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.world.remove(p.m); state.particles.splice(i, 1); continue; }
    p.v.y -= p.grav * dt; p.m.position.addScaledVector(p.v, dt);
    const gy = p.gy + 0.03; if (p.m.position.y < gy) { p.m.position.y = gy; p.v.set(0, 0, 0); }
    p.m.scale.setScalar(p.size * clamp(p.life / p.max, 0.05, 1));
  }
}
function addTracer(a, b) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), tracerMat);
  l.frustumCulled = false; scene.add(l); state.tracers.push({ l, life: 0.06 });
}
function updateTracers(dt) {
  for (let i = state.tracers.length - 1; i >= 0; i--) {
    const t = state.tracers[i]; t.life -= dt;
    if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); state.tracers.splice(i, 1); }
  }
}
function updateFx(dt) {
  for (let i = state.fx.length - 1; i >= 0; i--) {
    const f = state.fx[i]; f.t += dt; const k = f.t / f.dur;
    if (k >= 1) { state.world.remove(f.mesh); f.mesh.material.dispose(); f.light.intensity = 0; state.fx.splice(i, 1); continue; }
    f.mesh.scale.setScalar(f.radius * 0.6 * Math.sqrt(k) + 0.1);
    f.mesh.material.opacity = 0.95 * (1 - k);
    f.light.intensity = 400 * (1 - k) * (1 - k);
  }
}

// ------------------------------------------------------------------ barrels / explosions
function spawnBarrel(x, z, y = 0) {
  const mesh = props.barrel.clone(true); mesh.position.set(x, y, z);
  mesh.traverse(o=>o.userData.dynamic=true);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 8), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = 0.55; mesh.add(proxy);
  const b = { mesh, proxy, x, y, z, hp: CFG.barrel.hp, alive: true, fuse: -1,netId:state.barrels.length+1 };
  proxy.userData.barrel = b;
  state.world.add(mesh); state.barrels.push(b);
}
function damageBarrel(b, dmg, point) {
  if(network.role==='guest'){network.action({kind:'barrel',id:b.netId,damage:dmg,pos:point.toArray()});return;}
  if (!b.alive) return;
  b.hp -= dmg; emit('spark', point, 6, 4, 0.35, 0.8, 0.3);
  if (b.hp <= 0) b.fuse = Math.max(b.fuse, 0) + 0.0001;
}
function explodeBarrel(b) {
  if (!b.alive) return;
  b.alive = false; state.world.remove(b.mesh);
  explode(new THREE.Vector3(b.x, b.y + 0.6, b.z), CFG.barrel.radius, CFG.barrel.dmg);
}
function updateBarrels(dt) {
  for (const b of state.barrels) {
    if (!b.alive || b.fuse < 0) continue;
    b.fuse -= dt; if (b.fuse < 0) explodeBarrel(b);
  }
}
function explode(pos, radius, dmg) {
  sfx.explosion(clamp(1 - pos.distanceTo(camera.position) / 60, 0.25, 1));
  const mesh = new THREE.Mesh(unitSphere, new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  mesh.position.copy(pos); state.world.add(mesh);
  const light = state.fxLights[state.fxLightIdx++ % state.fxLights.length];
  light.position.copy(pos); light.intensity = 400; light.distance = radius * 5;
  state.fx.push({ mesh, light, t: 0, dur: 0.55, radius });
  emit('fire', pos, 26, radius * 1.3, 0.7, 2.2, 0.3); emit('spark', pos, 24, radius * 2.2, 0.9, 1, 0.6);
  emit('debris', pos, 14, radius * 1.4, 1.2, 1.6, 0.8); emit('smoke', pos, 12, 2.5, 2.2, 4, 1);
  state.shake = Math.max(state.shake, clamp(1.4 * (1 - pos.distanceTo(camera.position) / (radius * 5)), 0, 1.4));
  if(dmg<=0)return;
  if(network.role==='guest'){network.action({kind:'explosion',pos:pos.toArray()});return;}
  if(network.role==='host')network.effect({kind:'explosion',pos:pos.toArray(),radius});

  for (const m of state.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - pos.x, 0.9 - pos.y, m.z - pos.z) - m.T.radius;
    if (d < radius) damageMonster(m, dmg * (0.3 + 0.7 * (1 - clamp(d, 0, radius) / radius)), new THREE.Vector3(m.x, (m.y || 0) + 1, m.z), true);
  }
  if (!P.dead) {
    const d = Math.hypot(P.pos.x - pos.x, P.pos.y + 1 - pos.y, P.pos.z - pos.z);
    if (d < radius) hurtPlayer(dmg * 0.5 * (0.3 + 0.7 * (1 - d / radius)));
  }
  if(network.role==='host')for(const player of combatPlayers())if(player.id&&!player.dead){const d=player.pos.distanceTo(pos);if(d<radius)hurtTarget(player,dmg*.5*(.3+.7*(1-d/radius)));}
  for (const b of state.barrels) {
    if (!b.alive || b.fuse >= 0) continue;
    const d = Math.hypot(b.x - pos.x, 0.5 - pos.y, b.z - pos.z);
    if (d < radius + 0.5) b.fuse = 0.08 + d * 0.03;
  }
}

// ------------------------------------------------------------------ monsters
function spawnMonster(type, x, z) {
  const T = MONSTER_TYPES[type], built = buildMonster(type), w = Math.max(0, state.wave - 1);
  const m = {
    id: ++state.nextMonsterId, type, T, hp: T.hp * (1 + 0.06 * w), x, z, group: built.group, parts: built.parts, mats: built.mats,
    speedMul: Math.min(1.5, 1 + 0.03 * w), cd: rand(0, 0.5), windup: 0, attackAnim: 0, dead: false, deadT: 0, flash: 0, anim: rand(0, 10),
    moving: false, stuckN: 0, strafe: 0, strafeT: 0, stuckT: 0, lastX: x, lastZ: z, growlT: rand(2, 8),
  };
  if (T.boss) m.hp *= Math.max(1, state.wave / 5);
  if (T.aim) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); m.aim = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55, fog: false })); m.aim.frustumCulled = false; m.aim.visible = false; state.world.add(m.aim); }
  Object.assign(m, { shootCd: rand(1, 3), shootAnim: 0, burstLeft: 0, burstT: 0, maxhp: m.hp, slamCd: rand(4, 6), slamT: 0, los: false, losT: 0, wMax: 0.35 });
  built.group.traverse(o => { if (o.isMesh) o.userData.monster = m; });
  m.y = state.collMesh ? (floorAt(x, z, P.pos.y + 6, 40) ?? P.pos.y) : 0; built.group.position.set(x, m.y, z);
  state.world.add(built.group); state.monsters.push(m);return m;
}
function damageMonster(m, dmg, point, gib = false, head = false) {
  if (m.dead) return;
  if(network.role==='guest'){network.action({kind:'hit',id:m.id,damage:dmg,pos:point.toArray(),head,gib});m.flash=.1;return;}
  m.hp -= dmg; m.flash = 0.1;
  const bleeds=m.type!=='drone';
  emit(bleeds?'blood':'spark', point, gib ? 12 : head ? 16 : 7, head ? 5 : 3.5, 0.6, 1, 0.4);
  let pts = gib ? 0 : head ? 50 : 10;
  if (m.hp <= 0) {
    m.dead = true; pts += m.T.score + (head ? Math.round(m.T.score * 0.5) : 0); state.kills++; sfx.kill(); operations.drop(new THREE.Vector3(m.x, m.y || 0, m.z));
    if(bleeds){emit('blood', new THREE.Vector3(m.x, (m.y || 0) + 1, m.z), 14, 4, 0.8, 1.3, 0.6);addBloodStain(m);}
    m.moving = false; m.attackAnim = 0; m.windup = 0; m.slamT = 0; if (m.aim) m.aim.visible = false;
    if (m.T.boss) { banner('BOSS DOWN  +500$'); state.credits += 500; P.hp = Math.min(P.maxHp, P.hp + 40); }
  }
  if (pts) { state.score += pts; state.credits += pts; floater(point, head ? `HEADSHOT +${pts}` : `+${pts}`, head ? 'head' : m.dead ? 'kill' : ''); }
  state.hitKill = m.dead;
}
function floater(point, text, cls = '') {
  if (state.floaters.length > 40) state.floaters.shift().el.remove();
  const el = document.createElement('div'); el.className = 'fl ' + cls; el.textContent = text; $('floaters').appendChild(el);
  state.floaters.push({ el, p: point.clone(), v: new THREE.Vector3(rand(-1.4, 1.4), rand(2.4, 3.6), rand(-1.4, 1.4)), t: 0, life: cls === 'head' ? 1.2 : 0.85 });
}
const _fp = new THREE.Vector3();
function updateFloaters(dt) {
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const f = state.floaters[i]; f.t += dt;
    if (f.t >= f.life) { f.el.remove(); state.floaters.splice(i, 1); continue; }
    f.v.y -= 5 * dt; f.p.addScaledVector(f.v, dt);
    _fp.copy(f.p).project(camera);
    if (_fp.z > 1) { f.el.style.opacity = 0; continue; }
    const k = f.t / f.life, pop = k < 0.15 ? 0.6 + k / 0.15 * 0.8 : 1.4 - Math.min(0.4, k - 0.15);
    f.el.style.opacity = 1 - k * k;
    f.el.style.transform = `translate(${(_fp.x * 0.5 + 0.5) * innerWidth}px, ${(-_fp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%) scale(${pop})`;
  }
}
function updateMonsters(dt) {
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const m = state.monsters[i], T = m.T;
    const player=closestPlayer(m);m.target=player;
    m.flash -= dt;
    if (m.dead) {
      m.deadT += dt;
      m.group.rotation.x = -Math.min(1, m.deadT / 0.5) * Math.PI / 2;
      if (m.deadT > 3) m.group.position.y -= dt * 0.5;
      animateMonster(m, dt, touchDevice||graphicsMode==='performance');
      if (m.deadT > 5) { if (m.aim) { state.world.remove(m.aim); m.aim.geometry.dispose(); } state.world.remove(m.group); state.monsters.splice(i, 1); }
      continue;
    }
    const dx = player.pos.x - m.x, dz = player.pos.z - m.z, dist = Math.hypot(dx, dz) || 0.001;
    if (state.map.ring && dist > 75 && !T.stationary) { const s = ringSpot(); if (s) { m.x = s[0]; m.z = s[1]; m.y = s[2] || 0; m.lastX = m.x; m.lastZ = m.z; m.group.position.set(m.x, m.y || 0, m.z); } continue; }
    const nx = dx / dist, nz = dz / dist, speed = T.speed * m.speedMul;
    m.group.rotation.y = angleLerp(m.group.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
    m.cd -= dt;
    m.shootAnim -= dt;
    if (T.ranged || T.shoot) { m.losT -= dt; if (m.losT <= 0) { m.losT = 0.25 + Math.random() * 0.15; m.los = hasLOS(m, dist); } }
    if (T.boss) bossAI(m, dt, dist);

    const attacking = T.ranged ? (m.los && dist <= T.range * 0.9) : dist <= T.range * 0.9;
    m.moving = !attacking && !player.dead;
    const retreat = T.ranged && m.los && dist < (T.keep || 7) && !player.dead;
    if (retreat) m.moving = true;
    if ((T.ranged && m.windup > 0) || m.slamT > 0 || T.stationary) m.moving = false;
    const previousX=m.x,previousZ=m.z;
    if (m.moving) {
      let mx = nx, mz = nz;
      if (retreat) { mx = -nx; mz = -nz; }
      if (m.strafeT > 0) { m.strafeT -= dt; mx = nx * 0.35 - nz * m.strafe * 0.9; mz = nz * 0.35 + nx * m.strafe * 0.9; }
      m.x += mx * speed * dt; m.z += mz * speed * dt;
    }
    for (const o of state.monsters) {
      if (o === m || o.dead || T.stationary) continue;
      const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz), min = T.radius + o.T.radius;
      if (od < min && od > 1e-4) { m.x += ox / od * (min - od) * 0.5; m.z += oz / od * (min - od) * 0.5; }
    }
    const pos = { x: m.x, z: m.z }, fl = resolveCircle(pos, T.radius, m.y || 0, false); m.x = pos.x; m.z = pos.z;
    if(state.waterMesh&&fl < -1e8){m.x=previousX;m.z=previousZ;m.moving=false;}
    if (state.collMesh && fl > -1e8) m.y += (fl - m.y) * Math.min(1, dt * 12);
    m.group.position.set(m.x, m.y || 0, m.z);

    m.stuckT += dt;
    if (m.stuckT >= 0.6) {
      if (m.moving && Math.hypot(m.x - m.lastX, m.z - m.lastZ) < speed * 0.6 * 0.25) {
        m.stuckN++;
        if (m.strafeT <= 0) { m.strafeT = 1.6; m.strafe = Math.random() < 0.5 ? -1 : 1; }
        if (m.stuckN >= 6 && dist > 20 && state.map.ring) { const s = ringSpot(); if (s) { m.x = s[0]; m.z = s[1]; m.y = s[2] || 0; m.stuckN = 0; } }
      } else m.stuckN = 0;
      m.lastX = m.x; m.lastZ = m.z; m.stuckT = 0;
    }

    if (!player.dead && dist <= T.range + 0.3 && m.cd <= 0 && m.windup <= 0 && !(m.slamT > 0) && (!T.ranged || m.los)) { m.windup = m.wMax = T.aim ? 0.9 : T.ranged ? 0.5 : T.boss ? 0.6 : 0.35; m.cd = T.cd * (T.ranged ? rand(1, 1.6) : 1); }
    if (m.windup > 0) {
      m.windup -= dt; m.attackAnim = clamp(1 - m.windup / m.wMax, 0, 1);
      if (m.windup <= 0) { m.attackAnim = 0; if (T.ranged) { if (!player.dead && m.los) { enemyShoot(m); if (T.burst) { m.burstLeft = T.burst - 1; m.burstT = 0.14; } } } else if (dist <= T.range + 0.6 && !player.dead) hurtTarget(player,T.dmg); }
    }
    if (m.aim) {                                   // red aim line warns you a shot is coming
      const on = m.windup > 0 && m.los;
      m.aim.visible = on;
      if (on) { const a = m.aim.geometry.attributes.position; a.setXYZ(0, m.x, (m.y || 0) + 1.5, m.z); a.setXYZ(1, player.pos.x, player.pos.y + 1.2, player.pos.z); a.needsUpdate = true; }
    }
    if (m.burstLeft > 0) { m.burstT -= dt; if (m.burstT <= 0) { if (m.los && !player.dead) enemyShoot(m); m.burstLeft--; m.burstT = 0.14; } }
    if (T.shoot && !T.ranged && !player.dead) {            // grunts, runners, demons, brutes and the boss also shoot from range
      m.shootCd -= dt;
      if (m.shootCd <= 0 && m.los && dist > T.range + 1.5 && dist <= T.shoot.range && !(m.slamT > 0)) { m.shootCd = T.shoot.cd * rand(0.8, 1.4); enemyShoot(m, T.shoot); }
    }
    m.growlT -= dt;
    if (m.growlT <= 0) { m.growlT = rand(3, 8); if (dist < 25) sfx.growl(clamp(1 - dist / 25, 0.1, 1)); }
    animateMonster(m, dt, (touchDevice||graphicsMode==='performance') && dist>(touchDevice?24:35));
  }
}

// ------------------------------------------------------------------ ranged enemies, boss, rings
const projGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.65, 5);
projGeo.rotateX(Math.PI / 2);
const projectileRay = new THREE.Raycaster(), playerHitbox = new THREE.Box3(), bulletHit = new THREE.Vector3();
projectileRay.firstHitOnly = true;
function hasLOS(m, dist) {
  const player=m.target || closestPlayer(m);
  if (dist > (m.T.shoot ? m.T.shoot.range : m.T.range) * 1.2) return false;
  const sx = m.x, sy = (m.y || 0) + 1.5, sz = m.z, ex = player.pos.x, ey = player.pos.y + 1.4, ez = player.pos.z;
  if (state.collMesh) {
    _o.set(sx, sy, sz); _d.set(ex - sx, ey - sy, ez - sz); const L = _d.length(); _d.normalize();
    return !castRay(_o, _d, L - 0.3);
  }
  const n = Math.ceil(dist);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = sx + (ex - sx) * t, z = sz + (ez - sz) * t;
    for (const c of state.colliders) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && c.h > 1.5) return false;
  }
  return true;
}
const projMats = {}, UP = new THREE.Vector3(0, 1, 0);
function enemyShoot(m, S = {}) {
  const T = m.T, player=m.target || closestPlayer(m), n = S.count || 1, col = T.proj ? 0x88e5ff : 0xffd49a;
  const from = new THREE.Vector3(m.x, (m.y || 0) + (T.h || 1.8) * 0.8, m.z);
  const dir0 = new THREE.Vector3(player.pos.x + rand(-0.3, 0.3), player.pos.y + 1.2 + rand(-0.2, 0.2), player.pos.z + rand(-0.3, 0.3)).sub(from).normalize();
  const mat = projMats[col] || (projMats[col] = new THREE.MeshBasicMaterial({ color: col, fog: false }));
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(projGeo, mat); mesh.position.copy(from); state.world.add(mesh);
    const dir = n > 1 ? dir0.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * S.spread) : dir0;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    state.projs.push({ mesh, v: dir.clone().multiplyScalar(T.aim ? 44 : 30), life: 3, dmg: clamp(S.dmg ?? T.dmg, 3, T.aim ? 8 : 7) });
  }
  if(network.role==='host')network.effect({kind:'bullets',from:from.toArray(),dir:dir0.toArray(),speed:T.aim?44:30,count:n,spread:S.spread||0,col});
  m.shootAnim = 0.35; sfx.laser();
}
function updateProjs(dt) {
  for (let i = state.projs.length - 1; i >= 0; i--) {
    const p = state.projs[i], pos = p.mesh.position; p.life -= dt;
    let dead = p.life <= 0;
    if (!dead) {
      const step = p.v.length() * dt;
      _d.copy(p.v).normalize(); projectileRay.set(pos, _d); projectileRay.far = step;
      const wall = state.collMesh ? castRay(pos, _d, step) : projectileRay.intersectObjects(state.wallMeshes, true)[0];
      let hitPlayer=null,hitDistance=Infinity;
      for(const player of network.role==='guest'?[]:combatPlayers()) {
        if(player.dead)continue;
        playerHitbox.min.set(player.pos.x-.36,player.pos.y+.1,player.pos.z-.36);playerHitbox.max.set(player.pos.x+.36,player.pos.y+CFG.eye+.12,player.pos.z+.36);
        const hit=projectileRay.ray.intersectBox(playerHitbox,bulletHit),distance=hit?pos.distanceTo(bulletHit):Infinity;
        if(distance<hitDistance){hitDistance=distance;hitPlayer=player;}
      }
      if(hitPlayer&&hitDistance<=step&&(!wall||hitDistance<wall.distance)){hurtTarget(hitPlayer,p.dmg);dead=true;}
      else if(wall){emit('spark',wall.point,4,3,.3,.7,.3);dead=true;}
      pos.addScaledVector(p.v, dt);
    }
    if (dead) { state.world.remove(p.mesh); state.projs.splice(i, 1); }
  }
}
function addRing(x, y, z, radius, dur, color, wave) {
  const mesh = new THREE.Mesh(wave ? new THREE.RingGeometry(0.88, 1, 48) : new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.scale.setScalar(wave ? 0.1 : radius); state.world.add(mesh);
  state.rings.push({ mesh, t: 0, dur, radius, wave });
}
function updateRings(dt) {
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i]; r.t += dt; const k = r.t / r.dur;
    if (k >= 1) { state.world.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); state.rings.splice(i, 1); continue; }
    if (r.wave) { r.mesh.scale.setScalar(r.radius * k + 0.1); r.mesh.material.opacity = 0.8 * (1 - k); }
    else r.mesh.material.opacity = 0.15 + 0.35 * Math.abs(Math.sin(k * Math.PI * 4));
  }
}
function bossAI(m, dt, dist) {
  if (!m.enraged && m.hp < m.maxhp * 0.5) {
    m.enraged = true; m.speedMul *= 1.4; banner('THE WARLORD ENRAGES'); sfx.growl(1); state.shake = 1;
    for (let i = 0; i < 4; i++) spawnMonster(i % 2 ? 'runner' : 'grunt', m.x + rand(-6, 6), m.z + rand(-6, 6));
  }
  if (m.slamT > 0) {
    m.slamT -= dt; m.attackAnim = clamp(1 - m.slamT / 0.9, 0, 1);
    if (m.slamT <= 0) {
      m.attackAnim = 0; const y = (m.y || 0) + 0.1;
      addRing(m.x, y, m.z, 9, 0.5, 0xffaa33, true); sfx.explosion(0.8); state.shake = Math.max(state.shake, 1.2);
      emit('debris', new THREE.Vector3(m.x, y + 0.2, m.z), 24, 9, 1, 1.5, 0.6);
      for(const player of combatPlayers()) {const d=Math.hypot(player.pos.x-m.x,player.pos.z-m.z);if(!player.dead&&d<9&&player.pos.y<(m.y||0)+.9)hurtTarget(player,m.T.dmg*(1-d/12));}   // jump to dodge it
    }
    return;
  }
  m.slamCd -= dt;
  if (m.slamCd <= 0 && dist < 14 && !closestPlayer(m).dead) { m.slamT = 0.9; m.slamCd = m.enraged ? 4 : 7; addRing(m.x, (m.y || 0) + 0.08, m.z, 9, 0.9, 0xff2200, false); sfx.growl(1); }
}

// ------------------------------------------------------------------ upgrade shop
const UPGRADES = [
  { id: 'dmg', name: 'DAMAGE', desc: '+12% weapon damage', base: 400, max: 5 },
  { id: 'head', name: 'HEADSHOT POWER', desc: '+0.5x headshot multiplier', base: 400, max: 5 },
  { id: 'mag', name: 'EXTENDED MAGS', desc: '+20% magazine size', base: 300, max: 5 },
  { id: 'reload', name: 'FAST HANDS', desc: '-12% reload time', base: 250, max: 5 },
  { id: 'hp', name: 'ARMOR', desc: '+20 max health, full heal', base: 300, max: 5, on: () => { P.maxHp += 20; P.hp = P.maxHp; } },
  { id: 'c4', name: 'C4 PACK', desc: '+1 C4 capacity, +2 C4 now', base: 200, max: 5, on: () => { P.c4 = Math.min(4 + up.c4, P.c4 + 2); } },
  { id: 'medkit', name: 'MEDKIT', desc: 'Restore 50 health', cost: 120, on: () => { P.hp = Math.min(P.maxHp, P.hp + 50); } },
  { id: 'ammo', name: 'AMMO CRATE', desc: 'Refill all weapons', cost: 150, on: () => {
    WEAPONS.forEach((w, i) => { const mag = magSize(w), res = w.reserve * 2; if (i === P.weapon) { P.ammo = mag; P.reserve = res; } else ws[i] = { ammo: mag, reserve: res }; }); } },
];
const upCost = u => u.max ? u.base * (up[u.id] + 1) : u.cost;
function renderShop() {
  $('shopcr').textContent = `$${state.credits}`;
  $('shopgrid').innerHTML = UPGRADES.map(u => {
    const lvl = u.max ? up[u.id] : 0, maxed = u.max && lvl >= u.max, pips = u.max ? '<div class="pips">' + '&#9632;'.repeat(lvl) + '&#9633;'.repeat(u.max - lvl) + '</div>' : '';
    return `<button class="card ${maxed ? 'maxed' : ''}" data-id="${u.id}" ${maxed || state.credits < upCost(u) ? 'disabled' : ''}><b>${u.name}</b>${u.desc}${pips}<div class="cost">${maxed ? 'MAXED' : '$' + upCost(u)}</div></button>`;
  }).join('');
}
function openShop() {
  state.shopOpen = true; state.paused = true; mouseDown = false; document.exitPointerLock();
  $('shoptitle').textContent = `LEVEL ${state.wave} CLEARED - UPGRADES`; renderShop(); $('shop').classList.remove('hidden');
}
function closeShop() {
  if(network.role==='guest'){$('shop').classList.add('hidden');state.shopOpen=false;state.paused=false;lock();banner('READY · WAITING FOR THE HOST');return;}
  $('shop').classList.add('hidden'); state.shopOpen = false; state.paused = false; startWave(state.wave + 1); lock();
}
$('shopgrid').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b || b.disabled) return;
  const u = UPGRADES.find(x => x.id === b.dataset.id), cost = upCost(u);
  if (state.credits < cost || (u.max && up[u.id] >= u.max)) return;
  state.credits -= cost; if (u.max) up[u.id]++; if (u.on) u.on(); sfx.pickup(); renderShop();
});
$('shopnext').addEventListener('click', closeShop);

// ------------------------------------------------------------------ waves
const aliveCount = () => state.monsters.reduce((n, m) => n + (m.dead ? 0 : 1), 0);
function banner(text) { $('banner').textContent = text; $('banner').style.opacity = 1; state.bannerT = 2.2; }
function spawnSentries(n) {
  for (let i=0;i<n;i++) { const p=defenderSpot(0.6); if(p) spawnMonster('sentry',p.x,p.z); }
}
function startWave(n) {
  state.wave = n; state.toSpawn = Math.round((4 + n * 2) * (n % 5 === 0 ? 0.6 : 1)); state.spawnTimer = 3; state.inter = 0; state.bossQueued = n % 5 === 0; state.bossT = 4;
  P.spawnShield = 5;
  operations.start(n);
  const ns = Math.min(3, 1 + Math.floor(n / 3)); spawnSentries(ns);
  banner((n % 5 === 0 ? `LEVEL ${n} - BOSS` : `LEVEL ${n}`) + `  \u00b7  ${ns} SENTR${ns > 1 ? 'IES' : 'Y'}`); sfx.wave();
}
function pickType() {
  const w = state.wave, r = Math.random();
  if (w >= 2 && r < 0.15 && state.monsters.filter(m => !m.dead && m.type === 'drone').length < 3) return 'drone';
  const sniper = w >= 3 ? Math.min(0.04 + 0.015 * w, 0.12) : 0, shooter = w >= 2 ? Math.min(0.08 + 0.02 * w, 0.22) : 0, brute = w >= 4 ? Math.min(0.025 * w, 0.1) : 0, demon = Math.min(0.05 + 0.05 * w, 0.3), runner = w >= 2 ? Math.min(0.1 + 0.03 * w, 0.35) : 0;
  let t = r < brute ? 'brute' : r < brute + demon ? 'demon' : r < brute + demon + runner ? 'runner' : r < brute + demon + runner + shooter ? 'shooter' : r < brute + demon + runner + shooter + sniper ? 'sniper' : 'grunt';
  if (state.monsters.reduce((n, m) => n + (!m.dead && m.type === t ? 1 : 0), 0) >= MONSTER_TYPES[t].cap) t = 'grunt';
  return t;
}
function ringSpot() {
  const hx = state.map.size[0] / 2 - 3, hz = state.map.size[1] / 2 - 3;
  for (let i = 0; i < 20; i++) {
    const a = rand(0, Math.PI * 2), r = rand(32, 55), x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    if (Math.abs(x) > hx || Math.abs(z) > hz) continue;
    if (state.colliders.some(c => x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) continue;
    let y = 0;
    if (state.collMesh) { const f = floorAt(x, z, P.pos.y + 6, 40); if (f === null || Math.abs(f - P.pos.y) > 10) continue; y = f; }
    return [x, z, y];
  }
  return null;
}
function spawnWaveMonster(forced) {
  const type = forced || pickType(), T = MONSTER_TYPES[type];
  if (T.stationary) {
    const spot = defenderSpot(T.radius);
    if (!spot) return false;
    spawnMonster(type, spot.x, spot.z); return true;
  }
  if (state.map.ring) { const p = ringSpot(); if (p) { spawnMonster(type, p[0], p[1]); return true; } }
  const far = state.map.spawns.filter(([x,z]) => Math.hypot(x-P.pos.x,z-P.pos.z)>15 && !fieldBlocked(x,z,1));
  if (!far.length) return false;
  const [x,z] = far[Math.floor(Math.random()*far.length)]; spawnMonster(type,x,z); return true;
}
function updateWaves(dt) {
  if (state.mode !== 'playing') return;
  if (state.inter > 0) { state.inter -= dt; if (state.inter <= 0) openShop(); return; }
  if (state.bossQueued) { state.bossT -= dt; if (state.bossT <= 0) { if (spawnWaveMonster('boss')) { state.bossQueued = false; banner('BOSS: MINOTAUR WARLORD'); sfx.growl(1); } else state.bossT = 1; } }
  if (state.toSpawn > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (aliveCount() < Math.min(16, 5 + state.wave)) { if (spawnWaveMonster()) state.toSpawn--; }
      state.spawnTimer = Math.max(1, 2.6 - state.wave * 0.08) * (state.difficulty === 'relaxed' ? 1.25 : 1);
    }
  } else if (aliveCount() === 0 && !state.bossQueued && operations.ready) {
    state.inter = 2.5;
    if(network.role==='host')for(const player of network.players.values())if(player.id!==network.id)network.direct(player.id,'sector',{credits:200*state.wave,heal:35});
    giveAmmo(); state.score += 200 * state.wave; state.credits += 200 * state.wave; P.hp = Math.min(P.maxHp, P.hp + 25); P.c4 = Math.min(4 + up.c4, P.c4 + 1);
    sfx.pickup(); banner(`LEVEL ${state.wave} CLEARED  +${200 * state.wave}`);
    if (state.gameMode === 'campaign' && state.wave >= 10) endMatch(true);
  }
}

// ------------------------------------------------------------------ player
function hurtPlayer(a) {
  if (P.dead || P.spawnShield > 0 || P.damageGrace > 0) return;
  const difficulty = state.difficulty === 'relaxed' ? .55 : 1;
  P.hp -= Math.min(a,24) * difficulty * (operations.buffs.shield > 0 ? 0.35 : 1);
  P.damageGrace = .5; P.sinceHurt = 0;
  state.hurt = Math.min(1, state.hurt + 0.35); state.shake = Math.max(state.shake, 0.2); sfx.hurt();
  if (P.hp <= 0) die();
}
function die() {if(state.gameMode==='duel')return;if(network.role){P.dead=true;P.deadT=0;banner('DOWN · RESPAWNING IN 8 SECONDS');return;}endMatch(false);}
function endMatch(won) {
  P.dead = true; P.won = won; P.deadT = 0; state.mode = 'over'; mouseDown = false;document.body.classList.remove('mobile-playing');
  if (won) for (const m of state.monsters) m.dead = true;
  const key = `ms-best-${state.mapKey}-${state.gameMode}`; let best = 0;
  try { best = +localStorage.getItem(key) || 0; if (state.score > best) localStorage.setItem(key, state.score); } catch (e) {}
  const acc = state.shots ? Math.round(state.hits / state.shots * 100) : 0, hs = state.hits ? Math.round(state.heads / state.hits * 100) : 0, t = state.matchT | 0;
  $('overtitle').textContent = won ? 'MATCH WON' : 'YOU DIED';
  $('overstats').innerHTML = `Level ${state.wave} &middot; ${state.kills} kills &middot; ${state.heads} headshots (${hs}%) &middot; accuracy ${acc}%<br>Score ${state.score} ${state.score > best ? '&mdash; NEW BEST!' : '&mdash; best ' + best}<br>Time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('over').classList.remove('hidden'); document.exitPointerLock();
}

function updatePlayer(dt) {
  if(P.dead){P.deadT+=dt;if(state.gameMode!=='duel'&&network.role&&P.deadT>8){P.dead=false;P.deadT=0;P.hp=P.maxHp*.75;P.spawnShield=5;P.damageGrace=0;P.pos.copy(state.coopSpawn||new THREE.Vector3(state.map.start[0],state.map.startY||0,state.map.start[1]));P.vel.set(0,0,0);banner('BACK IN THE FIGHT');}return;}
  P.damageGrace = Math.max(0,(P.damageGrace || 0)-dt);
  P.spawnShield = Math.max(0,(P.spawnShield || 0)-dt);
  P.sinceHurt = (P.sinceHurt || 0)+dt;
  if (state.gameMode!=='duel'&&state.difficulty === 'relaxed' && P.sinceHurt > 7 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp,P.hp+3*dt);
  const fwd = clamp((keys.KeyW||keys.ArrowUp ? 1 : 0) - (keys.KeyS||keys.ArrowDown ? 1 : 0) - touchMove.y,-1,1), side = clamp((keys.KeyD||keys.ArrowRight ? 1 : 0) - (keys.KeyA||keys.ArrowLeft ? 1 : 0) + touchMove.x,-1,1);
  const speed = (keys.ShiftLeft && fwd > 0&&!isAiming() ? CFG.sprint : CFG.walk) * (isAiming()?.65:1) * (operations.buffs.speed > 0 ? 1.35 : 1);
  const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
  let wx = -sin * fwd + cos * side, wz = -cos * fwd - sin * side;
  const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
  const k = 1 - Math.exp(-(P.onGround ? 16 : 3) * dt);
  P.vel.x += (wx * speed - P.vel.x) * k; P.vel.z += (wz * speed - P.vel.z) * k;
  if (keys.Space && P.onGround) { P.vel.y = CFG.jump; P.onGround = false; }
  P.vel.y -= CFG.gravity * dt;
  const previousX=P.pos.x,previousZ=P.pos.z;
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  if(state.waterMesh && [ [0,0],[CFG.playerRadius,0],[-CFG.playerRadius,0],[0,CFG.playerRadius],[0,-CFG.playerRadius] ].some(([dx,dz])=>{const x=P.pos.x+dx,z=P.pos.z+dz;_o.set(x,P.pos.y+.6,z);const ground=castRay(_o,DOWN,400);return waterAt(x,z,ground?.point.y??null);})){P.pos.x=previousX;P.pos.z=previousZ;P.vel.x=P.vel.z=0;}
  const floor = resolveCircle(P.pos, CFG.playerRadius, P.pos.y, true);
  if (state.collMesh) {
    if (P.pos.y < state.minY) { P.pos.set(state.map.start[0], state.map.startY + 0.5, state.map.start[1]); P.vel.set(0, 0, 0); }
    else if (P.onGround && P.vel.y <= 0 && floor > -1e8 && P.pos.y > floor && P.pos.y - floor < 0.7) P.pos.y = floor;   // stick to slopes
  }
  P.pos.y += P.vel.y * dt;
  if (P.pos.y <= floor && P.vel.y <= 0) { P.pos.y = floor; P.vel.y = 0; P.onGround = true; } else P.onGround = false;
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && sp > 0.5) { const previous = Math.floor(P.bob / Math.PI); P.bob += dt * sp * 1.4; if (Math.floor(P.bob / Math.PI) !== previous) sfx.step(); }
}

const cameraOffset=new THREE.Vector3(),cameraDirection=new THREE.Vector3(),cameraRay=new THREE.Raycaster();
cameraRay.firstHitOnly=true;
function updateCamera(dt) {
  const aiming=isAiming()&&!P.dead;
  camera.fov+=( (aiming?48:75)-camera.fov)*(1-Math.exp(-dt*12));camera.updateProjectionMatrix();
  $('cross').classList.toggle('aiming',aiming);
  $('scope-overlay').classList.toggle('hidden',!aiming||!scopeEffect);
  P.kick *= Math.exp(-dt * 7);
  state.shake = Math.max(0, state.shake - dt * 2.5);
  const sp = Math.hypot(P.vel.x, P.vel.z);
  let eye = CFG.eye + (P.onGround ? Math.sin(P.bob) * 0.03 * clamp(sp / 6, 0, 1.3) : 0), roll = 0;
  if (P.dead && !P.won) { eye = Math.max(0.35, CFG.eye - P.deadT * 2.5); roll = Math.min(P.deadT * 1.2, 0.9); }
  const s = state.shake;
  camera.position.set(P.pos.x + rand(-1, 1) * s * 0.04, P.pos.y + eye + rand(-1, 1) * s * 0.04, P.pos.z + rand(-1, 1) * s * 0.04);
  camera.rotation.set(P.pitch + P.kick + rand(-1, 1) * s * 0.01, P.yaw + rand(-1, 1) * s * 0.01, roll);
  if (state.thirdPerson && !P.dead) {
    const offset=cameraOffset.set(aiming ? .5 : state.cameraMode==='wide' ? .25 : .65,aiming ? .05 : state.cameraMode==='wide' ? .65 : .25,aiming ? 1.65 : state.cameraMode==='wide' ? 4.5 : 2.9).applyQuaternion(camera.quaternion),distance=offset.length();
    cameraDirection.copy(offset).multiplyScalar(1/distance);
    let wall;
    if(state.collMesh)wall=castRay(camera.position,cameraDirection,distance);
    else{cameraRay.set(camera.position,cameraDirection);cameraRay.far=distance;wall=cameraRay.intersectObjects(state.wallMeshes,true)[0];}
    camera.position.addScaledVector(offset,wall ? Math.max(.05,wall.distance-.2)/distance : 1);
  }
  if (playerAvatar) {playerAvatar.root.visible=!!state.thirdPerson && !P.dead;playerAvatar.root.position.copy(P.pos);playerAvatar.root.rotation.y=P.yaw+Math.PI;playerAvatar.update(dt,sp>.5,sp,P.weapon,P.pitch);}
  camera.updateMatrixWorld();
  if (state.sun) { state.sun.target.position.set(P.pos.x, 0, P.pos.z); state.sun.position.set(P.pos.x + 20, 45, P.pos.z + 12); state.sun.target.updateMatrixWorld(); }
}

// ------------------------------------------------------------------ weapons
function startReload() {
  if (P.reloading > 0 || P.ammo >= magSize() || P.reserve <= 0 || P.dead) return;
  P.reloadDur = CFG.gun.reload * (1 - 0.12 * up.reload) * selectedHero().reload; P.reloading = P.reloadDur; sfx.reload();
}
function handleShooting(dt) {
  P.fireCd -= dt;
  if (P.reloading > 0) {
    P.reloading -= dt;
    if (P.reloading <= 0) { const take = Math.min(magSize() - P.ammo, P.reserve); P.ammo += take; P.reserve -= take; }
  }
  if (P.dead || !mouseDown || P.reloading > 0 || P.fireCd > 0) return;
  if (P.ammo <= 0) { sfx.empty(); P.fireCd = 0.25; startReload(); return; }
  P.ammo--; P.fireCd = 60 / CFG.gun.rpm; fire();
}
const _bx = new THREE.Box3(), _bv = new THREE.Vector3();
function rayNear(m) {                          // cheap box test so we only ray-test monsters near the line of fire
  const r = m.T.radius + 0.35, y = m.y || 0;
  _bx.min.set(m.x - r, y - 0.2, m.z - r); _bx.max.set(m.x + r, y + m.T.h + 0.3, m.z + r);
  return ray.ray.intersectsBox(_bx, _bv) !== null;
}
function fire() {
  state.shots++;
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const sp = CFG.gun.spread * (isAiming()?.25:1) * (1 + (keys.ShiftLeft ? 0.5 : 0) + (P.onGround ? 0 : 1.5));
  dir.x += rand(-sp, sp); dir.y += rand(-sp, sp); dir.z += rand(-sp, sp); dir.normalize();
  ray.set(eye, dir); ray.far = CFG.gun.range;
  const targets = [...state.wallMeshes];
  if(state.gameMode!=='duel'){
    for (const m of state.monsters) if (!m.dead) targets.push(m.group);
    for (const b of state.barrels) if (b.alive) targets.push(b.proxy);
  }
  const aimHits=ray.intersectObjects(targets,true),aimPoint=aimHits[0]?.point||eye.clone().addScaledVector(dir,CFG.gun.range);
  gunPivot.updateMatrixWorld(true);
  const origin=state.thirdPerson&&playerAvatar?playerAvatar.muzzle():camera.localToWorld(gunPivot.localToWorld(muzzles[P.weapon].clone()));
  dir.copy(aimPoint).sub(origin).normalize();ray.set(origin,dir);
  const hits = ray.intersectObjects(targets, true);
  const end = origin.clone().addScaledVector(dir, CFG.gun.range);
  if (hits.length) {
    const h = hits[0], o = h.object; end.copy(h.point);
    if (o.userData.monster) {
      const mm = o.userData.monster, head = (h.point.y - (mm.y || 0)) / mm.T.h > mm.T.headFrom;
      damageMonster(mm, (operations.buffs.damage > 0 ? 1.8 : 1) * CFG.gun.dmg * (1 + 0.12 * up.dmg) * (head ? CFG.gun.headMul + 0.5 * up.head : (mm.T.bodyMul || 1)), h.point, false, head);
      state.hits++; if (head) state.heads++;
      state.hitT = head ? 0.22 : 0.12; state.hitHead = head; head ? sfx.headshot() : sfx.hit();
    } else if (o.userData.barrel) { damageBarrel(o.userData.barrel, CFG.gun.dmg * (1 + 0.12 * up.dmg), h.point); state.hitT = 0.1; state.hitKill = false; state.hitHead = false; }
    else if(state.gameMode!=='duel')emit('spark', h.point, 5, 3, 0.3, 0.7, 0.3);
  }
  tracerMat.color.setHex(CFG.gun.tracer);
  const start = origin;
  if(state.thirdPerson)playerAvatar?.flash();
  if(state.gameMode==='duel')network.duelFire({from:start.toArray(),to:end.toArray(),weapon:P.weapon});
  else if(network.role==='guest')network.action({kind:'shot',pos:start.toArray(),end:end.toArray()});
  else if(network.role==='host')network.effect({kind:'shot',pos:start.toArray(),end:end.toArray(),owner:network.id});
  addTracer(start, end);
  P.kick += CFG.gun.recoil * rand(0.7, 1.3); P.pitch = Math.min(1.5, P.pitch + 0.0035); P.yaw += rand(-0.002, 0.002);
  P.gk = 1; state.flashT = 0.05; shotLight.position.copy(start); sfx[CFG.gun.snd]();
}

function throwC4() {
  if (P.dead || P.c4 <= 0) return;
  P.c4--; sfx.throw();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pos = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.5);
  const v = dir.clone().multiplyScalar(CFG.c4.throwSpeed); v.y += 2; v.x += P.vel.x * 0.5; v.z += P.vel.z * 0.5;
  const mesh = props.c4.clone(true); mesh.position.copy(pos);
  const led = new THREE.Mesh(unitSphere, new THREE.MeshBasicMaterial({ color: 0xff2200 }));
  led.scale.setScalar(0.02); led.position.y = 0.07; led.visible = false; mesh.add(led);
  state.world.add(mesh);
  state.c4s.push({ mesh, led, pos, v, stuck: false, blink: 0.5, ledT: 0 });
}
function detonateAll() {
  if (P.dead || !state.c4s.length) return;
  const list = state.c4s; state.c4s = [];
  for (const c of list) { state.world.remove(c.mesh); explode(c.pos.clone().setY(c.pos.y + 0.1), CFG.c4.radius, CFG.c4.dmg); }
}
function updateC4(dt) {
  for (const c of state.c4s) {
    if (c.stuck) {
      c.blink -= dt;
      if (c.blink <= 0) { c.blink = 1; c.led.visible = true; c.ledT = 0.1; sfx.beep(clamp(1 - c.pos.distanceTo(camera.position) / 25, 0.1, 1)); }
      if (c.ledT > 0) { c.ledT -= dt; if (c.ledT <= 0) c.led.visible = false; }
      continue;
    }
    c.v.y -= CFG.gravity * dt * 0.8;
    const nx = c.pos.x + c.v.x * dt, ny = c.pos.y + c.v.y * dt, nz = c.pos.z + c.v.z * dt;
    if (state.collMesh) {
      const sp = Math.hypot(c.v.x, c.v.y, c.v.z) * dt + 0.08; _d.set(c.v.x, c.v.y, c.v.z).normalize();
      const hh = castRay(c.pos, _d, sp);
      if (hh) { const nr = hh.face.normal.clone(); if (nr.dot(_d) > 0) nr.negate(); c.pos.copy(hh.point).addScaledVector(nr, 0.04); c.stuck = true; }
      else { c.pos.set(nx, ny, nz); c.mesh.rotation.y += dt * 4; if (ny < state.minY) c.stuck = true; }
      c.mesh.position.copy(c.pos); continue;
    }
    let handled = false;
    for (const col of state.colliders) {
      if (nx > col.minX - 0.1 && nx < col.maxX + 0.1 && nz > col.minZ - 0.1 && nz < col.maxZ + 0.1 && ny < col.h) {
        if (c.pos.y >= col.h) c.pos.set(nx, col.h + 0.03, nz);
        c.stuck = true; handled = true; break;
      }
    }
    if (!handled) {
      c.pos.set(nx, ny, nz);
      if (ny <= 0.03) { c.pos.y = 0.03; c.stuck = true; }
      c.mesh.rotation.y += dt * 4;
    }
    c.mesh.position.copy(c.pos);
  }
}

// ------------------------------------------------------------------ gun viewmodel + HUD
function updateGun(dt) {
  P.gk = Math.max(0, P.gk - dt * 14);
  P.swayX *= Math.exp(-dt * 8); P.swayY *= Math.exp(-dt * 8);
  const sp = clamp(Math.hypot(P.vel.x, P.vel.z) / 6, 0, 1.4), moving = P.onGround ? sp : 0;
  const rl = P.reloading > 0 ? Math.sin((1 - P.reloading / (P.reloadDur || CFG.gun.reload)) * Math.PI) : 0;
  gunPivot.visible = !P.dead;
  gunPivot.position.set(
    (isAiming()?0:gunBase.x) + Math.sin(P.bob * 0.5) * 0.012 * moving + P.swayX,
    (isAiming()?-.12:gunBase.y) + Math.abs(Math.cos(P.bob * 0.5)) * 0.012 * moving + P.swayY - rl * 0.25,
    (isAiming()?-.48:gunBase.z) + P.gk * 0.06);
  gunPivot.rotation.set(P.gk * 0.08 - rl * 0.6, P.swayX * 2, rl * 0.3);
  if (flashMesh) {
    state.flashT -= dt;
    const on = state.flashT > 0;
    flashMesh.visible = on; muzzleLight.intensity = on ? 1.5 : 0;
    if (on) flashMesh.rotation.z = rand(0, Math.PI * 2);
    shotLight.intensity = on ? 60 * (state.flashT / 0.05) : 0;
  }
}
const MINI = 160, MSC = 2;
let miniStatic = null;
function buildMinimap() {
  if (state.map.open) { miniStatic = null; return; }
  const [W, D] = state.map.size, c = document.createElement('canvas'); c.width = W * MSC; c.height = D * MSC;
  const x = c.getContext('2d'); x.fillStyle = '#142730'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#233c43';
  for (const b of state.map.blocks) if (b[0] === 'road') x.fillRect((b[1] - b[3] / 2 + W / 2) * MSC, (b[2] - b[4] / 2 + D / 2) * MSC, b[3] * MSC, b[4] * MSC);
  for (const col of state.colliders) {
    x.fillStyle = col.h > 2.5 ? '#55737a' : '#36535b';
    x.fillRect((col.minX + W / 2) * MSC, (col.minZ + D / 2) * MSC, Math.max(2, (col.maxX - col.minX) * MSC), Math.max(2, (col.maxZ - col.minZ) * MSC));
  }
  miniStatic = c;
}
let lastRadarDraw=-Infinity;
function drawMinimap() {
  // Mobile radar refreshes at 8 Hz to leave more time for the 3D scene.
  const now=performance.now();if(now-lastRadarDraw<(touchDevice?125:graphicsMode==='performance'?80:50))return;lastRadarDraw=now;
  const info=renderRadar($('mini'),{player:P,map:state.map,background:miniStatic,backgroundScale:MSC,
    monsters:state.monsters,items:state.gameMode==='duel'?[]:operations.items,peers:state.gameMode==='duel'?[]:network.players.values(),selfId:network.id,time:state.time});
  $('radar-contacts').textContent=String(info.contacts).padStart(2,'0')+' CONTACTS';
  $('radar-objective').textContent=state.gameMode==='duel'?'SIGNAL JAMMED':info.distance===null?'NO ACTIVE RELAY':'RELAY '+info.distance+' m';
}
function updateHUD(dt) {
  drawMinimap();
  state.hurt = Math.max(0, state.hurt - dt * 1.5); state.hitT = Math.max(0, state.hitT - dt);
  $('hpfill').style.width = Math.max(0, P.hp) / P.maxHp * 100 + '%'; $('hptext').textContent = Math.max(0, Math.ceil(P.hp));
  $('ammo').textContent = P.reloading > 0 ? 'RELOADING' : `${P.ammo} / ${P.reserve}`;
  $('c4txt').textContent = `C4 x${P.c4}   ARMED ${state.c4s.filter(c => c.stuck).length} [F]`;
  $('camera-label').textContent = (state.cameraMode === 'first' ? 'FIRST PERSON' : state.cameraMode === 'wide' ? 'THIRD PERSON / WIDE' : 'THIRD PERSON / SHOULDER') + ' · V SWITCH';
  $('protection').textContent = P.spawnShield > 0 ? `DEPLOYMENT SHIELD ${Math.ceil(P.spawnShield)}s` : '';
  $('wave').textContent = state.gameMode==='duel'?'1V1 DUEL':state.inter > 0 ? `LEVEL ${state.wave} CLEARED` : `LEVEL ${state.wave}`;
  const boss = state.monsters.find(m => m.T.boss && !m.dead); $('bossbar').classList.toggle('hidden', !boss);
  if (boss) { $('bossname').textContent = boss.T.name; $('bossfill').style.width = Math.max(0, boss.hp / boss.maxhp * 100) + '%'; }
  $('credits').textContent = '$' + state.credits;
  $('score').textContent = state.score; $('wname').textContent = CFG.gun.name;
  $('left').textContent = state.gameMode==='duel'?'FIRST TO 5':`${aliveCount() + state.toSpawn + (state.bossQueued ? 1 : 0)} HOSTILES`;
  $('compass').textContent = ['N','NE','E','SE','S','SW','W','NW'][Math.round((( -P.yaw * 180 / Math.PI) % 360 + 360) % 360 / 45) % 8] + ' / ' + state.map.name.toUpperCase();
  $('hurt').style.opacity = clamp(state.hurt + (P.hp < 30 && !P.dead ? 0.25 : 0), 0, 1);
  $('hit').style.opacity = state.hitT > 0 ? 1 : 0; $('hit').classList.toggle('kill', state.hitKill); $('hit').classList.toggle('head', state.hitHead);
  state.bannerT -= dt; if (state.bannerT <= 0) $('banner').style.opacity = 0;
}

// ------------------------------------------------------------------ main loop
function update(dt) {
  if(network.role==='guest'&&state.hostPaused){updateCamera(dt);updateHUD(dt);return;}
  state.time += dt; if (!P.dead) state.matchT += dt;
  updatePlayer(dt); updateCamera(dt); handleShooting(dt);
  if(state.gameMode!=='duel'){
    operations.update(dt);
    if(network.role==='guest')updateGuestMonsters(dt);else{updateWaves(dt);updateMonsters(dt);updateBarrels(dt);}
    updateC4(dt);
  }
  updateRemotePlayers(dt);
  updateFx(dt); updateParticles(dt); updateFloaters(dt); updateProjs(dt); updateRings(dt); updateTracers(dt); updateGun(dt); updateHUD(dt);
}
// Lower resolution only after sustained slow frames; avoid reacting to loading stalls.
let graphicsMode='performance',renderScale=Math.min(devicePixelRatio,1),frameSamples=0,frameTotal=0;
function setGraphics(mode){
  graphicsMode=mode;renderScale=Math.min(devicePixelRatio,mode==='quality'?(touchDevice ? 1.35 : 1.5):1);
  renderer.setPixelRatio(renderScale);renderer.shadowMap.enabled=mode==='quality'&&!touchDevice;
  if(!touchDevice&&mode==='quality'){scene.add(shotLight);if(muzzleLight)gunPivot.add(muzzleLight);}
  else{shotLight.removeFromParent();muzzleLight?.removeFromParent();}
  scene.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.needsUpdate=true;});
  frameSamples=frameTotal=0;
  document.querySelectorAll('.graphicsbtn').forEach(b=>b.classList.toggle('sel',b.dataset.graphics===mode));
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if((state.paused||state.mode!=='playing')&&now-last<140)return;
  if(touchDevice&&now-last<29)return;
  const elapsed=(now-last)/1000;
  const dt = Math.min(0.05, elapsed); last = now;
  if(graphicsMode==='performance'&&state.mode==='playing'&&!state.paused&&!document.hidden&&elapsed>0&&elapsed<.2){
    frameTotal+=elapsed;frameSamples++;
    if(frameSamples>=120){
      const average=frameTotal/frameSamples;
      const target=Math.min(devicePixelRatio,1);
      if(average>(touchDevice ? 1/25 : 1/45)&&renderScale>(touchDevice ? .75 : .65)){renderScale=Math.max(touchDevice ? .75 : .65,renderScale-.1);renderer.setPixelRatio(renderScale);}
      else if(average<(touchDevice ? 1/29 : 1/55)&&renderScale<target){renderScale=Math.min(target,renderScale+.05);renderer.setPixelRatio(renderScale);}
      frameTotal=frameSamples=0;
    }
  }else{frameTotal=frameSamples=0;}
  const movementSpeed=state.paused||P.dead?0:Math.hypot(P.vel.x,P.vel.z);
  network.tick(now/1000,{pos:P.pos.toArray(),yaw:P.yaw,pitch:P.pitch,weapon:P.weapon,aiming:isAiming(),hp:P.hp,active:state.mode==='playing',moving:movementSpeed>.5,speed:movementSpeed},state.map&&network.role==='host'&&state.gameMode!=='duel'?coopSnapshot:null);
  const ambientOn = state.mode === 'playing' && !state.paused;
  if (state.ambientOn !== ambientOn) { state.ambientOn = ambientOn; setAmbience(ambientOn); }
  if(state.mode==='playing'&&!state.paused)update(dt);
  if(state.paused||state.mode!=='playing')return;
  renderer.clear();
  if (state.map && state.mode !== 'menu') {
    renderer.render(scene, camera);
    if (!P.dead && !state.thirdPerson) { renderer.clearDepth(); renderer.render(viewScene, viewCam); }
  }
}

// ------------------------------------------------------------------ flow / input
function mouseLockFailed() {
  if(state.mode!=='playing'||state.shopOpen)return;
  locked=document.pointerLockElement===renderer.domElement;
  if(locked)return;
  showPause();
  $('mouse-status').textContent='Click RESUME to capture the mouse for continuous turning. If your browser blocks capture, open the game in Chrome or Edge.';
}
function lock() {
  if(state.mode!=='playing'||state.shopOpen)return;
  if(touchDevice){state.paused=false;$('pause').classList.add('hidden');document.body.classList.add('mobile-playing');return;}
  try {
    const result=renderer.domElement.requestPointerLock();
    if(result?.catch)result.catch(mouseLockFailed);
  }catch {mouseLockFailed();}
}
function showPause() { if(network.role==='guest')network.action({kind:'interact',held:false});operations.input(false); for (const k in keys) keys[k] = false;touchMove.x=touchMove.y=0;state.paused = true; mouseDown = false;aimHeld=false;aimToggle=false;$('scope-overlay').classList.add('hidden');document.body.classList.remove('mobile-playing');$('pause').classList.remove('hidden'); }

function duelGuestSpawn(host){
  if(!state.map.open){const candidate=state.map.spawns.reduce((best,p)=>Math.hypot(p[0]-host.x,p[1]-host.z)>Math.hypot(best[0]-host.x,best[1]-host.z)?p:best,state.map.spawns[0]);return [candidate[0],0,candidate[1]];}
  for(let radius=70;radius>=25;radius-=15)for(let i=0;i<16;i++){
    const a=i*Math.PI/8,x=host.x+Math.cos(a)*radius,z=host.z+Math.sin(a)*radius,y=floorAt(x,z,host.y+8,18);
    if(y!==null&&Math.abs(y-host.y)<5)return [x,y,z];
  }
  return [host.x,host.y,host.z];
}

async function startGame(key,setup=null) {
  if(setup?.gameMode)state.gameMode=setup.gameMode;
  if(state.gameMode==='duel'&&!setup&&(network.role!=='host'||network.players.size!==2)){$('loadtxt').textContent='1V1 needs a room with exactly two players. Create a room, invite a friend, then choose a map.';return;}
  initAudio();
  state.mode='loading'; state.paused=true; document.querySelectorAll('.mapbtn').forEach(b=>b.disabled=true);
  state.mapKey = key; loadMap(key); releaseUnusedMaps(key); showMapLoading(key,state.map); await tick();
  if (state.map.open) {
    document.querySelectorAll('.mapbtn').forEach(b => { b.disabled = true; }); $('menu').classList.remove('hidden'); $('over').classList.add('hidden');
    try { await loadOpenWorld(state.map); } catch (e) { $('map-loading').classList.add('hidden'); $('loadtxt').textContent = 'Map failed to load: ' + e.message; console.error(e); state.mode='menu';state.paused=false;network.render(); return; }
    $('loadtxt').textContent = 'SYSTEM READY / SELECT YOUR DEPLOYMENT'; document.querySelectorAll('.mapbtn').forEach(b => { b.disabled = false; });
  }
  if(setup){state.map.start=[setup.spawn[0],setup.spawn[2]];state.map.startY=setup.spawn[1];}
  $('menu').classList.remove('hidden'); loadingStage('prepare','Preparing field architecture and collision…');
  await tick();
  try { await dressMap(state,floorAt,buildCollision); }
  catch(e) { console.warn('Map dressing failed',e); }
  try { playerAvatar=await buildHero();state.world.add(playerAvatar.root);playerAvatar.root.visible=false; }
  catch(e) { console.warn('Hero model unavailable',e); }
  document.querySelectorAll('.mapbtn').forEach(b=>b.disabled=false);
  WEAPONS.forEach((w, i) => { ws[i] = { ammo: w.mag, reserve: w.reserve }; }); CFG.gun = WEAPONS[0]; setWeaponVisual(0);
  state.floaters = []; $('floaters').innerHTML = ''; for (const k in up) up[k] = 0;
  Object.assign(state, { credits: 0, shopOpen: false, bossQueued: false }); $('shop').classList.add('hidden'); $('bossbar').classList.add('hidden');
  Object.assign(state, { shots: 0, hits: 0, heads: 0, matchT: 0, hitHead: false });
  Object.assign(P, { hp: 100, ammo: CFG.gun.mag, reserve: CFG.gun.reserve, maxHp: 100, reloadDur: 2, c4: CFG.c4.start, fireCd: 0, reloading: 0, dead: false, deadT: 0, kick: 0, bob: 0, onGround: true, gk: 0, pitch: 0, weapon: 0, won: false });
  const heroConfig=selectedHero();P.hp=P.maxHp=heroConfig.hp;CFG.walk=heroConfig.speed;CFG.sprint=heroConfig.speed*1.58;
  state.thirdPerson=state.cameraMode!=='first' && !!playerAvatar;
  Object.assign(P,{damageGrace:0,spawnShield:5,sinceHurt:0});
  document.documentElement.style.setProperty('--hero-name',JSON.stringify(heroConfig.name+' / VITALS'));
  P.pos.set(state.map.start[0],state.map.startY||0,state.map.start[1]);
  if(setup){P.pos.fromArray(state.gameMode==='duel'?setup.guestSpawn:setup.spawn);if(state.gameMode!=='duel'){const offset=Number(network.id?.slice(1)||1)%3;P.pos.x+=offset*1.2;}const floor=state.collMesh?floorAt(P.pos.x,P.pos.z,P.pos.y+1,3):0;if(floor!==null)P.pos.y=floor;state.difficulty=setup.difficulty;}
  if(state.gameMode==='duel'){P.hp=P.maxHp=100;P.c4=0;state.wave=0;state.toSpawn=0;$('duel-hud').classList.remove('hidden');$('objective').classList.add('hidden');$('radar').classList.add('duel-radar');}
  else{$('duel-hud').classList.add('hidden');$('objective').classList.remove('hidden');$('radar').classList.remove('duel-radar');}
  state.coopSpawn=P.pos.clone();P.vel.set(0,0,0);P.yaw=Math.atan2(P.pos.x,P.pos.z);
  Object.assign(state, { score: 0, kills: 0, hurt: 0, shake: 0, hitT: 0, flashT: 0, paused: false, mode: 'playing' });
  for (const k in keys) keys[k] = false; mouseDown = false;
  $('menu').classList.add('hidden'); $('map-loading').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden');$('mobile-controls').classList.toggle('hidden',!touchDevice);
  if(state.gameMode==='duel'){
    if(network.role==='host')network.start({mapKey:key,spawn:P.pos.toArray(),guestSpawn:duelGuestSpawn(P.pos),gameMode:'duel',difficulty:state.difficulty});
    if(pendingDuelState){applyDuelState(pendingDuelState);pendingDuelState=null;}
    banner('FIND YOUR RIVAL · FIRST TO 5 KILLS');
  }else if(network.role==='guest'){state.wave=1;state.toSpawn=0;operations.start(1);if(pendingSnapshot){applyCoopSnapshot(pendingSnapshot);pendingSnapshot=null;}}
  else{startWave(1);if(network.role==='host')network.start({mapKey:key,spawn:P.pos.toArray(),gameMode:state.gameMode,difficulty:state.difficulty});}
  update(0);
  showPause();
  $('mouse-status').textContent=touchDevice?'Ready. Tap PLAY WITH TOUCH CONTROLS to begin.':'Ready. Click RESUME to capture the mouse and begin.';
  $('windowed').textContent=touchDevice?'PLAY WITH TOUCH CONTROLS':'RESUME · CAPTURE MOUSE';
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) { state.paused = false; $('pause').classList.add('hidden'); renderer.domElement.style.cursor='none'; }
  else if (state.mode === 'playing' && !state.shopOpen) showPause();
});
document.addEventListener('pointerlockerror', mouseLockFailed);
$('pause').addEventListener('click', lock);
$('windowed').addEventListener('click', e => { e.stopPropagation(); lock(); });
$('music-volume').addEventListener('input',e=>{setMusicVolume(Number(e.target.value)/100);$('music-level').textContent=e.target.value+'%';});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
$('restart').addEventListener('click', () => startGame(state.mapKey));
$('tomenu').addEventListener('click', () => location.reload());
$('back-maps').addEventListener('click',e=>{e.stopPropagation();location.href='/?deploy=1';});

const stick=$('touch-stick'),knob=$('touch-stick-knob'),look=$('touch-look');
let stickPointer=null,lookPointer=null,lookX=0,lookY=0;
function resetStick(){stickPointer=null;touchMove.x=touchMove.y=0;knob.style.transform='translate(-50%,-50%)';}
stick.addEventListener('pointerdown',e=>{if(!touchDevice||state.paused||stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);});
stick.addEventListener('pointermove',e=>{if(e.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.max(1,Math.hypot(dx,dy)),reach=Math.min(1,length/(r.width*.36));touchMove.x=dx/length*reach;touchMove.y=dy/length*reach;knob.style.transform=`translate(calc(-50% + ${touchMove.x*38}px),calc(-50% + ${touchMove.y*38}px))`;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===stickPointer)resetStick();});
look.addEventListener('pointerdown',e=>{if(!touchDevice||state.paused||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture(e.pointerId);});
look.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer||state.paused||P.dead)return;const dx=e.clientX-lookX,dy=e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;P.yaw-=dx*.003;P.pitch=clamp(P.pitch-dy*.003,-1.5,1.5);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(event,e=>{if(e.pointerId===lookPointer)lookPointer=null;});
function touchAction(action,down){
  if(action==='fire')mouseDown=down;
  else if(action==='aim')aimHeld=down;
  else if(action==='jump')keys.Space=down;
  else if(action==='run')keys.ShiftLeft=down;
  else if(action==='use'){operations.input(down);if(network.role==='guest'&&state.gameMode!=='duel')network.action({kind:'interact',held:down});}
  else if(down&&action==='reload')startReload();
  else if(down&&action==='swap')switchWeapon((P.weapon+1)%WEAPONS.length);
  else if(down&&action==='c4'&&state.gameMode!=='duel'){if(state.c4s.some(c=>c.stuck))detonateAll();else throwC4();}
  else if(down&&action==='pov'&&playerAvatar){const modes=['shoulder','wide','first'];state.cameraMode=modes[(modes.indexOf(state.cameraMode)+1)%modes.length];state.thirdPerson=state.cameraMode!=='first';}
  else if(down&&action==='pause')showPause();
}
document.querySelectorAll('[data-touch]').forEach(button=>{
  let owner=null;
  button.addEventListener('pointerdown',e=>{if(!touchDevice||state.paused||owner!==null)return;e.preventDefault();e.stopPropagation();owner=e.pointerId;button.setPointerCapture(owner);button.classList.add('pressed');touchAction(button.dataset.touch,true);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId!==owner)return;owner=null;button.classList.remove('pressed');touchAction(button.dataset.touch,false);});
});

addEventListener('keydown', e => {
  if (e.code === 'KeyM' && !e.repeat) { const muted = toggleAudio(); banner(muted ? 'AUDIO MUTED' : 'AUDIO ON'); }
  keys[e.code] = true;
  if ((e.code === 'Space'||e.code.startsWith('Arrow'))&&state.mode==='playing') e.preventDefault();
  if (e.repeat || state.mode !== 'playing' || state.paused) return;
  if (e.code === 'KeyV' && playerAvatar) {const modes=['shoulder','wide','first'];state.cameraMode=modes[(modes.indexOf(state.cameraMode)+1)%modes.length];state.thirdPerson=state.cameraMode!=='first';}
  if(e.code==='KeyC')aimToggle=!aimToggle;
  if(e.code==='KeyE'){operations.input(true);if(network.role==='guest')network.action({kind:'interact',held:true});}
  if (e.code === 'KeyR') startReload(); else if (e.code === 'Digit1') switchWeapon(0); else if (e.code === 'Digit2') switchWeapon(1); else if (e.code === 'KeyQ') switchWeapon((P.weapon + 1) % WEAPONS.length); else if (e.code === 'KeyG') throwC4(); else if (e.code === 'KeyF') detonateAll();
});
addEventListener('keyup', e => { keys[e.code] = false; if(e.code==='KeyE'){operations.input(false);if(network.role==='guest')network.action({kind:'interact',held:false});} });
addEventListener('blur', () => { operations.input(false); for (const k in keys) keys[k] = false; mouseDown = false;aimHeld=false; });
addEventListener('mousedown', e => { if (locked&&!state.paused&&e.target === renderer.domElement){if(e.button===0)mouseDown=true;if(e.button===2)aimHeld=true;} });
addEventListener('wheel', e => { if (locked && state.mode === 'playing') switchWeapon((P.weapon + (e.deltaY > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length); });
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false;if(e.button===2)aimHeld=false; });
addEventListener('mousemove', e => {
  if (!locked || P.dead || state.paused || state.mode!=='playing') return;
  P.yaw -= e.movementX * 0.0022; P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.5, 1.5);
  P.swayX = clamp(P.swayX - e.movementX * 0.0004, -0.04, 0.04); P.swayY = clamp(P.swayY + e.movementY * 0.0004, -0.03, 0.03);
});


function fieldBlocked(x,z,r=1) {
  return state.colliders.some(c => x>c.minX-r && x<c.maxX+r && z>c.minZ-r && z<c.maxZ+r) || state.barrels.some(b=>b.alive && Math.hypot(x-b.x,z-b.z)<r+0.6);
}
function fieldPath(a,b) {
  const distance=a.distanceTo(b), dir=b.clone().sub(a).normalize();
  if (state.collMesh) {
    for (let d=0;d<=distance;d+=0.8) { const p=a.clone().addScaledVector(dir,d); const y=floorAt(p.x,p.z,p.y+0.5,1.2); if(y===null || Math.abs(y-p.y)>0.45) return false; }
    return !castRay(a.clone().add(new THREE.Vector3(0,0.8,0)),dir,distance);
  }
  for(let d=0;d<=distance;d+=0.5) { const p=a.clone().addScaledVector(dir,d); if(fieldBlocked(p.x,p.z,0.5)) return false; } return true;
}
function defenderSpot(radius) {
  const max=Math.min(38,Math.max(...state.map.size)*0.75);
  for(let i=0;i<160;i++) {
    const a=rand(0,Math.PI*2),r=rand(18,max),x=P.pos.x+Math.cos(a)*r,z=P.pos.z+Math.sin(a)*r;
    if(Math.abs(x)>state.map.size[0]/2-2 || Math.abs(z)>state.map.size[1]/2-2 || fieldBlocked(x,z,radius+0.8)) continue;
    const y=state.collMesh?floorAt(x,z,P.pos.y+0.6,2):0;
    if(y===null || Math.abs(y-P.pos.y)>0.8 || state.monsters.some(m=>!m.dead&&Math.hypot(m.x-x,m.z-z)<3)) continue;
    const p=new THREE.Vector3(x,y,z), origin=p.clone().add(new THREE.Vector3(0,1.5,0)), target=P.pos.clone().add(new THREE.Vector3(0,1.2,0)), direction=target.sub(origin), distance=direction.length();
    const losRay=new THREE.Raycaster(origin,direction.normalize(),0,distance); losRay.firstHitOnly=true;
    if(losRay.intersectObjects(state.wallMeshes,true).length) continue;
    return p;
  } return null;
}
const operations=createOperations({ state,P,camera,floorAt,clearPath:fieldPath,blocked:fieldBlocked,banner,
  touchDevice,
  weaponPickup:i=>{const object=gunGroups[i].clone(true);object.visible=true;object.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});return object;},
  equipWeapon:i=>{switchWeapon(i);P.ammo=magSize();P.reserve=Math.min(WEAPONS[i].reserve*2,P.reserve+WEAPONS[i].mag);},
  reward:n=>{state.score+=n;state.credits+=n;if(network.role==='host')for(const p of network.players.values())if(p.id!==network.id)network.direct(p.id,'reward',{points:n});},refill:giveAmmo,sound:()=>sfx.pickup(),
  requestPickup:id=>network.action({kind:'pickup',id}),grantPickup:(id,kind)=>network.direct(id,'pickup',{kind}),remoteInteractions:()=>[...remoteHeld].filter(([,held])=>held).map(([id,held])=>{const p=network.players.get(id)?.position;return {held:held&&p?.active&&p.hp>0,pos:new THREE.Vector3(...(p?.pos||[9999,9999,9999]))};}) });

// Shared gameplay: the room host simulates the world; the Node server relays
// validated messages. Every client owns its local movement, camera and inventory.
const remoteAvatars=new Map(),remoteHeld=new Map();let pendingSnapshot=null,pendingDuelState=null;
function applyDuelState(data){
  if(state.gameMode!=='duel'||state.mode!=='playing'){pendingDuelState=data;return;}
  const self=data.players.find(p=>p.id===network.id),opponent=data.players.find(p=>p.id!==network.id);
  if(!self)return;
  $('duel-score').textContent=`${self.kills} — ${opponent?.kills||0}`;
  const wasDead=P.dead;
  P.hp=self.hp;
  if(self.hp<=0&&!wasDead){P.dead=true;P.deadT=0;mouseDown=false;banner('ELIMINATED · RESPAWNING');}
  if(self.hp>0&&wasDead){P.dead=false;P.deadT=0;P.pos.copy(state.coopSpawn);P.vel.set(0,0,0);P.spawnShield=2.5;banner('BACK IN THE DUEL');}
  if(data.winner){
    state.mode='over';state.paused=true;mouseDown=false;document.body.classList.remove('mobile-playing');
    $('overtitle').textContent=data.winner===network.id?'DUEL WON':'DUEL LOST';
    $('overstats').textContent=`${self.kills} kills · ${self.deaths} deaths · first to ${data.target}`;
    $('restart').classList.add('hidden');$('tomenu').textContent='BACK TO MAPS';
    $('over').classList.remove('hidden');document.exitPointerLock?.();
  }
}
function combatPlayers(){
  const players=[{id:null,pos:P.pos,dead:P.dead,hp:P.hp}];
  if(network.role==='host')for(const p of network.players.values())if(p.id!==network.id&&p.position?.active)players.push({id:p.id,pos:new THREE.Vector3(...p.position.pos),dead:p.position.hp<=0,hp:p.position.hp});
  return players;
}
function closestPlayer(m){const living=combatPlayers().filter(p=>!p.dead);return living.sort((a,b)=>Math.hypot(a.pos.x-m.x,a.pos.z-m.z)-Math.hypot(b.pos.x-m.x,b.pos.z-m.z))[0]||{id:null,pos:P.pos,dead:true};}
function hurtTarget(player,damage){if(player.id)network.direct(player.id,'hurt',{damage});else hurtPlayer(damage);}
function updateRemotePlayers(dt){
  for(const [id,entry] of remoteAvatars)if(!network.players.has(id)){entry.avatar?.root.removeFromParent();remoteAvatars.delete(id);}
  for(const p of network.players.values()){
    if(p.id===network.id||!p.position?.active)continue;
    let entry=remoteAvatars.get(p.id);
    if(!entry){entry={loading:true,avatar:null};remoteAvatars.set(p.id,entry);buildHero(p.hero).then(avatar=>{if(!remoteAvatars.has(p.id))return;entry.avatar=avatar;entry.loading=false;avatar.root.position.fromArray(p.position.pos);}).catch(e=>{console.warn('Co-op avatar',e.message);entry.loading=false;});}
    if(!entry.avatar)continue;
    const avatar=entry.avatar; if(avatar.root.parent!==state.world)state.world.add(avatar.root);
    avatar.root.visible=p.position.hp>0;avatar.root.position.lerp(new THREE.Vector3(...p.position.pos),1-Math.exp(-dt*14));avatar.root.rotation.y=angleLerp(avatar.root.rotation.y,p.position.yaw+Math.PI,Math.min(1,dt*14));avatar.update(dt,p.position.moving,p.position.speed||0,p.position.weapon||0,p.position.pitch||0);
  }
}
function updateGuestMonsters(dt){for(const m of state.monsters){m.flash=Math.max(0,m.flash-dt);m.group.position.lerp(new THREE.Vector3(m.x,m.y||0,m.z),1-Math.exp(-dt*14));m.group.rotation.y=angleLerp(m.group.rotation.y,m.netRotation||0,Math.min(1,dt*14));if(m.dead){m.deadT+=dt;m.group.rotation.x=-Math.min(1,m.deadT/.5)*Math.PI/2;}animateMonster(m,dt,(touchDevice||graphicsMode==='performance')&&Math.hypot(m.x-P.pos.x,m.z-P.pos.z)>(touchDevice?24:35));}}
function coopSnapshot(){return {mapKey:state.mapKey,wave:state.wave,toSpawn:state.toSpawn,bossQueued:state.bossQueued,paused:state.paused,shop:state.shopOpen,won:state.mode==='over'&&P.won,
  monsters:state.monsters.map(m=>({id:m.id,type:m.type,x:m.x,y:m.y||0,z:m.z,hp:m.hp,maxhp:m.maxhp,rotation:m.group.rotation.y,dead:m.dead,moving:m.moving,flash:m.flash,shootAnim:m.shootAnim,windup:m.windup})),
  barrels:state.barrels.map(b=>({id:b.netId,x:b.x,y:b.y,z:b.z,hp:b.hp,alive:b.alive})),operation:operations.snapshot()};}
function applyCoopSnapshot(s){
  if(network.role!=='guest')return;
  if(state.mode!=='playing'||s.mapKey!==state.mapKey){pendingSnapshot=s;return;}
  state.wave=s.wave;state.toSpawn=s.toSpawn;state.bossQueued=s.bossQueued;state.hostPaused=s.paused;
  const ids=new Set(s.monsters.map(m=>m.id));
  for(const m of [...state.monsters])if(!ids.has(m.id)){m.group.removeFromParent();if(m.aim)m.aim.removeFromParent();state.monsters.splice(state.monsters.indexOf(m),1);}
  for(const data of s.monsters){if(!MONSTER_TYPES[data.type])continue;let m=state.monsters.find(m=>m.id===data.id);if(!m){m=spawnMonster(data.type,data.x,data.z);m.id=data.id;m.group.position.set(data.x,data.y,data.z);}
    Object.assign(m,{x:data.x,y:data.y,z:data.z,hp:data.hp,maxhp:data.maxhp,moving:data.moving,netRotation:data.rotation,shootAnim:data.shootAnim,windup:data.windup});m.flash=Math.max(m.flash,data.flash||0);if(data.dead&&!m.dead){m.dead=true;m.deadT=0;sfx.kill();}if(m.aim)m.aim.visible=false;
  }
  if(!state.sharedBarrelsInitialized){for(const b of state.barrels)b.mesh.removeFromParent();state.barrels=[];for(const b of s.barrels){spawnBarrel(b.x,b.z,b.y);state.barrels.at(-1).netId=b.id;}state.sharedBarrelsInitialized=true;}
  for(const data of s.barrels){const b=state.barrels.find(b=>b.netId===data.id);if(!b)continue;b.hp=data.hp;b.alive=data.alive;if(!b.alive)b.mesh.removeFromParent();}
  operations.apply(s.operation);
  if(s.shop&&state.lastSharedShop!==s.wave){state.lastSharedShop=s.wave;openShop();$('shopnext').textContent='READY / WAIT FOR HOST';}
  if(!s.shop&&state.shopOpen){$('shop').classList.add('hidden');state.shopOpen=false;state.paused=false;lock();}
  if(s.won&&state.mode==='playing')endMatch(true);
}
function coopAction(id,a){
  if(network.role!=='host'||state.mode!=='playing')return;
  const player=network.players.get(id)?.position;if(!player?.active||player.hp<=0)return;
  const pos=new THREE.Vector3(...player.pos);
  if(a.kind==='interact'){remoteHeld.set(id,!!a.held);return;}
  if(a.kind==='pickup'){operations.claim(a.id,id,pos);return;}
  if(a.kind==='shot'&&Array.isArray(a.end)){const from=new THREE.Vector3(...a.pos),end=new THREE.Vector3(...a.end);if(from.distanceTo(pos)<8&&from.distanceTo(end)<300){addTracer(from,end);network.effect({kind:'shot',pos:a.pos,end:a.end,owner:id});}return;}
  const before={score:state.score,credits:state.credits,kills:state.kills};
  if(a.kind==='hit'){const m=state.monsters.find(m=>m.id===a.id&&!m.dead);if(m&&Math.hypot(m.x-pos.x,m.z-pos.z)<270)damageMonster(m,a.damage,new THREE.Vector3(...a.pos),!!a.gib,!!a.head);}
  if(a.kind==='barrel'){const b=state.barrels.find(b=>b.netId===a.id&&b.alive);if(b&&Math.hypot(b.x-pos.x,b.z-pos.z)<270)damageBarrel(b,a.damage,new THREE.Vector3(...a.pos));}
  if(a.kind==='explosion'&&pos.distanceTo(new THREE.Vector3(...a.pos))<100)explode(new THREE.Vector3(...a.pos),CFG.c4.radius,CFG.c4.dmg);
  const points=state.score-before.score,credits=state.credits-before.credits,kills=state.kills-before.kills;
  state.score=before.score;state.credits=before.credits;state.kills=before.kills;
  if(points||credits||kills)network.direct(id,'reward',{points,credits,kills});
}
const network=createNetwork({
  mode:()=>state.gameMode,
  canSelectMap:()=>!!state.modelsReady&&state.mode!=='loading',
  onRoom:({role})=>{state.coop=role;},
  onStart:setup=>{pendingSnapshot=null;state.hostPaused=false;state.sharedBarrelsInitialized=false;state.lastSharedShop=0;startGame(setup.mapKey,setup);},
  onSnapshot:applyCoopSnapshot,
  onDuelState:applyDuelState,
  onDuelShot:m=>{if(state.gameMode==='duel'&&state.mode==='playing'&&m.id!==network.id)addTracer(new THREE.Vector3(...m.from),new THREE.Vector3(...m.to));},
  onDuelEnded:message=>{if(state.gameMode==='duel'&&state.mode==='playing'){showPause();$('mouse-status').textContent=message;}},
  onAction:coopAction,
  onDirect:(type,data)=>{
    if(type==='hurt'&&state.mode==='playing')hurtPlayer(data.damage);
    if(type==='reward'){state.score+=data.points||0;state.credits+=data.credits??data.points??0;state.kills+=data.kills||0;}
    if(type==='pickup'){operations.grant(data.kind);banner(data.kind==='med'?'MEDKIT +55':'PICKUP · '+data.kind.toUpperCase());}
    if(type==='sector'){state.score+=data.credits;state.credits+=data.credits;P.hp=Math.min(P.maxHp,P.hp+data.heal);P.c4=Math.min(4+up.c4,P.c4+1);giveAmmo();}
  },
  onEffect:e=>{
    if(state.mode!=='playing')return;
    if(e.kind==='shot'&&e.owner!==network.id)addTracer(new THREE.Vector3(...e.pos),new THREE.Vector3(...e.end));
    if(e.kind==='explosion')explode(new THREE.Vector3(...e.pos),e.radius,0);
    if(e.kind==='bullets'){const from=new THREE.Vector3(...e.from),base=new THREE.Vector3(...e.dir);for(let i=0;i<e.count;i++){const dir=base.clone().applyAxisAngle(UP,(i-(e.count-1)/2)*e.spread),material=projMats[e.col]||(projMats[e.col]=new THREE.MeshBasicMaterial({color:e.col,fog:false})),mesh=new THREE.Mesh(projGeo,material);mesh.position.copy(from);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);state.world.add(mesh);state.projs.push({mesh,v:dir.multiplyScalar(e.speed),life:3,dmg:0});}}
  },
  onDisconnect:()=>{state.hostPaused=false;for(const e of remoteAvatars.values())e.avatar?.root.removeFromParent();remoteAvatars.clear();if(state.mode==='playing'){showPause();banner('CO-OP CONNECTION CLOSED');}},
});

// menu
document.querySelectorAll('.graphicsbtn').forEach(b=>b.addEventListener('click',()=>setGraphics(b.dataset.graphics)));
document.querySelectorAll('.scopebtn').forEach(b=>{b.classList.toggle('sel',(b.dataset.scope==='on')===scopeEffect);b.addEventListener('click',()=>{scopeEffect=b.dataset.scope==='on';localStorage.setItem('riftwatch-scope',scopeEffect?'on':'off');document.querySelectorAll('.scopebtn').forEach(x=>x.classList.toggle('sel',x===b));$('scope-overlay').classList.toggle('hidden',!scopeEffect||!isAiming()||state.paused);});});
document.querySelectorAll('.povbtn').forEach(b=>b.addEventListener('click',()=>{state.cameraMode=b.dataset.pov;state.thirdPerson=state.cameraMode!=='first';document.querySelectorAll('.povbtn').forEach(x=>x.classList.toggle('sel',x===b));}));
document.querySelectorAll('.difficultybtn').forEach(b=>b.addEventListener('click',()=>{state.difficulty=b.dataset.difficulty;document.querySelectorAll('.difficultybtn').forEach(x=>x.classList.toggle('sel',x===b));}));
document.querySelectorAll('.modebtn').forEach(b => b.addEventListener('click', () => { state.gameMode = b.dataset.mode; document.querySelectorAll('.modebtn').forEach(x => x.classList.toggle('sel', x === b));document.querySelector('.lobby-heading').firstChild.textContent=state.gameMode==='duel'?'PRIVATE 1V1 ROOM ':'ONLINE CO-OP ';$('lobby-status').textContent=state.gameMode==='duel'?'Create a room, invite one friend, then choose a map. First to 5 kills wins.':'Play solo, or create a room and invite up to three friends.';network.render(); }));
for (const [key, m] of Object.entries(MAPS).sort(([a],[b]) => (a === "outpost" ? -1 : b === "outpost" ? 1 : 0))) {
  const b = document.createElement('button'); b.className = 'mapbtn map-' + key; b.disabled = true; b.dataset.key = key;
  b.innerHTML = `<span class="map-index">${String(Object.keys(MAPS).indexOf(key)+1).padStart(2,"0")} / ${m.open ? "OPEN WORLD" : "COMBAT ZONE"}</span><span class="map-art"></span><b>${m.name}</b><small>${m.desc}</small><span class="deploy">DEPLOY ↗</span>`;
  b.addEventListener('click', () => startGame(key));
  $('maps').appendChild(b);
}
loadAll().then(() => {
  state.modelsReady=true;
  $('loadtxt').textContent = 'SYSTEM READY / SELECT YOUR DEPLOYMENT';
  document.querySelectorAll('.mapbtn').forEach(b => { b.disabled = false; });network.render();
}).catch(e => { $('loadtxt').textContent = 'Load error: ' + e.message; console.error(e); });
requestAnimationFrame(frame);
