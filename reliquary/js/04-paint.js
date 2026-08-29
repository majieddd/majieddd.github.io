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
      ambientGround: U.hsl2rgb([shadowHue + 0.05, 0.62, 0.14]),
      skyTop: U.hsl2rgb([shadowHue - 0.02, 0.78, 0.095]),
      skyBottom: U.hsl2rgb([shadowHue + 0.06, 0.66, 0.185]),
      nebulaA: U.hsl2rgb([(hsl[0] + (opts.nebA || 0.0)) % 1, 0.86, 0.42]),
      nebulaB: U.hsl2rgb([(hsl[0] + (opts.nebB || 0.52)) % 1, 0.90, 0.52]),
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
      id: 'robotic', name: 'THE PARALLEL',
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
    fbmTile: fbmTile,
    FACTIONS: FACTIONS,
    MAGENTA: MAGENTA,
    VOID: VOID,
    derive: derive
  };
})();
