/* Bisect 4: place 12 towers ONLY, then upgrade each ONCE (not in a while). */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var PLACE_ONLY = [
  'var G=GAME.state;G.gold=99999;',
  'var mid=G.board.pathAt(G.board.path.length*0.5);',
  'var plots=G.board.plots.slice().filter(function(p){return !p.tower;});',
  'plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});',
  'var placed=0;["bolt","bolt","mortar","arc","prism","pharos","toxin","maw","pyre","cyclone","railgun","singularity"].forEach(function(id,i){var p=plots[i];if(p&&SIM.place(p.id,id)){placed++;}});',
  '"placed="+placed'
].join(';');

var UPGRADE_ONCE = [
  'var G=GAME.state;var up=0;',
  'for(var i=0;i<G.towers.length;i++){var r=SIM.upgrade(G.towers[i]);if(r)up++;}',
  '"upgraded="+up+"/"+G.towers.length'
].join(';');

module.exports = [
  { size: [800, 500] },
  { wait: 2600 },
  { eval: START },
  { wait: 500 },
  { eval: PLACE_ONLY },
  { eval: '"place-ok"' },
  { eval: UPGRADE_ONCE },
  { eval: '"upgrade-ok"' },
  { eval: '"done"' }
];
