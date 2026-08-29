/* AETHER :: tools/qa-paving
   Verification of the machined hex paving slabs (prism 0.32 high, top 0.26
   above ground) plus the plot highlight ring raise to p.y+0.30.
   Checks: (1) plot pick still hits the right plot, (2) a tower places ON the
   pad, (3) base-height deltas (ground vs pad top vs tower base),
   (4) full-wave perf with 14 towers, (5) HUD legibility. */
'use strict';
module.exports = [
  { size: [1600, 900] },
  { wait: 2000 },

  { shot: 'qa-00-menu' },

  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },

  /* EMPTY BOARD: pads visible, no tower. Show the raw paving. */
  { eval: 'window.__RQ.setGold(9000); window.__RQ.camera({ focus:[0,4,0], dist:26, pitch:0.62, yaw:0.4 }); "ok"' },
  { wait: 400 },
  { shot: 'qa-01-board-pads' },

  /* DIAGNOSTIC: ground/pad geometry from the state, before any tower. */
  { eval: '(function(){ var G=GAME.state; var ps=G.board.plots.slice(0,4).map(function(p){ return { id:p.id, x:+p.x.toFixed(3), y:+p.y.toFixed(3), z:+p.z.toFixed(3), padTop:+(p.y-0.06+0.32).toFixed(3) }; }); return JSON.stringify({ status:G.status, plotCount:G.board.plots.length, plots:ps }); })()' },

  /* PICK + PLACE TEST. Select bolt, focus a specific plot, project its
     pad-top centre to screen, drive the REAL mousemove/mousedown/mouseup
     path, then report which plot the pick landed on and the tower's base. */
  { eval: 'window.__RQ.select("bolt"); var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var plot=free[0]; window.__RQ.camera({ focus:[plot.x,2,plot.z], dist:10, pitch:0.42, yaw:0.6 }); "focus:"+plot.id' },
  { wait: 500 },
  { eval: '(function(){ return new Promise(function(res){ var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var plot=free[0]; var canvas=document.getElementById("gl"); var s=R.project([plot.x, plot.y+0.26, plot.z]); if(!s){ res("PROJECT_NULL"); return; } var x=s.x, y=s.y; canvas.dispatchEvent(new MouseEvent("mousemove",{clientX:x,clientY:y,bubbles:true})); requestAnimationFrame(function(){ requestAnimationFrame(function(){ canvas.dispatchEvent(new MouseEvent("mousedown",{clientX:x,clientY:y,button:0,bubbles:true})); window.dispatchEvent(new MouseEvent("mouseup",{clientX:x,clientY:y,button:0,bubbles:true})); setTimeout(function(){ var t=G.towers[G.towers.length-1]; var nearest=null, nd=1e9; var hp=GAME.state.hoverPlot; /* hoverPlot is a closure var; read via a fresh finger pick */ var gr=R.screenToGround(x,y,0); if(gr){ var bd=1e9; for(var i=0;i<G.board.plots.length;i++){ var p=G.board.plots[i]; var dx=p.x-gr[0], dz=p.z-gr[2]; var dd=dx*dx+dz*dz; if(dd<bd){ bd=dd; nearest=p; } } } res(JSON.stringify({ target:{id:plot.id, x:plot.x, z:plot.z, groundY:+plot.y.toFixed(3), padTop:+(plot.y+0.26).toFixed(3)}, screen:{x:Math.round(x), y:Math.round(y)}, pickedNearestId:(nearest?nearest.id:null), dist2ToTarget:+bd.toFixed(2), tower:(t?{id:t.id,x:t.pos[0],z:t.pos[2],baseY:+t.pos[1].toFixed(3)}:null), towersNow:G.towers.length, goldNow:Math.round(G.gold) })); }, 200); }); }); }); })()' },
  { wait: 200 },

  /* CLOSE-UP of the freshly placed tower sitting on its pad. */
  { eval: '(function(){ var G=GAME.state; var t=G.towers[G.towers.length-1]; if(t){ window.__RQ.camera({ focus:[t.pos[0], t.pos[1]+1.2, t.pos[2]], dist:8, pitch:0.35, yaw:1.0 }); } return "closeup"; })()' },
  { wait: 400 },
  { shot: 'qa-02-tower-on-pad' },

  /* Slightly wider, lower angle: shows the pad rim + its footprint context. */
  { eval: 'window.__RQ.camera({ dist:14, pitch:0.22, yaw:0.9 }); "bound"', },
  { wait: 300 },
  { shot: 'qa-03-pad-low' },

  /* HUD: select nothing but inspect the placed tower so the dock/abilities
     panels fill in, then grab a full-frame for legibility. */
  { eval: '(function(){ var G=GAME.state; var t=G.towers[G.towers.length-1]; if(t){ G.inspecting=t; window.__RQ.camera({ dist:30, pitch:0.8, yaw:0.4 }); } window.__RQ.select(null); window.__RQ.inspect(G.towers.length-1); return "inspect"; })()' },
  { wait: 350 },
  { shot: 'qa-04-hud-dock' },
  { eval: '(function(){ var d=document.getElementById("dock"); var a=document.getElementById("abilities"); return JSON.stringify({ dock:(d?d.innerText.slice(0,240):null), abilities:(a?a.innerText.slice(0,300):null), topbarGold:(document.getElementById("v-gold")||{}).textContent, topbarWave:(document.getElementById("v-wave")||{}).textContent }); })()' },

  /* FULL WAVE + 14 TOWERS PERF PROBE.
     Build all 14, start the wave, run sim to 8s so denizens are in range and
     firing, then sample rAF fps over 120 frames on the real GPU. */
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.step(8); window.__RQ.camera({ dist:32, pitch:0.78, yaw:0.5 }); "stepped"' },
  { wait: 300 },
  { eval: 'R.setProfiling(true); "prof"' },
  { eval: '(function(){ var s=R.stats(); return JSON.stringify({draws:s.draws, shadowDraws:s.shadowDraws, culled:s.culled, tris:s.tris, particles:s.particles, ms:+s.ms.toFixed(2)}); })()' },
  { eval: 'R.setProfiling(false); "none"' },
  { shot: 'qa-05-combat-full' },
  { eval: '(function(){ return new Promise(function(res){ var c=0; var t0=performance.now(); function loop(){ c++; if(c>=120){ res(JSON.stringify({fps:+(120000/(performance.now()-t0)).toFixed(1)})); } else { requestAnimationFrame(loop); } } requestAnimationFrame(loop); }); })()' },
  { eval: 'JSON.stringify(window.__RQ.snapshot())' },

  /* POST-WAVE sanity: no thrown loop errors; step a bit more. */
  { eval: 'window.__RQ.step(4); "ok"' },
  { eval: 'JSON.stringify(window.__RQ.errors())' }
];
