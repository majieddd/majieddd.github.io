/* RELIQUARY :: 00-util
   Math, RNG, colour and easing. Zero dependencies by design: this project
   ships as plain <script> tags exactly like the parent game, so nothing here
   may use import or export.

   Matrices are column-major Float32Array(16), the layout WebGL wants, so a
   mat4 can go straight to uniformMatrix4fv with transpose=false. */
'use strict';

var U = (function () {

  /* ---------- scalar ---------- */
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sat(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) { var t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }

  /* Frame-rate independent exponential approach. `rate` is the fraction of the
     remaining distance closed per second. Using pow here rather than the usual
     v += (t-v)*k keeps spring damping identical at 30fps and 144fps, which
     matters because turret tracking is visible and would otherwise feel
     different on different machines. */
  function approach(cur, target, rate, dt) {
    return target + (cur - target) * Math.pow(1 - rate, dt * 60);
  }
  function damp(cur, target, lambda, dt) {
    return mix(target, cur, Math.exp(-lambda * dt));
  }
  /* Shortest signed angular difference, so a turret crossing the PI boundary
     takes the 5 degree path and not the 355 degree one. */
  function angDiff(a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  /* ---------- easing ---------- */
  var ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    outCubic: function (t) { var f = t - 1; return f * f * f + 1; },
    inCubic: function (t) { return t * t * t; },
    outQuart: function (t) { var f = t - 1; return 1 - f * f * f * f; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inExpo: function (t) { return t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)); },
    outBack: function (t) { var c = 1.70158, f = t - 1; return f * f * ((c + 1) * f + c) + 1; },
    outElastic: function (t) {
      if (t <= 0 || t >= 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
    },
    outBounce: function (t) {
      var n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d; return n * t * t + 0.984375;
    },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  };

  /* ---------- deterministic RNG ----------
     mulberry32 seeded by FNV-1a of a string. Every visual that must be stable
     across reloads (decor scatter, facet jitter, terrain) draws from a NAMED
     stream, so adding a new one later cannot shift an existing one. That is
     the same discipline the parent game's galaxy generator uses, and the
     reason it survives having features added to it. */
  function fnv1a(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rng(name) {
    var r = mulberry32(fnv1a(String(name)));
    r.range = function (a, b) { return a + (b - a) * r(); };
    r.int = function (a, b) { return Math.floor(a + (b - a + 1) * r()); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };
    r.sign = function () { return r() < 0.5 ? -1 : 1; };
    r.chance = function (p) { return r() < p; };
    r.gauss = function () {
      /* Box-Muller, one of the pair. Used for scatter that should clump
         naturally rather than read as a uniform grid. */
      var u = 1 - r(), v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    return r;
  }

  /* ---------- vec3 as plain arrays ---------- */
  var V = {
    make: function (x, y, z) { return [x || 0, y || 0, z || 0]; },
    copy: function (a) { return [a[0], a[1], a[2]]; },
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    scale: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    mul: function (a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    len2: function (a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; },
    dist: function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); },
    dist2: function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; },
    norm: function (a) {
      var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
      return l > 1e-8 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
    },
    lerp: function (a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  };

  /* ---------- mat4, column-major ---------- */
  function m4ident(o) {
    o = o || new Float32Array(16);
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }
  function m4mul(a, b, o) {
    o = o || new Float32Array(16);
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  }
  function m4persp(fovy, aspect, near, far, o) {
    o = o || new Float32Array(16);
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  }
  function m4ortho(l, r, b, t, n, f, o) {
    o = o || new Float32Array(16);
    var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
    o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1;
    return o;
  }
  function m4look(eye, center, up, o) {
    o = o || new Float32Array(16);
    var z = V.norm(V.sub(eye, center));
    /* Degenerate when eye and center coincide, or when up is parallel to the
       view axis. Both happen during camera transitions, and an un-guarded
       cross product silently produces NaN that then poisons every matrix
       downstream and blanks the whole frame with no error anywhere. */
    if (V.len2(z) < 1e-12) z = [0, 0, 1];
    var x = V.cross(up, z);
    if (V.len2(x) < 1e-12) x = V.cross([0, 0, 1], z);
    if (V.len2(x) < 1e-12) x = [1, 0, 0];
    x = V.norm(x);
    var y = V.cross(z, x);
    o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
    o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
    o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
    o[12] = -V.dot(x, eye); o[13] = -V.dot(y, eye); o[14] = -V.dot(z, eye); o[15] = 1;
    return o;
  }
  /* Rotation order YXZ: yaw, then pitch, then roll. Turrets yaw constantly and
     pitch occasionally, so putting yaw outermost keeps pitch reading as a
     local barrel elevation rather than as a skew. */
  function m4trs(tx, ty, tz, rx, ry, rz, sx, sy, sz, o) {
    o = o || new Float32Array(16);
    var cx = Math.cos(rx), sx1 = Math.sin(rx),
        cy = Math.cos(ry), sy1 = Math.sin(ry),
        cz = Math.cos(rz), sz1 = Math.sin(rz);
    var m00 = cy * cz + sy1 * sx1 * sz1, m01 = cx * sz1, m02 = -sy1 * cz + cy * sx1 * sz1;
    var m10 = -cy * sz1 + sy1 * sx1 * cz, m11 = cx * cz, m12 = sy1 * sz1 + cy * sx1 * cz;
    var m20 = sy1 * cx, m21 = -sx1, m22 = cy * cx;
    o[0] = m00 * sx; o[1] = m01 * sx; o[2] = m02 * sx; o[3] = 0;
    o[4] = m10 * sy; o[5] = m11 * sy; o[6] = m12 * sy; o[7] = 0;
    o[8] = m20 * sz; o[9] = m21 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  }
  function m4invert(a, o) {
    o = o || new Float32Array(16);
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return m4ident(o);
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  }
  function m4transpose(a, o) {
    o = o || new Float32Array(16);
    o[0] = a[0]; o[1] = a[4]; o[2] = a[8]; o[3] = a[12];
    o[4] = a[1]; o[5] = a[5]; o[6] = a[9]; o[7] = a[13];
    o[8] = a[2]; o[9] = a[6]; o[10] = a[10]; o[11] = a[14];
    o[12] = a[3]; o[13] = a[7]; o[14] = a[11]; o[15] = a[15];
    return o;
  }
  /* Normal matrix as a mat3 packed into 9 floats: the inverse transpose of the
     upper 3x3. Models are non-uniformly scaled (squash and stretch on hit),
     and skipping this makes lighting shear visibly during the hit pop. */
  function m3normalFromM4(a, o) {
    o = o || new Float32Array(9);
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[4], a11 = a[5], a12 = a[6],
        a20 = a[8], a21 = a[9], a22 = a[10];
    var b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20;
    var det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) { o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 1; o[5] = 0; o[6] = 0; o[7] = 0; o[8] = 1; return o; }
    det = 1 / det;
    o[0] = b01 * det;
    o[1] = (-a22 * a01 + a02 * a21) * det;
    o[2] = (a12 * a01 - a02 * a11) * det;
    o[3] = b11 * det;
    o[4] = (a22 * a00 - a02 * a20) * det;
    o[5] = (-a12 * a00 + a02 * a10) * det;
    o[6] = b21 * det;
    o[7] = (-a21 * a00 + a01 * a20) * det;
    o[8] = (a11 * a00 - a01 * a10) * det;
    return o;
  }
  function m4xform(m, v, o) {
    o = o || [0, 0, 0];
    var x = v[0], y = v[1], z = v[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!w) w = 1;
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  }
  function m4xformDir(m, v, o) {
    o = o || [0, 0, 0];
    var x = v[0], y = v[1], z = v[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z;
    o[1] = m[1] * x + m[5] * y + m[9] * z;
    o[2] = m[2] * x + m[6] * y + m[10] * z;
    return o;
  }

  /* ---------- colour ----------
     Everything the art direction cares about is easier in HSL than in hex, so
     palettes are authored as hex and pushed through here for tier shifts and
     faction recolours. */
  function hex2rgb(h) {
    if (typeof h !== 'string') return [1, 0, 1];
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [1, 0, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function rgb2hex(c) {
    function b(v) { var s = Math.round(sat(v) * 255).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + b(c[0]) + b(c[1]) + b(c[2]);
  }
  function rgb2hsl(c) {
    var r = c[0], g = c[1], b = c[2];
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d > 1e-6) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(c) {
    var h = ((c[0] % 1) + 1) % 1, s = sat(c[1]), l = sat(c[2]);
    if (s < 1e-6) return [l, l, l];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function k(t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [k(h + 1 / 3), k(h), k(h - 1 / 3)];
  }
  /* Shift a colour in HSL without leaving the palette. dl and ds are additive,
     dh is in turns. This is how tier 2 and tier 3 towers get hotter without a
     separately hand-authored palette per tier. */
  function shift(hexOrRgb, dh, ds, dl) {
    var rgb = typeof hexOrRgb === 'string' ? hex2rgb(hexOrRgb) : hexOrRgb;
    var hsl = rgb2hsl(rgb);
    return hsl2rgb([hsl[0] + (dh || 0), sat(hsl[1] + (ds || 0)), sat(hsl[2] + (dl || 0))]);
  }
  function luma(c) { return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722; }

  /* ---------- misc ---------- */
  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + 'k';
    return String(n);
  }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  return {
    TAU: TAU, clamp: clamp, sat: sat, lerp: lerp, mix: mix, smoothstep: smoothstep,
    sign: sign, approach: approach, damp: damp, angDiff: angDiff, ease: ease,
    fnv1a: fnv1a, mulberry32: mulberry32, rng: rng,
    V: V,
    m4ident: m4ident, m4mul: m4mul, m4persp: m4persp, m4ortho: m4ortho,
    m4look: m4look, m4trs: m4trs, m4invert: m4invert, m4transpose: m4transpose,
    m3normalFromM4: m3normalFromM4, m4xform: m4xform, m4xformDir: m4xformDir,
    hex2rgb: hex2rgb, rgb2hex: rgb2hex, rgb2hsl: rgb2hsl, hsl2rgb: hsl2rgb,
    shift: shift, luma: luma, fmt: fmt, nowMs: nowMs
  };
})();


