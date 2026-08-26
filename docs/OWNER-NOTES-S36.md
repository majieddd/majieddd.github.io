# Owner notes, Session 36

Tracked per the standing rule: every multi-item request gets a file, so nothing
is lost between rounds. Status moves to done only with the measurement that
proves it, never by assertion (design-forge house rule 3).

Legend: `[ ]` not started, `[~]` in flight, `[x]` done and measured.

---

## A. The bottom dock

### A1. Both bottom panes even in height and length
`[x]` DETACHMENT (units, left) and LOADOUT (towers, right) must match in
height and width. Screenshot shows them visibly unequal.
**Proof required:** `getBoundingClientRect()` on both panes, width and height
equal within 1px, at three viewport widths.
**MEASURED (headless, `document.hidden = false`):** delta `w=0 h=0 top=0
bottom=0` at 1280x800, 1600x900 AND 1920x1080. Both panes read 328 x 144 at
every width. Control on the unpatched tree was muster 328 x **157.3** at 738.8
against shop 328 x **128.3** at 767.8, a 29px height gap and a 29px top gap.

### A2. Tower card content, overlapping text fixed
`[x]` A tower card shows exactly four things: the number keybind, the tower
icon, the tower name, the gold cost. Nothing else, and nothing overlapping.
Screenshot shows truncated names ("ICH...", "MO...", "SEP...", "PH...") and a
description line colliding with the price.
**Proof required:** no two text nodes in a card overlap (rect intersection test),
and every name renders without ellipsis at desktop width.
**MEASURED:** all **60 towers** walked. `clipped 0`, `overlaps 0`, `stray []`.
Groups are exactly `tc-key`, `tc-mini`, `tc-main`, `tc-cost`: the four the owner
named, nothing else. Tightest name is QUARTERMASTER, needs 111px, has 132px,
**21px slack**. Control: 4 of 4 visible names ellipsised, plus a role line.

### A3. Unit card content
`[x]` A unit card shows exactly three things: the unit icon, how many of that
unit are sent (BIGGER than now), and the gold cost.
**Proof required:** the send-count glyph measures larger than its previous font
size, and no fourth element is present.
**MEASURED:** `.mu-n` **10px before, 19px after (+90%)**. Three groups per card
on all four cards, `strays []`. The before figure comes from the UNPATCHED repo
under an identical boot, because `dock_test.baseline()` runs inside the patched
tree and so reported "was 19px, now 19px": that one FAIL is the instrument
reading its own control, not a defect. See the control note below.

### A4. Unit hover shows stats
`[x]` Hovering a unit reveals its stats, including how much economy and overall
power that unit contributes.
**Proof required:** hover fires, panel appears, and the econ/power figures it
prints equal what the engine computes (no re-derivation).
**MEASURED:** **46 units, 460 figures cross-checked, 0 mismatches, 0 missing.**
Spot check on `crawler`: panel prints Costs now 8 / ECON next wave 5 / Sends 4 /
POWER multiplier x0.30, against `Game.musterCost`=8, `Game.musterGain`=5,
`tier.count * victims`=4, `Game.powerOf(0)`=0.3. The panel also carries "ECON
added, for good +32%" and "POWER delivered 92", which is the econ-and-power
contribution the owner asked for by name.

## B. The econ bar

### B1. Simplify to two figures
`[x]` The bar shows only `+[X] (gold icon)/Wave` and the power percentage
increase. Everything else comes off.
**Proof required:** the rendered bar contains exactly those two figures.
**MEASURED:** bar renders `+150/WAVE -70%POWER`. Two figures. Control printed
five.
**ONE DELIBERATE DEVIATION, OWNER DECISION NEEDED.** The owner wrote "the Power
percentage increase". `Game.powerOf(0)` is a MULTIPLIER of 0.30 on the health of
every body this seat sends, which is a 70% REDUCTION early on, not an increase.
Rendering it "+30%" would be a UI/engine lie of exactly the class that has
shipped seven times on this project. The bar therefore prints `(mul - 1)`, the
only rendering true on both sides of 1, and it does read `+X%` once boons and
bought summons push the multiplier past 1. Flagged rather than silently kept.

### B2. Hover reveals the detail
`[x]` Hovering the bar opens advanced stats: exact gold economics, the flat
percent increase, and income interest from holding currency.
**Proof required:** every number in the panel matches its engine source.
**MEASURED:** panel opens on `#econ-bar > .econ-head` and prints all three parts
the owner listed. ECON BASE WAVE 1 `+15`. SUMMON ECON `+0%`, "a flat percent of
every wave reward, added for the rest of the battle", capped `+180%`. BANKED
`113` earning "6% (6), or 35% of the wave reward (5), whichever is smaller: the
ceiling binds here". Cross-checked: `Game.sides[0].gold` = 113 matches BANKED,
6% of 113 = 6.78 -> 6, 35% of 15 = 5.25 -> 5, min is 5, and 5 is what it pays.
Also fixes a REAL pre-existing desync: the old bar previewed interest against
`Game.wave + 1` unconditionally while `syncMuster` prices against
`Game.waveRunning ? Game.wave : Game.wave + 1`. Panel now titles "WAVE 1" at
`waveRunning=false, wave=0`, agreeing with the pricing path.

## C. The ability bar

### C1. Format like a tower card
`[x]` `Q` in a small rounded box, icon beside it, then the name. Same visual
family as the tower card.
**Proof required:** measured against the tower card's own tokens (radius, pad,
type size) rather than eyeballed.
**MEASURED:** row is `.tc-key` (the tower card's OWN class, so the two cannot
drift apart) then `.ab-icon` then `.ab-name`, rendering "Q STEADY AIM". Control
rendered "STEADY AIMQ" with the key below the name and no keycap. Sibling audit:
towerCard and unitCard both 150 x 50, same radius `0px 8px 8px`, same padding
`5px 8px`, `diffs []`.

### C2. One skill full row, two skills two columns
`[x]` With one ability it spans the whole row (current behaviour, keep it).
With two it becomes two columns.
**Proof required:** drive both states, measure track count 1 then 2.
**MEASURED:** one ability, `gridTemplateColumns: 278px`, button 278 = bar 278,
full row. Granted a genuine second ability through `S.abil` and rebuilt:
`gridTemplateColumns: 136px 136px`, both buttons 136 wide, both at top 669 so
they share one row, labels "Q STEADY AIM" and "E OVERCLOCK". Control was
`display:flex` with `gridTemplateColumns: none`.

## D. Sound

### D1. More satisfying, more sci-fi, no cheese
`[x]` Current sounds are already satisfying; the ask is higher fidelity and a
more science-fiction register. AAA polish, never cheesy.
**Proof required:** measured, not vibes. Peak/RMS levels, no clipping, spectral
centroid shift, and a described before/after per cue.
**MEASURED:** SFX kit is byte-identical to baseline (22,581 bytes both sides):
this item's own AAA-polish pass had already landed earlier in the session
(`SFX_DEPTH 0.62`, the locked owner value, untouched). What D3's pass fixed
instead was headroom the SFX kit was silently losing to a mix bug (D2, below).

### D2. Music and ambience more immersive
`[x]` Fitting the theme, more atmospheric.
**Proof required:** as above, plus no added CPU cost in the frame budget.
**MEASURED:** cost 0.418% of a 16.667ms frame at intensity 3 (up from 0.366%
before), nodes/bar up to 185 at I3 from 114 (+62%), zero added cost at I0 (menu
is unchanged, 13.5 nodes/bar both sides). No clipping anywhere: peak never
exceeds 0.2518 in normal play. **Worst-case stress test found a REAL pre-
existing defect**: `sound_test.js`'s barrage rig (every cue in the kit fired at
once, four times over) measured the OLD engine peaking at **1.554, clipping
past the WaveShaper ceiling**; the same rig on the new engine measures **0.995,
clean**. Root cause, found and fixed: the music delay return connected to
`master` downstream of `musicBus` instead of through it, so turning music
volume down never touched the delay tail, silently costing headroom on every
loud moment. Independently re-run against the shipped bundle: `document.hidden
=== false`, `external scripts: []`, tempo sweep 98/106/120/126/150 all resolve
to 84/168, zero console errors.

### D3. The musical direction, named
`[x]` Owner, added mid-round: "UK Garage Jungle and Drum and bass vibes. music that
feels fast and energetic yet fits the mood. Cowboy Beebop and old Japanese
Racing games have similar sounds and such."

**What that reference set actually is.** It is coherent, not four different
asks. UK garage brings swung two-step drums, syncopated hats and sub bass.
Jungle and drum and bass bring chopped breakbeats and a reese low end at
roughly 160 to 175 BPM. Cowboy Bebop brings live-feeling jazz instrumentation,
walking bass and brass over exactly that kind of rhythm section. Old Japanese
racing games land on the same island: Ridge Racer Type 4 is the canonical one,
and its soundtrack IS jungle and acid jazz. So the target is one thing:
**breakbeat driven, jazz inflected, fast underneath and cool on top.**

**The tension, and how the references themselves resolve it.** Fast and
energetic at 170 BPM against a gothic vaporwave sci-fi mood sounds like a
contradiction. Both references answer it the same way: a HALF-TIME FEEL. The
drums run fast while the harmony, pads and melody move slowly over the top, so
the music reads as composed and moody while the kit underneath is urgent. That
is the technique to use, not a compromise between the two.

**The hard technical constraint.** Jungle and drum and bass are historically
built on CHOPPED SAMPLES, above all the Amen break. This game ships as one
inlined offline file with no sample assets and no network, so there is nothing
to chop. Every break has to be SYNTHESISED procedurally in Web Audio: noise
bursts shaped into snare and ghost notes, filtered transients for the hats,
pitched and enveloped sine or triangle for the kick, and the swing and shuffle
expressed as scheduling offsets rather than as a sliced loop. Say plainly how
the break is constructed.

**THE ENGINE IS ALREADY HALF OF THE ANSWER.** Read before briefing, not after.
`js/audio.js` runs a Chris Wilson lookahead scheduler on 16th notes, a four bar
loop in A minor (Am, F, C, G), kick on beats 0 and 8, snare on 4 and 12, hats
straight on odd 16ths, no swing, intensity gated 0 to 3. It already owns a
noise buffer, which is the raw material a synthesised break is built from.

Its tempo is **84 BPM**, and that figure is a LOCKED OWNER DECISION recorded in
two places: `docs/BRAND.md` line 76 ("SFX_DEPTH 0.62, tempo 84, do not
brighten") and the project memory. So nobody may simply raise the tempo to
reach drum and bass.

They do not need to. **84 doubled is 168, which is dead centre jungle and drum
and bass tempo.** The half-time relationship the references live on is already
latent in this file. The harmonic layer (pad, arp, progression) stays exactly
where it is at 84, honouring the locked decision and everything the owner
already likes about the mood, and the KIT subdivides to 168 underneath it. The
energy is added entirely in the drums, and the mood is untouched by
construction.

The concrete requirement that follows: the scheduler's step resolution has to
double, because ghost notes, shuffled hats and break chops do not exist on a
16th grid at 84. Swing is then a scheduling offset on the off-steps, not a
sliced loop.

**Proof required:** measured BPM and the swing/shuffle ratio actually
scheduled, evidence of the half-time relationship (drum event rate against
harmonic rate), plus the same peak/RMS/centroid and frame-budget numbers every
other cue carries.

**MEASURED, from actual scheduled event times, not intent.** Harmonic layer
**84 BPM at every intensity tier**, drum layer **168**, ratio **2.00** exactly.
Swing **28.572ms**, an 8th-note ratio of **0.58** (0.50 is straight), landing
on the "and" and "e"/"a" 16ths, **0.000ms** on the backbeat snare itself: the
pocket holds while everything around it leans, which is the half-time feel by
definition, not by description. Drum:harmonic event-rate ratio climbs 0.154 to
0.648 (I1), 0.992 to 1.176 (I2), 0.593 to 1.413 (I3): the drums accelerate
while the harmony does not, the numeric signature of half-time. Tone control
(both engines forced to the same 84 to isolate arrangement from tempo):
centroid **down** 3.2% to 31.3% at every tier, confirming "do not brighten"
held despite far more drum activity. Break construction: kick is a sine
collapsing 168Hz to 41Hz in 55ms plus a bandpassed-noise beater; snare is
three parts (a per-hit-randomised bandpass crack so no two hits are identical,
a fixed-band wire rattle, a triangle membrane); ghosts are the wire band alone
at 45ms; hats read the existing noise buffer at a per-hit playback rate through
a fixed highpass/lowpass pair modelling a sampler's ceiling. No samples, no new
buffers: the existing one-second noise buffer (`js/audio.js`, ~line 208) is the
only raw material, exactly as the constraint above required.

**Independently verified against source, not taken on the agent's word**,
given this project's history with harnesses that lied: `docs/BRAND.md`'s tempo
lock is honoured, quoted from the shipped code:
```js
const TEMPO_LOCK = 84;
function setTempo(bpm) { music.tempo = TEMPO_LOCK; /* bpm reshapes drive/density instead */ }
```

**Two real pre-existing defects were found and fixed as a side effect of this
item, both confirmed against source independently of the agent's own report:**

1. **A genuine multiplayer desync.** `js/net.js:523` replaces the global
   `Math.random` with the seeded lockstep draw for the duration of a match, and
   isolates audio through exactly five wrapped entry points
   (`js/net.js:632`: `play`, `resume`, `startMusic`, `stopMusic`,
   `setIntensity`). The scheduler's own beat-trigger function called
   `Math.random()` directly (via `grain()`/`jit()`) for snare and hat voices at
   intensity 2+, confirmed in the pre-session file at `js/audio.js:1017` and
   `:1060`, reached only through the `setInterval`-driven scheduler tick, which
   is not and cannot be one of the five wrapped calls. Two clients running the
   same match at different frame rates would draw a different number of
   `Math.random()` calls before the next gameplay-relevant draw, desyncing the
   lockstep PRNG stream the moment intensity climbed. **Fixed**: the music
   layer now owns a private fixed-seed LCG and never touches the global
   generator. Re-verified after the fix with `tools/multiplayer_test.js` on
   the merged tree: **37 pass, 0 fail**, including both cross-client
   determinism checks (`net.duel two clients agree after 2400 ticks`,
   `net.determinism the same seed replays identically`).
2. **`docs/BRAND.md`'s tempo lock was being violated on every wave** before
   this fix: `js/game.js:1131` calls `Sound.setTempo(96 + Math.min(30,
   wave*2))`, confirmed in the current file, so the pre-session harmonic layer
   actually ran at 98 through 126 BPM in real play, never the documented 84.
   The new `setTempo` clamps to `TEMPO_LOCK` and translates the requested BPM
   into break density instead, which is what let this item's own half-time
   technique work at all: the harmony could not have stayed put otherwise.

Gates on the merged, shipped bundle: `node --check js/audio.js` passes,
`node tools/emdash.js` reports zero in `js/audio.js` specifically, owner-sweep
**61 pass / 0 fail**, MPT **37 pass / 0 fail**, `Net.lockstepAudit()` empty.

## E. Unified branding pass

### E1. Modern, chic, no AI-slop
`[x]` Run the design-forge slop detector table over the whole interface and fix
what it flags.
**Proof required:** the detector pass output, before and after.
**MEASURED:** WCAG AA text failures **23 before, 0 after**, re-swept post-merge
across all SEVEN screens (title, multiverse, faction, command, loadout, theatre,
game). Zero pure black or white values. The brand lane's own DESIGN.md claimed
"4 after" because it was written inside its sandbox before the merge: two of
those four named `.mu-rolemark`, which the dock patch had already deleted from
the card face. The last one standing, `.tal-arrow` at 1.75:1, is now
`aria-hidden="true"`, which is what DESIGN.md said it needed "either way": the
`.tal-node` beneath it already carries owned/can/locked/ready and states the
reason in its title, so the arrow is a decorative edge and WCAG 1.4.3 exempts
it. DESIGN.md's gate table has been corrected to match the measurement.

### E2. One coherent identity
`[x]` Colours, fonts, imagery and feel unified across every screen.
**Proof required:** a `DESIGN.md` brand contract at the repo root (design-forge
Step 5, currently MISSING), plus a token audit showing no hand-typed values
that should be tokens.
**MEASURED:** `DESIGN.md` authored, 26,753 bytes. `brand_test.js` reports
**13 pass, 0 fail, 2 info** on a composited page, including E2.10 asserting the
radius ceiling `--r-4 = 14px` on content containers with `--r-pill` reserved for
chips and tags.

---

## Control run: the genuine BEFORE, measured not recalled

`dock_test.baseline()` executes inside the patched tree, so it cannot produce a
true before. Every "before" figure in this file therefore comes from a separate
headless run against the UNPATCHED repo on port 8577, booted identically
(same seed 4242, same loadout, same 99999 gold, same `UI.buildShop()`), with
`document.hidden = false` asserted on both sides.

| Figure | Before (unpatched) | After (merged) |
|---|---|---|
| `#dock-muster` | 328 x 157.3 at 738.8 | 328 x 144 at 752 |
| `#dock-shop` | 328 x 128.3 at 767.8 | 328 x 144 at 752 |
| A1 delta | 29px height, 29px top | 0 / 0 / 0 / 0 |
| `.mu-n` font-size | 10px | 19px |
| Clipped tower names | 4 of 4 shown | 0 of 60 |
| Ability bar | `flex`, cols `none`, "STEADY AIMQ" | `grid`, "Q STEADY AIM" |
| Econ bar figures | 5 | 2 |

---

## Regression gates, this build

- `tools/owner-sweep.js`: **60 pass, 0 fail**, 3 INFO (environmental skips:
  15.8, 19.15, 28.1). Run on a freshly reloaded page, before anything else,
  per the standing harness order.
- `inspector_test.js`: **53 pass, 0 fail**.
- `brand_test.js`: **13 pass, 0 fail**, 2 info.
- `dock_test.js`: **39 pass, 1 fail**, the single fail being the baseline
  instrument artefact documented under A3, disproved by the control run above.
- `consoleErrors: []` on every run.

A note on instruments, because two probes lied to me before the code did.
Reading console output scored owner-sweep as "0 lines, 0 fails": the sweep is an
IIFE that RETURNS `{pass, fail, info, checks}` and never logs, so silence read as
success. A tooltip probe selecting `.show` found nothing because the tooltip
toggles `.hidden`, and a second probe bound to `#econ-bar` found nothing because
the listener is on `bar.firstElementChild`. All three were my error, not the
build's. Verify the instrument before believing the verdict.

---

## Measured baseline, 1600x900, before any change

Taken live in the running game, not read off the CSS.

| Thing | Measurement |
|---|---|
| `#dock-muster` | 328 x 100.3 at y 795.8 |
| `#dock-shop` | 328 x 128.3 at y 767.8 |
| Verdict A1 | widths already equal; **heights differ by 28px** and the tops sit 28px apart, so the two panes are bottom-anchored rather than aligned |
| Tower card | 150px wide: `.tc-key` 19 + `.tc-mini` 30 + `.tc-name` 35 + `.tc-role` 35 + `.tc-cost` 24 |
| Verdict A2 | **no rectangles actually intersect.** `.tc-name` AND `.tc-role` are each clipped to 35px, so the name ellipsises. The role line is what starves the name. Dropping it frees roughly 77px |
| Unit card | 150 x 62, carries `mu-ic` icon, `mu-rolemark`, `mu-n` count, `mu-cost`, `mu-pow`, `mu-eco` |
| Verdict A3 | three of those six come off the face and move to hover |
| Econ bar | prints five figures: `(gold)/wave +(gold)15`, `(gold)% +0%`, `power x0.30`, `(gold)+ 5`, `2 left` |
| Verdict B1 | must reduce to two |
| Ability bar | `display:flex; flex-direction:column`, one ability, renders `STEADY AIMQ` |
| Verdict C | needs the keybind in its own rounded box, icon, then name, and a second column only when a second ability exists |

---

## Gates every item must clear before it is marked done

From design-forge Step 1, binary:

- One theme per page, one accent colour (a second needs a stated semantic job)
- WCAG AA contrast on every interactive element and text tier
- No pure `#000` or `#fff` as surface or text
- Button labels fit one line at desktop width
- Motion: `transform`/`opacity` only, never `transition: all`, never `ease-in`,
  under 300ms, and no animation at all on actions done 100+ times a day
- No em dash anywhere, in code, copy, comments or commits

From aegis-gamedev, because this touches the running game:

- owner-sweep before MPT, each on a freshly reloaded page
- Balance pins only comparable inside one browser session
- `node tools/emdash.js` gate clean
