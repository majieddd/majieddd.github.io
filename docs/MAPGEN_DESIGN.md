# Procedural Map System. Design (as shipped)

## Goal
Incredible depth of variety in how maps function: procedurally generated geometry per-world,
terrain that blocks shots, large boards forcing spread, progressive discovery by system depth,
and solo-survival layouts that don't feel like two-ended duel boards.

## Architecture

### New file: `js/mapgen.js` (loaded before config.js in index.html)
Exports one entry point on the window global:
```
MapGen.proceduralGeometry(family, seedStr) → { lanes, blocks, walls, nodes, cols, rows }
```
Pure function. Deterministic: same `(family, seedStr)` always produces identical geometry.
PRNG is mulberry32 seeded by an FNV-1a hash of the seed string (the world id).

**Geometry convention (critical — authored maps set it):** lanes are HALF-WIDTH. The first
waypoint sits near the mirror axis (`x ≈ cols/2 - 1`), the last one tile off-grid at `x = -1`.
`buildField()` mirrors them for the rival side; enemies march AWAY from each other. All terrain
(blocks/walls/nodes) is authored in the LEFT half only and mirrored by buildField. Column counts
are even so the mirror axis falls BETWEEN columns, never on a lane tile. A wall under a lane tile
is a soft-lock (enemies standing there are unkillable), so `generateWalls` clears both the
authored AND the mirrored lane tiles; blocks may overlap lanes (authored maps do).

### Map families (archetypes) — shipped gates in config.js MAPS
| Family | Feel | minTier | Solo? |
|--------|------|---------|-------|
| `spiral` (Vortex Reach) | Long winding inward spiral, crossed by its own exit | 1+ | no |
| `twin-channel` (Twin Straits) | Two parallel channels split by a silt bank of walls | 2+ | no |
| `chokepoint` (The Narrows) | Narrow corridor with alcoves; nothing covers two legs at once | 3+ | no |
| `island-scatter` (Shattered Shoals) | Disconnected buildable islands hanging off one long lane | 4+ | no |
| `open-field` (The Expanse) | Very large board (~36×18), minimal cover, forces spread | 5+ | no |
| `convergence` (Last Bastion) | Multiple lanes converge on the base; siege/last-stand feel | 6+ | **yes** (`noReanim`) |
| `fortress-ring` (Siege Ring) | Ring of walls around a core; enemies must break through gaps | 7+ | **yes** (`noReanim`) |

### Terrain types
- `blocks` (existing): unbuildable, transparent to shots (rubble, water). May overlap lanes.
- `walls` (NEW): unbuildable AND blocks projectiles + line-of-sight. Lobbed shells arc over.
  Stored as `map.walls = [[x0,y0,x1,y1], ...]`. buildField adds them to the existing `terrain`
  set (so they are unbuildable) AND to a separate `FIELD.walls` Set of `"tx,ty"` tile keys that
  projectiles and LOS test against.

### Progressive discovery (tier gating)
- The galaxy map-pool draw filters: `MAPS.filter(m => !m.tri && (!m.minTier || m.minTier <= si))`.
  Early systems only see basic families; deep systems unlock exotic ones.
- **Save contract preserved:** the single `rnd()` draw stays in its original position (only the
  pool it draws from is filtered, trailing entries removed). Old saves pin `mapPool = 11`
  (commanders.js), and all 11 authored maps lack `minTier`, so their draws are byte-identical.

### Solo-survival layouts
All families produce standard two-sided mirrored geometry — no separate engine path. The
solo-flavoured families (`convergence`, `fortress-ring`) carry `noReanim: true` (like OSSUARY):
the engine already ignores seat 1 on those boards, so the player experiences a one-sided
siege/last-stand rather than a duel. This was chosen over a bespoke one-sided generator to keep
the mirror invariants (and both test suites) intact.

### Seeding & multiplayer determinism
- Single-player: `Game.start` seeds from `opts.world?.id || 'default'`.
- Multiplayer: net.js passes `worldId: cfg.world.id` into Game.start opts; the host builds the
  config and the guest receives it verbatim, so both clients compute identical boards. No new
  network messages. Replays never re-run `Game.start`, so no divergence there either.

### Integration points (all shipped)
1. **config.js MAPS**: entries `{id:'spiral', name:'Vortex Reach', procedural:true, family:'spiral', minTier:1}` appended after the authored maps (indices 11+).
2. **config.js buildField(map, seedStr)**: if `map.procedural && typeof MapGen !== 'undefined'`, calls `MapGen.proceduralGeometry(map.family, seedStr || map.id)` and merges into a clone; builds `FIELD.walls`.
3. **game.js Game.start()**: `FIELD = buildField(this.map, opts.worldId || (opts.world && opts.world.id) || 'default')`.
4. **entities.js Projectile.update()**: non-lobbed projectiles die when their path crosses a wall tile (segment check prevents tunneling at high speed). Lobbed shells return early — they arc over cover.
5. **entities.js tower acquire()**: `wallBlocksShot()` DDA raycast in tile space; towers without the spotting stat cannot see targets behind walls. Spotted/lobbed towers can.
6. **ui.js mapPreviewBlock / previewModel / buildPreview**: optional seed threaded through so tooltips show the SAME geometry as the live board (call sites with a world object pass `w.id`).
7. **index.html**: `<script src="js/mapgen.js"></script>` between artpack.js and config.js.

## Verification (run these)
```
node tools/mapgen-test.mjs              # unit: 7 families × 3 seeds, geometry invariants
node tools/mapgen-integration-test.mjs  # buildField end-to-end on all procedural MAPS entries
node tools/live-mapgen-check.mjs        # LIVE browser (Helium :9222 + server :8471): boots each map, probes wall LOS + preview parity, screenshots
node tools/live-terrain-check.mjs       # LIVE: every wall tile is inside FIELD.terrain (unbuildable)
```
