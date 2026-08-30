module.exports = [
  { size: [800, 500] },
  { wait: 2500 },
  { eval: 'JSON.stringify({booted: !!window.__RQ, errs: window.__RQ ? window.__RQ.errorCount() : -1, boards: window.DATA ? DATA.BOARDS.map(function(b){return b.id;}) : null})' },
  { eval: 'window.__RQ.start({ board: 3, difficulty: 1 }); JSON.stringify({started: true, snap: window.__RQ.snapshot().ok})' },
  { wait: 1200 },
  { eval: 'JSON.stringify({errs: window.__RQ.errorCount(), render: R.errors().length, status: window.__RQ.snapshot().status, boardId: (GAME.state && GAME.state.board && GAME.state.board.id) || null})' }
];
