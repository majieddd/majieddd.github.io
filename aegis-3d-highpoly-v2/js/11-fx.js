/* HIGHPOLY :: 11-fx
   Particles, shatter, floating text and screen impact. Amplified edition:
   everything the base system did, plus GLOW and EMBER particle kinds, a
   coreFlash emitter (the heart of an explosion), sparks, dust, trails,
   combo-string impactKick, and colored screen flashes.

   THE SHATTER IS STILL THE THESIS. When something dies it comes apart into
   the FACETS it was painted with, each keeping its own colour. Everything
   else in this file exists to make that moment resonate: the flash beneath
   it, the ring around it, the sparks that break the silence.

   POOLING IS NOT OPTIONAL. Every array is allocated once at boot and reused
   with a live-count cursor, because the whole point of the amplification was
   MORE particles, and more particles means GC pressure matters more. */
'use strict';

var FX = (function () {

  var V = U.V;

  /* ---------- particles ---------- */
  var MAX = 6300;
  var px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  var vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  var pr = new Float32Array(MAX), pg = new Float32Array(MAX), pb = new Float32Array(MAX);
  var life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
  var size = new Float32Array(MAX), size1 = new Float32Array(MAX);
  var rot = new Float32Array(MAX), rotv = new Float32Array(MAX);
  var kind = new Float32Array(MAX), drag = new Float32Array(MAX), grav = new Float32Array(MAX);
  var alpha0 = new Float32Array(MAX);
  var count = 0;

  var KIND = { SPARK: 0, SMOKE: 1, RING: 2, FLAKE: 3, GLOW: 4, EMBER: 5 };

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
      /* Alpha holds, then falls. GLOW spends slightly longer at full, so the
         heart of an explosion breathes before it dies. */
      var a = alpha0[i] * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
      if (kind[i] === KIND.GLOW) a = alpha0[i] * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      R.pushParticle(px[i], py[i], pz[i], pr[i], pg[i], pb[i], a, s, rot[i], kind[i]);
    }
  }

  /* ---------- emitters ---------- */

  var rnd = U.rng('fx');

  /* ADDITIVE BLENDING SUMS, SO ALPHA MUST FALL AS COUNT RISES. */
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

  /* The heart of an explosion: a big soft glow that breathes then dies. This
     is the particle that makes a hit feel like LIGHT rather than like confetti. */
  function coreFlash(pos, color, size, life) {
    spawn({
      x: pos[0], y: pos[1], z: pos[2],
      vx: 0, vy: 0.4, vz: 0,
      r: color[0] * 1.25, g: color[1] * 1.25, b: color[2] * 1.25,
      life: life || 0.3,
      size: size || 1.5, size1: (size || 1.5) * 0.15,
      rot: 0, rotv: 0, kind: KIND.GLOW, drag: 0.4, grav: 0, alpha: 0.85
    });
  }

  /* Radial sparks that bounce and die. Heavier than burst: more speed range,
     more size range, longer tails. */
  function sparks(pos, color, opts) {
    opts = opts || {};
    var n = opts.count || 12;
    var spd = opts.speed || 13;
    var autoAlpha = U.clamp(2.8 / Math.sqrt(Math.max(1, n)), 0.3, 1.0);
    for (var i = 0; i < n; i++) {
      var th = rnd() * U.TAU;
      var ph = Math.acos(1 - rnd() * 1.05);
      var s = spd * (0.3 + rnd() * 1.1);
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: Math.sin(ph) * Math.cos(th) * s,
        vy: Math.cos(ph) * s * 0.9,
        vz: Math.sin(ph) * Math.sin(th) * s,
        r: color[0], g: color[1], b: color[2],
        life: (opts.life || 0.7) * (0.5 + rnd() * 0.9),
        size: (opts.size || 0.24) * (0.5 + rnd() * 1.1),
        size1: (opts.size || 0.24) * 0.06,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 18,
        kind: KIND.SPARK, drag: 3.2, grav: opts.grav === undefined ? -22 : opts.grav,
        alpha: opts.alpha === undefined ? autoAlpha : opts.alpha
      });
    }
  }

  /* Ground-hugging dust: low, spreading, slow. For stomps, builds and chunky
     impacts. Reads as mass rather than as fireworks. */
  function dust(pos, color, n, scale) {
    n = n || 8;
    scale = scale || 1;
    for (var i = 0; i < n; i++) {
      var th = rnd() * U.TAU;
      var r = rnd() * 1.6 * scale;
      var s = 1.4 + rnd() * 2.6;
      spawn({
        x: pos[0] + Math.cos(th) * r, y: pos[1] + rnd() * 0.3, z: pos[2] + Math.sin(th) * r,
        vx: Math.cos(th) * s, vy: 0.6 + rnd() * 1.2, vz: Math.sin(th) * s,
        r: color[0], g: color[1], b: color[2],
        life: 0.7 + rnd() * 0.7,
        size: (0.5 + rnd() * 0.5) * scale, size1: (1.6 + rnd() * 0.9) * scale,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 1.5,
        kind: KIND.SMOKE, drag: 2.4, grav: 0.6, alpha: 0.30
      });
    }
  }

  /* A short-lived trail behind a fast mover: two or three sparks that sit
     where the mover just was and die quickly. This is what makes a projectile
     read as being THROWN rather than as teleporting. */
  function trail(pos, color, n, size, life) {
    n = n || 2;
    for (var i = 0; i < n; i++) {
      spawn({
        x: pos[0] + (rnd() - 0.5) * 0.3,
        y: pos[1] + (rnd() - 0.5) * 0.3,
        z: pos[2] + (rnd() - 0.5) * 0.3,
        vx: (rnd() - 0.5) * 0.8, vy: (rnd() - 0.5) * 0.8, vz: (rnd() - 0.5) * 0.8,
        r: color[0], g: color[1], b: color[2],
        life: life || 0.2,
        size: (size || 0.18) * (0.6 + rnd() * 0.8),
        size1: 0.03,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 6,
        kind: KIND.SPARK, drag: 4.0, grav: 0, alpha: 0.7
      });
    }
  }

  /* A floating ember: a tiny pulsing point of light that drifts up. Used for
     ambient lane embers and for lingering heat after an explosion. */
  function ember(pos, color) {
    spawn({
      x: pos[0] + (rnd() - 0.5) * 1.4,
      y: pos[1] + rnd() * 0.4,
      z: pos[2] + (rnd() - 0.5) * 1.4,
      vx: (rnd() - 0.5) * 0.7, vy: 1.2 + rnd() * 1.6, vz: (rnd() - 0.5) * 0.7,
      r: color[0], g: color[1], b: color[2],
      life: 1.2 + rnd() * 1.4,
      size: 0.14 + rnd() * 0.16, size1: 0.02,
      rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 3,
      kind: KIND.EMBER, drag: 0.6, grav: -0.4, alpha: 0.8
    });
  }

  function muzzle(pos, dir, color, scale) {
    scale = scale || 1;
    /* The flash: a bright glow at the muzzle and 7 hardened sparks straight
       down the bore, plus a tight ring so the shot visibly leaves. */
    coreFlash(pos, color, 1.0 * scale, 0.13);
    for (var i = 0; i < 7; i++) {
      var spread = 0.35;
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: dir[0] * (8 + rnd() * 9) * scale + (rnd() - 0.5) * spread * 9,
        vy: dir[1] * (8 + rnd() * 9) * scale + (rnd() - 0.5) * spread * 9,
        vz: dir[2] * (8 + rnd() * 9) * scale + (rnd() - 0.5) * spread * 9,
        r: color[0], g: color[1], b: color[2],
        life: 0.12 + rnd() * 0.12,
        size: 0.42 + rnd() * 0.3, size1: 0.05,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 14,
        kind: KIND.SPARK, drag: 5.5, grav: -3, alpha: 1
      });
    }
    shockRing(pos, color, 0.9 * scale, 0.16);
  }

  /* THE SATISFYING HIT. One call for "this hit landed": a light heart, a
     spray of sparks, a shock ring, a ground puff and a small screen kick.
     Called from the damage path so every single projectile impact reads. */
  function impactKick(pos, color, opts) {
    opts = opts || {};
    var sc = opts.scale === undefined ? 1 : opts.scale;
    coreFlash(pos, color, (opts.flashSize || 1.1) * sc, (opts.flashLife || 0.22) * sc);
    sparks(pos, color, {
      count: opts.count || 12,
      speed: (opts.speed || 11) * sc,
      size: (opts.size || 0.24) * sc
    });
    if (opts.ring !== false) shockRing(pos, color, (opts.ringRadius || 2.2) * sc, 0.32);
    if (opts.dust) dust(pos, opts.dustColor || [0.35, 0.28, 0.5], opts.dust, sc);
    if (opts.embers) for (var i = 0; i < opts.embers; i++) ember(pos, color);
    hit((opts.kick === undefined ? 0.12 : opts.kick) * sc, {
      stop: opts.stop, aberr: opts.aberr, flash: opts.flash
    });
  }

  /* THE SHATTER. Reads the model's own facet list and throws each triangle
     away as a flake carrying that facet's colour. */
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
    /* The burst UNDER the shatter: a quick glow and a handful of sparks so the
       death reads as energy leaving the body, not just as parts falling. */
    if (opts.core !== false && facets.length) {
      var c = facets[0].col;
      coreFlash([wp[0], wp[1] + 0.4, wp[2]], [c[0], c[1], c[2]], 1.2 * (opts.size || 0.4), 0.18);
      sparks([wp[0], wp[1] + 0.4, wp[2]], [c[0], c[1], c[2]], {
        count: 6, speed: 9, size: 0.2
      });
    }
  }

  /* ---------- floating text ---------- */
  var texts = [];
  var TEXT_MAX = 90;

  function text(pos, str, opts) {
    opts = opts || {};
    if (opts.cls === 'reaction') {
      var bump = 0;
      for (var q = texts.length - 1; q >= 0 && q > texts.length - 8; q--) {
        var o = texts[q];
        if (o.cls !== 'reaction') continue;
        if (o.max - o.life > 0.42) continue;
        var dx = o.x - pos[0], dz = o.z - pos[2];
        if (dx * dx + dz * dz < 42) bump += 1;
      }
      if (bump >= 3) return;
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

  /* ---------- screen impact ---------- */
  var impact = { shake: 0, stop: 0, aberr: 0, flash: 0, flashRGB: [1, 1, 1] };

  function hit(strength, opts) {
    opts = opts || {};
    impact.shake = Math.max(impact.shake, strength);
    if (opts.stop) impact.stop = Math.max(impact.stop, opts.stop);
    if (opts.aberr !== false) impact.aberr = Math.max(impact.aberr, strength * 0.010);
    if (opts.flash) impact.flash = Math.max(impact.flash, opts.flash);
    if (opts.flashColor) {
      impact.flashRGB = opts.flashColor;
    }
  }

  function updateImpact(dt) {
    impact.shake = U.damp(impact.shake, 0, 7.5, dt);
    impact.aberr = U.damp(impact.aberr, 0, 4.2, dt);
    impact.flash = U.damp(impact.flash, 0, 9.0, dt);
    if (impact.shake < 0.001) impact.shake = 0;
    if (impact.aberr < 0.0001) impact.aberr = 0;
    if (impact.flash < 0.001) impact.flash = 0;
    R.fx.shake = impact.shake;
    R.fx.aberration = impact.aberr;
    R.fx.flashWhite = impact.flash;
    R.fx.flashRGB = impact.flashRGB;
  }

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
    coreFlash: coreFlash, sparks: sparks, dust: dust, trail: trail, ember: ember,
    impactKick: impactKick,
    shatter: shatter,
    text: text, updateText: updateText, texts: texts,
    hit: hit, updateImpact: updateImpact, consumeStop: consumeStop,
    impact: impact,
    clear: clear,
    get count() { return count; }
  };
})();
