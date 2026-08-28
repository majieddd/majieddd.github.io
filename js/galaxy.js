/* ==========================================================================
   THE GALAXY

   A campaign is a galaxy: a handful of solar systems, each a cluster of worlds
   held by the three rival powers and by the pirates. Take a world by winning on
   it; CONQUER it by taking it cleanly, three stars. Conquer enough of a system
   and its holding commander comes out to meet you personally.

   Everything here is deterministic from the campaign seed, so a galaxy is the
   same galaxy every time you open the map, and can be regenerated from a save
   that only stores the seed plus what you have taken.
   ========================================================================== */

const SYSTEMS_PER_GALAXY = 5;

/* THEMES: one identity per system slot. `families` is the set of procedural
   families that world favours (the galaxy pool filters on it); `label` and
   `blurb` are what the UI shows so a player can feel which kind of ground they
   are walking into. Derived from si, never drawn, see the map draw above. */
const GX_THEMES = [
  { name: 'The Approach', label: 'OPEN GROUND', blurb: 'Wide roads and little cover; your towers must hold at range.',
    families: ['open-field', 'braid', 'spiral'] },
  { name: 'The Narrows Reach', label: 'FENCED ROADS', blurb: 'Corridors, bars and posts, the ground funnels everything past your walls.',
    families: ['gauntlet', 'twin-gate', 'chokepoint', 'horseshoe'] },
  { name: 'The Broken Step', label: 'SPLIT GROUND', blurb: 'Stairs, switchbacks and twin arenas; nothing here is one straight fight.',
    families: ['staircase', 'switchback', 'twin-temple', 'island-scatter'] },
  { name: 'The Deep Maze', label: 'WALLED GROUND', blurb: 'Mazes, rings and bastions, sightlines are the whole war.',
    families: ['labyrinth', 'fortress-ring', 'convergence', 'twin-channel'] }
];
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
   five systems, the same worlds, the same maps, forever, and any map landing
   in an unreached slot (THE ANVIL, and RIFT before it) was unreachable content.
   Hash the seed to an integer first. */
function galaxyRng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let x = (h >>> 0) || 1;
  return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* ══════════════════════════════ NAMING, CANON 2029 ══════════════════════
   Real stars and real theoretical hypotheticals (docs/CANON-2029.md, owner
   instruction). Every campaign opens in its banner's HOME system, so each
   faction starts somewhere different: humanity in THE EARTH SYSTEM with our
   actual solar system as its worlds, the Federation in the Pleiades of the
   contactee mythos, the Xeno at Zeta Reticuli off the Hill star map, the
   Pirates at Barnard's Star, the Vigil at Tabby's Star, the one the
   megastructure hypothesis was written about. Later systems draw from real
   neighbours, and Sol itself appears in NON-human campaigns with Earth as
   its seat.

   STREAM SAFETY, which is the whole design. The old tables were consumed by
   pure index arithmetic and never by rnd(), so naming draws NOTHING today
   and must draw nothing tomorrow. These helpers take (faction, seed, si, wi)
   and use integer arithmetic only: same call count, zero draws, and the
   structural fingerprint (everything except names) is asserted byte
   identical across 60 generations in the change that landed this.

   The last world of every system (wi 6) is the SEAT, so each home list is
   ordered with its seat last: Luna, because the far side of the Moon is
   where the occupiers always were; Alcyone, the mythos anchor of the
   Pleiades; Serpo, the Zeta Reticuli planet of the Project Serpo story;
   Harbour Nine, the sanctuary the pirate arc already talks about; the Veil,
   the swarm that dims KIC 8462852. */
const GX_HOME_SYSTEMS = {
  human:  { name: 'THE EARTH SYSTEM',
            worlds: ['MERCURY', 'VENUS', 'MARS', 'CERES', 'EUROPA', 'TITAN', 'LUNA'] },
  light:  { name: 'THE PLEIADES',
            worlds: ['MAIA', 'ELECTRA', 'TAYGETA', 'MEROPE', 'CELAENO', 'STEROPE', 'ALCYONE'] },
  xeno:   { name: 'ZETA RETICULI',
            worlds: ['ZETA-1 b', 'ZETA-1 c', 'ZETA-1 d', 'ZETA-2 b', 'ZETA-2 c', 'ZETA-2 d', 'SERPO'] },
  pirate: { name: "BARNARD'S STAR",
            worlds: ['BARNARD b', 'BARNARD c', 'BARNARD d', 'BARNARD e', 'BARNARD f', 'BARNARD g', 'HARBOUR NINE'] },
  robot:  { name: "TABBY'S STAR",
            worlds: ['KIC-8462 b', 'KIC-8462 c', 'KIC-8462 d', 'KIC-8462 e', 'KIC-8462 f', 'KIC-8462 g', 'THE VEIL'] },
};

/* The travelling pool: real nearby systems, worlds in real exoplanet letter
   style (planets letter from b). TRAPPIST-1 b through h are all real, seven
   of them, which is exactly a system's world count. SOL appears here so the
   other powers' campaigns can arrive at us: its seat is EARTH. */
/* `seat` is the LAST world of the system, where the holding commander sits.
   It gets a named place rather than a catalogue letter, because a playtest
   read "WOLF 359 h" as the seat of a solar system and it landed as a
   spreadsheet cell, not somewhere a commander lives. The letters are right
   for ordinary worlds (real exoplanets letter from b) and wrong for the one
   world the campaign asks you to remember. */
const GX_STAR_POOL = [
  { name: 'SOL',              worlds: ['MERCURY', 'VENUS', 'MARS', 'CERES', 'EUROPA', 'TITAN', 'EARTH'] },
  { name: 'PROXIMA CENTAURI', tag: 'PROXIMA',    seat: 'PROXIMA GATE' },
  { name: 'TAU CETI',         tag: 'TAU CETI',   seat: 'CETI ANCHORAGE' },
  { name: 'TRAPPIST-1',       tag: 'TRAPPIST-1', seat: 'TRAPPIST PRIME' },
  { name: 'SIRIUS',           tag: 'SIRIUS',     seat: 'THE DOG STAR' },
  { name: 'EPSILON ERIDANI',  tag: 'ERIDANI',    seat: 'ERIDANI HIGH' },
  { name: 'GLIESE 581',       tag: 'GLIESE 581', seat: 'THE TWILIGHT BELT' },
  { name: 'WOLF 359',         tag: 'WOLF 359',   seat: 'THE EMBER' },
  { name: 'ROSS 128',         tag: 'ROSS 128',   seat: 'THE QUIET SIGNAL' },
  { name: 'ALPHA CENTAURI',   tag: 'CENTAURI',   seat: 'THE NEAREST THRONE' },
  { name: '61 CYGNI',         tag: 'CYGNI',      seat: 'THE FLYING STAR' },
  { name: "KAPTEYN'S STAR",   tag: 'KAPTEYN',    seat: 'THE HALO WANDERER' },
];

/* ──────────────────────────── THE ONE UNIVERSE (v2, Session 38) ────────────
   Owner directive 2026-08-27: factions were each generating their own random
   galaxy, so a human campaign and a light campaign showed unrelated solar
   systems. The direction is ONE galaxy: the same five systems, the same
   worlds in the same states, and each faction simply STARTS at its own home
   and conquers outward from there. "The same universe from different sides."

   v2 therefore generates the five HOME systems in a fixed UNIVERSE ORDER
   (below), from a fixed UNIVERSE SEED, for every faction. The rnd() stream is
   identical whoever is playing, so kinds, maps, arenas, contested slots and
   boon slots are byte-identical across factions. What is then rotated per
   faction is only the CAMPAIGN ORDER (your home is tier 0) and what is
   necessarily political is only the HOLDER of each system, because the
   standing law that your own faction never garrisons a board against you
   (battleHostFaction, driven to 0.0%) forbids a light player besieging a
   light-held Pleiades. The deviation is authored, not rolled, in the table
   below.

   The seed is the intercept date. April 13, 2029 is the day the rock broke
   and every one of these campaigns began at once, which is exactly the
   owner's reason the universe must be shared. */
const GX_UNIVERSE_SEED = 20290413;
const GX_UNIVERSE_ORDER = ['human', 'light', 'xeno', 'pirate', 'robot'];

/* Who HOLDS each home system, per player faction. Row: universe system by its
   home faction. Column rule: the canonical holder, unless that would be the
   player's own faction, in which case the authored occupier of their story
   (the harvest holds Earth, the broken fence lets the xeno into the Pleiades,
   the shattered pods put a human fleet over Zeta, a human crackdown blockades
   Barnard's, and the jagged alien knot has the Veil). 'robot' never appears
   as a holder: seating Parallel commanders in front of a player who has not
   unlocked the faction would spoil it, so the corrupted machines of Tabby's
   Star read as what corrupted them. */
const GX_V2_HOLDER = {
  /* system EARTH   */ human:  { human: 'xeno',   light: 'xeno',   xeno: 'human',  pirate: 'xeno',   robot: 'xeno' },
  /* system PLEIADES*/ light:  { human: 'light',  light: 'xeno',   xeno: 'light',  pirate: 'light',  robot: 'light' },
  /* system ZETA    */ xeno:   { human: 'xeno',   light: 'xeno',   xeno: 'human',  pirate: 'xeno',   robot: 'xeno' },
  /* system BARNARD */ pirate: { human: 'pirate', light: 'pirate', xeno: 'pirate', pirate: 'human',  robot: 'pirate' },
  /* system TABBY   */ robot:  { human: 'xeno',   light: 'xeno',   xeno: 'pirate', pirate: 'xeno',   robot: 'xeno' },
};
/* GX_V2_HOLDER[homeFaction][playerFaction] = who garrisons that system in
   that player's campaign. Every diagonal case (you at your own home) resolves
   to your story's occupier, never to yourself; the sweep asserts this for all
   25 cells because a table this small is exactly where a typo hides. */

/* Pure integer helpers. No rnd() call may ever appear in either. */
function gxPoolEntry(faction, seed, si) {
  /* Humanity's home IS Sol, so its travelling pool must not offer a second
     one. The filter is deterministic and faction-keyed, not drawn. */
  const pool = faction === 'human'
    ? GX_STAR_POOL.filter(p => p.name !== 'SOL') : GX_STAR_POOL;
  const off = ((seed >>> 3) + (seed >>> 11)) % pool.length;
  return pool[(off + (si - 1)) % pool.length];
}
function gxSystemName(faction, seed, si) {
  if (si === 0) return (GX_HOME_SYSTEMS[faction] || GX_HOME_SYSTEMS.human).name;
  return gxPoolEntry(faction, seed, si).name;
}
function gxWorldName(faction, seed, si, wi) {
  if (si === 0) return (GX_HOME_SYSTEMS[faction] || GX_HOME_SYSTEMS.human).worlds[wi % 7];
  const entry = gxPoolEntry(faction, seed, si);
  if (entry.worlds) return entry.worlds[wi % 7];
  /* The seat (last world) is a place; the rest letter like real exoplanets. */
  if (wi % 7 === 6 && entry.seat) return entry.seat;
  return entry.tag + ' ' + 'bcdefgh'.charAt(wi % 7);
}

/* The renderer squashes every world’s y by this before drawing, so generation
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
/* Wider than they were (14/20/26): the owner asked for the worlds to spread
   inside their zone, and with the dotted halo gone the orbits can use the
   room the circle used to fence off. Positions only; not one rnd() draw
   moves. */
const GX_RINGS = [17.0, 25.0, 33.0];
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

/* KIND WEIGHTS ARE VERSIONED AND PINNED (owner, batch 2). The owner asked
   for more Vigil-garrisoned neutral worlds, and the kind roll consumes one
   rnd() per world, so changing weights changes OUTCOMES while leaving the
   stream position untouched. Outcomes are still state: a galaxy regenerates
   from its seed on every load, so an in-flight campaign under new weights
   would wake up with different worlds. campaignStart pins kindsW on the
   campaign the day it begins; old campaigns carry no pin and get v1
   forever. Same law as the mapPool pin two fields over. */
const KIND_WEIGHTS = {
  1: { standard: 58, fortress: 16, forge: 12, nest: 14 },
  2: { standard: 46, fortress: 16, forge: 12, nest: 26 }
};
const WORLD_KINDS = {
  standard: { id: 'standard', label: 'World',      icon: '●', weight: 58 },
  fortress: { id: 'fortress', label: 'Fortress',   icon: '⛨', weight: 16,
              note: 'Dug in. The garrison starts with more lives.' },
  forge:    { id: 'forge',    label: 'Forge',      icon: '⚙', weight: 12,
              note: 'Industrial. Both sides begin richer.' },
  /* CANON (lore v0.2.0, continuity rule 6): the swarm is THE VIGIL, legacy Old
     Weather enforcement, and it is nobody’s army. Labelling it a Pirate Nest
     also produced a second-order bug: `kind` is rolled independently of
     `owner`, so a Federation world could be labelled a Pirate Nest, and a
     PIRATE player’s own worlds were labelled Pirate Nests. A neutral Vigil
     nest is correct under every owner, which is what a kind roll needs. */
  nest:     { id: 'nest',     label: 'Vigil Nest', icon: '☠', weight: 14,
              note: 'Waves arrive larger and sooner. Old Weather routines still run here, and they do not check banners.' }
};

/* --------------------------------------------------------------------------
   GENERATION
-------------------------------------------------------------------------- */

/**
 * Build a whole galaxy from a seed. Systems are laid out around a spiral so the
 * map reads as a galaxy rather than a grid; worlds orbit their system centre.
 */
function generateGalaxy(seed, playerFaction, mapPool, kindsW, gxv) {
  /* v2 is the ONE UNIVERSE (see GX_UNIVERSE_SEED above). Every caller that
     does not pass gxv gets v1 byte-identical: the flag changes which VALUES
     are looked up (names, holders, tiers), never how many rnd() draws are
     taken or in what order, so the stream discipline this file is built on
     holds across both versions with one generator. */
  const v2 = gxv >= 2;
  /* Campaign order rotation: universe index u renders at campaign tier
     (u - uHome + 5) % 5, so every faction opens at its own home and the
     universe itself never moves. */
  const uHome = Math.max(0, GX_UNIVERSE_ORDER.indexOf(playerFaction));
  const campTier = u => (u - uHome + GX_UNIVERSE_ORDER.length) % GX_UNIVERSE_ORDER.length;
  const KW = KIND_WEIGHTS[kindsW] || KIND_WEIGHTS[1];
  const rnd = galaxyRng(seed);
  const rivals = rivalFactionsOf(playerFaction);
  /* WHO SQUATS the ordinary worlds. Naming the pirates outright put a fifth
     of a PIRATE player’s galaxy under their own banner and marched them into
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
       -- while a system’s STORED y is generation space, which the renderer
       squashes again on the way out. Converting here rather than in the table
       keeps the table readable against GX_WORLD, which is the one rectangle
       the slots have to fit inside. Nothing draws from rnd() in this
       conversion, so no saved campaign’s maps, arenas or boons move. */
    const cx = slot[0], cy = slot[1] / GX_RENDER_SQUASH;

    /* Each system is dominated by one enemy power, which supplies its
       commander. v1 cycles the player's rivals; v2 reads the authored
       politics of the one universe (GX_V2_HOLDER), where si IS the universe
       index because v2 generates the homes in universe order. */
    const holder = v2
      ? GX_V2_HOLDER[GX_UNIVERSE_ORDER[si]][playerFaction] || rivals[si % rivals.length]
      : rivals[si % rivals.length];
    const pool = commandersOf(holder);
    const boss = pool[Math.floor(rnd() * pool.length)];

    const worlds = [];
    for (let wi = 0; wi < WORLDS_PER_SYSTEM; wi++) {
      /* Even angular spacing with a per-system phase, and two alternating
         orbit radii. The old random angle+radius let pairs land on top of each
         other, which is what made the map read as a clump of bubbles. */
      /* MEASURED (Session 16): worlds were overlapping, minimum centre-to-
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
      /* The last world of a system is the holding commander’s own seat. */
      const isSeat = wi === WORLDS_PER_SYSTEM - 1;
      const kinds = Object.values(WORLD_KINDS);
      let roll = rnd() * kinds.reduce((a, k) => a + KW[k.id], 0);
      let kind = kinds[0];
      for (const k of kinds) { roll -= KW[k.id]; if (roll <= 0) { kind = k; break; } }

      /* Hoisted so the boon draw can read the same two values the world
         is built from. The owner roll is unchanged and still the first
         rnd() call of this world -- only its line moved. */
      const worldOwner = isSeat ? holder : (rnd() < 0.2 ? raider : holder);
      const kindId = isSeat ? 'fortress' : kind.id;

      worlds.push({
        id: 's' + si + 'w' + wi,
        /* Canon 2029: real names, index-derived exactly as before, zero
           draws. The numeral suffix went with the invented names: MARS is
           not MARS X, and TRAPPIST-1e is already a real designation. */
        name: v2 ? GX_HOME_SYSTEMS[GX_UNIVERSE_ORDER[si]].worlds[wi % 7]
                : gxWorldName(playerFaction, seed, si, wi),
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
           is identical for every profile and no saved galaxy’s maps, arenas
           or boons move. */
        owner: worldOwner,
        /* Three-way maps are reserved for CONTESTED worlds only. */
        /* Drawn from the PREFIX the campaign pinned at creation (c.mapPool),
           because the modulus is the save contract: adding maps without the
           pin remaps every saved galaxy’s boards even though not one rnd()
           draw moves. Clamped, so a newer save on an older build falls back
           to everything rather than throwing. One rnd() call, same position,
           as ever. */
        /* THEMED POOL: each system favours a family set (GX_THEMES below), so
           the campaign's boards read as places, not random rolls. The filter
           is DERIVED from si, it draws nothing from rnd(), and for pinned old
           saves (mapPool <= 11, all authored maps) the themed pool always falls
           back to the full eligible set, so their boards stay byte-identical. */
        map: (() => { const elig = MAPS.filter(m => !m.tri && (!m.minTier || m.minTier <= si));
                      const th = GX_THEMES[si % GX_THEMES.length];
                      /* THE AUTHORED BOARDS STAY IN THE DRAW. A themed pool
                         of `th.families` alone is procedural-only, because the
                         twenty-one hand-made maps carry no `family` at all: the
                         moment the tiers were fixed so themes stopped falling
                         back, every authored board would have vanished from
                         every campaign. The theme still decides which
                         PROCEDURAL ground a system is made of; the authored
                         maps ride alongside it as the backbone they have always
                         been. */
                      const themed = elig.filter(m => m.family && th.families.indexOf(m.family) >= 0);
                      const plain  = elig.filter(m => !m.family);
                      let pool = [], weighted = false;
                      if (mapPool > 11 && themed.length && plain.length) {
                        /* WEIGHTED, or the theme never reads. Four themed
                           families against twenty-one authored boards is a 16%
                           chance of themed ground per world (measured over 40
                           galaxies, 1000 worlds), so a system labelled WALLED
                           GROUND fielded roughly one walled board in five and
                           the label was decoration. The themed families are
                           repeated until they are about half the draw. */
                        const reps = Math.max(1, Math.round(plain.length / themed.length));
                        for (let r = 0; r < reps; r++) pool = pool.concat(themed);
                        pool = pool.concat(plain);
                        weighted = true;
                      }
                      if (!pool.length) pool = elig;      // theme empty at this tier: any eligible map
                      /* The mapPool PREFIX CAP is a save-compatibility device
                         for the old unthemed path, where `pool` really is a
                         prefix of MAPS. A weighted pool is not a prefix of
                         anything, and capping it to mapPool would silently
                         make the tail undrawable, so the cap applies only to
                         the legacy path that needs it. */
                      const n2 = weighted ? pool.length
                               : ((mapPool >= 1 && mapPool <= pool.length) ? mapPool : pool.length);
                      return pool[Math.floor(rnd() * n2)].id; })(),
        arena: rnd() < 0.55 ? ARENA_MODS[Math.floor(rnd() * ARENA_MODS.length)].id : null,
        /* Still exactly ONE rnd() call, in the same position: boonFor
           takes the VALUE, never the generator. */
        boon: boonFor(worldOwner, kindId, false, rnd()).id,
        tier: v2 ? campTier(si) : si,
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
       every later world’s roll. */
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
           holder’s APEX boon -- the only place those five are reachable.
           Deterministic like the rest of this block: taking a roll here
           would shift every later world’s stream. */
        w.boon = boonFor(w.owner, w.kind, true, 0).id;
      });
    }

    /* THE RENEGADE WORLD, one per system, and the only place your OWN power’s
       five boons can be taken.
       ────────────────────────────────────────────────────────────────────
       Until now they could not be taken at all. `rivals` excludes you by
       construction (rivalFactionsOf), every world owner is drawn from it or
       from `raider`, and boonFor filters `b.f === owner`, so playing human,
       the five human boons were dead data in every galaxy ever generated.
       Five of the TWENTY (four powers, five each), unreachable by
       construction rather than by design.

       A splinter of your own power holds this one and will not stand down.
       Taking it back is how you carry your own power’s advantage forward, and
       it is deliberately the one place your OWN soldiers march against you
       which is why `renegade` is an explicit flag and not merely
       `owner === playerFaction`. battleHostFaction spent a whole session
       driving accidental own-troop garrisons from 15.3% to 0.0%, and this must
       read as the exception that proves that rule rather than as its return.

       NOT ONE NEW rnd() CALL. The slot is derived from the system index
       exactly as the contested block above derives its two, because
       galaxy.js’s standing rule is that the draw sequence must never move or
       every saved galaxy’s maps, arenas and boons shift underneath its owner.
       Measured over 4 powers x 40 seeds: every non-renegade field is
       byte-identical. */
    {
      /* THE PARALLEL HOLDS NO WORLDS AND OWNS NO BOONS. BOONS has twenty
         entries across the four powers that fight over the galaxy and none
         for the machines, so a renegade world on a Parallel profile would pay
         a fallback boon belonging to somebody else, and worldBossOf would
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
        /* THE BOON KEY IS NOT THE WORLD’S KIND, and that distinction is the
           whole of O1 being delivered rather than merely attempted.

           Reading the world’s own rolled kind looked right and is not: the
           kinds are weighted (standard 58, fortress 16, forge 12, nest 14),
           so four independent draws land all four kind-keyed boons in only
           about 4% of galaxies. 2.3 of 4 on average. Five own boons would
           have been "reachable" in the sense that a long enough sequence of
           runs eventually shows them, which is not what was asked for.

           Cycling the key by system index pays a DIFFERENT one of the four in
           every galaxy, and the last system pays the APEX, so all five are
           reachable in every single run. The world’s own `kind` is left
           untouched: it is the world’s identity, it drives the briefing card
           and the garrison rules, and a fortress that calls itself a forge to
           move a boon would be a lie on the card to save a line here. */
        const rsi = v2 ? campTier(si) : si;
        const bk = RENEGADE_BOON_KINDS[rsi % RENEGADE_BOON_KINDS.length];
        const apex = rsi === SYSTEMS_PER_GALAXY - 1;
        w.boon = boonFor(playerFaction, apex ? w.kind : bk, apex, 0).id;
      }
    }

    systems.push({
      id: 'sys' + si, index: si,
      name: v2 ? GX_HOME_SYSTEMS[GX_UNIVERSE_ORDER[si]].name
               : gxSystemName(playerFaction, seed, si),
      home: v2 ? GX_UNIVERSE_ORDER[si] : undefined,
      x: cx, y: cy, holder, boss: boss.id, worlds
    });
  }
  if (v2) {
    /* Rotate the ARRAY into campaign order and relabel index/si to match,
       while ids and coordinates keep their universe identity: 's2w4' is the
       same world with the same name at the same screen slot in every
       faction's campaign, which is what makes authored per-planet content
       possible at all. Ids are what saves and cutscene keys hold; index and
       si are what progression walks. Nothing here draws from rnd(), so the
       stream fingerprint is untouched. */
    systems.sort((p, q) => campTier(p.index) - campTier(q.index));
    systems.forEach((sys, pos) => {
      sys.index = pos;
      for (const w of sys.worlds) { w.si = pos; w.tier = pos; }
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
        its ORDINARY worlds and every world’s GX_ROUTE_NEAR_K nearest
        neighbours. The tree is what guarantees no orphan; the nearest pass is
        what guarantees at least two ways out of every world, because a world
        contributes K edges of its own before anybody else’s are counted.

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

/** An ORDINARY world: neither a commander’s seat nor a three-way war. Only
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
     count twice toward a world’s degree -- an inflated degree is exactly the
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
       again -- nothing consulted it, and an unread key is this project’s
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
/* `galaxy` is optional for compatibility, and it is the whole of item 8:
   without it a GATEWAY link to the next system is a line the map draws and
   the unlock rule cannot see, which is exactly the "trailing lines to
   planets I cannot travel to" the owner reported. With it, every link the
   map draws is a link the rules honour. */
function routeNeighbours(system, world, galaxy) {
  const out = [];
  if (!world || !world.links) return out;
  for (const id of world.links) {
    let n = system.worlds.find(w => w.id === id);
    if (!n && galaxy)
      for (const sys of galaxy.systems) {
        n = sys.worlds.find(w => w.id === id);
        if (n) break;
      }
    if (n) out.push(n);
  }
  return out;
}

/**
 * Who actually commands THIS world. A system’s boss holds the SYSTEM, but a
 * world taken out from under them is commanded by whoever took it -- and
 * shipping `sys.boss` regardless paired a holder’s commander with a
 * squatter’s banner on about one battle in seven, so a Federation commander
 * fought under a pirate crest and collected the pirate economy bonus.
 *
 * Index-derived rather than drawn from rnd(): stable for a seed, and it costs
 * the galaxy stream nothing, so no existing campaign’s layout moves.
 */
function worldBossOf(sys, w) {
  if (!w || w.owner === sys.holder) return sys.boss;
  const pool = commandersOf(w.owner);
  return pool.length
    ? pool[(w.si * WORLDS_PER_SYSTEM + w.wi) % pool.length].id
    : sys.boss;
}

/**
 * Which SCENARIO this world runs.
 *
 * Index-derived from the same expression worldBossOf and worldGrantsUnit use,
 * so it is stable for a seed, survives a reload, agrees on both clients of a
 * duel, and costs the galaxy PRNG stream nothing. Every saved campaign keeps
 * its exact layout when this dial moves.
 *
 * The standing duel is the default and the overwhelming majority. One world in
 * SCENARIO_VARIANT_EVERY runs a variant, and WHICH variant is the same index
 * folded across the non-duel entries, so the two variants alternate rather
 * than clumping.
 */
function worldScenarioOf(w) {
  if (!w) return SCENARIOS[0];
  const i = w.si * WORLDS_PER_SYSTEM + w.wi;
  if (i % SCENARIO_VARIANT_EVERY !== 0) return SCENARIOS[0];
  /* A seat is the system's boss fight and is always the duel: a commander seat
     that could not be taken by beating its commander would strand the system. */
  if (w.seat) return SCENARIOS[0];
  const variants = SCENARIOS.length - 1;
  if (variants < 1) return SCENARIOS[0];
  return SCENARIOS[1 + ((i / SCENARIO_VARIANT_EVERY) | 0) % variants];
}

/**
 * Which scenario a world that is ALREADY YOURS runs (owner, Session 33).
 *
 * Returns null for the overwhelming majority of calls -- any world that is
 * neither renegade nor already conquered -- so every existing caller of
 * worldScenarioOf keeps calling it exactly as before, through the one-line
 * `ownedWorldScenarioOf(w, progress) || worldScenarioOf(w)` pattern used at
 * every call site this was added to (js/ui.js worldBriefing, js/game.js
 * Game.start and endMatch's ratingFor call). One resolver, three readers:
 * the preview card, the battle that runs, and the stars it is scored
 * against cannot disagree about which scenario a world is running, which is
 * the exact failure class this project's own gxRoutes comment warns about
 * ("a fourth definition ... is how a line comes to promise a world the
 * rules refuse").
 *
 * Index-derived, same as worldScenarioOf: WHICH revisit variant a conquered
 * world gets is w.si*WORLDS_PER_SYSTEM+w.wi modulo the pool size, never a
 * fresh draw, so this cannot move the galaxy PRNG stream and a saved
 * campaign's revisit assignments do not shuffle on reload.
 */
function ownedWorldScenarioOf(w, progress) {
  if (!w || w.seat) return null;
  /* Renegade is a property of the WORLD, stamped at generation
     (galaxy.js:299), true from the first approach -- never a revisit. */
  if (w.renegade) return (typeof RENEGADE_HUNT !== 'undefined') ? RENEGADE_HUNT : null;
  /* A genuine revisit: three-starred, which is the same rule mine and
     isConquered already use everywhere else in this file. */
  if (isConquered(progress, w.id)) {
    const pool = (typeof OWNED_REVISIT_SCENARIOS !== 'undefined') ? OWNED_REVISIT_SCENARIOS : [];
    if (!pool.length) return null;
    const i = w.si * WORLDS_PER_SYSTEM + w.wi;
    return pool[i % pool.length];
  }
  return null;
}

/**
 * Does this world pay a SOLDIER, or only progress and a boon?
 *
 * One world in UNIT_REWARD_EVERY does. Index-derived from exactly the same
 * expression worldBossOf uses, for exactly the same reason: it is stable for a
 * seed, it survives a reload, and it costs the galaxy stream nothing, so no
 * saved campaign’s layout moves when the cadence changes.
 *
 * Deliberately NOT a property stamped on the world at generation time. A
 * stamped flag would have to be migrated into every existing save; a derived
 * one is simply true the next time it is asked.
 */
function worldGrantsUnit(w) {
  if (!w) return false;
  return ((w.si * WORLDS_PER_SYSTEM + w.wi) % UNIT_REWARD_EVERY) === 0;
}

/* --------------------------------------------------------------------------
   STATE QUERIES  (progress is stored separately, as id -> stars)
-------------------------------------------------------------------------- */

/** Stars earned on a world, 0-3. */
function starsOn(progress, worldId) { return (progress && progress[worldId]) || 0; }
/** A world is CONQUERED at three stars, that is what transfers territory. */
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
function isWorldOpen(system, world, progress, galaxy) {
  if (world.seat) return systemProgress(system, progress).seatOpen;
  if (world.entry && system.index === 0) return true;
  /* A gateway ENTRY world in a later system is only a free door once its
     system is reachable at all; inside system 0 it is landfall and always
     open. Reached gateways are covered by the neighbour rule below, which
     now sees across systems. */
  const near = routeNeighbours(system, world, galaxy);
  /* A galaxy assembled by something other than generateGalaxy -- a harness, a
     future editor -- has no graph to read. Falling back to the old linear rule
     keeps such a galaxy playable; sealing it would be a blank map. */
  if (!near.length)
    return world.wi === 0 ||
           starsOn(progress, system.worlds[world.wi - 1].id) > 0;
  return near.some(n => starsOn(progress, n.id) > 0);
}

/** A system is open once the previous system’s seat has fallen. */
function isSystemOpen(galaxy, system, progress) {
  if (system.index === 0) return true;
  /* TWO doors now, either opens the system (owner, Session 26): the seat of
     the previous system falls, as it always has, OR a world in THIS system
     sits at the far end of a drawn route from a world you have conquered.
     Beating the planet on the line lets you travel the line. */
  const prev = galaxy.systems[system.index - 1];
  if (isConquered(progress, prev.worlds[prev.worlds.length - 1].id)) return true;
  for (const w of system.worlds)
    for (const n of routeNeighbours(system, w, galaxy))
      if (n.si !== system.index && isConquered(progress, n.id)) return true;
  return false;
}

/* --------------------------------------------------------------------------
   ALLEGIANCE -- what a world READS as

   A campaign is a record of who holds what, and until Session 20 the map that
   exists to show it said almost none of it: a world painted in its ORIGINAL
   power’s colour whatever you had done to it, and the only trace of a conquest
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
   generation’s x-clamp, and a mark that outgrew it would start dragging worlds
   back off their own orbits. */
const GX_CLAIM_RING_PAD = 1.15;

/* Where the claim sigil sits, as fractions of the world radius: the offset of
   its centre from the world’s, then its own radius. Fractions rather than
   absolutes so a seat and an ordinary world wear the same badge at their own
   scale and neither one crosses its claim ring. */
const GX_SIGIL_OFF = 0.62, GX_SIGIL_R = 0.46;

/* One word per state, for the node’s accessible name. The map has to say in
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
  /* A world you have played is open under today’s unlock rule, so LOCKED
     cannot currently hide a claim in progress. Ordered anyway, rather than
     assumed, so a future unlock rule cannot silently grey out your own work. */
  const open = isSystemOpen(galaxy, system, progress) &&
               isWorldOpen(system, world, progress, galaxy);
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

/** The state in words, for the node’s accessible name and the map key. */
function allegianceLabel(al) {
  return GX_STATE_LABEL[al && al.state] || GX_STATE_LABEL.held;
}

/**
 * Star rating for a finished battle. Three stars is a clean take: you won, and
 * you did it without giving up much ground.
 */
function ratingFor(won, livesLeft, maxLives, wave, world, progress) {
  const r = { won: !!won, kept: livesLeft / Math.max(1, maxLives), wave: wave || 0 };
  /* THE SCENARIO DECIDES, not this function. Passing `world` is optional so
     every existing caller keeps the duel ladder it already had; a caller that
     knows the world gets that world's conditions instead. One test function
     per scenario means a new win condition is data, never a branch here.
     ownedWorldScenarioOf first (owner, Session 33), same fallback pattern as
     Game.start and worldBriefing: the battle that ran and the stars it is
     scored against must be the SAME resolved scenario, or a revisit could be
     played as SWARM DEFENSE and scored as the standing duel. `progress` is
     optional too, and a caller that omits it simply never matches the
     ownedWorldScenarioOf branch, falling through to worldScenarioOf exactly
     as before this was added. */
  const sc = (world && typeof worldScenarioOf === 'function')
    ? ((typeof ownedWorldScenarioOf === 'function' && ownedWorldScenarioOf(world, progress)) || worldScenarioOf(world))
    : (typeof SCENARIOS !== 'undefined' ? SCENARIOS[0] : null);
  if (sc && typeof sc.test === 'function') return sc.test(r);
  if (!r.won) return 0;
  if (r.kept >= 0.9) return 3;
  if (r.kept >= 0.55) return 2;
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
  /* The player’s own banner may not be one of the galaxy’s four powers -- THE
     PARALLEL holds no worlds and so is absent from FACTION_ORDER. Without a
     slot of its own the first conquest increments `undefined` and every
     holdings figure on the screen becomes NaN. */
  out[galaxy.playerFaction] = out[galaxy.playerFaction] || 0;
  /* A RENEGADE world is held by a SPLINTER of your own power. Two different
     questions get asked about it and they have two different answers, so this
     returns both rather than picking one:

       out[f]        POLITICAL tally. What that faction holds as a power. A
                     renegade world flies your banner, so it counts here for
                     the player’s faction. This is what the ownership bar draws.
       out.conquered What YOU actually took. A renegade world is NOT yours
                     until you beat it, so it is excluded here. This is what
                     the "N / total worlds held" line reports.
       out.renegade  The splinter’s own count, kept so the split can be shown.

     OWNER-SET (Session 29): the previous build kept renegade worlds out of
     every faction bucket entirely, which meant the ownership bar showed your
     power holding less ground than it really did. Counting them politically is
     the fix; keeping `conquered` separate is what stops that fix from
     re-introducing the "12 / 35 on a fresh galaxy" lie the old comment warned
     about. */
  out.renegade = 0;
  out.conquered = 0;
  for (const sys of galaxy.systems)
    for (const w of sys.worlds) {
      if (isConquered(progress, w.id)) { out[galaxy.playerFaction]++; out.conquered++; continue; }
      if (w.renegade) { out.renegade++; out[galaxy.playerFaction]++; continue; }
      out[w.owner]++;
    }
  return out;
}

/**
 * Rival commanders expand on their own while you are busy. Each time you finish
 * a battle, every rival that still holds a seat takes one contested world
 * somewhere in the galaxy, so leaving a system alone has a cost.
 */
function advanceRivals(galaxy, progress, rnd) {
  const moves = [];
  /* The same substitution generateGalaxy made. Naming the pirates here left a
     PIRATE player’s rivals with no worlds to expand into at all, so they
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
       straight back. World NAMES can repeat across galaxies (the canon-2029
       star pool is finite, and Sol's worlds appear in more than one campaign);
       the id does not. */
    moves.push({ system: sys.name, world: t.name, worldId: t.id,
                 faction: sys.holder });
  }
  return moves;
}
