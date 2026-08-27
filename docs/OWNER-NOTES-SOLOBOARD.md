# Owner notes: commanderless boards, patrol units, bounded swarms

Tracked per the standing rule. Status moves to done only with the measurement
that proves it. Legend: `[ ]` open, `[~]` in flight, `[x]` done and measured.

Owner report, verbatim in substance: on worlds whose scenario has no
commander there is still commander dialogue; the map still shows an enemy
side it should not; summoning should stay available so units can hold guard
and patrol back around when they break through; some swarms should be bounded
by a wave count; and the co-contributor's procedural generation must keep
working.

## A. Blocking defects found first

### A1. Every campaign battle threw before this batch
`[x]` **MEASURED in a browser, before any other work.** The uncommitted map
seed salt declared `const mapSeed` and then did `mapSeed += ':' + seed`, so
`Game.start` threw `TypeError: Assignment to constant variable` on every
campaign battle: every campaign carries a seed and every campaign battle
passes `opts.world`, so both branches were always taken. `node --check`
cannot see it because it is a runtime error, and no harness drives
`Game.start` on the campaign path, so `gate.js` stayed green over an
unstartable campaign. One word, `const` to `let`. Proof: the same probe
returned `started:false, TypeError` before and `started:true` after.

### A2. Every campaign world of the same map family shared one board
`[x]` **MEASURED.** The seed line's own comment claimed campaign passes
`world` as a full object and read `opts.world.id`, but `js/ui.js:520`'s own
comment says campaign passes the world ID STRING, same as multiplayer's
`worldId`. `opts.world.id` on a string is `undefined`, so the base seed fell
through to the literal `'default'` on every campaign battle regardless of
which world it was. MEASURED before the fix: 16 of 16 same-family campaign
worlds sampled (a fresh galaxy's twin-channel worlds) came back
byte-identical boards, one map wearing many names. Fixed by reading
`opts.world` itself as the id, matching every OTHER reader of it
(`js/game.js:372`) and the comment's own stated intent. MEASURED after: 0 of
14 same-family collisions across a fresh sample. This is the mechanism the
co-contributor's own comment describes ("two campaigns that happen to hold
the same world fight on different boards"), now actually reading a value.

## B. The owner's four items

### B1. No commander dialogue where there is no commander
`[x]` **MEASURED on a real campaign battle.** `showBattleIntro` read
`Game.sides[1]` unconditionally for a portrait, a name and a line of
dialogue; on a survive board that seat is a swarm with nobody behind it, so
the VS screen staged a conversation with empty air. Guarded at the one call
site (`!Game.soloSurvive`), matching the precedent `victoryExchangeHtml`
already set for the post-battle line. Proof: driving `UI.deploy()` through
the real world-select path onto a commanderless world, `#battle-intro` never
opens (`introShown: false`); the same path on an ordinary duel still opens it.

### B2. No enemy side on a board that has no opponent
`[x]` **MEASURED, and screenshotted.** Root cause: `scenario.spawn`
(`'neutral'` vs `'enemyside'`) was declared on all five commanderless
scenarios and read nowhere in the codebase, so every survive board painted a
full rival: an HTML rival HUD panel (name, gold, towers, a lives bar), a
base ring and glow at the far seat, a `♥ N / RIVAL` pip floating over it, a
dashed "two facing halves" corridor down the middle, and the far half's
ground tinted in the rival's colour. All five suppressed under
`Game.soloSurvive`, each the smallest change at its own draw site rather
than a seat-count reduction (see the rejected approach below): the HUD panel
via a `solo-field` body class (same idiom as the existing `tri-field` one),
the base ring and pip via a capped loop bound, the corridor via a bail next
to its existing `!FIELD.radial` one, and the territory tint by remapping the
far seat to neutral in the paint loop's local copy of `side` (not
`FIELD.buildMax`, so build rules are untouched). The world-BRIEFING preview
card carried the identical defect one screen earlier (drawing a second base
and a second seat's lane on a commanderless world's tooltip, before the
player has even started the fight) and is fixed the same way, threaded
through `mapPreviewBlock`/`previewModel`/`buildPreview` as a `solo` option.
Proof: `previewSeats:1, previewBaseCount:1, previewLaneCount:1` for a real
solo world's card against `twoSidedBaseCount:2` for the identical map and
seed with the flag off; a real screenshot of a live solo battle shows a base
ring at the player's own seat and nothing at the mirrored position, with the
terrain (rubble, elemental nodes) still symmetric, because that is real
ground the swarm still walks, just not a rival's ground.

**Rejected approach, and why:** dropping `Game.sides` to length 1 on a solo
board was the literal reading of "structured without an enemy side," but a
dedicated read-only audit found it would throw in roughly 15 places across
`Game.start`'s rival-kit block, `UI.syncLive` (runs at 8Hz), `UI.showEnd`,
and every `tools/` harness that touches a solo board, plus a silent
territory-collapse in `buildField` where `Math.min`/`Math.max` over a single
lane's centre columns shrinks the whole buildable area. That is surgery
disproportionate to a visual complaint; keeping the two-seat engine
structure and suppressing what the PLAYER sees is the smaller, provably
correct change.

### B3. Summoning stays open, and units patrol
`[ ]` Scoping question sent to the owner: `muster()` spawns a plain `Enemy`
object aimed at a rival's base (`hostileTo: <rival seat>`); there is no
friendly-vs-hostile combat system in this engine and no unit that can stand
in a lane and fight, and hostile creeps have no concept of noticing or
attacking an obstacle, they walk a fixed path to a base. "Hold guard" and
"patrol" have no existing mechanic to extend, so the honest engineering
choices differ in scope by roughly an order of magnitude depending on
whether a summoned guard is meant to fight, to soak damage without fighting,
or to be a cosmetic walk with no mechanical effect.

### B4. Some swarms bounded by a wave count
`[x]` **MEASURED, full run.** `scenario.kind` (`'survive'` vs `'endless'`)
was, like `spawn`, declared and never read: the only exit from every swarm
was losing, scored on the wave you died at. Added `scenario.surviveWaves` and
`Game.checkSurviveWin()` (ticks every `step()`, seat-count independent):
once that wave has spawned, is not still spawning, and nothing hostile to
seat 0 remains alive, the match ends as a WIN. Bounded THE SWARM (20),
OVERRUN (18), SWARM DEFENSE (20) and REINFORCEMENT LINE (20); THE LONG VIGIL
stays endless on purpose, "No end. Stand as long as you can." is its whole
identity, and "some" swarms was the owner's own word. Proof: a real campaign
deploy onto THE SWARM, clock driven forward with every spawned enemy killed
so nothing ever leaks, ends at `state:'over', wonSwarm:true, finalWave:20`
after 1778 simulated steps, not a timeout and not a loss.

## C. Constraint

### C1. The co-contributor's procedural generation keeps working
`[x]` **MEASURED, 360 boards.** All 15 families x 24 seeds each: 0 malformed
boards, 0 non-orthogonal lane steps, every lane ends at its own base, every
board has buildable ground, and the same seed rebuilds byte-identical lanes,
bases and terrain (the determinism a live duel's two clients depend on).
A1 and A2 above were real defects IN their uncommitted work, both now fixed
by the smallest change that makes the mechanism they built actually run: A1
was a typo (`const` where the salt needed `let`), A2 was reading a field
under the wrong assumption about its own type. Their files stay theirs.

## D. Cross-checks this batch held to

- The galaxy PRNG stream does not move: nothing in this batch reads or calls
  `Math.random`/`rnd()`, adds a world property, or touches `galaxy.js`. The
  map-seed fix (A2) seeds `MapGen`'s OWN per-battle generator, a separate
  stream from the galaxy's; the galaxy fingerprint tool was not re-run
  because nothing in scope could move it, which is itself checked by grep
  rather than asserted.
- Index-coupled tables untouched; no table gained, lost or reordered a row.
- No new `Math.random` in a sim path: this batch's only new randomness-facing
  code is a draw-loop bound and a win-condition check, neither draws.
- Save keys additive only: `scenario.surviveWaves` lives on the scenario
  definition, not on a save; no migration needed.
- `node tools/gate.js` clean at every commit: parse 24/0, em dash clean,
  owner-sweep 61/0/2, MPT 37/0/2.
- A normal two-sided duel is provably unaffected, not merely un-broken by
  inspection: `Game.soloSurvive:false`, no `solo-field` body class, the rival
  HUD panel `display:'flex'` with a real `aiLivesText:'20'`, and the same
  preview function on the same map without the `solo` flag draws 2 seats and
  2 bases.

## E. Follow-ups surfaced by this batch

- `[ ]` B3 (patrol summons) is open pending the owner's answer on what "hold
  guard" mechanically means; see the question sent alongside this tracker.
- `[ ]` `UI.nodeBriefing` (`js/ui.js:3297`) has zero callers anywhere in the
  repo, found while threading the `solo` preview flag through every ACTIVE
  briefing card. Left untouched, out of scope for this batch; it is either
  dead code worth removing or a briefing surface that stopped being wired up.
