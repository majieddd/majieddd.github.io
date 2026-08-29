# INKFALL: Siege of the Avalon Yard - Art Bible

## 1. What this game is
An orbital 3D tower defense. The Avalon Yard, a half-finished star-yard ring from the
"custom handwritten shaders" generation of avorion's cel pack, is being sieged by the
Nihil fleet (comic-book interlopers). The player builds turrets on ring hardpoints and
must hold three waves. Entirely hand-built in Three.js with hand-written GLSL shaders,
textures authored in Blender. Runs from one play.html, offline, from file://.

## 2. Style target
Reference frames (user supplied): avorion cel-shaded anime texture pack (grey-blue
faceted ship, hatched/diagonal stripe plating, black ink outlines, green nebula with
dark teal glow, orange/teal lamp accents). Push the style: comic ink + watercolor/oil
painting washes, so the scene reads like a painted panel that is still a 3D game.
Secondary reference: Everspace 2 (painterly nebulas, soft rim glow, warm key light).

## 3. The Ink Rule (uniqueness pillar)
THE BATTLEFIELD WRITES ITSELF: every projectile impact, explosion and enemy death
lays persistent ink/watercolor pigment onto the world (a capped decal ring buffer).
By wave 3 the deck is a lived-in painting of battle, in-game generated, never a copy
of anyone's asset. This is the invention: the game paints its own history.

## 4. Palette (sampled from reference frames)
- Hull base      #5f656e  grey-blue steel
- Hull dark      #3a4252  navy panel shadow  (deepest #232a38)
- Hull light     #9aa3b0  top-plate sun tint
- Hatch stripes  #c2cad6 / #4c5564  (deck stripe pairs like the Avalon plating)
- Ink outline    #0d131f  near-black indigo ink
- Lamp orange    #ff7a2e  emissive warning lamps
- Lamp red       #e83b2f  hull damage lamps
- Energy teal    #3fe0d8  reactor/rail plasma
- Plasma green   #8dff57  enemy flak + mineware (green = hostile, like reference)
- Nebula deep    #07211f / #0d3530 / #14453c  banded painterly greens
- Nebula glow    #2f9e77 / #57c9a0  soft Everspace-like washes
- Paper grain    #fff7e6  at 5% screen tint, aged paper feel
- Life bars      green->orange->red  narrow toon bars with ink border

## 5. Rendering recipe (all hand-written GLSL)
- Toon ramp: 4 quantized bands (L0..L3) with halftone dot dither on band seams.
- Ink outlines: inverted-hull shells (frontFace=CULL, scaled 1.018-1.03, 1.6px equivalent),
  color #0d131f, alpha ~0.92. Shells reuse hull geometry; one shell layer for ships,
  none for tiny bits (gnat glow bits exempt) to keep read.
- Rim light: fresnel-driven cool teal rim plus a warm key-side sheen band.
- Soft AO: baked blob shadow under each hull/unit (flat dark ellipse decal, toon style),
  plus radial deck shadow around the ring core.
- Banded spec: single sharp GGX-ish band at low roughness, seen as painted highlight.
- Painterly background: shader skydome sphere - fbm watercolor blobs (3 octaves), banded
  posterize for comic feel, star field (two-layer, twinkle), soft green vignette nebula.
- Fullscreen pass: grain (2.2% animated), vignette, very light halftone at 3% opacity
  only outside the action circle (keeps ships crisp).
- Fog: deep teal exp2 fog, denser toward nebula, pure painterly fade (no grey fog).

## 6. Shapes / silhouette language
- Shipyard deck: hexagon ring, faceted plates, hatch stripe runways, hazard chevrons
  at pad rims, orange lamps row on the outer rail (reference homage), reactor core
  tent at center with teal octahedron core.
- Towers: chunky riveted gunmetal, each with a distinct read:
  RAIL LANCE - long blue-rail sniper with 3 rail fins
  PLASMA PELT - twin-tube heavy mortar with green coolant core
  TESLA ZEPHYR - coil stack + rotating ring cage, teal
  FORGE MORTAR - open kiln with painted shell stash, orange ember glow
  BEACON SENTINEL - mast + antenna disc, blinking teal, rings
  (bonus) SAW KITE - 4 spinning blade rotor + twin barrels
- Enemies: faceted like the ship reference but hostile silhouettes:
  Gnat (sleek dart), Borer (armored grinder with spinning drill), Vaal Drone
  (octahedron in gyro ring), Gullwing Corvette (chunky frigate), Carrion (boss
  bioship with articulated jaw + spawning maggots). All bob, bank, thruster-flicker.

## 7. Animation doctrine (everything must look ALIVE)
- Every unit has a rig object hierarchy (not just code-moved root): turret yaw/pitch
  driven by target tracking with smoothing + windup; barrels recoil (translate spring);
  rotors/drills/rings spin with RPM by state (idle/wind/fire); muzzle flashes 1-2 frames
  + ink-shape flash decal; thruster flames flicker by velocity.
- Enemies: banking into turns, pitch along path spline, hover bob, wing flap for
  Gullwing, drill spin ramp, boss jaw idle bite + roar flash. Death: 3-frame hold "ink
  burst" (pause of 120ms, comic panel flash), then splat + shards.
- Camera: slow cinematic orbit at rest; springs to the combat hotzone with soft shake
  on big kills (kept under 0.15 magnitude, never queasy).

## 8. Audio doctrine
- Music: composed loop ~56s, 112 BPM, D minor heroic-space: synth choir pad (detuned
  saw + lowpass), arp in E5 - D5 - B4 - G4 16ths, sub bass on 726, gated kick/snare/
  hat with swing, far toms, lead bell call (answer phrase) that enters wave 3 only.
  WebAudio synth with convolver tail (generated IR), compressor + sidechain duck.
- SFX diegetic, variance-seeded: rail = charged thump + air whip; plasma = wobble sin
  squash; tesla = crackle burst cluster; forge = doomed thoom + debris rattle; saw =
  percussive hh-ed rotor + brrrt; beacon = sonar ping; enemy shot = green zap;
  death splat = wet paper slap + sub drop; build = servo clunk; wave horn = brass
  swell; boss alarm = two-tone siren; coin sparkle; UI tick; win fanfare, lose sting.
- Master chain: compressor, gentle limiter, music at -8dB under SFX at -4dB.

## 9. Readability rules (game-designer constraints)
- Health bars: world-space toon bars above enemies ONLY when damaged, always face
  camera, never scale with distance (screen-constant 26px wide).
- Build frame: pads highlight on hover, green=afford/red=deny; range disc at build/select.
- Enemy colors are hostile green-emissive; friendly is blue-grey + teal-orange.
- Projectiles: tracer contrast (rail white-teal, plasma green, mortar orange).
- Minimal UI: bottom bar (coins/lives/wave), pad build radial, pause/speed, mute.
- Font: bold condensed system stack, letterspaced, ink-shadowed; comic panel borders.

## 10. Scope and out of scope
IN: 3 waves, 5+ enemies, 5+ towers, 3D orbit lane, ink splat system, audio, menus,
pause, build/select, win/lose, speed control, test hooks.
OUT: multiplayer, saves, endless, mobile touch polish (desktop-first), i18n.
