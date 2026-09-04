/* Browser performance pins for the targeting hot path optimized in this
   batch. The comparisons run back to back in one page so thermal state,
   browser version, viewport and GPU are shared. Absolute milliseconds are
   reported as INFO; only semantic parity and large relative wins are gates.

   Load on a fresh page by fetch and indirect eval, the same way gate.js loads
   owner-sweep. This mutates game state and must not share a page with another
   harness. */
(async function () {
  'use strict';

  const checks = [];
  function add(id, verdict, detail) { checks.push({ id, verdict, detail }); }
  function stat(values) {
    const s = values.slice().sort((a, b) => a - b);
    const at = f => s[Math.min(s.length - 1, Math.floor(s.length * f))];
    return {
      n: s.length,
      p50: +at(0.50).toFixed(3),
      p95: +at(0.95).toFixed(3),
      max: +s[s.length - 1].toFixed(3),
      total: +s.reduce((a, b) => a + b, 0).toFixed(3)
    };
  }
  function sameList(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  /* Stop the page's standing rAF. Every measurement below is then driven by
     this harness alone rather than racing the game's normal frame. */
  Game.loop = function () {};
  const p = Meta.load();
  p.seenEnemies = Object.keys(ENEMY_TYPES);
  Meta.save();
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-game').classList.remove('hidden');
  Game.start({ maelstrom: 20, epoch: 0, skirmish: true, difficulty: 'contested',
               seed: 4242, commander: COMMANDERS[0].id, faction: 'human',
               loadout: ['bolt', 'cryo', 'mortar', 'flak'] });
  Game.state = 'menu';
  /* Meta.save is deliberately coalesced on a timer. Let that unrelated write
     finish before timing, or one branch inherits a roughly 400ms interruption
     depending on which happens to run when the timer fires. */
  await new Promise(resolve => setTimeout(resolve, 500));

  /* Twenty boards, 1,200 bodies, original order retained inside every pool.
     The distribution makes nineteen twentieths of the old scan guaranteed
     rejects while still leaving targets in and out of every tower's range. */
  const realEnemies = Game.enemies;
  const realWalls = FIELD.walls;
  const enemies = Array.from({ length: 1200 }, (_, i) => ({
    dead: false, leaked: false, hostileTo: i % 20,
    flying: i % 11 === 0, grounded: i % 23 === 0,
    x: (i * 37) % 2200, y: (i * 91) % 1400,
    remaining: i % 173, hp: 100 + i, shield: i % 7
  }));
  const towers = [];
  for (let side = 0; side < 20; side++) for (const mode of TARGET_MODES.map(m => m.id)) {
    towers.push({
      x: 120 + side * 31, y: 160 + side * 17,
      rangePx: 180 + (side % 3) * 25, side,
      stats: { spotting: 0, minRange: side % 4 === 0 ? 0.5 : 0 },
      def: { groundOnly: side % 5 === 0, airOnly: side % 7 === 0 },
      targetMode: mode, spottedFor: function () { return false; }
    });
  }
  Game.enemies = enemies;
  FIELD.walls = new Set();
  TARGET_POOLS.length = 20;
  for (let i = 0; i < 20; i++) TARGET_POOLS[i] = [];
  for (const e of enemies) TARGET_POOLS[e.hostileTo].push(e);

  TARGET_POOLS_ACTIVE = false;
  const fullOne = towers.map(t => Tower.prototype.acquire.call(t, Game.enemies));
  const fullAll = towers.map(t => Tower.prototype.acquireAll.call(t, Game.enemies));
  TARGET_POOLS_ACTIVE = true;
  const pooledOne = towers.map(t => Tower.prototype.acquire.call(t, Game.enemies));
  const pooledAll = towers.map(t => Tower.prototype.acquireAll.call(t, Game.enemies));
  TARGET_POOLS_ACTIVE = false;
  const targetParity = fullOne.every((v, i) => v === pooledOne[i]) &&
                       fullAll.every((v, i) => sameList(v, pooledAll[i]));
  add('perf.1 target pools preserve target and area order', targetParity ? 'PASS' : 'FAIL',
      towers.length + ' tower/mode cases, acquire and acquireAll parity ' + targetParity);

  function targetBench(pooled, rounds) {
    const samples = [];
    let hits = 0;
    TARGET_POOLS_ACTIVE = pooled;
    for (let r = 0; r < rounds; r++) {
      const t0 = performance.now();
      for (const t of towers)
        if (Tower.prototype.acquire.call(t, Game.enemies)) hits++;
      samples.push(performance.now() - t0);
    }
    TARGET_POOLS_ACTIVE = false;
    return { stat: stat(samples), hits };
  }
  targetBench(false, 15);
  targetBench(true, 15);
  const targetFull = targetBench(false, 180);
  const targetPooled = targetBench(true, 180);
  const targetSpeedup = targetFull.stat.total / Math.max(0.001, targetPooled.stat.total);
  add('perf.2 target pools remove cross-board scan cost',
      targetSpeedup >= 2 && targetFull.hits === targetPooled.hits ? 'PASS' : 'FAIL',
      targetSpeedup.toFixed(2) + 'x, full ' + targetFull.stat.total + 'ms, pooled ' +
      targetPooled.stat.total + 'ms, hits ' + targetFull.hits + '/' + targetPooled.hits);

  Game.enemies = realEnemies;
  FIELD.walls = realWalls;

  add('perf.info target-cost samples', 'INFO', JSON.stringify({
    targetFull: targetFull.stat,
    targetPooled: targetPooled.stat
  }));

  const pass = checks.filter(c => c.verdict === 'PASS').length;
  const fail = checks.filter(c => c.verdict === 'FAIL').length;
  const info = checks.filter(c => c.verdict === 'INFO').length;
  return { pass, fail, info, checks };
})();
