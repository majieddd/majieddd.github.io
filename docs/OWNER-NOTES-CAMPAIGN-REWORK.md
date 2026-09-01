# THE TRACKED LIST: the three-act campaign rework (Session 46)

Owner directive: the campaign moves from "one battle per world" to
act -> planet -> location, starting with Earth locations (Long Island first).
Design and impact analysis: docs/CAMPAIGN-REWORK.md. Structure as data:
js/campaign2.js. Gate: tools/probe-campaign2.js (9 checks).

Status: open | in-progress | landed <commit> | verified <commit> <check> | owner-call

| # | Item | Status | Check id |
| --- | --- | --- | --- |
| 1 | Design doc, impact analysis, asset schedule | landed | doc |
| 2 | js/campaign2.js: 3 acts, 19 planets, 62 locations, faction orders | landed | C2.1-C2.9 |
| 3 | tools/probe-campaign2.js, wired into gate.js | landed | 9 checks, 4 mutation tests |
| 4 | ENGINE: SYSTEMS_PER_GALAXY 5 to 3, and the boon-kind guard it breaks | open | |
| 5 | ENGINE: world id gains a location component; save migration | open | |
| 6 | ENGINE: planet and act completion roll-up in commanders.js | open | |
| 7 | ENGINE: faction residency (2 powers share Proxima, 2 share Zeta) | open | |
| 8 | ENGINE: CAMPAIGN_ORDER replaces campTier rotation | open | |
| 9 | UI: planet view, location view, one more level of navigation | open | |
| 10 | NET: world id shape reaches the lobby and seat lens; protocol bump | open | |
| 11 | BOARDS: 28 new, batches A to E (see design doc) | open | |
| 12 | ART: planet cut plates need a location component in their keys | open | |
| 13 | ART: portraits for Swami, Ronald Dump, the Long Island protagonist | open | |
| 14 | STORY: beats for four campaigns whose act order changed | open | |

## Owner calls

| # | Question | Recommendation |
| --- | --- | --- |
| A | Mercury as a 7th Sol planet? Not in the owner's list; included because the budget allows it and w_mercury exists | keep |
| B | In-flight campaign saves on migration | retire the run, keep the profile (commanders, unlocks, soul vault) |
| C | Pleiades and Sirius demoted to bonus systems, boards re-parented into Proxima | as designed, nothing authored is lost |
| D | Earth continents: four, or add Oceania as a fifth | four |

## Notes

- Act 2 needs ZERO new boards: the fourteen re-parented Pleiades and Sirius
  boards plus the seven Proxima boards cover its eighteen locations.
- 34 of 62 locations already have a live board; 28 need authoring, all of them
  specified (C2.9 fails on a work item with no brief).
- The data is deliberately unwired: the live game still plays the five-system
  galaxy, so nothing in this batch can break a running campaign.
