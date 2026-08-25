/* ==========================================================================
   COMMANDER ABILITIES

   Every commander fields two: one OFFENSIVE (it makes your board hit harder)
   and one DEFENSIVE (it blunts what is walking at you, above all the reanimated
   dead your rival keeps sending). The second is locked until the commander's
   technology chart is fully allocated, or bought outright with souls.

   This is the verb the game was missing. Before it, everything a player did
   happened BETWEEN waves; nothing was available during one.
   ========================================================================== */

/** Applied to a side for `dur` seconds; read live by the tower stat getters. */
function freshPulse() { return { damage: 1, rate: 1, range: 1 }; }

const ABILITIES = {

  /* ---------------------------------------------------------- OFFENSIVE */

  overclock: {
    id: 'overclock', name: 'OVERCLOCK', icon: '⚡', kind: 'offense', cd: 34, dur: 7,
    desc: 'Every tower you own fires 60% faster and hits 25% harder for 7s.',
    start: (S) => { S.pulse.rate = 1.60; S.pulse.damage = 1.25; },
    end:   (S) => { S.pulse.rate = 1; S.pulse.damage = 1; }
  },
  focusfire: {
    id: 'focusfire', name: 'FOCUS FIRE', icon: '⌖', kind: 'offense', cd: 40, dur: 6,
    desc: 'Towers gain 45% damage and 30% range for 6s.',
    start: (S) => { S.pulse.damage = 1.45; S.pulse.range = 1.30; },
    end:   (S) => { S.pulse.damage = 1; S.pulse.range = 1; }
  },
  zealotry: {
    id: 'zealotry', name: 'ZEALOTRY', icon: '☀', kind: 'offense', cd: 38, dur: 8,
    desc: 'The whole line burns brighter: +35% damage, +35% rate for 8s.',
    start: (S) => { S.pulse.damage = 1.35; S.pulse.rate = 1.35; },
    end:   (S) => { S.pulse.damage = 1; S.pulse.rate = 1; }
  },
  ravenous: {
    id: 'ravenous', name: 'RAVENOUS', icon: '⬢', kind: 'offense', cd: 38, dur: 9,
    aim: 'point', construct: 'maw',
    desc: `AIMED. Buries a maw for {s} that eats whatever walks into reach and pays ${AIM_MAW_FEED} gold for every body it finishes.`,
    start: (S, g, at) => { g.deployConstruct(S, ABILITIES.ravenous, at); },
    end:   (S, g) => { g.clearConstructs(S.index, 'ravenous'); }
  },
  broadside: {
    id: 'broadside', name: 'BROADSIDE', icon: '☠', kind: 'offense', cd: 34, dur: 9,
    aim: 'point', construct: 'battery',
    desc: 'AIMED. Drops a gun emplacement for {s}. It shells everything in reach and splashes: and ground attackers chew it down.',
    start: (S, g, at) => { g.deployConstruct(S, ABILITIES.broadside, at); },
    end:   (S, g) => { g.clearConstructs(S.index, 'broadside'); }
  },

  steadyaim: {
    id: 'steadyaim', name: 'STEADY AIM', icon: '⌂', kind: 'offense', cd: 32, dur: 8,
    desc: 'An even lift across the whole board: +30% damage, +30% rate, +15% range for 8s.',
    start: (S) => { S.pulse.damage = 1.30; S.pulse.rate = 1.30; S.pulse.range = 1.15; },
    end:   (S) => { S.pulse.damage = 1; S.pulse.rate = 1; S.pulse.range = 1; }
  },

  /* ---------------------------------------------------------- DEFENSIVE */

  attrite: {
    id: 'attrite', name: 'ATTRITION FIELD', icon: '⧗', kind: 'defense', cd: 38, dur: 9,
    desc: 'Reanimated attackers specifically are gutted: 45% weaker and 30% slower for 9s.',
    start: (S, g) => {
      g.enemyDamp[S.index] = { speed: 0.70, power: 0.55, reanimOnly: true };
      /* Bite immediately as well, so the button has a visible moment. */
      for (const e of g.enemies)
        if (e.hostileTo === S.index && e.reanimated && !e.boss && !e.miniboss)
          e.takeDamage(e.maxHp * 0.12, 'pure', {});
    },
    end:   (S, g) => { g.enemyDamp[S.index] = null; }
  },

  dampen: {
    id: 'dampen', name: 'DAMPENING FIELD', icon: '◎', kind: 'defense', cd: 40, dur: 8,
    desc: 'Everything walking at you is slowed 35% and loses 25% of its damage for 8s.',
    start: (S, g) => { g.enemyDamp[S.index] = { speed: 0.65, power: 0.75 }; },
    end:   (S, g) => { g.enemyDamp[S.index] = null; }
  },
  bulwark: {
    id: 'bulwark', name: 'BULWARK', icon: '⛨', kind: 'defense', cd: 40, dur: 11,
    aim: 'point', lane: true, construct: 'blocker',
    desc: `AIMED at a lane. Throws up a wall that holds ${AIM_BLOCKER_BLOCKS} attackers for {s} and grinds what it holds. It no longer returns lives: a wall buys time, it does not undo a leak.`,
    start: (S, g, at) => { g.deployConstruct(S, ABILITIES.bulwark, at); },
    end:   (S, g) => { g.clearConstructs(S.index, 'bulwark'); }
  },
  sanctify: {
    id: 'sanctify', name: 'SANCTIFY', icon: '✧', kind: 'defense', cd: 44, dur: 7,
    desc: 'A halo over the lane: attackers slowed 45%, and armour stripped by 10.',
    start: (S, g) => {
      g.enemyDamp[S.index] = { speed: 0.55, power: 1 };
      for (const e of g.enemies) if (e.hostileTo === S.index) e.applyShred(10, 7);
    },
    end:   (S, g) => { g.enemyDamp[S.index] = null; }
  },
  consume: {
    id: 'consume', name: 'CONSUME', icon: '◐', kind: 'defense', cd: 42, dur: 6,
    desc: 'Devours the weakest third of what is attacking you and pays their bounty.',
    start: (S, g) => {
      const mine = g.enemies.filter(e => e.hostileTo === S.index && !e.dead && !e.boss && !e.miniboss);
      mine.sort((a, b) => a.hp - b.hp);
      for (const e of mine.slice(0, Math.ceil(mine.length / 3))) {
        g.awardGold(S.index, Math.round(e.bounty * 0.5));
        e.hp = 0; e.dead = true; e.consumed = true;
      }
      g.enemyDamp[S.index] = { speed: 0.9, power: 0.9 };
    },
    end:   (S, g) => { g.enemyDamp[S.index] = null; }
  },
  smokescreen: {
    id: 'smokescreen', name: 'SMOKESCREEN', icon: '☁', kind: 'defense', cd: 36, dur: 10,
    aim: 'point', lane: true, construct: 'minefield',
    desc: `AIMED at a lane. Blinds everything at the point, then seeds ${AIM_MINE_COUNT} mines across it for {s}.`,
    start: (S, g, at) => {
      const c = g.deployConstruct(S, ABILITIES.smokescreen, at);
      /* The blind is all that survives of the board-wide version, and it is
         local now, so the ability still reads as smoke rather than as a
         minefield with a name that no longer fits. */
      if (c) {
        const r2 = (AIM_MINE_SPREAD * TILE * 2) * (AIM_MINE_SPREAD * TILE * 2);
        for (const e of g.enemies)
          if (e.hostileTo === S.index && !e.boss && !e.miniboss &&
              dist2(c.x, c.y, e.x, e.y) <= r2) e.applyFreeze(AIM_SMOKE_FREEZE);
      }
    },
    end:   (S, g) => { g.clearConstructs(S.index, 'smokescreen'); }
  }
};

/* Aimed descriptions quote the constants they are built from, and `{s}` is
   filled from the ability's own `dur`. A button that promises a number the
   construct does not deliver is the same class of bug as a wave preview that
   lies, and it is fixed the same way: never write the number twice. */
for (const a of Object.values(ABILITIES))
  if (a.aim) a.desc = a.desc.replace('{s}', a.dur + 's');

const ABILITY_UNLOCK_COST = 8;

/* --------------------------------------------------------------------------
   RUNTIME
-------------------------------------------------------------------------- */

/** Build the per-side ability state at match start. */
function initAbilities(side, commander, secondUnlocked) {
  side.pulse = freshPulse();
  side.abil = [];
  const list = commander.abilities || [];
  for (let i = 0; i < list.length; i++) {
    if (i === 1 && !secondUnlocked) continue;
    const def = ABILITIES[list[i]];
    if (!def) continue;
    side.abil.push({ def, cd: 0, active: 0, slot: side.abil.length });
  }
}

/** Advance cooldowns and expire active effects. Called once per sim step. */
function tickAbilities(side, game, dt) {
  if (!side.abil) return;
  for (const a of side.abil) {
    if (a.active > 0) {
      a.active -= dt;
      if (a.active <= 0) { a.active = 0; if (a.def.end) a.def.end(side, game); }
    } else if (a.cd > 0) {
      a.cd -= dt;
      if (a.cd < 0) a.cd = 0;
    }
  }
}

/**
 * Fire ability `i`. `at` is the aimed tile — `{gx, gy}` — and is required by
 * anything carrying an `aim` flag. Returns true if it actually went off.
 */
function useAbility(side, game, i, at) {
  const a = side.abil && side.abil[i];
  if (!a || a.cd > 0 || a.active > 0 || game.state !== 'playing') return false;
  /* An aimed ability with no legal tile must not burn its cooldown: the
     placement is half the price, so a miss has to be a no-op, not a spend. */
  if (a.def.aim && !(at && game.canAim(side.index, at.gx, at.gy, a.def))) return false;
  a.active = a.def.dur;
  a.cd = a.def.cd + a.def.dur;
  if (a.def.start) a.def.start(side, game, at);
  if (side.index === game.viewSide) {
    const fx = abilityFxFor(side, a.def);
    Sound.play(a.def.kind === 'offense' ? 'ability_off' : 'ability_def', fx.pitch);
    game.fxRing = { t: 0, dur: 0.85, color: fx.color, kind: a.def.kind };
    /* An aimed ability radiates from where it landed, not from the base. */
    if (at) { game.fxRing.x = (at.gx + 0.5) * TILE; game.fxRing.y = (at.gy + 0.5) * TILE; }
    if (typeof UI !== 'undefined' && UI.abilityFlash) UI.abilityFlash(side, a.def);
  }
  return true;
}
