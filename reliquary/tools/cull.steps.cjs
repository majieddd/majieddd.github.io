/* Proves frustum culling on two counts at once, because either alone is
   worthless: that it removes draws, and that it removes nothing visible. */
module.exports = [
  { size: [1600, 900] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(40000);',
      'window.__RQ.setWave(17); window.__RQ.startWave(); window.__RQ.step(10);',
      'var gl=R.gl, gw=R.ART.grain; R.ART.grain=0;',
      'function snap(){ GAME.renderOnce(0);',
      '  var W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;',
      '  var b=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);',
      '  var n=W*H, L=new Float32Array(n);',
      '  for(var i=0;i<n;i++) L[i]=0.2126*b[i*4]+0.7152*b[i*4+1]+0.0722*b[i*4+2];',
      '  return { L:L, st:R.stats() }; }',
      'function diff(a,b){ var s=0,mx=0,n=0;',
      '  for(var i=0;i<a.length;i++){ var d=Math.abs(a[i]-b[i]); s+=d; if(d>mx)mx=d; if(d>2)n++; }',
      '  return { mad:+(s/a.length).toFixed(4), max:+mx.toFixed(1), pxOver2:n }; }',
      'var res={};',
      'function measure(label, zoomed){',
      '  R.ART.cull=0; var off=snap();',
      '  R.ART.cull=1; var on=snap();',
      '  res[label]={ drawsOff:off.st.draws, drawsOn:on.st.draws,',
      '    shadowOff:off.st.shadowDraws, shadowOn:on.st.shadowDraws,',
      '    culled:on.st.culled, culledShadow:on.st.culledShadow,',
      '    imageDiff:diff(off.L,on.L) }; }',
      'measure("default");',
      'var cam = GAME.cam;',
'if (cam) { cam.targetDist = cam.dist = 30; cam.targetPitch = cam.pitch = 0.60;',
'  for(var z=0;z<10;z++) GAME.renderOnce(1/60); measure("zoomedIn"); }',
'else { res.zoomedIn = "no camera handle"; }',
      'R.ART.grain=gw; JSON.stringify(res)'
    ].join(String.fromCharCode(10)) }
];
