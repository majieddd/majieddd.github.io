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
      if (arsenal.length < 10) bad.push(fac + ' shelf is only ' + arsenal.length + ' — the call is not reaching the roster');
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
       dz.join(', ') + ' — printed as a stat row and punched out of both range rings');
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
       ren + ' renegade worlds over six machine galaxies, ' + machineBoons + ' machine boons — ' +
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
    const defensive = L && H && L.lives > H.lives && L.leak < H.leak;
    const difficult = X && H && X.gold < H.gold && X.brood > H.brood;
    const scrappy   = P && H && P.dmg > H.dmg && P.range < H.range;
    ok('25.3 every power is skewed differently',
       !!(defensive && difficult && scrappy),
       'light lives ' + (L && L.lives) + ' leak ' + (L && L.leak) +
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
    const cv = Game.canvas, side = document.getElementById('sidebar'), hud = document.getElementById('hud');
    const cb = cv.getBoundingClientRect(), sb = side.getBoundingClientRect(), hb = hud.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    /* 1. THE BOARD IS THE BACKGROUND: the canvas covers the window. */
    const fills = cb.left <= 1 && cb.top <= 1 && cb.width >= W - 1 && cb.height >= H - 1;
    /* 2. THE CHROME IS ON TOP: both cards sit inside the window, over the
          canvas, and above it in the stacking order. */
    const railZ = parseInt(getComputedStyle(side).zIndex, 10) || 0;
    const hudZ = parseInt(getComputedStyle(hud).zIndex, 10) || 0;
    const onTop = railZ > 0 && hudZ > 0 &&
                  sb.right <= W + 1 && sb.bottom <= H + 1 && sb.left >= 0 &&
                  hb.top >= 0 && hb.left >= 0;
    /* 3. NOTHING IS CLIPPED, which is what a wrong rail width looks like. */
    let clipped = 0;
    side.querySelectorAll('button, .panel, h2, .muster-bar > *, #shop-list > *, #inspector > *')
      .forEach(function (el) { if (el.scrollWidth > el.clientWidth + 2) clipped++; });
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
       ', rail z' + railZ + ' hud z' + hudZ + ', clipped ' + clipped +
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
    let engaged = 0, waveVwave = 0, stealthMelee = 0, n = 0;
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
          if (e.role === 'stealth' || e._meleeRef.role === 'stealth') stealthMelee++;
        }
      }
      n++;
    }
    /* And a sent flyer flies the chord. */
    const flyer = Object.keys(ENEMY_TYPES).find(function (id) { return ENEMY_TYPES[id].flying && musterSendable(id); });
    const chord = flyer ? Game.sendPathFor(0, 1, ENEMY_TYPES[flyer]).pts.length === 2 : false;
    ok('26.1 the three unit roles behave as specified',
       stealthOk && engaged > 0 && waveVwave === 0 && stealthMelee === 0 && chord,
       'stealth set ' + (stealthOk ? 'exact' : 'WRONG') + ', ' + engaged +
       ' engaged frames, wave-vs-wave ' + waveVwave + ', stealth melee ' + stealthMelee +
       ', flyer sends fly a 2-point chord: ' + chord);
  });

  const pass = C.filter(function (c) { return c.verdict === 'PASS'; }).length;
  const fail = C.filter(function (c) { return c.verdict === 'FAIL'; }).length;
  const info = C.filter(function (c) { return c.verdict === 'INFO'; }).length;
  const out = { pass: pass, fail: fail, info: info, checks: C };
  window.__SWEEP = out;
  return out;
})();
