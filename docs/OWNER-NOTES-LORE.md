# Owner notes: the lore integration

Tracked per the standing rule that every multi-item request gets a file.
Status moves to done only with the measurement that proves it.

Legend: `[ ]` not started, `[~]` in flight, `[x]` done and measured.

Canon: `docs/lore/`, vendored at release **0.5.0**. Generated module:
`js/lore.js`. Authored narrative: `js/story.js`.

---

## The rule this whole effort runs under

The retrofit handoff (`docs/lore/integration/game-repo/RETROFIT-HANDOFF.md`)
is explicit, and it happens to match this project's own invariants exactly:

- Lore is **presentation only**. It never enters the simulation, the lockstep
  fingerprint, save keys, balance, or `NET_PROTOCOL`.
- Lore generation **never consumes a random draw**, so the galaxy PRNG stream
  cannot move.
- **Stable IDs are never renamed.** They are the join between canon and engine.
- The generated module is **never hand-edited**.

Every item below was built to those rules and gated against them.

---

## A. Foundation

### A1. Vendor the canon into the repo
`[x]` The owner asked for the lore to live in the repo permanently, for
future context.
**MEASURED:** `docs/lore/`, **174 files**, release 0.5.0. Excluded on purpose:
`.github` (a workflows directory inside the game repo is a live hazard),
`mkdocs.yml`, `requirements.txt`, `scripts/`, `__pycache__`.
**One trap:** `.gitignore` carried a bare `lore/` rule, which matches at any
depth and silently swallowed the whole tree. The first commit reported 7 files
changed where 181 were expected. The rule is now anchored to the repo root and
`docs/lore/` is explicitly un-ignored.

### A2. Wire the generated module
`[x]` `js/lore.js` loads before `dialogue`, `commanders` and `ui`.
**MEASURED:** `LORE.version` reads `0.5.0` live in the built bundle.
**One trap, caught by `tools/gate.js` on its first real run:** `js/factions.js`
already declared `const LORE` for the Field Manual codex. The bundle is ONE
script, so two top-level consts of the same name is a SyntaxError that kills
every global. owner-sweep went 61/0 to **2/45**, forty of them "Game is not
defined". The game's array is renamed `LORE_CODEX`; the generated file was not
touched.

### A3. The ID join actually holds
`[x]` Nothing downstream works if canon and engine disagree on identifiers.
**MEASURED:** commanders **26/26**, towers **60/60**, faction units **25/25**,
abilities **12/12**, boons **20/20** matched by stable ID. Tower display names
**60 identical, 0 drifted**; unit names **25 identical, 0 drifted**. The lore
renames nothing. It adds depth. The 29 game-only unit ids are the Vigil
chassis, which the canon carries under its own `vigil` key.

---

## B. Propagation

### B1. Commander dossiers
`[x]` 26 commanders gain title, role, history, motive and fracture.
**MEASURED:** DOSSIER block renders under the blurb and trait, with role in
italics then HISTORY / MOTIVE / FRACTURE as a fixed-column table. Verified live
on CADRE. Placed BELOW the mechanics per the house rule: a player opening a
commander is deciding whether to field them.

### B2. Tower and unit provenance
`[x]` One provenance line per tower, unit and Vigil chassis.
**MEASURED:** `bolt` reads "Solar militia standard, designed after the first
off-world logistics split"; `crawler` reads "The baseline Vigil body, issued
wherever a jurisdiction still recognizes a boundary" (through the units to
vigil fallback). Rendered under the stat block, muted, no accent, so it never
competes with a number the player is deciding on.

### B3. Faction campaign premise
`[x]` The faction card said what a banner DOES; it now says what its campaign
is FOR.
**MEASURED:** all five banners carry campaign name and public mission, ordered
mechanic then campaign then first commander. The **hidden crisis is
deliberately NOT shown here**: discovering it is the campaign, and printing it
on the recruitment poster would spend the whole arc in one line.

---

## C. The campaign narrative

### C1. Five arcs, thirty beats
`[x]` The owner's core ask: "there's a reason why they're taking it over, and
playing the campaign will slowly unravel that reason".
**MEASURED:** `js/story.js`, 6 beats per banner on one escalating curve
(CLAIM, ARCHIVE, SEATS, REVOLT, MIRROR, MAELSTROM). All 30 speakers resolve to
real commanders. Beats are a **pure function** of banner and index, verified
stable across repeated calls and clamped at both ends.

### C2. The trigger, without new save state
`[x]` Fires on the reward screen when a SYSTEM falls, indexed by
`campaign().systemsTaken.length`, which the save already carried for the system
bounty.
**MEASURED:** no new save key, no migration, no draw from the galaxy PRNG,
nothing readable by the simulation. Renders act name, counter, speaker
portrait, their line in voice, attribution, and the reveal boxed below.

---

## D. Still open

### D1. Field Manual codex, rewritten from canon
`[ ]` `LORE_CODEX` in `js/factions.js` is the OLD six-entry codex and now sits
beside a canon that contradicts parts of it. It should be regenerated from
`docs/lore/docs/canon/` rather than maintained by hand. The rename in A2 was
done anticipating exactly this.

### D2. Commander portraits from the visual briefs
`[ ]` `LORE.visualBriefs` carries per-commander art direction and the canon's
morphology/politics separation rule (species does not determine faction). This
is a GPU job, not a wiring job: the ten 2x2 heavy towers already have no art
plates (see `BACKLOG.md`), so the art queue should be planned as one batch.

### D3. World and battlefield dossiers
`[ ]` `LORE.maps` covers 22 of the game's 28 boards; `LORE.worldGeneration`
carries deterministic rules for generating world prose from system index,
owner, kind and scenario. The six unmatched boards are the procedural families
from `js/mapgen.js`, which postdate the lore release.

### D4. Dialogue driven by relationships
`[ ]` `LORE.relationships` holds 19 seeds and `js/dialogue.js` already has a
rivalry-pair system. Wiring the canon's seeds into it would make pre-battle
exchanges reflect the actual political history rather than authored pairs.

### D5. Archive War missions as scenarios
`[ ]` 37 authored missions with premise, objective, commander, battlefield and
world kind, intended as scenario seeds. They are the natural content for
making individual worlds feel authored rather than generated.

---

## Gates, every commit in this effort

`tools/gate.js <url>` runs all of it in about 25 seconds:

- owner-sweep **61 pass / 0 fail / 2 info**
- MPT **37 pass / 0 fail / 2 info**
- em dash clean, bytes clean, module list complete, build ok
- zero console errors

One standing exemption was added: `docs/lore` joins `skills/huashu-design` on
the em dash VENDORED list. It is upstream text carried verbatim so later lore
releases can be diffed against it. **The exemption stops at the docs**:
`js/lore.js` is generated from that tree, is player-visible, is still gated,
and was clean on arrival. Verified narrow by planting a dash in `js/` and
confirming it is still caught.
