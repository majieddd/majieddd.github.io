/* ==========================================================================
   COSMIC CONQUEST, Entities & Simulation
   --------------------------------------------------------------------------
   Every unit carries `hostileTo`, the side index it is marching on. Towers
   only ever engage units hostile to their own side, which is what lets both
   armies share one field without shooting each other's reinforcements.
   ========================================================================== */

'use strict';

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
/* THE FINITE GUARD. `clamp` above returns NaN unchanged -- NaN compares false
   against everything, so neither branch fires -- which is correct for the
   simulation (every pin was measured through it) and fatal at any boundary
   where a non-finite value can enter and then persist. `fin` is what those
   boundaries use: not a number, or not finite, means take the fallback.
   Deliberately separate from clamp so hardening a boundary can never move the
   simulation. */
const fin = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

/* A hostile query inside the guarded step phases can use the seat-local view
   prepared by Game.step. The fallback is deliberate: render probes and unit
   tests also drive individual entities outside that phase, where the scratch
   pools are stale and the caller's collection is authoritative. */
function hostileCandidates(enemies, side) {
  if (TARGET_POOLS_ACTIVE && enemies === Game.enemies && TARGET_POOLS[side])
    return TARGET_POOLS[side];
  return enemies;
}

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
    /* A PATROL never arrives. On a survive board there is no rival base at
       the far end of its road, so instead of leaking it wraps to the start
       and walks the lane again (see the path-end branch in update). */
    this.patrol = !!o.patrol;

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
    /* THE ROLE (Session 26): how this body treats other units. Derived, not
       stored anywhere else, and read only by Game.resolveMelee and the UI. */
    this.role = def.flying ? 'air' : (def.stealth ? 'stealth' : 'infantry');
    this.meleeT = 0; this._meleeRef = null; this._meleeAt = 0;
    this.boss = !!def.boss;

    this.maxShield = (def.shield || 0) * (o.hpMul || 1);
    this.shield = this.maxShield;
    this.shieldCooldown = 0;
    /* FLAK's doing: a flyer on the deck. `flying` itself is left alone so the
       unit keeps its air lane and FLAK can keep shooting it -- what changes is
       that ground-only weapons stop refusing it. */
    this.groundedT = 0; this.grounded = false;
    /* ICHOR's bile: a share of the WOUND per second, the inverse of the gas. */
    this.digestPer = 0; this.digestTimer = 0; this.digestSrc = null;

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
    this.exposure = 0; this.exposureT = 0; this.exposureShed = 0; this.exposureFroze = false;
    this.burnDps = 0;    this.burnTimer = 0;
    this.poisonStacks = 0; this.poisonTimer = 0; this.poisonDps = 0; this.poisonPct = 0; this.poisonContagion = 0;
    /* Share of MAX health per stack per second -- CANISTER's axis. Kept
       separate from poisonPct so one cloud can carry both and neither
       tower has to pretend to be the other. */
    this.poisonMaxPct = 0;
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
       and full leak cost the loop runs away, whichever side is marginally
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
    /* Full immunity (elites, Wardens) is absolute, the cap only applies to
       stacked partial resistances. */
    if (this.pullResist >= 1) return 1;
    return Math.min(0.98, this.pullResist + this.auraPullResist);
  }
  get totalArmor()      { return Math.max(0, this.armor + this.auraArmor - this.shredAmt); }
  /** NULL FIELD. THE flag. Every ability tick in the engine reads this one
      getter and nothing anywhere reads a per-ability list, because a
      suppression that misses one ability is worse than none -- the player
      cannot tell which one is still working. The complete set gated on it:
      regeneration (and the ERASURE backfire), shield regeneration, mender
      healing, the UNSTABLE death-heal, every aura carrier (through auraDamp),
      summoning, jamming, blinking, wraith phasing and the Revenant's revive. */
  get nulled()          { return this.nullT > 0; }

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

  /**
   * THE THEFT -- a leak is no longer instant. Reaching the seat no longer
   * spends lives: the unit turns around and CARRIES them back toward the
   * spawn edge, and only walking off that edge makes the loss real -- the
   * carrier branch in update() sets `leaked` at dist 0 and the ordinary
   * reap then charges the ordinary loseLives, BRUTAL surcharge, enemyDamp
   * and Shield Wall reduction included. Killing the carrier is the
   * recovery (see Game.killEnemy). `reanimated` is set so nothing generic
   * pays for this body twice: the automatic reanimate gate skips it, a
   * Siren cannot charm it, a Press cannot take it. `carrierFresh`
   * remembers whether the corpse still owes the rival a march. Bounty is
   * zeroed -- the lives ARE the payment. Everything here keys off entity
   * state, never a seat literal, so a rival's leak builds a rival's
   * carrier under exactly this law.
   */
  becomeCarrier() {
    this.carrier = true;
    this.carrierFresh = !this.reanimated;
    this.reanimated = true;
    this.bounty = 0;
    /* Fixed and slower than the walk in: the window is authored. */
    this.carrierSpeed = Math.min(CARRIER_SPEED, this.baseSpeed * 0.7);
    this.dist = this.path.total;
    /* A phased wraith must not flee inside an invulnerability window, and
       a flyer lands under the weight of what it stole: the theft has to be
       contestable by the board that just failed to stop the walk in. */
    this.phaseOn = false;
    if (this.flying) { this.grounded = true; this.groundedT = 1e9; }
    if (this.hostileTo === Game.viewSide) {
      Game.hurtFlash = 0.6; Game.shake(5); Sound.play('leak');
      /* The figure the seat would actually pay, not the raw one -- the same
         call the reap charges and the HUD prints. */
      Game.addFloater(this.x, this.y - 18,
                      '-' + (Game.leakCostOf ? Game.leakCostOf(this) : this.livesCost) + ' ♥ STOLEN',
                      false, '#f87171', 15);
    }
  }

  /* ------------------------------------------------------------ statuses */

  applySlow(f, dur) {
    if (f >= this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = Math.max(this.slowFactor, f);
      this.slowTimer = Math.max(this.slowTimer, dur);
    }
  }
  /* CONTAGION and SCORCHED EARTH. VORN's +50% damage-over-time and CINDER's
     +45% burn were written by two commander traits and six talents and read
     by nothing at all, so half of each identity moved no number. Scaled HERE,
     at application, for the same reason `effStatus` is: the tick loop has no
     idea which side lit the fire, while every applier is handed the `src`
     tower and a tower knows its own side. Scaled BEFORE the strongest-source
     comparison, so a doctrine's stronger fire correctly overwrites a weaker
     one rather than losing to the number it would have beaten. */
  dotScale(src) {
    const S = (src && typeof Game !== 'undefined' && Game.sides) ? Game.sides[src.side] : null;
    return (S && S.traits && S.traits.dotMul) || 1;
  }
  applyBurn(dps, dur, src) {
    dps *= this.dotScale(src);
    if (dps >= this.burnDps) { this.burnDps = dps; this.burnTimer = dur; this.burnSrc = src; }
    else this.burnTimer = Math.max(this.burnTimer, dur * 0.5);
  }
  applyBleed(dps, dur, src) {
    dps *= this.dotScale(src);
    if (dps >= this.bleedDps) { this.bleedDps = dps; this.bleedTimer = dur; this.bleedSrc = src; }
    else this.bleedTimer = Math.max(this.bleedTimer, dur * 0.5);
  }
  /* `maxPct` is inserted AFTER `pct` rather than appended, so a call site that
     was not updated is a hard argument-order break at the first tick instead
     of a silently missing effect. All three call sites move together. */
  applyPoison(dps, pct, maxPct, dur, maxStacks, contagion, src) {
    dps *= this.dotScale(src);
    this.poisonStacks = Math.min(maxStacks, this.poisonStacks + 1);
    this.poisonTimer = dur;
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonPct = Math.max(this.poisonPct, pct);
    this.poisonMaxPct = Math.max(this.poisonMaxPct, maxPct || 0);
    this.poisonContagion = Math.max(this.poisonContagion, contagion || 0);
    if (src) this.poisonSrc = src;
  }
  applyVuln(a, dur) { this.vulnAmt = Math.max(this.vulnAmt, a); this.vulnTimer = Math.max(this.vulnTimer, dur); }
  /** ICHOR. Strongest coat wins rather than stacking, exactly as burn does. */
  applyDigest(frac, dur, src) {
    if (frac >= this.digestPer) { this.digestPer = frac; this.digestTimer = dur; this.digestSrc = src; }
  }
  /**
   * FLAK. Elites are never brought down, for the same reason CYCLONE cannot
   * lift them: an elite that can be controlled has no design left. Non-flyers
   * are untouched, so a mixed splash does nothing strange to the ground wave.
   */
  applyGrounded(dur) {
    if (!this.flying || this.stunImmune) return;
    this.groundedT = Math.min(FLAK_DOWNED_CAP, Math.max(this.groundedT, dur));
    this.grounded = true;
    this.applySlow(FLAK_DOWNED_SLOW, this.groundedT);
  }
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
    /* The THIRD place a kill is credited: burns, bleeds, venom, digestion and
       the minion grind all land here and nowhere else. A prize hook installed
       only in registerDamage would pay nothing for a tower that finishes with
       a status, which is how BLOOD DEBT and the PRIVATEER purse would have
       come to disagree with the kill counter printed beside them. */
    if (this.dead && !this._counted) {
      this._counted = true; tower.kills++;
      if (tower.onKill) tower.onKill(this, Game);
    }
  }

  takeDamage(amount, type, opts = {}) {
    if (this.dead || amount <= 0) return 0;
    /* FEDERATION SUPPRESSION holds a target's protections open. Read here
       because takeDamage is the one place every resistance is actually spent,
       and deliberately NOT applied to armour: armour is the physical curve's
       main lever and halving it from a support tower would re-price every
       physical tower in the game. Resistances only. */
    let supp = this.suppressT > 0 ? (1 - ORIGIN_LIGHT_STRIP) : 1;
    /* MONSTRANCE's REVELATION -- the origin rider bought at cathedral scale.
       Folded into the same factor suppression uses so the two never disagree
       about what 'held open' means; the armour reach is granted separately
       below, because armour is the one protection the rider is forbidden. */
    if (this.revealT > 0) supp *= (1 - Math.min(REVEAL_CAP, this.revealAmt || 0));
    /* Shelled mobs shrug off area damage -- splash alone stops clearing maps. */
    if (opts.splash && this.def.splashResist) amount *= (1 - this.def.splashResist * supp);
    /* A phased Wraith simply cannot be hurt, sustained damage is wasted on it. */
    if (this.phaseOn) { this.flash = 0.05; return 0; }
    amount *= (1 + this.vulnAmt);
    /* CANTOR's and VORN's slow-vulnerability rows -- six talents that wrote
       `slowVuln` while nothing read it, so "slowed enemies take more damage"
       was a promise the engine never kept. `hostileTo` IS the attacker here:
       it names the side this body is marching on, which is the side whose
       towers are shooting it, so the trait read is the shooter's own. Folded
       beside vulnAmt because that is the one place a damage-taken multiplier
       belongs, and gated on the live slow timer rather than on a flag, so it
       ends exactly when the slow does. */
    if (this.slowTimer > 0 && typeof Game !== 'undefined' && Game.sides) {
      const A = Game.sides[this.hostileTo];
      const sv = A && A.traits && A.traits.slowVuln;
      if (sv) amount *= (1 + sv);
    }
    /* ORISON's SANCTIFIED. The chapel wants its offering to LAST, so the one
       creature it named is harder to kill -- the tension the whole tower is
       built on, not a defensive buff handed to the enemy. Read off the body
       rather than looked up on the tower list, because takeDamage is the
       hottest path in the simulation. */
    if (this.offeringGuard) amount *= (1 - this.offeringGuard);
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
      let armor = this.totalArmor * (1 - (opts.pierce || 0));
      /* Revelation reaches armour; suppression never does. The 2x2 is the
         licence: a 1x1 support halving armour would re-price every physical
         tower in the game, so only the tower that pays four tiles gets to. */
      if (this.revealT > 0) armor *= (1 - Math.min(REVEAL_CAP, this.revealAmt || 0));
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
    /* SUTURE banks here and spends at tower cadence in atk_graft -- the
       hottest path in the simulation writes one addition and never walks a
       list. `opts.graft` guards the repeat itself, or one wound would echo
       through the flesh forever. */
    if (this.graftUntil > Game.clock && !opts.graft && dealt > 0)
      this.graftPending = (this.graftPending || 0) + dealt;
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
      /* Standing back up is an ability like any other, so a Revenant killed
         inside the field stays down. The charge is SPENT rather than held --
         see the summon tick for why. */
      if (this.revivesLeft > 0 && !this.nulled) {
        this.revivesLeft--;
        this.hp = this.maxHp * (this.def.revive || 0.45);
        this.shield = 0;
        Game.onRevive(this);
      } else {
        this.hp = 0; this.dead = true;
        /* THE ONE DEATH SITE, and the reason GESTALT and ANTIPHON hook here
           instead of in Game.killEnemy: that funnel is also reached by a
           SIREN conversion, by a Custodian's oath and by the posthumous
           sweep of an eliminated seat, none of which is a kill. Everything
           that arrives here was shot to death by something. */
        onEnemyDeath(this);
      }
    }
    return dealt;
  }

  update(dt) {
    this.age += dt;
    if (this.flash > 0) this.flash -= dt;

    /* THE HEALING LEDGER -- written here, read only by HUNGERING VEIL.
       Health GIVEN BACK is observed as a frame-to-frame RISE rather than
       hooked at each healer, because five of the six things that raise a
       body live outside this file: menders and death-heals in Game.step, a
       SHEPHERD blessing, a doctrine feed in entities2. A reader that saw
       only the two in here (regeneration and a Revenant standing up) would
       quietly under-bill the exact enemies the tower exists to punish.
       Health and shield are tested separately: netting them would forgive a
       shield rebuilt in the same frame the body took a hit. A frame that is
       net-negative books nothing, which is deliberately generous to the
       healer. VEIL_DEBT_CAP is what stops a four-wave-old regenerator
       arriving with a bill larger than anything on the board. */
    if (this._hpMark === undefined) { this._hpMark = this.hp; this._shMark = this.shield; }
    let given = 0;
    if (this.hp > this._hpMark) given += this.hp - this._hpMark;
    if (this.shield > this._shMark) given += this.shield - this._shMark;
    if (given > 0) this.healDebt = Math.min((this.healDebt || 0) + given, this.maxHp * VEIL_DEBT_CAP);
    this._hpMark = this.hp; this._shMark = this.shield;

    if (this.slowTimer > 0)  { this.slowTimer -= dt;  if (this.slowTimer <= 0) this.slowFactor = 0; }
    /* COLDFRONT exposure: refreshed every tick by any front holding this
       unit; clear of every field it SHEDS at the stamped rate rather than
       expiring, and the slow walks down with it. */
    if (this.exposure > 0) {
      if (this.exposureT > 0) this.exposureT -= dt;
      else {
        this.exposure = Math.max(0, this.exposure - (this.exposureShed || 0.35) * dt);
        if (this.exposure > 0.02) this.applySlow(this.exposure, 0.2);
        else { this.exposure = 0; this.exposureFroze = false; }
      }
    }
    if (this.markT > 0) { this.markT -= dt; if (this.markT <= 0) this.markEl = null; }
    if (this.suppressT > 0) this.suppressT -= dt;
    if (this.revealT > 0) this.revealT -= dt;
    /* Refreshed every frame by any NULL FIELD holding this unit. Towers step
       before enemies in Game.step so one frame would do; the window is wider
       so a long frame or a resumed tab cannot flicker a wraith back to
       phasing between the two passes. */
    if (this.nullT > 0) this.nullT -= dt;
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
      /* TOXIN scales off CURRENT health, so it savages a healthy giant and
         fades to nothing as the target weakens. It softens; it never finishes.
         CANISTER gas scales off MAX health instead -- a constant share of what
         the target arrived with, which is why it is the half that still works
         on a nearly-dead heavy and why it has to be ceilinged. The ceiling and
         the elite reduction live in maxHpVenomFrac, the same function the
         inspector prints from. */
      let per = (this.poisonDps + this.hp * this.poisonPct) * this.poisonStacks;
      if (this.poisonMaxPct > 0)
        per += this.maxHp * maxHpVenomFrac(this.poisonMaxPct, this.poisonStacks,
                                           this.boss || this.miniboss);
      this.credit(this.poisonSrc, this.takeDamage(per * dt, 'pure', { dot: true }));
      if (Math.random() < dt * 6) Game.spawnParticle(this.x + rand(-7, 7), this.y + rand(-7, 7),
        rand(-6, 6), rand(-24, -6), rand(0.3, 0.6), rand(1.5, 3), '#a3e635', 'spark');
      if (this.poisonTimer <= 0) { this.poisonStacks = 0; this.poisonDps = 0; this.poisonPct = 0; this.poisonMaxPct = 0; }
    }
    if (this.digestTimer > 0) {
      this.digestTimer -= dt;
      /* Share of the WOUND, not of what is left and not of what arrived. The
         ceiling and the elite reduction live in digestFrac, the same function
         the inspector prints from, so the row and the tick cannot drift. */
      const wound = 1 - Math.max(0, this.hp) / Math.max(1, this.maxHp);
      const per = this.maxHp * digestFrac(this.digestPer, wound, this.boss || this.miniboss);
      this.credit(this.digestSrc, this.takeDamage(per * dt, 'pure', { dot: true }));
      if (Math.random() < dt * 6) Game.spawnParticle(this.x + rand(-7, 7), this.y + rand(-7, 7),
        rand(-6, 6), rand(-20, -4), rand(0.3, 0.6), rand(1.5, 3), '#a855f7', 'spark');
      if (this.digestTimer <= 0) this.digestPer = 0;
    }
    if (this.groundedT > 0) {
      this.groundedT -= dt;
      if (this.groundedT <= 0) this.grounded = false;
    }

    if (this.regen > 0 && this.hp < this.maxHp && !this.dead) {
      if (!this.nulled) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);
      else if (this.nullBackfire > 0)
        /* ERASURE. Denying a heal is invisible -- the bar simply stops moving,
           which reads as the field not working. Turning the denied share back
           on the body is the same information delivered where the player is
           already looking. Pure and dot-flagged so it neither re-rolls armour
           nor farms the min-1 floor at 60Hz. */
        this.credit(this.nullSrc, this.takeDamage(
          this.maxHp * this.regen * this.nullBackfire * dt, 'pure', { dot: true }));
    }

    if (this.maxShield > 0 && this.shield < this.maxShield && !this.nulled) {
      if (this.shieldCooldown > 0) this.shieldCooldown -= dt;
      else this.shield = Math.min(this.maxShield,
        this.shield + (this.def.shieldRegen || this.shieldRegenOverride || 0) * dt);
    }

    if (this.def.summon && !this.dead && !this.carrier) {
      this.summonTimer -= dt;
      /* The attempt is CONSUMED rather than deferred -- here, at the jam and
         at the blink. Freezing the clock instead would let a unit bank its
         whole cooldown inside the field and spend it the instant it stepped
         out, which turns a suppression into a delay. */
      if (this.summonTimer <= 0) {
        this.summonTimer = this.def.summon.interval;
        if (!this.nulled) Game.summonFrom(this, this.def.summon);
      }
    }

    if (this.dead) return;

    /* --- CARRIER: a stolen life walking back out. Fixed pace, immune to
       slow, haste and freeze -- but every burn, bleed, poison and digest
       tick above still lands, so damage-over-time can finish the recovery
       on its own. Crossing the spawn edge is the moment the theft becomes
       real: `leaked` re-enters the unchanged reap in Game.step, which
       charges loseLives with the full livesCost through the same
       enemyDamp/leakReduction arithmetic every leak has always paid. --- */
    if (this.carrier) {
      this.dist -= this.carrierSpeed * TILE * dt;
      if (this.dist <= 0) { this.dist = 0; this.leaked = true; }
      this.updatePosition();
      return;
    }

    /* --- JAMMER: silences every tower defending against it --- */
    if (this.def.jam) {
      this.jamTimer -= dt;
      if (this.jamTimer <= 0) {
        this.jamTimer = this.def.jam.interval;
        if (!this.nulled) Game.jamTowers(this, this.def.jam);
      }
    }

    /* --- BLINK: skips a chunk of lane, bypassing your killzone --- */
    if (this.def.teleport) {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = this.def.teleport.interval;
        if (this.nulled) {
          /* A drawn fizzle, so a suppressed blink reads as a suppression and
             not as a blink that happened to be short. */
          Game.spawnBurst(this.x, this.y, 5, '#a5b4fc', 55);
        } else {
          Game.spawnBurst(this.x, this.y, 10, this.def.color, 120);
          this.dist = Math.min(this.path.total, this.dist + this.def.teleport.tiles * TILE);
          this.updatePosition();
          Game.spawnBurst(this.x, this.y, 10, this.def.color, 120);
          Sound.play('blink');
        }
      }
    }

    /* --- WRAITH: alternating invulnerability windows --- */
    if (this.def.phase) {
      /* A phased wraith is INVULNERABLE -- takeDamage returns 0 on phaseOn --
         so suppression has to drop the window immediately rather than merely
         decline to open the next one. Waiting two seconds for the current
         flicker to expire is a suppression the player cannot see working. */
      if (this.nulled) { this.phaseOn = false; this.phaseTimer = this.def.phase.off; }
      else {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phaseOn = !this.phaseOn;
          this.phaseTimer = this.phaseOn ? this.def.phase.on : this.def.phase.off;
          if (this.phaseOn) Sound.play('phase');
        }
      }
    }
    const spd = this.effectiveSpeed;
    if (spd > 0) { this.dist += spd * TILE * dt; this.updatePosition(); this.crossNode(); }
    /* THE PATROL WRAPS. It has walked its lane end to end without meeting
       anything that stopped it, so it turns around and walks it again rather
       than reaching an ending it has no business reaching: `leaked` would
       charge lives to the phantom seat it is nominally hostile to, and on a
       survive board draining that seat resolves the match as a WIN, which is
       the exact phantom-seat defect the spawn guards exist to prevent. Wraps
       to 0 rather than reversing in place so the whole detachment keeps one
       facing and one road, which is what reads as a patrol instead of a
       crowd milling at a wall. */
    if (this.patrol && this.dist >= this.path.total && !this.dead) {
      this.dist = 0;
      this.updatePosition();
      /* crossNode dedupes on the LAST tile key seen, so clearing it re-arms
         the lane nodes for the next circuit; the wrap teleports the body
         across the board and the stale key would otherwise be compared
         against a tile it is no longer standing on. */
      this.nodeTile = null;
    }
    if (this.dist >= this.path.total && !this.leaked && !this.patrol) {
      /* THE OATH -- CUSTODIAN. Resolved here because this is the only frame
         in which the choice exists: the reap downstream knows exactly two
         endings, `dead` (which pays a bounty, credits a kill and sends the
         corpse at a rival) and `leaked` (which costs at least one life, since
         the cost is floored at 1 however small it rounds). A warden's
         interception is neither. `charmed` is the engine's REMOVED-NOT-KILLED
         flag -- Game.killEnemy returns on it before any of that -- and the
         Oath is simply the second thing that removes a unit without killing
         it. */
      if (vigilSpend(this)) { this.dead = true; this.charmed = true; }
      /* `leaked` IS the ordinary ending -- the reap downstream charges
         loseLives, the BRUTAL surcharge, enemyDamp and Shield Wall from it,
         exactly as it did before carriers existed. See LEAK_STEALS_BACK. */
      else if (LEAK_STEALS_BACK) this.becomeCarrier();
      else this.leaked = true;
    }
  }

  /* ---------------------------------------------------------- rendering */

  draw(ctx) {
    const c = this.def.color;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.flying && !this.grounded) {
      ctx.save();
      ctx.globalAlpha = 0.26; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(4, 12, this.radius * 0.8, this.radius * 0.34, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.translate(0, -6 + Math.sin(this.age * 3.4) * 2);
    }

    /* A CARRIER wears the theft openly -- pulsing ring and a life glyph
       both armies can read, because interception IS the mechanic. Drawn
       from entity state alone; the rival's carriers render identically. */
    if (this.carrier) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.age * 6) * 0.3;
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 5.5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#f87171';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, -this.radius - 12);
      ctx.restore();
    }

    /* Reanimated units wear a spectral halo so both armies stay readable. */
    /* "Both armies" was the two-sided reading. Game.reanimate passes
       `owner: killer` and killer runs 0..N-1 on a tri board, so a send from
       the third commander arrived wearing the second commander's rose and the
       player could not tell whose dead were walking at them. BATCH-C/nside */
    if (this.reanimated && !this.carrier) {
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
    /* Phased units render as a hollow ghost, you can see it is untouchable. */
    if (this.phaseOn) ctx.globalAlpha = 0.35;
    const overview = Game && Game.renderOverview;
    ctx.shadowColor = c;
    ctx.shadowBlur = overview ? (this.boss ? 8 : this.miniboss ? 5 : 0)
                              : (this.boss ? 24 : this.miniboss ? 18 : 9);
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
      /* maxShield can be 0 on a body wearing a BORROWED ward -- the shield is
         real and the capacity it was measured against is not -- and
         `shield / 0` is Infinity, which becomes `rgba(96,165,250,Infinity)`.
         Canvas discards an invalid colour string silently, so the halo simply
         vanished rather than erroring. Same idiom as the guard 23 lines below. */
      const f = this.maxShield > 0 ? clamp(this.shield / this.maxShield, 0, 1) : 1;
      ctx.strokeStyle = `rgba(96,165,250,${0.35 + f * 0.5})`;
      ctx.fillStyle = `rgba(96,165,250,${0.08 + f * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.radius + 6, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    /* Overview is for threat shape and board control. Normal-unit bars and
       glyph stacks are subpixel there, so retain only elites, carriers and
       genuinely critical health. Zooming in restores the complete read. */
    const priority = this.boss || this.miniboss || this.carrier;
    if (!overview || priority || this.hp / this.maxHp < 0.3) this.drawHealthBar(ctx);
    if (!overview || priority) this.drawStatusGlyphs(ctx);
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
    /* an anchored, braced block, visually immovable */
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

/* Share of the beam a Beacon's SECOND light carries. WIDEBAND buys reach at
   the cost of depth, so the extra tower is lit but never as brightly -- a
   second light at full strength would make one talent worth two Beacons. */
const BEACON_SECOND_LIGHT = 0.6;

/**
 * The share a QUARTERMASTER takes off an upgrade bought inside its depot.
 *
 * The STRONGEST depot in reach applies and they do not stack: a pair of
 * Convoys would otherwise buy ascensions for nothing. A depot never
 * discounts its own upgrades, and a jammed one issues nothing.
 */
function requisitionFor(tower) {
  const S = Game.sides && Game.sides[tower.side];
  if (!S || !S.towers) return 0;
  let best = 0;
  for (const t of S.towers) {
    const r = t.stats && t.stats.requisition;
    if (!r || t === tower || t.jammed) continue;
    if (dist2(t.x, t.y, tower.x, tower.y) > t.rangePx * t.rangePx) continue;
    if (r > best) best = r;
  }
  return Math.min(REQUISITION_MAX, best);
}

/**
 * THE OATH, spend a Custodian warden on a breach. True when one was spent.
 *
 * The deepest bench goes first so a thin watch is held in reserve, which is
 * what stops a CORDON being drained by a wave a VIGIL beside it could have
 * absorbed. Called from Enemy.update, once, in the frame the unit arrives.
 */
function vigilSpend(e) {
  const S = Game.sides && Game.sides[e.hostileTo];
  if (!S || !S.towers) return false;
  let best = null;
  for (const t of S.towers) {
    if (!t.stats.vigilHold || t.jammed || (t.vigilLeft || 0) < 1) continue;
    if (dist2(t.x, t.y, e.x, e.y) > t.rangePx * t.rangePx) continue;
    if (!best || t.vigilLeft > best.vigilLeft) best = t;
  }
  if (!best) return false;
  best.vigilLeft--;
  best.vigilT = 0;
  /* A warden did save a life, so it books against the figure the inspector
     already prints for lives saved rather than inventing a second one. */
  best.livesRestored = (best.livesRestored || 0) + 1;
  if (best.stats.vigilGold) Game.awardGold(best.side, best.stats.vigilGold, best);
  Game.spawnBurst(e.x, e.y, 18, best.def.color, 150);
  if (best.side === Game.viewSide) {
    Sound.play('shieldBreak');
    Game.addFloater(e.x, e.y - 14, 'OATH KEPT', false, best.def.color, 14);
  }
  return true;
}

class Tower {
  constructor(type, gx, gy, side) {
    this.def = TOWER_TYPES[type];
    this.type = type;
    this.side = side;
    this.gx = gx; this.gy = gy;
    /* A heavy occupies foot x foot tiles with (gx, gy) as the TOP-LEFT; the
       centre every range test, aura pass, lattice count, projectile origin
       and draw call reads sits mid-rectangle. foot 1 reduces to the old
       (gx + 0.5) * TILE exactly, so no 1x1 tower moves a pixel. */
    this.foot = towerFoot(this.def);
    this.x = (gx + this.foot / 2) * TILE;
    this.y = (gy + this.foot / 2) * TILE;

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
    /* BEACON's beam, held on the LIT tower rather than recomputed from the
       carrier. A grant that expires on its own cannot dangle: a Beacon that
       is sold, relocated or jammed simply stops relighting and the light
       fades on schedule, with nothing to clean up in recomputeAuras. */
    this.focusT = 0; this.focusDmgAmt = 0; this.focusRateAmt = 0; this.focusRangeAmt = 0;
    /* CUSTODIAN's bench of oath-bound wardens, and PYRE's fuel tank. */
    this.vigilLeft = undefined; this.vigilT = 0;
    this.heatT = 0; this.ventT = 0;

    this.kills = 0; this.damageDealt = 0; this.goldMade = 0; this.livesRestored = 0;
    this.aura = { dmg: 0, rate: 0, range: 0 };
    this.recompute();
  }

  /* ------------------------------------------------------------- stats */

  /**
   * Applies a technology option. Keys ending in `Mul` multiply the matching
   * base stat; everything else adds. `statusMul` is the one special case, it
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

    /* SURGE every N ascensions. N and strength are commander-dependent. */
    const surgeEvery = traits ? traits.surgeEvery : ASCENSION.surgeEvery;
    const surgeMul = traits ? traits.surgeMul : 1;
    const surges = Math.floor(this.asc / surgeEvery);
    if (surges > 0 && this.branch && this.branch.surge)
      for (const k in this.branch.surge) s[k] = (s[k] || 0) + this.branch.surge[k] * surges * surgeMul;

    /* NULL FIELD publishes its suppression volume AS `range`. Read here, after
       levels, branch, talents, rolls and surges have all had their say, so
       there is exactly ONE number: the circle the board draws, the figure the
       inspector prints, the radius atk_null tests and the reach the rival's
       coverage sampling scores are the same value by construction. Authoring
       a `range` beside `nullRadius` would be the eighth UI/engine desync this
       project has shipped. */
    if (s.nullRadius) s.range = s.nullRadius;

    /* BUILD NODES. The tile decides which of three things it grants: a matched
       element is sharpened, a tower that marks NOTHING of its own is lent the
       node's element -- which is where the map enters the combo table -- and a
       marking tower of some other element holds its own charge longer instead.
       Read here so relocation and base-level retrofits pick it up for free;
       both already recompute. */
    /* THE FOOTPRINT ATTUNEMENT RULE: a heavy standing on several tiles
       honours exactly ONE covered build node, and a node matching this
       tower's element wins over one that does not -- so a 2x2 dropped across
       two nodes attunes if ANY covered node matches. One node, never two:
       stacking infusions would pay the board-area tax back to the heavy,
       which is the one refund the 2x2 cost must never give. foot 1 reads its
       own tile exactly as before. */
    let node = null;
    const fp = this.foot || 1;
    for (let ndy = 0; ndy < fp; ndy++) for (let ndx = 0; ndx < fp; ndx++) {
      const n = nodeAt(this.gx + ndx, this.gy + ndy, 'build');
      if (!n) continue;
      if (!node || (n.el === this.def.element && node.el !== this.def.element)) node = n;
    }
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
      ? Math.max(0, Math.min(Math.max(ORIGIN_LATTICE_MAX, this.latticeFillCap || 0), this.latticeRaw || 0)) : 0;
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

    /* Drone count can change on upgrade, rebuild the flight. */
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
    if (this.asc > 0) return 'MK III +' + this.asc + ' · CHOOSE SPECIALISATION';
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
    /* BLOOD PRICE reads the ledger it was bought from. `livesPaid` counts only
       what was SPENT on a Blood Price -- never a life lost to a leak -- so the
       tower rewards commitment to the doctrine and pays nothing whatsoever for
       doing badly. In rateMul rather than effRate so the inspector, the shop
       preview and the shot clock all read one multiplier. */
    const blood = 1 + (this.stats.bloodRate || 0) * ((S && S.livesPaid) || 0);
    /* ORISON's standing lend rides HERE rather than in effRate, for the same
       reason CASCADE does: the drone cadence reads rateMul directly. */
    return (1 + this.aura.rate + (this.focusRateAmt || 0)) * this.ascRate * this.sideMods.rate * deep * pulse * sab * blood
           * offeringRateMul(this.side);
  }
  get effDamage() {
    const alch = (this.alchStacks || 0) * ((this.stats.transmute || 0) * (this.stats.transmuteMul || 1));
    /* GESTALT eats where the ALCHEMIST transmutes, so it is added to the base
       figure the same way and BEFORE the multipliers: one eaten body is worth
       one point of the tower's own damage, aura, ascension and all. */
    const gest = (this.gestaltStacks || 0) * ((this.stats.gestaltPerKill || 0) * (this.stats.gestaltPerKillMul || 1));
    return ((this.stats.damage || 0) + alch + gest) * (1 + this.aura.dmg + (this.focusDmgAmt || 0)) * this.ascDamage * this.sideMods.damage * this.commanderDamage * GLOBAL_DAMAGE_TUNE * offeringDamageMul(this.side);
  }
  effDamageFor(v) { return v * (1 + this.aura.dmg + (this.focusDmgAmt || 0)) * this.ascDamage * this.sideMods.damage * this.commanderDamage * GLOBAL_DAMAGE_TUNE * offeringDamageMul(this.side); }
  get effRate()   { return (this.stats.rate || 1) * this.rateMul; }
  get effRange()  { const S = Game.sides[this.side];
                    /* A GESTALT's gullet widens with what it has eaten, so its
                       feeding radius is part of the growth rather than a stat
                       beside it -- which is also why a lull costs it coverage
                       as well as damage. */
                    const gest = (this.gestaltStacks || 0) * (this.stats.gestaltRange || 0);
                    return ((this.stats.range || 1) + gest) * (1 + this.aura.range + (this.focusRangeAmt || 0)) * this.ascRange * this.sideMods.range
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
      /* The floor is the tower's own multiplier; the commander's doctrine
         then scales it, because "+15% crit damage" has to mean fifteen
         percent MORE crit damage. Folding it additively instead would have
         made a +0.15 talent worth six percent against the 2.5x floor, which
         is how a printed number quietly becomes a different one. */
      const mult = Math.max(this.stats.critMult || 0, 2.5) *
                   (1 + (this.sideMods.critMult || 0));
      return { isCrit: true, mult };
    }
    return { isCrit: false, mult: 1 };
  }

  /** Granted automatically on each level-up, no decision, just a small boon. */
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
    /* QUARTERMASTER's requisition lands HERE and nowhere else, for the same
       reason the free owed branch above does: this is the one definition
       Game.upgrade, the inspector and the rival's scorer all already read, so
       the price on the button, the gold actually taken and the denominator
       the AI divides by cannot disagree. */
    c *= (1 - requisitionFor(this));
    return Math.max(1, Math.round(c));
  }
  get sellValue() { return Math.floor(this.invested * Game.sides[this.side].mods.sellRate); }

  estimateDps() {
    const s = this.stats;
    if (this.isSupport) return 0;
    const a = this.def.attack;
    if (a === 'cone') {
      let d = this.effDamage + (s.burn || 0);
      /* ICHOR's bile has no damage figure of its own -- it is a share of the
         WOUND -- so it is priced the way CANISTER's share-of-health effect
         is: against a nominal body, through Game.waveHpMul, which is THE
         definition of the curve rather than a second copy of it. */
      if (s.digest)
        d += DIGEST_REF_HP * Game.waveHpMul(Math.max(1, Game.wave))
             * digestFrac(s.digest * this.effStatus, DIGEST_REF_WOUND, false);
      /* PYRE's tank pays over the whole cycle it costs -- the hold plus the
         vent -- because a blowout the emplacement is offline for is not free
         throughput and the rival must not price it as though it were. */
      if (s.overheat)
        d += this.effDamageFor((s.blowDmg || 0) * (s.blowDmgMul || 1))
             / Math.max(1, (s.overheat || 5) + PYRE_VENT_SECONDS);
      /* PHAROS is a cone that is only ever pointing at one slice of the
         board: price the slice, not the circle, or the rival reads a lamp
         as a 26-damage Pyre with triple the reach and drafts nothing else. */
      if (s.sweepRate)
        d *= Math.min(1, (s.cone || 0.6) * Math.max(1, Math.round(s.sweepBeams || 1)) * PHAROS_UPTIME / TAU);
      return d;
    }
    if (a === 'vigil') {
      /* A life SAVED has no damage figure. Priced against a nominal body on
         the live wave curve at the rate the bench can be spent, because
         AI.projectedUpgrade reads exactly this and a zero would leave the
         rival building one Custodian and never touching it again. */
      return VIGIL_REF_HP * Game.waveHpMul(Math.max(1, Game.wave))
             * (Math.max(0, s.vigilHold || 0) / Math.max(1, s.vigilEvery || 10));
    }
    if (a === 'press') {
      /* PRESS GANG is a gun PLUS the bodies its kills leave standing. The gun
         is priced the ordinary way at the bottom of this function; the crew is
         a second throughput the rival has to see, or it reads the tower as an
         11-damage bolt and never drafts it. Bounded by the crew ceiling and
         discounted for the fact that a body only fights while one is standing
         and something is in reach. */
      const crew = Math.min(s.pressMax || 1,
                            (s.pressDur || 8) / Math.max(0.1, s.pressCd || 5));
      return this.effDamage * this.effRate
           + this.effDamageFor(s.pressDps || 0) * crew * PRESS_UPTIME_DISCOUNT;
    }
    if (a === 'replicate') {
      /* A free tower has no damage figure. Converted on the scale the rival
         already uses for gold -- the DEPOT's -- so a Replicator competes with
         a Vault on the terms a Vault is already priced in, rather than on a
         second exchange rate that would drift from it. */
      const gift = Game.towerCost(this.side, this.type) * REPLICATE_BUDGET_MUL
                 * Math.max(1, s.replicateCount || 1);
      const perTick = gift / (Math.max(REPLICATE_MIN_WAVES, s.replicateEvery || 4)
                              * DEPOT_TICKS_PER_WAVE);
      return this.effDamage * this.effRate + perTick * AI_ECON_UPGRADE_WEIGHT;
    }
    if (a === 'null') {
      /* Suppression deals nothing. Priced exactly as `vigil` is -- against a
         nominal body on the LIVE wave curve through Game.waveHpMul, which is
         THE definition -- because AI.projectedUpgrade reads this and a zero
         leaves the rival building one and never touching it again. Scaled by
         field AREA, since area is what the tower actually buys. */
      const r = Math.max(0.1, s.range || 1);
      return NULL_REF_HP * Game.waveHpMul(Math.max(1, Game.wave)) * NULL_REF_RATE
             * ((r * r) / (NULL_REF_RADIUS * NULL_REF_RADIUS))
             * (1 + (s.nullVuln || 0) * NULL_VULN_WEIGHT);
    }
    /* SESSION 19 -- THE SIX. Four of them deal no damage in the ordinary
       sense, so each is converted onto the wave curve exactly the way VIGIL
       is above: through Game.waveHpMul, which is THE definition, never a
       second copy of it. A zero here is what leaves the rival building one
       and then never touching it again. */
    if (a === 'sepulchre') {
      /* What its wards are ACTUALLY dealing, plus the standing promise that
         it will catch the next tower you give up. Priced off the wards it
         holds rather than off the board it might inherit -- the board pass is
         what this function is being called from. */
      const frac = Math.min(SEPULCHRE_FRAC_MAX, s.sepulchreFrac || 0);
      let held = 0;
      for (const w of (this.wards || [])) held += w.dps;
      return (held + SEPULCHRE_IDLE_REF * Game.waveHpMul(Math.max(1, Game.wave))) * frac;
    }
    if (a === 'orison') {
      /* A life restored, amortised across its wave, plus the lend it makes to
         every other tower you own -- WEIGHTED rather than summed, because
         summing the line here is quadratic. */
      const w = Game.waveHpMul(Math.max(1, Game.wave));
      return ORISON_REF_HP * w * (s.offeringLives || 0)
           + ORISON_BOARD_WEIGHT * w * (s.offeringDmg || 0);
    }
    if (a === 'antiphon')
      return this.effDamage * this.effRate * Math.max(1, s.antiphonVolley || 1) * ANTIPHON_UPTIME;
    if (a === 'maw')
      return MAW_REF_HP * Game.waveHpMul(Math.max(1, Game.wave)) / Math.max(1, s.mawCd || 18);
    if (a === 'veil')
      return VEIL_REF_DEBT * Game.waveHpMul(Math.max(1, Game.wave)) * (s.veilHealTax || 0);
    if (a === 'front')
      /* Weather has no damage figure. Priced as the share of a nominal wave
         body's walk the ceiling takes away, on the LIVE curve through
         Game.waveHpMul -- THE definition, never a second copy of it. */
      return FRONT_REF_DPS * Game.waveHpMul(Math.max(1, Game.wave))
           * (s.exposureCap || 0) * (1 + (s.exposureVuln || 0) * 2);
    if (a === 'depot') {
      /* Supply has no damage figure either, so it is converted on the scale
         the rival already uses for gold: per VAULT tick, times the weight
         that was calibrated against `income`. */
      const perTick = (s.waveBonus || 0) * this.ascDamage / DEPOT_TICKS_PER_WAVE
                    + (s.requisition || 0) * DEPOT_REQ_REF_SPEND;
      return perTick * AI_ECON_UPGRADE_WEIGHT;
    }
    if (a === 'stoke')
      /* STOKEHOLD. Floor burn plus the bank at half fill -- a boiler is
         priced for the pressure it typically holds, not its ceiling. */
      return this.effDamageFor((s.stokeBurn || 0)
           + (s.stokePerHeat || 0) * (s.stokeMax || 10) * 0.5);
    if (a === 'graft')
      /* SUTURE. The lash across its catch, plus the repeat priced at half
         weight -- the repeat's real value is the LINE's dps, which this
         function must not walk from inside a board pass. */
      return this.effDamage * this.effRate * Math.max(1, s.graftCount || 1)
           * (1 + Math.min(GRAFT_FRAC_MAX, s.graftFrac || 0)
                  * Math.max(0, (s.graftCount || 1) - 1) * 0.5);
    if (a === 'impale')
      /* IMPALER. Coverage is total (range 99); the wound multiplier averages
         half its ceiling over a kill, same arithmetic as the origin rider. */
      return this.effDamage * this.effRate * (1 + (s.impaleScale || 0) * 0.5);
    if (a === 'turrets')
      /* QUAD MOUNT -- one gun, `turrets` fire solutions. Convergence priced at
         half weight: surplus barrels only earn it when the wave thins. */
      return this.effDamage * this.effRate * Math.max(1, Math.round(s.turrets || 1))
           * (1 + (s.convergeBonus || 0) * 0.5);
    if (a === 'beam') return this.effDamage * (1 + (s.rampMax || 1) * 0.5) * (s.split || 1) * (1 + (s.revealFrac || 0) * REVEAL_PRICE_WEIGHT);
    if (a === 'mines') return this.effDamage * (s.maxMines || 1) / Math.max(3, (s.mineDelay || 3) * (s.maxMines || 1) * 0.5);
    if (a === 'drones') return this.effDamageFor(s.droneDamage || 0) * (s.droneRate || 1) * (s.drones || 0) * this.rateMul;
    if (a === 'gravity') return this.effDamage * this.effRate * 3;
    let d = this.effDamage * this.effRate;
    if (s.multishot) d *= s.multishot;
    if (s.submunitions) d *= s.submunitions;
    if (s.chains) { let m = 0, c = 1; for (let i = 0; i < s.chains; i++) { m += c; c *= (s.falloff || 0.75); } d = this.effDamage * m * this.effRate; }
    /* ARC. The current hits everything on its stretch of road in BOTH
       directions, so its worth is the stretch times how densely a column
       actually stands -- summed exactly the way the chain above is. */
    if (s.runTiles) {
      let m = 1, step = 1;
      const hops = Math.round((s.runTiles || 0) * ARC_RUN_BODIES_PER_TILE);
      for (let i = 0; i < hops; i++) { step *= (s.runFalloff || 0.85); m += step * 2; }
      d = this.effDamage * m * this.effRate;
    }
    const crit = (s.crit || 0) + this.sideMods.crit;
    if (crit > 0) d *= (1 + crit * (Math.max(s.critMult || 0, 2.5) - 1));
    if (s.poisonDps) d += s.poisonDps * (s.maxStacks || 1) * 0.6 * this.effStatus;
    /* TOXIN's percentage. The tick charges `hp * poisonPct * stacks`, so the
       estimate is that expression against a nominal body on the LIVE wave
       curve -- through Game.waveHpMul, which is THE definition, never a
       second copy of it. Uncapped and unreduced against elites because the
       tick applies neither: the ceiling and the boss cut belong to the
       max-health gas below, not to this one. 0.6 is the same uptime discount
       the flat half above already carries. */
    if (s.poisonPct)
      d += POISON_PCT_REF_HP * Game.waveHpMul(Math.max(1, Game.wave))
           * s.poisonPct * this.effStatus * (s.maxStacks || 1) * 0.6;
    /* A share-of-health effect has no damage figure of its own, so it is
       priced against a nominal wave body -- through Game.waveHpMul, which is
       THE definition of the curve, never a second copy of it. Without this
       term AI.effectiveness reads CANISTER as a 9-damage tower and the rival
       never drafts the thing it has in its own human line. The 0.6 is the
       same uptime discount the flat venom half already carries. */
    if (s.poisonMaxPct)
      d += MAXHP_DOT_REF_HP * Game.waveHpMul(Math.max(1, Game.wave))
           * maxHpVenomFrac(s.poisonMaxPct * this.effStatus, s.maxStacks || 1, false) * 0.6;
    if (s.bleed) d += s.bleed * this.effStatus;
    return d;
  }

  /* --------------------------------------------------------- targeting */

  /** Only ever returns units hostile to THIS tower's side. */
  acquire(enemies, rangeOverride) {
    enemies = hostileCandidates(enemies, this.side);
    const R = rangeOverride || this.rangePx;
    const r2 = R * R;
    /* MORTAR's fire mission. Indirect fire does not have to SEE the target --
       somebody on this side does -- so the tube reaches this much further,
       but only onto ground one of your own weapons is currently holding. */
    const spot = (this.stats.spotting || 0) * TILE;
    const sr = spot > 0 ? R + spot : R;
    const sr2 = sr * sr;
    /* BOMBARD's dead zone. A barrel this long cannot depress inside it, so
       acquire() refuses the near ground outright -- the tooltip never lies. */
    const mr = (this.stats.minRange || 0) * TILE, mr2 = mr * mr;
    const groundOnly = this.def.groundOnly, airOnly = this.def.airOnly;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.leaked || e.hostileTo !== this.side) continue;
      /* A FLAK-downed flyer is on the deck and every ground gun may have it. */
      if (groundOnly && e.flying && !e.grounded) continue;
      if (airOnly && !e.flying) continue;
      const dx = this.x - e.x;
      if (dx > sr || dx < -sr) continue;
      const dy = this.y - e.y;
      if (dy > sr || dy < -sr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > sr2) continue;
      if (d2 < mr2) continue;
      /* Shot-blocking terrain: a tower without spotting cannot see through
         walls. Mortars and other indirect-fire weapons carry `spotting` and
         arc over cover -- that's their whole reason to exist on walled boards. */
      if (!this.stats.spotting && wallBlocksShot(this.x, this.y, e.x, e.y)) continue;
      if (d2 > r2 && !this.spottedFor(e)) continue;
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

  /** All hostile units within range, used by area mechanics. */
  acquireAll(enemies, rangeOverride) {
    enemies = hostileCandidates(enemies, this.side);
    const R = rangeOverride || this.rangePx, r2 = R * R;
    const out = [];
    for (const e of enemies) {
      if (e.dead || e.hostileTo !== this.side) continue;
      if (this.def.groundOnly && e.flying && !e.grounded) continue;
      if (this.def.airOnly && !e.flying) continue;
      const dx = this.x - e.x;
      if (dx > R || dx < -R) continue;
      const dy = this.y - e.y;
      if (dy > R || dy < -R) continue;
      if (dx * dx + dy * dy <= r2) out.push(e);
    }
    return out;
  }

  /**
   * MORTAR, is anything on this side currently holding `e`?
   *
   * WEAPONS only: a Beacon is not an observation post, and a jammed tower has
   * no radio, which is what stops a sabotaged line quietly extending an
   * artillery piece's reach. The spotter must itself be able to engage the
   * target, so a board of Flak cannot call fire onto ground.
   */
  spottedFor(e) {
    const S = Game.sides && Game.sides[this.side];
    if (!S || !S.towers) return false;
    for (const t of S.towers) {
      if (t === this || t.isSupport || t.jammed) continue;
      /* Board-wide namers and the IMPALER are not observation posts: a
         spotter extends a fire mission only from ground it genuinely
         patrols. Also closes the latent saboteur/orison hole the comment
         above already disclaims. */
      if ((t.stats.range || 0) >= 90) continue;
      if (t.def.groundOnly && e.flying && !e.grounded) continue;
      if (t.def.airOnly && !e.flying) continue;
      if (dist2(t.x, t.y, e.x, e.y) <= t.rangePx * t.rangePx) return true;
    }
    return false;
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
    /* The Beacon's light decays ABOVE the jam gate on purpose: a lit tower
       that is then sabotaged loses the beam on schedule instead of holding it
       for as long as it is offline. */
    if (this.focusT > 0) {
      this.focusT -= dt;
      if (this.focusT <= 0) { this.focusDmgAmt = 0; this.focusRateAmt = 0; this.focusRangeAmt = 0; }
    }
    if (this.sabLingerT > 0) {
      this.sabLingerT -= dt;
      if (this.sabLingerT <= 0) this.sabLingerAmt = 0;
    }

    /* A jammed tower is completely offline. Economy keeps ticking. Jammers
       silence weapons, they do not seize the treasury. */
    if (this.jamTimer > 0) {
      this.jamTimer -= dt;
      this.firing = false;
      /* A NULL FIELD is a VOLUME, and a volume is geometry rather than
         uptime. Taken fully offline it could be switched off by the very
         thing it exists to suppress: a Jammer inside one jammed the field,
         the 0.25s mark lapsed, and the pulse after that kept the field down
         for good. Enemy.update already reads `if (!this.nulled)` before it
         jams, so jamming is an ability this tower ANSWERS -- a Jammer that
         frees itself from inside the volume is a contradiction in that rule,
         not a counter to it. What a jam takes is the field's RIDERS. What it
         cannot take is the ground. */
      if (this.def.attack === 'null') { this.atk_null(dt, game, true); return; }
      if (this.def.attack !== 'economy') return;
    }

    const ext = this['atk_' + this.def.attack];
    if (ext) return ext.call(this, dt, game);

    switch (this.def.attack) {
      case 'aura':    return this.updateAura(dt, game);
      case 'depot':   return;
      case 'vigil':   return this.updateVigil(dt, game);
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
      case 'grounding':  this.fireGrounding(target, game); break;
    }
  }

  /* ------------------------------------------------------- attack types */

  fireProjectile(target, game) {
    const s = this.stats;
    /* ANTIPHON spends one banked ANSWER as a whole volley, so its shot count
       is its own key rather than `multishot`: sharing one would mean a talent
       that widened either tower silently widened the other. */
    const shots = s.multishot || s.antiphonVolley || 1;
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

  /** TETHER, the only mechanic that moves enemies backward down the lane. */
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

  /** PRISM, damage ramps while focus is held, resets the instant it breaks. */
  updateBeam(dt, game) {
    const s = this.stats;
    const target = this.acquire(game.enemies);
    this.firing = !!target;
    /* PERSISTENCE (t_persist). This talent shipped as a mods key NOTHING read:
       a player could buy it and get literally nothing, which the Session 31
       copy pass caught while stating exactly what every talent does. The first
       fix landed on the wrong tower (the Beacon's aura also calls its state
       "focus"), which the probe caught because the stamp never appeared. THIS
       is the mechanism the talent always named: the prism's ramp. With
       persist, a broken or switched focus DECAYS at twice the build rate
       instead of resetting to zero, so retargeting costs half the climb
       rather than all of it. */
    const rampDecay = s.persist ? (s.ramp || 0.6) * 2 : 0;
    if (!target) {
      this.focusTarget = null;
      if (rampDecay) this.focusTime = Math.max(0, (this.focusTime || 0) - dt * rampDecay / (s.ramp || 0.6));
      else this.focusTime = 0;
      return;
    }
    if (target !== this.focusTarget) {
      this.focusTarget = target;
      if (!rampDecay) this.focusTime = 0;
      /* with persist the climb continues from where the decay left it */
    }
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

  /** SAPPER, seeds mines onto the lane and banks them between waves. */
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

  /** SINGULARITY, compresses a strung-out wave into one knot. */
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

  /**
   * BEACON, consecrate the best gun inside the field, then the next.
   *
   * The grant is written onto the LIT tower with a lifetime rather than
   * recomputed from here every frame, so nothing has to be unwound when the
   * carrier goes away. Chosen by estimateDps, which is the same measure the
   * rival prices a tower with, so the beam lands on the emplacement both
   * sides agree is the best one.
   */
  updateAura(dt, game) {
    const s = this.stats;
    if (!s.focusDmg) return;                       /* PYLON: a flat field, no beam */
    this.focusCd = (this.focusCd || 0) - dt;
    if (this.focusCd > 0) return;
    const dur = Math.max(0.5, s.focusEvery || 3);
    this.focusCd = dur;
    const S = Game.sides[this.side];
    if (!S || !S.towers) return;
    /* RADIANCE widens a support field, and a BEACON's field is its beam's
       reach -- the same trait that widens a PYLON's broadcast in
       recomputeAuras. Applying it to only one of the two kinds would make
       "aura width" mean different things on two towers that are both auras. */
    const auraMul = (S.traits && S.traits.auraRangeMul) || 1;
    const reach = this.rangePx * auraMul;
    const r2 = reach * reach;
    /* Scored ONCE per candidate, not once per comparison: estimateDps walks
       the whole stat block and a comparator would call it O(n log n) times. */
    const pool = [];
    for (const t of S.towers) {
      if (t === this || t.isSupport) continue;
      if (dist2(this.x, this.y, t.x, t.y) <= r2) pool.push({ t: t, v: t.estimateDps() });
    }
    if (!pool.length) { this.lit = null; return; }
    pool.sort((a, b) => b.v - a.v);
    const n = Math.max(1, Math.round(s.focusCount || 1));
    const lit = [];
    for (let i = 0; i < n && i < pool.length; i++) {
      const share = i === 0 ? 1 : BEACON_SECOND_LIGHT;
      const t = pool[i].t;
      /* Math.max, not +=, so two Beacons over one tower are the stronger of
         the pair rather than the sum -- the rule WARD's fields already use,
         and the reason a Beacon wall cannot multiply itself. */
      t.focusT = Math.max(t.focusT || 0, dur);
      t.focusDmgAmt = Math.max(t.focusDmgAmt || 0, (s.focusDmg || 0) * share * this.ascDamage);
      t.focusRateAmt = Math.max(t.focusRateAmt || 0, (s.focusRate || 0) * share);
      t.focusRangeAmt = Math.max(t.focusRangeAmt || 0, (s.focusRange || 0) * share);
      lit.push(t);
      /* The beam lasts the WHOLE consecration, not a flash: a player who
         cannot see which emplacement is lit cannot play around the one
         mechanic the tower has. */
      if (this.side === Game.viewSide)
        game.beams.push({ points: [{ x: this.x, y: this.y }, { x: t.x, y: t.y }],
                          life: dur, maxLife: dur, color: this.def.color, width: 2 });
    }
    this.lit = lit;
  }

  /**
   * CUSTODIAN, keep the bench full.
   *
   * The interception itself lives in Enemy.update, at the only moment it can
   * happen: the step a unit reaches the line. All this does is raise wardens
   * back, and a jammed Custodian never gets here, so a blackout stops the
   * relief exactly as it stops a gun.
   */
  updateVigil(dt, game) {
    const s = this.stats;
    const cap = Math.max(0, Math.round(s.vigilHold || 0));
    if (this.vigilLeft === undefined) this.vigilLeft = cap;
    if (this.vigilLeft >= cap) { this.vigilLeft = cap; this.vigilT = 0; return; }
    this.vigilT = (this.vigilT || 0) + dt;
    const every = Math.max(0.5, s.vigilEvery || 10);
    if (this.vigilT >= every) {
      this.vigilT -= every;
      this.vigilLeft++;
      if (this.side === Game.viewSide) game.spawnBurst(this.x, this.y, 6, this.def.color, 60);
    }
  }

  /**
   * ARC, earth the discharge into the lane and let it run.
   *
   * Selection is by distance ALONG the path, not by proximity, which is the
   * whole separation from a chain: CONCORD asks who else is near this body,
   * ARC asks who else is on this road. Falloff is per tile of road travelled,
   * so a spread-out crowd on the same lane still costs the current its power.
   */
  fireGrounding(target, game) {
    const s = this.stats;
    Sound.play('arc');
    const reach = (s.runTiles || 0) * TILE;   /* no stat, no run */
    const fall = s.runFalloff || 0.85;
    const points = [{ x: this.x, y: this.y - 8 }];
    const hit = [];
    for (const e of hostileCandidates(game.enemies, this.side)) {
      if (e.dead || e.hostileTo !== this.side || e.path !== target.path) continue;
      const d = Math.abs(e.dist - target.dist);
      if (d > reach) continue;
      hit.push({ e: e, d: d });
    }
    hit.sort((a, b) => a.d - b.d);
    for (const h of hit) {
      const mul = Math.pow(fall, h.d / TILE);
      const crit = this.rollCrit();
      const dealt = h.e.takeDamage(this.effDamage * mul * crit.mult, s.dmgType,
                                  { shred: s.shred || 0 });
      this.registerDamage(dealt, h.e, game, crit.isCrit);
      game.spawnBurst(h.e.x, h.e.y, 3, this.def.color, 50);
      points.push({ x: h.e.x, y: h.e.y });
    }
    game.beams.push({ points: points, life: 0.18, maxLife: 0.18,
                      color: this.def.color, width: 3, jagged: true });
  }

  /** VAULT, mints gold on a timer; the kill skim is paid by Game.killEnemy. */
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
    /* PYRE's tank, resolved BEFORE acquisition so a venting emplacement is
       genuinely offline rather than merely quiet -- the downtime is the whole
       price of the blowout. */
    if (s.overheat && this.ventT > 0) {
      this.ventT -= dt;
      this.firing = false;
      return;
    }
    /* HOISTED, because the puddle block far below reads it. It used to be
       declared `const` inside the else branch, so on any tower carrying BOTH
       `sweepRate` and `puddle` the read at the bottom of this function was a
       hard `ReferenceError: target is not defined` -- thrown out of
       Tower.update, out of Game.step, and (before the loop was made
       unkillable) out of the frame that would have booked the next one. No
       shipped stat block pairs the two today, which is the only reason this
       has not been seen; it is one authored `puddle:` away from being seen
       every frame. */
    let target = null;
    if (s.sweepRate) {
      /* PHAROS. The lamp does not aim -- it TURNS, on its own clock. No
         acquisition at all: nothing on the board changes where the light is
         pointing, which is the whole identity. The wave walks through the
         light or it does not. */
      this.angle = (this.angle + s.sweepRate * dt) % TAU;
      this.firing = true;
      if (this.side === Game.viewSide) {
        const lamps = Math.max(1, Math.round(s.sweepBeams || 1));
        for (let b = 0; b < lamps; b++) {
          const la = this.angle + (TAU / lamps) * b;
          game.beams.push({ points: [{ x: this.x, y: this.y },
            { x: this.x + Math.cos(la) * this.rangePx, y: this.y + Math.sin(la) * this.rangePx }],
            life: 0.05, maxLife: 0.05, color: this.def.color, width: 2.5 });
        }
      }
    } else {
      target = this.acquire(game.enemies);
      this.firing = !!target;
      if (!target) { this.heatT = Math.max(0, (this.heatT || 0) - dt); return; }
      this.angle = angleLerp(this.angle, Math.atan2(target.y - this.y, target.x - this.x), Math.min(1, dt * 14));
      Sound.play('pyre');
    }

    const half = (s.cone || 0.6) / 2, r2 = this.rangePx * this.rangePx;
    for (const e of game.enemies) {
      if (e.dead || e.hostileTo !== this.side) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > r2) continue;
      const lamps = Math.max(1, Math.round(s.sweepBeams || 1));
      let inLight = false;
      for (let b = 0; b < lamps; b++) {
        let da = Math.atan2(e.y - this.y, e.x - this.x) - this.angle - (TAU / lamps) * b;
        da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
        if (Math.abs(da) <= half + Math.atan2(e.radius, Math.max(12, Math.sqrt(d2)))) { inLight = true; break; }
      }
      if (!inLight) continue;
      this.registerDamage(e.takeDamage(this.effDamage * dt, s.dmgType, {}), e, game, false, true);
      if (s.burn) e.applyBurn(s.burn * this.effStatus, (s.burnDur || 2) * this.effStatus, this);
      if (s.burnVuln && e.burnTimer > 0)
        e.applyVuln(s.burnVuln, (s.burnDur || 2) * this.effStatus);
      /* ICHOR. Scaled by effStatus here, which is what makes THICK BILE and
         DEEP GULLET reach it -- the panel prints the same product. */
      if (s.digest) e.applyDigest(s.digest * this.effStatus, (s.digestDur || 3) * this.effStatus, this);
      if (s.digestVuln && e.digestTimer > 0)
        e.applyVuln(s.digestVuln, (s.digestDur || 3) * this.effStatus);
      /* PHAROS's HEAVY LIGHT: weight while lit. The burn above already
         bridges the dark between passes, so the slow may be short. */
      if (s.sweepRate && s.slow) e.applySlow(s.slow * this.effStatus, (s.slowDur || 1.2) * this.effStatus);
    }

    /* PYRE. Heat builds only while the trigger is actually held. */
    if (s.overheat) {
      this.heatT = (this.heatT || 0) + dt;
      if (this.heatT >= s.overheat) {
        this.heatT = 0;
        this.ventT = PYRE_VENT_SECONDS;
        const br = (s.blowRadius || 1.5) * TILE, br2 = br * br;
        const blow = this.effDamageFor((s.blowDmg || 0) * (s.blowDmgMul || 1));
        for (const e of game.enemies) {
          if (e.dead || e.hostileTo !== this.side) continue;
          if (dist2(this.x, this.y, e.x, e.y) > br2) continue;
          const dealt = e.takeDamage(blow, s.dmgType, { splash: true });
          this.registerDamage(dealt, e, game);
          if (s.burn) e.applyBurn(s.burn * this.effStatus, (s.burnDur || 2) * this.effStatus, this);
        }
        game.spawnExplosion(this.x, this.y, br, this.def.color);
        game.shake(6);
        if (this.side === Game.viewSide) Sound.play('explosion');
      }
    }

    /* `target` is null for a SWEEPING lamp, which aims at nothing by design --
       so the puddle needs somewhere to fall that does not depend on a target. */
    if (s.puddle && target) {
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
      game.addFloater(enemy.x, enemy.y, Math.round(dealt), crit, null, null, true);
    /* `this.onKill &&` is not defensive noise: entities2.js hangs this very
       method off AbilityOwner.prototype, and an ability construct is not a
       Tower. Without the guard the first kill an aimed battery lands throws
       inside Game.step, which has no try/catch, and freezes the battle. */
    if (enemy.dead && !enemy._counted) {
      enemy._counted = true; this.kills++;
      if (this.onKill) this.onKill(enemy, game);
    }

    if (enemy.dead) {
      const k = this.stats;
      /* BOLT. A kill returns a share of the reload -- the case is already out.
         Math.min against what is LEFT on the clock is the bound: update() sets
         cooldown to a full reload before any kill can be credited here, so a
         splash of four deaths still cannot buy more than one free round, and
         a Bolt in a swarm tops out at double its printed rate. */
      if (k.killReload && this.cooldown > 0)
        this.cooldown -= Math.min(this.cooldown, (1 / Math.max(0.01, this.effRate)) * k.killReload);
      /* FOUNDRY. Every corpse the line puts down is scrap back on the belt --
         including the ones its own automata finish, which reach this same
         funnel through Minion.update. */
      if (k.scrapline && this.forgeT > 0)
        this.forgeT = Math.max(0, this.forgeT - k.scrapline);
    }

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
   * HUMAN and ROBOTIC have no clause here on purpose, their identities are
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
          /* However far HELLBURNER surges the rating, one overload never pays
             more than OVERLOAD_MULT_MAX: surges bypass STAT_CEIL, so the
             ceiling lives here, at the one place the multiple is read. */
          const mult = Math.min(OVERLOAD_MULT_MAX, this.stats.overloadMult || ORIGIN_PIRATE_MULT);
          const extra = dealt * (mult - 1);
          if (this.stats.overloadSplash && game) {
            /* CARRONADE. The overload is not a surcharge on one target, it is
               a DETONATION -- the whole overpayment lands on everything around
               the shell. Same dice, siege stakes. */
            const br = this.stats.overloadSplash * TILE, br2 = br * br;
            for (const e of game.enemies) {
              if (e.dead || e.hostileTo !== this.side) continue;
              if (dist2(enemy.x, enemy.y, e.x, e.y) > br2) continue;
              this.damageDealt += e.takeDamage(extra, this.stats.dmgType || 'physical',
                                               { pierce: this.effPierce, splash: true });
            }
          } else {
            this.damageDealt += enemy.takeDamage(extra, this.stats.dmgType || 'physical',
                                                 { pierce: this.effPierce });
          }
          this.overloads = (this.overloads || 0) + 1;
          this.heat = (this.heat || 0) + 1;
          /* STOKEHOLD. A friendly boiler in reach takes the point instead --
             the gun keeps its governor removed and never pays for it. */
          const SB = Game.sides[this.side];
          if (SB && SB.towers) for (const bt of SB.towers) {
            if (!bt.stats.stokeMax) continue;
            const reach = (bt.stats.stokeReach || 3) * TILE;
            if (dist2(this.x, this.y, bt.x, bt.y) > reach * reach) continue;
            if ((bt.stoke || 0) >= Math.round(bt.stats.stokeMax)) continue;
            bt.stoke = (bt.stoke || 0) + 1; this.heat--; break;
          }
          if (game && game.spawnBurst && this.side === Game.viewSide)
            game.spawnBurst(enemy.x, enemy.y, 6, '#ef4444', 120);
          if (this.heat >= (this.stats.heatBank || ORIGIN_PIRATE_HEAT_MAX)) {
            this.heat = 0;
            /* jamTimer, NEVER `jammed` -- that is a getter with no setter and
               assigning to it is a silent no-op. */
            this.jamTimer = Math.max(this.jamTimer || 0, this.stats.jamFor || ORIGIN_PIRATE_JAM);
          }
        }
      }
    } finally { this._inOrigin = false; }
    /* A kill landed by the rider still belongs to this tower; registerDamage
       already ran its own counting check before the rider fired. */
    if (enemy.dead && !enemy._counted) {
      enemy._counted = true; this.kills++;
      if (this.onKill) this.onKill(enemy, game);
    }
  }

  tickCooldowns(dt) {
    if (this.drainCd > 0) this.drainCd -= dt;
    /* PIRATE overload gate -- see ORIGIN_PIRATE_PROC_CD. */
    if (this.procCd > 0) this.procCd -= dt;
  }

  /* ---------------------------------------------------------- rendering */

  draw(ctx, game) {
    const d = this.def;
    /* Game.draw paints support fields in the ground layer for isSupport
       towers only. The depot and the watch are deliberately NOT isSupport --
       the rival prices both through estimateDps, which isSupport short-
       circuits to zero -- so they paint their own radius here instead of
       shipping a tower whose entire mechanic is a circle nobody can see. */
    /* Four of THE SIX are a circle and nothing else, so they paint their own
       radius here beside the depot and the watch. ORISON is deliberately
       absent: its reach is the whole board and a 99-tile ring would paint
       over the entire arena. */
    if (this.stats.requisition || this.stats.vigilHold || this.stats.nullRadius
        || this.stats.sepulchreFrac
        || this.stats.veilHealTax || this.stats.mawCd || this.stats.gestaltPerKill
        || this.stats.exposure || this.stats.stokePerHeat)
      this.drawAuraField(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    /* A heavy's chassis fills its rectangle. Presentation only -- the sim
       never reads a canvas -- and the 0.92 keeps the same proportional gutter
       a 1x1's 32px plate leaves inside its 38px tile. Tier pips, the sprite
       and the jam ring all scale with it, so the badge stays legible. */
    if ((this.foot || 1) > 1) ctx.scale(this.foot * 0.92, this.foot * 0.92);
    ctx.fillStyle = 'rgba(8,12,20,0.85)';
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 6); ctx.fill(); ctx.stroke();

    /* Tier marks become subpixel shimmer in the whole-board overview. */
    if (!game.renderOverview) {
      const t = Math.min(4, this.branch ? 4 : this.level);
      for (let i = 0; i < t; i++) { ctx.fillStyle = i === 3 ? '#fff' : d.color; ctx.fillRect(-13 + i * 7, 11, 4.5, 2.4); }
      if (this.asc > 0) {
        ctx.fillStyle = '#ffd166'; ctx.font = 'bold 8px ui-monospace, monospace'; ctx.textAlign = 'right';
        ctx.fillText('+' + this.asc, 15, -9); ctx.textAlign = 'left';
      }
    }

    ctx.shadowColor = d.color; ctx.shadowBlur = game.renderOverview ? 0 : 11;
    if (this.jamTimer > 0) ctx.globalAlpha = 0.4;
    const fn = this['draw_' + this.type];
    if (fn) fn.call(this, ctx, this.age);
    else if (this.def.glyph) this.draw_glyph(ctx, this.age);
    else this.draw_bolt(ctx, this.age);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    /* A silenced tower has to be unmistakable, you need to see the hole in
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
    /* A SEPULCHRE's wards are drawn where the tower STOOD, never at the
       chapel. A ward the player cannot find is a mechanic they cannot plan
       around, and the whole point is that the tile is still held. */
    if (this.wards) for (const w of this.wards) {
      ctx.save();
      ctx.globalAlpha = 0.34 + 0.24 * Math.sin(this.age * 3 + w.x * 0.1);
      ctx.strokeStyle = w.color; ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 4]);
      ctx.strokeRect(w.x - 13, w.y - 13, 26, 26);
      ctx.setLineDash([]);
      ctx.fillStyle = w.color;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✞', w.x, w.y + 4);
      ctx.textAlign = 'left';
      ctx.restore();
    }
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
      /* twin elevated barrels, reads as anti-air at a glance */
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
    const isVault = this.def.attack === 'economy' || this.def.attack === 'depot';
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

/**
 * Wall line-of-sight: does a straight shot from (x1,y1) to (x2,y2) in pixel
 * space cross any wall tile? Uses DDA raycast in tile space. Returns true if
 * blocked. No-op (returns false) when the field has no walls.
 */
function wallBlocksShot(x1, y1, x2, y2) {
  const W = FIELD.walls;
  if (!W || W.size === 0) return false;
  /* Convert to tile coords. DDA: step through tiles the ray crosses. */
  let tx0 = (x1 / TILE) | 0, ty0 = (y1 / TILE) | 0;
  const tx1 = (x2 / TILE) | 0, ty1 = (y2 / TILE) | 0;
  const dx = Math.abs(tx1 - tx0), dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1, sy = ty0 < ty1 ? 1 : -1;
  let t = 0;
  /* Max steps bounded by the longer axis; prevents infinite loop on degenerate rays. */
  const maxSteps = dx + dy + 2;
  for (let i = 0; i <= maxSteps; i++) {
    if (W.has(tx0 + ',' + ty0)) return true;
    t += 1;
    if (t > dx && t > dy) break;
    if (t === dx) tx0 += sx;
    if (t === dy) ty0 += sy;
  }
  /* Check the endpoint tile too. */
  return W.has(tx1 + ',' + ty1);
}
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
    if (this.groundOnly && e.flying && !e.grounded) return false;
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
    /* Shot-blocking terrain: straight shots die on wall tiles. Lobbed shells
       already returned above -- they arc over cover, which is the whole point
       of a mortar on a walled board. */
    if (FIELD.walls && FIELD.walls.size > 0) {
      const px = this.x - this.vx * dt, py = this.y - this.vy * dt;
      if (wallBlocksShot(px, py, this.x, this.y)) { this.dead = true; return; }
    }
    if (this.age > 3 || this.x < -80 || this.y < -80 || this.x > game.width + 80 || this.y > game.height + 80) { this.dead = true; return; }
    for (const e of hostileCandidates(game.enemies, this.side)) {
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
        for (const o of hostileCandidates(game.enemies, this.side))
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
      enemy.applyPoison(s.poisonDps * st, (s.poisonPct || 0) * st, (s.poisonMaxPct || 0) * st, (s.poisonDur || 4) * st, s.maxStacks || 5, s.contagion || 0, t);
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
    /* FLAK. Every hit re-cripples the flyer onto the deck; the ceiling is in
       applyGrounded so a battery cannot hold a flight down for ever. */
    if (s.downFor) enemy.applyGrounded(s.downFor * st);
    if (this.stun) enemy.applyFreeze(this.stun);
  }
  detonate(game) {
    const r = this.splash * TILE;
    if (r > 0) {
      Sound.play('explosion', clamp(this.splash / 1.5, 0.6, 1.6));
      game.shake(clamp(this.splash * 2.2, 1.2, 7));
      game.spawnExplosion(this.x, this.y, r, this.color);
      const r2 = r * r;
      for (const e of hostileCandidates(game.enemies, this.side)) {
        if (e.dead || e.hostileTo !== this.side) continue;
        if (this.groundOnly && e.flying && !e.grounded) continue;
        if (this.airOnly && !e.flying) continue;
        const d2 = dist2(this.x, this.y, e.x, e.y);
        if (d2 > r2) continue;
        const falloff = 1 - 0.55 * (Math.sqrt(d2) / r);
        const t = this.tower, s = t ? t.stats : {};
        let dmg = this.damage * falloff;
        if (s.brittle && (e.slowTimer > 0 || e.freezeTimer > 0)) dmg *= s.brittle;
        const had = e.hp + e.shield;
        const dealt = e.takeDamage(dmg, this.dmgType, { pierce: this.pierce });
        if (t) t.registerDamage(dealt, e, game);
        /* BOMBARD -- what the kill did not need rolls onward. */
        if (s.overkill && e.dead && dmg > had) this.rollOverkill((dmg - had) * s.overkill, e, game);
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
    ctx.shadowColor = this.color; ctx.shadowBlur = Game.renderOverview ? 0 : 10; ctx.fillStyle = this.color;
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

/* ==========================================================================
   SESSION 19. THE SIX: READERS
   --------------------------------------------------------------------------
   Every base key the six new towers carry is SPENT here. The rule this file
   is held to (docs/TOWER-AUDIT.md) is that a key without a reader is an
   inert tower, and this project has already shipped five talents and six
   commander traits exactly that way.

   Three of the six do not watch enemies at all:

     SEPULCHRE watches YOUR OWN tower list and reacts to absence from it.
       Nothing sets `dead` on a Tower -- all eighteen writers of that flag are
       enemies, projectiles or constructs -- so membership of S.towers is the
       only honest test of whether a tower is still on the board, and it is
       the test Game.sell, Game.relocate and THE CONTRACTION all already use.
       Watching membership rather than hooking sell() is deliberate: it covers
       every route a tower can leave by, including the two that exist today
       (the sell button/`S` hotkey, and the maelstrom horizon eating the tile)
       and any third one added later.

     ORISON watches ONE named creature for its whole life, including the ways
       it can end that are not a kill.

     ANTIPHON watches bodies dying on a board it does not own, addressed by
       Game.rivalOf's own vocabulary (`owner` / `hostileTo`) rather than by a
       seat index -- so it is correct at seat 2 and in the twenty-seat arena
       without a special case, and it never touches `sendPaths`, which both
       multi-seat builders hard-code to two entries.
   ========================================================================== */

/* ------------------------------------------------------------- THE OFFERING */

/**
 * The live offering a side has named this wave, or null.
 *
 * Held on the chapel that named it rather than on the side, because a jammed
 * ORISON never runs its handler: a flag written onto the side would have no
 * one left to clear it and the blessing would stand for the rest of the
 * match. Everything about the offering is therefore PULLED, never pushed.
 */
function orisonOffering(side) {
  const S = Game.sides && Game.sides[side];
  if (!S || !S.towers) return null;
  for (const t of S.towers) {
    const e = t.offering;
    /* `leaked` and `charmed` are endings too. The reap splices the body out
       of Game.enemies in the same frame it is flagged, but the object itself
       survives on this reference, which is the only reason the chapel can
       tell a kill from a breach at all. */
    if (e && !e.dead && !e.leaked && e.hostileTo === side) return e;
  }
  return null;
}

/** True when some chapel on this side has already named its offering for
    `wave`. One offering per SIDE per wave: two chapels lend twice over, but
    they cannot each ransom a life off the same wave. */
function orisonNamedThisWave(side, wave) {
  const S = Game.sides && Game.sides[side];
  if (!S || !S.towers) return false;
  for (const t of S.towers) if (t.orisonNamed && t.orisonWave === wave) return true;
  return false;
}

/* Folded once per frame per side. effDamage is called several hundred times
   in a frame and it must not walk the tower list each time. Keyed on the
   SIDES ARRAY as well as the clock, because a new battle rebuilds that array
   and restarts the clock -- without the identity test the first frame of the
   second battle would read the first battle's fold. */
const _offeringFold = { sides: null, t: -1, dmg: [], rate: [] };
function offeringFold() {
  const G = typeof Game === 'undefined' ? null : Game;
  if (!G || !G.sides) return null;
  if (_offeringFold.sides !== G.sides || _offeringFold.t !== G.clock) {
    _offeringFold.sides = G.sides;
    _offeringFold.t = G.clock;
    for (let i = 0; i < G.sides.length; i++) {
      let d = 0, r = 0;
      if (orisonOffering(i)) {
        for (const t of G.sides[i].towers) {
          /* A silenced chapel lends nothing, exactly as a silenced Beacon
             stops relighting. */
          if (!t.stats.offeringDmg || t.jammed) continue;
          d += t.stats.offeringDmg;
          r += t.stats.offeringRate || 0;
        }
      }
      _offeringFold.dmg[i] = d;
      _offeringFold.rate[i] = r;
    }
  }
  return _offeringFold;
}
function offeringDamageMul(side) { const f = offeringFold(); return f ? 1 + (f.dmg[side] || 0) : 1; }
function offeringRateMul(side)   { const f = offeringFold(); return f ? 1 + (f.rate[side] || 0) : 1; }

/* ------------------------------------------------------------ THE DEPARTED */

/**
 * Towers that were on `side`'s board last frame and are not on it now.
 *
 * Refreshed once per frame however many Sepulchres ask, and each of them
 * raises its own ward off the same departure -- two chapels over one tile is
 * two wards, which is what the second chapel was paid for.
 *
 * The snapshot carries the departing tower's OWN estimateDps figure, which is
 * the number the inspector prints and the rival prices with. Re-deriving a
 * ward's output from thirty attack verbs would have been a second definition
 * of every tower in the game, and this project has shipped seven desyncs of
 * exactly that shape.
 */
/**
 * What a departing tower is worth to a ward, in damage per second.
 *
 * estimateDps is the rival's PRICING figure, not an output figure, and for the
 * supply verbs it is GOLD converted onto the damage scale. `isSupport` already
 * zeroes `aura` and `economy` inside estimateDps -- which is why a sold VAULT
 * and a sold BEACON correctly raise no ward at all -- but `depot` is not in
 * that getter, and its branch returns waveBonus and requisition multiplied by
 * AI_ECON_UPGRADE_WEIGHT. Measured at wave 1 on the merged tree, a sold
 * QUARTERMASTER raised a ward dealing 79.2 magic damage per second at the base
 * 0.40 share and about 182/s at MARTYRIUM, against roughly 10/s for the best
 * real gun on that board. A tower that has never dealt a point of damage
 * cannot leave a ward that does: the caller already drops a zero.
 */
function wardDps(t) {
  /* A sold COLDFRONT or SUTURE must raise no ward: their estimates are
     control PRICES, and a sepulchre ward fires real damage -- the
     QUARTERMASTER lesson, applied to every verb priced that way. */
  if (t.isSupport || t.def.attack === 'depot'
      || t.def.attack === 'front' || t.def.attack === 'graft') return 0;
  return t.estimateDps();
}

const _sepulchreCensus = [];
function sepulchreDepartures(side, game) {
  const S = game.sides[side];
  let c = _sepulchreCensus[side];
  if (!c || c.sides !== game.sides) c = _sepulchreCensus[side] = { sides: game.sides, t: -1e9, seen: [], gone: [] };
  if (c.t === game.clock) return c.gone;
  /* COLD START. A held list older than SEPULCHRE_CENSUS_GAP belongs to a
     chapel that was jammed, or to a chapel sold waves ago -- diffing against
     it would read every tower built since as a departure and raise a ward
     for each. */
  const cold = (game.clock - c.t) > SEPULCHRE_CENSUS_GAP;
  c.t = game.clock;
  c.gone.length = 0;
  if (!cold) for (const rec of c.seen) if (S.towers.indexOf(rec.tower) < 0) c.gone.push(rec);
  c.seen.length = 0;
  for (const t of S.towers)
    c.seen.push({ tower: t, x: t.x, y: t.y, r: t.rangePx, dps: wardDps(t),
                  dmgType: t.stats.dmgType, color: t.def.color, name: t.def.name });
  return c.gone;
}

/* ----------------------------------------------------------- THE PAID SEND */

/**
 * Tag the bodies a MUSTER puts on the board.
 *
 * `reanimated` is true for a bought detachment AND for a corpse your own kill
 * sent onward, and Game.muster passes no field that tells the two apart -- so
 * the only honest signal is the CALL. Counting reanimates too would make
 * ANTIPHON fire on every kill anybody makes, which is the opposite of the
 * curve it is designed to have.
 *
 * Wrapped rather than edited because Game is defined after this file; the
 * wrap is installed the first time a chapel actually needs it, is idempotent,
 * and changes nothing about what muster does. entities2.js already extends
 * Enemy.update, Enemy.takeDamage, Enemy.totalArmor and Tower.estimateDps the
 * same way -- this is the house pattern, not a workaround.
 */
function ensurePaidSendLedger() {
  if (typeof Game === 'undefined' || !Game.muster || Game._paidSendLedger) return;
  Game._paidSendLedger = true;
  const inner = Game.muster;
  Game.muster = function (side, tier) {
    const before = this.pendingSpawns.length;
    const ok = inner.call(this, side, tier);
    if (ok) for (let i = before; i < this.pendingSpawns.length; i++) this.pendingSpawns[i].paidSend = true;
    return ok;
  };
}

/* --------------------------------------------------------------- THE DEATH */

/**
 * The ONE death site. Called from Enemy.takeDamage the instant a body loses
 * its last point of health, and deliberately not from Game.killEnemy: that
 * funnel is also reached by SIREN's conversion, by a Custodian's oath and by
 * the posthumous sweep of an eliminated seat, none of which is a kill. What
 * arrives here was shot to death by something.
 */
function onEnemyDeath(e) {
  const G = typeof Game === 'undefined' ? null : Game;
  if (!G || !G.sides) return;

  /* GESTALT feeds on whatever dies inside its reach, no matter which tower
     did it -- the defender is `hostileTo`, since only that side's guns could
     have been shooting at this body. */
  const D = G.sides[e.hostileTo];
  if (D && D.towers) {
    for (const t of D.towers) {
      const per = t.stats.gestaltPerKill;
      if (!per || t.jammed) continue;
      if (dist2(t.x, t.y, e.x, e.y) > t.rangePx * t.rangePx) continue;
      const cap = Math.max(1, Math.round(t.stats.gestaltMax || 20));
      if ((t.gestaltStacks || 0) < cap) t.gestaltStacks = (t.gestaltStacks || 0) + 1;
      /* The clock is stamped even at the ceiling: a full Gestalt still being
         fed has plainly not gone quiet, and forgetting it at the cap would
         punish the exact placement the tower asks for. */
      t.gestaltLast = G.clock;
    }
  }

  /* ANTIPHON answers a body its side PAID for that died on somebody else's
     ground. `owner` and `hostileTo` are the same vocabulary Game.muster and
     Game.rivalOf use, so this is correct at seat 2 and on all twenty seats
     without a special case. */
  if (e.paidSend && e.owner !== undefined && e.owner !== null && e.owner !== e.hostileTo) {
    const O = G.sides[e.owner];
    if (O && O.towers) {
      for (const t of O.towers) {
        const per = t.stats.antiphonPerLoss;
        if (!per || t.jammed) continue;
        const cap = Math.max(1, t.stats.antiphonBank || 4);
        t.answers = Math.min(cap, (t.answers || 0) + per);
        if (t.side === G.viewSide) G.spawnBurst(t.x, t.y, 6, t.def.color, 80);
      }
    }
  }
}

/* ------------------------------------------------------ BEHAVIOUR: THE SIX */

/* SEPULCHRE, hold the line for towers that are no longer on it. */
Tower.prototype.atk_sepulchre = function (dt, game) {
  const s = this.stats;
  if (!this.wards) this.wards = [];
  const cap = Math.min(SEPULCHRE_WARDS_MAX, Math.max(1, Math.round(s.sepulchreWards || 1)));
  const r2 = this.rangePx * this.rangePx;

  for (const rec of sepulchreDepartures(this.side, game)) {
    if (rec.tower === this) continue;
    /* A tower with no output leaves no ward. A sold Vault has nothing to
       keep firing, and letting it take a ward slot would let a player fill a
       Necropolis with economy towers and lock the chapel out of the gun it
       is actually about to sell. */
    if (rec.dps <= 0) continue;
    if (this.wards.length >= cap) continue;
    if (dist2(this.x, this.y, rec.x, rec.y) > r2) continue;
    this.wards.push({
      x: rec.x, y: rec.y, r: rec.r, dps: rec.dps, color: rec.color,
      /* Carried so the inspector can name what is standing on the chapel.
         The census already snapshots it for the floater; without it the
         panel could only ever print a count. */
      name: rec.name,
      /* A ward that carried no damage type of its own strikes as magic
         rather than as `none`, which takeDamage treats as unmitigated. */
      dmgType: (rec.dmgType && rec.dmgType !== 'none') ? rec.dmgType : 'magic',
      t: (s.sepulchreDur || 16), wave: game.wave, cd: 0
    });
    if (s.sepulchreGold) game.awardGold(this.side, s.sepulchreGold, this);
    game.spawnBurst(rec.x, rec.y, 16, this.def.color, 130);
    if (this.side === game.viewSide) {
      Sound.play('forge');
      game.addFloater(rec.x, rec.y - 16, rec.name + ' KEPT', false, this.def.color, 13);
    }
  }

  /* Read live rather than captured, so upgrading the chapel strengthens the
     wards already standing on it. SEPULCHRE_FRAC_MAX is applied HERE because
     branches and ascension surges bypass STAT_CEIL entirely. */
  const frac = Math.min(SEPULCHRE_FRAC_MAX, s.sepulchreFrac || 0);
  for (let i = this.wards.length - 1; i >= 0; i--) {
    const w = this.wards[i];
    w.t -= dt;
    /* "Until the wave ends" is read as the wave NUMBER turning over, which is
       the only unambiguous edge: onWaveSpawned fires when the last unit has
       SPAWNED, not when the board is clear. */
    if (w.t <= 0 || w.wave !== game.wave) {
      this.wards.splice(i, 1);
      game.spawnBurst(w.x, w.y, 8, '#94a3b8', 70);
      continue;
    }
    w.cd -= dt;
    if (w.cd > 0) continue;
    w.cd = SEPULCHRE_TICK;
    let best = null, bd = Infinity;
    const wr2 = w.r * w.r;
    for (const e of game.enemies) {
      if (e.dead || e.leaked || e.hostileTo !== this.side) continue;
      const d2 = dist2(w.x, w.y, e.x, e.y);
      if (d2 <= wr2 && d2 < bd) { bd = d2; best = e; }
    }
    if (!best) continue;
    const dealt = best.takeDamage(w.dps * frac * SEPULCHRE_TICK, w.dmgType, { pierce: this.effPierce });
    this.registerDamage(dealt, best, game);
    game.beams.push({ points: [{ x: w.x, y: w.y }, { x: best.x, y: best.y }],
                      life: 0.16, maxLife: 0.16, color: w.color, width: 2 });
  }
};

/* ORISON, name one creature the offering, and settle what it owes. */
Tower.prototype.atk_orison = function (dt, game) {
  const s = this.stats;
  const e = this.offering;
  if (e) {
    /* THREE endings, and only one of them is the offering being accepted.
       `charmed` is the engine's removed-not-killed flag (a Custodian's oath,
       a Siren's conversion, a Maw), `leaked` is the creature walking into
       your own base -- which you have already paid for in lives -- and
       `dead` without `charmed` is the only thing that was actually killed.
       A reanimate raised off the corpse is a NEW body carrying none of these
       fields, so one enemy can never settle the rite twice. */
    if (e.dead && !e.charmed) {
      this.offering = null;
      const n = Math.min(ORISON_LIVES_MAX, Math.round(s.offeringLives || 0));
      if (n > 0) game.restoreLife(this.side, n, this);
      if (s.offeringGold) game.awardGold(this.side, s.offeringGold, this);
      game.spawnBurst(e.x, e.y, 20, this.def.color, 150);
      if (this.side === game.viewSide) {
        Sound.play('heal');
        game.addFloater(this.x, this.y - 24, 'OFFERING TAKEN', false, this.def.color, 14);
      }
    } else if (e.leaked || e.charmed || e.hostileTo !== this.side) {
      /* The rite lapses. Nothing is owed in either direction, and nothing is
         re-named: one offering per wave is the whole tension. */
      this.offering = null;
    }
  }

  if (this.orisonWave !== game.wave) {
    this.orisonWave = game.wave;
    this.orisonNamed = false;
    this.orisonT = 0;
    this.offering = null;
  }
  this.orisonT = (this.orisonT || 0) + dt;

  if (this.orisonNamed) return;
  /* Wait for the wave to finish arriving before choosing, or the first mite
     out of the gate is named and the boss behind it is not. The delay is the
     ceiling on that wait, not the wait itself. */
  if (game.waveRunning && this.orisonT < ORISON_NAMING_DELAY) return;
  if (orisonNamedThisWave(this.side, game.wave)) return;

  let best = null, bh = -1;
  for (const c of game.enemies) {
    /* Your own dead marching at somebody else are not part of the wave
       walking at you, and a body already dedicated cannot be dedicated
       twice. */
    if (c.dead || c.leaked || c.reanimated || c.hostileTo !== this.side) continue;
    if (c.offeringOf !== undefined) continue;
    if (c.maxHp > bh) { bh = c.maxHp; best = c; }
  }
  if (!best) return;
  this.offering = best;
  this.orisonNamed = true;
  best.offeringOf = this.side;
  /* Captured on the body rather than looked up per hit: takeDamage is the
     hottest path in the simulation and it must not walk a tower list. The
     consequence is that upgrading the chapel does not re-bless an offering
     already named, which is the correct reading of a rite. */
  if (s.offeringGuard) best.offeringGuard = s.offeringGuard;
  game.spawnBurst(best.x, best.y, 14, this.def.color, 120);
  if (this.side === game.viewSide) {
    Sound.play('choice');
    game.addFloater(best.x, best.y - 20, 'THE OFFERING', false, this.def.color, 14);
  }
};

/* ANTIPHON, spend what your losses on rival ground have banked. */
Tower.prototype.atk_antiphon = function (dt, game) {
  ensurePaidSendLedger();
  const s = this.stats;
  this.cooldown -= dt;
  const target = this.acquire(game.enemies);
  if (target) {
    const aim = this.predict(target, s.projSpeed);
    this.angle = angleLerp(this.angle, Math.atan2(aim.y - this.y, aim.x - this.x), Math.min(1, dt * 14));
  }
  if (!target || this.cooldown > 0 || (this.answers || 0) < 1) return;
  this.answers -= 1;
  this.cooldown = 1 / this.effRate;
  this.recoil = 1;
  /* Straight to the projectile path rather than through fire(), whose switch
     only knows the six core verbs -- an unlisted verb there fires nothing at
     all and reads exactly like a banking bug. */
  this.fireProjectile(target, game);
  /* A votive thread to the ground the answer was bought on: without it the
     player sees a tower that fires at random and cannot connect it to the
     detachment they just lost. */
  if (this.side === game.viewSide) game.addFloater(this.x, this.y - 22, 'ANSWERED', false, this.def.color, 13);
};

/* GESTALT, grow on every body that dies in reach; forget the lot on a lull. */
Tower.prototype.atk_gestalt = function (dt, game) {
  const s = this.stats;
  /* USE IT OR LOSE IT. The whole stack goes at once, not a point at a time:
     a decay that trickled would just be a slightly worse ramp, and this
     tower's cost is supposed to be the TILE. */
  if ((this.gestaltStacks || 0) > 0 &&
      game.clock - (this.gestaltLast || 0) > (s.gestaltDecay || 9)) {
    this.gestaltStacks = 0;
    game.spawnBurst(this.x, this.y, 14, '#64748b', 90);
    if (this.side === game.viewSide) {
      Sound.play('denied');
      game.addFloater(this.x, this.y - 22, 'FORGOTTEN', false, '#94a3b8', 14);
    }
  }
  const target = this.acquire(game.enemies);
  if (target) {
    const aim = this.predict(target, s.projSpeed);
    this.angle = angleLerp(this.angle, Math.atan2(aim.y - this.y, aim.x - this.x), Math.min(1, dt * 14));
  }
  this.cooldown -= dt;
  if (target && this.cooldown <= 0) { this.cooldown = 1 / this.effRate; this.recoil = 1; this.fireProjectile(target, game); }
};

/* MAW, remove one creature from the board and digest it into gold. */
Tower.prototype.atk_maw = function (dt, game) {
  const s = this.stats;

  /* Digestion pays in whole gold through awardGold, so mods.gold applies to
     it exactly once and exactly as it would have applied to the bounty this
     replaces. Paid against the RUNNING TOTAL rather than by accumulating
     fractions frame by frame: the last instalment is whatever is still owed,
     so a meal pays exactly what it was worth and never a coin less. */
  if ((this.digestLeft || 0) > 0) {
    this.digestLeft = Math.max(0, this.digestLeft - (this.digestTotal / Math.max(0.5, this.digestDur)) * dt);
    const due = (this.digestLeft <= 0 ? this.digestTotal
                                      : Math.floor(this.digestTotal - this.digestLeft)) - (this.digestPaid || 0);
    if (due > 0) {
      this.digestPaid = (this.digestPaid || 0) + due;
      game.awardGold(this.side, due, this);
    }
    if (Math.random() < dt * 8)
      game.spawnParticle(this.x + rand(-9, 9), this.y + rand(-9, 9), rand(-6, 6), rand(-24, -6), rand(0.3, 0.6), rand(1.5, 3), '#c084fc', 'spark');
  }

  this.mawT = (this.mawT === undefined ? (s.mawCd || 18) * 0.5 : this.mawT) - dt;
  if (this.mawT > 0) return;

  let best = null, bh = -1;
  const r2 = this.rangePx * this.rangePx;
  for (const e of game.enemies) {
    if (e.dead || e.leaked || e.charmed || e.hostileTo !== this.side) continue;
    /* A boss is too large to swallow until TITAN'S PORTION says otherwise.
       Minibosses are fair game at base -- being the answer to one heavy body
       is the tower's entire reason to exist. */
    if (e.boss && !s.mawBoss) continue;
    if (dist2(this.x, this.y, e.x, e.y) > r2) continue;
    if (e.hp > bh) { bh = e.hp; best = e; }
  }
  if (!best) { this.mawT = MAW_EMPTY_RETRY; return; }
  this.mawT = (s.mawCd || 18);

  /* REMOVAL, stated in full, because a removal that quietly pays a bounty is
     a duplication exploit:
       - `charmed` is the engine's REMOVED-NOT-KILLED flag. Game.killEnemy
         returns on it before awardGold, before S.stats.kills++, before the
         death-heal and contagion clauses, and before reanimate() -- so the
         swallowed creature pays NO bounty, banks NO kill for the side and
         leaves NO corpse for anybody to send onward.
       - `_counted` stops registerDamage/credit booking a kill for some other
         tower that happened to be shooting it.
       - the Maw books the kill on ITSELF, so the inspector's own figure
         still says what this tower has taken off the board.
       - `dead` is what makes the reap splice it out of Game.enemies, so the
         wave is one creature shorter and every "remaining" figure in the
         game derives from that same array.
       - the digest below is a REPLACEMENT for the bounty, never a second
         copy of it. */
  best.dead = true;
  best._counted = true;
  best.charmed = true;
  best.devoured = true;
  this.kills++;
  const meal = Math.max(0, Math.round((best.bounty || 0) * Math.min(MAW_YIELD_MAX, s.mawYield || 1)));
  /* A second meal taken mid-digest folds whatever is still owed into one
     ledger, so the first one is never dropped on the floor. */
  this.digestTotal = (this.digestLeft || 0) + meal;
  this.digestLeft = this.digestTotal;
  this.digestPaid = 0;
  this.digestDur = Math.max(0.5, s.mawDigest || 6);
  this.recoil = 1;
  game.spawnImplosion(best.x, best.y, 48, this.def.color);
  game.beams.push({ points: [{ x: this.x, y: this.y }, { x: best.x, y: best.y }],
                    life: 0.35, maxLife: 0.35, color: this.def.color, width: 3.5 });
  if (this.side === game.viewSide) {
    Sound.play('siren');
    game.addFloater(best.x, best.y - 18, 'SWALLOWED', false, this.def.color, 15);
  }
};

/* HUNGERING VEIL, call in what a creature has been given. */
Tower.prototype.atk_veil = function (dt, game) {
  const s = this.stats;
  const tax = s.veilHealTax || 0;
  const r2 = this.rangePx * this.rangePx;
  for (const e of game.enemies) {
    if (e.dead || e.leaked || e.hostileTo !== this.side) continue;
    if (dist2(this.x, this.y, e.x, e.y) > r2) continue;
    /* Refreshed a little longer than a frame so a body on the edge of the
       field is not flickering in and out of the effect. */
    if (s.veilSlow) e.applySlow(s.veilSlow * this.effStatus, 0.3);
    const debt = e.healDebt || 0;
    if (debt <= 0 || tax <= 0) continue;
    if (s.veilVuln) e.applyVuln(s.veilVuln, 0.4);
    const called = Math.min(debt, debt * VEIL_COLLECT_RATE * dt);
    e.healDebt = debt - called;
    /* Banked to VEIL_MIN_CHARGE before it is applied: takeDamage floors any
       non-DOT hit at one whole point, so charging a fraction per frame would
       bill sixty points a second off a body that was barely healed. */
    e.veilPending = (e.veilPending || 0) + called * tax;
    if (e.veilPending < VEIL_MIN_CHARGE) continue;
    const amt = e.veilPending;
    e.veilPending = 0;
    /* `pure` on purpose. A debt is not stopped by armour and not absorbed by
       the shield that is itself part of the debt. */
    const dealt = e.takeDamage(amt, 'pure', {});
    this.registerDamage(dealt, e, game, false, true);
    if (s.veilTithe) {
      this.titheAcc = (this.titheAcc || 0) + dealt;
      while (this.titheAcc >= VEIL_TITHE_PER) {
        this.titheAcc -= VEIL_TITHE_PER;
        game.awardGold(this.side, s.veilTithe, this);
      }
    }
    if (Math.random() < 0.5)
      game.spawnParticle(e.x + rand(-6, 6), e.y + rand(-6, 6), rand(-5, 5), rand(-26, -8), rand(0.3, 0.6), rand(1.5, 3), '#c084fc', 'spark');
  }
};


/* ==========================================================================
   THE SIX -- WHAT TO PRINT

   ONE statement of every figure the inspector shows for these six towers,
   defined here beside the verbs that move them rather than inside the panel
   that shows them.

   Every one of the seven UI/engine desyncs this project has shipped was a
   second copy of an engine expression living in ui.js -- a ceiling applied in
   the tick and not in the panel, or an authored figure quoted where a charged
   one was meant. The six towers below are all ceilinged somewhere, so each
   ceiling is stated once, here, and ui.js calls it.
   ========================================================================== */
const SixRead = {
  /* The ward cap atk_sepulchre actually enforces, SEPULCHRE_WARDS_MAX and all. */
  wardCap(t) {
    return Math.min(SEPULCHRE_WARDS_MAX, Math.max(1, Math.round(t.stats.sepulchreWards || 1)));
  },
  /* The share a ward keeps. Through SEPULCHRE_FRAC_MAX because branches and
     ascension surges bypass STAT_CEIL entirely, so the authored figure can
     exceed what the tick will ever pay out. */
  wardShare(t) { return Math.min(SEPULCHRE_FRAC_MAX, t.stats.sepulchreFrac || 0); },
  /* What the wards STANDING are dealing per second: each departed tower's own
     captured estimateDps, times that share. Same two terms the tick uses. */
  wardOutput(t) {
    let held = 0;
    for (const w of (t.wards || [])) held += w.dps;
    return held * this.wardShare(t);
  },
  offeringLives(t) { return Math.min(ORISON_LIVES_MAX, Math.round(t.stats.offeringLives || 0)); },
  answerCap(t) { return Math.max(1, t.stats.antiphonBank || 4); },
  volley(t) { return Math.max(1, Math.round(t.stats.antiphonVolley || 1)); },
  gestaltCap(t) { return Math.max(1, Math.round(t.stats.gestaltMax || 20)); },
  /* Seconds before the WHOLE stack goes, or null when there is nothing to
     forget. Never negative: the tick zeroes the stack on the frame it would
     otherwise pass zero. */
  gestaltForget(t) {
    if (!(t.gestaltStacks > 0)) return null;
    return Math.max(0, (t.stats.gestaltDecay || 9) - (Game.clock - (t.gestaltLast || 0)));
  },
  mawYield(t) { return Math.min(MAW_YIELD_MAX, t.stats.mawYield || 1); },
  mawDigestDur(t) { return Math.max(0.5, t.stats.mawDigest || 6); },
  mawOwed(t) { return Math.max(0, t.digestLeft || 0); },
  /* Seconds until the mouth opens. mawT is seeded to half the cooldown the
     first time the verb runs, so a Maw that has never opened reports the wait
     it is actually serving rather than the full cooldown it never had. */
  mawNext(t) {
    return Math.max(0, t.mawT === undefined ? (t.stats.mawCd || 18) * 0.5 : t.mawT);
  },
  /* Every point of healing standing inside the veil right now, over the same
     hostility and range tests atk_veil walks. Called at panel cadence (0.12s),
     never per frame. */
  veilDebt(t, game) {
    const g = game || Game;
    const r2 = t.rangePx * t.rangePx;
    let debt = 0, bodies = 0;
    for (const e of g.enemies) {
      if (e.dead || e.leaked || e.hostileTo !== t.side) continue;
      if (dist2(t.x, t.y, e.x, e.y) > r2) continue;
      if ((e.healDebt || 0) > 0) { debt += e.healDebt; bodies++; }
    }
    return { debt: debt, bodies: bodies };
  }
};


/* ==========================================================================
   SESSION 19 -- THE PIRATE THREE AND THE MACHINE TWO

   Hung off Tower.prototype and appended here rather than threaded through the
   core, in the same shape entities2.js already uses. Tower.update dispatches
   `this['atk_' + def.attack]` before its own switch, so a new verb needs no
   change to the dispatcher.

   Every `base` key these towers declare is read below or in recompute():

     pressCd pressDur pressHp pressDps pressMax pressBlast  -- atk_press,
       pressConscript, class Conscript
     privateerSteal privateerScuttle privateerPick          -- privateerTake
     lifeCost                                               -- Game.towerLifeCost
     bloodRate                                              -- Tower.rateMul
     bloodTally                                             -- Tower.onKill
     replicateEvery replicateReach replicateCount
       replicateLevel replicatePick                         -- atk_replicate,
       replicateOnce
     nullRadius                                             -- Tower.recompute
     nullVuln nullSlow nullBackfire nullLinger              -- atk_null
   ========================================================================== */

/**
 * PRESS GANG's conscript. Not a Minion: a Minion is FORGED to a spec the
 * tower carries and lives until it is worn down, and this is built out of a
 * specific corpse and serves a fixed term. That difference is the tower --
 * FOUNDRY answers "how many bodies can I keep standing", PRESS GANG answers
 * "what did I just kill".
 */
class Conscript {
  constructor(tower, corpse) {
    const s = tower.stats;
    this.tower = tower;
    this.x = corpse.x; this.y = corpse.y;
    /* A SHARE of the corpse rather than a figure of its own. That is why this
       tower needs no wave curve of its own and why it still fades: the share
       is constant, the number of bodies a wave puts on the lane is not. */
    this.maxHp = Math.max(PRESS_MIN_HP, corpse.maxHp * (s.pressHp || 0.5));
    this.hp = this.maxHp;
    this.dps = s.pressDps || 6;
    /* The term of service. When it expires the hand simply falls apart --
       DEAD MAN'S SHARE is the only thing it leaves behind. */
    this.life = s.pressDur || 8;
    this.dead = false; this.age = 0; this.target = null;
  }

  update(dt, game) {
    this.age += dt;
    this.life -= dt;
    const t = this.tower;
    /* A conscript belongs to the tower that pressed it: sell the Press Gang
       and the crew goes with it, because atk_press is what ticks them and a
       sold tower is no longer in S.towers. */
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
      const spd = PRESS_ENGAGE_SPEED * TILE;
      if (d > tg.radius + 8) { this.x += dx / d * spd * dt; this.y += dy / d * spd * dt; }
      else {
        const dealt = tg.takeDamage(t.effDamageFor(this.dps) * dt, 'physical', { pierce: t.effPierce });
        t.registerDamage(dealt, tg, game, false, true);
        /* It HOLDS as well as hits -- a pressed hand grabs. Half a Foundry
           automaton's grip, so the two do not answer the same question. */
        tg.applySlow(0.22 * t.effStatus, 0.25);
        this.hp -= (PRESS_TRAMPLE + tg.radius) * dt;
      }
    } else {
      const dx = t.x - this.x, dy = t.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 26) { this.x += dx / d * 2.2 * TILE * dt; this.y += dy / d * 2.2 * TILE * dt; }
    }

    if (this.hp <= 0 || this.life <= 0) {
      this.dead = true;
      const blast = t.stats.pressBlast;
      if (blast) {
        const r = 1.1 * TILE, r2 = r * r;
        for (const e of game.enemies) {
          if (e.dead || e.hostileTo !== t.side) continue;
          if (dist2(this.x, this.y, e.x, e.y) <= r2) {
            const dealt = e.takeDamage(t.effDamageFor(this.dps) * blast, 'physical', {});
            t.registerDamage(dealt, e, game);
          }
        }
        game.spawnExplosion(this.x, this.y, r, t.def.color);
      } else game.spawnBurst(this.x, this.y, 6, t.def.color, 70);
    }
  }

  draw(ctx) {
    const c = this.tower.def.color;
    ctx.save();
    ctx.translate(this.x, this.y);
    const b = Math.sin(this.age * 7) * 1.2;
    /* Ragged rather than machined -- a Foundry automaton is a rounded box and
       a conscript must not be mistaken for one at a glance. */
    ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -8 + b); ctx.lineTo(6, -1 + b); ctx.lineTo(4, 6 + b);
    ctx.lineTo(-4, 6 + b); ctx.lineTo(-6, -1 + b);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const f = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-7, -13, 14, 2.5);
    ctx.fillStyle = f > 0.5 ? '#fca5a5' : '#f87171'; ctx.fillRect(-7, -13, 14 * f, 2.5);
    ctx.restore();
  }
}

/**
 * THE KILL FUNNEL. registerDamage, originStrike and Enemy.credit are the
 * three places a kill is credited to a tower, and all three call this -- so a
 * prize is paid exactly once per body however it died, and never for a body
 * some other tower finished.
 */
Tower.prototype.onKill = function (enemy, game) {
  const s = this.stats;
  if (!s) return;
  if (s.pressCd) this.pressConscript(enemy, game);
  if (s.privateerSteal) this.privateerTake(enemy, game);
  /* BLOOD DEBT. The only route by which a life spent on a Blood Price comes
     back, and it comes back through the counter rather than the ledger --
     `livesPaid` is untouched, so repaying the debt does not un-buy the fire
     rate it bought. */
  if (s.bloodTally) {
    this.bloodKills = (this.bloodKills || 0) + 1;
    if (this.bloodKills >= s.bloodTally) {
      this.bloodKills = 0;
      game.restoreLife(this.side, 1, this);
    }
  }
};

/** PRESS GANG -- drag the corpse back onto its feet. */
Tower.prototype.pressConscript = function (enemy, game) {
  const s = this.stats;
  if ((this.pressT || 0) > 0) return;
  this.minionList = this.minionList || [];
  if (this.minionList.length >= (s.pressMax || 1)) return;
  this.pressT = s.pressCd;
  /* minionList, not a list of its own: Tower.draw already paints that array
     and a second one would need a second draw hook for no gain. Nothing else
     can collide -- FOUNDRY is the only other writer and it is a different
     attack verb, so no tower ever holds both kinds. */
  this.minionList.push(new Conscript(this, enemy));
  if (this.side === Game.viewSide) {
    game.spawnBurst(enemy.x, enemy.y, 8, this.def.color, 95);
    game.addFloater(enemy.x, enemy.y - 14, 'PRESSED', false, this.def.color, 12);
  }
};

/**
 * PRIVATEER -- lift a share of a rival commander's purse.
 *
 * A SHARE, never a sum. That is what makes the tower an investment that
 * compounds against a rival banking for an ascension and self-limiting
 * against one it has already emptied -- it can never lock a seat out of the
 * match, because every theft shrinks the next one.
 */
Tower.prototype.privateerTake = function (enemy, game) {
  const s = this.stats;
  /* Game.musterVictims is THE answer to "who is on the other side of this
     board" -- one rival on a duel, two on the Confluence, the next seat still
     standing round a twenty-seat ring. `sendPaths` has exactly two entries
     and indexing it by seat froze whole battles. */
  let victims = game.musterVictims(this.side);
  /* PICK THE PURSE widens the pool to every seat still standing. It has to:
     in the arena musterVictims returns exactly ONE seat -- the next round the
     ring -- so a talent that only sorted THAT list moved no gold at all on
     nineteen boards out of twenty, which is the inert-stat failure this
     project has shipped eleven times. A privateer answers to nobody,
     including its own sailing orders. */
  if (s.privateerPick) {
    victims = [];
    for (let k = 0; k < game.sides.length; k++) {
      const S = game.sides[k];
      if (k === this.side || !S || S.defeated || !S.alive) continue;
      victims.push(k);
    }
  }
  if (!victims.length) return;          /* every rival eliminated: nothing to take */
  /* Default: the seat this commander is already aimed at, so the tower reads
     the same way a send does. Only the talent goes shopping. */
  let v = victims[0];
  if (s.privateerPick)
    for (const k of victims) if (game.sides[k].gold > game.sides[v].gold) v = k;
  const V = game.sides[v];
  if (!V || V.defeated || V.gold <= 0) return;

  /* Capped in BOUNTIES so the ceiling rides the wave curve instead of needing
     a second copy of it. Uncapped, one early kill against an opening purse
     transfers a whole wave of income and the first kill decides the match. */
  const cap = Math.max(PRIVATEER_MIN_TAKE, Math.round(enemy.bounty * PRIVATEER_CAP_BOUNTIES));
  const take = Math.min(Math.max(PRIVATEER_MIN_TAKE, Math.floor(V.gold * s.privateerSteal)),
                        cap, Math.floor(V.gold));
  if (take <= 0) return;

  V.gold -= take;
  /* SCUTTLE burns what the boat cannot carry: the victim loses more than the
     raider gains, which is the only asymmetry in the tower and the reason it
     is a WEAPON against a commander rather than an income tower. */
  if (s.privateerScuttle) V.gold = Math.max(0, V.gold - Math.floor(take * s.privateerScuttle));

  /* Through awardGold so the raider's own gold modifiers, the difficulty's
     economy multiplier and the tower's goldMade ledger all apply exactly as
     they do to a bounty. The victim's loss is the RAW figure -- their purse
     is theirs and is not scaled by the thief's economy. */
  const got = game.awardGold(this.side, take, this);
  if (this.side === Game.viewSide && got > 0)
    game.addFloater(enemy.x, enemy.y - 20, '+' + got + ' PRIZE', false, '#fbbf24', 12);
};

/* PRESS GANG -- a real gun, and the crew its kills leave standing. */
Tower.prototype.atk_press = function (dt, game) {
  if (this.pressT > 0) this.pressT -= dt;
  this.minionList = this.minionList || [];
  for (let i = this.minionList.length - 1; i >= 0; i--) {
    this.minionList[i].update(dt, game);
    if (this.minionList[i].dead) this.minionList.splice(i, 1);
  }
  this.gunTick(dt, game);
};

/* REPLICATOR -- a small gun, and a machine that does not need you. */
Tower.prototype.atk_replicate = function (dt, game) {
  this.gunTick(dt, game);
  const s = this.stats;
  /* Counted in WAVES, because "after N waves" is what the card says and
     Game.wave is what that means. Armed at the wave it was placed, so it can
     never deliver on the frame it lands. */
  if (this.replWave === undefined) { this.replWave = game.wave; return; }
  const every = Math.max(REPLICATE_MIN_WAVES, s.replicateEvery || 4);
  if (game.wave - this.replWave < every) return;
  this.replWave = game.wave;
  for (let i = 0, n = Math.max(1, s.replicateCount || 1); i < n; i++) this.replicateOnce(game);
};

/** One free emplacement, or nothing at all. */
Tower.prototype.replicateOnce = function (game) {
  const s = this.stats;
  const S = game.sides[this.side];
  if (!S) return null;

  /* WHAT. Only out of this commander's own five, and only something the
     machine can account for: the gift's price is asked of Game.towerCost --
     the very call that would charge a player, so the per-type growth curve,
     the board-size inflation and the side's cost modifiers are all already in
     it -- and must be within the Replicator's own current price. */
  const budget = game.towerCost(this.side, this.type) * REPLICATE_BUDGET_MUL;
  const pool = [];
  for (const type of (S.loadout || [])) {
    const def = TOWER_TYPES[type];
    if (!def) continue;
    /* Never another Replicator: a machine that reproduces machines that
       reproduce compounds without bound, and the board is finite. */
    if (def.base && def.base.replicateEvery) continue;
    /* Never a life-priced tower. BLOOD PRICE quotes zero gold, which would
       make it the cheapest thing on every shelf and hand the commander the
       most expensive gun in the game for nothing -- the price is in lives and
       a gift cannot pay it. */
    if (def.base && def.base.lifeCost) continue;
    const cost = game.towerCost(this.side, type);
    if (cost > budget) continue;
    pool.push({ type, cost });
  }
  if (!pool.length) return null;
  /* "It does not ask which." DESIGN AUTHORITY is the talent that makes it
     ask: without it the pick is uniform, with it the machine takes the
     dearest thing it can account for. */
  const choice = s.replicatePick
    ? pool.reduce((a, b) => (b.cost > a.cost ? b : a))
    : pool[Math.floor(Math.random() * pool.length)];

  /* WHERE. Rings outward from the Replicator and stops at the first legal
     tile. Game.canBuild is the ONLY legality test used, which is what
     guarantees the gift respects ownership, the lane, authored terrain,
     arena rubble and anything already standing -- rather than a second copy
     of those rules that could drift from the one the player is held to. */
  const reach = Math.max(1, Math.round(s.replicateReach || 3));
  const spots = [];
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      if (!dx && !dy) continue;
      if (Math.abs(dx) + Math.abs(dy) > reach) continue;
      const gx = this.gx + dx, gy = this.gy + dy;
      if (!game.canBuild(this.side, gx, gy)) continue;
      spots.push({ gx, gy, d: Math.abs(dx) + Math.abs(dy) });
    }
  if (!spots.length) return null;
  spots.sort((a, b) => a.d - b.d);
  const at = spots[0];

  const t = game.buildFree(this.side, choice.type, at.gx, at.gy);
  if (!t) return null;
  /* SEED STOCK / ARCHETYPE. Applied through the same retrofit the base level
     uses, so a seeded tower reaches its specialisation by the identical path
     a bought one does. */
  const bump = Math.round(s.replicateLevel || 0);
  if (bump > 0) game.applyBaseLevelTo(t, (S.baseLevel || 1) + bump);
  game.recomputeAuras();
  if (this.side === Game.viewSide) {
    game.spawnBurst(t.x, t.y, 14, this.def.color, 120);
    game.addFloater(t.x, t.y - 22, 'REPLICATED', false, this.def.color, 12);
  }
  return t;
};

/**
 * NULL FIELD -- mark everything inside the volume, once per frame.
 *
 * The tower itself does exactly this and no more. Every actual suppression is
 * a read of `Enemy.nulled` at the tick that would have done the thing, which
 * is the only arrangement in which the field cannot quietly miss an ability:
 * there is no list here to keep up to date.
 */
Tower.prototype.atk_null = function (dt, game, ridersOff) {
  const s = this.stats;
  const r2 = this.rangePx * this.rangePx;
  /* HARD LOCK extends the mark past the boundary. NULL_MARK_SECONDS alone is
     just enough slack to survive a long frame. */
  const hold = NULL_MARK_SECONDS + (s.nullLinger || 0);
  /* JAMMED. The mark still lands -- see the jam clause in Tower.update -- but
     everything the field ADDS to it is silenced, and so is the backfire. */
  const vuln = ridersOff ? 0 : (s.nullVuln || 0);
  const slow = ridersOff ? 0 : (s.nullSlow || 0);
  let held = 0;
  for (const e of game.enemies) {
    if (e.dead || e.hostileTo !== this.side) continue;
    if (dist2(this.x, this.y, e.x, e.y) > r2) continue;
    e.nullT = Math.max(e.nullT || 0, hold);
    e.nullSrc = this;
    e.nullBackfire = ridersOff ? 0 : (s.nullBackfire || 0);
    if (vuln) e.applyVuln(vuln, NULL_MARK_SECONDS + 0.1);
    if (slow) e.applySlow(slow * this.effStatus, NULL_MARK_SECONDS + 0.1);
    held++;
  }
  /* A jammed emitter is not firing however much ground it still holds, so the
     dimmed sprite and the panel's own banner keep agreeing with each other. */
  this.firing = !ridersOff && held > 0;
  this.nullHeld = held;
};

/**
 * The ordinary acquire-aim-fire loop, factored out so PRESS GANG and
 * REPLICATOR fire through exactly the path every projectile tower uses. A
 * copy of Tower.update's tail would be a second definition of targeting, and
 * this file already carries the scars of second definitions.
 */
Tower.prototype.gunTick = function (dt, game) {
  const target = this.acquire(game.enemies);
  if (target) {
    const aim = this.predict(target, this.stats.projSpeed);
    this.angle = angleLerp(this.angle, Math.atan2(aim.y - this.y, aim.x - this.x), Math.min(1, dt * 14));
  }
  this.cooldown -= dt;
  if (target && this.cooldown <= 0) {
    this.cooldown = 1 / this.effRate;
    /* Tower.fire switches on def.attack and has no case for these verbs, so
       it is bypassed rather than extended -- the recoil it would have set is
       set here instead. */
    this.recoil = 1;
    this.fireProjectile(target, game);
  }
};
