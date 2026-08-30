import {
  BUILD_SLOTS,
  ENEMIES,
  PATH_LENGTH,
  TOWERS,
  WAVES,
  pointAtDistance,
  type EnemyKind,
  type TowerKind,
  type Vec2,
} from "../content/catalog";

export type EnemyState = {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  distance: number;
  previousDistance: number;
  speed: number;
  slowAmount: number;
  slowTime: number;
  shieldHits: number;
  phase: number;
  alive: boolean;
};

export type TowerState = {
  id: number;
  kind: TowerKind;
  slot: number;
  cooldown: number;
  recoil: number;
  targetId: number | null;
  shots: number;
};

export type CombatEvent =
  | { type: "spawn"; enemyId: number; kind: EnemyKind; at: Vec2 }
  | { type: "fire"; towerId: number; towerKind: TowerKind; source: Vec2; targetId: number; target: Vec2; color: number }
  | { type: "hit"; enemyId: number; at: Vec2; amount: number; color: number; critical: boolean }
  | { type: "death"; enemyId: number; kind: EnemyKind; at: Vec2 }
  | { type: "leak"; enemyId: number; kind: EnemyKind; at: Vec2; lives: number }
  | { type: "build"; towerId: number; towerKind: TowerKind; slot: number; at: Vec2 }
  | { type: "wave"; wave: number }
  | { type: "victory" }
  | { type: "defeat" };

type PendingSpawn = { at: number; kind: EnemyKind };

export type SimulationSnapshot = {
  time: number;
  wave: number;
  waveActive: boolean;
  lives: number;
  gold: number;
  score: number;
  enemies: readonly EnemyState[];
  towers: readonly TowerState[];
  victory: boolean;
  defeat: boolean;
};

function distanceSquared(a: Vec2, b: Vec2): number {
  const x = a.x - b.x;
  const z = a.z - b.z;
  return x * x + z * z;
}

export class Simulation {
  readonly enemies: EnemyState[] = [];
  readonly towers: TowerState[] = [];
  readonly events: CombatEvent[] = [];
  time = 0;
  wave = 0;
  waveActive = false;
  lives = 20;
  gold = 520;
  score = 0;
  victory = false;
  defeat = false;
  private nextEnemyId = 1;
  private nextTowerId = 1;
  private waveTime = 0;
  private spawnQueue: PendingSpawn[] = [];
  private readonly candidateScratch: EnemyState[] = [];

  reset(): void {
    this.enemies.length = 0;
    this.towers.length = 0;
    this.events.length = 0;
    this.time = 0;
    this.wave = 0;
    this.waveActive = false;
    this.lives = 20;
    this.gold = 520;
    this.score = 0;
    this.victory = false;
    this.defeat = false;
    this.nextEnemyId = 1;
    this.nextTowerId = 1;
    this.waveTime = 0;
    this.spawnQueue.length = 0;
  }

  snapshot(): SimulationSnapshot {
    return {
      time: this.time,
      wave: this.wave,
      waveActive: this.waveActive,
      lives: this.lives,
      gold: this.gold,
      score: this.score,
      enemies: this.enemies,
      towers: this.towers,
      victory: this.victory,
      defeat: this.defeat,
    };
  }

  consumeEvents(): CombatEvent[] {
    return this.events.splice(0, this.events.length);
  }

  startWave(): boolean {
    if (this.waveActive || this.victory || this.defeat || this.wave >= WAVES.length) return false;
    const groups = WAVES[this.wave]!;
    this.wave += 1;
    this.waveTime = 0;
    this.spawnQueue.length = 0;
    let cursor = 0;
    for (const group of groups) {
      cursor += group.delay ?? 0;
      for (let i = 0; i < group.count; i += 1) {
        this.spawnQueue.push({ at: cursor, kind: group.kind });
        cursor += group.spacing;
      }
    }
    this.waveActive = true;
    this.events.push({ type: "wave", wave: this.wave });
    return true;
  }

  buildTower(kind: TowerKind, slot: number, free = false): boolean {
    const spec = TOWERS[kind];
    const at = BUILD_SLOTS[slot];
    if (!at || this.towers.some((tower) => tower.slot === slot)) return false;
    if (!free && this.gold < spec.cost) return false;
    if (!free) this.gold -= spec.cost;
    const tower: TowerState = {
      id: this.nextTowerId++,
      kind,
      slot,
      cooldown: 0.2 + slot * 0.025,
      recoil: 0,
      targetId: null,
      shots: 0,
    };
    this.towers.push(tower);
    this.events.push({ type: "build", towerId: tower.id, towerKind: tower.kind, slot, at: { ...at } });
    return true;
  }

  buildAll(free = true): void {
    const kinds: TowerKind[] = ["helios", "vortex", "rime"];
    for (let slot = 0; slot < BUILD_SLOTS.length; slot += 1) {
      this.buildTower(kinds[slot % kinds.length]!, slot, free);
    }
  }

  spawn(kind: EnemyKind, distance = 0, hpScale = 1): EnemyState {
    const spec = ENEMIES[kind];
    const enemy: EnemyState = {
      id: this.nextEnemyId++,
      kind,
      hp: spec.hp * hpScale,
      maxHp: spec.hp * hpScale,
      distance,
      previousDistance: distance,
      speed: spec.speed,
      slowAmount: 0,
      slowTime: 0,
      shieldHits: kind === "choir" ? 3 : 0,
      phase: ((this.nextEnemyId * 0.61803398875) % 1) * Math.PI * 2,
      alive: true,
    };
    this.enemies.push(enemy);
    this.events.push({ type: "spawn", enemyId: enemy.id, kind, at: pointAtDistance(distance) });
    return enemy;
  }

  spawnStress(count = 36): void {
    const kinds: EnemyKind[] = ["scarab", "manta", "husk", "choir"];
    for (let i = 0; i < count; i += 1) {
      const enemy = this.spawn(kinds[i % kinds.length]!, 8 + i * 0.72, 12);
      enemy.speed *= 0.26;
    }
  }

  step(dt: number): void {
    if (this.victory || this.defeat) return;
    this.time += dt;
    if (this.waveActive) {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0]!.at <= this.waveTime) {
        this.spawn(this.spawnQueue.shift()!.kind);
      }
    }

    for (const enemy of this.enemies) {
      enemy.previousDistance = enemy.distance;
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
      if (enemy.slowTime === 0) enemy.slowAmount = 0;
      const slow = 1 - enemy.slowAmount;
      enemy.distance += enemy.speed * slow * dt;
      if (enemy.distance >= PATH_LENGTH) {
        enemy.alive = false;
        const loss = enemy.kind === "warden" ? 8 : enemy.kind === "husk" ? 2 : 1;
        this.lives = Math.max(0, this.lives - loss);
        this.events.push({ type: "leak", enemyId: enemy.id, kind: enemy.kind, at: pointAtDistance(PATH_LENGTH), lives: this.lives });
      }
    }

    for (const tower of this.towers) {
      tower.recoil = Math.max(0, tower.recoil - dt * 5.5);
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      this.fireTower(tower);
    }

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]!;
      if (!enemy.alive) this.enemies.splice(i, 1);
    }

    if (this.lives <= 0 && !this.defeat) {
      this.defeat = true;
      this.waveActive = false;
      this.events.push({ type: "defeat" });
      return;
    }

    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.gold += 80 + this.wave * 25;
      if (this.wave >= WAVES.length) {
        this.victory = true;
        this.events.push({ type: "victory" });
      }
    }
  }

  private fireTower(tower: TowerState): void {
    const spec = TOWERS[tower.kind];
    const source = BUILD_SLOTS[tower.slot]!;
    const candidates = this.candidateScratch;
    candidates.length = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (tower.kind === "vortex" && ENEMIES[enemy.kind].flying) continue;
      if (distanceSquared(source, pointAtDistance(enemy.distance)) <= spec.range * spec.range) candidates.push(enemy);
    }
    candidates.sort((a, b) => b.distance - a.distance || a.id - b.id);
    const target = candidates[0];
    if (!target) {
      tower.targetId = null;
      tower.cooldown = 0.08;
      return;
    }

    tower.targetId = target.id;
    tower.cooldown = spec.cooldown;
    tower.recoil = 1;
    tower.shots += 1;
    const targetPoint = pointAtDistance(target.distance);
    this.events.push({
      type: "fire",
      towerId: tower.id,
      towerKind: tower.kind,
      source: { ...source },
      targetId: target.id,
      target: targetPoint,
      color: spec.color,
    });

    if (spec.splash > 0) {
      const radius2 = spec.splash * spec.splash;
      for (const enemy of candidates) {
        if (distanceSquared(pointAtDistance(enemy.distance), targetPoint) <= radius2) {
          this.applyDamage(enemy, spec.damage, spec.color, false);
        }
      }
    } else {
      const critical = tower.kind === "helios" && tower.shots % 9 === 0;
      this.applyDamage(target, spec.damage * (critical ? 1.75 : 1), spec.color, critical);
    }

    if (spec.slow > 0 && target.alive) {
      target.slowAmount = Math.max(target.slowAmount, spec.slow);
      target.slowTime = 1.8;
    }
  }

  private applyDamage(enemy: EnemyState, rawDamage: number, color: number, critical: boolean): void {
    if (!enemy.alive) return;
    let damage = rawDamage;
    if (enemy.shieldHits > 0) {
      damage *= 0.5;
      enemy.shieldHits -= 1;
    }
    if (enemy.kind === "manta" && color === TOWERS.vortex.color) damage *= 0.55;
    if (enemy.kind === "warden") damage *= 0.78;
    enemy.hp -= damage;
    const at = pointAtDistance(enemy.distance);
    this.events.push({ type: "hit", enemyId: enemy.id, at, amount: damage, color, critical });
    if (enemy.hp <= 0) {
      enemy.alive = false;
      const spec = ENEMIES[enemy.kind];
      this.gold += spec.reward;
      this.score += Math.round(spec.reward * 12 + enemy.distance * 2);
      this.events.push({ type: "death", enemyId: enemy.id, kind: enemy.kind, at });
    }
  }
}
