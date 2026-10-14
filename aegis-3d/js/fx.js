/* lowpoly/js/fx.js — the juice layer. Pooled particles (additive sparks and
   painted smoke), shatter shards, shockwave rings, stretched beams, chain
   lightning, muzzle flashes, a 2D overlay for damage numbers and reaction
   callouts, plus screen shake and hit-stop hooks into Game. Every system is
   pooled; nothing here allocates per frame on the hot path. */
(function () {
  'use strict';

  const FX = {};

  let scene = null, camera = null, overlay = null, octx = null;
  let sparkPts, smokePts;
  const MAX_SPARKS = 2600, MAX_SMOKE = 700;
  const sparkPool = [], smokePool = [], shardPool = [], ringPool = [], beamPool = [], cloudPool = [];
  const numbers = [], callouts = [];

  function softCircleTex() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    return t;
  }

  /* ------------------------------------------------------------ */
  function init(s, cam, overlayCanvas) {
    scene = s; camera = cam; overlay = overlayCanvas;
    if (overlay) {
      overlay.width = window.innerWidth; overlay.height = window.innerHeight;
      octx = overlay.getContext('2d');
    }

    const sparkTex = softCircleTex();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    sg.setDrawRange(0, 0);
    sparkPts = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 0.34, map: sparkTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true
    }));
    sparkPts.frustumCulled = false;
    sparkPts.userData.keep = true;
    scene.add(sparkPts);
    for (let i = 0; i < MAX_SPARKS; i++) sparkPool.push({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0, size: 0.3,
      r: 1, g: 1, b: 1, drag: 0.92, gravity: 0
    });

    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SMOKE * 3), 3));
    mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SMOKE * 3), 3));
    mg.setDrawRange(0, 0);
    smokePts = new THREE.Points(mg, new THREE.PointsMaterial({
      size: 1.6, map: sparkTex, transparent: true, depthWrite: false,
      vertexColors: true, sizeAttenuation: true
    }));
    smokePts.frustumCulled = false;
    smokePts.userData.keep = true;
    scene.add(smokePts);
    for (let i = 0; i < MAX_SMOKE; i++) smokePool.push({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0, size: 1,
      r: 1, g: 1, b: 1, grow: 1
    });

    /* Shatter shards: pooled tetrahedra, one material per palette family. */
    const shardColors = { chrome: '#94a3b8', stone: '#a8a29e', storm: '#60a5fa', moss: '#4ade80',
      xeno: '#a855f7', ember: '#f97316', pirate: '#ef4444', human: '#38e8ff', light: '#fbbf24' };
    FX._shardMats = {};
    for (const k in shardColors) FX._shardMats[k] = new THREE.MeshBasicMaterial({ color: shardColors[k] });
    const shardGeo = new THREE.TetrahedronGeometry(1, 0);
    for (let i = 0; i < 220; i++) {
      const m = new THREE.Mesh(shardGeo, FX._shardMats.chrome);
      m.visible = false;
      m.userData.keep = true;
      scene.add(m);
      shardPool.push({ mesh: m, alive: false, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
    }

    /* Shockwave rings. */
    const ringGeo = new THREE.RingGeometry(0.86, 1, 36);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.userData.keep = true;
      scene.add(m);
      ringPool.push({ mesh: m, alive: false, life: 0, maxLife: 0, grow: 0, y: 0 });
    }

    /* Beams: unit cylinders stretched between two points. */
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      }));
      m.visible = false;
      m.userData.keep = true;
      scene.add(m);
      beamPool.push({ mesh: m, alive: false, life: 0, maxLife: 0, r: 0 });
    }

    /* Lingering clouds (gas, puddles). */
    const cloudGeo = new THREE.SphereGeometry(1, 7, 5);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(cloudGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
      }));
      m.visible = false;
      m.userData.keep = true;
      scene.add(m);
      cloudPool.push({ mesh: m, alive: false, life: 0, maxLife: 0, grow: 0, r: 0, g: 0, b: 0, flat: false });
    }
  }

  /* ------------------------------------------------------------ */
  function spawnSpark(x, y, z, vx, vy, vz, life, size, color, gravity) {
    const p = sparkPool.find((q) => !q.alive) || sparkPool[0];
    p.alive = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = 0; p.maxLife = life; p.size = size;
    p.r = color.r; p.g = color.g; p.b = color.b;
    p.gravity = gravity || 0;
  }
  function spawnSmoke(x, y, z, vx, vy, vz, life, size, color, grow) {
    const p = smokePool.find((q) => !q.alive) || smokePool[0];
    p.alive = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = 0; p.maxLife = life; p.size = size;
    p.r = color.r; p.g = color.g; p.b = color.b;
    p.grow = grow || 1.6;
  }
  function spawnShard(x, y, z, paletteKey, speed) {
    const m = shardPool.find((q) => !q.alive);
    if (!m) return;
    m.alive = true;
    m.mesh.material = FX._shardMats[paletteKey] || FX._shardMats.chrome;
    m.mesh.visible = true;
    m.mesh.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 1.2);
    m.vx = Math.sin(a) * Math.cos(b) * s;
    m.vy = Math.abs(Math.sin(b)) * s * 0.9 + 1.4;
    m.vz = Math.cos(a) * Math.cos(b) * s;
    m.life = 0; m.maxLife = 0.8 + Math.random() * 0.7;
    m.spin = (Math.random() - 0.5) * 14;
    const sc = 0.16 + Math.random() * 0.34;
    m.mesh.scale.setScalar(sc);
  }
  function ring(x, y, z, colorHex, maxR, life) {
    const r = ringPool.find((q) => !q.alive) || ringPool[0];
    r.alive = true; r.life = 0; r.maxLife = life; r.grow = maxR; r.y = y;
    r.mesh.visible = true;
    r.mesh.material.color.setHex(colorHex);
    r.mesh.material.opacity = 0.9;
    r.mesh.position.set(x, y, z);
    r.mesh.scale.setScalar(0.3);
  }
  function beam(x1, y1, z1, x2, y2, z2, colorHex, radius, life) {
    const b = beamPool.find((q) => !q.alive) || beamPool[0];
    b.alive = true; b.life = 0; b.maxLife = life; b.r = radius;
    b.mesh.visible = true;
    b.mesh.material.color.setHex(colorHex);
    b.mesh.material.opacity = 0.9;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, mz = (z1 + z2) / 2;
    b.mesh.position.set(mx, my, mz);
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1) || 0.001;
    b.mesh.scale.set(radius, len / 2, radius);
    b.mesh.lookAt(x2, y2, z2);
  }
  function cloud(x, y, z, colorHex, grow, life, opacity, flat) {
    const c = cloudPool.find((q) => !q.alive) || cloudPool[0];
    c.alive = true; c.life = 0; c.maxLife = life; c.grow = grow;
    c.mesh.visible = true;
    const col = new THREE.Color(colorHex);
    c.r = col.r; c.g = col.g; c.b = col.b;
    c.mesh.material.color.copy(col);
    c.mesh.material.opacity = opacity;
    c.flat = !!flat;
    c.mesh.position.set(x, flat ? y : y + 1, z);
    c.mesh.scale.setScalar(flat ? grow : grow * 0.5);
  }

  /* ------------------------------------------------------------ */
  /* Composite events. */
  function burst(x, y, z, colorHex, n, speed, life, size, opts) {
    const o = opts || {};
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      const s = speed * (0.35 + Math.random() * 0.85);
      spawnSpark(x, y, z,
        Math.sin(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s * 0.75 + 0.5, Math.cos(a) * Math.cos(b) * s,
        life * (0.5 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), col,
        o.gravity === undefined ? 5.5 : o.gravity);
    }
  }

  function explosion(x, y, z, paletteKey, scale) {
    const pal = Paint.palette(paletteKey);
    const s = scale || 1;
    burst(x, y, z, pal.light, Math.floor(26 * s), 9 * s, 0.55, 0.34, {});
    burst(x, y, z, pal.spark, Math.floor(14 * s), 6 * s, 0.7, 0.5, {});
    for (let i = 0; i < 12 * s; i++) {
      spawnSmoke(x + (Math.random() - 0.5) * s, y + 0.4, z + (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * 2, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2,
        0.9 + Math.random() * 0.8, 1.1 + Math.random() * 1.1, { r: 0.2, g: 0.15, b: 0.22 }, 2.4);
    }
    ring(x, y + 0.2, z, new THREE.Color(pal.light).getHex(), 3.6 * s, 0.45);
    ring(x, y + 0.2, z, new THREE.Color(pal.spark).getHex(), 2.2 * s, 0.7);
  }

  function deathBurst(x, y, z, paletteKey, scale) {
    const pal = Paint.palette(paletteKey);
    const s = scale || 1;
    for (let i = 0; i < 10; i++) spawnShard(x, y, z, paletteKey, 5.5 * s);
    burst(x, y, z, pal.light, Math.floor(12 * s), 5 * s, 0.4, 0.3, {});
    ring(x, y + 0.1, z, new THREE.Color(pal.light).getHex(), 1.6 * s, 0.35);
  }

  function hit(x, y, z, element) {
    const meta = Data.ELEMENT_META[element] || Data.ELEMENT_META.kinetic;
    const col = new THREE.Color(meta.color);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnSpark(x, y, z, Math.sin(a) * 3.4, 1.6 + Math.random() * 2, Math.cos(a) * 3.4,
        0.22 + Math.random() * 0.18, 0.16, col, 4.2);
    }
  }

  function muzzle(x, y, z, dirX, dirZ, colorHex, scale) {
    const col = new THREE.Color(colorHex || '#ffffff');
    const s = scale || 1;
    for (let i = 0; i < 7; i++) {
      const spread = 0.55;
      spawnSpark(x, y, z,
        dirX * (4 + Math.random() * 5) + (Math.random() - 0.5) * spread * 4,
        (Math.random() - 0.5) * 2.4,
        dirZ * (4 + Math.random() * 5) + (Math.random() - 0.5) * spread * 4,
        0.1 + Math.random() * 0.1, 0.5 * s, col, 0);
    }
  }

  /* Chain lightning through an array of {x,y,z}. Segments drawn as beams. */
  function chain(points, colorHex) {
    const col = new THREE.Color(colorHex || '#a5b4fc');
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      beam(a.x, a.y, a.z, b.x, b.y, b.z, col.getHex(), 0.05, 0.16);
      burst(a.x, a.y, a.z, col.getHexString ? '#' + col.getHexString() : '#a5b4fc', 2, 1.6, 0.2, 0.18, { gravity: 0 });
    }
  }

  function reactionBurst(x, y, z, reactionName) {
    const colors = {
      PLASMA: '#fda4af', SUPERCONDUCT: '#7dd3fc', CATALYSE: '#a3e635', THERMAL_SHOCK: '#fdba74',
      IMMOLATE: '#f97316', PARALYSIS: '#bae6fd', COLLAPSE: '#c084fc', ENTROPY: '#94a3b8',
      RUPTURE: '#c4b5fd', BLIGHT: '#4ade80'
    };
    const col = colors[reactionName] || '#ffffff';
    burst(x, y, z, col, 22, 8, 0.6, 0.4, {});
    ring(x, y + 0.2, z, new THREE.Color(col).getHex(), 3.2, 0.55);
    callout(x, y + 2.6, z, reactionName, col, 1.5);
  }

  /* ------------------------------------------------------------ */
  /* 2D overlay: damage numbers + callouts. */
  function toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * overlay.width,
      y: (-v.y * 0.5 + 0.5) * overlay.height,
      behind: v.z > 1
    };
  }

  function num(x, y, z, text, colorHex, size) {
    if (numbers.length > 70) numbers.shift();
    numbers.push({ x, y, z, text, color: colorHex, size: size || 16, t: 0, life: 0.8, crit: size > 19 });
  }

  function callout(x, y, z, text, colorHex, sizeMul) {
    callouts.push({ x, y, z, text, color: colorHex, t: 0, life: 1.1, sizeMul: sizeMul || 1 });
  }

  function renderOverlay(dt) {
    if (!octx) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.t += dt;
      if (n.t >= n.life) { numbers.splice(i, 1); continue; }
      const s = toScreen(n.x, n.y + n.t * 2.2, n.z);
      if (s.behind) continue;
      const k = n.t / n.life;
      octx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      const scale = n.crit ? 1 + Math.max(0, 0.35 - n.t * 2) : 1;
      octx.font = `700 ${Math.round(n.size * scale)}px "Segoe UI", system-ui, sans-serif`;
      octx.shadowColor = n.color;
      octx.shadowBlur = 8;
      octx.fillStyle = n.color;
      octx.fillText(n.text, s.x, s.y);
      octx.shadowBlur = 0;
    }
    for (let i = callouts.length - 1; i >= 0; i--) {
      const c = callouts[i];
      c.t += dt;
      if (c.t >= c.life) { callouts.splice(i, 1); continue; }
      const s = toScreen(c.x, c.y, c.z);
      if (s.behind) continue;
      const k = c.t / c.life;
      const scale = k < 0.18 ? 0.6 + (k / 0.18) * 0.55 : 1.15 - (k - 0.18) * 0.18;
      octx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      octx.font = `800 ${Math.round(26 * scale * c.sizeMul)}px "Segoe UI", system-ui, sans-serif`;
      octx.shadowColor = c.color;
      octx.shadowBlur = 16;
      octx.fillStyle = c.color;
      octx.fillText(c.text, s.x, s.y);
      octx.shadowBlur = 0;
    }
    octx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ */
  function hitStop(seconds) {
    if (window.Game) Game.hitStop = Math.max(Game.hitStop || 0, seconds);
  }
  function shake(amount) {
    if (window.Game) Game.shake = Math.min(1.4, (Game.shake || 0) + amount);
  }

  /* ------------------------------------------------------------ */
  function update(dt) {
    /* Sparks. */
    let pos = sparkPts.geometry.attributes.position.array;
    let col = sparkPts.geometry.attributes.color.array;
    let n = 0;
    for (const p of sparkPool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      p.vy -= p.gravity * dt;
      p.vx *= p.drag; p.vz *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < Terrain.heightAt(p.x, p.z) + 0.06 && p.gravity) { p.alive = false; continue; }
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r; col[n * 3 + 1] = p.g; col[n * 3 + 2] = p.b;
      n++;
    }
    sparkPts.geometry.setDrawRange(0, n);
    sparkPts.geometry.attributes.position.needsUpdate = true;
    sparkPts.geometry.attributes.color.needsUpdate = true;

    /* Smoke. */
    pos = smokePts.geometry.attributes.position.array;
    col = smokePts.geometry.attributes.color.array;
    n = 0;
    for (const p of smokePool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.life / p.maxLife;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      const fade = 1 - k;
      col[n * 3] = p.r * fade + 0.05; col[n * 3 + 1] = p.g * fade + 0.04; col[n * 3 + 2] = p.b * fade + 0.08;
      n++;
    }
    smokePts.geometry.setDrawRange(0, n);
    smokePts.geometry.attributes.position.needsUpdate = true;
    smokePts.geometry.attributes.color.needsUpdate = true;

    /* Shards. */
    for (const s of shardPool) {
      if (!s.alive) continue;
      s.life += dt;
      if (s.life >= s.maxLife) { s.alive = false; s.mesh.visible = false; continue; }
      s.vy -= 16 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += s.spin * dt;
      s.mesh.rotation.z += s.spin * 0.7 * dt;
      if (s.mesh.position.y < Terrain.heightAt(s.mesh.position.x, s.mesh.position.z) + 0.04) {
        s.alive = false; s.mesh.visible = false;
      }
    }

    /* Rings. */
    for (const r of ringPool) {
      if (!r.alive) continue;
      r.life += dt;
      if (r.life >= r.maxLife) { r.alive = false; r.mesh.visible = false; continue; }
      const k = r.life / r.maxLife;
      r.mesh.scale.setScalar(0.3 + k * r.grow);
      r.mesh.material.opacity = 0.9 * (1 - k);
      r.mesh.position.y = r.y + k * 0.8;
    }

    /* Beams. */
    for (const b of beamPool) {
      if (!b.alive) continue;
      b.life += dt;
      if (b.life >= b.maxLife) { b.alive = false; b.mesh.visible = false; continue; }
      b.mesh.material.opacity = 0.9 * (1 - b.life / b.maxLife);
    }

    /* Clouds. */
    for (const c of cloudPool) {
      if (!c.alive) continue;
      c.life += dt;
      if (c.life >= c.maxLife) { c.alive = false; c.mesh.visible = false; continue; }
      const k = c.life / c.maxLife;
      c.mesh.scale.setScalar((c.flat ? c.grow : c.grow * 0.5) * (0.6 + k));
      c.mesh.material.opacity = (c.mesh.material.opacity || 0.5) * (1 - k / 2) * (1 / (1 + k * 0.5));
      c.mesh.material.opacity = Math.min(0.5, c.mesh.material.opacity);
      c.mesh.position.y += (c.flat ? 0 : 0.35) * dt;
    }
  }

  function resize(w, h) {
    if (!overlay) return;
    overlay.width = w; overlay.height = h;
  }

  FX.init = init;
  FX.update = update;
  FX.renderOverlay = renderOverlay;
  FX.resize = resize;
  FX.burst = burst;
  FX.explosion = explosion;
  FX.deathBurst = deathBurst;
  FX.hit = hit;
  FX.muzzle = muzzle;
  FX.chain = chain;
  FX.ring = ring;
  FX.beam = beam;
  FX.cloud = cloud;
  FX.reactionBurst = reactionBurst;
  FX.num = num;
  FX.callout = callout;
  FX.hitStop = hitStop;
  FX.shake = shake;

  window.FX = FX;
})();
