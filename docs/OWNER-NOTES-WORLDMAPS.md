# THE TRACKED LIST: handcrafted world boards (Session 44)

Owner directive: every campaign planet gets a handcrafted board unique to it;
procedural generation moves to a future post-campaign mode; a terrain codex
(class, flow, cover, barriers, sight, basis) categorises every board as the
design corpus for that future work. Design: docs/WORLDMAPS-DESIGN.md.

Status vocabulary: open | in-progress | landed <commit> | verified <commit> <check>
Only verified closes a row. A blocked row carries pasted command output.

| # | Item | Status | Commit | Check id |
| --- | --- | --- | --- | --- |
| 1 | Design doc + this tracker | verified 8f5edfe | 8f5edfe | fixture in-tree |
| 2 | js/worldmaps.js: terrain codex vocab + 7 Earth System boards | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 3 | js/worldmaps.js: 7 Pleiades boards | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 4 | js/worldmaps.js: 7 Zeta Reticuli boards | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 5 | js/worldmaps.js: 7 Proxima Centauri boards | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 6 | js/worldmaps.js: 7 Sirius boards | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 7 | Stream-pin fixture captured at pre-change HEAD | verified 8f5edfe | 8f5edfe | WM.8 |
| 8 | Galaxy wiring: post-draw override, pool + mapPool exclusion | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 9 | tools/probe-worldmaps.js, wired into gate.js | verified bab651e | bab651e | WM.1-WM.9, gate CLEAN |
| 10 | Spine: SVG board + terrain codex on every world card and board entry | landed (this commit) | HEAD | spine 765 refs, --check green |
| 11 | Balance re-baseline note in docs/BALANCE-BASELINE.md | landed (this commit) | HEAD | next pins run measures |
| 12 | Owner call, deferred: per-planet TRI boards for contested ground | owner-call | | |

Notes per item land here as work lands.

## Session close notes

- Owner-sweep on the live bundle first read 5 failures; all five were real
  and all five are closed: 38.1 caught the tri assignment keyed on the tier
  index (same planet, different tri ground per campaign; now keyed on the
  world NAME and pinned node-side by new WM.10), 41.1/41.2 wanted dossiers
  for the 35 new boards (written in js/worldlore.js, selfCheck 0 missing,
  0 incomplete, 0 drift), and 42.2/42.3 asserted the retired rolled-pool
  era (rewritten to the inverted law: zero procedural campaign ground, pool
  intact, own board everywhere, tri on contested).
- Final: owner-sweep 107 pass 0 fail on the rebuilt bundle;
  probe-worldmaps 10 checks green; static gate CLEAN.
- Process note: commit e829579 shipped without the regenerated pages
  because a heredoc broke the shell's short-circuit chain; the deploy
  regenerates narrative from the commit so the live site was never wrong,
  and the very next commit carries the regeneration. The gate's freshness
  check is what caught it.

## Session 45: no board entry may lack a map

Owner: "some of the Scenarios are actually missing the map related to it ...
make every scenario has a map and ensure these maps are all unique and provide
a different level of challenge each."

Measured first: 19 of 71 board entries rendered with no map. Four were the
three-way grounds (real geometry, no renderer that understood absolute
tri coordinates) and fifteen were procedural families (no fixed geometry at
all). Both closed, and the gap is now a gate check rather than something a
person has to notice.

| # | Item | Status | Check id |
| --- | --- | --- | --- |
| 13 | Draw the four three-way grounds (triSVG, colour per seat) | landed | WM.12 |
| 14 | One handcrafted reference board per procedural family (15) | landed | WM.11, WM.12 |
| 15 | `challenge` added to the codex; all 35 planet boards classified | landed | WM.13 |
| 16 | Codex extended to the 21 pool boards and 4 tri grounds (POOL_TERRA) | landed | WM.15 |
| 17 | Scenario cards carry the grounds they are fought on | landed | rendered, 4/4 |
| 18 | showboard: `worlds`, `refs`, `tri`, by-id | landed | manual review |

Verified: probe 15 checks green; 0 of 71 entries now render without a map
(was 19); challenge spread across all five levels; four mutation tests each
caught by the predicted check with control green; deadfields exemption made
explicit after finding `challenge` was passing only because the word appears
in a cutscene caption.
