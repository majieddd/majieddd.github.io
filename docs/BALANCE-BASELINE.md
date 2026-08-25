# Balance baseline

> **The Session 18 baseline below is UNSEEDED and therefore not reproducible.**
> A seeded baseline was taken in Session 21 and is at the bottom of this file
> use that one for any comparison. The old numbers are kept as history.

## Session 18 baseline (unseeded, historical)

Harness: `_pins.js`, mirror AI on both seats, loadout pinned to
`bolt/cryo/mortar/flak/beacon`, difficulty `contested`.

**Two things this harness gets right that earlier ones did not.**

1. **Galaxy tier must be 0 for the maxed pin.** Tier feeds `waveScaled`, so a
   maxed profile stamped `tier 4` resolves around wave 12 and reads as a
   catastrophic regression when nothing has changed. Maxed means maxed
   *unlocks*, not maxed escalation.
2. **A run ends either way.** "Wave reached" alone conflates a rout with a
   romp: on `delta` a maxed run finishes at wave 7 having *eliminated the
   rival*. The pin is the median wave of **loss** runs; wins are reported
   separately. Compare like with like.

## Fresh profile (6 runs, one per map)

| Map | Outcome | Wave |
|---|---|---|
| spine | loss | 5 |
| delta | win | 9 |
| narrows | loss | 7 |
| shattered | win | 23 |
| crossroads | win | 6 |
| coil | loss | 26 |

**Loss median 7**, matches the documented pin of 6-7.
`coil` is the long-map outlier at 26.

## Maxed profile, tier 0

| Map | Outcome | Wave | Lives |
|---|---|---|---|
| spine | win | 27 | 53 vs 0 |
| delta | win | 7 | 38 vs 0 |

**spine 27**, matches the documented pin of 26-27.

## Re-measure after the patches

Batch B implements tower talents and commander traits that are currently
inert, so it *will* move power budgets upward. Expect maxed wins to arrive
earlier and fresh losses to move later; anything that moves the fresh loss
median off 6-7 is a regression to investigate, not to accept.

A maxed run needs ~34k frames, more than one `javascript_tool` call's 30s
budget. Drive it with `PINS.begin()` then `PINS.tick(20000)` until `done`
never a single blocking loop.

---

# Session 21 baseline. SEEDED, and reproducible

The Session 18 numbers above were taken on the native, unseeded `Math.random`,
so every run was a different match and nothing replayed. Two things changed:

1. `tools/balance-pins.js` takes a **seed**. The simulation is a pure function
   of its RNG stream, proved by replacing `Math.random` with mulberry32 over a
   fixed step budget and getting byte-identical trials (839 draws without the
   mirror brain, 3462 with it).
2. **The AI prototype leak is fixed.** `AI` is a singleton *and* a prototype:
   `js/game.js:520-521` gives each rival seat `Object.create(AI)`, and `:533`
   also calls `AI.init(...)` on the shared object. A match left `spots` (148
   entries) and `samples` (206) plus `side`/`diff`/`think`/`ready` on the
   prototype, so run 2 in a page measured a warmed-up rival:

       same seed, same page:  run 1 -> wave 21 / 27480 steps
                              run 2 -> wave 20 / 26129 steps

   `PINS.begin()` now restores the prototype first. `PINS.selfTest()` is the
   regression test and returns `reproducible: true`.

## How to reproduce these exact numbers

Load the harness into a page that has **not yet run a match** (the AI snapshot
it restores must be pristine), then for map index `i` in 0..5 use seed
`1000 + i`:

```js
// paste tools/balance-pins.js first
PINS.selfTest(0, 1234)                 // must report reproducible: true
PINS.maxProfile(0); PINS.begin(i, 'contested', 1000 + i);
PINS.tick(20000)                       // repeat until {done: true}
```

## Maxed profile, galaxy tier 0, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | win | 11 |
| delta | 1001 | loss | 22 |
| narrows | 1002 | loss | 27 |
| shattered | 1003 | win | 6 |
| crossroads | 1004 | loss | 21 |
| coil | 1005 | win | 8 |

Waves 6, 8, 11, 21, 22, 27 · **3 wins / 3 losses** · **loss median 22**.

## Fresh profile, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | loss | 5 |
| delta | 1001 | win | 6 |
| narrows | 1002 | loss | 6 |
| shattered | 1003 | loss | 13 |
| crossroads | 1004 | win | 7 |
| coil | 1005 | loss | 10 |

Waves 5, 6, 6, 7, 10, 13 · **2 wins / 4 losses** · **loss median 8**.

## What this says about the old documented pins

- The fresh pin's **median is intact**, 6-7 documented, and the loss median
  here is 8 with two losses at 5 and 6.
- CONTRIBUTING's claim that **"every loss is under wave 10" is false**:
  `coil` loses at 10 and `shattered` at 13, reproducibly.
- The maxed pin's **"median 27" does not hold**, 27 is the top of the range,
  not the middle. The loss median is 22.

Compare a seeded number only against the SAME seed. These six are now the
reference; anything that moves them is the code, not the draw.

---

# Session 21 round two. RE-BASELINED for the ten heavies

Sixty towers changed the draft pool, and a `TOWER_ORDER` change silently
re-bases these pins (the first documented way to mis-measure them). Same
seeds, same method, same maps, new numbers, and the harness still reports
`reproducible: true`.

## Maxed profile, galaxy tier 0, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | win | 18 |
| delta | 1001 | loss | 23 |
| narrows | 1002 | win | 23 |
| shattered | 1003 | win | 12 |
| crossroads | 1004 | loss | 25 |
| coil | 1005 | loss | 25 |

Waves 12, 18, 23, 23, 25, 25 · **3 wins / 3 losses** · **loss median 25**
(was 22 before the heavies).

## Fresh profile, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | loss | 7 |
| delta | 1001 | win | 6 |
| narrows | 1002 | loss | 6 |
| shattered | 1003 | loss | 13 |
| crossroads | 1004 | win | 6 |
| coil | 1005 | loss | 9 |

Waves 6, 6, 6, 7, 9, 13 · **2 wins / 4 losses** · **loss median 9** (was 8).

## Reading it

The heavies raised the CEILING and left the floor alone, which is what a
board-cost power tier is supposed to do: the maxed loss median moved 22 → 25
while the fresh curve barely moved (8 → 9), a fresh profile cannot afford a
heavy, so it should not feel them, and it does not. Nothing here needs a nerf
on this evidence; re-measure again if any heavy's talents change.

---

# Session 22. RE-BASELINED for the SUMMONING DOCTRINES

Summoning split into five rites, so the single universal law "everything you
kill rises again" now belongs to one doctrine out of five. That is an ENGINE
change and it re-bases these pins legitimately. Same seeds, same maps, same
method; `selfTest(0, 1234)` still reports `reproducible: true` (23 / 28853,
was 22 / 28664).

## Maxed profile, galaxy tier 0, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | win | 25 |
| delta | 1001 | loss | 31 |
| narrows | 1002 | loss | 34 |
| shattered | 1003 | loss | 31 |
| crossroads | 1004 | loss | 30 |
| coil | 1005 | loss | 33 |

**1 win / 5 losses** · **loss median 31**. Against a PRE-doctrine build
measured in the same session on the same seeds, waves 25, 34, 33, 33, 28, 30,
**median 33**, so the rites made expert matches slightly SHORTER, not longer.
See "the delta that was not there" below.

## Fresh profile, seeds 1000-1005

| Map | Seed | Outcome | Wave |
|---|---:|---|---:|
| spine | 1000 | loss | 10 |
| delta | 1001 | win | 10 |
| narrows | 1002 | loss | 11 |
| shattered | 1003 | loss | 11 |
| crossroads | 1004 | win | 14 |
| coil | 1005 | loss | 26 |

**2 wins / 4 losses** · **loss median 11**. No delta is claimed against the old
fresh figure: it was recorded in a different session and this table was not
re-measured against a pre-doctrine build under the protocol below, so the two
numbers are not comparable and pretending otherwise is the mistake this
section exists to document.

## The delta that was not there

This section first shipped claiming the maxed median moved 25 → 31 and calling
that "the number to watch", six waves longer, pulling against the standing
rule that rounds should end promptly. **That claim was wrong**, and it was
wrong in the exact way the warning below describes: 25 was written down in an
earlier session and 31 was measured in this one.

Measured properly, both builds served at parallel paths and swept back to
back in ONE session, seeds 1000-1005, the maxed loss median is **33 before
the doctrines and 31 after**. Expert matches got two waves SHORTER. There is
no pacing regression to chase.

What is true, structurally: of the five rites only CONSCRIPTION and THE
LATTICE turn a kill into a body, so total free pressure across a mirror-AI
board fell. It simply did not move the medians the way a cross-session
comparison suggested.

### A WARNING ABOUT THIS HARNESS, learnt the hard way in Session 22

These absolute numbers are only comparable **within one session**. The same
bundle, unchanged, returned 22/28664 one day and 13/18007 another while
reporting `reproducible: true` both times, the flag only promises that two
runs inside ONE page agree, which is exactly what it says and not what it was
being read as. Whatever the page's state is when `captureAI()` snapshots the
prototype travels into every run after it.

So: to prove a change did or did not move the simulation, build BOTH versions,
serve them at equivalent fresh paths, and measure them back to back in one
session. That is how the NG+ work was proved sim-neutral (13/18007 on both
sides). A number compared against one written down on a different day proves
nothing at all.

~~**The maxed move (25 → 31) is the number to watch.**~~ **RETRACTED.** That
sentence was written from a cross-session comparison and is exactly the mistake
the paragraph above warns about: 25 was measured on a different day. Measured
properly, both builds served at fresh paths and run back to back in one
session, the maxed loss median is **33 before the rites and 31 after**, so the
summoning doctrines made expert matches marginally *shorter*. The terminus
still bites: every run ended by wave 34.

**What is still worth watching** is the absolute number, not the delta. A maxed
median of 31 is a long match, and the standing rule is that rounds end
promptly. If it is to come down, the honest lever is the post-wave-20 ramp
`RAMP_PRESETS` and the health curve, rather than the rites, which have now
been measured and are not the cause.
