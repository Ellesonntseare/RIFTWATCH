import * as THREE from 'three';

// Field operations own their objects; the combat simulation supplies world queries.
export function createOperations(api) {
  const { state, P, floorAt, clearPath, blocked, banner, reward, refill, sound } = api;
  const colors = { recoil:0xffd36a, gun0:0x91ddff,gun1:0xcbabff,med: 0x72f5ac, ammo: 0x72dfff, cache: 0xffc778, supply:0xffdb82, damage: 0xff7b66, speed: 0xabb2ff, shield: 0x72f5e6, c4:0xffc778, relay: 0x80fff0 };
  // Small billboard sprites cost much less than loading six more 3D models on phones.
  const art={recoil:'recoil',med:'med',ammo:'ammo',shield:'armor',supply:'supply',cache:'supply',speed:'stim',damage:'stim',c4:'grenades'};
  const loader=new THREE.TextureLoader(),textures={};
  if(typeof document.createElementNS==='function')for(const asset of new Set(Object.values(art))){const texture=loader.load(`/assets/pickups/${asset}.${asset==='recoil'?'svg':'webp'}`);texture.colorSpace=THREE.SRGBColorSpace;textures[asset]=texture;}
  const items = [], buffs = { recoil:0, damage: 0, speed: 0, shield: 0 };
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
    const supplyDrop=kind==='cache'||kind==='supply';
    const sprite=!supplyDrop&&!!textures[art[kind]];
    const body = sprite?new THREE.Sprite(new THREE.SpriteMaterial({map:textures[art[kind]],transparent:true,alphaTest:0.06,depthWrite:false})):gun?(api.weaponPickup?.(Number(kind.slice(-1)))||new THREE.Mesh(new THREE.BoxGeometry(.07,.1,.7),new THREE.MeshStandardMaterial({color:0x45535a}))):new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x142e34, emissive: color, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.3 }));
    body.position.y = 0.8; group.add(body);
    if(sprite)body.scale.set(kind==='shield'?1.25:kind==='med'?1.0:1.18,kind==='med'?1.0:1.18,1);
    if(gun){body.rotation.z=Math.PI/2;body.position.y=.085;}
    else if(!sprite){const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color })); body.add(edges);}
    if(supplyDrop){
      body.material.color.setHex(0xe8af25);body.material.emissive.setHex(0x604000);body.material.emissiveIntensity=.15;
      body.scale.set(2,1.6,1.6);body.position.y=.52;
      const steel=new THREE.MeshStandardMaterial({color:0x26323c,metalness:.7,roughness:.4});
      for(const x of [-.45,.45]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,1.1),steel.clone());strap.position.set(x,.55,0);group.add(strap);}
      const lid=new THREE.Mesh(new THREE.BoxGeometry(1.4,.12,1.16),steel);lid.position.y=1.1;group.add(lid);
      const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.14,.65,18,12,1,true),new THREE.MeshBasicMaterial({color:0xffd760,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));beacon.position.y=9;beacon.name='supply-beacon';beacon.visible=false;group.add(beacon);
    }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; group.add(ring);
    if (kind === 'relay') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.35, 8, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false })); beam.position.y = 4; group.add(beam);
    }
    if(kind!=='relay'&&!supplyDrop)group.scale.setScalar(.75);
    group.position.copy(pos); state.world.add(group);
    const item = { id,kind, group, body, pos: pos.clone(), age: 0,pending:0 }; items.push(item); return item;
  }
  function safeSpot(min, max) {
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      if (Math.abs(x) > state.map.size[0] / 2 - 2 || Math.abs(z) > state.map.size[1] / 2 - 2 || state.map.island&&Math.hypot(x,z)>state.map.size[0]*.4 || blocked(x, z, 1.3)) continue;
      const y = state.collMesh ? floorAt(x, z, P.pos.y + 0.6, 2) : 0;
      if (y === null || Math.abs(y - P.pos.y) > 0.6) continue;
      const pos = new THREE.Vector3(x, y, z);
      if (!clearPath(P.pos, pos) || items.some(item => Math.hypot(item.pos.x-x,item.pos.z-z) < 9)) continue;
      return pos;
    }
    return null;
  }
  function start(n) {
    while (items.length) remove(items[0]);
    for (const key in buffs) buffs[key] = 0;
    const pos = safeSpot(12, 24) || safeSpot(4, 10) || P.pos.clone();
    mission = { phase: 'recover', progress: 0, sector: n, relay: place('relay', pos), completed: false, sideComplete:false };
    // Recovery near the first fights, ammunition deeper in, and armor before the relay.
    for (const [kind,min,max] of [['recoil',12,24],['med',5,10],['ammo',8,15],['shield',11,20],['med',12,19],['ammo',15,22],['damage',10,19],['med',17,24],['speed',14,22],['c4',9,18],['cache',15,23],['gun0',7,18],['gun1',12,22]]) {
      // Keep the useful near-route placement, but expand the search when that
      // ring fills so late supplies and both weapons are never silently lost.
      const p = safeSpot(min, max) || safeSpot(max + 2, Math.max(max + 18, 42));
      if (p) place(kind, p);
    }
    const supplySpot=safeSpot(14,28);if(supplySpot)place('supply',supplySpot);else mission.sideComplete=true;
  }
  function startHunt(){
    while(items.length)remove(items[0]);
    for(const key in buffs)buffs[key]=0;
    mission={phase:'hunt',sector:0,progress:0,completed:false,relay:null,sideComplete:false};
    const layout=[
      ['recoil',45,70],['recoil',-48,-48],['med',25,16],['ammo',-46,35],['damage',64,-47],
      ['med',-30,-28],['shield',9,55],['ammo',54,37],
      ['speed',78,-12],['med',29,-76],['cache',-38,-75],
      ['gun1',-86,-27],['ammo',-81,63],['med',-2,105],
      ['shield',17,32],['ammo',-61,17],['med',58,-30],
      ['c4',-14,-52],['shield',72,19],['speed',-80,-45],
    ];
    for(const [kind,x,z] of layout){
      let px=x,pz=z;
      for(let i=0;i<12&&blocked(px,pz,.7);i++){px=x+Math.cos(i*2.4)*(2+i);pz=z+Math.sin(i*2.4)*(2+i);}
      if(Math.hypot(px,pz)<state.map.size[0]*.4&&!blocked(px,pz,.7)&&items.every(item=>Math.hypot(item.pos.x-px,item.pos.z-pz)>10))place(kind,new THREE.Vector3(px,0,pz));
    }
    const supplySpot=safeSpot(15,35);if(supplySpot)place('supply',supplySpot);else mission.sideComplete=true;
  }
  function grant(kind) {
    if (kind === 'med') P.hp = Math.min(P.maxHp, P.hp + 55);
    else if (kind === 'ammo') refill();
    else if (kind === 'credits') reward(400);
    else if (kind === 'supply') { refill(); buffs.shield=Math.max(buffs.shield,20); }
    else if (kind === 'c4') api.giveC4?.();
    else if(/^gun[01]$/.test(kind))api.equipWeapon?.(Number(kind.slice(-1)));
    else buffs[kind] = 20;
    sound();
  }
  function collect(item,receiver=null) {
    let kind = item.kind;
    if (kind === 'supply') {mission.sideComplete=true;banner('SIDE TASK COMPLETE · AMMO + SHIELD');}
    else if (kind === 'cache') {
      kind = ['med', 'ammo', 'damage', 'speed', 'shield', 'credits'][Math.floor(Math.random() * 6)];
      banner('CACHE OPENED · ' + kind.toUpperCase());
    } else banner(({ recoil:'STABILIZER · FASTER RECOIL RECOVERY · 20 SECONDS',gun0:'M4A1 PICKED UP + AMMO',gun1:'LASER MG PICKED UP + AMMO',med: 'MEDKIT +55', ammo: 'AMMUNITION RESTORED', damage: 'OVERDRIVE · 20 SECONDS', shield: 'SHIELD · 20 SECONDS', speed: 'HASTE · 20 SECONDS',c4:'C4 RESTOCKED +2' })[kind]);
    if(receiver)api.grantPickup?.(receiver,kind);else grant(kind);
    remove(item);
  }
  function update(dt) {
    if (!mission || P.dead) { el('interact').textContent = ''; return; }
    for (const key in buffs) buffs[key] = Math.max(0, buffs[key] - dt);
    const supply=items.find(item=>item.kind==='supply');
    const side=el('side-objective');side.classList.toggle('hidden',!supply||!!mission.sideComplete);
    if(supply&&!mission.sideComplete)side.textContent=`OPTIONAL / SECURE SUPPLY CACHE · ${Math.round(supply.pos.distanceTo(P.pos))} m · AMMO + SHIELD`;
    let prompt = '';
    for (const item of [...items]) {
      item.age += dt;
      if(item.kind==='cache'||item.kind==='supply'){const beam=item.group.getObjectByName('supply-beacon');if(beam){const distance=item.pos.distanceTo(P.pos);beam.visible=distance<65;beam.material.opacity=Math.max(0,Math.min(.22,(65-distance)/100));}}
      else if(!/^gun[01]$/.test(item.kind)){if(!item.body.isSprite)item.body.rotation.y += dt * 0.6;item.body.position.y = (item.kind==='relay'?.9:.72) + Math.sin(item.age * 2) * (item.kind==='relay'?.1:.04);}
      if (item.kind === 'relay' || item.pos.distanceTo(P.pos) > 2 || !clearPath(P.pos, item.pos)) continue;
      const wants=item.kind==='cache'||/^gun[01]$/.test(item.kind)?interact:item.kind==='med'?P.hp<P.maxHp:item.kind==='ammo'?api.needsAmmo?.()??true:item.kind==='c4'?P.c4<6:true;
      if(item.kind==='cache')prompt=(api.touchDevice?'TAP HOLD E':'[E]')+' OPEN MYSTERY CACHE';
      if(item.kind==='supply')prompt='SECURE SUPPLY CACHE';
      if(/^gun[01]$/.test(item.kind))prompt=(api.touchDevice?'TAP HOLD E':'[E]')+' PICK UP '+(item.kind==='gun0'?'M4A1':'LASER MG');
      if(wants){if(state.coop==='guest'){if(!item.pending||item.age-item.pending>1.2){api.requestPickup?.(item.id);item.pending=item.age;}}else collect(item);}
    }
    if(mission.phase==='hunt'){
      el('objective-title').textContent='HUNT / CLEAR THE ISLAND';
      el('objective-detail').textContent=`${state.huntKilled||0} / 30 monsters eliminated · search the forest and huts`;
      el('objective-progress').style.width=`${Math.min(100,(state.huntKilled||0)/30*100)}%`;
      el('interact').textContent=prompt;
      el('waypoint').style.display='none';
      el('buffs').textContent=Object.entries(buffs).filter(([,v])=>v>0).map(([k,v])=>`${k.toUpperCase()} ${Math.ceil(v)}s`).join('  /  ');
      interact=false;return;
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
    start, startHunt, update, buffs, items, get ready() { return !!mission?.completed; },
    input(down) { held = down; if (down) interact = true; },
    drop(pos) { if (items.length < 24 && Math.random() < .4 && !blocked(pos.x,pos.z,.8) && items.every(item=>Math.hypot(item.pos.x-pos.x,item.pos.z-pos.z)>9)) place(P.hp<P.maxHp*.7 || Math.random()<.65 ? 'med' : 'ammo', pos); },
    grant,
    claim(id,player,pos){const item=items.find(i=>i.id===id);if(item&&item.kind!=='relay'&&item.pos.distanceTo(pos)<2.5)collect(item,player);},
    snapshot(){return mission ? {sector:mission.sector,phase:mission.phase,progress:mission.progress,completed:mission.completed,items:items.map(i=>({id:i.id,kind:i.kind,pos:i.pos.toArray()}))}:null;},
    apply(data){
      if(!data)return;
      if(mission?.sector!==data.sector){for(const k in buffs)buffs[k]=0;}
      const ids=new Set(data.items.map(i=>i.id));for(const item of [...items])if(!ids.has(item.id))remove(item);
      for(const s of data.items){let item=items.find(i=>i.id===s.id);if(item && (item.kind!==s.kind||!item.pos.equals(new THREE.Vector3(...s.pos)))){remove(item);item=null;}if(!item)place(s.kind,new THREE.Vector3(...s.pos),s.id);}
      const relay=items.find(i=>i.kind==='relay');mission={...data,relay:relay||null};
    },
  };
}
