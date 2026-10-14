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
     braid          – two lanes weaving over each other; crossings are crossfire hubs
     gauntlet       – one long fenced corridor, wall posts alternating beside the road
     staircase      – monotonic down-left steps; cover on one side only
     horseshoe      – three legs around an open plaza that covers all roads at once
     switchback     – tight zigzag with short exposure between every bend
     labyrinth      – coarse grid of walls carved around a winding corridor (LOS maze)
     twin-temple    – two compact arenas, one per row band; split your attention
     twin-gate      – one road pierced by wall bars that leave only the gap open

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
  function serpentineWaypoints(cols, rows, rnd, opts = {}) {
    const margin = irange(rnd, 2, 3);
    /* `opts.legH` pins the zigzag height (switchback wants tight legs). When it
       is absent the draw happens exactly as before, so every existing family's
       PRNG stream, and therefore its boards, stays byte-identical. */
    const legH = opts.legH !== undefined ? opts.legH
                                         : Math.max(2, Math.floor((rows - 2 * margin) / irange(rnd, 3, 4)));
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

  /**
   * THE ROWS THE FIGHT ACTUALLY HAPPENS ON.
   *
   * Every scatter in this file used to draw its y from `irange(rnd, 1, rows - 2)`,
   * the full height of the board, while the LANE is generated inside a band
   * that is often only three or four rows tall. The result is terrain in the
   * void: measured across 40 seeds per family before this landed,
   *
   *     staircase      lane spans  3 of 16 rows, 12.0 rows carry no road
   *                    36% of blocks and 41% of walls within reach of a lane
   *     fortress-ring  lane spans  4 rows, 11.5 dead, 54% of NODES reachable
   *     twin-gate      lane spans  4 rows, 12.3 dead
   *
   * An element node the player cannot build a tower next to is not a bonus,
   * it is decoration, and a wall ten tiles from any road blocks nothing. So
   * everything scattered is drawn from the lane's own band, widened by `pad`.
   *
   * Falls back to the full interior when there is no lane to measure, so a
   * caller that passes an empty set still gets a legal range.
   */
  function laneBand(rows, laneSet, pad) {
    let lo = Infinity, hi = -Infinity;
    for (const k of laneSet) {
      const y = Number(k.slice(k.indexOf(',') + 1));
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const top = 1, bot = Math.max(2, rows - 2);
    if (!isFinite(lo)) return [top, bot];
    return [Math.max(top, lo - pad), Math.min(bot, Math.max(lo - pad + 1, hi + pad))];
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
      /* THE LANE'S BAND, not the whole board. See laneBand above. */
      const bnd = laneBand(rows, laneSet, 3);
      const y = irange(rnd, bnd[0], Math.max(bnd[0], Math.min(bnd[1], rows - 1 - h)));
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
      const wb = laneBand(rows, laneSet, 3);
      const wy = irange(rnd, wb[0], wb[1]);
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
  /* How close a build node must sit to the road. Three tiles is inside the
     range of every tower in the game, so a node here is always a real
     decision rather than a tile the player looks at once and ignores. */
  const NODE_REACH = 3;
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
        /* A BUILD NODE HAS TO BE WORTH TAKING, which means a tower standing on
           it must be able to reach the road. The old draw was uniform over the
           whole board and put 46% of fortress-ring's nodes, and 47% of
           staircase's, where no lane comes within reach: an element bonus on
           ground nobody will ever build on. Drawn from the lane's band now,
           and rejected outright unless a lane tile is within NODE_REACH. */
        const nb = laneBand(rows, laneSet, 2);
        const nearLane = (x, y) => {
          for (const k of laneSet) {
            const c = k.indexOf(',');
            if (Math.abs(Number(k.slice(0, c)) - x) <= NODE_REACH &&
                Math.abs(Number(k.slice(c + 1)) - y) <= NODE_REACH) return true;
          }
          return false;
        };
        do {
          nx = irange(rnd, 1, Math.floor((cols - 2) / 2));
          ny = irange(rnd, nb[0], nb[1]);
          tries++;
        } while ((laneSet.has(nx + ',' + ny) || blockSet.has(nx + ',' + ny) ||
                  !nearLane(nx, ny)) && tries < 40);
        if (laneSet.has(nx + ',' + ny) || blockSet.has(nx + ',' + ny)) continue;
      }
      nodes.push([nx, ny, pick(rnd, ELEMENTS), kind]);
    }
    return nodes;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── Additional family geometry (braid / gauntlet / staircase / horseshoe /
     labyrinth / twin-temple / twin-gate; switchback reuses serpentine) ───── */

  /** Braid (HALF-WIDTH): two lanes that weave over each other at 2-3 swap
      columns. A tower on a crossing covers both legs, the whole board is one
      argument about where those crossings land. Both start near the mirror
      axis on different rows and exit off-grid, possibly swapped. */
  function braidWaypoints(cols, rows, rnd) {
    const yA = irange(rnd, 2, Math.max(3, Math.floor(rows / 4)));
    const yB = clamp(rows - 1 - yA + irange(rnd, -1, 1), yA + 3, rows - 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const nSwaps = irange(rnd, 2, 3);
    // Swap columns evenly spaced between x=5 and just left of the start.
    const lo = 5, hi = Math.max(lo + 2, startX - 6);
    const xs = [];
    for (let i = 0; i < nSwaps; i++) xs.push(Math.floor(lo + (hi - lo) * (i + 1) / (nSwaps + 1)));
    const uniq = [...new Set(xs)].sort((a, b) => b - a);   // walk leftward
    const build = rowA => {
      const rowB = rowA === yA ? yB : yA;
      const wps = [[startX, rowA]];
      let cur = rowA;
      for (const x of uniq) {
        if (x >= startX) continue;
        wps.push([x, cur]);            // horizontal to the swap column
        const other = cur === rowA ? rowB : rowA;
        wps.push([x, other]);          // vertical swap, shares tiles with the
                                        // rival lane exactly at the crossing
        cur = other;
      }
      wps.push([-1, cur]);             // final run off-grid on whatever row we're on
      return wps;
    };
    return { a: build(yA), b: build(yB) };
  }

  /** Gauntlet (HALF-WIDTH): one long near-straight road with at most two gentle
      bends, the corridor itself is boring ON PURPOSE, because the wall posts
      beside it are the whole game. */
  function gauntletWaypoints(cols, rows, rnd) {
    const y0 = irange(rnd, Math.floor(rows / 3), Math.max(Math.floor(rows / 3) + 1, Math.floor(rows * 2 / 3)));
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const wps = [[startX, y0]];
    let x = startX, y = y0;
    for (let i = 0; i < irange(rnd, 1, 2); i++) {
      const nx = Math.max(3, x - irange(rnd, 5, 8));
      if (nx >= x) break;
      wps.push([nx, y]);               // long straight leg
      x = nx;
      const ny = clamp(y + (rnd() < 0.5 ? -1 : 1) * irange(rnd, 2, 3), 1, rows - 2);
      if (ny !== y) { wps.push([x, ny]); y = ny; }   // one bend
    }
    wps.push([-1, y]);
    return wps;
  }

  /** Wall posts beside a lane: short vertical stubs at sampled road columns,
      offset above/below in alternating fashion so the road reads as a fenced
      corridor. Every candidate is checked against both lanes AND their mirrors
      (a wall under a lane tile is an unkillable-enemy soft-lock). */
  function generateWallPosts(cols, rows, rnd, laneSet, blockSet) {
    const walls = [];
    const mirrored = new Set();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      mirrored.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
    }
    const onLane = (x, y) => laneSet.has(x + ',' + y) || mirrored.has(x + ',' + y);
    // The road's row at each authored column in the left half.
    const byCol = new Map();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      const x = Number(k.slice(0, c)), y = Number(k.slice(c + 1));
      if (x >= 2 && x < Math.floor(cols / 2)) byCol.set(x, y);
    }
    const colsArr = [...byCol.keys()].sort((a, b) => a - b);
    let side = rnd() < 0.5 ? -1 : 1;   // alternate above/below the road
    for (let i = 0; i < colsArr.length; i += irange(rnd, 3, 4)) {
      const x = colsArr[i];
      if (x > Math.floor((cols - 2) / 2)) break;   // stay left of the axis
      const yRoad = byCol.get(x);
      for (const off of [1, 2, 3]) {
        const len = irange(rnd, 2, 3);
        const y0 = side === -1 ? yRoad - off - len + 1 : yRoad + off;
        if (y0 < 1 || y0 + len > rows) continue;
        let bad = false;
        for (let ty = y0; ty < y0 + len && !bad; ty++) {
          const k = x + ',' + ty;
          if (onLane(x, ty) || onLane(cols - 1 - x, ty) || blockSet.has(k)) bad = true;
        }
        if (!bad) { walls.push([x, y0, x, y0 + len - 1]); break; }
      }
      side = -side;
    }
    return walls;
  }

  /** Staircase (HALF-WIDTH): a monotonic descent, each tread runs leftward,
      each riser drops one or two rows. The road only ever goes down-left, so
      cover sits on one side of the march and there is no backtracking to hide
      behind. */
  function staircaseWaypoints(cols, rows, rnd) {
    const y0 = irange(rnd, 1, Math.max(2, Math.floor(rows / 5)));
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const wps = [[startX, y0]];
    let x = startX, y = y0;
    while (x > 3 && y < rows - 2) {
      const nx = Math.max(2, x - irange(rnd, 4, 6));
      wps.push([nx, y]);               // tread
      x = nx;
      if (x <= 2) break;
      const ny = clamp(y + irange(rnd, 1, 2), 1, rows - 2);   // riser
      if (ny !== y) { wps.push([x, ny]); y = ny; }
    }
    wps.push([-1, y]);                 // final run off-grid on the bottom row
    return wps;
  }

  /** Horseshoe (HALF-WIDTH): three horizontal legs joined by two vertical
      connectors. The open plaza between them is one big kill zone, a tower in
      it covers all three roads at once, which is exactly what makes the shape
      worth defending. */
  function horseshoeWaypoints(cols, rows, rnd) {
    const yA = irange(rnd, 2, Math.max(3, Math.floor(rows / 4)));
    const yB = clamp(rows - 1 - yA + irange(rnd, -1, 1), yA + 4, rows - 2);
    const yM = clamp(Math.floor((yA + yB) / 2) + irange(rnd, -1, 1), yA + 2, yB - 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const x1 = Math.max(4, Math.floor(startX * 0.55));
    const x2 = Math.max(2, x1 - irange(rnd, 3, 5));
    return [[startX, yA], [x1, yA], [x1, yM], [x2, yM], [x2, yB], [-1, yB]];
  }

  /** Maze walls (HALF-WIDTH): a coarse grid of short bars across the authored
      half, then every tile touching a lane (authored OR mirrored) is carved
      out, clearance by CONSTRUCTION rather than rejection sampling. Surviving
      tiles are re-packed into horizontal runs. If the corridor carving eats too
      much maze, it relaxes to direct-touch-only and keeps what remains. */
  function generateMazeWalls(cols, rows, rnd, laneSet, blockSet) {
    const mirrored = new Set();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      mirrored.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
    }
    const nearLane = (x, y, dist) => {
      for (let dy = -dist; dy <= dist; dy++)
        for (let dx = -dist; dx <= dist; dx++)
          if (laneSet.has((x + dx) + ',' + (y + dy)) || mirrored.has((x + dx) + ',' + (y + dy))) return true;
      return false;
    };
    const halfW = Math.floor((cols - 2) / 2);
    const gx = irange(rnd, 3, 4), gy = irange(rnd, 3, 4);
    const tiles = new Set();
    for (let y = 1; y <= rows - 2; y += gy) {          // horizontal bars
      let x = irange(rnd, 1, gx);
      while (x < halfW) {
        const len = irange(rnd, 2, 3);
        for (let i = 0; i < len && x + i < halfW; i++) tiles.add((x + i) + ',' + y);
        x += len + irange(rnd, 1, 2);
      }
    }
    for (let x = irange(rnd, 1, gx); x <= halfW; x += gx) {   // vertical bars
      let y = irange(rnd, 1, gy);
      while (y < rows - 1) {
        const len = irange(rnd, 2, 3);
        for (let i = 0; i < len && y + i < rows - 1; i++) tiles.add(x + ',' + (y + i));
        y += len + irange(rnd, 1, 2);
      }
    }
    let kept = [...tiles].filter(k => {
      const c = k.indexOf(',');
      return !blockSet.has(k) && !nearLane(Number(k.slice(0, c)), Number(k.slice(c + 1)), 1);
    });
    if (kept.length < 6) {   // the corridor ate the maze; relax to touch-only
      kept = [...tiles].filter(k => {
        const c = k.indexOf(',');
        return !blockSet.has(k) && !nearLane(Number(k.slice(0, c)), Number(k.slice(c + 1)), 0);
      });
    }
    // Re-pack surviving tiles into horizontal runs per row.
    const byRow = new Map();
    for (const k of kept) {
      const c = k.indexOf(',');
      if (!byRow.has(Number(k.slice(c + 1)))) byRow.set(Number(k.slice(c + 1)), []);
      byRow.get(Number(k.slice(c + 1))).push(Number(k.slice(0, c)));
    }
    const walls = [];
    for (const [y, xs] of byRow) {
      xs.sort((a, b) => a - b);
      let run0 = null;
      for (let i = 0; i <= xs.length; i++) {
        if (run0 === null) { if (i < xs.length) run0 = xs[i]; continue; }
        if (i < xs.length && xs[i] === xs[i - 1] + 1) continue;   // extend run
        walls.push([run0, y, xs[i - 1], y]);                      // close it
        run0 = i < xs.length ? xs[i] : null;
      }
    }
    return walls;
  }

  /** Twin temples (HALF-WIDTH): two compact arenas, one per row band. Each lane
      is a short road with one bend into its own off-grid exit, the board asks
      you to split your towers between two kill zones far apart. */
  function twinTempleWaypoints(cols, rows, rnd) {
    const yA = irange(rnd, 2, Math.max(3, Math.floor(rows / 4)));
    const yB = clamp(rows - 1 - yA + irange(rnd, -1, 1), yA + 5, rows - 2);
    const startX = Math.floor(cols / 2) - 1 - irange(rnd, 0, 1);
    const mk = (yIn, dir) => {
      const xBend = Math.max(3, Math.floor(startX * (dir > 0 ? 0.45 : 0.6)));
      const yOut = clamp(yIn + dir * irange(rnd, 1, 2), 1, rows - 2);
      return [[startX, yIn], [xBend, yIn], [xBend, yOut], [-1, yOut]];
    };
    return { a: mk(yA, +1), b: mk(yB, -1) };
  }

  /** Twin gates (HALF-WIDTH): one road pierced by two or three wall bars that
      leave only the road itself open. Enemies funnel through each gap where
      towers can focus, the gaps ARE the kill zones. */
  function generateGateWalls(cols, rows, rnd, laneSet, blockSet) {
    const mirrored = new Set();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      mirrored.add((cols - 1 - Number(k.slice(0, c))) + ',' + k.slice(c + 1));
    }
    const onLane = (x, y) => laneSet.has(x + ',' + y) || mirrored.has(x + ',' + y);
    const byCol = new Map();
    for (const k of laneSet) {
      const c = k.indexOf(',');
      const x = Number(k.slice(0, c)), y = Number(k.slice(c + 1));
      if (x >= 2 && x < Math.floor(cols / 2)) byCol.set(x, y);
    }
    const xs = [...byCol.keys()].sort((a, b) => a - b);
    if (!xs.length) return [];
    const nGates = irange(rnd, 2, 3);
    const walls = [];
    for (let g = 0; g < nGates; g++) {
      const x = xs[Math.floor(xs.length * (g + 1) / (nGates + 1))];
      if (!x || x > Math.floor((cols - 2) / 2)) continue;   // stay left of axis
      const yRoad = byCol.get(x);
      let bad = false;                                       // bar above the road
      for (let ty = 1; ty <= yRoad - 2 && !bad; ty++)
        if (onLane(x, ty) || onLane(cols - 1 - x, ty) || blockSet.has(x + ',' + ty)) bad = true;
      if (!bad && yRoad - 2 >= 1) walls.push([x, 1, x, yRoad - 2]);
      bad = false;                                           // bar below the road
      for (let ty = yRoad + 2; ty <= rows - 2 && !bad; ty++)
        if (onLane(x, ty) || onLane(cols - 1 - x, ty) || blockSet.has(x + ',' + ty)) bad = true;
      if (!bad && yRoad + 2 <= rows - 2) walls.push([x, yRoad + 2, x, rows - 2]);
    }
    return walls;
  }

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
        // (buildField mirrors it). Blocks may cross a lane by design: rubble
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
      case 'braid': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 14, 17);
        const br = braidWaypoints(cols, rows, rnd);
        const laneA = orthoLane(br.a), laneB = orthoLane(br.b);
        const ls = tileSet([laneA, laneB]);
        geo = { lanes: [laneA, laneB], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'gauntlet': {
        const cols = irange(rnd, 14, 16) * 2, rows = irange(rnd, 13, 15);
        const lane = orthoLane(gauntletWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 2);
        const bs = blockTileSet(geo.blocks);
        // The posts ARE the family; fall back to random walls only if none fit.
        geo.walls = generateWallPosts(cols, rows, rnd, ls, bs);
        if (!geo.walls.length) geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 3));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'staircase': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 14, 17);
        const lane = orthoLane(staircaseWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 4));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'horseshoe': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 14, 17);
        const lane = orthoLane(horseshoeWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        // The plaza between the legs must stay open, that is the kill zone.
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 1);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 3));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'switchback': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 14, 17);
        // Tight legs: every bend is close to the last one, so exposure between
        // cover is short and constant.
        const lane = orthoLane(serpentineWaypoints(cols, rows, rnd, { legH: irange(rnd, 2, 3) }));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        const bs = blockTileSet(geo.blocks);
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 3, 5));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'labyrinth': {
        const cols = irange(rnd, 14, 16) * 2, rows = irange(rnd, 15, 18);
        const lane = orthoLane(serpentineWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 2);
        const bs = blockTileSet(geo.blocks);
        // The maze is the family: grid walls carved around the corridor.
        geo.walls = generateMazeWalls(cols, rows, rnd, ls, bs);
        if (!geo.walls.length) geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 3, 5));
        // More lane nodes: the gates you pass through are part of the maze.
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'twin-temple': {
        const cols = irange(rnd, 13, 15) * 2, rows = irange(rnd, 15, 18);
        const tt = twinTempleWaypoints(cols, rows, rnd);
        const laneA = orthoLane(tt.a), laneB = orthoLane(tt.b);
        const ls = tileSet([laneA, laneB]);
        geo = { lanes: [laneA, laneB], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 3);
        const bs = blockTileSet(geo.blocks);
        // Walls in both arena bands, the temples have walls for a reason.
        geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 4, 6));
        geo.nodes = generateNodes(cols, rows, rnd, ls, bs);
        break;
      }
      case 'twin-gate': {
        const cols = irange(rnd, 14, 16) * 2, rows = irange(rnd, 15, 18);
        const lane = orthoLane(gauntletWaypoints(cols, rows, rnd));
        const ls = tileSet([lane]);
        geo = { lanes: [lane], cols, rows };
        geo.blocks = generateBlocks(cols, rows, rnd, ls, 2);
        const bs = blockTileSet(geo.blocks);
        // The gate bars ARE the family; fall back to random walls if none fit.
        geo.walls = generateGateWalls(cols, rows, rnd, ls, bs);
        if (!geo.walls.length) geo.walls = generateWalls(cols, rows, rnd, ls, bs, irange(rnd, 2, 3));
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

    return trimDeadGround(geo);
  }

  /**
   * CUT THE HALF OF THE BOARD NOBODY FIGHTS ON.
   *
   * The owner, on the shipped build: the maps "don't feel like they're
   * working properly". Rendered as text (tools/showboard.js) the reason is
   * immediate: on most families the road runs across the top of the board and
   * the bottom third to half is empty ground with nothing on it. Measured
   * across 40 seeds per family before this landed, rows carrying NO lane tile:
   *
   *     open-field 15.1 of 21     twin-gate 12.3 of 16   staircase 12.0 of 16
   *     twin-channel 11.7         twin-temple 11.6       fortress-ring 11.5
   *     switchback 11.4           labyrinth 11.1         chokepoint 10.2
   *
   * Nine of fifteen families spent two thirds of the board on nothing. That
   * is what a board "not working" looks like: the camera frames a field, the
   * fight happens in a strip across the top of it, and the rest is scenery
   * the player scrolls past.
   *
   * Trimmed rather than re-authored. Rewriting fifteen waypoint generators to
   * fill a fixed height is a much larger change with a much larger blast
   * radius; the board is a box drawn around the lanes, so the honest fix is to
   * draw the box to fit. Height becomes the lowest lane row plus BOARD_MARGIN,
   * which leaves real building depth under the road without leaving a desert.
   *
   * Terrain below the new floor is dropped. After the laneBand change above
   * almost nothing is: everything scattered is already drawn within three rows
   * of the road.
   */
  const BOARD_MARGIN = 4;    /* buildable depth kept beyond the outermost lane */
  const BOARD_MIN_ROWS = 11; /* never trim a board below a playable height */
  const BOARD_SHIFT_MIN = 4; /* only pull a board up when it is this far adrift */

  /* RECENTRED, not just cropped from the bottom. The first cut trimmed only
     below the lowest lane row and moved the headline number by six points,
     because on most families the road does not sit at the top: it sits in a
     band somewhere in the middle with waste above AND below it. Shifting the
     whole board so the road is BOARD_MARGIN from the top edge and cropping to
     BOARD_MARGIN past the bottom of it removes both at once.

     x is never touched. The mirror axis is a function of `cols`, and the base
     waypoint legitimately sits at x = -1, so a horizontal shift would move the
     rival's half and put a base off the wrong edge. */
  function trimDeadGround(geo) {
    if (!geo || !geo.lanes || !geo.lanes.length) return geo;
    const ls = tileSet(geo.lanes);
    let lo = Infinity, hi = -Infinity;
    for (const k of ls) {
      const y = Number(k.slice(k.indexOf(',') + 1));
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (!isFinite(lo)) return geo;

    /* NEVER NEGATIVE. `lo - BOARD_MARGIN` goes negative whenever a lane
       already starts closer to the top than the margin, and that shifted the
       whole board DOWN and pushed its lowest lane tiles off the bottom edge.
       probe-mapgen G3 caught it on 37 of 600 boards across convergence,
       braid, horseshoe and twin-temple before this clamp existed. Cropping
       dead ground may pull a board up; it must never push one down. */
    /* AND ONLY WHEN THE WASTE IS REAL. Pinning every lane to exactly
       BOARD_MARGIN is what collapses variety: two boards of one family whose
       only difference was the road sitting two rows lower became the SAME
       board, and owner-sweep 29.1 caught it at 1 identical pair in 14,
       reproducibly, across three runs. Vertical placement is variety the
       campaign is entitled to.
       So a small offset is left alone and only a large one is corrected: a
       road four or more rows below where it needs to be is dead ground, a
       road one or two rows off is character. */
    const slack = lo - BOARD_MARGIN;
    const dy = slack >= BOARD_SHIFT_MIN ? slack : 0;
    const newHi = hi - dy;
    const rows = Math.max(BOARD_MIN_ROWS,
                          Math.min(geo.rows, newHi + 1 + BOARD_MARGIN));
    if (dy === 0 && rows >= geo.rows) return geo;

    for (const lane of geo.lanes) for (const p of lane) p[1] -= dy;
    const shiftRect = r => { r[1] -= dy; r[3] -= dy; return r; };
    geo.blocks = (geo.blocks || []).map(shiftRect);
    geo.walls = (geo.walls || []).map(shiftRect);
    geo.nodes = (geo.nodes || []).map(n => { n[1] -= dy; return n; });

    geo.rows = rows;
    /* Anything the shift pushed off either edge is dropped rather than
       clamped: a wall squashed against the rim is terrain the generator did
       not intend, and after the laneBand change almost nothing lands here. */
    const fits = ([x0, y0, x1, y1]) => y0 >= 0 && y1 >= 0 && y0 < rows && y1 < rows;
    geo.blocks = geo.blocks.filter(fits);
    geo.walls = geo.walls.filter(fits);
    geo.nodes = geo.nodes.filter(n => n[1] >= 0 && n[1] < rows);
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