module.exports = [
  { size: [800, 500] },
  { wait: 2500 },
  { eval: 'window.__RQ.start({ board: 3, difficulty: 1 }); "ok"' },
  { wait: 1200 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.spawn("stockman", 4, 60); window.__RQ.step(5); "horde"' },
  { wait: 300 },
  { eval: 'JSON.stringify(window.__RQ.errors())' }
];
