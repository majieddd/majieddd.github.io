/* AETHER :: tools/qa-combat
   Perf with denizens ALIVE and towers actively firing: build 14, start the
   wave, flood the lane with extra spawns, sample briefly so the field is
   full, then capture draw stats + a 120-frame rAF fps. */
'use strict';
module.exports = [
  { size: [1600, 900] },
  { wait: 2000 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); window.__RQ.startWave(); "built"' },
  { eval: 'window.__RQ.spawn("stockman", 28, 0.3); "spawned"' },
  { eval: 'window.__RQ.step(1.2); window.__RQ.camera({ dist:34, pitch:0.80, yaw:0.5, focus:[0,2,0] }); "stepped"' },
  { eval: 'var sn=window.__RQ.snapshot(); JSON.stringify({alive:sn.alive, denizens:sn.denizens, projectiles:sn.projectiles, kills:sn.kills})' },
  { wait: 300 },
  { eval: '(function(){ var s=R.stats(); return JSON.stringify({draws:s.draws, shadowDraws:s.shadowDraws, culled:s.culled, tris:s.tris, particles:s.particles}); })()' },
  { shot: 'qa-f-combat' },
  { eval: '(function(){ return new Promise(function(res){ var c=0; var t0=performance.now(); function loop(){ c++; if(c>=120){ res(JSON.stringify({fps:+(120000/(performance.now()-t0)).toFixed(1)})); } else { requestAnimationFrame(loop); } } requestAnimationFrame(loop); }); })()' },
  { eval: 'JSON.stringify(window.__RQ.errors())' }
];
