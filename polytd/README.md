# POLY PROTOCOL — medium/low-poly 3D tower defense demo

A self-contained WebGL2 tower defense built for the **Cosmic Conquest** universe, in the
**Neon Reliquary** register: bold flat brushwork, painted skybox, chrome greys, one faction
hue per asset, void-black ground.

## Run

Serve this folder over HTTP (browsers load classic scripts fine over file://, but WebGL
cubemaps and module-free assets are served reliably from any static server):

```
npx serve polytd        # or: python -m http.server -d polytd 8080
```

Open `http://localhost:8080/` (or whatever port) → **DEPLOY → THE AEGIS → pick a board → BEGIN THE VIGIL**.

## What's inside

| file | role |
|---|---|
| `index.html` | shell, canvas, HUD DOM, script order |
| `css/polytd.css` | dark-glass chrome UI: chips, dock, abilities, inspector, screens, toasts |
| `js/gl.js` | custom WebGL2 micro-renderer: painterly pipeline (quant, ink-edge, brush grain, grain, vignette, chromatic edge), toon bands + fresnel rim + fog, fullscreen ray skybox, additive billboard pool |
| `js/art.js` | palette, brush/sky textures, RGB fns |
| `js/geo.js` | all procedural models: board + rune + tile frames, portal arch, core relic, 8 towers, 9 enemies, Rig pose system |
| `js/data.js` | 8 towers, 9 enemies, 12 waves (2 bosses), 3 boards, element/reaction tables, HP curve |
| `js/audio.js` | Web Audio synth: 84 BPM score + SFX vocabulary |
| `js/game.js` | Battle sim: path, targeting, marks/reactions, projectiles/lobbed/hitscan/cone/aura, economy, abilities, FX |
| `js/ui.js` | screens: title → deployment plan → briefing → HUD, dock, inspector, tooltips |
| `js/main.js` | App: input (orbit/drag/wheel), raycast, loop, screens flow |

## Design

- **No runtime dependencies, no framework.** Everything is hand-rolled WebGL2 + DOM.
- **Marks & reactions**: 5 elements, 10 named reactions (THERMAL SHOCK, SUPERCONDUCT, …) when marks overlap on an enemy.
- **Depth**: cycle speed, pause, sell/upgrade, prism strike (nuke), overclock (fire-rate haste).
- **Boards**: Orrery (humanity cyan), Crown (gold), Maelstrom (magenta) — each its own road layout.

## Tools

`tools/poly_headless.js` — CDP-driven smoke test: boots the page, clicks through screens,
places a scripted build, fast-forwards the sim, asserts zero console errors.

`tools/poly_shoot.js` — deterministic state shooter: renders `title | briefing | built | wave1`
states to PNG. `POLYTDMAP=crown node tools/poly_shoot.js built shot.png` for other boards.
