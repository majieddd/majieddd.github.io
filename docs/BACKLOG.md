# Cosmic Conquest — the standing backlog

Everything not finished, in one place. Rebuilt at the end of Session 20.

**Read the status literally.** *Spec'd* means the root cause is found and
written down; *not started* means nobody has looked.

**Currently shipped and green on `main`:** owner sweep 0 FAIL (the pass/info
split varies with tab visibility — rAF checks report INFO in a hidden tab),
duel harness `MPT.all()` clean, Sessions 19 through 22 complete, both balance
pins holding, duel / tri / twenty-seat arena soaking clean.

**The inventory, measured from the live registries rather than counted by
hand** (this line said 50 towers and 20 units for two sessions after the game
had 60 and 25 — and the missing ten and five were exactly the content with no
art, so the undercount hid the gap twice over): **60 towers** (12 per origin,
10 of them 2×2), **26 commanders** across **5 powers**, **25 units**, 20 boons,
15 maps, 188 art plates. Live on all three surfaces.

---

## Outstanding

### 1. Multiplayer — SHIPPED (Session 21)
`feature/multiplayer-20.6` is merged to `main` and live. The path there matters
more than the destination:

- The two harness failures closed — and the handoff's diagnosis of them was
  wrong. Not a test window: `contract()` read the LOCAL SAVE, so both
  commanders fielded a one-tower loadout, nothing died, and reanimation was
  unreachable by construction. The same root cause explains the isolation
  negative control "failing to fail".
- The adversarial audit then ran (four independent lenses) and returned
  **do-not-merge with seven blocking defects** the green suite could not see.
  All seven fixed, plus the two remaining majors (join deadline; `ctl`
  whitelist + peer-only message gate), under **NET_PROTOCOL 2**.
- **MPT: 40 pass / 0 fail**, including checks that pin each fix: a targeting
  change crossing the wire, the fingerprint carrying choices rather than
  counts, the batched frame halting on the draft's own tick, the frozen-tab
  verdict, the tri-world refusal, both exit paths, both lens escapes, and the
  stranger/ctl guards.

Full story: [`MULTIPLAYER-HANDOFF.md`](MULTIPLAYER-HANDOFF.md). Still open,
deliberately: WebRTC manual signalling for two MACHINES (BroadcastChannel is
same-origin, one machine) — designed for, not built.

### 2. Soul-shop surcharge (20.7i) — SHIPPED (Session 21)
The per-shop ladder is live: `soulPrice(kind, id)` is the one price expression,
`chargeSouls(kind, id)` books against `boughtBy[banner/kind]`, and the sharp
bug — CRYO costing 6 souls if you opened the arsenal first and 22 if you
recruited first — is gone. Migration proved against a legacy save; nobody is
charged more. Commit `4a7e62f`.

### 3. The art pack re-encode (20.7k) — SHIPPED (Session 21)
`write_pack` now ships cached bytes through untouched when format, mode and
size already match (188/188 do), and says how many passed through vs were
rebuilt. Measured: mean RMSE vs the source cache **2.493 → 0.0** across all
188 keys. Commit `c5f1508`.

---

### 4. The balance pins — FIXED, and re-baselined
`tools/balance-pins.js` now takes a **seed** and resets the AI prototype between
runs, and `PINS.selfTest()` reports `reproducible: true`.

The leak was that `AI` is a singleton *and* a prototype: `js/game.js:520-521`
gives each rival seat `Object.create(AI)` and `:533` also calls `AI.init(...)`
on the shared object, so a match left `spots` (148 entries), `samples` (206),
`side`, `diff`, `think` and `ready` behind. Same seed, same page, run 1 gave
wave 21 / 27480 steps and run 2 gave wave 20 / 26129. Restoring those six
fields makes run 2 byte-identical to run 1.

A seeded six-map baseline is now recorded in
[`BALANCE-BASELINE.md`](BALANCE-BASELINE.md) with the seeds to replay it.
Two documented claims did not survive it: **"every loss under wave 10" is
false** (coil 10, shattered 13, reproducibly), and the maxed **"median 27"** is
the top of the range, not the middle — the loss median is 22.

**Still open, and it is a question rather than a defect:** whether that same
prototype carry-over changes the real game's second match of a session. `init()`
does reassign both arrays via `buildSpots()`, so the mechanism is subtler than
"the arrays are stale". The harness is fixed either way; the game-side question
has not been run down.

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

## C. Owner decisions — RESOLVED (Session 21, round two)

The owner reviewed the docket and ruled on every row:

| Decision | Ruling |
|---|---|
| The one Krea 2 commander plate (`cmd_cadre`) | **1B — leave it.** "All the commanders look fine." The mixed plate is owner-accepted; BRAND.md rule 3's partial-upgrade concern is waived for this one key |
| "THE HARBINGER ENRAGES" | **2A — keep it.** Boss flavour, not the mechanic |
| Commander / second-ability unlock scope | **2B... no — 3B: widen the split.** Commanders and abilities are shelved per banner like towers, with the 4A grandfather: every existing flat list seeded onto every shelf, nobody loses anything. Shipped — `cmdUnlockedBy` / `abilUnlockedBy` in `js/commanders.js` |
| Grandfathered saves | **4A — keep the grandfather**, and it governed the 3B migration above |
| WebRTC two-machine duels | **5A — queued as the next feature.** In design |

And from the held-back fifteen: **#1 (recoverable stolen objective)** and **#4
(variable footprints, as two especially-powerful 2×2 towers per origin)** are
ordered built. The other thirteen remain held.

### The old table, for history

#### Owner decisions — nothing is blocked, but these are yours

| Decision | Context |
|---|---|
| **"THE HARBINGER ENRAGES"** | The only player-visible string still using the word. It is a *boss phase*, not the wave-bid mechanic — that is correctly named RESONANT FIELD everywhere. Renaming boss flavour is taste, so it was left rather than changed unasked |
| **Commander / ability unlocks** | Note 19.6 named *towers*. Commander and second-ability unlocks stayed install-wide, and the commander screen already filters to your faction. Widening the split was not assumed |
| **Grandfathered saves** | Existing profiles keep every tower they already owned on *every* faction shelf, and start the inflation ladder at zero. A stricter migration would take arsenals away from current players — a policy call, not a bug |
| **The one Krea 2 commander plate** | `cmd_cadre` is a Krea 2 render; the other twenty commanders are SDXL (proved: 0.5/255 mean diff vs `cache_krea`, 97/255 vs `cache`). That is the partial class upgrade BRAND.md rule 3 forbids, live on `main` now. Measured on this machine: Krea 2 is **~138 min/image at 1024px**, not the 83 min the docs recorded — so finishing the commander class is ~46 GPU-hours and the `foe_` class ~113. Re-render `cmd_cadre` on SDXL (minutes), accept the mismatch, or commit the GPU time. Owner's call — see the final amendment in [`BRAND.md`](BRAND.md) |
| **The fifteen held-back mechanics** | [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md) — still awaiting picks, see section E |

---

## D. Technical debt

All ten Session-19 items were closed in 20.7. What is left:

| Item | Where | State |
|---|---|---|
| Soul-shop surcharge | `Meta.soulPrice` / `Meta.chargeSouls`, `js/commanders.js` | ✅ shipped in Session 21 — per-shop ladders, order-independent, migration proved |
| `--pack` re-encodes every plate | `artgen/krea_gen.py` `write_pack` | ✅ shipped in Session 21 — byte passthrough when the cache already matches; RMSE 2.493 → 0.0 across 188 keys |
| `GX_VIEW.x` / `.y` inert | `js/config.js` | ✅ deleted in Session 21 — `GX_VIEW` is `{ w, h }` now, after re-proving `js/ui.js` reads `.w`/`.h` alone |
| Pinch-zoom | `js/ui.js` `GalaxyFX.pinch` / `zoomAt` | **Verified under synthetic MULTI-pointer events (Session 21)**, which is as far as this environment goes. Two pointers register; spread 100→200px takes z 1.0→2.0; pinch 200→50px takes it back to 0.5; it clamps at both `GX_ZOOM_MIN` 0.36 and `GX_ZOOM_MAX` 2.6; pointers clear on release. `zoomAt`'s anchor math is **exact** — world drift under the anchor is 0 with `clamp()` stubbed, and the drift you see with it live is the camera correctly being held inside the map bounds. Note `pinch()` deliberately ignores separations under 4px (anti-jitter), so a test that drives the fingers together past that point measures nothing. Still unverified on REAL hardware: no multi-touch device here |

---

## E. The held-back mechanics — TWO SHIPPED, THIRTEEN HELD

The owner picked **#1** and **#4** from the docket. Both are in and live:

- **#1 Recoverable stolen objective** — a leak becomes a chase. The unit turns
  around carrying the lives and only its EXIT charges; kill it and they were
  never lost. BRUTAL carries all three on one carrier. Commit `4a8fd73`.
- **#4 Variable footprints**, in the owner's shape: **ten 2x2 heavies, two per
  origin**, 50 towers -> 60. The footprint engine is 23 anchored edits;
  `docs/TOWER-AUDIT.md`'s uniqueness law holds across all sixty. Commit
  `7523182`.

Thirteen remain written up and unbuilt in
[`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md), unchanged: #2 scarring, #3 land
as a resource, #5 economy exposure, #6 FOCUS, #7 fog, #8 second spawn mouth,
#9 per-tower XP, #10 upkeep, #11 territory income, #12 rewind, #13 mazing,
#14 deployment points, #15 multi-deck.

### The original fifteen

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

## Session 22 — the summoning round

Eight owner items, all shipped. What is worth knowing later:

- **Five summoning rites, one conservation law.** `Game.corpseBudget` prices a
  corpse once; a doctrine may change the SHELL a kill returns in, never the
  MASS. CONSCRIPTION drafts from your roster, THE PROCESSION marches on a
  clock, THE BROOD incubates, LETTERS OF MARQUE buys everything with no
  ceiling on either bonus, THE LATTICE clones exactly and cannot buy at all.
  The **commander** carries the rite, not the banner — that is the mixing
  contract, and it is why a cross-faction commander brings their summoning to
  your flag while your roster supplies the soldiers.
- **THE PARALLEL** is real in `FACTIONS` and absent from `FACTION_ORDER`. That
  split is load-bearing: `FACTION_ORDER` is the powers the galaxy is fought
  over (world owners, arena seats, rivals) and `POWER_ORDER` is the powers
  that own troops. Adding the robots to the former would put machine
  garrisons on the map and machine bosses in seats.
- **A Parallel player never fields their own soldiers**, and that is by
  construction rather than by oversight: the Lattice clones what it kills and
  cannot buy. Robot units reach a lane when ANOTHER power captures them —
  their technology is a thing to be stolen. The RELAY doctrine and THE SPLICE
  both fire on that path and are proved doing so.
- **Everything campaign-shaped is a battle OPTION**, never read from the save:
  `ramp`, `systemIndex`, and the flattening they imply. That is what keeps
  skirmishes, duels and the balance pins measuring the engine rather than the
  campaign, and it was verified by running pre- and post-change builds
  back-to-back at parallel paths for a byte-identical pin.
- **The pin harness is only comparable within one session.** Measured the hard
  way this round: the same bundle returned different absolute numbers across
  sessions while staying `reproducible: true` within each. Compare A against B
  in ONE session at equivalent paths; never against a number written down on
  a different day.

Still open, and none of it new: the ten heavies have no `twr_` art plates, the
rival AI draft lists never learnt them, and the soul shop's five new firing
previews are unwired.

The pacing worry this round raised is CLOSED and was never real — measured
properly, pre-doctrine and post-doctrine builds swept back to back in one
session give a maxed loss median of 33 and 31, so expert matches got shorter
rather than longer. See BALANCE-BASELINE's "the delta that was not there".

---

## G. The outside review's unpatched items — ALL SIX SHIPPED (Session 22)

| # | Item | Where it landed |
|---|---|---|
| D2 | Damage-number toggle | OPTIONS row, default ON. The gate sits INSIDE `addFloater` **after** the `rand()` draw — presentation may never be visible to the simulation, or two duel clients with different display settings desync. Proved sim-neutral: pins byte-identical with it on and off |
| D3 | Escalation queueing | HOLD on the modal parks the sim but opens the board (`Game.boardInteractive`), with a chip to return. Abilities and musters keep their `playing`-only gates — they are timed acts |
| D4 | ARIA pass | Build bar (name/role/price/hotkey), HUD, speed, summon tiers, profile delete, talent clear. Canvas placement is still pointer-only and the battle card now SAYS so |
| D5 | Session stats | `Side.killLog` mirrors `leakLog`; a win gets THE HARVEST as a loss gets WHAT KILLED YOU, plus a second stats row from counters the sim already kept |
| D6 | Soul ceremony | The galaxy claim counts souls onto the total instead of a toast. Souls are banked BEFORE the animation, so a refresh loses the animation and never the souls |
| A4 | Difficulty ramp → **NEW GAME PLUS** | Converted per the owner: the choice unlocks after a galaxy is finished (`RAMP_PRESETS` veteran/onslaught/apex). VETERAN is provably the identity element — its two functions equal the retired ternaries — so a first galaxy and a veteran NG+ run play the game that shipped. The first galaxy is FLATTENED instead: relief tent to −35% at wave 8 rejoining the authored curve exactly at 15, types every 3 waves instead of 2, and no wave-5 miniboss in the opening system (the rota shifts rather than skips, so the teaching order survives). Every value is a battle OPTION, never read from the save, so skirmishes, duels and the pins keep the engine defaults |

---

## H. The old §G table, for history

An outside reviewer played the live site in Session 21 and sent a nine-patch
fixpack. Eight landed (see the commit); one is held in section C. But the
review's own §D listed six QoL wins and only ONE (refusal reasons) came with a
patch. The other five were never built, and I confirmed none of them exists:

| # | Item | Cost | Note |
|---|---|---|---|
| D2 | **Damage-number toggle**, default ON for new players | S | `NUM_SQUISH` already anticipates the readability lever; nothing renders per-hit numbers today |
| D3 | **Escalation-modal queueing** — let a build action queue, or show a countdown, during the halt | S | the halt is long on 20-seat boards, and the docs already note it |
| D4 | **ARIA pass** — 35 aria attributes against hundreds of icon buttons | M | and keyboard play is impossible after deploy: canvas placement is mouse-only. Either document that or add a grid-placement keyboard mode |
| D5 | **Session-stats screen** — deaths by type, reactions triggered, gold spent | M | every number already exists in sim state; this is presentation |
| D6 | **First-win soul ceremony** — souls pay instantly; a counter animation would land the reward | S | presentation only |
| A4 | **Player-chosen difficulty ramp** | S | the reviewer downgraded this themselves after finding the ramp is deliberate pacing (`commanders.js` depth<2 SKIRMISH, <5 CONTESTED, else OVERRUN). The kernel left is accessibility: no way to opt into an easier ramp |

None is a defect. All six are things a player would feel. Pick any and they get
built the same way everything else here did.

---

## F. What is actually left

Sessions 19–21 closed every technical item above. What remains is either an
**owner pick** (sections C, E and G), or **hardware this environment lacks**
(pinch-zoom on a real touchscreen). WebRTC manual signalling is no longer on
this list: it shipped in Session 21 round two and was proved across two
browsing contexts, sealed turns and all. There is no engineering backlog.

If you touch economy, AI or towers: the pins are SEEDED now — use
`PINS.once(map, seed)` per page load, run `PINS.selfTest()` first (must say
`reproducible: true`), and compare against the seeded baseline in
[`BALANCE-BASELINE.md`](BALANCE-BASELINE.md), same seed to same seed. The old
unseeded numbers cannot gate anything. If you touch `js/net.js`, `js/game.js`
or `js/ui.js`, run `MPT.all()` too, and bump `NET_PROTOCOL` if the command set
or fingerprint changes.
