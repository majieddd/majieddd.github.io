module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1200 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(90000); window.__RQ.buildAll(); window.__RQ.startWave(); window.__RQ.step(5); "built"' },
  { wait: 300 },
  { eval: '(function(){ var s = R.stats(); var snap = window.__RQ.snapshot(); return JSON.stringify({draws:s.draws, shadowDraws:s.shadowDraws, particles:s.particles, towers:snap.towers, plots:snap.plots}); })()' },
  { eval: '(function(){ return new Promise(function(res){ var c=0; var t0=performance.now(); function loop(){ c++; if(c>=120){ res(JSON.stringify({fps: 120000/(performance.now()-t0)})); } else { requestAnimationFrame(loop); } } requestAnimationFrame(loop); }); })()' }
];
