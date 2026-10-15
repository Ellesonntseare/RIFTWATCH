import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {createFootGrounding} from './foot-grounding.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// h = height in metres, headFrom = fraction of height above which a hit counts as a headshot
export const MONSTER_TYPES = {
  drone: { name: 'Patrol Mech', model: 'robot', clip: 'Walkcycle_Animation', idle: 'Idel_Animation', h: 2.1, headFrom: 0.75, hp: 110, speed: 2.5, dmg: 8, range: 20, keep: 10, cd: 2.2, radius: 0.6, score: 220, cap: 3, ranged: true },
  grunt:  { name: 'Infected', model: 'soldier', clip: 'walk', h: 1.85, headFrom: 0.8,  hp: 60,  speed: 3.2, dmg: 9,  range: 1.6, cd: 1.0, radius: 0.4, score: 100, tint: 0xff8877, cap: 99, shoot: { range: 24, dmg: 5, cd: 2.4, speed: 24 } },
  runner: { name: 'Runner',   model: 'soldier', clip: 'run',  h: 1.75, headFrom: 0.8,  hp: 40,  speed: 6.0, dmg: 6,  range: 1.5, cd: 0.7, radius: 0.4, score: 150, tint: 0xffcc55, cap: 99, shoot: { range: 18, dmg: 4, cd: 2.0, speed: 28 } },
  shooter:{ name: 'Gunner',   model: 'soldier', clip: 'walk', h: 1.85, headFrom: 0.8,  hp: 50,  speed: 3.4, dmg: 8,  range: 16,  cd: 1.6, radius: 0.4, score: 150, tint: 0x77aaff, cap: 8, ranged: true },
  sniper: { name: 'Winter Soldier', model: 'winter', h: 1.9, headFrom: 0.82, hp: 70, stationary: true, speed: 0, dmg: 14, range: 42, keep: 16, proj: 48, cd: 2.8, radius: 0.4, score: 250, cap: 3, ranged: true, aim: true, proxy: true },
  demon:  { name: 'Fire Demon', model: 'demon', h: 2.3, headFrom: 0.78, hp: 160, stationary: true, speed: 0, dmg: 16, range: 2.1, cd: 1.2, radius: 0.6, score: 300, cap: 2, shoot: { range: 32, dmg: 12, cd: 3.2, speed: 16, color: 0xff7a1a, size: 2.2, snd: 'throw' } },
  brute:  { name: 'Minotaur', model: 'brute',   h: 3.0, headFrom: 0.78, hp: 420, stationary: true, speed: 0, dmg: 30, range: 2.7, cd: 1.6, radius: 0.9, score: 600, cap: 2, shoot: { range: 26, dmg: 16, cd: 4, speed: 15, color: 0xff3322, size: 2.6, snd: 'throw' } },
  boss:   { name: 'MINOTAUR WARLORD', model: 'brute', h: 4.2, headFrom: 0.78, hp: 1800, stationary: true, speed: 0, dmg: 40, range: 3.3, cd: 1.8, radius: 1.2, score: 3000, tint: 0xff7766, cap: 1, boss: true, bodyMul: 0.5, shoot: { range: 40, dmg: 15, cd: 4.5, speed: 18, color: 0xff5500, size: 3, count: 3, spread: 0.2, snd: 'throw' } },
  sentry: { name: 'Sentry', model: 'soldier', clip: 'walk', h: 1.85, headFrom: 0.8, hp: 120, speed: 0, dmg: 7, range: 45, keep: 0.01, proj: 34, burst: 3, cd: 2.2, radius: 0.45, score: 200, tint: 0x88ff99, cap: 4, ranged: true, stationary: true },
};
const FILES = { robot: 'gun-bot_with_walk_and_idle_animation.glb', winter: 'winter_soldier_-_summer_soldier.glb', soldier: 'futuristic_soldier_free.glb', demon: 'crimson_fire_demon_-_triposr_vs_supavoxel.glb', brute: 'horned_minotaur_demon_-_png_to_stl_-_supavoxel.glb' };
const tpl = {};
const distantShapes = new Map();

function distantShape(T) {
  if (distantShapes.has(T.name)) return distantShapes.get(T.name);
  const pieces = [];
  const box = (w, h, d, x, y, z) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z); pieces.push(geometry);
  };
  // One shared draw call per distant actor, at the same world height as its full rig.
  box(.28, .43, .22, -.18, .22, 0); box(.28, .43, .22, .18, .22, 0);
  box(.72, .68, .4, 0, .75, 0);
  box(.27, .55, .27, -.48, .72, 0); box(.27, .55, .27, .48, .72, 0);
  box(.36, .34, .32, 0, 1.27, 0);
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  const material = new THREE.MeshLambertMaterial({color: T.tint || (T.model === 'robot' ? 0x78969d : 0x796c5f)});
  const shape = {geometry, material}; distantShapes.set(T.name, shape); return shape;
}

export async function loadMonsterModels(loader, onStep, bvh) {
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    try {
      const g = await loader.loadAsync('/models/' + f);
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group(); wrap.add(g.scene);
      g.scene.position.set(-c.x, -box.min.y, -c.z);
      const clips = g.animations.map(a => { a.tracks = a.tracks.filter(t => !(/\.position$/.test(t.name) && /(hips|root|pelvis|armature)/i.test(t.name))); return a; });
      let skin = false; wrap.traverse(o => { if (o.isSkinnedMesh) skin = true; });
      tpl[k] = { scene: wrap, size, clips, skin, skinned: clips.length > 0 };
      if (bvh && !skin) wrap.traverse(o => { if (o.isMesh && !o.geometry.boundsTree) o.geometry.boundsTree = new bvh.MeshBVH(o.geometry); });
    } catch (e) { console.warn('monster model failed', f, e); }
    onStep && onStep();
  }));
}

function fallback(T) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x7a2222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, T.h * 0.6, 0.4), mat); body.position.y = T.h * 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(T.h * 0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xaa4444 })); head.position.y = T.h * 0.88;
  g.add(body, head); return g;
}

// Soft dark disc under each monster. Real shadows are off in Performance mode, so without this monsters look like they float.
let blobMat=null,blobGeo=null,blobOn=true;
export function setBlobShadows(on){blobOn=on;if(blobMat)blobMat.visible=on;}
export function createBlobShadow(radius){
  if(!blobMat){
    const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);
    g.addColorStop(0,'rgba(0,0,0,.85)');g.addColorStop(.55,'rgba(0,0,0,.42)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
    blobMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    blobMat.visible=blobOn;blobGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  }
  const r=radius,m=new THREE.Mesh(blobGeo,blobMat);
  m.scale.set(r*2,1,r*2);m.position.y=.04;m.renderOrder=1;m.raycast=()=>{};return m;   // raycast off: bullets must ignore it
}

export function buildMonster(type) {
  const T = MONSTER_TYPES[type], t = tpl[T.model];
  const group = new THREE.Group(), mats = [], rig = { mixer: null, actions: {}, cur: null, inner: null, t: 0 };
  let inner;
  if (t) {
    inner = t.skin ? SkeletonUtils.clone(t.scene) : t.scene.clone(true);
    inner.scale.setScalar(T.h / t.size.y);
    const light = t.skinned;
    inner.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = !o.isSkinnedMesh; o.castShadow = light; o.receiveShadow = false;
      const arr = Array.isArray(o.material) ? o.material : [o.material], out = [];
      for (const m of arr) { const c = m.clone(); if (T.tint && c.color) c.color.multiply(new THREE.Color(T.tint)); if (c.emissive) mats.push(c); out.push(c); }
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    if (t.skinned) {
      rig.mixer = new THREE.AnimationMixer(inner);
      for (const c of t.clips) rig.actions[c.name] = rig.mixer.clipAction(c);
    }
  } else inner = fallback(T);
  group.add(inner); rig.inner = inner;rig.groundFeet=createFootGrounding(inner,group);
  rig.blob = createBlobShadow(Math.min(3,Math.max(.45,T.h*.32))); group.add(rig.blob);
  const distant = distantShape(T);
  rig.distant = new THREE.Mesh(distant.geometry, distant.material);
  rig.distant.scale.set(T.h / 1.5, T.h / 1.5, T.h / 1.5);
  rig.distant.visible = false;
  rig.distant.frustumCulled = true;
  group.add(rig.distant);
  if (T.proxy && t) {            // heavy static skinned model: shoot simple head/body boxes instead of 166k triangles
    inner.traverse(o => { if (o.isSkinnedMesh) o.raycast = () => {}; });
    const hide = new THREE.MeshBasicMaterial({ visible: false }), hh = T.h * (1 - T.headFrom);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, T.h * T.headFrom, 0.45), hide); body.position.y = T.h * T.headFrom / 2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, hh, 0.32), hide); head.position.y = T.h * T.headFrom + hh / 2;
    group.add(body, head);
  } group.userData.rig = rig;
  return { group, parts: {}, mats };
}

export function setMonsterDetail(m, distance, lowPower) {
  const rig = m.group.userData.rig;
  if (!rig) return;
  const threshold = lowPower ? 34 : 85;
  const distant = rig.distant.visible ? distance > threshold - 5 : distance > threshold + 5;
  if (distant === rig.distant.visible) return;
  rig.distant.visible = distant;
  rig.inner.visible = !distant;
  if (rig.blob) rig.blob.visible = !distant && !m.dead;
  if (distant) rig.mixer?.stopAllAction();
  else rig.cur = null;
}

function play(rig, name) {
  if (rig.cur === name || !rig.actions[name]) return;
  const n = rig.actions[name], o = rig.actions[rig.cur];
  n.reset().fadeIn(0.2).play(); if (o) o.fadeOut(0.2); rig.cur = name;
}

export function animateMonster(m, dt, lowDetail=false) {
  const rig = m.group.userData.rig; if (!rig) return;
  if (rig.distant.visible) return;
  if(lowDetail){rig.animationDebt=(rig.animationDebt||0)+dt;if(rig.animationDebt<.12)return;dt=rig.animationDebt;rig.animationDebt=0;}
  else if(rig.animationDebt){dt+=rig.animationDebt;rig.animationDebt=0;}
  const T = m.T;
  for (const mt of m.mats) if (mt.emissive) mt.emissive.setRGB(m.flash > 0 ? 0.9 : 0, m.flash > 0 ? 0.25 : 0, 0);
  if (m.dead) { if (rig.mixer && rig.cur !== 'death' && rig.actions.death) { play(rig, 'death'); rig.actions.death.setLoop(THREE.LoopOnce, 1); rig.actions.death.clampWhenFinished = true; } if (rig.mixer) rig.mixer.update(dt); return; }
  rig.t += dt * (m.moving ? 9 : 2);
  if (rig.mixer) {
    const action = m.shootAnim > 0 ? (m.moving ? 'runAndShooting' : 'shooting') : m.moving ? T.clip : m.attackAnim > 0 ? (T.ranged ? 'shooting' : 'melee') : (T.idle || 'idleWgun');
    play(rig, rig.actions[action] ? action : m.moving ? T.clip : (T.idle || 'idleWgun'));
    rig.mixer.update(dt);
    rig.groundFeet();
  } else {                                                   // static meshes: bob, sway, lunge
    const s = Math.sin(rig.t);
    rig.inner.position.y = m.moving ? Math.abs(s) * 0.12 : 0;
    rig.inner.rotation.z = m.moving ? s * 0.07 : 0;
    rig.inner.rotation.x = m.attackAnim * 0.5 + (m.shootAnim > 0 ? 0.25 : 0);
    rig.inner.position.z = m.attackAnim * 0.6;
  }
}
