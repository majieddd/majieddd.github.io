# AETHER MAP + TEXTURE ROUNDS (owner directive: better map environment, paving, and a moving-creature texture aberration; 3 rounds with a developer team)

## Round 1 - implementation (this pass)
TEXTURE ABERRATION ROOT CAUSE (found by owner, confirmed by code):
The material detail atlas is sampled in WORLD space. A creature walking across
the board therefore wore a texture that stayed glued to the world and slid
under its body (surface "swims"). FIX: per-draw uDetailAnchor uniform in
MESH_HD_FS = the model matrix translation of each draw (render.js opaquePass).
Static scenery (terrain, pads, rim, decor) passes identity -> anchor [0,0,0]
and stays world-locked. Moving rig parts ride the body (pattern travels with
the moving model origin, and the pattern follows a part's own frame).

MAP ENVIRONMENT:
1. PAVING: every build plot now gets a machined hex pad slab (prism 1.32 x
   1.30 x 0.32, top ~0.26 above ground, clean stone family #3a2f66/#42366e/
   #332a5c, jitter 0.015), merged into ONE padData mesh; plot rings raised
   p.y+0.12 -> p.y+0.30 so highlights ride the slab; hover range ring too.
2. RIM WALL: the plate was a sheet with a cliff hole - now a two-tone skirt
   around the whole boundary: cap band #241b45 (1.15u) and body #191336,
   falling to y=-12. Perimeter generated CCW so all quads wind outward
   (verified by analysis; winding gate rerun at ship).
3. SPIRES: were sceptres floating in the void (radius 1.02-1.32, baseY
   -3.2..-5.2). Now radius 0.72-0.94 (inside the height grid), seated ON the
   rim slope via baseY = heightAt - 0.35; clamped inside the board; still
   castShadow:false so they never bury the board in shadow.
4. DECOR: fewer (95 -> 78 attempts), bigger (0.30..1.45 -> 0.5..1.4), so the
   scatter reads as deliberate boulders rather than dots.
Team (3 subagents) dispatched in parallel: environment art director,
texture/rendering engineer (empirical swim test + world-space audit of all
animated geometry), QA tester (placement/pads, fps, HUD).

## Round 2 (environment director's 7 findings -> all implemented)
1. Pads: terrain flattened under every plot (height corners blended to plot
   height within 2.2CS BEFORE the ground mesh builds) + flush top (+0.10) +
   buried flared skirt (widening prism diving to -0.46) -> no floating coins,
   no poke-through, no air gap. Verified by QA: tower sits cleanly on pad.
2. Spires: max radius 0.80 (clear of the drop band), embedded max(1.0,
   rad0*0.55), bedrock collar prism added under each, count 11 -> 7 with a
   0.12-minHalf spacing reject -> no floating, no picket fence.
3. Rim: ground drop softened to smoothstep(0.90,1.00)*2.2 so the wall IS the
   cliff; cap #463a7c (lighter than ground = lit ceiling) at 1.8u band; body
   #0b0914 -> one hard cliff line, plate reads as a carved monolith.
4. Decor: ico subdiv 1, y-scale 0.8-1.4 (not discs), sunk 0.12, path reject
   1.6 widths, 52 attempts -> rounder framing boulders, not gears.
5. Pad palette tied to the ground family (#2c2454/#332a5f/#241c45 - no third
   material family).
6. Path palette widened (#9a6288/#b06b9b added) -> corduroy broken, strokes
   land on distinct bands.
7. Plot rings: resting alpha 0.45 -> 0.32? (kept 0.45 for gameplay clarity;
   the ring is a placement signal, left legible).

## Round 2 (rendering engineer + QA, both hit the 600s wall mid-verdict)
- Engineer: confirmed pattern visible on body at P1 and P2 (24 units apart,
  body-relative), then built a contrast A/B by toggling the anchor (world-
  locked) - its contrast captures confirm the anchored build is correct and
  the disabled build shows the world-glued grid. Timeout before final prose;
  left a temporary anchor=0 patch in js/05-render.js (REVERTED; verified by
  git diff and restored the model-anchor version).
- QA: tower sits cleanly on pad; HUD legible; plot pick lands exactly on
  target (p14_2) through the real pointer path; a TypeError in its own
  diag eval was reproduced clean (all error buffers empty) and was a probe
  transient, not a game bug. Timeout before consolidated summary.
- Improvement from own A/B evidence: unit detailScale 1.5 -> 0.75 (the
  magnified metal-grid read through as machine squares; at 0.75 the body
  reads as fine shell/hide ridges).

## Round 3 - environment director final verification (in flight)

## PLANET PASS (owner directive: make it look like a globe/planet)
- Spherical sag on the whole height field (SAG_R 300): the ground bends toward
  the horizon; gameplay flatness preserved (heightAt knows the sag).
- The rim wall was REPLACED by the world itself: a huge lathe sphere (R 300,
  crown 0.35 under the board centre, latitude bands #241b52 / #1a1240 /
  #120d2c / #100b26) sized so the board edge dives below its surface: the
  border reads as shoreline on a globe, no floating slab, no gaps.
- Vision verified from horizon, wide and top-down angles: curved horizon
  arcing on both sides, towers silhouetted against the world, board still
  fully readable in play view. Gate: 78/78 + 45/45 (V.3 floor re-satisfied
  with SAG_R 300 + exposure 1.14 + ambient 1.26 after the sag darkened the
  sampled plots).

## HALFWORLD (owner directive: massive map, multiple gates, windy roads, half
## the sphere, smaller world, playable option)
- NEW BOARD: id 'halfworld', gw 56 x gh 34 (cell 3.2 = 179 x 109 units),
  per-board sagR 120 / planetR 150 (small world: edges sag ~28 units; the
  playfield is terraced by the pad-flattening which reads as carved worlds).
- ROUTE: 24 waypoints, ~700 units; three rim-touch gates (N, SW, NE arms)
  feeding one winding highway, exits at the far rim. Windy S/switchback
  serpentine across half the globe.
- SUITE: verify 1.6 updated 3 -> 4 boards (content-count assertion, content
  intentionally expanded; the check's purpose - no silent board - is kept),
  2.7 label -> all four. All four boards pass 2.7 (lane inside plate,
  plots >= 18).
- MEASURED: gate 78/78 + 45/45; HALFWORLD perf 145 fps, 63 draws, 123 plots,
  14 towers; menu lists 4 boards.
