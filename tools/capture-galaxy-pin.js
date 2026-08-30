/* CAPTURE THE GALAXY STREAM PIN.  node tools/capture-galaxy-pin.js
 *
 * Writes tools/fixtures/galaxy-stream-pin.json: for a spread of seeds,
 * factions and mapPool modes, every world's name, owner, kind, seat,
 * contested pair, arena and boon. THE MAP IS DELIBERATELY ABSENT: the world
 * boards batch (docs/WORLDMAPS-DESIGN.md) changes maps BY DESIGN, and this
 * fixture is the proof that nothing else moved. It was captured at the
 * commit BEFORE the override landed (see git history of the fixture file),
 * and tools/probe-worldmaps.js regenerates and asserts equality forever
 * after.
 *
 * Re-running this tool REWRITES the pin. That is only legitimate when a
 * change means to move the stream (a new draw, a reordered table) and says
 * so in its commit; the probe failing plus this file's diff is the review
 * surface for that decision.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story', 'galaxy'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });

const SEEDS = [1, 2, 3, 7, 21, 1024, 20290413, 987654321];
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
/* 0 exercises the no-pin fallback path; 33 is what a fresh campaign pins
   today (MAPS non-tri count at capture time). */
const POOLS = [0, 33];

const out = {};
for (const seed of SEEDS) for (const fac of FACS) for (const pool of POOLS) {
  const g = vm.runInContext(
    'generateGalaxy(' + seed + ',' + JSON.stringify(fac) + ',' + pool + ',1,2)', ctx);
  const rows = [];
  g.systems.forEach(sys => sys.worlds.forEach(w => {
    rows.push([sys.name, w.name, w.owner, w.kind, w.seat ? 1 : 0,
               w.contested ? (w.contestedBy || []).join('+') : '',
               w.renegade ? 1 : 0, w.arena || '', w.boon || ''].join('|'));
  }));
  out[seed + ':' + fac + ':' + pool] = rows;
}

const dir = path.join(ROOT, 'tools', 'fixtures');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'galaxy-stream-pin.json');
fs.writeFileSync(file, JSON.stringify(out, null, 0) + '\n');
const n = Object.keys(out).length;
console.log('pinned ' + n + ' galaxies (' + (n * 35) + ' worlds) to tools/fixtures/galaxy-stream-pin.json');
