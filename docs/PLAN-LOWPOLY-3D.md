# PLAN-LOWPOLY-3D, Cosmic Conquest: LOWPOLY (3D tower defence)

**Status: FROZEN SPEC. Completion criteria at the bottom are write-once.**
Author: Hermes (agent session). Branch: `lowpoly/td3d`. Touch radius: `lowpoly/**`,
this file, and the OWNER-NOTES change doc. No existing 2D game file is edited.

## Objective

A medium/low-poly **3D tower defence** variant of Cosmic Conquest, in the same
universe and mechanics DNA, with a **new art direction**: the illustrative
wet-oil-painting look of the world plates (Neon Reliquary, bold flat brushwork,
hard shapes, hued shadows, halftone grain) rendered onto faceted low-poly
geometry. Art, audio and UI are all **different from the 2D game's** procedural
sprites, nothing is reused from `js/artpack.js`.

AAA bar: high-fidelity synthesized audio, juice (hit-stop, screen shake, bloom,
particles, shatter), modern glass UI, and full unit/tower animation.

## Tech decisions

- **three.js r128 UMD**, vendored at `aegis-3d/vendor/` (no CDN at runtime, works
  from any static host). Classic `<script>` tags, zero build step to play.
- **Painterly textures generated at runtime** from seeded PRNG on canvas 2D
  (`aegis-3d/js/paint.js`), deterministic, zero assets on disk.
- **Web Audio** synthesised everything (`aegis-3d/js/audio.js`): adaptive music,
  SFX, ambience, spatial panning, master limiter. No sample files.
- Folder served from the repo root; GitHub Pages URL: `/aegis-3d/`.

## Layout

```
aegis-3d/
  index.html          shell, canvas, UI containers
  css/style.css       glass HUD, screens, banners
  vendor/             three.min.js + 6 UMD post-processing files
  js/paint.js         painterly texture factory, palettes, atlas cache
  js/util.js          seeded RNG, math, easing, pooling
  js/audio.js         synth engine, music scheduler, SFX
  js/data.js          towers, enemies, waves, reactions, commanders (all tunables)
  js/terrain.js       heightfield, path, build grid, decorations
  js/fx.js            particles, beams, shockwaves, damage numbers, shatter
  js/units.js         enemy models, animation, pathing, statuses
  js/towers.js        tower models, tiers, targeting, projectiles, reactions
  js/commander.js     the four commanders and their eight abilities
  js/game.js          state, economy, waves, loop, camera, input
  js/ui.js            DOM HUD, screens, shop, inspector
  js/main.js          bootstrap, resize, keyboard
  tools/smoke.mjs     CDP smoke harness (menu/battle/fullrun/boss/reactions)
  build.js            inlines into cosmic-lowpoly.html (single file, file:// ok)
```

## Roster (IP-continuous names/mechanics from js/config.js & roster.js)

**12 towers** (element coverage makes all ten reactions reachable):
bolt (kinetic/human), cryo (frost/human), mortar (fire/human), arc (storm/human),
flak (kinetic/human, anti-air), railgun (kinetic/robotic), prism (radiant/light),
tether (frost/pirate), pyre (fire/pirate), toxin (venom/xeno), singularity
(void/robotic), canister (venom/human). Each tower: unique low-poly model, **3
upgrade tiers with visible model evolution**, muzzle/impact FX, audio identity.

**10 enemies + 2 bosses** (models + walk/hover/attack/death anims):
shardling, crawler, sprinter, wisp (flying), aegis (shield), mender (heals),
cluster (splits→spawnling), juggernaut, warden, carrier (summons mites) ·
miniboss COLOSSUS, boss HARBINGER (two phase shifts, summons, enrage).

**Elements & reactions:** all 7 elements, all 10 reactions (plasma,
superconduct, catalyse, thermal shock, immolate, paralysis, collapse, entropy,
rupture, blight) with screen-space callouts. Marks shown as ringed glyphs.

**4 commanders** (one per faction, the 2D free starters): VANTA (overclock,
dampen), SERAPH (zealotry, sanctify), SEVRA (ravenous, consume), RAKE
(broadside, smokescreen). Q offensive / E defensive, cooldowns, unique VFX.

**Wave curve:** the same piecewise `waveHpMultiplier` (×1.26 to wave 10, ×1.22
to 20) with seeded spawn tables; 20 waves, wave 20 is the HARBINGER. 20 lives.
Economy: gold, tower buy/upgrade×2/sell, wave bonus. Difficulty: skirmish /
contested / overrun (hp×0.80/1.00/1.22).

**UI:** glass start screen (faction + commander + map + difficulty), battle HUD
(wave, gold, lives, speed ×1/×2/×4, pause), tower shop with **live 3D
previews**, range rings + placement ghost, tower inspector (upgrade/sell/
targeting), wave banners, reaction callouts, damage numbers, pause menu,
victory/defeat screens with run stats, audio settings.

## Out of scope (named, not smuggled)

Full 39-tower roster · multiplayer net.js · campaign galaxy · reanimation ·
touch-only layout · offline SDXL/Krea artgen (3D paints procedurally instead).
No existing 2D file is modified.

## Completion criteria (FROZEN, write-once)

1. `aegis-3d/` runs over plain HTTP with **no console errors**; ≥55 fps at 1080p
   on the dev machine during a mid-game wave.
2. Full loop: start screen → battle → wave 1…20 → victory OR defeat screen with
   stats → restart, all reachable.
3. All 12 towers placeable, attack, upgrade ×2 (visible model change), sell.
4. All 10 reactions verified firing with callout + damage on marked enemies
   (instrumented probe, not assertion).
5. All 10 enemy types + COLOSSUS + HARBINGER spawn and behave per spec (flier
   path, shield, heal, split, summon, boss phases).
6. All 4 commanders selectable; Q and E abilities fire with visible effect.
7. Audio: music + SFX audible (AudioContext state running, no errors).
8. UI: shop, inspector, pause, speed, settings, end screens all functional.
9. Two adversarial review passes; every finding fixed or dismissed with reason,
   logged in the OWNER-NOTES doc.
10. Shipped: branch `aegis-3d/lowpoly` pushed, live at
    https://majieddd.github.io/aegis-3d/ verified by fetching the URL.
