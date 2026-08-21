/* ==========================================================================
   COSMIC CONQUEST — Entities & Simulation
   --------------------------------------------------------------------------
   Every unit carries `hostileTo`, the side index it is marching on. Towers
   only ever engage units hostile to their own side, which is what lets both
   armies share one field without shooting each other's reinforcements.
   ========================================================================== */

'use strict';

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

function angleLerp(a, b, t) {
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function pointSegDist2(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = clamp(t, 0, 1);
  return dist2(px, py, ax + abx * t, ay + aby * t);
}
function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toLocaleString();
}

/* ------------------------------------------------------------------- PATH */

class Path {
  constructor(waypoints) {
    this.pts = waypoints.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }));
    this.segs = [];
    this.total = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) continue;
      this.segs.push({ ax: a.x, ay: a.y, ux: dx / len, uy: dy / len, len, start: this.total });
      this.total += len;
    }
  }
  posAt(d, out) {
    out = out || {};
    if (!this.segs.length) { out.x = out.y = 0; out.ux = 1; out.uy = 0; return out; }
    d = clamp(d, 0, this.total);
    let s = this.segs[this.segs.length - 1];
    for (const seg of this.segs) if (d <= seg.start + seg.len) { s = seg; break; }
    const local = clamp(d - s.start, 0, s.len);
    out.x = s.ax + s.ux * local; out.y = s.ay + s.uy * local;
    out.ux = s.ux; out.uy = s.uy;
    return out;
  }
  /** Path distance of the point on this path nearest to (x, y). */
  nearestDist(x, y) {
    let best = 0, bd = Infinity;
    for (const seg of this.segs) {
      const t = clamp(((x - seg.ax) * seg.ux + (y - seg.ay) * seg.uy), 0, seg.len);
      const d2 = dist2(x, y, seg.ax + seg.ux * t, seg.ay + seg.uy * t);
      if (d2 < bd) { bd = d2; best = seg.start + t; }
    }
    return { dist: best, d2: bd };
  }
  blockedTiles() {
    const set = new Set();
    const step = TILE * 0.25;
    for (const seg of this.segs) {
      for (let d = 0; d <= seg.len; d += step) {
        const x = seg.ax + seg.ux * d, y = seg.ay + seg.uy * d;
        for (let oy = -0.45; oy <= 0.46; oy += 0.9)
          for (let ox = -0.45; ox <= 0.46; ox += 0.9)
            set.add(Math.floor(x / TILE + ox) + ',' + Math.floor(y / TILE + oy));
      }
    }
    return set;
  }
}

/* ------------------------------------------------------------------ ENEMY */

class Enemy {
  constructor(def, path, o = {}) {
    this.def = def;
    this.type = def.id;
    this.path = path;
    this.dist = o.startDist || 0;
    this.offset = o.offset !== undefined ? o.offset : rand(-6, 6);

    /* Which side this unit is marching on, and who (if anyone) sent it. */
    this.hostileTo = o.hostileTo || 0;
    this.owner = o.owner !== undefined ? o.owner : -1;   // -1 = neutral wave
    this.reanimated = !!o.reanimated;

    /* The RESONANT FIELD share of this unit's health, carried so the corpse
       can be sent at a rival WITHOUT it. Defaults to 1, so anything built
       without one -- a muster, a charm, a revive -- is unchanged. */
    this.rageMul = o.rageMul || 1;

    this.maxHp = Math.max(1, Math.round(def.hp * (o.hpMul || 1)));
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * (o.speedMul || 1);
    this.baseArmor = def.armor || 0;
    this.armor = this.baseArmor;
    /* GOLD SQUISH lands here, AFTER the wave multiplier, for every bounty the
       game ever pays (wave, reanimate, muster, charm, revive all build an
       Enemy). Squishing the authored table first floored mites up to a whole
       gold and lengthened the fresh curve by a wave -- see ENEMIES in config. */
    this.bounty = Math.max(1, Math.round((def.bounty || 1) * (o.bountyMul || 1) / GOLD_SQUISH));
    this.livesCost = def.lives || 1;
    this.radius = def.radius || 10;
    this.flying = !!def.flying;
    this.boss = !!def.boss;

    this.maxShield = (def.shield || 0) * (o.hpMul || 1);
    this.shield = this.maxShield;
    this.shieldCooldown = 0;

    this.slowResist = def.slowResist || 0;
    this.slowCap = def.slowCap !== undefined ? def.slowCap : 0.85;
    this.pullResist = def.pullImmune ? 1 : 0;
    this.magicResist = def.magicImmune ? 1 : 0;
    /* Buffs received from nearby aura carriers, recomputed every frame. */
    this.auraSlowResist = 0; this.auraPullResist = 0; this.auraSpeed = 0; this.auraArmor = 0;
    this.auraTint = null;
    /* Elemental mark (for combos) and the recent-damage ledger (Reckoning). */
    this.markEl = null; this.markT = 0; this.comboCd = 0;
    this.nodeTile = null;                /* last tile tested for a lane node */
    this.recentDmg = 0;
    this.dotResist = 0;
    this.regen = 0;
    this.deathHeal = 0;

    /* --- disruptive abilities --- */
    this.miniboss = !!def.miniboss;
    /* Elites are wholly immune to control: no slow, no displacement, no stun. */
    this.stunImmune = false;
    if (this.boss || this.miniboss) {
      this.slowResist = 1; this.slowCap = 0;
      this.pullResist = 1; this.stunImmune = true;
    }
    this.jamTimer = def.jam ? def.jam.interval * 0.55 : 0;
    this.blinkTimer = def.teleport ? def.teleport.interval * 0.6 : 0;
    this.revivesLeft = def.revive ? 1 : 0;
    /* Phasing units alternate invulnerable/vulnerable windows. */
    this.phaseOn = false;
    this.phaseTimer = def.phase ? def.phase.off : 0;

    /* status timers (seconds) */
    this.slowFactor = 0; this.slowTimer = 0;
    this.burnDps = 0;    this.burnTimer = 0;
    this.poisonStacks = 0; this.poisonTimer = 0; this.poisonDps = 0; this.poisonPct = 0; this.poisonContagion = 0;
    this.bleedDps = 0;   this.bleedTimer = 0;
    this.freezeTimer = 0;
    this.vulnAmt = 0; this.vulnTimer = 0;
    /* Scaled down by a hostile WARD's PURGE; 1 means no field in reach. */
    this.auraDamp = 1;
    this.shredAmt = 0; this.shredTimer = 0;

    this.dead = false; this.leaked = false;
    this.flash = 0; this.age = rand(0, 10);
    this.summonTimer = def.summon ? def.summon.interval * 0.6 : 0;
    this.phaseIndex = 0; this.speedMulPhase = 1;

    /* Reanimated units are faster but markedly frailer, and a leak from one
       costs roughly half what the living unit would. Both matter: at 1:1 kills
       and full leak cost the loop runs away — whichever side is marginally
       ahead floods the other and the match is decided in the opening waves.
       Halving the pressure keeps reanimates a real threat you must answer
       without letting a small lead snowball into an instant win. */
    if (this.reanimated) {
      this.baseSpeed *= 1.45;
      this.bounty = Math.max(1, Math.round(this.bounty * 0.55));
      this.livesCost = Math.max(1, Math.ceil(this.livesCost / 2));
    }

    /* Per-wave stat drift, then the every-10-waves escalations on top. */
    if (o.drift) {
      this.maxHp *= (1 + o.drift.hp); this.hp = this.maxHp;
      this.baseSpeed *= (1 + o.drift.speed);
      this.armor += o.drift.armor;
    }
    if (o.mods) for (const m of o.mods) if (m.apply) m.apply(this);
    /* Reanimates and splits inherit armour from the unit they came from rather
       than re-running the drift/escalation chain that is already baked into
       their hpMul. */
    if (o.armorFlat !== undefined) this.armor = o.armorFlat;
    if (this.shieldRegenOverride) this.maxShield = this.maxShield || 0;

    this.x = 0; this.y = 0; this.ux = 1; this.uy = 0;
    this._p = {};
    this.updatePosition();
  }

  get remaining() { return this.path.total - this.dist; }
  get progress()  { return this.dist / this.path.total; }

  /** Resistances and armour include whatever nearby aura carriers are granting. */
  get totalSlowResist() { return Math.min(0.97, this.slowResist + this.auraSlowResist); }
  get totalPullResist() {
    /* Full immunity (elites, Wardens) is absolute — the cap only applies to
       stacked partial resistances. */
    if (this.pullResist >= 1) return 1;
    return Math.min(0.98, this.pullResist + this.auraPullResist);
  }
  get totalArmor()      { return Math.max(0, this.armor + this.auraArmor - this.shredAmt); }

  get effectiveSpeed() {
    if (this.freezeTimer > 0) return 0;
    const slow = Math.min(this.slowCap, this.slowFactor * (1 - this.totalSlowResist));
    /* Haste counters slow ADDITIVELY before it accelerates anything: a unit
       under a 100% slow with a 33% haste aura moves at a 67% slow, and only
       haste in excess of the slow becomes extra speed. Multiplying the two, as
       before, let haste keep most of its value while slowed -- which made slow
       towers feel useless against Herald packs. `dampSpeed` is a defensive
       commander ability, applied outside the slow system entirely. */
    const haste = Math.max(0, this.auraSpeed || 0);
    const slowEff = Math.max(0, slow - haste);
    const hasteEff = Math.max(0, haste - slow);
    return this.baseSpeed * this.speedMulPhase * (1 + hasteEff) * (1 - slowEff)
           * (this.dampSpeed || 1);
  }

  updatePosition() {
    this.path.posAt(this.dist, this._p);
    this.x = this._p.x - this._p.uy * this.offset;
    this.y = this._p.y + this._p.ux * this.offset;
    this.ux = this._p.ux; this.uy = this._p.uy;
  }

  /**
   * LANE NODES. Crossing one primes the unit with the node's element. Only an
   * UNMARKED unit is primed: the map assists, it must never overwrite a mark a
   * tower has just paid for. Flyers are exempt -- a feature on the ground
   * cannot reach something that never touches it. Tested once per tile change
   * rather than every frame, so a unit stalled on the tile is not re-primed.
   */
  crossNode() {
    if (this.flying || !FIELD || !FIELD.nodeMap || !FIELD.nodeMap.size) return;
    const key = Math.floor(this.x / TILE) + ',' + Math.floor(this.y / TILE);
    if (key === this.nodeTile) return;
    this.nodeTile = key;
    if (this.markT > 0) return;
    const n = FIELD.nodeMap.get(key);
    if (!n || n.kind !== 'lane') return;
    this.markEl = n.el;
    this.markT = NODE_LANE_MARK;
  }

  /* ------------------------------------------------------------ statuses */

  applySlow(f, dur) {
    if (f >= this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = Math.max(this.slowFactor, f);
      this.slowTimer = Math.max(this.slowTimer, dur);
    }
  }
  applyBurn(dps, dur, src) {
    if (dps >= this.burnDps) { this.burnDps = dps; this.burnTimer = dur; this.burnSrc = src; }
    else this.burnTimer = Math.max(this.burnTimer, dur * 0.5);
  }
  applyBleed(dps, dur, src) {
    if (dps >= this.bleedDps) { this.bleedDps = dps; this.bleedTimer = dur; this.bleedSrc = src; }
    else this.bleedTimer = Math.max(this.bleedTimer, dur * 0.5);
  }
  applyPoison(dps, pct, dur, maxStacks, contagion, src) {
    this.poisonStacks = Math.min(maxStacks, this.poisonStacks + 1);
    this.poisonTimer = dur;
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonPct = Math.max(this.poisonPct, pct);
    this.poisonContagion = Math.max(this.poisonContagion, contagion || 0);
    if (src) this.poisonSrc = src;
  }
  applyVuln(a, dur) { this.vulnAmt = Math.max(this.vulnAmt, a); this.vulnTimer = Math.max(this.vulnTimer, dur); }
  applyShred(a, dur = 4) { this.shredAmt = Math.max(this.shredAmt, a); this.shredTimer = Math.max(this.shredTimer, dur); }
  applyFreeze(dur) {
    if (this.stunImmune) return;
    this.freezeTimer = Math.max(this.freezeTimer, dur * (1 - this.slowResist));
  }

  /** Displacement. Positive `tiles` drags the unit back toward where it came from. */
  pullBack(tiles) {
    const eff = tiles * (1 - this.totalPullResist);
    if (eff <= 0) return 0;
    const before = this.dist;
    this.dist = Math.max(0, this.dist - eff * TILE);
    this.updatePosition();
    return (before - this.dist) / TILE;
  }
  /** Drags the unit toward an absolute path distance (gravity wells). */
  pullToward(targetDist, tiles) {
    /* Capped per pulse so gravity reads as a drag, never a teleport. */
    const eff = Math.min(0.85 * TILE, tiles * (1 - this.totalPullResist) * TILE);
    if (eff <= 0) return;
    const d = targetDist - this.dist;
    this.dist += clamp(d, -eff, eff);
    this.offset *= 0.85;
    this.updatePosition();
  }

  credit(tower, dealt) {
    if (!tower || dealt <= 0) return;
    tower.damageDealt += dealt;
    if (this.dead && !this._counted) { this._counted = true; tower.kills++; }
  }

  takeDamage(amount, type, opts = {}) {
    if (this.dead || amount <= 0) return 0;
    /* FEDERATION SUPPRESSION holds a target's protections open. Read here
       because takeDamage is the one place every resistance is actually spent,
       and deliberately NOT applied to armour: armour is the physical curve's
       main lever and halving it from a support tower would re-price every
       physical tower in the game. Resistances only. */
    const supp = this.suppressT > 0 ? (1 - ORIGIN_LIGHT_STRIP) : 1;
    /* Shelled mobs shrug off area damage -- splash alone stops clearing maps. */
    if (opts.splash && this.def.splashResist) amount *= (1 - this.def.splashResist * supp);
    /* A phased Wraith simply cannot be hurt — sustained damage is wasted on it. */
    if (this.phaseOn) { this.flash = 0.05; return 0; }
    amount *= (1 + this.vulnAmt);
    if (this.boss || this.miniboss) {
      const hunter = Game.sides[this.hostileTo];
      if (hunter && hunter.traits) amount *= (hunter.traits.eliteDamage || 1);
    }
    if (type === 'magic') amount *= (1 - this.magicResist * supp);
    if (opts.dot) amount *= (1 - this.dotResist * supp);

    if (this.shield > 0 && type !== 'pure') {
      this.shieldCooldown = this.def.shieldDelay || 3;
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      if (this.shield <= 0 && absorbed > 0) { Sound.play('shieldBreak'); Game.spawnBurst(this.x, this.y, 16, '#60a5fa', 150); }
      if (amount <= 0) { this.flash = 0.12; return 0; }
    }

    if (type === 'physical') {
      const armor = this.totalArmor * (1 - (opts.pierce || 0));
      amount = Math.max(amount * 0.12, amount - armor);
    }

    /* A connecting hit is never worth nothing. The floor is applied AFTER all
       mitigation (rounding beforehand distorted time-to-kill by ~15%), and
       damage-over-time ticks are exempt because they are fractional by nature. */
    if (!opts.dot && amount > 0) amount = Math.max(1, amount);

    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    this.flash = 0.1;
    this.recentDmg += dealt;
    if (opts.shred) this.applyShred(opts.shred);

    if (this.def.phases && this.phaseIndex < this.def.phases.length) {
      const ph = this.def.phases[this.phaseIndex];
      if (this.hp / this.maxHp <= ph.at) {
        this.phaseIndex++;
        this.armor = Math.max(0, this.armor + (ph.armorDelta || 0));
        this.speedMulPhase = ph.speedMul || this.speedMulPhase;
        Game.onBossPhase(this, ph);
      }
    }
    if (this.hp <= 0) {
      /* A Revenant stands back up once, at a fraction of its health. */
      if (this.revivesLeft > 0) {
        this.revivesLeft--;
        this.hp = this.maxHp * (this.def.revive || 0.45);
        this.shield = 0;
        Game.onRevive(this);
      } else { this.hp = 0; this.dead = true; }
    }
    return dealt;
  }

  update(dt) {
    this.age += dt;
    if (this.flash > 0) this.flash -= dt;

    if (this.slowTimer > 0)  { this.slowTimer -= dt;  if (this.slowTimer <= 0) this.slowFactor = 0; }
    if (this.markT > 0) { this.markT -= dt; if (this.markT <= 0) this.markEl = null; }
    if (this.suppressT > 0) this.suppressT -= dt;
    if (this.comboCd > 0) this.comboCd -= dt;
    if (this.recentDmg > 0) this.recentDmg *= Math.max(0, 1 - dt / 3);
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.vulnTimer > 0)  { this.vulnTimer -= dt;  if (this.vulnTimer <= 0) this.vulnAmt = 0; }
    if (this.shredTimer > 0) { this.shredTimer -= dt; if (this.shredTimer <= 0) this.shredAmt = 0; }

    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.credit(this.burnSrc, this.takeDamage(this.burnDps * dt, 'magic', { dot: true }));
      if (Math.random() < dt * 8) Game.spawnParticle(this.x + rand(-6, 6), this.y + rand(-6, 6),
        rand(-8, 8), rand(-38, -14), rand(0.25, 0.5), rand(2, 4), '#ff8a3d', 'fire');
      if (this.burnTimer <= 0) this.burnDps = 0;
    }
    if (this.bleedTimer > 0) {
      this.bleedTimer -= dt;
      this.credit(this.bleedSrc, this.takeDamage(this.bleedDps * dt, 'physical', { dot: true, pierce: 1 }));
      if (Math.random() < dt * 6) Game.spawnParticle(this.x + rand(-5, 5), this.y + rand(-5, 5),
        rand(-6, 6), rand(10, 40), rand(0.3, 0.55), rand(1.5, 3), '#f472b6', 'spark');
      if (this.bleedTimer <= 0) this.bleedDps = 0;
    }
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      /* Venom scales off CURRENT health, so it savages a healthy giant and
         fades to nothing as the target weakens. It softens; it never finishes. */
      const per = this.poisonDps + this.hp * this.poisonPct;
      this.credit(this.poisonSrc, this.takeDamage(per * this.poisonStacks * dt, 'pure', { dot: true }));
      if (Math.random() < dt * 6) Game.spawnParticle(this.x + rand(-7, 7), this.y + rand(-7, 7),
        rand(-6, 6), rand(-24, -6), rand(0.3, 0.6), rand(1.5, 3), '#a3e635', 'spark');
      if (this.poisonTimer <= 0) { this.poisonStacks = 0; this.poisonDps = 0; this.poisonPct = 0; }
    }

    if (this.regen > 0 && this.hp < this.maxHp && !this.dead)
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);

    if (this.maxShield > 0 && this.shield < this.maxShield) {
      if (this.shieldCooldown > 0) this.shieldCooldown -= dt;
      else this.shield = Math.min(this.maxShield,
        this.shield + (this.def.shieldRegen || this.shieldRegenOverride || 0) * dt);
    }

    if (this.def.summon && !this.dead) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) { this.summonTimer = this.def.summon.interval; Game.summonFrom(this, this.def.summon); }
    }

    if (this.dead) return;

    /* --- JAMMER: silences every tower defending against it --- */
    if (this.def.jam) {
      this.jamTimer -= dt;
      if (this.jamTimer <= 0) {
        this.jamTimer = this.def.jam.interval;
        Game.jamTowers(this, this.def.jam);
      }
    }

    /* --- BLINK: skips a chunk of lane, bypassing your killzone --- */
    if (this.def.teleport) {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = this.def.teleport.interval;
        Game.spawnBurst(this.x, this.y, 10, this.def.color, 120);
        this.dist = Math.min(this.path.total, this.dist + this.def.teleport.tiles * TILE);
        this.updatePosition();
        Game.spawnBurst(this.x, this.y, 10, this.def.color, 120);
        Sound.play('blink');
      }
    }

    /* --- WRAITH: alternating invulnerability windows --- */
    if (this.def.phase) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phaseOn = !this.phaseOn;
        this.phaseTimer = this.phaseOn ? this.def.phase.on : this.def.phase.off;
        if (this.phaseOn) Sound.play('phase');
      }
    }
    const spd = this.effectiveSpeed;
    if (spd > 0) { this.dist += spd * TILE * dt; this.updatePosition(); this.crossNode(); }
    if (this.dist >= this.path.total) this.leaked = true;
  }

  /* ---------------------------------------------------------- rendering */

  draw(ctx) {
    const c = this.def.color;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.flying) {
      ctx.save();
      ctx.globalAlpha = 0.26; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(4, 12, this.radius * 0.8, this.radius * 0.34, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.translate(0, -6 + Math.sin(this.age * 3.4) * 2);
    }

    /* Reanimated units wear a spectral halo so both armies stay readable. */
    /* "Both armies" was the two-sided reading. Game.reanimate passes
       `owner: killer` and killer runs 0..N-1 on a tri board, so a send from
       the third commander arrived wearing the second commander's rose and the
       player could not tell whose dead were walking at them. BATCH-C/nside */
    if (this.reanimated) {
      const hue = sideColor(this.owner);
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.age * 5) * 0.2;
      ctx.strokeStyle = hue; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 4.5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.16; ctx.fillStyle = hue;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 4.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* An aura carrier draws its field so you can see exactly what it protects. */
    if (this.def.aura) {
      const R = this.def.aura.radius * TILE;
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(this.age * 2) * 0.05;
      ctx.fillStyle = this.def.aura.tint;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = this.def.aura.tint; ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 6]); ctx.lineDashOffset = -this.age * 12;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    /* Anything currently buffed gets a matching halo. */
    else if (this.auraTint) {
      ctx.save();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = this.auraTint; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 3.5, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    /* Minibosses wear a rotating elite ring so they read instantly. */
    if (this.miniboss) {
      ctx.save();
      ctx.rotate(this.age * 0.9);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 7, a, a + 0.85); ctx.stroke();
      }
      ctx.restore();
    }

    const ang = Math.atan2(this.uy, this.ux);
    const hurt = this.flash > 0;
    /* Phased units render as a hollow ghost — you can see it is untouchable. */
    if (this.phaseOn) ctx.globalAlpha = 0.35;
    ctx.shadowColor = c; ctx.shadowBlur = this.boss ? 24 : this.miniboss ? 18 : 9;
    ctx.fillStyle = hurt ? '#ffffff' : c;
    ctx.strokeStyle = hurt ? '#ffffff' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;

    switch (this.def.shape) {
      case 'block':   this.drawBlock(ctx, ang); break;
      case 'chevron': this.drawChevron(ctx, ang); break;
      case 'hex':     this.drawHex(ctx, ang); break;
      case 'diamond': this.drawDiamond(ctx, ang); break;
      case 'shield':  this.drawShieldUnit(ctx, ang); break;
      case 'cross':   this.drawCross(ctx); break;
      case 'blob':    this.drawBlob(ctx); break;
      case 'jugger':  this.drawJugger(ctx, ang); break;
      case 'boss':    this.drawBoss(ctx, ang); break;
      case 'jammer':  this.drawJammer(ctx, ang); break;
      case 'blink':   this.drawBlink(ctx, ang); break;
      case 'warden':  this.drawWarden(ctx, ang); break;
      case 'wraith':  this.drawWraith(ctx, ang); break;
      case 'null':    this.drawNull(ctx, ang); break;
      case 'revenant':this.drawRevenant(ctx, ang); break;
      case 'carrier': this.drawCarrier(ctx, ang); break;
      case 'warchief':  this.drawAuraUnit(ctx, ang, '⛨'); break;
      case 'anchorite': this.drawAuraUnit(ctx, ang, '⚓'); break;
      case 'herald':    this.drawAuraUnit(ctx, ang, '»'); break;
      case 'bastion':   this.drawAuraUnit(ctx, ang, '▨'); break;
      /* Faction aura carriers reuse the machine drawing and change only
         the glyph -- their colour is already doing the identity work. */
      case 'hivelord':  this.drawAuraUnit(ctx, ang, '⁂'); break;
      case 'oriflamme': this.drawAuraUnit(ctx, ang, '☀'); break;
      case 'vanguard':  this.drawAuraUnit(ctx, ang, '⌖'); break;
      default:        this.drawDot(ctx);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (this.freezeTimer > 0) {
      ctx.strokeStyle = 'rgba(180,225,255,0.95)'; ctx.fillStyle = 'rgba(140,200,255,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU, r = this.radius * (1.35 + (i % 2 ? 0.16 : -0.06));
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (this.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(138,184,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 3, 0, TAU); ctx.stroke();
    }
    if (this.vulnTimer > 0) {
      ctx.strokeStyle = 'rgba(192,132,252,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = this.age * 5 + i * TAU / 3;
        ctx.moveTo(Math.cos(a) * (this.radius + 5), Math.sin(a) * (this.radius + 5));
        ctx.lineTo(Math.cos(a + 0.5) * (this.radius + 9), Math.sin(a + 0.5) * (this.radius + 9));
      }
      ctx.stroke();
    }
    if (this.shield > 0) {
      const f = this.shield / this.maxShield;
      ctx.strokeStyle = `rgba(96,165,250,${0.35 + f * 0.5})`;
      ctx.fillStyle = `rgba(96,165,250,${0.08 + f * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 6, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    this.drawHealthBar(ctx);
    this.drawStatusGlyphs(ctx);
  }

  drawHealthBar(ctx) {
    if (this.hp >= this.maxHp && this.shield >= this.maxShield && !this.boss) return;
    const w = this.boss ? 92 : Math.max(18, this.radius * 2.3);
    const h = this.boss ? 6 : 3.5;
    const x = this.x - w / 2;
    const y = this.y - this.radius - (this.flying ? 17 : 10) - (this.boss ? 8 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const f = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = f > 0.55 ? '#4ade80' : f > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(x, y, w * f, h);
    if (this.maxShield > 0) {
      ctx.fillStyle = 'rgba(96,165,250,0.95)';
      ctx.fillRect(x, y - h - 2, w * clamp(this.shield / this.maxShield, 0, 1), h - 0.8);
    }
    const armorNow = Math.max(0, this.armor - this.shredAmt);
    if (armorNow > 0) {
      ctx.fillStyle = this.shredAmt > 0 ? '#f87171' : '#cbd5e1';
      const pips = Math.min(8, Math.ceil(armorNow / 4));
      for (let i = 0; i < pips; i++) ctx.fillRect(x + i * 4.5, y + h + 2, 2.6, 2);
    }
    if (this.poisonStacks > 0) {
      ctx.fillStyle = '#a3e635'; ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('☠' + this.poisonStacks, x + w + 3, y + h);
    }
  }

  /**
   * Status and elemental state, drawn ON the unit.
   *
   * The elemental mark was previously invisible: nothing in any draw routine
   * referenced `markEl`, so a player had no way to know a unit was primed for a
   * reaction, and therefore no way to learn that overlapping two different
   * elements is what triggers one. Each state gets a distinct GLYPH as well as a
   * colour, so the information survives colour-blindness.
   */
  drawStatusGlyphs(ctx) {
    const g = [];
    if (this.markEl && this.markT > 0) {
      const el = ELEMENTS[this.markEl];
      if (el) g.push({ ch: el.icon, col: el.color, ring: true });
    }
    if (this.burnTimer > 0)   g.push({ ch: '♨', col: '#ff8a3d' });
    if (this.slowTimer > 0)   g.push({ ch: '❄', col: '#8ab8ff' });
    if (this.freezeTimer > 0) g.push({ ch: '✳', col: '#bfdbfe' });
    if (this.vulnAmt > 0)     g.push({ ch: '⊕', col: '#fca5a5' });
    if (!g.length) return;

    /* Drawn from a cached atlas rather than composed per frame. Measured at 76
       status-carrying units, the naive version (arc fill + optional stroke +
       fillText, each with its own path) cost 2.5 ms of a 16.7 ms budget. */
    const gy = Math.round(this.y - this.radius - (this.flying ? 24 : 17) - (this.boss ? 10 : 0));
    const total = g.length * 13;
    for (let i = 0; i < g.length; i++) {
      const tile = Enemy.glyphTile(g[i]);
      ctx.drawImage(tile, Math.round(this.x - total / 2 + i * 13) - 7, gy - 7);
    }
  }

  /** One 14x14 tile per (glyph, colour, ring) triple, built once and reused. */
  static glyphTile(spec) {
    const key = spec.ch + spec.col + (spec.ring ? '1' : '0');
    let tile = Enemy._glyphs[key];
    if (tile) return tile;
    tile = document.createElement('canvas');
    tile.width = tile.height = 14;
    const c = tile.getContext('2d');
    c.fillStyle = 'rgba(4,8,14,0.78)';
    c.beginPath(); c.arc(7, 7, 6.5, 0, TAU); c.fill();
    if (spec.ring) {
      c.strokeStyle = spec.col; c.lineWidth = 1.6;
      c.beginPath(); c.arc(7, 7, 6, 0, TAU); c.stroke();
    }
    c.fillStyle = spec.col;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 11px ui-monospace, monospace';
    c.fillText(spec.ch, 7, 7.5);
    Enemy._glyphs[key] = tile;
    return tile;
  }

  drawBlock(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.roundRect(-r, -r * 0.8, r * 2, r * 1.6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(r * 0.2, -r * 0.35, r * 0.6, r * 0.7);
    ctx.restore();
  }
  drawChevron(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(-r * 0.6, -r); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(-r * 0.6, r);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  drawDot(ctx) {
    const r = this.radius;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); ctx.fill();
  }
  drawHex(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU; i ? ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r) : ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  drawDiamond(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.globalAlpha = 0.6;
    const flap = Math.sin(this.age * 11) * 0.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.4, -r * (1.1 + flap)); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 1.4, r * (1.1 + flap));
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, -r * 0.85); ctx.lineTo(-r * 0.7, 0); ctx.lineTo(0, r * 0.85);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  drawShieldUnit(ctx, a) {
    const r = this.radius;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(a); ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 0.25, -r * 0.7); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(r * 0.25, r * 0.7);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  drawCross(ctx) {
    const r = this.radius;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-r * 0.18, -r * 0.6, r * 0.36, r * 1.2);
    ctx.fillRect(-r * 0.6, -r * 0.18, r * 1.2, r * 0.36);
    const p = (this.age * 0.85) % 1;
    ctx.strokeStyle = `rgba(52,211,153,${(1 - p) * 0.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, (this.def.healRadius || 2) * TILE * p, 0, TAU); ctx.stroke();
  }
  drawBlob(ctx) {
    const r = this.radius;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * TAU, rr = r * (1 + Math.sin(t * 3 + this.age * 3) * 0.13);
      i ? ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 3; i++) {
      const t = this.age * 1.4 + i * TAU / 3;
      ctx.beginPath(); ctx.arc(Math.cos(t) * r * 0.4, Math.sin(t) * r * 0.4, r * 0.22, 0, TAU); ctx.fill();
    }
  }
  drawJugger(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU; i ? ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r * 0.85) : ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r * 0.85); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(20,25,35,0.75)'; ctx.fillRect(-r * 0.75, -r * 0.5, r * 1.5, r);
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(r * 0.25, -r * 0.16, r * 0.5, r * 0.32);
    ctx.restore();
  }
  /* ---- disruptive archetypes: each silhouette states its threat ---- */

  drawJammer(ctx, a) {
    const r = this.radius;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill(); ctx.stroke();
    /* broadcast dish + expanding jam pulse */
    ctx.strokeStyle = this.def.color; ctx.lineWidth = 2;
    const charge = 1 - clamp(this.jamTimer / (this.def.jam.interval || 6), 0, 1);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = charge * (1 - i / 4);
      ctx.beginPath(); ctx.arc(0, 0, r * (0.9 + i * 0.42), -0.9, 0.9); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.5, -r * 0.9, 3, r * 0.8);
  }

  drawBlink(ctx, a) {
    const r = this.radius;
    /* after-images trailing the last jump */
    const t = 1 - clamp(this.blinkTimer / (this.def.teleport.interval || 4), 0, 1);
    ctx.save(); ctx.rotate(a);
    for (let i = 2; i >= 0; i--) {
      ctx.globalAlpha = i === 0 ? 1 : 0.18 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(r - i * 7, 0); ctx.lineTo(-r * 0.6 - i * 7, -r * 0.8);
      ctx.lineTo(-r * 0.6 - i * 7, r * 0.8); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawWarden(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    /* an anchored, braced block — visually immovable */
    ctx.beginPath(); ctx.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.85); ctx.lineTo(r * 0.85, r * 0.85);
    ctx.moveTo(r * 0.85, -r * 0.85);  ctx.lineTo(-r * 0.85, r * 0.85);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('⚓', 0, 3); ctx.textAlign = 'left';
  }

  drawWraith(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    for (let i = 1; i < 7; i++) {
      const t = (i / 7) * TAU;
      const rr = r * (0.8 + Math.sin(t * 2 + this.age * 4) * 0.22);
      ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (this.phaseOn) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawNull(ctx, a) {
    const r = this.radius;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
    /* a null-sign slash: the anti-magic marker */
    ctx.strokeStyle = '#0b1a18'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.6); ctx.lineTo(r * 0.6, -r * 0.6); ctx.stroke();
    ctx.strokeStyle = this.def.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.15, this.age, this.age + 2.2); ctx.stroke();
  }

  drawRevenant(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * TAU - Math.PI / 2;
      i ? ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r) : ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    /* an unspent revive shows as a lit pip */
    ctx.fillStyle = this.revivesLeft > 0 ? '#4ade80' : 'rgba(80,90,100,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
  }

  drawCarrier(ctx, a) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, TAU); ctx.fill(); ctx.stroke();
    /* visible brood pods that pulse before each spawn */
    const p = 1 - clamp(this.summonTimer / (this.def.summon.interval || 4), 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + p * 0.6})`;
    for (let i = 0; i < 3; i++) {
      const t = (i / 3) * TAU + this.age * 0.7;
      ctx.beginPath(); ctx.arc(Math.cos(t) * r * 0.45, Math.sin(t) * r * 0.35, r * 0.19, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /** Aura carriers: a banner-bearer silhouette with a visible field ring. */
  drawAuraUnit(ctx, a, glyph) {
    const r = this.radius;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TAU;
      i ? ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r * 0.9)
        : ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r * 0.9);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    /* standard raised above it */
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, -r * 1.9); ctx.stroke();
    ctx.fillStyle = '#0b1220';
    ctx.beginPath(); ctx.arc(0, -r * 1.9, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = this.def.color;
    ctx.font = 'bold 10px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(glyph, 0, -r * 1.9 + 3.5); ctx.textAlign = 'left';
  }

  drawBoss(ctx, a) {
    const r = this.radius, rage = this.phaseIndex;
    ctx.save(); ctx.rotate(-this.age * (0.5 + rage * 0.35));
    ctx.strokeStyle = rage >= 2 ? '#ff2d2d' : '#ef4444'; ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, t, t + 0.62); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.rotate(this.age * (0.8 + rage * 0.4));
    ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { const t = (i / 4) * TAU; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, t, t + 0.9); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU, rr = r * (i % 2 ? 0.62 : 0.8); i ? ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    const pulse = 0.6 + Math.sin(this.age * (4 + rage * 3)) * 0.4;
    ctx.fillStyle = `rgba(255,${180 - rage * 60},${180 - rage * 70},${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, TAU); ctx.fill();
  }
}

/* ------------------------------------------------------------------ DRONE */

/** An autonomous gunship owned by a Drone Bay. Hunts inside the bay's radius. */
class Drone {
  constructor(bay, i, n) {
    this.bay = bay;
    this.angle = (i / n) * TAU;
    this.x = bay.x + Math.cos(this.angle) * 26;
    this.y = bay.y + Math.sin(this.angle) * 26;
    this.cd = rand(0, 1);
    this.facing = 0;
    this.bob = rand(0, TAU);
  }
  update(dt, game) {
    const b = this.bay;
    const s = b.stats;
    const speed = (s.droneSpeed || 4) * TILE;
    const target = b.acquire(game.enemies, b.rangePx);

    let tx, ty;
    if (target) { tx = target.x; ty = target.y; }
    else {
      /* Idle: orbit the bay so the drones read as "on station". */
      this.angle += dt * 0.8;
      tx = b.x + Math.cos(this.angle) * 30;
      ty = b.y + Math.sin(this.angle) * 30;
    }

    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const stop = target ? TILE * 1.15 : 4;
    if (d > stop) {
      this.x += (dx / d) * Math.min(speed * dt, d - stop);
      this.y += (dy / d) * Math.min(speed * dt, d - stop);
    }
    this.facing = angleLerp(this.facing, Math.atan2(dy, dx), Math.min(1, dt * 12));
    this.bob += dt * 6;

    this.cd -= dt;
    if (target && this.cd <= 0 && d < TILE * 2.2) {
      this.cd = 1 / ((s.droneRate || 1.4) * b.rateMul);
      let dmg = b.effDamageFor(s.droneDamage || 10);
      if (target.flying && s.airBonus) dmg *= s.airBonus;
      const crit = b.rollCrit();
      const dealt = target.takeDamage(dmg * crit.mult, s.dmgType, { pierce: b.effPierce });
      b.registerDamage(dealt, target, game, crit.isCrit);
      game.beams.push({ points: [{ x: this.x, y: this.y }, { x: target.x, y: target.y }],
        life: 0.09, maxLife: 0.09, color: b.def.color, width: 1.8, jagged: false });
      Sound.play('bolt');
    }
  }
  draw(ctx) {
    const c = this.bay.def.color;
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.bob) * 1.4);
    ctx.rotate(this.facing);
    ctx.shadowColor = c; ctx.shadowBlur = 8;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -4.2); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, 4.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(1.5, 0, 1.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------- MINE */

class Mine {
  constructor(tower, x, y) {
    this.tower = tower; this.x = x; this.y = y;
    this.arm = 0.45;            // brief arming delay so mines can't insta-pop
    this.age = 0;
    this.dead = false;
    this.trigger = TILE * 0.55;
  }
  update(dt, game) {
    this.age += dt;
    if (this.arm > 0) { this.arm -= dt; return; }
    const t2 = this.trigger * this.trigger;
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== this.tower.side) continue;
      if (dist2(this.x, this.y, e.x, e.y) <= t2) { this.detonate(game); return; }
    }
  }
  detonate(game) {
    this.dead = true;
    const t = this.tower, s = t.stats;
    const r = t.effSplash * TILE;
    Sound.play('explosion', 0.9);
    game.shake(3);
    game.spawnExplosion(this.x, this.y, r, t.def.color);
    const r2 = r * r;
    for (const e of game.enemies) {
      if (e.dead || e.flying || e.hostileTo !== t.side) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > r2) continue;
      const falloff = 1 - 0.5 * (Math.sqrt(d2) / r);
      const crit = t.rollCrit();
      const dealt = e.takeDamage(t.effDamage * falloff * crit.mult, s.dmgType, { pierce: t.effPierce, splash: true });
      t.registerDamage(dealt, e, game, crit.isCrit);
      if (s.stun) e.applyFreeze(s.stun * t.effStatus);
    }
  }
  draw(ctx) {
    const c = this.tower.def.color;
    const armed = this.arm <= 0;
    const p = 0.5 + Math.sin(this.age * (armed ? 5 : 14)) * 0.5;
    ctx.save();
    ctx.globalAlpha = armed ? 1 : 0.5;
    ctx.fillStyle = 'rgba(10,14,22,0.9)';
    ctx.strokeStyle = c; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(this.x, this.y, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c; ctx.globalAlpha = (armed ? 0.5 : 0.25) + p * 0.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
}


/* Status-glyph tile cache, shared by every enemy. */
Enemy._glyphs = Object.create(null);

/* ------------------------------------------------------------------ TOWER */

class Tower {
  constructor(type, gx, gy, side) {
    this.def = TOWER_TYPES[type];
    this.type = type;
    this.side = side;
    this.gx = gx; this.gy = gy;
    this.x = (gx + 0.5) * TILE;
    this.y = (gy + 0.5) * TILE;

    this.level = 1;
    this.branch = null;
    this.asc = 0;                    // ascension tiers beyond the branch
    this.rolls = [];                 // random minor buffs, one per level-up
    this.jamTimer = 0;
    this.invested = this.def.cost;

    this.targetMode = this.def.base.preferStrongest ? 'strong' : 'first';
    this.cooldown = 0;
    /* The resting bearing, before this tower has ever had a target. Two bases
       face each other across a duel board, so east/west is the whole answer
       there and the literals are kept exactly. On a ring of twenty seats it
       pointed every gun at nothing; those boards face the maw that everything
       walks out of instead. BATCH-C/nside */
    this.angle = (typeof FIELD !== 'undefined' && FIELD && FIELD.tri && FIELD.spawn)
      ? Math.atan2((FIELD.spawn[1] + 0.5) * TILE - this.y, (FIELD.spawn[0] + 0.5) * TILE - this.x)
      : (side === 0 ? 0 : Math.PI);
    this.recoil = 0; this.firing = false;
    this.age = rand(0, 6);

    /* per-mechanic state */
    this.mines = [];
    this.mineTimer = 0;
    this.drones = [];
    this.focusTarget = null; this.focusTime = 0;
    this.incomeTimer = 0;
    this.drainMeter = 0; this.drainCd = 0;
    this.puddleTimer = 0;
    /* SABOTEUR CASCADE: a rate debuff that outlives the blackout itself. */
    this.sabLingerAmt = 0; this.sabLingerT = 0;

    this.kills = 0; this.damageDealt = 0; this.goldMade = 0; this.livesRestored = 0;
    this.aura = { dmg: 0, rate: 0, range: 0 };
    this.recompute();
  }

  /* ------------------------------------------------------------- stats */

  /**
   * Applies a technology option. Keys ending in `Mul` multiply the matching
   * base stat; everything else adds. `statusMul` is the one special case — it
   * scales this tower's status effects rather than a stat of its own.
   */
  applyTech(s, mods) {
    for (const k in mods) {
      const v = mods[k];
      if (k === 'statusMul') { s.techStatus = (s.techStatus || 1) * v; }
      else if (k.endsWith('Mul')) { const base = k.slice(0, -3); s[base] = (s[base] || 0) * v; }
      else if (typeof v === 'boolean') { s[k] = v; }
      else if (STAT_CEIL[k] !== undefined) { s[k] = Math.min(STAT_CEIL[k], (s[k] || 0) + v); }
      else { s[k] = (s[k] || 0) + v; }
    }
  }

  recompute() {
    const S = Game.sides && Game.sides[this.side];
    const traits = (S && S.traits) || null;
    const s = Object.assign({ techStatus: 1 }, this.def.base);
    for (let i = 0; i < this.level - 1 && i < this.def.levels.length; i++)
      Object.assign(s, this.def.levels[i].mods);

    /* Branch first, then the modifiers that layer on top of whatever it set.
       Talents were prepared before the match; rolls were granted on level-up. */
    if (this.branch) Object.assign(s, this.branch.mods);

    const talents = (S && S.talentSets && S.talentSets[this.type]) || [];
    for (const t of talents) {
      /* A talent sleeps until its tier is reached: row 0 at tier 1, row 1 at
         tier 2, row 2 at tier 3. */
      if (this.level < (t.row || 0) + 1) continue;
      this.applyTech(s, t.mods);
    }
    for (const r of this.rolls) this.applyTech(s, r.mods);

    /* SURGE every N ascensions — N and strength are commander-dependent. */
    const surgeEvery = traits ? traits.surgeEvery : ASCENSION.surgeEvery;
    const surgeMul = traits ? traits.surgeMul : 1;
    const surges = Math.floor(this.asc / surgeEvery);
    if (surges > 0 && this.branch && this.branch.surge)
      for (const k in this.branch.surge) s[k] = (s[k] || 0) + this.branch.surge[k] * surges * surgeMul;

    /* BUILD NODES. The tile decides which of three things it grants: a matched
       element is sharpened, a tower that marks NOTHING of its own is lent the
       node's element -- which is where the map enters the combo table -- and a
       marking tower of some other element holds its own charge longer instead.
       Read here so relocation and base-level retrofits pick it up for free;
       both already recompute. */
    const node = nodeAt(this.gx, this.gy, 'build');
    this.node = node;
    this.nodeEl = null; this.nodeAttuned = false; this.nodeHold = false;
    if (node) {
      const own = ELEMENTS[this.def.element];
      /* HUMAN origin -- ADAPTIVE MOUNTS. Humanity's whole thesis is bolting
         alien hardware onto its own frames, so a human tower attunes to ANY
         node rather than only a matched one. It still takes the infusion or
         the hold on a mismatched node, because adapting to the tile is the
         identity and taking only half of it would read as a rounding error. */
      const adaptive = ORIGIN_HUMAN_ANY_NODE && this.def.origin === 'human';
      if (node.el === this.def.element || adaptive) {
        this.nodeAttuned = true;
        for (const k of ['damage', 'droneDamage', 'burn', 'poisonDps', 'minionDps'])
          if (s[k]) s[k] *= NODE_ATTUNE_DAMAGE;
      }
      if (node.el !== this.def.element) {
        if (!own || !own.marks) this.nodeEl = node.el;
        else this.nodeHold = true;
      }
    }

    /* ROBOTIC origin -- LATTICE. The link COUNT is produced by
       Game.recomputeAuras, which already walks every tower on both sides and
       already ends by recomputing each of them; it is merely read here. That
       ordering is why relocation, sale and base-level retrofits all pick up a
       new count for free -- every one of them recomputes auras. */
    const links = (this.def.origin === 'robotic')
      ? Math.max(0, Math.min(ORIGIN_LATTICE_MAX, this.latticeRaw || 0)) : 0;
    this.lattice = links;
    if (links > 0) {
      const dm = 1 + ORIGIN_LATTICE_DAMAGE * links;
      for (const k of ['damage', 'droneDamage', 'burn', 'poisonDps', 'minionDps',
                       'wallThorns', 'dropDmg', 'income'])
        if (s[k]) s[k] *= dm;
      if (s.rate) s.rate *= 1 + ORIGIN_LATTICE_RATE * links;
    }

    this.stats = s;
    const ascDmg = traits ? traits.ascDamage : ASCENSION.damage;
    this.ascDamage = Math.pow(ascDmg, this.asc);
    this.ascRate   = Math.pow(ASCENSION.rate,   this.asc);
    this.ascRange  = Math.pow(ASCENSION.range,  this.asc);

    /* Drone count can change on upgrade — rebuild the flight. */
    if (this.def.attack === 'drones') {
      const want = s.drones || 0;
      while (this.drones.length > want) this.drones.pop();
      while (this.drones.length < want) this.drones.push(new Drone(this, this.drones.length, want));
    }
  }

  get sideMods() { return Game.sides[this.side].mods; }
  get traits()   { return Game.sides[this.side].traits; }

  /** Commander-derived damage scaling that is not part of the tower itself. */
  get commanderDamage() {
    const S = Game.sides[this.side], t = S.traits;
    if (!t) return 1;
    /* Commander abilities are a transient multiplier on top of everything else,
       read live so activating one is felt on the very next shot. */
    let m = (S.pulse && S.pulse.damage) || 1;
    if (t.perModDamage) m += t.perModDamage * S.taken.length;
    if (t.perAscDamage) m += t.perAscDamage * (S.totalAsc || 0);
    if (t.lastStandAt && S.lives / S.maxLives <= t.lastStandAt) m += t.lastStandDmg;
    /* INSATIABLE: 1% per 20 kills THIS tower made, without limit. */
    if (t.killRamp) m += t.killRamp * this.kills;
    return m;
  }

  get tier() { return this.branch ? 4 + this.asc : this.level; }
  get tierName() {
    /* A tower placed by a high base level can carry ascensions BEFORE its
       specialisation is chosen -- the branch is owed, not yet picked. */
    if (this.asc > 0 && this.branch) return this.branch.name + ' +' + this.asc;
    if (this.asc > 0) return 'MK III +' + this.asc + ' — CHOOSE SPECIALISATION';
    if (this.branch) return this.branch.name;
    return this.level === 1 ? 'MK I' : this.def.levels[this.level - 2].name;
  }
  get isSupport() { return this.def.attack === 'aura' || this.def.attack === 'economy'; }

  get rateMul() {
    const t = this.traits;
    const deep = (t && t.ascendBonusRate && this.asc >= 3) ? (1 + t.ascendBonusRate) : 1;
    const S = Game.sides[this.side];
    const pulse = (S && S.pulse && S.pulse.rate) || 1;
    /* CASCADE's lingering sabotage. In rateMul rather than effRate so the
       drone cadence (which reads rateMul directly) is slowed too. */
    const sab = 1 - (this.sabLingerAmt || 0);
    return (1 + this.aura.rate) * this.ascRate * this.sideMods.rate * deep * pulse * sab;
  }
  get effDamage() {
    const alch = (this.alchStacks || 0) * ((this.stats.transmute || 0) * (this.stats.transmuteMul || 1));
    return ((this.stats.damage || 0) + alch) * (1 + this.aura.dmg) * this.ascDamage * this.sideMods.damage * this.commanderDamage * GLOBAL_DAMAGE_TUNE;
  }
  effDamageFor(v) { return v * (1 + this.aura.dmg) * this.ascDamage * this.sideMods.damage * this.commanderDamage * GLOBAL_DAMAGE_TUNE; }
  get effRate()   { return (this.stats.rate || 1) * this.rateMul; }
  get effRange()  { const S = Game.sides[this.side];
                    return (this.stats.range || 1) * (1 + this.aura.range) * this.ascRange * this.sideMods.range
                           * ((S && S.pulse && S.pulse.range) || 1); }
  get rangePx()   { return this.effRange * TILE; }
  get effSplash() { return (this.stats.splash || 0) * this.sideMods.splash; }
  get effPierce() { return Math.min(0.95, (this.stats.pierce || 0) + this.sideMods.pierce); }
  get effStatus() { return this.sideMods.status * (this.stats.techStatus || 1); }
  get jammed()    { return this.jamTimer > 0; }

  /** Combines the tower's own crit with the side's CRITICAL DOCTRINE stacks. */
  rollCrit() {
    const chance = (this.stats.crit || 0) + this.sideMods.crit;
    if (chance > 0 && Math.random() < chance) {
      const mult = Math.max(this.stats.critMult || 0, 2.5);
      return { isCrit: true, mult };
    }
    return { isCrit: false, mult: 1 };
  }

  /** Granted automatically on each level-up — no decision, just a small boon. */
  addRoll() {
    const roll = LEVEL_ROLLS[Math.floor(Math.random() * LEVEL_ROLLS.length)];
    this.rolls.push(roll);
    this.recompute();
    return roll;
  }

  /** The next purchasable step. Ascension is unlimited, so this never returns null. */
  nextUpgrade() {
    if (this.level < 3) return { kind: 'level', data: this.def.levels[this.level - 1], cost: this.def.levels[this.level - 1].cost };
    if (this.level === 3 && !this.branch) return { kind: 'branch', data: this.def.branches };
    /* Measured against the price actually PAID for the specialisation, so the
       first ascension genuinely costs more than twice the step before it. */
    const paidBranch = this.branch.cost * UPGRADE_COST_SCALE;
    return { kind: 'ascend', cost: ascendCost(paidBranch, this.asc) };
  }
  upgradeCost(kind, raw) {
    /* A specialisation owed by the base level was already paid for WITH that
       base level, so its price is zero -- and the price has to be zero for
       every consumer, not just the one that takes the gold. This rule lived
       in three places (Game.upgrade, the inspector, the rival's scorer) and
       the rival's copy never learnt it, so the AI priced a free branch at
       75-135 gold, dropped it through its own `cost > gold * 1.8` gate and
       scored it against a denominator the engine does not charge. One
       definition, three readers. BATCH-A/numbers */
    if (kind === 'branch' && this.pendingBranch) return 0;
    const t = this.traits;
    let c = raw * this.sideMods.upCost;
    if (kind === 'ascend') c *= (t ? t.ascCostMul : 1);
    else c *= UPGRADE_COST_SCALE;
    return Math.max(1, Math.round(c));
  }
  get sellValue() { return Math.floor(this.invested * Game.sides[this.side].mods.sellRate); }

  estimateDps() {
    const s = this.stats;
    if (this.isSupport) return 0;
    const a = this.def.attack;
    if (a === 'cone') return this.effDamage + (s.burn || 0);
    if (a === 'beam') return this.effDamage * (1 + (s.rampMax || 1) * 0.5) * (s.split || 1);
    if (a === 'mines') return this.effDamage * (s.maxMines || 1) / Math.max(3, (s.mineDelay || 3) * (s.maxMines || 1) * 0.5);
    if (a === 'drones') return this.effDamageFor(s.droneDamage || 0) * (s.droneRate || 1) * (s.drones || 0) * this.rateMul;
    if (a === 'gravity') return this.effDamage * this.effRate * 3;
    let d = this.effDamage * this.effRate;
    if (s.multishot) d *= s.multishot;
    if (s.submunitions) d *= s.submunitions;
    if (s.chains) { let m = 0, c = 1; for (let i = 0; i < s.chains; i++) { m += c; c *= (s.falloff || 0.75); } d = this.effDamage * m * this.effRate; }
    const crit = (s.crit || 0) + this.sideMods.crit;
    if (crit > 0) d *= (1 + crit * (Math.max(s.critMult || 0, 2.5) - 1));
    if (s.poisonDps) d += s.poisonDps * (s.maxStacks || 1) * 0.6 * this.effStatus;
    if (s.bleed) d += s.bleed * this.effStatus;
    return d;
  }

  /* --------------------------------------------------------- targeting */

  /** Only ever returns units hostile to THIS tower's side. */
  acquire(enemies, rangeOverride) {
    const R = rangeOverride || this.rangePx;
    const r2 = R * R;
    const groundOnly = this.def.groundOnly, airOnly = this.def.airOnly;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.leaked || e.hostileTo !== this.side) continue;
      if (groundOnly && e.flying) continue;
      if (airOnly && !e.flying) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > r2) continue;
      let score;
      switch (this.targetMode) {
        case 'last':   score = e.remaining; break;
        case 'strong': score = e.hp + e.shield; break;
        case 'weak':   score = -(e.hp + e.shield); break;
        case 'close':  score = -d2; break;
        default:       score = -e.remaining;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /** All hostile units within range — used by area mechanics. */
  acquireAll(enemies, rangeOverride) {
    const R = rangeOverride || this.rangePx, r2 = R * R;
    const out = [];
    for (const e of enemies) {
      if (e.dead || e.hostileTo !== this.side) continue;
      if (this.def.groundOnly && e.flying) continue;
      if (this.def.airOnly && !e.flying) continue;
      if (dist2(this.x, this.y, e.x, e.y) <= r2) out.push(e);
    }
    return out;
  }

  predict(target, projSpeed) {
    if (!projSpeed) return { x: target.x, y: target.y };
    const t = Math.hypot(target.x - this.x, target.y - this.y) / (projSpeed * TILE);
    const spd = target.effectiveSpeed * TILE;
    return { x: target.x + target.ux * spd * t, y: target.y + target.uy * spd * t };
  }

  /* ------------------------------------------------------------ update */

  update(dt, game) {
    this.age += dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.sabLingerT > 0) {
      this.sabLingerT -= dt;
      if (this.sabLingerT <= 0) this.sabLingerAmt = 0;
    }

    /* A jammed tower is completely offline. Economy keeps ticking — Jammers
       silence weapons, they do not seize the treasury. */
    if (this.jamTimer > 0) {
      this.jamTimer -= dt;
      this.firing = false;
      if (this.def.attack !== 'economy') return;
    }

    const ext = this['atk_' + this.def.attack];
    if (ext) return ext.call(this, dt, game);

    switch (this.def.attack) {
      case 'aura':    return;
      case 'economy': return this.updateEconomy(dt, game);
      case 'mines':   return this.updateMines(dt, game);
      case 'drones':  return this.updateDrones(dt, game);
      case 'gravity': return this.updateGravity(dt, game);
      case 'beam':    return this.updateBeam(dt, game);
      case 'cone':    return this.updateCone(dt, game);
    }

    const target = this.acquire(game.enemies);
    if (target) {
      const aim = (this.def.attack === 'lobbed' || this.def.attack === 'projectile' || this.def.attack === 'tether')
        ? this.predict(target, this.stats.projSpeed) : target;
      this.angle = angleLerp(this.angle, Math.atan2(aim.y - this.y, aim.x - this.x), Math.min(1, dt * 14));
    }
    this.cooldown -= dt;
    if (target && this.cooldown <= 0) { this.cooldown = 1 / this.effRate; this.fire(target, game); }
  }

  fire(target, game) {
    this.recoil = 1;
    switch (this.def.attack) {
      case 'projectile': this.fireProjectile(target, game); break;
      case 'lobbed':     this.fireLobbed(target, game); break;
      case 'chain':      this.fireChain(target, game); break;
      case 'hitscan':    this.fireHitscan(target, game); break;
      case 'tether':     this.fireTether(target, game); break;
    }
  }

  /* ------------------------------------------------------- attack types */

  fireProjectile(target, game) {
    const s = this.stats;
    const shots = s.multishot || 1;
    Sound.play(this.type === 'toxin' ? 'toxin' : this.type === 'cryo' ? 'cryo'
             : this.type === 'flak' ? 'flak' : this.type === 'siphon' ? 'siphon' : 'bolt');
    for (let i = 0; i < shots; i++) {
      const off = shots === 1 ? 0 : (i - (shots - 1) / 2) * (s.spread || 0.2);
      game.projectiles.push(new Projectile({
        x: this.x + Math.cos(this.angle) * 15, y: this.y + Math.sin(this.angle) * 15,
        angle: this.angle + off, speed: (s.projSpeed || 12) * TILE,
        damage: this.effDamage, dmgType: s.dmgType, splash: this.effSplash,
        pierce: this.effPierce, pierceCount: s.pierceCount || 0, shred: s.shred || 0,
        target: (shots === 1 || s.homing) ? target : null,
        tower: this, color: this.def.color, radius: 4,
        airOnly: !!this.def.airOnly, groundOnly: !!this.def.groundOnly, side: this.side
      }));
    }
  }

  fireLobbed(target, game) {
    const s = this.stats;
    Sound.play('mortar');
    const n = s.submunitions || 1;
    const aim = this.predict(target, s.projSpeed);
    for (let i = 0; i < n; i++) {
      const sc = n > 1 ? (s.scatter || 1.2) * TILE : 0;
      const a = (i / n) * TAU + rand(0, 1);
      game.projectiles.push(new Projectile({
        x: this.x, y: this.y, lobbed: true,
        tx: aim.x + (n > 1 ? Math.cos(a) * rand(sc * 0.3, sc) : 0),
        ty: aim.y + (n > 1 ? Math.sin(a) * rand(sc * 0.3, sc) : 0),
        speed: (s.projSpeed || 8) * TILE, damage: this.effDamage, dmgType: s.dmgType,
        splash: this.effSplash || 1, pierce: this.effPierce, stun: (s.stun || 0) * this.effStatus,
        tower: this, color: this.def.color, radius: n > 1 ? 4 : 6, groundOnly: true, side: this.side
      }));
    }
  }

  fireChain(target, game) {
    const s = this.stats;
    Sound.play('arc');
    const cr = (s.chainRange || 2.2) * TILE, cr2 = cr * cr;
    const hit = new Set();
    const points = [{ x: this.x, y: this.y - 8 }];
    let cur = target, dmg = this.effDamage;
    for (let i = 0; i < (s.chains || 1) && cur; i++) {
      hit.add(cur);
      points.push({ x: cur.x, y: cur.y });
      const crit = this.rollCrit();
      this.registerDamage(cur.takeDamage(dmg * crit.mult, s.dmgType, { pierce: this.effPierce }), cur, game, crit.isCrit);
      if (s.vuln) cur.applyVuln(s.vuln * this.effStatus, (s.vulnDur || 2) * this.effStatus);
      game.spawnBurst(cur.x, cur.y, 4, this.def.color, 55);
      dmg *= (s.falloff || 0.75);
      let next = null, bd = Infinity;
      for (const e of game.enemies) {
        if (e.dead || hit.has(e) || e.hostileTo !== this.side) continue;
        const d2 = dist2(cur.x, cur.y, e.x, e.y);
        if (d2 < cr2 && d2 < bd) { bd = d2; next = e; }
      }
      cur = next;
    }
    game.beams.push({ points, life: 0.16, maxLife: 0.16, color: this.def.color, width: 3, jagged: true });
  }

  fireHitscan(target, game) {
    const s = this.stats;
    Sound.play('railgun');
    const crit = this.rollCrit();
    const dmg = this.effDamage * crit.mult;
    if (crit.isCrit) Sound.play('crit');
    const a = Math.atan2(target.y - this.y, target.x - this.x);
    this.angle = a;
    const ex = this.x + Math.cos(a) * this.rangePx, ey = this.y + Math.sin(a) * this.rangePx;

    if (s.pierceCount && s.pierceCount > 1) {
      let count = 0;
      for (const e of game.enemies) {
        if (e.dead || e.hostileTo !== this.side || count >= s.pierceCount) continue;
        if (pointSegDist2(e.x, e.y, this.x, this.y, ex, ey) < 400 + e.radius * e.radius) {
          this.registerDamage(e.takeDamage(dmg, s.dmgType, { pierce: this.effPierce, shred: s.shred || 0 }), e, game, crit.isCrit);
          game.spawnBurst(e.x, e.y, 7, this.def.color, 100);
          count++;
        }
      }
    } else {
      this.registerDamage(target.takeDamage(dmg, s.dmgType, { pierce: this.effPierce, shred: s.shred || 0 }), target, game, crit.isCrit);
      game.spawnBurst(target.x, target.y, crit.isCrit ? 15 : 8, crit.isCrit ? '#fff' : this.def.color, 130);
    }
    game.beams.push({ points: [{ x: this.x + Math.cos(a) * 16, y: this.y + Math.sin(a) * 16 }, { x: ex, y: ey }],
      life: 0.2, maxLife: 0.2, color: crit.isCrit ? '#fff' : this.def.color, width: crit.isCrit ? 6 : 3.5 });
    game.shake(crit.isCrit ? 4 : 2);
  }

  /** TETHER — the only mechanic that moves enemies backward down the lane. */
  fireTether(target, game) {
    const s = this.stats;
    Sound.play('tether');
    const crit = this.rollCrit();
    this.registerDamage(target.takeDamage(this.effDamage * crit.mult, s.dmgType, { pierce: this.effPierce, shred: s.shred || 0 }), target, game, crit.isCrit);

    const pulled = target.pullBack((s.pull || 1) * this.effStatus);
    if (pulled > 0.05) game.addFloater(target.x, target.y - 14, '↤ ' + pulled.toFixed(1), false, '#f472b6', 12);
    if (s.bleed) target.applyBleed(s.bleed * this.effStatus, (s.bleedDur || 3) * this.effStatus, this);

    /* WINDLASS also hauls everything around the hooked target. */
    if (s.pullAll) {
      const r2 = (2.0 * TILE) ** 2;
      for (const e of game.enemies) {
        if (e === target || e.dead || e.hostileTo !== this.side) continue;
        if (dist2(target.x, target.y, e.x, e.y) <= r2) e.pullBack(s.pullAll * this.effStatus);
      }
    }
    game.beams.push({ points: [{ x: this.x, y: this.y }, { x: target.x, y: target.y }],
      life: 0.22, maxLife: 0.22, color: this.def.color, width: 2.4, chain: true });
    game.spawnBurst(target.x, target.y, 6, this.def.color, 70);
  }

  /** PRISM — damage ramps while focus is held, resets the instant it breaks. */
  updateBeam(dt, game) {
    const s = this.stats;
    const target = this.acquire(game.enemies);
    this.firing = !!target;
    if (!target) { this.focusTarget = null; this.focusTime = 0; return; }

    if (target !== this.focusTarget) { this.focusTarget = target; this.focusTime = 0; }
    this.focusTime += dt;
    this.angle = angleLerp(this.angle, Math.atan2(target.y - this.y, target.x - this.x), Math.min(1, dt * 10));

    const mult = 1 + Math.min((s.rampMax || 3) - 1, this.focusTime * (s.ramp || 0.6));
    this.rampMult = mult;

    const hitList = [target];
    if (s.split && s.split > 1) {
      for (const e of this.acquireAll(game.enemies)) {
        if (e !== target && hitList.length < s.split) hitList.push(e);
      }
    }
    hitList.forEach((e, i) => {
      const scale = i === 0 ? 1 : (s.splitFalloff || 0.6);
      this.registerDamage(e.takeDamage(this.effDamage * mult * scale * dt, s.dmgType, {}), e, game, false, true);
      game.beams.push({ points: [{ x: this.x, y: this.y - 6 }, { x: e.x, y: e.y }],
        life: 0.05, maxLife: 0.05, color: this.def.color, width: 1.5 + mult * 0.8 * scale });
    });
    if (Math.random() < dt * 8) Sound.play('prism');
  }

  /** SAPPER — seeds mines onto the lane and banks them between waves. */
  updateMines(dt, game) {
    const s = this.stats;
    this.mineTimer -= dt;
    if (this.mineTimer <= 0 && this.mines.length < (s.maxMines || 1)) {
      this.mineTimer = s.mineDelay || 3;
      const spot = game.randomLaneSpot(this.side, this.x, this.y, this.rangePx);
      if (spot) { this.mines.push(new Mine(this, spot.x, spot.y)); Sound.play('mineArm'); }
      else this.mineTimer = 0.5;
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      this.mines[i].update(dt, game);
      if (this.mines[i].dead) this.mines.splice(i, 1);
    }
  }

  updateDrones(dt, game) {
    for (const d of this.drones) d.update(dt, game);
  }

  /** SINGULARITY — compresses a strung-out wave into one knot. */
  updateGravity(dt, game) {
    const s = this.stats;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const targets = this.acquireAll(game.enemies);
    if (!targets.length) { this.cooldown = 0.15; return; }
    this.cooldown = 1 / this.effRate;
    this.recoil = 1;
    Sound.play('gravity');

    /* Every lane has its own anchor: the point on that path nearest the well. */
    const anchors = new Map();
    for (const e of targets) {
      if (e.flying) continue;
      if (!anchors.has(e.path)) anchors.set(e.path, e.path.nearestDist(this.x, this.y).dist);
      /* A spiral lane passes the well several times; only compress enemies
         already near THIS passage or the yank looks like teleportation. */
      if (Math.abs(anchors.get(e.path) - e.dist) > TILE * 4) continue;
      e.pullToward(anchors.get(e.path), (s.gravity || 1) * this.effStatus);
      if (s.hold) e.applyFreeze(s.hold * this.effStatus);
      const crit = this.rollCrit();
      this.registerDamage(e.takeDamage(this.effDamage * crit.mult, s.dmgType, {}), e, game, crit.isCrit);
    }
    game.spawnImplosion(this.x, this.y, this.rangePx, this.def.color);
    if (s.splash) { game.shake(4); game.spawnExplosion(this.x, this.y, this.rangePx * 0.55, this.def.color); }
  }

  /** VAULT — mints gold on a timer; the kill skim is paid by Game.killEnemy. */
  updateEconomy(dt, game) {
    const s = this.stats;
    this.incomeTimer += dt;
    if (this.incomeTimer >= (s.incomeEvery || 5)) {
      this.incomeTimer -= (s.incomeEvery || 5);
      const vb = this.traits ? this.traits.vaultBonus : 1;
      const amount = Math.round((s.income || 0) * (1 + this.aura.dmg) * this.ascDamage * vb);
      game.awardGold(this.side, amount, this);
      game.addFloater(this.x, this.y - 16, '+' + amount, false, '#fcd34d', 13);
      Sound.play('coin');
    }
  }

  updateCone(dt, game) {
    const s = this.stats;
    const target = this.acquire(game.enemies);
    this.firing = !!target;
    if (!target) return;
    this.angle = angleLerp(this.angle, Math.atan2(target.y - this.y, target.x - this.x), Math.min(1, dt * 14));
    Sound.play('pyre');

    const half = (s.cone || 0.6) / 2, r2 = this.rangePx * this.rangePx;
    for (const e of game.enemies) {
      if (e.dead || e.hostileTo !== this.side) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > r2) continue;
      let da = Math.atan2(e.y - this.y, e.x - this.x) - this.angle;
      da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (Math.abs(da) > half + Math.atan2(e.radius, Math.max(12, Math.sqrt(d2)))) continue;
      this.registerDamage(e.takeDamage(this.effDamage * dt, s.dmgType, {}), e, game, false, true);
      if (s.burn) e.applyBurn(s.burn * this.effStatus, (s.burnDur || 2) * this.effStatus, this);
      if (s.burnVuln && e.burnTimer > 0)
        e.applyVuln(s.burnVuln, (s.burnDur || 2) * this.effStatus);
    }

    if (s.puddle) {
      this.puddleTimer -= dt;
      if (this.puddleTimer <= 0) {
        this.puddleTimer = 0.75;
        const d = Math.min(this.rangePx * 0.85, Math.hypot(target.x - this.x, target.y - this.y));
        game.puddles.push({ x: this.x + Math.cos(this.angle) * d, y: this.y + Math.sin(this.angle) * d,
          radius: (s.puddleRadius || 1.1) * TILE, dps: s.puddleDmg || 30,
          life: s.puddleDur || 4, maxLife: s.puddleDur || 4, tower: this, side: this.side, seed: rand(0, 100) });
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = this.angle + rand(-half, half), d = rand(10, this.rangePx);
      game.spawnParticle(this.x + Math.cos(a) * d * 0.35, this.y + Math.sin(a) * d * 0.35,
        Math.cos(a) * rand(60, 150), Math.sin(a) * rand(60, 150), rand(0.16, 0.34), rand(3, 7),
        Math.random() < 0.4 ? '#ffd166' : '#ff6b4a', 'fire');
    }
  }

  /* ------------------------------------------------------------ booking */

  registerDamage(dealt, enemy, game, crit = false, quiet = false) {
    if (dealt <= 0 && !enemy.dead) return;
    this.damageDealt += dealt;
    if (dealt > 0 && game.applyElement) game.applyElement(enemy, this.def.element, dealt, this);
    if (!quiet && dealt > 0 && this.side === Game.viewSide)
      game.addFloater(enemy.x, enemy.y, Math.round(dealt), crit);
    if (enemy.dead && !enemy._counted) { enemy._counted = true; this.kills++; }

    /* TECH ORIGIN riders. ONE hook, placed here because registerDamage is
       the single point every attack path -- projectile, lobbed, chain,
       hitscan, beam, cone, drone, mine, minion, wall thorn, ability construct
       -- already funnels through with both the tower and the enemy in hand.
       Hooking effDamage instead would have been simpler and wrong: it has no
       target, and two of the five origins are defined by the target's state. */
    if (dealt > 0 && this.def && this.def.origin && !this._inOrigin)
      this.originStrike(dealt, enemy, game);

    /* SIPHON banks damage until the meter fills, then returns a life. */
    const s = this.stats;
    if (s.drainPer && dealt > 0) {
      /* Halder's line makes every meter fill faster. */
      this.drainMeter += dealt * (this.traits ? this.traits.siphonRate : 1);
      if (this.drainMeter >= s.drainPer && this.drainCd <= 0) {
        this.drainMeter = 0;
        this.drainCd = s.drainCd || 10;
        game.restoreLife(this.side, 1, this);
        if (s.drainGold) game.awardGold(this.side, s.drainGold, this);
      }
    }
  }

  /**
   * The per-hit half of the tech origins.
   *
   * HUMAN and ROBOTIC have no clause here on purpose — their identities are
   * the node rule and the lattice, both of which are stat-block work already
   * done in recompute(). An origin that reached into every damage event AND
   * the stat block would be two origins wearing one name.
   */
  originStrike(dealt, enemy, game) {
    const o = this.def.origin;
    /* Combos re-enter registerDamage from inside applyElement, so the guard
       is not decoration: without it a thermal shock would pay its own origin
       rider on top of the rider that triggered it. */
    this._inOrigin = true;
    try {
      if (o === 'light') {
        /* SUPPRESSION. Deliberately does no damage of its own: what the
           Federation contributes is that everyone ELSE's shot lands harder. */
        enemy.suppressT = Math.max(enemy.suppressT || 0, ORIGIN_LIGHT_SUPPRESS);
      } else if (o === 'xeno') {
        /* PUNISH. Scales off the ENEMY's state, which is the mechanic no
           other origin is allowed to have. Pure so armour is not re-rolled,
           dot-flagged so it skips the min-1 floor a 60 Hz cone would farm. */
        const wound = 1 - Math.max(0, enemy.hp) / Math.max(1, enemy.maxHp);
        const extra = dealt * ORIGIN_XENO_PUNISH * wound;
        if (extra > 0) this.damageDealt += enemy.takeDamage(extra, 'pure', { dot: true });
      } else if (o === 'pirate') {
        /* OVERLOAD. A genuine gamble: the payoff lands now, the heat it banks
           takes the emplacement offline once the bank fills. The cooldown is
           what keeps this a gamble rather than a flat buff on a beam. */
        if ((this.procCd || 0) <= 0 && Math.random() < ORIGIN_PIRATE_PROC) {
          this.procCd = ORIGIN_PIRATE_PROC_CD;
          const extra = dealt * (ORIGIN_PIRATE_MULT - 1);
          this.damageDealt += enemy.takeDamage(extra, this.stats.dmgType || 'physical',
                                               { pierce: this.effPierce });
          this.overloads = (this.overloads || 0) + 1;
          this.heat = (this.heat || 0) + 1;
          if (game && game.spawnBurst && this.side === Game.viewSide)
            game.spawnBurst(enemy.x, enemy.y, 6, '#ef4444', 120);
          if (this.heat >= ORIGIN_PIRATE_HEAT_MAX) {
            this.heat = 0;
            /* jamTimer, NEVER `jammed` -- that is a getter with no setter and
               assigning to it is a silent no-op. */
            this.jamTimer = Math.max(this.jamTimer || 0, ORIGIN_PIRATE_JAM);
          }
        }
      }
    } finally { this._inOrigin = false; }
    /* A kill landed by the rider still belongs to this tower; registerDamage
       already ran its own counting check before the rider fired. */
    if (enemy.dead && !enemy._counted) { enemy._counted = true; this.kills++; }
  }

  tickCooldowns(dt) {
    if (this.drainCd > 0) this.drainCd -= dt;
    /* PIRATE overload gate -- see ORIGIN_PIRATE_PROC_CD. */
    if (this.procCd > 0) this.procCd -= dt;
  }

  /* ---------------------------------------------------------- rendering */

  draw(ctx, game) {
    const d = this.def;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(8,12,20,0.85)';
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 6); ctx.fill(); ctx.stroke();

    /* tier pips: four for the branch track, then a numeric ascension badge */
    const t = Math.min(4, this.branch ? 4 : this.level);
    for (let i = 0; i < t; i++) { ctx.fillStyle = i === 3 ? '#fff' : d.color; ctx.fillRect(-13 + i * 7, 11, 4.5, 2.4); }
    if (this.asc > 0) {
      ctx.fillStyle = '#ffd166'; ctx.font = 'bold 8px ui-monospace, monospace'; ctx.textAlign = 'right';
      ctx.fillText('+' + this.asc, 15, -9); ctx.textAlign = 'left';
    }

    ctx.shadowColor = d.color; ctx.shadowBlur = 11;
    if (this.jamTimer > 0) ctx.globalAlpha = 0.4;
    const fn = this['draw_' + this.type];
    if (fn) fn.call(this, ctx, this.age);
    else if (this.def.glyph) this.draw_glyph(ctx, this.age);
    else this.draw_bolt(ctx, this.age);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    /* A silenced tower has to be unmistakable — you need to see the hole in
       your line the instant a Jammer opens up. */
    if (this.jamTimer > 0) {
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('⊘', 0, 4); ctx.textAlign = 'left';
    }
    ctx.restore();

    for (const m of this.mines) m.draw(ctx);
    for (const dr of this.drones) dr.draw(ctx);
    if (this.minionList) for (const mn of this.minionList) mn.draw(ctx);
    if (this.wallList) for (const w of this.wallList) w.draw(ctx);
    if (this.glaiveList) for (const g of this.glaiveList) {
      ctx.save();
      ctx.translate(g.x, g.y); ctx.rotate(g.age * 14);
      ctx.fillStyle = this.def.color;
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(0, -4); ctx.lineTo(-9, 0); ctx.lineTo(0, 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  aimed(ctx, fn) {
    ctx.save(); ctx.rotate(this.angle); ctx.translate(-this.recoil * 4, 0); fn(); ctx.restore();
  }

  draw_bolt(ctx) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    this.aimed(ctx, () => {
      ctx.fillStyle = d.color;
      const bars = this.stats.multishot || 1;
      for (let i = 0; i < bars; i++) ctx.fillRect(2, -1.5 + (bars === 1 ? 0 : (i - (bars - 1) / 2) * 4.5), this.branch ? 18 : 14, 3);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); ctx.fill();
    });
  }
  draw_mortar(ctx) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; i ? ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12) : ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); }
    ctx.closePath(); ctx.fill();
    this.aimed(ctx, () => {
      ctx.fillStyle = d.color;
      const n = this.stats.submunitions ? 3 : 1;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.roundRect(0, -3.2 + (n === 1 ? 0 : (i - 1) * 4.5), this.branch ? 15 : 12, n === 1 ? 6.4 : 3.6, 2); ctx.fill(); }
      ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    });
  }
  draw_cryo(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; i ? ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12) : ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); }
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.rotate(t * 0.9); ctx.fillStyle = d.color;
    const n = this.branch ? 6 : 2 + this.level;
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.rotate((i / n) * TAU); ctx.translate(6.5, 0); ctx.rotate(-t * 2);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3.2, 0); ctx.lineTo(0, 4); ctx.lineTo(-3.2, 0);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  }
  draw_arc(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = d.color; ctx.lineWidth = 2;
    const n = this.branch ? 5 : 2 + this.level, pts = [];
    for (let i = 0; i < n; i++) { const a = t * 1.6 + (i / n) * TAU; pts.push({ x: Math.cos(a) * 10, y: Math.sin(a) * 10 }); }
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = d.color; pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.3, 0, TAU); ctx.fill(); });
    ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(t * 7) * 0.45})`;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  }
  draw_pyre(ctx) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); ctx.fill();
    this.aimed(ctx, () => {
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.moveTo(2, -4.5); ctx.lineTo(14, -7); ctx.lineTo(14, 7); ctx.lineTo(2, 4.5); ctx.closePath(); ctx.fill();
      if (this.firing) {
        const f = 0.6 + Math.random() * 0.4;
        ctx.fillStyle = `rgba(255,${190 + Math.random() * 60 | 0},80,${f})`;
        ctx.beginPath(); ctx.moveTo(14, -5.5); ctx.lineTo(14 + 11 * f, 0); ctx.lineTo(14, 5.5); ctx.closePath(); ctx.fill();
      }
    });
  }
  draw_railgun(ctx) {
    const d = this.def;
    ctx.strokeStyle = d.dark; ctx.lineWidth = 3.2;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke(); }
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    this.aimed(ctx, () => {
      ctx.fillStyle = d.color; ctx.fillRect(0, -2, this.branch ? 24 : 19, 4);
      ctx.fillStyle = '#0f2417';
      const rails = this.level + (this.branch ? 1 : 0);
      for (let i = 0; i < rails; i++) ctx.fillRect(4 + i * 4.5, -4, 2.2, 8);
      const c = 1 - clamp(this.cooldown * this.effRate, 0, 1);
      ctx.fillStyle = `rgba(190,255,210,${c})`; ctx.beginPath(); ctx.arc(0, 0, 4 * c + 1.4, 0, TAU); ctx.fill();
    });
  }
  draw_toxin(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.clip();
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.55; ctx.fillRect(-12, -12, 24, 24); ctx.globalAlpha = 1;
    ctx.fillStyle = '#d9f99d';
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.7 + i * 0.2) % 1);
      ctx.beginPath(); ctx.arc(Math.sin(i * 2.1 + t) * 6, 10 - p * 20, 1.2 + (1 - p) * 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    this.aimed(ctx, () => { ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(5, -2.2, this.branch ? 13 : 10, 4.4, 2); ctx.fill(); });
  }
  draw_beacon(ctx, t) {
    const d = this.def;
    const lift = Math.sin(t * 1.9) * 2.2;
    ctx.fillStyle = d.dark;
    ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(10, 12); ctx.lineTo(5.5, 3.5); ctx.lineTo(-5.5, 3.5); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(0, -4 + lift); ctx.rotate(t * 1.3);
    ctx.strokeStyle = d.color; ctx.lineWidth = 2.2;
    const rings = this.branch ? 3 : 2;
    for (let i = 0; i < rings; i++) { ctx.save(); ctx.rotate((i / rings) * Math.PI); ctx.scale(1, 0.42); ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.restore();
    ctx.fillStyle = `rgba(255,235,150,${0.6 + Math.sin(t * 3.4) * 0.4})`;
    ctx.beginPath(); ctx.arc(0, -4 + lift, 5, 0, TAU); ctx.fill();
  }

  /* ---- new archetypes ---- */

  draw_tether(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-11, -9, 22, 18, 4); ctx.fill();
    /* winch drum */
    ctx.save(); ctx.rotate(-t * (this.firing ? 6 : 1.6));
    ctx.strokeStyle = d.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.stroke(); }
    ctx.restore();
    this.aimed(ctx, () => {
      ctx.strokeStyle = d.color; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(14, -4); ctx.lineTo(15, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
    });
  }

  draw_prism(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    const charge = this.firing ? clamp((this.rampMult - 1) / ((this.stats.rampMax || 3) - 1), 0, 1) : 0;
    ctx.save(); ctx.rotate(t * (0.6 + charge * 3));
    ctx.fillStyle = d.color;
    /* a rotating triangular prism that spins faster as focus builds */
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; i ? ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9) : ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${0.35 + charge * 0.65})`;
    ctx.beginPath(); ctx.arc(0, 0, 2.5 + charge * 3.5, 0, TAU); ctx.fill();
    if (charge > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${charge})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.stroke();
    }
  }

  draw_sapper(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 4); ctx.fill();
    /* stockpile readout: one pip per banked mine */
    const held = this.mines.length, max = this.stats.maxMines || 1;
    ctx.fillStyle = d.color;
    const cols = Math.min(5, max);
    for (let i = 0; i < Math.min(held, 10); i++) {
      const cx = -8 + (i % cols) * 4.2, cy = -6 + Math.floor(i / cols) * 4.2;
      ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 6, 4.5, Math.PI, TAU); ctx.stroke();
    const ready = held >= max;
    ctx.fillStyle = ready ? '#fff' : `rgba(250,204,21,${0.4 + Math.sin(t * 5) * 0.3})`;
    ctx.beginPath(); ctx.arc(0, 6, 2, 0, TAU); ctx.fill();
  }

  draw_singularity(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    const charge = 1 - clamp(this.cooldown * this.effRate, 0, 1);
    /* matter spiralling inward, tightening as the pulse charges */
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const p = k / 14;
        const a = t * 2.4 + i * TAU / 3 + p * 3.2;
        const r = 11 * (1 - p) * (1 - charge * 0.45);
        k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, 0, 3.4 + charge * 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + charge * 0.6})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 3.4 + charge * 1.6, 0, TAU); ctx.stroke();
  }

  draw_vault(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-11, -10, 22, 20, 3); ctx.fill();
    /* vault door with a slowly turning wheel */
    ctx.strokeStyle = d.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
    ctx.save(); ctx.rotate(t * 0.7);
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke(); }
    ctx.restore();
    const fill = clamp(this.incomeTimer / (this.stats.incomeEvery || 5), 0, 1);
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.35 + fill * 0.65;
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1204'; ctx.font = 'bold 7px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('◈', 0, 2.5); ctx.textAlign = 'left';
  }

  draw_flak(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 4); ctx.fill();
    this.aimed(ctx, () => {
      ctx.fillStyle = d.color;
      /* twin elevated barrels — reads as anti-air at a glance */
      for (const off of [-3.4, 3.4]) { ctx.beginPath(); ctx.roundRect(1, off - 1.4, this.branch ? 17 : 13, 2.8, 1.4); ctx.fill(); }
      ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
    });
    /* rotating radar sweep */
    ctx.save(); ctx.rotate(t * 2.2);
    ctx.strokeStyle = `rgba(94,234,212,0.55)`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.restore();
  }

  draw_siphon(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    /* the meter is the whole point, so it is the whole sprite */
    const fill = clamp(this.drainMeter / (this.stats.drainPer || 1), 0, 1);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.clip();
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.75;
    ctx.fillRect(-10, 9.5 - fill * 19, 20, fill * 19);
    ctx.restore();
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = this.drainCd > 0 ? 'rgba(255,255,255,0.35)' : '#fff';
    ctx.font = 'bold 10px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('♥', 0, 3.5); ctx.textAlign = 'left';
    this.aimed(ctx, () => { ctx.fillStyle = d.color; ctx.fillRect(8, -1.6, 8, 3.2); });
  }

  draw_dronebay(ctx, t) {
    const d = this.def;
    ctx.fillStyle = d.dark; ctx.beginPath(); ctx.roundRect(-12, -12, 24, 24, 5); ctx.fill();
    /* landing pad with a beacon; the drones themselves are drawn separately */
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 11.5, t, t + TAU * 0.75); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(125,211,252,${0.5 + Math.sin(t * 4) * 0.5})`;
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = d.color; ctx.font = 'bold 7px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(this.drones.length), 0, -11); ctx.textAlign = 'left';
  }

  drawAuraField(ctx) {
    const isVault = this.def.attack === 'economy';
    const col = isVault ? '252,211,77' : '251,191,36';
    const r = this.rangePx, p = (this.age * 0.4) % 1;
    const g = ctx.createRadialGradient(this.x, this.y, r * 0.15, this.x, this.y, r);
    g.addColorStop(0, `rgba(${col},0.13)`);
    g.addColorStop(0.7, `rgba(${col},0.045)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.3 * (1 - p)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, r * p, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},0.2)`; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ------------------------------------------------------------- PROJECTILE */

class Projectile {
  constructor(o) {
    Object.assign(this, { splash: 0, pierce: 0, pierceCount: 0, shred: 0, stun: 0,
      radius: 4, lobbed: false, groundOnly: false, airOnly: false, target: null, side: 0 }, o);
    this.dead = false; this.age = 0; this.hits = new Set();
    if (this.lobbed) {
      this.sx = this.x; this.sy = this.y;
      this.travel = Math.hypot(this.tx - this.sx, this.ty - this.sy) / this.speed;
      this.t = 0;
      this.arc = Math.min(64, this.travel * 85);
    } else {
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
      this.pierceLeft = this.pierceCount;
    }
  }
  hostile(e) {
    if (e.dead || this.hits.has(e) || e.hostileTo !== this.side) return false;
    if (this.groundOnly && e.flying) return false;
    if (this.airOnly && !e.flying) return false;
    return true;
  }
  update(dt, game) {
    this.age += dt;
    if (this.lobbed) {
      this.t += dt;
      const f = clamp(this.t / this.travel, 0, 1);
      this.x = lerp(this.sx, this.tx, f); this.y = lerp(this.sy, this.ty, f);
      this.height = Math.sin(f * Math.PI) * this.arc;
      if (f >= 1) { this.detonate(game); this.dead = true; }
      return;
    }
    if (this.target && !this.target.dead) {
      this.angle = angleLerp(this.angle, Math.atan2(this.target.y - this.y, this.target.x - this.x), Math.min(1, dt * 9));
      this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.age > 3 || this.x < -80 || this.y < -80 || this.x > game.width + 80 || this.y > game.height + 80) { this.dead = true; return; }
    for (const e of game.enemies) {
      if (!this.hostile(e)) continue;
      const rr = e.radius + this.radius;
      if (dist2(this.x, this.y, e.x, e.y) <= rr * rr) {
        this.hits.add(e);
        this.impact(e, game);
        if (this.pierceLeft > 0) this.pierceLeft--; else this.dead = true;
        if (this.splash > 0) { this.detonate(game); this.dead = true; }
        return;
      }
    }
  }
  impact(enemy, game) {
    const t = this.tower, s = t ? t.stats : {};
    let dmg = this.damage;
    if (s.brittle && (enemy.slowTimer > 0 || enemy.freezeTimer > 0)) dmg *= s.brittle;
    if (s.reckonFrac) {
      let frac = s.reckonFrac;
      if (s.reckonElite && (enemy.boss || enemy.miniboss)) frac *= (1 + s.reckonElite);
      dmg += enemy.recentDmg * frac;
    }
    const crit = t ? t.rollCrit() : { isCrit: false, mult: 1 };
    const dealt = enemy.takeDamage(dmg * crit.mult, this.dmgType, { pierce: this.pierce, shred: this.shred });
    if (t) t.registerDamage(dealt, enemy, game, crit.isCrit);
    /* EXECUTIONER: sever anything (non-elite) left below the threshold. */
    if (t && s.execThreshold && !enemy.dead && !enemy.boss && !enemy.miniboss &&
        enemy.hp / enemy.maxHp <= s.execThreshold) {
      const done = enemy.takeDamage(enemy.hp + enemy.shield, 'pure', {});
      t.registerDamage(done, enemy, game, true);
      enemy.executed = true;
      if (s.execGold) game.awardGold(t.side, s.execGold, t);
      if (s.execFear) {
        const r2 = (1.6 * TILE) ** 2;
        for (const o of game.enemies)
          if (!o.dead && o.hostileTo === t.side && dist2(enemy.x, enemy.y, o.x, o.y) <= r2)
            o.applySlow(s.execFear, 2);
      }
      game.spawnBurst(enemy.x, enemy.y, 14, '#fca5a5', 130);
      if (t.side === game.viewSide) Sound.play('execute');
    }
    this.applyRiders(enemy, game);
    Sound.play('hit');
    game.spawnBurst(this.x, this.y, 3, this.color, 60);
  }
  applyRiders(enemy, game) {
    const t = this.tower, s = t ? t.stats : {};
    const st = t ? t.effStatus : 1;
    if (s.slow) {
      enemy.applySlow(s.slow * st, (s.slowDur || 1.5) * st);
      if (s.freezeChance && Math.random() < s.freezeChance) { enemy.applyFreeze((s.freezeDur || 0.8) * st); Sound.play('freeze'); }
    }
    if (s.poisonDps) {
      enemy.applyPoison(s.poisonDps * st, (s.poisonPct || 0) * st, (s.poisonDur || 4) * st, s.maxStacks || 5, s.contagion || 0, t);
      if (s.shredPerStack) enemy.applyShred(s.shredPerStack * enemy.poisonStacks, s.poisonDur || 4);
      if (s.corrodeSlow) enemy.applySlow(s.corrodeSlow * st, (s.poisonDur || 4) * st);
    }
    if (s.burn) enemy.applyBurn(s.burn * st, (s.burnDur || 2) * st, t);
    /* CRYO FROSTBITE and the burn line's OXIDISER/FEEDING. Both are scoped to
       the condition the tower itself just applied, and both last exactly as
       long as it does, so the chip on the inspector and the debuff on the
       unit expire together. */
    if (s.chillVuln && (enemy.slowTimer > 0 || enemy.freezeTimer > 0))
      enemy.applyVuln(s.chillVuln, (s.slowDur || 1.5) * st);
    if (s.burnVuln && enemy.burnTimer > 0)
      enemy.applyVuln(s.burnVuln, (s.burnDur || 2) * st);
    if (s.vuln) enemy.applyVuln(s.vuln * st, (s.vulnDur || 2) * st);
    if (this.stun) enemy.applyFreeze(this.stun);
  }
  detonate(game) {
    const r = this.splash * TILE;
    if (r > 0) {
      Sound.play('explosion', clamp(this.splash / 1.5, 0.6, 1.6));
      game.shake(clamp(this.splash * 2.2, 1.2, 7));
      game.spawnExplosion(this.x, this.y, r, this.color);
      const r2 = r * r;
      for (const e of game.enemies) {
        if (e.dead || e.hostileTo !== this.side) continue;
        if (this.groundOnly && e.flying) continue;
        if (this.airOnly && !e.flying) continue;
        const d2 = dist2(this.x, this.y, e.x, e.y);
        if (d2 > r2) continue;
        const falloff = 1 - 0.55 * (Math.sqrt(d2) / r);
        const t = this.tower, s = t ? t.stats : {};
        let dmg = this.damage * falloff;
        if (s.brittle && (e.slowTimer > 0 || e.freezeTimer > 0)) dmg *= s.brittle;
        const dealt = e.takeDamage(dmg, this.dmgType, { pierce: this.pierce });
        if (t) t.registerDamage(dealt, e, game);
        this.applyRiders(e, game);
      }
    } else game.spawnBurst(this.x, this.y, 5, this.color, 80);
  }
  draw(ctx) {
    ctx.save();
    if (this.lobbed) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.radius * 1.2, this.radius * 0.5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(this.x, this.y - (this.height || 0));
    } else { ctx.translate(this.x, this.y); ctx.rotate(this.angle); }
    ctx.shadowColor = this.color; ctx.shadowBlur = 10; ctx.fillStyle = this.color;
    if (this.lobbed) {
      ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-1, -1, this.radius * 0.4, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(this.radius * 2.3, 0); ctx.lineTo(-this.radius, -this.radius * 0.85);
      ctx.lineTo(-this.radius * 0.4, 0); ctx.lineTo(-this.radius, this.radius * 0.85); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
