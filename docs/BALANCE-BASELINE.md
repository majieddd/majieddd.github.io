# Balance baseline — taken BEFORE the Session 18 closeout patches

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

**Loss median 7** — matches the documented pin of 6-7.
`coil` is the long-map outlier at 26.

## Maxed profile, tier 0

| Map | Outcome | Wave | Lives |
|---|---|---|---|
| spine | win | 27 | 53 vs 0 |
| delta | win | 7 | 38 vs 0 |

**spine 27** — matches the documented pin of 26-27.

## Re-measure after the patches

Batch B implements tower talents and commander traits that are currently
inert, so it *will* move power budgets upward. Expect maxed wins to arrive
earlier and fresh losses to move later; anything that moves the fresh loss
median off 6-7 is a regression to investigate, not to accept.

A maxed run needs ~34k frames, more than one `javascript_tool` call's 30s
budget. Drive it with `PINS.begin()` then `PINS.tick(20000)` until `done` —
never a single blocking loop.
