# PLAN-HIGHPOLY-3D: Cosmic Conquest: HIGHPOLY (3D tower defence)

**Status: FROZEN SPEC. Completion criteria below are write-once.**
Author: Hermes (agent session). Branch: `aegis-3d-highpoly`. Touch radius:
`aegis-3d-highpoly/**`, docs/PLAN-HIGHPOLY-3D.md, docs/OWNER-NOTES-HIGHPOLY-3D.md.
No existing game file is edited. The untracked `lowpoly/` and
`narrative/td_lowpoly.html` are someone else's working state, never touched.

## Objective

A **high-poly 3D tower defence** variant of Cosmic Conquest: the same universe,
the same mechanic DNA and roster as the proven LOWPOLY variant, with an art
bar set by the AAA comparison that prompted it. The illustrative
wet-oil-painting look of the cutscene plates (Neon Reliquary: bold flat
brushwork, hard graphic shapes, hued shadows, halftone grain, neon rim light)
translated onto **dense, articulated, lit 3D models** with full unit and tower
animation, high-fidelity synthesized audio, a modern interface, and the juice
layer expected of a AAA demo (hit-stop, screen shake, bloom, particles,
shatter, damage numbers, callouts).

The LOWPOLY variant's known weaknesses become this variant's requirements:

1. Dark flat scene, units unreadable as tiny silhouettes.
2. No visible shadows, no ground contact, no rim lighting.
3. Camera near top-down, flat composition.
4. Terrain texture reads as random splotches, not brushwork.
5. Path visually indistinct from the field.

## Tech decisions

- **three.js r128 UMD**, vendored at `aegis-3d-highpoly/vendor/` (no CDN at
  runtime, works from any static host). Classic `<script>` tags, zero build
  step to play. Vendored UMD files are copied from `aegis-3d/vendor/` (same
  r128, same postprocessing set).
- **Painterly textures generated at runtime** from seeded PRNG on canvas 2D
  (`js/paint.js`): deterministic, zero assets on disk, and 3x the resolution
  of the lowpoly field with directional stroke fields plus halftone grain.
- **Web Audio synthesis for everything** (`js/audio.js`): adaptive layered
  score (pad, bass, arp, percussion gated by intensity), per-tower and
  per-enemy SFX identity, spatial panning, master limiter. No sample files.
- Folder served from the repo root; GitHub Pages URL: `/aegis-3d-highpoly/`.

## Layout (fork of aegis-3d, art layers rewritten)

```
aegis-3d-highpoly/
  index.html          shell, canvas, UI containers (same ids as aegis-3d where
                      the smoke harness uses them)
  css/style.css       NEW: modern glass UI, design-forge tokens and motion law
  vendor/             three.min.js + postprocessing UMD (copied)
  js/util.js          seeded RNG, math, easing, pooling (ported)
  js/paint.js         NEW painterly factory: directional brush field, halftone
                      grain, palette pack, sky nebula with legs, glyphs
  js/audio.js         NEW: adaptive score, spatial pan, per-voice SFX, limiter
  js/data.js          roster (ported, same tunables; balance unchanged)
  js/terrain.js       NEW: displaced high-poly field, carved glowing lane,
                      rocks, crystals, portal and core architecture
  js/fx.js            NEW: pooled particles, trails, shockwaves, muzzle flash,
                      shatter, damage numbers, banner ripples
  js/units.js         NEW high-poly enemy builders + full animation state
                      machines + sim (walk/hover/attack/hit/death/phase)
  js/towers.js        NEW high-poly tower builders + tier evolution + firing
                      + reactions, targeting
  js/commander.js     abilities (ported, new VFX)
  js/game.js          engine: state machine, economy, waves, camera rig, input,
                      juice channels, lighting rig, renderOnce hook
  js/ui.js            NEW: screens, shop with live 3D previews, inspector,
                      banners, callouts, settings
  js/main.js          bootstrap, resize, keyboard, quality prefs
  tools/smoke.mjs     CDP smoke harness (adapted from aegis-3d)
  qa/                 screenshots + logs from the smoke runs
```

## Art direction (locked; what HIGH POLY means here)

- **World**: a floating island in the void, like cut_human_intro_1: a
  teal-navy painted basin with warm amber fire glow at the rim, a carved lane
  crossing it twice. Terrain mesh is a high-res (150k+ triangle) displaced
  plane; ground texture is a 1024-directional brush field with halftone grain.
- **Lighting rig**: warm key light (planet-glow amber) casting PCF soft
  shadows; cool cyan rim light opposite; violet/magenta hemisphere bounce.
  ACES tone mapping, exposure tuned for readability. Screen-space vignette +
  film grain pass.
- **Sky**: painted nebula dome (violet/magenta washes, cyan beam streaks,
  halftone stars), matching the cutscene palette.
- **Models**: every unit and tower built from high-segment primitives
  (spheres 24x18 minimum, lathes, extruded bevels, torus knots) displaced by
  seeded noise; 1.5k to 8k triangles per actor; articulated sub-groups (legs,
  arms, turrets, coils, crystals) driven by pure-function pose recipes;
  emissive neon accent per faction so silhouettes read at gameplay camera.
- **Tier evolution**: each upgrade adds visible geometry (twin barrels, armor
  plates, extra coils, glow core) plus brighter accents.
- **UI**: design-forge gates: one theme (void + cyan accent, faction color as
  status), WCAG AA contrast, motion on transform/opacity only, under 300 ms,
  ease-out; glass panels with backdrop blur; condensed caps + tabular
  monospace numerals; shop cards with live 3D previews; ability buttons with
  cooldown sweeps; cinematic wave banners; end screens with run stats.
- **Audio identity**: deep vaporwave register (SFX_DEPTH 0.62, tempo 84)
  per docs/BRAND.md; every tower has a distinct voice (clack, bell, thump,
  crackle, pop, whine, shimmer, spring, woosh, blip, whoomp, hiss).

## Roster (unchanged from LOWPOLY, keeps the family recognisable)

12 towers (bolt, cryo, mortar, arc, flak, railgun, prism, tether, pyre,
toxin, singularity, canister), 10 enemies + spawnling + mite, COLOSSUS and
HARBINGER bosses with phase scripts, 10 reactions, 4 commanders with Q/E
abilities, 20 waves, 3 difficulties, one hero map (THE CROSSROADS).

## Out of scope (named, not smuggled)

Full 39-tower roster, multiplayer net.js, campaign galaxy, reanimation,
touch-only layout, offline SDXL/Krea artgen (3D paints procedurally instead).
No existing game file is modified.

## Completion criteria (FROZEN, write-once)

1. `aegis-3d-highpoly/` runs over plain HTTP with **no console errors**; a
   16:9 screenshot from mid-battle shows readable units (not dark blobs),
   visible soft shadows, rim-lit models, and a distinct glowing lane.
2. Full loop: start screen to battle to wave 1..20 to victory/defeat screen
   with stats to restart, all reachable via the real input path.
3. All 12 towers placeable via pointer, attack, upgrade twice with visible
   model evolution, sell.
4. All 10 reactions verified firing with callout + damage on marked enemies
   (instrumented probe).
5. All 10 enemy types plus COLOSSUS and HARBINGER spawn and behave per spec
   (flier path, shield, heal, split, summon, boss phases).
6. All 4 commanders selectable; Q and E abilities fire with visible effect.
7. Audio: music plus SFX audible (AudioContext running, no errors); master
   limiter in the graph; per-tower voices distinct (probe reads node names).
8. UI: shop with live 3D previews, inspector, pause, speed 1x/2x/4x,
   settings, wave banners, reaction callouts, end screens all functional.
9. Two adversarial review passes: one on mechanics/code, one on
   visual/UX. Every finding fixed or dismissed with a reason, logged in
   docs/OWNER-NOTES-HIGHPOLY-3D.md with evidence.
10. Bot playthrough on SKIRMISH wins; on CONTESTED the bot survives to
    wave 12+ (a competent strategy must not die early). Log proves it.
11. All new files pass `node --check`; no em dash character anywhere in the
    new files (grep gate); served over HTTP with all assets 200.
