/* Balance pin harness. Mirror-AI drives BOTH seats so a run reflects competent
   play, and the loadout is PINNED, passing a pool to AI.pickLoadout only sets
   a budget, it never filters cores, so an unpinned run silently re-bases. */
window.PINS = (function () {
  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  const KEY = Meta.KEY;

  /* THE STATE LEAK THAT MADE THESE PINS IRREPRODUCIBLE, and the fix.

     `AI` is a singleton AND a prototype. js/game.js:520-521 gives each rival
     seat its own brain with `Object.create(AI)`, and then :533 ALSO calls
     `AI.init(this.sides[1], ...)` on the shared object itself. So a match
     leaves per-match state on the prototype: measured after one run, `AI.spots`
     held 148 entries and `AI.samples` 206, with `side`, `diff`, `think` and
     `ready` all populated.

     Measured consequence, same seed, same page:
        run 1 -> wave 21, steps 27480
        run 2 -> wave 20, steps 26129
     Restoring just these six fields between runs makes run 2 byte-identical to
     run 1. That is the whole difference, isolated by restoring nothing else.

     NOTE what this does and does not claim. It makes the HARNESS reproducible.
     Whether the same carry-over changes the real game's second match of a
     session is a separate question and is NOT settled here -- `init()` does
     reassign both arrays via `buildSpots()`, so the mechanism is subtler than
     "the arrays are stale", and it has not been run down. See docs/BACKLOG.md.

     The snapshot must be taken before any match has run in this page. Load this
     harness first, or reload before quoting a number. */
  const AI_FIELDS = ['side', 'diff', 'spots', 'samples', 'think', 'ready', 'patience'];
  const AI_PRISTINE = {};
  let aiCaptured = false;
  function captureAI() {
    if (aiCaptured || typeof AI === 'undefined') return;
    for (const k of AI_FIELDS) AI_PRISTINE[k] = Array.isArray(AI[k]) ? AI[k].slice() : AI[k];
    aiCaptured = true;
  }
  function resetAI() {
    if (!aiCaptured) return false;
    for (const k of AI_FIELDS)
      AI[k] = Array.isArray(AI_PRISTINE[k]) ? AI_PRISTINE[k].slice() : AI_PRISTINE[k];
    return true;
  }
  captureAI();

  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} Meta._root = null; }

  function maxProfile(tier) {
    wipe();
    const p = Meta.load();
    for (const c of COMMANDERS) {
      p.commanders[c.id].xp = 999999;
      p.commanders[c.id].unlocked = c.tech.map(t => t.id);
    }
    for (const id of TOWER_ORDER) p.towerXp[id] = 999999;
    const v = Meta.vault();
    /* Unlocks are shelved PER BANNER since 19.6, so writing the retired flat
       list would leave the "maxed" pin holding one tower and read as a
       catastrophe -- the third documented way to mis-measure this pin. */
    for (const k of Object.keys(v.unlockedBy)) v.unlockedBy[k] = TOWER_ORDER.slice();
    /* Commanders and abilities are shelved per banner too since Session 21
       round two. Writing the retired flat `cmdUnlocked` key would be a silent
       no-op of exactly the Tower.jammed class -- nothing reads it any more. */
    for (const k of Object.keys(v.cmdUnlockedBy)) v.cmdUnlockedBy[k] = COMMANDERS.map(c => c.id);
    for (const k of Object.keys(v.abilUnlockedBy)) v.abilUnlockedBy[k] = COMMANDERS.map(c => c.id);
    p.souls = 99999;
    /* Galaxy tier is DELIBERATELY left at zero. It multiplies enemy scaling,
       so a maxed-unlocks run at tier 4 measures the escalation curve, not the
       player's ceiling -- and the documented 26-27 pin is the ceiling. */
    p.galaxyTier = tier;
    p.campaign = p.campaign || {};
    p.campaign.tier = tier;
    Meta.save();
  }

  /* SEEDING, and why it is worth having. Measured: `Game.step` is a pure
     function of (state, Math.random stream) -- with Math.random replaced by
     mulberry32 and a FIXED step budget, three trials came back byte-identical
     (839 draws with no brain, 3462 with the mirror-AI brain in the loop; same
     wave, lives, gold and enemy count every time). Unseeded, it is not: one
     map has produced death waves 5, 6, 13, 19, 19, 20 and 21 on this build,
     wins and losses both. A 4x spread cannot gate a PR the way CONTRIBUTING
     asks it to, and every re-measurement reads as a regression or a triumph
     depending on the draw.

     So: pass a seed and a run is reproducible; omit it and you get the old
     behaviour exactly. Compare a seeded run against the SAME seed, or compare
     distributions -- never a seeded number against an unseeded one.

     THE FOURTH WAY TO MIS-MEASURE THESE PINS was that a seed only reproduced
     the FIRST run after a page load. Measured on this build, seed 1234,
     maxed/tier-0/spine:

       fresh page A -> wave 21, steps 27480, loss, lives [0,13]
       fresh page B -> wave 21, steps 27480, loss, lives [0,13]   IDENTICAL
       same page, run 1 -> wave 21, steps 27480
       same page, run 2 -> wave 20, steps 26129   SAME SEED, DIFFERENT RESULT

     That was the AI prototype carrying per-match state between runs, and it is
     fixed below, `resetAI()` runs at the top of every `begin()`. `selfTest()`
     is the regression test. Load this harness in a page that has not yet run a
     match, or the snapshot it restores is already dirty. */
  let NATIVE = null;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Install the seeded stream. Kept installed for the whole run, because the
     brain draws from it too and a stream that stops mid-match is worse than
     no seed at all. `restore()` is idempotent so a caller cannot leave the
     page with a stubbed Math.random. */
  function seed(n) {
    if (NATIVE === null) NATIVE = Math.random;
    Math.random = mulberry32(n);
  }
  function restore() { if (NATIVE !== null) { Math.random = NATIVE; NATIVE = null; } }

  /* A maxed run can outlast any single tool call, so the loop is RESUMABLE:
     begin() arms it, tick(n) advances at most n frames and reports. */
  let R = null;

  function begin(mapIdx, diff, s) {
    /* Hand the AI prototype back its pristine state before anything reads it.
       Without this the second run in a page measures a warmed-up rival. */
    resetAI();
    /* Seed BEFORE Game.start: board generation and the opening draft both
       draw, so seeding after it would leave the setup unreproducible and only
       the match body pinned -- which looks seeded and is not. */
    if (s !== undefined && s !== null) seed(s); else restore();
    Game.start({
      map: MAPS[mapIdx % MAPS.length].id,
      difficulty: diff,
      loadout: PIN.slice(),
      commander: COMMANDERS[0].id,
      skirmish: false
    });
    Game.sides[0].loadout = PIN.slice();
    const brain = Object.create(AI);
    brain.init(Game.sides[0], Game.difficulty);
    brain.loadout = PIN.slice();
    R = { brain: brain, steps: 0, map: MAPS[mapIdx % MAPS.length].id, err: null,
          seed: (s === undefined ? null : s) };
    return R.map;
  }

  const DT = 1 / 60;
  const CAP = 60 * 60 * 45;

  function tick(n) {
    if (!R) return { done: true, err: 'not begun' };
    let i = 0;
    while (i < n && Game.state !== 'over' && R.steps < CAP) {
      if (Game.state === 'choosing' && Game.pendingChoice)
        Game.takeMod(Game.pendingChoice[0]);
      else if (Game.state === 'escalating' && Game.pendingEscalation)
        (Game.takeEscalation || Game.takeMod).call(Game, Game.pendingEscalation[0]);
      else {
        try { R.brain.update(DT, Game); Game.step(DT); }
        catch (e) { R.err = String(e); break; }
      }
      R.steps++; i++;
    }
    const done = !!R.err || Game.state === 'over' || R.steps >= CAP;
    /* A run can end EITHER way, and "wave reached" alone conflates the two:
       a wave-7 finish is a rout if the player died and a rout the other way
       if the rival did. Compare like with like or the pin means nothing. */
    const lives = Game.sides.map(s => s.lives);
    const outcome = !done ? 'running'
      : lives[0] <= 0 ? 'loss'
      : lives.slice(1).every(l => l <= 0) ? 'win' : 'capped';
    /* Hand the stream back the moment the run is over, so a seeded pin cannot
       leave a stubbed Math.random behind for whatever runs next in the page. */
    if (done) restore();
    return { done: done, wave: Game.wave, steps: R.steps, err: R.err,
             capped: R.steps >= CAP, map: R.map, state: Game.state,
             outcome: outcome, lives: lives, seed: R.seed };
  }

  function runOne(mapIdx, diff, s) {
    begin(mapIdx, diff, s);
    let r;
    do { r = tick(20000); } while (!r.done);
    return { wave: r.wave, steps: r.steps, timeout: r.capped, err: r.err,
             outcome: r.outcome, map: r.map, seed: r.seed };
  }

  function med(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

  /* Quartiles, not just a median. With an unseeded run the spread IS the
     result -- a lone median hides that one map swung 5..21 -- and a reader
     who sees q1/q3 will not mistake noise for a regression. */
  function stats(w) {
    if (!w.length) return { median: null, min: null, max: null, q1: null, q3: null, n: 0 };
    const s = w.slice().sort((x, y) => x - y);
    const at = f => s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))];
    return { median: med(s), min: s[0], max: s[s.length - 1], q1: at(0.25), q3: at(0.75), n: s.length };
  }

  /* `seedBase` makes a sweep reproducible: run i uses seedBase + i, so the
     same call in a later session replays the same matches and a difference is
     the CODE, not the draw. Omit it and behaviour is exactly as before. */
  function sweep(n, prep, seedBase) {
    const out = [];
    for (let i = 0; i < n; i++) {
      prep(i);
      out.push(runOne(i, 'contested',
                      seedBase === undefined ? undefined : (seedBase + i) >>> 0));
    }
    const good = out.filter(r => !r.err);
    const w = good.map(r => r.wave);
    return Object.assign(stats(w), {
      runs: out, errs: out.filter(r => r.err), seedBase: seedBase === undefined ? null : seedBase,
      wins: good.filter(r => r.outcome === 'win').length,
      losses: good.filter(r => r.outcome === 'loss').length,
      lossWaves: good.filter(r => r.outcome === 'loss').map(r => r.wave).sort((a, b) => a - b)
    });
  }

  return {
    begin: begin, tick: tick, maxProfile: maxProfile, wipe: wipe,
    seed: seed, restore: restore, stats: stats,
    fresh(n, seedBase) { return sweep(n, function () { wipe(); }, seedBase); },
    maxed(n, tier, seedBase) { return sweep(n, function () { maxProfile(tier || 0); }, seedBase); },
    resetAI: resetAI,
    /* The regression test for the AI-prototype leak: the same seed twice in one
       page must now agree. `reproducible: false` means the reset above has
       stopped covering everything a match leaves behind, treat any number the
       harness produces as untrustworthy until it is true again. */
    selfTest(mapIdx, s) {
      maxProfile(0); const a = runOne(mapIdx || 0, 'contested', s === undefined ? 1234 : s);
      maxProfile(0); const b = runOne(mapIdx || 0, 'contested', s === undefined ? 1234 : s);
      const same = a.wave === b.wave && a.steps === b.steps && a.outcome === b.outcome;
      return { a: a, b: b, reproducible: same, aiSnapshotTaken: aiCaptured,
               note: same ? 'in-page repeats reproduce'
                          : 'REGRESSION: something beyond the AI prototype is carrying between runs' };
    },
    /* One seeded run, the quotable unit. Use it as the first thing a page
       does, then reload before the next one. */
    once(mapIdx, s, tier) {
      maxProfile(tier || 0);
      return runOne(mapIdx || 0, 'contested', s === undefined ? 1234 : s);
    }
  };
})();
'PINS ready';
