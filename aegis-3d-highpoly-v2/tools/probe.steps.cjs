/* Minimal probe: boot, check hooks, one manual frame. */
'use strict';
module.exports = [
  { size: [800, 500] },
  { wait: 2600 },
  { eval: 'typeof __RQX + "|" + typeof __RQUAL + "|" + typeof SIM' },
  { eval: 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();"started"' },
  { wait: 400 },
  { eval: '__RQX()' },
  { eval: '__RQX()' },
  { eval: '"probe-done"' }
];
