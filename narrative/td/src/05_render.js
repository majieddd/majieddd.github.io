// ===== render.js : Three.js scene, oil-painting post FX, particles, draw loop =====

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.setClearColor(PALETTE.void, 1);
  return renderer;
}

function makePostFX(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType });
  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    tDiffuse: { value: rt.texture },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(size.x, size.y) },
    uVignette: { value: 0.22 },
    uPaint: { value: 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      precision highp float; varying vec2 vUv;
      uniform sampler2D tDiffuse; uniform vec2 uRes;
      uniform float uVignette; uniform float uPaint;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 px = 1.0/uRes;
        // single cheap brush-jitter lattice (one hash, no fbm loop)
        vec2 brick = floor(vUv*uRes/2.4);
        vec2 jit = (vec2(hash(brick), hash(brick+7.3))-0.5)*2.4*px*2.0*uPaint;
        vec2 uv = clamp(vUv + jit, 0.0, 1.0);
        // chromatic split only toward edges (cheap: 3 taps)
        float edge = distance(vUv, vec2(0.5));
        vec3 col;
        col.r = texture2D(tDiffuse, uv + vec2(px.x*1.0,0.0)*uPaint).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - vec2(px.x*1.0,0.0)*uPaint).b;
        // saturation lift + gentle contrast
        float l = dot(col, vec3(0.299,0.587,0.114));
        col = mix(vec3(l), col, 1.14);
        col = (col-0.5)*1.05 + 0.5;
        // canvas grain
        col += (hash(vUv*uRes*0.5)-0.5)*0.04;
        // vignette
        float v = smoothstep(0.98, 0.28, edge);
        col *= mix(1.0, v, uVignette);
        gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  fsScene.add(quad);
  return { rt, fsScene, fsCam, mat, uniforms };
}

function makeNebula() {
  // Large sphere with a procedural vaporwave nebula gradient.
  const geo = new THREE.SphereGeometry(120, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      precision highp float; varying vec3 vP; uniform float uTime;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        float n000=hash(i),n100=hash(i+vec3(1,0,0)),n010=hash(i+vec3(0,1,0)),n110=hash(i+vec3(1,1,0));
        float n001=hash(i+vec3(0,0,1)),n101=hash(i+vec3(1,0,1)),n011=hash(i+vec3(0,1,1)),n111=hash(i+vec3(1,1,1));
        return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z); }
      float fbm(vec3 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.02; a*=0.5; } return v; }
      void main(){
        vec3 dir = normalize(vP);
        float h = fbm(dir*2.2 + vec3(0.0, uTime*0.01, 0.0));
        float h2 = fbm(dir*4.5 - vec3(uTime*0.008, 0.0, 0.0));
        vec3 voidc = vec3(0.039,0.055,0.090);
        vec3 mag = vec3(1.0,0.184,0.839);
        vec3 cy = vec3(0.220,0.910,1.0);
        vec3 vi = vec3(0.486,0.227,0.929);
        vec3 col = voidc;
        col = mix(col, vi, smoothstep(0.25,0.7,h)*1.05);
        col = mix(col, mag, smoothstep(0.45,0.85,h)*0.85);
        col = mix(col, cy, smoothstep(0.6,0.95,h)*0.55);
        // magenta horizon band for vaporwave glow
        float band = smoothstep(0.55, 0.0, abs(dir.y));
        col += mag * band * 0.35 * (0.5 + 0.5*h2);
        col = pow(col, vec3(0.92)); // lift
        // dim starfield
        float st = step(0.996, hash(floor(dir*420.0)));
        col += st*0.9;
        gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function RtGame(canvas) {
  this.canvas = canvas;
  this.renderer = makeRenderer(canvas);
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(PALETTE.void, 0.011);
  this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  this.camTarget = new THREE.Vector3(GRID.cols / 2, 0, GRID.rows / 2);
  this.camera.position.set(GRID.cols / 2, 15.5, GRID.rows / 2 + 12.5);
  this.camera.lookAt(this.camTarget);

  this.scene.add(makeNebula());
  const amb = new THREE.AmbientLight(0x44506b, 0.85); this.scene.add(amb);
  const key = new THREE.DirectionalLight(0x9fd8ff, 1.1); key.position.set(-6, 14, 8); this.scene.add(key);
  const rim = new THREE.DirectionalLight(0xff2fd6, 0.5); rim.position.set(10, 6, -8); this.scene.add(rim);
  const fill = new THREE.PointLight(0xfbbf24, 0.6, 60); fill.position.set(GRID.cols / 2, 8, GRID.rows / 2); this.scene.add(fill);

  this.post = makePostFX(this.renderer, this.scene, this.camera);
  this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
  this.worldGroup = new THREE.Group(); this.scene.add(this.worldGroup);
  // build/inspect range indicator
  this.rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  this.rangeRing.rotation.x = -Math.PI / 2; this.rangeRing.position.y = 0.05; this.rangeRing.visible = false;
  this.worldGroup.add(this.rangeRing);
  this.setRangeRing = function (x, z, r, hue) {
    if (r == null) { this.rangeRing.visible = false; return; }
    this.rangeRing.visible = true; this.rangeRing.position.set(x, 0.05, z);
    this.rangeRing.scale.set(r, r, r);
    this.rangeRing.material.color.setHex(hue || 0x38e8ff);
  };
  this.particles = [];
  this.lights = []; // transient point lights for impacts
  this.shake = 0;
  this.t = 0;
}

RtGame.prototype.resize = function () {
  const w = this.canvas.clientWidth || window.innerWidth;
  const h = this.canvas.clientHeight || window.innerHeight;
  this.renderer.setSize(w, h, false);
  this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  const size = new THREE.Vector2(); this.renderer.getSize(size);
  this.post.rt.setSize(size.x, size.y);
  this.post.uniforms.uRes.value.set(size.x, size.y);
};

RtGame.prototype.buildWorld = function () {
  // ground plane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x0c1320, roughness: 0.95, metalness: 0.1, flatShading: true }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(GRID.cols / 2, -0.02, GRID.rows / 2); this.worldGroup.add(ground);

  // neon grid
  const grid = new THREE.GridHelper(GRID.cols + 4, GRID.cols + 4, PALETTE.cyan, 0x1c3b55);
  grid.position.set(GRID.cols / 2, 0.01, GRID.rows / 2);
  grid.material.opacity = 0.4; grid.material.transparent = true;
  this.worldGroup.add(grid);

  // path ribbon (violet glow corridor)
  const pts = [];
  for (const p of this.pathForRibbon()) pts.push(new THREE.Vector3(p[0] + 0.5, 0.03, p[1] + 0.5));
  const curve = new THREE.CatmullRomCurve3(pts);
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.46, 8, false), new THREE.MeshStandardMaterial({ color: 0x13052a, emissive: PALETTE.violet, emissiveIntensity: 1.4, roughness: 0.5, metalness: 0.3, flatShading: true }));
  this.worldGroup.add(ribbon);
  // additive glow shell over the path
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.7, 8, false), new THREE.MeshBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.02; this.worldGroup.add(glow);

  // decorative asteroids around the field
  const rng = makeRNG(99);
  for (let i = 0; i < 26; i++) {
    const rock = buildRock(rng.int(1, 9999));
    rock.position.set(rng.range(-3, GRID.cols + 3), rng.range(-0.5, 1.5), rng.range(-3, GRID.rows + 3));
    const onPath = PATH_TILES.has(Math.round(rock.position.x) + ',' + Math.round(rock.position.z));
    if (onPath) continue;
    rock.rotation.set(rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28));
    this.worldGroup.add(rock);
  }
};

RtGame.prototype.pathForRibbon = function () {
  // approximate: reuse WAYPOINTS extended to core
  const wp = WAYPOINTS.slice(); wp.push(CORE_TILE);
  const out = [];
  for (let i = 0; i < wp.length - 1; i++) {
    let [c0, r0] = wp[i]; const [c1, r1] = wp[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0; out.push([c, r]);
    while (c !== c1 || r !== r1) { c += dc; r += dr; out.push([c, r]); }
  }
  out.push(CORE_TILE.slice());
  return out;
};

// particle helpers
RtGame.prototype.spawnBurst = function (x, y, hue, count, spread) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color: hue }));
    m.position.set(x, 0.4, y);
    const a = Math.random() * 6.28, sp = Math.random() * (spread || 3);
    this.fxGroup.add(m);
    this.particles.push({ mesh: m, vx: Math.cos(a) * sp, vy: Math.random() * 3 + 1, vz: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, t: 0 });
  }
};
RtGame.prototype.spawnRing = function (x, y, hue, r) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 16), new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.9 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.3, y); this.fxGroup.add(ring);
  this.particles.push({ mesh: ring, ring: true, r: r || 1.2, life: 0.5, t: 0 });
};
RtGame.prototype.spawnLight = function (x, y, hue) {
  const l = new THREE.PointLight(hue, 3, 6); l.position.set(x, 1.2, y); this.scene.add(l);
  this.lights.push({ light: l, life: 0.25, t: 0 });
};
RtGame.prototype.spawnFloatText = function (x, y, text, hue) {
  // DOM-free: a tiny sprite-like quad; we keep it simple with a canvas texture pool later. Current: skip glyph, emit a gold spark.
  this.spawnBurst(x, y, hue, 6, 1.5);
};

RtGame.prototype.updateFx = function (dt) {
  for (let i = this.particles.length - 1; i >= 0; i--) {
    const p = this.particles[i]; p.t += dt;
    const k = p.t / p.life;
    if (k >= 1) { this.fxGroup.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); this.particles.splice(i, 1); continue; }
    if (p.ring) { const s = 0.2 + (p.r || 1) * k; p.mesh.scale.set(s, s, 1); p.mesh.material.opacity = 0.9 * (1 - k); }
    else { p.vy -= 9 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.mesh.material.opacity = 1 - k; p.mesh.material.transparent = true; }
  }
  for (let i = this.lights.length - 1; i >= 0; i--) {
    const l = this.lights[i]; l.t += dt; if (l.t >= l.life) { this.scene.remove(l.light); this.lights.splice(i, 1); } else l.light.intensity = 3 * (1 - l.t / l.life);
  }
};

RtGame.prototype.render = function (shakeAmt) {
  this.post.uniforms.uTime.value = this.t;
  this.t += 0.016;
  // camera shake
  const s = shakeAmt || 0;
  const ox = (Math.random() - 0.5) * s * 0.6, oz = (Math.random() - 0.5) * s * 0.6;
  this.camera.position.x = this.camTarget.x + ox;
  this.camera.position.z = this.camTarget.z + 12.5 + oz;
  this.camera.lookAt(this.camTarget);
  this.renderer.setRenderTarget(this.post.rt);
  this.renderer.render(this.scene, this.camera);
  this.renderer.setRenderTarget(null);
  this.renderer.render(this.post.fsScene, this.post.fsCam);
};
