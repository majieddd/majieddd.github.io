/* Shadow A/B: same frame with shadows on vs off. */
'use strict';
var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';
module.exports = [
  { size: [1280, 720] },
  { wait: 2600 },
  { eval: START },
  { wait: 800 },
  { eval: 'var G=GAME.state;G.gold=99999;var mid=G.board.pathAt(G.board.path.length*0.5);var plots=G.board.plots.slice().filter(function(p){return !p.tower;});plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});["bolt","mortar","arc","prism","pyre"].forEach(function(id,i){var p=plots[i];if(p)SIM.place(p.id,id);});SIM.spawnDenizen("colossus",{dist:24});for(var i=0;i<240;i++){SIM.step(1/120);FX.update(1/120);}"staged"' },
  { eval: '__RQX();"shadow-on"' },
  { shot: '10-shadow-on' },
  { eval: 'window.__RQUAL("shadows",false);__RQX();"shadow-off"' },
  { shot: '11-shadow-off' },
  { eval: 'window.__RQUAL("shadows",true);"restored"' }
];
