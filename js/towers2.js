/* ==========================================================================
   COSMIC CONQUEST, Expansion Pack
   --------------------------------------------------------------------------
   The elemental system, twenty-two additional towers (each built on a verb no
   other tower uses), the campaign arena modifiers and campaign boons.
   Loaded after config.js; merges into TOWER_TYPES / TOWER_ORDER.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   ELEMENTS
   Five marking elements. A tower's hit leaves its element's MARK on the
   target for four seconds; a hit from a DIFFERENT element consumes the mark
   and triggers the combo. Kinetic and Radiant towers are non-elemental
   they neither mark nor trigger, which keeps pure-physical boards honest.
-------------------------------------------------------------------------- */
const ELEMENTS = {
  kinetic: { name: 'KINETIC', color: '#9fb6c9', icon: '◆', marks: false },
  radiant: { name: 'RADIANT', color: '#fde68a', icon: '✦', marks: false },
  fire:    { name: 'FIRE',    color: '#ff6b4a', icon: '🔥', marks: true },
  frost:   { name: 'FROST',   color: '#8ab8ff', icon: '❄', marks: true },
  storm:   { name: 'STORM',   color: '#c084fc', icon: '⚡', marks: true },
  venom:   { name: 'VENOM',   color: '#a3e635', icon: '☠', marks: true },
  void:    { name: 'VOID',    color: '#818cf8', icon: '◐', marks: true }
};

/** Combo table: COMBOS[markElement][hitElement] → effect. */
const COMBOS = {
  fire: {
    frost: { id:'thermal',  name:'THERMAL SHOCK', desc:'Burst of pure damage (2.2x the triggering hit).' },
    storm: { id:'plasma',   name:'PLASMA',        desc:'Small explosion around the target (1.4x hit).' },
    venom: { id:'immolate', name:'IMMOLATE',      desc:'Venom stacks ignite into a heavy burn.' },
    void:  { id:'entropy',  name:'ENTROPY',       desc:'Statuses on the target last longer; +15% damage taken.' }
  },
  frost: {
    fire:  { id:'thermal',  name:'THERMAL SHOCK', desc:'Burst of pure damage (2.2x the triggering hit).' },
    storm: { id:'superconduct', name:'SUPERCONDUCT', desc:'Strips 12 armour for 6 seconds.' },
    venom: { id:'paralysis',name:'PARALYSIS',     desc:'Freezes the target solid for 0.7s.' },
    void:  { id:'entropy',  name:'ENTROPY',       desc:'Statuses on the target last longer; +15% damage taken.' }
  },
  storm: {
    fire:  { id:'plasma',   name:'PLASMA',        desc:'Small explosion around the target (1.4x hit).' },
    frost: { id:'superconduct', name:'SUPERCONDUCT', desc:'Strips 12 armour for 6 seconds.' },
    venom: { id:'catalyse', name:'CATALYSE',      desc:'Target takes +25% damage for 3 seconds.' },
    void:  { id:'entropy',  name:'ENTROPY',       desc:'Statuses on the target last longer; +15% damage taken.' }
  },
  venom: {
    fire:  { id:'immolate', name:'IMMOLATE',      desc:'Venom stacks ignite into a heavy burn.' },
    frost: { id:'paralysis',name:'PARALYSIS',     desc:'Freezes the target solid for 0.7s.' },
    storm: { id:'catalyse', name:'CATALYSE',      desc:'Target takes +25% damage for 3 seconds.' },
    void:  { id:'entropy',  name:'ENTROPY',       desc:'Statuses on the target last longer; +15% damage taken.' }
  },
  /* Void used to answer every partner with the same ENTROPY, which made a
     third of the marking roster read as one interaction wearing four names. */
  void: {
    fire:  { id:'collapse', name:'COLLAPSE',      desc:'The mark implodes for heavy pure damage.' },
    frost: { id:'entropy',  name:'ENTROPY',       desc:'Statuses on the target last longer; +15% damage taken.' },
    storm: { id:'rupture',  name:'RUPTURE',       desc:'Armour is torn open and the target is pinned.' },
    venom: { id:'blight',   name:'BLIGHT',        desc:'Venom on the target doubles and spreads to one neighbour.' }
  }
};

/* --------------------------------------------------------------------------
   TWENTY-TWO NEW TOWERS
   Same schema as config.js. `glyph` drives the shared turret rendering so the
   expansion does not need sixteen bespoke sprites.
-------------------------------------------------------------------------- */
const TOWER_TYPES_2 = {

  foundry: {
    id:'foundry', element: 'fire', origin:'robotic', name:'FOUNDRY', role:'Spawns fighting minions', cost:300, costGrowth:1.78,
    color:'#f9a8d4', dark:'#6d2044', attack:'minions', glyph:'⚒',
    desc:'Forges automata that march onto the lane, grapple the first enemy they meet and grind it down. The only structure that fights with BODIES instead of fire. It is fed by what they kill: every corpse its automata put down goes straight back onto the belt, so a Foundry that is LOSING bodies replaces them markedly faster than one standing idle, and one dropped into a lane already lost never gets started. LATE-GAME by design.',
    base:{ range:3.4, dmgType:'physical', minions:2, minionHp:40, minionDps:9, minionSlow:0.4, forgeTime:6, scrapline:1.1 },
    levels:[ { cost:170, name:'ASSEMBLY', mods:{ minions:3, minionHp:67, minionDps:15, scrapline:1.4 } },
             { cost:340, name:'WARPLANT', mods:{ minions:4, minionHp:107, minionDps:24, forgeTime:5, scrapline:1.8 } } ],
    talents:[
      { id:'fy_alloy', row:0, col:0, name:'HARD ALLOY',  desc:'+60% minion health.',       mods:{ minionHpMul:1.60 } },
      { id:'fy_blade', row:0, col:1, name:'EDGE BLADES', desc:'+50% minion damage.',       mods:{ minionDpsMul:1.50 } },
      { id:'fy_fast',  row:1, col:0, name:'FAST FORGE',  desc:'Forges 35% faster, and reclaims 0.8s more per kill.', mods:{ forgeTimeMul:0.65, scrapline:0.8 } },
      { id:'fy_grip',  row:1, col:1, name:'VICE GRIP',   desc:'Minion grapple slow +25%.', mods:{ minionSlow:0.25 } },
      { id:'fy_more',  row:2, col:0, name:'TWIN LINES',  desc:'+1 minion.',                mods:{ minions:1 } },
      { id:'fy_burst', row:2, col:1, name:'CORE BREACH', desc:'Dying minions explode for 3x their DPS.', mods:{ minionBlast:3 } } ],
    branches:[
      { id:'legion',    name:'LEGION',    cost:420, mods:{ minions:7, minionHp:113, minionDps:26, forgeTime:3.2, scrapline:1.0 },
        surge:{ minions:1 }, note:'Forges minions every 3.2s, up to 7 at 113 health, 26 dps; kills reclaim 1s of forge.' },
      { id:'champions', name:'CHAMPIONS', cost:420, mods:{ minions:2, minionHp:567, minionDps:85, minionSlow:0.75, forgeTime:7, scrapline:3.2 },
        surge:{ minionHp:147, minionDps:22 }, note:'Two 567-health minions dealing 85 dps and slowing 75%; each kill reclaims 3.2s of forge.' } ]
  },

  saboteur: {
    id:'saboteur', element: 'venom', origin:'pirate', name:'SABOTEUR', role:'Disables RIVAL towers', cost:290, costGrowth:1.85,
    color:'#94a3b8', dark:'#1e293b', attack:'sabotage', glyph:'⚡',
    desc:'Fires nothing at enemies. Instead it reaches across the field and periodically knocks a RIVAL tower offline: the only structure that attacks your opponent\'s board directly.',
    base:{ range:99, dmgType:'none', sabotageEvery:11, sabotageDur:3.0, sabotageTargets:1 },
    levels:[ { cost:200, name:'INFILTRATOR', mods:{ sabotageEvery:9, sabotageDur:3.6 } },
             { cost:360, name:'SPYMASTER',  mods:{ sabotageEvery:8, sabotageDur:4.2 } } ],
    talents:[
      { id:'sb_fast', row:0, col:0, name:'QUICK WORK',  desc:'Strikes 25% more often.',       mods:{ sabotageEveryMul:0.75 } },
      { id:'sb_long', row:0, col:1, name:'DEEP COVER',  desc:'Disables last 30% longer.',     mods:{ sabotageDurMul:1.30 } },
      { id:'sb_two',  row:1, col:0, name:'CELL NETWORK',desc:'+1 tower struck per operation.',mods:{ sabotageTargets:1 } },
      { id:'sb_rich', row:1, col:1, name:'EMBEZZLE',    desc:'Each strike steals 12 gold.',   mods:{ sabotageGold:12 } },
      { id:'sb_prio', row:2, col:0, name:'HIGH VALUE',  desc:'Jams the rival tower with the most gold invested.', mods:{ sabotagePriority:true } },
      { id:'sb_chain',row:2, col:1, name:'CASCADE',     desc:'Struck towers also lose 25% rate for 6s after.', mods:{ sabotageLinger:0.25 } } ],
    branches:[
      { id:'blackout', name:'BLACKOUT', cost:480, mods:{ sabotageEvery:6.5, sabotageDur:5.0, sabotageTargets:2 },
        surge:{ sabotageTargets:1 }, note:'Disables 2 rival towers for 5s, every 6.5s. Rolling darkness.' },
      { id:'ransom',   name:'RANSOM',   cost:480, mods:{ sabotageEvery:8, sabotageDur:3.8, sabotageGold:40 },
        surge:{ sabotageGold:15 }, note:'Disables a rival tower for 3.8s every 8s, stealing 5 gold per strike.' } ]
  },

  rampart: {
    id:'rampart', element:'kinetic', origin:'human', name:'RAMPART', role:'Projects a lane barricade', cost:200, costGrowth:1.60,
    color:'#d6bcfa', dark:'#3b2a5a', attack:'barricade', glyph:'▦',
    desc:'Raises a physical barricade across the lane. Ground enemies must stop and batter it down: but a wall holds only so many at once, and the rest squeeze past.',
    /* wallBlocks is how many attackers the wall can hold at one time. The
       overflow walks through, so a wall is throughput you can be swamped on
       rather than an absolute gate. */
    base:{ range:2.6, dmgType:'none', wallHp:210, wallRebuild:9, wallBlocks:3 },
    levels:[ { cost:150, name:'BULWARK',  mods:{ wallHp:400, wallRebuild:8, wallBlocks:4 } },
             { cost:290, name:'REDOUBT',  mods:{ wallHp:725, wallRebuild:7, wallBlocks:5 } } ],
    talents:[
      { id:'rp_stone', row:0, col:0, name:'GRANITE',   desc:'+50% barricade health.',           mods:{ wallHpMul:1.50 } },
      { id:'rp_quick', row:0, col:1, name:'PREFAB',    desc:'Rebuilds 30% faster.',             mods:{ wallRebuildMul:0.70 } },
      { id:'rp_spike', row:1, col:0, name:'SPIKES',    desc:'Attackers take 12 damage per second.', mods:{ wallThorns:12 } },
      { id:'rp_wide',  row:1, col:1, name:'LONG WALL', desc:'+35% placement reach.',            mods:{ rangeMul:1.35 } },
      { id:'rp_deep',  row:1, col:2, name:'DEEP RANKS', desc:'The wall holds 2 more attackers at once.', mods:{ wallBlocks:2 } },
      { id:'rp_iron',  row:2, col:0, name:'IRONBOUND', desc:'+70% barricade health.',           mods:{ wallHpMul:1.70 } },
      { id:'rp_alarm', row:2, col:1, name:'ALARM NET', desc:'Enemies at the wall take +20% damage from all towers.', mods:{ wallVuln:0.20 } } ],
    branches:[
      { id:'citadel', name:'CITADEL', cost:380, mods:{ wallHp:1900, wallRebuild:7, wallThorns:35, wallBlocks:4 },
        surge:{ wallHp:450, wallThorns:10, wallBlocks:1 }, note:'One 1900-health wall holding 4 attackers; spikes deal 35/s; rebuilds in 7s. It bites back.' },
      { id:'phalanx', name:'PHALANX', cost:380, mods:{ wallHp:650, wallRebuild:5, walls:2, wallBlocks:2 },
        surge:{ wallHp:175 }, note:'Two 650-health walls, each holding 2 attackers; rebuilds in 5s. Depth over mass.' } ]
  },

  executioner: {
    id:'executioner', element:'void', origin:'xeno', name:'EXECUTIONER', role:'Culls weakened enemies', cost:270, costGrowth:1.74,
    color:'#fca5a5', dark:'#5f1616', attack:'projectile', glyph:'⚔',
    desc:'A heavy blade-thrower whose hits EXECUTE any non-elite enemy below a health threshold outright. It does not care how much health the target started with: only how little is left.',
    base:{ damage:11, range:3.4, rate:0.8, projSpeed:14, dmgType:'physical', execThreshold:0.10 },
    levels:[ { cost:190, name:'HEADSMAN', mods:{ damage:19, execThreshold:0.13 } },
             { cost:350, name:'ARBITER',  mods:{ damage:30, execThreshold:0.16, range:3.8 } } ],
    talents:[
      { id:'ex_edge',  row:0, col:0, name:'KEEN EDGE',   desc:'+40% damage.',                       mods:{ damageMul:1.40 } },
      { id:'ex_swift', row:0, col:1, name:'SWIFT VERDICT',desc:'+35% fire rate.',                   mods:{ rateMul:1.35 } },
      { id:'ex_deep',  row:1, col:0, name:'DEEP CUT',    desc:'+4% execution threshold.',           mods:{ execThreshold:0.04 } },
      { id:'ex_bounty',row:1, col:1, name:'HEAD PRICE',  desc:'Executions pay +50% bounty.',        mods:{ execBounty:0.5 } },
      { id:'ex_wide',  row:2, col:0, name:'LONG ARM',    desc:'+30% range.',                        mods:{ rangeMul:1.30 } },
      { id:'ex_dread', row:2, col:1, name:'DREAD',       desc:'Executions slow nearby enemies 30% for 2s.', mods:{ execFear:0.30 } } ],
    branches:[
      { id:'guillotine', name:'GUILLOTINE', cost:440, mods:{ damage:52, rate:0.9, execThreshold:0.24 },
        surge:{ execThreshold:0.02 }, note:'Executes non-bosses below 24% health; 52 damage at 0.9/s. The cull embodied.' },
      { id:'reaper',     name:'REAPER',     cost:440, mods:{ damage:44, rate:1.1, execThreshold:0.16, execBounty:1.2, execGold:8 },
        surge:{ execGold:5 }, note:'Executes non-bosses below 16% health; each execution pays +120% bounty plus 1 gold.' } ]
  },

  chrono: {
    id:'chrono', element: 'frost', origin:'light', name:'CHRONO', role:'Rewinds enemies through time', cost:250, costGrowth:1.70,
    color:'#93c5fd', dark:'#1e3a5f', attack:'chrono', glyph:'⧖',
    desc:'Snaps every enemy in range back to where it was seconds ago. The faster a target moves, the further it is thrown back: the definitive answer to Sprinters and Heralds.',
    base:{ damage:6, range:3.0, rate:0.2, dmgType:'magic', rewindSec:2.2 },
    levels:[ { cost:180, name:'HOURGLASS', mods:{ damage:11, rewindSec:2.8 } },
             { cost:330, name:'EPOCH',     mods:{ damage:18, rewindSec:3.4, range:3.4 } } ],
    talents:[
      { id:'ch_deep', row:0, col:0, name:'DEEP REWIND', desc:'+30% rewind distance.',           mods:{ rewindSecMul:1.30 } },
      { id:'ch_fast', row:0, col:1, name:'FAST CYCLE',  desc:'Pulses 30% more often.',          mods:{ rateMul:1.30 } },
      { id:'ch_wide', row:1, col:0, name:'DILATION FIELD', desc:'+30% radius.',                 mods:{ rangeMul:1.30 } },
      { id:'ch_wear', row:1, col:1, name:'TIME WEAR',   desc:'Rewound enemies take +15% damage for 3s.', mods:{ rewindVuln:0.15 } },
      { id:'ch_still',row:2, col:0, name:'STILLFRAME',  desc:'Rewound enemies are held 0.4s.',  mods:{ rewindHold:0.4 } },
      { id:'ch_echo', row:2, col:1, name:'DOUBLE EXPOSURE', desc:'20% chance to rewind twice.', mods:{ rewindTwice:0.20 } } ],
    branches:[
      { id:'well',    name:'TEMPORAL WELL', cost:420, mods:{ damage:26, rewindSec:4.6, range:3.8, rewindHold:0.5 },
        surge:{ rewindSec:0.5 }, note:'Rewinds enemies 4.6s down the lane, holding them 0.5s on arrival; 26 damage.' },
      { id:'paradox', name:'PARADOX',       cost:420, mods:{ damage:34, rewindSec:3.2, rewindVuln:0.35, rate:0.24 },
        surge:{ rewindVuln:0.06 }, note:'Rewinds enemies 3.2s of travel; rewound targets take 35% more damage for 3s.' } ]
  },

  echo: {
    id:'echo', element: 'storm', origin:'robotic', name:'ECHO', role:'Repeats neighbouring attacks', cost:260, costGrowth:1.76,
    color:'#fda4af', dark:'#5f1f2e', attack:'echo', glyph:'≋',
    desc:'Has no weapon of its own. It listens to adjacent towers and REPEATS their strikes at reduced power: worth more the stronger the company it keeps.',
    base:{ range:3.2, echoRange:2.0, rate:0.7, dmgType:'none', echoFrac:0.55 },
    levels:[ { cost:190, name:'REVERB',   mods:{ echoFrac:0.7, rate:0.8 } },
             { cost:350, name:'RESOUND',  mods:{ echoFrac:0.85, rate:0.9, echoRange:2.4 } } ],
    talents:[
      { id:'ec_loud', row:0, col:0, name:'AMPLIFY',   desc:'+20% echo power.',            mods:{ echoFrac:0.20 } },
      { id:'ec_fast', row:0, col:1, name:'QUICK EAR', desc:'+30% echo rate.',             mods:{ rateMul:1.30 } },
      { id:'ec_far',  row:1, col:0, name:'LONG EAR',  desc:'Listens 40% further.',        mods:{ echoRangeMul:1.40 } },
      { id:'ec_reach',row:1, col:1, name:'PROJECTION',desc:'+30% strike range.',          mods:{ rangeMul:1.30 } },
      { id:'ec_two',  row:2, col:0, name:'STEREO',    desc:'Echoes the 2 strongest towers in earshot each strike.',  mods:{ echoCount:1 } },
      { id:'ec_pure', row:2, col:1, name:'CLARITY',   desc:'Echoes ignore 30% of armour.',mods:{ pierce:0.30 } } ],
    branches:[
      { id:'chorus',    name:'CHORUS',    cost:430, mods:{ echoFrac:0.75, echoCount:2, rate:1.0, echoRange:2.8 },
        surge:{ echoCount:1 }, note:'Repeats 3 neighbouring towers\' hits at 75% power, every second, within 2.8 tiles.' },
      { id:'resonance', name:'RESONANCE', cost:430, mods:{ echoFrac:1.35, rate:0.8 },
        surge:{ echoFrac:0.15 }, note:'Repeats the strongest neighbour\'s hit at 135% power, 0.8 times a second. Louder than the original.' } ]
  },

  quake: {
    id:'quake', element:'kinetic', origin:'robotic', name:'QUAKE', role:'Global ground slam', cost:320, costGrowth:1.80,
    color:'#d4a373', dark:'#4a2e14', attack:'quake', glyph:'⌗',
    desc:'Hammers the earth itself. Every ground enemy on YOUR ENTIRE SIDE takes the hit, wherever it stands: the only weapon with no range at all.',
    base:{ damage:8, rate:0.16, range:2.0, dmgType:'physical', stagger:0.25 },
    levels:[ { cost:210, name:'TREMOR',   mods:{ damage:14, rate:0.18 } },
             { cost:390, name:'FAULTLINE',mods:{ damage:23, rate:0.20, stagger:0.35 } } ],
    talents:[
      { id:'qk_heavy', row:0, col:0, name:'DEEP DRIVE', desc:'+40% damage.',                mods:{ damageMul:1.40 } },
      { id:'qk_often', row:0, col:1, name:'RHYTHM',     desc:'Slams 25% more often.',       mods:{ rateMul:1.25 } },
      { id:'qk_stun',  row:1, col:0, name:'CONCUSSION', desc:'+0.2s stagger.',              mods:{ stagger:0.2 } },
      { id:'qk_shred', row:1, col:1, name:'FISSURE',    desc:'Slams strip 4 armour.',       mods:{ shred:4 } },
      { id:'qk_big',   row:2, col:0, name:'MAGNITUDE',  desc:'+50% damage.',                mods:{ damageMul:1.50 } },
      { id:'qk_after', row:2, col:1, name:'AFTERSHOCK', desc:'A second slam at 40% power follows.', mods:{ aftershock:0.4 } } ],
    branches:[
      { id:'epicenter', name:'EPICENTER', cost:500, mods:{ damage:44, rate:0.2, epicenter:2.5, range:3.5 },
        surge:{ damage:10 }, note:'Slams all ground enemies for 44 every 5s; ×2.5 damage within 3.5 tiles.' },
      { id:'cataclysm', name:'CATACLYSM', cost:500, mods:{ damage:34, rate:0.22, aftershock:0.6, stagger:0.5 },
        surge:{ aftershock:0.1 }, note:'Field-wide slam for 34, staggering 0.5s; an aftershock at 60% power follows.' } ]
  },

  siren: {
    id:'siren', element:'void', origin:'xeno', name:'SIREN', role:'Converts enemies to your side', cost:350, costGrowth:1.98,
    color:'#f0abfc', dark:'#5b1d66', attack:'siren', glyph:'♆',
    desc:'Sings a single enemy out of the assault entirely: it vanishes from your lane and marches on the RIVAL as one of yours. The strongest recruit it can hold, every cooldown.',
    base:{ range:3.6, dmgType:'none', charmEvery:18, charmMaxHp:180 },
    levels:[ { cost:240, name:'ALLURE',  mods:{ charmEvery:15, charmMaxHp:440 } },
             { cost:450, name:'COMMAND', mods:{ charmEvery:13, charmMaxHp:1040 } } ],
    talents:[
      { id:'si_song', row:0, col:0, name:'LONG SONG',  desc:'Charm capacity +60%.',        mods:{ charmMaxHpMul:1.60 } },
      { id:'si_fast', row:0, col:1, name:'QUICK VERSE',desc:'Charms 20% more often.',      mods:{ charmEveryMul:0.80 } },
      { id:'si_far',  row:1, col:0, name:'CARRYING CRY',desc:'+35% range.',                mods:{ rangeMul:1.35 } },
      { id:'si_iron', row:1, col:1, name:'IRON WILL',  desc:'Converts arrive with +40% health.', mods:{ charmHpBonus:0.40 } },
      { id:'si_deep', row:2, col:0, name:'DEEP TRANCE',desc:'Capacity +80%.',              mods:{ charmMaxHpMul:1.80 } },
      { id:'si_gold', row:2, col:1, name:'SPOILS',     desc:'Each convert pays 25 gold.',  mods:{ charmGold:25 } } ],
    branches:[
      { id:'choir',    name:'CHOIR',    cost:560, mods:{ charmEvery:8.5, charmMaxHp:1400 },
        surge:{ charmEveryMul:0.94 }, note:'Converts an enemy of up to 1400 health every 8.5s. A constant recruiting drive.' },
      { id:'dominion', name:'DOMINION', cost:560, mods:{ charmEvery:14, charmMaxHp:3200, charmHpBonus:0.6 },
        surge:{ charmMaxHpMul:1.25 }, note:'Charms enemies of up to 3200 health every 14s; they arrive with +60% health.' } ]
  },

  alchemist: {
    id:'alchemist', element: 'venom', origin:'xeno', name:'ALCHEMIST', role:'Grows stronger with every kill', cost:280, costGrowth:1.76,
    color:'#fbbf24', dark:'#5c4008', attack:'projectile', glyph:'⚗',
    desc:'Transmutes death into power. Every kill inside its circle adds a PERMANENT grain of damage to its shot: the only tower with no ceiling that money cannot buy.',
    base:{ damage:7, range:3.3, rate:1.0, projSpeed:12, dmgType:'magic', transmute:0.6 },
    levels:[ { cost:200, name:'ADEPT',  mods:{ damage:12, transmute:1.0 } },
             { cost:370, name:'MAGNUS', mods:{ damage:19, transmute:1.6, range:3.6 } } ],
    talents:[
      { id:'al_grain', row:0, col:0, name:'RICH GRAIN', desc:'+40% per-kill gain.',        mods:{ transmuteMul:1.40 } },
      { id:'al_base',  row:0, col:1, name:'STRONG BASE',desc:'+40% base damage.',          mods:{ damageMul:1.40 } },
      { id:'al_wide',  row:1, col:0, name:'WIDE CIRCLE',desc:'+30% radius.',               mods:{ rangeMul:1.30 } },
      { id:'al_fast',  row:1, col:1, name:'CATALYST',   desc:'+30% fire rate.',            mods:{ rateMul:1.30 } },
      { id:'al_gold',  row:2, col:0, name:'GOLD TINCT', desc:'Kills in circle pay +2 gold.',mods:{ transGold:2 } },
      { id:'al_burst', row:2, col:1, name:'UNSTABLE MIX',desc:'Shots splash 0.8 tiles.',   mods:{ splash:0.8 } } ],
    branches:[
      { id:'midas',      name:'MIDAS',       cost:460, mods:{ damage:26, transmute:2.0, transGold:4 },
        surge:{ transGold:2 }, note:'Each death in range adds 2 permanent damage and pays 1 gold.' },
      { id:'philosopher',name:'PHILOSOPHER', cost:460, mods:{ damage:22, transmute:4.5, rate:1.1 },
        surge:{ transmute:1.2 }, note:'Each death in range adds 4.5 permanent damage. Growth without limit.' } ]
  },

  glaive: {
    id:'glaive', element:'kinetic', origin:'pirate', name:'GLAIVE', role:'Boomerang along the lane', cost:220, costGrowth:1.58,
    color:'#a5f3fc', dark:'#164e63', attack:'glaive', glyph:'↺',
    desc:'Hurls a whirling blade that follows the LANE itself: out along the path and back again, cutting everything it passes twice.',
    base:{ damage:9, range:3.0, rate:0.5, dmgType:'physical', glaiveTiles:7, glaiveSpeed:9 },
    levels:[ { cost:160, name:'TWIN ARC', mods:{ damage:16, glaiveTiles:9 } },
             { cost:300, name:'FARBLADE', mods:{ damage:25, glaiveTiles:11, glaiveSpeed:11 } } ],
    talents:[
      { id:'gl_sharp', row:0, col:0, name:'RAZOR EDGE', desc:'+40% damage.',             mods:{ damageMul:1.40 } },
      { id:'gl_quick', row:0, col:1, name:'DEFT THROW', desc:'+30% throw rate.',         mods:{ rateMul:1.30 } },
      { id:'gl_far',   row:1, col:0, name:'LONG FLIGHT',desc:'Travels 4 tiles further.', mods:{ glaiveTiles:4 } },
      { id:'gl_heavy', row:1, col:1, name:'WEIGHTED',   desc:'Hits shred 3 armour.',     mods:{ shred:3 } },
      { id:'gl_speed', row:2, col:0, name:'SLIPSTREAM', desc:'+40% blade speed.',        mods:{ glaiveSpeedMul:1.40 } },
      { id:'gl_twin',  row:2, col:1, name:'SECOND BLADE',desc:'Keeps 2 glaives in flight at once.', mods:{ glaives:1 } } ],
    branches:[
      { id:'twinblade', name:'TWINBLADE', cost:360, mods:{ damage:34, glaives:2, rate:0.6 },
        surge:{ glaives:1 }, note:'Three glaives aloft at once, each hitting for 34 outbound and returning.' },
      { id:'scythe',    name:'SCYTHE',    cost:360, mods:{ damage:68, glaiveTiles:14, glaiveWidth:1.1 },
        surge:{ damage:16 }, note:'One glaive flying 14 tiles in a 1.1-tile swath, hitting for 68 each pass.' } ]
  },

  cyclone: {
    id:'cyclone', element:'storm', origin:'pirate', name:'CYCLONE', role:'Hurls enemies skyward', cost:240, costGrowth:1.64,
    color:'#7dd3fc', dark:'#0c4a6e', attack:'cyclone', glyph:'๑',
    desc:'Whips up a vortex that flings ground enemies into the air: held helpless, then dropped for impact damage. Elites are too heavy to lift.',
    base:{ damage:9, range:2.8, rate:0.3, dmgType:'magic', liftDur:0.9, dropDmg:14 },
    levels:[ { cost:170, name:'GALE',  mods:{ damage:15, dropDmg:26 } },
             { cost:320, name:'VORTEX',mods:{ damage:24, dropDmg:42, liftDur:1.1, range:3.1 } } ],
    talents:[
      { id:'cy_high', row:0, col:0, name:'HIGH TOSS',  desc:'+30% lift duration.',       mods:{ liftDurMul:1.30 } },
      { id:'cy_hard', row:0, col:1, name:'HARD LANDING',desc:'+50% drop damage.',        mods:{ dropDmgMul:1.50 } },
      { id:'cy_wide', row:1, col:0, name:'WIDE FUNNEL', desc:'+30% radius.',             mods:{ rangeMul:1.30 } },
      { id:'cy_often',row:1, col:1, name:'SQUALL',      desc:'Pulses 25% more often.',   mods:{ rateMul:1.25 } },
      { id:'cy_scatter',row:2,col:0, name:'CROSSWIND',  desc:'Dropped enemies land 0.8 tiles back.', mods:{ dropBack:0.8 } },
      { id:'cy_charge',row:2,col:1, name:'STATIC CHARGE',desc:'Lifted enemies take +20% damage.', mods:{ liftVuln:0.20 } } ],
    branches:[
      { id:'maelstrom', name:'MAELSTROM', cost:390, mods:{ damage:34, range:3.6, liftDur:1.4, dropDmg:60 },
        surge:{ liftDur:0.1 }, note:'Lifts non-bosses 1.4s for 34 damage, then 60 more on the drop. A standing storm.' },
      { id:'downburst', name:'DOWNBURST', cost:390, mods:{ damage:28, dropDmg:150, liftDur:0.8, rate:0.34 },
        surge:{ dropDmg:35 }, note:'Lifts enemies 0.8s for 28, then 150 on the drop. What rises falls hard.' } ]
  },

  capacitor: {
    id:'capacitor', element:'storm', origin:'pirate', name:'CAPACITOR', role:'Banks charge, releases a nova', cost:230, costGrowth:1.62,
    color:'#fde047', dark:'#4d3f07', attack:'capacitor', glyph:'◉',
    desc:'Charges while the lane is quiet and detonates the entire bank the moment enemies arrive. Peace itself becomes ammunition.',
    base:{ range:2.9, dmgType:'magic', chargeRate:11, chargeMax:168, novaMin:60 },
    levels:[ { cost:170, name:'HIGH CELL', mods:{ chargeRate:20, chargeMax:360 } },
             { cost:320, name:'MEGACELL',  mods:{ chargeRate:34, chargeMax:760, range:3.2 } } ],
    talents:[
      { id:'cp_rate', row:0, col:0, name:'FAST CHARGE', desc:'+40% charge rate.',        mods:{ chargeRateMul:1.40 } },
      { id:'cp_bank', row:0, col:1, name:'DEEP BANK',   desc:'+50% capacity.',           mods:{ chargeMaxMul:1.50 } },
      { id:'cp_wide', row:1, col:0, name:'WIDE ARC',    desc:'+30% nova radius.',        mods:{ rangeMul:1.30 } },
      { id:'cp_keep', row:1, col:1, name:'RESIDUAL',    desc:'Keeps 25% charge after a nova.', mods:{ novaKeep:0.25 } },
      { id:'cp_over', row:2, col:0, name:'OVERCHARGE',  desc:'+60% capacity.',           mods:{ chargeMaxMul:1.60 } },
      { id:'cp_stun', row:2, col:1, name:'EMP',         desc:'Full-bank novas stun 0.5s.',mods:{ novaStun:0.5 } } ],
    branches:[
      { id:'supercell', name:'SUPERCELL', cost:390, mods:{ chargeRate:55, chargeMax:2080, range:3.8 },
        surge:{ chargeMaxMul:1.2 }, note:'Banks 55 charge a second, up to 2080, then releases it all as a nova.' },
      { id:'flashbank', name:'FLASHBANK', cost:390, mods:{ chargeRate:95, chargeMax:800, novaKeep:0.35 },
        surge:{ chargeRateMul:1.15 }, note:'Charges 95 a second toward an 800 cap; keeps 35% after each nova.' } ]
  },

  shepherd: {
    id:'shepherd', element:'radiant', origin:'light', name:'SHEPHERD', role:'Empowers your reanimates', cost:270, costGrowth:1.82,
    color:'#bef264', dark:'#365314', attack:'shepherd', glyph:'♱',
    desc:'Tends the dead you send onward. Reanimates passing its field march out harder, faster and heavier: the only structure that strengthens your OFFENCE.',
    base:{ range:3.2, dmgType:'none', flockHp:0.30, flockSpeed:0.15 },
    levels:[ { cost:200, name:'PASTOR',   mods:{ flockHp:0.55, flockSpeed:0.22 } },
             { cost:370, name:'HIEROPHANT',mods:{ flockHp:0.85, flockSpeed:0.30, range:3.6 } } ],
    talents:[
      { id:'sh_flesh', row:0, col:0, name:'FIRM FLESH', desc:'+25% reanimate health blessing.', mods:{ flockHp:0.25 } },
      { id:'sh_haste', row:0, col:1, name:'SWIFT FLOCK',desc:'+12% reanimate speed blessing.',  mods:{ flockSpeed:0.12 } },
      { id:'sh_wide',  row:1, col:0, name:'WIDE FOLD',  desc:'+35% field radius.',              mods:{ rangeMul:1.35 } },
      { id:'sh_gold',  row:1, col:1, name:'OFFERINGS',  desc:'Each blessed reanimate pays 4 gold.', mods:{ flockGold:4 } },
      { id:'sh_heavy', row:2, col:0, name:'GRAVE WEIGHT',desc:'Blessed leaks cost the rival +1 life.', mods:{ flockLives:1 } },
      { id:'sh_all',   row:2, col:1, name:'GREAT BLESSING', desc:'+35% health and +10% speed blessing.', mods:{ flockHp:0.35, flockSpeed:0.10 } } ],
    branches:[
      { id:'warbound', name:'WARBOUND', cost:440, mods:{ flockHp:1.6, flockSpeed:0.5, range:4.0 },
        surge:{ flockHp:0.3 }, note:'Blesses passing reanimates once each: +160% health, +50% speed. A battering ram consecrated.' },
      { id:'soulbound',name:'SOULBOUND',cost:440, mods:{ flockHp:0.9, flockSpeed:0.3, flockLives:2, flockGold:6 },
        surge:{ flockLives:1 }, note:'Blessed reanimates gain 90% health, 30% speed, pay 1 gold; arrivals cost the rival 2 lives extra.' } ]
  },

  ward: {
    id:'ward', element:'radiant', origin:'light', name:'WARD', role:'Shields towers from disruption', cost:210, costGrowth:1.68,
    color:'#e9d5ff', dark:'#4c2673', attack:'ward', glyph:'❖',
    desc:'Projects a sanctity field. Towers inside CANNOT be jammed or sabotaged: the hard counter to Jammers, Oracles and enemy Saboteurs.',
    base:{ range:2.7, dmgType:'none', wardDmg:0.06 },
    levels:[ { cost:160, name:'SANCTIFY', mods:{ range:3.1, wardDmg:0.10 } },
             { cost:300, name:'CONSECRATE', mods:{ range:3.5, wardDmg:0.15 } } ],
    talents:[
      { id:'wd_wide',  row:0, col:0, name:'BROAD AEGIS', desc:'+30% field radius.',     mods:{ rangeMul:1.30 } },
      { id:'wd_sharp', row:0, col:1, name:'ZEAL',        desc:'+8% damage to warded towers.', mods:{ wardDmg:0.08 } },
      { id:'wd_swift', row:1, col:0, name:'BLESSED HANDS',desc:'Warded towers +10% rate.',mods:{ wardRate:0.10 } },
      { id:'wd_calm',  row:1, col:1, name:'FAR WATCH',   desc:'Warded towers +8% range.', mods:{ wardRange:0.08 } },
      { id:'wd_stand', row:2, col:0, name:'LAST LIGHT',  desc:'+12% damage to warded towers.', mods:{ wardDmg:0.12 } },
      { id:'wd_purge', row:2, col:1, name:'PURGE',       desc:'Enemy auras are 50% weaker inside the field.', mods:{ wardPurge:0.5 } } ],
    branches:[
      { id:'sanctum', name:'SANCTUM', cost:370, mods:{ range:3.8, wardDmg:0.28, wardRate:0.12 },
        surge:{ wardDmg:0.05 }, note:'Warded towers cannot be jammed and gain 28% damage and 12% rate across 3.8 tiles.' },
      { id:'expanse', name:'EXPANSE', cost:370, mods:{ range:5.0, wardDmg:0.12, wardRange:0.12 },
        surge:{ rangeMul:1.06 }, note:'A 5 tile field: towers inside cannot be jammed and gain 12% damage and 12% range.' } ]
  },

  reckoning: {
    id:'reckoning', element:'void', origin:'xeno', name:'RECKONING', role:'Echoes recent damage taken', cost:300, costGrowth:1.78,
    color:'#c4b5fd', dark:'#3f2d63', attack:'projectile', glyph:'☄',
    desc:'Strikes for a share of ALL damage the target suffered in the last three seconds. Worthless alone; monstrous at the heart of a killzone.',
    base:{ damage:6, range:3.6, rate:0.55, projSpeed:15, dmgType:'magic', reckonFrac:0.22 },
    levels:[ { cost:210, name:'TALLY',    mods:{ damage:10, reckonFrac:0.30 } },
             { cost:390, name:'JUDGEMENT',mods:{ damage:16, reckonFrac:0.38, range:4.0 } } ],
    talents:[
      { id:'rk_frac', row:0, col:0, name:'LONG MEMORY', desc:'+8% of recent damage.',    mods:{ reckonFrac:0.08 } },
      { id:'rk_fast', row:0, col:1, name:'SWIFT COUNT', desc:'+30% fire rate.',          mods:{ rateMul:1.30 } },
      { id:'rk_far',  row:1, col:0, name:'FAR SIGHT',   desc:'+30% range.',              mods:{ rangeMul:1.30 } },
      { id:'rk_boss', row:1, col:1, name:'TITAN LEDGER',desc:'+50% effect against elites and bosses.', mods:{ reckonElite:0.5 } },
      { id:'rk_deep', row:2, col:0, name:'FULL ACCOUNT',desc:'+10% of recent damage.',   mods:{ reckonFrac:0.10 } },
      { id:'rk_share',row:2, col:1, name:'PUBLIC RECORD',desc:'Strikes splash 0.9 tiles.',mods:{ splash:0.9 } } ],
    branches:[
      { id:'verdict', name:'VERDICT', cost:480, mods:{ damage:24, reckonFrac:0.55, rate:0.6 },
        surge:{ reckonFrac:0.05 }, note:'Each hit adds 55% of the target\'s recent damage to its 24. Interest, collected.' },
      { id:'tribunal',name:'TRIBUNAL',cost:480, mods:{ damage:20, reckonFrac:0.40, reckonElite:1.0, rate:0.65 },
        surge:{ reckonElite:0.15 }, note:'Adds 40% of recent damage per hit, 80% against bosses and elites. Giants pay double.' } ]
  },

  arbalest: {
    id:'arbalest', element:'kinetic', origin:'human', name:'ARBALEST', role:'Damage grows while it waits', cost:210, costGrowth:1.60,
    color:'#86efac', dark:'#14532d', attack:'patience', glyph:'➶',
    desc:'A siege bow that winds tighter the longer it holds its shot. Fired hastily it stings; fired after a long quiet, it obliterates. The mirror of every rapid-fire tower.',
    base:{ damage:15, range:5.0, rate:0.5, projSpeed:20, dmgType:'physical', windRate:0.35, windMax:6 },
    levels:[ { cost:160, name:'CRANEQUIN', mods:{ damage:26, windMax:8 } },
             { cost:300, name:'SIEGEBOW', mods:{ damage:40, windRate:0.45, windMax:10, range:5.6 } } ],
    talents:[
      { id:'ab_spring',row:0, col:0, name:'STIFF SPRING',desc:'Winds 30% faster.',       mods:{ windRateMul:1.30 } },
      { id:'ab_bolt',  row:0, col:1, name:'HEAVY BOLT',  desc:'+40% damage.',            mods:{ damageMul:1.40 } },
      { id:'ab_max',   row:1, col:0, name:'DEEP DRAW',   desc:'+3 to the wind ceiling.', mods:{ windMax:3 } },
      { id:'ab_pierce',row:1, col:1, name:'BODKIN',      desc:'Ignores 35% of armour.',  mods:{ pierce:0.35 } },
      { id:'ab_far',   row:2, col:0, name:'PARAPET',     desc:'+30% range.',             mods:{ rangeMul:1.30 } },
      { id:'ab_crit',  row:2, col:1, name:'DEADEYE',     desc:'Fully-wound shots always crit x2.', mods:{ windCrit:2 } } ],
    branches:[
      { id:'longshot', name:'LONGSHOT', cost:360, mods:{ damage:66, windMax:16, range:7.0 },
        surge:{ windMax:2 }, note:'A full 16 wind multiplies its 66 damage seventeenfold, reaching 7 tiles. Patience in city blocks.' },
      { id:'snapshot', name:'SNAPSHOT', cost:360, mods:{ damage:52, windRate:0.9, windMax:8, rate:0.7 },
        surge:{ windRateMul:1.1 }, note:'Winds 0.9 per second to a cap of 8, each point adding another 52 damage.' } ]
  },

  /* Four towers that exist so the thinner origins can field a loadout built
     entirely from their own power. Three reuse an attack verb the engine
     already resolves. CUSTODIAN does not, and is the exception on purpose:
     separating it from FOUNDRY (roadmap 19.20) meant giving up the spawner
     verb entirely, so it carries its own -- `vigil`, handled in entities.js
     beside the other core behaviours. All four remain reachable through the
     same level, specialisation and ascension path as everything else. */

  custodian: {
    id:'custodian', element:'radiant', origin:'light', name:'CUSTODIAN', role:'The last line: spends wardens on breaches', cost:286, costGrowth:1.82,
    color:'#fde68a', dark:'#78500a', attack:'vigil', glyph:'⛨',
    desc:'Federation wardens who signed a consent record naming this exact scope, and have been waiting since to be told where. It shoots nothing and it blocks nothing. When something finally reaches the line inside its watch, a warden walks into it and both are simply gone: no bounty paid, no corpse sent onward, no life off your counter. CONDITIONAL: worth nothing on a board that holds, and the difference between a bad wave and a lost run on one that does not. A Foundry stops the assault out in the lane; a Custodian answers what got past it.',
    base:{ range:3.4, dmgType:'none', vigilHold:2, vigilEvery:11 },
    levels:[ { cost:180, name:'SENTINEL', mods:{ vigilHold:3, vigilEvery:9.5, range:3.7 } },
             { cost:340, name:'PARAGON',  mods:{ vigilHold:4, vigilEvery:8, range:4.0 } } ],
    talents:[
      { id:'cu_plate', row:0, col:0, name:'STANDING OATH',      desc:'+1 warden on watch.',        mods:{ vigilHold:1 } },
      { id:'cu_hold',  row:0, col:1, name:'READY RELIEF',       desc:'Wardens return 25% sooner.', mods:{ vigilEveryMul:0.75 } },
      { id:'cu_quick', row:1, col:0, name:'WIDE WATCH',         desc:'+35% radius.',               mods:{ rangeMul:1.35 } },
      { id:'cu_edge',  row:1, col:1, name:'TITHE OF THE FALLEN',desc:'Each warden spent pays 18 gold.', mods:{ vigilGold:18 } },
      { id:'cu_more',  row:2, col:0, name:'DEEP RESERVE',       desc:'+2 wardens on watch.',       mods:{ vigilHold:2 } },
      { id:'cu_last',  row:2, col:1, name:'ETERNAL',            desc:'Wardens return 45% sooner.', mods:{ vigilEveryMul:0.55 } } ],
    branches:[
      { id:'vigil',   name:'GARRISON', cost:430, mods:{ vigilHold:8, vigilEvery:9.5, range:4.2 },
        surge:{ vigilHold:1 }, note:'Holds 8 wardens across 4.2 tiles, each absorbing one breach; one returns every 9.5 seconds.' },
      { id:'cordon',  name:'CORDON',  cost:430, mods:{ vigilHold:3, vigilEvery:3.2, range:4.8 },
        surge:{ vigilEveryMul:0.94 }, note:'Three wardens across 4.8 tiles, each absorbing one breach, relieved every 3.2 seconds. The watch holds.' } ]
  },

  concord: {
    id:'concord', element:'storm', origin:'light', name:'CONCORD', role:'Harmonic chain, opens targets', cost:268, costGrowth:1.72,
    color:'#fcd34d', dark:'#78500a', attack:'chain', glyph:'♒',
    desc:'A tuned discharge that walks the crowd from body to body, wherever they happen to be standing. It is not the damage that matters: everything it touches is left OPEN, and every other tower on the board collects. A chain asks who else is near THIS ONE; an Arc asks who else is on this ROAD. MID-GAME: worth exactly what the rest of your line can convert.',
    base:{ damage:7, range:3.3, rate:0.85, dmgType:'magic', chains:4, chainRange:2.4, falloff:0.80, vuln:0.16, vulnDur:3 },
    /* CANTICLE, not ANTIPHON: Session 19 adds a Federation tower of that
       name and two things in one faction's copy answering to one word is the
       same lie as a wrong number. The id is untouched -- only the printed
       tier name moves. */
    levels:[ { cost:175, name:'CANTICLE', mods:{ damage:22, chains:5, vuln:0.21 } },
             { cost:315, name:'CHORAL',   mods:{ damage:34, chains:6, vuln:0.26, range:3.6 } } ],
    talents:[
      { id:'co_open', row:0, col:0, name:'OPEN CHORD',   desc:'+10% to the opening it leaves.', mods:{ vuln:0.10 } },
      { id:'co_amp',  row:0, col:1, name:'AMPLITUDE',    desc:'+40% damage.',                   mods:{ damageMul:1.40 } },
      { id:'co_reach',row:1, col:0, name:'WIDE HARMONY', desc:'+3 chain targets.',              mods:{ chains:3 } },
      { id:'co_pure', row:1, col:1, name:'PURE TONE',    desc:'Chains lose only 12% per jump.', mods:{ falloff:0.88 } },
      { id:'co_hold', row:2, col:0, name:'SUSTAIN',      desc:'The opening lasts 2.5s longer.', mods:{ vulnDur:2.5 } },
      { id:'co_fast', row:2, col:1, name:'QUICK MEASURE',desc:'+35% fire rate.',                mods:{ rateMul:1.35 } } ],
    branches:[
      { id:'unison',  name:'UNISON',  cost:420, mods:{ damage:44, chains:10, falloff:0.90, chainRange:2.9, vuln:0.22 },
        surge:{ chains:2 }, note:'Chains 44 damage through 10 targets, keeping 90% per jump, opening each for 22% extra damage.' },
      { id:'requiem', name:'REQUIEM', cost:420, mods:{ damage:96, chains:4, falloff:0.72, vuln:0.46, vulnDur:4.0 },
        surge:{ vuln:0.06 }, note:'Chains 96 damage through 4 targets at 72%, each taking 46% more damage for 4 seconds.' } ]
  },

  ichor: {
    id:'ichor', element:'void', origin:'xeno', name:'ICHOR', role:'Digestive spray: eats the wounded', cost:232, costGrowth:1.70,
    color:'#a855f7', dark:'#4a1d6b', attack:'cone', glyph:'☣',
    desc:'A short spray of living bile that keeps working long after the stream has moved on. It does not care what the target was; only how much of it is MISSING. On a fresh body it barely registers; on something your line has already opened up it is the fastest thing on the board. LATE-GAME, and the exact mirror of CANISTER, which eats a share of what the target ARRIVED with.',
    base:{ damage:9, range:2.1, rate:1, dmgType:'magic', cone:0.55, digest:0.018, digestDur:3.0 },
    levels:[ { cost:150, name:'GORGE',   mods:{ damage:32, digest:0.030 } },
             { cost:280, name:'DIGEST',  mods:{ damage:52, digest:0.042, digestDur:3.6, range:2.4, cone:0.62 } } ],
    talents:[
      { id:'ic_thick', row:0, col:0, name:'THICK BILE',  desc:'+65% digestion.',              mods:{ statusMul:1.65 } },
      { id:'ic_hot',   row:0, col:1, name:'RAW ACID',    desc:'+45% direct damage.',          mods:{ damageMul:1.45 } },
      { id:'ic_wide',  row:1, col:0, name:'WIDE MAW',    desc:'+35% spray width, +20% reach.',mods:{ coneMul:1.35, rangeMul:1.20 } },
      { id:'ic_eat',   row:1, col:1, name:'DISSOLVE',    desc:'Spray strips 4 armour.',       mods:{ shred:4 } },
      { id:'ic_feed',  row:2, col:0, name:'FEEDING',     desc:'Anything being digested takes +30% damage.', mods:{ digestVuln:0.30 } },
      { id:'ic_deep',  row:2, col:1, name:'DEEP GULLET', desc:'+50% digestion and +15% reach.', mods:{ statusMul:1.50, rangeMul:1.15 } } ],
    branches:[
      { id:'devour',  name:'DEVOUR',  cost:390, mods:{ damage:92, digest:0.055, digestDur:4.2, range:2.8, cone:0.70 },
        surge:{ digest:0.006 }, note:'Digests 2.75% of max health per second at half health, quickening as wounds deepen, for 4.2 seconds.' },
      { id:'spatter', name:'SPATTER', cost:390, mods:{ damage:56, digest:0.034, digestDur:2.8, range:2.6, cone:0.66, puddle:true, puddleDmg:30, puddleDur:5.0, puddleRadius:1.1 },
        surge:{ puddleDmg:16 }, note:'Digests 1.7% max health per second at half health; lays 5 second puddles dealing 30 per second.' } ]
  },

  pylon: {
    id:'pylon', element:'storm', origin:'robotic', name:'PYLON', role:'Lattice keystone', cost:262, costGrowth:1.90,
    color:'#94a3b8', dark:'#1e293b', attack:'aura', glyph:'⬡',
    desc:'Fires nothing and buffs almost nothing on its own. What it does is LINK: every robotic emplacement inside its field counts the pylon as part of its lattice, which is the only thing robotic hardware has instead of a trick. A wide, shallow field that pays a little to everything standing near it: EARLY-GAME, and the exact opposite of a Beacon, which pays everything to one.',
    base:{ range:2.8, dmgType:'none', auraDmg:0.08, auraRate:0.06, auraRange:0.0, latticeBonus:1 },
    levels:[ { cost:160, name:'RELAY',   mods:{ auraDmg:0.13, auraRate:0.09, range:3.1, latticeBonus:2 } },
             { cost:290, name:'MAINLINE',mods:{ auraDmg:0.18, auraRate:0.12, range:3.4, latticeBonus:2 } } ],
    talents:[
      { id:'py_span', row:0, col:0, name:'LONG SPAN',   desc:'+35% field radius.',            mods:{ rangeMul:1.35 } },
      { id:'py_gain', row:0, col:1, name:'LINE GAIN',   desc:'+45% damage field.',            mods:{ auraDmgMul:1.45 } },
      { id:'py_trunk',row:1, col:0, name:'TRUNK LINE',  desc:'+1 lattice link inside the field.', mods:{ latticeBonus:1 } },
      { id:'py_clock',row:1, col:1, name:'CLOCK LINE',  desc:'+50% fire-rate field.',         mods:{ auraRateMul:1.50 } },
      { id:'py_grid', row:2, col:0, name:'GRID NODE',   desc:'+1 lattice link and +20% radius.', mods:{ latticeBonus:1, rangeMul:1.20 } },
      { id:'py_reach',row:2, col:1, name:'REACH RELAY', desc:'+10% range to everything in the field.', mods:{ auraRange:0.10 } } ],
    branches:[
      { id:'backbone', name:'BACKBONE', cost:410, mods:{ range:4.4, auraDmg:0.16, auraRate:0.10, latticeBonus:2 },
        surge:{ rangeMul:1.06 }, note:'Towers across 4.4 tiles gain 16% damage and 10% rate; robotic ones gain 2 lattice links.' },
      { id:'substation', name:'SUBSTATION', cost:410, mods:{ range:3.0, auraDmg:0.34, auraRate:0.26, latticeBonus:3 },
        surge:{ auraDmg:0.05 }, note:'Towers within 3 tiles gain 34% damage and 26% rate, robotic ones 3 lattice links.' } ]
  },

  /* ── SESSION 19 ─────────────────────────────────────────────────────────
     Three PIRATE and two ROBOTIC, from docs/NEW-TOWERS-DESIGN.md. Each names
     a mechanic key that appears nowhere else in the arsenal and each of those
     keys has a reader in entities.js -- the audit rule, and the specific way
     five talents and six commander traits shipped inert here.

     The machine two are `origin: 'robotic'`, which is the entire story lock:
     Meta.isStoryTower reads the origin, so the soul shop refuses to price
     them exactly as it refuses the existing eight. ROBOTIC_UNLOCK_ORDER in
     config.js says where in the ladder they are issued. */

  pressgang: {
    id:'pressgang', element:'kinetic', origin:'pirate', name:'PRESS GANG', role:'Conscripts the dead into your own line', cost:225, costGrowth:1.66,
    color:'#fca5a5', dark:'#5b1a1a', attack:'press', glyph:'⚓',
    desc:'Kills raise the corpse as a timed conscript that fights for you. Heavier corpse, heavier conscript.',
    lore:'A hook and no scruples.',
    /* pressHp is a SHARE of the corpse, not a figure -- that is what keeps a
       conscript honest at every wave without a second copy of the curve, and
       it is why the tower fades: the share is constant while the number of
       bodies it must hold is not. */
    base:{ damage:11, range:3.2, rate:0.9, projSpeed:16, dmgType:'physical',
           pressCd:5.0, pressDur:9, pressHp:0.55, pressDps:7, pressMax:2 },
    levels:[ { cost:150, name:'BOATSWAIN', mods:{ damage:21, pressCd:4.2, pressDur:11, pressDps:11, pressMax:3 } },
             { cost:275, name:'WARRANT',   mods:{ damage:34, pressCd:3.4, pressDur:13, pressHp:0.75, pressDps:17, pressMax:4, range:3.5 } } ],
    talents:[
      { id:'pg_rope',  row:0, col:0, name:'SHORT ROPE',    desc:'Presses 30% sooner.',              mods:{ pressCdMul:0.70 } },
      { id:'pg_terms', row:0, col:1, name:'LONG ARTICLES', desc:'Conscripts serve 4s longer.',      mods:{ pressDur:4 } },
      { id:'pg_flesh', row:1, col:0, name:'PRESSED FLESH', desc:'+45% conscript health.',           mods:{ pressHpMul:1.45 } },
      { id:'pg_arms',  row:1, col:1, name:'ISSUED ARMS',   desc:'+60% conscript damage.',           mods:{ pressDpsMul:1.60 } },
      { id:'pg_crew',  row:2, col:0, name:'FULL CREW',     desc:'+2 conscripts held at once.',      mods:{ pressMax:2 } },
      { id:'pg_share', row:2, col:1, name:'DEAD MAN\'S SHARE', desc:'A conscript that falls takes 2.4x its damage with it.', mods:{ pressBlast:2.4 } } ],
    branches:[
      { id:'gang',  name:'THE GANG', cost:360, mods:{ damage:46, pressCd:2.2, pressDur:10, pressHp:0.48, pressDps:20, pressMax:7 },
        surge:{ pressMax:1 }, note:'Presses kills into conscripts every 2.2 seconds: 48% corpse health, 20 dps, 10 second terms, 7 held.' },
      { id:'bosun', name:'BOSUN',    cost:360, mods:{ damage:54, pressCd:6.5, pressDur:22, pressHp:1.90, pressDps:44, pressMax:2 },
        surge:{ pressDps:6 }, note:'Keeps 2 conscripts at 190% corpse health and 44 dps, serving 22 seconds each. Built to last.' } ]
  },

  privateer: {
    id:'privateer', element:'void', origin:'pirate', name:'PRIVATEER', role:'Robs a rival commander on every kill', cost:255, costGrowth:1.80,
    color:'#fbbf24', dark:'#5c3a05', attack:'projectile', glyph:'⚑',
    desc:'Kills steal a share of the aimed rival\'s gold; the PICK THE PURSE talent hunts the richest. Plain gun once they are broke.',
    lore:'A letter of marque nobody issued.',
    base:{ damage:17, range:3.8, rate:0.95, projSpeed:19, dmgType:'physical', privateerSteal:0.012 },
    levels:[ { cost:165, name:'CORSAIR',  mods:{ damage:31, privateerSteal:0.019 } },
             { cost:305, name:'BUCCANEER',mods:{ damage:50, privateerSteal:0.028, range:4.1 } } ],
    talents:[
      { id:'pr_marque', row:0, col:0, name:'LETTERS OF MARQUE', desc:'+60% taken per kill.',        mods:{ privateerStealMul:1.60 } },
      { id:'pr_guns',   row:0, col:1, name:'CHASE GUNS',        desc:'+45% damage.',                mods:{ damageMul:1.45 } },
      { id:'pr_nest',   row:1, col:0, name:'CROW\'S NEST',      desc:'+30% range.',                 mods:{ rangeMul:1.30 } },
      { id:'pr_rig',    row:1, col:1, name:'RUNNING RIGGING',   desc:'+30% fire rate.',             mods:{ rateMul:1.30 } },
      { id:'pr_purse',  row:2, col:0, name:'PICK THE PURSE',    desc:'Robs the richest rival seat anywhere on the board.', mods:{ privateerPick:true } },
      { id:'pr_scuttle',row:2, col:1, name:'SCUTTLE',           desc:'The victim loses an extra 50% of the take, burned.', mods:{ privateerScuttle:0.5 } } ],
    branches:[
      { id:'raider',    name:'RAIDER',    cost:420, mods:{ damage:66, rate:1.5, privateerSteal:0.021 },
        surge:{ privateerSteal:0.002 }, note:'Each kill steals 2.1% of the rival\'s purse, firing 66 damage at 1.5 rate. Volume.' },
      { id:'admiralty', name:'ADMIRALTY', cost:420, mods:{ damage:124, rate:0.55, privateerSteal:0.058, privateerScuttle:0.6 },
        surge:{ privateerSteal:0.006 }, note:'Kills steal 5.8% of the rival\'s gold and burn another 60% of the take. To the hull.' } ]
  },

  bloodprice: {
    /* `cost: 0` is the literal truth and Game.towerCost quotes it as such.
       The price is `base.lifeCost`, charged by Game.build out of the only
       resource on the board that cannot be earned back at will. */
    id:'bloodprice', element:'fire', origin:'pirate', name:'BLOOD PRICE', role:'Bought with lives, never with gold', cost:0, costGrowth:1.0,
    color:'#ef4444', dark:'#450a0a', attack:'projectile', glyph:'☩',
    desc:'Costs lives, not gold, and sells for nothing. Lives paid speed all Blood Prices. Never takes your last 5 lives.',
    lore:'The bill is never in gold.',
    base:{ damage:52, range:4.2, rate:0.85, projSpeed:22, dmgType:'physical', splash:1.05,
           lifeCost:2, bloodRate:0.06 },
    levels:[ { cost:190, name:'EXSANGUINE',   mods:{ damage:98, splash:1.20 } },
             { cost:340, name:'OPEN VEIN',    mods:{ damage:172, splash:1.40, range:4.6 } } ],
    talents:[
      { id:'bp_ledger', row:0, col:0, name:'RED LEDGER',  desc:'+45% damage.',                          mods:{ damageMul:1.45 } },
      { id:'bp_art',    row:0, col:1, name:'ARTERIAL',    desc:'+45% splash.',                          mods:{ splashMul:1.45 } },
      { id:'bp_quick',  row:1, col:0, name:'QUICKENED',   desc:'A further +8% fire rate per life paid.',mods:{ bloodRate:0.08 } },
      { id:'bp_saw',    row:1, col:1, name:'BONE SAW',    desc:'Ignores 40% of armour.',                mods:{ pierce:0.40 } },
      { id:'bp_caut',   row:2, col:0, name:'CAUTERISE',   desc:'Hits burn for 18/s over 3s.',           mods:{ burn:18, burnDur:3 } },
      { id:'bp_debt',   row:2, col:1, name:'BLOOD DEBT',  desc:'Every 12 kills returns one life.',      mods:{ bloodTally:12 } } ],
    branches:[
      { id:'tithe',        name:'EXACTION',     cost:460, mods:{ damage:296, rate:1.0, splash:1.55 },
        surge:{ damageMul:1.06 }, note:'Hits for 296 in a 1.55 tile blast, once a second. The bill bought a bigger gun.' },
      { id:'exsanguinate', name:'EXSANGUINATE', cost:460, mods:{ damage:158, rate:1.9, bloodRate:0.05, burn:30, burnDur:5 },
        surge:{ burn:6 }, note:'158 damage at 1.9 rate, burning 30 per second for 5; each life paid adds 5% rate.' } ]
  },

  replicator: {
    id:'replicator', element:'kinetic', origin:'robotic', name:'REPLICATOR', role:'Builds you a tower, unasked', cost:340, costGrowth:1.86,
    color:'#67e8f9', dark:'#083344', attack:'replicate', glyph:'⧉',
    desc:'A machine that does not need a commander. Left standing long enough it surveys the ground beside it and puts up another emplacement, free, out of your own five: legal ground only, never on rubble and never on top of anything. It will not build something it cannot account for: the gift\'s price, asked of the same call that would charge you, must be within the Replicator\'s own. So it grows as you invest in it, and it spends the one thing you cannot buy more of. TILES. The longest investment in the arsenal: nothing for several waves, then compounding.',
    base:{ damage:9, range:3.0, rate:0.7, projSpeed:18, dmgType:'physical',
           replicateEvery:4, replicateReach:3, replicateCount:1 },
    levels:[ { cost:180, name:'FABRICATOR', mods:{ damage:19, replicateEvery:3, replicateReach:4 } },
             { cost:330, name:'ASSEMBLER',  mods:{ damage:33, replicateEvery:3, replicateReach:5, replicateLevel:1 } } ],
    talents:[
      { id:'rp_cycle', row:0, col:0, name:'SHORT CYCLE',      desc:'Cuts the build cycle by 1 wave.',                 mods:{ replicateEvery:-1 } },
      { id:'rp_arm',   row:0, col:1, name:'OUTREACH',         desc:'+2 tiles of placement reach.',                    mods:{ replicateReach:2 } },
      { id:'rp_gun',   row:1, col:0, name:'SIDEARM',          desc:'+40% damage.',                                    mods:{ damageMul:1.40 } },
      { id:'rp_seed',  row:1, col:1, name:'SEED STOCK',       desc:'Replicated towers arrive 1 level higher.',         mods:{ replicateLevel:1 } },
      { id:'rp_auth',  row:2, col:0, name:'DESIGN AUTHORITY', desc:'Builds the costliest tower its budget allows, never a random one.', mods:{ replicatePick:true } },
      { id:'rp_twin',  row:2, col:1, name:'TWIN LINE',        desc:'Builds 2 towers per cycle.',                           mods:{ replicateCount:1 } } ],
    branches:[
      { id:'swarm',     name:'SWARM',     cost:470, mods:{ damage:28, replicateEvery:2, replicateReach:6, replicateCount:1 },
        surge:{ replicateReach:1 }, note:'Builds one random loadout tower free every 2 waves, within 6 tiles. The board fills itself.' },
      { id:'archetype', name:'ARCHETYPE', cost:470, mods:{ damage:74, replicateEvery:6, replicateReach:5, replicateLevel:2, replicatePick:true },
        surge:{ replicateLevel:1 }, note:'Every 6 waves builds the priciest tower it can afford, 2 marks higher, within 5 tiles.' } ]
  },

  nullfield: {
    id:'nullfield', element:'void', origin:'robotic', name:'NULL FIELD', role:'Switches enemy abilities off', cost:300, costGrowth:1.80,
    color:'#a5b4fc', dark:'#1e1b4b', attack:'null', glyph:'⊘',
    desc:'It fires nothing and it blocks nothing. Inside the volume it holds, no mending, no shielding, no regeneration, no blinking, no jamming, no summoning, no phasing and no standing back up: only walking, and dying. The arsenal can out-damage a mechanic; this is the only thing that switches one off. Against a wave built on an ability it is total; against a plain armoured column it does nothing whatsoever, and that is the point. CONDITIONAL: an answer, not an upgrade.',
    /* `nullRadius` is the authored field, and recompute() publishes it AS
       `range` -- one number for the drawn circle, the printed figure and the
       volume the engine tests. A second authored `range` beside it is exactly
       the UI/engine desync this project keeps re-shipping. */
    base:{ dmgType:'none', nullRadius:3.2 },
    levels:[ { cost:175, name:'DEAD ZONE', mods:{ nullRadius:3.8 } },
             { cost:330, name:'ABSOLUTE',  mods:{ nullRadius:4.4, nullVuln:0.15 } } ],
    talents:[
      { id:'nf_wide',  row:0, col:0, name:'WIDER NULL',  desc:'+30% field radius.',                              mods:{ nullRadiusMul:1.30 } },
      { id:'nf_deco',  row:0, col:1, name:'DECOHERENCE', desc:'Everything inside takes +18% damage.',            mods:{ nullVuln:0.18 } },
      { id:'nf_visc',  row:1, col:0, name:'VISCOUS',     desc:'Everything inside is slowed 25%.',                mods:{ nullSlow:0.25 } },
      { id:'nf_eras',  row:1, col:1, name:'ANNULMENT',   desc:'Deals 100% of suppressed regeneration back as pure damage.', mods:{ nullBackfire:1.0 } },
      { id:'nf_lock',  row:2, col:0, name:'HARD LOCK',   desc:'A unit that leaves stays suppressed 2s longer.',  mods:{ nullLinger:2 } },
      { id:'nf_array', row:2, col:1, name:'FIELD ARRAY', desc:'+20% radius and a further +10% damage taken.',    mods:{ nullRadiusMul:1.20, nullVuln:0.10 } } ],
    branches:[
      { id:'quiet',   name:'QUIET',   cost:440, mods:{ nullRadius:6.6, nullLinger:1.5 },
        surge:{ nullRadiusMul:1.05 }, note:'Suppresses enemy abilities and regeneration across 6.6 tiles, lingering 1.5 seconds after exit. Nothing clever happens.' },
      { id:'erasure', name:'ERASURE', cost:440, mods:{ nullRadius:4.0, nullVuln:0.42, nullSlow:0.40, nullBackfire:2.0 },
        surge:{ nullVuln:0.04 }, note:'Suppresses across 4 tiles; inside, 42% more damage taken, 40% slow, regeneration dealt back doubled.' } ]
  }
};

Object.assign(TOWER_TYPES_2, {
  /* SESSION 19. THE SIX. Three Federation and three Xeno, each carrying a
     base key that appears nowhere else in the arsenal and a reader for it in
     entities.js. Three of the six do not watch the enemy at all: SEPULCHRE
     watches your own tower list, ORISON watches one named creature for its
     whole life, and ANTIPHON watches bodies dying on a board you do not own.
     They sit HERE, inside TOWER_TYPES_2, because applyGoldSquish runs once
     at the foot of this file and anything added after it keeps unsquished
     prices for the rest of the match. */

  sepulchre: {
    id:'sepulchre', element:'radiant', origin:'light', name:'SEPULCHRE', role:'Your dead towers keep firing', cost:300, costGrowth:1.86,
    color:'#fef3c7', dark:'#57430c', attack:'sepulchre', glyph:'✞',
    desc:'A reliquary raised over the ground your emplacements stand on. When one of them leaves that ground sold for the gold, or taken by the board itself, it does not stop firing: what is left of it holds the line at a share of its old strength until the wave turns over. Worthless over empty tiles, and transformative over a line you are about to rebuild, because selling stops being a loss and becomes a tempo play. INVESTMENT, and the faction tenet stated as a mechanic rather than as flavour.',
    /* sepulchreWards is how many departures one chapel can hold at once. It
       is the cap that stops an entire board being sold into a single
       Sepulchre and rebuilt elsewhere while the old board is still shooting. */
    base:{ range:3.2, dmgType:'none', sepulchreFrac:0.40, sepulchreDur:16, sepulchreWards:1 },
    levels:[ { cost:190, name:'OSSUARY',   mods:{ sepulchreFrac:0.55, sepulchreDur:20, sepulchreWards:2, range:3.5 } },
             { cost:355, name:'MAUSOLEUM', mods:{ sepulchreFrac:0.68, sepulchreDur:24, sepulchreWards:3, range:3.8 } } ],
    talents:[
      { id:'se_share', row:0, col:0, name:'MARTYR\'S SHARE',    desc:'Wards keep 12% more of what they were.', mods:{ sepulchreFrac:0.12 } },
      { id:'se_wide',  row:0, col:1, name:'CONSECRATED GROUND', desc:'+35% radius.',                          mods:{ rangeMul:1.35 } },
      { id:'se_long',  row:1, col:0, name:'LONG MOURNING',      desc:'Wards stand 8s longer.',                mods:{ sepulchreDur:8 } },
      { id:'se_more',  row:1, col:1, name:'CATACOMB',           desc:'+1 ward held at once.',                 mods:{ sepulchreWards:1 } },
      { id:'se_deep',  row:2, col:0, name:'UNENDING WATCH',     desc:'Wards keep 18% more of what they were.', mods:{ sepulchreFrac:0.18 } },
      { id:'se_gold',  row:2, col:1, name:'GRAVE GOODS',        desc:'Each ward raised returns 40 gold.',     mods:{ sepulchreGold:40 } } ],
    branches:[
      { id:'martyrium',  name:'MARTYRIUM',  cost:470, mods:{ sepulchreFrac:0.92, sepulchreDur:30, sepulchreWards:2, range:4.0 },
        surge:{ sepulchreFrac:0.02 }, note:'Keeps lost towers firing as wards at 92% strength for 30 seconds, 2 standing at once.' },
      { id:'necropolis', name:'NECROPOLIS', cost:470, mods:{ sepulchreFrac:0.42, sepulchreDur:40, sepulchreWards:6, range:4.6 },
        surge:{ sepulchreWards:1 }, note:'Holds 6 wards at once, each firing at 42% of its lost tower for 40 seconds.' } ]
  },

  orison: {
    id:'orison', element:'radiant', origin:'light', name:'ORISON', role:'Names one creature the offering', cost:265, costGrowth:1.76,
    color:'#fbbf24', dark:'#78500a', attack:'orison', glyph:'◉',
    desc:'Once a wave the chapel names the largest thing walking at you and dedicates it. While the offering lives, every tower you own hits harder; when it is finally killed, you are given back a life. It inverts the instinct the rest of the board runs on: you want that one creature to last, and killing it early throws the blessing away. CONDITIONAL: enormous on a wave built round a single heavy body, close to idle on a swarm. An offering that walks into your base, or is taken off the board by something that does not kill it, pays nothing.',
    /* range is board-wide on purpose. The chapel does not shoot and does not
       need a target in reach; it names one creature out of the whole wave,
       which is why it argues with your roster instead of scaling with it. */
    base:{ range:99, dmgType:'none', offeringDmg:0.14, offeringRate:0.00, offeringLives:1 },
    levels:[ { cost:180, name:'DEVOTION',     mods:{ offeringDmg:0.20, offeringRate:0.06 } },
             { cost:335, name:'INTERCESSION', mods:{ offeringDmg:0.27, offeringRate:0.10, offeringLives:2 } } ],
    talents:[
      { id:'or_dmg',  row:0, col:0, name:'FERVOUR',    desc:'+8% damage while the offering lives.',      mods:{ offeringDmg:0.08 } },
      { id:'or_rate', row:0, col:1, name:'PLAINSONG',  desc:'+8% fire rate while the offering lives.',   mods:{ offeringRate:0.08 } },
      { id:'or_life', row:1, col:0, name:'RECOMPENSE', desc:'+1 life when the offering is taken.',       mods:{ offeringLives:1 } },
      { id:'or_gold', row:1, col:1, name:'ALMS',       desc:'A taken offering also pays 60 gold.',       mods:{ offeringGold:60 } },
      { id:'or_deep', row:2, col:0, name:'HIGH RITE',  desc:'+12% damage while the offering lives.',     mods:{ offeringDmg:0.12 } },
      { id:'or_mark', row:2, col:1, name:'SANCTIFIED', desc:'The offering itself takes 25% less damage, so it lasts.', mods:{ offeringGuard:0.25 } } ],
    branches:[
      { id:'litany',   name:'LITANY',   cost:445, mods:{ offeringDmg:0.46, offeringRate:0.16, offeringLives:2 },
        surge:{ offeringDmg:0.04 }, note:'Every tower gains 46% damage and 16% rate while the offering stands; its fall restores 2 lives.' },
      { id:'oblation', name:'OBLATION', cost:445, mods:{ offeringDmg:0.18, offeringRate:0.04, offeringLives:5, offeringGold:200, offeringGuard:0.35 },
        surge:{ offeringLives:0.25 }, note:'The offering, 35% harder to kill, repays 5 lives and 25 gold; towers gain 18% damage.' } ]
  },

  antiphon: {
    id:'antiphon', element:'storm', origin:'light', name:'ANTIPHON', role:'Answers your losses on rival ground', cost:245, costGrowth:1.70,
    color:'#facc15', dark:'#713f12', attack:'antiphon', glyph:'♫',
    desc:'It has no cadence of its own. Every detachment you SUMMON that dies on another commander\'s lane is answered here, and the chapel spends those answers as free volleys over your own ground. It is the only structure whose output is decided by what is happening on somebody else\'s board. CONDITIONAL and purely PvP: silent on a board that never sends, one of the heaviest guns in the arsenal on one that sends constantly. Your reanimated dead do not count: the chapel answers only what you paid for.',
    /* antiphonBank is how many unspent answers it holds. Uncapped, a
       commander could muster all match and dump a hundred volleys into one
       wave, which makes the mechanic a battery rather than pressure. */
    /* `homing` because a volley is an ANSWER, not suppressing fire: the
       shot count comes off antiphonVolley and fireProjectile only gives
       every shot in a burst a target when this is set. Unguided, a four-
       shot answer sprays past the thing it was bought to kill. */
    base:{ damage:26, range:4.2, rate:1.1, projSpeed:16, dmgType:'magic', homing:true, antiphonPerLoss:1, antiphonBank:4, antiphonVolley:2 },
    levels:[ { cost:170, name:'RESPONSE', mods:{ damage:46, antiphonBank:6, antiphonVolley:3 } },
             { cost:320, name:'DESCANT',  mods:{ damage:76, antiphonBank:8, antiphonVolley:4, range:4.6 } } ],
    talents:[
      { id:'an_amp',    row:0, col:0, name:'FORTE',      desc:'+45% damage.',                    mods:{ damageMul:1.45 } },
      { id:'an_volley', row:0, col:1, name:'RESPONSORY', desc:'+1 shot per answer.',             mods:{ antiphonVolley:1 } },
      { id:'an_hold',   row:1, col:0, name:'REMEMBRANCE',desc:'+3 answers held unspent.',        mods:{ antiphonBank:3 } },
      { id:'an_grief',  row:1, col:1, name:'DEEP GRIEF', desc:'+0.5 answers for every body lost.', mods:{ antiphonPerLoss:0.5 } },
      { id:'an_wide',   row:2, col:0, name:'NAVE',       desc:'+30% range.',                     mods:{ rangeMul:1.30 } },
      { id:'an_toll',   row:2, col:1, name:'TOLLING',    desc:'Answers splash 1.0 tiles.',       mods:{ splash:1.0 } } ],
    branches:[
      { id:'dirge',    name:'DIRGE',    cost:420, mods:{ damage:190, antiphonVolley:6, antiphonBank:5, rate:1.3 },
        surge:{ antiphonVolley:1 }, note:'Spends 6-shot volleys of 190 damage at 1.3/s, 5 answers held. Every reply a barrage.' },
      { id:'threnody', name:'THRENODY', cost:420, mods:{ damage:98, antiphonPerLoss:3, antiphonBank:16, antiphonVolley:3 },
        surge:{ antiphonPerLoss:0.3 }, note:'Banks 3 answers per body lost, holds 16, each a 3-shot volley at 98 damage.' } ]
  },

  gestalt: {
    id:'gestalt', element:'venom', origin:'xeno', name:'GESTALT', role:'Grows on every kill near it', cost:240, costGrowth:1.80,
    color:'#8b5cf6', dark:'#2e1065', attack:'gestalt', glyph:'⬢',
    desc:'It does not upgrade. It EATS. Every creature that dies inside its reach whatever killed it, is folded in permanently, and its gullet widens as it goes, so a Gestalt standing in a killzone feeds itself. Leave it too long without a body and it forgets the whole lot at once. Its real price is not gold, it is the tile: put it where the killing is, or do not put it down. INVESTMENT, and the only one in the arsenal that can be lost without being sold.',
    /* gestaltMax is the ceiling on permanent accumulation. Without it a
       tower placed in a good killzone at wave 5 is the only tower on the
       board by wave 30 and the rest of the arsenal is decoration. */
    base:{ damage:9, range:2.8, rate:1.0, projSpeed:15, dmgType:'physical', gestaltPerKill:0.9, gestaltRange:0.012, gestaltDecay:9, gestaltMax:20 },
    levels:[ { cost:165, name:'ACCRUAL',   mods:{ damage:17, gestaltPerKill:1.7, gestaltMax:30, gestaltDecay:10 } },
             { cost:305, name:'CONFLUX',   mods:{ damage:28, gestaltPerKill:2.8, gestaltMax:42, gestaltDecay:11, range:3.1 } } ],
    talents:[
      { id:'ge_glut', row:0, col:0, name:'GLUTTONY',     desc:'+60% growth from every body.',   mods:{ gestaltPerKillMul:1.60 } },
      { id:'ge_hold', row:0, col:1, name:'SLOW TO FORGET',desc:'6s longer before it forgets.',   mods:{ gestaltDecay:6 } },
      { id:'ge_max',  row:1, col:0, name:'DEEP GUT',     desc:'+14 to what it can hold.',       mods:{ gestaltMax:14 } },
      { id:'ge_wide', row:1, col:1, name:'SPREADING',    desc:'Each body adds 0.024 tiles of range, double the base.', mods:{ gestaltRange:0.012 } },
      { id:'ge_fast', row:2, col:0, name:'QUICK FEED',   desc:'+35% fire rate.',                mods:{ rateMul:1.35 } },
      { id:'ge_bore', row:2, col:1, name:'BORING TEETH', desc:'Ignores 35% of armour.',         mods:{ pierce:0.35 } } ],
    branches:[
      { id:'hive',   name:'HIVE',   cost:400, mods:{ damage:34, gestaltPerKill:6.2, gestaltMax:60, gestaltDecay:9 },
        surge:{ gestaltPerKill:0.4 }, note:'Each body eaten adds 6.2 damage, up to 60 held; 9s without a kill forgets everything.' },
      { id:'sprawl', name:'SPRAWL', cost:400, mods:{ damage:46, gestaltPerKill:2.4, gestaltMax:40, gestaltDecay:16, gestaltRange:0.030, range:3.4 },
        surge:{ gestaltDecay:1 }, note:'Each body adds 2.4 damage and 0.030 tiles of reach, 40 held, 16s before forgetting.' } ]
  },

  maw: {
    id:'maw', element:'void', origin:'xeno', name:'MAW', role:'Swallows one creature whole', cost:310, costGrowth:1.88,
    color:'#7c3aed', dark:'#2b0f5c', attack:'maw', glyph:'⊙',
    desc:'It does not shoot. It opens, and the largest thing in reach is GONE not killed, REMOVED, no bounty, no corpse to send at anybody, nothing left to reanimate, and one fewer creature on the wave. What it swallowed is digested into gold over the next several seconds instead, and that is the only payment you get for it. Against a single elite you cannot out-damage, it is the whole answer; against a swarm it eats one mite and looks foolish. CONDITIONAL, and the hardest counter in the arsenal.',
    /* mawYield is a multiple of what the swallowed body WOULD have paid.
       At 1.0 removal is gold-neutral and nothing else; below it, deleting a
       creature costs you money, which is the honest price of refusing to
       fight something. The bounty itself is never paid -- Game.killEnemy
       returns on the removed-not-killed flag before it reaches awardGold --
       so this is a replacement for the bounty, never a second copy of it. */
    base:{ range:3.0, dmgType:'none', mawCd:18, mawDigest:6, mawYield:1.0 },
    levels:[ { cost:200, name:'CRAW',    mods:{ mawCd:15, mawDigest:5.5, mawYield:1.4, range:3.3 } },
             { cost:370, name:'ABYSSAL', mods:{ mawCd:12.5, mawDigest:5, mawYield:1.9, range:3.6 } } ],
    talents:[
      { id:'mw_fast',  row:0, col:0, name:'QUICK HUNGER',    desc:'Opens 25% more often.',    mods:{ mawCdMul:0.75 } },
      { id:'mw_rich',  row:0, col:1, name:'RICH MEAL',       desc:'+60% digested gold.',      mods:{ mawYieldMul:1.60 } },
      { id:'mw_wide',  row:1, col:0, name:'LONG REACH',      desc:'+30% radius.',             mods:{ rangeMul:1.30 } },
      { id:'mw_quick', row:1, col:1, name:'FAST DIGESTION',  desc:'Digests 40% sooner.',      mods:{ mawDigestMul:0.60 } },
      { id:'mw_deep',  row:2, col:0, name:'SECOND STOMACH',  desc:'Opens 30% more often.',    mods:{ mawCdMul:0.70 } },
      { id:'mw_boss',  row:2, col:1, name:'TITAN\'S PORTION', desc:'It can swallow a boss.',  mods:{ mawBoss:true } } ],
    branches:[
      { id:'devourer',   name:'DEVOURER',   cost:500, mods:{ mawCd:9, mawDigest:4, mawYield:1.6, mawBoss:true, range:3.8 },
        surge:{ mawYield:0.15 }, note:'Swallows every 9s, a boss included, paying ×1.6 bounty over a 4s digest.' },
      { id:'rumination', name:'RUMINATION', cost:500, mods:{ mawCd:22, mawDigest:11, mawYield:5.0, range:4.2 },
        surge:{ mawYield:0.4 }, note:'Swallows every 22s, paying ×5 bounty over an 11s digest. One slow meal.' } ]
  },

  veil: {
    id:'veil', element:'void', origin:'xeno', name:'HUNGERING VEIL', role:'Bills healing back as damage', cost:225, costGrowth:1.66,
    color:'#c084fc', dark:'#3b0764', attack:'veil', glyph:'◌',
    desc:'Deals damage equal to all healing a target ever received; ignores armour and shields.',
    lore:'The field keeps accounts.',
    base:{ range:3.0, dmgType:'pure', veilHealTax:1.0 },
    levels:[ { cost:155, name:'ARREARS',     mods:{ veilHealTax:1.35, range:3.3 } },
             { cost:290, name:'FORECLOSURE', mods:{ veilHealTax:1.75, range:3.6 } } ],
    talents:[
      { id:'vl_wide', row:0, col:0, name:'DEEPER SHROUD',  desc:'+35% radius.',                             mods:{ rangeMul:1.35 } },
      { id:'vl_tax',  row:0, col:1, name:'HARSHER TERMS',  desc:'+0.5 damage per point ever healed.',       mods:{ veilHealTax:0.5 } },
      { id:'vl_slow', row:1, col:0, name:'WEIGHT OF DEBT', desc:'Everything inside is slowed 20%.',         mods:{ veilSlow:0.20 } },
      { id:'vl_vuln', row:1, col:1, name:'IN ARREARS',     desc:'Anything still in debt takes +18% damage.', mods:{ veilVuln:0.18 } },
      { id:'vl_deep', row:2, col:0, name:'TOTAL RECALL',   desc:'+0.8 damage per point ever healed.',       mods:{ veilHealTax:0.8 } },
      { id:'vl_gold', row:2, col:1, name:'COLLECTIONS',    desc:'Every 250 points collected pays 25 gold.', mods:{ veilTithe:25 } } ],
    branches:[
      { id:'ledger', name:'THE LEDGER', cost:380, mods:{ veilHealTax:3.2, veilVuln:0.22, range:3.8 },
        surge:{ veilHealTax:0.15 }, note:'Bills 3.2 damage per point ever healed; debtors take 22% more. Nothing is forgiven.' },
      { id:'famine', name:'FAMINE',     cost:380, mods:{ veilHealTax:1.5, veilSlow:0.38, range:5.0 },
        surge:{ rangeMul:1.05 }, note:'A 5-tile field: everything inside slowed 38%, billed 1.5 damage per point ever healed.' } ]
  }
});

/* Merge into the master roster. */

Object.assign(TOWER_TYPES_2, {
  /* SESSION 21 -- THE HEAVIES. Two per origin, each especially powerful
     and each paying for it in BOARD: foot:[2,2] claims four tiles, the one
     cost base-level retrofit can never refund. Inside TOWER_TYPES_2 for
     the same reason the Session-19 six are: applyGoldSquish runs once at
     the foot of this file, and anything added after it keeps unsquished
     prices for the rest of the match. The pirate gun was authored as a
     second BOMBARD; the adjudication renamed it CARRONADE -- the naval
     smasher -- and its talent ids moved bd_* -> cn_* with it. */
  bombard: {
    id:'bombard', element:'fire', origin:'human', name:'BOMBARD', role:'Siege battery: blind up close', cost:380, costGrowth:1.82,
    color:'#f97316', dark:'#5f2a08', attack:'lobbed', groundOnly:true, glyph:'✸', foot:[2,2],
    desc:'Board-length shells with huge splash; overkill damage rolls to the next enemy. Blind inside 3 tiles and to air.',
    lore:'The coalition\'s largest gun.',
    /* `minRange` is a DEAD ZONE in tiles: acquire() refuses anything nearer,
       which is the whole placement question this tower asks. `overkill` is
       the share of surplus kill damage the shell rolls into the next body --
       read on the detonate path (Projectile.rollOverkill), never on impact,
       because the only carrier is a lobbed shell that always bursts. */
    base:{ damage:95, range:9.0, minRange:3.0, rate:0.30, projSpeed:7, dmgType:'physical', splash:1.8, overkill:0.6 },
    levels:[ { cost:230, name:'DEMICANNON', mods:{ damage:320, splash:2.0, overkill:0.75 } },
             { cost:420, name:'BASILISK',   mods:{ damage:520, splash:2.2, range:10.0, rate:0.34, overkill:0.9 } } ],
    talents:[
      { id:'bd_hoist',   row:0, col:0, name:'SHELL HOIST',      desc:'+40% fire rate.',                          mods:{ rateMul:1.40 } },
      { id:'bd_charge',  row:0, col:1, name:'DOUBLE CHARGE',    desc:'+45% damage, −10% fire rate.',             mods:{ damageMul:1.45, rateMul:0.90 } },
      { id:'bd_carriage',row:1, col:0, name:'ROLLING CARRIAGE', desc:'Shrinks the dead zone by 1 full tile.',    mods:{ minRange:-1.0 } },
      { id:'bd_through', row:1, col:1, name:'THROUGHSHOT',      desc:'A further 25% of surplus damage rolls onward.', mods:{ overkill:0.25 } },
      { id:'bd_pit',     row:2, col:0, name:'GUN PIT',          desc:'+35% splash radius.',                      mods:{ splashMul:1.35 } },
      { id:'bd_mag',     row:2, col:1, name:'FULL MAGAZINE',    desc:'+30% damage and +15% fire rate.',          mods:{ damageMul:1.30, rateMul:1.15 } } ],
    branches:[
      { id:'culverin', name:'CULVERIN', cost:620, mods:{ damage:900, rate:0.30, splash:1.7, range:12.0, minRange:3.5, projSpeed:10, overkill:1.0 },
        surge:{ damage:110 }, note:'900 damage at 12 range, 100% of overkill rolling onward. Blind inside 3.5 tiles.' },
      { id:'drumfire', name:'DRUMFIRE', cost:620, mods:{ damage:340, rate:0.85, splash:2.4, minRange:2.0, overkill:0.7 },
        surge:{ rate:0.06 }, note:'340-damage shells at 0.85/s across a 2.4 splash. The dead zone shrinks to 2 tiles.' } ]
  },

  coldfront: {
    id:'coldfront', element:'frost', origin:'human', name:'COLDFRONT', role:'Manufactures weather: the field itself slows', cost:340, costGrowth:1.95,
    color:'#a5f3fc', dark:'#155e75', attack:'front', glyph:'❄', foot:[2,2],
    desc:'Never fires. Its field stacks a slow that deepens with exposure, caps, and follows enemies out. Bosses chill at half rate.',
    lore:'It makes weather.',
    /* `exposure` is slow ADDED PER SECOND to every body in the field, climbing
       to `exposureCap`; `exposureShed` is how fast a body clear of every front
       loses it again. The meter and the shed rate ride the UNIT (entities.js),
       so overlapping fronts share one meter and never wind it backward. */
    base:{ range:3.5, dmgType:'none', exposure:0.08, exposureCap:0.50, exposureShed:0.35 },
    levels:[ { cost:210, name:'DEEP WINTER', mods:{ exposure:0.12, exposureCap:0.62, range:3.8 } },
             { cost:390, name:'ICE AGE',     mods:{ exposure:0.16, exposureCap:0.72, range:4.2, exposureShed:0.25 } } ],
    talents:[
      { id:'cf_wide',  row:0, col:0, name:'WIDE FRONT',  desc:'+35% field radius.',                            mods:{ rangeMul:1.35 } },
      { id:'cf_cool',  row:0, col:1, name:'OVERCOOLED',  desc:'Exposure builds 35% faster.',                   mods:{ exposureMul:1.35 } },
      { id:'cf_ice',   row:1, col:0, name:'BLACK ICE',   desc:'+0.10 to the exposure ceiling.',                mods:{ exposureCap:0.10 } },
      { id:'cf_linger',row:1, col:1, name:'LONG WINTER', desc:'The cold follows them out: sheds 40% slower.', mods:{ exposureShedMul:0.60 } },
      { id:'cf_blind', row:2, col:0, name:'SNOWBLIND',   desc:'Bodies at the ceiling take +20% damage.',       mods:{ exposureVuln:0.20 } },
      { id:'cf_chill', row:2, col:1, name:'WINDCHILL',   desc:'+25% radius, and exposure builds 15% faster.',  mods:{ rangeMul:1.25, exposureMul:1.15 } } ],
    branches:[
      { id:'whiteout',     name:'WHITEOUT',     cost:560, mods:{ exposure:0.22, exposureCap:0.80, exposureFreeze:1.2, exposureShed:0.25, range:4.6 },
        surge:{ exposureFreeze:0.12 }, note:'Slow deepens 22% per second to 80%; at the cap a 1.2s freeze, once per body.' },
      { id:'shatterfront', name:'SHATTERFRONT', cost:560, mods:{ exposure:0.18, exposureCap:0.65, exposureVuln:0.35, exposureShed:0.30, range:5.0 },
        surge:{ exposureVuln:0.05 }, note:'Slow builds 18% per second to 65%; bodies at the cap take 35% more damage.' } ]
  },

  quadmount: {
    id:'quadmount', element:'frost', origin:'robotic', name:'QUAD MOUNT', role:'Four independent fire solutions', cost:545, costGrowth:1.92,
    color:'#a5f3fc', dark:'#155e75', attack:'turrets', glyph:'∷', foot:[2, 2],
    desc:'Four cryo cannon on one traversing bed, each barrel holding its OWN fire solution: four targets engaged at once, every shell landing cold and slowing what it hits. Barrels with nobody left to claim converge on a claimed hull and hit harder for the company, so the same machine answers a swarm and a boss. The footprint is the price of the mount: a bed that traverses four barrels independently does not fit on one tile, and the four tiles it takes are the one bill a base-level retrofit can never refund.',
    /* `turrets` is the identity -- the only gun whose target COUNT is a
       stat -- and `convergeBonus` pays surplus barrels for doubling up.
       Both deterministic, as the origin demands: no proc, no gamble. */
    base:{ damage:24, range:4.0, rate:1.0, projSpeed:16, dmgType:'magic',
           turrets:4, convergeBonus:0.10, slow:0.20, slowDur:1.4 },
    levels:[ { cost:300, name:'GUN LINE',     mods:{ damage:68, rate:1.05, slow:0.26 } },
             { cost:560, name:'FIRE CONTROL', mods:{ damage:112, rate:1.1, range:4.4, slow:0.32, slowDur:1.8, convergeBonus:0.15 } } ],
    talents:[
      { id:'qm_bore',  row:0, col:0, name:'COLD BORE',  desc:'+45% damage.',        mods:{ damageMul:1.45 } },
      { id:'qm_belt',  row:0, col:1, name:'BELT FEED',  desc:'+35% fire rate.',     mods:{ rateMul:1.35 } },
      { id:'qm_mount', row:1, col:0, name:'TALL MOUNT', desc:'+30% range.',         mods:{ rangeMul:1.30 } },
      { id:'qm_frost', row:1, col:1, name:'HARD FROST', desc:'+40% chill potency.', mods:{ statusMul:1.40 } },
      { id:'qm_box',   row:2, col:0, name:'KILL BOX',   desc:'Converged barrels hit a further +15% per barrel already on the hull.', mods:{ convergeBonus:0.15 } },
      { id:'qm_fifth', row:2, col:1, name:'FIFTH GUN',  desc:'+1 barrel.',          mods:{ turrets:1 } } ],
    branches:[
      { id:'enfilade',  name:'ENFILADE',  cost:640, mods:{ damage:165, rate:1.15, turretFocus:true, convergeBonus:0.30 },
        surge:{ convergeBonus:0.04 }, note:'Four barrels, 165 damage each, all on the strongest hull; +30% per barrel already on.' },
      { id:'fusillade', name:'FUSILLADE', cost:640, mods:{ damage:130, rate:1.2, turrets:6, slow:0.30, slowDur:1.6 },
        surge:{ turrets:1 }, note:'Six barrels at 130 damage, every shell slowing 30% for 1.6s. Cold in six lanes.' } ]
  },

  reactor: {
    id:'reactor', element:'storm', origin:'robotic', name:'REACTOR', role:'Runs the lattice past its rating', cost:585, costGrowth:2.25,
    color:'#fde047', dark:'#713f12', attack:'aura', glyph:'⌁', foot:[2, 2],
    desc:'Fires nothing. It is the grid\'s missing half every machine in its field runs at the reactor\'s RATED lattice, wherever its neighbours actually stand, and the rating climbs past the governed four, which no amount of standing together can reach. Machines stop paying for geometry; the reactor pays for them, in AREA. Four tiles of containment is what a core this size costs, and it is the one price a base-level retrofit can never refund.',
    /* latticeFill is a RATING, not a bonus: a machine in the field takes
       max(own links, rating), so it stacks with nothing and cheats nothing.
       Above ORIGIN_LATTICE_MAX it is the only way past the cap, which is
       the whole reason it is priced like a second Vault. */
    base:{ range:3.0, dmgType:'none', latticeFill:4 },
    levels:[ { cost:320, name:'TURBINE HALL', mods:{ latticeFill:5, range:3.4 } },
             { cost:600, name:'POWERHOUSE',   mods:{ latticeFill:6, range:3.8 } } ],
    talents:[
      { id:'rc_yard', row:0, col:0, name:'SWITCHYARD',     desc:'+35% field radius.',                       mods:{ rangeMul:1.35 } },
      { id:'rc_rate', row:0, col:1, name:'SURPLUS RATING', desc:'+1 rated lattice.',                        mods:{ latticeFill:1 } },
      { id:'rc_duty', row:1, col:0, name:'DUTY CYCLE',     desc:'Everything in the field fires 8% faster.', mods:{ auraRate:0.08 } },
      { id:'rc_feed', row:1, col:1, name:'TARGET FEED',    desc:'+8% range to everything in the field.',    mods:{ auraRange:0.08 } },
      { id:'rc_bus',  row:2, col:0, name:'BUSBAR',         desc:'+1 rated lattice and +20% radius.',        mods:{ latticeFill:1, rangeMul:1.20 } },
      { id:'rc_main', row:2, col:1, name:'MAINS FEED',     desc:'+10% damage to everything in the field.',  mods:{ auraDmg:0.10 } } ],
    branches:[
      { id:'supercritical', name:'SUPERCRITICAL', cost:700, mods:{ latticeFill:8, range:3.2 },
        surge:{ latticeFill:1 }, note:'Machines in its 3.2-tile field run at lattice 8: +40% damage, +28% rate. A close orbit.' },
      { id:'intertie',      name:'INTERTIE',      cost:700, mods:{ latticeFill:6, range:5.2, auraRate:0.10, auraRange:0.10 },
        surge:{ rangeMul:1.05 }, note:'A 5.2-tile field supplies lattice 6 plus 10% rate and 10% range to everything inside.' } ]
  },

  carronade: {
    /* THE PIRATE HEAVIES (Session 21). foot:[2,2] -- the engine work for the
       footprint is a separate design; per-tower notes travel with the def.
       BOMBARD is the origin rider at siege stakes: overloadMult and
       overloadSplash override ORIGIN_PIRATE_MULT for this tower only, and
       heatBank/jamFor override ORIGIN_PIRATE_HEAT_MAX / ORIGIN_PIRATE_JAM --
       three overloads to a magazine, then seconds of silence. */
    id:'carronade', element: 'fire', origin:'pirate', name:'CARRONADE', role:'Siege battery whose overloads detonate', cost:425, costGrowth:1.88,
    color:'#fdba74', dark:'#7c2d12', attack:'lobbed', groundOnly:true, glyph:'✹', foot:[2, 2],
    desc:'Arcing splash shells. An overload detonates at the impact point; after three the gun jams until re-laid.',
    lore:'A first-rate\'s gun, deck and all.',
    base:{ damage:62, range:4.6, rate:0.34, projSpeed:12, dmgType:'physical', splash:1.8,
           burn:10, burnDur:2.0, overloadMult:3.4, overloadSplash:1.5, heatBank:3, jamFor:3.5 },
    levels:[ { cost:260, name:'GUN DECK',   mods:{ damage:150, splash:2.0, burn:18 } },
             { cost:470, name:'FIRST RATE', mods:{ damage:260, splash:2.3, range:5.0, burn:28, overloadMult:4.0 } } ],
    talents:[
      { id:'cn_shot',   row:0, col:0, name:'DOUBLE SHOTTED',  desc:'+45% shell damage.',                    mods:{ damageMul:1.45 } },
      { id:'cn_quoin',  row:0, col:1, name:'QUOIN WEDGES',    desc:'+25% range, +15% blast radius.',        mods:{ rangeMul:1.25, splashMul:1.15 } },
      { id:'cn_worm',   row:1, col:0, name:'WORM AND SPONGE', desc:'A cooked-off gun recovers 40% sooner.', mods:{ jamForMul:0.60 } },
      { id:'cn_hot',    row:1, col:1, name:'HOT SHOT',        desc:'+60% burn damage and duration.',        mods:{ statusMul:1.60 } },
      { id:'cn_monkey', row:2, col:0, name:'POWDER MONKEYS',  desc:'+30% fire rate.',                       mods:{ rateMul:1.30 } },
      { id:'cn_locker', row:2, col:1, name:'SHOT LOCKERS',    desc:'The magazine banks 2 more overloads before it cooks off.', mods:{ heatBank:2 } } ],
    branches:[
      { id:'hellburner', name:'HELLBURNER', cost:620, mods:{ damage:340, rate:0.36, overloadMult:6.0, overloadSplash:2.2, heatBank:2, jamFor:5.0 },
        surge:{ overloadMult:0.4 }, note:'Overloads detonate at ×6 across 2.2 tiles; two to a magazine, then a 5s jam.' },
      { id:'siegetrain', name:'SIEGE TRAIN', cost:620, mods:{ damage:420, rate:0.44, splash:2.6, overloadMult:3.0, heatBank:6, jamFor:2.0 },
        surge:{ damage:90 }, note:'420-damage shells across a 2.6 splash; six ×3 overloads banked before a 2s jam.' } ]
  },

  stokehold: {
    /* THE PIRATE HEAVIES (Session 21). foot:[2,2]. STOKEHOLD is the heat bank
       inverted: the rider's downside becomes its fuel. The transfer clause
       lives in the pirate rider block in entities.js (see BOMBARD's note);
       atk_stoke ticks the furnace, the bleed, and FIRESHIP's vent. `stoke`
       is the banked-points field -- NOT `heat`, which the rider owns, and
       NOT `heatT`, which PYRE owns. */
    id:'stokehold', element: 'fire', origin:'pirate', name:'STOKEHOLD', role:'Boiler that feeds on the battery\'s heat', cost:390, costGrowth:1.96,
    color:'#f97316', dark:'#5a1e07', attack:'stoke', glyph:'♨', foot:[2, 2],
    desc:'A capital ship\'s boiler cut out whole and set down still lit. It fires nothing. Friendly pirate guns in reach dump their overload heat into its bank INSTEAD of jamming, and every point banked stokes a furnace field that cooks the lane around the hull: a structure that WANTS the battery reckless, because the bank boils off on its own and a line that stops gambling watches the fire die. Four tiles because nothing smaller holds a battery\'s worth of heat: the footprint is the boiler.',
    base:{ range:2.7, dmgType:'magic', stokeBurn:9, stokePerHeat:7, stokeMax:10, stokeReach:3.6, stokeBleed:0.4 },
    levels:[ { cost:240, name:'BLACK GANG',  mods:{ stokeBurn:16, stokePerHeat:12, stokeMax:14, range:2.9 } },
             { cost:430, name:'DREADNOUGHT', mods:{ stokeBurn:26, stokePerHeat:18, stokeMax:20, stokeReach:4.2, range:3.2 } } ],
    talents:[
      { id:'sk_draught', row:0, col:0, name:'FORCED DRAUGHT',   desc:'Each banked point burns 40% harder.', mods:{ stokePerHeatMul:1.40 } },
      { id:'sk_trim',    row:0, col:1, name:'COAL TRIMMERS',    desc:'The boiler loses heat 40% slower.',   mods:{ stokeBleedMul:0.60 } },
      { id:'sk_flue',    row:1, col:0, name:'LONG FLUES',       desc:'+35% sink reach.',                    mods:{ stokeReachMul:1.35 } },
      { id:'sk_bars',    row:1, col:1, name:'FIREBARS',         desc:'+30% furnace radius.',                mods:{ rangeMul:1.30 } },
      { id:'sk_triple',  row:2, col:0, name:'TRIPLE EXPANSION', desc:'+6 boiler capacity.',                 mods:{ stokeMax:6 } },
      { id:'sk_scald',   row:2, col:1, name:'SCALDING STEAM',   desc:'+50% furnace floor burn.',            mods:{ stokeBurnMul:1.50 } } ],
    branches:[
      { id:'overpressure', name:'OVERPRESSURE', cost:580, mods:{ stokeBurn:40, stokePerHeat:26, stokeMax:34, stokeBleed:0.25, range:3.5 },
        surge:{ stokeMax:3 }, note:'Burns 40/s plus 26/s per banked point, 34 held, bleeding 0.25 points per second.' },
      { id:'fireship', name:'FIRESHIP', cost:580, mods:{ stokeBurn:30, stokePerHeat:16, stokeMax:16, stokeVent:22, range:3.3 },
        surge:{ stokeVent:6 }, note:'A full 16-point bank vents 22 damage per point across the field, then restarts cold.' } ]
  },

  suture: {
    id:'suture', element:'venom', origin:'xeno', name:'SUTURE', role:'Sews the wave into one flesh', cost:430, costGrowth:1.94,
    color:'#bef264', dark:'#2f4a10', attack:'graft', glyph:'≬', foot:[2,2],
    desc:'Links enemies in reach; a share of damage any one takes hits all of them. No effect on a lone target.',
    lore:'It sews the wave into one flesh.',
    /* graftFrac is a SHARE, and the repeat pays out once per other body, so a
       graft of n is worth frac*(n-1) on every hit -- quadratic in the catch.
       That curve is the tower, and GRAFT_FRAC_MAX is what keeps a surged
       BLOOD KNOT from repeating more wound than was ever dealt. */
    base:{ damage:16, range:3.4, rate:0.5, dmgType:'magic', graftCount:4, graftFrac:0.22, graftDur:6 },
    levels:[ { cost:235, name:'LIGATURE', mods:{ damage:30, graftCount:6, graftFrac:0.28 } },
             { cost:440, name:'CHIMERA',  mods:{ damage:48, graftCount:8, graftFrac:0.34, graftDur:8, range:3.7 } } ],
    talents:[
      { id:'su_wide',  row:0, col:0, name:'WIDE STITCH',   desc:'+2 bodies held in the graft.',        mods:{ graftCount:2 } },
      { id:'su_deep',  row:0, col:1, name:'DEEP THREAD',   desc:'+10% of every wound repeated.',       mods:{ graftFrac:0.10 } },
      { id:'su_lash',  row:1, col:0, name:'RAW SINEW',     desc:'+45% lash damage.',                   mods:{ damageMul:1.45 } },
      { id:'su_reach', row:1, col:1, name:'LONG FIBRES',   desc:'+30% reach.',                         mods:{ rangeMul:1.30 } },
      { id:'su_sep',   row:2, col:0, name:'SEPTIC THREAD', desc:'Grafted bodies take +15% damage.',    mods:{ graftVuln:0.15 } },
      { id:'su_hold',  row:2, col:1, name:'TIGHT WEAVE',   desc:'Grafts hold 4s longer.',              mods:{ graftDur:4 } } ],
    branches:[
      { id:'oneflesh', name:'ONE FLESH',  cost:620, mods:{ damage:66, graftCount:14, graftFrac:0.30, graftDur:10, range:4.0 },
        surge:{ graftCount:1 }, note:'Grafts 14 bodies for 10s; 30% of every wound repeats across all of them.' },
      { id:'bloodknot', name:'BLOOD KNOT', cost:620, mods:{ damage:88, graftCount:3, graftFrac:0.95, graftDur:8, graftVuln:0.20 },
        surge:{ graftFrac:0.05 }, note:'Binds 3 bodies for 8s: wounds repeat at 95%, and the grafted take 20% more.' } ]
  },

  impaler: {
    id:'impaler', element:'fire', origin:'xeno', name:'IMPALER', role:'Falls on the worst wound on the board', cost:470, costGrowth:2.10,
    color:'#fb923c', dark:'#5a2506', attack:'impale', glyph:'⟟', foot:[2,2],
    desc:'Strikes the most wounded enemy on the board, harder the deeper the wound. Never hits full health.',
    lore:'A spine over every lane.',
    /* range is board-wide on purpose, same clause as ORISON: it names one
       wound out of the whole field, which is why it argues with your LINE
       (something must cut first) instead of with its own placement. */
    base:{ damage:62, range:99, rate:0.22, projSpeed:26, dmgType:'physical', homing:true, impaleScale:3.0, impaleFloor:0.25 },
    levels:[ { cost:260, name:'GREATSPINE', mods:{ damage:112, impaleScale:3.6 } },
             { cost:480, name:'WORLDSPINE', mods:{ damage:178, impaleScale:4.2, impaleFloor:0.20, rate:0.26 } } ],
    talents:[
      { id:'im_barb',  row:0, col:0, name:'BARBED HEAD',    desc:'+45% damage.',                          mods:{ damageMul:1.45 } },
      { id:'im_fast',  row:0, col:1, name:'SHORT PATIENCE', desc:'Strikes 25% more often.',               mods:{ rateMul:1.25 } },
      { id:'im_fresh', row:1, col:0, name:'FRESH MEAT',     desc:'Falls on wounds 10% shallower.',        mods:{ impaleFloor:-0.10 } },
      { id:'im_scale', row:1, col:1, name:'FEVERED SPINE',  desc:'+1.0 wound scaling.',                   mods:{ impaleScale:1.0 } },
      { id:'im_split', row:2, col:0, name:'SPLINTER',       desc:'The spine shatters 1.0 tiles wide.',    mods:{ splash:1.0 } },
      { id:'im_burn',  row:2, col:1, name:'RENDING HEAT',   desc:'Hits burn for 24/s over 3s.',           mods:{ burn:24, burnDur:3 } } ],
    branches:[
      { id:'abattoir',   name:'ABATTOIR',   cost:660, mods:{ damage:120, rate:0.55, impaleScale:3.2, impaleFloor:0.30 },
        surge:{ rate:0.03 }, note:'120-damage spines at 0.55/s, up to ×4.2 at a full wound; nothing under 30% hurt.' },
      { id:'extinction', name:'EXTINCTION', cost:660, mods:{ damage:340, rate:0.14, impaleScale:6.0, impaleFloor:0.40, splash:1.4 },
        surge:{ damage:60 }, note:'A 340-damage spine at 0.14/s with 1.4 splash, up to ×7; nothing under 40% hurt.' } ]
  },

  monstrance: {
    id:'monstrance', element:'radiant', origin:'light', name:'MONSTRANCE', role:'Holds one body utterly open', cost:432, costGrowth:2.15, foot:[2,2],
    color:'#fef08a', dark:'#6b5407', attack:'beam', glyph:'✶',
    desc:'Beam holds open a share of one target\'s armour and resistances, for every tower you own. Prefers the strongest enemy.',
    lore:'A chapel window turned weapon.',
    /* rampMax:1 is deliberate and load-bearing: updateBeam defaults an
       unstated ramp to PRISM's, and a Monstrance that ramped would be a
       gilded Prism. 1 zeroes the ramp term whatever `ramp` defaults to.
       revealFrac is capped by REVEAL_CAP (config.js) at the moment it is
       spent, so the branch figure below may honestly approach 1.0 without
       the engine ever having to make an immunity literal. */
    base:{ damage:34, range:5.0, rate:1, dmgType:'magic', rampMax:1, preferStrongest:true, revealFrac:0.45, revealLinger:1.2 },
    levels:[ { cost:280, name:'OSTENSORIUM', mods:{ damage:60, revealFrac:0.58 } },
             { cost:520, name:'EPIPHANY',    mods:{ damage:94, revealFrac:0.70, revealLinger:2.0, range:5.5 } } ],
    talents:[
      { id:'ms_burn', row:0, col:0, name:'BRIGHTER TRUTH',  desc:'+45% beam damage.',                                     mods:{ damageMul:1.45 } },
      { id:'ms_wide', row:0, col:1, name:'GREAT APERTURE',  desc:'+25% range.',                                           mods:{ rangeMul:1.25 } },
      { id:'ms_deep', row:1, col:0, name:'FULL DISCLOSURE', desc:'A further 12% of the target\'s protections held open.', mods:{ revealFrac:0.12 } },
      { id:'ms_ling', row:1, col:1, name:'AFTERGLOW',       desc:'The opening outlasts the beam by 2s.',                  mods:{ revealLinger:2 } },
      { id:'ms_bare', row:2, col:0, name:'CANDOUR',         desc:'The beam itself ignores 40% of armour.',                mods:{ pierce:0.40 } },
      { id:'ms_twin', row:2, col:1, name:'SECOND WITNESS',  desc:'Holds a second body open at 55% strength.',             mods:{ split:2, splitFalloff:0.55 } } ],
    branches:[
      { id:'revelation', name:'REVELATION', cost:620, mods:{ damage:170, revealFrac:0.92, revealLinger:3.0, range:6.0 },
        surge:{ revealLinger:0.3 }, note:'Holds 92% of the target\'s protections open for every tower, lingering 3s after the beam.' },
      { id:'theophany',  name:'THEOPHANY',  cost:620, mods:{ damage:120, revealFrac:0.62, split:3, splitFalloff:0.65 },
        surge:{ splitFalloff:0.03 }, note:'Splits across 3 bodies, extra beams at 65% strength, holding 62% of protections open.' } ]
  },

  pharos: {
    id:'pharos', element:'fire', origin:'light', name:'PHAROS', role:'A turning lamp that owns the approach', cost:398, costGrowth:2.02, foot:[2,2],
    color:'#fdba74', dark:'#7c2d12', attack:'cone', glyph:'☀',
    desc:'A lighthouse of the Host: a sacred flame on four tiles of foundation, turning on its own clock. It does not aim and it cannot be made to: no jam, no bait, no body on the board changes where the light is pointing; the beam simply comes round, and everything it crosses burns, wades, and is left with its protections held open for whoever shoots next. The footprint is the price of the elevation: a lamp that must see the WHOLE approach cannot stand on one tile. At a board edge half of every revolution lights empty dark: where you put it is most of what it does.',
    /* sweepRate is radians per second: 1.05 is one full turn every six
       seconds. The lamp reuses the cone verb's geometry, burn and status
       hooks wholesale; the ONLY new behaviour is that `angle` is driven by
       the clock instead of by acquisition, which is the identity. */
    base:{ damage:26, range:5.5, rate:1, dmgType:'magic', cone:0.55, burn:12, burnDur:2.6, sweepRate:1.05, sweepBeams:1 },
    levels:[ { cost:260, name:'WATCHFIRE', mods:{ damage:46, burn:22, range:6.0 } },
             { cost:480, name:'DAYSPRING', mods:{ damage:72, burn:34, burnDur:3.0, range:6.6, cone:0.62 } } ],
    talents:[
      { id:'ph_oil',   row:0, col:0, name:'SACRED OIL',     desc:'+45% lamp damage.',                    mods:{ damageMul:1.45 } },
      { id:'ph_high',  row:0, col:1, name:'HIGH GALLERY',   desc:'+20% range.',                          mods:{ rangeMul:1.20 } },
      { id:'ph_wide',  row:1, col:0, name:'BROAD LIGHT',    desc:'+40% beam width.',                     mods:{ coneMul:1.40 } },
      { id:'ph_turn',  row:1, col:1, name:'TIRELESS WHEEL', desc:'The lamp turns 35% faster.',           mods:{ sweepRateMul:1.35 } },
      { id:'ph_pitch', row:2, col:0, name:'PITCH FIRE',     desc:'+10/s to the fire it leaves.',         mods:{ burn:10 } },
      { id:'ph_hvy',   row:2, col:1, name:'HEAVY LIGHT',    desc:'Anything in the beam is slowed 30%.',  mods:{ slow:0.30, slowDur:1.2 } } ],
    branches:[
      { id:'solstice', name:'SOLSTICE', cost:580, mods:{ damage:98, burn:40, sweepBeams:2, range:6.8 },
        surge:{ damage:10 }, note:'Two beams back to back: 98/s each plus a 40/s burn at 6.8 range. Half the dark.' },
      { id:'noontide', name:'NOONTIDE', cost:580, mods:{ damage:64, burn:52, burnDur:4.0, cone:1.5, sweepRate:0.7, range:7.2 },
        surge:{ coneMul:1.03 }, note:'A cone 1.5 wide turning at 0.7: 64/s plus a 52/s burn for 4s. Always noon somewhere.' } ]
  },
});

Object.assign(TOWER_TYPES, TOWER_TYPES_2);
TOWER_ORDER.push('foundry', 'saboteur', 'rampart', 'executioner', 'chrono', 'echo',
                 'quake', 'siren', 'alchemist', 'glaive', 'cyclone', 'capacitor',
                 'shepherd', 'ward', 'reckoning', 'arbalest',
                 'custodian', 'concord', 'ichor', 'pylon',
                 /* Session 19. The DEFINITIONS above are inside TOWER_TYPES_2
                    and so are already merged by the Object.assign two lines up
                    -- which is what matters, because applyGoldSquish() below
                    walks TOWER_TYPES and is the ONE pass that reaches a price.
                    Anything defined after it keeps pre-squish numbers and is
                    eight times too expensive. */
                 'pressgang', 'privateer', 'bloodprice', 'replicator', 'nullfield');

/* NULL FIELD authors its volume ONCE, as `nullRadius`. Tower.recompute
   publishes it as `range` for everything LIVE -- but the static surfaces read
   `base.range` straight off this table: the tower tooltip and the loadout
   card (ui.js) and the placement ghost (Game.drawBuildOverlay). With no
   `range` in the table a 3.2-tile field shipped with a "0.0 tiles" tooltip
   and a build ghost of zero radius. So the table's `range` is DERIVED from
   the authored figure here rather than written beside it: authoring the same
   distance twice is how the eight UI/engine desyncs in this project's history
   all began. */
for (const id in TOWER_TYPES) {
  const b = TOWER_TYPES[id].base;
  if (b && b.nullRadius) b.range = b.nullRadius;
}

/* GOLD SQUISH runs here and only here: both rosters are now in TOWER_TYPES,
   so one loop reaches every price, bounty and purse (config.js). */
applyGoldSquish();

/* SESSION 19 -- THE SIX. Light to ten, Xeno to ten. Appended here rather than
   spliced into the statement above so this insert is clear of every other
   Session 19 edit in this file; applyGoldSquish iterates TOWER_TYPES and never
   TOWER_ORDER, so an id added after it is still priced by the squish that
   already ran.

   `splice` rather than `push` on purpose: a sibling Session 19 patch finds its
   own roster edit by searching for the literal TOWER_ORDER-dot-push and
   refuses to write when that string is not unique in the file. Same append,
   same result, and the merge now lands in either arrival order. */
TOWER_ORDER.splice(TOWER_ORDER.length, 0,
                   'sepulchre', 'orison', 'antiphon', 'gestalt', 'maw', 'veil');

/* SESSION 21 -- THE HEAVIES. Same append-after-squish argument as the six
   above: applyGoldSquish walks TOWER_TYPES, never TOWER_ORDER. */
TOWER_ORDER.splice(TOWER_ORDER.length, 0,
                   'bombard', 'coldfront', 'quadmount', 'reactor',
                   'carronade', 'stokehold', 'suture', 'impaler',
                   'monstrance', 'pharos');

/* --------------------------------------------------------------------------
   CAMPAIGN CONTENT, arena modifiers shown on the world-path nodes, and the
   boons you keep for the rest of a campaign after clearing a node.
-------------------------------------------------------------------------- */
const ARENA_MODS = [
  { id:'swift',    name:'SWIFT CURRENT',  icon:'»', desc:'Enemies move 25% faster here.',            apply:g => g.arenaSpeed = 1.25 },
  { id:'ironclad', name:'IRONCLAD',       icon:'▨', desc:'All enemies wear +8 armour.',              apply:g => g.arenaArmor = 8 },
  { id:'goldrush', name:'GOLD RUSH',      icon:'◈', desc:'+30% bounty from every kill.',             apply:g => { for (const s of g.sides) s.mods.gold += 0.30; } },
  { id:'scarcity', name:'SCARCITY',       icon:'▽', desc:'Bounty reduced by 20%.',                   apply:g => { for (const s of g.sides) s.mods.gold -= 0.20; } },
  { id:'deepwar',  name:'DEEP WAR',       icon:'☠', desc:'The battle begins with one escalation already active.', apply:g => g.addEnemyMod() },
  { id:'thinline', name:'THIN LINE',      icon:'♥', desc:'Both commanders field 25% fewer lives.',   apply:g => { for (const s of g.sides) { s.maxLives = Math.max(5, Math.round(s.maxLives*0.75)); s.lives = s.maxLives; } } },
  { id:'warchest', name:'WAR CHEST',      icon:'◆', desc:'Both sides start with +' + sqGold(300) + ' gold.', apply:g => { for (const s of g.sides) s.gold += sqGold(300); } },
  { id:'frenzy',   name:'FRENZY',         icon:'⚡', desc:'Waves arrive 20% faster.',                 apply:g => g.arenaTempo = 0.8 }
];

/* ── VICTORY BOONS ────────────────────────────────────────────────────────
   Five per power: four keyed to a world KIND, and an APEX paid only by a
   contested world. The power decides what kind of advantage you carry off;
   the world decides which of its five. Selected by `boonFor` below, which
   reads the two fields a world already has.

   `f` is the power you took it from, `k` the world kind it came off.
   Every key an `apply` writes must appear in BOON_FOLD in game.js -- there
   is a load-time assertion that says so, because a boon writing a key
   nothing reads is the exact shape of five talents that shipped inert. */
const BOONS = [
  /* ── HUMANITY ── late to the stars, outnumbered, and unwilling to leave.
     Bolts alien technology onto human frames and makes it work. */
  { id:'h_refit', f:'human', k:'standard', name:'FIELD REFIT', icon:'⚒',
    desc:'The first two of any tower type are built at first-copy price.',
    lore:'Salvage yards do not care whose hull it was.',
    apply:t => t.freeCopies = (t.freeCopies||0) + 2 },
  { id:'h_lastline', f:'human', k:'fortress', name:'LAST OF THE LINE', icon:'⛨',
    desc:'At or below 40% lives, every tower deals +40% damage.',
    lore:'Outnumbered is the condition, not the excuse.',
    apply:t => { t.lastStandAt = Math.max(t.lastStandAt||0, 0.40);
                 t.lastStandDmg = (t.lastStandDmg||0) + 0.40; } },
  { id:'h_salvage', f:'human', k:'forge', name:'SALVAGE RIGHTS', icon:'♻',
    desc:'Selling returns 35% more, and ascension costs 20% less.',
    lore:'Nothing is scrap. Some is not yours yet.',
    apply:t => { t.sellRate = (t.sellRate||0) + 0.35;
                 t.ascCostMul = (t.ascCostMul||1) * 0.80; } },
  { id:'h_hardpoints', f:'human', k:'nest', name:'HARD POINTS', icon:'✚',
    desc:'+6 lives, and towers shake off disruption 50% faster.',
    lore:'Bolt it down. Bolt it down again.',
    apply:t => { t.bonusLives = (t.bonusLives||0) + 6;
                 t.jamResist = (t.jamResist||0) + 0.50; } },
  { id:'h_integration', f:'human', k:'apex', name:'INTEGRATION', icon:'✶',
    desc:'Command drafts offer one more option, and arrive a wave sooner.',
    lore:'The whole doctrine, in one sentence: use what works.',
    apply:t => { t.bonusDraft = (t.bonusDraft||0) + 1;
                 t.draftSooner = (t.draftSooner||0) + 1; } },

  /* ── FEDERATION OF LIGHT ── protection offered as an Accord and signed
     under pressure. Nothing in its charter asks for your will. Its critics
     say the terms of the signature never needed to. */
  { id:'l_vigil', f:'light', k:'standard', name:'THE LONG WATCH', icon:'✧',
    desc:'Each wave you survive restores one life.',
    lore:'Someone is always awake.',
    apply:t => t.waveHeal = (t.waveHeal||0) + 1 },
  { id:'l_oath', f:'light', k:'fortress', name:'THE OATH', icon:'✞',
    desc:'The first blow that would end you does not.',
    lore:'Your signature says you keep standing. Nobody asked you again.',
    apply:t => t.immortalLine = true },
  { id:'l_reliquary', f:'light', k:'forge', name:'RELIQUARY', icon:'◈',
    desc:'Ascension costs 25% less and grants half again as much.',
    lore:'Every relic was somebody, once.',
    apply:t => { t.ascCostMul = (t.ascCostMul||1) * 0.75;
                 t.ascDamageMul = (t.ascDamageMul||1) * 1.50; } },
  { id:'l_aureole', f:'light', k:'nest', name:'AUREOLE', icon:'◎',
    desc:'Aura range +30%, and every status effect lands 25% harder.',
    lore:'The light does not stop where you stop.',
    apply:t => { t.auraRangeMul = (t.auraRangeMul||1) * 1.30;
                 t.status = (t.status||0) + 0.25; } },
  { id:'l_eternal', f:'light', k:'apex', name:'ETERNAL SERVICE', icon:'♁',
    desc:'Your dead return 40% stronger and march a quarter faster.',
    lore:'Signatures without end dates. The Accord read consent.',
    apply:t => { t.reanimMul = (t.reanimMul||0) + 0.40;
                 t.reanimSpeedMul = (t.reanimSpeedMul||1) * 1.25; } },

  /* ── THE XENO ── not a species, a cartel. The Extraction Compact binds
     what it meets into dependency and lives off what it yields. */
  { id:'x_digest', f:'xeno', k:'standard', name:'DIGESTION', icon:'◑',
    desc:'Every kill feeds the next: damage climbs as a wave dies.',
    lore:'Hunger is not a state. It is a method.',
    apply:t => t.killRamp = (t.killRamp||0) + 0.35 },
  { id:'x_carapace', f:'xeno', k:'fortress', name:'CARAPACE', icon:'⬢',
    /* reanimResist is read on the VICTIM (Game.musterHpMul), so this is a
       DEFENCE against being mustered at, not a buff to your own sends. The
       first draft of this boon described the opposite, which is the desync
       class that has shipped seven times here. */
    desc:'Everything summoned against you arrives 35% weaker.',
    lore:'It has been eaten before. It grew a lid.',
    apply:t => t.reanimResist = (t.reanimResist||0) + 0.35 },
  { id:'x_render', f:'xeno', k:'forge', name:'RENDERING', icon:'⧗',
    desc:'Siphoning drains half again as fast, and your dead pay a bounty.',
    lore:'Matter in. Matter out. Nothing wasted between.',
    apply:t => { t.siphonRate = (t.siphonRate||1) * 1.50;
                 t.reanimGold = (t.reanimGold||0) + 3; } },
  { id:'x_brood', f:'xeno', k:'nest', name:'BROODSWELL', icon:'✺',
    desc:'Everything you summon arrives 50% heavier.',
    lore:'The nest sends nothing but more of itself.',
    apply:t => t.musterHpMul = (t.musterHpMul||1) * 1.50 },
  { id:'x_consume', f:'xeno', k:'apex', name:'TOTAL CONSUMPTION', icon:'☣',
    desc:'The largest creatures take 35% more damage and pay 50% more.',
    lore:'They ate a world here. Something had to be biggest.',
    apply:t => { t.eliteDamageMul = (t.eliteDamageMul||1) * 1.35;
                 t.eliteBountyMul = (t.eliteBountyMul||1) * 1.50; } },

  /* ── THE PIRATES ── no allegiance, enemy of every power, and better
     than anyone at being where the Vigil is already going. */
  { id:'p_plunder', f:'pirate', k:'standard', name:'PLUNDER', icon:'◆',
    desc:'+18% gold from every source.',
    lore:'It was going somewhere. Now it is going here.',
    apply:t => t.goldMul = (t.goldMul||1) * 1.18 },
  { id:'p_scuttle', f:'pirate', k:'fortress', name:'SCUTTLE', icon:'⚑',
    desc:'Sell for 60% more, and every tower costs 15% less to raise.',
    lore:'Hold nothing you cannot afford to burn behind you.',
    apply:t => { t.sellRate = (t.sellRate||0) + 0.60;
                 t.costMul = (t.costMul||1) * 0.85; } },
  { id:'p_contraband', f:'pirate', k:'forge', name:'CONTRABAND', icon:'⛃',
    desc:'Each extra copy of a tower inflates its price far less.',
    lore:'There is a legitimate supply chain, and there is ours.',
    apply:t => t.costGrowthMul = (t.costGrowthMul||1) * 0.82 },
  { id:'p_dark', f:'pirate', k:'nest', name:'THE DARK ANSWERS', icon:'☾',
    desc:'Summons cost 25% less and march a fifth faster.',
    lore:'Nobody commands the swarm. It simply agrees with us.',
    apply:t => { t.musterCostMul = (t.musterCostMul||1) * 0.75;
                 t.reanimSpeedMul = (t.reanimSpeedMul||1) * 1.20; } },
  { id:'p_marque', f:'pirate', k:'apex', name:'LETTERS OF MARQUE', icon:'✦',
    desc:'+15% critical chance and +60% critical damage.',
    lore:'Signed by nobody. Honoured by everybody, eventually.',
    apply:t => { t.crit = (t.crit||0) + 0.15;
                 t.critMult = (t.critMult||0) + 0.60; } }
];

/* The two axes a world already carries. `contested` outranks kind: a world two
   powers were already fighting over pays that power's APEX boon, which is the
   only place the apex five appear.

   Falls back rather than throwing, because a saved galaxy from before this
   change can hold an owner or kind this table has never heard of, and a
   missing boon must not cost somebody their campaign. */
function boonFor(owner, kind, contested, roll) {
  const pool = BOONS.filter(b => b.f === owner);
  /* `roll` is a NUMBER the caller already drew, never the generator itself.
     galaxy.js documents that its PRNG stream must not move or every saved
     galaxy's maps, arenas and boons shift, so the draw site keeps making
     exactly the one call it always made and hands the value in. */
  if (!pool.length) return BOONS[Math.floor((roll || 0) * BOONS.length) % BOONS.length];
  const want = contested ? 'apex' : (kind || 'standard');
  return pool.find(b => b.k === want)
      || pool.find(b => b.k === 'standard')
      || pool[0];
}
