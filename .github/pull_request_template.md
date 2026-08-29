## What changed

<!-- One or two sentences. What behaviour is different for a player? -->

## Module(s) touched

<!-- js/ui.js and js/game.js are ~4,000 and ~3,500 lines. Naming your lane here
     is what keeps two people out of the same file. See CONTRIBUTING.md §2. -->

- [ ] `js/config.js` (tunables, data)
- [ ] `js/game.js` (state, simulation)
- [ ] `js/ui.js` (screens, overlays)
- [ ] `js/entities.js` / `js/entities2.js`
- [ ] `js/ai.js`
- [ ] `js/commanders.js` (save format, say so loudly if the shape changed)
- [ ] art pipeline (`artgen/`, `js/artpack.js`)
- [ ] other: ______

## How I verified it

<!-- Not "it looked fine". What did you run, and what did it say? -->

- [ ] Served a cache-busted build and exercised the change by hand
- [ ] `tools/owner-sweep.js`, result: ____ pass / ____ fail
- [ ] `node build.js` succeeds and the game still loads from the bundle

## Balance

<!-- Required if you touched economy, AI, towers, enemies, waves or a talent
     tree. Both pins, measured, see CONTRIBUTING.md §5. Delete if untouched. -->

- fresh profile, median LOSS wave: ____ (pin: 6-7, every loss under 10)
- maxed unlocks at **tier 0**, `spine`: wave ____ (pin: ~27)

## Checks

- [ ] No number the UI prints was re-derived, it calls the engine's own function
- [ ] Rival parity holds: anything the player gained, the rival can gain too
- [ ] I did not edit `aegis-protocol.html`, `aegis-artifact.html` or `js/artpack.js` by hand
- [ ] I did not reformat code I was not otherwise changing
