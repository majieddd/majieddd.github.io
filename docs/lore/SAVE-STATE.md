# Lore Save State - Prepared Embedded Import 0.5.0

This file is the handoff point for any human or AI contributor resuming the
**Cosmic Conquest** lore retrofit inside the live game repository.

## Repository placement

- Game repository: `majieddd/majieddd.github.io`
- Intended workspace path: `/lore`
- Intended root navigation page: `/LORE.md`
- Lore release prepared: `0.5.0`
- Archive War missions through `AW-37`
- Mythos Operations through `MO-130`
- Global case atlas: 28 cases
- Myth Mutation Graph: 57 edges
- Inside Job design corpus: 18 episodes and 10 institutional principles
- Mythos systems: `M-01` through `M-84`
- Mythos Operations: `MO-01` through `MO-130`
- Provisional cross-faction institutions and technologies: `27`
- Mythos source register expanded through the 0.5.0 chronology research pass
- Current source genealogy count: `84`; source-register records: `80`
- Game content snapshot used for the retrofit: `046fc38634fadf13148ef9ad3aa208417f28f2de`
- Latest game head checked for non-invasive placement: `ee86a08e13c23074f8be0aff435e6c35429c2838`
- GitHub status at package creation: prepared and validated locally. The GitHub
  integration continued returning `403 Resource not accessible by integration`
  for branch creation and Contents API writes. Do not claim this release is
  published until a remote commit can be verified.

No live simulation, balancing, save-format, network, UI, or generated-art file
was changed by the lore workspace. The generated integration payload remains
staged at `integration/game-repo/js/lore.generated.js`; it is documentation and
data until a separate implementation change explicitly loads it.

## What is preserved

The workspace preserves every path recorded in all earlier release manifests. No baseline path is missing. The 0.5.0 manifest is the current preservation authority, plus the root `LORE.md` gateway outside `/lore`. Nested `.git/` metadata remains the only excluded implementation material.

Included material covers:

- maintained canon and the complete compiled lore bible;
- all five faction doctrines and campaign motives;
- 26 commanders, relationships, dialogue guidance, and visual briefs;
- 60 towers, 25 faction troops, 29 Vigil chassis, abilities, boons, scenarios,
  battlefield classes, and deterministic world-generation mappings;
- Black Vault, NARA, AARO, FBI, State Department, aviation, media-provenance,
  laboratory, FOIA, and astronomy research controls;
- 84 alien, space, conspiracy, contactee, religious, occult, temporal, environmental, crash-retrieval, secret-space, astronomy, archaeology, and anomaly source genealogies;
- 27 provisional institutions and technologies connecting those traditions to the five factions without making every rumor literally true;
- 130 optional Mythos Operations for future campaign, planet, dialogue, and Archive War development;
- an 80-record mythos source register, 28-case global atlas, 57-edge mutation graph, and 18-episode Inside Job design map;
- raw reports, earlier research phases, superseded drafts, CSV, JSON, JSONL,
  XLSX datasets, infographics, validation tools, schemas, and contributor
  templates.

The exact path, size, and SHA-256 state is recorded in:

- `data/import-manifest-v0.3.0.json`
- `data/import-manifest-v0.3.1.json`
- `data/import-manifest-v0.3.2.json`
- `data/import-manifest-v0.3.3.json`
- `data/import-manifest-v0.4.0.json`
- `data/import-manifest-v0.5.0.json`

## Canon invariants

1. Exactly five top-level factions: Humans, Federation of Light, Xenos,
   Pirates, and Machines.
2. Ashtar is Supreme Commander and First Speaker in fictional canon; historical
   Ashtar traditions remain fragmented source history.
3. `Xeno` is a political and economic category, never a biological species.
4. The Old Weather, neutral Vigil, and playable Parallel are related but
   distinct Machine concepts.
5. Religion uses the Revelation Stack and is never reduced to one alien hoax.
6. “Unresolved” never means “extraterrestrial.” Real records, historical
   traditions, fringe claims, contaminated legends, and fictional synthesis
   retain A-F evidence labels.
7. The game-facing conflict begins in 2099 and preserves current stable game IDs.
8. Archive media, program maturity, narrative evidence, and negative laboratory
   results retain explicit provenance and cannot be promoted into stronger
   evidence classes by implication.
9. A modern mega-conspiracy is treated as a merger of separate source
   traditions, not evidence of one omnipotent ancient cabal.
10. No real ethnic, religious, national, medical, political, or social group is
    recast as a reptilian, hybrid, bloodline, or alien-controlled population.
11. Documented eugenics, MKULTRA, covert weather modification, surveillance,
    secrecy, and disinformation do not establish one unified depopulation or
    mind-control agenda.
12. Time manipulation remains separated into retrocognition, information
    backflow, branch selection, and rare physical chronology transit.
13. *Inside Job* is a fictional design corpus for bureaucracy, incentives,
    competing institutions, and maintenance costs, not an evidentiary source.
14. Major mysteries retain at least one conventional and one speculative
    interpretation until a campaign intentionally resolves them.

## Resume order

1. Read `README.md`, `RETROFIT-SUMMARY.md`, and
   `docs/research/mythos-connection-delta-2026-08.md`.
2. Read `docs/canon/overview.md`, `docs/canon/hidden-history.md`, `docs/canon/causal-history.md`, `docs/canon/master-chronology.md`, and `docs/game/campaign-premise.md`.
3. Read `docs/research/alien-space-mythos-atlas-2026.md` before adapting a
   conspiracy, alien race, religion, time-travel claim, or anomalous location.
4. Read `docs/research/inside-job-corpus-map.md` when using the show as a
   fictional institutional-design corpus.
5. Read `docs/game/mythos-integration-framework.md` and
   `docs/game/mythos-operations.md` before adding mythos-facing game content.
6. Read `docs/game/coverage-audit.md` and
   `integration/game-repo/COPY-REWRITE-CHECKLIST.md` before changing live copy.
7. Inspect `data/game-content-registry.json`,
   `data/content-revamp-matrix.json`, `data/mythos-operations.json`, and
   `data/research/alien-space-mythos-atlas-2026.json` before renaming or adding
   assets.
8. Use `AI-CANON-CONTEXT.md` and `data/ai-lore-context.jsonl` for AI-assisted
   work.
9. Run validation from this directory:

```bash
python -m pip install -r requirements.txt
python scripts/validate_lore.py
mkdocs build --strict
node --check integration/game-repo/js/lore.generated.js
```

## Current implementation boundary

The lore is complete enough to drive separate implementation passes for faction
screens, campaign introduction, commander dossiers, state-aware pre-battle
dialogue, troop and tower descriptions, planet dossiers, art briefs, Archive
War missions, and Mythos Operations. Those changes should be small, reviewable,
and mechanically isolated. Lore integration must not silently alter balance,
multiplayer determinism, campaign random-number streams, save keys, or stable
content IDs.

## 0.4.0 additions

- Source genealogies now extend through M-60.
- Operations now extend through MO-100.
- New required resume modules: `docs/research/myth-mutation-graph.md`, `docs/research/global-ufo-case-atlas.md`, `docs/research/inside-job-corpus-map.md`, and `docs/game/shadow-bureaucracy-design-principles.md`.
- The remote GitHub repository must not be described as updated until a commit is verified.


## 0.5.0 additions

- `docs/canon/master-chronology.md` is now the definitive date authority from deep fictional history through the 2099 campaign.
- `docs/canon/causal-history.md` is the definitive “why this happened” authority.
- `docs/canon/unresolved-mysteries.md` protects intentional ambiguity from accidental retcons.
- High-grade noetic Yield canonically requires meaningful autonomy, explaining indirect Xeno control.
- Artifact Consensus is 2068; Gate opening 2086; informal living contact 2089; public authenticated Federation contact 2091; Five-Way War 2099.
- Planet Nine remains natural and separate from the artificial Sol Anchor.
- Myth systems extend through M-84 and operations through MO-130.
- New source families include Gobekli/Younger Dryas controversy, technology-shaped sky reports, Watchers/Utsuro-bune, Vimana and Ezekiel reinterpretations, Planet X lineage separation, Horizon/A119/West Ford/Starfish, Northwoods, Arecibo/METI, Fermi-paradox models, disclosure feedback, and sensor-threshold cascades.

- Final chronology audit adds M-78 through M-84 and MO-121 through MO-130: Brookings discovery-impact mutation, Hollow/Spaceship Moon source separation, transient lunar phenomena, Chronovisor, Project Looking Glass and its real-name collision, Carter witness history, and Reagan alien-threat rhetoric.
