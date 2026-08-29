module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens();',
      'var gl=R.gl, gw=R.ART.grain; R.ART.grain=0;',
      'function mean(){ GAME.renderOnce(0);',
      '  var W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;',
      '  var b=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);',
      '  var s=0,n=W*H; for(var i=0;i<n;i++) s+=0.2126*b[i*4]+0.7152*b[i*4+1]+0.0722*b[i*4+2];',
      '  return +(s/n).toFixed(3); }',
      'FX.clear(); var bare = mean();',
      'var g=GAME.state; var c=g.board.pathAt(g.board.path.length*0.4).pos;',
      'var gy=g.board.heightAt(c[0],c[2]);',
      'for(var i=0;i<300;i++){ FX.spawn({ x:c[0]+((i%20)-10)*0.9, y:gy+0.4+(i%5)*0.25, z:c[2]+(((i/20)|0)-7)*0.9,',
      '  r:1,g:0.9,b:0.8, life:9, size:1.6, kind:FX.KIND.SMOKE, alpha:0.7, grav:0, drag:0 }); }',
      'for(var w=0;w<120;w++) FX.update(1/60);',
      'var counts = FX.debugKindCounts();',
      'var withCloud = mean();',
      'R.ART.particleSoftness=0.001; var hard=mean();',
      'R.ART.particleSoftness=6.0;   var soft=mean();',
      'R.ART.particleSoftness=1.35;',
      'R.ART.grain=gw;',
      'JSON.stringify({ bare:bare, withCloud:withCloud, hard:hard, soft:soft,',
      '  smokeN:counts[FX.KIND.SMOKE]||0, total:FX.count, groundY:gy, slot0:R.debugParticleSlot(0) })'
    ].join(String.fromCharCode(10)) }
];
