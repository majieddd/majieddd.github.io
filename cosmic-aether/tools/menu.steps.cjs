module.exports = [
  { size: [1600, 900] },
  { wait: 2200 },
  { shot: 'menu' },
  { eval: '(function(){ var btns = Array.prototype.map.call(document.querySelectorAll("[data-board], .board, .optboard"), function(b){ return (b.textContent || "").trim().slice(0, 32) || b.id; }); return JSON.stringify({boardCountGuess: (window.DATA && DATA.BOARDS) ? DATA.BOARDS.length : -1, boardNames: (window.DATA && DATA.BOARDS) ? DATA.BOARDS.map(function(b){return b.name;}) : []}); })()' }
];
