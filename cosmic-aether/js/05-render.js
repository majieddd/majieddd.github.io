/* RELIQUARY :: 05-render
   The frame. Owns every render target, every program, and the order the
   passes run in.

   PASS ORDER, and why each one is where it is:

     1  shadow     depth only, from the sun, into a comparison-sampled texture
     2  sky        full-screen, writes depth 1e5 so the ink pass finds no edge
                   between sky pixels but does find one at every silhouette
     3  opaque     MRT: lit colour + (normal, linear depth)
     4  transparent  same target, attachment 1 masked off so beams and rings
                   contribute no ink and no depth-edge
     5  particles  additive and alpha, depth-tested against the opaque pass
     6  ink        Sobel over attachment 1, darkening attachment 0
     7  bright     threshold at half resolution
     8  blur       separable Gaussian, three descending mip levels
     9  composite  tonemap, grade, halftone, canvas, grain, vignette, to screen

   THE ONE NON-OBVIOUS DECISION is that ink runs BEFORE bloom. Ink after bloom
   would draw hard black lines over the glow and cut every bright edge in half.
   Ink first means the glow blooms out from a surface that already has its
   linework, and the light spills over the ink the way it does in the plates. */
'use strict';

var R = (function () {

  var gl = null;
  var canvas = null;
  var W = 1, H = 1, DPR = 1;

  var prog = {};
  var rt = {};
  var toothTex = null;
  var detailTex = null;
  var fsTri = null;

  /* Draw lists, rebuilt every frame. Plain arrays reused across frames with a
     length reset rather than reallocated: this is the hot path and a fresh
     array per frame per list is a guaranteed GC sawtooth. */
  var opaque = [], transparent = [], particles = [];
  var opaqueN = 0, transparentN = 0, particleN = 0;

  var pal = null;
  /* QUALITY TIERS.
     The renderer cannot measure the machine it will run on, and the adaptive
     scaler can only trade resolution. A tier trades the things resolution
     cannot: how many shadow taps every lit pixel pays for, how large the
     shadow map is, and whether the bloom chain runs at all. Exposed in the HUD
     because a player with a weak GPU should not have to wait for a heuristic
     to notice. */
  var TIERS = {
    high:   { shadowTaps: 16, shadowSize: 4096, bloom: true,  ink: true, maxScale: 1.00, shadows: true,  triplanar: true, msaa: 8, ssao: 1, streak: 1, autoexp: 1 },
    medium: { shadowTaps: 9,  shadowSize: 2048, bloom: true,  ink: true, maxScale: 0.85, shadows: true,  triplanar: false, msaa: 4, ssao: 1, streak: 1, autoexp: 0 },
    low:    { shadowTaps: 4,  shadowSize: 1024, bloom: true, ink: true, maxScale: 0.70, shadows: true,  triplanar: false, msaa: 0, ssao: 0, streak: 0, autoexp: 0 }
  };
  var quality = {
    bloom: true, shadows: true, ink: true,
    shadowSize: 4096, shadowTaps: 16, scale: 1.0, tier: 'high', triplanar: true,
    /* AETHER: the HD render style is the default; Classic is the preserved
       painterly pipeline this work descends from. */
    hd: true, msaa: 8, ssao: 1, streak: 1, autoexp: 1
  };
  /* The style the HD mesh shader shares with the classic one through the
     same programs slot, so switching styles does not rebuild the scene. */
  var style = 'hd';

  function setTier(name) {
    var t = TIERS[name];
    if (!t) return quality.tier;
    quality.tier = name;
    quality.shadowTaps = t.shadowTaps;
    quality.bloom = t.bloom;
    quality.ink = t.ink;
    quality.shadows = t.shadows;
    quality.triplanar = t.triplanar;
    quality.msaa = t.msaa;
    quality.ssao = t.ssao;
    quality.streak = t.streak;
    quality.autoexp = t.autoexp;
    adapt.max = t.maxScale;
    if (quality.scale > t.maxScale) quality.scale = t.maxScale;
    if (quality.shadowSize !== t.shadowSize) {
      quality.shadowSize = t.shadowSize;
      if (rt.shadow) rt.shadow.dispose();
      rt.shadow = GL.shadowTarget(shadowSizeCapped(t.shadowSize));
    }
    if (canvas) resize(adapt.cssW, adapt.cssH, DPR);
    return quality.tier;
  }
  function shadowSizeCapped(want) {
    /* 4096 is meaningless on a driver whose max texture is 2048; the target
       would fail its completeness check and the whole renderer would throw
       at boot. Cap against what the driver actually offers. */
    var cap = GL.caps ? GL.caps.maxTexture : 4096;
    return Math.max(512, Math.min(want, cap));
  }
  function cycleTier() {
    var order = ['high', 'medium', 'low'];
    return setTier(order[(order.indexOf(quality.tier) + 1) % order.length]);
  }
  function setStyle(s) {
    style = (s === 'cel' || s === 'classic') ? 'cel' : 'hd';
    return style;
  }
  function cycleStyle() {
    return setStyle(style === 'hd' ? 'cel' : 'hd');
  }

  /* ---------- ART CONSTANTS ----------
     Every number that decides what the picture LOOKS like, in one block, so
     the art direction can be tuned as a unit instead of by hunting magic
     numbers through three passes.

     These values were not guessed. The first render with plausible-looking
     defaults came out pale lavender and desaturated, which is the exact
     opposite of the reference plates (near-black grounds, extreme chroma).
     Three causes were measured and each has a constant here that fixes it:

       1  AMBIENT WAS DROWNING THE SHADOW MASS at 0.55. The style law asks for
          the drawing to be carried by heavy shadow; ambient that strong means
          there is no shadow to carry it. Now 0.20.
       2  SPECULAR WAS BLANKETING FLAT GROUND at 0.42 with power 34. A large
          plane facing the sun puts every one of its pixels in the lobe at
          once, so the whole board went pale in a single wash. Now 0.14 at
          power 90, which confines the lobe to genuine ridges.
       3  THE LIGHT STOP WAS NEARLY WHITE, so the lit band of every surface
          converged on the same off-white regardless of its albedo, throwing
          away the faction colour that the style law says comes first. The
          lit stop now keeps albedo dominant (mix 0.18, not 0.28). */
  var ART = {
    bands: 4.0,
    rampGamma: 1.28,
    facetJitter: 0.19,
    shadowLift: 0.24,
    ambient: 0.30,
    /* A BROAD LOBE, BECAUSE THE NORMALS ARE FLAT. specPower was 90, and the
       shader thresholds the result at 0.35, which requires dot(N,H) > 0.9884:
       a cone 8.7 degrees wide. Every mesh here is non-indexed with per-face
       normals, so N is constant across a whole facet and there is no gradient
       for a narrow lobe to slide along. The result was all-or-nothing per
       facet and in practice nothing: zeroing the entire specular term changed
       the measured frame by 0.0001 in coefficient of variation, which is to
       say one of the three pillars of the palette-knife look was not running
       at all. A wide lobe is what a faceted surface can actually satisfy, and
       the spatial variety that a narrow lobe would have supplied now comes
       from the impasto ridge mask instead, which is where it belongs.

       BOTH NUMBERS ARE MEASURED, NOT CHOSEN. Widening the lobe to 22 was not
       enough on its own: the ground normal is very close to +Y and the half
       vector sits around dot 0.80, so 0.80^22 = 0.008 still failed the 0.10
       threshold and the term stayed dead. Sweeping power against a fixed crop
       of one deterministic frame, against the v1.2 build in the same session:

         power   hfNorm    cv       meanLum
         v1.2    0.03215   0.2632   125.3     (specular effectively off)
         6       0.02664   0.2318   152.8     floods, brighter but flat
         9       0.02776   0.2519   148.2     same trade
         14      0.03433   0.3774   124.3     <- holds brightness, gains form
         22      0.03622   0.4157   117.0     more contrast, too dark

       Then strength at power 14: 0.30 gave 124.3, 0.38 gave 125.9, 0.46 gave
       127.5. The last one is the only setting that beats v1.2 on all three at
       once: 1.8% brighter, 4.9% more micro-contrast, 41.6% more overall
       contrast. hfNorm and cv are both divided by the frame mean on purpose,
       because an unnormalised contrast figure rises whenever the picture
       merely darkens and will happily sell an exposure change as texture. */
    specStrength: 0.46,
    specPower: 14.0,
    /* Rim at 1.25 with power 2.35 was wide enough to wash the whole grazing
       half of the board into a haze. A rim is meant to separate a silhouette,
       not to light a surface: tighter power, lower strength. */
    rimStrength: 0.85,
    rimPower: 3.4,
    toothScale: 0.42,
    toothStrength: 0.46,
    fogDensity: 0.0040,
    /* Shadow shaping. `band` is the ramp position a shadowed surface collapses
       to, `edge` and `soft` place and widen the cel edge across the PCF
       result, `depth` is how much of the specular and rim survive in shadow. */
    shadowBand: 0.16,
    shadowEdge: 0.30,
    shadowSoft: 0.30,
    shadowDepth: 0.30,
    bloomThreshold: 0.60,
    bloomStrength: 0.95,
    /* Exposure sits under 1.0 because the filmic curve lifts midtones by
       roughly 1.6x on its own, which fights a deliberately dark palette. */
    exposure: 0.94,
    /* SATURATE THE SOURCE, NOT THE OUTPUT.
       This sat at 1.46 with contrast 1.22 and the measured result was that the
       ground rendered [16,6,52] before post and [3,0,60] after: post drove the
       red and green channels to literal zero. That is not "more saturated",
       it is CLIPPED, and clipping is fatal here specifically because the
       painterly look depends on neighbouring facets differing by a few points
       of hue. Once two adjacent strokes both clamp to pure blue they are the
       same colour and the patchwork disappears.
       The faction hexes are already vivid at source (ART-BIBLE section 2), so
       the grade only needs to lean, not shove. Contrast likewise: the heavy
       shadow mass comes from the RAMP, which can make a considered decision
       per facet, not from a curve that cannot tell a shadow from a dark
       albedo. */
    saturation: 1.24,
    contrast: 1.10,
    vignette: 0.54,
    grain: 0.042,
    halftone: 0.62,
    canvas: 0.20,
    /* How far, in world units, a particle fades as it approaches whatever is
       behind it. Too small and the hard intersection line survives; too large
       and smoke dissolves before it reaches the ground it is supposed to be
       rolling along. */
    /* Frustum culling on or off. A switch, not a tuning knob: it exists so a
       harness can render the same frame both ways and prove the optimisation
       changes the draw count and not the picture. An optimisation that alters
       what is on screen is not an optimisation. */
    cull: 1,
    particleSoftness: 1.35,
    inkStrength: 0.95,
    inkNormalThreshold: 0.55,
    inkDepthThreshold: 0.85,
    debugMode: 0
  };

  /* Per-frame uniform state the caller sets before render(). */
  var cam = {
    pos: [0, 22, 26], target: [0, 0, 0], up: [0, 1, 0],
    fov: 0.72, near: 0.5, far: 260
  };
  var sun = { dir: [0.42, 0.80, 0.44], distance: 90, extent: 46, centre: [0, 0, 0] };
  var fx = {
    shake: 0, aberration: 0, flashWhite: 0, desaturate: 0,
    exposure: 1.0, timeScale: 1
  };

  /* Per-frame counters. "It feels slow" is not actionable; a draw-call count
     and a per-pass millisecond split is. */
  var prof = { draws: 0, shadowDraws: 0, culled: 0, culledShadow: 0, tris: 0, ms: {}, on: false };
  /* PROFILING FORCES A SYNC, and it has to. GL calls only queue work, so
     timing a pass by wall clock around its submission measures how long the
     driver took to accept commands and nothing about how long they take to
     run. The numbers that produced were not merely imprecise, they were
     incoherent: one build reported the opaque pass rising from 35.1ms to
     218.2ms while the total frame time it is part of moved 14.57 to 15.32.
     gl.finish() drains the queue so each figure covers real work. It is a
     heavy hammer and it is only ever swung when profiling is explicitly
     switched on, which nothing in the game does. */
  function markStart(k) { if (prof.on) { gl.finish(); prof.ms['_' + k] = U.nowMs(); } }
  function markEnd(k) { if (prof.on) { gl.finish(); prof.ms[k] = U.nowMs() - prof.ms['_' + k]; } }

  /* ---------- frustum culling ----------
     Every mesh pushed used to be drawn, visible or not. On a board whose half
     extents are 47.8 by 35.0 with a camera that zooms right in, that means
     paying full vertex and shadow cost for geometry nowhere near the screen.

     Gribb and Hartmann plane extraction: the six clip planes fall straight out
     of the rows of the view-projection matrix, so there is nothing to maintain
     and nothing that can drift out of sync with the camera. Each item is then
     one dot product per plane against its bounding sphere.

     CONSERVATIVE ON PURPOSE. A sphere around an axis-aligned box around the
     mesh is loose, and a uniform-scale radius is looser still. Culling too
     little costs a draw call; culling too much drops geometry the player can
     see, and that is not a performance bug, it is a rendering bug. When the
     two are in tension this errs toward drawing. */
  var frustum = new Float32Array(24);
  var lightFrustum = new Float32Array(24);

  function extractFrustum(m, out) {
    /* Column-major m, rows of the matrix are m[i], m[i+4], m[i+8], m[i+12]. */
    var i, sign, o;
    for (i = 0; i < 6; i++) {
      var row = i >> 1;              /* 0 = x, 1 = y, 2 = z */
      sign = (i & 1) ? -1 : 1;       /* left/right, bottom/top, near/far */
      o = i * 4;
      out[o]     = m[3]  + sign * m[row];
      out[o + 1] = m[7]  + sign * m[row + 4];
      out[o + 2] = m[11] + sign * m[row + 8];
      out[o + 3] = m[15] + sign * m[row + 12];
      var len = Math.sqrt(out[o] * out[o] + out[o + 1] * out[o + 1] + out[o + 2] * out[o + 2]);
      if (len > 1e-8) { out[o] /= len; out[o + 1] /= len; out[o + 2] /= len; out[o + 3] /= len; }
    }
  }

  /* World-space centre and radius of an item's mesh, under its model matrix.
     Radius is scaled by the LARGEST axis scale, which is the only choice that
     stays conservative under a non-uniform scale. */
  function itemSphere(it, out) {
    var m = it.model, ms = it.mesh;
    if (!ms || !(ms.radius > 0)) return false;
    var cx = ms.bcx, cy = ms.bcy, cz = ms.bcz;
    out[0] = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
    out[1] = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
    out[2] = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
    var s0 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
    var s1 = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
    var s2 = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
    var sc = Math.sqrt(Math.max(s0, Math.max(s1, s2)));
    /* The explode effect pushes facets outward along their normals, so a mesh
       mid-shatter occupies far more space than its build-time bounds. */
    out[3] = ms.radius * sc + (it.explode || 0) * 2.0 + 0.05;
    return true;
  }

  var tmpSphere = new Float32Array(4);

  function sphereInFrustum(planes, sx, sy, sz, r) {
    for (var i = 0; i < 6; i++) {
      var o = i * 4;
      if (planes[o] * sx + planes[o + 1] * sy + planes[o + 2] * sz + planes[o + 3] < -r) return false;
    }
    return true;
  }

  var WHITE3 = [1, 1, 1];
  var view = U.m4ident(), proj = U.m4ident(), viewProj = U.m4ident();
  var invViewProj = U.m4ident(), lightVP = U.m4ident();
  var tmpM = U.m4ident(), tmpN = new Float32Array(9);
  var time = 0;

  /* Instanced particle buffer. Sized once for the worst case rather than
     grown, because a resize mid-combat is a frame hitch exactly when the
     player is most likely to notice. */
  /* 14 floats per instance: pos3, rgba4, params4 (size, rot, kind, stretch),
     vel3. Velocity is uploaded so the VERTEX SHADER can stretch the quad along
     the particle's own motion; doing that on the CPU would need the camera
     basis here and a per-particle atan, and would still be wrong the moment
     the camera moved between the update and the draw. */
  var PART_STRIDE = 14;
  var MAX_PARTICLES = 6000;
  var partData = new Float32Array(MAX_PARTICLES * PART_STRIDE);
  var partVBO = null, partVAO = null;

  var errors = [];
  function recordError(where, e) {
    errors.push({ where: where, msg: String(e && e.message || e) });
    /* Loud in the console AND retained for the harness. The project law is
       that an error buffer with no named reader is a place errors go to be
       ignored, so tools/verify.steps.cjs asserts this array is empty. */
    if (typeof console !== 'undefined') console.error('[R:' + where + ']', e);
  }

  function init(cv, opts) {
    canvas = cv;
    gl = GL.init(cv, opts || {});
    fsTri = GL.fullscreenTri();

    prog.mesh = GL.program(SH.MESH_VS, SH.MESH_FS, 'mesh');
    prog.shadow = GL.program(SH.SHADOW_VS, SH.SHADOW_FS, 'shadow');
    prog.sky = GL.program(SH.SKY_VS, SH.SKY_FS, 'sky');
    prog.ink = GL.program(SH.POST_VS, SH.INK_FS, 'ink');
    prog.bright = GL.program(SH.POST_VS, SH.BRIGHT_FS, 'bright');
    prog.blur = GL.program(SH.POST_VS, SH.BLUR_FS, 'blur');
    prog.composite = GL.program(SH.POST_VS, SH.COMPOSITE_FS, 'composite');
    prog.particle = GL.program(SH.PARTICLE_VS, SH.PARTICLE_FS, 'particle');
    prog.unlit = GL.program(SH.UNLIT_VS, SH.UNLIT_FS, 'unlit');
    /* AETHER HD programs: the physically grounded set. Built at the same
       time as the cel set so switching styles never triggers a compile. */
    prog.meshHD = GL.program(SH.MESH_VS, SH.MESH_HD_FS, 'mesh-hd');
    prog.skyHD = GL.program(SH.SKY_VS, SH.SKY_HD_FS, 'sky-hd');
    prog.ao = GL.program(SH.POST_VS, SH.AO_FS, 'ao');
    prog.lum = GL.program(SH.POST_VS, SH.LUM_FS, 'lum');
    prog.streak = GL.program(SH.POST_VS, SH.STREAK_FS, 'streak');
    prog.compositeHD = GL.program(SH.POST_VS, SH.COMPOSITE_HD_FS, 'composite-hd');
    /* Exposed for the uniform read-back probe in tools/_iso.html. Reading the
       values back out of the linked program is the only way to prove the CPU
       side and the GPU side agree about what the art constants are. */
    if (typeof window !== 'undefined') window.__MESHPROG = prog.mesh.handle;

    toothTex = GL.texFromCanvas(PAINT.buildAtlas(512));
    detailTex = GL.texFromCanvas(PAINT.buildDetailAtlas(1024));

    /* A software rasteriser renders correctly but slowly. Dropping the shadow
       map and the render scale keeps the headless verifier usable without
       changing what the image is MADE of, so a screenshot taken there still
       proves the art direction. Bloom and ink stay on for exactly that
       reason: they are the look, not a garnish. */
    /* A software rasteriser renders correctly and slowly. Starting it on the
       medium tier keeps the headless verifier usable without changing what the
       image is MADE of, so a screenshot taken there still proves the art. */
    if (GL.caps.software) {
      setTier('medium');
      quality.scale = 0.75;
    }

    partVAO = gl.createVertexArray();
    gl.bindVertexArray(partVAO);
    partVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferData(gl.ARRAY_BUFFER, partData.byteLength, gl.DYNAMIC_DRAW);
    var stride = PART_STRIDE * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 3 * 4);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 7 * 4);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 11 * 4);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);

    rt.shadow = GL.shadowTarget(shadowSizeCapped(quality.shadowSize));
    setPalette('human');
    return gl;
  }

  function setPalette(factionId) {
    pal = PAINT.FACTIONS[factionId] || PAINT.FACTIONS.human;
    return pal;
  }
  function palette() { return pal; }

  /* ADAPTIVE RESOLUTION.
     The post chain (ink, bright, six blur draws, composite) is fill-rate bound,
     so its cost scales with the square of the render scale. On a 4K or a
     Retina panel a devicePixelRatio of 2 asks for FOUR times the pixels of the
     logical size, and the player experiences that as a game that is simply
     slow, with no way to tell why. Rather than pick a number for one machine,
     the renderer measures its own frame time and walks the scale toward
     whatever holds the target, between a floor that still looks right and a
     ceiling that never wastes work. */
  var adapt = {
    on: true, target: 1000 / 60, avg: 16.7, cooldown: 0,
    min: 0.62, max: 1.0, cssW: 1, cssH: 1
  };

  function tickAdaptive(frameMs) {
    if (!adapt.on || !canvas) return;
    /* An exponential average, so one hitched frame does not drop the scale and
       one fast frame does not raise it. */
    adapt.avg = adapt.avg * 0.88 + frameMs * 0.12;
    adapt.cooldown -= 1;
    if (adapt.cooldown > 0) return;
    var s = quality.scale;
    if (adapt.avg > adapt.target * 1.25 && s > adapt.min) {
      quality.scale = Math.max(adapt.min, s - 0.08);
      adapt.cooldown = 45;
      resize(adapt.cssW, adapt.cssH, DPR);
    } else if (adapt.avg < adapt.target * 0.72 && s < adapt.max) {
      quality.scale = Math.min(adapt.max, s + 0.05);
      adapt.cooldown = 90;
      resize(adapt.cssW, adapt.cssH, DPR);
    }
  }

  function resize(w, h, dpr) {
    DPR = dpr || DPR || 1;
    adapt.cssW = w; adapt.cssH = h;
    W = Math.max(2, Math.round(w * DPR * quality.scale));
    H = Math.max(2, Math.round(h * DPR * quality.scale));
    canvas.width = Math.max(2, Math.round(w * DPR));
    canvas.height = Math.max(2, Math.round(h * DPR));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    if (rt.main) rt.main.dispose();
    if (rt.mainMS) rt.mainMS.dispose();
    if (rt.ink) rt.ink.dispose();
    if (rt.bright) rt.bright.dispose();
    if (rt.blurA) rt.blurA.dispose();
    if (rt.blurB) rt.blurB.dispose();
    if (rt.ao) rt.ao.dispose();
    if (rt.streak) rt.streak.dispose();
    if (rt.lumA) rt.lumA.dispose();
    if (rt.lumB) rt.lumB.dispose();

    /* Two colour attachments: lit colour, and packed normal plus linear depth.
       A depth RENDERBUFFER rather than a depth texture, because nothing reads
       depth as a texture: the ink pass gets its depth from attachment 1 where
       it is already linear and does not need reconstructing from a projection
       matrix every pixel. */
    rt.main = GL.target(W, H, {
      color: [{}, {}],
      depth: true
    });
    /* MSAA staging target for the HD style: the scene renders into
       multisampled renderbuffers and is resolved into rt.main's textures
       before any post pass reads them. */
    var ms = quality.msaa;
    if (ms >= 2 && GL.caps.maxSamples >= 2 && !GL.caps.software) {
      rt.mainMS = GL.targetMSAA(W, H, ms, { color: [{}, {}], depth: true });
    } else {
      rt.mainMS = null;
    }
    rt.ink = GL.target(W, H, { color: [{}], depth: false });
    var bw = Math.max(2, W >> 1), bh = Math.max(2, H >> 1);
    rt.bright = GL.target(bw, bh, { color: [{}], depth: false });
    rt.blurA = GL.target(bw, bh, { color: [{}], depth: false });
    rt.blurB = GL.target(bw, bh, { color: [{}], depth: false });
    rt.ao = GL.target(bw, bh, { color: [{}], depth: false });
    rt.streak = GL.target(bw, bh, { color: [{}], depth: false });
    var lw = 8, lh = 8;
    rt.lumA = GL.target(lw, lh, { color: [{ internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }], depth: false });
    rt.lumB = GL.target(lw, lh, { color: [{ internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }], depth: false });
  }

  /* ---------- draw list ---------- */

  function reset() { opaqueN = 0; transparentN = 0; particleN = 0; }

  function push(mesh, model, o) {
    if (!mesh) return;
    var it = opaque[opaqueN];
    if (!it) { it = opaque[opaqueN] = {}; }
    it.mesh = mesh; it.model = model;
    it.tint = (o && o.tint) || null;
    it.tintMix = (o && o.tintMix) || 0;
    it.flash = (o && o.flash) || 0;
    it.flashColor = (o && o.flashColor) || null;
    it.dissolve = (o && o.dissolve) || 0;
    it.explode = (o && o.explode) || 0;
    it.alpha = (o && o.alpha !== undefined) ? o.alpha : 1;
    it.castShadow = !(o && o.castShadow === false);
    /* Per-draw facet jitter, because the ground and the models want very
       different amounts of it and a single global value cannot serve both.
       With 4 bands the step is 0.333, so a jitter under about 0.17 can never
       move a facet off its neighbour's band and the surface stays uniform no
       matter how the palette is tuned. Large flat expanses (the board) need to
       clear that threshold to break into patches; a tower at 40 triangles
       needs to stay well under it or it reads as static rather than as paint. */
    it.facetJitter = (o && o.facetJitter !== undefined) ? o.facetJitter : -1;
    /* PER-DRAW RIM STRENGTH.
       Rim light is scene light, so its COLOUR is the defender's key on every
       surface: the style law forbids two faction colours sharing a frame. Its
       STRENGTH is a different question. A denizen is small, dark and mostly
       seen at a grazing angle, so a rim tuned for a tower floods the whole
       body and turns a black hull into a glowing one. Measured on a Federation
       board: a column of stockmen rendered solid gold and read as friendly.
       Denizens therefore take a fraction of the rim, which keeps them dark
       silhouettes whose only chroma is their own emissive core. */
    it.rimScale = (o && o.rimScale !== undefined) ? o.rimScale : 1;
    it.mat = (o && o.mat) || (mesh && mesh.mat) || null;
    it.detailScale = (o && o.detailScale) || null;
    opaqueN++;
  }

  function pushUnlit(mesh, model, o) {
    if (!mesh) return;
    var it = transparent[transparentN];
    if (!it) { it = transparent[transparentN] = {}; }
    it.mesh = mesh; it.model = model;
    it.tint = (o && o.tint) || [1, 1, 1];
    it.alpha = (o && o.alpha !== undefined) ? o.alpha : 1;
    it.additive = !(o && o.additive === false);
    it.fresnel = (o && o.fresnel) || 0;
    it.pulse = (o && o.pulse) || 0;
    it.depthTest = !(o && o.depthTest === false);
    transparentN++;
  }

  /* Particles are pushed as flat numbers rather than objects: this is called
     up to a few thousand times a frame and an object per particle per frame is
     the difference between a smooth frame and a visible GC pause. */
  function pushParticle(x, y, z, r, g, b, a, size, rot, kind, stretch, vx, vy, vz) {
    if (particleN >= MAX_PARTICLES) return;
    var o = particleN * PART_STRIDE;
    partData[o] = x; partData[o + 1] = y; partData[o + 2] = z;
    partData[o + 3] = r; partData[o + 4] = g; partData[o + 5] = b; partData[o + 6] = a;
    partData[o + 7] = size; partData[o + 8] = rot; partData[o + 9] = kind;
    partData[o + 10] = stretch || 0;
    partData[o + 11] = vx || 0; partData[o + 12] = vy || 0; partData[o + 13] = vz || 0;
    particleN++;
  }

  /* ---------- matrices ---------- */

  function buildMatrices(dt) {
    var aspect = W / Math.max(1, H);
    U.m4persp(cam.fov, aspect, cam.near, cam.far, proj);

    var eye = cam.pos;
    if (fx.shake > 0.0001) {
      /* Shake the EYE and the TARGET by different amounts so the camera
         rotates slightly as well as translating. Translating alone reads as
         the whole world sliding, which is much less like an impact. */
      var t = time * 47.0;
      var s = fx.shake;
      eye = [
        cam.pos[0] + Math.sin(t * 1.7) * s * 0.55,
        cam.pos[1] + Math.sin(t * 2.3 + 1.1) * s * 0.42,
        cam.pos[2] + Math.cos(t * 1.9 + 2.4) * s * 0.55
      ];
      U.m4look(eye, [
        cam.target[0] + Math.sin(t * 2.9) * s * 0.18,
        cam.target[1] + Math.cos(t * 3.3) * s * 0.14,
        cam.target[2] + Math.cos(t * 2.5) * s * 0.18
      ], cam.up, view);
    } else {
      U.m4look(eye, cam.target, cam.up, view);
    }
    cam.eyeActual = eye;
    U.m4mul(proj, view, viewProj);
    U.m4invert(viewProj, invViewProj);

    /* The sun's ortho box is fitted around the camera target rather than the
       whole board. A box big enough for a 120 unit board at 2048 gives 6cm
       texels and the contact shadows turn to mush; centring on what the player
       is looking at keeps them tight where it matters. */
    var L = U.V.norm(sun.dir);
    /* The board is built around the origin, so the light box is too. Centring
       it on cam.target made every shadow edge crawl as the camera moved. */
    var centre = sun.centre || [0, 0, 0];
    var lightPos = U.V.add(centre, U.V.scale(L, sun.distance));
    var lv = U.m4look(lightPos, centre, [0, 1, 0]);
    var e = sun.extent;
    var lp = U.m4ortho(-e, e, -e, e, 1, sun.distance * 2.2);
    U.m4mul(lp, lv, lightVP);
  }

  /* ---------- passes ---------- */

  function shadowPass() {
    if (!quality.shadows) return;
    rt.shadow.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    /* FRONT face culling in the shadow pass. Rendering back faces pushes the
       depth to the far side of the object, which removes surface acne without
       any bias at all on closed meshes. Every mesh this project builds is
       closed, so this is free quality. */
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);

    var p = prog.shadow.use();
    p.um4('uLightVP', lightVP);
    extractFrustum(lightVP, lightFrustum);
    for (var i = 0; i < opaqueN; i++) {
      var it = opaque[i];
      if (!it.castShadow) continue;
      /* Against the LIGHT's frustum, not the camera's: an object off screen can
         still cast a shadow onto something on screen, so reusing the camera
         planes here would delete exactly the shadows that matter at the edge
         of the view. */
      if (ART.cull && itemSphere(it, tmpSphere) &&
          !sphereInFrustum(lightFrustum, tmpSphere[0], tmpSphere[1], tmpSphere[2], tmpSphere[3])) {
        prof.culledShadow++;
        continue;
      }
      p.um4('uModel', it.model);
      p.u1f('uExplode', it.explode);
      it.mesh.draw();
      prof.shadowDraws++;
    }
    gl.cullFace(gl.BACK);
  }

  function skyPass() {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    if (style === 'hd' && prog.skyHD) {
      var ph = prog.skyHD.use();
      ph.u2f('uRes', W, H);
      ph.u1f('uTime', time);
      ph.u3v('uSkyTop', pal.skyTop);
      ph.u3v('uSkyBottom', pal.skyBottom);
      ph.u3v('uNebulaA', pal.nebulaA);
      ph.u3v('uNebulaB', pal.nebulaB);
      ph.u1f('uStarDensity', 0.095);
      ph.um4('uInvViewProj', invViewProj);
      ph.u3v('uCamPos', cam.eyeActual || cam.pos);
      var Ln = U.V.norm(sun.dir);
      ph.u3v('uSunDir', Ln);
      ph.u3v('uLightSky', pal.light);
      fsTri.draw();
      return;
    }
    var p = prog.sky.use();
    p.u2f('uRes', W, H);
    p.u1f('uTime', time);
    p.u3v('uSkyTop', pal.skyTop);
    p.u3v('uSkyBottom', pal.skyBottom);
    p.u3v('uNebulaA', pal.nebulaA);
    p.u3v('uNebulaB', pal.nebulaB);
    p.u1f('uStarDensity', 0.055);
    p.um4('uInvViewProj', invViewProj);
    p.u3v('uCamPos', cam.eyeActual || cam.pos);
    fsTri.draw();
  }

  function opaquePass() {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    var hd = (style === 'hd' && prog.meshHD);
    var p = (hd ? prog.meshHD : prog.mesh).use();
    p.um4('uProj', proj);
    p.um4('uView', view);
    p.um4('uLightVP', lightVP);
    p.u3v('uLightDir', U.V.norm(sun.dir));
    p.u3v('uCamPos', cam.eyeActual || cam.pos);
    p.u3v('uRimColor', pal.rim);
    p.u1f('uRimStrength', hd ? ART.rimStrength * 0.8 : ART.rimStrength);
    p.u1f('uRimPower', ART.rimPower);
    p.u3v('uAmbientSky', pal.ambientSky);
    p.u3v('uAmbientGround', pal.ambientGround);
    p.u1f('uAmbient', hd ? ART.ambient * 1.26 : ART.ambient);
    p.u1f('uSpecStrength', ART.specStrength);
    p.u1f('uSpecPower', ART.specPower);
    p.u1f('uBands', ART.bands);
    p.u1f('uRampGamma', ART.rampGamma);
    p.u1f('uFacetJitter', ART.facetJitter);
    p.u3v('uShadowColor', pal.shadow);
    p.u3v('uLightColor', pal.light);
    p.u1f('uShadowLift', hd ? 0.20 : ART.shadowLift);
    p.u1f('uShadowStrength', quality.shadows ? 1.0 : 0.0);
    p.u1f('uShadowTexel', 1.0 / rt.shadow.size);
    p.u1f('uShadowBand', ART.shadowBand);
    p.u1f('uShadowEdge', ART.shadowEdge);
    p.u1f('uShadowSoft', ART.shadowSoft);
    p.u1f('uShadowDepth', ART.shadowDepth);
    p.u1f('uShadowTaps', quality.shadowTaps);
    p.u1f('uToothScale', ART.toothScale);
    p.u1f('uToothStrength', ART.toothStrength);
    p.u1f('uToothTriplanar', quality.triplanar ? 1 : 0);
    p.u1f('uTime', time);
    p.u1f('uFogDensity', hd ? ART.fogDensity * 0.72 : ART.fogDensity);
    p.u3v('uFogColor', hd ? [pal.fog[0] * 0.85, pal.fog[1] * 0.85, pal.fog[2] * 0.85] : pal.fog);
    p.u3v('uDissolveColor', pal.rim);
    p.tex('uShadow', 0, rt.shadow.tex);
    p.tex('uTooth', 1, toothTex);
    if (hd) {
      /* AETHER CLEAN R3 (merged 4-expert review): 9 soft bands keep a visible
         value step between facets without a patchwork; ambient held just above
         the cel value so the shadow mass survives; spec and detail stay calm. */
      p.u1f('uHdSoft', 0.32);
      /* bands, rampGamma, facetJitter, hemi-lift */
      p.u4f('uHdBandsA', 9.0, 1.05, 0.015, 0.10);
      /* diffuse boost, light sat, shadow-to-lit sat, wrap */
      p.u4f('uHdBandsB', 0.80, 0.75, 0.52, 0.10);
      /* spec intensity, falloff, shade lift, dither */
      p.u4f('uHdSpec', 0.16, 0.0, 0.0, 0.0);
      p.u1f('uExposure', fx.exposure * ART.exposure);
      p.u1f('uDetailTriplanar', quality.triplanar ? 1 : 0);
      p.tex('uDetail', 2, detailTex);
    }

    for (var i = 0; i < opaqueN; i++) {
      var it = opaque[i];
      if (ART.cull && itemSphere(it, tmpSphere) &&
          !sphereInFrustum(frustum, tmpSphere[0], tmpSphere[1], tmpSphere[2], tmpSphere[3])) {
        prof.culled++;
        continue;
      }
      p.um4('uModel', it.model);
      U.m3normalFromM4(it.model, tmpN);
      p.um3('uNormalMat', tmpN);
      /* Eight separate uniform1f calls per draw became two vec4s. At several
         hundred draws a frame the saving is in the JS to GL boundary crossings,
         which is where a WebGL renderer actually spends its CPU. */
      p.u3v('uTint', it.tint || WHITE3);
      p.u3v('uFlashColor', it.flashColor || WHITE3);
      p.u4f('uItemA', it.flash, it.dissolve, it.explode, it.alpha);
      p.u4f('uItemB', it.tintMix,
        it.facetJitter >= 0 ? it.facetJitter : ART.facetJitter,
        it.rimScale, ART.debugMode || 0);
      if (hd) {
        var mat = it.mat ? (PAINT.MATERIALS[it.mat] || null) : null;
        if (!mat) mat = PAINT.MATERIALS.stone;
        p.u4f('uMatRect', mat.rect[0], mat.rect[1], mat.rect[2], mat.rect[3]);
        p.u4f('uMatData', mat.rough, mat.metal, mat.sss, mat.det);
        /* Per-object texture scale: terrain tiles small, units wear the
           atlas fine. A single global scale turns a unit into one magnified
           cell, which is exactly the wrinkled rock the reviews flagged. */
        p.u1f('uDetailScale', it.detailScale || 0.14);
        /* Object anchor: the model's world origin, so moving geometry wears
           its texture instead of the texture staying glued to the world. */
        p.u3f('uDetailAnchor', it.model[12], it.model[13], it.model[14]);
      }
      it.mesh.draw();
      prof.draws++;
    }
  }

  function transparentPass() {
    if (!transparentN) return;
    /* Attachment 1 is masked OFF for this pass. Without it, a blended draw
       would blend into the normal/depth buffer as well, and the ink pass would
       then find garbage edges wherever a beam crossed the screen. Masking is
       cheaper and more honest than trying to make the unlit shader write a
       value that survives blending. */
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    var p = prog.unlit.use();
    p.um4('uProj', proj);
    p.um4('uView', view);
    p.u1f('uTime', time);
    p.u3v('uCamPos', cam.eyeActual || cam.pos);

    for (var i = 0; i < transparentN; i++) {
      var it = transparent[i];
      if (it.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (it.depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      p.um4('uModel', it.model);
      p.u3v('uTint', it.tint);
      p.u1f('uAlpha', it.alpha);
      p.u1f('uFresnel', it.fresnel);
      p.u1f('uPulse', it.pulse);
      it.mesh.draw();
    }
    gl.enable(gl.CULL_FACE);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }

  function particlePass() {
    if (!particleN) return;
    /* DETACH attachment 1 before sampling it. It holds the scene depth the
       soft-particle fade needs, and a texture that is simultaneously attached
       to the draw framebuffer and bound to a sampler is a feedback loop, which
       WebGL leaves undefined even when that attachment is masked off by
       drawBuffers. Detaching is two calls a frame and is the only way to read
       it that is actually legal. */
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.CULL_FACE);

    gl.bindVertexArray(partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, partData, 0, particleN * PART_STRIDE);

    var p = prog.particle.use();
    p.um4('uProj', proj);
    p.um4('uView', view);
    /* Billboard basis pulled out of the view matrix so every quad faces the
       camera without a per-particle lookAt. */
    p.u3f('uRight', view[0], view[4], view[8]);
    p.u3f('uUp', view[1], view[5], view[9]);
    p.tex('uSceneDepth', 0, rt.main.textures[1]);
    p.u2f('uRes', W, H);
    p.u1f('uSoftness', ART.particleSoftness);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particleN);

    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D,
                            rt.main.textures[1], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }

  function inkPass() {
    rt.ink.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    var p = prog.ink.use();
    p.tex('uColor', 0, rt.main.textures[0]);
    p.tex('uNormalDepth', 1, rt.main.textures[1]);
    p.u2f('uTexel', 1 / W, 1 / H);
    p.u1f('uDepthThreshold', quality.ink ? ART.inkDepthThreshold : 1e9);
    p.u1f('uNormalThreshold', ART.inkNormalThreshold);
    p.u3v('uInkColor', pal.ink);
    p.u1f('uInkStrength', quality.ink ? ART.inkStrength : 0.0);
    p.u1f('uThickness', Math.max(1.0, H / 720));
    fsTri.draw();
  }

  function bloomPass(src) {
    if (!quality.bloom) return;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    rt.bright.bind();
    var b = prog.bright.use();
    b.tex('uColor', 0, (src || rt.ink).textures[0]);
    /* HD holds the bright threshold above the emissive core value so the
       cores keep their colour instead of clipping to white; cel keeps the
       art value. */
    b.u1f('uThreshold', style === 'hd' ? 0.78 : ART.bloomThreshold);
    b.u1f('uSoftKnee', 0.6);
    fsTri.draw();

    /* Three widening passes ping-ponging between two half-res targets. Each
       pass doubles the tap spacing, so the effective kernel grows to about 40
       pixels for the cost of six 5-tap draws. */
    var p = prog.blur.use();
    var srcBuf = rt.bright;
    for (var i = 0; i < 3; i++) {
      var spread = 1 + i * 1.9;
      rt.blurA.bind();
      p.tex('uColor', 0, srcBuf.textures[0]);
      p.u2f('uDir', spread / rt.blurA.w, 0);
      fsTri.draw();

      rt.blurB.bind();
      p.tex('uColor', 0, rt.blurA.textures[0]);
      p.u2f('uDir', 0, spread / rt.blurB.h);
      fsTri.draw();

      srcBuf = rt.blurB;
    }
  }

  /* SSAO-lite: half-res, 8 taps over the packed normal+depth. */
  function aoPass() {
    if (!quality.ssao || !rt.main) return;
    rt.ao.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    var p = prog.ao.use();
    p.tex('uNormalDepth', 0, rt.main.textures[1]);
    p.u2f('uTexel', 1 / rt.ao.w, 1 / rt.ao.h);
    p.u2f('uRes', W, H);
    p.u1f('uAOStrength', 1.0);
    p.u1f('uAORadius', 0.5);
    fsTri.draw();
  }

  /* Anamorphic streak over the bloom image. */
  function streakPass() {
    if (!quality.streak) return;
    rt.streak.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    var p = prog.streak.use();
    p.tex('uColor', 0, rt.blurB.textures[0]);
    p.u2f('uDir', 1 / rt.streak.w, 0);
    p.u1f('uWidth', 2.6 / rt.streak.w);
    fsTri.draw();
  }

  /* Log-average luminance with history blend; writes rt.lumNew, prints which
     target holds the current frame for the composite. */
  var lumToggle = true;
  function lumPass() {
    if (!quality.autoexp || !rt.lumA) return;
    var src = lumToggle ? rt.lumB : rt.lumA;
    var dst = lumToggle ? rt.lumA : rt.lumB;
    dst.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    var p = prog.lum.use();
    p.tex('uColor', 0, rt.main.textures[0]);
    p.tex('uLumPrev', 1, src.textures[0]);
    p.u1f('uLumAdapt', 0.06);
    fsTri.draw();
    lumToggle = !lumToggle;
    lumCur = dst;
  }
  var lumCur = null;

  function compositePass() {
    GL.bindScreen(canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (style === 'hd' && prog.compositeHD) {
      /* HD: the no-ink picture, with bloom, streak, SSAO and auto-exposure.
         MSAA only changes where the scene was rendered, not what the post
         passes read, so this branch holds with and without it. */
      var ph = prog.compositeHD.use();
      ph.tex('uColor', 0, rt.main.textures[0]);
      ph.tex('uBloom', 1, quality.bloom ? rt.blurB.textures[0] : rt.bright.textures[0]);
      ph.tex('uStreak', 2, rt.streak.textures[0]);
      ph.tex('uAO', 3, rt.ao.textures[0]);
      ph.tex('uLum', 4, (lumCur || rt.lumA).textures[0]);
      ph.tex('uSceneDepth', 5, rt.main.textures[1]);
      ph.tex('uTooth', 6, toothTex);
      ph.u2f('uRes', W, H);
      ph.u1f('uTime', time);
      ph.u1f('uBloomStrength', quality.bloom ? ART.bloomStrength * 0.52 : 0.0);
      ph.u1f('uExposure', fx.exposure * ART.exposure * 1.14);
      ph.u1f('uSaturation', ART.saturation * 1.14);
      ph.u1f('uContrast', ART.contrast * 1.04);
      ph.u3f('uLift', 0.008, -0.003, 0.018);
      ph.u3f('uGain', 1.03, 0.985, 1.05);
      ph.u1f('uVignette', ART.vignette * 0.52);
      ph.u1f('uGrain', ART.grain * 0.36);
      ph.u1f('uHalftone', 0.02);
      ph.u1f('uCanvas', 0.02);
      ph.u1f('uAberration', fx.aberration);
      ph.u1f('uFlashWhite', fx.flashWhite);
      ph.u1f('uDesaturate', fx.desaturate);
      ph.u1f('uExposureAuto', quality.autoexp ? 1 : 0);
      ph.u1f('uAOStrength', quality.ssao ? 0.55 : 0.0);
      ph.u1f('uStreakStrength', quality.streak ? 0.15 : 0.0);
      fsTri.draw();
      return;
    }
    var p = prog.composite.use();
    p.tex('uColor', 0, rt.ink.textures[0]);
    p.tex('uBloom', 1, quality.bloom ? rt.blurB.textures[0] : rt.bright.textures[0]);
    p.tex('uTooth', 2, toothTex);
    /* Same normal+depth attachment the ink pass already reads, so halftone
       can tell actual geometry from sky/void and stop stamping a dot screen
       onto empty space. rt.main still holds it here: composite runs after
       the particle pass, which detaches and reattaches this exact texture on
       rt.main's OWN framebuffer and always restores it before returning. */
    p.tex('uSceneDepth', 3, rt.main.textures[1]);
    p.u2f('uRes', W, H);
    p.u1f('uTime', time);
    p.u1f('uBloomStrength', quality.bloom ? ART.bloomStrength : 0.0);
    p.u1f('uExposure', fx.exposure * ART.exposure);
    p.u1f('uSaturation', ART.saturation);
    p.u1f('uContrast', ART.contrast);
    /* Lift pushes a touch of violet into the blacks and gain pulls a touch of
       green out of the whites. This is the grade that makes the palette feel
       printed rather than rendered, and it is the same move the reference
       plates make: their blacks are never neutral. */
    p.u3f('uLift', 0.010, -0.004, 0.022);
    p.u3f('uGain', 1.03, 0.975, 1.06);
    p.u1f('uVignette', ART.vignette);
    p.u1f('uGrain', ART.grain);
    p.u1f('uHalftone', ART.halftone);
    p.u1f('uCanvas', ART.canvas);
    p.u1f('uAberration', fx.aberration);
    p.u1f('uShake', fx.shake);
    p.u1f('uFlashWhite', fx.flashWhite);
    p.u1f('uDesaturate', fx.desaturate);
    fsTri.draw();
  }

  function render(dt) {
    if (!gl || !rt.main) return;
    try {
      prof.draws = 0; prof.shadowDraws = 0; prof.culled = 0; prof.culledShadow = 0;
      time += dt;
      buildMatrices(dt);
      extractFrustum(viewProj, frustum);
      markStart('shadow'); shadowPass(); markEnd('shadow');

      /* The scene target: multisampled when MSAA is on, otherwise direct to
         final textures. Sky, opaque and transparent all go there. */
      var scene = rt.mainMS || rt.main;
      scene.bind();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      markStart('sky'); skyPass(); markEnd('sky');
      markStart('opaque'); opaquePass(); markEnd('opaque');
      markStart('transparent'); transparentPass(); markEnd('transparent');

      if (rt.mainMS) {
        GL.blitResolve(rt.mainMS, rt.main, 0);
        GL.blitResolve(rt.mainMS, rt.main, 1);
      }

      markStart('particles'); particlePass(); markEnd('particles');

      if (style === 'hd') {
        markStart('ao'); aoPass(); markEnd('ao');
        markStart('bloom'); bloomPass(rt.main); markEnd('bloom');
        markStart('streak'); streakPass(); markEnd('streak');
        markStart('lum'); lumPass(); markEnd('lum');
      } else {
        markStart('ink'); inkPass(); markEnd('ink');
        markStart('bloom'); bloomPass(rt.ink); markEnd('bloom');
      }
      markStart('composite'); compositePass(); markEnd('composite');
    } catch (e) {
      /* Reported, never swallowed. A throw inside a pass would otherwise
         abandon the rest of the frame silently and leave a stale image on
         screen that looks like a freeze rather than an error. */
      recordError('render', e);
    }
    reset();
  }

  /* ---------- screen space helpers ---------- */

  /* Project a world point to CSS pixels, for DOM overlays (damage numbers,
     health bars, callouts). Returns null behind the camera rather than a
     mirrored on-screen position, which is the classic bug that puts a health
     bar for something behind you in the middle of the screen. */
  function project(p) {
    var x = p[0], y = p[1], z = p[2];
    var cx = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12];
    var cy = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13];
    var cw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
    if (cw <= 0.0001) return null;
    return {
      x: (cx / cw * 0.5 + 0.5) * (W / DPR / quality.scale),
      y: (1 - (cy / cw * 0.5 + 0.5)) * (H / DPR / quality.scale),
      w: cw
    };
  }

  /* Unproject a screen point onto the y = planeY plane. This is the entire
     mouse-to-world story for a tower defence: the player only ever points at
     the ground. */
  function screenToGround(sx, sy, planeY) {
    planeY = planeY || 0;
    var cssW = W / DPR / quality.scale, cssH = H / DPR / quality.scale;
    var ndcX = (sx / cssW) * 2 - 1;
    var ndcY = 1 - (sy / cssH) * 2;
    var near = U.m4xform(invViewProj, [ndcX, ndcY, -1]);
    var far = U.m4xform(invViewProj, [ndcX, ndcY, 1]);
    var dir = U.V.sub(far, near);
    if (Math.abs(dir[1]) < 1e-6) return null;
    var t = (planeY - near[1]) / dir[1];
    if (t < 0) return null;
    return [near[0] + dir[0] * t, planeY, near[2] + dir[2] * t];
  }

  return {
    init: init, resize: resize, render: render, reset: reset,
    push: push, pushUnlit: pushUnlit, pushParticle: pushParticle,
    setPalette: setPalette, palette: palette,
    project: project, screenToGround: screenToGround,
    cam: cam, sun: sun, fx: fx, quality: quality, ART: ART,
    setTier: setTier, cycleTier: cycleTier, TIERS: TIERS,
    setStyle: setStyle, cycleStyle: cycleStyle,
    get style() { return style; },
    get W() { return W; }, get H() { return H; },
    get time() { return time; },
    get gl() { return gl; },
    errors: function () { return errors.slice(); },
    /* Read one instance slot back out of the particle buffer. Exists so the
       harness can prove the CPU side and the vertex layout agree about the
       stride: a mismatch there corrupts every particle and throws nothing. */
    debugParticleSlot: function (i) {
      if (i < 0 || i >= particleN) return null;
      return Array.prototype.slice.call(partData, i * PART_STRIDE, (i + 1) * PART_STRIDE);
    },
    /* Read a few pixels straight out of the main colour attachment, so a
       probe can prove the scene buffer holds sane HDR values (and that the
       resolve wrote them). Readback is a sync point; this is a debug tool,
       never called by the game. */
    probeMain: function (nx, ny) {
      if (!gl || !rt.main) return null;
      var w = 4, h = 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.main.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.main.textures[0], 0);
      var px = new Float32Array(w * h * 4);
      gl.readPixels(Math.max(0, Math.floor((nx || 0.5) * rt.main.w)), Math.max(0, Math.floor((ny || 0.5) * rt.main.h)),
        w, h, gl.RGBA, gl.FLOAT, px);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      return Array.prototype.slice.call(px, 0, 4 * 4);
    },
    particleCount: function () { return particleN; },
    prof: prof,
    setProfiling: function (v) { prof.on = !!v; },
    tickAdaptive: tickAdaptive,
    adaptive: adapt,
    stats: function () {
      return { draws: prof.draws, shadowDraws: prof.shadowDraws,
        culled: prof.culled, culledShadow: prof.culledShadow,
               opaqueItems: opaqueN, transparentItems: transparentN,
               particles: particleN, ms: prof.ms };
    },
    caps: function () { return GL.caps; }
  };
})();


