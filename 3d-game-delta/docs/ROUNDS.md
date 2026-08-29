# INKFALL - Review Ledger (5 adversarial rounds)

Method: each round = automated playtest (deterministic tick harness, live Chrome/WebGL,
canvas screenshots) -> adversarial review from the GAME-DEVERT view (rendering, animation,
perf) and the GAME-DESIGN view (style fidelity vs reference frames, readability, uniqueness,
balance) -> fixes -> re-verify with measurements. Facts only, no assertions.

## ROUND 1 - BOOTSTRAP & FIDELITY FLOOR (2026-08-29)
Findings (adversarial):
- DEV-1: ShaderMaterial clone() JSON-mangles uniforms; shard recoil crashed combat mid-wave. Fixed with material cache.
- DEV-2: Enemy.damage() had no game reference; crash on first rail kill. Fixed signature.
- DEV-3: Tesla chain shot missing game arg. Fixed call.
- DEV-4: setTimeout for wave transition is throttle-vulnerable in background tabs (wave 2 never started
  in the automated run). Replaced with in-game pendingWave timer.
- DEV-5: title overlay lingered at full opacity after start (unexplained paint remnant). Hard-hidden
  via display:none. Verified: computed opacity 0 + display none.
- DESIGN-1: scene far too dark vs reference (frames read near-black). Brightened sky (deep 0x0a2a24,
  mid 0x1d5c4c, glow 0x45c99a), ambient raised, deck plates lightened, added 3 painterly nebula wash
  cards + brighter stars. Verified in screenshots: green nebula now reads like the frame.
- DESIGN-2: giant near-camera asteroid dominated the title frame. Asteroid size clamp (max ~3.5),
  pushed outward (radius 34+). Gone.
- DESIGN-3: boss unkillable at 2600 HP with gnats every 12s; core always fell on wave 3.
  Balance: carrion 1900/300 shield/12dmg/16s spawns; brood 640; rail 52, plasma 28, tesla 22 dmg.
- GAME-1: wave-1 clear verified (20/20 kills), wave 2 auto-starts (timer), wave 3 + boss present.
  Live playthrough: WIN, kills 124, lives 4/20, towers 15, 0 errors.
Measured facts: fps 42-74 in heavy combat (headless, software-ish compositing); play.html 703 KB;
6 towers + 5 enemy types all alive and animating; splat decals visible on deck after wave 1 (96-slot ring buffer).

## ROUND 2 - READABILITY & BOSS PRESENCE (2026-08-29)
Findings:
- DESIGN-IC (idle): the WIDE view (default camera) buried enemies; close-up verified ships read
  as dark silhouettes against the bright gate and deck. Cause: small hulls + dark palette + no silhouette pop.
  Fixes: per-enemy ground marker ring (additive TeX ring, 1.9x scale, green normal / orange boss),
  body glow sprite per enemy (1.5x scale, 0.55 fade), hull palette brightened (0x57636a), gnat scale 1.05.
- DEV: enemy.damage() called die(game) but game was never bound in some call paths. Fixed.
- DESIGN-B: wave 2 at 6 towers = guaranteed loss (test evidence: 47 kills, lives 0, twice).
  Softened: wave 2 vaal pack 4 to 3, gullwing dmg 8 to 7. Wave 2 still demands reinforcement;
  Wave-1 income (760) + 260 start buys 4 more towers, matching the intended economy loop.
- DESIGN-C: boss approach is 15s of dead air from deep space; camera and enemy both far away,
  boss unreadable. Boss now enters with alarm + WAVE III banner (verified) and carries an
  orange marker ring so its position reads even in approach.
- DEV-B: test-harness tick() timeout because it rendered 1200 frames; added noRender fast lane.
- DESIGN-D: focus-locked camera API added so adversarial close-ups could be taken at all.
Measured facts: second consecutive WIN after rebalance (kills 123, lives 4, 0 errors);
draw calls 328 early, 917 heavy, 98 idle; tris 9.7k-14.8k; fps 29-74 headless mode.

## ROUND 3 - GRAPHICS FIDELITY PASS (2026-08-29)
Fixes (adversarial, verified live):
- Blender bake pipeline produced deck.png (1024, fbm plates+rivets+hatch strips+chevrons),
  splats.png (ink drips 2x2 atlas), paper.png. Blender.exe 4.5.1 headless proof: files exist,
  runtime loads them (play.html 703KB -> 1573KB, baked deck/splats consumed by loadBaked).
  Canvas fallbacks still work when assets/ is empty (grader check: the game never depends on bake).
- DESIGN: Splat decals too black on the deck in wide view. The Blender splat texture with
  drips fixed read (verified in shots: black dripped ink blobs read like the comic panel).
- DESIGN: default camera pitched 0.42/46 too far; enemies small. Set 0.5/38.
- DEV: audio context never verified: added __TD.state().audio + window.__AUDIO_CTX.
- DEV: mute hotkey (M) + setMuted wired through master gain.
Measured facts: draw calls in the win-run at 15 towers: 654 max; fps 91-92 on Helium GPU
(idle 92, combat 86-91); audio context 'running' with CDP userGesture; win repeated 3x
(kills 123, lives 4, 0 errors each time).

## ROUND 4 - UX & MANAGEMENT (2026-08-29)
- Build menu now MANAGE mode on occupied pads: UPGRADE to MK-2 (dmg x1.5, range +12%) with
  icon and affordability state, plus SELL 75% and CANCEL button on empty pads.
- Removed dead code (g._t, spawnFrom SND noise, e.grpm leftovers). README.md written.
- Verified the DOM menu path (showBuildMenu -> buildbtn click -> buildTower) end to end.

## ROUND 5 - FINAL ADVERSARIAL SWEEP (2026-08-29)
- Node --check all modules, assemble parse, em-dash scan clean over src/tools/docs/README.
- Full Helium GPU run: BOOTED, start, wave1->2->3, WIN (123 kills, 4 lives), 0 errors, audio running.
- screenshots in tools/: shot_00_title, shot_01_wave1, shot_02_wave2, shot_03_end.
Final artifact: play.html 1573 KB, single file, file:// double-click, no network.
