# Owner notes, Session 26. THE TRACKED LIST.

Twenty items from the owner, received 2026-08-25. This file is the working
tracker: every item keeps its status here until it ships, and no item is
dropped silently. Statuses: `open`, `in-progress`, `shipped <commit>`,
`blocked <reason>`, `owner-call <question>`.

Two PERMANENT style rules arrived with this batch and are saved to memory:

1. **Never use the em dash.** Not in UI copy, not in docs, not in commits.
2. **Descriptions: mechanics first, then flavor.** Mechanically useful
   information leads; lore/flavor is brief, italic, underneath.

| # | Item | Status |
|---|------|--------|
| 1 | Move the top battle HUD (wave/hp strip) to the bottom of the window | shipped (HUD cards anchored to the bottom edge; the hint line moved to the top left) |
| 2 | Allow zoom/scroll OUT past the fitted view for a larger FOV in battle | shipped (the wheel's floor was clamped at 1 and could never reach the whole-board view the 0 key reaches; floor is now camMinZoom with ZOOM_OUT_EXTRA 0.82 margin) |
| 3 | Condense muster buttons to symbols only: flexing-arm for POWER, gold glyph + % + green up arrow for ECON | shipped (button face: count x, gold, flexing arm for POWER, gold+percent+green riser for ECON; the words moved to the tooltip; head strip symbolic too) |
| 4 | De-bloat descriptions everywhere: mechanics first, flavor brief + italic below; never the em dash | open |
| 5 | Rival ramp v2: sys1 rival capped at your tower/unit count minus 1, low-level commanders, slow AI; sys2 lifts caps, commanders at/below your level; sys3+ prestiged commanders, full loadouts, good AI | shipped (rivalStage 0/1/2 by solar system: stage 0 caps rival towers at yours minus one LIVE, one fewer soldier, tech capped at 4, thinks 1.7x slower; stage 1 lifts caps, tech at or below yours; stage 2 and every NG+ galaxy: prestiged commander, full draft. Verified: rival peaked at 2 towers against my 3 in a stage 0 match; null outside the campaign so pins and duels untouched) |
| 6 | Map previews show the rival commander AND that commander's loadout | shipped (rival's five drafted from worldLoadoutSeed, the SAME seed Game.start uses; measured 25/25 promises kept galaxy-wide; contested worlds skip the row since tri mode re-seats factions) |
| 7 | Multiplayer broken: join opens an empty UI. Regression, highest priority | shipped (renderMultiverse crash, my Session 24 edit called worldAllegiance with an out-of-scope variable in the wrong renderer) |
| 8 | Cross-system route lines: beating a planet on a line should let you travel that line; place the start far so most planets must be fought through | shipped (routeNeighbours resolves galaxy-wide; a system opens when its seat rule fires OR a drawn line ends on a world you conquered; verified: conquering gateway s0w0 opens system 1 and s1w0) |
| 9 | Spread planets wider in their system; remove the dotted circle; color the system TITLE by the dominant force (4/7 planets at 3 stars) | shipped (orbit rings 14/20/26 to 17/25/33, zero rnd draws moved; the dotted halo is deleted from both maps; the system title is coloured by the dominant force, four of seven at three stars makes it yours) |
| 10 | Research and build more unique map styles; current maps feel repetitive | shipped (six new boards, each on an engine capability no earlier map used: LANCE dead-straight 40x11, SKEW 17-vs-41 asymmetric fork, STRAIT lanes crossing the mirror axis with shared head-on tiles, LOOM interleaved combs, OSSUARY an authored no-reanimation rule, ATOLL a full enclosure ring. Saved campaigns pin their map pool (c.mapPool, migrated to the frozen 11) so old galaxies stay byte-identical: proven 50/50, while all six ids are reachable in new campaigns) |
| 11 | Introduce new enemy types more slowly: every 3 waves, only 1-2 new creatures per planet (bosses/minibosses exempt) | shipped (ROSTER_INTRO_EVERY 2 to 3, TIER0 gentler still; campaign remembers seenTypes and each planet fields at most TWO species you have never fought, bosses exempt; campaign-only so pins and duels see the full roster) |
| 12 | Show the sitting commander's portrait over the preview banner instead of the "commands this system" sentence | shipped (portrait pill rides the banner; the commands-this-system sentence is gone, the fact moved to the pill's hover) |
| 13 | Arena Modifier chip: stand out, clearer. Victory Boon: name only, hover reveals the effect cleanly | shipped (arena is an amber standout chip, boon a green name-only chip, both explain on hover) |
| 14 | The other effect chips above those two: make them clear as well | shipped (kind note, terrain note and sealed state are chips with hover text) |
| 15 | Remove the SOULS tooltip at the bottom of the preview | shipped (soul-note block deleted) |
| 16 | Preview clarity: show exactly which unit a 3-star rescues; ensure only ONE unit per planet | shipped (card names the ONE unit a 3-star rescues via the same rule recordWorld now applies; recordWorld grants one unit instead of two) |
| 17 | Unit roles: Infantry (marches, fights the first enemy unit it meets), Stealth (passes infantry, only towers hit it), Air (flies, skips the route, no collide) | open |
| 18 | Rename "clutch" to incubation/incubator in all Brood copy | shipped (incubator/incubating in doctrine desc, coach text, engine strip and codex) |
| 19 | Reduce entity counts: fewer enemies and fewer towers on the board over time | shipped (COUNT_SCALE 0.35 to 0.30 with the lost mass moved into per-body health, COST_GROWTH_STEEPEN 2.5 to 2.75, MUSTER_COUNT_MAX 6 to 4; a deliberate sim movement, pins re-baseline) |
| 20 | Use Huashu Design and high-level design skills for UI work | blocked: no skill named Huashu Design is installed in this environment; using the installed design agents instead. Owner: if Huashu is a plugin, install it and say the word |

## Notes per item (filled as work lands)

(running)
