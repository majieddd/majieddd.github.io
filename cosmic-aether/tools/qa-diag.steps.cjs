/* AETHER :: tools/qa-diag
   Focused numbers: ground vs pad-top vs tower base; plot pick correctness via
   the REAL mousemove/mousedown/mouseup path; and combat fps measured while
   denizens are alive and towers are firing. */
'use strict';
module.exports = [
  { size: [1600, 900] },
  { wait: 2000 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 3 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); window.__RQ.setGold(90000); "ok"' },

  /* GROUND vs PAD-TOP geometry for the first few plots. */
  { eval: '(function(){ var G=GAME.state; var ps=G.board.plots.slice(0,4).map(function(p){ return { id:p.id, groundY:+p.y.toFixed(3), padTop:+(p.y-0.06+0.32).toFixed(3), padRaise:+(0.26).toFixed(3) }; }); return JSON.stringify({ status:G.status, plotCount:G.board.plots.length, sample:ps }); })()' },

  /* PICK + PLACE on a specific plot via the real pointer path. */
  { eval: 'window.__RQ.select("bolt"); var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var plot=free[0]; window.__RQ.camera({ focus:[plot.x,2,plot.z], dist:11, pitch:0.50, yaw:0.5 }); "focus:"+plot.id' },
  { wait: 600 },
  { eval: '(function(){ return new Promise(function(res){ var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var plot=free[0]; var canvas=document.getElementById("gl"); var s=R.project([plot.x, plot.y+0.26, plot.z]); if(!s){ res("PROJECT_NULL"); return; } var x=s.x, y=s.y; canvas.dispatchEvent(new MouseEvent("mousemove",{clientX:x,clientY:y,bubbles:true})); requestAnimationFrame(function(){ requestAnimationFrame(function(){ canvas.dispatchEvent(new MouseEvent("mousedown",{clientX:x,clientY:y,button:0,bubbles:true})); window.dispatchEvent(new MouseEvent("mouseup",{clientX:x,clientY:y,button:0,bubbles:true})); setTimeout(function(){ var t=G.towers[G.towers.length-1]; var gr=R.screenToGround(x,y,0); var nearest=null, nd=1e9; if(gr){ for(var i=0;i<G.board.plots.length;i++){ var p=G.board.plots[i]; var dx=p.x-gr[0], dz=p.z-gr[2]; var dd=dx*dx+dz*dz; if(dd<nd){ nd=dd; nearest=p; } } } var targetPicked = nearest && (nearest.id===plot.id) && t && (Math.abs(t.pos[0]-plot.x)<1e-3) && (Math.abs(t.pos[2]-plot.z)<1e-3); res(JSON.stringify({ targetPlot: plot.id, targetGroundY:+plot.y.toFixed(3), padTop:+(plot.y+0.26).toFixed(3), padThickness:0.32, pickedNearest: nearest?nearest.id:null, pickDist2:+nd.toFixed(2), towerPlaced: !!(t&&t.id==="bolt"), towerBaseY: t?+t.pos[1].toFixed(3):null, baseDeltaVsPadTop: t?+(t.pos[1]-(plot.y+0.26)).toFixed(3):null, targetPickedExact: targetPicked, towersNow: G.towers.length })); }, 200); }); }); }); })()' },

  /* COMBAT PERF: tanky difficulty + a swarm so towers actively fire during
     the fps sample. Build all 14, start wave, flood the lane. */
  { eval: 'window.__RQ.setGold(90000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.spawn("stockman", 30, 0.5); "spawned"' },
  { eval: 'window.__RQ.step(2.0); window.__RQ.camera({ dist:34, pitch:0.80, yaw:0.5, focus:[0,2,0] }); "stepped"' },
  { eval: 'var sn=window.__RQ.snapshot(); JSON.stringify({alive:sn.alive, denizens:sn.denizens, projectiles:sn.projectiles, towers:sn.towers})' },
  { wait: 300 },
  { eval: '(function(){ var s=R.stats(); return JSON.stringify({draws:s.draws, shadowDraws:s.shadowDraws, culled:s.culled, tris:s.tris, particles:s.particles}); })()' },
  { shot: 'qa-c-combat' },
  { eval: '(function(){ return new Promise(function(res){ var c=0; var t0=performance.now(); function loop(){ c++; if(c>=120){ res(JSON.stringify({fps:+(120000/(performance.now()-t0)).toFixed(1)})); } else { requestAnimationFrame(loop); } } requestAnimationFrame(loop); }); })()' },
  { eval: 'JSON.stringify(window.__RQ.errors())' }
];
