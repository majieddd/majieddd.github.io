# COSMIC CONQUEST: HIGHPOLY

A high-fidelity 3D tower defence set in the Cosmic Conquest universe, painted
in the same Neon Reliquary language as the campaign plates, with an amplified
particle and motion layer.

**Play:** https://majieddd.github.io/aegis-3d-highpoly/
**Single file:** `cosmic-highpoly.html` (built by `node build.js`, runs from
`file://` with no server and no network)

Fourteen towers, ten elemental reactions, twenty waves, three boards, five
commanders, WebGL2, **zero dependencies**. No npm, no bundler, no framework,
no image files, no audio files, no 3D model files. Every mesh, texture and
sound in the game is generated at runtime from code.

**Lineage.** This variant is a fork of the `reliquary/` build (same universe,
same mechanics DNA, same painterly shader language) that the owner approved
as a base. What the fork adds is the juice layer: GLOW and EMBER particle
kinds, a coreFlash emitter (the light heart of an explosion), heavier spark,
dust and ember systems, an impactKick that composes flash plus sparks plus
ring plus dust per hit, colored screen flashes on reactions and big kills,
spawn pop-in, FOV punch on impact, heavy-footstep dust, ambient lane embers,
and slightly larger unit silhouettes for readability. The simulation, the
shading language, the IK rigs and the UI skeleton are the origin's; the
amplification list and the verification log are in
`docs/OWNER-NOTES-HIGHPOLY-3D.md`.

## It shares an IP with the main game and shares no code with it

The roster names, faction identities, wave curve and colour law are taken from
the parent game (verified against `node tools/facts.js towers` and
`commanders`, not from memory). The implementation is entirely separate: this
folder imports nothing from `js/`, registers no global the main page uses, and
is reachable only from its own `index.html`. Deleting this folder cannot
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

## Systems

**Fourteen towers**, one per attack architecture: travelling projectile,
splash shell, ramping beam, chaining current, cone, piercing hitscan, gravity
field, rotating sweep, and economy. Three tiers each, and **every tier changes
the model** rather than just the number, so an upgrade reads as a machine that
was improved and not as a stat that was edited. Full details in
`js/08-data.js` and `js/09-models.js`.

**Ten reactions**, each with a screen callout and a distinct sound. Reactions
are what make the board worth building: a layout that sets up two elements on
the same body out-damages a layout that just shoots. The full table is in
`js/08-data.js`; the damage pipeline is one function, `SIM.damage`, in
`js/12-sim.js`.

**Twenty waves** with a piecewise curve from the parent game (x1.26 to wave
10, softer after), two bosses with visible phase shifts and summons, three
difficulty tiers, three boards.

**Five commanders**, each a different way to play: REYES (economy), SERAPH
(offense), SEVRA (poison), RAKE (gold), AXIOM (defence). Q and E are active
abilities with cooldowns and reads on screen.

**Pure synthesis.** The music is a sequenced, filtered synth score with a
compressor and limiter in the bus, and every sound effect is synthesised at
runtime with per-shot pitch and timing jitter. There are no audio files; the
single-file build is genuinely standalone.

## Build and verify

```bash
node build.js          # writes cosmic-highpoly.html
node tools/gate.js     # parse, no-em-dash, winding, CSS, build,
                       # live verify harness, live adversarial harness
node tools/headless.js <url> qa tools/visual.steps.cjs   # screenshots
```

The gate needs a static server (any one) and Chrome at the default Windows
path or `CHROME_PATH`. The harnesses fetch their own bodies straight into a
running page, so a harness bug cannot hide in a stale bundle.
