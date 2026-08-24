# Multiplayer (20.6) — handoff

**Branch:** `feature/multiplayer-20.6`. **Deliberately not merged to `main`.**

`main` is what <https://majieddd.github.io> serves, and two of this feature's
strongest claims are *unproven* — not disproven, unproven. That is not a thing
to put in front of players on a note whose word was **ACTUALLY**.

---

## What was there before

`UI.mpSearch` faked a 3.6-second relay search with a `setTimeout`, then reported
*"No commander answered … The live relay comes online in a future update"* and
handed you an AI garrison skirmish. There was **no network layer of any kind**
in the codebase — no WebSocket, no fetch, no RTC.

## What this branch does

Adds **`js/net.js`**: a duel relay that puts two humans, on two clients, in one
battle.

- **Transport is `BroadcastChannel`** — the browser's own API, so not a
  dependency. Two windows of the game on one machine play each other with no
  server, no signalling and no setup, offline, from the single inlined file.
  That is the only design that satisfies the house rule (*no external
  libraries, ever*) while being genuinely two-client.
- **Above the wire it is deterministic lockstep**: commands cross, state does
  not. Both clients step the same simulation and exchange a fingerprint of it
  every turn.
- Six files touched: `js/net.js` (new), `tools/multiplayer_test.js` (new),
  **two** hooks in `js/game.js` and no more, `js/ui.js` (`mpSearch` becomes a
  real lobby), `index.html`, `build.js` (net.js between `game` and `ui`).

## Verified

- 8 anchors, two-phase, LF clean, all modules parse, both bundles build, and
  the bundle is self-contained (0 surviving `<script src=`).
- `Net` loads; the placeholder copy is gone (`mpSearchStillFake: false`).
- **`MPT.all()`: 19 pass / 2 fail of 24.**
- Command agreement is real: **musters 32/32 and sends 32/32** across the
  connection in a 7,200-step run.
- A remote muster does put units on this client's lane.

## The two failures, and what they actually mean

### 1. `net.pvp the send/muster/reanimate loop works across the connection`
> `wave 3 | musters 32/32 | sends 32/32 | kills 0/3`

**This is a test-window problem, not a divergence.** `a.sides` is one client's
two *seats*, not two clients — I misread it that way at first. The assertion
wants `sends > musters`, i.e. proof that reanimation fed the send loop. It
cannot pass here: the harness places 6 towers a seat and simulates 7,200 steps,
which reaches only **wave 3** and produces **0 and 3 kills**. Nothing died, so
nothing reanimated.

So the reanimate-across-the-wire claim is **unproven**, not broken. The muster
and send halves agree exactly (32/32), which is the part the test does reach.

**To close it:** raise the simulation to ~20,000 steps or start the contract at
a later wave so real combat happens, then assert `sends > musters` again.

### 2. `net.isolation OFF: the same two clients diverge`
> `STILL AGREED — the isolation is not what is holding them together`

This is a **negative control that failed to fail.** The test disables the
determinism isolation and expects the two clients to drift apart; they stayed in
agreement. Either the isolation is not what is producing determinism, or the
"off" switch does not actually disable it.

This is the one to take seriously. Lockstep that agrees for a reason you have
not identified is lockstep that will disagree later for a reason you also will
not identify. The engine runs a fixed 1/60 timestep, but `Math.random` is used
in places, so determinism is **not** free and something must be seeding or
routing it.

**To close it:** find every `Math.random` reachable from `Game.step`, confirm
which are seeded or made authoritative from one side, and make the control
genuinely toggle that mechanism. Until then the determinism guarantee is
asserted rather than demonstrated.

## Also worth knowing

- The audit for this feature never ran — all seven Session 20 audit agents died
  to a weekly usage limit (resets Aug 25). Everything above is my own
  verification, not an independent one. **This branch has had no adversarial
  review**, and on this project unaudited patches have twice shipped real bugs.
- BroadcastChannel is same-origin, same-browser. Two machines need the WebRTC
  path with manual copy-paste signalling, which is designed for but not built.

## Picking this up

```bash
git checkout feature/multiplayer-20.6
node build.js
python -m http.server 8471 --bind 127.0.0.1
# open aegis-protocol.html?v=1 in TWO windows, and:
#   paste tools/multiplayer_test.js, then MPT.all()
```

Fix the two above, get an adversarial audit on it, then merge. Do not merge on
19/24 — the note asked for multiplayer that *actually* works, and the honest
reading of 19/24 is "the transport is good and the guarantee is unproven".
