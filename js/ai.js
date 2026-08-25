/* ==========================================================================
   COSMIC CONQUEST — Opponent Commander
   --------------------------------------------------------------------------
   The AI is not a script of "build X on wave Y". It runs the same loop a
   decent human does:

     1. SCOUT   read the next wave plus whatever is already marching at it,
                and turn that into a threat profile (how much health, how much
                of it airborne, armoured, shielded, swarming, boss).
     2. VALUE   score every affordable action — build any of the 16 towers on
                any free tile, or upgrade anything it already owns — as
                effective damage per gold *against that specific profile*.
     3. COMMIT  take the best action, then re-evaluate.

   Because the score is threat-relative, it naturally teches into Flak when the
   sky fills, into magic when armour shows up, into splash when swarms arrive,
   and into Prism/Railgun for bosses — without any of that being hardcoded.
   ========================================================================== */

'use strict';

const AI = {

  side: null, diff: null,
  spots: [], samples: [],
  think: 0, ready: false, patience: 0,
  lastProfile: null,

  /** THE TACTIC LADDER (owner call O3). One reader, so no decision site can
      invent its own idea of how far along the campaign the player is.
      Defaults to the baseline rather than to zero: a brain running against a
      Game that has no tier -- a harness, an older save path -- must behave
      like today's rival, never like the opening-galaxy one. */
  tier() {
    const t = (typeof Game !== 'undefined') ? Game.aiTier : undefined;
    return (typeof t === 'number' && t >= 0) ? t
         : (typeof AI_TIER_BASELINE === 'number' ? AI_TIER_BASELINE : 2);
  },
  can(tactic) {
    switch (tactic) {
      case 'clear':    case 'enrage':   return this.tier() >= 1;
      case 'relocate':                  return this.tier() >= 2;
      case 'retarget':                  return this.tier() >= 3;
      case 'sell':                      return this.tier() >= 4;
      /* build, upgrade, baselevel and muster are the floor: a rival that
         cannot do these is not a rival. */
      default:                          return true;
    }
  },

  init(side, diff) {
    this.side = side;
    this.diff = diff;
    this.retargetT = 0;
    this.sold = 0;
    this.think = 1.2;
    this.patience = 0;
    this.ready = false;
    this.buildSpots();
    this.ready = true;
  },

  /** Rival parity for the muster detachment: drafted from the SAME shared
      vault of saved denizens the player picks from, and never more picks
      than the player carries -- parity on the pool and the count, its own
      taste on the picks. Lightest, middle and heaviest by health so the
      rival keeps the skirmish/assault/siege bands the derivation is pinned
      around. Deterministic on purpose: rerolling per retry would read as
      random rather than as a commander's doctrine. */
  pickMusterLoadout(pool, size) {
    const ids = (pool || []).filter(musterSendable)
      .sort((a, b) => ENEMY_TYPES[a].hp - ENEMY_TYPES[b].hp);
    const n = Math.max(1, Math.min(MUSTER_LOADOUT_SIZE, size || MUSTER_LOADOUT_SIZE, ids.length));
    if (!ids.length) return MUSTER_BASE_UNLOCK.slice();
    if (n === 1) return [ids[0]];
    if (n === 2) return [ids[0], ids[ids.length - 1]];
    return [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]];
  },

  /**
   * Drafts five towers that actually function as a set. Every viable loadout
   * needs damage, an answer to armour, an answer to air, and control — so the
   * AI picks one archetype and fills the gaps rather than taking the five
   * highest-DPS towers and losing to the first Wisp wave.
   */
  /* `rng` is optional and defaults to the native generator. A campaign world
     passes a seeded one derived from worldLoadoutSeed, so the five towers the
     briefing card shows are the five the battle fields. */
  pickLoadout(map, diff, pool, faction, rng) {
    rng = rng || Math.random;
    /* Every core carries at least two genuine damage dealers plus an answer to
       air. A set built purely from control and support towers cannot kill
       anything and collapses in the opening waves. */
    const cores = [
      ['bolt', 'cryo', 'mortar', 'flak', 'beacon'],          // classic line
      ['arc', 'mortar', 'toxin', 'flak', 'beacon'],          // magic + venom
      ['railgun', 'prism', 'tether', 'flak', 'beacon'],      // precision
      ['sapper', 'mortar', 'singularity', 'flak', 'cryo'],   // area denial
      ['bolt', 'pyre', 'dronebay', 'flak', 'vault'],         // throughput
      ['pyre', 'arc', 'toxin', 'flak', 'siphon'],            // attrition
      ['prism', 'arc', 'singularity', 'flak', 'beacon'],     // control + burst
      ['bolt', 'railgun', 'cryo', 'flak', 'mortar'],         // all-round
      ['glaive', 'arbalest', 'cryo', 'flak', 'executioner'], // expansion steel
      ['foundry', 'rampart', 'mortar', 'flak', 'quake'],     // ground war
      ['capacitor', 'cyclone', 'arc', 'flak', 'echo'],       // storm surge
      ['alchemist', 'pyre', 'cryo', 'flak', 'reckoning'],    // combo lab
      ['bolt', 'saboteur', 'shepherd', 'flak', 'siren'],     // dirty tricks
      ['arbalest', 'chrono', 'ward', 'flak', 'mortar'],      // time and steel
      /* One core per ORIGIN, so the rival can field a set that reads as one
         power's work rather than a shopping list. These are what make an
         origin mix legible from the other side of the board. */
      ['bolt', 'cryo', 'mortar', 'flak', 'canister'],              // human line
      ['reclaimer', 'arbalest', 'rampart', 'flak', 'quartermaster'], // human column
      ['prism', 'concord', 'ward', 'chrono', 'custodian'],         // federation order
      ['toxin', 'executioner', 'ichor', 'flak', 'reckoning'],      // xeno cull
      ['pyre', 'sapper', 'capacitor', 'flak', 'tether'],           // pirate scrapyard
      ['railgun', 'echo', 'pylon', 'quake', 'dronebay']            // robotic lattice
    ];
    /* Anything whose primary job is killing. The expansion roster added ten
       more of these; leaving them out made the guard below treat a perfectly
       lethal core as if it had one damage tower. */
    /* THE HEAVIES BELONG IN THESE LISTS. They are already draftable -- the
       shelf is built from all of TOWER_ORDER and bestSpotFor tests the 2x2
       rectangle -- but these two lists are how the brain judges whether a set
       can KILL and whether it can answer air, and ten of sixty towers being
       invisible to that judgement made improviseSet build worse sets and made
       a shelf holding PHAROS read as having no anti-air at all.
       Sorted by what the defs actually do, not by cost: BOMBARD 95 and
       CARRONADE (zero base, all of it in the overload detonation) are
       ground-only siege; QUADMOUNT, IMPALER, MONSTRANCE and PHAROS carry real
       damage and no groundOnly flag, so they answer flyers too. COLDFRONT,
       REACTOR, STOKEHOLD and SUTURE are deliberately absent: they deal
       nothing or nearly nothing and exist to amplify the guns around them --
       counting them as damage is how a brain fields five support towers and
       cannot kill a crawler. */
    const DAMAGE = ['bolt', 'mortar', 'arc', 'pyre', 'railgun', 'prism', 'sapper', 'dronebay', 'toxin',
                    'flak', 'siphon', 'executioner', 'quake', 'glaive', 'cyclone', 'capacitor',
                    'reckoning', 'arbalest', 'foundry',
                    'canister', 'reclaimer', 'concord', 'ichor', 'custodian',
                    'bombard', 'carronade', 'quadmount', 'impaler', 'monstrance', 'pharos'];
    const AIR    = ['flak', 'arc', 'prism', 'dronebay', 'bolt', 'railgun', 'cyclone', 'arbalest',
                    'reclaimer', 'concord',
                    'quadmount', 'impaler', 'pharos', 'monstrance'];

    /* The rival is held to the SAME PROGRESSION as the player without being
       handed the player's exact shelf: it fields an arsenal of equal size,
       drawn from its own deterministic slice of the roster. Unlock three
       towers and the enemy commander has three more of its own — never more,
       never fewer. The seed comes from the roster size and the map so a given
       theatre reads consistently rather than rerolling every retry. */
    const budget = Math.max(LOADOUT_SIZE, (pool && pool.length) || TOWER_ORDER.length);
    const allowed = this.rivalArsenal(budget, map, DAMAGE, AIR, faction);

    const viable = cores.filter(c => c.every(t => allowed.includes(t)));
    let set = (viable.length
      ? viable[Math.floor(rng() * viable.length)]
      : this.improviseSet(allowed, DAMAGE, AIR)).slice();
    /* Skirmish opponents sometimes bring a worse set on purpose — but never
       one that leaves them unable to deal damage at all. */
    if (diff.aiSkill < 0.7 && rng() < 0.5) {
      const swap = Math.floor(rng() * set.length);
      /* NOT the global pick(): that helper draws Math.random internally, and
         it was the last unthreaded draw on this path. One hidden native draw
         makes the whole seeded promise a coin flip. */
      const candidate = allowed[Math.floor(rng() * allowed.length)];
      const after = set.slice(); after[swap] = candidate;
      if (after.filter(t => DAMAGE.includes(t)).length >= 2) set[swap] = candidate;
    }
    const out = Array.from(new Set(set)).filter(t => allowed.includes(t)).slice(0, LOADOUT_SIZE);
    /* Backstop: top up from the allowed roster if dedup leaves the set thin. */
    for (const d of DAMAGE.concat(allowed)) {
      if (out.length >= LOADOUT_SIZE) break;
      if (allowed.includes(d) && !out.includes(d)) out.push(d);
    }
    return this.flyTheBanner(out, allowed, faction, DAMAGE, AIR, rng);
  },

  /**
   * A commander fights under a banner, so its board should say so. MEASURED:
   * a Xeno rival fielded no Xeno hardware at all in 82% of drafts, because
   * the canned cores are mostly built from the human and robotic commons that
   * are legal to everyone.
   *
   * The core is left alone and the finished set is topped up instead. Filtering
   * the draw to own-origin cores was the obvious fix and it is wrong: exactly
   * one core in the table carries any Xeno tower, so it collapsed every Xeno
   * rival in the late campaign onto a single identical five.
   *
   * Least essential slots go first -- a core puts its support and economy
   * picks last -- and a swap is refused outright if it would cost the two
   * damage dealers or the answer to air every draft guarantees, which is the
   * same guard the skirmish downgrade above uses.
   */
  /* `rng` rides through from pickLoadout: this is the LAST random draw on the
     loadout path, and it was the one left unthreaded, so the same seed drew
     the same core and then swapped in different banner towers. The briefing
     card's promise is only as good as the least deterministic line. */
  flyTheBanner(set, allowed, faction, DAMAGE, AIR, rng) {
    rng = rng || Math.random;
    if (!faction) return set;
    const own = allowed.filter(t => (TOWER_TYPES[t] || {}).origin === faction &&
                                    !set.includes(t));
    let flown = set.filter(t => (TOWER_TYPES[t] || {}).origin === faction).length;
    for (let i = set.length - 1; i >= 0 && flown < LOADOUT_OWN_ORIGIN && own.length; i--) {
      if ((TOWER_TYPES[set[i]] || {}).origin === faction) continue;
      const k = Math.floor(rng() * own.length);
      const after = set.slice(); after[i] = own[k];
      if (after.filter(t => DAMAGE.includes(t)).length >= 2 &&
          after.some(t => AIR.includes(t))) { set = after; own.splice(k, 1); flown++; }
    }
    return set;
  },

  /**
   * The rival's own unlocked shelf: `budget` towers, deterministic per map,
   * always seeded with the five staples so a small arsenal is still playable.
   */
  rivalArsenal(budget, map, DAMAGE, AIR, faction) {
    let h = 2166136261;
    for (const ch of String((map && map.id) || 'field')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const seed = ((h >>> 0) + budget * 104729) >>> 0;
    let x = seed || 1;
    const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
    /* ORIGIN PARITY. The player may only ever unlock human, robotic and their
       OWN power's hardware, so a rival holding a third power's towers would be
       holding a shelf the player is forbidden. Filter FIRST, then shuffle: the
       rival's shelf is the same shape as the player's, not a wider one. */
    const legal = TOWER_ORDER.filter(t => {
      const o = TOWER_ORIGINS[(TOWER_TYPES[t] || {}).origin];
      return !o || !o.gated || (faction && o.faction === faction);
    });
    /* ...and it has to actually carry some of its own power's work. A Xeno
       commander whose whole shelf came up human reads as no commander at all,
       so one own-origin tower is seeded for every two staples -- even the
       smallest shelf still says which banner it fights under. */
    const staples = ['bolt', 'cryo', 'mortar', 'arc', 'flak'].filter(t => legal.includes(t));
    const own = faction ? legal.filter(t => (TOWER_TYPES[t] || {}).origin === faction) : [];
    const out = [];
    for (let i = 0; i < staples.length; i++) {
      out.push(staples[i]);
      if (i % 2 === 1 && own.length) { const o = own.shift(); if (!out.includes(o)) out.push(o); }
    }
    const rest = legal.filter(t => !out.includes(t));
    /* Fisher-Yates on a seeded stream, so the same theatre always yields the
       same rival shelf while different theatres feel distinct. */
    for (let i = rest.length - 1; i > 0; i--) {
      const k = Math.floor(rnd() * (i + 1));
      const tmp = rest[i]; rest[i] = rest[k]; rest[k] = tmp;
    }
    while (out.length < budget && rest.length) out.push(rest.shift());
    /* NOT sliced back to `budget`. The loop above only ever grows `out` TO
       budget, so a slice can do nothing except destroy the own-origin seeds
       pushed before it -- which is exactly what it did, leaving Federation,
       Xeno and Pirate rivals holding one own-origin tower against the
       LOADOUT_OWN_ORIGIN target of two for the whole early campaign. */
    return out;
  },

  /** No canned core fits the shelf — assemble one that can still fight. */
  improviseSet(allowed, DAMAGE, AIR) {
    const out = [];
    for (const d of DAMAGE) if (allowed.includes(d) && out.length < 3) out.push(d);
    for (const a of AIR) if (allowed.includes(a) && !out.includes(a)) { out.push(a); break; }
    for (const t of allowed) { if (out.length >= LOADOUT_SIZE) break; if (!out.includes(t)) out.push(t); }
    return out.slice(0, LOADOUT_SIZE);
  },

  /* ----------------------------------------------------------- geometry */

  /** Sample points along everything that marches at the AI, for coverage maths. */
  buildSpots() {
    this.samples = [];
    for (const p of Game.defendedPaths(this.side.index)) {
      for (let d = 0; d < p.total; d += TILE * 0.5) {
        const pt = p.posAt(d, {});
        /* Lane tiles nearer the AI's own base matter more — a leak there is
           immediate, and towers deep in the lane get more total shots. */
        this.samples.push({ x: pt.x, y: pt.y, w: 1 + 0.8 * (d / p.total) });
      }
    }
    this.spots = [];
    for (let gy = 0; gy < FIELD.rows; gy++) {
      for (let gx = 0; gx < FIELD.cols; gx++) {
        if (!Game.canBuild(this.side.index, gx, gy)) continue;
        const x = (gx + 0.5) * TILE, y = (gy + 0.5) * TILE;
        /* A build node is contested ground, so the rival ranks it above a bare
           tile of the same coverage -- for the same reason the player wants it. */
        const node = nodeAt(gx, gy, 'build');
        this.spots.push({ gx, gy, x, y, node,
                          cov: this.coverage(x, y, 3.4) * (node ? AI_NODE_BIAS : 1) });
      }
    }
    this.spots.sort((a, b) => b.cov - a.cov);
  },

  /** Weighted fraction of the defended lanes a tower here would cover. */
  /* `minTiles` is the tower's own DEAD ZONE, and leaving it out was a real
     misplacement rather than a rounding: BOMBARD cannot fire inside three
     tiles, so lane that runs closer than that is lane it does not cover.
     Measured before this argument existed -- the brain sited a BOMBARD 2.5
     tiles from the nearest lane, scoring the traffic it was structurally
     unable to shoot. Defaults to 0, so every other tower is unchanged. */
  coverage(x, y, rangeTiles, minTiles) {
    const r2 = (rangeTiles * TILE) ** 2;
    const m2 = minTiles ? (minTiles * TILE) ** 2 : 0;
    let sum = 0;
    for (const s of this.samples) {
      const d = dist2(x, y, s.x, s.y);
      if (d <= r2 && d >= m2) sum += s.w;
    }
    return sum;
  },

  /** Coverage → value multiplier. Shared by builds and upgrades so neither
      side of the decision is systematically favoured. */
  covMul(cov) {
    return clamp(cov / Math.max(1, this.samples.length * 0.10), 0.15, 1.9);
  },

  /* --------------------------------------------------------------- board */

  /** Free tiles this side can still build on RIGHT NOW. `spots` is a cache
      built at init and pruned on each build, so re-test occupancy rather than
      trusting its length. */
  freeSpots() {
    let n = 0;
    for (const s of this.spots) if (!Game.towerAt(s.gx, s.gy)) n++;
    return n;
  },

  /** Rubble still standing on THIS side's half. Deliberately ignores the
      clearance limit: SURVEY TEAM raises that limit, so a side sitting on it
      must still see the card as worth something. */
  clearableCount() {
    if (!FIELD || !FIELD.terrain) return 0;
    let n = 0;
    for (const k of FIELD.terrain) {
      if (Game.clearedTerrain.has(k)) continue;
      const [gx, gy] = k.split(',').map(Number);
      if (Game.laneBlocked.has(k) || !Game.ownsTile(this.side.index, gx, gy)) continue;
      n++;
    }
    return n;
  },

  /** The highest-coverage rubble tile this side may pay to demolish, read by
      the SAME rule the player's click handler uses (Game.canClear), so the
      rival can never buy ground the player could not. */
  bestClearable() {
    if (!FIELD || !FIELD.terrain) return null;
    let best = null;
    for (const k of FIELD.terrain) {
      const [gx, gy] = k.split(',').map(Number);
      if (!Game.canClear(this.side.index, gx, gy)) continue;
      const x = (gx + 0.5) * TILE, y = (gy + 0.5) * TILE;
      const cov = this.coverage(x, y, 3.4) * (nodeAt(gx, gy, 'build') ? AI_NODE_BIAS : 1);
      if (!best || cov > best.cov) best = { gx, gy, cov };
    }
    return best;
  },

  /** Average battlefield worth of a tower this side actually fields -- the
      reference a clearance is priced against when there is no free ground
      left to compare it with. */
  meanTowerValue(prof) {
    let sum = 0, n = 0;
    for (const t of this.side.towers) {
      if (t.isSupport) continue;
      sum += this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
      n++;
    }
    return n ? sum / n : 0;
  },

  /** Total effective throughput this side brings against a profile. */
  boardPower(prof) {
    let sum = 0;
    for (const t of this.side.towers) {
      if (t.isSupport) continue;
      sum += this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
    }
    return sum;
  },

  /* ------------------------------------------------------------- scouting */

  /** Combines the next scripted wave with whatever is already on the field. */
  profile() {
    const p = Game.waveProfile(Game.wave + 1);
    const live = { hp: 0, flyingHp: 0, armorHp: 0, shieldHp: 0, count: 0 };
    for (const e of Game.enemies) {
      if (e.hostileTo !== this.side.index || e.dead) continue;
      const hp = e.hp + e.shield;
      live.hp += hp; live.count++;
      if (e.flying) live.flyingHp += hp;
      if (e.armor >= 8) live.armorHp += hp;
      if (e.maxShield > 0) live.shieldHp += hp;
    }
    const hp = Math.max(1, p.hp + live.hp);
    return {
      hp,
      count: p.count + live.count,
      airShare:    (p.flyingHp + live.flyingHp) / hp,
      armorShare:  (p.armorHp + live.armorHp) / hp,
      shieldShare: (p.shieldHp + live.shieldHp) / hp,
      swarm: (p.count + live.count) / 24,           // >1 means a crowded wave
      boss: p.boss,
      healers: p.healers
    };
  },

  /* --------------------------------------------------------------- value */

  /**
   * Effective damage-per-second a tower would contribute against this profile.
   * This is where the AI's "understanding" of the roster lives.
   */
  effectiveness(def, stats, dps, prof) {
    let v = dps;

    if (def.airOnly) {
      /* Flak is worth nothing without a sky, and enormous with one. */
      v *= prof.airShare * 2.4;
    } else if (def.groundOnly) {
      v *= (1 - prof.airShare);
    }

    const type = stats.dmgType;
    if (type === 'physical') v *= (1 - prof.armorShare * 0.55 * (1 - (stats.pierce || 0)));
    else if (type === 'magic') v *= (1 + prof.armorShare * 0.45) * (1 - prof.shieldShare * 0.2);

    /* Venom is the shield answer and scales off max health. */
    if (stats.poisonPct) v *= (1 + prof.shieldShare * 1.1 + (prof.boss ? 0.5 : 0));
    /* CANISTER stopped carrying poisonPct when its gas moved onto MAX health,
       and fell out of the clause above entirely. Half of it is still owed:
       the gas is dealt `pure` and is a share of health, so a shield does not
       stop it any more than it stops TOXIN. The other half is now wrong --
       MAXHP_DOT_ELITE_MUL cuts the gas to 30% against a boss or a miniboss,
       so a boss BONUS here would promise the rival throughput the engine
       takes straight back. `else if` because a tower carrying both would
       otherwise be paid the shield term twice. */
    else if (stats.poisonMaxPct) v *= (1 + prof.shieldShare * 1.1);

    /* Area damage scales with how crowded the lane is. */
    const area = (stats.splash || 0) + (stats.chains ? stats.chains * 0.25 : 0) + (stats.cone ? 1 : 0);
    if (area > 0) v *= (1 + Math.min(1.6, area * 0.42 * prof.swarm));

    /* Ramping single-target beams and heavy snipers shine on bosses. */
    if (prof.boss && (stats.rampMax || stats.critMult)) v *= 1.5;
    if (prof.boss && area > 1.2) v *= 0.8;

    return v;
  },

  /** Utility structures produce no damage, so they are valued separately.
      The ORIGIN term is added on top of the role term rather than folded into
      the switch, because both call sites below reach this one function -- a
      support structure and a weapon must be priced for their origin by the
      same code or the rival only understands origins on half the roster. */
  utilityValue(type, prof, spot) {
    return this.roleValue(type, prof) + this.originValue(type, prof, spot);
  },

  roleValue(type, prof) {
    const S = this.side;
    const n = S.towers.length;
    const econ = this.diff.aiEcon;
    switch (type) {
      case 'cryo':
        /* Slow is a force multiplier — worth a lot early, less once saturated. */
        return this.countOf('cryo') < 2 ? 190 * (1 + prof.swarm * 0.4) : 40;
      case 'tether':
        return this.countOf('tether') < 1 && n >= 3 ? 150 : 30;
      case 'singularity':
        return this.countOf('singularity') < 1 && this.areaTowers() >= 2 ? 200 * prof.swarm : 25;
      case 'beacon': {
        /* Only worth it once there is a real cluster to amplify. */
        const best = this.bestClusterSize();
        return best >= 3 ? 70 * best : 0;
      }
      case 'vault': {
        /* An investment: valuable early, worthless late. */
        if (Game.wave > 22) return 0;
        return this.countOf('vault') < 2 ? 260 * econ * (1 - Game.wave / 26) : 0;
      }
      case 'siphon':
        return S.lives < S.maxLives * 0.7 ? 240 : 60;
      case 'foundry':   return this.countOf('foundry') < 2 ? 180 : 40;
      case 'rampart':   return this.countOf('rampart') < 2 ? 150 : 30;
      case 'saboteur':  return this.countOf('saboteur') < 1 && Game.wave > 3 ? 170 : 20;
      case 'ward':      return this.countOf('ward') < 1 && n >= 4 ? 120 : 10;
      case 'shepherd':  return this.countOf('shepherd') < 1 && n >= 3 ? 130 : 15;
      case 'siren':     return this.countOf('siren') < 1 && Game.wave > 4 ? 160 : 20;
      case 'chrono':    return this.countOf('chrono') < 1 ? 140 * (1 + prof.swarm * 0.3) : 25;
      case 'quake':     return this.countOf('quake') < 1 ? 150 * prof.swarm : 30;
      case 'custodian': return this.countOf('custodian') < 2 ? 165 : 35;
      case 'concord':   return this.countOf('concord') < 2 ? 120 * (1 + prof.armorShare) : 25;
      case 'pylon':
        /* The keystone is worth nothing on its own and a great deal once there
           is a lattice for it to hold up -- exactly the Beacon rule. */
        return this.roboticNear(null, 0) >= 2 && this.countOf('pylon') < 2 ? 210 : 20;
      case 'quartermaster': {
        /* An investment, like the Vault: it pays over the waves that are left. */
        if (Game.wave > 22) return 0;
        return this.countOf('quartermaster') < 1 ? 230 * this.diff.aiEcon * (1 - Game.wave / 26) : 0;
      }
      default:
        return 0;
    }
  },

  /** RIVAL PARITY for the tech origins. Every edge the player gets from an
      origin is priced here, in the same units roleValue already returns, so an
      origin competes on score-per-gold against building and upgrading instead
      of being a lever only one commander knows about. */
  originValue(type, prof, spot) {
    const def = TOWER_TYPES[type];
    const o = def && TOWER_ORIGINS[def.origin];
    if (!o) return 0;
    switch (o.id) {
      case 'robotic': {
        /* The lattice IS the origin, so value the links this placement would
           actually form -- including the build node that counts as one. */
        const links = Math.min(ORIGIN_LATTICE_MAX,
          this.roboticNear(spot, ORIGIN_LATTICE_TILES) + (spot && spot.node ? 1 : 0));
        return links * AI_ORIGIN_LATTICE_VALUE;
      }
      case 'light':
        /* Suppression is worth precisely what the wave is protected by. */
        return 130 * (prof.armorShare + prof.shieldShare) + (prof.boss ? 60 : 0);
      case 'xeno':
        /* Punish scales off remaining health, so it is worth most against
           things that take a long time to finish. */
        return 90 * (prof.boss ? 1.6 : 1) * clamp(prof.hp / 4000, 0.3, 1.8);
      case 'pirate':
        /* More targets is more rolls of the same dice. */
        return 70 * clamp(prof.swarm, 0.4, 2.0);
      case 'human':
        /* Adaptive mounts turn ANY node into an attuned one, which is the only
           conditional a human tower has. */
        return (spot && spot.node) ? 110 : 20;
      default: return 0;
    }
  },

  /** Robotic towers already standing within `tiles` of a prospective spot.
      A null spot asks the simpler question: how many are on the board at all. */
  roboticNear(spot, tiles) {
    let n = 0;
    if (!spot) {
      for (const t of this.side.towers) if (t.def.origin === 'robotic') n++;
      return n;
    }
    const r2 = (tiles * TILE) ** 2;
    for (const t of this.side.towers)
      if (t.def.origin === 'robotic' && dist2(spot.x, spot.y, t.x, t.y) <= r2) n++;
    return n;
  },

  countOf(type) { return this.side.towers.filter(t => t.type === type).length; },
  areaTowers() {
    return this.side.towers.filter(t => (t.stats.splash || 0) > 0 || t.stats.chains || t.stats.cone).length;
  },
  /** Largest number of towers sitting inside one prospective Beacon radius. */
  bestClusterSize() {
    let best = 0;
    for (const a of this.side.towers) {
      let n = 0;
      for (const b of this.side.towers) if (b !== a && dist2(a.x, a.y, b.x, b.y) <= (2.9 * TILE) ** 2) n++;
      best = Math.max(best, n);
    }
    return best;
  },

  /* ------------------------------------------------------------ decisions */

  /** Best free spot for a given tower, weighted by how much lane it covers. */
  bestSpotFor(def) {
    const range = def.base.range || 3.2;
    const minRange = def.base.minRange || 0;
    const foot = towerFoot(def);
    let best = null, bestScore = -1;
    /* Only consider the strongest candidates — full search every tick is waste. */
    let checked = 0;
    for (const s of this.spots) {
      if (Game.towerAt(s.gx, s.gy)) continue;
      /* A heavy claims a foot x foot rectangle anchored on this spot, tested
         by the SAME rule Game.build will enforce -- so the rival can never
         bid ground the engine then refuses, which would waste the decision
         tick. Coverage is measured from the rectangle's true centre. */
      if (foot > 1 && !Game.canBuild(this.side.index, s.gx, s.gy, foot)) continue;
      if (++checked > 46) break;
      let score = this.coverage(s.x + (foot - 1) * TILE / 2, s.y + (foot - 1) * TILE / 2, range, minRange);
      /* A node is worth most to the tower that can actually use it: matched
         element, or an unmarking tower the node has an element to lend. This is
         the parity clause -- the rival reads nodes by the player's own rule. */
      if (s.node) {
        const own = ELEMENTS[def.element];
        score *= (s.node.el === def.element || !own || !own.marks)
          ? AI_NODE_BIAS_MATCH : AI_NODE_BIAS;
      }
      /* Reward clustering slightly so Beacons and crossfire happen naturally. */
      let near = 0;
      for (const t of this.side.towers) if (dist2(s.x, s.y, t.x, t.y) <= (2.6 * TILE) ** 2) near++;
      score *= (1 + Math.min(3, near) * 0.06);
      /* ROBOTIC hardware wants its own kind close enough to LINK, which is a
         tighter radius than the generic cluster bonus above and a different
         question: this one decides WHERE, utilityValue decides WHETHER. */
      if (def.origin === 'robotic') {
        score *= (1 + Math.min(ORIGIN_LATTICE_MAX,
                               this.roboticNear(s, ORIGIN_LATTICE_TILES)) * 0.10);
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best ? { spot: best, cov: bestScore } : null;
  },

  /**
   * Enumerate every move — affordable or not — and return both the best it can
   * buy right now and the best it could buy if it waited. The caller compares
   * them, which is what lets the AI SAVE for a high-value ascension instead of
   * dribbling its last 80 gold into another tier-1 emplacement.
   */
  bestAction(prof) {
    const S = this.side;
    const gold = S.gold;
    let best = null, dream = null;
    /* The best BUILD considered this tick, kept because a clearance is priced
       as the coverage UPLIFT over the best ground this side can already use.
       Without a reference the option has no denominator. */
    let bestBuild = null;
    /* The dream window is deliberately narrow — roughly one wave of income.
       A wide window makes the AI chase an ever-receding ascension forever,
       because each ascension costs more than the last. */
    const consider = c => {
      if (c.cost <= gold) { if (!best || c.score > best.score) best = c; }
      else if (c.cost <= gold * 1.8) { if (!dream || c.score > dream.score) dream = c; }
    };

    /* --- upgrades --- */
    for (const t of S.towers) {
      const next = t.nextUpgrade();
      if (!next) continue;
      const raw = next.kind === 'branch' ? Math.min(next.data[0].cost, next.data[1].cost) : next.cost || next.data.cost;
      const cost = t.upgradeCost(next.kind, raw);
      if (cost > gold * 1.8) continue;

      const before = t.isSupport ? 0 : this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
      const after = this.projectedUpgrade(t, next, prof);
      let gain = after - before;

      /* Support upgrades are valued by what they enable, not their own damage. */
      if (t.def.attack === 'aura') gain = this.auraGain(t, prof);
      if (t.def.attack === 'economy') gain = Game.wave > 24 ? 0 : (t.stats.income || 0) * AI_ECON_UPGRADE_WEIGHT * this.diff.aiEcon;
      /* A tower that does no damage scores no damage gain, which is correct
         and was also the whole of the answer -- so the brain built utility
         towers and then never upgraded one. Falls through only when the
         damage terms produced nothing, so a tower that does both keeps the
         larger, better-founded number. */
      if (!(gain > 0) && !t.isSupport) gain = this.utilityUpgradeGain(t, next, prof);

      /* An upgrade inherits the tile's coverage exactly like a new build does.
         Without this the AI systematically prefers width over depth: new towers
         got the coverage bonus and upgrades did not, so it sprawled into dozens
         of tier-1 emplacements instead of ascending a few good ones. */
      gain *= this.covMul(this.coverage(t.x, t.y, t.effRange));

      /* Amplified towers are worth upgrading first — the aura multiplies it. */
      if (t.aura.dmg > 0) gain *= (1 + t.aura.dmg);

      /* An owed specialisation genuinely costs nothing, so the denominator
         can be zero now that upgradeCost states that rule. Clamped the way
         the muster scorer clamps it: gain / 0 is Infinity, which poisons
         `rich` and the patience gate downstream. */
      const score = gain / Math.max(1, cost);
      if (score > 0) consider({ kind: 'upgrade', tower: t, next, cost, score,
                                branchIndex: next.kind === 'branch' ? this.pickBranch(t, prof) : null });
    }

    /* --- new towers (restricted to the five it deployed with) --- */
    for (const type of S.loadout) {
      const def = TOWER_TYPES[type];
      /* Game.bidCost, not towerCost. Rival parity for BLOOD PRICE, which is
         priced in LIVES and therefore quotes zero gold: `value / 0` below is
         Infinity, so the rival picked it on every build tick and had traded
         its whole buffer for tempo by wave 4. bidCost states both currencies
         in one unit and returns Infinity when the spend would be imprudent,
         which the gate on the next line already reads as "not this tick".
         Game.build still charges the real price and enforces the real floor. */
      const cost = Game.bidCost(S.index, type);
      if (cost > gold * 1.8) continue;
      const spot = this.bestSpotFor(def);
      if (!spot) continue;

      const probe = new Tower(type, spot.spot.gx, spot.spot.gy, S.index);
      let value;
      if (probe.isSupport) value = this.utilityValue(type, prof, spot.spot);
      else {
        value = this.effectiveness(def, probe.stats, probe.estimateDps(), prof);
        value += this.utilityValue(type, prof, spot.spot);
        /* Coverage gates everything — a great tower on a dead tile is dead. */
        value *= this.covMul(spot.cov);
      }
      /* Diversity: heavy diminishing returns on a fifth copy of the same tower.
         The radial's ordering applies this same term, so the number lives in
         config.js under one name rather than as a literal in each reader. */
      value *= Math.pow(BUILD_DIVERSITY_FALLOFF, this.countOf(type));

      /* Board crowding: every emplacement makes the next one worth less, which
         is what pushes the AI from sprawling to ascending as the match matures.
         The good tiles are finite; depth is the only thing that still scales. */
      value *= Math.pow(0.972, S.towers.length);

      const score = value / cost;
      if (!bestBuild || value > bestBuild.value) bestBuild = { value, cov: spot.cov };
      if (score > 0) consider({ kind: 'build', type, spot: spot.spot, cost, score });
    }

    /* --- base level: the retrofit that lifts the WHOLE board at once ---
       Rival parity (ROADMAP:204). Valued as what it would actually do: the
       summed effectiveness delta of raising every standing tower to the new
       floor, plus the two lives it adds. projectedBaseLevel mutates and
       restores exactly as projectedUpgrade does, so nothing leaks. */
    if (typeof Game.baseLevelCost === 'function') {
      /* LOOK AHEAD. Valuing only the NEXT level is a local-minimum trap: a
         board already at MK III gains literally nothing from base level 2 or
         3 (applyBaseLevelTo caps the MK target at 3), so a one-step valuation
         reads 0 and the rival never climbs to level 4 — which is where the
         free specialisation and the ascension ladder actually live. Scan the
         next few levels, price each against the CUMULATIVE cost of reaching
         it, and buy the next step if any reachable rung pays. */
      const cur = S.baseLevel || 1;
      let cumCost = 0, bestBl = 0;
      for (let step = 1; step <= AI_BASELEVEL_LOOKAHEAD; step++) {
        cumCost += Game.baseLevelCostAt(S.index, cur + step);
        if (cumCost > gold * 2.2) break;
        let delta = 0;
        for (const t of S.towers) {
          if (t.isSupport) continue;
          delta += this.projectedBaseLevel(t, cur + step, prof);
        }
        const value = delta * AI_BASELEVEL_WEIGHT + 2 * step * AI_BASELEVEL_LIVES_WEIGHT;
        const sc = value / Math.max(1, cumCost);
        if (sc > bestBl) bestBl = sc;
      }
      const nextCost = Game.baseLevelCost(S.index);
      if (bestBl > 0 && nextCost <= gold)
        consider({ kind: 'baselevel', cost: nextCost, score: bestBl });
    }

    /* --- muster: bought aggression that also buys income ---
       Rival parity. The player's muster control is a lever on tempo AND on
       economy, so the rival cannot merely be allowed to send -- it has to
       price the same double payoff the player sees and let it compete on
       score-per-gold with building and upgrading, or the lever is one-sided.
       Health put in a rival lane is the pressure half; the permanent wave
       income is the other, and both are converted into the value units the
       two existing branches are already scored in. */
    /* Defence-first gate: no sends until the board can actually hold. Every
       condition here is a measured failure mode, not a taste. */
    /* A rite that fields NO free bodies cannot wait as long to start buying
       them -- pricing a pirate's sends like a human's leaves that brain with
       no offence at all -- so the doctrine may lower the gate. */
    const mdoc = (Game.doctrineOf && Game.doctrineOf(S.index)) || null;
    const musterSane = Game.wave >= ((mdoc && mdoc.aiMinWave) || MUSTER_AI_MIN_WAVE)
      && S.towers.length >= MUSTER_AI_MIN_TOWERS
      && S.lives >= S.maxLives * MUSTER_AI_SAFE_LIVES;
    if (musterSane && Game.canMuster && Game.canMuster(S.index)) {
      const victims = Game.musterVictims(S.index);
      for (const tier of Game.musterTiers(S.index)) {
        const base = ENEMY_TYPES[tier.type];
        if (!base) continue;
        const cost = Game.musterCost(S.index, tier);
        if (cost > gold * 1.8) continue;
        let delivered = 0;
        for (const vic of victims) delivered += base.hp * Game.musterHpMul(S.index, vic) * tier.count;
        /* musterGain is the honest post-cap gold/wave delta AND, since it
           now runs Game.previewGold, already carries this side's mods.gold
           and aiEcon -- so aiEcon must NOT be multiplied in again here. The
           income half is that figure collected over a finite horizon. The
           defence-first musterSane gate above is untouched -- it is what
           keeps the early curve where the design pinned it. */
        /* The pressure half is scaled by the rite: a brain whose doctrine
           already puts free bodies on the lane (THE PROCESSION) would
           otherwise double-spend on aggression it is getting for nothing,
           and one that gets none (the MARQUE) undervalues the only offence
           it owns. The income half is untouched -- gold is gold. */
        const pressure = delivered * MUSTER_AI_PRESSURE * ((mdoc && mdoc.aiPressureMul) || 1);
        let value = pressure
                  + Game.musterGain(S.index, tier) * MUSTER_AI_HORIZON_WAVES
                    * MUSTER_AI_INCOME_WEIGHT;
        /* GOLD SQUISH. The health half is priced per point of HP and already
           moved with the (squished) cost; the income half is priced per GOLD,
           which is GOLD_SQUISH times smaller than the weights were calibrated
           in. Restore that half to its measured band here, on the half itself,
           so the rival keeps pricing sends the way the player sees them. */
        value += (value - pressure) * (GOLD_SQUISH - 1);
        const mscore = value / cost;
        if (mscore > 0) consider({ kind: 'muster', tier, cost, score: mscore });
      }
    }

    /* --- rubble clearance: gold buys BOARD, for the rival too ---
       Rival parity (ROADMAP:204). Terrain is MIRRORED onto both halves by
       construction (config.js mirrors every blocked tile), so a rival that
       never clears ends an otherwise identical board with materially less
       ground to stand on. A cleared tile is not damage; it is the OPTION to
       buy damage on better ground than anything left, so it is priced as the
       coverage uplift over the best tile this side can already build on,
       carried by the value of the build it would host and discounted because
       that tower still has to be paid for separately. */
    if (Game.wave >= AI_CLEAR_MIN_WAVE) {
      const cand = this.bestClearable();
      if (cand) {
        const cost = Game.clearCostNow(S.index);
        if (cost <= gold * 1.8) {
          /* The reference is the best tile this side can ALREADY build on,
             measured by bestClearable's own formula so the two are directly
             comparable, and RAW because covMul saturates (see the config
             note). The tower costs the same on either tile, so the marginal
             worth of the clearance is the fractional uplift it buys on the
             build that will use it. */
          const bestFree = this.spots.find(s => !Game.towerAt(s.gx, s.gy));
          const refCov = bestFree ? bestFree.cov : 0;
          const refValue = bestBuild ? bestBuild.value : this.meanTowerValue(prof);
          const uplift = clamp(cand.cov / Math.max(1, refCov) - 1, 0, AI_CLEAR_MAX_UPLIFT);
          if (uplift >= AI_CLEAR_MIN_UPLIFT) {
            const value = refValue * uplift * AI_CLEAR_OPTION_VALUE;
            const cscore = value / cost;
            if (cscore > 0 && this.can('clear'))
              consider({ kind: 'clear', gx: cand.gx, gy: cand.gy, cost, score: cscore });
          }
        }
      }
    }

    /* --- relocation: a bad opening placement stops being permanent ---
       Rival parity. Only between waves: RELOCATE_DOWNTIME is 4.5s offline,
       which mid-wave is a leak rather than a cost. MIN_GAIN is what stops the
       rival shuffling on noise, and MAX_MOVES is the oscillation stop -- two
       towers can otherwise trade the same good tile for the rest of a match. */
    if (!Game.waveRunning && Game.wave >= AI_RELOCATE_MIN_WAVE) {
      const dest = this.spots.find(s => !Game.towerAt(s.gx, s.gy));
      if (dest) {
        for (const t of S.towers) {
          if (t.isSupport) continue;
          if ((t.aiMoves || 0) >= AI_RELOCATE_MAX_MOVES) continue;
          /* `dest` was picked as a bare free TILE; a heavy needs the whole
             rectangle there, itself excluded exactly as Game.relocate
             excludes it. Skipped here so the refusal never eats the tick. */
          if ((t.foot || 1) > 1 && !Game.canBuild(S.index, dest.gx, dest.gy, t.foot, t)) continue;
          const here = this.coverage(t.x, t.y, t.effRange);
          const there = this.coverage(dest.x, dest.y, t.effRange);
          if (there < here * AI_RELOCATE_MIN_GAIN) continue;
          const cost = Game.relocateCost(t);
          if (cost > gold * 1.8) continue;
          const eff = this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
          const value = eff * (there / Math.max(1, here) - 1) * AI_RELOCATE_DOWNTIME;
          const rscore = value / cost;
          if (rscore > 0 && this.can('relocate'))
            consider({ kind: 'relocate', tower: t, spot: dest, cost, score: rscore });
        }
      }
    }

    /* --- RESONANT FIELD: the rival bids on its OWN wave ---
       Rival parity. The charge is per side now, so this is a bet a commander
       places on its own board: the wave that pays ENRAGE_BOUNTY more also
       arrives ENRAGE_HP tougher, and only for the buyer. Priced per gold of
       bounty it expects to collect, on the same weight the muster income half
       carries, and taken only with measured headroom -- otherwise it buys a
       payout it then leaks straight through. */
    if (!Game.waveRunning && Game.wave >= AI_ENRAGE_MIN_WAVE
        && (S.enrage || 0) < ENRAGE_MAX
        && S.lives >= S.maxLives * AI_ENRAGE_SAFE_LIVES
        && typeof Game.enrageCost === 'function') {
      const cost = Game.enrageCost(S.index);
      if (cost <= gold * 1.8 && this.boardPower(prof) * AI_ENRAGE_WINDOW
                                 >= prof.hp * AI_ENRAGE_HEADROOM) {
        const next = Game.wave + 1;
        const p = Game.waveProfile(next);
        /* The bounty a wave pays, read through the SAME rounding the Enemy
           constructor applies, so the rival prices gold at the figure it will
           actually be paid rather than at the authored table value. */
        let payout = 0;
        for (const type in p.roster) {
          const e = ENEMY_TYPES[type];
          if (!e) continue;
          payout += Math.max(1, Math.round((e.bounty || 1) * waveBountyMultiplier(next) / GOLD_SQUISH))
                    * p.roster[type];
        }
        const value = payout * ENRAGE_BOUNTY * AI_ENRAGE_INCOME_WEIGHT * this.diff.aiEcon;
        const escore = value / cost;
        if (escore > 0 && this.can('enrage')) consider({ kind: 'enrage', cost, score: escore });
      }
    }

    return { best, dream };
  },

  /** Effectiveness one tower would GAIN if the base floor rose to `bl`.
      Mirrors projectedUpgrade's save/restore discipline exactly. */
  projectedBaseLevel(t, bl, prof) {
    const save = { level: t.level, branch: t.branch, asc: t.asc, stats: t.stats,
                   pendingBranch: t.pendingBranch,
                   ascDamage: t.ascDamage, ascRate: t.ascRate, ascRange: t.ascRange };
    const before = this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
    Game.applyBaseLevelTo(t, bl);
    const after = this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
    Object.assign(t, save);
    t.recompute();
    return Math.max(0, after - before);
  },

  /** Approximate the post-upgrade effectiveness without mutating the board. */
  projectedUpgrade(t, next, prof) {
    const save = { level: t.level, branch: t.branch, asc: t.asc, stats: t.stats,
                   ascDamage: t.ascDamage, ascRate: t.ascRate, ascRange: t.ascRange };
    if (next.kind === 'level') t.level++;
    else if (next.kind === 'branch') { t.branch = next.data[this.pickBranch(t, prof)]; t.level = 4; }
    else t.asc++;
    t.recompute();
    const v = t.isSupport ? 0 : this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
    Object.assign(t, save);
    /* RESTORE, THEN RECOMPUTE. Assigning the saved fields back is not enough:
       recompute ALLOCATES for `drones` (`while (this.drones.length < want)
       this.drones.push(new Drone(...))`), and those objects are what fly and
       shoot -- `stats.drones` does not drive firing, the array does. Without
       this line a rival DRONE BAY gained a permanent extra drone every time
       the brain merely CONSIDERED upgrading it. Measured: one deliberation
       took a MK I bay from 2 drones to 3 while its stats still said 2, and it
       re-inflated on every tick the brain deliberated without spending.
       The sibling projection already ends this way and its comment claims to
       copy this function -- now it does. */
    t.recompute();
    return v;
  },

  /**
   * WHAT AN UPGRADE IS WORTH TO A TOWER THAT DOES NO DAMAGE.
   *
   * The brain valued these towers correctly when it BUILT them -- roleValue
   * prices a SABOTEUR at 170 and a SIREN at 160 -- and then scored their
   * upgrades on damage they do not have. `before` and `after` both came back
   * 0, gain was 0, and `if (score > 0)` dropped them: five towers the rival
   * would build once and never spend another coin on, for the whole match.
   * RAMPART, SABOTEUR, SIREN, SHEPHERD and WARD, measured through the real
   * scoring path rather than read off the table.
   *
   * Diffing utilityValue across the upgrade cannot fix it -- that function
   * keys off the tower's TYPE and how many the side owns, neither of which an
   * upgrade changes. So value the upgrade by how much it moves the tower's
   * OWN defining numbers, and price that movement at the role the brain
   * already agreed the tower is worth. Data-driven on purpose: it reads
   * whatever stats the upgrade touched, so a utility tower added later is
   * priced without anyone remembering to come back here.
   */
  utilityUpgradeGain(t, next, prof) {
    const role = this.roleValue(t.def.id, prof);
    if (!(role > 0)) return 0;
    const save = { level: t.level, branch: t.branch, asc: t.asc, stats: t.stats,
                   ascDamage: t.ascDamage, ascRate: t.ascRate, ascRange: t.ascRange };
    const before = Object.assign({}, t.stats);
    if (next.kind === 'level') t.level++;
    else if (next.kind === 'branch') { t.branch = next.data[this.pickBranch(t, prof)]; t.level = 4; }
    else t.asc++;
    t.recompute();
    let rel = 0;
    for (const k of Object.keys(t.stats)) {
      const a = t.stats[k], b = before[k];
      if (typeof a !== 'number' || !isFinite(a)) continue;
      if (typeof b !== 'number' || !isFinite(b)) { if (a) rel += 1; continue; }
      if (a === b) continue;
      /* A stat that starts at zero and becomes non-zero is a NEW capability,
         which is worth a whole step rather than an infinite one. */
      rel += b === 0 ? 1 : Math.abs(a - b) / Math.abs(b);
    }
    /* Same restore-then-recompute discipline as projectedUpgrade, and for the
       same reason: recompute ALLOCATES, so a deliberation that skipped it
       would hand the rival free drones for thinking about an upgrade. */
    Object.assign(t, save);
    t.recompute();
    return role * Math.min(AI_UTIL_UPGRADE_CAP, rel) * AI_UTIL_UPGRADE_WEIGHT;
  },

  /** Beacons are worth the summed damage of everything they cover. */
  auraGain(b, prof) {
    let sum = 0;
    const r2 = (b.stats.range * TILE) ** 2;
    for (const t of this.side.towers) {
      if (t === b || t.isSupport) continue;
      if (dist2(b.x, b.y, t.x, t.y) <= r2) sum += this.effectiveness(t.def, t.stats, t.estimateDps(), prof);
    }
    return sum * 0.35;
  },

  /**
   * Drafts a talent build for each tower before the match. Picks one talent
   * from each row, favouring raw output — it cannot see the coming waves yet,
   * so it plays to the tower's strength rather than to a counter.
   */
  /* `diff` is a PARAMETER, and that is the fix. It used to read `this.diff`
     off the prototype -- which AI.init writes, and AI.init runs AFTER all
     three call sites. So on the first battle of a page the rival always took
     the optimal node (a perfect build on Skirmish), and from the second
     battle it used the PREVIOUS battle's threat level. Worse, the
     short-circuit meant Math.random() was NOT consumed on run one and WAS on
     run two, so two seeded runs in one page diverged -- which is the
     unexplained pin delta recorded in the backlog (run 1 wave 21/27480, run 2
     wave 20/26129). It was `diff`, not `spots` or `samples`. */
  pickTalents(loadout, depth, diff) {
    const sets = {};
    /* Score a talent by how much raw output it adds, so the rival's builds
       are coherent rather than random. Utility keys still count, weighted
       lower, so control towers still take their control talents. */
    const value = mods => {
      let v = 0;
      for (const k in mods) {
        const m = mods[k];
        if (k === 'damageMul' || k === 'droneDamageMul' || k === 'rateMul') v += (m - 1) * 100;
        else if (k === 'rangeMul' || k === 'splashMul' || k === 'coneMul') v += (m - 1) * 60;
        else if (k === 'statusMul' || k === 'auraDmgMul' || k === 'auraRateMul') v += (m - 1) * 70;
        else if (k === 'incomeMul' || k === 'killCutMul') v += (m - 1) * 55;
        else if (k === 'drainPerMul' || k === 'mineDelayMul' || k === 'drainCdMul') v += (1 - m) * 70;
        else if (k === 'pierce' || k === 'crit') v += m * 90;
        else if (k === 'drones' || k === 'chains' || k === 'multishot' || k === 'submunitions') v += m * 22;
        else if (k === 'maxMines' || k === 'maxStacks') v += m * 6;
        else if (typeof m === 'number') v += m * 3;
      }
      return v;
    };
    for (const id of loadout) {
      const def = TOWER_TYPES[id];
      const rows = {};
      for (const t of def.talents) (rows[t.row] = rows[t.row] || []).push(t);
      const chosen = [];
      /* The rival's tech runs exactly as deep as the player's mastery lets
         THEIRS run — a level-1 profile does not get ambushed by a fully
         teched opponent. `depth` is supplied by the match setup. */
      const cap = Math.max(1, Math.min(TALENT_POINTS, depth === undefined ? TALENT_POINTS : depth));
      for (const r of Object.keys(rows).sort()) {
        if (chosen.length >= cap) break;
        const opts = rows[r].slice().sort((a, b) => value(b.mods) - value(a.mods));
        /* A weaker commander sometimes takes the second-best option. */
        /* The draw happens UNCONDITIONALLY so the seeded stream advances
           by the same amount whether or not a downgrade is available. */
        const roll = Math.random();
        const d = diff || this.diff;
        const take = (d && roll > d.aiSkill && opts[1]) ? opts[1] : opts[0];
        chosen.push(take);
      }
      sets[id] = chosen;
    }
    return sets;
  },

  /** Branch choice is threat-driven, so the AI's build reads differently each run. */
  pickBranch(t, prof) {
    const [a, b] = t.def.branches;
    const score = br => {
      const merged = Object.assign({}, t.stats, br.mods);
      let v = this.effectiveness(t.def, merged, (merged.damage || 0) * (merged.rate || 1), prof);
      /* Branch-specific reads the raw numbers miss. */
      if (br.id === 'storm' || br.id === 'volley' || br.id === 'minefield' || br.id === 'swarm')
        v *= (1 + prof.swarm * 0.5);
      if (br.id === 'solar' || br.id === 'marksman' || br.id === 'annihilator' || br.id === 'demolition')
        v *= (prof.boss ? 1.7 : 1.0);
      if (br.id === 'corrosion') v *= (1 + prof.armorShare);
      if (br.id === 'glacier') v *= (1 + prof.swarm * 0.4);
      if (br.id === 'transfusion') v *= this.side.lives < this.side.maxLives * 0.6 ? 2.2 : 0.9;
      if (br.id === 'skyshred') v *= (1 + prof.airShare);
      return v;
    };
    return score(b) > score(a) ? 1 : 0;
  },

  /* --------------------------------------------------------------- brain */

  update(dt, game) {
    if (!this.ready || game.state !== 'playing') return;
    const S = this.side;
    if (!S.alive) return;

    /* Abilities run on their own clock: they answer a wave, not a purchase. */
    this.commandAbilities(dt, game);

    /* RE-AIMING runs on its own slow clock too, and BEFORE the think gate:
       it spends no gold, so it has no business waiting on a deliberation the
       rival may be too poor to act on. Inert below tier 3, so every battle
       outside the campaign behaves exactly as it did. */
    if (this.can('retarget') && this.lastProfile) this.retargetPass(dt, this.lastProfile);

    this.think -= dt;
    if (this.think > 0) return;
    /* Weaker opponents deliberate longer, so they fall behind on tempo. */
    this.think = 0.55 / this.diff.aiSkill;

    const prof = this.profile();
    this.lastProfile = prof;


    /* Keep a war chest during a fight; spend freely during the prep window. */
    const reserveFrac = game.waveRunning ? 0.18 : 0.0;
    const spendable = S.gold * (1 - reserveFrac);

    /* CUTTING A DEAD TOWER (tier 4). Considered before the buy, because the
       sale is what funds the replacement -- and only when the rival has
       nothing it would rather do with the gold it already holds, so a healthy
       board is never disturbed. */
    if (this.can('sell')) {
      const dud = this.sellCandidate(prof);
      if (dud) {
        game.sell(dud);
        this.sold = (this.sold || 0) + 1;
        /* The tile is free ground again the moment the tower leaves it, and a
           stale spot list is how the rival ends up refusing to build on
           ground it just cleared itself. */
        this.buildSpots();
        return;
      }
    }

    const { best, dream } = this.bestAction(prof);
    if (!best || best.cost > spendable) return;

    /* SAVE instead of spending badly. If waiting briefly unlocks something
       clearly better per gold, bank the difference rather than buying the only
       thing currently affordable — this is what stops the AI sprawling into
       dozens of cheap tier-1 towers whenever its purse is thin.
       `patience` bounds it: without a cap the AI hoards indefinitely, because
       every ascension it saves toward costs more than the last one. */
    /* Sitting on a fortune is never right. Once the purse dwarfs the best
       available purchase, buy something — this is the release valve that stops
       a hesitant commander from banking thousands it will never spend. */
    const rich = S.gold > best.cost * 4;

    if (!rich && dream && dream.score > best.score * (1.9 - this.diff.aiSkill * 0.55) && this.patience < 14) {
      this.patience++;
      return;
    }
    this.patience = 0;

    /* Skill gate: a weaker commander sometimes passes on its best move. */
    if (!rich && Math.random() > this.diff.aiSkill * 0.55 + 0.45) return;

    const action = best;

    if (action.kind === 'build') {
      const t = game.build(S.index, action.type, action.spot.gx, action.spot.gy);
      if (t) { this.setTargeting(t); this.spots = this.spots.filter(s => s !== action.spot); }
    } else if (action.kind === 'baselevel') {
      game.buyBaseLevel(S.index);
    } else if (action.kind === 'muster') {
      game.muster(S.index, action.tier.id);
    } else if (action.kind === 'clear') {
      /* A demolition changes the BOARD, so the cached spot list is stale the
         moment it lands -- rebuild or the freed ground stays invisible. */
      if (game.clearTerrain(S.index, action.gx, action.gy)) this.buildSpots();
    } else if (action.kind === 'relocate') {
      if (game.relocate(action.tower, action.spot.gx, action.spot.gy)) {
        action.tower.aiMoves = (action.tower.aiMoves || 0) + 1;
        this.buildSpots();
      }
    } else if (action.kind === 'enrage') {
      game.buyEnrage(S.index);
    } else {
      game.upgrade(action.tower, action.branchIndex);
    }
  },

  /* ------------------------------------------------------------ abilities */

  /**
   * The rival fires its commander abilities on the same terms the player
   * does. For an AIMED one that means choosing a POINT, not merely a moment.
   * It will not spend a cooldown on a straggler, and it never aims at
   * geometry — only at where the attackers actually are.
   */
  commandAbilities(dt, game) {
    const S = this.side;
    if (!S.abil || !S.abil.length) return;
    this.abilT = (this.abilT || 0) - dt;
    if (this.abilT > 0) return;
    /* A weaker commander deliberates longer here too, exactly as it does
       when it is deciding what to build. */
    this.abilT = AIM_AI_THINK / Math.max(0.4, this.diff.aiSkill);

    const marching = game.enemies.filter(e => !e.dead && e.hostileTo === S.index);
    if (marching.length < AIM_AI_MIN_CLUSTER) return;

    for (let i = 0; i < S.abil.length; i++) {
      const a = S.abil[i];
      if (a.cd > 0 || a.active > 0) continue;
      if (!a.def.aim) { if (useAbility(S, game, i)) return; continue; }
      const at = this.aimPoint(game, a.def, marching);
      if (at && useAbility(S, game, i, at)) return;
    }
  },

  /**
   * The densest knot of attackers, snapped forward onto ground this side
   * holds. Walking FORWARD along an attacker's own path moves deeper into the
   * territory this commander defends, so the probe converges on a legal tile
   * instead of wandering off the lane — and a naive centroid, which would
   * happily land on its own base, never gets the chance.
   */
  aimPoint(game, def, marching) {
    const r2 = (AIM_AI_CLUSTER_TILES * TILE) * (AIM_AI_CLUSTER_TILES * TILE);
    let best = null, bestN = 0;
    for (const e of marching) {
      let n = 0;
      for (const o of marching) if (dist2(e.x, e.y, o.x, o.y) <= r2) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    if (!best || bestN < AIM_AI_MIN_CLUSTER) return null;
    let d = best.dist;
    for (let k = 0; k < AIM_AI_PROBES; k++) {
      const pt = best.path ? best.path.posAt(d, {}) : best;
      const gx = Math.floor(pt.x / TILE), gy = Math.floor(pt.y / TILE);
      if (game.canAim(this.side.index, gx, gy, def)) return { gx, gy };
      if (!best.path) break;
      d += TILE;
      if (d > best.path.total) break;
    }
    return null;
  },

  /** Sensible per-archetype targeting, the way a good player would set it. */
  setTargeting(t) {
    /* One table, read from two places. It used to live only here, so the
       re-aiming pass would have had to keep a second copy of it. */
    t.targetMode = this.baseAimFor(t);
  },

  /**
   * RE-AIMING (tier 3). setTargeting above runs ONCE, at the moment a tower is
   * built, off a hard-coded switch on the tower's type -- so the rival picked
   * its aim before it had ever seen the wave it would face, and then never
   * looked again for the rest of the battle. A board that is right for a
   * swarm is wrong for a single armoured boss, and the rival held the swarm
   * answer either way.
   *
   * This re-points guns against the LIVE threat profile. It costs nothing and
   * changes no gold, so it is not an `action` competing in the scorer -- it
   * runs on its own slow clock beside the deliberation.
   *
   * Support towers, ORISON and anything the player cannot re-aim by hand are
   * skipped: ui.js hides the targeting control for exactly those, and a rival
   * doing what the player is forbidden to do is not difficulty, it is an
   * asymmetry.
   */
  retargetPass(dt, prof) {
    if (!this.can('retarget')) return 0;
    this.retargetT = (this.retargetT || 0) - dt;
    if (this.retargetT > 0) return 0;
    this.retargetT = AI_RETARGET_EVERY;
    let moved = 0;
    for (const t of this.side.towers) {
      if (t.isSupport || !t.def || t.def.attack === 'orison' || t.def.attack === 'depot' ||
          t.def.attack === 'vigil') continue;
      const want = this.aimFor(t, prof);
      if (want && t.targetMode !== want) { t.targetMode = want; moved++; }
    }
    return moved;
  },

  /** What this tower SHOULD be pointed at, given what is actually coming.
      The type switch in setTargeting is kept as the floor -- it encodes real
      knowledge about each gun -- and the profile only overrides it where the
      wave makes a clearly better answer available. */
  aimFor(t, prof) {
    /* CONSERVATIVE ON PURPOSE, and it took a measurement to learn why.
       ────────────────────────────────────────────────────────────────
       The first version of this reasoned freely from the threat profile:
       swarm -> 'close' or 'weak', armour -> 'strong', splash -> 'first', and
       so on. Run head to head against the baseline rival on the same seed in
       the same session, it made the rival WORSE -- on seed 1001 a baseline
       rival won with 17 lives standing and the re-aiming rival lost outright,
       at tier 3, with selling not yet unlocked. So it was the aiming.

       Two reasons, both of which were written down in config.js before I
       started. TARGET_MODES calls FIRST "the default, and usually correct",
       and it is: the enemy nearest your base is the one about to cost you a
       life. And WEAK "maximises kills and reanimation output" -- an OFFENSIVE
       property. Spending a defensive board on whatever is already dying is
       how a board that was holding stops holding.

       So the profile now only speaks where it has something the build-time
       switch cannot know, and 'weak' is never chosen at all. Everything else
       keeps the aim the tower was built with. */
    const s = t.stats || {};
    /* A BOSS is the one case a fixed switch genuinely cannot answer, because
       it is a property of the wave rather than of the tower. A slow, heavy gun
       is worth spending on the biggest thing on the field; everything else is
       still better off holding the line. */
    if (prof.boss) {
      const heavy = (s.damage || 0) >= 90 && (s.rate || 1) <= 0.75;
      if (heavy && !(t.effSplash > 0.9)) return 'strong';
    }
    return this.baseAimFor(t);
  },

  /** The build-time switch, factored out so re-aiming can fall back to it
      rather than keeping a second copy that would drift. */
  baseAimFor(t) {
    switch (t.type) {
      case 'railgun': case 'prism': return 'strong';
      case 'toxin':   return 'strong';
      case 'tether':  return 'first';
      case 'arc': case 'pyre': return 'close';
      default: return 'first';
    }
  },

  /**
   * SELLING (tier 4). The rival could never cut a tower, so an opening it
   * regretted was permanent -- relocation moves a good tower to better ground,
   * but nothing answered a tower that was simply the wrong tower.
   *
   * Deliberately hard to trigger. It must be late enough that the board has
   * settled, the tower must be earning a small fraction of what its neighbours
   * earn, it must not be worth upgrading instead, and there is a hard cap per
   * battle -- a rival that sells freely thrashes, and thrashing reads as a bug
   * rather than as judgement.
   */
  sellCandidate(prof) {
    if (!this.can('sell')) return null;
    if (Game.wave < AI_SELL_MIN_WAVE) return null;
    if ((this.sold || 0) >= AI_SELL_MAX) return null;
    const S = this.side;
    if (S.towers.length < 4) return null;   /* never cut into a thin board */
    let sum = 0, n = 0;
    const val = [];
    for (const t of S.towers) {
      if (t.isSupport) continue;            /* support earns off the ledger */
      const e = this.effectiveness(t.def, t.stats, t.estimateDps(), prof) *
                this.covMul(this.coverage(t.x, t.y, t.effRange));
      val.push({ t: t, e: e }); sum += e; n++;
    }
    if (n < 3) return null;
    const mean = sum / n;
    if (!(mean > 0)) return null;
    let worst = null;
    for (const v of val) if (!worst || v.e < worst.e) worst = v;
    if (!worst || worst.e >= mean * AI_SELL_SHARE) return null;
    /* If the same gold would fix it by upgrading, that is the better move and
       the scorer will already have found it -- do not cut what is about to
       come good. */
    const next = worst.t.nextUpgrade();
    if (next) {
      const before = worst.t.isSupport ? 0
        : this.effectiveness(worst.t.def, worst.t.stats, worst.t.estimateDps(), prof);
      if (this.projectedUpgrade(worst.t, next, prof) > before * 1.6) return null;
    }
    return worst.t;
  },

  /* ----------------------------------------------------------- upgrades */

  /** Picks a command upgrade that fits its actual board, not a fixed list. */
  chooseMod(options) {
    const S = this.side;
    const prof = this.lastProfile || this.profile();
    const n = S.towers.length || 1;
    const area = this.areaTowers();
    const status = S.towers.filter(t => t.stats.slow || t.stats.burn || t.stats.poisonDps).length;

    const score = m => {
      switch (m.id) {
        case 'overcharge': return 100 + n * 8;
        case 'cycling':    return 88 + n * 7;
        case 'optics':     return 62 + n * 4;
        case 'ap':         return 55 + prof.armorShare * 190;
        case 'crit':       return 78;
        case 'ordnance':   return 40 + area * 26;
        case 'catalyst':   return 40 + status * 30;
        case 'salvage':    return Game.wave < 18 ? 118 : 55;
        case 'logistics':  return Game.wave < 16 ? 122 : 48;
        case 'necrotic':   return 60 + S.stats.kills * 0.05;
        case 'conscript':  return 68 + S.stats.kills * 0.06;
        case 'bulwarks':   return S.lives < S.maxLives * 0.55 ? 260 : 70;
        /* LAND CARDS. They buy BOARD, not a percentage, so their worth is
           entirely how starved this commander is for somewhere to stand --
           and it is exactly zero where it has no rubble of its own to clear.
           Without this case both fell to `default: 50` and could beat HEAVY
           ORDNANCE or STATUS CATALYST (40 each) on a wide-open map, while
           handing their free demolitions to the wrong half of the board. */
        case 'sappers': case 'surveyors': {
          if (!this.clearableCount()) return 0;
          /* Starvation is a SHARE of this side's own board, not a raw tile
             count. freeSpots() returns 60-260 depending on the map, so
             dividing it by an absolute 10 clamped starve to 0 on every
             reachable position: the score sat on AI_MOD_LAND_FLOOR (12),
             lost to every other arm of this switch (all floored at 40), and
             the rival never drafted SAPPER CORPS or SURVEY TEAM. `free +
             towers` is the whole board and is stable across rebuilds --
             this.spots.length is not, because buildSpots already excludes
             occupied tiles. BATCH-A/numbers */
          const free = this.freeSpots();
          const board = Math.max(1, free + S.towers.length);
          const starve = clamp(1 - (free / board) / AI_MOD_LAND_ROOMY, 0, 1);
          const v = AI_MOD_LAND_FLOOR + (AI_MOD_LAND_STARVED - AI_MOD_LAND_FLOOR) * starve;
          /* SAPPER hauls two tiles and discounts every later one; SURVEY
             hauls one and raises a ceiling that only pays if it is in reach. */
          return m.id === 'sappers' ? v : v * AI_MOD_LAND_SURVEY_BIAS;
        }
        default: return 50;
      }
    };
    let best = options[0], bs = -1;
    for (const o of options) { const v = score(o); if (v > bs) { bs = v; best = o; } }
    best.apply(S.mods, S);
    S.taken.push(best);
    /* A land card moves the BOARD rather than a multiplier, and grantClearances
       has already run inside apply(): rebuild the spot cache or this brain
       cannot see the ground its own draft just bought. */
    if (best.land) this.buildSpots();
    for (const t of S.towers) t.recompute();
    Game.recomputeAuras();
    this.aiLastMod = best;
  }
};
