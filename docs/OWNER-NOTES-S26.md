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
| 5 | Rival ramp v2: sys1 rival capped at your tower/unit count minus 1, low-level commanders, slow AI; sys2 lifts caps, commanders at/below your level; sys3+ prestiged commanders, full loadouts, good AI | open |
| 6 | Map previews show the rival commander AND that commander's loadout | shipped (rival's five drafted from worldLoadoutSeed, the SAME seed Game.start uses; measured 25/25 promises kept galaxy-wide; contested worlds skip the row since tri mode re-seats factions) |
| 7 | Multiplayer broken: join opens an empty UI. Regression, highest priority | shipped (renderMultiverse crash, my Session 24 edit called worldAllegiance with an out-of-scope variable in the wrong renderer) |
| 8 | Cross-system route lines: beating a planet on a line should let you travel that line; place the start far so most planets must be fought through | open |
| 9 | Spread planets wider in their system; remove the dotted circle; color the system TITLE by the dominant force (4/7 planets at 3 stars) | open |
| 10 | Research and build more unique map styles; current maps feel repetitive | open |
| 11 | Introduce new enemy types more slowly: every 3 waves, only 1-2 new creatures per planet (bosses/minibosses exempt) | open |
| 12 | Show the sitting commander's portrait over the preview banner instead of the "commands this system" sentence | shipped (portrait pill rides the banner; the commands-this-system sentence is gone, the fact moved to the pill's hover) |
| 13 | Arena Modifier chip: stand out, clearer. Victory Boon: name only, hover reveals the effect cleanly | shipped (arena is an amber standout chip, boon a green name-only chip, both explain on hover) |
| 14 | The other effect chips above those two: make them clear as well | shipped (kind note, terrain note and sealed state are chips with hover text) |
| 15 | Remove the SOULS tooltip at the bottom of the preview | shipped (soul-note block deleted) |
| 16 | Preview clarity: show exactly which unit a 3-star rescues; ensure only ONE unit per planet | shipped (card names the ONE unit a 3-star rescues via the same rule recordWorld now applies; recordWorld grants one unit instead of two) |
| 17 | Unit roles: Infantry (marches, fights the first enemy unit it meets), Stealth (passes infantry, only towers hit it), Air (flies, skips the route, no collide) | open |
| 18 | Rename "clutch" to incubation/incubator in all Brood copy | shipped (incubator/incubating in doctrine desc, coach text, engine strip and codex) |
| 19 | Reduce entity counts: fewer enemies and fewer towers on the board over time | open |
| 20 | Use Huashu Design and high-level design skills for UI work | blocked: no skill named Huashu Design is installed in this environment; using the installed design agents instead. Owner: if Huashu is a plugin, install it and say the word |

## Notes per item (filled as work lands)

(running)
