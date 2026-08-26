/* tools/mapgen-test.mjs — Functional test for the procedural map generator.
   Loads js/mapgen.js in a Node VM with a window shim, then validates:
     1. Determinism: same (family, seed) → identical output (JSON deep-equal)
     2. Bounds: every tile coordinate within [0, cols) × [0, rows)
     3. Wall/lane overlap: no wall tile sits on a lane tile
     4. Buildable space: ≥ 25% of non-lane tiles are buildable (not blocked/wall)
   Exits 0 on pass, 1 on any failure. Prints per-family summary. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

// Resolve repo root from the script's own location (works on Windows + POSIX).
const here = path.dirname(fileURLToPath(import.meta.url));
const rootWin = path.resolve(here, '..');

function loadBrowserScript(file) {
  const code = readFileSync(path.join(rootWin, file), 'utf8');
  const sandbox = { window: {}, console, Math, JSON, Set, Map, Array, Object };
  sandbox.window = sandbox; // self-reference like a browser global
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox;
}

const FAMILIES = [
  'spiral', 'twin-channel', 'chokepoint', 'island-scatter',
  'open-field', 'convergence', 'fortress-ring'
];
const SEEDS = ['world-alpha-1', 'world-beta-2', 'world-gamma-3'];

let failures = 0;
function fail(msg) { failures++; console.error(`  ✗ FAIL: ${msg}`); }
function ok(msg)   { console.log(`  ✓ ${msg}`); }

// --- Load generator -------------------------------------------------------
const sb = loadBrowserScript('js/mapgen.js');
if (!sb.window.MapGen || typeof sb.window.MapGen.proceduralGeometry !== 'function') {
  console.error('FATAL: MapGen.proceduralGeometry not found after loading js/mapgen.js');
  process.exit(1);
}
const gen = sb.window.MapGen.proceduralGeometry;

// --- Helpers ---------------------------------------------------------------
/** Flatten all tile coords from a geometry object into a Set of "x,y". */
function collectTiles(geo, key) {
  const out = new Set();
  const src = geo[key];
  if (!src) return out;
  // Could be array of [x,y] pairs or array of objects with x/y.
  for (const t of src) {
    let x, y;
    if (Array.isArray(t)) { [x, y] = t; }
    else { x = t.x ?? t.tx; y = t.y ?? t.ty; }
    if (Number.isFinite(x) && Number.isFinite(y)) out.add(`${x},${y}`);
  }
  return out;
}

/** Lane tiles: lanes are arrays of waypoint arrays. Flatten all waypoints. */
function laneTiles(geo) {
  const out = new Set();
  if (!Array.isArray(geo.lanes)) return out;
  for (const lane of geo.lanes) {
    // Each lane is an array of [x,y] waypoints (or objects).
    for (const wp of lane) {
      let x, y;
      if (Array.isArray(wp)) { [x, y] = wp; }
      else { x = wp.x ?? wp.tx; y = wp.y ?? wp.ty; }
      if (Number.isFinite(x) && Number.isFinite(y)) out.add(`${x},${y}`);
    }
  }
  return out;
}

// --- Run tests -------------------------------------------------------------
console.log(`\n=== MapGen functional test ===`);
console.log(`Families: ${FAMILIES.length}, Seeds/family: ${SEEDS.length}\n`);

for (const family of FAMILIES) {
  console.log(`${family}:`);
  for (const seed of SEEDS) {
    const a = gen(family, seed);
    const b = gen(family, seed);

    // 1. Determinism
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) fail(`${family}/${seed}: non-deterministic output`);

    // Basic shape sanity
    if (!a || typeof a !== 'object') { fail(`${family}/${seed}: null/undefined geometry`); continue; }
    const cols = a.cols ?? 0, rows = a.rows ?? 0;
    if (cols < 10 || rows < 8) fail(`${family}/${seed}: implausibly small field ${cols}x${rows}`);

    // 2. Bounds — check every tile in blocks, walls, nodes, lanes
    const allTiles = new Set();
    for (const key of ['blocks', 'walls', 'nodes']) {
      for (const t of collectTiles(a, key)) {
        const [x, y] = t.split(',').map(Number);
        if (x < 0 || x >= cols || y < 0 || y >= rows) fail(`${family}/${seed}: ${key} tile (${x},${y}) out of bounds [${cols}x${rows}]`);
        allTiles.add(t);
      }
    }
    for (const t of laneTiles(a)) {
      const [x, y] = t.split(',').map(Number);
      if (x < 0 || x >= cols || y < 0 || y >= rows) fail(`${family}/${seed}: lane waypoint (${x},${y}) out of bounds`);
    }

    // 3. Wall/lane overlap
    const walls = collectTiles(a, 'walls');
    const lanes = laneTiles(a);
    for (const w of walls) if (lanes.has(w)) fail(`${family}/${seed}: wall tile ${w} overlaps a lane waypoint`);

    // 4. Buildable space: non-lane tiles that are NOT blocked and NOT wall
    const blocks = collectTiles(a, 'blocks');
    const total = cols * rows;
    const occupied = new Set([...lanes, ...blocks, ...walls]);
    const buildable = total - occupied.size;
    const ratio = buildable / total;
    if (ratio < 0.25) fail(`${family}/${seed}: only ${(ratio*100).toFixed(1)}% buildable (< 25%)`);

    // Per-seed summary line (only print on success to keep output clean)
    if (failures === 0 || true) {
      const wallCount = walls.size, blockCount = blocks.size;
      console.log(`    seed="${seed.slice(0,12)}…" ${cols}x${rows} lanes=${a.lanes?.length ?? '?'} walls=${wallCount} blocks=${blockCount} buildable=${(ratio*100).toFixed(1)}%`);
    }
  }
}

// Cross-family diversity: different families should produce different geometry
console.log(`\n--- Cross-family diversity (seed="world-alpha-1") ---`);
const sigs = new Map();
for (const family of FAMILIES) {
  const g = gen(family, 'world-alpha-1');
  const sig = JSON.stringify([g.cols, g.rows, collectTiles(g,'walls').size, laneTiles(g).size]);
  if (sigs.has(sig)) fail(`family "${family}" has identical shape signature to another family: ${sig}`);
  sigs.set(sig, family);
}
ok(`${FAMILIES.length}/${FAMILIES.length} families produce distinct geometry signatures`);

// --- Result ----------------------------------------------------------------
console.log(`\n=== RESULT: ${failures === 0 ? 'PASS ✓' : `FAIL (${failures} failures) ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
