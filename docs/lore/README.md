> [!CAUTION]
> **THE TIMELINE IN THIS TREE IS SUPERSEDED. Read [`../CANON-2029.md`](../CANON-2029.md) first.**
>
> Release `0.5.0` builds toward a campaign set in **2099**, after a seventy-year
> fictional divergence. The game does not use that setting any more. The owner
> revised the canon on 2026-08-26 and the campaign now **begins on April 13,
> 2029**, the day the Apophis intercept succeeds and the fleet built to save
> Earth declines to stand down.
>
> If you came here to learn what Cosmic Conquest is about, this file will tell
> you the wrong story. That is not hypothetical: it already happened.
>
> **What is still authoritative here** is the research layer, and it is the
> reason this tree is kept rather than deleted. The documented record from 1947
> to 2026 (evidence layers A, B and C: real cases, real sensor history, real
> cultural history) is sourced, careful, and is the material the 2029 canon
> draws its texture from. The disclosed hardware, the case dossiers and the
> mythos atlas are all fuel.
>
> **What is not** is the fictional layer after 2029 (evidence layer F): the
> 2030-2099 divergence, the Sol Gate era, Old Weather, the Archive Wars,
> Signal Winter and the Noetic sequence. Those describe a future the campaign
> no longer has.

# Cosmic Conquest Lore

The research corpus and universe bible for **Cosmic Conquest**.

**Canonical timeline:** [`../CANON-2029.md`](../CANON-2029.md), owner revision, 2026-08-26
**This tree's release:** `0.5.0` (research current, fictional timeline superseded)

**Newest research delta:** 84 myth systems, 130 Mythos Operations, a deep-time-to-2099 master chronology, explicit causal history, 28 global case dossiers, 57 mutation edges, and the Inside Job-inspired institutional design pass.

**Content retrofit snapshot:** `majieddd/majieddd.github.io@046fc38634fadf13148ef9ad3aa208417f28f2de`
**Latest non-invasive placement check:** `majieddd/majieddd.github.io@ee86a08e13c23074f8be0aff435e6c35429c2838`

The playable game remains in [`majieddd/majieddd.github.io`](https://github.com/majieddd/majieddd.github.io). This repository is the canonical source for history, factions, characters, asset provenance, campaign motives, evidence standards, and future content integration.

## Read in this order

0. [`../CANON-2029.md`](../CANON-2029.md) FIRST. It is the timeline the game runs on.
1. [`docs/visual-overview.md`](docs/visual-overview.md)
2. [`docs/canon/overview.md`](docs/canon/overview.md)
3. [`docs/canon/hidden-history.md`](docs/canon/hidden-history.md)
4. [`docs/canon/causal-history.md`](docs/canon/causal-history.md)
5. [`docs/canon/master-chronology.md`](docs/canon/master-chronology.md)
6. [`docs/canon/unresolved-mysteries.md`](docs/canon/unresolved-mysteries.md)
7. [`docs/canon/campaign-era-2099.md`](docs/canon/campaign-era-2099.md) SUPERSEDED, see `../CANON-2029.md`
8. [`docs/game/campaign-premise.md`](docs/game/campaign-premise.md)
9. [`docs/game/commander-bible.md`](docs/game/commander-bible.md)
10. [`docs/game/commander-relationships.md`](docs/game/commander-relationships.md)
11. [`docs/game/troops-and-vigil.md`](docs/game/troops-and-vigil.md)
12. [`docs/game/tower-bible.md`](docs/game/tower-bible.md)
13. [`docs/game/worlds-battlefields-and-planets.md`](docs/game/worlds-battlefields-and-planets.md)
14. [`docs/game/dialogue-and-character-voice.md`](docs/game/dialogue-and-character-voice.md)
15. [`docs/game/art-direction-and-asset-brief.md`](docs/game/art-direction-and-asset-brief.md)
16. [`docs/game/archive-war-mission-seeds.md`](docs/game/archive-war-mission-seeds.md)
17. [`docs/research/mythos-connection-delta-2026-08.md`](docs/research/mythos-connection-delta-2026-08.md)
18. [`docs/research/alien-space-mythos-atlas-2026.md`](docs/research/alien-space-mythos-atlas-2026.md)
19. [`docs/research/myth-mutation-graph.md`](docs/research/myth-mutation-graph.md)
20. [`docs/research/global-ufo-case-atlas.md`](docs/research/global-ufo-case-atlas.md)
21. [`docs/research/inside-job-corpus-map.md`](docs/research/inside-job-corpus-map.md)
22. [`docs/game/mythos-integration-framework.md`](docs/game/mythos-integration-framework.md)
23. [`docs/game/mythos-operations.md`](docs/game/mythos-operations.md)
24. [`docs/game/shadow-bureaucracy-design-principles.md`](docs/game/shadow-bureaucracy-design-principles.md)
25. [`docs/research/black-vault-case-lore-map.md`](docs/research/black-vault-case-lore-map.md)
26. [`docs/research/uap-archive-expansion-2026.md`](docs/research/uap-archive-expansion-2026.md)
27. [`docs/research/current-science-and-forecast-anchors.md`](docs/research/current-science-and-forecast-anchors.md)
28. [`docs/research/next-mythos-deep-research-prompt.md`](docs/research/next-mythos-deep-research-prompt.md)

## Canon in one paragraph

In 2099, Humanity opens the Sol Gate into a five-way struggle over the meaning of conquest. Humans **Settle** and standardize. The Federation of Light under Ashtar **Accords** worlds through consent and shared defense. The Extraction Compact **Binds** civilizations through dependency, genetic control, client elites, and consciousness harvesting. The Scrap Constellation **Routes** access through markets, sanctuary, salvage, and smuggling. The Machines **Continue** through replication, repair, preservation, and inherited law. Neutral Vigil systems release enforcement waves across contested Source-Lattice jurisdictions, and the Echo Reversal Protocol reconstructs the dead as temporary pressure against rival claims.

## Human- and AI-readable

- [`COSMIC-CONQUEST-LORE-BIBLE.md`](COSMIC-CONQUEST-LORE-BIBLE.md) is the compiled single-volume edition.
- `docs/` contains concise maintained canon and integration guidance.
- `data/` contains stable IDs, category registries, a unified contributor revamp matrix, and [`ai-lore-context.jsonl`](data/ai-lore-context.jsonl) for AI ingestion.
- `research/` preserves long reports, raw prompts, source artifacts, and superseded drafts without making them automatically canonical.
- Every real-world claim uses the A-F evidence model. Fiction never retroactively proves folklore.

## Validate locally

```bash
python -m pip install -r requirements.txt
python scripts/validate_lore.py
mkdocs serve
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md), and [`integration/game-repo/RETROFIT-HANDOFF.md`](integration/game-repo/RETROFIT-HANDOFF.md).


## 0.5.0 chronology entrypoints

- [Master Chronology](docs/canon/master-chronology.md) - dates, source layers, and the full 2030-2099 causal bridge.
- [Causal History](docs/canon/causal-history.md) - why each major event and faction response occurs.
- [Unresolved Mysteries](docs/canon/unresolved-mysteries.md) - questions intentionally kept open.
- [History-to-Game Content Map](docs/game/history-to-content-map.md) - how chronology should drive commanders, towers, troops, planets, and dialogue.
- [Chronology Gap Audit](docs/research/chronology-gap-audit-2026-08.md) - new source genealogies and evidence boundaries.