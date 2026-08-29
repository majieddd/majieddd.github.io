// ===== data.js : static game data (grid, path, towers, enemies, waves, lore) =====
// Runs as a classic script; everything here is a global. No imports/exports.

const GRID = { cols: 22, rows: 13, tile: 1.0 };

// Serpentine path in tile coords. Enters bottom-left, exits at the Core.
const WAYPOINTS = [
  [-2, 1], [3, 1], [3, 5], [8, 5], [8, 1], [13, 1], [13, 7], [18, 7], [18, 11], [23, 11],
];
const CORE_TILE = [21, 11];
const SPAWN_TILE = WAYPOINTS[0];

function buildPathTiles() {
  const set = new Set();
  const key = (c, r) => c + ',' + r;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    let [c0, r0] = WAYPOINTS[i];
    const [c1, r1] = WAYPOINTS[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    set.add(key(c, r));
    while (c !== c1 || r !== r1) { c += dc; r += dr; set.add(key(c, r)); }
  }
  return set;
}
const PATH_TILES = buildPathTiles();

const FACTIONS = {
  humanity: { name: 'HUMANITY', hue: 0x38e8ff, accent: 0xbafcff },
  federation: { name: 'FEDERATION OF LIGHT', hue: 0xfbbf24, accent: 0xfff0c2 },
  xeno: { name: 'THE XENO', hue: 0x7c3aed, accent: 0xc9a6ff },
  pirate: { name: 'THE PIRATES', hue: 0xef4444, accent: 0xffb3b3 },
};

// Tower archetypes — named HUMANITY craft from the canon.
const TOWERS = {
  cannon: {
    id: 'cannon', name: 'AURORA GUNSHIP', craft: 'Aurora', role: 'Kinetic slug thrower',
    cost: 60, dmg: 22, range: 3.2, rate: 1.5, splash: 0, slow: 0, chain: 0,
    kind: 'all', color: 0x38e8ff, proj: 'slug', desc: 'Reliable single-target kinetic fire. Cheap and dependable.',
    upgrade: { dmg: 1.55, range: 1.12, rate: 1.25 },
  },
  tesla: {
    id: 'tesla', name: 'FLUXLINER COIL', craft: 'Fluxliner', role: 'Chain-lightning arc',
    cost: 110, dmg: 16, range: 3.0, rate: 1.1, splash: 0, slow: 0, chain: 3,
    kind: 'all', color: 0x8ad8ff, proj: 'arc', desc: 'Arcs between nearby hostiles. Devastating against clustered swarms.',
    upgrade: { dmg: 1.5, range: 1.12, chain: 1.4 },
  },
  frost: {
    id: 'frost', name: 'AURORA CRYO', craft: 'Aurora', role: 'Cryo-field projector',
    cost: 95, dmg: 7, range: 2.6, rate: 0.9, splash: 0, slow: 0.45, chain: 0,
    kind: 'ground', color: 0x7fe9ff, proj: 'frost', desc: 'Chills ground hostiles, slowing them inside its field.',
    upgrade: { dmg: 1.4, range: 1.15, slow: 1.18 },
  },
  flak: {
    id: 'flak', name: 'BLACK MANTA', craft: 'Black Manta', role: 'Anti-air flak battery',
    cost: 130, dmg: 30, range: 3.6, rate: 1.2, splash: 1.4, slow: 0, chain: 0,
    kind: 'air', color: 0x5ad1ff, proj: 'flak', desc: 'Splash tuned for fliers and swarms. Ground-capable.',
    upgrade: { dmg: 1.5, range: 1.12, splash: 1.2 },
  },
  lance: {
    id: 'lance', name: 'TR-3B LANCE', craft: 'TR-3B', role: 'Anti-armor particle lance',
    cost: 175, dmg: 65, range: 5.0, rate: 0.6, splash: 0, slow: 0, chain: 0, pierce: true,
    kind: 'all', color: 0xbafcff, proj: 'beam', desc: 'Long-range charged beam. Shreds armor and ignores cover.',
    upgrade: { dmg: 1.6, range: 1.1, rate: 1.2 },
  },
};
const TOWER_ORDER = ['cannon', 'tesla', 'frost', 'flak', 'lance'];

const ENEMIES = {
  drone: { id: 'drone', name: 'RAIDER PROBE', origin: 'pirate', kind: 'ground', hp: 60, speed: 2.6, armor: 0, reward: 9, radius: 0.34, boss: false, color: 0xef4444, shape: 'probe' },
  soldier: { id: 'soldier', name: 'THE HUNGRY', origin: 'xeno', kind: 'ground', hp: 120, speed: 1.9, armor: 3, reward: 14, radius: 0.4, boss: false, color: 0x7c3aed, shape: 'crawler' },
  flier: { id: 'flier', name: 'PHANTOM CRAFT', origin: 'human-rogue', kind: 'air', hp: 85, speed: 3.0, armor: 1, reward: 13, radius: 0.36, boss: false, color: 0x9fb6ff, shape: 'flier' },
  behemoth: { id: 'behemoth', name: 'XENO BROOD', origin: 'xeno', kind: 'ground', hp: 420, speed: 1.2, armor: 8, reward: 34, radius: 0.62, boss: false, color: 0x9b4dff, shape: 'brood' },
  wraith: { id: 'wraith', name: 'SPECTRAL', origin: 'xeno', kind: 'ground', hp: 150, speed: 2.3, armor: 0, reward: 16, radius: 0.38, boss: false, ignoreSlow: true, color: 0xc9a6ff, shape: 'wraith' },
  boss: { id: 'boss', name: 'DEVOURER OF THE PLEIADES', origin: 'xeno', kind: 'ground', hp: 4200, speed: 0.95, armor: 14, reward: 400, radius: 1.05, boss: true, color: 0x7c3aed, shape: 'devourer' },
};

function buildWaves() {
  const W = [];
  const push = (...groups) => W.push(groups);
  push({ type: 'drone', count: 8, gap: 0.9, start: 0 });
  push({ type: 'drone', count: 12, gap: 0.7, start: 0 });
  push({ type: 'drone', count: 8, gap: 0.6, start: 0 }, { type: 'soldier', count: 4, gap: 1.4, start: 3 });
  push({ type: 'soldier', count: 10, gap: 0.9, start: 0 });
  push({ type: 'flier', count: 10, gap: 0.7, start: 0 });
  push({ type: 'drone', count: 14, gap: 0.45, start: 0 }, { type: 'flier', count: 6, gap: 1.0, start: 4 });
  push({ type: 'soldier', count: 8, gap: 0.8, start: 0 }, { type: 'behemoth', count: 1, gap: 1, start: 2 });
  push({ type: 'flier', count: 14, gap: 0.5, start: 0 });
  push({ type: 'wraith', count: 8, gap: 0.8, start: 0 }, { type: 'soldier', count: 6, gap: 1.0, start: 1 });
  push({ type: 'drone', count: 20, gap: 0.35, start: 0 }, { type: 'behemoth', count: 2, gap: 3, start: 2 });
  push({ type: 'soldier', count: 12, gap: 0.6, start: 0 }, { type: 'flier', count: 10, gap: 0.6, start: 2 });
  push({ type: 'wraith', count: 12, gap: 0.6, start: 0 });
  push({ type: 'behemoth', count: 4, gap: 2.2, start: 0 }, { type: 'flier', count: 8, gap: 0.8, start: 1 });
  push({ type: 'drone', count: 26, gap: 0.28, start: 0 }, { type: 'soldier', count: 8, gap: 0.9, start: 3 });
  push({ type: 'wraith', count: 10, gap: 0.5, start: 0 }, { type: 'flier', count: 14, gap: 0.45, start: 1 });
  push({ type: 'behemoth', count: 6, gap: 1.6, start: 0 }, { type: 'wraith', count: 8, gap: 0.7, start: 2 });
  push({ type: 'soldier', count: 18, gap: 0.5, start: 0 }, { type: 'drone', count: 18, gap: 0.4, start: 2 });
  push({ type: 'flier', count: 22, gap: 0.35, start: 0 }, { type: 'wraith', count: 10, gap: 0.6, start: 2 });
  push({ type: 'behemoth', count: 8, gap: 1.2, start: 0 }, { type: 'soldier', count: 12, gap: 0.6, start: 2 }, { type: 'flier', count: 10, gap: 0.6, start: 4 });
  push({ type: 'boss', count: 1, gap: 1, start: 0 }, { type: 'wraith', count: 14, gap: 0.5, start: 3 }, { type: 'behemoth', count: 3, gap: 2, start: 6 });
  return W;
}

const LORE = {
  title: 'COSMIC CONQUEST — TOWER DEFENSE',
  subtitle: 'EARTH · THE DAY THE FRAGMENTS CAME DOWN',
  intro: 'Eleven months ago they named the day we would die. Today the rock is gravel. Hold the line at World Zero: place HUMANITY craft along the approach and deny The Hungry the Core.',
  win: 'The Devourer dissolves into starlight. Earth stands. The Federation draws its line here.',
  lose: 'The Core goes dark. The fragments fall unopposed. Rewrite the defense and hold the line.',
};

// Expose globals for both the browser (classic scripts share scope) and Node (vm).
if (typeof globalThis !== 'undefined') {
  globalThis.GRID = GRID; globalThis.WAYPOINTS = WAYPOINTS; globalThis.CORE_TILE = CORE_TILE;
  globalThis.SPAWN_TILE = SPAWN_TILE; globalThis.PATH_TILES = PATH_TILES; globalThis.FACTIONS = FACTIONS;
  globalThis.TOWERS = TOWERS; globalThis.TOWER_ORDER = TOWER_ORDER; globalThis.ENEMIES = ENEMIES;
  globalThis.LORE = LORE;
}
