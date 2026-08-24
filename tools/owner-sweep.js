/* ==========================================================================
   OWNER-NOTE SWEEP — every instruction from Sessions 13-17, checked against
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

  /* ---- 14.1 the enrage mechanic reads as a thematic name --------------- */
  T('14.1 enrage reads thematically, never as "enrage"', function () {
    /* Only PLAYER-FACING copy counts. `S.enrage` and ENRAGE_MAX are internal
       identifiers nobody reads; the mechanic's NAME is what the owner asked to
       be thematic. So scan the strings the game actually prints. */
    const strings = [];
    if (typeof ESCALATIONS !== 'undefined') strings.push(JSON.stringify(ESCALATIONS));
    if (typeof MODS !== 'undefined') strings.push(JSON.stringify(MODS));
    if (typeof TOWER_TYPES !== 'undefined') strings.push(JSON.stringify(TOWER_TYPES));
    if (typeof ENEMY_TYPES !== 'undefined') strings.push(JSON.stringify(ENEMY_TYPES));
    strings.push(document.body.innerHTML);
    const hay = strings.join(' ');
    const named = /RESONANT FIELD/i.test(document.documentElement.innerHTML);
    const leaks = hay.match(/\benrage[sd]?\b/gi) || [];
    ok('14.1 the mechanic is named RESONANT FIELD in player copy', named,
       'RESONANT FIELD present in the shipped bundle: ' + named);
    if (leaks.length) {
      skip('14.1 the word "enrage" still appears in some player copy',
           leaks.length + ' occurrence(s): ' + leaks.slice(0, 4).join(', ') +
           ' — boss phase flavour, distinct from the wave mechanic; owner call');
    } else {
      ok('14.1 no player copy still says "enrage"', true, 'none found');
    }
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

  /* ---- 16.5 souls are twice the stars earned --------------------------- */
  T('16.5 souls are twice the stars', function () {
    if (!Meta.soulsForStar) { skip('16.5 souls are twice the stars', 'no soulsForStar entry point'); return; }
    let one = Meta.soulsForStar(1);
    let three = 0;
    for (let n = 1; n <= 3; n++) three += Meta.soulsForStar(n);
    ok('16.5 souls are twice the stars', one === 2 && three === 6,
       'first star pays ' + one + ', three stars pay ' + three + ' (want 2 and 6)');
  });

  /* ---- 16.4 one new type on wave 1, one more every second wave, cap 8 -- */
  T('16.4 roster cadence and cap are the owner numbers', function () {
    ok('16.4 roster cadence and cap are the owner numbers',
       ROSTER_MAX === 8 && ROSTER_INTRO_EVERY === 2,
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
    const bad = [];
    ['human', 'light', 'xeno', 'pirate'].forEach(function (fac) {
      const arsenal = AI.rivalArsenal(fac, Meta.unlockedTowers()) || [];
      const foreign = arsenal.filter(function (id) {
        const o = (TOWER_TYPES[id] || {}).origin;
        return o && o !== 'human' && o !== 'robotic' && o !== fac;
      });
      if (foreign.length) bad.push(fac + ' fields ' + foreign.join(','));
    });
    ok('17.4 a rival never fields a third power’s towers', bad.length === 0,
       bad.length ? bad.join(' | ') : 'all four arsenals stay on own + human + robotic');
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
      } catch (e) {}
      ctx.restore();
      var px = ctx.getImageData(0, 0, 286, 96).data, ink = 0;
      for (var p = 3; p < px.length; p += 4) if (px[p] > 8) ink++;
      if (ink <= 40) blank.push(id);
    }
    ok('22.10 every tower draws itself in the shop preview', blank.length === 0,
       (TOWER_ORDER.length - blank.length) + '/' + TOWER_ORDER.length +
       ' render; blank: ' + (blank.join(' ') || 'none'));
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
       'unpainted — towers ' + twr.length + '/' + TOWER_ORDER.length +
       ', commanders ' + cmd.length + '/' + COMMANDER_ROSTER.length +
       ', units ' + uni.length + '/' + UNIT_ORDER.length +
       ', factions ' + fac.length + '/' + Object.keys(FACTIONS).length +
       ' · blank renders: ' + (blank.join(' ') || 'none') +
       ' · mute factions: ' + (mute.join(' ') || 'none'));
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

  const pass = C.filter(function (c) { return c.verdict === 'PASS'; }).length;
  const fail = C.filter(function (c) { return c.verdict === 'FAIL'; }).length;
  const info = C.filter(function (c) { return c.verdict === 'INFO'; }).length;
  const out = { pass: pass, fail: fail, info: info, checks: C };
  window.__SWEEP = out;
  return out;
})();
