/* lowpoly/js/terrain.js — the battlefield. One authored map, THE CROSSROADS:
   a winding lane from the spawn portal to the core, dune heightfield, painted
   ground (the wet-oil treatment at terrain scale), crystals and rocks.

   Exposes window.Terrain with heightAt, buildable, pathDist and the path
   sampler so units and towers share one definition of the lane. */
(function () {
  'use strict';

  const T = {};

  /* Lane waypoints (world metres). The path is the S-curve crossing the field
     twice, so both sides of the board hold buildable ground. */
  const WAYPOINTS = [
    [-45, -11], [-28, -11], [-18, -5], [-16, 3], [-8, 9], [0, 10],
    [8, 6], [6, -2], [8, -10], [22, -10], [32, -4], [45, 3]
  ];

  /* --- heightfield -------------------------------------------------- */
  function baseHeight(x, z) {
    let h = 2.3 * Math.sin(x * 0.075 + 1.7) * Math.cos(z * 0.105 + 0.4);
    h += 1.15 * Math.sin(x * 0.21 + z * 0.17);
    h += 0.5 * Math.sin(z * 0.055 + 2.0);
    h += 0.35 * Math.sin((x + z) * 0.31);
    return h;
  }

  function heightAt(x, z) {
    const d = T.pathDist(x, z);
    const blend = Math.min(1, Math.max(0, (d - 1.6) / 7.0));
    return baseHeight(x, z) * blend + 0.35 * (1 - blend);
  }

  /* --- path sampler -------------------------------------------------- */
  let _segs = [];
  function buildSegs() {
    _segs = [];
    let total = 0;
    const lens = [];
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const [ax, az] = WAYPOINTS[i], [bx, bz] = WAYPOINTS[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      lens.push(l); total += l;
    }
    T.pathTotal = total;
    let acc = 0;
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      _segs.push({ a: WAYPOINTS[i], b: WAYPOINTS[i + 1], len: lens[i], start: acc / total, end: (acc + lens[i]) / total });
      acc += lens[i];
    }
  }

  /* t in [0,1] along the lane. Returns world pos with terrain height. */
  function posAt(t) {
    t = Math.max(0, Math.min(0.99999, t));
    let seg = _segs[0];
    for (const s of _segs) { if (t <= s.end) { seg = s; break; } }
    const lt = (t - seg.start) / (seg.end - seg.start);
    const x = seg.a[0] + (seg.b[0] - seg.a[0]) * lt;
    const z = seg.a[1] + (seg.b[1] - seg.a[1]) * lt;
    const dx = seg.b[0] - seg.a[0], dz = seg.b[1] - seg.a[1];
    const len = Math.hypot(dx, dz) || 1;
    return { x, z, y: heightAt(x, z), heading: Math.atan2(dx, dz), nx: -dz / len, nz: dx / len };
  }

  function pathDist(x, z) {
    let best = Infinity;
    for (const s of _segs) {
      const [ax, az] = s.a, [bx, bz] = s.b;
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) best = d;
    }
    return best;
  }

  /* Can a tower footprint of radius r sit at (x,z)? */
  function buildable(x, z, r) {
    const W = Data.WORLD;
    if (Math.abs(x) > W.w / 2 - 2 || Math.abs(z) > W.h / 2 - 2) return false;
    if (pathDist(x, z) < Data.WORLD.pathHalfWidth + r - 0.1) return false;
    const dCore = Math.hypot(x - 45, z - 3);
    const dPortal = Math.hypot(x + 45, z + 11);
    if (dCore < 5.5 || dPortal < 5.5) return false;
    return true;
  }

  /* --- painted ground texture ---------------------------------------- */
  function groundTexture() {
    const W = Data.WORLD.w * 10, H = Data.WORLD.h * 10;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const R = Util.mulberry32(1337);

    /* Painterly ground base. */
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#241a3a');
    grad.addColorStop(0.5, '#171226');
    grad.addColorStop(1, '#1b1330');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 900; i++) {
      const x = R() * W, y = R() * H, r = 18 + R() * 90;
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      const pick = ['#3f2d4d', '#2b1d3a', '#6d5486', '#4a3560'][R() * 4 | 0];
      g.addColorStop(0, Paint.css(pick, 0.10 + R() * 0.10));
      g.addColorStop(1, Paint.css(pick, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    /* Brush streaks. */
    for (let i = 0; i < 260; i++) {
      const x = R() * W, y = R() * H, len = 40 + R() * 200, w = 6 + R() * 26;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(R() * Math.PI);
      const gg = ctx.createLinearGradient(0, 0, len, 0);
      gg.addColorStop(0, Paint.css('#6d5486', 0));
      gg.addColorStop(0.5, Paint.css(R() < 0.5 ? '#6d5486' : '#3f2d4d', 0.08 + R() * 0.08));
      gg.addColorStop(1, Paint.css('#6d5486', 0));
      ctx.fillStyle = gg;
      ctx.fillRect(0, -w / 2, len, w);
      ctx.restore();
    }

    /* The lane, painted. */
    const mapPt = ([wx, wz]) => [(wx + Data.WORLD.w / 2) * 10, (wz + Data.WORLD.h / 2) * 10];
    const path = WAYPOINTS.map(mapPt);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#100c1c';
    ctx.lineWidth = (Data.WORLD.pathHalfWidth * 2 + 0.9) * 10;
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.strokeStyle = '#2a2438';
    ctx.lineWidth = Data.WORLD.pathHalfWidth * 2 * 10;
    ctx.stroke();
    /* Lane brushwork + centre line. */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#4a4160';
    ctx.lineWidth = 7;
    ctx.setLineDash([26, 34]);
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 130; i++) {
      const t = R();
      const p = posAt(t);
      const x = (p.x + Data.WORLD.w / 2) * 10 + (R() - 0.5) * 44;
      const y = (p.z + Data.WORLD.h / 2) * 10 + (R() - 0.5) * 44;
      ctx.fillStyle = Paint.css(R() < 0.5 ? '#4a4160' : '#8b7fb5', 0.12 + R() * 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + R() * 16, 3 + R() * 10, R() * 3.14, 0, 6.283);
      ctx.fill();
    }

    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  /* --- decoration builders ------------------------------------------- */
  function rock(rng, x, z, s) {
    const geo = new THREE.IcosahedronGeometry(s, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const f = 0.78 + (rng() + rng()) * 0.22;
      v.multiplyScalar(f);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = Paint.mat('stone', 900 + Math.floor(rng() * 600), {});
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, heightAt(x, z) - s * 0.25, z);
    mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    mesh.scale.set(1, 0.72, 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function crystal(rng, x, z, s, paletteKey) {
    const geo = new THREE.ConeGeometry(s * 0.28, s, 5);
    const m = Paint.mat(paletteKey, 2000 + Math.floor(rng() * 500), { emissive: 0.55 });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, heightAt(x, z) + s * 0.32, z);
    mesh.rotation.set((rng() - 0.5) * 0.5, rng() * 3, (rng() - 0.5) * 0.5);
    mesh.castShadow = true;
    return mesh;
  }

  function tuft(rng, x, z) {
    const s = 0.3 + rng() * 0.5;
    const geo = new THREE.ConeGeometry(s * 0.35, s, 4);
    const m = Paint.mat('moss', 3000 + Math.floor(rng() * 400), {});
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, heightAt(x, z) + s * 0.4, z);
    mesh.castShadow = false;
    return mesh;
  }

  /* --- sky ------------------------------------------------------------ */
  function buildSky(scene) {
    const geo = new THREE.SphereGeometry(340, 24, 16);
    const m = new THREE.MeshBasicMaterial({ map: Paint.sky(), side: THREE.BackSide, fog: false, depthWrite: false });
    const dome = new THREE.Mesh(geo, m);
    dome.position.y = -40;
    scene.add(dome);

    const hemi = new THREE.HemisphereLight(0x8f7bd8, 0x0a0e17, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffd9f2, 1.05);
    sun.position.set(38, 60, -24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 8; sun.shadow.camera.far = 190;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    return { sun, hemi };
  }

  /* --- landmarks ------------------------------------------------------- */
  function buildPortal(scene, factionColor) {
    const g = new THREE.Group();
    g.position.set(-46.5, heightAt(-46.5, -11.5), -11.5);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.34, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.6, metalness: 0.3, emissive: new THREE.Color(factionColor), emissiveIntensity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(3.0, 40),
      new THREE.MeshBasicMaterial({ color: factionColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.06;
    g.add(disc);
    for (let i = 0; i < 4; i++) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 }));
      const a = (i / 4) * Math.PI * 2;
      pil.position.set(Math.cos(a) * 4.4, 1.3, Math.sin(a) * 4.4);
      pil.castShadow = true;
      g.add(pil);
    }
    scene.add(g);
    T.portal = g;
    return g;
  }

  function buildCore(scene, factionColor) {
    const g = new THREE.Group();
    g.position.set(46.5, heightAt(46.5, 2.5) + 1.1, 2.5);
    const heart = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(factionColor), emissiveIntensity: 1.1, flatShading: true })
    );
    heart.castShadow = true;
    g.add(heart);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.16, 8, 48),
      new THREE.MeshBasicMaterial({ color: factionColor, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2.4;
    g.add(ring);
    const ring2 = ring.clone();
    ring2.scale.setScalar(1.5);
    ring2.material = ring.material.clone();
    ring2.material.opacity = 0.35;
    g.add(ring2);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 20, 12),
      new THREE.MeshBasicMaterial({ color: factionColor, transparent: true, opacity: 0.09, depthWrite: false })
    );
    dome.position.y = 1.6;
    g.add(dome);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.2, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.55, flatShading: true })
    );
    base.position.y = -1.1;
    base.castShadow = true;
    g.add(base);
    scene.add(g);
    T.core = g;
    return g;
  }

  /* --- entry ----------------------------------------------------------- */
  T.build = function (scene, opts) {
    const o = opts || {};
    const rng = Util.mulberry32(o.seed || 12345);
    buildSegs();

    /* Ground. */
    const gw = Data.WORLD.w, gh = Data.WORLD.h;
    const geo = new THREE.PlaneGeometry(gw, gh, 72, 44);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: groundTexture(), flatShading: true, roughness: 0.94, metalness: 0.02
    }));
    ground.receiveShadow = true;
    scene.add(ground);
    T.ground = ground;

    buildSky(scene);
    scene.fog = new THREE.FogExp2(0x140e24, 0.0062);

    /* Dressing, seeded but away from the lane. */
    const rocks = new THREE.Group();
    for (let i = 0; i < 34; i++) {
      const x = (rng() - 0.5) * (gw - 6), z = (rng() - 0.5) * (gh - 6);
      if (T.pathDist(x, z) < 5.5) continue;
      rocks.add(rock(rng, x, z, 0.7 + rng() * 1.8));
    }
    scene.add(rocks);

    const crystals = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const x = (rng() - 0.5) * (gw - 4), z = (rng() - 0.5) * (gh - 4);
      if (T.pathDist(x, z) < 6.5) continue;
      const pal = ['human', 'xeno', 'light'][rng() * 3 | 0];
      crystals.add(crystal(rng, x, z, 1.4 + rng() * 2.2, pal));
    }
    scene.add(crystals);

    const tufts = new THREE.Group();
    for (let i = 0; i < 80; i++) {
      const x = (rng() - 0.5) * (gw - 3), z = (rng() - 0.5) * (gh - 3);
      if (T.pathDist(x, z) < 3.4) continue;
      tufts.add(tuft(rng, x, z));
    }
    scene.add(tufts);

    buildPortal(scene, o.color || '#38e8ff');
    buildCore(scene, o.color || '#38e8ff');
  };

  T.posAt = posAt;
  T.pathDist = pathDist;
  T.heightAt = heightAt;
  T.buildable = buildable;

  window.Terrain = T;
})();
