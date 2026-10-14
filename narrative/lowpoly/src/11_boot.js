/* 11 boot. Run after all modules are inlined. Shows the intro modal, exposes
   the autotest API on window.__LP, and starts the master loop on first action. */
(function(){
  const LP=window.LP;
  const Art=LP.Art;
  // Expose the test API BEFORE the loop starts so a verifier can drive it.
  window.__LP={
    place:(tx,tz)=>LP.Actions.placeTower(tx,tz),
    select:(k)=>{LP.G.selected=Art.TOWER_PRESETS[k]? k : null;},
    upgrade:()=>LP.Actions.upgradeSelected(),
    sell:()=>LP.Actions.sellSelected(),
    step:(n)=>LP.step(n),
    gold:()=>LP.G.gold,
    lives:()=>LP.G.lives,
    enemies:()=>LP.G.enemies.length,
    wave:()=>LP.G.wave,
    status:()=>LP.G.status,
    state:()=>({gold:LP.G.gold,lives:LP.G.lives,enemies:LP.G.enemies.length,wave:LP.G.wave,towers:LP.G.towers.length,status:LP.G.status}),
    forceMap:(id)=>LP.Actions.loadMap(id)
  };
  // Show the intro after a single tick so the canvas paints at least one frame first.
  requestAnimationFrame(()=>{ LP.UI.showIntro(); });
  // Mark ready so a verifier can check
  window.__READY=true;
})();
