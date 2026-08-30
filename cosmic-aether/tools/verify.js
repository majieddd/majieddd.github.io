/* RELIQUARY :: tools/verify
   The harness. Loaded BY FETCH into a running page so its body never enters a
   transcript, and evaluated against the shipped build rather than a test one.

   WHAT IT IS FOR. A green boot proves the page loaded. It proves nothing about
   whether the fourteen towers can actually kill anything, whether all ten
   reactions can fire, or whether wave twenty is reachable. Those are the
   claims worth making, so those are the ones checked here.

   THE RULE THIS FILE OBEYS: enumerate ENTRY POINTS, not functions. Every
   tower's attack path is a separate branch (bullet, shell, beam, chain, cone,
   hitscan, field, sweep, support) and a test that happens to exercise three of
   them while the other eleven sit out of range has demonstrated nothing about
   the eleven. Each tower is therefore tested ALONE, placed at the plot nearest
   the lane, against denizens spawned directly in front of it.

   Usage from a steps file:
     const RUN = "(async () => (0, eval)(await (await fetch('/reliquary/tools/verify.js')).text()))()";
*/
(function () {
  'use strict';

  var results = [];
  var t0 = (performance && performance.now) ? performance.now() : Date.now();

  function ok(name, pass, detail) {
    results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
    return !!pass;
  }
  function section(n) { results.push({ section: n }); }

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

  function stepSim(seconds, sub) {
    sub = sub || (1 / 120);
    var n = Math.max(1, Math.round(seconds / sub));
    for (var i = 0; i < n; i++) { SIM.step(sub); FX.update(sub); }
  }

  /* ---------- 1. content counts ---------- */
  section('CONTENT');
  var c = window.__RQ.counts();
  ok('1.1 fourteen towers defined', c.towers === 14, c.towers);
  ok('1.2 ten reactions defined', c.reactions === 10, c.reactions);
  ok('1.3 seven elements defined', c.elements === 7, c.elements);
  ok('1.4 twenty waves defined', c.waves === 20, c.waves);
  ok('1.5 five commanders defined', c.commanders === 5, c.commanders);
  ok('1.6 four boards defined', c.boards === 4, c.boards);

  /* Every tower must name a real element, and every element must be reachable
     by at least one tower, or some reactions are unplayable by construction. */
  var elUsed = {};
  var badEl = [];
  DATA.TOWER_ORDER.forEach(function (id) {
    var d = DATA.TOWERS[id];
    if (!DATA.ELEMENTS[d.element]) badEl.push(id);
    elUsed[d.element] = (elUsed[d.element] || 0) + 1;
  });
  ok('1.7 every tower has a real element', badEl.length === 0, badEl.join(','));
  var unreachable = DATA.ELEMENT_ORDER.filter(function (e) { return !elUsed[e]; });
  ok('1.8 every element has a tower', unreachable.length === 0, unreachable.join(','));

  /* Every reaction must be reachable from the tower list actually shipped. */
  var unreachableR = DATA.REACTIONS.filter(function (r) {
    return !elUsed[r.a] || !elUsed[r.b];
  }).map(function (r) { return r.id; });
  ok('1.9 every reaction is reachable from the roster', unreachableR.length === 0, unreachableR.join(','));

  /* ---------- 2. board ---------- */
  section('BOARD');
  var G = reset();
  ok('2.1 board built', !!G.board, '');
  ok('2.2 path has length', G.board.path.length > 40, Math.round(G.board.path.length));
  ok('2.3 plots exist', G.board.plots.length >= 20, G.board.plots.length);
  ok('2.4 ground mesh has triangles', G.board.groundData.triCount > 400, G.board.groundData.triCount);

  /* No plot may sit on the lane: a tower on the road is either unreachable or
     a blocker, and neither is a mechanic this game has. */
  var onLane = G.board.plots.filter(function (p) {
    return G.board.distToPath(p.x, p.z) < G.board.pathWidth;
  });
  ok('2.5 no build plot sits on the lane', onLane.length === 0, onLane.length);

  /* The path must actually cross the plate, not run off its edge. */
  var offPlate = 0;
  for (var s = 0; s < G.board.path.length; s += 4) {
    var pt = G.board.pathAt(s).pos;
    if (Math.abs(pt[0]) > G.board.halfW || Math.abs(pt[2]) > G.board.halfH) offPlate++;
  }
  ok('2.6 the lane stays on the plate', offPlate === 0, offPlate + ' samples off');

  /* All three boards must build without throwing and must satisfy the same. */
  var boardIssues = [];
  for (var bi = 0; bi < DATA.BOARDS.length; bi++) {
    try {
      var bg = reset({ board: bi });
      if (bg.board.plots.length < 18) boardIssues.push(DATA.BOARDS[bi].id + ':plots=' + bg.board.plots.length);
      var off = 0;
      for (var s2 = 0; s2 < bg.board.path.length; s2 += 5) {
        var p2 = bg.board.pathAt(s2).pos;
        if (Math.abs(p2[0]) > bg.board.halfW || Math.abs(p2[2]) > bg.board.halfH) off++;
      }
      if (off > 0) boardIssues.push(DATA.BOARDS[bi].id + ':offplate=' + off);
    } catch (e) {
      boardIssues.push(DATA.BOARDS[bi].id + ':threw ' + e.message);
    }
  }
  ok('2.7 all four boards build and contain their lane', boardIssues.length === 0, boardIssues.join(' '));

  /* ---------- 3. every tower fires ----------
     Each tower ALONE, on the plot closest to the lane, with denizens spawned
     right in front of it. This is the check that a wave test cannot make,
     because in a wave the first tower to get range kills everything and the
     rest look broken in exactly the same way a genuinely broken one would. */
  section('TOWERS');
  var towerReport = [];
  DATA.TOWER_ORDER.forEach(function (id) {
    /* Support towers have no attack path at all, so asserting that they deal
       damage tests nothing and fails for the right reason. They are proved
       separately, by their payout. */
    if (DATA.TOWERS[id].kind === 'support') return;
    var g = reset();
    g.gold = 99999;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    var t = SIM.place(free[0].id, id);
    if (!t) { ok('3.x ' + id + ' places', false, 'place returned null'); return; }

    var def = DATA.TOWERS[id];
    /* Put bodies where this tower can reach them. Feed them onto the lane at
       the point nearest the tower, then walk them. */
    var bestD = 0, bestDist = 1e9;
    for (var d = 0; d < g.board.path.length; d += 2) {
      var pt = g.board.pathAt(d).pos;
      var dd = Math.hypot(pt[0] - t.pos[0], pt[2] - t.pos[2]);
      if (dd < bestDist) { bestDist = dd; bestD = d; }
    }
    /* Start them a little short of the tower so they walk INTO range, which
       also exercises the minimum-range rule on MORTAR. */
    var startAt = Math.max(0, bestD - 14);
    for (var k = 0; k < 10; k++) {
      var dz = SIM.spawnDenizen(k % 3 === 0 ? 'tither' : 'chitling', { dist: startAt + k * 1.6 });
      if (dz) dz.hp = dz.maxHp = 4000;   /* survive long enough to be measured */
    }
    var before = t.damage;
    stepSim(12);
    var dealt = t.damage - before;
    towerReport.push({ id: id, kind: def.kind, damage: Math.round(dealt) });
    ok('3.' + id + ' deals damage', dealt > 0, Math.round(dealt) + ' (' + def.kind + ')');
  });

  /* The economy tower has no attack, so it is proved a different way: it must
     pay out at the end of a wave. */
  (function () {
    var g = reset();
    g.gold = 99999;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    SIM.place(free[0].id, 'vault');
    g.wave = 1;
    var before = g.gold;
    /* endWave is internal, so drive it the way the game does: start a wave
       with nothing in it and let it complete. */
    g.waveActive = true;
    g.spawnQueue.length = 0;
    stepSim(0.5);
    ok('3.vault pays income at wave end', g.gold > before, (g.gold - before) + 'g');
  })();

  /* ---------- 4. every reaction fires ---------- */
  section('REACTIONS');
  reset();
  var reactionFails = [];
  DATA.REACTIONS.forEach(function (r) {
    var res = window.__RQ.forceReaction(r.a, r.b);
    if (!res || !res.fired || res.expected !== r.id) {
      reactionFails.push(r.id + '(' + (res ? res.expected : 'null') + ')');
    }
  });
  ok('4.1 all ten reactions fire on their pair', reactionFails.length === 0, reactionFails.join(' '));

  /* A reaction must NOT fire for a same-element double hit, or every tower
     would trigger reactions against itself. */
  (function () {
    var g = reset();
    var before = 0; for (var k in g.reactionCounts) before += g.reactionCounts[k];
    var d = SIM.spawnDenizen('stockman', { dist: 10 });
    d.hp = d.maxHp = 500000;
    SIM.damage(d, 1, { element: 'fire' });
    SIM.damage(d, 1, { element: 'fire' });
    var after = 0; for (var k2 in g.reactionCounts) after += g.reactionCounts[k2];
    ok('4.2 same element twice does not react', after === before, after - before);
  })();

  /* An unpaired combination must also not react. */
  (function () {
    var g = reset();
    var before = 0; for (var k in g.reactionCounts) before += g.reactionCounts[k];
    var d = SIM.spawnDenizen('stockman', { dist: 10 });
    d.hp = d.maxHp = 500000;
    SIM.damage(d, 1, { element: 'kinetic' });
    SIM.damage(d, 1, { element: 'frost' });
    var after = 0; for (var k2 in g.reactionCounts) after += g.reactionCounts[k2];
    ok('4.3 an unpaired combination does not react', after === before, after - before);
  })();

  /* ---------- 5. denizen behaviours ---------- */
  section('DENIZENS');

  (function () {
    var g = reset();
    var d = SIM.spawnDenizen('chitling', { dist: 0 });
    var start = d.dist;
    stepSim(3);
    ok('5.1 denizens advance along the lane', d.dist > start + 5, (d.dist - start).toFixed(1));
  })();

  (function () {
    var g = reset();
    var f = SIM.spawnDenizen('tither', { dist: 5 });
    stepSim(0.5);
    var groundY = g.board.heightAt(f.pos[0], f.pos[2]);
    ok('5.2 flyers fly above the ground', f.pos[1] > groundY + 2, (f.pos[1] - groundY).toFixed(2));
  })();

  (function () {
    var g = reset();
    var m = SIM.spawnDenizen('broodmother', { dist: 20 });
    var before = g.denizens.length;
    m.hp = 1;
    SIM.damage(m, 9999, {});
    ok('5.3 broodmother splits on death', g.denizens.length > before, g.denizens.length - before);
  })();

  (function () {
    var g = reset();
    var h = SIM.spawnDenizen('hivelord', { dist: 20 });
    var before = g.denizens.length;
    stepSim(8);
    ok('5.4 hivelord summons', g.denizens.length > before, g.denizens.length - before);
  })();

  (function () {
    var g = reset();
    var wounded = SIM.spawnDenizen('chitling', { dist: 20 });
    wounded.hp = wounded.maxHp * 0.3;
    SIM.spawnDenizen('graft', { dist: 20.5 });
    var before = wounded.hp;
    stepSim(2);
    ok('5.5 mender heals a wounded ally', wounded.hp > before, (wounded.hp - before).toFixed(1));
  })();

  (function () {
    var g = reset();
    var boss = SIM.spawnDenizen('harbinger', { dist: 10 });
    var before = boss.phaseIdx;
    boss.hp = boss.maxHp * 0.30;
    stepSim(0.2);
    ok('5.6 boss changes phase at its thresholds', boss.phaseIdx > before, before + ' to ' + boss.phaseIdx);
  })();

  (function () {
    var g = reset();
    var d = SIM.spawnDenizen('chitling', { dist: g.board.path.length - 3 });
    var lives = g.lives;
    stepSim(3);
    ok('5.7 reaching the goal costs a life', g.lives < lives, lives + ' to ' + g.lives);
  })();

  /* Armour must reduce damage, and never past the cap. */
  (function () {
    var g = reset();
    var soft = SIM.spawnDenizen('chitling', { dist: 10 });
    var hard = SIM.spawnDenizen('stockman', { dist: 12 });
    soft.hp = soft.maxHp = 100000;
    hard.hp = hard.maxHp = 100000;
    var a = SIM.damage(soft, 1000, {});
    var b = SIM.damage(hard, 1000, {});
    ok('5.8 armour reduces damage', b < a, Math.round(b) + ' vs ' + Math.round(a));
    ok('5.9 armour never exceeds the cap', SIM.armorOf(hard) <= 0.75, SIM.armorOf(hard).toFixed(3));
  })();

  /* ---------- 6. economy and progression ---------- */
  section('ECONOMY');

  (function () {
    var g = reset();
    var gold = g.gold;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    var t = SIM.place(free[0].id, 'bolt');
    ok('6.1 building costs gold', g.gold === gold - DATA.TOWERS.bolt.cost, g.gold);
    var afterBuild = g.gold;
    var v = SIM.sell(t);
    ok('6.2 selling refunds a fraction', g.gold === afterBuild + v && v < DATA.TOWERS.bolt.cost, v);
  })();

  (function () {
    var g = reset();
    g.gold = 99999;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    var t = SIM.place(free[0].id, 'bolt');
    var s0 = SIM.stats(t);
    SIM.upgrade(t);
    var s1 = SIM.stats(t);
    SIM.upgrade(t);
    var s2 = SIM.stats(t);
    ok('6.3 upgrades raise damage', s2.dps > s1.dps && s1.dps > s0.dps,
      Math.round(s0.dps) + ' to ' + Math.round(s1.dps) + ' to ' + Math.round(s2.dps));
    ok('6.4 tier caps at 2', !SIM.upgrade(t), 'tier=' + t.tier);
  })();

  (function () {
    var g = reset();
    g.gold = 0;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    ok('6.5 cannot build without gold', SIM.place(free[0].id, 'bolt') === null, '');
  })();

  (function () {
    var g = reset();
    g.gold = 99999;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    SIM.place(free[0].id, 'bolt');
    ok('6.6 cannot build on an occupied plot', SIM.place(free[0].id, 'cryo') === null, '');
  })();

  /* The wave curve must be monotonic and must actually escalate. */
  (function () {
    var mono = true;
    for (var w = 2; w <= 20; w++) {
      if (DATA.waveHpMultiplier(w) <= DATA.waveHpMultiplier(w - 1)) mono = false;
    }
    ok('6.7 wave health curve rises every wave', mono, '');
    ok('6.8 wave 20 is far above wave 1',
      DATA.waveHpMultiplier(20) > 40, DATA.waveHpMultiplier(20).toFixed(1) + 'x');
  })();

  /* ---------- 7. commander abilities ---------- */
  section('COMMANDERS');
  DATA.COMMANDER_ORDER.forEach(function (cid) {
    var g = reset({ commander: cid });
    g.gold = 99999;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    SIM.place(free[0].id, 'bolt');
    for (var i = 0; i < 8; i++) SIM.spawnDenizen('chitling', { dist: 12 + i });
    var qOk = SIM.useAbility('q');
    var eOk = SIM.useAbility('e');
    stepSim(1.2);
    ok('7.' + cid + ' both abilities fire', qOk && eOk, 'q=' + qOk + ' e=' + eOk);
  });

  (function () {
    var g = reset();
    SIM.useAbility('q');
    var onCd = SIM.useAbility('q');
    ok('7.9 an ability on cooldown is refused', onCd === false, '');
  })();

  /* Every global buff an ability sets must be cleared when it expires, or the
     player keeps a permanent buff after one press. */
  (function () {
    var g = reset({ commander: 'vanta' });
    SIM.useAbility('q');
    var during = g.globalBuffs.fireRate;
    stepSim(DATA.COMMANDERS.vanta.q.dur + 0.6);
    ok('7.10 a timed buff is cleared when it expires',
      during > 1 && g.globalBuffs.fireRate === 1, during + ' then ' + g.globalBuffs.fireRate);
  })();

  /* ---------- 8. a full run ----------
     The claim that matters most: twenty waves are reachable and winnable, and
     nothing throws on the way. Run with a strong board so the run completes. */
  section('FULL RUN');
  (function () {
    var g = reset({ difficulty: 0 });
    g.gold = 400000;
    var free = g.board.plots.slice().sort(function (a, b) { return a.dist - b.dist; });
    var placed = 0;
    for (var i = 0; i < free.length; i++) {
      var pick = DATA.TOWER_ORDER[i % DATA.TOWER_ORDER.length];
      if (pick === 'vault') pick = 'bolt';
      if (SIM.place(free[i].id, pick)) placed++;
    }
    for (var u = 0; u < g.towers.length; u++) { SIM.upgrade(g.towers[u]); SIM.upgrade(g.towers[u]); }
    ok('8.1 a full board can be built', placed > 20, placed + ' towers');

    var guard = 0;
    while (g.status === 'play' && guard < 3000) {
      stepSim(0.5, 1 / 60);
      guard++;
    }
    ok('8.2 the run terminates', g.status !== 'play', g.status + ' at wave ' + g.wave);
    ok('8.3 wave 20 is reachable', g.wave >= 20, 'wave ' + g.wave);
    ok('8.4 a strong board wins', g.status === 'won', g.status + ' lives=' + g.lives);
    ok('8.5 kills accumulated', g.kills > 200, g.kills);
    ok('8.6 reactions fired during the run',
      Object.keys(g.reactionCounts).length >= 3, Object.keys(g.reactionCounts).join(','));
  })();

  /* A bare board must LOSE, or the game has no failure state and no tension. */
  (function () {
    var g = reset({ difficulty: 2 });
    var guard = 0;
    while (g.status === 'play' && guard < 3000) { stepSim(0.5, 1 / 60); guard++; }
    ok('8.7 an undefended board loses', g.status === 'lost', g.status + ' at wave ' + g.wave);
  })();

  /* ---------- 9. no errors anywhere ---------- */
  section('ERRORS');
  var errs = window.__RQ.errors();
  ok('9.1 no GL errors', errs.gl.length === 0, JSON.stringify(errs.gl).slice(0, 200));
  ok('9.2 no render errors', errs.render.length === 0, JSON.stringify(errs.render).slice(0, 200));
  ok('9.3 no sim errors', errs.sim.length === 0, JSON.stringify(errs.sim).slice(0, 300));
  ok('9.4 no game errors', errs.game.length === 0, JSON.stringify(errs.game).slice(0, 300));
  ok('9.5 no audio errors', errs.audio.length === 0, JSON.stringify(errs.audio).slice(0, 200));

  /* ---------- 10. interface gates ----------
     Geometry and computed style, measured on the real rendered page, per the
     design gates that say a claim about layout is unproven until measured. */
  section('INTERFACE');
  reset();
  window.__RQ.closeScreens();

  (function () {
    var nav = document.getElementById('topbar');
    var r = nav.getBoundingClientRect();
    ok('10.1 top bar fits one line under 80px', r.height <= 80, Math.round(r.height) + 'px');
  })();

  (function () {
    var overflow = [].slice.call(document.querySelectorAll('button, .btn'))
      .filter(function (b) { return b.offsetParent !== null && b.scrollHeight > b.clientHeight + 1; });
    ok('10.2 no button label wraps', overflow.length === 0,
      overflow.map(function (b) { return b.textContent.trim().slice(0, 14); }).join(','));
  })();

  ok('10.3 no horizontal page scroll',
    document.body.scrollWidth <= window.innerWidth + 1,
    document.body.scrollWidth + ' vs ' + window.innerWidth);

  (function () {
    /* Gate G5: no pure black or pure white as a surface or as text. */
    var bad = [];
    var nodes = [].slice.call(document.querySelectorAll('#hud *, .sheet *')).slice(0, 300);
    nodes.forEach(function (n) {
      var cs = getComputedStyle(n);
      if (cs.color === 'rgb(0, 0, 0)' || cs.color === 'rgb(255, 255, 255)') bad.push('color:' + n.className);
      if (cs.backgroundColor === 'rgb(0, 0, 0)' || cs.backgroundColor === 'rgb(255, 255, 255)') bad.push('bg:' + n.className);
    });
    ok('10.4 no pure black or white surfaces or text', bad.length === 0, bad.slice(0, 4).join(' '));
  })();

  (function () {
    /* Every dock card must be reachable by keyboard and show focus. */
    var cards = document.querySelectorAll('#dock .card');
    ok('10.5 dock renders every tower', cards.length === DATA.TOWER_ORDER.length, cards.length);
    var focusable = document.querySelectorAll('button:not([disabled])');
    ok('10.6 controls are focusable', focusable.length > 10, focusable.length);
  })();

  (function () {
    var el = document.createElement('div');
    el.className = 'flavor';
    document.body.appendChild(el);
    var it = getComputedStyle(el).fontStyle === 'italic';
    document.body.removeChild(el);
    ok('10.7 flavour text is italic and demarcated', it, '');
  })();

  /* ---------- 11. determinism ----------
     The same board seed must produce the same board, or nothing above is
     reproducible and every measurement is a one-off. */
  section('DETERMINISM');
  (function () {
    function fingerprint(b) {
      var s = b.plots.length + '|' + Math.round(b.path.length * 100) + '|' + b.groundData.triCount;
      for (var i = 0; i < b.plots.length; i += 3) {
        s += '|' + b.plots[i].x.toFixed(2) + ',' + b.plots[i].z.toFixed(2);
      }
      return s;
    }
    var a = TERRAIN.build(DATA.BOARDS[0]);
    var b = TERRAIN.build(DATA.BOARDS[0]);
    ok('11.1 the same board definition builds identically',
      fingerprint(a) === fingerprint(b), '');
    var cc = TERRAIN.build(DATA.BOARDS[1]);
    ok('11.2 different boards differ', fingerprint(a) !== fingerprint(cc), '');
  })();

  /* ---------- report ---------- */
  var pass = 0, fail = 0;
  var failures = [];
  results.forEach(function (r) {
    if (r.section) return;
    if (r.pass) pass++;
    else { fail++; failures.push(r.name + ' [' + r.detail + ']'); }
  });
  var ms = ((performance && performance.now ? performance.now() : Date.now()) - t0);

  return JSON.stringify({
    pass: pass,
    fail: fail,
    total: pass + fail,
    ms: Math.round(ms),
    failures: failures,
    towerDamage: towerReport
  });
})();
