# Owner Note Ledger — every note given, and where it stands

Compiled for the final completeness sweep. Status is filled by VERIFICATION against the
shipped code, not by recollection. Sessions 7–12 are covered by the roadmap audit
(wf_a8769cbf-e0e) which checked those claims line-by-line; this ledger tracks the notes
given in Sessions 13–16 directly, plus the audit's own findings.

Legend: ✅ verified in code · 🔶 landed but unverified · ⏳ in flight · ❌ not started

---

## Session 13 notes

| # | Note | Status |
|---|---|---|
| 13.1 | Apply the redesign to the rest of the game | ✅ |
| 13.2 | Tower placement cost +50%, per-tower rate doubled | ✅ |
| 13.3 | Base level raises all tower levels beneath it (retrofit) | ✅ |
| 13.4 | Graphics/design bland — use another AI / KREA 2 | ✅ 118-image pack |
| 13.5 | Finishing a map returns to world map | ✅ |
| 13.6 | Remove commander levelling from soul shop | ✅ |
| 13.7 | Detail star conditions per map | ✅ |
| 13.8 | Galactic map low quality | ✅ superseded by S16 2.5D map |
| 13.9 | More unique maps; 3-way Xeno/Light/Human map | ✅ **6 tri boards** now carry `tri: true`, drawn from `TRI_MAP_IDS` so one system never fights the same three-way twice |
| 13.10 | Splash/slow-resistant mob mechanics | ✅ shardling, basalt |
| 13.11 | Skill activation animation + sound | ✅ |
| 13.12 | Commander portraits | ✅ 21 painted |
| 13.13 | New-enemy dossier card on first encounter | ✅ |
| 13.14 | Brief pre-battle dialogue | ✅ — but see 16.11 (feels clumped) |
| 13.15 | Galaxy map shows active boons | ✅ |
| 13.16 | Base level price +10% compounding | ✅ |
| 13.17 | Element strength/weakness per enemy | ✅ elemWeak/elemResist |
| 13.18 | Research highly-rated TD games | ✅ dossier mined, 10 shipped, 15 optioned |

## Session 14 notes

| # | Note | Status |
|---|---|---|
| 14.1 | Revoke design digests, use AI illustrative art; install huashu | ✅ |
| 14.2 | Krea 2 from HuggingFace, ComfyUI if needed | ✅ pipeline works; SDXL ships (83min/img documented) |
| 14.3 | Galaxy bubbles overlap | ✅ **re-fixed in S16** — was still overlapping (4.17→5.83) |
| 14.4 | Tri-battles only on special contested planets, shown on map | ✅ |
| 14.5 | Soul shop only on commander screen | ✅ closed — the copy that named a screen is gone; `ui.js:1930` carries the comment recording why it must never name one again |
| 14.6 | Sevra skills not increasing tower damage | ✅ inspectorKey pulse terms |
| 14.7 | Squish damage/HP numbers, whole numbers, never below 1 | ✅ NUM_SQUISH 2.5 |
| 14.8 | 3-way: show all 3 commander interactions; fix 3-way UI | ✅ closed — the battle intro renders seat 2's portrait and VS block (`ui.js:3226-3251`), and the panel reads `Game.sides[2]` live rather than from a cached duo |
| 14.9 | Remove Extract; souls from stars (doubled); system bonus; shared unlocks | ✅ (formula later revised by 16.5) |

## Session 15 notes

| # | Note | Status |
|---|---|---|
| 15.1 | Monochrome faction symbols, same art style | ✅ fixed via `derive_crests.py`, not regeneration — measured in the shipping pack, worst hue deviation 4.5° (see this file's outstanding table) |
| 15.2 | Lock vaporwave + gothic cathedral line art (Tyranny) | ✅ BRAND.md |
| 15.3 | Mob pics grey/black/white + hint of faction colour | ✅ ACCENT table |
| 15.4 | Some enemies missing pictures | ✅ 7 found and painted; 0 missing |
| 15.5 | Muster loadouts, unlocked by saving denizens | ✅ verified live |
| 15.6 | Show baseline income; musters add % additively | ✅ verified live |
| 15.7 | Squish economy to near single digits, same curve | ✅ GOLD_SQUISH 8 |
| 15.8 | Right panel 2 columns | ✅ 580px grid |
| 15.9 | Losing must not reset galaxy progression | ✅ campaignDefeat |
| 15.10 | Map banner diversity; faction-held maps in faction duotone | ✅ 36 derived plates |
| 15.11 | Galactic map generated backdrop + planets | ✅ galaxy_bg + 4 planet kinds |
| 15.12 | Find anything else missing images | ✅ every UI art lookup checked |
| 15.13 | Maintain art style; make a brand kit | ✅ BRAND.md |

## Session 16 notes (current)

| # | Note | Status |
|---|---|---|
| 16.1 | Sweep all previous threads for anything unapplied | ✅ all 19 closed — the remaining 15 became the Session 17 audit, whose 27 findings were closed in Session 18 |
| 16.2 | Universe map: 2.5D spatial, click-drag scroll, immersive | ✅ CSS-3D plane + parallax + drag/zoom (three.js declined, documented) |
| 16.3 | Crawler image is not a crawler | ✅ + whole class fixed (scene→specimen, anti-medieval) |
| 16.4 | New enemy every 2 waves from wave 1; max 8 types per map | ✅ `ROSTER_MAX = 8`, `ROSTER_INTRO_EVERY = 2`, config.js:1733 |
| 16.5 | Souls = 2× stars earned | ✅ verified 1★→2, 3★→6 |
| 16.6 | Complete map reformation for diversity | ✅ 15 battle boards + the arena; 4 of them tri |
| 16.7 | Title bg → space nebula gradient, keep star interaction | ✅ verified |
| 16.8 | Muster income much higher; reanimation stacks | ✅ +5%→+14.9%; cap retuned to **180%** by 19.17 (`MUSTER_INCOME_CAP_PCT`); gold+doubling stack |
| 16.9 | Faction-specific enemies; neutral = semi-sentient robotic protectors | ✅ faction troops replace machine slots on a garrisoned world (the symbol moved: `ROSTER_FACTION_SLOTS` + `battleHostFaction` since the Session-19 refactor) |
| 16.10 | Tower tech origins (5), soul-shop gated by faction playthrough | ✅ every tower carries `origin:` — all **50** since 19.21; shop gated |
| 16.11 | Dialogue more immersive, less clumped/random | ✅ 21 per-commander openers, per-faction replies, authored rivalry pairs (dialogue.js) |
| 16.12 | Universe map: drag-scroll, varied planets, fix clumping, 2+ tri per system, bigger tri maps | ✅ drag + clumping; `CONTESTED_PER_SYSTEM = 2` drawing distinct boards from `TRI_MAP_IDS` |

---

## Outstanding at compile time

**None.** Every item above is closed. This section listed five open items for three
sessions after they had actually shipped, which is worse than listing nothing — a stale
ledger is read as a true one. Re-verified against the code and the shipping art pack:

| Was listed open | Actually |
|---|---|
| 16.11 dialogue immersion | Shipped. `DIALOGUE` carries 21 per-commander openers, four per-faction replies and hand-authored rivalry pairs — the opposite of the clumped random pool the note objected to. |
| 15.1 crest hue | Fixed, and not by regeneration. Prompting cannot pin a hue, so `derive_crests.py` tints each crest onto the faction's exact ramp. Measured in the SHIPPING pack: human 187.8° vs 186.9°, xeno 260.9° vs 262.1°, pirate 1.4° vs 0.0°, light 38.8° vs 43.3° — worst deviation 4.5°, and that one is the mean-hue estimator being pulled by the dark end of a gold ramp. |
| 16.4 / 16.6 / 16.9 / 16.10 | All four shipped in the content workflow — see the rows above for the symbol that proves each. |
| The 15 audit gaps | Closed, then re-audited. The follow-up audit raised 27 fresh findings, tracked separately. |
| Planet variety | `planetArtFor` draws from up to three painted variants per kind, chosen deterministically from the world id, so a system reads as distinct places rather than four repeated stamps. |

**Standing rule for this file:** a row moves to ✅ only with the symbol, file or measurement
that proves it, written in the row. "Verified" without evidence is how the list above rotted.

---

## Session 18 re-verification — every note driven against the running engine

`tools/owner-sweep.js` re-checks the owner notes by BEHAVIOUR rather than by
reading this file. Result: **16 pass, 0 fail, 1 informational.**

| Note | Proof the sweep produced |
|---|---|
| 14.1 enrage renamed thematically | RESONANT FIELD present in the shipped bundle |
| 14.2 relocation costs 33% | `Game.relocateCost` billed 6 on 19 invested — 31.6% after integer rounding |
| 15.8 losing keeps galaxy progression | galaxy, seed, stars and boons byte-identical across a loss — and the defeat IS recorded (2 → 3) |
| 16.4 new type every 2 waves, cap 8 | `ROSTER_MAX=8`, `ROSTER_INTRO_EVERY=2`; a real `spine` battle fielded exactly 8 non-boss types |
| 16.5 souls are twice the stars | first star pays 2, three stars pay 6 |
| 17.3 arena seats 20, own base each | 20 seats, 20 with lives, **20 distinct base tiles**, every lane 836 long so no seat is cheated |
| 17.4 rivals use their own faction's hardware | all four arsenals stay on own + human + robotic; no third power's towers |
| audit#3 minibosses inside the curve | 5 distinct at waves 5/10/15/20/25, gaps `5,5,5,5,5`, matching the advertised `MINIBOSS_EVERY` |
| desync guard | wave preview equals `Game.waveHpMul` across waves 1-30 |
| N-side guard | all 20 seats resolve a rival and a send path; 3,600 frames clean |

**The one informational item — an owner call.** Exactly one player-visible string
still contains the word: `ENEMY_TYPES.harbinger.phases[1].msg` reads
**"THE HARBINGER ENRAGES"**. That is a boss phase, not the wave-bid mechanic the
note was about — the mechanic itself is correctly named RESONANT FIELD
everywhere. Every other occurrence in the codebase is an internal identifier
(`S.enrage`, `ENRAGE_MAX`) that no player ever sees. Renaming boss flavour text
is a taste decision, so it was left rather than changed unasked.
