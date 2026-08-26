/* tools/mapgen-test.mjs — Functional test for the procedural map generator.
   Loads js/mapgen.js in a Node VM with a window shim, then validates:
     1. Determinism: same (family, seed) → identical output (JSON deep-equal)
     2. Board shape: even cols (mirror axis between columns), sane size
     3. Lane waypoints: x in [-1, (cols-2)/2] (left half + off-grid exit),
        y in [0, rows); consecutive waypoints differ in exactly ONE coordinate
        (orthoLane silently drops diagonal segments — this catches that bug)
     4. Mirror disjointness: no authored lane tile sits right of the axis, so
        buildField's mirrored rival lanes can never overlap the authored ones
     5. Walls: left half only; NO wall tile on a lane or its mirror (soft-lock)
     6. Blocks/nodes: within bounds and in the left half; 'lane' nodes ON lanes
     7. Buildability: min first-waypoint x >= 3 so BOTH sides have build space,
        and total buildable ratio > 25%
   Exits 0 on pass, 1 on any failure. Prints per-family summary. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

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
function fail(msg) { failures++; console.error(`    ✗ FAIL: ${msg}`); }
function ok(msg)   { console.log(`  ✓ ${msg}`); }

// --- Load generator -------------------------------------------------------
const sb = loadBrowserScript('js/mapgen.js');
if (!sb.window.MapGen || typeof sb.window.MapGen.proceduralGeometry !== 'function') {
  console.error('FATAL: MapGen.proceduralGeometry not found after loading js/mapgen.js');
  process.exit(1);
}
const gen = sb.window.MapGen.proceduralGeometry;

// --- Helpers ---------------------------------------------------------------
/** Flatten a geometry key (array of [x,y] pairs) into a Set of "x,y". */
function collectTiles(geo, key) {
  const out = new Set();
  for (const t of geo[key] || []) {
    if (Array.isArray(t)) out.add(t[0] + ',' + t[1]);
  }
  return out;
}

/** Expand a lane's waypoints into its full tile set (mirrors orthoLane). */
function expandLane(lane) {
  const s = new Set();
  for (let i = 0; i < lane.length - 1; i++) {
    const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
    if (y0 === y1) {
      const step = x1 > x0 ? 1 : -1;
      for (let x = x0; x !== x1; x += step) s.add(x + ',' + y0);
    } else if (x0 === x1) {
      const step = y1 > y0 ? 1 : -1;
      for (let y = y0; y !== y1; y += step) s.add(x0 + ',' + y);
    } // diagonal: dropped by orthoLane too — flagged separately in the test
  }
  const last = lane[lane.length - 1];
  s.add(last[0] + ',' + last[1]);
  return s;
}

/** Mirror a tile set across the vertical axis (buildField's mirror). */
function mirrorSet(set, cols) {
  const out = new Set();
  for (const k of set) {
    const c = k.indexOf(',');
    out.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
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
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${seed}: non-deterministic output`);

    if (!a || typeof a !== 'object') { fail(`${seed}: null geometry`); continue; }
    const cols = a.cols, rows = a.rows;

    // 2. Board shape
    if (cols % 2 !== 0) fail(`${seed}: odd cols=${cols} — mirror axis lands on a column`);
    if (cols < 20 || rows < 12) fail(`${seed}: implausibly small field ${cols}x${rows}`);

    const leftMax = (cols - 2) / 2;   // rightmost authored column for even cols

    // 3+4. Lane waypoints: bounds, orthogonality, left-half containment
    let laneTiles = new Set();
    for (const lane of a.lanes || []) {
      if (!lane.length) fail(`${seed}: empty lane`);
      for (let i = 0; i < lane.length - 1; i++) {
        const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
        if (x0 !== x1 && y0 !== y1) fail(`${seed}: diagonal segment (${x0},${y0})->(${x1},${y1}) — orthoLane drops it`);
      }
      for (const [x, y] of lane) {
        if (x < -1 || x > leftMax) fail(`${seed}: lane waypoint x=${x} outside [-1, ${leftMax}]`);
        if (y < 0 || y >= rows) fail(`${seed}: lane waypoint y=${y} outside [0, ${rows})`);
      }
      for (const k of expandLane(lane)) {
        const x = Number(k.slice(0, k.indexOf(',')));
        if (x > leftMax) fail(`${seed}: expanded lane tile (${k}) right of mirror axis — rival lanes would overlap`);
        laneTiles.add(k);
      }
    }

    // 5. Walls: bounds, left half, no soft-lock on authored OR mirrored lanes
    const mirroredLanes = mirrorSet(laneTiles, cols);
    for (const [x0, y0, x1, y1] of a.walls || []) {
      if (x0 < 0 || y0 < 0 || x1 >= cols || y1 >= rows) fail(`${seed}: wall rect out of bounds`);
      if (x1 > leftMax) fail(`${seed}: wall extends past mirror axis (x1=${x1} > ${leftMax})`);
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++) {
          const k = tx + ',' + ty, mk = (cols - 1 - tx) + ',' + ty;
          if (laneTiles.has(k)) fail(`${seed}: wall tile ${k} on an authored lane (soft-lock)`);
          if (mirroredLanes.has(k)) fail(`${seed}: wall tile ${k} on a mirrored lane (soft-lock)`);
        }
    }

    // 6. Blocks + nodes: bounds and left half; 'lane' nodes sit on lanes
    for (const [x0, y0, x1, y1] of a.blocks || []) {
      if (x0 < 0 || y0 < 0 || x1 >= cols || y1 >= rows) fail(`${seed}: block rect out of bounds`);
      if (x1 > leftMax) fail(`${seed}: block extends past mirror axis (x1=${x1} > ${leftMax})`);
    }
    for (const [nx, ny, el, kind] of a.nodes || []) {
      if (nx < 0 || nx > leftMax || ny < 0 || ny >= rows) fail(`${seed}: node (${nx},${ny}) out of authored half`);
      if (!el) fail(`${seed}: node with no element`);
      if (kind === 'lane' && !laneTiles.has(nx + ',' + ny)) fail(`${seed}: lane-kind node (${nx},${ny}) not on a lane tile`);
    }

    // 7. Buildability: both sides must have build space; ratio > 25%
    const firstXs = (a.lanes || []).map(l => l[0][0]);
    if (!firstXs.length) fail(`${seed}: no lanes at all`);
    const minFirst = Math.min(...firstXs);
    if (minFirst < 3) fail(`${seed}: first waypoint x=${minFirst} — buildMax would leave a side with no build space`);
    // Occupied after mirroring: lanes + mirrors + blocks + block-mirrors + walls + wall-mirrors
    const occupied = new Set(laneTiles);
    for (const k of mirroredLanes) occupied.add(k);
    for (const [x0, y0, x1, y1] of a.blocks || []) {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        occupied.add(tx + ',' + ty); occupied.add((cols - 1 - tx) + ',' + ty);
      }
    }
    for (const [x0, y0, x1, y1] of a.walls || []) {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        occupied.add(tx + ',' + ty); occupied.add((cols - 1 - tx) + ',' + ty);
      }
    }
    const ratio = (cols * rows - occupied.size) / (cols * rows);
    if (ratio < 0.25) fail(`${seed}: only ${(ratio*100).toFixed(1)}% buildable (< 25%)`);

    console.log(`    seed="${seed.slice(0,12)}…" ${cols}x${rows} lanes=${a.lanes.length} walls=${(a.walls||[]).length} blocks=${(a.blocks||[]).length} nodes=${(a.nodes||[]).length} buildable=${(ratio*100).toFixed(1)}%`);
  }
}

// Cross-family diversity: different families should produce different geometry
console.log(`\n--- Cross-family diversity (seed="world-alpha-1") ---`);
const sigs = new Map();
for (const family of FAMILIES) {
  const g = gen(family, 'world-alpha-1');
  const sig = JSON.stringify([g.cols, g.rows, collectTiles(g,'walls').size, (g.lanes||[]).map(l=>l.length)]);
  if (sigs.has(sig)) fail(`family "${family}" has identical shape signature to another family: ${sig}`);
  sigs.set(sig, family);
}
ok(`${FAMILIES.length}/${FAMILIES.length} families produce distinct geometry signatures`);

// --- Result ----------------------------------------------------------------
console.log(`\n=== RESULT: ${failures === 0 ? 'PASS ✓' : `FAIL (${failures} failures) ✗`} ===`);
process.exit(failures === 0 ? 0 : 1);
