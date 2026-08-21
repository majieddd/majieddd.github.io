/* ==========================================================================
   COSMIC CONQUEST — Configuration & Game Data
   ========================================================================== */

'use strict';

const TILE = 38;

/* ── BATTLE SIDEBAR GEOMETRY ──────────────────────────────────────────────
   Game.resize() fits the canvas to #canvas-wrap's LIVE clientWidth, so the
   board follows the sidebar automatically. These two numbers exist only for
   the first-frame fallback, when the stage has not been laid out yet and
   the wrap reports a near-zero box. Over-estimating the sidebar there merely
   under-fits one frame before the queued re-fit measures the real box;
   under-estimating it would lock the canvas too wide for the wrap. */
const SIDEBAR_WIDE_PX = 580;     /* the two-column sidebar (css #sidebar, >=1240px) */
const STAGE_CHROME_PX = 30;      /* #stage padding + the gap beside the sidebar  */

/* ── DRAG-OUT RADIAL PLACEMENT ────────────────────────────────────────────
   Press a buildable tile and drag: a ring of your loadout blooms on that tile
   and releasing over an icon builds it there. Five other things already
   listen to this canvas -- plain click, the armed-build cursor, the armed
   relocation, an aimed ability and the right-click cancel -- so every number
   below exists to keep the gesture from colliding with one of them. */

/* Travel, in CSS pixels, before a press is read as a drag rather than a
   click. Below this the press must still reach the existing click handler:
   opening a menu under a player who meant to select a tower is the failure
   this protects against. GalaxyFX uses 6 for the same job on the world map;
   a ring is a heavier interruption than a missed world click, so it asks for
   more travel before it commits. */
const RADIAL_OPEN_PX = 12;

/* Ring geometry in LOGICAL board units (Game.width/height space, TILE=38),
   never in CSS pixels -- the canvas is fitted by viewScale, so measuring the
   menu in board units is what makes it land on its tile at every board size. */
const RADIAL_RING_TILES = 2.15;    /* tile centre -> icon centre */
const RADIAL_ICON_TILES = 0.62;    /* icon radius                */
/* Inside this radius the gesture has not chosen anything yet, so a release
   there cancels. Without a dead zone the item nearest the press is armed from
   the first pixel of travel and there is no way to abort in place. */
const RADIAL_DEAD_TILES = 0.85;
/* Past this the pointer has left the menu and a release cancels -- the escape
   hatch a touchscreen has instead of a right-click. */
const RADIAL_OUTER_TILES = 3.6;
/* Clearance kept between the ring and the board edge. Side 0 builds on the
   left columns, where a ring centred on the tile would hang half off the
   canvas and clip the very icons it is offering, so near an edge the ring
   slides inboard and a stalk keeps it tied to its tile. */
const RADIAL_EDGE_PAD_PX = 16;

/* Seconds the ring takes to bloom. Cosmetic, but it is what confirms the drag
   was received before the pointer has travelled far enough to choose. It runs
   off wall-clock, not the sim clock, so it still plays while paused. */
const RADIAL_GROW_SECS = 0.13;

/* The tower sprites are painted once per type into an offscreen icon at this
   multiple of their drawn size, because the board can be fitted up to 1.9x
   and a 1x icon resampled up is the one blurry thing on a sharp board. */
const RADIAL_ICON_OVERSAMPLE = 2;
/* The box the sprite is fitted into. UI.paintTowerIcons uses 46 for a square
   plinth; the ring's icon is a CIRCLE, so a wider box keeps a broad sprite
   inside its own rim instead of poking through it. */
const RADIAL_ICON_BOX = 50;

/* Diminishing return per copy of a tower a side already owns, applied when a
   build is valued. ai.js has always applied it; it is named here because the
   radial's ordering applies the same term, and the two readers of one number
   must not be able to drift apart. */
const BUILD_DIVERSITY_FALLOFF = 0.80;

/* Spawn gaps and inter-group delays are multiplied by this. Lower = faster
   waves and a shorter match. */
const SPAWN_TEMPO = 0.58;   /* spacing between units in a wave. Raised from 0.46: at
   half the unit count, clumps read as one blob and the fight was illegible. */

/* --------------------------------------------------------------------------
   BATTLEFIELDS
   Only the LEFT side is authored; the right is mirrored, so symmetry cannot
   drift. A map may carry SEVERAL lanes per side — a true fork you must hold in
   two places at once — and `blocks` marks impassable terrain that removes
   build space entirely.
-------------------------------------------------------------------------- */
const MAPS = [
  {
    id: 'spine', name: 'THE SPINE', tier: 1,
    denizens: ['sprinter', 'wisp'], sigNote: 'Open ground — Outrunners and Lanterns run the whole arc.',
    roster: ['sprinter', 'crawler', 'wisp', 'blink', 'aegis', 'jammer', 'herald', 'warden'],
    blurb: 'One long serpentine with generous shoulders. Every tile you own sees the lane at least twice — the cleanest board in the theatre.',
    trait: 'Single lane · open ground',
    cols: 28, rows: 15, region: { x: 20, y: 64 },
    lanes: [[[13, 7], [10, 7], [10, 2], [5, 2], [5, 12], [2, 12], [2, 7], [-1, 7]]],
    /* Wisps are storm-weak, so the nodes deliberately are not storm: frost and
       void ask you to bring the partner element yourself. */
    nodes: [[7, 4, 'frost', 'build'], [7, 10, 'void', 'build'], [5, 9, 'fire', 'lane']]
  },
{
    id: 'delta', name: 'THE DELTA', tier: 2,
    denizens: ['mender', 'cluster'], sigNote: 'Wetlands — Restorers and Dividers hold the confluence.',
    roster: ['crawler', 'wisp', 'mender', 'cluster', 'shardling', 'wraith', 'nullifier', 'carrier'],
    blurb: 'Two channels that never share a tile, divided by a silt bank no tower shoots across. Whichever mouth you fortify is the one they leave alone.',
    trait: 'Twin mouths · ground split in two',
    cols: 28, rows: 17, region: { x: 39, y: 27 },
    lanes: [
      [[13, 3],  [10, 3],  [10, 6],  [6, 6],  [6, 1],  [2, 1],  [2, 8], [-1, 8]],
      [[13, 13], [10, 13], [10, 10], [6, 10], [6, 15], [2, 15], [2, 8], [-1, 8]]
    ],
    /* The bank is the whole map: it cuts the buildable ground into a north
       pocket and a south pocket that cannot cover each other, so the only
       tiles answering both mouths are the handful by the gate. */
    blocks: [[4, 7, 9, 9], [11, 7, 11, 9], [0, 0, 1, 1], [0, 15, 1, 16]],
    /* Menders are venom-weak and clusters fire-weak; the nodes carry neither,
       so the wetlands answer is still a kit you choose, not a tile you stand
       on. Only the north channel carries a lane node -- the two mouths are
       not interchangeable, and the mirror gives both sides the same pair. */
    nodes: [[8, 4, 'storm', 'build'], [8, 12, 'void', 'build'], [6, 3, 'frost', 'lane']]
  },
{
    id: 'narrows', name: 'THE NARROWS', tier: 2,
    denizens: ['bulwark', 'basalt'], sigNote: 'Chokepoints — Palisades and slow-immune Basalt Marchers dig in.',
    roster: ['crawler', 'aegis', 'shardling', 'bulwark', 'basalt', 'anchorite', 'bastion', 'juggernaut'],
    blurb: 'Rubble has taken everything but three alcoves. Each one watches a single leg of the corridor, and nothing you build in one can help another.',
    trait: 'Three alcoves · no fallback',
    cols: 26, rows: 13, region: { x: 58, y: 20 },
    lanes: [[[12, 6], [10, 6], [10, 2], [7, 2], [7, 10], [4, 10], [4, 3], [1, 3], [1, 6], [-1, 6]]],
    /* Sixty buildable tiles a side, in three pockets that do not overlap.
       Anything you want covered twice has to be paid for twice. */
    blocks: [[0, 0, 10, 0], [0, 11, 10, 12], [9, 7, 10, 9], [5, 7, 6, 9],
             [0, 4, 0, 5], [2, 4, 2, 5], [8, 4, 8, 4]],
    /* Bulwarks RESIST frost, which is exactly why the anchor node carries it:
       an attuned Cryo still fires, but every reaction it triggers lands at half
       strength on the map's own denizens. The venom lane primes PARALYSIS for
       that Cryo and the bulwark halves it. The node opens a line of play here;
       it does not win the map on its own. Neither node touches storm, which is
       what these denizens are actually weak to. */
    nodes: [[9, 3, 'frost', 'build'], [5, 4, 'void', 'build'], [4, 8, 'venom', 'lane']]
  },
{
    id: 'shattered', name: 'SHATTERED', tier: 3,
    denizens: ['blink', 'wraith'], sigNote: 'Broken ground — Phase Couriers and Ghost Chassis slip between the cracks.',
    roster: ['sprinter', 'crawler', 'blink', 'aegis', 'wraith', 'revenant', 'nullifier', 'warden'],
    blurb: 'Four surviving islands, each hanging off one bend of a long fall through the craters. There is no second-best tile and no way to reinforce a mistake.',
    trait: 'Four islands · one long fall',
    cols: 28, rows: 15, region: { x: 76, y: 38 },
    lanes: [[[13, 7], [11, 7], [11, 2], [7, 2], [7, 12], [4, 12], [4, 5], [1, 5], [1, 9], [-1, 9]]],
    blocks: [[0, 0, 3, 1], [5, 0, 10, 0], [2, 0, 3, 0], [0, 11, 0, 14], [5, 14, 10, 14],
             [9, 4, 10, 6], [9, 8, 10, 10], [0, 2, 1, 3], [5, 4, 6, 5], [5, 9, 6, 10],
             [2, 12, 3, 14]],
    /* Wraiths resist void, so the void node damps its own best reaction here --
       and fire, the wraith weakness, is kept off the map entirely. */
    nodes: [[8, 3, 'void', 'build'], [8, 11, 'storm', 'build'], [7, 5, 'frost', 'lane']]
  },
{
    id: 'crossroads', name: 'CROSSROADS', tier: 3,
    denizens: ['warchief', 'aegis'], sigNote: 'Contested crossroads — pylon columns march with their escorts.',
    roster: ['crawler', 'wisp', 'aegis', 'jammer', 'herald', 'warchief', 'anchorite', 'bastion'],
    blurb: 'Two lanes that cross each other twice on the way in. Both intersections are lane tiles, so the ground that watches them is the ground beside them — and there is a monument in the way.',
    trait: 'Two lanes · two crossings',
    cols: 30, rows: 15, region: { x: 30, y: 84 },
    lanes: [
      [[14, 4],  [8, 4],   [8, 11], [3, 11], [3, 7], [-1, 7]],
      [[14, 11], [11, 11], [11, 7], [5, 7],  [5, 13], [2, 13], [2, 7], [-1, 7]]
    ],
    /* The monument sits in the pocket between the two crossings, so the tile
       that would have watched both at once does not exist. */
    blocks: [[9, 5, 10, 6], [9, 8, 10, 9], [0, 0, 1, 0], [0, 14, 1, 14]],
    /* The lane node sits ON the first crossing: everything that uses either
       lane is primed there. Aegis resists storm, so holding the build node is
       a licence to react, not a free kill. */
    nodes: [[7, 8, 'storm', 'build'], [1, 4, 'venom', 'build'], [8, 7, 'fire', 'lane']]
  },
{
    id: 'coil', name: 'THE COIL', tier: 4,
    denizens: ['jammer', 'sprinter'], sigNote: 'The coil crawls with Interdictors jamming everything they pass.',
    roster: ['sprinter', 'crawler', 'blink', 'cluster', 'jammer', 'wraith', 'bulwark', 'warden'],
    blurb: 'The longest march in the theatre: a full inward spiral that then cuts straight back out across every ring it just wound. One good tile is worth four elsewhere.',
    trait: 'Longest lane · crossed by its own exit',
    cols: 28, rows: 15, region: { x: 66, y: 74 },
    lanes: [[[13, 7], [12, 7], [12, 13], [2, 13], [2, 1], [10, 1], [10, 10], [5, 10], [5, 4], [8, 4], [8, 6], [-1, 6]]],
    blocks: [[0, 0, 1, 1], [0, 14, 1, 14], [11, 2, 11, 5], [11, 8, 11, 10],
             [6, 11, 7, 12], [3, 8, 4, 9]],
    /* Jammers and sprinters carry no elemental hole, so the coil is the one map
       whose nodes are a straight offer -- fire and frost, with a venom lane that
       triggers either. Reading the spiral is already the hard part here. */
    nodes: [[9, 3, 'fire', 'build'], [6, 7, 'frost', 'build'], [3, 6, 'venom', 'lane']]
  }
,
{
    id: 'expanse', name: 'THE EXPANSE', tier: 4,
    blurb: 'A colossal drift of dead hulks with two long approaches that never come within reach of each other. Nothing you own covers much; you simply have to own more of it.',
    trait: 'Massive field · two long lanes', denizens: ['juggernaut', 'carrier'],
    sigNote: 'Deep space — Ironmarches and Foundry Carriers drift in from the dark.',
    roster: ['crawler', 'wisp', 'cluster', 'shardling', 'revenant', 'warden', 'carrier', 'juggernaut'],
    cols: 36, rows: 20, region: { x: 78, y: 30 },
    lanes: [
      [[17, 7],  [14, 7],  [14, 3],  [8, 3],  [8, 9],  [4, 9],  [4, 10], [-1, 10]],
      [[17, 13], [14, 13], [14, 17], [8, 17], [8, 11], [4, 11], [4, 10], [-1, 10]]
    ],
    /* Two hulks, parked in the only pockets that saw both lanes at once. */
    blocks: [[10, 5, 12, 7], [10, 13, 12, 15], [0, 0, 1, 1], [0, 18, 1, 19]],
    /* Four a side: the largest board earns one more, or nodes are a rounding
       error on this much ground. Juggernauts RESIST fire and are frost-weak, so
       the anchor node is fire and frost is nowhere on offer -- a void lane feeds
       COLLAPSE into that fire tower, and the juggernaut's plating damps exactly
       the reaction the nodes were laid out to produce. */
    nodes: [[12, 10, 'fire', 'build'], [6, 5, 'storm', 'build'],
            [6, 15, 'void', 'build'], [8, 6, 'void', 'lane']]
  },
{
    id: 'rift', name: 'THE RIFT', tier: 3,
    blurb: 'Both lanes loop away from each other and are pinched back through the same scarred throat, twice over. Four tiles decide this battle; the rest of the board is scenery.',
    trait: 'Twin loops · one throat, taken twice', denizens: ['wraith', 'shardling'],
    sigNote: 'Rift-touched — Ghost Chassis and Shard Sentries bleed through.',
    roster: ['sprinter', 'crawler', 'blink', 'aegis', 'shardling', 'wraith', 'herald', 'bastion'],
    cols: 26, rows: 17, region: { x: 55, y: 75 },
    lanes: [
      [[12, 8], [10, 8], [10, 3],  [7, 3],  [7, 8], [4, 8], [4, 13], [1, 13], [1, 8], [-1, 8]],
      [[12, 8], [10, 8], [10, 13], [7, 13], [7, 8], [4, 8], [4, 3],  [1, 3],  [1, 8], [-1, 8]]
    ],
    blocks: [[8, 0, 10, 1], [8, 15, 10, 16], [0, 0, 2, 1], [0, 15, 2, 16]],
    /* The lane node stands in the throat itself, so it primes BOTH lanes on the
       one tile. Wraiths resist void and shardlings are storm-weak: void is on
       the nodes, storm is not on offer. */
    nodes: [[5, 6, 'void', 'build'], [5, 10, 'venom', 'build'], [6, 8, 'frost', 'lane']]
  },
{
    id: 'confluence', name: 'THE CONFLUENCE', tier: 5, tri: true,
    blurb: 'Three powers, one spawn, no allies. Every kill reanimates toward BOTH rivals — the dead walk twice as thick.',
    trait: 'THREE-WAY WAR · doubled reanimates', denizens: ['revenant', 'warchief'],
    sigNote: 'The confluence draws Reconstructors and pylon columns from every front.',
    roster: ['crawler', 'wisp', 'mender', 'jammer', 'revenant', 'warchief', 'basalt', 'carrier'],
    cols: 31, rows: 25, region: { x: 50, y: 12 },
    /* An odd column count puts the mirror axis ON a column, so the two flanking
       commanders are exact reflections of each other. The old 30-wide board had
       its bases at x=5 and x=25 -- not a reflection at all, which is why side 0
       held 28 more tiles than side 1. The third arm zig-zags across the axis so
       it spends the same ground on each flank. */
    triLanes: [
      [[15, 11], [15, 7], [10, 7], [10, 5], [3, 5]],
      [[15, 11], [15, 7], [20, 7], [20, 5], [27, 5]],
      [[15, 11], [14, 11], [14, 14], [17, 14], [17, 17], [14, 17], [14, 20], [15, 20], [15, 23]]
    ],
    /* One island inside each fold of the third arm. MEASURED: the two
       flanking seats' best eight placements cover 69.3 tiles of their own
       lane; the third seat's covered 91.5, because its switchbacks fold
       inside a three-tile column and one tower watched the lane twice. The
       islands take the doubled ground and leave the arm's silhouette alone
       -- 70.5 against 69.3, a 1.7% spread. */
    blocks: [[14, 15, 16, 16], [16, 18, 17, 18]],
    /* The third build node moved off the fold for the same reason: it sat on
       a tile covering 10.0 lane-tiles while the other two commanders' nodes
       covered 2.8, so the one tower that also gets the attunement bonus was
       the best tower on that side of the board. (18, 21) covers 2.8. */
    triNodes: [
      ['frost', 'build', [9, 9], [21, 9], [18, 21]],
      ['storm', 'lane', [10, 6], [20, 6], [17, 15]]
    ],
    lanes: [[[15, 11], [15, 7], [10, 7], [10, 5], [3, 5]]]
  },
  {
    id: 'crown', name: 'THE CROWN', tier: 5, tri: true,
    blurb: 'A walled ring sits over the spawn with exactly three doors, one per commander. Nothing leaves without passing a wall every side can shoot at.',
    trait: 'THREE-WAY WAR · one walled crown, three doors',
    roster: ['crawler', 'wisp', 'aegis', 'herald', 'revenant', 'warden', 'bastion', 'juggernaut'],
    denizens: ['bastion', 'herald'],
    sigNote: 'The crown garrison — bastions and heralds hold the ring.',
    /* The walled ring is wider than the default hub, so the neutral centre
       is widened to match it -- otherwise the ground inside the crown would
       be split three ways and someone could garrison the spawn itself. */
    cols: 35, rows: 27, core: 4.8,
    triLanes: [
      [[17, 13], [12, 13], [7, 13], [7, 6], [2, 6]],
      [[17, 13], [22, 13], [27, 13], [27, 6], [32, 6]],
      [[17, 13], [17, 18], [14, 18], [14, 21], [20, 21], [20, 24], [17, 24]]
    ],
    /* The ring itself. Three gaps -- west, east and south -- are the only ways
       out, and the wall is unbuildable, so the crown is ground nobody holds
       and everybody has to walk past. The last two entries are islands inside
       the third arm's folds, for the reason recorded on CONFLUENCE: MEASURED
       at 71.0 / 71.0 / 96.3 lane-tiles under the best eight placements, and
       71.0 / 71.0 / 73.5 with them. */
    blocks: [
      [12, 9, 22, 9],
      [12, 17, 16, 17], [18, 17, 22, 17],
      [12, 10, 12, 12], [12, 14, 12, 16],
      [22, 10, 22, 12], [22, 14, 22, 16],
      [15, 19, 17, 20], [18, 22, 19, 23]
    ],
    /* Third build node matched to the other two: (17, 22) covered 11.8 lane-
       tiles against their 8.5, (16, 22) covers 8.3. */
    triNodes: [
      ['void', 'build', [9, 10], [25, 10], [16, 22]],
      ['fire', 'lane', [7, 10], [27, 10], [16, 18]]
    ],
    lanes: [[[17, 13], [12, 13], [7, 13], [7, 6], [2, 6]]]
  },
  {
    id: 'carousel', name: 'THE CAROUSEL', tier: 5, tri: true,
    blurb: 'Three arms, each hooking a full turn around its own island before it reaches a base. Every commander watches their lane twice — if they can afford both bends.',
    trait: 'THREE-WAY WAR · three hooks, three islands',
    roster: ['crawler', 'sprinter', 'blink', 'wisp', 'wraith', 'nullifier', 'warchief', 'carrier'],
    denizens: ['nullifier', 'blink'],
    sigNote: 'Carousel drift — nullifiers and blink-shifters ride the arms.',
    cols: 33, rows: 29, core: 3.6,
    triLanes: [
      [[16, 13], [16, 9], [11, 9], [11, 15], [6, 15], [6, 8], [2, 8]],
      [[16, 13], [16, 9], [21, 9], [21, 15], [26, 15], [26, 8], [30, 8]],
      [[16, 13], [16, 18], [20, 18], [20, 24], [12, 24], [12, 27], [16, 27]]
    ],
    /* One island inside each hook. Without them the inside of a bend was the
       best tile on the board three times over, and every game was the same. */
    blocks: [[8, 11, 10, 13], [22, 11, 24, 13], [14, 19, 18, 21]],
    triNodes: [
      /* Third node matched to the flanking pair's own-lane coverage: theirs
         hold 2.8 lane-tiles, (16, 22) held 5.3, (13, 21) holds 2.8. */
      ['storm', 'build', [8, 7], [24, 7], [13, 21]],
      ['venom', 'lane', [11, 12], [21, 12], [16, 24]]
    ],
    lanes: [[[16, 13], [16, 9], [11, 9], [11, 15], [6, 15], [6, 8], [2, 8]]]
  },
  {
    id: 'orrery', name: 'THE ORRERY', tier: 5, tri: true,
    blurb: 'Two rings of wall around one spawn, three gaps in each. Every march threads the inner gap, crosses the annulus and threads the outer one — and the annulus belongs to nobody.',
    trait: 'THREE-WAY WAR · nested rings, six gaps',
    roster: ['crawler', 'wisp', 'blink', 'shardling', 'revenant', 'basalt', 'warden', 'juggernaut'],
    denizens: ['warden', 'wisp'],
    sigNote: 'Orrery shell — wardens grind forward while wisps drift over the walls.',
    cols: 33, rows: 29, core: 3.6,
    triLanes: [
      [[16, 14], [12, 14], [9, 14], [9, 8], [11, 8], [11, 5], [11, 8], [3, 8]],
      [[16, 14], [20, 14], [23, 14], [23, 8], [21, 8], [21, 5], [21, 8], [29, 8]],
      [[16, 14], [16, 18], [11, 18], [11, 21], [21, 21], [21, 22], [16, 22], [16, 26]]
    ],
    /* Inner ring, then outer ring. The walls are unbuildable and the gaps are
       the only ground the lanes can use, so the annulus between them is a
       corridor every commander fights over and nobody can fortify. */
    blocks: [
      [12, 10, 20, 10], [12, 18, 15, 18], [17, 18, 20, 18],
      [12, 11, 12, 13], [12, 15, 12, 17], [20, 11, 20, 13], [20, 15, 20, 17],
      [7, 5, 10, 5], [12, 5, 20, 5], [22, 5, 25, 5],
      [7, 23, 15, 23], [17, 23, 25, 23],
      [7, 6, 7, 22], [25, 6, 25, 22]
    ],
    triNodes: [
      /* Third node matched to the flanking pair: theirs hold 5.5 lane-tiles,
         (16, 20) held 14.3 -- the best tile on that side of the board with an
         attunement bonus on top -- and (11, 22) holds 5.5. */
      ['frost', 'build', [14, 7], [18, 7], [11, 22]],
      ['void', 'lane', [9, 11], [23, 11], [13, 21]]
    ],
    lanes: [[[16, 14], [12, 14], [9, 14], [9, 8], [11, 8], [11, 5], [11, 8], [3, 8]]]
  },
  {
    id: 'lattice', name: 'THE LATTICE', tier: 3,
    roster: ['mite', 'crawler', 'sprinter', 'wisp', 'cluster', 'jammer', 'herald', 'anchorite'],
    denizens: ['herald', 'mite'], sigNote: 'Signal lattice — heralds and mites pour down every line at once.',
    blurb: 'Three lanes, one gate. Every wave arrives in thirds, and the only ground that answers all three is the last five tiles before your base.',
    trait: 'Three lanes · one shared gate',
    cols: 32, rows: 19,
    lanes: [
      [[15, 2],  [9, 2],  [9, 5],  [4, 5],  [4, 9], [-1, 9]],
      [[15, 9],  [11, 9], [11, 12], [6, 12], [6, 9], [-1, 9]],
      [[15, 16], [9, 16], [9, 13], [4, 13], [4, 9], [-1, 9]]
    ],
    /* Parked against the middle lane's outer bend, where a single tower would
       otherwise have covered the middle and one flank together. */
    blocks: [[12, 7, 13, 8], [12, 10, 13, 11], [0, 0, 1, 1], [0, 17, 1, 18]],
    /* One node per lane and a fourth deep in the pocket: on a three-lane board
       a node you cannot reach in time is worth nothing, so they sit early.
       Heralds are frost-weak and the frost node is deliberately on the far
       flank from where heralds enter. */
    nodes: [[10, 3, 'frost', 'build'], [10, 15, 'storm', 'build'],
            [2, 7, 'void', 'build'], [9, 4, 'venom', 'lane']]
  },
  {
    id: 'causeway', name: 'THE CAUSEWAY', tier: 4,
    roster: ['crawler', 'wisp', 'aegis', 'shardling', 'nullifier', 'basalt', 'warden', 'bastion'],
    denizens: ['warden', 'nullifier'], sigNote: 'The causeway garrison — wardens and nullifiers hold the span.',
    blurb: 'Two lanes run the far edges of a broken span and never turn back. Every tile you own is on the bridge between them, and the middle of the bridge reaches neither.',
    trait: 'One strip of ground · no second pass',
    cols: 30, rows: 15,
    lanes: [
      [[14, 2],  [3, 2],  [3, 7], [-1, 7]],
      [[14, 12], [3, 12], [3, 7], [-1, 7]]
    ],
    /* The void either side of the span is what makes this map a choice: there
       is no back row to retreat to, and the centre rows of the strip are out
       of reach of both lanes until something extends their range. */
    blocks: [[0, 0, 12, 1], [0, 3, 2, 3], [4, 3, 12, 3], [0, 11, 2, 11], [4, 11, 12, 11], [0, 13, 12, 14]],
    /* One node on each shoulder of the span, one on the north lane. Wardens
       are storm-weak and nullifiers frost-weak, so the offer is fire, the
       element neither of them minds. */
    nodes: [[8, 4, 'fire', 'build'], [8, 10, 'frost', 'build'], [6, 2, 'storm', 'lane']]
  },
  {
    id: 'anvil', name: 'THE ANVIL', tier: 2,
    roster: ['spawnling', 'crawler', 'sprinter', 'cluster', 'aegis', 'bulwark', 'anchorite', 'warchief'],
    denizens: ['anchorite', 'spawnling'], sigNote: 'Anvil terraces — anchorites advance behind their own spawn.',
    blurb: 'The shortest approach in the theatre, walled in by terraces. There is no long lane to whittle anything down on: whatever you build has to kill it in nineteen tiles.',
    trait: 'Shortest lane · terraced ground',
    cols: 22, rows: 21,
    lanes: [[[10, 10], [6, 10], [6, 6], [3, 6], [3, 10], [-1, 10]]],
    /* Terraces, not rubble fields: they push towers into rows behind the lane
       instead of a ring around it, which is what makes the short lane bearable. */
    blocks: [[0, 0, 8, 2], [0, 18, 8, 20], [7, 4, 8, 5], [7, 15, 8, 16],
             [0, 4, 1, 5], [0, 15, 1, 16], [4, 13, 6, 14], [4, 3, 5, 3]],
    /* Anchorites shrug off venom, so the node nearest the lane is the one they
       care least about; the storm node is deep enough that reaching it costs a
       wave of tempo. */
    nodes: [[5, 8, 'venom', 'build'], [2, 12, 'storm', 'build'], [4, 6, 'frost', 'lane']]
  }
];

/** Builds the full mirrored geometry for a map. */
function buildField(map) {
  /* Asked FIRST: an arena map carries a seat count and no mirror axis at all,
     so the two-sided path below has nothing to say about it. */
  if (map.maelstrom) return buildMaelstromField(map);
  if (map.tri) return buildTriField(map);
  const mirror = ([x, y]) => [map.cols - 1 - x, y];
  const lanes0 = map.lanes;
  const lanes1 = lanes0.map(l => l.map(mirror));
  const base0 = lanes0[0][lanes0[0].length - 1];
  const base1 = lanes1[0][lanes1[0].length - 1];
  const c0 = lanes0[0][0], c1 = lanes1[0][0];

  /* Reanimates retrace YOUR primary lane backwards to the centre, then run
     your rival's lane forward. No dedicated corridor exists any more, so the
     send route lies exactly on top of ground both sides already defend. */
  const rev0 = lanes0[0].slice().reverse();
  const rev1 = lanes1[0].slice().reverse();
  const send0 = [...rev0, ...lanes1[0]];
  const send1 = [...rev1, ...lanes0[0]];

  const blocked = new Set();
  for (const [x0, y0, x1, y1] of (map.blocks || [])) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      blocked.add(x + ',' + y);
      blocked.add((map.cols - 1 - x) + ',' + y);   // mirror the terrain too
    }
  }

  /* Nodes mirror exactly as the terrain above does. A node authored on top of
     rubble is DROPPED rather than buried under it -- and since terrain mirrors
     too, a drop always takes both copies, so the boards stay identical. */
  const nodes = [];
  for (const [nx, ny, el, kind] of (map.nodes || [])) {
    [nx, map.cols - 1 - nx].forEach((gx, side) => {
      const key = gx + ',' + ny;
      if (blocked.has(key)) return;
      nodes.push({ gx, gy: ny, el, kind, key, side });
    });
  }

  const allCentreX = lanes0.concat(lanes1).map(l => l[0][0]);
  return {
    cols: map.cols, rows: map.rows,
    lanes: [lanes0, lanes1],                       // arrays of lanes per side
    sendPaths: [send0, send1],
    airLanes: [[c0, base0], [c1, base1]],
    terrain: blocked,
    nodes, nodeMap: new Map(nodes.map(n => [n.key, n])),
    neutral: { from: Math.min(...allCentreX) - 1, to: Math.max(...allCentreX) + 1 },
    buildMax: [Math.min(...allCentreX) - 2, Math.max(...allCentreX) + 2],
    bases: [base0, base1]
  };
}

/** Which elements a board lends, for the briefing card. A duo map authors one
    node and mirrors it; a tri map authors one triple. Both answer the same
    question, so both flatten to the same shape -- and neither counts a copy
    that only exists because of the mirror. */
function mapNodeChips(map) {
  if (!map) return [];
  if (map.tri) return (map.triNodes || []).map(spec => ({ el: spec[0], kind: spec[1] }));
  return (map.nodes || []).map(n => ({ el: n[2], kind: n[3] }));
}

/** The terrain node on ONE tile, or null. `kind` filters, so a caller that
    only cares about build nodes can never be handed a lane node by mistake. */
function nodeAt(gx, gy, kind) {
  const n = FIELD && FIELD.nodeMap && FIELD.nodeMap.get(gx + ',' + gy);
  return n && (!kind || n.kind === kind) ? n : null;
}

/* --------------------------------------------------------------------------
   TRI-FIELD

   CONFLUENCE is a three-commander battleground: three lanes radiate from a
   central spawn to three bases. Every kill reanimates toward BOTH rivals, so
   the dead walk twice as thick here.
-------------------------------------------------------------------------- */
/* How much ground around the shared spawn belongs to nobody. A tri board cannot
   be mirrored into fairness, so the hub it radiates from is neutral for
   everyone; a map with a bigger centrepiece raises it (CROWN's walled ring is
   wider than this default and would otherwise poke into one commander's land). */
const TRI_CORE_RADIUS = 3.2;

/* Lane tints, one per commander, used by the board and by the map thumbnail.
   The third only appears on a tri board -- and until it existed, the third
   lane was drawn in nothing at all. */
const LANE_TINTS = ['#38e8ff', '#ff6b9d', '#ffd166'];
const LANE_FLOW_TINTS = ['rgba(56,232,255,0.26)', 'rgba(255,107,157,0.26)', 'rgba(255,209,102,0.26)'];

function buildTriField(map) {
  const L = map.triLanes;                       // one authored lane per commander
  const bases = L.map(l => l[l.length - 1]);
  const spawn = L[0][0];
  /* send route from killer i to victim j: retrace i's lane, then run j's */
  const sendTri = L.map((li, i) => L.map((lj, j) =>
    i === j ? null : [...li.slice().reverse(), ...lj]));

  const blocked = new Set();
  for (const [x0, y0, x1, y1] of (map.blocks || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked.add(x + ',' + y);

  /* territory: nearest base owns the tile; the centre ring belongs to no one */
  const core = map.core || TRI_CORE_RADIUS;
  const owner = [];
  for (let gy = 0; gy < map.rows; gy++) {
    owner[gy] = [];
    for (let gx = 0; gx < map.cols; gx++) {
      const dc = Math.hypot(gx - spawn[0], gy - spawn[1]);
      if (dc < core) { owner[gy][gx] = -1; continue; }
      let best = 0, bd = 1e9;
      /* A tie is the exact midline between two commanders. Awarding it to
         whichever base was authored first handed side 0 every boundary tile on
         a symmetric board -- eight free tiles on CONFLUENCE. A tie is no-man's
         land instead, which is also what it looks like. */
      bases.forEach((b, i) => {
        const d = Math.hypot(gx - b[0], gy - b[1]);
        if (d < bd - 1e-6) { bd = d; best = i; }
        else if (Math.abs(d - bd) <= 1e-6) best = -1;
      });
      owner[gy][gx] = best;
    }
  }

  /* An x-mirror cannot make three lanes symmetric, so a tri node is authored as
     a TRIPLE instead: one element, one kind, one tile per commander. The triple
     is dropped WHOLE unless its tiles land in three different territories, so
     an authoring slip costs the node rather than the fairness. */
  const nodes = [];
  for (const spec of (map.triNodes || [])) {
    const el = spec[0], kind = spec[1], pts = spec.slice(2);
    if (pts.length !== bases.length) continue;
    const cells = pts.map(([gx, gy]) => (owner[gy] || [])[gx]);
    if (cells.some(c => c === undefined || c < 0)) continue;
    if (new Set(cells).size !== cells.length) continue;
    if (pts.some(([gx, gy]) => blocked.has(gx + ',' + gy))) continue;
    pts.forEach(([gx, gy], i) =>
      nodes.push({ gx, gy, el, kind, key: gx + ',' + gy, side: cells[i] }));
  }

  return {
    cols: map.cols, rows: map.rows, tri: true,
    lanes: L.map(l => [l]),
    sendPaths: [sendTri[0][1], sendTri[1][0]],   // legacy 2-way accessors stay valid
    sendTri,
    airLanes: L.map(l => [l[0], l[l.length - 1]]),
    terrain: blocked,
    nodes, nodeMap: new Map(nodes.map(n => [n.key, n])),
    neutral: { from: spawn[0] - 2, to: spawn[0] + 2 },
    buildMax: [spawn[0] - 2, spawn[0] + 2],
    bases, spawn, ownerGrid: owner
  };
}

/* --------------------------------------------------------------------------
   THE MAELSTROM — the N-seat black hole arena

   The universe map's singularity opens onto one board seating up to twenty
   commanders. It is buildTriField's shape taken to N: one spawn at the centre,
   one lane and one base per seat, an ownership grid, and a send matrix — none
   of it special-cased to twenty, all of it solved from the seat count.

   THE GEOMETRY IS BUILT IN THE L1 (TAXICAB) METRIC ON PURPOSE. Lanes have to
   be axis-aligned: every authored lane in this game is, and Path.blockedTiles
   only stays one tile wide while they are. But the taxicab length of an
   axis-aligned lane out to a point on a CIRCLE swings by 41% with its angle,
   which would hand the seats on the diagonals half again as much firing lane
   as the seats on the axes. Bases therefore sit on the L1 circle — a diamond —
   where every seat's lane is exactly MAELSTROM radius tiles long by
   construction, and the event horizon (also L1) takes a similar slice out of
   every wedge at once instead of favouring whoever points at a corner.

   THE ARENA RULE, from the owner: incoming troops do NOT reanimate for the
   defender. Killing an attacker gives you nothing to send. You send by MUSTER
   alone — and every reanimation bonus you own still rides what you send. The
   rule lives on the FIELD (`noReanim`) rather than on a side, so it applies
   identically to all twenty seats; see Game.killEnemy.
-------------------------------------------------------------------------- */

/* Twenty is the owner's number and the size the board is solved for. Below
   four the ring is a duel with dead ground between the lanes, so the lobby
   cannot ask for fewer. */
const MAELSTROM_MAX_SEATS = 20;
const MAELSTROM_MIN_SEATS = 4;

/* Buildable tiles a seat should end up holding. The board radius is SOLVED
   from this, so adding seats grows the board instead of thinning every wedge
   until nobody can field a defence. Measured on the built field: 29-32 tiles
   a seat at twenty, 22 at four. */
const MAELSTROM_SEAT_GROUND = 18;
/* Radius clamps, in tiles. The upper one is what stops a full house from
   producing a board too large to read: 22 gives a 47x47 field. */
const MAELSTROM_MIN_RADIUS = 8;
const MAELSTROM_MAX_RADIUS = 22;

/* The hub the lanes radiate from belongs to nobody, exactly as
   TRI_CORE_RADIUS does on a three-way board -- but measured in L1 and scaled
   with the board, so a small ring does not give its entire middle away. */
const MAELSTROM_CORE_FRAC = 0.2;
const MAELSTROM_CORE_MIN = 2.5;
const MAELSTROM_CORE_MAX = 4.5;

/* THE CONTRACTION. Every MAELSTROM_CONTRACT_WAVES waves the event horizon
   grows by MAELSTROM_HORIZON_STEP tiles and every tile inside it -- towers
   included -- is gone. It stops at MAELSTROM_HORIZON_MAX_FRAC of the radius,
   which is what guarantees it can never reach a base: the singularity takes
   ground, never a seat. */
const MAELSTROM_CONTRACT_WAVES = 3;
const MAELSTROM_HORIZON_STEP = 1.5;
const MAELSTROM_HORIZON_MAX_FRAC = 0.55;

/* Ownership is levelled band by band -- one band per contraction step -- so
   each seat holds the same ground NOW and the same ground after every step.
   The weight is what those two objectives trade against each other; measured
   at twenty seats, 2 gives 29-32 tiles held and 26-27 surviving a full
   contraction, against 27-34 and 23-29 with the wedges left raw. */
const MAELSTROM_BALANCE_WEIGHT = 2;
const MAELSTROM_BALANCE_PASSES = 200;

/* Sends march on the seat this many places around the ring; a fallen seat is
   skipped. ONE target, not nineteen: a send that hit every rival at once would
   put 19x tier.count units on the board per purchase, which is a spawn contest
   rather than a defence -- and it would make the muster panel's printed count
   a lie for the sixth time. */
const MAELSTROM_SEND_ARC = 1;

/* Rival brains all deliberate on one 0.55s clock. Without a stagger twenty of
   them think on the same frame and the arena hitches once a second. */
const MAELSTROM_THINK_STAGGER = 0.11;

/* Accretion arcs drawn around the singularity. Deliberately few: the board
   already carries ~300 live units at twenty seats. */
const MAELSTROM_DISC_ARCS = 3;

/* The singularity throws back whatever it has swallowed, so the arena roster
   is fixed rather than drawn from a holder -- nobody garrisons a black hole. */
const MAELSTROM_ROSTER = ['mite', 'crawler', 'sprinter', 'wisp', 'cluster', 'aegis', 'warden', 'carrier'];
const MAELSTROM_DENIZENS = ['crawler', 'wisp'];

/* THE ON-BOARD BASE PIPS. A duel has two of them at opposite edges of the
   board and can afford to shout; the arena has up to twenty round a ring,
   where bold 15px hearts and their captions collide near the vertical
   vertices. Above the threshold both fonts step down rather than the captions
   being dropped -- seat attrition is the whole shape of that mode and the
   counts have nowhere else to be read, because the arena ladder prints
   alive/dead only and css/polish.css hides the third-commander panel there.
   Guards against: twenty legible counts becoming twenty illegible ones.
   BATCH-C/nside */
const PIP_CROWD_SEATS = 4;            /* above this many seats, step the fonts down */
const PIP_FONT_PX = 15;               /* life count, duel or tri board */
const PIP_FONT_PX_CROWD = 12;         /* ...and on a crowded ring */
const PIP_LABEL_PX = 9;               /* YOU / RIVAL / SEAT n caption */
const PIP_LABEL_PX_CROWD = 8;

/* The universe map's singularity: centre of the 100x66 viewBox, the pull it
   exerts on the systems, and how long that pull takes to arrive. The drift is
   asymptotic (1 - e^-t/TAU) so the map keeps falling for as long as it is
   watched and never actually arrives -- a linear pull would eventually stack
   every system on the hole and leave the screen unusable. */
/* FALLBACKS ONLY. The real centre is read off the live viewBox at mount --
   the universe map has been re-framed once already and a hole nailed to
   literal coordinates ends up sitting off to one side the next time it is. */
const MV_HOLE_X = 50, MV_HOLE_Y = 33, MV_HOLE_W = 100;
/* How far the map squashes y. GX_RENDER_SQUASH wins where the galaxy defines
   one; this is what the universe map used before it did. */
const MV_HOLE_SQUASH = 0.66;
/* The painted singularity, sized off the same disc radius the vector rings
   use. SPREAD over 1 would push the plate out over the systems that fall
   closest -- the pull floors at 1 - MV_PULL_MAX, so a plate wider than the
   disc swallows a world the player still has to be able to click. FADE is
   where the soft mask starts: the plate is square and what is behind it is
   a starfield, so a hard edge reads as a pasted tile rather than a hole. */
const MV_HOLE_PLATE_SPREAD = 0.98;
const MV_HOLE_PLATE_FADE = 0.52;
const MV_PULL_MAX = 0.17;
const MV_PULL_TAU = 26;
const MV_SWIRL_TURNS = 0.55;

/** Board radius for a seat count, in tiles. */
function maelstromRadius(seats) {
  /* Solves 2T^2/n - 1.25T = MAELSTROM_SEAT_GROUND. The diamond holds 2T^2
     tiles, every seat owns an equal share of them, and its own lane swallows
     about 1.25 tiles for every tile of length (a staircase blocks one tile per
     step plus its corners). */
  const a = 2 / seats, b = -1.25, c = -MAELSTROM_SEAT_GROUND;
  const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return clamp(Math.ceil(t), MAELSTROM_MIN_RADIUS, MAELSTROM_MAX_RADIUS);
}

/**
 * A synthesised MAP for a seat count. Deliberately NOT a member of MAPS: the
 * arena is entered through the singularity and never from the campaign trail,
 * and a map in MAPS is a world the galaxy can hand you.
 */
function maelstromMap(seats) {
  const n = clamp(Math.round(seats) || MAELSTROM_MAX_SEATS, MAELSTROM_MIN_SEATS, MAELSTROM_MAX_SEATS);
  const T = maelstromRadius(n);
  /* One tile of ground behind even the bases that sit on an axis. */
  const dim = 2 * T + 3;
  return {
    id: 'maelstrom', name: 'THE MAELSTROM', tier: 5, maelstrom: n,
    cols: dim, rows: dim,
    roster: MAELSTROM_ROSTER.slice(), denizens: MAELSTROM_DENIZENS.slice(),
    sigNote: 'The singularity throws back everything it has swallowed.',
    blurb: 'A singularity with ' + n + ' seats around it. Nothing you kill comes back to you here — ' +
           'the dead fall inward. You may still muster, and every bonus you hold rides what you send.',
    trait: n + ' SEATS · no reanimation · the horizon contracts'
  };
}

/** One seat's lane: an axis-aligned staircase from the hub out to its base. */
function maelstromLane(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const sx = Math.sign(dx), sy = Math.sign(dy), ax = Math.abs(dx), ay = Math.abs(dy);
  let x = x0, y = y0, tx = 0, ty = 0;
  const pts = [[x, y]];
  /* It HUGS the straight line rather than taking a dog-leg: near the hub a
     wedge is barely a tile wide, and a lane that wandered out of its own would
     run through a neighbour's build ground. */
  for (let i = 0; i < ax + ay; i++) {
    if ((tx < ax && (ty + 1) * ax >= (tx + 1) * ay) || ty >= ay) { x += sx; tx++; }
    else { y += sy; ty++; }
    pts.push([x, y]);
  }
  /* Collinear steps merge into runs, so a Path carries a handful of segments
     instead of one per tile -- posAt walks them linearly, once per unit per
     frame, and there are three hundred units on this board. */
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
  }
  if (pts.length > 1) out.push(pts[pts.length - 1]);
  return out;
}

function buildMaelstromField(map) {
  const n = map.maelstrom, T = maelstromRadius(n);
  const cx = T + 1, cy = T + 1;
  const core = clamp(MAELSTROM_CORE_FRAC * T, MAELSTROM_CORE_MIN, MAELSTROM_CORE_MAX);
  const l1 = (gx, gy) => Math.abs(gx - cx) + Math.abs(gy - cy);

  /* The rim, parametrised 0..4 -- one unit per side of the diamond. */
  const V = [[T, 0], [0, T], [-T, 0], [0, -T]];
  const rim = u => {
    const s = Math.floor(u) % 4, f = u - Math.floor(u);
    const a = V[s], b = V[(s + 1) % 4];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  /* ...and the same parameter read back off a direction, which is how a tile
     is told which seat's wedge it stands in. */
  const rimU = (dx, dy) => {
    const L = Math.abs(dx) + Math.abs(dy);
    if (!L) return 0;
    const x = dx / L, y = dy / L;
    if (x >= 0 && y >= 0) return y;
    if (x < 0 && y >= 0) return 1 - x;
    if (x < 0 && y < 0) return 2 - y;
    return 3 + x;
  };

  const bases = [], lanes = [];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const p = rim(4 * i / n);
    /* Rounding the x and DERIVING the y keeps |dx| + |dy| exactly T, which is
       the whole reason every seat's lane comes out the same length. */
    let bx = Math.round(p[0]);
    const sgn = p[1] > 0 ? 1 : p[1] < 0 ? -1 : 0;
    /* Two seats can only round onto one tile on an absurdly small ring; nudge
       rather than seat two commanders on the same base. */
    while (seen.has(bx + ',' + sgn) && Math.abs(bx) < T) bx += (bx >= 0 ? 1 : -1);
    seen.add(bx + ',' + sgn);
    const by = sgn * (T - Math.abs(bx));
    bases.push([cx + bx, cy + by]);
    lanes.push(maelstromLane(cx, cy, cx + bx, cy + by));
  }

  /* Territory: the wedge between the rim midpoints either side of a seat. Not
     a Voronoi over the bases -- on a diamond the bases are not equidistant
     from the centre, so a Voronoi would hand the seats nearest the vertices a
     bigger cell. Bounded by midpoints, every cell is a triangle on an equal
     length of rim with the same height, so every cell has the same area. */
  const mids = [];
  for (let i = 0; i < n; i++) mids.push((4 * (i + 0.5) / n) % 4);
  const owner = [], voidTiles = new Set();
  for (let gy = 0; gy < map.rows; gy++) {
    owner[gy] = [];
    for (let gx = 0; gx < map.cols; gx++) {
      const d = l1(gx, gy);
      if (d > T) { owner[gy][gx] = -1; voidTiles.add(gx + ',' + gy); continue; }
      if (d < core) { owner[gy][gx] = -1; continue; }
      const u = rimU(gx - cx, gy - cy);
      let seat = 0;
      for (let i = 0; i < n; i++) {
        const lo = mids[(i - 1 + n) % n], hi = mids[i];
        if (lo < hi ? (u > lo && u <= hi) : (u > lo || u <= hi)) { seat = i; break; }
      }
      owner[gy][gx] = seat;
    }
  }

  /* Which tiles the lanes take. Mirrors Path.blockedTiles rather than guessing:
     the balance below is only fair if it counts the ground that is actually
     left to build on. */
  const laneBlocked = new Set();
  for (const l of lanes) for (const k of new Path(l).blockedTiles()) laneBlocked.add(k);

  /* THE BALANCE. Tiles are bucketed into the bands the horizon will eat, one
     band per contraction step, and ownership of boundary tiles is traded until
     both the per-band counts and the totals are level. A transfer only ever
     goes to a seat that already owns the tile next door, so no cell is left
     scattered across the board. */
  const edges = [];
  const hMax = MAELSTROM_HORIZON_MAX_FRAC * T;
  /* The bands have to be the steps Game.maelstromContract will actually take,
     INCLUDING the short last one where it clamps to the cap -- a band the
     balance never saw is a band the horizon eats unevenly. */
  for (let h = core + MAELSTROM_HORIZON_STEP; h < hMax - 1e-9; h += MAELSTROM_HORIZON_STEP) edges.push(h);
  edges.push(hMax);
  const bandOf = (gx, gy) => {
    const d = l1(gx, gy);
    for (let i = 0; i < edges.length; i++) if (d <= edges[i]) return i;
    return edges.length;
  };
  const cells = [];
  const band = [], total = new Array(n).fill(0);
  for (let b = 0; b <= edges.length; b++) band.push(new Array(n).fill(0));
  for (let gy = 0; gy < map.rows; gy++)
    for (let gx = 0; gx < map.cols; gx++) {
      const o = owner[gy][gx];
      if (o < 0 || laneBlocked.has(gx + ',' + gy)) continue;
      const b = bandOf(gx, gy);
      cells.push([gx, gy, b]);
      band[b][o]++; total[o]++;
    }
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let pass = 0; pass < MAELSTROM_BALANCE_PASSES; pass++) {
    let moved = false;
    for (const c of cells) {
      const gx = c[0], gy = c[1], b = c[2], a = owner[gy][gx];
      for (const s of STEPS) {
        const row = owner[gy + s[1]];
        if (!row) continue;
        const o2 = row[gx + s[0]];
        if (o2 === undefined || o2 < 0 || o2 === a) continue;
        /* Least squares on both objectives at once: the move has to pay for
           the +1/-1 it costs on each side of the ledger before it is taken. */
        const gain = MAELSTROM_BALANCE_WEIGHT * (band[b][o2] - band[b][a]) + (total[o2] - total[a]);
        if (gain < -(MAELSTROM_BALANCE_WEIGHT + 1)) {
          owner[gy][gx] = o2;
          band[b][a]--; band[b][o2]++; total[a]--; total[o2]++;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }

  /* THE SEND MATRIX. A sent unit does not retrace its sender's lane the way a
     reanimate does on a two-sided board: it goes down the hole and comes back
     out of the singularity, which is the victim's own lane. That keeps the
     board legible (everything enters at the centre), keeps N^2 routes down to
     N distinct paths, and means defendedPaths() is one lane per seat rather
     than nineteen. */
  const sendTri = [];
  for (let i = 0; i < n; i++) {
    sendTri.push([]);
    for (let j = 0; j < n; j++) sendTri[i].push(i === j ? null : lanes[j]);
  }

  return {
    cols: map.cols, rows: map.rows, tri: true, radial: true, seats: n,
    /* The board's own law, not a side's: nothing that walks in reanimates. */
    noReanim: true,
    lanes: lanes.map(l => [l]),
    sendPaths: [sendTri[0][1], sendTri[1][0]],   // legacy 2-way accessors stay valid
    sendTri,
    airLanes: lanes.map(l => [l[0], l[l.length - 1]]),
    terrain: new Set(),                          // the arena authors no rubble
    nodes: [], nodeMap: new Map(),
    neutral: { from: cx, to: cx },
    buildMax: [cx, cx],
    bases, spawn: [cx, cy], ownerGrid: owner,
    centre: [cx, cy], radius: T, core,
    horizon: core, horizonMax: MAELSTROM_HORIZON_MAX_FRAC * T,
    voidTiles
  };
}

/* --------------------------------------------------------------------------
   THREAT LEVEL
-------------------------------------------------------------------------- */
const DIFFICULTIES = [
  { id: 'skirmish',  name: 'SKIRMISH',  hp: 0.80, gold: 1050, lives: 25, aiSkill: 0.60, aiEcon: 0.9,
    blurb: 'A forgiving opponent. Learn the roster here.' },
  { id: 'contested', name: 'CONTESTED', hp: 1.00, gold: 900, lives: 20, aiSkill: 0.86, aiEcon: 1.0,
    blurb: 'A competent rival that scouts, counters and rushes.' },
  { id: 'overrun',   name: 'OVERRUN',   hp: 1.22, gold: 780, lives: 15, aiSkill: 1.00, aiEcon: 1.2,
    blurb: 'Ruthless and economically ahead. Punishes every wasted tile.' }
];

/* --------------------------------------------------------------------------
   ASCENSION — the price roughly 2.3x per step against 1.34x power.
-------------------------------------------------------------------------- */
/**
 * Ascension. The FIRST ascension already costs more than twice the tier-4
 * specialisation that preceded it, and every step after that multiplies again.
 * Power grows 1.34x per step, so each ascension is deliberately less efficient
 * than the last — you ascend because tiles are finite, not because it is cheap.
 */
const ASCENSION = {
  damage: 1.34, rate: 1.07, range: 1.035,
  /* cost_n = (2 x paid specialisation) ^ (1.1618 ^ (n-1)) — the EXPONENT
     itself compounds by the golden step, so ascending quickly becomes
     absurd compared with placing yet another (geometrically pricier) tower. */
  expBase: 2, expGolden: 1.1618, surgeEvery: 2
};
/* --------------------------------------------------------------------------
   BASE LEVEL

   The base itself can be upgraded, infinitely. Each level:
     - hardens the base (+2 maximum lives),
     - strengthens your reanimated dead (+5% each level),
     - and every tower you PLACE from then on arrives already at that level --
       through MK levels, then the specialisation (chosen free on placement),
       then genuine ascension levels.

   The price of level N is 80% of what upgrading five towers to that same
   level would cost, using the roster-average price for that step.
-------------------------------------------------------------------------- */
function baseLevelStepCost(nextLevel, upCostMul) {
  const ids = TOWER_ORDER;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  let per;
  if (nextLevel <= 3) {
    /* Reads the table prices, which applyGoldSquish has already divided, so
       this function scales with the economy on its own. The fallbacks are
       authored figures and go through sqGold once like any other literal. */
    per = mean(ids.map(id => (TOWER_TYPES[id].levels[nextLevel - 2] || { cost: sqGold(200) }).cost)) * UPGRADE_COST_SCALE;
  } else if (nextLevel === 4) {
    per = mean(ids.map(id => (TOWER_TYPES[id].branches[0] || { cost: sqGold(400) }).cost)) * UPGRADE_COST_SCALE;
  } else {
    const paid = mean(ids.map(id => (TOWER_TYPES[id].branches[0] || { cost: sqGold(400) }).cost)) * UPGRADE_COST_SCALE;
    per = ascendCost(paid, nextLevel - 5);
  }
  return Math.max(1, Math.round(per * 5 * 0.8 * (upCostMul || 1)));
}

function ascendCost(paidBranch, ascLevel) {
  const exp = Math.pow(ASCENSION.expGolden, ascLevel);
  const c = Math.pow(paidBranch * ASCENSION.expBase, exp);
  return Math.min(9e14, Math.round(c));
}

/** Level-upgrade prices are multiplied by this on top of the authored numbers. */
const UPGRADE_COST_SCALE = 2.6;   /* upgrades were still the cheap path */

/* --------------------------------------------------------------------------
   TOWER TECH ORIGINS

   Every tower is built by somebody, and the builder is a MECHANICAL identity
   rather than a label: each origin carries a rider the engine actually reads.
   The registry itself (names, icons, faction colours, gating) lives in
   js/factions.js, which is where the faction palette already is; only the
   numbers live here, where every tunable belongs.

   HUMAN    no clause at all, the widest element coverage of any origin, and
            ADAPTIVE MOUNTS -- alien hardware on a human frame.
   LIGHT    SUPPRESSION -- strips what the target is protected by.
   XENO     PUNISH -- damage that scales off the ENEMY's own state.
   PIRATE   OVERLOAD -- a proc with a real downside behind it.
   ROBOTIC  LATTICE -- no proc whatsoever, paid for by standing together.

   Every magnitude below is deliberately SMALL. Both commanders draw from the
   same origin pool, so a rider big enough to swing a duel swings it for
   whichever side simply placed more towers -- which is the attrition curve
   re-priced, not a design. These five numbers are the balance levers if the
   mirror-AI harness moves off its pins.
-------------------------------------------------------------------------- */

/* HUMAN -- ADAPTIVE MOUNTS. Humanity's whole thesis is bolting other people's
   technology onto its own hulls, so a human tower attunes to a build node of
   ANY element instead of only a matched one. Deliberately reuses
   NODE_ATTUNE_DAMAGE rather than introducing a second attunement magnitude:
   two numbers meaning the same thing drift apart the first time either is
   retuned, and this one is already calibrated. */
const ORIGIN_HUMAN_ANY_NODE = true;

/* LIGHT -- SUPPRESSION. How long a Federation hit holds the target's
   protections open. Short on purpose: it must be a window the rest of your
   line has to shoot into, not a debuff that is simply always on. */
const ORIGIN_LIGHT_SUPPRESS = 2.5;
/* ...and how much of that protection is stripped while it holds. Kept under
   half so a 65%-splash-resistant Shardling is still merely shellable rather
   than deleted, and so a magic-immune unit stays magic-immune. */
const ORIGIN_LIGHT_STRIP = 0.40;

/* XENO -- PUNISH. Bonus damage as a fraction of the hit, scaling with how
   wounded the target ALREADY is: nothing at full health, this much at zero,
   so the average over a kill is roughly half of it. Dealt as PURE and flagged
   as a tick so it neither re-rolls armour nor collects the min-1 floor, which
   on a 60 Hz cone would be free damage every frame. */
const ORIGIN_XENO_PUNISH = 0.30;

/* PIRATE -- OVERLOAD. Chance for a strike to overload, and what the overload
   is worth. The cooldown is the load-bearing part: without it a cone or beam
   rolls this dice sixty times a second and the "variance" averages straight
   back into a flat damage buff. */
const ORIGIN_PIRATE_PROC = 0.22;
const ORIGIN_PIRATE_MULT = 1.60;
const ORIGIN_PIRATE_PROC_CD = 1.1;
/* Each overload banks heat; this many jams the tower for this long. The
   downside is the entire point -- a pirate emplacement you never let cool is
   an emplacement that is offline when the wave that mattered arrives. */
const ORIGIN_PIRATE_HEAT_MAX = 5;
const ORIGIN_PIRATE_JAM = 1.2;

/* ROBOTIC -- LATTICE. Links are counted between robotic towers inside this
   radius, plus one for a build node (a tile with a power tap of its own), and
   capped so that a corner packed with eight machines is not a different game
   from a corner with four. Damage and rate are separate because rate compounds
   with every aura on the board and damage does not. */
const ORIGIN_LATTICE_TILES = 2.2;
const ORIGIN_LATTICE_MAX = 4;
const ORIGIN_LATTICE_DAMAGE = 0.05;
const ORIGIN_LATTICE_RATE = 0.035;

/* Rival parity. What one lattice link is worth to the brain, expressed in the
   same value units utilityValue already scores support structures in, so an
   origin edge competes on score-per-gold with building and upgrading instead
   of being bolted on outside the comparison. */
const AI_ORIGIN_LATTICE_VALUE = 46;

/** Talent points available per tower, one per row of its tree. */

/* --------------------------------------------------------------------------
   LEVEL ROLLS
   Tiers 2 and 3 no longer present a choice — each grants one RANDOM minor
   buff from this pool. The deliberate decisions live in the pre-match talent
   tree and the tier-4 specialisation.
-------------------------------------------------------------------------- */
const LEVEL_ROLLS = [
  { id: 'r_dmg',   name: 'CALIBRATED',   desc: '+9% damage',                mods: { damageMul: 1.09 } },
  { id: 'r_rate',  name: 'LUBRICATED',   desc: '+9% fire rate',             mods: { rateMul: 1.09 } },
  { id: 'r_range', name: 'SIGHTED',      desc: '+11% range',                mods: { rangeMul: 1.11 } },
  { id: 'r_splash',name: 'PACKED',       desc: '+14% splash radius',        mods: { splashMul: 1.14 } },
  { id: 'r_status',name: 'POTENT',       desc: '+14% status potency',       mods: { statusMul: 1.14 } },
  { id: 'r_pierce',name: 'HARDENED',     desc: 'Ignores 9% more armour',    mods: { pierce: 0.09 } },
  { id: 'r_crit',  name: 'KEEN',         desc: '+6% critical chance',       mods: { crit: 0.06 } },
  { id: 'r_mixed', name: 'BALANCED',     desc: '+6% damage and fire rate',  mods: { damageMul: 1.06, rateMul: 1.06 } }
];

/* --------------------------------------------------------------------------
   TOWERS

   `costGrowth` is the per-copy price multiplier — the main lever deciding how
   many of a tower you will ever field.

   `talents` is a 2x2 tree spent BEFORE the match from a 2-point budget. The
   lower row is gated behind spending a point in the upper row.
-------------------------------------------------------------------------- */
const TALENT_POINTS = 3;

/* Every authored costGrowth is steepened by this much of its FRACTIONAL part
   before the engine charges it -- the lever that stops a board being five
   copies of one tower. It is a named const because four player-facing
   surfaces quote the rate and one function charges it: quoting the authored
   figure understated the fourth Bolt by 76% and the fourth Vault by 88%. */
const COST_GROWTH_STEEPEN = 2.5;

/**
 * The per-copy price growth actually in force. ONE definition, five readers:
 * Game.towerCost charges it, and the loadout card, the build tooltip, the
 * codex tower list and the codex Economy note all quote it. `mul` is the
 * commander's costGrowthMul where a live board is in scope, and 1 where there
 * is no commander to ask.
 */
function appliedGrowth(def, mul) {
  return 1 + (def.costGrowth - 1) * (mul || 1) * COST_GROWTH_STEEPEN;
}

/* ── MAX-HEALTH VENOM (roadmap 19.18) ─────────────────────────────────────
   CANISTER burns a share of what the target STARTED with. That is the one
   damage form in the game which does not care about the wave health curve at
   all: a fixed fraction per second is a fixed TIME-TO-KILL however large the
   number over the health bar has grown, so left unbounded it would eventually
   be the only thing worth building and would delete bosses outright. Three
   bounds sit on it and all three are load-bearing.

   PCT_CAP ceilings the whole stack AFTER talents, statusMul, node attunement
   and surge, so nothing multiplies its way past it -- the floor on
   time-to-kill from gas alone is 1 / PCT_CAP = 20 seconds.

   ELITE_MUL cuts it against bosses and minibosses, whose entire design is a
   long health bar. 20 / 0.30 = 67 seconds against an AI_ENRAGE_WINDOW of 26,
   so a canister cannot gas an elite down inside the wave that brought it; it
   softens the elite for the rest of the board, which is the role the tower is
   supposed to have.

   And the gas is a 4-second refreshing DoT on a GROUND-ONLY tower, so none of
   it runs unless a canister is alive, in range, and still firing. */
const MAXHP_DOT_PCT_CAP = 0.05;    /* share of max health per second, all stacks */
const MAXHP_DOT_ELITE_MUL = 0.30;  /* ...against a boss or a miniboss            */
/* An UNSCALED body near the roster's non-boss median health, used only so
   estimateDps can express a share-of-health effect in damage units. Without a
   term there CANISTER reads to AI.effectiveness as a 9-damage tower and the
   rival -- which drafts it in the human line -- would never build it. */
const MAXHP_DOT_REF_HP = 230;

/** THE share of a target's MAX health one second of gas removes, ceiling and
    elite reduction included. The engine tick, the inspector row and the DPS
    estimate all read this one function, so the figure the panel prints and the
    figure the enemy takes cannot drift apart. `perStack` arrives already
    scaled by the tower's effStatus, exactly as applyRiders scales it. */
function maxHpVenomFrac(perStack, stacks, elite) {
  const f = Math.min((perStack || 0) * (stacks || 0), MAXHP_DOT_PCT_CAP);
  return elite ? f * MAXHP_DOT_ELITE_MUL : f;
}

/* ── SIGNATURES FOR THE THREE STAT BLOCKS (roadmap 19.20) ─────────────────
   BOLT, MORTAR and FLAK are the towers a new commander is handed, so the
   baseline they set has to stay readable at a glance. Each now carries ONE
   rule beyond its stat block, and all three are the same human idea in a
   different key: the hardware is not better than what it fights, it is kept
   working. Save the case, borrow somebody else's eyes, and refuse to let the
   thing stay in the air.

   BOLT's refund is bounded by arithmetic rather than by a constant: the
   engine can only ever hand back what is LEFT on the clock, and the clock is
   set to a full reload before any kill can be credited, so a Bolt cannot
   chain past double its printed rate however many bodies one round drops.
   STAT_CEIL holds the stat itself at 1.

   MORTAR's spotting is weapons-only and skips a jammed tower, which is what
   stops a sabotaged line quietly extending an artillery piece's reach. */

/* FLAK. A downed flyer is crippled, not merely low -- without the slow the
   window closes before a ground gun has traversed onto it. */
const FLAK_DOWNED_SLOW = 0.45;
/* Seconds, hard ceiling on one grounding. A stacked FLAK battery would
   otherwise hold a flight on the deck permanently, which does not counter
   air, it deletes it. */
const FLAK_DOWNED_CAP = 2.6;

/* ── PYRE'S TANK ──────────────────────────────────────────────────────────
   Seconds the crew needs to fit another tank after a blowout. This is the
   entire price of the mechanic: without a vent the tank is a free area burst
   on a timer rather than a gamble, and PYRE stops being a pirate weapon. */
const PYRE_VENT_SECONDS = 2.2;

/* ── ICHOR: MISSING-HEALTH VENOM ──────────────────────────────────────────
   The exact inverse of CANISTER's max-health gas, and it needs the same two
   bounds for the same reason. A share of the WOUND is a fixed time-to-kill
   on anything already hurt, so left unbounded a pair of Ichors would finish
   every elite the moment the rest of the board opened it.

   PCT_CAP ceilings the whole effect AFTER talents, statusMul, node
   attunement and surge -- the floor on time-to-kill from bile alone is
   1 / PCT_CAP seconds from the wound it started at.

   ELITE_MUL cuts it against bosses and minibosses, whose entire design is a
   long health bar that spends most of its life half gone. */
const DIGEST_PCT_CAP = 0.035;     /* share of max health per second, at any wound */
const DIGEST_ELITE_MUL = 0.35;    /* ...against a boss or a miniboss             */
/* An UNSCALED body near the roster's non-boss median, and the wound a second
   tower actually finds a body in. Used only so estimateDps can express a
   share-of-the-wound in damage units -- without a term there the rival reads
   ICHOR as a 9-damage tower and never drafts the thing in its own xeno line,
   which is exactly what happened to CANISTER before MAXHP_DOT_REF_HP. */
const DIGEST_REF_HP = 230;
const DIGEST_REF_WOUND = 0.5;

/** THE share of a target's MAX health one second of bile removes, ceiling
    and elite reduction included. The engine tick, the inspector row and the
    DPS estimate all read this one function, so the figure the panel prints
    and the figure the enemy takes cannot drift apart. `per` arrives already
    scaled by the tower's effStatus, exactly as the cone scales it. */
function digestFrac(per, wound, elite) {
  const f = Math.min((per || 0) * Math.max(0, wound || 0), DIGEST_PCT_CAP);
  return elite ? f * DIGEST_ELITE_MUL : f;
}

/* ── ARC: A CURRENT THAT RUNS THE ROAD ────────────────────────────────────
   How many bodies a tile of lane actually carries at the densities the wave
   tables produce. Read only by estimateDps, which is the rival's whole view
   of a tower: without it ARC reads as a single-target gun and the rival
   under-drafts the tower whose entire point is a packed column. */
const ARC_RUN_BODIES_PER_TILE = 0.35;

/* ── QUARTERMASTER: REQUISITION ───────────────────────────────────────────
   Hard ceiling on the discount after talents, branch and every surge. A
   CONVOY surge adds a flat share per ascension and surges do not pass
   through STAT_CEIL, so without a ceiling in the reader a deep enough
   Quartermaster eventually buys ascensions for nothing. */
const REQUISITION_MAX = 0.45;

/* ── CUSTODIAN: THE OATH ──────────────────────────────────────────────────
   A nominal body, heavily discounted, used only so estimateDps can price a
   life SAVED in damage units. The discount is the point: a warden is spent
   only on an actual breach and most waves produce none, so the honest figure
   is far below the health of the unit it stops. Same trick, same reason, as
   MAXHP_DOT_REF_HP -- AI.projectedUpgrade reads estimateDps and nothing
   else, so a zero here means the rival builds a Custodian and then never
   upgrades one. */
const VIGIL_REF_HP = 40;

/* ══ SESSION 19 — THE SIX (Federation of Light · The Xeno) ═════════════════
   Six towers built on a reaction the arsenal has never watched: your own
   tower leaving the board, one named creature living or dying, your paid
   dead falling on someone else's ground, a lull in the killing, a creature
   deleted rather than damaged, and healing treated as a debt.

   Every constant below names the specific failure it prevents, because the
   ones that did not are how five inert talents shipped.
   ------------------------------------------------------------------------ */

/* ── SEPULCHRE: A WARD THAT OUTLIVES ITS TOWER ───────────────────── */

/* Seconds between a ward's strikes. A ward reproduces the DPS figure the
   departed tower carried -- Tower.estimateDps, the same figure the inspector
   prints and the rival prices with -- so this only decides how lumpy that
   output is. Deliberately coarse: a ward resolving every frame would be a
   second full simulation of all thirty attack verbs. */
const SEPULCHRE_TICK = 0.5;

/* Hard ceiling on the share of the departed tower a ward keeps, applied in
   the READER. STAT_CEIL holds the talent path to it, but a branch and every
   ascension surge bypass that table outright -- and a ward that out-fights
   the tower it replaced makes selling strictly better than keeping, which
   inverts the whole mechanic into an exploit. */
const SEPULCHRE_FRAC_MAX = 1.00;

/* A Sepulchre learns of a departure by MISSING a tower from its side's list,
   so it has to hold last frame's list. If more than this many seconds have
   passed since that list was taken -- the chapel was jammed, or it is a
   second Sepulchre built long after the first -- the held list is stale and
   every tower built since would read as a departure. A gap that wide is a
   COLD START, not a massacre. */
const SEPULCHRE_CENSUS_GAP = 0.5;

/* The standing promise, in nominal body-health per second on the wave curve,
   that a Sepulchre is worth before anything has died on it. Zero is the
   truthful figure and it is also the figure that makes AI.projectedUpgrade
   refuse to draft the tower at all -- the same hole VIGIL_REF_HP plugs. */
const SEPULCHRE_IDLE_REF = 22;

/* Hard ceiling on wards held, applied in the reader. NECROPOLIS gains one per
   ascension surge and surges do not pass through STAT_CEIL, so a deep chapel
   would otherwise hold an unbounded shadow board -- sell the line, keep it
   all firing, rebuild it somewhere else. */
const SEPULCHRE_WARDS_MAX = 10;

/* ── ORISON: THE OFFERING ────────────────────────────────── */

/* Seconds after a wave turns over before the chapel will name its offering.
   It names the LARGEST creature walking at you, and in the first seconds of
   a wave the only creature on the board is whatever spawned first -- naming
   immediately picks a mite and throws the wave's real target away. The
   chapel names the moment the wave has finished arriving anyway; this is
   only the ceiling on how long it will wait for a slow one. */
const ORISON_NAMING_DELAY = 6;

/* A life restored, amortised over the wave it is restored in and expressed
   in nominal body-health per second, so estimateDps can price it in damage
   units exactly as VIGIL_REF_HP prices a warden. */
const ORISON_REF_HP = 2.2;

/* What the standing lend is worth to the rival's scoring, per point of
   offeringDmg. The chapel lends to every tower you own, so its honest worth
   is a share of the whole line -- but summing that line inside estimateDps
   makes the rival's pricing pass quadratic, and estimateDps is already
   called per tower per frame by the Sepulchre census. */
const ORISON_BOARD_WEIGHT = 60;

/* Hard ceiling on lives ransomed by one offering. Game.restoreLife already
   clamps to maxLives, so this is not about the counter -- it is about how
   completely a deep OBLATION erases the cost of leaking, which is the one
   resource the pins cannot see moving. Surges bypass STAT_CEIL. */
const ORISON_LIVES_MAX = 6;

/* ── ANTIPHON: THE ANSWER ────────────────────────────────── */

/* Share of the time a chapel actually holds an answer AND has something in
   reach to spend it on. It is silent by construction, so pricing it at its
   volley rate reads as one of the heaviest guns in the arsenal and the rival
   builds nothing else. */
const ANTIPHON_UPTIME = 0.30;

/* ── MAW: REMOVAL ──────────────────────────────────────── */

/* Seconds a Maw waits before trying again when it opened on an empty lane.
   Without it a full cooldown is burned on nothing and the Maw sits idle
   through the wave it was placed for. */
const MAW_EMPTY_RETRY = 0.4;

/* A nominal body, same units and same reason as VIGIL_REF_HP: removal deals
   no damage at all, so estimateDps has nothing to report and the rival would
   place one Maw and never upgrade it. */
const MAW_REF_HP = 260;

/* Hard ceiling on the digest multiple, applied in the reader for the same
   reason REQUISITION_MAX is: RUMINATION gains yield per ascension surge, and
   surges skip STAT_CEIL entirely. Removal that pays five times a bounty is a
   counter; removal that pays fifteen is an economy engine wearing a counter's
   description. */
const MAW_YIELD_MAX = 6.0;

/* ── HUNGERING VEIL: THE LEDGER ───────────────────────────── */

/* Share of a creature's OUTSTANDING healing debt called in each second it
   stands inside a veil. This is PACE, not size -- the size of the bill is
   the tower's own `veilHealTax`, damage per point of health ever given back.
   They have to be separate numbers because one cannot be both: a pure rate
   settles at exactly the healing rate whatever it is set to (dD/dt = H - kD
   gives kD* = H for every k), which would have made every single upgrade to
   the tower change nothing at all. */
const VEIL_COLLECT_RATE = 1.25;

/* Smallest charge worth applying. takeDamage floors every non-DOT hit at one
   whole point, so billing a fraction per frame would round a 0.2 charge up
   to a full point sixty times a second -- a veil quietly dealing 60 damage a
   second to a creature that was never healed. Charges bank to this figure
   and are then applied whole. */
const VEIL_MIN_CHARGE = 1;

/* Ceiling on the ledger, as a multiple of the body's own maximum health. A
   regenerating boss that walks four waves inside a mender ball would
   otherwise arrive carrying a bill larger than anything on the board and the
   veil would delete it in a single frame. */
const VEIL_DEBT_CAP = 6;

/* Points of debt collected that pay out one TITHE. Named so the talent copy
   and the reader quote one figure rather than two. */
const VEIL_TITHE_PER = 250;

/* Debt a supported body accrues per second, on the wave curve, used only to
   price the veil for the rival. It deals nothing at all against a wave with
   no support in it -- which is the tower's stated curve, and also a zero the
   rival cannot draft against. */
const VEIL_REF_DEBT = 12;


const TOWER_TYPES = {

  bolt: {
    id: 'bolt', element: 'kinetic', origin: 'human', name: 'BOLT', role: 'Rapid single-target', cost: 115, costGrowth: 1.50,
    color: '#3ee0ff', dark: '#0b5d75', attack: 'projectile',
    desc: 'Cheap, fast, reliable, and it feeds itself: a Bolt that kills has the case out before the body drops, so most of the next round is already paid for. EARLY-GAME by design — the refund is worth most in the waves where one round is enough. The gentlest price curve in the arsenal is what makes a wall of Bolts a real strategy; the breech is what makes the wall keep pace.',
    base: { damage: 6, range: 3.2, rate: 1.5, projSpeed: 15, dmgType: 'physical', splash: 0, killReload: 0.15 },
    levels: [
      { cost: 60,  name: 'MK II',  mods: { damage: 21, rate: 1.7, killReload: 0.19 } },
      { cost: 125, name: 'MK III', mods: { damage: 34, rate: 1.9, range: 3.6, killReload: 0.23 } }
    ],
    talents: [
      { id:'t_hollow', row:0, col:0, name:'HOLLOWPOINT', desc:'+45% damage, −15% fire rate.', mods:{ damageMul:1.45, rateMul:0.85 } },
      { id:'t_auto',   row:0, col:1, name:'AUTOLOADER',  desc:'+35% fire rate.',              mods:{ rateMul:1.35 } },
      { id:'t_long',   row:1, col:0, name:'LONG BARREL', desc:'+30% range, +12% damage.',     mods:{ rangeMul:1.30, damageMul:1.12 } },
      { id:'t_ap',     row:1, col:1, name:'AP CORE',     desc:'Ignores 40% of armour.',       mods:{ pierce:0.40 } },
      { id:'t_twin', row:2, col:0, name:'BRASS CATCHER', desc:'A kill returns 12% more of the reload.', mods:{ killReload:0.12 } },
      { id:'t_kinetic', row:2, col:1, name:'KINETIC SLUG', desc:'+55% damage but −20% fire rate.', mods:{ damageMul:1.55, rateMul:0.80 } }
    ],
    branches: [
      { id: 'volley', name: 'VOLLEY', cost: 230, mods: { damage: 30, rate: 2.0, multishot: 3, spread: 0.20, killReload: 0.13 },
        surge: { multishot: 1 }, note: 'A three-bolt fan. Each bolt is small, so few of them finish anything and the breech stays hungry.' },
      { id: 'piercer', name: 'PIERCER', cost: 230, mods: { damage: 88, rate: 1.4, pierce: 0.5, pierceCount: 4, shred: 3, projSpeed: 22, killReload: 0.50 },
        surge: { pierceCount: 2, shred: 2 }, note: 'A lance through four enemies, stripping armour as it goes — and a lance that kills is very nearly free.' }
    ]
  },

  cryo: {
    id: 'cryo', element: 'frost', origin: 'human', name: 'CRYO', role: 'Area slow / control', cost: 155, costGrowth: 1.58,
    color: '#8ab8ff', dark: '#1e3a72', attack: 'projectile',
    desc: 'Low damage, high value. Chills an area and multiplies the window every other tower gets to work in.',
    base: { damage: 4, range: 3.0, rate: 1.0, projSpeed: 11, dmgType: 'magic', splash: 1.1, slow: 0.32, slowDur: 1.8 },
    levels: [
      { cost: 85,  name: 'DEEP CHILL', mods: { damage: 12, slow: 0.42, slowDur: 2.1 } },
      { cost: 155, name: 'PERMAFROST', mods: { damage: 19, slow: 0.52, slowDur: 2.4, range: 3.4, splash: 1.3 } }
    ],
    talents: [
      { id:'t_wide',  row:0, col:0, name:'WIDE FIELD',  desc:'+40% splash radius.',                 mods:{ splashMul:1.40 } },
      { id:'t_deep',  row:0, col:1, name:'DEEP FREEZE', desc:'+35% slow strength and duration.',    mods:{ statusMul:1.35 } },
      { id:'t_snap',  row:1, col:0, name:'COLD SNAP',   desc:'10% chance to freeze solid.',         mods:{ freezeChance:0.10, freezeDur:0.7 } },
      { id:'t_brittle',row:1,col:1, name:'FROSTBITE',   desc:'Chilled targets take +25% damage.',   mods:{ chillVuln:0.25 } },
      { id:'t_glacial', row:2, col:0, name:'GLACIAL CORE', desc:'+30% damage and +20% slow.', mods:{ damageMul:1.30, statusMul:1.20 } },
      { id:'t_permafrost', row:2, col:1, name:'PERMAFROST', desc:'Slow duration +80%.', mods:{ slowDur:1.6 } }
    ],
    branches: [
      { id: 'glacier', name: 'GLACIER', cost: 275, mods: { damage: 26, slow: 0.68, slowDur: 2.8, splash: 1.6, freezeChance: 0.22, freezeDur: 0.9 },
        surge: { freezeChance: 0.05 }, note: 'Maximum control — a crushing slow plus a real freeze chance.' },
      { id: 'shatter', name: 'SHATTER', cost: 275, mods: { damage: 62, slow: 0.5, slowDur: 2.2, splash: 1.4, brittle: 2.0 },
        surge: { brittle: 0.3 }, note: 'DOUBLE damage to anything already slowed.' }
    ]
  },

  mortar: {
    id: 'mortar', element: 'fire', origin: 'human', name: 'MORTAR', role: 'Ground splash artillery', cost: 223, costGrowth: 1.66,
    color: '#ff9b3d', dark: '#7a4210', attack: 'lobbed', groundOnly: true,
    desc: 'Arcing shells, and no sight of its own worth the name. It does not need one: anything another of your weapons currently holds, the Mortar will drop a shell on, well past its own reach. LATE-GAME by design — on a bare board it is a short bombard, and it grows with every gun you build in front of it. Still blind to anything airborne.',
    base: { damage: 16, range: 3.9, rate: 0.55, projSpeed: 8, dmgType: 'physical', splash: 1.25, spotting: 0.9 },
    levels: [
      { cost: 115, name: 'HEAVY',   mods: { damage: 52, splash: 1.45, spotting: 1.3 } },
      { cost: 210, name: 'BATTERY', mods: { damage: 82, splash: 1.6, range: 4.3, rate: 0.62, spotting: 1.8 } }
    ],
    talents: [
      { id:'t_heavy', row:0, col:0, name:'HEAVY SHELL', desc:'+40% damage, −12% fire rate.', mods:{ damageMul:1.40, rateMul:0.88 } },
      { id:'t_quick', row:0, col:1, name:'QUICK FUSE',  desc:'+40% fire rate.',              mods:{ rateMul:1.40 } },
      { id:'t_blast', row:1, col:0, name:'WIDE BLAST',  desc:'+45% splash radius.',          mods:{ splashMul:1.45 } },
      { id:'t_shrap', row:1, col:1, name:'SHRAPNEL',    desc:'Blasts strip 5 armour.',       mods:{ shred:5 } },
      { id:'t_airburst', row:2, col:0, name:'FORWARD OBSERVER', desc:'Reaches 0.9 tiles further on a spotter call.', mods:{ spotting:0.9 } },
      { id:'t_barrage', row:2, col:1, name:'BARRAGE', desc:'+2 submunitions on impact.', mods:{ submunitions:2, scatter:1.1 } }
    ],
    branches: [
      { id: 'siege', name: 'SIEGE', cost: 360, mods: { damage: 175, splash: 2.3, rate: 0.5, range: 5.0, stun: 0.45, spotting: 2.2 },
        surge: { splash: 0.18, stun: 0.08, spotting: 0.15 }, note: 'One enormous shell with a concussive stun, dropped wherever the line is looking.' },
      { id: 'cluster', name: 'CLUSTER', cost: 360, mods: { damage: 72, splash: 1.3, rate: 0.7, submunitions: 4, scatter: 1.5, spotting: 1.5 },
        surge: { submunitions: 1 }, note: 'Airbursts into scattered bomblets.' }
    ]
  },

  arc: {
    id: 'arc', element: 'storm', origin: 'human', name: 'ARC', role: 'Current that runs the lane', cost: 256, costGrowth: 1.74,
    color: '#c084fc', dark: '#4c1d95', attack: 'grounding',
    desc: 'An alien capacitor on a human mast, earthed straight into the road. The discharge does not hop from body to body — it RUNS along the lane from where it struck, forward and back, through everything standing on that stretch of it. CONDITIONAL: devastating against a column, nearly wasted on a crowd that has spread out, so the shape of your maze decides what it is worth. Magic damage — armour is irrelevant.',
    base: { damage: 12, range: 3.1, rate: 0.95, dmgType: 'magic', runTiles: 2.4, runFalloff: 0.80 },
    levels: [
      { cost: 135, name: 'CONDUIT', mods: { damage: 34, runTiles: 3.2 } },
      { cost: 245, name: 'DYNAMO',  mods: { damage: 52, runTiles: 4.2, range: 3.4, runFalloff: 0.85 } }
    ],
    talents: [
      { id:'t_super', row:0, col:0, name:'SUPERCONDUCTOR', desc:'The current loses only 10% per tile.', mods:{ runFalloff:0.90 } },
      { id:'t_cap',   row:0, col:1, name:'CAPACITOR',      desc:'+40% damage.',                   mods:{ damageMul:1.40 } },
      { id:'t_fork',  row:1, col:0, name:'EARTH SPIKES',   desc:'The current runs 2 tiles further.', mods:{ runTiles:2.0 } },
      { id:'t_ion',   row:1, col:1, name:'GROUNDING RODS', desc:'The current strips 4 armour.',   mods:{ shred:4 } },
      { id:'t_overvolt', row:2, col:0, name:'OVERVOLT', desc:'+35% damage, −10% fire rate.', mods:{ damageMul:1.35, rateMul:0.90 } },
      { id:'t_relay', row:2, col:1, name:'SECOND EARTH', desc:'The current runs 2.6 tiles further.', mods:{ runTiles:2.6 } }
    ],
    branches: [
      { id: 'storm', name: 'STORM', cost: 415, mods: { damage: 62, runTiles: 6.0, runFalloff: 0.87, rate: 1.05 },
        surge: { runTiles: 1.2 }, note: 'The whole column, end to end, at almost no loss.' },
      { id: 'overload', name: 'OVERLOAD', cost: 415, mods: { damage: 155, runTiles: 2.0, runFalloff: 0.68, rate: 0.8, shred: 6 },
        surge: { damage: 22 }, note: 'A short, brutal earth directly under whoever is leading.' }
    ]
  },

  pyre: {
    id: 'pyre', element: 'fire', origin: 'pirate', name: 'PYRE', role: 'Cone burn on a tank that blows', cost: 189, costGrowth: 1.62,
    color: '#ff6b4a', dark: '#7c2410', attack: 'cone',
    desc: 'Scrap tanks, a salvaged igniter, and no interlock anywhere in it. A continuous cone of flame that hits everything in front at once and leaves targets burning — and, if you hold the trigger long enough, puts its own fuel tank across the lane and then stands there useless while the crew fits another. CONDITIONAL: the blowout is only worth its downtime where there is a crowd in front of it.',
    base: { damage: 12, range: 2.3, rate: 1, dmgType: 'magic', cone: 0.62, burn: 9, burnDur: 2.2, overheat: 4.5, blowDmg: 40, blowRadius: 1.6 },
    levels: [
      { cost: 100, name: 'STOKED',        mods: { damage: 40, burn: 16, blowDmg: 120 } },
      { cost: 185, name: 'BLAST FURNACE', mods: { damage: 62, burn: 25, range: 2.6, cone: 0.68, blowDmg: 220, blowRadius: 1.8 } }
    ],
    talents: [
      { id:'t_jet',  row:0, col:0, name:'WIDE JET',   desc:'+35% cone width, +20% range.',   mods:{ coneMul:1.35, rangeMul:1.20 } },
      { id:'t_white',row:0, col:1, name:'WHITE HOT',  desc:'+45% direct damage.',            mods:{ damageMul:1.45 } },
      { id:'t_stick',row:1, col:0, name:'STICKY FUEL',desc:'+70% burn damage and duration.', mods:{ statusMul:1.70 } },
      { id:'t_oxy',  row:1, col:1, name:'OXIDISER',   desc:'Burning targets take +30% damage.', mods:{ burnVuln:0.30 } },
      { id:'t_bellows', row:2, col:0, name:'BELLOWS', desc:'+30% fire cone and +15% damage.', mods:{ coneMul:1.30, damageMul:1.15 } },
      { id:'t_pyroclast', row:2, col:1, name:'TANK RUPTURE', desc:'The blowout hits 60% harder and half a tile wider.', mods:{ blowDmgMul:1.60, blowRadius:0.5 } }
    ],
    branches: [
      { id: 'inferno', name: 'INFERNO', cost: 320, mods: { damage: 105, burn: 48, burnDur: 3.0, range: 3.1, cone: 0.75, overheat: 6.5, blowDmg: 460 },
        surge: { cone: 0.05, blowDmg: 90 }, note: 'A vast cone, a punishing burn, and a tank you can hold open far longer before it goes.' },
      { id: 'napalm', name: 'NAPALM', cost: 320, mods: { damage: 68, burn: 32, burnDur: 2.6, range: 2.9, cone: 0.7, puddle: true, puddleDmg: 34, puddleDur: 4.5, puddleRadius: 1.15, overheat: 3.0, blowDmg: 230 },
        surge: { puddleDmg: 18, puddleRadius: 0.08 }, note: 'Coats the lane in burning fuel, and goes up early and often.' }
    ]
  },

  railgun: {
    id: 'railgun', element: 'kinetic', origin: 'robotic', name: 'RAILGUN', role: 'Long-range hitscan', cost: 317, costGrowth: 1.86,
    color: '#4ade80', dark: '#14532d', attack: 'hitscan',
    desc: 'Extreme range, instant hit, huge per-shot damage that partly bypasses armour. An execution tool.',
    base: { damage: 38, range: 8.0, rate: 0.42, dmgType: 'physical', pierce: 0.5, preferStrongest: true },
    levels: [
      { cost: 170, name: 'LONG BORE',   mods: { damage: 130, range: 8.6 } },
      { cost: 300, name: 'MASS DRIVER', mods: { damage: 215, rate: 0.5, pierce: 0.6 } }
    ],
    talents: [
      { id:'t_over', row:0, col:0, name:'OVERCHARGED', desc:'+50% damage, −15% fire rate.', mods:{ damageMul:1.50, rateMul:0.85 } },
      { id:'t_rapid',row:0, col:1, name:'RAPID CAP',   desc:'+45% fire rate.',              mods:{ rateMul:1.45 } },
      { id:'t_sabot',row:1, col:0, name:'SABOT ROUNDS',desc:'Ignores a further 30% armour.',mods:{ pierce:0.30 } },
      { id:'t_spot', row:1, col:1, name:'SPOTTER LINK',desc:'+35% range, 15% crit.',        mods:{ rangeMul:1.35, crit:0.15 } },
      { id:'t_penetrator', row:2, col:0, name:'PENETRATOR', desc:'Beam pierces 2 extra targets.', mods:{ pierceCount:2 } },
      { id:'t_focus', row:2, col:1, name:'FOCUS ARRAY', desc:'+30% damage and +20% range.', mods:{ damageMul:1.30, rangeMul:1.20 } }
    ],
    branches: [
      { id: 'annihilator', name: 'ANNIHILATOR', cost: 560, mods: { damage: 560, rate: 0.42, pierce: 0.85, pierceCount: 99, range: 10 },
        surge: { pierce: 0.03 }, note: 'Fires through the entire lane.' },
      { id: 'marksman', name: 'MARKSMAN', cost: 560, mods: { damage: 320, rate: 0.95, pierce: 0.7, crit: 0.3, critMult: 3.0 },
        surge: { crit: 0.05, critMult: 0.25 }, note: 'Double rate with a 30% chance to crit for triple.' }
    ]
  },

  toxin: {
    id: 'toxin', element: 'venom', origin: 'xeno', name: 'TOXIN', role: 'Stacking percent-HP venom', cost: 209, costGrowth: 1.70,
    color: '#a3e635', dark: '#3f5f0b', attack: 'projectile',
    desc: 'Venom that ignores armour AND shields and scales off the target\'s CURRENT health — ferocious on a full-health giant, feeble once it is nearly dead. It softens targets; it does not finish them.',
    base: { damage: 4, range: 3.3, rate: 1.1, projSpeed: 10, dmgType: 'magic', splash: 1.0,
            poisonDps: 3.5, poisonPct: 0.005, poisonDur: 4.0, maxStacks: 2 },
    levels: [
      { cost: 110, name: 'VIRULENT', mods: { damage: 12, poisonDps: 5.5, poisonPct: 0.008 } },
      { cost: 200, name: 'PANDEMIC', mods: { damage: 18, poisonDps: 8.5, poisonPct: 0.012, maxStacks: 4, range: 3.6 } }
    ],
    talents: [
      { id:'t_conc',  row:0, col:0, name:'CONCENTRATE', desc:'+50% venom damage per stack.',  mods:{ statusMul:1.50 } },
      { id:'t_aero',  row:0, col:1, name:'AEROSOL',     desc:'+45% splash.',                  mods:{ splashMul:1.45 } },
      { id:'t_stacks',row:1, col:0, name:'DEEP STACKS', desc:'+2 maximum venom stacks.',      mods:{ maxStacks:2 } },
      { id:'t_necro', row:1, col:1, name:'NECROSIS',    desc:'Venom strips 2 armour per stack.', mods:{ shredPerStack:2 } },
      { id:'t_blight', row:2, col:0, name:'BLIGHT', desc:'+60% venom potency.', mods:{ statusMul:1.60 } },
      { id:'t_solvent', row:2, col:1, name:'SOLVENT', desc:'Venom also slows by 20%.', mods:{ corrodeSlow:0.20, shredPerStack:1 } }
    ],
    branches: [
      { id: 'plague', name: 'PLAGUE', cost: 350, mods: { damage: 22, poisonDps: 11.0, poisonPct: 0.015, maxStacks: 5, contagion: 2.4 },
        surge: { contagion: 0.35 },
        note: 'A poisoned enemy that dies infects ONE nearby target — a single jump, never a chain.' },
      { id: 'corrosion', name: 'CORROSION', cost: 350, mods: { damage: 20, poisonDps: 9.0, poisonPct: 0.011, maxStacks: 4, shredPerStack: 3, corrodeSlow: 0.18 },
        surge: { shredPerStack: 1 }, note: 'Each stack strips 3 armour and slows.' }
    ]
  },

  beacon: {
    id: 'beacon', element: 'radiant', origin: 'light', name: 'BEACON', role: 'Consecrates one tower at a time', cost: 351, costGrowth: 2.05,
    color: '#fbbf24', dark: '#78500a', attack: 'aura',
    desc: 'Fires nothing, and spreads nothing. It lights the best gun inside its field and pours everything it has into that ONE emplacement until the beam moves on. LATE-GAME by design: a Beacon is worth exactly what your best tower is worth, so it is dead weight over four cheap emplacements and enormous over one ascended monster — the opposite question a Pylon asks.',
    base: { range: 2.6, dmgType: 'none', focusDmg: 0.40, focusRate: 0.20, focusEvery: 3.2, focusCount: 1 },
    levels: [
      { cost: 180, name: 'RESONATOR', mods: { focusDmg: 0.66, focusRate: 0.30, range: 2.9 } },
      { cost: 320, name: 'HARMONIC',  mods: { focusDmg: 0.95, focusRate: 0.40, focusRange: 0.12, range: 3.3 } }
    ],
    talents: [
      { id:'t_broad', row:0, col:0, name:'BROADCAST',   desc:'+35% field radius.',            mods:{ rangeMul:1.35 } },
      { id:'t_focus', row:0, col:1, name:'CONSECRATION',desc:'+45% to the damage it lends.',  mods:{ focusDmgMul:1.45 } },
      { id:'t_tempo', row:1, col:0, name:'TEMPO CORE',  desc:'+50% to the fire rate it lends.', mods:{ focusRateMul:1.50 } },
      { id:'t_latt',  row:1, col:1, name:'LATTICE',     desc:'The lit tower also gains +14% range.', mods:{ focusRange:0.14 } },
      { id:'t_overtune', row:2, col:0, name:'OVERTUNE', desc:'+35% lent damage and +20% lent rate.', mods:{ focusDmgMul:1.35, focusRateMul:1.20 } },
      { id:'t_wideband', row:2, col:1, name:'WIDEBAND', desc:'Lights a second tower as well, at reduced strength.', mods:{ focusCount:1 } }
    ],
    branches: [
      { id: 'overclock', name: 'OVERCLOCK', cost: 520, mods: { focusDmg: 0.54, focusRate: 0.90, focusEvery: 2.4, range: 3.5 },
        surge: { focusRate: 0.11 }, note: 'A short, restless beam — the fire rate goes wherever it lands.' },
      { id: 'amplifier', name: 'AMPLIFIER', cost: 520, mods: { focusDmg: 1.80, focusRate: 0.28, focusRange: 0.24, focusEvery: 4.5, range: 3.5 },
        surge: { focusDmg: 0.22 }, note: 'One tower, held in the light a long time, and unrecognisable while it is.' }
    ]
  },

  tether: {
    id: 'tether', element: 'frost', origin: 'pirate', name: 'TETHER', role: 'Displacement — drags enemies back', cost: 202, costGrowth: 1.76,
    color: '#f472b6', dark: '#6d1a42', attack: 'tether',
    desc: 'Harpoons a target and winches it BACKWARD. Every tile dragged is a tile your whole defence shoots again.',
    base: { damage: 7, range: 3.4, rate: 0.62, dmgType: 'physical', pull: 1.2, projSpeed: 20 },
    levels: [
      { cost: 105, name: 'WINCH GEAR', mods: { damage: 24, pull: 1.6 } },
      { cost: 195, name: 'CAPSTAN',    mods: { damage: 38, pull: 2.2, range: 3.8, rate: 0.7 } }
    ],
    talents: [
      { id:'t_hard', row:0, col:0, name:'HARD WINCH', desc:'+50% pull distance.',          mods:{ statusMul:1.50 } },
      { id:'t_reel', row:0, col:1, name:'FAST REEL',  desc:'+45% fire rate.',              mods:{ rateMul:1.45 } },
      { id:'t_gaff', row:1, col:0, name:'GAFF LINES', desc:'Hooked targets slowed 35%.',   mods:{ slow:0.35, slowDur:3 } },
      { id:'t_rip',  row:1, col:1, name:'RIP BARBS',  desc:'+70% damage, strips 4 armour.',mods:{ damageMul:1.70, shred:4 } },
      { id:'t_capstan', row:2, col:0, name:'HEAVY CAPSTAN', desc:'+40% pull and +20% damage.', mods:{ statusMul:1.40, damageMul:1.20 } },
      { id:'t_dragnet', row:2, col:1, name:'DRAGNET', desc:'Also hauls everything within 1.4 tiles.', mods:{ pullAll:1.4 } }
    ],
    branches: [
      { id: 'windlass', name: 'WINDLASS', cost: 330, mods: { damage: 60, pull: 4.2, rate: 0.5, range: 4.2, pullAll: 1.6 },
        surge: { pull: 0.6, pullAll: 0.15 }, note: 'Drags the target and everything near it.' },
      { id: 'barbs', name: 'BARBS', cost: 330, mods: { damage: 105, pull: 1.4, rate: 0.85, bleed: 26, bleedDur: 3.5, shred: 5 },
        surge: { bleed: 10, shred: 2 }, note: 'Trades pull for an armour-tearing bleed.' }
    ]
  },

  prism: {
    id: 'prism', element: 'radiant', origin: 'light', name: 'PRISM', role: 'Ramping focused beam', cost: 277, costGrowth: 1.82,
    color: '#e879f9', dark: '#581c87', attack: 'beam',
    desc: 'A beam whose damage RAMPS the longer it holds one target, resetting the moment it switches.',
    base: { damage: 10, range: 4.0, rate: 1, dmgType: 'magic', ramp: 0.55, rampMax: 3.0 },
    levels: [
      { cost: 140, name: 'FOCUSING ARRAY', mods: { damage: 33, ramp: 0.7 } },
      { cost: 255, name: 'COHERENCE',      mods: { damage: 52, ramp: 0.85, rampMax: 4.0, range: 4.4 } }
    ],
    talents: [
      { id:'t_spool', row:0, col:0, name:'FAST SPOOL',  desc:'Ramps 60% faster.',              mods:{ rampMul:1.60 } },
      { id:'t_gain',  row:0, col:1, name:'BASE GAIN',   desc:'+45% base beam damage.',         mods:{ damageMul:1.45 } },
      { id:'t_ceil',  row:1, col:0, name:'HIGH CEILING',desc:'+2.0 to the ramp ceiling.',      mods:{ rampMax:2.0 } },
      { id:'t_persist',row:1,col:1, name:'PERSISTENCE', desc:'Focus decays instead of resetting.', mods:{ persist:true } },
      { id:'t_lens', row:2, col:0, name:'LENS ARRAY', desc:'+30% damage and +25% range.', mods:{ damageMul:1.30, rangeMul:1.25 } },
      { id:'t_prismsplit', row:2, col:1, name:'SPLIT BEAM', desc:'Fires a second beam at 55% power.', mods:{ split:2, splitFalloff:0.55 } }
    ],
    branches: [
      { id: 'solar', name: 'SOLAR LANCE', cost: 430, mods: { damage: 88, ramp: 1.0, rampMax: 8.0, range: 4.8 },
        surge: { rampMax: 1.2 }, note: 'An x8 ceiling. The definitive boss answer.' },
      { id: 'refractor', name: 'REFRACTOR', cost: 430, mods: { damage: 62, ramp: 0.8, rampMax: 4.5, split: 3, splitFalloff: 0.62 },
        surge: { split: 1 }, note: 'Three simultaneous beams, each ramping independently.' }
    ]
  },

  sapper: {
    id: 'sapper', element: 'fire', origin: 'pirate', name: 'SAPPER', role: 'Banked proximity mines', cost: 236, costGrowth: 1.72,
    color: '#facc15', dark: '#713f12', attack: 'mines', groundOnly: true,
    desc: 'Seeds the lane with mines that wait, then detonate underfoot. Mines are BANKED between waves.',
    base: { damage: 28, range: 3.6, rate: 1, dmgType: 'physical', splash: 1.3, maxMines: 4, mineDelay: 3.4 },
    levels: [
      { cost: 125, name: 'SEEDER',  mods: { damage: 92,  maxMines: 6, mineDelay: 3.0 } },
      { cost: 225, name: 'SAPPERS', mods: { damage: 148, maxMines: 8, splash: 1.5, range: 4.0 } }
    ],
    talents: [
      { id:'t_seed', row:0, col:0, name:'RAPID SEED',  desc:'Lays mines 45% faster.',      mods:{ mineDelayMul:0.55 } },
      { id:'t_shape',row:0, col:1, name:'SHAPED CHARGE',desc:'+50% mine damage.',          mods:{ damageMul:1.50 } },
      { id:'t_cache',row:1, col:0, name:'DEEP CACHE',  desc:'+5 to the mine stockpile.',   mods:{ maxMines:5 } },
      { id:'t_frag', row:1, col:1, name:'CLUSTER FRAG',desc:'+50% blast, strips 4 armour.',mods:{ splashMul:1.50, shred:4 } },
      { id:'t_thermite', row:2, col:0, name:'THERMITE', desc:'+45% mine damage.', mods:{ damageMul:1.45 } },
      { id:'t_tripwire', row:2, col:1, name:'TRIPWIRE', desc:'+4 stockpile and 30% faster seeding.', mods:{ maxMines:4, mineDelayMul:0.70 } }
    ],
    branches: [
      { id: 'minefield', name: 'MINEFIELD', cost: 380, mods: { damage: 125, maxMines: 18, mineDelay: 1.5, splash: 1.35 },
        surge: { maxMines: 3 }, note: 'Carpets the lane in many small blasts.' },
      { id: 'demolition', name: 'DEMOLITION', cost: 380, mods: { damage: 460, maxMines: 4, mineDelay: 4.2, splash: 2.5, stun: 0.7 },
        surge: { damage: 110, splash: 0.12 }, note: 'Four enormous charges that stun everything.' }
    ]
  },

  singularity: {
    id: 'singularity', element: 'void', origin: 'robotic', name: 'SINGULARITY', role: 'Gravity — clumps enemies', cost: 297, costGrowth: 2.10,
    color: '#818cf8', dark: '#312e81', attack: 'gravity',
    desc: 'A Federation containment core, stripped off a wreck and rebuilt on a machine chassis. Drags every enemy in range toward one point, compressing a strung-out wave into a knot for your splash.',
    base: { damage: 4, range: 3.2, rate: 0.26, dmgType: 'magic', gravity: 0.9 },
    levels: [
      { cost: 150, name: 'COMPRESSOR', mods: { damage: 16, gravity: 2.0, rate: 0.4 } },
      { cost: 270, name: 'ACCRETION',  mods: { damage: 26, gravity: 2.8, rate: 0.46, range: 3.6 } }
    ],
    talents: [
      { id:'t_field', row:0, col:0, name:'STRONG FIELD', desc:'+45% pull strength.',   mods:{ statusMul:1.45 } },
      { id:'t_well',  row:0, col:1, name:'WIDE WELL',    desc:'+35% radius.',          mods:{ rangeMul:1.35 } },
      { id:'t_stasis',row:1, col:0, name:'STASIS',       desc:'Pulses pin for 0.3s.',  mods:{ hold:0.30 } },
      { id:'t_crush', row:1, col:1, name:'CRUSHING',     desc:'Pulses deal +250% damage.', mods:{ damageMul:3.50 } },
      { id:'t_collapse', row:2, col:0, name:'COLLAPSE', desc:'+200% pulse damage.', mods:{ damageMul:3.00 } },
      { id:'t_eventfield', row:2, col:1, name:'EVENT FIELD', desc:'+40% pull and +25% radius.', mods:{ statusMul:1.40, rangeMul:1.25 } }
    ],
    branches: [
      { id: 'horizon', name: 'EVENT HORIZON', cost: 450, mods: { damage: 40, gravity: 4.5, rate: 0.55, range: 4.0, hold: 0.55 },
        surge: { gravity: 0.55, hold: 0.06 }, note: 'Pulls harder and pins everything caught.' },
      { id: 'implosion', name: 'IMPLOSION', cost: 450, mods: { damage: 235, gravity: 2.6, rate: 0.5, range: 3.8, splash: 2.0 },
        surge: { damage: 60 }, note: 'The pull lands as heavy area damage on the knot it just formed.' }
    ]
  },

  vault: {
    id: 'vault', element: 'radiant', origin: 'robotic', name: 'VAULT', role: 'Economy — generates gold', cost: 324, costGrowth: 2.35,
    color: '#fcd34d', dark: '#78350f', attack: 'economy',
    desc: 'Mints gold on a clock and skims from kills nearby. EARLY-GAME by design: it pays from the moment it is raised and can never be paid for the waves you spent without it. Priced to be nearly unique — a second one costs more than double. The other economy structure mints nothing at all.',
    base: { range: 3.2, dmgType: 'none', income: 9, incomeEvery: 5, killCut: 2 },
    levels: [
      { cost: 165, name: 'STRONGBOX', mods: { income: 15, killCut: 3, range: 3.5 } },
      { cost: 290, name: 'RESERVE',   mods: { income: 24, killCut: 5, range: 3.9 } }
    ],
    talents: [
      { id:'t_comp',  row:0, col:0, name:'COMPOUND',    desc:'+50% timed income.',      mods:{ incomeMul:1.50 } },
      { id:'t_levy',  row:0, col:1, name:'LEVY',        desc:'+120% kill skim.',        mods:{ killCutMul:2.20 } },
      { id:'t_ledger',row:1, col:0, name:'WIDE LEDGER', desc:'+45% skim radius.',       mods:{ rangeMul:1.45 } },
      { id:'t_bonds', row:1, col:1, name:'WAR BONDS',   desc:'Lump sum each wave.',     mods:{ waveBonus:90 } },
      { id:'t_interest', row:2, col:0, name:'COMPOUND INTEREST', desc:'+70% timed income.', mods:{ incomeMul:1.70 } },
      { id:'t_tribute', row:2, col:1, name:'TRIBUTE', desc:'+150% kill skim and +25% radius.', mods:{ killCutMul:2.50, rangeMul:1.25 } }
    ],
    branches: [
      { id: 'treasury', name: 'TREASURY', cost: 470, mods: { income: 48, killCut: 4, range: 4.0 },
        surge: { income: 12 }, note: 'Pure flat income, independent of the fight.' },
      { id: 'tithe', name: 'TITHE', cost: 470, mods: { income: 15, killCut: 17, range: 4.6 },
        surge: { killCut: 4 }, note: 'Scales off slaughter. Place it over your killzone.' }
    ]
  },

  flak: {
    id: 'flak', element: 'kinetic', origin: 'human', name: 'FLAK', role: 'Anti-air — brings flyers down', cost: 216, costGrowth: 1.60,
    color: '#5eead4', dark: '#134e4a', attack: 'projectile', airOnly: true,
    desc: 'CANNOT TARGET GROUND. What it does instead is bring things DOWN: a hit flyer is crippled onto the deck for a few seconds, crawling, where every ground-only gun on the board can finally reach it. CONDITIONAL — worth nothing against a wave with no sky, and the reason the exact mirror of Mortar is also its partner.',
    base: { damage: 23, range: 4.2, rate: 1.1, projSpeed: 17, dmgType: 'physical', splash: 1.4, downFor: 0.6 },
    levels: [
      { cost: 115, name: 'AUTOCANNON', mods: { damage: 78, rate: 1.2, downFor: 0.85 } },
      { cost: 205, name: 'BATTERY',    mods: { damage: 128, range: 4.6, splash: 1.6, downFor: 1.1 } }
    ],
    talents: [
      { id:'t_prox', row:0, col:0, name:'PROXIMITY FUSE',desc:'+45% splash radius.',  mods:{ splashMul:1.45 } },
      { id:'t_velo', row:0, col:1, name:'HIGH VELOCITY', desc:'+45% damage.',         mods:{ damageMul:1.45 } },
      { id:'t_radar',row:1, col:0, name:'RADAR LINK',    desc:'+40% range.',          mods:{ rangeMul:1.40 } },
      { id:'t_curt', row:1, col:1, name:'FLAK CURTAIN',  desc:'Slows flyers 45%, and holds them down 0.4s longer.', mods:{ slow:0.45, slowDur:1.6, downFor:0.4 } },
      { id:'t_saturation', row:2, col:0, name:'SATURATION', desc:'+35% damage and +25% splash.', mods:{ damageMul:1.35, splashMul:1.25 } },
      { id:'t_interceptor', row:2, col:1, name:'INTERCEPTORS', desc:'+60% fire rate.', mods:{ rateMul:1.60 } }
    ],
    branches: [
      { id: 'skyshred', name: 'SKYSHRED', cost: 345, mods: { damage: 240, splash: 2.1, rate: 1.15, downFor: 1.3 },
        surge: { splash: 0.15, downFor: 0.08 }, note: 'One burst clears an entire flight, and grounds whatever lives through it.' },
      { id: 'seeker', name: 'SEEKER SWARM', cost: 345, mods: { damage: 82, rate: 3.2, splash: 0.9, homing: true, slow: 0.4, slowDur: 1.4, downFor: 0.5 },
        surge: { rate: 0.4 }, note: 'A stream of homing seekers. Nothing it is shooting at ever regains altitude.' }
    ]
  },

  siphon: {
    id: 'siphon', element: 'void', origin: 'xeno', name: 'SIPHON', role: 'Converts damage into lives', cost: 338, costGrowth: 2.20,
    color: '#f87171', dark: '#7f1d1d', attack: 'projectile',
    desc: 'The only structure that gives lives BACK. Banks damage until the meter fills, then restores one.',
    base: { damage: 12, range: 3.2, rate: 1.0, projSpeed: 13, dmgType: 'magic', drainPer: 900, drainCd: 12 },
    levels: [
      { cost: 175, name: 'LEECH',    mods: { damage: 40, drainPer: 720, drainCd: 11 } },
      { cost: 305, name: 'HAEMATIC', mods: { damage: 62, drainPer: 560, drainCd: 10, range: 3.6 } }
    ],
    talents: [
      { id:'t_vein', row:0, col:0, name:'WIDE VEIN',  desc:'Meter fills on 30% less damage.', mods:{ drainPerMul:0.70 } },
      { id:'t_fang', row:0, col:1, name:'SHARP FANGS',desc:'+55% damage.',                    mods:{ damageMul:1.55 } },
      { id:'t_clot', row:1, col:0, name:'RAPID CLOT', desc:'−40% recovery cooldown.',         mods:{ drainCdMul:0.60 } },
      { id:'t_gold', row:1, col:1, name:'BLOOD GOLD', desc:'Each life pays 40 gold.',         mods:{ drainGold:40 } },
      { id:'t_haemo', row:2, col:0, name:'HAEMORRHAGE', desc:'+50% damage and 20% cheaper meter.', mods:{ damageMul:1.50, drainPerMul:0.80 } },
      { id:'t_reclaim', row:2, col:1, name:'RECLAMATION', desc:'Meter fills on 35% less damage.', mods:{ drainPerMul:0.65 } }
    ],
    branches: [
      { id: 'transfusion', name: 'TRANSFUSION', cost: 500, mods: { damage: 92, drainPer: 340, drainCd: 7 },
        surge: { drainPer: -30 }, note: 'Maximum recovery. In a long run this is survival.' },
      { id: 'parasite', name: 'PARASITE', cost: 500, mods: { damage: 215, drainPer: 620, drainCd: 10, drainGold: 22 },
        surge: { damage: 55, drainGold: 7 }, note: 'A real weapon that still heals, and pays gold.' }
    ]
  },

  dronebay: {
    id: 'dronebay', element: 'kinetic', origin: 'robotic', name: 'DRONE BAY', role: 'Autonomous mobile drones', cost: 358, costGrowth: 1.96,
    color: '#7dd3fc', dark: '#075985', attack: 'drones',
    desc: 'Launches drones that leave the pad and hunt. The only structure whose coverage MOVES.',
    base: { range: 4.6, dmgType: 'physical', drones: 1, droneDamage: 8, droneRate: 1.4, droneSpeed: 4.4 },
    levels: [
      { cost: 185, name: 'HANGAR', mods: { drones: 2, droneDamage: 27 } },
      { cost: 320, name: 'WING',   mods: { drones: 3, droneDamage: 42, range: 5.1, droneRate: 1.55 } }
    ],
    talents: [
      { id:'t_bird', row:0, col:0, name:'EXTRA AIRFRAME', desc:'+1 drone.',                 mods:{ drones:1 } },
      { id:'t_guns', row:0, col:1, name:'HEAVY GUNS',     desc:'+55% drone damage.',        mods:{ droneDamageMul:1.55 } },
      { id:'t_patrol',row:1,col:0, name:'LONG PATROL',    desc:'+40% radius, +30% speed.',  mods:{ rangeMul:1.40, droneSpeedMul:1.30 } },
      { id:'t_aa',   row:1, col:1, name:'AA MISSILES',    desc:'+80% damage to flyers.',    mods:{ airBonus:1.80 } },
      { id:'t_squadron', row:2, col:0, name:'SQUADRON', desc:'+2 drones.', mods:{ drones:2 } },
      { id:'t_railguns', row:2, col:1, name:'DRONE RAILGUNS', desc:'+70% drone damage.', mods:{ droneDamageMul:1.70 } }
    ],
    branches: [
      { id: 'swarm', name: 'SWARM PROTOCOL', cost: 520, mods: { drones: 4, droneDamage: 34, droneRate: 1.7, range: 5.6 },
        surge: { drones: 1 }, note: 'A four-strong flight that saturates your whole half.' },
      { id: 'interceptor', name: 'INTERCEPTOR', cost: 520, mods: { drones: 2, droneDamage: 165, droneRate: 1.1, droneSpeed: 6.5, airBonus: 2.0 },
        surge: { droneDamage: 45 }, note: 'Three heavy gunships that double up on air.' }
    ]
  },

  /* The three towers below exist so HUMAN covers all seven elements -- the
     origin's stated identity is breadth, and an identity nothing can be
     measured against is a label. Each is built on an attack verb the engine
     already resolves, so they are reachable through exactly the same level,
     specialisation and ascension path as everything else. */

  canister: {
    id: 'canister', element: 'venom', origin: 'human', name: 'CANISTER', role: 'Armour-stripping gas', cost: 214, costGrowth: 1.64,
    color: '#bef264', dark: '#3f5f0b', attack: 'lobbed', groundOnly: true, glyph: '◍',
    desc: 'Standard-issue gas shells on a standard-issue tube. The gas eats plate — every stack strips armour with no talent spent on it — and it burns a share of what the target STARTED with rather than what it has left, so it keeps working on a giant that venom has already given up on. It buys that with damage: a third of TOXIN\'s percentage, and nothing at all against a flier.',
    /* poisonMaxPct is a share of MAX health per stack per second, and the rung
       figures are set so (pct x maxStacks) lands at ~1/3 of TOXIN's
       (poisonPct x maxStacks) at the matching rung -- 0.0034 vs 0.010 at base,
       0.016 vs 0.048 at tier 3, 0.025 vs 0.075 at the wide branch. The third
       that is missing is what pays for the armour strip below, which TOXIN can
       only reach by spending NECROSIS or its whole tier-4 CORROSION branch.
       maxHpVenomFrac ceilings the total; see MAXHP_DOT_PCT_CAP. */
    base: { damage: 9, range: 3.7, rate: 0.6, projSpeed: 8, dmgType: 'magic', splash: 1.5,
            poisonDps: 4.0, poisonMaxPct: 0.0017, poisonDur: 4.0, maxStacks: 2, shredPerStack: 3 },
    levels: [
      { cost: 120, name: 'CHOKING', mods: { damage: 26, poisonDps: 6.5, poisonMaxPct: 0.0027, splash: 1.65, shredPerStack: 4 } },
      { cost: 215, name: 'BLISTER', mods: { damage: 40, poisonDps: 9.5, poisonMaxPct: 0.0080, splash: 1.85, range: 4.1, shredPerStack: 5 } }
    ],
    talents: [
      { id:'cn_wide',  row:0, col:0, name:'WIDE PATTERN', desc:'+40% blast radius.',              mods:{ splashMul:1.40 } },
      { id:'cn_dose',  row:0, col:1, name:'HEAVY DOSE',   desc:'+45% gas potency.',               mods:{ statusMul:1.45 } },
      { id:'cn_shell', row:1, col:0, name:'HE FILLER',    desc:'+45% impact damage.',             mods:{ damageMul:1.45 } },
      { id:'cn_lung',  row:1, col:1, name:'CAUSTIC',      desc:'+2 armour stripped per gas stack.', mods:{ shredPerStack:2 } },
      { id:'cn_rate',  row:2, col:0, name:'QUICK LOADER', desc:'+35% fire rate.',                 mods:{ rateMul:1.35 } },
      { id:'cn_deep',  row:2, col:1, name:'DEEP STOCK',   desc:'+2 gas stacks and 20% slow.',     mods:{ maxStacks:2, corrodeSlow:0.20 } }
    ],
    branches: [
      { id: 'saturation', name: 'SATURATION', cost: 350, mods: { damage: 58, splash: 2.4, poisonDps: 13.0, poisonMaxPct: 0.0050, maxStacks: 5, shredPerStack: 4, rate: 0.66 },
        surge: { splash: 0.16 }, note: 'The whole approach becomes uninhabitable, and nothing crossing it keeps its plate — 20 armour off at full stacks.' },
      { id: 'concentrate', name: 'CONCENTRATE', cost: 350, mods: { damage: 96, splash: 1.5, poisonDps: 15.0, poisonMaxPct: 0.0050, maxStacks: 3, shredPerStack: 6, corrodeSlow: 0.22 },
        surge: { poisonDps: 3.0 }, note: 'A smaller cloud that strips 18 armour and eats a fixed share of whatever walks into it.' }
    ]
  },

  reclaimer: {
    id: 'reclaimer', element: 'void', origin: 'human', name: 'RECLAIMER', role: 'Salvaged void rifle', cost: 244, costGrowth: 1.68,
    color: '#a5b4fc', dark: '#312e81', attack: 'projectile', glyph: '⊘',
    desc: 'A void emitter pulled off a wreck and bolted to a human mount. Nobody who fires it can explain it. It leaves what it hits easier to kill.',
    base: { damage: 17, range: 3.5, rate: 0.9, projSpeed: 16, dmgType: 'magic', pierce: 0.25, vuln: 0.12, vulnDur: 2.5 },
    levels: [
      { cost: 140, name: 'FIELD FIT', mods: { damage: 48, vuln: 0.17 } },
      { cost: 250, name: 'REBUILT',   mods: { damage: 76, vuln: 0.22, range: 3.9, rate: 1.0 } }
    ],
    talents: [
      { id:'rc_core',  row:0, col:0, name:'SALVAGE CORE', desc:'+45% damage.',                    mods:{ damageMul:1.45 } },
      { id:'rc_tune',  row:0, col:1, name:'FIELD TUNING', desc:'+35% fire rate.',                 mods:{ rateMul:1.35 } },
      { id:'rc_mark',  row:1, col:0, name:'UNMAKING',     desc:'+10% to the vulnerability it leaves.', mods:{ vuln:0.10 } },
      { id:'rc_bore',  row:1, col:1, name:'BORED BARREL', desc:'Ignores a further 30% of armour.', mods:{ pierce:0.30 } },
      { id:'rc_scope', row:2, col:0, name:'RANGEFINDER',  desc:'+30% range and +12% damage.',     mods:{ rangeMul:1.30, damageMul:1.12 } },
      { id:'rc_long',  row:2, col:1, name:'LONG DECAY',   desc:'The vulnerability lasts 2s longer.', mods:{ vulnDur:2.0 } }
    ],
    branches: [
      { id: 'unmaker', name: 'UNMAKER', cost: 400, mods: { damage: 205, rate: 0.85, vuln: 0.34, vulnDur: 3.5, pierce: 0.5 },
        surge: { vuln: 0.05 }, note: 'Every target it touches becomes everyone else\'s problem to finish.' },
      { id: 'repeater', name: 'REPEATER', cost: 400, mods: { damage: 84, rate: 2.1, vuln: 0.14, vulnDur: 2.2, splash: 0.8 },
        surge: { rate: 0.22 }, note: 'A stream of small unmakings rather than one large one.' }
    ]
  },

  quartermaster: {
    id: 'quartermaster', element: 'radiant', origin: 'human', name: 'QUARTERMASTER', role: 'Supply — makes gold go further', cost: 300, costGrowth: 2.15,
    color: '#fde68a', dark: '#78500a', attack: 'depot', glyph: '⌸',
    desc: 'Human logistics, which is to say paperwork with a roof on it. It mints nothing at all. Every upgrade bought on a tower inside the depot is requisitioned rather than purchased, and a lump sum lands when a wave ends. LATE-GAME by design — a discount is worth what the thing discounted costs, and nothing bought in wave two costs enough to be worth saving on.',
    base: { range: 3.0, dmgType: 'none', waveBonus: 72, requisition: 0.10 },
    levels: [
      { cost: 155, name: 'DEPOT',     mods: { waveBonus: 125, requisition: 0.15 } },
      { cost: 275, name: 'LOGISTICS', mods: { waveBonus: 190, requisition: 0.20, range: 3.4 } }
    ],
    talents: [
      { id:'qm_req',  row:0, col:0, name:'REQUISITION', desc:'+70% wave payment.',        mods:{ waveBonus:140 } },
      { id:'qm_drip', row:0, col:1, name:'FORWARD DEPOT', desc:'A further 5% off upgrades inside it.', mods:{ requisition:0.05 } },
      { id:'qm_wide', row:1, col:0, name:'WIDE DEPOT',  desc:'+40% radius.',              mods:{ rangeMul:1.40 } },
      { id:'qm_skim', row:1, col:1, name:'FIELD WORKSHOP', desc:'A further 6% off upgrades inside it.', mods:{ requisition:0.06 } },
      { id:'qm_bulk', row:2, col:0, name:'BULK ORDER',  desc:'+120% wave payment.',       mods:{ waveBonus:240 } },
      { id:'qm_mix',  row:2, col:1, name:'FULL LEDGER', desc:'+155 wave payment and a further 4% off upgrades.', mods:{ waveBonus:155, requisition:0.04 } }
    ],
    branches: [
      { id: 'commissary', name: 'COMMISSARY', cost: 440, mods: { waveBonus: 540, requisition: 0.12, range: 3.8 },
        surge: { waveBonus: 125 }, note: 'One payment per wave, and it is a large one.' },
      { id: 'convoy', name: 'CONVOY', cost: 440, mods: { waveBonus: 250, requisition: 0.32, range: 4.2 },
        surge: { requisition: 0.02 }, note: 'Nothing inside the column is ever bought at list price.' }
    ]
  }
};

const TOWER_ORDER = ['bolt', 'cryo', 'mortar', 'arc', 'pyre', 'railgun', 'toxin', 'beacon',
                     'tether', 'prism', 'sapper', 'singularity', 'vault', 'flak', 'siphon', 'dronebay',
                     'canister', 'reclaimer', 'quartermaster'];

const LOADOUT_SIZE = 5;

/* --------------------------------------------------------------------------
   UNLOCK LAW — what souls buy, what the story issues, and what one purchase
   costs the next one.
-------------------------------------------------------------------------- */

/* The machine line is EARNED, never sold. Robotic hardware is the reward for
   finishing a solar system, so the shop has to refuse it outright rather than
   price it: an entry carrying a price nobody can legally pay is the same lie
   as a wrong price. `robotic` stays an UNGATED origin all the same --
   AI.rivalArsenal reads `gated` to decide what a rival may hold, and
   narrowing it there would hand the player a shelf the rival cannot mirror. */
const STORY_TOWER_ORIGIN = 'robotic';

/* The order they are issued in, one per solar system conquered. DRONE BAY is
   first because it is the only machine that reads at a glance -- something
   leaves the building and kills things. RAILGUN is the plain second. ECHO
   teaches adjacency and PYLON pays it off, which is the whole robotic rule.
   FOUNDRY, QUAKE and SINGULARITY reshape a board and want a board to reshape.
   VAULT is last: an economy tower only pays a player who already has
   somewhere to spend.

   NULL FIELD and REPLICATOR sit LATE, and for opposite reasons. NULL FIELD is
   an answer, not an upgrade -- it is worth nothing until the campaign is
   actually fielding menders, wraiths, jammers and blinks, which is deep in
   the ladder -- so it lands after QUAKE, once the escalations that build a
   wave around one ability are routine. REPLICATOR is the longest investment
   in the arsenal and it SPENDS BOARD: it pays nothing for several waves and
   then fills tiles the player did not choose, which is a gift only to a
   commander who has already run out of things to buy. That is the same
   argument that puts VAULT last, so it goes one rung further out.

   Both are `origin: 'robotic'`, which is the whole story lock -- Meta.
   isStoryTower reads the origin, so neither can be priced by the soul shop
   any more than the existing eight can. */
const ROBOTIC_UNLOCK_ORDER = ['dronebay', 'railgun', 'echo', 'pylon',
                              'foundry', 'quake', 'nullfield', 'singularity',
                              'vault', 'replicator'];

/* Every soul-shop purchase raises the next one on that banner by this much.
   It stops a hoarded bank buying the whole arsenal in one sitting, which is
   what turned the shop into a single shopping trip instead of a decision made
   again across a campaign. Per banner, not per install, because the shelves
   are per banner too -- a second profile must not inherit the first's bill. */
const SOUL_INFLATION_STEP = 1;

/* --------------------------------------------------------------------------
   TOWER FIRING PREVIEW (soul shop card + loadout card)

   The preview is a real animation, so it needs real time. Fixed 1/60 steps
   ran it at whatever the display refreshes at -- 2.4x too fast on a 144Hz
   panel, which also put the cadence on screen at odds with the fire rate
   printed two lines above it.
-------------------------------------------------------------------------- */
/* A tab restored from the background hands back one enormous delta; without a
   ceiling the dummies teleport the length of the lane on the first frame. */
const TP_MAX_DT = 1 / 20;
/* Dummies march at this many canvas pixels per second. */
const TP_MARCH_PPS = 22;
/* A shot crosses to its target in 1/this seconds. */
const TP_SHOT_SPEED = 3.3;
/* Recoil decays at the SAME rate the engine uses (Tower.step, entities.js),
   so the gun in the shop kicks the way the gun on the board does. */
const TP_RECOIL_DECAY = 5;
/* Cadence floor. A tower slower than this sits still long enough for the
   preview to read as broken rather than as slow. */
const TP_MIN_RATE = 0.5;

/* --------------------------------------------------------------------------
   PROGRESSIVE TOWER CARDS (loadout grid)

   The loadout screen shows every tower you own -- 39 once the arsenal fills
   out -- and a card that prints its whole stat block at rest turns that into
   a wall nobody reads. Cards therefore rest small and expand on hover, focus
   or tap. These three numbers are what stops the expansion breaking the
   layout it expands inside; UI.renderLoadout pushes them onto the grid as
   custom properties so the CSS and the geometry maths cannot drift apart.
-------------------------------------------------------------------------- */

/* Height of the fixed slot each card is positioned inside. The grid measures
   SLOTS, never cards, so this -- not the card -- is what guarantees a
   neighbour cannot move when a card opens. It must clear the resting card's
   own content: set too small, every card overhangs the one below it at rest.
   Verified against the real box at 4-, 3- and 2-column widths. */
const LO_CARD_REST_H = 72;

/* Expansion duration in ms, paired with --e-enter. Long enough to read as
   growth rather than a flicker; short enough that sweeping across the grid
   never feels sticky. Ignored entirely under prefers-reduced-motion, where
   the panel appears instantly rather than not at all. */
const LO_CARD_EXPAND_MS = 240;

/* Clearance kept between an opened card and the bottom of the window. Below
   it the card opens UPWARD instead: on the last row a downward panel lands on
   top of the DEPLOY button, and a control you cannot click is the worse
   failure of the two. */
const LO_CARD_EDGE_PAD = 16;

/* MouseEvent.detail on a click a BUTTON raised from Enter or Space. Every
   pointer click carries a click count of one or more, so this is the one
   reliable way to tell a keyboard activation from a mouse one after the
   fact -- which is what decides whether a re-render should take focus back.
   It protects against stealing focus from a MOUSE user, who would then be
   given a focus ring they never asked for. */
const CLICK_DETAIL_KEYBOARD = 0;

/* --------------------------------------------------------------------------
   ENEMIES

   `bounty` is AUTHORED gold, the one table applyGoldSquish leaves alone. It is
   squished at the single place it becomes PAID gold -- the Enemy constructor,
   AFTER the wave multiplier -- because every paid bounty is born there: wave
   spawns (x waveBountyMultiplier), reanimates, musters, charms and revives
   (x1). Squishing the table instead would floor a 3-bounty mite up to a
   whole gold before the x3.2+ wave multiplier ever touched it, so mite and
   spawnling waves paid 2-2.7x their share; measured over 30 seeded mirror-AI
   runs that lengthened the fresh curve by a full wave (mean 10.2 vs 9.2),
   while squishing after the multiplier left it at 9.2. Nothing displays the
   authored figure: the dossier shows health, speed, armour and lives only.
-------------------------------------------------------------------------- */
const ENEMY_TYPES = {
  shardling:  { id:'shardling', name:'Shard Sentry', hp:210, speed:1.05, armor:6, bounty:26, lives:1, radius:11,
                color:'#94a3b8', shape:'block', splashResist:0.65, elemWeak:{ storm:0.35 },
                desc:'Faceted plating scatters blast waves — splash damage does 65% less. Storm shivers the lattice apart.' },
  basalt:     { id:'basalt', name:'Basalt Marcher', hp:340, speed:0.85, armor:10, bounty:34, lives:2, radius:13,
                color:'#78716c', shape:'boss', slowResist:1.0, elemWeak:{ fire:0.3 },
                desc:'A walking slab of sintered stone. Nothing slows it; heat is the only thing that reaches what thinks inside.' },
  crawler:    { id:'crawler', name:'Picket', hp:62, speed:1.15, armor:0, bounty:9, lives:1, radius:10,
                color:'#e05555', shape:'block', desc:'The standing guard of the Vigil, issued by the thousand. It does not ask who you are before it starts.' },
  sprinter:   { id:'sprinter', name:'Outrunner', hp:44, speed:2.35, armor:0, bounty:10, lives:1, radius:8,
                color:'#fbbf24', shape:'chevron', desc:'A scout frame stripped of everything but legs. Fragile, and always first to the line.' },
  mite:       { id:'mite', name:'Mote', hp:24, speed:1.65, armor:0, bounty:3, lives:1, radius:6,
                color:'#f472b6', shape:'dot', desc:'A fingernail of chassis with one instruction left in it. Arrives in numbers nobody counted.' },
  bulwark:    { id:'bulwark', elemResist:{frost:0.5}, name:'Palisade', hp:330, speed:0.72, armor:9, bounty:29, lives:3, radius:14,
                elemWeak:{ storm:0.3 },
                color:'#7d93b8', shape:'hex', desc:'Shield plate welded shut a very long time ago. Bring magic or armour shred.' },
  wisp:       { id:'wisp', name:'Lantern', hp:88, speed:1.55, armor:2, bounty:15, lives:1, radius:9,
                elemWeak:{ storm:0.4 },
                color:'#5eead4', shape:'diamond', flying:true, desc:'A watch-light still flying the old patrol arc, straight over your maze, indifferent to the ground.' },
  aegis:      { id:'aegis', elemResist:{storm:0.5}, name:'Aegis Sentinel', hp:165, speed:1.0, armor:3, bounty:24, lives:2, radius:12,
                color:'#60a5fa', shape:'shield', shield:140, shieldRegen:34, shieldDelay:2.8,
                desc:'A self-repairing barrier absorbs everything except pure venom.' },
  mender:     { id:'mender', name:'Restorer', hp:145, speed:0.95, armor:2, bounty:28, lives:2, radius:11,
                elemWeak:{ venom:0.4 },
                color:'#34d399', shape:'cross', healRate:22, healRadius:2.4,
                desc:'A field-repair unit that mends whatever machine is nearest. Kill it first or nothing else dies.' },
  cluster:    { id:'cluster', name:'Divider', hp:155, speed:1.08, armor:1, bounty:19, lives:2, radius:13,
                elemWeak:{ fire:0.35 },
                color:'#c084fc', shape:'blob', splitInto:'spawnling', splitCount:3,
                desc:'A segmented frame that fails safe: destroy it and three Fragments carry on the patrol.' },
  spawnling:  { id:'spawnling', name:'Fragment', hp:46, speed:1.5, armor:0, bounty:4, lives:1, radius:7,
                color:'#d8b4fe', shape:'dot', desc:'Released when a Divider comes apart. Still marching, still certain it is helping.' },
  juggernaut: { id:'juggernaut', elemResist:{fire:0.5}, name:'Ironmarch', hp:980, speed:0.56, armor:16, bounty:75, lives:5, radius:17,
                elemWeak:{ frost:0.3 },
                color:'#94a3b8', shape:'jugger', slowResist:0.45, desc:'A mobile fortification that was never meant to leave its wall.' },
  jammer:     { id:'jammer', name:'Interdictor', hp:210, speed:1.05, armor:4, bounty:35, lives:2, radius:12,
                color:'#f59e0b', shape:'jammer', jam:{ radius:2.6, duration:2.2, interval:6.5 },
                desc:'SILENCES every tower around it for 2.2s on a timer. The containment routine was written for hostile emplacements; yours qualify.' },
  blink:      { id:'blink', name:'Phase Courier', hp:120, speed:1.25, armor:2, bounty:28, lives:2, radius:10,
                color:'#a78bfa', shape:'blink', teleport:{ tiles:3.2, interval:4.0 },
                desc:'TELEPORTS three tiles down the lane every four seconds, still running dispatches to a garrison that fell centuries ago.' },
  warden:     { id:'warden', name:'Warden', hp:420, speed:0.88, armor:11, bounty:46, lives:3, radius:15,
                color:'#fb923c', shape:'warden', slowResist:1, pullImmune:true,
                desc:'Wholly IMMUNE to slows and displacement. It was told to hold a line and has never been told the line moved.' },
  wraith:     { id:'wraith', elemResist:{void:0.6}, name:'Ghost Chassis', hp:230, speed:1.3, armor:3, bounty:40, lives:2, radius:11,
                elemWeak:{ fire:0.35 },
                color:'#c4b5fd', shape:'wraith', phase:{ on:1.3, off:3.0 },
                desc:'Phases INVULNERABLE for 1.3s out of every 4.3s. Half of it is somewhere your guns are not.' },
  nullifier:  { id:'nullifier', name:'Nullifier', hp:290, speed:0.95, armor:5, bounty:43, lives:3, radius:13,
                color:'#2dd4bf', shape:'null', magicImmune:true,
                desc:'IMMUNE to magic damage — a countermeasure frame built against something that used it. Keep physical on the field.' },
  revenant:   { id:'revenant', elemResist:{venom:0.5}, name:'Reconstructor', hp:260, speed:1.0, armor:6, bounty:44, lives:3, radius:13,
                color:'#94a3b8', shape:'revenant', revive:0.45,
                desc:'Stands back up once at 45% health. Self-repair was the entire point of the design.' },
  carrier:    { id:'carrier', name:'Foundry Carrier', hp:520, speed:0.66, armor:8, bounty:59, lives:4, radius:18,
                color:'#fda4af', shape:'carrier', summon:{ type:'mite', count:3, interval:4.2 },
                desc:'Prints and disgorges Motes the whole way down the lane.' },

  /* ---- aura carriers: they barely fight, they make everything around them
     harder to control. Killing the carrier is the counterplay. ---- */
  warchief:   { id:'warchief', name:'Marshal Pylon', hp:340, speed:0.92, armor:7, bounty:44, lives:3, radius:14,
                color:'#fb7185', shape:'warchief',
                aura:{ radius:3.0, slowResist:0.70, tint:'#fb7185', label:'RESOLVE' },
                desc:'AURA — machines within 3 tiles resist 70% of all slowing. Cryo becomes almost useless while it stands.' },
  anchorite:  { id:'anchorite', name:'Anchor Pylon', hp:400, speed:0.8, armor:9, bounty:46, lives:3, radius:15,
                color:'#fbbf24', shape:'anchorite',
                aura:{ radius:2.8, pullResist:0.90, tint:'#fbbf24', label:'ANCHOR' },
                desc:'AURA — machines within 2.8 tiles cannot be displaced. Tether and Singularity do nothing near it.' },
  herald:     { id:'herald', name:'Cadence Pylon', hp:265, speed:1.2, armor:4, bounty:42, lives:2, radius:12,
                elemWeak:{ frost:0.35 },
                color:'#f0abfc', shape:'herald',
                aura:{ radius:3.2, speed:0.40, tint:'#f0abfc', label:'HASTE' },
                desc:'AURA — machines within 3.2 tiles move 40% faster, cutting the time your board has to kill them.' },
  bastion:    { id:'bastion', name:'Bastion Pylon', hp:460, speed:0.75, armor:12, bounty:48, lives:3, radius:16,
                elemWeak:{ void:0.3 },
                color:'#a3a3a3', shape:'bastion',
                aura:{ radius:2.6, armor:10, tint:'#a3a3a3', label:'PLATING' },
                desc:'AURA — machines within 2.6 tiles gain +10 armour. Physical damage falls off a cliff around it.' },

  mb_colossus:{ id:'mb_colossus', elemResist:{fire:0.4}, name:'COLOSSUS', hp:820, speed:0.5, armor:11, bounty:175, lives:4, radius:23,
                color:'#cbd5e1', shape:'jugger', miniboss:true, slowResist:0.6,
                desc:'Miniboss. A siege frame under centuries of accreted plate — physical damage struggles.' },
  mb_seraph:  { id:'mb_seraph', name:'VESPER', hp:620, speed:1.15, armor:5, bounty:170, lives:4, radius:20,
                color:'#67e8f9', shape:'diamond', flying:true, miniboss:true,
                desc:'Miniboss. A high-altitude interceptor still flying its patrol. Airborne and fast.' },
  mb_hydra:   { id:'mb_hydra', name:'MYRIAD', hp:700, speed:0.8, armor:6, bounty:172, lives:4, radius:21,
                color:'#c084fc', shape:'blob', miniboss:true, splitInto:'cluster', splitCount:3,
                desc:'Miniboss. Fails into three Dividers, which fail again.' },
  mb_oracle:  { id:'mb_oracle', name:'ORACLE', hp:660, speed:0.9, armor:7, bounty:172, lives:4, radius:20,
                color:'#f59e0b', shape:'jammer', miniboss:true, jam:{ radius:3.4, duration:2.6, interval:6.0 },
                desc:'Miniboss. Runs the containment routine across a wide radius, silencing every tower inside it.' },
  mb_lich:    { id:'mb_lich', name:'RECLAIMER', hp:760, speed:0.85, armor:5, bounty:180, lives:4, radius:21,
                color:'#34d399', shape:'cross', miniboss:true, healRate:70, healRadius:3.4,
                desc:'Miniboss. Pours salvage into everything around it faster than you can take it apart.' },

  harbinger:  { id:'harbinger', elemResist:{fire:0.25,frost:0.25,storm:0.25,venom:0.25,void:0.25}, name:'HARBINGER', hp:9200, speed:0.52, armor:24, bounty:520, lives:14, radius:26,
                color:'#ef4444', shape:'boss', boss:true, slowResist:0.6, slowCap:0.4,
                summon:{ type:'spawnling', count:3, interval:6.0 },
                phases:[ {at:0.66, armorDelta:-6, speedMul:1.18, msg:'THE HARBINGER SHEDS ITS PLATING'},
                         {at:0.33, armorDelta:-6, speedMul:1.35, msg:'THE HARBINGER ENRAGES'} ],
                desc:'Boss. What the Vigil sends when it cannot classify a threat. Sheds armour and accelerates as it takes damage.' }
};

const MINIBOSSES = ['mb_colossus', 'mb_seraph', 'mb_hydra', 'mb_oracle', 'mb_lich'];
/* The rota is indexed by the SLOT, so a wave the rule declines to field burns
   its slot as well -- which is how VESPER and ORACLE ended up rostered at
   waves 35 and 45, past a curve whose own comment calls ~25 a terminus. Named
   here so the rule (Game.minibossFor), the sidebar hint and the Field Manual
   all quote ONE number; the two strings said "every 5" while the shipped
   cadence was 10. Guards against: the interval drifting away from the copy
   that advertises it, again. BATCH-C/nside */
const MINIBOSS_EVERY = 5;             /* waves between miniboss escorts */

/* --------------------------------------------------------------------------
   WAVES
-------------------------------------------------------------------------- */
const WAVES = [
  { name:'FIRST CONTACT', reward:70, groups:[ {type:'crawler',count:10,gap:0.85,delay:0} ]},
  { name:'PROBING RUN',   reward:82, groups:[ {type:'crawler',count:12,gap:0.7,delay:0}, {type:'sprinter',count:6,gap:0.55,delay:9} ]},
  { name:'ARMOURED PUSH', reward:94, groups:[ {type:'crawler',count:14,gap:0.55,delay:0}, {type:'mite',count:14,gap:0.2,delay:5}, {type:'bulwark',count:2,gap:3,delay:11} ]},
  { name:'AIRBORNE',      reward:106,groups:[ {type:'wisp',count:8,gap:0.9,delay:0}, {type:'crawler',count:14,gap:0.5,delay:3}, {type:'sprinter',count:8,gap:0.45,delay:12} ]},
  { name:'DISRUPTION',    reward:120,groups:[ {type:'jammer',count:2,gap:3,delay:0}, {type:'warchief',count:1,gap:1,delay:6}, {type:'aegis',count:4,gap:1.9,delay:3}, {type:'bulwark',count:3,gap:2.4,delay:8}, {type:'sprinter',count:10,gap:0.35,delay:15} ]},
  { name:'FIELD SURGERY', reward:134,groups:[ {type:'mender',count:3,gap:3,delay:0}, {type:'cluster',count:6,gap:1.3,delay:2}, {type:'blink',count:4,gap:1.6,delay:7}, {type:'mite',count:24,gap:0.16,delay:11}, {type:'wisp',count:8,gap:0.8,delay:17} ]},
  { name:'HEAVY ARMOUR',  reward:148,groups:[ {type:'juggernaut',count:2,gap:6,delay:0}, {type:'bastion',count:2,gap:3,delay:5}, {type:'anchorite',count:2,gap:3,delay:11}, {type:'warden',count:3,gap:2.2,delay:3}, {type:'bulwark',count:5,gap:1.5,delay:7}, {type:'mender',count:3,gap:2.5,delay:12}, {type:'nullifier',count:3,gap:2,delay:17}, {type:'basalt',count:2,gap:3,delay:20} ]},
  { name:'DARKENED SKY',  reward:162,groups:[ {type:'wisp',count:20,gap:0.42,delay:0}, {type:'herald',count:2,gap:3,delay:4}, {type:'wraith',count:4,gap:1.8,delay:5}, {type:'aegis',count:6,gap:1.5,delay:9}, {type:'mender',count:4,gap:2.2,delay:13}, {type:'sprinter',count:14,gap:0.28,delay:18} ]},
  { name:'FULL ASSAULT',  reward:178,groups:[ {type:'juggernaut',count:3,gap:4.5,delay:0}, {type:'warchief',count:2,gap:3,delay:4}, {type:'anchorite',count:2,gap:3,delay:8}, {type:'bastion',count:2,gap:3,delay:14}, {type:'carrier',count:2,gap:5,delay:2}, {type:'cluster',count:8,gap:0.9,delay:5}, {type:'revenant',count:5,gap:1.5,delay:9}, {type:'aegis',count:6,gap:1.1,delay:13}, {type:'wisp',count:14,gap:0.45,delay:18}, {type:'mite',count:28,gap:0.14,delay:23}, {type:'shardling',count:4,gap:1.6,delay:20} ]},
  { name:'THE HARBINGER', reward:270, boss:true, groups:[ {type:'bulwark',count:6,gap:1.2,delay:0}, {type:'warchief',count:2,gap:2,delay:8}, {type:'bastion',count:3,gap:2,delay:12}, {type:'herald',count:2,gap:2,delay:20}, {type:'harbinger',count:1,gap:1,delay:6}, {type:'juggernaut',count:4,gap:3,delay:10}, {type:'warden',count:4,gap:2,delay:14}, {type:'mender',count:5,gap:1.8,delay:18}, {type:'wisp',count:16,gap:0.4,delay:23}, {type:'cluster',count:10,gap:0.7,delay:28} ]}
];

/* --------------------------------------------------------------------------
   BATTLE ROSTERS AND STAGGERED INTRODUCTION

   WAVES above stopped being the enemy list. It is now the SHAPE of a wave --
   how many bodies, in how many groups, at what spacing and delay -- and the
   MASS each of those groups carries. WHICH creature carries that mass is
   decided per battle, drawn from the map's own roster on a schedule that
   introduces exactly one new type on wave 1 and one more every second wave
   after it.

   What this protects against: wave 5 used to introduce FIVE unfamiliar types
   at once, which is where the first-contact dossier stopped teaching and
   started interrupting. And it protects the calibrated pins -- composeWave
   below moves neither a wave's total health nor its total bounty, measured at
   0.00% drift across all nine maps over waves 1-30.
-------------------------------------------------------------------------- */

/** Non-boss types one battle may field. The owner's cap; bosses and
    minibosses are exempt from it and from the schedule below. */
const ROSTER_MAX = 8;
/** Waves between introductions: one new type on wave 1, then 3, 5, 7 ... */
const ROSTER_INTRO_EVERY = 2;
/** Faction troops on a garrisoned world. They REPLACE machine slots rather
    than adding to them, because ROSTER_MAX caps the battle, not the machines.

    Raised from three to the whole set of five. Three of eight left the Vigil
    holding the majority on a world a power actually garrisons, so a Xeno
    fortress and a neutral rock fielded near enough the same battle and the
    twenty faction units read as a garnish on the machines. Five of eight is
    the owner's "mainly their own troops" while still leaving the map its
    opening body and its two authored denizens standing -- which is exactly
    what `keep` below protects, and why this must never go past ROSTER_MAX - 3.
    The introduction schedule is untouched: the roster is still eight long and
    still opens one type at a time. */
const ROSTER_FACTION_SLOTS = 5;
/** Added to a candidate's log-mass distance when this wave has already drawn
    it. 0.7 is about ln(2): a type already used loses to any unused type within
    a factor of two of the mass wanted, and beats anything further out. Raise
    it and heavy template waves get paid in light bodies while the heavy half
    of the roster is still locked -- measured, peak bodies in one wave went
    54 -> 84, past the volume COUNT_SCALE was cut to control. Drop it to zero
    and one type carries whole waves. */
const ROSTER_REUSE_PENALTY = 0.7;

/* Introduction order is by THREAT, not by health, and the difference is
   speed. Substitution preserves a wave's total health exactly, but health is
   not the whole of what a wave costs you: a body that crosses the killzone
   twice as fast gives your board half the firing time and leaks at its own
   life value regardless of how little health it had. Ordering purely by
   health put the 2.35-speed Outrunner in the wave-1 slot on four maps, and
   the mirror-AI harness measured the whole run ending FOUR waves earlier
   there (median 12 -> 8) while two maps whose lightest body was an ordinary
   Picket did not move at all. Time-in-range goes as 1/speed, so speed enters
   squared against the baseline body's own pace. */
const ROSTER_BASE_SPEED = 1.15;   /* the Picket -- the baseline infantry pace */
const ROSTER_SPEED_POWER = 2;
/* A healer, an aura, a breeder or anything that splits puts more on the board
   than its own health line admits, so raw health understates what it costs. Measured: THE DELTA
   introduced its Restorer on wave 3 under a health-only ordering and the
   mirror-AI run ended two waves earlier than the same map on the old table;
   taxed out to wave 9 it came back inside a wave. */
const ROSTER_SUPPORT_TAX = 1.6;

/** What a creature is worth as an INTRODUCTION. Three corrections to raw
    health, all in the same direction -- a shield IS health, speed only ever
    ADDS (being slow is not a licence to arrive early, or a 330-health
    Palisade at 0.72 speed would outrank a Picket for the wave-1 slot), and
    support work is taxed. Never used for substitution, which matches on
    health alone because health is what substitution preserves. */
function rosterWeight(id) {
  const d = ENEMY_TYPES[id];
  const support = (d.healRate || d.aura || d.summon || d.splitInto) ? ROSTER_SUPPORT_TAX : 1;
  return (d.hp + (d.shield || 0)) * support *
         Math.pow(Math.max(1, (d.speed || 1) / ROSTER_BASE_SPEED), ROSTER_SPEED_POWER);
}

/** Deterministic 32-bit string hash, so a world's garrison mix is the same
    every time it is opened and a galaxy still regenerates from its seed. */
function rosterHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* The spread a board without an authored roster is filled out from, ordered
   light to heavy so the schedule still teaches in the right direction. Any
   map added by another hand -- a later domain's boards, a future arena -- gets
   a real battle out of this instead of one type repeated for thirty waves. */
const ROSTER_FILL = ['crawler', 'sprinter', 'wisp', 'blink', 'aegis',
                     'cluster', 'shardling', 'jammer', 'mender', 'wraith',
                     'bulwark', 'warden'];

/** The machine half of a roster, least threatening first.

    A map that declares no roster is NOT a hypothetical: three standard and
    three three-way boards land in MAPS from the map domain's own patch, and
    none of them carries one. Falling straight through to MUSTER_BASE_UNLOCK
    -- a one-element list -- gave those six boards a single-type battle: every
    wave on every one of them paid in Pickets, and their authored denizens
    never arrived at all. So the fallback BUILDS a roster instead: the map's
    own denizens first, because they are its identity and the signature slot
    draws on them, then ROSTER_FILL up to the cap. */
function machineRosterOf(map) {
  const usable = id => ENEMY_TYPES[id] &&
    !ENEMY_TYPES[id].boss && !ENEMY_TYPES[id].miniboss;
  let ids = ((map && map.roster) || []).filter(usable);
  if (!ids.length) {
    ids = ((map && map.denizens) || []).filter(usable);
    for (const id of ROSTER_FILL) {
      if (ids.length >= ROSTER_MAX) break;
      if (usable(id) && ids.indexOf(id) < 0) ids.push(id);
    }
  }
  if (!ids.length) ids = MUSTER_BASE_UNLOCK.slice();
  /* A repeated type would otherwise spend two of the eight slots on one body. */
  ids = ids.filter((id, i) => ids.indexOf(id) === i);
  return ids.slice(0, ROSTER_MAX)
    .sort((a, b) => rosterWeight(a) - rosterWeight(b));
}

/**
 * The ordered roster one battle draws from. Index k is introduced on wave
 * 1 + k * ROSTER_INTRO_EVERY, so the order IS the teaching order, and it runs
 * on rosterWeight rather than raw health for the reason recorded there.
 *
 * On a garrisoned world ROSTER_FACTION_SLOTS of the host's troops take the
 * place of the machine nearest them in mass -- nearest, so the roster keeps
 * its spread from swarm to siege. The map's denizens and its opening body are
 * never the slots taken.
 */
function battleRosterFor(map, hostFaction) {
  const machines = machineRosterOf(map);
  const pool = (typeof FACTION_ENEMIES !== 'undefined' && hostFaction)
    ? (FACTION_ENEMIES[hostFaction] || []) : [];
  if (!pool.length) return machines;

  const h = rosterHash((map && map.id ? map.id : 'field') + ':' + hostFaction);
  const slots = Math.min(ROSTER_FACTION_SLOTS, pool.length);
  const span = pool.length / slots;
  const picks = [];
  for (let i = 0; i < slots; i++) {
    /* Even stride across the set, nudged by the hash, so two worlds held by
       the same power do not field the identical half of its army. */
    const idx = Math.min(pool.length - 1,
      Math.floor(i * span) + (h >>> (i * 3)) % Math.max(1, Math.round(span)));
    if (picks.indexOf(pool[idx]) < 0) picks.push(pool[idx]);
  }

  /* The map's denizens are its flavour and its muster unlocks, and machines[0]
     is the wave-1 opener the whole early curve is measured against. Neither is
     ever the slot a garrison takes. */
  const keep = ((map && map.denizens) ? map.denizens.slice() : []).concat([machines[0]]);
  const out = machines.slice();
  for (const id of picks) {
    const want = ENEMY_TYPES[id].hp;
    let victim = -1, best = Infinity;
    for (let i = 0; i < out.length; i++) {
      if (keep.indexOf(out[i]) >= 0) continue;
      const d = Math.abs(Math.log(ENEMY_TYPES[out[i]].hp / want));
      if (d < best) { best = d; victim = i; }
    }
    /* A troop already seated is no longer a machine slot. Without this the
       next pick could evict the last one -- with five picks and only five
       replaceable slots, a heavier troop landing on a lighter one's tile is
       the difference between a garrison arriving whole and arriving short. */
    if (victim >= 0) { out[victim] = id; keep.push(id); }
    else if (out.length < ROSTER_MAX) { out.push(id); keep.push(id); }
  }
  return out.slice(0, ROSTER_MAX).sort((a, b) => rosterWeight(a) - rosterWeight(b));
}

/** The slice of `roster` a wave may draw from. One on wave 1, one more every
    ROSTER_INTRO_EVERY waves, and nothing is ever retired. */
function rosterAvailable(roster, wave) {
  const n = 1 + Math.floor(Math.max(0, wave - 1) / ROSTER_INTRO_EVERY);
  return roster.slice(0, Math.max(1, Math.min(roster.length, n)));
}

/** Nearest available type by MASS, preferring one this wave has not drawn
    yet. The rotation by `salt` stops two waves of the same shape from
    breaking every tie the same way. */
function rosterPick(avail, hp, used, salt) {
  let best = avail[0], bestScore = Infinity;
  for (let i = 0; i < avail.length; i++) {
    const id = avail[(i + Math.abs(salt | 0)) % avail.length];
    let score = Math.abs(Math.log(ENEMY_TYPES[id].hp / hp));
    if (used && used.has(id)) score += ROSTER_REUSE_PENALTY;
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/**
 * Wave `n`, composed for one battle.
 *
 * Each template group keeps its delay, its spawn window and its MASS. Only
 * the body changes: the type is re-drawn from what has been introduced and
 * the count is re-scaled by the health ratio so the same total health
 * arrives. Whatever integer body counts cannot express is settled once for
 * the whole wave, on `hpScale` -- and `bountyScale` does the same for gold,
 * so a wave pays exactly what the old table paid no matter which creature
 * carried it. Both ride multipliers the spawn already applies per entry
 * (hpMul / bountyMul), so nothing new reaches the Enemy constructor and
 * nothing downstream double-applies them.
 *
 * Measured over all nine maps and all five garrison states, waves 1-30:
 * total health drift 0.00%, total bounty drift 0.00%, hpScale inside
 * [0.85, 1.20], peak bodies in a single wave 56 against the old table's 49.
 *
 * Bosses and minibosses pass through untouched -- exempt from the cap and
 * from the introduction schedule, by the owner's brief.
 */
function composeWave(n, roster, map, countMul) {
  const base = WAVES[(n - 1) % WAVES.length];
  const avail = rosterAvailable(roster, n);
  const used = new Set();

  /* Every slot this wave has to fill: the template's groups, then the map's
     signature group -- kept from the old waveDef so the mass it added to every
     wave stays in the curve. Its SOURCE is still the map's denizen; which body
     carries it is the roster's business, and that is what lets a map's own
     creature arrive on the wave the schedule says and not before. */
  const slots = base.groups.map((g, i) =>
    ({ src: ENEMY_TYPES[g.type], raw: g.count * countMul, gap: g.gap, delay: g.delay, salt: n + i }));
  if (map && map.denizens && map.denizens.length)
    slots.push({ src: ENEMY_TYPES[map.denizens[n % map.denizens.length]],
                 raw: (2 + Math.floor(n / 3)) * countMul, gap: 1.1, delay: 5 + (n % 4),
                 salt: n, flat: true });

  /* On an introduction wave the newcomer is PINNED to a slot rather than left
     to nearest-match. Without this, a heavy newcomer that unlocks on a wave
     whose template asks for nothing heavy is simply not drawn, and "one new
     type every second wave" quietly becomes "one new type every second wave,
     some of the time" -- measured, four maps first fielded a type up to five
     waves after it unlocked.

     The slot is chosen on TOTAL MASS, and undershooting is penalised twice as
     hard as overshooting: a slot lighter than one newcomer forces a single
     body carrying a fraction of its own listed health (measured 0.35x), while
     a heavier slot merely sends two or three of them at full strength. */
  let pinned = -1;
  if (avail.length > rosterAvailable(roster, n - 1).length) {
    const fresh = avail[avail.length - 1], want = ENEMY_TYPES[fresh].hp;
    let best = Infinity;
    slots.forEach((s, i) => {
      if (!s.src || s.src.boss || s.src.miniboss) return;
      const mass = Math.max(1, Math.round(s.raw)) * s.src.hp;
      const d = mass >= want ? Math.log(mass / want) : 2 * Math.log(want / mass);
      if (d < best) { best = d; pinned = i; }
    });
    if (pinned >= 0) { slots[pinned].force = fresh; used.add(fresh); }
  }

  const groups = [];
  let wantHp = 0, gotHp = 0, wantGold = 0, gotGold = 0;
  for (const s of slots) {
    if (!s.src) continue;
    /* The count the old table would have produced IS the mass target. */
    const slotCount = Math.max(1, Math.round(s.raw));
    if (s.src.boss || s.src.miniboss) {
      groups.push({ type: s.src.id, count: slotCount, gap: s.gap, delay: s.delay,
                    hpScale: 1, bountyScale: 1 });
      continue;
    }
    const subId = s.force || rosterPick(avail, s.src.hp, used, s.salt);
    used.add(subId);
    const sub = ENEMY_TYPES[subId];
    /* The signature slot sends BODIES, not mass. Rescaling it was the one
       place the schedule and the old curve genuinely could not both hold: THE
       EXPANSE authors a Foundry Carrier and an Ironmarch as its denizens, so
       preserving that slot's mass paid a 980-health machine in sixteen
       Pickets on wave 2 -- identical health, but twenty-one bodies instead of
       seven and twice the lives on the line. Measured, the mirror-AI run
       there ended on wave 4 against the old table's 7. A signature slot now
       sends the same NUMBER of whatever has been introduced, floored so it can
       never deliver MORE mass than the slot authored (a light denizen with
       only a heavy body introduced would otherwise send a tenfold wave; the
       floor rather than a round is what holds the ceiling at exactly 1.0), and
       it converges on the authored group once its own denizen unlocks. It is
       neutral in the wave-wide correction below: what it delivers is what it
       wanted, so the template groups are never asked to make up its shortfall.
       The consequence, stated plainly: on the two maps whose denizens are
       siege machines the opening waves are LIGHTER than the old table until
       those machines unlock. Lighter is the safe direction, and it is the
       price of the schedule -- there is no way to introduce an Ironmarch on
       wave 13 and still put an Ironmarch's mass on the board at wave 2. */
    const count = s.flat
      ? Math.max(1, Math.min(slotCount, Math.floor(slotCount * s.src.hp / sub.hp)))
      : Math.max(1, Math.round(slotCount * s.src.hp / sub.hp));
    const src = s.flat ? sub : s.src;
    const srcCount = s.flat ? count : slotCount;
    wantHp += srcCount * src.hp;      gotHp += count * sub.hp;
    wantGold += srcCount * (src.bounty || 1); gotGold += count * (sub.bounty || 1);
    groups.push({
      type: subId, count, delay: s.delay,
      /* Same first spawn, same last spawn: a wave keeps its rhythm even when
         twice as many lighter bodies are carrying the same mass. */
      gap: Math.min(6, Math.max(0.12, s.gap * slotCount / count)),
      hpScale: 1, bountyScale: 1
    });
  }
  /* ONE correction for the whole wave rather than one per group. Integer body
     counts cannot express a slot's mass exactly, and a per-group correction
     put the error wherever it fell -- a single body carrying an eighth of its
     own listed health when a 44-health slot had only a 330-health body to
     spend it on (measured 0.13x). Spread across the wave the same errors
     cancel instead of compounding, the total is still exact, and every
     creature of a type in a wave is identical, which is what lets the preview
     print one honest number per row. */
  const hpFix = gotHp > 0 ? wantHp / gotHp : 1;
  const goldFix = gotGold > 0 ? wantGold / gotGold : 1;
  for (const g of groups) {
    if (ENEMY_TYPES[g.type].boss || ENEMY_TYPES[g.type].miniboss) continue;
    g.hpScale = hpFix; g.bountyScale = goldFix;
  }
  return { name: base.name, boss: base.boss, reward: waveReward(n), groups };
}

/* --------------------------------------------------------------------------
   SCALING

   Health compounds every single wave on the piecewise curve documented at
   waveHpMultiplier below: steep to wave 10, gentler through 20, then a hard
   terminal ramp. There is no plateau anywhere on it.
-------------------------------------------------------------------------- */
const _hpCache = [1, 1];
function waveHpMultiplier(w) {
  if (w < 1) return 1;
  for (let i = _hpCache.length; i <= w; i++) {
    /* The curve is deliberately SHORT, and its SHAPE carries the design target:
       wave 10 is a wall for an unprogressed commander, wave 20 is the ceiling
       for a fully-levelled expert, and nothing survives far past 25.

       That shape has to be piecewise, because a single accelerating exponent
       cannot do both jobs. Full meta progression is worth a measured 3x board
       power, which at 1.78/wave buys under two waves of reach -- so a uniform
       steep curve makes progression meaningless. Instead:

         waves 2-10   1.26/wave  -- ~8x by wave 10. Measured: an unprogressed
                                    commander on the five starter towers dies
                                    at a median of wave 10 here.
         waves 11-20  1.22/wave  -- gentle enough that the ~4.5x a fully levelled
                                    commander brings converts into ten more waves.
                                    Measured: a maxed profile reaches wave 20.
         waves 21+    accelerates hard to 1.85 -- a terminus, not an asymptote */
    const growth = i <= 10 ? 1.26
                 : i <= 20 ? 1.22
                 : Math.min(1.85, 1.22 + (i - 20) * 0.07);
    _hpCache[i] = _hpCache[i - 1] * growth;
  }
  return _hpCache[w];
}
/* Fewer enemies per wave (less lag), each substantially stronger. */
/* Half the bodies, each markedly stronger. The measured complaint was that
   clumping made the field unreadable and slow; volume is the lever. */
const COUNT_SCALE = 0.35;
/* NUMBER SQUISH. Health and damage are divided by the SAME factor, so every
   time-to-kill is untouched while the numbers a player reads shrink by 2.5x.
   Wave-1 crawler goes ~161hp -> ~64hp and a MK I Bolt from ~5 -> ~2. */
const NUM_SQUISH = 2.5;
const UNIT_HP_SCALE = 2.60 / NUM_SQUISH;
/* Every tower's output is scaled down globally: the opening waves were still
   melting before they reached the line. Applied in effDamage/effDamageFor so
   the whole curve shifts, not just level one. */
const GLOBAL_DAMAGE_TUNE = 0.85 / NUM_SQUISH;

/* -- GOLD SQUISH ----------------------------------------------------------
   The economy's twin of NUM_SQUISH above. Every authored GOLD figure is
   divided by this one factor, at its source, exactly once, so the numbers a
   player reads open in single digits while every RATIO the balance was tuned
   on -- price against reward, interest against income, per-copy cost growth
   against bounty growth -- is untouched. Wave-1 reward 119 -> 15, Bolt
   115 -> 14 and its MK II step 60 -> 8, contested purse 900 -> 113, a
   crawler's base bounty 9 -> 1.

   What it protects against: re-tuning ~150 literals by hand and drifting the
   curve Session 14 pinned (fresh mirror-AI median death wave 7).

   What passes through it: tower cost / level / branch prices, the
   absolute-gold tower stats in GOLD_STAT_KEYS (and the copy that quotes
   them), starting purses, waveReward(), the rush bonus, rubble clearance,
   the maw feed, and the flat starting-gold bonuses in factions.js /
   roster.js / ARENA_MODS -- each via sqGold() at its own definition, never
   at a use site. Enemy bounty is the one figure squished where it is PAID
   rather than where it is authored (the Enemy constructor, after the wave
   multiplier); the ENEMIES header below says why, with the measurement.

   What must NOT pass through it: souls (a separate currency); every
   percentage and multiplier (incomeMul, killCutMul, goldMul, relocFee,
   INTEREST_RATE, the MUSTER tier fractions, ENRAGE_BOUNTY); and everything
   DERIVED from a squished figure (the interest cap, enrageCost, musterCost
   and musterPayout, baseLevelStepCost, ascendCost, sellValue, the relocation
   fee). Those scale on their own; dividing them again halves the economy
   twice, which is the double-apply failure this block is built to prevent.

   Results are whole and at least 1, so a trickle authored below half a gold
   (killCut 2, transGold 2, reanimGold 2) floors UP to 1 rather than
   vanishing. Those few per-kill trickles therefore pay more than their exact
   eighth (killCut 2 -> 1 is 4x its share; 5 -> 1 is 1.6x); the prices and
   rewards that set the curve land within 4% of theirs, and the fresh
   mirror-AI median is unchanged (8 before and after, 30 seeded runs each). */
const GOLD_SQUISH = 8;
/** One authored gold figure, squished. The ONLY way a flat gold literal
    outside the def tables (factions, roster, arenas, consts) may be written. */
function sqGold(v) { return Math.max(1, Math.round(v / GOLD_SQUISH)); }
/** Tower stat keys denominated in absolute GOLD. Their multipliers end in
    Mul and are deliberately absent; execBounty is a fraction and absent too. */
const GOLD_STAT_KEYS = ['income', 'killCut', 'waveBonus', 'drainGold', 'sabotageGold',
                        'execGold', 'charmGold', 'transGold', 'flockGold', 'vigilGold',
                        /* THE SIX. `mawYield` is deliberately absent: it is a
                           MULTIPLE of a bounty, and ENEMY_TYPES.bounty is
                           squished where it becomes paid gold rather than in
                           this table. Squishing a multiplier would divide the
                           yield by eight twice over. */
                        'sepulchreGold', 'offeringGold', 'veilTithe'];
/** Gold per second of prep window surrendered by an early call. Was a bare 5
    inside rushWave; named so the squish reaches it exactly once. */
const RUSH_GOLD_PER_SEC = 5 / GOLD_SQUISH;
/** Share of a rush bonus paid to EVERY rival, so calling a wave early is a
    tempo choice rather than free damage. Named because it is paid in a loop
    now: a bare literal beside a hard-coded side index is what left the third
    commander on a tri board unpaid for the whole of a match. */
const RUSH_AI_COMPENSATION = 0.85;
/** Floor under a relocation fee, so moving a bare tower is never free. */
const RELOCATE_MIN_FEE = sqGold(10);
/** The rival's score per gold of permanent Vault income when it weighs an
    economy upgrade against a damage one. The old bare 9 was calibrated in
    pre-squish gold; carrying the factor keeps the rival's appetite for
    economy exactly where it was measured -- parity: the rival must not go
    off gold merely because gold got smaller. */
const AI_ECON_UPGRADE_WEIGHT = 9 * GOLD_SQUISH;
/* A wave runs about this many VAULT ticks, which is the denominator
   AI_ECON_UPGRADE_WEIGHT was calibrated against. QUARTERMASTER pays per WAVE
   rather than per tick, so its lump has to be divided down or the rival
   prices a depot five times too highly and stops building things that shoot. */
const DEPOT_TICKS_PER_WAVE = 5;
/* Upgrade gold a held board actually puts through in one Vault tick. The
   requisition discount is worth this times its percentage; a percentage with
   no reference spend behind it is a number the rival cannot compare to
   anything, which is how a stat ends up read by nobody. */
const DEPOT_REQ_REF_SPEND = sqGold(120);

/* --------------------------------------------------------------------------
   SESSION 19 -- THE PIRATE THREE AND THE MACHINE TWO

   Every number the five new towers read that is not authored in their own
   `base` block. Each says what it protects against, because each of them is
   here to stop a measured failure rather than to express a taste.
-------------------------------------------------------------------------- */

/* ---- PRESS GANG ---------------------------------------------------------
   A conscript is built out of the corpse, so its health tracks the wave
   without a curve of its own. These bound the two ends that a share cannot. */

/* Floor on a conscript's health. A mite at wave 1 yields a body worth roughly
   six health, which dies to the trample wear below before it lands a blow --
   a tower that visibly does nothing reads as broken, not as weak. */
const PRESS_MIN_HP = 14;
/* Health a conscript loses per second while it is grappling, plus the
   target's radius. Identical in shape to the Minion's trample wear so the two
   bodies on the board die on the same terms; a conscript that never wore down
   would make PRESS GANG a permanent wall rather than an opener. */
const PRESS_TRAMPLE = 9;
/* Tiles per second a conscript closes at. Slower than a forged automaton
   (3.6): a pressed hand is not a machine, and the difference is what stops
   PRESS GANG out-holding FOUNDRY on FOUNDRY's own axis. */
const PRESS_ENGAGE_SPEED = 3.0;
/* How much of a conscript's nominal throughput the RIVAL is allowed to price.
   A body only fights while one is standing and something is in reach, so
   quoting the full figure makes AI.effectiveness read PRESS GANG as though
   every conscript were a second turret. The same 0.55 discount the minion
   line already carries, for the same reason. */
const PRESS_UPTIME_DISCOUNT = 0.55;

/* ---- PRIVATEER ----------------------------------------------------------
   The steal is a share of the VICTIM'S PURSE, which is what makes it an
   investment that compounds: a rival banking for an ascension is the richest
   target on the board. A share also cannot run away -- robbing them makes
   them poorer, which makes the next theft smaller -- so no cap on the
   fraction is needed, only a cap per event. */

/* Ceiling on one theft, in multiples of the bounty the kill itself paid.
   Without it a single early kill against a rival sitting on its opening purse
   transfers a whole wave of income in one shot, and the seat that lands the
   first kill simply wins. Measured in bounties so the ceiling rides the wave
   curve rather than needing a second copy of it. */
const PRIVATEER_CAP_BOUNTIES = 6;
/* A theft that rounds to nothing still has to be visible, or the tower reads
   as inert against a broke rival. One gold is the smallest honest answer. */
const PRIVATEER_MIN_TAKE = 1;

/* ---- BLOOD PRICE --------------------------------------------------------
   The only tower in the arsenal bought with a currency other than gold.
   Everything here exists because a second currency has failure modes gold
   does not: it cannot be earned back at will, and it is the thing you lose
   the match by running out of. */

/* Lives this side must still hold AFTER the purchase. It is the hard floor
   and it is the same for both seats: BLOOD PRICE can never take your last
   life, and it can never take the rival's either. Five rather than one
   because a commander left on one life has no buffer to play the wave with
   and the tower would be a delayed loss dressed as a decision. */
const BLOOD_PRICE_FLOOR = 5;
/* Each copy costs this much more than the last, compounding, the way gold
   prices already do. Two Blood Prices must be a statement about the run and
   not a default opening. */
const BLOOD_PRICE_GROWTH = 1.6;
/* What ONE life is worth to the rival's build scorer, in gold. AI.bestAction
   divides a candidate's value by its cost, and a life-priced tower quotes
   ZERO gold -- `value / 0` is Infinity, so the rival picked BLOOD PRICE on
   every single build tick and traded its whole buffer for tempo inside four
   waves. This is the exchange rate that lets the two currencies compete
   honestly; see Game.bidCost, which is the only reader. */
const BLOOD_PRICE_BID_GOLD = sqGold(280);
/* The rival will not spend below this share of its maximum lives, whatever
   the tempo is worth. The hard floor above is a RULE and applies to both
   seats identically; this is a PREFERENCE and applies only to a commander
   the player is not driving, exactly as MUSTER_AI_SAFE_LIVES already does
   for sends. Without it the mirror-AI plays the tower correctly by its own
   arithmetic and still loses, because a buffer spent early is a buffer the
   late waves needed. */
const BLOOD_PRICE_AI_RESERVE = 0.72;

/* ---- REPLICATOR ---------------------------------------------------------
   A tower that places towers. Every guard here is about the free build being
   a real build: same legality, same price curve, same board cost. */

/* The machine will not reproduce something it cannot account for: the free
   tower's CURRENT price -- Game.towerCost, the same call that would charge a
   player -- must be at or below the Replicator's own current price times
   this. At 1.0 it is a strict rule and the curve does the rest: every copy
   you own raises the Replicator's price, so the machine's reach grows with
   your investment in it, and a gift can never outvalue the thing that made
   it. Raising this is the only way to break that. */
const REPLICATE_BUDGET_MUL = 1.0;
/* Floor on the wave gap however many SHORT CYCLE talents are stacked. At zero
   a Replicator would fire on every wave boundary and, with TWIN LINE, fill a
   board faster than the player can sell. */
const REPLICATE_MIN_WAVES = 1;

/* ---- NULL FIELD ---------------------------------------------------------
   Ability suppression. The design note is exact about the risk: a
   suppression that misses one ability is worse than none, because the player
   cannot tell which. So the field is marked once per frame onto the unit and
   every ability tick reads ONE flag -- there is no per-ability list to fall
   out of date. */

/* How long a mark survives without being refreshed. Towers step before
   enemies in Game.step, so one frame is enough in principle; a few frames of
   slack is what stops a unit flickering back to full ability on a long frame
   or a resumed tab. */
const NULL_MARK_SECONDS = 0.25;
/* Nominal body the rival prices a suppression against, and the radius that
   nominal figure was calibrated at. Suppression deals no damage, so without
   these AI.projectedUpgrade reads NULL FIELD as a zero and the rival builds
   one and never touches it again -- the same hole VIGIL_REF_HP fills for
   CUSTODIAN, priced through Game.waveHpMul, which is THE definition. */
const NULL_REF_HP = 55;
const NULL_REF_RADIUS = 3.2;
/* Nominal bodies per second a field of that radius is denying something to.
   Deliberately conservative: NULL FIELD is CONDITIONAL, and a rival that
   priced it as though every wave were built on an ability would field it
   against plain armoured waves where it does literally nothing. */
const NULL_REF_RATE = 0.5;
/* What a point of `nullVuln` is worth relative to the suppression itself,
   for the same scorer. */
const NULL_VULN_WEIGHT = 2.2;

/**
 * The one normalisation pass. Called ONCE, from towers2.js, after the
 * expansion roster has merged into TOWER_TYPES, so core and expansion towers
 * are squished by the same loop. Idempotent by construction -- a second call
 * is a no-op -- because dividing the tables twice is precisely the failure
 * the whole block exists to prevent.
 */
function applyGoldSquish() {
  if (applyGoldSquish.done) return;
  applyGoldSquish.done = true;
  const sq = sqGold;
  /* Player-facing copy that quotes a gold figure is rewritten alongside the
     stat it describes, so a tooltip can never promise the pre-squish number. */
  const fixCopy = s => typeof s === 'string'
    ? s.replace(/(\+?)(\d+) gold\b/g, (m, plus, n) => plus + sq(+n) + ' gold') : s;
  const squishStats = o => {
    if (!o) return 0;
    let hit = 0;
    for (const k of GOLD_STAT_KEYS) if (typeof o[k] === 'number') { o[k] = sq(o[k]); hit = 1; }
    return hit;
  };
  for (const id in TOWER_TYPES) {
    const d = TOWER_TYPES[id];
    d.cost = sq(d.cost);
    squishStats(d.base);
    for (const l of d.levels || []) { l.cost = sq(l.cost); squishStats(l.mods); }
    for (const b of d.branches || []) {
      b.cost = sq(b.cost);
      /* bitwise OR on purpose: both halves must run, no short-circuit */
      if (squishStats(b.mods) | squishStats(b.surge)) b.note = fixCopy(b.note);
    }
    for (const t of d.talents || []) if (squishStats(t.mods)) t.desc = fixCopy(t.desc);
  }
  for (const d of DIFFICULTIES) d.gold = sq(d.gold);
  /* ENEMY_TYPES.bounty is deliberately NOT in this loop -- see the ENEMIES
     header: it is squished where it becomes paid gold, in the Enemy
     constructor, after the wave multiplier. */
}

/* --------------------------------------------------------------------------
   RATIO STAT CEILINGS

   applyTech ADDS every plain numeric stat. Several talents were authored as
   replacements for a fraction rather than additions to it, so they pushed
   ratio stats past the value they are supposed to express -- most severely
   ARC, whose stock SUPERCONDUCTOR talent drove `falloff` to 1.82 and made
   chain lightning AMPLIFY per hop (the 11th link hit for 400x the first).

   Addition is kept, so each branch keeps its own identity, but these stats
   stop at a ceiling that preserves their meaning.
-------------------------------------------------------------------------- */
const STAT_CEIL = {
  falloff: 0.95, splitFalloff: 0.95, echoFrac: 0.95, aftershock: 0.90,
  charmHpBonus: 0.90, minionSlow: 0.85, novaKeep: 0.80, reckonFrac: 0.90,
  pierce: 0.90, crit: 0.75, vuln: 0.60, slow: 0.85, freezeChance: 0.50,
  transmute: 0.50, hold: 0.80, execThreshold: 0.40,
  flockHp: 1.20, flockSpeed: 0.60,
  /* runFalloff is authored the way `falloff` already is: the talent states
     the rate it wants and the ceiling is what delivers it. killReload cannot
     usefully exceed one whole reload; requisition is ceilinged again inside
     the reader, because surges bypass this table entirely. */
  runFalloff: 0.90, killReload: 1.00, requisition: 0.45, digest: 0.30,
  /* THE SIX. sepulchreFrac is ceilinged again inside its reader
     (SEPULCHRE_FRAC_MAX) because branches and ascension surges skip this
     table entirely, and a ward stronger than the tower it replaced makes
     selling strictly better than keeping. */
  sepulchreFrac: 1.00, offeringDmg: 0.60, offeringGuard: 0.60, veilSlow: 0.60
};
function waveCountMultiplier(w) { return 1 + (w - 1) * 0.022; }
/** Bounty still grows slower than health, but it has to keep enough pace that
    the wall is a SKILL wall rather than an arithmetic one. Raised alongside the
    steeper HP curve. */
/* Bounty is paid per kill, so halving the unit count would have halved gold
   income; per-unit bounty roughly doubles to keep the economy whole. */
function waveBountyMultiplier(w) { return 3.2 * Math.pow(1.17, w - 1); }

/* Wave reward used to read a cyclic ten-entry table whose tenth entry is a boss
   spike, so income COLLAPSED 72% from wave 10 to wave 11 (956 -> 269) and again
   after every boss, precisely when the player had just spent everything. Income
   now climbs smoothly and the boss bonus is paid as a separate one-off. */
function waveReward(w) {
  const base = 70 + (w - 1) * 14;
  const boss = WAVES[(w - 1) % WAVES.length].boss ? 260 * Math.pow(1.14, w - 1) : 0;
  /* GOLD_SQUISH applied here and nowhere downstream: interest cap, enrage
     cost, muster cost and payout all read this function and scale with it. */
  return Math.max(1, Math.round((base * 1.7 * Math.pow(1.14, w - 1) + boss) / GOLD_SQUISH));
}
/** Build windows are SHORT. The measured complaint was that 65% of a match was
    prep and 38% of it had nothing affordable; the answer is less waiting, not
    more gold. */
function prepTime(w) { return w === 0 ? 22 : Math.max(7, 15 - w * 0.35); }

/* ── BANKED CAPITAL ───────────────────────────────────────────────────────
   Gold held across a wave boundary pays a return, so declining to spend is
   itself a play. The payout is capped as a fraction of the wave's own reward
   rather than as a flat number, so banking stays worth roughly the same
   share of your income at wave 3 and wave 30 and can never outgrow the
   board. Without the cap this compounds into a runaway, which is the exact
   failure the source game guards against. */
const INTEREST_RATE = 0.06;
const INTEREST_CAP_FRAC = 0.35;
function interestOn(gold, wave, mul) {
  if (gold <= 0) return 0;
  return Math.floor(Math.min(gold * INTEREST_RATE * (mul || 1),
                             waveReward(wave) * INTEREST_CAP_FRAC));
}

/* ── ENRAGE ───────────────────────────────────────────────────────────────
   The player may make the next wave harder for a larger payout, which turns
   difficulty itself into something you can invest in. Stacks are per-wave and
   never carry over, and they are capped, so there is no repeatable maximum
   the optimiser can grind. */
/* Share of a tower's CURRENT invested gold that picking it up and setting it
   down again costs (owner-set at one third, ROADMAP Session 14 decisions). It
   is a named const because the figure is now quoted in THREE places -- the MOVE
   button, the Field Manual and freshMods() -- and a manual that quotes a fee
   the engine no longer charges is worse than one that never mentioned it. */
const RELOCATE_FEE_FRAC = 0.33;

/* Seconds a relocated tower stays offline. Long enough to hurt mid-wave,
   short enough that repositioning between waves is nearly free. */
/* Seconds between spoken lines in the pre-battle exchange. Long enough to
   read a sentence, short enough that nobody sits through a cutscene. */
const BATTLE_LINE_BEAT = 1.9;

const RELOCATE_DOWNTIME = 4.5;

/* Seconds SABOTEUR's CASCADE keeps a rate debuff on a tower AFTER the
   blackout itself lifts. Deliberately longer than the shortest sabotage
   interval so a second strike extends the misery rather than resetting a
   window the victim had already served. */
const SABOTAGE_LINGER_SECONDS = 6;

/* Ceiling on the commander trait `jamResist`. ORIN's two nodes reach 0.80 on
   their own; the cap exists so no future stacking turns a duration cut into a
   silent immunity, which is UNSHAKEABLE's job and is bought separately. */
const JAM_RESIST_CAP = 0.9;

/* How finely a barricade's health is bucketed inside the inspector's cache
   signature. The panel must be allowed to follow a wall being ground down --
   it is the only figure on an inspector that moves with nothing clicked --
   but keying on raw health would rebuild the panel every frame and destroy
   the buttons under the player's cursor. Ten steps is one rebuild per 10% of
   wall lost. */
const INSPECTOR_WALL_STEPS = 10;

/* ── RUBBLE CLEARANCE ─────────────────────────────────────────────────────
   Terrain stops being permanent scenery: gold buys board. The price
   compounds hard and the count is capped, because cleared cheaply this
   would erase the identity of the three scarcity maps that are built around
   having nowhere to stand. Clearances are per-battle and are never written
   to the campaign save. */
const CLEAR_MAX = 5;
const CLEAR_BASE = sqGold(260);   /* authored 260; squished once, here */
const CLEAR_GROWTH = 1.85;
function clearCost(n) { return Math.round(CLEAR_BASE * Math.pow(CLEAR_GROWTH, n)); }
/* Floor under a DISCOUNTED clearance, so stacked SAPPER CORPS discounts can
   never make board free. Named because the rubble panel and the engine must
   read the same floor: the panel's "next costs" line used to quote the raw
   clearCost() and silently drop the 35% the player had just bought. */
const CLEAR_COST_FLOOR = 10;

/* -- TERRAIN NODES --------------------------------------------------------
   A handful of authored tiles per map carry an elemental charge. A BUILD node
   changes the tower standing on it; a LANE node primes whatever crosses it.
   Both are mirrored with the terrain, so the map joins the combo table without
   either side getting the better board.

   The named risk is one matched-element package dominating a map, so a node's
   element is frequently the one that map's denizens RESIST. Resistance damps
   reactions, which makes the node an ENABLER you still have to build a partner
   for rather than a free damage type handed out by the ground. */
const NODE_ATTUNE_DAMAGE = 1.18;   /* matched element: a flat damage lift, never a
   damage TYPE, so an attuned node can never hand out a denizen's weakness. */
const MARK_SECONDS = 4;            /* default life of an elemental mark */
const NODE_HOLD_MARK = 7;          /* a marking tower on a node of ANOTHER element
   holds its charge longer instead -- patience, not raw damage. */
const NODE_LANE_MARK = 2.5;        /* a lane node's mark is short on purpose: long
   enough to carry into a killzone, too short to stand as a free half-reaction. */
/** How many towers of its OWN origin a rival's arsenal should end up flying.
    Two of five, not one: one reads as coincidence beside four commons, and
    three costs the draft its variety -- the canned cores are mostly built
    from the human and robotic hardware that is legal to everyone, so a
    higher target means more of a set is decided by origin than by whether
    the five towers work together. It is a target, never a floor: a shelf
    holding fewer of its own simply flies fewer. */
const LOADOUT_OWN_ORIGIN = 2;
const AI_NODE_BIAS = 1.15;         /* the rival's appetite for any build node */
const AI_NODE_BIAS_MATCH = 1.40;   /* ...and for one its tower can actually use, so
   rivals contest the same tiles the player wants (ROADMAP rival parity). */

const ENRAGE_MAX = 3;
const ENRAGE_HP = 0.28;        /* +28% health per stack   */
const ENRAGE_BOUNTY = 0.45;    /* +45% kill gold per stack */

/* ── AIMED COMMANDER ABILITIES ────────────────────────────────────────────
   Four abilities stopped applying a number to the whole board and started
   delivering a CONSTRUCT at a tile you choose, so spending one costs a
   placement decision as well as a cooldown. Every construct is
   duration-limited, single-instance per cooldown, and destructible where it
   holds ground: a blocker that could be stacked, refreshed or parked forever
   would erase the consequence of a leak rather than charge for it. */

/* How far from the aimed tile a lane construct may snap onto its lane, in
   tiles. Without a bound, a wall aimed at empty backfield would slide across
   the map and land somewhere the commander never pointed at. */
const AIM_SNAP_TILES = 2.6;

/* BULWARK. Read as wave-1 numbers -- Barricade wave-scales its own health.
   The block cap is what keeps the wall a delay rather than a gate; sitting
   between RAMPART's 210 and CITADEL's 1900 keeps a free ability from
   outclassing the tower built to do this. */
const AIM_BLOCKER_HP = 820;
const AIM_BLOCKER_BLOCKS = 4;
const AIM_BLOCKER_THORNS = 22;

/* SMOKESCREEN. The mines are the payload; the blind is what survives of the
   old board-wide version, kept local so the ability still reads as smoke.
   Spread is in tiles and is measured ALONG the lane -- mines seeded off the
   lane would never be stepped on. */
const AIM_MINE_COUNT = 5;
const AIM_MINE_DAMAGE = 150;
const AIM_MINE_SPLASH = 1.35;
const AIM_MINE_STUN = 0.7;
const AIM_MINE_SPREAD = 1.6;
const AIM_SMOKE_FREEZE = 0.9;

/* BROADSIDE and RAVENOUS: emplacements. They hold ground rather than deny
   it, so ground attackers chew through them -- `BITE` is health lost per
   second per attacker in contact, which is what stops a battery parked on a
   lane from being free real estate for its whole duration. */
const AIM_BATTERY_HP = 540;
const AIM_BATTERY_BITE = 26;
const AIM_BATTERY_DAMAGE = 70;
const AIM_BATTERY_RATE = 2.4;
const AIM_BATTERY_RANGE = 3.2;
const AIM_BATTERY_SPLASH = 0.9;

const AIM_MAW_HP = 460;
const AIM_MAW_DAMAGE = 150;
const AIM_MAW_RATE = 1.3;
const AIM_MAW_RANGE = 2.5;
/* Gold per body the maw itself finishes. The old RAVENOUS paid 2 per kill
   across the whole board, so one emplacement pays more per kill and far less
   in total -- the aim is what buys the higher rate. */
const AIM_MAW_FEED = sqGold(4);   /* authored 4; squished once, here */

/* The rival needs a POINT, not just a moment. It aims at the densest knot of
   attackers on a lane it is actually defending; fewer than this many bodies
   inside the radius and it holds the ability rather than spending it on a
   straggler, which is what makes a rival commander read as deliberate
   instead of broken. */
const AIM_AI_CLUSTER_TILES = 2.2;
const AIM_AI_MIN_CLUSTER = 3;
/* How many tile-steps further along the attackers' own march the rival will
   probe for ground it holds -- its densest knot is usually still out on the
   approach, and walking forward converges on its own territory. */
const AIM_AI_PROBES = 12;
/* Seconds between rival ability considerations. Fast enough to answer a
   wave, slow enough that it does not fire on the first body of a trickle. */
const AIM_AI_THINK = 1.1;

/* ── MUSTER ───────────────────────────────────────────────────────────────
   Gold spent on aggression ALSO buys income, so attacking and banking stop
   being opposite ends of one dial. The bluff layer comes for free: a hoarded
   purse is either a wall being saved for or a send being saved for, and the
   opponent cannot tell which until it lands.

   The dossier flags this family as the most snowball-prone in the book, so
   two guards sit on it and both are load-bearing.

   ONE — the income is stored as a PERCENT of the wave's own reward, not as
   a flat number, so it keeps pace with the economy. By the owner's spec each
   purchase adds its tier's percent FLAT -- additive, no falloff -- which
   makes the hard cap (MUSTER_INCOME_CAP_PCT) the ONLY bound on it; it must
   never be removed. Uncapped, the first side to reach send-parity wins on
   compounding alone with no board play at all -- the same failure the
   interest cap already guards against, arriving through a second door.

   TWO — mustered units carry MUSTER_DAMP, the identical 0.6 damping every
   reanimate carries, and are flagged `reanimated` so a bought unit can never
   itself be reanimated into a third life. */
const MUSTER_DAMP = 0.6;              /* matches reanimate() exactly          */
/* A summoned unit is the third body in this family (reanimate, muster, summon)
   and it carries the same damping. It was a bare 0.6 open-coded inside
   summonFrom beside an open-coded copy of the wave multiplier, and the copy
   had drifted: the literal said 0.6 while the unit actually arrived at 0.32
   of a wave body. Named here so the next reader can see the three dampings
   sit at the same value on purpose. BATCH-A/numbers */
const SUMMON_DAMP = 0.6;              /* carrier/harbinger spawn, vs a wave body */

/* ── SPAWNED-UNIT HEALTH PENALTY (roadmap 19.16) ──────────────────────────
   A body that is SUMMONED onto the board -- a mustered detachment, a
   FOUNDRY minion, a carrier's brood -- inherits the wave curve, and the wave
   curve is flat and generous in its first few steps. That made a purchase at
   wave 2 worth very nearly a whole wave body while the defence that had to
   answer it was still two towers, which is the owner's report: summoned units
   are too strong early. So a penalty rides on top of the damping, and it
   DECAYS, because by wave 10 the same body is a rounding error against the
   curve and taking anything off it would delete the mechanic instead of
   pricing it.

   THE OWNER'S THREE ANCHOR POINTS ARE THE DEFINITION:
       wave 1  -> -50%      wave 5 -> -25%      wave 10 and after -> 0%
   SHAPE is DERIVED from them rather than typed, so the curve cannot drift
   away from the anchors it is documented by: it is the exponent that makes
   the midpoint land exactly on -25%. The curve is smooth, not stepped, and
   its slope is zero where it meets wave 10, so the last wave of the penalty
   is not a cliff a player can feel.

   It applies to a body that is CREATED. It deliberately does NOT apply to a
   reanimate or to a SIREN charm: those convert a corpse or a live attacker
   that the wave already paid for, they are not a second body, and halving
   them would rewrite the core attrition loop rather than price a summon. */
const SPAWN_HP_PENALTY_MAX = 0.50;       /* the penalty on wave 1              */
const SPAWN_HP_PENALTY_MID = 0.25;       /* ...and on SPAWN_HP_PENALTY_MID_WAVE */
const SPAWN_HP_PENALTY_MID_WAVE = 5;
const SPAWN_HP_PENALTY_END = 10;         /* nothing from here on               */
const SPAWN_HP_PENALTY_SHAPE =
  Math.log(SPAWN_HP_PENALTY_MID / SPAWN_HP_PENALTY_MAX) /
  Math.log((SPAWN_HP_PENALTY_END - SPAWN_HP_PENALTY_MID_WAVE) / (SPAWN_HP_PENALTY_END - 1));

/** THE health multiplier a summoned body carries for `wave`.
    ONE definition, read by Game.musterHpMul (and so by the muster bar, the
    dossier tooltip and AI.bestAction, which all price a send through it), by
    Game.summonFrom and by the FOUNDRY minion. Anything that PRINTS a summoned
    unit's health calls this or a function that calls it -- a preview that
    re-derives a multiplier is the desync class this project has already paid
    for seven times. */
function spawnHpPenaltyMul(wave) {
  const w = Math.max(1, Math.min(SPAWN_HP_PENALTY_END, wave || 1));
  const x = (SPAWN_HP_PENALTY_END - w) / (SPAWN_HP_PENALTY_END - 1);
  return 1 - SPAWN_HP_PENALTY_MAX * Math.pow(x, SPAWN_HP_PENALTY_SHAPE);
}
const MUSTER_INCOME_CAP_PCT = 1.80;   /* ceiling on the additive percent -- the
   sole HARD bound now that stacking is flat, and it must never be removed.
   OWNER-SET (roadmap 19.17): the per-purchase percent below roughly doubled,
   so a ceiling of 1.00 would have been reached by the THIRD buy and the
   control would have gone dead in the middle of the match it is supposed to
   be played across. 1.80 keeps the ceiling about six purchases away, which
   with MUSTER_PER_WAVE = 2 is three waves of total commitment.

   WHAT STILL STOPS A RUNAWAY, now that the number is larger -- five things,
   and the cap is only the last of them:
     1. MUSTER_PER_WAVE = 2. The ceiling cannot be bought in one build phase;
        it takes three waves of spending nothing on defence to reach.
     2. MUSTER_COST_GROWTH for MUSTER_COST_STEPS buys. The sixth purchase
        costs 1.76x the first and the plateau sits at 3.11x, so the gold that
        reaches the ceiling is ~3.4 wave rewards that did not become towers.
     3. The income is FLAT and is a share of a reward EVERYONE already earns.
        It never compounds -- unlike interest, it does not pay on itself --
        so it is a bounded additive stream, not an exponential one.
     4. Roadmap 19.16 lands in the same patch: the aggression half of the
        purchase is at its WEAKEST (-50% health) over exactly the early waves
        in which a snowball would have to start.
     5. This ceiling. At the cap a committed sender earns 2.8x the wave
        reward and not one gold more, however many further sends it buys. */
const MUSTER_COST_GROWTH = 1.12;      /* and each buy costs 12% more          */
/* ...but only for the first COST_GROWTH_STEPS buys. Unbounded, 1.12^buys with
   MUSTER_PER_WAVE=2 compounds at 1.25x per WAVE against an economy that grows
   1.14x per wave, so the control prices itself out of its own game: by wave 9
   the cheapest muster costs 4x a wave reward and by wave 13 it costs 10x. The
   mechanic would be dead by mid-match for the only players who used it, which
   inverts the design. The plateau is safe because it is not what bounds the
   snowball -- MUSTER_INCOME_CAP_PCT does. Past the plateau a muster is a
   flat-priced gold-for-pressure trade whose income is bounded by the cap,
   which is exactly what it should decay to. */
const MUSTER_COST_STEPS = 10;
/* REANIMATION STACKING (owner-set). A muster IS a bought reanimate, so the
   reanimation tech must pay on it or the two halves of one identity scale
   apart. Health already stacks (musterHpMul multiplies by mods.reanim); these
   close the rest: per-reanimate gold pays per unit SENT, and the double-
   reanimate chance rolls per unit exactly as it does on a kill. */
const MUSTER_REANIM_GOLD_MUL = 1.0;
/* The AI may not buy aggression before its own house is in order. Wave 4 was
   the measured failure: both brains bought four musters on three towers and
   died to each other's sends. Defence first is not a style choice here, it is
   what keeps the early curve where the design pinned it (fresh median ~7). */
const MUSTER_AI_MIN_WAVE = 4;
const MUSTER_AI_MIN_TOWERS = 5;
const MUSTER_AI_SAFE_LIVES = 0.8;         /* ceiling 1.12^10 = 3.11x base cost    */
/* Purchases per wave cycle. Without it a single prep window can be spent
   straight into the income ceiling, which is the snowball with extra steps. */
const MUSTER_PER_WAVE = 2;

/* ── MUSTER DETACHMENT ────────────────────────────────────────────────────
   The fixed three-row table is gone. A commander carries up to
   MUSTER_LOADOUT_SIZE SAVED denizens into battle (Meta.musterLoadout), and
   each one becomes a tier DERIVED from its own enemy definition by
   musterTierFor -- so the sidebar, the spawn and the rival brain all read
   one table built by one function, and conquering worlds genuinely widens
   the send arsenal instead of re-skinning it.

   `cost` and `incomePct` stay fractions of the NEXT wave's reward, so a
   muster is worth the same share of a turn at wave 3 and at wave 30. The
   derivation is pinned so the OLD hand-tuned SKIRMISH row falls out of it
   (4 crawlers at 0.55x reward for +5%), which is what keeps the measured
   balance pins (fresh median 7, maxed 26-27) without a re-tune. */
const MUSTER_LOADOUT_SIZE = 3;          /* picks a detachment may carry        */
const MUSTER_BASE_UNLOCK = ['crawler']; /* everyone can send these on day one  */
/* Nothing that bites more than this many lives on a leak may be bought: a
   juggernaut pack at wave scaling on wave 4 is a base kill, not a tempo play.
   Bosses and minibosses are refused outright. */
const MUSTER_MAX_LIVES = 3;
/* Pack size: count = clamp(round(K / sqrt(hp)), MIN, MAX). Square-root so a
   swarm of frail mobs and a pair of heavies put a COMPARABLE mass (hp x count)
   in the lane -- 4 crawlers (248) against 2 bulwarks (660), not 4 against 4.
   The ceiling exists because spawn spacing and the per-wave allowance were
   measured against single-digit sends. */
const MUSTER_COUNT_K = 32;
const MUSTER_COUNT_MIN = 1;
const MUSTER_COUNT_MAX = 6;
/* Cost and income are LINEAR in mass: bigger mobs cost more AND pay more, in
   proportion, so no pick is a strictly dominant buy. Anchored at the crawler. */
const MUSTER_COST_BASE = 0.40;          /* share of next wave reward at 0 mass */
const MUSTER_COST_PER_MASS = 0.00065;   /* crawler pack (248) -> 0.56x         */
/* OWNER-SET (roadmap 19.17): "the econ generated from summoning your own
   troops is way too small ... make it much more rewarding". The Session-16
   pass raised the percent but left the PAYBACK bad, and payback is what the
   player actually feels. At +14.9% a crawler pack cost 0.56 of a wave reward
   and returned 0.149 per wave: 3.8 waves to break even on the FIRST buy and
   11.7 on the plateau, against matches that resolve around wave 16-28. Every
   muster after the fourth was a pure tempo purchase whose income half was
   decoration, which is exactly what "too small" describes.

   Roughly doubled again, and now anchored on payback rather than on the
   percent: a crawler pack pays +32.4% of a wave reward and breaks even in
   1.7 waves at the first buy and 5.4 at the plateau, so a send is worth
   buying for its economy at ANY point in a match rather than only in the
   opening. Both halves stay LINEAR in mass, so no pick is a dominant buy --
   a bulwark pair (mass 660) pays +53% for a proportionally larger price.

   RIVAL PARITY: the rival prices a send through Game.musterGain, the same
   post-ceiling delta the player's button prints, so the whole of this raise
   reaches the AI under the same rules and the same MUSTER_PER_WAVE limit. */
const MUSTER_INCOME_BASE = 0.20;        /* percent points at 0 mass             */
const MUSTER_INCOME_PER_MASS = 0.00050; /* crawler pack (248) -> +32.4%         */
/* Display bands by mass keep the three familiar names; nothing reads them
   but the sidebar and the floater. */
const MUSTER_BAND_ASSAULT_MASS = 400;
const MUSTER_BAND_SIEGE_MASS = 650;
const MUSTER_BANDS = [
  { name:'SKIRMISH', icon:'›' },
  { name:'ASSAULT',  icon:'››' },
  { name:'SIEGE',    icon:'›››' }
];

/** Every faction unit id, or an empty list before factions.js has run. Every
    per-unit store in a profile enumerates from this one accessor, so a unit
    added to a power's roster gains its talent tree and its mastery track by
    existing rather than by being listed a second time. */
function unitTrackIds() {
  return (typeof UNIT_ORDER === 'undefined') ? [] : UNIT_ORDER;
}

/** True when an enemy id is sane to sell as a send. */
function musterSendable(id) {
  const def = ENEMY_TYPES[id];
  if (!def || def.boss || def.miniboss) return false;
  if (String(id).indexOf('mb_') === 0) return false;
  return (def.lives || 1) <= MUSTER_MAX_LIVES;
}

/* ── FACTION UNITS: THE DOCTRINE TUNABLES (roadmap 19.10-19.14) ───────────
   A faction unit is an ENEMY record read as a UNIT. Everything a doctrine or a
   unit talent needs is named here, beside the muster maths it modifies, so no
   figure the loadout card prints is derived anywhere but where the engine
   charges it.

   None of these moves either balance pin. MEASURED: both pins run
   MUSTER_BASE_UNLOCK (crawler) alone -- balance-pins.js writes tower shelves
   and never touches vault().musterUnlocked -- and neither pin map garrisons
   faction troops (battleHostFaction returns null without a seat, a contest,
   a fortress or a nest). unitFieldMods returns the frozen identity for any id
   outside UNIT_TYPES, so a crawler's tier is byte-identical to before. */

/** Souls for a unit bought outright. Priced under a tower (TOWER_UNLOCK_COST
    6 plus the surcharge) because a unit is one third of a detachment while a
    tower is one fifth of a board AND carries a talent tree of its own -- and
    because the rescue path is free, so the shop must read as the impatient
    option rather than the only one. Rides soulSurcharge like every other
    purchase, so it cannot escape the inflation ladder. */
const UNIT_UNLOCK_COST = 8;

/* SALVAGE (Humanity). Armour taken off any wreck within reach, whoever it
   belonged to. The CAP is the load-bearing one: without it a human send that
   walked through a full wave arrived effectively immune to physical damage,
   which is not "stubborn", it is unanswerable. Nine is a Linebreaker's own
   plate again -- doubled and no further. */
const UNIT_SALVAGE_RADIUS = 2.2;    /* tiles from the wreck                    */
const UNIT_SALVAGE_ARMOR = 1.1;     /* armour per wreck                        */
const UNIT_SALVAGE_CAP = 9;         /* total, however much wreckage there is   */

/* THE VOW (Federation). A ward outlives its body. SHARE is under half so a
   column cannot carry one ward end to end undiminished, and OVERCAP bounds
   how far past its own maximum a single survivor can be stacked -- three
   deaths onto one Sanctifier was a 600-point ward and an unkillable anchor. */
const UNIT_VOW_RADIUS = 3.0;        /* tiles the vow reaches                   */
const UNIT_VOW_SHARE = 0.45;        /* of the dead unit's FULL ward            */
const UNIT_VOW_OVERCAP = 1.6;       /* ceiling, as a multiple of its own ward  */

/* THE MASS (Xeno). The swarm eats its own dead. SHARE is of the eaten body's
   MAX health, added to current and maximum alike, so a Xeno send genuinely
   gets harder the slower you clear it. The radius growth is cosmetic weight
   with a cap, because an unbounded radius is a hitbox the renderer and the
   splash maths disagree about. */
const UNIT_MASS_RADIUS = 2.6;       /* tiles the swarm reaches to feed         */
const UNIT_MASS_SHARE = 0.35;       /* of the dead body's maximum health       */
const UNIT_MASS_GROWTH = 0.12;      /* radius gained per meal                  */
const UNIT_MASS_RADIUS_CAP = 1.5;   /* as a multiple of its authored radius    */

/* SCUTTLE (Pirates). Killing one costs you the guns that killed it. The
   COOLDOWN is per defending side and is what stops a six-body Cutter pack
   chain-locking a board for five seconds -- the jam is meant to change WHERE
   you kill pirates, never whether you can. */
const UNIT_SCUTTLE_RADIUS = 1.8;    /* tiles of towers taken offline           */
const UNIT_SCUTTLE_JAM = 0.85;      /* seconds                                 */
const UNIT_SCUTTLE_COOLDOWN = 3.2;  /* seconds, per defending side             */

/* A death fires one scan of the board. The cap is a guard against a
   pathological arena seat count, not a balance figure: above it the doctrines
   simply do not fire rather than the frame budget going with them. */
const UNIT_DOCTRINE_SCAN_CAP = 320;

/* Mastery a unit earns per body that finishes its march -- killed or landed.
   Pitched so a detachment reaches the row-1 gate over a handful of matches,
   the same pace a tower's mastery does off damage and kills. It is the WRITER
   for p.towerXp[unitId]; without one every unit talent past the first row
   would be an inert key, which is the failure this codebase is named for. */
const UNIT_XP_PER_BODY = 26;

/**
 * The folded doctrine a unit is fielded under: its saved talent build merged
 * over the identity. Keyed by UNIT id and by nothing else, which is what makes
 * rival parity STRUCTURAL here rather than mirrored -- both commanders derive
 * their detachment through musterTiersFor, both land in this function, and a
 * unit is fielded the same way whoever sends it. The vault it came out of is
 * install-wide for exactly the same reason.
 *
 * Returns the FROZEN identity for anything outside UNIT_TYPES -- a crawler, a
 * machine, a stale save's id -- so nothing that is not a faction unit can pick
 * up a doctrine by accident.
 */
const _unitFieldCache = new Map();
function unitFieldMods(id) {
  if (typeof UNIT_TYPES === 'undefined' || !UNIT_TYPES[id] ||
      typeof Meta === 'undefined') return UNIT_FIELD_IDENTITY;
  const picks = Meta.talentMods(id) || [];
  /* Cached on the BUILD, not the id: the loadout screen re-renders every card
     on every click and a battle asks once per spawned body. The key is the
     node ids in order, so taking a talent invalidates it by construction. */
  const key = id + '|' + picks.map(t => t.id).join(',');
  const hit = _unitFieldCache.get(key);
  if (hit) return hit;
  const out = Object.assign({}, UNIT_FIELD_IDENTITY);
  for (const t of picks) {
    const m = t && t.mods;
    if (!m) continue;
    for (const k in m) {
      if (!(k in UNIT_FIELD_IDENTITY)) continue;   /* no reader, no effect */
      if (UNIT_FIELD_IDENTITY[k] === 1) out[k] *= m[k];
      else out[k] += m[k];
    }
  }
  _unitFieldCache.set(key, out);
  return out;
}
/** Dropped when a talent is spent, so the next read rebuilds. */
function clearUnitFieldCache() { _unitFieldCache.clear(); }

/** One derived tier. `id` doubles as the tier id the sidebar and the brain
    hand back to Game.muster. */
function musterTierFor(id) {
  const def = ENEMY_TYPES[id];
  if (!def) return null;
  /* The detachment's doctrine is folded HERE and nowhere else. The loadout
     card, the muster bar, the rival's valuation and the send all call this one
     function, and a preview quoting a different pack size from the one the
     engine marches is the desync class this project has shipped seven times.
     `hpMul` enters the MASS term because cost and income are linear in mass by
     design -- a talent that makes each body heavier must pay for it. */
  const m = unitFieldMods(id);
  const raw = Math.round(MUSTER_COUNT_K / Math.sqrt(Math.max(1, def.hp)) * m.countMul);
  const count = Math.max(MUSTER_COUNT_MIN, Math.min(MUSTER_COUNT_MAX, raw));
  const mass = def.hp * m.hpMul * count;   /* total health one purchase puts in a lane */
  const band = MUSTER_BANDS[mass >= MUSTER_BAND_SIEGE_MASS ? 2 : mass >= MUSTER_BAND_ASSAULT_MASS ? 1 : 0];
  return {
    id, type: id, name: band.name, icon: band.icon, count, mass,
    cost: (MUSTER_COST_BASE + mass * MUSTER_COST_PER_MASS) * m.costMul,
    incomePct: (MUSTER_INCOME_BASE + mass * MUSTER_INCOME_PER_MASS) * m.incomeMul
  };
}

/** The tier list a detachment derives, lightest first so the rows keep
    reading skirmish -> assault -> siege. Unsendable ids are dropped; an
    empty or fully-invalid detachment falls back to the base unlock so a
    battle always has at least one tier. */
function musterTiersFor(loadout) {
  let ids = [...new Set((loadout || []).filter(musterSendable))].slice(0, MUSTER_LOADOUT_SIZE);
  if (!ids.length) ids = MUSTER_BASE_UNLOCK.slice();
  return ids.map(musterTierFor).filter(Boolean).sort((a, b) => a.mass - b.mass);
}

function musterCost(tier, wave, buys) {
  return Math.round(waveReward(wave + 1) * tier.cost *
                    Math.pow(MUSTER_COST_GROWTH, Math.min(buys || 0, MUSTER_COST_STEPS)));
}
/** The income PERCENT one more purchase of `tier` adds. FLAT by the owner's
    spec -- no falloff. MUSTER_INCOME_CAP_PCT alone bounds the total, applied
    inside musterPayout so the preview and the payout can never disagree. */
function musterIncomeStep(tier) {
  return tier.incomePct;
}
/** Gold a side's accumulated muster percent pays on `wave`, ceiling applied. */
function musterPayout(pct, wave) {
  return Math.round(waveReward(wave) * Math.min(pct || 0, MUSTER_INCOME_CAP_PCT));
}

/* The rival scores a muster against builds and upgrades on score-per-gold, so
   both payoffs have to be expressed in the same value units those already use.
   Under the percent model the income half is (waveReward x incomePct) gold
   collected once per wave, so it is valued as that gold figure times the
   waves it will realistically still be collected over (HORIZON_WAVES) times
   the score value of one gold (INCOME_WEIGHT). 8 x 0.275 = 2.2 -- exactly
   the band the old flat weight occupied, because that weight was calibrated
   against the Vault (9 gold per 5s at 324 gold scores 0.25) and moving it
   would re-litigate the defence-first fix that restored the fresh median. */
/* MEASURED, Session 15: at a horizon of 8 the brain bought four musters in
   waves 4-6 and finished the run one tower light, costing ~3 waves of depth on
   the maxed pin (27 -> 23) while killing the rival no faster. Income is real
   but it compounds more slowly than a tower does at this stage, so the horizon
   is the honest lever: 5 waves is what a send actually pays out over before
   the board's own scaling outruns it. Re-measure both pins if you touch this. */
/* The base level was the player's single largest compounding sink with no AI
   counterpart at all: every level is +2 max lives, +5% reanimate strength, and
   a RETROFIT of every standing tower to the new floor. Priced per gold like
   every other action so it competes rather than pre-empting. LIVES_WEIGHT
   converts a life into the same value units a point of effectiveness carries. */
const AI_BASELEVEL_WEIGHT = 1.0;
const AI_BASELEVEL_LIVES_WEIGHT = 55;
const AI_BASELEVEL_LOOKAHEAD = 4;   /* reach the level-4 specialisation rung */

const MUSTER_AI_HORIZON_WAVES = 5;     /* waves the income is expected to pay */
const MUSTER_AI_INCOME_WEIGHT = 0.275; /* per gold of horizon income          */
const MUSTER_AI_PRESSURE = 0.028;      /* per point of health put in a lane   */

/* ── RIVAL PARITY: BOARD, RESONANCE AND SECOND THOUGHTS ───────────────────
   Three more player levers the rival could not pull at all. Each is priced
   per gold and enumerated in AI.bestAction beside build / upgrade / muster /
   baselevel, so they COMPETE rather than pre-empt -- and each carries a gate
   that sits ABOVE the fresh death band (median wave 7-8, every run under
   10), because a new early-game spend is exactly what moved the maxed pin
   27 -> 23 when muster shipped ungated. Re-measure both pins if you lower a
   MIN_WAVE. */

/* RUBBLE. A cleared tile is not damage; it is the OPTION to stand a tower on
   better ground than anything free. The tower costs the SAME either way, so
   the honest marginal worth of the tile is the fractional coverage uplift it
   buys on the build that will use it -- discounted only for the timing risk
   that the board moves on before that build happens.
   MEASURED, and the reason the comparison is on RAW coverage: covMul()
   saturates at 1.9 for anything above ~30 coverage, so on every rubble map
   the best free tile and the best rubble tile both clamp to 1.9 and the
   uplift reads as exactly zero (shattered 93.4 vs 97.5, narrows 92.2 vs
   73.4, coil 104.4 vs 102.9 -- all ratio 1.000 through covMul). Comparing
   the raw figures is what lets the rival notice that its good ground is
   gone. MIN_UPLIFT stops it buying board for a rounding difference; the
   uplift test IS the gate, so there is deliberately no scarcity gate. */
const AI_CLEAR_MIN_WAVE = 8;
const AI_CLEAR_MIN_UPLIFT = 0.15; /* the tile must be 15% more lane, at least */
const AI_CLEAR_OPTION_VALUE = 0.85;/* timing risk only -- the tower is not free
   either way, so the tower's price is NOT the discount */
const AI_CLEAR_MAX_UPLIFT = 2.0;   /* caps the no-ground-left case, which would
   otherwise divide by nothing and read as infinite appetite */

/* RELOCATION. The player may re-site any tower for a third of its investment;
   the rival was stuck with every bad opening placement forever. MIN_GAIN is
   what stops it shuffling: a move must be a real improvement, not a wobble.
   MAX_MOVES is the oscillation stop -- without it two towers can trade the
   same good tile back and forth for the rest of the match. */
const AI_RELOCATE_MIN_WAVE = 10;
const AI_RELOCATE_MIN_GAIN = 1.35; /* RAW coverage ratio a move has to beat --
   raw for the same reason the clearance is: covMul saturates and would report
   every prospective move as an exact wash */
const AI_RELOCATE_MAX_MOVES = 1;   /* per tower, per battle */
const AI_RELOCATE_DOWNTIME = 0.72; /* discount for RELOCATE_DOWNTIME offline */

/* RESONANT FIELD. A bid on your OWN board: the wave that pays more also
   arrives ENRAGE_HP tougher, and (since this patch) it is the buyer's wave
   alone. The rival only takes the bet when its throughput already clears the
   scripted wave with room to spare, measured as health it can remove over
   one nominal wave window against the health the wave brings. Without the
   headroom gate it buys a payout it then leaks straight through. */
const AI_ENRAGE_MIN_WAVE = 12;
const AI_ENRAGE_SAFE_LIVES = 0.9;  /* fraction of max lives required */
const AI_ENRAGE_WINDOW = 26;       /* seconds of firing a wave is worth */
const AI_ENRAGE_HEADROOM = 1.9;    /* throughput-over-threat the bet requires */
/* One-shot gold and recurring gold are still gold: a resonance bid is priced
   per gold collected on exactly the weight the muster income half carries
   (MUSTER_AI_INCOME_WEIGHT, restored through GOLD_SQUISH the same way), so
   the two economy levers compete honestly. */
const AI_ENRAGE_INCOME_WEIGHT = MUSTER_AI_INCOME_WEIGHT * GOLD_SQUISH;

/* LAND CARDS in the draft. They buy BOARD, not a percentage, so their worth
   is entirely a function of how starved this commander is for somewhere to
   stand. Without a case of their own both fell to chooseMod's `default: 50`
   and could beat HEAVY ORDNANCE (40) or STATUS CATALYST (40) on a map where
   the rival had fifty free tiles and nothing to clear. */
const AI_MOD_LAND_FLOOR = 12;      /* worth with room to spare */
const AI_MOD_LAND_STARVED = 165;   /* ...and with nowhere left to build */
/* A FRACTION of this side's own board, not an absolute tile count. Boards
   run from 60 to 260 buildable tiles per side, so an absolute 10 meant every
   real position scored the AI_MOD_LAND_FLOOR and the whole interpolation
   below it was dead code -- the rival never drafted a land card in a
   reachable game. Above ~0.6 land cards start beating HEAVY ORDNANCE on a
   wide-open board, which is the bug the case was written to kill. */
const AI_MOD_LAND_ROOMY = 0.35;    /* free SHARE of the board at which "room to spare" begins */
const AI_MOD_LAND_SURVEY_BIAS = 0.8; /* SURVEY hauls one tile, SAPPER two */

const STAT_DRIFT = [
  { id: 'hp',    icon: '♥', name: 'VIGOUR',  amount: 0.10, label: 'health' },
  { id: 'speed', icon: '»', name: 'HASTE',   amount: 0.055, label: 'speed' },
  { id: 'armor', icon: '▨', name: 'PLATING', amount: 1.4,  label: 'armour' }
];

/* --------------------------------------------------------------------------
   COMMAND UPGRADES
-------------------------------------------------------------------------- */
/* Most command upgrades hand you a percentage. The two `land:true` cards hand
   you BOARD instead -- free demolitions, and a discount on every later one --
   so a draft can be a choice between power and room rather than between two
   numbers. They are filtered out on maps with no rubble to clear, or they
   would be dead draws (see Game.drawMods). */
const PLAYER_MODS = [
  /* THE SIDE MATTERS. `apply(m, s)` has always received the drafting Side,
     and these two were the only cards that ignored it: they called the bare
     global grantClearances, which read FIELD.bases[0] and ownsTile(0, ...).
     A rival drafting SAPPER CORPS therefore blew open two tiles beside the
     PLAYER's base, spent the PLAYER's clearance allowance doing it, and
     handed over board space it meant to take for itself. Every land effect
     is addressed to s.index now. */
  { id:'sappers',  land:true, name:'SAPPER CORPS',  icon:'⛏',
    /* The two free tiles are spent out of the same per-battle allowance a paid
       demolition draws on, so the copy has to name the allowance or the card
       reads as free board rather than as two fifths of your clearances used
       for you. The number comes from CLEAR_MAX; it is never typed twice. */
    desc:'Demolish the two nearest rubble tiles free — they spend two of your ' + CLEAR_MAX +
         ' base clearances, and every later one costs 35% less.',
    apply:(m, s) => { m.clearDiscount = (m.clearDiscount || 0) + 0.35;
                      if (typeof Game !== 'undefined') Game.grantClearances(s ? s.index : 0, 2); } },
  { id:'surveyors', land:true, name:'SURVEY TEAM',  icon:'⌗',
    desc:'Raises your clearance limit by three, and hauls one tile away immediately.',
    apply:(m, s) => { m.clearBonus = (m.clearBonus || 0) + 3;
                      if (typeof Game !== 'undefined') Game.grantClearances(s ? s.index : 0, 1); } },
  { id:'overcharge', name:'OVERCHARGE',        icon:'⚡', desc:'+20% damage from every tower you own.',                 apply:m => m.damage += 0.20 },
  { id:'cycling',    name:'RAPID CYCLING',     icon:'↻', desc:'+16% fire rate across your board.',                    apply:m => m.rate   += 0.16 },
  { id:'optics',     name:'EXTENDED OPTICS',   icon:'◎', desc:'+14% range on every tower.',                           apply:m => m.range  += 0.14 },
  { id:'ap',         name:'ARMOUR PIERCING',   icon:'⌖', desc:'All physical damage ignores an extra 22% of armour.',  apply:m => m.pierce += 0.22 },
  { id:'crit',       name:'CRITICAL DOCTRINE', icon:'✷', desc:'+10% chance for any hit to crit for x2.5.',            apply:m => m.crit   += 0.10 },
  { id:'ordnance',   name:'HEAVY ORDNANCE',    icon:'◉', desc:'+30% splash radius on everything that explodes.',      apply:m => m.splash += 0.30 },
  { id:'catalyst',   name:'STATUS CATALYST',   icon:'☢', desc:'+35% potency on slows, burns, venom and pulls.',       apply:m => m.status += 0.35 },
  { id:'salvage',    name:'BATTLEFIELD SALVAGE', icon:'◈', desc:'+25% gold from every kill.',                         apply:m => m.gold   += 0.25 },
  { id:'logistics',  name:'LOGISTICS CORPS',   icon:'▤', desc:'Towers cost 15% less and upgrades 20% less.',          apply:m => { m.cost -= 0.15; m.upCost -= 0.20; } },
  { id:'necrotic',   name:'NECROTIC SURGE',    icon:'☠', desc:'Units you reanimate arrive with +45% health.',         apply:m => m.reanim += 0.45 },
  { id:'conscript',  name:'MASS CONSCRIPTION', icon:'⚑', desc:'25% chance to reanimate a SECOND copy of a kill.',     apply:m => m.doubleReanim += 0.25 },
  { id:'bulwarks',   name:'FORTIFIED CORE',    icon:'♥', desc:'+6 maximum lives, and restores 4 immediately.',        apply:(m,s) => { s.maxLives += 6; s.lives = Math.min(s.maxLives, s.lives + 4); } }
];

/* `severity` 2 marks the escalations that genuinely reshape a defence rather
   than shading it. Taking one of those in the escalation bid is what buys the
   wider command draft, so the bid has a real price and a real prize. */
const ENEMY_MODS = [
  { severity:2, id:'carapace',  name:'CARAPACE',         icon:'▨', desc:'+14 armour on every enemy.',                    apply:e => e.armor += 14 },
  { severity:2, id:'adrenal',   name:'ADRENAL GLANDS',   icon:'»', desc:'All enemies move 35% faster.',                  apply:e => e.baseSpeed *= 1.35 },
  { severity:2, id:'vitality',  name:'GROSS VITALITY',   icon:'♥', desc:'+140% maximum health.',                         apply:e => { e.maxHp *= 2.40; e.hp = e.maxHp; }, hpMul: 2.40 },
  { severity:1, id:'warding',   name:'ARCANE WARDING',   icon:'✧', desc:'Enemies take 45% less magic damage.',           apply:e => e.magicResist = Math.min(0.85, (e.magicResist||0) + 0.45) },
  { severity:2, id:'plating',   name:'REACTIVE PLATING', icon:'◈', desc:'Every enemy gains a shield worth 50% of health.', apply:e => { e.maxShield += e.maxHp * 0.50; e.shield = e.maxShield; e.shieldRegenOverride = e.maxHp * 0.08; } },
  { severity:1, id:'regen',     name:'REGENERATION',     icon:'✚', desc:'Enemies regenerate 5% of health per second.',   apply:e => e.regen = (e.regen||0) + 0.05 },
  { severity:1, id:'resilient', name:'RESILIENT',        icon:'⊘', desc:'Enemies resist 70% of all slowing.',            apply:e => e.slowResist = Math.min(0.95, e.slowResist + 0.70) },
  { severity:1, id:'sturdy',    name:'STURDY FOOTING',   icon:'⚓', desc:'Enemies resist 85% of all displacement.',       apply:e => e.pullResist = Math.min(0.97, (e.pullResist||0) + 0.85) },
  { severity:1, id:'veiled',    name:'VEILED',           icon:'◑', desc:'Enemies take 55% less damage over time.',       apply:e => e.dotResist = Math.min(0.9, (e.dotResist||0) + 0.55) },
  { severity:2, id:'brutal',    name:'BRUTAL',           icon:'☠', desc:'Every leak costs two extra lives.',             apply:e => e.livesCost += 2 },
  { severity:2, id:'legion',    name:'LEGION',           icon:'⁂', desc:'Waves contain 55% more enemies.',               countMul: 1.55 },
  { severity:1, id:'unstable',  name:'UNSTABLE',         icon:'✺', desc:'Slain enemies heal nearby allies for 30% of health.', apply:e => e.deathHeal = 0.30 }
];

const TARGET_MODES = [
  { id:'first',  name:'FIRST',  desc:'Closest to your base — the default, and usually correct.' },
  { id:'last',   name:'LAST',   desc:'Furthest from your base. Good for holding a chokepoint.' },
  { id:'strong', name:'STRONG', desc:'Highest current health. Point Railguns at an Ironmarch.' },
  { id:'weak',   name:'WEAK',   desc:'Lowest health. Maximises kills and reanimation output.' },
  { id:'close',  name:'CLOSE',  desc:'Nearest to this tower. Minimises projectile travel.' }
];

/* ═════════════════ THE GALAXY: WORLD SPACE AND THE WINDOW ═════════════════
   TWO rectangles, and the whole of the Session 19 map complaint is that they
   used to be the SAME one. GX_VIEW is the WINDOW -- how much galaxy a screen
   shows at zoom 1. GX_WORLD is the galaxy. Session 16 gave the map a drag
   viewport but went on drawing the entire galaxy at exactly window size, so
   there was nothing to pan over and the drag read as leftovers from the
   version before it.

   GX_VIEW keeps the old frame's SIZE deliberately. It is what fixes the
   pixels-per-world-unit the map is drawn at, so a world mark, a system name
   and a star pip all keep the on-screen size they were tuned at while the
   galaxy around them grows. BOTH dimensions are load-bearing: the scale covers
   the window rather than fitting it, so the world span on screen is never
   wider than .w nor taller than .h whatever shape the box is, and that is the
   promise the margin below is measured against. Its ORIGIN is now inert --
   where the window sits is the camera's business, not a constant's. */
const GX_VIEW = { x: -6, y: -11, w: 137, h: 99 };

/* WORLD SPACE, in RENDERED units (y already squashed -- see
   GX_RENDER_SQUASH). Four and a half windows wide and five tall, so crossing
   the galaxy is navigation rather than a glance.

   The MARGIN between the content and this box is load-bearing, not padding.
   The camera cannot be panned past a world edge, so a world sitting closer to
   an edge than HALF A WINDOW could never be centred -- which is exactly what
   note 19.3 asks for. Keep (GX_WORLD.w - world span) / 2 >= GX_VIEW.w / 2 and
   (GX_WORLD.h - world span) / 2 >= GX_VIEW.h / 2, or opening on an edge world
   lands off-centre and no amount of tweening hides it.
   MEASURED: 84.3 of margin across against the 68.5 needed, and 68.8 down
   against 49.5. */
const GX_WORLD = { x: 0, y: 0, w: 620, h: 400 };
const GX_WORLD_VIEWBOX = GX_WORLD.x + ' ' + GX_WORLD.y + ' ' + GX_WORLD.w + ' ' + GX_WORLD.h;

/* Hand-placed system centres, in RENDERED world units -- a spiral collapsed
   them into a centre knot whatever the radii were tuned to, and that has been
   tried twice. MEASURED on these:
     * closest two SYSTEMS       174.2 apart, against a footprint of ~37
     * closest two WORLDS         11.11 apart, against a combined dot-plus-ring
                                  width of ~4.7 (it was 8.33)
     * nearest world to an edge   84.3 across, 60.9 down -- both comfortably
                                  over the half-window (68.5 / 37.8) that
                                  centring on an edge world needs
     * worlds clamped             0
   Move one and re-measure all four. */
const GX_SYSTEM_SLOTS = [[104, 300], [214, 98], [346, 268], [468, 100], [516, 306]];

/* A system's furniture, pitched against GX_RING_OUTER in js/galaxy.js so the
   three move together. The labels sit OUTSIDE the orbits now: inside them (the
   old -17.4 against a 19.5 outer ring) printed a system's name across its own
   worlds, which is half of what made the grouping unreadable.
   MEASURED: the furthest a world's drawn box reaches from its system centre is
   32.1 up (a contested world, whose ⚔ sits above it) and 30.4 down (the star
   pips). These clear both by about 2.5 units. */
const GX_SYS_HALO_R = 22;
const GX_SYS_NAME_DY = -35;
const GX_SYS_META_DY = 35;
/* How far the link between two systems bows off the straight line. Scaled with
   the map -- the old flat 6 units was invisible across a 230-unit gap, so the
   chain read as a straight line through the middle of everything. */
const GX_LINK_LIFT = 26;

/* THE TRAVEL-RANGE RING drawn around the world you are standing on. Its radius
   is DERIVED from the worlds you can actually open, so it describes the
   existing unlock rule instead of inventing a second one that could disagree
   with it. PAD is the air between the furthest reachable world and the ring.
   MIN is an absolute floor: on a fresh campaign the only world you can open is
   the one you are standing on, and a ring drawn at that radius is a dot. The
   floor actually used is the larger of this and GX_RING_OUTER + PAD, so the
   ring always clears the system it is standing in. */
const GX_RANGE_PAD = 9;
const GX_RANGE_MIN = 34;

/* Stars behind the map, held at the DENSITY the old map put ON SCREEN rather
   than at its COUNT: a five-times-bigger world at the same count reads as
   emptier space rather than as more of it, which is the exact failure this
   round is about.

   The divisor is what one WINDOW actually shows -- 137 across by about 76 down
   at the aspect the map is played at -- not GX_VIEW's nominal 137x99. Dividing
   by the nominal box is the mistake that looks right and measures wrong: it
   lands ~137 stars on screen where the old map put 180, and the missing
   quarter is exactly the emptiness the note complains about. MEASURED after:
   179 stars in view at zoom 1, against 180 before.

   They are pooled into four <path>s and built once -- four thousand <circle>
   elements re-parsed out of an innerHTML string is a real cost on a map that
   re-renders on every click. */
const GX_BACKDROP_STAR_DENSITY = 180 / (137 * 76);
const GX_BACKDROP_STARS = Math.round(GX_WORLD.w * GX_WORLD.h * GX_BACKDROP_STAR_DENSITY);

/* The Canvas parallax layer behind the plane. It lives in SCREEN space, so its
   density does not change when the world grows -- but the pan range it has to
   cover does, so it gets a modest raise to keep the depth reading when the map
   is thrown across the galaxy. */
const GX_STARFIELD_STARS = 360;

/* ZOOM. MIN is an overview, not a fit-to-world: fitting 620 units into a
   1000px window is a scale of 0.24, at which a 2.6-unit system name is two
   pixels tall. Below GX_ZOOM_FAR the map switches to its overview reading --
   pips, arena marks and system meta drop out -- and label sizes are
   compensated back up, capped at GX_LABEL_MAX so the compensation cannot
   itself become the thing that overlaps. */
const GX_ZOOM_MIN = 0.36, GX_ZOOM_MAX = 2.6, GX_ZOOM_HOME = 1;
const GX_ZOOM_FAR = 0.72, GX_LABEL_MAX = 2.2;
/* How long the camera takes to fly to a world, the keyboard's pan step as a
   fraction of the window, and how much coasting velocity survives one second
   after release. The decay is per-second and applied as pow(k, dt) so the
   glide is the same on a 60Hz and a 144Hz screen. */
const GX_FLY_MS = 560;
const GX_KEY_PAN = 0.18;
const GX_GLIDE_DECAY = 0.0022;
