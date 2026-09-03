# THE TRACKED LIST: the three-act campaign rework (Session 46)

Owner directive: the campaign moves from "one battle per world" to
act -> planet -> location, starting with Earth locations (Long Island first).
Design and impact analysis: docs/CAMPAIGN-REWORK.md. Structure as data:
js/campaign2.js. Gate: tools/probe-campaign2.js (10 checks).

Status: open | in-progress | landed <commit> | verified <commit> <check> | owner-call

| # | Item | Status | Check id |
| --- | --- | --- | --- |
| 1 | Design doc, impact analysis, asset schedule | landed | doc |
| 2 | js/campaign2.js: 3 acts, 18 planets, 63 locations, faction orders | landed | C2.1-C2.10 |
| 3 | tools/probe-campaign2.js, wired into gate.js | landed | 10 checks, 7 mutation tests |
| 4 | ENGINE: SYSTEMS_PER_GALAXY 5 to 3, and the boon-kind guard it breaks | open | |
| 5 | ENGINE: world id gains a location component; save migration | open | |
| 6 | ENGINE: planet and act completion roll-up in commanders.js | open | |
| 7 | ENGINE: faction residency (2 powers share Proxima, 2 share Zeta) | open | |
| 8 | ENGINE: CAMPAIGN_ORDER replaces campTier rotation | open | |
| 9 | UI: planet view, location view, one more level of navigation | open | |
| 10 | NET: world id shape reaches the lobby and seat lens; protocol bump | open | |
| 11 | BOARDS: 30 new, batches A to E (see design doc) | open | |
| 12 | ART: planet cut plates need a location component in their keys | open | |
| 13 | ART: portraits for Swami, Ronald Dump, the Long Island protagonist | open | |
| 14 | STORY: beats for four campaigns whose act order changed | open | |

## Owner calls, all SETTLED (Session 46)

| # | Question | Owner decision |
| --- | --- | --- |
| A | Mercury as a Sol planet | **bonus content.** Sol runs six planets; Mercury keeps w_mercury and sits in CAMPAIGN_BONUS |
| B | In-flight campaign saves on migration | **reset them.** The profile survives (commanders, unlocks, soul vault, ratings); the run does not |
| C | Pleiades and Sirius | **bonus content**, parked in CAMPAIGN_BONUS. 13 of their 14 boards moved with their powers and are Act 2 location boards; the Pleiades keep the Dust Wake (w_merope) as the bonus location board |
| D | Earth continents | **all seven.** North America, South America, Europe, Africa, Asia, Oceania, Antarctica. Earth is 12 locations |

Decision B is the one that unblocks the engine batch: because runs are reset,
the world-id shape can change without inventing a meaning for old star keys.

## Notes

- Act 2 needs ZERO new boards: the thirteen re-parented Pleiades and Sirius
  boards plus five of the seven Proxima boards cover its eighteen locations
  (the Pleiades keep the Dust Wake as the bonus location board; the Narrows
  and the Gate went to Act 3 with the pirates).
- 33 of 63 locations already have a live board; 30 need authoring, all of them
  specified (C2.9 fails on a work item with no brief).
- Parked places carry their reason in CAMPAIGN_BONUS and may not claim a board
  a campaign location uses (C2.10), so "bonus content" cannot decay into
  "content nobody can account for".
- The data is deliberately unwired: the live game still plays the five-system
  galaxy, so nothing in this batch can break a running campaign.
