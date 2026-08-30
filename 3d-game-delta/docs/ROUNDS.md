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
- Final artifact (v1.1): play.html 1575 KB, single file, file:// double-click, no network.

## ROUND 8 - PLANET-WIDE BELT + TWO-SIDED DEFENSE + GLITCH FIXES (2026-08-29)
USER: "still glitchy"; "tower defense involves two sides"; "make it span the entire planet".
REBUILD (bend v2): flat strip -> EQUATORIAL BELT around the whole planet (flat x = arc
length along the equator, z = latitude, y = radial). The deck is now a REAL sphere band
(no seams/z-fighting); props still bend per-vertex (identical math, exact fit).
- Full-lap path: enemies spawn in space, fly through the gate arch, circle the ENTIRE
  planet (213.6 units), then veer north to the core station at the prime meridian.
- TWO SIDES: twin 20-pad rows flanking the lane (z +-7.2, 40 pads total) - towers on
  both sides of the path, classic TD form.
- GLITCH ROOT CAUSE #1 (user-facing): an invisible end-screen panel covered the canvas -
  clicks landed on the overlay, never the game (pad menu never opened for real mice).
  Fixed with a pointer-events contract: ONLY interactive chrome captures clicks;
  screens now use visibility (blocks hit-testing) instead of opacity alone.
- GLITCH ROOT CAUSE #2: flat-plate deck had a wrap seam (z-fighting phantom); replaced
  by a real latitudinal sphere band.
- Targeting/picking rebuilt for the wrap: ray-vs-sphere -> (lambda, lat) -> strip pad
  index; flatDist() wraps arcs so towers shoot around the corner, never through the
  planet; tower aim compensated via the lat/lon pad frame.
- Balance for the long belt: start coins 400, wave bonuses 140/190/320, tower DPS +15%,
  speeds +~60% (lap ~18s for gnats).
Verified: BOOTED 0 errors; real CDP click -> menu -> RAIL build (400->310) -> sell (378);
5/5 enemy types 2-frame motion proofs on the belt; WIN 119 kills / lives 4 / 0 errors /
140 fps; wave-1 survival with a 6-tower spread; zero-error long run. Published as BUILD
v1.4 at https://majieddd.github.io/3d-game-delta/.

## ROUND 7 - PLANET BATTLEFIELD + FLIGHT FACING (user-requested, 2026-08-29)
USER REPORT: enemies sometimes fly backwards/sideways; wants the flat disk turned into a
planet (fight on a curved section, going around it).
FLIGHT FACING FIX: approach phase used a hardcoded lookAt(GATE*2) - as enemies neared the
gate that point was BEHIND them (backwards flight!). Replaced with path-sampled lookahead
(posAt(u+1.1)) for ALL phases (approach + orbit); dive keeps pole-facing dive vector.
PLANET CONVERSION (inventive approach): all game math stays FLAT (physics, targeting,
waves, economy unchanged); the RENDERED world is bent onto a sphere in the vertex shader
(flat x,z -> colatitude; +Y -> radial offset; normals rotated by the local frame).
- Shared BEND uniforms + bendPos/bendFrame GLSL; applied to toon, outline, glow-sprite,
  hpbar, marker, shadow, splat, ring, beam shaders (beams now arc across the dome,
  heightSegments=8 so tracers follow the curve).
- Patch: planet globe (painterly canvas: ocean bands, land blobs, clouds, polar caps,
  toon-shaded) + view-space fresnel atmosphere rim; asteroids re-Y'd so they orbit above
  the surface as debris; nebula washes unbent.
- Pad picking rebuilt as ray-vs-planet-sphere -> (colatitude, longitude) -> flat polar
  pad index; REAL-CLICK E2E verified (pad0 -> menu -> RAIL built 260->170 -> sell 238).
- Tower aim compensation: pad surface frame F^T applied to the rendered aim so barrels
  point where bent beams actually curve (barrel tilt error 24-39 degrees eliminated).
- Bug fixed en route: the grain/vignette overlay material was never attached (returned {}
  in makeOverlay); when attached it rendered OPAQUE WHITE (missing MultiplyBlending) -
  caught by verification, fixed.
Verified: BOOTED 0 errors; pad E2E build/sell; 5/5 enemy types 2-frame motion proofs on
the planet; WIN 123 kills / lives 4 / 0 errors / 144 fps / 1018 calls; audio running.
Published as BUILD v1.3 at https://majieddd.github.io/3d-game-delta/.

## ROUND 6 - ENEMY 3D & ANIMATION (user-requested, 2026-08-29)
CRITICAL BUG FOUND: enemy group positions were never synced to the path - game logic
(e.pos, damage, markers, turret targeting) all ran on the real path, but the visible
ship rigs rendered at the origin, hidden inside the core pedestal. The user saw markers
staying on the deck with no ships on them. Root cause: this.grp.position.copy(b) was
missing from enemy.update(). Fixed; verified: ships now fly the ring visibly.
Enemy fidelity pass (all verified via 2-frame motion proofs in tools/anim_*):
- New detailed rigs: gnat = elongated dart + cockpit + flapping canard fins + twin engine pods;
  borer = armored back plates + bigger spinning drill (14 rad/s); vaal = counter-rotating gyro
  rings + core + shield; gullwing = big flapping gull wings (2.3 span) + wingtip glows + tail pods;
  carrion = larger jaw (biting), spine veins, rowing blade wings, red eyes, breathing eye glow.
- Scale-up (all types ~+30-40%) so ships read at game distance; markers made type-independent
  (2.1, boss 3.6); body glow reduced (0.32) so geometry reads first.
- Self-lit material set: emissive wash + brighter ambient + spec 0.85 + strong teal rim (rimPow 2.3)
  so ships never fall into the dark toon band from any camera angle. Ink outline shells on hulls.
- Flight: bank/roll now follows the weave phase (roll 0.32 +- 0.2, plus pitch bob) - visible 3D motion.
- Physics unchanged (balance identical): WIN verified 123 kills / lives 4 / 0 errors / 144 fps;
  draw calls 522-567 with 15 towers; motion-proof screenshots per type in tools/.
Facts: anim_gnat/borer/vaal/gullwing/carrion _a/_b pairs captured; win state re-verified twice.
Published as BUILD v1.2 at https://majieddd.github.io/3d-game-delta/.
