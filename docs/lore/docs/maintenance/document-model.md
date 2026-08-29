---
id: document-model
title: Document Model
type: maintenance
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Document Model

Every maintained Markdown page in `docs/` has YAML front matter.

```yaml
---
id: faction-humans
title: Humanity
type: faction
status: core
evidence: F
last_reviewed: 2026-08-25
game_ids: [human]
---
```

## Status values

- `core`: binding until deliberately changed.
- `provisional`: approved for development but still easy to revise.
- `research`: noncanon source analysis.
- `deprecated`: retained for history; must point to a replacement.

## ID rules

- IDs are lowercase kebab case.
- IDs never change merely because a title changes.
- Data records reference document IDs, not paths when possible.

## Data mirrors

- `data/factions.json` mirrors the five faction contracts.
- `data/game-faction-map.json` mirrors code integration.
- `data/timeline.json` mirrors the campaign chronology.
- `data/glossary.json` mirrors key terms.
- `data/canon-manifest.json` lists maintained core pages.

Markdown is authoritative for prose. JSON is authoritative for stable IDs and integration fields. A mismatch is a validation failure or review blocker.
