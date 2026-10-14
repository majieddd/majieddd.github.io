module.exports = [
  { size: [1600, 900] },
  { wait: 3000 },
  { eval: 'window.__RQ.start({ board: 3, difficulty: 1 }); "ok"' },
  { wait: 2000 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 1500 },
  { shot: 'live-hw-board' },
  { eval: 'JSON.stringify({errs: window.__RQ.errorCount(), status: window.__RQ.snapshot().status})' }
];
