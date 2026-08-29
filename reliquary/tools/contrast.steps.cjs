module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(30000);',
      'for(var i=0;i<8;i++){ var d=SIM.spawnDenizen("hivelord",{dist:16+i*6}); if(d) d.hp=d.maxHp=9e9; }',
      'for(var f=0;f<40;f++){ SIM.step(1/60); }',
      'GAME.renderOnce(1/60);',
      'var G=GAME.state, gl=R.gl, px=new Uint8Array(4);',
      'var dpr=Math.min(1.5, window.devicePixelRatio||1);',
      'function at(w){ var p=R.project(w); if(!p) return null;',
      '  var gx=Math.round(p.x*dpr), gy=Math.round(p.y*dpr);',
      '  if(gx<0||gy<0||gx>=gl.drawingBufferWidth||gy>=gl.drawingBufferHeight) return null;',
      '  gl.readPixels(gx, gl.drawingBufferHeight-gy, 1,1, gl.RGBA, gl.UNSIGNED_BYTE, px);',
      '  return 0.2126*px[0]+0.7152*px[1]+0.0722*px[2]; }',
      'function med(a){a=a.slice().sort(function(x,y){return x-y;});return a.length?a[a.length>>1]:-1;}',
      'var enemy=[], ground=[], tower=[];',
      'G.denizens.forEach(function(d){ var v=at([d.pos[0], d.pos[1]+1.2*d.scale, d.pos[2]]); if(v!==null) enemy.push(v); });',
      'G.board.plots.forEach(function(p,i){ if(i%3) return; if(G.board.distToPath(p.x,p.z)<G.board.pathWidth*2.6) return;',
      '  var v=at([p.x,p.y+0.05,p.z]); if(v!==null) ground.push(v); });',
      'G.towers.forEach(function(t){ var v=at([t.pos[0], t.pos[1]+1.6, t.pos[2]]); if(v!==null) tower.push(v); });',
      'JSON.stringify({ enemy:Math.round(med(enemy)), ground:Math.round(med(ground)),',
      '  tower:Math.round(med(tower)), nE:enemy.length, nG:ground.length, nT:tower.length })'
    ].join('\n') }
];
