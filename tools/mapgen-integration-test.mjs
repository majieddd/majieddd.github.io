/* tools/mapgen-integration-test.mjs — End-to-end check: load mapgen.js + config.js
   in a Node VM, run buildField() on every procedural MAPS entry with several
   seeds, and validate the resulting FIELD exactly as the engine consumes it:
     1. Both sides' lanes exist and share NO tiles (mirror disjointness)
     2. buildMax[0] < buildMax[1], both inside the board → both sides can build
     3. No wall tile sits on either side's lane tiles (no soft-lock after mirror)
     4. Bases differ; sendPaths exist for both sides
     5. Determinism: same seed twice → identical FIELD JSON
   Exits 0 on pass, 1 on any failure. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootWin = path.resolve(here, '..');

function makeSandbox() {
  const sb = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean };
  sb.window = sb;
  sb.globalThis = sb;
  sb.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  sb.document = { getElementById: () => null, addEventListener: () => {}, querySelector: () => null };
  sb.navigator = { userAgent: 'node-test' };
  vm.createContext(sb);
  return sb;
}

function load(file, sb) {
  const code = readFileSync(path.join(rootWin, file), 'utf8');
  vm.runInContext(code, sb, { filename: file });
}

let failures = 0;
const fail = (msg) => { failures++; console.error(`    ✗ FAIL: ${msg}`); };

// --- Load ------------------------------------------------------------------
const sb = makeSandbox();
try {
  load('js/mapgen.js', sb);
  load('js/config.js', sb);
} catch (e) {
  console.error(`FATAL: failed to load scripts in VM: ${e.message}`);
  process.exit(1);
}

if (!sb.window.MapGen || typeof sb.window.buildField !== 'function') {
  // buildField may be a top-level function declaration → on the sandbox itself.
  if (typeof sb.buildField === 'function') sb.window.buildField = sb.buildField;
  else { console.error('FATAL: MapGen or buildField not found'); process.exit(1); }
}

// Top-level const/let bindings live in the context's lexical environment,
// not on the sandbox object — reach them through runInContext.
const MAPS = vm.runInContext('MAPS', sb);
if (!Array.isArray(MAPS)) { console.error('FATAL: MAPS array not found'); process.exit(1); }

const procMaps = MAPS.filter(m => m.procedural);
console.log(`\n=== MapGen integration test (buildField) ===`);
console.log(`Procedural maps in MAPS: ${procMaps.length} of ${MAPS.length}\n`);
if (!procMaps.length) { console.error('FATAL: no procedural maps found'); process.exit(1); }

const SEEDS = ['world-alpha-1', 'world-beta-2', 'world-gamma-3'];

function laneTileSet(lanes) {
  const s = new Set();
  for (const lane of lanes) for (const p of lane) s.add(p[0] + ',' + p[1]);
  return s;
}

for (const m of procMaps) {
  console.log(`${m.id} (${m.family}, minTier=${m.minTier ?? 0}):`);
  for (const seed of SEEDS) {
    const F = sb.window.buildField(m, seed);
    if (!F || !Array.isArray(F.lanes) || F.lanes.length !== 2) { fail(`${seed}: bad FIELD shape`); continue; }

    // 1. Both sides' lanes disjoint (mirror must not overlap the authored side)
    const s0 = laneTileSet(F.lanes[0]), s1 = laneTileSet(F.lanes[1]);
    let overlap = 0;
    for (const k of s0) if (s1.has(k)) overlap++;
    if (overlap) fail(`${seed}: ${overlap} tiles shared between side-0 and side-1 lanes`);

    // 2. buildMax sanity: both sides have a buildable band inside the board
    const [bm0, bm1] = F.buildMax;
    if (!(bm0 < bm1)) fail(`${seed}: buildMax inverted (${bm0} >= ${bm1})`);
    if (bm0 < 0 || bm1 > F.cols - 1) fail(`${seed}: buildMax outside board [${bm0}, ${bm1}] vs cols=${F.cols}`);
    // Side-0 can actually build: some tile with gx <= bm0 exists and is not blocked
    let b0 = false, b1 = false;
    for (let gy = 0; gy < F.rows && (!b0 || !b1); gy++) {
      for (let gx = 0; gx < F.cols; gx++) {
        const k = gx + ',' + gy;
        if (F.terrain.has(k)) continue;
        if (gx <= bm0) b0 = true;
        if (gx >= bm1) b1 = true;
      }
    }
    if (!b0) fail(`${seed}: side 0 has NO buildable tile (bm0=${bm0})`);
    if (!b1) fail(`${seed}: side 1 has NO buildable tile (bm1=${bm1})`);

    // 3. Walls clear of BOTH sides' lanes after mirroring
    let wallOnLane = 0;
    for (const k of F.walls || new Set()) {
      if (s0.has(k) || s1.has(k)) wallOnLane++;
    }
    if (wallOnLane) fail(`${seed}: ${wallOnLane} wall tiles sit on lane tiles`);

    // 4. Bases + send paths
    if (!F.bases[0] || !F.bases[1]) fail(`${seed}: missing bases`);
    else if (JSON.stringify(F.bases[0]) === JSON.stringify(F.bases[1])) fail(`${seed}: both bases identical`);
    if (!Array.isArray(F.sendPaths) || F.sendPaths.length !== 2) fail(`${seed}: sendPaths missing`);

    // 5. Determinism: rebuild with the same seed, compare full FIELD (minus Sets→arrays)
    const F2 = sb.window.buildField(m, seed);
    const norm = f => JSON.stringify({ lanes: f.lanes, bm: f.buildMax, walls: [...f.walls].sort(), terrain: [...f.terrain].sort(), nodes: f.nodes });
    if (norm(F) !== norm(F2)) fail(`${seed}: buildField non-deterministic`);

    console.log(`    seed="${seed.slice(0,12)}…" ${F.cols}x${F.rows} lanes=${F.lanes[0].length}/${F.lanes[1].length} walls=${(F.walls||new Set()).size} bm=[${bm0},${bm1}] bases=ok`);
  }
}

console.log(`\n=== RESULT: ${failures === 0 ? 'PASS ✓' : `FAIL (${failures} failures) ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
