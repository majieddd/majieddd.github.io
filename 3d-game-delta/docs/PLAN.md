# INKFALL - Build Plan + Engine Decision

## Engine decision (research done 2026-08-29)
Goal: max graphics fidelity + single-file double-click deliverable + full custom shader
control, on this Windows machine, verified live in the Helium browser.

Options compared (sources: cinevva 2026 web engine comparison, godot docs, incredible
engine guide, forum threads):
- Godot 4.x web export: WebGL2 Compatibility renderer only, no Forward+ in browser,
  ~9-24MB build, GDScript-only for web, shader freedom limited vs raw GLSL. No.
- Unity: WebGL builds heavy, editor licensing friction, slower iteration here. No.
- Unreal: web not a supported shipping target. No.
- PlayCanvas/Babylon: capable but runtime/managed scene graph; the exact look we want
  needs full fragment control and known 60fps headroom on the 4080 Laptop. Babylon is
  a fine runner-up; Three.js wins on our proven single-file path.
- CHOSEN: Three.js r128 (classic script build, vendored offline) + hand-written GLSL
  as the render engine; Blender 4.5.1 (portable) for texture authoring/baking;
  WebAudio for the audio engine. One play.html, no network needed.

## Deliverables
- inkfall/play.html - the game (self-contained, file:// double-click)
- inkfall/start.bat - launcher (opens play.html in default browser)
- docs/STYLE.md art bible, docs/PLAN.md this plan, docs/ROUNDS.md review ledger
- src/*.js modules, tools/build.js fuser+validator, tools/cdp-*.mjs verification
- textures baked in Blender: assets/*.png (deck, hatch, splat atlas, glow, sparks...)

## Architecture (mirrors the proven pest-parade pattern)
src/00_head.html (DOM/CSS) -> 01_util 02_shaders 03_textures 04_buildings 05_towers
06_enemies 07_waves 08_fx 09_audio 10_game 11_ui 12_main -> build.js -> play.html
(window.__TD test hooks when ?test=1; deterministic seeded RNG)

## Task graph (order)
1. BAKED TEXTURES via Blender headless (tools/blender/bake_textures.py): deck_plate,
   hatch strips, panel grunge, ink splat atlas, soft glow, spark, smoke, paper grain.
2. Shader lib: toon band + halftone dither, inverted-ink outline shell, rim, banded
   spec, painterly skydome fbm, glow sprite, fullscreen grain/vignette quad.
3. World: ring deck, core reactor tent, pad hardpoints (18), asteroids, lamps.
4. Towers: 6 types (Rail Lance, Plasma Pelt, Tesla Zephyr, Forge Mortar, Beacon
   Sentinel, Saw Kite) each a rig with yaw/pitch/recoil spin + fire logic.
5. Enemies: Gnat, Borer, Vaal Drone, Gullwing Corvette, Carrion boss; path spline
   on the ring lane; bank/bob/flap/drill/jaw animation; HP, armor, shields.
6. Waves: 3 waves, mixes, boss wave 3 (+2 mini satellites of the boss as a finale).
7. FX: pools (projectile, tracer, shard, smoke, spark, flash, shockring), ink splat
   decals ring buffer, death ink-burst panel flash, hit sparks, muzzle flashes.
8. Audio: music sequencer + 18 SFX synth recipes + master chain.
9. Game systems: economy, targeting (nearest-to-core with weight), build/upgrade/
   sell, lives, speed 1x/2x/4x, pause, win/lose, camera orbit+focus, test hooks.
10. Rounds 1-5 adversarial review (game-dev pass: rendering, perf, animation;
    game-designer pass: style fidelity vs reference, readability, uniqueness),
    each round: playtest -> measure -> fix -> verify -> log facts in ROUNDS.md.

## Verification doctrine (house rules)
- node --check every module; build.js gates on parse + "BUNDLE PARSE: OK".
- Live Helium CDP (port 9222) playthrough: boot, full 3-wave win autotest, screenshots
  at key beats (intro, build, combat, boss, victory), 0 console errors, fps average.
- Screenshots reviewed adversarially against the reference frames each round.
- ROUNDS.md holds measured facts (fps, draw calls, errors, file size), not assertions.
- No em dashes anywhere in docs or code. Commit by explicit path if publishing.
