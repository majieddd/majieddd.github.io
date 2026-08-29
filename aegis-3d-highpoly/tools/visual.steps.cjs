/* HIGHPOLY visual.steps: staged screenshots for the art-direction review.
   GAME, SIM, FX, DATA, __RQ are page globals (classic <script> build). */
'use strict';

var START = 'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});window.__RQ.closeScreens();';

var PLACE = [
  'var G=GAME.state;G.gold=9999;',
  'var mid=G.board.pathAt(G.board.pathLen*0.55);',
  'var plots=G.board.plots.slice().filter(function(p){return !p.tower;});',
  'plots.sort(function(a,b){var ad=(a.x-mid.pos[0])*(a.x-mid.pos[0])+(a.z-mid.pos[2])*(a.z-mid.pos[2]);var bd=(b.x-mid.pos[0])*(b.x-mid.pos[0])+(b.z-mid.pos[2])*(b.z-mid.pos[2]);return ad-bd;});',
  '["bolt","mortar","prism","arc","toxin","flak"].forEach(function(id,i){var p=plots[i];if(p)SIM.place(p.id,id);});',
  'G.inspecting=null;'
].join('');

var STEP = function (sec) {
  return 'var n=Math.round(' + sec + '*120);for(var i=0;i<n;i++){SIM.step(1/120);FX.update(1/120);}';
};

var REACT = [
  'var G=GAME.state;',
  'var d=null;for(var i=0;i<G.denizens.length;i++){if(G.denizens[i].alive){d=G.denizens[i];break;}}',
  'if(d){SIM.damage(d,10,{element:"fire"});SIM.damage(d,10,{element:"radiant"});}'
].join('');

var MENAG = [
  'var G=GAME.state;var types=["chitling","gnawling","bloatpod","hivelord","broodmother","tither","graft","stockman"];',
  'for(var i=0;i<types.length;i++){SIM.spawnDenizen(types[i],{dist:6+i*9});}'
].join('');

var BOSS = 'var G=GAME.state;SIM.spawnDenizen("harbinger",{dist:12});';

module.exports = [
  { size: [1600, 900] },
  { wait: 2600 },
  { shot: '00-menu' },

  { eval: START },
  { wait: 900 },
  { shot: '01-build' },

  { eval: PLACE },
  { wait: 900 },
  { shot: '02-towers' },

  { eval: 'SIM.startWave()' },
  { eval: STEP(4.5) },
  { wait: 250 },
  { shot: '03-wave' },

  { eval: REACT },
  { eval: STEP(0.3) },
  { wait: 120 },
  { shot: '04-reaction' },

  { eval: MENAG },
  { eval: STEP(1.2) },
  { wait: 250 },
  { shot: '05-menagerie' },

  { eval: BOSS },
  { eval: STEP(2.5) },
  { wait: 250 },
  { shot: '06-boss' },

  { eval: STEP(6.0) },
  { wait: 250 },
  { shot: '07-boss-mid' }
];
