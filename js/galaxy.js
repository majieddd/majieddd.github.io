/* ==========================================================================
   THE GALAXY

   A campaign is a galaxy: a handful of solar systems, each a cluster of worlds
   held by the three rival powers and by the pirates. Take a world by winning on
   it; CONQUER it by taking it cleanly — three stars. Conquer enough of a system
   and its holding commander comes out to meet you personally.

   Everything here is deterministic from the campaign seed, so a galaxy is the
   same galaxy every time you open the map, and can be regenerated from a save
   that only stores the seed plus what you have taken.
   ========================================================================== */

const SYSTEMS_PER_GALAXY = 5;
/* Worlds in a system: one commander seat, CONTESTED_PER_SYSTEM three-way
   battles, and ordinary worlds for the rest. */
const WORLDS_PER_SYSTEM = 7;
/* Contested worlds are the three-way battles. Two per system, because one was
   a rarity a player could miss for a whole campaign and the tri boards are the
   most distinctive fights in the theatre. The seat and these two come out of
   WORLDS_PER_SYSTEM, which still leaves four ordinary worlds to open on -- do
   not raise this past WORLDS_PER_SYSTEM - 3. */
const CONTESTED_PER_SYSTEM = 2;
/* Every three-way board, in MAPS order. Derived rather than listed, so a new
   tri map joins the rotation simply by existing. */
const TRI_MAP_IDS = MAPS.filter(m => m.tri).map(m => m.id);
/* The four kind-keyed boons, cycled one per system so a single galaxy pays a
   different one each time and the last system pays the apex. Deliberately its
   own table rather than a read of WORLD_KINDS: the ORDER is the guarantee,
   and a weighted kind roll cannot make one. */
const RENEGADE_BOON_KINDS = ['standard', 'fortress', 'forge', 'nest'];
/* The one-of-each promise only holds while there is a system for each kind
   plus one for the apex. Stated here so moving SYSTEMS_PER_GALAXY cannot
   silently degrade it. */
if (RENEGADE_BOON_KINDS.length + 1 !== SYSTEMS_PER_GALAXY)
  console.warn('RENEGADE: ' + SYSTEMS_PER_GALAXY + ' systems cannot pay all ' +
               (RENEGADE_BOON_KINDS.length + 1) + ' own-power boons in one galaxy.');

/** Small deterministic PRNG so a seed always yields the same galaxy.

   MEASURED (Session 16): seeds are STRINGS ('seed1', a profile name), and
   `'seed1' >>> 0` is 0 for every string, so `|| 1` fired every time and every
   galaxy ever generated used the identical stream. Seeds did nothing: the same
   five systems, the same worlds, the same maps, forever — and any map landing
   in an unreached slot (THE ANVIL, and RIFT before it) was unreachable content.
   Hash the seed to an integer first. */
function galaxyRng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let x = (h >>> 0) || 1;
  return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const WORLD_NAMES = [
  'Kerath', 'Vell', 'Ashkar', 'Ordos', 'Myrren', 'Tessaly', 'Cauldron', 'Hollow',
  'Ninefold', 'Brack', 'Solace', 'Ixion', 'Tarsis', 'Umber', 'Perrin', 'Vaunt',
  'Cinderfall', 'Quill', 'Sabre', 'Threnody', 'Gallow', 'Wexen', 'Orrery', 'Lume'
];
const SYSTEM_NAMES = ['CORVUS', 'ARDENT', 'TALLOW REACH', 'THE SPINDLE', 'BLACKGLASS',
                      'HELIX', 'MOURNE', 'VAST'];

/* The renderer squashes every world's y by this before drawing, so generation
   divides by it to keep orbits visually circular. Keep the two in step. */
const GX_RENDER_SQUASH = 0.64;
/* Three rings and the golden angle: seven worlds land evenly instead of the
   two-ring alternation that paired them up.

   Session 19 scaled all three by exactly 4/3 along with the world. The scale
   being UNIFORM is the point: every intra-system distance scales with it, so
   the measured minimum separation moves 8.33 -> 11.11 and cannot be dragged
   back under the ~4.7-unit combined dot-and-ring width by one ring having been
   rounded harder than its neighbours. That is the Session 16 double-squash
   failure in a different costume. */
const GX_RINGS = [14.0, 20.0, 26.0];
/* The outermost orbit. The halo radius and both system labels in config.js are
   pitched against this, and naming it is what stops a raised ring quietly
   leaving the furniture sitting on top of the worlds. */
const GX_RING_OUTER = GX_RINGS[GX_RINGS.length - 1];
const GX_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* The bounds a world is held inside. These are a WORLD-space bound now, not a
   screen fit -- which is the root cause note 19.1 names. They used to be
   derived from GX_VIEW, and GX_VIEW was the same rectangle the whole galaxy
   was drawn into, so the clamp was literally "push every world back onto one
   screen". Derived from GX_WORLD they are what they were always described as:
   a guard against a layout bug, sitting far outside anything the slots and
   orbits can reach. Anything touching these is a bug to fix in
   GX_SYSTEM_SLOTS, not a value to squash. */
const GX_MARK_HALF = 4.2;      /* the widest world mark: the seat ring plus its stroke */
const GX_X_MIN = GX_WORLD.x + GX_MARK_HALF;
const GX_X_MAX = GX_WORLD.x + GX_WORLD.w - GX_MARK_HALF;
/* Vertical margins are asymmetric -- the contested ⚔ sits above a world and
   the star pips below it -- and are converted out of drawn space, because
   generation y is squashed by GX_RENDER_SQUASH before anything is painted. */
const GX_MARK_UP = 6.8, GX_MARK_DOWN = 5.5;
const GX_Y_MIN = (GX_WORLD.y + GX_MARK_UP) / GX_RENDER_SQUASH;
const GX_Y_MAX = (GX_WORLD.y + GX_WORLD.h - GX_MARK_DOWN) / GX_RENDER_SQUASH;

const WORLD_KINDS = {
  standard: { id: 'standard', label: 'World',      icon: '●', weight: 58 },
  fortress: { id: 'fortress', label: 'Fortress',   icon: '⛨', weight: 16,
              note: 'Dug in. The garrison starts with more lives.' },
  forge:    { id: 'forge',    label: 'Forge',      icon: '⚙', weight: 12,
              note: 'Industrial. Both sides begin richer.' },
  nest:     { id: 'nest',     label: 'Pirate Nest',icon: '☠', weight: 14,
              note: 'Swarm-infested. Waves arrive larger and sooner.' }
};

/* --------------------------------------------------------------------------
   GENERATION
-------------------------------------------------------------------------- */

/**
 * Build a whole galaxy from a seed. Systems are laid out around a spiral so the
 * map reads as a galaxy rather than a grid; worlds orbit their system centre.
 */
function generateGalaxy(seed, playerFaction) {
  const rnd = galaxyRng(seed);
  const rivals = rivalFactionsOf(playerFaction);
  /* WHO SQUATS the ordinary worlds. Naming the pirates outright put a fifth
     of a PIRATE player's galaxy under their own banner and marched them into
     battle against their own faction, commander included. Derived once and
     threaded to every site that names the squatter, so no two sites can
     disagree. The Xeno stand in because they hold the fewest systems of the
     three rivals (holders cycle, and five systems over three rivals leaves
     the third with one), which is the fewest worlds where the squat rolls
     onto its own holder and quietly does nothing. */
  const raider = playerFaction === 'pirate' ? 'xeno' : 'pirate';
  const systems = [];

  for (let si = 0; si < SYSTEMS_PER_GALAXY; si++) {
    /* Spiral placement: angle advances by roughly the golden angle so the arms
       never overlap, radius grows outward. Coordinates are in a 0-100 space. */
    /* Fixed layout slots. The spiral kept collapsing the five systems into a
       centre knot whatever the radii were tuned to; five hand-placed slots use
       the whole frame and guarantee no two systems can ever overlap. They live
       in config.js beside the FRAME they are pitched at -- slots tuned against
       one frame and drawn into another is how the orbits came to hang off the
       edge in the first place. */
    const slot = GX_SYSTEM_SLOTS[si % GX_SYSTEM_SLOTS.length];
    /* Slots are authored in RENDERED units -- what the viewBox actually shows
       -- while a system's STORED y is generation space, which the renderer
       squashes again on the way out. Converting here rather than in the table
       keeps the table readable against GX_WORLD, which is the one rectangle
       the slots have to fit inside. Nothing draws from rnd() in this
       conversion, so no saved campaign's maps, arenas or boons move. */
    const cx = slot[0], cy = slot[1] / GX_RENDER_SQUASH;

    /* Each system is dominated by one rival power, which supplies its commander. */
    const holder = rivals[si % rivals.length];
    const pool = commandersOf(holder);
    const boss = pool[Math.floor(rnd() * pool.length)];

    const worlds = [];
    for (let wi = 0; wi < WORLDS_PER_SYSTEM; wi++) {
      /* Even angular spacing with a per-system phase, and two alternating
         orbit radii. The old random angle+radius let pairs land on top of each
         other, which is what made the map read as a clump of bubbles. */
      /* MEASURED (Session 16): worlds were overlapping — minimum centre-to-
         centre distance 4.17 against a combined dot+ring radius of ~4.7. The
         cause was a DOUBLE vertical squash: this loop multiplied the y offset
         by 0.72, and the renderer multiplies world.y by 0.64 again, so a
         13.2-wide orbit was only 6.1 tall and the seven worlds bunched at the
         top and bottom of a flat ellipse. Dividing the y offset by the render
         squash makes the orbit visually round, and a THIRD ring plus the
         golden angle spreads seven worlds evenly instead of pairing them. */
      const phase = (si * 0.7) % (Math.PI * 2);
      const wa = wi * GX_GOLDEN_ANGLE + phase;
      const wr = GX_RINGS[wi % GX_RINGS.length];
      /* The last world of a system is the holding commander's own seat. */
      const isSeat = wi === WORLDS_PER_SYSTEM - 1;
      const kinds = Object.values(WORLD_KINDS);
      let roll = rnd() * kinds.reduce((a, k) => a + k.weight, 0);
      let kind = kinds[0];
      for (const k of kinds) { roll -= k.weight; if (roll <= 0) { kind = k; break; } }

      /* Hoisted so the boon draw can read the same two values the world
         is built from. The owner roll is unchanged and still the first
         rnd() call of this world -- only its line moved. */
      const worldOwner = isSeat ? holder : (rnd() < 0.2 ? raider : holder);
      const kindId = isSeat ? 'fortress' : kind.id;

      worlds.push({
        id: 's' + si + 'w' + wi,
        name: WORLD_NAMES[(si * WORLDS_PER_SYSTEM + wi) % WORLD_NAMES.length] +
              ' ' + 'IVXLC'.charAt(wi % 5) + (wi > 4 ? 'I' : ''),
        x: Math.min(GX_X_MAX, Math.max(GX_X_MIN, cx + Math.cos(wa) * wr)),
        /* Divided by the render squash so the orbit is round ON SCREEN. The
           clamp is a guard now, not a shaper: with GX_SYSTEM_SLOTS nothing
           reaches it, so no world is drawn off its own orbit. */
        y: Math.min(GX_Y_MAX, Math.max(GX_Y_MIN, cy + Math.sin(wa) * wr / GX_RENDER_SQUASH)),
        /* CONTESTED_PER_SYSTEM worlds per system (never the seat): two rival
           powers are already fighting over it, so taking it is a three-way war. */
        contested: false, contestedBy: null,
        kind: kindId,
        seat: isSeat,
        /* The raider holds roughly a fifth of the ordinary worlds. The roll
           is drawn either way rather than short-circuited, so the PRNG stream
           is identical for every profile and no saved galaxy's maps, arenas
           or boons move. */
        owner: worldOwner,
        /* Three-way maps are reserved for CONTESTED worlds only. */
        map: (() => { const pool = MAPS.filter(m => !m.tri);
                      return pool[Math.floor(rnd() * pool.length)].id; })(),
        arena: rnd() < 0.55 ? ARENA_MODS[Math.floor(rnd() * ARENA_MODS.length)].id : null,
        /* Still exactly ONE rnd() call, in the same position: boonFor
           takes the VALUE, never the generator. */
        boon: boonFor(worldOwner, kindId, false, rnd()).id,
        tier: si,
        /* Filled by buildRoutes() once every world exists. Declared here so a
           world is never a shape that has links on some code paths and not on
           others -- `links` is read on every galaxy-map frame. */
        links: [], entry: false,
        si, wi
      });
    }

    /* Nominate the contested worlds: mid-ring, never the seat, never the first
       two worlds of a system (a three-way war is no way to open one), and
       deterministic per seed -- these slots are derived from the system index
       rather than drawn from rnd(), so nominating a second world cannot shift
       every later world's roll. */
    {
      const slots = [2 + (si % 2), 4 + (si % 2)];
      slots.forEach((pick, k) => {
        const w = worlds[pick];
        if (!w || w.seat || w.contested) return;
        const others = rivals.filter(f => f !== w.owner);
        w.contested = true;
        w.contestedBy = [w.owner, others[(si + k) % others.length] || raider];
        /* A different board for each, so one system never fights the same
           three-way map twice. */
        w.map = TRI_MAP_IDS[(si * CONTESTED_PER_SYSTEM + k) % TRI_MAP_IDS.length];
        w.kind = 'fortress';
        /* Two powers were already fighting over this one, so it pays the
           holder's APEX boon -- the only place those five are reachable.
           Deterministic like the rest of this block: taking a roll here
           would shift every later world's stream. */
        w.boon = boonFor(w.owner, w.kind, true, 0).id;
      });
    }

    /* THE RENEGADE WORLD — one per system, and the only place your OWN power's
       five boons can be taken.
       ────────────────────────────────────────────────────────────────────
       Until now they could not be taken at all. `rivals` excludes you by
       construction (rivalFactionsOf), every world owner is drawn from it or
       from `raider`, and boonFor filters `b.f === owner` — so playing human,
       the five human boons were dead data in every galaxy ever generated.
       Five of the TWENTY (four powers, five each), unreachable by
       construction rather than by design.

       A splinter of your own power holds this one and will not stand down.
       Taking it back is how you carry your own power's advantage forward, and
       it is deliberately the one place your OWN soldiers march against you —
       which is why `renegade` is an explicit flag and not merely
       `owner === playerFaction`. battleHostFaction spent a whole session
       driving accidental own-troop garrisons from 15.3% to 0.0%, and this must
       read as the exception that proves that rule rather than as its return.

       NOT ONE NEW rnd() CALL. The slot is derived from the system index
       exactly as the contested block above derives its two, because
       galaxy.js's standing rule is that the draw sequence must never move or
       every saved galaxy's maps, arenas and boons shift underneath its owner.
       Measured over 4 powers x 40 seeds: every non-renegade field is
       byte-identical. */
    {
      /* THE PARALLEL HOLDS NO WORLDS AND OWNS NO BOONS. BOONS has twenty
         entries across the four powers that fight over the galaxy and none
         for the machines, so a renegade world on a Parallel profile would pay
         a fallback boon belonging to somebody else — and worldBossOf would
         seat a MACHINE commander behind it, spoiling the secret faction to a
         player who has only just unlocked it. No splinter for a power that
         holds nothing. */
      const hasOwnBoons = typeof BOONS !== 'undefined' &&
                          BOONS.some(b => b.f === playerFaction);
      /* Never the seat, never the two opening worlds, and never a world the
         contested block already took: those slots are 2+(si%2) and 4+(si%2),
         so 3+(si%2) always threads between them and 6 is the seat. */
      const pick = 3 + (si % 2);
      const w = hasOwnBoons ? worlds[pick] : null;
      if (w && !w.seat && !w.contested) {
        w.owner = playerFaction;
        w.renegade = true;
        /* THE BOON KEY IS NOT THE WORLD'S KIND, and that distinction is the
           whole of O1 being delivered rather than merely attempted.

           Reading the world's own rolled kind looked right and is not: the
           kinds are weighted (standard 58, fortress 16, forge 12, nest 14),
           so four independent draws land all four kind-keyed boons in only
           about 4% of galaxies — 2.3 of 4 on average. Five own boons would
           have been "reachable" in the sense that a long enough sequence of
           runs eventually shows them, which is not what was asked for.

           Cycling the key by system index pays a DIFFERENT one of the four in
           every galaxy, and the last system pays the APEX — so all five are
           reachable in every single run. The world's own `kind` is left
           untouched: it is the world's identity, it drives the briefing card
           and the garrison rules, and a fortress that calls itself a forge to
           move a boon would be a lie on the card to save a line here. */
        const bk = RENEGADE_BOON_KINDS[si % RENEGADE_BOON_KINDS.length];
        const apex = si === SYSTEMS_PER_GALAXY - 1;
        w.boon = boonFor(playerFaction, apex ? w.kind : bk, apex, 0).id;
      }
    }

    systems.push({
      id: 'sys' + si, index: si,
      name: SYSTEM_NAMES[si % SYSTEM_NAMES.length],
      x: cx, y: cy, holder, boss: boss.id, worlds
    });
  }
  const galaxy = { seed, playerFaction, raider, systems };
  /* AFTER every world exists, and drawing NOTHING from rnd(). See the route
     section below for why that ordering is not negotiable. */
  buildRoutes(galaxy);
  return galaxy;
}

/* --------------------------------------------------------------------------
   THE ROUTE GRAPH

   Which worlds a fleet can cross between, and the dotted arcs the map draws to
   say so. Built from nothing but the positions and indices already sitting on
   the worlds: it consumes NO rnd() call, which is what lets it be added to a
   generator whose stream must not move. MEASURED over 180 seed/faction pairs,
   the galaxy fingerprint -- ids, names, positions, kinds, owners, maps,
   arenas, boons, seats, contested slots and their contestants -- is
   byte-identical with and without this section.

   THE CONNECTIVITY RULE, in four parts. Each one exists to guarantee a
   property the campaign would otherwise only have by luck:

     1. Inside a system, the graph is the UNION of a minimum spanning tree over
        its ORDINARY worlds and every world's GX_ROUTE_NEAR_K nearest
        neighbours. The tree is what guarantees no orphan; the nearest pass is
        what guarantees at least two ways out of every world, because a world
        contributes K edges of its own before anybody else's are counted.

     2. The tree deliberately EXCLUDES the seat. A seat opens only once most of
        its system has fallen, so a world whose only path from the door ran
        through the seat could never be opened at all -- the seat would need
        four conquests that needed the seat. Spanning the six ordinary worlds
        and hanging the seat off them by its own nearest links makes that
        deadlock structurally impossible rather than unlikely.

     3. Between systems, only ADJACENT tiers are ever joined
        (GX_ROUTE_MAX_TIER_SPAN), by the GX_ROUTE_GATEWAYS shortest links
        between two ordinary worlds. No edge in the galaxy spans more than one
        tier, so no route can carry a fleet past a system it has not taken.

     4. The far end of every gateway is an ENTRY -- the door a newly opened
        system is entered by. Two gateways means two doors that land in
        different corners, so arriving in a system is a choice. System 0 has
        nothing behind it, so it names its landfall pair outright.

   Distance is measured in RENDERED space -- y multiplied by GX_RENDER_SQUASH
   before the hypotenuse -- because "near" has to mean near ON SCREEN. Ranking
   neighbours in generation space is the same double-squash mistake that once
   bunched the worlds themselves into a flat ellipse: the map would link worlds
   that look far apart and skip the ones sitting next to each other.
-------------------------------------------------------------------------- */

/** An ORDINARY world: neither a commander's seat nor a three-way war. Only
    these are eligible to be a door into a system -- a door that lands you in
    a three-way war, or on the seat you are supposed to finish at, is not a way
    in, it is the wall the system ends at. */
function isOrdinaryWorld(w) { return !w.seat && !w.contested; }

/** Centre-to-centre distance between two worlds AS DRAWN. */
function routeDist(a, b) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * GX_RENDER_SQUASH);
}

/**
 * Lay the route graph over a finished galaxy. Mutates the worlds (`links`,
 * `entry`) and hangs the edge list on `galaxy.routes` for the renderer.
 */
function buildRoutes(galaxy) {
  const routes = [];
  const seen = new Set();
  /* The graph is UNDIRECTED. A tree edge that the nearest-neighbour pass finds
     again must not become a second arc drawn on top of the first, and must not
     count twice toward a world's degree -- an inflated degree is exactly the
     kind of number that reads as a guarantee and is not one. */
  const link = (a, b, kind) => {
    if (a === b) return false;
    const k = a.id < b.id ? a.id + '>' + b.id : b.id + '>' + a.id;
    if (seen.has(k)) return false;
    seen.add(k);
    a.links.push(b.id);
    b.links.push(a.id);
    /* THREE keys, and every one has a reader: `a`/`b` are looked up by
       UI.gxRoutes to place the arc, `kind` picks which way it bows and whether
       the far zoom keeps it. A tier span was written here too and deleted
       again -- nothing consulted it, and an unread key is this project's
       signature defect. The span is Math.abs(a.tier - b.tier) for anyone who
       needs it. */
    routes.push({ a: a.id, b: b.id, kind: kind });
    return true;
  };
  /* Nearest neighbours of `w` within `pool`, ties broken by world index so the
     graph is a function of the seed alone and not of sort stability. */
  const nearest = (w, pool) => pool
    .filter(o => o !== w)
    .map(o => ({ o: o, d: routeDist(w, o) }))
    .sort((p, q) => p.d - q.d || p.o.wi - q.o.wi);

  for (const sys of galaxy.systems) {
    const ordinary = sys.worlds.filter(w => !w.seat);
    /* PRIM over the non-seat worlds -- part 1 and part 2 of the rule. */
    if (ordinary.length) {
      const inTree = [ordinary[0]];
      const rest = ordinary.slice(1);
      while (rest.length) {
        let bi = 0, bj = 0, bd = Infinity;
        for (let i = 0; i < inTree.length; i++)
          for (let j = 0; j < rest.length; j++) {
            const d = routeDist(inTree[i], rest[j]);
            if (d < bd - 1e-9 ||
                (Math.abs(d - bd) <= 1e-9 && rest[j].wi < rest[bj].wi)) {
              bd = d; bi = i; bj = j;
            }
          }
        link(inTree[bi], rest[bj], 'local');
        inTree.push(rest[bj]);
        rest.splice(bj, 1);
      }
    }
    /* K NEAREST over ALL of them, seat included: this is the clause that turns
       a spanning tree into a map with choices in it, and it is also how the
       seat acquires its own two approaches. */
    for (const w of sys.worlds) {
      const near = nearest(w, sys.worlds);
      for (let i = 0; i < GX_ROUTE_NEAR_K && i < near.length; i++)
        link(w, near[i].o, 'local');
    }
  }

  /* GATEWAYS -- part 3. The loop is written against MAX_TIER_SPAN rather than
     hard-coded to i+1 so the tier law has exactly one statement in the code
     and the test can measure the spans it actually produces. */
  for (let i = 0; i < galaxy.systems.length; i++)
    for (let j = i + 1;
         j <= i + GX_ROUTE_MAX_TIER_SPAN && j < galaxy.systems.length; j++) {
      const from = galaxy.systems[i].worlds.filter(isOrdinaryWorld);
      const to = galaxy.systems[j].worlds.filter(isOrdinaryWorld);
      const pairs = [];
      for (const a of from) for (const b of to)
        pairs.push({ a: a, b: b, d: routeDist(a, b) });
      pairs.sort((p, q) => p.d - q.d || p.a.wi - q.a.wi || p.b.wi - q.b.wi);
      const usedA = new Set(), usedB = new Set();
      let made = 0;
      for (const p of pairs) {
        if (made >= GX_ROUTE_GATEWAYS) break;
        /* DISTINCT worlds at both ends. Two gateways sharing a far endpoint
           are one door drawn twice, and the choice they exist to create would
           not exist -- which is the failure this whole note is about. */
        if (usedA.has(p.a.id) || usedB.has(p.b.id)) continue;
        usedA.add(p.a.id);
        usedB.add(p.b.id);
        link(p.a, p.b, 'gate');
        p.b.entry = true;
        made++;
      }
    }

  /* LANDFALL -- part 4, for the one system with nothing behind it. The first
     world stays a door, as it has been since the campaign existed, and the
     ordinary world nearest to it becomes the second, so even the opening move
     is a choice of two rather than the only legal click on the map. */
  const first = galaxy.systems[0];
  if (first && first.worlds.length) {
    const head = first.worlds[0];
    head.entry = true;
    const near = nearest(head, first.worlds.filter(isOrdinaryWorld));
    if (near.length) near[0].o.entry = true;
  }

  galaxy.routes = routes;
  return routes;
}

/** The worlds INSIDE this system that a route joins to `world`.

    Cross-tier gateways are deliberately not returned. What opens a world is a
    landing already made in its own system; what lets you into the system at
    all is isSystemOpen, one tier gate above. Answering both questions from one
    list is how a route would come to skip a tier. */
function routeNeighbours(system, world) {
  const out = [];
  if (!world || !world.links) return out;
  for (const id of world.links) {
    const n = system.worlds.find(w => w.id === id);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Who actually commands THIS world. A system's boss holds the SYSTEM, but a
 * world taken out from under them is commanded by whoever took it -- and
 * shipping `sys.boss` regardless paired a holder's commander with a
 * squatter's banner on about one battle in seven, so a Federation commander
 * fought under a pirate crest and collected the pirate economy bonus.
 *
 * Index-derived rather than drawn from rnd(): stable for a seed, and it costs
 * the galaxy stream nothing, so no existing campaign's layout moves.
 */
function worldBossOf(sys, w) {
  if (!w || w.owner === sys.holder) return sys.boss;
  const pool = commandersOf(w.owner);
  return pool.length
    ? pool[(w.si * WORLDS_PER_SYSTEM + w.wi) % pool.length].id
    : sys.boss;
}

/* --------------------------------------------------------------------------
   STATE QUERIES  (progress is stored separately, as id -> stars)
-------------------------------------------------------------------------- */

/** Stars earned on a world, 0-3. */
function starsOn(progress, worldId) { return (progress && progress[worldId]) || 0; }
/** A world is CONQUERED at three stars — that is what transfers territory. */
function isConquered(progress, worldId) { return starsOn(progress, worldId) >= 3; }

/** Every world in a system that the player has fully taken. */
function systemProgress(system, progress) {
  const total = system.worlds.length;
  let taken = 0, stars = 0, played = 0;
  for (const w of system.worlds) {
    const s = starsOn(progress, w.id);
    stars += s;
    if (s > 0) played++;
    if (s >= 3) taken++;
  }
  return { total, taken, stars, played, maxStars: total * 3,
           seatOpen: taken >= Math.ceil((total - 1) * 0.6) };
}

/**
 * A world can be attacked if it is a DOOR into its system, or if a world a
 * route joins it to has already been played. The seat still needs most of the
 * system.
 *
 * This is the reader for the route graph, and the only one. The arcs the map
 * draws are that same graph, so a dotted line can never promise a crossing
 * this function refuses -- the previous map drew a straight ruler from where
 * you stood to every legal world in the galaxy, twelve orbits away included,
 * which described the rule without ever being it.
 *
 * The old rule was `wi === 0 || stars on wi - 1`: a single-file queue through
 * a system in generation order, which is what note 20.1 is about.
 */
function isWorldOpen(system, world, progress) {
  if (world.seat) return systemProgress(system, progress).seatOpen;
  if (world.entry) return true;
  const near = routeNeighbours(system, world);
  /* A galaxy assembled by something other than generateGalaxy -- a harness, a
     future editor -- has no graph to read. Falling back to the old linear rule
     keeps such a galaxy playable; sealing it would be a blank map. */
  if (!near.length)
    return world.wi === 0 ||
           starsOn(progress, system.worlds[world.wi - 1].id) > 0;
  return near.some(n => starsOn(progress, n.id) > 0);
}

/** A system is open once the previous system's seat has fallen. */
function isSystemOpen(galaxy, system, progress) {
  if (system.index === 0) return true;
  const prev = galaxy.systems[system.index - 1];
  return isConquered(progress, prev.worlds[prev.worlds.length - 1].id);
}

/* --------------------------------------------------------------------------
   ALLEGIANCE -- what a world READS as

   A campaign is a record of who holds what, and until Session 20 the map that
   exists to show it said almost none of it: a world painted in its ORIGINAL
   power's colour whatever you had done to it, and the only trace of a conquest
   was a star count three pixels tall. Everything a node paints itself from now
   comes out of worldAllegiance(), so the map, the class list and the
   accessible name cannot disagree about who holds a world.
-------------------------------------------------------------------------- */

/* Three stars is the claim. isConquered() is the LAW; this const exists so the
   paint divides the claim ring by the same number ownership actually transfers
   on -- a ring that closes at two while the rule transfers at three is exactly
   the UI/engine desync this project has shipped seven times. */
const GX_CLAIM_STARS = 3;

/* How far outside the world disc the claim ring is drawn. Deliberately under
   GX_MARK_HALF - r on BOTH world sizes (2.0 ordinary, 2.7 seat), so the widest
   mark on the map is still the seat ring: GX_MARK_HALF is baked into
   generation's x-clamp, and a mark that outgrew it would start dragging worlds
   back off their own orbits. */
const GX_CLAIM_RING_PAD = 1.15;

/* Where the claim sigil sits, as fractions of the world radius: the offset of
   its centre from the world's, then its own radius. Fractions rather than
   absolutes so a seat and an ordinary world wear the same badge at their own
   scale and neither one crosses its claim ring. */
const GX_SIGIL_OFF = 0.62, GX_SIGIL_R = 0.46;

/* One word per state, for the node's accessible name. The map has to say in
   text whatever it says in paint or the colour work is decoration for the
   people who can see it and nothing at all for everyone else. */
const GX_STATE_LABEL = {
  claimed:   'held by you',
  foothold:  'claim in progress',
  contested: 'contested',
  seat:      'commander seat',
  locked:    'sealed',
  renegade:  'your own splinter',
  held:      'held'
};

/**
 * What a world reads as, in one call. `faction` is whose colour the node
 * WEARS; `you` is whose colour the claim is painted in. Those are two
 * different things at one and two stars -- the world still belongs to its
 * holder while a third of your ring is already drawn on it -- and conflating
 * them is what made a partial claim invisible.
 *
 * @returns {{stars:number, claimed:boolean, open:boolean, state:string,
 *            faction:string, holder:string, you:string, claim:number,
 *            seat:boolean, contested:boolean}}
 */
function worldAllegiance(galaxy, system, world, progress) {
  const stars = Math.max(0, Math.min(GX_CLAIM_STARS, starsOn(progress, world.id)));
  const claimed = stars >= GX_CLAIM_STARS;
  /* A world you have played is open under today's unlock rule, so LOCKED
     cannot currently hide a claim in progress. Ordered anyway, rather than
     assumed, so a future unlock rule cannot silently grey out your own work. */
  const open = isSystemOpen(galaxy, system, progress) &&
               isWorldOpen(system, world, progress);
  const state = claimed ? 'claimed'
              : !open ? 'locked'
              : stars > 0 ? 'foothold'
              : world.seat ? 'seat'
              : world.contested ? 'contested'
              /* A RENEGADE world flies your own colour and is NOT yours, so
                 'held' -- the word for ground a rival holds -- was the one
                 label that could not be right. It sits below seat and
                 contested because those describe the FIGHT and this describes
                 the holder. */
              : world.renegade ? 'renegade'
              : 'held';
  return {
    stars, claimed, open, state,
    faction: claimed ? galaxy.playerFaction : world.owner,
    holder: world.owner,
    you: galaxy.playerFaction,
    claim: stars / GX_CLAIM_STARS,
    seat: !!world.seat,
    /* Contested is a fight between two OTHER powers. Once the world is yours
       there is no fight left to advertise, and leaving the split ring up made
       a conquered world read as still up for grabs. */
    contested: !!world.contested && !claimed,
    /* Same rule as `contested` directly above, and for the same reason: once
       the world is yours the splinter is gone, and a conquered world must not
       keep wearing the mark of a fight that is over. */
    renegade: !!world.renegade && !claimed
  };
}

/** The state in words, for the node's accessible name and the map key. */
function allegianceLabel(al) {
  return GX_STATE_LABEL[al && al.state] || GX_STATE_LABEL.held;
}

/**
 * Star rating for a finished battle. Three stars is a clean take: you won, and
 * you did it without giving up much ground.
 */
function ratingFor(won, livesLeft, maxLives, wave) {
  if (!won) return 0;
  const kept = livesLeft / Math.max(1, maxLives);
  if (kept >= 0.9) return 3;
  if (kept >= 0.55) return 2;
  return 1;
}

/** Every seat taken means the galaxy is yours. */
function galaxyComplete(galaxy, progress) {
  return galaxy.systems.every(sys => isConquered(progress, sys.worlds[sys.worlds.length - 1].id));
}
/** Seats still standing, for the map header and the victory screen. */
function seatsRemaining(galaxy, progress) {
  return galaxy.systems.filter(sys => !isConquered(progress, sys.worlds[sys.worlds.length - 1].id)).length;
}

/** Territory tally per faction across the whole galaxy. */
function galaxyHoldings(galaxy, progress) {
  const out = {};
  for (const f of FACTION_ORDER) out[f] = 0;
  /* The player's own banner may not be one of the galaxy's four powers -- THE
     PARALLEL holds no worlds and so is absent from FACTION_ORDER. Without a
     slot of its own the first conquest increments `undefined` and every
     holdings figure on the screen becomes NaN. */
  out[galaxy.playerFaction] = out[galaxy.playerFaction] || 0;
  /* A RENEGADE world is owned by your own power and is NOT yours until you
     take it. Tallied by owner alone it would credit the status strip with
     worlds the player has never fought for -- "12 / 35 worlds held" on a fresh
     galaxy -- so the splinter gets its own bucket. It is deliberately not a
     FACTION_ORDER key: the ownership bar iterates that list, and a segment in
     your own colour for ground you do not hold is the same lie in a different
     shape. */
  out.renegade = 0;
  for (const sys of galaxy.systems)
    for (const w of sys.worlds) {
      if (isConquered(progress, w.id)) { out[galaxy.playerFaction]++; continue; }
      if (w.renegade) { out.renegade++; continue; }
      out[w.owner]++;
    }
  return out;
}

/**
 * Rival commanders expand on their own while you are busy. Each time you finish
 * a battle, every rival that still holds a seat takes one contested world
 * somewhere in the galaxy — so leaving a system alone has a cost.
 */
function advanceRivals(galaxy, progress, rnd) {
  const moves = [];
  /* The same substitution generateGalaxy made. Naming the pirates here left a
     PIRATE player's rivals with no worlds to expand into at all, so they
     never took ground back and leaving a system alone stopped costing
     anything. The fallback covers a galaxy generated before this existed. */
  const raider = galaxy.raider || 'pirate';
  for (const sys of galaxy.systems) {
    if (isConquered(progress, sys.worlds[sys.worlds.length - 1].id)) continue;
    const targets = sys.worlds.filter(w => !w.seat && w.owner === raider &&
                                           !isConquered(progress, w.id));
    if (!targets.length) continue;
    const t = targets[Math.floor(rnd() * targets.length)];
    t.owner = sys.holder;
    /* The ID travels with the move, not just the display name. This function
       mutates the LIVE galaxy, and the live galaxy is regenerated from the
       campaign seed on every load -- so unless the caller can write the take
       back onto the campaign, every world the rivals ever took is handed
       straight back. World NAMES repeat across a galaxy (WORLD_NAMES cycles);
       the id does not. */
    moves.push({ system: sys.name, world: t.name, worldId: t.id,
                 faction: sys.holder });
  }
  return moves;
}
