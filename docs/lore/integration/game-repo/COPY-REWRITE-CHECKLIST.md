# Live Game Copy and Asset Rewrite Checklist

**Lore release:** 0.3.2
**Game-content retrofit baseline:** 0.3.0
**Pinned game commit:** `046fc38634fadf13148ef9ad3aa208417f28f2de`

This checklist changes presentation and context only. Stable IDs, balance values, deterministic generation, save keys, and the network protocol remain untouched unless a separate engineering change explicitly authorizes them.

## Pass 1 — Global premise

- [ ] Replace generic title-screen and faction-select copy with the 2099 Sol Gate premise.
- [ ] Explain the five conquest verbs: Settle, Accord, Bind, Route, Continue.
- [ ] Explain that Vigil waves are legacy jurisdiction enforcement, not a sixth political faction.
- [ ] Explain Echo Reversal before the first battle.

## Pass 2 — Factions and commanders

- [ ] Apply the five faction dossiers to cards, selection screens, and ending text.
- [ ] Add history, motive, contradiction, and affiliation fields for all 26 commander IDs.
- [ ] Keep Ashtar above the field-command roster as Federation Supreme Commander and First Speaker.
- [ ] Present `nyx_r`, `lumen_r`, `mawlord_r`, and `dregg_r` as autonomous Mirror Trials, not resurrected originals.
- [ ] Drive rival dialogue from `data/commander-relationships.json` plus campaign state.

## Pass 3 — Units, towers, and enemies

- [ ] Add one concise provenance line and one long dossier entry to all 25 faction units.
- [ ] Add provenance, builder institution, and doctrinal purpose to all 60 tower IDs.
- [ ] Add original civil function, current corruption, and behavior rationale to all 29 Vigil chassis.
- [ ] Resolve the display-name collision between Human tower `reclaimer` and Vigil elite `mb_lich` without changing either stable ID.
- [ ] Preserve role glyphs and live mechanical descriptions.

## Pass 4 — Worlds and campaign

- [ ] Generate world dossiers from system index, world index, owner, contender, map, kind, denizen set, modifier, boon, and scenario.
- [ ] Treat each five-system campaign as a Source-Lattice pentad and each seven-world system as registered jurisdictions.
- [ ] Give every authored battlefield a former infrastructure function and present conflict.
- [ ] Explain stars as claim stability and SOULS as Source-Oriented Unified Lattice Signatures.
- [ ] Use the Archive War missions as authored scenario seeds without converting real UAP records into confirmed alien events.

## Pass 5 — Visual production

- [ ] Rebuild commander portraits from `data/visual-asset-briefs.json`.
- [ ] Preserve morphology/politics separation: species does not determine faction.
- [ ] Keep Old Weather, Vigil, and Parallel visually distinct.
- [ ] Rebuild world plates from jurisdiction function plus current holder rather than generic planet genre.
- [ ] Add faction materials and provenance cues to tower and unit plates.

## Pass 6 — Validation

- [ ] Run the lore validator.
- [ ] Run `node --check` on every changed JS module.
- [ ] Rebuild the standalone bundle.
- [ ] Run owner sweep, multiplayer harness, and deterministic generation tests.
- [ ] Inspect faction, commander, loadout, galaxy, dossier, and battle surfaces at reference resolutions.
- [ ] Verify no lore-only change altered save migration or `NET_PROTOCOL`.
