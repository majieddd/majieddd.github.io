# OWNER-NOTES — Cosmic Conquest: Low-Poly Tower Defense (Neon Reliquary)

**Author:** Hermes Agent (autonomous build) · **Date:** 2026-08-29
**Repo path:** `TowerDefense/narrative/td/`
**Public artifact:** `TowerDefense/narrative/td_lowpoly.html` (self-contained, ~754 KB, zero external requests)
**Local run:** `cd TowerDefense/narrative/td && python build.py` then serve the folder; open `td_lowpoly.html` (or open the file directly — it is file://-safe).

## What this is
A from-scratch **medium/low-poly Tower Defense** built in the *Cosmic Conquest* universe, in the locked
**Neon Reliquary** art language (Tyranny bold-flat brushwork + gothic engraving + cyberpunk vaporwave on void-black
`#0a0e17`, faction-monochrome hues). Not a port of the existing PvPvE game — a distinct single-player TD
showcase built to the same visual contract. Talks to the lore: map is "EARTH — THE DAY THE FRAGMENTS CAME DOWN",
towers are named HUMANITY craft (Aurora Gunship, Fluxliner Coil, Aurora Cryo, Black Manta, TR-3B Lance),
hostiles are The Hungry / Raider Probes / Phantom Craft / Xeno Brood / Spectral / the Devourer boss.

## Files touched (all NEW in this drop)
| File | Role |
|---|---|
| `src/00_head.html` | Document shell, CSS (Neon Reliquary HUD), all DOM (HUD, palette, inspect, wave pips, gate, overlays) |
| `src/02_data.js` | Static data: grid, serpentine path, 5 towers, 6 enemies, 20-wave script, lore |
| `src/03_sim.js` | Deterministic simulation (pathing, waves, economy, targeting, projectiles, chain/splash/slow). No THREE/DOM — unit-tested under Node |
| `src/04_art.js` | Procedural low-poly meshes: 5 towers + 6 enemies (with idle/walk/attack rigs) + Core + asteroids; flat-shaded painterly materials |
| `src/05_render.js` | Three.js scene, vaporwave nebula shader, neon grid, violet path corridor, oil-painting post-FX (brush jitter + chromatic + grain + vignette), particles, camera shake, range ring |
| `src/06_audio.js` | High-fidelity synthesized Web Audio: ambient pad, UI, fire (per tower kind), hit, boom, kill, leak, wave, win/lose stingers, convolution reverb |
| `src/07_game.js` | Controller: binds sim+render+audio, tower/enemy mesh sync + animation rigs, projectile visuals, event→juice, win/lose, range indicator |
| `src/08_ui.js` | HUD controller: build palette (SVG icons), inspect/upgrade/sell, wave pips, toasts, wave banners, floating gold text, end overlays |
| `src/09_input.js` | Pointer picking (tile/tower), camera orbit + zoom, hover highlight, keyboard shortcuts |
| `src/10_boot.js` | Wiring + rAF loop + audio gate + error surfacing |
| `vendor/three.module.js` | Three.js r160 (ESM), inlined + converted to a `window.THREE` global by the build |
| `build.py` | Bakes all modules + Three into one self-contained `td_lowpoly.html`; runs `node --check` per module first |
| `tests/sim.test.mjs` | Headless sim test: full auto-played campaign, determinism, balance (winnable) |
| `tests/smoke.mjs` | Headless full-game smoke test under mocked THREE/DOM/Audio: boots, builds, runs 3600 frames, no crashes |

## Verification performed (evidence, not assertion)
- **Sim unit test** (`node tests/sim.test.mjs`): full 20-wave auto-play → `victory`, 364 kills, deterministic across reruns. PASS.
- **Smoke test** (`node tests/smoke.mjs`): real modules under mocked THREE/DOM/Audio, 3600 frames, towers+enemies+arcs+upgrades, zero crashes. PASS.
- **Real browser** (headless Chrome, served in-call): `THREE` defined, `#err` empty, scene renders non-black; palette measured via `readPixels` — violet 179k px, cyan 15k px, brightPct 6.5%; enemies spawn/move/die; kills award gold; range ring shows; defeat overlay appears on lives=0; build rejects path/core/occupied tiles; restart clears state. Screenshot captured.
- **Two adversarial passes** done by the builder: (1) found + fixed `THREE` ESM→classic export-conversion bug, missing `tryBuildAt` return, dark/desaturated scene, rAF-throttle fragility in end-overlay; (2) added range indicator, wave/boss banners, floating gold, core-breach toasts; reduced DPR + simplified post-FX for smoothness; fixed rangeRing init order.

## Notes / honest limitations
- Vision API was unavailable (401) so visual *quality* was confirmed structurally (pixel histograms, mesh counts, state) rather than by eye. The scene is verifiably lit in the Neon Reliquary palette; fine art-direction nuance should be eyeballed by a human in a foreground browser tab.
- Camera/paint FX are tuned for a foreground tab; headless `requestAnimationFrame` is throttled, so all sim advancement in tests was driven by manually calling `game.frame(now)`.
- Gameplay is single-player TD (not the repo's PvPvE). Balance: campaign is winnable with a competent line; boss has 4200 HP / 14 armor.
- No external assets: all art is procedural Three.js geometry, all audio is synthesized. The artifact is fully offline-capable.
