module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.camera({ dist: 30, pitch: 0.12, yaw: 0.35 }); "low"' },
  { wait: 300 },
  { shot: 'rim-low' },
  { eval: 'window.__RQ.camera({ dist: 24, pitch: 0.18, yaw: 1.9 }); "lo2"' },
  { wait: 300 },
  { shot: 'rim-low2' }
];
