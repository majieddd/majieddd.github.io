#!/usr/bin/env node
/* PRINT A BOARD, MIRRORED, THE WAY A PLAYER SEES IT.
 *
 * Every other map tool here asserts a property. None of them LOOK at the
 * board, and "the layout does not feel right" is not a property, it is a
 * shape. This renders the finished two-sided field so a human (or me) can
 * read it in one glance.
 *
 *   .  buildable ground        #  block (rubble, unbuildable, shots pass)
 *   =  lane, your half         W  wall (unbuildable, blocks shots)
 *   ~  lane, rival half        o  terrain node
 *   B  your base               b  rival base
 *
 * Usage:
 *   node tools/showboard.js                 one sample of every family
 *   node tools/showboard.js braid 5         five seeds of one family
 *   node tools/showboard.js worlds          every handcrafted planet board
 *   node tools/showboard.js refs            every family REFERENCE board
 *   node tools/showboard.js tri             the three-way grounds (1/2/3 = seats)
 *   node tools/showboard.js ref:labyrinth   one reference board
 *   node tools/showboard.js w_mars          one board by id
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const order = ['mapgen', 'lore', 'story', 'cutscenes', 'planetcuts', 'worldlore', 'missions', 'config', 'worldmaps'];
const src = order.map(n => fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8')).join('\n');
const win = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
const G = new Function('window', 'document', 'self',
  src + '\n; return { MAPS: MAPS, buildField: buildField };').call({}, win, undefined, win);
const MapGen = win.MapGen;

/* Walk waypoints into tiles, the same expansion orthoLane does. */
function tiles(lane) {
  const out = [];
  for (let i = 0; i < lane.length - 1; i++) {
    const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    out.push([x, y]);
    while (x !== x1 || y !== y1) { x += dx; y += dy; out.push([x, y]); }
  }
  return out;
}

function render(fam, seed) {
  const g = MapGen.proceduralGeometry(fam, seed);
  const { cols, rows } = g;
  const grid = [];
  for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill('.'));

  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < cols && y < rows) grid[y][x] = ch; };
  const mir = x => cols - 1 - x;

  for (const [x0, y0, x1, y1] of (g.blocks || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { put(x, y, '#'); put(mir(x), y, '#'); }
  for (const [x0, y0, x1, y1] of (g.walls || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { put(x, y, 'W'); put(mir(x), y, 'W'); }

  let bases = [];
  for (const lane of g.lanes) {
    const ts = tiles(lane);
    for (const [x, y] of ts) { put(x, y, '='); put(mir(x), y, '~'); }
    const end = lane[lane.length - 1];
    bases.push(end);
  }
  for (const [x, y] of bases) { put(x, y, 'B'); put(mir(x), y, 'b'); }
  for (const n of (g.nodes || [])) { const x = n[0], y = n[1]; put(x, y, 'o'); put(mir(x), y, 'o'); }

  const off = bases.filter(([x]) => x < 0 || x >= cols).length;
  console.log('--- ' + fam + '  seed=' + seed + '  ' + cols + 'x' + rows +
              '  lanes=' + g.lanes.length + '  walls=' + (g.walls || []).length +
              '  blocks=' + (g.blocks || []).length + '  nodes=' + (g.nodes || []).length +
              (off ? '  (' + off + ' base off-grid, drawn at the edge)' : ''));
  for (const row of grid) console.log('   ' + row.join(''));
  console.log('');
}

/* AUTHORED BOARDS TOO (Session 44): pass a MAPS id ('w_mars', 'spine') to
   render an authored board, or 'worlds' to page through every handcrafted
   world board. Same glyphs, no MapGen involved: the def IS the geometry. */
function renderAuthored(m) {
  const { cols, rows } = m;
  const grid = [];
  for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill('.'));
  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < cols && y < rows) grid[y][x] = ch; };
  const mir = x => cols - 1 - x;
  for (const [x0, y0, x1, y1] of (m.blocks || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { put(x, y, '#'); put(mir(x), y, '#'); }
  for (const [x0, y0, x1, y1] of (m.walls || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { put(x, y, 'W'); put(mir(x), y, 'W'); }
  const bases = [];
  for (const lane of m.lanes) {
    for (const [x, y] of tiles(lane)) { put(x, y, '='); put(mir(x), y, '~'); }
    bases.push(lane[lane.length - 1]);
  }
  for (const [x, y] of bases) { put(Math.max(0, x), y, 'B'); put(Math.min(cols - 1, mir(x)), y, 'b'); }
  for (const nd of (m.nodes || [])) { put(nd[0], nd[1], 'o'); put(mir(nd[0]), nd[1], 'o'); }
  console.log('--- ' + m.id + '  ' + (m.world ? m.world + '  ' : '') + m.name + '  ' + cols + 'x' + rows +
              '  lanes=' + m.lanes.length + '  walls=' + (m.walls || []).length +
              '  blocks=' + (m.blocks || []).length + '  nodes=' + (m.nodes || []).length +
              (m.terra ? '  [' + m.terra.class + '/' + m.terra.flow + '/' + m.terra.cover + ']' : ''));
  for (const row of grid) console.log('   ' + row.join(''));
  console.log('');
}

/* TRI GROUNDS: absolute coordinates, one lane per commander, no mirror. */
function renderTri(m) {
  const { cols, rows } = m;
  const grid = [];
  for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill('.'));
  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < cols && y < rows) grid[y][x] = ch; };
  for (const [x0, y0, x1, y1] of (m.blocks || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, '#');
  for (const [x0, y0, x1, y1] of (m.walls || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, 'W');
  (m.triLanes || []).forEach((lane, i) => {
    for (const [x, y] of tiles(lane)) put(x, y, String(i + 1));
    const b = lane[lane.length - 1];
    put(b[0], b[1], 'ABC'[i] || 'B');
  });
  for (const spec of (m.triNodes || [])) for (const pt of spec.slice(2)) put(pt[0], pt[1], 'o');
  console.log('--- ' + m.id + '  ' + m.name + '  ' + cols + 'x' + rows + '  THREE-WAY, lanes=' +
              (m.triLanes || []).length + '  blocks=' + (m.blocks || []).length +
              (m.terra ? '  [' + m.terra.class + '/' + m.terra.flow + '/' + m.terra.challenge + ']' : ''));
  for (const row of grid) console.log('   ' + row.join(''));
  console.log('');
}

const arg = process.argv[2];
const n = Number(process.argv[3] || 1);
const fams = [...new Set(G.MAPS.filter(m => m.procedural && m.family).map(m => m.family))];
const byId = arg && G.MAPS.find(m => m.id === arg && !m.procedural && !m.tri && m.lanes);
const REF = win.FAMILY_REFERENCE || [];
const triById = arg && G.MAPS.find(m => m.id === arg && m.tri);
const refByFam = arg && REF.find(r => r.family === arg.replace(/^ref:/, '') && /^ref:/.test(arg));
if (arg === 'worlds') G.MAPS.filter(m => m.world).forEach(renderAuthored);
else if (arg === 'refs') REF.forEach(r => renderAuthored(Object.assign({ id: 'ref:' + r.family }, r)));
else if (arg === 'tri') G.MAPS.filter(m => m.tri).forEach(renderTri);
else if (refByFam) renderAuthored(Object.assign({ id: 'ref:' + refByFam.family }, refByFam));
else if (triById) renderTri(triById);
else if (byId) renderAuthored(byId);
else if (arg && fams.includes(arg)) for (let i = 0; i < n; i++) render(arg, 'seed' + i);
else for (const f of fams) render(f, 'seed0');
