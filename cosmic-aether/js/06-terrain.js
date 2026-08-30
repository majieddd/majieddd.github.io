/* RELIQUARY :: 06-terrain
   The board: heightfield, path, build plots, scenery.

   WHY A HEIGHTFIELD AND NOT A PLANE. The first render of this project used a
   single flat slab for the ground and it came out as one uniform pale wash.
   The reason is structural, not a tuning problem: the posterised ramp assigns
   a band from the surface normal, so a plane with ONE normal gets ONE band
   across its entire area, and every painterly quality in the shader is
   defeated at the same time. A gently undulating heightfield gives adjacent
   quads slightly different normals, they land on different bands, and the
   ground becomes the patchwork of knife strokes the art direction is after.
   The undulation is small enough (well under a unit) that it never affects
   gameplay or placement.

   The path is a Catmull-Rom spline through hand-placed waypoints, densified
   into a polyline. Units walk the polyline by arc length so they move at a
   constant speed regardless of how the control points are spaced, which a
   naive t-parameterised spline does not give you: units would sprint through
   straights and crawl round corners. */
'use strict';

var TERRAIN = (function () {

  var V = U.V;

  /* Catmull-Rom through p0..p3 at t. Standard uniform form: good enough for
     hand-placed control points that are roughly evenly spaced, and it does not
     need the chord-length bookkeeping the centripetal variant does. */
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * t + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3)
    ];
  }

  /* Densify a waypoint list into an arc-length-parameterised polyline. The
     cumulative length table is what makes constant-speed travel possible. */
  function buildPath(waypoints, samplesPerSeg) {
    var pts = [];
    var n = waypoints.length;
    if (n < 2) return { pts: waypoints.slice(), cum: [0], length: 0 };
    /* Duplicate the endpoints so the spline reaches the first and last
       waypoint instead of easing away from them. */
    var w = [waypoints[0]].concat(waypoints, [waypoints[n - 1]]);
    var spp = samplesPerSeg || 14;
    for (var i = 0; i < w.length - 3; i++) {
      for (var s = 0; s < spp; s++) {
        pts.push(catmull(w[i], w[i + 1], w[i + 2], w[i + 3], s / spp));
      }
    }
    pts.push(w[w.length - 2].slice());

    var cum = [0];
    var total = 0;
    for (var k = 1; k < pts.length; k++) {
      total += V.dist(pts[k - 1], pts[k]);
      cum.push(total);
    }
    return { pts: pts, cum: cum, length: total };
  }

  /* Position and forward direction at arc-length d along the path. Binary
     search over the cumulative table: called for every unit every frame, so a
     linear scan would be O(units * samples). */
  function pathAt(path, d) {
    var cum = path.cum, pts = path.pts;
    if (d <= 0) {
      var f0 = V.norm(V.sub(pts[1] || pts[0], pts[0]));
      return { pos: pts[0].slice(), dir: f0, t: 0 };
    }
    if (d >= path.length) {
      var last = pts.length - 1;
      var fl = V.norm(V.sub(pts[last], pts[last - 1] || pts[last]));
      return { pos: pts[last].slice(), dir: fl, t: 1 };
    }
    var lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    var seg = cum[hi] - cum[lo];
    var f = seg > 1e-6 ? (d - cum[lo]) / seg : 0;
    var a = pts[lo], b = pts[hi];
    return {
      pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f],
      dir: V.norm(V.sub(b, a)),
      t: d / path.length
    };
  }

  /* Shortest distance from a point to the path polyline, in XZ. Used to carve
     the path into the heightfield and to reject build plots that sit on it. */
  function distToPath(path, x, z) {
    var pts = path.pts, best = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], az = pts[i][2];
      var bx = pts[i + 1][0], bz = pts[i + 1][2];
      var dx = bx - ax, dz = bz - az;
      var L2 = dx * dx + dz * dz;
      var t = L2 > 1e-9 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var px = ax + dx * t, pz = az + dz * t;
      var d = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /* ---------- board generation ---------- */

  function build(def) {
    var seed = def.seed || def.id || 'board';
    var rnd = U.rng('terrain:' + seed);
    var CS = def.cell || 3.0;
    var GW = def.gw || 30, GH = def.gh || 22;
    var halfW = GW * CS / 2, halfH = GH * CS / 2;
    var pathWidth = def.pathWidth || 4.2;

    var path = buildPath(def.waypoints, 16);

    /* Height field, sampled on grid CORNERS so adjacent quads share exact
       corner heights and the surface stays watertight. Sampling at cell
       centres instead leaves gaps the shadow pass renders as light leaks. */
    var HW = GW + 1, HH = GH + 1;
    var height = new Float32Array(HW * HH);
    var pdist = new Float32Array(HW * HH);
    /* IN-PLANE CORNER JITTER. A perfectly regular grid reads as a tiled floor
       no matter how its colour varies, because the eye finds the repeating
       lattice before it finds the paint. Displacing each interior corner in XZ
       by up to a third of a cell breaks the lattice while keeping the surface
       watertight, since neighbours share the displaced corner rather than each
       computing their own. The boundary ring is left alone so the plate keeps
       a clean straight edge against the void. */
    var jitX = new Float32Array(HW * HH);
    var jitZ = new Float32Array(HW * HH);
    var jr = U.rng('gridjit:' + seed);
    for (var jj = 0; jj < HH; jj++) {
      for (var ji = 0; ji < HW; ji++) {
        var jidx = jj * HW + ji;
        var interior = ji > 0 && jj > 0 && ji < HW - 1 && jj < HH - 1;
        jitX[jidx] = interior ? (jr() - 0.5) * CS * 0.34 : 0;
        jitZ[jidx] = interior ? (jr() - 0.5) * CS * 0.34 : 0;
      }
    }

    function nz(x, z, f) {
      /* Two octaves of cheap trig noise. Not a real fbm: the amplitude here is
         under a unit and the only requirement is that it be smooth, aperiodic
         over the board, and identical every run. */
      return Math.sin(x * f * 0.71 + z * f * 0.33 + 1.7) * 0.6 +
             Math.sin(x * f * 0.29 - z * f * 0.83 + 4.1) * 0.4;
    }

    var i, j, idx;
    for (j = 0; j < HH; j++) {
      for (i = 0; i < HW; i++) {
        idx = j * HW + i;
        var wx = -halfW + i * CS, wz = -halfH + j * CS;
        var d = distToPath(path, wx, wz);
        pdist[idx] = d;

        /* RELIEF IS DELIBERATELY SMALL, and this is an art decision that was
           measured rather than guessed.

           An earlier version ran relief at 1.35 with a 1.15 low-frequency term
           over a 3.4 unit cell. That puts slopes past 40 degrees, so a large
           share of ground facets tilt away from the sun, land on the deep band
           and go nearly black. Measured: path [81,103,166] against ground
           [16,6,52] before post, a 5x gap produced by a 1.7x albedo gap. The
           board read as a lit road floating over a void.

           The fix is not to fight it with grading. It is to notice that the
           painterly patchwork should come from COLOUR, the way it does in the
           reference plates, and not from geometry. The ground is a play
           surface: it wants to be legible and nearly flat, with its variation
           carried by the wide per-quad palette and the per-facet band jitter.
           Relief now only has to stop the surface reading as a single plane. */
        var h = nz(wx, wz, 0.075) * (def.relief === undefined ? 0.30 : def.relief);
        h += nz(wx, wz, 0.021) * 0.42;
        /* The board falls away at its rim so it reads as a plate floating in
           space rather than as a cropped infinite plane. */
        var edge = Math.max(Math.abs(wx) / halfW, Math.abs(wz) / halfH);
        h -= U.smoothstep(0.90, 1.00, edge) * 2.2;
        /* Carve the path: flatten toward zero within the ribbon, with a lip
           just outside it so the road reads as cut into the ground. */
        var carve = 1 - U.smoothstep(pathWidth * 0.55, pathWidth * 1.5, d);
        h = U.mix(h, -0.34, carve);
        var lip = U.smoothstep(pathWidth * 1.5, pathWidth * 1.05, d) * U.smoothstep(pathWidth * 2.4, pathWidth * 1.6, d);
        h += lip * 0.30;
        height[idx] = h;
      }
    }

    /* PLANET SAG. The board is now a biome on a globe: every height is pulled
       down by its own spherical sag so the plateau bends toward the horizon,
       and a big planet sphere below catches the edges (the border dives under
       it, so there is no floating rim and no gap anywhere). Gameplay stays
       flat enough: the sag is ~4 units over a 45-unit half extent, and units
       and click targets use heightAt, which knows the sag. */
    var SAG_R = def.sagR || 300.0;
    for (var sgi = 0; sgi < HW * HH; sgi++) {
      var sx2 = (sgi % HW) * CS - halfW, sz2 = Math.floor(sgi / HW) * CS - halfH;
      height[sgi] -= (sx2 * sx2 + sz2 * sz2) / (2.0 * SAG_R);
    }

    function heightAt(wx, wz) {
      var fx = (wx + halfW) / CS, fz = (wz + halfH) / CS;
      var x0 = Math.floor(fx), z0 = Math.floor(fz);
      if (x0 < 0 || z0 < 0 || x0 >= HW - 1 || z0 >= HH - 1) return -6;
      var tx = fx - x0, tz = fz - z0;
      var h00 = height[z0 * HW + x0], h10 = height[z0 * HW + x0 + 1];
      var h01 = height[(z0 + 1) * HW + x0], h11 = height[(z0 + 1) * HW + x0 + 1];
      return U.mix(U.mix(h00, h10, tx), U.mix(h01, h11, tx), tz);
    }

    /* ---------- plots (moved before the ground build so the terrain can be
       flattened under every pad: paving only reads as ground when the ground
       under it is ground-shaped). ---------- */
    var plots = [];
    var pr = U.rng('plots:' + seed);
    for (j = 1; j < GH - 1; j++) {
      for (i = 1; i < GW - 1; i++) {
        var cx = -halfW + (i + 0.5) * CS, cz = -halfH + (j + 0.5) * CS;
        var d2 = distToPath(path, cx, cz);
        if (d2 < pathWidth * 1.25) continue;
        if (d2 > (def.plotReach || 13)) continue;
        var e2 = Math.max(Math.abs(cx) / halfW, Math.abs(cz) / halfH);
        if (e2 > 0.80) continue;
        /* Thin the plots so they do not tile the whole margin: a checker with
           a jittered acceptance reads as deliberate emplacements. */
        if (((i * 7 + j * 5) % 3) !== 0) continue;
        if (pr() < 0.22) continue;
        plots.push({
          id: 'p' + i + '_' + j,
          x: cx, z: cz,
          y: heightAt(cx, cz),
          gx: i, gz: j,
          tower: null,
          dist: d2
        });
      }
    }
    /* FLATTEN UNDER PAVING. A rigid slab dropped on a +/-0.72-relief surface
       floats on downhill lips and pokes through uphill shoulders. Pull every
       grid corner within a pad's footprint toward the plot height BEFORE the
       ground mesh is built, so the pad sits in flat prepared ground. */
    for (var pf = 0; pf < plots.length; pf++) {
      var pl = plots[pf];
      var px0 = pl.gx - 1, px1 = pl.gx + 1, pz0 = pl.gz - 1, pz1 = pl.gz + 1;
      for (var py = pz0; py <= pz1; py++) {
        for (var pxi = px0; pxi <= px1; pxi++) {
          if (py < 0 || pxi < 0 || py >= HW || pxi >= HW) continue;
          var wx = -halfW + pxi * CS, wz = -halfH + py * CS;
          var d = Math.hypot(wx - pl.x, wz - pl.z);
          var w = U.smoothstep(2.2 * CS, 0.8 * CS, d);
          var idx = py * HW + pxi;
          height[idx] = U.mix(height[idx], pl.y, w);
        }
      }
    }

    /* ---------- ground mesh ----------
       Colour is chosen per QUAD, not per vertex, from a small tonal family.
       Adjacent quads getting different tones is what sells the patchwork; a
       smooth colour ramp across the board would undo the whole effect. */
    /* GROUND AND PATH ARE SEPARATED BY VALUE, NOT BY HUE.
       The first tuned render had the ground at roughly #161029 and the path at
       #2a2050: a 6 percent luminance gap, which vanished entirely once the
       posterise ramp put both on the same band. The route through the board
       was invisible, which in a tower defence is not a style problem but a
       playability one. The path now sits about 2.4x the ground luminance so
       it lands a full band higher and reads as a lit road at any zoom. */
    /* THE GROUND PALETTE IS WIDE ON PURPOSE.
       An earlier version used five violets within a few percent of each other
       and the board rendered as one smooth field: the posterise ramp put every
       quad on the same band and the patchwork never appeared. These eight
       span roughly 3x in luminance and about a sixth of a turn in hue, so
       adjacent quads visibly disagree, which is what a knife laying down
       neighbouring strokes of mixed paint actually looks like. */
    /* These sat at roughly twice this luminance for one iteration, which was
       compensation for the winding defect above rather than an art decision.
       With the normals corrected the same values rendered at [180,160,246],
       a near-white board. Halving them puts the ground back where the style
       law wants it: dark enough that a lit tower is the brightest thing in
       its neighbourhood, with the path a clear band above it. */
    var groundCols = def.groundCols || [
      '#2a2150', '#31265e', '#231b44', '#382a6b', '#2e2458',
      '#342866', '#1e173a', '#3a2c70'
    ];
    /* The path is pushed WARM as well as light. Two violets of different
       luminance still read as the same material at a glance; a violet ground
       against a rose-warm road reads as two different things instantly, which
       is what a player scanning for the lane actually needs. */
    var pathCols = def.pathCols || ['#7d4a73', '#9a6288', '#6e4170', '#b06b9b'];

    var gb = MESH.builder('ground:' + seed);
    gb.tooth(1.0);
    for (j = 0; j < GH; j++) {
      for (i = 0; i < GW; i++) {
        var i00 = j * HW + i, i10 = j * HW + i + 1;
        var i01 = (j + 1) * HW + i, i11 = (j + 1) * HW + i + 1;
        var x0 = -halfW + i * CS, x1 = x0 + CS;
        var z0 = -halfH + j * CS, z1 = z0 + CS;
        var pd = (pdist[i00] + pdist[i10] + pdist[i01] + pdist[i11]) * 0.25;
        var onPath = pd < pathWidth * 1.05;

        var r = rnd();
        var col = onPath
          ? pathCols[Math.floor(r * pathCols.length) % pathCols.length]
          : groundCols[Math.floor(r * groundCols.length) % groundCols.length];
        var base = U.hex2rgb(col);
        gb.tooth(onPath ? 0.75 : 1.0);

        var p00 = [x0 + jitX[i00], height[i00], z0 + jitZ[i00]];
        var p10 = [x1 + jitX[i10], height[i10], z0 + jitZ[i10]];
        var p01 = [x0 + jitX[i01], height[i01], z1 + jitZ[i01]];
        var p11 = [x1 + jitX[i11], height[i11], z1 + jitZ[i11]];

        /* COLOUR PER TRIANGLE, NOT PER CELL.
           Giving both triangles of a quad the same colour makes the board read
           as square TILES, which is a floor, not a painting. A knife lays down
           one stroke at a time and no two carry quite the same mix, so each
           triangle takes the cell's base colour with a small independent shift.
           Keeping the base per cell is what stops it dissolving into noise: the
           result is coherent patches with visible internal brushwork, which is
           what the reference plates actually do. */
        function stroke() {
          gb.color(U.shift(base,
            (rnd() - 0.5) * 0.022,
            (rnd() - 0.5) * 0.14,
            (rnd() - 0.5) * 0.075));
        }
        /* Alternate the diagonal per cell. A uniform diagonal across a whole
           grid produces a visible corduroy running the length of the board,
           which is one of the classic tells of a generated heightfield. */
        if ((i + j) & 1) {
          stroke(); gb.tri(p00, p11, p10);
          stroke(); gb.tri(p00, p01, p11);
        } else {
          stroke(); gb.tri(p00, p01, p10);
          stroke(); gb.tri(p10, p01, p11);
        }
      }
    }
    var groundData = gb.build({ jitter: 0.0 });

    /* ---------- build plots ----------
       Explicit discrete plots rather than free placement. It makes the board
       read as a designed position instead of a field, it removes a whole class
       of "tower half inside a rock" bugs, and it gives the UI something
       concrete to highlight on hover. */

    /* ---------- PAVING ----------
       Every build plot gets a machined hex slab so the collection of plots
       reads as prepared emplacements, not as dots on the dirt. Clean stone
       family, consistent height, no lattice: this is the paving the owner
       asked for, baked into one merged mesh. */
    var padData = null;
    if (plots.length) {
      var padB = MESH.builder('pads:' + seed);
      var padCols = ['#2c2454', '#332a5f', '#241c45'];
      for (var pi2 = 0; pi2 < plots.length; pi2++) {
        var pp = plots[pi2];
        padB.color(padCols[pi2 % padCols.length]).tooth(0.7);
        /* Flush top (0.10 proud) and a flared skirt diving below the local
           relief: the skirt is wider at the bottom, so no downhill lip can
           show air and no uphill shoulder can poke through. */
        padB.push();
        padB.translate(pp.x, pp.y - 0.48, pp.z);
        padB.prism(1.34, 1.28, 0.34, 6, 0, 0.24);
        padB.pop();
        padB.push();
        padB.translate(pp.x, pp.y - 0.98, pp.z);
        padB.prism(1.78, 1.34, 0.52, 6, 0, 0.5);
        padB.pop();
      }
      padData = padB.build({ jitter: 0.015 });
    }

    /* ---------- WORLD ----------
       Not a sphere: the world is the GROUND'S OWN CURVE continuing outward.
       A planet sphere sized independently can rise above a more deeply
       sagged board and poke through it (measured on HALFWORLD: an eclipse
       ring where the sphere surfaced mid-field, burying the road and
       occluding every denizen under it). The correct construction is a
       paraboloid matching the height field's sag exactly minus a fixed
       underhang, so the world surface is guaranteed below the plate
       everywhere and the shoreline is seamless by construction. */
    var worldR = Math.max(def.planetR || 300, Math.max(halfW, halfH)) * 1.15;
    function worldY(r) { return -(r * r) / (2.0 * SAG_R) - 0.30; }
    var worldB = MESH.builder('world:' + seed);
    var wSides = 30;
    function wSpan(r0, r1, col) {
      var prof = [];
      for (var wi = 0; wi <= 5; wi++) {
        var r = r0 + (r1 - r0) * wi / 5;
        prof.push([r, worldY(r)]);
      }
      worldB.color(col);
      worldB.lathe(prof, wSides, wi * 0.35);
    }
    wSpan(0.001, worldR * 0.50, '#241b52');
    wSpan(worldR * 0.50, worldR * 0.85, '#1a1240');
    wSpan(worldR * 0.85, worldR * 1.00, '#100b26');
    /* Closing lip and underside: the world silhouette rolls over and the
       underside falls away, so the horizon reads as a planet shoulder. */
    wSpan(worldR * 1.00, worldR * 1.06, '#0d0920');
    var worldData = worldB.build({ jitter: 0.02 });

    /* WORLD RELIEF. The rest of the planet is terrain too: displacement plus
       per-vertex colouration ramped in only OUTSIDE the continent, so the
       shoreline underhang stays perfectly sealed and the far hemisphere
       reads as a rugged world rather than a smooth dome. */
    var boardR = Math.max(halfW, halfH) * 1.02;
    (function () {
      function wnoise(x, z) {
        var a = Math.sin(x * 0.045 + Math.sin(z * 0.037) * 2.1);
        var b = Math.cos(z * 0.052 + Math.sin(x * 0.041) * 1.7);
        var c = Math.sin((x + z) * 0.021 + 4.2);
        return a * 0.45 + b * 0.35 + c * 0.2;
      }
      var Vd = worldData.verts;
      for (var vi = 0; vi < Vd.length; vi += 12) {
        var px = Vd[vi], py = Vd[vi + 1], pz = Vd[vi + 2];
        var r = Math.hypot(px, pz);
        var m = U.smoothstep(boardR, boardR * 1.25, r) * (1.0 - U.smoothstep(worldR * 0.9, worldR * 1.02, r));
        if (m > 0.001) {
          var nl = wnoise(px, pz);
          Vd[vi + 1] = py + nl * 2.8 * m;
          var ck = 0.72 + 0.5 * Math.abs(nl);
          Vd[vi + 6] *= ck; Vd[vi + 7] *= ck; Vd[vi + 8] *= ck * 1.04;
          if (nl > 0.30) { Vd[vi + 6] *= 1.18; Vd[vi + 7] *= 1.10; Vd[vi + 8] *= 1.30; }
        }
      }
      /* Recompute facet normals so the relief catches the light properly. */
      for (var fi = 0; fi < Vd.length; fi += 36) {
        var ax = Vd[fi], ay = Vd[fi + 1], az = Vd[fi + 2];
        var bx = Vd[fi + 12], by = Vd[fi + 13], bz = Vd[fi + 14];
        var cx = Vd[fi + 24], cy = Vd[fi + 25], cz = Vd[fi + 26];
        var ux = bx - ax, uy = by - ay, uz = bz - az;
        var vx = cx - ax, vy = cy - ay, vz = cz - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= l; ny /= l; nz /= l;
        for (var k = 0; k < 3; k++) {
          var o = fi + k * 12;
          Vd[o + 3] = nx; Vd[o + 4] = ny; Vd[o + 5] = nz;
        }
      }
    })();

    /* World scenery: boulders and crystals scattered across the far
       hemisphere, seated on the displaced surface. */
    var worldRocksData = null;
    {
      var wrPieces = [];
      var wrRng = U.rng('wrocks:' + seed);
      var wcol = ['#1e1746', '#171138', '#241b52'];
      for (var wr = 0; wr < 26; wr++) {
        var anga = wrRng() * U.TAU;
        var rr = Math.max(halfW, halfH) * (1.04 + wrRng() * 0.30);
        if (rr > worldR * 0.92) continue;
        var rx = Math.cos(anga) * rr, rz = Math.sin(anga) * rr * 0.72;
        var rs = 0.8 + wrRng() * 2.2;
        var ry = worldY(rr) - 0.4;
        var wsb = MESH.builder('wrock' + wr + seed);
        wsb.tooth(1.0).color(wcol[wr % wcol.length]);
        wsb.ico(rs, 1);
        wrPieces.push(MESH.transform(wsb.build({ jitter: 0.15 }),
          U.m4trs(rx, ry + rs * 0.1, rz, wrRng() * 0.6, wrRng() * U.TAU, wrRng() * 0.6,
            1, 0.8 + wrRng() * 0.5, 1)));
      }
      if (wrPieces.length) worldRocksData = MESH.merge(wrPieces);
    }

    /* ---------- scenery ----------
       Baked into a single merged mesh: it never moves, so there is no reason
       to pay a draw call per rock. */
    var decor = [];
    var dr = U.rng('decor:' + seed);
    var rockProto = [];
    for (var rp = 0; rp < 4; rp++) {
      var rb = MESH.builder('rockproto' + rp);
      rb.tooth(1.0);
      rb.color(groundCols[rp % groundCols.length]);
      rb.ico(1.0, 1);
      rockProto.push(rb.build({ jitter: 0.22 }));
    }
    var pieces = [];
    var spirePieces = [];
    /* DECOR IS SCENERY, NOT SUBJECT. The first pass scattered 190 rocks at up
       to 3 units and they took over the frame: the board read as a quarry with
       a tower hidden in it. Scenery in this art direction exists to give the
       silhouette something to sit against, so the count is down and, more
       importantly, the size curve is much flatter. Anything large now has to
       earn its place as a spire on the rim instead. */
    var attempts = def.decor === undefined ? 52 : def.decor;
    for (var a = 0; a < attempts; a++) {
      var ang = dr() * U.TAU;
      var rad = Math.sqrt(dr()) * Math.min(halfW, halfH) * 1.02;
      var dx2 = Math.cos(ang) * rad * (halfW / Math.min(halfW, halfH));
      var dz2 = Math.sin(ang) * rad * (halfH / Math.min(halfW, halfH));
      if (Math.abs(dx2) > halfW * 0.97 || Math.abs(dz2) > halfH * 0.97) continue;
      if (distToPath(path, dx2, dz2) < pathWidth * 1.6) continue;
      var hy = heightAt(dx2, dz2);
      if (hy < -3) continue;
      var s = 0.5 + dr() * dr() * 0.9;
      var M = U.m4trs(dx2, hy + s * 0.12, dz2,
        dr() * 0.5 - 0.25, dr() * U.TAU, dr() * 0.5 - 0.25,
        s * (0.75 + dr() * 0.6), s * (0.8 + dr() * 0.6), s * (0.75 + dr() * 0.6));
      pieces.push(MESH.transform(rockProto[Math.floor(dr() * rockProto.length) % rockProto.length], M));
      decor.push({ x: dx2, z: dz2, y: hy, s: s });
    }

    /* Spires: a few tall silhouettes to break the horizon. The style law wants
       silhouette before detail, and a board that is entirely low scatter has
       no silhouette at all. */
    /* Spires sit ON the rim plateau now (radius 0.72..0.94 of the half
       extents, inside the height grid), so they read as anchored structures
       rising from the plate instead of sceptres floating in the void. They
       still never cast: under a low sun they would throw enormous shadows
       straight across the board and bury the towers. */
    var spireCols = def.spireCols || ['#0b0914', '#100c1d'];
    var spiresPlaced = [];
    for (var sp = 0; sp < (def.spires === undefined ? 7 : def.spires); sp++) {
      var sa = dr() * U.TAU;
      var srad = Math.min(halfW, halfH) * (0.70 + dr() * 0.30);
      var sx = Math.cos(sa) * srad * (halfW / Math.min(halfW, halfH));
      var sz = Math.sin(sa) * srad * (halfH / Math.min(halfW, halfH));
      if (Math.abs(sx) > halfW - CS * 0.5 || Math.abs(sz) > halfH - CS * 0.5) continue;
      if (Math.max(Math.abs(sx) / halfW, Math.abs(sz) / halfH) > 0.80) continue;
      if (distToPath(path, sx, sz) < pathWidth * 2.0) continue;
      var tooClose = false;
      for (var spc = 0; spc < spiresPlaced.length; spc++) {
        if (Math.hypot(spiresPlaced[spc][0] - sx, spiresPlaced[spc][1] - sz) < Math.min(halfW, halfH) * 0.12) tooClose = true;
      }
      if (tooClose) continue;
      spiresPlaced.push([sx, sz]);
      var sb = MESH.builder('spire' + sp + seed);
      sb.tooth(1.0).color(spireCols[sp % spireCols.length]);
      var hgt = 6 + dr() * 16;
      var rad0 = 0.9 + dr() * 1.5;
      /* A bedrock collar reads as the spire rising out of rock, not as a
         pilaster balanced on the surface. */
      sb.prism(rad0 * 1.55, rad0 * 0.9, 1.7, 5, -1.35, dr() * 3);
      sb.prism(rad0, rad0 * (0.15 + dr() * 0.3), hgt, 5 + (sp % 3), 0, dr() * 3);
      sb.color(spireCols[(sp + 1) % spireCols.length]);
      sb.prism(rad0 * 0.7, rad0 * 0.42, hgt * 0.34, 5, hgt * 0.55, dr() * 3);
      var sd = sb.build({ jitter: 0.10, warp: { freq: 0.22, amp: 0.42, phase: dr() * 6 } });
      var baseY = heightAt(sx, sz) - Math.max(1.0, rad0 * 0.55);
      /* SPIRES ARE KEPT SEPARATE FROM THE SCATTER.
         They stand outside the play area and are tall, so under a low sun they
         throw enormous shadows straight across the board. Physically right and
         visually ruinous: the debug channel showed most of the playfield under
         a moving spire shadow. They belong to the horizon, so they render but
         never cast. */
      spirePieces.push(MESH.transform(sd, U.m4trs(sx, baseY, sz, 0, dr() * U.TAU, 0, 1, 1, 1)));
    }

    var decorData = pieces.length ? MESH.merge(pieces) : null;
    var spireData = spirePieces.length ? MESH.merge(spirePieces) : null;

    return {
      id: def.id,
      def: def,
      path: path,
      cell: CS, gw: GW, gh: GH, halfW: halfW, halfH: halfH,
      pathWidth: pathWidth,
      height: height, heightAt: heightAt,
      plots: plots,
      groundData: groundData,
      padData: padData,
      worldData: worldData,
      worldRocksData: worldRocksData,
      decorData: decorData,
      spireData: spireData,
      spawn: pathAt(path, 0).pos,
      goal: pathAt(path, path.length).pos,
      pathAt: function (d) { return pathAt(path, d); },
      distToPath: function (x, z) { return distToPath(path, x, z); }
    };
  }

  return {
    build: build,
    buildPath: buildPath,
    pathAt: pathAt,
    distToPath: distToPath,
    catmull: catmull
  };
})();


