// ===== input.js : pointer picking + camera orbit/zoom =====

function makeInput(game, rt, ui) {
  const canvas = rt.canvas;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPt = new THREE.Vector3();
  let dragging = false, moved = 0, lastX = 0, lastY = 0;
  let yaw = 0, dist = 12.5, height = 15.5;
  rt._yaw = yaw;

  function toTile(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, rt.camera);
    if (ray.ray.intersectPlane(groundPlane, hitPt)) {
      const c = Math.floor(hitPt.x), rr = Math.floor(hitPt.z);
      return { c, r: rr, x: hitPt.x, z: hitPt.z };
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.005; height = Math.max(7, Math.min(26, height + dy * 0.04));
      lastX = e.clientX; lastY = e.clientY;
      const tx = GRID.cols / 2, tz = GRID.rows / 2;
      rt.camera.position.set(tx + Math.sin(yaw) * dist, height, tz + Math.cos(yaw) * dist);
      rt.camTarget.set(tx, 0, tz); rt.camera.lookAt(rt.camTarget);
    } else {
      const t = toTile(e.clientX, e.clientY);
      if (t) { /* hover hint handled by highlight mesh */ }
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) {
      const t = toTile(e.clientX, e.clientY);
      if (!t) return;
      // tower hit? pick nearest tower mesh
      let near = null, nd = 0.7;
      for (const tw of game.sim.towers) { const d = Math.hypot(tw.x - t.x, tw.y - t.z); if (d < nd) { nd = d; near = tw; } }
      if (near) { game.selectTower(near.id); ui.refreshInspect(); ui.syncAll(); }
      else if (game.selectedType) { game.tryBuildAt(t.c, t.r); ui.syncAll(); }
      else { game.selectTower(null); ui.refreshInspect(); }
    }
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(6, Math.min(26, dist + e.deltaY * 0.01)); const tx = GRID.cols / 2, tz = GRID.rows / 2; rt.camera.position.set(tx + Math.sin(yaw) * dist, height, tz + Math.cos(yaw) * dist); }, { passive: false });

  // hover highlight mesh
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.25 }));
  hl.position.y = 0.04; hl.visible = false; rt.worldGroup.add(hl);
  game._hl = hl;
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { hl.visible = false; return; }
    const t = toTile(e.clientX, e.clientY);
    if (!t) { hl.visible = false; return; }
    hl.position.set(t.c + 0.5, 0.05, t.r + 0.5);
    hl.visible = !PATH_TILES.has(t.c + ',' + t.r) && t.c >= 0 && t.r >= 0 && t.c < GRID.cols && t.r < GRID.rows && game.sim.state === 'playing';
    hl.material.color.setHex(game.selectedType && game.sim.canBuildAt(t.c, t.r) ? 0x38e8ff : 0xef4444);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { game.togglePause(); ui.$('b-pause').textContent = game.paused ? 'RESUME' : 'PAUSE'; e.preventDefault(); }
    else if (e.key === '1') game.startWave(false);
    else if (e.key >= '2' && e.key <= '6') { const types = TOWER_ORDER; const i = parseInt(e.key) - 2; if (types[i]) ui.selectBuild(types[i]); }
    else if (e.key === 'u') game.tryUpgrade();
    else if (e.key === 's') game.trySell();
    else if (e.key === 'r') game.reset(), ui.hideOverlay(), ui.syncAll();
  });
}
