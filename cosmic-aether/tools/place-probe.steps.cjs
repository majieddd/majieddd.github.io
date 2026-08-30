module.exports = [
  { size: [800, 500] },
  { wait: 2200 },
  { eval: 'window.__RQ.start({ board: 3, difficulty: 1 }); "ok"' },
  { wait: 1200 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: '(function(){ var G=GAME.state; var free=G.board.plots.filter(function(p){return !p.tower;}); var p=free[0]; var t=SIM.place(p.id, "bolt"); var any=false; var s=SIM.spawnDenizen("stockman", {dist: 60}); var d=G.denizens[G.denizens.length-1]; return JSON.stringify({ placed: !!t, at: t ? [Math.round(t.pos[0]*10)/10, Math.round(t.pos[1]*10)/10, Math.round(t.pos[2]*10)/10] : null, plot: p ? [Math.round(p.x*10)/10, Math.round(p.y*10)/10, Math.round(p.z*10)/10] : null, enemies: G.denizens.length, enemyPos: d ? [Math.round(d.pos[0]), Math.round(d.pos[1]), Math.round(d.pos[2])] : null }); })()' }
];
