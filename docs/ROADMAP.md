# Cosmic Conquest — Living Roadmap

> **Read this first if work stops and resumes.** It carries the backlog, what is
> done, what is not, and the decisions already made. Update the status column as
> items land. Never delete an item — mark it DONE or move it to REMAINING.

**Repository:** https://github.com/majieddd/majieddd.github.io — the game is the site root.
**Artifact URL (always redeploy here):** https://claude.ai/code/artifact/71e2140b-c473-412b-a53d-da4f53fce652
**Build:** `node build.js` → `aegis-protocol.html` (standalone) + `aegis-artifact.html`
**Dev server:** `python -m http.server 8471 --bind 127.0.0.1` from the project root.

**Testing note:** the Browser pane does not composite frames, so screenshots time out.
Verify via `javascript_tool` — DOM inspection, `getImageData` pixel sampling, and headless
`Game.step(1/60)` loops. **Always cache-bust** with `aegis-protocol.html?v=N`; the raw
`js/*.js` files are cached hard and you will test stale code otherwise.

---

## STATUS BOARD

### P0 — Broken. All fixed.
| # | Item | Status | Note |
|---|---|---|---|
| B1 | Battle map too small, mouse offset, unplayable | ✅ | `draw()` was resetting the transform to `dpr` and dropping `viewScale`, so the world rendered cropped and every pointer coordinate was wrong. Fixed, upscale cap raised to 1.9×, HUD compacted 185px → 150px. Verified: 0px clipped on all six maps at 1366×768, pointer exact at 4 test tiles, world fills all four canvas corners. |
| B2 | EXTRACT & BANK did nothing | ✅ | The button was gated on `depth > 0`, so it never rendered on a fresh campaign. Now always shown. |
| B3 | Session gets slower over time | ✅ | `Meta.save()` serialised the entire root synchronously on every mutation — 1.93 ms/call against a 253 KB blob that only grows. Writes are now coalesced (400 ms) with a `flush()` on hide/unload. Storage measured at 3.8 KB on a fresh profile. |
| B4 | Loadout text overlapping on locked towers | ✅ | The grid now renders only owned towers, with a note pointing at the Soul Shop. |

### P1 — Gameplay changes. All done.
| # | Item | Status | Note |
|---|---|---|---|
| G1 | Start with only Bolt + souls for exactly 1 tower | ✅ | `STARTER_TOWERS = ['bolt']`, `STARTING_SOULS = 6`, unlock cost 6. Deploy now requires `min(5, owned)` rather than a flat 5. |
| G2 | Commanders locked behind souls | ✅ | One free per faction, the other 16 cost 12 souls (own faction) or 18 (outside it). The commander screen shows only what you own and defaults to your faction's. |
| G3 | Two active abilities, second locked | ✅ | 10 abilities, 5 offensive / 5 defensive. Q and E, plus a click bar with cooldown sweep. Second unlocks with a full tech chart or 8 souls. |
| G4 | Soul-shop hover preview showing the tower attacking | ✅ | Live canvas: the real sprite, marching dummies, the tower's own cadence and elemental projectile colour. Verified animating (6.7k lit pixels) and cancels its rAF on leave. |
| G5 | Animated post-match reward summary | ✅ | Staged timeline: stars stamp in, XP bar fills, level-ups punch, souls count onto the total, mastery chips fade in. Click to skip. Honours `prefers-reduced-motion`. |

### P2 — Cosmic Conquest
| # | Item | Status | Note |
|---|---|---|---|
| C1 | Rename + lore | ✅ | Title, wordmark, taglines. Full lore in `js/factions.js` (`LORE`). |
| C2 | Four factions with bonuses | ✅ | Verified live: Human 35 lives + 1.1× damage; Federation +1 start level; Xeno reanim 2.19×; Pirate 1690 gold. |
| C3 | Faction select showing bonuses | ✅ | Own screen, gates campaign start. |
| C4 | 5 commanders per faction, 1 free | ✅ | 20 total, each with a signature trait, 9-node chart and 2 abilities. Integrity-checked: no duplicate tech ids, no unknown abilities. |
| C5 | Galaxy map with star ratings | ✅ | 5 systems × 7 worlds on a golden-angle spiral, nebula wash, starfield, travel links, hover briefings, keyboard reachable. |
| C6 | 3 stars conquers a world | ✅ | `ratingFor()` — 3★ needs a win with ≥90% lives. Verified a 3★ win flips ownership. |
| C7 | Rival commanders expanding in parallel | ✅ | `advanceRivals()` runs after each victory; the summary reports what they took. |
| C8 | Seat worlds → take a system | ✅ | A seat battle is a duel: the holding commander fields their complete 9-node chart and BOTH abilities regardless of player progression, announced with a faction-coloured banner. Verified: rival arrives with 2 abilities and full tech. |
| C9 | Conquer every system = game complete | ✅ | `galaxyComplete()` + a GALAXY CONQUERED screen (faction sigil, systems/stars/percent, claim-and-advance). Payout now counts stars (2 each) and conquests (+3), not just depth. Verified end-to-end. |
| C10 | Multiplayer-ready data model | ✅ | Campaign stores only a seed plus `stars`, so a galaxy is reproducible from ~50 bytes. |
| C11 | Escalating galaxy tier | ✅ | Shipped Session 9, moved off REMAINING in Session 17. Claiming a galaxy still pays out and ends the campaign, and the next one rolls a fresh seed — but it now rolls it one TIER harder: `p.galaxyTier` increments on the claim (`js/ui.js`, the `#btn-gv-claim` handler), rides into the match through `campaign().tier` (`js/game.js`, `Game.start`), and adds **+30% enemy health per tier** in the one place health is defined (`Game.waveHpMul`) plus `musterHpMul`. The galaxy screen warns before you claim, and the wave preview reads the same function. |

### P3 — Presentation
| # | Item | Status | Note |
|---|---|---|---|
| U1 | UI/UX overhaul (huashu-design) | ✅ | Slop audit done: the ten left-rail card types now share a chamfered-corner treatment (one machined corner + a 2px top rule + a 7% colour wash) chosen for the military-hardware subject. Verified: no collapsed cards, no page scroll, content clear of the chamfer. |

---

## REMAINING WORK (next session starts here)

1. **Touch support.** Still mouse-only; every tooltip is `mouseenter`. The largest genuine
   gap left. Needs pointer events, tap-to-brief on the galaxy map, and a long-press preview.
2. **Spatial hash grid + sprite atlas.** Not needed at the wave counts the current curve
   reaches, but the first thing to do if enemy counts rise.
3. **Multiplayer.** The seed+stars data model is ready; everything else is future work.

> The old item 3 — "no escalating galaxy-2 difficulty tier yet" — was already shipped when
> it was written. Moved to **C11** on the status board above; do not re-plan it.

## SESSION 12 — NOTES ROUND 13 (all delivered & verified)

| Note | What was done |
|---|---|
| AI-drawn art now permitted | Local generation pipeline built: **torch 2.5.1+cu121 on the RTX 4080**, `diffusers` + **SDXL-Turbo** (chose it over ComfyUI+FLUX-Krea because the disk sits at 96% — 10GB vs 30GB for the same result). `artgen/generate.py` renders 25 assets (21 commander portraits, 4 faction crests, key art, nebula) with one shared style spine, caches them, and emits `js/artpack.js` as WebP data URIs. Consumers (`commanderPortrait`, faction crests, title emblem, page backdrop) prefer painted art and **fall back to the procedural SVG when the pack is empty**, so the game never depends on it. |
| Galaxy still clumped | Root cause was random angle AND random radius per world. Now deterministic: even angular spacing with a per-system phase, two alternating orbit radii (9.4 / 13.2), systems pushed to the frame corners, viewBox widened to `-4 -2 108 76`, halo 12.5→16. **Min world gap 3.02 → 4.57 units** (worlds are ~2 wide), min system gap 36.1. |
| 3-way only on special planets | One CONTESTED world per system, deterministic per seed, never a seat. Only those carry the confluence map (verified: 0 normal worlds use it). Shown on the map as a **split ring in both contesting factions' colours** plus a ⚔ mark, with a dedicated briefing block naming who fights whom. |
| Soul shop on commander screen | Button moved off the title panel into the commander screen footer. |
| Sevra skills "not working" | The ability worked (measured exactly 1.70×) — the **inspector was caching past it**: `inspectorKey()` ignored the pulse, so the panel showed pre-ability numbers for the whole duration. Pulse is now in the key, `syncLive` refreshes the panel, and an **ABILITY ACTIVE +N% DMG** banner explains the change. |
| Squish the numbers | `NUM_SQUISH = 2.5` divides HP and damage by the same factor, so **time-to-kill is unchanged** (measured 19 shots before and after). Wave-1 crawler 161→64 HP. HP is always a whole number; a connecting hit floors at 1 damage **after** mitigation (rounding beforehand distorted TTK ~15%). DoT ticks stay fractional by design. |
| 3-way interactions + UI | All three commanders now speak in the pre-battle card (3 portraits, 3 lines) and the third rival gets its **own HUD panel** with lives/gold/towers, greyed when eliminated. |
| Souls from stars; global unlocks | EXTRACT removed entirely. Stars pay on earn: **3 / 6 / 12** (doubling), plus **+40** for taking a solar system whole — paid inside `recordWorld`, reported on the reward summary. Soul-shop purchases moved to a **shared vault on the save root**, migrated from the union of existing profiles: unlock once, every profile has it (verified across two profiles). |

## SESSION 11 — NOTES ROUND 12 (all delivered & verified)

| Note | What was done |
|---|---|
| Redesign everywhere | Global nebula backdrop (layered radial gradients), one-voice screen headers, HUD rebuilt as a hairline cockpit strip (no floating cards), plus the r11 type/motion system now visibly carried by every screen. |
| Costs up again | Per-copy rate doubled (steepener 1.25→2.5: 5th bolt = 34× the 1st, was ~8.5×); board inflation 1.05→1.075. |
| Base level retrofits | Buying a base level now raises every PLACED tower to the new floor (verified 5× MK I → MK III), with a "+N TOWERS RAISED" floater. Base price also compounds +10%/level (5.2k at L3→L4 vs 44k at L5→L6). |
| Image generation | **No KREA/image tool exists in this environment** — stated plainly. Visual lift delivered procedurally: feTurbulence nebulae, 21 procedural SVG commander portraits, shaded world cores. |
| Post-battle routing | Defeat/victory both land on THE GALAXY (button renamed); a sworn profile auto-opens a fresh campaign under the same banner, so character select is never the landing page. |
| Soul shop = unlocks only | COMMANDER LEVELS and TOWER MASTERY purchase sections removed; commanders / second abilities / towers remain. |
| Star conditions on the map | Every world briefing lists ★ / ★★ (55% lives) / ★★★ (90%, conquers) with earned rows highlighted. |
| Galaxy map modernized | feTurbulence nebula clouds, curved constellation routes, faction-ringed shaded worlds, persistent star pips under every node (105 rendered), active-boons row in the header. |
| New maps + 3-WAY | THE EXPANSE (massive 36×20), THE RIFT (twin-choke 26×17), and **THE CONFLUENCE — a real three-commander engine mode**: 3 sides, per-side AI brains, Voronoi territory grid, 3-lane tri field, and every kill reanimating toward BOTH rivals (verified: 1 kill → exactly 2 queued, waves 12/12/12, rival elimination + last-standing win condition). |
| Resistant mobs + elements | SHARDLING (65% splash-resist, weak to storm) and BASALT STRIDER (slow-immune, weak to fire) in the wave tables; `splash:true` flag consumed in `takeDamage`; elemWeak riders (+pure damage with a WEAK floater) on 10 mobs — kit-building per map now matters. |
| Ability FX + portraits | Per-commander activation: pitched synth signature (roster-indexed), canvas ring (offense radiates / defense implodes) in commander colour, portrait flash strip. 21 procedural faction-silhouette portraits used on cards, detail, dialogue, flash. |
| Enemy dossiers | First-ever encounter pauses the war: animated live sprite, stats, traits, weaknesses/resists, ENGAGE. Persisted per profile (`seenEnemies`). |
| Pre-battle dialogue | 21 openers, faction reply pools, special-pair exchanges (Seraph↔Sevra, Rake↔Dregg, Vanta↔Cantor); VS card with portraits before every campaign battle, skippable, skirmish-exempt. |
| Boons on galaxy | Header chips with hover briefs. |
| TD research applied | Enemy dossiers (KR almanac), pre-battle dialogue (KR), star conditions (KR stars), curved-route star map — folded from the digests. |

## SESSION 10 — NOTES ROUND 11 (all delivered & verified)

| Note | What was done |
|---|---|
| Title layout | Wordmark first, then a designed SVG emblem (contested world, orbiting faction ring, opposing cyan/red lanes) under it; "THE AGE OF INTEGRATION" removed. |
| Readable text | The entire UI was aliased to a monospace token — the readability complaint in one line. `--mono` now resolves to Segoe UI (body), `--display` (Bahnschrift condensed) carries headings at weight 800 vs weight-300 wide-tracked labels, `--num` keeps true monospace ONLY for tabular numbers. |
| Upgrade Base Level | `S.baseLevel`: +2 max lives and reanimates +5% per level; every tower placed arrives at the base level — MK levels, then FREE specialisation choice past 3 (`pendingBranch`, `tierName` guarded), then real ascensions past 4. Cost = 80% × 5 × roster-average step cost (`baseLevelStepCost`), golden-exponent into ascend levels (measured 1.6k → 30k). Sidebar button with live afford state. Also finally wires Federation's ILLUMINATED and ORIN's FIELD WORKSHOP, which previously set flags nothing read. |
| Map-specific mobs | Each map declares `denizens` + `sigNote`; injected inside `waveDef()` so preview, AI model and spawn agree (verified parity). spine=sprinters/wisps, delta=menders/clusters, narrows=bulwarks/wardens, shattered=blink/wraith, crossroads=warchief/aegis, coil=jammers. |
| Haste vs slow | Additive: `slowEff = max(0, slow − haste)`, only surplus haste accelerates. Verified 100% slow + 33% haste → speed 0.33 exactly. |
| Prestige "doesn't work" | Root cause: **`window.confirm` returns false silently in the sandboxed artifact iframe** — prestige, extract and abandon were all dead in the hosted build. Replaced with an in-game `confirmBox` modal everywhere; zero `window.confirm` remains. Verified end-to-end through the real clickpath. |
| Stale loadout locks deploy | `sel.loadout` now resets on new campaign and profile switch, and `renderLoadout` filters to owned towers. Verified with a poisoned selection. |
| Design overhaul (huashu + 7 refs) | Three-agent digest of all eight reference repos → applied: two-face type system + numeric mono, 4px spacing tokens, modular scale, neutral chrome with faction colour reserved for faction-owned data, glow discipline (selection only), unified motion curve cubic-bezier(.16,1,.3,1), pressed/focus states everywhere, staggered menu entrance, screen transitions, `prefers-reduced-motion` honoured. |

## SESSION 9 — NOTES ROUND 10 (all delivered & verified)

| Note | What was done |
|---|---|
| Faction not locking / campaign not faction-scoped | Faction is now chosen ONCE per profile, permanently: `renderFactions` reroutes anyone with a faction; new campaigns auto-start under the same banner; the commander screen and soul-shop recruits are filtered to your faction + CADRE. Soul unlocks persist across campaigns as before. Verified: extract → re-play keeps xeno; faction screen unreachable. |
| Galaxy map squished (screenshot) | Spiral layout replaced with five fixed slots using the whole frame — min system distance 31.2 units (was a centre knot), orbits 7.5–11.3, halo 12.5, viewBox 66, map 72vh. |
| Rival tower variety parity | Rival fields exactly as many tower TYPES as the player; +1 after 2 conquered worlds; capped at 5. Measured 1v1 fresh, 3v4 after two conquests. |
| SP / MP / Options start screen | Three-button main menu. SP → profiles + BEGIN CAMPAIGN. MP → profiles + ENTER MULTIPLAYER → universe map (35 worlds, own seed) → click a world → relay search overlay → honest "no answer" → SKIRMISH THE GARRISON (a `skirmish:true` battle that provably never touches the campaign ledger). Options → settings. |
| Title copy | Logo colour moved to the subtitle line; both flavour lines and the credits strip removed. |
| Faction descriptions | One-line taglines (55–72 chars, were ~300) + drawn SVG crests per faction (reticle / sun / hex cluster / crossed sabres). Fixed a key collision where the new field shadowed the faction short name. |
| Upgrade grey-out while hovering | Costs are stamped on inspector buttons (`data-cost`) and `syncAfford()` re-checks every live tick — verified grey clears the moment gold crosses the cost. |
| Prestige | Maxed chart → PRESTIGE (confirm dialog): resets level+chart, grants a star (max 5), a stacking flat faction bonus (+4 lives / +4% dmg / +8% reanim / +120 gold per star), and +20% per star to every numeric talent value, rounded to whole percents in `foldTraits`. Verified: gating, reset, cap, dmgMod 1.34→1.41, reanim 2.90→3.54. |
| Menu slowdown | `Game.loop` kept simulating particles and DRAWING the finished battle's full entity set every frame behind the hidden menu — which is why a new match "fixed" it (start clears the arrays). The loop now idles completely in menu (measured 0 draw calls) and paints the 'over' state once. |
| Remaining work | Galaxy tier escalation is real: claiming a conquered galaxy raises `galaxyTier`; the next campaign spawns +30% enemy HP per tier, model and spawn verified equal (ratio 1.00). Tier chip on the map header. |

## SESSION 8 — NOTES ROUND 9 (all delivered & verified)

| Note | What was done |
|---|---|
| Galactic map larger / less clumped | System spread 16→49 radius (was 13→43), world orbits 6.4–11, coords clamped in-frame; map CSS 56vh→72vh, detail rail 340→296px. Min pairwise world distance 3.02 units; rendered 974×550 at 1366×768. |
| Gameplay maps clumped / slow | Unit volume roughly halved: `COUNT_SCALE` 0.68→0.35, `UNIT_HP_SCALE` 1.45→2.60 (fewer, individually stronger), spawn spacing 0.46→0.58. Peak enemies measured 106–121 vs 264–438 before. Per-kill bounty 1.7→3.2 base so halved kills do not halve income. |
| Starting damage smaller | `GLOBAL_DAMAGE_TUNE = 0.85` applied in `effDamage`/`effDamageFor`. Fresh bolt-only run dies at median wave 9. |
| Costs still too cheap | Per-copy growth steepened 25% of fractional part (×1.50→×1.63 … ×2.35→×2.69): 6th bolt = 14.5× the 1st (was 6.4×). Board inflation 1.018→1.05. `UPGRADE_COST_SCALE` 2.1→2.6 (MK II 126→156). |
| Faction sealed per campaign | `renderFactions` reroutes to the galaxy when a campaign is live; title-play skips faction when one exists; faction screen unreachable mid-campaign. |
| CADRE-only start; faction grants base commander; faction BEFORE commander | `blankProfile.cmdUnlocked = ['cadre']`. Title-play → faction screen (when no campaign) → `campaignStart` grants `freeCommanderOf(faction)` → commander screen. GO is denied until a faction is picked. Verified: fresh profile shows only CADRE; choosing Light grants SERAPH and auto-selects it. |
| Full re-verification | 4-batch parallel audit workflow over every historical note + all ROADMAP claims (see session log). |

### Session 8 audit results (4-batch parallel verification)
39 checks across every historical note and every ROADMAP claim: **36 clean, 3 confirmed
gaps, all fixed same-session**:
1. `wavePanel` omitted `UNIT_HP_SCALE` (preview understated unit HP 2.6× after the retune) —
   fixed at ui.js wavePanel; residual ~1.1× is the wave-start drift roll, inherent to preview.
2. Siren's charm path still double-applied `drift`/`mods` (the bug fixed in `reanimate()`
   survived here) — charm now passes `armorFlat` and no drift/mods; measured ratio exactly 1.0.
3. Three stale codex strings (80%→60% reanimate health; old curve numbers; ×1.15/×1.95
   growth claims) — now rendered live from `waveHpMultiplier` and `TOWER_TYPES`, so they
   cannot drift again. `.profile-row` added to the chamfer group (last left-rail holdout).

## COMPLETED SESSION 7b
- CADRE, the 21st commander: unaligned, always unlocked, even +6% baseline everywhere,
  STEADY AIM (offense) / ATTRITION FIELD (anti-reanimate defense), its own 9-node chart.
  `reanimResist` is a real trait applied in `reanimate()`.
- Field Manual rebuilt: The Galaxy (5 lore entries), Powers (4 factions), Conquest
  (stars/openings), Commander abilities (all 12), Elements, Reactions, Commanders (all 21) —
  seven new sections ahead of the original seven.
- Hover coverage completed: faction cards, commander cards (trait + both abilities + lock
  state), profile rows, soul-shop commander-level rows, soul-shop mastery rows (with live
  firing preview), loadout cards (live firing preview). One shared `bindTowerPreviews`.
- Galaxy header shows seats standing. Victory screen + star-weighted payout.
- Seat duels. Deploy defaults to your faction's commander if the commander screen was skipped.
- Removed ~200 lines of dead legacy renderers (`renderTheatreLegacy`, `showEndLegacy`).

---

## LORE — canon, do not contradict

**Setting.** The age of alien integration. Humanity has met alien life and found the
universe teeming with it. Using new-age technology, players travel to other worlds and
fight to take them.

| Faction | Colour | Character | Bonus |
|---|---|---|---|
| **Humanity** | cyan `#38e8ff` | Late to the stars, outnumbered, adaptable. Neither selfless nor devouring. | +10 lives, +10% tower stats |
| **Federation of Light** | yellow `#fbbf24` | Many benign species defending all life. Their tenet — surrendering your life eternally to the cause — is genuinely controversial: restrictive, cult-like, and it takes your free will. | +1 base level to all towers |
| **The Xeno** | dark purple `#7c3aed` | Not an alliance, an appetite. Annihilation, conquest, devouring. Purely selfish; they grow only themselves. | Reanimates 25% stronger |
| **The Pirates** | red `#ef4444` | Made of anything and everything, no allegiance, enemy to all. The creature swarms answer to them. Pirate worlds have pirate commanders. | +340 starting gold (one extra tower) |

**Campaign shape.** Choose a faction. Take worlds from opposing powers. 3-star a world to
conquer it for your faction. Rival AI commanders take worlds in parallel. Reach a commander's
seat and beat them to stop their expansion. Take a system, then the next. Take every system
and the galaxy is yours. Long term: persistent universe, multiplayer, continuous faction war.

---

## DESIGN DECISIONS ALREADY MADE (do not re-litigate)

- **Difficulty curve is piecewise** (`waveHpMultiplier`): ×1.26 waves 2–10, ×1.22 waves
  11–20, accelerating to ×1.85 past 20. Novice dies ~wave 10; fully levelled reaches ~22.
  Matches run 3–7 minutes. **Benchmarked.**
- **Soul levels are RETIRED** (Session 17). Session 11 made the soul shop unlocks-only and
  removed the only writer of `p.soulTower`, so `soulPower`'s +7.5% damage / +3.5% rate was
  unreachable for every profile created since — and the rival's mirror of it averaged an
  empty dictionary. The whole path is deleted rather than re-homed onto (fight-earned)
  mastery: re-homing is a live balance change to both calibrated pins, not a dead-code fix.
  **Progression weight is now mastery → talents, and souls → unlocks.**
- **`STAT_CEIL` in `applyTech`** — ratio stats add but cannot pass their meaning. Reverting
  makes Arc's chains amplify per hop (78 → 31,223).
- **Reanimates must not re-apply `drift`/`mods`** — `hpMul` already contains both.
- **`UNIT_HP_SCALE` applies in `waveProfile` and `wavePanel`**, not only `startWave`.
- **`Game.draw()` must use `dpr * viewScale`** — using `dpr` alone is the cropped-map bug.
- **`Meta.save()` is debounced.** Use `save(true)` only where a write must land immediately.
- **Elements:** every marking element has ≥3 towers. Kinetic and Radiant deliberately do
  not mark. Reactions need two *different* marking elements overlapping the same lane.
- **Rival parity:** arsenal size and tech depth mirror the player's, and EVERY gold sink
  the player has, the rival prices per gold too — build, upgrade, base level, muster,
  rubble clearance, relocation and RESONANT FIELD. A lever only one side can pull is a
  parity bug, not a difficulty setting.

---

## FILE MAP

```
index.html          markup, every screen
css/style.css       base theme
css/polish.css      polish layer, galaxy map, factions, abilities, reward summary
js/config.js        maps, core towers, enemies, waves, scaling, STAT_CEIL
js/factions.js      four factions, bonuses, lore                       [NEW]
js/towers2.js       elements, combo table, expansion towers, arenas, boons
js/abilities.js     10 commander abilities + runtime                   [NEW]
js/roster.js        20 commanders across 4 factions                    [NEW]
js/commanders.js    Meta: profiles, souls, unlocks, campaign, galaxy
js/audio.js         Web Audio synthesis + music scheduler
js/entities.js      Path, Enemy, Tower, Drone, Mine, Projectile
js/entities2.js     Minion, Barricade, expansion behaviours, sprites
js/ai.js            rival commander brain
js/galaxy.js        galaxy generation, stars, territory, rival expansion [NEW]
js/game.js          two-sided state, fixed timestep, rendering
js/ui.js            screens, HUD, galaxy map, soul shop, reward summary
js/main.js          bootstrap, keyboard (Q/E abilities), resize, visibility
build.js            inlines everything into the two HTML bundles
```

---

## SESSION LOG

### Session 7
Created this document. Fixed all four P0 bugs, delivered all five P1 items, and
delivered C1–C7 and C10. Full flow verified end-to-end per faction with zero console
errors; storage 253 KB → 3.8 KB.

### Session 7b
Closed every remaining board item: C8 (seat duels), C9 (galaxy victory), U1 (slop audit),
the CADRE baseline commander, the codex rebuild, and full hover coverage. Bundle 585 KB,
zero console errors across the pirate/xeno/human/light flows.

### Session 13 — the mechanics dossier, Krea 2, and the motion system

**The dossier.** `Tower Defense Mechanics Dossier and Master Index` (31pp, 75 games,
168 mechanics, 23 categories) was mined by four parallel analysts and adjudicated by a
fifth that verified every "we already have this" claim against real source lines.
Result: **16 already present, 10 unambiguous fits, 15 held as options.**
The 15 are written up in `MECHANICS-OPTIONS.md` — that file is the answer to
"save it for me to present as an option", and nothing in it was built.

**Shipped and verified this session (7 of the 10):**

| Mechanic | Source | Verified by |
|---|---|---|
| Interest on banked gold | Defense Grid | capped at 126 on wave 5 even against a 100k bank |
| Wave enraging | GemCraft: Frostborn Wrath | preview HP moved 64→119, cap 3 held, consumed on start |
| Finite block capacity | Arknights | cap 3, max held 3, **14 attackers overflowed past a full wall** |
| Escalation bidding | Orcs Must Die! 3 | 3 offered, 2 refused banked, draft widened 3→4 then expired |
| Tower relocation | Arknights | fee 209 charged, level/invested/damage kept, 4.5s dark then recovers |
| Rubble clearance | Broken Universe | lane tiles protected, 260→3046 compounding, capped, board +5 |
| Spatial land cards | Isle of Arrows | gated off rubble-free maps, deliver exactly 2 and 1 tiles |

**Still queued from the ship-now list (3):** MUSTER (offense-linked income, Legion TD 2),
aimed commander abilities delivering a construct (Kingdom Rush), and terrain nodes with
elemental affinity (Spirits of the Hellements). All three are M-effort and specified in
full — sketches live in the workflow journal at
`subagents/workflows/wf_33cabee9-19e/final.json`.

**Two bugs the tests caught, worth remembering:**
- `Tower.jammed` is a **getter over `jamTimer` with no setter** — assigning to it is a
  silent no-op. Relocation downtime looked applied and wasn't. Write `jamTimer`.
- `FIELD.terrain` is a **Set**, not an array. `.includes()` throws; use `.has()`.

**Rival parity.** Escalations hit the wave that reaches *both* commanders, so letting the
player alone pick which one lands is a real edge. Priced it: take the severe option and
you get the wider draft; duck it and every rival gets one instead.

**Art.** SDXL-Turbo produced a full 27-image pack (596 KB) that is live in the bundle and
verified — 27 well-formed WebPs, correct dimensions, none truncated. Krea 2 Turbo is the
upgrade: the `krea/*` repos are gated (401 anonymous, and this machine holds no HF token),
but `CalamitousFelicitousness/Krea-2-Turbo-Diffusers` is an **ungated diffusers-layout
mirror** of the same weights, and `diffusers 0.39` + `transformers 5.15` already ship
`Krea2Pipeline` / `Krea2Transformer2DModel` / `Qwen3VLModel`. 12.9B params at bf16 will not
fit 12GB, so `krea_gen.py` loads transformer and text encoder as 4-bit NF4.
Catalogue widened from 27 to **70** images: +9 world plates, +22 enemy dossiers,
+12 ability emblems. All three new surfaces are wired and degrade to the shipped
artwork when a key is absent.

**Motion system (huashu).** Installed `~/.claude/skills/huashu-design`. Folded the three
ad-hoc bezier variants onto a named set — `--e-enter` (0.16,1,0.30,1) for arrivals,
`--e-pop` (0.34,1.56,0.64,1) for toggles, `--e-tap` (0.22,0.90,0.30,1) for sub-200ms
feedback — and filled every bare `transition` that had been silently inheriting `ease`.
Verified: **zero un-curved transitions across every stylesheet rule.**

### Session 14 — the last three mechanics, the owner's design round, and real Krea 2

**Owner verdicts on the dossier mechanics (do not re-litigate):**
- Wave enraging APPROVED, renamed **RESONANT FIELD** (thematic; "Ionic Aura" was the
  alternative). Internal identifiers keep the ENRAGE_ prefix; every player-facing string
  says Resonant.
- Tower relocation APPROVED at a flat **33%** of invested (`relocFee: 0.33`).
- Rubble clearance and spatial land cards APPROVED as shipped.
- Interest, block capacity, escalation bidding: approved as shipped.

**The last three ship-now mechanics are IN** — authored by three parallel agents against
a traps brief, adversarially audited (anchors greped, both apply orders sandbox-tested),
then applied and test-run live:
- **MUSTER** (Legion TD 2): paid sends that also raise wave income. 0.6 damping and
  `reanimated:true` mirrored from reanimate; income sub-linear with a hard cap; cost
  plateaus at 3.1x (auditor-fixed from an unbounded escalator). 50/51 live assertions.
- **Aimed abilities** (Kingdom Rush): bulwark/smokescreen/broadside/ravenous now aim at a
  tile and drop a construct through one shared AbilityOwner. The rival AI — which had
  NEVER used abilities — now fires all twelve, and aims by walking forward along the
  densest attacker's own path. 36/36 live assertions.
- **Terrain nodes** (Spirits of the Hellements): 2-4 authored nodes per side, mirrored;
  build nodes lend an element, lane nodes half-prime crossings. On five maps the node
  element is one the local denizens RESIST — reaction enabler, not free damage.
  CONFLUENCE gets none (an x-mirror cannot make three lanes fair). 50/51 live assertions;
  the one failure was the TEST misreading the combo table (venom→void is ENTROPY;
  BLIGHT is void→venom — verified both directions correct in the game).

**Balance regression caught and fixed:** with muster live, fresh median fell 7 → 5 —
both brains bought four sends on three towers by wave 4 and died to each other. Fix:
a defence-first gate (`MUSTER_AI_MIN_WAVE 4, MIN_TOWERS 5, SAFE_LIVES 0.8`) and removal
of the desperate-multiplier death spiral. Measured after: **fresh 7/7/8/7/8, maxed 26-27**
— exactly the pre-mechanics curve.

**Design round (owner notes):**
- Title painting is now the FULL backdrop (scrim + emblem withdrawn) with a 214-star
  three-depth parallax universe that eases toward the cursor and shoulders stars aside
  near it. Runs only while the title is on screen; static under prefers-reduced-motion.
- Faction cards compacted (264px, was full-height), grid optically centred via
  `margin: auto 0`, crests grown 72→128px.
- Audio deepened: SFX transposed ~8 semitones down through one choke point
  (`SFX_DEPTH 0.62` in tone()/noise(), music exempt), master low-shelf +2.5dB @160Hz,
  high-shelf −3.5dB @5.2k, delay dampen 2400→1900, tempo 96→84, wider pad chorus.
- **Charset bug (was shipping):** build.js strips every `<meta>` for the artifact
  variant, which removed the charset; browsers fell back to windows-1252 and every
  ◈ ✦ ♥ ⚔ rendered as mojibake. A `<meta charset="utf-8">` is now re-prefixed to the
  artifact bundle. The word "stylesheet" in a CSS comment also tripped the build guard
  again (second occurrence of this trap).

**Art pipeline:** the `CalamitousFelicitousness/*-Diffusers` mirrors are MISLABELLED —
raw Krea tensor names, 0/430 overlap with diffusers' Krea2Transformer2DModel, which
silently initialises empty and dies on meta tensors. The real mirror is
**unsloth/Krea-2-Turbo** (188/189 overlap), downloaded to `artgen/krea2-turbo/` via
`local_dir` (the hub cache doubles 36GB on Windows — no symlinks). NF4 both models:
10.8/12 GiB after load. Art direction updated to the owner's brief: **Tyranny
painted-cutscene style × cyberpunk sci-fi vaporwave** (STYLE/NEG/FACTION_LOOK in
krea_jobs.py). 70-image catalogue queued.

**Krea 2 timing reality (measured):** one 1024px portrait = **4,974s (~83 min)** on the
RTX 4080 Laptop at NF4 with the text encoder on CPU (7.7 GiB after load, guidance off).
The full 70-image catalogue would take ~4 days, so the pipeline is now two-tier:
- `artgen/sdxl_all.py` renders the ENTIRE catalogue on SDXL-Turbo with the same
  Tyranny × cyberpunk-vaporwave prompts (seconds per image) — the shipping baseline.
- `artgen/krea_gen.py` upgrades keys underneath it: `--pack` prefers
  `cache_krea/<key>.webp` and falls back to `cache/`. Run it per-key or per-prefix
  overnight; every finished image silently improves the next build.
  Then: `python krea_gen.py --pack && node build.js` and republish.

Three Krea traps burned this session, all fixed in krea_gen.py: (1) with the text
encoder on CPU, `_execution_device` resolves to cpu and prepare_latents refuses a cuda
generator — pinned via a per-instance subclass property; (2) the unsloth conversion's
transformer config omits `is_distilled`, so the pipeline silently ran full CFG (double
cost + a negative-prompt encode on the wrong device) — pass `guidance_scale=0.0`;
(3) prompts must be embedded explicitly with `pipe.encode_prompt(prompt, device='cpu')`
and passed as `prompt_embeds`/`prompt_embeds_mask`.

First Krea sample (cmd_seraph): exactly the owner's brief — painted cutscene shapes,
holographic gold, neon rim light, no fantasy drift. Kept in cache_krea/ as the
art-direction reference.

**Session 14 close-out — the art pack shipped.** The catalogue prompt order mattered:
CLIP truncates at 77 tokens and SDXL-Turbo at guidance 0 ignores the negative prompt
entirely, so long commander subjects pushed the style tail off the cliff and RAKE came
back in medieval plate. Fixed by stating a compact style FIRST (`SDXL_PREFIX` in
sdxl_all.py) so truncation only ever eats redundancy. Full 70-image render: 47 seconds.
The lone Krea seraph is held back as `cache_krea/cmd_seraph.webp.ref` — one painterly
image inside a hard neon-comic set reads as inconsistency, not quality; upgrade whole
asset classes at once or not at all. Pack: 1,934KB across 70 images, zero malformed,
every surface verified lit (world plates, portraits, foe dossiers, ability emblems,
title). Bundle 2.7MB, step cost 0.073ms, zero console errors. Published.

### Session 14b — the faction crest overlap, and the audit it triggered

**The reported bug.** `.fac-crest` is sized 46x46 by its base rule for the small inline
SVG. Session 14 grew it to 128px WIDE and not tall, so the image's `height:auto` resolved
against the new width: a 128px picture in a 46px box, overflowing 58px straight over the
faction name, creed and blurb. Nothing clipped it. Fixed by moving width and height
together and making the image fill its box (`height:100%`) instead of sizing itself.
The short-viewport breakpoint got the matching height so it cannot regress at 104px.

**Because that bug came from appending an override rather than editing the original — the
pattern used all through Sessions 13 and 14 — the whole cascade was audited for siblings.**
Four analysts over four bug classes, then one adversarial verifier per candidate:
27 candidates, 26 confirmed real (several were the same defect seen through different
lenses). Measured and fixed the ones that mattered:

| Defect | Measured proof | Fix |
|---|---|---|
| `#screen-faction` had no scrollport | at 1024x680 BEGIN CONQUEST sat at y=732 in a 680px window, unreachable — campaign unstartable | added to the `overflow-y:auto` screen list |
| `.faction-wrap { height:100% }` | pinned to viewport, so content still could not grow past the fold (6px short after the fix above) | `height:auto; min-height:100%` |
| Three-way HUD min-content floor | HUD needed 1172px at 1024px wide; RIVAL II clipped off the right edge | `body.tri-field` narrows the panels to 148px; duo keeps its 232/190px |
| `body.has-keyart #screen-title { overflow:hidden }` | MY Session-14 regression: the shorthand reset the base `overflow-y:auto`, removing the title screen's only escape hatch | `overflow: hidden auto` |
| Chamfer clip-path ate the focus ring | `outline-offset:2px` sits outside the clip polygon, so keyboard focus was invisible on EVERY card button | `outline-offset:-2px` on the clipped set |
| `.cmd-icon` 30px slot | held 44px art — 14px overhang onto the name column (same bug class as the crest) | slot widened to 44px, `line-height:0` |
| Muster bar ate the sidebar | added ~162px unshrinkable; inspector ran 343px below the fold | shrink budget + `.panel-grow` floor; muster collapses its blurb under 780px tall |
| `.mu-ic` had no width | the three MUSTER rows stair-stepped ~3px each | fixed 20px icon column |
| Third rival rail hard-coded rose | discarded its faction colour | inherits `--cc` |

Verified after: at **1024x680** and **1366x768**, zero HUD overflow on both duo and tri,
RIVAL II visible, BEGIN CONQUEST reachable, crest overflow 0, faction grid still optically
centred (217/227) when it fits, zero console errors.

**Watch this pattern.** Late styling was added by appending override rules to the end of
polish.css. Any append that changes ONE dimension of a box the base rule sized is the same
bug. Two have now shipped (`.fac-crest`, `.cmd-icon`). When resizing something, edit the
original rule or set both axes.

### Session 15 — brand lock, the art pack completed, and the owner's feature round

**Brand kit written: `BRAND.md`.** The style has a name now — **Neon Reliquary** (Tyranny
painted-cutscene × gothic engraved linework × cyberpunk vaporwave) — with the palette,
per-class treatments, the prompt rules that were learned the hard way, and the rebuild
pipeline. Every future asset starts there.

**Art pack — 70 → 118 keys, every surface covered:**
- Faction crests regenerated **strict monochrome** in each faction's hue (engraved
  rose-window geometry). First pass produced an ivory Pirate crest because the colour
  word arrived too late in the prompt; the crest prefix now names the colour FIRST.
- Enemy dossiers regenerated **greyscale + one allegiance accent** (violet xeno, gold
  radiant, crimson raider, cyan spectral, none for machines/stone). First pass dropped
  "cyberpunk science fiction" from the prefix and the whole class came back as medieval
  knights — the setting must live in the prefix, not the tail. Lesson recorded in
  BRAND.md and sdxl_all.py.
- **7 missing enemies found and painted:** bulwark, aegis, juggernaut, wraith, revenant,
  mb_colossus, harbinger. Runtime check now reports zero missing.
- **New classes:** `planet_<kind>` (4 engraved planet portraits, clipped into the galaxy
  world discs under the owner ring), `galaxy_bg` (dim starfield behind the map), and
  `world_<map>_<faction>` (36 holder duotones, DERIVED by `derive_worlds.py` from the
  base plates — deterministic PIL, never generated). Briefing cards pick the holder's
  variant first and fall back to the neutral plate.
- Verified live: 118 keys, 0 malformed, 35/35 planet images drawn, holder plate picked
  correctly, backdrop applied. Bundle 4.1MB. Published.

**Owner decisions this round (do not re-litigate):** art style LOCKED as above; crests
monochrome; mobs greyscale-with-accent; defeat must NOT reset galaxy progression;
relocation 33%; RESONANT FIELD naming.

**In flight (workflow wf_0dfe1688-0a5, relaunched after a usage-limit kill):** three
authored+audited patches — (A) MUSTER loadouts unlocked by saving each world's denizens,
with baseline income shown and musters adding an additive PERCENT; (B) GOLD_SQUISH ÷8 so
the cheapest tower is single digits while the curve holds (mirror-AI fresh median must
stay 7±1); (C) defeat keeps the galaxy, two-column battle sidebar with canvas viewport
following, and the galaxy art hooks (the art hooks part was done inline this session —
the auditor should treat those anchors as already-applied).

### Session 15 — MUSTER DETACHMENT + percent income (Feature Bundle A)

- **Unlocks by conquest.** `Meta.recordWorld` conquering a world (3★, first time)
  SAVES its map's `denizens` into the shared vault list `vault().musterUnlocked`
  (migrated on read, baseline `['crawler']`). `musterSendable()` refuses bosses,
  `mb_*`, and anything with `lives > MUSTER_MAX_LIVES (3)`. The reward summary
  prints DENIZENS SAVED.
- **Detachment.** `p.musterLoadout` (≤ `MUSTER_LOADOUT_SIZE` 3, default first
  unlocked, normalised on read via `Meta.musterLoadout()`). Picker strip on the
  loadout screen (`#muster-loadout`, `renderMusterLoadout`).
- **Derived tiers.** `MUSTER_TIERS` is gone. `musterTierFor(id)`: count =
  clamp(round(32/√hp), 1, 6); cost and incomePct linear in mass = hp×count,
  pinned so 4 crawlers = 0.56× reward / +5% (the old SKIRMISH row). Bands by
  mass keep the SKIRMISH/ASSAULT/SIEGE labels. `Game.setMusterLoadout` derives a
  side's tiers ONCE at start; sidebar, spawn and brain read `Game.musterTiers`.
- **Percent income.** `S.musterIncome` is an additive PERCENT, flat per buy (no
  falloff), capped at `MUSTER_INCOME_CAP_PCT` 0.60; payout = round(waveReward ×
  pct). Header reads `BASE +◈N/wave · MUSTER +P%`. `MUSTER_INCOME_FALLOFF` and
  `MUSTER_INCOME_CAP_FRAC` removed.
- **Rival parity.** `AI.pickMusterLoadout(pool, size)` drafts light/mid/heavy
  from the same vault, never more picks than the player; the brain iterates its
  own derived tiers and values income as gain × `MUSTER_AI_HORIZON_WAVES` (8) ×
  `MUSTER_AI_INCOME_WEIGHT` (0.275) — product 2.2, the old calibrated weight.
  `musterSane` gate untouched.
- **Watch:** flat stacking is stronger than the old falloff; if both brains start
  over-mustering, the first lever is `MUSTER_INCOME_CAP_PCT`, not the gate.

### Session 15b — the three feature patches applied

Applied in the audited order **uxgal → muster2 → econsquish** (uxgal MUST precede muster2:
muster2 rewrites the `#muster-bar, #ability-bar` rule that uxgal's shrink-budget anchor
contains). Zero MISS across all three; all 16 modules parse; bundle 4.13MB.

Note: `uxgal.py` does not implement `--check`, so passing that flag applies it for real.
Harmless here (it was slot 1 and its hardened patcher exits non-zero on any miss), but do
not assume a dry-run flag exists on a patch you did not write.

**Test results:** muster2 92/92 · econsquish 125/126 · uxgal 55/56.
Both "failures" were the same deliberate change, plus one harness artifact:
- Two assertions pin the OLD muster calibration (`horizon 8 x weight 0.275 = 2.2`). I
  retuned the horizon to 5 on measurement (below); the assertions assert the old constant.
- `inspectorStartsUnderBase` wants the inspector to begin before the shop panel ends. The
  harness battle has an empty 37px shop; **with a real five-tower loadout it passes**
  (verified: shop 267px, insp.top 259 < shop.bottom 477).

**Balance, measured.** With everything applied, fresh held at 7 but maxed fell 26-27 -> 23.
Isolated it by freezing `Game.canMuster`: **without muster, maxed returned to exactly 27**,
so the economy squish is curve-preserving and the loss was entirely the AI over-buying
sends in waves 4-6 and finishing one tower light — it killed the rival no faster for it.
Dropped `MUSTER_AI_HORIZON_WAVES` 8 -> 5. Re-measured over 7 fresh and 6 maxed runs:
**fresh median 7 (mean 7.4, every run under wave 10), maxed median 27.** Both pins restored.

**Owner asks verified live:**
- Muster bar now reads `BASE +◈72/wave` and `MUSTER +0%`; a send adds `+5% (+◈4/wave)` —
  additive percent, hard-capped at `MUSTER_INCOME_CAP_PCT`.
- Conquering a world SAVES its denizens: recordWorld returned `saved:['jammer','sprinter']`
  and the shared vault went 1 -> 3 unlocked. Loadout holds `MUSTER_LOADOUT_SIZE` 3.
- Economy squished ÷8: Bolt 115 -> 14, MK II 60 -> 8, wave-1 reward 119 -> 15, growth
  ratios untouched (w10/w1 = 16.07, w20/w10 = 5.20).
- Defeat KEEPS the campaign, galaxy and stars; `campaignEnd` now fires only from the
  voluntary abandon confirm. Rivals still advance on a loss, so it still costs something.
- Sidebar is a 580px two-column grid above 1240px wide (areas: wave/abil, shop/base,
  shop/insp, muster/insp) falling back to one column below; the canvas follows the live
  wrap width (measured scale 0.623 -> 0.473 as the sidebar widened). The inspector's
  scrollport clips and scrolls it to the sidebar floor.

**Dev server note:** the harness `preview_start` reused a cached server rooted in another
project, and `file://` is blocked. Serve the game with
`python -m http.server 8477` from the TowerDefense directory and load
`http://127.0.0.1:8477/aegis-protocol.html`.

### Session 16 — owner round: souls, muster payoff, title nebula, 2.5D galaxy, dossier art

**Souls (owner-set).** A map now pays **twice the stars earned** — flat 2/star, so a clean
sweep is 6 instead of the old 3/6/12 ladder's 21. Verified: 1 star -> 2 souls, 3 stars -> 6.
`SYSTEM_BOUNTY` scaled 40 -> 12 to keep its old ~2-worlds weight instead of dwarfing every
world. Shop costs left alone deliberately: a conquered world now equals exactly one
`TOWER_UNLOCK_COST` (6), which is the pace the shop was priced for.

**Muster payoff (owner-set).** Income roughly TRIPLED — `MUSTER_INCOME_BASE` 0.03 -> 0.09,
`PER_MASS` 0.00008 -> 0.00024, so a crawler pack moves +5.0% -> +14.9% of a wave reward.
`MUSTER_INCOME_CAP_PCT` 0.60 -> 1.00 so the ceiling does not eat the third purchase.
**Reanimation now stacks onto sends**: health already did (musterHpMul multiplies by
mods.reanim); added the per-reanimate GOLD traits paying per unit sent, and the
double-reanimate chance rolling per unit exactly as it does on a kill.

**Title screen (owner-set).** The painted key art is GONE as a backdrop. The screen is now
a pure CSS nebula — four layered radial clouds in the brand hues over void black, plus a
blurred drifting cloud layer (46s, disabled under prefers-reduced-motion) and a vignette —
with the existing cursor-reactive starfield over it. `has-keyart` is no longer set;
`--art-title` is still published for anything else that wants the painting.

**Galaxy map — clumping fixed, then made 2.5D.**
- ROOT CAUSE of the overlap: the y offset was squashed TWICE (×0.72 in generation, ×0.64
  again at render), so a 13.2-wide orbit was only 6.1 tall and seven worlds bunched into a
  flat ellipse. Generation now divides by `GX_RENDER_SQUASH` so orbits are round on
  screen, uses THREE rings and the golden angle instead of two alternating radii, and the
  system slots are pushed further apart. **Measured: minimum world separation 4.17 -> 5.83,
  colliding pairs 8 -> 0.**
- `GalaxyFX` (js/ui.js) turns the map into a drag-panned 2.5D viewport: the SVG lies on a
  CSS `perspective: 1400px` + `rotateX(16deg)` plane, a Canvas2D starfield of 280 stars at
  three depths sits behind it and pans at a FRACTION of the plane's rate (that parallax is
  what sells the depth), drag pans with momentum, the wheel zooms about the cursor, and
  panning is clamped so the map cannot be thrown off its own viewport.
- **On three.js** (the owner suggested it): declined deliberately. The game inlines into
  ONE self-contained HTML file that must run from `file://` with no network, and the
  artifact CSP blocks CDNs — a ~600KB WebGL library is the wrong trade for what is
  geometrically a tilted plane. The CSS-3D + Canvas approach costs ~9KB.
- Verified the risk: **all 12 sampled worlds hit-test correctly through the 3D transform**,
  a click opens the briefing, and a drag does NOT select a world (guarded by a movement
  threshold in a capture-phase click handler).

**Enemy dossier art rebuilt.** The owner flagged the crawler as "not a crawler". Two
prompt failures found and fixed, both class-wide:
1. `cutscene illustration` pulled every dossier into a SCENE — wide shots with terrain,
   vehicles and humans for scale, so no subject was legible on a 224px card. The foe
   prefix now demands a single isolated specimen filling the frame.
2. The humanoid mobs drifted back to medieval knights. The negative prompt is INERT at
   guidance 0, so "never medieval plate, never a sword" had to be said POSITIVELY.
All 29 dossiers regenerated; they now read as the machine constructs the new lore wants.

### Session 17 — rival parity and side-correctness (Domain B)

- **Land cards address a SIDE.** `apply(m, s)` always received the drafting Side; SAPPER
  CORPS and SURVEY TEAM were the only cards that ignored it, calling the bare global
  `Game.grantClearances(n)` — which read `FIELD.bases[0]` and `ownsTile(0, …)`. A rival's
  draft therefore demolished rubble beside the PLAYER's base and spent the PLAYER's
  allowance doing it. Now `Game.grantClearances(s.index, n)`, and `canClear` /
  `clearCostNow` / `clearLimit` / the ledger are per side: `Side.cleared` is the
  allowance, `Game.clearedTerrain` stays as their union because the board has no owner.
- **One clearance price.** `Game.clearCostAt(side, n)`; the rubble panel's "next costs"
  line used to quote the raw `clearCost()` and drop the 35% SAPPER discount the player
  had just bought. `CLEAR_COST_FLOOR` names the old bare `10`.
- **RESONANT FIELD is per side, and the rival can bid.** `Side.enrage`,
  `enrageCost(side)`, `buyEnrage(side)`; `startWave` builds one hp/bounty pair per side
  and stamps each side's spawn entries with its own. Composition, count, lane and instant
  stay identical for every side — only the charge a commander paid for rides its own
  lane. `AI.bestAction` has an `enrage` candidate gated on measured board headroom. The
  "✦ FIELD RESONATING ×N" banner now reads `enrageSpent` — it could never appear before,
  because the charge is zeroed by `startWave` and the panel read the live counter.
- **The rival clears rubble and relocates.** `clear` and `relocate` candidates in
  `AI.bestAction`, priced per gold like every other action, with dispatch arms in
  `AI.update`. `AI.chooseMod` scores `sappers`/`surveyors` against free ground instead of
  letting them fall to `default: 50`.
- **Soul levels deleted.** See the design-decisions list above.
- **Calibration, measured A/B against the pristine bundle** (same harness, same seeds,
  same pinned five `bolt/cryo/mortar/flak/beacon`): fresh **6/6/7/8/6 → 6/6/7/8/6**, bit
  identical; deep **28/29/27/27/22 (median 27) → 27/28/28/27/22 (median 27)**. Every new
  AI spend is gated above the fresh death band (`AI_CLEAR_MIN_WAVE` 8,
  `AI_RELOCATE_MIN_WAVE` 10, `AI_ENRAGE_MIN_WAVE` 12). This harness reads the fresh
  median one wave under the documented 7–8 on BOTH bundles — a seeded-RNG offset, not
  drift. Three deep matches on SHATTERED: the rival demolishes 2–3 tiles and re-sites
  1–3 towers per long match.
- **`covMul` saturates and hid both new levers.** It clamps at 1.9 above ~30 coverage, so
  a covMul-based uplift reads the best rubble tile and the best free tile as an exact
  wash on every rubble map (shattered 93.4 vs 97.5, narrows 92.2 vs 73.4, coil 104.4 vs
  102.9 — all ratio 1.000). The clearance and relocation branches compare **raw**
  coverage; with `covMul` they fired zero times in a full match. Anything else that wants
  to rank two GOOD tiles has the same trap waiting for it.

### Session 16c — MAP OVERHAUL + TRI-BATTLES (Domain C)

Nine boards became fifteen, and every one of them now has a different SHAPE of
decision rather than different scenery. Measured with the geometry harness
(buildable tiles per side that actually see something marching at that side):

| map | size | lanes | useful tiles/side | signature |
|---|---|---|---|---|
| spine | 28x15 | 1 | 126 | **UNCHANGED** — the calibration board |
| delta | 28x17 | 2 | 124 | two mouths, ground split by a bank |
| narrows | 26x13 | 1 | 59 | three alcoves, no fallback |
| shattered | 28x15 | 1 | 82 | four islands, one long fall |
| crossroads | 30x15 | 2 | 106 | two lanes, two crossings, a monument |
| coil | 28x15 | 1 | 98 | longest lane (71), crossed by its own exit |
| expanse | 36x20 | 2 | 187 | vast, thin cover everywhere |
| rift | 26x17 | 2 | 108 | one throat, taken twice |
| lattice | 32x19 | 3 | 166 | THREE lanes, one gate |
| causeway | 30x15 | 2 | 69 | one strip, dead centre, no second pass |
| anvil | 22x21 | 1 | 66 | shortest lane (19), terraced |

**Tri boards: four, and all four are fair now.** Fairness = the ratio of the
smallest to the largest per-side useful-tile count. CONFLUENCE shipped at
**0.645** (side 2 had a 10-tile lane against 19, and the board was not even
left-right symmetric: bases at x=5 and x=25 on a 30-wide field).

| tri map | size | fairness | note |
|---|---|---|---|
| confluence | 31x25 | 0.965 | radial star, rebuilt on an odd width |
| crown | 35x27 | 0.951 | walled ring over the spawn, three doors |
| carousel | 33x29 | 0.976 | three hooks, three islands |
| orrery | 33x29 | 0.971 | nested rings, six gaps, contested annulus |

Engine work this needed: tri boards can carry NODES (authored as a triple, one
tile per commander, dropped whole if the tiles are not in three different
territories); a Voronoi TIE is no-man's land instead of a gift to side 0; every
side's lanes are unbuildable (side 2's corridor was buildable); the third lane
is drawn and flow-dashed; the thumbnail draws all three lanes and no longer
paints a duo neutral band across a tri board.

`CONTESTED_PER_SYSTEM = 2` — two three-way worlds per system, each on a
different tri board, deterministic from the system index (not from rnd(), so
nominating a second world cannot shift every later world's roll).

**Balance:** SPINE is byte-identical, so the mirror-AI pins (fresh median 7,
maxed 27) stand. Every other board moved and none of them is the harness board.

**Art keys still to render:** `world_lattice`, `world_causeway`, `world_anvil`,
`world_crown`, `world_carousel`, `world_orrery` (plus the 4-faction duotones
that `derive_worlds.py` derives from each).

### Session 16b — TOWER TECH ORIGINS (Domain A)

Every tower now declares an `origin`, and an origin is a mechanic rather than a
label. Roster went 32 → 39.

| Origin | Towers | Gate | The mechanic (engine-read) |
|---|---|---|---|
| **HUMAN** 10 | bolt cryo mortar arc flak rampart arbalest + **canister reclaimer quartermaster** | open to all | **ADAPTIVE MOUNTS** — attunes to a build node of ANY element, not only a matched one. The only origin covering all seven elements. |
| **FEDERATION** 7 | beacon prism chrono shepherd ward + **custodian concord** | sworn Light only | **SUPPRESSION** — a hit strips `ORIGIN_LIGHT_STRIP` of the target's magic, splash, DoT and ELEMENTAL resistance for `ORIGIN_LIGHT_SUPPRESS`s (never armour), and Light towers set `jamImmune` on themselves. |
| **XENO** 7 | toxin siphon executioner siren alchemist reckoning + **ichor** | sworn Xeno only | **PUNISH** — pure rider scaling with how wounded the target already is. The one mechanic no other origin gets. |
| **PIRATE** 7 | pyre tether sapper saboteur glaive cyclone capacitor | sworn Pirate only | **OVERLOAD** — `ORIGIN_PIRATE_PROC` chance (gated by `procCd`, or a 60 Hz beam turns variance into a flat buff) for ×`ORIGIN_PIRATE_MULT`; every proc banks heat and `ORIGIN_PIRATE_HEAT_MAX` of them **jams the tower** (`jamTimer`, never `jammed`). |
| **ROBOTIC** 8 | railgun singularity vault dronebay foundry echo quake + **pylon** | open to all | **LATTICE** — no proc at all. Robotic towers within `ORIGIN_LATTICE_TILES` link, a build node counts as one link, PYLON lends `latticeBonus` more; each link pays flat damage and rate up to `ORIGIN_LATTICE_MAX`. |

- **Lattice counting reuses `Game.recomputeAuras`** — the pass that already
  walks every tower and already ends by recomputing each one. No second
  traversal, and relocation/sale/base-level retrofit pick up new counts free.
- **One per-hit hook**: `Tower.originStrike` off `registerDamage`, the single
  point every attack path already funnels through with tower AND enemy in hand.
  `effDamage` was rejected as the hook — it has no target, and two origins are
  defined by the target's state.
- **Gating decision (do not re-litigate).** HUMAN and ROBOTIC are unlockable
  always: robotic is nobody's, human hardware is the galaxy's common currency —
  and decisively, `STARTER_TOWERS` is human, so gating it would brick a fresh
  Federation/Xeno/Pirate profile on its first purchase. The shop SHOWS locked
  entries with `⊘ SWORN TO <POWER> ONLY`. Anything already unlocked stays
  unlocked; `Meta.towerOriginLock` decides what may be BOUGHT, never what you own.
- **Rival parity.** `AI.pickLoadout(map, diff, pool, faction)` and
  `rivalArsenal(..., faction)` filter to the same three legal origins the player
  has and seed one own-power tower per two staples; six origin cores were added;
  `utilityValue` is now `roleValue + originValue`, both call sites pass the spot,
  and `bestSpotFor` biases robotic placements toward linkable tiles.
- **Only two re-themes were needed** (assignments were chosen to fit existing
  mechanics): SINGULARITY reads as a reverse-engineered Federation core, PYRE as
  jury-rigged scrap.
- **BALANCE — NOT RE-MEASURED.** The pins (fresh median 7, every run under 10;
  maxed 27) must be re-run on the mirror-AI harness. Levers in descending order
  of expected effect: `ORIGIN_XENO_PUNISH` (0.30), `ORIGIN_LATTICE_DAMAGE`
  (0.05), `ORIGIN_PIRATE_PROC` (0.22), `ORIGIN_LIGHT_STRIP` (0.40). Symmetry
  holds — both commanders draw from the same origin pool — so any drift is
  absolute power against the neutral swarm, not an asymmetry.

### Session 16c — the content overhaul applied, and the completeness sweep

**Applied in the audited order** maps -> techorigins -> enemylore -> gap-ui -> gap-parity
-> gap-desync. The order mattered: enemylore rewrites every map's `sigNote` and inserts a
`roster:` line inside each map literal, which invalidates maps.py's whole-literal anchors.
**maps.py is NOT atomic** — in a bad order it writes the files that succeed, `node --check`
still passes and `node build.js` still succeeds, shipping a bundle that boots with 9 maps
and `TRI_MAP_IDS = ['confluence']`. Only reading the anchor report catches it. Always read
the report, never trust a successful build.

**Two collisions the audits could not have caught** (they sandboxed each workflow's trio
separately, and gap-parity's own audit died on a usage limit):
1. `gap-desync` anchor 14 quoted `inspectorKey` verbatim; techorigins had inserted the
   lattice/heat riders into it. Re-targeted onto the post-techorigins bytes. gap-desync is
   two-phase, so it wrote nothing and no repair was needed.
2. `gap-parity` converted startWave to PER-SIDE `hpMuls[]`/`bountyMuls[]` and updated the
   miniboss push but not the main group push, which still referenced the deleted scalars.
   `hpMul is not defined` on the first wave of every battle. Fixed.

**The balance scare that was not one.** After the content landed the pins read fresh 5 /
maxed 18 against 7-8 / 26-27. Isolated it: the harness passed `TOWER_ORDER.slice(0,12)` to
`pickLoadout`, but `pool` only sets a BUDGET — it never filtered cores. The origins patch
reordered TOWER_ORDER, so that slice produced a different 12-tower shelf in which only the
weak "ground war" core was viable. **Re-baselined the harness on a fixed representative
loadout** (`bolt/cryo/mortar/flak/beacon`): fresh median 7 (all under 10), maxed 26-27.
Pins hold. I briefly added quality-ranked core selection, measured that it changed nothing
here, and REVERTED it rather than ship an unmeasured AI change.

**Content now shipping:** 15 maps (4 tri, 2 contested worlds per system), 39 towers across
5 tech origins (human 10, robotic 8, light/xeno/pirate 7 each, every def carries `origin`,
soul-shop gated by sworn faction), 49 enemies (29 Vigil machines + 20 faction troops, 5 per
power), 8-type rosters per map with one new type on waves 1,3,5,7,9,11,13,15 and bosses
exempt.

**Art:** 176 keys. Extended the catalogue for the new content — 20 faction troops (greyscale
carrying their OWN faction hue, since these are somebody's soldiers rather than neutral
machines) and 6 new world plates, plus 60 derived holder duotones. **Verified zero missing
art keys** across every foe, world, holder variant, commander, crest, ability and key-art
lookup the UI performs, and zero malformed WebPs.

**Faction crests forced on-hue.** `derive_crests.py` tints the generated shape onto the
exact faction ramp rather than trusting the prompt: measured 187.4/41.7/261.5/0.2 against
targets 186.9/43.3/262.1/0.0 — all within 1.6 degrees, where the audit had found human
42.4 degrees off (green) and xeno 56.3 off (pink).

**Planets:** 4 kinds -> 12 variants, chosen deterministically per world id so a system reads
as distinct places and a world always shows the same planet. 10 distinct images across 35
worlds.

**Dialogue.** The exchange used to paint every line at once behind a CSS delay while the
button was already live, so it read as a block. It now opens on a SITUATION — the world by
name, the ground, and who holds the register with the Vigil answering to neither side —
then lands one line at a time on a 1.9s beat with the speaking commander lit and the others
dimmed. The button reads SKIP until the last line lands (skipping LANDS the remaining lines
rather than discarding them), then BEGIN THE BATTLE.

`NOTE-LEDGER.md` records every owner note from Sessions 13-16 with its verification status.

### Session 16d — three deferred defects closed, and a full adversarial review

The content agents flagged defects they did not fix. All three were verified real by
execution and are now closed:

**1. THE GALAXY SEED DID NOTHING.** `galaxyRng(seed)` ran `seed >>> 0` on a STRING, which is
0 for every string, so `|| 1` fired every time and **every galaxy ever generated used the
identical stream** — same five systems, same worlds, same maps, forever. Any map landing in
an unreached slot was unreachable content: THE ANVIL never appeared in 14,000 generated
worlds, and RIFT was orphaned the same way before it. The seed is now hashed (FNV-1a) to an
integer first. Measured after: five seeds give five different streams, the same seed still
reproduces exactly, galaxies genuinely differ, **all 15 maps reachable** (anvil 151 uses
across 60 galaxies, was 0), and 2 contested worlds per system survives the reseed.

**2. DEFENCES DID NOT SCALE WITH THE GALAXY TIER.** `waveScaled()` — which sets barricade
health and minion output — carried wave, difficulty and UNIT_HP_SCALE but NOT the
galaxy-tier term that `Game.waveHpMul` owns. Enemies grew 1.9x by galaxy IV while walls
stayed flat, which does not make a tier harder, it deletes RAMPART and FOUNDRY from the
roster. Now in step: wall ratio 1.90 against enemy ratio 1.90. A maxed run at tier 2 still
reaches wave 26.

**3. THE TIER TERM HAD A THIRD COPY.** `musterHpMul` open-coded
`waveHpMultiplier x difficulty.hp x UNIT_HP_SCALE x (1 + 0.3 x galaxyTier)` instead of
calling `Game.waveHpMul`. Reduced to `this.waveHpMul(wave) * (1 + drift.hp)` — one
definition, which is the whole point of having introduced it.

**Pins after all of it:** fresh median 6-7 with every run under wave 10, maxed 26-27 at
tier 0 and 26 at tier 2. Step cost 0.133ms on the largest tri map. Bundle 5.7MB.

**Adversarial review commissioned** (wf_ee41dd6a-910) over five disjoint surfaces, because
several safeguards did not run this session: `gap-parity.py` was applied with NO AUDIT (its
auditor died on a usage limit, and one integration bug — `hpMul is not defined` on the first
wave of every battle — escaped it and was caught only at runtime), the two content workflows
sandboxed their own trios but never each other's, and the deferred defects above were fixed
by hand without review. Surfaces: the unaudited patch, cross-patch integration, content
integrity, every owner note re-verified independently, and runtime/save robustness.

### Session 17 — the adversarial review's verdict, and two game-breakers

The full review (wf_ee41dd6a-910, 53 agents) returned **48 candidates, 43 confirmed by
independent verification, 5 refuted**. Both BROKEN findings were reproduced by EXECUTING
the real modules headless, not by reading, and both are fixed:

**1. Selling a tower armed for MOVE burned unbounded gold.** MOVE and SELL sit side by side
in the same inspector. `Game.sell` cleared `this.selected` but never `this.movingTower`, and
**nothing in the codebase ever sets `dead` on a Tower** — all 18 writers of that flag are
enemies, projectiles or constructs — so both downstream guards (`!movingTower.dead` in the
click handler and `!t || t.dead` in `relocate`) were vestigial and could never fire. The
reviewer's executed repro: build a bolt, upgrade twice, arm MOVE, sell it — gold returns
correctly and `movingTower` still points at the removed tower. The next click on empty
ground charged the 25-gold relocate fee for a tower absent from `S.towers`, re-selected it,
and opened a phantom inspector whose upgrade buttons all still worked: **54,185 gold burned**
on a tower that never fires, never renders, and that `recomputeAuras` never sees. The `S`
hotkey reaches `sell` too, so the panel was not the only vector. Fixed by clearing the arm
in `sell`, and — because that closes the instance and not the class — `relocate` now tests
`S.towers.indexOf(t)` instead of the flag nothing writes.

**2. Escape on the escalation modal froze the battle outright.** `closeTopOverlay` excluded
the two STATIC required overlays by id; `#escal-choice` is created dynamically in ui.js and
was never added. Escape hid it while `Game.state` stayed `'escalating'`, and every control
gates on `state === 'playing'` — rush, pause, abilities, muster, aim, hotkeys and the step
loop itself all measured dead. The only writer back to `'playing'` is the modal's own card
handler, now unreachable. The player's sole recourse was QUIT, forfeiting the whole campaign
galaxy. Reproducible at every `wave % 10 === 0` — nine times in a 40-wave battle. Fixed by
excluding it AND by marking such modals with a `required` class, so the next dynamically
created blocking modal is covered by default rather than by memory.

Verified after: sell clears the arm, a sold tower cannot be relocated, the escalation modal
survives Escape with state recoverable, and taking a card still resolves to `'playing'`.

**41 findings remain** (20 WRONG, 7 RISKY, 14 COSMETIC) and are out as six audited patches
alongside the owner's four new notes: progressive hover-expand tower cards, drag-out radial
placement, THE MAELSTROM 20-seat black-hole arena (send-only, no defensive reanimation, send
bonuses still apply), and faction enemies fielding their own faction's towers and troops.

### Session 17b — six patches applied, and the bugs the missing audits would have caught

**Two of six audits died on a usage limit** (`feat-blackhole`, `feat-loadout`), so those
shipped unverified — the same exposure that let `gap-parity` ship a first-wave crash. The
four completed audits were thorough and measured, and their ordering work was essential:

**Apply order (measured, not guessed):** fix-ui → feat-blackhole → feat-radial →
feat-loadout → fix-numbers → fix-factions. Three hard collisions were found by sandboxing:
`fix-numbers` and `fix-ui` both insert at the SAME site in `takeEscalation` (mutually
destructive — the fix-numbers auditor resolved it); `fix-factions` rewrites a `br-row` line
`fix-ui` anchors on; and `fix-factions` rewrites the two `for (let side …)` loops
`feat-blackhole` anchors on. `fix-factions` causes two of the three and must run LAST.
In a bad order TWO patches applied NOTHING and `node --check` and `node build.js` both
still passed — the silent-partial-write hazard, confirmed a second time.

**A defect I caught before applying:** `feat-blackhole` read with universal newlines and
wrote with `newline=''`, which would have flattened js/config.js, js/game.js, js/ui.js,
css/polish.css and index.html from CRLF to LF — a whole-file diff that hides the real
change and breaks every later anchor. (`fix-numbers` had the identical defect; its auditor
removed it and flagged the sibling.) Fixed by recording the original ending per file and
restoring it on write. Verified: CRLF intact after all six.

**Three N-side assumptions that crashed THE MAELSTROM** — exactly what the missing
`feat-blackhole` audit would have found. `1 - side` is undefined the moment a third seat
exists, and the arena has twenty:
- `entities2.js` SABOTEUR read `game.sides[1 - this.side].towers` → **hard crash** on the
  first sabotage tick in the arena.
- `entities2.js` SIREN addressed its charmed unit at `hostileTo: 1 - this.side`.
- `game.js` `defendedPaths` returned `this.sendPaths[1 - side]`.
All three now route through one new `Game.rivalOf(side)`, which reads the existing
`musterVictims` chain and therefore already understands 2, 3 and 20 seats.

**THE MAELSTROM verified working:** 20 seats on a 47×47 radial field, 12 saboteurs built
across seats with no crash, **0.815 ms/step at 20 seats** against a 16.7 ms budget.
The owner's rule proved with a control: killing an incoming attacker on SPINE creates a
reanimate (pendingSpawns +1), the identical kill in the arena creates **nothing** — while
send bonuses still scale (musterHpMul 1.98 → 3.96 with doubled reanim).

**Full sweep: 18/18 owner notes verified in the running build**, zero console errors,
all 15 maps run, seed varies, 0 missing art keys across 178 images.
Pins: fresh median 6 (every run under 10), maxed 27, step 0.069 ms.

### Session 18 — the closeout, the amber dossiers, and the move to GitHub

**The audit's 27 findings are closed.** Four patches were authored in parallel;
the workflow then hit a usage limit and **six of its eight agents died, including
every audit agent**, so all four patches arrived unaudited. That has twice
shipped real bugs here, so they were audited by hand instead:

- Applied in two opposite orders into separate sandboxes. Both produced
  **byte-identical** output — the four are fully order-independent.
- All four confirmed genuinely **two-phase**: every anchor resolved and every
  problem collected before a single byte is written, with an explicit abort.
- **Line endings preserved per file**, including the two LF exceptions
  (`factions.js`, `towers2.js`). `ROADMAP.md` was already mixed before the patch
  and its counts are unchanged.
- Behaviour: **248 checks across the four suites, 0 failures.**

The hand audit caught one real gap the patches left: `c-nside` fixed post-match
*routing* for a skirmish but not the button's **label**, which is static markup —
so the arena promised "TO THE GALAXY" and then correctly delivered the
multiverse. Label and destination now derive from the one condition, in one
place, so they cannot drift apart. `c-nside`'s own test caught it: 57/58 before,
58/58 after.

**Minibosses.** VESPER and ORACLE were rostered at waves 35 and 45, past a curve
whose own comment calls ~25 a terminus, because the rota is indexed by SLOT and a
declined wave burned its slot. `MINIBOSS_EVERY = 5` is now named once and read by
the rule, the sidebar hint and the Field Manual — which also fixed a desync where
two strings said "every 5" while the engine ran every 10. Verified: five distinct
minibosses at 5/10/15/20/25, gaps `5,5,5,5,5`.

**The amber dossiers.** Root cause measured, not guessed: the foe prefix was **79
words on its own**, already past CLIP's 77-token budget, so the per-enemy accent
at token ~114–163 was discarded in all 49 cases. Prefix cut to 19 words, accent
hoisted to lead. Three render passes took the pack from **0% to 90%** correct
against each dossier's assigned accent. Full findings in `docs/BRAND.md`.

**Balance holds.** Batch B made previously-inert talents and traits live, so both
pins were re-measured: fresh loss median **7** (baseline 7), maxed tier-0 `spine`
**wave 28** (baseline 27). The +1 is the live talents and is expected.

**The ledger was lying.** `NOTE-LEDGER.md` listed five items as outstanding that
had shipped up to three sessions earlier. All five were re-verified against the
code and the shipping art pack, and the file now carries a standing rule: a row
moves to done only with the symbol, file or measurement that proves it.

**The project is now a repository.** <https://github.com/majieddd/majieddd.github.io>,
served live at <https://majieddd.github.io>. Set up for more than one author:

- `.gitattributes` pins the tree to **LF everywhere**, retiring the CRLF hazard.
- `CONTRIBUTING.md` carries the module map, branch etiquette, the nine traps and
  the two ways each balance pin has previously been mis-measured.
- CI parses every module, builds the bundle, proves it is self-contained,
  verifies `build.js` inlines every module on disk, and fails on any CRLF.
- Built bundles are ignored (~12MB of churn per edit); the Pages deploy rebuilds
  the standalone file so the download stays available from the site.

**Outstanding:** one owner call. The boss banner still reads `THE HARBINGER
ENRAGES` — a different mechanic from the wave bid, which is correctly named
RESONANT FIELD, but it reuses the exact word. Left alone rather than rewriting
flavour text unasked.

---

# SESSION 19 — OWNER ROUND: units, uniqueness, and the galaxy redesign

The largest single round so far. Tracked here as the source of truth; every row
moves to ✅ only with the symbol, file or measurement that proves it, per the
standing rule in `docs/NOTE-LEDGER.md`.

**Legend:** ✅ done & verified · 🔶 landed, verification pending · ⏳ in flight ·
❌ not started · 🎨 needs art generation

## Standing process change

| # | Note | Status |
|---|---|---|
| 19.0 | **Every update from now on ships to GitHub AND the live site**, not just the Artifact. Three surfaces per change: `main` → Pages → Artifact. | ✅ standing rule, added to `CONTRIBUTING.md` |

## A. The galaxy map — full redesign

The drag viewport landed in Session 16, but the *layout* underneath it never
changed: `GX_RINGS = [10.5, 15.0, 19.5]` with everything clamped into
`GX_X_MIN/GX_X_MAX` still sizes the galaxy to fit one screen. Dragging a map
that already fits is pointless — which is exactly why it reads as leftovers.

| # | Note | Status |
|---|---|---|
| 19.1 | Spread worlds **much further apart** so choosing a destination is a real act of navigation, not a glance. The layout must exceed the viewport by design. | ✅ world space separated from viewport: `GX_WORLD` 620×400 vs `GX_VIEW` 137×99 — **4.53× wider, 5.29× taller**. Rings 10.5/15/19.5 → 14/20/26. Closest pair 11.11 units, no clumping |
| 19.2 | **Fully redesign and modernise** the map so picking your next world feels like a deliberate, good-looking choice. | ✅ inertial drag, zoom bounds, recentre, reachable-vs-locked states, keyboard + coarse-pointer parity — 43/43 behaviour checks |
| 19.3 | **Open centred on the first world.** Today it does not, which reads as cheap or broken. | ✅ centres on the current world on open and on campaign advance; defers via `_pending` when the screen has no size yet, so it centres on first paint rather than snapping later |
| 19.4 | **Remove the galaxy backdrop image** — it does not fit. | ✅ plate, body class, `--art-galaxy` and the wrap `::before` all cleared; procedural starfield kept and re-tuned for the larger area. Also fixed the canvas backing store, which was sized from the **border** box while `inset:0` lays it in the **content** box — a 689×381 buffer painted into 687×379, i.e. a ~0.3% downscale blur on every star |

## B. Unlocks, factions and the soul shop

| # | Note | Status |
|---|---|---|
| 19.5 | **Robotic towers unlock through the story only** — beat a solar system to earn one. **DRONE BAY is the first.** | ✅ ladder DRONE BAY → RAILGUN → ECHO → PYLON → FOUNDRY → QUAKE → SINGULARITY → VAULT; `unlockTower` and `canUnlockTower` both refuse them, shop lists them as story unlocks with systems owed |
| 19.6 | **No cross-faction buying.** You must be on that faction's profile, spending that profile's souls, to unlock its towers. | ✅ 22/22 checks, incl. a second profile of another faction proven unable to buy the first's towers. Storage unchanged — only the purchase gate, per [`UNITS-AND-BOONS-DESIGN.md`](UNITS-AND-BOONS-DESIGN.md) |
| 19.7 | A tower unlocked in the menu is **immediately selectable** — no restart, no relog. | ✅ 7/7 — cached list rebuilt at the source rather than papered over |
| 19.8 | The **hover preview is glitchy** on tower cards. Fix it so it reads as intentional motion. | ✅ 15/15 — successive frames differ (motion, not a still), survives 14 rapid hovers, and releases its rAF handle on teardown. **Must be verified in a FRONTED tab**: a backgrounded tab throttles rAF to zero and fails all five of these spuriously |
| 19.9 | **Soul shop inflation:** each purchase raises every *other* purchase from that faction by **+1 soul**. | ✅ 10/10 — one definition of the price, read by both the shop and the deduction, so the player is never charged a figure they were not shown |

### B — what landed, and the proof

- **19.5.** `STORY_TOWER_ORIGIN` + `ROBOTIC_UNLOCK_ORDER` (`js/config.js`) and
  `Meta.storyLadder / storyPending / storySystemsFor / towerStoryLock /
  grantStoryTower` (`js/commanders.js`). The grant hangs off the one place a
  system is recognised as taken, inside `recordWorld`, and rides out on
  `st.storyTower` for the reward summary. Issue order:
  **DRONE BAY → RAILGUN → ECHO → PYLON → FOUNDRY → QUAKE → SINGULARITY → VAULT.**
  `unlockTower` refuses them and the shop lists them under THE MACHINE LINE
  with the number of systems still owed, never a price. `robotic` stays
  `gated: false` on purpose — `AI.rivalArsenal` reads `gated`, and narrowing
  it would give the player a shelf shape the rival could not mirror.
- **19.6.** **Souls were already per profile; the vault was not.** Measured
  before the change: profile A (xeno, 200 souls) bought TOXIN for 6, and a
  brand-new Federation profile B owned TOXIN at 200 souls untouched — a tower
  the origin gate would have refused it outright. Tower unlocks now live on
  `root.vault.unlockedBy[banner]`, one shelf per faction plus `none` for a
  profile that has not sworn (folded in by `adoptShelf` when it does). Souls
  stay per profile; commanders and abilities stay install-wide, which 19.6
  does not cover. Existing installs are grandfathered — every shelf is seeded
  from the retired flat list, so nobody loses an arsenal.
- **19.7.** Cause, not symptom: the redraw hung off `_soulShopClosed`, which
  only the ✕ ran. Measured — buy on the loadout screen and the grid stayed at
  1 card through the purchase AND through an Escape dismissal. Now
  `UI.refreshArsenalViews()` publishes at the moment the vault changes, and
  `#overlay-souls._escDismiss` gives Escape the same exit the ✕ has.
- **19.8.** Diagnosis: `runTowerPreview` opened with `stopTowerPreview()`,
  which calls `hideTooltip()` — so the preview hid the tooltip it had just
  been shown in (measured `hidden` immediately after `showTowerPreview`), and
  `moveTooltip` early-returns while hidden so no later mousemove recovered it.
  Split into `cancelTowerPreview` (loop only) and `stopTowerPreview` (loop +
  tooltip). Also: the loop never stopped when its canvas was re-rendered away
  under the cursor (measured 63 frames into a detached canvas in 500 ms) —
  now guarded by `cv.isConnected` plus a generation counter, so a burst of
  hovers can never leave two loops alive. Frames are time-based (`TP_MAX_DT`)
  instead of assumed-60Hz, recoil is time-since-shot decayed at the engine's
  rate (the old expression assumed a 0.5 s cadence and drew mortar at 6.3 and
  railgun at 7.0 against a 0–1 contract), the stub's `aimed()` applies the
  recoil translate the engine applies, and the canvas gets a device-pixel
  backing store.
- **19.9.** `Meta.soulSurcharge()` is the single definition, and
  `Meta.chargeSouls(cost)` is the single deduction. `towerUnlockCost()`,
  `abilityCost()` and `commanderCost(id)` all add it, and every buyer now
  charges the value its own cost function returned — `unlockAbility` and
  `unlockTower` previously charged the raw constant while the shop printed
  the accessor, which were equal only by luck.

## C. Units — the new system

The largest piece. Units become a first-class parallel to towers: unlocked from
maps, faction-flavoured, individually talented, and presented side by side.

| # | Note | Status |
|---|---|---|
| 19.10 | **Units unlock per map.** Different maps rescue different units. | ✅ `worldRescueOffer(world, map, myFaction)` gives every world a **second rescue track** beside its machines |
| 19.11 | **Each faction has its own units**, with effects that read out of its lore. | ✅ which power a world offers follows the **world's owner** and the map's tier — the galaxy's ownership colours finally cash out. Four doctrines, one per power. 20/20 checks |
| 19.12 | **Loadout becomes four columns.** Middle two are **Units** and **Towers**, visually matched. Outer two are the detail/talent panels for each. | ✅ measured at 1680px: columns at x=24/310/842/1374, pickers 518px each. The two pickers are **one component**, not two lookalikes — same card, grid rule, binder and input routes; card box measured identical at 189.5×72. Collapses to a drawer below `LO_FOUR_COL_MIN_PX` |
| 19.13 | **Every unit gets its own talent set**, chosen like tower talents. | ✅ reuses the tower talent shape — three rows of two, mastery-gated, stock-build fallback intact. 16/16 checks |
| 19.14 | A faction's playthrough may rescue **only its own units, or machine units**. Once the **Soul Profile** owns it, any faction or commander may field it. | ✅ 15/15 — a Pirate campaign proven unable to rescue a Votary; a soul-bought unit proven usable by every commander. Storage untouched, as predicted |
| 19.15 | Units get a **tower-like icon and card**, previewing the unit **moving and using its signature trait**. | ✅ reuses the 19.8 preview rather than building a second one. Both 300×104 stages proved animating — **8 distinct frames of 8 sampled**, one shared loop |

## D. Balance

| # | Note | Status |
|---|---|---|
| 19.16 | **Spawned-unit HP penalty curve:** −50% early, easing to **−25% at wave 5** and **0% at wave 10**. | ✅ `spawnHpPenaltyMul(wave)` is the single definition; shape **derived** from the owner's three anchors so it cannot drift from its own documentation. Measured **0.500 / 0.750 / 1.000** at waves 1 / 5 / 10 |
| 19.17 | **Muster income is far too small.** Summoning your own troops must be meaningfully rewarding. | ✅ verified it is the *purchase* that got richer, not the count: deep maxed runs bought **fewer** musters (18/14 vs 26/24) while reaching more income — the Session-15 AI over-buying failure mode explicitly ruled out |
| 19.18 | **CANISTER rework:** stacks **strip armour** (its identity against TOXIN) and deal **max-health-based** damage at about **⅓ of toxin's total damage percentage** to compensate. | ✅ TOXIN scales off **current** health, CANISTER off **max** health (`poisonMaxPct`) and strips armour (`shredPerStack`, unique to it), at ~⅓ of toxin's percentage — measured 0.0034 vs 0.010 at base. They still share stack *machinery* (`poisonDur`, `maxStacks`), which is as meaningful as two towers sharing `range` |

## E. Tower identity — 10 per faction

Today: human 10, light 7, xeno 7, pirate 7, robotic 8 (**39**). Target **10 per
faction plus a 10-strong robotic line = 50**, so **11 new towers** minimum.

| # | Note | Status |
|---|---|---|
| 19.19 | Audit all 39 for genuine uniqueness. Shared *categories* (splash, beam) are fine; shared *identity* is not. | ✅ [`docs/TOWER-AUDIT.md`](TOWER-AUDIT.md) — **36 of 39 already unique**; 3 pure stat blocks (bolt/mortar/flak) and 6 genuine overlapping pairs named |
| 19.20 | Invent genuinely new mechanics — buffing your own army, **a tower that spawns troops which body-block the lane until they die**, and others. | ✅ all five pairs separated; the three stat blocks given signatures (`killReload`, `spotting`, `downFor`). **My own CUSTODIAN proposal was rejected on measurement** — SHEPHERD already owns `flockHp`/`flockSpeed`, so buffing musters would have closed the fifth overlap by opening a sixth. It became THE OATH (`vigilHold`) instead. 288/288 checks |
| 19.21 | Bring every faction to **10 towers**; generate whatever new content that needs. | ✅ **50 towers, exactly 10 per power.** Eleven new, each carrying a `base` key owned by nothing else, each with a reader proved by measurement. Eleven painted plates rendered and wired |
| 19.22 | **Distinct balance curves.** Some towers early-game, some late — via price, difficulty, or a mechanic that needs time on the field. Unique, but fair. | ✅ each of the eleven states its shape — opener / conditional / investment — and expresses it as a mechanic rather than a price. Pins hold: loss median **6** over n=12, all under wave 10 |

## F. Victory boons

Today: **8 global** boons in `towers2.js:527`, drawn without regard to world or
power — which is why every victory feels the same.

| # | Note | Status |
|---|---|---|
| 19.23 | **≥5 boons per faction** (20+ total), each reading as a reflection of the planet it came from. | ✅ **20 boons, 5 per power**, written out of each power's lore. All 20 proved live — each moves an observable engine value, zero dead. Wakes **five dormant mechanics** (`freeCopies`, `lastStandAt`/`Dmg`, `waveHeal`, `immortalLine`, `siphonRate`) whose engine code was finished but which nothing ever wrote |
| 19.24 | In multiplayer the boon depends on **both the planet and the faction you took it from**. | ✅ `boonFor(owner, kind, contested, roll)` at the galaxy draw site, which already knew both axes. 4 kinds × 4 powers + an **APEX** paid only by contested worlds. **Galaxy PRNG stream proved unmoved** — 6 seed/faction fingerprints byte-identical before and after, so no saved galaxy shifted |

## G. Art direction

| # | Note | Status |
|---|---|---|
| 19.25 | **Army unit art does not match the commander portraits.** Units should share the commanders' *portrait* aesthetic while keeping their model style, the way the towers do. | ✅ cause was mechanical — troops and machines share the `foe_` key prefix so troops were rendered with the machine *specimen* prompt. Own painted class added; all 20 re-rendered. **Measured: troops 74.6% coloured / 0.256 sat vs commanders 74.9% / 0.270; machines unchanged at 0% / 0.030** |

## Tooling for this round

- **`huashu-design`** skill — installed at `~/.claude/skills/huashu-design`; use
  for the galaxy redesign and the loadout's four-column layout.
- **Krea 2** — `artgen/krea_gen.py`, NF4 on the 4080. ~83 min/image, so upgrade
  whole classes or not at all; SDXL-Turbo remains the bulk renderer.
- Every generation obeys `docs/BRAND.md`, including the **77-token rule** that
  cost the dossiers their accent for several sessions.

## Sequencing

Balance and unlock-gating (**D**, **B**) are self-contained and land first.
The galaxy redesign (**A**) is independent and can run in parallel. Units (**C**)
is the tent pole and depends on the loadout restructure, so its data model lands
before its UI. Tower content (**E**) and boons (**F**) are content generation
that must be balance-checked against the pins afterward. Art (**G**, 19.4, 19.15,
19.21) batches into one render pass at the end so the style stays consistent.

---

# SESSION 20 — OWNER ROUND: routes, previews, portraits, and real multiplayer

Six owner notes plus the technical debt carried out of Session 19. Dispatched as
seven parallel teams, per the owner's preference for maximum concurrency.

**Legend:** ✅ done & verified · 🔶 landed, verification pending · ⏳ in flight ·
❌ not started · 🎨 needs art generation

## A. The galaxy map

| # | Note | Status |
|---|---|---|
| 20.1 | **Dotted travel lines** between near worlds, so the route to your next world reads at a glance — and **multiple paths** between worlds, so the next mission is a genuine choice rather than a queue. | ✅ **56 routes** rendering, classed `taken` / `live` / `sealed` / `local` / `gate`, with a key |
| 20.3 | **A claimed world takes your faction's colour.** Conquest should be visible on the map, not only in a stars count. | ✅ `worldAllegiance()` is the one source; four redundant channels (hue / fill / shape / ring) so it survives colour-blindness and the far zoom. States: held, taking, yours, contested, locked |

## B. Legibility

| # | Note | Status |
|---|---|---|
| 20.2 | **Every map preview shows the actual map** — its lanes and shape, not just a painted plate. | ✅ derived from the same data the board is built from, so it cannot drift |
| 20.5 | **A level-up routes you to the commander screen** so the points can be spent when they are earned, rather than discovered later. | ✅ routes only when there are points to spend; skirmish and defeat cases handled |

## C. Art direction — the style, properly nailed

| # | Note | Status |
|---|---|---|
| 20.4 | Portraits still read **medieval / fantasy armoury**. They must be **vaporwave duotone or monochrome** (by faction) in a **cyberpunk comic** register drawn from Tyranny. Build a **LOOKBOOK** of reference assets. | ✅ cause was mechanical: prompts ran **164-185 tokens against a 77-token window**, so `{STYLE}` opened at token 92-113 and **"cyberpunk science fiction" was never encoded for any of the 21**; the negative prompt naming "medieval, fantasy armour, sword" has **never had any effect on either path**. Rewritten to close at 56-71. **Troops brought onto the same register** and 7 armoury nouns removed from their subjects. Rendered and measured: **mean 1.5 hue families** across commanders and troops — duotone/monochrome achieved. [`docs/LOOKBOOK.md`](LOOKBOOK.md) |

## D. Multiplayer

| # | Note | Status |
|---|---|---|
| 20.6 | **Make multiplayer actually work.** Today `mpSearch` fakes a 3.6-second relay search, reports "no commander answered … the live relay comes online in a future update", and hands you an AI garrison. There is **no network layer of any kind** in the codebase. | ⏳ |

The hard constraint this must respect: **no external libraries, ever**, and the
game must run offline from a single inlined HTML file. That rules out any
signalling service or SDK, and rules in the browser's own APIs — `WebRTC` with
manual (copy-paste) signalling needs no server at all, and `BroadcastChannel`
gives genuine two-client play between tabs on one machine. The fixed 1/60
timestep the engine already runs on is what makes lockstep feasible.

## E. Technical debt carried from Session 19

| # | Item | Status |
|---|---|---|
| 20.7a | CANISTER lost an AI heuristic when it stopped carrying `poisonPct` (`ai.js:371`) — half of it is still deserved, half is now wrong for it. | ⏳ |
| 20.7b | `Tower.estimateDps` ignores `poisonPct` for TOXIN (pre-existing). | ⏳ |
| 20.7c | `MUSTER_AI_HORIZON_WAVES` still 5 after the income buff — measured as not over-buying, but worth re-checking now units have landed. | ⏳ |
| 20.7d | `GX_VIEW.x` / `GX_VIEW.y` are inert since the world/viewport split. | ⏳ |
| 20.7e | **The six light/xeno towers have no bespoke inspector rows** — the biggest legibility gap the Phase 3 agent flagged. No "Wards standing 1/3", "Offering: Ironmarch", "Answers banked 4". | ⏳ |
| 20.7f | BLOOD PRICE's tooltip prints `◈0`. True — no gold changes hands — but it should show a ♥ price. | ⏳ |
| 20.7g | Rival parity for BLOOD PRICE: `ai.js` scores it through `towerCost` (which returns 0) rather than a life-aware bid. | ⏳ |
| 20.7h | **A jammed NULL FIELD stops suppressing**, so a Jammer inside one can jam the field off and free itself. Flagged as interaction, not bug — owner call. | ⏳ |
| 20.7i | Soul-shop inflation never re-modelled at ten towers per faction. | ⏳ |
| 20.7j | Ten pre-existing player-facing talent-name collisions (PERMAFROST, WIDE FIELD, BATTERY, CAPACITOR, CONCENTRATE, WINDLASS, TRIBUTE, SATURATION, CLARITY, BACKBONE). | ⏳ |
