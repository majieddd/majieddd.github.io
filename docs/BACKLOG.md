# Cosmic Conquest — the standing backlog

Everything not finished, in one place. Assembled by re-reading the roadmap, the
note ledger, the tower audit, the mechanics dossier, and the deferral notes the
Session 19 patches left behind.

**Read the status column literally.** A row says *spec'd* only if the root cause
is already found and written down, and *not started* only if nobody has looked
yet. Nothing here is marked done — done work lives in
[`ROADMAP.md`](ROADMAP.md) with the measurement that proves it.

**Currently shipped and green:** owner sweep 16/0, Session 19 Phase 1 suites
150/150, both balance pins holding, duel / tri / twenty-seat arena all soak
clean. Live on all three surfaces.

---

## A. Ready to build — spec'd, root cause known

These are not investigations. Each has a design doc and a named cause.

### A1. The units system (19.10–19.15) — the tent pole

Spec: [`UNITS-AND-BOONS-DESIGN.md`](UNITS-AND-BOONS-DESIGN.md).

The surprise here is how much already exists. **Twenty faction units are already
defined** with art (five per power, `js/factions.js`), and **per-map rescue
already works** (all fifteen maps declare `denizens`; `ui.js:1759` builds the
savable list). They have simply never been connected — of the twenty-two
denizens across all fifteen maps, **none is a faction unit**. Every rescue today
is a neutral machine.

| # | Item | Notes |
|---|---|---|
| 19.10 | Units unlock per map | Put faction units into the denizen pools that already exist |
| 19.11 | Each faction has its own units | Already authored; needs wiring and lore-shaped effects |
| 19.12 | Four-column loadout | Units and Towers as visually matched middle columns, detail panels outside. Needs a defined narrow-viewport behaviour — collapse the detail columns to a drawer rather than reflowing, or the pairing that is the whole point breaks |
| 19.13 | Talents per unit | Reuse `Meta.talentMods`, including its partial-allocation trap: spending one point must never be worse than spending none |
| 19.14 | Rescue gate + Soul Profile escape hatch | **Storage does not change** — souls are already per-profile, the vault already install-wide. Only the gate |
| 19.15 | Unit cards preview the unit moving | Reuse the hover preview fixed in 19.8 rather than building a second one |

### A2. Tower differentiation (19.20)

Audit: [`TOWER-AUDIT.md`](TOWER-AUDIT.md). **36 of 39 towers already carry a
unique mechanic** — the arsenal is in better shape than it looks. What is
actually wrong is narrow:

- **Three pure stat blocks** — `bolt`, `mortar`, `flak`. All three human
  starters. A baseline is defensible; being characterless is not.
- **Six pairs sharing the keys that define them.** `toxin`/`canister` is now
  fixed. Remaining: `foundry`/`custodian`, `beacon`/`pylon`,
  `vault`/`quartermaster`, `arc`/`concord`, `pyre`/`ichor`.

Worth stating plainly: the *"tower that creates troops that fight oncoming
troops, stopping them until they die"* **already exists** — FOUNDRY grapples and
grinds. Its own description claims it is "the only structure that fights with
BODIES", which is true of the intent and false of the arsenal because CUSTODIAN
duplicates it. Proposal in the audit: FOUNDRY keeps the body-wall identity,
CUSTODIAN becomes Federation escorts that **shield and buff your own musters** —
which also serves the "buffing your own army" ask and makes the two answer
opposite questions.

### A3. Victory boons (19.23–19.24)

Cause found: all eight boons are **global**, drawn at `commanders.js:453` with no
reference to the world or the power it was taken from. That is exactly why every
victory feels the same.

Design is a two-axis matrix — faction decides *what kind* of advantage you loot,
`WORLD_KINDS` biases *which of its five* you are offered. Five per faction,
twenty total. The eight existing boons should be **re-authored into the matrix,
not kept beside it**, or the global pool dilutes the diversity the change exists
to create.

---

## B. Content generation — needs new material

| # | Item | Size |
|---|---|---|
| 19.21 | Bring every faction to **10 towers** | **11 new towers**: light +3, xeno +3, pirate +3, robotic +2. Constraint: *a new tower is not approved until it names a `base` key that appears nowhere else in the arsenal* |
| 19.22 | Distinct balance curves | Levers already exist — `cost`/`costGrowth`, time-on-field mechanics (`forgeTime`, `incomeEvery`), and level-jump shape. Each new tower states which curve it aims at |
| 19.15 | Unit preview art | Batches with the art pass |

**Art batching.** Generate 19.15 and 19.21 in one pass so the style stays
consistent, and re-read [`BRAND.md`](BRAND.md) first. Two rules are load-bearing
and have each cost a whole class of art: CLIP truncates at **77 tokens** (all 49
dossiers once shipped amber because the accent sat at token ~114), and guidance
is 0 so the **negative prompt is inert** — you cannot subtract, only lead with
what you want.

**Soul-shop interaction worth modelling first:** eleven new towers means eleven
more purchasables, so the 19.9 inflation rule (+1 soul to every other purchase
from that faction) compounds much harder at ten towers than at seven. Model the
full unlock curve for one faction before committing the number.

---

## C. Owner decisions — nothing is blocked, but these are yours

| Decision | Context |
|---|---|
| **"THE HARBINGER ENRAGES"** | The only player-visible string still using the word. It is a *boss phase*, not the wave-bid mechanic — that is correctly named RESONANT FIELD everywhere. Renaming boss flavour is taste, so it was left rather than changed unasked |
| **Commander / ability unlocks** | Note 19.6 named *towers*. Commander and second-ability unlocks stayed install-wide, and the commander screen already filters to your faction. Widening the split was not assumed |
| **Grandfathered saves** | Existing profiles keep every tower they already owned on *every* faction shelf, and start the inflation ladder at zero. A stricter migration would take arsenals away from current players — a policy call, not a bug |
| **The fifteen held-back mechanics** | [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md) — still awaiting picks, see section E |

---

## D. Technical debt and follow-ups

Small, real, and each one named by whoever deferred it.

| Item | Where | Why it matters |
|---|---|---|
| CANISTER lost an AI heuristic | `js/ai.js:371` | Gated on `poisonPct`, which CANISTER no longer has. Half the heuristic is still deserved (pure damage, ignores shields) and half is now wrong (it should *not* get the boss bonus). A scoring weight, not a printed number, so it degrades quietly rather than lying |
| `Tower.estimateDps` ignores `poisonPct` for TOXIN | `js/entities.js` | Pre-existing. Left alone deliberately so the CANISTER rework did not silently re-rate TOXIN to the AI at the same time |
| `MUSTER_AI_HORIZON_WAVES` still 5 | `js/config.js` | Doubled income makes the brain score a send ~2.2× higher at the same horizon. Instrumented runs say it is *not* over-buying (fewer purchases, more income, unchanged tower counts), so it was left — but it is the Session-15 failure mode's neighbourhood and worth re-checking after the units round |
| `GX_VIEW.x` / `GX_VIEW.y` are inert | `js/config.js` | Only `.w`/`.h` are read since the world/viewport split. Left because `GX_VIEW` is passed around as a rect; could reduce to a size |
| Pinch-zoom unverified on real hardware | `js/ui.js` | Implemented and verified by code path and synthetic single-pointer events only — no multi-touch device in this environment |

---

## E. The fifteen held-back mechanics

From the mechanics dossier, deliberately **not** implemented pending your picks.
Full write-ups with build notes in [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md).

1. Recoverable stolen objective — a leak becomes a timed recovery window
2. Persistent battlefield scarring — wreckage denies rival build tiles
3. Land as a purchasable or depleting resource
4. Variable tower footprints
5. Economy structures must survive to pay (jam gates VAULT income)
6. Commander attention as an economic resource (FOCUS)
7. Fog over the rival board / visibility-gated placement
8. Mutable destination, or a second spawn mouth
9. Per-tower usage XP
10. Tower upkeep / supply priority
11. Territory-linked income
12. Checkpoint rewind
13. Open-field shortest-path mazing
14. Deployment points as a second placement currency
15. True 3D / multi-deck vertical mazing

---

## F. Suggested order

1. **Boons (A3)** — smallest, self-contained, and the diversity lands immediately.
2. **Tower differentiation (A2)** — five pairs to separate, no new content needed.
3. **Units (A1)** — the tent pole. Data model before UI; the four-column loadout
   depends on the unit/talent shape existing first.
4. **Tower content (B, 19.21–19.22)** — after A2, so new towers are designed
   against a differentiated arsenal rather than adding to a muddled one.
5. **One art pass** covering 19.15 and 19.21 together.

Re-measure both pins after anything in 2–4, and put the numbers in the PR —
that is three separate rounds touching economy and tower power.
