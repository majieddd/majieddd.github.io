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
        kind: isSeat ? 'fortress' : kind.id,
        seat: isSeat,
        /* The raider holds roughly a fifth of the ordinary worlds. The roll
           is drawn either way rather than short-circuited, so the PRNG stream
           is identical for every profile and no saved galaxy's maps, arenas
           or boons move. */
        owner: isSeat ? holder : (rnd() < 0.2 ? raider : holder),
        /* Three-way maps are reserved for CONTESTED worlds only. */
        map: (() => { const pool = MAPS.filter(m => !m.tri);
                      return pool[Math.floor(rnd() * pool.length)].id; })(),
        arena: rnd() < 0.55 ? ARENA_MODS[Math.floor(rnd() * ARENA_MODS.length)].id : null,
        boon: BOONS[Math.floor(rnd() * BOONS.length)].id,
        tier: si,
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
      });
    }

    systems.push({
      id: 'sys' + si, index: si,
      name: SYSTEM_NAMES[si % SYSTEM_NAMES.length],
      x: cx, y: cy, holder, boss: boss.id, worlds
    });
  }
  return { seed, playerFaction, raider, systems };
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
 * A world can be attacked if it is the first in its system, or if something
 * adjacent to it has already been played. The seat needs most of the system.
 */
function isWorldOpen(system, world, progress) {
  if (world.seat) return systemProgress(system, progress).seatOpen;
  if (world.wi === 0) return true;
  const prev = system.worlds[world.wi - 1];
  return starsOn(progress, prev.id) > 0;
}

/** A system is open once the previous system's seat has fallen. */
function isSystemOpen(galaxy, system, progress) {
  if (system.index === 0) return true;
  const prev = galaxy.systems[system.index - 1];
  return isConquered(progress, prev.worlds[prev.worlds.length - 1].id);
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
  for (const sys of galaxy.systems)
    for (const w of sys.worlds)
      out[isConquered(progress, w.id) ? galaxy.playerFaction : w.owner]++;
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
