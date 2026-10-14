export type Vec2 = { x: number; z: number };

export type EnemyKind = "scarab" | "manta" | "husk" | "choir" | "warden";
export type TowerKind = "helios" | "vortex" | "rime";

export type EnemySpec = {
  id: EnemyKind;
  name: string;
  asset: string;
  hp: number;
  speed: number;
  reward: number;
  radius: number;
  scale: number;
  flying: boolean;
  clearance: number;
  description: string;
  flavor: string;
};

export type TowerSpec = {
  id: TowerKind;
  name: string;
  asset: string;
  cost: number;
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  slow: number;
  color: number;
  description: string;
  flavor: string;
};

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  scarab: {
    id: "scarab",
    name: "Astral Scarab",
    asset: "assets/models/enemy-scarab.glb",
    hp: 92,
    speed: 2.55,
    reward: 12,
    radius: 0.62,
    scale: 0.78,
    flying: false,
    clearance: 0.23,
    description: "Rushes the path in a six-leg gait and yields quickly to focused fire.",
    flavor: "Its lacquered shell remembers a dead sun.",
  },
  manta: {
    id: "manta",
    name: "Rift Manta",
    asset: "assets/models/enemy-manta.glb",
    hp: 138,
    speed: 2.05,
    reward: 18,
    radius: 0.86,
    scale: 0.86,
    flying: true,
    clearance: 1.24,
    description: "Glides above the path with lateral wing motion and resists splash damage.",
    flavor: "Its wake folds starlight into a bruise.",
  },
  husk: {
    id: "husk",
    name: "Siege Husk",
    asset: "assets/models/enemy-husk.glb",
    hp: 510,
    speed: 1.08,
    reward: 42,
    radius: 0.98,
    scale: 0.94,
    flying: false,
    clearance: 0.18,
    description: "Carries heavy armor and furnace health, demanding sustained single-target damage.",
    flavor: "Every step sounds like a sealed tomb opening.",
  },
  choir: {
    id: "choir",
    name: "Null Choir",
    asset: "assets/models/enemy-choir.glb",
    hp: 265,
    speed: 1.62,
    reward: 30,
    radius: 0.82,
    scale: 0.86,
    flying: true,
    clearance: 1.10,
    description: "Rotates a shielded orbit that halves the first three direct hits.",
    flavor: "Five voices sing where no air remains.",
  },
  warden: {
    id: "warden",
    name: "Crown Warden",
    asset: "assets/models/enemy-warden.glb",
    hp: 6400,
    speed: 0.72,
    reward: 480,
    radius: 1.45,
    scale: 1.05,
    flying: false,
    clearance: 0.25,
    description: "Crosses as a boss with deep health, damage resistance, and a relic-breaking leak.",
    flavor: "The crown is not worn. It is the wound itself.",
  },
};

export const TOWERS: Record<TowerKind, TowerSpec> = {
  helios: {
    id: "helios",
    name: "Helios Lance",
    asset: "assets/models/tower-helios.glb",
    cost: 150,
    damage: 46,
    range: 7.8,
    cooldown: 0.34,
    splash: 0,
    slow: 0,
    color: 0xff9c36,
    description: "Tracks one target at long range and fires rapid paired solar lances.",
    flavor: "A captured dawn answers every recoil.",
  },
  vortex: {
    id: "vortex",
    name: "Vortex Foundry",
    asset: "assets/models/tower-vortex.glb",
    cost: 220,
    damage: 32,
    range: 5.4,
    cooldown: 1.05,
    splash: 2.35,
    slow: 0,
    color: 0xff542d,
    description: "Detonates a radial pigment shock that damages clustered ground targets.",
    flavor: "Its petals hammer color into the void.",
  },
  rime: {
    id: "rime",
    name: "Rime Choir",
    asset: "assets/models/tower-rime.glb",
    cost: 185,
    damage: 22,
    range: 6.6,
    cooldown: 0.58,
    splash: 0,
    slow: 0.42,
    color: 0x42dbe2,
    description: "Launches crystalline notes that slow one target and expose its movement rhythm.",
    flavor: "Cold harmony leaves blue scars in space.",
  },
};

const PATH_CONTROL: readonly Vec2[] = [
  { x: -15.0, z: 5.8 },
  { x: -12.2, z: 3.2 },
  { x: -9.3, z: -2.8 },
  { x: -5.2, z: -5.4 },
  { x: -1.3, z: -2.2 },
  { x: 1.4, z: 3.6 },
  { x: 5.6, z: 5.0 },
  { x: 9.4, z: 1.5 },
  { x: 8.0, z: -3.7 },
  { x: 12.5, z: -5.2 },
  { x: 15.4, z: -1.5 },
];

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

function samplePath(stepsPerSegment = 18): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < PATH_CONTROL.length - 1; i += 1) {
    const p0 = PATH_CONTROL[Math.max(0, i - 1)]!;
    const p1 = PATH_CONTROL[i]!;
    const p2 = PATH_CONTROL[Math.min(PATH_CONTROL.length - 1, i + 1)]!;
    const p3 = PATH_CONTROL[Math.min(PATH_CONTROL.length - 1, i + 2)]!;
    for (let j = 0; j < stepsPerSegment; j += 1) {
      const t = j / stepsPerSegment;
      out.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t), z: catmull(p0.z, p1.z, p2.z, p3.z, t) });
    }
  }
  out.push({ ...PATH_CONTROL[PATH_CONTROL.length - 1]! });
  return out;
}

export const PATH_POINTS = samplePath();

export const PATH_DISTANCE: number[] = (() => {
  const out = [0];
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    const a = PATH_POINTS[i - 1]!;
    const b = PATH_POINTS[i]!;
    out.push(out[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return out;
})();

export const PATH_LENGTH = PATH_DISTANCE[PATH_DISTANCE.length - 1]!;

export function pointAtDistance(distance: number): Vec2 {
  const d = Math.max(0, Math.min(PATH_LENGTH, distance));
  let lo = 0;
  let hi = PATH_DISTANCE.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (PATH_DISTANCE[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = PATH_POINTS[lo]!;
  const b = PATH_POINTS[Math.min(lo + 1, PATH_POINTS.length - 1)]!;
  const span = Math.max(0.0001, PATH_DISTANCE[Math.min(lo + 1, PATH_DISTANCE.length - 1)]! - PATH_DISTANCE[lo]!);
  const t = (d - PATH_DISTANCE[lo]!) / span;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function tangentAtDistance(distance: number): Vec2 {
  const a = pointAtDistance(Math.max(0, distance - 0.12));
  const b = pointAtDistance(Math.min(PATH_LENGTH, distance + 0.12));
  const length = Math.max(0.0001, Math.hypot(b.x - a.x, b.z - a.z));
  return { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
}

export const BUILD_SLOTS: readonly Vec2[] = [
  { x: -11.2, z: 6.7 },
  { x: -9.5, z: 0.6 },
  { x: -7.1, z: -6.7 },
  { x: -3.6, z: -1.0 },
  { x: -1.3, z: 5.8 },
  { x: 2.4, z: 0.6 },
  { x: 4.6, z: 7.0 },
  { x: 7.4, z: 3.2 },
  { x: 10.7, z: 5.5 },
  { x: 10.2, z: -1.4 },
  { x: 6.4, z: -6.3 },
  { x: 13.4, z: -6.5 },
];

export type SpawnGroup = { kind: EnemyKind; count: number; spacing: number; delay?: number };

export const WAVES: readonly (readonly SpawnGroup[])[] = [
  [{ kind: "scarab", count: 12, spacing: 0.58 }],
  [{ kind: "scarab", count: 16, spacing: 0.43 }, { kind: "manta", count: 5, spacing: 0.78, delay: 1.0 }],
  [{ kind: "husk", count: 4, spacing: 1.45 }, { kind: "scarab", count: 18, spacing: 0.35, delay: 0.4 }],
  [{ kind: "choir", count: 7, spacing: 0.92 }, { kind: "manta", count: 10, spacing: 0.54, delay: 0.6 }],
  [{ kind: "husk", count: 9, spacing: 0.95 }, { kind: "scarab", count: 24, spacing: 0.28, delay: 0.2 }],
  [{ kind: "choir", count: 12, spacing: 0.58 }, { kind: "husk", count: 7, spacing: 1.05, delay: 0.4 }],
  [{ kind: "manta", count: 18, spacing: 0.34 }, { kind: "husk", count: 12, spacing: 0.72, delay: 0.6 }],
  [{ kind: "warden", count: 1, spacing: 0 }, { kind: "choir", count: 10, spacing: 0.62, delay: 1.2 }, { kind: "husk", count: 8, spacing: 0.78, delay: 1.0 }],
];
