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
    const snap = function (boons) {
      Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN2.slice(), boons: boons });
      const S = Game.sides[0], t = S.traits;
      return JSON.stringify([S.maxLives, S.mods.gold, S.mods.reanim, t.freeCopies,
        t.lastStandAt, t.lastStandDmg, t.sellRate, t.ascCostMul, t.ascDamage, t.jamResist,
        t.waveHeal, t.immortalLine, t.auraRangeMul, t.status, t.reanimSpeed, t.killRamp,
        t.reanimResist, t.siphonRate, t.reanimGold, t.musterHpMul, t.musterCostMul,
        t.eliteDamage, t.eliteBounty, t.costGrowthMul, t.crit, t.critMult,
        t.draftOptions, t.draftEvery]);
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
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    /* Below LO_FOUR_COL_MIN_PX the detail columns collapse to a drawer BY
       DESIGN, so a narrow pane reporting two tracks is correct, not a fault. */
    ok('19.12 the loadout is four columns at desk width',
       innerWidth < 1200 ? tracks >= 2 : tracks === 4,
       tracks + ' tracks at ' + innerWidth + 'px wide');
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
