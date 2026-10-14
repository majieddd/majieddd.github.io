module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1400 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 300 },
  { eval: 'window.__RQ.camera({ dist: 320, pitch: 0.25, yaw: 0.9 }); "ball"' },
  { wait: 500 },
  { shot: 'globe-full' },
  { eval: 'window.__RQ.camera({ dist: 84, pitch: 0.14, yaw: 2.4, focus: [30, -18, 18] }); "grazing"' },
  { wait: 500 },
  { shot: 'globe-graze' }
];
