# WORLD MAPS: every campaign planet gets a handcrafted board

Owner directive, Session 44. The campaign stops rolling boards from the pool:
every planet and celestial body gets a handcrafted, intentional board unique
to it, grounded in the body's real physical character. Procedural generation
is NOT retired: it becomes the ground of a future post-campaign mode
(exploring the unknown), and the handcrafted set below is its design corpus,
each board a worked example of what its terrain class means when a person
builds it on purpose.

## Decisions (owner-facing, made in this batch)

1. **All 35 campaign worlds get authored duel boards.** 5 systems x 7 worlds,
   keyed by PLANET NAME (world names are index-derived and stable across
   seeds), merged into MAPS so every resolver (`MAPS.find`) works unchanged.
2. **Contested worlds keep the shared tri boards** (CONFLUENCE, CROWN,
   CAROUSEL). Contested slots are player-relative (`2+(si%2)`, `4+(si%2)` on
   the TIER index), so the same planet is contested in one power's campaign
   and open in another's: a planet cannot own a tri board without owning two
   boards. The three tri boards are already handcrafted and stay the
   dedicated three-way-war grounds. Per-planet tri variants are a possible
   later batch, flagged as an owner call in the tracker.
3. **The galaxy PRNG stream does not move.** The map draw at galaxy.js
   stays exactly where it is and its result is overridden index-derived for
   campaign worlds, the same pattern the contested block has always used.
   A committed fixture pins arenas, boons, kinds, owners and seats across
   seeds so the override can never silently shift a draw.
4. **World boards never enter a pool.** They carry `world: '<PLANET>'`, and
   every pool site filters them out: the galaxy eligibility filter and the
   mapPool save pin. Skirmish and duel pickers keep their existing pools.
5. **Scenario kinds are untouched.** A world's kind (seat, fortress, nest,
   renegade...) keeps driving scenario and boons; only the GROUND changed.

## The terrain codex (the meta layer)

Separate from the stat/attribute track (tier, roster, nodes). This describes
the PHYSICAL DESIGN of a board: what the ground is, how the lane flows, what
stands in the way. Closed vocabularies, so a probe can hold every board to
them, and future procedural work can treat each value as a named, worked
example.

`terra` on every world map def:

| Field | Closed vocabulary | Meaning |
| --- | --- | --- |
| `class` | grid, crater, canyon, dome, band, archipelago, ring, field, terrace, maze, channel, corridor, plaza, weave, forge | What the ground IS |
| `flow` | serpentine, switchback, spiral, straight, braid, ring-arc, convergent, split, staircase, weave | How the lane moves (the "curvature") |
| `cover` | open, scattered, pocketed, walled, mazed | Obstacle density class |
| `barriers` | none, blocks, walls, mixed | Which obstacle kinds appear (blocks stop building; walls also stop shots) |
| `sight` | long, broken, blind | What a tower can expect to see |
| `basis` | prose | The real physical trait of the body this board is built from |

Every field except `basis` is validated against its vocabulary by
tools/probe-worldmaps.js. `basis` is content (a sentence), exempt by the
dead-field distinction. Readers: the narrative spine renders the full codex
per board (chips plus basis), and the vocabulary is the brief for future
procedural families.

## The 35 boards

Seat worlds (wi 6) are act finales and lean harder. Rosters draw the Vigil
host, themed to the ground and heavier with system depth.

### THE EARTH SYSTEM
| World | class / flow / cover | The board |
| --- | --- | --- |
| EARTH | grid / switchback / scattered | The harbour district where the fragments came down: street-grid lane between fallen-fragment rubble, corner crossfire, generous ground. The campaign's first, most readable board. |
| LUNA | crater / serpentine / pocketed | Far-side crater field: rim-arc blocks, no atmosphere so sightlines stay long, build pockets between rims. |
| MARS | canyon / switchback / walled | Valles Marineris trench: switchback descending between sheer WALL cliffs; lobbed fire and spotters earn their keep. |
| VENUS | dome / serpentine / walled | Pressure-dome chain on the volcanic plain: the lane threads dome shells (wall arcs), short broken sightlines. |
| MERCURY | band / straight / open | The terminator strip: one long survivable band, day side and night side both dead ground; extreme spread on a thin board. |
| JUPITER | archipelago / split / pocketed | Cloud-deck platforms over the storm: buildable islands, void between, flyer-heavy waves. |
| SATURN (seat) | ring / ring-arc / walled | The ring shepherd: a grand arc around a walled core with gaps, the door under Saturn behind it. |

### THE PLEIADES
| World | class / flow / cover | The board |
| --- | --- | --- |
| MAIA | field / straight / open | Reflection-nebula light plain: the widest sky in the theatre, spread or die. |
| ELECTRA | terrace / staircase / pocketed | Shrine terraces stepping down the nebula shelf; cover on one side only. |
| TAYGETA | plaza / split / pocketed | Twin choral halls, one arena per band; attention split in two. |
| MEROPE | weave / braid / scattered | The Merope dust wake: two lanes weaving, crossings are crossfire hubs. |
| CELAENO | maze / serpentine / mazed | The archive vaults: wall stacks carve a line-of-sight maze. |
| STEROPE | corridor / straight / walled | Lightning nurseries: one fenced run, wall posts alternating beside the road. |
| ALCYONE (seat) | plaza / ring-arc / walled | The anchor sanctum: a horseshoe around one plaza that covers every road at once. |

### ZETA RETICULI
| World | class / flow / cover | The board |
| --- | --- | --- |
| ZETA-1 b | field / serpentine / scattered | The tither fields: harvest-row strips of low cover in long ranks. |
| ZETA-1 c | channel / switchback / pocketed | A gut-tunnel: tight organic switchback, pockets in the folds. |
| ZETA-1 d | archipelago / split / pocketed | Spore shoals: islands of firm ground in a drifting bloom. |
| ZETA-2 b | corridor / switchback / pocketed | The hive gallery: alcoves off a single corridor, nothing covers two legs. |
| ZETA-2 c | channel / split / scattered | The birthing pools: twin channels split by a bank nothing shoots across. |
| ZETA-2 d | maze / serpentine / mazed | The ledger chamber: walls recording what was taken, stacked into a maze. |
| SERPO (seat) | road / straight / walled | The exchange ground: one ceremonial road pierced by wall gates, only the gap open. |

(`road` reads as class `corridor` in the codex; the ceremonial framing lives
in the blurb.)

### PROXIMA CENTAURI
| World | class / flow / cover | The board |
| --- | --- | --- |
| PROXIMA d | band / straight / open | Tide-locked scorch: a thinner, meaner terminator band than Mercury. |
| PROXIMA b | grid / switchback / scattered | The capital port: dock-grid lanes between crane rows and cargo blocks. |
| PROXIMA c | archipelago / serpentine / pocketed | The wreck yards: hull islands from a hundred builders. |
| THE FLARE SHELTER | ring / convergent / walled | The bunker under the flare: lanes converge through a broken wall ring. |
| THE NARROWS | corridor / switchback / pocketed | The smuggler strait: the tightest corridor in the theatre. |
| THE DARK LOCKER | maze / switchback / mazed | The vault on the dark side: wall maze, blind corners, short sight. |
| PROXIMA GATE (seat) | plaza / convergent / walled | The toll gate: every lane pays at one gate plaza. |

### SIRIUS
| World | class / flow / cover | The board |
| --- | --- | --- |
| SIRIUS A I | field / straight / open | The calibration plain: machine-flat, near-zero cover, pure spread. |
| SIRIUS A II | corridor / straight / walled | Assembly rows: fence lines beside one production run. |
| THE ASH FIELD | crater / serpentine / scattered | What Sirius B shed: drifts and shell craters. |
| SIRIUS B I | forge / ring-arc / walled | The collapsed-star forge: an arc around a dense walled core. |
| THE DIAMOND SHELF | terrace / staircase / walled | Crystallised carbon terraces: wall facets prism the sightlines. |
| THE COMPANION | ring / spiral / pocketed | The orbit of the dead star: one long inward spiral. |
| THE DOG STAR (seat) | maze / serpentine / walled | The hall of standing orders: an immaculate wall grid, one winding road, desks in perfect order, chairs never occupied. |

## Verification

- `tools/probe-worldmaps.js`, wired into gate.js: 35 boards present and
  name-keyed to GX_HOME_SYSTEMS exactly; geometry laws (even cols, first
  waypoint at cols/2-1, last at x=-1, axis-aligned segments, half-side
  terrain, walls never on lane tiles, every authored node survives the
  mirror); roster ids real and non-boss; terra vocabulary membership; and
  the STREAM PIN: a committed fixture of owners, kinds, seats, arenas and
  boons across seeds, generated before the override landed, asserted equal
  after it.
- `tools/showboard.js` renders any world board by id for authoring review.
- Balance: campaign board geometry is a deliberate sim change (owner
  directive); pins re-baseline, recorded in docs/BALANCE-BASELINE.md.
- The narrative spine renders every board as an SVG from the game's own
  buildField output (no second geometry implementation), with its terrain
  codex beside it.
