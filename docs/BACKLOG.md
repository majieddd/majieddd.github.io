# Cosmic Conquest — the standing backlog

Everything not finished, in one place. Rebuilt at the end of Session 20.

**Read the status literally.** *Spec'd* means the root cause is found and
written down; *not started* means nobody has looked.

**Currently shipped and green on `main`:** owner sweep 27/0, Sessions 19 and 20
complete bar the three rows below, both balance pins holding, duel / tri /
twenty-seat arena soaking clean. 50 towers (10 per power), 20 boons, 20 faction
units, 188 art plates. Live on all three surfaces.

---

## The only three things outstanding

### 1. Multiplayer — built, on a branch, NOT merged
`feature/multiplayer-20.6`. Two humans on two clients over `BroadcastChannel`
with deterministic lockstep. **MPT 19/24**, and the two failures are the two
strongest claims: the reanimate loop across the wire is *unproven* (the harness
only reaches wave 3, so nothing dies to reanimate), and the determinism
**negative control failed to fail**. No adversarial audit exists — all seven
Session 20 audit agents died to a weekly limit.
Full write-up and the specific next step for each: `docs/MULTIPLAYER-HANDOFF.md`
— which exists **only on that branch**, so this link 404s from `main`. Read it
without checking the branch out:
`git show feature/multiplayer-20.6:docs/MULTIPLAYER-HANDOFF.md`.
**Do not merge on 19/24.**

### 2. Soul-shop surcharge (20.7i)
Modelled at ten towers per faction, and the finding inverts the assumption: the
**+1 step is not the problem, the shared counter is**. The fix lives in
`Meta.soulSurcharge` / `Meta.chargeSouls` in `js/commanders.js`.

### 3. The art pack re-encodes on every pack (20.7k)
`write_pack` decodes and re-encodes every cached webp on each `--pack`, so each
repack costs one more lossy generation. Measured: a byte-identical source
round-trips to RMSE ~2.2. Harmless once, cumulative forever. Fix is to copy the
cached bytes through untouched when the cache entry already matches the target
size.

---

## Closed in Sessions 19 and 20

These had their own sections here until Session 20 shipped them. Kept as one
line each rather than deleted, because the *reason* each was smaller than it
looked is worth not re-learning:

| Was | Outcome |
|---|---|
| **A1 units (19.10-19.15)** | ✅ Mostly wiring, not building — 20 faction units already existed with art and per-map rescue already worked; they had simply never been connected. 61/62 checks |
| **A2 tower identity (19.20)** | ✅ 36 of 39 already unique. Three stat blocks given signatures, all five real pairs separated. 288/288 checks |
| **A3 boons (19.23-19.24)** | ✅ 20 boons, 5 per power, keyed to power × world kind. All proved live; five dormant engine mechanics woken |
| **B 11 new towers (19.21-19.22)** | ✅ 50 towers, ten per power, each naming a `base` key that appears nowhere else |
| **D technical debt** | ✅ All ten Session-19 items closed in 20.7 — plus four extra name collisions the sweep found on its own |

The one lesson worth carrying: in four of those five, **reading the code first
changed what the task was.** The lane-blocking spawner already existed. The
units already existed. The boons' problem was the draw site, not the boons.
Measure before building.

---

## C. Owner decisions — nothing is blocked, but these are yours

| Decision | Context |
|---|---|
| **"THE HARBINGER ENRAGES"** | The only player-visible string still using the word. It is a *boss phase*, not the wave-bid mechanic — that is correctly named RESONANT FIELD everywhere. Renaming boss flavour is taste, so it was left rather than changed unasked |
| **Commander / ability unlocks** | Note 19.6 named *towers*. Commander and second-ability unlocks stayed install-wide, and the commander screen already filters to your faction. Widening the split was not assumed |
| **Grandfathered saves** | Existing profiles keep every tower they already owned on *every* faction shelf, and start the inflation ladder at zero. A stricter migration would take arsenals away from current players — a policy call, not a bug |
| **The fifteen held-back mechanics** | [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md) — still awaiting picks, see section E |

---

## D. Technical debt

All ten Session-19 items were closed in 20.7. What is left:

| Item | Where | State |
|---|---|---|
| Soul-shop surcharge | `Meta.soulSurcharge`, `js/commanders.js` | Modelled. The **+1 step is not the problem, the shared counter is** — deferred for file ownership, not difficulty |
| `--pack` re-encodes every plate | `artgen/krea_gen.py` `write_pack` | Each repack costs one more lossy generation; measured RMSE ~2.2 per round-trip. Copy cached bytes through when the size already matches |
| `GX_VIEW.x` / `.y` inert | `js/config.js` | **Proved** inert by test, not assumed. Deleting them needs the GX_* block, which belonged to another team that round |
| Pinch-zoom unverified on hardware | `js/ui.js` | Code path and synthetic single-pointer events only — no multi-touch device in this environment |

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

1. **Multiplayer** — close the two failures in `docs/MULTIPLAYER-HANDOFF.md`
   (on the branch only: `git show feature/multiplayer-20.6:docs/MULTIPLAYER-HANDOFF.md`),
   get it audited, then merge `feature/multiplayer-20.6`. It is the only
   feature-sized item left.
2. **The soul-shop counter** — small, and it is a real economy bug.
3. **The pack re-encode** — small, and it stops a slow quality leak.
4. **Owner picks** from section C and E, whenever you want them.

Re-measure both pins after anything touching economy, AI or towers, and put the
numbers in the PR. The pins and the three ways to mis-measure them are in
[`../CONTRIBUTING.md`](../CONTRIBUTING.md) §5.
