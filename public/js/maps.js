// Placeholder procedural arenas. Replace with your own maps later:
// each map only needs: size, blocks (collision boxes), barrels, spawns, start.
// blocks: [kind, x, z, w, d, h]  (kind: 'wall' | 'crate' | 'pillar'; crates with h<=1.3 are climbable)

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Walled building with one door gap. door: 'n' (-z) | 's' (+z) | 'e' (+x) | 'w' (-x). Roof is visual only.
function building(x, z, w, d, h, door, dw = 3.5, t = 0.6) {
  const out = [], wall = (cx, cz, ww, dd) => out.push(['wall', cx, cz, ww, dd, h]);
  const alongX = (cz, has) => { if (!has) wall(x, cz, w, t); else { const s = (w - dw) / 2; wall(x - (dw / 2 + s / 2), cz, s, t); wall(x + (dw / 2 + s / 2), cz, s, t); } };
  const alongZ = (cx, has) => { if (!has) wall(cx, z, t, d); else { const s = (d - dw) / 2; wall(cx, z - (dw / 2 + s / 2), t, s); wall(cx, z + (dw / 2 + s / 2), t, s); } };
  alongX(z - d / 2, door === 'n'); alongX(z + d / 2, door === 's');
  alongZ(x - w / 2, door === 'w'); alongZ(x + w / 2, door === 'e');
  out.push(['roof', x, z, w + 0.6, d + 0.6, h]);
  return out;
}

function buildOutpost() {
  const R = rng(7), blocks = [], foot = [], barrels = [];
  const B = [
    [-45, -45, 26, 18, 6, 's'], [50, -50, 22, 16, 6, 'w'], [-30, 35, 10, 8, 3.2, 'e'], [-55, 20, 9, 9, 3.2, 's'],
    [30, 35, 10, 8, 3.2, 'w'], [60, 30, 14, 12, 3.5, 'n'], [-70, -10, 16, 12, 4.5, 'e'], [15, -30, 8, 6, 3, 's'], [-15, 60, 8, 6, 3, 'n'],
  ];
  for (const [x, z, w, d, h, door] of B) { blocks.push(...building(x, z, w, d, h, door)); foot.push([x, z, w + 2, d + 2]); }
  const walls = [[-20, -10, 8, 0.6], [22, 12, 0.6, 8], [-25, -70, 10, 0.6], [70, -20, 0.6, 10], [-60, 60, 8, 0.6], [40, 70, 10, 0.6]];
  for (const [x, z, w, d] of walls) { blocks.push(['wall', x, z, w, d, 3]); foot.push([x, z, w, d]); }
  // Reserve the new supplied office buildings and field-base furniture before scattering trees/crates.
  foot.push([-17,48,12,12],[18,52,12,12],[-22,15,12,12],[7,59,4,4],[-7,64,4,4],[-7,74,6,4]);
  // roads (visual)
  blocks.push(['road', 0, 0, 10, 200], ['road', -52.5, 0, 95, 10], ['road', 52.5, 0, 95, 10]);

  const free = (x, z, m) => Math.abs(x) > 7 && Math.abs(z) > 7 && Math.hypot(x, z - 70) > 8 &&
    !foot.some(([fx, fz, w, d]) => Math.abs(x - fx) < w / 2 + m && Math.abs(z - fz) < d / 2 + m);
  const spot = (m, margin = 90) => { for (let i = 0; i < 60; i++) { const x = (R() * 2 - 1) * margin, z = (R() * 2 - 1) * margin; if (free(x, z, m)) return [x, z]; } return null; };

  for (let i = 0; i < 30; i++) {          // crates, some stacked in pairs
    const p = spot(3); if (!p) continue; const s = 2 + R() * 2, hh = R() < 0.6 ? 1.2 : 2.4;
    blocks.push(['crate', p[0], p[1], s, s, hh]); foot.push([p[0], p[1], s, s]);
    if (R() < 0.5) { const x2 = p[0] + s * 0.95, s2 = 1.8; blocks.push(['crate', x2, p[1], s2, s2, 1.2]); foot.push([x2, p[1], s2, s2]); }
  }
  for (let i = 0; i < 70; i++) { const p = spot(2); if (!p) continue; blocks.push(['tree', p[0], p[1]]); foot.push([p[0], p[1], 1.5, 1.5]); }
  barrels.push([-45, -45], [-50, -42], [50, -50], [-70, -10], [60, 30], [-30, 35]);
  for (let i = 0; i < 12; i++) { const p = spot(2.5); if (p) { barrels.push(p); foot.push([p[0], p[1], 1, 1]); } }

  return {
    name: 'Forward Base', desc: 'Abandoned offices · streets · field armory',
    size: [200, 200], ring: true,
    sky: 0x9db0c4, fog: [0x9db0c4, 30, 115],
    hemi: [0xbcd0ff, 0x3a3a30, 1.0], sun: [0xfff0d0, 2.2],
    colors: { ground: 0x56603f, wall: 0x8a8780, crate: 0x8a6a3c, pillar: 0x777777, road: 0x2a2b2e, leaf: 0x2f5a2a },
    blocks, barrels,
    spawns: [[-90, -90], [90, -90], [-90, 90], [90, 90]],
    start: [0, 70],
    lights: [[-45, 4.5, -45, 0xffcc88, 80], [50, 4.5, -50, 0xffcc88, 80], [-70, 3.3, -10, 0xffcc88, 60], [60, 2.8, 30, 0xffcc88, 60]],
  };
}

// Open-world maps loaded from your .glb files. Fully free-roam: no walls, no boundary.
// worldScale calibrates imported units against benches/containers; actors remain 1.8 m tall.
// fit = fallback longest side of the map in metres after auto-scaling (change it if a map feels too big or small).
const open = (name, desc, file, fit, o = {}) => ({
  name, desc, glb: '/models/' + file, fit, open: true, ring: true, size: [1, 1],
  sky: 0x9ec0e8, fog: [0xa9c1dd, 80, 320], hemi: [0xcfe0ff, 0x555544, 1.3], sun: [0xfff0d0, 2.4],
  colors: { ground: 0x444444, wall: 0x888888, crate: 0x888888, pillar: 0x888888 },
  blocks: [], barrels: [], spawns: [[0, 0]], start: [0, 0], lights: [], ...o,
});

export const MAPS = {
  skibidi: open('The Riftlands', 'Ruined city · hills · long sightlines', 'skibidi_toilet_77_map.glb', 700, { worldScale:.5, sky: 0x7d8fb0, fog: [0x8794b0, 60, 260] }),
  ep73: open('Ashfall District', 'Urban ruins · close quarters · street supplies', 'map_ep_73.glb', 300, {worldScale:1}),
  outpost: buildOutpost(),

  yard: {
    name: 'Warehouse Yard',
    desc: 'Open yard, crates, cover',
    size: [60, 60],
    sky: 0x1c2430, fog: [0x1c2430, 14, 60],
    hemi: [0x8aa0c8, 0x2a2a30, 0.9], sun: [0xfff2dd, 1.6],
    colors: { ground: 0x4a4d50, wall: 0x6b7075, crate: 0x8a6a3c, pillar: 0x606468 },
    blocks: [
      ['crate', -10, -5, 3, 3, 1.2], ['crate', -7.5, -5.5, 2, 2, 2.4], ['crate', 8, -8, 4, 2, 1.2],
      ['crate', 0, 4, 2, 2, 2.4], ['crate', 3, 2, 2, 2, 1.2],
      ['wall', -15, 10, 10, 1.5, 3], ['wall', 16, 12, 1.5, 10, 3], ['wall', -4, -18, 12, 1.5, 3], ['wall', 20, -14, 1.5, 8, 3],
      ['crate', -22, -6, 3, 3, 1.2], ['crate', 22, 2, 3, 3, 1.2], ['crate', -20, 20, 2, 2, 2.4], ['crate', 10, 20, 3, 2, 1.2],
    ],
    barrels: [[-5, -12], [12, 0], [-18, -18], [20, -22], [-3, 14], [0, -3]],
    spawns: [[-26, -26], [26, -26], [0, -27], [-27, 0], [27, 0], [-26, 26], [26, 26]],
    start: [0, 24],
    lights: [],
  },

  crypt: {
    name: 'Crypt',
    desc: 'Dark, cross walls, pillars',
    size: [50, 50],
    sky: 0x120808, fog: [0x120808, 8, 40],
    hemi: [0x884444, 0x1a1010, 0.6], sun: [0xff9977, 0.5],
    colors: { ground: 0x2e2626, wall: 0x4a4045, crate: 0x5a4a3a, pillar: 0x6a6065 },
    blocks: [
      ['wall', 0, -12, 2, 14, 4], ['wall', 0, 12, 2, 14, 4], ['wall', -12, 0, 14, 2, 4], ['wall', 12, 0, 14, 2, 4],
      ['pillar', -8, -8, 2, 2, 6], ['pillar', 8, -8, 2, 2, 6], ['pillar', -8, 8, 2, 2, 6], ['pillar', 8, 8, 2, 2, 6],
      ['pillar', -19, -19, 2, 2, 6], ['pillar', 19, -19, 2, 2, 6], ['pillar', -19, 19, 2, 2, 6], ['pillar', 19, 19, 2, 2, 6],
      ['crate', -5, -18, 2, 2, 1.2], ['crate', 18, 5, 2, 2, 1.2], ['crate', -18, -5, 2, 2, 1.2], ['crate', 5, 18, 2, 2, 1.2],
    ],
    barrels: [[-18, -12], [16, -17], [-16, 17], [18, 14], [6, 6], [-6, -6]],
    spawns: [[-22, -22], [22, -22], [-22, 22], [22, 22], [0, -23], [0, 23], [-23, 0], [23, 0]],
    start: [0, 3],
    // [x, y, z, color, intensity]
    lights: [[-6.5, 3.5, -6.5, 0xff7733, 60], [6.5, 3.5, -6.5, 0xff7733, 60], [-6.5, 3.5, 6.5, 0xff7733, 60], [6.5, 3.5, 6.5, 0xff7733, 60], [0, 4, 0, 0xff5522, 40]],
  },
};
