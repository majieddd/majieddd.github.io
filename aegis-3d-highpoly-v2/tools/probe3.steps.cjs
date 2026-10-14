/* Bisect 3: correct PLACE (towers + upgrades), no sampler. */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var PLACE = [
  'var G=GAME.state;G.gold=99999;',
  'var mid=G.board.pathAt(G.board.path.length*0.5);',
  'var plots=G.board.plots.slice().filter(function(p){return !p.tower;});',
  'plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});',
  '["bolt","bolt","mortar","arc","prism","pharos","toxin","maw","pyre","cyclone","railgun","singularity"].forEach(function(id,i){var p=plots[i];if(p)SIM.place(p.id,id);})',
  'var cur=[];for(var i=0;i<G.towers.length;i++){var g=G.towers[i];while(g.tier<3){SIM.upgrade(g);}cur.push(g.tier);}',
  'console.warn("placed",G.towers.length,cur.join(","))'
].join(';');

module.exports = [
  { size: [800, 500] },
  { wait: 2600 },
  { eval: START },
  { wait: 500 },
  { eval: PLACE },
  { eval: '"placed-ok"' },
  { eval: 'SIM.startWave()' },
  { eval: 'var n=Math.round(3*120);for(var i=0;i<n;i++){SIM.step(1/120);FX.update(1/120);}"stepped"' },
  { eval: 'typeof __RQX|"' }
];
