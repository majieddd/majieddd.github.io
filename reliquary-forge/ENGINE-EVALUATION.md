# Engine and Asset Pipeline Evaluation

## Target

Ship a GitHub Pages compatible browser tower defense that improves the current Reliquary build in authored asset detail, unit animation, impact fluidity, visual hierarchy, and measurable frame pacing.

## Blender 5.2.1 LTS

Verdict: use it.

- Creates named, beveled, UV-mapped, material-aware warforms instead of runtime primitive assemblies.
- Exports binary glTF with stable pivots and meshopt-ready geometry.
- Makes asset generation reproducible through a checked-in Python source file.
- Allows the runtime to animate semantic parts such as legs, jaws, petals, barrels, rings, and cores.

## Godot 4 web path

Verdict: do not use it for this browser build.

- Godot 4 web exports are restricted to WebGL 2 through the Compatibility renderer.
- The preferred single-threaded web export improves hosting compatibility but gives up engine threading.
- The low-latency Web Audio sample path does not support AudioEffects, reverb, doppler, or procedural audio.
- The engine WebAssembly payload would add startup cost without improving the specific shader and audio paths this demo needs.

Godot remains attractive for a native desktop port, an editor-driven campaign tool, or a future project where authored scenes and native export matter more than a lean GitHub Pages build.

## Three.js 0.185.1

Verdict: use it as the runtime.

- Provides a direct GLB loading and animation path with no editor lock-in.
- Keeps render graph, post-processing, audio, simulation, and diagnostics independently measurable.
- Supports the custom wet-pigment post pass, instanced effects, stable shadows, and adaptive quality needed here.
- Produces a static deployment that GitHub Pages can serve directly.

## Selected experiment

Blender-authored GLB warforms feed a TypeScript and Three.js runtime. The simulation is renderer-independent and deterministic. The renderer owns interpolation, camera damping, model-part animation, particles, shadows, lighting, and post-processing. The HUD is a sparse DOM overlay. Verification compares this build and the original Reliquary in the same browser process at the same viewport and combat load.
