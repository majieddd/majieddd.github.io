# Instructions for AI and Automated Contributors

Read these files before changing lore:

1. `docs/canon/overview.md`
2. `docs/canon/continuity-rules.md`
3. `docs/game/game-lore-contract.md`
4. `docs/research/evidence-standard.md`

## Non-negotiable invariants

- There are exactly five top-level factions: Humans, Federation of Light, Xenos, Pirates, Machines.
- `Xeno` is a political/economic alignment, not a biological species.
- Ashtar is the Federation's Supreme Commander and First Speaker in fictional canon.
- Historical Ashtar traditions remain fragmented in the research layer.
- Religion is modeled through layered mediation and capture; it is never reduced to “all faith was invented by aliens.”
- Machines are maintenance and continuity ecologies, not generic killer robots.
- The Old Weather explains some in-fiction undersea anomalies, not every historical UAP or USO report.
- The playable Machine identity `robot` / **The Parallel** is a splinter of the wider Continuance.
- The neutral PvE **Vigil** is legacy Old Weather enforcement, not the same polity as the playable Parallel.
- Noetic systems manipulate patterned information and coherence. They do not create unlimited thermodynamic energy.
- “Unresolved” never means “extraterrestrial.”
- Ancient religious language is not rewritten as literal astronaut testimony in the research layer.
- The game starts its five-way conflict in 2099.

## Edit policy

- Put concise binding material in `docs/canon/`, `docs/factions/`, or `docs/world/`.
- Put uncertain alternatives, long source histories, and rabbit holes in `docs/research/`.
- Preserve original research reports in `research/raw/`; do not silently rewrite them.
- Update JSON mirrors whenever a binding faction, timeline, or glossary fact changes.
- Avoid creating a new named organization unless it performs a role not already covered.
- Prefer one strong term over three synonyms.
- Do not mass-reformat unrelated files.

## Required checks

```bash
python scripts/validate_lore.py
mkdocs build --strict
```

When proposing a factual claim, include:

1. What the source says.
2. What the source's existence establishes.
3. What it does not establish.
4. Evidence label A-F.
5. Fictional use, if any.
