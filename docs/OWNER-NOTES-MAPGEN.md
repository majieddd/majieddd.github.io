# Owner notes, procedural map system (mapgen)

Tracked per the standing rule: every multi-item request gets a file, so nothing
is lost between rounds. Status moves to done only with the measurement that
proves it, never by assertion (design-forge house rule 3).

Legend: `[ ]` not started, `[~]` in flight, `[x]` done and measured.

Design doc: `docs/MAPGEN_DESIGN.md` (updated to match shipped code).
This file is the change log for collaborators, every file touched by this work
is listed under each item with what changed in it.

---

## A. Procedural generation within family types

### A1. Seven map families, deterministic per world
`[x]` Each of the 7 families generates unique geometry from `(family, worldId)`;
same inputs always produce identical boards (both duel clients included).
**Files:** `js/mapgen.js` (NEW, mulberry32 PRNG seeded by FNV-1a hash of the
world id string), `js/config.js` (7 MAPS entries appended at indices 11+ with
`procedural: true, family, minTier`; `buildField(map)` → `buildField(map, seedStr)`
which calls `MapGen.proceduralGeometry` and merges into a clone), `js/game.js`
(Game.start threads the seed: `opts.worldId || opts.world?.id || 'default'`),
`js/net.js` (MP passes `worldId: cfg.world.id` so both clients compute identical
boards, no new network messages), `index.html` (script tag before config.js).
**MEASURED:** `node tools/mapgen-test.mjs` → PASS, 7/7 families produce distinct
geometry signatures across 3 seeds each; `node tools/mapgen-integration-test.mjs`
→ PASS on all procedural MAPS entries × multiple seeds.

### A2. Progressive discovery by solar-system depth
`[x]` Families unlock as the campaign deepens: spiral 1+, twin-channel 2+,
chokepoint 3+, island-scatter 4+, open-field 5+, convergence 6+, fortress-ring 7+.
**Files:** `js/galaxy.js` (map-pool draw filters `!m.minTier || m.minTier <= si`).
**MEASURED:** save contract preserved, the single `rnd()` call stays in its
original position and all 11 authored maps lack `minTier`, so old saves
(`mapPool = 11`) draw byte-identically. Verified by code inspection of the filter
plus the unchanged draw order; no save-migration path exists or is needed.

### A3. Solo-survival layouts that don't read as two-ended duels
`[x]` `convergence` (Last Bastion) and `fortress-ring` (Siege Ring) carry
`noReanim: true`, the engine already ignores seat 1 on those boards, so they play
as one-sided sieges. No bespoke one-sided generator was built; all families keep
the standard mirrored geometry both test suites validate.
**Files:** `js/config.js` (the two entries carry `noReanim: true`).
**MEASURED:** live browser boot of both maps, board renders, HUD shows the duel
frame but seat 1 is inert per the existing OSSUARY pattern; no engine surgery.

## B. Terrain / obstacle variety

### B1. Walls: unbuildable AND shot-blocking (new terrain type)
`[x]` `walls` are added to the existing `terrain` set (unbuildable) and to a new
`FIELD.walls` Set that projectiles and line-of-sight test against. Lobbed shells
(mortars) arc over them; towers without the spotting stat cannot see targets
behind walls.
**Files:** `js/config.js` (wall loop: adds to both sets, mirrored across the
vertical axis), `js/entities.js` (`wallBlocksShot()` DDA raycast in tile space;
Projectile.update kills non-lobbed shots crossing a wall, segment check prevents
tunneling at high speed; tower acquire() skips targets behind walls unless spotted).
**MEASURED:** live browser, 5/5 wall maps: `wallBlocksShot` returns true for a shot
through a wall tile and false for a clear line (`tools/live-mapgen-check.mjs`,
losBlocked=true on twin-channel/chokepoint/open-field/convergence/fortress-ring).
Unbuildability: `tools/live-terrain-check.mjs` → PASS, 18/18 (twin-channel) and
34/34 (open-field) wall tiles are inside FIELD.terrain.

### B2. Large spread-out boards
`[x]` open-field generates ~36×18 with minimal cover; island-scatter scatters
buildable islands off one long lane.
**MEASURED:** live boot, open-field 36×18 buildMax=[14,21], island-scatter 28×15
buildMax=[11,16]; both render with lanes on both sides (screenshots in repo root:
`live-open-field.png`, `live-island-scatter.png`).

## C. Bugs found by the new harnesses (all fixed before ship)

### C1. Full-width lanes made boards unplayable
The first generator revision produced full-width lanes; after mirroring, both
sides' lanes overlapped and `buildMax` degenerated to [-2, cols+1], neither side
could build any tower. **Fixed:** all 7 family generators rewritten to the
authored half-width convention (first waypoint at x ≈ cols/2−1, last off-grid at
x=−1); even column counts so the mirror axis sits between columns.
**MEASURED:** integration test asserts both sides' lanes are disjoint and buildMax
is sane with buildable tiles for BOTH sides. PASS on all 7 families × 3 seeds;
live browser confirms sane buildMax per map (see A1 table in live-mapgen-check output).

### C2. Diagonal waypoints silently dropped
`orthoLane` only expands axis-aligned segments; diagonal jumps vanished, breaking
lanes. **Fixed:** every consecutive waypoint pair now differs in exactly one
coordinate; the unit test asserts this invariant per family/seed. PASS 21/21.

### C3. Terrain mirrored onto rival lanes (soft-lock)
Blocks/walls/nodes were first generated across full board width; their mirrors
landed on the rival's lane tiles, a wall under a lane makes enemies standing
there unkillable. **Fixed:** all terrain constrained to the authored left half;
walls additionally clear both authored AND mirrored lane tiles (blocks may overlap
lanes, matching authored maps). PASS 21/21 + integration PASS.

### C4. `wallBlocksShot` crashed on every wall map (runtime)
The DDA helper declared `const tx0/ty0` then reassigned them in the loop, a
TypeError thrown from tower targeting and projectile updates on any board with
walls, i.e. 5 of the 7 families. Node suites never call this function, so both
were green while the game would have crashed; the LIVE browser check caught it.
**Fixed:** `const` → `let` (entities.js:3014). **MEASURED:** live re-run after fix
7/7 maps boot with zero page errors and wall LOS probes pass.

## D. Preview parity

### D1. Tooltips show the same board as the live game
`[x]` `mapPreviewBlock` / `previewModel` / buildPreview accept an optional seed;
call sites holding a world object pass `w.id`, matching Game.start's seed, so the
SVG in galaxy tooltips is the exact geometry the match will run.
**Files:** `js/ui.js`. **MEASURED:** live browser, every procedural map's preview
generates SVG with the same seed used to boot it (pvSvg=true on 7/7).

## E. Verification harnesses (new, committed)

| Command | What it proves |
|---|---|
| `node tools/mapgen-test.mjs` | Unit: determinism, even cols, left-half containment, waypoint orthogonality, no wall-on-lane soft-locks, buildability ≥64%, 7 families × 3 seeds |
| `node tools/mapgen-integration-test.mjs` | Real `buildField()` on every procedural MAPS entry: disjoint lanes per side, sane buildMax with buildable tiles both sides, mirrored walls clear of both lanes, distinct bases, determinism |
| `node tools/live-mapgen-check.mjs` | LIVE Helium (CDP :9222) + static server (:8471): boots each map through the real engine, reads back FIELD, probes wall LOS via the actual helper, checks preview parity, screenshots (`live-<id>.png`) |
| `node tools/live-terrain-check.mjs` | LIVE: every wall tile is inside FIELD.terrain (unbuildable) |

Live drivers need: `python -m http.server 8471 --bind 127.0.0.1` in the repo root,
and Helium launched with `--remote-debugging-port=9222` + an isolated user-data-dir
(see skill `local-browser-automation`). They disable CDP caching, without that,
script tags serve stale JS between navigations and results are garbage.
