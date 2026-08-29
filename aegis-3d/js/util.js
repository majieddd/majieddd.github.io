/* lowpoly/js/util.js — seeded PRNG, math helpers, pooling, fps.
   Classic script; defines window.Util. */
(function () {
  'use strict';

  /* mulberry32 — deterministic per-seed streams. The whole visual identity is
     seeded so a re-run of the same match reproduces the same paint, terrain and
     waves. The trap this guards against: Math.random() means a bug you saw once
     can never be reproduced. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261; // FNV-1a: stable across runs, unlike Math.random
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const dist2 = (ax, az, bx, bz) => {
    const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz;
  };
  const angLerp = (a, b, t) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  const easings = {
    outBack: (t) => { const c = 1.70158; t -= 1; return t * t * ((c + 1) * t + c) + 1; },
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outQuad: (t) => t * (2 - t),
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    linear: (t) => t
  };

  /* Fixed-size pool of plain objects; particles are the hot path and GC churn
     there shows up as frame spikes. */
  function Pool(factory, size) {
    this.items = [];
    this.i = 0;
    for (let n = 0; n < size; n++) this.items.push(factory());
  }
  Pool.prototype.get = function () {
    const it = this.items[this.i];
    this.i = (this.i + 1) % this.items.length;
    return it;
  };

  function FpsMeter() {
    this.frames = 0; this.acc = 0; this.fps = 0;
  }
  FpsMeter.prototype.tick = function (dt) {
    this.frames++; this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.frames = 0; this.acc = 0;
    }
  };

  window.Util = {
    mulberry32, hashStr, clamp, lerp, damp, dist2, angLerp, easings, Pool, FpsMeter
  };
})();
