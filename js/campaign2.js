/* campaign2.js. THE THREE-ACT CAMPAIGN, AS DATA.
 *
 * Owner directive, Session 46 (design: docs/CAMPAIGN-REWORK.md). The campaign
 * stops being "five systems of seven worlds, one battle each" and becomes a
 * three-level hierarchy:
 *
 *     ACT (a star system)  ->  PLANET (5 to 7 per act)  ->  LOCATION (1 to 9)
 *
 * A location is one battle on one board. A planet is taken when its locations
 * are, and the last location of a planet is its WHOLE-BODY battle: the
 * planetary fight the smaller ones were rehearsals for. That last rung is what
 * the eventual 3D port turns into a single continuous globe, so the split
 * between "locations" and "the whole planet" is deliberate structure, not a
 * menu convenience.
 *
 * NOT WIRED INTO THE ENGINE YET, ON PURPOSE. js/galaxy.js still generates the
 * five-system galaxy the live game plays, and this module is pure data with no
 * readers in the simulation. It lands first, and alone, because the engine
 * change behind it is a save migration (campaign progress is keyed 's<si>w<wi>'
 * against a galaxy rebuilt from a seed) and because the content it specifies,
 * about thirty new boards, is a scheduling problem the owner asked to see laid
 * out before it is built. tools/probe-campaign2.js holds this table to its own
 * rules so it cannot rot while it waits.
 *
 * THREE SYSTEMS, FIVE POWERS. The acts are Sol, Proxima Centauri and Zeta
 * Reticuli, and every power's campaign visits all three in its own order
 * (CAMPAIGN_ORDER below). That is a consolidation from five home systems: the
 * Federation and the Vigil now share Proxima, the Xeno and the Pirates share
 * Zeta. The Pleiades and Sirius stop being campaign systems and demote to
 * bonus systems, exactly as Barnard's Star and Tabby's Star already did, so
 * the canon keeps its edges. NOTHING AUTHORED IS LOST: their fourteen
 * handcrafted boards are re-parented here as location boards inside Act 2,
 * which is why Act 2 needs no new geometry at all.
 *
 * `board` on a location is a live MAPS id where an authored board already
 * fits, or null where one has to be built. A null is a work item, counted by
 * the probe and scheduled in docs/CAMPAIGN-REWORK.md; it is never a silent
 * hole.
 */

/* Locations that seat more than two commanders at once. The owner asked for
   these by name (the Tri-City line, the global finale, the act closers), and
   they are marked here rather than inferred so the board work knows which
   geometry has to be three-way or wider before anybody draws it. */
const CAMPAIGN_MULTI = 'multi';

const CAMPAIGN_ACTS = [

  /* ══════════════════════════════════════════════════ ACT: SOL ═══
     Humanity's home and, in every other power's campaign, the middle act.
     The longest act in the game because it is the one that teaches it. */
  {
    id: 'sol', name: 'THE EARTH SYSTEM', hosts: ['human'],
    premise: 'The rock came apart over Earth and it was hollow. Everything after is the answer to that.',
    planets: [

      {
        id: 'earth', name: 'EARTH',
        premise: 'One world, defended a piece at a time, until the pieces are one fight.',
        locations: [
          { id: 'long-island', name: 'LONG ISLAND', board: null, challenge: 'teaching',
            brief: 'Northrop Grumman ran its defence programs here for a century. The experimental logistics line leaked radium, and the leak did two things: it gave people cancer, and in the few who adapted it opened something nobody had a name for. The first protagonist is from here, and so is the first psychic.' },
          { id: 'nyc', name: 'NEW YORK CITY', board: 'w_earth', challenge: 'standard',
            brief: 'The continent’s anti-air and anti-space battery. Mayor Swambhani, Swami to a city that had already watched him unite it, will not leave until it is safe, which is the whole problem with defending it.' },
          { id: 'dc', name: 'WASHINGTON D.C.', board: null, challenge: 'standard',
            brief: 'Ronald Dump calls Swami in for help. They agree on nothing and share one enemy, and the act of holding the capital together is the argument neither of them wins.' },
          { id: 'tri-city', name: 'THE TRI-CITY LINE', board: null, challenge: 'demanding', seats: CAMPAIGN_MULTI,
            brief: 'Los Angeles, the Texas triangle and Miami, defended at the same time by separate commanders. The first battle the player cannot personally be everywhere in.' },
          /* ALL SEVEN CONTINENTS (owner call, Session 46). The four city
             fights above are North American ground at street scale; the seven
             below are the planet at continental scale, each one a front with
             its own major countries as the points that have to hold. Seven
             plus the four cities plus the globe is twelve battles on Earth,
             which is deliberate: Earth is the act that teaches the game and
             the only body the whole campaign returns to. */
          { id: 'north-america', name: 'NORTH AMERICA', board: null, challenge: 'standard',
            brief: 'The continent behind the cities already held: the Canadian north, the Mexican corridor, and an interior nobody thought would need fortifying because the coasts were supposed to hold.' },
          { id: 'south-america', name: 'SOUTH AMERICA', board: null, challenge: 'demanding',
            brief: 'The Andes spine on one side and the basin on the other, with the major capitals as the points that have to hold and no straight road between any two of them.' },
          { id: 'europe', name: 'EUROPE', board: null, challenge: 'demanding',
            brief: 'Dense, old and impossible to give ground in: every point lost is somebody’s capital, and the distances are short enough that losing one puts you inside the next.' },
          { id: 'africa', name: 'AFRICA', board: null, challenge: 'demanding',
            brief: 'The widest front on the planet and the one with the most ways in: a board that punishes a line built to face one direction.' },
          { id: 'asia', name: 'ASIA', board: null, challenge: 'punishing',
            brief: 'The largest landmass and half the planet’s people, fought from the steppe to the coast. The only continent where the reinforcement problem is worse than the terrain.' },
          { id: 'oceania', name: 'OCEANIA', board: null, challenge: 'punishing',
            brief: 'Australia and an ocean of islands nobody can fortify at once. Everything here is a decision about which piece of water you are prepared to lose.' },
          { id: 'antarctica', name: 'ANTARCTICA', board: null, challenge: 'punishing',
            brief: 'Ice, a handful of stations, and the reason every power sent a survey team in the first place. The last continent, and the one that explains the others.' },
          { id: 'global', name: 'EARTH: GLOBAL WARFARE', board: null, whole: true, challenge: 'brutal', seats: CAMPAIGN_MULTI,
            brief: 'Every front at once, every surviving commander in play. The whole planet as one battle, and the shape the 3D port turns into a globe.' }
        ]
      },

      {
        id: 'luna', name: 'LUNA',
        premise: 'The base was ours, then it was not, and what took it was already living there.',
        locations: [
          { id: 'lunar-base', name: 'THE LUNAR BASE', board: 'w_luna', challenge: 'standard',
            brief: 'Reclaiming a base established, occupied and then abandoned when the local life proved to be neither local nor life in any sense the survey used.' },
          { id: 'whole-moon', name: 'THE WHOLE MOON', board: null, whole: true, challenge: 'demanding',
            brief: 'Taking the Moon entire. What is found here is what makes Mars reachable.' }
        ]
      },

      {
        id: 'mars', name: 'MARS',
        premise: 'Arrived badly, fought uphill, took the highest ground in the solar system.',
        locations: [
          { id: 'crash-landing', name: 'CRASH LANDING', board: null, challenge: 'standard',
            brief: 'Open ground, no prepared position, and a landing that did not go to plan: the first fight fought from wherever the hull stopped.' },
          { id: 'the-canyon', name: 'THE GREAT RIFT', board: 'w_mars', challenge: 'demanding',
            brief: 'Valles Marineris. Switchbacks between cliffs that stop everything but a shell with the sense to arc.' },
          { id: 'king-of-the-hill', name: 'OLYMPUS MONS', board: null, challenge: 'punishing',
            brief: 'The largest mountain in the solar system, held from the top down. King of the hill, where the hill is twenty-two kilometres tall.' },
          { id: 'whole-mars', name: 'THE WHOLE OF MARS', board: null, whole: true, challenge: 'punishing',
            brief: 'The planetary battle: every rift, plain and summit at once.' }
        ]
      },

      {
        id: 'venus', name: 'VENUS',
        premise: 'The only survivable ground is above the weather, and the weather is trying.',
        locations: [
          { id: 'sky-battle', name: 'THE PEAKS ABOVE THE CLOUD', board: 'w_venus', challenge: 'demanding',
            brief: 'Mountain tops breaking through the cloud deck, fought between summits with nothing underneath worth landing on.' },
          { id: 'acid-lakes', name: 'THE ACID LAKES', board: null, challenge: 'punishing',
            brief: 'Ground that dissolves what stands on it. Position is temporary here in a way it is nowhere else.' },
          { id: 'whole-venus', name: 'THE WHOLE OF VENUS', board: null, whole: true, challenge: 'punishing',
            brief: 'The planetary battle, fought at ninety atmospheres.' }
        ]
      },

      /* MERCURY IS BONUS CONTENT (owner call, Session 46), not an act planet.
         It keeps its authored board and its entry in CAMPAIGN_BONUS below. */

      {
        id: 'jupiter', name: 'JUPITER',
        premise: 'There is no ground. There is only what you are standing on at the time.',
        locations: [
          { id: 'space-battle', name: 'HIGH ORBIT', board: null, challenge: 'demanding',
            brief: 'Fought above the atmosphere entirely: no terrain, no cover, and everything moving.' },
          { id: 'floating-debris', name: 'THE DEBRIS FIELD', board: 'w_jupiter', challenge: 'demanding',
            brief: 'Platforms and wreckage riding the cloud tops. What falls between the decks does not land anywhere.' },
          { id: 'eye-of-the-storm', name: 'THE EYE AND THE MOUNTAINS', board: null, challenge: 'punishing',
            brief: 'The storm’s eye, and the impossible mountains standing inside it that have no business existing.' },
          { id: 'whole-jupiter', name: 'THE WHOLE OF JUPITER', board: null, whole: true, challenge: 'brutal',
            brief: 'The planetary battle across a body three hundred Earths heavy.' }
        ]
      },

      {
        id: 'saturn', name: 'SATURN',
        premise: 'The rings, the lakes, and the thing at the north pole nobody built.',
        locations: [
          { id: 'around-the-rings', name: 'AROUND THE RINGS', board: 'w_saturn', challenge: 'demanding',
            brief: 'A ring arc a kilometre thin and a planet wide, held shape by shepherd moons and, now, by whoever wins here.' },
          { id: 'saturn-acid-lake', name: 'THE ACID LAKE', board: null, challenge: 'punishing',
            brief: 'A lake that is not water and not on any survey, fought around rather than across.' },
          { id: 'north-pole', name: 'THE NORTH POLE FACILITY', board: null, challenge: 'brutal',
            brief: 'Canyons and permanent storm around a facility with summoning circles cut into the floor and pyramids that predate the survey that found them. The door under Saturn is here.' },
          { id: 'whole-saturn', name: 'THE WHOLE OF SATURN', board: null, whole: true, challenge: 'brutal', seats: CAMPAIGN_MULTI,
            brief: 'The act finale. The planetary battle, and the last ground before the system is decided.' }
        ]
      }
    ]
  },

  /* ═══════════════════════════════════════ ACT: PROXIMA CENTAURI ═══
     Home of the Galactic Federation AND the Vigil, who share a system and
     agree on very little about it. Needs no new geometry: the re-parented
     Pleiades and Sirius boards carry it. */
  {
    id: 'proxima', name: 'PROXIMA CENTAURI', hosts: ['light', 'robot'],
    premise: 'The closest star to home, holding two powers who both believe they are the reason it is still standing.',
    planets: [

      {
        id: 'proxima-d', name: 'PROXIMA d',
        premise: 'The inner world, and the first thing anybody arriving has to survive.',
        locations: [
          { id: 'scorch-line', name: 'THE SCORCH LINE', board: 'w_proxd', challenge: 'punishing',
            brief: 'A terminator band thinner than Mercury’s, on a star that flares without warning.' },
          { id: 'whole-proxd', name: 'THE WHOLE OF PROXIMA d', board: 'w_sira1', whole: true, challenge: 'demanding',
            brief: 'The planetary battle, fought between flares.' }
        ]
      },
      {
        id: 'proxima-b', name: 'PROXIMA b',
        premise: 'The habitable world, and therefore the one worth the most argument.',
        locations: [
          { id: 'the-first-port', name: 'THE FIRST PORT', board: 'w_proxb', challenge: 'standard',
            brief: 'The first harbour out of Sol, built by whoever got there first and administered by whoever got there second.' },
          { id: 'the-light-plain', name: 'THE LIGHT PLAIN', board: 'w_maia', challenge: 'standard',
            brief: 'Federation assembly ground: the widest sky in the act, and nothing on it to hide behind.' },
          { id: 'the-shrine-terraces', name: 'THE SHRINE TERRACES', board: 'w_electra', challenge: 'standard',
            brief: 'Terraces stepping down a shelf, each shrine sheltering only the step below it.' },
          { id: 'whole-proxb', name: 'THE WHOLE OF PROXIMA b', board: 'w_alcyone', whole: true, challenge: 'demanding',
            brief: 'The planetary battle, decided in the sanctum plaza that watches every approach.' }
        ]
      },
      {
        id: 'proxima-c', name: 'PROXIMA c',
        premise: 'Cold, outer, and where the Vigil does its manufacturing.',
        locations: [
          { id: 'the-wreck-yards', name: 'THE WRECK YARDS', board: 'w_proxc', challenge: 'standard',
            brief: 'Hulls from a hundred builders, cut into lanes somebody already measured.' },
          { id: 'the-assembly-rows', name: 'THE ASSEMBLY ROWS', board: 'w_sira2', challenge: 'standard',
            brief: 'One fenced production run that does not stop for casualties, yours or its own.' },
          { id: 'whole-proxc', name: 'THE WHOLE OF PROXIMA c', board: 'w_ash', whole: true, challenge: 'demanding',
            brief: 'The planetary battle across drifts of what a dead star shed.' }
        ]
      },
      {
        id: 'the-flare-shelter', name: 'THE FLARE SHELTER',
        premise: 'A moon-sized bunker, because the star made one necessary.',
        locations: [
          { id: 'the-shelter-door', name: 'THE SHELTER DOOR', board: 'w_flare', challenge: 'demanding',
            brief: 'Every road converges on one door, and whoever holds it decides who waits out the flare outside.' },
          { id: 'the-dark-locker', name: 'THE DARK LOCKER', board: 'w_locker', challenge: 'punishing',
            brief: 'The vault on the side the star cannot reach, where half the inventory was never logged in.' }
        ]
      },
      {
        id: 'toliman', name: 'TOLIMAN',
        premise: 'Alpha Centauri B. The Vigil keeps its records and its forge here.',
        locations: [
          { id: 'the-archive-vaults', name: 'THE ARCHIVE VAULTS', board: 'w_celaeno', challenge: 'punishing',
            brief: 'Stacks dense enough to stop a shot, arranged so no vantage reads two aisles.' },
          { id: 'the-collapse-forge', name: 'THE COLLAPSE FORGE', board: 'w_sirb1', challenge: 'demanding',
            brief: 'A forge core walled on every face, with doors exactly where the road needs them and no wider.' },
          { id: 'whole-toliman', name: 'THE WHOLE OF TOLIMAN', board: 'w_diamond', whole: true, challenge: 'punishing',
            brief: 'The planetary battle, climbing terraces of crystallised carbon that blind every step from the one below.' }
        ]
      },
      {
        id: 'rigil-kentaurus', name: 'RIGIL KENTAURUS',
        premise: 'Alpha Centauri A, and the seat both powers claim. The act ends here.',
        locations: [
          { id: 'the-lightning-nurseries', name: 'THE LIGHTNING NURSERIES', board: 'w_sterope', challenge: 'standard',
            brief: 'Storm cells cultured between insulated posts, on ground where the posts are the only things that do not conduct.' },
          { id: 'the-choral-halls', name: 'THE CHORAL HALLS', board: 'w_taygeta', challenge: 'demanding',
            brief: 'Two halls that share only a door, so a defence written for one is absent from the other.' },
          { id: 'the-long-orbit', name: 'THE LONG ORBIT', board: 'w_companion', challenge: 'demanding',
            brief: 'One road spiralling inward, crossing its own past once per revolution.' },
          { id: 'whole-rigil', name: 'THE HALL OF STANDING ORDERS', board: 'w_dogstar', whole: true, challenge: 'brutal', seats: CAMPAIGN_MULTI,
            brief: 'The act finale. The hall every standing order comes from, where the desks are in perfect order and the chairs have never been occupied.' }
        ]
      }
    ]
  },

  /* ══════════════════════════════════════ ACT: ZETA RETICULI ═══
     Home of the Xeno compact and the Free Captains, who are not allies and
     are not strangers either. */
  {
    id: 'zeta', name: 'ZETA RETICULI', hosts: ['xeno', 'pirate'],
    premise: 'A binary pair, a compact that counts everything, and the captains who move what it counts.',
    planets: [

      {
        id: 'zeta-1-b', name: 'ZETA-1 b',
        premise: 'Where the tithe is grown.',
        locations: [
          { id: 'the-tither-fields', name: 'THE TITHER FIELDS', board: 'w_z1b', challenge: 'teaching',
            brief: 'Harvest ranks in ground kept too soft to found on, counted tile by tile.' },
          { id: 'whole-z1b', name: 'THE WHOLE OF ZETA-1 b', board: null, whole: true, challenge: 'standard',
            brief: 'The planetary battle across the compact’s breadbasket.' }
        ]
      },
      {
        id: 'zeta-1-c', name: 'ZETA-1 c',
        premise: 'A client world hollowed into something that digests.',
        locations: [
          { id: 'the-gullet', name: 'THE GULLET', board: 'w_z1c', challenge: 'punishing',
            brief: 'A feeding channel folded four times inside one throat, ribs between every fold.' },
          { id: 'the-smuggler-strait', name: 'THE SMUGGLER STRAIT', board: 'w_narrowstrait', challenge: 'punishing',
            brief: 'The tightest channel in the game, known to everyone who does not report cargo.' },
          { id: 'whole-z1c', name: 'THE WHOLE OF ZETA-1 c', board: null, whole: true, challenge: 'punishing',
            brief: 'The planetary battle, fought inside something that is still working.' }
        ]
      },
      {
        id: 'zeta-1-d', name: 'ZETA-1 d',
        premise: 'In bloom, and the season does not end.',
        locations: [
          { id: 'the-spore-shoals', name: 'THE SPORE SHOALS', board: 'w_z1d', challenge: 'demanding',
            brief: 'Firm ground in shoals, bloom too deep to found on everywhere else.' },
          { id: 'whole-z1d', name: 'THE WHOLE OF ZETA-1 d', board: null, whole: true, challenge: 'demanding',
            brief: 'The planetary battle, in a season with no other side.' }
        ]
      },
      {
        id: 'zeta-2-b', name: 'ZETA-2 b',
        premise: 'Comb all the way down.',
        locations: [
          { id: 'the-hive-gallery', name: 'THE HIVE GALLERY', board: 'w_z2b', challenge: 'demanding',
            brief: 'One gallery with cells budding off it, each cell exactly one purpose wide.' },
          { id: 'the-toll-plaza', name: 'THE TOLL PLAZA', board: 'w_proxgate', challenge: 'demanding',
            brief: 'A Free Captains gate inside compact space, which is the entire dispute in one building.' },
          { id: 'whole-z2b', name: 'THE WHOLE OF ZETA-2 b', board: null, whole: true, challenge: 'punishing',
            brief: 'The planetary battle, fought through a comb that runs the whole crust: every gallery on the world is one cell of the same argument.' }
        ]
      },
      {
        id: 'zeta-2-c', name: 'ZETA-2 c',
        premise: 'The pools, and what is grown in them.',
        locations: [
          { id: 'the-birthing-pools', name: 'THE BIRTHING POOLS', board: 'w_z2c', challenge: 'demanding',
            brief: 'Twin channels around a brood bank that splits every field of fire in half.' },
          { id: 'the-ledger-chamber', name: 'THE LEDGER CHAMBER', board: 'w_z2d', challenge: 'punishing',
            brief: 'Walls that record what was taken and from whom, stacked into a maze.' },
          { id: 'whole-z2c', name: 'THE WHOLE OF ZETA-2 c', board: null, whole: true, challenge: 'punishing',
            brief: 'The planetary battle, audited as it happens.' }
        ]
      },
      {
        id: 'serpo', name: 'SERPO',
        premise: 'Where the exchange happened. Twelve went. The act ends here.',
        locations: [
          { id: 'the-exchange-ground', name: 'THE EXCHANGE GROUND', board: 'w_serpo', challenge: 'demanding',
            brief: 'One ceremonial road through three gates, each opening exactly once.' },
          { id: 'the-harbour-nine', name: 'HARBOUR NINE', board: null, challenge: 'punishing',
            brief: 'The sanctuary port the Free Captains used before Proxima, and the last place in the act that is anybody’s home.' },
          { id: 'whole-serpo', name: 'THE WHOLE OF SERPO', board: null, whole: true, challenge: 'brutal', seats: CAMPAIGN_MULTI,
            brief: 'The campaign finale. Everything the exchange started, settled on the ground it started on.' }
        ]
      }
    ]
  }
];

/* WHICH ACTS, IN WHICH ORDER, PER POWER (owner directive). Every campaign
   plays all three acts; only the order changes, and the order is the story.
   A power always opens at home, which is what makes the middle act the one
   where somebody else's home is the ground. */
const CAMPAIGN_ORDER = {
  human:  ['sol', 'proxima', 'zeta'],
  light:  ['proxima', 'sol', 'zeta'],
  robot:  ['proxima', 'sol', 'zeta'],
  xeno:   ['zeta', 'proxima', 'sol'],
  pirate: ['zeta', 'sol', 'proxima']
};

const CAMPAIGN_ACT_BY_ID = {};
CAMPAIGN_ACTS.forEach(a => { CAMPAIGN_ACT_BY_ID[a.id] = a; });

/* ==========================================================================
   PARKED: BONUS BODIES AND SYSTEMS (owner calls, Session 46).

   Places the canon keeps and the three-act campaign does not visit. This
   table exists so "bonus content" is a recorded decision with a reason and a
   board attached, rather than content that quietly stopped being mentioned:
   the failure mode for a demoted place is that nobody can tell later whether
   it was cut on purpose or lost in an edit.

   `boards` names geometry that already exists and is NOT consumed by any
   campaign location. Where a bonus body's board is instead re-parented into
   an act (the Pleiades and Sirius sets), that is stated on the entry, because
   a board cannot serve a campaign location and a bonus body at once and the
   probe enforces exactly that.
   ========================================================================== */
const CAMPAIGN_BONUS = [
  {
    id: 'mercury', name: 'MERCURY', kind: 'body',
    why: 'Dropped from Act 1 by owner call: Sol reads complete at six planets, and Mercury is a two-location detour on a body with one survivable stripe.',
    boards: ['w_mercury'], reparented: false
  },
  {
    id: 'pleiades', name: 'THE PLEIADES', kind: 'system',
    why: 'Was the Federation home. The Federation now shares Proxima Centauri, so the cluster stops being a campaign system and stays in the canon as somewhere the game can talk about.',
    /* Its boards carry Federation architecture, so they moved with the
       Federation: six of the seven are Act 2 location boards now, not free
       geometry. The seventh, the Dust Wake, stays with the cluster as the
       bonus location's own board (Session 47: it was the one handcrafted
       board no location and no parked entry kept). */
    boards: ['w_merope'], reparented: true,
    reparentedTo: 'proxima'
  },
  {
    id: 'sirius', name: 'SIRIUS', kind: 'system',
    why: 'Was the Vigil home. The Vigil now shares Proxima Centauri, and the same logic applies: the star stays in the canon, the campaign stops going there.',
    boards: [], reparented: true,
    reparentedTo: 'proxima'
  },
  {
    id: 'barnard', name: "BARNARD'S STAR", kind: 'system',
    why: 'Demoted in Session 42, before this rework. Listed here so the parked set is one table rather than several sessions of precedent.',
    boards: [], reparented: false
  },
  {
    id: 'tabby', name: "TABBY'S STAR", kind: 'system',
    why: 'Demoted in Session 42 alongside Barnard. THE VEIL survives there as somebody else’s unexplained work.',
    boards: [], reparented: false
  }
];
