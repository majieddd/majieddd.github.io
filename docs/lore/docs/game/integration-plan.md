---
id: integration-plan
title: Game Integration Plan
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Game Integration Plan

## Goal

Make every commander, unit, tower, ability, battlefield, world, boon, modifier, and dialogue line answer to the same history without turning the match UI into a novel.

## Phase 1 - Canon payload

- Import the JSON registries as a generated `LORE` object.
- Add source-game and lore-version fingerprints to the development console.
- Do not add the lore fingerprint to multiplayer determinism unless it changes simulation state.

## Phase 2 - Faction and campaign surfaces

- Rewrite faction cards from the five campaign premises.
- Add the 2099 opening situation to campaign start.
- Explain pentads, seven jurisdictions, commander seats, contested worlds, Stars, SOULS, and the Vigil once, then rely on dossiers.

## Phase 3 - Characters

- Add role, history, motive, contradiction, and voice tags to commander dossiers.
- Replace faction-generic replies with state-aware dialogue pools.
- Add Machine opener lines and Parallel-specific relationship scenes.

## Phase 4 - Arsenal and units

- Keep mechanic-first descriptions.
- Add one optional provenance line to tower and unit panels.
- Add original civil/custodial purpose to Vigil dossiers.

## Phase 5 - Worlds

- Generate a World Identity Packet from fields already in the campaign object.
- Add battlefield history, world-kind meaning, holder claim, contested claim, and boon provenance.
- Keep prose generation deterministic and outside the PRNG stream.

## Phase 6 - Endings

- Give each faction public, secret, catastrophic, and redemptive end states.
- Let the Maelstrom reveal the Source-Lattice governance question rather than merely serving as a larger arena.

## Acceptance tests

- No stable ID changes.
- Old saves load.
- Same seed produces the same galaxy, maps, owners, modifiers, and rewards.
- Network protocol remains compatible unless a separate simulation change requires a bump.
- UI still leads with mechanics.
- Historical claims retain evidence labels in the wiki.
