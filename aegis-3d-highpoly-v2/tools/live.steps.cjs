/* Live-URL smoke: prove the deployed page boots in a real browser. */
'use strict';
module.exports = [
  { size: [1600, 900] },
  { wait: 3000 },
  { eval: 'typeof GAME !== "undefined" && typeof SIM !== "undefined" && typeof FX !== "undefined" && !!window.__RQ ? "boot-ok" : "boot-dead"' },
  { eval: 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();"match-started"' },
  { wait: 900 },
  { eval: 'GAME.state.wave + "/" + GAME.state.gold + "/lives" + GAME.state.lives' },
  { shot: 'live-start' }
];
