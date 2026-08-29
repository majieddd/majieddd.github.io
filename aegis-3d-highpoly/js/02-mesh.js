/* RELIQUARY :: 02-mesh
   The mesh builder. This file is where the ART lives, not just the geometry.

   THE CENTRAL IDEA
   The style law for this universe (ART-BIBLE section 1, "Neon Reliquary") asks
   for figures built from flat interlocking shapes, drawing carried by heavy
   shadow masses, silhouette readable before detail. A low-poly mesh is already
   flat interlocking shapes: the job is to stop it reading as CAD output and
   start it reading as a palette knife.

   Three decisions do that, and they are the reason this is not just a box
   generator:

   1. NON-INDEXED, PER-FACE NORMALS. Every triangle carries its own normal, so
      lighting breaks hard at every edge. No smoothing groups, ever. This is
      the single biggest contributor to the look.

   2. HAND-HEWN JITTER. After a primitive is built its vertices are displaced
      by a small seeded amount and the normals recomputed. A perfect cylinder
      becomes a hewn column. The jitter is applied per UNIQUE POSITION, not per
      vertex, or shared corners split apart and the model develops cracks that
      the shadow pass then renders as light leaks.

   3. PER-FACET PAINT DATA. Each triangle gets a stable random seed in aux.x
      which the shader uses to nudge value and hue. Two adjacent facets of the
      same nominal colour land on slightly different steps of the posterise
      ramp, which is exactly what a knife does when it lays two strokes of the
      same paint.

   Vertex layout, matching GL.ATTR:
     pos3, nrm3, col3, aux3   where aux = (facetSeed, toothWeight, emissive) */
'use strict';

var MESH = (function () {

  var V = U.V;

  /* ---------- transform stack builder ---------- */

  function builder(seedName) {
    var rnd = U.rng(seedName || 'mesh');
    var tris = [];               /* {p:[3][3], c:[3], tooth, emis} in local space */
    var stack = [];
    var M = U.m4ident();
    var col = [1, 0, 1];
    var tooth = 1.0;
    var emis = 0.0;

    var B = {};

    B.rnd = rnd;

    B.push = function () { stack.push(new Float32Array(M)); return B; };
    B.pop = function () {
      if (!stack.length) throw new Error('MESH.builder: pop with empty stack');
      M = stack.pop();
      return B;
    };
    /* Applied as M = M * T, so transforms compose parent-then-child in the
       order they are written, which is what reads naturally when assembling a
       model top down. */
    function apply(T) { M = U.m4mul(M, T); }

    B.translate = function (x, y, z) { apply(U.m4trs(x, y, z, 0, 0, 0, 1, 1, 1)); return B; };
    B.rotateX = function (a) { apply(U.m4trs(0, 0, 0, a, 0, 0, 1, 1, 1)); return B; };
    B.rotateY = function (a) { apply(U.m4trs(0, 0, 0, 0, a, 0, 1, 1, 1)); return B; };
    B.rotateZ = function (a) { apply(U.m4trs(0, 0, 0, 0, 0, a, 1, 1, 1)); return B; };
    B.scale = function (x, y, z) {
      if (y === undefined) { y = x; z = x; }
      apply(U.m4trs(0, 0, 0, 0, 0, 0, x, y, z));
      return B;
    };
    B.matrix = function () { return M; };

    B.color = function (c) {
      /* Throwing here rather than defaulting is deliberate. The usual way this
         goes wrong is indexing a palette with a negative modulo, which in JS
         yields undefined rather than wrapping, and the resulting failure deep
         inside a colour conversion names neither the palette nor the caller.
         An explicit message costs one branch at mesh build time, which happens
         a few hundred times at boot and never again. */
      if (c === undefined || c === null) {
        throw new Error('MESH.color: got ' + c + '. A palette lookup probably ' +
          'used a negative index: JS % keeps the sign, so use ((i % n) + n) % n.');
      }
      col = (typeof c === 'string') ? U.hex2rgb(c) : [c[0], c[1], c[2]];
      return B;
    };
    /* Tooth is how strongly the canvas-weave texture shows through in the
       shader. Metal and glass want it near zero; stone, hull plate and cloth
       want it at one. Emissive lifts a facet out of the lighting entirely,
       which is how every glowing vent and eye is done. */
    B.tooth = function (t) { tooth = t; return B; };
    B.emissive = function (e) { emis = e; return B; };

    /* Raw triangle in local space, transformed on the way in. */
    function tri(a, b, c) {
      var pa = U.m4xform(M, a), pb = U.m4xform(M, b), pc = U.m4xform(M, c);
      tris.push({ p: [pa, pb, pc], c: [col[0], col[1], col[2]], tooth: tooth, emis: emis });
    }
    B.tri = tri;
    /* Quad as two triangles. The face normal is cross(b-a, c-a), so a,b,c,d
       must be given counter-clockwise AS SEEN FROM OUTSIDE the surface.

       WINDING IS LOAD BEARING IN THIS PROJECT, far more than in a normal
       renderer, and it is worth saying why. Backface culling does not reliably
       hide a reversed triangle here, so a mistake does not show up as a hole:
       it shows up as a surface that draws perfectly but is LIT FROM THE WRONG
       SIDE, landing on the deep band of the posterise ramp. The symptom is
       "that area looks a bit too dark", which is indistinguishable from a
       tuning problem and survives any amount of grading work.

       That is not hypothetical. Nine of the fifteen primitives in this file
       shipped inward-facing, including the entire terrain, and it was found
       only by writing tools/winding.js and running it. That checker is now the
       gate: add a primitive, add a row to it. */
    function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }
    B.quad = quad;

    /* ---------- primitives ---------- */

    /* Box centred on the origin. The workhorse. */
    B.box = function (w, h, d) {
      var x = w / 2, y = h / 2, z = d / 2;
      var p = [
        [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
        [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]
      ];
      quad(p[4], p[5], p[6], p[7]); /* +z */
      quad(p[1], p[0], p[3], p[2]); /* -z */
      quad(p[5], p[1], p[2], p[6]); /* +x */
      quad(p[0], p[4], p[7], p[3]); /* -x */
      quad(p[3], p[7], p[6], p[2]); /* +y */
      quad(p[0], p[1], p[5], p[4]); /* -y */
      return B;
    };

    /* A box with independent top and bottom scales: the single most useful
       shape for this art direction because a slight taper reads as carved and
       a strong taper reads as a plinth or a blade. */
    B.frustum = function (bw, bd, tw, td, h, yOff) {
      var y0 = (yOff || 0), y1 = y0 + h;
      var b0 = [-bw / 2, y0, -bd / 2], b1 = [bw / 2, y0, -bd / 2],
          b2 = [bw / 2, y0, bd / 2], b3 = [-bw / 2, y0, bd / 2];
      var t0 = [-tw / 2, y1, -td / 2], t1 = [tw / 2, y1, -td / 2],
          t2 = [tw / 2, y1, td / 2], t3 = [-tw / 2, y1, td / 2];
      quad(b0, t0, t1, b1);
      quad(b1, t1, t2, b2);
      quad(b2, t2, t3, b3);
      quad(b3, t3, t0, b0);
      quad(t3, t2, t1, t0);
      quad(b0, b1, b2, b3);
      return B;
    };

    /* N-gon prism along +Y. `sides` stays low on purpose: 5 to 8 is the sweet
       spot where a form still reads as round but every facet is legible as a
       stroke. Twelve already looks like a smooth cylinder and kills the look. */
    B.prism = function (r0, r1, h, sides, yOff, phase) {
      sides = Math.max(3, sides | 0);
      var y0 = (yOff || 0), y1 = y0 + h, ph = phase || 0;
      var bot = [], top = [];
      for (var i = 0; i < sides; i++) {
        var a = ph + (i / sides) * U.TAU;
        bot.push([Math.cos(a) * r0, y0, Math.sin(a) * r0]);
        top.push([Math.cos(a) * r1, y1, Math.sin(a) * r1]);
      }
      for (var j = 0; j < sides; j++) {
        var k = (j + 1) % sides;
        if (r0 > 1e-5 && r1 > 1e-5) quad(bot[j], top[j], top[k], bot[k]);
        else if (r1 <= 1e-5) tri(bot[k], bot[j], [0, y1, 0]);
        else tri(top[j], top[k], [0, y0, 0]);
      }
      var cTop = [0, y1, 0], cBot = [0, y0, 0];
      if (r1 > 1e-5) for (var m = 0; m < sides; m++) tri(top[(m + 1) % sides], top[m], cTop);
      if (r0 > 1e-5) for (var n = 0; n < sides; n++) tri(bot[n], bot[(n + 1) % sides], cBot);
      return B;
    };

    B.cylinder = function (r, h, sides, yOff) { return B.prism(r, r, h, sides, yOff); };
    B.cone = function (r, h, sides, yOff) { return B.prism(r, 0, h, sides, yOff); };

    /* Icosahedron and its one-level subdivision. The base icosahedron is the
       best low-poly "rock or pod" in existence: twenty equal facets, reads as
       round, every face a distinct stroke. */
    var ICO_T = (1 + Math.sqrt(5)) / 2;
    var ICO_V = [
      [-1, ICO_T, 0], [1, ICO_T, 0], [-1, -ICO_T, 0], [1, -ICO_T, 0],
      [0, -1, ICO_T], [0, 1, ICO_T], [0, -1, -ICO_T], [0, 1, -ICO_T],
      [ICO_T, 0, -1], [ICO_T, 0, 1], [-ICO_T, 0, -1], [-ICO_T, 0, 1]
    ];
    var ICO_F = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    B.ico = function (r, subdiv) {
      var verts = ICO_V.map(function (v) { return V.scale(V.norm(v), r); });
      var faces = ICO_F.map(function (f) { return [verts[f[0]], verts[f[1]], verts[f[2]]]; });
      for (var s = 0; s < (subdiv || 0); s++) {
        var next = [];
        for (var i = 0; i < faces.length; i++) {
          var f = faces[i];
          var ab = V.scale(V.norm(V.scale(V.add(f[0], f[1]), 0.5)), r);
          var bc = V.scale(V.norm(V.scale(V.add(f[1], f[2]), 0.5)), r);
          var ca = V.scale(V.norm(V.scale(V.add(f[2], f[0]), 0.5)), r);
          next.push([f[0], ab, ca], [ab, f[1], bc], [ca, bc, f[2]], [ab, bc, ca]);
        }
        faces = next;
      }
      for (var k = 0; k < faces.length; k++) tri(faces[k][0], faces[k][1], faces[k][2]);
      return B;
    };

    /* A crystal shard: two cones back to back with an offset waist. Xeno and
       Light hardware is built almost entirely from these. */
    B.shard = function (r, hUp, hDown, sides, waistY) {
      sides = Math.max(3, sides | 0);
      var wy = waistY === undefined ? 0 : waistY;
      var ring = [];
      for (var i = 0; i < sides; i++) {
        var a = (i / sides) * U.TAU;
        ring.push([Math.cos(a) * r, wy, Math.sin(a) * r]);
      }
      var up = [0, wy + hUp, 0], dn = [0, wy - hDown, 0];
      for (var j = 0; j < sides; j++) {
        var k = (j + 1) % sides;
        tri(ring[k], ring[j], up);
        tri(ring[j], ring[k], dn);
      }
      return B;
    };

    /* Lathe a 2D profile [[r,y], ...] around Y. Used for domes, bells,
       reliquary plinths and the Federation's ceremonial forms. */
    B.lathe = function (profile, sides, phase) {
      sides = Math.max(3, sides | 0);
      var ph = phase || 0;
      for (var i = 0; i < profile.length - 1; i++) {
        var r0 = profile[i][0], y0 = profile[i][1];
        var r1 = profile[i + 1][0], y1 = profile[i + 1][1];
        for (var s = 0; s < sides; s++) {
          var a0 = ph + (s / sides) * U.TAU, a1 = ph + ((s + 1) / sides) * U.TAU;
          var p00 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0];
          var p10 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0];
          var p01 = [Math.cos(a0) * r1, y1, Math.sin(a0) * r1];
          var p11 = [Math.cos(a1) * r1, y1, Math.sin(a1) * r1];
          /* The two degenerate ends wind OPPOSITE ways, which is easy to get
             wrong by symmetry reasoning and is why both are covered by
             tools/winding.js: correcting them as a pair broke the lower tip
             while fixing the upper one. */
          if (r0 < 1e-5) tri(p01, p11, p00);
          else if (r1 < 1e-5) tri(p10, p00, p01);
          else quad(p00, p01, p11, p10);
        }
      }
      return B;
    };

    /* Extrude a closed 2D polygon (in XZ) along Y. Convex only: the cap
       triangulation is a simple fan, which is all this project needs and is
       far less code than a general ear-clip. */
    B.extrude = function (poly, h, yOff) {
      var y0 = yOff || 0, y1 = y0 + h, i, n = poly.length;
      /* Expects `poly` counter-clockwise in XZ as seen from +Y. */
      for (i = 0; i < n; i++) {
        var a = poly[i], b = poly[(i + 1) % n];
        quad([a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]]);
      }
      for (i = 1; i < n - 1; i++) {
        tri([poly[0][0], y1, poly[0][1]], [poly[i + 1][0], y1, poly[i + 1][1]], [poly[i][0], y1, poly[i][1]]);
        tri([poly[i + 1][0], y0, poly[i + 1][1]], [poly[0][0], y0, poly[0][1]], [poly[i][0], y0, poly[i][1]]);
      }
      return B;
    };

    /* A tapered segment between two points in space, with a square or n-gon
       cross section. This is the limb primitive: every leg bone, arm, barrel
       and antenna is one of these, which is why it takes explicit endpoints
       rather than relying on the transform stack. */
    B.limb = function (a, b, r0, r1, sides) {
      sides = Math.max(3, sides | 0);
      var dir = V.sub(b, a);
      var len = V.len(dir);
      if (len < 1e-6) return B;
      dir = V.scale(dir, 1 / len);
      /* Any vector not parallel to dir works as the seed for the basis. */
      var up = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
      var right = V.norm(V.cross(up, dir));
      var fwd = V.cross(dir, right);
      var ringA = [], ringB = [];
      for (var i = 0; i < sides; i++) {
        var ang = (i / sides) * U.TAU;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var off = V.add(V.scale(right, ca), V.scale(fwd, sa));
        ringA.push(V.add(a, V.scale(off, r0)));
        ringB.push(V.add(b, V.scale(off, r1)));
      }
      for (var j = 0; j < sides; j++) {
        var k = (j + 1) % sides;
        quad(ringA[j], ringA[k], ringB[k], ringB[j]);
      }
      for (var m = 1; m < sides - 1; m++) {
        tri(ringB[0], ringB[m], ringB[m + 1]);
        tri(ringA[m + 1], ringA[m], ringA[0]);
      }
      return B;
    };

    /* A flat ring in the XZ plane, drawn double sided. Range indicators,
       haloes, Federation rose windows. */
    B.ring = function (rInner, rOuter, sides, y) {
      sides = Math.max(3, sides | 0);
      var yy = y || 0;
      for (var i = 0; i < sides; i++) {
        var a0 = (i / sides) * U.TAU, a1 = ((i + 1) / sides) * U.TAU;
        var i0 = [Math.cos(a0) * rInner, yy, Math.sin(a0) * rInner];
        var i1 = [Math.cos(a1) * rInner, yy, Math.sin(a1) * rInner];
        var o0 = [Math.cos(a0) * rOuter, yy, Math.sin(a0) * rOuter];
        var o1 = [Math.cos(a1) * rOuter, yy, Math.sin(a1) * rOuter];
        quad(i0, i1, o1, o0);
      }
      return B;
    };

    /* ---------- finishing ---------- */

    /* Jitter is applied to UNIQUE POSITIONS, keyed by a quantised coordinate.
       Doing it per-vertex instead splits shared corners and opens visible
       cracks, which the shadow pass then renders as light leaking through the
       model. The quantisation grid is deliberately coarse (1e-4) so that
       positions meant to be identical are treated as identical despite
       floating point drift through the transform stack. */
    function jitterPositions(amount, warp) {
      if (amount <= 0 && !warp) return;
      var map = Object.create(null);
      var i, t, v, key;
      function keyOf(p) {
        return Math.round(p[0] * 1e4) + '_' + Math.round(p[1] * 1e4) + '_' + Math.round(p[2] * 1e4);
      }
      for (i = 0; i < tris.length; i++) {
        t = tris[i];
        for (v = 0; v < 3; v++) {
          key = keyOf(t.p[v]);
          if (map[key] === undefined) {
            var off = [
              (rnd() - 0.5) * 2 * amount,
              (rnd() - 0.5) * 2 * amount,
              (rnd() - 0.5) * 2 * amount
            ];
            if (warp) {
              /* A low-frequency sway on top of the high-frequency jitter, so
                 a tall form leans and bows like something built by hand rather
                 than merely being noisy. */
              var p = t.p[v];
              off[0] += Math.sin(p[1] * warp.freq + warp.phase) * warp.amp;
              off[2] += Math.cos(p[1] * warp.freq * 0.83 + warp.phase * 1.7) * warp.amp;
            }
            map[key] = off;
          }
          var o = map[key];
          t.p[v] = [t.p[v][0] + o[0], t.p[v][1] + o[1], t.p[v][2] + o[2]];
        }
      }
    }

    /* Build the interleaved vertex array. Normals are computed here from the
       final (post-jitter) positions, which is the whole point: jitter before
       normals means the lighting follows the hewn surface rather than the
       ideal one it was generated from. */
    B.build = function (opts) {
      opts = opts || {};
      var amount = opts.jitter === undefined ? 0.012 : opts.jitter;
      jitterPositions(amount, opts.warp || null);

      var n = tris.length;
      var out = new Float32Array(n * 3 * 12);
      var bounds = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity]
      };
      var w = 0;
      for (var i = 0; i < n; i++) {
        var t = tris[i];
        var e1 = V.sub(t.p[1], t.p[0]);
        var e2 = V.sub(t.p[2], t.p[0]);
        var nr = V.cross(e1, e2);
        var nl = V.len(nr);
        /* A degenerate triangle (zero area) yields a zero normal, which the
           shader would turn into a black facet. Jitter can create these when
           two vertices of a very small triangle land on the same point. Drop
           the normal to +Y rather than emitting NaN, and let it be shaded as
           a floor facet: invisible either way at that size. */
        nr = nl > 1e-9 ? [nr[0] / nl, nr[1] / nl, nr[2] / nl] : [0, 1, 0];

        /* Stable per-facet seed. Derived from the centroid rather than the
           loop index so that a facet keeps its character if the model is
           later rebuilt with primitives added in a different order. */
        var cx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3;
        var cy = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3;
        var cz = (t.p[0][2] + t.p[1][2] + t.p[2][2]) / 3;
        var h = U.fnv1a(Math.round(cx * 977) + ',' + Math.round(cy * 977) + ',' + Math.round(cz * 977));
        var seed = (h >>> 8) / 16777216;

        for (var v = 0; v < 3; v++) {
          var p = t.p[v];
          out[w++] = p[0]; out[w++] = p[1]; out[w++] = p[2];
          out[w++] = nr[0]; out[w++] = nr[1]; out[w++] = nr[2];
          out[w++] = t.c[0]; out[w++] = t.c[1]; out[w++] = t.c[2];
          out[w++] = seed; out[w++] = t.tooth; out[w++] = t.emis;
          if (p[0] < bounds.min[0]) bounds.min[0] = p[0];
          if (p[1] < bounds.min[1]) bounds.min[1] = p[1];
          if (p[2] < bounds.min[2]) bounds.min[2] = p[2];
          if (p[0] > bounds.max[0]) bounds.max[0] = p[0];
          if (p[1] > bounds.max[1]) bounds.max[1] = p[1];
          if (p[2] > bounds.max[2]) bounds.max[2] = p[2];
        }
      }
      if (!n) { bounds.min = [0, 0, 0]; bounds.max = [0, 0, 0]; }
      return { verts: out, index: null, bounds: bounds, triCount: n };
    };

    B.triCount = function () { return tris.length; };
    return B;
  }

  /* ---------- helpers over built data ---------- */

  /* Extract per-triangle centroids and normals so the death effect can throw
     each facet away individually. This is the visual pun the whole art
     direction is built on: a unit does not explode into debris, it comes apart
     into the brush strokes it was painted with. */
  function facets(data) {
    var out = [];
    var stride = 12;
    var perTri = stride * 3;
    var n = data.verts.length / perTri;
    for (var i = 0; i < n; i++) {
      var o = i * perTri;
      var v = data.verts;
      var cx = (v[o] + v[o + stride] + v[o + stride * 2]) / 3;
      var cy = (v[o + 1] + v[o + stride + 1] + v[o + stride * 2 + 1]) / 3;
      var cz = (v[o + 2] + v[o + stride + 2] + v[o + stride * 2 + 2]) / 3;
      out.push({
        c: [cx, cy, cz],
        n: [v[o + 3], v[o + 4], v[o + 5]],
        col: [v[o + 6], v[o + 7], v[o + 8]]
      });
    }
    return out;
  }

  /* Merge several built datasets into one buffer. Used to bake all the static
     scenery of a board into a single draw call. */
  function merge(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].verts.length;
    var out = new Float32Array(total);
    var w = 0;
    var bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (i = 0; i < list.length; i++) {
      out.set(list[i].verts, w);
      w += list[i].verts.length;
      var b = list[i].bounds;
      if (b) {
        for (var k = 0; k < 3; k++) {
          if (b.min[k] < bounds.min[k]) bounds.min[k] = b.min[k];
          if (b.max[k] > bounds.max[k]) bounds.max[k] = b.max[k];
        }
      }
    }
    return { verts: out, index: null, bounds: bounds, triCount: total / 36 };
  }

  /* Apply a matrix to already-built data. Cheaper than rebuilding when the
     same primitive is needed at several fixed places in a static bake. */
  function transform(data, M) {
    var N = U.m3normalFromM4(M);
    var v = new Float32Array(data.verts);
    for (var i = 0; i < v.length; i += 12) {
      var p = U.m4xform(M, [v[i], v[i + 1], v[i + 2]]);
      v[i] = p[0]; v[i + 1] = p[1]; v[i + 2] = p[2];
      var nx = v[i + 3], ny = v[i + 4], nz = v[i + 5];
      var tx = N[0] * nx + N[3] * ny + N[6] * nz;
      var ty = N[1] * nx + N[4] * ny + N[7] * nz;
      var tz = N[2] * nx + N[5] * ny + N[8] * nz;
      var l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      v[i + 3] = tx / l; v[i + 4] = ty / l; v[i + 5] = tz / l;
    }
    return { verts: v, index: null, bounds: null, triCount: data.triCount };
  }

  return {
    builder: builder,
    facets: facets,
    merge: merge,
    transform: transform
  };
})();
