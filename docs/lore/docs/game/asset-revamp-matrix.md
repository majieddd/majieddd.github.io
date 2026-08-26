---
id: asset-revamp-matrix
title: Asset Revamp Matrix
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Asset Revamp Matrix

The unified matrix gives writers, artists, designers, and coding agents one row per current content object. It combines stable ID, political alignment, historical origin, present mechanic, moral tension, governing document, and retrofit status.

- CSV: [`../../data/content-revamp-matrix.csv`](../../data/content-revamp-matrix.csv)
- JSON: [`../../data/content-revamp-matrix.json`](../../data/content-revamp-matrix.json)

## How teams should use it

- **Character and portrait work:** filter `category = commander`.
- **Troop and enemy dossier work:** filter `faction_unit` or `vigil_chassis`.
- **Tower visual redesign:** filter `tower`, then preserve the stable ID and mechanic.
- **Planet and battlefield art:** filter `battlefield` and combine it with the generated World Identity Packet.
- **Dialogue:** use commander motive, contradiction, relationship tags, current world claim, and campaign act.
- **Implementation review:** no row may be marked complete until its final player-facing copy links back to its canonical document.

This matrix does not replace the category-specific JSON. It is a contributor-oriented index across them.


## Production companions

- [Art Direction and Asset Revamp Brief](art-direction-and-asset-brief.md)
- [Archive War Mission Seeds](archive-war-mission-seeds.md)
- [`data/visual-asset-briefs.json`](../../data/visual-asset-briefs.json)
- [`data/archive-war-missions.json`](../../data/archive-war-missions.json)
