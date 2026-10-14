/* aegis-3d/js/units.js — enemy units. Low-poly bodies built from primitives,
   animated procedurally (leg swing, hover bob, stomp, phase states), walking a
   single shared lane. Statuses, marks, reactions, shields, healing, summoning,
   splits and the two boss phase scripts all live here.

   Enemies are Groups of shared-geometry meshes; materials are cached by
   (palette, seed) in paint.js so fifty of a kind share one material. */
(function () {
  'use strict';

  const U = { list: [] };

  let idSeq = 0;

  function geoBox(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function geoCyl(r1, r2, h, seg) { return new THREE.CylinderGeometry(r1, r2, h, seg || 6); }

  function part(parent, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function matFor(def, seed) {
    return Paint.mat(def.palette || 'chrome', seed, {});
  }
  function matEmissive(paletteKey, seed, strength) {
    return Paint.mat(paletteKey, seed, { emissive: strength });
  }

  /* ------------------------------------------------------------ */
  /* Body builders. Each returns { group, parts, kind }.            */
  const BUILDERS = {};

  function walkerBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(1.1, 0.7, 1.5), M, 0, 0.95, 0);
    part(g, geoBox(0.6, 0.5, 0.6), M, 0, 1.55, 0.15);
    const eye = part(g, geoBox(0.24, 0.1, 0.1), matEmissive(def.palette, seed + 9, 1.4), 0.14, 1.6, 0.48);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      const lx = (i % 2 === 0 ? -1 : 1) * 0.42;
      const lz = (i < 2 ? -1 : 1) * 0.5;
      legs.push(part(g, geoBox(0.16, 0.85, 0.16), M, lx, 0.45, lz));
    }
    return { group: g, parts: { legs, eye }, kind: 'walker' };
  }

  function runnerBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    const hull = part(g, new THREE.ConeGeometry(0.55, 1.4, 4), M, 0, 0.9, 0);
    hull.rotation.x = Math.PI / 2;
    const eye = part(g, geoBox(0.16, 0.08, 0.08), matEmissive(def.palette, seed + 9, 1.5), 0, 1.0, 0.56);
    const legs = [];
    for (let i = 0; i < 2; i++) {
      legs.push(part(g, geoBox(0.14, 1.05, 0.14), M, (i === 0 ? -1 : 1) * 0.2, 0.42, 0));
    }
    return { group: g, parts: { legs, eye }, kind: 'runner' };
  }

  function hoverBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    const body = part(g, new THREE.IcosahedronGeometry(0.75, 0), M, 0, 1.0, 0);
    const core = part(g, geoBox(0.3, 0.3, 0.3), matEmissive(def.palette, seed + 9, 1.8), 0, 1.0, 0);
    const fin = part(g, geoBox(0.1, 0.5, 0.9), M, 0, 1.35, -0.35);
    return { group: g, parts: { body, core, fin }, kind: 'hover' };
  }

  function lanternBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    const body = part(g, new THREE.OctahedronGeometry(0.7, 0), M, 0, 1.0, 0);
    const core = part(g, new THREE.SphereGeometry(0.3, 8, 6), matEmissive(def.palette, seed + 9, 2.2), 0, 1.0, 0);
    const halo = part(g, new THREE.TorusGeometry(0.85, 0.06, 6, 20), matEmissive(def.palette, seed + 9, 1.6), 0, 1.0, 0);
    halo.rotation.x = Math.PI / 2;
    return { group: g, parts: { body, core, halo }, kind: 'lantern' };
  }

  function aegisBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(0.9, 1.0, 0.9), M, 0, 1.1, 0);
    part(g, geoBox(1.05, 1.35, 0.22), matFor({ palette: 'metal' }, seed + 3), 0, 1.15, 0.55);
    const eye = part(g, geoBox(0.28, 0.09, 0.09), matEmissive(def.palette, seed + 9, 1.6), 0, 1.35, 0.5);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      legs.push(part(g, geoBox(0.18, 0.6, 0.18), M, (i % 2 === 0 ? -1 : 1) * 0.3, 0.35, (i < 2 ? -1 : 1) * 0.3));
    }
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.16, depthWrite: false }));
    bubble.position.y = 1.1;
    bubble.visible = false;
    g.add(bubble);
    return { group: g, parts: { legs, eye, bubble }, kind: 'walker' };
  }

  function menderBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(0.9, 0.8, 0.9), M, 0, 0.95, 0);
    part(g, geoBox(0.5, 0.14, 0.14), matEmissive('moss', seed + 9, 1.5), 0, 1.62, 0);
    part(g, geoBox(0.14, 0.5, 0.14), matEmissive('moss', seed + 9, 1.5), 0, 1.62, 0);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      legs.push(part(g, geoBox(0.16, 0.7, 0.16), M, (i % 2 === 0 ? -1 : 1) * 0.34, 0.4, (i < 2 ? -1 : 1) * 0.34));
    }
    return { group: g, parts: { legs }, kind: 'walker' };
  }

  function blobBody(def, seed, count, size) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    const parts = { blobs: [] };
    for (let i = 0; i < count; i++) {
      const b = part(g, new THREE.IcosahedronGeometry(size * (0.8 + (i % 2) * 0.25), 0), M,
        (i - (count - 1) / 2) * size * 0.8, 0.8 + (i % 2) * 0.2, 0);
      parts.blobs.push(b);
    }
    parts.eye = part(g, new THREE.SphereGeometry(size * 0.16, 6, 5), matEmissive(def.palette, seed + 9, 2.0), 0, size * 0.9, size * 0.9);
    return { group: g, parts, kind: 'blob' };
  }

  function wardenBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(1.2, 1.3, 1.0), M, 0, 1.4, 0);
    part(g, geoBox(1.7, 0.5, 0.6), M, 0, 2.0, 0);
    part(g, geoBox(0.8, 1.6, 0.24), matFor({ palette: 'metal' }, seed + 3), -0.85, 1.5, 0.5);
    const visor = part(g, geoBox(0.7, 0.16, 0.08), matEmissive(def.palette, seed + 9, 1.7), 0, 1.75, 0.55);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      legs.push(part(g, geoBox(0.26, 1.0, 0.26), M, (i % 2 === 0 ? -1 : 1) * 0.4, 0.5, (i < 2 ? -1 : 1) * 0.35));
    }
    return { group: g, parts: { legs, visor }, kind: 'walker' };
  }

  function jugBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(1.5, 1.2, 1.9), M, 0, 1.35, 0);
    part(g, geoBox(1.7, 0.7, 2.0), matFor({ palette: 'metal' }, seed + 3), 0, 1.85, 0);
    const slit = part(g, geoBox(1.0, 0.12, 0.08), matEmissive(def.palette, seed + 9, 1.6), 0, 1.6, 1.05);
    const stubs = [];
    for (let i = 0; i < 6; i++) {
      stubs.push(part(g, geoBox(0.3, 0.6, 0.3), M, (i % 3 - 1) * 0.55, 0.42, (i < 3 ? -1 : 1) * 0.75));
    }
    return { group: g, parts: { stubs, slit }, kind: 'stomper' };
  }

  function carrierBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(1.6, 1.0, 2.1), M, 0, 1.2, 0);
    const mouth = part(g, geoBox(0.7, 0.4, 0.3), matEmissive('ember', seed + 9, 1.4), 0, 1.2, 1.15);
    part(g, geoBox(1.2, 0.5, 0.8), matFor({ palette: 'metal' }, seed + 3), 0, 1.8, 0);
    const stubs = [];
    for (let i = 0; i < 6; i++) {
      stubs.push(part(g, geoBox(0.26, 0.55, 0.26), M, (i % 3 - 1) * 0.6, 0.45, (i < 3 ? -1 : 1) * 0.85));
    }
    return { group: g, parts: { stubs, mouth }, kind: 'stomper' };
  }

  function miteBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(0.5, 0.35, 0.5), M, 0, 0.5, 0);
    const eye = part(g, geoBox(0.1, 0.06, 0.06), matEmissive(def.palette, seed + 9, 1.8), 0, 0.55, 0.26);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      legs.push(part(g, geoBox(0.06, 0.4, 0.06), M, (i % 2 === 0 ? -1 : 1) * 0.18, 0.24, (i < 2 ? -1 : 1) * 0.18));
    }
    return { group: g, parts: { legs, eye }, kind: 'runner' };
  }

  function colossusBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    part(g, geoBox(1.9, 1.6, 2.3), M, 0, 1.7, 0);
    part(g, geoBox(2.1, 1.0, 2.5), matFor({ palette: 'metal' }, seed + 3), 0, 2.4, 0);
    const slit = part(g, geoBox(1.2, 0.16, 0.1), matEmissive(def.palette, seed + 9, 1.8), 0, 2.0, 1.3);
    const gun = part(g, geoCyl(0.3, 0.42, 1.8, 6), matFor({ palette: 'metal' }, seed + 7), 1.35, 2.3, 0);
    gun.rotation.z = -Math.PI / 2.4;
    const stubs = [];
    for (let i = 0; i < 6; i++) {
      stubs.push(part(g, geoBox(0.4, 0.8, 0.4), M, (i % 3 - 1) * 0.7, 0.55, (i < 3 ? -1 : 1) * 0.9));
    }
    return { group: g, parts: { stubs, slit, gun }, kind: 'stomper' };
  }

  function harbingerBody(def, seed) {
    const g = new THREE.Group();
    const M = matFor(def, seed);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      legs.push(part(g, geoBox(0.55, 1.9, 0.55), M, (i % 2 === 0 ? -1 : 1) * 0.7, 1.0, (i < 2 ? -1 : 1) * 0.7));
    }
    part(g, geoBox(2.3, 1.8, 2.0), M, 0, 2.9, 0);
    part(g, geoBox(2.5, 1.1, 2.2), matFor({ palette: 'metal' }, seed + 3), 0, 3.7, 0);
    const core = part(g, new THREE.SphereGeometry(0.5, 8, 6), matEmissive('pirate', seed + 9, 2.6), 0, 3.1, 1.1);
    for (let i = 0; i < 2; i++) {
      const h = part(g, new THREE.ConeGeometry(0.3, 1.2, 5), M, (i === 0 ? -1 : 1) * 0.8, 4.9, 0.2);
      h.rotation.z = (i === 0 ? 1 : -1) * 0.5;
    }
    const arms = [];
    for (let i = 0; i < 2; i++) {
      arms.push(part(g, geoBox(0.5, 1.5, 0.5), M, (i === 0 ? -1 : 1) * 1.6, 2.9, 0));
    }
    return { group: g, parts: { legs, core, arms }, kind: 'boss' };
  }

  BUILDERS.crawler = (d, s) => walkerBody(d, s);
  BUILDERS.shardling = (d, s) => hoverBody(d, s);
  BUILDERS.sprinter = (d, s) => runnerBody(d, s);
  BUILDERS.wisp = (d, s) => lanternBody(d, s);
  BUILDERS.aegis = (d, s) => aegisBody(d, s);
  BUILDERS.mender = (d, s) => menderBody(d, s);
  BUILDERS.cluster = (d, s) => blobBody(d, s, 3, 0.62);
  BUILDERS.spawnling = (d, s) => blobBody(d, s, 2, 0.4);
  BUILDERS.warden = (d, s) => wardenBody(d, s);
  BUILDERS.juggernaut = (d, s) => jugBody(d, s);
  BUILDERS.carrier = (d, s) => carrierBody(d, s);
  BUILDERS.mite = (d, s) => miteBody(d, s);
  BUILDERS.mb_colossus = (d, s) => colossusBody(d, s);
  BUILDERS.harbinger = (d, s) => harbingerBody(d, s);

  /* ------------------------------------------------------------ */
  class Enemy {
    constructor(defId, wave, difficulty, seed) {
      this.def = Data.ENEMIES[defId];
      this.id = ++idSeq;
      this.pathT = 0;
      this.hpMul = Data.waveHpMultiplier(wave) * difficulty.hp;
      this.maxHp = Math.round(this.def.hp * this.hpMul);
      this.hp = this.maxHp;
      this.armor = this.def.armor;
      this.shield = this.def.shield || 0;
      this.shieldMax = this.def.shield || 0;
      this.shieldDownT = this.def.shield ? -this.def.shieldDelay : 0;
      this.speed = this.def.speed;
      this.bounty = this.def.bounty;
      this.dead = false;
      this.reached = false;
      this.slow = 0; this.slowT = 0;
      this.freezeT = 0;
      this.burn = 0; this.burnT = 0; this.burnDps = 0;
      this.venomStacks = [];         // {dps, t}
      this.shred = 0;
      this.takenMulT = 0;            // RAVENOUS window
      this.mark = null;
      this.dist = 0;
      this.pullResist = 0;           // anti-stall: displacement saturates
      this.summonT = this.def.summon ? 2.0 : 0;
      this.summoned = 0;
      this.spawn = this.def.summon || null;
      this.phaseIdx = 0;
      this.damageTaken = 0;
      this.healed = 0;            // HP restored — read by the QA harness

      const seedBase = Util.hashStr(defId + seed) % 100000;
      const built = BUILDERS[defId](this.def, seedBase);
      this.group = built.group;
      this.parts = built.parts;
      this.kind = built.kind;
      this.scale = this.def.scale || 1;
      this.group.scale.setScalar(this.scale);

      /* Mark ring + glyph: shown while a mark is active. */
      this.markRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.07, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
      );
      this.markRing.rotation.x = Math.PI / 2;
      this.markRing.position.y = 0.12;
      this.group.add(this.markRing);
      this.markGlyph = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ map: Paint.glyph('kinetic'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      this.markGlyph.position.y = 2.2;
      this.markGlyph.renderOrder = 5;
      this.group.add(this.markGlyph);

      /* Freeze shell. */
      this.freezeShell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 1),
        new THREE.MeshBasicMaterial({ color: 0x9adcff, transparent: true, opacity: 0, depthWrite: false })
      );
      this.freezeShell.position.y = 1.3;
      this.freezeShell.visible = false;
      this.group.add(this.freezeShell);

      this.pos = Terrain.posAt(0);
      this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.animPhase = 0;
    }

    get flying() { return !!this.def.flying; }
    get altitude() { return this.flying ? 3.6 : 0; }
    get x() { return this.group.position.x; }
    get z() { return this.group.position.z; }
    get y() { return this.group.position.y; }
    get effSlow() {
      if (this.def.slowImmune || this.freezeT > 0) return this.freezeT > 0 ? 1 : 0;
      let s = this.slow;
      if (this.def.slowResist) s *= (1 - this.def.slowResist);
      if (this.def.slowCap !== undefined && s > this.def.slowCap) s = this.def.slowCap;
      return Math.min(0.92, s);
    }

    move(dt) {
      const spd = this.speed * (1 - this.effSlow);
      this.dist += spd * dt;
      this.pathT = this.dist / Terrain.pathTotal;
      if (this.pathT >= 1) { this.pathT = 1; this.reached = true; return; }
      this.pos = Terrain.posAt(this.pathT);
      this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    }

    /* Displacement along the lane, with anti-stall saturation: repeated pulls
       build resistance (decaying), so a tether can delay a unit but can never
       hold it in place forever — the wave always progresses. */
    pullBack(amount) {
      if (this.def.pullImmune || this.dead) return;
      const scale = Math.max(0.22, 1 - this.pullResist);
      const amt = amount * scale;
      this.dist = Math.max(0, this.dist - amt);
      this.pathT = this.dist / Terrain.pathTotal;
      this.pullResist = Math.min(6, this.pullResist + amt * 1.1);
    }

    orient(dt) {
      /* posAt.heading is atan2(dx, dz): the yaw that turns a +z-facing body
         toward the direction of travel. */
      this.group.rotation.y = Util.damp(this.group.rotation.y, this.pos.heading, 10, dt);
    }

    animate(dt, time) {
      const p = this.parts;
      const k = this.kind;
      const spd = this.speed * (1 - this.effSlow);
      this.animPhase += dt * spd * 2.2;

      if (k === 'walker' || k === 'runner') {
        const amp = k === 'runner' ? 0.85 : 0.55;
        const freq = k === 'runner' ? 1.7 : 1.15;
        p.legs.forEach((l, i) => {
          l.rotation.x = Math.sin(this.animPhase * freq + (i % 2) * Math.PI) * amp;
          l.position.y = 0.45 + Math.abs(Math.cos(this.animPhase * freq + (i % 2) * Math.PI)) * 0.08;
        });
        this.group.position.y = this.pos.y + this.altitude + Math.abs(Math.sin(this.animPhase * freq)) * 0.12;
        this.group.rotation.z = Math.sin(this.animPhase * freq) * 0.02;
      } else if (k === 'hover') {
        this.group.position.y = this.pos.y + this.altitude + 0.75 + Math.sin(time * 2.4 + this.id) * 0.16;
        p.body.rotation.y += dt * 1.2;
        p.body.rotation.x = Math.sin(time * 1.7 + this.id) * 0.12;
      } else if (k === 'lantern') {
        this.group.position.y = this.pos.y + this.altitude + Math.sin(time * 2.0 + this.id) * 0.35;
        p.halo.rotation.z += dt * 2.2;
        p.body.rotation.y += dt * 0.8;
      } else if (k === 'blob') {
        this.group.position.y = this.pos.y + this.altitude + Math.abs(Math.sin(time * 3 + this.id)) * 0.1;
        const pulse = 1 + Math.sin(time * 4 + this.id) * 0.08;
        this.group.scale.setScalar(this.scale * pulse);
      } else if (k === 'stomper') {
        const freq = 0.9;
        p.stubs.forEach((s, i) => {
          s.rotation.x = Math.sin(this.animPhase * freq + (i % 3) * 2.1) * 0.4;
        });
        const stomp = Math.cos(this.animPhase * freq);
        this.group.position.y = this.pos.y + this.altitude + Math.max(0, stomp) * 0.16;
        if (stomp > 0.985 && this.scale >= 1.4) {
          FX.burst(this.x, this.y + 0.2, this.z, '#6d5486', 4, 2.2, 0.3, 0.2, { gravity: 0.5 });
          if (this.def.boss || this.def.miniboss) FX.shake(0.06);
        }
      } else if (k === 'boss') {
        const freq = 0.8;
        p.legs.forEach((l, i) => {
          l.rotation.x = Math.sin(this.animPhase * freq + (i % 2) * Math.PI) * 0.45;
        });
        p.arms.forEach((a, i) => {
          a.rotation.x = Math.sin(time * 1.3 + i) * 0.16;
        });
        p.core.scale.setScalar(1 + Math.sin(time * 2.6) * 0.14);
        this.group.position.y = this.pos.y + Math.max(0, Math.cos(this.animPhase * freq)) * 0.2;
        if (Math.cos(this.animPhase * freq) > 0.98) FX.shake(0.09);
      } else {
        this.group.position.y = this.pos.y + this.altitude;
      }
      this.group.rotation.y = Util.damp(this.group.rotation.y, this.pos.heading, 10, dt);

      /* Mark ring + glyph. */
      if (this.mark) {
        this.markRing.material.opacity = Math.min(0.85, this.mark.t / 0.3);
        this.markRing.material.color.set(Data.ELEMENT_META[this.mark.element].color);
        this.markGlyph.material.opacity = Math.min(0.95, this.mark.t / 0.2);
        this.markGlyph.material.map = Paint.glyph(this.mark.element);
        this.markRing.rotation.z += dt * 1.4;
        this.markGlyph.rotation.y += dt * 1.2;
        this.markGlyph.position.y = 2.2 + Math.sin(time * 2.4) * 0.12;
      } else {
        this.markRing.material.opacity = 0;
        this.markGlyph.material.opacity = 0;
      }

      /* Shield bubble. */
      if (this.parts.bubble) {
        const up = this.shield > 0;
        this.parts.bubble.visible = up;
        if (up) {
          this.parts.bubble.material.opacity = 0.10 + 0.14 * (this.shield / this.shieldMax);
          this.parts.bubble.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
        }
      }

      /* Freeze shell. */
      if (this.freezeT > 0) {
        this.freezeShell.visible = true;
        this.freezeShell.material.opacity = Math.min(0.5, this.freezeT * 2);
        this.freezeShell.rotation.y += dt;
      } else {
        this.freezeShell.visible = false;
      }
    }

    update(dt, time) {
      if (this.dead) return;
      if (this.takenMulT > 0) this.takenMulT -= dt;

      /* Status timers. */
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 0; }
      if (this.freezeT > 0) this.freezeT -= dt;
      if (this.pullResist > 0) this.pullResist = Math.max(0, this.pullResist - dt * 1.5);
      if (this.burnT > 0) {
        this.burnT -= dt;
        if (Math.random() < dt * 6) FX.burst(this.x, this.y + 1.2, this.z, '#f97316', 1, 1.2, 0.3, 0.16, { gravity: -0.5 });
      } else { this.burn = 0; this.burnDps = 0; }
      for (let i = this.venomStacks.length - 1; i >= 0; i--) {
        const v = this.venomStacks[i];
        v.t -= dt;
        if (v.t <= 0) this.venomStacks.splice(i, 1);
        else if (Math.random() < dt * 5) FX.burst(this.x, this.y + 1.1, this.z, '#a3e635', 1, 0.9, 0.28, 0.12, { gravity: -1 });
      }
      if (this.mark) {
        this.mark.t -= dt;
        if (this.mark.t <= 0) this.mark = null;
      }

      /* Shield regen. */
      if (this.def.shield) {
        if (this.shield <= 0) this.shieldDownT -= dt;
        if (this.shieldDownT <= 0 && this.shield < this.shieldMax) {
          this.shield = Math.min(this.shieldMax, this.shield + this.def.shieldRegen * dt);
        }
      }

      if (this.reached) { this.animate(dt, time); return; }
      this.move(dt);
      this.orient(dt);
      this.animate(dt, time);

      /* Behaviours. */
      if (this.def.healRate && !this.flying) this.healTick(dt);
      if (this.spawn && !this.flying) this.summonTick(dt);
      if (this.def.boss && this.phaseIdx < this.def.phases.length) {
        const ph = this.def.phases[this.phaseIdx];
        if (this.hp / this.maxHp <= ph.at) {
          this.phaseIdx++;
          this.armor = Math.max(0, this.armor + ph.armorDelta);
          this.speed *= ph.speedMul;
          FX.explosion(this.x, this.y + 1.5, this.z, this.def.palette, 2.0);
          FX.shake(0.5);
          FX.hitStop(0.09);
          Audio.sfx.boss();
          if (Game.ui) Game.ui.banner(ph.msg);
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 1.6 + Math.random() * 1.4;
            FX.burst(this.x + Math.cos(a) * r, this.y + 2.2, this.z + Math.sin(a) * r,
              '#94a3b8', 6, 5, 0.6, 0.3, { gravity: 4 });
          }
        }
      }
    }

    healTick(dt) {
      this.healCd = (this.healCd || 0) - dt;
      if (this.healCd > 0) return;
      this.healCd = 0.9;
      let best = null, bestD = Infinity;
      for (const e of U.list) {
        if (e === this || e.dead || e.flying || e.hp >= e.maxHp) continue;
        const d = Util.dist2(this.x, this.z, e.x, e.z);
        if (d < this.def.healRadius * this.def.healRadius && d < bestD) {
          bestD = d; best = e;
        }
      }
      if (best) {
        const amt = Math.min(best.maxHp - best.hp, this.def.healRate * dt);
        best.hp += amt;
        this.healed += amt;
        if (Math.random() < dt * 3) {
          FX.beam(this.x, this.y + 1.5, this.z, best.x, best.y + 1.2, best.z, 0x4ade80, 0.06, 0.3);
        }
      }
    }

    summonTick(dt) {
      this.summonT -= dt;
      if (this.summonT <= 0 && this.summoned < this.spawn.max) {
        this.summonT = this.spawn.interval;
        this.summoned++;
        const id = this.spawn.type;
        const e = new Enemy(id, Game.wave, Game.difficulty, Game.seed + this.id);
        e.pathT = Math.max(0, this.pathT - 1.5 / Terrain.pathTotal);
        e.dist = e.pathT * Terrain.pathTotal;
        U.list.push(e);
        Game.scene.add(e.group);
        FX.ring(this.x, this.y + 0.4, this.z, 0xf97316, 1.4, 0.5);
        FX.burst(this.x, this.y + 0.8, this.z, '#fda4af', 10, 3.4, 0.5, 0.3, {});
        Audio.sfx.summon(this.x);
      }
    }

    /* ------------------------------------------------------------ */
    takeDamage(raw, element, source, opts) {
      if (this.dead || this.reached) return 0;
      const o = opts || {};
      let dmg = raw;

      /* Armour reduces physical damage only; shred peels it first. */
      if (element === 'kinetic') {
        dmg = Math.max(raw * 0.15, raw - Math.max(0, this.armor - this.shred));
      }
      if (this.def.elemResist && this.def.elemResist[element]) dmg *= (1 - this.def.elemResist[element]);
      if (this.def.elemWeak && this.def.elemWeak[element]) dmg *= (1 + this.def.elemWeak[element]);
      if (this.def.splashResist && o.splash) dmg *= (1 - this.def.splashResist);
      if (this.takenMulT > 0) dmg *= 1.35; // RAVENOUS

      /* Shield absorbs first. */
      let shieldHit = false;
      if (this.shield > 0) {
        shieldHit = true;
        const absorbed = Math.min(this.shield, dmg);
        this.shield -= absorbed;
        dmg -= absorbed;
        this.shieldDownT = -this.def.shieldDelay;
        FX.ring(this.x, this.y + 1.1, this.z, 0x60a5fa, 1.2, 0.3);
        if (Math.random() < 0.4) Audio.sfx.shieldHit(this.x);
      }

      dmg = Math.max(0, dmg);
      this.hp -= dmg;
      this.damageTaken += dmg;
      if (this.def.boss && this.hp > 0 && Math.random() < 0.3) FX.shake(0.04);

      FX.num(this.x, this.y + 2.6, this.z, String(Math.round(dmg)),
        element === 'frost' ? '#7dd3fc' : element === 'fire' ? '#fb923c' : element === 'venom' ? '#a3e635'
          : element === 'void' ? '#c084fc' : element === 'radiant' ? '#fbbf24' : element === 'storm' ? '#a5b4fc' : '#e2e8f0',
        dmg > 60 ? 20 : 15);
      FX.hit(this.x, this.y + 1.2, this.z, element);

      if (shieldHit && dmg <= 0) return 0;

      /* Mark & react. */
      if (!o.noMark && Data.MARKING.indexOf(element) !== -1) this.applyMark(element, dmg, source, o);

      if (this.hp <= 0) this.die(source);
      return dmg;
    }

    applyMark(element, dmg, source, o) {
      const reaction = this.mark && this.mark.element !== element
        ? Data.reactionOf(this.mark.element, element) : null;
      if (reaction) {
        const r = reaction;
        this.mark = null;
        let rdmg = (o.reactionDmg || dmg) * r.mul;
        this.hp -= rdmg;
        this.damageTaken += rdmg;
        if (this.hp <= 0 && !this.dead) { this.die(source); return; }
        FX.reactionBurst(this.x, this.y + 1.4, this.z, r.name);
        Audio.sfx.reaction(r.name.toLowerCase(), this.x);
        Game.stats.reactions[r.name] = (Game.stats.reactions[r.name] || 0) + 1;
        FX.num(this.x, this.y + 3.1, this.z, r.name, Data.ELEMENT_META[element].color, 17);
        FX.hitStop(0.035);
        FX.shake(0.08);

        switch (r.effect) {
          case 'burst': {
            for (const e of U.list) {
              if (e === this || e.dead) continue;
              if (Util.dist2(e.x, e.z, this.x, this.z) < r.radius * r.radius) {
                e.takeDamage(rdmg * 0.6, element, source, { splash: true, noMark: true });
              }
            }
            FX.explosion(this.x, this.y, this.z, element === 'fire' ? 'ember' : element, 1.1);
            break;
          }
          case 'burn':
            this.burn = r.dps * 60 * 0.5; this.burnDps = r.dps * 60; this.burnT = r.dur;
            break;
          case 'freeze':
            this.freezeT = Math.min(this.def.boss || this.def.miniboss ? 0.4 : r.dur, r.dur);
            break;
          case 'slow':
            this.slow = Math.max(this.slow, r.slow); this.slowT = Math.max(this.slowT, r.dur);
            if (r.dot) { this.burn = r.dot * 60; this.burnDps = r.dot * 60; this.burnT = r.dur; }
            break;
          case 'pull': {
            for (const e of U.list) {
              if (e === this || e.dead || e.flying) continue;
              if (Util.dist2(e.x, e.z, this.x, this.z) < r.radius * r.radius) {
                e.pullBack(2.2);
              }
            }
            FX.ring(this.x, this.y, this.z, 0xc084fc, r.radius, 0.6);
            break;
          }
          case 'push':
            this.pullBack(r.push);
            break;
          case 'poison': {
            this.venomStacks.push({ dps: (o.poisonDps || 1.6) * 60 * (r.boost || 1), t: r.dur });
            break;
          }
          case 'spread': {
            for (const e of U.list) {
              if (e === this || e.dead) continue;
              if (Util.dist2(e.x, e.z, this.x, this.z) < r.radius * r.radius) {
                e.venomStacks.push({ dps: (o.poisonDps || 1.4) * 60, t: 2.5 });
              }
            }
            FX.cloud(this.x, this.y, this.z, 0x4ade80, r.radius, 1.0, 0.5, false);
            break;
          }
        }
      } else {
        this.mark = { element, t: 3.5 };
      }
    }

    die(source) {
      if (this.dead) return;
      this.dead = true;
      Game.stats.kills++;
      FX.deathBurst(this.x, this.y + 1.0, this.z, this.def.palette || 'chrome', Math.min(1.8, this.scale));
      Audio.sfx.death(this.x);
      if (this.def.boss) {
        FX.hitStop(0.18); FX.shake(0.8);
        FX.explosion(this.x, this.y + 1.5, this.z, 'pirate', 3.2);
      } else if (this.def.miniboss) {
        FX.hitStop(0.08); FX.shake(0.4);
      }

      /* Splits. */
      if (this.def.splitInto) {
        const n = this.def.splitCount;
        for (let i = 0; i < n; i++) {
          const e = new Enemy(this.def.splitInto, Game.wave, Game.difficulty, Game.seed + this.id + i);
          e.pathT = Math.max(0, this.pathT - 0.8 / Terrain.pathTotal);
          e.dist = e.pathT * Terrain.pathTotal;
          U.list.push(e);
          Game.scene.add(e.group);
        }
      }

      /* Gold. */
      let gold = Math.round(this.bounty * (1 + (Commander.current && Commander.current.faction === 'pirate' ? 0.08 : 0)));
      Game.gold += gold;
      Game.stats.goldEarned += gold;
      Game.stats.towerDamage += this.damageTaken;

      if (source) source.onKill && source.onKill(this);
    }

    leak() {
      if (this.dead) return;
      this.dead = true;
      Game.stats.leaks++;
      const lost = this.def.lives;
      Game.lives -= lost;
      FX.explosion(this.x, this.y + 1, this.z, this.def.palette || 'chrome', Math.min(2, this.scale));
      FX.shake(0.35);
      Audio.sfx.leak();
      if (Game.ui) Game.ui.livesFlash(lost);
    }
  }

  /* ------------------------------------------------------------ */
  U.spawn = function (defId, opts) {
    const o = opts || {};
    const e = new Enemy(defId, Game.wave, Game.difficulty, Game.seed);
    e.pathT = o.t || 0;
    e.dist = e.pathT * Terrain.pathTotal;
    if (o.scale) e.group.scale.setScalar(o.scale);
    U.list.push(e);
    Game.scene.add(e.group);
    return e;
  };

  U.update = function (dt, time) {
    for (let i = U.list.length - 1; i >= 0; i--) {
      const e = U.list[i];
      e.update(dt, time);
      if (e.dead) {
        Game.scene.remove(e.group);
        U.list.splice(i, 1);
      }
    }
  };

  U.damageInRadius = function (x, z, radius, dmg, element, source, opts) {
    for (const e of U.list) {
      if (e.dead) continue;
      if (Util.dist2(e.x, e.z, x, z) < radius * radius) {
        e.takeDamage(dmg, element, source, opts || { splash: true });
      }
    }
  };

  U.pullInRadius = function (x, z, radius, amount) {
    for (const e of U.list) {
      if (e.dead || e.def.pullImmune || e.flying) continue;
      if (Util.dist2(e.x, e.z, x, z) < radius * radius) {
        e.pullBack(amount);
        e.slow = Math.max(e.slow, 0.3);
        e.slowT = Math.max(e.slowT, 1.2);
      }
    }
  };

  U.clear = function () {
    for (const e of U.list) Game.scene.remove(e.group);
    U.list.length = 0;
  };

  window.Units = U;
})();
