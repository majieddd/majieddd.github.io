/* ==========================================================================
   MULTIPLAYER — the duel relay, measured.

   Paste into the console of a SERVED, cache-busted build (aegis-protocol.html
   ?v=N, or index.html after `node build.js`), then:

       MPT.all()                 // every check, ~20s
       MPT.determinism(3600)     // the long one on its own (one minute of play)

   Every check here measures BEHAVIOUR through the real code path. Nothing
   asserts that a symbol exists: symbols existing is how five inert talents
   and a whole inert boon system passed review on this project.

   The headline check is `twoClients`. It runs the SAME seed and the SAME
   input log twice -- once as seat 0 and once as seat 1, which is exactly what
   the two windows of a real duel are -- and compares the full simulation
   state, not a hash of part of it. If the seat lens, the per-tick generator
   or the cosmetic isolation were wrong, that check is where it shows.

   Mutates game state. Reload before playing.
   ========================================================================== */
const MPT = (function () {

  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 240) });
  const info = (id, detail) => C.push({ id: id, verdict: 'INFO', detail: String(detail).slice(0, 240) });
  const T = (id, fn) => { try { fn(); } catch (e) { ok(id, false, 'THREW ' + e.message + ' | ' + (e.stack || '').split('\n')[1]); } };

  /* ---------------------------------------------------------------- rig -- */

  const SEED = 0x5eed1234;

  /* The board a duel test measures must not be decided by the save file this
     browser happens to hold. contract() read Meta.unlockedTowers(), so on a
     fresh profile -- STARTER_TOWERS is ['bolt'] -- both commanders fielded a
     ONE-TOWER loadout, and the same suite that passes on a maxed profile
     failed on a clean one. Pinned ids are the only version of this that means
     anything twice: Game.build gates on S.loadout alone (game.js:1266) and
     never on the unlock shelf, and beginMatch overwrites S.loadout out of the
     contract (net.js beginMatch), so a pin needs no unlocks to be legal. */
  const PIN_LOADOUT = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  const PIN_MUSTER = ['crawler'];

  /** A duel contract that does not need a second window. */
  function contract(seed) {
    const seat = (cmdId, fac) => ({
      name: 'TEST', faction: fac, commander: cmdId,
      loadout: PIN_LOADOUT.slice(),
      muster: PIN_MUSTER.slice(),
      talents: {}, prestige: 0, tech: [], second: false
    });
    return {
      seed: seed >>> 0,
      world: { id: 'test', name: 'TEST WORLD', map: MAPS[0].id, kind: 'core', owner: 'xeno', arena: null },
      map: MAPS[0].id,
      difficulty: NET_DUEL_DIFFICULTY,
      seats: [seat(COMMANDERS[0].id, 'human'), seat(COMMANDERS[1].id, 'xeno')]
    };
  }

  /** Start a duel on this client with a ghost peer: no wire, no messages. */
  function openMatch(cfg, seat) {
    Net._ghost = true;
    Net._realCh = Net.ch;
    Net.ch = null;                       // post() becomes a no-op
    Net.peer = { id: 'ghost', name: 'GHOST' };
    Net.cfg = cfg;
    Net.beginMatch(seat);
  }

  function closeMatch() {
    Net.live = false;
    Net.lens.on = false;
    Net.phase = 'idle';
    Net.peer = null;
    if (Net._realCh !== undefined) { Net.ch = Net._realCh; Net._realCh = undefined; }
    Net._ghost = false;
    Game.state = 'menu';
  }

  /* An action names the TURN it must execute on, so the same log can be
     driven from the local input path in one run and injected as a remote
     packet in the other -- which is the only way the two runs are the same
     input log rather than two similar ones. */
  function record(a) {
    switch (a.act) {
      case 'build':  return { k: 'b', side: a.seat, type: a.type, gx: a.gx, gy: a.gy };
      case 'muster': return { k: 'm', side: a.seat, tier: a.tier };
      case 'base':   return { k: 'l', side: a.seat };
      case 'rage':   return { k: 'e', side: a.seat };
      case 'up':     return { k: 'u', gx: a.gx, gy: a.gy, branch: -1 };
      case 'sell':   return { k: 's', gx: a.gx, gy: a.gy };
      case 'abil':   return { k: 'a', i: a.i, gx: a.gx === undefined ? -1 : a.gx,
                                              gy: a.gy === undefined ? -1 : a.gy };
    }
    return null;
  }

  /** Drive the action through the REAL local entry point the UI would use. */
  function issueLocal(a) {
    switch (a.act) {
      case 'build':  Game.build(0, a.type, a.gx, a.gy); break;
      case 'muster': Game.muster(0, a.tier); break;
      case 'base':   Game.buyBaseLevel(0); break;
      case 'rage':   Game.buyEnrage(); break;
      case 'up':     { const t = Game.towerAt(a.gx, a.gy); if (t) Game.upgrade(t); break; }
      case 'sell':   { const t = Game.towerAt(a.gx, a.gy); if (t) Game.sell(t); break; }
      /* The global useAbility is the one entry point both the aimed and the
         unaimed kind pass through, and so the one place the relay catches
         them. armAbility only ARMS an aimed ability -- it issues nothing --
         so driving the log through it would have put a command in one run
         and nothing in the other. */
      case 'abil':   useAbility(Game.sides[0], Game, a.i,
                                a.gx === undefined ? undefined : { gx: a.gx, gy: a.gy }); break;
    }
  }

  /**
   * Run one client of a duel for `ticks` ticks. `log` is the whole match's
   * input, for both seats; whichever seat this client holds is issued through
   * the local path, and the other arrives as a packet.
   */
  function runClient(cfg, seat, log, ticks, trace, opts) {
    opts = opts || {};
    openMatch(cfg, seat);
    /* A duel test that cannot afford its own opening is a test of poverty.
       Six towers plus an upgrade cost more than the starting purse, so four of
       the six builds in the log were refused for gold and the two-tower board
       that survived could not kill a single wave unit. The grant is IDENTICAL
       on both seats and on both clients, so it buys reachability and costs
       nothing in determinism. */
    if (opts.gold) { Net._realSides[0].gold = opts.gold; Net._realSides[1].gold = opts.gold; }
    const byTurn = {};
    for (const a of log) (byTurn[a.turn] = byTurn[a.turn] || []).push(a);

    let guard = 0;
    while (Net.tick < ticks && Game.state !== 'over' && guard++ < ticks * 6) {
      /* Game.loop only steps while the state is `playing`, and this stands in
         for Game.loop. Stepping a halted board is the difference between a
         test of the engine and a test of something else -- and it desynced by
         exactly one tick when this rig got it wrong. */
      if (Game.state !== 'playing') {
        /* Both commanders draft, and the halted frame is where they do it.
           Answering with the first card is part of the fixed input log: two
           clients given the same log must land in the same place. */
        let answered = false;
        for (const s of [0, 1]) if (Net.offers[s]) { Net.applyOob({ k: 'd', seat: s, pick: 0 }); answered = true; }
        if (!answered) break;
        continue;
      }
      const turn = Net.turn;
      /* the remote seat's packet for the turn about to run */
      const box = (Net.inbox[turn] = Net.inbox[turn] || [null, null]);
      if (!box[1 - seat]) {
        /* `deaf` is the OFF half of the wire measurement. The peer's turns
           still arrive, and arrive on time -- they arrive EMPTY. Seed, local
           log and tick budget are untouched, so every difference it makes to
           the rival seat's numbers was carried by the commands and by nothing
           else on this client. */
        box[1 - seat] = opts.deaf ? []
          : (byTurn[turn] || []).filter(a => a.seat !== seat).map(record).filter(Boolean);
      }
      /* the local seat's commands, issued NET_INPUT_DELAY turns early so they
         land on the same turn the remote ones do */
      if (Net.tickInTurn === 0) {
        const due = byTurn[turn + NET_INPUT_DELAY] || [];
        for (const a of due) if (a.seat === seat) issueLocal(a);
      }
      Game.step(STEP);
      /* One fingerprint per turn, so a failure can name the turn the two
         boards parted instead of only that they did. */
      if (trace && Net.tickInTurn === 0) trace.push(Net.fingerprint());
    }
    const out = deepState();
    out.ticks = Net.tick;
    out.sum = Net.fingerprint();
    out._why = Game.state === 'over' ? 'eliminated' : (guard >= ticks * 6 ? 'guard' : 'ticks');
    closeMatch();
    return out;
  }

  /**
   * The full simulation state, at full precision. The fingerprint on the wire
   * is quantised on purpose; this is not, because a test that cannot see the
   * last bit cannot prove the last bit agrees.
   */
  function deepState() {
    const S = Net._realSides;
    return {
      wave: Game.wave, clock: Game.clock, prep: Game.prepTimer, running: Game.waveRunning,
      mods: Game.enemyMods.map(m => m.id).join(','),
      drift: [Game.drift.hp, Game.drift.speed, Game.drift.armor],
      sides: S.map(x => ({
        gold: x.gold, lives: x.lives, enrage: x.enrage || 0, base: x.baseLevel || 1,
        income: x.musterIncome, taken: x.taken.map(m => m.id).join(','),
        stats: [x.stats.kills, x.stats.sent, x.stats.leaked, x.stats.built, x.stats.mustered],
        towers: x.towers.map(t => [t.gx, t.gy, t.type, t.level, t.asc || 0, t.invested,
                                   t.kills, t.damageDealt]).join(';')
      })),
      enemies: Game.enemies.map(e => [e.type || (e.def && e.def.id), e.x, e.y, e.hp,
                                      e.hostileTo, e.reanimated ? 1 : 0].join(',')).join('|')
    };
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* Names the FIRST field two states disagree on. "the boards differ" is not a
     bug report; "seat 1 gold 940 vs 965" is. */
  function firstDiff(a, b, path) {
    path = path || '';
    if (a === b) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = Object.keys(a).concat(Object.keys(b).filter(k => !(k in a)));
      for (const k of keys) {
        const d = firstDiff(a[k], b[k], path ? path + '.' + k : k);
        if (d) return d;
      }
      return null;
    }
    const s = v => String(v).length > 90 ? String(v).slice(0, 90) + '…' : String(v);
    return path + ': ' + s(a) + '  vs  ' + s(b);
  }

  /**
   * Legal build tiles for each real seat, RANKED BY THE LANE THEY COVER.
   * Scan order handed back the top edge of the board -- row 0, gx 0-11 on
   * SPINE -- which is a legal place to build and a useless one. Six towers up
   * there fired at nothing, both commanders leaked their whole wave, and a
   * check about what happens to the dead ran on a board where nothing died.
   * Distance to the path this seat actually defends is the only ordering that
   * makes a build a defence.
   */
  function probe(cfg) {
    openMatch(cfg, 0);
    const can = Net._orig.seat_canBuild || Game.canBuild;
    const tiles = [[], []];
    for (let s = 0; s < 2; s++) {
      /* Through suspend because `s` here means the REAL seat, not the lensed
         one -- the same reason canBuild is called through it below. */
      const paths = Net.suspend(Game.defendedPaths, Game, [s]);
      const scored = [];
      for (let gy = 0; gy < FIELD.rows; gy++)
        for (let gx = 0; gx < FIELD.cols; gx++) {
          if (!Net.suspend(can, Game, [s, gx, gy])) continue;
          const cx = (gx + 0.5) * TILE, cy = (gy + 0.5) * TILE;
          let near = Infinity;
          for (const pa of paths)
            for (const pt of pa.pts) near = Math.min(near, Math.hypot(pt.x - cx, pt.y - cy));
          scored.push([gx, gy, near]);
        }
      /* gy/gx break the tie so the ordering is TOTAL: two tiles the same
         distance from the lane must not depend on sort stability, or the two
         clients could probe the same board and build in different places. */
      scored.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      tiles[s] = scored.slice(0, 12).map(t => [t[0], t[1]]);
    }
    const tiers = [Net.suspend(Net._orig.ret_musterVictims ? Game.musterTiers : Game.musterTiers, Game, [0]),
                   Net.suspend(Game.musterTiers, Game, [1])];
    const types = [Net._realSides[0].loadout.slice(), Net._realSides[1].loadout.slice()];
    closeMatch();
    return { tiles, tiers, types };
  }

  /** A match's worth of input for both seats, exercising the whole surface. */
  function buildLog(p) {
    const L = [];
    const t0 = p.tiles[0], t1 = p.tiles[1];
    const push = (turn, seat, act, extra) => L.push(Object.assign({ turn, seat, act }, extra));
    for (let i = 0; i < 6; i++) {
      push(3 + i * 4, 0, 'build', { type: p.types[0][i % p.types[0].length], gx: t0[i][0], gy: t0[i][1] });
      push(5 + i * 4, 1, 'build', { type: p.types[1][i % p.types[1].length], gx: t1[i][0], gy: t1[i][1] });
    }
    push(30, 0, 'up', { gx: t0[0][0], gy: t0[0][1] });
    push(32, 1, 'up', { gx: t1[0][0], gy: t1[0][1] });
    push(40, 0, 'base', {});
    push(42, 1, 'base', {});
    push(48, 0, 'rage', {});
    push(50, 1, 'rage', {});
    /* Musters are ATTEMPTED on a cadence rather than placed where they are
       certain to succeed. A refusal is as good a test as a purchase: it has to
       be refused on both clients for the same reason, or the boards part. */
    for (let turn = 160; turn < 1150; turn += 45) {
      if (p.tiers[0] && p.tiers[0].length) push(turn, 0, 'muster', { tier: p.tiers[0][0].id });
      if (p.tiers[1] && p.tiers[1].length) push(turn + 2, 1, 'muster', { tier: p.tiers[1][0].id });
    }
    push(90, 0, 'abil', { i: 0 });
    push(92, 1, 'abil', { i: 0 });
    push(150, 0, 'sell', { gx: t0[5][0], gy: t0[5][1] });
    push(152, 1, 'sell', { gx: t1[5][0], gy: t1[5][1] });
    return L;
  }

  /* ============================================================ checks == */

  const api = {

    /** The seeded generator is a generator, and it is stable. */
    rng() {
      T('net.rng seeded stream is reproducible and uniform', function () {
        Net.cfg = { seed: 12345 };
        Net.enterSim(7);
        const a = []; for (let i = 0; i < 2000; i++) a.push(Math.random());
        Net.enterSim(7);
        const b = []; for (let i = 0; i < 2000; i++) b.push(Math.random());
        Net.exitSim();
        const identical = a.every((v, i) => v === b[i]);
        const mean = a.reduce((x, y) => x + y, 0) / a.length;
        const inRange = a.every(v => v >= 0 && v < 1);
        ok('net.rng seeded stream is reproducible and uniform',
           identical && inRange && Math.abs(mean - 0.5) < 0.03,
           'identical=' + identical + ' mean=' + mean.toFixed(4) + ' inRange=' + inRange);
      });
      T('net.rng a different tick is a different stream', function () {
        Net.cfg = { seed: 12345 };
        Net.enterSim(7); const a = Math.random();
        Net.enterSim(8); const b = Math.random();
        Net.exitSim();
        ok('net.rng a different tick is a different stream', a !== b, a + ' vs ' + b);
      });
      return api;
    },

    /** THE HEADLINE. Two clients, one seed, one input log, full state. */
    twoClients(ticks) {
      ticks = ticks || 2400;
      T('net.duel two clients agree after ' + ticks + ' ticks', function () {
        const cfg = contract(SEED);
        const p = probe(cfg);
        const log = buildLog(p);
        const a = runClient(cfg, 0, log, ticks);
        const b = runClient(cfg, 1, log, ticks);
        const agree = same(a, b);
        const where = agree ? '' : ' | first difference — ' + firstDiff(a, b);
        /* A duel can END before the tick budget is spent -- one commander is
           eliminated and the board resolves. That is a finished match, not a
           short one, so the requirement is that both clients ran the same
           number of ticks and arrived at the same place. */
        ok('net.duel two clients agree after ' + ticks + ' ticks', agree && a.ticks === b.ticks,
           'ticks=' + a.ticks + '/' + b.ticks + ' (' + a._why + '/' + b._why + ') wave=' + a.wave +
           ' towers=' + a.sides.map(s => s.towers.split(';').length).join('/') +
           ' enemies=' + (a.enemies ? a.enemies.split('|').length : 0) +
           ' sum=' + a.sum + '/' + b.sum + where);
      });
      return api;
    },

    /** Replaying the same client twice must land in the same place. */
    determinism(ticks) {
      ticks = ticks || 3600;
      T('net.determinism the same seed replays identically over ' + ticks + ' ticks', function () {
        const cfg = contract(SEED);
        const p = probe(cfg);
        const log = buildLog(p);
        const a = runClient(cfg, 0, log, ticks);
        const b = runClient(cfg, 0, log, ticks);
        ok('net.determinism the same seed replays identically over ' + ticks + ' ticks',
           same(a, b), 'wave=' + a.wave + ' sum=' + a.sum + '/' + b.sum +
           (same(a, b) ? '' : ' | first difference — ' + firstDiff(a, b)));
      });
      T('net.determinism a different seed is a different match', function () {
        const p = probe(contract(SEED));
        const log = buildLog(p);
        /* 900 ticks is before the first wave, when nothing has rolled yet and
           two seeds are indistinguishable -- which made this check vacuous. */
        const a = runClient(contract(SEED), 0, log, 2400);
        const b = runClient(contract(SEED + 1), 0, log, 2400);
        ok('net.determinism a different seed is a different match', !same(a, b),
           'sums ' + a.sum + ' vs ' + b.sum);
      });
      return api;
    },

    /**
     * THE ON/OFF MEASUREMENT. Cosmetic isolation is the load-bearing half of
     * determinism here, so it is proved by removing it: with the isolation
     * off, two clients holding different viewSides part company; with it on,
     * they do not. A check that only ran the working case would pass whether
     * the mechanism did anything or not.
     */
    isolation() {
      const cfg = contract(SEED);
      const p = probe(cfg);
      const log = buildLog(p);
      /* Long enough to be PAST the first wave. Before a shot is fired nothing
         cosmetic has rolled at all, and the check passed either way -- which
         is the vacuous measurement this whole test exists to avoid. */
      const N = 3000;
      let on = null, off = null;
      T('net.isolation ON: two viewSides agree', function () {
        Net._isolate = true;
        const a = runClient(cfg, 0, log, N);
        const b = runClient(cfg, 1, log, N);
        on = same(a, b);
        ok('net.isolation ON: two viewSides agree', on,
           'sums ' + a.sum + ' / ' + b.sum + ' at wave ' + a.wave +
           (on ? '' : ' | ' + firstDiff(a, b)));
      });
      T('net.isolation OFF: the same two clients diverge', function () {
        Net._isolate = false;
        let a, b;
        try {
          a = runClient(cfg, 0, log, N);
          b = runClient(cfg, 1, log, N);
        } finally { Net._isolate = true; }
        off = !same(a, b);
        ok('net.isolation OFF: the same two clients diverge', off,
           off ? 'diverged as expected — ' + firstDiff(a, b)
               : 'STILL AGREED — the isolation is not what is holding them together');
      });
      info('net.isolation verdict', 'isolation on -> agree=' + on + ', isolation off -> diverge=' + off);
      return api;
    },

    /** The guest's screen must describe the guest, not the host. */
    lens() {
      const cfg = contract(SEED);
      T('net.lens seat 1 reads its own side at index 0', function () {
        openMatch(cfg, 1);
        const real = Net._realSides;
        const a = Game.sides[0] === real[1];
        const b = Game.sides[1] === real[0];
        const c = Game.rivalOf(0) === 1;
        const d = Game.musterVictims(0).join() === '1';
        ok('net.lens seat 1 reads its own side at index 0', a && b && c && d,
           'sides0=' + a + ' sides1=' + b + ' rivalOf=' + c + ' victims=' + d);
        closeMatch();
      });
      T('net.lens a priced number matches the engine for the LOCAL seat', function () {
        openMatch(cfg, 1);
        const lensed = Game.baseLevelCost(0);
        const engine = Net.suspend(Net._orig.seat_baseLevelCost, Game, [1]);
        const wrong = Net.suspend(Net._orig.seat_baseLevelCost, Game, [0]);
        Net._realSides[1].baseLevel = 3;                 // make the two prices differ
        const lensed2 = Game.baseLevelCost(0);
        const engine2 = Net.suspend(Net._orig.seat_baseLevelCost, Game, [1]);
        ok('net.lens a priced number matches the engine for the LOCAL seat',
           lensed === engine && lensed2 === engine2 && lensed2 !== lensed,
           'seat1=' + lensed + ' seat0=' + wrong + ' after raise seat1=' + lensed2);
        closeMatch();
      });
      T('net.lens the HUD prints the local commander, not the host', function () {
        openMatch(cfg, 1);
        Net._realSides[0].gold = 111; Net._realSides[1].gold = 222;
        Net._realSides[0].lives = 7;  Net._realSides[1].lives = 13;
        UI.syncLive();
        const gold = document.getElementById('my-gold').textContent;
        const lives = document.getElementById('my-lives').textContent;
        const rgold = document.getElementById('ai-gold').textContent;
        ok('net.lens the HUD prints the local commander, not the host',
           gold === formatNum(222) && lives === '13' && rgold === formatNum(111),
           'YOU gold=' + gold + ' lives=' + lives + ' RIVAL gold=' + rgold);
        closeMatch();
      });
      T('net.lens a guest tower reads as the guest\'s own', function () {
        openMatch(cfg, 1);
        const can = Net._orig.seat_canBuild;
        let spot = null;
        for (let gy = 0; gy < FIELD.rows && !spot; gy++)
          for (let gx = 0; gx < FIELD.cols && !spot; gx++)
            if (Net.suspend(can, Game, [1, gx, gy])) spot = [gx, gy];
        Net._realSides[1].gold = 99999;
        Net._replaying = true;
        const t = Net.suspend(Net._orig.cmd_build, Game, [1, Net._realSides[1].loadout[0], spot[0], spot[1]]);
        Net._replaying = false;
        const asEngine = t._side;
        const asUI = t.side;                              // lens is on outside engine calls
        ok('net.lens a guest tower reads as the guest\'s own', asEngine === 1 && asUI === 0,
           'engine sees side ' + asEngine + ', the inspector sees side ' + asUI);
        closeMatch();
      });
      return api;
    },

    /** The duel's own rules, each one a behaviour rather than a flag. */
    rules() {
      const cfg = contract(SEED);
      T('net.rules the rival brain decides nothing, but the slot survives', function () {
        openMatch(cfg, 0);
        /* The slot must EXIST -- onWaveSpawned indexes brains[si-1] and
           Game.loop has no try/catch -- and must decide nothing. */
        const slot = Game.brains.length === Net._realSides.length - 1;
        Net._realSides[1].gold = 99999;
        for (let i = 0; i < 900; i++) {
          const box = (Net.inbox[Net.turn] = Net.inbox[Net.turn] || [null, null]);
          if (!box[0]) box[0] = [];
          if (!box[1]) box[1] = [];
          Game.step(STEP);
        }
        const built = Net._realSides[1].towers.length;
        const mustered = Net._realSides[1].stats.mustered;
        ok('net.rules the rival brain decides nothing, but the slot survives',
           slot && built === 0 && mustered === 0 && Game.state !== 'over',
           'slot=' + slot + ' rival towers after 15s=' + built + ' musters=' + mustered);
        closeMatch();
      });
      T('net.rules rushing is off, and comes back afterwards', function () {
        openMatch(cfg, 0);
        Game.prepTimer = 20; Game.waveRunning = false; Game.state = 'playing';
        const during = Game.canRush();
        closeMatch();
        Game.prepTimer = 20; Game.waveRunning = false; Game.state = 'playing';
        const after = Game.canRush();
        ok('net.rules rushing is off, and comes back afterwards', during === false && after === true,
           'in a duel=' + during + ', outside one=' + after);
      });
      T('net.rules the campaign ledger is untouched by a duel', function () {
        const before = JSON.stringify(Meta.campaign());
        openMatch(cfg, 0);
        const skirmish = Game._skirmish;
        const tier = Game.galaxyTier;
        closeMatch();
        ok('net.rules the campaign ledger is untouched by a duel',
           skirmish === true && tier === 0 && JSON.stringify(Meta.campaign()) === before,
           '_skirmish=' + skirmish + ' galaxyTier=' + tier);
      });
      T('net.rules the result belongs to the local seat', function () {
        /* loseLives resolves a fallen seat 0 with endMatch(false) -- correct on
           the host's screen and a lie on the guest's, where seat 0 is the
           OPPONENT. Both directions are measured, because only checking the
           guest would pass if the result were simply inverted. */
        const grab = seat => {
          openMatch(cfg, seat);
          let seen = null;
          const orig = UI.showEnd;
          UI.showEnd = function (w) { seen = w; };
          try {
            Net.enterSim(5);
            /* Through Net.suspend because 0 here means the REAL seat 0. With
               the lens on, index 0 means "this client's commander" -- which is
               the whole point of it, and would have felled the wrong seat. */
            Net.suspend(Game.loseLives, Game, [0, 999]);
            Net.exitSim();
          } finally { UI.showEnd = orig; closeMatch(); }
          return seen;
        };
        const host = grab(0), guest = grab(1);
        ok('net.rules the result belongs to the local seat', host === false && guest === true,
           'seat 0 sees won=' + host + ', seat 1 sees won=' + guest);
      });
      T('net.rules a concession is a win for the other commander', function () {
        openMatch(cfg, 0);
        let seen = null;
        const orig = UI.showEnd;
        UI.showEnd = function (w) { seen = w; };
        try {
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', to: Net.id, t: 'quit' });
        } finally { UI.showEnd = orig; }
        const alive = Net._realSides[0].alive;
        closeMatch();
        ok('net.rules a concession is a win for the other commander', seen === true,
           'peer conceded, this seat still alive=' + alive + ', won=' + seen);
      });
      T('net.rules speed and pause are shared controls', function () {
        openMatch(cfg, 0);
        const sent = [];
        const post = Net.post;
        Net.post = function (m) { sent.push(m.t + ':' + m.ctl + '=' + m.value); };
        try {
          Game.speed = 3;
          Game.paused = true;
          /* Arriving from the peer must apply WITHOUT echoing, or the two
             clients would bounce one keypress between them forever. */
          const before = sent.length;
          Net.applyCtl('speed', 2, true);
          var echoed = sent.length > before;
        } finally { Net.post = post; }
        const applied = Game.speed === 2;
        closeMatch();
        Game.paused = false; Game.speed = 1;
        ok('net.rules speed and pause are shared controls',
           sent.join(',') === 'ctl:speed=3,ctl:paused=true' && applied && !echoed,
           'sent [' + sent.join(', ') + '], remote change applied=' + applied + ', echoed=' + echoed);
      });
      T('net.rules escalations are dealt, not drafted', function () {
        openMatch(cfg, 0);
        Game.enemyMods = []; Game.escalationOwed = []; Game.pendingEscalation = null;
        Net.enterSim(1);
        Game.addEnemyMod();
        Net.exitSim();
        const taken = Game.enemyMods.length;
        const modal = Game.state;
        const boon = (Game.escalationBoon || 0) + (Net._realSides[1].draftBoon || 0);
        ok('net.rules escalations are dealt, not drafted',
           taken === 1 && modal !== 'escalating' && boon === 0,
           'taken=' + taken + ' state=' + modal + ' bid refunded=' + (boon === 0));
        closeMatch();
      });
      T('net.rules both commanders draft, each from their own offer', function () {
        openMatch(cfg, 0);
        const t0 = Net._realSides[0].taken.length, t1 = Net._realSides[1].taken.length;
        Net.enterSim(2);
        /* exactly the two calls onWaveSpawned makes on a draft wave */
        Game.brains[0].chooseMod(Game.drawMods(Net._realSides[1]));
        Game.offerChoice();
        Net.exitSim();
        const two = !!(Net.offers[0] && Net.offers[0].length && Net.offers[1] && Net.offers[1].length);
        const mine = Game.pendingChoice === Net.offers[0];
        const halted = Game.state === 'choosing';
        Net.applyOob({ k: 'd', seat: 1, pick: 0 });
        const halfway = Game.state;                        // still halted: seat 0 has not answered
        Net.applyOob({ k: 'd', seat: 0, pick: 0 });
        const after = Game.state;
        const paid0 = Net._realSides[0].taken.length === t0 + 1;
        const paid1 = Net._realSides[1].taken.length === t1 + 1;
        ok('net.rules both commanders draft, each from their own offer',
           two && mine && halted && halfway === 'choosing' && after === 'playing' && paid0 && paid1,
           'two offers=' + two + ' mine shown=' + mine +
           ' halted while one waited=' + (halfway === 'choosing') +
           ' seat0 paid=' + paid0 + ' seat1 paid=' + paid1);
        closeMatch();
      });
      return api;
    },

    /**
     * The PvP loop across the connection: a muster issued as a command on one
     * client must put units on the rival's lane on BOTH, and the kills those
     * units feed must reanimate back.
     */
    pvp() {
      /* THREE RUNS, read by the three checks below.

         The tick budget is not the interesting number and never was. Wave 1
         starts at prepTime(0) = 22s = tick 1320, the first wave unit dies to a
         tower about five seconds after that, and reanimate() fires at tick
         ~1650 -- inside a quarter of the 7200 already granted. The duel then
         resolves itself near tick 6000 when a commander falls, and runClient
         stops there on Game.state === 'over' whatever the budget says. Raising
         7200 to 20000 changes nothing at all; what the old check was missing
         was a board that could kill, not a longer afternoon.

         `bought` and `sends` come off the SAME seat's ledger. Game.muster
         writes stats.sent AND stats.mustered on every unit it queues
         (game.js:1942-1943); the only other writers of stats.sent in the tree
         are reanimate()'s two branches (game.js:1991, 2028) and the SIREN
         charm (entities2.js:391). SPINE is not triMode and PIN_LOADOUT has no
         SIREN, so on this contract sends-minus-bought IS reanimate() and can
         be nothing else. */
      const GOLD = 4000;
      let a = null, b = null, deaf = null;
      /* Guarded, because these three runs are outside every T() below and a
         throw here would take the whole suite down with it rather than
         reporting one red line. */
      T('net.pvp the three duel runs complete', function () {
        const cfg = contract(SEED);
        const p = probe(cfg);
        const log = buildLog(p);
        /* This client holds seat 0, so every seat-1 action in the log arrives
           the way the other window's would: as a command inside a turn packet. */
        a = runClient(cfg, 0, log, 7200, null, { gold: GOLD });
        /* The OTHER window: the same log, the same seed, the seats swapped
           over the local and the remote path. */
        b = runClient(cfg, 1, log, 7200, null, { gold: GOLD });
        /* The same client as `a`, with the peer's turns arriving empty. */
        deaf = runClient(cfg, 0, log, 7200, null, { gold: GOLD, deaf: true });
        ok('net.pvp the three duel runs complete', !!(a && b && deaf),
           'wired ' + a.ticks + ' ticks (' + a._why + '), mirror ' + b.ticks +
           ' ticks (' + b._why + '), deaf ' + deaf.ticks + ' ticks (' + deaf._why + ')');
      });

      const bought = s => s.stats[4], sends = s => s.stats[1], kills = s => s.stats[0];
      const built = s => s.stats[3];
      const raised = s => sends(s) - bought(s);
      const line = r => 'wave ' + r.wave + ' t' + r.ticks + ' | bought ' +
        r.sides.map(bought).join('/') + ' | sent ' + r.sides.map(sends).join('/') +
        ' | raised ' + r.sides.map(raised).join('/') + ' | kills ' + r.sides.map(kills).join('/');

      T('net.pvp the send/muster/reanimate loop closes for both commanders', function () {
        ok('net.pvp the send/muster/reanimate loop closes for both commanders',
           bought(a.sides[0]) > 0 && bought(a.sides[1]) > 0 &&
           raised(a.sides[0]) > 0 && raised(a.sides[1]) > 0,
           line(a));
      });

      /* THE ACROSS-THE-WIRE MEASUREMENT, and the only one of these three that
         is about the connection.

         Reanimation is computed locally on both clients -- waves are seeded,
         not sent -- so "reanimation happened here" proves the simulation, not
         the relay, and a check that only asserted it would pass with the wire
         unplugged. What DOES cross is the rival's commands: on this client,
         seat 1 owns towers only because its build packets arrived, kills only
         because those towers exist, and reanimated sends only because of those
         kills. So seat 1's raised sends, measured on the client holding seat
         0, are wire-carried by construction -- and the proof is to take the
         wire away and watch them go to zero while seat 0's own stay. */
      T('net.pvp the RIVAL\'s reanimation is carried by the connection', function () {
        const wired = raised(a.sides[1]) > 0 && bought(a.sides[1]) > 0;
        const silent = built(deaf.sides[1]) === 0 && kills(deaf.sides[1]) === 0 &&
                       sends(deaf.sides[1]) === 0;
        /* Seat 0 is issued locally in BOTH runs, so it must keep raising the
           dead when the peer goes quiet. Without this the check would also
           pass if deafening the wire had simply broken the whole board. */
        const localUnhurt = raised(deaf.sides[0]) > 0;
        ok('net.pvp the RIVAL\'s reanimation is carried by the connection',
           wired && silent && localUnhurt,
           'wired: ' + line(a) + '  ||  deaf: ' + line(deaf));
      });

      /* And the two windows must have raised the SAME dead. Seat 1 was issued
         locally on b and arrived as packets on a; if the remote path and the
         local path produced different corpses, the enemy list -- which carries
         the reanimated flag per unit -- is where it shows. */
      T('net.pvp both windows raise the same dead', function () {
        const statsAgree = JSON.stringify(a.sides.map(s => s.stats)) ===
                           JSON.stringify(b.sides.map(s => s.stats));
        const bodiesAgree = a.enemies === b.enemies;
        ok('net.pvp both windows raise the same dead',
           a.ticks === b.ticks && statsAgree && bodiesAgree,
           'seat0 client: ' + line(a) + '  ||  seat1 client: ' + line(b) +
           (statsAgree && bodiesAgree ? '' : ' | first difference — ' + firstDiff(a, b)));
      });
      T('net.pvp a remote muster puts units on THIS clients lane', function () {
        const cfg = contract(SEED);
        openMatch(cfg, 0);
        const tiers = Net.suspend(Game.musterTiers, Game, [1]);
        Net._realSides[1].gold = 99999;
        const before = Game.enemies.filter(e => e.hostileTo === 0).length;
        /* the packet a real peer would have sent */
        Net.inbox[Net.turn] = [[], [{ k: 'm', side: 1, tier: tiers[0].id }]];
        for (let i = 0; i < 12; i++) {
          const box = (Net.inbox[Net.turn] = Net.inbox[Net.turn] || [null, null]);
          if (!box[0]) box[0] = [];
          if (!box[1]) box[1] = [];
          Game.step(STEP);
        }
        const after = Game.enemies.filter(e => e.hostileTo === 0).length;
        ok('net.pvp a remote muster puts units on THIS clients lane',
           after > before && Net._realSides[1].stats.mustered > 0,
           'enemies marching on seat 0: ' + before + ' -> ' + after +
           ', seat 1 musters=' + Net._realSides[1].stats.mustered);
        closeMatch();
      });
      return api;
    },

    /**
     * The wire itself, over a real BroadcastChannel, against a scripted peer
     * in this same page. Two BroadcastChannel objects on one page do deliver
     * to each other, which is what makes this measurable without a second
     * window.
     */
    wire(done) {
      const log = [];
      const ghost = new BroadcastChannel(NET_CHANNEL);
      const GID = 'ghost' + Math.random().toString(36).slice(2, 7);
      let sawTable = false, sawJoin = false, sawPkt = 0, lastSum = null, ghostTurn = {};

      ghost.onmessage = ev => {
        const m = ev.data;
        if (!m || m.from === GID) return;
        log.push(m.t);
        if (m.t === 'table') sawTable = true;
        if (m.t === 'join') {
          sawJoin = true;
          /* answer as a host would, with a contract of our own */
          ghost.postMessage({ v: NET_PROTOCOL, from: GID, to: m.from, t: 'accept',
                              name: 'GHOST', cfg: contract(0xabc123) });
          for (let t = 0; t < NET_INPUT_DELAY; t++)
            ghost.postMessage({ v: NET_PROTOCOL, from: GID, to: m.from, t: 'pkt', seat: 0, turn: t, cmds: [] });
        }
        if (m.t === 'pkt') {
          sawPkt++;
          if (m.sum !== undefined) lastSum = { turn: m.sumTurn, sum: m.sum };
          /* mirror the turn back so the local client never stalls */
          if (!ghostTurn[m.turn]) {
            ghostTurn[m.turn] = 1;
            ghost.postMessage({ v: NET_PROTOCOL, from: GID, to: m.from, t: 'pkt', seat: 0,
                                turn: m.turn, cmds: [], sum: m.sum, sumTurn: m.sumTurn });
          }
        }
        if (m.t === 'beat') ghost.postMessage({ v: NET_PROTOCOL, from: GID, to: m.from, t: 'beat' });
      };

      Net.open();
      Net.enterLobby('WIRETEST');
      ghost.postMessage({ v: NET_PROTOCOL, from: GID, t: 'table', name: 'GHOST',
                          world: contract(1).world });

      setTimeout(() => {
        ok('net.wire an open table is seen in the lobby', Net.tables.some(t => t.id === GID),
           Net.tables.length + ' table(s) visible');
        Net.join(GID);
        setTimeout(() => {
          ok('net.wire joining reaches a live duel',
             Net.live === true && Net.seat === 1 && Net.phase === 'playing',
             'live=' + Net.live + ' seat=' + Net.seat + ' phase=' + Net.phase);
          /* drive twenty turns of simulation over the real wire */
          let n = 0;
          const drive = setInterval(() => {
            for (let i = 0; i < 6; i++) Game.step(STEP);
            if (++n < 24) return;
            clearInterval(drive);
            ok('net.wire turn packets flow and the fingerprints agree',
               sawPkt >= 8 && Net.desync === null && Net.turn > 4,
               'packets=' + sawPkt + ' turn=' + Net.turn + ' desync=' + JSON.stringify(Net.desync));
            /* a command issued locally must reach the peer inside a packet */
            const before = sawPkt;
            Game.buyBaseLevel(0);
            for (let i = 0; i < 24; i++) Game.step(STEP);
            setTimeout(() => {
              const carried = log.filter(x => x === 'pkt').length > before;
              ok('net.wire a local command is carried in a sealed turn', carried,
                 'packets after the command: ' + sawPkt);
              /* now go silent and prove the disconnect is honest */
              ghost.onmessage = null;
              Net.lastHeard = Date.now() - NET_PEER_TIMEOUT_MS - 100;
              Net.tickWall();
              const el = document.getElementById('net-fatal');
              ok('net.wire a silent peer voids the duel instead of hanging it',
                 Net.live === false && Net.phase === 'lost' && el && !el.classList.contains('hidden') &&
                 /void/i.test(el.textContent),
                 'phase=' + Net.phase + ' live=' + Net.live + ' overlay=' + !!el);
              ghost.close();
              if (el) el.classList.add('hidden');
              closeMatch();
              if (done) done(api.report());
            }, 60);
          }, 16);
        }, 260);
      }, 260);
      info('net.wire', 'asynchronous — pass a callback, or read MPT.report() a second later');
      return api;
    },

    report() {
      const pass = C.filter(x => x.verdict === 'PASS').length;
      const fail = C.filter(x => x.verdict === 'FAIL').length;
      console.table(C);
      console.log('%c multiplayer: ' + pass + ' pass, ' + fail + ' fail ',
                  'background:' + (fail ? '#7f1d1d' : '#14532d') + ';color:#fff');
      return { pass, fail, checks: C.slice() };
    },

    reset() { C.length = 0; return api; },

    /* Exposed so a failure can be chased rather than merely reported. */
    rig: { contract, probe, buildLog, runClient, firstDiff, deepState, record, issueLocal },

    all(done) {
      C.length = 0;
      if (document.hidden)
        info('net.harness', 'THIS TAB IS HIDDEN. Nothing here depends on rAF, but front it anyway.');
      api.rng();
      api.lens();
      api.rules();
      api.pvp();
      api.isolation();
      api.twoClients(2400);
      api.determinism(2400);
      if (typeof BroadcastChannel === 'function') api.wire(done || (r => r));
      else info('net.wire', 'no BroadcastChannel in this browser — the relay is unavailable');
      return api.report();
    }
  };

  return api;
})();
