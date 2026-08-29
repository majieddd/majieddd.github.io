// Simulation: deterministic game logic, no THREE / no DOM so it can be unit-tested in Node.
import { makeRNG } from './rng.js';
import {
  GRID, WAYPOINTS, TOWERS, TOWER_ORDER, ENEMIES, buildWaves, PATH_TILES, CORE_TILE,
} from './data.js';

let _id = 1;
const nextId = () => _id++;

function buildPathPoints() {
  const pts = [];
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    let [c0, r0] = WAYPOINTS[i];
    const [c1, r1] = WAYPOINTS[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    if (i === 0) pts.push([c, r]);
    while (c !== c1 || r !== r1) { c += dc; r += dr; pts.push([c, r]); }
  }
  pts.push(CORE_TILE.slice());
  return pts;
}

export class GameSim {
  constructor(opts = {}) {
    this.seed = opts.seed || 1337;
    this.reset(this.seed);
  }

  reset(seed) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.path = buildPathPoints();
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.particles = [];      // lightweight sim-side transient markers (drained by render)
    this.events = [];         // {type, ...} drained by host each frame
    this.gold = 220;
    this.lives = 20;
    this.score = 0;
    this.waveIndex = -1;
    this.waves = buildWaves();
    this.totalWaves = this.waves.length;
    this.state = 'playing';   // playing | victory | defeat
    this.waveActive = false;
    this.betweenTimer = 0;    // countdown to auto-start next wave
    this.nextAuto = 0;
    this.spawnQueue = [];     // {type, at} absolute sim-time
    this.time = 0;
    this.kills = 0;
    this.leaks = 0;
    this.shake = 0;
  }

  emit(e) { this.events.push(e); }

  // ---- placement / economy -------------------------------------------------
  canBuildAt(c, r) {
    if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) return false;
    if (PATH_TILES.has(c + ',' + r)) return false;
    const [cc, cr] = CORE_TILE;
    if (Math.abs(c - cc) <= 1 && Math.abs(r - cr) <= 1) return false; // keep core clear
    for (const t of this.towers) if (t.c === c && t.r === r) return false;
    return true;
  }

  placeTower(type, c, r) {
    const def = TOWERS[type];
    if (!def) return { ok: false, why: 'unknown' };
    if (!this.canBuildAt(c, r)) return { ok: false, why: 'blocked' };
    if (this.gold < def.cost) return { ok: false, why: 'broke' };
    this.gold -= def.cost;
    const t = {
      id: nextId(), type, def, c, r, x: c + 0.5, y: r + 0.5,
      level: 1, cooldown: 0, fireAnim: 0, spawnAnim: 0.0001,
      dmg: def.dmg, range: def.range, rate: def.rate,
      splash: def.splash, slow: def.slow, chain: def.chain,
      pierce: !!def.pierce, totalSpent: def.cost, angle: 0,
    };
    this.towers.push(t);
    this.emit({ type: 'build', x: t.x, y: t.y, hue: def.color });
    return { ok: true, tower: t };
  }

  sellTower(id) {
    const i = this.towers.findIndex((t) => t.id === id);
    if (i < 0) return false;
    const t = this.towers[i];
    const refund = Math.round(t.totalSpent * 0.6);
    this.gold += refund;
    this.towers.splice(i, 1);
    this.emit({ type: 'sell', x: t.x, y: t.y, gold: refund });
    return true;
  }

  upgradeTower(id) {
    const t = this.towers.find((x) => x.id === id);
    if (!t || t.level >= 3) return { ok: false };
    const cost = Math.round(t.def.cost * 0.75 * t.level);
    if (this.gold < cost) return { ok: false, why: 'broke' };
    this.gold -= cost;
    t.totalSpent += cost;
    t.level += 1;
    const u = t.def.upgrade;
    t.dmg *= u.dmg; t.range *= u.range; t.rate *= u.rate;
    if (u.slow) t.slow = Math.min(0.8, t.slow * u.slow);
    if (u.chain) t.chain = Math.round(t.chain * u.chain);
    if (u.splash) t.splash *= u.splash;
    t.upgradeFlash = 0.0001;
    this.emit({ type: 'upgrade', x: t.x, y: t.y, level: t.level });
    return { ok: true };
  }

  // ---- waves ----------------------------------------------------------------
  startNextWave(early = false) {
    if (this.waveActive || this.state !== 'playing') return false;
    if (this.waveIndex + 1 >= this.totalWaves) return false;
    this.waveIndex += 1;
    const groups = this.waves[this.waveIndex];
    this.spawnQueue = [];
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        this.spawnQueue.push({ type: g.type, at: this.time + (g.start || 0) + i * (g.gap || 0.8) });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.waveActive = true;
    if (early) { const bonus = 20 + this.waveIndex * 4; this.gold += bonus; this.emit({ type: 'early', gold: bonus }); }
    this.emit({ type: 'wave-start', index: this.waveIndex });
    return true;
  }

  _spawn(type) {
    const def = ENEMIES[type];
    const p0 = this.path[0];
    const e = {
      id: nextId(), type, def, hp: def.hp, maxHp: def.hp,
      speed: def.speed, baseSpeed: def.speed, armor: def.armor, reward: def.reward,
      pi: 1, t: 0, x: p0[0] + 0.5, y: p0[1] + 0.5, kind: def.kind,
      radius: def.radius, boss: !!def.boss, origin: def.origin, color: def.color,
      slowT: 0, slowFactor: 0, dead: false, reached: false, hitFlash: 0,
      walkPhase: this.rng.range(0, 6.28), spawnAnim: 0.0001,
    };
    this.enemies.push(e);
    this.emit({ type: 'spawn', enemy: e });
  }

  _applyDamage(target, dmg, slow, srcHue) {
    if (target.dead || target.reached) return;
    const eff = Math.max(1, dmg - target.armor);
    target.hp -= eff;
    target.hitFlash = 0.12;
    if (slow && !target.def.ignoreSlow) { target.slowT = Math.max(target.slowT, 1.2); target.slowFactor = Math.max(target.slowFactor, slow); }
    if (target.hp <= 0) this._kill(target, srcHue);
  }

  _kill(e, srcHue) {
    if (e.dead) return;
    e.dead = true;
    this.gold += e.reward;
    this.score += e.boss ? 500 : Math.round(e.maxHp / 4);
    this.kills += 1;
    this.emit({ type: 'kill', x: e.x, y: e.y, boss: e.boss, hue: e.color, reward: e.reward });
    if (e.boss) this.shake = Math.max(this.shake, 1.2);
  }

  // ---- per-frame update -----------------------------------------------------
  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.8);

    // spawn
    if (this.waveActive) {
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
        this._spawn(this.spawnQueue.shift().type);
      }
    }

    // move enemies
    for (const e of this.enemies) {
      if (e.dead || e.reached) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.spawnAnim > 0) e.spawnAnim = Math.min(1, e.spawnAnim + dt * 2.2);
      let spd = e.baseSpeed;
      if (e.slowT > 0) { e.slowT -= dt; spd *= (1 - e.slowFactor); if (e.slowT <= 0) e.slowFactor = 0; }
      let move = spd * dt;
      while (move > 0 && e.pi < this.path.length) {
        const [nx, ny] = this.path[e.pi];
        const tx = nx + 0.5, ty = ny + 0.5;
        const dx = tx - e.x, dy = ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) { e.x = tx; e.y = ty; move -= d; e.pi += 1; }
        else { e.x += (dx / d) * move; e.y += (dy / d) * move; move = 0; }
      }
      e.walkPhase += dt * (e.baseSpeed * 2.4);
      if (e.pi >= this.path.length) { // reached core
        e.reached = true;
        this.lives -= e.boss ? 8 : 1;
        this.leaks += 1;
        this.shake = Math.max(this.shake, e.boss ? 1.0 : 0.45);
        this.emit({ type: 'leak', x: e.x, y: e.y, boss: e.boss });
        if (this.lives <= 0) { this.lives = 0; this._defeat(); }
      }
    }

    // towers acquire + fire
    for (const t of this.towers) {
      if (t.fireAnim > 0) t.fireAnim = Math.max(0, t.fireAnim - dt * 4);
      if (t.spawnAnim > 0) t.spawnAnim = Math.min(1, t.spawnAnim + dt * 3);
      if (t.upgradeFlash > 0) t.upgradeFlash = Math.min(1, t.upgradeFlash + dt * 3);
      if (t.cooldown > 0) t.cooldown -= dt;
      const target = this._acquire(t);
      if (target) {
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        if (t.cooldown <= 0) { this._fire(t, target); t.cooldown = 1 / t.rate; }
      }
    }

    // projectiles
    for (const p of this.projectiles) this._stepProjectile(p, dt);
    this.projectiles = this.projectiles.filter((p) => !p.done);

    // cull dead enemies
    this.enemies = this.enemies.filter((e) => !e.dead && !e.reached);

    // wave complete?
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = 25 + this.waveIndex * 6;
      this.gold += bonus;
      this.emit({ type: 'wave-clear', index: this.waveIndex, gold: bonus });
      if (this.waveIndex + 1 >= this.totalWaves) this._victory();
    }
  }

  _acquire(t) {
    let best = null, bestProg = -1;
    const r2 = t.range * t.range;
    for (const e of this.enemies) {
      if (e.dead || e.reached) continue;
      if (t.def.kind === 'ground' && e.kind !== 'ground') continue;
      if (t.def.kind === 'air' && e.kind !== 'air') continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r2) {
        const prog = e.pi + e.t;
        if (prog > bestProg) { bestProg = prog; best = e; }
      }
    }
    return best;
  }

  _fire(t, target) {
    t.fireAnim = 1;
    t.lastFire = this.time;
    const def = t.def;
    this.emit({ type: 'fire', x: t.x, y: t.y, hue: def.color, kind: def.proj, tx: target.x, ty: target.y });
    if (def.proj === 'arc') { // tesla: instant chain
      this._chainHit(t, target);
      return;
    }
    const speed = def.proj === 'beam' ? 38 : def.proj === 'flak' ? 18 : def.proj === 'frost' ? 14 : 22;
    this.projectiles.push({
      id: nextId(), x: t.x, y: t.y, targetId: target.id, tx: target.x, ty: target.y,
      speed, dmg: t.dmg, splash: t.splash, slow: t.slow, chain: 0,
      kind: def.proj, hue: def.color, pierce: t.pierce, done: false, life: 2.5,
      hitSet: new Set(),
    });
  }

  _chainHit(t, first) {
    let from = first; const dmg = t.dmg;
    const hit = new Set([first.id]);
    let prev = { x: t.x, y: t.y };
    for (let i = 0; i <= t.chain && from; i++) {
      this._applyDamage(from, dmg * Math.pow(0.85, i), 0, t.def.color);
      this.emit({ type: 'arc', x0: prev.x, y0: prev.y, x1: from.x, y1: from.y, hue: t.def.color });
      prev = from;
      if (i === t.chain) break;
      let nx = null, nd = 2.5 * 2.5;
      for (const e of this.enemies) {
        if (e.dead || e.reached || hit.has(e.id)) continue;
        const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
        if (d < nd) { nd = d; nx = e; }
      }
      from = nx; hit.add(nx ? nx.id : -1);
    }
  }

  _stepProjectile(p, dt) {
    p.life -= dt;
    if (p.life <= 0) { p.done = true; return; }
    let tx, ty;
    const tgt = this.enemies.find((e) => e.id === p.targetId && !e.dead && !e.reached);
    if (tgt) { tx = tgt.x; ty = tgt.y; p.tx = tx; p.ty = ty; }
    else { tx = p.tx; ty = p.ty; }
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step || d < 0.2) {
      p.x = tx; p.y = ty; this._resolveProjectile(p, tgt);
    } else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  }

  _resolveProjectile(p, tgt) {
    if (p.splash > 0) {
      const r2 = p.splash * p.splash;
      for (const e of this.enemies) {
        if (e.dead || e.reached) continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= r2) this._applyDamage(e, p.dmg, p.slow, p.hue);
      }
      this.emit({ type: 'boom', x: p.x, y: p.y, r: p.splash, hue: p.hue });
    } else if (p.pierce && tgt) {
      this._applyDamage(tgt, p.dmg, 0, p.hue);
      this.emit({ type: 'beam-hit', x: p.x, y: p.y, hue: p.hue });
    } else if (tgt) {
      this._applyDamage(tgt, p.dmg, p.slow, p.hue);
    } else {
      this.emit({ type: 'boom', x: p.x, y: p.y, r: 0.3, hue: p.hue });
    }
    p.done = true;
  }

  _victory() { this.state = 'victory'; this.emit({ type: 'victory' }); }
  _defeat() { this.state = 'defeat'; this.emit({ type: 'defeat' }); }

  drainEvents() { const e = this.events; this.events = []; return e; }
}

export { nextId, buildPathPoints, CORE_TILE };
