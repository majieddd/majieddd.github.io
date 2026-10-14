> [!IMPORTANT]
> **Embedded workspace.** This lore project now lives inside the game repository at
> `majieddd/majieddd.github.io/lore/`. Run lore commands from this directory. The
> standalone-repository references retained below document the original packaging
> and remain useful if the lore is later split back into its own repository.

# Contributing to Cosmic Conquest Lore

This repository is maintained like source code because continuity failures are merge conflicts with the universe.

## Setup

```bash
git clone https://github.com/majieddd/cosmic-conquest-lore.git
cd cosmic-conquest-lore
python -m venv .venv
# Activate the environment for your operating system.
python -m pip install -r requirements.txt
python scripts/validate_lore.py
mkdocs serve
```

## Branches and pull requests

- Create one branch per change: `lore/humans-gene-clades`, `research/ashtar-provenance`, or `game/vigil-copy`.
- Announce the document area in the issue or draft PR title.
- Keep one conceptual change per PR.
- Rebase on `main`; do not merge `main` into a working branch.
- Do not rewrap or reformat unrelated pages.

## Where a change belongs

| Change | Location |
|---|---|
| Binding universe truth | `docs/canon/` |
| Faction doctrine or identity | `docs/factions/` |
| Technology, religion, species, or setting system | `docs/world/` |
| Player-facing or code-facing mapping | `docs/game/` and `data/game-faction-map.json` |
| Historical, scientific, contactee, or conspiracy research | `docs/research/` |
| Current research prompt | `research/prompts/` |
| Unedited report or source snapshot | `research/raw/` |
| Superseded draft or original research artifact | `research/archive/` |

## Canon proposal checklist

- Does it reinforce one of the five conquest models?
- Does it duplicate an existing organization or term?
- Does it preserve species/polity separation?
- Does it give at least one faction a meaningful choice rather than a fixed moral label?
- Does it create a playable conflict, not merely an encyclopedia fact?
- Does it contradict a current game mechanic?
- Has the corresponding data mirror been updated?

## Research proposal checklist

- Provide the earliest accessible source you found.
- Identify the source type and evidence class.
- Separate the source's wording from later retellings.
- Explain what the source does not prove.
- Flag hoaxes, confessions, circular citations, or missing provenance.
- Mark the 2099 adaptation as fictional synthesis.

## AI-assisted contributions

AI-generated changes are welcome when a human reviews them. State the model/tool in the PR, identify which source files it read, and do not claim that unexecuted agents, searches, or validations occurred.

## Validation

```bash
python scripts/validate_lore.py
mkdocs build --strict
```

A PR is not ready if either command fails.
