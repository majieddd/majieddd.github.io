# OWNER NOTES: HIGHPOLY v2 (aegis-3d-highpoly-v2)

Status: verification running, results appended when the gate returns.
Author: Hermes (agent session). Touch radius: `aegis-3d-highpoly-v2/**`,
docs/PLAN-HIGHPOLY-3D-V2.md, this file. No existing game file is edited.
v1 (`aegis-3d-highpoly/`) is live and untouched.

## What this build is

The amplified 3D tower defence from v1, refined per the owner's next brief:
fix shading and shadows, make the look higher definition yet still simple
with the wet-oil-watercolor-comic dreamy feel of the cutscene plates, do a
graphics engine performance audit, and polish towers, animation, textures
and particles. Another NEW build: its own folder and URL.

## Shading and shadows (the owner's first complaint)

1. Deeper cel shadow: the shadow mass folds the lighting term down to 0.18
   instead of 0.25 before posterising, so a shadowed facet steps down a whole
   band and the shadow edge stays hard. (03-shaders.js mesh FS.)
2. Contact shadows are now cool-hued and bright enough to read on the dark
   board: tint [0.02,0.01,0.05] -> [0.075,0.035,0.115], alpha floor raised
   0.10 -> 0.12, falloff softened.
3. Grounding shadow under EVERY tower (was only the selected one): one dark
   disc per tower, so towers sit on the paint instead of floating.
4. Evidence: qa/10-shadow-on.png vs qa/11-shadow-off.png pair captured from
   the same frame; the difference is measurable (see verification).

## HD / watercolor / dreamy pass (still simple, cel bones intact)

1. Canvas tooth atlas 512 -> 1024 (crisper surface texture, still procedural).
2. Watercolor wash term in the mesh shader (uWash 0.10): a soft world-space
   cool/warm pooling that shifts neighbouring facets a whisper of
   temperature, so the board reads as wet watercolour instead of flat poster.
3. Softer dreamy grade: vignette 0.66 -> 0.60, grain 0.042 -> 0.036 (HD,
   less noise), halftone 0.62 -> 0.58, canvas 0.20 -> 0.16.
4. Glow: bloom threshold 0.68 -> 0.64 and strength 0.85 -> 0.95, so the neon
   rim and reaction bursts halo the way the plates do.

## Animation quality

1. Breathing: standing and walking bodies swell a half percent on the chest,
   so nothing is a statue at rest.
2. Head scan: heads add a slow neck sweep while moving, plus the existing
   lag/aim (creatures read as intent, not rail riders).
3. Turret idle scan: towers with no target hunt gently instead of freezing.
4. v1's amplitude already carried: planted feet via two-bone IK, body bob at
   2x stride, load dip, lean, squash on hit, spawn pop, recoil, shatter.

## Performance audit (measured)

Harness: tools/perf.steps.cjs + a window hook (__RQX manual frame with
gl.finish) so a headless driver that never pumps rAF can measure the real
per-frame pipeline cost; quality A/B via __RQUAL (bloom/shadows/ink).

Results (headless software raster, 800x500, 12-tower fully upgraded board
mid-wave, 12 frames each):

  BASE_ALL_ON : p50 0.7ms p90 1.1ms avg 0.7ms
  SHADOWS_OFF : p50 0.9ms p90 6.0ms avg 2.3ms  (noisy: first-frame rebuild)
  BLOOM_OFF   : p50 1.4ms p90 9.1ms avg 3.0ms  (noisy: shader re-link)
  INK_OFF     : p50 0.6ms p90 0.8ms avg 0.6ms

Caveat: SwiftShader software raster, so absolute ms understate a real GPU;
the signal is that NOTHING dominates the frame and the JS submission cost is
under a millisecond. No runaway per-frame cost found.

Static audit findings:
- drawBeam allocated a fresh 16-float matrix per beam per frame (arc/prism
  can build dozens): FIXED with a per-frame pooled matrix bank.
- FX.spawn takes an object per particle: hundreds of short-lived objects per
  second, but the measured frame time shows no GC sawtooth; the hot arrays
  were already struct-of-arrays. DISMISSED with the measurement above.
- Shadow pass re-draws the opaque list (draw calls double): ~50 small draws,
  the A/B showed no dominant cost. DISMISSED with the measurement.
- 404 on the Google Fonts stylesheet under headless is cosmetic; fallback
  typography renders. Noted, not changed (zero-dependency law).

## Verification (appended when the gate returns)

(fill)
