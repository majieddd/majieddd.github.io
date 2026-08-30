/* RELIQUARY :: 04-paint
   Procedural textures, generated on a 2D canvas at boot and uploaded once.

   WHY PROCEDURAL: the whole artifact has to be a single self-contained HTML
   file that runs from file:// with no network. Shipping image assets would
   mean base64 blobs measured in megabytes. Generating them costs about 30ms at
   boot and makes the texture parameters art-directable in source.

   ONE TEXTURE, THREE CHANNELS. Packing avoids three samplers and three binds:
     R  paint tooth      mid-frequency knife-stroke grain, used triplanar on
                         every lit surface
     G  canvas weave     a woven linen pattern, used in SCREEN space in the
                         final composite so the whole frame shares one surface
     B  streak           low-frequency directional streaks, for the ground

   SEAMLESS IS NOT OPTIONAL. The tooth is sampled triplanar across large
   terrain, so any seam becomes a visible grid line running the length of the
   board. Every generator here is either built from tiling trig or is mirrored
   into place. */
'use strict';

var PAINT = (function () {

  /* Seamless value noise on a torus. Sampling a 2D noise field along two
     circles guarantees the result wraps in both axes with no blending seam,
     which the usual "blend the edges" trick does not: that leaves a soft band
     that reads as a smudge once it is tiled twenty times across a floor. */
  function tileNoise(w, h, freq, seed) {
    var rnd = U.rng('tile:' + seed);
    /* Build a small random lattice, then sample it with bilinear interpolation
       at wrapped coordinates. */
    var N = Math.max(2, freq | 0);
    var lat = new Float32Array(N * N);
    for (var i = 0; i < N * N; i++) lat[i] = rnd();
    var out = new Float32Array(w * h);
    function at(x, y) {
      x = ((x % N) + N) % N;
      y = ((y % N) + N) % N;
      return lat[y * N + x];
    }
    for (var py = 0; py < h; py++) {
      for (var px = 0; px < w; px++) {
        var fx = px / w * N, fy = py / h * N;
        var x0 = Math.floor(fx), y0 = Math.floor(fy);
        var tx = fx - x0, ty = fy - y0;
        var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        var a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
        out[py * w + px] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
      }
    }
    return out;
  }

  function fbmTile(w, h, baseFreq, octaves, seed) {
    var out = new Float32Array(w * h);
    var amp = 0.5, total = 0, f = baseFreq;
    for (var o = 0; o < octaves; o++) {
      var layer = tileNoise(w, h, f, seed + ':' + o);
      for (var i = 0; i < out.length; i++) out[i] += layer[i] * amp;
      total += amp;
      amp *= 0.5;
      f *= 2;
    }
    for (var k = 0; k < out.length; k++) out[k] /= total;
    return out;
  }

  /* The packed atlas. 512 square is enough: it is sampled at a scale where
     individual weave threads are one to two pixels on screen, and doubling it
     costs 3MB of upload for detail nobody will resolve. */
  /* ---------- AETHER: material detail atlas ----------
     The HD path's surface data. One 1024 canvas, six 256px cells, one cell
     per material class. Channels (matching what the HD shader expects):
       R height  - defines the perturbed normal and the ridge highlights
       G rough   - roughness modulation around the material's base
       B albedo  - micro value variation, multiplied with the paint colour
       A ridge   - sparse crest web on which the specular breaks
     Every cell is seamless (built from the same torus-wrapping tileNoise
     the tooth atlas uses) and each is a generator rather than a paint: the
     parameters are art-directable in source. */
  function buildDetailAtlas(size) {
    size = size || 1024;
    var cell = size / 4;                       /* 256 */
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;

    /* Every generator writes into ITS OWN pixel buffer and returns it. Two
       cells sharing one buffer was the design mistake this averted: the six
       generators below are pure functions of their cell size, and the copy
       into the atlas happens once, after all six exist. */
    function emptyCell() {
      return new Uint8ClampedArray(cell * cell * 4);
    }

    /* AETHER CLEAN: low-frequency art-directed surfaces. The first HD pass
       used rich high-frequency noise in every cell and the board read as
       TV static; AAA stylized materials are FLAT colour blocks with crisp
       structural detail (seams, panels, ribs) at large scale, and nothing
       else. Every generator below obeys that rule: broad shapes, smooth
       interiors, albedo channel nearly flat at 1.0, roughness nearly flat at
       0.5 modulated only by the structure it describes. */

    /* Machined metal: big panel plates with crisp recessed seams. 64px
       panels on a 256px cell, chamfered inner bevel, no grain. */
    function metal() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 4, 2, 'det-metal-low');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var pvx = x % 64, pvy = y % 64;
          var seam = 0.0;
          /* Recessed seam: deep at the border, beveled inset, flat interior. */
          if (pvx < 6 || pvy < 6) seam = -0.18;
          else if (pvx < 10 || pvy < 10) seam = -0.07;
          var v = 0.55 + seam + (n[i] - 0.5) * 0.06;
          var rough = 0.5 + (seam < -0.15 ? 0.12 : 0);
          var alb = 1.0 + (n[i] - 0.5) * 0.05;
          var ridge = (seam < -0.15) ? 0.35 : 0.0;
          px[o] = Math.round(Math.min(1, Math.max(0, v)) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(ridge * 255);
        }
      }
      return px;
    }

    /* Hull extrusion: broad ribs with soft valleys, plus cap rails. Low
       frequency so the ribs read as structure, not as tweed. */
    function hullCell() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 5, 2, 'det-hull-low');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var rib = Math.cos((x % 64) / 64 * Math.PI * 2.0) * 0.5 + 0.5;
          rib = rib * rib * (3.0 - 2.0 * rib);
          var rail = Math.pow(Math.max(0, 1.0 - Math.abs((y % 128) - 64) / 40), 2.0) * 0.25;
          var v = 0.5 + (rib - 0.5) * 0.42 + rail + (n[i] - 0.5) * 0.05;
          var rough = 0.5 + (1.0 - rib) * 0.10 + (n[i] - 0.5) * 0.05;
          var alb = 1.0 + (n[i] - 0.5) * 0.05;
          var ridge = Math.pow(rib, 5.0) * 0.4;
          px[o] = Math.round(Math.min(1, v) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(ridge * 255);
        }
      }
      return px;
    }

    /* Stone: broad soft plateau patches, sparse fault lines, smooth. */
    function stoneCell() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 3, 2, 'det-stone-low');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var crack = 0;
          var cx = (x * 3 + y * 7) % 53;
          if (cx < 2) crack = -0.16; else if (cx < 4) crack = -0.06;
          var v = 0.5 + (n[i] - 0.5) * 0.34 + crack;
          var rough = 0.55 + (n[i] - 0.5) * 0.10;
          var alb = 1.0 + (n[i] - 0.5) * 0.10;
          var ridge = (crack < -0.15) ? 0.3 : 0.0;
          px[o] = Math.round(Math.min(1, Math.max(0, v)) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(Math.min(1, ridge) * 255);
        }
      }
      return px;
    }

    /* Organic: soft fbm surface bumps. No lattice: on small units a regular
       plate grid reads as target rings, which is exactly what the reviews
       called out on the enemy closeup. */
    function organicCell() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 5, 2, 'det-organic-low');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var v = 0.40 + (n[i] - 0.5) * 0.42;
          var rough = 0.55 + (n[i] - 0.5) * 0.12;
          var alb = 0.97 + (n[i] - 0.5) * 0.08;
          var ridge = 0.0;
          px[o] = Math.round(Math.min(1, v) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(ridge * 255);
        }
      }
      return px;
    }

    /* Energy: large hex cells, clean bright nodes, no grain. */
    function energyCell() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 3, 2, 'det-energy-low');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var pxv = (x % 64) - 32, pyv = (y % 64) - 32;
          var d0 = Math.sqrt(pxv * pxv + pyv * pyv);
          var hex = Math.max(0, 1.0 - d0 / 31.0);
          hex = hex * hex * (3.0 - 2.0 * hex);
          var v = 0.34 + hex * 0.56 + (n[i] - 0.5) * 0.04;
          var rough = 0.4 + (1.0 - hex) * 0.2;
          var alb = 0.92 + hex * 0.16;
          var ridge = Math.pow(hex, 4.0) * 0.5;
          px[o] = Math.round(Math.min(1, v) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(ridge * 255);
        }
      }
      return px;
    }

    /* Ground: the largest scale and the most afraid of noise. Nearly flat
       plate with a slow, gentle value drift and NO ridge web at all; the
       detail that survived the boardwide quilt cleanup was a fine web, and
       at this tiling scale it reads as dirt. */
    function groundCell() {
      var px = emptyCell();
      var n = fbmTile(cell, cell, 3, 2, 'det-ground-low');
      var nf = fbmTile(cell, cell, 9, 2, 'det-ground-mid');
      for (var y = 0; y < cell; y++) {
        for (var x = 0; x < cell; x++) {
          var i = y * cell + x, o = i * 4;
          var v = 0.5 + (n[i] - 0.5) * 0.28 + (nf[i] - 0.5) * 0.10;
          var rough = 0.6 + (n[i] - 0.5) * 0.08;
          var alb = 1.0 + (n[i] - 0.5) * 0.08;
          var ridge = 0.0;
          px[o] = Math.round(Math.min(1, Math.max(0, v)) * 255);
          px[o + 1] = Math.round(Math.min(1, rough) * 255);
          px[o + 2] = Math.round(Math.max(0, Math.min(1, alb)) * 255);
          px[o + 3] = Math.round(ridge * 255);
        }
      }
      return px;
    }

    /* Generate the six cells, then copy each into its atlas rectangle. */
    var cells = [
      { col: 0, row: 0, data: metal() },
      { col: 1, row: 0, data: hullCell() },
      { col: 2, row: 0, data: stoneCell() },
      { col: 3, row: 0, data: organicCell() },
      { col: 0, row: 1, data: energyCell() },
      { col: 1, row: 1, data: groundCell() }
    ];
    for (var c = 0; c < cells.length; c++) {
      var cl = cells[c];
      var cx0 = cl.col * cell, cy0 = cl.row * cell;
      for (var yy = 0; yy < cell; yy++) {
        var srcRow = yy * cell * 4;
        var dstRow = ((cy0 + yy) * size + cx0) * 4;
        for (var xx = 0; xx < cell * 4; xx++) {
          d[dstRow + xx] = cl.data[srcRow + xx];
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- AETHER: material classes ----------
     Each class names a cell in the detail atlas plus the roughness, metal
     and translucency the HD shader uses as its base. The shader reads these
     per draw, so a tower's hull is one material and its barrel another. */
  var MATERIALS = {
    metal:   { rect: [0.00, 0.00, 0.25, 0.25], rough: 0.36, metal: 0.85, sss: 0.00, det: 0.35 },
    hull:    { rect: [0.25, 0.00, 0.25, 0.25], rough: 0.52, metal: 0.45, sss: 0.00, det: 0.40 },
    stone:   { rect: [0.50, 0.00, 0.25, 0.25], rough: 0.88, metal: 0.00, sss: 0.05, det: 0.45 },
    organic: { rect: [0.75, 0.00, 0.25, 0.25], rough: 0.70, metal: 0.05, sss: 0.55, det: 0.45 },
    energy:  { rect: [0.00, 0.25, 0.25, 0.25], rough: 0.20, metal: 0.00, sss: 1.00, det: 0.60 },
    ground:  { rect: [0.25, 0.25, 0.25, 0.25], rough: 0.95, metal: 0.00, sss: 0.00, det: 0.14 }
  };

  function buildAtlas(size) {
    size = size || 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;

    var tooth = fbmTile(size, size, 8, 4, 'tooth');
    var streak = fbmTile(size, size, 3, 3, 'streak');
    var fine = fbmTile(size, size, 32, 2, 'fine');

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var i = y * size + x;
        var o = i * 4;

        /* R: knife tooth. The fbm is contrast-stretched and then given a
           directional bias, so strokes have a dominant angle the way a hand
           holding a knife does. */
        var t = tooth[i];
        var dir = (Math.sin((x * 0.9 + y * 0.42) * U.TAU / size * 6.0) * 0.5 + 0.5);
        t = U.sat(0.5 + (t - 0.5) * 1.9);
        t = U.mix(t, dir, 0.22);
        t = U.mix(t, fine[i], 0.18);

        /* G: canvas weave. Two perpendicular thread systems, each a raised
           cosine, multiplied so the crossings read as knots. The tiny noise
           term stops it looking like a screen-door moire. */
        var wx = Math.cos((x / size) * U.TAU * (size / 4)) * 0.5 + 0.5;
        var wy = Math.cos((y / size) * U.TAU * (size / 4)) * 0.5 + 0.5;
        var weave = U.sat(0.34 + 0.5 * (wx * 0.55 + wy * 0.55) + (fine[i] - 0.5) * 0.35);

        /* B: long streaks for ground and large flat panels. */
        var s = U.sat(0.5 + (streak[i] - 0.5) * 2.3);

        /* A: IMPASTO RIDGES. This channel was a constant 255 for the whole
           life of the renderer, a quarter of a 512x512 texture spent storing
           the number one. It now carries the single thing the surface was
           most obviously missing: paint has HEIGHT, and a knife leaves crests
           where two strokes overlap. Folding the noise about its midpoint
           (1 - |2n - 1|) turns level sets into thin lines rather than blobs,
           and raising that to a power thins them further, so the result is a
           sparse web of crests instead of a second cloud layer.

           DERIVED FROM THE HIGH-FREQUENCY OCTAVE, NOT THE LOW ONE. The first
           version folded the same freq-8 tooth the albedo already uses, and
           measurement killed it: pixels above 1.45x the frame mean went from
           4.5% to 20.8% while high-frequency energy moved 4.029 to 4.171, a
           rise of 3.5%. That is not texture, that is a brightness pass wearing
           texture as a disguise, and it is the exact failure a previous pass
           on this renderer already shipped once. Crests only read as crests
           at a spatial frequency near the pixel, so the fold is taken on the
           freq-32 octave and the exponents are high enough to leave a sparse
           web rather than a second cloud layer. */
        var fold = 1.0 - Math.abs(fine[i] * 2.0 - 1.0);
        var ridge = Math.pow(U.sat(fold), 7.0);
        var fold2 = 1.0 - Math.abs(tooth[i] * 2.0 - 1.0);
        ridge = U.sat(ridge * 0.85 + Math.pow(U.sat(fold2), 9.0) * 0.40);

        d[o] = Math.round(t * 255);
        d[o + 1] = Math.round(weave * 255);
        d[o + 2] = Math.round(s * 255);
        d[o + 3] = Math.round(ridge * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- faction palettes ----------
     Straight from ART-BIBLE section 2, which is LOCKED. The hexes are not
     invented here and must not be tuned: colour is faction identity in this
     universe and a shifted cyan is a different faction.

     Each palette adds the derived values this renderer needs, which the bible
     does not specify because it was written for 2D plates: the ambient
     hemisphere, the hued shadow, the nebula pair and the ink colour. Those ARE
     art choices made here, and they are made by pushing the locked key colour
     through HSL rather than by picking new hues, so a faction can never drift
     off its own identity. */
  function derive(key, opts) {
    var k = U.hex2rgb(key);
    var hsl = U.rgb2hsl(k);
    opts = opts || {};
    var shadowHue = opts.shadowHue === undefined ? 0.70 : opts.shadowHue;
    return {
      key: key,
      keyRgb: k,
      /* The shadow is the key colour dragged toward the void hue and crushed.
         Never neutral: the plates always have colour living in the blacks. */
      shadow: U.hsl2rgb([shadowHue, 0.62, 0.075]),
      light: U.hsl2rgb([(hsl[0] + (opts.lightWarm || 0.06)) % 1, 0.38, 0.90]),
      rim: U.hsl2rgb([(hsl[0] + (opts.rimShift || 0.0)) % 1, 1.0, 0.66]),
      ambientSky: U.hsl2rgb([shadowHue - 0.06, 0.58, 0.30]),
      ambientGround: U.hsl2rgb([shadowHue + 0.05, 0.62, 0.17]),
      skyTop: U.hsl2rgb([shadowHue - 0.02, 0.78, 0.115]),
      skyBottom: U.hsl2rgb([shadowHue + 0.06, 0.60, 0.215]),
      nebulaA: U.hsl2rgb([(hsl[0] + (opts.nebA || 0.0)) % 1, 0.86, 0.32]),
      nebulaB: U.hsl2rgb([(hsl[0] + (opts.nebB || 0.52)) % 1, 0.90, 0.40]),
      ink: U.hsl2rgb([shadowHue, 0.75, 0.035]),
      fog: U.hsl2rgb([shadowHue + 0.02, 0.62, 0.16])
    };
  }

  /* MAGENTA IS THE UNIVERSAL KEY LIGHT, not a faction colour (ART-BIBLE:
     "Neon magenta, vaporwave key light, skies, accents"). Every palette below
     therefore reaches magenta through its nebula or its rim, which is what
     makes five very different colour schemes still look like one game. */
  var FACTIONS = {
    human: Object.assign(derive('#38e8ff', { shadowHue: 0.66, rimShift: 0.02, nebA: 0.02, nebB: 0.42 }), {
      id: 'human', name: 'HUMANITY',
      motto: 'Cold competent industry.',
      accent: '#38e8ff', accent2: '#7dd3fc'
    }),
    light: Object.assign(derive('#fbbf24', { shadowHue: 0.74, lightWarm: 0.02, rimShift: -0.02, nebA: 0.86, nebB: 0.78 }), {
      id: 'light', name: 'FEDERATION OF LIGHT',
      motto: 'A cathedral that answers.',
      accent: '#fbbf24', accent2: '#fde68a'
    }),
    xeno: Object.assign(derive('#7c3aed', { shadowHue: 0.76, rimShift: 0.10, nebA: 0.08, nebB: 0.90 }), {
      id: 'xeno', name: 'THE XENO',
      motto: 'Accumulated, never designed.',
      accent: '#7c3aed', accent2: '#c084fc'
    }),
    pirate: Object.assign(derive('#ef4444', { shadowHue: 0.72, rimShift: 0.03, nebA: 0.97, nebB: 0.86 }), {
      id: 'pirate', name: 'THE PIRATES',
      motto: 'No two ships from the same yard.',
      accent: '#ef4444', accent2: '#fb923c'
    }),
    robotic: Object.assign(derive('#94a3b8', { shadowHue: 0.62, rimShift: 0.02, nebA: 0.50, nebB: 0.88 }), {
      id: 'robotic', name: 'THE VIGIL',
      motto: 'Tending a garden for a maker who is not coming back.',
      accent: '#94a3b8', accent2: '#5eead4'
    })
  };

  /* The vaporwave key. Held separately so effects can reach for it without
     going through a faction, and so there is exactly one definition of it. */
  var MAGENTA = U.hex2rgb('#ff2fd6');
  var VOID = U.hex2rgb('#0a0e17');

  return {
    buildAtlas: buildAtlas,
    buildDetailAtlas: buildDetailAtlas,
    MATERIALS: MATERIALS,
    fbmTile: fbmTile,
    FACTIONS: FACTIONS,
    MAGENTA: MAGENTA,
    VOID: VOID,
    derive: derive
  };
})();


