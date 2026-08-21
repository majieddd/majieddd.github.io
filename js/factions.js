/* ==========================================================================
   COSMIC CONQUEST — FACTIONS AND LORE

   The age of alien integration. Humanity has met alien life and found the
   universe teeming with it. Using new-age technology the player travels to
   other worlds and fights to take them.

   Four powers matter. Three of them want the galaxy. The fourth wants
   everything, and answers to nobody.
   ========================================================================== */

const FACTIONS = {
  human: {
    id: 'human', name: 'HUMANITY', short: 'Humanity',
    color: '#38e8ff', accent: '#7ff3ff', icon: '⌖',
    creed: 'Adapt. Endure. Hold the line.',
    tagline: 'Adaptable, outnumbered, unwilling to leave. Alien drives on human hulls.',
    crest: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="4" fill="currentColor"/><path d="M20 2v8M20 30v8M2 20h8M30 20h8" stroke="currentColor" stroke-width="2"/></svg>',
    blurb:
      'Late to the stars and outnumbered on every front. What humanity brought to ' +
      'integration was not doctrine or appetite but adaptability — the willingness ' +
      'to bolt alien technology onto human frames and make it work. Neither ' +
      'selfless nor devouring. Simply unwilling to leave.',
    bonusName: 'RESILIENT',
    bonusDesc: '+10 lives and +10% to every tower statistic.',
    apply: (side) => {
      side.maxLives += 10; side.lives += 10;
      side.mods.damage += 0.10; side.mods.rate += 0.10; side.mods.range += 0.10;
    }
  },

  light: {
    id: 'light', name: 'FEDERATION OF LIGHT', short: 'Federation',
    color: '#fbbf24', accent: '#fde68a', icon: '☀',
    creed: 'All life is one life. Surrender yours to it.',
    tagline: 'Sworn to defend all life — at the price of your own free will.',
    crest: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="currentColor"/><path d="M20 1v7M20 32v7M1 20h7M32 20h7M6.5 6.5l5 5M28.5 28.5l5 5M33.5 6.5l-5 5M11.5 28.5l-5 5" stroke="currentColor" stroke-width="2.4"/></svg>',
    blurb:
      'A coalition of many benign species, bound by the defence of all life — human ' +
      'and alien alike — and by a single controversial tenet: that a member ' +
      'surrenders their life eternally to the cause. To their allies they are the ' +
      'galaxy’s conscience. To their critics they are a cult that took the ' +
      'free will of everyone who ever joined, and calls the loss a gift.',
    bonusName: 'ILLUMINATED',
    bonusDesc: 'Every tower you build begins one level higher.',
    apply: (side) => { side.startLevelBonus = (side.startLevelBonus || 0) + 1; }
  },

  xeno: {
    id: 'xeno', name: 'THE XENO', short: 'Xeno',
    color: '#7c3aed', accent: '#c4b5fd', icon: '⬢',
    creed: 'Consume. Grow. Repeat.',
    tagline: 'An appetite with a fleet. Whatever they meet, they eat.',
    crest: '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 4l6 3.5v7L20 18l-6-3.5v-7z"/><path d="M11 20l6 3.5v7L11 34l-6-3.5v-7z" opacity=".8"/><path d="M29 20l6 3.5v7L29 34l-6-3.5v-7z" opacity=".8"/></svg>',
    blurb:
      'Not an alliance — an appetite. The Xeno exist to annihilate, conquer and ' +
      'devour, folding whatever they consume into their own mass. They keep no ' +
      'treaties because a treaty implies something other than themselves is ' +
      'permitted to persist. Everything they have ever met, they have eaten or ' +
      'are still eating.',
    bonusName: 'DEVOURING',
    bonusDesc: 'Reanimated units you send are 25% stronger.',
    apply: (side) => { side.mods.reanim = (side.mods.reanim || 1) * 1.25; }
  },

  pirate: {
    id: 'pirate', name: 'THE PIRATES', short: 'Pirates',
    color: '#ef4444', accent: '#fca5a5', icon: '☠',
    creed: 'No flag. No debts. No end of us.',
    tagline: 'No flag, no debts. The swarm answers to them; they answer to no one.',
    crest: '<svg viewBox="0 0 40 40"><path d="M7 7l26 26M33 7L7 33" stroke="currentColor" stroke-width="2.6" fill="none"/><circle cx="20" cy="20" r="6" fill="currentColor"/></svg>',
    blurb:
      'Made of anything and all things — defectors, escaped experiments, whole ' +
      'species that refused both the Federation’s vow and the Xeno’s ' +
      'hunger. They hold no allegiance and are the enemy of every power in the ' +
      'galaxy, which is precisely why the creature-swarms that boil out of the ' +
      'dark answer to them. Pirate worlds exist. Pirate commanders hold them.',
    bonusName: 'PLUNDER',
    bonusDesc: 'Begin every battle with enough extra gold for one more tower.',
    apply: (side) => { side.gold += sqGold(340); }
  }
};

const FACTION_ORDER = ['human', 'light', 'xeno', 'pirate'];

/** Everyone who is not you is a target; pirates are a target for everyone. */
function rivalFactionsOf(id) { return FACTION_ORDER.filter(f => f !== id); }

/* --------------------------------------------------------------------------
   FACTION TROOPS

   THE VIGIL (every enemy authored in config.js) is nobody's army. These are:
   real soldiers of a real power, fielded only where that power actually
   garrisons a world, marching in the same wave as the machines and at the
   same two commanders.

   Health and bounty are authored at the machine archetype each unit stands
   beside, and each set spans the same ladder the machine roster does -- one
   light, two middling, two heavy -- because a battle roster substitutes by
   MASS. A set clustered at one weight would only ever be drawn into one slot,
   and a set authored off the ladder would move the wave curve the pins were
   measured on. What differs from the machine it stands beside is what the
   unit DOES.
-------------------------------------------------------------------------- */
const FACTION_ENEMY_TYPES = {
  /* FEDERATION OF LIGHT -- shielded, radiant, never simply out-damaged. */
  votary:      { id:'votary', faction:'light', name:'Votary', hp:96, speed:1.4, armor:3, bounty:16, lives:1, radius:9,
                 color:'#fde68a', shape:'chevron', shield:44, shieldRegen:20, shieldDelay:3.0,
                 elemWeak:{ void:0.35 },
                 desc:'Sworn light infantry behind a small regenerating ward. It surrendered its will to the cause and got the shield in exchange.' },
  censer:      { id:'censer', faction:'light', name:'Censer', hp:150, speed:0.95, armor:3, bounty:29, lives:2, radius:11,
                 color:'#fcd34d', shape:'cross', healRate:24, healRadius:2.5,
                 elemWeak:{ venom:0.4 },
                 desc:'Pours restorative light over the rank ahead. Nothing behind it dies while it lives.' },
  sanctifier:  { id:'sanctifier', faction:'light', name:'Sanctifier', hp:235, speed:1.0, armor:5, bounty:36, lives:2, radius:12,
                 color:'#fbbf24', shape:'shield', shield:200, shieldRegen:42, shieldDelay:2.6,
                 elemResist:{ fire:0.4 },
                 desc:'A heavy ward that reforms seconds after you break it. Fire barely registers; venom goes straight through.' },
  oriflamme:   { id:'oriflamme', faction:'light', name:'Oriflamme', hp:405, speed:0.82, armor:9, bounty:47, lives:3, radius:15,
                 color:'#facc15', shape:'oriflamme', shield:120, shieldRegen:30, shieldDelay:3.4,
                 aura:{ radius:3.0, armor:8, tint:'#facc15', label:'ORIFLAMME' },
                 elemWeak:{ void:0.3 },
                 desc:'AURA \u2014 the standard grants +8 armour within 3 tiles, and carries a ward of its own. Break the banner first.' },
  luminark:    { id:'luminark', faction:'light', name:'Luminark', hp:520, speed:0.62, armor:12, bounty:59, lives:4, radius:17,
                 color:'#fef08a', shape:'jugger', shield:300, shieldRegen:56, shieldDelay:3.2, slowResist:0.4,
                 elemWeak:{ void:0.3 },
                 desc:'A cathedral engine on treads. Three hundred points of ward before you reach the hull.' },

  /* THE XENO -- swarming, splitting, always more of it than there was. */
  chitling:    { id:'chitling', faction:'xeno', name:'Chitling', hp:48, speed:1.6, armor:0, bounty:5, lives:1, radius:7,
                 color:'#a855f7', shape:'dot',
                 desc:'Grown, not built, and grown quickly. The Xeno spend these the way the Vigil spends Motes.' },
  gnawling:    { id:'gnawling', faction:'xeno', name:'Gnawling', hp:64, speed:1.3, armor:1, bounty:9, lives:1, radius:10,
                 color:'#9333ea', shape:'block',
                 elemWeak:{ fire:0.3 },
                 desc:'Teeth on legs. Dangerous only in the numbers it always arrives in.' },
  bloatpod:    { id:'bloatpod', faction:'xeno', name:'Bloatpod', hp:158, speed:1.0, armor:1, bounty:19, lives:2, radius:13,
                 color:'#c084fc', shape:'blob', splitInto:'chitling', splitCount:4,
                 elemWeak:{ fire:0.35 },
                 desc:'Bursts into four Chitlings when destroyed. Killing it is half a favour.' },
  hivelord:    { id:'hivelord', faction:'xeno', name:'Hivelord', hp:345, speed:0.9, armor:7, bounty:45, lives:3, radius:14,
                 color:'#7c3aed', shape:'hivelord',
                 aura:{ radius:3.0, speed:0.30, tint:'#7c3aed', label:'FRENZY' },
                 desc:'AURA \u2014 everything within 3 tiles moves 30% faster. The swarm feeds faster than your board can clear it.' },
  broodmother: { id:'broodmother', faction:'xeno', name:'Broodmother', hp:530, speed:0.62, armor:8, bounty:60, lives:4, radius:18,
                 color:'#a78bfa', shape:'carrier', summon:{ type:'chitling', count:3, interval:4.0 },
                 elemWeak:{ fire:0.3 },
                 desc:'Births Chitlings continuously the whole way down the lane. The lane is a nursery until she stops.' },

  /* THE PIRATES -- fast, dirty, and gone before you have finished aiming. */
  cutter:      { id:'cutter', faction:'pirate', name:'Cutter', hp:46, speed:2.4, armor:0, bounty:11, lives:1, radius:8,
                 color:'#f87171', shape:'chevron',
                 desc:'A stolen hull with the mass stripped out of it. Nothing aboard but engine and intent.' },
  boarder:     { id:'boarder', faction:'pirate', name:'Boarder', hp:124, speed:1.3, armor:2, bounty:29, lives:2, radius:10,
                 color:'#fb7185', shape:'blink', teleport:{ tiles:3.0, interval:4.2 },
                 desc:'GRAPPLES three tiles down the lane every four seconds. Aim where it is going, not where it is.' },
  scrapjack:   { id:'scrapjack', faction:'pirate', name:'Scrapjack', hp:215, speed:1.1, armor:4, bounty:36, lives:2, radius:12,
                 color:'#ef4444', shape:'jammer', jam:{ radius:2.4, duration:2.0, interval:6.8 },
                 desc:'SILENCES nearby towers for 2.0s on a timer, with a jammer looted off a Vigil Interdictor.' },
  wrecker:     { id:'wrecker', faction:'pirate', name:'Wrecker', hp:268, speed:1.25, armor:4, bounty:45, lives:3, radius:13,
                 color:'#dc2626', shape:'revenant', revive:0.40,
                 elemResist:{ venom:0.4 },
                 desc:'Gets back up once at 40% health. Pirates are made of everything, and most of it is spare.' },
  ironhulk:    { id:'ironhulk', faction:'pirate', name:'Ironhulk', hp:440, speed:0.78, armor:11, bounty:48, lives:3, radius:16,
                 color:'#b91c1c', shape:'jugger', splashResist:0.5,
                 elemWeak:{ storm:0.3 },
                 desc:'Salvage welded onto salvage. Blast damage does 50% less against the layers -- storm finds the seams.' },

  /* HUMANITY -- disciplined, armoured, holding formation to the last rank. */
  trooper:     { id:'trooper', faction:'human', name:'Trooper', hp:66, speed:1.15, armor:2, bounty:10, lives:1, radius:10,
                 color:'#38e8ff', shape:'block',
                 desc:'Line infantry on alien drives. Outnumbered on every front and still walking towards you.' },
  gunskiff:    { id:'gunskiff', faction:'human', name:'Gunskiff', hp:92, speed:1.5, armor:2, bounty:16, lives:1, radius:9,
                 color:'#67e8f9', shape:'diamond', flying:true,
                 elemWeak:{ storm:0.4 },
                 desc:'A crewed skiff that flies the maze rather than walking it.' },
  linebreaker: { id:'linebreaker', faction:'human', name:'Linebreaker', hp:335, speed:0.74, armor:10, bounty:30, lives:3, radius:14,
                 color:'#22d3ee', shape:'hex', elemResist:{ frost:0.4 },
                 elemWeak:{ storm:0.3 },
                 desc:'Bolted-on alien plate, heated against cold. Frost barely marks it.' },
  dragoon:     { id:'dragoon', faction:'human', name:'Dragoon', hp:405, speed:0.85, armor:9, bounty:46, lives:3, radius:15,
                 color:'#0ea5e9', shape:'warden', pullImmune:true, slowResist:0.6,
                 desc:'Anchored assault armour. It cannot be displaced and barely be slowed -- you have to out-damage it.' },
  vanguard:    { id:'vanguard', faction:'human', name:'Vanguard', hp:465, speed:0.72, armor:12, bounty:48, lives:3, radius:16,
                 color:'#06b6d4', shape:'vanguard',
                 aura:{ radius:2.6, armor:9, tint:'#06b6d4', label:'LOCKSTEP' },
                 desc:'AURA \u2014 the formation gives +9 armour within 2.6 tiles. Humanity endures by standing closer together.' }
};
Object.assign(ENEMY_TYPES, FACTION_ENEMY_TYPES);

/* One loop stamps allegiance on everything authored before the sets above, so
   a machine can never be born without one and `e.faction === undefined` can
   never come to mean "nobody has decided yet". */
for (const id in ENEMY_TYPES)
  if (ENEMY_TYPES[id].faction === undefined) ENEMY_TYPES[id].faction = null;

/** The neutral machine host every world faces. Named here because the dossier
    and the codex both label a creature with whoever fields it. */
const MACHINE_HOST = { id: 'vigil', name: 'THE VIGIL', short: 'Vigil',
                       icon: '\u2735', color: '#94a3b8' };

/** Enemy ids each power fields, lightest first -- which is also the order a
    battle roster introduces them in. Derived, so a new unit joins its army by
    carrying a `faction` and nothing else. */
const FACTION_ENEMIES = {};
for (const f of FACTION_ORDER) FACTION_ENEMIES[f] = [];
for (const id in ENEMY_TYPES) {
  const f = ENEMY_TYPES[id].faction;
  if (f && FACTION_ENEMIES[f]) FACTION_ENEMIES[f].push(id);
}
for (const f in FACTION_ENEMIES)
  FACTION_ENEMIES[f].sort((a, b) => ENEMY_TYPES[a].hp - ENEMY_TYPES[b].hp);

/**
 * Who has troops on THIS world. Holding a world on paper is not the same as
 * standing on it: only a commander's own seat, a fortress, a pirate nest or a
 * world two powers already contest carries a garrison -- roughly a third of a
 * galaxy, which is the owner's "some planets" rather than every planet.
 * Everywhere else the Vigil marches alone.
 *
 * This is WORLD state, not a side's lever. Both commanders face the identical
 * wave drawn from the identical roster, exactly as they always have.
 */
function battleHostFaction(opts) {
  if (!opts) return null;
  /* The SAME substitution generateGalaxy makes for a world's OWNER, applied to
     the troops standing on it. Fixing the owner alone does not reach here: a
     nest's garrison is keyed to the world KIND, not to who holds the world, so
     naming the pirates outright left a PIRATE player's own soldiers marching in
     the wave against them on every nest in the galaxy. MEASURED over 200
     galaxies x 4 factions: worlds garrisoned by the player's OWN troops fall
     15.3% -> 8.1% with the owner fix alone, and 8.1% -> 0.0% with this. The
     rule is generateGalaxy's rule verbatim, which is the point -- two sites
     that name the squatter independently are how they came to disagree.
     Non-pirate profiles resolve 'pirate' exactly as before, so every other
     faction's rosters are byte-identical. */
  const me = opts.faction ||
             ((typeof Meta !== 'undefined' && Meta.faction) ? Meta.faction() : null);
  if (opts.worldKind === 'nest') return me === 'pirate' ? 'xeno' : 'pirate';
  if (opts.seat || opts.contested || opts.worldKind === 'fortress')
    return opts.rivalFaction || null;
  return null;
}

/* --------------------------------------------------------------------------
   TOWER TECH ORIGINS

   Who BUILT the thing. Sits here rather than in config.js because an origin
   borrows the faction palette wholesale -- one colour per power, and nowhere
   in the UI may an origin chip disagree with the crest beside it.

   `gated` is the soul-shop rule, and it is a DECISION worth stating:

     LIGHT, XENO and PIRATE hardware may only be bought while you are sworn to
     that power. Their arsenals are the point of swearing.

     HUMAN and ROBOTIC are open to everyone, permanently. Robotic because it is
     nobody's -- the machines reverse-engineered all four powers and every one
     of them buys the results back. Human for the same reason humanity survives
     at all: its hardware is built to take anybody's parts, which makes it the
     galaxy's common currency rather than one power's secret. The practical
     half decides it either way -- STARTER_TOWERS is human, so gating human
     would brick a fresh Federation, Xeno or Pirate profile on its very first
     purchase.

   Anything ALREADY unlocked stays unlocked. Gating decides what may be BOUGHT,
   never what you own.
-------------------------------------------------------------------------- */
const TOWER_ORIGINS = {
  human: {
    id: 'human', faction: 'human', gated: false,
    name: 'HUMAN', short: 'Human', icon: '⌖', color: '#38e8ff',
    tag: 'PROVEN',
    rule: 'ADAPTIVE MOUNTS',
    desc: 'Familiar hardware with no clause attached: the card is the number. ' +
          'The only origin that covers every element, and the only one that ' +
          'attunes to a terrain node of ANY element rather than a matched one.'
  },
  light: {
    id: 'light', faction: 'light', gated: true,
    name: 'FEDERATION', short: 'Federation', icon: '☀', color: '#fbbf24',
    tag: 'NULLIFYING',
    rule: 'SUPPRESSION',
    desc: 'Federation science does not out-shoot anything. It holds a target\'s ' +
          'protections open — armour aside, every resistance it has is worth ' +
          'less for a few seconds — and it cannot itself be jammed or sabotaged.'
  },
  xeno: {
    id: 'xeno', faction: 'xeno', gated: true,
    name: 'XENO', short: 'Xeno', icon: '⬢', color: '#7c3aed',
    tag: 'PUNISHING',
    rule: 'PUNISH',
    desc: 'Grows on wounds. Every hit carries a rider that scales off how ' +
          'hurt the target already is — nothing against a fresh enemy, ' +
          'considerable against one that is nearly finished.'
  },
  pirate: {
    id: 'pirate', faction: 'pirate', gated: true,
    name: 'PIRATE', short: 'Pirate', icon: '☠', color: '#ef4444',
    tag: 'VOLATILE',
    rule: 'OVERLOAD',
    desc: 'Junkyard work with the governors removed. Strikes sometimes ' +
          'overload for far more than they should, and the heat that builds ' +
          'takes the gun offline when the bank finally fills.'
  },
  /* `gated: false` and `story: true` are not in tension. GATED is about which
     banner may hold the hardware, and the machines answer to nobody -- which
     is exactly why AI.rivalArsenal must keep seeing them as legal to every
     rival. STORY is about how you come by it: conquest, never souls. */
  robotic: {
    id: 'robotic', faction: null, gated: false, story: true,
    name: 'ROBOTIC', short: 'Robotic', icon: '⬡', color: '#94a3b8',
    tag: 'LATTICE',
    rule: 'LATTICE',
    desc: 'Everyone else\'s weapons, rebuilt without the flourishes. No proc, ' +
          'no gamble, nothing conditional — instead machines placed within ' +
          'reach of each other form a lattice and every link pays.'
  }
};

const ORIGIN_ORDER = ['human', 'light', 'xeno', 'pirate', 'robotic'];

/** The origin record for a tower id, never null -- an unlabelled def reads as
    human, which is the baseline every other origin is a departure from. */
function originOf(id) {
  const def = TOWER_TYPES[id];
  return TOWER_ORIGINS[(def && def.origin) || 'human'] || TOWER_ORIGINS.human;
}

/* --------------------------------------------------------------------------
   PRESTIGE — the stacking flat bonus a commander earns per prestige star,
   keyed by their faction. CADRE is unaligned and inherits the profile's.
-------------------------------------------------------------------------- */
const PRESTIGE_BONUS = {
  human:  { desc: '+4 maximum lives per star',
            apply: (s, n) => { s.maxLives += 4 * n; s.lives += 4 * n; } },
  light:  { desc: '+4% tower damage per star',
            apply: (s, n) => { s.mods.damage += 0.04 * n; } },
  xeno:   { desc: 'reanimates +8% stronger per star',
            apply: (s, n) => { s.mods.reanim *= (1 + 0.08 * n); } },
  pirate: { desc: '+' + sqGold(120) + ' starting gold per star',
            apply: (s, n) => { s.gold += sqGold(120) * n; } }
};
function applyPrestigeBonus(side, factionId, stars) {
  if (!stars) return;
  (PRESTIGE_BONUS[factionId] || PRESTIGE_BONUS.human).apply(side, stars);
}

/** Colour for a side, used by the renderer and the HUD. */
function sideColor(side) {
  const f = Game.sides && Game.sides[side] && Game.sides[side].faction;
  return (f && FACTIONS[f] ? FACTIONS[f].color : (side === 0 ? '#38e8ff' : '#ff6b9d'));
}

/** `sideColor` at a given alpha, for the washes and glows that lie under a
    seat rather than on it. */
/* Every one of those sites open-coded the two-sided pair, so on a tri board
   the third seat's ground and base glow were painted in the SECOND seat's
   rose, and on a duel the glow disagreed with the faction ring drawn on top
   of it whenever the player was not human. Both now derive from the one
   definition. It reads Game.sides, so it must not be called from a preview
   renderer holding a throwaway sides array. BATCH-C/nside */
function sideRgba(side, alpha) {
  const c = sideColor(side).replace('#', '');
  return 'rgba(' + parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) +
         ',' + parseInt(c.slice(4, 6), 16) + ',' + alpha + ')';
}

/* --------------------------------------------------------------------------
   LORE CODEX ENTRIES — shown in the Field Manual and on the faction screen.
-------------------------------------------------------------------------- */
const LORE = [
  { id: 'integration', title: 'The Integration',
    body: 'It did not arrive as invasion or as rescue. First contact was a trade ' +
          'delegation, and within a generation human cities carried alien districts, ' +
          'human ships carried alien drives, and human soldiers carried weapons no ' +
          'human had designed. The galaxy, it turned out, had been busy for a very ' +
          'long time. Humanity was simply the last to be told.' },
  { id: 'expansion', title: 'The Expansion',
    body: 'New-age technology made the jump between worlds a matter of days. What ' +
          'followed was not exploration but a land rush — every power that could ' +
          'reach a world began taking worlds, and every world taken had to be held ' +
          'against whatever arrived next.' },
  { id: 'vigil', title: 'The Vigil',
    body: 'Someone built machines to protect the galaxy, a very long time before ' +
          'the Integration, and then stopped answering them. They are still ' +
          'working. A Vigil host is semi-sentient — enough to patrol, plan and ' +
          'repair itself, nowhere near enough to tell a Federation garrison from ' +
          'a Xeno hive — so it defends every world it finds from everyone standing ' +
          'on it, the inhabitants included. When it comes it comes for both ' +
          'commanders at once, down the same corridor, in the same numbers. ' +
          'Whoever kills it faster decides where the wreckage walks next.' },
  { id: 'garrisons', title: 'Garrisons',
    body: 'Most worlds are held on paper: a flag, a claim, and nobody on the ' +
          'ground. A commander’s own seat, a fortress world, a pirate nest and ' +
          'any world two powers are already contesting are the exceptions — ' +
          'those have real troops standing on them, and when the Vigil arrives ' +
          'those troops march in the same wave, at the same two commanders. ' +
          'Nothing out there is fighting for you.' },
  { id: 'reanimation', title: 'Reanimation Protocol',
    body: 'Integration-era salvage tech can restart a nervous system that has been ' +
          'dead for under a minute. It cannot do it twice. So every commander fields ' +
          'the same grim arithmetic: what you kill gets back up, walks your own lane ' +
          'in reverse, and keeps walking until it reaches your rival’s door. ' +
          'What dies on that second trip stays dead.' },
  { id: 'conquest', title: 'Conquest',
    body: 'A world is not yours because you survived on it. It is yours when you have ' +
          'taken it cleanly — three stars, no ground given. Hold enough worlds and the ' +
          'system is yours. Hold every system and the galaxy is.' }
];
