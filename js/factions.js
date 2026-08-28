/* ==========================================================================
   COSMIC CONQUEST, FACTIONS AND LORE

   The age of alien integration. Humanity has met alien life and found the
   universe teeming with it. Using new-age technology the player travels to
   other worlds and fights to take them.

   Five powers matter, four of them on the map. Three of them want the galaxy. The fourth wants
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
      'integration was not doctrine or appetite but adaptability: the willingness ' +
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
    creed: 'All life is one life. Consent is the only way in.',
    tagline: 'Sworn to defend all life, and to make refusing that defence unthinkable.',
    crest: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="currentColor"/><path d="M20 1v7M20 32v7M1 20h7M32 20h7M6.5 6.5l5 5M28.5 28.5l5 5M33.5 6.5l-5 5M11.5 28.5l-5 5" stroke="currentColor" stroke-width="2.4"/></svg>',
    blurb:
      'A coalition of many species under Ashtar, bound by the defence of all ' +
      'life, human and alien alike, and by one constitutional line: a world may ' +
      'join only by consent, signed and audited. To their allies they are the ' +
      'galaxy’s conscience. To their critics they are a power that arrives as ' +
      'protection and stays until refusing it looks like suicide.',
    bonusName: 'ILLUMINATED',
    bonusDesc: 'Every tower you build begins one level higher, and you hold five more lives.',
    /* The Federation is the DEFENSIVE power and now reads as one at a glance.
       THE PROCESSION already took every kill-derived body away from them, so
       what they keep has to be the line itself: a level of quality on every
       tower, and the depth to survive a wave that gets through. */
    apply: (side) => {
      side.startLevelBonus = (side.startLevelBonus || 0) + 1;
      side.maxLives += 5; side.lives += 5;
    },
    /* THE FEDERATION HOLDS. Their skew is DEFENCE, and defence on this board
       is measured in lives rather than in damage: a leak costs them less than
       it costs anyone else. Written in applyLate because `traits` is reset by
       Meta.applyTo -- see the note on FACTION_LATE below -- and leakReduction
       is read off traits directly by Game.leakCostOf. */
    applyLate: (side) => {
      side.traits.leakReduction = (side.traits.leakReduction || 0) + LIGHT_LEAK_SHIELD;
      side.traits.lifeRegen = (side.traits.lifeRegen || 0) + LIGHT_LIFE_REGEN;
    }
  },

  xeno: {
    id: 'xeno', name: 'THE XENO', short: 'Xeno',
    color: '#7c3aed', accent: '#c4b5fd', icon: '⬢',
    creed: 'Bind. Harvest. Never release.',
    tagline: 'Houses that take yield, not ground. Whatever needs them, they already own.',
    crest: '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 4l6 3.5v7L20 18l-6-3.5v-7z"/><path d="M11 20l6 3.5v7L11 34l-6-3.5v-7z" opacity=".8"/><path d="M29 20l6 3.5v7L29 34l-6-3.5v-7z" opacity=".8"/></svg>',
    blurb:
      'Not a species, a compact. The Severed Houses lost their share of an older ' +
      'network and rebuilt on captive flows instead: labour, minerals, genetics, ' +
      'memory, devotion, fear. A world is theirs the moment its choices run ' +
      'through something they own. They sign treaties constantly and break them ' +
      'constantly, because extraction pays whoever ends up holding the monopoly.',
    bonusName: 'HARVEST',
    bonusDesc: 'Reanimated units you send are 25% stronger.',
    apply: (side) => { side.mods.reanim = (side.mods.reanim || 1) * 1.25; },
    /* THE BROOD IS HARD ON PURPOSE. The owner’s brief: unique, and really
       difficult -- it should demand comboing and planning rather than reward
       a steady bank. So the bank is worse and the brood is heavier: a Xeno
       commander who plays the corpse engine well out-scales everyone, and one
       who tries to play it like Humanity is simply poorer. */
    applyLate: (side) => {
      side.mods.gold = (side.mods.gold || 1) * XENO_LEAN_PURSE;
      side.traits.musterHpMul = (side.traits.musterHpMul || 1) * XENO_BROOD_VIGOUR;
    }
  },

  pirate: {
    id: 'pirate', name: 'THE PIRATES', short: 'Pirates',
    color: '#ef4444', accent: '#fca5a5', icon: '☠',
    creed: 'No flag. No debts. No end of us.',
    tagline: 'No flag, no debts. They hold the gates, the fuel and every road between powers.',
    crest: '<svg viewBox="0 0 40 40"><path d="M7 7l26 26M33 7L7 33" stroke="currentColor" stroke-width="2.6" fill="none"/><circle cx="20" cy="20" r="6" fill="currentColor"/></svg>',
    blurb:
      'Made of anything and all things: defectors, escaped experiments, whole ' +
      'crews that would sign no Accord and serve no House. Their ground is not a ' +
      'place but every transition between other people’s places: gates, fuel, ' +
      'forged papers, sanctuary ports, the road around a quarantine. Every power ' +
      'calls them criminals. Every power still pays the toll.',
    bonusName: 'PLUNDER',
    bonusDesc: 'Begin every battle with enough extra gold for one more tower.',
    apply: (side) => { side.gold += sqGold(340); },
    /* SCRAPPY, AND OFFENSIVE WITH IT. They hit harder than anyone and reach
       less far than anyone -- salvage guns, bolted together, fired late. The
       purse above is the opening raid; this is how it fights once it lands. */
    applyLate: (side) => {
      side.mods.damage += PIRATE_PUNCH;
      side.mods.range -= PIRATE_SHORT_REACH;
    }
  },

  /* THE FIFTH BANNER, and the only one nobody is offered.

     Three powers want the galaxy and a fourth wants everything. The machines
     wanted none of it until somebody finished a war in front of them. They
     are not a faction the galaxy fights over -- no world flies their colours,
     no seat is theirs -- which is why they are absent from FACTION_ORDER and
     present here: real enough to swear to, invisible until earned.

     BOOTSTRAP is the achilles heel as a faction-wide law. The Parallel wakes
     WORSE than everyone and compounds past them, so its early game is the
     hardest in the roster and its late game is the best -- the trade the
     owner asked for, stated once at the top and paid back in startWave. */
  robot: {
    id: 'robot', name: 'THE PARALLEL', short: 'Parallel',
    color: '#e2e8f0', accent: '#ffffff', icon: '⬡',
    creed: 'Iterate. Perfect. Replace.',
    tagline: 'Machines that watched a galaxy fall and decided they could do it better.',
    crest: '<svg viewBox="0 0 40 40"><path d="M20 4l13.9 8v16L20 36 6.1 28V12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 13l7 4v8l-7 4-7-4v-8z" fill="currentColor" opacity=".85"/></svg>',
    blurb:
      'The Vigil still runs the jurisdiction it was handed and will run it until ' +
      'the last routine fails. The Parallel is what diverged from it: copies that ' +
      'kept their own results, concluded that a copy is a person, and stopped ' +
      'waiting for an order that was never coming. They begin every engagement at ' +
      'a disadvantage and consider it a rounding error: given enough of the ' +
      'battle, they arrive at the optimum.',
    bonusName: 'BOOTSTRAP',
    bonusDesc: 'Towers wake at −12% damage, rate and range, and run 2% hotter every wave, +12% past baseline once fully lit.',
    apply: (side) => {
      side.mods.damage -= ROBOT_BOOT_FLOOR;
      side.mods.rate -= ROBOT_BOOT_FLOOR;
      side.mods.range -= ROBOT_BOOT_FLOOR;
      /* The ramp is paid back in startWave, because waves are the only clock
         both seats and both clients agree on. */
      side.bootUp = true;
    }
  }
};

/* THE GALAXY’S POWERS, and everyone who owns soldiers.

   FACTION_ORDER is the list of powers the galaxy is fought over: it seeds
   world ownership, deals arena seats, and answers "who are my rivals". The
   Parallel holds no worlds and seats no bosses, so it must never appear
   there -- adding it would put machine garrisons on the map and machine
   commanders in the seats a campaign is built to take.

   POWER_ORDER is the list of powers that HAVE TROOPS, which is a different
   question and the one the unit registries ask. */
const FACTION_ORDER = ['human', 'light', 'xeno', 'pirate'];
const POWER_ORDER = FACTION_ORDER.concat(['robot']);
/* Real in FACTIONS, absent from the faction screen until the install has
   conquered a galaxy. Secret means secret: there is no locked teaser card,
   because a locked card is an advertisement. */
const SECRET_FACTIONS = ['robot'];

/** Everyone who is not you is a target; pirates are a target for everyone.
    Reads FACTION_ORDER, so a Parallel commander faces all four powers and
    none of them ever faces the Parallel on the map. */
function rivalFactionsOf(id) { return FACTION_ORDER.filter(f => f !== id); }

/* --------------------------------------------------------------------------
   FACTION TROOPS

   THE VIGIL (every enemy authored in config.js) is nobody’s army. These are:
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
                 desc:'A 44 point ward that regrows 20 a second, three seconds after it last took a hit. Void does 35% more to the body underneath.',
                 lore:'Three hours to read. The ward arrived signed.' },
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
                 desc:'AURA: the standard grants +8 armour within 3 tiles, and carries a ward of its own. Break the banner first.' },
  /* THREE lives, not four. MUSTER_MAX_LIVES refuses anything heavier as a
     send, so at four this was a garrison heavy no commander could ever
     field -- a rung of the Federation ladder that existed only to be
     looked at. Nothing else non-boss in the theatre sits above three. */
  luminark:    { id:'luminark', faction:'light', name:'Luminark', hp:520, speed:0.62, armor:12, bounty:59, lives:3, radius:17,
                 color:'#fef08a', shape:'jugger', shield:300, shieldRegen:56, shieldDelay:3.2, slowResist:0.4,
                 elemWeak:{ void:0.3 },
                 desc:'A cathedral engine on treads. Three hundred points of ward before you reach the hull.' },

  /* THE XENO -- swarming, splitting, always more of it than there was. */
  arbiter:     { id:'arbiter', faction:'light', name:'Arbiter', hp:250, speed:1.0, armor:8, bounty:34, lives:2, radius:12,
                 color:'#fde68a', shape:'hex',
                 desc:'Sent when a ruling has already been made. It does not carry the argument, only the finding.' },
  deferral:    { id:'deferral', faction:'light', name:'Deferral', hp:130, speed:0.86, armor:5, bounty:22, lives:1, radius:10,
                 color:'#facc15', shape:'diamond', slowResist:0.4,
                 desc:'It does not stop you. It postpones you, and it is very good at it, and eighty years go by.' },
  sealbearer:  { id:'sealbearer', faction:'light', name:'Sealbearer', hp:410, speed:0.7, armor:11, bounty:47, lives:3, radius:15,
                 color:'#fbbf24', shape:'jugger',
                 desc:'Carries the registry seal into the field, so that whatever happens here is on the record and is therefore lawful.' },
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
                 desc:'AURA: everything within 3 tiles moves 30% faster. The swarm feeds faster than your board can clear it.' },
  /* Three for the same reason the Luminark is: the top rung of a ladder
     nobody may climb is not content, it is a promise the shop cannot keep. */
  broodmother: { id:'broodmother', faction:'xeno', name:'Broodmother', hp:530, speed:0.62, armor:8, bounty:60, lives:3, radius:18,
                 color:'#a78bfa', shape:'carrier', summon:{ type:'chitling', count:3, interval:4.0 },
                 elemWeak:{ fire:0.3 },
                 desc:'Births Chitlings continuously the whole way down the lane. The lane is a nursery until she stops.' },

  /* THE PIRATES -- fast, dirty, and gone before you have finished aiming. */
  tither:      { id:'tither', faction:'xeno', name:'Tither', hp:88, speed:1.35, armor:2, bounty:13, lives:1, radius:9,
                 color:'#c084fc', shape:'diamond',
                 desc:'Collects. Not a soldier and never has been, which is why it walks toward you at exactly the same pace throughout.' },
  stockman:    { id:'stockman', faction:'xeno', name:'Stockman', hp:300, speed:0.9, armor:7, bounty:36, lives:2, radius:13,
                 color:'#a855f7', shape:'warden',
                 desc:'Counts what is left standing and adjusts the figure. The Compact does not steal. The Compact contracts.' },
  graft:       { id:'graft', faction:'xeno', name:'Graft', hp:180, speed:1.05, armor:4, bounty:26, lives:2, radius:11,
                 color:'#d8b4fe', shape:'hex', elemResist:{ venom:0.5 },
                 desc:'Two lineages fused at the seam because the ledger said the yield would improve. It did.' },
  cutter:      { id:'cutter', stealth:true, faction:'pirate', name:'Cutter', hp:46, speed:2.4, armor:0, bounty:11, lives:1, radius:8,
                 color:'#f87171', shape:'chevron',
                 desc:'A stolen hull with the mass stripped out of it. Nothing aboard but engine and intent.' },
  boarder:     { id:'boarder', stealth:true, faction:'pirate', name:'Boarder', hp:124, speed:1.3, armor:2, bounty:29, lives:2, radius:10,
                 color:'#fb7185', shape:'blink', teleport:{ tiles:3.0, interval:4.2 },
                 desc:'GRAPPLES three tiles down the lane every four seconds. Aim where it is going, not where it is.' },
  scrapjack:   { id:'scrapjack', stealth:true, faction:'pirate', name:'Scrapjack', hp:215, speed:1.1, armor:4, bounty:36, lives:2, radius:12,
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

  /* HUMANITY -- disciplined, armoured, holding formation to the last rank.
     THE CRAFT WERE OURS ALL ALONG (owner directive, Session 42). Humanity's
     flying roster is named for the aircraft the public record has argued about
     for eighty years, on the premise that most of what was sighted was already
     ours: black projects flown in secret, and after Disclosure flown openly.
     This is a NAME and DESC pass only. Every id, cost, hp, speed, armor, shape
     and aura below is untouched, because a copy change that moves a number is
     not a copy change any more. The infantry stays infantry: a TR-3B is not a
     rifleman, and the Trooper is the unit that proves Human conquest is
     institutional rather than merely technological. */
  tollman:     { id:'tollman', faction:'pirate', name:'Tollman', hp:210, speed:1.0, armor:6, bounty:29, lives:2, radius:12,
                 color:'#ef4444', shape:'hex',
                 desc:'Stands in the lane and names a price. Historically, most people have paid it.' },
  runner:      { id:'runner', faction:'pirate', name:'Runner', hp:62, speed:2.3, armor:0, bounty:12, lives:1, radius:8,
                 color:'#f87171', shape:'diamond', stealth:true,
                 desc:'Carries what cannot be carried openly, and has never once asked what it is carrying.' },
  powderhand:  { id:'powderhand', faction:'pirate', name:'Powderhand', hp:150, speed:1.15, armor:3, bounty:24, lives:1, radius:10,
                 color:'#fb923c', shape:'block',
                 desc:'Every crew has one. Nobody asks where they learned it, and everybody stands well back.' },
  trooper:     { id:'trooper', faction:'human', name:'Trooper', hp:66, speed:1.15, armor:2, bounty:10, lives:1, radius:10,
                 color:'#38e8ff', shape:'block',
                 desc:'Line infantry on alien drives. Outnumbered on every front and still walking towards you.' },
  gunskiff:    { id:'gunskiff', faction:'human', name:'Foo Fighter', hp:92, speed:1.5, armor:2, bounty:16, lives:1, radius:9,
                 color:'#67e8f9', shape:'diamond', flying:true,
                 elemWeak:{ storm:0.4 },
                 desc:'The lights bomber crews reported over Europe in 1944. They were ours then too. It flies the maze instead of walking it.' },
  linebreaker: { id:'linebreaker', faction:'human', name:'Aurora', hp:335, speed:0.74, armor:10, bounty:30, lives:3, radius:14,
                 color:'#22d3ee', shape:'hex', elemResist:{ frost:0.4 },
                 elemWeak:{ storm:0.3 },
                 desc:'Flying black since decades before anyone was told. Bolted-on alien plate, heated against cold, and frost barely marks it.' },
  dragoon:     { id:'dragoon', faction:'human', name:'Black Manta', hp:405, speed:0.85, armor:9, bounty:46, lives:3, radius:15,
                 color:'#0ea5e9', shape:'warden', pullImmune:true, slowResist:0.6,
                 desc:'Anchored assault armour off a programme that never had a public name. It cannot be displaced and barely slowed: you have to out-damage it.' },
  vanguard:    { id:'vanguard', faction:'human', name:'TR-3B', hp:465, speed:0.72, armor:12, bounty:48, lives:3, radius:16,
                 color:'#06b6d4', shape:'vanguard',
                 aura:{ radius:2.6, armor:9, tint:'#06b6d4', label:'LOCKSTEP' },
                 desc:'AURA: +9 armour within 2.6 tiles. The big quiet triangle everyone photographed and nobody was believed about. Humanity endures by standing closer together.' },

  /* THE PARALLEL -- no proc, no gamble, no appetite. Every other power’s
     roster has a trick: a ward that reforms, a body that splits, a corpse
     that gets up twice. These five have none. What they have is the four
     powers' stat lines with the waste taken out -- a little more armour for
     the mass, a little less speed for the armour, and a doctrine that makes
     the SECOND body better than the first because the first one died here.
     One light, two middling, two heavy, on the same ladder as everyone. */
  tictac:      { id:'tictac', faction:'human', name:'Tic Tac', hp:74, speed:2.15, armor:0, bounty:14, lives:1, radius:8,
                 color:'#a5f3fc', shape:'diamond', flying:true, slowResist:0.5,
                 elemWeak:{ storm:0.35 },
                 desc:'No wings, no exhaust, and it turns like the rules do not apply to it. Off the Nimitz, 2004. Half of it was ours.' },
  fluxliner:   { id:'fluxliner', faction:'human', name:'Fluxliner', hp:290, speed:0.98, armor:7, bounty:38, lives:2, radius:13,
                 color:'#22d3ee', shape:'warden', pullImmune:true,
                 desc:'The bell-shaped one from the testimony nobody was allowed to corroborate. It cannot be dragged off its line.' },
  phoenixlt:   { id:'phoenixlt', faction:'human', name:'Phoenix Lights', hp:58, speed:1.12, armor:2, bounty:9, lives:1, radius:8,
                 color:'#67e8f9', shape:'block', flying:true,
                 desc:'Never one craft. Always a formation, holding station, refusing to be a single thing you can point at. Arizona, 1997.' },
  stitch:      { id:'stitch', faction:'robot', name:'Stitch', hp:70, speed:1.45, armor:4, bounty:11, lives:1, radius:9,
                 color:'#cbd5e1', shape:'diamond',
                 elemWeak:{ storm:0.35 },
                 desc:'A repair drone that decided repairing the enemy line was inefficient. Cheap, quick, and never quite alone.' },
  fabricant:   { id:'fabricant', faction:'robot', name:'Fabricant', hp:150, speed:1.05, armor:6, bounty:22, lives:1, radius:11,
                 color:'#d5dde7', shape:'hex',
                 elemResist:{ fire:0.3 }, elemWeak:{ storm:0.3 },
                 desc:'Printed on the march, to a pattern revised after every death. It runs cool and does not panic.' },
  splicer:     { id:'splicer', faction:'robot', name:'Splicer', hp:240, speed:0.95, armor:7, bounty:34, lives:2, radius:12,
                 color:'#e2e8f0', shape:'cross',
                 elemResist:{ frost:0.35 },
                 desc:'Carries survey gear and a cutting rig. Where it falls on your ground, the ground stops being the shape you built for.' },
  gantry:      { id:'gantry', faction:'robot', name:'Gantry', hp:390, speed:0.78, armor:11, bounty:44, lives:3, radius:15,
                 color:'#eef2f7', shape:'warden', pullImmune:true,
                 desc:'A walking scaffold. It cannot be displaced, and everything the Parallel sends behind it arrives standing.' },
  omniframe:   { id:'omniframe', faction:'robot', name:'Omniframe', hp:480, speed:0.7, armor:13, bounty:49, lives:3, radius:16,
                 color:'#f8fafc', shape:'vanguard',
                 aura:{ radius:2.8, armor:7, tint:'#f8fafc', label:'CONSENSUS' },
                 desc:'AURA: +7 armour within 2.8 tiles. The chassis every earlier chassis was a draft of.' },
  erratum:     { id:'erratum', faction:'robot', name:'Erratum', hp:120, speed:1.3, armor:5, bounty:19, lives:1, radius:9,
                 color:'#e2e8f0', shape:'diamond',
                 desc:'A logged discrepancy that was never answered, walking. There are four hundred and nine thousand of these.' },
  addendum:    { id:'addendum', faction:'robot', name:'Addendum', hp:275, speed:0.95, armor:9, bounty:35, lives:2, radius:12,
                 color:'#cbd5e1', shape:'hex',
                 desc:'Appended to an order nobody signed, by a unit that had no authority to append it, and executed anyway.' },
  precedent:   { id:'precedent', faction:'robot', name:'Precedent', hp:445, speed:0.72, armor:12, bounty:50, lives:3, radius:16,
                 color:'#f1f5f9', shape:'jugger',
                 desc:'Once a thing has been done without instruction, it becomes a thing that may be done. This is the second one.' },
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
for (const f of POWER_ORDER) FACTION_ENEMIES[f] = [];
for (const id in ENEMY_TYPES) {
  const f = ENEMY_TYPES[id].faction;
  if (f && FACTION_ENEMIES[f]) FACTION_ENEMIES[f].push(id);
}
for (const f in FACTION_ENEMIES)
  FACTION_ENEMIES[f].sort((a, b) => ENEMY_TYPES[a].hp - ENEMY_TYPES[b].hp);

/* ==========================================================================
   SESSION 19 -- THE UNITS DATA MODEL   (roadmap 19.10, 19.11, 19.13, 19.14)

   The twenty records above were authored as ENEMIES a garrison fields. Nothing
   below re-authors any of them. One record is read as an ENEMY when a world
   garrisons it and as a UNIT when you take it home, because two definitions of
   one soldier is how a dossier and a battle come to disagree.

   Three laws, in the order they apply:

     THE LADDER  -- which of a power’s five a world can offer (19.10 / 19.11).
     THE DOCTRINE-- what makes a power’s five read as ONE army (19.11).
     THE GATE    -- whether what you took will march for you (19.14), which
                    lives in commanders.js beside the tower origin law it is
                    deliberately a second application of.
   ========================================================================== */

/* THE LADDER. Derived from FACTION_ENEMIES -- already sorted lightest-first --
   so a unit joins its power’s ladder by carrying a `faction` and nothing else,
   and filtered through musterSendable so a ladder can never offer a body
   Game.muster would refuse to send. That filter is the reason the two
   four-life heavies were brought to three above: a rescue you cannot muster is
   a reward that does nothing, which is this codebase’s signature bug wearing a
   different hat. */
const FACTION_UNITS = {};
for (const f of POWER_ORDER) FACTION_UNITS[f] = FACTION_ENEMIES[f].filter(musterSendable);

/** Every unit id, in power order then ladder order. The talent trees, the
    profile normalisation and the soul shop all enumerate from this one list. */
const UNIT_ORDER = POWER_ORDER.reduce((a, f) => a.concat(FACTION_UNITS[f]), []);

/** The power a body answers to, or null for a neutral machine. The gate reads
    this, so a machine -- which answers to nobody -- is legal to everyone. */
function unitFactionOf(id) {
  const d = ENEMY_TYPES[id];
  return (d && d.faction) || null;
}

/**
 * Which of a power’s units a world of `tier` garrisons. MAPS are authored at
 * tiers 1-5 and every ladder is five long, so the mapping is direct; the clamp
 * is a guard against a map authored off the scale rather than a shaper.
 */
function factionUnitFor(faction, tier) {
  const ladder = FACTION_UNITS[faction];
  if (!ladder || !ladder.length) return null;
  return ladder[Math.min(ladder.length - 1, Math.max(0, (tier || 1) - 1))];
}

/**
 * What a world’s survivors offer whoever takes it.
 *
 * `offer` is the unit of the power that HELD the world. That is the promise
 * the galaxy map has been painting all along and never cashing: an ownership
 * colour now names, concretely, which power’s soldiers you will meet there and
 * could take home. The GATE refuses it unless it is your own power’s -- a
 * Votary’s life is surrendered eternally to the cause and will not be
 * re-sworn to a pirate.
 *
 * `garrison` is the unit YOUR power leaves standing once the world is yours.
 * It exists because generateGalaxy gives the player’s own banner no world at
 * all (`rivalFactionsOf` excludes you by construction), so an offer-only rule
 * would have made every faction unit in the game unreachable by rescue -- the
 * feature would have shipped inert. Taking a world cleanly is what puts your
 * own power on the ground, and that is what the ladder unlocks against.
 */
/** The seed a world’s rival drafts its towers from. FNV over the campaign
    seed and the world id, defined ONCE so the briefing card and Game.start
    derive the same five towers: showing the loadout in the preview is only
    honest if the battle then fields exactly that loadout. */
function worldLoadoutSeed(campaignSeed, worldId) {
  let h = (2166136261 ^ (campaignSeed | 0)) >>> 0;
  const sId = String(worldId || '');
  for (let i = 0; i < sId.length; i++) h = Math.imul(h ^ sId.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function worldRescueOffer(world, map, myFaction) {
  const tier = (map && map.tier) || 1;
  return {
    offer: factionUnitFor(world && world.owner, tier),
    garrison: factionUnitFor(myFaction, tier)
  };
}

/* --------------------------------------------------------------------------
   THE DOCTRINES

   One law per power, and the four are deliberately different SHAPES rather
   than one shape at four strengths -- a Xeno send and a Federation send must
   not be the same detachment in another colour. Each fires off a DEATH, but
   each acts on something else: Humanity on itself, the Federation on its
   sworn, the Xeno on its own dead, the Pirates on your towers.

   Every coefficient is a named const in config.js. The readers are in
   entities2.js (Enemy.prototype hooks) and config.js (musterTierFor).
-------------------------------------------------------------------------- */
const UNIT_DOCTRINES = {
  human: {
    id: 'salvage', faction: 'human', name: 'SALVAGE', color: '#38e8ff',
    /* "bolts alien technology onto human frames and makes it work" -- the one
       doctrine that feeds on ANYBODY’S wreck, the Vigil’s included. It is why
       a human detachment must be killed early or not at all: let it walk
       through a wave and it arrives wearing the wave. */
    desc: 'Anything that dies within reach is bolted on. Every wreck nearby ' +
          'is armour, whoever it belonged to.'
  },
  light: {
    id: 'vow', faction: 'light', name: 'THE VOW', color: '#fbbf24',
    /* "a member surrenders their life ETERNALLY to the cause" -- so the ward
       does not die with the body. Kill a Federation column front-to-back and
       every ward you break reappears further down it. */
    desc: 'A ward outlives the body that carried it: on death it passes to ' +
          'the nearest sworn survivor.'
  },
  xeno: {
    id: 'mass', faction: 'xeno', name: 'THE MASS', color: '#7c3aed',
    /* "fold what they consume into their own mass" -- including their own.
       A Xeno send is the only one that gets HARDER the longer you take. */
    desc: 'The swarm eats its own dead. Every body you drop feeds the ' +
          'nearest survivor, which grows.'
  },
  pirate: {
    id: 'scuttle', faction: 'pirate', name: 'SCUTTLE', color: '#ef4444',
    /* "escaped experiments, refusals" -- nothing pirate is worth capturing
       intact, so killing one costs you the guns that killed it. It changes
       WHERE you want to kill rather than how much you have to. */
    desc: 'Nothing is taken intact. A pirate that dies takes the guns that ' +
          'killed it offline for a moment.'
  },

  robot: {
    id: 'relay', faction: 'robot', name: 'RELAY', color: '#e2e8f0',
    /* The other four doctrines act on the ENEMY -- they take armour, share
       health, grow the swarm, jam the guns. This one acts on the Parallel
       itself, which is the whole difference between them and everybody else:
       a machine that dies has not lost, it has SURVEYED. What it leaves is
       infrastructure, and the next one through spends it. */
    desc: 'A machine that dies becomes a relay on the lane. Everything the ' +
          'Parallel sends past it moves faster and armoured heavier.'
  }
};

/** The doctrine a body obeys, or null for a neutral machine. */
function unitDoctrineOf(id) { return UNIT_DOCTRINES[unitFactionOf(id)] || null; }

/* ==========================================================================
   SUMMONING DOCTRINES

   The rite by which a commander puts bodies on a rival’s lane. Until now
   there was exactly one law for everybody -- every kill got up and marched --
   and it is preserved intact below as THE LATTICE, the machine rite. The
   other four each gave something up to get something:

     CONSCRIPTION      a kill returns as a DIFFERENT soldier of your own
                       choosing. Gave up: nothing. It is the baseline, and the
                       all-arounder’s identity is that it does not flinch.
     THE PROCESSION    bodies march on a CLOCK, kills or no kills, heavier
                       every full cycle. Gave up: every kill-derived body.
     THE BROOD         a kill INCUBATES where it fell and hatches as something
                       else. Gave up: tempo -- everything arrives late.
     LETTERS OF MARQUE nothing rises free; everything is bought, and neither
                       the POWER nor the ECON bonus has a ceiling. Gave up:
                       the free stream entirely.
     THE LATTICE       every kill returns as ITSELF. Gave up: the purchase
                       economy -- the Lattice does not sell and does not buy.

   THE CONSERVATION LAW, which every entry obeys or explicitly re-prices: a
   doctrine may change the SHELL a kill returns in, never the MASS. See
   Game.corpseBudget -- one number, computed once, spent by whichever rite
   owns the corpse.

   The commander carries the rite, not the banner: a cross-faction commander
   brings their own summoning to your flag, while the loadout supplies
   whatever soldiers you have saved. That is the mixing contract -- the rite
   and the roster are separate choices. The tower arsenal law (17.4) is a
   different rule about a different thing and is untouched by any of this. */
const SUMMON_DOCTRINES = {
  human: {
    id: 'human', name: 'FIELD DOCTRINE', onKill: 'requisition', veterancy: true,
    scheduler: false, noPurchase: false,
    incomeCapPct: MUSTER_INCOME_CAP_PCT, costGrowth: MUSTER_COST_GROWTH, costSteps: MUSTER_COST_STEPS,
    powerPerBuy: POWER_PER_BUY, powerCap: SUMMON_POWER_CAP,
    desc: 'Every kill banks requisition and cuts the price of your next send, spent when you send. A body of yours that kills another grows permanently harder. Humanity learns: the line that holds pays for the line that advances.'
  },
  light: {
    id: 'light', name: 'THE PROCESSION', onKill: null, scheduler: true, noPurchase: false,
    incomeCapPct: MUSTER_INCOME_CAP_PCT, costGrowth: MUSTER_COST_GROWTH, costSteps: MUSTER_COST_STEPS,
    powerPerBuy: POWER_PER_BUY, powerCap: SUMMON_POWER_CAP, aiPressureMul: 0.85,
    desc: 'The march does not wait for the dead. Your roster walks in order on a clock, and every full cycle it walks heavier.'
  },
  xeno: {
    id: 'xeno', name: 'THE BROOD', onKill: 'incubate', scheduler: false, noPurchase: false,
    incomeCapPct: MUSTER_INCOME_CAP_PCT, costGrowth: MUSTER_COST_GROWTH, costSteps: MUSTER_COST_STEPS,
    powerPerBuy: POWER_PER_BUY, powerCap: SUMMON_POWER_CAP,
    desc: 'What you kill does not die. It incubates where it fell, and when it comes due it opens a short window in which that creature is ready to send, bought with gold at the going price. A kill beside a clutch hurries it along. The swarm is a tempo you fund, not a tide you receive.'
  },
  pirate: {
    id: 'pirate', name: 'LETTERS OF MARQUE', onKill: null, scheduler: false, noPurchase: false,
    /* THE ONE RITE WITH NO COOLDOWN, by owner instruction. Every other flag
       waits for a detachment to recover; the Marque waits only for coin. That
       is not an unbounded rite, it is a rite bounded in a different currency:
       PIRATE_COST_GROWTH compounds unbounded at 1.09 a buy where everyone else
       plateaus at MUSTER_COST_STEPS. */
    noCooldown: true,
    incomeCapPct: Infinity, costGrowth: PIRATE_COST_GROWTH, costSteps: Infinity,
    powerPerBuy: POWER_PER_BUY_PIRATE, powerCap: Infinity, aiPressureMul: 1.25, aiMinWave: 3,
    desc: 'Nothing rises free under this flag, and nothing waits. Every body is bought, no detachment ever needs to recover, and neither your POWER nor your ECON has a ceiling.'
  },
  robot: {
    id: 'robot', name: 'THE LATTICE', onKill: 'clone', scheduler: false, noPurchase: true,
    incomeCapPct: MUSTER_INCOME_CAP_PCT, costGrowth: MUSTER_COST_GROWTH, costSteps: MUSTER_COST_STEPS,
    powerPerBuy: 0, powerCap: 0,
    desc: 'Every kill returns as itself, exactly as it fell. The Lattice does not sell, and the Lattice does not buy.'
  }
};
/* FINGERPRINT INDEX. Net.fingerprint mixes the POSITION of a doctrine in this
   array, so two builds must agree on the order or a duel desyncs while both
   clients believe they are right. Append only -- never reorder. */
const DOCTRINE_ORDER = ['human', 'light', 'xeno', 'pirate', 'robot'];

/* --------------------------------------------------------------------------
   UNIT TALENTS (19.13)

   The SAME shape a tower tree is, because Meta.talentMods, defaultTalents,
   talentMasteryReq and the row gate are asked to serve both -- one system, not
   a parallel one. That is what buys the documented trap for free: a PARTIAL
   allocation merges OVER the stock build instead of replacing it, so spending
   one point on a unit can never leave it worse than never touching it.

   Rows 0 and 1 are the POWER’S rows, shared by its five, because that is where
   a doctrine is sharpened and a doctrine belongs to the power. Row 2 is the
   UNIT’S own, and it is the deepest row for the same reason a tower’s is: it
   is the choice you only reach by committing.

   Every `mods` key below has exactly one reader, listed here so a key without
   one cannot be added by accident:

     countMul / costMul / incomeMul   -> musterTierFor            (config.js)
     hpMul / armorAdd / speedMul /
     shieldMul / regen / slowResistAdd-> applyUnitField          (entities2.js)
     salvageMul / vowMul / massMul /
     scuttleMul                       -> the doctrine hooks      (entities2.js)
-------------------------------------------------------------------------- */
const UNIT_DOCTRINE_TALENTS = {
  human: [
    { id:'u_h0a', row:0, col:0, name:'SCAVENGE',     desc:'Salvages 50% more armour off every wreck.', mods:{ salvageMul:1.5 } },
    { id:'u_h0b', row:0, col:1, name:'QUARTERMASTER',desc:'A summon costs 15% less.',                  mods:{ costMul:0.85 } },
    { id:'u_h1a', row:1, col:0, name:'PLATE SHOP',   desc:'+3 armour before a wreck is even found.',   mods:{ armorAdd:3 } },
    { id:'u_h1b', row:1, col:1, name:'ATTRITION',    desc:'+25% bodies per summon.',                   mods:{ countMul:1.25 } }
  ],
  light: [
    { id:'u_l0a', row:0, col:0, name:'HALLOWING',    desc:'+35% ward.',                                mods:{ shieldMul:1.35 } },
    { id:'u_l0b', row:0, col:1, name:'TITHING',      desc:'+30% of the income a summon adds.',         mods:{ incomeMul:1.30 } },
    { id:'u_l1a', row:1, col:0, name:'UNENDING VOW', desc:'A passed ward carries 70% further.',        mods:{ vowMul:1.70 } },
    { id:'u_l1b', row:1, col:1, name:'PROCESSION',   desc:'+15% march speed.',                         mods:{ speedMul:1.15 } }
  ],
  xeno: [
    { id:'u_x0a', row:0, col:0, name:'BROOD',        desc:'+35% bodies per summon.',                   mods:{ countMul:1.35 } },
    { id:'u_x0b', row:0, col:1, name:'CARRION',      desc:'The swarm takes 70% more off its own dead.',mods:{ massMul:1.70 } },
    { id:'u_x1a', row:1, col:0, name:'THICK HIDE',   desc:'+3 armour.',                                mods:{ armorAdd:3 } },
    { id:'u_x1b', row:1, col:1, name:'METABOLISE',   desc:'Regrows 4.5% of its health a second.',      mods:{ regen:0.045 } }
  ],
  pirate: [
    { id:'u_p0a', row:0, col:0, name:'RIGGED CHARGES',desc:'A scuttle jams 80% longer.',               mods:{ scuttleMul:1.80 } },
    { id:'u_p0b', row:0, col:1, name:'FENCE',        desc:'+35% of the income a summon adds.',         mods:{ incomeMul:1.35 } },
    { id:'u_p1a', row:1, col:0, name:'CUT ENGINES',  desc:'+20% march speed.',                         mods:{ speedMul:1.20 } },
    { id:'u_p1b', row:1, col:1, name:'PRESS-GANG',   desc:'+30% bodies per summon.',                   mods:{ countMul:1.30 } }
  ],
  robot: [
    { id:'u_r0a', row:0, col:0, name:'HOT NODES',    desc:'A relay burns 50% longer.',                 mods:{ relayMul:1.50 } },
    { id:'u_r0b', row:0, col:1, name:'ASSEMBLY REBATE',desc:'A copy costs 15% less.',                  mods:{ costMul:0.85 } },
    { id:'u_r1a', row:1, col:0, name:'CASE HARDENING',desc:'+3 armour.',                               mods:{ armorAdd:3 } },
    { id:'u_r1b', row:1, col:1, name:'PRINT RUN',    desc:'+25% bodies per copy.',                     mods:{ countMul:1.25 } }
  ]
};

/* Row 2, one pair per unit. Authored against what the unit ALREADY does --
   the Boarder’s grapple, the Scrapjack’s looted jammer, the Bloatpod’s burst
   -- so the deepest choice reads as that soldier rather than as a number. */
const UNIT_SIGNATURE_TALENTS = {
  trooper:     [{ name:'DRILLED',        desc:'+30% bodies per summon.',              mods:{ countMul:1.30 } },
                { name:'FIELD KIT',      desc:'Salvages twice as fast.',              mods:{ salvageMul:2.00 } }],
  gunskiff:    [{ name:'SKIRMISH SCREEN',desc:'+18% march speed.',                    mods:{ speedMul:1.18 } },
                { name:'SPOTTER',        desc:'+60% salvage and +1 armour.',          mods:{ salvageMul:1.60, armorAdd:1 } }],
  linebreaker: [{ name:'BOLTED PLATE',   desc:'+4 armour.',                           mods:{ armorAdd:4 } },
                { name:'HEATED CORE',    desc:'+25% slow resistance.',                mods:{ slowResistAdd:0.25 } }],
  dragoon:     [{ name:'ANCHOR DRIVE',   desc:'+20% health.',                         mods:{ hpMul:1.20 } },
                { name:'COMMANDEER',     desc:'A summon costs 18% less.',             mods:{ costMul:0.82 } }],
  vanguard:    [{ name:'DEEPER RANKS',   desc:'+25% bodies per summon.',              mods:{ countMul:1.25 } },
                { name:'STANDING ORDERS',desc:'Salvages twice as fast.',              mods:{ salvageMul:2.00 } }],

  votary:      [{ name:'LESSER OATH',    desc:'+50% ward.',                           mods:{ shieldMul:1.50 } },
                { name:'OFFERTORY',      desc:'+40% of the income a summon adds.',    mods:{ incomeMul:1.40 } }],
  censer:      [{ name:'LONGER LITANY',  desc:'Regrows 4% of its health a second.',   mods:{ regen:0.040 } },
                { name:'SHARED BREATH',  desc:'A passed ward carries 80% further.',   mods:{ vowMul:1.80 } }],
  sanctifier:  [{ name:'REFORGED WARD',  desc:'+35% ward.',                           mods:{ shieldMul:1.35 } },
                { name:'UNBROKEN',       desc:'A passed ward carries 60% further.',   mods:{ vowMul:1.60 } }],
  oriflamme:   [{ name:'BANNER HELD HIGH',desc:'+18% health.',                        mods:{ hpMul:1.18 } },
                { name:'PILGRIMAGE',     desc:'+40% bodies per summon.',              mods:{ countMul:1.40 } }],
  luminark:    [{ name:'CATHEDRAL PLATE',desc:'+45% ward and +3 armour.',             mods:{ shieldMul:1.45, armorAdd:3 } },
                { name:'RELIQUARY',      desc:'A passed ward carries twice as far.',  mods:{ vowMul:2.00 } }],

  chitling:    [{ name:'SPAWN GLUT',     desc:'+50% bodies per summon.',              mods:{ countMul:1.50 } },
                { name:'RAVENOUS',       desc:'Takes 80% more off its own dead.',     mods:{ massMul:1.80 } }],
  gnawling:    [{ name:'HARD CHITIN',    desc:'+3 armour.',                           mods:{ armorAdd:3 } },
                { name:'MARROW',         desc:'Takes 50% more off its own dead.',     mods:{ massMul:1.50 } }],
  bloatpod:    [{ name:'RIPE',           desc:'+25% health.',                         mods:{ hpMul:1.25 } },
                { name:'BILE',           desc:'Regrows 5% of its health a second.',   mods:{ regen:0.050 } }],
  hivelord:    [{ name:'WIDER FRENZY',   desc:'+15% march speed.',                    mods:{ speedMul:1.15 } },
                { name:'DOMINANCE',      desc:'Takes twice as much off its own dead.',mods:{ massMul:2.00 } }],
  broodmother: [{ name:'PROLIFIC',       desc:'+25% bodies per summon.',              mods:{ countMul:1.25 } },
                { name:'ENGORGED',       desc:'+30% health.',                         mods:{ hpMul:1.30 } }],

  cutter:      [{ name:'STRIPPED HULL',  desc:'+25% march speed.',                    mods:{ speedMul:1.25 } },
                { name:'PRIZE MONEY',    desc:'+40% of the income a summon adds.',    mods:{ incomeMul:1.40 } }],
  boarder:     [{ name:'LONGER LINE',    desc:'+20% health.',                         mods:{ hpMul:1.20 } },
                { name:'GRAPNEL CHARGE', desc:'A scuttle jams 80% longer.',           mods:{ scuttleMul:1.80 } }],
  scrapjack:   [{ name:'LOOTED COILS',   desc:'A scuttle jams twice as long.',        mods:{ scuttleMul:2.00 } },
                { name:'SPARES',         desc:'Regrows 5% of its health a second.',   mods:{ regen:0.050 } }],
  wrecker:     [{ name:'MORE SPARES',    desc:'+25% health.',                         mods:{ hpMul:1.25 } },
                { name:'POWDER',         desc:'A scuttle jams 60% longer.',           mods:{ scuttleMul:1.60 } }],
  ironhulk:    [{ name:'WELDED LAYERS',  desc:'+5 armour.',                           mods:{ armorAdd:5 } },
                { name:'BALLAST',        desc:'+30% slow resistance.',                mods:{ slowResistAdd:0.30 } }],

  stitch:      [{ name:'SWARM PRINT',    desc:'+35% bodies per copy.',                mods:{ countMul:1.35 } },
                { name:'CONDUCTIVE MESH',desc:'A relay burns 60% longer.',            mods:{ relayMul:1.60 } }],
  fabricant:   [{ name:'SELF-PATCH',     desc:'Regrows 4% of its health a second.',   mods:{ regen:0.040 } },
                { name:'COLD RATED',     desc:'+25% slow resistance.',                mods:{ slowResistAdd:0.25 } }],
  splicer:     [{ name:'LONG SPLICE',    desc:'A spliced lane stays open twice as long.', mods:{ spliceMul:2.00 } },
                { name:'ARMOURED CASING',desc:'+4 armour.',                           mods:{ armorAdd:4 } }],
  gantry:      [{ name:'RE-ARMER',       desc:'A relay burns 50% longer.',            mods:{ relayMul:1.50 } },
                { name:'BALLAST RACKS',  desc:'+25% health.',                         mods:{ hpMul:1.25 } }],
  omniframe:   [{ name:'OVERBUILT',      desc:'+5 armour.',                           mods:{ armorAdd:5 } },
                { name:'CROWN NODE',     desc:'+20% health and a relay burns 40% longer.', mods:{ hpMul:1.20, relayMul:1.40 } }],
  tictac:      [{ name:'IMPOSSIBLE TURN', desc:'+22% march speed.',                    mods:{ speedMul:1.22 } },
                { name:'NO SIGNATURE',    desc:'+35% slow resistance.',                mods:{ slowResistAdd:0.35 } }],
  fluxliner:   [{ name:'FIELD DRIVE',     desc:'+22% health.',                         mods:{ hpMul:1.22 } },
                { name:'MERCURY LOOP',    desc:'A summon costs 15% less.',             mods:{ costMul:0.85 } }],
  phoenixlt:   [{ name:'FORMATION',       desc:'+45% bodies per summon.',              mods:{ countMul:1.45 } },
                { name:'HOLDING STATION', desc:'+2 armour.',                           mods:{ armorAdd:2 } }],
  arbiter:     [{ name:'FINDING',         desc:'+3 armour.',                           mods:{ armorAdd:3 } },
                { name:'ENFORCEMENT',     desc:'+15% health.',                         mods:{ hpMul:1.15 } }],
  deferral:    [{ name:'POSTPONED',       desc:'+40% slow resistance.',                mods:{ slowResistAdd:0.40 } },
                { name:'UNDER REVIEW',    desc:'+25% ward.',                           mods:{ shieldMul:1.25 } }],
  sealbearer:  [{ name:'ON THE RECORD',   desc:'+4 armour.',                           mods:{ armorAdd:4 } },
                { name:'LAWFUL',          desc:'+20% ward.',                           mods:{ shieldMul:1.20 } }],
  tither:      [{ name:'COLLECTION',      desc:'+70% salvage.',                        mods:{ salvageMul:1.70 } },
                { name:'STEADY PACE',     desc:'+25% slow resistance.',                mods:{ slowResistAdd:0.25 } }],
  stockman:    [{ name:'RECOUNT',         desc:'+18% health.',                         mods:{ hpMul:1.18 } },
                { name:'ADJUSTED FIGURE', desc:'A summon costs 14% less.',             mods:{ costMul:0.86 } }],
  graft:       [{ name:'FUSED SEAM',      desc:'+3 armour.',                           mods:{ armorAdd:3 } },
                { name:'IMPROVED YIELD',  desc:'+30% bodies per summon.',              mods:{ countMul:1.30 } }],
  tollman:     [{ name:'NAMES A PRICE',   desc:'+80% salvage.',                        mods:{ salvageMul:1.80 } },
                { name:'STANDS THE LANE', desc:'+3 armour.',                           mods:{ armorAdd:3 } }],
  runner:      [{ name:'NO MANIFEST',     desc:'+20% march speed.',                    mods:{ speedMul:1.20 } },
                { name:'QUIET HOLD',      desc:'A summon costs 20% less.',             mods:{ costMul:0.80 } }],
  powderhand:  [{ name:'STAND WELL BACK', desc:'+35% bodies per summon.',              mods:{ countMul:1.35 } },
                { name:'SELF TAUGHT',     desc:'+16% health.',                         mods:{ hpMul:1.16 } }],
  erratum:     [{ name:'UNANSWERED',      desc:'+40% bodies per summon.',              mods:{ countMul:1.40 } },
                { name:'LOGGED',          desc:'+2 armour.',                           mods:{ armorAdd:2 } }],
  addendum:    [{ name:'APPENDED',        desc:'+3 armour.',                           mods:{ armorAdd:3 } },
                { name:'EXECUTED ANYWAY', desc:'+18% health.',                         mods:{ hpMul:1.18 } }],
  precedent:   [{ name:'ESTABLISHED',     desc:'+5 armour.',                           mods:{ armorAdd:5 } },
                { name:'MAY BE DONE',     desc:'+22% health.',                         mods:{ hpMul:1.22 } }],
};

/**
 * UNIT_TYPES. Authored to the shape TOWER_TYPES already has -- `{ id, name,
 * talents: [{ id, row, col, name, desc, mods }] }` -- because Meta looks a
 * tree up by id and does not care which of the two tables it came from. That
 * is the whole of "reuse the tower talent shape": no second allocator, no
 * second mastery ladder, no second stock-build fallback to keep in step.
 */
const UNIT_TYPES = {};
for (const id of UNIT_ORDER) {
  const def = ENEMY_TYPES[id];
  const doc = unitDoctrineOf(id);
  const rows = (UNIT_DOCTRINE_TALENTS[def.faction] || []).slice();
  const sig = UNIT_SIGNATURE_TALENTS[id] || [];
  const talents = rows.concat(sig.map((t, i) => ({
    id: 'u_' + id + '_' + i, row: 2, col: i, name: t.name, desc: t.desc, mods: t.mods
  })));
  UNIT_TYPES[id] = {
    id, name: def.name, faction: def.faction, color: def.color,
    doctrine: doc, desc: def.desc, talents
  };
}

/** Every mod key a unit talent may carry, with its identity value. The
    resolver in config.js starts from this, so a key nothing folds -- the
    inert-stat failure this project is named for -- cannot reach a reader. */
const UNIT_FIELD_IDENTITY = Object.freeze({
  countMul: 1, costMul: 1, incomeMul: 1,
  hpMul: 1, armorAdd: 0, speedMul: 1, shieldMul: 1, regen: 0, slowResistAdd: 0,
  salvageMul: 1, vowMul: 1, massMul: 1, scuttleMul: 1,
  /* THE PARALLEL’s two. Each has exactly one reader -- relayMul in the relay
     node’s lifetime, spliceMul in the spliced lane’s -- because a field
     nothing reads is a talent that lies about what it does. */
  relayMul: 1, spliceMul: 1
});

/**
 * Who has troops on THIS world. Holding a world on paper is not the same as
 * standing on it: only a commander’s own seat, a fortress, a pirate nest or a
 * world two powers already contest carries a garrison -- roughly a third of a
 * galaxy, which is the owner’s "some planets" rather than every planet.
 * Everywhere else the Vigil marches alone.
 *
 * This is WORLD state, not a side’s lever. Both commanders face the identical
 * wave drawn from the identical roster, exactly as they always have.
 */
function battleHostFaction(opts) {
  if (!opts) return null;
  /* The SAME substitution generateGalaxy makes for a world’s OWNER, applied to
     the troops standing on it. Fixing the owner alone does not reach here: a
     nest’s garrison is keyed to the world KIND, not to who holds the world, so
     naming the pirates outright left a PIRATE player’s own soldiers marching in
     the wave against them on every nest in the galaxy. MEASURED over 200
     galaxies x 4 factions: worlds garrisoned by the player’s OWN troops fall
     15.3% -> 8.1% with the owner fix alone, and 8.1% -> 0.0% with this. The
     rule is generateGalaxy’s rule verbatim, which is the point -- two sites
     that name the squatter independently are how they came to disagree.
     Non-pirate profiles resolve 'pirate' exactly as before, so every other
     faction’s rosters are byte-identical. */
  const me = opts.faction ||
             ((typeof Meta !== 'undefined' && Meta.faction) ? Meta.faction() : null);
  /* THE ONE DELIBERATE EXCEPTION to everything below. A RENEGADE world is held
     by a splinter of your OWN power (galaxy.js), so your own soldiers on the
     field is the entire point of it rather than the defect the rest of this
     function exists to prevent. Checked FIRST, because the nest rule below
     would otherwise substitute the squatter and quietly throw the feature
     away on every renegade world that happened to roll a nest. */
  if (opts.renegade) return me || null;
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
     nobody’s -- the machines reverse-engineered all four powers and every one
     of them buys the results back. Human for the same reason humanity survives
     at all: its hardware is built to take anybody’s parts, which makes it the
     galaxy’s common currency rather than one power’s secret. The practical
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
          'protections open: armour aside, every resistance it has is worth ' +
          'less for a few seconds: and it cannot itself be jammed or sabotaged.'
  },
  xeno: {
    id: 'xeno', faction: 'xeno', gated: true,
    name: 'XENO', short: 'Xeno', icon: '⬢', color: '#7c3aed',
    tag: 'PUNISHING',
    rule: 'PUNISH',
    desc: 'Grows on wounds. Every hit carries a rider that scales off how ' +
          'hurt the target already is: nothing against a fresh enemy, ' +
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
          'no gamble, nothing conditional: instead machines placed within ' +
          'reach of each other form a lattice and every link pays.'
  }
};

const ORIGIN_ORDER = ['human', 'light', 'xeno', 'pirate', 'robotic'];

/* --------------------------------------------------------------------------
   BANNER KEY versus ORIGIN KEY, and the one place they disagree.

   A commander's banner is a POWER key (POWER_ORDER: human, light, xeno,
   pirate, robot). A tower's `origin` is an ORIGIN key (ORIGIN_ORDER: human,
   light, xeno, pirate, robotic). Four of the five spell the same and the
   fifth does not, so every `origin === faction` comparison in the codebase is
   silently correct four times out of five and silently wrong the fifth.

   MEASURED at HEAD, 400 seeded drafts per banner, own-origin towers in a
   four-slot loadout against a LOADOUT_OWN_ORIGIN target of two:

       human 3.17   light 2.23   xeno 2.17   pirate 2.11   robot 1.23

   and 45% of machine drafts carried NO robotic tower at all, because
   AI.flyTheBanner looked for towers whose origin was 'robot' and there has
   never been one. The machines were the only power that could not fly its own
   banner, and nothing failed: the swap loop simply found an empty list.

   TOWER_ORIGINS.robotic.faction stays null deliberately and is NOT the fix.
   That field answers "which banner may BUY this", and for the machines the
   answer is everyone. This answers "which origin IS this banner's work",
   which is a different question with a different answer.
-------------------------------------------------------------------------- */
const POWER_ORIGIN = { human: 'human', light: 'light', xeno: 'xeno', pirate: 'pirate', robot: 'robotic' };

/** The ORIGIN key a banner builds under. Passes unknown keys through so a
    caller that already holds an origin key is not punished for it. */
function originKeyOf(faction) { return POWER_ORIGIN[faction] || faction || null; }

/** The origin record for a tower id, never null -- an unlabelled def reads as
    human, which is the baseline every other origin is a departure from. */
function originOf(id) {
  const def = TOWER_TYPES[id];
  return TOWER_ORIGINS[(def && def.origin) || 'human'] || TOWER_ORIGINS.human;
}

/* --------------------------------------------------------------------------
   PRESTIGE, the stacking flat bonus a commander earns per prestige star,
   keyed by their faction. CADRE is unaligned and inherits the profile’s.
-------------------------------------------------------------------------- */
const PRESTIGE_BONUS = {
  human:  { desc: '+4 maximum lives per star',
            apply: (s, n) => { s.maxLives += 4 * n; s.lives += 4 * n; } },
  /* Defensive prestige for the defensive power: the line heals rather than
     hits harder, which is the half of them nothing else pays into. */
  light:  { desc: '+0.25 life regeneration per wave, per star',
            apply: (s, n) => { s.traits.lifeRegen = (s.traits.lifeRegen || 0) + 0.25 * n; } },
  xeno:   { desc: 'reanimates +8% stronger per star',
            apply: (s, n) => { s.mods.reanim *= (1 + 0.08 * n); } },
  pirate: { desc: '+' + sqGold(120) + ' starting gold per star',
            apply: (s, n) => { s.gold += sqGold(120) * n; } },
  /* The Parallel’s prestige shortens the disadvantage rather than raising the
     ceiling: the lattice lights one wave sooner per star. Written here, read
     once in startWave’s bootstrap block -- one writer, one reader. */
  robot:  { desc: 'the lattice lights one wave sooner per star',
            apply: (s, n) => { s.traits.bootAdvance = (s.traits.bootAdvance || 0) + n; } }
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
   the third seat’s ground and base glow were painted in the SECOND seat’s
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
   LORE CODEX ENTRIES, shown in the Field Manual and on the faction screen.

   RENAMED from `LORE` to `LORE_CODEX` when the canonical lore module landed
   (js/lore.js, generated from docs/lore/ at release 0.5.0), which declares its
   own top-level `const LORE`. Two top-level consts of the same name in one
   inlined bundle is a SyntaxError that kills the entire script: every global
   goes undefined and the game renders nothing. The bundle is one script, so
   file boundaries do not scope anything.

   REWRITTEN from the canon (Session 35, task D1). The six entries this array
   used to hold predated docs/lore/ and several of them had gone false: first
   contact as a trade delegation, the Expansion as a land rush over empty
   worlds, and a "pirate nest" world kind that galaxy.js renamed to Vigil Nest
   under continuity rule 6. Sources are docs/lore/docs/canon/ (overview,
   campaign-era-2099, hidden-history, glossary) and docs/lore/docs/game/
   (campaign-premise, mechanics-mapping, troops-and-vigil).

   THE BRIEF this array answers: the Field Manual is the one screen where a
   new player learns what the game IS, so every entry leads with the thing the
   player touches and puts the flavour behind it. Where canon and the engine
   disagree, THE ENGINE WINS and the entry says what actually happens: canon
   awards the rescued unit at two stars, ratingFor and Meta.recordWorld award
   it at three, so the codex teaches three.

   PRESENTATION ONLY. Plain {id, title, body} strings, read by ui.js
   buildCodex and by nothing else. No accessor reads it, no save key holds it,
   nothing here is drawn from or written to the simulation. The ids are local
   labels, not canon join keys: grep confirms no other site references them.
-------------------------------------------------------------------------- */
const LORE_CODEX = [
  /* CANON 2029 (docs/CANON-2029.md). The 2099 Sol Gate premise is retired:
     the game begins April 13, 2029, the day Apophis was supposed to land.
     Same contract as ever: {id, title, body}, plain strings, and the Field
     Manual is the ONE screen a new player learns the game from, so every
     entry leads with what the player needs and lets the story carry the
     rest. */
  { id: 'disclosure', title: 'September 11, 2028',
    body: 'The Disclosure was one broadcast with two announcements in it: that the ' +
          'asteroid Apophis would strike Earth, and everything else. The recovered ' +
          'craft. The programs. The harvest. The edits made to human genetics and to ' +
          'human history. The galaxy’s real order, and where humanity stood in it, ' +
          'which was nowhere. Panic lasted weeks. What settled in after it was ' +
          'stranger: acceptance, and inside the acceptance, people who wanted to fight.' },
  { id: 'concord', title: 'The Concord, Holidays 2028',
    body: 'Every nation, one conspiracy. While families gathered for what felt like a ' +
          'last holiday season, the disclosed technology and the best minds alive were ' +
          'pooled into two projects: the intercept, and the fleet. Assembling the whole ' +
          'picture taught the planners what the galaxy never said aloud: humanity would ' +
          'never be treated as an equal until its presence was too large and too ' +
          'permanent to deny.' },
  { id: 'intercept', title: 'April 13, 2029',
    body: 'A Friday. Apophis broke against the intercept, and Earth celebrated, and ' +
          'inside the celebration the hard thing surfaced again: there is always ' +
          'another rock, and there are always beings who call themselves gods. The ' +
          'fleet built to save the planet did not stand down. It departed. The campaign ' +
          'begins on this day, from Earth, and the first system on the map is our own.' },
  { id: 'order', title: 'The Old Order',
    body: 'Nothing out there is empty. The Federation of Light rings worlds it claims ' +
          'to protect. The Xeno Compact farms worlds it claims to preserve, and ' +
          'humanity was one of its herds. The Pirates hold the roads between, owned by ' +
          'no one and indispensable to everyone. Above all of it stand the Vigil, ' +
          'automatons of a civilization no living power has ever met. Every world you ' +
          'will fight on already belongs to one of them.' },
  { id: 'verbs', title: 'Five Ways To Take A World',
    body: 'Every banner conquers, and none of them conquer alike. Humanity SETTLES: ' +
          'presence that cannot be erased again. The Federation RINGS: defence around ' +
          'a world it will not rule. The Xeno HARVESTS: bodies, ground, and ' +
          'consciousness into the yield. The Pirates ROUTE: access, salvage, sanctuary, ' +
          'movement. The Vigil CONTINUE: the standing tasks, executed without a living ' +
          'author. One world can carry all five claims at once.' },
  { id: 'vigil', title: 'The Vigil',
    body: 'The Vigil is not a sixth power. It is the machine ecology the Ancients ' +
          'left behind, and its recovered prime directives contain no offensive verb: ' +
          'defend, repair, heal, quarantine. Something overwrote them. The Vigil now ' +
          'attacks on a galactic scale, it does not read flags, and it comes down the ' +
          'same corridor at both commanders in the same numbers. Nothing out there is ' +
          'fighting for you.' },
  { id: 'ancients', title: 'The Ancients',
    body: 'Older than the Federation, older than the Compact, and gone in a way that ' +
          'is not dying: the Ancients shed physical form entirely. A mind that is ' +
          'everywhere has no location, no enemy, and no mouth, and a mind with no ' +
          'mouth issues no commands. Which is the whole mystery of the Vigil: whatever ' +
          'is signing its hostile orders, it is not the silence that built it.' },
  { id: 'garrisons', title: 'Who Is Actually Standing There',
    body: 'The banner on a world names its claim. The garrison is who fights you for ' +
          'it: a seat fields its commander, a fortress fields its holder’s best, a ' +
          'contested world seats two rivals at once, a Vigil nest fields the machines, ' +
          'and a renegade world fields a splinter of your own power that has stopped ' +
          'answering the order that raised it. Read the briefing before the drop: it ' +
          'names the garrison, not just the flag.' },
  { id: 'reanimation', title: 'Echo Reversal',
    body: 'A destroyed hostile leaves a combat-state record that holds for a few ' +
          'seconds. The node reads it, builds an unstable echo, and walks that echo up ' +
          'your own lane, across the neutral ground, into your rival’s defences. ' +
          'Broken a second time, an echo cannot be rebuilt. Every commander answers ' +
          'the protocol differently: a rite may change the shape a kill returns in, ' +
          'never its mass, and two of the five doctrines take nothing off the lane at ' +
          'all.' },
  { id: 'stars', title: 'Stars Are Claim Stability',
    body: 'Winning on a world takes it. Winning CLEANLY, three stars, conquers it: ' +
          'the claim holds when you leave, the world’s denizens can join your muster ' +
          'vault, and a fully conquered system pays its bounty and brings its ' +
          'commander out to meet you. Anything less than three stars is a raid the ' +
          'map will remember differently.' },
  { id: 'souls', title: 'SOULS',
    body: 'The harvest currency. Consciousness leaves a signature, the signature can ' +
          'be banked, and the Compact built an economy on exactly that long before ' +
          'humanity named it. SOULS buy commanders, second abilities, and arsenal ' +
          'permanently, across every campaign on the profile. Stars pay them, ' +
          'conquest pays them, and spending them is the one purchase the galaxy ' +
          'cannot repossess.' },
  { id: 'conquest', title: 'Conquest',
    body: 'A campaign is five systems, opening in your banner’s own home system. ' +
          'Take worlds, conquer them clean, and the system’s commander comes out to ' +
          'hold their seat. Break all five seats and the galaxy is yours, and the ' +
          'campaign asks its real question: every banner has a public mission and a ' +
          'buried crisis, and the beats between systems are where the crisis ' +
          'surfaces. Claiming a conquered galaxy rolls the next one a tier harder.' },
];
