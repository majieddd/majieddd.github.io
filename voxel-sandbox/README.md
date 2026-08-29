# Voxel Sandbox

A playable ten wave tower defence running on a voxel renderer. It is a **test
bed, not a port**: it shares no code with `js/` so neither side can break the
other, and nothing here is loaded by `index.html` or inlined by `build.js`.

## Run it

```
python -m http.server 8471 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8471/voxel-sandbox/index.html>.

No build step, no dependencies, no install. Same rules as the shipping engine:
plain `<script>` tags, globals, Canvas 2D, no WebGL.

## What it is for

The phase study found that the textured voxel register needs roughly **64px
minimum** to read, and the shipping board draws units at **4 to 36px**
(`TILE = 38`, enemy `radius` 2 to 18 in `js/factions.js`). That gap is a camera
question, and a camera question cannot be settled from still images.

So this runs at the camera the scale test asked for: units bake at **74px**,
tiles are 92x46. If it turns out to play badly this zoomed in, that is a real
result and this was the cheapest way to find it.

## Files

| File | What it is | Ports over? |
|---|---|---|
| `js/vox.js` | The renderer. Box data in, baked sprite frames out. | **Yes, unchanged.** This is the reusable part. |
| `js/models.js` | Box data per unit and tower, on BRAND.md palettes. | Yes, extend it per unit. |
| `js/sandbox.js` | Board, lane, waves, towers, combat. | No. Throwaway. `js/game.js` already does all of this properly. |
| `index.html` | Shell and HUD. | No. |

## The one architectural decision

Models are **baked once into sprite canvases at 24 yaw angles**, and the game
loop only ever calls `drawImage`. Rasterising every cube every frame does not
scale: a 200 voxel model at 20 units on screen is 4000 cubes and up to 12000
face fills per frame. Baking moves all of that to load time, which also means
the halftone texture pass costs nothing at runtime.

Measured on this machine: 7 models, **289 ms** to bake all of them, **1.3 MB**
of sprite cache for 24 angles each, **60 fps** with 10 units and 6 towers live.

Compare that to the `image_to_3d` route the phase study tested, which returned
**5.77 MB and 28,707 triangles for one unit**. The whole sandbox costs a
quarter of one generated mesh.

## Verified

Driven headlessly through `tools/headless.js`:

- all ten waves complete, `phase` reaches `won`
- 90 killed, 0 leaked, 20 lives held with 8 emplacements
- 60 fps sustained through wave 10
- no console errors (the only 404 is `favicon.ico`)
- `node --check` clean on all three modules, zero em dashes

## Known gaps, deliberately

- **Balance is untuned.** Eight towers hold all ten waves without leaking. It
  is a rendering test bed, not a difficulty curve.
- **No pathfinding.** The lane is hand authored in `PATH`. The real game
  generates maps.
- **One board, no factions, no commanders, no talents, no multiplayer.** All of
  that already exists in `js/` and reimplementing it here would be waste.
- **Enemy models are reused as-is at every wave.** No tier variants.

## If this look gets adopted

The port is `js/vox.js` plus a per-unit `models.js` entry, called from the
existing draw path in `js/entities.js`. Everything else here stays behind.
The open decision the sandbox exists to inform is whether the board camera
moves to make units big enough, or whether board units get a coarse LOD tier
and the detailed register lives on the dossier and card surfaces instead.
