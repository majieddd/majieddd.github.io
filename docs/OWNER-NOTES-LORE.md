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

## The rename question, settled with numbers

The owner asked for names to fit the lore, and also said not to rewrite what
does not need it. Those are only compatible if we know which display names
actually disagree, so every name-bearing registry was diffed against the canon.

| Registry | Identical | Drifted |
|---|---|---|
| towers | **60** | 0 |
| faction units | **25** | 0 |
| Vigil chassis | **29** | 0 |
| commanders, names AND titles | **26** | 0 |
| abilities | **12** | 0 |
| boons | **20** | 0 |
| arena modifiers | **8** | 0 |
| maps | 19 | **2** |
| scenarios | 2 | **2** |

**Four names differ out of more than two hundred, and nothing is being
renamed.** Three of the four are a definite article: the game says
`THE CONFLUENCE`, `THE CAROUSEL`, `THE SWARM` where the canon's catalogue says
`CONFLUENCE`, `CAROUSEL`, `SWARM`. The fourth is `THE LONG VIGIL` against the
canon's `VIGIL / ENDLESS`, which is a data label with a slash in it and not
display prose at all. In every case the game's string is the better player
facing name, and adopting the canon's would make the interface worse. The
canon is the authority on what things ARE, not on how a label reads.

The real gap the audit found is not naming, it is COVERAGE: seven maps have no
canon entry at all (`spiral`, `twin-channel`, `chokepoint`, `island-scatter`,
`open-field`, `convergence`, `fortress-ring`), because the procedural map
families postdate lore release 0.5.0. That is authored in D3 rather than
renamed.

## D. Closed

### D1. Field Manual codex, rewritten from canon
`[x]` **MEASURED:** ten entries, up from six, every one `{id, title, body}` so
the renderer contract is untouched, 68 to 85 words each. Renders 10 of 10 with
none empty and zero console errors. Teaches the Sol Gate premise, the Source
Lattice, the pentad, the five conquest verbs one per banner, Echo Reversal,
stars as claim stability, SOULS, garrisons and conquest. The Vigil entry does
the job the old codex could not: it states outright that the Vigil is not a
sixth power, that it reads extinct law and "does not read flags", and lands
the mechanical consequence ("It comes down the same corridor at both
commanders, in the same numbers. Nothing out there is fighting for you.").

### D2. Commander portraits from the visual briefs
`[x]` **Closed as NOT NEEDED, plus one real finding the audit corrected.**

Art coverage, measured against `js/artpack.js` rather than assumed:

| Class | Plates | State |
|---|---|---|
| commanders | **26 / 26** | complete |
| factions | **5 / 5** | complete |
| units | **54 / 54** | complete |
| towers | **11 / 60** | inconsistent |

Commander portraits are complete AND owner-approved: the owner's ruling in an
earlier session was "the commanders we have looked fine, it was the Troops
that looked off", and the troops were restyled then. Re-rendering 26 approved
portraits against the visual briefs would be rewriting something that does not
need it, which is the opposite of the instruction. `LORE.visualBriefs` stays
available for any FUTURE commander added to the roster, which is the case it
actually earns its keep in.

**The correction:** an earlier note in `BACKLOG.md` said "the ten heavies have
no `twr_` art plates". The real number is **49 of 60 towers have no plate**,
and the ten heavies are simply a subset. Towers render procedurally on canvas
(owner-sweep 22.10, "every tower draws itself in the shop preview", passes),
and `artImg` returns empty for a missing key, so nothing is broken. What IS
wrong is that 11 towers carry a painted plate on the loadout detail card and
49 do not, which is precisely the partial class upgrade `BRAND.md` rule 3
forbids.

**Owner decision, not a task to run unasked.** Three options: render the
missing 49 so the class is uniform, drop the 11 so it is uniform the other
way, or accept the split deliberately and record it in `BRAND.md` as an
exception the way `cmd_cadre` already is. Cost matters to the choice: this
machine measures SDXL-Turbo at about 4.5s an image (49 renders is minutes)
and Krea 2 at about 138 minutes an image (49 renders is over a hundred
hours). The 11 existing plates were rendered on the slower pipeline, so
matching them is the expensive option and matching them cheaply would itself
be a partial upgrade.

### D3. World and battlefield dossiers
`[x]` **MEASURED:** `js/worldlore.js`. Every board gets a WAS/NOW pair, which
is the whole idea: these are repurposed jurisdiction installations, not
landforms. On a live 5-system galaxy, **35 of 35 worlds resolve a dossier**,
and the module's own `selfCheck()` reports 28 of 28 map ids resolved with no
missing entries, no incomplete ones, and no name drift.
**The coverage gap is closed, not worked around.** The canon shipped 22 of the
28 boards; the seven procedural families (`spiral`, `twin-channel`,
`chokepoint`, `island-scatter`, `open-field`, `convergence`, `fortress-ring`)
postdate lore 0.5.0 and had no entry, so canon was AUTHORED for them in the
canon's own voice and shape. `spiral` is now Vortex Reach, an "inward transit
winding" built so no inbound convoy reached the centre without passing the
same inspection ring three times.

### D4. Dialogue driven by relationships
`[x]` **MEASURED:** all **19 of 19** canonical relationship seeds resolve
through `canonRelationship`, and `canonExchange` returns a written exchange in
each speaker's own voice. Selection is deterministic (identical across repeated
calls) and draws no random number, which matters because `js/net.js` replaces
`Math.random` with the seeded lockstep PRNG during a match. **Purely
additive:** a pairing with no canonical seed returns `null` and falls through
to the existing opener and reply pools exactly as before.

### D5. Archive War missions as scenarios
`[x]` **MEASURED:** `js/missions.js`. All 37 load, assignment to generated
worlds is deterministic with **no repeats inside a galaxy** (30 of 35 worlds
carry one, zero duplicates), and `selfCheck()` passes 17 assertions including
`assign.deterministic`, `assign.noRepeats`, `copy.noEmDash` and
`caution.always`.
**The editorial guardrail is enforced in the interface, not just documented.**
The canon forbids presenting historical UAP, contactee or religious material
as verified alien history, and names an explicit rule that no real population
may be rewritten as a secret nonhuman bloodline. Every surfaced mission
therefore renders its evidence grade and caution line as a NON-OPTIONAL part
of the block, and premises are reframed to separate record from
interpretation: AW-01 now reads "The file is a genuine record of a report. The
coordinate reading laid over it is invented for this war, not a finding about
the file." A mission is a contested record, never a verdict. Verified: zero of
the 30 rendered missions was missing its caution line.

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

---

## E. Canon 2029, the owner's revision (2026-08-26)

The owner moved the timeline from 2099 to the Apophis window: Disclosure on
September 11, 2028, the Concord over the holidays, the intercept on April 13,
2029 (the real close-approach date, a Friday), and the fleet departing the
same day. Authoritative text: `docs/CANON-2029.md`. The vendored lore tree
stays untouched for upstream diffing; that file is the regeneration source.

Everything below is measured on the live build, gates green throughout
(owner-sweep 61/0/2, MPT 37/0/2, zero console errors).

| Change | Proof |
|---|---|
| All 30 story beats rewritten to the 2029 arcs, correct faction casting | 30/30 render, zero problems. An earlier draft cast ORIN and VESS as machine and Compact voices; both are human, and only a faction-aware validator caught it |
| ASHTAR closes the Federation campaign | Final light beat spoken by ASHTAR with a procedural portrait (`Story.figure`, no roster entry, no sim table touched), and the faction card carries "ASHTAR, Supreme Commander and First Speaker" |
| Human commanders renamed to familiar 2029 names | DIR. VANCE, GEN. KARIM, DR. NYSTROM, CHF. O'RYAN, MAR. VASQUEZ. Display names only; every id, art key and save reference unchanged |
| Galaxy renamed to real astronomy | Campaigns open in the banner's home system: THE EARTH SYSTEM (seat LUNA), THE PLEIADES (seat ALCYONE), ZETA RETICULI (seat SERPO), BARNARD'S STAR (seat HARBOUR NINE), TABBY'S STAR (seat THE VEIL). Later systems draw Proxima, Tau Ceti, TRAPPIST-1, Sirius and kin, and SOL appears in non-human campaigns with EARTH as its seat |
| The naming change is stream-safe | Structural fingerprint (everything except names) across 60 generations, 5 factions x 12 seeds: byte-identical before and after, combined hash ada4241e854943f0d81ffd1e both sides. Names were index-derived and draw nothing |
| Field Manual codex rebased | 12 entries opening on September 11, 2028; the Vigil as the Ancients' corrupted automatons (recovered directives carry no offensive verb) and the Ancients as formless ("a mind with no mouth issues no commands") |
| Renegade dialogue | Fighting your own banner now opens a family argument, one authored pair per faction, keyed purely on same-faction, no draw. Control verified: cross-faction pairings unchanged |
| Dossier bloat removed | Commander card shows one role line (HISTORY/MOTIVE/FRACTURE rows deleted, story carries the depth); world briefing shows ONE story line about who holds the ground, replacing the WAS/NOW registry prose the owner flagged as not making sense |

Deliberately NOT done, and why:

- **A playable Ashtar commander.** That is a kit, a tech tree, balance, art
  and an append-safe roster change: a content addition, not a lore pass, and
  the retrofit rule forbids smuggling one inside the other. Flagged as its
  own decision.
- **Different starting POSITIONS per faction.** Each faction now starts in a
  different named home system, which is the presentation-safe version. Making
  progression itself differ per faction moves difficulty pacing and would
  re-baseline the balance pins; that is a sim change for its own change with
  its own measurements.
- **The vendored `docs/lore/` tree was not edited.** It is the upstream
  snapshot; `CANON-2029.md` is the delta to regenerate it from.
