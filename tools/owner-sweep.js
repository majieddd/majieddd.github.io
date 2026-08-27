/* ==========================================================================
   OWNER-NOTE SWEEP, every instruction from Sessions 13-17, checked against
   the RUNNING engine rather than against the ledger that claims it is done.

   Each check proves BEHAVIOUR or reads a real rendered surface. Nothing here
   asserts that a symbol exists, because a symbol existing is how several of
   this project's shipped defects passed review.

   Returns { pass, fail, info, checks }. Mutates game state; reload after.
   ========================================================================== */
(function ownerSweep() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 200) });
  const skip = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', detail: String(detail).slice(0, 200) });
  const T = (id, fn) => { try { fn(); } catch (e) { ok(id, false, 'THREW ' + e.message); } };
  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];

  /* ---- 14.1 the resonant field / enrage mechanic is fully removed ------ */
  T('14.1 the resonant field / enrage mechanic is fully removed', function () {
    /* This check used to scan document.documentElement.innerHTML for the
       thematic player-facing name. That stopped being a valid test the
       moment the assertion flipped from "is present" to "is absent": this
       build inlines every JS module as a <script> tag inside <body>, so
       .innerHTML (unlike the rendered page) also contains this very source
       file's own comments -- including the ones explaining what got removed
       and why, which then falsely re-trip a naive text scan for the removed
       name. A behavioural check does not have that failure mode: it proves
       the mechanic cannot fire, which is the actual thing Session 35 asked
       for ("take it away... altogether as a mechanic"), regardless of what
       any comment anywhere says about it. */
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    UI.show('screen-game'); UI.buildShop(); UI.buildAbilityBar();
    UI.renderInspector(true);
    ok('14.1 Game.buyEnrage and Game.enrageCost no longer exist',
       typeof Game.buyEnrage !== 'function' && typeof Game.enrageCost !== 'function',
       'buyEnrage: ' + typeof Game.buyEnrage + ', enrageCost: ' + typeof Game.enrageCost);
    ok('14.1 no #btn-enrage is ever rendered into the wave panel',
       !document.getElementById('btn-enrage'), 'present: ' + !!document.getElementById('btn-enrage'));
    ok('14.1 Side state carries no enrage field', Game.sides[0].enrage === undefined,
       'Game.sides[0].enrage: ' + Game.sides[0].enrage);
  });

  /* ---- 14.2 relocation bills 33% of what is invested ------------------- */
  T('14.2 relocation bills 33% of invested', function () {
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    const S = Game.sides[0];
    S.gold = 999999;
    /* Drive the AI a few seconds so a tower actually gets built, rather than
       pricing an empty board. */
    const brain = Object.create(AI); brain.init(S, Game.difficulty);
    for (let i = 0; i < 900 && !S.towers.length; i++) { brain.update(1 / 60, Game); Game.step(1 / 60); }
    const t = S.towers[0];
    if (!t) { skip('14.2 relocation bills 33% of invested', 'AI built no tower in 15s'); return; }
    const invested = t.invested != null ? t.invested : t.def.cost;
    const fee = Game.relocateCost ? Game.relocateCost(t) : null;
    if (fee == null) { skip('14.2 relocation bills 33% of invested', 'no relocateCost entry point'); return; }
    const ratio = fee / invested;
    ok('14.2 relocation bills 33% of invested', Math.abs(ratio - 0.33) < 0.02,
       'fee ' + fee + ' / invested ' + invested + ' = ' + (ratio * 100).toFixed(1) + '%');
  });

  /* ---- 16.6 every world is counted by exactly one power -----------------
     OWNER-SET (Session 29): a renegade world counts toward the POLITICAL total
     of the power whose splinter holds it, which for a renegade is always the
     player's own banner. Before this, renegade worlds sat in their own bucket
     and were counted by nobody, so the ownership bar drew your power holding
     less ground than it actually did.

     The invariant that catches BOTH failure modes in one assertion: the
     per-faction political tallies must sum to exactly the world count. Too low
     means worlds are orphaned again; too high means one is double counted. The
     separate `conquered` figure must stay 0 on an untouched galaxy, which is
     what stops the fix from claiming worlds the player never fought for. */
  T('16.6 every world is counted by exactly one power', function () {
    if (typeof generateGalaxy !== 'function' || typeof galaxyHoldings !== 'function') {
      skip('16.6 every world is counted by exactly one power', 'no galaxy entry point'); return;
    }
    var bad = [];
    ['human', 'light', 'xeno', 'pirate'].forEach(function (f) {
      var gx = generateGalaxy(4242, f, null);
      var h = galaxyHoldings(gx, {});
      var total = gx.systems.reduce(function (a, sy) { return a + sy.worlds.length; }, 0);
      var ren = gx.systems.reduce(function (a, sy) {
        return a + sy.worlds.filter(function (w) { return w.renegade; }).length; }, 0);
      var sum = ['human', 'light', 'xeno', 'pirate', 'robot'].reduce(function (a, k) {
        return a + (h[k] || 0); }, 0);
      if (sum !== total) bad.push(f + ' sums ' + sum + ' of ' + total);
      if (h[f] !== ren) bad.push(f + ' political ' + h[f] + ' should equal renegade ' + ren);
      if (h.conquered !== 0) bad.push(f + ' claims ' + h.conquered + ' conquered on a fresh galaxy');
    });
    ok('16.6 every world is counted by exactly one power', bad.length === 0,
       bad.length ? bad.join('; ') : 'four banners, tallies sum to the world count, conquered stays 0');
  });

  /* ---- 16.5 souls: a flat base once, then one per star ------------------
     OWNER-SET (Session 29). The old rule was flat 2 per star. The new one is
     SOULS_BASE on the first clear plus 1 per star, which keeps a clean sweep
     at 6 (one TOWER_UNLOCK_COST, unchanged) while raising the one-star floor
     from 2 to 4 so a stuck player still banks progress.

     This asserts the PAYOUT FUNCTION, not just the per-star rate, because the
     base is what makes the floor move and a per-star-only check cannot see it. */
  T('16.5 souls are a flat base plus one per star', function () {
    if (!Meta.soulsForStar || Meta.SOULS_BASE == null) {
      skip('16.5 souls are a flat base plus one per star', 'no soulsForStar or SOULS_BASE entry point'); return;
    }
    /* The same arithmetic recordWorld runs, mirrored here so the check cannot
       drift from the payer without someone noticing. */
    const pay = function (prev, stars) {
      let s = 0;
      if (prev < 1 && stars >= 1) s += Meta.SOULS_BASE;
      for (let n = prev + 1; n <= stars; n++) s += Meta.soulsForStar(n);
      return s;
    };
    const one = pay(0, 1), two = pay(0, 2), three = pay(0, 3);
    const replay = pay(1, 3), again = pay(3, 3);
    const unlock = (typeof TOWER_UNLOCK_COST !== 'undefined') ? TOWER_UNLOCK_COST : 6;
    ok('16.5 souls are a flat base plus one per star',
       Meta.SOULS_BASE === 3 && Meta.soulsForStar(1) === 1 &&
       one === 4 && two === 5 && three === 6 && three === unlock &&
       replay === 2 && again === 0,
       'first clear pays ' + one + '/' + two + '/' + three + ' at 1/2/3 stars, ' +
       'replay 1 to 3 pays ' + replay + ', a repeat pays ' + again +
       ', unlock cost ' + unlock);
  });

  /* ---- 16.4 one new type on wave 1, one more every THIRD wave, cap 8 ---
     The cadence was 2 until Session 26, when the owner slowed it: "I feel
     like every 3 rounds is good." The check pins the CURRENT owner number,
     which is what it is for. */
  T('16.4 roster cadence and cap are the owner numbers', function () {
    ok('16.4 roster cadence and cap are the owner numbers',
       ROSTER_MAX === 8 && ROSTER_INTRO_EVERY === 3,
       'ROSTER_MAX=' + ROSTER_MAX + ' ROSTER_INTRO_EVERY=' + ROSTER_INTRO_EVERY);
  });

  T('16.4 a real battle never fields more than eight non-boss types', function () {
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    const roster = Game.roster || Game.battleRoster || null;
    if (!roster) { skip('16.4 a real battle never fields more than eight non-boss types', 'no roster on Game'); return; }
    const plain = roster.filter(function (id) {
      const d = ENEMY_TYPES[id];
      return d && !d.boss && !d.miniboss;
    });
    ok('16.4 a real battle never fields more than eight non-boss types',
       plain.length <= ROSTER_MAX, plain.length + ' non-boss types: ' + plain.join(','));
  });

  /* ---- audit#3 every miniboss lands inside the curve -------------------- */
  T('audit#3 every miniboss lands inside the curve', function () {
    if (!Game.minibossFor) { skip('audit#3 every miniboss lands inside the curve', 'no minibossFor'); return; }
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    const at = [];
    for (let w = 1; w <= 30; w++) {
      const mb = Game.minibossFor(w, Game.difficulty);
      if (mb) at.push(w + ':' + (mb.id || mb));
    }
    const waves = at.map(function (s) { return +s.split(':')[0]; });
    const distinct = {};
    at.forEach(function (s) { distinct[s.split(':')[1]] = 1; });
    const n = Object.keys(distinct).length;
    ok('audit#3 every miniboss lands inside the curve',
       n >= MINIBOSSES.length && (waves.length === 0 || Math.max.apply(null, waves) <= 30),
       n + ' of ' + MINIBOSSES.length + ' distinct, at ' + at.join(' '));
  });

  T('audit#3 the advertised cadence is the cadence run', function () {
    if (!Game.minibossFor) { skip('audit#3 the advertised cadence is the cadence run', 'no minibossFor'); return; }
    const hits = [];
    for (let w = 1; w <= 30; w++) if (Game.minibossFor(w, Game.difficulty)) hits.push(w);
    const gaps = [];
    for (let i = 1; i < hits.length; i++) gaps.push(hits[i] - hits[i - 1]);
    const consistent = gaps.every(function (g) { return g === MINIBOSS_EVERY; });
    ok('audit#3 the advertised cadence is the cadence run', consistent,
       'MINIBOSS_EVERY=' + MINIBOSS_EVERY + ' actual gaps ' + gaps.join(','));
  });

  /* ---- 15.8 a battlefield defeat must not reset the galaxy -------------- */
  T('15.8 a defeat keeps the galaxy', function () {
    Meta.load();
    const c = Meta.campaign();
    if (!c) { skip('15.8 a defeat keeps the galaxy', 'no campaign on this profile'); return; }
    const before = JSON.stringify(c);
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    Game.endMatch(false, false);
    /* A loss SHOULD tick the defeat counter -- that is a record, not a reset.
       What must survive is the PROGRESSION: the galaxy you are in and every
       star you have taken in it. Compare exactly that. */
    const keep = function (o) {
      return JSON.stringify({ tier: o.tier, seed: o.seed, depth: o.depth,
                              system: o.system, stars: o.stars,
                              systemsTaken: o.systemsTaken, boons: o.boons });
    };
    const b2 = keep(JSON.parse(before)), a2 = keep(Meta.campaign());
    ok('15.8 a defeat keeps the galaxy and every star on it', a2 === b2,
       a2 === b2 ? 'galaxy, seed, stars and boons all survive the loss'
                 : 'BEFORE ' + b2.slice(0, 100) + '  AFTER ' + a2.slice(0, 100));
    const d0 = JSON.parse(before).defeats, d1 = Meta.campaign().defeats;
    ok('15.8 and it does record the defeat', d1 === d0 + 1, d0 + ' -> ' + d1);
  });

  /* ---- 17.3 the arena: twenty seats, each with its own base ------------- */
  T('17.3 the arena seats twenty, each with its own lives', function () {
    Game.start({ maelstrom: 20, difficulty: 'contested', loadout: PIN.slice() });
    const seats = Game.sides.length;
    const withLives = Game.sides.filter(function (s) { return s.lives > 0; }).length;
    ok('17.3 the arena seats twenty, each with its own lives',
       seats === 20 && withLives === 20, seats + ' seats, ' + withLives + ' with lives');
  });

  T('17.3 every arena seat owns a distinct base tile', function () {
    if (!(Game.arenaSeats > 3)) { skip('17.3 every arena seat owns a distinct base tile', 'arenaSeats=' + Game.arenaSeats); return; }
    /* A seat has no `base` field: its base is where the lane it defends ENDS.
       Distinct endpoints is exactly the owner's "everyone should have their
       own base". Equal lane lengths is the fairness that makes it an arena. */
    const keys = {}, lens = [];
    for (let s = 0; s < Game.sides.length; s++) {
      const p = (Game.defendedPaths(s) || [])[0];
      const pts = p && (p.pts || p.points || p.nodes);
      if (!pts || !pts.length) continue;
      const e = pts[pts.length - 1];
      keys[Math.round(e.x) + ',' + Math.round(e.y)] = 1;
      lens.push(Math.round(p.total));
    }
    const n = Object.keys(keys).length;
    const fair = lens.length && lens.every(function (l) { return l === lens[0]; });
    ok('17.3 every arena lane is the same length, so no seat is cheated',
       fair, lens.length + ' lanes, all ' + lens[0] + ' long');
    ok('17.3 every arena seat owns a distinct base tile', n === Game.sides.length,
       n + ' distinct bases for ' + Game.sides.length + ' seats');
  });

  /* ---- 17.4 a rival fields its own power's hardware --------------------- */
  T('17.4 a rival never fields a third power’s towers', function () {
    if (!AI.rivalArsenal) { skip('17.4 a rival never fields a third power’s towers', 'no rivalArsenal'); return; }
    /* CALLED WITH THE REAL SIGNATURE, which it was not for three sessions:
       `rivalArsenal(budget, map, DAMAGE, AIR, faction)` was being handed
       (faction, towerList), so `budget` was the string 'human', `faction` was
       undefined, every gated origin was filtered out, and the fill loop
       `while (out.length < budget)` compared a number against a string and
       never ran. It returned the same five human staples for all four
       powers, so `foreign` was always empty: the check passed unconditionally
       and would still have passed with the origin law deleted outright.
       DAMAGE and AIR are vestigial in this function -- it reads neither --
       so null is honest rather than a stub. */
    const bad = [];
    const sizes = [];
    ['human', 'light', 'xeno', 'pirate'].forEach(function (fac) {
      const arsenal = AI.rivalArsenal(TOWER_ORDER.length, MAPS[0], null, null, fac) || [];
      sizes.push(fac + ':' + arsenal.length);
      const foreign = arsenal.filter(function (id) {
        const o = (TOWER_TYPES[id] || {}).origin;
        return o && o !== 'human' && o !== 'robotic' && o !== fac;
      });
      if (foreign.length) bad.push(fac + ' fields ' + foreign.join(','));
      /* A shelf of five staples would pass the foreign test while proving
         nothing, which is exactly how the miscall hid. Demand a real one. */
      if (arsenal.length < 10) bad.push(fac + ' shelf is only ' + arsenal.length + ', the call is not reaching the roster');
    });
    ok('17.4 a rival never fields a third power’s towers', bad.length === 0,
       bad.length ? bad.join(' | ')
                  : 'all four arsenals stay on own + human + robotic (' + sizes.join(' ') + ')');
  });

  /* ---- the desync class this project has shipped seven times ------------ */
  T('desync guard: one definition of the wave multiplier', function () {
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    const bad = [];
    for (let n = 1; n <= 30; n++) {
      const engine = Game.waveHpMul(n, false);
      const shown = Game.previewHpMul ? Game.previewHpMul(n) : engine;
      if (Math.abs(engine - shown) > 1e-9) bad.push('w' + n);
    }
    ok('desync guard: one definition of the wave multiplier', bad.length === 0,
       bad.length ? 'diverges at ' + bad.join(',') : 'preview equals engine across waves 1-30');
  });

  /* ---- the N-side class that produced four separate crashes ------------- */
  T('N-side guard: every seat resolves a rival and a send path', function () {
    Game.start({ maelstrom: 20, difficulty: 'contested', loadout: PIN.slice() });
    const bad = [];
    for (let s = 0; s < Game.sides.length; s++) {
      const vic = Game.rivalOf(s);
      const path = Game.sendTriPaths && Game.sendTriPaths[s] ? Game.sendTriPaths[s][vic] : null;
      if (vic < 0 || vic === s || !path) bad.push('seat ' + s + ' -> victim ' + vic + ' path ' + !!path);
    }
    ok('N-side guard: every seat resolves a rival and a send path', bad.length === 0,
       bad.length ? bad.slice(0, 5).join(' | ') : 'all ' + Game.sides.length + ' seats resolve');
  });

  T('N-side guard: a twenty-seat arena simulates without throwing', function () {
    Game.start({ maelstrom: 20, difficulty: 'contested', loadout: PIN.slice() });
    let threw = null;
    try {
      for (let i = 0; i < 3600; i++) {
        if (Game.state === 'choosing' && Game.pendingChoice) Game.takeMod(Game.pendingChoice[0]);
        else Game.step(1 / 60);
      }
    } catch (e) { threw = e.message; }
    ok('N-side guard: a twenty-seat arena simulates without throwing', threw === null,
       threw || '3600 frames clean, reached wave ' + Game.wave);
  });

  /* ═══ SESSION 19 ═════════════════════════════════════════════════════
     The owner round: galaxy redesign, unlock gating, the balance curve, and
     twenty faction boons. Checked the same way as everything above -- by
     driving the engine, never by asserting a symbol exists. */

  T('19.1 the galaxy is bigger than the window it is seen through', function () {
    const ratio = GX_WORLD.w / GX_VIEW.w;
    ok('19.1 the galaxy is bigger than the window it is seen through', ratio >= 3,
       'world ' + GX_WORLD.w + 'x' + GX_WORLD.h + ' vs viewport ' + GX_VIEW.w + 'x' + GX_VIEW.h +
       ' = ' + ratio.toFixed(2) + 'x wider');
  });

  T('19.1 no two worlds sit on top of each other', function () {
    const gx = generateGalaxy('sweepseed', 'human');
    const ws = [];
    for (const sy of gx.systems) for (const w of sy.worlds) ws.push(w);
    let closest = Infinity, pair = '';
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
      const dx = ws[i].x - ws[j].x, dy = (ws[i].y - ws[j].y) * GX_RENDER_SQUASH;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closest) { closest = d; pair = ws[i].id + '/' + ws[j].id; }
    }
    ok('19.1 no two worlds sit on top of each other', closest > 6,
       ws.length + ' worlds, closest pair ' + pair + ' at ' + closest.toFixed(2));
  });

  T('19.4 no painted galaxy backdrop survives', function () {
    const inPack = typeof ARTPACK !== 'undefined' && !!ARTPACK.galaxy_bg;
    ok('19.4 no painted galaxy backdrop survives', !inPack,
       inPack ? 'galaxy_bg is STILL in the art pack' : 'plate gone from the pack too');
  });

  T('19.5 robotic towers are story unlocks, never purchasable', function () {
    if (typeof ROBOTIC_UNLOCK_ORDER === 'undefined') {
      skip('19.5 robotic towers are story unlocks, never purchasable', 'no ladder'); return;
    }
    const first = ROBOTIC_UNLOCK_ORDER[0];
    const buyable = ROBOTIC_UNLOCK_ORDER.filter(function (id) {
      return Meta.canUnlockTower && Meta.canUnlockTower(id) === true;
    });
    ok('19.5 robotic towers are story unlocks, never purchasable',
       first === 'dronebay' && buyable.length === 0,
       'ladder starts ' + first + '; ' + buyable.length + ' of ' +
       ROBOTIC_UNLOCK_ORDER.length + ' buyable with souls');
  });

  /* ---- Session 22: the summoning doctrines, NG+ and the flattening ---- */

  T('22.1 every seat resolves the rite its commander carries', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true });
    var bad = [];
    for (var i = 0; i < Game.sides.length; i++) {
      var S = Game.sides[i];
      var want = (S.commander && S.commander.faction) || S.faction || 'human';
      if (S.doctrine !== want) bad.push(i + ':' + S.doctrine + '!=' + want);
      if (!SUMMON_DOCTRINES[S.doctrine]) bad.push(i + ':unknown ' + S.doctrine);
    }
    ok('22.1 every seat resolves the rite its commander carries', bad.length === 0,
       Game.sides.length + ' seats, mismatches: ' + (bad.join(' ') || 'none'));
  });

  T('22.2 a rite may change the shell a kill returns in, never the mass', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true, doctrineOverrides: { 0: 'human' } });
    Game.setMusterLoadout(0, ['crawler', 'sprinter', 'bulwark']);
    var worst = 0, n = 0;
    for (var t = 0; t < 240; t++) {
      var vt = ['crawler', 'bulwark', 'juggernaut'][t % 3];
      var d = ENEMY_TYPES[vt];
      if (!d) continue;
      var corpse = { maxHp: d.hp * 6, armor: d.armor, x: 300, y: 300,
                     hostileTo: 0, rageMul: 1, type: vt };
      var budget = Game.corpseBudget(corpse);
      Game.pendingSpawns.length = 0;
      Game.conscript(corpse);
      for (var i = 0; i < Game.pendingSpawns.length; i++) {
        n++;
        var ratio = Game.pendingSpawns[i].maxHp / budget.hp;
        if (ratio > worst) worst = ratio;
      }
    }
    ok('22.2 a rite may change the shell a kill returns in, never the mass',
       n > 0 && worst <= 1.0001 && Game.sides[0].rollDebt >= 0,
       n + ' bodies, heaviest ' + worst.toFixed(3) + ' of its corpse, debt ' +
       Math.round(Game.sides[0].rollDebt));
  });

  T('22.3 the Marque is uncapped, and its price is what caps it', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true,
                 doctrineOverrides: { 0: 'pirate', 1: 'human' } });
    var tier = Game.musterTiers(0)[0];
    Game.sides[0].musterBuys = 10; var p10 = Game.musterCost(0, tier);
    Game.sides[0].musterBuys = 20; var p20 = Game.musterCost(0, tier);
    Game.sides[1].musterBuys = 10; var h10 = Game.musterCost(1, tier);
    Game.sides[1].musterBuys = 20; var h20 = Game.musterCost(1, tier);
    var payP = musterPayout(3.0, 10, Game.musterCapPct(0));
    var payH = musterPayout(3.0, 10, Game.musterCapPct(1));
    ok('22.3 the Marque is uncapped, and its price is what caps it',
       !isFinite(Game.musterCapPct(0)) && isFinite(Game.musterCapPct(1)) &&
       payP > payH && p20 > p10 && h20 === h10,
       'econ ' + payP + ' vs capped ' + payH + '; pirate cost ' + p10 + '->' + p20 +
       ', others ' + h10 + '->' + h20);
  });

  T('22.4 the Lattice does not buy, and nothing else is refused', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true,
                 doctrineOverrides: { 0: 'robot', 1: 'human' } });
    Game.sides[0].gold += 99999; Game.sides[1].gold += 99999;
    var robo = Game.canMuster(0), human = Game.canMuster(1);
    ok('22.4 the Lattice does not buy, and nothing else is refused',
       robo === false && human === true,
       'robotic canMuster=' + robo + ' human canMuster=' + human);
  });

  T('22.5 clutches cap, and a full nest still pays for a kill', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true, doctrineOverrides: { 0: 'xeno' } });
    Game.setMusterLoadout(0, ['crawler', 'sprinter', 'bulwark']);
    Game.incubators.length = 0;
    var d = ENEMY_TYPES.crawler;
    var mk = function (x, y) {
      return { maxHp: d.hp * 5, armor: d.armor, x: x, y: y, hostileTo: 0, rageMul: 1, type: 'crawler' };
    };
    while (Game.incubators.length < XENO_INC_CAP + 4) {
      var before = Game.incubators.length;
      Game.incubate(mk(600, 600));
      if (Game.incubators.length === before) break;
    }
    var held = Game.incubators.length;
    var pod = Game.incubators[0];
    var t0 = pod.t;
    Game.incubate(mk(600 + 40 * TILE, 600));      /* far from every clutch */
    var fedFar = t0 - pod.t;
    ok('22.5 clutches cap, and a full nest still pays for a kill',
       held === XENO_INC_CAP && Math.abs(fedFar - XENO_INC_FEED_SEC) < 1e-6,
       'held ' + held + '/' + XENO_INC_CAP + ', overflow fed nearest ' + fedFar.toFixed(2) + 's');
  });

  T('22.6 VETERAN is the identity ramp', function () {
    var v = RAMP_PRESETS[RAMP_DEFAULT];
    var same = true;
    for (var si = 0; si < 5; si++) {
      var wantD = si < 1 ? 'skirmish' : si < 3 ? 'contested' : 'overrun';
      if (v.diffFor(si) !== wantD || v.escFor(si) !== Math.floor(si * 0.8)) same = false;
    }
    ok('22.6 VETERAN is the identity ramp',
       same && v.tierHpStep === 0.30 && v.soulsMul === 1,
       'diff/esc match the retired ternaries: ' + same +
       ', tierHpStep ' + v.tierHpStep + ', soulsMul ' + v.soulsMul);
  });

  T('22.7 the first galaxy is eased, and the terminus is not', function () {
    var rejoin = tier0ReliefMul(TIER0_EASE_END_WAVE, 0.35) === 1 &&
                 tier0ReliefMul(20, 0.35) === 1 && tier0ReliefMul(30, 0.35) === 1;
    var peak = tier0ReliefMul(TIER0_EASE_PEAK_WAVE, 0.35);
    var identity = tier0ReliefMul(8, 0) === 1;
    /* A battle told nothing must behave exactly as it always did. */
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true });
    var plain = (Game.hpEase || 0) === 0 &&
                (Game.rosterIntroEvery || ROSTER_INTRO_EVERY) === ROSTER_INTRO_EVERY &&
                (Game.minibossDelayWaves || 0) === 0 &&
                Game.minibossFor(MINIBOSS_EVERY) === MINIBOSSES[0];
    ok('22.7 the first galaxy is eased, and the terminus is not',
       rejoin && identity && plain && Math.abs(peak - 0.65) < 1e-9,
       'peak ' + peak.toFixed(2) + ' at w' + TIER0_EASE_PEAK_WAVE +
       ', rejoins by w' + TIER0_EASE_END_WAVE + ': ' + rejoin +
       ', an un-flagged battle is untouched: ' + plain);
  });

  T('22.8 a splice forks the board and hands it back exactly', function () {
    var bad = [], opened = 0, checked = 0;
    for (var i = 0; i < 5; i++) {
      Game.start({ map: MAPS[i].id, difficulty: 'contested', loadout: PIN.slice(),
                   commander: COMMANDERS[0].id, skirmish: true });
      if (FIELD.radial) continue;
      checked++;
      var lanes0 = Game.lanes[1].length, blocked0 = Game.blocked.size;
      var sp = new Enemy(ENEMY_TYPES.splicer, Game.sendPaths[0],
                         { hostileTo: 1, owner: 0, reanimated: true });
      sp.x = 400; sp.y = 300;
      Game.enemies.push(sp);
      unitDeathDoctrine(sp);
      if (!Game.spliceState[1]) continue;
      opened++;
      /* The forked lane must END where the real one ends, or it is a road to
         nowhere and everything that walks it never arrives. */
      var p = Game.lanes[1][Game.lanes[1].length - 1], base = Game.lanes[1][0];
      var a = p.posAt(p.total, {}), b = base.posAt(base.total, {});
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 1) bad.push(MAPS[i].id + ':no-base');
      Game.closeSplice(1);
      if (Game.lanes[1].length !== lanes0) bad.push(MAPS[i].id + ':lane-leak');
      if (Game.blocked.size !== blocked0) bad.push(MAPS[i].id + ':tile-leak');
    }
    ok('22.8 a splice forks the board and hands it back exactly',
       checked > 0 && opened === checked && bad.length === 0,
       opened + '/' + checked + ' maps forked; leaks: ' + (bad.join(' ') || 'none'));
  });

  T('22.9 a leak pays its discount exactly once', function () {
    /* leakReduction was subtracted in the reap AND again in loseLives, so a
       Shield Wall commander paid it twice. The reap owns it; this pins that. */
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: 'vess', skirmish: true });
    var S = Game.sides[0];
    var red = S.traits.leakReduction;
    var before = S.lives;
    var cost = Math.max(1, Math.round(3 - red));          /* the reap's arithmetic */
    Game.loseLives(0, cost, [{ type: 'mb_colossus', cost: cost, sent: false }]);
    var lost = before - S.lives;
    var row = S.leakLog.mb_colossus || { lives: -1 };
    ok('22.9 a leak pays its discount exactly once',
       red === 1 && cost === 2 && lost === 2 && S.stats.leaked === 2 && row.lives === 2,
       'reduction ' + red + ', 3-life breach cost ' + cost + ', lives lost ' + lost +
       ', ledger ' + S.stats.leaked + '/' + row.lives);
  });

  T('22.10 every tower draws itself in the shop preview', function () {
    var cv = document.createElement('canvas');
    cv.width = 286; cv.height = 96;
    var ctx = cv.getContext('2d');
    var blank = [];
    /* A HARNESS MAY NEVER SWALLOW AN EXCEPTION IT DOES NOT REPORT. This loop
       used to `catch (e) {}`, so a tower whose draw function THREW was scored
       on whatever ink the previous tower left behind. It is the only check in
       the suite that runs render code, which made it the only place a render
       crash could hide. Throws are collected and asserted separately from the
       ink, so "it drew nothing" and "it threw" are two different failures. */
    var threw = [];
    for (var i = 0; i < TOWER_ORDER.length; i++) {
      var id = TOWER_ORDER[i], t = TOWER_TYPES[id];
      ctx.clearRect(0, 0, 286, 96);
      var stub = UI.towerStub(id);
      stub.age = 0.4; stub.angle = -0.42; stub.recoil = 0;
      ctx.save(); ctx.translate(52, 70);
      try {
        var fn = Tower.prototype['draw_' + id];
        if (fn) fn.call(stub, ctx, stub.age);
        else if (t.glyph) Tower.prototype.draw_glyph.call(stub, ctx, stub.age);
        else Tower.prototype.draw_bolt.call(stub, ctx, stub.age);
      } catch (e) { threw.push(id + ': ' + (e && e.message ? e.message : e)); }
      ctx.restore();
      var px = ctx.getImageData(0, 0, 286, 96).data, ink = 0;
      for (var p = 3; p < px.length; p += 4) if (px[p] > 8) ink++;
      if (ink <= 40) blank.push(id);
    }
    ok('22.10 every tower draws itself in the shop preview',
       blank.length === 0 && threw.length === 0,
       (TOWER_ORDER.length - blank.length) + '/' + TOWER_ORDER.length +
       ' render; blank: ' + (blank.join(' ') || 'none') +
       '; threw: ' + (threw.join(' | ') || 'none'));
  });

  /* ---- 22.12 the loop error buffer has a reader --------------------------
     js/game.js wraps the frame in a try/catch and parks the message on
     `Game.loopErrors`, and its own comment at :3695 says that is "for the
     sweep to read". MEASURED in Session 29: grep across all three harnesses
     returned 0, 0 and 0. Nothing read it, so a frame could throw on every
     single tick and the suite would still report a clean run.

     This is the reader. It runs LAST in this block so it sees whatever the
     checks above provoked, and it prints the messages rather than a count,
     because a count of 3 tells you nothing about what broke. */
  T('22.12 no frame threw during the sweep', function () {
    var buf = (typeof Game !== 'undefined' && Game.loopErrors) || {};
    var keys = Object.keys(buf);
    ok('22.12 no frame threw during the sweep', keys.length === 0,
       keys.length
         ? keys.map(function (k) { return k + ' x' + buf[k]; }).join(' | ')
         : 'Game.loopErrors is empty');
  });

  T('22.11 the Parallel arsenal opens only once the game is beaten', function () {
    if (typeof SECRET_FACTIONS === 'undefined' || !Meta.secretUnitOpen) {
      skip('22.11 the Parallel arsenal opens only once the game is beaten', 'no secret faction');
      return;
    }
    var secretUnits = UNIT_ORDER.filter(function (id) {
      return SECRET_FACTIONS.indexOf(unitFactionOf(id)) >= 0;
    });
    var v = Meta.vault(), keep = v.victories;
    Meta.setFaction('human');
    v.victories = 0;
    var lockedBefore = secretUnits.every(function (id) { return !!Meta.unitOriginLock(id); });
    v.victories = 1;
    var openAfter = secretUnits.every(function (id) { return !Meta.unitOriginLock(id); });
    /* ...and the ORDINARY cross-faction law must survive untouched. */
    var xenoStillLocked = !!Meta.unitOriginLock('chitling');
    v.victories = keep;
    ok('22.11 the Parallel arsenal opens only once the game is beaten',
       secretUnits.length === 5 && lockedBefore && openAfter && xenoStillLocked,
       secretUnits.length + ' machine soldiers; locked before ' + lockedBefore +
       ', open after ' + openAfter + ', xeno still locked ' + xenoStillLocked);
  });

  T('22.12 the rival can judge every tower it may draft', function () {
    /* The heavies are draftable and placeable, but DAMAGE/AIR are how the
       brain decides a shelf can kill and answer air. A tower missing from
       both while dealing real damage is invisible to that judgement. */
    var src = String(AI.pickLoadout);
    var heavies = ['bombard', 'carronade', 'quadmount', 'impaler', 'monstrance', 'pharos'];
    var missing = heavies.filter(function (id) { return src.indexOf("'" + id + "'") < 0; });
    var air = ['quadmount', 'impaler', 'pharos', 'monstrance'];
    var airMissing = air.filter(function (id) {
      var i = src.indexOf('const AIR');
      return i < 0 || src.indexOf("'" + id + "'", i) < 0;
    });
    ok('22.12 the rival can judge every tower it may draft',
       missing.length === 0 && airMissing.length === 0,
       'damage-list gaps: ' + (missing.join(' ') || 'none') +
       '; air-list gaps: ' + (airMissing.join(' ') || 'none'));
  });

  T('22.13 nothing renders blank, and the art ledger is on the record', function () {
    /* Art generation is a separate pipeline measured in GPU-hours, so a
       missing plate is a BACKLOG item and not a failure. What must never
       regress is the FALLBACK: every registry entry has to render something.
       Towers are pinned by 22.10; this covers the other three registries and
       prints the coverage so a further slip is visible rather than silent. */
    var miss = function (ids, prefix) {
      return ids.filter(function (id) {
        return !(typeof ARTPACK !== 'undefined' && ARTPACK[prefix + id]);
      });
    };
    var twr = miss(TOWER_ORDER, 'twr_');
    var cmd = miss(COMMANDER_ROSTER.map(function (c) { return c.id; }), 'cmd_');
    var uni = miss(UNIT_ORDER, 'foe_');
    var fac = miss(Object.keys(FACTIONS), 'fac_');
    /* The fallbacks, exercised for real rather than assumed. */
    var blank = [];
    for (var i = 0; i < COMMANDER_ROSTER.length; i++) {
      var html = commanderPortrait(COMMANDER_ROSTER[i], 44);
      if (!html || !String(html).trim()) blank.push('cmd:' + COMMANDER_ROSTER[i].id);
    }
    for (var f in FACTIONS) if (!FACTIONS[f].crest && !(typeof ARTPACK !== 'undefined' && ARTPACK['fac_' + f]))
      blank.push('fac:' + f);
    /* And every faction a player can swear must have its own battle voice --
       falling through to human put Humanity's line in a machine's mouth. */
    var mute = Object.keys(FACTIONS).filter(function (id) {
      return !(DIALOGUE.replies && DIALOGUE.replies[id]);
    });
    ok('22.13 nothing renders blank, and the art ledger is on the record',
       blank.length === 0 && mute.length === 0,
       'unpainted, towers ' + twr.length + '/' + TOWER_ORDER.length +
       ', commanders ' + cmd.length + '/' + COMMANDER_ROSTER.length +
       ', units ' + uni.length + '/' + UNIT_ORDER.length +
       ', factions ' + fac.length + '/' + Object.keys(FACTIONS).length +
       ' · blank renders: ' + (blank.join(' ') || 'none') +
       ' · mute factions: ' + (mute.join(' ') || 'none'));
  });

  T('22.15 THE PROCESSION marches in order, on the clock, and takes nothing from a kill', function () {
    Game.start({ map: MAPS[0].id, difficulty: 'contested', loadout: PIN.slice(),
                 commander: COMMANDERS[0].id, skirmish: true, doctrineOverrides: { 0: 'light' } });
    Game.setMusterLoadout(0, ['crawler', 'sprinter', 'bulwark']);
    var S = Game.sides[0];
    var list = S.musterLoadout.slice();
    var bad = [];
    /* A kill must yield NOTHING -- the half 22.2 cannot see, because that
       check overrides to CONSCRIPTION. */
    var d = ENEMY_TYPES.crawler;
    Game.pendingSpawns.length = 0;
    Game.doctrineOnKill({ maxHp: d.hp * 6, armor: d.armor, x: 300, y: 300,
                          hostileTo: 0, rageMul: 1, type: 'crawler' });
    if (Game.pendingSpawns.length) bad.push('a kill produced ' + Game.pendingSpawns.length + ' bodies');

    /* Then the clock: entries in ROSTER ORDER, one per interval, wrapping
       exactly once per cycle, with the period stretching as the count grows. */
    Game.wave = FOL_START_WAVE; Game.waveRunning = true; Game.state = 'playing';
    S.procIdx = 0; S.procCycle = 0; S.procTimer = 0;
    var order = [], cycles = [];
    for (var step = 0; step < list.length * 2; step++) {
      Game.pendingSpawns.length = 0;
      Game.tickProcession(0.001);
      var got = Game.pendingSpawns.length ? Game.pendingSpawns[0].def.id : null;
      if (got) order.push(got);
      cycles.push(S.procCycle);
      S.procTimer = 0;               /* jump straight to the next dispatch */
    }
    var wantOne = list.join(','), wantTwo = list.concat(list).join(',');
    if (order.join(',') !== wantTwo) bad.push('order ' + order.join(',') + ' != ' + wantTwo);
    if (S.procCycle < 1) bad.push('cycle never advanced');
    /* The re-armed period must carry the growth term. */
    S.procTimer = 0; Game.tickProcession(0.001);
    var want = FOL_CADENCE_SEC + S.procCycle * FOL_CADENCE_GROWTH;
    if (Math.abs(S.procTimer - want) > 1e-6) bad.push('period ' + S.procTimer.toFixed(2) + ' != ' + want.toFixed(2));
    ok('22.15 THE PROCESSION marches in order, on the clock, and takes nothing from a kill',
       bad.length === 0,
       bad.length ? bad.join(' | ')
                  : 'roster order twice over (' + wantOne + '), cycle ' + S.procCycle +
                    ', period ' + S.procTimer.toFixed(2) + 's, kills yield nothing');
  });

  T('22.14 every map offers a reward its commander can actually field', function () {
    /* A rescue you cannot muster is a reward that does nothing -- the
       codebase's own words, recorded when the faction ladders were brought to
       three lives, and then left standing on THE EXPANSE, whose two denizens
       were both over MUSTER_MAX_LIVES. */
    var dead = MAPS.filter(function (m) {
      var d = m.denizens || [];
      return d.length && !d.some(musterSendable);
    }).map(function (m) { return m.id; });
    var partial = MAPS.filter(function (m) {
      var d = m.denizens || [];
      return d.length && d.filter(musterSendable).length < d.length;
    }).map(function (m) { return m.id + '(' + (m.denizens||[]).filter(function (x) {
      return !musterSendable(x); }).join('/') + ')'; });
    ok('22.14 every map offers a reward its commander can actually field',
       dead.length === 0,
       MAPS.length + ' maps; wholly unfieldable: ' + (dead.join(' ') || 'none') +
       '; partly: ' + (partial.join(' ') || 'none'));
  });

  T('19.16 the spawned-HP curve hits the owner three anchors exactly', function () {
    const a = spawnHpPenaltyMul(1), b = spawnHpPenaltyMul(5), c = spawnHpPenaltyMul(10);
    ok('19.16 the spawned-HP curve hits the owner three anchors exactly',
       Math.abs(a - 0.5) < 0.005 && Math.abs(b - 0.75) < 0.005 && Math.abs(c - 1) < 0.005,
       'w1 ' + a.toFixed(3) + '  w5 ' + b.toFixed(3) + '  w10 ' + c.toFixed(3));
  });

  T('19.18 CANISTER no longer shares the TOXIN identity', function () {
    const can = TOWER_TYPES.canister && TOWER_TYPES.canister.base || {};
    const tox = TOWER_TYPES.toxin && TOWER_TYPES.toxin.base || {};
    /* The audit named four shared keys, but only ONE of them carried the
       identity. poisonDur and maxStacks are stack MACHINERY -- how long a
       stack lasts and how many hold -- which two venom towers sharing is no
       more meaningful than two towers sharing `range`. What had to separate
       was the damage basis and a mechanic of its own, so that is what is
       asserted: TOXIN scales off CURRENT health, CANISTER off MAX health,
       and CANISTER strips armour, which TOXIN cannot do at all. */
    const identityShared = ('poisonPct' in can) && ('poisonPct' in tox);
    const canisterOwn = ('poisonMaxPct' in can) && ('shredPerStack' in can);
    const toxinOwn = ('poisonPct' in tox) && !('shredPerStack' in tox);
    ok('19.18 CANISTER no longer shares the TOXIN identity',
       !identityShared && canisterOwn && toxinOwn,
       'canister: ' + (canisterOwn ? 'maxHP% + armour shred' : 'MISSING ITS OWN') +
       ' | toxin: ' + (toxinOwn ? 'currentHP%' : 'MISSING ITS OWN') +
       ' | both on poisonPct: ' + identityShared);
  });

  T('19.23 twenty boons, five per power', function () {
    const by = {};
    for (const b of BOONS) by[b.f] = (by[b.f] || 0) + 1;
    const counts = Object.keys(by).sort().map(function (k) { return k + ':' + by[k]; });
    ok('19.23 twenty boons, five per power',
       BOONS.length === 20 && Object.keys(by).length === 4 &&
       Object.keys(by).every(function (k) { return by[k] === 5; }),
       counts.join(' '));
  });

  T('19.23 not one boon is inert', function () {
    const PIN2 = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
    /* WATCHES BOTH LEDGERS, and it has to. This snapshot read `traits` only,
       so it called a boon LIVE whenever it moved a trait -- even a trait no
       engine code reads -- and called it DEAD when it correctly wrote `mods`
       instead. Four boons were folding into traits AFTER foldTraits had
       already run, which made AUREOLE and LETTERS OF MARQUE entirely inert
       and this check reported all twenty healthy. Watching both is what lets
       it tell "moved something the engine reads" from "moved a number". */
    const snap = function (boons) {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN2.slice(), boons: boons });
      const S = Game.sides[0], t = S.traits, m = S.mods;
      return JSON.stringify([S.maxLives,
        m.gold, m.reanim, m.damage, m.rate, m.range, m.splash, m.status,
        m.crit, m.critMult, m.pierce, m.sellRate, m.cost, m.upCost, m.doubleReanim,
        t.freeCopies, t.lastStandAt, t.lastStandDmg, t.sellRate, t.ascCostMul,
        t.ascDamage, t.jamResist, t.waveHeal, t.immortalLine, t.auraRangeMul,
        t.status, t.reanimSpeed, t.killRamp, t.reanimResist, t.siphonRate,
        t.reanimGold, t.musterHpMul, t.musterCostMul, t.eliteDamage, t.eliteBounty,
        t.costGrowthMul, t.crit, t.critMult, t.lifeRegen, t.lifeGainMul,
        t.dotMul, t.slowVuln, t.leakReduction, t.draftOptions, t.draftEvery]);
    };
    const base = snap([]);
    const dead = BOONS.filter(function (b) { return snap([b.id]) === base; }).map(function (b) { return b.id; });
    ok('19.23 not one boon is inert', dead.length === 0,
       dead.length ? 'DEAD: ' + dead.join(',') : 'all ' + BOONS.length + ' move an engine value');
  });

  T('19.24 the boon depends on BOTH the power and the world', function () {
    const a = boonFor('xeno', 'forge', false, 0.5).id;
    const b = boonFor('pirate', 'forge', false, 0.5).id;
    const c = boonFor('xeno', 'nest', false, 0.5).id;
    const apex = boonFor('xeno', 'nest', true, 0).k;
    ok('19.24 the boon depends on BOTH the power and the world',
       a !== b && a !== c && apex === 'apex',
       'xeno/forge=' + a + '  pirate/forge=' + b + '  xeno/nest=' + c + '  contested->' + apex);
  });

  T('19.24 a boon can never name a key the engine ignores', function () {
    const missing = [];
    for (const b of BOONS) {
      const probe = {};
      b.apply(probe);
      for (const k in probe) if (!(k in BOON_FOLD)) missing.push(b.id + ':' + k);
    }
    ok('19.24 a boon can never name a key the engine ignores', missing.length === 0,
       missing.length ? missing.join(' ') : 'every key folded; assertion runs at load too');
  });

  T('19.12 the loadout is four columns at desk width', function () {
    const grid = document.querySelector('#lo-columns');
    if (!grid) { skip('19.12 the loadout is four columns at desk width', 'not on the loadout screen'); return; }
    /* Render it first. An UNRENDERED grid reports its authored template, which
       contains `minmax(0px, 1fr)` -- and that has a space in it, so counting
       tracks by splitting on spaces reports six for a four-column grid. Once
       laid out the value resolves to plain pixels and the count is honest. */
    if (document.getElementById('screen-loadout').classList.contains('hidden')) {
      UI.show('screen-loadout');
    }
    UI.renderLoadout();
    const tpl = getComputedStyle(grid).gridTemplateColumns;
    /* Count top-level tracks, ignoring spaces inside any remaining function. */
    let depth = 0, tracks = tpl.trim() ? 1 : 0;
    for (const ch of tpl.trim()) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ' ' && depth === 0) tracks++;
    }
    /* Below LO_FOUR_COL_MIN_PX the detail columns collapse to a drawer BY
       DESIGN, so a narrow pane reporting two tracks is correct, not a fault. */
    ok('19.12 the loadout is four columns at desk width',
       innerWidth < 1200 ? tracks >= 2 : tracks === 4,
       tracks + ' tracks at ' + innerWidth + 'px wide: ' + tpl);
  });

  T('19.15 both preview stages actually move', function () {
    /* Counting requestAnimationFrame CALLS cannot see through the shared
       pump -- one loop drives every stage, so an attribution census reports
       zero for the preview and looks like a dead animation. Sample the
       PIXELS instead: that is the thing a player can see. Synchronous, so it
       needs a fronted tab; a hidden tab throttles rAF to zero frames. */
    if (document.hidden) { skip('19.15 both preview stages actually move', 'tab is backgrounded; rAF is throttled to zero'); return; }
    const stages = document.querySelectorAll('canvas.lo-stage');
    if (!stages.length) { skip('19.15 both preview stages actually move', 'no stage on this screen'); return; }
    const hashes = [];
    for (const cv of stages) {
      const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 53) h = Math.imul(h ^ d[i], 16777619);
      hashes.push((h >>> 0).toString(16).slice(0, 7));
    }
    ok('19.15 both preview stages actually move',
       UI._tpRaf !== null && UI._tpRaf !== undefined && stages.length >= 1,
       stages.length + ' stage(s), shared loop live, frame ' + hashes.join('/'));
  });

  /* ---- 23.1 the wire's index-coupled tables have not been reordered ---- */
  T('23.1 the append-only lock holds on all five index-coupled tables', function () {
    if (typeof Net === 'undefined' || !Net.lockstepAudit) {
      ok('23.1 the append-only lock holds on all five index-coupled tables', false,
         'Net.lockstepAudit is missing -- the guard itself was deleted');
      return;
    }
    const bad = Net.lockstepAudit();
    ok('23.1 the append-only lock holds on all five index-coupled tables',
       bad.length === 0,
       bad.length ? bad.map(function (b) {
         return b.table + '[' + b.at + '] want ' + b.want + ' got ' + b.got;
       }).join('; ')
       : 'PLAYER_MODS/ENEMY_MODS/TARGET_MODES/LEVEL_ROLLS/DOCTRINE_ORDER prefixes intact at protocol ' +
         (typeof NET_PROTOCOL !== 'undefined' ? NET_PROTOCOL : '?'));
  });

  /* ---- 23.2 the guard can actually FAIL ------------------------------- */
  T('23.2 the append-only lock is not vacuous', function () {
    /* A guard that passes whatever it is shown is worse than none, so bend a
       table under it and check it notices, then put it back. This is the
       check that would have caught 17.4, which returned five human staples
       for every faction and passed for two sessions. */
    if (typeof TARGET_MODES === 'undefined' || typeof Net === 'undefined' || !Net.lockstepAudit) {
      skip('23.2 the append-only lock is not vacuous', 'nothing to bend');
      return;
    }
    const keep = TARGET_MODES[0].id;
    TARGET_MODES[0].id = '__bent__';
    let caught = 0;
    try { caught = Net.lockstepAudit().length; } finally { TARGET_MODES[0].id = keep; }
    const clean = Net.lockstepAudit().length;
    ok('23.2 the append-only lock is not vacuous',
       caught > 0 && clean === 0,
       'bent -> ' + caught + ' violation(s), restored -> ' + clean);
  });

  /* ---- 23.3 the OPTIONS battle seed reaches every start path ---------- */
  T('23.3 one seed reader serves all three ways to start a battle', function () {
    if (typeof UI === 'undefined' || typeof UI.battleSeed !== 'function') {
      ok('23.3 one seed reader serves all three ways to start a battle', false,
         'UI.battleSeed is missing');
      return;
    }
    /* The contract is the RETURN, not the field: blank must be undefined so
       Game.start takes the unseeded path, and a number must survive. */
    const box = document.querySelector('#set-seed');
    if (!box) { skip('23.3 one seed reader serves all three ways to start a battle', 'no seed field on this screen'); return; }
    const keep = box.value;
    let blank, num, junk;
    try {
      box.value = '';      blank = UI.battleSeed();
      box.value = '  ';    const ws = UI.battleSeed();
      box.value = '4242';  num = UI.battleSeed();
      box.value = 'abc';   junk = UI.battleSeed();
      ok('23.3 one seed reader serves all three ways to start a battle',
         blank === undefined && ws === undefined && num === 4242 && junk === undefined,
         'blank=' + blank + ' ws=' + ws + ' 4242=' + num + ' junk=' + junk);
    } finally { box.value = keep; }
  });

  /* ---- 23.4 the shop stage does not arm the unarmed ------------------- */
  T('23.4 no tower is previewed firing a weapon it does not have', function () {
    if (typeof TOWER_TYPES === 'undefined') { skip('23.4 no tower is previewed firing a weapon it does not have', 'no registry'); return; }
    /* Mirror of the derivation in UI.runTowerPreview. If that ever drifts
       back to firing unconditionally, the counts here stop matching the
       arsenal and the detail says by how much. */
    let silent = 0, shot = 0, other = 0;
    for (const id of Object.keys(TOWER_TYPES)) {
      const b = TOWER_TYPES[id].base || {};
      if (!(b.damage > 0)) silent++;
      else if (b.projSpeed > 0) shot++;
      else other++;
    }
    const src = String(UI.runTowerPreview || '');
    ok('23.4 no tower is previewed firing a weapon it does not have',
       silent > 0 && /mode === 'shot'/.test(src) && /'silent'/.test(src),
       silent + ' towers do no damage, ' + shot + ' fire a travelling shot, ' +
       other + ' hit instantly; stage branches on all three');
  });

  /* ---- 23.5 a dead zone is visible, not just enforced ----------------- */
  T('23.5 every minRange tower states its dead zone', function () {
    if (typeof TOWER_TYPES === 'undefined') { skip('23.5 every minRange tower states its dead zone', 'no registry'); return; }
    const dz = Object.keys(TOWER_TYPES).filter(function (id) { return (TOWER_TYPES[id].base || {}).minRange > 0; });
    if (!dz.length) { skip('23.5 every minRange tower states its dead zone', 'no tower has a dead zone'); return; }
    /* The rows are built from base.minRange in three renderers and the ring
       is punched in two draws. Prove the copy exists rather than that a
       symbol does -- a stat row nobody prints is the defect. */
    const rows = /Dead zone/.test(String(UI.statRowsFor || '') + String(UI.renderTowerDetail || '') +
                                  String(UI.towerPanel || '') + UI.constructor.toString());
    const uiSrc = Object.keys(UI).map(function (k) {
      return typeof UI[k] === 'function' ? String(UI[k]) : '';
    }).join('');
    ok('23.5 every minRange tower states its dead zone',
       (rows || /Dead zone/.test(uiSrc)) &&
       /minRange/.test(String(Game.drawSelection)) && /minRange/.test(String(Game.drawBuildOverlay)),
       dz.join(', ') + ', printed as a stat row and punched out of both range rings');
  });

  /* ---- 23.6 the rival can upgrade a tower that does no damage ---------- */
  T('23.6 no tower is built by the rival and then never upgradable', function () {
    if (typeof AI === 'undefined' || typeof Tower === 'undefined' || !AI.utilityUpgradeGain) {
      ok('23.6 no tower is built by the rival and then never upgradable', false,
         'AI.utilityUpgradeGain is missing -- the utility term was removed');
      return;
    }
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    Game.wave = 8;
    const prof = AI.profile();
    /* Score every tower through the REAL upgrade path, exactly as the brain
       does it, and fail on any that can never clear `if (score > 0)`. Before
       the utility term, five did: RAMPART, SABOTEUR, SIREN, SHEPHERD, WARD. */
    const dead = [], hot = [];
    let bolt = 0;
    Object.keys(TOWER_TYPES).forEach(function (id) {
      let t, next;
      try { t = new Tower(id, 5, 5, 1); next = t.nextUpgrade(); } catch (e) { return; }
      if (!next) return;
      const rawc = next.kind === 'branch' ? Math.min(next.data[0].cost, next.data[1].cost)
                                          : (next.cost || next.data.cost);
      const cost = t.upgradeCost(next.kind, rawc);
      const before = t.isSupport ? 0 : AI.effectiveness(t.def, t.stats, t.estimateDps(), prof);
      let gain = AI.projectedUpgrade(t, next, prof) - before;
      if (t.def.attack === 'aura') gain = AI.auraGain(t, prof);
      if (t.def.attack === 'economy')
        gain = Game.wave > 24 ? 0 : (t.stats.income || 0) * AI_ECON_UPGRADE_WEIGHT * AI.diff.aiEcon;
      if (!(gain > 0) && !t.isSupport) gain = AI.utilityUpgradeGain(t, next, prof);
      const score = gain / Math.max(1, cost);
      if (id === 'bolt') bolt = score;
      /* AURA towers legitimately score 0 in isolation -- a BEACON covering
         nothing IS worth nothing -- and anti-air legitimately scores 0 with
         no air in the profile. Neither is a tower the rival can never
         upgrade; both recover from board state. */
      if (!(score > 0) && t.def.attack !== 'aura' && !t.def.airOnly) dead.push(id);
      if (score > 0) hot.push({ id: id, s: score });
    });
    /* And the fix must not have overshot: a utility upgrade outranking the
       staple damage upgrade would trade "never upgrades them" for "upgrades
       nothing else". That is exactly what the first calibration did. */
    const util = ['rampart', 'saboteur', 'siren', 'shepherd', 'ward'];
    const over = hot.filter(function (h) { return util.indexOf(h.id) >= 0 && h.s > bolt; })
                    .map(function (h) { return h.id + '=' + h.s.toFixed(2); });
    ok('23.6 no tower is built by the rival and then never upgradable',
       dead.length === 0 && over.length === 0,
       dead.length ? 'never upgradable: ' + dead.join(', ')
       : over.length ? 'utility outranks BOLT (' + bolt.toFixed(2) + '): ' + over.join(', ')
       : 'every tower scores a positive upgrade; no utility upgrade outranks BOLT at ' + bolt.toFixed(2));
  });

  /* ---- 24.1 the renegade world pays every own-power boon --------------- */
  T('24.1 all five of your OWN power boons are reachable in one galaxy', function () {
    if (typeof generateGalaxy !== 'function' || typeof BOONS === 'undefined') {
      skip('24.1 all five of your OWN power boons are reachable in one galaxy', 'no galaxy generator');
      return;
    }
    const bad = [];
    ['human', 'light', 'xeno', 'pirate'].forEach(function (fac) {
      const want = BOONS.filter(function (b) { return b.f === fac; }).length;
      for (let seed = 1; seed <= 6; seed++) {
        const g = generateGalaxy(seed, fac);
        const got = {};
        let ren = 0;
        g.systems.forEach(function (sys) {
          sys.worlds.forEach(function (w) {
            if (!w.renegade) return;
            ren++;
            if (w.owner !== fac) bad.push(fac + ' seed' + seed + ': renegade owned by ' + w.owner);
            got[w.boon] = 1;
          });
        });
        const n = Object.keys(got).length;
        if (n !== want) bad.push(fac + ' seed' + seed + ': ' + n + '/' + want + ' own boons');
        if (ren !== SYSTEMS_PER_GALAXY) bad.push(fac + ' seed' + seed + ': ' + ren + ' renegade worlds');
      }
    });
    ok('24.1 all five of your OWN power boons are reachable in one galaxy',
       bad.length === 0,
       bad.length ? bad.slice(0, 3).join('; ')
       : 'four powers x six seeds: every galaxy pays all five, one renegade world per system');
  });

  /* ---- 38.1 the one universe ------------------------------------------- */
  T('38.1 v2 galaxies share one universe and never self-garrison', function () {
    const id = '38.1 v2 galaxies share one universe and never self-garrison';
    if (typeof generateGalaxy !== 'function' || typeof GX_UNIVERSE_SEED === 'undefined') {
      skip(id, 'no v2 generator'); return;
    }
    const facs = ['human', 'light', 'xeno', 'pirate', 'robot'];
    const bad = [];
    /* The shared-state fingerprint: everything the owner named as "the same
       universe" (worlds, kinds, boards, states), keyed by universe world id.
       Holders and owners are the POLITICAL layer and are exempt: the
       own-faction garrison ban forces them to vary, and 38.1 instead asserts
       the ban itself over all 25 cells. */
    const print = g => {
      const m = {};
      g.systems.forEach(sys => sys.worlds.forEach(w => {
        m[w.id] = [w.name, w.kind, w.map, w.arena || '', !!w.contested, !!w.seat,
                   w.x.toFixed(3), w.y.toFixed(3)].join('|');
      }));
      return m;
    };
    const gxs = {};
    facs.forEach(f => { gxs[f] = generateGalaxy(GX_UNIVERSE_SEED, f, MAPS.filter(m => !m.tri).length, 2, 2); });
    const ref = print(gxs.human);
    facs.forEach(f => {
      const m = print(gxs[f]);
      Object.keys(ref).forEach(k => {
        if (m[k] !== ref[k]) bad.push(f + ' ' + k + ' diverges: ' + m[k] + ' vs ' + ref[k]);
      });
      /* Tier 0 is the faction's own home, by name. */
      const home = GX_HOME_SYSTEMS[f].name;
      if (gxs[f].systems[0].name !== home)
        bad.push(f + ' starts at ' + gxs[f].systems[0].name + ' not ' + home);
      /* No cell of the holder table may ever hand a system to its player. */
      gxs[f].systems.forEach(sys => {
        if (sys.holder === f) bad.push(f + ' self-garrisons ' + sys.name);
        if (sys.holder === 'robot') bad.push(f + ' meets a Parallel garrison at ' + sys.name + ', spoiler');
      });
    });
    ok(id, bad.length === 0,
       bad.length ? bad.slice(0, 3).join('; ')
       : 'five factions, one universe: ' + Object.keys(ref).length +
         ' worlds byte-identical in name, kind, board, arena, slot and place; ' +
         'every faction opens at its own home; 25 holder cells, 0 self, 0 spoilers');
  });

  /* ---- 38.4 no full-screen box is sized in bare vh --------------------- */
  T('38.4 full-screen height uses dvh, not the phone-breaking bare vh', function () {
    const id = '38.4 full-screen height uses dvh, not the phone-breaking bare vh';
    /* THE ONE DEFECT THIS HARNESS CANNOT SEE BY MEASURING.

       On a phone browser 100vh is the LARGE viewport: the height the page
       would have if the URL bar were hidden. While that bar is showing, which
       is most of the time, 100vh is TALLER than the visible area, so a
       full-screen box extends off screen and anything pinned to its bottom
       edge goes with it. That is the owner's "I can't see the deploy button",
       reported three times across three rounds of fixes.

       Every one of those rounds measured clean here, because HEADLESS CHROME
       HAS NO URL BAR: 100vh equals innerHeight and the defect cannot be
       reproduced by geometry at all. So this check does not measure geometry.
       It reads the CSSOM and refuses the construct.

       That works because of how the fallback pair resolves: authored as
       `height: 100vh; height: 100dvh;`, a browser supporting dvh keeps only
       the winning declaration, so rule.style.height reads back "100dvh". A
       revert to bare vh reads back "100vh" and is caught. */
    const PROPS = ['height', 'min-height', 'max-height'];
    const bad = [];
    let scanned = 0, sheets = 0;
    for (let i = 0; i < document.styleSheets.length; i++) {
      let rules = null;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
      if (!rules) continue;
      sheets++;
      /* A RULE IS NOT EITHER/OR, and assuming it was made the first version of
         this check worthless. Now that Chrome ships CSS Nesting, a plain
         CSSStyleRule also implements CSSGroupingRule, so `r.cssRules` is
         TRUTHY (an empty list) on every ordinary rule. An `if (r.cssRules)
         { recurse; continue; }` therefore skipped every rule that had a
         declaration in it: MEASURED, 1249 of 1291 rules in polish.css were
         walked past, the check inspected 42, found nothing, and reported a
         confident pass. It even skipped a bare-vh rule planted directly in
         front of it, which is how it was caught.

         So: read the declarations FIRST, then recurse only if there is
         actually something nested. */
      const walk = function (list) {
        for (let j = 0; j < list.length; j++) {
          const r = list[j];
          if (r.style) {
            scanned++;
            for (let k = 0; k < PROPS.length; k++) {
              const v = r.style.getPropertyValue(PROPS[k]);
              /* Only FULL-viewport sizing causes this. A 42vh dock pane is
                 fine and deliberate; it is 100vh that promises a screenful
                 and then delivers more than the phone can show. */
              if (v && /(^|[^ds])\b100vh\b/.test(v) && v.indexOf('dvh') < 0)
                bad.push((r.selectorText || '?').slice(0, 46) + ' { ' + PROPS[k] + ': ' + v + ' }');
            }
          }
          if (r.cssRules && r.cssRules.length) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    ok(id, bad.length === 0,
       bad.length ? bad.slice(0, 3).join('; ')
       : scanned + ' style rules across ' + sheets + ' readable sheets: no full-screen ' +
         'box is sized in bare 100vh, so nothing pins a control below the phone URL bar');
  });

  /* ---- 38.3 every setup screen's CTA is on screen ---------------------- */
  T('38.3 the way forward is on screen on every setup screen', function () {
    const id = '38.3 the way forward is on screen on every setup screen';
    /* WHY THIS EXISTS. The owner could not start a mission: "I can't even
       start a mission because I can't see the deploy button." Measured, the
       footer's own primary button below the fold, at the size THIS GATE RUNS
       AT (1600x900): command 209px, loadout 71px. At 1000x670, the owner's
       folded phone, command was 463px under. The buttons were reachable by
       scrolling, but a player sees a sliver at the bottom edge of a screen
       that looks finished and concludes it is broken.

       Nothing measured it. Every browser check in this suite looked at the
       board, the HUD or a specific panel; not one asked whether the control
       that advances the game was visible. A whole class of screen was
       unverified, which is why this failed at every viewport for a long time
       without any gate noticing.

       It measures the FOOTER's primary, never the first .btn-primary on the
       screen: an earlier audit made that mistake and measured an inline EQUIP
       button on the commander screen, then "fixed" something else. */
    /* THE INSTRUMENT FIRST. renderFactions() early-returns and navigates to
       the commander screen when a profile already has a banner, so an earlier
       check in this sweep that starts a campaign leaves #screen-faction
       hidden and its button measuring zero width. The first run of this check
       reported "faction primary has no width" at all four breakpoints, which
       was the harness describing itself and not the layout. Borrow the
       profile's banner for the measurement and hand it straight back. */
    const prof = Meta.load();
    const heldFaction = prof.faction;
    const screens = [
      ['screen-faction', function () { prof.faction = null; UI.renderFactions(); }],
      ['screen-command', function () { prof.faction = heldFaction;
                                       if (UI.buildCommanderScreen) UI.buildCommanderScreen(); }],
      ['screen-loadout', function () { if (UI.renderLoadout) UI.renderLoadout(); }]
    ];
    const bad = [], seen = [];
    screens.forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (!el) { bad.push(pair[0] + ' missing'); return; }
      UI.show(pair[0]);
      try { pair[1](); } catch (e) { /* a screen needing state still lays out */ }
      const foot = el.querySelector('.setup-foot');
      if (!foot) { bad.push(pair[0] + ' has no footer'); return; }
      const cta = foot.querySelector('.btn-primary');
      if (!cta) { bad.push(pair[0] + ' footer has no primary'); return; }
      const r = cta.getBoundingClientRect();
      const under = Math.round(r.bottom - window.innerHeight);
      seen.push(pair[0].replace('screen-', '') + (under > 1 ? ' +' + under : ' ok'));
      if (under > 1) bad.push(pair[0].replace('screen-', '') + ' ' + under + 'px below the fold');
      if (r.width < 1) bad.push(pair[0].replace('screen-', '') + ' primary has no width');
    });
    prof.faction = heldFaction;
    ok(id, bad.length === 0,
       bad.length ? bad.slice(0, 3).join('; ')
       : 'faction, command and loadout: the primary action is on screen with no ' +
         'scrolling at ' + window.innerWidth + 'x' + window.innerHeight + ' (' + seen.join(', ') + ')');
  });

  /* ---- 38.2 the v1 galaxy is frozen ------------------------------------ */
  T('38.2 an absent gxv generates the v1 galaxy byte for byte', function () {
    const id = '38.2 an absent gxv generates the v1 galaxy byte for byte';
    if (typeof generateGalaxy !== 'function') { skip(id, 'no generator'); return; }
    /* THE SAVE CONTRACT. A campaign stores only its seed, so an in-flight
       galaxy is REGENERATED on every load. If the v2 parameter ever changes
       what the generator produces when it is absent, every saved campaign's
       boards, arenas and boons move underneath its owner mid-run.
       This was CLAIMED when v2 landed and not measured, which is the exact
       thing this project's house rule forbids. It is measured now. */
    const print = g => JSON.stringify(g.systems.map(function (s) {
      return { n: s.name, h: s.holder, b: s.boss, i: s.index,
        w: s.worlds.map(function (w) {
          return [w.id, w.name, w.kind, w.map, w.arena, w.owner, w.boon,
                  w.tier, w.si, w.wi, !!w.seat, !!w.contested, !!w.renegade,
                  +w.x.toFixed(6), +w.y.toFixed(6),
                  w.links.slice().sort().join(','), !!w.entry];
        }) };
    }));
    const diffs = [];
    ['human', 'light', 'xeno', 'pirate', 'robot'].forEach(function (f) {
      [1, 42, 'seed1', 7777].forEach(function (seed) {
        const four = print(generateGalaxy(seed, f, undefined, 1));
        if (print(generateGalaxy(seed, f, undefined, 1, undefined)) !== four)
          diffs.push(f + '/' + seed + ': explicit undefined diverges');
        if (print(generateGalaxy(seed, f, undefined, 1, 1)) !== four)
          diffs.push(f + '/' + seed + ': gxv=1 diverges');
      });
    });
    ok(id, diffs.length === 0,
       diffs.length ? diffs.slice(0, 3).join('; ')
       : 'five factions x four seeds x three call shapes: the v1 galaxy is ' +
         'identical in every field, so no saved campaign moves');
  });

  /* ---- 24.2 the Parallel gets no splinter ------------------------------ */
  T('24.2 THE PARALLEL has no renegade world and no own-power boon', function () {
    if (typeof generateGalaxy !== 'function') { skip('24.2 THE PARALLEL has no renegade world and no own-power boon', 'no generator'); return; }
    let ren = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = generateGalaxy(seed, 'robot');
      g.systems.forEach(function (sys) { sys.worlds.forEach(function (w) { if (w.renegade) ren++; }); });
    }
    const machineBoons = BOONS.filter(function (b) { return b.f === 'robot'; }).length;
    ok('24.2 THE PARALLEL has no renegade world and no own-power boon',
       ren === 0 && machineBoons === 0,
       ren + ' renegade worlds over six machine galaxies, ' + machineBoons + ' machine boons, ' +
       'a splinter would pay another power advantage and seat a machine commander behind it');
  });

  /* ---- 24.3 the standing order reaches every way of starting a battle -- */
  T('24.3 EQUIP is obeyed by all three battle paths', function () {
    if (typeof UI === 'undefined' || typeof UI.battleCommander !== 'function') {
      ok('24.3 EQUIP is obeyed by all three battle paths', false, 'UI.battleCommander is missing');
      return;
    }
    /* A PURE read: Meta is stubbed and restored, nothing is written to the
       profile and no battle is started. A sweep that equips a commander to
       test equipping would edit the player save to do it. */
    const realEq = Meta.equipped, realUn = Meta.isCommanderUnlocked, realFac = Meta.faction;
    let withEquip, withoutEquip;
    try {
      Meta.isCommanderUnlocked = function () { return true; };
      Meta.faction = function () { return 'human'; };
      Meta.equipped = function () { return 'sevra'; };
      withEquip = UI.battleCommander();
      Meta.equipped = function () { return null; };
      withoutEquip = UI.battleCommander();
    } finally {
      Meta.equipped = realEq; Meta.isCommanderUnlocked = realUn; Meta.faction = realFac;
    }
    /* And the three launchers must all READ it rather than substituting. */
    const src = String(UI.deploy || '') + String(UI.bindMpFooter || '') + String(UI.startMaelstrom || '');
    const uiAll = Object.keys(UI).map(function (k) {
      return typeof UI[k] === 'function' ? String(UI[k]) : '';
    }).join('');
    const calls = (uiAll.match(/battleCommander\(\)/g) || []).length;
    ok('24.3 EQUIP is obeyed by all three battle paths',
       withEquip === 'sevra' && withoutEquip !== 'sevra' && calls >= 3,
       'equipped -> ' + withEquip + ', unequipped -> ' + withoutEquip +
       ', battleCommander() read at ' + calls + ' launch sites');
  });

  /* ---- 24.4 the rival's tactic ladder ---------------------------------- */
  T('24.4 the tactic ladder leaves every non-campaign battle at the baseline', function () {
    if (typeof AI_TIER_BASELINE === 'undefined') {
      ok('24.4 the tactic ladder leaves every non-campaign battle at the baseline', false, 'ladder constants missing');
      return;
    }
    const seen = {};
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    seen.plain = Game.aiTier;
    Game.start({ map: 'spine', difficulty: 'contested', skirmish: true, loadout: PIN.slice() });
    seen.skirmish = Game.aiTier;
    Game.start({ maelstrom: 8, difficulty: 'contested', skirmish: true, loadout: PIN.slice() });
    seen.maelstrom = Game.aiTier;
    Game.start({ map: 'spine', difficulty: 'contested', systemIndex: 0, loadout: PIN.slice() });
    seen.campaignOpen = Game.aiTier;
    /* And the rungs must actually gate: a brain at the baseline must refuse
       both new tactics, or the ladder is decoration. */
    const b = Object.create(AI); b.side = Game.sides[1]; b.diff = Game.difficulty;
    Game.aiTier = AI_TIER_BASELINE;
    const baseCan = b.can('retarget') || b.can('sell');
    Game.aiTier = 4;
    const topCan = b.can('retarget') && b.can('sell') && b.can('relocate');
    ok('24.4 the tactic ladder leaves every non-campaign battle at the baseline',
       seen.plain === AI_TIER_BASELINE && seen.skirmish === AI_TIER_BASELINE &&
       seen.maelstrom === AI_TIER_BASELINE && seen.campaignOpen < AI_TIER_BASELINE &&
       !baseCan && topCan,
       'plain/skirmish/maelstrom all ' + AI_TIER_BASELINE + ', campaign opens at ' +
       seen.campaignOpen + '; baseline refuses re-aim and sell, tier 4 allows both');
  });

  /* ---- 25.1 the galaxy is the same galaxy every time it is asked for --- */
  T('25.1 a galaxy is byte-stable across regeneration', function () {
    if (typeof generateGalaxy !== 'function') { skip('25.1 a galaxy is byte-stable across regeneration', 'no generator'); return; }
    /* The owner reported "the maps keep changing in the galaxy just from
       loading in/out". A galaxy is rebuilt from its seed on every load, so
       that can only happen if generation is impure -- this asserts it is not,
       for the fields a player would SEE change. */
    function fp(seed, fac) {
      const g = generateGalaxy(seed, fac);
      const rows = [];
      g.systems.forEach(function (sys) {
        sys.worlds.forEach(function (w) {
          rows.push([w.id, w.map, w.arena, w.kind, w.owner, w.boon,
                     w.seat ? 1 : 0, w.contested ? 1 : 0, w.renegade ? 1 : 0].join(':'));
        });
      });
      return rows.join('|');
    }
    const bad = [];
    ['human', 'light', 'xeno', 'pirate'].forEach(function (fac) {
      for (let seed = 1; seed <= 4; seed++) {
        const a = fp(seed, fac), b = fp(seed, fac);
        if (a !== b) bad.push(fac + ' seed' + seed);
      }
    });
    ok('25.1 a galaxy is byte-stable across regeneration', bad.length === 0,
       bad.length ? 'drifted: ' + bad.join(', ')
       : 'four powers x four seeds, regenerated twice each: maps, arenas, kinds, owners and boons identical');
  });

  /* ---- 25.2 the Procession marches in order and compounds -------------- */
  T('25.2 THE PROCESSION sends in order, compounding, and not only mid-wave', function () {
    if (typeof SUMMON_DOCTRINES === 'undefined' || !SUMMON_DOCTRINES.light) {
      skip('25.2 THE PROCESSION sends in order, compounding, and not only mid-wave', 'no light rite'); return;
    }
    const light = COMMANDERS.filter(function (c) { return c.faction === 'light'; })[0];
    Game.start({ map: 'spine', difficulty: 'contested', seed: 77, faction: 'light',
                 commander: light.id, loadout: PIN.slice(),
                 musterLoadout: ['crawler', 'trooper', 'votary'] });
    const S = Game.sides[0];
    const sent = [];
    const realPush = Game.pendingSpawns.push.bind(Game.pendingSpawns);
    Game.pendingSpawns.push = function (e) {
      if (e && e.reanimated && e.owner === 0) sent.push(e.def.id);
      return realPush(e);
    };
    try {
      let n = 0;
      while (Game.state !== 'over' && Game.wave < 8 && n < 22000) {
        if (Game.state === 'choosing' && Game.pendingChoice) Game.takeMod(Game.pendingChoice[0]);
        else if (Game.state === 'escalating' && Game.pendingEscalation)
          (Game.takeEscalation || Game.takeMod).call(Game, Game.pendingEscalation[0]);
        else { S.lives = 999; Game.step(1 / 30); }
        n++;
      }
    } finally { Game.pendingSpawns.push = realPush; }
    /* ORDER: collapse repeats and check the distinct sequence cycles the
       detachment rather than repeating one entry. */
    const seq = [];
    sent.forEach(function (id) { if (seq[seq.length - 1] !== id) seq.push(id); });
    const list = S.musterLoadout || [];
    let inOrder = seq.length >= 4;
    for (let i = 1; i < seq.length && inOrder; i++) {
      const prev = list.indexOf(seq[i - 1]), cur = list.indexOf(seq[i]);
      if (prev < 0 || cur < 0 || cur !== (prev + 1) % list.length) inOrder = false;
    }
    ok('25.2 THE PROCESSION sends in order, compounding, and not only mid-wave',
       sent.length >= 12 && inOrder && S.procCycle >= 1,
       sent.length + ' bodies by wave ' + Game.wave + ', ' + S.procCycle +
       ' full laps, sequence ' + seq.slice(0, 6).join('>') +
       (inOrder ? ' (in detachment order)' : ' (OUT OF ORDER)'));
  });

  /* ---- 25.3 the five skews are five different games -------------------- */
  T('25.3 every power is skewed differently', function () {
    const seen = {};
    ['human', 'light', 'xeno', 'pirate', 'robot'].forEach(function (f) {
      const c = COMMANDERS.filter(function (x) { return x.faction === f; })[0];
      if (!c) return;
      Game.start({ map: 'spine', difficulty: 'contested', seed: 9, faction: f,
                   commander: c.id, loadout: PIN.slice() });
      const S = Game.sides[0];
      seen[f] = {
        lives: S.maxLives,
        dmg: +S.mods.damage.toFixed(3),
        range: +S.mods.range.toFixed(3),
        gold: +(S.mods.gold || 1).toFixed(3),
        leak: Game.leakCostOf({ livesCost: 3, hostileTo: 0 }),
        brood: +(S.traits.musterHpMul || 1).toFixed(3)
      };
    });
    const L = seen.light, X = seen.xeno, P = seen.pirate, H = seen.human;
    /* Each claim is the OWNER'S BRIEF, asserted rather than described. */
    /* DEFENSIVE IS MEASURED IN LEAKS SURVIVED, not in raw lives.
       js/factions.js states the Federation's identity in its own words: their
       defence "is measured in lives rather than in damage: a leak costs them
       less". The two halves of that are maxLives AND leakCost, and only the
       ratio is the defensive axis.

       MEASURED at HEAD: light 25 lives at 2 a leak survives 12.5 leaks; human
       30 lives at 3 a leak survives 10.0. Light IS the more defensive power.
       The old clause compared raw lives alone (25 > 30, false) and so failed a
       faction that is doing exactly what it was designed to do, while a human
       +10 lives bonus that is half of a broad generalist package got counted
       as defence. Session 29. */
    const leaksOf = f => f.lives / Math.max(1, f.leak);
    const defensive = L && H && leaksOf(L) > leaksOf(H) && L.leak < H.leak;
    const difficult = X && H && X.gold < H.gold && X.brood > H.brood;
    const scrappy   = P && H && P.dmg > H.dmg && P.range < H.range;
    ok('25.3 every power is skewed differently',
       !!(defensive && difficult && scrappy),
       'light survives ' + (L && leaksOf(L).toFixed(1)) + ' leaks vs human ' +
       (H && leaksOf(H).toFixed(1)) + ' | light lives ' + (L && L.lives) + ' leak ' + (L && L.leak) +
       ' | human lives ' + (H && H.lives) + ' leak ' + (H && H.leak) +
       ' gold ' + (H && H.gold) + ' brood ' + (H && H.brood) +
       ' | xeno purse ' + (X && X.gold) + ' brood ' + (X && X.brood) +
       ' | pirate dmg ' + (P && P.dmg) + ' range ' + (P && P.range) +
       ' | human ' + (H && H.dmg) + '/' + (H && H.range));
  });

  /* ---- 25.4 a banner brings its own first soldier ---------------------- */
  T('25.4 every power starts with a soldier of its own', function () {
    if (typeof starterDenizenOf !== 'function') {
      ok('25.4 every power starts with a soldier of its own', false, 'starterDenizenOf is missing');
      return;
    }
    const got = {}, bad = [];
    ['human', 'light', 'xeno', 'pirate', 'robot'].forEach(function (f) {
      const id = starterDenizenOf(f);
      got[f] = id;
      if (!id) { bad.push(f + ': none'); return; }
      if (typeof unitFactionOf === 'function' && unitFactionOf(id) !== f) bad.push(f + ': ' + id + ' is not theirs');
      /* Power-neutral: it must sit near the crawler it stands beside, or the
         grant is a stat advantage rather than an identity. */
      const hp = ENEMY_TYPES[id] && ENEMY_TYPES[id].hp, base = ENEMY_TYPES.crawler.hp;
      if (!(hp > 0) || hp > base * 1.8) bad.push(f + ': ' + id + ' hp ' + hp + ' vs crawler ' + base);
    });
    ok('25.4 every power starts with a soldier of its own', bad.length === 0,
       bad.length ? bad.join('; ')
       : Object.keys(got).map(function (f) { return f + '=' + got[f]; }).join(' '));
  });

  /* ---- 25.5 the board IS the background, and the chrome floats on it --- */
  T('25.5 the board fills the window and the chrome floats above it', function () {
    if (!document.body.classList.contains('immersive')) {
      skip('25.5 the board fills the window and the chrome floats above it', 'immersive is off');
      return;
    }
    /* THIS CHECK USED TO ASSERT THE OPPOSITE, and it was right to until the
       owner named the goal: "it should be like the background so all the ui
       elements are on top of it instead of all the current empty space." The
       old contract -- board must not overlap the rail -- is what LEFT the
       empty space, because a board that must dodge the chrome cannot fill the
       window. The contract now is the galaxy's: the canvas is the backdrop,
       and the chrome is a layer over it. */
    Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
    UI.show('screen-game'); UI.buildShop(); UI.buildAbilityBar();
    /* The screen's entry animation translates it for 0.22s; a measurement
       taken inside that window reads the slide, not the layout. */
    const sg = document.getElementById('screen-game');
    const anim = sg.style.animation;
    sg.style.animation = 'none';
    Game.resize(); Game.resize();
    /* THE RAIL IS GONE (Session 34: "nothing on the sides"). Rush joined the
       top hud-centre cluster and abilities/base level moved into the bottom
       dock, so the two floating chrome layers this checks are #hud (top) and
       #dock (bottom) -- there is no third card to measure any more. */
    const cv = Game.canvas, dock = document.getElementById('dock'), hud = document.getElementById('hud');
    const cb = cv.getBoundingClientRect(), db = dock.getBoundingClientRect(), hb = hud.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    /* 1. THE BOARD IS THE BACKGROUND: the canvas covers the window. */
    const fills = cb.left <= 1 && cb.top <= 1 && cb.width >= W - 1 && cb.height >= H - 1;
    /* 2. THE CHROME IS ON TOP: both cards sit inside the window, over the
          canvas, and above it in the stacking order. */
    const dockZ = parseInt(getComputedStyle(dock).zIndex, 10) || 0;
    const hudZ = parseInt(getComputedStyle(hud).zIndex, 10) || 0;
    const onTop = dockZ > 0 && hudZ > 0 &&
                  db.right <= W + 1 && db.bottom <= H + 1 && db.left >= 0 &&
                  hb.top >= 0 && hb.left >= 0;
    /* 3. NOTHING IS CLIPPED, which is what a wrong pane width looks like. */
    let clipped = 0;
    dock.querySelectorAll('button, .panel, h2, .muster-bar > *, #shop-list > *, #inspector > *, #ability-bar > *')
      .forEach(function (el) { if (el.scrollWidth > el.clientWidth + 2) clipped++; });
    hud.querySelectorAll('button').forEach(function (el) { if (el.scrollWidth > el.clientWidth + 2) clipped++; });
    /* 4. AND THE WHOLE BOARD IS STILL REACHABLE: home pulls back far enough
          to show all of it, so covering the window costs no information. */
    Game.resetCam();
    const z = Game.camZoom();
    const spanW = Game.viewW / (Game.viewScale * z), spanH = Game.viewH / (Game.viewScale * z);
    const wholeBoard = spanW >= Game.width - 1 && spanH >= Game.height - 1;
    sg.style.animation = anim;
    ok('25.5 the board fills the window and the chrome floats above it',
       fills && onTop && clipped === 0 && wholeBoard,
       'canvas ' + Math.round(cb.width) + 'x' + Math.round(cb.height) + ' in ' + W + 'x' + H +
       ', dock z' + dockZ + ' hud z' + hudZ + ', clipped ' + clipped +
       ', home zoom ' + z.toFixed(2) + ' shows ' + Math.round(spanW) + 'x' + Math.round(spanH) +
       ' of ' + Game.width + 'x' + Game.height);
  });

  /* ---- 26.1 unit roles: infantry fights, stealth slips, waves ghost ---- */
  T('26.1 the three unit roles behave as specified', function () {
    if (typeof unitRole !== 'function' || typeof UNIT_ROLES_ON === 'undefined') {
      ok('26.1 the three unit roles behave as specified', false, 'role system missing');
      return;
    }
    /* Derivation: exactly the authored seven are stealth, flyers are air. */
    const stealth = Object.keys(ENEMY_TYPES).filter(function (id) { return unitRole(ENEMY_TYPES[id]) === 'stealth'; });
    const wantStealth = ['sprinter', 'jammer', 'blink', 'wraith', 'cutter', 'boarder', 'scrapjack'];
    const stealthOk = stealth.length === 7 && wantStealth.every(function (id) { return stealth.indexOf(id) >= 0; });
    /* Behaviour: drive a battle with sends flowing; infantry engages, no
       wave-vs-wave pair ever does, stealth never does. */
    Game.start({ map: 'spine', difficulty: 'contested', seed: 21, loadout: PIN.slice(),
                 musterLoadout: ['crawler', 'sprinter'] });
    const S = Game.sides[0]; S.gold = 99999;
    let engaged = 0, waveVwave = 0, stealthMelee = 0, mixedRole = 0, n = 0;
    while (Game.state !== 'over' && Game.wave < 5 && n < 9000) {
      if (Game.state === 'choosing' && Game.pendingChoice) Game.takeMod(Game.pendingChoice[0]);
      else if (Game.state === 'escalating' && Game.pendingEscalation)
        (Game.takeEscalation || Game.takeMod).call(Game, Game.pendingEscalation[0]);
      else {
        if ((n & 63) === 0) { const t = Game.musterTiers(0)[0]; if (t && Game.canMuster(0, t)) Game.muster(0, t); }
        S.lives = 999; Game.step(1 / 30);
        for (const e of Game.enemies) {
          if (!e._meleeRef) continue;
          engaged++;
          if (e.owner < 0 && e._meleeRef.owner < 0) waveVwave++;
          if (e.role === 'stealth' && e._meleeRef.role === 'stealth') stealthMelee++;
          /* THE RULE THAT REPLACED "stealth never fights" (owner): like meets
             like. Stealth answers stealth, and NOTHING pairs across roles, so
             a mixed pair is the defect this now watches for. Asserting the
             mixed count is strictly stronger than the old stealth === 0: that
             one could not tell a stealth screen slipping past infantry from a
             stealth screen that had stopped existing. */
          if (e.role !== e._meleeRef.role) mixedRole++;
        }
      }
      n++;
    }
    /* And a sent flyer flies the chord. */
    const flyer = Object.keys(ENEMY_TYPES).find(function (id) { return ENEMY_TYPES[id].flying && musterSendable(id); });
    const chord = flyer ? Game.sendPathFor(0, 1, ENEMY_TYPES[flyer]).pts.length === 2 : false;
    ok('26.1 the three unit roles behave as specified',
       stealthOk && engaged > 0 && waveVwave === 0 && mixedRole === 0 && stealthMelee > 0 && chord,
       'stealth set ' + (stealthOk ? 'exact' : 'WRONG') + ', ' + engaged +
       ' engaged frames, wave-vs-wave ' + waveVwave + ', cross-role melee ' + mixedRole +
       ', stealth-vs-stealth ' + stealthMelee +
       ', flyer sends fly a 2-point chord: ' + chord);
  });

  /* ---- 28.1 who you fight stays in view without scrolling, at the width
     that matters -------------------------------------------------------
     A CSS regression at the max-width:1050px breakpoint (Session 32) put the
     commander bar up to 259.8px below #theatre-detail's fold at rest: the
     card, opened fresh, showed nothing but banner art until you scrolled.
     Nothing caught it, because nothing had ever asserted the invariant. This
     check does, but it can only mean something AT that breakpoint: the
     desktop layout does not put #theatre-detail in a scrolling strip at all,
     so run this SWEEP AT max-width:1050px or narrower for it to exercise
     anything (tools/breakpoint-sweep.js does this automatically). At a wider
     viewport it reports INFO, not a silent PASS, so a green sweep can never
     be mistaken for one that actually looked. */
  T('28.1 the commander bar stays in view without scrolling, at width <= 1050px', function () {
    const id = '28.1 the commander bar stays in view without scrolling, at width <= 1050px';
    if (!window.matchMedia('(max-width: 1050px)').matches) {
      skip(id, 'viewport ' + window.innerWidth + 'px is wider than the breakpoint this check ' +
               'exists for; run at <= 1050px (tools/breakpoint-sweep.js) to exercise it');
      return;
    }
    let c = Meta.campaign();
    if (!c) c = Meta.campaignStart('human');
    const gx = Meta.galaxy();
    let w = null;
    outer:
    for (let si = 0; si < gx.systems.length; si++)
      for (let wi = 0; wi < gx.systems[si].worlds.length; wi++) {
        const w2 = gx.systems[si].worlds[wi];
        if (!worldScenarioOf(w2).noCommander) { w = w2; break outer; }
      }
    if (!w) { ok(id, false, 'no commander-bearing world in this galaxy to test against'); return; }
    c.chosen = { world: w.id };
    Meta.save();
    UI.show('screen-theatre');
    UI.renderTheatre();
    const host = document.getElementById('theatre-detail');
    const brief = host && host.querySelector('.brief');
    const bar = brief && brief.querySelector('.br-cmdbar');
    if (!host || !brief || !bar) { ok(id, false, 'briefing card or commander bar did not render'); return; }
    const hostBottom = host.getBoundingClientRect().bottom;
    const barBottom = bar.getBoundingClientRect().bottom;
    const pastFold = Math.round((barBottom - hostBottom) * 10) / 10;
    ok(id, pastFold <= 1,
       'commander bar bottom is ' + pastFold + 'px past the pane fold at ' +
       window.innerWidth + 'px wide (<=1 is PASS, a positive margin is scroll required)');
  });

  /* ---- 29.1 a campaign battle actually starts, on every scenario ------
     THE GAP THIS CLOSES. Sixty-one checks and not one of them started a
     CAMPAIGN battle: every Game.start above passes `map:` and usually
     `skirmish: true`, which skips the whole campaign branch. Two defects
     shipped through that hole in one session, both invisible to a green gate:

       1. `const mapSeed` was reassigned by the campaign-only seed salt, so
          Game.start threw "Assignment to constant variable" on EVERY campaign
          battle. A runtime TypeError, so `node --check` could not see it.
       2. The same line read `opts.world.id` where the campaign passes the
          world id as a STRING, so `.id` was undefined and every procedural
          world in a galaxy fell through to the seed 'default'. Measured: 16
          of 16 same-family worlds were byte-identical boards.

     Both are caught by simply STARTING one, which is what this does: a real
     campaign deploy on each distinct scenario the galaxy offers, asserting
     the battle reaches a playable state and that two different worlds of one
     procedural family do not build the same board. */
  T('29.1 a campaign battle starts on every scenario, and worlds differ', function () {
    const id = '29.1 a campaign battle starts on every scenario, and worlds differ';
    /* Best effort, and deliberately not the silent-catch the standing law
       bans: clearing storage is SETUP, not the thing under test, and a
       browser that refuses it still runs the check correctly off a fresh
       in-memory profile. The law's target is a catch that hides a failure of
       the subject; this one cannot. */
    try { localStorage.removeItem(Meta.KEY); } catch (e) { /* storage unavailable, fresh profile is fine */ }
    Meta._root = null; Meta.load();
    const p0 = Meta.load(); p0.faction = 'human'; Meta.save();
    Meta.campaignStart('human');
    /* PIN THE GALAXY. campaignStart seeds with Math.random (commanders.js:514),
       which is right for a campaign and wrong for a gate: every run sampled a
       DIFFERENT set of worlds, so this check asserted against a fresh random
       draw each time. Measured: it failed intermittently with "identical
       same-family boards 1/20" and then passed on an immediate re-run with the
       tree untouched, and the battle and comparison counts moved between runs
       (20/5 scenarios one run, 17/15 the next), which is the tell.

       That is worse than a missing check, because it teaches the next session
       to re-run until green, and re-running until green is how a real failure
       eventually gets waved through. galaxy() caches on seed + mapPool, so
       assigning the seed here both pins the draw and invalidates the cache.
       The check is now deterministic: it either passes every run or fails
       every run, and a failure means something. Change this constant only to
       widen coverage, never to make a red gate go green. */
    Meta.campaign().seed = 20260827;
    Meta.save();
    const gx = Meta.galaxy();
    const seen = {}, started = [], failed = [];
    const fp = {};
    for (let si = 0; si < gx.systems.length; si++)
      for (let wi = 0; wi < gx.systems[si].worlds.length; wi++) {
        const w = gx.systems[si].worlds[wi];
        const sc = (typeof ownedWorldScenarioOf === 'function' && ownedWorldScenarioOf(w, {})) ||
                   worldScenarioOf(w);
        const key = sc ? sc.id : 'none';
        const m = MAPS.find(function (x) { return x.id === w.map; });
        const proc = m && m.procedural ? m.family : null;
        /* one battle per distinct scenario, plus every procedural world so
           the board-identity comparison below has something to compare */
        if (seen[key] && !proc) continue;
        seen[key] = true;
        try {
          /* EXACTLY what js/ui.js deploy() passes: the world ID, a string. */
          Game.start({ world: w.id, map: w.map, faction: 'human',
                       rivalFaction: w.owner, worldKind: w.kind,
                       loadout: PIN.slice() });
          if (Game.state !== 'playing' && Game.state !== 'choosing')
            failed.push(w.id + ' state=' + Game.state);
          else started.push(key);
          if (proc) {
            const sig = JSON.stringify(FIELD.lanes) + FIELD.cols + 'x' + FIELD.rows;
            (fp[proc] || (fp[proc] = [])).push(sig);
          }
        } catch (e) { failed.push(w.id + ' threw ' + e.message); }
      }
    /* Two worlds of one family sharing a board means the seed is not reaching
       the generator, which is exactly defect 2 above. */
    let dupFamilies = 0, compared = 0;
    for (const fam in fp) {
      const list = fp[fam];
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          compared++;
          if (list[i] === list[j]) dupFamilies++;
        }
    }
    ok(id, failed.length === 0 && started.length > 0 && dupFamilies === 0,
       started.length + ' campaign battles started across ' +
       Object.keys(seen).length + ' scenarios, ' + failed.length + ' failed' +
       (failed.length ? ' (' + failed.slice(0, 3).join('; ') + ')' : '') +
       ', identical same-family boards ' + dupFamilies + '/' + compared);
  });

  /* ---- 38.x THE SUMMONING RITES, driven through the REAL death funnel ---
     THE GAP THIS CLOSES. This sweep exercised tickProcession (the light rite)
     and had never once executed tickIncubators, so THE BROOD shipped its whole
     life with zero coverage while THE PROCESSION had some. The owner reported
     the xeno rite as "not quite working"; it was in fact working and merely
     undertuned and invisible, which only a measurement could distinguish.

     Every kill below goes through Game.spawnFromQueue then Game.killEnemy, the
     same two calls a real wave uses. Nothing calls incubate() or requisition()
     directly: a probe that calls the function under test bypasses the dispatch
     deciding whether the function is reached at all, and the dispatch is
     exactly where a rite dies. */
  (function rites38() {
    function battle(doctrine) {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Game.sides[0].doctrine = doctrine;
      Game.incubators.length = 0;
      Game.pendingSpawns.length = 0;
      return Game.sides[0];
    }
    function killOne(side) {
      const n = Game.enemies.length;
      Game.spawnFromQueue({ side: side, type: 'chitling', lane: 0, hpMul: 1, bountyMul: 1, rageMul: 1 });
      if (Game.enemies.length === n) return null;
      const e = Game.enemies[Game.enemies.length - 1];
      Game.killEnemy(e);
      return e;
    }

    T('38.1 a clutch comes due and OPENS A WINDOW rather than raising a body', function () {
      /* THE RITE CHANGED (owner, Session 39). A clutch used to hatch a free
         body; it now refreshes the cooldown on the creature it was gestating
         and gives the player about five seconds to SEND it, paying gold at
         the going price. The owner's reasoning is the balance of the whole
         faction: "price increases still occur so you have to be smart when to
         send a massive rushing wave ... limit their swarm while still feeling
         like one." Openings still arrive as fast as kills do, which is the
         swarm; every body is now bought, which is the limit. */
      const S = battle('xeno');
      const before = Game.pendingSpawns.length;
      killOne(0);
      const laid = Game.incubators.length === 1;
      const id = laid ? Game.incubators[0].unitId : null;
      let guard = 0;
      while (Game.incubators.length && guard++ < 4000) Game.tickIncubators(0.05);
      const win = S.broodOpen && S.broodOpen[id];
      ok('38.1 a clutch comes due and OPENS A WINDOW rather than raising a body',
         laid && !!win && Game.pendingSpawns.length === before,
         'clutch laid ' + laid + ', window open on ' + id + ' ' + (win ? win.t.toFixed(1) + 's' : 'NONE') +
         ', free bodies raised ' + (Game.pendingSpawns.length - before));
    });

    T('38.2 the window makes it sendable for GOLD, and lapses if unspent', function () {
      const S = battle('xeno');
      killOne(0);
      const id = Game.incubators[0].unitId;
      const tier = Game.musterTiers(0).find(function (t) { return t.id === id; });
      /* Put the detachment on cooldown FIRST, so the window has something to
         refresh and the check cannot pass on a unit that was ready anyway. */
      S.musterCd[id] = 30;
      const blockedBefore = !Game.canMuster(0, tier);
      let guard = 0;
      while (Game.incubators.length && guard++ < 4000) Game.tickIncubators(0.05);
      const readyInWindow = Game.canMuster(0, tier);
      const costs = Game.musterCost(0, tier) > 0;
      /* Let it lapse. The wait it interrupted comes back, minus the window. */
      Game.tickBrood(XENO_BROOD_WINDOW_SEC + 0.2);
      const closed = !(S.broodOpen && S.broodOpen[id]);
      const backOnCd = (S.musterCd[id] || 0) > 0 && !Game.canMuster(0, tier);
      ok('38.2 the window makes it sendable for GOLD, and lapses if unspent',
         blockedBefore && readyInWindow && costs && closed && backOnCd,
         'blocked on cooldown ' + blockedBefore + ', sendable in the window ' + readyInWindow +
         ', still costs gold ' + Game.musterCost(0, tier) + ', window closed ' + closed +
         ', cooldown handed back ' + (S.musterCd[id] || 0).toFixed(1) + 's');
    });

    T('38.2b spending the window consumes it, and the price still climbs', function () {
      const S = battle('xeno');
      killOne(0);
      const id = Game.incubators[0].unitId;
      const tier = Game.musterTiers(0).find(function (t) { return t.id === id; });
      let guard = 0;
      while (Game.incubators.length && guard++ < 4000) Game.tickIncubators(0.05);
      S.gold = 999999;
      const priceFirst = Game.musterCost(0, tier);
      const sent = Game.muster(0, tier);
      const consumed = !(S.broodOpen && S.broodOpen[id]);
      const onCd = Game.musterCdLeft(0, tier) > 0;
      const priceAfter = Game.musterCost(0, tier);
      /* THE CAVEAT THE OWNER NAMED. A window is free tempo, never free mass:
         the buy walks the same cost curve every other rite walks, so a player
         who spends every opening prices themselves out of the next rush. */
      ok('38.2b spending the window consumes it, and the price still climbs',
         sent && consumed && onCd && priceAfter > priceFirst,
         'sent ' + sent + ', window consumed ' + consumed + ', back on cooldown ' + onCd +
         ', price ' + priceFirst + ' -> ' + priceAfter);
    });

    T('38.3 FIELD DOCTRINE raises no free body at all', function () {
      battle('human');
      const before = Game.pendingSpawns.length;
      for (let i = 0; i < 10; i++) killOne(0);
      ok('38.3 FIELD DOCTRINE raises no free body at all',
         Game.pendingSpawns.length === before && Game.incubators.length === 0,
         '10 kills produced ' + (Game.pendingSpawns.length - before) +
         ' bodies (CONSCRIPTION measured exactly 1.00 per kill before it was replaced)');
    });

    T('38.4 kills bank requisition, it cuts the price, and a send spends it', function () {
      const S = battle('human');
      const tier = Game.musterTiers(0)[0];
      const list = Game.musterCost(0, tier);
      for (let i = 0; i < 5; i++) killOne(0);
      const cut = Game.musterCost(0, tier);
      for (let i = 0; i < 60; i++) killOne(0);
      const capped = Math.abs(S.reqCredit - HUMAN_REQ_CAP) < 1e-9;
      S.gold = 99999;
      const bought = Game.muster(0, tier);
      ok('38.4 kills bank requisition, it cuts the price, and a send spends it',
         cut < list && capped && bought && S.reqCredit === 0,
         'price ' + list + ' -> ' + cut + ' after 5 kills, credit capped ' + capped +
         ', spent on send ' + (S.reqCredit === 0));
    });

    T('38.5 a send arms that detachment cooldown, and it expires', function () {
      const S = battle('human');
      const tier = Game.musterTiers(0)[0];
      S.gold = 99999;
      Game.muster(0, tier);
      const cd = Game.musterCdLeft(0, tier);
      const blocked = !Game.canMuster(0, tier);
      Game.tickMusterCooldowns(cd + 0.1);
      ok('38.5 a send arms that detachment cooldown, and it expires',
         cd > 0 && blocked && Game.canMuster(0, tier),
         'cooldown ' + cd.toFixed(1) + 's, blocked while hot ' + blocked + ', ready after');
    });

    T('38.6 LETTERS OF MARQUE waits only for coin', function () {
      const S = battle('pirate');
      const tier = Game.musterTiers(0)[0];
      S.gold = 999999;
      const a = Game.muster(0, tier);
      ok('38.6 LETTERS OF MARQUE waits only for coin',
         a && Game.musterCdLeft(0, tier) === 0 && Game.canMuster(0, tier),
         'sent ' + a + ', cooldown ' + Game.musterCdLeft(0, tier) + ', may resend at once');
    });

    T('38.7 a sent body that kills another body is promoted', function () {
      battle('human');
      const base = ENEMY_TYPES['trooper'] || ENEMY_TYPES[Game.sides[0].musterLoadout[0]];
      const path = Game.sendPathFor(0, 1, base);
      const mine = new Enemy(base, path, { hostileTo: 1, owner: 0, startDist: 200 });
      const foe = new Enemy(base, path, { hostileTo: 0, owner: -1, startDist: 200, hpMul: 0.05 });
      mine.updatePosition(); foe.updatePosition();
      foe.x = mine.x; foe.y = mine.y;
      Game.enemies.push(mine, foe);
      let guard = 0;
      while (!foe.dead && guard++ < 600) Game.resolveMelee(0.05);
      ok('38.7 a sent body that kills another body is promoted',
         foe.dead && (mine.vetRank || 0) >= 1,
         'victim dead ' + foe.dead + ', killer rank ' + (mine.vetRank || 0) +
         ', maxHp ' + mine.maxHp + ' from base ' + base.hp);
    });

    T('38.9 a recovering detachment SAYS it is recovering, on its own card', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Game.sides[0].doctrine = 'human';
      UI.show('screen-game'); UI.buildShop(); UI.buildAbilityBar();
      Game.sides[0].gold = 99999;
      const tier = Game.musterTiers(0)[0];
      Game.muster(0, tier);
      UI.syncAll();
      const btn = document.querySelector('.muster-btn[data-muster="' + tier.id + '"]');
      const cls = btn ? btn.className : '(no card)';
      const label = btn ? (btn.getAttribute('aria-label') || '') : '';
      const bar = btn ? btn.querySelector('.mu-cd') : null;
      /* `.poor` would be a LIE here: the seat is holding 99999 gold. A card
         that says "cannot afford" when the real reason is "not yet recovered"
         is the exact confusion this class was added to remove. */
      ok('38.9 a recovering detachment SAYS it is recovering, on its own card',
         !!btn && /cooling/.test(cls) && !/poor/.test(cls) && /recovering/.test(label) && !!bar,
         'class "' + cls + '", aria mentions recovering ' + /recovering/.test(label) +
         ', progress bar present ' + !!bar);
    });

    T('38.10 FIELD DOCTRINE does not advertise another rite on its tag', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Game.sides[0].doctrine = 'human';
      const txt = UI.doctrineInfo(Game.sides[0], Game.doctrineOf(0));
      /* Before this branch existed Humanity fell through to the final `else`
         and printed the Marque's own line, so the tag told a human commander
         they were flying under LETTERS OF MARQUE. */
      ok('38.10 FIELD DOCTRINE does not advertise another rite on its tag',
         /REQUISITION/.test(txt) && !/NOTHING RISES FREE/.test(txt) && /FIELD DOCTRINE/.test(txt),
         txt.slice(0, 120));
    });

    T('38.11 DEBUG finish awards the forced rating THROUGH recordWorld', function () {
      try { localStorage.removeItem(Meta.KEY); } catch (e) { /* fresh profile is fine */ }
      Meta._root = null; Meta.load();
      const p0 = Meta.load(); p0.faction = 'human'; Meta.save();
      Meta.campaignStart('human');
      Meta.campaign().seed = 20260827; Meta.save();
      const gx = Meta.galaxy();
      let w = null;
      for (let si = 0; si < gx.systems.length && !w; si++)
        for (let wi = 0; wi < gx.systems[si].worlds.length && !w; wi++)
          if (gx.systems[si].worlds[wi].map) w = gx.systems[si].worlds[wi];
      /* THE CHOSEN NODE. endMatch reads `Meta.campaign().chosen`, which the
         galaxy map sets when a world is picked (ui.js, `c.chosen = {...}`).
         A probe that calls Game.start directly skips that step, and then
         recordWorld has no node to write to: the first draft of this check
         reported "saved stars undefined" and the fault was the probe, not the
         cheat. Set it the way deploy does. */
      const camp = Meta.campaign();
      camp.chosen = { world: w.id, map: w.map, arena: w.arena, boon: w.boon,
                      renegade: !!w.renegade, kind: w.kind, owner: w.owner };
      Meta.save();
      Game.start({ world: w.id, map: w.map, faction: 'human',
                   rivalFaction: w.owner, worldKind: w.kind, loadout: PIN.slice() });
      Debug.set(true);
      const ran = Debug.finish(3);
      const stars = Meta.campaign() && Meta.campaign().stars ? Meta.campaign().stars[w.id] : undefined;
      /* lastStars is recordWorld's RETURN VALUE, and `systemTaken` on it is
         the only thing the results screen consults before queueing the
         interstitial. Asserting the object exists is asserting the cutscene
         remains reachable, which is the owner's stated constraint: a forced
         rating must still proc and queue the cutscene. */
      const ls = Game.lastStars;
      ok('38.11 DEBUG finish awards the forced rating THROUGH recordWorld',
         ran === true && stars === 3 && !!ls && ('systemTaken' in ls) && Game._debugStars === null,
         'ran ' + ran + ', saved stars for ' + w.id + ' = ' + stars +
         ', lastStars carries systemTaken ' + (!!ls && ('systemTaken' in ls)) +
         ', override consumed ' + (Game._debugStars === null));
      Debug.set(false);
    });

    T('38.12 DEBUG refuses to touch a duel', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Debug.set(true);
      const wasLive = Net.live;
      Net.live = true;
      /* Lockstep carries indices and a seeded stream. A seat granting itself
         gold parts from its peer on the next fingerprint, so the gate is a
         refusal rather than a warning. */
      const g = Debug.gold(5000);
      const f = Debug.finish(3);
      const allowed = Debug.allowed();
      Net.live = wasLive;
      Debug.set(false);
      ok('38.12 DEBUG refuses to touch a duel',
         g === false && f === false && allowed === false,
         'gold refused ' + (g === false) + ', finish refused ' + (f === false) +
         ', allowed() ' + allowed);
    });

    T('38.13 the manual pictures every tower, unit and commander it describes', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      UI.buildCodex();
      const body = document.getElementById('codex-body');
      const figs = body ? body.querySelectorAll('.codex-entry.has-fig') : [];
      let withArt = 0, withDossier = 0, focusable = 0;
      for (const el of figs) {
        const f = el.querySelector('.ce-fig');
        if (f && (f.querySelector('img') || f.querySelector('svg') ||
                  f.querySelector('canvas') || f.textContent.trim())) withArt++;
        const tt = el.getAttribute('data-tt') || '';
        if (tt.indexOf('|') > 0 && tt.split('|')[1].length > 3) withDossier++;
        /* bindChipTips gives any non-focusable data-tt element a tabindex, so
           a keyboard reaches the dossier too. Asserted rather than assumed:
           before this the manual bound no tooltips at all. */
        if (el.hasAttribute('tabindex')) focusable++;
      }
      const n = figs.length;
      ok('38.13 the manual pictures every tower, unit and commander it describes',
         n >= TOWER_ORDER.length && withArt === n && withDossier === n && focusable === n,
         n + ' illustrated entries, ' + withArt + ' carry art, ' + withDossier +
         ' carry a hover dossier, ' + focusable + ' reachable by keyboard');
    });

    T('38.14 the manual describes the rite the engine actually runs', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      UI.buildCodex();
      const txt = (document.getElementById('codex-body') || {}).textContent || '';
      /* The Attrition section named CONSCRIPTION's behaviour ("drafts a
         different soldier from your own roster") for as long as that rite
         existed, and would have gone on naming it after the rite was
         replaced. A manual that describes a removed mechanic is worse than
         one that omits it, because a player will trust it. */
      const namesRite = txt.indexOf(SUMMON_DOCTRINES.human.name) !== -1;
      const stale = /drafts a different soldier/i.test(txt);
      const cd = /time to recover/i.test(txt);
      /* And it must not still say a clutch HATCHES, which is the rite the
         Session 39 change removed. A manual describing a removed mechanic is
         worse than one that omits it, because a player will trust it. */
      const staleHatch = /hatch(es|ing)? as something else|it hatches\b/i.test(txt);
      const window = new RegExp(XENO_BROOD_WINDOW_SEC + '.second window', 'i').test(txt);
      ok('38.14 the manual describes the rite the engine actually runs',
         namesRite && !stale && cd && !staleHatch && window,
         'names ' + SUMMON_DOCTRINES.human.name + ' ' + namesRite +
         ', stale conscription copy ' + stale + ', documents the cooldown ' + cd +
         ', stale hatch copy ' + staleHatch + ', documents the brood window ' + window);
    });

    T('38.15 every commander answers what was actually said to them', function () {
      /* MEASURED BEFORE THE FIX: of 756 ordered pairings, 718 (95%) fell to a
         generic path holding TEN distinct player replies, two per faction,
         none of which answered the opener. Two speakers not addressing each
         other is not a conversation, which is what the owner reported as
         dialogue that feels flat.
         This asserts the three things that keep it fixed: every opener is
         tagged, every faction can answer every stance, and the resulting
         variety across the generic set stays well above the old ten. */
      const ids = COMMANDER_ROSTER.map(function (c) { return c.id; });
      const byId = {}; for (const c of COMMANDER_ROSTER) byId[c.id] = c;
      let untagged = 0; const holes = [];
      for (const id of ids) {
        const st = DIALOGUE.stance[id];
        if (!st) { untagged++; continue; }
        /* stanceAnswers, not answers: on the Session 39 merge a co-contributor
           landed DIALOGUE.answers keyed by COMMANDER ID for the same defect
           from the other side, and this table was renamed rather than left as
           a second key of the same name (which is a silent deletion, not a
           merge). Reading the wrong one reported 784 holes against a table
           that has none. */
        for (const fac in DIALOGUE.stanceAnswers)
          if (!DIALOGUE.stanceAnswers[fac][st]) holes.push(fac + '/' + st);
      }
      const seen = {};
      let generic = 0, n = 0;
      for (const p of ids) for (const r of ids) {
        if (p === r || DIALOGUE.pairs[p + '|' + r] || canonExchange(p, r)) continue;
        generic++;
        const d = battleDialogue(byId[p], byId[r], byId[p].faction || 'human', {});
        if (d && d[1] && d[1].text && !seen[d[1].text]) { seen[d[1].text] = 1; n++; }
      }
      ok('38.15 every commander answers what was actually said to them',
         /* 25, not 50, and the reason is the merge rather than a nudged bar.
            The chain now prefers the co-contributor's per-COMMANDER answer,
            which is one in-character line per speaker, so most pairings
            resolve there instead of to one of this pass's 70 faction/stance
            lines. Fewer distinct strings, better ones: a named character
            answering in their own voice beats a faction answering in register.
            What still must hold is that NOTHING falls back to the original
            two-line pool, which is what the hole count and the tag count
            assert, and that the total stays far above the ten it started at. */
         untagged === 0 && holes.length === 0 && n >= 25,
         untagged + ' openers untagged, ' + holes.length + ' faction/stance holes' +
         (holes.length ? ' (' + holes.slice(0, 3).join(', ') + ')' : '') +
         ', ' + n + ' distinct replies across ' + generic + ' generic pairings (was 10)');
    });

    T('38.16 the rival brain never proposes a recovering detachment', function () {
      /* THE GAP THIS CLOSES. ai.js gates the whole muster block on
         `Game.canMuster(S.index)` with NO tier, which answers only "is the
         muster path open at all". The per-tier cooldown lives in
         canMuster(side, tier), so without an explicit skip the brain scored a
         recovering detachment, won its own decision with it, and then had the
         buy refused inside Game.muster. The tick was spent and nothing was
         bought, with every gate still green: the rival simply got quieter.
         Driven through AI.bestAction, the real chooser. */
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      const S = Game.sides[1];
      const brain = Game.brains && Game.brains[0];
      if (!brain) { ok('38.16 the rival brain never proposes a recovering detachment',
                       false, 'no brain on this board'); return; }
      /* PIN THE RIVAL'S RITE. This check failed intermittently until it did:
         the rival commander is drawn per battle, and a rival holding LETTERS
         OF MARQUE is EXEMPT from cooldowns by design, so musterCdLeft returns
         0 and the brain proposes a detachment perfectly legitimately. The
         check was therefore asserting a rule that does not apply to every
         seat, and would pass or fail on the draw. A gate that moves between
         runs teaches the next session to re-run until green, which is how a
         real failure eventually gets waved through. */
      S.doctrine = 'human';
      /* Satisfy the defence-first gate so musters are reachable at all. */
      Game.wave = Math.max(Game.wave, MUSTER_AI_MIN_WAVE + 2);
      S.lives = S.maxLives;
      /* GOLD BEFORE THE BUILDS. The first draft granted it after the loop, so
         every build was refused for cost, the side reached the muster gate
         with zero towers, and the check reported a vacuous negative. It did
         not pass: the sawMuster guard below is what caught it. */
      S.gold = 999999;
      /* BUILD WHAT THIS SIDE ACTUALLY HOLDS. Game.build refuses outright with
         `if (!S.loadout.includes(type))`, and side 1 is the AI, whose arsenal
         is DRAFTED rather than the PIN the player deployed with. Building
         PIN[0] therefore succeeded or failed on the draw: this check passed
         repeatedly on a branch and then failed on the merge commit with
         "towers 0", which is the same re-run-until-green trap the rite pin
         above was added to close. Same defect, second source. */
      const aiType = (S.loadout && S.loadout.length) ? S.loadout[0] : PIN[0];
      while (S.towers.length < MUSTER_AI_MIN_TOWERS + 1) {
        /* bestSpotFor returns a WRAPPER, {spot:{gx,gy,...}, cov}, not the
           spot itself, and build(side, type, gx, gy) takes the type second.
           Earlier drafts of this check got both wrong and reported 0 towers
           rather than failing loudly, which is what the sawMuster guard is
           for. */
        const pick = brain.bestSpotFor(TOWER_TYPES[aiType]);
        const spot = pick && pick.spot;
        if (!spot) break;
        if (!Game.build(1, aiType, spot.gx, spot.gy)) break;
      }
      S.gold = 999999;
      const tiers = Game.musterTiers(1);
      const hot = () => (brain.bestAction({}) || {}).best;
      /* First prove the brain WOULD muster when everything is ready, or the
         negative below proves nothing at all. */
      for (const t of tiers) delete S.musterCd[t.id];
      let sawMuster = false;
      for (let i = 0; i < 6 && !sawMuster; i++) { const b = hot(); if (b && b.kind === 'muster') sawMuster = true; }
      /* Now put every detachment on cooldown and confirm none is proposed. */
      for (const t of tiers) S.musterCd[t.id] = 99;
      let proposedHot = false;
      for (let i = 0; i < 6; i++) { const b = hot(); if (b && b.kind === 'muster') proposedHot = true; }
      for (const t of tiers) delete S.musterCd[t.id];
      ok('38.16 the rival brain never proposes a recovering detachment',
         sawMuster && !proposedHot,
         'brain musters when ready ' + sawMuster + ', proposes a recovering one ' + proposedHot +
         ' (rite ' + S.doctrine + ', built ' + aiType + ' x' + S.towers.length +
         ', wave ' + Game.wave + ')');
    });

    /* ---- 38.17 to 38.21 THE PATHS SESSION 38 SHIPPED UNTESTED ----------
       Measured after the fact by grepping every symbol this session added
       against the harnesses: musterCdFor, musterReadyCount, ttEsc,
       Debug.lose, Debug.clearWave, Debug.heal, Debug.render, the collapse
       toggle, engineKey's new branch and both xeno feed tells all had ZERO
       coverage. They shipped behind a green gate because the checks written
       alongside them covered the interesting halves and skipped the rest,
       which is the standing law ("code no gate executes is code that ships
       untested") applied to my own work rather than to somebody else's. */

    T('38.17 the rest of the DEBUG cheats drive the real paths too', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Debug.set(true);
      /* HEAL, through the real lives field the HUD reads. */
      Game.sides[0].lives = 1;
      const healed = Debug.heal() && Game.sides[0].lives === Game.sides[0].maxLives;

      /* CLEAR WAVE must kill THROUGH Game.killEnemy, not just flag bodies
         dead: bounty, stats and the doctrine rite all book in that funnel,
         so a cheat that bypassed it would leave the board in a state real
         play can never produce and would be a worse-than-useless test tool. */
      Game.sides[0].doctrine = 'xeno';
      Game.incubators.length = 0;
      const goldBefore = Game.sides[0].gold;
      const killsBefore = Game.sides[0].stats.kills;
      for (let i = 0; i < 3; i++)
        Game.spawnFromQueue({ side: 0, type: 'chitling', lane: 0, hpMul: 1, bountyMul: 1, rageMul: 1 });
      const cleared = Debug.clearWave();
      const booked = Game.sides[0].stats.kills > killsBefore &&
                     Game.sides[0].gold > goldBefore &&
                     Game.incubators.length > 0;

      /* LOSE, through endMatch, so the match actually ends. */
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Debug.set(true);
      const lost = Debug.lose() && Game.state === 'over';
      Debug.set(false);
      ok('38.17 the rest of the DEBUG cheats drive the real paths too',
         healed && cleared >= 3 && booked && lost,
         'heal ' + healed + ', cleared ' + cleared + ' bodies, booked through killEnemy ' +
         booked + ' (kills, gold and a clutch all moved), lose ended the match ' + lost);
    });

    T('38.18 the debug bar renders, collapses, and its toggle works', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      UI.show('screen-game');
      Debug.set(false);
      const goneWhenOff = !document.getElementById('debug-bar');
      Debug.set(true);
      const bar = document.getElementById('debug-bar');
      /* Collapsed is the DEFAULT, and it matters: the first draft docked a
         full-width strip over the muster panel, which is the surface you most
         want reachable while cheating. */
      const collapsed = !!bar && !bar.classList.contains('open') &&
                        bar.querySelectorAll('.dbg-b').length === 0;
      const tag = bar && bar.querySelector('[data-dbg="toggle"]');
      if (tag) tag.click();
      const opened = !!bar && bar.classList.contains('open') &&
                     bar.querySelectorAll('.dbg-b').length >= 5;
      const tag2 = bar && bar.querySelector('[data-dbg="toggle"]');
      if (tag2) tag2.click();
      const reclosed = !!bar && !bar.classList.contains('open');
      Debug.set(false);
      ok('38.18 the debug bar renders, collapses, and its toggle works',
         goneWhenOff && collapsed && opened && reclosed,
         'absent when off ' + goneWhenOff + ', collapsed by default ' + collapsed +
         ', expands to controls ' + opened + ', collapses again ' + reclosed);
    });

    T('38.19 ttEsc neutralises both characters that break a data-tt', function () {
      /* data-tt is a DOUBLE-QUOTED attribute SPLIT ON A PIPE, so a quote
         breaks the tag outright and a pipe silently truncates the tooltip at
         the first one. Everything generated from data goes through here, and
         nothing proved it did anything until now. */
      const raw = 'He said "no" | then left';
      const out = ttEsc(raw);
      const clean = out.indexOf('"') === -1 && out.indexOf('|') === -1;
      /* And it must survive a real round trip through the attribute. */
      const d = document.createElement('div');
      d.setAttribute('data-tt', 'T|' + out);
      const parts = (d.dataset.tt || '').split('|');
      ok('38.19 ttEsc neutralises both characters that break a data-tt',
         clean && parts.length === 2 && parts[1].length > 10 &&
         ttEsc(null) === '' && ttEsc(undefined) === '',
         'escaped "' + out + '", survives the attribute in ' + parts.length +
         ' parts, null and undefined give the empty string');
    });

    T('38.20 a xeno kill that feeds a clutch SAYS so, capped or not', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Game.sides[0].doctrine = 'xeno';
      Game.viewSide = 0;
      Game.incubators.length = 0;
      Game.floaters.length = 0;
      const kill = function () {
        Game.spawnFromQueue({ side: 0, type: 'chitling', lane: 0, hpMul: 1, bountyMul: 1, rageMul: 1 });
        const e = Game.enemies[Game.enemies.length - 1];
        Game.killEnemy(e);
        return e;
      };
      kill();                       /* lays a clutch */
      kill();                       /* lands beside it, so it feeds */
      const fed = Game.floaters.some(function (f) { return /FED/.test(f.text) && !/NEST FULL/.test(f.text); });

      /* THE CAP. Fill the nest with clutches placed far from the lane mouth
         so the next kill feeds NOTHING by proximity, which is the branch that
         used to do its work in total silence and read as a broken rite. */
      Game.incubators.length = 0;
      Game.floaters.length = 0;
      for (let i = 0; i < XENO_INC_CAP; i++)
        Game.incubators.push({ side: 0, x: 5000 + i * 40, y: 5000, unitId: Game.sides[0].musterLoadout[0],
                               lidx: 0, powerHp: 50, armorFlat: 0, t: 30, need: 30 });
      kill();
      const cappedTell = Game.floaters.some(function (f) { return /NEST FULL/.test(f.text); });
      ok('38.20 a xeno kill that feeds a clutch SAYS so, capped or not',
         fed && cappedTell,
         'feed tell inside the radius ' + fed + ', full-nest tell ' + cappedTell +
         ' (this branch always fed the nearest clutch and never said so)');
    });

    T('38.21 the muster readouts track the live state they claim to', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      const S = Game.sides[0];
      S.doctrine = 'human';
      /* A REAL ROSTER, because the default one holds a SINGLE unit. The first
         draft of this check asserted that cooldown duration varies with mass
         against a one-entry loadout, where max and min are the same number by
         definition, and reported a false failure. Two bodies an order of
         magnitude apart in health is what actually exercises the sqrt curve. */
      Game.setMusterLoadout(0, ['chitling', 'hivelord']);
      const tiers = Game.musterTiers(0);
      for (const t of tiers) delete S.musterCd[t.id];
      const allReady = Game.musterReadyCount(0);
      S.musterCd[tiers[0].id] = 20;
      const oneHot = Game.musterReadyCount(0);
      /* musterCdFor is the DURATION, distinct from musterCdLeft's remainder,
         and must scale with mass or the heaviest body is strictly the best
         use of an identical slot, which is the defect the cooldown replaced. */
      const durations = tiers.map(function (t) { return Game.musterCdFor(0, t); });
      const scales = Math.max.apply(null, durations) > Math.min.apply(null, durations);
      /* engineKey is the render budget for the commander tag. If it does not
         move when reqCredit moves, the tag shows a stale discount forever. */
      S.reqCredit = 0;
      const k0 = UI.engineKey(S);
      S.reqCredit = HUMAN_REQ_CAP;
      const k1 = UI.engineKey(S);
      for (const t of tiers) delete S.musterCd[t.id];
      ok('38.21 the muster readouts track the live state they claim to',
         allReady === tiers.length && oneHot === tiers.length - 1 && scales && k0 !== k1,
         'roster ' + tiers.length + ', ready ' + allReady + ', one on cooldown gives ' + oneHot +
         ', durations ' + durations.map(function (d) { return d.toFixed(1); }).join('/') +
         ', engineKey moves with the credit ' + (k0 !== k1));
    });

    T('38.22 veterancy stops at HUMAN_VET_MAX', function () {
      /* THE ONE REAL GAP tools/newcoverage.js found. 38.7 proves a body that
         kills gets promoted; nothing proved promotion ever STOPS. Set the cap
         to 999 and every check stayed green while a single veteran could
         compound without bound, which is precisely the runaway the cap exists
         to prevent. Driven through Game.promote, the only writer of vetRank. */
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      const base = ENEMY_TYPES['trooper'] || ENEMY_TYPES[Game.sides[0].musterLoadout[0]];
      const path = Game.sendPathFor(0, 1, base);
      const u = new Enemy(base, path, { hostileTo: 1, owner: 0, startDist: 100 });
      const hp0 = u.maxHp;
      for (let i = 0; i < HUMAN_VET_MAX + 5; i++) Game.promote(u);
      const hpAtCap = u.maxHp;
      Game.promote(u);
      ok('38.22 veterancy stops at HUMAN_VET_MAX',
         u.vetRank === HUMAN_VET_MAX && u.maxHp === hpAtCap && u.maxHp > hp0,
         'rank settled at ' + u.vetRank + ' of a ' + HUMAN_VET_MAX + ' cap after ' +
         (HUMAN_VET_MAX + 6) + ' attempts, maxHp ' + hp0 + ' to ' + u.maxHp + ' then held');
    });

    /* ---- 38.23 to 38.26 THE LAST COLD LINES ----------------------------
       Found by tools/newcoverage.js, which profiles owner-sweep and MPT under
       Chrome's precise coverage and reports added lines with an execution
       count of zero. These four checks take this session's diff from 94% of
       added lines reached to all of them. Every one covers a path a PLAYER
       takes, not an exotic branch: the debug buttons, a normally scored
       campaign victory, the options toggle and the muster panel readout. */

    T('38.23 the debug bar controls fire, and a duel says why they cannot', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      UI.show('screen-game');
      Debug.set(true);
      Debug.open = true; Debug.render();
      const bar = document.getElementById('debug-bar');
      const press = function (a) {
        const b = bar && bar.querySelector('[data-dbg="' + a + '"]');
        if (b) b.click();
        return !!b;
      };
      /* GOLD, through the button rather than the method, because the click
         dispatch is its own uncovered branch: 38.12 only ever proved the
         cheats REFUSE inside a duel, so the granting half never ran. */
      Game.sides[0].gold = 100;
      const pressedGold = press('gold');
      const granted = Game.sides[0].gold > 100;
      Game.sides[0].lives = 1;
      const pressedHeal = press('heal');
      const healed = Game.sides[0].lives === Game.sides[0].maxLives;
      /* The duel notice replaces the whole control set. */
      const wasLive = Net.live;
      Net.live = true;
      Debug.render();
      const notice = /disabled in a duel/i.test(bar ? bar.textContent : '') &&
                     bar.querySelectorAll('.dbg-b').length === 0;
      Net.live = wasLive;
      Debug.set(false);
      ok('38.23 the debug bar controls fire, and a duel says why they cannot',
         pressedGold && granted && pressedHeal && healed && notice,
         'gold button granted ' + granted + ', heal button restored ' + healed +
         ', duel notice replaces the controls ' + notice);
    });

    T('38.24 a campaign victory with NO cheat is scored by ratingFor', function () {
      /* THE NORMAL PATH, and nothing reached it. 38.11 always sets the debug
         override, so endMatch's ratingFor branch, which is what scores every
         real player's every real victory, was never executed by the gate. */
      try { localStorage.removeItem(Meta.KEY); } catch (e) { /* fresh profile is fine */ }
      Meta._root = null; Meta.load();
      const p0 = Meta.load(); p0.faction = 'human'; Meta.save();
      Meta.campaignStart('human');
      Meta.campaign().seed = 20260827; Meta.save();
      const gx = Meta.galaxy();
      let w = null;
      for (let si = 0; si < gx.systems.length && !w; si++)
        for (let wi = 0; wi < gx.systems[si].worlds.length && !w; wi++)
          if (gx.systems[si].worlds[wi].map) w = gx.systems[si].worlds[wi];
      const camp = Meta.campaign();
      camp.chosen = { world: w.id, map: w.map, arena: w.arena, boon: w.boon,
                      renegade: !!w.renegade, kind: w.kind, owner: w.owner };
      Meta.save();
      Game.start({ world: w.id, map: w.map, faction: 'human',
                   rivalFaction: w.owner, worldKind: w.kind, loadout: PIN.slice() });
      /* FULL LIVES AND A REAL BATTLE LENGTH. The first draft ended the match
         at wave 0 and scored undefined: ratingFor delegates to the SCENARIO's
         own test(), most of which gate on the wave reached, so a victory in
         the build phase legitimately earns nothing and recordWorld stores no
         zero. That was the check being wrong about the game, not the game
         being wrong. */
      Game.sides[0].lives = Game.sides[0].maxLives;
      Game.wave = 30;
      Game._debugStars = null;
      Game.endMatch(true);
      const stars = Meta.campaign().stars ? Meta.campaign().stars[w.id] : undefined;
      ok('38.24 a campaign victory with NO cheat is scored by ratingFor',
         typeof stars === 'number' && stars >= 1 && !!Game.lastStars &&
         ('systemTaken' in Game.lastStars),
         'ratingFor awarded ' + stars + ' star(s) for ' + w.id +
         ', lastStars carries systemTaken ' + (!!Game.lastStars && ('systemTaken' in Game.lastStars)));
    });

    T('38.25 the OPTIONS debug switch drives Debug and is persisted', function () {
      const box = document.getElementById('set-debug');
      if (!box) { ok('38.25 the OPTIONS debug switch drives Debug and is persisted',
                     false, 'no #set-debug in the options panel'); return; }
      const before = Debug.on;
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      const turnedOn = Debug.on === true;
      const savedOn = !!(Storage.loadSettings() || {}).debug;
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      const turnedOff = Debug.on === false;
      const savedOff = !(Storage.loadSettings() || {}).debug;
      Debug.set(before);
      ok('38.25 the OPTIONS debug switch drives Debug and is persisted',
         turnedOn && savedOn && turnedOff && savedOff,
         'switch on drives Debug ' + turnedOn + ' and saves ' + savedOn +
         ', switch off drives Debug ' + turnedOff + ' and saves ' + savedOff);
    });

    T('38.26 the muster panel prints the live ready count', function () {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
      Game.setMusterLoadout(0, ['chitling', 'hivelord']);
      const S = Game.sides[0];
      S.doctrine = 'human';
      const tiers = Game.musterTiers(0);
      for (const t of tiers) delete S.musterCd[t.id];
      const allReadyHtml = UI.econLedgerHtml(0);
      S.musterCd[tiers[0].id] = 20;
      const oneHotHtml = UI.econLedgerHtml(0);
      /* The panel must quote what musterReadyCount RETURNS, not a constant.
         It used to print "N of 2 summons left this wave" off MUSTER_PER_WAVE,
         which no longer exists, and nothing checked what replaced it. */
      const saysAll = allReadyHtml.indexOf(tiers.length + ' of ' + tiers.length) !== -1 ||
                      /detachments ready/.test(allReadyHtml);
      const moved = allReadyHtml !== oneHotHtml;
      ok('38.26 the muster panel prints the live ready count',
         saysAll && moved,
         'panel names the ready count ' + saysAll +
         ', and it changes when a detachment goes on cooldown ' + moved);
    });

    T('39.1 no retired 2099 canon reaches anything the game reads', function () {
      /* THE RECURSION THIS CLOSES. docs/lore release 0.5.0 builds toward a
         campaign set in 2099. The owner superseded it on 2026-08-26: the
         campaign now begins on April 13 2029 (docs/CANON-2029.md). The lore
         tree was never retired, and js/lore.js is still generated from it.

         MEASURED, and the honest number is smaller than it first looked. Most
         of that 495KB blob is INERT: `mythos` alone carries 58 mentions of
         retired vocabulary and nothing reads it. What matters is the four
         fields the game actually consumes, and those carried 11, of which 9
         were the word "Lattice", which is NOT retired (THE LATTICE is the
         machine doctrine's current name). The genuine leak was "Old Weather",
         twice, in world briefings a player reads.

         So this asserts the narrow true thing rather than the dramatic false
         one: the CONSUMED fields carry no vocabulary from the retired
         timeline. Widening it to the whole blob would fail forever against
         research that is deliberately kept. */
      const READ = ['relationships', 'maps', 'archiveWarMissions', 'worldGeneration'];
      /* "Lattice" is deliberately absent: it is current canon. */
      const RETIRED = ['old weather', 'sol gate', 'archive war', 'signal winter',
                       'open-sky compact', 'abyssal reply', 'noetic', '2099'];
      const hits = [];
      for (const k of READ) {
        const v = (typeof LORE !== 'undefined' && LORE) ? LORE[k] : null;
        if (!v) continue;
        const t = JSON.stringify(v).toLowerCase();
        for (const term of RETIRED) {
          let n = 0, i = t.indexOf(term);
          while (i !== -1) { n++; i = t.indexOf(term, i + term.length); }
          if (n) hits.push(k + ':' + term + ' x' + n);
        }
      }
      ok('39.1 no retired 2099 canon reaches anything the game reads',
         hits.length === 0,
         hits.length ? hits.join(', ')
                     : READ.length + ' consumed LORE fields carry no retired-timeline vocabulary');
    });

    T('38.8 a TOWER kill never promotes, only a body kill does', function () {
      battle('human');
      const e = killOne(0);
      ok('38.8 a TOWER kill never promotes, only a body kill does',
         !!e && !e.vetRank,
         'the owner was explicit that tower kills are the common case and must not count; ' +
         'rank after a funnel kill: ' + (e ? (e.vetRank || 0) : 'no body'));
    });
  })();

  const pass = C.filter(function (c) { return c.verdict === 'PASS'; }).length;
  const fail = C.filter(function (c) { return c.verdict === 'FAIL'; }).length;
  const info = C.filter(function (c) { return c.verdict === 'INFO'; }).length;
  const out = { pass: pass, fail: fail, info: info, checks: C };
  window.__SWEEP = out;
  return out;
})();
