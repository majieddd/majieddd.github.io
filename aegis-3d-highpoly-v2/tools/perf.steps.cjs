/* HIGHPOLY v2 perf audit: real-rAF frame-time sampling (p50/p90/p99) across
   a fully-upgraded 12-tower battle, with quality A/B on shadow/bloom/ink. */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var PLACE = [
  'var G=GAME.state;G.gold=99999;',
  'var mid=G.board.pathAt(G.board.path.length*0.5);',
  'var plots=G.board.plots.slice().filter(function(p){return !p.tower;});',
  'plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});',
  '["bolt","bolt","mortar","arc","prism","pharos","toxin","maw","pyre","cyclone","railgun","singularity"].forEach(function(id,i){var p=plots[i];if(p)SIM.place(p.id,id);});',
  'for(var i=0;i<G.towers.length;i++){while(G.towers[i].tier<2){SIM.upgrade(G.towers[i]);}}'
].join('');

var STEP = function (sec) {
  return 'var n=Math.round(' + sec + '*120);for(var i=0;i<n;i++){SIM.step(1/120);FX.update(1/120);}';
};

/* Sample renderOnce across 12 manual frames; resolve a one-line summary.
   renderOnce returns the wall time of a complete draw (shadow, bloom, ink).
   12 frames keeps the whole run under ~2 minutes on the software raster. */
var SAMPLE = '(function(){var ts=[];for(var i=0;i<12;i++){var ms=__RQX();if(ms>0&&ms<20000)ts.push(ms);}ts.sort(function(a,b){return a-b;});function q(p){return ts[Math.min(ts.length-1,Math.floor(ts.length*p))].toFixed(1);}return (window.__PL||"")+" n="+ts.length+" p50="+q(0.5)+"ms p90="+q(0.9)+" max="+ts[ts.length-1].toFixed(1)+" avg="+(ts.reduce(function(a,b){return a+b;},0)/ts.length).toFixed(1);})()';

/* eval that applies a toggle then runs the sampler. */
function toggled(label, js) {
  return '(function(){window.__PL="' + label + ' ";' + js + ';return ' + SAMPLE + ';})()';
}

module.exports = [
  { size: [800, 500] },
  { wait: 2600 },
  { eval: START },
  { wait: 800 },
  { eval: PLACE },
  { eval: 'SIM.startWave()' },
  { eval: STEP(3.0) },
  { eval: toggled('BASE_ALL_ON', '') },
  { eval: toggled('SHADOWS_OFF', 'window.__RQUAL("shadows",false)') },
  { eval: toggled('BLOOM_OFF', 'window.__RQUAL("bloom",false)') },
  { eval: toggled('INK_OFF', 'window.__RQUAL("ink",false)') },
  { eval: 'window.__RQUAL("shadows",true);window.__RQUAL("bloom",true);window.__RQUAL("ink",true);"restored"' },
  { wait: 100 }
];
