---
id: coverage-audit
title: Live Game Lore Coverage Audit
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-26
---

# Live Game Lore Coverage Audit

This game-content audit compares the 0.3.0 game-content retrofit layer, preserved through lore release 0.5.0, to the reviewed live snapshot `046fc38634fadf13148ef9ad3aa208417f28f2de`. It is the proof that the retrofit preserved the content inventory rather than replacing it with a smaller curated subset.

| Live category | Expected | Registered | Coverage | Canon location |
|---|---:|---:|---|---|
| Top-level factions | 5 | 5 | Complete | faction docs and `data/factions.json` |
| Commanders | 26 | 26 | Complete | [Commander Bible](commander-bible.md), `data/commanders.json` |
| Commander relationship seeds | new | 19 | Initial canonical pool | [Relationship Map](commander-relationships.md) |
| Faction units | 25 | 25 | Complete | [Troops and Vigil](troops-and-vigil.md), `data/units.json` |
| Neutral Vigil chassis | 29 | 29 | Complete at provenance/family level | `data/vigil-chassis.json` |
| Total enemy definitions | 54 | 54 | Complete as 29 neutral + 25 faction | troops/Vigil docs |
| Towers | 60 | 60 | Complete | [Tower Arsenal Bible](tower-bible.md), `data/towers.json` |
| Active abilities | 12 | 12 | Complete | `data/abilities.json` |
| Authored battlefields | 21 | 21 | Complete | [Worlds and Battlefields](worlds-battlefields-and-planets.md) |
| Generated Maelstrom | 1 | 1 | Complete | same |
| Arena modifiers | 8 | 8 | Complete | [Boons, Modifiers, and Scenarios](boons-modifiers-and-scenarios.md) |
| Victory boons | 20 | 20 | Complete | same |
| Scenario modes | 7 | 7 | Complete | same |
| Campaign structure | 5 systems x 7 worlds | matched | Complete | [Campaign Era: 2099](../canon/campaign-era-2099.md) |
| World kinds | 4 | 4 | Complete | world-generation data |
| Unified contributor revamp matrix | 209 rows | 209 | Complete | `data/content-revamp-matrix.csv` and `.json` |
| Dialogue architecture | openers, faction pools, special pairs | mapped | Structurally complete; line expansion remains implementation work | [Dialogue Bible](dialogue-and-character-voice.md) |
| Planet/world art variants | procedural categories | mapped by environmental tags | Design complete; art production remains implementation work | worlds/planets doc |
| Chronology and causal history | deep-time through 2099 | 3 synchronized layers | Complete at canon-hinge level | `docs/canon/master-chronology.md` and `causal-history.md` |
| Mythos source systems | 84 | 84 | Complete research index; additions remain evidence-labeled | mythos atlas and chronology audit |
| Mythos Operations | 130 | 130 | Complete optional scenario pool | `data/mythos-operations.json` |

## Preservation check

Every path contained in lore release 0.2.0 remains present. Release 0.3.0 added the game retrofit layer; release 0.3.1 added archive research and release 0.3.2 added archive-fidelity controls and synchronized mission records; release 0.4.0 adds the broader mythos atlas, and release 0.5.0 adds the master chronology, causal history, M-61 through M-84, and MO-101 through MO-130 without deleting or renaming any stable game-content entry.

## What is complete now

Every current content ID has a canonical place, political meaning, historical reason, or deterministic generation rule. The package is sufficient to begin rewriting player-facing copy, codex pages, portraits, world dossiers, and dialogue without inventing isolated lore per asset.

## What remains implementation work rather than missing lore

- Transferring the registry into a new live `js/lore.js` module.
- Writing every final contextual dialogue permutation.
- Producing revised portraits, crests, world plates, tower plates, and enemy dossier art.
- Reviewing every upgrade/talent name against the new doctrine language.
- Resolving the player-facing name collision between Human tower `reclaimer` and Vigil elite `mb_lich`, both displayed as **RECLAIMER**, without changing either stable ID.
- Running the game repository's build, owner sweep, multiplayer harness, and visual QA after UI copy changes.

## No-drop rule

Future research may deepen or correct an entry, but it may not silently delete a stable live ID. Deprecation requires a migration note, replacement mapping, and explicit reason.
