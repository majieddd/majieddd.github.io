# PLAN-HIGHPOLY-3D-V2: Cosmic Conquest: HIGHPOLY v2

**Status: FROZEN SPEC. Completion criteria at the bottom are write-once.**
Author: Hermes (agent session). Touch radius: `aegis-3d-highpoly-v2/**`,
this file, docs/OWNER-NOTES-HIGHPOLY-3D-V2.md. No existing game file is
edited. v1 (`aegis-3d-highpoly/`) stays live and untouched.

## Objective (owner's words, translated into checks)

1. Fix shading and shadows so they read properly (the cel look stays).
2. A graphics engine performance audit, with measured improvements.
3. All towers functional; unit animations correct and high quality.
4. Textures, particles, animation polished again: higher definition yet
   simple, carrying the wet-oil-watercolor-comic dreamy look of the cutscene
   plates (reference: /narrative/human.html plates).
5. Ship as ANOTHER NEW build: new folder, new URL.

## Changes in v2 (each item below was made)

1. Shadow readability: deeper shadow fold in the cel ramp (0.25 -> 0.18),
   cool-hued contact pools brightened (tint 0.02,0.01,0.05 -> 0.075,0.035,0.115
   and alpha floor 0.12), grounding shadow under EVERY tower (was selected
   only). Evidence: qa shadow A/B and mid-battle shots.
2. Watercolor-comic dreamy pass: world-space watercolor wash term (uWash
   0.10) in the mesh shader, canvas tooth atlas 512 -> 1024 (HD), grain
   0.042 -> 0.036, halftone 0.62 -> 0.58, canvas 0.20 -> 0.16, vignette
   0.66 -> 0.60, bloom threshold 0.68 -> 0.64 and strength 0.85 -> 0.95
   (soft glow, dreamier lights). Art constants live in one block.
3. Animation quality: breathing swell on standing bodies, head scan while
   moving, turret idle scan sweep when unpanned, plus the v1 gait/IK/spring
   base. All procedural, no authored keyframes.
4. Performance audit hook: window.__RQUAL to A/B shadow/bloom/ink in place;
   perf.steps.cjs samples real-rAF frame times (p50/p90/p99) across a fully
   upgraded 12-tower battle; each pass A/B'd. Findings and fixes logged in
   the OWNER-NOTES doc. NOTE: headless Chrome in this harness renders on
   SwiftShader (software), so absolute ms are a lower bound of real GPUs;
   the RELATIVE cost of each pass is the signal that matters.

## Completion criteria (FROZEN, write-once)

1. `node tools/gate.js`: parse, no em dash, winding, css, build,
   verify 78/78, adversarial 28/28, all against the v2 URL.
2. Shadow A/B: the same frame captured with shadows on vs off differs
   measurably (pixel diff over the scene), and the on-frame reads.
3. Perf audit table logged: BASE vs SHADOWS_OFF vs BLOOM_OFF vs INK_OFF
   with p50/p90/p99; at least one measured optimization shipped (or a
   finding dismissed with measured reason).
4. All-tower functional check green via verify harness (per-tower entries).
5. Unit/tower animation observed in staged screenshots (menagerie + boss
   close-up): legs planted, bosses large and articulated, no dead-static
   posing visible.
6. Screenshots recorded (menu, build, wave, reaction, menagerie, boss).
7. Committed by explicit path: aegis-3d-highpoly-v2/**, this file,
   docs/OWNER-NOTES-HIGHPOLY-3D-V2.md; v2 live at
   https://majieddd.github.io/aegis-3d-highpoly-v2/ verified by fetching.
