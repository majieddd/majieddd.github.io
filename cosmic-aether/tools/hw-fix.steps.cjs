module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 3, difficulty: 1 }); "ok"' },
  { wait: 1400 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 300 },
  { shot: 'hw2-board' },
  { eval: 'window.__RQ.spawn("stockman", 6, 60); window.__RQ.spawn("brute", 2, 80); window.__RQ.step(4); "horde"' },
  { wait: 300 },
  { shot: 'hw2-enemies' },
  { eval: '(function(){ var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var p=free[0]; var t=SIM.place(p.id, "bolt"); return JSON.stringify({placed: !!t, plotY: +p.y.toFixed(2), x: p.x, z: p.z}); })()' },
  { wait: 300 },
  { shot: 'hw2-placed' }
];
