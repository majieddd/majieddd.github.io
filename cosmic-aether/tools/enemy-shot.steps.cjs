module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); "built"' },
  { eval: 'window.__RQ.spawn("stockman", 4, 12); window.__RQ.spawn("brute", 2, 10); "horde"' },
  { eval: 'window.__RQ.step(1.5); "step"' },
  { wait: 200 },
  { shot: 'enemy-march' },
  { eval: 'window.__RQ.camera({ dist: 12, pitch: 0.5, yaw: 0.55 }); "cam"' },
  { wait: 200 },
  { shot: 'enemy-close' }
];
