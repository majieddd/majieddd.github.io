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

## Q. THE BROOD opens a window instead of hatching

Owner, Session 39: "it's still an incubation phase that instead refreshes the
cooldown to summon the unit and it will summon from there. However, the caveat
is that price increases still occur so you have to be smart when to send a
massive rushing wave ... whenever the incubation begins, it selects a unit that
it will refresh the cooldown on so it can be summoned with gold, however, there
is a time limit of about 5 seconds to actually summon from the incubation.
Trying to find a way to balance them to limit their swarm while still feeling
like one."

- [x] A clutch coming due no longer raises a body. It refreshes the cooldown on
  the creature it was gestating and opens a 5s window to SEND it, paid in gold.
- [x] The window opens at MATURITY, not when the clutch is laid, so gestation
  and the feed-a-clutch-to-hurry-it mechanic keep their meaning: feeding buys
  the window sooner, not a body sooner.
- [x] A lapsed window hands back the wait it interrupted (minus the window)
  rather than charging a fresh cooldown, so it can never punish a detachment
  that was ready anyway.
- [x] The price curve is untouched, which is the owner's caveat: spending every
  opening prices you out of the next rush.
- [x] owner-sweep 38.1 (window opens, no free body), 38.2 (sendable in the
  window, lapses, hands the wait back), 38.2b (spending consumes it and the
  price climbs), 38.14 (the manual no longer says a clutch hatches).

CONSEQUENCE WORTH RECORDING: after this and FIELD DOCTRINE, no rite both
purchases and raises from kills. THE PROCESSION raises on a clock (needs no
wire) and THE LATTICE raises from kills but cannot purchase, which is why the
MPT duel rig now drives THE LATTICE and asserts `built` rather than `bought`.

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
| Q | verified | Brood window replaces hatching. owner-sweep 93/0 with 38.1, 38.2, 38.2b proven by planting (window never consumed, window never lapses: both caught). MPT rig moved to THE LATTICE because no rite buys AND raises from kills any more. Gate clean. |
| R | verified | Ambience bed removed. Idle mix -110 dBFS to below the -120 gate with the bed muted; probe-hiss A1/A2 in the gate. |
| S | verified | Lore re-anchored to 2029. 37 mission seeds re-seated, supersession banners on 9 canon files, docs/lore/docs/canon/disclosed-hardware-2029.md establishes every human airframe as a Concord airframe and sets the contaminated-legend rule. owner-sweep 39.1 guards the 4 consumed LORE fields against retired vocabulary. |
| T | verified | "Troops attacking each other" is a READABILITY failure, not a pairing bug. probe-melee-ff F1/F2 recorded 0 same-owner and 0 same-target strikes across 200 resolveMelee ticks with the bodies co-located; F3 showed the real cause (legitimate pairs wearing the same sprite on a human-held world). Ownership ring strengthened. |
| U | verified | COMMANDER THEMING. Two halves, and the faction half was a live defect nobody had measured. **(1) The banner key bug.** POWER_ORDER says `robot`, ORIGIN_ORDER says `robotic`, and `AI.flyTheBanner` compared them directly, so the machines were the only power that could not fly its own banner: measured 1.23 own-origin towers per loadout with 45% of drafts carrying NONE, against a target every other banner met. Nothing failed, because an empty candidate list is a silent no-op. Fixed with `originKeyOf()` in all THREE comparisons (fixing two left the third, which then evicted the signature towers: caught by 40.3 before it shipped). Now 3.57 of 4, 0% bare. **(2) Signatures.** All 27 factioned commanders carry two towers and two denizens, every tower own-origin, each chosen against its trait's mechanic; CADRE deliberately has none. `LOADOUT_OWN_ORIGIN` raised 2 to 4 on the arithmetic (60 towers, 12 per origin, every origin self-sufficient). Measured: both signature towers reach the board on 100% of drafts across all five banners, 0 drafts unable to kill, 0 unable to answer air. Surfaced on the commander card and in the field manual as painted icons with hover dossiers, and the briefing card now leads with the commander's own denizens. owner-sweep 94 to 100; 40.1 to 40.6 each proven by planting the defect it catches (40.4 and 40.5 fired on REAL defects on their first run: LUMEN and HALDER drafted an identical board, and the AI's DAMAGE list wrongly counted CUSTODIAN, whose own def says it "shoots nothing and blocks nothing"). |
| V | verified | TOOLING, opened by the owner's note that regex failures were breaking the update protocol. `tools/facts.js` answers game-data questions by LOADING the modules (a non-greedy regex had reported 19 towers against a real 60, and a whole design argument was built on it before the owner caught it); `facts.js check` is in the gate. `tools/cssbrace.js` counts CSS braces, added after finding `@media (max-width: 860px)` opened at polish.css:4097 and never closed, which silently phone-scoped ~600 lines: measured at 1280px, `.ce-fig` computed to `display: inline` at 0x0, so the field manual portraits worked on phones and were invisible on every desktop. Both proven by planting. Laws written into the aegis-gamedev skill (live via symlink) and design-forge gate G13; the stale "12 binary gates" count corrected to 13 in the same commit, and the memory.js path in the skill fixed after it produced five MODULE_NOT_FOUND. |
| W | verified | MAPGEN HANDOFF, picked up from the co-contributor's uncommitted tree. Their eight new lane families (braid, gauntlet, staircase, horseshoe, switchback, labyrinth, twin-temple, twin-gate) plus wall posts and a `legH` option on the serpentine were finished and unshipped, while `js/config.js` MAPS had already declared all fifteen. **The live site was serving eight identical boards**: measured on the shipped bundle, every one of the eight took the switch's `default:` arm and returned cols 28, rows 15, one lane of 17 tiles, zero walls. Their generators are committed and exercised across 120 seeds each (1800 boards, zero throws, zero empty or short lanes). owner-sweep 41.4 compares every MAPS family against what a nonsense family id returns, since only the default arm can serve that; verified green on the fix and reporting "8 of 15 families fall through" on the commit before it. |
| X | verified | WORLD DOSSIERS for the same eight. `js/worldlore.js` shipped a correct `selfCheck()` wired into no gate, so it returned `ok:false` with eight missing ids to nobody. The symptom was invisible: `WorldLore.world()` still returned a headline and body from the owner-and-kind sentence banks and returned `functionThen` and `conflictNow` EMPTY. Eight records written against the geometry each generator actually produces, MAP_MANIFEST updated, selfCheck now `ok:true` at 36/36. owner-sweep 41.1 (the caller selfCheck never had), 41.2 (the rendered halves are non-empty, which is the question 41.1 cannot ask), 41.3 (retired canon in an authored dossier, which fired at once on twin-channel's "Old Weather" after I fixed the same term in open-field by hand and missed it). |
| Y | verified | TALENT MAPS AND THE PRESTIGE TRACK, from the owner's reference chart: every commander's chart with its own shape of lines, and a prestige tracker on the right where each star is +20% to talent values plus a passive unique to that commander. **(1) Shapes.** `COMMANDER_SHAPES` gives each of 28 charts its own parent map and `layoutTechShape` keeps every node on its lineage column, drawing a cross-lineage link as a diagonal. The first layout put each child under its PARENT'S column, and owner-sweep 43.3 fired on its first run: five commanders with distinct parent maps drew IDENTICAL trees (rake, grist and dregg_r drew cadre's, scarlet drew nyx's, lumen_r drew aurelia's), because the picture depended on placement and not on what hung from what. Column anchoring makes the picture a one-to-one image of the data. Measured on the bundle: 28 of 28 line sets distinct, 168 lines of which 53 are diagonals, three columns. **(2) Prestige.** `COMMANDER_PRESTIGE` gives every commander five passives with a live `apply`, run by `applyPrestigePassives` in both `applyTo` and `applyToAI` ahead of `foldTraits`, which already carried the +20% per star. Four engine hooks (`surgeMul`, `vaultBonus`, `mods.interest`, `compileRateMul`) had readers and no writers for their whole life and now have writers. **(3) The names.** The first draft of the passives echoed talent names: 90 of 140 shared a name with a talent or the trait on the same commander, and the first chart the owner would open showed a tier-5 NO LIMITS on the track beside a talent NO LIMITS on the map. 98 renamed in each commander's voice (the 90 plus near-misses such as RAMPART beside RAMPARTS and SPAWN beside SPAWNING), and `facts.js check` now refuses a passive named like a talent, the trait or an earlier passive of its commander: 91 fires on the old names, zero after. The track sits right of the map on desktop and below it on phones (`.talent-scroll` measured 526px inside a 390px viewport before the CSS fix; mobile M14 holds it). owner-sweep 43.1 to 43.4; 43.4 drives a real prestige: one button, star earned, tree reset, BULWARK measured as +8 maxLives against the same side without the star. Gate: owner-sweep 111/0, MPT 40/0, mobile 16/0, boards-play 6/0, with the five planet-cutscenes failures pre-existing at HEAD (the co-contributor's campaign commits, proven by stash bisect). |
| Z | verified | THE BLUEPRINT ON THE SPINE, from the owner's ask to fold the Ember Run workflow (Marco Paoletta, Letta: a reference game, the kit before the design, concept art checked against the kit, charts, a 40-page document handed to the agent first, an agent that plays what it builds) into the aegis-suite plugin, broad, with this site as the running document. The plugin side is the new `game-blueprint` skill and `tools/blueprint.js` (aegis-suite 3.14.0). Measured here first: `node tools/blueprint.js check narrative/index.html` read 5 of the 14 contract sections in 14,864 words (the shared systems, the boards, Decided, Task list, Where we are) and one em dash entity in the title. The spine is generated, so the fix lives in `tools/storyboard.js`: a block between "How to reference anything here" and "The baseline commander" emitting "The blueprint" and nine sections (Reference, Pillars, Core loop, Kit, Concept, Numbers, Interface, Build order, Verification), each registering a `blueprint:<id>` ref in spine.json, every count read at generation (60 towers, 12 per origin across 5 origins, a loadout of 4, 231 plates) and never typed. The sandbox had to expose LOADOUT_SIZE, and origins are read off the towers because it does not expose ORIGIN_ORDER. The title's dash entity became a colon. After: 14 of 14 sections, 15,669 words, 0 em dash, `storyboard.js --check` fresh at 879 refs, and the diff touches only the title line and the inserted block. Gate unchanged: owner-sweep 111/0, MPT 40/0, mobile 16/0, boards-play 6/0, the five planet-cutscenes failures pre-existing. |
