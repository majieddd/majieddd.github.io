# Cosmic Conquest, the standing backlog

Everything not finished, in one place. Rebuilt at the end of Session 20.

**Read the status literally.** *Spec'd* means the root cause is found and
written down; *not started* means nobody has looked.

**Currently shipped and green on `main`:** owner sweep 0 FAIL (the pass/info
split varies with tab visibility, rAF checks report INFO in a hidden tab),
duel harness `MPT.all()` clean, Sessions 19 through 22 complete, both balance
pins holding, duel / tri / twenty-seat arena soaking clean.

**The inventory, measured from the live registries rather than counted by
hand** (this line said 50 towers and 20 units for two sessions after the game
had 60 and 25, and the missing ten and five were exactly the content with no
art, so the undercount hid the gap twice over): **60 towers** (12 per origin,
10 of them 2×2), **26 commanders** across **5 powers**, **25 units**, 20 boons,
15 maps, **229 art plates** (re-measured 2026-08-26 by parsing `js/artpack.js`
directly rather than trusting this line: `cmd` 26, `fac` 5, `world` 106, `foe`
54, `abil` 12, `planet` 12, `twr` 11, plus `title`, `nebula`, `blackhole`. The
188 this line carried was the same undercount pattern its own parenthetical
warns about, not the ten missing heavies' art, which is a real, separate,
still-open gap tracked below). Live on all three surfaces.

---

## Outstanding

### 1. Multiplayer. SHIPPED (Session 21)
`feature/multiplayer-20.6` is merged to `main` and live. The path there matters
more than the destination:

- The two harness failures closed, and the handoff's diagnosis of them was
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

Full story: [`MULTIPLAYER-HANDOFF.md`](MULTIPLAYER-HANDOFF.md).

**WebRTC two-machine duels: BUILT AND MEASURED WORKING (Session 36).** This
section said "designed for, not built" for several sessions after it stopped
being true, and that stale line cost a later session real time re-deriving it.
Corrected with evidence rather than by assertion:

- `NetRTC` (js/net.js:1526+) is a complete hand-signalled transport: `host()`,
  `answer()`, `accept()`, `abort()`, `_gathered()` waits for ICE completion,
  and `NET_RTC_CONFIG` is empty on purpose, so no third party sits in a duel.
- It IS wired to the interface. `js/ui.js:2230-2377` sets `NetRTC.onState` and
  `NetRTC.onLink`, calls `host()` and `accept()`, and gives the guest a paste
  field (`#mv-rtc-take`). A grep for `Net\.` misses all of this because the
  object is `NetRTC`, not a member of `Net`. That is the trap.
- **Measured end to end on a composited page:** the whole ritual driven with
  two real `RTCPeerConnection`s in one document. Host offer 880 chars,
  `v=6`, `type=offer`. Guest answer 880 chars. After `accept()` both channels
  reached `open`, both peers reported `connectionState: "connected"`, and the
  string `DUEL-PING-42` was pushed from the host channel and arrived intact on
  the guest channel. Verdict: the transport works.
- Method note for whoever re-runs this: decode blobs with the engine's own
  `NetRTC._dec`. A probe that guessed a base64-JSON shape reported
  `blobIsOffer: false` against a perfectly healthy blob.

What is still genuinely absent is unchanged and deliberate: nothing MATCHES you
with a stranger. You bring the opponent and carry the two blobs across by hand,
which is what the title-screen copy already says in as many words.

### 2. Soul-shop surcharge (20.7i). SHIPPED (Session 21)
The per-shop ladder is live: `soulPrice(kind, id)` is the one price expression,
`chargeSouls(kind, id)` books against `boughtBy[banner/kind]`, and the sharp
bug. CRYO costing 6 souls if you opened the arsenal first and 22 if you
recruited first, is gone. Migration proved against a legacy save; nobody is
charged more. Commit `4a7e62f`.

### 3. The art pack re-encode (20.7k). SHIPPED (Session 21)
`write_pack` now ships cached bytes through untouched when format, mode and
size already match (188/188 do), and says how many passed through vs were
rebuilt. Measured: mean RMSE vs the source cache **2.493 → 0.0** across all
188 keys. Commit `c5f1508`.

---

### 4. The balance pins. FIXED, and re-baselined
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
the top of the range, not the middle, the loss median is 22.

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
| **A1 units (19.10-19.15)** | ✅ Mostly wiring, not building. 20 faction units already existed with art and per-map rescue already worked; they had simply never been connected. 61/62 checks |
| **A2 tower identity (19.20)** | ✅ 36 of 39 already unique. Three stat blocks given signatures, all five real pairs separated. 288/288 checks |
| **A3 boons (19.23-19.24)** | ✅ 20 boons, 5 per power, keyed to power × world kind. All proved live; five dormant engine mechanics woken |
| **B 11 new towers (19.21-19.22)** | ✅ 50 towers, ten per power, each naming a `base` key that appears nowhere else |
| **D technical debt** | ✅ All ten Session-19 items closed in 20.7, plus four extra name collisions the sweep found on its own |

The one lesson worth carrying: in four of those five, **reading the code first
changed what the task was.** The lane-blocking spawner already existed. The
units already existed. The boons' problem was the draw site, not the boons.
Measure before building.

---

## C. Owner decisions. RESOLVED (Session 21, round two)

The owner reviewed the docket and ruled on every row:

| Decision | Ruling |
|---|---|
| The one Krea 2 commander plate (`cmd_cadre`) | **1B, leave it.** "All the commanders look fine." The mixed plate is owner-accepted; BRAND.md rule 3's partial-upgrade concern is waived for this one key |
| "THE HARBINGER ENRAGES" | **2A, keep it.** Boss flavour, not the mechanic |
| Commander / second-ability unlock scope | **2B... no. 3B: widen the split.** Commanders and abilities are shelved per banner like towers, with the 4A grandfather: every existing flat list seeded onto every shelf, nobody loses anything. Shipped, `cmdUnlockedBy` / `abilUnlockedBy` in `js/commanders.js` |
| Grandfathered saves | **4A, keep the grandfather**, and it governed the 3B migration above |
| WebRTC two-machine duels | **5A, queued as the next feature.** In design |

And from the held-back fifteen: **#1 (recoverable stolen objective)** and **#4
(variable footprints, as two especially-powerful 2×2 towers per origin)** are
ordered built. The other thirteen remain held.

### The old table, for history

#### Owner decisions, nothing is blocked, but these are yours

| Decision | Context |
|---|---|
| **"THE HARBINGER ENRAGES"** | The only player-visible string still using the word. It is a *boss phase*, not the wave-bid mechanic, that is correctly named RESONANT FIELD everywhere. Renaming boss flavour is taste, so it was left rather than changed unasked |
| **Commander / ability unlocks** | Note 19.6 named *towers*. Commander and second-ability unlocks stayed install-wide, and the commander screen already filters to your faction. Widening the split was not assumed |
| **Grandfathered saves** | Existing profiles keep every tower they already owned on *every* faction shelf, and start the inflation ladder at zero. A stricter migration would take arsenals away from current players, a policy call, not a bug |
| **The one Krea 2 commander plate** | `cmd_cadre` is a Krea 2 render; the other twenty commanders are SDXL (proved: 0.5/255 mean diff vs `cache_krea`, 97/255 vs `cache`). That is the partial class upgrade BRAND.md rule 3 forbids, live on `main` now. Measured on this machine: Krea 2 is **~138 min/image at 1024px**, not the 83 min the docs recorded, so finishing the commander class is ~46 GPU-hours and the `foe_` class ~113. Re-render `cmd_cadre` on SDXL (minutes), accept the mismatch, or commit the GPU time. Owner's call, see the final amendment in [`BRAND.md`](BRAND.md) |
| **The fifteen held-back mechanics** | [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md), still awaiting picks, see section E |

---

## D. Technical debt

All ten Session-19 items were closed in 20.7. What is left:

| Item | Where | State |
|---|---|---|
| Soul-shop surcharge | `Meta.soulPrice` / `Meta.chargeSouls`, `js/commanders.js` | ✅ shipped in Session 21, per-shop ladders, order-independent, migration proved |
| `--pack` re-encodes every plate | `artgen/krea_gen.py` `write_pack` | ✅ shipped in Session 21, byte passthrough when the cache already matches; RMSE 2.493 → 0.0 across 188 keys |
| `GX_VIEW.x` / `.y` inert | `js/config.js` | ✅ deleted in Session 21, `GX_VIEW` is `{ w, h }` now, after re-proving `js/ui.js` reads `.w`/`.h` alone |
| Pinch-zoom | `js/ui.js` `GalaxyFX.pinch` / `zoomAt` | **Verified under synthetic MULTI-pointer events (Session 21)**, which is as far as this environment goes. Two pointers register; spread 100→200px takes z 1.0→2.0; pinch 200→50px takes it back to 0.5; it clamps at both `GX_ZOOM_MIN` 0.36 and `GX_ZOOM_MAX` 2.6; pointers clear on release. `zoomAt`'s anchor math is **exact**, world drift under the anchor is 0 with `clamp()` stubbed, and the drift you see with it live is the camera correctly being held inside the map bounds. Note `pinch()` deliberately ignores separations under 4px (anti-jitter), so a test that drives the fingers together past that point measures nothing. Still unverified on REAL hardware: no multi-touch device here |

---

## E. The held-back mechanics. THREE SHIPPED, TWELVE HELD

The owner picked **#1** and **#4** from the docket. Both are in and live:

- **#1 Recoverable stolen objective**, a leak becomes a chase. The unit turns
  around carrying the lives and only its EXIT charges; kill it and they were
  never lost. BRUTAL carries all three on one carrier. Commit `4a8fd73`.
- **#4 Variable footprints**, in the owner's shape: **ten 2x2 heavies, two per
  origin**, 50 towers -> 60. The footprint engine is 23 anchored edits;
  `docs/TOWER-AUDIT.md`'s uniqueness law holds across all sixty. Commit
  `7523182`.

Thirteen remain written up and unbuilt in
[`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md), unchanged: #2 scarring, #3 land
as a resource, #5 economy exposure, #6 FOCUS, #7 fog,
#9 per-tower XP, #10 upkeep, #11 territory income, #12 rewind, #13 mazing,
#14 deployment points, #15 multi-deck.

### The original fifteen

From the mechanics dossier, deliberately **not** implemented pending your picks.
Full write-ups with build notes in [`MECHANICS-OPTIONS.md`](MECHANICS-OPTIONS.md).

1. Recoverable stolen objective, a leak becomes a timed recovery window
2. Persistent battlefield scarring, wreckage denies rival build tiles
3. Land as a purchasable or depleting resource
4. Variable tower footprints
5. Economy structures must survive to pay (jam gates VAULT income)
6. Commander attention as an economic resource (FOCUS)
7. Fog over the rival board / visibility-gated placement
8. ~~Mutable destination, or a second spawn mouth~~, **SHIPPED** in Session 22 as THE SPLICE: a Vigil SPLICER killed on your ground cuts a temporary second lane into your board for one wave (`Game.openSplice`)
9. Per-tower usage XP
10. Tower upkeep / supply priority
11. Territory-linked income
12. Checkpoint rewind
13. Open-field shortest-path mazing
14. Deployment points as a second placement currency
15. True 3D / multi-deck vertical mazing

---

## Session 22, the summoning round

Eight owner items, all shipped. What is worth knowing later:

- **Five summoning rites, one conservation law.** `Game.corpseBudget` prices a
  corpse once; a doctrine may change the SHELL a kill returns in, never the
  MASS. CONSCRIPTION drafts from your roster, THE PROCESSION marches on a
  clock, THE BROOD incubates, LETTERS OF MARQUE buys everything with no
  ceiling on either bonus, THE LATTICE clones exactly and cannot buy at all.
  The **commander** carries the rite, not the banner, that is the mixing
  contract, and it is why a cross-faction commander brings their summoning to
  your flag while your roster supplies the soldiers.
- **THE VIGIL** is real in `FACTIONS` and absent from `FACTION_ORDER`. That
  split is load-bearing: `FACTION_ORDER` is the powers the galaxy is fought
  over (world owners, arena seats, rivals) and `POWER_ORDER` is the powers
  that own troops. Adding the robots to the former would put machine
  garrisons on the map and machine bosses in seats.
- **A Vigil player never fields their own soldiers**, and that is by
  construction rather than by oversight: the Lattice clones what it kills and
  cannot buy. Robot units reach a lane when ANOTHER power captures them
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

**Re-verified 2026-08-26, one true and two stale.** The ten 2x2 heavies (ground
truth from the engine itself, `TOWER_TYPES[id].foot[0] === 2`: `bombard`,
`coldfront`, `quadmount`, `reactor`, `carronade`, `stokehold`, `suture`,
`impaler`, `monstrance`, `pharos`, two per origin as the feature promised) are
the one genuinely still open: all ten have `hasArt: false` in `js/artpack.js`.
The other two clauses are stale and now corrected:

> **AMENDED the same day, because "the ten heavies" understates it.** A full
> coverage count over `js/artpack.js` says **49 of 60 towers have no plate**,
> and the heavies are simply a subset of those 49. The eleven that DO have one
> are `sepulchre`, `orison`, `antiphon`, `gestalt`, `maw`, `veil`, `pressgang`,
> `privateer`, `bloodprice`, `replicator`, `nullfield`. Nothing is broken by
> this: towers draw procedurally on canvas (owner-sweep 22.10 passes) and
> `artImg` returns empty for a missing key. The defect is consistency, not
> function, and it is the partial class upgrade `BRAND.md` rule 3 forbids.
> Commanders (26/26), factions (5/5) and units (54/54) are all complete. See
> `OWNER-NOTES-LORE.md` D2 for the three ways out and what each costs.

- **The rival AI draft lists already learnt them.** `js/ai.js:129` names it
  outright: "THE HEAVIES BELONG IN THESE LISTS. They are already draftable."
  All ten are present across `DAMAGE` and `AIR`.
- **The soul shop's firing previews are wired for all ten**, measured on a
  fresh, untouched profile: `UI.openSoulShop()` emits a `[data-preview]` node
  for every one of the ten heavy ids, zero missing. (An earlier attempt at
  this same check force-unlocked every tower first, which hides the ARSENAL
  section's preview by construction, since it renders only unbought entries,
  and produced a false "4 missing" reading against four ids, `intertie`,
  `siegetrain`, `extinction`, `theophany`, that turned out not to be tower ids
  at all: an over-eager regex had pulled them from a branch/ascension's own
  `id:` field nested inside a different tower's block. Neither error survived
  a check against the live engine rather than the source text.)

What remains is purely a GPU-time question, not a wiring one: ten renders.
`~/.claude/skills/aegis-gamedev/SKILL.md`'s own numbers disagree with each
other on the cost (Krea 2 Turbo 4-bit or SDXL-Turbo at "~4.5s each" in one
place, "~138 min/image" measured on this machine in `BACKLOG.md`'s own owner-
decision table elsewhere), so pin down which pipeline and settings actually
apply before budgeting the run rather than trusting either number cold.

The pacing worry this round raised is CLOSED and was never real, measured
properly, pre-doctrine and post-doctrine builds swept back to back in one
session give a maxed loss median of 33 and 31, so expert matches got shorter
rather than longer. See BALANCE-BASELINE's "the delta that was not there".

---

## G. The outside review's unpatched items. ALL SIX SHIPPED (Session 22)

| # | Item | Where it landed |
|---|---|---|
| D2 | Damage-number toggle | OPTIONS row, default ON. The gate sits INSIDE `addFloater` **after** the `rand()` draw, presentation may never be visible to the simulation, or two duel clients with different display settings desync. Proved sim-neutral: pins byte-identical with it on and off |
| D3 | Escalation queueing | HOLD on the modal parks the sim but opens the board (`Game.boardInteractive`), with a chip to return. Abilities and musters keep their `playing`-only gates, they are timed acts |
| D4 | ARIA pass | Build bar (name/role/price/hotkey), HUD, speed, summon tiers, profile delete, talent clear. Canvas placement is still pointer-only and the battle card now SAYS so |
| D5 | Session stats | `Side.killLog` mirrors `leakLog`; a win gets THE HARVEST as a loss gets WHAT KILLED YOU, plus a second stats row from counters the sim already kept |
| D6 | Soul ceremony | The galaxy claim counts souls onto the total instead of a toast. Souls are banked BEFORE the animation, so a refresh loses the animation and never the souls |
| A4 | Difficulty ramp → **NEW GAME PLUS** | Converted per the owner: the choice unlocks after a galaxy is finished (`RAMP_PRESETS` veteran/onslaught/apex). VETERAN is provably the identity element, its two functions equal the retired ternaries, so a first galaxy and a veteran NG+ run play the game that shipped. The first galaxy is FLATTENED instead: relief tent to −35% at wave 8 rejoining the authored curve exactly at 15, types every 3 waves instead of 2, and no wave-5 miniboss in the opening system (the rota shifts rather than skips, so the teaching order survives). Every value is a battle OPTION, never read from the save, so skirmishes, duels and the pins keep the engine defaults |

---

## H. The old §G table, for history

An outside reviewer played the live site in Session 21 and sent a nine-patch
fixpack. Eight landed (see the commit); one is held in section C. But the
review's own §D listed six QoL wins and only ONE (refusal reasons) came with a
patch. The other five were never built, and I confirmed none of them exists:

| # | Item | Cost | Note |
|---|---|---|---|
| D2 | **Damage-number toggle**, default ON for new players | S | `NUM_SQUISH` already anticipates the readability lever; nothing renders per-hit numbers today |
| D3 | **Escalation-modal queueing**, let a build action queue, or show a countdown, during the halt | S | the halt is long on 20-seat boards, and the docs already note it |
| D4 | **ARIA pass**, 35 aria attributes against hundreds of icon buttons | M | and keyboard play is impossible after deploy: canvas placement is mouse-only. Either document that or add a grid-placement keyboard mode |
| D5 | **Session-stats screen**, deaths by type, reactions triggered, gold spent | M | every number already exists in sim state; this is presentation |
| D6 | **First-win soul ceremony**, souls pay instantly; a counter animation would land the reward | S | presentation only |
| A4 | **Player-chosen difficulty ramp** | S | the reviewer downgraded this themselves after finding the ramp is deliberate pacing (`commanders.js` depth<2 SKIRMISH, <5 CONTESTED, else OVERRUN). The kernel left is accessibility: no way to opt into an easier ramp |

None is a defect. All six are things a player would feel. Pick any and they get
built the same way everything else here did.

---

## Session 23, the closing round

Everything the Session-22 audit left open, closed. Each item is pinned by a
new check so it cannot quietly come back.

| # | What was wrong | Where | Pin |
|---|---|---|---|
| P3 | 22 of 60 towers do no damage, and the shop stage fired a projectile out of every one of them into a dummy that flashed white as it died; 15 more hit instantly and were drawn lobbing a shell | `js/ui.js` `runTowerPreview` | sweep 23.4 |
| P4 | The OPTIONS battle seed was read at the campaign launch only, so practice and the Maelstrom silently ignored a setting that never said it was campaign-only | `js/ui.js` `battleSeed` | sweep 23.3 |
| P5 | GUNSKIFF's card marched it down the lane while the badge above it said FLIES THE MAZE | `js/ui.js` `runUnitPreview` | measured 128 lit px above the lane vs 35 below |
| P7 | BOMBARD's dead zone was enforced by `acquire()` and invisible everywhere else: no stat row, and a solid range disc claiming ground it cannot reach | `js/ui.js`, `js/game.js` | sweep 23.5 |
| P8 | `lastInterest` and `lastMuster` were written every wave and read by nobody | `js/ui.js` | live in the bank row and the POWER ledger |
| P12 | The append-only rule for the five index-coupled tables lived only in a comment | `js/net.js` `lockstepAudit` | sweep 23.1, and 23.2 bends a table to prove 23.1 can fail |
| G6 | Five towers the rival builds and could never upgrade: the scorer valued every upgrade by added damage, and these do none | `js/ai.js` `utilityUpgradeGain` | sweep 23.6 |
| G9/G12 | The Vigil shipped with no art: 5 commanders, 5 units, 1 crest | `artgen/`, `js/artpack.js` | sweep 22.13 ledger reads 0 unpainted |
| P13 | Docs described a smaller game than the one that ships, and several records contradicted each other | `README`, `CONTRIBUTING`, `docs/` | measured against the live registries |

**Two of these were my own measurement errors before they were fixes**, and
both are worth remembering because both looked like defects in the code:

- The first dead-zone probe centred a 2x2 build ghost mid-TILE instead of
  mid-RECTANGLE and read a displaced hole as a broken one.
- A contact sheet of new art was read off by one cell, so a round was spent
  "fixing" `foe_splicer`, which was already correct, while `foe_gantry`, the
  actual failure, went untouched. Label your sheets.

Gates after: **owner sweep 46 pass / 0 fail / 3 info**, **MPT 37 pass / 0
fail**, NET_PROTOCOL 5. The three INFOs are the documented skips: the boss
flavour line "THE HARBINGER ENRAGES" (an owner call), a check needing a
campaign profile, and a check needing a fronted tab.

---

## Session 24. THE OWNER'S FOUR CALLS, ANSWERED

The four decisions held over from Session 23. The owner ruled on all four;
what follows is what each turned out to mean once the code was read.

| # | The call | What shipped |
|---|---|---|
| O1 | *"Yes they should be, to give replayability to other faction runs."* | **THE RENEGADE WORLD.** One per system: a splinter of your own power that will not stand down. It is the only ground that pays your own power's boons, and deliberately the only place your own soldiers march against you. |
| O2 | *"Your commander will facilitate the way your units are made. For now it should be that you can mix units between commanders."* | The rite already followed the commander and vaulted units already mixed, both verified before touching anything. What did NOT hold: **EQUIP was obeyed on one battle path out of three.** |
| O3 | *"As you get through the campaign, the AI should progressively use more advanced tactics."* | **A five-rung tactic ladder.** T2 is today's rival and the floor outside the campaign; the campaign opens below it and climbs past it to re-aiming and selling. |
| O4 | *"unsure what this means, but use your best judgement."* | The literal question cannot arise, a duel is never fought over a contested world. The **garrison skirmish that replaces the refused duel** was fielding generic rivals instead of the two powers actually fighting over it. |

### What the adversarial pass caught that I did not

O1 shipped once before it was right. The renegade world read the world's own
**kind** for its boon key, and kinds are weighted, so four draws landed all
four kind-keyed boons in about **4%** of galaxies, 2.3 of 4 on average.
"Reachable" would have quietly meant "eventually, across many runs" rather
than "in this run". Cycling the key by system index, apex on the last, makes
it **min 5, max 5, avg 5.00 in every galaxy** for all four powers.

Four more, all real: THE VIGIL was being given renegade worlds despite
owning none of the twenty boons (its splinter would have seated a machine
commander and spoiled the secret faction); `applyRivalHoldings` could stamp a
rival over a renegade world while the flag stayed true; `worldAllegiance` had
no renegade state, so the map said "held" for ground you do not hold and a
conquered renegade world kept the mark; and `.br-renegade` read `--fc` from a
sibling, rendering grey for all four powers.

### Two harnesses of mine that lied

1. **Re-aiming made the rival worse and I only knew because I measured it.**
   The first version reasoned freely from the threat profile. config.js had
   already written down why that fails: FIRST is *"the default, and usually
   correct"*, and WEAK *"maximises kills and reanimation output"*, an
   offensive property on a defensive board.
2. **My head-to-head rig was not reproducible.** The player-side brain ran
   outside the seeded window, so the same config twice in one page gave wave
   22/15 lives then wave 20/1. Every number built on it was noise. Rebuilt on
   `PINS`' own capture/restore rig and verified `reproducible: true` first.

### The evidence

Old and new bundles built, served at parallel paths, measured back to back in
**one session**, identical step for step:

| pin | before | after |
|---|---|---|
| `selfTest(0,1234)` | 23 waves / 28781 steps | 23 / 28781 |
| `fresh(3,1000)` | 8/11697 · 10/14330 · 10/14252 | identical |
| `maxed` map 0 tier 0 | 28 waves / 34312 steps, win, lives [35,0] | identical |

And the galaxy PRNG stream is frozen: **7,000 worlds across 5 powers × 40
seeds, zero non-renegade fields moved.**

Gates: **sweep 52 pass / 0 fail** (24.1–24.4 added), **MPT 37 pass / 0 fail**,
NET_PROTOCOL still 5, nothing changed a message shape, a fingerprint term or
an index-coupled table, so no bump is owed.

---

## F. What is actually left

Sessions 19–21 closed every technical item above. What remains is either an
**owner pick** (section E's twelve held mechanics), or **hardware this
environment lacks** (pinch-zoom on a real touchscreen). The four standing
owner DECISIONS, O1 boons of your own power, O2 the equipped commander in
skirmishes, O3 the rival's tactics, O4 the contested-world garrison, were
ruled on and shipped in Session 24 above. WebRTC manual signalling is no longer on
this list: it shipped in Session 21 round two and was proved across two
browsing contexts, sealed turns and all. There is no engineering backlog.

If you touch economy, AI or towers: the pins are SEEDED now, use
`PINS.once(map, seed)` per page load, run `PINS.selfTest()` first (must say
`reproducible: true`), and compare against the seeded baseline in
[`BALANCE-BASELINE.md`](BALANCE-BASELINE.md), same seed to same seed. The old
unseeded numbers cannot gate anything. If you touch `js/net.js`, `js/game.js`
or `js/ui.js`, run `MPT.all()` too, and bump `NET_PROTOCOL` if the command set
or fingerprint changes.

---

## Session 25. THE OWNER'S BUG REPORT

Six items. Three were bugs, three were "check this was really implemented".

### The freeze, and the pause that would not lift

They are the same defect seen twice. `Game.loop` booked the next frame on
its **last line**, with no `try`. `draw()` carries no handler of its own
verified, zero in its first 120 lines, so any throw in `step()` or `draw()`
skipped the reschedule and the loop stopped for good. The board froze, the HUD
kept taking clicks, and the pause button toggled a flag nothing was left to
read. The reschedule now happens in a `finally`; the error is reported once per
distinct message and parked on `Game.loopErrors`, never swallowed.

Three concrete ways in were found and closed:

1. **A permanently poisoned camera.** `clamp` returns NaN unchanged. NaN
   compares false against everything, which is right for the simulation and
   fatal at a boundary. The drag handler divided by
   `getBoundingClientRect().width`, which is `0` while the canvas is hidden or
   mid-layout, and `0 * (width / 0)` is NaN. One such frame put NaN in `cam.x`
   and **nothing could wash it out**: `ctx.setTransform` silently ignores a
   non-finite matrix, so the board stopped moving while the sim carried on. A
   `fin` guard now sits at the camera boundary, deliberately *not* a change to
   `clamp`, which the pins were measured through.
2. **A hard `ReferenceError` one authored field away from firing every frame.**
   `Tower.updateCone`'s puddle block reads `target`, declared `const` inside
   the `else` branch above it. Any tower with both `sweepRate` and `puddle`
   throws. No shipped stat block pairs them, which is the only reason it has
   never been seen.
3. **The HUD is called from inside the simulation.** `Game.step` ends with
   `UI.syncLive()`, unguarded. A throw there skipped `this.acc -= STEP`, so two
   clients whose HUDs threw on different frames disagreed about the
   accumulator, a determinism fix as much as a robustness one.

### The Federation of Light, two causes, not one

The rite was correct all along. What was wrong sat either side of it:

- **Nothing to put in order.** Every profile opened with `['crawler']`, one
  Vigil machine. Two rites read the detachment as a **list** rather than a bag
 the Procession marches it in order, the Human draft rolls from it, and on
  a list of one there is no order to see. A banner now brings its own lightest
  soldier, derived from the roster: trooper, votary, chitling, cutter, stitch.
- **The clock kept office hours.** `tickProcession` was gated on
  `!this.waveRunning`, and `procTimer -= dt` sits *after* the gate, so between
  waves it did not pause, it did not **tick**. Most of the nine-second cadence
  was spent not counting. Measured: 25 bodies to wave 11 before, **63 after**.

All five rites were then verified behaviourally, not read: Human drafts at
random from the detachment; the Federation marches in order and compounds;
the Brood leaves live incubators; the Lattice clones the **exact enemy killed**
(crawler/blink/sprinter, not its own detachment); and the Pirates take **zero**
free bodies from 78 kills, with power and econ genuinely uncapped.

### The five skews

Humanity and the Vigil already read correctly and were left alone. The other
three each carried a single number that said nothing about how they play. They
needed a new hook: `FACTIONS[x].apply` runs *before* any commander is seated and
`Meta.applyTo` then does `side.traits = freshTraits()`, so anything written to
traits was thrown away before the first wave, which is why every existing
`apply()` writes mods. `applyLate` runs once every seat is filled and folded.

### The board is the screen

Immersive mode already did what was asked and was an opt-in toggle nobody
found. It is the default now, and the right column is a visible layer over the
board, not a drawer parked off the edge, fading only while you are placing.

### What did not reproduce

"The maps keep changing in the galaxy just from loading in/out." A galaxy is
rebuilt from its seed on every load and generation proved pure across reloads
and across a real saved campaign. Check **25.1** now asserts it, four powers ×
four seeds, regenerated twice each, identical every time, so if it does drift,
the sweep says so rather than a player noticing.

### The simulation moved, and it is not being reported as neutral

The fresh pin goes 23 waves / 28781 steps to 24 / 29415, and its outcome flips
to a near-run loss with the rival on 2 lives. That is the skews and the fuller
detachment doing what they were asked to do.

Gates: **sweep 56 pass / 0 fail**, **MPT 37 pass / 0 fail**, NET_PROTOCOL 5.

## Open: one planet plate needs a deliberate re-roll

`pcut_00_robot_1` must be re-rendered:

```bash
python artgen/krea_gen.py --force pcut_00_robot_1
python artgen/krea_gen.py --pack
```

**Why.** Systems 00 and 01 are being re-painted under the section 3 content
law, so for those ten keys `cache_krea/` is deliberately ahead of `art/` until
the next pack. On 2026-08-27 I deleted this key's cache entry while cleaning up
after an `ingest_art.py` test, the fixture I meant to remove shared a name
with a real plate, and restored it from `art/`, which is the *pre-content-law*
version. Nothing shipped broke: `art/` is what the live site serves and it is
unchanged and committed. But this key is now the only member of the re-painted
set whose cache matches the old pack, so a pack today would give system 00 four
new plates and one old one.

The GPU was mid-batch with ~13.9GB free against a ~10GB pipeline, and losing a
multi-hour render to reclaim one 46s plate is the wrong trade, so this is
written down rather than done. The seed is FNV-1a of the key, so `--force`
reproduces the intended plate exactly.

**The lesson worth keeping.** A test fixture named `<real_key>.png` is a loaded
gun: `ingest_art.py` correctly *skipped* it as already-cached, and the damage
came from the cleanup line that deleted "my" file afterwards. Fixtures for this
pipeline must use keys that cannot collide with the catalogue, and cleanup must
delete by path it created, never by key it guessed.
