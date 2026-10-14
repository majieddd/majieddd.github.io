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
  var fsTri = null;

  /* Draw lists, rebuilt every frame. Plain arrays reused across frames with a
     length reset rather than reallocated: this is the hot path and a fresh
     array per frame per list is a guaranteed GC sawtooth. */
  var opaque = [], transparent = [], particles = [];
  var opaqueN = 0, transparentN = 0, particleN = 0;

  var pal = null;
  var quality = { bloom: true, shadows: true, ink: true, shadowSize: 2048, scale: 1.0 };

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
    ambient: 0.20,
    specStrength: 0.14,
    specPower: 90.0,
    /* Rim at 1.25 with power 2.35 was wide enough to wash the whole grazing
       half of the board into a haze. A rim is meant to separate a silhouette,
       not to light a surface: tighter power, lower strength. */
    rimStrength: 0.85,
    rimPower: 3.4,
    toothScale: 0.42,
    toothStrength: 0.34,
    fogDensity: 0.0055,
    bloomThreshold: 0.68,
    bloomStrength: 0.85,
    /* Exposure sits under 1.0 because the filmic curve lifts midtones by
       roughly 1.6x on its own, which fights a deliberately dark palette. */
    exposure: 0.80,
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
    saturation: 1.16,
    contrast: 1.10,
    vignette: 0.66,
    grain: 0.042,
    halftone: 0.62,
    canvas: 0.20,
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
  var sun = { dir: [0.42, 0.80, 0.44], distance: 90, extent: 46 };
  var fx = {
    shake: 0, aberration: 0, flashWhite: 0, desaturate: 0,
    flashRGB: [1, 1, 1],
    exposure: 1.0, timeScale: 1
  };

  var view = U.m4ident(), proj = U.m4ident(), viewProj = U.m4ident();
  var invViewProj = U.m4ident(), lightVP = U.m4ident();
  var tmpM = U.m4ident(), tmpN = new Float32Array(9);
  var time = 0;

  /* Instanced particle buffer. Sized once for the worst case rather than
     grown, because a resize mid-combat is a frame hitch exactly when the
     player is most likely to notice. */
  var MAX_PARTICLES = 7168;
  var partData = new Float32Array(MAX_PARTICLES * 10);
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
    /* Exposed for the uniform read-back probe in tools/_iso.html. Reading the
       values back out of the linked program is the only way to prove the CPU
       side and the GPU side agree about what the art constants are. */
    if (typeof window !== 'undefined') window.__MESHPROG = prog.mesh.handle;

    toothTex = GL.texFromCanvas(PAINT.buildAtlas(512));

    /* A software rasteriser renders correctly but slowly. Dropping the shadow
       map and the render scale keeps the headless verifier usable without
       changing what the image is MADE of, so a screenshot taken there still
       proves the art direction. Bloom and ink stay on for exactly that
       reason: they are the look, not a garnish. */
    if (GL.caps.software) {
      quality.shadowSize = 1024;
      quality.scale = 0.75;
    }

    partVAO = gl.createVertexArray();
    gl.bindVertexArray(partVAO);
    partVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferData(gl.ARRAY_BUFFER, partData.byteLength, gl.DYNAMIC_DRAW);
    var stride = 10 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 3 * 4);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 7 * 4);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    rt.shadow = GL.shadowTarget(quality.shadowSize);
    setPalette('human');
    return gl;
  }

  function setPalette(factionId) {
    pal = PAINT.FACTIONS[factionId] || PAINT.FACTIONS.human;
    return pal;
  }
  function palette() { return pal; }

  function resize(w, h, dpr) {
    DPR = dpr || 1;
    W = Math.max(2, Math.round(w * DPR * quality.scale));
    H = Math.max(2, Math.round(h * DPR * quality.scale));
    canvas.width = Math.max(2, Math.round(w * DPR));
    canvas.height = Math.max(2, Math.round(h * DPR));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    if (rt.main) rt.main.dispose();
    if (rt.ink) rt.ink.dispose();
    if (rt.bright) rt.bright.dispose();
    if (rt.blurA) rt.blurA.dispose();
    if (rt.blurB) rt.blurB.dispose();

    /* Two colour attachments: lit colour, and packed normal plus linear depth.
       A depth RENDERBUFFER rather than a depth texture, because nothing reads
       depth as a texture: the ink pass gets its depth from attachment 1 where
       it is already linear and does not need reconstructing from a projection
       matrix every pixel. */
    rt.main = GL.target(W, H, {
      color: [{}, {}],
      depth: true
    });
    rt.ink = GL.target(W, H, { color: [{}], depth: false });
    var bw = Math.max(2, W >> 1), bh = Math.max(2, H >> 1);
    rt.bright = GL.target(bw, bh, { color: [{}], depth: false });
    rt.blurA = GL.target(bw, bh, { color: [{}], depth: false });
    rt.blurB = GL.target(bw, bh, { color: [{}], depth: false });
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
  function pushParticle(x, y, z, r, g, b, a, size, rot, kind) {
    if (particleN >= MAX_PARTICLES) return;
    var o = particleN * 10;
    partData[o] = x; partData[o + 1] = y; partData[o + 2] = z;
    partData[o + 3] = r; partData[o + 4] = g; partData[o + 5] = b; partData[o + 6] = a;
    partData[o + 7] = size; partData[o + 8] = rot; partData[o + 9] = kind;
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
    var centre = cam.target;
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
    for (var i = 0; i < opaqueN; i++) {
      var it = opaque[i];
      if (!it.castShadow) continue;
      p.um4('uModel', it.model);
      p.u1f('uExplode', it.explode);
      it.mesh.draw();
    }
    gl.cullFace(gl.BACK);
  }

  function skyPass() {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
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

    var p = prog.mesh.use();
    p.um4('uProj', proj);
    p.um4('uView', view);
    p.um4('uLightVP', lightVP);
    p.u3v('uLightDir', U.V.norm(sun.dir));
    p.u3v('uCamPos', cam.eyeActual || cam.pos);
    p.u3v('uRimColor', pal.rim);
    p.u1f('uRimStrength', ART.rimStrength);
    p.u1f('uRimPower', ART.rimPower);
    p.u3v('uAmbientSky', pal.ambientSky);
    p.u3v('uAmbientGround', pal.ambientGround);
    p.u1f('uAmbient', ART.ambient);
    p.u1f('uSpecStrength', ART.specStrength);
    p.u1f('uSpecPower', ART.specPower);
    p.u1f('uBands', ART.bands);
    p.u1f('uRampGamma', ART.rampGamma);
    p.u1f('uFacetJitter', ART.facetJitter);
    p.u3v('uShadowColor', pal.shadow);
    p.u3v('uLightColor', pal.light);
    p.u1f('uShadowLift', ART.shadowLift);
    p.u1f('uShadowStrength', quality.shadows ? 1.0 : 0.0);
    p.u1f('uShadowTexel', 1.0 / rt.shadow.size);
    p.u1f('uToothScale', ART.toothScale);
    p.u1f('uToothStrength', ART.toothStrength);
    p.u1f('uTime', time);
    p.u1f('uFogDensity', ART.fogDensity);
    p.u3v('uFogColor', pal.fog);
    p.u3v('uDissolveColor', pal.rim);
    p.tex('uShadow', 0, rt.shadow.tex);
    p.tex('uTooth', 1, toothTex);

    for (var i = 0; i < opaqueN; i++) {
      var it = opaque[i];
      p.um4('uModel', it.model);
      U.m3normalFromM4(it.model, tmpN);
      p.um3('uNormalMat', tmpN);
      p.u3v('uTint', it.tint || [1, 1, 1]);
      p.u1f('uTintMix', it.tintMix);
      p.u1f('uFlash', it.flash);
      p.u3v('uFlashColor', it.flashColor || [1, 1, 1]);
      p.u1f('uDissolve', it.dissolve);
      p.u1f('uExplode', it.explode);
      p.u1f('uAlpha', it.alpha);
      p.u1f('uFacetJitter', it.facetJitter >= 0 ? it.facetJitter : ART.facetJitter);
      p.u1f('uDebugMode', ART.debugMode || 0);
      it.mesh.draw();
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
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.CULL_FACE);

    gl.bindVertexArray(partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, partData, 0, particleN * 10);

    var p = prog.particle.use();
    p.um4('uProj', proj);
    p.um4('uView', view);
    /* Billboard basis pulled out of the view matrix so every quad faces the
       camera without a per-particle lookAt. */
    p.u3f('uRight', view[0], view[4], view[8]);
    p.u3f('uUp', view[1], view[5], view[9]);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particleN);

    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
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

  function bloomPass() {
    if (!quality.bloom) return;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    rt.bright.bind();
    var b = prog.bright.use();
    b.tex('uColor', 0, rt.ink.textures[0]);
    b.u1f('uThreshold', ART.bloomThreshold);
    b.u1f('uSoftKnee', 0.6);
    fsTri.draw();

    /* Three widening passes ping-ponging between two half-res targets. Each
       pass doubles the tap spacing, so the effective kernel grows to about 40
       pixels for the cost of six 5-tap draws. */
    var p = prog.blur.use();
    var src = rt.bright;
    for (var i = 0; i < 3; i++) {
      var spread = 1 + i * 1.9;
      rt.blurA.bind();
      p.tex('uColor', 0, src.textures[0]);
      p.u2f('uDir', spread / rt.blurA.w, 0);
      fsTri.draw();

      rt.blurB.bind();
      p.tex('uColor', 0, rt.blurA.textures[0]);
      p.u2f('uDir', 0, spread / rt.blurB.h);
      fsTri.draw();

      src = rt.blurB;
    }
  }

  function compositePass() {
    GL.bindScreen(canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    var p = prog.composite.use();
    p.tex('uColor', 0, rt.ink.textures[0]);
    p.tex('uBloom', 1, quality.bloom ? rt.blurB.textures[0] : rt.bright.textures[0]);
    p.tex('uTooth', 2, toothTex);
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
    p.u3v('uFlashColor', fx.flashRGB || [1, 1, 1]);
    p.u1f('uDesaturate', fx.desaturate);
    fsTri.draw();
  }

  function render(dt) {
    if (!gl || !rt.main) return;
    try {
      time += dt;
      buildMatrices(dt);
      shadowPass();

      rt.main.bind();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      skyPass();
      opaquePass();
      transparentPass();
      particlePass();

      inkPass();
      bloomPass();
      compositePass();
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
    get W() { return W; }, get H() { return H; },
    get time() { return time; },
    get gl() { return gl; },
    errors: function () { return errors.slice(); },
    caps: function () { return GL.caps; }
  };
})();
