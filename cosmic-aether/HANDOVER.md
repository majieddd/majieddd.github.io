# COSMIC CONQUEST: AETHER - HANDOVER NOTES

For the incoming collaborator. Written 2026-08-30 by the agent that built the
lane. Read this first, then docs/PLAN.md and docs/MAP-ROUNDS.md for the
reasoning behind the art and geometry decisions.

---

## 1. What this is

**COSMIC CONQUEST: AETHER** is the high-definition remaster lane of the game
Cosmic Conquest (the "Reliquary" tower defense family). It is:

- A **WebGL2 tower defense**: build towers on plots, survive 20 waves, 14
  towers, 10 elemental reactions, 5 factions, 4 boards.
- **Zero dependencies, zero assets**: every mesh, texture (procedural atlas),
  sky (nebula/planet shader) and sound (WebAudio synthesis) is generated at
  runtime from source. No npm, no bundler, no image/audio/model files.
- Built by **restructuring the live `cosmic-reliquary-v1.3.html`** single file
  into its 16 original modules and then upgrading the renderer and world.
- The look: a cinematic, physically-grounded render (MSAA 8x, GGX PBR,
  SSAO, auto-exposure, anamorphic streaks, blue-noise dither) layered on the
  Neon Reliquary painted language: dark violet shadow keys, faction colour
  first, silhouette before detail. A "Classic" mode preserves the original
  painterly pipeline (press S in-game to toggle HD / Classic).

The most recent work turned the board into a WORLD: boards 1-3 stay plates
on a large world; board 4 (HALFWORLD) is a massive map covering a full
hemisphere of a small planet (radius 96), with a winding 28-waypoint road,
4 rim gates, START/EXIT light beacons, free-roam camera, terraced plot
pads, and relief terrain on the far side of the globe.

## 2. Where it lives

- Repo: `https://github.com/majieddd/majieddd.github.io` (public GitHub Pages
  site; the main game is at repo root, other agent lanes live in sibling
  folders).
- This lane: **`cosmic-aether/`** at the repo root.
  On this machine: `C:\Users\Majied LaFleur\Documents\ClaudeWorkspace\majieddd.github.io\cosmic-aether`
- ALL work happens inside `cosmic-aether/` (plus own docs). Never edit the
  sibling lanes: `reliquary/` (owner favorite painted build), `polytd/`,
  `aegis-3d/`, `aegis-3d-highpoly-v2/`, `lowpoly/`, `narrative/`, `voxel-sandbox/`,
  any other session's folder (another collaborator added an "INKFALL" lane).
  Other sessions push concurrently; always fetch/rebase (never force).

## 3. Live URLs

- Play (dev, module scripts): **https://majieddd.github.io/cosmic-aether/**
- Single file (offline/file://): **https://majieddd.github.io/cosmic-aether/cosmic-aether.html**
- Builds ship on push to `main`; GitHub Pages takes 60-120s to propagate.
  Verify with a content diff, not just HTTP 200:
  `curl -s https://majieddd.github.io/cosmic-aether/js/05-render.js | grep -o 'far: 620'`

## 4. Layout

```
cosmic-aether/
  index.html            dev page: <script src="js/..."> tags
  build.js              fuses index.html + css + 16 modules -> cosmic-aether.html
  cosmic-aether.html    the shipped single-file bundle (gate step 7 writes it)
  css/style.css         HUD/UI styles and design tokens
  js/
    00-util.js          math, RNG, easing, colour (U)
    01-gl.js            WebGL2 layer: shaders, meshes, textures, FBOs, MSAA (GL)
    02-mesh.js          procedural mesh builder + primitives (MESH)
    03-shaders.js       ALL GLSL: cel pipeline + HD pipeline + sky/AO/Lum/streak (SH)
    04-paint.js         procedural texture atlas + faction palettes + MATERIALS (PAINT)
    05-render.js        frame pipeline, passes, quality tiers, ART constants (R)
    06-terrain.js       board/heightfield/path/plots/paving/world globe (TERRAIN)
    07-rig.js           IK legs, gait, springs, part-tree (RIG)
    08-data.js          towers, denizens, reactions, boards, difficulties (DATA)
    09-models.js        procedural model builders, rigs, beacons (MODELS)
    10-audio.js         WebAudio synth: buses, comp, reverb, echo, music (AUDIO)
    11-fx.js            particles, text, camera-shake effects (FX)
    12-sim.js           gameplay simulation (SIM)
    13-game.js          game loop, input, camera, placement (GAME)
    14-ui.js            HUD/screens (UI)
    15-boot.js          boot + automation surface window.__RQ (drives tests)
  tools/
    gate.js             ONE command gate (see 7)
    headless.js         CDP headless driver (Node 22+, no deps; AEGIS_GPU=1 = real GPU)
    verify.js / adversarial.js   the two harnesses (loaded by fetch)
    winding.js beamgeom.js cssbrace.js ...   static checkers
    *.steps.cjs         headless scripted runs (screenshots/probes)
  docs/                 PLAN.md ROUNDS.md CLEAN-ROUNDS.md MAP-ROUNDS.md HANDOVER.md
```

## 5. How to run it

No install steps. From the repo root:

```bash
python -m http.server 8741 --bind 127.0.0.1     # static server
# open http://127.0.0.1:8741/cosmic-aether/
```

The single-file bundle opens from file:// as well (offline, no server).

### Controls (in game)
- Left-drag: orbit camera. Right-drag: pan across the planet. Scroll: zoom
  (10 to ~620). Right-click: cancel selection.
- Click a tower in the dock to arm it: placement hexes appear on open plots
  (quiet); hover to see the ghost + range; click a plot to build.
- Enter: start next wave. 1x/Q/E: abilities. S: toggle HD / Classic.
- Pause: P or top-right button.

### Boards (menu -> BOARD)
THRESHOLD, THE SPINE, THE RELIQUARY (plates), HALFWORLD (hemisphere planet,
index 3 in DATA.BOARDS). Difficulty: SKIRMISH/CONTESTED/OVERRUN. 20 waves
shared across boards.

## 6. Architecture in one paragraph

Modules are plain `<script>` globals (U, GL, MESH, SH, PAINT, R, TERRAIN,
RIG, DATA, MODELS, AUDIO, FX, SIM, GAME, UI) loaded in order; no module
system, no imports. Boot checks all globals exist. The renderer is a custom
WebGL2 pipeline: shadow map -> (MSAA) scene MRT (lit colour + packed
normal/depth) -> resolve -> SSAO-lite -> particles -> bloom -> streak ->
luminance -> composite (ACES + grade + dither). The HD shader path uses GGX
specular, material classes from a procedural detail atlas (height/rough/albedo/
ridge), soft-quantized 9-band ramp, backlit translucency, hued fog. The world
is a closed globe: ground field = parabola matched to the planet sphere
(worldR = 2 x SAG_R at the equator), shoreline ring dips below the world so
the globe tucks over the plate edge.

## 7. Verify before claiming anything

From repo root, with the server running:

```bash
node cosmic-aether/tools/gate.js http://127.0.0.1:8741
```

Gate steps: parse, no em dash, shaders compile, mesh winding, beam geometry,
CSS braces, bundle build, verify (78/78), adversarial (45/45). It MUST be all
green before any push.

GPU screenshots (MSAA path) - run from cosmic-aether/:

```bash
AEGIS_GPU=1 node tools/headless.js http://127.0.0.1:8741/cosmic-aether/index.html tools/out tools/road-check.steps.cjs
```

The harness writes PNGs and the JSON results to tools/out. Read the JSON
(value fields), do not trust exit codes alone.

Probe the live game: pass the https URL to headless.js the same way (it runs
locally against the remote page).

## 8. Conventions and hard rules (from the REpo)

1. **No em dashes anywhere** (also en dashes and &mdash;): js, css, html, md,
   cjs. The gate checks sources, and build.js refuses to write a bundle
   containing one. Use plain hyphens.
2. **Commit by explicit path** (`git add cosmic-aether/...`), never
   `git add -A` (the repo serves on every push; other lanes are live WIP).
3. Multi-item changes get a **change-note doc** in docs/ describing each file
   touched and what changed (owner preference).
4. **Before/after asserts**: verify a bug fix by reproducing it and showing
   the fixed frame/measurement, not by code review.
5. Push rejection: fetch, `git diff --name-only HEAD...origin/main | grep
   '^cosmic-aether/'` to prove zero overlap, then `git pull --rebase`, push.
   Never force-push.
6. A mesh-winding checker exists for a reason: new primitives get a row in
   tools/winding.js.
7. The verifier content count: verify.js `1.6` asserts 4 boards (was 3; the
   assertion was updated deliberately when HALFWORLD was added - keep in sync).

## 9. Known quirks and gotchas (learned the hard way)

- **verify.js 1.6**: four boards, not three (see above).
- **`brute` is NOT a denizen id.** Valid: chitling, gnawling, tither,
  bloatpod, graft, stockman (test id), etc. Spawning a bad id logs one sim
  error (this caused a false "live has an error" scare once).
- **Far plane is 620** now. Distances beyond ~260 previously clipped the
  whole planet out of frame when zooming out. Do not lower it without
  retesting the max zoom.
- **Software rasterizer** (headless without AEGIS_GPU=1) skips MSAA and is
  slow on the huge boards; use AEGIS_GPU=1 for visual work. On this machine
  headless=new + --use-angle=d3d11 gives the RTX 4080.
- **`window.__RQ`** is the automation surface: start/step/snapshot/build/
  spawn/camera/errors. Screenshot steps: `{ shot: 'name' }` writes into
  tools/out/. Camera focus accepts world coords (`focus: [x,y,z]`).
- **Black screenshot frame** is usually a timing artifact on remote loads:
  wait ~1.5s after start/closeScreens before a shot.
- **Background terminal processes can be reaped between tool calls** on this
  host; long-lived servers should be started in the same shell as the work or
  left as a background process and polled (the repo server on 8741 is the
  shared one; port 8137/8139/8200 are often busy - scan first).
- **PATH quirk (this Windows box)**: the patch tool's built-in JS lint is
  broken; ignore it and run `node --check <file>` yourself.
- `Documents/ClaudeWorkspace/TowerDefense` is an OLDER working copy of this
  same repo (referenced by legacy suite docs). The CANONICAL checkout used
  here is `Documents/ClaudeWorkspace/majieddd.github.io`. Work in this
  checkout and push from it; do not treat the two as separate branches.

## 10. Owner / user preferences

- The painted **Reliquary look is the owner's favorite**; AETHER amplifies it
  (polish, particles, motion) - never flatten it back to plain PBR.
- The owner play-tests personally and reports concrete symptoms; every fix
  must be reproduced live before being called done.
- Each variant ships isolated at its own URL path with a working link as the
  proof.
- "Hand me a link with it working" = push authorization for this lane.

## 11. Current state (verified 2026-08-30)

- All 4 boards, HD default, Classic toggle, free-roam camera, placement
  reform (rings on arm only), START/EXIT beacons, globe world.
- Gate: 78/78 verify, 45/45 adversarial, 17/17 winding. Perf: ~145 fps on the
  RTX 4080 at 1600x900 across all boards.
- Live: deployed and content-verified at the URLs in section 3.
- Rounds histories: docs/ROUNDS.md (HD engine style rounds), docs/CLEAN-ROUNDS.md
  (anti-dirt + grading rounds), docs/MAP-ROUNDS.md (map/planet/world rounds).
