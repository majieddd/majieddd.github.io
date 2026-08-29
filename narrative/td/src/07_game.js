// ===== game.js : controller. Binds sim + render + audio, builds meshes, animates, loops. =====

function Game(rt, audio) {
  this.rt = rt; this.audio = audio;
  this.sim = new GameSim({ seed: 1234 });
  this.towerMeshes = new Map(); // id -> group
  this.enemyMeshes = new Map(); // id -> group
  this.projMeshes = new Map();   // id -> mesh
  this.core = null;
  this.hover = null;             // {c,r}
  this.selectedType = null;      // build palette selection
  this.selectedTower = null;
  this.paused = false;
  this.last = 0;
  this.acc = 0;
  this.speed = 1;
  this.ui = null; // set by boot; frame() drives UI sync so it is rAF-throttle-safe
  this._initWorld();
}

Game.prototype._initWorld = function () {
  this.rt.buildWorld();
  this.core = buildCore();
  this.core.position.set(CORE_TILE[0] + 0.5, 0, CORE_TILE[1] + 0.5);
  this.rt.worldGroup.add(this.core);
};

Game.prototype.reset = function (seed) {
  // remove dynamic meshes
  for (const g of this.towerMeshes.values()) this.rt.worldGroup.remove(g);
  for (const g of this.enemyMeshes.values()) this.rt.worldGroup.remove(g);
  for (const m of this.projMeshes.values()) this.rt.fxGroup.remove(m);
  this.towerMeshes.clear(); this.enemyMeshes.clear(); this.projMeshes.clear();
  this.sim.reset(seed || (this.sim.seed + 1));
  this.selectedTower = null; this.selectedType = null; this.paused = false;
  this.rt.shake = 0;
};

Game.prototype.setHover = function (c, r) { this.hover = { c, r }; };
Game.prototype.selectBuild = function (type) { this.selectedType = type; this.selectedTower = null; };
Game.prototype.selectTower = function (id) { this.selectedTower = id; this.selectedType = null; };

// ---- input-driven actions ----
Game.prototype.tryBuildAt = function (c, r) {
  if (!this.selectedType) return null;
  const res = this.sim.placeTower(this.selectedType, c, r);
  if (res.ok) {
    const mesh = buildTowerMesh(this.selectedType);
    mesh.position.set(c + 0.5, 0, r + 0.5);
    this.rt.worldGroup.add(mesh);
    this.towerMeshes.set(res.tower.id, mesh);
    this.audio.sfx.build();
  } else {
    this.audio.sfx.deny();
  }
  return res;
};
Game.prototype.tryUpgrade = function () { if (this.selectedTower != null) { const r = this.sim.upgradeTower(this.selectedTower); if (r.ok) this.audio.sfx.build(); else this.audio.sfx.deny(); } };
Game.prototype.trySell = function () { if (this.selectedTower != null) { if (this.sim.sellTower(this.selectedTower)) { const m = this.towerMeshes.get(this.selectedTower); if (m) this.rt.worldGroup.remove(m); this.towerMeshes.delete(this.selectedTower); this.selectedTower = null; this.audio.sfx.click(); } } };
Game.prototype.startWave = function (early) { if (this.sim.startNextWave(early)) this.audio.sfx.wave(); else this.audio.sfx.deny(); };
Game.prototype.setSpeed = function (s) { this.speed = s; };
Game.prototype.togglePause = function () { this.paused = !this.paused; };

// ---- main update ----
Game.prototype.frame = function (now) {
  if (!this.last) this.last = now;
  let dt = (now - this.last) / 1000; this.last = now;
  if (dt > 0.1) dt = 0.1; // clamp after tab switch
  const steps = this.paused ? 0 : this.speed;
  let simDt = dt * steps;
  // sub-step for stability at high speed
  if (simDt > 0) {
    const n = Math.max(1, Math.ceil(simDt / (1 / 60)));
    const sd = simDt / n;
    for (let i = 0; i < n; i++) this.sim.update(sd);
  }
  this._consumeEvents();
  this._syncMeshes(dt);
  this.rt.updateFx(dt);
  this.rt.shake = this.sim.shake;
  this.rt.render(this.sim.shake);
  this._animWorld(dt);
  // range indicator: build preview (hover tile) or selected tower
  if (this.selectedType && this.hover) {
    this.rt.setRangeRing(this.hover.c + 0.5, this.hover.r + 0.5, TOWERS[this.selectedType].range, TOWERS[this.selectedType].color);
  } else if (this.selectedTower != null) {
    const t = this.sim.towers.find((x) => x.id === this.selectedTower);
    if (t) this.rt.setRangeRing(t.x, t.y, t.range, t.def.color); else this.rt.setRangeRing(null, null, null);
  } else { this.rt.setRangeRing(null, null, null); }
  if (this.ui) this.ui.syncAll();
};

Game.prototype._consumeEvents = function () {
  const evs = this.sim.drainEvents();
  for (const e of evs) {
    switch (e.type) {
      case 'fire': this.audio.sfx.fire(e.kind, e.hue); break;
      case 'boom': this.rt.spawnBurst(e.x, e.y, e.hue, 14, 4); this.rt.spawnRing(e.x, e.y, e.hue, e.r); this.rt.spawnLight(e.x, e.y, e.hue); this.audio.sfx.boom(); break;
      case 'kill': this.rt.spawnBurst(e.x, e.y, e.hue, e.boss ? 40 : 12, e.boss ? 6 : 3); if (e.boss) this.rt.spawnRing(e.x, e.y, e.hue, 4); this.audio.sfx.kill(e.hue); if (this.ui) this.ui.floatText(e.x, e.y, '◆' + e.reward, 0xfbbf24); break;
      case 'leak': this.rt.spawnBurst(e.x, e.y, 0xff4444, 12, 3); this.audio.sfx.leak(); if (this.ui) this.ui.toast('CORE BREACH', 'bad'); break;
      case 'arc': this._addArc(e); break;
      case 'build': this.rt.spawnRing(e.x, e.y, e.hue, 1); break;
      case 'upgrade': this.rt.spawnRing(e.x, e.y, 0xfbbf24, 1.2); break;
      case 'wave-start': if (this.ui) this.ui.banner('WAVE ' + (e.index + 1), e.index + 1 >= this.sim.totalWaves ? 'FINAL STAND' : 'INCOMING'); if (e.index + 1 >= this.sim.totalWaves) this.rt.shake = 0.8; break;
      case 'wave-clear': this.audio.sfx.wave(); if (this.ui) this.ui.toast('WAVE CLEAR  +' + e.gold, 'win'); break;
      case 'victory': this.audio.sfx.win(); break;
      case 'defeat': this.audio.sfx.lose(); break;
    }
  }
};

Game.prototype._addArc = function (e) {
  const pts = [new THREE.Vector3(e.x0 + 0.5, 0.7, e.y0 + 0.5), new THREE.Vector3((e.x0 + e.x1) / 2 + 0.5, 1.1, (e.y0 + e.y1) / 2 + 0.5), new THREE.Vector3(e.x1 + 0.5, 0.6, e.y1 + 0.5)];
  const curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(12));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: e.hue, transparent: true, opacity: 0.9 }));
  this.rt.fxGroup.add(line);
  this.rt.particles.push({ mesh: line, arc: true, life: 0.18, t: 0 });
};

Game.prototype._syncMeshes = function (dt) {
  // towers
  for (const t of this.sim.towers) {
    let m = this.towerMeshes.get(t.id);
    if (!m) { m = buildTowerMesh(t.type); m.position.set(t.x, 0, t.y); this.rt.worldGroup.add(m); this.towerMeshes.set(t.id, m); }
    const head = m.userData.head;
    if (t.angle != null) m.rotation.y = -t.angle + Math.PI / 2;
    // spawn pop
    if (t.spawnAnim < 1) { const s = 0.4 + 0.6 * t.spawnAnim; m.scale.setScalar(s); }
    if (t.fireAnim > 0) {
      const f = 1 + t.fireAnim * 0.18;
      if (head.userData.barrel) head.userData.barrel.scale.z = f;
      if (head.userData.arm) head.userData.arm.scale.z = f;
      if (head.userData.orb) head.userData.orb.scale.setScalar(1 + t.fireAnim * 0.4);
      if (head.userData.core) head.userData.core.scale.setScalar(1 + t.fireAnim * 0.4);
      if (head.userData.muzzle) head.userData.muzzle.material.emissiveIntensity = 1.4 + t.fireAnim * 2;
    }
    if (t.upgradeFlash > 0) t.upgradeFlash = Math.min(1, t.upgradeFlash + dt * 3) - 0; // ring fx handled in events
    // idle bob of head
    head.position.y = 0.26 + Math.sin(this.rt.t * 1.5 + t.id) * 0.02;
  }
  // enemies
  for (const e of this.sim.enemies) {
    let m = this.enemyMeshes.get(e.id);
    if (!m) { m = buildEnemyMesh(e.def.shape, e.color); m.position.set(e.x, 0, e.y); this.rt.worldGroup.add(m); this.enemyMeshes.set(e.id, m); }
    m.position.set(e.x, 0, e.y);
    // face along path
    const ahead = this.sim.path[Math.min(e.pi, this.sim.path.length - 1)];
    if (ahead) m.rotation.y = Math.atan2(ahead[1] + 0.5 - e.y, ahead[0] + 0.5 - e.x) + Math.PI / 2;
    // spawn rise
    if (e.spawnAnim < 1) m.position.y = -0.6 + e.spawnAnim * 0.6;
    // hit flash
    const bd = m.userData.body;
    if (e.hitFlash > 0) { bd.scale.setScalar(1 + e.hitFlash * 0.4); }
    else bd.scale.setScalar(1);
    // walk animation
    this._animEnemy(m, e, dt);
    // air bob
    if (e.kind === 'air') m.position.y += Math.sin(this.rt.t * 3 + e.id) * 0.12 + 0.5;
  }
  // remove dead enemy meshes
  const liveIds = new Set(this.sim.enemies.map((e) => e.id));
  for (const [id, m] of this.enemyMeshes) { if (!liveIds.has(id)) { this.rt.worldGroup.remove(m); this.enemyMeshes.delete(id); } }
  // projectiles
  for (const p of this.sim.projectiles) {
    let m = this.projMeshes.get(p.id);
    if (!m) { const hue = p.hue; const geo = p.kind === 'beam' ? new THREE.BoxGeometry(0.1, 0.1, 0.5) : p.kind === 'arc' ? new THREE.SphereGeometry(0.1, 4, 4) : new THREE.SphereGeometry(0.12, 5, 5); m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hue })); this.rt.fxGroup.add(m); this.projMeshes.set(p.id, m); }
    m.position.set(p.x, p.kind === 'beam' ? 0.6 : 0.5, p.y);
    if (p.kind === 'beam' && p.tgt) m.lookAt(p.tx, 0.6, p.ty);
  }
  const liveP = new Set(this.sim.projectiles.map((p) => p.id));
  for (const [id, m] of this.projMeshes) { if (!liveP.has(id)) { this.rt.fxGroup.remove(m); this.projMeshes.delete(id); } }
};

Game.prototype._animEnemy = function (m, e, dt) {
  const ud = m.userData; const w = e.walkPhase;
  if (ud.legs) { for (let i = 0; i < ud.legs.length; i++) { ud.legs[i].rotation.x = Math.sin(w * 2 + i) * 0.5; } }
  if (ud.wings) { for (const wn of ud.wings) wn.rotation.z = Math.sin(w * 3) * 0.4; }
  if (ud.wing) ud.wing.rotation.z = Math.sin(w * 4) * 0.12;
  if (ud.blob) ud.blob.position.y = Math.sin(w) * 0.08;
  if (ud.cloth) ud.cloth.rotation.y = Math.sin(w * 0.5) * 0.3;
  if (ud.spikes) for (let i = 0; i < ud.spikes.length; i++) ud.spikes[i].rotation.z = (i / ud.spikes.length) * 6.28 + Math.sin(w + i) * 0.1;
  if (ud.core && e.boss) ud.core.rotation.y += dt * 0.6;
};

Game.prototype._animWorld = function (dt) {
  if (this.core) { this.core.userData.crystal.rotation.y += dt * 0.6; this.core.userData.crystal.rotation.x += dt * 0.3; this.core.userData.ring.rotation.z += dt * 0.4; const pulse = 1 + Math.sin(this.rt.t * 2) * 0.05; this.core.userData.crystal.scale.setScalar(pulse); }
  // low-health core warning tint
  const lf = this.sim.lives / 20;
  if (this.core) this.core.userData.crystal.material.emissiveIntensity = 1.8 * (lf < 0.4 ? (0.6 + Math.abs(Math.sin(this.rt.t * 6)) * 0.8) : 1);
};
