# Cosmic Conquest

A **PvPvE** tower defence built on plain Canvas 2D and the Web Audio API. No
runtime dependencies and no framework: every sound is synthesised on the fly and
every unit on the battlefield is drawn by code. The menu art, portraits,
crests, dossiers, world plates, is rendered offline and shipped inlined; see
*The art pipeline* below.

### Play it: <https://majieddd.github.io>

Or run it locally, `python -m http.server 8471 --bind 127.0.0.1`, then open
<http://127.0.0.1:8471/index.html>. (`file://` blocks the module loads, so the
served copy is the one to use.)

`node build.js` produces `aegis-protocol.html`: about 6.4 MB, fully
self-contained, and the one file that *does* run straight from `file://`, the
whole game, art and audio in a single document you can email to someone. The
original single-player version is kept at
`docs/archive/v1-aegis-protocol-solo.html`.

**What's next?** [`docs/BACKLOG.md`](docs/BACKLOG.md) is the standing list of
everything unfinished, with the root cause already found for most of it.

**Want to work on it?** Read [CONTRIBUTING.md](CONTRIBUTING.md) first. It carries
the setup, the module map, the branch etiquette that keeps two people out of the
same 6,000-line file, what CI will fail you on, and the traps that have each cost
somebody a day.

**Where the rest of the paper lives.** [`docs/ROADMAP.md`](docs/ROADMAP.md) is
the one to open if work stopped and is resuming, every session's decisions, and
what each item actually turned out to be once someone read the code.
[`docs/BRAND.md`](docs/BRAND.md) is the binding visual contract,
[`docs/TOWER-AUDIT.md`](docs/TOWER-AUDIT.md) is why no two towers share an
identity, and [`docs/MECHANICS-OPTIONS.md`](docs/MECHANICS-OPTIONS.md) holds
fifteen designed-but-unbuilt mechanics awaiting a pick.

**Multiplayer is on `main` and live.** Two humans, one lockstep duel, no
server, no dependency, offline. Two windows of one browser talk over
`BroadcastChannel`; two machines talk over an `RTCDataChannel` the two players
signal by hand, because every signalling service there is to rent is a
dependency the house rule forbids. It merged in Session 21 only after an
adversarial audit found seven blocking defects the green test suite could not
see, and all seven were fixed; the whole story, including the audit, is in
[`docs/MULTIPLAYER-HANDOFF.md`](docs/MULTIPLAYER-HANDOFF.md). The duel harness
(`tools/multiplayer_test.js`, `MPT.all()`) passes clean.

---

## The idea

Humanity has met alien life and found the universe full of it. Four powers
matter. Humanity, the Federation of Light, the Xeno and the Pirates, and the
war for the galaxy is fought one world at a time.

You and a rival commander sit on opposite ends of one mirrored field. Neutral
waves spawn in the centre and march on both bases simultaneously. Everything
you kill gets back up and walks to your rival's door, and a reanimated unit
that dies is gone for good, so kills never cascade.

Your dead walk **your own lane in reverse**. There is no separate corridor for
them: a reanimate retraces the path it just died on, back through your guns to
the neutral zone, then runs your rival's lane forward into their defences. One
set of ground, travelled both directions.

Around that core sits a roguelike campaign: a galaxy of solar systems, each
world with its own battlefield, arena modifier, named rival commander and a
boon you keep on victory. A defeat keeps the campaign, the galaxy and every
star on it survive; only abandoning a campaign forfeits it. Stars pay SOULS the
moment they are earned, permanent unlocks for commanders and towers.

## What ships

| | |
|---|---|
| Battlefields | **15** authored maps, of which **4** are three-seat boards (Confluence, Crown, Carousel, Orrery) |
| The Maelstrom | a **20**-seat arena, its board solved from the seat count rather than authored |
| Towers | **60**, twelve per tech origin (ten of them 2×2 heavies) |
| Enemies | **54**, including 5 minibosses and 1 boss |
| Commanders | **26**, across 5 powers, the fifth is unlocked by conquering a galaxy |
| Commander abilities | **12**, 6 offensive, 6 defensive |
| Arena modifiers | **8** |
| Victory boons | **20**, five per faction, keyed to the world you took them from |
| Faction units | **25**, five per power, rescued from the maps their power holds or bought with souls |
| Art keys | **188**, inlined |

## Sixty towers, five slots, five origins

Every tower is built by somebody, and the builder is a mechanical identity
rather than a label, each origin carries a rider the engine actually reads.
No tower shares its identifying mechanic with another; the newest ten were
built against that rule explicitly (`docs/TOWER-AUDIT.md`).

| Origin | Towers | The rider |
|---|---|---|
| **HUMAN** | 12 | No clause at all. The widest element coverage, and the only origin that attunes to a terrain node of any element rather than a matched one |
| **ROBOTIC** | 12 | No proc, no gamble. Machines placed within reach of each other form a lattice, and every link pays |
| **PIRATE** | 12 | Governors removed. Strikes sometimes overload far past their rating, and the heat that builds takes the gun offline when the bank fills |
| **XENO** | 12 | Grows on wounds. Every hit carries a rider that scales off how hurt the target already is |
| **FEDERATION** | 12 | Holds a target's protections open, every resistance it has is worth less for a few seconds, and cannot itself be jammed or sabotaged |

You deploy five of them. You begin owning one (BOLT) and 6 souls, which is
exactly the price of a second. Since Session 19 the loadout has a second column:
twenty faction units, five per power, unlocked by rescuing them on the maps their
power holds and carrying their own talent trees. You take **three** of them into
a battle beside your five towers.

## Elements and reactions

Seven elements. **Kinetic** and **Radiant** are deliberately non-elemental:
straight damage, no reactions. The other five MARK their targets, and a hit
from a different marking element consumes the mark and reacts.

| Element | Towers | Reacts with |
|---|---|---|
| Void | 11 | fire → COLLAPSE · frost → ENTROPY · storm → RUPTURE · venom → BLIGHT |
| Storm | 8 | fire → PLASMA · frost → SUPERCONDUCT · venom → CATALYSE |
| Fire | 10 | frost → THERMAL SHOCK · storm → PLASMA · venom → IMMOLATE |
| Venom | 6 | fire → IMMOLATE · frost → PARALYSIS · storm → CATALYSE |
| Frost | 5 | fire → THERMAL SHOCK · storm → SUPERCONDUCT · venom → PARALYSIS |

Ten distinct reactions in all. Every marking element carries at least three
towers, so a reaction is reachable from an ordinary loadout rather than gated
behind owning one specific tower. A marked unit wears its element as a ringed
glyph, and the loadout screen lists exactly which reactions your five picks can
produce.

Twelve enemies resist a specific element, a **Palisade** takes half damage from
frost, and twenty-two are weak to one. Reactions need two different marking
elements to overlap on the same stretch of lane, which makes tower placement an
elemental decision as well as a spatial one.

## Progression

- **Commander tech charts** (3×3, row-gated), levels from battle XP
- **Tower mastery**, each tower earns XP when deployed; mastery unlocks its
  six talents one at a time, M1 through M6, on a 3-row × 2-column grid
- **Tower talents** activate only when their tier is reached in battle
- **Souls**, paid by STARS, the moment you earn them: 2 a star, so a clean
  three-star conquest is 6. Spend them on commanders (12 in your own faction,
  18 outside it), a commander's second ability, and **unlocking towers** at 6
  each
- **The arsenal**, your rival is held to the same ceiling: it fields an arsenal
  of equal size drawn from its own deterministic slice of the roster, and its
  commander tech and tower talents run only as deep as yours do. Progression is
  a race, not a wall.

## The economy is a vice

Tower prices grow per copy owned AND inflate **7.5%** with every tower you have,
of any kind, `Math.pow(1.075, towers.length)`.

Ascension is unlimited and priced on a golden exponent:
`cost = (2 × paid specialisation) ^ (1.1618ⁿ)`, with `n` counting from zero. The
ladder is therefore **per tower**, because the specialisation price differs
across the roster. BOLT runs **151 → 340 → 872 → 2,607 → 9,308 → 40,832**; each
step's own multiplier grows, from ×2.25 at the first step to ×4.39 at the sixth.
Across the whole roster a first ascension costs 151–364 and a sixth
40,832–263,665.

Each ascension is worth ×1.34 damage, ×1.07 fire rate and ×1.035 range, with a
SURGE every second one.

## The curve is short and steep, by design

`Game.waveHpMul(n, rage)` is the single definition of enemy health, and every
number the interface prints comes from it. Its shape lives in
`waveHpMultiplier(w)` and is banded rather than one runaway exponent:

| Waves | Growth | Cumulative | What it is |
|---|---|---|---|
| 2–10 | ×1.26 | ×8.0 by wave 10 | The novice wall. An unprogressed commander on a fixed five-tower loadout dies here at a median of **wave 6–7**, and never leaves the band. |
| 11–20 | ×1.22 | ×58.5 by wave 20 | Gentle enough that a fully levelled commander's reach converts into ten more waves. Measured: a maxed profile reaches **wave 26–27**. |
| 21+ | accelerating to ×1.85 | ×345 by 25, ×969 by 27 | A terminus, not an asymptote. |

On top of that shape `waveHpMul` applies the difficulty, the unit scale, **+30%
per galaxy tier** once you claim a galaxy and start the next, and the enrage
term.

The build window is 22s before the first wave, then 15s shrinking by 0.35s a
wave to a 7s floor it reaches at wave 23, so the field stays busy rather than
idle.

Enemies come fewer but individually stronger. Bosses and minibosses are wholly
immune to slow, displacement and stun. **Eight** aura carriers protect their
neighbours from your control tools. Marshal Pylon (RESOLVE), Anchor Pylon
(ANCHOR), Cadence Pylon (HASTE), Bastion Pylon (PLATING), Oriflamme, Hivelord
(FRENZY), Vanguard (LOCKSTEP) and Omniframe (CONSENSUS). Kill the carrier and the buff dies with it.

---

## Controls

| | |
|---|---|
| `1`–`5` | Select tower from your loadout |
| `Shift` + click | Place several without reselecting |
| Click a tower | Inspect / upgrade / retarget, rival towers too |
| `U` / `S` | Upgrade / sell selected |
| `Q` / `E` | Commander abilities, offensive slot / defensive slot |
| `Tab` | Cycle targeting mode |
| `Space` or `P` | Pause |
| `N` or `Enter` | Rush the next wave |
| `Alt` + `1`/`2`/`3` | Simulation speed |
| `1`–`5` during a draft | Pick that command upgrade |
| `Esc` | Deselect / close overlay |

---

## Build and run

```
node build.js
```

writes both bundles from `index.html`, `css/` and `js/`:

- `aegis-protocol.html`, a complete document, openable straight from `file://`
- `aegis-artifact.html`, the same page without the document-level tags, for a
  host that supplies its own shell

The build refuses to write a bundle that still points at an external file, so a
missed inline is a failed build rather than a broken download.

For development, serve the folder and open `index.html`, the modules load as
plain scripts, so there is no watcher and no transpile step:

```
python -m http.server 8471 --bind 127.0.0.1
```

Cache-bust when testing a bundle (`aegis-protocol.html?v=2`); the raw `js/*.js`
files cache hard and you will otherwise test stale code.

## The art pipeline

Sound and battlefield sprites are generated at runtime. The **menu** art is not:
it is rendered offline by the generator in `artgen/`, inside this repository,
not beside it, and baked into `js/artpack.js` as one object of base64 WebP data
URIs, which is why the bundle is 6.4 MB rather than 500 KB: `js/artpack.js`
alone is 4.96 MB.

The pack holds **188** keys:

| Class | Keys | Count |
|---|---|---|
| Commander portraits | `cmd_<id>` | 21 |
| Faction crests | `fac_<id>` | 4 |
| World plates | `world_<mapId>` | 16 |
| Holder variants | `world_<mapId>_<factionId>` | 60 |
| Enemy dossiers | `foe_<id>` | 49 |
| Planet portraits | `planet_<kind>` | 12 |
| Ability emblems | `abil_<id>` | 12 |
| Tower plates | `twr_<id>` | 11 |
| Key art | `title`, `nebula`, `blackhole` | 3 |

Every lookup goes through `art(key)` / `artImg(key, …)` in `js/dialogue.js`,
both of which return empty for a missing key, so a partial pack degrades to the
procedural artwork each surface shipped with rather than breaking it.

To regenerate (see [`docs/BRAND.md`](docs/BRAND.md) for the style contract, which is binding):

```
python artgen/sdxl_all.py          # render anything missing from the catalogue
python artgen/derive_worlds.py     # duotone holder variants from the base plates
python artgen/derive_crests.py     # crest hues, forced in code rather than prompted
python artgen/krea_gen.py --pack   # assemble js/artpack.js (cache_krea > cache)
node build.js                      # inline into the two bundles
```

Run these from the repository root. **The `python` on your PATH is probably not
the one that can render**, only `sdxl_all.py` needs torch, and on an
interpreter without it that command dies at `import torch` while the other
three succeed on Pillow alone, which reads as a broken pipeline rather than a
wrong interpreter. CONTRIBUTING §6 has the check and the fix.

`artgen/krea_jobs.py` is the single catalogue for both models; nothing is
generated that is not listed there.

---

## Architecture

```
index.html            markup and the screens
css/style.css         interface styling
css/polish.css        the polish layer: glass surfaces, world map, sprite previews
js/artpack.js         the generated art pack, base64 WebP (loaded first)
js/config.js          maps, core towers + tech trees, enemies, waves, modifier pools
js/factions.js        the five powers, tech origins, summoning rites, prestige, lore
js/towers2.js         elements, combo table, expansion towers, arena mods, boons
js/abilities.js       the twelve commander abilities
js/roster.js          the 26 commanders and their 3×3 tech charts
js/dialogue.js        portraits, art lookup, pre-battle dialogue
js/commanders.js      trait folding, persistent meta progression, the soul ledger
js/audio.js           Web Audio synthesis engine + music scheduler
js/entities.js        Path, Enemy, Tower, Drone, Mine, Projectile
js/entities2.js       Minion, Barricade, expansion tower behaviours and sprites
js/ai.js              the opponent commander
js/galaxy.js          galaxy generation, systems, worlds, ownership
js/net.js             lockstep duels: BroadcastChannel and hand-signalled WebRTC
js/game.js            N-sided state, fixed-timestep loop, world rendering
js/ui.js              screens, HUD, inspector, draft overlay
js/main.js            bootstrap and keyboard
build.js              inlines everything into the two bundles
```

Classic script tags rather than ES modules, so the game runs from `file://`.
`build.js` lists the same seventeen modules in the same order; if you add one, add
it in both places.

**Ownership** is a single field: every unit carries `hostileTo`, the side it
marches on. Towers only engage units hostile to their own side.

**Seats are not a pair.** Boards carry two, three or twenty commanders, so
anything that walks the sides walks `Game.sides`, and a send is routed with
`Game.rivalOf(side)` and `sendTriPaths[side][victim]`. The two-entry `sendPaths`
array is a legacy accessor and is only correct for seats 0 and 1.

**The sidebar** re-renders only when a content signature actually changes rather
than once per frame-batch.

**Status glyphs** render from a cached tile atlas rather than being composed per
frame; the naive version cost milliseconds once dozens of units carried a status.

**The board fits the viewport.** The logical field keeps its exact tile
dimensions so the simulation is untouched; only the presentation is fitted, and
the backing store stays at device resolution.

**The universe map** is an SVG chart of the theatre, laid out deterministically
from the campaign seed. Hovering a world opens a briefing: the map's own painted
plate, the rival commander waiting there, the arena modifier in force, and the
boon victory would bank. At its centre hangs THE MAELSTROM, which pulls the whole
chart slowly inward for as long as the screen is watched.

**Tower previews are the towers.** Every menu that names a tower draws it by
calling the same `draw_*` routine the battlefield uses, on a lightweight stub
posed mid-animation, so the loadout grid, the shop, the tooltips, the talent
trees and the soul shop all show real artwork rather than an icon font.
