/* mapgen.js. Procedural map geometry generator.
   Pure functions: same (family, seed) always produces identical lanes/blocks/
   walls/nodes. Called from buildField() when a map entry has `procedural: true`.

   Every family yields STANDARD two-sided geometry: the authored half is what
   these generators produce; buildField mirrors it into the rival's half, so
   the engine never sees a one-sided board (solo-survival scenarios already
   ignore seat 1 on mirrored boards, see Game.soloSurvive).

   Families:
     spiral         – long winding inward spiral crossed by its own exit
     twin-channel   – two parallel channels split by a silt bank (no cross-fire)
     chokepoint     – narrow corridor with 2-3 alcoves; nothing covers two legs at once
     island-scatter – one long lane past large rubble fields, buildable pockets only
     open-field     – very wide board, minimal cover, forces spread
     convergence    – several short lanes converge on ONE base (siege pressure)
     fortress-ring  – serpentine road past a broken ring of shot-blocking walls

   Walls (`map.walls`) are unbuildable AND block direct projectiles and tower
   line-of-sight; lobbed shells arc over them. They never sit on lane tiles.
*/
(function () {
  'use strict';

  /* ── Seeded PRNG (mulberry32, identical arithmetic to Net._draw) ───── */
  function hashSeed(str) {
    let h = 0x9e3779b9;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0xcc9e2d51);
      h = (h ^ (h >>> 13)) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry(seed) {
    let x = seed >>> 0 || 1;
    return function () {
      x = (x + 0x6D2B79F5) >>> 0;
      let t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  /** Inclusive integer range draw. */
  function irange(rnd, a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return lo + Math.floor(rnd() * (hi - lo + 1));
  }

  /* ── Lane construction ─────────────────────────────────────────────── */

  /** Expand axis-aligned waypoints into a full tile list. Consecutive
      waypoints must differ in exactly one coordinate; each joint is visited
      once (no duplicate points). The last waypoint is typically the base,
      which may sit at x = -1, one tile off-grid, buildField mirrors that to
      x = cols on the rival's side, exactly like every authored map. */
  function orthoLane(waypoints) {
    const pts = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x0, y0] = waypoints[i];
      const [x1, y1] = waypoints[i + 1];
      if (y0 === y1) {
        const step = x1 > x0 ? 1 : -1;
        for (let x = x0; x !== x1; x += step) pts.push([x, y0]);
      } else if (x0 === x1) {
        const step = y1 > y0 ? 1 : -1;
        for (let y = y0; y !== y1; y += step) pts.push([x0, y]);
      }
    }
    pts.push(waypoints[waypoints.length - 1].slice());
    return pts;
  }

  /** Serpentine (HALF-WIDTH): enters from the mirror axis, zigzags leftward
      in horizontal legs, exits at x=-1. Only traverses the LEFT half so that
      buildField's mirror produces a non-overlapping rival lane on the right. */
  function serpentineWaypoints(cols, rows, rnd) {
    const margin = irange(rnd, 2, 3);
    const legH = Math.max(2, Math.floor((rows - 2 * margin) / irange(rnd, 3, 4)));
    // Start near the mirror axis (left side of it for even cols).
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const wps = [[startX, margin + irange(rnd, 0, 1)]];
    let y = wps[0][1];
    let x = startX;
    while (x >= margin + 3) {
      const segLen = Math.min(x - margin + 1, irange(rnd, 4, 8));
      const nx = Math.max(margin, x - segLen);
      wps.push([nx, y]);
      x = nx;
      if (x <= margin) break;
      const ny = clamp(y + (wps.length % 2 === 0 ? legH : -legH), margin, rows - 1 - margin);
      wps.push([nx, ny]);
      y = ny;
    }
    wps.push([-1, wps[wps.length - 1][1]]);
    return wps;
  }

  /** Spiral (HALF-WIDTH): enters from the mirror axis and winds inward through
      shrinking rectangular rings until it reaches x=-1. */
  function spiralWaypoints(cols, rows, rnd) {
    const m = irange(rnd, 2, 3);
    // Bounding box: left half of the board only.
    let x0 = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1), y0 = m + irange(rnd, 0, 1);
    const x1 = m; let y1 = rows - 1 - m;
    const wps = [[x0, y0]];
    for (let ring = 0; ring < irange(rnd, 2, 3); ring++) {
      if (x1 + 1 >= x0 || y1 <= y0) break;
      wps.push([x0, y1]);   // down the right side of the box
      wps.push([x1, y1]);   // across the bottom
      wps.push([x1, y0]);   // up the left side
      const nx0 = x0 - irange(rnd, 2, 3);
      if (nx0 <= x1) break;
      wps.push([nx0, y0]);  // across the top, one step inward
      x0 = nx0;
      y1 = Math.max(y0 + 1, y1 - irange(rnd, 2, 3));
    }
    wps.push([-1, wps[wps.length - 1][1]]);
    return wps;
  }

  /** Two parallel channels (HALF-WIDTH) with a silt bank between them. */
  function twinChannelWaypoints(cols, rows, rnd) {
    const gap = irange(rnd, 2, 3);
    const midY = Math.floor(rows / 2);
    let yTop = clamp(midY - gap - irange(rnd, 0, 1), 1, rows - 4);
    let yBot = clamp(midY + gap + irange(rnd, 0, 1), yTop + 3, rows - 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    // Each channel: corridor leftward, one bend, exit at x=-1 on the bent row.
    // Every consecutive pair differs in exactly ONE coordinate (orthoLane
    // silently drops diagonal segments, so this is load-bearing).
    const nyTop = clamp(yTop + irange(rnd, 1, 2), 1, rows - 2);
    const topWps = [[startX, yTop], [Math.max(2, Math.floor(startX * 0.4)), yTop],
                    [Math.max(2, Math.floor(startX * 0.4)), nyTop], [-1, nyTop]];
    const nyBot = clamp(yBot - irange(rnd, 1, 2), 1, rows - 2);
    const botWps = [[startX, yBot], [Math.max(3, Math.floor(startX * 0.6)), yBot],
                    [Math.max(3, Math.floor(startX * 0.6)), nyBot], [-1, nyBot]];
    return { top: topWps, bot: botWps, bankY: midY };
  }

  /** Chokepoint (HALF-WIDTH): a corridor that juts into alcoves; each alcove
      covers only its own leg. All geometry in the left half. The lane always
      returns to the corridor row after every jut so segments stay orthogonal. */
  function chokepointWaypoints(cols, rows, rnd) {
    const nAlcoves = irange(rnd, 2, 3);
    const midY = Math.floor(rows / 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    // Available width for the corridor: from startX down to x=2.
    const availW = startX - 3;
    const segW = Math.max(4, Math.floor(availW / (nAlcoves + 1)));
    const wps = [[startX, midY]];
    let cx = startX;
    for (let i = 0; i < nAlcoves; i++) {
      if (cx - segW <= 2) break;
      const yOff = irange(rnd, 1, Math.max(1, Math.floor(rows / 4)));
      const dirUp = rnd() < 0.5 ? -1 : 1;
      const ny = clamp(midY + dirUp * yOff, 1, rows - 2);
      wps.push([cx - segW + 2, midY]);   // corridor leg (horizontal)
      wps.push([cx - segW + 2, ny]);     // jut (vertical)
      cx = cx - segW;
      wps.push([cx, ny]);                // alcove leg (horizontal)
      wps.push([cx, midY]);              // back to corridor (vertical)
    }
    wps.push([-1, midY]);                // final run along the corridor row
    return wps;
  }

  /** Island scatter (HALF-WIDTH): one long lane with wide gaps between its legs
      so the rubble fields below carve out disconnected buildable pockets. */
  function islandScatterWaypoints(cols, rows, rnd) {
    const y0 = irange(rnd, 2, Math.max(3, Math.floor(rows / 4)));
    const baseY = Math.floor(rows / 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const wps = [[startX, y0]];
    let x = startX, y = y0;
    for (let i = 0; i < irange(rnd, 3, 5); i++) {
      const nx = Math.max(1, x - irange(rnd, 4, 6));
      if (nx >= x) break;
      wps.push([nx, y]);                 // horizontal at current row
      x = nx;
      if (x <= 2) break;
      const ny = clamp(y + (rnd() < 0.5 ? -1 : 1) * irange(rnd, 3, Math.max(4, Math.floor(rows / 3))), 1, rows - 2);
      wps.push([nx, ny]);                // vertical leg
      y = ny;
    }
    if (y !== baseY) wps.push([x, baseY]);   // return to the exit row
    wps.push([-1, baseY]);                    // final run off-grid
    return wps;
  }

  /** Open field (HALF-WIDTH): very wide board, two long near-straight lanes. */
  function openFieldWaypoints(cols, rows, rnd) {
    let yA = irange(rnd, 3, Math.max(4, Math.floor(rows / 3)));
    let yB = clamp(rows - 1 - yA + irange(rnd, -1, 1), yA + 3, rows - 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    // Two gentle bends per lane; every segment axis-aligned.
    const bA1 = Math.max(2, Math.floor(startX * 0.6)), bA2 = Math.max(1, Math.floor(startX * 0.3));
    const nyA = clamp(yA + irange(rnd, 1, 2), 1, rows - 2);
    const topWps = [[startX, yA], [bA1, yA], [bA1, nyA], [bA2, nyA], [-1, nyA]];
    const bB1 = Math.max(3, Math.floor(startX * 0.7)), bB2 = Math.max(2, Math.floor(startX * 0.4));
    const nyB = clamp(yB - irange(rnd, 1, 2), 1, rows - 2);
    const botWps = [[startX, yB], [bB1, yB], [bB1, nyB], [bB2, nyB], [-1, nyB]];
    return { top: topWps, bot: botWps };
  }

  /** Convergence (HALF-WIDTH): several short lanes enter from the mirror axis
      at different heights and all converge on a single base at x=-1. */
  function convergenceWaypoints(cols, rows, rnd) {
    const nLanes = irange(rnd, 2, 3);
    const baseY = Math.floor(rows / 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const lanes = [];
    for (let i = 0; i < nLanes; i++) {
      const enterY = clamp(Math.floor((i + 0.5) * rows / nLanes) + irange(rnd, -1, 1), 1, rows - 2);
      const wps = [[startX, enterY]];
      let x = startX, y = enterY;
      for (let seg = 0; seg < irange(rnd, 2, 3); seg++) {
        const nx = Math.max(1, x - irange(rnd, 3, 5));
        if (nx >= x) break;
        wps.push([nx, y]);               // horizontal at current row
        x = nx;
        const ny = clamp(baseY + irange(rnd, -Math.floor(rows / 4), Math.floor(rows / 4)), 1, rows - 2);
        if (ny !== y) { wps.push([x, ny]); y = ny; }   // vertical wiggle
      }
      if (y !== baseY) wps.push([x, baseY]);   // settle onto the shared row
      wps.push([1, baseY]);                    // final approach
      wps.push([-1, baseY]);                   // off-grid base
      lanes.push(wps);
    }
    return { lanes: lanes };
  }

  /** Fortress ring (HALF-WIDTH): a serpentine road past a broken ring of walls
      around the centre; the gaps are where the kill zones sit. */
  function fortressRingWaypoints(cols, rows, rnd) {
    const wps = serpentineWaypoints(cols, rows, rnd);
    return { lanes: [wps] };
  }

  /* ── Terrain generation ────────────────────────────────────────────── */

  function tileSet(lanes) {
    const s = new Set();
    for (const lane of lanes) for (const p of lane) s.add(p[0] + ',' + p[1]);
    return s;
  }

  /** N random rubble rectangles that touch no lane tile and no other block.
      Authored in the LEFT half only: buildField mirrors every rectangle, so a
      full-width draw would place mirror copies on top of the rival's lanes. */
  function generateBlocks(cols, rows, rnd, laneSet, count) {
    const blocks = [];
    const halfW = Math.floor((cols - 1) / 2);   // rightmost authored column
    for (let i = 0; i < count; i++) {
      const w = irange(rnd, 1, 3), h = irange(rnd, 1, 2);
      const maxX = halfW - w;                   // keep the whole rect left of the axis
      if (maxX < 1) continue;
      const x = irange(rnd, 1, maxX);
      const y = irange(rnd, 1, Math.max(2, rows - 1 - h));   // y+h must stay on-grid
      let overlaps = false;
      for (let ty = y; ty <= y + h && !overlaps; ty++)
        for (let tx = x; tx <= x + w && !overlaps; tx++)
          if (laneSet.has(tx + ',' + ty)) overlaps = true;
      if (!overlaps) {
        for (const [bx0, by0, bx1, by1] of blocks)
          if (x <= bx1 && x + w >= bx0 && y <= by1 && y + h >= by0) { overlaps = true; break; }
      }
      if (!overlaps) blocks.push([x, y, x + w, y + h]);
    }
    return blocks;
  }

  /** Shot-blocking wall segments. Never on lane tiles or inside rubble.
      Authored in the LEFT half only (mirrored by buildField). A wall under a
      LANE tile is a soft-lock: enemies standing there take no direct shot, so
      both the authored lanes AND their mirrors are kept clear. Orientation is
      chosen per segment: horizontal (long in x) or vertical. */
  function generateWalls(cols, rows, rnd, laneSet, blockSet, count) {
    const walls = [];
    // Mirrored positions of every authored lane tile (the rival's road).
    const mirrored = new Set();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      mirrored.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
    }
    const onLane = (x, y) => laneSet.has(x + ',' + y) || mirrored.has(x + ',' + y);
    const halfW = Math.floor((cols - 1) / 2);
    for (let i = 0; i < count; i++) {
      const horiz = rnd() < 0.5;
      const len = irange(rnd, 2, 4), thick = irange(rnd, 1, 2);
      const wxMax = halfW - (horiz ? len : thick);   // stay left of the axis
      if (wxMax < 2) continue;
      const wx = irange(rnd, 2, wxMax);
      const wy = irange(rnd, 1, Math.max(2, rows - 2));
      const x0 = wx, y0 = wy;
      const x1 = horiz ? Math.min(halfW, wx + len) : Math.min(halfW, wx + thick);
      const y1 = horiz ? Math.min(rows - 2, wy + thick) : Math.min(rows - 2, wy + len);
      let bad = false;
      for (let ty = y0; ty <= y1 && !bad; ty++)
        for (let tx = x0; tx <= x1 && !bad; tx++) {
          const k = tx + ',' + ty;
          // The tile itself AND its mirror must clear every lane.
          if (onLane(tx, ty) || onLane(cols - 1 - tx, ty) || blockSet.has(k)) bad = true;
        }
      if (!bad) walls.push([x0, y0, x1, y1]);
    }
    return walls;
  }

  const ELEMENTS = ['fire', 'frost', 'storm', 'void', 'venom'];
  /** Element nodes on open ground: build nodes mostly, a few lane nodes.
      Authored in the LEFT half only (mirrored by buildField); the mirror axis
      column itself is excluded so no node ever mirrors onto its own tile.
      A `lane`-kind node sits ON a lane tile (that is what primes it), a
      `build` node on open ground beside the road. */
  function generateNodes(cols, rows, rnd, laneSet, blockSet) {
    const nodes = [];
    for (let i = 0; i < irange(rnd, 2, 4); i++) {
      const kind = rnd() < 0.3 ? 'lane' : 'build';
      let nx, ny, tries = 0;
      if (kind === 'lane') {
        // Pick a random authored lane tile in the left half.
        const tiles = [...laneSet].filter(k => Number(k.slice(0, k.indexOf(','))) >= 0);
        if (!tiles.length) continue;
        [nx, ny] = pick(rnd, tiles).split(',').map(Number);
      } else {
        do {
          nx = irange(rnd, 1, Math.floor((cols - 2) / 2));
          ny = irange(rnd, 1, rows - 2);
          tries++;
        } while ((laneSet.has(nx + ',' + ny) || blockSet.has(nx + ',' + ny)) && tries < 40);
        if (laneSet.has(nx + ',' + ny) || blockSet.has(nx + ',' + ny)) continue;
      }
      nodes.push([nx, ny, pick(rnd, ELEMENTS), kind]);
    }
    return nodes;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── Main entry point ──────────────────────────────────────────────── */

  /**
   * Generate procedural geometry for a map family.
   * @param {string} family - one of the family names above
   * @param {string} seedStr - deterministic seed (world id + map id)
   * @returns {{lanes: number[][][], blocks: number[][], walls: number[][],
   *           nodes: number[][], cols: number, rows: number}}
   */
  function proceduralGeometry(family, seedStr) {
    const rnd = mulberry(hashSeed(String(seedStr || 'default')));
    let geo;

    switch (family) {
      case 'spiral': {
        // Even cols: the mirror axis sits BETWEEN two columns, so a lane
        // starting at cols/2 never mirrors onto its own tile.
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 14, 17);
        const lane = orthoLane(spiralWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        geo.walls = generateWalls(cols, rows, rnd, ls, blockTileSet(geo.blocks), irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, blockTileSet(geo.blocks));
        break;
      }
      case 'twin-channel': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 15, 18);
        const tc = twinChannelWaypoints(cols, rows, rnd);
        const laneTop = orthoLane(tc.top), laneBot = orthoLane(tc.bot);
        const ls = tileSet([laneTop, laneBot]);
        geo = { lanes: [laneTop, laneBot], cols, rows };
        // The silt bank splits the two channels. Authored in the LEFT half only
        // (buildField mirrors it). Blocks may cross a lane by design — rubble
        // the road runs through is an authored-map convention.
        const bx0 = Math.max(1, Math.floor(cols * 0.2)), bx1 = Math.floor((cols - 1) / 2);
        geo.blocks = [[bx0, tc.bankY - 1, bx1, tc.bankY + 1]];
        for (let i = 0; i < irange(rnd, 2, 4); i++) {
          const bx = irange(rnd, 1, Math.max(2, Math.floor((cols - 4) / 2))), by = irange(rnd, 1, rows - 2);
          if (!ls.has(bx + ',' + by)) geo.blocks.push([bx, by, bx + irange(rnd, 0, 1), by]);
        }
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'chokepoint': {
        const cols = irange(rnd, 12, 14) * 2, rows = irange(rnd, 13, 15);
        const lane = orthoLane(chokepointWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 5);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'island-scatter': {
        const cols = irange(rnd, 14, 16) * 2, rows = irange(rnd, 15, 17);
        const lane = orthoLane(islandScatterWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        // Big rubble fields: the pockets between them are the islands.
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 7);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 1, 3));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'open-field': {
        const cols = irange(rnd, 17, 20) * 2, rows = irange(rnd, 18, 22);
        const of = openFieldWaypoints(cols, rows, rnd);
        const laneTop = orthoLane(of.top), laneBot = orthoLane(of.bot);
        const ls = tileSet([laneTop, laneBot]);
        geo = { lanes: [laneTop, laneBot], cols, rows };
        // Minimal cover, a couple of hulk clusters only.
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 2);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 1, 3));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'convergence': {
        const cols = irange(rnd, 12, 14) * 2, rows = irange(rnd, 13, 15);
        const cv = convergenceWaypoints(cols, rows, rnd);
        const lanes = cv.lanes.map(wps => orthoLane(wps));
        const ls = tileSet(lanes);
        geo = { lanes: lanes, cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'fortress-ring': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 15, 17);
        const fr = fortressRingWaypoints(cols, rows, rnd);
        const lanes = fr.lanes.map(wps => orthoLane(wps));
        const ls = tileSet(lanes);
        geo = { lanes: lanes, cols, rows };
        // A broken ring of walls around the LEFT half's centre: four arcs with
        // gaps. Authored left of the mirror axis and kept clear of BOTH the
        // authored lanes and their mirrors (a wall under a lane is a soft-lock).
        const halfW = Math.floor((cols - 1) / 2);
        const cx = Math.max(5, Math.min(halfW - 4, Math.floor(cols * 0.3))), cy = Math.floor(rows / 2);
        const R = irange(rnd, 3, 4), gap = irange(rnd, 1, 2);
        const mirroredLs = new Set();
        for (const k of ls) {
          const c = k.indexOf(',');
          mirroredLs.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
        }
        geo.walls = [
          [cx - R, cy - R, cx + R - gap, cy - R],           // top arc
          [cx + R, cy - R + gap, cx + R, cy + R],           // right arc
          [cx - R + gap, cy + R, cx + R, cy + R],           // bottom arc
          [cx - R, cy - R, cx - R, cy + R - gap]            // left arc
        ].filter(([x0, y0, x1, y1]) => {
          if (x0 < 1 || x1 > halfW) return false;          // stay in the authored half
          for (let ty = y0; ty <= y1; ty++)
            for (let tx = x0; tx <= x1; tx++)
              if (ls.has(tx + ',' + ty) || mirroredLs.has(tx + ',' + ty)) return false;
          return true;
        });
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 2);
        const bs = blockTileSet(geo.blocks);
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      default:
        // Unknown family: fall back to a plain serpentine so the board still
        // builds rather than throwing.
        const cols = 28, rows = 15;
        const lane = orthoLane(serpentineWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        geo.walls = [];
        geo.nodes = generateNodes(cols, rows, rnd, ls, blockTileSet(geo.blocks));
    }

    return geo;
  }

  function blockTileSet(blocks) {
    const s = new Set();
    for (const [x0, y0, x1, y1] of blocks)
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.add(x + ',' + y);
    return s;
  }

  /* ── Export ─────────────────────────────────────────────────────────── */
  window.MapGen = { proceduralGeometry, hashSeed };
})();