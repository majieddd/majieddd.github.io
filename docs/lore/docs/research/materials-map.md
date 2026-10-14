---
id: research-materials-map
title: Research Materials Map
type: research
status: research
evidence: A-F
last_reviewed: 2026-08-25
---

# Research Materials Map

This page inventories the preserved research behind the maintained lore. Presence in the repository does **not** make a source or draft binding canon.

## Reading order

1. Start with the [Evidence Standard](evidence-standard.md).
2. Use the [Source Ledger](source-ledger.md) for maintained provenance summaries.
3. Read the [2026 UAP Archive Expansion](uap-archive-expansion-2026.md) for the latest NARA, AARO, and Black Vault delta.
4. Read the [Alien and Space Mythos Atlas](alien-space-mythos-atlas-2026.md) and [mythos delta](mythos-delta-2026-08.md) for the current source-genealogy expansion.
5. Use the [Inside Job Reference Map](inside-job-reference-map.md) as a fictional design index, never as evidence.
6. Use the [Mythos Integration Framework](../game/mythos-integration-framework.md) and [Mythos Operations](../game/mythos-operations.md) for game-facing adaptation.
7. Read the [raw deep-research report](../../research/raw/deep-research-report-2026-08-25.md) when you need the complete dossier and scenario inventory.
8. Use the archived phases below to recover source trails, superseded terminology, craft concepts, and discarded options.
9. Promote material only through a focused update to `docs/`, the relevant `data/` mirror, and the changelog.

## Current research prompt

- [The 2099 Severance War deep-research prompt](../../research/prompts/deep-research-prompt-2099-severance-war.md) — the latest prompt, including the edited Human adaptation brief, exact Federation doctrine, broad Pirate moral spectrum, and five-faction constraints.

## Raw report

- [Deep-Research Intelligence Dossier and 2099 Campaign Bible](../../research/raw/deep-research-report-2026-08-25.md) — preserved session report with its original organization and session-native citation markers.

## Phase 1 — Xeno, religion, ocean, and craft research

- [Xeno taxonomy](../../research/archive/phase-1/xeno_taxonomy.md), with [CSV](../../research/archive/phase-1/xeno_taxonomy.csv) and [JSON](../../research/archive/phase-1/xeno_taxonomy.json) mirrors.
- [Religion-control source map](../../research/archive/phase-1/religion_control_source_map.md).
- [Orphaned ocean technology](../../research/archive/phase-1/orphaned_ocean_technology.md).
- [UAP-inspired craft design bible](../../research/archive/phase-1/craft_design_bible.md).
- [Early 2099 integration draft](../../research/archive/phase-1/lore_integration_2099.md).
- [Source bibliography](../../research/archive/phase-1/source_bibliography.md).
- [Official UAP archive manifest](../../research/archive/phase-1/official_uap_archive_manifest.csv) and [official source notes](official-uap-source-notes.md).
- NARA archive download helpers: [Bash](../../research/archive/phase-1/download_nara_uap_archives.sh) and [PowerShell](../../research/archive/phase-1/download_nara_uap_archives.ps1).
- Original package metadata: [README](../../research/archive/phase-1/package-readme.md), [file index](../../research/archive/phase-1/package-file-index.md), and [use note](../../research/archive/phase-1/license-and-use-note.txt).

## Phase 2 — Five-faction synthesis and game design

- [Research dossier](../../research/archive/phase-2/research_dossier.md).
- [Five-faction campaign bible](../../research/archive/phase-2/five_faction_campaign_bible.md).
- [Rabbit-hole atlas](../../research/archive/phase-2/rabbit_hole_atlas.md).
- [Black Vault research route](../../research/archive/phase-2/black_vault_research_route.md).
- [Video species extraction](../../research/archive/phase-2/video_species_extraction.md).
- [Game-system blueprint](../../research/archive/phase-2/game_system_blueprint.md).
- [Source-evidence matrix](../../research/archive/phase-2/source_evidence_matrix.csv), with the original [XLSX workbook](../../research/archive/phase-2/source_evidence_matrix.xlsx).
- [Prompt snapshot](../../research/archive/phase-2/deep_research_prompt.md), kept synchronized with the current research prompt for this release.
- Original package metadata: [README](../../research/archive/phase-2/package-readme.md) and [source manifest](../../research/archive/phase-2/source_manifest.json).

## Machine-readable research data

The normalized research datasets live under `data/research/`:

- `official-uap-archive-manifest.csv`
- `source-evidence-matrix.csv` and `source-evidence-matrix.xlsx`
- `xeno-taxonomy.csv` and `xeno-taxonomy.json`
- `research-artifacts.json`
- `uap-archive-expansion-2026.json`
- `alien-space-mythos-atlas-2026.json`
- `inside-job-reference-map.json`
- `mythos-source-register.csv`
- `../mythos-operations.json`

## Promotion rule

Archived wording can be quoted, challenged, split, or discarded. It becomes canon only when a pull request:

- identifies the evidence class;
- states what is source-derived and what is fictional synthesis;
- updates the maintained lore page;
- updates any affected JSON mirror;
- passes `python scripts/validate_lore.py` and `mkdocs build --strict`.

## Current archive deltas

- `docs/research/uap-archive-expansion-2026.md` - maintained Black Vault/NARA/AARO expansion.
- `docs/research/archive-delta-2026-08.md` - concise archive-fidelity changes and game uses.
- `data/research/uap-archive-expansion-2026.json` - machine-readable sources and accepted adaptations.
- `data/research/uap-archive-delta-2026-08.csv` - compact delta ledger.
- `docs/research/mythos-delta-2026-08.md` - concise mythos release summary.
- `docs/research/alien-space-mythos-atlas-2026.md` - 37 source-genealogy dossiers.
- `docs/research/inside-job-reference-map.md` - 18-episode fictional design reference.
- `docs/game/mythos-operations.md` - 74 fiction-ready operations.

## 0.4.0 connection research

- `docs/research/myth-mutation-graph.md` and `data/research/mythos-connections.json`
- `docs/research/global-ufo-case-atlas.md` and `data/research/global-ufo-case-atlas.json`
- `docs/research/inside-job-corpus-map.md` and `data/research/inside-job-corpus.json`
- Dedicated temporal, depopulation, shadow-government, abduction-memory, and Moon/Mars/secret-space dossiers
- `docs/game/mythos-operation-expansion.md` for operations MO-75 through MO-100
