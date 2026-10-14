# AETHER CLEAN PASS ROUNDS (graphics cleanup per owner directive)

The owner judged the first HD build DIRTY/MESSY (regression vs the painterly
baseline). This ledger tracks the adversarial review program and each fix.

## Round 1 (art director + tech artist spawning, cleanup applied in parallel)
Expert reviews dispatched (see chat): Senior Stylized AAA Art Director ex-
Blizzard taste; Senior Tech Artist / texture specialist. Both reviewed the
dirty-state screenshots and the code.

Owner complaint confirmed by inspection (own evidence, closeup + angle):
- TV-static speckle on every surface (detail atlas cells at high frequency).
- Grey blotchy SSAO smearing (strength 0.92, half-res 8-tap, unblurred).
- Halftone 0.10 + canvas 0.06 + grain 0.030 + vignette 1.08 = filmy scuzz.
- Ground facetJitter 0.26 (tuned for 4-band cel) turned into +/-3 band chaos
  under the 12-band HD soft ramp: quilted checkerboard terrain.
- Milky/pale midtones (exposure 1.12 + saturated but low contrast stops).
- Detail normal cap 2.4 and ridge spec 1.6 blew specular into dirty rainbow.
- Glarey white plot rings and blown emissives.

Round 1 fixes applied:
1. 04-paint.js: all six atlas cells rewritten low-frequency, art-directed
   (flat interiors, crisp seams/ribs/plates, albedo channel near flat,
   roughness near flat). Ground cell: no ridge web at all.
2. MATERIALS det strengths cut ~3x (metal 1.10->0.35, hull 1.20->0.40,
   stone 0.85->0.45, organic 0.60->0.45, energy 2.00->0.60, ground 0.34->0.14).
3. 13-game.js: ground push facetJitter 0.26 -> 0.015 (the quilt killer).
4. 05-render.js HD uniforms: soft 0.34->0.40, bands 10->12, jitter 0.04->0.015,
   wrap 0.12->0.10, spec 0.26->0.16, ambient sat 0.62->0.75.
5. 05-render.js HD composite: halftone 0.10->0.02, canvas 0.06->0.02,
   vignette 0.72x->0.52x, grain 0.72x->0.48x, saturation 1.06x->1.14x,
   contrast 0.98x->1.04x, AO 0.92->0.45, streak 0.50->0.40.
6. 03-shaders.js MESH_HD_FS: detail normal cap 2.4->0.9; ridge spec 1.6->0.8;
   tooth multiply 0.30->0.10; emissive 2.1x->1.5x; mid stop 0.74->0.72,
   lite 1.36->1.26 with light mix 0.52->0.44; albedo fidelity 0.25->0.35.

Measured after Round 1: speckle gone from closeup and board; surfaces read as
clean painted stone; 144.8 fps on RTX 4080, zero GL errors, gate baseline
unchanged (verify + adversarial re-run pending at ship).

## Round 2 launched (parallel, against the CLEANED images)
- Reviewer A: Senior Stylized AAA Art Director (round 1 continued, dirty shots).
- Reviewer B: Senior Tech Artist / texture specialist (role: speckle/SSAO/overlay
  forensics, dirty shots).
- Reviewer C: Hollywood-grade colorist + lighting director (clean shots).
- Reviewer D: Game design director, UX/QA background, Kingdom Rush pedigree
  (clean shots, readability side).
All four dispatched with the same mandate: cite evidence and give exact fixes.
Their findings merge into Round 2 implementation when they land.

## Round 2 implemented: tech artist findings (from subagent-summary 20260829_161030)
1. Tooth value-multiply now scaled by detStr (0.10*detStr*vTooth): ground +/-(0.7%)
   was +/-(13%), stone +/-(2%) was +/-(11%). Killed the blanket speckle source.
2. Detail normal: e 0.14 -> 0.30 (slope averages over bigger footprint),
   clamp stayed 0.9. No more per-pixel normal shimmer on flat facets.
3. CRITICAL: attachment-1 post buffers now write the GEOMETRIC normal (geoN),
   not the detail-perturbed N. SSAO and ink no longer receive material-grain
   normals, so the AO term cannot fire on noise.
4. SSAO: uAORadius 1.0 -> 0.5, range floor 0.35 -> 0.18, growth x0.012 -> x0.008,
   taps 8 -> 12, falloff range*3 -> range*2. Crisp contact shadows, no broad
   blotch stains. Composite strength 0.45 as before.
5. Ridge specular boost scaled by (1 - rough) and 0.8 -> 0.6: stone/matte
   surfaces no longer sparkle; metal keeps its glassy sheen.
6. Atlas G (roughness) and B (albedo) channels now actually consumed:
   rough = uMatData.x * mix(1.0, dt.g, 0.30); albedo *= mix(1.0, dt.b, 0.22).
7. Halftone shadow mask tightened (0.03, 0.25) so the dot screen stays out of
   the SSAO band.
Shaders compile clean; gate re-run + fresh GPU shots pending (CPU contention
with the two in-flight reviewers).

## Round 3 (merged 4-expert synthesis) - applied and verified
Colorist + Design director + art director + tech artist merged:
- Grade: exposure HD mult 1.12 -> 1.06 final (adversarial gate floor demands
  ground > 45; measured 44 at 1.02 so 1.06), ambient 1.42 -> 1.15,
  uHdBandsB.z 0.60 -> 0.52 (shadow keeps chroma), shadowLift HD 0.20.
- Ramp: lit stop no longer washes to white (mix 0.44/1.6 -> 0.30/1.35),
  lite 1.36 -> 1.26, bands 12 soft 0.40 -> 9 bands soft 0.32, jitter 0.04 -> 0.015.
- Bloom: HD threshold 0.78 (cel keeps 0.60), bloomStrength 0.85 -> 0.62,
  emissive 1.5x -> 2.0x for the small cores (they read as saturated glow,
  not white holes), collars raised (ring y 0.60 -> 0.86, radii up).
- Fog darker in HD (density x0.72, color x0.85), sky bottom/nebula retuned
  (skyBottom L 0.185 -> 0.215, nebula L 0.42/0.52 -> 0.32/0.40, weights cut,
  star density 0.075 -> 0.095).
- Readability: lane colors deepened (rose darker: #7d4a77 etc.), free plot
  rings alpha 0.32 -> 0.45.
- CRITICAL systemic fix: per-object uDetailScale. A single global scale
  (tuned for a 95-unit board) turned every 2-unit enemy into one magnified
  texture cell (the "wrinkled blue rock" the closeup showed). Now:
  terrain 0.14, decor/spires 0.5, tower base 0.85 / turret 1.0 / barrel 1.25,
  denizens 1.5.
- Organic cell redesign: cos-cos plate lattice created target rings on units;
  replaced with soft fbm bumps (v 0.40 + 0.42 noise, ridge 0).
- Enemy cores pushed out of the hull: crawler z 0.74 -> 1.32, walker 0.44 ->
  0.66, strider 0.30 -> 0.72, flyer 0.80 -> 1.45. Verified at gameplay
  distance: dark creatures with glowing violet cores, readable silhouettes.
- Gate: 78/78 verify, 45/45 adversarial (V.3 ground exposure now satisfies
  the suite's dark-but-readable floor), 17/17 winding, shaders link.

## Round 4 (VFX look-dev review, clean shots) - verdict CLEAN AND SHIPPABLE
Polished: emissive 2.0 -> 1.65 (crystal no longer floods white), bloomStrength
0.62 -> 0.52, blue-noise 1-LSB dither added to HD composite (kills 8-bit
contour banding on the radial falloff), rim strength HD x0.8 (less toy),
ambientGround L 0.14 -> 0.17 (undersides stay violet-black), lane colors
cooled slightly (#7d4a73 etc.).

## Round 5 (synthesis) - FINAL
Full gate: 78/78 verify, 45/45 adversarial (V.3 exposure floor satisfied at
ground ~46), 17/17 winding, shaders link, bundle 516.1 KB. GPU shots confirm:
clean plate, dark key with violet shadow mass, rose lane reads, element
collars colored, enemies dark-hulled with glowing violet cores at gameplay
distance. Owner's baseline cleanliness recovered while keeping HD fidelity.
