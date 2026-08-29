/* RELIQUARY :: 11-fx
   Particles, shatter, floating text and screen impact.

   THE SHATTER IS THE THESIS OF THE WHOLE ART DIRECTION. When something dies it
   does not burst into generic debris: it comes apart into the FACETS it was
   painted with, each one keeping its own colour, tumbling and fading. The
   model is a set of knife strokes, so its death is those strokes coming loose.
   Everything else in this file exists to support that moment.

   POOLING IS NOT OPTIONAL. A busy wave produces a few thousand particles a
   second. Allocating an object per particle produces a GC sawtooth that shows
   up as a stutter precisely when the screen is most crowded, which is exactly
   when the player is least willing to forgive one. Every array here is
   allocated once at boot and reused with a live-count cursor. */
'use strict';

var FX = (function () {

  var V = U.V;

  /* ---------- particles ----------
     Struct-of-arrays rather than array-of-structs. It is uglier to read and it
     is the difference between a flat frame time and a visible hitch: the
     update loop touches x, y, z, vx, vy, vz contiguously instead of chasing a
     pointer per particle. */
  var MAX = 3600;
  var px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  var vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  var pr = new Float32Array(MAX), pg = new Float32Array(MAX), pb = new Float32Array(MAX);
  var life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
  var size = new Float32Array(MAX), size1 = new Float32Array(MAX);
  var rot = new Float32Array(MAX), rotv = new Float32Array(MAX);
  var kind = new Float32Array(MAX), drag = new Float32Array(MAX), grav = new Float32Array(MAX);
  var alpha0 = new Float32Array(MAX);
  var count = 0;

  var KIND = { SPARK: 0, SMOKE: 1, RING: 2, FLAKE: 3 };

  function spawn(o) {
    if (count >= MAX) return -1;
    var i = count++;
    px[i] = o.x; py[i] = o.y; pz[i] = o.z;
    vx[i] = o.vx || 0; vy[i] = o.vy || 0; vz[i] = o.vz || 0;
    pr[i] = o.r; pg[i] = o.g; pb[i] = o.b;
    life[i] = maxLife[i] = o.life;
    size[i] = o.size; size1[i] = o.size1 === undefined ? o.size * 0.2 : o.size1;
    rot[i] = o.rot || 0; rotv[i] = o.rotv || 0;
    kind[i] = o.kind || 0;
    drag[i] = o.drag === undefined ? 1.6 : o.drag;
    grav[i] = o.grav === undefined ? -14 : o.grav;
    alpha0[i] = o.alpha === undefined ? 1 : o.alpha;
    return i;
  }

  function update(dt) {
    var i = 0;
    while (i < count) {
      life[i] -= dt;
      if (life[i] <= 0) {
        /* Swap-with-last removal. Order does not matter for additive
           particles, so this is O(1) and avoids the array shuffle that a
           splice would do thousands of times a second. */
        var last = --count;
        if (i !== last) {
          px[i] = px[last]; py[i] = py[last]; pz[i] = pz[last];
          vx[i] = vx[last]; vy[i] = vy[last]; vz[i] = vz[last];
          pr[i] = pr[last]; pg[i] = pg[last]; pb[i] = pb[last];
          life[i] = life[last]; maxLife[i] = maxLife[last];
          size[i] = size[last]; size1[i] = size1[last];
          rot[i] = rot[last]; rotv[i] = rotv[last];
          kind[i] = kind[last]; drag[i] = drag[last]; grav[i] = grav[last];
          alpha0[i] = alpha0[last];
        }
        continue;
      }
      var d = Math.exp(-drag[i] * dt);
      vx[i] *= d; vz[i] *= d;
      vy[i] = vy[i] * d + grav[i] * dt;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      rot[i] += rotv[i] * dt;
      /* Bounce off the ground once, with heavy damping. Particles that sink
         through the floor read as a bug even when nobody could say why. */
      if (py[i] < 0.05 && vy[i] < 0) {
        py[i] = 0.05;
        vy[i] *= -0.32;
        vx[i] *= 0.6; vz[i] *= 0.6;
        rotv[i] *= 0.5;
      }
      i++;
    }
  }

  function submit() {
    for (var i = 0; i < count; i++) {
      var t = 1 - life[i] / maxLife[i];
      var s = U.mix(size[i], size1[i], t);
      /* Alpha holds then falls, rather than fading linearly from birth. A
         linear fade makes every particle look like it is dying from the
         instant it appears, which drains the punch out of an impact. */
      var a = alpha0[i] * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
      R.pushParticle(px[i], py[i], pz[i], pr[i], pg[i], pb[i], a, s, rot[i], kind[i]);
    }
  }

  /* ---------- emitters ---------- */

  var rnd = U.rng('fx');

  /* ADDITIVE BLENDING SUMS, SO ALPHA MUST FALL AS COUNT RISES.
     A twenty-particle burst at alpha 1 puts twenty times the element colour
     through the same pixels, every channel clips, and a coloured explosion
     renders as a white blob with no hue left in it. Scaling alpha by roughly
     the inverse square root of the count keeps the PEAK brightness about
     constant while the burst still gets visibly bigger. */
  function burst(pos, color, opts) {
    opts = opts || {};
    var n = opts.count || 14;
    var spd = opts.speed || 9;
    var autoAlpha = U.clamp(2.6 / Math.sqrt(Math.max(1, n)), 0.28, 1.0);
    for (var i = 0; i < n; i++) {
      var th = rnd() * U.TAU;
      var ph = Math.acos(1 - rnd() * (opts.hemi === false ? 2 : 1.15));
      var s = spd * (0.35 + rnd() * 0.9);
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: Math.sin(ph) * Math.cos(th) * s,
        vy: Math.cos(ph) * s * (opts.up === undefined ? 1 : opts.up),
        vz: Math.sin(ph) * Math.sin(th) * s,
        r: color[0], g: color[1], b: color[2],
        life: (opts.life || 0.6) * (0.6 + rnd() * 0.8),
        size: (opts.size || 0.32) * (0.6 + rnd() * 0.8),
        size1: (opts.size || 0.32) * 0.1,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 9,
        kind: opts.kind === undefined ? KIND.SPARK : opts.kind,
        drag: opts.drag === undefined ? 2.2 : opts.drag,
        grav: opts.grav === undefined ? -16 : opts.grav,
        alpha: opts.alpha === undefined ? autoAlpha : opts.alpha
      });
    }
  }

  function smoke(pos, color, n, scale) {
    n = n || 6;
    scale = scale || 1;
    for (var i = 0; i < n; i++) {
      spawn({
        x: pos[0] + (rnd() - 0.5) * 1.2 * scale,
        y: pos[1] + rnd() * 0.6 * scale,
        z: pos[2] + (rnd() - 0.5) * 1.2 * scale,
        vx: (rnd() - 0.5) * 2.2, vy: 1.2 + rnd() * 2.0, vz: (rnd() - 0.5) * 2.2,
        r: color[0], g: color[1], b: color[2],
        life: 1.1 + rnd() * 1.0,
        size: (1.1 + rnd() * 0.8) * scale, size1: (2.6 + rnd()) * scale,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 1.2,
        kind: KIND.SMOKE, drag: 1.1, grav: 1.4, alpha: 0.42
      });
    }
  }

  function shockRing(pos, color, radius, life) {
    spawn({
      x: pos[0], y: pos[1] + 0.2, z: pos[2],
      vx: 0, vy: 0, vz: 0,
      r: color[0], g: color[1], b: color[2],
      life: life || 0.42,
      size: radius * 0.35, size1: radius * 2.1,
      rot: 0, rotv: 0, kind: KIND.RING, drag: 0, grav: 0, alpha: 0.55
    });
  }

  function muzzle(pos, dir, color) {
    for (var i = 0; i < 7; i++) {
      var spread = 0.35;
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: dir[0] * (8 + rnd() * 9) + (rnd() - 0.5) * spread * 9,
        vy: dir[1] * (8 + rnd() * 9) + (rnd() - 0.5) * spread * 9,
        vz: dir[2] * (8 + rnd() * 9) + (rnd() - 0.5) * spread * 9,
        r: color[0], g: color[1], b: color[2],
        life: 0.12 + rnd() * 0.12,
        size: 0.42 + rnd() * 0.3, size1: 0.05,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 14,
        kind: KIND.SPARK, drag: 5.5, grav: -3, alpha: 1
      });
    }
    shockRing(pos, color, 0.9, 0.16);
  }

  /* THE SHATTER. Reads the model's own facet list and throws each triangle
     away as a flake carrying that facet's colour. This is why MESH.facets
     exists at all. */
  function shatter(meshData, worldMatrix, opts) {
    opts = opts || {};
    var facets = MESH.facets(meshData);
    var stride = Math.max(1, Math.ceil(facets.length / (opts.max || 46)));
    var force = opts.force || 8;
    var origin = opts.origin || null;
    for (var i = 0; i < facets.length; i += stride) {
      var f = facets[i];
      var wp = U.m4xform(worldMatrix, f.c);
      var wn = U.m4xformDir(worldMatrix, f.n);
      /* Direction: mostly the facet's own normal, so the shell peels outward
         the way a real one would, plus a push away from the killing blow. */
      var dir = V.norm(wn);
      if (origin) {
        var away = V.norm(V.sub(wp, origin));
        dir = V.norm(V.add(dir, V.scale(away, 1.35)));
      }
      var s = force * (0.5 + rnd() * 1.0);
      spawn({
        x: wp[0], y: wp[1], z: wp[2],
        vx: dir[0] * s + (rnd() - 0.5) * 2.5,
        vy: Math.abs(dir[1]) * s * 0.7 + 3.5 + rnd() * 4,
        vz: dir[2] * s + (rnd() - 0.5) * 2.5,
        r: f.col[0] * 1.35, g: f.col[1] * 1.35, b: f.col[2] * 1.35,
        life: 0.85 + rnd() * 0.9,
        size: (opts.size || 0.4) * (0.65 + rnd() * 0.7),
        size1: (opts.size || 0.4) * 0.5,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 16,
        kind: KIND.FLAKE, drag: 1.1, grav: -20, alpha: 1
      });
    }
  }

  /* ---------- floating text ----------
     Damage numbers and reaction callouts, projected to screen space and drawn
     by the DOM layer. Kept here rather than in the UI because their lifetime
     is a gameplay concern and they must pause with the sim. */
  var texts = [];
  var TEXT_MAX = 90;

  function text(pos, str, opts) {
    opts = opts || {};
    /* CALLOUT ANTI-OVERPRINT. Several reactions landing in the same instant on
       adjacent bodies used to draw their names on top of each other, which is
       less legible than showing one. A callout that arrives on top of a very
       recent identical one is nudged up and out instead of stacking, so a
       cluster reads as a short column rather than as a smear. */
    if (opts.cls === 'reaction') {
      var bump = 0;
      for (var q = texts.length - 1; q >= 0 && q > texts.length - 8; q--) {
        var o = texts[q];
        if (o.cls !== 'reaction') continue;
        if (o.max - o.life > 0.42) continue;
        var dx = o.x - pos[0], dz = o.z - pos[2];
        if (dx * dx + dz * dz < 42) bump += 1;
      }
      if (bump >= 3) return;              /* a fourth in one cluster adds nothing */
      pos = [pos[0], pos[1] + bump * 1.5, pos[2]];
    }
    if (texts.length >= TEXT_MAX) texts.shift();
    texts.push({
      x: pos[0], y: pos[1], z: pos[2],
      vy: opts.vy === undefined ? 3.4 : opts.vy,
      drift: (rnd() - 0.5) * 1.6,
      str: str,
      color: opts.color || '#ffffff',
      life: opts.life || 1.15,
      max: opts.life || 1.15,
      size: opts.size || 1,
      crit: !!opts.crit,
      cls: opts.cls || ''
    });
  }

  function updateText(dt) {
    for (var i = texts.length - 1; i >= 0; i--) {
      var t = texts[i];
      t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.x += t.drift * dt;
      t.vy *= Math.exp(-2.2 * dt);
    }
  }

  /* ---------- screen impact ----------
     Shake, hit-stop and chromatic aberration, all driven from one place so
     they cannot fight each other.

     HIT-STOP IS THE MOST UNDERRATED TOOL IN GAME FEEL. Freezing the simulation
     for 60 to 120 milliseconds on a big hit makes the hit land in a way no
     amount of particles can. It is applied as a TIME SCALE rather than a
     skipped frame so that animation, audio and physics all agree. */
  var impact = { shake: 0, stop: 0, aberr: 0, flash: 0 };

  function hit(strength, opts) {
    opts = opts || {};
    impact.shake = Math.max(impact.shake, strength);
    if (opts.stop) impact.stop = Math.max(impact.stop, opts.stop);
    if (opts.aberr !== false) impact.aberr = Math.max(impact.aberr, strength * 0.010);
    if (opts.flash) impact.flash = Math.max(impact.flash, opts.flash);
  }

  function updateImpact(dt) {
    /* Shake decays fast and aberration slower, so a hit reads as a jolt
       followed by a lingering distortion rather than as one blunt pulse. */
    impact.shake = U.damp(impact.shake, 0, 7.5, dt);
    impact.aberr = U.damp(impact.aberr, 0, 4.2, dt);
    impact.flash = U.damp(impact.flash, 0, 9.0, dt);
    if (impact.shake < 0.001) impact.shake = 0;
    if (impact.aberr < 0.0001) impact.aberr = 0;
    if (impact.flash < 0.001) impact.flash = 0;
    R.fx.shake = impact.shake;
    R.fx.aberration = impact.aberr;
    R.fx.flashWhite = impact.flash;
  }

  /* Consume any pending hit-stop, returning the fraction of this frame the
     simulation should actually advance. */
  function consumeStop(dt) {
    if (impact.stop <= 0) return dt;
    var used = Math.min(impact.stop, dt);
    impact.stop -= used;
    return Math.max(0, dt - used);
  }

  function clear() {
    count = 0;
    texts.length = 0;
    impact.shake = impact.stop = impact.aberr = impact.flash = 0;
  }

  return {
    KIND: KIND,
    spawn: spawn, update: update, submit: submit,
    burst: burst, smoke: smoke, shockRing: shockRing, muzzle: muzzle,
    shatter: shatter,
    text: text, updateText: updateText, texts: texts,
    hit: hit, updateImpact: updateImpact, consumeStop: consumeStop,
    impact: impact,
    clear: clear,
    get count() { return count; }
  };
})();
