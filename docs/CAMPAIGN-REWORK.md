# THE CAMPAIGN REWORK: acts, planets, locations

Owner directive, Session 46. The campaign stops being "five systems of seven
worlds, one battle each" and becomes a three-level hierarchy:

```
ACT (a star system)  ->  PLANET (5 to 7 per act)  ->  LOCATION (1 to 12 per planet)
```

A **location** is one battle on one board. A **planet** is taken when its
locations are, and the last location of a planet is its **whole-body battle**:
the planetary fight the smaller ones were rehearsals for. That last rung is
deliberate structure, not a menu convenience: it is the thing the eventual 3D
port turns into a single continuous globe. (The 3D work is happening in another
session as WORLDHEART and is context only; nothing here depends on it.)

The structure is committed as data in **js/campaign2.js** and held to its rules
by **tools/probe-campaign2.js** (10 checks, in the gate). It is **not wired into
the engine yet, on purpose**: see the impact analysis below for why that is a
separate batch.

## Three systems, five powers

The acts are Sol, Proxima Centauri and Zeta Reticuli, and every power plays all
three in its own order. This is a consolidation from five home systems: the
Federation and the Vigil now share Proxima, the Xeno and the Pirates share Zeta.

| Power | Act 1 | Act 2 | Act 3 |
| --- | --- | --- | --- |
| Humanity | **Sol** | Proxima | Zeta |
| Galactic Federation | **Proxima** | Sol | Zeta |
| The Vigil | **Proxima** | Sol | Zeta |
| The Xeno | **Zeta** | Proxima | Sol |
| The Pirates | **Zeta** | Sol | Proxima |

Every power opens at home; the probe asserts it. The middle act is always
somebody else's home, which is the shape the story wants.

**The Pleiades and Sirius are bonus content** (owner call), parked in
`CAMPAIGN_BONUS` exactly as Barnard's Star and Tabby's Star already were, so the
canon keeps its edges. **Nothing authored is lost**: thirteen of their fourteen handcrafted
boards moved with the powers that built them and are Act 2 location boards now,
which is why Act 2 needs no new geometry at all, and the Pleiades keep the
fourteenth, the Dust Wake, as the bonus location board. **Mercury is bonus content too**
and keeps its board.

## The three acts

### Act 1: THE EARTH SYSTEM, home of humanity

*The rock came apart over Earth and it was hollow. Everything after is the answer to that.*

6 planets, 29 locations, 23 boards to author.

| Planet | Locations, in order | Ready | New |
| --- | --- | ---: | ---: |
| **EARTH** | LONG ISLAND **[new]** &rarr; NEW YORK CITY &rarr; WASHINGTON D.C. **[new]** &rarr; THE TRI-CITY LINE **[new]** *(multi)* &rarr; NORTH AMERICA **[new]** &rarr; SOUTH AMERICA **[new]** &rarr; EUROPE **[new]** &rarr; AFRICA **[new]** &rarr; ASIA **[new]** &rarr; OCEANIA **[new]** &rarr; ANTARCTICA **[new]** &rarr; EARTH: GLOBAL WARFARE **[new]** *(multi)* | 1 | 11 |
| **LUNA** | THE LUNAR BASE &rarr; THE WHOLE MOON **[new]** | 1 | 1 |
| **MARS** | CRASH LANDING **[new]** &rarr; THE GREAT RIFT &rarr; OLYMPUS MONS **[new]** &rarr; THE WHOLE OF MARS **[new]** | 1 | 3 |
| **VENUS** | THE PEAKS ABOVE THE CLOUD &rarr; THE ACID LAKES **[new]** &rarr; THE WHOLE OF VENUS **[new]** | 1 | 2 |
| **JUPITER** | HIGH ORBIT **[new]** &rarr; THE DEBRIS FIELD &rarr; THE EYE AND THE MOUNTAINS **[new]** &rarr; THE WHOLE OF JUPITER **[new]** | 1 | 3 |
| **SATURN** | AROUND THE RINGS &rarr; THE ACID LAKE **[new]** &rarr; THE NORTH POLE FACILITY **[new]** &rarr; THE WHOLE OF SATURN **[new]** *(multi)* | 1 | 3 |

Earth's twelve locations are the spine of the whole game: Long Island (where
the first protagonist is from, and where the Northrop Grumman radium leak gave
people cancer and gave a few of them something else), New York under Swami,
Washington under a truce nobody enjoys, the Tri-City line where the player
stops being able to be everywhere, then **all seven continents** at
continental scale, then the planet entire. Twelve battles on one body is
deliberate: Earth is the act that teaches the game and the only world the
whole campaign comes back to.

### Act 2: PROXIMA CENTAURI, home of the Federation and the Vigil

*The closest star to home, holding two powers who both believe they are the reason it is still standing.*

6 planets, 18 locations, 0 boards to author.

| Planet | Locations, in order | Ready | New |
| --- | --- | ---: | ---: |
| **PROXIMA d** | THE SCORCH LINE &rarr; THE WHOLE OF PROXIMA d | 2 | 0 |
| **PROXIMA b** | THE FIRST PORT &rarr; THE LIGHT PLAIN &rarr; THE SHRINE TERRACES &rarr; THE WHOLE OF PROXIMA b | 4 | 0 |
| **PROXIMA c** | THE WRECK YARDS &rarr; THE ASSEMBLY ROWS &rarr; THE WHOLE OF PROXIMA c | 3 | 0 |
| **THE FLARE SHELTER** | THE SHELTER DOOR &rarr; THE DARK LOCKER | 2 | 0 |
| **TOLIMAN** | THE ARCHIVE VAULTS &rarr; THE COLLAPSE FORGE &rarr; THE WHOLE OF TOLIMAN | 3 | 0 |
| **RIGIL KENTAURUS** | THE LIGHTNING NURSERIES &rarr; THE CHORAL HALLS &rarr; THE LONG ORBIT &rarr; THE HALL OF STANDING ORDERS *(multi)* | 4 | 0 |

Toliman and Rigil Kentaurus are Alpha Centauri B and A, which are really
gravitationally bound to Proxima: the act is one triple star system, not three
unrelated stops.

### Act 3: ZETA RETICULI, home of the Xeno and the Pirates

*A binary pair, a compact that counts everything, and the captains who move what it counts.*

6 planets, 16 locations, 7 boards to author.

| Planet | Locations, in order | Ready | New |
| --- | --- | ---: | ---: |
| **ZETA-1 b** | THE TITHER FIELDS &rarr; THE WHOLE OF ZETA-1 b **[new]** | 1 | 1 |
| **ZETA-1 c** | THE GULLET &rarr; THE SMUGGLER STRAIT &rarr; THE WHOLE OF ZETA-1 c **[new]** | 2 | 1 |
| **ZETA-1 d** | THE SPORE SHOALS &rarr; THE WHOLE OF ZETA-1 d **[new]** | 1 | 1 |
| **ZETA-2 b** | THE HIVE GALLERY &rarr; THE TOLL PLAZA &rarr; THE WHOLE OF ZETA-2 b **[new]** | 2 | 1 |
| **ZETA-2 c** | THE BIRTHING POOLS &rarr; THE LEDGER CHAMBER &rarr; THE WHOLE OF ZETA-2 c **[new]** | 2 | 1 |
| **SERPO** | THE EXCHANGE GROUND &rarr; HARBOUR NINE **[new]** &rarr; THE WHOLE OF SERPO **[new]** *(multi)* | 1 | 2 |

## What this costs the engine

This is why the data landed alone. Every item below is a real dependency
measured in the current tree, not a guess.

| What | Where | Why it moves |
| --- | --- | --- |
| `SYSTEMS_PER_GALAXY = 5` | js/galaxy.js:14 | Becomes 3. There is a hard guard at galaxy.js:49 asserting `RENEGADE_BOON_KINDS.length + 1 === SYSTEMS_PER_GALAXY`, so the own-power boon promise (one of each kind, one apex) has to be re-derived for three systems or the guard has to change its claim. |
| `WORLDS_PER_SYSTEM = 7` | js/galaxy.js:32 | Survives as PLANETS per act (5 to 7), but stops being the battle count. It is currently used to derive world names, boons, map picks and unit rewards by `si * WORLDS_PER_SYSTEM + wi`; every one of those index derivations now needs a location index too. |
| World id `'s' + si + 'w' + wi` | js/galaxy.js:571 | Needs a third component. Campaign progress is `stars: { 's0w3': 2 }` (commanders.js), so the id shape IS the save format. |
| Star progress and planet completion | js/commanders.js:620-659 | `home.worlds.every(w => stars[w.id] >= 1)` becomes a two-level roll-up: a planet is taken when its locations are, an act when its planets are. |
| The five-faction to five-system mapping | js/galaxy.js:189 `GX_UNIVERSE_ORDER`, :351 `GX_V2_HOLDER`, :101 `GX_HOME_SYSTEMS` | Five powers now live in three systems, two of them shared. The holder table is keyed system-by-player and needs rebuilding for the new residency. |
| `campTier` act ordering | js/galaxy.js:494 | Currently rotates five systems from the player's home. Becomes a lookup into `CAMPAIGN_ORDER`, which is authored per power rather than derived. |
| The galaxy map screen and routes | js/ui.js, js/galaxy.js route graph | Has to show planets inside an act and locations inside a planet: one more level of navigation than exists today. |
| Duel / net | js/net.js | Duels are per board and per world id. The id change reaches the lobby table and the seat lens. NET_PROTOCOL bumps. |

**Save migration.** A campaign stores only its seed plus `stars` keyed by world
id, and rebuilds the galaxy from the seed. Under the new hierarchy those keys
address a galaxy that no longer exists, so an in-flight campaign cannot be
carried across by reinterpretation. The honest options, in preference order:

1. **Retire in-flight campaigns on migration** (keep the profile, its
   commanders, unlocks and soul vault; end the run). Cheapest and truthful, and
   the profile is where all the durable progress actually lives.
2. Map old `s<si>w<wi>` onto the new act/planet whose position matches and
   award its stars to that planet's first location. Preserves a number and
   lies about what it means.

Recommendation is (1), with the migration writing a log line the player can
read. This is an owner call and is flagged in the tracker.

## The asset schedule

**30 new boards**, all specified in js/campaign2.js (the probe fails if a board
still to be built has no brief). Suggested order, because it front-loads the
part the owner is designing against:

| Batch | Boards | Why first |
| --- | --- | --- |
| A | Earth's first four: Long Island, D.C., Tri-City, plus the Global finale | The opening of the game and the two multi-commander shapes. Long Island is the new tutorial board and needs the most care. |
| B | Earth's seven continents | One archetype reused seven ways with different point layouts, so they are cheap once A settles the idiom. Antarctica is the exception and should be built last: it is the one that explains the others. |
| C | Mars 3, Venus 2, Luna 1 | The inner-system whole-body battles. |
| D | Jupiter 3, Saturn 3 | The act's back half, including the north pole facility. |
| E | Zeta's 7 | Act 3, mostly whole-body battles over existing terrain vocabulary. |

Every new board still owes: geometry, a terrain codex entry (class, flow, cover,
barriers, sight, challenge, basis), a wave roster, and a world dossier in
js/worldlore.js. The existing gates already enforce all four for anything that
reaches MAPS, so the board work cannot ship half-specified.

**Other assets not yet scheduled**: planet cut plates per location (the current
art keys are `pcut_<si><wi>_<fac>_<beat>` and would need a location component),
commander portraits for the new named characters (Swami, Ronald Dump, the Long
Island protagonist), and the story beats for four campaigns whose act order
changed.

## Owner calls, all settled (Session 46)

1. **Mercury is bonus content**, not an Act 1 planet. Sol runs six planets. It
   keeps `w_mercury` and its entry in `CAMPAIGN_BONUS`.
2. **In-flight campaign saves are reset** at migration. The profile survives
   with its commanders, unlocks, soul vault and ratings; the run does not. This
   is what makes the id-shape change tractable at all.
3. **The Pleiades and Sirius are bonus content**, parked in `CAMPAIGN_BONUS`.
   Thirteen of their fourteen boards moved with the powers that built them and
   are Act 2 location boards now, which is recorded on the parked entries and
   enforced: a board cannot serve a campaign location and a bonus body at once.
   The Pleiades keep the fourteenth, the Dust Wake, as the bonus location board.
4. **All seven continents** are Earth fights: North America, South America,
   Europe, Africa, Asia, Oceania, Antarctica. Earth is twelve locations.

Parked places live in `CAMPAIGN_BONUS` with the reason recorded, so a later
session can tell what was cut on purpose from what was lost in an edit. C2.10
fails on a parked entry with no reason.

## Verification

`node tools/probe-campaign2.js`, in the gate (10 checks): three acts at 5 to 7
planets, the location budget (up to twelve, which is Earth), one whole-body battle per planet and it comes last, unique ids
and refs, every named board resolves, no board serves two locations, challenge
in the codex vocabulary, every power plays three acts and opens at home, one
home act per power, and every board still to be built carries its brief.

Mutation tested, four plants, each caught by its predicted check with control
green: a power opening away from home, two locations sharing a board, a board
id that does not exist, and a whole-body battle that is not last. C2.10 adds
three more: a parked body claiming a board a campaign location uses, a parked
body with no reason recorded, and a re-parented system still claiming boards.
