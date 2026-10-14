import * as THREE from 'three';

// Field operations own their objects; the combat simulation supplies world queries.
export function createOperations(api) {
  const { state, P, floorAt, clearPath, blocked, banner, reward, refill, sound } = api;
  const colors = { gun0:0x91ddff,gun1:0xcbabff,med: 0x72f5ac, ammo: 0x72dfff, cache: 0xffc778, damage: 0xff7b66, speed: 0xabb2ff, shield: 0x72f5e6, relay: 0x80fff0 };
  const items = [], buffs = { damage: 0, speed: 0, shield: 0 };
  let mission = null, held = false, interact = false, nextId=0;
  const ringGeo = new THREE.TorusGeometry(0.8, 0.035, 6, 40);
  const boxGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
  const el = id => document.getElementById(id);

  function remove(item) {
    state.world.remove(item.group);
    item.group.traverse(o => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== ringGeo && o.geometry !== boxGeo) o.geometry.dispose(); });
    items.splice(items.indexOf(item), 1);
  }
  function place(kind, pos, id=++nextId) {
    const group = new THREE.Group(), color = colors[kind];
    const gun=/^gun[01]$/.test(kind);
    const body = gun?(api.weaponPickup?.(Number(kind.slice(-1)))||new THREE.Mesh(new THREE.BoxGeometry(.07,.1,.7),new THREE.MeshStandardMaterial({color:0x45535a}))):new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x142e34, emissive: color, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.3 }));
    body.position.y = 0.8; group.add(body);
    if (kind === 'med') {
      body.scale.set(1.2,.5,.8); body.position.y=.19;
      body.material.color.setHex(0xf4f5e8);body.material.emissiveIntensity=.12;
      const crossMaterial=new THREE.MeshBasicMaterial({color:0x29c96d});
      const horizontal=new THREE.Mesh(new THREE.BoxGeometry(.32,.012,.08),crossMaterial),vertical=new THREE.Mesh(new THREE.BoxGeometry(.08,.012,.25),crossMaterial);
      horizontal.position.y=vertical.position.y=.36;group.add(horizontal,vertical);
    }
    if(gun){body.rotation.z=Math.PI/2;body.position.y=.085;}
    else{const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color })); body.add(edges);}
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; group.add(ring);
    if (kind === 'relay') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.35, 8, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false })); beam.position.y = 4; group.add(beam);
    }
    group.position.copy(pos); state.world.add(group);
    const item = { id,kind, group, body, pos: pos.clone(), age: 0,pending:0 }; items.push(item); return item;
  }
  function safeSpot(min, max) {
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      if (Math.abs(x) > state.map.size[0] / 2 - 2 || Math.abs(z) > state.map.size[1] / 2 - 2 || blocked(x, z, 1.3)) continue;
      const y = state.collMesh ? floorAt(x, z, P.pos.y + 0.6, 2) : 0;
      if (y === null || Math.abs(y - P.pos.y) > 0.6) continue;
      const pos = new THREE.Vector3(x, y, z);
      if (!clearPath(P.pos, pos) || items.some(item => item.pos.distanceTo(pos) < 2)) continue;
      return pos;
    }
    return null;
  }
  function start(n) {
    while (items.length) remove(items[0]);
    for (const key in buffs) buffs[key] = 0;
    const pos = safeSpot(12, 24) || safeSpot(4, 10) || P.pos.clone();
    mission = { phase: 'recover', progress: 0, sector: n, relay: place('relay', pos), completed: false };
    for (const kind of ['med', 'med', 'med', 'ammo', 'cache', 'damage', 'shield', 'speed','gun0','gun1']) {
      const p = safeSpot(4, 18); if (p) place(kind, p);
    }
  }
  function grant(kind) {
    if (kind === 'med') P.hp = Math.min(P.maxHp, P.hp + 55);
    else if (kind === 'ammo') refill();
    else if (kind === 'credits') reward(400);
    else if(/^gun[01]$/.test(kind))api.equipWeapon?.(Number(kind.slice(-1)));
    else buffs[kind] = 20;
    sound();
  }
  function collect(item,receiver=null) {
    let kind = item.kind;
    if (kind === 'cache') {
      kind = ['med', 'ammo', 'damage', 'speed', 'shield', 'credits'][Math.floor(Math.random() * 6)];
      banner('CACHE OPENED · ' + kind.toUpperCase());
    } else banner(({ gun0:'M4A1 PICKED UP + AMMO',gun1:'LASER MG PICKED UP + AMMO',med: 'MEDKIT +55', ammo: 'AMMUNITION RESTORED', damage: 'OVERDRIVE · 20 SECONDS', shield: 'SHIELD · 20 SECONDS', speed: 'HASTE · 20 SECONDS' })[kind]);
    if(receiver)api.grantPickup?.(receiver,kind);else grant(kind);
    remove(item);
  }
  function update(dt) {
    if (!mission || P.dead) { el('interact').textContent = ''; return; }
    for (const key in buffs) buffs[key] = Math.max(0, buffs[key] - dt);
    let prompt = '';
    for (const item of [...items]) {
      item.age += dt;
      if(item.kind!=='med'&&!/^gun[01]$/.test(item.kind)){item.body.rotation.y += dt * 0.6;item.body.position.y = 0.8 + Math.sin(item.age * 2) * 0.1;}
      if (item.kind === 'relay' || item.pos.distanceTo(P.pos) > 2 || !clearPath(P.pos, item.pos)) continue;
      const wants=item.kind==='cache'||/^gun[01]$/.test(item.kind)?interact:item.kind!=='med'||P.hp<P.maxHp;
      if(item.kind==='cache')prompt=(api.touchDevice?'TAP HOLD E':'[E]')+' OPEN MYSTERY CACHE';
      if(/^gun[01]$/.test(item.kind))prompt=(api.touchDevice?'TAP HOLD E':'[E]')+' PICK UP '+(item.kind==='gun0'?'M4A1':'LASER MG');
      if(wants){if(state.coop==='guest'){if(!item.pending||item.age-item.pending>1.2){api.requestPickup?.(item.id);item.pending=item.age;}}else collect(item);}
    }
    const dist = mission.relay.pos.distanceTo(P.pos), near = dist < 3;
    const remoteHolding=api.remoteInteractions?.().some(p=>p.held&&p.pos.distanceTo(mission.relay.pos)<3) || false;
    if (mission.phase === 'recover') {
      if(near)prompt=(api.touchDevice?'HOLD E BUTTON':'HOLD [E]')+' · RECOVER RELAY DATA';
      if(state.coop!=='guest'&&(near||remoteHolding))mission.progress = ((held&&near)||remoteHolding) ? Math.min(2, mission.progress + dt) : Math.max(0, mission.progress - dt);
      if (mission.progress >= 2) { mission.phase = 'defend'; mission.progress = 0; reward(150); banner('DATA RECOVERED · CLEAR THE SECTOR'); sound(); }
    }
    if (state.coop!=='guest' && mission.phase === 'defend' && state.toSpawn === 0 && !state.bossQueued && !state.monsters.some(m => !m.dead)) { mission.phase = 'extract'; banner('SECTOR CLEAR · RETURN TO THE RELAY'); }
    if (mission.phase === 'extract' && (near||remoteHolding)) {
      if(near)prompt = (api.touchDevice?'HOLD E BUTTON':'HOLD [E]')+' · TRANSMIT & EXTRACT';
      if(state.coop!=='guest')mission.progress = ((held&&near)||remoteHolding) ? Math.min(3, mission.progress + dt) : Math.max(0, mission.progress - dt);
      if (mission.progress >= 3) { mission.completed = true; mission.phase = 'complete'; reward(350); sound(); }
    }
    const title = { recover: '01 / RECOVER THE DATA', defend: '02 / DEFEND THE SECTOR', extract: '03 / EXTRACT', complete: 'TRANSMISSION COMPLETE' }[mission.phase];
    el('objective-title').textContent = title;
    el('objective-detail').textContent = mission.phase === 'defend' ? 'Hero, eliminate the remaining hostiles. Gold radar contacts are stationary.' : mission.completed ? 'Sector secured. Refit before the next deployment.' : `Hero, reach the cyan relay · ${Math.round(dist)} m`;
    el('objective-progress').style.width = (mission.completed ? 100 : mission.progress / (mission.phase === 'recover' ? 2 : 3) * 100) + '%';
    el('interact').textContent = prompt;
    el('buffs').textContent = Object.entries(buffs).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()} ${Math.ceil(v)}s`).join('  /  ');
    const p = mission.relay.pos.clone(); p.y += 2; p.project(api.camera);
    el('waypoint').style.display = p.z > 1 || mission.completed ? 'none' : 'block';
    el('waypoint').style.left = `${Math.max(5, Math.min(95, (p.x + 1) * 50))}%`;
    el('waypoint').style.top = `${Math.max(18, Math.min(80, (1 - p.y) * 50))}%`;
    el('waypoint').textContent = `◇ ${Math.round(dist)}m`;
    interact = false;
  }
  return {
    start, update, buffs, items, get ready() { return !!mission?.completed; },
    input(down) { held = down; if (down) interact = true; },
    drop(pos) { if (items.length < 24 && Math.random() < .55) place(P.hp<P.maxHp*.7 || Math.random()<.65 ? 'med' : 'ammo', pos); },
    grant,
    claim(id,player,pos){const item=items.find(i=>i.id===id);if(item&&item.kind!=='relay'&&item.pos.distanceTo(pos)<2.5)collect(item,player);},
    snapshot(){return mission ? {sector:mission.sector,phase:mission.phase,progress:mission.progress,completed:mission.completed,items:items.map(i=>({id:i.id,kind:i.kind,pos:i.pos.toArray()}))}:null;},
    apply(data){
      if(!data)return;
      if(mission?.sector!==data.sector){for(const k in buffs)buffs[k]=0;}
      const ids=new Set(data.items.map(i=>i.id));for(const item of [...items])if(!ids.has(item.id))remove(item);
      for(const s of data.items){let item=items.find(i=>i.id===s.id);if(item && (item.kind!==s.kind||!item.pos.equals(new THREE.Vector3(...s.pos)))){remove(item);item=null;}if(!item)place(s.kind,new THREE.Vector3(...s.pos),s.id);}
      const relay=items.find(i=>i.kind==='relay');if(relay)mission={...data,relay};
    },
  };
}
