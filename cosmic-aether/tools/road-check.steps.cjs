module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1400 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 400 },
  { shot: 'road-wide' },
  { eval: 'window.__RQ.camera({ dist: 26, pitch: 0.5, yaw: 0.5, focus: [10, 0, 5] }); "mid"' },
  { wait: 400 },
  { shot: 'road-mid' },
  { eval: 'window.__RQ.camera({ dist: 120, pitch: 0.55, yaw: 0.0 }); "planet"' },
  { wait: 400 },
  { shot: 'road-planet' }
];
