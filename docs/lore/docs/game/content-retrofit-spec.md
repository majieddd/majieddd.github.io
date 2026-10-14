---
id: content-retrofit-spec
title: Content Retrofit Specification
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Content Retrofit Specification

This is the implementation contract for bringing the live game at `046fc38634fadf13148ef9ad3aa208417f28f2de` into alignment with lore version `0.3.0`.

## Non-negotiable preservation

Do not change these while performing a copy/lore retrofit:

- faction IDs: `human`, `light`, `xeno`, `pirate`, `robot`;
- commander, unit, tower, ability, map, and boon IDs;
- save keys or campaign-seed behavior;
- tower statistics, unlock costs, traits, and faction riders;
- network protocol or deterministic simulation;
- generated bundles directly.

## Add one lore registry

Create a small source module, for example `js/lore.js`, generated from this repository's JSON. It should expose records by stable ID:

```js
LORE.commanders.vanta
LORE.towers.reclaimer
LORE.units.votary
LORE.maps.ossuary
LORE.abilities.attrite
```

Game definitions remain mechanically authoritative. The lore registry supplies optional fields such as:

```js
{
  era,
  builder,
  historicalOrigin,
  doctrine,
  politicalRisk,
  codex,
  voice,
  relationshipTags,
  sourceLayer
}
```

## Asset retrofit order

1. **Faction cards:** replace legacy monolith copy with the five campaign premises.
2. **Commander dossiers:** add role, history, motive, contradiction, and relationship tags.
3. **Dialogue:** implement state-aware pools from the voice bible.
4. **World dossiers:** generate a World Identity Packet from existing campaign data.
5. **Units:** show formation, relationship to the player, and original civil/military function.
6. **Towers:** add builder, origin incident, and political cost beneath the current mechanic-first description.
7. **Vigil enemies:** add original maintenance function and why it interprets the player as unauthorized.
8. **Maps:** connect geometry to a Lattice or infrastructure history.
9. **Boons and modifiers:** explain the institution or local condition being recovered.
10. **Endings:** resolve the Source Lattice question differently for each faction.

## UI hierarchy

The first line must remain useful during play. Lore is progressive disclosure:

- **card:** name, role, core mechanic;
- **tooltip:** one lore sentence;
- **dossier:** origin, doctrine, political risk;
- **wiki:** source history, evidence labels, contradictions, campaign arcs.

## World dossier generation

A deterministic function can create consistent prose without storing large strings in the save:

```text
[Registry Name] is a [World Kind] in the [System] pentad.
[Owner] holds the active claim; [ContestedBy] retains a rival record.
Its [Map] topology originated as [Map Canon].
[Denizens] indicate surviving Vigil functions.
The recoverable [Boon] explains why the factions keep returning.
```

## Definition of done

A content object is retrofitted when a player can answer:

1. who built or formed it;
2. why it exists outside the current match;
3. why its mechanic follows from that history;
4. what the owner wants now;
5. what moral or political problem it introduces;
6. which stable game ID and canon document govern it.
