# Cosmic Reliquary: Forge Edition

An isolated second implementation of Cosmic Conquest built around a Blender-authored asset pipeline and a deterministic TypeScript and Three.js runtime. It does not modify the existing `reliquary` game.

## Run

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:8752/`.

## Controls

- Select a tower from the bottom arsenal, then select a marked build socket.
- Drag the battlefield to orbit the camera.
- Use the mouse wheel or trackpad to zoom.
- Use `R` to reset the camera and `M` to mute audio.

## Production build

```sh
npm run gate
```

The production output is written to `dist/` with relative asset URLs for nested GitHub Pages hosting.

## Asset pipeline

```sh
npm run assets
```

This runs Blender headlessly and rebuilds the eight painted GLB warforms plus their texture set. The source of truth is `tools/blender/generate_assets.py`.

## Quality evidence

- `tools/verify.mjs` checks boot, model animation, planted versus airborne bounds, enemy path-facing, tower aim-facing, stable shadows, input reachability, responsive UI, reduced motion, and console health.
- `tools/adversarial.mjs` checks hostile unit load, draw-call bounds, simulation invariants, extreme camera positions, locked ultra quality, boss articulation, and mobile overflow.
- `tools/compare.mjs` runs the original Reliquary and Forge Edition in one browser process with matched viewport and combat load, then writes screenshots and measured results to `tools/out/comparison/`.
- `ENGINE-EVALUATION.md` records why Blender and Three.js were selected, and why Godot was not selected for this browser target.

The automated headless rig uses SwiftShader to make rendering deterministic. Its frame-time readings are diagnostic only. Use the in-browser FPS display or a hardware profiler when assessing player-facing GPU performance.

## Reference study

No third-party models ship in this project. The anatomy and turret studies used two CC0 reference packs to improve readable silhouette and articulation: [Quaternius Animated Monster Pack](https://quaternius.com/packs/animatedmonster.html) and [Kenney Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists). The final GLBs, paint textures, rigs, and effects are authored in this repository.
