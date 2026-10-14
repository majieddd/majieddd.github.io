# Cosmic Conquest Lore Retrofit Handoff

Lore release: **0.3.3**
Game-content retrofit baseline: **0.3.0**
Game snapshot reviewed: **046fc38634fadf13148ef9ad3aa208417f28f2de**

## Mythos layer

The staged payload now also contains 37 research-tagged myth systems, 15 canon institutions, and 74 optional Mythos Operations. It also contains an 18-episode *Inside Job* design reference that is explicitly fictional and noncanonical. They are not loaded by the game and do not alter simulation state. Use them first for dossier copy, deterministic world tags, dialogue conditions, and campaign pitches. Any mechanic derived from them requires its own balance, save, and multiplayer review.

## Use

1. Copy `integration/game-repo/js/lore.generated.js` into the game repository as `js/lore.js`.
2. Add `js/lore.js` to `build.js` before UI/dialogue modules consume it.
3. Keep mechanics in the existing simulation files; read lore only in UI, dialogue, codex, dossiers, art generation, and world-description surfaces.
4. Follow `COPY-REWRITE-CHECKLIST.md` and `docs/game/content-retrofit-spec.md` category by category.
5. Generate deterministic world prose only from already-generated campaign fields. Lore generation must never advance the campaign PRNG.
6. Run the game's build, owner sweep, multiplayer harness, mutation checks, newline checks, and reference-resolution visual review.

## What the generated module contains

- 26 commanders and 19 relationship seeds
- 25 faction units and 29 Vigil chassis
- 60 towers
- 22 battlefields including Maelstrom
- 12 active abilities
- 20 boons, 8 arena modifiers, and 7 scenarios
- 37 Archive War mission seeds (24 base retrofit + 13 archive-expansion missions)
- commander/faction visual briefs
- deterministic world-generation lore rules
- 37 myth systems, 15 provisional institutions, and 74 optional Mythos Operations

## Do not

- edit generated `aegis-protocol.html`, `aegis-artifact.html`, `js/artpack.js`, or `lore.generated.js` by hand;
- rename stable IDs;
- use lore text or relationship state in the deterministic simulation fingerprint;
- make lore generation consume random draws;
- alter save keys, balance, campaign seeds, or `NET_PROTOCOL` as part of a lore-only PR;
- represent historical UFO, contactee, religious, or astronomical material as verified alien history.

## Canonical source files

- `data/game-content-registry.json`
- `data/commanders.json`
- `data/commander-relationships.json`
- `data/units.json`
- `data/vigil-chassis.json`
- `data/towers.json`
- `data/battlefields.json`
- `data/abilities.json`
- `data/boons.json`
- `data/arena-modifiers.json`
- `data/scenarios.json`
- `data/archive-war-missions.json`
- `data/visual-asset-briefs.json`
- `data/world-generation.json`
- `data/content-revamp-matrix.json`
