# CHANGE NOTE - 3d-game-delta lane (2026-08-29)

New variant lane: INKFALL: Siege of the Avalon Yard (3D tower defense).
Slug kept isolated: /3d-game-delta/. No other files touched.

Files in this change:
- 3d-game-delta/index.html - the complete game, single-file build (1.6 MB, self-contained,
  vendored three.js r128 + Blender-baked textures + WebAudio code; file:// compatible)
- 3d-game-delta/README.md - play notes and links
- 3d-game-delta/docs/STYLE.md - art bible (palette, shader recipe, readability rules)
- 3d-game-delta/docs/PLAN.md - engine decision research + architecture
- 3d-game-delta/docs/ROUNDS.md - five adversarial review rounds with measured facts

Verification: full 3-wave win (123 kills, core 4/20, 0 JS errors, 138fps idle / 93 combat)
on Helium GPU via tools/cdp-verify.mjs before publishing.
