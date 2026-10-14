module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1400 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 400 },
  { shot: 'roam-idle' },
  { eval: 'window.__RQ.camera({ dist: 46, pitch: 0.3, yaw: 3.6, focus: [40, -6, 30] }); "panned"' },
  { wait: 400 },
  { shot: 'roam-pan' },
  { eval: 'window.__RQ.camera({ dist: 150, pitch: 0.5, yaw: 0.8, focus: [0, 0, 0] }); "far"' },
  { wait: 400 },
  { shot: 'roam-far' },
  { eval: 'window.__RQ.setGold(90000); window.__RQ.select("bolt"); "armed"' },
  { wait: 300 },
  { shot: 'roam-armed' },
  { eval: 'window.__RQ.startWave(); window.__RQ.step(4); JSON.stringify({alive: window.__RQ.snapshot().alive})' }
];
