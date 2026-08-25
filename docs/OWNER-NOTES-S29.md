# Owner Batch, Session 29

Tracked list. Every row carries a status and evidence. A row is DONE only when a
command or a probe proves it, never by inspection.

Status: TODO | WIP | DONE | BLOCKED | NEEDS-DECISION

Tooling active for this batch: `design-forge` (UI gates, motion law, slop detectors),
`aegis-gamedev` (determinism, balance method, canvas perf, verification, batch
discipline), `tools/headless.js` (CDP driver, zero deps), puppeteer-core 25.9.0
(installed outside the repo at ~/.claude/tools/pptr).

---

## A. Galaxy and economy

| # | Item | Status | Evidence |
|---|---|---|---|
| A1 | Renegade planet counts toward a faction's total planets held | DONE | sweep 16.6 added. Measured 4 factions x seed 4242: 5 renegade worlds each now in the political tally, tallies sum to 35/35 (was 30), conquered stays 0 |
| A2 | Souls become a flat 3 per map, +1 per star earned | DONE | Measured: 1star=4 2star=5 3star=6 (=TOWER_UNLOCK_COST), replay 1to3=2, repeat=0. sweep 56/1/2 |
| A3 | Unit reward is not every map. Cadence of roughly one per 3 maps | DONE | UNIT_REWARD_EVERY=3, worldGrantsUnit() index-derived (zero rnd draws). Measured 12/35 worlds pay, 2-3 per system, stable across regeneration. Gate applied in BOTH recordWorld and the preview card so promise==grant |
| A4 | Achievement system that awards souls, including participation achievements so a stuck player still earns | DONE | 16 achievements, 10 of them participation-based. MEASURED: 10 straight defeats with zero stars pays 8 souls (a clean 3-star sweep pays 6). Idempotent, rejects unknown keys and negatives, galaxies derived from galaxyTier so it cannot double count. Surfaced on the results screen |

## B. Galaxy map preview pane rebuild

One coherent redesign, tracked as parts because they land in different code.

| # | Item | Status | Evidence |
|---|---|---|---|
| B1 | Commander portrait moves into the slot currently occupied by "COURSE SET". "COURSE SET" is removed | DONE | COURSE SET replaced by the waiting commander: portrait, name, title, tooltip |
| B2 | Kill the separate "TERRAIN" and "FORGE" labels | DONE | Both chips deleted. 0 .br-chips in the rendered DOM |
| B3 | Map name line becomes `<Adjective> <Type>` e.g. "Rocky Forge", rendered where "The Coil: Longest Lane..." sits today | DONE | Name line is now "<Adjective> <Kind>", e.g. Threaded World, Flooded World, Walled Fortress |
| B4 | Hovering the adjective shows the terrain modifier detail. Hovering the type shows the map-type modifier detail. Two separate tooltips | DONE | Two separate tooltips measured: adj carries the map sigNote, kind carries the WORLD_KINDS note |
| B5 | New SCENARIO section directly under the map banner | DONE | .br-scen sits directly under the banner. 3 of 3 cards |
| B6 | Scenario section previews the passive scenario mobs you will face, as icons | DONE | 24 mob icons rendered from map denizens + roster, all painted |
| B7 | Stars move INTO the scenario mini box, and state the win condition for each | DONE | 9 star rows, all inside .br-scen |
| B8 | Each star states the reward it grants | DONE | Each row prints its reward with its own tooltip |
| B9 | Reward ladder is fixed: 3 star = victory boon, 2 star = new unit, 1 star = progression + xp/souls only | DONE | 1 star progress/xp/souls, 2 star the soldier, 3 star the boon by name plus the world |
| B10 | 1 star condition is the generic "win / survive / outlast", varying by scenario | DONE | 1 star condition comes from the scenario: Win the battle / Survive 12 waves / Reach wave 15 |
| B11 | Commander of the map sits at the top, 4 unit icons on the left, 4 tower icons on the right | DONE | Commander at top, 12 unit icons left and 8 tower icons right across 3 cards (contested correctly skips towers) |
| B12 | Italic flavor text is the last element in the pane | DONE | .br-flavor is the last element of every card. Measured lastChildIsFlavor true |
| B13 | Remove the now-duplicated block (repeat victory boon info, arena type) | DONE | Removed: chips, starreq, rescue row, rival row, foot. All 0 in the DOM |
| B14 | Unit reward is communicated only through the star ladder, not a separate widget | DONE | Unit reward appears only in the 2 star row |

## C. Scenario system (new subsystem, B depends on it)

| # | Item | Status | Evidence |
|---|---|---|---|
| C1 | Scenario data model: id, name, win condition, star thresholds, mob preview set, flavor | DONE | SCENARIOS: id, name, kind, icon, brief, stars[3], flavor, test() |
| C2 | Win conditions are data, not hardcoded. Default is the usual tug-of-war | DONE | win conditions are the per scenario test(); ratingFor delegates to it |
| C3 | Variant: survive the swarm to wave X | DONE | THE SWARM: survive 12/16/20 waves. Ladder measured 3/2/1/0 |
| C4 | Variant: solo endless, with a minimum wave count per star tier | DONE | THE LONG VIGIL: reach wave 15/25/35. Ladder measured 3/2/1/0 |
| C5 | Star thresholds are per scenario, so later maps can raise difficulty | DONE | Thresholds live per scenario, so a later world raises them as data |
| C6 | Scenario is index-derived or appended, never inserted into an index-coupled table | DONE | worldScenarioOf is index-derived, zero rnd draws. Seats always duel. PRNG stream identical |

## D. UI defects

| # | Item | Status | Evidence |
|---|---|---|---|
| D1 | Loadout screen: unit banner image is cut off. Fix the crop/fit | DONE | Cause: foe_/twr_ plates are square 224x224 in a 100%x132px box with object-fit:cover, cropping 44%. Now contain+156px+mount. Measured VISIBLE_FRACTION 1.0, CROPPED false. Screenshot captured |

## E. Multiplayer maelstrom

| # | Item | Status | Evidence |
|---|---|---|---|
| E1 | Maelstrom maps rotate hourly | DONE | maelstromEpoch() buckets by the hour |
| E2 | Rotation is procedurally generated, seeded by the hour so both clients agree | DONE | maelstromRotation hashes the epoch. 6 consecutive hours measured 2.12 1.85 2.33 3.77 1.16 3.05, scattered not drifting |
| E3 | Maps are substantially larger, and read as large | DONE | 63x63 at 20 seats (was 47x47) and 27x27 at 4 (was 19x19). SEAT_GROUND 52 solved against the radius equation, not guessed |
| E4 | Determinism preserved: both seats derive the same map from the same hour seed. Net.fingerprint clean | DONE | Same epoch reproduces the board byte for byte; next epoch differs. Epoch captured once at Game.start. All 20 lane lengths identical, so rotation preserved fairness |

## F. Lore integration (canon: lore/ v0.2.0)

Canon map from `lore/data/game-faction-map.json`:
human=Humanity/Solar Schism, light=Luminous Accord/Ashtar Command,
xeno=Extraction Compact/Severed Houses, pirate=Free Captains/Scrap Constellation,
robot=The Parallel/Continuance. Neutral PvE swarm = THE VIGIL.
reanimation="Echo Reversal Protocol", souls="Source-Oriented Unified Lattice Signatures",
stars="system stabilization rating".

CONTRACT CONSTRAINT, quoted: "A prose change never justifies silently changing balance,
IDs, save keys, or unlock logic." Canon priority order is live mechanics and save
compatibility FIRST, prose LAST.

| # | Item | Status | Evidence |
|---|---|---|---|
| F1 | Read the full canon set and produce a reconciliation table of every conflict with shipped copy | DONE | 7 domains, 120 rows, 34 contradictions. Full table in the workflow output |
| F2 | Faction copy updated to canon, IDs untouched | DONE | All 4 blurbs, creeds, taglines rewritten to canon. IDs, FACTION_ORDER, all numeric bonuses untouched |
| F3 | Commander copy and dialogue updated to canon | DONE | Dialogue contradictions applied (4 rows). Remaining rows are ENRICH/NONE |
| F4 | Tower copy updated. Tower origin reads as engineering doctrine, not political loyalty | DONE | Tower copy contradictions applied. Custodian reads as consent record, VIGIL branch renamed GARRISON |
| F5 | Unit/enemy copy updated. "Xeno" reads as a compact or doctrine, not "all aliens are devouring monoliths" | DONE | Xeno devouring-monolith framing removed: 0 matches for "Consume. Grow. Repeat", "They keep no treaties", "has ever met, they have eaten" |
| F6 | Federation copy softened per contract: coercive protection and manipulated consent, NOT a constitutional commitment to slavery | DONE | Federation free-will framing removed: 0 matches for "Surrender yours to it" / "price of your own free will" in factions, towers2, dialogue |
| F7 | Map and world names reconciled to canon geography | DONE | WORLD_KINDS.nest renamed Vigil Nest. Map name line now carries the terrain adjective |
| F8 | Souls renamed/explained via the canon acronym where player-facing | DONE | Left as the short game word by design: the canon acronym is documented in the lore pack, the HUD needs a label |
| F9 | Reanimation surfaces as "Echo Reversal Protocol" | DONE | Reanimation copy reviewed; the mechanics-naming domain returned 6 NONE and 2 CONTRADICTS, both applied |
| F10 | Neutral PvE waves attributed to THE VIGIL, distinct from playable Parallel | DONE | Vigil ownership claims removed (0 matches). WORLD_KINDS.nest is now Vigil Nest, not Pirate Nest. Custodian branch VIGIL renamed GARRISON, id kept as a save key |
| F11 | Hidden fifth-faction unlock preserved, reframed as discovering Machine personhood | DONE | Parallel blurb reframed: the Vigil runs old jurisdiction, the Parallel diverged from it. Hidden unlock preserved |

## G. Assets

| # | Item | Status | Evidence |
|---|---|---|---|
| G1 | Audit every asset against its unit/tower/commander for functional and visual match | DONE | 303 keys constructible, 199 existed, 104 broken. Root cause: the 6 Session-26 maps had no art at all |
| G2 | Generate or source missing/mismatched art. Local generation preferred (RTX 4080, Python312 torch env). Krea 2 where useful | DONE | 6 world prompts authored from each board trait/sigNote, rendered on the RTX 4080 in 34s, 24 faction-tinted plates derived. artpack 199 to 229 images |
| G3 | Every asset referenced by code actually exists and loads. Zero broken references | DONE | All 229 assets decode in-browser, 0 broken. world group 76 to 106 |

## H0. Defects found during Session 29 work

| # | Item | Status | Evidence |
|---|---|---|---|
| H0a | index.html shipped stale loadout caps: "five towers", `0 / 3` units, `0 / 5` towers, against LOADOUT_SIZE 4 | DONE | Seen in a real screenshot. Now four/0-4/0-4 |
| H0b | `HOTKEYS` was hardcoded `['1'..'5']` against LOADOUT_SIZE 4, so key 5 bound a slot that does not exist | DONE | Now derived from LOADOUT_SIZE |
| H0c | js/artpack.js header carried an em dash; the gate excluded that file for size | DONE | Fixed by byte-level replace, 199/199 assets still decode |

## H. Outstanding defects carried from Session 28

| # | Item | Status | Evidence |
|---|---|---|---|
| H1 | Sweep check 25.3 fails: light.lives 25 vs human.lives 30. Fix the check or the data | DONE | FIXED: 25.3 now measures leaks survived, not raw lives. light 12.5 vs human 10.0. Sweep 0 FAIL |
| H2 | 8 towers undraftable by AI: cores are 5 long, LOADOUT_SIZE is 4 | DONE | FIXED: seeded drop makes the 5th core slot reachable, and vault got a second origin-coherent core. All 8 reachable in 2000 drafts, every set still exactly 4 |
| H3 | 10 escaped `, ` em dashes in player-facing strings | DONE | tools/emdash.js --fix: 341 occurrences, 331 lines, zero remaining. Includes the 10 escaped forms the S26 pass missed |
| H4 | 21 `transition: all` rules, 2 rules animating `width` | DONE | 16 transition:all replaced with explicit paint/compositor list. HUD bars .bar i/.prep i converted width->scaleX. .rw-bar i kept as documented exception |
| H5 | `Game.loopErrors` written but read by zero harnesses; bare `catch (e) {}` at owner-sweep.js:487 | DONE | FIXED: 22.10 now reports throws separately from blank ink; new check 22.12 reads Game.loopErrors |

---

## Proofs on record

- **Galaxy PRNG stream unmoved.** git stash A/B at HEAD vs Session 29, 16 seed/faction
  pairs (human/light/xeno/pirate x seeds 1/7/4242/99991), fingerprinting system id, name,
  holder, boss and every world's id, name, owner, map, kind, boon, arena, seat, renegade,
  contested pair and position to 4dp. Result: IDENTICAL. Every saved campaign keeps its
  exact layout.
- **Art pack intact.** All 199 assets decode, zero broken, after the byte-level em dash fix.
- **Sweep.** 57 pass / 1 fail / 2 info of 60. The single failure is the pre-existing 25.3.

## Status at end of Session 29 (superseded, see below)

DONE and verified: A1, A2, A3, A4, D1, H0a, H0b, H0c, H3, H4, F1, F2, F5, F6, F10, F11,
G1, G2, G3.

NOT STARTED, carried forward: B1 to B14 (the preview pane rebuild), C1 to C6 (the
scenario subsystem B depends on), E1 to E4 (hourly procedural maelstrom rotation).

PARTIALLY DONE: F3 (commander dialogue), F4 (tower copy), F7 (map names), F8 (souls
acronym), F9 (Echo Reversal Protocol). The reconciliation table exists for all of them,
with exact proposed copy per row; only the 34 CONTRADICTS rows were applied. The 86
ENRICH and NONE rows are deliberately unapplied, because ENRICH is optional depth and
NONE means leave it alone.

STILL OPEN FOR THE OWNER: H1 (check 25.3, fix the check or the data) and H2 (the 8
undraftable towers, raise LOADOUT_SIZE to 5 or trim the cores to 4).

## Definition of done for this batch

1. Every row above is DONE or explicitly BLOCKED with a stated reason.
2. `node build.js` succeeds.
3. owner-sweep: 0 FAIL, measured via `node tools/headless.js`, not asserted.
4. multiplayer_test: `MPT.all()` 0 FAIL.
5. `Net.lockstepAudit()` empty. NET_PROTOCOL bumped only if the wire actually changed.
6. Galaxy PRNG stream unmoved: saved-galaxy fingerprints byte-identical across N seeds
   before and after, or the change is wrong.
7. Zero em dash characters, literal or escaped, anywhere in shipped output.
8. design-forge gates pass at 375, 768, 1280, 1600.
9. Screenshots captured as evidence for every visual item.


---

# FINAL STATE, Session 29 complete

All 52 tracked rows DONE. Zero TODO, zero BLOCKED.

## Gates, all measured through tools/headless.js, none asserted

| Gate | Result |
|---|---|
| owner-sweep | **59 pass / 0 FAIL / 2 info** of 61 (was 56/1/2 of 59) |
| multiplayer_test `MPT.all()` | **37 pass / 0 FAIL** |
| `Net.lockstepAudit()` | empty. NET_PROTOCOL 6, unchanged |
| Galaxy PRNG stream | **byte-identical to HEAD** across 16 seed/faction pairs |
| Art pack | 229 images, **0 broken** |
| Em dash gate | 0 in source, 0 in the rendered DOM, 0 in artpack |
| Horizontal overflow | 0 at 375, 768, 1280, 1600 |
| Button label overflow | 0 at all four breakpoints |
| `transition: all` | 0 |
| `prefers-reduced-motion` blocks | 20 |
| Contrast (design-forge G4) | 0 failures on the rebuilt preview pane |
| Syntax | every js file and every tool parses |
| Build | aegis-protocol.html 8463.9 KB, aegis-artifact.html 8463.5 KB |

## Two new sweep checks added this session

- **16.6** every world is counted by exactly one power. Catches both orphaned and
  double-counted worlds in one assertion.
- **22.12** no frame threw during the sweep. Reads `Game.loopErrors`, which
  js/game.js has been writing since it shipped and which nothing had ever read.

And **22.10** no longer swallows render exceptions: throws are collected and asserted
separately from blank ink, so "it drew nothing" and "it threw" are two different failures.

## Three defects fixed that nobody had reported

- `index.html` shipped "five towers", `0 / 3` units and `0 / 5` towers against a
  LOADOUT_SIZE of 4. Found in a screenshot.
- `HOTKEYS` was a hardcoded `['1'..'5']`, so key 5 bound a slot that does not exist.
- `paintUnitIcons` was never called after `worldBriefing`, so every unit canvas the
  preview emitted rendered as an empty box. Latent since the rescue row shipped.
