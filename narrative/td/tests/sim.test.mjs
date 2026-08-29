// Headless sim test. Loads data.js + sim.js as classic scripts into one VM context.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const DIR = path.dirname(path.dirname(fs.realpathSync(new URL(import.meta.url))));
const ctx = { Math, Set, console, globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['02_data.js', '03_sim.js']) {
  const code = fs.readFileSync(path.join(DIR, 'src', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const { GameSim, TOWERS, TOWER_ORDER } = ctx;

let failures = 0;
const ok = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failures++; } };

const sim = new GameSim({ seed: 7 });
ok(sim.path.length > 2, 'path built');
ok(sim.gold === 220, 'starting gold');

const spots = [[5,0],[5,2],[10,2],[10,4],[15,0],[15,4],[6,3],[11,6],[16,6],[20,9]];
let placed = 0;
for (const [c, r] of spots) {
  for (const t of TOWER_ORDER) {
    if (sim.gold >= TOWERS[t].cost) { if (sim.placeTower(t, c, r).ok) { placed++; break; } }
  }
}
ok(placed > 0, `towers placed (${placed})`);

function playToEnd(seed) {
  const s = new GameSim({ seed });
  for (const [c, r] of spots) for (const t of TOWER_ORDER) { if (s.gold >= TOWERS[t].cost) { if (s.placeTower(t, c, r).ok) break; } }
  let f = 0;
  while (s.state === 'playing' && f < 60 * 60 * 12) { f++; if (!s.waveActive) s.startNextWave(false); s.update(1/60); if (f % 60 === 0) for (const t of s.towers) if (s.gold > 200 && t.level < 3) s.upgradeTower(t.id); s.drainEvents(); }
  return s;
}

const r = playToEnd(7);
ok(r.state !== 'playing', `game terminated (state=${r.state})`);
ok(r.kills > 0, `enemies killed (${r.kills})`);
ok(r.score > 0, `score accrued (${r.score})`);
ok(r.waveIndex >= 0, `waves ran (${r.waveIndex + 1}/${r.totalWaves})`);

const a = playToEnd(7), b = playToEnd(7);
ok(a.kills === b.kills && a.score === b.score && a.waveIndex === b.waveIndex, `deterministic (a.kills=${a.kills} b.kills=${b.kills})`);

// Balance sanity: a competent line should win the campaign.
ok(r.state === 'victory', `campaign winnable with a solid line (state=${r.state})`);

console.log(`kills=${r.kills} leaks=${r.leaks} score=${r.score} waves=${(r.waveIndex + 1)}/${r.totalWaves} state=${r.state} time=${r.time.toFixed(0)}s`);
if (failures === 0) console.log('SIM TESTS PASS');
else { console.error(`${failures} FAILURE(S)`); process.exit(1); }
