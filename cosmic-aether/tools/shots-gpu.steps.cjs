/* AETHER :: tools/shots-gpu
   Full-fidelity comparison shots on the real GPU: menu, board, combat,
   close-up, plus a draw-call / frame-time probe and an rAF fps sample. */
module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { shot: 'hd-00-menu' },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 1200 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 400 },
  { shot: 'hd-01-board' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.step(6); "stepped"' },
  { wait: 300 },
  { shot: 'hd-02-combat' },
  { eval: 'window.__RQ.camera({ dist: 16, pitch: 0.62, yaw: 0.55 }); "ok"' },
  { wait: 300 },
  { shot: 'hd-03-closeup' },
  { eval: 'JSON.stringify(window.__RQ.snapshot())' },
  { eval: 'R.setProfiling(true); "prof"' },
  { eval: '(function(){ var s = R.stats(); return JSON.stringify({draws:s.draws, shadowDraws:s.shadowDraws, culled:s.culled, tris: s.tris, particles: s.particles, ms: s.ms}); })()' },
  { eval: 'R.setProfiling(false); "none"' },
  { eval: '(function(){ return new Promise(function(res){ var c=0; var t0=performance.now(); function loop(){ c++; if(c>=120){ res(JSON.stringify({fps: 120000/(performance.now()-t0)})); } else { requestAnimationFrame(loop); } } requestAnimationFrame(loop); }); })()' }
];
