/* Bisect: boot + place + heat ONLY. If this completes, the hang is in the
   sample evals. */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var PLACE = [
  'var G=GAME.state;G.gold=99999;',
  'var mid=G.board.pathAt(G.board.path.length*0.5);',
  'var plots=G.board.plots.slice().filter(function(p){return !p.tower;});',
  'plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});',
  '["bolt","bolt","mortar","arc","prism","pharos","toxin","maw","pyre","cyclone","railgun","singularity"].forEach(function(id,i){var p=plots[i];if(p)SIM.place(p.id,id);});',
  'for(var i=0;i<G.towers.length;i++){while(G.towers[i].tier<3){SIM.upgrade(G.towers[i]);}}',
  'G.towers.length + "/" + (G.towers[0] ? G.towers[0].tier : -1)'
].join('|');

module.exports = [
  { size: [800, 500] },
  { wait: 2600 },
  { eval: 'window.__RQ ? "rq-ok" : "rq-dead"' },
  { eval: START },
  { wait: 500 },
  { eval: PLACE },
  { eval: 'SIM.startWave()' },
  { eval: 'var n=Math.round(3*120);for(var i=0;i<n;i++){SIM.step(1/120);FX.update(1/120);}"stepped"' },
  { eval: 'typeof __RQX + "|" + __RQX()' },
  { eval: '"bisect-done"' }
];
