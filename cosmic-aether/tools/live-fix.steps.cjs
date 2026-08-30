module.exports = [
  { size: [1600, 900] },
  { wait: 3000 },
  { eval: 'window.__RQ.start({ board: 3, difficulty: 1 }); "ok"' },
  { wait: 2000 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 800 },
  { eval: 'window.__RQ.spawn("stockman", 4, 60); window.__RQ.spawn("brute", 1, 80); window.__RQ.step(5); "horde"' },
  { wait: 400 },
  { shot: 'live-hw2' },
  { eval: 'JSON.stringify({errs: window.__RQ.errorCount(), status: window.__RQ.snapshot().status, alive: window.__RQ.snapshot().alive})' }
];
