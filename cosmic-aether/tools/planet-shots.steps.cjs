module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.spawn("stockman", 3, 9); window.__RQ.spawn("brute", 1, 7); window.__RQ.step(2.5); "horde"' },
  { wait: 300 },
  { shot: 'pl-board' },
  { eval: 'window.__RQ.camera({ dist: 34, pitch: 0.14, yaw: 0.35 }); "horizon"' },
  { wait: 300 },
  { shot: 'pl-horizon' },
  { eval: 'window.__RQ.camera({ dist: 47, pitch: 0.35, yaw: 0.2 }); "wide"' },
  { wait: 300 },
  { shot: 'pl-wide' }
];
