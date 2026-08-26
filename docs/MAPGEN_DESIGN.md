# Procedural Map System. Design

## Goal
Incredible depth of variety in how maps function: procedurally generated geometry per-world,
terrain that blocks shots, large boards forcing spread, progressive discovery by system depth,
and solo-survival layouts that don't feel like two-ended duel boards.

## Architecture

### New file: `js/mapgen.js`
Exports a single entry point:
```
generateProceduralGeometry(family, seed, params) → { lanes, blocks, nodes, cols, rows }
```
Deterministic: same (family, seed) always produces the same geometry.
Seed is derived from the world id (`s0w3`), which both duel clients share via Net.table.

### Map families (archetypes)
| Family | Feel | Tier gate | Solo? |
|--------|------|-----------|-------|
| `spiral` | Long winding inward spiral, crossed by its own exit | 1+ | no |
| `twin-channel` | Two parallel channels split by a silt bank (no cross-fire) | 2+ | no |
| `chokepoint` | Narrow corridor with 2-3 alcoves; nothing covers two legs at once | 2+ | no |
| `island-scatter` | 3-5 disconnected buildable islands hanging off one long lane | 3+ | no |
| `open-field` | Very large board (40×22), minimal cover, forces spread | 3+ | no |
| `convergence` | Multiple lanes converge on ONE base; siege/last-stand feel | 1+ | **yes** |
| `fortress-ring` | Ring of walls around a core; enemies must break through gaps | 4+ | yes |

### Terrain types (new)
- `blocks` (existing): unbuildable, transparent to shots (rubble, water)
- `walls` (NEW): unbuildable AND blocks projectiles + line-of-sight. Mortars arc over.
  Stored as `map.walls = [[x0,y0,x1,y1], ...]`. buildField adds them to a separate
  `FIELD.wallSet` in addition to the existing `terrain` set.

### Progressive discovery (tier gating)
- `generateGalaxy()` already assigns maps from a pool. Procedural families are added
  to that pool with a `minTier` field. The pool filter becomes:
  `MAPS.filter(m => !m.tri && (!m.minTier || si >= m.minTier))`
- Early systems (si=0,1) only see basic families; deep systems unlock exotic ones.

### Solo-survival layouts
- Families flagged `solo: true` produce ONE-SIDED geometry:
  - All lanes converge on a single base at the left edge
  - No mirror, `buildField` detects `map.solo` and skips the mirror step
  - Enemies spawn from multiple directions (right, top-right, bottom-right)
  - The far "seat" is absent; the board reads as a fortress under siege
- Assigned to worlds running `noCommander` scenarios (swarm, overrun, vigil)

### Integration points
1. **config.js MAPS**: New entries with `{id:'proc_spiral', procedural:true, family:'spiral', ...}`
2. **config.js buildField()**: If `map.procedural`, call `generateProceduralGeometry(map.family, seed)` to fill in lanes/blocks/nodes before proceeding
3. **game.js Game.start()**: Pass world id as seed: `buildField(this.map, opts.world || 'default')`
4. **entities.js Projectile.update()**: Check wall collision (non-lobbed projectiles die on wall hit)
5. **entities.js Tower.acquire()**: Line-of-sight check against walls (skip targets behind walls unless mortar/spotting)
6. **ui.js mapPreviewBlock()**: Pass seed so preview matches the actual board
7. **index.html**: Add `<script src="js/mapgen.js"></script>` before config.js
