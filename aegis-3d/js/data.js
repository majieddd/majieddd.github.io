/* lowpoly/js/data.js — every tunable and piece of content. Named constants,
   same convention as the 2D game's config.js: each magic number is named and
   commented with what it guards against. Roster names/elements are the 2D
   game's, so the variant stays mechanically recognisable as Cosmic Conquest. */
(function () {
  'use strict';

  const D = {};

  /* ------------------------------------------------------------------ */
  /* World & match constants. */
  D.WORLD = {
    w: 90, h: 54,                       // playfield metres
    pathHalfWidth: 2.6,                 // width of the lane enemies walk
    startGold: 320,                     // enough for bolt + one more tower
    lives: 20,
    buildWindow: 18,                    // seconds of build time before wave 1
    waveGap: 8,                         // breather between waves
    sellRatio: 0.7,
    upgradeCount: 2                      // tiers 1, 2, 3
  };

  /* The 2D game's own curve shape, re-used for the wall it creates (a novice
     dies at wave ~10). Beyond wave 14 the 2D curve expects full meta
     progression this variant does not have, so growth softens: 1.26 to 10,
     1.22 to 14, then 1.12 — late waves grind less, but never plateau. */
  const _hpCache = [1, 1];
  function waveHpMultiplier(w) {
    if (w < 1) return 1;
    for (let i = _hpCache.length; i <= w; i++) {
      const growth = i <= 10 ? 1.26 : i <= 14 ? 1.22 : 1.12;
      _hpCache[i] = _hpCache[i - 1] * growth;
    }
    return _hpCache[w];
  }
  D.waveHpMultiplier = waveHpMultiplier;

  D.DIFFICULTIES = [
    { id: 'skirmish', name: 'SKIRMISH', hp: 0.80, gold: 1.18 },
    { id: 'contested', name: 'CONTESTED', hp: 1.00, gold: 1.00 },
    { id: 'overrun', name: 'OVERRUN', hp: 1.22, gold: 0.84 }
  ];

  /* ------------------------------------------------------------------ */
  /* Elements and the reaction table. Kinetic and radiant deliberately do not
     mark. A marking hit places {element}; a hit from a DIFFERENT marking
     element consumes the mark and reacts. */
  D.ELEMENTS = ['kinetic', 'radiant', 'storm', 'void', 'fire', 'venom', 'frost'];
  D.MARKING = ['storm', 'void', 'fire', 'venom', 'frost'];

  D.ELEMENT_META = {
    kinetic: { name: 'KINETIC', color: '#e2e8f0' },
    radiant: { name: 'RADIANT', color: '#fbbf24' },
    storm:   { name: 'STORM',   color: '#a5b4fc' },
    void:    { name: 'VOID',    color: '#c084fc' },
    fire:    { name: 'FIRE',    color: '#fb923c' },
    venom:   { name: 'VENOM',   color: '#a3e635' },
    frost:   { name: 'FROST',   color: '#7dd3fc' }
  };

  /* effects: burst (aoe), burn (dot), freeze, slow, poison, pull (toward the
     reacting tower), push (back along path), spread (poison to neighbours). */
  D.REACTIONS = {
    'storm+fire':   { name: 'PLASMA',        mul: 1.6, effect: 'burst',  radius: 4.0 },
    'storm+frost':  { name: 'SUPERCONDUCT',  mul: 1.5, effect: 'slow',   slow: 0.55, dur: 2.6 },
    'storm+venom':  { name: 'CATALYSE',      mul: 1.5, effect: 'poison', dps: 0, dur: 3.5, boost: 1.6 },
    'void+fire':    { name: 'COLLAPSE',      mul: 2.0, effect: 'pull',   radius: 4.5 },
    'void+frost':   { name: 'ENTROPY',       mul: 1.5, effect: 'slow',   slow: 0.4, dur: 3.0, dot: 0.5 },
    'void+storm':   { name: 'RUPTURE',       mul: 1.7, effect: 'push',   push: 2.6 },
    'void+venom':   { name: 'BLIGHT',        mul: 1.4, effect: 'spread', radius: 4.0 },
    'fire+frost':   { name: 'THERMAL SHOCK', mul: 2.2, effect: 'burst',  radius: 3.6 },
    'fire+venom':   { name: 'IMMOLATE',      mul: 1.4, effect: 'burn',   dps: 1.6, dur: 3.0 },
    'frost+venom':  { name: 'PARALYSIS',     mul: 1.4, effect: 'freeze', dur: 1.5 }
  };
  D.reactionOf = (a, b) => D.REACTIONS[a + '+' + b] || D.REACTIONS[b + '+' + a];

  /* ------------------------------------------------------------------ */
  /* Towers. damage/rate/range are tier-1 values; upgrades fold mods in.
     `targets`: 'all' | 'ground'. Physical (kinetic) damage is reduced by
     armour; every other element bypasses it. */
  D.TOWERS = [
    {
      id: 'bolt', name: 'BOLT', element: 'kinetic', origin: 'human',
      role: 'Rapid single-target', desc: 'Kinetic slug thrower. Reliable damage, no reactions.',
      cost: 115, range: 14, damage: 10, rate: 3.2, projSpeed: 46, targets: 'all',
      upgrades: [
        { name: 'MK II', cost: 90, desc: '+damage, +fire rate', damage: 15, rate: 3.8 },
        { name: 'MK III', cost: 160, desc: 'Twin barrels, +range', damage: 19, rate: 4.4, range: 16 }
      ]
    },
    {
      id: 'cryo', name: 'CRYO', element: 'frost', origin: 'human',
      role: 'Area slow / control', desc: 'Frost bursts. Marks with FROST and slows the pack.',
      cost: 155, range: 13, damage: 8, rate: 1.1, projSpeed: 26, targets: 'all',
      splash: 3.4, slow: 0.45, slowDur: 1.8,
      upgrades: [
        { name: 'DEEP CHILL', cost: 100, desc: '+splash, +slow', splash: 4.2, slow: 0.55 },
        { name: 'PERMAFROST', cost: 185, desc: '15% chance to freeze solid', splash: 5.0, freeze: 0.15, freezeDur: 1.1 }
      ]
    },
    {
      id: 'mortar', name: 'MORTAR', element: 'fire', origin: 'human',
      role: 'Ground splash artillery', desc: 'Arcing shells. Marks with FIRE and blasts the ground.',
      cost: 223, range: 18, damage: 26, rate: 0.55, projSpeed: 16, targets: 'ground',
      splash: 4.5, arc: true,
      upgrades: [
        { name: 'HEAVY', cost: 135, desc: '+damage, +splash', damage: 40, splash: 5.4 },
        { name: 'SIEGE', cost: 240, desc: 'Stun on impact', damage: 58, splash: 6.2, stun: 0.4 }
      ]
    },
    {
      id: 'arc', name: 'ARC', element: 'storm', origin: 'human',
      role: 'Current that runs the lane', desc: 'Chain lightning. Marks with STORM and jumps targets.',
      cost: 256, range: 15, damage: 13, rate: 1.2, projSpeed: 60, targets: 'all',
      chain: 3, chainFalloff: 0.8,
      upgrades: [
        { name: 'STORM', cost: 165, desc: '+chain length, +damage', chain: 4, damage: 17 },
        { name: 'OVERLOAD', cost: 285, desc: 'Long reach, harder jumps', chain: 5, range: 17, damage: 21 }
      ]
    },
    {
      id: 'flak', name: 'FLAK', element: 'kinetic', origin: 'human',
      role: 'Anti-air burst', desc: 'Flak bursts. Bonus against flyers and clips their wings.',
      cost: 216, range: 17, damage: 12, rate: 1.5, projSpeed: 30, targets: 'all',
      splash: 3.0, airBonus: 2.4, airSlow: 0.35, airSlowDur: 1.4,
      upgrades: [
        { name: 'SKYSHRED', cost: 140, desc: '+splash, +damage', damage: 18, splash: 4.0 },
        { name: 'SEEKER', cost: 250, desc: 'Homing swarm', damage: 22, rate: 2.2, homing: true }
      ]
    },
    {
      id: 'railgun', name: 'RAILGUN', element: 'kinetic', origin: 'robotic',
      role: 'Long-range pierce', desc: 'Hitscan slug through the whole lane. Slow to charge.',
      cost: 317, range: 26, damage: 120, rate: 0.34, projSpeed: 0, targets: 'all', pierce: 99,
      upgrades: [
        { name: 'MARKSMAN', cost: 200, desc: '+damage, +rate', damage: 165, rate: 0.4 },
        { name: 'ANNIHILATOR', cost: 400, desc: 'Obliteration round', damage: 260, rate: 0.44, range: 28 }
      ]
    },
    {
      id: 'prism', name: 'PRISM', element: 'radiant', origin: 'light',
      role: 'Ramping focused beam', desc: 'Concentrated light that doubles down on one target.',
      cost: 277, range: 16, damage: 4.5, rate: 5, projSpeed: 0, targets: 'all',
      ramp: 1.0, rampMax: 8.0, beam: true,
      upgrades: [
        { name: 'SOLAR LANCE', cost: 180, desc: 'Longer ramp, +range', rampMax: 10, range: 17.5 },
        { name: 'REFRACTOR', cost: 320, desc: 'Splits into three beams', split: 3, splitFalloff: 0.6 }
      ]
    },
    {
      id: 'tether', name: 'TETHER', element: 'frost', origin: 'pirate',
      role: 'Drags enemies back', desc: 'Harpoon that marks FROST and hauls its target back up the lane.',
      cost: 202, range: 13, damage: 10, rate: 0.5, projSpeed: 40, targets: 'all',
      pull: 3.4, slow: 0.2, slowDur: 1.0,
      upgrades: [
        { name: 'WINDLASS', cost: 130, desc: '+pull, +range', pull: 5.0, range: 15 },
        { name: 'BARBS', cost: 240, desc: 'Bleeding barbs', damage: 22, pull: 5.4, dot: 0.9, dotDur: 3.0 }
      ]
    },
    {
      id: 'pyre', name: 'PYRE', element: 'fire', origin: 'pirate',
      role: 'Cone burn', desc: 'Short range flamethrower. Marks FIRE and lights the lane.',
      cost: 189, range: 8.5, damage: 20, rate: 1.0, projSpeed: 0, targets: 'ground',
      cone: 0.55, burnDps: 1.1, burnDur: 2.0,
      upgrades: [
        { name: 'INFERNO', cost: 120, desc: '+cone, +burn', cone: 0.75, burnDps: 1.6 },
        { name: 'NAPALM', cost: 230, desc: 'Leaves burning ground', burnDps: 2.2, puddle: true, puddleDps: 1.0, puddleDur: 4.0, puddleRadius: 2.6 }
      ]
    },
    {
      id: 'toxin', name: 'TOXIN', element: 'venom', origin: 'xeno',
      role: 'Stacking poison', desc: 'Spore shots that mark VENOM and stack a rotting toxin.',
      cost: 209, range: 13, damage: 6, rate: 1.0, projSpeed: 34, targets: 'all',
      poisonDps: 1.6, poisonDur: 3.0, maxStacks: 5,
      upgrades: [
        { name: 'PLAGUE', cost: 140, desc: '+stacks, +poison', maxStacks: 7, poisonDps: 2.0 },
        { name: 'CORROSION', cost: 250, desc: 'Poison shreds armour', poisonDps: 2.4, shredPerStack: 1.5 }
      ]
    },
    {
      id: 'singularity', name: 'SINGULARITY', element: 'void', origin: 'robotic',
      role: 'Gravity anchor', desc: 'Pulses that mark VOID and drag the lane toward it.',
      cost: 297, range: 12, damage: 12, rate: 0.9, projSpeed: 0, targets: 'all',
      pulse: true, pulseRadius: 7.0, drag: 1.0, slow: 0.3, slowDur: 1.2,
      upgrades: [
        { name: 'EVENT HORIZON', cost: 190, desc: '+radius, harder drag', pulseRadius: 8.6, drag: 1.5 },
        { name: 'IMPLOSION', cost: 340, desc: 'Damage spike on the pulse', damage: 26, pulseRadius: 9.4 }
      ]
    },
    {
      id: 'canister', name: 'CANISTER', element: 'venom', origin: 'human',
      role: 'Armour-stripping gas', desc: 'Gas lobs that mark VENOM and linger as a corrosive cloud.',
      cost: 214, range: 14, damage: 14, rate: 0.7, projSpeed: 22, targets: 'all',
      splash: 3.6, poisonDps: 1.5, poisonDur: 3.0, cloud: true, cloudDur: 3.0, shred: 4,
      upgrades: [
        { name: 'SATURATION', cost: 135, desc: '+cloud, +splash', splash: 4.6, cloudDur: 4.0, poisonDps: 2.0 },
        { name: 'CONCENTRATE', cost: 250, desc: '+armour shred, +poison', shred: 8, poisonDps: 2.6 }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Enemies. hp is per-wave-scaled by waveHpMultiplier. lives = lives lost
     on leak. `flying` follows the lane at altitude; `armor` reduces kinetic
     damage only. */
  D.ENEMIES = {
    crawler:    { id: 'crawler', name: 'PICKET',            hp: 31,  speed: 3.7, armor: 0, bounty: 4,  lives: 1, scale: 0.9,
                  palette: 'chrome', desc: 'The standing guard of the Vigil, issued by the thousand.' },
    sprinter:   { id: 'sprinter', name: 'OUTRUNNER',         hp: 22,  speed: 7.2, armor: 0, bounty: 5,  lives: 1, scale: 0.8,
                  palette: 'stone', desc: 'A scout frame stripped of everything but legs.' },
    shardling:  { id: 'shardling', name: 'SHARD SENTRY',      hp: 105, speed: 3.3, armor: 2, bounty: 13, lives: 1, scale: 1.0,
                  palette: 'chrome', splashResist: 0.65, weak: { storm: 0.35 }, desc: 'Faceted plating scatters blast waves.' },
    wisp:       { id: 'wisp', name: 'LANTERN',           hp: 44,  speed: 5.0, armor: 0, bounty: 7,  lives: 1, scale: 0.75,
                  palette: 'storm', flying: true, weak: { storm: 0.4 }, desc: 'A watch-light flying the old patrol arc.' },
    aegis:      { id: 'aegis', name: 'AEGIS SENTINEL',    hp: 82,  speed: 3.2, armor: 1, bounty: 12, lives: 1, scale: 1.0,
                  palette: 'storm', shield: 70, shieldRegen: 17, shieldDelay: 2.8, desc: 'A self-repairing barrier.' },
    mender:     { id: 'mender', name: 'RESTORER',          hp: 72,  speed: 3.0, armor: 1, bounty: 14, lives: 1, scale: 0.9,
                  palette: 'moss', healRate: 11, healRadius: 7, weak: { venom: 0.4 }, desc: 'Repairs the nearest machine. Kill it first.' },
    cluster:    { id: 'cluster', name: 'DIVIDER',           hp: 77,  speed: 3.4, armor: 0, bounty: 9,  lives: 1, scale: 1.05,
                  palette: 'xeno', splitInto: 'spawnling', splitCount: 3, weak: { fire: 0.35 }, desc: 'Fails safe into three Fragments.' },
    spawnling:  { id: 'spawnling', name: 'FRAGMENT',          hp: 23,  speed: 4.8, armor: 0, bounty: 2,  lives: 1, scale: 0.6,
                  palette: 'xeno', desc: 'Still marching, still certain it is helping.' },
    warden:     { id: 'warden', name: 'WARDEN',            hp: 210, speed: 2.8, armor: 5, bounty: 23, lives: 1, scale: 1.15,
                  palette: 'ember', slowImmune: true, pullImmune: true, desc: 'Holds the line. Cannot be slowed or displaced.' },
    juggernaut: { id: 'juggernaut', name: 'IRONMARCH',         hp: 490, speed: 1.8, armor: 8, bounty: 37, lives: 2, scale: 1.5,
                  palette: 'stone', slowResist: 0.45, weak: { frost: 0.3 }, desc: 'A mobile fortification that never meant to leave its wall.' },
    carrier:    { id: 'carrier', name: 'FOUNDRY CARRIER',   hp: 260, speed: 2.1, armor: 4, bounty: 29, lives: 2, scale: 1.35,
                  palette: 'ember', summon: { type: 'mite', count: 1, interval: 4.2, max: 8 }, desc: 'Prints Motes the whole way down the lane.' },
    mite:       { id: 'mite', name: 'MOTE',              hp: 12,  speed: 5.3, armor: 0, bounty: 1,  lives: 1, scale: 0.4,
                  palette: 'chrome', desc: 'A fingernail of chassis with one instruction left.' },
    mb_colossus:{ id: 'mb_colossus', name: 'COLOSSUS',          hp: 410, speed: 1.6, armor: 5, bounty: 87, lives: 3, scale: 1.9,
                  palette: 'stone', miniboss: true, slowResist: 0.6, desc: 'A siege frame under centuries of accreted plate.' },
    harbinger:  { id: 'harbinger', name: 'HARBINGER',         hp: 4600, speed: 1.55, armor: 12, bounty: 260, lives: 7, scale: 2.4,
                  palette: 'pirate', boss: true, slowResist: 0.6, slowCap: 0.4,
                  summon: { type: 'spawnling', count: 1, interval: 6.0, max: 6 },
                  phases: [
                    { at: 0.66, armorDelta: -6, speedMul: 1.18, msg: 'THE HARBINGER SHEDS ITS PLATING' },
                    { at: 0.33, armorDelta: -6, speedMul: 1.35, msg: 'THE HARBINGER ENRAGES' }
                  ],
                  desc: 'What the Vigil sends when it cannot classify a threat.' }
  };

  /* ------------------------------------------------------------------ */
  /* Wave composition. Spawn entries are authored per wave band; the engine
     scales hp by waveHpMultiplier. The mix is deterministic per seed. */
  D.waveComposition = function (wave, rng) {
    const mix = [];
    const add = (id, n, gap) => { for (let i = 0; i < n; i++) mix.push({ id, gap: (gap || 0.55) + rng() * 0.5 }); };
    if (wave === 20) {
      add('harbinger', 1, 2.0);
      add('crawler', 8, 1.2);
      add('shardling', 4, 2.2);
      return mix;
    }
    if (wave === 15) { add('mb_colossus', 1, 1.5); add('juggernaut', 2, 3.0); add('shardling', 5, 1.6); return mix; }
    const t = Math.min(wave, 19);
    if (t <= 3) { add('crawler', 6 + t * 2, 0.7); add('sprinter', t, 0.9); }
    else if (t <= 6) { add('crawler', 8, 0.6); add('sprinter', 3, 0.8); add('wisp', 2 + (t - 3), 1.1); add('shardling', t - 3, 1.5); }
    else if (t <= 9) { add('crawler', 10, 0.5); add('sprinter', 4, 0.7); add('wisp', 3, 0.9); add('shardling', 4, 1.2); add('aegis', 2, 1.8); add('mender', 1, 2.4); add('cluster', t - 6, 2.0); }
    else if (t <= 12) { add('crawler', 12, 0.45); add('sprinter', 5, 0.6); add('wisp', 4, 0.8); add('shardling', 5, 1.0); add('aegis', 3, 1.5); add('mender', 2, 2.0); add('cluster', 3, 1.8); add('warden', t - 9, 2.6); }
    else if (t <= 14) { add('crawler', 12, 0.4); add('sprinter', 6, 0.55); add('wisp', 5, 0.75); add('shardling', 6, 0.9); add('aegis', 3, 1.4); add('mender', 2, 1.8); add('cluster', 3, 1.6); add('warden', 3, 2.2); add('juggernaut', t - 11, 3.4); }
    else if (t <= 17) { add('crawler', 14, 0.35); add('sprinter', 7, 0.5); add('wisp', 6, 0.7); add('shardling', 7, 0.85); add('aegis', 4, 1.3); add('mender', 3, 1.6); add('cluster', 4, 1.5); add('warden', 4, 2.0); add('juggernaut', 3, 3.0); add('carrier', t - 14, 4.5); }
    else { add('crawler', 15, 0.32); add('sprinter', 8, 0.45); add('wisp', 7, 0.65); add('shardling', 8, 0.8); add('aegis', 5, 1.2); add('mender', 3, 1.5); add('cluster', 5, 1.4); add('warden', 5, 1.8); add('juggernaut', 4, 2.6); add('carrier', 3, 4.0); add('mite', 10, 0.3); }
    return mix;
  };

  D.waveReward = function (wave) { return Math.round(82 + wave * 11); };
  D.rushBonus = function (wave) { return Math.round(wave * 6); };

  /* ------------------------------------------------------------------ */
  /* Commanders: the four faction starters, with their 2D ability pairs. */
  D.COMMANDERS = [
    {
      id: 'vanta', name: 'VANTA', title: 'THE ARCHIVIST', faction: 'human',
      line: 'I have read every battle you have ever fought. This one ends the same way.',
      passive: { name: 'OPEN INDEX', desc: '+10% to every tower statistic' },
      Q: { name: 'OVERCLOCK', desc: 'All towers fire 55% faster for 7s', cd: 34, dur: 7, kind: 'offense', rateMul: 1.55 },
      E: { name: 'DAMPENING FIELD', desc: 'Slows enemies 55% in a 12m area for 8s. Click the field.', cd: 40, dur: 8, kind: 'defense', slow: 0.55, radius: 12, cast: true }
    },
    {
      id: 'seraph', name: 'SERAPH', title: 'THE RADIANT', faction: 'light',
      line: 'Stand between life and what hunts it, and never rule what you protect.',
      passive: { name: 'RADIANCE', desc: '+12% tower damage' },
      Q: { name: 'ZEALOTRY', desc: 'All towers deal 45% more damage for 8s', cd: 38, dur: 8, kind: 'offense', damageMul: 1.45 },
      E: { name: 'SANCTIFY', desc: 'Repair all towers to full and +20% range for 7s', cd: 44, dur: 7, kind: 'defense', heal: 1.0, rangeMul: 1.2 }
    },
    {
      id: 'sevra', name: 'SEVRA', title: 'THE NECROTIST', faction: 'xeno',
      line: 'Feed me your wounded. I will return them marching.',
      passive: { name: 'SANGUINE', desc: 'Towers heal 2% of damage dealt' },
      Q: { name: 'RAVENOUS', desc: 'Enemies take 35% more damage for 9s', cd: 38, dur: 9, kind: 'offense', takenMul: 1.35 },
      E: { name: 'CONSUME', desc: 'Drain 18% of every enemy\u2019s current HP; half becomes gold', cd: 42, dur: 0.4, kind: 'defense', drainPct: 0.18 }
    },
    {
      id: 'rake', name: 'RAKE', title: 'THE CORSAIR', faction: 'pirate',
      line: 'Every border out here needs somebody to carry things across it. That is us.',
      passive: { name: 'PRIZE MONEY', desc: '+8% bounty gold from kills' },
      Q: { name: 'BROADSIDE', desc: 'Twelve shells rain on the lane over 9s', cd: 34, dur: 9, kind: 'offense', shells: 12, shellDmg: 90, shellRadius: 4 },
      E: { name: 'SMOKESCREEN', desc: 'Enemies slowed 30% and lose 10 armour for 10s', cd: 36, dur: 10, kind: 'defense', slow: 0.3, shred: 10 }
    }
  ];

  D.FACTIONS = {
    human: { name: 'HUMANITY', color: '#38e8ff', accent: '#ff2fd6' },
    light: { name: 'FEDERATION OF LIGHT', color: '#fbbf24', accent: '#fff7e0' },
    xeno: { name: 'THE XENO', color: '#a855f7', accent: '#ff2fd6' },
    pirate: { name: 'THE PIRATES', color: '#ef4444', accent: '#ff6b6b' }
  };

  window.Data = D;
})();
