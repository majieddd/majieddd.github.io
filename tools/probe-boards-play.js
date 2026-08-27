/* CAN YOU ACTUALLY FIGHT A BATTLE ON EVERY PROCEDURAL BOARD?
 *
 * tools/probe-mapgen.js checks GEOMETRY properties in node: determinism, the
 * mirror axis, connectivity, buildable space. All of that can hold on a board
 * the engine still cannot run, because geometry is an array and a battle is a
 * simulation. This runs the simulation.
 *
 * For every procedural map id in MAPS it starts a real battle and asserts the
 * things a player would notice in the first ten seconds:
 *
 *   P1  the board builds and produces a defended path for both seats
 *   P2  a tower can actually be placed on it
 *   P3  bodies spawn and MOVE along the lane
 *   P4  bodies reach the end of the lane (the path terminates, so a leak is
 *       reachable and the board can be lost, which also means it can be won)
 *   P5  the engine logs no loop error while it runs
 *   P6  the rival brain finds somewhere to build on it
 *
 * P4 is the one that matters most and is the easiest to skip: a lane that is
 * generated, drawn, and never completed by anything walking it looks perfect
 * in every static check.
 *
 * Runs under tools/headless.js via tools/gate.js.
 */
(function boardsPlay() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', pass: !!cond, detail: String(detail).slice(0, 300) });
  const info = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', pass: true, detail: String(detail).slice(0, 300) });

  const PIN = ['bolt', 'cryo', 'mortar', 'flak'];
  const STEP = 1 / 60;
  const procedural = MAPS.filter(m => m.procedural && m.family);

  const noPath = [], noBuild = [], noMove = [], noArrive = [], errored = [], noRival = [];
  const arrivals = [];

  for (const m of procedural) {
    let started = false;
    try {
      Game.start({ map: m.id, difficulty: 'contested', skirmish: true, loadout: PIN.slice() });
      started = true;
    } catch (e) { errored.push(m.id + ' start threw: ' + e.message); continue; }
    if (!started) continue;

    if (Game.loopErrors) Game.loopErrors.length = 0;

    /* ---- P1 both seats have a road to defend ---------------------------- */
    let p0 = [], p1 = [];
    try { p0 = Game.defendedPaths(0) || []; p1 = Game.defendedPaths(1) || []; }
    catch (e) { noPath.push(m.id + ': defendedPaths threw ' + e.message); continue; }
    if (!p0.length || !p1.length || !p0[0] || !p0[0].total) {
      noPath.push(m.id + ': seat0 ' + p0.length + ' paths, seat1 ' + p1.length + ' paths');
      continue;
    }

    /* ---- P2 something can be built ------------------------------------- */
    /* FIELD.cols / FIELD.rows, NOT Game.cols / Game.rows. Game carries
       neither (measured: both `undefined`), so the first cut of this loop
       never executed its body once and reported that no tower could be built
       on ANY of the fifteen boards, including the seven that have shipped for
       months. canBuild itself reads FIELD, which is what gave it away. */
    let built = false;
    for (let gy = 0; gy < FIELD.rows && !built; gy++)
      for (let gx = 0; gx < FIELD.cols && !built; gx++)
        if (Game.canBuild(0, gx, gy, 1)) {
          Game.sides[0].gold = 9999;
          built = !!Game.build(0, 'bolt', gx, gy);
        }
    if (!built) noBuild.push(m.id);

    /* ---- P3 and P4 bodies walk the road, and get to the end ------------- */
    /* Spawned directly rather than waiting for a wave, so this measures the
       PATH and not the wave scheduler. `dist` along the path is the honest
       measure of movement: x and y can stay equal across a vertical leg. */
    const before = Game.enemies.length;
    for (let i = 0; i < 6; i++)
      try { Game.spawnFromQueue({ side: 0, type: 'trooper', lane: 0, hpMul: 1, bountyMul: 1, rageMul: 1 }); }
      catch (e) { errored.push(m.id + ' spawn threw: ' + e.message); }
    const spawned = Game.enemies.length - before;
    if (!spawned) { noMove.push(m.id + ': nothing spawned'); continue; }

    const watched = Game.enemies.filter(e => !e.dead && !e.leaked);
    const startDist = watched.map(e => e.dist || 0);
    const total = (watched[0] && watched[0].path && watched[0].path.total) || p0[0].total;

    /* THE BUDGET IS DERIVED FROM THE LANE, not guessed. A flat 3000 steps is
       50 seconds and spiral's lane is 3154px at trooper speed 1.15 tiles per
       second, about 68 seconds of walking: the flat budget failed spiral and
       only spiral, which reads exactly like a broken board and was a short
       timer. Distance over speed, times three for slows, blocks and the
       melee that a contested board puts in the way. */
    const pxPerSec = (ENEMY_TYPES.trooper.speed || 1) * TILE;
    const budget = Math.ceil((total / pxPerSec) * 60 * 3) + 600;
    let arrived = false, steps = 0;
    for (; steps < budget && !arrived; steps++) {
      try { Game.step(STEP); } catch (e) { errored.push(m.id + ' step threw: ' + e.message); break; }
      for (const e of watched) {
        if (e.leaked) { arrived = true; break; }
        if (e.path && (e.dist || 0) >= (e.path.total || total) - 1) { arrived = true; break; }
      }
    }
    const moved = watched.some((e, i) => (e.dist || 0) > startDist[i] + 1);
    if (!moved) noMove.push(m.id + ': ' + spawned + ' bodies, none advanced along the path');
    if (!arrived) noArrive.push(m.id + ': no body reached the end of a ' + Math.round(total) + 'px lane in ' + steps + ' steps');
    else arrivals.push(m.id + '=' + steps);

    if (Game.loopErrors && Game.loopErrors.length)
      errored.push(m.id + ': ' + Game.loopErrors.length + ' loop errors, first ' +
                   String(Game.loopErrors[0] && (Game.loopErrors[0].msg || Game.loopErrors[0])).slice(0, 90));

    /* ---- P6 the rival can hold ground here too -------------------------- */
    let rivalBuilt = false;
    for (let gy = 0; gy < FIELD.rows && !rivalBuilt; gy++)
      for (let gx = 0; gx < FIELD.cols && !rivalBuilt; gx++)
        if (Game.canBuild(1, gx, gy, 1)) rivalBuilt = true;
    if (!rivalBuilt) noRival.push(m.id);
  }

  info('P0 boards exercised', procedural.length + ' procedural boards: ' +
       procedural.map(m => m.id).join(', '));

  ok('P1 every procedural board gives both seats a road to defend',
     noPath.length === 0,
     noPath.length ? noPath.join('; ') : 'all ' + procedural.length + ' boards produced a defended path for seat 0 and seat 1');

  ok('P2 a tower can be placed on every procedural board',
     noBuild.length === 0,
     noBuild.length ? 'no legal build tile: ' + noBuild.join(', ')
                    : 'every board accepted a real Game.build on a canBuild tile');

  ok('P3 bodies spawn and advance along the lane',
     noMove.length === 0,
     noMove.length ? noMove.join('; ') : 'bodies advanced on all ' + procedural.length + ' boards');

  ok('P4 a body can walk the whole lane and reach the end',
     noArrive.length === 0,
     noArrive.length ? noArrive.join('; ')
                     : 'a body completed the lane on every board (steps to first arrival: ' +
                       arrivals.slice(0, 5).join(', ') + (arrivals.length > 5 ? ', ...' : '') + ')');

  ok('P5 no engine loop error on any procedural board',
     errored.length === 0,
     errored.length ? errored.slice(0, 3).join('; ') : 'no throws and no entries in Game.loopErrors');

  ok('P6 the rival has ground to build on too',
     noRival.length === 0,
     noRival.length ? 'seat 1 has no legal tile on: ' + noRival.join(', ')
                    : 'seat 1 found buildable ground on every board');

  const pass = C.filter(c => c.verdict === 'PASS').length;
  const fail = C.filter(c => c.verdict === 'FAIL').length;
  const out = { pass: pass, fail: fail, info: C.length - pass - fail, checks: C };
  window.__SWEEP = out;
  return out;
})()
