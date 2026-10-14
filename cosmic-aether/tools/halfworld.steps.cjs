module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1400 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 300 },
  { shot: 'hw-board' },
  { eval: 'window.__RQ.camera({ dist: 40, pitch: 0.22, yaw: 0.4 }); "horizon"' },
  { wait: 300 },
  { shot: 'hw-horizon' },
  { eval: 'window.__RQ.setGold(90000); window.__RQ.buildAll(); window.__RQ.startWave(); window.__RQ.step(6); "combat"' },
  { wait: 400 },
  { shot: 'hw-combat' }
];
