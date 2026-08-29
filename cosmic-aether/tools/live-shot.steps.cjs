module.exports = [
  { size: [1600, 900] },
  { wait: 2000 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.step(6); "stepped"' },
  { wait: 300 },
  { shot: 'live-aether-combat' }
];
