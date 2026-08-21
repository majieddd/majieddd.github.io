/* ==========================================================================
   COSMIC CONQUEST — Expansion Mechanics
   --------------------------------------------------------------------------
   Behaviours for the sixteen expansion towers, plus the Minion and Barricade
   entities they field. Loaded after entities.js; everything here extends the
   Tower prototype rather than touching the core simulation.
   ========================================================================== */

'use strict';

/* ------------------------------------------------------------------ MINION */

class Minion {
  constructor(tower, spot) {
    this.tower = tower;
    this.x = spot.x; this.y = spot.y;
    const s = tower.stats;
    /* 19.16 -- a minion is a summoned body, so it is on the same penalty
       curve a mustered one is. Health only: the item is a HEALTH penalty,
       and damping the damage too would price the tower twice. */
    this.maxHp = waveScaled((s.minionHp || 50) * (s.minionHpMul || 1)) * tower.ascDamage
                 * spawnHpPenaltyMul(Game.wave);
    this.hp = this.maxHp;
    this.dps = waveScaled((s.minionDps || 8) * (s.minionDpsMul || 1)) * 0.55;
    this.slow = s.minionSlow || 0.3;
    this.dead = false;
    this.age = 0;
    this.target = null;
  }
  update(dt, game) {
    this.age += dt;
    const t = this.tower;
    if (!this.target || this.target.dead || this.target.leaked ||
        dist2(t.x, t.y, this.target.x, this.target.y) > t.rangePx * t.rangePx * 2.3) {
      this.target = null;
      let bd = Infinity;
      for (const e of game.enemies) {
        if (e.dead || e.flying || e.hostileTo !== t.side) continue;
        if (e.boss || e.miniboss) continue;
        const d2 = dist2(t.x, t.y, e.x, e.y);
        if (d2 < t.rangePx * t.rangePx && d2 < bd) { bd = d2; this.target = e; }
      }
    }
    const tg = this.target;
    if (tg) {
      const dx = tg.x - this.x, dy = tg.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const spd = 3.6 * TILE;
      if (d > tg.radius + 8) { this.x += dx / d * spd * dt; this.y += dy / d * spd * dt; }
      else {
        /* engaged: grind the target, slow it, and take trample wear */
        const dealt = tg.takeDamage(t.effDamageFor(this.dps) * dt, 'physical', { pierce: t.effPierce });
        t.registerDamage(dealt, tg, game, false, true);
        tg.applySlow(this.slow * t.effStatus, 0.25);
        this.hp -= (10 + tg.radius) * dt;
      }
    } else {
      const dx = t.x - this.x, dy = t.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 26) { this.x += dx / d * 2.4 * TILE * dt; this.y += dy / d * 2.4 * TILE * dt; }
    }
    if (this.hp <= 0) {
      this.dead = true;
      const blast = t.stats.minionBlast;
      if (blast) {
        const r = 1.2 * TILE, r2 = r * r;
        for (const e of game.enemies) {
          if (e.dead || e.hostileTo !== t.side) continue;
          if (dist2(this.x, this.y, e.x, e.y) <= r2) {
            const dealt = e.takeDamage(t.effDamageFor(this.dps) * blast, 'physical', {});
            t.registerDamage(dealt, e, game);
          }
        }
        game.spawnExplosion(this.x, this.y, r, t.def.color);
      } else game.spawnBurst(this.x, this.y, 8, t.def.color, 80);
    }
  }
  draw(ctx) {
    const c = this.tower.def.color;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    const b = Math.sin(this.age * 9) * 1.4;
    ctx.beginPath(); ctx.roundRect(-6, -7 + b, 12, 12, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(-3.5, -4 + b, 7, 3);
    const f = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-7, -12, 14, 2.5);
    ctx.fillStyle = f > 0.5 ? '#4ade80' : '#fbbf24'; ctx.fillRect(-7, -12, 14 * f, 2.5);
    ctx.restore();
  }
}

/* --------------------------------------------------------------- BARRICADE */

class Barricade {
  constructor(tower, path, dist) {
    this.tower = tower;
    this.path = path;
    this.dist = dist;
    const p = path.posAt(dist, {});
    this.x = p.x; this.y = p.y; this.ux = p.ux; this.uy = p.uy;
    const s = tower.stats;
    this.maxHp = waveScaled((s.wallHp || 400) * (s.wallHpMul || 1));
    this.hp = this.maxHp;
    this.dead = false;
    this.age = 0;
  }
  update(dt, game) {
    this.age += dt;
    const t = this.tower;
    const reach2 = (TILE * 0.8) ** 2;

    /* BLOCK CAPACITY. A wall holds a specific NUMBER of attackers, not all of
       them; the overflow squeezes past while the held ones batter it down.
       Without this a single barricade is an absolute gate, which silently
       hard-counters the reanimate offence that the whole game is built on.
       Contact is resolved furthest-along-first so the leaders are the ones
       held and the stragglers are the ones that slip by -- the reverse would
       let a trailing unit steal a slot from the unit actually at the wall. */
    const cap = Math.max(1, Math.round(t.stats.wallBlocks || 3));
    const touching = [];
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== t.side) continue;
      if (dist2(this.x, this.y, e.x, e.y) <= reach2) touching.push(e);
    }
    touching.sort((a2, b2) => b2.dist - a2.dist);
    this.held = Math.min(touching.length, cap);
    this.cap = cap;
    this.overflow = Math.max(0, touching.length - cap);

    for (let i = 0; i < touching.length; i++) {
      const e = touching[i];
      const blocked = i < cap;
      {
        if (!(e.boss || e.miniboss) && blocked) {
          /* Freeze forward progress at the point of first contact. */
          if (e._wallRef !== this) { e._wallRef = this; e._wallAt = e.dist; }
          e.dist = Math.min(e.dist, e._wallAt);
          e.updatePosition();
        } else if (e._wallRef === this) {
          /* Released: forget the anchor so it does not snap back on re-touch. */
          e._wallRef = null;
        }
        const grind = (8 + e.radius * 1.5) * ((e.boss || e.miniboss) ? 6 : 1);
        this.hp -= grind * dt;
        if (t.stats.wallThorns) {
          const dealt = e.takeDamage(t.effDamageFor(t.stats.wallThorns) * dt, 'physical', {});
          t.registerDamage(dealt, e, game, false, true);
        }
        if (t.stats.wallVuln) e.applyVuln(t.stats.wallVuln, 0.4);
      }
    }
    if (this.hp <= 0) {
      this.dead = true;
      game.spawnExplosion(this.x, this.y, TILE, t.def.color);
      Sound.play('wallBreak');
    }
  }
  draw(ctx) {
    const f = clamp(this.hp / this.maxHp, 0, 1);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.uy, this.ux) + Math.PI / 2);
    ctx.fillStyle = '#2a2140';
    ctx.strokeStyle = this.tower.def.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-TILE * 0.62, -7, TILE * 1.24, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = this.tower.def.color;
    ctx.globalAlpha = 0.55;
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 9 - 2, -5, 4, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-TILE * 0.62, -13, TILE * 1.24, 3);
    ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(-TILE * 0.62, -13, TILE * 1.24 * f, 3);
    ctx.restore();
  }
}

/* ------------------------------------------------- TOWER BEHAVIOUR EXTENSIONS */

/* FOUNDRY — forge and maintain a fighting flock. */
Tower.prototype.atk_minions = function (dt, game) {
  this.minionList = this.minionList || [];
  this.forgeT = (this.forgeT || 0) - dt;
  const s = this.stats;
  const cap = s.minions || 1;
  if (this.forgeT <= 0 && this.minionList.length < cap) {
    this.forgeT = (s.forgeTime || 6) * (s.forgeTimeMul || 1);
    const a = rand(0, TAU);
    this.minionList.push(new Minion(this, { x: this.x + Math.cos(a) * 22, y: this.y + Math.sin(a) * 22 }));
    if (this.side === game.viewSide) Sound.play('forge');
  }
  for (let i = this.minionList.length - 1; i >= 0; i--) {
    this.minionList[i].update(dt, game);
    if (this.minionList[i].dead) this.minionList.splice(i, 1);
  }
};

/* SABOTEUR — reach across the field and knock rival towers offline. */
Tower.prototype.atk_sabotage = function (dt, game) {
  this.sabT = (this.sabT === undefined ? (this.stats.sabotageEvery || 10) * 0.6 : this.sabT) - dt;
  if (this.sabT > 0) return;
  const s = this.stats;
  this.sabT = (s.sabotageEvery || 10) * (s.sabotageEveryMul || 1);
  /* Crashed outright in THE MAELSTROM: sides[1 - side] is undefined for any
     seat above one. Ask the engine who the rival is instead. */
  const vic = game.rivalOf ? game.rivalOf(this.side) : 1 - this.side;
  const foe = game.sides[vic];
  if (!foe) return;
  const rivals = foe.towers.filter(t => !t.jammed && !t.jamImmune);
  if (!rivals.length) return;
  let picks = [];
  const n = s.sabotageTargets || 1;
  if (s.sabotagePriority) {
    picks = rivals.slice().sort((a, b) => b.invested - a.invested).slice(0, n);
  } else {
    const pool = rivals.slice();
    for (let i = 0; i < n && pool.length; i++)
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  for (const t of picks) {
    game.jamTower(t, (s.sabotageDur || 3) * (s.sabotageDurMul || 1));
    /* CASCADE. The blackout ends and the tower comes back slowed -- the whole
       point of the capstone is that the damage outlasts the outage. */
    if (s.sabotageLinger) {
      t.sabLingerAmt = Math.max(t.sabLingerAmt || 0, s.sabotageLinger);
      t.sabLingerT = Math.max(t.sabLingerT || 0, SABOTAGE_LINGER_SECONDS);
    }
    if (s.sabotageGold) game.awardGold(this.side, s.sabotageGold, this);
    game.beams.push({ points: [{ x: this.x, y: this.y }, { x: t.x, y: t.y }],
      life: 0.35, maxLife: 0.35, color: this.def.color, width: 2, jagged: true });
  }
  this.recoil = 1;
  if (this.side === game.viewSide) Sound.play('sabotage');
};

/* RAMPART — keep barricades standing on the nearest lane stretch. */
Tower.prototype.atk_barricade = function (dt, game) {
  this.wallList = this.wallList || [];
  this.wallT = (this.wallT || 0) - dt;
  const s = this.stats;
  const want = s.walls || 1;
  for (let i = this.wallList.length - 1; i >= 0; i--) {
    this.wallList[i].update(dt, game);
    if (this.wallList[i].dead) {
      this.wallList.splice(i, 1);
      this.wallT = (s.wallRebuild || 8) * (s.wallRebuildMul || 1);
    }
  }
  if (this.wallList.length < want && this.wallT <= 0) {
    let best = null, bd = Infinity;
    for (const p of game.defendedPaths(this.side)) {
      const n = p.nearestDist(this.x, this.y);
      if (n.d2 < bd && n.d2 <= this.rangePx * this.rangePx) { bd = n.d2; best = { p, d: n.dist }; }
    }
    if (best) {
      const off = this.wallList.length * TILE * 1.6;
      this.wallList.push(new Barricade(this, best.p, Math.max(TILE, best.d - off)));
      if (this.side === game.viewSide) Sound.play('wallUp');
    }
  }
};

/* CHRONO — rewind everything in range by its own recent motion. */
Tower.prototype.atk_chrono = function (dt, game) {
  this.cooldown -= dt;
  if (this.cooldown > 0) return;
  const s = this.stats;
  const targets = this.acquireAll(game.enemies);
  const moved = [];
  for (const e of targets) {
    if (e.boss || e.miniboss) continue;                  /* elites resist time */
    const back = e.effectiveSpeed * (s.rewindSec || 2) * this.effStatus;
    if (back <= 0.05) continue;
    const times = (s.rewindTwice && Math.random() < s.rewindTwice) ? 2 : 1;
    for (let k = 0; k < times; k++) e.pullBack(back);
    if (s.rewindVuln) e.applyVuln(s.rewindVuln, 3);
    if (s.rewindHold) e.applyFreeze(s.rewindHold);
    const dealt = e.takeDamage(this.effDamage, s.dmgType, {});
    this.registerDamage(dealt, e, game, false, true);
    moved.push(e);
  }
  if (moved.length) {
    this.cooldown = 1 / this.effRate;
    this.recoil = 1;
    game.spawnImplosion(this.x, this.y, this.rangePx, this.def.color);
    if (this.side === game.viewSide) Sound.play('chrono');
  } else this.cooldown = 0.2;
};

/* ECHO — repeat the strongest neighbours' hits on its own target. */
Tower.prototype.atk_echo = function (dt, game) {
  this.cooldown -= dt;
  if (this.cooldown > 0) return;
  const s = this.stats;
  const target = this.acquire(game.enemies);
  if (!target) { this.cooldown = 0.15; return; }
  const eR2 = ((s.echoRange || 2) * (s.echoRangeMul || 1) * TILE) ** 2;
  const near = game.sides[this.side].towers.filter(t =>
    t !== this && !t.isSupport && (t.stats.damage || t.stats.droneDamage) &&
    dist2(this.x, this.y, t.x, t.y) <= eR2)
    .sort((a, b) => b.effDamage - a.effDamage);
  if (!near.length) { this.cooldown = 0.4; return; }
  this.cooldown = 1 / this.effRate;
  this.recoil = 1;
  const count = 1 + (s.echoCount || 0);
  for (let i = 0; i < Math.min(count, near.length); i++) {
    const src = near[i];
    const dmg = (src.effDamage || src.effDamageFor(src.stats.droneDamage || 0)) * (s.echoFrac || 0.5);
    const dealt = target.takeDamage(dmg, src.stats.dmgType || 'magic', { pierce: this.effPierce });
    this.registerDamage(dealt, target, game);
    game.applyElement(target, src.def.element, dealt, this);
    game.beams.push({ points: [{ x: src.x, y: src.y }, { x: this.x, y: this.y }, { x: target.x, y: target.y }],
      life: 0.12, maxLife: 0.12, color: this.def.color, width: 1.8 });
  }
  if (this.side === game.viewSide) Sound.play('echo');
};

/* QUAKE — slam every ground enemy on this side of the field. */
Tower.prototype.atk_quake = function (dt, game) {
  this.cooldown -= dt;
  if (this.cooldown > 0) return;
  const s = this.stats;
  let any = false;
  for (const e of game.enemies) {
    if (!e.dead && !e.flying && e.hostileTo === this.side) { any = true; break; }
  }
  if (!any) { this.cooldown = 0.3; return; }
  this.cooldown = 1 / this.effRate;
  this.recoil = 1;
  const slam = (mult) => {
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== this.side) continue;
      let dmg = this.effDamage * mult;
      if (s.epicenter && dist2(this.x, this.y, e.x, e.y) <= this.rangePx * this.rangePx) dmg *= s.epicenter;
      const dealt = e.takeDamage(dmg, s.dmgType, { pierce: this.effPierce, shred: s.shred || 0 });
      this.registerDamage(dealt, e, game, false, true);
      if (s.stagger && !e.stunImmune) e.applyFreeze(s.stagger * this.effStatus);
    }
  };
  slam(1);
  if (s.aftershock) game.delayed.push({ t: 0.55, fn: () => slam(s.aftershock) });
  game.shake(3);
  game.spawnExplosion(this.x, this.y, this.rangePx, this.def.color);
  if (this.side === game.viewSide) Sound.play('quake');
};

/* SIREN — convert the strongest affordable enemy and send it onward. */
Tower.prototype.atk_siren = function (dt, game) {
  this.charmT = (this.charmT === undefined ? (this.stats.charmEvery || 18) * 0.5 : this.charmT) - dt;
  if (this.charmT > 0) return;
  const s = this.stats;
  const cap = waveScaled((s.charmMaxHp || 500) * (s.charmMaxHpMul || 1));
  let best = null, bh = -1;
  for (const e of game.enemies) {
    if (e.dead || e.hostileTo !== this.side || e.reanimated || e.boss || e.miniboss) continue;
    if (dist2(this.x, this.y, e.x, e.y) > this.rangePx * this.rangePx) continue;
    if (e.hp > cap) continue;
    if (e.hp > bh) { bh = e.hp; best = e; }
  }
  if (!best) { this.charmT = 0.5; return; }
  /* Resolve the victim AND the road to it BEFORE consuming the target. A
     previous pass converted `hostileTo` to rivalOf() but left the path on
     `sendPaths`, which both multi-seat builders hard-code to two entries as
     legacy accessors -- so on any seat above 1 this built an Enemy with an
     undefined path and threw out of Game.step, and Game.loop has no catch, so
     the battle froze on its last frame permanently. Mirrors Game.muster,
     which already picks sendTriPaths[side][victim] correctly. Computing this
     before `best.dead = true` matters: bailing afterwards would delete the
     enemy and send nothing when every rival is already down. */
  const vic = game.rivalOf ? game.rivalOf(this.side) : 1 - this.side;
  const sendPath = (game.triMode && game.sendTriPaths && game.sendTriPaths[this.side])
    ? game.sendTriPaths[this.side][vic] : game.sendPaths[this.side];
  if (vic < 0 || !sendPath) { this.charmT = 0.5; return; }
  this.charmT = (s.charmEvery || 18) * (s.charmEveryMul || 1);
  this.recoil = 1;
  best.dead = true; best._counted = true;             /* no bounty, no reanimate-on-kill */
  best.charmed = true;
  /* `best.maxHp` already contains drift and every escalation, so passing
     `drift`/`mods` again re-applied both -- the same double-scaling bug that
     was fixed in reanimate() but survived here in the charm path. Armour is
     carried across explicitly instead. */
  const hpMul = (best.maxHp / best.def.hp) * (1 + (s.charmHpBonus || 0));
  game.pendingSpawns.push(new Enemy(best.def, sendPath, {
    hpMul, bountyMul: 1, speedMul: 1.1, armorFlat: best.armor,
    hostileTo: vic,
    owner: this.side, reanimated: true,
    startDist: rand(0, 10)
  }));
  game.sides[this.side].stats.sent++;
  if (s.charmGold) game.awardGold(this.side, s.charmGold, this);
  game.spawnImplosion(best.x, best.y, 40, this.def.color);
  game.beams.push({ points: [{ x: this.x, y: this.y }, { x: best.x, y: best.y }],
    life: 0.4, maxLife: 0.4, color: this.def.color, width: 2.5 });
  this.kills++;
  if (this.side === game.viewSide) Sound.play('siren');
};

/* GLAIVE — a blade that travels the lane path outward and back. */
Tower.prototype.atk_glaive = function (dt, game) {
  this.glaiveList = this.glaiveList || [];
  this.cooldown -= dt;
  const s = this.stats;
  const maxOut = 1 + (s.glaives || 0);
  if (this.cooldown <= 0 && this.glaiveList.length < maxOut) {
    let best = null, bd = Infinity;
    for (const p of game.defendedPaths(this.side)) {
      const n = p.nearestDist(this.x, this.y);
      if (n.d2 < bd && n.d2 <= this.rangePx * this.rangePx * 2) { bd = n.d2; best = { p, d: n.dist }; }
    }
    if (best) {
      this.cooldown = 1 / this.effRate;
      this.recoil = 1;
      this.glaiveList.push({ p: best.p, d: best.d, start: best.d, dir: 1,
        travel: (s.glaiveTiles || 7) * TILE, hits: new Map(), age: 0, x: this.x, y: this.y });
      if (this.side === game.viewSide) Sound.play('glaive');
    } else this.cooldown = 0.4;
  }
  const w = (s.glaiveWidth || 0.7) * TILE;
  const w2 = w * w;
  for (let i = this.glaiveList.length - 1; i >= 0; i--) {
    const g = this.glaiveList[i];
    g.age += dt;
    g.d += g.dir * (s.glaiveSpeed || 9) * (s.glaiveSpeedMul || 1) * TILE * dt;
    if (g.dir === 1 && g.d >= g.start + g.travel) g.dir = -1;
    if (g.dir === -1 && g.d <= g.start) { this.glaiveList.splice(i, 1); continue; }
    const pos = g.p.posAt(g.d, {});
    g.x = pos.x; g.y = pos.y;
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== this.side) continue;
      /* One hit per DIRECTION. Tracking a plain hit count let the outward pass
         burn both hits on consecutive frames, so the blade never connected on
         the way home. Detection is geometric, not path-identity, so the blade
         also catches reanimates sharing the same ground. */
      const seen = g.hits.get(e);
      if (seen === g.dir || seen === 2) continue;
      if (dist2(g.x, g.y, e.x, e.y) > w2) continue;
      g.hits.set(e, seen === undefined ? g.dir : 2);
      const dealt = e.takeDamage(this.effDamage, s.dmgType, { pierce: this.effPierce, shred: s.shred || 0 });
      this.registerDamage(dealt, e, game);
      game.applyElement(e, this.def.element, dealt, this);
    }
  }
};

/* CYCLONE — lift, hold, drop. */
Tower.prototype.atk_cyclone = function (dt, game) {
  this.cooldown -= dt;
  if (this.cooldown > 0) return;
  const s = this.stats;
  const targets = this.acquireAll(game.enemies).filter(e => !e.flying && !e.boss && !e.miniboss);
  if (!targets.length) { this.cooldown = 0.2; return; }
  this.cooldown = 1 / this.effRate;
  this.recoil = 1;
  const lift = (s.liftDur || 0.9) * (s.liftDurMul || 1) * this.effStatus;
  for (const e of targets) {
    const dealt = e.takeDamage(this.effDamage, s.dmgType, {});
    this.registerDamage(dealt, e, game, false, true);
    e.applyFreeze(lift);
    e.lifted = lift;
    if (s.liftVuln) e.applyVuln(s.liftVuln, lift + 1);
    const drop = (s.dropDmg || 10) * (s.dropDmgMul || 1);
    game.delayed.push({ t: lift, fn: () => {
      if (e.dead) return;
      const d2 = e.takeDamage(this.effDamageFor(drop), s.dmgType, {});
      this.registerDamage(d2, e, game);
      if (s.dropBack) e.pullBack(s.dropBack);
      game.spawnBurst(e.x, e.y, 6, this.def.color, 90);
    }});
  }
  game.spawnImplosion(this.x, this.y, this.rangePx, this.def.color);
  if (this.side === game.viewSide) Sound.play('cyclone');
};

/* CAPACITOR — charge in peace, nova in war. */
Tower.prototype.atk_capacitor = function (dt, game) {
  const s = this.stats;
  const cap = waveScaled((s.chargeMax || 400) * (s.chargeMaxMul || 1));
  this.charge = clamp((this.charge || 0), 0, cap);
  const targets = this.acquireAll(game.enemies);
  if (!targets.length) {
    this.charge = Math.min(cap, this.charge + (s.chargeRate || 10) * (s.chargeRateMul || 1) * dt);
    return;
  }
  if (this.charge >= (s.novaMin || 50)) {
    const full = this.charge >= cap * 0.99;
    const dmg = this.effDamageFor(this.charge);
    for (const e of targets) {
      const dealt = e.takeDamage(dmg / Math.max(1, targets.length * 0.6), s.dmgType, {});
      this.registerDamage(dealt, e, game);
      game.applyElement(e, this.def.element, dealt, this);
      if (full && s.novaStun && !e.stunImmune) e.applyFreeze(s.novaStun);
    }
    this.charge = this.charge * (s.novaKeep || 0);
    this.recoil = 1;
    game.shake(2.5);
    game.spawnExplosion(this.x, this.y, this.rangePx, this.def.color);
    if (this.side === game.viewSide) Sound.play('nova');
  }
};

/* SHEPHERD & WARD are pure fields; their effects run in game.step. */
Tower.prototype.atk_shepherd = function () {};
Tower.prototype.atk_ward = function () {};

/* ARBALEST — the shot winds tighter the longer it waits. */
Tower.prototype.atk_patience = function (dt, game) {
  const s = this.stats;
  this.windT = (this.windT || 0) + dt * (s.windRate || 0.3) * (s.windRateMul || 1);
  this.windT = Math.min(this.windT, s.windMax || 6);
  this.cooldown -= dt;
  const target = this.acquire(game.enemies);
  if (target) {
    this.angle = angleLerp(this.angle, Math.atan2(target.y - this.y, target.x - this.x), Math.min(1, dt * 12));
    if (this.cooldown <= 0) {
      this.cooldown = 1 / this.effRate;
      this.recoil = 1;
      const fullyWound = this.windT >= (s.windMax || 6) - 0.01;
      let dmg = this.effDamage * (1 + this.windT);
      if (fullyWound && s.windCrit) dmg *= s.windCrit;
      const dealt = target.takeDamage(dmg, s.dmgType, { pierce: this.effPierce });
      this.registerDamage(dealt, target, game, fullyWound);
      game.applyElement(target, this.def.element, dealt, this);
      game.beams.push({ points: [{ x: this.x, y: this.y }, { x: target.x, y: target.y }],
        life: 0.14, maxLife: 0.14, color: this.def.color, width: fullyWound ? 4 : 2 });
      this.windT = 0;
      if (this.side === game.viewSide) Sound.play(fullyWound ? 'crit' : 'bolt');
    }
  }
};

/* -------------------------------------------------- extra draw + dps hooks */

/** Shared turret rendering for the expansion: base + glyph core + readouts. */
Tower.prototype.draw_glyph = function (ctx, t) {
  const d = this.def;
  ctx.fillStyle = d.dark;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = d.color; ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 8;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  let fill = 0;
  if (this.def.attack === 'capacitor')
    fill = clamp((this.charge || 0) / waveScaled((this.stats.chargeMax || 400) * (this.stats.chargeMaxMul || 1)), 0, 1);
  if (this.def.attack === 'patience')
    fill = clamp((this.windT || 0) / (this.stats.windMax || 6), 0, 1);
  if (fill > 0) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + TAU * fill); ctx.stroke();
  }
  ctx.fillStyle = d.color;
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.glyph || '?', 0, 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
};

/** Aura fields for the expansion support towers. */
Tower.prototype.drawExpansionField = function (ctx) {
  const a = this.def.attack;
  if (a !== 'shepherd' && a !== 'ward') return;
  const col = a === 'ward' ? '233,213,255' : '190,242,100';
  const r = this.rangePx;
  const g = ctx.createRadialGradient(this.x, this.y, r * 0.2, this.x, this.y, r);
  g.addColorStop(0, `rgba(${col},0.10)`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.28)`;
  ctx.setLineDash([5, 8]);
  ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
};

/**
 * Scale a flat "how much health can this cope with" stat by the current wave.
 * Authored values stay readable as wave-1 numbers; the tower keeps pace instead
 * of falling off a cliff the moment enemy health outgrows a hardcoded constant.
 */
/* Barricade health and minion output ride the same curve enemy health does.
   The galaxy-tier term was missing here while Game.waveHpMul carries it, so by
   galaxy IV enemies were 1.9x tougher and walls were unchanged — which does not
   make the tier harder, it deletes RAMPART and FOUNDRY from the roster. The
   tier is meant to raise the whole board, not retire two archetypes. */
function waveScaled(v) {
  /* Calls THE definition rather than restating it. This function used to
     re-derive waveHpMultiplier x difficulty.hp x UNIT_HP_SCALE x galaxy tier
     by hand, which was numerically identical to Game.waveHpMul and therefore
     invisible -- and that is exactly the shape of the bug that has shipped
     seven times here, most recently when this very expression was missing the
     galaxy-tier term and walls fell 1.9x behind by tier IV.

     The guard survives because minions and walls can be constructed before a
     difficulty is installed, which waveHpMul does not tolerate. Rage is
     deliberately not passed: a wall's health is set once at build time and
     does not inherit the wave's RESONANT FIELD bid. */
  if (!Game.difficulty) return v * waveHpMultiplier(Math.max(1, Game.wave)) * UNIT_HP_SCALE;
  return v * Game.waveHpMul(Math.max(1, Game.wave));
}

const _estimateDps = Tower.prototype.estimateDps;
Tower.prototype.estimateDps = function () {
  const s = this.stats, a = this.def.attack;
  switch (a) {
    case 'minions':   return this.effDamageFor(waveScaled((s.minionDps || 0) * (s.minionDpsMul || 1)) * 0.55) * (s.minions || 1);
    case 'sabotage':  return 0;
    case 'barricade': return this.effDamageFor(s.wallThorns || 0);
    case 'chrono':    return this.effDamage * this.effRate * 4;
    case 'echo':      return this.effDamageFor(40) * (s.echoFrac || 0.5) * this.effRate;
    case 'quake':     return this.effDamage * this.effRate * 10 * (1 + (s.aftershock || 0));
    case 'siren':     return 0;
    case 'glaive':    return this.effDamage * this.effRate * 6;
    case 'cyclone':   return (this.effDamage + this.effDamageFor((s.dropDmg || 0) * (s.dropDmgMul || 1))) * this.effRate * 3;
    case 'capacitor': return this.effDamageFor((s.chargeRate || 10) * (s.chargeRateMul || 1));
    case 'shepherd':  return 0;
    case 'ward':      return 0;
    case 'patience':  return this.effDamage * (1 + (s.windMax || 6) * 0.5) * this.effRate;
    default:          return _estimateDps.call(this);
  }
};

/* ------------------------------------------------------ ABILITY CONSTRUCTS */

/**
 * Barricade and Mine were written against a Tower: they read `.stats`,
 * `.side`, `.def.color` and `.effSplash`, and they call `.registerDamage`.
 * An aimed ability has no tower behind it, so it fields ONE stand-in that
 * satisfies all of that. Four ad-hoc literals instead would mean the next
 * field a construct starts reading gets added in one place and missed in
 * three, which is exactly how the jammed-getter bug happened.
 */
class AbilityOwner {
  constructor(side, color, stats) {
    this.side = side.index;
    /* `element: null` on purpose — a construct must not seed elemental marks,
       or a free ability would out-combo the towers built to do it. */
    this.def = { color, element: null, name: 'CONSTRUCT' };
    this.stats = Object.assign({ dmgType: 'physical' }, stats);
    this.kills = 0; this.damageDealt = 0; this.goldMade = 0; this.livesRestored = 0;
    this.aura = { dmg: 0, rate: 0, range: 0 };
    this.drainMeter = 0; this.drainCd = 0;
  }
  get sideMods() { return Game.sides[this.side].mods; }
  get traits()   { return Game.sides[this.side].traits; }
  /* Authored damage is wave-scaled once at deploy, the way a barricade's
     health is, so a construct keeps pace with enemy health without being
     recomputed every frame. The commander's damage pulse is deliberately NOT
     applied: letting OVERCLOCK amplify a construct would fold one ability
     into another and make the pair worth more than either. */
  get effDamage() { return (this.stats.damage || 0) * this.sideMods.damage * GLOBAL_DAMAGE_TUNE; }
  effDamageFor(v) { return v * this.sideMods.damage * GLOBAL_DAMAGE_TUNE; }
  get effSplash() { return (this.stats.splash || 0) * this.sideMods.splash; }
  get effPierce() { return Math.min(0.95, (this.stats.pierce || 0) + this.sideMods.pierce); }
  get effStatus() { return this.sideMods.status * (this.stats.techStatus || 1); }
}
/* Crit and booking must behave identically to a tower's — including the
   command upgrades that widen them — so they are borrowed, not copied. */
AbilityOwner.prototype.rollCrit = Tower.prototype.rollCrit;
AbilityOwner.prototype.registerDamage = Tower.prototype.registerDamage;

/** Radius the aim ghost draws for each construct, in tiles. */
function constructFootprint(def) {
  switch (def.construct) {
    case 'blocker':   return 0.8;
    case 'minefield': return AIM_MINE_SPREAD;
    case 'maw':       return AIM_MAW_RANGE;
    default:          return AIM_BATTERY_RANGE;
  }
}

/**
 * What an aimed ability actually delivers. Three shapes:
 *   blocker    a Barricade thrown across the lane nearest the aim
 *   minefield  a scatter of Mines seeded along that lane
 *   battery    an emplacement that shoots (the maw is a battery that eats)
 * All three expire with the ability's own duration, and the two that hold
 * ground are destructible.
 */
class AbilityConstruct {
  constructor(side, game, def, x, y, anchor) {
    this.side = side.index;
    this.abilityId = def.id;
    this.kind = def.construct;
    this.x = x; this.y = y;
    this.life = def.dur; this.maxLife = def.dur;
    this.dead = false; this.age = 0; this.cool = 0;
    /* The fallback stands in when a seat has no commander drafted, which in
       the arena is every seat past the second on a fast start -- and it handed
       all eighteen of them the same rose. BATCH-C/nside */
    const color = (side.commander && side.commander.color) || sideColor(this.side);

    if (this.kind === 'blocker') {
      this.owner = new AbilityOwner(side, color, {
        wallHp: AIM_BLOCKER_HP, wallBlocks: AIM_BLOCKER_BLOCKS, wallThorns: AIM_BLOCKER_THORNS
      });
      this.wall = new Barricade(this.owner, anchor.path, anchor.dist);
      this.x = this.wall.x; this.y = this.wall.y;

    } else if (this.kind === 'minefield') {
      this.owner = new AbilityOwner(side, color, {
        damage: waveScaled(AIM_MINE_DAMAGE), splash: AIM_MINE_SPLASH, stun: AIM_MINE_STUN
      });
      this.mines = [];
      const step = AIM_MINE_SPREAD * TILE * 2 / AIM_MINE_COUNT;
      for (let i = 0; i < AIM_MINE_COUNT; i++) {
        /* Spread ALONG the lane rather than around the point: a mine seeded
           off the lane is a mine nothing ever steps on. */
        const d = clamp(anchor.dist + (i - (AIM_MINE_COUNT - 1) / 2) * step, 0, anchor.path.total);
        const pt = anchor.path.posAt(d, {});
        this.mines.push(new Mine(this.owner, pt.x - pt.uy * rand(-7, 7), pt.y + pt.ux * rand(-7, 7)));
      }

    } else {
      const maw = this.kind === 'maw';
      this.owner = new AbilityOwner(side, color, {
        damage: waveScaled(maw ? AIM_MAW_DAMAGE : AIM_BATTERY_DAMAGE),
        splash: maw ? 0 : AIM_BATTERY_SPLASH,
        dmgType: maw ? 'magic' : 'physical'
      });
      this.range = (maw ? AIM_MAW_RANGE : AIM_BATTERY_RANGE) * TILE;
      this.rate = maw ? AIM_MAW_RATE : AIM_BATTERY_RATE;
      this.feed = maw ? AIM_MAW_FEED : 0;
      this.maxHp = waveScaled(maw ? AIM_MAW_HP : AIM_BATTERY_HP);
      this.hp = this.maxHp;
    }
  }

  update(dt, game) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.expire(game); return; }

    if (this.kind === 'blocker') {
      this.wall.update(dt, game);
      if (this.wall.dead) { this.dead = true; return; }
      this.x = this.wall.x; this.y = this.wall.y;
      return;
    }
    if (this.kind === 'minefield') {
      for (let i = this.mines.length - 1; i >= 0; i--) {
        this.mines[i].update(dt, game);
        if (this.mines[i].dead) this.mines.splice(i, 1);
      }
      if (!this.mines.length) this.dead = true;
      return;
    }
    this.updateBattery(dt, game);
  }

  /** Leaves the board when its ability does, and says so. */
  expire(game) {
    this.dead = true;
    if (this.kind !== 'minefield') game.spawnBurst(this.x, this.y, 10, this.owner.def.color, 70);
  }

  updateBattery(dt, game) {
    const o = this.owner;
    /* Ground attackers standing on it chew it down. An emplacement that could
       not be destroyed would be a free tower for its whole duration. */
    const bite2 = (TILE * 0.7) * (TILE * 0.7);
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== this.side) continue;
      if (dist2(this.x, this.y, e.x, e.y) <= bite2) this.hp -= AIM_BATTERY_BITE * dt;
    }
    if (this.hp <= 0) {
      this.dead = true;
      game.spawnExplosion(this.x, this.y, TILE, o.def.color);
      Sound.play('wallBreak');
      return;
    }

    this.cool -= dt;
    if (this.cool > 0) return;
    const r2 = this.range * this.range;
    let target = null, bd = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.hostileTo !== this.side) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 <= r2 && d2 < bd) { bd = d2; target = e; }
    }
    if (!target) return;
    this.cool = 1 / this.rate;

    const crit = o.rollCrit();
    const before = o.kills;
    o.registerDamage(target.takeDamage(o.effDamage * crit.mult, o.stats.dmgType, { pierce: o.effPierce }),
                     target, game, crit.isCrit);
    /* Splash reads the owner's `effSplash`, so HEAVY ORDNANCE widens a
       broadside exactly as it widens everything else that explodes. */
    const sr = o.effSplash * TILE;
    if (sr > 0) {
      const sr2 = sr * sr;
      for (const e of game.enemies) {
        if (e === target || e.dead || e.hostileTo !== this.side) continue;
        if (dist2(target.x, target.y, e.x, e.y) > sr2) continue;
        o.registerDamage(e.takeDamage(o.effDamage * 0.6, o.stats.dmgType, { splash: true }), e, game, false, true);
      }
    }
    if (this.feed && o.kills > before) game.awardGold(this.side, this.feed * (o.kills - before), o);
    game.beams.push({ points: [{ x: this.x, y: this.y - 8 }, { x: target.x, y: target.y }],
      life: 0.09, maxLife: 0.09, color: o.def.color, width: this.kind === 'maw' ? 3.4 : 2.4 });
    Sound.play(this.kind === 'maw' ? 'siphon' : 'flak');
  }

  draw(ctx) {
    if (this.kind === 'blocker') { this.wall.draw(ctx); this.drawFuse(ctx, this.wall.x, this.wall.y); return; }
    if (this.kind === 'minefield') { for (const m of this.mines) m.draw(ctx); return; }

    const c = this.owner.def.color;
    const f = clamp(this.hp / this.maxHp, 0, 1);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.kind === 'maw' ? Math.sin(this.age * 1.6) * 0.25 : this.age * 0.7);
    ctx.fillStyle = 'rgba(8,12,20,0.88)';
    ctx.strokeStyle = c; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (this.kind === 'maw') {
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU, r = i % 2 ? 6 : 13;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    } else ctx.roundRect(-12, -12, 24, 24, 4);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - 13, this.y - 19, 26, 3);
    ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(this.x - 13, this.y - 19, 26 * f, 3);
    ctx.restore();
    this.drawFuse(ctx, this.x, this.y);
  }

  /** Remaining duration as an arc — a temporary thing must look temporary. */
  drawFuse(ctx, x, y) {
    const k = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = this.owner.def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, TILE * 0.46, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
    ctx.restore();
  }
}

/** Build the construct an aimed ability delivers, or null when the tile
    cannot host it. Only ever called after Game.canAim has passed. */
function makeAbilityConstruct(side, game, def, at) {
  if (def.lane) {
    const anchor = game.laneAnchor(side.index, at.gx, at.gy);
    if (!anchor) return null;
    return new AbilityConstruct(side, game, def, anchor.x, anchor.y, anchor);
  }
  return new AbilityConstruct(side, game, def, (at.gx + 0.5) * TILE, (at.gy + 0.5) * TILE, null);
}


/* ==========================================================================
   FACTION UNIT DOCTRINES   (roadmap 19.11)

   Four laws, one per power, hung off Enemy.prototype the way everything else
   in this file is hung off Tower.prototype -- the core simulation is not
   touched. Each fires off a DEATH and each acts on something DIFFERENT, which
   is the whole point: a Xeno send and a Federation send must not be the same
   detachment in another colour.

     HUMANITY  SALVAGE -- takes armour off ANY wreck nearby, the Vigil's too.
     FEDERATION THE VOW-- a broken ward passes to the nearest sworn survivor.
     XENO      THE MASS-- the swarm eats its own dead and grows.
     PIRATES   SCUTTLE -- dying takes the guns that killed it offline.

   The doctrine belongs to the SOLDIER and applies wherever that soldier
   stands -- in a garrison's wave as much as in a commander's send -- because
   it is what the power is, not a bonus a commander bought. Unit TALENTS are
   the opposite: they are how YOU field them, so they are applied only to
   bodies a commander actually put in a lane.
   ========================================================================== */

/** Talent-folded field stats, applied once, on the body's first frame. Only a
    SENT body is touched: a garrison's soldiers standing on a world are not
    fielded by anybody's talent screen, and letting the player's saved build
    strengthen the wave that marches at both commanders would be a difficulty
    setting rather than a doctrine. */
function applyUnitField(e) {
  if (!(e.reanimated && e.owner >= 0)) return;
  const m = unitFieldMods(e.def.id);
  if (m === UNIT_FIELD_IDENTITY) return;
  if (m.hpMul !== 1) {
    const frac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    e.maxHp = Math.max(1, Math.round(e.maxHp * m.hpMul));
    e.hp = e.maxHp * frac;
  }
  if (m.shieldMul !== 1 && e.maxShield > 0) {
    e.maxShield *= m.shieldMul;
    e.shield = e.maxShield;
  }
  if (m.armorAdd) e.armor += m.armorAdd;
  if (m.speedMul !== 1) e.baseSpeed *= m.speedMul;
  /* `regen` is a live reader in Enemy.update that until now had no writer at
     all -- one of the inert keys CONTRIBUTING names. A unit talent is its
     first. */
  if (m.regen) e.regen = Math.max(e.regen, m.regen);
  if (m.slowResistAdd) e.slowResist = Math.min(0.95, e.slowResist + m.slowResistAdd);
}

/* SALVAGE is armour, and armour is read through a getter. Extending the getter
   rather than writing `auraArmor` is deliberate: Game.recomputeAuras rebuilds
   auraArmor from scratch every frame, so anything added there is erased before
   it is ever read. */
const _totalArmorGet = Object.getOwnPropertyDescriptor(Enemy.prototype, 'totalArmor').get;
Object.defineProperty(Enemy.prototype, 'totalArmor', {
  configurable: true,
  get() { return _totalArmorGet.call(this) + (this.salvagedArmor || 0); }
});

/** Per defending side, the clock time a scuttle may next jam. A six-body
    Cutter pack dying together would otherwise chain-lock a board solid, which
    is not "changes where you kill pirates", it is "you do not have towers". */
const _scuttleReady = [];

/** A body's talent-folded doctrine coefficients, or the identity when nobody
    fielded it. The distinction matters: a garrison's soldiers are standing on
    a world, not deployed off a loadout screen, and letting the player's own
    saved build strengthen the doctrine of the troops marching AT them would
    make the talent screen a difficulty setting. */
function unitDoctrineMods(e) {
  return (e && e.reanimated && e.owner >= 0) ? unitFieldMods(e.def.id) : UNIT_FIELD_IDENTITY;
}

/**
 * One board scan per death, resolving all four doctrines together. Kept to a
 * single pass because the alternative -- a per-frame aura for SALVAGE -- costs
 * a scan per human unit per frame, and deaths are the cheaper clock.
 */
function unitDeathDoctrine(e) {
  const game = Game;
  if (!game || !game.enemies || game.enemies.length > UNIT_DOCTRINE_SCAN_CAP) return;
  const doc = unitDoctrineOf(e.def.id);
  const mine = unitDoctrineMods(e);

  /* SCUTTLE needs nothing but the corpse and a cooldown. Game.jamTowers reads
     `hostileTo` for the side and refuses jam-immune towers, so a pirate send
     obeys exactly the rules the Scrapjack's looted jammer already does. */
  if (doc && doc.id === 'scuttle') {
    const side = e.hostileTo | 0;
    /* A new match rewinds Game.clock, so a stamp from the last one would sit
       in the future and mute the doctrine for the whole battle. */
    let ready = _scuttleReady[side] || 0;
    if (ready > game.clock + UNIT_SCUTTLE_COOLDOWN) ready = 0;
    if (ready <= game.clock) {
      _scuttleReady[side] = game.clock + UNIT_SCUTTLE_COOLDOWN;
      game.jamTowers(e, { radius: UNIT_SCUTTLE_RADIUS,
                          duration: UNIT_SCUTTLE_JAM * mine.scuttleMul });
    }
  }

  const salvR2 = (UNIT_SALVAGE_RADIUS * TILE) ** 2;
  const vowR2 = (UNIT_VOW_RADIUS * TILE) ** 2;
  const massR2 = (UNIT_MASS_RADIUS * TILE) ** 2;
  let vowTarget = null, vowBest = Infinity;
  let massTarget = null, massBest = Infinity;

  for (const o of game.enemies) {
    if (o === e || o.dead || o.leaked) continue;
    /* Same LANE. A doctrine looks after the march it is on; it never reaches
       across the board into the rival's corridor. */
    if (o.hostileTo !== e.hostileTo) continue;
    const od = unitDoctrineOf(o.def.id);
    if (!od) continue;
    const d2 = dist2(e.x, e.y, o.x, o.y);

    /* SALVAGE fires off ANY death in reach -- a machine's, a rival power's,
       one of its own -- because what humanity does is bolt whatever it finds
       onto what it already has. It is the only doctrine that does not care
       whose the wreck was, and that is the whole of the character. */
    if (od.id === 'salvage' && d2 <= salvR2) {
      const gain = UNIT_SALVAGE_ARMOR * unitDoctrineMods(o).salvageMul;
      o.salvagedArmor = Math.min(UNIT_SALVAGE_CAP, (o.salvagedArmor || 0) + gain);
      if (game.spawnParticle)
        game.spawnParticle(o.x, o.y - 6, rand(-8, 8), rand(-30, -12), 0.4, 2.2, '#38e8ff', 'spark');
    }
    /* The other three are a power looking after its OWN, so they also need the
       same detachment: a garrison Votary does not inherit a sent one's ward. */
    if (!doc || o.owner !== e.owner) continue;
    if (doc.id === 'vow' && od.id === 'vow' && d2 <= vowR2 && d2 < vowBest)
      { vowBest = d2; vowTarget = o; }
    if (doc.id === 'mass' && od.id === 'mass' && d2 <= massR2 && d2 < massBest)
      { massBest = d2; massTarget = o; }
  }

  /* THE VOW. The share is of the ward the dead unit was AUTHORED with, not of
     whatever was left of it -- the vow is the whole life, given once. */
  if (vowTarget && e.maxShield > 0) {
    const pass = e.maxShield * UNIT_VOW_SHARE * mine.vowMul;
    const cap = Math.max(vowTarget.maxShield, 1) * UNIT_VOW_OVERCAP;
    vowTarget.shield = Math.min(cap, (vowTarget.shield || 0) + pass);
    vowTarget.shieldCooldown = 0;
    if (game.spawnBurst) game.spawnBurst(vowTarget.x, vowTarget.y, 8, '#fde68a', 90);
  }

  /* THE MASS. Added to CURRENT and MAXIMUM alike, so the survivor is genuinely
     bigger rather than merely topped up -- a Xeno send you clear slowly ends
     as one thing you cannot. */
  if (massTarget) {
    const meal = e.maxHp * UNIT_MASS_SHARE * unitDoctrineMods(massTarget).massMul;
    massTarget.maxHp += meal;
    massTarget.hp += meal;
    const rcap = (ENEMY_TYPES[massTarget.def.id].radius || 10) * UNIT_MASS_RADIUS_CAP;
    massTarget.radius = Math.min(rcap, massTarget.radius * (1 + UNIT_MASS_GROWTH));
    if (game.spawnBurst) game.spawnBurst(massTarget.x, massTarget.y, 10, '#a855f7', 100);
  }
}

/** A sent body that has finished its march -- killed or landed -- is what the
    profile learns a unit from. THE writer for p.towerXp[unitId]: without it
    every unit talent past the first row is a key nothing can ever reach. Only
    seat 0's sends count, because only seat 0 has a profile. */
function unitMarchDone(e) {
  if (!e.reanimated || e.owner !== 0) return;
  if (typeof UNIT_TYPES === 'undefined' || !UNIT_TYPES[e.def.id]) return;
  if (typeof Meta !== 'undefined' && Meta.addUnitXp) Meta.addUnitXp(e.def.id, UNIT_XP_PER_BODY);
}

const _enemyUpdate = Enemy.prototype.update;
Enemy.prototype.update = function (dt) {
  if (!this._unitFielded) { this._unitFielded = 1; applyUnitField(this); }
  const r = _enemyUpdate.call(this, dt);
  /* A leak is the other way a march ends, and it is set inside update. */
  if (this.leaked && !this._marchDone) { this._marchDone = 1; unitMarchDone(this); }
  return r;
};

const _enemyTakeDamage = Enemy.prototype.takeDamage;
Enemy.prototype.takeDamage = function (amount, type, opts) {
  const wasAlive = !this.dead;
  const dealt = _enemyTakeDamage.call(this, amount, type, opts);
  /* Death is decided in takeDamage and nowhere else, and revive() runs inside
     it -- so a Wrecker getting back up never reaches here, which is correct:
     it has not finished its march and it has not left a wreck. */
  if (wasAlive && this.dead && !this._doctrineSpent) {
    this._doctrineSpent = 1;
    unitDeathDoctrine(this);
    if (!this._marchDone) { this._marchDone = 1; unitMarchDone(this); }
  }
  return dealt;
};
