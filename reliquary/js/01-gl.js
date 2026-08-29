/* RELIQUARY :: 01-gl
   A thin WebGL2 layer. Not a framework: just the parts this renderer needs,
   with the failure modes made loud.

   DESIGN NOTE, and the reason this file exists at all rather than a library:
   the painterly look is a SHADING problem, not a scene-graph problem. Every
   interesting decision in this project lives in a fragment shader, so the
   engine layer only has to be good enough to bind buffers and manage render
   targets without lying about errors.

   THE LAW THIS FILE OBEYS: never swallow an error. A shader that fails to
   compile in a silent try/catch produces a black screen and no explanation,
   which is the single most expensive failure mode in graphics work. Every
   compile, link and framebuffer completeness check throws with the driver's
   own message plus a numbered listing of the offending source. */
'use strict';

var GL = (function () {

  var gl = null;
  var caps = {};
  var _errors = [];
  /* Live GL object counts. WebGL objects are not garbage collected when the
     last JS reference is dropped, so a leak here is silent and permanent. A
     counter makes it a number the harness can assert on. */
  var _live = { mesh: 0, texture: 0, target: 0 };

  /* Every unrecoverable GL problem funnels through here so that the harness
     has exactly one buffer to assert is empty, per the project law that an
     error buffer without a named reader is a place errors go to be ignored. */
  function fail(stage, msg) {
    var e = new Error('[GL ' + stage + '] ' + msg);
    _errors.push({ stage: stage, msg: String(msg) });
    throw e;
  }
  function errors() { return _errors.slice(); }

  function init(canvas, opts) {
    opts = opts || {};
    gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: false,          /* we resolve edges ourselves with the ink pass */
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
      powerPreference: 'high-performance',
      desynchronized: false
    });
    if (!gl) fail('init', 'WebGL2 is not available in this browser.');

    /* EXT_color_buffer_float gates the entire HDR path: bloom needs values
       above 1.0 to have anywhere to live. When it is missing we fall back to
       RGBA8 targets and a tonemap that runs before the bright pass instead of
       after, which loses some glow range but still renders. Measured present
       on both this machine's real GPU and on the headless software rasteriser
       (ANGLE Microsoft Basic Render Driver), so the fallback is defensive
       rather than routine. */
    caps.colorBufferFloat = !!gl.getExtension('EXT_color_buffer_float');
    caps.floatLinear = !!gl.getExtension('OES_texture_float_linear');
    var aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    caps.aniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
    caps.anisoExt = aniso || null;
    caps.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    caps.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
    caps.maxSamples = gl.getParameter(gl.MAX_SAMPLES);
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    caps.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : String(gl.getParameter(gl.RENDERER));
    caps.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : String(gl.getParameter(gl.VENDOR));
    /* A software rasteriser renders correctly and slowly. The difference
       matters because the quality auto-scaler must not interpret "software is
       slow" as "this GPU cannot handle bloom" and permanently disable it. */
    caps.software = /SwiftShader|Basic Render|llvmpipe|Software/i.test(caps.renderer);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return gl;
  }

  /* ---------- shaders ---------- */

  /* A compile failure prints the driver message AND a line-numbered listing,
     because GLSL errors are reported as "0:137: error" and hunting line 137 in
     a template literal by eye is how an afternoon disappears. */
  function listing(src) {
    var lines = src.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      out.push(String(i + 1).padStart(4, ' ') + ' | ' + lines[i]);
    }
    return out.join('\n');
  }

  function shader(type, src, name) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      fail('compile:' + (name || '?'), log + '\n' + listing(src));
    }
    return s;
  }

  /* Programs cache their uniform locations on first use. getUniformLocation is
     a synchronous driver call and doing it per-draw is a measurable cost once
     there are a few hundred draws a frame. */
  function program(vsSrc, fsSrc, name) {
    var p = gl.createProgram();
    var vs = shader(gl.VERTEX_SHADER, vsSrc, name + '.vert');
    var fs = shader(gl.FRAGMENT_SHADER, fsSrc, name + '.frag');
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(p);
      fail('link:' + (name || '?'), log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    var cache = Object.create(null);
    var obj = {
      handle: p,
      name: name || '?',
      use: function () { gl.useProgram(p); return obj; },
      loc: function (u) {
        var l = cache[u];
        if (l === undefined) { l = gl.getUniformLocation(p, u); cache[u] = l; }
        return l;
      },
      /* Silently ignoring a uniform that the compiler optimised away is
         correct and common (a debug uniform unused this frame), so these do
         not throw. What would be a real defect is a TYPO in a uniform name,
         which this cannot distinguish, so the shaders keep their uniform
         names in one place and the render code reads them from there. */
      u1i: function (u, v) { var l = obj.loc(u); if (l) gl.uniform1i(l, v); return obj; },
      u1f: function (u, v) { var l = obj.loc(u); if (l) gl.uniform1f(l, v); return obj; },
      u2f: function (u, a, b) { var l = obj.loc(u); if (l) gl.uniform2f(l, a, b); return obj; },
      u3f: function (u, a, b, c) { var l = obj.loc(u); if (l) gl.uniform3f(l, a, b, c); return obj; },
      u4f: function (u, a, b, c, d) { var l = obj.loc(u); if (l) gl.uniform4f(l, a, b, c, d); return obj; },
      u3v: function (u, v) { var l = obj.loc(u); if (l) gl.uniform3f(l, v[0], v[1], v[2]); return obj; },
      um4: function (u, m) { var l = obj.loc(u); if (l) gl.uniformMatrix4fv(l, false, m); return obj; },
      um3: function (u, m) { var l = obj.loc(u); if (l) gl.uniformMatrix3fv(l, false, m); return obj; },
      tex: function (u, unit, texture, target) {
        var l = obj.loc(u);
        if (l) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(target || gl.TEXTURE_2D, texture);
          gl.uniform1i(l, unit);
        }
        return obj;
      }
    };
    return obj;
  }

  /* ---------- geometry ----------
     Attribute layout is fixed across every mesh program so one VAO works with
     any of them:
       0 vec3 aPos
       1 vec3 aNrm
       2 vec3 aCol    per-vertex albedo, baked at mesh build time
       3 vec3 aAux    x = facet jitter seed, y = paint-tooth weight, z = emissive
     Packing the paint parameters into the vertex stream rather than a texture
     is what lets every facet carry its own brush character with zero extra
     draw calls or samplers. */
  var ATTR = { pos: 0, nrm: 1, col: 2, aux: 3 };

  function mesh(data) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.verts, gl.STATIC_DRAW);

    var stride = 12 * 4; /* pos3 + nrm3 + col3 + aux3 = 12 floats */
    gl.enableVertexAttribArray(ATTR.pos);
    gl.vertexAttribPointer(ATTR.pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(ATTR.nrm);
    gl.vertexAttribPointer(ATTR.nrm, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(ATTR.col);
    gl.vertexAttribPointer(ATTR.col, 3, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(ATTR.aux);
    gl.vertexAttribPointer(ATTR.aux, 3, gl.FLOAT, false, stride, 9 * 4);

    /* BOUNDING SPHERE, computed once at build time. Frustum culling needs a
       cheap conservative volume per mesh, and the vertex data is right here and
       never read again after the upload, so this is the only place where the
       cost can be paid once rather than every frame. Centre of the AABB rather
       than the centroid, because the radius is measured from it and the two
       have to agree for the sphere to be as tight as an axis-aligned pass can
       make it. */
    var bMin0 = Infinity, bMin1 = Infinity, bMin2 = Infinity;
    var bMax0 = -Infinity, bMax1 = -Infinity, bMax2 = -Infinity;
    for (var vi = 0; vi < data.verts.length; vi += 12) {
      var x = data.verts[vi], y = data.verts[vi + 1], z = data.verts[vi + 2];
      if (x < bMin0) bMin0 = x; if (x > bMax0) bMax0 = x;
      if (y < bMin1) bMin1 = y; if (y > bMax1) bMax1 = y;
      if (z < bMin2) bMin2 = z; if (z > bMax2) bMax2 = z;
    }
    var bcx = 0, bcy = 0, bcz = 0, brad = 0;
    if (isFinite(bMin0)) {
      bcx = (bMin0 + bMax0) * 0.5; bcy = (bMin1 + bMax1) * 0.5; bcz = (bMin2 + bMax2) * 0.5;
      var best = 0;
      for (var vj = 0; vj < data.verts.length; vj += 12) {
        var dx = data.verts[vj] - bcx, dy = data.verts[vj + 1] - bcy, dz = data.verts[vj + 2] - bcz;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > best) best = d2;
      }
      brad = Math.sqrt(best);
    }

    _live.mesh++;
    var ibo = null, count = 0, type = gl.UNSIGNED_SHORT;
    if (data.index) {
      ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.index, gl.STATIC_DRAW);
      count = data.index.length;
      type = (data.index instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    } else {
      count = data.verts.length / 12;
    }
    gl.bindVertexArray(null);

    return {
      vao: vao, vbo: vbo, ibo: ibo, count: count, type: type,
      bounds: data.bounds || null,
      bcx: bcx, bcy: bcy, bcz: bcz, radius: brad,
      draw: function () {
        gl.bindVertexArray(vao);
        if (ibo) gl.drawElements(gl.TRIANGLES, count, type, 0);
        else gl.drawArrays(gl.TRIANGLES, 0, count);
      },
      dispose: function () {
        _live.mesh--;
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(vbo);
        if (ibo) gl.deleteBuffer(ibo);
      }
    };
  }

  /* A single oversized triangle rather than a quad for fullscreen passes: it
     avoids the diagonal seam where the two triangles of a quad meet, which
     shows up as a visible line in any pass that reads neighbouring pixels
     (which every blur and the Sobel ink pass do). */
  var _fsTri = null;
  function fullscreenTri() {
    if (_fsTri) return _fsTri;
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    _fsTri = {
      draw: function () {
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    return _fsTri;
  }

  /* ---------- textures ---------- */

  function texFromCanvas(cv, opts) {
    opts = opts || {};
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    var wrap = opts.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (opts.nearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (caps.anisoExt && caps.aniso > 1) {
        gl.texParameterf(gl.TEXTURE_2D, caps.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(8, caps.aniso));
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  function texEmpty(w, h, internal, format, type, filter, wrap) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap || gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  /* ---------- render targets ----------
     `spec.color` is a list of {internal, format, type} so the main pass can
     write colour and a packed normal/depth attachment in one go. */
  function target(w, h, spec) {
    spec = spec || {};
    var colorSpecs = spec.color || [{ internal: null, format: null, type: null }];
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    var hdr = caps.colorBufferFloat;
    var textures = [];
    var bufs = [];
    for (var i = 0; i < colorSpecs.length; i++) {
      var cs = colorSpecs[i];
      var internal = cs.internal || (hdr ? gl.RGBA16F : gl.RGBA8);
      var format = cs.format || gl.RGBA;
      var type = cs.type || (hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE);
      var filt = cs.nearest ? gl.NEAREST : gl.LINEAR;
      var t = texEmpty(w, h, internal, format, type, filt);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      textures.push(t);
      bufs.push(gl.COLOR_ATTACHMENT0 + i);
    }
    gl.drawBuffers(bufs);

    var depthTex = null, depthRb = null;
    if (spec.depthTexture) {
      depthTex = texEmpty(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    } else if (spec.depth !== false) {
      depthRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    }

    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      /* Naming the numeric status is worth the four lines: the raw number is
         meaningless and the usual cause (an unsupported internal format on
         this driver) is fixable only if you know which check failed. */
      var names = {};
      names[gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT] = 'INCOMPLETE_ATTACHMENT';
      names[gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = 'MISSING_ATTACHMENT';
      names[gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS] = 'INCOMPLETE_DIMENSIONS';
      names[gl.FRAMEBUFFER_UNSUPPORTED] = 'UNSUPPORTED';
      names[gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE] = 'INCOMPLETE_MULTISAMPLE';
      fail('framebuffer', (names[status] || status) + ' at ' + w + 'x' + h +
        ' hdr=' + hdr + ' attachments=' + colorSpecs.length);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      fb: fb, tex: textures[0], textures: textures,
      depthTex: depthTex, depthRb: depthRb, w: w, h: h,
      bind: function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, w, h);
      },
      dispose: function () {
        gl.deleteFramebuffer(fb);
        for (var i = 0; i < textures.length; i++) gl.deleteTexture(textures[i]);
        if (depthTex) gl.deleteTexture(depthTex);
        if (depthRb) gl.deleteRenderbuffer(depthRb);
      }
    };
  }

  /* A depth-only target for the shadow pass. Colour attachments are omitted
     entirely (drawBuffers NONE), which is both faster and the only portable
     way to get a depth texture without a dummy colour buffer. */
  function shadowTarget(size) {
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    /* Hardware comparison sampling: the shader declares sampler2DShadow and
       gets bilinear PCF for free from the texture unit, which is four taps of
       quality for the price of one. */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) fail('shadowFramebuffer', String(status));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      fb: fb, tex: t, size: size,
      bind: function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, size, size);
      },
      dispose: function () { gl.deleteFramebuffer(fb); gl.deleteTexture(t); }
    };
  }

  function bindScreen(w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
  }

  return {
    init: init,
    get gl() { return gl; },
    get caps() { return caps; },
    ATTR: ATTR,
    program: program, mesh: mesh, fullscreenTri: fullscreenTri,
    texFromCanvas: texFromCanvas, texEmpty: texEmpty,
    target: target, shadowTarget: shadowTarget, bindScreen: bindScreen,
    errors: errors,
    live: function () { return { mesh: _live.mesh, texture: _live.texture, target: _live.target }; }
  };
})();
