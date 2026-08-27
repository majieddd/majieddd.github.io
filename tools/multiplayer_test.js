/* ==========================================================================
   MULTIPLAYER, the duel relay, measured.

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
  /* The rite this rig drives when the subject is reanimation. THE BROOD is
     the choice because it both BUYS and RAISES: the machine rite raises but
     cannot purchase (noPurchase), so `bought > 0` could never hold under it. */
  const RAISING_RITE = 'xeno';
  /* THE REACHABILITY GRANT, hoisted so the isolation canary can have it too.
     The pvp rig documented why it needs this ("a duel test that cannot afford
     its own opening is a test of poverty"): without it most builds in the log
     are refused for gold and the surviving board kills nothing.
     The isolation canary needs the SAME thing for a different reason. It
     proves that viewSide-gated cosmetics are what the isolation is suppressing,
     which requires cosmetics to actually roll. It used to get that for free,
     because the old human rite raised a body on EVERY kill and the resulting
     traffic guaranteed melee sparks. FIELD DOCTRINE raises none, so the canary
     went quiet and reported STILL AGREED, which reads as "the mechanism does
     nothing" when it in fact means "this board was too empty to test it". */
  const RIG_GOLD = 4000;
  /* THE ISOLATION CANARY'S rite is a different choice from the pvp rig's, and
     the difference is the point. The pvp rig needs a seat that both BUYS and
     RAISES, so it uses THE BROOD. The canary needs only TRAFFIC: the most
     bodies on the board in the fewest ticks, so that a viewSide-gated cosmetic
     rolls at all. THE LATTICE raises one body on every kill with no purchase
     and no gestation, which is the closest thing left to the CONSCRIPTION the
     canary used to inherit by accident. It never checks `bought`, so the
     machine rite's noPurchase costs it nothing. */
  const TRAFFIC_RITE = 'robot';
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
      case 'up':     return { k: 'u', gx: a.gx, gy: a.gy, branch: -1 };
      case 'sell':   return { k: 's', gx: a.gx, gy: a.gy };
      case 'abil':   return { k: 'a', i: a.i, gx: a.gx === undefined ? -1 : a.gx,
                                              gy: a.gy === undefined ? -1 : a.gy };
      /* The mode travels as an INDEX, which is the shape hookCommands puts on
         the wire. A log that carried the string would be measuring a command
         the relay does not send. */
      case 'targ':   return { k: 't', gx: a.gx, gy: a.gy,
                              mode: TARGET_MODES.map(m => m.id).indexOf(a.mode) };
    }
    return null;
  }

  /** Drive the action through the REAL local entry point the UI would use. */
  function issueLocal(a) {
    switch (a.act) {
      case 'build':  Game.build(0, a.type, a.gx, a.gy); break;
      case 'muster': Game.muster(0, a.tier); break;
      case 'base':   Game.buyBaseLevel(0); break;
      case 'up':     { const t = Game.towerAt(a.gx, a.gy); if (t) Game.upgrade(t); break; }
      case 'sell':   { const t = Game.towerAt(a.gx, a.gy); if (t) Game.sell(t); break; }
      /* The global useAbility is the one entry point both the aimed and the
         unaimed kind pass through, and so the one place the relay catches
         them. armAbility only ARMS an aimed ability -- it issues nothing --
         so driving the log through it would have put a command in one run
         and nothing in the other. */
      case 'abil':   useAbility(Game.sides[0], Game, a.i,
                                a.gx === undefined ? undefined : { gx: a.gx, gy: a.gy }); break;
      /* Game.setTargetMode is the entry point the panel and the Tab key both
         reach now, so it is the one the log has to drive. */
      case 'targ':   { const t = Game.towerAt(a.gx, a.gy); if (t) Game.setTargetMode(t, a.mode); break; }
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
    /* THE RITE, MADE EXPLICIT (Session 38).
       This rig used to inherit whatever doctrine contract()'s two commanders
       happened to carry, and that was COMMANDERS[0] (cadre, faction null, so
       it fell through to the seat's human banner) and COMMANDERS[1] (vanta,
       whose own faction is human and therefore beat the seat's xeno banner).
       Both seats ran the human rite by accident, nobody had written that down,
       and three checks silently depended on it: the send/raise loop, the
       wire-carried rival reanimation, and the isolation canary, which needs
       enough sent bodies on the board for melee to roll a viewSide-gated
       cosmetic at all.
       When FIELD DOCTRINE replaced CONSCRIPTION's free body per kill, all
       three went red at once for a reason that had nothing to do with the
       wire. A rig whose subject is reanimation must NAME the rite that
       reanimates rather than inherit one. Applied identically on both seats
       and on both clients, so it costs nothing in determinism. */
    if (opts.doctrine) {
      Net._realSides[0].doctrine = opts.doctrine;
      Net._realSides[1].doctrine = opts.doctrine;
    }
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
        gold: x.gold, lives: x.lives, base: x.baseLevel || 1,
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

  /** One tower for `seat`, on the first tile the engine will accept, placed
      through Game.build's ORIGINAL rather than the wrapped one: a check about
      a targeting command needs a tower standing, not a build command in
      flight ahead of it. */
  function putTower(seat) {
    const S = Net._realSides[seat];
    S.gold = Math.max(S.gold, 9999);
    for (let gy = 0; gy < FIELD.rows; gy++)
      for (let gx = 0; gx < FIELD.cols; gx++) {
        /* Through suspend because `seat` here means the REAL seat -- the same
           reason probe() calls canBuild through it. */
        const t = Net.suspend(Net._orig.cmd_build, Game, [seat, S.loadout[0], gx, gy]);
        if (t) return t;
      }
    return null;
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
    /* Retarget a tower that is neither the one upgraded nor the one sold, so
       the only thing the two clients have to agree about here is the MODE.
       WEAK and CLOSE because no tower defaults to either -- a mode a tower
       already held would make the entry pass without carrying anything. */
    push(70, 0, 'targ', { gx: t0[1][0], gy: t0[1][1], mode: 'weak' });
    push(72, 1, 'targ', { gx: t1[1][0], gy: t1[1][1], mode: 'close' });
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
        const where = agree ? '' : ' | first difference, ' + firstDiff(a, b);
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
           (same(a, b) ? '' : ' | first difference, ' + firstDiff(a, b)));
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
        const a = runClient(cfg, 0, log, N, null, { gold: RIG_GOLD, doctrine: TRAFFIC_RITE });
        const b = runClient(cfg, 1, log, N, null, { gold: RIG_GOLD, doctrine: TRAFFIC_RITE });
        on = same(a, b);
        ok('net.isolation ON: two viewSides agree', on,
           'sums ' + a.sum + ' / ' + b.sum + ' at wave ' + a.wave +
           (on ? '' : ' | ' + firstDiff(a, b)));
      });
      T('net.isolation OFF: the same two clients diverge', function () {
        Net._isolate = false;
        let a, b;
        try {
          a = runClient(cfg, 0, log, N, null, { gold: RIG_GOLD, doctrine: TRAFFIC_RITE });
          b = runClient(cfg, 1, log, N, null, { gold: RIG_GOLD, doctrine: TRAFFIC_RITE });
        } finally { Net._isolate = true; }
        off = !same(a, b);
        ok('net.isolation OFF: the same two clients diverge', off,
           off ? 'diverged as expected, ' + firstDiff(a, b)
               : 'STILL AGREED, the isolation is not what is holding them together');
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

      /* THE OVERLAYS RUN LENS-SUSPENDED ON PURPOSE -- draw must keep true seat
         order -- so a literal 0 inside one is the REAL seat 0, and nothing
         above ever enters draw. Both checks spy on the SEAT the overlay asks
         about, because that number is what the lie is made of; the build ghost
         also measures the ring it actually paints. */
      const seatSpy = function (seen) {
        return function (k) {
          const orig = Game[k];
          Game[k] = function (s) { seen.push(k + '=' + s); return orig.apply(this, arguments); };
          return function () { Game[k] = orig; };
        };
      };

      T('net.lens the build ghost is drawn for the LOCAL seat', function () {
        openMatch(cfg, 1);
        const can = Net._orig.seat_canBuild;
        let mine = null;
        for (let gy = 0; gy < FIELD.rows && !mine; gy++)
          for (let gx = 0; gx < FIELD.cols && !mine; gx++)
            if (Net.suspend(can, Game, [1, gx, gy])) mine = [gx, gy];
        /* Two different multipliers, so the radius names which seat answered. */
        Net._realSides[0].mods.range = 1;
        Net._realSides[1].mods.range = 2;
        Net._realSides[1].gold = 99999;
        const type = Net._realSides[1].loadout[0];
        Game.selectedType = type;
        Game.hover.gx = mine[0]; Game.hover.gy = mine[1]; Game.hover.active = true;
        Game.state = 'playing';

        const seen = [], spy = seatSpy(seen);
        const undo = [spy('canBuild'), spy('canAffordBuild')];
        const ctx = Game.ctx, realArc = ctx.arc;
        let radius = -1;
        ctx.arc = function (x, y, rr) { radius = rr; return realArc.apply(this, arguments); };
        /* Through suspend, which is exactly how Game.draw reaches it. */
        try { Net.suspend(Game.drawBuildOverlay, Game, [ctx]); }
        finally { ctx.arc = realArc; for (const u of undo) u(); }

        const want = TOWER_TYPES[type].base.range * TILE * 2;
        const mineOnly = seen.length === 2 && seen.every(s => s.slice(-2) === '=1');
        Game.selectedType = null; Game.hover.active = false;
        closeMatch();
        ok('net.lens the build ghost is drawn for the LOCAL seat',
           mineOnly && Math.abs(radius - want) < 1e-9,
           seen.join(' ') + ' | ring r=' + radius + ', the local seat would give ' + want);
      });

      T('net.lens the radial ring prices the LOCAL seat', function () {
        openMatch(cfg, 1);
        Game.state = 'playing';
        const type = Net._realSides[1].loadout[0];
        /* Hand-built: openRadial runs on the INPUT path, where the lens is
           already on, so it cannot show what draw does with the same ring. */
        Game.radial = { gx: 1, gy: 1, cx: TILE, cy: TILE, mx: TILE, my: TILE,
                        hover: -1, born: performance.now(),
                        items: [{ type: type, ang: 0, cost: 0, life: 0, afford: false, value: 0 }] };
        const seen = [], spy = seatSpy(seen);
        const undo = [spy('towerCost'), spy('towerLifeCost'), spy('canAffordBuild')];
        try { Net.suspend(Game.drawRadial, Game, [Game.ctx]); }
        finally { for (const u of undo) u(); }
        Game.radial = null;
        /* EVERY call, not a fixed count of calls, and not a fixed SET of them:
           drawRadial re-prices an item for its label as well as its ring slot,
           and since the footprint engine it short-circuits -- `afford = fits &&
           canAffordBuild(...)` -- so an option that cannot fit is never priced
           at all. The claim under test is only ever that NO ask names seat 0. */
        const mineOnly = seen.length >= 2 && seen.every(s => s.slice(-2) === '=1');
        closeMatch();
        ok('net.lens the radial ring prices the LOCAL seat', mineOnly, seen.join(' '));
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
      /* TARGETING. The mode is read inside Tower.acquire on every tick, so it
         is simulation state, and it used to be written raw by the inspector
         and by the Tab key -- one click and the duel voided. What is measured
         is the whole route: held locally, addressed by tile, applied on
         replay, and refused when the seat sending it does not own the tower. */
      T('net.rules a targeting change crosses the wire', function () {
        openMatch(cfg, 0);
        const MODES = TARGET_MODES.map(m => m.id);
        const mine = putTower(0), rival = putTower(1);
        /* Both halves of every turn, or the board sits waiting on a peer that
           does not exist. A half already filled is left alone, which is how an
           injected packet survives the pump. Whole turns only: a packet may be
           dropped in for the turn about to run, never for one that has run. */
        const pump = turns => {
          for (let i = 0; i < turns * NET_TURN_TICKS; i++) {
            const box = (Net.inbox[Net.turn] = Net.inbox[Net.turn] || [null, null]);
            if (!box[0]) box[0] = [];
            if (!box[1]) box[1] = [];
            Game.step(STEP);
          }
        };
        const was = mine.targetMode;
        Game.setTargetMode(mine, 'weak');
        /* A lockstep command does not take effect where it is typed. Reading
           'weak' on this line would mean the write had gone round the relay. */
        const held = mine.targetMode === was;
        const c = Net.queued.length === 1 && Net.queued[0];
        const addressed = !!c && c.k === 't' && c.gx === mine.gx && c.gy === mine.gy &&
                          MODES[c.mode] === 'weak';
        pump(NET_INPUT_DELAY + 3);
        const landed = mine.targetMode === 'weak';
        /* the packet a real peer would send for a tower it owns */
        Net.inbox[Net.turn] = [[], [{ k: 't', gx: rival.gx, gy: rival.gy,
                                      mode: MODES.indexOf('close') }]];
        pump(2);
        const remote = rival.targetMode === 'close';
        /* ...and one for a tower it does not own, refused on replay exactly as
           a sell or a relocate of someone else's tower is. */
        Net.inbox[Net.turn] = [[], [{ k: 't', gx: mine.gx, gy: mine.gy,
                                      mode: MODES.indexOf('last') }]];
        pump(2);
        const refused = mine.targetMode === 'weak';
        closeMatch();
        ok('net.rules a targeting change crosses the wire',
           held && addressed && landed && remote && refused,
           'held locally=' + held + ' addressed by tile=' + addressed +
           ' landed=' + landed + ' peer retargeted its own=' + remote +
           ' peer refused seat 0s tower=' + refused);
      });
      /* The turn fingerprint is the tripwire for the NEXT field somebody
         writes out of band, and it can only trip on what it reads. Every poke
         below sets a field the old sum was blind to and asks whether the sum
         moves; a false is a field two boards could disagree about for a whole
         wave with the turn check reporting nothing. */
      T('net.rules the fingerprint carries the choice, not just the count', function () {
        openMatch(cfg, 0);
        const t = putTower(0), S = Net._realSides[0];
        const shifts = (set, undo) => {
          const before = Net.fingerprint(); set();
          const after = Net.fingerprint(); undo();
          return before !== after;
        };
        const mode0 = t.targetMode, drift0 = Game.drift.speed;
        const mode = shifts(() => { t.targetMode = 'close'; }, () => { t.targetMode = mode0; });
        const branch = shifts(() => { t.branch = t.def.branches[0]; }, () => { t.branch = null; });
        const roll = shifts(() => { t.rolls.push(LEVEL_ROLLS[0]); }, () => { t.rolls.pop(); });
        const drift = shifts(() => { Game.drift.speed = drift0 + 0.055; },
                             () => { Game.drift.speed = drift0; });
        /* SAME LENGTH, different card -- the one case a count could never see,
           and the only one worth measuring here. */
        const mods0 = Game.enemyMods;
        Game.enemyMods = [ENEMY_MODS[0]];
        const escA = Net.fingerprint();
        Game.enemyMods = [ENEMY_MODS[1]];
        const esc = Net.fingerprint() !== escA;
        Game.enemyMods = mods0;
        S.taken.push(PLAYER_MODS[0]);
        const drawnA = Net.fingerprint();
        S.taken[S.taken.length - 1] = PLAYER_MODS[1];
        const drawn = Net.fingerprint() !== drawnA;
        S.taken.pop();

        /* THE SESSION-22 STATE. This tripwire exists to catch "the NEXT field
           somebody writes out of band", and it could only trip on what it
           reads -- so every rite, every clutch, every relay and every compile
           could have been deleted from the fingerprint and this suite would
           still have gone green. Each one is a real desync: two clients that
           disagree about a spliced lane are playing two different boards. */
        const doc = shifts(() => { S.doctrine = 'xeno'; }, () => { S.doctrine = 'human'; });
        const proc = shifts(() => { S.procIdx = 2; S.procCycle = 1; },
                            () => { S.procIdx = 0; S.procCycle = 0; });
        const debt = shifts(() => { S.rollDebt = 40; }, () => { S.rollDebt = 0; });
        const power = shifts(() => { S.summonPower = 0.06; }, () => { S.summonPower = 0; });
        const comp = shifts(() => { S.compileLevel = 3; }, () => { S.compileLevel = 0; });
        const jam = shifts(() => { S.stats.jammed = 5; }, () => { S.stats.jammed = 0; });
        const boot = shifts(() => { S._bootAt = 0.06; }, () => { S._bootAt = 0; });
        const pod = shifts(() => { Game.incubators.push({ side: 0, x: 100, y: 100, t: 5,
                                     powerHp: 200, lidx: 0, unitId: 'crawler', need: 5, armorFlat: 0 }); },
                           () => { Game.incubators.pop(); });
        const relay = shifts(() => { Game.relayNodes.push({ x: 90, y: 90, t: 4, owner: 0, board: 1 }); },
                             () => { Game.relayNodes.pop(); });
        const splice = shifts(() => { Game.spliceState[1] = { wavesLeft: 1, laneIdx: 1, added: [] }; },
                              () => { Game.spliceState[1] = null; });
        closeMatch();
        const s22 = doc && proc && debt && power && comp && jam && boot && pod && relay && splice;
        ok('net.rules the fingerprint carries the choice, not just the count',
           mode && branch && roll && drift && esc && drawn && s22,
           'targetMode=' + mode + ' branch=' + branch + ' level roll=' + roll +
           ' wave drift=' + drift + ' escalation identity=' + esc +
           ' drafted card identity=' + drawn +
           ' | rite=' + doc + ' procession=' + proc + ' rollDebt=' + debt +
           ' summonPower=' + power + ' compile=' + comp + ' jams=' + jam +
           ' bootstrap=' + boot + ' clutch=' + pod + ' relay=' + relay + ' splice=' + splice);
      });
T('net.rules conceding a duel does not promise a garrison', function () {
        /* A duel starts through Game.start({skirmish:true}), so the abandon
           dialog fell into the garrison branch: it offered a defender who is
           not on this board and said nothing about the human who takes the
           win. The garrison line is still TRUE outside a duel, so the fix has
           to be a fork -- both halves are read here. */
        openMatch(cfg, 1);
        UI.confirmAbandon();
        const title = document.getElementById('cfm-title').textContent;
        const duel = document.getElementById('cfm-body').textContent;
        document.getElementById('confirm-ov').classList.add('hidden');
        closeMatch();
        Game._skirmish = true;
        let solo = '';
        if (Meta.campaign()) {
          UI.confirmAbandon();
          solo = document.getElementById('cfm-body').textContent;
          document.getElementById('confirm-ov').classList.add('hidden');
        }
        ok('net.rules conceding a duel does not promise a garrison',
           !/garrison/i.test(duel) && /rival/i.test(duel) && /win/i.test(duel) &&
           (solo === '' || /garrison/i.test(solo)),
           'duel: ' + title + ' / ' + duel +
           (solo ? ' || solo: ' + solo : ' || solo copy unmeasured: no campaign on this profile'));
      });
      /* THE ONLY CHECK IN THIS FILE THAT DRIVES A FRAME RATHER THAN A TICK.
         Every other check steps with a bare `Game.step(STEP)` in a for-loop,
         which is a batch of exactly one and can therefore never see a halt
         that lands mid-batch. That is precisely how the wave-5 draft came to
         stop the two clients on different ticks: Game.loop read `state` once
         before its while, so a client with steps left in the frame ran the
         next tick BEFORE the mod applied while the other ran it after, and
         applyOob seeded _hash(this.tick, ...) off two different numbers. */
      T('net.lockstep a batched frame halts on the tick the draft opens', function () {
        openMatch(cfg, 0);
        /* Enough sealed turns that nothing here can stall for a reason other
           than the one being measured. */
        for (let t = 0; t < 4; t++) Net.inbox[t] = [[], []];
        const openAt = Net.tick + 1;
        const realStep = Net._orig.step;
        const realDraw = Game.draw;
        const raf = window.requestAnimationFrame;
        let left = 0;
        try {
          /* The draft arrives the way onWaveSpawned delivers it: the rival's
             inert brain hands its offer to Net from INSIDE the engine step,
             which sets state to 'choosing' in the middle of the batch. */
          Net._orig.step = function (dt) {
            realStep.call(this, dt);
            if (Net.tick === openAt && !Net.offers[1])
              Net.pendDraft(1, Game.drawMods(Net._realSides[1]));
          };
          Game.draw = function () {};
          window.requestAnimationFrame = function () { return 0; };
          /* One rAF frame at 3x carrying a whole batch -- the frame shape that
             made which step the draft landed on a coin flip per client. */
          Game.speed = 3;
          Game.paused = false;
          Game.lastTs = 0;
          Game.acc = 0;
          Game.loop(100);
          left = Game.acc;
        } finally {
          Net._orig.step = realStep;
          Game.draw = realDraw;
          window.requestAnimationFrame = raf;
          Game.speed = 1;
        }
        const st = Game.state;
        const stoppedOn = Net.tick;
        Net.offers = [null, null];
        Net.syncDraft();
        ok('net.lockstep a batched frame halts on the tick the draft opens',
           st === 'choosing' && stoppedOn === openAt + 1,
           'draft opened on tick ' + openAt + ', the frame stopped at tick ' + stoppedOn +
           ' (expected ' + (openAt + 1) + '), state=' + st +
           ', time left in the accumulator=' + left.toFixed(4));
        closeMatch();
      });
      T('net.stall a heartbeat carries the turn, and a frozen peer is called', function () {
        openMatch(cfg, 0);
        const sent = [];
        const post = Net.post;
        Net.post = function (m) { sent.push(m); };
        let carries = false, refreshed = false, spared = false, voided = false;
        try {
          Net.turn = 7;
          Net.lastBeat = 0;
          Net.tickWall();
          const beat = sent.filter(m => m.t === 'beat').pop();
          carries = !!beat && beat.turn === 7;

          /* Stalled, and stalled for longer than the ceiling. */
          Net.stalled = true;
          Net.stallSince = Date.now() - NET_STALL_VOID_MS - 1000;
          Net.lastHeard = Date.now();
          Net.peerTurn = -1;

          /* A peer that is STILL PLAYING keeps raising the turn it beats, and
             that has to clear the clock rather than start it -- otherwise this
             ceiling would void a duel every time our own window is throttled. */
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', to: Net.id, t: 'beat', turn: 9 });
          refreshed = Date.now() - Net.lastProgress < 500;
          Net.tickWall();
          spared = Net.live === true;

          /* The frozen tab: it answers, it just never gets anywhere. */
          Net.lastProgress = Date.now() - NET_STALL_VOID_MS - 1;
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', to: Net.id, t: 'beat', turn: 9 });
          Net.tickWall();
          voided = Net.live === false && Net.phase === 'lost';
        } finally { Net.post = post; }
        const el = document.getElementById('net-fatal');
        const named = !!el && /background/i.test(el.textContent) && /void/i.test(el.textContent);
        if (el) el.classList.add('hidden');
        ok('net.stall a heartbeat carries the turn, and a frozen peer is called',
           carries && refreshed && spared && voided && named,
           'beat carries turn=' + carries + ' progress refreshed=' + refreshed +
           ' a playing peer is spared=' + spared + ' a frozen one is voided=' + voided +
           ' the notice names the tab=' + named);
        closeMatch();
      });
      T('net.guard a stranger cannot speak for the peer, and ctl cannot name an arbitrary key', function () {
        openMatch(cfg, 0);
        try {
          /* A forged quit from a same-origin tab must not concede the duel. */
          Net.receive({ v: NET_PROTOCOL, from: 'stranger', t: 'quit' });
          const survivedQuit = Net.live === true;
          /* A forged ctl naming an engine field is dropped twice over: the
             sender gate refuses the stranger, the whitelist refuses the key. */
          Net.receive({ v: NET_PROTOCOL, from: 'stranger', t: 'ctl', ctl: 'wave', value: 99 });
          const w0 = Game.wave;
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', t: 'ctl', ctl: 'wave', value: 99 });
          const waveHeld = Game.wave === w0 && Game.wave !== 99;
          /* The two shared controls still cross. */
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', t: 'ctl', ctl: 'speed', value: 3 });
          const speedCrossed = Game.speed === 3;
          Net.receive({ v: NET_PROTOCOL, from: 'ghost', t: 'ctl', ctl: 'speed', value: 1 });
          ok('net.guard a stranger cannot speak for the peer, and ctl cannot name an arbitrary key',
             survivedQuit && waveHeld && speedCrossed,
             'quit ignored=' + survivedQuit + ' wave held=' + waveHeld +
             ' speed crossed=' + speedCrossed);
        } finally { closeMatch(); }
      });
      T('net.guard a join that nobody answers comes back with a verdict', function () {
        /* No host exists behind this row; the deadline is aged by hand. */
        Net.tables = [{ id: 'gone', name: 'GONE',
                        world: { id: 'w9', name: 'NOWHERE', map: 'spine' } }];
        const okJoin = Net.join('gone');
        Net.joinSince = Date.now() - NET_PEER_TIMEOUT_MS - 1000;
        Net.tickWall();
        const back = Net.phase === 'idle' && !Net.tables.some(t => t.id === 'gone') &&
                     /did not answer/i.test(Net._status || '');
        ok('net.guard a join that nobody answers comes back with a verdict',
           okJoin === true && back,
           'join accepted=' + okJoin + ' phase=' + Net.phase +
           ' stale row dropped=' + !Net.tables.some(t => t.id === 'gone') +
           ' status=' + String(Net._status).slice(0, 70));
      });
      /* THE WAVE-5 DEADLOCK, and why no test saw it. Every CONTESTED world is
         dealt a three-way map by the galaxy generator, a tri map deals a third
         Side, and the only `oob` producer stamps the seat THIS client holds --
         so seat 2's draft parked in Net.offers on wave 5 and syncDraft, which
         halts the board on any parked offer and has no timeout behind it,
         never handed it back. Ten of the thirty-five clickable worlds hung a
         duel dead, and every check above fights MAPS[0], which is not one of
         them. Swept over the whole universe map rather than one hand-picked
         world: the property is about every world a player can click. */
      T('net.rules no clickable world can open a duel it cannot finish', function () {
        /* The same galaxy renderMultiverse draws -- seed and all. */
        const gx = generateGalaxy(777001, Meta.faction() || 'human');
        let clicked = 0, refused = 0;
        const wrong = [];
        for (const sys of gx.systems) for (const w of sys.worlds) {
          clicked++;
          const seats = Net.seatsOnMap(w.map);
          const why = Net.duelRefusal(w);
          if (why) refused++;
          /* BOTH directions, or refusing everything would pass: a two-seat
             board must be accepted, and anything else must be refused. */
          if ((seats === 2) === !!why) wrong.push(w.id + ' ' + w.map + ' seats=' + seats);
        }
        ok('net.rules no clickable world can open a duel it cannot finish',
           clicked > 0 && refused > 0 && wrong.length === 0,
           clicked + ' worlds, ' + refused + ' refused for seating, mismatched: ' +
           (wrong.slice(0, 3).join(' | ') || 'none'));
      });
      T('net.rules a three-seat board is refused at the table and at the start', function () {
        const tri = MAPS.find(m => m.tri);
        const world = { id: 'tri-test', name: 'TEST CONFLUENCE', map: tri.id,
                        kind: 'fortress', owner: 'xeno', arena: null, contested: true };
        const said = Net.duelRefusal(world);
        const phase = Net.phase, table = Net.table;
        const hosted = Net.host(world);
        const untouched = Net.phase === phase && Net.table === table;

        /* And the contract that arrives anyway. A PEER authors this message,
           so refusing it in host() is not the same as refusing it. */
        const bad = contract(SEED);
        bad.world = world; bad.map = tri.id;
        openMatch(bad, 0);
        const live = Net.live;
        const el = document.getElementById('net-fatal');
        const told = !!el && !el.classList.contains('hidden') && /duel board/i.test(el.textContent);
        if (el) el.classList.add('hidden');
        closeMatch();

        /* The positive half, and the deadlock's absence stated as an equality:
           a legal duel gives EVERY seat on the board a slot this relay has a
           producer for. An unanswerable offer has nowhere left to park. */
        openMatch(contract(SEED), 0);
        const covered = Net.offers.length === Net.cfg.seats.length &&
                        Net.offers.length === Game.sides.length;
        const slots = Net.offers.length + '/' + Game.sides.length;
        closeMatch();

        ok('net.rules a three-seat board is refused at the table and at the start',
           !!said && hosted === false && untouched && live === false && told && covered,
           'refused=' + !!said + ' host=' + hosted + ' lobby untouched=' + untouched +
           ' went live=' + live + ' player told=' + told +
           ' offer slots per seat=' + slots);
      });
            return api;
    },

    /**
     * THE ONE-EXIT RULE, measured. Every road out of a duel has to pass through
     * the same teardown. These are the two roads that did not, and neither of
     * them needs a second window, a backgrounded tab or a lost packet: the first
     * needs only a profile with no campaign, which is what a fresh profile and
     * every finished campaign leave behind.
     */
    exit() {
      T('net.exit abandoning with no campaign ends the duel, not just the screen', function () {
        const cfg = contract(SEED);
        openMatch(cfg, 0);
        const sent = [];
        const post = Net.post, camp = Meta.campaign, end = UI.showEnd, menu = UI.toMenu;
        let wentToTitle = false;
        /* Pinned, so the save file this browser happens to hold cannot decide
           whether the check runs. blankProfile ships `campaign: null` and
           campaignEnd puts it back there, and the multiplayer entry path never
           creates one at all -- so null is the ordinary state here, not a
           contrivance. */
        Meta.campaign = () => null;
        Net.post = function (m) { sent.push(m.t); };
        UI.showEnd = function () {};
        UI.toMenu = function () { wentToTitle = true; };
        try {
          /* The real handler behind #btn-quit, answered at its real modal. */
          UI.confirmAbandon();
          const okB = document.getElementById('cfm-ok');
          if (okB) okB.click();
        } finally {
          Net.post = post; Meta.campaign = camp; UI.showEnd = end; UI.toMenu = menu;
          const cf = document.getElementById('confirm-ov');
          if (cf) cf.classList.add('hidden');
        }
        const torn = Net.live === false && Net.lens.on === false;
        const conceded = sent.indexOf('quit') >= 0;
        /* THE CONSEQUENCE, not the flag. With `live` and the lens both still on,
           `this.sides = [...]` inside Game.start goes through the lens SETTER
           and the pushes after it through the GETTER, rebuildView discards what
           was pushed, and the faction assignment reads undefined -- a TypeError
           with no try/catch above it and a dead page until reload. The opts are
           the ones beginMatch itself hands Game.start, so a throw here is the
           stranded lens and cannot be a malformed call. */
        let restart = '';
        try {
          Game.start({ skirmish: true, map: cfg.map, difficulty: cfg.difficulty,
                       commander: cfg.seats[0].commander, faction: cfg.seats[0].faction,
                       loadout: cfg.seats[0].loadout.slice(),
                       musterLoadout: cfg.seats[0].muster.slice(),
                       rival: cfg.seats[1].commander, rivalFaction: cfg.seats[1].faction,
                       worldKind: cfg.world.kind, arena: cfg.world.arena, boons: [] });
        } catch (e) { restart = e.message; }
        closeMatch();
        ok('net.exit abandoning with no campaign ends the duel, not just the screen',
           torn && conceded && !wentToTitle && restart === '',
           'relay torn down=' + torn + ' peer told=' + conceded +
           ' straight to the title=' + wentToTitle +
           ' | the next Game.start ' + (restart ? 'THREW ' + restart : 'ran clean'));
      });

      T('net.exit a voided duel takes the draft modal with it', function () {
        const cfg = contract(SEED);
        openMatch(cfg, 0);
        Net.enterSim(3);
        Net.pendDraft(0, Game.drawMods(Net._realSides[0]));
        Net.exitSim();
        const ov = document.getElementById('overlay-choice');
        const wasUp = !ov.classList.contains('hidden') && Game.state === 'choosing';
        /* The peer goes quiet with the modal open, through the same wall-clock
           timer a real one goes quiet through. */
        Net.lastHeard = Date.now() - NET_PEER_TIMEOUT_MS - 100;
        Net.tickWall();
        const cleared = ov.classList.contains('hidden') &&
                        !Net.offers.filter(Boolean).length && Game.pendingChoice === null;
        /* THE ZOMBIE. A hidden card is still a bound card: click one and the
           engine's own takeMod runs, sets the state back to 'playing', and
           Game.loop steps a dead board behind the void notice -- then pays XP,
           tower mastery and a recorded run when that board finally resolves. */
        const card = ov.querySelector('[data-choice]');
        if (card) card.click();
        const after = Game.state;
        const fatal = document.getElementById('net-fatal');
        /* `required` is what keeps Esc off the only explanation on screen. */
        const explained = !!fatal && !fatal.classList.contains('hidden') &&
                          fatal.classList.contains('required');
        if (fatal) fatal.classList.add('hidden');
        closeMatch();
        ok('net.exit a voided duel takes the draft modal with it',
           wasUp && cleared && !card && after !== 'playing' && explained,
           'draft was up=' + wasUp + ' offer cleared=' + cleared +
           ' stranded card=' + (card ? 'STILL BOUND' : 'none') +
           ' state after the click=' + after + ' notice up and Esc-proof=' + explained);
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
      const GOLD = RIG_GOLD;
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
        a = runClient(cfg, 0, log, 7200, null, { gold: GOLD, doctrine: RAISING_RITE });
        /* The OTHER window: the same log, the same seed, the seats swapped
           over the local and the remote path. */
        b = runClient(cfg, 1, log, 7200, null, { gold: GOLD, doctrine: RAISING_RITE });
        /* The same client as `a`, with the peer's turns arriving empty. */
        deaf = runClient(cfg, 0, log, 7200, null, { gold: GOLD, deaf: true, doctrine: RAISING_RITE });
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
        /* Since Session 26 unit roles, a MUTE seat can still be CREDITED
           kills: the peer's sent infantry dies in melee against the wave
           marching at it, and killEnemy books that death to the seat the
           body was marching ON, the same law a leak has always followed. So
           silence is measured by what the seat DOES (build, send), not by
           what it is credited. */
        const silent = built(deaf.sides[1]) === 0 && sends(deaf.sides[1]) === 0;
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
           (statsAgree && bodiesAgree ? '' : ' | first difference, ' + firstDiff(a, b)));
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
      info('net.wire', 'asynchronous, pass a callback, or read MPT.report() a second later');
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
      api.exit();
      api.pvp();
      api.isolation();
      api.twoClients(2400);
      api.determinism(2400);
      if (typeof BroadcastChannel === 'function') api.wire(done || (r => r));
      else info('net.wire', 'no BroadcastChannel in this browser, the relay is unavailable');
      return api.report();
    }
  };

  return api;
})();
