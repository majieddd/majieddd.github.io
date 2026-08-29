/* RELIQUARY :: 11-fx
   Particles, shatter, floating text and screen impact.

   THE SHATTER IS THE THESIS OF THE WHOLE ART DIRECTION. When something dies it
   does not burst into generic debris: it comes apart into the FACETS it was
   painted with, each one keeping its own colour, tumbling and fading. The
   model is a set of knife strokes, so its death is those strokes coming loose.

   WHAT MAKES PARTICLES READ AS EXPENSIVE. Not count. Four things, all here:

   1. VELOCITY STRETCH. A fast spark elongates along its own motion. A round
      dot travelling at speed reads as an insect crossing the screen; a streak
      reads as a spark. This is the single largest difference between a cheap
      and an expensive looking hit, and it is computed in the vertex shader
      from the velocity that now rides in the instance stream.

   2. COLOUR OVER LIFE. Real sparks cool: white hot, then the element colour,
      then dark. Every particle here carries a start AND an end colour and is
      interpolated per frame, so a burst changes hue as it dies instead of
      merely fading.

   3. SIZE AND ALPHA CURVES THAT ARE NOT LINEAR. Alpha holds then falls off a
      cliff; size punches out then settles. A linear fade from full makes every
      particle look like it started dying the instant it appeared, which drains
      the punch out of an impact.

   4. LAYERS. One emitter is a puff. A hit here is a flash, plus a spray of
      stretched streaks, plus slower embers, plus a shock ring, plus a few hard
      shards, each on its own curve. The layering is what the eye reads as
      production value.

   POOLING IS NOT OPTIONAL. A busy wave produces a few thousand particles a
   second. Allocating an object per particle produces a GC sawtooth that shows
   up as a stutter precisely when the screen is most crowded. Every array here
   is allocated once at boot and reused with a live-count cursor. */
'use strict';

var FX = (function () {

  var V = U.V;

  /* ---------- particles ----------
     Struct-of-arrays rather than array-of-structs. It is uglier to read and it
     is the difference between a flat frame time and a visible hitch: the
     update loop touches x, y, z, vx, vy, vz contiguously instead of chasing a
     pointer per particle. */
  var MAX = 5200;
  var px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  var vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  /* Start and end colour, lerped over life. */
  var r0 = new Float32Array(MAX), g0 = new Float32Array(MAX), b0 = new Float32Array(MAX);
  var r1 = new Float32Array(MAX), g1 = new Float32Array(MAX), b1 = new Float32Array(MAX);
  var life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
  var size = new Float32Array(MAX), size1 = new Float32Array(MAX);
  var rot = new Float32Array(MAX), rotv = new Float32Array(MAX);
  var kind = new Float32Array(MAX), drag = new Float32Array(MAX), grav = new Float32Array(MAX);
  var alpha0 = new Float32Array(MAX);
  var stretch = new Float32Array(MAX);
  var turb = new Float32Array(MAX);
  var bounce = new Float32Array(MAX);
  var count = 0;

  var KIND = { SPARK: 0, SMOKE: 1, RING: 2, FLAKE: 3, STREAK: 4, EMBER: 5, SHARD: 6, MOTE: 7 };

  function spawn(o) {
    if (count >= MAX) return -1;
    var i = count++;
    px[i] = o.x; py[i] = o.y; pz[i] = o.z;
    vx[i] = o.vx || 0; vy[i] = o.vy || 0; vz[i] = o.vz || 0;
    r0[i] = o.r; g0[i] = o.g; b0[i] = o.b;
    /* An unspecified end colour defaults to a darkened version of the start,
       so every particle cools even when the caller did not think about it. */
    r1[i] = o.r1 === undefined ? o.r * 0.35 : o.r1;
    g1[i] = o.g1 === undefined ? o.g * 0.22 : o.g1;
    b1[i] = o.b1 === undefined ? o.b * 0.42 : o.b1;
    life[i] = maxLife[i] = o.life;
    size[i] = o.size; size1[i] = o.size1 === undefined ? o.size * 0.2 : o.size1;
    rot[i] = o.rot || 0; rotv[i] = o.rotv || 0;
    kind[i] = o.kind || 0;
    drag[i] = o.drag === undefined ? 1.6 : o.drag;
    grav[i] = o.grav === undefined ? -14 : o.grav;
    alpha0[i] = o.alpha === undefined ? 1 : o.alpha;
    stretch[i] = o.stretch || 0;
    turb[i] = o.turb || 0;
    bounce[i] = o.bounce === undefined ? 0.32 : o.bounce;
    return i;
  }

  var _t = 0;

  function update(dt) {
    _t += dt;
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
          r0[i] = r0[last]; g0[i] = g0[last]; b0[i] = b0[last];
          r1[i] = r1[last]; g1[i] = g1[last]; b1[i] = b1[last];
          life[i] = life[last]; maxLife[i] = maxLife[last];
          size[i] = size[last]; size1[i] = size1[last];
          rot[i] = rot[last]; rotv[i] = rotv[last];
          kind[i] = kind[last]; drag[i] = drag[last]; grav[i] = grav[last];
          alpha0[i] = alpha0[last]; stretch[i] = stretch[last];
          turb[i] = turb[last]; bounce[i] = bounce[last];
        }
        continue;
      }
      var d = Math.exp(-drag[i] * dt);
      vx[i] *= d; vz[i] *= d;
      vy[i] = vy[i] * d + grav[i] * dt;
      /* TURBULENCE. Embers and smoke that rise in a dead straight line read as
         a fountain. A cheap curl from two out-of-phase sines gives them the
         wander that hot air actually has, for three trig calls. */
      if (turb[i] > 0) {
        var ph = px[i] * 0.7 + pz[i] * 0.5;
        vx[i] += Math.sin(_t * 2.1 + ph) * turb[i] * dt;
        vz[i] += Math.cos(_t * 1.7 + ph * 1.3) * turb[i] * dt;
      }
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      rot[i] += rotv[i] * dt;
      /* Bounce off the ground, with heavy damping. Particles that sink through
         the floor read as a bug even when nobody could say why. */
      if (py[i] < 0.05 && vy[i] < 0) {
        py[i] = 0.05;
        vy[i] *= -bounce[i];
        vx[i] *= 0.6; vz[i] *= 0.6;
        rotv[i] *= 0.5;
      }
      i++;
    }
  }

  function submit() {
    for (var i = 0; i < count; i++) {
      var t = 1 - life[i] / maxLife[i];
      /* SIZE PUNCHES OUT THEN SETTLES. A particle that starts at its final
         size has no birth; one that eases out of nothing has a pop. */
      var grow = t < 0.12 ? U.ease.outBack(t / 0.12) : 1;
      var s = U.mix(size[i], size1[i], t) * grow;
      /* Alpha holds, then falls. See the header note. */
      var a = alpha0[i] * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
      /* Colour cools over life, front loaded so the hot phase is brief. */
      var ct = Math.pow(t, 0.65);
      R.pushParticle(px[i], py[i], pz[i],
        r0[i] + (r1[i] - r0[i]) * ct,
        g0[i] + (g1[i] - g0[i]) * ct,
        b0[i] + (b1[i] - b0[i]) * ct,
        a, s, rot[i], kind[i], stretch[i],
        vx[i], vy[i], vz[i]);
    }
  }

  /* ---------- emitters ---------- */

  var rnd = U.rng('fx');

  /* A hot version of a colour, for the birth end of a ramp. Pushed toward
     white rather than simply brightened, because a spark at its hottest has
     lost its hue, which is exactly what makes the cooling read. */
  function hot(c, amount) {
    amount = amount === undefined ? 0.55 : amount;
    return [
      c[0] + (1 - c[0]) * amount,
      c[1] + (1 - c[1]) * amount,
      c[2] + (1 - c[2]) * amount
    ];
  }

  /* ADDITIVE BLENDING SUMS, SO ALPHA MUST FALL AS COUNT RISES.
     A twenty-particle burst at alpha 1 puts twenty times the element colour
     through the same pixels, every channel clips, and a coloured explosion
     renders as a white blob with no hue left in it. Scaling alpha by roughly
     the inverse square root of the count keeps the PEAK brightness about
     constant while the burst still gets visibly bigger. */
  function autoAlphaFor(n) { return U.clamp(2.6 / Math.sqrt(Math.max(1, n)), 0.28, 1.0); }

  function burst(pos, color, opts) {
    opts = opts || {};
    var n = opts.count || 14;
    var spd = opts.speed || 9;
    var aa = opts.alpha === undefined ? autoAlphaFor(n) : opts.alpha;
    var h = hot(color, opts.heat === undefined ? 0.5 : opts.heat);
    for (var i = 0; i < n; i++) {
      var th = rnd() * U.TAU;
      var ph = Math.acos(1 - rnd() * (opts.hemi === false ? 2 : 1.15));
      var s = spd * (0.35 + rnd() * 0.9);
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: Math.sin(ph) * Math.cos(th) * s,
        vy: Math.cos(ph) * s * (opts.up === undefined ? 1 : opts.up),
        vz: Math.sin(ph) * Math.sin(th) * s,
        r: h[0], g: h[1], b: h[2],
        r1: color[0] * 0.4, g1: color[1] * 0.25, b1: color[2] * 0.5,
        life: (opts.life || 0.6) * (0.6 + rnd() * 0.8),
        size: (opts.size || 0.32) * (0.6 + rnd() * 0.8),
        size1: (opts.size || 0.32) * 0.1,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 9,
        kind: opts.kind === undefined ? KIND.STREAK : opts.kind,
        stretch: opts.stretch === undefined ? 0.9 : opts.stretch,
        drag: opts.drag === undefined ? 2.2 : opts.drag,
        grav: opts.grav === undefined ? -16 : opts.grav,
        alpha: aa
      });
    }
  }

  /* THE FULL HIT PACKAGE. Five layers on five different curves, which is what
     separates a hit that lands from a hit that merely happens:
       flash    one big short-lived ember at the point of contact
       streaks  a directional spray, stretched along its own velocity
       embers   slower, turbulent, they linger after the spray is gone
       ring     a flat shock annulus on the ground plane
       shards   a few hard chips that bounce
     `dir` is the direction the energy came FROM, so the spray goes back the
     way it arrived, which is what a real impact does and what makes the hit
     read as directional rather than as a decal. */
  function impact(pos, dir, color, scale) {
    scale = scale || 1;
    var h = hot(color, 0.7);
    var back = dir ? V.norm(V.scale(dir, -1)) : [0, 1, 0];

    spawn({
      x: pos[0], y: pos[1], z: pos[2],
      vx: 0, vy: 0, vz: 0,
      r: h[0], g: h[1], b: h[2],
      r1: color[0], g1: color[1], b1: color[2],
      life: 0.13, size: 1.5 * scale, size1: 0.35 * scale,
      rot: rnd() * U.TAU, rotv: 0,
      kind: KIND.EMBER, drag: 0, grav: 0, alpha: 0.9
    });

    var n = Math.round(7 * scale);
    for (var i = 0; i < n; i++) {
      var spread = 0.75;
      var d2 = V.norm([
        back[0] + (rnd() - 0.5) * spread * 2,
        Math.abs(back[1]) * 0.5 + 0.4 + (rnd() - 0.5) * spread,
        back[2] + (rnd() - 0.5) * spread * 2
      ]);
      var sp = (9 + rnd() * 15) * scale;
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: d2[0] * sp, vy: d2[1] * sp, vz: d2[2] * sp,
        r: h[0], g: h[1], b: h[2],
        r1: color[0] * 0.35, g1: color[1] * 0.2, b1: color[2] * 0.45,
        life: 0.20 + rnd() * 0.26,
        size: (0.15 + rnd() * 0.13) * scale, size1: 0.02,
        rot: 0, rotv: 0,
        kind: KIND.STREAK, stretch: 1.5,
        drag: 3.4, grav: -22, alpha: 0.95
      });
    }

    var e = Math.round(3 * scale);
    for (var k = 0; k < e; k++) {
      spawn({
        x: pos[0] + (rnd() - 0.5) * 0.5, y: pos[1] + rnd() * 0.4, z: pos[2] + (rnd() - 0.5) * 0.5,
        vx: (rnd() - 0.5) * 3.2, vy: 1.4 + rnd() * 2.4, vz: (rnd() - 0.5) * 3.2,
        r: h[0], g: h[1], b: h[2],
        r1: color[0] * 0.3, g1: color[1] * 0.15, b1: color[2] * 0.4,
        life: 0.55 + rnd() * 0.6,
        size: (0.13 + rnd() * 0.1) * scale, size1: 0.02,
        rot: 0, rotv: 0,
        kind: KIND.EMBER, drag: 1.5, grav: -3.5, turb: 5.5, alpha: 0.75
      });
    }

    shockRing(pos, color, 2.2 * scale, 0.30);

    if (scale > 0.8) {
      var sh = Math.round(3 * scale);
      for (var q = 0; q < sh; q++) {
        var ang = rnd() * U.TAU;
        spawn({
          x: pos[0], y: pos[1], z: pos[2],
          vx: Math.cos(ang) * (5 + rnd() * 7), vy: 3 + rnd() * 5, vz: Math.sin(ang) * (5 + rnd() * 7),
          r: color[0], g: color[1], b: color[2],
          r1: color[0] * 0.25, g1: color[1] * 0.2, b1: color[2] * 0.3,
          life: 0.6 + rnd() * 0.5,
          size: (0.16 + rnd() * 0.1) * scale, size1: (0.10) * scale,
          rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 18,
          kind: KIND.SHARD, drag: 1.0, grav: -20, bounce: 0.4, alpha: 0.85
        });
      }
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
        r1: color[0] * 0.5, g1: color[1] * 0.5, b1: color[2] * 0.6,
        life: 1.1 + rnd() * 1.0,
        size: (1.1 + rnd() * 0.8) * scale, size1: (2.6 + rnd()) * scale,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 1.2,
        kind: KIND.SMOKE, drag: 1.1, grav: 1.4, turb: 2.2, alpha: 0.42
      });
    }
  }

  /* DUST UNDER A PLANTED FOOT. Small, brief, and it is most of what makes a
     walking creature feel like it has weight against the ground rather than
     sliding over it. Emitted from the gait's own stance transition, so it
     lands exactly when the foot does. */
  function dust(pos, scale, color) {
    var n = 2 + (rnd() * 2 | 0);
    var c = color || [0.55, 0.5, 0.68];
    for (var i = 0; i < n; i++) {
      var ang = rnd() * U.TAU;
      var sp = 0.5 + rnd() * 1.5;
      spawn({
        x: pos[0] + (rnd() - 0.5) * 0.3, y: pos[1] + 0.06, z: pos[2] + (rnd() - 0.5) * 0.3,
        vx: Math.cos(ang) * sp, vy: 0.5 + rnd() * 0.9, vz: Math.sin(ang) * sp,
        r: c[0], g: c[1], b: c[2],
        r1: c[0] * 0.4, g1: c[1] * 0.4, b1: c[2] * 0.5,
        life: 0.34 + rnd() * 0.3,
        size: (0.28 + rnd() * 0.22) * scale, size1: (0.75 + rnd() * 0.4) * scale,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 2,
        kind: KIND.SMOKE, drag: 3.2, grav: 0.6, alpha: 0.30
      });
    }
  }

  function shockRing(pos, color, radius, life) {
    spawn({
      x: pos[0], y: pos[1] + 0.2, z: pos[2],
      vx: 0, vy: 0, vz: 0,
      r: color[0], g: color[1], b: color[2],
      r1: color[0] * 0.4, g1: color[1] * 0.4, b1: color[2] * 0.5,
      life: life || 0.42,
      size: radius * 0.35, size1: radius * 2.1,
      rot: 0, rotv: 0, kind: KIND.RING, drag: 0, grav: 0, alpha: 0.55
    });
  }

  /* MUZZLE FLASH. A bright short ember at the barrel plus a cone of stretched
     sparks along the firing line. The ember is what the eye actually catches
     at 60fps; the sparks are what it reads a frame later. */
  function muzzle(pos, dir, color, scale) {
    scale = scale || 1;
    var h = hot(color, 0.75);
    spawn({
      x: pos[0] + dir[0] * 0.3, y: pos[1] + dir[1] * 0.3, z: pos[2] + dir[2] * 0.3,
      vx: 0, vy: 0, vz: 0,
      r: h[0], g: h[1], b: h[2],
      r1: color[0], g1: color[1], b1: color[2],
      life: 0.075, size: 1.05 * scale, size1: 0.25,
      rot: rnd() * U.TAU, rotv: 0,
      kind: KIND.EMBER, drag: 0, grav: 0, alpha: 1.0
    });
    for (var i = 0; i < 6; i++) {
      var spread = 0.22;
      var sp = 14 + rnd() * 16;
      spawn({
        x: pos[0], y: pos[1], z: pos[2],
        vx: (dir[0] + (rnd() - 0.5) * spread) * sp,
        vy: (dir[1] + (rnd() - 0.5) * spread) * sp,
        vz: (dir[2] + (rnd() - 0.5) * spread) * sp,
        r: h[0], g: h[1], b: h[2],
        r1: color[0] * 0.4, g1: color[1] * 0.25, b1: color[2] * 0.5,
        life: 0.09 + rnd() * 0.09,
        size: (0.13 + rnd() * 0.08) * scale, size1: 0.02,
        rot: 0, rotv: 0,
        kind: KIND.STREAK, stretch: 1.8,
        drag: 6.5, grav: -4, alpha: 0.95
      });
    }
  }

  /* A trail segment for a projectile in flight. Given the projectile's own
     velocity so it stretches correctly along its path. */
  function trail(pos, vel, color, scale) {
    spawn({
      x: pos[0], y: pos[1], z: pos[2],
      vx: vel[0] * 0.12, vy: vel[1] * 0.12, vz: vel[2] * 0.12,
      r: color[0], g: color[1], b: color[2],
      r1: color[0] * 0.3, g1: color[1] * 0.2, b1: color[2] * 0.45,
      life: 0.16 + rnd() * 0.08,
      size: 0.20 * (scale || 1), size1: 0.02,
      rot: 0, rotv: 0,
      kind: KIND.STREAK, stretch: 1.1,
      drag: 5.5, grav: 0, alpha: 0.7
    });
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
        r: f.col[0] * 1.45, g: f.col[1] * 1.45, b: f.col[2] * 1.45,
        r1: f.col[0] * 0.30, g1: f.col[1] * 0.28, b1: f.col[2] * 0.42,
        life: 0.85 + rnd() * 0.9,
        size: (opts.size || 0.4) * (0.65 + rnd() * 0.7),
        size1: (opts.size || 0.4) * 0.5,
        rot: rnd() * U.TAU, rotv: (rnd() - 0.5) * 16,
        kind: KIND.FLAKE, drag: 1.1, grav: -20, bounce: 0.30, alpha: 1
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
      /* Two is the readable maximum in one cluster, and the spacing has to
         exceed the rendered text height at play zoom: at 1.5 world units the
         names still overlapped into a smear. Nudged sideways as well as up so
         a pair reads as two labels rather than as one bold one. */
      if (bump >= 2) return;
      pos = [pos[0] + bump * 1.1, pos[1] + bump * 3.0, pos[2]];
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
  var impactState = { shake: 0, stop: 0, aberr: 0, flash: 0 };

  function hit(strength, opts) {
    opts = opts || {};
    impactState.shake = Math.max(impactState.shake, strength);
    if (opts.stop) impactState.stop = Math.max(impactState.stop, opts.stop);
    if (opts.aberr !== false) impactState.aberr = Math.max(impactState.aberr, strength * 0.010);
    if (opts.flash) impactState.flash = Math.max(impactState.flash, opts.flash);
  }

  function updateImpact(dt) {
    /* Shake decays fast and aberration slower, so a hit reads as a jolt
       followed by a lingering distortion rather than as one blunt pulse. */
    impactState.shake = U.damp(impactState.shake, 0, 7.5, dt);
    impactState.aberr = U.damp(impactState.aberr, 0, 4.2, dt);
    impactState.flash = U.damp(impactState.flash, 0, 9.0, dt);
    if (impactState.shake < 0.001) impactState.shake = 0;
    if (impactState.aberr < 0.0001) impactState.aberr = 0;
    if (impactState.flash < 0.001) impactState.flash = 0;
    R.fx.shake = impactState.shake;
    R.fx.aberration = impactState.aberr;
    R.fx.flashWhite = impactState.flash;
  }

  /* Consume any pending hit-stop, returning the fraction of this frame the
     simulation should actually advance. */
  function consumeStop(dt) {
    if (impactState.stop <= 0) return dt;
    var used = Math.min(impactState.stop, dt);
    impactState.stop -= used;
    return Math.max(0, dt - used);
  }

  function clear() {
    count = 0;
    texts.length = 0;
    impactState.shake = impactState.stop = impactState.aberr = impactState.flash = 0;
  }

  /* ---------- ambient motes ----------
     Suspended dust drifting through the volume the camera looks into.

     WHY A BOARD NEEDS THIS. Everything else in this renderer draws SURFACES.
     Between the camera and the board there was nothing at all, so the air read
     as vacuum and the scene as objects assembled in front of a backdrop rather
     than as a place. A few hundred slow specks fix that for almost nothing,
     because they are the only cue the eye has for depth in the empty half of
     the frame.

     They are a POOL, not a stream. Emitting motes continuously would fight the
     impact particles for the same fixed budget, and a heavy wave would starve
     the atmosphere exactly when the screen is busiest. Instead a fixed number
     is kept alive and each one is recycled in place when it expires, so the
     cost is constant and bounded whatever else is happening. */
  var motes = { on: true, want: 0, bounds: null, tint: [0.82, 0.86, 1.0], t: 0 };

  function moteSetup(board, palette) {
    if (!board) { motes.bounds = null; return; }
    var hw = board.halfW !== undefined ? board.halfW : 30;
    var hh = board.halfH !== undefined ? board.halfH : 30;
    motes.bounds = { hw: hw * 1.15, hh: hh * 1.15, lo: 0.4, hi: 11.0 };
    /* Tinted toward the faction key so the air belongs to the same picture,
       but desaturated hard: dust that reads as coloured reads as confetti. */
    if (palette && palette.key) {
      motes.tint = [
        0.62 + palette.key[0] * 0.30,
        0.62 + palette.key[1] * 0.30,
        0.62 + palette.key[2] * 0.30
      ];
    }
    motes.want = 190;
    motes.t = 0;
  }

  function moteSpawn(seedT) {
    var b = motes.bounds; if (!b) return;
    var a = rnd(), c = rnd(), e = rnd();
    var i = spawn({
      x: (a * 2 - 1) * b.hw,
      y: b.lo + e * (b.hi - b.lo),
      z: (c * 2 - 1) * b.hh,
      vx: (rnd() - 0.5) * 0.55,
      vy: 0.10 + rnd() * 0.28,
      vz: (rnd() - 0.5) * 0.55,
      r: motes.tint[0], g: motes.tint[1], b: motes.tint[2],
      r1: motes.tint[0] * 0.75, g1: motes.tint[1] * 0.75, b1: motes.tint[2] * 0.80,
      /* Long lives and staggered starts, so the field never pulses as a group. */
      life: 7.5 + rnd() * 7.5,
      size: 0.055 + rnd() * 0.075,
      size1: 0.035 + rnd() * 0.05,
      kind: KIND.MOTE,
      alpha: 0.16 + rnd() * 0.20,
      /* No gravity and heavy drag: these are suspended, not falling. */
      grav: 0.0, drag: 0.55, turb: 0.35, bounce: 0
    });
    if (i >= 0 && seedT) life[i] = maxLife[i] * (0.15 + rnd() * 0.85);
  }

  function moteUpdate(dt) {
    if (!motes.on || !motes.bounds || !motes.want) return;
    /* Count what is alive rather than tracking it, because the shared pool can
       recycle a mote's slot for an impact spark at any time and a stale count
       would slowly starve the field. */
    var alive = 0;
    for (var i = 0; i < count; i++) if (kind[i] === KIND.MOTE) alive++;
    var deficit = motes.want - alive;
    if (deficit <= 0) return;
    /* Refill gradually so a frame that clears the pool does not spend its
       entire particle budget on dust. */
    var n = Math.min(deficit, 12);
    for (var k = 0; k < n; k++) moteSpawn(motes.t < 0.5);
    motes.t += dt;
  }

  /* Introspection for the harness. Counting live particles by kind, and
     asserting the mote field stays in its volume, both need the pooled arrays,
     and a test that reaches into module internals is a test that breaks on
     every refactor. These two functions are the supported way to ask. */
  function debugKindCounts() {
    var out = {};
    for (var i = 0; i < count; i++) out[kind[i]] = (out[kind[i]] || 0) + 1;
    return out;
  }
  function moteBoundsOk() {
    var b = motes.bounds; if (!b) return false;
    /* Generous on the upper bound: motes drift upward for their whole life by
       design, so the test is that they are in the volume, not that they never
       rise out of the slab they were seeded in. */
    var hi = b.hi + 12, lim = 1.35;
    for (var i = 0; i < count; i++) {
      if (kind[i] !== KIND.MOTE) continue;
      if (Math.abs(px[i]) > b.hw * lim) return false;
      if (Math.abs(pz[i]) > b.hh * lim) return false;
      if (py[i] < -1 || py[i] > hi) return false;
    }
    return true;
  }

  return {
    KIND: KIND,
    moteSetup: moteSetup, moteUpdate: moteUpdate, motes: motes,
    debugKindCounts: debugKindCounts, moteBoundsOk: moteBoundsOk,
    spawn: spawn, update: update, submit: submit,
    burst: burst, smoke: smoke, shockRing: shockRing, muzzle: muzzle,
    impact: impact, dust: dust, trail: trail, hot: hot,
    shatter: shatter,
    text: text, updateText: updateText, texts: texts,
    hit: hit, updateImpact: updateImpact, consumeStop: consumeStop,
    impact_state: impactState,
    clear: clear,
    get count() { return count; },
    get max() { return MAX; }
  };
})();
