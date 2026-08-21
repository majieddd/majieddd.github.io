/* ==========================================================================
   AEGIS PROTOCOL: ATTRITION — Expansion Pack
   --------------------------------------------------------------------------
   The elemental system, sixteen additional towers (each built on a verb no
   other tower uses), the campaign arena modifiers and campaign boons.
   Loaded after config.js; merges into TOWER_TYPES / TOWER_ORDER.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   ELEMENTS
   Five marking elements. A tower's hit leaves its element's MARK on the
   target for four seconds; a hit from a DIFFERENT element consumes the mark
   and triggers the combo. Kinetic and Radiant towers are non-elemental —
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
   SIXTEEN NEW TOWERS
   Same schema as config.js. `glyph` drives the shared turret rendering so the
   expansion does not need sixteen bespoke sprites.
-------------------------------------------------------------------------- */
const TOWER_TYPES_2 = {

  foundry: {
    id:'foundry', element: 'fire', origin:'robotic', name:'FOUNDRY', role:'Spawns fighting minions', cost:300, costGrowth:1.78,
    color:'#f9a8d4', dark:'#6d2044', attack:'minions', glyph:'⚒',
    desc:'Forges automata that march onto the lane, grapple the first enemy they meet and grind it down. The only structure that fights with BODIES instead of fire.',
    base:{ range:3.4, dmgType:'physical', minions:2, minionHp:40, minionDps:9, minionSlow:0.4, forgeTime:6 },
    levels:[ { cost:170, name:'ASSEMBLY', mods:{ minions:3, minionHp:67, minionDps:15 } },
             { cost:340, name:'WARPLANT', mods:{ minions:4, minionHp:107, minionDps:24, forgeTime:5 } } ],
    talents:[
      { id:'fy_alloy', row:0, col:0, name:'HARD ALLOY',  desc:'+60% minion health.',       mods:{ minionHpMul:1.60 } },
      { id:'fy_blade', row:0, col:1, name:'EDGE BLADES', desc:'+50% minion damage.',       mods:{ minionDpsMul:1.50 } },
      { id:'fy_fast',  row:1, col:0, name:'FAST FORGE',  desc:'Forges 35% faster.',        mods:{ forgeTimeMul:0.65 } },
      { id:'fy_grip',  row:1, col:1, name:'VICE GRIP',   desc:'Minion grapple slow +25%.', mods:{ minionSlow:0.25 } },
      { id:'fy_more',  row:2, col:0, name:'TWIN LINES',  desc:'+1 minion.',                mods:{ minions:1 } },
      { id:'fy_burst', row:2, col:1, name:'CORE BREACH', desc:'Dying minions explode for 3x their DPS.', mods:{ minionBlast:3 } } ],
    branches:[
      { id:'legion',    name:'LEGION',    cost:420, mods:{ minions:7, minionHp:113, minionDps:26, forgeTime:3.2 },
        surge:{ minions:1 }, note:'A constant stream of expendable automata saturating the lane.' },
      { id:'champions', name:'CHAMPIONS', cost:420, mods:{ minions:2, minionHp:567, minionDps:85, minionSlow:0.75, forgeTime:7 },
        surge:{ minionHp:147, minionDps:22 }, note:'Two colossal wardens that all but stop what they catch.' } ]
  },

  saboteur: {
    id:'saboteur', element: 'venom', origin:'pirate', name:'SABOTEUR', role:'Disables RIVAL towers', cost:290, costGrowth:1.85,
    color:'#94a3b8', dark:'#1e293b', attack:'sabotage', glyph:'⚡',
    desc:'Fires nothing at enemies. Instead it reaches across the field and periodically knocks a RIVAL tower offline — the only structure that attacks your opponent\'s board directly.',
    base:{ range:99, dmgType:'none', sabotageEvery:11, sabotageDur:3.0, sabotageTargets:1 },
    levels:[ { cost:200, name:'INFILTRATOR', mods:{ sabotageEvery:9, sabotageDur:3.6 } },
             { cost:360, name:'SPYMASTER',  mods:{ sabotageEvery:8, sabotageDur:4.2 } } ],
    talents:[
      { id:'sb_fast', row:0, col:0, name:'QUICK WORK',  desc:'Strikes 25% more often.',       mods:{ sabotageEveryMul:0.75 } },
      { id:'sb_long', row:0, col:1, name:'DEEP COVER',  desc:'Disables last 30% longer.',     mods:{ sabotageDurMul:1.30 } },
      { id:'sb_two',  row:1, col:0, name:'CELL NETWORK',desc:'+1 tower struck per operation.',mods:{ sabotageTargets:1 } },
      { id:'sb_rich', row:1, col:1, name:'EMBEZZLE',    desc:'Each strike steals 12 gold.',   mods:{ sabotageGold:12 } },
      { id:'sb_prio', row:2, col:0, name:'HIGH VALUE',  desc:'Prefers the rival\'s strongest tower.', mods:{ sabotagePriority:true } },
      { id:'sb_chain',row:2, col:1, name:'CASCADE',     desc:'Struck towers also lose 25% rate for 6s after.', mods:{ sabotageLinger:0.25 } } ],
    branches:[
      { id:'blackout', name:'BLACKOUT', cost:480, mods:{ sabotageEvery:6.5, sabotageDur:5.0, sabotageTargets:2 },
        surge:{ sabotageTargets:1 }, note:'Rolling blackouts across the rival board.' },
      { id:'ransom',   name:'RANSOM',   cost:480, mods:{ sabotageEvery:8, sabotageDur:3.8, sabotageGold:40 },
        surge:{ sabotageGold:15 }, note:'Every disabled tower pays you its maintenance budget.' } ]
  },

  rampart: {
    id:'rampart', element:'kinetic', origin:'human', name:'RAMPART', role:'Projects a lane barricade', cost:200, costGrowth:1.60,
    color:'#d6bcfa', dark:'#3b2a5a', attack:'barricade', glyph:'▦',
    desc:'Raises a physical barricade across the lane. Ground enemies must stop and batter it down — but a wall holds only so many at once, and the rest squeeze past.',
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
        surge:{ wallHp:450, wallThorns:10, wallBlocks:1 }, note:'One monumental wall that bites back, and holds a crowd.' },
      { id:'phalanx', name:'PHALANX', cost:380, mods:{ wallHp:650, wallRebuild:5, walls:2, wallBlocks:2 },
        surge:{ wallHp:175 }, note:'Two staggered barricades — twice the wall, twice the capacity.' } ]
  },

  executioner: {
    id:'executioner', element:'void', origin:'xeno', name:'EXECUTIONER', role:'Culls weakened enemies', cost:270, costGrowth:1.74,
    color:'#fca5a5', dark:'#5f1616', attack:'projectile', glyph:'⚔',
    desc:'A heavy blade-thrower whose hits EXECUTE any non-elite enemy below a health threshold outright. It does not care how much health the target started with — only how little is left.',
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
        surge:{ execThreshold:0.02 }, note:'Executes at nearly a quarter health. The cull embodied.' },
      { id:'reaper',     name:'REAPER',     cost:440, mods:{ damage:44, rate:1.1, execThreshold:0.16, execBounty:1.2, execGold:8 },
        surge:{ execGold:5 }, note:'Every head pays. An economy built on endings.' } ]
  },

  chrono: {
    id:'chrono', element: 'frost', origin:'light', name:'CHRONO', role:'Rewinds enemies through time', cost:250, costGrowth:1.70,
    color:'#93c5fd', dark:'#1e3a5f', attack:'chrono', glyph:'⧖',
    desc:'Snaps every enemy in range back to where it was seconds ago. The faster a target moves, the further it is thrown back — the definitive answer to Sprinters and Heralds.',
    base:{ damage:6, range:3.0, rate:0.2, dmgType:'magic', rewindSec:2.2 },
    levels:[ { cost:180, name:'HOURGLASS', mods:{ damage:11, rewindSec:2.8 } },
             { cost:330, name:'EPOCH',     mods:{ damage:18, rewindSec:3.4, range:3.4 } } ],
    talents:[
      { id:'ch_deep', row:0, col:0, name:'DEEP REWIND', desc:'+30% rewind distance.',           mods:{ rewindSecMul:1.30 } },
      { id:'ch_fast', row:0, col:1, name:'FAST CYCLE',  desc:'Pulses 30% more often.',          mods:{ rateMul:1.30 } },
      { id:'ch_wide', row:1, col:0, name:'WIDE FIELD',  desc:'+30% radius.',                    mods:{ rangeMul:1.30 } },
      { id:'ch_wear', row:1, col:1, name:'TIME WEAR',   desc:'Rewound enemies take +15% damage for 3s.', mods:{ rewindVuln:0.15 } },
      { id:'ch_still',row:2, col:0, name:'STILLFRAME',  desc:'Rewound enemies are held 0.4s.',  mods:{ rewindHold:0.4 } },
      { id:'ch_echo', row:2, col:1, name:'DOUBLE EXPOSURE', desc:'20% chance to rewind twice.', mods:{ rewindTwice:0.20 } } ],
    branches:[
      { id:'well',    name:'TEMPORAL WELL', cost:420, mods:{ damage:26, rewindSec:4.6, range:3.8, rewindHold:0.5 },
        surge:{ rewindSec:0.5 }, note:'A deeper past to fall into, and a pause on arrival.' },
      { id:'paradox', name:'PARADOX',       cost:420, mods:{ damage:34, rewindSec:3.2, rewindVuln:0.35, rate:0.24 },
        surge:{ rewindVuln:0.06 }, note:'Enemies dragged against time take grievously amplified damage.' } ]
  },

  echo: {
    id:'echo', element: 'storm', origin:'robotic', name:'ECHO', role:'Repeats neighbouring attacks', cost:260, costGrowth:1.76,
    color:'#fda4af', dark:'#5f1f2e', attack:'echo', glyph:'≋',
    desc:'Has no weapon of its own. It listens to adjacent towers and REPEATS their strikes at reduced power — worth more the stronger the company it keeps.',
    base:{ range:3.2, echoRange:2.0, rate:0.7, dmgType:'none', echoFrac:0.55 },
    levels:[ { cost:190, name:'REVERB',   mods:{ echoFrac:0.7, rate:0.8 } },
             { cost:350, name:'RESOUND',  mods:{ echoFrac:0.85, rate:0.9, echoRange:2.4 } } ],
    talents:[
      { id:'ec_loud', row:0, col:0, name:'AMPLIFY',   desc:'+20% echo power.',            mods:{ echoFrac:0.20 } },
      { id:'ec_fast', row:0, col:1, name:'QUICK EAR', desc:'+30% echo rate.',             mods:{ rateMul:1.30 } },
      { id:'ec_far',  row:1, col:0, name:'LONG EAR',  desc:'Listens 40% further.',        mods:{ echoRangeMul:1.40 } },
      { id:'ec_reach',row:1, col:1, name:'PROJECTION',desc:'+30% strike range.',          mods:{ rangeMul:1.30 } },
      { id:'ec_two',  row:2, col:0, name:'STEREO',    desc:'Echoes two towers at once.',  mods:{ echoCount:1 } },
      { id:'ec_pure', row:2, col:1, name:'CLARITY',   desc:'Echoes ignore 30% of armour.',mods:{ pierce:0.30 } } ],
    branches:[
      { id:'chorus',    name:'CHORUS',    cost:430, mods:{ echoFrac:0.75, echoCount:2, rate:1.0, echoRange:2.8 },
        surge:{ echoCount:1 }, note:'Repeats the whole neighbourhood.' },
      { id:'resonance', name:'RESONANCE', cost:430, mods:{ echoFrac:1.35, rate:0.8 },
        surge:{ echoFrac:0.15 }, note:'A single echo LOUDER than the original.' } ]
  },

  quake: {
    id:'quake', element:'kinetic', origin:'robotic', name:'QUAKE', role:'Global ground slam', cost:320, costGrowth:1.80,
    color:'#d4a373', dark:'#4a2e14', attack:'quake', glyph:'⌗',
    desc:'Hammers the earth itself. Every ground enemy on YOUR ENTIRE SIDE takes the hit, wherever it stands — the only weapon with no range at all.',
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
        surge:{ damage:10 }, note:'Triple damage within its own radius — stand your ground there.' },
      { id:'cataclysm', name:'CATACLYSM', cost:500, mods:{ damage:34, rate:0.22, aftershock:0.6, stagger:0.5 },
        surge:{ aftershock:0.1 }, note:'Slam after slam after slam.' } ]
  },

  siren: {
    id:'siren', element:'void', origin:'xeno', name:'SIREN', role:'Converts enemies to your side', cost:350, costGrowth:1.98,
    color:'#f0abfc', dark:'#5b1d66', attack:'siren', glyph:'♆',
    desc:'Sings a single enemy out of the assault entirely — it vanishes from your lane and marches on the RIVAL as one of yours. The strongest recruit it can hold, every cooldown.',
    base:{ range:3.6, dmgType:'none', charmEvery:18, charmMaxHp:180 },
    levels:[ { cost:240, name:'ALLURE',  mods:{ charmEvery:15, charmMaxHp:440 } },
             { cost:450, name:'COMMAND', mods:{ charmEvery:13, charmMaxHp:1040 } } ],
    talents:[
      { id:'si_song', row:0, col:0, name:'LONG SONG',  desc:'Charm capacity +60%.',        mods:{ charmMaxHpMul:1.60 } },
      { id:'si_fast', row:0, col:1, name:'QUICK VERSE',desc:'Charms 20% more often.',      mods:{ charmEveryMul:0.80 } },
      { id:'si_far',  row:1, col:0, name:'CARRYING CRY',desc:'+35% range.',                mods:{ rangeMul:1.35 } },
      { id:'si_iron', row:1, col:1, name:'IRON WILL',  desc:'Converts arrive with +40% health.', mods:{ charmHpBonus:0.40 } },
      { id:'si_deep', row:2, col:0, name:'DEEP TRANCE',desc:'Capacity +80%.',              mods:{ charmMaxHpMul:1.80 } },
      { id:'si_gold', row:2, col:1, name:'TRIBUTE',    desc:'Each convert pays 25 gold.',  mods:{ charmGold:25 } } ],
    branches:[
      { id:'choir',    name:'CHOIR',    cost:560, mods:{ charmEvery:8.5, charmMaxHp:1400 },
        surge:{ charmEveryMul:0.94 }, note:'A recruiting drive. Converts flow constantly.' },
      { id:'dominion', name:'DOMINION', cost:560, mods:{ charmEvery:14, charmMaxHp:3200, charmHpBonus:0.6 },
        surge:{ charmMaxHpMul:1.25 }, note:'Takes even the giants, and hardens them.' } ]
  },

  alchemist: {
    id:'alchemist', element: 'venom', origin:'xeno', name:'ALCHEMIST', role:'Grows stronger with every kill', cost:280, costGrowth:1.76,
    color:'#fbbf24', dark:'#5c4008', attack:'projectile', glyph:'⚗',
    desc:'Transmutes death into power. Every kill inside its circle adds a PERMANENT grain of damage to its shot — the only tower with no ceiling that money cannot buy.',
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
        surge:{ transGold:2 }, note:'Death pays twice — in power and in gold.' },
      { id:'philosopher',name:'PHILOSOPHER', cost:460, mods:{ damage:22, transmute:4.5, rate:1.1 },
        surge:{ transmute:1.2 }, note:'The great work: growth without limit.' } ]
  },

  glaive: {
    id:'glaive', element:'kinetic', origin:'pirate', name:'GLAIVE', role:'Boomerang along the lane', cost:220, costGrowth:1.58,
    color:'#a5f3fc', dark:'#164e63', attack:'glaive', glyph:'↺',
    desc:'Hurls a whirling blade that follows the LANE itself — out along the path and back again, cutting everything it passes twice.',
    base:{ damage:9, range:3.0, rate:0.5, dmgType:'physical', glaiveTiles:7, glaiveSpeed:9 },
    levels:[ { cost:160, name:'TWIN ARC', mods:{ damage:16, glaiveTiles:9 } },
             { cost:300, name:'FARBLADE', mods:{ damage:25, glaiveTiles:11, glaiveSpeed:11 } } ],
    talents:[
      { id:'gl_sharp', row:0, col:0, name:'RAZOR EDGE', desc:'+40% damage.',             mods:{ damageMul:1.40 } },
      { id:'gl_quick', row:0, col:1, name:'DEFT THROW', desc:'+30% throw rate.',         mods:{ rateMul:1.30 } },
      { id:'gl_far',   row:1, col:0, name:'LONG FLIGHT',desc:'Travels 4 tiles further.', mods:{ glaiveTiles:4 } },
      { id:'gl_heavy', row:1, col:1, name:'WEIGHTED',   desc:'Hits shred 3 armour.',     mods:{ shred:3 } },
      { id:'gl_speed', row:2, col:0, name:'SLIPSTREAM', desc:'+40% blade speed.',        mods:{ glaiveSpeedMul:1.40 } },
      { id:'gl_twin',  row:2, col:1, name:'SECOND BLADE',desc:'Throws a second glaive.', mods:{ glaives:1 } } ],
    branches:[
      { id:'twinblade', name:'TWINBLADE', cost:360, mods:{ damage:34, glaives:2, rate:0.6 },
        surge:{ glaives:1 }, note:'A storm of returning steel.' },
      { id:'scythe',    name:'SCYTHE',    cost:360, mods:{ damage:68, glaiveTiles:14, glaiveWidth:1.1 },
        surge:{ damage:16 }, note:'One vast blade that harvests the whole lane.' } ]
  },

  cyclone: {
    id:'cyclone', element:'storm', origin:'pirate', name:'CYCLONE', role:'Hurls enemies skyward', cost:240, costGrowth:1.64,
    color:'#7dd3fc', dark:'#0c4a6e', attack:'cyclone', glyph:'๑',
    desc:'Whips up a vortex that flings ground enemies into the air — held helpless, then dropped for impact damage. Elites are too heavy to lift.',
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
        surge:{ liftDur:0.1 }, note:'A standing storm that owns its stretch of lane.' },
      { id:'downburst', name:'DOWNBURST', cost:390, mods:{ damage:28, dropDmg:150, liftDur:0.8, rate:0.34 },
        surge:{ dropDmg:35 }, note:'What goes up comes down like a meteor.' } ]
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
        surge:{ chargeMaxMul:1.2 }, note:'A weather system in a box.' },
      { id:'flashbank', name:'FLASHBANK', cost:390, mods:{ chargeRate:95, chargeMax:800, novaKeep:0.35 },
        surge:{ chargeRateMul:1.15 }, note:'Charges almost as fast as it spends.' } ]
  },

  shepherd: {
    id:'shepherd', element:'radiant', origin:'light', name:'SHEPHERD', role:'Empowers your reanimates', cost:270, costGrowth:1.82,
    color:'#bef264', dark:'#365314', attack:'shepherd', glyph:'♱',
    desc:'Tends the dead you send onward. Reanimates passing its field march out harder, faster and heavier — the only structure that strengthens your OFFENCE.',
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
        surge:{ flockHp:0.3 }, note:'The flock becomes a battering ram.' },
      { id:'soulbound',name:'SOULBOUND',cost:440, mods:{ flockHp:0.9, flockSpeed:0.3, flockLives:2, flockGold:6 },
        surge:{ flockLives:1 }, note:'Every blessed soul that arrives costs the rival dearly.' } ]
  },

  ward: {
    id:'ward', element:'radiant', origin:'light', name:'WARD', role:'Shields towers from disruption', cost:210, costGrowth:1.68,
    color:'#e9d5ff', dark:'#4c2673', attack:'ward', glyph:'❖',
    desc:'Projects a sanctity field. Towers inside CANNOT be jammed or sabotaged — the hard counter to Jammers, Oracles and enemy Saboteurs.',
    base:{ range:2.7, dmgType:'none', wardDmg:0.06 },
    levels:[ { cost:160, name:'SANCTIFY', mods:{ range:3.1, wardDmg:0.10 } },
             { cost:300, name:'CONSECRATE', mods:{ range:3.5, wardDmg:0.15 } } ],
    talents:[
      { id:'wd_wide',  row:0, col:0, name:'BROAD AEGIS', desc:'+30% field radius.',     mods:{ rangeMul:1.30 } },
      { id:'wd_sharp', row:0, col:1, name:'ZEAL',        desc:'+8% damage to warded towers.', mods:{ wardDmg:0.08 } },
      { id:'wd_swift', row:1, col:0, name:'BLESSED HANDS',desc:'Warded towers +10% rate.',mods:{ wardRate:0.10 } },
      { id:'wd_calm',  row:1, col:1, name:'CLARITY',     desc:'Warded towers +8% range.', mods:{ wardRange:0.08 } },
      { id:'wd_stand', row:2, col:0, name:'LAST LIGHT',  desc:'+12% damage to warded towers.', mods:{ wardDmg:0.12 } },
      { id:'wd_purge', row:2, col:1, name:'PURGE',       desc:'Enemy auras are 50% weaker inside the field.', mods:{ wardPurge:0.5 } } ],
    branches:[
      { id:'sanctum', name:'SANCTUM', cost:370, mods:{ range:3.8, wardDmg:0.28, wardRate:0.12 },
        surge:{ wardDmg:0.05 }, note:'Protection that also empowers.' },
      { id:'expanse', name:'EXPANSE', cost:370, mods:{ range:5.0, wardDmg:0.12, wardRange:0.12 },
        surge:{ rangeMul:1.06 }, note:'One field to cover the whole board.' } ]
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
        surge:{ reckonFrac:0.05 }, note:'More than half of everything, returned with interest.' },
      { id:'tribunal',name:'TRIBUNAL',cost:480, mods:{ damage:20, reckonFrac:0.40, reckonElite:1.0, rate:0.65 },
        surge:{ reckonElite:0.15 }, note:'The boss-killer. Giants pay for every wound.' } ]
  },

  arbalest: {
    id:'arbalest', element:'kinetic', origin:'human', name:'ARBALEST', role:'Damage grows while it waits', cost:210, costGrowth:1.60,
    color:'#86efac', dark:'#14532d', attack:'patience', glyph:'➶',
    desc:'A siege bow that winds tighter the longer it holds its shot. Fired hastily it stings; fired after a long quiet, it obliterates. The mirror of every rapid-fire tower.',
    base:{ damage:15, range:5.0, rate:0.5, projSpeed:20, dmgType:'physical', windRate:0.35, windMax:6 },
    levels:[ { cost:160, name:'WINDLASS', mods:{ damage:26, windMax:8 } },
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
        surge:{ windMax:2 }, note:'Patience measured in city blocks.' },
      { id:'snapshot', name:'SNAPSHOT', cost:360, mods:{ damage:52, windRate:0.9, windMax:8, rate:0.7 },
        surge:{ windRateMul:1.1 }, note:'Winds so fast that every shot lands heavy.' } ]
  },

  /* Four towers that exist so the thinner origins can field a loadout built
     entirely from their own power. Each reuses an attack verb the engine
     already resolves, so nothing here needs a bespoke handler and every one is
     reachable through the same level/specialisation/ascension path. */

  custodian: {
    id:'custodian', element:'radiant', origin:'light', name:'CUSTODIAN', role:'Warden constructs that hold', cost:286, costGrowth:1.82,
    color:'#fde68a', dark:'#78500a', attack:'minions', glyph:'⛨',
    desc:'Federation wardens walk out and stand in the way. They kill almost nothing — they are there so that whatever they have hold of stops moving, and stays stopped while the rest of the line works.',
    base:{ range:3.2, dmgType:'physical', minions:2, minionHp:78, minionDps:5, minionSlow:0.62, forgeTime:7 },
    levels:[ { cost:180, name:'SENTINEL', mods:{ minions:3, minionHp:132, minionDps:8 } },
             { cost:340, name:'PARAGON',  mods:{ minions:3, minionHp:224, minionDps:13, minionSlow:0.70, forgeTime:6 } } ],
    talents:[
      { id:'cu_plate', row:0, col:0, name:'CONSECRATED PLATE', desc:'+70% warden health.',        mods:{ minionHpMul:1.70 } },
      { id:'cu_hold',  row:0, col:1, name:'STANDING ORDER',    desc:'Warden grapple slow +20%.',  mods:{ minionSlow:0.20 } },
      { id:'cu_quick', row:1, col:0, name:'QUICK MUSTER',      desc:'Raises wardens 35% faster.', mods:{ forgeTimeMul:0.65 } },
      { id:'cu_edge',  row:1, col:1, name:'SANCTIFIED EDGE',   desc:'+60% warden damage.',        mods:{ minionDpsMul:1.60 } },
      { id:'cu_more',  row:2, col:0, name:'FULL WATCH',        desc:'+1 warden.',                 mods:{ minions:1 } },
      { id:'cu_last',  row:2, col:1, name:'LAST STAND',        desc:'Falling wardens burst for 2x their damage.', mods:{ minionBlast:2 } } ],
    branches:[
      { id:'vigil',   name:'VIGIL',   cost:430, mods:{ minions:2, minionHp:980, minionDps:22, minionSlow:0.85, forgeTime:8 },
        surge:{ minionHp:240 }, note:'Two wardens that simply do not fall over.' },
      { id:'cordon',  name:'CORDON',  cost:430, mods:{ minions:6, minionHp:230, minionDps:15, minionSlow:0.55, forgeTime:3.6 },
        surge:{ minions:1 }, note:'A line of them, wide enough that nothing walks around it.' } ]
  },

  concord: {
    id:'concord', element:'storm', origin:'light', name:'CONCORD', role:'Harmonic chain, opens targets', cost:268, costGrowth:1.72,
    color:'#fcd34d', dark:'#78500a', attack:'chain', glyph:'♒',
    desc:'A tuned discharge that walks the crowd. It is not the damage that matters — everything it touches is left open, and every other tower on the board collects.',
    base:{ damage:7, range:3.3, rate:0.85, dmgType:'magic', chains:4, chainRange:2.4, falloff:0.80, vuln:0.16, vulnDur:3 },
    levels:[ { cost:175, name:'ANTIPHON', mods:{ damage:22, chains:5, vuln:0.21 } },
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
        surge:{ chains:2 }, note:'The whole crowd, opened at once.' },
      { id:'requiem', name:'REQUIEM', cost:420, mods:{ damage:96, chains:4, falloff:0.72, vuln:0.46, vulnDur:4.0 },
        surge:{ vuln:0.06 }, note:'Fewer targets, and what it opens it opens wide.' } ]
  },

  ichor: {
    id:'ichor', element:'fire', origin:'xeno', name:'ICHOR', role:'Digestive spray', cost:232, costGrowth:1.70,
    color:'#a855f7', dark:'#4a1d6b', attack:'cone', glyph:'☣',
    desc:'A short spray of living bile that keeps working long after the stream has moved on. It does not care what the target was; only how much of it is left.',
    base:{ damage:9, range:2.1, rate:1, dmgType:'magic', cone:0.55, burn:14, burnDur:3.0 },
    levels:[ { cost:150, name:'GORGE',   mods:{ damage:32, burn:24 } },
             { cost:280, name:'DIGEST',  mods:{ damage:52, burn:38, burnDur:3.6, range:2.4, cone:0.62 } } ],
    talents:[
      { id:'ic_thick', row:0, col:0, name:'THICK BILE',  desc:'+65% lingering damage.',       mods:{ statusMul:1.65 } },
      { id:'ic_hot',   row:0, col:1, name:'RAW ACID',    desc:'+45% direct damage.',          mods:{ damageMul:1.45 } },
      { id:'ic_wide',  row:1, col:0, name:'WIDE MAW',    desc:'+35% spray width, +20% reach.',mods:{ coneMul:1.35, rangeMul:1.20 } },
      { id:'ic_eat',   row:1, col:1, name:'DISSOLVE',    desc:'Spray strips 4 armour.',       mods:{ shred:4 } },
      { id:'ic_feed',  row:2, col:0, name:'FEEDING',     desc:'Coated targets take +30% damage.', mods:{ burnVuln:0.30 } },
      { id:'ic_deep',  row:2, col:1, name:'DEEP GULLET', desc:'+50% lingering damage and +15% reach.', mods:{ statusMul:1.50, rangeMul:1.15 } } ],
    branches:[
      { id:'devour',  name:'DEVOUR',  cost:390, mods:{ damage:92, burn:60, burnDur:4.2, range:2.8, cone:0.70 },
        surge:{ burn:14 }, note:'It keeps eating whether or not the spray is still on it.' },
      { id:'spatter', name:'SPATTER', cost:390, mods:{ damage:56, burn:30, burnDur:2.8, range:2.6, cone:0.66, puddle:true, puddleDmg:30, puddleDur:5.0, puddleRadius:1.1 },
        surge:{ puddleDmg:16 }, note:'What runs off the target stays on the ground and keeps working.' } ]
  },

  pylon: {
    id:'pylon', element:'storm', origin:'robotic', name:'PYLON', role:'Lattice keystone', cost:262, costGrowth:1.90,
    color:'#94a3b8', dark:'#1e293b', attack:'aura', glyph:'⬡',
    desc:'Fires nothing and buffs almost nothing on its own. What it does is LINK — every robotic emplacement inside its field counts the pylon as part of its lattice, which is the only thing robotic hardware has instead of a trick.',
    base:{ range:2.8, dmgType:'none', auraDmg:0.08, auraRate:0.06, auraRange:0.0, latticeBonus:1 },
    levels:[ { cost:160, name:'RELAY',   mods:{ auraDmg:0.13, auraRate:0.09, range:3.1, latticeBonus:2 } },
             { cost:290, name:'BACKBONE',mods:{ auraDmg:0.18, auraRate:0.12, range:3.4, latticeBonus:2 } } ],
    talents:[
      { id:'py_span', row:0, col:0, name:'LONG SPAN',   desc:'+35% field radius.',            mods:{ rangeMul:1.35 } },
      { id:'py_gain', row:0, col:1, name:'LINE GAIN',   desc:'+45% damage field.',            mods:{ auraDmgMul:1.45 } },
      { id:'py_trunk',row:1, col:0, name:'TRUNK LINE',  desc:'+1 lattice link inside the field.', mods:{ latticeBonus:1 } },
      { id:'py_clock',row:1, col:1, name:'CLOCK LINE',  desc:'+50% fire-rate field.',         mods:{ auraRateMul:1.50 } },
      { id:'py_grid', row:2, col:0, name:'GRID NODE',   desc:'+1 lattice link and +20% radius.', mods:{ latticeBonus:1, rangeMul:1.20 } },
      { id:'py_reach',row:2, col:1, name:'REACH RELAY', desc:'+10% range to everything in the field.', mods:{ auraRange:0.10 } } ],
    branches:[
      { id:'backbone', name:'BACKBONE', cost:410, mods:{ range:4.4, auraDmg:0.16, auraRate:0.10, latticeBonus:2 },
        surge:{ rangeMul:1.06 }, note:'One span that carries the whole board.' },
      { id:'substation', name:'SUBSTATION', cost:410, mods:{ range:3.0, auraDmg:0.34, auraRate:0.26, latticeBonus:3 },
        surge:{ auraDmg:0.05 }, note:'A short reach and a very dense one.' } ]
  }
};

/* Merge into the master roster. */
Object.assign(TOWER_TYPES, TOWER_TYPES_2);
TOWER_ORDER.push('foundry', 'saboteur', 'rampart', 'executioner', 'chrono', 'echo',
                 'quake', 'siren', 'alchemist', 'glaive', 'cyclone', 'capacitor',
                 'shepherd', 'ward', 'reckoning', 'arbalest',
                 'custodian', 'concord', 'ichor', 'pylon');

/* GOLD SQUISH runs here and only here: both rosters are now in TOWER_TYPES,
   so one loop reaches every price, bounty and purse (config.js). */
applyGoldSquish();

/* --------------------------------------------------------------------------
   CAMPAIGN CONTENT — arena modifiers shown on the world-path nodes, and the
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

const BOONS = [
  { id:'experience', name:'VETERANCY',  icon:'★', desc:'+25% commander experience earned.',        apply:t => t.xpMul = (t.xpMul||1) + 0.25 },
  { id:'vitality',   name:'VITALITY',   icon:'♥', desc:'+5 maximum lives in every battle.',        apply:t => t.bonusLives = (t.bonusLives||0) + 5 },
  { id:'prosperity', name:'PROSPERITY', icon:'◈', desc:'+10% gold from all sources.',              apply:t => t.goldMul = (t.goldMul||1) + 0.10 },
  { id:'foresight',  name:'FORESIGHT',  icon:'◎', desc:'+1 option on every command draft.',        apply:t => t.bonusDraft = (t.bonusDraft||0) + 1 },
  { id:'arsenal',    name:'ARSENAL',    icon:'▲', desc:'Towers cost 10% less.',                    apply:t => t.costMul = (t.costMul||1) - 0.10 },
  { id:'momentum',   name:'MOMENTUM',   icon:'⚑', desc:'Your reanimates arrive with +20% health.', apply:t => t.reanimMul = (t.reanimMul||0) + 0.20 },
  { id:'mastery',    name:'MASTERY',    icon:'✦', desc:'+50% tower mastery experience earned.',    apply:t => t.masteryMul = (t.masteryMul||1) + 0.50 },
  { id:'bulwark',    name:'BULWARK',    icon:'⛨', desc:'Every leak costs 1 less life (min 1).',    apply:t => t.leakShield = (t.leakShield||0) + 1 }
];
