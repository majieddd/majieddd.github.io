/* AETHER :: tools/shots
   Baseline and comparison screenshots: menu, board, action, close-up of a
   tower, and a denizen cluster. Camera is driven through __RQ. */
module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { shot: 'aether-00-menu' },
  { eval: [
      'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 });',
      '"started"'
    ].join('\n') },
  { wait: 1200 },
  { eval: 'window.__RQ.closeScreens(); "closed"' },
  { wait: 400 },
  { shot: 'aether-01-board' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); "built"' },
  { wait: 400 },
  { eval: 'window.__RQ.startWave(); "wave"' },
  { eval: 'window.__RQ.step(6); "stepped"' },
  { wait: 300 },
  { shot: 'aether-02-combat' },
  { eval: 'window.__RQ.camera({ dist: 16, pitch: 0.62, yaw: 0.55 }); "cam"' },
  { wait: 300 },
  { shot: 'aether-03-closeup' },
  { eval: 'window.__RQ.camera({ dist: 30, pitch: 0.9, yaw: 0.55 }); "cam2"' },
  { wait: 300 },
  { shot: 'aether-04-far' }
];
