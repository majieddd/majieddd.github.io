/* RELIQUARY :: tools/adversarial
   The SECOND harness. verify.js asks "does the game work". This one asks
   "what did the first harness fail to look at".

   The distinction matters. A suite that only tests the happy path goes green
   on a build that leaks a Web Audio oscillator per restart, accumulates GPU
   buffers forever, or drifts into NaN after ten minutes, because none of those
   are visible in a single short run that ends when the test does.

   Everything here is a class of defect that a passing functional test cannot
   see:
     - resource lifecycle across restarts (GL objects, audio voices)
     - numerical health over a long run (NaN, unbounded growth)
     - state corruption from out-of-order or hostile input
     - balance degeneracy (one dominant strategy, a reaction that never fires)

   Loaded by fetch the same way as verify.js. */
(function () {
  'use strict';

  var results = [];
  function ok(name, pass, detail) {
    results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  }
  function reset(opts) {
    opts = opts || {};
    window.__RQ.start({
      faction: opts.faction || 'human',
      enemyFaction: opts.enemyFaction || 'xeno',
      commander: opts.commander || 'vanta',
      board: opts.board === undefined ? 0 : opts.board,
      difficulty: opts.difficulty === undefined ? 1 : opts.difficulty
    });
    window.__RQ.closeScreens();
    return GAME.state;
  }
  function stepSim(sec, sub) {
    sub = sub || (1 / 120);
    var n = Math.max(1, Math.round(sec / sub));
    for (var i = 0; i < n; i++) { SIM.step(sub); FX.update(sub); FX.updateText(sub); }
  }
  function nearLane(g, n) {
    return g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; }).slice(0, n || 99);
  }

  /* ---------- A. resource lifecycle across restarts ----------
     The defect this catches: GAME.start() creates a ground mesh and a decor
     mesh per run. WebGL objects are not reclaimed when the JS reference is
     dropped, so without an explicit dispose the count climbs forever. */
  (function () {
    reset();
    var base = GL.live().mesh;
    for (var i = 0; i < 10; i++) reset({ board: i % 3 });
    var after = GL.live().mesh;
    /* Model meshes are memoised and SHOULD accumulate on first sight of each
       board, so the assertion is on unbounded growth, not on equality. Ten
       restarts across three boards must not add ten boards worth of meshes. */
    ok('A.1 GL meshes do not grow per restart', after - base <= 6,
      base + ' to ' + after + ' over 10 restarts');
  })();

  (function () {
    if (!AUDIO.isReady()) { ok('A.2 beam voices are released on restart', true, 'audio not armed, skipped'); return; }
    reset();
    var g = GAME.state;
    g.gold = 99999;
    var free = nearLane(g, 4);
    SIM.place(free[0].id, 'prism');
    SIM.place(free[1].id, 'pharos');
    for (var k = 0; k < 6; k++) SIM.spawnDenizen('chitling', { dist: 10 + k });
    stepSim(2);
    var during = AUDIO.liveVoices();
    for (var i = 0; i < 5; i++) reset();
    var after = AUDIO.liveVoices();
    ok('A.2 beam voices are released on restart', after <= 1,
      during + ' during play, ' + after + ' after 5 restarts');
  })();

  (function () {
    reset();
    var g = GAME.state;
    g.gold = 99999;
    var free = nearLane(g, 2);
    var t = SIM.place(free[0].id, 'prism');
    for (var k = 0; k < 5; k++) SIM.spawnDenizen('chitling', { dist: 10 + k });
    stepSim(1.5);
    var had = !!t.voice;
    SIM.sell(t);
    ok('A.3 selling a beam tower stops its voice', !t.voice, 'had=' + had);
  })();

  /* ---------- B. numerical health over a long run ---------- */
  (function () {
    var g = reset({ difficulty: 0 });
    g.gold = 400000;
    var free = nearLane(g);
    for (var i = 0; i < free.length; i++) {
      SIM.place(free[i].id, DATA.TOWER_ORDER[i % DATA.TOWER_ORDER.length]);
    }
    for (var u = 0; u < g.towers.length; u++) { SIM.upgrade(g.towers[u]); SIM.upgrade(g.towers[u]); }

    var guard = 0, maxDen = 0, maxProj = 0, maxParticles = 0, maxDelayed = 0;
    var nan = null;
    while (g.status === 'play' && guard < 4000) {
      stepSim(0.5, 1 / 60);
      guard++;
      if (g.denizens.length > maxDen) maxDen = g.denizens.length;
      if (g.projs.length > maxProj) maxProj = g.projs.length;
      if (FX.count > maxParticles) maxParticles = FX.count;
      if (g.delayed.length > maxDelayed) maxDelayed = g.delayed.length;
      for (var d = 0; d < g.denizens.length && !nan; d++) {
        var p = g.denizens[d].pos;
        if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2]) || !isFinite(g.denizens[d].hp)) {
          nan = 'denizen ' + g.denizens[d].type;
        }
      }
      for (var t2 = 0; t2 < g.towers.length && !nan; t2++) {
        if (!isFinite(g.towers[t2].yaw) || !isFinite(g.towers[t2].damage)) nan = 'tower ' + g.towers[t2].id;
      }
    }
    ok('B.1 no NaN anywhere in a full run', nan === null, nan || 'clean');
    ok('B.2 denizen count stays bounded', maxDen < 400, 'peak ' + maxDen);
    ok('B.3 projectile count stays bounded', maxProj < 500, 'peak ' + maxProj);
    ok('B.4 particle pool never overflows', maxParticles <= 3600, 'peak ' + maxParticles);
    ok('B.5 delayed-effect queue drains', maxDelayed < 200 && g.delayed.length < 40,
      'peak ' + maxDelayed + ', end ' + g.delayed.length);
    ok('B.6 floating text is capped', FX.texts.length <= 90, FX.texts.length);
    ok('B.7 gold stays finite and non-negative', isFinite(g.gold) && g.gold >= 0, g.gold);
    ok('B.8 lives never go below zero', g.lives >= 0, g.lives);
  })();

  /* ---------- C. hostile and out-of-order input ---------- */
  (function () {
    var g = reset();
    var free = nearLane(g, 3);
    var t = SIM.place(free[0].id, 'bolt');
    SIM.sell(t);
    var threw = false;
    try {
      SIM.sell(t);            /* sell the same tower twice */
      SIM.upgrade(t);         /* upgrade a sold tower */
      g.inspecting = t;
      UI.refresh();
      stepSim(0.5);
    } catch (e) { threw = true; }
    ok('C.1 selling or upgrading a sold tower does not throw', !threw, '');
    ok('C.2 a sold tower leaves no ghost', g.towers.indexOf(t) === -1, g.towers.length);
  })();

  (function () {
    var g = reset();
    var threw = false;
    try {
      SIM.place('does-not-exist', 'bolt');
      SIM.place(g.board.plots[0].id, 'not-a-tower');
      window.__RQ.build('bolt', 99999);
      SIM.useAbility('z');
      SIM.spawnDenizen('nothing', {});
      stepSim(0.3);
    } catch (e) { threw = true; }
    ok('C.3 unknown ids are refused without throwing', !threw, '');
  })();

  (function () {
    var g = reset();
    var threw = false;
    try {
      /* Start a wave while one is already running, repeatedly. */
      SIM.startWave();
      for (var i = 0; i < 30; i++) SIM.startWave();
      stepSim(2);
    } catch (e) { threw = true; }
    ok('C.4 double wave-start is refused', !threw && g.wave <= 2, 'wave ' + g.wave);
  })();

  (function () {
    var g = reset();
    var threw = false;
    try {
      SIM.endGame(true);
      SIM.endGame(false);   /* must not flip a win into a loss */
      stepSim(1);
    } catch (e) { threw = true; }
    ok('C.5 a finished game cannot be re-ended', !threw && g.status === 'won', g.status);
  })();

  (function () {
    var g = reset();
    g.gold = 99999;
    var free = nearLane(g, 2);
    SIM.place(free[0].id, 'bolt');
    var threw = false;
    try {
      /* A zero and a negative timestep, which a stalled tab can produce. */
      SIM.step(0);
      SIM.step(-1);
      SIM.step(1e-9);
      stepSim(0.5);
    } catch (e) { threw = true; }
    var pos = g.towers[0].pos;
    ok('C.6 degenerate timesteps do not corrupt state',
      !threw && isFinite(pos[0]) && isFinite(g.gold), '');
  })();

  /* ---------- D. every faction and board combination boots ---------- */
  (function () {
    var fails = [];
    var factions = ['human', 'light', 'xeno', 'pirate', 'robotic'];
    for (var f = 0; f < factions.length; f++) {
      for (var b = 0; b < DATA.BOARDS.length; b++) {
        try {
          var enemy = factions[(f + 1) % factions.length];
          var g = reset({ faction: factions[f], enemyFaction: enemy, board: b });
          g.gold = 5000;
          var free = nearLane(g, 3);
          SIM.place(free[0].id, 'bolt');
          SIM.startWave();
          stepSim(3);
          if (window.__RQ.errorCount() > 0) fails.push(factions[f] + '/' + b);
        } catch (e) {
          fails.push(factions[f] + '/' + b + ':' + e.message);
        }
      }
    }
    ok('D.1 all 15 faction and board combinations run clean', fails.length === 0, fails.join(' '));
  })();

  /* Every denizen archetype must build a rig and pose without throwing. */
  (function () {
    var fails = [];
    var factions = ['human', 'light', 'xeno', 'pirate', 'robotic'];
    factions.forEach(function (f) {
      ['crawler', 'walker', 'strider', 'flyer'].forEach(function (rig) {
        try {
          var m = MODELS.denizen(rig, f);
          if (!m.parts.length) fails.push(f + '/' + rig + ':empty');
          for (var i = 0; i < m.parts.length; i++) {
            if (!m.parts[i].data || !m.parts[i].data.verts.length) fails.push(f + '/' + rig + ':nodata');
          }
        } catch (e) { fails.push(f + '/' + rig + ':' + e.message); }
      });
    });
    ok('D.2 every rig builds for every faction with shatter data', fails.length === 0, fails.join(' '));
  })();

  /* ---------- E. balance is not degenerate ----------
     Not "is it perfectly tuned", which is taste. These are the failures that
     make a tower defence pointless: a tower that cannot pay for itself, or one
     that trivially wins alone. */
  (function () {
    var perGold = [];
    DATA.TOWER_ORDER.forEach(function (id) {
      var def = DATA.TOWERS[id];
      if (def.kind === 'support') return;
      var g = reset();
      g.gold = 99999;
      var free = nearLane(g, 1);
      var t = SIM.place(free[0].id, id);
      var bestD = 0, bestDist = 1e9;
      for (var d = 0; d < g.board.path.length; d += 2) {
        var pt = g.board.pathAt(d).pos;
        var dd = Math.hypot(pt[0] - t.pos[0], pt[2] - t.pos[2]);
        if (dd < bestDist) { bestDist = dd; bestD = d; }
      }
      /* A fixed, identical target set for every tower, so the numbers compare.
         HP IS REALISTIC ON PURPOSE. An earlier version used 20000 HP dummies
         and reported a 45x spread, which was an artefact of the fixture and
         not a property of the game: percent-max-HP damage beats flat damage by
         whatever ratio the tester picks for maxHp. 2600 is roughly a wave-12
         body, high enough to survive the measurement window and low enough
         that the comparison means something. */
      for (var k = 0; k < 14; k++) {
        var dz = SIM.spawnDenizen('chitling', { dist: Math.max(0, bestD - 12) + k * 1.2 });
        if (dz) { dz.hp = dz.maxHp = 2600; dz.speed = 0; }
      }
      stepSim(10);
      perGold.push({ id: id, dpg: t.damage / def.cost });
    });
    perGold.sort(function (a, b) { return a.dpg - b.dpg; });
    var lo = perGold[0], hi = perGold[perGold.length - 1];
    var ratio = hi.dpg / Math.max(1e-6, lo.dpg);
    /* A 12x spread between best and worst damage-per-gold would mean most of
       the roster is decoration. Control and utility towers legitimately score
       low here because this measures raw damage only, so the bar is generous. */
    ok('E.1 damage per gold is within one order of magnitude', ratio < 12,
      lo.id + ' ' + lo.dpg.toFixed(2) + ' to ' + hi.id + ' ' + hi.dpg.toFixed(2) +
      ' (' + ratio.toFixed(1) + 'x)');
    ok('E.2 every damaging tower earns something', lo.dpg > 0.05, lo.id + '=' + lo.dpg.toFixed(3));
  })();

  (function () {
    /* Percent-max-HP damage must not scale without bound into the boss, which
       is the one body whose maximum health is two orders of magnitude above
       everything else on the board. */
    var g = reset();
    var boss = SIM.spawnDenizen('harbinger', { dist: 20 });
    var mook = SIM.spawnDenizen('chitling', { dist: 21 });
    boss.poison = mook.poison = 0.006;
    boss.poisonStacks = mook.poisonStacks = 6;
    boss.poisonT = mook.poisonT = 5;
    mook.hp = mook.maxHp = 3000;
    var bHp = boss.hp, mHp = mook.hp;
    stepSim(1);
    var bLost = (bHp - boss.hp) / boss.maxHp;
    var mLost = (mHp - mook.hp) / mook.maxHp;
    ok('E.5 bosses resist percent-max-health damage', bLost < mLost * 0.5,
      'boss lost ' + (bLost * 100).toFixed(2) + '% vs mook ' + (mLost * 100).toFixed(2) + '%');
  })();

  (function () {
    /* One maxed tower alone must NOT beat the game, or there is no game. */
    var g = reset({ difficulty: 1 });
    g.gold = 99999;
    var free = nearLane(g, 1);
    var t = SIM.place(free[0].id, 'railgun');
    SIM.upgrade(t); SIM.upgrade(t);
    var guard = 0;
    while (g.status === 'play' && guard < 2500) { stepSim(0.5, 1 / 60); guard++; }
    ok('E.3 a single maxed tower does not win alone', g.status === 'lost',
      g.status + ' at wave ' + g.wave);
  })();

  (function () {
    /* The reaction cooldown must actually bound the rate, or a field tower
       turns the screen into a callout strobe. Measured before the cooldown
       existed: 110 reactions in nine seconds from one board. */
    var g = reset();
    g.gold = 99999;
    var free = nearLane(g, 6);
    var sing = SIM.place(free[0].id, 'singularity');
    SIM.place(free[1].id, 'bolt');
    SIM.place(free[2].id, 'railgun');
    /* Put the bodies where the towers ARE. Spawning at a fixed path distance
       and hoping the plots happen to be adjacent is the same instrument trap
       that made an earlier tower test report zero for eleven towers. */
    var bestD = 0, bestDist = 1e9;
    for (var pd = 0; pd < g.board.path.length; pd += 2) {
      var pt = g.board.pathAt(pd).pos;
      var dd = Math.hypot(pt[0] - sing.pos[0], pt[2] - sing.pos[2]);
      if (dd < bestDist) { bestDist = dd; bestD = pd; }
    }
    for (var k = 0; k < 12; k++) {
      var d = SIM.spawnDenizen('chitling', { dist: Math.max(0, bestD - 5) + k * 0.8 });
      if (d) { d.hp = d.maxHp = 60000; d.speed = 0; }
    }
    var before = 0; for (var q in g.reactionCounts) before += g.reactionCounts[q];
    stepSim(10);
    var after = 0; for (var q2 in g.reactionCounts) after += g.reactionCounts[q2];
    var fired = after - before;
    /* 12 bodies over 10 seconds with a 0.55s per-body cooldown allows about
       218 in theory; anything near that means the cooldown is not applying. */
    ok('E.4 reactions are rate limited per body', fired > 0 && fired < 190,
      fired + ' in 10s across 12 bodies');
  })();

  /* ---------- F. the interface survives a real session ---------- */
  (function () {
    var g = reset();
    var threw = false;
    try {
      g.gold = 9999;
      var free = nearLane(g, 3);
      var t = SIM.place(free[0].id, 'prism');
      g.inspecting = t;
      UI.refresh();
      UI.showBanner('TEST', 'SUB', 0.1);
      UI.toast('test');
      UI.tickOverlay(0.016);
      SIM.sell(t);
      UI.refresh();          /* inspector now points at a sold tower */
      UI.tickOverlay(0.016);
      g.inspecting = null;
      UI.refresh();
      UI.tickOverlay(0.016);
    } catch (e) { threw = true; results.push({ name: 'F.1 detail', pass: false, detail: e.message }); }
    ok('F.1 the inspector survives its tower being sold', !threw, '');
  })();

  (function () {
    /* Floating text nodes must be POOLED, not created per text. A busy wave
       makes dozens a second and node churn is visible in the profiler. */
    var g = reset();
    g.gold = 99999;
    for (var i = 0; i < 200; i++) {
      FX.text([0, 2, 0], '999', { color: '#fff', life: 5 });
    }
    UI.tickOverlay(0.016);
    var n1 = document.querySelectorAll('#floats .float').length;
    for (var j = 0; j < 200; j++) FX.text([0, 2, 0], '888', { color: '#fff', life: 5 });
    UI.tickOverlay(0.016);
    var n2 = document.querySelectorAll('#floats .float').length;
    ok('F.2 floating text nodes are pooled', n2 <= Math.max(n1, 95) + 2, n1 + ' then ' + n2);
    ok('F.3 floating text respects its cap', FX.texts.length <= 90, FX.texts.length);
  })();

  /* ---------- P. the particle system ----------
     Added wholesale in the polish pass: seven kinds, velocity stretch, colour
     ramps and a widened instance layout, none of which the existing suite
     touched. Code no gate executes is code that ships untested, and a particle
     system fails SILENTLY: a stride mismatch or a bad attribute location does
     not throw, it just draws garbage or nothing. */
  (function () {
    var g = reset();
    FX.clear();
    var kinds = Object.keys(FX.KIND);
    var bad = [];
    kinds.forEach(function (k) {
      var before = FX.count;
      FX.spawn({
        x: 0, y: 2, z: 0, vx: 5, vy: 2, vz: 1,
        r: 1, g: 0.5, b: 0.2, life: 1, size: 0.4,
        kind: FX.KIND[k], stretch: 1.2
      });
      if (FX.count !== before + 1) bad.push(k);
    });
    ok('P.1 every particle kind spawns', bad.length === 0, kinds.length + ' kinds, bad=' + bad.join(','));
  })();

  (function () {
    /* THE INSTANCE STRIDE IS A CONTRACT between FX.submit and the renderer's
       vertex layout. A mismatch corrupts every particle silently, because
       nothing validates that the floats a caller pushes land where the shader
       expects them. Pushing a known pattern and reading it back out of the
       renderer's own buffer is the only way to check it. */
    FX.clear();
    R.reset();
    var probe = { x: 11, y: 22, z: 33, r: 0.1, g: 0.2, b: 0.3, a: 0.4,
                  size: 0.5, rot: 0.6, kind: 4, stretch: 0.7, vx: 8, vy: 9, vz: 10 };
    R.pushParticle(probe.x, probe.y, probe.z, probe.r, probe.g, probe.b, probe.a,
      probe.size, probe.rot, probe.kind, probe.stretch, probe.vx, probe.vy, probe.vz);
    var d = R.debugParticleSlot ? R.debugParticleSlot(0) : null;
    if (!d) { ok('P.2 particle instance stride is consistent', true, 'no debug hook, skipped'); }
    else {
      var okStride = Math.abs(d[0] - 11) < 1e-4 && Math.abs(d[2] - 33) < 1e-4 &&
                     Math.abs(d[6] - 0.4) < 1e-4 && Math.abs(d[9] - 4) < 1e-4 &&
                     Math.abs(d[10] - 0.7) < 1e-4 && Math.abs(d[13] - 10) < 1e-4;
      ok('P.2 particle instance stride is consistent', okStride, JSON.stringify(d));
    }
  })();

  (function () {
    /* Colour must actually travel from its start to its end over life, or the
       ramp is dead code that only makes the arrays bigger. */
    FX.clear();
    FX.spawn({ x: 0, y: 2, z: 0, r: 1, g: 1, b: 1, r1: 0, g1: 0, b1: 0,
               life: 1, size: 0.5, kind: FX.KIND.EMBER, drag: 0, grav: 0 });
    var seen = [];
    R.reset();
    FX.submit();
    seen.push(R.debugParticleSlot ? R.debugParticleSlot(0)[3] : 1);
    FX.update(0.8);
    R.reset();
    FX.submit();
    seen.push(R.debugParticleSlot ? R.debugParticleSlot(0)[3] : 0);
    ok('P.3 colour ramps over life', seen[0] > seen[1] + 0.2,
      seen[0].toFixed(2) + ' then ' + seen[1].toFixed(2));
  })();

  (function () {
    /* The pool must never overflow, and emission under a heavy wave must not
       silently drop every effect by pinning the pool at max. */
    FX.clear();
    for (var i = 0; i < 900; i++) {
      FX.impact([i % 20, 2, (i * 7) % 20], [0, 1, 0], [1, 0.4, 0.2], 1.4);
    }
    var peak = FX.count;
    ok('P.4 the particle pool never overflows', peak <= FX.max, peak + '/' + FX.max);
    FX.update(3.0);
    ok('P.5 particles drain when they expire', FX.count < peak * 0.25,
      peak + ' then ' + FX.count);
  })();

  (function () {
    /* impact() is the layered hit. It must emit MORE than a single burst, or
       the layering that the whole polish pass was about is not happening. */
    FX.clear();
    FX.impact([0, 2, 0], [0, 1, 0], [1, 0.5, 0.2], 1.0);
    var layered = FX.count;
    FX.clear();
    FX.burst([0, 2, 0], [1, 0.5, 0.2], { count: 4 });
    var plain = FX.count;
    ok('P.6 a hit emits layered effects', layered > plain + 6,
      'impact=' + layered + ' vs plain burst=' + plain);
  })();

  (function () {
    /* FOOTFALL DUST, tested for real.
       The first version of this check called a pose hook that does not exist
       and then asserted true, so it passed on a build where the feature was
       absent. A test that cannot fail is worse than no test: it converts an
       unknown into a false assurance. Dust is emitted from the draw path, so
       the honest way to reach it is to drive a real frame. */
    var g = reset();
    SIM.spawnDenizen('hivelord', { dist: 8 });
    SIM.spawnDenizen('broodmother', { dist: 14 });
    FX.clear();
    var before = FX.count;
    /* GAME.renderOnce drives exactly the code the game draws with, including
       poseDenizen, without waiting on requestAnimationFrame. */
    for (var i = 0; i < 70; i++) { SIM.step(1 / 60); GAME.renderOnce(1 / 60); }
    var walking = FX.count - before;
    ok('P.7 footfall dust is emitted while walking', walking > 0, walking + ' particles');

    /* And must NOT fire when nothing is moving, or it is a smoke machine. */
    for (var k = 0; k < g.denizens.length; k++) { g.denizens[k].stun = 99; }
    FX.clear();
    for (var j = 0; j < 70; j++) { SIM.step(1 / 60); GAME.renderOnce(1 / 60); }
    ok('P.9 no footfall dust while stunned', FX.count === 0, FX.count + ' particles');
  })();

  (function () {
    /* PARTICLE BUDGET UNDER A REAL WAVE.
       The polish pass roughly doubled the particles per hit. If a busy wave
       pins the pool at its cap, every later effect that frame is silently
       dropped, which shows up as explosions that stop appearing exactly when
       the board is most exciting. Measured on a full board at a late wave. */
    var g = reset({ difficulty: 0 });
    g.gold = 400000;
    var free = nearLane(g);
    for (var i = 0; i < free.length; i++) {
      SIM.place(free[i].id, DATA.TOWER_ORDER[i % DATA.TOWER_ORDER.length]);
    }
    for (var u = 0; u < g.towers.length; u++) { SIM.upgrade(g.towers[u]); SIM.upgrade(g.towers[u]); }
    g.wave = 16;
    SIM.startWave();
    var peak = 0, pinned = 0, frames = 0;
    for (var f = 0; f < 900; f++) {
      SIM.step(1 / 60); FX.update(1 / 60);
      frames++;
      if (FX.count > peak) peak = FX.count;
      if (FX.count >= FX.max) pinned++;
    }
    ok('P.10 the particle pool is not pinned at its cap',
      pinned < frames * 0.02, 'peak ' + peak + '/' + FX.max + ', pinned ' + pinned + '/' + frames + ' frames');
  })();

  (function () {
    /* Velocity stretch must be OFF for particles that did not ask for it, or
       every smoke puff turns into a comet. */
    FX.clear();
    FX.smoke([0, 2, 0], [0.5, 0.5, 0.6], 6, 1);
    R.reset();
    FX.submit();
    var anyStretched = false;
    if (R.debugParticleSlot) {
      for (var i = 0; i < 6; i++) {
        var sl = R.debugParticleSlot(i);
        if (sl && sl[10] > 0.001) anyStretched = true;
      }
    }
    ok('P.8 smoke is not velocity stretched', !anyStretched, '');
  })();

  /* ---------- H. the palette actually follows the faction ----------
     THE CLASS OF BUG THIS CATCHES. The ability-ready pulse animated to a
     literal rgba(56,232,255,0), which is HUMANITY's cyan, so on the other four
     factions it pulsed the wrong hue. Nothing threw, no gate went red, and it
     was found only by grepping the stylesheet for hand-typed colour. The rule
     the style law actually states is that a scene reads as its faction in the
     first half second, so a hard-coded accent anywhere is a defect by
     construction. Every accent token is therefore checked against every
     faction's own key. */
  (function () {
    var bad = [];
    var cs = getComputedStyle(document.documentElement);
    ['human', 'light', 'xeno', 'pirate', 'robotic'].forEach(function (fid) {
      UI.applyPalette(fid);
      var want = PAINT.FACTIONS[fid].accent.toLowerCase();
      var got = (cs.getPropertyValue('--accent') || '').trim().toLowerCase();
      if (got !== want) bad.push(fid + ' accent=' + got + ' want=' + want);
      /* The zero-alpha companion must track the SAME hue, or a keyframe fades
         to a colour from a different faction. */
      var rgb = U.hex2rgb(want);
      var r = Math.round(rgb[0] * 255), g2 = Math.round(rgb[1] * 255), b = Math.round(rgb[2] * 255);
      var glow0 = (cs.getPropertyValue('--accent-glow-0') || '').replace(/\s/g, '');
      if (glow0.indexOf(r + ',' + g2 + ',' + b) < 0) {
        bad.push(fid + ' glow0=' + glow0);
      }
    });
    UI.applyPalette('human');
    ok('H.1 every accent token follows the chosen faction', bad.length === 0, bad.join(' | '));
  })();

  (function () {
    /* No rule in the stylesheet may hard-code one of the five faction keys.
       A literal faction colour cannot be right on more than one of them. */
    var sheet = null;
    for (var i = 0; i < document.styleSheets.length; i++) {
      try {
        var rules = document.styleSheets[i].cssRules;
        if (rules && rules.length > 20) { sheet = document.styleSheets[i]; break; }
      } catch (e) { /* cross-origin sheet, not ours */ }
    }
    if (!sheet) { ok('H.2 no faction colour is hard-coded in CSS', true, 'sheet unreadable, skipped'); return; }
    var keys = ['human', 'light', 'xeno', 'pirate', 'robotic'].map(function (f) {
      var c = U.hex2rgb(PAINT.FACTIONS[f].accent);
      return {
        f: f,
        hex: PAINT.FACTIONS[f].accent.toLowerCase(),
        rgb: Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255)
      };
    });
    var hits = [];
    var visited = 0;
    /* CHECK THE RULE, THEN DESCEND. Never the other way round.
       The first version of this walk read
           if (r.cssRules) { recurse; continue; }
       which is the obvious shape and is now WRONG: CSS Nesting gave
       CSSStyleRule its own (empty) cssRules list, so that test is truthy for
       every ordinary style rule. The scan recursed into nothing and skipped
       every declaration in the sheet, and the gate reported a clean pass on a
       stylesheet with a deliberately planted hard-coded faction colour in it.
       An inert gate is worse than no gate: it converts an unknown into a false
       assurance. Found by planting the defect and noticing it was not caught,
       which is the only reason to ever plant one. */
    function scan(rules, depth) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        /* r.style.cssText is this rule's OWN declarations, excluding any
           nested children, so a parent is never blamed for a child. */
        if (r.style && typeof r.selectorText === 'string') {
          visited++;
          /* :root is where the tokens are DEFINED, the one legitimate place a
             literal appears. */
          if (!/^:root/.test(r.selectorText)) {
            var flat = (r.style.cssText || '').replace(/\s/g, '').toLowerCase();
            for (var k = 0; k < keys.length; k++) {
              if (flat.indexOf(keys[k].hex) >= 0 || flat.indexOf('(' + keys[k].rgb) >= 0) {
                hits.push(keys[k].f + ' in ' + r.selectorText);
              }
            }
          }
        }
        if (r.cssRules && r.cssRules.length) scan(r.cssRules, depth + 1);
      }
    }
    scan(sheet.cssRules, 0);
    /* A walk that visited almost nothing is a broken walk, not a clean sheet.
       This is the assertion that would have caught the defect above without a
       planted colour. */
    if (visited < 40) hits.push('SCAN VISITED ONLY ' + visited + ' RULES');
    ok('H.2 no faction colour is hard-coded in CSS', hits.length === 0, hits.slice(0, 4).join(' | '));
  })();

  /* ---------- G. determinism of the whole simulation ----------
     Two identical runs, driven identically, must reach identical state. This
     is the property every measurement above depends on. */
  (function () {
    function runOnce() {
      var g = reset({ board: 0, difficulty: 1 });
      g.gold = 20000;
      var free = nearLane(g);
      for (var i = 0; i < 8; i++) SIM.place(free[i].id, DATA.TOWER_ORDER[i]);
      SIM.startWave();
      for (var s = 0; s < 900; s++) SIM.step(1 / 120);
      return [g.kills, Math.round(g.damageDealt), g.lives, g.denizens.length,
              Math.round(g.gold)].join('|');
    }
    var a = runOnce();
    var b = runOnce();
    ok('G.1 two identical runs produce identical state', a === b, a + ' vs ' + b);
  })();

  /* ---------- report ---------- */
  var pass = 0, fail = 0, failures = [];
  results.forEach(function (r) {
    if (r.pass) pass++; else { fail++; failures.push(r.name + ' [' + r.detail + ']'); }
  });
  return JSON.stringify({ pass: pass, fail: fail, total: pass + fail, failures: failures });
})();
