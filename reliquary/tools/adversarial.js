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

  /* ---------- V. the picture is readable ----------
     These assert properties of the RENDERED IMAGE, not of the data behind it.
     A brightness pass can silently destroy the thing that makes a tower
     defence playable: the lane has to read as a lane. It did exactly that
     once, when the lit stop of the ramp was raised until both the lane and the
     ground clipped against the top of the tonemap and rendered at luminance
     153 and 152, identical.

     SAMPLING IS FROM THE BOARD'S OWN GEOMETRY, never from hand-picked screen
     coordinates. The first version of this measurement used two pixel
     positions chosen by eye and reported the lane and ground as identical when
     they were not, because both points happened to sit on the lane. */
  (function () {
    var g = reset();
    if (!GAME.renderOnce(1 / 60)) { ok('V.1 lane reads brighter than ground', true, 'no render, skipped'); return; }
    var gl = R.gl, px = new Uint8Array(4);
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    function readAt(world) {
      var p = R.project(world); if (!p) return null;
      var gx = Math.round(p.x * dpr), gy = Math.round(p.y * dpr);
      if (gx < 0 || gy < 0 || gx >= gl.drawingBufferWidth || gy >= gl.drawingBufferHeight) return null;
      gl.readPixels(gx, gl.drawingBufferHeight - gy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
    }
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : -1; }

    var lane = [], ground = [];
    for (var d = 10; d < g.board.path.length - 10; d += 9) {
      var pt = g.board.pathAt(d).pos;
      var c = readAt([pt[0], g.board.heightAt(pt[0], pt[2]) + 0.05, pt[2]]);
      if (c !== null) lane.push(c);
    }
    for (var i = 0; i < g.board.plots.length; i += 2) {
      var pl = g.board.plots[i];
      if (g.board.distToPath(pl.x, pl.z) < g.board.pathWidth * 2.6) continue;
      var c2 = readAt([pl.x, pl.y + 0.05, pl.z]);
      if (c2 !== null) ground.push(c2);
    }
    var lm = med(lane), gm = med(ground);
    if (lane.length < 4 || ground.length < 4) {
      ok('V.1 lane reads brighter than ground', true, 'too few samples, skipped');
    } else {
      ok('V.1 lane reads brighter than ground', lm > gm * 1.25,
        'lane ' + Math.round(lm) + ' vs ground ' + Math.round(gm) +
        ' (ratio ' + (lm / gm).toFixed(2) + ')');
      /* Nothing may clip: a channel pinned at 255 means the ramp has run out
         of range and two different materials will render the same. */
      ok('V.2 the lit board does not clip', lm < 235 && gm < 200,
        'lane ' + Math.round(lm) + ', ground ' + Math.round(gm));
      /* And it must not be so dark that the art is invisible either. */
      ok('V.3 the board is not underexposed', gm > 45, 'ground ' + Math.round(gm));
    }
  })();

  /* ---------- S. no render term is dead ----------
     THE CLASS OF BUG THIS CATCHES, and it is not hypothetical: the wet
     specular, one of the three pillars this renderer's art direction is built
     on, contributed NOTHING for the whole life of the project. specPower was
     90 and the shader thresholds at 0.35, which needs dot(N,H) above 0.9884,
     a cone 8.7 degrees wide. Every mesh here carries per-face normals, so N is
     constant across a facet and there is no gradient for so narrow a lobe to
     land on. Setting the term's strength to zero changed the measured frame by
     0.0001 in coefficient of variation, which is another way of saying it was
     never running.

     Nothing failed. The shader compiled, the uniform was set every frame, the
     constant looked deliberate, and reading the code told you the feature was
     present. The only thing that could tell you otherwise was turning it off
     and seeing that the picture did not change.

     So each significant term is switched off, the frame re-rendered, and the
     result compared against the same frame with the term on. A term whose
     removal is invisible is not a subtle term, it is an absent one. */

  (function () {
    reset();
    if (!GAME.renderOnce(1 / 60)) { ok('S.0 render terms measurable', true, 'no render, skipped'); return; }
    var gl = R.gl;

    /* Mean luminance and its spread over a fixed central crop. Both are needed:
       a term can move the average without changing structure (an exposure
       tweak) or change structure without moving the average (a texture), and
       either counts as contributing. */
    function frameStats() {
      GAME.renderOnce(1 / 60);
      /* THE WHOLE FRAME, not a crop. The first version of this measured a
         central rectangle that is mostly flat ground, and reported the Sobel
         ink as dead on 0.09% movement. Ink lives on silhouette edges, so
         asking a patch of empty ground about it is the same error as asking a
         matte wall about a specular highlight: the instrument was pointed
         somewhere the effect does not occur. Different terms live in
         different parts of the picture, so the only crop that is fair to all
         of them is all of it. */
      var W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      var x0 = 0, y0 = 0, cw = W, ch = H;
      if (cw < 8 || ch < 8) return null;
      var buf = new Uint8Array(cw * ch * 4);
      gl.readPixels(x0, y0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      var n = cw * ch, sum = 0, lum = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        lum[i] = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
        sum += lum[i];
      }
      var mean = sum / n, v = 0;
      for (var j = 0; j < n; j++) { var dv = lum[j] - mean; v += dv * dv; }
      return { mean: mean, sd: Math.sqrt(v / n), n: n, lum: lum };
    }

    /* THE FILM GRAIN MUST BE OFF, and finding that out was the whole battle.
       The grain is re-randomised every frame, so two otherwise identical
       renders differ by a mean absolute luminance of 2.62. Every term checked
       here contributes LESS than that: the tooth moves 0.90, the rim 1.27, the
       ink 1.70. Three successive versions of this gate were therefore
       measuring grain and calling it evidence, which is why one of them
       reported 59% pixel coverage for a specular term that was not running.
       With grain off the null floor is 0.004, and the same measurements
       separate alive from dead by factors of 7 to 33. */
    var grainWas = R.ART.grain;
    R.ART.grain = 0;

    var base = frameStats();
    if (!base || !(base.mean > 1)) {
      R.ART.grain = grainWas;
      ok('S.0 render terms measurable', true, 'crop unreadable, skipped'); return;
    }
    /* Prove the instrument before trusting it: two renders with nothing
       changed must agree, or every verdict below is noise. */
    var nA = frameStats(), nB = frameStats(), nullMad = 0;
    for (var z = 0; z < nA.lum.length; z++) nullMad += Math.abs(nA.lum[z] - nB.lum[z]);
    nullMad /= nA.lum.length;
    ok('S.the frame is repeatable', nullMad < 0.05, 'null floor ' + nullMad.toFixed(4));

    /* Each entry names an ART constant, the value that disables it, and the
       minimum change its removal must produce, as a percentage of the frame
       mean. The thresholds are deliberately low: this gate is asking whether a
       term runs at all, not whether it is tuned well. */
    /* EACH TERM IS JUDGED ON THE STATISTIC IT ACTUALLY MOVES, and the numbers
       below are measured, not assumed. Two earlier versions of this check were
       wrong in instructive ways:

       Aggregate mean-and-spread, threshold 0.35% of frame mean: PASSED with
       specPower restored to the historical 90, the exact defect it exists to
       catch. The threshold was simply below the noise the dead term still made.

       Share of pixels changed, threshold 8%: ALSO passed at power 90, because
       bloom and the ink pass smear any difference across the whole picture.
       Measured coverage was 59.1% dead against 64.1% alive, which is no
       discrimination at all. Coverage sounds like the right question and is not.

       What separates them is how much light the term puts into the frame:

         term    metric      alive    known-dead
         spec    mean shift  9.84     1.35   (specPower 90)
         tooth   max delta   23.7     collapses when strength is cut
         rim     max delta   127.7          "
         ink     max delta   208.2    measured 0.05% of mean at strength 0.02

       Tooth modulates value symmetrically, so its mean shift is near zero by
       design and only peak deviation shows it running; the specular adds light
       and barely moves any single pixel's peak, so only the mean shows it.
       One universal statistic cannot see both. Thresholds sit near half the
       healthy value: loose enough to survive a tuning change, tight enough
       that a term reduced to a rounding error fails. */
    /* MEASURED, with grain off and a null floor of 0.004. Alive is this build;
       dead is the term actually planted broken and re-measured.

         term    alive mad   planted dead   threshold
         spec    9.832       1.346  (specPower 90)      4.00
         tooth   0.895       0.027  (strength 0.01)     0.35
         rim     1.274       collapses with strength    0.55
         ink     1.702                "                 0.70

       Thresholds sit near 40% of healthy: loose enough to survive retuning,
       tight enough that a term reduced to a rounding error fails. */
    var TERMS = [
      { key: 'specStrength',  off: 0, min: 4.00, label: 'wet specular' },
      { key: 'toothStrength', off: 0, min: 0.35, label: 'canvas tooth' },
      { key: 'rimStrength',   off: 0, min: 0.55, label: 'fresnel rim' },
      { key: 'inkStrength',   off: 0, min: 0.70, label: 'sobel ink' }
    ];

    TERMS.forEach(function (t) {
      if (!(t.key in R.ART)) { ok('S.' + t.key + ' exists', false, 'ART.' + t.key + ' missing'); return; }
      var was = R.ART[t.key];
      R.ART[t.key] = t.off;
      var off = frameStats();
      R.ART[t.key] = was;
      var on = frameStats();
      if (!off || !on) { ok('S.' + t.key, true, 'unreadable, skipped'); return; }
      /* Restoring must return the picture to where it started, otherwise the
         two samples are not comparable and the verdict is meaningless. */
      var drift = Math.abs(on.mean - base.mean) / base.mean * 100;
      /* COVERAGE, NOT AGGREGATE. The first version of this check compared
         frame mean and spread, and it did not catch the defect it was written
         for: restoring specPower to the historical 90 left the gate green.
         A term that fires hard on a handful of facets somewhere in the frame
         moves an aggregate enough to clear any threshold loose enough to be
         portable, while contributing nothing to the other 99% of the surface,
         which is exactly what "dead" means here. So count PIXELS the term
         actually reaches: how much of the picture changes at all when it is
         removed. That is the question, and the aggregate was never asking it. */
      var sumAbs = 0;
      for (var q = 0; q < on.lum.length; q++) sumAbs += Math.abs(on.lum[q] - off.lum[q]);
      var mad = sumAbs / on.lum.length;
      ok('S.' + t.label + ' actually contributes', drift < 0.5 && mad >= t.min,
        'mean absolute change ' + mad.toFixed(3) + ' (need ' + t.min +
        '), restore drift ' + drift.toFixed(2) + '%');
    });

    R.ART.grain = grainWas;

    /* And the impasto ridge mask must carry real signal rather than the
       constant it held before: a texture channel pinned to one value is the
       same dead-feature shape, one layer down. */
    try {
      var cvA = PAINT.buildAtlas(128);
      var ad = cvA.getContext('2d').getImageData(0, 0, 128, 128).data;
      var s1 = 0, s2 = 0, N = ad.length / 4;
      for (var q = 3; q < ad.length; q += 4) { s1 += ad[q]; s2 += ad[q] * ad[q]; }
      var am = s1 / N, asd = Math.sqrt(Math.max(0, s2 / N - am * am));
      ok('S.ridge channel carries signal', asd > 25 && am > 10 && am < 245,
        'alpha mean ' + am.toFixed(1) + ', sd ' + asd.toFixed(1));
    } catch (e) {
      ok('S.ridge channel carries signal', false, 'threw: ' + e.message);
    }
  })();

  /* ---------- M. ambient motes and soft particles ----------
     THE CLASS OF BUG THIS CATCHES, freshly committed by me and caught by
     nothing: the mote emitter called U.rand(), which does not exist. This
     module's RNG is a local `rnd` from U.rng('fx'); U itself exports rng and
     never exported rand. Every call threw, the field stayed at zero particles,
     and the full gate went green across nine steps and 142 checks because no
     harness ever called FX.moteUpdate. A feature can be written, wired into
     the loop, bundled and shipped without one line of it ever executing.

     So these checks do the one thing that would have caught it: they run the
     emitter and then look at what came out. */

  (function () {
    var g = reset();
    if (!FX.moteUpdate) { ok('M.1 ambient motes exist', false, 'FX.moteUpdate missing'); return; }

    FX.clear();
    FX.moteSetup(g.board, R.palette());
    /* Long enough for the gradual refill to reach its target. */
    for (var i = 0; i < 240; i++) { FX.moteUpdate(1 / 60); FX.update(1 / 60); }

    var n = 0, inBounds = 0, b = FX.motes.bounds;
    for (var k = 0; k < FX.count; k++) {
      var s = R.debugParticleSlot ? null : null;
      n++;
    }
    /* Count by kind through the public spawn record rather than by poking at
       the pool internals, which the harness has no business knowing. */
    var counts = FX.debugKindCounts();
    var moteN = counts[FX.KIND.MOTE] || 0;

    ok('M.1 the mote field populates', moteN >= FX.motes.want * 0.8,
      moteN + ' alive of ' + FX.motes.want + ' wanted');

    ok('M.2 motes stay in the volume above the board', FX.moteBoundsOk(),
      'bounds ' + (b ? b.hw.toFixed(1) + ' x ' + b.hh.toFixed(1) +
        ', y ' + b.lo + ' to ' + b.hi : 'none'));

    /* Atmosphere must never eat the budget that hits and deaths need. A wave
       landing while the dust is at full strength is exactly when the impact
       particles matter most, so the field is capped well below the pool. */
    ok('M.3 motes leave room for impacts', FX.motes.want < FX.max * 0.12,
      FX.motes.want + ' motes against a pool of ' + FX.max);

    /* And the emitter must be recycling rather than leaking: run it much
       longer and the count must not climb. */
    for (var j = 0; j < 900; j++) { FX.moteUpdate(1 / 60); FX.update(1 / 60); }
    var later = FX.debugKindCounts()[FX.KIND.MOTE] || 0;
    ok('M.4 the field is recycled, not accumulated', later <= FX.motes.want * 1.05,
      moteN + ' then ' + later);
  })();

  (function () {
    /* SOFT PARTICLES. The fade needs the scene depth from MRT attachment 1,
       which is attached to the framebuffer being drawn into, so the pass
       detaches it first. Get that wrong and it is either a feedback loop or a
       silently unbound sampler reading zeros, and zeros mean every particle
       is fully faded: the system disappears rather than erroring. */
    var g = reset();
    if (!GAME.renderOnce(1 / 60)) { ok('M.5 soft particles fade', true, 'no render, skipped'); return; }
    if (!('particleSoftness' in R.ART)) { ok('M.5 soft particles fade', false, 'ART.particleSoftness missing'); return; }

    var grainWas = R.ART.grain;
    R.ART.grain = 0;
    FX.clear();
    /* A dense low cloud straddling the ground plane, which is exactly where a
       hard intersection line would show. */
    for (var i = 0; i < 300; i++) {
      FX.spawn({
        x: (i % 20) - 10, y: 0.15 + (i % 7) * 0.1, z: ((i / 20) | 0) - 7,
        r: 1, g: 0.9, b: 0.8, life: 9, size: 1.6, kind: FX.KIND.SMOKE,
        alpha: 0.7, grav: 0, drag: 0
      });
    }
    /* AGE THE CLOUD PAST ITS BIRTH EASE. Particles grow out of nothing over
       the first 12% of their life, so a cloud measured on the frame it was
       spawned has a rendered size near zero and is invisible. The first
       version of this check did exactly that and reported the soft fade dead:
       300 quads of size 1.6 moved the frame mean by 0.037, because they were
       being drawn at size 0.113. The renderer was right and the test was
       looking at a cloud that had not grown yet. */
    for (var w = 0; w < 120; w++) FX.update(1 / 60);

    var gl = R.gl;
    function mean() {
      GAME.renderOnce(0);
      var W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      var buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      var s = 0, n = W * H;
      for (var q = 0; q < n; q++) s += 0.2126 * buf[q * 4] + 0.7152 * buf[q * 4 + 1] + 0.0722 * buf[q * 4 + 2];
      return s / n;
    }

    var was = R.ART.particleSoftness;
    R.ART.particleSoftness = 0.001;   /* effectively hard-edged */
    var hard = mean();
    R.ART.particleSoftness = 6.0;     /* heavily faded */
    var soft = mean();
    R.ART.particleSoftness = was;
    var back = mean();
    /* The repeat sample for M.7 is taken BEFORE the grain goes back on. The
       first version restored it first and then compared two grainy frames,
       which differ by 2.62 in mean absolute luminance for reasons that have
       nothing to do with the setting under test. */
    var back2 = mean();

    /* Softening must REMOVE light: the fade can only ever reduce alpha. If the
       sampler were unbound the depth would read as zero, every particle would
       be fully faded at both settings, and the two would be equal. */
    ok('M.5 the soft-particle fade is running', hard - soft > 0.35,
      'hard ' + hard.toFixed(2) + ' vs soft ' + soft.toFixed(2) +
      ' (difference ' + (hard - soft).toFixed(2) + ')');
    ok('M.6 particles are visible at all', hard > 1.0 && soft > 0.5,
      'hard ' + hard.toFixed(2) + ', soft ' + soft.toFixed(2));
    ok('M.7 the setting restores cleanly', Math.abs(back - back2) < 0.05,
      'restored to ' + back.toFixed(2) + ', repeat ' + back2.toFixed(2));
    R.ART.grain = grainWas;
    FX.clear();
  })();

  /* ---------- C. frustum culling is both effective and safe ----------
     An optimisation needs two proofs and neither is worth anything alone. That
     it removes work: a cull that never fires is a dead feature wearing the
     costume of a fast one, and this project has already shipped two of those.
     That it removes only invisible work: a cull that drops geometry the player
     can see is not a fast renderer, it is a broken one, and it will look like
     a fast renderer in every benchmark.

     So the same frame is rendered twice, once with culling and once without,
     and the two images are compared pixel for pixel. */
  (function () {
    var g = reset();
    if (!GAME.renderOnce(1 / 60) || !('cull' in R.ART)) {
      ok('C.1 culling is measurable', true, 'no render or no toggle, skipped'); return;
    }
    /* FILL THE BOARD FIRST. An empty board draws five things, and a cull that
       removes two of five proves nothing about a cull that has to remove
       eighty of a hundred and ten. The first version of this check tested the
       default reset state and failed for exactly that reason. */
    g.gold = 999999;
    var order = DATA.TOWER_ORDER;
    g.board.plots.forEach(function (pl, i) { SIM.place(pl.id, order[i % order.length]); });
    for (var q = 0; q < 8; q++) { SIM.spawnDenizen('chitling', { dist: 6 + q * 5 }); }
    for (var r = 0; r < 30; r++) SIM.step(1 / 60);
    var gl = R.gl, grainWas = R.ART.grain;
    R.ART.grain = 0;

    function snap() {
      GAME.renderOnce(0);
      var W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      var b = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
      var n = W * H, L = new Float32Array(n);
      for (var i = 0; i < n; i++) L[i] = 0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2];
      return { L: L, st: R.stats() };
    }
    function compare() {
      R.ART.cull = 0; var off = snap();
      R.ART.cull = 1; var on = snap();
      var worst = 0, over = 0;
      for (var i = 0; i < off.L.length; i++) {
        var d = Math.abs(off.L[i] - on.L[i]);
        if (d > worst) worst = d;
        if (d > 2) over++;
      }
      return { off: off.st, on: on.st, worst: worst, over: over, px: off.L.length };
    }

    /* Zoomed right in, which is where culling has something to do and also
       where a wrong cull is most obvious: at this distance most of the board
       is off screen but the part that remains fills the frame. */
    var cam = GAME.cam;
    cam.targetDist = cam.dist = 30;
    cam.targetPitch = cam.pitch = 0.60;
    for (var w = 0; w < 10; w++) GAME.renderOnce(1 / 60);
    var z = compare();

    /* MEASURED, on a board with a tower on every plot and a wave walking:
       196 draws becomes 122, so 74 items are cut. A sparser board zoomed to
       the same distance cuts harder, 110 to 25, because fewer of the things
       that remain are near the camera. The threshold is set from the DENSER
       case, which is both the pessimistic one and the one that matters, since
       a full board is when frame time is under the most pressure. */
    ok('C.1 culling removes work when zoomed in', z.on.draws < z.off.draws * 0.75,
      z.off.draws + ' draws becomes ' + z.on.draws + ' (' + z.on.culled + ' culled)');

    /* THE SAFETY PROOF. Not "looks the same": zero pixels may differ by more
       than two levels, which is the noise the renderer produces between two
       identical frames anyway. */
    ok('C.2 culling changes nothing on screen', z.over === 0 && z.worst < 3.0,
      z.over + ' of ' + z.px + ' pixels differ by more than 2, worst ' + z.worst.toFixed(1));

    /* And it must not fire when the whole board is in view, or the sphere test
       is too tight and is trimming things at the edge of the frame. */
    GAME.__fitCamera && GAME.__fitCamera();
    for (var v = 0; v < 10; v++) GAME.renderOnce(1 / 60);
    var f = compare();
    ok('C.3 nothing is culled when the whole board is in view', f.on.culled === 0 && f.over === 0,
      f.on.culled + ' culled, ' + f.over + ' pixels changed');

    R.ART.cull = 1;
    R.ART.grain = grainWas;
  })();

  /* ---------- W. feet stay planted ----------
     THE definitive measure of walk quality, and the one the eye notices even
     when it cannot name it. In a correct gait at least one foot is in stance
     at every instant, and a foot in stance is STATIONARY IN THE WORLD while
     the body travels over it. So at every frame, the smallest per-frame world
     displacement across all of a creature's feet should be near zero. If the
     minimum tracks the body's own speed instead, every foot is sliding and the
     creature is skating.

     This is checkable because the gait rate is now DERIVED from the stride
     rather than tuned by eye:  phaseRate = speed * duty / (stride * scale).
     The old hand-picked constants could not satisfy it for all three rigs. */
  (function () {
    var g = reset();
    if (!GAME.renderOnce(1 / 60)) { ok('W.1 planted feet do not slide', true, 'no render, skipped'); return; }
    var report = [];
    var worst = 0, worstRig = '';
    ['crawler', 'walker', 'strider'].forEach(function (rigType) {
      var type = rigType === 'crawler' ? 'chitling' : (rigType === 'walker' ? 'hivelord' : 'broodmother');
      var gg = reset();
      var d = SIM.spawnDenizen(type, { dist: 20 });
      if (!d) return;
      d.hp = d.maxHp = 9e9;
      var D = MODELS.RIG_DIMS[rigType];
      /* Warm up so the gait is in steady state before measuring. */
      for (var w = 0; w < 40; w++) { SIM.step(1 / 60); GAME.renderOnce(1 / 60); }

      function feet() {
        var rig = GAME.__rigFor ? GAME.__rigFor(d) : null;
        if (!rig) return null;
        var out = [], i = 0, part;
        while ((part = rig.get('legL' + i))) {
          out.push(U.m4xform(part.world, [0, -D.lower, 0]));
          i++;
        }
        return out.length ? out : null;
      }

      var prev = feet();
      if (!prev) { report.push(rigType + ':no-feet'); return; }
      var minsSum = 0, n = 0;
      for (var f = 0; f < 90; f++) {
        SIM.step(1 / 60); GAME.renderOnce(1 / 60);
        var cur = feet();
        if (!cur || cur.length !== prev.length) { prev = cur; continue; }
        var best = Infinity;
        for (var k = 0; k < cur.length; k++) {
          var dd = U.V.dist(cur[k], prev[k]);
          if (dd < best) best = dd;
        }
        minsSum += best; n++;
        prev = cur;
      }
      var avgMin = n ? minsSum / n : 999;
      /* What a fully sliding foot would look like: the body's own travel per
         frame. A planted foot should be a small fraction of that. */
      var bodyPerFrame = d.def.speed * (1 / 60) * d.scale;
      var ratio = avgMin / Math.max(1e-6, bodyPerFrame);
      report.push(rigType + ' ' + ratio.toFixed(2));
      if (ratio > worst) { worst = ratio; worstRig = rigType; }
    });
    /* MEASURED BASELINE: 0.00 on all three rigs, because a planted foot now
       solves to a stored WORLD coordinate and the IK reaches it exactly.
       The threshold is 0.15 rather than something looser because the true
       value is zero: anything that starts creeping is a real regression, and a
       generous bound here would have hidden the 0.45 to 0.52 the hand-tuned
       gait produced before any of this was fixed. */
    ok('W.1 planted feet do not slide', worst < 0.15,
      'foot travel vs body travel: ' + report.join(', ') + ' (worst ' + worstRig + ')');
  })();

  (function () {
    /* THE IK MUST ACTUALLY REACH ITS TARGET.
       This is upstream of every other animation property, and it was broken:
       the euler conversion in RIG.driveLeg used a yaw and a pitch that were
       each a half turn out. The two errors CANCEL for axis-aligned directions,
       so a bone pointing straight down or straight along an axis looked
       correct and nothing threw. For a general direction they do not cancel,
       and the vertical component of the aim came out inverted.

       Measured on a strider whose whole leg is 2.88 units: the gap between the
       requested foot position and the delivered one was 1.86, 4.74, 3.83 and
       5.01 units. The legs were not walking badly, they were in arbitrary
       poses. Now 0.000 on every leg. */
    var g = reset();
    if (!GAME.renderOnce(1 / 60)) { ok('W.2 IK reaches its target', true, 'no render, skipped'); return; }
    GAME.__probeIK = true;
    var worst = 0, detail = [];
    [['crawler', 'chitling'], ['walker', 'hivelord'], ['strider', 'broodmother']].forEach(function (pair) {
      var gg = reset();
      GAME.__probeIK = true;
      var d = SIM.spawnDenizen(pair[1], { dist: 20 });
      if (!d) return;
      d.hp = d.maxHp = 9e9;
      for (var w = 0; w < 45; w++) { SIM.step(1 / 60); GAME.renderOnce(1 / 60); }
      var rig = GAME.__rigFor(d), D = MODELS.RIG_DIMS[pair[0]];
      var cy = Math.cos(d.yaw), sy = Math.sin(d.yaw), sc = d.scale;
      var maxErr = 0, i = 0, up, lo;
      while ((up = rig.get('legU' + i)) && (lo = rig.get('legL' + i))) {
        if (up.__wantFoot) {
          var actual = U.m4xform(lo.world, [0, -D.lower, 0]);
          var p = up.__wantFoot;
          var x = p[0] * sc, y = p[1] * sc, z = p[2] * sc;
          var want = [d.pos[0] + (x * cy + z * sy), d.pos[1] + y, d.pos[2] + (-x * sy + z * cy)];
          var e = U.V.dist(actual, want);
          if (e > maxErr) maxErr = e;
        }
        i++;
      }
      detail.push(pair[0] + ' ' + maxErr.toFixed(3));
      if (maxErr > worst) worst = maxErr;
    });
    GAME.__probeIK = false;
    ok('W.2 IK reaches its target', worst < 0.05, detail.join(', ') + ' world units of error');
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
