// Headless simulation test: runs a full auto-played game and asserts invariants.
import { GameSim } from '../src/core/sim.js';
import { TOWERS, TOWER_ORDER } from '../src/core/data.js';

let failures = 0;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failures++; } };

const sim = new GameSim({ seed: 7 });
ok(sim.path.length > 2, 'path built');
ok(sim.gold === 220, 'starting gold');

// Build a defensive line: a ring of mixed towers around the path.
const spots = [[5,0],[5,2],[10,2],[10,4],[15,0],[15,4],[6,3],[11,6],[16,6],[20,9]];
let placed = 0;
for (const [c, r] of spots) {
  // pick a tower we can afford
  for (const t of TOWER_ORDER) {
    if (sim.gold >= TOWERS[t].cost) { const res = sim.placeTower(t, c, r); if (res.ok) { placed++; break; } }
  }
}
ok(placed > 0, `towers placed (${placed})`);

// Auto-play: start each wave when available, run with fixed dt, upgrade occasionally.
let frames = 0;
const dt = 1 / 60;
let safety = 0;
while (sim.state === 'playing' && safety < 60 * 60 * 12) {
  safety++;
  if (!sim.waveActive) sim.startNextWave(false);
  sim.update(dt);
  // spend spare gold on upgrades every ~second
  if (frames % 60 === 0) {
    for (const t of sim.towers) {
      if (sim.gold > 200 && t.level < 3) { sim.upgradeTower(t.id); }
    }
  }
  frames++;
  sim.drainEvents();
  if (sim.time > 0 && !sim.waveActive && sim.enemies.length === 0) {
    // small pause then next wave auto-starts next loop
  }
}
ok(sim.state !== 'playing', `game terminated (state=${sim.state}, frames=${frames}, t=${sim.time.toFixed(1)}s)`);
ok(sim.kills > 0, `enemies killed (${sim.kills})`);
ok(sim.score > 0, `score accrued (${sim.score})`);
ok(sim.waveIndex >= 0, `waves ran (reached ${sim.waveIndex + 1}/${sim.totalWaves})`);

// Determinism check: same seed + identical actions => identical final state.
function playToEnd(seed) {
  const s = new GameSim({ seed });
  for (const [c, r] of spots) for (const t of TOWER_ORDER) { if (s.gold >= TOWERS[t].cost) { if (s.placeTower(t, c, r).ok) break; } }
  let f = 0;
  while (s.state === 'playing' && f < 60 * 60 * 12) { f++; if (!s.waveActive) s.startNextWave(false); s.update(dt); if (f % 60 === 0) for (const t of s.towers) if (s.gold > 200 && t.level < 3) s.upgradeTower(t.id); s.drainEvents(); }
  return s;
}
const a = playToEnd(7);
const b = playToEnd(7);
ok(a.kills === b.kills && a.score === b.score && a.waveIndex === b.waveIndex, `deterministic (a.kills=${a.kills} b.kills=${b.kills})`);

console.log(`kills=${sim.kills} leaks=${sim.leaks} score=${sim.score} waves=${(sim.waveIndex + 1)}/${sim.totalWaves} state=${sim.state} time=${sim.time.toFixed(0)}s`);
if (failures === 0) console.log('SIM TESTS PASS');
else { console.error(`${failures} FAILURE(S)`); process.exit(1); }
