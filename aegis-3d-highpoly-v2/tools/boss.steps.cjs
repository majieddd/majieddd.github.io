/* HIGHPOLY boss-only close-up shot, no towers, no reaction clutter. */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var SPAWN = [
  'var G=GAME.state;',
  'SIM.spawnDenizen("harbinger",{dist:16});',
  'SIM.spawnDenizen("colossus",{dist:26});'
].join('');

var STEP = function (sec) {
  return 'var n=Math.round(' + sec + '*120);for(var i=0;i<n;i++){SIM.step(1/120);FX.update(1/120);}';
};

var FOCUS = [
  'var G=GAME.state;var d=null;for(var i=0;i<G.denizens.length;i++){if(G.denizens[i].alive){d=G.denizens[i];break;}}',
  'if(d){GAME.cam.targetFocus=[d.pos[0],d.pos[1]+2,d.pos[2]];GAME.cam.targetDist=34;}'
].join('');

module.exports = [
  { size: [1600, 900] },
  { wait: 2500 },
  { eval: START },
  { wait: 700 },
  { eval: SPAWN },
  { eval: STEP(0.8) },
  { eval: FOCUS },
  { wait: 600 },
  { shot: '08-boss-closeup' },
  { eval: STEP(3.0) },
  { eval: FOCUS },
  { wait: 400 },
  { shot: '09-boss-closeup2' }
];
