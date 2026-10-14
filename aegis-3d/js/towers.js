/* aegis-3d/js/towers.js — the twelve towers. Each is a distinct low-poly
   silhouette built from primitives, with three tiers of visible evolution
   (barrels, armour, glow), animated heads, per-tower firing behaviour and a
   shared projectile system. Origins carry their accent colour, the 2D game's
   "the builder is a mechanical identity" rule: human cyan, robotic chrome,
   pirate crimson, xeno violet, light gold. */
(function () {
  'use strict';

  const T = { list: [], projs: [] };
  const ORIGIN_ACCENT = { human: '#38e8ff', robotic: '#cbd5e1', pirate: '#ef4444', light: '#fbbf24', xeno: '#a855f7' };

  function geoBox(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function geoCyl(r1, r2, h, seg) { return new THREE.CylinderGeometry(r1, r2, h, seg || 8); }

  function mk(parent, geo, matKey, x, y, z) {
    const m = new THREE.Mesh(geo, matKey);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  /* Materials per tower: painted body + glowing accent. */
  function bodyMat(def) {
    return Paint.mat(def.origin === 'robotic' ? 'metal' : def.origin === 'xeno' ? 'xeno'
      : def.origin === 'pirate' ? 'pirate' : def.origin === 'light' ? 'light'
      : 'metal', Util.hashStr(def.id) % 9000, {});
  }
  function glowMat(def, strength) {
    const key = def.origin === 'human' ? 'storm' : def.origin === 'robotic' ? 'chrome'
      : def.origin === 'pirate' ? 'ember' : def.origin === 'light' ? 'light'
      : 'ven';
    return Paint.mat(key, Util.hashStr(def.id) % 9000 + 500, { emissive: strength || 1.3 });
  }
  function glowPlain(hex, strength) {
    return new THREE.MeshStandardMaterial({ color: 0x0a0e17, emissive: new THREE.Color(hex), emissiveIntensity: strength || 1.4, roughness: 0.5 });
  }

  /* ------------------------------------------------------------ */
  /* One builder per tower. Returns { group, parts }. */
  function buildModel(def, tier) {
    const g = new THREE.Group();
    const B = bodyMat(def);
    const accent = ORIGIN_ACCENT[def.origin] || '#38e8ff';
    const G = glowMat(def, 1.3);
    const parts = { glow: [] };
    const t = tier || 1;

    /* Base plate — every tower sits on the same socket so origins read
       against each other. */
    mk(g, geoCyl(0.95, 1.15, 0.5, 8), B, 0, 0.25, 0);
    const ring = mk(g, new THREE.TorusGeometry(0.92, 0.06, 6, 22), glowPlain(accent, 0.7), 0, 0.09, 0);
    ring.rotation.x = Math.PI / 2;

    const head = new THREE.Group();
    head.position.y = 0.75;
    g.add(head);
    parts.head = head;

    const id = def.id;
    if (id === 'bolt') {
      mk(head, geoBox(0.6, 0.5, 0.7), B, 0, 0.25, 0);
      parts.barrel = mk(head, geoCyl(0.07, 0.09, 1.15, 7), B, 0, 0.32, 0.55);
      parts.barrel.rotation.x = Math.PI / 2;
      mk(head, geoCyl(0.085, 0.085, 0.1, 7), G, 0, 0.32, 1.13);
      if (t >= 2) {
        parts.barrel2 = mk(head, geoCyl(0.07, 0.09, 1.15, 7), B, 0.22, 0.32, 0.42);
        parts.barrel2.rotation.x = Math.PI / 2;
      }
      if (t >= 3) {
        mk(head, geoBox(0.3, 0.3, 0.9), B, -0.24, 0.42, 0.2);
        mk(head, geoBox(0.3, 0.3, 0.9), B, 0.24, 0.42, 0.2);
        parts.barrel3 = mk(head, geoCyl(0.07, 0.09, 1.15, 7), B, -0.22, 0.62, 0.42);
        parts.barrel3.rotation.x = Math.PI / 2;
        parts.barrel.scale.set(1.15, 1.15, 1.15);
      }
    } else if (id === 'cryo') {
      const dish = mk(head, new THREE.SphereGeometry(0.5, 10, 7), B, 0, 0.3, 0);
      dish.scale.set(1, 0.7, 1);
      parts.orb = mk(head, new THREE.SphereGeometry(0.16, 8, 6), glowPlain('#7dd3fc', 1.8), 0, 0.42, 0);
      for (let i = 0; i < 3 + t; i++) {
        const a = (i / (3 + t)) * Math.PI * 2;
        mk(head, geoCyl(0.04, 0.02, 0.5, 5), B, Math.cos(a) * 0.4, 0.42, Math.sin(a) * 0.4);
      }
      if (t >= 3) parts.orb.scale.setScalar(1.7);
    } else if (id === 'mortar') {
      mk(head, geoBox(0.8, 0.55, 0.9), B, 0, 0.28, 0);
      parts.barrel = mk(head, geoCyl(0.22, 0.26, 1.5, 9), B, 0, 0.5, 0);
      parts.barrel.rotation.x = Math.PI / 2 - 0.65;
      mk(head, geoCyl(0.27, 0.27, 0.14, 9), G, 0, 0.5 + Math.sin(0.65) * 0.8, Math.cos(0.65) * 0.8);
      if (t >= 2) mk(head, geoCyl(0.14, 0.18, 0.5, 7), B, -0.55, 0.5, 0.1);
      if (t >= 3) {
        parts.barrel.scale.setScalar(1.25);
        mk(head, geoCyl(0.14, 0.18, 0.5, 7), B, 0.55, 0.5, -0.1);
      }
    } else if (id === 'arc') {
      parts.coil = mk(head, geoCyl(0.12, 0.18, 1.4 + t * 0.3, 6), B, 0, 0.8, 0);
      parts.coil.rotation.x = Math.PI / 2;
      for (let i = 0; i < 2 + t; i++) {
        const tor = mk(head, new THREE.TorusGeometry(0.3 + i * 0.12, 0.05, 6, 18), G, 0, 0.3, 0.2 + i * 0.3);
        tor.rotation.x = Math.PI / 2;
      }
      parts.orb = mk(head, new THREE.SphereGeometry(0.14, 7, 5), glowPlain('#a5b4fc', 2.0), 0, 0.3, 0.2 + (1 + t) * 0.3);
    } else if (id === 'flak') {
      parts.barrel = mk(head, geoCyl(0.06, 0.08, 1.5, 7), B, -0.16, 0.4, 0);
      parts.barrel.rotation.x = Math.PI / 2;
      parts.barrel2 = mk(head, geoCyl(0.06, 0.08, 1.5, 7), B, 0.16, 0.4, 0);
      parts.barrel2.rotation.x = Math.PI / 2;
      const dish = mk(head, new THREE.CylinderGeometry(0.3, 0.16, 0.12, 8), B, 0, 0.6, -0.4);
      dish.rotation.x = Math.PI / 2.4;
      if (t >= 2) {
        parts.barrel3 = mk(head, geoCyl(0.06, 0.08, 1.5, 7), B, -0.16, 0.7, 0);
        parts.barrel3.rotation.x = Math.PI / 2;
        parts.barrel4 = mk(head, geoCyl(0.06, 0.08, 1.5, 7), B, 0.16, 0.7, 0);
        parts.barrel4.rotation.x = Math.PI / 2;
      }
      if (t >= 3) {
        parts.barrel.scale.set(1.4, 1.4, 1.4);
        parts.barrel2.scale.set(1.4, 1.4, 1.4);
      }
    } else if (id === 'railgun') {
      mk(head, geoBox(0.5, 0.5, 0.7), B, 0, 0.3, 0);
      parts.rail1 = mk(head, geoBox(0.09, 0.09, 1.6 + t * 0.4), B, -0.13, 0.32, 1.0);
      parts.rail2 = mk(head, geoBox(0.09, 0.09, 1.6 + t * 0.4), B, 0.13, 0.32, 1.0);
      parts.core = mk(head, geoCyl(0.1, 0.1, 1.5 + t * 0.3, 6), glowPlain('#cbd5e1', 1.7), 0, 0.32, 1.0);
      parts.core.rotation.x = Math.PI / 2;
      if (t >= 3) {
        mk(head, geoBox(0.6, 0.4, 0.3), B, 0, 0.65, 0.2);
      }
    } else if (id === 'prism') {
      parts.crystal = mk(head, new THREE.ConeGeometry(0.34, 1.0, 4), G, 0, 0.75, 0);
      parts.crystal.rotation.y = Math.PI / 4;
      const gim = mk(head, new THREE.TorusGeometry(0.5, 0.05, 6, 18), B, 0, 0.35, 0);
      gim.rotation.x = Math.PI / 2;
      if (t >= 2) {
        mk(head, new THREE.ConeGeometry(0.16, 0.5, 4), G, 0.5, 0.45, 0.35);
      }
      if (t >= 3) {
        parts.crystal.scale.setScalar(1.4);
        mk(head, new THREE.ConeGeometry(0.16, 0.5, 4), G, -0.5, 0.45, 0.35);
        mk(head, new THREE.ConeGeometry(0.16, 0.5, 4), G, 0, 0.45, 0.62);
      }
    } else if (id === 'tether') {
      mk(head, geoBox(0.7, 0.5, 0.8), B, 0, 0.3, 0);
      parts.barrel = mk(head, geoCyl(0.1, 0.14, 1.3, 8), B, 0, 0.42, 0.55);
      parts.barrel.rotation.x = Math.PI / 2;
      parts.tip = mk(head, new THREE.ConeGeometry(0.13, 0.4, 5), B, 0, 0.42, 1.2);
      parts.tip.rotation.x = -Math.PI / 2;
      const coil = mk(head, geoCyl(0.26, 0.26, 0.24, 8), B, 0, 0.55, -0.35);
      coil.rotation.x = Math.PI / 2;
      if (t >= 2) parts.tip.scale.setScalar(1.6);
      if (t >= 3) parts.barrel.scale.setScalar(1.2);
    } else if (id === 'pyre') {
      mk(head, geoBox(0.9, 0.5, 0.9), B, 0, 0.3, 0);
      const tank = mk(head, geoCyl(0.3, 0.3, 0.7, 8), B, -0.45, 0.42, -0.2);
      tank.rotation.z = Math.PI / 2;
      parts.nozzle = mk(head, new THREE.ConeGeometry(0.24, 0.7, 7), G, 0, 0.42, 0.55);
      parts.nozzle.rotation.x = -Math.PI / 2;
      if (t >= 2) mk(head, geoCyl(0.3, 0.3, 0.7, 8), B, 0.45, 0.42, -0.2);
      if (t >= 3) {
        parts.nozzle2 = mk(head, new THREE.ConeGeometry(0.18, 0.6, 7), G, -0.25, 0.42, 0.55);
        parts.nozzle2.rotation.x = -Math.PI / 2;
        parts.nozzle.scale.setScalar(1.15);
      }
    } else if (id === 'toxin') {
      parts.sac = mk(head, new THREE.SphereGeometry(0.55, 10, 8), B, 0, 0.45, 0);
      parts.sac.scale.set(1, 0.85, 1);
      parts.tube = mk(head, geoCyl(0.1, 0.14, 0.9, 7), B, 0, 0.62, 0.5);
      parts.tube.rotation.x = Math.PI / 2;
      parts.orb = mk(head, new THREE.SphereGeometry(0.16, 7, 5), glowPlain('#a3e635', 1.9), 0, 0.6, 0);
      for (let i = 0; i < 3 + t * 2; i++) {
        const a = (i / (3 + t * 2)) * Math.PI * 2;
        const p = mk(head, new THREE.SphereGeometry(0.09, 6, 5), G, Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4);
        parts.glow.push(p);
      }
      if (t >= 3) parts.sac.scale.set(1.3, 1.05, 1.3);
    } else if (id === 'singularity') {
      parts.orb = mk(head, new THREE.SphereGeometry(0.42, 10, 8), B, 0, 0.75, 0);
      parts.core = mk(head, new THREE.SphereGeometry(0.16, 7, 5), glowPlain('#c084fc', 2.2), 0, 0.75, 0);
      for (let i = 0; i < 1 + t; i++) {
        const tor = mk(head, new THREE.TorusGeometry(0.6 + i * 0.16, 0.035, 6, 22), G, 0, 0.75, 0);
        tor.rotation.x = Math.PI / 2 + i * 0.6;
        parts.glow.push(tor);
      }
    } else if (id === 'canister') {
      mk(head, geoBox(0.75, 0.75, 0.9), B, 0, 0.4, 0);
      for (let i = 0; i < 2 + t; i++) {
        mk(head, geoCyl(0.14, 0.14, 0.6, 7), B, -0.3 + i * 0.3, 0.62, 0);
      }
      parts.barrel = mk(head, geoCyl(0.09, 0.12, 0.8, 7), B, 0, 0.42, 0.55);
      parts.barrel.rotation.x = Math.PI / 2;
      parts.glow.push(mk(head, new THREE.SphereGeometry(0.1, 6, 5), glowPlain('#a3e635', 1.7), 0, 0.42, 0.95));
    }

    return { group: g, parts };
  }

  /* ------------------------------------------------------------ */
  class Tower {
    constructor(defId, x, z, tier) {
      this.def = Data.TOWERS.find((t) => t.id === defId);
      this.x = x; this.z = z;
      this.y = Terrain.heightAt(x, z);
      this.tier = tier || 1;
      this.asc = 0;                    // ascensions past tier 3
      this.ascSpent = 0;
      this.cd = 0.8;
      this.targeting = 'first';
      this.beamTarget = null;
      this.ramp = 0;
      this.beamOn = false;
      this.angle = Math.random() * Math.PI * 2;
      this.recoil = 0;
      this.muzzleT = 0;
      this.coneFlicker = 0;
      this.shots = 0;             // attack events fired — used by the QA harness
      this.stats = this.computeStats();
      this.maxHp = 100;
      this.hp = 100;
      this.buildModel();
    }

    computeStats() {
      const d = this.def;
      let s = { range: d.range, damage: d.damage, rate: d.rate, projSpeed: d.projSpeed || 30,
        splash: d.splash || 0, chain: d.chain || 0, slow: d.slow || 0, slowDur: d.slowDur || 0,
        pull: d.pull || 0, poisonDps: d.poisonDps || 0, poisonDur: d.poisonDur || 0,
        maxStacks: d.maxStacks || 0, burnDps: d.burnDps || 0, burnDur: d.burnDur || 0,
        cone: d.cone || 0, pulseRadius: d.pulseRadius || 0, drag: d.drag || 0,
        freeze: d.freeze || 0, freezeDur: d.freezeDur || 0, stun: d.stun || 0,
        rampMax: d.rampMax || 0, split: d.split || 0, airBonus: d.airBonus || 0,
        airSlow: d.airSlow || 0, airSlowDur: d.airSlowDur || 0,
        shred: d.shred || 0, cloudDur: d.cloudDur || 0, cloud: d.cloud || false,
        puddle: d.puddle || false, puddleDps: d.puddleDps || 0, puddleDur: d.puddleDur || 0, puddleRadius: d.puddleRadius || 0,
        homing: d.homing || false };
      for (let i = 0; i < this.tier - 1; i++) {
        const u = d.upgrades[i];
        for (const k in u) {
          if (k === 'name' || k === 'cost' || k === 'desc') continue;
          s[k] = u[k];
        }
      }
      /* Ascension: the 2D game's golden ladder, ×1.34 damage / ×1.07 rate /
         ×1.035 range per step. */
      if (this.asc > 0) {
        s.damage *= Math.pow(1.34, this.asc);
        s.rate *= Math.pow(1.07, this.asc);
        s.range *= Math.pow(1.035, this.asc);
      }
      /* Commander passives. */
      if (Commander.current) {
        const c = Commander.current;
        if (c.passive.name === 'OPEN INDEX') { s.damage *= 1.1; s.rate *= 1.1; s.range *= 1.1; }
        if (c.passive.name === 'RADIANCE') s.damage *= 1.12;
      }
      return s;
    }

    buildModel() {
      if (this.group && this.group.parent) this.group.parent.remove(this.group);
      const built = buildModel(this.def, this.tier);
      this.group = built.group;
      this.parts = built.parts;
      this.group.position.set(this.x, this.y, this.z);
      this.group.rotation.y = this.angle;
      Game.scene.add(this.group);
    }

    get upgradeDef() { return this.def.upgrades[this.tier - 1]; }
    get upgradeCost() { return this.upgradeDef ? this.upgradeDef.cost : null; }
    /* Golden exponent: (2 × paid specialisation) ^ 1.1618^n, n = asc count. */
    get ascCost() {
      const paid = this.def.cost + (this.tier > 1 ? this.def.upgrades[0].cost : 0) + (this.tier > 2 ? this.def.upgrades[1].cost : 0);
      return Math.round(Math.pow(2 * paid, Math.pow(1.1618, this.asc)));
    }
    get sellValue() {
      return Math.round((this.def.cost + (this.tier > 1 ? this.def.upgrades[0].cost : 0) + (this.tier > 2 ? this.def.upgrades[1].cost : 0) + this.ascSpent) * Data.WORLD.sellRatio);
    }

    upgrade() {
      if (this.tier >= 3) return;
      this.tier++;
      this.stats = this.computeStats();
      this.buildModel();
      FX.ring(this.x, this.y + 0.4, this.z, 0x38e8ff, 2.4, 0.7);
      FX.burst(this.x, this.y + 1, this.z, '#38e8ff', 18, 4.5, 0.6, 0.3, {});
      Audio.sfx.upgrade();
    }

    ascend() {
      if (this.tier < 3) return;
      const cost = this.ascCost;       // cost for THIS step, before increment
      this.asc++;
      this.ascSpent += cost;
      this.stats = this.computeStats();
      const accent = ORIGIN_ACCENT[this.def.origin] || '#38e8ff';
      /* Visible ascension: the tower swells and its glows burn hotter; every
         second step surges. */
      this.group.scale.setScalar(1 + 0.05 * this.asc);
      this.group.traverse((m) => {
        if (m.isMesh && m.material && m.material.emissive) {
          m.material.emissiveIntensity = (m.material.emissiveIntensity || 0.4) * 1.25;
        }
      });
      if (this.asc % 2 === 0) {
        FX.ring(this.x, this.y + 0.6, this.z, new THREE.Color(accent).getHex(), 3.6, 0.9);
      } else {
        FX.ring(this.x, this.y + 0.6, this.z, 0xffffff, 2.8, 0.7);
      }
      FX.burst(this.x, this.y + 1.2, this.z, accent, 26, 6, 0.8, 0.34, {});
      Audio.sfx.upgrade();
      FX.shake(0.08);
    }

    remove() {
      Game.scene.remove(this.group);
    }

    /* --- targeting -------------------------------------------------- */
    findTarget() {
      const s = this.stats;
      let best = null;
      for (const e of Units.list) {
        if (e.dead) continue;
        if (this.def.targets === 'ground' && e.flying) continue;
        if (Util.dist2(e.x, e.z, this.x, this.z) > s.range * s.range) continue;
        if (!best) { best = e; continue; }
        const better =
          this.targeting === 'strong' ? e.maxHp > best.maxHp :
          this.targeting === 'close' ? Util.dist2(e.x, e.z, this.x, this.z) < Util.dist2(best.x, best.z, this.x, this.z) :
          this.targeting === 'last' ? e.pathT < best.pathT :
          e.pathT > best.pathT;   // 'first' — the lead unit
        if (better) best = e;
      }
      return best;
    }

    /* --- update ------------------------------------------------------ */
    update(dt, time) {
      this.cd -= dt;
      if (this.recoil > 0) this.recoil -= dt * 5;
      if (this.muzzleT > 0) this.muzzleT -= dt;

      const target = this.findTarget();
      const s = this.stats;

      /* Aim. */
      if (target) {
        const dy = (target.y + (target.flying ? 1.2 : 1.1)) - (this.y + 0.9);
        const dx = target.x - this.x, dz = target.z - this.z;
        const yaw = Math.atan2(dx, dz);
        this.angle = Util.angLerp(this.angle, yaw, Math.min(1, dt * 9));
        this.group.rotation.y = this.angle;
        if (this.parts.head) {
          const dist = Math.hypot(dx, dz);
          const pitch = Math.atan2(dy, dist);
          this.parts.head.rotation.x = Util.damp(this.parts.head.rotation.x, -pitch * (this.def.arc ? 0.25 : 1), 8, dt);
        }
      }

      if (this.def.beam || this.def.id === 'pyre' || this.def.id === 'singularity') {
        this.updateContinuous(dt, time, target);
        return;
      }

      if (target && this.cd <= 0) {
        this.cd = 1 / (s.rate * Commander.rateMul());
        this.fire(target, time);
      }
    }

    updateContinuous(dt, time, target) {
      const s = this.stats;
      const d = this.def;
      if (d.beam) { // prism
        if (target) {
          if (this.beamTarget !== target) { this.beamTarget = target; this.ramp = 0; }
          this.ramp = Math.min(s.rampMax, this.ramp + dt * 1.15);
          this.beamOn = true;
          const dps = s.damage * s.rate * this.ramp * Commander.damageMul();
          if (this.cd <= 0) {
            this.cd = 1 / (s.rate * Commander.rateMul());
            this.shots++;
            target.takeDamage(dps / s.rate, 'radiant', this, {});
            if (s.split > 1) {
              let n = 0;
              for (const e of Units.list) {
                if (n >= s.split - 1) break;
                if (e.dead || e === target) continue;
                if (Util.dist2(e.x, e.z, target.x, target.z) < 6 * 6) {
                  e.takeDamage((dps / s.rate) * 0.6, 'radiant', this, {});
                  FX.beam(target.x, target.y + 1.2, target.z, e.x, e.y + 1.2, e.z, 0xfbbf24, 0.04, 0.12);
                  n++;
                }
              }
            }
            Audio.sfx.shootPrism(this.x);
          }
          const mx = this.x + Math.sin(this.angle) * 1.1, mz = this.z + Math.cos(this.angle) * 1.1;
          const my = this.y + 1.0;
          FX.beam(mx, my, mz, target.x, target.y + 1.2, target.z, 0xfbbf24, 0.055, 0.08);
          if (Math.random() < dt * 20) {
            FX.burst(target.x, target.y + 1.2, target.z, '#fbbf24', 2, 1.8, 0.25, 0.16, { gravity: 0 });
          }
          if (this.parts.crystal) this.parts.crystal.rotation.y += dt * 4;
        } else {
          this.beamTarget = null;
          this.ramp = Math.max(0, this.ramp - dt * 3);
          this.beamOn = false;
        }
      } else if (d.id === 'pyre') { // cone flame
        const inCone = [];
        for (const e of Units.list) {
          if (e.dead || e.flying) continue;
          const dx = e.x - this.x, dz = e.z - this.z;
          if (dx * dx + dz * dz > s.range * s.range) continue;
          const ang = Math.atan2(dx, dz);
          let diff = Math.abs(Util.angLerp(this.angle, ang, 0) - this.angle);
          diff = Math.min(diff, Math.PI * 2 - diff);
          if (diff < s.cone * Math.PI) inCone.push(e);
        }
        this.coneFlicker = Math.max(0, this.coneFlicker - dt * 2);
        if (inCone.length) {
          this.coneFlicker = 1;
          if (this.cd <= 0) {
            this.cd = 1 / (s.rate * Commander.rateMul());
            this.shots++;
            for (const e of inCone) {
              e.takeDamage(s.damage * Commander.damageMul(), 'fire', this, {});
              e.burn = Math.max(e.burn || 0, s.burnDps * 60);
              e.burnDps = s.burnDps * 60;
              e.burnT = Math.max(e.burnT, s.burnDur);
              if (s.puddle && Math.random() < 0.45) {
                FX.cloud(e.x, Terrain.heightAt(e.x, e.z) + 0.06, e.z, 0xf97316, s.puddleRadius, s.puddleDur, 0.24, true);
                Units.damageInRadius(e.x, e.z, s.puddleRadius, s.puddleDps * 40, 'fire', this, { splash: true, noMark: true });
              }
            }
            Audio.sfx.shootPyre(this.x);
          }
          for (let i = 0; i < Math.floor(dt * 40); i++) {
            const a = this.angle + (Math.random() - 0.5) * s.cone;
            const r = 1.2 + Math.random() * (s.range - 1.4);
            FX.burst(this.x + Math.sin(a) * r, this.y + 0.8 + Math.random() * 0.5, this.z + Math.cos(a) * r,
              Math.random() < 0.6 ? '#f97316' : '#fde68a', 1, 2.2, 0.4, 0.3, { gravity: -0.5 });
          }
          FX.cloud(this.x + Math.sin(this.angle) * s.range * 0.6, this.y + 0.7, this.z + Math.cos(this.angle) * s.range * 0.6,
            0xf97316, s.range * 0.5, 0.3, 0.14, false);
        }
        if (this.parts.nozzle) this.parts.nozzle.scale.setScalar(1 + Math.sin(time * 22) * 0.06 + this.coneFlicker * 0.1);
      } else { // singularity pulse
        if (this.cd <= 0) {
          this.cd = 1 / (s.rate * Commander.rateMul());
          this.shots++;
          const r = s.pulseRadius;
          let any = false;
          for (const e of Units.list) {
            if (e.dead || e.flying) continue;
            if (Util.dist2(e.x, e.z, this.x, this.z) < r * r) {
              any = true;
              e.takeDamage(s.damage * Commander.damageMul(), 'void', this, {});
              if (!e.def.pullImmune) {
                const pull = Math.min(s.drag, Math.hypot(e.x - this.x, e.z - this.z) * 0.3);
                e.pullBack(pull);
                e.slow = Math.max(e.slow, s.slow);
                e.slowT = Math.max(e.slowT, s.slowDur);
              }
            }
          }
          if (any) {
            FX.ring(this.x, this.y + 0.9, this.z, 0xc084fc, r, 0.55);
            Audio.sfx.shootSingularity(this.x);
            if (this.parts.core) this.parts.core.scale.setScalar(1.5);
          }
        }
        if (this.parts.core) this.parts.core.scale.setScalar(1 + Math.sin(time * 3.1) * 0.18);
        for (const tor of this.parts.glow || []) tor.rotation.x += dt * 0.9;
      }
    }

    /* --- firing ------------------------------------------------------- */
    fire(target) {
      this.shots++;
      const s = this.stats;
      const d = this.def;
      const mx = this.x + Math.sin(this.angle) * 1.15;
      const mz = this.z + Math.cos(this.angle) * 1.15;
      const my = this.y + (this.parts.head ? this.parts.head.position.y : 0.8);
      this.recoil = 1;

      if (d.id === 'arc') {
        const pts = [{ x: mx, y: my + 0.3, z: mz }, { x: target.x, y: target.y + 1.2, z: target.z }];
        let prev = target, dmg = s.damage * Commander.damageMul();
        target.takeDamage(dmg, 'storm', this, {});
        for (let i = 0; i < s.chain - 1; i++) {
          let next = null, best = 5.2 * 5.2;
          for (const e of Units.list) {
            if (e.dead || e === prev) continue;
            const dd = Util.dist2(e.x, e.z, prev.x, prev.z);
            if (dd < best) { best = dd; next = e; }
          }
          if (!next) break;
          dmg *= d.chainFalloff;
          next.takeDamage(dmg, 'storm', this, { noMark: true });
          pts.push({ x: next.x, y: next.y + 1.2, z: next.z });
          prev = next;
        }
        FX.chain(pts, '#a5b4fc');
        Audio.sfx.shootArc(this.x);
        FX.muzzle(mx, my + 0.3, mz, Math.sin(this.angle), Math.cos(this.angle), '#a5b4fc', 0.8);
        return;
      }

      if (d.id === 'railgun') {
        /* Pierce everything on the line. */
        const dirX = Math.sin(this.angle), dirZ = Math.cos(this.angle);
        const start = { x: mx, y: my, z: mz };
        const hits = [];
        for (const e of Units.list) {
          if (e.dead) continue;
          const vx = e.x - start.x, vz = e.z - start.z;
          const proj = vx * dirX + vz * dirZ;
          if (proj < 0) continue;
          const perp = Math.abs(vx * dirZ - vz * dirX);
          if (perp < 1.4 && proj < s.range + 4) hits.push({ e, d: proj });
        }
        hits.sort((a, b) => a.d - b.d);
        const end = {
          x: start.x + dirX * (hits.length ? hits[hits.length - 1].d + 1 : s.range),
          y: my, z: start.z + dirZ * (hits.length ? hits[hits.length - 1].d + 1 : s.range)
        };
        FX.beam(start.x, start.y, start.z, end.x, end.y + 0.2, end.z, 0xcbd5e1, 0.1, 0.22);
        FX.beam(start.x, start.y, start.z, end.x, end.y + 0.2, end.z, 0xffffff, 0.03, 0.1);
        for (const h of hits) {
          h.e.takeDamage(s.damage * Commander.damageMul(), 'kinetic', this, {});
        }
        Audio.sfx.shootRailgun(this.x);
        FX.shake(0.16);
        FX.muzzle(mx, my, mz, dirX, dirZ, '#cbd5e1', 1.4);
        return;
      }

      /* Projectile towers. */
      const p = spawnProj(d.id);
      p.x = mx; p.y = my + 0.25; p.z = mz;
      p.target = target;
      p.dmg = s.damage * Commander.damageMul();
      p.element = d.element;
      p.source = this;
      p.splash = s.splash;
      p.slow = s.slow; p.slowDur = s.slowDur;
      p.pull = s.pull;
      p.poisonDps = s.poisonDps; p.poisonDur = s.poisonDur;
      p.maxStacks = s.maxStacks;
      p.freeze = s.freeze; p.freezeDur = s.freezeDur;
      p.stun = s.stun;
      p.airBonus = s.airBonus;
      p.airSlow = s.airSlow;
      p.airSlowDur = s.airSlowDur;
      p.shred = s.shred;
      p.cloud = s.cloud; p.cloudDur = s.cloudDur;
      p.homing = s.homing;
      p.speed = s.projSpeed;
      p.arc = d.arc;
      p.life = 3.5;

      if (d.id === 'cryo') Audio.sfx.shootCryo(this.x);
      else if (d.id === 'mortar') Audio.sfx.shootMortar(this.x);
      else if (d.id === 'flak') Audio.sfx.shootFlak(this.x);
      else if (d.id === 'tether') Audio.sfx.shootTether(this.x);
      else if (d.id === 'toxin') Audio.sfx.shootToxin(this.x);
      else if (d.id === 'canister') Audio.sfx.shootCanister(this.x);
      else Audio.sfx.shootBolt(this.x);

      const colors = { bolt: '#e2e8f0', cryo: '#7dd3fc', mortar: '#fb923c', flak: '#e2e8f0',
        tether: '#7dd3fc', toxin: '#a3e635', canister: '#a3e635' };
      FX.muzzle(mx, my + 0.25, mz, Math.sin(this.angle), Math.cos(this.angle), colors[d.id], d.id === 'mortar' ? 1.2 : 0.7);
    }
  }

  /* ------------------------------------------------------------ */
  /* Projectiles: pooled glowing cores. */
  const PROJ_COLORS = { bolt: '#e2e8f0', cryo: '#7dd3fc', mortar: '#fb923c', flak: '#e2e8f0',
    tether: '#7dd3fc', toxin: '#a3e635', canister: '#a3e635' };
  const projGeo = new THREE.SphereGeometry(1, 7, 5);
  const projMats = {};
  for (const k in PROJ_COLORS) {
    projMats[k] = new THREE.MeshBasicMaterial({ color: PROJ_COLORS[k], transparent: true, opacity: 0.95 });
  }
  const projPool = [];

  function spawnProj(kind) {
    let mesh = projPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(projGeo, projMats[kind] || projMats.bolt);
      mesh.userData.keep = true;
      Game.scene.add(mesh);
    }
    mesh.material = projMats[kind] || projMats.bolt;
    mesh.visible = true;
    const p = {
      mesh, kind, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      target: null, dmg: 0, element: 'kinetic', source: null,
      splash: 0, slow: 0, slowDur: 0, pull: 0, poisonDps: 0, poisonDur: 0,
      maxStacks: 0, freeze: 0, freezeDur: 0, stun: 0, airBonus: 0, airSlow: 0, airSlowDur: 0,
      shred: 0, cloud: false, cloudDur: 0, homing: false, speed: 30, arc: false, life: 3.5,
      t: 0, lastTx: 0, lastTz: 0, flightT: undefined, dead: false
    };
    T.projs.push(p);
    return p;
  }

  function updateProjs(dt) {
    for (let i = T.projs.length - 1; i >= 0; i--) {
      const p = T.projs[i];
      p.t += dt;
      if (p.t > p.life) { recycleProj(p, i); continue; }

      if (p.arc) {
        /* Ballistic: recompute the arc toward the (possibly moving) target. */
        const tx = p.target && !p.target.dead ? p.target.x : p.lastTx;
        const tz = p.target && !p.target.dead ? p.target.z : p.lastTz;
        const ty = Terrain.heightAt(tx, tz) + (p.target && !p.target.dead && p.target.flying ? 1 : 0);
        p.lastTx = tx; p.lastTz = tz;
        const dx = tx - p.x, dz = tz - p.z;
        const flat = Math.hypot(dx, dz);
        const totalT = flat / p.speed;
        if (totalT < 0.12) { impactProj(p, i); continue; }
        const vy0 = (ty - p.y + 0.5 * 14 * totalT * totalT) / totalT;
        p.vx = dx / totalT;
        p.vz = dz / totalT;
        p.vy = vy0;
        p.arc = false;
        p.flightT = totalT;
      } else if (p.homing && p.target && !p.target.dead) {
        const tx = p.target.x, tz = p.target.z, ty = p.target.y + 1.1;
        const dx = tx - p.x, dz = tz - p.z, dy = ty - p.y;
        const d = Math.hypot(dx, dz) || 1;
        const spd = p.speed;
        p.vx += (dx / d * spd - p.vx) * Math.min(1, dt * 3);
        p.vz += (dz / d * spd - p.vz) * Math.min(1, dt * 3);
        p.vy = dy / (d / spd);
      }

      if (p.flightT !== undefined) {
        p.vy -= 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.flightT -= dt;
        const ground = Terrain.heightAt(p.x, p.z);
        if (p.y <= ground + 0.2) {
          p.y = ground;
          impactProj(p, i);
          continue;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        /* Straight shots steer toward the target position. */
        if (!p.homing && p.target) {
          if (p.target.dead || p.target.reached) {
            if (p.t > 0.6) { recycleProj(p, i); continue; }
          } else {
            const tx = p.target.x, tz = p.target.z, ty = p.target.y + (p.target.flying ? 2.4 : 1.1);
            const dx = tx - p.x, dz = tz - p.z, dy = ty - p.y;
            const d = Math.hypot(dx, dz);
            if (d < Math.max(0.7, p.speed * dt * 1.5) || d < 0.4) {
              impactProj(p, i);
              continue;
            }
            const spd = p.speed;
            p.vx = (dx / d) * spd;
            p.vz = (dz / d) * spd;
            p.vy = (dy / d) * spd;
          }
        }
      }
      p.mesh.position.set(p.x, p.y, p.z);
      const sc = p.kind === 'mortar' ? 0.34 : p.kind === 'canister' ? 0.3 : p.kind === 'toxin' ? 0.26 : 0.2;
      p.mesh.scale.setScalar(sc);
      if (Math.random() < dt * 30) {
        FX.burst(p.x, p.y, p.z, PROJ_COLORS[p.kind], 1, 0.8, 0.25, 0.1, { gravity: 0 });
      }
    }
  }

  function recycleProj(p, i) {
    p.mesh.visible = false;
    projPool.push(p.mesh);
    T.projs.splice(i, 1);
  }

  function impactProj(p, i) {
    const ground = Terrain.heightAt(p.x, p.z);
    const o = { splash: p.splash > 0 };
    if (p.target && !p.target.dead && p.splash === 0) {
      let dmg = p.dmg;
      if (p.target.flying && p.airBonus) dmg *= p.airBonus;
      p.target.takeDamage(dmg, p.element, p.source, o);
      applyRider(p, p.target);
    }
    if (p.splash > 0) {
      for (const e of Units.list) {
        if (e.dead) continue;
        if (Util.dist2(e.x, e.z, p.x, p.z) < p.splash * p.splash) {
          const dmg = p.dmg * (e.flying && p.airBonus ? p.airBonus : 1);
          e.takeDamage(dmg, p.element, p.source, o);
          applyRider(p, e);
        }
      }
    }

    /* Impact FX + audio. */
    const el = p.element;
    FX.explosion(p.x, p.y, p.z, el === 'frost' ? 'storm' : el === 'fire' ? 'ember' : el === 'venom' ? 'ven' : 'chrome',
      p.splash > 3 ? 1.4 : 0.8);
    if (p.splash > 0) FX.ring(p.x, ground + 0.1, p.z, new THREE.Color(PROJ_COLORS[p.kind]).getHex(), p.splash, 0.5);
    Audio.sfx['impact' + el[0].toUpperCase() + el.slice(1)](p.x);
    if (p.stun) FX.hitStop(0.03);
    if (p.splash > 3.5) FX.shake(0.1);

    if (p.cloud) {
      FX.cloud(p.x, ground + 0.05, p.z, 0x4ade80, p.splash, p.cloudDur, 0.3, true);
    }

    recycleProj(p, i);
  }

  function applyRider(p, e) {
    if (p.slow && !e.def.slowImmune) {
      e.slow = Math.max(e.slow, p.slow);
      e.slowT = Math.max(e.slowT, p.slowDur);
    }
    if (p.pull && !e.def.pullImmune) {
      e.pullBack(p.pull);
    }
    if (p.poisonDps) {
      const n = e.venomStacks.length;
      if (n < p.maxStacks) e.venomStacks.push({ dps: p.poisonDps * 60, t: p.poisonDur });
    }
    if (p.freeze && Math.random() < p.freeze) {
      e.freezeT = Math.min(p.freezeDur, e.def.boss || e.def.miniboss ? 0.5 : p.freezeDur);
      Audio.sfx.shatter(e.x);
    }
    if (p.shred) e.shred = Math.max(e.shred || 0, p.shred);
    if (e.flying && p.airSlow) {
      e.slow = Math.max(e.slow, p.airSlow);
      e.slowT = Math.max(e.slowT, p.airSlowDur || 1.4);
    }
  }

  /* ------------------------------------------------------------ */
  T.place = function (defId, x, z) {
    const t = new Tower(defId, x, z);
    T.list.push(t);
    FX.ring(x, Terrain.heightAt(x, z) + 0.3, z, 0x38e8ff, 2.2, 0.5);
    FX.burst(x, Terrain.heightAt(x, z) + 1, z, '#38e8ff', 12, 3.4, 0.5, 0.24, {});
    Audio.sfx.place();
    return t;
  };

  T.sell = function (t) {
    Game.gold += t.sellValue;
    const i = T.list.indexOf(t);
    if (i >= 0) T.list.splice(i, 1);
    t.remove();
    FX.ring(t.x, t.y + 0.3, t.z, 0xef4444, 1.8, 0.4);
    Audio.sfx.sell();
  };

  T.update = function (dt, time) {
    for (const t of T.list) t.update(dt, time);
    updateProjs(dt);
    /* Recoil visual. */
    for (const t of T.list) {
      if (t.parts.barrel && t.recoil > 0) {
        t.parts.barrel.position.z = 0.55 - t.recoil * 0.14;
        if (t.parts.barrel2) t.parts.barrel2.position.z = 0.42 - t.recoil * 0.14;
      }
      if (t.parts.head && t.recoil > 0) t.parts.head.position.z = -t.recoil * 0.06;
    }
  };

  T.clear = function () {
    for (const t of T.list) t.remove();
    T.list.length = 0;
    for (let i = T.projs.length - 1; i >= 0; i--) recycleProj(T.projs[i], i);
  };

  T.buildGhost = function (defId) {
    const built = buildModel(Data.TOWERS.find((t) => t.id === defId), 1);
    built.group.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.opacity = 0.45;
        m.material.depthWrite = false;
      }
    });
    return built.group;
  };

  /* A clean, opaque model for UI previews and shop thumbnails. */
  T.previewModel = function (defId, tier) {
    const built = buildModel(Data.TOWERS.find((t) => t.id === defId), tier || 1);
    built.group.traverse((m) => {
      if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
    });
    return built.group;
  };

  window.Towers = T;
})();
