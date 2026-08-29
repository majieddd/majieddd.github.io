# COSMIC CONQUEST: RELIQUARY

A standalone low-poly 3D tower defence set in the Cosmic Conquest universe,
rendered in the same Neon Reliquary painted language as the campaign plates.

**Play:** https://majieddd.github.io/reliquary/
**Every version:** https://majieddd.github.io/reliquary/builds/
**Single file:** `cosmic-reliquary.html` (built by `node build.js`, runs from
`file://` with no server and no network)

Each release is also kept as its own standalone file under `builds/`, so any
version stays playable after later ones land.

Fourteen towers, ten elemental reactions, twenty waves, three boards, five
commanders, WebGL2, **zero dependencies**. No npm, no bundler, no framework,
no image files, no audio files, no 3D model files. Every mesh, texture and
sound in the game is generated at runtime from code.

---

## It shares an IP with the main game and shares no code with it

The roster names, faction identities, wave curve and colour law are taken from
the parent game (verified against `node tools/facts.js towers` and
`commanders`, not from memory). The implementation is entirely separate: this
folder imports nothing from `js/`, registers no global the main page uses, and
is reachable only from its own `index.html`. Deleting `reliquary/` cannot
affect the main game, and vice versa.

---

## The art direction, and why it is a shading problem

The style law for this universe (`docs/ART-BIBLE.md`, section 1) asks for a
painted cutscene illustration: figures built from flat interlocking shapes,
the drawing carried by heavy shadow masses, silhouette readable before detail,
hard cel edges, spot blacks, screen-print grain, and colour that is faction
identity before it is anything else.

Low-poly 3D defaults to the opposite: smooth ramps, pastel palettes, soft
shadows, ambient occlusion. Getting from one to the other is done entirely in
the fragment shader, and the central idea is that **a triangle should read as a
palette-knife stroke.**

| Technique | What it buys |
|---|---|
| Non-indexed meshes, per-face normals | Lighting breaks hard at every edge. No smoothing groups anywhere. |
| Wrap lighting, then posterise to 4 bands | A wide readable shadow mass, then a hard cel edge across it. |
| **Per-facet band jitter** | Each triangle carries a stable seed that nudges where its band boundary falls, so two adjacent facets of the same paint land on different steps. This is the single trick that makes the result read as brushwork rather than as a shaded polyhedron, and it costs one add. |
| Hued shadows, never black | The dark end of the ramp mixes toward a saturated void-violet. Neutral shadow instantly reads as generic 3D. |
| Fresnel rim in the faction key | Separates silhouette from background, which the style law wants to happen before detail is read. |
| Posterised specular | Oil paint is glossy. A two-step Blinn lobe is the catch-light on the ridge of a stroke. |
| Triplanar canvas tooth | Paint has texture. Weighted per facet, so metal stays clean and stone does not. |
| Sobel ink over depth and normals | Spot blacks. Ink DARKENS rather than replaces, so glowing edges keep their glow. |
| Screen-space canvas weave and halftone | Applied in screen space so the whole frame feels painted on one surface. Halftone bites only in the shadows, because a dot screen over highlights reads as a filter. |
| Facet shatter on death | A body comes apart into the strokes it was painted with, each keeping its own colour. |

---

## Systems

**Fourteen towers**, one per attack architecture: travelling projectile,
splash shell, ramping beam, chaining current, cone, piercing hitscan, gravity
field, rotating sweep, and economy. Three tiers each, and **every tier changes
the model**, not just the numbers.

**Ten reactions** across seven elements. A hit leaves a MARK; hitting a marked
body with a different element consumes the mark and triggers the reaction.
**One mark at a time**, on purpose: with stacking marks the player cannot
predict which reaction the next shot produces, and a reaction system nobody can
predict is a random damage multiplier wearing a costume.

**Ten denizen archetypes** plus a miniboss and a two-phase boss, on four
procedural rigs. Legs are driven by **two-bone IK to world-stationary foot
targets**, so feet plant instead of sliding, the body bobs twice per stride and
dips on the loaded leg, and heads and vanes lag through springs.

**Audio** is entirely synthesised: 26 SFX recipes, an adaptive score whose
intensity tracks board pressure, spatial panning by screen position, a
convolution reverb built from generated noise, and a compressor that ducks the
whole mix under an explosion.

---

## Verification

Nothing here is asserted. `node tools/gate.js <base-url>` runs everything:

```bash
python -m http.server 8742 --bind 127.0.0.1     # from the repo root
node tools/gate.js http://127.0.0.1:8742
```

| Step | What it proves |
|---|---|
| parse | every module parses |
| em dash | the project's absolute style rule, checked against SOURCES not output |
| **winding** | every mesh primitive emits outward-facing normals |
| **beam geometry** | the beam mesh axis matches the beam transform axis |
| **css braces** | every CSS block closes |
| build | the single-file bundle assembles and is genuinely self-contained |
| **verify** (91 checks) | every tower deals damage, every tower does the thing that makes it different, every reaction fires, wave 20 is reachable, a strong board wins, a bare board loses, the interface passes its geometry gates |
| **adversarial** (61 checks) | resource leaks across restarts, NaN over a full run, hostile input, balance degeneracy, particle budget and stride, palette correctness across all five factions, determinism, foot slide and IK error, **no render term is dead**, **frustum culling removes work and nothing else** |

Both harnesses run on their **own fresh page load**, because the adversarial
one deliberately restarts the game a dozen times and corrupts state.

### The gate that took four attempts to write, and why

`tools/adversarial.js` switches each major render term off, re-renders, and
measures the difference. A term whose removal is invisible is not a subtle
term, it is an absent one.

It exists because the **wet specular was never running**. `specPower` was 90
against a shader threshold of 0.35, which requires the half vector within 8.7
degrees of the surface normal. Every mesh here is non-indexed with per-face
normals, so N is constant across a whole facet and there is no gradient for so
narrow a lobe to land on. Zeroing the entire term changed the frame by 0.0001
in coefficient of variation. The shader compiled, the uniform was set every
frame, the constant looked deliberate, and reading the code told you the
feature was there.

Three versions of the gate PASSED on a build with that defect planted back in:

| Statistic | Threshold | Verdict at specPower 90 |
|---|---|---|
| frame mean and spread | 0.35% of mean | passed |
| share of pixels changed | 8% | passed (59.1% dead vs 64.1% alive) |
| per-term max delta | per term | passed with the tooth at 0.01 |

Each failure had the same cause and it was the instrument, not the code. The
film grain is re-randomised every frame, so **two identical renders differ by a
mean absolute luminance of 2.62**, and every term measured here contributes
less than that. Coverage sounds like the right question and is not: bloom and
the ink pass smear any difference across the whole picture, so a dead term and
a live one both perturb about 60% of pixels.

With grain off the null floor is 0.004 and the same measurements separate
alive from dead by factors of 7 to 33:

| Term | Alive | Planted dead |
|---|---|---|
| wet specular | 9.832 | 1.346 |
| canvas tooth | 0.895 | 0.027 |
| fresnel rim | 1.274 | 0.009 |
| sobel ink | 1.702 | 0.029 |

The gate now asserts its own null floor before trusting any verdict, and all
four terms are verified by planting each one dead and confirming it is caught,
with a green control after every restore.

### Three defects these gates caught that review did not

**Nine of fifteen mesh primitives emitted inward-facing normals.** Backface
culling did not hide it, so nothing was missing from the screen: every affected
surface simply rendered lit from the wrong side, landed on the deep band of the
ramp, and looked *slightly too dark*. That is indistinguishable from a tuning
problem, and an entire session was nearly spent grading around it. Measured:
the ground rendered `[16,6,52]` where the arithmetic said `[140,129,176]`, an
11x error, and fixing the winding fixed all of it. `tools/winding.js` is now the
gate.

**The HUD only updated on input events.** Gold changes on every kill and lives
change on every leak, neither of which is a click, so the top bar went stale
the moment the player stopped touching anything. Caught by a screenshot showing
the banner reading WAVE 9 over a top bar reading WAVE 1.

**Restarting leaked a running Web Audio oscillator per beam tower.** Replacing
the game state does not stop a node that nothing calls `stop()` on. Silent,
permanent, and audible as a drone the player cannot mute.

### And three more from the polish pass

**Every beam in the game drew a stub.** The beam mesh was extruded along +Y by
`prism()` while `drawBeam` builds a matrix whose third column carries the beam
direction, so the mesh's long axis was mapped to the perpendicular and its
cross-section radius to the length. Measured by `tools/beamgeom.js`: on a 20
unit beam the geometry stopped **12.93 units short** of its target and extended
**7.07 units backward** through its own tower. It affected PRISM, PHAROS, ARC
and RAILGUN at once, and neither file was wrong on its own: the contract
between them was, so the contract is what got the test.

**The ability-ready pulse hardcoded Humanity's cyan**, so on the other four
factions it pulsed a colour from a rival banner. Found by grepping the
stylesheet for hand-typed colour, and now gated: check `H.2` walks every rule
in the live stylesheet and fails on any literal faction key outside `:root`.

**That gate was itself inert when first written.** It used the obvious
`if (rule.cssRules) { recurse; continue; }`, which is now wrong: CSS Nesting
gave `CSSStyleRule` its own empty `cssRules` list, so the test was truthy for
every ordinary style rule and the walk skipped the entire sheet. It reported a
clean pass on a stylesheet with a deliberately planted violation. **This is the
whole argument for planting the defect you expect a gate to catch**: without
that step the project would have carried a green check that verified nothing.
The walk now also asserts it visited at least 40 rules, so the same failure
cannot recur silently.

---

## Controls

| Key | Action |
|---|---|
| `1` to `9` | select a tower |
| click | place, or inspect a built tower |
| `U` / `S` | upgrade / sell the inspected tower |
| `Q` / `E` | commander abilities |
| `Enter` | call the next wave early |
| `Space` | cycle speed 1x 2x 4x |
| `P` | pause |
| drag / wheel | orbit / zoom |

---

## Layout

```
reliquary/
  index.html        shell and HUD markup
  css/style.css     one stylesheet, tokens at the top
  js/00-util        math, seeded RNG, colour
  js/01-gl          WebGL2 layer, errors made loud
  js/02-mesh        mesh builder: the art lives here
  js/03-shaders     every GLSL source
  js/04-paint       procedural textures and faction palettes
  js/05-render      passes: shadow, sky, opaque, ink, bloom, composite
  js/06-terrain     heightfield, lane, plots, scenery
  js/07-rig         IK, gait, springs
  js/08-data        every tunable
  js/09-models      fourteen towers, four rigs, props
  js/10-audio       synthesis, music scheduler, buses
  js/11-fx          particles, shatter, floating text, screen impact
  js/12-sim         the simulation
  js/13-game        loop, camera, input, animation
  js/14-ui          DOM HUD
  js/15-boot        bring-up, failure screen, automation surface
  build.js          fuses everything into one HTML
  tools/            gate, verify, adversarial, winding, cssbrace, headless
```
