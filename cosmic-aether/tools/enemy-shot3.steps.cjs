module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.spawn("stockman", 4, 6); window.__RQ.spawn("brute", 2, 4); window.__RQ.step(1.2); "spawned"' },
  { eval: '(function(){ var G=GAME.state; var d=G.denizens[0]; if(!d) return "none"; var p=d.pos; window.__RQ.camera({ focus:[p[0],3,p[2]], dist:11, pitch:0.55, yaw:0 }); return JSON.stringify(p); })()' },
  { wait: 300 },
  { shot: 'enemy-close3' }
];
