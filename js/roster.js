/* ==========================================================================
   COMMANDER ROSTER, five per faction, twenty in all.

   One per faction is free; the rest are bought with souls. Every commander
   carries a signature trait, a 3x3 technology chart, and two active abilities
   (offensive first, defensive second, the second gated until the chart is
   fully allocated or the ability is unlocked with souls).

   Technology charts are built from a compact column spec rather than 180
   hand-written literals: each column is one escalating theme, which is exactly
   how the original five were authored and keeps a chart readable at a glance.
   ========================================================================== */

/** Build a 3x3 chart. `cols` is three [name, icon, desc, apply] triples per row. */
function chart(prefix, cols) {
  const out = [];
  cols.forEach((col, ci) => col.forEach((node, ri) => {
    out.push({ id: prefix + (ci * 3 + ri + 1), col: ci, row: ri, cost: ri + 1,
               name: node[0], icon: node[1], desc: node[2], apply: node[3] });
  }));
  return out;
}

/* --------------------------------------------------------------------------
   SIGNATURES: what a commander is known for building and known for sending.

   TWO towers and TWO denizens per commander, and every signature tower is
   drawn from the commander's OWN origin. No exceptions, no commons, no
   borrowing: a Xeno commander's signature is Xeno hardware.

   TOWER_ORDER holds SIXTY buildable towers, twelve per origin, exactly even:

       human 12    light 12    xeno 12    pirate 12    robotic 12

   so own-origin costs nothing. Every origin also carries enough to fight on
   its own account (measured: 5 to 8 damage towers each, and at least one
   answer to air), which is why LOADOUT_OWN_ORIGIN could be raised from two to
   the full four alongside this.

   It is a BIAS, not a lock. The rival brain drafts these first and fills the
   rest as it always did, and the player sees them on the commander card as a
   recommendation. Locking a four-slot loadout at two would be half a
   decision, and a commander that cannot answer an air wave is not a
   character, it is a loss.

   The rules, checked by owner-sweep 40.1 to 40.6:

     1. BOTH signature towers are the commander's own origin.
     2. Both signature denizens come from the commander's own FACTION_UNITS.
     3. No two commanders share a tower PAIR or a denizen PAIR.
     4. Every pair is chosen against the trait's MECHANIC. The comment above
        each one says which clause of the trait it answers, so a later balance
        pass can tell whether a pairing is still true.

   CADRE has no signature, deliberately, and is the one exception the check
   allows. It has no faction and no doctrine: "Most commanders are a bet.
   Cadre is the house."
-------------------------------------------------------------------------- */

const COMMANDER_ROSTER = [

  /* ══════════════════════════════════════════════════════ UNALIGNED ═══
     The commander every profile starts with, whatever faction they pick.
     Deliberately the least exciting on the roster: no specialism, no trap,
     an even lift on every statistic the board has. It exists so a new player
     learns the game rather than a gimmick, and so that the first commander
     they BUY feels like a real change of direction. */
  {
    id: 'cadre', faction: null, name: 'CADRE', title: 'The Baseline',
    color: '#94a3b8', icon: '⌂', free: true, always: true,
    blurb: 'No doctrine, no appetite, no vow. Cadre was trained to hold a line with whatever is to hand, and does exactly that: every structure a little better, nothing spectacular. Most commanders are a bet. Cadre is the house.',
    abilities: ['steadyaim', 'attrite'],
    trait: { name: 'EVEN FOOTING',
      desc: 'Every tower gains +6% damage, +6% rate and +6% range, and reanimated attackers are 10% weaker.',
      apply: t => { t.dmg += 0.06; t.rate += 0.06; t.rng += 0.06; t.reanimResist = 0.10; } },
    tech: chart('z', [
      [['DRILL ORDER','◎','+5% damage and +5% rate.', t=>{t.dmg+=0.05;t.rate+=0.05;}],
       ['STANDING ORDERS','◉','+7% more of both.', t=>{t.dmg+=0.07;t.rate+=0.07;}],
       ['GENERAL ORDERS','★','+9% more of both, and +6% range.', t=>{t.dmg+=0.09;t.rate+=0.09;t.rng+=0.06;}]],
      [['SIGHTLINES','⊙','+7% range.', t=>t.rng+=0.07],
       ['SUPPLY','◈','+12% kill gold.', t=>t.goldMul+=0.12],
       ['DEPOT','⛁','+16% more kill gold and upgrades 10% cheaper.', t=>{t.goldMul+=0.16;t.upgradeMul*=0.90;}]],
      [['DIG IN','⛨','+3 maximum lives.', (t,s)=>{ if(s){s.maxLives+=3;s.lives+=3;} }],
       ['HOLDFAST','⛰','+5 more lives, and reanimates 10% weaker again.', (t,s)=>{ if(s){s.maxLives+=5;s.lives+=5;} t.reanimResist+=0.10; }],
       ['THE LINE','∞','+7 more lives, and reanimates 15% weaker again.', (t,s)=>{ if(s){s.maxLives+=7;s.lives+=7;} t.reanimResist+=0.15; }]]
    ])
  },

  /* ═══════════════════════════════════════════════════════ HUMANITY ═══ */
  /* CANON 2029 (docs/CANON-2029.md), naming round two, owner spec: the five
     field commanders of the Concord each carry a name from a different part
     of Earth, because the coalition was every nation or it was nothing.
     WASHINGTON for the Americas, OKAFOR for Africa, O'RYAN for Europe,
     TANAKA for Asia, REYES for Latin America. Display names only: every id
     below is a stable id and is the join for art plates, lore, dialogue and
     saves, so ids NEVER move. Titles are the callsigns the story uses. */
  {
    id: 'vanta', faction: 'human', name: 'DIR. REYES', title: 'The Archivist',
    color: '#7dd3fc', icon: '◈', free: true,
    blurb: 'Fights the long game. Reyes turns the draft itself into a weapon: more choices, more often, and a board that grows stronger with every doctrine filed away.',
    abilities: ['overclock', 'dampen'],
    /* PERPETUAL STUDY reads the enemy: strip its armour off, then shoot it with its own salvaged gun. */
    signature: { towers: ['canister', 'reclaimer'], units: ['trooper', 'gunskiff'] },
    trait: { name: 'PERPETUAL STUDY',
      desc: 'Command upgrades are drafted every 4 waves instead of 5, and you are offered 4 options instead of 3.',
      apply: t => { t.draftEvery = 4; t.draftOptions = 4; } },
    tech: chart('v', [
      [['CROSS-REFERENCE','⊞','+1 option on every draft.', t=>t.draftOptions+=1],
       ['RAPID STUDY','⏩','Drafts arrive every 3 waves.', t=>t.draftEvery=3],
       ['MASTER ARCHIVE','✦','+1 further option, and +3% damage per upgrade held.', t=>{t.draftOptions+=1;t.perModDamage+=0.03;}]],
      [['COMPENDIUM','▤','+3% tower damage per command upgrade you hold.', t=>t.perModDamage+=0.03],
       ['DEEP INDEX','▥','+4% more tower damage per upgrade held.', t=>t.perModDamage+=0.04],
       ['OMNISCIENCE','◉','+5% more tower damage per upgrade held.', t=>t.perModDamage+=0.05]],
      [['FIELD NOTES','✎','Begin each battle holding 1 random command upgrade.', t=>t.startingMods+=1],
       ['PRIOR ART','✧','Begin with 2 more command upgrades.', t=>t.startingMods+=2],
       ['TOTAL RECALL','∞','Begin with 3 more and +1 draft option.', t=>{t.startingMods+=3;t.draftOptions+=1;}]]
    ])
  },
  {
    id: 'korrin', faction: 'human', name: 'GEN. OKAFOR', title: 'The Quartermaster',
    color: '#38e8ff', icon: '◭',
    blurb: 'Wins on logistics. Okafor makes width affordable when everyone else is priced into a handful of towers.',
    abilities: ['focusfire', 'bulwark'],
    /* BULK CONTRACTS wants copies. The cheap shell by the dozen, paid for out of supply. */
    signature: { towers: ['quartermaster', 'mortar'], units: ['linebreaker', 'vanguard'] },
    trait: { name: 'BULK CONTRACTS',
      desc: 'Per-copy tower price growth is 30% gentler, and you start with 25% more gold.',
      apply: (t, s) => { t.costGrowthMul = 0.70; if (s) s.gold = Math.round(s.gold * 1.25); } },
    tech: chart('k', [
      [['REQUISITION','◈','+12% gold from every kill.', t=>t.goldMul+=0.12],
       ['SUPPLY LINE','⛁','+18% more kill gold.', t=>t.goldMul+=0.18],
       ['WAR CHEST','▦','+25% more kill gold and +' + sqGold(200) + ' starting gold.', (t,s)=>{t.goldMul+=0.25; if(s)s.gold+=sqGold(200);}]],
      [['BARGAINING','⊗','Price growth a further 10% gentler.', t=>t.costGrowthMul*=0.90],
       ['STANDARDISED','⊘','And another 12% gentler.', t=>t.costGrowthMul*=0.88],
       ['MASS PRODUCTION','⊙','And another 15%. Towers become genuinely spammable.', t=>t.costGrowthMul*=0.85]],
      [['SALVAGE','↺','Selling returns 85% instead of 60%.', t=>t.sellRate=0.85],
       ['REFIT','↻','Upgrades cost 12% less.', t=>t.upgradeMul*=0.88],
       ['LOGISTICS CORPS','✚','Upgrades cost a further 15% less.', t=>t.upgradeMul*=0.85]]
    ])
  },
  {
    id: 'nyx', faction: 'human', name: 'DR. TANAKA', title: 'The Overclocker',
    color: '#67e8f9', icon: '⟐',
    blurb: 'Pushes single structures past their rated limits. Tanaka would rather field five monsters than twenty soldiers.',
    abilities: ['overclock', 'smokescreen'],
    /* REDLINE surges on every ascension, so it takes the two guns that ascend most often. */
    signature: { towers: ['bolt', 'arc'], units: ['gunskiff', 'dragoon'] },
    trait: { name: 'REDLINE',
      desc: 'Ascension costs 25% less, and SURGE triggers on EVERY ascension instead of every second one.',
      apply: t => { t.ascCostMul = 0.75; t.surgeEvery = 1; } },
    tech: chart('n', [
      [['TOLERANCES','⌁','Ascension costs a further 10% less.', t=>t.ascCostMul*=0.90],
       ['COOLANT','❄','And another 12% less.', t=>t.ascCostMul*=0.88],
       ['NO LIMITS','⚡','And another 15% less.', t=>t.ascCostMul*=0.85]],
      [['SURGE TAP','◆','+2% tower damage per ascension you own.', t=>t.perAscDamage+=0.02],
       ['FEEDBACK','◇','+3% more per ascension.', t=>t.perAscDamage+=0.03],
       ['CRITICALITY','✷','+4% more per ascension.', t=>t.perAscDamage+=0.04]],
      [['DEEP TUNE','⊕','Towers at ascension 3+ fire 10% faster.', t=>t.ascendBonusRate+=0.10],
       ['RESONANCE','⊛','+14% more.', t=>t.ascendBonusRate+=0.14],
       ['SINGULAR FOCUS','★','+18% more, and ascension damage scales harder.', t=>{t.ascendBonusRate+=0.18;t.ascDamage+=0.04;}]]
    ])
  },
  {
    id: 'orin', faction: 'human', name: "CHF. O'RYAN", title: 'The Engineer',
    color: '#22d3ee', icon: '⚙',
    blurb: "Builds fast and rebuilds faster. O'Ryan treats a lost tower as a delay, not a defeat.",
    abilities: ['focusfire', 'dampen'],
    /* FIELD WORKSHOP bolts things down: a barricade and a siege battery, both a level early. */
    signature: { towers: ['rampart', 'bombard'], units: ['linebreaker', 'gunskiff'] },
    trait: { name: 'FIELD WORKSHOP',
      desc: 'Towers begin one level higher, and upgrades cost 15% less.',
      apply: t => { t.startLevel = (t.startLevel || 0) + 1; t.upgradeMul *= 0.85; } },
    tech: chart('o', [
      [['BLUEPRINTS','▤','Upgrades cost a further 10% less.', t=>t.upgradeMul*=0.90],
       ['PREFAB','▥','And another 12% less.', t=>t.upgradeMul*=0.88],
       ['ASSEMBLY LINE','▧','And another 15% less.', t=>t.upgradeMul*=0.85]],
      [['CALIBRATION','⌖','+8% tower damage.', t=>t.dmg+=0.08],
       ['TOLERANCING','⌗','+10% tower damage.', t=>t.dmg+=0.10],
       ['MASTERWORK','✦','+14% tower damage and +8% range.', t=>{t.dmg+=0.14;t.rng+=0.08;}]],
      [['REDUNDANCY','⛨','Disruption on your towers ends 40% sooner.', t=>t.jamResist+=0.40],
       ['HARDENED','⛊','And a further 40% sooner.', t=>t.jamResist+=0.40],
       ['UNSHAKEABLE','✚','Your towers cannot be disabled at all.', t=>t.jamImmune=true]]
    ])
  },
  {
    id: 'vess', faction: 'human', name: 'MAR. WASHINGTON', title: 'The Marshal',
    color: '#0ea5e9', icon: '⛨',
    blurb: 'Holds ground nobody else would. Washington measures a battle in how little was given up.',
    abilities: ['overclock', 'bulwark'],
    /* NO GROUND GIVEN holds ground by making the ground itself hostile. */
    signature: { towers: ['coldfront', 'cryo'], units: ['vanguard', 'dragoon'] },
    trait: { name: 'NO GROUND GIVEN',
      desc: '+8 maximum lives, and leaks cost one fewer life (minimum one).',
      apply: (t, s) => { t.leakReduce = 1; if (s) { s.maxLives += 8; s.lives += 8; } } },
    tech: chart('m', [
      [['ENTRENCH','⛰','+4 maximum lives.', (t,s)=>{ if(s){s.maxLives+=4;s.lives+=4;} }],
       ['GARRISON','⛫','+6 more maximum lives.', (t,s)=>{ if(s){s.maxLives+=6;s.lives+=6;} }],
       ['LAST STAND','★','+8 more, and survive one lethal leak per battle.', (t,s)=>{ if(s){s.maxLives+=8;s.lives+=8;} t.immortal=true; }]],
      [['DISCIPLINE','◎','+10% tower rate.', t=>t.rate+=0.10],
       ['DRILL','◉','+12% tower rate.', t=>t.rate+=0.12],
       ['PARADE ORDER','✷','+15% rate and +10% damage.', t=>{t.rate+=0.15;t.dmg+=0.10;}]],
      [['FIELD MEDIC','✚','Recover 1 life every 4 waves.', t=>t.lifeRegen+=0.25],
       ['TRIAGE','✛','Recover 1 life every 2 waves.', t=>t.lifeRegen+=0.25],
       ['IMMORTAL CORPS','∞','Life recovery is 60% more effective.', t=>t.lifeGainMul+=0.60]]
    ])
  },

  /* ═════════════════════════════════════════ FEDERATION OF LIGHT ═══ */
  /* THE SECRET HUMAN. Unlocked by finishing the game under the human banner
     (first galaxy conquered, galaxyTier >= 1): see Meta.commanderSecretLock.
     Hidden from every list until then, because a secret that advertises
     itself is a menu item.

     The character walks carefully, per the canon guardrails: the disclosure
     files include the ISSA FRAGMENTS, the old contested texts about a
     teacher with powers who travelled east and sat with the monasteries,
     and the game presents them as exactly that, a contested record his
     followers argue about, never a verdict about anyone's faith. His kit is
     the pacifist reading of the engine: lives, recovery, and echoes too
     gentle to march.

     noSeat: never drawn as a system boss or a fork rival, so appending him
     cannot change any draw an in-flight save regenerates. */
  {
    id: 'isa', faction: 'human', name: 'ISA', title: 'The Wanderer',
    color: '#f1f5f9', icon: '\u2736', noSeat: true, secretHuman: true,
    blurb: 'Wins by refusing the exchange. Isa keeps his people standing, quiets what the node raises, and outlasts everything sent to make him kneel.',
    abilities: ['steadyaim', 'dampen'],
    /* THE QUIET WORD waits. Damage that grows while it waits, and gas that never announces itself. */
    signature: { towers: ['arbalest', 'canister'], units: ['trooper', 'vanguard'] },
    trait: { name: 'THE QUIET WORD',
      desc: '+3 maximum lives, life recovery is 25% better, and reanimated attackers are 15% weaker.',
      apply: (t, s) => { if (s) { s.maxLives += 3; s.lives += 3; } t.lifeGainMul += 0.25; t.reanimResist = 0.15; } },
    tech: chart('ii', [
      [['STILL WATER','\u25CB','+8% tower range.', t=>t.rng+=0.08],
       ['THE CROWD LISTENS','\u25C9','+8% tower rate.', t=>t.rate+=0.08],
       ['SERMON','\u2605','+8% damage, +6% range.', t=>{t.dmg+=0.08;t.rng+=0.06;}]],
      [['FORTY DAYS','\u2295','Life recovery 20% better again.', t=>t.lifeGainMul+=0.20],
       ['THE FAST','\u2296','Upgrades cost 10% less.', t=>t.upgradeMul*=0.90],
       ['LOAVES','\u2299','+18% kill gold.', t=>t.goldMul+=0.18]],
      [['TURN AWAY','\u26E8','Reanimates 10% weaker again.', t=>t.reanimResist+=0.10],
       ['THE OTHER CHEEK','\u26D2','+4 maximum lives.', (t,s)=>{ if(s){s.maxLives+=4;s.lives+=4;} }],
       ['RESURRECTION','\u221E','+6 more lives, and survive one lethal leak per battle.', (t,s)=>{ if(s){s.maxLives+=6;s.lives+=6;} t.immortal=true; }]]
    ])
  },
  {
    id: 'seraph', faction: 'light', name: 'SERAPH', title: 'The Radiant', free: true,
    color: '#fbbf24', icon: '☀',
    blurb: 'Every structure Seraph blesses stands a little taller. The Federation does not field its strongest: it makes everything strong at once.',
    abilities: ['zealotry', 'sanctify'],
    /* RADIANCE widens auras: the consecration and the turning lamp that owns the approach. */
    signature: { towers: ['beacon', 'pharos'], units: ['luminark', 'oriflamme'] },
    trait: { name: 'RADIANCE',
      desc: 'Every tower gains +8% damage and +8% range, and support auras are 30% wider.',
      apply: t => { t.dmg += 0.08; t.rng += 0.08; t.auraRangeMul = (t.auraRangeMul || 1) * 1.30; } },
    tech: chart('s', [
      [['DAWNLIGHT','☼','+7% tower damage.', t=>t.dmg+=0.07],
       ['HIGH NOON','✹','+9% more damage.', t=>t.dmg+=0.09],
       ['ZENITH','★','+12% more, and auras 20% wider again.', t=>{t.dmg+=0.12;t.auraRangeMul*=1.20;}]],
      [['CLARITY','◎','+8% range.', t=>t.rng+=0.08],
       ['FARSIGHT','⊙','+10% more range.', t=>t.rng+=0.10],
       ['REVELATION','✧','+12% more range and +8% rate.', t=>{t.rng+=0.12;t.rate+=0.08;}]],
      [['COMMUNION','✚','+3 maximum lives and 25% better life recovery.', (t,s)=>{ if(s){s.maxLives+=3;s.lives+=3;} t.lifeGainMul+=0.25; }],
       ['THE VOW','⛨','+5 more lives. Signatories are counted, not spent.', (t,s)=>{ if(s){s.maxLives+=5;s.lives+=5;} }],
       ['STANDING ACCORD','∞','+8 more lives, and survive one lethal leak per battle.', (t,s)=>{ if(s){s.maxLives+=8;s.lives+=8;} t.immortal=true; }]]
    ])
  },
  {
    id: 'aurelia', faction: 'light', name: 'AURELIA', title: 'The Chorus',
    color: '#fcd34d', icon: '✧',
    blurb: 'Sings the wounded back onto their feet. Aurelia loses battles slowly and wins them late.',
    abilities: ['zealotry', 'bulwark'],
    /* CHORAL RECOVERY answers losses. So do both of these: the choir does not stop when a voice does. */
    signature: { towers: ['antiphon', 'sepulchre'], units: ['votary', 'censer'] },
    trait: { name: 'CHORAL RECOVERY',
      desc: 'Recover 1 life every 2 waves, and all life recovery is 50% more effective.',
      apply: t => { t.lifeRegen += 0.5; t.lifeGainMul += 0.50; } },
    tech: chart('a', [
      [['HARMONY','♪','+6% tower damage and rate.', t=>{t.dmg+=0.06;t.rate+=0.06;}],
       ['CANTICLE','♫','+8% more of both.', t=>{t.dmg+=0.08;t.rate+=0.08;}],
       ['ANTHEM','★','+11% more of both.', t=>{t.dmg+=0.11;t.rate+=0.11;}]],
      [['SOLACE','✚','+4 maximum lives.', (t,s)=>{ if(s){s.maxLives+=4;s.lives+=4;} }],
       ['RESTORATION','✛','Life recovery 40% more effective.', t=>t.lifeGainMul+=0.40],
       ['RESURGENCE','∞','+8 lives and recovery 50% better again.', (t,s)=>{ if(s){s.maxLives+=8;s.lives+=8;} t.lifeGainMul+=0.50; }]],
      [['BENEDICTION','◎','Status effects last 20% longer.', t=>t.status+=0.20],
       ['CONSECRATION','⊙','+25% more status duration.', t=>t.status+=0.25],
       ['APOTHEOSIS','✷','+30% more, and +10% damage.', t=>{t.status+=0.30;t.dmg+=0.10;}]]
    ])
  },
  {
    id: 'lumen', faction: 'light', name: 'LUMEN', title: 'The Warden',
    color: '#f59e0b', icon: '⛊',
    blurb: 'Shields first, shoots second. Nothing Lumen protects has ever been taken off the board.',
    abilities: ['focusfire', 'sanctify'],
    /* AEGIS DOCTRINE cannot be jammed, so it anchors on the beam a jam would
       otherwise ruin and the ward that stops one landing at all. NOT custodian:
       owner-sweep 40.4 measured LUMEN and HALDER drafting an IDENTICAL board
       from an identical seed, because both signatures named it and both are
       support-heavy enough to converge on the rest. */
    signature: { towers: ['ward', 'prism'], units: ['sanctifier', 'oriflamme'] },
    trait: { name: 'AEGIS DOCTRINE',
      desc: 'Your towers cannot be jammed or sabotaged, anywhere on the board.',
      apply: t => { t.jamImmune = true; } },
    tech: chart('l', [
      [['SHIELDING','⛨','Towers resist disruption entirely.', t=>t.jamImmune=true],
       ['REINFORCE','⛰','+9% tower damage.', t=>t.dmg+=0.09],
       ['IMPREGNABLE','★','+13% damage and +6 lives.', (t,s)=>{t.dmg+=0.13; if(s){s.maxLives+=6;s.lives+=6;}}]],
      [['LANTERN','◎','+9% range.', t=>t.rng+=0.09],
       ['BEACON','⊙','+11% more range.', t=>t.rng+=0.11],
       ['LIGHTHOUSE','✧','+14% more range and 25% wider auras.', t=>{t.rng+=0.14;t.auraRangeMul=(t.auraRangeMul||1)*1.25;}]],
      [['PIERCING LIGHT','⌖','Physical damage ignores 12% more armour.', t=>t.pierce+=0.12],
       ['SUNLANCE','⌗','+15% more armour ignored.', t=>t.pierce+=0.15],
       ['JUDGEMENT','✦','+18% more, and +10% damage.', t=>{t.pierce+=0.18;t.dmg+=0.10;}]]
    ])
  },
  {
    id: 'cantor', faction: 'light', name: 'CANTOR', title: 'The Voice',
    color: '#eab308', icon: '◍',
    blurb: 'Talks the enemy to a standstill. Cantor believes a battle prevented is a battle won.',
    abilities: ['zealotry', 'dampen'],
    /* THE LONG SERMON stretches every hold: rewinding time and holding resistances open, both 45% longer. */
    signature: { towers: ['chrono', 'concord'], units: ['censer', 'sanctifier'] },
    trait: { name: 'THE LONG SERMON',
      desc: 'Every slow, freeze and weaken you apply lasts 45% longer.',
      apply: t => { t.status += 0.45; } },
    tech: chart('c', [
      [['CADENCE','♪','+20% status duration.', t=>t.status+=0.20],
       ['REFRAIN','♬','+25% more.', t=>t.status+=0.25],
       ['LITANY','★','+30% more, and +8% damage.', t=>{t.status+=0.30;t.dmg+=0.08;}]],
      [['PERSUASION','◎','+8% tower rate.', t=>t.rate+=0.08],
       ['CONVICTION','◉','+11% more rate.', t=>t.rate+=0.11],
       ['REVELATION','✷','+14% more rate and +8% range.', t=>{t.rate+=0.14;t.rng+=0.08;}]],
      [['DOUBT','⊗','Enemies you slow also take 8% more damage.', t=>t.slowVuln+=0.08],
       ['DESPAIR','⊘','+10% more.', t=>t.slowVuln+=0.10],
       ['SURRENDER','∞','+14% more, and +4 lives.', (t,s)=>{t.slowVuln+=0.14; if(s){s.maxLives+=4;s.lives+=4;}}]]
    ])
  },
  {
    id: 'halder', faction: 'light', name: 'HALDER', title: 'The Bulwark',
    color: '#d97706', icon: '⛨',
    blurb: 'Absorbs everything and gives nothing. Halder has outlasted commanders who never lost a wave.',
    abilities: ['focusfire', 'bulwark'],
    /* DEEP LINE means the line survives the tower. Dead towers keep firing, wardens spend themselves on breaches. */
    signature: { towers: ['sepulchre', 'custodian'], units: ['luminark', 'sanctifier'] },
    trait: { name: 'DEEP LINE',
      desc: '+60% maximum lives, and every source of life recovery is 50% more effective.',
      apply: (t, s) => { t.lifeGainMul += 0.50; if (s) { const add = Math.round(s.maxLives * 0.6); s.maxLives += add; s.lives += add; } } },
    tech: chart('h', [
      [['RAMPARTS','⛰','+5 maximum lives.', (t,s)=>{ if(s){s.maxLives+=5;s.lives+=5;} }],
       ['REDOUBT','⛫','+7 more lives.', (t,s)=>{ if(s){s.maxLives+=7;s.lives+=7;} }],
       ['CITADEL','★','+10 more, and survive one lethal leak.', (t,s)=>{ if(s){s.maxLives+=10;s.lives+=10;} t.immortal=true; }]],
      [['ATTRITION','◎','+8% tower damage.', t=>t.dmg+=0.08],
       ['GRINDSTONE','◉','+11% more damage.', t=>t.dmg+=0.11],
       ['INEXORABLE','✷','+14% more damage and +8% rate.', t=>{t.dmg+=0.14;t.rate+=0.08;}]],
      [['FIELD HOSPITAL','✚','Recover 1 life every 3 waves.', t=>t.lifeRegen+=0.33],
       ['CONVALESCENCE','✛','Recovery 40% more effective.', t=>t.lifeGainMul+=0.40],
       ['UNDYING','∞','Recovery 60% better again.', t=>t.lifeGainMul+=0.60]]
    ])
  },

  /* ═══════════════════════════════════════════════════════ THE XENO ═══ */
  /* SUPREME COMMANDER, FIRST SPEAKER, and deliberately the LAST commander
     on the Federation shelf: the soul ladder (Meta.commanderSystemsLock)
     prices each successive commander behind one more conquered solar
     system, so Ashtar is what a Federation campaign is climbing toward. He
     also closes the light campaign's story in person (js/story.js).

     noSeat: Ashtar is never a random system boss and never a fork-node
     rival. That is canon (the Supreme Commander does not skirmish), and it
     is also what keeps this append save-safe: boss and fork draws take
     `rnd() * pool.length`, galaxies regenerate from their seed on every
     load, and a pool that grew would silently reroll every boss in every
     in-flight campaign. commandersOf filters noSeat, so the pools are
     byte-identical to the day before he existed. */
  {
    id: 'ashtar', faction: 'light', name: 'ASHTAR', title: 'Supreme Commander',
    color: '#fde68a', icon: '\u2726', noSeat: true,
    blurb: 'The Mandate, embodied and finally flexible. Ashtar lifts the whole line at once and forgives the mistakes that would end anyone else.',
    abilities: ['sanctify', 'bulwark'],
    /* FIRST SPEAKER ramps and opens: the beam that climbs, on the body held utterly open. */
    signature: { towers: ['prism', 'monstrance'], units: ['luminark', 'votary'] },
    trait: { name: 'FIRST SPEAKER',
      desc: 'Every tower gains +7% damage and +7% range, support auras are 20% wider, and +3 maximum lives.',
      apply: (t, s) => { t.dmg += 0.07; t.rng += 0.07; t.auraRangeMul = (t.auraRangeMul || 1) * 1.20; if (s) { s.maxLives += 3; s.lives += 3; } } },
    tech: chart('aa', [
      [['THE ADDRESS','\u2600','+7% damage.', t=>t.dmg+=0.07],
       ['THE DECREE','\u2609','+9% more damage.', t=>t.dmg+=0.09],
       ['THE MANDATE','\u2605','+11% more, and auras 15% wider again.', t=>{t.dmg+=0.11;t.auraRangeMul*=1.15;}]],
      [['HIGH ORBIT','\u25CE','+9% range.', t=>t.rng+=0.09],
       ['THE WATCH','\u2299','+10% more range.', t=>t.rng+=0.10],
       ['OVERSIGHT','\u2727','+10% more range and +8% rate.', t=>{t.rng+=0.10;t.rate+=0.08;}]],
      [['THE RING','\u2720','+4 maximum lives.', (t,s)=>{ if(s){s.maxLives+=4;s.lives+=4;} }],
       ['SANCTUARY','\u26E8','+6 more lives and 25% better recovery.', (t,s)=>{ if(s){s.maxLives+=6;s.lives+=6;} t.lifeGainMul+=0.25; }],
       ['WHAT ORDER IS FOR','\u221E','+8 more lives, and survive one lethal leak per battle.', (t,s)=>{ if(s){s.maxLives+=8;s.lives+=8;} t.immortal=true; }]]
    ])
  },
  {
    id: 'sevra', faction: 'xeno', name: 'SEVRA', title: 'The Necrotist', free: true,
    color: '#a78bfa', icon: '☠',
    blurb: 'What Sevra kills does not stop. It changes sides, and it comes back faster than it left.',
    abilities: ['ravenous', 'consume'],
    /* RISEN LEGION fields the dead. One tower turns them, the other pays for it in lives. */
    signature: { towers: ['siren', 'siphon'], units: ['broodmother', 'hivelord'] },
    trait: { name: 'RISEN LEGION',
      desc: 'Units you reanimate arrive with +75% health and move 25% faster.',
      apply: t => { t.reanimHp = 1.75; t.reanimSpeed = 1.25; } },
    tech: chart('r', [
      [['GRAVE TITHE','◈','Each reanimate you send pays ' + sqGold(2) + ' gold.', t=>t.reanimGold+=sqGold(2)],
       ['BONE HARVEST','⛁','+' + sqGold(3) + ' more gold per reanimate.', t=>t.reanimGold+=sqGold(3)],
       ['CHARNEL ECONOMY','★','+' + sqGold(5) + ' more, and reanimates are 20% tougher.', t=>{t.reanimGold+=sqGold(5);t.reanimHp+=0.20;}]],
      [['SECOND BREATH','◐','Reanimates +25% health.', t=>t.reanimHp+=0.25],
       ['UNQUIET','◑','+30% more health.', t=>t.reanimHp+=0.30],
       ['LEGION ETERNAL','∞','+40% more, and 15% faster.', t=>{t.reanimHp+=0.40;t.reanimSpeed+=0.15;}]],
      [['SPITE','⊗','+8% tower damage.', t=>t.dmg+=0.08],
       ['MALICE','⊘','+11% more damage.', t=>t.dmg+=0.11],
       ['ANNIHILATION','✷','+15% more damage.', t=>t.dmg+=0.15]]
    ])
  },
  {
    id: 'mawlord', faction: 'xeno', name: 'MAWLORD', title: 'The Devourer',
    color: '#8b5cf6', icon: '⬢',
    blurb: 'Grows by eating. Every corpse on the field is Mawlord getting larger.',
    abilities: ['ravenous', 'consume'],
    /* INSATIABLE ramps on kills without limit, and these are the two towers that do the same. */
    signature: { towers: ['alchemist', 'gestalt'], units: ['chitling', 'gnawling'] },
    trait: { name: 'INSATIABLE',
      desc: '+20% gold from kills, and your towers gain 1% damage per 20 kills, without limit.',
      apply: t => { t.goldMul += 0.20; t.killRamp = 0.0005; } },
    tech: chart('d', [
      [['GORGE','◈','+15% kill gold.', t=>t.goldMul+=0.15],
       ['GLUT','⛁','+20% more kill gold.', t=>t.goldMul+=0.20],
       ['FEAST','★','+25% more, and kills ramp damage twice as fast.', t=>{t.goldMul+=0.25;t.killRamp*=2;}]],
      [['SWELL','◐','+9% tower damage.', t=>t.dmg+=0.09],
       ['BLOAT','◑','+12% more damage.', t=>t.dmg+=0.12],
       ['COLOSSAL','✷','+16% more damage and +8% range.', t=>{t.dmg+=0.16;t.rng+=0.08;}]],
      [['DIGEST','⊕','Reanimates +20% health.', t=>t.reanimHp+=0.20],
       ['ASSIMILATE','⊛','+30% more.', t=>t.reanimHp+=0.30],
       ['BECOME','∞','+40% more and +20% speed.', t=>{t.reanimHp+=0.40;t.reanimSpeed+=0.20;}]]
    ])
  },
  {
    id: 'thrax', faction: 'xeno', name: 'THRAX', title: 'The Hivemind',
    color: '#9333ea', icon: '⬡',
    blurb: 'Never fights alone. Thrax fields a swarm and lets the swarm do the arithmetic.',
    abilities: ['ravenous', 'smokescreen'],
    /* BROOD LOGIC makes copies cheap. The cheapest venom, stacked, growing on every kill beside it. */
    signature: { towers: ['toxin', 'gestalt'], units: ['gnawling', 'bloatpod'] },
    trait: { name: 'BROOD LOGIC',
      desc: 'Per-copy price growth is 25% gentler and every tower fires 8% faster.',
      apply: t => { t.costGrowthMul = 0.75; t.rate += 0.08; } },
    tech: chart('t', [
      [['SPAWNING','⊞','Price growth 12% gentler.', t=>t.costGrowthMul*=0.88],
       ['PROLIFERATE','⊟','And another 12%.', t=>t.costGrowthMul*=0.88],
       ['INFEST','★','And another 15%, plus 8% rate.', t=>{t.costGrowthMul*=0.85;t.rate+=0.08;}]],
      [['CHITIN','◎','+8% tower damage.', t=>t.dmg+=0.08],
       ['CARAPACE','◉','+11% more damage.', t=>t.dmg+=0.11],
       ['APEX FORM','✷','+15% more damage.', t=>t.dmg+=0.15]],
      [['PHEROMONE','⊙','+10% rate.', t=>t.rate+=0.10],
       ['SYNAPSE','⊛','+13% more rate.', t=>t.rate+=0.13],
       ['ONE MIND','∞','+16% more rate and +8% range.', t=>{t.rate+=0.16;t.rng+=0.08;}]]
    ])
  },
  {
    id: 'vorn', faction: 'xeno', name: 'VORN', title: 'The Blight',
    color: '#a855f7', icon: '☣',
    blurb: 'Does not kill things so much as ensure they will not survive. Vorn wins after the fighting stops.',
    abilities: ['ravenous', 'dampen'],
    /* CONTAGION strengthens everything that lingers. Digestive spray, and healing billed back as damage. */
    signature: { towers: ['ichor', 'veil'], units: ['bloatpod', 'hivelord'] },
    trait: { name: 'CONTAGION',
      desc: 'All damage-over-time effects are 50% stronger and last 30% longer.',
      apply: t => { t.dotMul = 1.50; t.status += 0.30; } },
    tech: chart('b', [
      [['SEPSIS','☠','DoT effects +20% stronger.', t=>t.dotMul+=0.20],
       ['NECROSIS','☣','+25% stronger.', t=>t.dotMul+=0.25],
       ['PANDEMIC','★','+35% stronger and +15% duration.', t=>{t.dotMul+=0.35;t.status+=0.15;}]],
      [['WEAKEN','⊗','Enemies you slow take 10% more damage.', t=>t.slowVuln+=0.10],
       ['WITHER','⊘','+12% more.', t=>t.slowVuln+=0.12],
       ['DISSOLVE','✷','+16% more, and +10% damage.', t=>{t.slowVuln+=0.16;t.dmg+=0.10;}]],
      [['SPORES','◐','Reanimates +25% health.', t=>t.reanimHp+=0.25],
       ['BLOOM','◑','+30% more.', t=>t.reanimHp+=0.30],
       ['OVERGROWTH','∞','+40% more and ' + sqGold(2) + ' gold each.', t=>{t.reanimHp+=0.40;t.reanimGold+=sqGold(2);}]]
    ])
  },
  {
    id: 'ulgrim', faction: 'xeno', name: 'ULGRIM', title: 'The Maw',
    color: '#6d28d9', icon: '◉',
    blurb: 'Only interested in the big ones. Ulgrim measures a battle by what it managed to swallow whole.',
    abilities: ['broadside', 'consume'],
    /* ELITE CAPTURE hunts the one big thing: swallow it whole, or fall on the worst wound on the board. */
    signature: { towers: ['maw', 'impaler'], units: ['broodmother', 'chitling'] },
    trait: { name: 'ELITE CAPTURE',
      desc: '+25% damage against bosses and minibosses, and they pay double bounty.',
      apply: t => { t.eliteDamage = 1.25; t.eliteBounty = 2; } },
    tech: chart('u', [
      [['REND','⌖','Physical damage ignores 14% more armour.', t=>t.pierce+=0.14],
       ['SUNDER','⌗','+17% more armour ignored.', t=>t.pierce+=0.17],
       ['DEVASTATE','★','+20% more, and +12% damage.', t=>{t.pierce+=0.20;t.dmg+=0.12;}]],
      [['HUNGER','◎','+10% tower damage.', t=>t.dmg+=0.10],
       ['STARVATION','◉','+13% more damage.', t=>t.dmg+=0.13],
       ['THE MAW','✷','+18% more damage.', t=>t.dmg+=0.18]],
      [['CRUSH','⊕','+15% crit damage.', t=>t.critMult+=0.15],
       ['SHATTER','⊛','+10% crit chance.', t=>t.crit+=0.10],
       ['OBLITERATE','∞','+14% crit chance and +25% crit damage.', t=>{t.crit+=0.14;t.critMult+=0.25;}]]
    ])
  },

  /* ═══════════════════════════════════════════════════ THE PIRATES ═══ */
  {
    id: 'rake', faction: 'pirate', name: 'RAKE', title: 'The Corsair', free: true,
    color: '#ef4444', icon: '☠',
    blurb: 'Takes what is not nailed down and shoots what is. Rake funds the next tower with the last kill.',
    abilities: ['broadside', 'smokescreen'],
    /* PLUNDER is paid per kill, so it robs a rival on every one and lays cheap mines to make them. */
    signature: { towers: ['privateer', 'sapper'], units: ['cutter', 'boarder'] },
    trait: { name: 'PLUNDER',
      desc: '+30% gold from kills, and you begin with ' + sqGold(300) + ' extra gold.',
      apply: (t, s) => { t.goldMul += 0.30; if (s) s.gold += sqGold(300); } },
    tech: chart('p', [
      [['LOOT','◈','+15% kill gold.', t=>t.goldMul+=0.15],
       ['PILLAGE','⛁','+20% more.', t=>t.goldMul+=0.20],
       ['RANSACK','★','+28% more, and +' + sqGold(250) + ' starting gold.', (t,s)=>{t.goldMul+=0.28; if(s)s.gold+=sqGold(250);}]],
      [['CUTLASS','◎','+9% tower damage.', t=>t.dmg+=0.09],
       ['GRAPESHOT','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['BROADSIDE','✷','+16% more damage and +10% rate.', t=>{t.dmg+=0.16;t.rate+=0.10;}]],
      [['SCUTTLE','↺','Selling returns 90%.', t=>t.sellRate=0.90],
       ['REFIT','↻','Upgrades cost 14% less.', t=>t.upgradeMul*=0.86],
       ['PRIZE CREW','∞','Upgrades 16% less again, and price growth 12% gentler.', t=>{t.upgradeMul*=0.84;t.costGrowthMul*=0.88;}]]
    ])
  },
  {
    id: 'scarlet', faction: 'pirate', name: 'SCARLET', title: 'The Reaver',
    color: '#dc2626', icon: '⚔',
    blurb: 'Attacks first and works out the plan afterwards. Scarlet has never held a defensive position on purpose.',
    abilities: ['broadside', 'consume'],
    /* BLOOD PRICE is the trait and the tower. Bought with lives, never with gold. */
    signature: { towers: ['bloodprice', 'pyre'], units: ['wrecker', 'ironhulk'] },
    trait: { name: 'BLOOD PRICE',
      desc: '+22% tower damage, but you begin with 4 fewer lives.',
      apply: (t, s) => { t.dmg += 0.22; if (s) { s.maxLives = Math.max(5, s.maxLives - 4); s.lives = s.maxLives; } } },
    tech: chart('e', [
      [['FRENZY','⚡','+12% rate.', t=>t.rate+=0.12],
       ['BLOODLUST','✹','+15% more rate.', t=>t.rate+=0.15],
       ['UNCHAINED','★','+18% more rate and +10% damage.', t=>{t.rate+=0.18;t.dmg+=0.10;}]],
      [['SAVAGERY','◎','+10% damage.', t=>t.dmg+=0.10],
       ['BUTCHERY','◉','+14% more damage.', t=>t.dmg+=0.14],
       ['CARNAGE','✷','+18% more damage.', t=>t.dmg+=0.18]],
      [['FIRST BLOOD','⊕','+8% crit chance.', t=>t.crit+=0.08],
       ['EXECUTIONER','⊛','+11% more crit.', t=>t.crit+=0.11],
       ['NO QUARTER','∞','+14% crit and +30% crit damage.', t=>{t.crit+=0.14;t.critMult+=0.30;}]]
    ])
  },
  {
    id: 'grist', faction: 'pirate', name: 'GRIST', title: 'The Scrapper',
    color: '#f87171', icon: '⚙',
    blurb: 'Builds out of wreckage. Grist has never bought anything at full price in their life.',
    abilities: ['focusfire', 'smokescreen'],
    /* SALVAGE RIGHTS churns. Two cheap things that come back and get sold again at 95%. */
    signature: { towers: ['glaive', 'tether'], units: ['scrapjack', 'cutter'] },
    trait: { name: 'SALVAGE RIGHTS',
      desc: 'Selling returns 95%, upgrades cost 18% less, and price growth is 20% gentler.',
      apply: t => { t.sellRate = 0.95; t.upgradeMul *= 0.82; t.costGrowthMul = 0.80; } },
    tech: chart('g', [
      [['STRIP','⊗','Upgrades 12% cheaper.', t=>t.upgradeMul*=0.88],
       ['CANNIBALISE','⊘','And another 14%.', t=>t.upgradeMul*=0.86],
       ['FULL RECLAIM','★','And another 16%, plus 10% gentler price growth.', t=>{t.upgradeMul*=0.84;t.costGrowthMul*=0.90;}]],
      [['JURY RIG','◎','+9% tower damage.', t=>t.dmg+=0.09],
       ['OVERBUILT','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['FRANKENWORKS','✷','+15% more damage and +8% rate.', t=>{t.dmg+=0.15;t.rate+=0.08;}]],
      [['SCROUNGE','◈','+15% kill gold.', t=>t.goldMul+=0.15],
       ['HOARD','⛁','+18% more kill gold.', t=>t.goldMul+=0.18],
       ['THE PILE','∞','+22% more, and towers start a level higher.', t=>{t.goldMul+=0.22;t.startLevel=(t.startLevel||0)+1;}]]
    ])
  },
  {
    id: 'cinder', faction: 'pirate', name: 'CINDER', title: 'The Arsonist',
    color: '#f97316', icon: '🔥',
    blurb: 'Leaves nothing standing, including things that were already theirs. Cinder finds this an acceptable cost.',
    abilities: ['ravenous', 'smokescreen'],
    /* SCORCHED EARTH: the battery whose overloads detonate, and the boiler that feeds on its heat. */
    signature: { towers: ['carronade', 'stokehold'], units: ['boarder', 'scrapjack'] },
    trait: { name: 'SCORCHED EARTH',
      desc: 'Burn and splash damage are 45% stronger, and splash radius is 25% wider.',
      apply: t => { t.dotMul = (t.dotMul || 1) + 0.45; t.splash += 0.25; } },
    tech: chart('f', [
      [['KINDLING','🔥','Burn damage +20%.', t=>t.dotMul+=0.20],
       ['WILDFIRE','✹','+25% more.', t=>t.dotMul+=0.25],
       ['FIRESTORM','★','+35% more and +20% splash.', t=>{t.dotMul+=0.35;t.splash+=0.20;}]],
      [['POWDER','◎','+20% splash radius.', t=>t.splash+=0.20],
       ['ORDNANCE','◉','+25% more splash.', t=>t.splash+=0.25],
       ['DEMOLITION','✷','+30% more splash and +10% damage.', t=>{t.splash+=0.30;t.dmg+=0.10;}]],
      [['ASH','⊗','+9% tower damage.', t=>t.dmg+=0.09],
       ['EMBER','⊘','+12% more damage.', t=>t.dmg+=0.12],
       ['CONFLAGRATION','∞','+16% more damage and +25% status duration.', t=>{t.dmg+=0.16;t.status+=0.25;}]]
    ])
  },
  {
    id: 'dregg', faction: 'pirate', name: 'DREGG', title: 'The Warlord',
    color: '#b91c1c', icon: '⛧',
    blurb: 'Rules by being the largest thing in the room, and prices every gun he fields a little steeper than the last. Every Captain negotiates. Dregg simply names the number first.',
    abilities: ['broadside', 'dampen'],
    /* WARLORD wants fewer, bigger guns. Bank the charge, release the nova, throw what survives skyward. */
    signature: { towers: ['capacitor', 'cyclone'], units: ['ironhulk', 'scrapjack'] },
    trait: { name: 'WARLORD',
      desc: '+15% damage and +15% rate, but per-copy price growth is 15% steeper.',
      apply: t => { t.dmg += 0.15; t.rate += 0.15; t.costGrowthMul = 1.15; } },
    tech: chart('w', [
      [['CONSCRIPT','◎','+10% damage.', t=>t.dmg+=0.10],
       ['MARSHAL','◉','+13% more damage.', t=>t.dmg+=0.13],
       ['OVERLORD','★','+17% more damage.', t=>t.dmg+=0.17]],
      [['TRIBUTE','◈','+18% kill gold.', t=>t.goldMul+=0.18],
       ['EXTORTION','⛁','+22% more kill gold.', t=>t.goldMul+=0.22],
       ['DOMINION','✷','+26% more, and price growth back to normal.', t=>{t.goldMul+=0.26;t.costGrowthMul=1.0;}]],
      [['IRON FIST','⊕','+10% rate.', t=>t.rate+=0.10],
       ['TERROR','⊛','+13% more rate.', t=>t.rate+=0.13],
       ['ABSOLUTE','∞','+16% more rate and +10% range.', t=>{t.rate+=0.16;t.rng+=0.10;}]]
    ])
  },

  /* ======================================================================
     THE VIGIL, the fifth banner, and the machines' answer to the four.

     Every one of these COMPILES: it opens the battle weaker than the
     commander it was copied from and rewrites itself as the battle teaches
     it, crossing the original somewhere in the middle and finishing past
     them. That is the owner’s achilles heel stated as an engine rather than
     as a number -- the drawback is real and front-loaded, the payoff is real
     and needs the match to last.

     The four clones are copies of the four most MECHANICALLY singular
     commanders in the roster: the only owner of the ascension identity, the
     only flat immunity, the only unbounded scaler, and the only commander
     who takes a penalty to pay for a bonus. A copy of a commander who was
     merely strong would have nothing to distort.
     ====================================================================== */
  {
    id: 'axiom', faction: 'robot', name: 'AXIOM', title: 'The First Draft',
    color: '#e2e8f0', icon: '⬡', free: true,
    blurb: 'The first machine to finish a thought it was not given. Everything the Vigil is began as a note AXIOM made about somebody else\'s war.',
    abilities: ['focusfire', 'dampen'],
    /* BOOT SEQUENCE starts behind and recovers, so it builds the two things that compound while it does. */
    signature: { towers: ['vault', 'pylon'], units: ['stitch', 'fabricant'] },
    trait: { name: 'BOOT SEQUENCE',
      desc: 'Begins at −6% to every statistic and recovers 3% of it every wave, past baseline by the tenth.',
      apply: t => { t.dmg -= 0.06; t.rate -= 0.06; t.rng -= 0.06; } },
    compile: { name: 'BOOT SEQUENCE', metric: 'waves',
      desc: 'Recompiles on a schedule. It needs nothing from you but time.',
      levels: [
        { at: 3,  desc: 'first pass, +4% damage and rate', apply: (t, S, m) => { m.damage *= 1.04; m.rate *= 1.04; } },
        { at: 6,  desc: 'second pass, +4% more, and +4% range', apply: (t, S, m) => { m.damage *= 1.04; m.rate *= 1.04; m.range *= 1.04; } },
        { at: 10, desc: 'optimal, +6% damage, rate and range', apply: (t, S, m) => { m.damage *= 1.06; m.rate *= 1.06; m.range *= 1.06; } },
        { at: 15, desc: 'rewritten, +8% damage and +8% rate', apply: (t, S, m) => { m.damage *= 1.08; m.rate *= 1.08; } }
      ] },
    tech: chart('x', [
      [['PARSE','◎','+9% damage.', t=>t.dmg+=0.09],
       ['REWRITE','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['OPTIMAL','★','+15% more damage.', t=>t.dmg+=0.15]],
      [['CLOCK UP','⊕','+9% rate.', t=>t.rate+=0.09],
       ['PIPELINE','⊛','+12% more rate.', t=>t.rate+=0.12],
       ['UNROLLED','∞','Compiles arrive one level sooner.', t=>t.compileFloor=(t.compileFloor||0)+1]],
      [['SURVEY','◈','+10% range.', t=>t.rng+=0.10],
       ['TELEMETRY','⌖','+8% more range and +6% status.', t=>{t.rng+=0.08;t.status+=0.06;}],
       ['CONSENSUS','✷','+10% damage, rate and range.', t=>{t.dmg+=0.10;t.rate+=0.10;t.rng+=0.10;}]]
    ])
  },

  {
    id: 'nyx_r', faction: 'robot', name: 'NYX-R', title: 'The Cold Boot',
    color: '#cbd5e1', icon: '⟲',
    blurb: 'A copy of the Overclocker with the recklessness compiled out. It ascends slower than she did, then never stops.',
    abilities: ['overclock', 'smokescreen'],
    /* COLD BOOT gets cheaper per ascension, so it picks the two platforms most worth ascending. */
    signature: { towers: ['railgun', 'quadmount'], units: ['fabricant', 'splicer'] },
    trait: { name: 'COLD BOOT',
      desc: 'Ascension costs 10% MORE at first, and every ascension you complete cuts it further: past her 25% discount by the fourth.',
      apply: t => { t.ascCostMul = 1.10; t.surgeEvery = 1; } },
    compile: { name: 'COLD BOOT', metric: 'asc',
      desc: 'Every ascension teaches it the next one. Where NYX is cheapest at the start, this is cheapest at the end.',
      levels: [
        { at: 1, desc: 'first ascension: cost back to normal', apply: t => { t.ascCostMul = 1.00; } },
        { at: 2, desc: 'cost 0.85, +6% ascension damage', apply: t => { t.ascCostMul = 0.85; t.ascDamage = (t.ascDamage || 0) + 0.06; } },
        { at: 4, desc: 'cost 0.68: past the original', apply: t => { t.ascCostMul = 0.68; } },
        { at: 6, desc: 'cost 0.55, and +10% per ascension held', apply: t => { t.ascCostMul = 0.55; t.perAscDamage = (t.perAscDamage || 0) + 0.10; } }
      ] },
    tech: chart('y', [
      [['CORE HEAT','◎','+9% damage.', t=>t.dmg+=0.09],
       ['RECLOCK','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['REDLINED','★','+8% per ascension held.', t=>t.perAscDamage=(t.perAscDamage||0)+0.08]],
      [['PRE-FETCH','⊕','Compiles arrive one level sooner.', t=>t.compileFloor=(t.compileFloor||0)+1],
       ['BRANCH HINT','⊛','+11% rate.', t=>t.rate+=0.11],
       ['SPECULATIVE','∞','Compiles arrive one level sooner again.', t=>t.compileFloor=(t.compileFloor||0)+1]],
      [['HEATSINK','◈','+9% rate.', t=>t.rate+=0.09],
       ['LIQUID COOLED','⌖','+8% ascension damage.', t=>t.ascDamage=(t.ascDamage||0)+0.08],
       ['ABSOLUTE ZERO','✷','+12% damage and +10% rate.', t=>{t.dmg+=0.12;t.rate+=0.10;}]]
    ])
  },

  {
    id: 'lumen_r', faction: 'robot', name: 'LUMEN-R', title: 'The Hardened',
    color: '#f1f5f9', icon: '⛨',
    blurb: 'The Warden\'s immunity was a fact about the Warden. This one has to earn it, by being jammed enough times to understand jamming.',
    abilities: ['focusfire', 'sanctify'],
    /* INTRUSION TRAINING hardens under attack: switch their abilities off, and keep drones flying while the bay is jammed. */
    signature: { towers: ['nullfield', 'dronebay'], units: ['splicer', 'gantry'] },
    trait: { name: 'INTRUSION TRAINING',
      desc: 'Begins with NO jam protection. Every intrusion against you hardens it: total immunity once it has seen enough.',
      apply: t => { t.jamResist = 0; } },
    compile: { name: 'INTRUSION TRAINING', metric: 'jams',
      desc: 'Learns from being attacked. Against a board that never jams, it stays a defensive commander with a very good chart.',
      levels: [
        { at: 2,  desc: 'partial hardening. 35% jam resistance', apply: t => { t.jamResist = Math.max(t.jamResist || 0, 0.35); } },
        { at: 5,  desc: '70% jam resistance', apply: t => { t.jamResist = Math.max(t.jamResist || 0, 0.70); } },
        { at: 9,  desc: 'IMMUNE: and +8% status', apply: (t, S, m) => { t.jamImmune = true; m.status *= 1.08; } },
        { at: 14, desc: 'counter-intrusion, +10% damage and +10% rate', apply: (t, S, m) => { m.damage *= 1.10; m.rate *= 1.10; } }
      ] },
    tech: chart('z', [
      [['SHIELDING','◎','+9% damage.', t=>t.dmg+=0.09],
       ['FARADAY','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['GROUNDED','★','+15% more damage.', t=>t.dmg+=0.15]],
      [['WATCHDOG','⊕','Compiles arrive one level sooner.', t=>t.compileFloor=(t.compileFloor||0)+1],
       ['TRIPWIRE','⊛','+10% status.', t=>t.status+=0.10],
       ['LOCKOUT','∞','Compiles arrive one level sooner again.', t=>t.compileFloor=(t.compileFloor||0)+1]],
      [['BULKHEAD','◈','+3 lives.', (t,s)=>{ if(s) s.maxLives+=3; }],
       ['REDUNDANT','⌖','+10% rate.', t=>t.rate+=0.10],
       ['UNBREACHED','✷','+12% range and +10% status.', t=>{t.rng+=0.12;t.status+=0.10;}]]
    ])
  },

  {
    id: 'mawlord_r', faction: 'robot', name: 'MAWLORD-R', title: 'The Starved Set',
    color: '#e2e8f0', icon: '⌬',
    blurb: 'A copy of the Devourer trained on no data at all. It begins knowing nothing about killing and ends knowing more than he does.',
    abilities: ['ravenous', 'consume'],
    /* DATASET STARVED trains on volume. Clump them with gravity, then slam the whole board. */
    signature: { towers: ['singularity', 'quake'], units: ['gantry', 'omniframe'] },
    trait: { name: 'DATASET STARVED',
      desc: 'No kill ramp at all to begin with. Kills train it: and once trained it ramps harder than the original, forever.',
      apply: t => { t.killRamp = 0; t.goldMul += 0.10; } },
    compile: { name: 'DATASET STARVED', metric: 'kills',
      desc: 'Every kill is a sample. The curve is flat until the set is large enough to mean anything.',
      levels: [
        { at: 40,  desc: 'first fit: the ramp begins', apply: t => { t.killRamp = 0.00030; } },
        { at: 120, desc: 'converging: ramp 0.00055', apply: t => { t.killRamp = 0.00055; } },
        { at: 260, desc: 'past the original: ramp 0.00075', apply: t => { t.killRamp = 0.00075; } },
        { at: 450, desc: 'overfit: ramp 0.00095 and +12% kill gold', apply: (t, S, m) => { t.killRamp = 0.00095; m.gold *= 1.12; } }
      ] },
    tech: chart('q', [
      [['SAMPLE','◎','+9% damage.', t=>t.dmg+=0.09],
       ['CLASSIFY','◉','+12% more damage.', t=>t.dmg+=0.12],
       ['GENERALISE','★','+16% more damage.', t=>t.dmg+=0.16]],
      [['BATCH','⊕','Compiles arrive one level sooner.', t=>t.compileFloor=(t.compileFloor||0)+1],
       ['AUGMENT','⊛','+20% kill gold.', t=>t.goldMul+=0.20],
       ['SYNTHETIC','∞','Compiles arrive one level sooner again.', t=>t.compileFloor=(t.compileFloor||0)+1]],
      [['PRUNE','◈','+10% rate.', t=>t.rate+=0.10],
       ['QUANTISE','⌖','+13% more rate.', t=>t.rate+=0.13],
       ['DISTILLED','✷','+10% damage and +10% range.', t=>{t.dmg+=0.10;t.rng+=0.10;}]]
    ])
  },

  {
    id: 'dregg_r', faction: 'robot', name: 'DREGG-R', title: 'The Audit',
    color: '#cbd5e1', icon: '⛓',
    blurb: 'The Warlord paid for his strength with a worse economy. The Audit runs the same books and balances them by wave nine.',
    abilities: ['broadside', 'dampen'],
    /* CAPITAL AUDIT pays down its penalty by investing: run the lattice past its rating and repeat every neighbour. */
    signature: { towers: ['reactor', 'echo'], units: ['omniframe', 'stitch'] },
    trait: { name: 'CAPITAL AUDIT',
      desc: '+12% damage and rate, and price growth 25% steeper: every gold you invest in the board pays the penalty down.',
      apply: t => { t.dmg += 0.12; t.rate += 0.12; t.costGrowthMul = 1.25; } },
    compile: { name: 'CAPITAL AUDIT', metric: 'invested',
      desc: 'Reads the ledger, not the clock. Build and upgrade and the penalty retires itself; sit on your gold and it never does.',
      levels: [
        { at: 900,  desc: 'reconciled: growth 1.12', apply: t => { t.costGrowthMul = 1.12; } },
        { at: 2200, desc: 'balanced: growth 1.00', apply: t => { t.costGrowthMul = 1.00; } },
        { at: 4200, desc: 'in credit: growth 0.88 and +12% kill gold', apply: (t, S, m) => { t.costGrowthMul = 0.88; m.gold *= 1.12; } },
        { at: 7000, desc: 'audited: growth 0.78 and +10% damage', apply: (t, S, m) => { t.costGrowthMul = 0.78; m.damage *= 1.10; } }
      ] },
    tech: chart('j', [
      [['LINE ITEM','◎','+10% damage.', t=>t.dmg+=0.10],
       ['WRITE-DOWN','◉','+13% more damage.', t=>t.dmg+=0.13],
       ['SEIZURE','★','+16% more damage.', t=>t.dmg+=0.16]],
      [['DEPRECIATE','⊕','Sells return 88%.', t=>t.sellRate=0.88],
       ['AMORTISE','⊛','Upgrades cost 12% less.', t=>t.upgradeMul*=0.88],
       ['SETTLED','∞','Compiles arrive one level sooner.', t=>t.compileFloor=(t.compileFloor||0)+1]],
      [['LEVY','◈','+16% kill gold.', t=>t.goldMul+=0.16],
       ['ARREARS','⌖','+10% rate.', t=>t.rate+=0.10],
       ['LIQUIDATED','✷','+20% kill gold and +8% damage.', t=>{t.goldMul+=0.20;t.dmg+=0.08;}]]
    ])
  }
];

/** Commanders belonging to a faction. CADRE is unaligned and belongs to nobody. */
/* Excludes noSeat commanders (Ashtar, Isa) BY CONSTRUCTION: this is the
   pool every boss draw and seat assignment samples with rnd()*pool.length,
   galaxies regenerate from their seed on every load, and a pool that grew
   would reroll every boss in every in-flight campaign. Filtering here keeps
   the pools byte-identical to before the append (fingerprint-verified). */
function commandersOf(factionId) { return COMMANDER_ROSTER.filter(c => c.faction === factionId && !c.noSeat); }
/** Commanders always available regardless of faction. */
function alwaysUnlocked() { return COMMANDER_ROSTER.filter(c => c.always).map(c => c.id); }
/** The one free commander for a faction. */
function freeCommanderOf(factionId) {
  const list = commandersOf(factionId);
  /* CADRE has no faction, so `commandersOf` never returns it -- a faction with
     no free commander would otherwise throw here. */
  const pick = list.find(c => c.free) || list[0];
  return pick ? pick.id : 'cadre';
}


/* ==========================================================================
   COMMANDER TREE SHAPES AND PRESTIGE TRACKS (Session 41)

   Owner: "Make all the commander's talent trees look more like [a WoW talent
   tree], where each one has a unique shape of lines for different talents,
   and on the right is the prestige tracker where each prestige unlocks 20%
   increase in talent stats in addition to a unique passive power that
   further defines the role and use of the commander."

   TWO TABLES AND A LOADER, keyed by commander id and stamped onto the roster
   at load. Kept apart from the chart() calls above on purpose: the charts
   are content the wire depends on and the tables are shape and progression.

   SHAPES. Every chart keeps its nine nodes, its ids and its three themes.
   What a shape changes is which node each one HANGS FROM. A node's `row` is
   its tier and never moves (the spend gate and the rival's build order read
   it, and the duel contract carries node ids, so nothing here may renumber).
   A shape is six parent choices: the three tier-1 nodes each pick a tier-0
   parent, the three tier-2 nodes each pick a tier-1 parent. Written as node
   NUMBERS 1..9 in chart order (col 0 = 1,2,3; col 1 = 4,5,6; col 2 = 7,8,9),
   so a shape reads the same for every commander regardless of id prefix.
   Twenty-eight distinct parent maps, and owner-sweep 43.3 holds them
   distinct. Columns on screen are laid out by the loader from the parents,
   so a child sits under the node it hangs from and two children of one
   parent spread to either side.

   PRESTIGE. Five passives per commander, one per star, applied by
   applyPrestigePassives ahead of the fold like a chart node. The +20% per
   star on every talent value already lives in foldTraits and is only
   DISPLAYED by the track; the passive is the new half. Several of these are
   the first writers of engine hooks that have had readers and no writer for
   twenty sessions: surgeMul (the ascension surge), vaultBonus (the Vault's
   skim), mods.interest (banked capital), compileRateMul (the machine
   commanders' compile metric). Granting them here is what the freshTraits
   comment asks for, and it is why those hooks stop being dead fields.

   Every desc leads with the mechanic. Where a figure is gold it goes through
   sqGold like the rest of this file.
   ========================================================================== */

const COMMANDER_SHAPES = {
  /*            p2 p3 p5 p6 p8 p9   silhouette */
  cadre:       [1, 2, 4, 5, 7, 8], /* the lattice: three straight lineages, the baseline */
  vanta:       [1, 2, 1, 5, 1, 8], /* the index: one root, everything cross-referenced from it */
  korrin:      [1, 2, 4, 2, 7, 8], /* the ledger: two columns settle into one account */
  nyx:         [1, 2, 1, 5, 4, 8], /* the redline: a fork that feeds back */
  orin:        [1, 2, 4, 5, 7, 5], /* the gantry: three uprights, one shared crossbeam */
  vess:        [1, 5, 4, 5, 7, 5], /* the wall: every deep talent stands behind the centre */
  isa:         [4, 2, 4, 5, 4, 8], /* the well: all three lineages draw from the middle */
  seraph:      [4, 2, 4, 5, 7, 8], /* the sunburst: one dawn, two rays */
  aurelia:     [1, 2, 4, 5, 4, 8], /* the chorus: two voices join under one */
  lumen:       [1, 2, 7, 5, 7, 8], /* the lighthouse: the beam lineage anchors the ward */
  cantor:      [1, 5, 4, 5, 7, 8], /* the sermon: the doubt branch answers the refrain */
  halder:      [4, 5, 4, 5, 4, 5], /* the citadel: a single spine, every tier a wall */
  ashtar:      [4, 2, 4, 2, 4, 2], /* the decree: one word, then one word again */
  sevra:       [1, 2, 1, 2, 7, 8], /* the ossuary: two lineages grow from the first grave */
  mawlord:     [7, 2, 4, 5, 7, 8], /* the gullet: it all starts at the maw */
  thrax:       [1, 2, 4, 8, 7, 8], /* the hive: the mind talent feeds two bodies */
  vorn:        [1, 8, 4, 5, 7, 8], /* the bloom: the spore lineage roots the plague */
  ulgrim:      [7, 8, 7, 8, 7, 8], /* the jaw: everything hangs from CRUSH */
  rake:        [4, 2, 1, 5, 7, 8], /* the rigging: crossed lines, nothing straight */
  scarlet:     [1, 2, 4, 5, 1, 8], /* the blade: two edges off one hilt */
  grist:       [1, 5, 4, 2, 7, 8], /* the scrapyard: parts bolted where they fit */
  cinder:      [7, 2, 7, 5, 7, 8], /* the flashpoint: one spark lights three fuses */
  dregg:       [1, 2, 7, 8, 7, 8], /* the fist: the iron lineage takes the tribute */
  axiom:       [4, 5, 4, 5, 7, 8], /* the pipeline: the clock lineage drives the parse */
  nyx_r:       [1, 2, 4, 5, 4, 5], /* the heatsink: cooling hangs off the pre-fetch */
  lumen_r:     [4, 2, 1, 5, 4, 8], /* the bulkhead: the watchdog gates both shields */
  mawlord_r:   [1, 2, 7, 8, 1, 2], /* the dataset: sample and prune, prune and sample */
  dregg_r:     [7, 2, 4, 5, 1, 8]  /* the audit: the levy opens the books */
};

/* EVERY NODE STAYS ON ITS OWN LINEAGE'S COLUMN (0, 2, 4), and a link to a
   parent in another lineage draws as a diagonal between columns.

   The first cut did the opposite: it placed each child under its PARENT'S
   column and spread siblings to either side. That un-crossed every
   cross-lineage link, and owner-sweep 43.3 caught what that costs on its
   first run: five commanders with different parent maps drew IDENTICAL
   trees (rake and grist and dregg_r all drew cadre's lattice, scarlet drew
   nyx's, lumen_r drew aurelia's), because the drawing depended only on where
   the layout put things and not on what hung from what. A unique parent map
   that draws identically is not unique to the eye.

   Anchoring on the lineage column makes the drawing a one-to-one image of
   the parent map: two shapes differ exactly when their lines do. It also
   makes a collision impossible by construction (one node per lineage per
   tier) and it is what the reference chart does, straight drops inside a
   lineage and diagonals across them. Deterministic, so every client lays a
   chart out the same way. */
function layoutTechShape(cmd) {
  const tech = cmd.tech;
  const byNum = n => tech[n - 1];
  const spec = COMMANDER_SHAPES[cmd.id];
  tech.forEach(t => { t.x = t.col * 2; t.parent = null; });
  if (spec) {
    const kids = [2, 3, 5, 6, 8, 9];
    kids.forEach((n, i) => { byNum(n).parent = byNum(spec[i]).id; });
  } else {
    /* No shape: the classic lattice, which is what parentOf's fallback draws. */
    tech.forEach(t => { if (t.row > 0) t.parent = byNum(t.col * 3 + t.row).id; });
  }
}

const COMMANDER_PRESTIGE = {
  cadre: [
    { name: 'EVEN KEEL',     icon: '⌂', desc: '+4% damage, rate and range.', apply: t => { t.dmg += 0.04; t.rate += 0.04; t.rng += 0.04; } },
    { name: 'RESERVES',      icon: '⛨', desc: '+4 maximum lives.', apply: (t, s) => { s.maxLives += 4; s.lives += 4; } },
    { name: 'QUARTERMASTER', icon: '◈', desc: 'Upgrades cost 8% less.', apply: t => { t.upgradeMul *= 0.92; } },
    { name: 'DRILLED',       icon: '◉', desc: 'Every tower starts one level higher.', apply: t => { t.startLevel += 1; } },
    { name: 'THE HOUSE',     icon: '★', desc: 'Reanimated attackers 15% weaker.', apply: t => { t.reanimResist += 0.15; } }
  ],
  vanta: [
    { name: 'ANNOTATED',   icon: '◎', desc: 'Command upgrades offer one more option.', apply: t => { t.draftOptions += 1; } },
    { name: 'CROSS-FILED', icon: '⊙', desc: '+6% damage for every command upgrade taken.', apply: t => { t.perModDamage += 0.06; } },
    { name: 'FIRST EDITION', icon: '◈', desc: 'Begin with 2 command upgrades already drafted.', apply: t => { t.startingMods += 2; } },
    { name: 'PRESS RUN',   icon: '⛁', desc: 'Command upgrades arrive one wave sooner.', apply: t => { t.draftEvery = Math.max(2, t.draftEvery - 1); } },
    { name: 'THE ARCHIVE', icon: '★', desc: 'One more option and +6% more damage per upgrade.', apply: t => { t.draftOptions += 1; t.perModDamage += 0.06; } }
  ],
  korrin: [
    { name: 'BULK ORDER',  icon: '◈', desc: 'Per-copy price growth 10% gentler.', apply: t => { t.costGrowthMul *= 0.90; } },
    { name: 'WAREHOUSE',   icon: '⛁', desc: 'The Vault skims 25% more gold.', apply: t => { t.vaultBonus *= 1.25; } },
    { name: 'CREDIT LINE', icon: '◉', desc: 'Banked gold earns 30% more interest.', apply: (t, s, m) => { m.interest *= 1.30; } },
    { name: 'FREE SAMPLE', icon: '◎', desc: 'The first copy of every tower is free.', apply: t => { t.freeCopies += 1; } },
    { name: 'WAR ECONOMY', icon: '★', desc: '+15% kill gold and the Vault skims 25% more again.', apply: t => { t.goldMul += 0.15; t.vaultBonus *= 1.25; } }
  ],
  nyx: [
    { name: 'HOT START',   icon: '◎', desc: 'Ascension costs 10% less.', apply: t => { t.ascCostMul *= 0.90; } },
    { name: 'OVERDRIVE',   icon: '⊙', desc: 'Each ascension adds +4% more damage.', apply: t => { t.perAscDamage += 0.04; } },
    { name: 'SURGE COIL',  icon: '◈', desc: 'Surges are 40% stronger.', apply: t => { t.surgeMul *= 1.40; } },
    { name: 'FLASHOVER',   icon: '⛁', desc: 'Every ascension also gives +3% rate.', apply: t => { t.ascendBonusRate += 0.03; } },
    { name: 'MELTDOWN',    icon: '★', desc: 'Surges 40% stronger again and ascension 10% cheaper again.', apply: t => { t.surgeMul *= 1.40; t.ascCostMul *= 0.90; } }
  ],
  orin: [
    { name: 'PRE-ASSEMBLED', icon: '◎', desc: 'Every tower starts one level higher.', apply: t => { t.startLevel += 1; } },
    { name: 'SPARE PARTS',   icon: '◈', desc: 'Upgrades cost 10% less.', apply: t => { t.upgradeMul *= 0.90; } },
    { name: 'SIGHTED IN',    icon: '⊙', desc: '+8% range.', apply: t => { t.rng += 0.08; } },
    { name: 'SHOP FLOOR',    icon: '⛁', desc: 'Selling returns 15% more.', apply: t => { t.sellRate += 0.15; } },
    { name: 'FACTORY FRESH', icon: '★', desc: 'Towers start two levels higher.', apply: t => { t.startLevel += 2; } }
  ],
  vess: [
    { name: 'SANDBAGS',    icon: '⛨', desc: 'Leaks cost one fewer life.', apply: t => { t.leakReduce += 1; } },
    { name: 'BUNKER',      icon: '◈', desc: '+6 maximum lives.', apply: (t, s) => { s.maxLives += 6; s.lives += 6; } },
    { name: 'FIELD SURGERY', icon: '◎', desc: 'Recover 1 life every 3 waves.', apply: t => { t.waveHeal += 1 / 3; } },
    { name: 'DIG DEEPER',  icon: '⛰', desc: 'Life recovery 30% more effective.', apply: t => { t.lifeGainMul += 0.30; } },
    { name: 'BACKS TO THE WALL', icon: '★', desc: 'At 5 lives or fewer, +25% damage.', apply: t => { t.lastStandAt = Math.max(t.lastStandAt, 5); t.lastStandDmg += 0.25; } }
  ],
  isa: [
    { name: 'STILLNESS',   icon: '◎', desc: 'Reanimated attackers 12% weaker.', apply: t => { t.reanimResist += 0.12; } },
    { name: 'FORBEARANCE', icon: '⛨', desc: '+4 maximum lives.', apply: (t, s) => { s.maxLives += 4; s.lives += 4; } },
    { name: 'THE VIGIL',   icon: '◈', desc: 'Life recovery 35% more effective.', apply: t => { t.lifeGainMul += 0.35; } },
    { name: 'MERCY',       icon: '⊙', desc: 'Leaks cost one fewer life.', apply: t => { t.leakReduce += 1; } },
    { name: 'THE THIRD DAY', icon: '★', desc: 'Recover 1 life every 2 waves.', apply: t => { t.waveHeal += 0.5; } }
  ],
  seraph: [
    { name: 'FIRST LIGHT',  icon: '☀', desc: '+6% damage and range.', apply: t => { t.dmg += 0.06; t.rng += 0.06; } },
    { name: 'WIDE HALO',    icon: '◎', desc: 'Support auras 20% wider.', apply: t => { t.auraRangeMul *= 1.20; } },
    { name: 'GLARE',        icon: '⊙', desc: '+10% status effect strength.', apply: t => { t.status += 0.10; } },
    { name: 'FULL SUN',     icon: '◈', desc: '+8% damage and range again.', apply: t => { t.dmg += 0.08; t.rng += 0.08; } },
    { name: 'MERIDIAN',     icon: '★', desc: 'Auras 20% wider again and +10% rate.', apply: t => { t.auraRangeMul *= 1.20; t.rate += 0.10; } }
  ],
  aurelia: [
    { name: 'HYMN',         icon: '◎', desc: '+0.2 life regeneration per wave.', apply: t => { t.lifeRegen += 0.2; } },
    { name: 'DESCANT',      icon: '◈', desc: 'Life recovery 30% more effective.', apply: t => { t.lifeGainMul += 0.30; } },
    { name: 'REFUGE',       icon: '⛨', desc: '+5 maximum lives.', apply: (t, s) => { s.maxLives += 5; s.lives += 5; } },
    { name: 'ABSOLUTION',   icon: '⊙', desc: 'Leaks cost one fewer life.', apply: t => { t.leakReduce += 1; } },
    { name: 'EVENSONG',     icon: '★', desc: '+0.3 regeneration per wave and recovery 30% more effective again.', apply: t => { t.lifeRegen += 0.3; t.lifeGainMul += 0.30; } }
  ],
  lumen: [
    { name: 'WARDED',       icon: '⛨', desc: 'Towers resist jamming 30% more.', apply: t => { t.jamResist += 0.30; } },
    { name: 'BRIGHT',       icon: '◎', desc: '+8% range.', apply: t => { t.rng += 0.08; } },
    { name: 'LANCEHEAD',    icon: '⊙', desc: '+10% armour pierce.', apply: t => { t.pierce += 0.10; } },
    { name: 'FLOODLIGHT',   icon: '◈', desc: 'Support auras 20% wider.', apply: t => { t.auraRangeMul *= 1.20; } },
    { name: 'VERDICT',      icon: '★', desc: '+10% pierce again and +8% damage.', apply: t => { t.pierce += 0.10; t.dmg += 0.08; } }
  ],
  cantor: [
    { name: 'SLOW VERSE',   icon: '◎', desc: 'Slows and weakens last 15% longer.', apply: t => { t.status += 0.15; } },
    { name: 'SECOND THOUGHTS', icon: '⊙', desc: 'Slowed enemies take 10% more damage.', apply: t => { t.slowVuln += 0.10; } },
    { name: 'HOMILY',       icon: '◈', desc: 'Damage over time 20% stronger.', apply: t => { t.dotMul += 0.20; } },
    { name: 'LAST WORD',    icon: '⛨', desc: 'Statuses last 15% longer again.', apply: t => { t.status += 0.15; } },
    { name: 'AMEN',         icon: '★', desc: 'Slowed enemies take 15% more damage again.', apply: t => { t.slowVuln += 0.15; } }
  ],
  halder: [
    { name: 'BULWARK',      icon: '⛨', desc: '+8 maximum lives.', apply: (t, s) => { s.maxLives += 8; s.lives += 8; } },
    { name: 'SHIELD WALL',  icon: '◎', desc: 'Leaks cost one fewer life.', apply: t => { t.leakReduce += 1; } },
    { name: 'SECOND WIND',  icon: '◈', desc: 'Life recovery 40% more effective.', apply: t => { t.lifeGainMul += 0.40; } },
    { name: 'STAND FAST',   icon: '⊙', desc: 'At 8 lives or fewer, +20% damage.', apply: t => { t.lastStandAt = Math.max(t.lastStandAt, 8); t.lastStandDmg += 0.20; } },
    { name: 'BEDROCK',      icon: '★', desc: '+8 maximum lives again and +0.25 regeneration per wave.', apply: (t, s) => { s.maxLives += 8; s.lives += 8; t.lifeRegen += 0.25; } }
  ],
  ashtar: [
    { name: 'THE PREAMBLE', icon: '◎', desc: '+5% damage, range and rate.', apply: t => { t.dmg += 0.05; t.rng += 0.05; t.rate += 0.05; } },
    { name: 'THE CORDON',   icon: '⊙', desc: 'Support auras 15% wider.', apply: t => { t.auraRangeMul *= 1.15; } },
    { name: 'THE INNER WALL', icon: '⛨', desc: '+4 maximum lives.', apply: (t, s) => { s.maxLives += 4; s.lives += 4; } },
    { name: 'THE SEAL',     icon: '◈', desc: 'Towers resist jamming 40% more.', apply: t => { t.jamResist += 0.40; } },
    { name: 'THE CHARTER',  icon: '★', desc: '+7% damage, range and rate again.', apply: t => { t.dmg += 0.07; t.rng += 0.07; t.rate += 0.07; } }
  ],
  sevra: [
    { name: 'GRAVE DIRT',   icon: '◐', desc: 'Reanimates +20% health.', apply: t => { t.reanimHp += 0.20; } },
    { name: 'QUICKENING',   icon: '◑', desc: 'Reanimates move 15% faster.', apply: t => { t.reanimSpeed += 0.15; } },
    { name: 'TITHE',        icon: '◈', desc: 'Each reanimate pays ' + sqGold(3) + ' gold.', apply: t => { t.reanimGold += sqGold(3); } },
    { name: 'LEGION',       icon: '⊗', desc: 'Reanimates +25% health again.', apply: t => { t.reanimHp += 0.25; } },
    { name: 'RISEN',        icon: '★', desc: 'Every reanimation sends a second body 20% of the time.', apply: (t, s, m) => { m.doubleReanim += 0.20; } }
  ],
  mawlord: [
    { name: 'APPETITE',     icon: '◎', desc: '+10% kill gold.', apply: t => { t.goldMul += 0.10; } },
    { name: 'SECOND HELPING', icon: '◈', desc: 'Towers gain 1% damage per 15 kills.', apply: t => { t.killRamp += 1 / 15; } },
    { name: 'GIRTH',        icon: '⊙', desc: '+8% splash radius.', apply: t => { t.splash += 0.08; } },
    { name: 'MARROW',       icon: '⛁', desc: '+12% kill gold again.', apply: t => { t.goldMul += 0.12; } },
    { name: 'ALL IS FOOD',  icon: '★', desc: 'Kill ramp 1% per 10 kills, without limit.', apply: t => { t.killRamp += 1 / 10; } }
  ],
  thrax: [
    { name: 'CLUTCH',       icon: '◎', desc: 'Per-copy price growth 12% gentler.', apply: t => { t.costGrowthMul *= 0.88; } },
    { name: 'MANDIBLE',     icon: '⛨', desc: '+6% rate.', apply: t => { t.rate += 0.06; } },
    { name: 'HATCHERY',     icon: '◈', desc: 'The first copy of every tower is free.', apply: t => { t.freeCopies += 1; } },
    { name: 'GANGLION',     icon: '⊙', desc: '+8% rate again.', apply: t => { t.rate += 0.08; } },
    { name: 'THE SWARM',    icon: '★', desc: 'Price growth 12% gentler again and a second free copy.', apply: t => { t.costGrowthMul *= 0.88; t.freeCopies += 1; } }
  ],
  vorn: [
    { name: 'FESTER',       icon: '◎', desc: 'Damage over time 20% stronger.', apply: t => { t.dotMul += 0.20; } },
    { name: 'LINGERING',    icon: '⊙', desc: 'Statuses last 15% longer.', apply: t => { t.status += 0.15; } },
    { name: 'ROT SETS IN',  icon: '◈', desc: 'Slowed enemies take 10% more damage.', apply: t => { t.slowVuln += 0.10; } },
    { name: 'GANGRENE',     icon: '⛁', desc: 'Damage over time 25% stronger again.', apply: t => { t.dotMul += 0.25; } },
    { name: 'PLAGUE YEAR',  icon: '★', desc: 'Statuses 20% longer again and +8% status strength.', apply: t => { t.status += 0.28; } }
  ],
  ulgrim: [
    { name: 'BIG GAME',     icon: '◎', desc: '+15% damage to bosses and minibosses.', apply: t => { t.eliteDamage += 0.15; } },
    { name: 'TROPHY',       icon: '◈', desc: 'Elites pay 30% more bounty.', apply: t => { t.eliteBounty += 0.30; } },
    { name: 'JAWS',         icon: '⊙', desc: '+8% crit chance.', apply: t => { t.crit += 0.08; } },
    { name: 'BONE BREAKER', icon: '⛁', desc: 'Crits deal 25% more.', apply: t => { t.critMult += 0.25; } },
    { name: 'APEX PREDATOR', icon: '★', desc: '+20% elite damage again and elites pay 30% more again.', apply: t => { t.eliteDamage += 0.20; t.eliteBounty += 0.30; } }
  ],
  rake: [
    { name: 'BOOTY',        icon: '◈', desc: '+12% kill gold.', apply: t => { t.goldMul += 0.12; } },
    { name: 'PURSE',        icon: '⛁', desc: 'Begin with ' + sqGold(40) + ' extra gold.', apply: (t, s) => { s.gold += sqGold(40); } },
    { name: 'FENCE',        icon: '◎', desc: 'Selling returns 20% more.', apply: t => { t.sellRate += 0.20; } },
    { name: 'SMUGGLER',     icon: '⊙', desc: 'Banked gold earns 25% more interest.', apply: (t, s, m) => { m.interest *= 1.25; } },
    { name: 'TREASURE FLEET', icon: '★', desc: '+15% kill gold again and ' + sqGold(60) + ' more starting gold.', apply: (t, s) => { t.goldMul += 0.15; s.gold += sqGold(60); } }
  ],
  scarlet: [
    { name: 'RED MIST',     icon: '◎', desc: '+8% damage.', apply: t => { t.dmg += 0.08; } },
    { name: 'OPEN VEIN',    icon: '⊙', desc: '+8% crit chance.', apply: t => { t.crit += 0.08; } },
    { name: 'CLEAVER',      icon: '◈', desc: 'Crits deal 30% more.', apply: t => { t.critMult += 0.30; } },
    { name: 'BLOOD DRUNK',  icon: '⛁', desc: '+10% damage again.', apply: t => { t.dmg += 0.10; } },
    { name: 'CORNERED',     icon: '★', desc: 'At 6 lives or fewer, +30% damage.', apply: t => { t.lastStandAt = Math.max(t.lastStandAt, 6); t.lastStandDmg += 0.30; } }
  ],
  grist: [
    { name: 'SCRAP VALUE',  icon: '◎', desc: 'Selling returns 15% more.', apply: t => { t.sellRate += 0.15; } },
    { name: 'BODGE',        icon: '◈', desc: 'Upgrades cost 12% less.', apply: t => { t.upgradeMul *= 0.88; } },
    { name: 'MAGPIE',       icon: '⛁', desc: 'The Vault skims 30% more gold.', apply: t => { t.vaultBonus *= 1.30; } },
    { name: 'SPARE HULLS',  icon: '⊙', desc: 'Per-copy price growth 10% gentler.', apply: t => { t.costGrowthMul *= 0.90; } },
    { name: 'NOTHING WASTED', icon: '★', desc: 'Selling returns 25% more again.', apply: t => { t.sellRate += 0.25; } }
  ],
  cinder: [
    { name: 'TINDER',       icon: '◎', desc: '+10% splash radius.', apply: t => { t.splash += 0.10; } },
    { name: 'SLOW MATCH',   icon: '⊙', desc: 'Damage over time 20% stronger.', apply: t => { t.dotMul += 0.20; } },
    { name: 'WHITE HEAT',   icon: '◈', desc: '+8% damage.', apply: t => { t.dmg += 0.08; } },
    { name: 'BACKDRAFT',    icon: '⛁', desc: '+12% splash radius again.', apply: t => { t.splash += 0.12; } },
    { name: 'BURN IT ALL',   icon: '★', desc: 'Damage over time 25% stronger again and +10% status.', apply: t => { t.dotMul += 0.25; t.status += 0.10; } }
  ],
  dregg: [
    { name: 'PRESS GANG',   icon: '◎', desc: '+8% damage and rate.', apply: t => { t.dmg += 0.08; t.rate += 0.08; } },
    { name: 'PROTECTION MONEY', icon: '◈', desc: '+10% kill gold.', apply: t => { t.goldMul += 0.10; } },
    { name: 'KNUCKLES',     icon: '⊙', desc: '+8% crit chance.', apply: t => { t.crit += 0.08; } },
    { name: 'REIGN OF FEAR', icon: '⛁', desc: '+10% damage and rate again.', apply: t => { t.dmg += 0.10; t.rate += 0.10; } },
    { name: 'THE THRONE',   icon: '★', desc: 'Every tower starts one level higher and crits deal 20% more.', apply: t => { t.startLevel += 1; t.critMult += 0.20; } }
  ],
  axiom: [
    { name: 'WARM CACHE',   icon: '◎', desc: 'The compile metric counts 25% faster.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'TURBO',        icon: '⊙', desc: '+6% rate.', apply: t => { t.rate += 0.06; } },
    { name: 'PRECOMPILED',  icon: '◈', desc: 'Begin one compile level up.', apply: t => { t.compileFloor += 1; } },
    { name: 'MULTITHREAD',  icon: '⛁', desc: 'The compile metric counts 25% faster again.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'RELEASE BUILD', icon: '★', desc: 'Begin one more compile level up and +6% damage.', apply: t => { t.compileFloor += 1; t.dmg += 0.06; } }
  ],
  nyx_r: [
    { name: 'UNDERVOLT',    icon: '◎', desc: 'Ascension costs 10% less.', apply: t => { t.ascCostMul *= 0.90; } },
    { name: 'BOOST CLOCK',  icon: '⊙', desc: 'Surges are 35% stronger.', apply: t => { t.surgeMul *= 1.35; } },
    { name: 'THERMAL PASTE', icon: '◈', desc: 'The compile metric counts 25% faster.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'BURST MODE',   icon: '⛁', desc: 'Each ascension adds +4% more damage.', apply: t => { t.perAscDamage += 0.04; } },
    { name: 'CRYOGENIC',     icon: '★', desc: 'Surges 35% stronger again and ascension 10% cheaper again.', apply: t => { t.surgeMul *= 1.35; t.ascCostMul *= 0.90; } }
  ],
  lumen_r: [
    { name: 'FIREWALL',     icon: '⛨', desc: 'Towers resist jamming 35% more.', apply: t => { t.jamResist += 0.35; } },
    { name: 'HEARTBEAT',    icon: '◎', desc: 'The compile metric counts 25% faster.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'AIR GAP',      icon: '◈', desc: '+5 maximum lives.', apply: (t, s) => { s.maxLives += 5; s.lives += 5; } },
    { name: 'HARDENED KERNEL', icon: '⊙', desc: 'Jam resistance 35% more again.', apply: t => { t.jamResist += 0.35; } },
    { name: 'ZERO TRUST',   icon: '★', desc: 'Leaks cost one fewer life and +8% range.', apply: t => { t.leakReduce += 1; t.rng += 0.08; } }
  ],
  mawlord_r: [
    { name: 'WARM START',   icon: '◎', desc: 'The compile metric counts 25% faster.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'EPOCH',        icon: '◈', desc: 'Towers gain 1% damage per 15 kills.', apply: t => { t.killRamp += 1 / 15; } },
    { name: 'LABELLED',     icon: '⊙', desc: '+10% kill gold.', apply: t => { t.goldMul += 0.10; } },
    { name: 'MIXED PRECISION', icon: '⛁', desc: 'The compile metric counts 25% faster again.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'CONVERGED',    icon: '★', desc: 'Kill ramp 1% per 10 kills and begin one compile level up.', apply: t => { t.killRamp += 1 / 10; t.compileFloor += 1; } }
  ],
  dregg_r: [
    { name: 'COMPOUNDING',  icon: '◎', desc: 'Banked gold earns 30% more interest.', apply: (t, s, m) => { m.interest *= 1.30; } },
    { name: 'TAX BREAK',    icon: '◈', desc: 'Upgrades cost 10% less.', apply: t => { t.upgradeMul *= 0.90; } },
    { name: 'FAST CLOSE',   icon: '⊙', desc: 'The compile metric counts 25% faster.', apply: t => { t.compileRateMul *= 1.25; } },
    { name: 'DIVIDEND',     icon: '⛁', desc: 'Interest 30% more again.', apply: (t, s, m) => { m.interest *= 1.30; } },
    { name: 'HOSTILE TAKEOVER', icon: '★', desc: 'The Vault skims 40% more gold and +6% damage.', apply: t => { t.vaultBonus *= 1.40; t.dmg += 0.06; } }
  ]
};

/* Stamp both tables onto the roster at load. Idempotent, and it never
   renumbers or reorders a node: ids are what the duel contract carries. */
(function stampCommanderTrees() {
  COMMANDER_ROSTER.forEach(cmd => {
    if (cmd.tech && cmd.tech.length) layoutTechShape(cmd);
    cmd.prestige = COMMANDER_PRESTIGE[cmd.id] || [];
  });
})();
