# Multiplayer (20.6), handoff

> **STATUS (Session 21): MERGED AND LIVE.** The two failures below were closed
> and their diagnosis here was WRONG: it was never a test-window problem but a
> harness save-state bug (`contract()` read the local save, so both commanders
> fielded a one-tower loadout; nothing died, so reanimation was unreachable by
> construction, and a match where nothing happens runs no cosmetic code, which
> is why the isolation negative control "failed to fail"). The adversarial
> audit this document asked for then ran, four independent lenses, and
> returned **do-not-merge with seven blocking defects** the 29/0 suite could
> not see: raw-written tower targeting parting the boards in ~100 ms, a
> page-killing abandon path, a hard deadlock on all ten contested worlds, the
> draft halting on different ticks per client, a frozen tab stalling the peer
> forever with no verdict, the seat lens escaping on the draw path, and a
> stranded draft modal starting a zombie match. All seven were fixed, plus the
> audit's two remaining majors (a join with no deadline; `ctl` as an open
> command port), under NET_PROTOCOL 6 (2 at the time of writing; the bumps carried targeting, the summoning rites, the relay/splice/compile state, unit talents, and in Session 26 the unit-role melee). **MPT: 37 pass / 0 fail, 3 INFO.** The section
> below is kept as history, read it as the state of Session 20, not of the
> code.

**Branch:** `feature/multiplayer-20.6`, merged to `main` in Session 21.

`main` is what <https://majieddd.github.io> serves, and two of this feature's
strongest claims are *unproven*, not disproven, unproven. That is not a thing
to put in front of players on a note whose word was **ACTUALLY**.

---

## What was there before

`UI.mpSearch` faked a 3.6-second relay search with a `setTimeout`, then reported
*"No commander answered … The live relay comes online in a future update"* and
handed you an AI garrison skirmish. There was **no network layer of any kind**
in the codebase, no WebSocket, no fetch, no RTC.

## What this branch does

Adds **`js/net.js`**: a duel relay that puts two humans, on two clients, in one
battle.

- **Transport is `BroadcastChannel`**, the browser's own API, so not a
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
two *seats*, not two clients. I misread it that way at first. The assertion
wants `sends > musters`, i.e. proof that reanimation fed the send loop. It
cannot pass here: the harness places 6 towers a seat and simulates 7,200 steps,
which reaches only **wave 3** and produces **0 and 3 kills**. Nothing died, so
nothing reanimated.

So the reanimate-across-the-wire claim is **unproven**, not broken. The muster
and send halves agree exactly (32/32), which is the part the test does reach.

**To close it:** raise the simulation to ~20,000 steps or start the contract at
a later wave so real combat happens, then assert `sends > musters` again.

### 2. `net.isolation OFF: the same two clients diverge`
> `STILL AGREED, the isolation is not what is holding them together`

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

- The audit for this feature never ran, all seven Session 20 audit agents died
  to a weekly usage limit (resets Aug 25). Everything above is my own
  verification, not an independent one. **This branch has had no adversarial
  review**, and on this project unaudited patches have twice shipped real bugs.
- BroadcastChannel is same-origin, same-browser. Two machines duel over the
  WebRTC path with manual copy-paste signalling, built in Session 21 round
  two: `NetRTC` (bottom of `js/net.js`) hangs a hand-signalled RTCDataChannel
  on the `Net.attach` seam, and ACROSS TWO MACHINES in the duel table
  (`UI.mpRtc`) is the ritual. No ICE servers: host candidates only, one LAN.

## Picking this up

```bash
git checkout feature/multiplayer-20.6
node build.js
python -m http.server 8471 --bind 127.0.0.1
# open aegis-protocol.html?v=1 in TWO windows, and:
#   paste tools/multiplayer_test.js, then MPT.all()
```

Fix the two above, get an adversarial audit on it, then merge. Do not merge on
19/24, the note asked for multiplayer that *actually* works, and the honest
reading of 19/24 is "the transport is good and the guarantee is unproven".

---

## WebRTC across two machines (Session 21, owner decision 5A). SHIPPED AND PROVEN

`NetRTC` in `js/net.js` hangs a second transport off the `Net.attach` seam the
file was built around: a hand-signalled `RTCDataChannel`, no server, no
library, no ICE servers (`NET_RTC_CONFIG = {}`), host candidates only. The
ritual is three copy-pastes, host makes an offer blob, guest answers with
one, host takes the answer, and every blob is base64 over JSON stamped with
`NET_PROTOCOL`, so two different builds refuse each other with a sentence
instead of desyncing. From the moment the channel opens, the lobby, the
lockstep, the seat lens and the guards run **unchanged**: the adapter is
`postMessage` + `onmessage` and JSON is the whole of the adaptation.

**What is verified.** The blobs generate and carry the protocol; a wrong-build
blob is refused with the honest message; the panel exists and Esc cancels it;
and the shipped same-machine path is provably untouched, **MPT 37 pass / 0
fail** with the RTC code in the build.

**What is verified, the ritual end to end, across two independent browsing
contexts.** Not a clone, not a stub: two separate documents, each with its own
`RTCPeerConnection`, driven through the real three-paste ritual by copying the
actual base64 blobs between them.

    host()   -> 880-byte offer blob, ICE gathering complete, protocol 2
    answer() -> 880-byte answer blob, ICE already connected
    accept() -> channel OPEN, connectionState connected, Net.ch === the adapter

Then real duel traffic, in both directions, through `Net.post` / `Net.receive`
rather than a hand-rolled harness:

  - a sealed turn arrived intact, `turn 7, seat 0, sum 12345`, and the build
    command inside it still carrying its tile and type
  - a heartbeat arrived carrying its turn
  - the guest's own sealed turn came back the other way, `seat 1`, intact
  - every message arrived **in order**, protocol-stamped and sender-stamped
  - a forged `ctl` naming `wave` was **refused by the whitelist over the RTC
    wire**, `Game.wave` never moved, so the guards written for
    BroadcastChannel apply to this transport identically, which is the whole
    point of hanging it off `attach`

The earlier one-page loopback failure was the harness, not the transport:
cloning a singleton and asking mDNS `.local` candidates to resolve to
themselves inside a single document is exactly the flaky case. Two real
contexts resolve them fine.

**What remains genuinely unknown** is network topology, and only that: two
separate MACHINES have not been tried, so NAT, firewalls and AP isolation are
untested. The protocol, the adapter, the guards and the packet path are proven.

If it fails on a LAN, the first two things to check are mDNS (guest Wi-Fi with
AP isolation blocks it) and whether both machines loaded the same build.
Adding a public STUN URL to `NET_RTC_CONFIG` would fix most NAT cases and is
the single place a fork would do it, deliberately absent, because a
third-party server in every duel's setup is exactly the external dependency
this project does not take.
