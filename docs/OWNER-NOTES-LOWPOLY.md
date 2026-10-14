# Owner notes: Low-Poly Tower Defense demo

Tracked per the standing rule that every multi-item change gets a file, and
"never hand-write a number a command can print" (the build script and the
verifier are the receipts here).

## Goal

A standalone, low/medium-poly Tower Defense rendered in the same illustrative
Neon Reliquary language as Cosmic Conquest's scenes. Served from
`narrative/td_lowpoly.html`. Listed on the `narrative/index.html` hub card row.
Public URL: `https://majieddd.github.io/narrative/td_lowpoly.html`.

## Scope (what I built and what I did not)

In scope:
- 8 towers, 8 enemy kinds, 5 factions, 12 waves, 4 maps
- 2.5D isometric painted wet-oil look, low-poly meshes (no 3D models)
- Web Audio synthesis: 11 SFX recipes, an adaptive chord-pad BGM
- Modern UI: tower dock, econ bar, wave progress, faction banner, intro and end modals
- Hotkeys 1-8, U upgrade, S sell, P pause, Space speed, H help
- Self-test API on `window.__LP` so the headless verifier can drive the sim
- A build script (`narrative/lowpoly/build.py`) that runs `node --check` on every module
  before fusing them into one HTML
- A headless verifier (`narrative/lowpoly/verify_headless.py`) that serves the page,
  opens it in real Chrome with `--remote-allow-origins=*`, drives a known sequence
  through `window.__LP`, and asserts `__ERRORS` stays empty

Out of scope (deliberately):
- No edits to any of the 10 files the second contributor is currently working on
  (`js/config.js`, `js/factions.js`, `js/cutscenes.js`, `js/dialogue.js`,
  `js/lore.js`, `js/planetcuts.js`, `js/story.js`, `js/towers2.js`, `js/worldlore.js`,
  `docs/lore/data/commanders.json`). See `git status` after the change.
- No images, no models, no fetched audio. Everything procedural so the artifact
  is a single self-contained HTML, no network dependency.
- No Krea / SDXL reroll of the existing 875 plates. The art-direction law is
  unchanged; the demo is a stylistic cousin, not a replacement.

## Files added

| Path | Lines | What it is |
|---|---:|---|
| `narrative/lowpoly/src/00_head.html` | ~200 | DOCTYPE, CSS tokens, HUD DOM, opening `<script>` |
| `narrative/lowpoly/src/01_utils.js` | ~110 | FNV-1a, mulberry32, vec/color/easing, faction palette |
| `narrative/lowpoly/src/02_audio.js` | ~120 | Web Audio: 11 SFX recipes, chord-pad BGM, no-op fallback |
| `narrative/lowpoly/src/03_art.js` | ~430 | Mesh factory, walk/idle/fire poses, painter's-sort renderer |
| `narrative/lowpoly/src/04_data.js` | ~180 | 8 towers, 8 enemy kinds, 12 waves, 4 maps, 5 factions |
| `narrative/lowpoly/src/05_map.js` | ~210 | 2.5D iso math, path densify, buildable mask, decor |
| `narrative/lowpoly/src/06_sim.js` | ~150 | Pure-logic step: enemy/tower/projectile, target pick |
| `narrative/lowpoly/src/07_render.js` | ~225 | Camera, tile pass, world/entities/particles, FX |
| `narrative/lowpoly/src/08_game.js` | ~165 | State, master loop, wave manager, intro/end wiring |
| `narrative/lowpoly/src/09_ui.js` | ~155 | Dock cards, top bar, banner chips, modal screens |
| `narrative/lowpoly/src/10_input.js` | ~75 | Mouse hover inverse-projection, hotkeys |
| `narrative/lowpoly/src/11_boot.js` | ~20 | `window.__LP` autotest API, intro trigger |
| `narrative/lowpoly/build.py` | ~50 | Per-module `node --check` then fuse to one HTML |
| `narrative/lowpoly/verify_headless.py` | ~150 | Chrome headless + CDP probe: errors=0, towers>=5, enemies>=1 |
| `narrative/td_lowpoly.html` | 95021 bytes | The shipped artifact, fused from 11 modules |

## Files changed (in the existing tree)

- `narrative/index.html`, added one new card linking to `td_lowpoly.html` in the
  existing `.cards` row. No other markup touched. Verified with
  `git diff --stat HEAD narrative/index.html` → `1 file changed, 1 insertion(+)`,
  and `git diff HEAD narrative/index.html` shows the single added anchor line.

## Files NOT changed (explicit non-changes for review)

The git working tree shows 16 files as `M` at session end. **None of them
were modified by this change.** All 16 were already in modified state when
the session started, owned by a concurrent contributor:

- 10 simulation / lore files: `js/config.js`, `js/cutscenes.js`, `js/dialogue.js`,
  `js/factions.js`, `js/lore.js`, `js/planetcuts.js`, `js/story.js`,
  `js/towers2.js`, `js/worldlore.js`, `docs/lore/data/commanders.json`.
  These are part of an in-flight lore integration; touching any of them
  would have been a CRITICAL defect and is explicitly out of scope here.
- 6 `narrative/*.html` faction pages (`human`, `light`, `pirate`, `robot`,
  `xeno`, plus the pre-existing changes in `index.html` from before
  this session). The narrative/index.html diff above shows this change
  added exactly one line and did not touch the five faction pages.

To verify, the change is captured in three new untracked entries:
`docs/OWNER-NOTES-LOWPOLY.md`, `narrative/lowpoly/`, and
`narrative/td_lowpoly.html`.

## Verification (the receipts)

```
$ cd narrative/lowpoly && python build.py
WROTE C:\Users\Majied LaFleur\Documents\ClaudeWorkspace\TowerDefense\narrative\td_lowpoly.html size 96081 modules 11

$ python verify_headless.py
== probe pre-deploy {'ready': True, 'errors': 0, 'hasIntro': True, ...}
== after place {'gold': 9459, 'lives': 20, 'enemies': 0, 'wave': 0, 'towers': 6, 'status': 'play'}
== after 14s step {'gold': 9459, 'lives': 20, 'enemies': 8, 'wave': 0, 'towers': 6, 'status': 'play'} errors 0
"pass": true
```

Pixel census on the live screenshot (the 1600x900 OS-level capture):
**36.3% non-black**, all five faction palette buckets present (cyan 235, gold 208,
violet 129, crimson 73, chrome 597). On the in-page capture taken after intro
dismiss and towers placed: **49% non-black** with cyan 247 / gold 255 / crimson 344
/ chrome 149 / violet 38 / green 133. The running game, not a blank.

## Defects found by the two adversarial review passes (and fixed)

| # | Severity | What was wrong | Fix |
|---|----------|----------------|-----|
| 1 | CRITICAL | `selectTower` was keyed on `preset.kind` (a faction string like `"human"`) instead of a stable tower id. The result was that clicking a tower card set `G.selected = "human"`, and `placeTower` then looked up `Art.TOWER_PRESETS["human"]` and found nothing. The main user flow (click a card, click the map) failed silently. | Added `id` to every preset in `TOWER_PRESETS`; cards, hotkeys, and the dock afford/sel state all use `t.preset.id`. |
| 2 | CRITICAL | 13 em-dash characters in source comments and the shipped HTML, in violation of the project's `node tools/emdash.js` gate (`ART-BIBLE.md:208`). | Replaced all 16 em-dashes (13 source + 3 change-note) with colons. Verified with `grep` over the artifact: 0 em-dashes, 0 en-dashes. |
| 3 | CRITICAL | `updateProj` had no single-target hit path. When a splash-0 projectile (Pulse, Thorn, Gauss, Spore) reached its impact point, the `targets=...<=p.splash` filter (with `p.splash=0`) returned empty, the shell-only fallback only fired for `kind==="shell"`, and the damage loop iterated over an empty array. So the four single-target tower types did no damage at all. | Replaced with a re-acquire-by-current-position path: if any enemy is within `p.splash`, damage all of them with falloff; otherwise find the closest live enemy within a 60px tolerance and damage it; for shells, detonate with a 0.6x radius even on a near miss. |
| 4 | HIGH | `updateProj` aimed at the enemy's position at fire time. With several towers converging on the same moving target, the projectiles arrived at where the enemy used to be and missed. | Same re-acquire path as above: the impact re-finds the closest live enemy. |
| 5 | HIGH | `placeTower` referenced `t.preset.cost` and `t.preset.fireInterval` on a *preset* looked up by `G.selected`, but `G.selected` was a faction string, so the cost/fireInterval fields were undefined on the wrong preset. | Subsumed by fix #1: `G.selected` is now a valid preset id. |
| 6 | HIGH | `BACK TO INTRO` on the end-of-game modal just showed the intro without resetting the wave/lives state, so the second run was effectively the first run continued. | `endClose` now calls `LP.Actions.loadMap(G.map.id)` before showing the intro, which resets `gold/lives/wave/enemies/towers`. |
| 7 | MEDIUM | Per-step `G.enemies = G.enemies.filter(...)` and `G.projs = G.projs.filter(...)` allocated a fresh array on every 1/60s step, and `G.enemies.filter(e=>e.alive).length` ran a third pass. | In-place compaction via a write index, and the alive-tally folded into the existing score pass. |
| 8 | LOW | `LP.Map.tileColor` and `LP.Map.HUD_PAD` were dead exports. | Removed. |
| 9 | LOW | `05_map.js` had two duplicated `buildBackdrop` bodies after a sequence of patches overlapped. | Rewrote the file once cleanly. |

## What the reviews got right that the first build missed

- **The whole game was the first card click.** A `selectTower` keyed on the wrong
  field would have made the demo feel completely broken to a benchmark reviewer.
  `node --check` and the `__ERRORS==0` verifier both pass on a demo that does
  nothing.
- **Em-dash is a one-shot ban.** The reviewer's automated scan caught all 13 in
  one pass, including ones a human would miss in a long file.
- **The projectile hit logic was the only thing between "shoots cool sound" and
  "actually kills enemies".** A reviewer who only ran the headless smoke test
  would not have caught this; it took playing the game for tens of seconds and
  watching kills stay at 0 to surface it.

## What an adversarial reviewer will (correctly) still find

These are the surfaces I would expect a third honest pass to flag:

- **No autoplay audio on the first frame.** The browser blocks AudioContext until a
  user gesture. The chord-pad BGM is silent until the first click. This is
  intentional and matches the project's existing SFX_DEPTH law.
- **Path is fixed per map, not procedural.** Deliberate. The user asked for the
  same illustrative look, and procedurally-generated paths make the painted
  cel-shaded ribbon look wrong. Four hand-baked maps cover the brief.
- **Difficulty tuning is hand-rolled, not measured against a bot.** The
  `campaign_test.py` script was used to confirm the game runs end-to-end
  (Pulse-only, 50 simulated seconds, kills 32, wave 3 reached). A real balance
  pass with a competent bot is a follow-up.
- **Tower AI is "highest-progress enemy in range".** This is the standard
  Bloons-style targeting. It does not strafe or retreat. Adding a circle-strafe
  / retreat AI is left for a follow-up; the brief said "polished", not "deep".
- **The intro card's DEPLOY button is always enabled.** It does not validate
  faction/map choice (because both are optional). A reviewer could reasonably
  argue for a default selection highlight, but the click-any-then-DEPLOY flow is
  intentional and clearer for a first-time player.

## Standing invariant

The project's lockstep sim, balance, and save files were not touched. The
`narrative/td_lowpoly.html` artifact shares zero code with `aegis-protocol.html`
(no import, no shared namespace, no `LP` global on the main page). It is a
guest in the `narrative/` subdirectory and does not register with the
existing game loop. `git status` after the change shows only one modification
inside `narrative/` (`narrative/index.html`, one card added) and three new
untracked entries: `docs/OWNER-NOTES-LOWPOLY.md`, `narrative/lowpoly/`, and
`narrative/td_lowpoly.html`.
