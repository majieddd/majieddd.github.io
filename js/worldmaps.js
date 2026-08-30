/* worldmaps.js. THE HANDCRAFTED CAMPAIGN GROUNDS.
 *
 * Owner directive, Session 44 (docs/WORLDMAPS-DESIGN.md): every campaign
 * planet gets a board built for it by hand, grounded in the body's real
 * physical character, and the campaign stops rolling boards from the pool.
 * Procedural generation is not retired: it becomes the ground of a future
 * post-campaign mode, and this file is its design corpus, each board a
 * worked example of what its terrain class means when a person builds it on
 * purpose.
 *
 * THE TERRAIN CODEX. Every board carries `terra`, the meta-categorisation
 * the owner asked for, SEPARATE from the stat track (rosters, nodes, tiers):
 * what the ground IS (class), how the lane moves (flow), how dense the
 * obstacles are (cover), which obstacle kinds appear (barriers), what a
 * tower can expect to see (sight), and the real physical trait the board is
 * built from (basis, prose). The first five are closed vocabularies,
 * TERRA_VOCAB below, and tools/probe-worldmaps.js holds every board to
 * them. Future procedural families should be designed by picking a row of
 * this codex and studying the hand-built examples that carry it.
 *
 * GEOMETRY CONTRACT (same as every authored map in config.js MAPS):
 * half-width authoring. Lanes start at x = cols/2 - 1 (touching the mirror
 * axis), end at x = -1 (the base, off-grid); segments are axis-aligned;
 * cols are EVEN so the axis falls between columns. blocks/walls/nodes are
 * authored in the LEFT half and mirrored by buildField. A wall under a lane
 * tile is a soft-lock and never legal; blocks may overlap lanes. A node
 * authored on blocked ground is silently dropped by buildField, so the
 * probe asserts every authored node survives.
 *
 * ASSIGNMENT. Worlds are keyed by PLANET NAME (index-derived, stable across
 * seeds): WORLD_MAP_BY_NAME below. galaxy.js overrides the drawn map AFTER
 * the draw, the same pattern the contested block has always used, so the
 * PRNG stream does not move (pinned by tools/fixtures/galaxy-stream-pin.json).
 * The `world` field doubles as the pool-exclusion flag: these boards never
 * enter a random pool. Contested worlds keep the shared tri boards, because
 * contested slots are player-relative and a planet cannot own a tri board
 * without owning two boards; per-planet tri variants are an owner call
 * (tracker item 12).
 */

const TERRA_VOCAB = Object.freeze({
  class: ['grid', 'crater', 'canyon', 'dome', 'band', 'archipelago', 'ring',
          'field', 'terrace', 'maze', 'channel', 'corridor', 'plaza', 'weave', 'forge'],
  flow: ['serpentine', 'switchback', 'spiral', 'straight', 'braid', 'ring-arc',
         'convergent', 'split', 'staircase', 'weave'],
  cover: ['open', 'scattered', 'pocketed', 'walled', 'mazed'],
  barriers: ['none', 'blocks', 'walls', 'mixed'],
  sight: ['long', 'broken', 'blind']
});

const WORLD_MAPS = [

  /* ══════════════════════════════════════════ THE EARTH SYSTEM ═══
     Humanity's ground and everyone's first act somewhere: the most
     readable boards in the theatre, difficulty carried by the waves. */

  {
    id: 'w_earth', world: 'EARTH', name: 'THE HARBOUR DISTRICT', adj: 'Fallen',
    terra: { class: 'grid', flow: 'switchback', cover: 'scattered', barriers: 'blocks', sight: 'long',
      basis: 'A coastal city under the fall. Streets keep their grid even after the fragments came down through it, and rubble does not stop a shot, only a foundation.' },
    blurb: 'The streets still run at right angles; the fragments only bent what they landed on. Corners are the whole game: every block you own watches two legs of somebody else’s march.',
    trait: 'Street grid · fragment rubble',
    denizens: ['crawler', 'wisp'],
    sigNote: 'First ground. Pickets walk the streets and Lanterns fly over them.',
    roster: ['crawler', 'sprinter', 'mite', 'wisp', 'aegis', 'cluster', 'shardling', 'herald'],
    cols: 28, rows: 15,
    lanes: [[[13, 7], [11, 7], [11, 2], [7, 2], [7, 12], [3, 12], [3, 7], [-1, 7]]],
    /* Fallen fragments, not planning: each rubble field sits INSIDE a city
       block so the streets stay legal, and none of them stops a shot. */
    blocks: [[5, 4, 6, 5], [9, 9, 10, 10], [1, 2, 2, 3], [5, 9, 5, 10], [12, 12, 13, 13], [0, 0, 1, 0]],
    /* Kinetic on the industrial block: EARTH's answer is industry, not
       magic. The fire lane node is the harbour burning, and it sits on the
       long south leg where splash pays most. */
    nodes: [[9, 5, 'kinetic', 'build'], [12, 10, 'radiant', 'build'], [5, 12, 'fire', 'lane']]
  },

  {
    id: 'w_luna', world: 'LUNA', name: 'THE FAR SIDE', adj: 'Airless',
    terra: { class: 'crater', flow: 'serpentine', cover: 'pocketed', barriers: 'blocks', sight: 'long',
      basis: 'No atmosphere: nothing scatters light and nothing stops a round. Crater rims are the only cover on the Moon, and they are cover for FOUNDATIONS, not lines of fire.' },
    blurb: 'The occupiers were always on the far side. Rim after rim breaks the ground into pockets, and every pocket sees a different bend of the road, all the way to the horizon.',
    trait: 'Crater pockets · nothing blocks a shot',
    denizens: ['blink', 'warden'],
    sigNote: 'Farside garrison: Displacers skip the bends and Wardens hold the rims.',
    roster: ['sprinter', 'mite', 'wisp', 'shardling', 'blink', 'aegis', 'bulwark', 'warden'],
    cols: 28, rows: 15,
    lanes: [[[13, 4], [9, 4], [9, 11], [5, 11], [5, 4], [2, 4], [2, 8], [-1, 8]]],
    /* Rim arcs, drawn as broken rectangles: the pockets BETWEEN them are the
       build sites, and no pocket covers two bends. */
    blocks: [[6, 6, 8, 6], [6, 7, 6, 8], [10, 8, 11, 9], [2, 1, 4, 2], [0, 11, 1, 12], [11, 1, 12, 2], [3, 13, 4, 14]],
    /* Void for the far side that never sees Earth; radiant for the sun with
       no sky in the way. The frost lane node is the cold that never lifts. */
    nodes: [[7, 9, 'void', 'build'], [11, 6, 'radiant', 'build'], [5, 7, 'frost', 'lane']]
  },

  {
    id: 'w_mars', world: 'MARS', name: 'THE GREAT RIFT', adj: 'Incised',
    terra: { class: 'canyon', flow: 'switchback', cover: 'walled', barriers: 'walls', sight: 'blind',
      basis: 'Valles Marineris: a rift that would run New York to Los Angeles, four times deeper than the Grand Canyon. The walls are REAL walls; nothing flat-trajectory crosses a mesa.' },
    blurb: 'The road switchbacks down the rift floor and the mesas between the legs stop everything but a shell with the sense to arc. Whoever brings lobbed fire owns three legs at once; everyone else owns one.',
    trait: 'Canyon walls · lobbed fire pays triple',
    denizens: ['basalt', 'anchorite'],
    sigNote: 'Rift column: Basalt Marchers shrug the slows and Anchorites dig into the alcoves.',
    roster: ['crawler', 'basalt', 'bulwark', 'shardling', 'anchorite', 'jammer', 'warchief', 'juggernaut'],
    cols: 26, rows: 15,
    lanes: [[[12, 2], [3, 2], [3, 6], [10, 6], [10, 10], [2, 10], [2, 13], [-1, 13]]],
    /* The mesas: two long cliff walls between the legs. Direct fire placed
       on one leg cannot see the next; the alcove shelves at the ends can. */
    walls: [[5, 4, 11, 4], [0, 8, 8, 8]],
    blocks: [[0, 0, 1, 1], [12, 12, 12, 14], [5, 12, 6, 12]],
    /* Fire for the iron ground, storm for the dust that eats the sky. The
       venom lane node sits on the long low leg where the marchers bunch. */
    nodes: [[6, 3, 'fire', 'build'], [7, 9, 'storm', 'build'], [6, 10, 'venom', 'lane']]
  },

  {
    id: 'w_venus', world: 'VENUS', name: 'THE PRESSURE GARDENS', adj: 'Crushing',
    terra: { class: 'dome', flow: 'serpentine', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'Ninety atmospheres and lead-melting heat: nothing lives outside a shell. The dome walls survived their builders, and they still stop a shot the way they stopped the sky.' },
    blurb: 'The road threads between dead pressure domes. Every shell breaks somebody’s line of fire, and the lanes of sight left over are short, bent and worth fighting for.',
    trait: 'Dome shells · short bent sightlines',
    denizens: ['mender', 'bastion'],
    sigNote: 'Shell tenders: Restorers keep the column sealed and Bastions carry the doors.',
    roster: ['crawler', 'wisp', 'mender', 'aegis', 'nullifier', 'herald', 'bastion', 'carrier'],
    cols: 26, rows: 15,
    lanes: [[[12, 7], [9, 7], [9, 3], [5, 3], [5, 11], [2, 11], [2, 7], [-1, 7]]],
    /* Dome shells: short wall arcs, never on the road. Each one shields one
       pocket and blinds another; there is no tile that sees everything. */
    walls: [[7, 1, 8, 1], [7, 2, 7, 2], [3, 4, 3, 5], [4, 4, 4, 4], [7, 9, 8, 9], [8, 10, 8, 10], [0, 13, 1, 13]],
    blocks: [[0, 0, 2, 1], [11, 12, 12, 14]],
    /* Venom for the acid decks, fire for the ground that is already burning.
       Frost on the lane is the one cold coin on the hottest world. */
    nodes: [[6, 6, 'venom', 'build'], [10, 10, 'fire', 'build'], [5, 9, 'frost', 'lane']]
  },

  {
    id: 'w_mercury', world: 'MERCURY', name: 'THE TERMINATOR LINE', adj: 'Scorched',
    terra: { class: 'band', flow: 'straight', cover: 'open', barriers: 'blocks', sight: 'long',
      basis: 'Mercury barely turns: one side glows, one side freezes, and the only survivable ground is the moving line between them. Everything else is dead to foundations forever.' },
    blurb: 'The whole battle lives in a strip nine tiles tall. The day side and the night side take everything else, the road barely bends, and there is nowhere to stand behind anything.',
    trait: 'One thin band · nowhere to hide',
    denizens: ['sprinter', 'wraith'],
    sigNote: 'Line runners: Outrunners and Veilwraiths sprint the strip before the line moves.',
    roster: ['sprinter', 'blink', 'wraith', 'mite', 'shardling', 'warden', 'herald', 'juggernaut'],
    cols: 34, rows: 11,
    lanes: [[[16, 5], [10, 5], [10, 4], [5, 4], [5, 6], [-1, 6]]],
    /* The two dead sides, full-width strips; the scarps are the only cover
       the band itself offers, and they are foundations-only rubble. */
    blocks: [[0, 0, 16, 1], [0, 9, 16, 10], [8, 7, 9, 7], [12, 2, 13, 2]],
    /* Radiant for the day side, frost for the night side, fire on the lane
       for the ground the sun has already claimed. */
    nodes: [[13, 3, 'radiant', 'build'], [7, 8, 'frost', 'build'], [8, 4, 'fire', 'lane']]
  },

  {
    id: 'w_jupiter', world: 'JUPITER', name: 'THE CLOUD DECKS', adj: 'Stormed',
    terra: { class: 'archipelago', flow: 'split', cover: 'pocketed', barriers: 'blocks', sight: 'long',
      basis: 'There is no ground: only platforms riding the cloud tops of a storm three Earths wide. What falls between the decks does not land anywhere.' },
    blurb: 'Two roads ride separate decks and only meet at your door. Between the platforms is sky all the way down, and the sky is already full of things that do not need a road.',
    trait: 'Two decks · the gap goes all the way down',
    denizens: ['wisp', 'carrier'],
    sigNote: 'Storm traffic: Lanterns cross the void and Carriers ferry what cannot.',
    roster: ['wisp', 'mite', 'sprinter', 'cluster', 'aegis', 'carrier', 'herald', 'warchief'],
    cols: 30, rows: 17,
    lanes: [
      [[14, 4], [9, 4], [9, 8], [4, 8], [4, 5], [-1, 5]],
      [[14, 12], [11, 12], [11, 14], [6, 14], [6, 10], [2, 10], [2, 5], [-1, 5]]
    ],
    /* The void between decks: big drops nothing builds on, arranged so each
       road has its own pockets and only the last approach serves both. */
    blocks: [[6, 1, 11, 2], [1, 1, 3, 3], [12, 6, 13, 7], [7, 11, 8, 12], [0, 13, 2, 15], [13, 15, 14, 16], [6, 6, 7, 6]],
    /* Storm for the storm; void for the fall. The radiant lane node is a
       break in the cloud deck, on the north road where flyers cross. */
    nodes: [[7, 7, 'storm', 'build'], [8, 13, 'void', 'build'], [9, 6, 'radiant', 'lane']]
  },

  {
    id: 'w_saturn', world: 'SATURN', name: 'THE SHEPHERD RING', adj: 'Ringed',
    terra: { class: 'ring', flow: 'ring-arc', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'The rings are a debris field a kilometre thin and a planet wide, kept in shape by shepherd moons. The act ends here: the door under Saturn is a real door, and it has one gap.' },
    blurb: 'The road runs three-quarters of a ring around the core and then goes IN. The core wall has exactly one gap, the traffic out here already ends at Saturn, and both facts are the same fact.',
    trait: 'Ring arc · one door in the core wall',
    denizens: ['revenant', 'juggernaut'],
    sigNote: 'The seat garrison: Reconstructors rebuild the fallen and Ironmarches hold the door.',
    roster: ['crawler', 'wisp', 'aegis', 'revenant', 'warden', 'bastion', 'carrier', 'juggernaut'],
    cols: 30, rows: 17,
    lanes: [[[14, 3], [3, 3], [3, 13], [11, 13], [11, 8], [-1, 8]]],
    /* The core: walled on every face, and each flank wall is split at y8 so
       the road passes through exactly one gap per face: the door under
       Saturn, in and out. */
    walls: [[5, 6, 9, 6], [5, 10, 9, 10], [5, 7, 5, 7], [5, 9, 5, 9], [9, 7, 9, 7], [9, 9, 9, 9]],
    /* Ring shards drift outside the arc; the corners are ring-plane debris. */
    blocks: [[13, 5, 13, 6], [12, 15, 14, 16], [0, 0, 1, 0], [1, 15, 1, 16], [13, 0, 14, 1]],
    /* Frost for the ice the rings are made of, radiant for the ring-light.
       The void lane node sits at the west bend, the last look before the
       door. */
    nodes: [[7, 4, 'frost', 'build'], [12, 11, 'radiant', 'build'], [3, 8, 'void', 'lane']]
  },

  /* ═══════════════════════════════════════════════ THE PLEIADES ═══
     The Federation's nebula: young hot stars still wrapped in the cloud
     they were born from. Light is the terrain here. */

  {
    id: 'w_maia', world: 'MAIA', name: 'THE LIGHT PLAIN', adj: 'Radiant',
    terra: { class: 'field', flow: 'straight', cover: 'open', barriers: 'blocks', sight: 'long',
      basis: 'Maia sits inside the reflection nebula: the whole sky glows with scattered starlight and there is no night. A plain with nothing on it but the shine.' },
    blurb: 'The widest ground in the theatre and almost nothing on it. The road barely bends, the light never ends, and a line that cannot cover width does not survive here.',
    trait: 'Open plain · spread or break',
    denizens: ['wisp', 'herald'],
    sigNote: 'Plain traffic: Lanterns cross anywhere and Heralds announce everything.',
    roster: ['sprinter', 'wisp', 'mite', 'crawler', 'herald', 'aegis', 'warden', 'carrier'],
    cols: 36, rows: 17,
    lanes: [[[17, 8], [10, 8], [10, 9], [4, 9], [4, 7], [-1, 7]]],
    /* Two dust wisps. That is the whole cover budget, on purpose. */
    blocks: [[6, 3, 7, 3], [12, 13, 13, 13]],
    /* Radiant for the sky that never darkens, void for the space behind it.
       The storm lane node is the one ionised current crossing the plain. */
    nodes: [[9, 4, 'radiant', 'build'], [8, 13, 'void', 'build'], [7, 9, 'storm', 'lane']]
  },

  {
    id: 'w_electra', world: 'ELECTRA', name: 'THE SHRINE TERRACES', adj: 'Stepped',
    terra: { class: 'terrace', flow: 'staircase', cover: 'pocketed', barriers: 'blocks', sight: 'broken',
      basis: 'Electra is a subgiant already swelling off the main sequence: the Federation builds its terraces on ground that is itself descending, step after step.' },
    blurb: 'The road only ever steps down and left, and the shrines only shelter the downhill side. Whoever holds the high pockets fires over everything below and answers to nothing above.',
    trait: 'Descending steps · cover on one side',
    denizens: ['aegis', 'anchorite'],
    sigNote: 'Terrace keepers: Aegis Sentinels shield the steps and Anchorites will not leave them.',
    roster: ['crawler', 'shardling', 'aegis', 'mender', 'herald', 'anchorite', 'bastion', 'warchief'],
    cols: 28, rows: 17,
    lanes: [[[13, 2], [10, 2], [10, 5], [7, 5], [7, 8], [4, 8], [4, 11], [1, 11], [1, 14], [-1, 14]]],
    /* Every shrine sits BELOW its step: the uphill face of each leg is bare. */
    blocks: [[11, 3, 12, 4], [8, 6, 9, 7], [5, 9, 6, 10], [2, 12, 3, 13], [0, 0, 1, 1]],
    /* Radiant on the high terrace, frost at the cold bottom of the stair.
       The venom lane node marks the one step the gardens have overgrown. */
    nodes: [[12, 6, 'radiant', 'build'], [6, 12, 'frost', 'build'], [7, 6, 'venom', 'lane']]
  },

  {
    id: 'w_taygeta', world: 'TAYGETA', name: 'THE CHORAL HALLS', adj: 'Sung',
    terra: { class: 'plaza', flow: 'split', cover: 'pocketed', barriers: 'blocks', sight: 'broken',
      basis: 'Taygeta is a spectroscopic binary: two voices in one point of light. The halls are built as a pair, and nothing that happens in one carries to the other.' },
    blurb: 'Two halls, one voice each, and a bank between them no tower shoots across. The processions walk both halls at once and only meet at your door.',
    trait: 'Two halls · one door',
    denizens: ['mender', 'nullifier'],
    sigNote: 'Hall wardens: Restorers keep the song going and Nullifiers keep it quiet.',
    roster: ['crawler', 'wisp', 'mender', 'herald', 'revenant', 'aegis', 'nullifier', 'carrier'],
    cols: 28, rows: 17,
    lanes: [
      [[13, 4], [8, 4], [8, 2], [3, 2], [3, 8], [-1, 8]],
      [[13, 12], [8, 12], [8, 14], [3, 14], [3, 8], [-1, 8]]
    ],
    /* The bank: the two halls cannot cover each other, by construction. */
    blocks: [[5, 7, 10, 9], [12, 0, 13, 0], [12, 16, 13, 16], [0, 0, 0, 1], [0, 15, 0, 16]],
    /* Radiant in the north hall, void in the south, and the frost lane node
       on the south procession where the cold verse is sung. */
    nodes: [[6, 4, 'radiant', 'build'], [6, 12, 'void', 'build'], [8, 13, 'frost', 'lane']]
  },

  {
    id: 'w_merope', world: 'MEROPE', name: 'THE DUST WAKE', adj: 'Veiled',
    terra: { class: 'weave', flow: 'braid', cover: 'scattered', barriers: 'blocks', sight: 'broken',
      basis: 'The Merope nebula is the dust the cluster is currently ploughing through: a wake, not a home. Two currents cross in it, and the crossings are where everything happens.' },
    blurb: 'Two roads braid through the dust and cross twice. A tower at a crossing works both roads for the price of one; a tower anywhere else works half a road.',
    trait: 'Braided roads · pay for the crossings',
    denizens: ['blink', 'jammer'],
    sigNote: 'Wake runners: Displacers skip between currents and Jammers blind the hubs.',
    roster: ['sprinter', 'blink', 'wraith', 'mite', 'cluster', 'jammer', 'herald', 'warchief'],
    cols: 30, rows: 15,
    lanes: [
      [[14, 4], [10, 4], [10, 10], [6, 10], [6, 4], [2, 4], [2, 7], [-1, 7]],
      [[14, 10], [12, 10], [12, 6], [8, 6], [8, 12], [4, 12], [4, 7], [-1, 7]]
    ],
    /* Dust banks drift where nobody is standing; the crossings stay clear. */
    blocks: [[5, 2, 6, 2], [11, 12, 12, 13], [1, 10, 2, 11], [13, 2, 13, 3], [7, 8, 7, 8]],
    /* Storm for the charge the dust carries, radiant for the shine behind
       it. The void lane node sits ON the first crossing, the hub of hubs. */
    nodes: [[11, 8, 'storm', 'build'], [5, 5, 'radiant', 'build'], [10, 6, 'void', 'lane']]
  },

  {
    id: 'w_celaeno', world: 'CELAENO', name: 'THE ARCHIVE VAULTS', adj: 'Shelved',
    terra: { class: 'maze', flow: 'serpentine', cover: 'mazed', barriers: 'mixed', sight: 'blind',
      basis: 'Celaeno is the faint sister, the one catalogues kept losing. The Federation keeps its records here, in stacks tall enough to stop a shot and dense enough to lose a war in.' },
    blurb: 'The stacks stop shots and the road winds between them. Nothing sees far, corners are everything, and what you cannot see can already see you.',
    trait: 'Record stacks · blind corners',
    denizens: ['wraith', 'nullifier'],
    sigNote: 'Vault silence: Veilwraiths read in the dark and Nullifiers enforce the quiet.',
    roster: ['crawler', 'shardling', 'jammer', 'wraith', 'nullifier', 'warden', 'bastion', 'anchorite'],
    cols: 26, rows: 15,
    lanes: [[[12, 2], [9, 2], [9, 6], [5, 6], [5, 10], [9, 10], [9, 13], [2, 13], [2, 9], [-1, 9]]],
    /* The stacks: wall rows with one gap each, never over the road. */
    walls: [[3, 3, 3, 4], [7, 4, 8, 4], [10, 4, 11, 4], [3, 8, 4, 8], [6, 8, 7, 8],
            [11, 8, 11, 9], [5, 12, 5, 12], [0, 6, 1, 6]],
    blocks: [[0, 0, 1, 1], [11, 11, 12, 12]],
    /* Void for what the archive will not say, frost for the climate control
       that outlived the archivists. Radiant on the south run: one skylight. */
    nodes: [[11, 6, 'void', 'build'], [3, 11, 'frost', 'build'], [7, 13, 'radiant', 'lane']]
  },

  {
    id: 'w_sterope', world: 'STEROPE', name: 'THE LIGHTNING NURSERIES', adj: 'Charged',
    terra: { class: 'corridor', flow: 'straight', cover: 'walled', barriers: 'walls', sight: 'broken',
      basis: 'Sterope, the lightning: the nurseries breed storm cells between insulated posts, and the posts are the only things on the floor that do not conduct.' },
    blurb: 'One long run with insulator posts staggered beside it. Each post blinds one short stretch of road and shields one tower; pick which side of the post you live on.',
    trait: 'One run · staggered posts',
    denizens: ['aegis', 'herald'],
    sigNote: 'Nursery watch: Aegis Sentinels ground the arcs and Heralds call the strikes.',
    roster: ['sprinter', 'mite', 'crawler', 'shardling', 'aegis', 'herald', 'warden', 'juggernaut'],
    cols: 32, rows: 13,
    lanes: [[[15, 6], [9, 6], [9, 5], [4, 5], [4, 7], [-1, 7]]],
    /* The posts, one tile each, alternating sides of the run; the rails at
       the mirror end are the cage the newest cells are grown in. */
    walls: [[13, 4, 13, 4], [11, 8, 11, 8], [8, 3, 8, 3], [6, 8, 6, 8], [3, 3, 3, 3], [2, 9, 2, 9],
            [14, 8, 15, 8], [14, 2, 15, 2]],
    blocks: [[0, 0, 1, 1], [0, 11, 1, 12]],
    /* Storm twice over, because this world IS the storm: one to build beside,
       one on the lane where the cells discharge. Kinetic for the insulators. */
    nodes: [[10, 3, 'storm', 'build'], [5, 10, 'kinetic', 'build'], [7, 5, 'storm', 'lane']]
  },

  {
    id: 'w_alcyone', world: 'ALCYONE', name: 'THE ANCHOR SANCTUM', adj: 'Anchored',
    terra: { class: 'plaza', flow: 'ring-arc', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'Alcyone is the central sun of the Pleiades, the anchor the sisters turn on. The seat of the Federation is a sanctum whose plaza watches every approach at once.' },
    blurb: 'Three legs wrap the sanctum plaza and the plaza answers all three. The act ends here: whoever holds the middle holds the argument.',
    trait: 'One plaza · every road answers to it',
    denizens: ['revenant', 'bastion'],
    sigNote: 'The seat garrison: Reconstructors return and Bastions simply remain.',
    roster: ['crawler', 'wisp', 'aegis', 'mender', 'herald', 'revenant', 'bastion', 'juggernaut'],
    cols: 30, rows: 17,
    lanes: [[[14, 2], [3, 2], [3, 12], [9, 12], [9, 8], [-1, 8]]],
    /* Sanctum screens east of the plaza and the choir wall on the south rim;
       the plaza itself (the middle ground) stays open on purpose. */
    walls: [[11, 4, 11, 6], [11, 10, 11, 11], [6, 15, 9, 15], [0, 0, 0, 1]],
    blocks: [[13, 7, 13, 9], [1, 14, 2, 15]],
    /* Radiant at the plaza's heart and again on the exit road: the anchor
       light, twice. Storm for the weather the sisters send. */
    nodes: [[6, 6, 'radiant', 'build'], [12, 13, 'storm', 'build'], [5, 8, 'radiant', 'lane']]
  },

  /* ═══════════════════════════════════════════════ ZETA RETICULI ═══
     The Xeno compact's twin suns: harvest ground, client ground, and the
     ledger that binds them. Everything here is organic and accounted for. */

  {
    id: 'w_z1b', world: 'ZETA-1 b', name: 'THE TITHER FIELDS', adj: 'Harvested',
    terra: { class: 'field', flow: 'serpentine', cover: 'scattered', barriers: 'blocks', sight: 'long',
      basis: 'The first world of the first sun grows the tithe. Crop ranks run in strips wider than roads, planted in ground too soft to found a tower on.' },
    blurb: 'The road winds through the harvest ranks. The strips are cover only in the sense that nothing grows back where you build, and the compact counts every tile you take.',
    trait: 'Harvest ranks · soft ground',
    denizens: ['cluster', 'mender'],
    sigNote: 'Field crews: Dividers seed the rows and Restorers keep the yield walking.',
    roster: ['crawler', 'mite', 'cluster', 'spawnling', 'mender', 'shardling', 'herald', 'carrier'],
    cols: 30, rows: 15,
    lanes: [[[14, 3], [8, 3], [8, 7], [12, 7], [12, 11], [4, 11], [4, 6], [-1, 6]]],
    /* The ranks: long strips, unbuildable, transparent, exactly like crops. */
    blocks: [[6, 1, 11, 1], [1, 4, 6, 4], [10, 9, 11, 9], [13, 9, 13, 9], [1, 13, 6, 13], [2, 8, 3, 8]],
    /* Venom for the tithe biology, kinetic for the machinery that takes it.
       The frost lane node is the cold store at the collection row. */
    nodes: [[8, 9, 'venom', 'build'], [2, 2, 'kinetic', 'build'], [6, 11, 'frost', 'lane']]
  },

  {
    id: 'w_z1c', world: 'ZETA-1 c', name: 'THE GULLET', adj: 'Swallowed',
    terra: { class: 'channel', flow: 'switchback', cover: 'pocketed', barriers: 'mixed', sight: 'blind',
      basis: 'A client world hollowed into a feeding channel: the road IS a digestive tract, and the ribs between its folds are load-bearing in a sense nobody enjoys explaining.' },
    blurb: 'The road folds back on itself four times inside one throat. The ribs stop shots between folds, the pockets hold two towers each, and everything gets swallowed eventually.',
    trait: 'Folded throat · rib-blind folds',
    denizens: ['cluster', 'bulwark'],
    sigNote: 'Tract fauna: Dividers multiply in the folds and Palisades seal them.',
    roster: ['crawler', 'cluster', 'spawnling', 'basalt', 'bulwark', 'jammer', 'warchief', 'anchorite'],
    cols: 24, rows: 17,
    lanes: [[[11, 2], [4, 2], [4, 5], [9, 5], [9, 8], [4, 8], [4, 11], [9, 11], [9, 14], [2, 14], [-1, 14]]],
    /* The ribs: one wall pair between every fold. */
    walls: [[6, 3, 7, 3], [6, 6, 7, 6], [6, 9, 7, 9], [6, 12, 7, 12]],
    blocks: [[0, 0, 1, 3], [11, 4, 11, 4], [0, 6, 1, 7], [11, 9, 11, 10], [0, 12, 0, 13]],
    /* Venom for the obvious reason, storm for the nerve that still fires.
       The fire lane node is the acid bath at the bottom of the throat. */
    nodes: [[2, 9, 'venom', 'build'], [10, 12, 'storm', 'build'], [6, 14, 'fire', 'lane']]
  },

  {
    id: 'w_z1d', world: 'ZETA-1 d', name: 'THE SPORE SHOALS', adj: 'Blooming',
    terra: { class: 'archipelago', flow: 'split', cover: 'pocketed', barriers: 'blocks', sight: 'long',
      basis: 'The outer world of the first sun blooms in season, and the season never ends. Firm ground comes in shoals; everything between them is bloom too deep to found.' },
    blurb: 'Two roads pick their way between the blooms and share the last stretch home. The shoals hold two or three towers each, and no shoal covers both roads.',
    trait: 'Two roads · firm ground in shoals',
    denizens: ['spawnling', 'carrier'],
    sigNote: 'Bloom traffic: Fragments drift out of season and Carriers ferry the crop.',
    roster: ['mite', 'spawnling', 'cluster', 'wisp', 'mender', 'nullifier', 'carrier', 'herald'],
    cols: 28, rows: 15,
    lanes: [
      [[13, 3], [8, 3], [8, 6], [3, 6], [3, 9], [-1, 9]],
      [[13, 11], [10, 11], [10, 13], [5, 13], [5, 9], [-1, 9]]
    ],
    /* The blooms: soft masses between the shoals. */
    blocks: [[5, 1, 7, 2], [11, 7, 12, 8], [1, 3, 2, 4], [8, 9, 8, 10], [1, 12, 2, 12], [12, 1, 12, 2]],
    /* Venom for the bloom, void for what seeded it. The storm lane node
       rides the south road where the drift is thickest. */
    nodes: [[6, 8, 'venom', 'build'], [11, 5, 'void', 'build'], [7, 13, 'storm', 'lane']]
  },

  {
    id: 'w_z2b', world: 'ZETA-2 b', name: 'THE HIVE GALLERY', adj: 'Combed',
    terra: { class: 'corridor', flow: 'switchback', cover: 'pocketed', barriers: 'blocks', sight: 'broken',
      basis: 'The first world of the second sun is comb all the way down: one gallery corridor with cells budding off it, each cell exactly one purpose wide.' },
    blurb: 'One corridor, and the comb walls split the ground beside it into cells. Each cell watches one stretch of gallery and no cell helps another.',
    trait: 'Gallery cells · no cell helps another',
    denizens: ['jammer', 'anchorite'],
    sigNote: 'Comb keepers: Jammers dim the gallery and Anchorites refuse to leave their cells.',
    roster: ['crawler', 'cluster', 'bulwark', 'aegis', 'jammer', 'anchorite', 'bastion', 'warchief'],
    cols: 26, rows: 15,
    lanes: [[[12, 8], [8, 8], [8, 4], [4, 4], [4, 10], [-1, 10]]],
    /* The comb: two block columns cut the west ground into cells. */
    blocks: [[6, 0, 6, 3], [6, 5, 6, 9], [2, 12, 3, 12], [10, 10, 11, 11], [0, 0, 1, 2]],
    /* Venom for the comb, frost for the cold cells at the back. The storm
       lane node hums at the gallery mouth. */
    nodes: [[10, 6, 'venom', 'build'], [1, 7, 'frost', 'build'], [3, 10, 'storm', 'lane']]
  },

  {
    id: 'w_z2c', world: 'ZETA-2 c', name: 'THE BIRTHING POOLS', adj: 'Brooding',
    terra: { class: 'channel', flow: 'split', cover: 'scattered', barriers: 'blocks', sight: 'long',
      basis: 'Twin channels drain the pools on either side of a brood bank. The bank is nursery ground: nothing builds on it, and the compact would like you to know it noticed you trying.' },
    blurb: 'Two channels around one bank, joining at your gate. The bank splits every field of fire in half, and what hatches in the pools arrives from both sides at once.',
    trait: 'Twin channels · the bank splits your fire',
    denizens: ['mender', 'cluster'],
    sigNote: 'Pool wardens: Restorers tend the brood and Dividers are the brood.',
    roster: ['mender', 'cluster', 'spawnling', 'mite', 'aegis', 'nullifier', 'carrier', 'bastion'],
    cols: 28, rows: 17,
    lanes: [
      [[13, 2], [9, 2], [9, 5], [4, 5], [4, 8], [-1, 8]],
      [[13, 14], [9, 14], [9, 11], [4, 11], [4, 8], [-1, 8]]
    ],
    /* The brood bank, and the pools scattered outside the channels. */
    blocks: [[6, 7, 11, 9], [1, 1, 2, 2], [1, 14, 2, 15], [12, 6, 12, 10]],
    /* Venom over the bank, fire for the warm south pool, each one row off
       its channel. The frost lane node chills the shared gate stretch where
       both channels join. */
    nodes: [[7, 4, 'venom', 'build'], [7, 12, 'fire', 'build'], [2, 8, 'frost', 'lane']]
  },

  {
    id: 'w_z2d', world: 'ZETA-2 d', name: 'THE LEDGER CHAMBER', adj: 'Accounted',
    terra: { class: 'maze', flow: 'serpentine', cover: 'mazed', barriers: 'mixed', sight: 'blind',
      basis: 'The chamber walls record what was taken and from whom, stacked floor to ceiling. The records are dense enough to stop a shot, which the compact considers a feature of good bookkeeping.' },
    blurb: 'The road winds the stacks of the account. Every wall is a page, every corner is blind, and the audit arrives on foot.',
    trait: 'Ledger stacks · the audit walks',
    denizens: ['nullifier', 'warden'],
    sigNote: 'Chamber staff: Nullifiers void the errors and Wardens keep the originals.',
    roster: ['shardling', 'jammer', 'wraith', 'nullifier', 'warden', 'revenant', 'bastion', 'juggernaut'],
    cols: 26, rows: 15,
    lanes: [[[12, 3], [7, 3], [7, 7], [10, 7], [10, 11], [3, 11], [3, 6], [-1, 6]]],
    /* The stacks. One gap per shelf row, never over the road. */
    walls: [[5, 1, 5, 4], [9, 5, 9, 5], [12, 8, 12, 10], [5, 8, 7, 8], [1, 3, 1, 4], [8, 13, 9, 13]],
    blocks: [[0, 0, 1, 0], [0, 13, 1, 14]],
    /* Void for what the ledger will not admit, kinetic for the filing
       machinery. The void lane node is the entry under review. */
    nodes: [[11, 5, 'void', 'build'], [1, 9, 'kinetic', 'build'], [5, 11, 'void', 'lane']]
  },

  {
    id: 'w_serpo', world: 'SERPO', name: 'THE EXCHANGE GROUND', adj: 'Ceremonial',
    terra: { class: 'corridor', flow: 'straight', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'Serpo is where the exchange happened: twelve went, and the ground remembers the protocol. One straight ceremonial road, and every gate on it opens exactly once.' },
    blurb: 'The seat of the compact is one straight road through three gate walls, each pierced only where the road passes. Every gate is a kill box, and the compact holds all three receipts.',
    trait: 'One road · three gates',
    denizens: ['nullifier', 'revenant'],
    sigNote: 'Protocol escort: Nullifiers clear the road and Reconstructors repeat the ceremony.',
    roster: ['crawler', 'wisp', 'aegis', 'nullifier', 'revenant', 'warden', 'bastion', 'juggernaut'],
    cols: 32, rows: 13,
    lanes: [[[15, 6], [3, 6], [3, 7], [-1, 7]]],
    /* Three gates, each a wall bar split at the road. */
    walls: [[12, 3, 12, 5], [12, 7, 12, 9], [8, 2, 8, 5], [8, 7, 8, 10], [4, 4, 4, 5], [4, 8, 4, 8]],
    blocks: [[0, 0, 1, 1], [14, 11, 15, 12], [0, 11, 1, 12]],
    /* Void for what was exchanged, radiant for the ceremony. The kinetic
       lane node marks the middle gate, where the receipts change hands. */
    nodes: [[10, 4, 'void', 'build'], [6, 9, 'radiant', 'build'], [9, 6, 'kinetic', 'lane']]
  },

  /* ═══════════════════════════════════════════ PROXIMA CENTAURI ═══
     The Free Captains' star: a red flare dwarf, the closest port to Sol,
     and every board a place freight actually moves through. */

  {
    id: 'w_proxd', world: 'PROXIMA d', name: 'THE SCORCH LINE', adj: 'Flared',
    terra: { class: 'band', flow: 'straight', cover: 'open', barriers: 'blocks', sight: 'long',
      basis: 'Proxima d hugs a flare star at a fraction of Mercury distance: the survivable band is thinner than Mercury ever was, and it moves when the star clears its throat.' },
    blurb: 'Mercury, but meaner. The band is thinner, the scars are fresher, and when the flare comes up there is nowhere on this board it does not reach.',
    trait: 'Thinner band · flare scars',
    denizens: ['wraith', 'herald'],
    sigNote: 'Scorch runners: Veilwraiths ride the dark minutes and Heralds call the flares.',
    roster: ['sprinter', 'wraith', 'blink', 'mite', 'shardling', 'herald', 'warden', 'juggernaut'],
    cols: 30, rows: 11,
    lanes: [[[14, 4], [8, 4], [8, 6], [3, 6], [3, 5], [-1, 5]]],
    /* The dead sides, and the scars the last flare left in the band. */
    blocks: [[0, 0, 14, 0], [0, 9, 14, 10], [5, 2, 6, 2], [10, 7, 11, 7], [1, 3, 1, 3]],
    /* Fire for the star, void for the dark side of the line. The radiant
       lane node is the one stretch the flare has already bleached. */
    nodes: [[11, 2, 'fire', 'build'], [6, 8, 'void', 'build'], [5, 6, 'radiant', 'lane']]
  },

  {
    id: 'w_proxb', world: 'PROXIMA b', name: 'THE FIRST PORT', adj: 'Docked',
    terra: { class: 'grid', flow: 'switchback', cover: 'scattered', barriers: 'mixed', sight: 'broken',
      basis: 'Proxima b is real, roughly Earth-mass, and the first port out of Sol. The capital of the Free Captains is docks all the way down: cargo in ranks, cranes on rails.' },
    blurb: 'The road works the dockyard in switchbacks. Cargo stacks break the ground, crane masts break the sightlines, and everything on this board is for sale, including the ground.',
    trait: 'Dock grid · crane masts',
    denizens: ['jammer', 'warchief'],
    sigNote: 'Port authority: Jammers dim the manifests and Warchiefs collect the berth fees.',
    roster: ['crawler', 'sprinter', 'jammer', 'cluster', 'aegis', 'nullifier', 'warchief', 'carrier'],
    cols: 28, rows: 15,
    lanes: [[[13, 11], [10, 11], [10, 7], [6, 7], [6, 11], [2, 11], [2, 6], [-1, 6]]],
    /* Cargo ranks on the yard, crane masts (walls) over the working rows. */
    blocks: [[4, 2, 5, 3], [8, 2, 9, 3], [12, 2, 13, 3], [4, 13, 5, 14], [8, 13, 9, 14], [0, 8, 1, 9]],
    walls: [[7, 5, 7, 5], [11, 5, 11, 5], [3, 9, 3, 9]],
    /* Kinetic for the freight, fire for the cutting yards. The void lane
       node is the berth nobody books twice. */
    nodes: [[8, 9, 'kinetic', 'build'], [12, 12, 'fire', 'build'], [4, 11, 'void', 'lane']]
  },

  {
    id: 'w_proxc', world: 'PROXIMA c', name: 'THE WRECK YARDS', adj: 'Salvaged',
    terra: { class: 'archipelago', flow: 'serpentine', cover: 'pocketed', barriers: 'blocks', sight: 'broken',
      basis: 'Proxima c is cold, distant and real, and the Captains fill its orbit with what they cut apart: a plain of hulls from a hundred builders, none of them local.' },
    blurb: 'The road picks between beached hulls. Every wreck is cover, every gap between wrecks is a firing lane somebody already measured, and the salvage rights are the fight.',
    trait: 'Beached hulls · measured gaps',
    denizens: ['shardling', 'carrier'],
    sigNote: 'Yard crews: Shard Sentries walk the cuts and Carriers lift what is left.',
    roster: ['shardling', 'cluster', 'spawnling', 'jammer', 'bulwark', 'warchief', 'bastion', 'carrier'],
    cols: 28, rows: 15,
    lanes: [[[13, 7], [9, 7], [9, 3], [4, 3], [4, 10], [9, 10], [9, 13], [2, 13], [-1, 13]]],
    /* The hulls: big, irregular, and none of them stop a shot: cut hulls
       are honeycomb, not armour. */
    blocks: [[6, 1, 8, 1], [11, 1, 12, 2], [6, 5, 7, 6], [11, 9, 12, 10], [1, 4, 2, 5], [6, 12, 6, 12], [0, 0, 1, 1]],
    /* Kinetic for the cutting, venom for what leaks when you cut wrong.
       The fire lane node is the torch line across the middle passage. */
    nodes: [[11, 5, 'kinetic', 'build'], [1, 8, 'venom', 'build'], [6, 10, 'fire', 'lane']]
  },

  {
    id: 'w_flare', world: 'THE FLARE SHELTER', name: 'THE FLARE SHELTER', adj: 'Bunkered',
    terra: { class: 'ring', flow: 'convergent', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'When Proxima flares, the open band is death for minutes at a time, so the Captains built one shelter big enough to argue inside. Every road on the world leads into it.' },
    blurb: 'Two roads converge on the shelter door, and the shelter ring stops everything that is not already inside. Whoever holds the door decides who waits out the flare in the open.',
    trait: 'Converging roads · one shelter door',
    denizens: ['bulwark', 'bastion'],
    sigNote: 'Door discipline: Palisades queue at the ring and Bastions ARE the ring.',
    roster: ['crawler', 'aegis', 'mender', 'bulwark', 'herald', 'warden', 'bastion', 'juggernaut'],
    cols: 28, rows: 15,
    lanes: [
      [[13, 3], [7, 3], [7, 7], [-1, 7]],
      [[13, 11], [7, 11], [7, 7], [-1, 7]]
    ],
    /* The shelter ring west of the junction, split only at the door tile
       the shared road passes through; flare glass fields to the east. */
    walls: [[3, 4, 3, 6], [3, 8, 3, 10], [5, 2, 6, 2], [5, 12, 6, 12]],
    blocks: [[10, 6, 11, 8], [0, 0, 1, 1], [0, 13, 1, 14], [12, 13, 13, 14]],
    /* Fire for the flare, frost for the shelter's stores. The radiant lane
       node is INSIDE the ring: the light you queue for. */
    nodes: [[9, 5, 'fire', 'build'], [9, 9, 'frost', 'build'], [5, 7, 'radiant', 'lane']]
  },

  {
    id: 'w_narrowstrait', world: 'THE NARROWS', name: 'THE SMUGGLER STRAIT', adj: 'Squeezed',
    terra: { class: 'corridor', flow: 'switchback', cover: 'pocketed', barriers: 'blocks', sight: 'broken',
      basis: 'The strait between Proxima and the Centauri pair is thick with drift shoals: one channel through, known to everyone who does not report cargo, which is everyone.' },
    blurb: 'The tightest ground in the theatre. The channel squeezes between shoals with pockets barely wide enough to found in, and every pocket is somebody’s old ambush.',
    trait: 'One channel · ambush pockets',
    denizens: ['blink', 'anchorite'],
    sigNote: 'Strait regulars: Displacers jump the queue and Anchorites collect at the squeeze.',
    roster: ['sprinter', 'blink', 'wraith', 'jammer', 'bulwark', 'anchorite', 'warchief', 'juggernaut'],
    cols: 24, rows: 13,
    lanes: [[[11, 6], [8, 6], [8, 2], [4, 2], [4, 10], [1, 10], [1, 6], [-1, 6]]],
    /* The shoals: drift banks crowding every leg of the channel. */
    blocks: [[5, 0, 10, 1], [9, 3, 10, 4], [5, 5, 7, 5], [9, 7, 10, 9], [5, 7, 6, 8], [2, 3, 2, 4], [0, 0, 1, 1], [2, 12, 6, 12]],
    /* Void for the dark cargo, kinetic for the boarding gear. The venom
       lane node marks the squeeze where the strait is one tile wide. */
    nodes: [[2, 8, 'void', 'build'], [6, 6, 'kinetic', 'build'], [6, 2, 'venom', 'lane']]
  },

  {
    id: 'w_locker', world: 'THE DARK LOCKER', name: 'THE DARK LOCKER', adj: 'Sealed',
    terra: { class: 'maze', flow: 'switchback', cover: 'mazed', barriers: 'mixed', sight: 'blind',
      basis: 'The Captains keep one vault where the star cannot flare on it: the permanently dark side of a tide-locked rock. What is in the locker stays in the locker.' },
    blurb: 'Vault walls in the permanent dark. Sightlines die at every corner, the road doubles back on itself, and half the things stored here were never logged in.',
    trait: 'Vault walls · permanent dark',
    denizens: ['wraith', 'revenant'],
    sigNote: 'Locker staff: Veilwraiths audit in the dark and Reconstructors restock it.',
    roster: ['wraith', 'jammer', 'blink', 'shardling', 'nullifier', 'warden', 'revenant', 'bastion'],
    cols: 26, rows: 15,
    lanes: [[[12, 2], [6, 2], [6, 6], [10, 6], [10, 10], [4, 10], [4, 13], [-1, 13]]],
    /* The vault stacks, one turn of the maze each. */
    walls: [[8, 4, 9, 4], [3, 4, 4, 4], [8, 8, 8, 8], [2, 6, 2, 8], [6, 8, 6, 9], [12, 8, 12, 9], [1, 11, 1, 11], [8, 12, 9, 12]],
    blocks: [[0, 0, 1, 1], [12, 0, 12, 1]],
    /* Void twice, because the locker is a void with a rental fee: one to
       build beside, one on the last run. Frost for the cold storage. */
    nodes: [[11, 4, 'void', 'build'], [1, 5, 'frost', 'build'], [2, 13, 'void', 'lane']]
  },

  {
    id: 'w_proxgate', world: 'PROXIMA GATE', name: 'THE TOLL PLAZA', adj: 'Tolled',
    terra: { class: 'plaza', flow: 'convergent', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'The Gate is the one stable transit point out of the Proxima well, and the Captains never met a bottleneck they did not price. Three roads in, one gate out, receipts for all.' },
    blurb: 'The seat of the Free Captains: three roads converge on one toll gate. Everything that leaves the system passes the plaza, and the plaza knows what everything is worth.',
    trait: 'Three roads · one toll gate',
    denizens: ['warchief', 'juggernaut'],
    sigNote: 'The seat garrison: Warchiefs price the queue and Ironmarches ARE the queue.',
    roster: ['crawler', 'jammer', 'aegis', 'nullifier', 'revenant', 'warden', 'warchief', 'juggernaut'],
    cols: 30, rows: 17,
    lanes: [
      [[14, 3], [9, 3], [9, 8], [-1, 8]],
      [[14, 13], [9, 13], [9, 8], [-1, 8]],
      [[14, 8], [-1, 8]]
    ],
    /* The toll wall, split only at the gate tile the roads share; booth
       walls flanking the queue. */
    walls: [[5, 5, 5, 7], [5, 9, 5, 11], [7, 4, 7, 4], [7, 12, 7, 12]],
    blocks: [[12, 1, 13, 1], [12, 15, 13, 15], [2, 2, 3, 3], [2, 13, 3, 14], [0, 0, 0, 1], [0, 15, 0, 16]],
    /* Kinetic for the toll machinery, fire for the debt collection. The
       void lane node sits past the gate: paid, and gone. */
    nodes: [[7, 6, 'kinetic', 'build'], [7, 10, 'fire', 'build'], [3, 8, 'void', 'lane']]
  },

  /* ══════════════════════════════════════════════════════ SIRIUS ═══
     The Vigil's star: the brightest in anyone's sky, and beside it the
     white dwarf that gave up its form. Machine ground, in perfect order. */

  {
    id: 'w_sira1', world: 'SIRIUS A I', name: 'THE CALIBRATION PLAIN', adj: 'Levelled',
    terra: { class: 'field', flow: 'straight', cover: 'open', barriers: 'blocks', sight: 'long',
      basis: 'The first world of the bright star was levelled to reference flatness a very long time ago. Four calibration markers survive. Nothing else was permitted to.' },
    blurb: 'A board with four objects on it, placed to tolerances. The road runs true, the ground is a datum, and there is nothing between your line and theirs but the arithmetic.',
    trait: 'Reference flat · four markers',
    denizens: ['shardling', 'warden'],
    sigNote: 'Plain instruments: Shard Sentries hold the datums and Wardens hold everything else.',
    roster: ['crawler', 'mite', 'sprinter', 'shardling', 'herald', 'warden', 'bastion', 'juggernaut'],
    cols: 34, rows: 15,
    lanes: [[[16, 7], [8, 7], [8, 8], [-1, 8]]],
    /* The four markers. That is the map. */
    blocks: [[10, 3, 10, 3], [10, 11, 10, 11], [4, 5, 4, 5], [4, 10, 4, 10]],
    /* Kinetic for the instrument ground, radiant for the brightest star in
       anyone's sky. The storm lane node is the one earthed rail. */
    nodes: [[9, 5, 'kinetic', 'build'], [9, 10, 'radiant', 'build'], [6, 8, 'storm', 'lane']]
  },

  {
    id: 'w_sira2', world: 'SIRIUS A II', name: 'THE ASSEMBLY ROWS', adj: 'Fenced',
    terra: { class: 'corridor', flow: 'straight', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'The second world builds the bodies of the Vigil, on one production run fenced both sides. The fences predate every complaint about the fences.' },
    blurb: 'One production run between two fence lines. The gaps in the fences are the only firing angles anyone gets, and the line does not stop for casualties, theirs or yours.',
    trait: 'One run · fence-gap angles',
    denizens: ['aegis', 'nullifier'],
    sigNote: 'Line integrity: Aegis Sentinels shield the run and Nullifiers remove interruptions.',
    roster: ['crawler', 'shardling', 'aegis', 'jammer', 'nullifier', 'warden', 'bastion', 'warchief'],
    cols: 30, rows: 13,
    lanes: [[[14, 6], [4, 6], [4, 7], [-1, 7]]],
    /* The fences, gapped where the assembly arms reach the line. */
    walls: [[6, 4, 9, 4], [11, 4, 13, 4], [6, 8, 8, 8], [10, 8, 13, 8], [2, 4, 4, 4], [2, 8, 2, 8]],
    blocks: [[0, 0, 1, 2], [0, 10, 1, 12]],
    /* Kinetic for the line itself, frost for the quench baths. The radiant
       lane node is the inspection light halfway down the run. */
    nodes: [[7, 2, 'kinetic', 'build'], [7, 10, 'frost', 'build'], [8, 6, 'radiant', 'lane']]
  },

  {
    id: 'w_ash', world: 'THE ASH FIELD', name: 'THE ASH FIELD', adj: 'Shed',
    terra: { class: 'crater', flow: 'serpentine', cover: 'scattered', barriers: 'blocks', sight: 'long',
      basis: 'Sirius B was once the larger star. What it shed on the way down fell here, and the Vigil neither cleared it nor mourns it, which may be the same operation.' },
    blurb: 'Drifts of a dead star. The road winds through what the companion shed, the drifts stop nothing but foundations, and the ground is still faintly warm if you ask it.',
    trait: 'Stellar drifts · faintly warm',
    denizens: ['basalt', 'revenant'],
    sigNote: 'Field detail: Basalt Marchers walk the drifts and Reconstructors sort them.',
    roster: ['mite', 'spawnling', 'cluster', 'shardling', 'basalt', 'revenant', 'warden', 'juggernaut'],
    cols: 28, rows: 15,
    lanes: [[[13, 5], [10, 5], [10, 9], [6, 9], [6, 3], [2, 3], [2, 7], [-1, 7]]],
    /* The drifts, in the pattern they fell. */
    blocks: [[8, 1, 9, 2], [12, 11, 13, 12], [4, 5, 4, 6], [8, 11, 9, 12], [0, 0, 1, 1], [4, 12, 5, 13], [12, 1, 12, 2]],
    /* Fire for the residual heat, void for the star that is not there any
       more. The frost lane node is the one cold seam in the field. */
    nodes: [[8, 6, 'fire', 'build'], [3, 10, 'void', 'build'], [6, 6, 'frost', 'lane']]
  },

  {
    id: 'w_sirb1', world: 'SIRIUS B I', name: 'THE COLLAPSE FORGE', adj: 'Compressed',
    terra: { class: 'forge', flow: 'ring-arc', cover: 'walled', barriers: 'mixed', sight: 'broken',
      basis: 'The one world of the white dwarf works by borrowed pressure: the forge core is walled on every face and the doors are exactly where the road needs them, no wider.' },
    blurb: 'The road arcs the forge floor and then passes through the core, one door in, one door out. Everything inside the core wall is pressure; everything outside is queue.',
    trait: 'Forge arc · two doors through the core',
    denizens: ['bulwark', 'warden'],
    sigNote: 'Forge floor: Palisades feed the press and Wardens carry the product.',
    roster: ['shardling', 'basalt', 'bulwark', 'aegis', 'nullifier', 'warden', 'bastion', 'juggernaut'],
    cols: 28, rows: 15,
    lanes: [[[13, 3], [4, 3], [4, 11], [10, 11], [10, 7], [-1, 7]]],
    /* The core, walled on all faces, doors at the road on east and west. */
    walls: [[7, 5, 9, 5], [7, 9, 9, 9], [7, 6, 7, 6], [7, 8, 7, 8], [9, 6, 9, 6], [9, 8, 9, 8]],
    blocks: [[2, 1, 2, 1], [12, 13, 12, 13], [1, 12, 2, 13], [11, 1, 12, 2]],
    /* Fire twice, because the forge is the point: one beside the queue,
       one on the arc where the slag runs. Kinetic for the press itself. */
    nodes: [[5, 5, 'fire', 'build'], [12, 9, 'kinetic', 'build'], [10, 9, 'fire', 'lane']]
  },

  {
    id: 'w_diamond', world: 'THE DIAMOND SHELF', name: 'THE DIAMOND SHELF', adj: 'Faceted',
    terra: { class: 'terrace', flow: 'staircase', cover: 'walled', barriers: 'mixed', sight: 'blind',
      basis: 'A white dwarf crystallises as it cools: the shelf is crystallised carbon, cut into terraces, and every facet is a mirror thick enough to stop a shot.' },
    blurb: 'The road climbs the shelf, and the facets above every step blind the step below. Nothing sees more than one terrace, except whatever is standing on top.',
    trait: 'Climbing steps · facet-blind',
    denizens: ['aegis', 'warden'],
    sigNote: 'Shelf survey: Aegis Sentinels take the faces and Wardens take the summit.',
    roster: ['shardling', 'blink', 'aegis', 'wraith', 'nullifier', 'warden', 'bastion', 'juggernaut'],
    cols: 28, rows: 17,
    lanes: [[[13, 14], [10, 14], [10, 11], [7, 11], [7, 8], [4, 8], [4, 5], [1, 5], [1, 2], [-1, 2]]],
    /* The facets, one above each step, each one a shot-stopping mirror. */
    walls: [[11, 12, 12, 13], [8, 9, 9, 10], [5, 6, 6, 7], [2, 3, 3, 4]],
    blocks: [[6, 15, 7, 16], [12, 16, 13, 16]],
    /* Frost twice for the cooling star, once beside the climb and once on
       the mid-step. Radiant for what the facets do to the light. */
    nodes: [[12, 10, 'frost', 'build'], [2, 7, 'radiant', 'build'], [5, 8, 'frost', 'lane']]
  },

  {
    id: 'w_companion', world: 'THE COMPANION', name: 'THE LONG ORBIT', adj: 'Mourning',
    terra: { class: 'ring', flow: 'spiral', cover: 'pocketed', barriers: 'blocks', sight: 'long',
      basis: 'The Companion orbits the dwarf that used to be the bigger star. The road spirals inward the way the orbit does: patiently, and crossing its own past on the way.' },
    blurb: 'One road, spiralling in, crossing its own exit once. Debris pockets ride the orbit line, and the middle of the board is the end of the road in both senses.',
    trait: 'Inward spiral · crosses its own exit',
    denizens: ['revenant', 'carrier'],
    sigNote: 'Orbit keepers: Reconstructors circle back and Carriers complete the circuit.',
    roster: ['wisp', 'mite', 'wraith', 'revenant', 'nullifier', 'warden', 'carrier', 'juggernaut'],
    cols: 28, rows: 17,
    lanes: [[[13, 2], [3, 2], [3, 14], [11, 14], [11, 6], [6, 6], [6, 10], [-1, 10]]],
    /* Orbit debris, pocketed along the ring line. */
    blocks: [[8, 4, 9, 4], [5, 8, 5, 8], [7, 8, 8, 8], [13, 4, 13, 5], [1, 4, 1, 5], [9, 12, 9, 12], [13, 12, 13, 13], [0, 0, 1, 0], [12, 16, 13, 16]],
    /* Void for the missing star, frost for the long dark of the orbit. The
       void lane node sits on the south arc, the coldest leg of the year. */
    nodes: [[9, 9, 'void', 'build'], [1, 12, 'frost', 'build'], [8, 14, 'void', 'lane']]
  },

  {
    id: 'w_dogstar', world: 'THE DOG STAR', name: 'THE HALL OF STANDING ORDERS', adj: 'Ordered',
    terra: { class: 'maze', flow: 'serpentine', cover: 'walled', barriers: 'mixed', sight: 'blind',
      basis: 'The hall every standing order comes from. The desks are in perfect order, the chairs have never been occupied, and the walls are filing, floor to ceiling, forever.' },
    blurb: 'The last board. The road winds the hall between desk rows in perfect order, every corner is blind, and at the end of it is the room the orders come from, still issuing.',
    trait: 'Desk rows · the orders continue',
    denizens: ['warden', 'juggernaut'],
    sigNote: 'The seat garrison: Wardens keep the originals and Ironmarches keep the door.',
    roster: ['crawler', 'shardling', 'aegis', 'nullifier', 'revenant', 'warden', 'bastion', 'juggernaut'],
    cols: 30, rows: 17,
    lanes: [[[14, 2], [9, 2], [9, 6], [12, 6], [12, 10], [7, 10], [7, 14], [2, 14], [2, 8], [-1, 8]]],
    /* The desk rows, in perfect order, gapped only where the aisles are. */
    walls: [[3, 4, 6, 4], [10, 4, 11, 4], [3, 8, 5, 8], [9, 8, 10, 8], [4, 12, 5, 12], [9, 12, 10, 12], [13, 12, 13, 13], [0, 12, 0, 12]],
    blocks: [[0, 0, 1, 0], [13, 16, 14, 16]],
    /* Void for the chairs that were never occupied, kinetic for the filing
       machinery. The radiant lane node is the light left on in the hall. */
    nodes: [[5, 6, 'void', 'build'], [11, 12, 'kinetic', 'build'], [5, 14, 'radiant', 'lane']]
  }

];

/* Merged into MAPS so every resolver (MAPS.find by id) works unchanged; the
   `world` field keeps them out of every random pool (galaxy eligibility and
   the mapPool save pin both filter on it). */
WORLD_MAPS.forEach(m => MAPS.push(m));

const WORLD_MAP_BY_NAME = {};
WORLD_MAPS.forEach(m => { WORLD_MAP_BY_NAME[m.world] = m; });
