# Owner directive, Session 38: content law, one galaxy, living art

Dictated 2026-08-27. This file is the tracker the owner asked for ("make sure
you write all this down to make sure you're keeping track of it and actually
accomplishing it in the end"). Every item below either closes with evidence in
this session or carries an honest open box. Nothing on this list is allowed to
vanish into a summary.

**The standing approval, quoted so nobody re-litigates it:** "I really like the
art direction in terms of the illustrative style... it looks beautiful and
works really nicely with the universe we've made." The STYLE is locked. Every
change below is about the CONTENT being drawn, never the rendering language.

---

## A. Solidify the brand pack for collaborators

- [x] A single art bible a new collaborator can read and then produce on-style
  work: style spine, palettes, class treatments, prompt recipes, pipeline
  runbook, verification gates. On GitHub (this repo) and saved locally.
- [x] BRAND.md and LOOKBOOK.md point at it rather than duplicating it.
- [x] The aegis plugin references point at it (durable law lives in the plugin,
  project specifics live here).

## B. The content law (what is DRAWN, not how)

The owner's direction, verbatim where it matters:

- **Humans: "almost like that modern look not too futuristic."** Real,
  contemporary-grounded spacecraft ("spaceships that humans today use"),
  crewed-program and commercial-launch vocabulary. Armor pulled back from
  medieval toward practical sci-fi. **The reference universe is DUNE**:
  "grounded in a way that I feel comfortable adapting this style", ships,
  armor, technology treated with that restraint.
- **Pirates: keep the space-galleon idea the owner likes, but show VARIETY**
  of ship kinds, and crews that are visibly multi-species: "don't just show
  humans show different types of alien both humanoid and non-humanoid."
- **Xeno: scarier.** Aligned with the lore's predatory register.
- **Federation of Light: the benevolent contact species from the research**
  Pleiadians, Arcturians, Nordics, and the rest of the bible's cooperative
  archetypes (the species machinery already exists in
  docs/lore/COSMIC-CONQUEST-LORE-BIBLE.md, Species and Ontologies).
- **The illustrative style itself does not move.** Tyranny construction,
  cyberpunk comic inking, faction palette dominance: all locked.

Deliverables:

- [x] The content law written into the art bible with per-faction species and
  hardware vocabularies.
- [x] A rendered DIRECTION BOARD (committed, small) showing the law in
  pictures: modern human spacecraft, pirate ship variety, Dune-grounded armor,
  Federation species, scarier xeno, so "what to draw" is shown, not told.
- [x] Applies to all FUTURE renders. The 50 shipped cutscene plates are
  approved and stay; they re-roll only if the owner names one.

## C. Commander portraits reworked to the content law

- [x] All 28 portrait subject prompts revised: species assignments for the
  Federation roster, multi-species pirates, scarier xeno, grounded human
  armor. Style tokens untouched; subject and material clauses only.
- [x] Re-rendered WHOLESALE on the Krea tier (the class law forbids partial
  regeneration), verified in a browser, shipped.
- [x] Roster blurbs touched ONLY where a species change contradicts the text.
  Ids never move; names stay.

## D. One galaxy, five vantage points

Observed defect, owner's words: different factions "are showing completely
different solar systems in the Galaxy." Direction:

- [x] One shared galaxy: the same systems and worlds for every faction.
- [x] Each faction STARTS in a different (its own) home system.
- [x] Planet states predetermined and identical across factions: "the same
  universe but from different sides."
- [x] Procedural mapgen stays, but a given planet is LOCKED to the board it
  generates, so the same world is the same battlefield for everyone.
- [x] Existing in-flight campaigns must not have their boards swapped under a
  mid-campaign save: the change is versioned, old saves keep the old draw.

## E. Cutscene progression at system conquest

- [x] Verify THE TURNING interstitials actually fire on closing a solar system
  (the wiring exists at ui.js "systemTaken" -> Cutscenes.play('sys', ...));
  prove it in a browser, fix anything that does not fire.

## F. Living portraiture, not rewind

Owner on the shipped ping-pong loops: "the rewind part... is not that great."
The replacement law:

- [x] Motion is SUBTLE: "as if the lines are alive and slightly moving...
  breathing or living... it shouldn't be very trippy." Glow, shimmer, drift of
  light, the ILLUSION of life, not objects travelling.
- [x] Perfect loops: "when it loops you can't even tell that it is looping."
  Crossfade the tail into the head; never reverse playback.
- [x] Replace all five hero clips; verify the seam numerically and by eye.

**Still open in this file, and only this:** whether to animate the other 45
plates. Five hero clips ship; the rest is an owner call on weight, written up
in docs/VIDEO-TIER3-S37.md.

## G. Three-panel cutscene for every planet

On deploying to a planet, a three-slide sequence:

1. **The setting**, the planet and its nature. Same for all factions.
2. **The scenario**, what you are walking into. May depend on faction.
3. **The commanders**, the two seats talking, with dialogue that can vary by
   the pair and their history.

- [x] Built on the existing surfaces (worldlore WAS/NOW, scenario defs, the
  relationship-driven dialogue engine) presented through the cutscene overlay.
- [x] Skippable, reduced-motion safe, and it must not double-show the
  existing briefing content.

## H. Dialogue attuned to the lore

- [x] Audit the dialogue surfaces against the lore bible; enumerate where
  interactions are missing or off-lore.
- [x] Fill the worst gaps this session; list the remainder here honestly.

---

## Evidence ledger (filled as items close)

| Item | State | Evidence |
|---|---|---|
| A | **DONE** | docs/ART-BIBLE.md shipped; BRAND.md and LOOKBOOK.md open with pointers to it; pushed to main (commit "The art bible, and the content law rendered as a direction board") |
| B | **DONE** | Content law is ART-BIBLE section 3; docs/brand-board/ carries eight rendered examples (artgen/board.py, seeded); the 50 shipped plates untouched |
| C | **DONE** | 28/28 portraits re-rendered wholesale on Krea (24s each), pack passthrough 281/0, gate clean. By-eye note: cmd_lumen and cmd_cinder hold style but read less insectoid; re-roll by key if wanted |
| D | **DONE** | galaxy v2: one universe from GX_UNIVERSE_SEED 20290413, five homes in fixed order, per-faction start rotation, authored 5x5 holder table, versioned so old saves keep v1 byte-identical. Sweep 38.1 asserts world-state identity across all five factions, own-home starts, 0 self-garrisons, 0 spoilers |
| E | **DONE** | Probed live: 25/25 sys cells exist, THE TURNING plays and closes with done() once; trigger wiring at ui.js systemTaken path |
| F | **DONE** | Five clips regenerated as living portraiture: 121 frames, tail crossfaded into head (no reversal), 4.04s seamless loops at 313 to 554KB. Measured mid-clip drift 4.25 to 16.64 against 31 to 44 on the rejected ping-pong tier; every seam within or near its clip's ordinary frame step and eye-verified as encode grain only. Pirate and robot were re-rolled once when the first pass moved the gas and the figures; the accepted pair breathe in brightness only |
| G | **DONE** | Deploy plays SETTING then SCENARIO through Cutscenes.playList, then the existing VS screen as the commanders beat (canonExchange pair history). Probed: VENUS slides sourced and keyed, handoff called once, 0 console errors |
| H | **AUDITED, gaps quantified** | Census (probe, this session): 19 lore relationship seeds cover 18 of 318 meetable cross-faction pairs; the other 300 fall back to authored per-commander openers which read on-register (sampled). Codex: 26 entries, ZERO species contradictions against the item-C changes. Worst-gap fix this session: the planet setting slide now carries the WAS/NOW site line. REMAINDER, honestly: growing pair coverage means authoring relationship seeds in docs/lore data and regenerating js/lore.js (it is generated, never hand-edited); that is an owner-scoped writing project, listed here rather than half-done |
