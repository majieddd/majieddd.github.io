module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.spawn("stockman", 4, 6); window.__RQ.spawn("brute", 2, 4); window.__RQ.step(1.2); JSON.stringify({alive: window.__RQ.snapshot().alive, denizens: window.__RQ.snapshot().denizens})' },
  { eval: 'window.__RQ.camera({ dist: 14, pitch: 0.45, yaw: 0.35, focus: [0, 3, -14] }); "cam"' },
  { wait: 250 },
  { shot: 'enemy-close2' }
];
