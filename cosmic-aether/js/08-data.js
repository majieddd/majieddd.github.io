/* RELIQUARY :: 08-data
   Every tunable. Towers, denizens, elements, reactions, waves, commanders,
   boards.

   IP CONTINUITY. Names, roles and faction assignments are taken from the
   parent game's real roster (verified against `node tools/facts.js towers`
   and `commanders`, not from memory, because the roster is 60 towers and 28
   commanders and guessing at it is how a demo ends up with towers that do not
   exist). This is a 14-tower subset chosen so that every element appears at
   least twice, which is what makes all ten reactions reachable.

   THE ART CONSTRAINT THAT SHAPED THE ENEMY DESIGN. The style law says faction
   colour dominates a frame to the point of monochrome, and that rival colours
   never share one. A tower defence necessarily puts two factions on screen at
   once, so the resolution here is that the BOARD and the TOWERS carry the
   defender's colour in full, and the denizens are rendered as near-black
   hulls whose only chroma is an emissive core in their own faction's key.
   That keeps one colour owning the frame, gives enemies a silhouette-first
   read, and makes the glowing core double as a health indicator. */
'use strict';

var DATA = (function () {

  /* ---------- elements ---------- */
  var ELEMENTS = {
    kinetic: { id: 'kinetic', name: 'KINETIC', color: '#cbd5e1', glyph: 'K' },
    fire:    { id: 'fire',    name: 'FIRE',    color: '#fb7185', glyph: 'F' },
    frost:   { id: 'frost',   name: 'FROST',   color: '#7dd3fc', glyph: 'C' },
    storm:   { id: 'storm',   name: 'STORM',   color: '#a78bfa', glyph: 'S' },
    radiant: { id: 'radiant', name: 'RADIANT', color: '#fbbf24', glyph: 'R' },
    venom:   { id: 'venom',   name: 'VENOM',   color: '#86efac', glyph: 'V' },
    void:    { id: 'void',    name: 'VOID',    color: '#e879f9', glyph: 'O' }
  };
  var ELEMENT_ORDER = ['kinetic', 'fire', 'frost', 'storm', 'radiant', 'venom', 'void'];

  /* ---------- reactions ----------
     A denizen carries at most one MARK at a time. Applying a second element
     that pairs with the standing mark triggers a reaction, consumes the mark,
     and applies the new element as the next mark. That single-mark rule is
     what keeps reactions legible: with stacking marks the player cannot
     predict which reaction fires, and a reaction system nobody can predict is
     just a random damage multiplier with a name.

     `key` is the sorted element pair so lookup is order independent. */
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  var REACTIONS = [
    { id: 'thermal',     name: 'THERMAL SHOCK', a: 'fire',    b: 'frost',   color: '#f0abfc',
      mult: 2.10, blurb: 'Burst damage as the shell cracks.' },
    { id: 'immolate',    name: 'IMMOLATE',      a: 'fire',    b: 'storm',   color: '#fb923c',
      mult: 1.35, burn: { dps: 26, dur: 4.0 }, blurb: 'Sets a spreading burn.' },
    { id: 'superconduct',name: 'SUPERCONDUCT',  a: 'frost',   b: 'storm',   color: '#67e8f9',
      mult: 1.20, shred: { amount: 0.35, dur: 6.0 }, blurb: 'Strips armour from the target.' },
    { id: 'catalyse',    name: 'CATALYSE',      a: 'fire',    b: 'venom',   color: '#bef264',
      mult: 1.15, amplify: 2.0, blurb: 'Doubles every poison already on it.' },
    { id: 'rupture',     name: 'RUPTURE',       a: 'kinetic', b: 'void',    color: '#f472b6',
      mult: 1.0, missingHp: 0.13, blurb: 'Tears open in proportion to the wound.' },
    { id: 'blight',      name: 'BLIGHT',        a: 'radiant', b: 'venom',   color: '#a3e635',
      mult: 1.30, healReversal: 5.0, blurb: 'Healing becomes harm for a while.' },
    { id: 'collapse',    name: 'COLLAPSE',      a: 'storm',   b: 'void',    color: '#c084fc',
      mult: 1.45, pull: 3.2, blurb: 'Drags everything nearby into the wound.' },
    { id: 'paralysis',   name: 'PARALYSIS',     a: 'frost',   b: 'radiant', color: '#bae6fd',
      mult: 1.10, stun: 1.15, blurb: 'Locks the body still.' },
    { id: 'entropy',     name: 'ENTROPY',       a: 'storm',   b: 'venom',   color: '#5eead4',
      mult: 1.25, spread: 4.5, blurb: 'Jumps the mark to everything close.' },
    { id: 'plasma',      name: 'PLASMA',        a: 'fire',    b: 'radiant', color: '#fde047',
      mult: 2.35, blurb: 'The largest single detonation in the codex.' }
  ];
  var REACTION_BY_PAIR = {};
  for (var ri = 0; ri < REACTIONS.length; ri++) {
    REACTION_BY_PAIR[pairKey(REACTIONS[ri].a, REACTIONS[ri].b)] = REACTIONS[ri];
  }
  function reactionFor(a, b) {
    if (!a || !b || a === b) return null;
    return REACTION_BY_PAIR[pairKey(a, b)] || null;
  }

  /* ---------- towers ----------
     `kind` selects the attack implementation in the sim:
       bullet   travelling projectile, single target on impact
       shell    travelling projectile, splash on impact
       beam     instant continuous ray, ramps while held on one target
       chain    instant, hops between targets
       cone     instant, damages a wedge in front
       hitscan  instant, pierces everything on a line
       field    passive aura, no target needed
       sweep    rotating beam that damages whatever it crosses
       support  no attack: economy or buffs

     Tiers are multiplicative on the base and each tier changes the MODEL, not
     just the numbers, because an upgrade the player cannot see is an upgrade
     the player does not feel. */
  var TOWERS = {
    bolt: {
      id: 'bolt', name: 'BOLT', origin: 'human', element: 'kinetic', kind: 'bullet',
      cost: 100, range: 15.5, dps: 30, fireRate: 2.6, projSpeed: 62, air: true,
      role: 'Rapid single target',
      blurb: 'Fires a fast solid slug at one target. Cheap, reliable, and the only thing on the board at wave one.',
      flavor: 'Standard issue. Nothing about it is clever, and it has never once failed to work.',
      upgrades: [
        { cost: 145, dps: 1.75, range: 1.10, fireRate: 1.15, note: 'Longer barrel, tighter group.' },
        { cost: 290, dps: 2.05, range: 1.14, fireRate: 1.25, note: 'Twin mount, autoloader.' }
      ]
    },
    cryo: {
      id: 'cryo', name: 'CRYO', origin: 'human', element: 'frost', kind: 'shell',
      cost: 130, range: 13.5, dps: 17, fireRate: 0.95, projSpeed: 34, splash: 4.4, air: true,
      slow: { amount: 0.42, dur: 2.6 },
      role: 'Area slow and control',
      blurb: 'Lobs a coolant charge that slows everything in the blast for a few seconds.',
      flavor: 'It does not have to kill them. It only has to make them late.',
      upgrades: [
        { cost: 170, dps: 1.5, splash: 1.20, slowAmount: 1.18, note: 'Wider charge, deeper chill.' },
        { cost: 330, dps: 1.8, splash: 1.30, slowDur: 1.40, note: 'The cold stops leaving.' }
      ]
    },
    mortar: {
      id: 'mortar', name: 'MORTAR', origin: 'human', element: 'fire', kind: 'shell',
      cost: 175, range: 22.0, minRange: 5.5, dps: 52, fireRate: 0.62, projSpeed: 26,
      splash: 5.2, air: false, arc: true,
      role: 'Ground splash artillery',
      blurb: 'High-arcing shell with a large blast. Cannot depress its barrel far enough to hit anything close, and cannot touch flyers.',
      flavor: 'Ranging is done by a corporal with a slide rule. It is still faster than asking for permission.',
      upgrades: [
        { cost: 210, dps: 1.7, splash: 1.18, note: 'Heavier charge.' },
        { cost: 420, dps: 2.0, fireRate: 1.35, splash: 1.25, note: 'Three tubes, one crew.' }
      ]
    },
    flak: {
      id: 'flak', name: 'FLAK', origin: 'human', element: 'kinetic', kind: 'bullet',
      cost: 150, range: 17.0, dps: 24, fireRate: 3.2, projSpeed: 78,
      air: true, airOnly: false, airBonus: 3.1, splash: 2.2,
      role: 'Anti-air: brings flyers down',
      blurb: 'Proximity-fused burst that does triple damage to anything airborne. Ordinary against ground.',
      flavor: 'Every gun on the board can shoot up. This one is designed to.',
      upgrades: [
        { cost: 190, dps: 1.6, airBonus: 1.15, note: 'Better fuse timing.' },
        { cost: 370, dps: 1.9, splash: 1.35, fireRate: 1.2, note: 'Curtain fire.' }
      ]
    },
    arc: {
      id: 'arc', name: 'ARC', origin: 'human', element: 'storm', kind: 'chain',
      cost: 190, range: 14.0, dps: 34, fireRate: 1.5, chains: 3, chainRange: 6.2,
      chainFalloff: 0.72, air: true,
      role: 'Current that runs the lane',
      blurb: 'A current that jumps to nearby targets, losing bite with each hop.',
      flavor: 'It prefers a crowd. Give it one.',
      upgrades: [
        { cost: 230, chains: 2, dps: 1.45, note: 'Two more hops.' },
        { cost: 450, dps: 1.7, chainFalloff: 1.22, note: 'The current stops weakening.' }
      ]
    },
    prism: {
      id: 'prism', name: 'PRISM', origin: 'light', element: 'radiant', kind: 'beam',
      cost: 210, range: 16.5, dps: 26, rampRate: 0.62, rampMax: 3.4, air: true,
      role: 'Ramping focused beam',
      blurb: 'A continuous beam that grows stronger the longer it stays on one body. Switching targets resets it.',
      flavor: 'Patience is a weapon. This is the only tower that agrees.',
      upgrades: [
        { cost: 250, rampMax: 1.25, dps: 1.4, note: 'Holds a higher charge.' },
        { cost: 500, rampRate: 1.55, dps: 1.5, note: 'Reaches full output in half the time.' }
      ]
    },
    pharos: {
      id: 'pharos', name: 'PHAROS', origin: 'light', element: 'radiant', kind: 'sweep',
      cost: 320, range: 18.0, dps: 44, sweepRate: 1.05, air: true,
      role: 'A turning lamp that owns the approach',
      blurb: 'Rotates a fixed beam at a constant rate, burning everything the lamp crosses. It does not aim and it does not stop.',
      flavor: 'The keeper died a long time ago. The lamp was never told.',
      upgrades: [
        { cost: 340, dps: 1.6, sweepRate: 1.2, note: 'Faster rotation.' },
        { cost: 640, dps: 1.85, range: 1.2, note: 'A second lamp, counter-rotating.' }
      ]
    },
    toxin: {
      id: 'toxin', name: 'TOXIN', origin: 'xeno', element: 'venom', kind: 'bullet',
      cost: 145, range: 14.5, dps: 12, fireRate: 1.8, projSpeed: 44, air: true,
      poison: { pctHp: 0.006, dur: 5.0, maxStacks: 6 },
      role: 'Stacking percent-HP venom',
      blurb: 'Weak on impact. Applies a stacking poison that burns a percentage of maximum health per second, which is how it kills things far too big to shoot.',
      flavor: 'It does not care how much of it there is.',
      upgrades: [
        { cost: 185, poisonPct: 1.45, note: 'A meaner strain.' },
        { cost: 380, poisonStacks: 1.5, poisonDur: 1.3, note: 'It stops washing out.' }
      ]
    },
    maw: {
      id: 'maw', name: 'MAW', origin: 'xeno', element: 'void', kind: 'bullet',
      cost: 260, range: 12.0, dps: 40, fireRate: 0.85, projSpeed: 40, air: false,
      execute: 0.16,
      role: 'Swallows one creature whole',
      blurb: 'Heavy single hits. Instantly kills any non-boss target already below a fraction of its health.',
      flavor: 'There is no digestion. There is only the decision.',
      upgrades: [
        { cost: 300, execute: 1.4, dps: 1.4, note: 'A wider threshold.' },
        { cost: 580, execute: 1.5, fireRate: 1.3, note: 'It has learned to be quick.' }
      ]
    },
    pyre: {
      id: 'pyre', name: 'PYRE', origin: 'pirate', element: 'fire', kind: 'cone',
      cost: 165, range: 10.5, dps: 46, fireRate: 1.1, coneAngle: 0.62, air: false,
      burn: { dps: 9, dur: 3.0 },
      role: 'Cone burn on a short fuse',
      blurb: 'Sprays burning promethium in a wide wedge and leaves everything caught alight. Short reach.',
      flavor: 'Grist welded it together in an afternoon and has never explained the third tank.',
      upgrades: [
        { cost: 200, coneAngle: 1.2, dps: 1.4, note: 'A wider wedge.' },
        { cost: 400, burnDps: 1.8, burnDur: 1.4, note: 'The fire stays lit.' }
      ]
    },
    cyclone: {
      id: 'cyclone', name: 'CYCLONE', origin: 'pirate', element: 'storm', kind: 'shell',
      cost: 200, range: 13.0, dps: 28, fireRate: 0.8, projSpeed: 30, splash: 4.0,
      air: true, launch: 1.0,
      role: 'Hurls enemies skyward',
      blurb: 'Throws ground targets into the air, where they cannot advance and where anti-air weapons treat them as flyers.',
      flavor: 'Everything comes down. That part is not the tower.',
      upgrades: [
        { cost: 240, launch: 1.35, splash: 1.2, note: 'Throws them higher.' },
        { cost: 470, dps: 1.7, fireRate: 1.25, note: 'It stops waiting.' }
      ]
    },
    railgun: {
      id: 'railgun', name: 'RAILGUN', origin: 'robotic', element: 'kinetic', kind: 'hitscan',
      cost: 300, range: 30.0, dps: 84, fireRate: 0.5, pierce: 99, air: true,
      role: 'Long-range piercing hitscan',
      blurb: 'Instant. Crosses the whole board and damages every target on the line. Slow to cycle.',
      flavor: 'The Vigil does not lead its shots. It does not need to.',
      upgrades: [
        { cost: 360, dps: 1.7, fireRate: 1.25, note: 'Faster capacitor cycle.' },
        { cost: 700, dps: 2.0, range: 1.15, note: 'Second rail, doubled rating.' }
      ]
    },
    singularity: {
      id: 'singularity', name: 'SINGULARITY', origin: 'robotic', element: 'void', kind: 'field',
      cost: 240, range: 9.5, dps: 14, pull: 2.6, air: true,
      role: 'Gravity: clumps enemies',
      blurb: 'Drags everything in range toward its centre and grinds them slowly. It exists to make splash weapons worth building.',
      flavor: 'A tidy machine. It is putting things where they belong.',
      upgrades: [
        { cost: 280, pull: 1.35, range: 1.15, note: 'A deeper well.' },
        { cost: 540, dps: 2.0, range: 1.12, note: 'The well now bites.' }
      ]
    },
    vault: {
      id: 'vault', name: 'VAULT', origin: 'robotic', element: 'kinetic', kind: 'support',
      cost: 190, range: 0, income: 13, air: false,
      role: 'Economy: generates gold',
      blurb: 'Pays out at the end of every wave. Builds nothing, kills nothing, and decides the whole run if it goes down early.',
      flavor: 'Compound interest is the only weapon that never needs reloading.',
      upgrades: [
        { cost: 210, income: 1.7, note: 'A second ledger.' },
        { cost: 420, income: 2.0, note: 'It has begun lending to itself.' }
      ]
    }
  };
  var TOWER_ORDER = ['bolt', 'cryo', 'mortar', 'flak', 'arc', 'prism', 'pharos',
    'toxin', 'maw', 'pyre', 'cyclone', 'railgun', 'singularity', 'vault'];

  /* ---------- denizens ----------
     `trait` selects behaviour in the sim. Health values are the base at wave
     one and are scaled by the wave curve below. */
  var DENIZENS = {
    /* xeno */
    chitling:    { id: 'chitling', name: 'CHITLING', faction: 'xeno', hp: 46, speed: 4.6, bounty: 7, armor: 0, rig: 'crawler', scale: 1.02 },
    gnawling:    { id: 'gnawling', name: 'GNAWLING', faction: 'xeno', hp: 68, speed: 5.8, bounty: 9, armor: 0, rig: 'crawler', scale: 1.12, trait: 'sprinter' },
    bloatpod:    { id: 'bloatpod', name: 'BLOATPOD', faction: 'xeno', hp: 165, speed: 3.1, bounty: 16, armor: 0.10, rig: 'walker', scale: 1.34, trait: 'burst', burst: { dmg: 0, slow: 0.5, radius: 5 } },
    hivelord:    { id: 'hivelord', name: 'HIVELORD', faction: 'xeno', hp: 330, speed: 3.4, bounty: 30, armor: 0.18, rig: 'walker', scale: 1.55, trait: 'summon', summon: { of: 'chitling', every: 3.4, count: 2 } },
    broodmother: { id: 'broodmother', name: 'BROODMOTHER', faction: 'xeno', hp: 560, speed: 2.7, bounty: 52, armor: 0.24, rig: 'strider', scale: 1.85, trait: 'split', split: { into: 'gnawling', count: 3 } },
    /* shared archetypes reskinned per faction at spawn time */
    tither:      { id: 'tither', name: 'TITHER', faction: 'xeno', hp: 92, speed: 4.2, bounty: 12, armor: 0.05, rig: 'flyer', scale: 1.15, flying: true },
    graft:       { id: 'graft', name: 'GRAFT', faction: 'xeno', hp: 190, speed: 3.6, bounty: 20, armor: 0.12, rig: 'walker', scale: 1.38, trait: 'mender', mend: { rate: 22, radius: 7.5 } },
    stockman:    { id: 'stockman', name: 'STOCKMAN', faction: 'xeno', hp: 310, speed: 3.0, bounty: 26, armor: 0.34, rig: 'walker', scale: 1.48, trait: 'shield', shield: { amount: 0.55 } },
    /* boss and miniboss */
    colossus:    { id: 'colossus', name: 'COLOSSUS', faction: 'xeno', hp: 2400, speed: 2.2, bounty: 180, armor: 0.30, rig: 'strider', scale: 2.45, boss: true, trait: 'miniboss' },
    harbinger:   { id: 'harbinger', name: 'HARBINGER', faction: 'xeno', hp: 8600, speed: 1.9, bounty: 600, armor: 0.36, rig: 'strider', scale: 3.2, boss: true, trait: 'boss',
                   phases: [{ at: 0.66, enrage: 1.22 }, { at: 0.33, enrage: 1.45, summon: 'hivelord' }] }
  };
  var DENIZEN_ORDER = ['chitling', 'gnawling', 'tither', 'bloatpod', 'graft',
    'stockman', 'hivelord', 'broodmother', 'colossus', 'harbinger'];

  /* Per-faction display names for the shared archetypes, so choosing a rival
     faction changes what you are fighting and not merely its colour. The
     mechanics stay identical, which keeps the difficulty curve honest across
     the five choices. */
  var FACTION_NAMES = {
    xeno:   { chitling: 'CHITLING', gnawling: 'GNAWLING', tither: 'TITHER', bloatpod: 'BLOATPOD', graft: 'GRAFT', stockman: 'STOCKMAN', hivelord: 'HIVELORD', broodmother: 'BROODMOTHER', colossus: 'COLOSSUS', harbinger: 'HARBINGER' },
    human:  { chitling: 'TROOPER', gnawling: 'TIC TAC', tither: 'FOO FIGHTER', bloatpod: 'FLUXLINER', graft: 'FIELD MEDIC', stockman: 'AURORA', hivelord: 'BLACK MANTA', broodmother: 'TR-3B', colossus: 'PHOENIX HEAVY', harbinger: 'MOTHERSHIP' },
    light:  { chitling: 'VOTARY', gnawling: 'DEFERRAL', tither: 'CENSER', bloatpod: 'ARBITER', graft: 'SANCTIFIER', stockman: 'SEALBEARER', hivelord: 'ORIFLAMME', broodmother: 'LUMINARK', colossus: 'MONSTRANCE', harbinger: 'FIRST SPEAKER' },
    pirate: { chitling: 'CUTTER', gnawling: 'RUNNER', tither: 'SKIFF', bloatpod: 'WRECKER', graft: 'SAWBONES', stockman: 'SCRAPJACK', hivelord: 'BOARDER', broodmother: 'IRONHULK', colossus: 'DREADNOUGHT', harbinger: 'THE RED LEDGER' },
    robotic:{ chitling: 'STITCH', gnawling: 'SPLICER', tither: 'DRONE', bloatpod: 'FABRICANT', graft: 'MENDER UNIT', stockman: 'GANTRY', hivelord: 'OMNIFRAME', broodmother: 'LATTICE CORE', colossus: 'FOUNDRY WORKS', harbinger: 'THE VIGIL' }
  };

  /* ---------- wave curve ----------
     The same piecewise multiplier the parent game uses: 1.26 per wave to ten,
     then 1.22. Reproduced rather than reinvented so the difficulty FEELS like
     the same game, which is most of what makes a spin-off read as canon. */
  function waveHpMultiplier(wave) {
    var m = 1;
    for (var w = 2; w <= wave; w++) m *= (w <= 10 ? 1.26 : 1.22);
    return m;
  }

  /* Spawn tables. Each wave is a list of {of, count, gap, delay}. Composed
     rather than hand-authored per wave so the curve stays legible and a
     designer can see at a glance when each archetype enters. */
  function buildWaves() {
    var W = [];
    function wave(n, groups, opts) {
      W.push({
        n: n, groups: groups,
        bonus: (opts && opts.bonus) || (34 + n * 11),
        banner: (opts && opts.banner) || null,
        boss: !!(opts && opts.boss)
      });
    }
    wave(1,  [{ of: 'chitling', count: 8, gap: 0.85 }]);
    wave(2,  [{ of: 'chitling', count: 12, gap: 0.70 }]);
    wave(3,  [{ of: 'chitling', count: 8, gap: 0.62 }, { of: 'gnawling', count: 5, gap: 0.55, delay: 5 }]);
    wave(4,  [{ of: 'gnawling', count: 12, gap: 0.50 }], { banner: 'FAST MOVERS' });
    wave(5,  [{ of: 'tither', count: 7, gap: 0.90 }], { banner: 'AIRBORNE' });
    wave(6,  [{ of: 'chitling', count: 14, gap: 0.45 }, { of: 'bloatpod', count: 3, gap: 1.6, delay: 4 }]);
    wave(7,  [{ of: 'bloatpod', count: 6, gap: 1.3 }, { of: 'tither', count: 5, gap: 1.0, delay: 6 }]);
    wave(8,  [{ of: 'gnawling', count: 16, gap: 0.38 }, { of: 'graft', count: 2, gap: 2.0, delay: 3 }], { banner: 'THEY BROUGHT A MENDER' });
    wave(9,  [{ of: 'stockman', count: 5, gap: 1.5 }, { of: 'gnawling', count: 10, gap: 0.42, delay: 4 }]);
    wave(10, [{ of: 'colossus', count: 1, gap: 1 }, { of: 'chitling', count: 14, gap: 0.5, delay: 3 }], { banner: 'COLOSSUS', boss: true, bonus: 240 });
    wave(11, [{ of: 'tither', count: 12, gap: 0.55 }], { banner: 'AIR SUPERIORITY' });
    wave(12, [{ of: 'hivelord', count: 3, gap: 2.2 }, { of: 'bloatpod', count: 6, gap: 1.0, delay: 5 }]);
    wave(13, [{ of: 'stockman', count: 8, gap: 1.1 }, { of: 'graft', count: 3, gap: 2.4, delay: 2 }]);
    wave(14, [{ of: 'gnawling', count: 24, gap: 0.28 }], { banner: 'SWARM' });
    wave(15, [{ of: 'hivelord', count: 4, gap: 1.8 }, { of: 'tither', count: 10, gap: 0.6, delay: 4 }]);
    wave(16, [{ of: 'broodmother', count: 2, gap: 3.0 }, { of: 'gnawling', count: 14, gap: 0.4, delay: 5 }]);
    wave(17, [{ of: 'stockman', count: 10, gap: 0.9 }, { of: 'graft', count: 4, gap: 2.0, delay: 3 }], { banner: 'ARMOURED COLUMN' });
    wave(18, [{ of: 'broodmother', count: 3, gap: 2.6 }, { of: 'tither', count: 12, gap: 0.5, delay: 6 }]);
    wave(19, [{ of: 'colossus', count: 2, gap: 5.0 }, { of: 'hivelord', count: 4, gap: 1.6, delay: 4 }], { banner: 'TWO COLOSSI', bonus: 320 });
    wave(20, [{ of: 'harbinger', count: 1, gap: 1 }, { of: 'broodmother', count: 3, gap: 4.0, delay: 12 }], { banner: 'HARBINGER', boss: true, bonus: 900 });
    return W;
  }
  var WAVES = buildWaves();

  /* ---------- commanders ----------
     Two abilities each, offensive on Q and defensive on E, matching the parent
     game's free starters. */
  var COMMANDERS = {
    vanta: {
      id: 'vanta', name: 'DIR. REYES', callsign: 'VANTA', faction: 'human',
      trait: 'PERPETUAL STUDY',
      traitBlurb: 'Towers gain 8% damage for every wave they survive, to a maximum of 40%.',
      q: { id: 'overclock', name: 'OVERCLOCK', cd: 26, dur: 8, blurb: 'Every tower fires 70% faster for eight seconds.' },
      e: { id: 'dampen', name: 'DAMPEN', cd: 30, dur: 6, blurb: 'Everything on the board is slowed by half for six seconds.' }
    },
    seraph: {
      id: 'seraph', name: 'SERAPH', callsign: 'SERAPH', faction: 'light',
      trait: 'RADIANCE',
      traitBlurb: 'Radiant towers have 20% more range, and reactions do 15% more damage.',
      q: { id: 'zealotry', name: 'ZEALOTRY', cd: 30, dur: 7, blurb: 'Doubles the damage of every radiant tower for seven seconds.' },
      e: { id: 'sanctify', name: 'SANCTIFY', cd: 34, dur: 0, blurb: 'Restores three lives and clears every debuff from your towers.' }
    },
    sevra: {
      id: 'sevra', name: 'SEVRA', callsign: 'SEVRA', faction: 'xeno',
      trait: 'RISEN LEGION',
      traitBlurb: 'Poison and burn effects last 40% longer.',
      q: { id: 'ravenous', name: 'RAVENOUS', cd: 28, dur: 9, blurb: 'Every enemy on the board takes stacking venom for nine seconds.' },
      e: { id: 'consume', name: 'CONSUME', cd: 32, dur: 0, blurb: 'Kills the weakest third of the wave outright and pays their bounty.' }
    },
    rake: {
      id: 'rake', name: 'RAKE', callsign: 'RAKE', faction: 'pirate',
      trait: 'PLUNDER',
      traitBlurb: 'Every kill pays 25% more gold.',
      q: { id: 'broadside', name: 'BROADSIDE', cd: 24, dur: 0, blurb: 'Drops a line of shells along the lane ahead of the leader.' },
      e: { id: 'smokescreen', name: 'SMOKESCREEN', cd: 30, dur: 6, blurb: 'Enemies lose their way for six seconds and stop advancing.' }
    },
    axiom: {
      id: 'axiom', name: 'AXIOM', callsign: 'AXIOM', faction: 'robotic',
      trait: 'BOOT SEQUENCE',
      traitBlurb: 'Start each run with 150 extra gold, and upgrades cost 12% less.',
      q: { id: 'quake', name: 'QUAKE', cd: 27, dur: 0, blurb: 'A ground slam that damages and staggers everything on the lane.' },
      e: { id: 'lattice', name: 'LATTICE', cd: 33, dur: 10, blurb: 'Towers are immune to disruption and gain 30% range for ten seconds.' }
    }
  };
  var COMMANDER_ORDER = ['vanta', 'seraph', 'sevra', 'rake', 'axiom'];

  /* ---------- boards ---------- */
  var BOARDS = [
    {
      id: 'thresh', name: 'THRESHOLD', sub: 'Kepler-442 orbital plate',
      cell: 3.2, gw: 26, gh: 19, pathWidth: 3.4, decor: 84, spires: 11,
      difficulty: 1,
      blurb: 'A wide plate with one long lane. Room to build and time to think.',
      waypoints: [[-37, 0, 4], [-26, 0, 10], [-14, 0, -2], [-3, 0, -11], [9, 0, -10], [18, 0, -2], [22, 0, 9], [30, 0, 12], [37, 0, 5]]
    },
    {
      id: 'spine', name: 'THE SPINE', sub: 'Derelict transit gantry',
      cell: 3.0, gw: 28, gh: 20, pathWidth: 3.2, decor: 74, spires: 13,
      difficulty: 2,
      blurb: 'A tighter serpentine. Fewer plots, and every one of them matters.',
      waypoints: [[-37, 0, -12], [-27, 0, -14], [-18, 0, -4], [-10, 0, 8], [0, 0, 11], [10, 0, 4], [16, 0, -7], [26, 0, -11], [37, 0, -5]]
    },
    {
      id: 'reliquary', name: 'THE RELIQUARY', sub: 'A cathedral that outlived its faith',
      cell: 2.9, gw: 30, gh: 22, pathWidth: 3.0, decor: 104, spires: 16,
      difficulty: 3,
      blurb: 'A long double switchback under broken vaulting. The hardest board in the demo.',
      waypoints: [[-38, 0, 13], [-28, 0, 17], [-21, 0, 5], [-23, 0, -8], [-11, 0, -15], [1, 0, -10],
                  [6, 0, 1], [1, 0, 13], [12, 0, 17], [24, 0, 13], [29, 0, 1], [38, 0, -4]]
    },
    {
      id: 'halfworld', name: 'HALFWORLD', sub: 'Half a sphere, one road',
      cell: 3.2, gw: 56, gh: 34, pathWidth: 4.2, decor: 110, spires: 12,
      difficulty: 2, sagR: 48, planetR: 96,
      blurb: 'A hemisphere rolled into one expedition: extreme world curvature, four gates feeding one serpentine, exits on the far shoulder.',
      waypoints: [[-78, 0, -44], [-64, 0, -30], [-70, 0, -12], [-52, 0, -2], [-56, 0, 14],
                  [-36, 0, 20], [-28, 0, 6], [-40, 0, -14], [-24, 0, -30], [-6, 0, -36],
                  [8, 0, -22], [24, 0, -18], [12, 0, -2], [26, 0, 6], [44, 0, 8],
                  [38, 0, 24], [52, 0, 34], [70, 0, 30], [62, 0, 10], [78, 0, -2],
                  [68, 0, -24], [50, 0, -40], [72, 0, -46], [84, 0, -34],
                  [80, 0, -18], [72, 0, 2], [80, 0, 14], [70, 0, 26]]
    }
  ];

  var DIFFICULTIES = [
    { id: 'skirmish', name: 'SKIRMISH', hp: 0.80, gold: 1.15, lives: 25, blurb: 'For learning the boards.' },
    { id: 'contested', name: 'CONTESTED', hp: 1.00, gold: 1.00, lives: 20, blurb: 'The intended run.' },
    { id: 'overrun', name: 'OVERRUN', hp: 1.24, gold: 0.88, lives: 12, blurb: 'The curve does not forgive a bad wave ten.' }
  ];

  var START_GOLD = 340;
  var SELL_RATIO = 0.65;

  return {
    ELEMENTS: ELEMENTS, ELEMENT_ORDER: ELEMENT_ORDER,
    REACTIONS: REACTIONS, reactionFor: reactionFor, pairKey: pairKey,
    TOWERS: TOWERS, TOWER_ORDER: TOWER_ORDER,
    DENIZENS: DENIZENS, DENIZEN_ORDER: DENIZEN_ORDER, FACTION_NAMES: FACTION_NAMES,
    WAVES: WAVES, waveHpMultiplier: waveHpMultiplier,
    COMMANDERS: COMMANDERS, COMMANDER_ORDER: COMMANDER_ORDER,
    BOARDS: BOARDS, DIFFICULTIES: DIFFICULTIES,
    START_GOLD: START_GOLD, SELL_RATIO: SELL_RATIO
  };
})();


