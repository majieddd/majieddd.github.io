#!/usr/bin/env node
/* ARE THE PROCEDURAL BOARDS ACTUALLY PLAYABLE?
 *
 * WHY THIS EXISTS, and what the earlier pass did NOT prove. Session 38 shipped
 * eight new lane families and verified exactly one thing about them: that
 * MapGen.proceduralGeometry returns lanes without throwing, across 1800 boards.
 * That is generation, not playability. "It produced an array" and "a player can
 * fight on it" are different claims, and only the first had evidence.
 *
 * Everything below is a property of the board that a human would notice
 * immediately and a throw-counter never will:
 *
 *   G1  determinism        same (family, seed) twice, byte-identical
 *   G2  half-width         the authored lane stays left of the mirror axis
 *   G3  connectivity       consecutive waypoints are orthogonal and the lane
 *                          is one continuous run of tiles
 *   G4  lane is walkable   no wall or block sits on a lane tile
 *   G5  buildable space    enough free tiles to actually place towers
 *   G6  lane coverage      every lane tile has a buildable tile within range
 *   G7  base and spawn     the two ends are distinct and far apart
 *   G8  mirror sanity      the mirrored board has no lane tile colliding with
 *                          its own reflection
 *
 * Run: node tools/probe-mapgen.js [seedCount]
 * Exit 1 on any failure. Wired into tools/gate.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEEDS = Number(process.argv[2] || 60);

/* Same loader shape as tools/facts.js: load the real modules, never scrape. */
function load() {
  const order = ['mapgen', 'lore', 'story', 'cutscenes', 'planetcuts', 'worldlore', 'missions', 'config'];
  const src = order.map(n => fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8')).join('\n');
  const win = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const g = new Function('window', 'document', 'self',
    src + '\n; return { MAPS: MAPS, buildField: buildField, TILE: typeof TILE !== "undefined" ? TILE : 40 };')
    .call({}, win, undefined, win);
  g.MapGen = win.MapGen;
  return g;
}

const C = [];
const ok = (id, cond, detail) => C.push({ id, pass: !!cond, detail: String(detail) });

const G = load();
const procedural = G.MAPS.filter(m => m.procedural && m.family);
const fams = [...new Set(procedural.map(m => m.family))];

const key = (x, y) => x + ',' + y;

/* Tiles a lane actually occupies: waypoints are corners, the lane is the
   orthogonal run between them. This is the same walk buildField's consumers
   do, so a lane that is not orthogonal shows up as a gap. */
function laneTiles(lane) {
  const out = [];
  const gaps = [];
  for (let i = 0; i < lane.length - 1; i++) {
    const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
    if (x0 !== x1 && y0 !== y1) { gaps.push(i + ':' + x0 + ',' + y0 + '->' + x1 + ',' + y1); continue; }
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    out.push([x, y]);
    while (x !== x1 || y !== y1) { x += dx; y += dy; out.push([x, y]); }
  }
  if (!lane.length) return { tiles: [], gaps: ['empty lane'] };
  return { tiles: out, gaps };
}

const failures = { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [], G10: [] };
/* Per-family tallies for the two LAYOUT properties, which are shares rather
   than pass/fail per board: a single node landing awkwardly is not a defect,
   a family placing most of them out of reach is. */
const layout = {};
let boards = 0;

for (const fam of fams) {
  const map = procedural.find(m => m.family === fam);
  for (let s = 0; s < SEEDS; s++) {
    const seed = fam + '-seed-' + s;
    let a, b;
    try {
      a = G.MapGen.proceduralGeometry(fam, seed);
      b = G.MapGen.proceduralGeometry(fam, seed);
    } catch (e) { failures.G1.push(fam + ' threw: ' + e.message); continue; }
    boards++;

    /* G1 determinism. A duel computes the board on both clients from the same
       seed; if this is not byte-identical the two players are on different
       ground and the lockstep fingerprint diverges on the first spawn. */
    if (JSON.stringify(a) !== JSON.stringify(b)) failures.G1.push(fam + '/' + s);

    const cols = a.cols, rows = a.rows;
    const axis = (cols - 1) / 2;

    /* G2 half-width. buildField mirrors with cols-1-x. A lane crossing the
       axis is reflected onto itself, which is how a board ends up with the
       rival's road running through the player's. */
    for (const lane of a.lanes) {
      for (const [x] of lane) {
        if (x > axis) { failures.G2.push(fam + '/' + s + ' x=' + x + ' past axis ' + axis.toFixed(1)); break; }
      }
    }

    /* G3 connectivity. */
    const allLane = new Set();
    let laneCount = 0;
    for (const lane of a.lanes) {
      const { tiles, gaps } = laneTiles(lane);
      if (gaps.length) failures.G3.push(fam + '/' + s + ' diagonal ' + gaps[0]);
      for (const [x, y] of tiles) { allLane.add(key(x, y)); }
      laneCount += tiles.length;
      if (tiles.length < 8) failures.G3.push(fam + '/' + s + ' lane only ' + tiles.length + ' tiles');
      /* x = -1 IS LEGAL and is the base. Every authored map ends its lane
         there (spine [-1,7], delta [-1,8], narrows [-1,6] ...) and
         js/mapgen.js:66 says so: "The last waypoint is typically the base,
         which may sit at x = -1, one tile off-grid, buildField mirrors that
         to x = cols on the rival's side, exactly like every authored map."
         The first cut of this probe called that an error and reported all
         fifteen families broken, which is the probe, not the game. */
      for (const [x, y] of tiles)
        if (x < -1 || y < 0 || x > cols || y >= rows) {
          failures.G3.push(fam + '/' + s + ' tile off board ' + x + ',' + y); break;
        }
    }

    /* G4 no WALL on the road, and blocks are deliberately exempt.
       generateWalls promises "Never on lane tiles or inside rubble", so a wall
       on the road is a real defect. BLOCKS are not: twin-channel hand-places a
       silt bank across both channels and says why, "Blocks may cross a lane by
       design: rubble the road runs through is an authored-map convention."
       The first cut lumped the two together and reported 36 twin-channel
       boards broken, all of them working as written. */
    const walls = new Set();
    for (const [x0, y0, x1, y1] of (a.walls || []))
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) walls.add(key(x, y));
    const solid = new Set(walls);
    for (const [x0, y0, x1, y1] of (a.blocks || []))
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) solid.add(key(x, y));
    for (const k of allLane) if (walls.has(k)) { failures.G4.push(fam + '/' + s + ' wall on lane at ' + k); break; }

    /* G5 buildable space. Free = on board, not lane, not solid, and not the
       mirrored lane or mirrored solid, because buildField adds both. */
    let free = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const mx = cols - 1 - x;
      if (allLane.has(key(x, y)) || allLane.has(key(mx, y))) continue;
      if (solid.has(key(x, y)) || solid.has(key(mx, y))) continue;
      free++;
    }
    if (free < 40) failures.G5.push(fam + '/' + s + ' only ' + free + ' buildable tiles');

    /* G6 every stretch of road is defensible. A lane tile with no free tile
       within 3 (a short tower range) is road nobody can shoot. */
    let unreachable = 0;
    for (const k of allLane) {
      const c = k.indexOf(','), lx = +k.slice(0, c), ly = +k.slice(c + 1);
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3 && !near; dx++) {
        const x = lx + dx, y = ly + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const mx = cols - 1 - x;
        if (allLane.has(key(x, y)) || allLane.has(key(mx, y))) continue;
        if (solid.has(key(x, y)) || solid.has(key(mx, y))) continue;
        near = true;
      }
      if (!near) unreachable++;
    }
    if (unreachable > 0) failures.G6.push(fam + '/' + s + ' ' + unreachable + ' lane tiles with no firing position');

    /* G7 the two ends are a road, not a dot. */
    const L0 = a.lanes[0];
    const sp = L0[0], bs = L0[L0.length - 1];
    const span = Math.abs(sp[0] - bs[0]) + Math.abs(sp[1] - bs[1]);
    if (span < 6) failures.G7.push(fam + '/' + s + ' spawn to base only ' + span + ' tiles apart');

    /* ---- LAYOUT, the two properties that decide whether a board reads as a
       battlefield or as a field with a road across the top of it. Owner,
       Session 38: the maps "don't feel like they're working properly". ---- */
    const Lt = [...allLane].map(k => { const c = k.indexOf(','); return [+k.slice(0, c), +k.slice(c + 1)]; });
    const withinOf = (x, y, r) => {
      for (const [lx, ly] of Lt) if (Math.abs(lx - x) <= r && Math.abs(ly - y) <= r) return true;
      return false;
    };
    const acc = layout[fam] || (layout[fam] = { nodeIn: 0, nodeAll: 0, areaIn: 0, area: 0 });

    /* G9 a BUILD node must be worth taking, which means a tower standing on
       it can reach the road. Measured before the laneBand fix: staircase 53%,
       fortress-ring 54%, twin-gate 55%. Element bonuses on ground nobody
       builds on. */
    for (const n of (a.nodes || [])) {
      if (n[3] === 'lane') continue;                 /* lane nodes sit ON the road by definition */
      acc.nodeAll++;
      if (withinOf(n[0], n[1], 3)) acc.nodeIn++;
    }

    /* G10 how much of the board is within a short tower's reach of SOME road,
       counting the mirror. This is dead ground measured honestly: a tile with
       no lane on it is still useful if it can shoot one. */
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      acc.area++;
      if (withinOf(x, y, 3) || withinOf(cols - 1 - x, y, 3)) acc.areaIn++;
    }

    /* G8 the lane must not touch its own reflection, or the two sides share
       road and the mirrored board is not two boards. */
    for (const k of allLane) {
      const c = k.indexOf(','), lx = +k.slice(0, c), ly = +k.slice(c + 1);
      if (allLane.has(key(cols - 1 - lx, ly))) { failures.G8.push(fam + '/' + s + ' lane meets its mirror at ' + k); break; }
    }
  }
}

/* FLOORS, not targets. Set below every family's measured value with room to
   spare, so this catches a real regression rather than normal drift. At the
   time of writing the weakest are twin-gate 66% of area in reach and
   open-field 82% of nodes reachable. */
const NODE_FLOOR = 0.75, AREA_FLOOR = 0.60;
for (const fam of Object.keys(layout)) {
  const a = layout[fam];
  if (a.nodeAll && a.nodeIn / a.nodeAll < NODE_FLOOR)
    failures.G9.push(fam + ' ' + Math.round(100 * a.nodeIn / a.nodeAll) + '% of build nodes in reach of a road');
  if (a.area && a.areaIn / a.area < AREA_FLOOR)
    failures.G10.push(fam + ' ' + Math.round(100 * a.areaIn / a.area) + '% of board area within reach of a road');
}

const NAMES = {
  G1: 'the same family and seed always builds the same board',
  G2: 'the authored lane stays on its own half of the board',
  G3: 'every lane is one continuous orthogonal run, on the board',
  G4: 'no shot-blocking wall sits on the road',
  G5: 'every board has room to build',
  G6: 'every stretch of road can be shot at from somewhere',
  G7: 'spawn and base are a road apart, not a dot',
  G8: 'no lane overlaps its own mirror',
  G9: 'build nodes sit where a tower on them can reach the road',
  G10: 'most of the board is within a tower of some road, not dead ground'
};

let bad = 0;
console.log('procedural map probe: ' + fams.length + ' families x ' + SEEDS + ' seeds = ' + boards + ' boards\n');
for (const k of Object.keys(NAMES)) {
  const f = failures[k];
  const uniqFams = [...new Set(f.map(x => String(x).split('/')[0]))];
  if (f.length) {
    bad++;
    console.log('FAIL ' + k + ' ' + NAMES[k]);
    console.log('     ' + f.length + ' of ' + boards + ' boards, families: ' + uniqFams.join(', '));
    for (const line of f.slice(0, 4)) console.log('       ' + line);
  } else {
    console.log('PASS ' + k + ' ' + NAMES[k]);
  }
}
console.log('');
if (bad) { console.log(bad + ' propert' + (bad === 1 ? 'y' : 'ies') + ' failed'); process.exit(1); }
console.log('all ' + Object.keys(NAMES).length + ' properties hold across ' + boards + ' boards');
