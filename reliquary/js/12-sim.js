/* RELIQUARY :: 12-sim
   The simulation. Everything that would still be true with the renderer
   switched off.

   ONE MARK AT A TIME. A denizen carries at most one elemental mark. Applying a
   second element that pairs with it triggers a reaction, consumes the mark,
   and leaves the new element as the standing mark. The alternative, letting
   marks stack, was rejected on legibility grounds: with three marks up the
   player cannot predict which reaction the next shot produces, and a reaction
   system nobody can predict is a random damage multiplier wearing a costume.

   ARMOUR IS MULTIPLICATIVE AND CAPPED. Additive flat reduction makes low-damage
   fast towers worthless against armour and is the usual reason a tower defence
   collapses into one correct build. Capping at 75% keeps every tower relevant
   while still making SUPERCONDUCT worth firing.

   THE ERROR BUFFER. Anything that throws inside a step is recorded in
   `errors` and reported, never swallowed. A delayed effect that throws on
   every trigger, forever, with every gate green, is a real failure mode: the
   parent project shipped exactly that for its whole life. */
'use strict';

var SIM = (function () {

  var V = U.V;
  var errors = [];
  function recordError(where, e) {
    if (errors.length < 40) errors.push({ where: where, msg: String(e && e.message || e) });
    if (typeof console !== 'undefined') console.error('[SIM:' + where + ']', e);
  }

  /* ---------- state ---------- */
  var G = null;

  function create(opts) {
    /* TEAR THE PREVIOUS RUN DOWN FIRST.
       Replacing G with a fresh object does NOT stop the oscillators the old
       game's beam and sweep towers left running: a Web Audio node keeps
       playing until something calls stop() on it, and nothing else holds a
       reference once G is gone. Every restart used to leak one running voice
       per beam tower, forever, and the symptom is a rising drone that the
       player cannot mute or explain. */
    if (G && G.towers) {
      for (var i = 0; i < G.towers.length; i++) {
        if (G.towers[i].voice) { G.towers[i].voice.stop(); G.towers[i].voice = null; }
      }
    }
    errors.length = 0;

    var diff = opts.difficulty || DATA.DIFFICULTIES[1];
    var board = TERRAIN.build(opts.boardDef);
    var cmd = DATA.COMMANDERS[opts.commander] || DATA.COMMANDERS.vanta;

    G = {
      board: board,
      boardDef: opts.boardDef,
      faction: opts.faction || 'human',
      enemyFaction: opts.enemyFaction || 'xeno',
      commander: cmd,
      difficulty: diff,

      gold: DATA.START_GOLD + (cmd.id === 'axiom' ? 150 : 0),
      lives: diff.lives,
      maxLives: diff.lives,
      wave: 0,
      waveActive: false,
      waveTimer: 0,
      betweenWaves: 6.0,
      spawnQueue: [],

      denizens: [],
      towers: [],
      projs: [],
      delayed: [],

      time: 0,
      status: 'prep',        /* prep | play | won | lost */
      leaked: 0,
      kills: 0,
      damageDealt: 0,
      goldEarned: 0,
      reactionCounts: {},

      abilities: {
        q: { cd: 0, active: 0 },
        e: { cd: 0, active: 0 }
      },
      globalBuffs: { fireRate: 1, damage: 1, range: 1, slowAll: 0, stopAll: 0 },

      selected: null,        /* tower id being placed */
      inspecting: null,      /* placed tower under inspection */
      nextId: 1
    };
    return G;
  }

  function state() { return G; }

  /* ---------- helpers ---------- */

  function costOf(def, tier) {
    if (tier === 0) return def.cost;
    var u = def.upgrades[tier - 1];
    return u ? u.cost : Infinity;
  }
  function upgradeCost(tower) {
    if (tower.tier >= 2) return Infinity;
    var c = DATA.TOWERS[tower.id].upgrades[tower.tier].cost;
    if (G.commander.id === 'axiom') c = Math.round(c * 0.88);
    return c;
  }
  function sellValue(tower) {
    return Math.round(tower.invested * DATA.SELL_RATIO);
  }

  /* Resolve a tower's live stats from its def, tier, commander and buffs.
     Recomputed on demand rather than cached, because a cached stat block that
     forgets to invalidate is the classic source of a buff that never wears
     off, and this is nowhere near hot enough to need the cache. */
  /* STATS ARE CACHED FOR THE LIFE OF A TICK.
     This was recomputed from scratch for every tower on every 120Hz substep
     AND again for every tower in the draw path: roughly 4000 fresh objects a
     second on a full board, which is a GC sawtooth for no benefit, since
     nothing that feeds it can change within a tick. The stamp is bumped
     wherever a tower's inputs change (tier, ability, wave), so a stale block
     is not reachable rather than merely unlikely. */
  var statsStamp = 0;
  function bumpStats() { statsStamp++; }

  function stats(t) {
    if (t.__statsAt === statsStamp && t.__stats) return t.__stats;
    var d = DATA.TOWERS[t.id];
    var s = {
      dps: d.dps, range: d.range, fireRate: d.fireRate || 1,
      splash: d.splash || 0, projSpeed: d.projSpeed || 50,
      chains: d.chains || 0, chainRange: d.chainRange || 0,
      chainFalloff: d.chainFalloff || 0.7,
      coneAngle: d.coneAngle || 0, pierce: d.pierce || 0,
      execute: d.execute || 0, pull: d.pull || 0, income: d.income || 0,
      rampMax: d.rampMax || 1, rampRate: d.rampRate || 1,
      sweepRate: d.sweepRate || 1, launch: d.launch || 0,
      airBonus: d.airBonus || 1, minRange: d.minRange || 0,
      slow: d.slow ? { amount: d.slow.amount, dur: d.slow.dur } : null,
      burn: d.burn ? { dps: d.burn.dps, dur: d.burn.dur } : null,
      poison: d.poison ? { pctHp: d.poison.pctHp, dur: d.poison.dur, maxStacks: d.poison.maxStacks } : null
    };
    /* Tier multipliers, applied in order. */
    for (var i = 0; i < t.tier; i++) {
      var u = d.upgrades[i];
      if (!u) continue;
      if (u.dps) s.dps *= u.dps;
      if (u.range) s.range *= u.range;
      if (u.fireRate) s.fireRate *= u.fireRate;
      if (u.splash) s.splash *= u.splash;
      if (u.chains) s.chains += u.chains;
      if (u.chainFalloff) s.chainFalloff = Math.min(0.95, s.chainFalloff * u.chainFalloff);
      if (u.coneAngle) s.coneAngle *= u.coneAngle;
      if (u.execute) s.execute *= u.execute;
      if (u.pull) s.pull *= u.pull;
      if (u.income) s.income *= u.income;
      if (u.rampMax) s.rampMax *= u.rampMax;
      if (u.rampRate) s.rampRate *= u.rampRate;
      if (u.sweepRate) s.sweepRate *= u.sweepRate;
      if (u.launch) s.launch *= u.launch;
      if (u.airBonus) s.airBonus *= u.airBonus;
      if (u.slowAmount && s.slow) s.slow.amount = Math.min(0.85, s.slow.amount * u.slowAmount);
      if (u.slowDur && s.slow) s.slow.dur *= u.slowDur;
      if (u.burnDps && s.burn) s.burn.dps *= u.burnDps;
      if (u.burnDur && s.burn) s.burn.dur *= u.burnDur;
      if (u.poisonPct && s.poison) s.poison.pctHp *= u.poisonPct;
      if (u.poisonStacks && s.poison) s.poison.maxStacks = Math.round(s.poison.maxStacks * u.poisonStacks);
      if (u.poisonDur && s.poison) s.poison.dur *= u.poisonDur;
    }

    /* Commander traits. */
    var c = G.commander;
    if (c.id === 'vanta') {
      /* PERPETUAL STUDY: 8% per wave survived, capped at 40%. */
      s.dps *= 1 + Math.min(0.40, t.wavesSurvived * 0.08);
    }
    if (c.id === 'seraph' && d.element === 'radiant') s.range *= 1.20;

    /* Global buffs from abilities. */
    s.fireRate *= G.globalBuffs.fireRate;
    s.dps *= G.globalBuffs.damage;
    s.range *= G.globalBuffs.range;
    if (c.id === 'seraph' && G.abilities.q.active > 0 && d.element === 'radiant') s.dps *= 2;
    t.__stats = s;
    t.__statsAt = statsStamp;
    return s;
  }

  /* ---------- placement ---------- */

  function canPlace(plotId, towerId) {
    var plot = findPlot(plotId);
    if (!plot) return { ok: false, why: 'no such plot' };
    if (plot.tower) return { ok: false, why: 'occupied' };
    var def = DATA.TOWERS[towerId];
    if (!def) return { ok: false, why: 'unknown tower' };
    if (G.gold < def.cost) return { ok: false, why: 'not enough gold' };
    return { ok: true };
  }

  function findPlot(id) {
    var p = G.board.plots;
    for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i];
    return null;
  }

  function place(plotId, towerId) {
    var chk = canPlace(plotId, towerId);
    if (!chk.ok) return null;
    var plot = findPlot(plotId);
    var def = DATA.TOWERS[towerId];
    G.gold -= def.cost;
    var t = {
      uid: G.nextId++,
      id: towerId, tier: 0,
      plot: plot,
      pos: [plot.x, plot.y, plot.z],
      yaw: 0, targetYaw: 0, yawVel: 0,
      pitch: 0,
      cooldown: 0.35,
      recoil: 0, spin: 0, spinVel: 0,
      target: null, lastTarget: null,
      beamRamp: 0, beamOn: 0,
      sweepAngle: 0,
      buildT: 0,
      invested: def.cost,
      wavesSurvived: 0,
      kills: 0, damage: 0,
      disabled: 0,
      voice: null
    };
    plot.tower = t;
    G.towers.push(t);
    return t;
  }

  function upgrade(tower) {
    if (tower.tier >= 2) return false;
    var c = upgradeCost(tower);
    if (G.gold < c) return false;
    G.gold -= c;
    tower.invested += c;
    tower.tier++;
    tower.buildT = 0;
    bumpStats();
    return true;
  }

  function sell(tower) {
    var v = sellValue(tower);
    G.gold += v;
    tower.plot.tower = null;
    var i = G.towers.indexOf(tower);
    if (i >= 0) G.towers.splice(i, 1);
    if (tower.voice) { tower.voice.stop(); tower.voice = null; }
    if (G.inspecting === tower) G.inspecting = null;
    return v;
  }

  /* ---------- denizens ---------- */

  function spawnDenizen(typeId, opts) {
    opts = opts || {};
    var def = DATA.DENIZENS[typeId];
    if (!def) { recordError('spawnDenizen', new Error('unknown denizen ' + typeId)); return null; }
    var hpMul = DATA.waveHpMultiplier(G.wave) * G.difficulty.hp;
    var d = {
      uid: G.nextId++,
      def: def, type: typeId,
      name: (DATA.FACTION_NAMES[G.enemyFaction] || {})[typeId] || def.name,
      hp: def.hp * hpMul * (opts.hpScale || 1),
      maxHp: def.hp * hpMul * (opts.hpScale || 1),
      dist: opts.dist || 0,
      speed: def.speed,
      pos: [0, 0, 0], yaw: 0,
      flying: !!def.flying,
      airborne: 0,                /* launched by cyclone */
      alive: true, dying: 0,
      mark: null, markT: 0, reactCd: 0,
      slow: 0, slowT: 0,
      burn: 0, burnT: 0, burnSrc: null,
      poison: 0, poisonT: 0, poisonStacks: 0, poisonSrc: null,
      stun: 0,
      shred: 0, shredT: 0,
      healRev: 0,
      flash: 0,
      scale: def.scale || 1,
      animPhase: Math.random(),
      bob: 0, bobV: 0,
      lean: 0, leanV: 0,
      rig: null,
      summonT: 0,
      phaseIdx: 0,
      enrage: 1,
      lastHitBy: null
    };
    var s = G.board.pathAt(d.dist);
    d.pos = [s.pos[0], G.board.heightAt(s.pos[0], s.pos[2]), s.pos[2]];
    d.yaw = Math.atan2(s.dir[0], s.dir[2]);
    G.denizens.push(d);
    return d;
  }

  function armorOf(d) {
    var a = (d.def.armor || 0) * (1 - d.shred);
    if (d.def.trait === 'shield' && d.hp > d.maxHp * 0.5) a += (d.def.shield ? d.def.shield.amount : 0.3);
    return U.clamp(a, 0, 0.75);
  }

  /* THE DAMAGE PIPELINE. One function, so there is exactly one place where a
     damage rule can be added and exactly one place to look when a number is
     wrong. */
  function damage(d, amount, opts) {
    if (!d.alive || d.dying > 0) return 0;
    opts = opts || {};
    var element = opts.element || null;
    var src = opts.source || null;

    var reaction = null;
    if (element) {
      if (d.mark && d.mark !== element) {
        reaction = DATA.reactionFor(d.mark, element);
      }
      d.mark = element;
      d.markT = 6.0;
    }

    /* REACTIONS HAVE A PER-BODY COOLDOWN.
       Without one, a field tower (SINGULARITY applies VOID continuously)
       re-marks its target every tick, so every kinetic shot landing on that
       target triggers RUPTURE. Measured at wave nine with a full board: 110
       RUPTURE against 2 PLASMA, a callout on screen almost every frame. That
       is not a deep system, it is a damage multiplier with a light show, and
       it drowns out the reactions the player actually set up.
       The mark still updates while on cooldown, so nothing is lost except the
       spam: the next reaction simply lands on the beat instead of instantly. */
    if (reaction) {
      if (d.reactCd > 0) reaction = null;
      else d.reactCd = 0.55;
    }

    var mult = 1;
    if (reaction) {
      mult *= reaction.mult;
      if (G.commander.id === 'seraph') mult *= 1.15;
      applyReaction(d, reaction, opts);
      G.reactionCounts[reaction.id] = (G.reactionCounts[reaction.id] || 0) + 1;
    }

    var armor = armorOf(d);
    var dealt = amount * mult * (1 - armor);

    if (reaction && reaction.missingHp) {
      dealt += (d.maxHp - d.hp) * reaction.missingHp;
    }

    d.hp -= dealt;
    d.flash = Math.max(d.flash, reaction ? 1.0 : 0.55);
    d.lastHitBy = src;
    G.damageDealt += dealt;
    if (src) { src.damage += dealt; }

    /* Execute: MAW kills anything below a threshold outright, except bosses,
       because an instant kill on a boss is not a mechanic, it is a bug the
       player found. */
    if (opts.execute && !d.def.boss && d.hp > 0 && d.hp < d.maxHp * opts.execute) {
      d.hp = 0;
    }

    if (d.hp <= 0) kill(d, opts);
    return dealt;
  }

  function applyReaction(d, r, opts) {
    try {
      if (r.burn) { d.burn = Math.max(d.burn, r.burn.dps); d.burnT = Math.max(d.burnT, r.burn.dur); }
      if (r.shred) { d.shred = Math.max(d.shred, r.shred.amount); d.shredT = Math.max(d.shredT, r.shred.dur); }
      if (r.stun) d.stun = Math.max(d.stun, r.stun);
      if (r.healReversal) d.healRev = Math.max(d.healRev, r.healReversal);
      if (r.amplify && d.poisonStacks > 0) d.poisonStacks = Math.min(12, Math.round(d.poisonStacks * r.amplify));
      if (r.pull) {
        for (var i = 0; i < G.denizens.length; i++) {
          var o = G.denizens[i];
          if (o === d || !o.alive) continue;
          if (V.dist(o.pos, d.pos) < r.pull * 2.2) {
            o.dist = U.mix(o.dist, d.dist, 0.35);
          }
        }
      }
      if (r.spread) {
        for (var j = 0; j < G.denizens.length; j++) {
          var e = G.denizens[j];
          if (e === d || !e.alive) continue;
          if (V.dist(e.pos, d.pos) < r.spread && !e.mark) { e.mark = d.mark; e.markT = 4.0; }
        }
      }
      /* The callout and the sound, once per reaction, at the body. */
      FX.text([d.pos[0], d.pos[1] + 2.4 * d.scale, d.pos[2]], r.name,
        { color: r.color, life: 1.05, size: 1.15, cls: 'reaction' });
      FX.burst([d.pos[0], d.pos[1] + 1.2 * d.scale, d.pos[2]], U.hex2rgb(r.color),
        { count: 20, speed: 12, life: 0.55, size: 0.42 });
      FX.shockRing([d.pos[0], d.pos[1] + 0.3, d.pos[2]], U.hex2rgb(r.color), 3.2, 0.4);
      AUDIO.play('reaction', { pan: panOf(d.pos), mult: r.mult });
      FX.hit(Math.min(0.9, 0.25 * r.mult), { stop: r.mult > 2 ? 0.05 : 0 });
    } catch (e) {
      recordError('applyReaction:' + r.id, e);
    }
  }

  function kill(d, opts) {
    if (!d.alive || d.dying > 0) return;
    d.alive = false;
    d.dying = 0.55;
    d.hp = 0;
    G.kills++;

    var bounty = d.def.bounty * G.difficulty.gold;
    if (G.commander.id === 'rake') bounty *= 1.25;
    bounty = Math.round(bounty);
    G.gold += bounty;
    G.goldEarned += bounty;
    if (d.lastHitBy) d.lastHitBy.kills++;

    FX.text([d.pos[0], d.pos[1] + 2.0 * d.scale, d.pos[2]], '+' + bounty,
      { color: '#fbbf24', life: 0.9, size: 0.9, cls: 'gold' });

    var pal = PAINT.FACTIONS[G.enemyFaction] || PAINT.FACTIONS.xeno;
    var col = U.hex2rgb(pal.accent);
    var big = d.def.boss || d.scale > 1.4;
    FX.burst([d.pos[0], d.pos[1] + 1.0 * d.scale, d.pos[2]], col,
      { count: big ? 46 : 18, speed: big ? 20 : 11, life: big ? 1.1 : 0.6, size: big ? 0.6 : 0.34 });
    if (big) {
      FX.smoke([d.pos[0], d.pos[1] + 0.6, d.pos[2]], [0.35, 0.28, 0.5], 12, 1.6);
      FX.shockRing([d.pos[0], d.pos[1] + 0.2, d.pos[2]], col, 9, 0.6);
      FX.hit(1.5, { stop: 0.09, flash: 0.13 });
      AUDIO.play('death_big', { pan: panOf(d.pos) });
      AUDIO.duck(0.45, 1.1);
    } else {
      AUDIO.play('death', { pan: panOf(d.pos) });
      FX.hit(0.16);
    }

    /* SPLIT: a broodmother becomes three gnawlings at the same point on the
       path, fanned slightly so they do not overlap into one silhouette. */
    if (d.def.trait === 'split' && d.def.split) {
      for (var i = 0; i < d.def.split.count; i++) {
        var c = spawnDenizen(d.def.split.into, { dist: Math.max(0, d.dist - i * 1.4) });
        if (c) { c.hp = c.maxHp * 0.8; c.flash = 0.4; }
      }
    }
  }

  function leak(d) {
    d.alive = false;
    d.dying = 0.01;
    G.leaked++;
    var cost = d.def.boss ? 5 : 1;
    G.lives -= cost;
    FX.hit(1.1, { flash: 0.2 });
    AUDIO.play('lifeLost');
    if (G.lives <= 0) {
      G.lives = 0;
      endGame(false);
    }
  }

  function endGame(won) {
    if (G.status === 'won' || G.status === 'lost') return;
    G.status = won ? 'won' : 'lost';
    for (var i = 0; i < G.towers.length; i++) {
      if (G.towers[i].voice) { G.towers[i].voice.stop(); G.towers[i].voice = null; }
    }
    AUDIO.play(won ? 'victory' : 'defeat');
    AUDIO.setIntensity(0);
  }

  /* Pan a world position to -1..1 by its screen X, so the mix follows the
     camera rather than the world axes. Falls back to centre before the first
     frame has established a projection. */
  function panOf(pos) {
    var p = R.project(pos);
    if (!p) return 0;
    var w = R.W / (R.quality.scale || 1);
    return U.clamp((p.x / (w || 1)) * 2 - 1, -1, 1) * 0.7;
  }

  /* ---------- waves ---------- */

  function startWave() {
    if (G.waveActive || G.status !== 'play') return false;
    G.wave++;
    if (G.wave > DATA.WAVES.length) { endGame(true); return false; }
    var w = DATA.WAVES[G.wave - 1];
    G.waveActive = true;
    G.spawnQueue.length = 0;
    for (var i = 0; i < w.groups.length; i++) {
      var g = w.groups[i];
      for (var k = 0; k < g.count; k++) {
        G.spawnQueue.push({ of: g.of, at: (g.delay || 0) + k * g.gap });
      }
    }
    G.spawnQueue.sort(function (a, b) { return a.at - b.at; });
    G.waveTimer = 0;
    for (var t = 0; t < G.towers.length; t++) G.towers[t].wavesSurvived++;
    AUDIO.play('waveStart');
    if (w.boss) { AUDIO.play('bossSpawn'); AUDIO.duck(0.5, 2.2); }
    return true;
  }

  function endWave() {
    G.waveActive = false;
    var w = DATA.WAVES[G.wave - 1];
    var bonus = Math.round((w ? w.bonus : 40) * G.difficulty.gold);
    /* Vault income pays here rather than continuously, so the player can see
       exactly what the economy tower bought them. */
    var income = 0;
    for (var i = 0; i < G.towers.length; i++) {
      var t = G.towers[i];
      if (DATA.TOWERS[t.id].kind === 'support') income += Math.round(stats(t).income);
    }
    G.gold += bonus + income;
    G.goldEarned += bonus + income;
    G.waveTimer = 0;
    if (G.wave >= DATA.WAVES.length) { endGame(true); return { bonus: bonus, income: income }; }
    return { bonus: bonus, income: income };
  }

  /* ---------- targeting ---------- */

  function inRange(t, d, s) {
    if (!d.alive || d.dying > 0) return false;
    var def = DATA.TOWERS[t.id];
    if (d.flying && !def.air) return false;
    /* A launched ground unit counts as airborne, which is the entire point of
       CYCLONE: it converts a ground wave into an anti-air problem. */
    if (d.airborne > 0 && !def.air) return false;
    var dx = d.pos[0] - t.pos[0], dz = d.pos[2] - t.pos[2];
    var d2 = dx * dx + dz * dz;
    if (d2 > s.range * s.range) return false;
    if (s.minRange > 0 && d2 < s.minRange * s.minRange) return false;
    return true;
  }

  /* Highest progress along the path wins, which is the standard and correct
     default: the leader is the one about to leak. */
  function pickTarget(t, s) {
    var best = null, bestDist = -1;
    for (var i = 0; i < G.denizens.length; i++) {
      var d = G.denizens[i];
      if (!inRange(t, d, s)) continue;
      if (d.dist > bestDist) { bestDist = d.dist; best = d; }
    }
    return best;
  }

  /* ---------- projectiles ---------- */

  function fireProjectile(t, s, from, target, def) {
    var p = {
      uid: G.nextId++,
      pos: [from[0], from[1], from[2]],
      start: [from[0], from[1], from[2]],
      target: target,
      lastKnown: [target.pos[0], target.pos[1] + 0.8 * target.scale, target.pos[2]],
      speed: s.projSpeed,
      dmg: s.dps / Math.max(0.001, s.fireRate),
      splash: s.splash,
      element: def.element,
      source: t,
      kind: def.kind,
      arc: !!def.arc,
      t: 0, life: 4.0,
      execute: s.execute,
      launch: s.launch,
      slow: s.slow, burn: s.burn, poison: s.poison,
      airBonus: s.airBonus,
      spin: Math.random() * 6
    };
    G.projs.push(p);
    return p;
  }

  function updateProjectiles(dt) {
    var w = 0;
    for (var i = 0; i < G.projs.length; i++) {
      var p = G.projs[i];
      p.t += dt;
      p.life -= dt;

      /* RE-ACQUIRE ON THE WAY IN. Aiming at where the target was when the shot
         left the barrel means every shot at a moving target misses, and with
         several towers converging on one runner they all miss together. The
         projectile tracks its target while the target lives, and falls back to
         its last known position once it does not. */
      var aim = p.lastKnown;
      if (p.target && p.target.alive && p.target.dying <= 0) {
        aim = [p.target.pos[0], p.target.pos[1] + 0.8 * p.target.scale, p.target.pos[2]];
        p.lastKnown = aim;
      }

      var to = V.sub(aim, p.pos);
      var dist = V.len(to);
      var step = p.speed * dt;

      if (dist <= step || p.life <= 0) {
        detonate(p, aim);
        continue;
      }
      var dir = V.scale(to, 1 / dist);
      p.pos[0] += dir[0] * step;
      p.pos[1] += dir[1] * step;
      p.pos[2] += dir[2] * step;
      /* Arcing shells rise then fall, purely visual: the impact point is
         already decided by the tracking above. */
      if (p.arc) {
        var total = V.dist(p.start, aim);
        var travelled = V.dist(p.start, p.pos);
        var frac = total > 0.01 ? travelled / total : 1;
        p.pos[1] += Math.sin(frac * Math.PI) * total * 0.22;
      }
      p.dir = dir;
      p.spin += dt * 9;
      G.projs[w++] = p;
    }
    G.projs.length = w;
  }

  function detonate(p, at) {
    try {
      var col = U.hex2rgb(DATA.ELEMENTS[p.element] ? DATA.ELEMENTS[p.element].color : '#ffffff');
      if (p.splash > 0) {
        var hitAny = false;
        for (var i = 0; i < G.denizens.length; i++) {
          var d = G.denizens[i];
          if (!d.alive || d.dying > 0) continue;
          var dd = V.dist(d.pos, at);
          if (dd > p.splash) continue;
          var falloff = 1 - (dd / p.splash) * 0.55;
          applyHit(p, d, p.dmg * falloff);
          hitAny = true;
        }
        /* The direction the shell ARRIVED from, so the spray throws back along
           its path rather than spherically. p.dir is set every step while the
           projectile is in flight. */
        FX.impact(at, p.dir || [0, -1, 0], col, U.clamp(p.splash * 0.34, 0.8, 2.2));
        FX.shockRing(at, col, p.splash * 1.9, 0.36);
        FX.smoke(at, [0.4, 0.32, 0.55], 5, p.splash * 0.35);
        AUDIO.play('impact_splash', { pan: panOf(at) });
        FX.hit(0.35);
      } else {
        /* SINGLE TARGET. Re-find the nearest living body within a tolerance
           rather than requiring the stored target to still be alive: without
           this, a shot whose target dies in flight does nothing at all, which
           in a dense wave is a large fraction of every shot fired. */
        var best = null, bestD = 1e9;
        for (var j = 0; j < G.denizens.length; j++) {
          var e = G.denizens[j];
          if (!e.alive || e.dying > 0) continue;
          var ed = V.dist(e.pos, at);
          if (ed < bestD) { bestD = ed; best = e; }
        }
        if (best && bestD < 2.6) {
          applyHit(p, best, p.dmg);
          FX.impact(at, p.dir || [0, -1, 0], col, 0.62);
          AUDIO.play('impact_small', { pan: panOf(at) });
        } else {
          /* A clean miss still shows something, or a shot that hits nothing
             looks like the projectile was deleted rather than that it landed
             short. Smaller, and no shards. */
          FX.impact(at, p.dir || [0, -1, 0], col, 0.34);
        }
      }
    } catch (e) {
      recordError('detonate', e);
    }
  }

  function applyHit(p, d, amount) {
    var amt = amount;
    if ((d.flying || d.airborne > 0) && p.airBonus > 1) amt *= p.airBonus;
    damage(d, amt, { element: p.element, source: p.source, execute: p.execute });
    if (!d.alive) return;
    if (p.slow) { d.slow = Math.max(d.slow, p.slow.amount); d.slowT = Math.max(d.slowT, p.slow.dur); }
    if (p.burn) {
      d.burn = Math.max(d.burn, p.burn.dps);
      d.burnT = Math.max(d.burnT, p.burn.dur);
      d.burnSrc = p.source;
    }
    if (p.poison) {
      d.poisonStacks = Math.min(p.poison.maxStacks, d.poisonStacks + 1);
      d.poison = p.poison.pctHp;
      d.poisonT = p.poison.dur * (G.commander.id === 'sevra' ? 1.4 : 1);
      d.poisonSrc = p.source;
    }
    if (p.launch > 0 && !d.flying && !d.def.boss) {
      d.airborne = Math.max(d.airborne, 1.4 * p.launch);
    }
  }

  /* ---------- tower firing ---------- */

  function fireTower(t, s, def, dt) {
    var model = MODELS.tower(t.id, t.tier);
    /* The muzzle is authored in turret-local space, so it has to be rotated
       into world space by the turret's current yaw before anything is spawned
       from it. Skipping this is why muzzle flashes in prototypes so often
       appear on the wrong side of the tower. */
    var m = model.muzzle;
    var cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
    var muzzleWorld = [
      t.pos[0] + m[0] * cy + m[2] * sy,
      t.pos[1] + model.turretY + m[1],
      t.pos[2] + (-m[0] * sy + m[2] * cy)
    ];
    var target = t.target;
    var pan = panOf(t.pos);
    var accent = model.accent;

    switch (def.kind) {
      case 'bullet':
      case 'shell': {
        fireProjectile(t, s, muzzleWorld, target, def);
        var dir = V.norm(V.sub(target.pos, muzzleWorld));
        FX.muzzle(muzzleWorld, dir, accent, 1 + t.tier * 0.28);
        AUDIO.playShot(def.kind === 'shell' ? 'shell' : 'bullet', { pan: pan });
        t.recoil = 1;
        FX.hit(def.kind === 'shell' ? 0.10 : 0.03, { aberr: false });
        break;
      }
      case 'chain': {
        var hits = [], cur = target, used = {};
        var dmg = s.dps / Math.max(0.001, s.fireRate);
        for (var c = 0; c <= s.chains && cur; c++) {
          used[cur.uid] = true;
          hits.push({ d: cur, dmg: dmg * Math.pow(s.chainFalloff, c) });
          var next = null, nd = 1e9;
          for (var i = 0; i < G.denizens.length; i++) {
            var o = G.denizens[i];
            if (!o.alive || o.dying > 0 || used[o.uid]) continue;
            if (o.flying && !def.air) continue;
            var od = V.dist(o.pos, cur.pos);
            if (od < s.chainRange && od < nd) { nd = od; next = o; }
          }
          cur = next;
        }
        var prev = muzzleWorld;
        for (var h = 0; h < hits.length; h++) {
          var hd = hits[h].d;
          damage(hd, hits[h].dmg, { element: def.element, source: t });
          t.arcs = t.arcs || [];
          t.arcs.push({ a: prev.slice(), b: [hd.pos[0], hd.pos[1] + 0.8 * hd.scale, hd.pos[2]], life: 0.16 });
          prev = [hd.pos[0], hd.pos[1] + 0.8 * hd.scale, hd.pos[2]];
          FX.impact(prev, V.norm(V.sub(prev, muzzleWorld)), accent, 0.45);
        }
        AUDIO.playShot('chain', { pan: pan });
        t.recoil = 0.6;
        break;
      }
      case 'cone': {
        var fwd = [Math.sin(t.yaw), 0, Math.cos(t.yaw)];
        var dmgC = s.dps / Math.max(0.001, s.fireRate);
        var any = false;
        for (var k = 0; k < G.denizens.length; k++) {
          var e = G.denizens[k];
          if (!inRange(t, e, s)) continue;
          var to = V.norm([e.pos[0] - t.pos[0], 0, e.pos[2] - t.pos[2]]);
          if (V.dot(to, fwd) < Math.cos(s.coneAngle)) continue;
          damage(e, dmgC, { element: def.element, source: t });
          if (e.alive && s.burn) { e.burn = Math.max(e.burn, s.burn.dps); e.burnT = Math.max(e.burnT, s.burn.dur); e.burnSrc = t; }
          any = true;
        }
        /* The flame is drawn as particles rather than geometry: a cone mesh
           reads as a solid object, and fire does not. */
        for (var f = 0; f < 12; f++) {
          var spread = (Math.random() - 0.5) * s.coneAngle * 2;
          var ca = Math.cos(spread), sa = Math.sin(spread);
          var d2 = [fwd[0] * ca - fwd[2] * sa, 0.12, fwd[0] * sa + fwd[2] * ca];
          FX.spawn({
            x: muzzleWorld[0], y: muzzleWorld[1], z: muzzleWorld[2],
            vx: d2[0] * (9 + Math.random() * 10), vy: 1.6 + Math.random() * 2,
            vz: d2[2] * (9 + Math.random() * 10),
            r: accent[0], g: accent[1], b: accent[2],
            life: 0.30 + Math.random() * 0.25, size: 0.5, size1: 1.5,
            rot: Math.random() * 6, rotv: (Math.random() - 0.5) * 6,
            kind: FX.KIND.SMOKE, drag: 2.6, grav: 2.2, alpha: 0.8
          });
        }
        AUDIO.playShot('cone', { pan: pan });
        t.recoil = 0.35;
        break;
      }
      case 'hitscan': {
        var dirH = V.norm([target.pos[0] - t.pos[0], 0, target.pos[2] - t.pos[2]]);
        var dmgH = s.dps / Math.max(0.001, s.fireRate);
        var hitCount = 0;
        for (var q = 0; q < G.denizens.length; q++) {
          var g2 = G.denizens[q];
          if (!g2.alive || g2.dying > 0) continue;
          if (g2.flying && !def.air) continue;
          /* Perpendicular distance to the firing line, forward only. */
          var rel = [g2.pos[0] - t.pos[0], 0, g2.pos[2] - t.pos[2]];
          var along = V.dot(rel, dirH);
          if (along < 0 || along > s.range * 1.4) continue;
          var perp = V.len(V.sub(rel, V.scale(dirH, along)));
          if (perp > 1.5) continue;
          damage(g2, dmgH, { element: def.element, source: t });
          hitCount++;
          if (hitCount > s.pierce) break;
        }
        t.beams = t.beams || [];
        t.beams.push({
          a: muzzleWorld.slice(),
          b: [t.pos[0] + dirH[0] * s.range * 1.4, muzzleWorld[1], t.pos[2] + dirH[2] * s.range * 1.4],
          life: 0.22, width: 0.5
        });
        FX.muzzle(muzzleWorld, dirH, accent, 1.5 + t.tier * 0.35);
        AUDIO.playShot('hitscan', { pan: pan });
        t.recoil = 1.4;
        FX.hit(0.4, { stop: 0.02 });
        break;
      }
    }
  }

  /* ---------- main step ---------- */

  function step(dt) {
    if (!G || G.status === 'won' || G.status === 'lost') return;
    try {
      G.time += dt;
      bumpStats();

      /* abilities */
      var ab = G.abilities;
      ab.q.cd = Math.max(0, ab.q.cd - dt);
      ab.e.cd = Math.max(0, ab.e.cd - dt);
      var wasQ = ab.q.active > 0, wasE = ab.e.active > 0;
      ab.q.active = Math.max(0, ab.q.active - dt);
      ab.e.active = Math.max(0, ab.e.active - dt);
      if (wasQ && ab.q.active <= 0) clearAbility('q');
      if (wasE && ab.e.active <= 0) clearAbility('e');

      stepWave(dt);
      stepDenizens(dt);
      stepTowers(dt);
      updateProjectiles(dt);
      stepDelayed(dt);

      /* Music intensity from board pressure: how much of the wave is alive and
         how close the leader is to the goal. */
      var pressure = 0;
      for (var i = 0; i < G.denizens.length; i++) {
        var d = G.denizens[i];
        if (!d.alive) continue;
        pressure += 0.035 + (d.dist / G.board.path.length) * 0.05;
        if (d.def.boss) pressure += 0.3;
      }
      AUDIO.setIntensity(U.clamp(pressure, 0, 1));
    } catch (e) {
      recordError('step', e);
    }
  }

  function stepDelayed(dt) {
    for (var i = G.delayed.length - 1; i >= 0; i--) {
      var d = G.delayed[i];
      d.t -= dt;
      if (d.t <= 0) {
        G.delayed.splice(i, 1);
        /* Reported, NOT swallowed. A delayed effect that throws every time it
           fires would otherwise be invisible forever. */
        try { d.fn(); } catch (e) { recordError('delayed:' + (d.tag || '?'), e); }
      }
    }
  }
  function after(seconds, fn, tag) {
    G.delayed.push({ t: seconds, fn: fn, tag: tag });
  }

  function stepWave(dt) {
    if (G.status !== 'play') return;
    if (G.waveActive) {
      G.waveTimer += dt;
      while (G.spawnQueue.length && G.spawnQueue[0].at <= G.waveTimer) {
        var s = G.spawnQueue.shift();
        spawnDenizen(s.of, {});
      }
      if (!G.spawnQueue.length) {
        var anyAlive = false;
        for (var i = 0; i < G.denizens.length; i++) {
          if (G.denizens[i].alive) { anyAlive = true; break; }
        }
        if (!anyAlive) endWave();
      }
    } else {
      G.waveTimer += dt;
      if (G.waveTimer >= G.betweenWaves) startWave();
    }
  }

  function stepDenizens(dt) {
    var w = 0;
    var pathLen = G.board.path.length;
    for (var i = 0; i < G.denizens.length; i++) {
      var d = G.denizens[i];

      if (!d.alive) {
        d.dying -= dt;
        if (d.dying > 0) { G.denizens[w++] = d; }
        continue;
      }

      /* status timers */
      if (d.markT > 0) { d.markT -= dt; if (d.markT <= 0) d.mark = null; }
      if (d.reactCd > 0) d.reactCd -= dt;
      if (d.slowT > 0) { d.slowT -= dt; if (d.slowT <= 0) d.slow = 0; }
      if (d.shredT > 0) { d.shredT -= dt; if (d.shredT <= 0) d.shred = 0; }
      if (d.stun > 0) d.stun -= dt;
      if (d.healRev > 0) d.healRev -= dt;
      if (d.airborne > 0) d.airborne -= dt;
      if (d.flash > 0) d.flash = Math.max(0, d.flash - dt * 4.5);

      /* damage over time */
      if (d.burnT > 0) {
        d.burnT -= dt * (G.commander.id === 'sevra' ? 0.72 : 1);
        damage(d, d.burn * dt, { element: null, source: d.burnSrc });
        if (!d.alive) { G.denizens[w++] = d; continue; }
        if (Math.random() < dt * 8) {
          FX.spawn({
            x: d.pos[0] + (Math.random() - 0.5) * d.scale,
            y: d.pos[1] + Math.random() * 1.4 * d.scale,
            z: d.pos[2] + (Math.random() - 0.5) * d.scale,
            vx: (Math.random() - 0.5) * 1.2, vy: 2.2 + Math.random(), vz: (Math.random() - 0.5) * 1.2,
            r: 1, g: 0.72, b: 0.42, r1: 0.55, g1: 0.12, b1: 0.10,
            life: 0.45 + Math.random() * 0.4, size: 0.22, size1: 0.04,
            rot: 0, rotv: 3, kind: FX.KIND.EMBER, drag: 1.4, grav: 2.6,
            turb: 6.0, alpha: 0.85 });
        }
      }
      if (d.poisonT > 0 && d.poisonStacks > 0) {
        d.poisonT -= dt;
        /* PERCENT-MAX-HP DAMAGE IS RESISTED BY BOSSES.
           Poison is meant to be the answer to something too big to shoot, and
           that is exactly why it needs a ceiling: a percentage of maximum
           health scales linearly with the wave curve, which multiplies health
           by more than 40x by wave twenty. Unbounded, one 145 gold tower
           out-damages the entire rest of the board against the HARBINGER.
           Measured before this: 45x the damage-per-gold of the next tower.
           Bosses take 30%, which keeps TOXIN the right pick against them
           without making it the only pick. */
        var pctMul = d.def.boss ? 0.30 : 1.0;
        damage(d, d.maxHp * d.poison * d.poisonStacks * pctMul * dt,
          { element: null, source: d.poisonSrc });
        if (!d.alive) { G.denizens[w++] = d; continue; }
        if (d.poisonT <= 0) d.poisonStacks = 0;
      }

      /* MENDER: heals nearby wounded, unless BLIGHT has reversed it. */
      if (d.def.trait === 'mender' && d.def.mend) {
        for (var m = 0; m < G.denizens.length; m++) {
          var o = G.denizens[m];
          if (!o.alive || o === d) continue;
          if (V.dist(o.pos, d.pos) > d.def.mend.radius) continue;
          if (o.healRev > 0) { damage(o, d.def.mend.rate * dt * 1.4, {}); }
          else if (o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + d.def.mend.rate * dt);
        }
      }

      /* SUMMON */
      if (d.def.trait === 'summon' && d.def.summon) {
        d.summonT -= dt;
        if (d.summonT <= 0) {
          d.summonT = d.def.summon.every;
          for (var sc = 0; sc < d.def.summon.count; sc++) {
            spawnDenizen(d.def.summon.of, { dist: Math.max(0, d.dist - 1.5 - sc), hpScale: 0.7 });
          }
        }
      }

      /* BOSS PHASES */
      if (d.def.trait === 'boss' && d.def.phases) {
        var frac = d.hp / d.maxHp;
        while (d.phaseIdx < d.def.phases.length && frac <= d.def.phases[d.phaseIdx].at) {
          var ph = d.def.phases[d.phaseIdx];
          d.enrage = ph.enrage || d.enrage;
          if (ph.summon) {
            for (var q = 0; q < 3; q++) spawnDenizen(ph.summon, { dist: Math.max(0, d.dist - 3 - q * 2) });
          }
          FX.hit(1.8, { flash: 0.25, stop: 0.12 });
          AUDIO.play('bossSpawn');
          FX.text([d.pos[0], d.pos[1] + 5, d.pos[2]], 'PHASE ' + (d.phaseIdx + 2),
            { color: '#ff2fd6', life: 1.6, size: 1.6, cls: 'reaction' });
          d.phaseIdx++;
        }
      }

      /* movement */
      var spd = d.speed * d.enrage;
      spd *= (1 - d.slow);
      spd *= (1 - G.globalBuffs.slowAll);
      if (d.stun > 0 || G.globalBuffs.stopAll > 0) spd = 0;
      if (d.airborne > 0) spd *= 0.15;
      d.dist += spd * dt;

      if (d.dist >= pathLen) { leak(d); G.denizens[w++] = d; continue; }

      var sample = G.board.pathAt(d.dist);
      var groundY = G.board.heightAt(sample.pos[0], sample.pos[2]);
      d.pos[0] = sample.pos[0];
      d.pos[2] = sample.pos[2];
      var baseY = d.flying ? groundY + 3.4 : groundY;
      if (d.airborne > 0) baseY += Math.sin(U.sat(d.airborne / 1.4) * Math.PI) * 5.5;
      d.pos[1] = baseY;

      var wantYaw = Math.atan2(sample.dir[0], sample.dir[2]);
      var dy = U.angDiff(d.yaw, wantYaw);
      /* Lean into the turn. Small, but it is most of what makes a walking
         creature look like it has mass rather than like it is on rails. */
      var leanTarget = U.clamp(-dy * 2.4, -0.35, 0.35);
      var lr = RIG.spring(d.lean, d.leanV, leanTarget, 55, dt);
      d.lean = lr[0]; d.leanV = lr[1];
      d.yaw += dy * Math.min(1, dt * 7);

      /* THE GAIT RATE IS DERIVED, NOT TUNED.
         For a planted foot to stay put while the body moves over it:
             stride * scale = speed * duty * cycleTime
         so  phaseRate = speed * duty / (stride * scale)
         The old constants (0.62 and 0.42) were picked by eye: near-right for
         two rigs and wrong for the third, so feet crept along the ground.
         Deriving it makes every rig, scale and speed modifier correct by
         construction, including slows, stuns and the boss enrage. */
      var rigDims = MODELS.RIG_DIMS[d.def.rig];
      if (rigDims) {
        d.animPhase += dt * spd * rigDims.duty / (rigDims.stride * Math.max(0.3, d.scale));
      } else {
        d.animPhase += dt * spd * 0.5 / Math.max(0.3, d.scale);
      }
      G.denizens[w++] = d;
    }
    G.denizens.length = w;
  }

  function stepTowers(dt) {
    for (var i = 0; i < G.towers.length; i++) {
      var t = G.towers[i];
      var def = DATA.TOWERS[t.id];
      var s = stats(t);
      t.buildT = Math.min(1, t.buildT + dt * 1.8);
      t.recoil = Math.max(0, t.recoil - dt * 6.5);
      if (t.disabled > 0) { t.disabled -= dt; continue; }

      /* decay transient visual lists */
      if (t.arcs) {
        for (var a = t.arcs.length - 1; a >= 0; a--) {
          t.arcs[a].life -= dt;
          if (t.arcs[a].life <= 0) t.arcs.splice(a, 1);
        }
      }
      if (t.beams) {
        for (var b = t.beams.length - 1; b >= 0; b--) {
          t.beams[b].life -= dt;
          if (t.beams[b].life <= 0) t.beams.splice(b, 1);
        }
      }

      /* SUPPORT towers never target. */
      if (def.kind === 'support') { t.spin += dt * 0.7; continue; }

      /* FIELD towers apply continuously to everything in range. */
      if (def.kind === 'field') {
        t.spin += dt * 1.6;
        /* The element is applied on a beat, not on every substep. A field that
           marks 120 times a second is indistinguishable from one that marks
           twice a second except in how much noise it makes. */
        t.fieldT = (t.fieldT || 0) - dt;
        var applyEl = t.fieldT <= 0;
        if (applyEl) t.fieldT = 0.5;
        for (var f = 0; f < G.denizens.length; f++) {
          var d = G.denizens[f];
          if (!inRange(t, d, s)) continue;
          damage(d, s.dps * dt, { element: applyEl ? def.element : null, source: t });
          if (d.alive && s.pull > 0 && !d.def.boss) {
            /* Pull along the path rather than in space: moving a unit off its
               lane would desync its position from its progress and let it
               arrive without walking. */
            var toward = t.pos;
            var ahead = G.board.pathAt(Math.min(G.board.path.length, d.dist + 1));
            var closer = V.dist(ahead.pos, toward) < V.dist(d.pos, toward);
            d.dist += (closer ? 1 : -1) * s.pull * dt * 0.5;
            d.dist = Math.max(0, d.dist);
          }
        }
        continue;
      }

      /* SWEEP towers rotate at a fixed rate and damage what they cross. */
      if (def.kind === 'sweep') {
        t.sweepAngle += dt * s.sweepRate;
        t.yaw = t.sweepAngle;
        var fwd = [Math.sin(t.yaw), 0, Math.cos(t.yaw)];
        for (var k = 0; k < G.denizens.length; k++) {
          var e = G.denizens[k];
          if (!inRange(t, e, s)) continue;
          var to = V.norm([e.pos[0] - t.pos[0], 0, e.pos[2] - t.pos[2]]);
          if (V.dot(to, fwd) < 0.985) continue;
          damage(e, s.dps * dt * 3.2, { element: def.element, source: t });
        }
        if (!t.voice && AUDIO.isReady()) t.voice = AUDIO.beamVoice();
        if (t.voice) t.voice.set(0.35, panOf(t.pos), 0.4);
        continue;
      }

      /* Everything else needs a target. */
      var keep = t.target && inRange(t, t.target, s);
      if (!keep) t.target = pickTarget(t, s);
      var target = t.target;

      if (target) {
        var wantYaw = Math.atan2(target.pos[0] - t.pos[0], target.pos[2] - t.pos[2]);
        var dy = U.angDiff(t.yaw, wantYaw);
        /* Spring-damped tracking rather than a snap. A turret that snaps to
           its target reads as a UI element; one that swings and settles reads
           as a machine with mass. */
        var r = RIG.spring(0, t.yawVel, dy, 90, dt);
        t.yawVel = r[1];
        t.yaw += r[0];
      }

      if (def.kind === 'beam') {
        if (target) {
          if (t.lastTarget !== target) { t.beamRamp = 0; t.lastTarget = target; }
          t.beamRamp = Math.min(s.rampMax, t.beamRamp + dt * s.rampRate);
          t.beamOn = Math.min(1, t.beamOn + dt * 6);
          damage(target, s.dps * (1 + t.beamRamp) * dt, { element: def.element, source: t });
          if (!t.voice && AUDIO.isReady()) t.voice = AUDIO.beamVoice();
          if (t.voice) t.voice.set(t.beamOn, panOf(t.pos), t.beamRamp / Math.max(0.01, s.rampMax));
          if (Math.random() < dt * 22) {
            var bp = [target.pos[0], target.pos[1] + 0.9 * target.scale, target.pos[2]];
            FX.impact(bp, V.norm(V.sub(bp, t.pos)), MODELS.tower(t.id, t.tier).accent, 0.28);
          }
        } else {
          t.beamOn = Math.max(0, t.beamOn - dt * 5);
          t.beamRamp = Math.max(0, t.beamRamp - dt * 1.4);
          if (t.voice) t.voice.set(0, panOf(t.pos), 0);
        }
        continue;
      }

      t.cooldown -= dt * s.fireRate * (def.kind === 'bullet' ? 1 : 1);
      if (target && t.cooldown <= 0) {
        t.cooldown += 1;
        fireTower(t, s, def, dt);
      }
      if (t.cooldown < -2) t.cooldown = 0;
    }
  }

  /* ---------- abilities ---------- */

  function clearAbility(slot) {
    var c = G.commander;
    var a = slot === 'q' ? c.q : c.e;
    if (!a) return;
    if (a.id === 'overclock') G.globalBuffs.fireRate = 1;
    if (a.id === 'dampen') G.globalBuffs.slowAll = 0;
    if (a.id === 'smokescreen') G.globalBuffs.stopAll = 0;
    if (a.id === 'lattice') G.globalBuffs.range = 1;
  }

  function useAbility(slot) {
    /* An unknown slot used to fall through to the E ability and then read
       G.abilities[slot], which is undefined for anything but q and e, and threw
       on .cd. Validating the slot first is one line and turns a crash into a
       refusal. */
    if (slot !== 'q' && slot !== 'e') return false;
    var c = G.commander;
    var a = slot === 'q' ? c.q : c.e;
    var st = G.abilities[slot];
    if (!a || !st || st.cd > 0 || G.status !== 'play') { AUDIO.play('denied'); return false; }
    st.cd = a.cd;
    st.active = a.dur || 0;
    AUDIO.play('ability');
    FX.hit(0.6, { flash: 0.10 });

    switch (a.id) {
      case 'overclock': G.globalBuffs.fireRate = 1.7; break;
      case 'dampen': G.globalBuffs.slowAll = 0.5; break;
      case 'smokescreen': G.globalBuffs.stopAll = 1; break;
      case 'lattice':
        G.globalBuffs.range = 1.3;
        for (var i = 0; i < G.towers.length; i++) G.towers[i].disabled = 0;
        break;
      case 'sanctify':
        G.lives = Math.min(G.maxLives, G.lives + 3);
        for (var j = 0; j < G.towers.length; j++) G.towers[j].disabled = 0;
        break;
      case 'zealotry': break; /* handled in stats() while active */
      case 'ravenous':
        for (var k = 0; k < G.denizens.length; k++) {
          var d = G.denizens[k];
          if (!d.alive) continue;
          d.poisonStacks = Math.min(6, d.poisonStacks + 3);
          d.poison = 0.012;
          d.poisonT = a.dur;
        }
        break;
      case 'consume': {
        var alive = G.denizens.filter(function (x) { return x.alive && !x.def.boss; });
        alive.sort(function (x, y) { return x.hp - y.hp; });
        var n = Math.ceil(alive.length / 3);
        for (var m = 0; m < n; m++) kill(alive[m], {});
        break;
      }
      case 'broadside': {
        var lead = null, best = -1;
        for (var p = 0; p < G.denizens.length; p++) {
          if (G.denizens[p].alive && G.denizens[p].dist > best) { best = G.denizens[p].dist; lead = G.denizens[p]; }
        }
        if (lead) {
          for (var s2 = 0; s2 < 7; s2++) {
            (function (idx) {
              after(idx * 0.11, function () {
                var at = G.board.pathAt(Math.max(0, best - 6 + idx * 3.2));
                var pos = [at.pos[0], G.board.heightAt(at.pos[0], at.pos[2]), at.pos[2]];
                for (var z = 0; z < G.denizens.length; z++) {
                  var dz = G.denizens[z];
                  if (!dz.alive) continue;
                  if (V.dist(dz.pos, pos) < 5.0) damage(dz, 190, { element: 'fire' });
                }
                FX.burst(pos, [1, 0.5, 0.25], { count: 22, speed: 14, life: 0.6, size: 0.5 });
                FX.shockRing(pos, [1, 0.5, 0.25], 7, 0.4);
                FX.smoke(pos, [0.4, 0.3, 0.35], 5, 1.4);
                AUDIO.play('impact_splash', { pan: panOf(pos) });
                FX.hit(0.7);
              }, 'broadside');
            })(s2);
          }
        }
        break;
      }
      case 'quake': {
        for (var qi = 0; qi < G.denizens.length; qi++) {
          var qd = G.denizens[qi];
          if (!qd.alive || qd.flying) continue;
          damage(qd, 160, { element: 'kinetic' });
          if (qd.alive) qd.stun = Math.max(qd.stun, 0.9);
        }
        FX.hit(2.0, { stop: 0.1, flash: 0.18 });
        var gp = G.board.pathAt(G.board.path.length * 0.5).pos;
        FX.shockRing([gp[0], 0.4, gp[2]], [0.7, 0.8, 1], 40, 0.7);
        break;
      }
    }
    return true;
  }

  function clear() {
    if (G) {
      for (var i = 0; i < G.towers.length; i++) {
        if (G.towers[i].voice) G.towers[i].voice.stop();
      }
    }
    errors.length = 0;
  }

  return {
    create: create, state: state, step: step,
    place: place, upgrade: upgrade, sell: sell, canPlace: canPlace, findPlot: findPlot,
    stats: stats, upgradeCost: upgradeCost, sellValue: sellValue, costOf: costOf,
    startWave: startWave, useAbility: useAbility,
    spawnDenizen: spawnDenizen, damage: damage, kill: kill,
    armorOf: armorOf, panOf: panOf, after: after,
    endGame: endGame, clear: clear,
    errors: function () { return errors.slice(); }
  };
})();
