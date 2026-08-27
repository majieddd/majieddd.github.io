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

## I. Campaign dialogue must read as conversation, not as captions

Owner, verbatim: "make sure that all of the dialog in the campaign screens in
all of the planets feel like a real conversation or something that makes sense
for video game because I noticed that some of these feel a little flat and
aren't working quite as expected."

- [ ] Audit every campaign dialogue surface across every planet, and record
  which lines are flat and WHY (no addressee, no turn-taking, no stakes, both
  seats saying the same kind of thing).
- [ ] Rewrite so exchanges answer each other: the second seat responds to the
  first rather than delivering a parallel monologue.
- [ ] Mechanics-first descriptions stay mechanics-first; this item is about the
  spoken lines only. Related to G and H, and closes with them where they touch.

## J. Humanity needs its own summoning rite, and a weaker one

Owner, verbatim: "the humans were a little powerful when they were able to
create a new unit for each one that they killed... there should be a different
way that still is showing their adaptability but needs to have a different way
of units being summoned unique to itself."

Current state: `SUMMON_DOCTRINES.human` is `onKill: 'roll'` (js/factions.js),
which spawns a unit on EVERY kill. That is both too strong and conceptually
overlapping: xeno is also on-kill (delayed) and robot is also on-kill (exact).

OWNER DECISION (dictated, not my proposal): merge cost-relief with promotion,
and split the rite across DEFENCE and OFFENCE so both halves are reinforced.

- [ ] Channel one, DEFENCE: "anytime you kill a unit, the cost of sending a
  unit is lowered by a certain percentage." Kills bank a requisition credit
  which is SPENT on the next send, so it cannot compound into a permanent
  discount.
- [ ] Channel two, OFFENCE: "anytime your unit kills a unit they can grow
  stronger... the power is increased every time specifically a unit kills
  another unit." Veterancy is granted only when the KILLER is one of your own
  sent bodies, which the owner explicitly noted is not the common case.
- [ ] Free body per kill is REMOVED. Measured baseline being replaced: 1.00
  bodies per kill (probe 38.4).
- [ ] Must not reorder DOCTRINE_ORDER (LOCKSTEP_PREFIX pins it, js/net.js).
- [ ] Re-baseline balance pins in the same session and record them in
  docs/BALANCE-BASELINE.md.

## K. The xeno rite does not reliably hatch

Owner, verbatim: "make sure that the xeno are properly incubating on kill
monsters so that it spawns as I noticed in one play through it wasn't quite
working as expected."

- [ ] Reproduce the failure before changing anything.
- [ ] Note already measured: owner-sweep exercises `tickProcession` and never
  `tickIncubators`, so the xeno rite has no gate coverage at all while the
  light rite does.
MEASURED, and it contradicts the report: the rite is NOT broken. Clutches
form, gestate, hatch, and the hatchling enters 30.4% along a 2622-unit lane
(probe 38.1, 38.2, 38.7). All four banners resolve to their own doctrine
(38.6). What is wrong is that it delivers 0.40 bodies per kill against
Humanity's 1.00, the cap binds at 10 clutches after 10 kills, gestation is
10.3s, and the base roster holds one unit so every pod hatches the same shape.

OWNER DECISION: legibility only. No balance number moves.

- [ ] HUD shows live clutch count against the cap.
- [ ] HUD shows per-clutch gestation remaining.
- [ ] A kill that is capped must VISIBLY feed the nearest clutch instead of
  silently doing nothing.
- [ ] Probe 38.x added so the rite can never again ship with zero coverage.

## L. Field manual: current, illustrated, and deep on hover

Owner: the manual should be up to date, and anything referencing a commander,
unit or tower should SHOW that subject's image, with richer detail on hover, so
everything available to the player is legible at a glance.

- [ ] Audit the manual against the live tables and fix every stale claim.
- [ ] Every commander/unit/tower reference carries its art.
- [ ] Hover reveals advanced detail; keyboard and reduced-motion safe, and it
  routes through design-forge, not this skill.

## M. Debug mode toggle in the menu bar

Owner: an in-game debug toggle exposing cheats for faster testing. Named
examples: force a star rating, and instantly finish a match. Critical
constraint, verbatim: "when you enable star rating for example if there is a
cutscene afterwards which each planet might have... it will still proc and
queue the cutscene to work as a way of debugging."

- [ ] Menu-bar toggle, off by default, and it must never be reachable in a
  shipped-clean state by accident.
- [ ] Cheats route through the SAME code paths as real play so that
  progression, star award and cutscene queueing all still fire. A cheat that
  bypasses the path it is meant to test is worthless.
- [ ] Must not touch the lockstep wire or the seeded stream in a duel.

---

## N. Per-unit cooldowns replace the count cap, and pirates are exempt

Owner, verbatim: "another change I would fix for all factions is having cool
Downs per unit. instead of making it where you can't summon more than x amount
of this unit, it should just be a cool down per unit to make better balancing,
however, to make pirates a little more powerful, let's have it so that not
pinheld to a cool down and can summon units purely by their money cost."

Current state: `MUSTER_PER_WAVE = 2` (js/config.js:3871) gates every faction
equally through `S.musterThisWave` (js/game.js:2682).

- [ ] Replace the per-wave count gate with a per-detachment cooldown.
- [ ] LETTERS OF MARQUE is exempt outright: pirates are limited by gold alone.
- [ ] `musterThisWave` is in the lockstep fingerprint (js/net.js:1129), so
  whatever replaces it must be mixed in deterministically or duels desync.
- [ ] The muster panel must show the cooldown, not a stale "summons left".

---

## O. Close this session's own test debt

Not an owner item. Added because the batch's own checks were audited against
what they actually EXECUTE and found wanting, which is the standing law
("code no gate executes is code that ships untested") applied to this
session's work rather than to somebody else's.

- [x] Ten paths shipped with zero coverage behind a green gate: musterCdFor,
  musterReadyCount, ttEsc, Debug.lose, Debug.clearWave, Debug.heal,
  Debug.render, the collapse toggle, engineKey's new branch and both xeno
  feed tells. owner-sweep 38.17 to 38.21, each proven by planting the defect
  it catches.
- [x] HUMAN_VET_MAX capped nothing that any check would notice. 38.22.
- [x] tools/newcoverage.js: profiles owner-sweep and MPT under Chrome precise
  coverage and reports added lines with an execution count of zero. It found
  20 more cold lines after the above, including endMatch's ratingFor call,
  the path scoring every real victory. Closed by 38.23 to 38.26.
- [x] Added lines reached by the gate: 100% (351 of 351), verified by planting
  an unreachable branch and confirming the tool reports exactly it.

---

## P. The battle screen on a phone

Owner, with a screenshot: "make a UI ux experience that is really good on
mobile and works properly because as of right now it doesn't really function
that well on mobile ... it looks way too cluttered on mobile and hard to
decipher what's even going on."

docs/MOBILE-AUDIT-S37.md fixed the SETUP screens and deferred this one in its
own scope note: "The in-game HUD at phone width ... none of it was measured
here. Do not assume this pass helped it."

MEASURED FIRST (tools/mobile-hud-audit.js), on the build the owner photographed:

| | 360x800 | 412x915 |
|---|---|---|
| chrome | 570px of 800 (71%) | 549px of 915 (60%) |
| board uncovered | 45% | 40% |
| hud over battle-controls | 266x46px | 266x46px |
| content past the right edge | 35px | 27px |
| controls under the 44px thumb floor | 15 | 10 |

- [x] The dock becomes a tabbed sheet showing ONE pane (UNITS / COMMAND /
  TOWERS) with a fold. Three panes are ~980px of content in a 388px box.
- [x] #battle-controls returns to the bottom. It had been moved to the top at
  max-width:1550px on the reasoning that "#hud has no fixed height to collide
  with", true at 1366px and false at 412px.
- [x] The header wraps: YOU and RIVAL share a row, the wave block gets full
  width. Three cards in a 390px row gave each ~110px.
- [x] RUSH moved to a full-width bar at the thumb.
- [x] Every battle control is at least 44px.
- [x] AFTER: 9 of 9 checks pass at 412x915, 390x844 and 360x800. Folded, the
  board keeps over 70% and chrome is under 42%.
- [x] tools/gate.js now runs a phone pass at 360x800. Every check in it ran at
  1600x900, a width at which none of the phone rules exist, which is how the
  HUD could be this broken with a clean gate.

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
| I | verified | AUDIT: of 756 ordered pairings, 0 hand-authored, 38 canon, 718 (95%) fell to a generic path holding only TEN distinct replies, none of which answered the opener. FIX: every opener tagged with the stance it takes; each faction answers each stance in its own voice. Distinct replies 10 to 70, 0 untagged openers, 0 faction/stance holes. owner-sweep 38.15. MERGE: a co-contributor landed per-COMMANDER answers for the same defect; battleDialogue now chains both, theirs first (own voice), this pass's stance answer for the pairings theirs does not cover. Their table kept the name `answers`; this one renamed `stanceAnswers` because two keys of one name in one object literal is a silent deletion, not a merge. |
| J | verified | FIELD DOCTRINE replaces CONSCRIPTION. owner-sweep 38.3 (zero free bodies), 38.4 (requisition banks, discounts, is spent), 38.7 (veterancy on a body kill), 38.8 (tower kills never promote), 38.10 (its own tag). Gate clean. |
| K | verified | Legibility only, per owner. Feed now visible inside the radius and at the cap. owner-sweep 38.1 (clutch lays and hatches), 38.2 (hatchling enters with lane left). The rite had ZERO gate coverage before this; it has 2 checks now. |
| L | verified | Every tower, unit and commander entry now leads with its own art (the same icon primitive the board paints, commander portraits from ARTPACK) and carries a hover dossier of advanced stats, keyboard reachable via the existing bindChipTips. Stale CONSCRIPTION copy in Attrition replaced; cooldown documented. owner-sweep 38.13, 38.14. Also fixed 17 PRE-EXISTING AA contrast failures in the manual by applying DESIGN.md's ink rule, and fixed the verify_page bug that was hiding them. |
| M | verified | js/debug.js, collapsible bar, off by default, OPTIONS toggle. Cheats drive the real paths: finish calls Game.endMatch, stars go through Meta.recordWorld so lastStars.systemTaken still queues the cutscene. owner-sweep 38.11 (forced rating via recordWorld), 38.12 (refuses in a duel). Contrast measured clean after two failures. |
| N | verified | Per-detachment cooldown replaces MUSTER_PER_WAVE. owner-sweep 38.5 (arms and expires), 38.6 (Marque exempt), 38.9 (the card says recovering, not unaffordable). Fingerprint extended for reqCredit, musterCd and vetRank; MPT 37/37. |
| O | verified | owner-sweep 62 to 88 checks. newcoverage reports 351 of 351 added executable lines reached, proven by planting a dead branch. Every new check proven by planting the defect it catches. |
| P | verified | mobile 9/9 at three phone widths, gate carries a 360x800 pass, and the gate was proven to catch the regression (planting the three-pane dock reports board 0% uncovered, chrome 98%). Desktop untouched: owner-sweep 88/0, MPT 37/0. |
