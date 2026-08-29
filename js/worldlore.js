/* ==========================================================================
   COSMIC CONQUEST, THE WORLD AND BATTLEFIELD DOSSIER LAYER
   --------------------------------------------------------------------------
   Canon: docs/lore/ release 0.5.0, read through the frozen global LORE that
   js/lore.js declares. This module is AUTHORED, like js/story.js and unlike
   js/lore.js, and it does one job: turn the fields a generated world ALREADY
   carries into prose, so a world stops being a set of mechanical facts with
   no sense of place.

   WHY IT EXISTS. js/galaxy.js builds five systems of seven worlds, and every
   one of them arrives with a system index, a world index, an owner, a kind, a
   map, an arena modifier, a boon and a scenario. Those are enough to play the
   world and not enough to know anything about it. The briefing card could
   name the ground; it could not say what the ground used to be for, or why
   two powers are standing on it now. This supplies both, from fields that
   already exist.

   THE FIVE RULES THIS FILE OBEYS, and each one is load bearing:

   1. IT DRAWS NOTHING. Not one call to Math.random, and no call to any
      generator. Multiplayer replaces Math.random with a seeded PRNG, and one
      stray draw from a presentation layer desyncs every duel. Where this
      module needs to vary a sentence it hashes a STABLE STRING the world
      already owns (its id) with FNV-1a and indexes a table. Same world, same
      words, in any session, on any machine, forever.

   2. IT IS READ ONLY. It never writes to a world, a system, a save, or the
      game. Nothing here can enter the lockstep fingerprint, move a balance
      number, add a save key, or touch NET_PROTOCOL, because nothing here is
      ever read by the simulation.

   3. IT RENAMES NOTHING. Map ids are the join between canon and engine, so
      ids appear here exactly as js/config.js spells them, and display names
      come from LORE where LORE has one. The seven authored below carry the
      names js/config.js already ships, character for character, including
      the two that collide with older authored maps.

   4. IT DEGRADES TO SILENCE. If LORE is undefined every LORE-backed accessor
      returns null and available() says so, so a page that has not rebuilt
      renders exactly what it rendered before rather than half a dossier.

   5. IT IS PURE. Same inputs, same output. No cached state, no lazily built
      singletons, no hidden counters. Every accessor returns a fresh object.

   THE GAP THIS CLOSES. The game ships 28 boards in MAPS. LORE.maps covers 22
   ids, of which 21 are in MAPS (the twenty-second, `maelstrom`, is the
   generated arena board that config.js builds at runtime). The seven
   procedural families landed after the lore release and had no canon at all:
   spiral, twin-channel, chokepoint, island-scatter, open-field, convergence,
   fortress-ring. They are authored here, in LORE.maps shape and LORE.maps
   voice, and selfCheck() proves the coverage rather than asserting it.

   THE PREMISE THE SEVEN ARE WRITTEN AGAINST. It is 2029, after the Disclosure
   of September 2028 and the intercept that followed it. Nothing a commander fights on is a
   natural landform. Every board is jurisdiction infrastructure that was built
   to do a job, stopped doing it, and is still shaped like the job. So every
   site record here splits in two: what the site was FOR, and what that same
   geometry does to the people fighting over it now.
   ========================================================================== */

(function (global) {
  'use strict';

  /* --------------------------------------------------------------------------
     THE SEVEN WITH NO CANON.

     Same shape as a LORE.maps entry (id, name, classification, canon) plus the
     then/now split every site record in this module carries. `name` is copied
     from js/config.js MAPS verbatim and must stay that way: selfCheck compares
     the two and reports drift rather than papering over it.

     Two of these names duplicate authored maps ('The Narrows' also names the
     authored `narrows`, 'The Expanse' also names the authored `expanse`). That
     is the game's spelling and this file does not get to fix it. It is called
     out here so a future editor knows the duplication is inherited, not a typo
     introduced by the dossier.
  -------------------------------------------------------------------------- */
  var AUTHORED_MAPS = {

    spiral: {
      id: 'spiral', name: 'Vortex Reach',
      classification: 'Inward transit winding',
      canon: 'An approach spiral built so no inbound convoy reached the centre without passing the same inspection ring three times.',
      functionThen: 'Graduated customs. The winding existed so that arriving cargo was counted at every ring rather than once at the door, and the cut back out was the release lane for anything already cleared.',
      conflictNow: 'The inspection rings are gone and the geometry is not. Everything that walks in walks the whole winding, and the release lane crosses every ring it just wound, so one good position answers four passes and a bad one answers none.'
    },

    'twin-channel': {
      id: 'twin-channel', name: 'Twin Straits',
      classification: 'Paired distribution channel',
      canon: 'Two separated flow channels of a climate distribution bank, held apart so a failure in one could never reach the other.',
      functionThen: 'Containment. The bank between the channels was not scenery, it was the wall, and the entire design goal was that nothing crossing one channel could touch the second.',
      conflictNow: 'The containment still works, which is the problem. Nothing placed on one channel covers the other, so a defence has to be bought twice, and the channel you buy first is the one they stop using.'
    },

    chokepoint: {
      id: 'chokepoint', name: 'The Narrows',
      classification: 'Sequenced transit gate',
      canon: 'A single-file corridor whose alcoves were inspection bays, each sealed from the next so no inspector could be pressured by the queue behind.',
      functionThen: 'Metered passage. Traffic was held one leg at a time, and the bays were built blind to each other on purpose: an inspector who could see the next bay could be signalled from it.',
      conflictNow: 'Blind bays make blind emplacements. Each alcove watches exactly one leg of the corridor and nothing built in one can support another, so the corridor is not won once, it is won three separate times.'
    },

    'island-scatter': {
      id: 'island-scatter', name: 'Shattered Shoals',
      classification: 'Collapsed survey shelf',
      canon: 'A survey shelf that lost its footing in a gate-shear event, leaving the service road intact and everything either side of it broken.',
      functionThen: 'Ground support. The standing pockets were the maintenance stations that kept the shelf road open, and they were spaced for a road that ran across solid ground the whole way.',
      conflictNow: 'The road still runs and the shelf no longer does. Only the old stations are standing ground, so the fight is decided by which pockets are taken first, and there is no second-best tile waiting behind a bad one.'
    },

    'open-field': {
      id: 'open-field', name: 'The Expanse',
      classification: 'Cleared receiver flat',
      canon: 'A reception flat kept clear by statute, because the survey array standing on it required an unobstructed horizon in every direction.',
      functionThen: 'Sightline law. Nothing was permitted to stand on the flat, for as long as the array ran, because the array had to see past it and the clearance was easier to enforce than to rebuild.',
      conflictNow: 'The array is dead and the ground still enforces its clearance. There is almost nothing to hold, so no position covers much of anything, and the only way to cover more is to own more of it.'
    },

    convergence: {
      id: 'convergence', name: 'Last Bastion',
      classification: 'Single-seat refuge node',
      canon: 'A jurisdiction of last resort, laid out so that every approach road ended at one registry hall and at no other.',
      functionThen: 'Evacuation by funnel. Every road was cut to arrive at the same hall, because a population moving under threat cannot be asked to choose a direction and cannot be told twice.',
      conflictNow: 'What funnelled a population in now funnels a siege in. There is one seat, no second front to trade for time, and the only question the ground asks is how long the hall holds.'
    },

    'fortress-ring': {
      id: 'fortress-ring', name: 'Siege Ring',
      classification: 'Breached command ring',
      canon: 'A defensive ring around a command seat, broken open often enough that the road now runs through the wall rather than around it.',
      functionThen: 'Screening. The ring stood between the seat and every line of fire, and the approach road was kept outside it so that nothing walking in ever had the seat in view.',
      conflictNow: 'The wall still stops shots and no longer stops the road. The march passes through the breaches, so the ring shields whoever is walking it exactly as well as whoever is holding the seat.'
    },

    /* ── THE EIGHT ADDED WITH THE SECOND GEOMETRY PASS ────────────────────
       js/mapgen.js grew from seven procedural families to fifteen and
       js/config.js MAPS grew with it. This table did not, and nothing caught
       that, because selfCheck() was wired into no gate: it reported
       ok:false with eight missing ids to any caller who thought to ask, and
       nobody asked. owner-sweep 41.1 is that caller now.

       The visible symptom, measured before these were written: WorldLore.world()
       still produced a headline and a body for all eight, because those come
       from the owner-and-kind sentence banks, but functionThen and conflictNow
       came back as EMPTY STRINGS. Eight boards whose dossier said nothing
       about the board.

       Each record is written against the geometry the generator actually
       produces, not against the name. The function is what the site was FOR;
       the conflict is what that same shape does to a battle now. */

    braid: {
      id: 'braid', name: 'Woven Roads',
      classification: 'Paired haulage run',
      canon: 'Two haulage roads laid under one contract and crossed at intervals, so a stalled convoy on either could be stepped around without leaving the corridor.',
      functionThen: 'Redundancy by crossing. Neither road was the main one, and the swaps existed so that a blockage on one became a detour rather than a closure.',
      conflictNow: 'The crossings are the only ground that touches both roads. A tower standing between two swaps is worth two placed anywhere else, and everything away from them is defending half a battle.'
    },

    gauntlet: {
      id: 'gauntlet', name: 'The Fenced Road',
      classification: 'Posted transit road',
      canon: 'A long open haul lined with survey posts, set alternately to either side so a driver always had one in view and never had two.',
      functionThen: 'Position by alternation. The posts kept a vehicle located on a road with no other landmark, and they were staggered so that no two ever stood on the same side to be confused with each other.',
      conflictNow: 'Those posts are the only cover on the whole run, and they change sides as the road goes. A line built along one flank is answered by the next post standing on the other.'
    },

    staircase: {
      id: 'staircase', name: 'Descent Steps',
      classification: 'Graded descent road',
      canon: 'A cut that drops a terrace at a time, each tread run out flat before the next fall, so loads came down under their own weight and never had to be held.',
      functionThen: 'Descent without brakes. Every leg falls in the same direction, because a road that never climbs never needs a load stopped on it.',
      conflictNow: 'The march never doubles back, so nothing you build is ever passed twice. Cover stands on one side of the road the whole way down, and the far side pays for its view in range.'
    },

    horseshoe: {
      id: 'horseshoe', name: 'The Plaza',
      classification: 'Enclosed muster ground',
      canon: 'A muster yard wrapped on three sides by its own approach road, so a formation could be counted from the middle without anyone walking the perimeter.',
      functionThen: 'Inspection from the centre. The road was bent around the yard rather than driven through it, because one clerk standing in the open could see every leg of it at once.',
      conflictNow: 'That is still true and it is now a firing solution. One tower in the plaza covers all three legs, so the ground is not contested along the road, it is contested for the middle.'
    },

    switchback: {
      id: 'switchback', name: 'Hairpin Pass',
      classification: 'Hairpin grade',
      canon: 'A climb folded back on itself as tightly as the grade allowed, trading distance for a gradient a loaded vehicle could take without a winch.',
      functionThen: 'Gradient by folding. Each leg is short because a short leg can be shallow, and a shallow leg is one a full load climbs unassisted.',
      conflictNow: 'Short legs mean the march is never far from the last bend or the next. Exposure is brief and constant rather than long and occasional, and a tower that reaches two legs is reaching most of the pass.'
    },

    labyrinth: {
      id: 'labyrinth', name: 'The Maze',
      classification: 'Partitioned holding works',
      canon: 'A holding site divided and redivided until the only route across it was a single corridor, with a gate at every partition that corridor crossed.',
      functionThen: 'Containment by partition. Nothing held here was meant to move except along the one line that was watched, and every wall existed to make a second line expensive to cut.',
      conflictNow: 'The walls outlived what they contained and still decide what can see what. Most of the board is ground that watches nothing, and the corridor is worth exactly what the gates standing on it are worth.'
    },

    'twin-temple': {
      id: 'twin-temple', name: 'Twin Sanctums',
      classification: 'Paired precinct halls',
      canon: 'Two precinct halls raised on one warrant and kept deliberately identical, so that neither could be called the seat and neither could be closed on its own.',
      functionThen: 'Authority in duplicate. What one hall ruled the other could ratify, and the walls between them were raised so that a crowd in either could not be addressed from the other.',
      conflictNow: 'Two roads and two walled halls is two battles that cannot reinforce each other. Whatever is not spent on one is spent on the other, and no position is spending on both.'
    },

    'twin-gate': {
      id: 'twin-gate', name: 'The Bars',
      classification: 'Barred inspection run',
      canon: 'A single road interrupted by standing bars, each one a checkpoint that could be closed without closing the others.',
      functionThen: 'Metered advance. Traffic was released one bar at a time, so a queue formed at a known place instead of wherever it happened to stop.',
      conflictNow: 'The bars still meter the advance and no longer choose who is metered. Each one turns the road in front of it into a queue, which is a killing floor to whoever holds the ground beside that bar and nothing at all to whoever does not.'
    }
  };

  /* --------------------------------------------------------------------------
     THE THEN AND NOW SPLIT, for every board in the game.

     LORE.maps supplies name, classification and canon for the twenty-two it
     covers; those three are NOT duplicated here, because a second copy of a
     generated field is a second thing to keep in step and this file would lose
     that race. What LORE does not carry is the split: its `canon` is one
     sentence describing the site, and a dossier needs the function it lost and
     the fight it causes stated separately.

     Every line below is written against the LORE entry for the same id and
     must not contradict it. The seven authored above carry their own split
     inside their record and do not appear here.
  -------------------------------------------------------------------------- */
  var SITE_SPLIT = {

    spine: {
      functionThen: 'Survey trunk. One straight transit backbone with clear shoulders, kept open so a jurisdiction could be walked end to end and verified by eye rather than by filing.',
      conflictNow: 'The shoulders that made it easy to inspect make it easy to hold. Every tile sees the lane at least twice, which is why it is where new commanders are taught: the ground hides nothing and forgives nothing.'
    },
    delta: {
      functionThen: 'Water management. The bank split the outflow into two mouths so either could be worked, throttled or shut without touching the other.',
      conflictNow: 'The bank is intact and still divides. No tower reaches across it, so fortifying one mouth is a public statement about which mouth they will use.'
    },
    narrows: {
      functionThen: 'Transit control. The corridor was a graded throat and its emplacements were spaced to cover it in overlapping arcs, so no leg was ever answered by one gun alone.',
      conflictNow: 'The collapse took everything but three alcoves, and the overlap with it. Each alcove holds a single leg, and nothing built in one can help another.'
    },
    shattered: {
      functionThen: 'Contiguous ground. Before the shear this was one surface with one road laid across it, and where a defender stood was not a question anyone had to ask.',
      conflictNow: 'Four islands now hang off one long fall through the craters. There is no second-best tile and no way to reinforce a mistake after it is made.'
    },
    crossroads: {
      functionThen: 'Interchange. Two jurisdictions met here under one monument, and the monument existed to say which of them held precedence when they disagreed.',
      conflictNow: 'Nobody recognises the monument and it is still in the way. Both crossings are lane ground, so the tiles that watch them sit beside them, and the pocket that would have watched both does not exist.'
    },
    coil: {
      functionThen: 'Heat management. A closed loop wound inward so coolant passed the core many times over before it was allowed to leave the circuit.',
      conflictNow: 'The loop is cold and the winding is not. It is the longest march in the theatre, cut straight back out across every ring it has just wound, so one good tile is worth four anywhere else.'
    },
    expanse: {
      functionThen: 'Reception. The plain was held clear for an array that needed to see a very long way and to be interrupted by nothing at all.',
      conflictNow: 'Two approaches that never come within reach of each other, across a drift of dead hulls. Nothing here covers much, so the only answer is to own more of it than the other side can.'
    },
    rift: {
      functionThen: 'Translation. Traffic entered here and arrived somewhere else, which is why the ground was never laid out to be walked in the first place.',
      conflictNow: 'The channel still opens and no longer agrees with itself. What arrives does not arrive where the ground says it should, and a line drawn on this board is a guess about geometry.'
    },
    confluence: {
      functionThen: 'Arbitration. Three registries met at one junction, and the site existed so that their claims could be laid beside each other in the same room.',
      conflictNow: 'All three records are still valid and none of them can delete another. The junction settles it the only way left: three seats, and it ends when two are gone.'
    },
    crown: {
      functionThen: 'Ceremony. The ring seated every claimant in full view of every other, so that no claim could be advanced privately and none could later be denied.',
      conflictNow: 'The observation survived and the authority did not. Everyone can see everything, and the ring is now the reason nothing here can be done quietly.'
    },
    carousel: {
      functionThen: 'Scheduling. Routes were reassigned continuously so that no single approach ever carried the whole load for long.',
      conflictNow: 'The scheduler still runs and has no load left to balance. The pressure moves anyway, and where it lands next is a property of the machine rather than of anyone standing on it.'
    },
    orrery: {
      functionThen: 'Navigation. The model was the local gate table made physical, so that it could be read and trusted with no power and no archive access.',
      conflictNow: 'It still governs access and nobody maintains it. Fighting across the model changes what the model says, which is the only reason anyone fights here at all.'
    },
    lattice: {
      functionThen: 'Connection. The mesh was buried service work: the graph that decided which jurisdiction could reach which, and in what order.',
      conflictNow: 'The covering is gone and the graph is walkable. Where a tower stands is which connection it holds, so placement here is a constitutional argument conducted with guns.'
    },
    causeway: {
      functionThen: 'Continuity. One bridge carried the record between two separated jurisdictions, and the record is the only thing that made them one polity.',
      conflictNow: 'The bridge is still the sole join. Losing it does not lose ground, it loses the claim that the ground on either side was ever the same place.'
    },
    anvil: {
      functionThen: 'Manufacture. The plate was poured to absorb continuous impact, because the Machine work standing on it was never intended to stop.',
      conflictNow: 'The foundry is quiet and the plate is unbroken. It takes everything, so nothing here is decided by breaking the ground and everything is decided by who is standing on it.'
    },
    lance: {
      functionThen: 'Calibration. A beamline whose entire value was that it ran exactly straight and was measured to a tolerance nobody was allowed to round.',
      conflictNow: 'The measurements still hold and there is nothing left to calibrate. Range and alignment are the whole board, and being approximately right on it is being wrong.'
    },
    skew: {
      functionThen: 'Registration. The frame was surveyed, the survey was filed, and for a long stretch of its service life the two agreed with each other.',
      conflictNow: 'The field moved and the file did not. The chart says straight and the ground says otherwise, and both remain official, so every line of fire is an opinion.'
    },
    strait: {
      functionThen: 'Throughput. Two opposed streams were engineered to pass each other at speed without stopping, which was the measure of the design.',
      conflictNow: 'The engineering has no opinion about who is passing. What made the corridor efficient makes it very hard to hold: everything that arrives is already on its way through.'
    },
    loom: {
      functionThen: 'Weaving. Separate route threads were bound into one fabric here, so that a shipment and its paperwork travelled as a single object.',
      conflictNow: 'The threads are still woven and nobody is minding the weave. Cutting one does not free it, it pulls on every other thread in the cloth.'
    },
    ossuary: {
      functionThen: 'Deletion. This was the jurisdiction where a record was ended deliberately, without appeal, and without a copy kept anywhere.',
      conflictNow: 'The archive still refuses to take anything back. Nothing that dies here returns, so every kill is final and worth precisely what it cost and no more.'
    },
    atoll: {
      functionThen: 'Habitation. The ring was where people lived and the citadel at the centre was where their air, water and legal standing came from.',
      conflictNow: 'The life-support charter is still held in the middle and the ring is still the only way around it. Holding the centre is holding the reason anyone is on this world.'
    },
    maelstrom: {
      functionThen: 'Admission. The node accepted claims and resolved them in the order they arrived, one at a time, as fast as they could be filed.',
      conflictNow: 'It still accepts every claim and no longer orders them. Twenty seats, all valid at once, and the node settles the contradiction the only way it has left.'
    }
  };

  /* Every board id the game ships, from js/config.js MAPS. Held here as a
     literal so selfCheck can run with nothing else loaded, and cross-checked
     against the live MAPS whenever MAPS is present: a hard-coded manifest that
     nothing compares against is a list that quietly goes stale. */
  var MAP_MANIFEST = [
    'spine', 'delta', 'narrows', 'shattered', 'crossroads', 'coil', 'expanse',
    'rift', 'confluence', 'crown', 'carousel', 'orrery', 'lattice', 'causeway',
    'anvil', 'lance', 'skew', 'strait', 'loom', 'ossuary', 'atoll',
    'spiral', 'twin-channel', 'chokepoint', 'island-scatter', 'open-field',
    'convergence', 'fortress-ring',
    /* The second geometry pass. Added here in the same change as the records
       above, because selfCheck compares this list against the live MAPS in
       BOTH directions and a manifest that lags the table is the drift this
       comment warns about. */
    'braid', 'gauntlet', 'staircase', 'horseshoe', 'switchback', 'labyrinth',
    'twin-temple', 'twin-gate'
  ];

  /* --------------------------------------------------------------------------
     THE SENTENCE BANKS.

     Variation without a draw. Each bank is indexed by an FNV-1a hash of a
     string the world already owns, so the same world produces the same
     sentence in every session and on every client. The banks are small on
     purpose: a dossier that says four different things about the same world
     across four openings is not a dossier, it is noise.
  -------------------------------------------------------------------------- */

  /* LORE.worldGeneration.interpretation states the rule these three restate:
     names are survey registry names, and ownership is a current controlling
     claim rather than the world's native identity. */
  /* CANON 2029 BANKS. The old banks spoke 2099 registry bureaucracy
     ("survey registry entries", "Civil Nodes"), and the owner's verdict on
     them was that the flavor did not make sense. These speak the story:
     who is standing on the world and what they are doing there. Every line
     is one sentence, because the briefing card is read in the three seconds
     before a drop, not studied. Picked by FNV hash of stable world fields,
     zero draws, exactly as before. */

  /* What the CURRENT HOLDER is doing here, by faction. This is the line the
     briefing leads with, because it is the story reason the fight exists. */
  var OWNER_LINES = {
    human: [
      'A Manifest foothold: human crews are pouring foundations here that are meant to outlast every claim that came before them.',
      'Humanity holds it now, and is standardising it so thoroughly that letting go is already becoming impossible.'
    ],
    light: [
      'A Federation ring world: defended from orbit, helped from a distance, and still waiting, like all of them, to be allowed to rise.',
      'The Federation holds the ring here. What the ring is protecting, and from whom, reads differently from the ground.'
    ],
    xeno: [
      'A Hungry harvest site: the pens are quiet, the yield still ships, and the herd here has not heard that one herd broke its fence.',
      'The Harvest holds it the way a stomach holds a meal. Nothing about the arrangement believes it can be interrupted.'
    ],
    pirate: [
      'A free port on the roads: no flag, every cargo, and a sanctuary bay that has never once asked a refugee for papers.',
      'The Constellation runs it as a waystation. Everything moves through here, which is exactly the argument for and against it.'
    ],
    robot: [
      'A Continuance work site: the automatons execute their standing tasks here, and the tasks stopped matching the recovered directives long ago.',
      'The Parallel holds it and maintains it perfectly, for a purpose no recovered archive can produce.'
    ]
  };

  /* What KIND of ground it is, in one mechanical-then-story sentence. */
  var KIND_LINES = {
    standard: [
      'An inhabited world, which is the whole of its value: ordinary life continues here, under whoever wins.',
      'Nothing on it is strategic except the people living there, and both commanders know exactly what that is worth.'
    ],
    fortress: [
      'A fortress world, hardened enough to seat a system commander and hold one.',
      'The defences are the smaller half of it: whoever holds this rock legitimately runs the system around it.'
    ],
    forge: [
      'A forge world: matter and labour go in, campaign tempo comes out, and whoever holds it buys time.',
      'The industry here never stopped for any of its owners. It will not stop for the next one either.'
    ],
    nest: [
      'A Vigil nest: the automatons here still execute the corrupted queue, and they do not read flags.',
      'The machines on this ground answer orders older than every banner present, and something rewrote those orders.'
    ]
  };

  var ORDINARY_LINES = [
    'No seat and no standing dispute: it goes to whoever arrives able to hold it.',
    'One claim on the books, and the books are a long way behind the ground.'
  ];

  var HEADLINES = {
    standard: 'An ordinary world, which is exactly what makes it worth taking intact.',
    fortress: 'A fortress strong enough to hold a commander, which is why somebody always wants it.',
    forge: 'A working forge: whoever holds it buys time, and time cannot be shipped in.',
    nest: 'A Vigil work site that never stood down, on ground nobody has managed to keep.'
  };

  /* --------------------------------------------------------------------------
     PURE HELPERS
  -------------------------------------------------------------------------- */

  /** FNV-1a over a string. Not a PRNG and not seeded by one: it is a pure
      function of its input, used only to index a sentence bank. */
  function hash32(s) {
    var h = 2166136261;
    var str = String(s);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Deterministic pick from a list, keyed by a stable string. */
  function choose(list, key) {
    if (!list || !list.length) return '';
    return list[hash32(key) % list.length];
  }

  /** The frozen canon, or null. Never throws, never caches. */
  function lore() {
    return (typeof LORE !== 'undefined' && LORE) ? LORE : null;
  }

  /** The live MAPS table, or null. Read lazily so this module can load before
      js/config.js does without caring about the order. */
  function liveMaps() {
    return (typeof MAPS !== 'undefined' && MAPS && MAPS.length) ? MAPS : null;
  }

  function nonEmpty(s) { return typeof s === 'string' && s.length > 0; }

  /** The name js/config.js ships for a board, or null when MAPS has not
      loaded. Looked up rather than cached, so this stays a pure read. */
  function gameMapName(id) {
    var live = liveMaps();
    if (!live) return null;
    for (var i = 0; i < live.length; i++)
      if (live[i] && live[i].id === id) return live[i].name || null;
    return null;
  }

  /* --------------------------------------------------------------------------
     THE MODULE
  -------------------------------------------------------------------------- */

  var WorldLore = {

    /** The lore release these records are written against, or null if the
        canon module has not loaded. */
    version: function () {
      var L = lore();
      return L && L.version ? L.version : null;
    },

    /**
     * The dossier for one BOARD.
     *
     * Returns { id, name, classification, canon, functionThen, conflictNow,
     * source } or null. `source` is 'lore' for the ids LORE covers and
     * 'authored' for the seven procedural families canonised in this file.
     *
     * Returns null, deliberately, for a LORE-backed id when LORE is absent:
     * there is no name to print, and half a record is worse than none.
     */
    map: function (mapId) {
      if (!mapId) return null;
      var id = String(mapId);

      var shipped = gameMapName(id);

      var authored = AUTHORED_MAPS[id];
      if (authored) {
        return {
          id: authored.id,
          /* THE GAME'S SPELLING WINS. The dossier renders beside a card that
             already printed the board name, and two spellings of one board in
             one panel reads as a bug whichever of them is "right". This is a
             deference, not a rename: the id is untouched and the fallback is
             the authored name, which selfCheck holds to the shipped one. */
          name: shipped || authored.name,
          loreName: authored.name,
          classification: authored.classification,
          canon: authored.canon,
          functionThen: authored.functionThen,
          conflictNow: authored.conflictNow,
          source: 'authored'
        };
      }

      var L = lore();
      var entry = L && L.maps ? L.maps[id] : null;
      if (!entry) return null;

      var split = SITE_SPLIT[id] || null;
      return {
        id: id,
        name: shipped || entry.name || null,
        loreName: entry.name || null,
        classification: entry.classification || null,
        canon: entry.canon || null,
        functionThen: split ? split.functionThen : null,
        conflictNow: split ? split.conflictNow : null,
        source: 'lore'
      };
    },

    /**
     * The dossier for one WORLD.
     *
     * @param w    a generated world from js/galaxy.js. Read only, and only
     *             these fields: id, name, kind, owner, map, arena, seat,
     *             contested, renegade, si, wi. Nothing is written back.
     * @param sys  its system, for the name only. Optional.
     * @param opts optional { scenarioId }. The caller already resolves the
     *             scenario (ownedWorldScenarioOf then worldScenarioOf); this
     *             module will not resolve it a second time, because a second
     *             resolver is how a card comes to promise a world the rules
     *             refuse.
     *
     * Returns { headline, body, functionThen, conflictNow, mapName,
     * classification, source } or null. Every string is '' rather than
     * undefined when its source is missing, so a caller can concatenate
     * without guarding every field.
     */
    world: function (w, sys, opts) {
      if (!w) return null;
      var L = lore();
      var o = opts || {};

      var site = this.map(w.map);
      var kind = KIND_LINES[w.kind] ? w.kind : null;
      var sysName = (sys && sys.name) ? sys.name : '';

      /* HEADLINE. One claim about what this world IS, ordered so that the
         exceptional cases win: a seat, a standing three-way dispute and a
         splinter of your own banner each say more about the world than its
         kind does. */
      var headline;
      if (w.seat) {
        headline = sysName
          ? 'The commander seat of ' + sysName + ', and the registry the rest of the system is run from.'
          : 'A commander seat, and the registry the rest of its system is run from.';
      } else if (w.contested) {
        headline = 'Two standing claims, one registry, and no procedure left that either side will accept.';
      } else if (w.renegade) {
        headline = 'Your own banner, flown by people who have stopped taking the order that raised it.';
      } else {
        headline = kind ? HEADLINES[kind] : 'A jurisdiction with a current claim and an older history.';
      }

      /* BODY. Registry framing, what the world is logged as, what the ground
         is classified as, its standing status, and the two conditions the
         engine already applies. Every sentence is sourced: nothing here is
         invented about a world whose fields do not say it. */
      var parts = [];

      /* Owner first: the story reason the fight exists leads the body,
         where the retired registry boilerplate used to sit. */
      var ownerLine = (w.owner && OWNER_LINES[w.owner])
        ? choose(OWNER_LINES[w.owner], w.id + '|owner') : '';
      if (ownerLine) parts.push(ownerLine);

      if (kind) parts.push(choose(KIND_LINES[kind], w.id + '|kind'));

      if (site && nonEmpty(site.classification))
        parts.push('Ground classification: ' + site.classification + '.');

      if (w.seat) {
        parts.push(sysName
          ? 'It is the seat: ' + sysName + ' is administered from this registry and stops being administered when it falls.'
          : 'It is the seat: its system is administered from this registry and stops being administered when it falls.');
      } else if (w.contested) {
        parts.push('Two powers are already in the field over it and neither will withdraw. A third arriving does not settle the question, it makes the count three.');
      } else if (w.renegade) {
        parts.push('The garrison is your own. A splinter of your power holds the registry and has stopped answering the order that put it there.');
      } else {
        parts.push(choose(ORDINARY_LINES, w.id + '|status'));
      }

      /* The arena modifier and the scenario are the two facts the engine will
         actually apply, and LORE states WHY each is true of a jurisdiction
         rather than what it does to a stat. The card already prints the stat;
         this prints the reason. */
      if (L && L.arenaModifiers && w.arena && L.arenaModifiers[w.arena] &&
          nonEmpty(L.arenaModifiers[w.arena].canon))
        parts.push('Standing condition: ' + L.arenaModifiers[w.arena].canon);

      if (L && L.scenarios && o.scenarioId && L.scenarios[o.scenarioId] &&
          nonEmpty(L.scenarios[o.scenarioId].canon))
        parts.push('The order here: ' + L.scenarios[o.scenarioId].canon);

      /* THE ONE-LINE DOSSIER, canon 2029. The briefing card shows exactly
         this, because the owner's finding on the old two-row WAS/NOW was
         that it read as information, not story. One sentence about who is
         here and one about the ground, fused. The full body remains for any
         surface that wants the long form. */
      var line;
      if (w.renegade) {
        line = 'Held by a splinter of your own banner, and the splinter has stopped answering the order that raised it.';
      } else if (w.seat) {
        line = (ownerLine ? ownerLine + ' ' : '') + 'This is the seat: take it and the system follows.';
      } else if (w.contested) {
        line = 'Two powers are already fighting over this ground, and a third arriving makes the count three.';
      } else {
        line = ownerLine || (kind ? HEADLINES[kind] : '');
      }

      return {
        headline: headline,
        line: line,
        body: parts.join(' '),
        functionThen: site && nonEmpty(site.functionThen) ? site.functionThen : '',
        conflictNow: site && nonEmpty(site.conflictNow) ? site.conflictNow : '',
        mapName: site && nonEmpty(site.name) ? site.name : '',
        classification: site && nonEmpty(site.classification) ? site.classification : '',
        source: site ? site.source : null
      };
    },

    /**
     * COVERAGE REPORT. What this module can and cannot answer, right now, on
     * this page, with whatever has loaded. Intended for a gate to assert
     * against, and for a human to read when the assertion fails.
     */
    available: function () {
      var L = lore();
      var live = liveMaps();
      var expected = live ? live.map(function (m) { return m.id; }) : MAP_MANIFEST.slice();

      var resolved = [], missing = [], fromLore = [], authored = [], incomplete = [];
      for (var i = 0; i < expected.length; i++) {
        var id = expected[i];
        var rec = this.map(id);
        if (!rec) { missing.push(id); continue; }
        resolved.push(id);
        if (rec.source === 'authored') authored.push(id); else fromLore.push(id);
        if (!nonEmpty(rec.functionThen) || !nonEmpty(rec.conflictNow)) incomplete.push(id);
      }

      /* Ids this module can answer that are NOT in the shipped board table.
         `maelstrom` lives here: it is a real board, built at runtime by
         config.js rather than listed in MAPS, and LORE carries canon for it.
         Reported as a bonus rather than as an error, because a gate that
         counts it as drift would fail on a correct file. */
      var bonus = [];
      if (L && L.maps) {
        var loreIds = Object.keys(L.maps);
        for (var j = 0; j < loreIds.length; j++)
          if (expected.indexOf(loreIds[j]) < 0) bonus.push(loreIds[j]);
      }

      return {
        loreVersion: this.version(),
        loreLoaded: !!L,
        mapsLoaded: !!live,
        expected: expected.length,
        resolved: resolved.length,
        fromLore: fromLore.length,
        authored: authored.length,
        missing: missing,
        incomplete: incomplete,
        bonus: bonus
      };
    },

    /**
     * SELF CHECK. Proves coverage instead of assuming it.
     *
     * ok is true only when every board the game ships resolves to a record
     * carrying a name, a classification, a functionThen and a conflictNow; the
     * hard-coded manifest still matches the shipped table; and none of the
     * SEVEN names authored in this file has drifted from js/config.js.
     *
     * WHAT `ok` DELIBERATELY DOES NOT GATE, and why. `loreNameDrift` is the
     * set of ids where LORE.maps and js/config.js spell the same board
     * differently. MEASURED at lore 0.5.0: two of them, `confluence` (lore
     * "CONFLUENCE", game "THE CONFLUENCE") and `carousel` (lore "CAROUSEL",
     * game "THE CAROUSEL"). That is a real disagreement between two upstream
     * tables, neither of which this module owns or may edit, and it is
     * already handled at render time because map() prints the game's
     * spelling. Gating on it would make a correct file fail its own probe,
     * which is how a gate teaches people to ignore it. It is REPORTED so a
     * lore regeneration can close it, and not counted against `ok`.
     *
     * A probe should assert on `ok`. When it is false, `missing`,
     * `incomplete`, `authoredNameDrift` and `manifestDrift` say which ids and
     * why, so the failure is actionable without opening the file.
     */
    selfCheck: function () {
      var L = lore();
      var live = liveMaps();
      var expected = live ? live.map(function (m) { return m.id; }) : MAP_MANIFEST.slice();

      var missing = [], incomplete = [], authoredNameDrift = [], loreNameDrift = [];
      for (var i = 0; i < expected.length; i++) {
        var id = expected[i];
        var rec = this.map(id);
        if (!rec) { missing.push(id); continue; }
        if (!nonEmpty(rec.name) || !nonEmpty(rec.classification) ||
            !nonEmpty(rec.functionThen) || !nonEmpty(rec.conflictNow)) incomplete.push(id);
      }

      /* The manifest is only trustworthy while it matches the shipped table.
         Compared in both directions so an added board and a removed board are
         both visible. */
      var manifestDrift = [];
      if (live) {
        var liveIds = live.map(function (m) { return m.id; });
        for (var a = 0; a < liveIds.length; a++)
          if (MAP_MANIFEST.indexOf(liveIds[a]) < 0) manifestDrift.push('+' + liveIds[a]);
        for (var b = 0; b < MAP_MANIFEST.length; b++)
          if (liveIds.indexOf(MAP_MANIFEST[b]) < 0) manifestDrift.push('-' + MAP_MANIFEST[b]);

        /* NAME DRIFT, split by who owns the name. Compared case
           insensitively, because a future editor changing THE SPINE to The
           Spine has not renamed the board. Sorted into two buckets:
           `authoredNameDrift` is the seven this file wrote and therefore a
           defect in this file; `loreNameDrift` is a disagreement between
           LORE.maps and js/config.js that only a lore regeneration can
           settle. */
        for (var c = 0; c < live.length; c++) {
          var m = live[c];
          if (!m || !m.name) continue;
          var r = this.map(m.id);
          if (!r || !nonEmpty(r.loreName)) continue;
          if (String(r.loreName).toLowerCase() === String(m.name).toLowerCase()) continue;
          var note = m.id + ': record "' + r.loreName + '" vs game "' + m.name + '"';
          if (r.source === 'authored') authoredNameDrift.push(note);
          else loreNameDrift.push(note);
        }
      }

      /* A SELF-CHECK THAT CANNOT FAIL HAS PROVED NOTHING. Measured: loaded
         without js/config.js, so with no MAPS table at all, this returned
         ok:true checked:28 mapsLoaded:false. Every comparison above that
         needs the live table sits inside `if (live)`, so with MAPS absent
         the drift arrays are trivially empty and `ok` went green against
         nothing. The manifest is this file's own copy of the board list, so
         checking the manifest against itself is not evidence.

         `ok` now REQUIRES the live table to have been present. A caller that
         genuinely wants the offline answer reads the fields, which still
         report exactly what was and was not checked. */
      return {
        ok: !!live && missing.length === 0 && incomplete.length === 0 &&
            authoredNameDrift.length === 0 && manifestDrift.length === 0,
        loreLoaded: !!L,
        mapsLoaded: !!live,
        checked: expected.length,
        resolved: expected.length - missing.length,
        missing: missing,
        incomplete: incomplete,
        authoredNameDrift: authoredNameDrift,
        loreNameDrift: loreNameDrift,
        manifestDrift: manifestDrift
      };
    },

    /** Every board id this module can answer for, sorted. Small convenience
        for a probe that wants to iterate rather than assert. */
    mapIds: function () {
      var L = lore();
      var seen = {};
      var out = [];
      var push = function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } };
      Object.keys(AUTHORED_MAPS).forEach(push);
      if (L && L.maps) Object.keys(L.maps).forEach(push);
      return out.sort();
    }
  };

  global.WorldLore = WorldLore;

})(typeof globalThis !== 'undefined' ? globalThis
   : typeof window !== 'undefined' ? window : this);
