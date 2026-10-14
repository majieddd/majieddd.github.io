/* Per-term contribution with the animated film grain switched off, which is
   the only reason these numbers mean anything: grain alone puts a mean
   absolute difference of 2.62 between two otherwise identical renders, and
   every term here contributes less than that. */
module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(30000);',
      'for(var i=0;i<6;i++){ SIM.spawnDenizen("chitling",{dist:14+i*7}); }',
      'for(var f=0;f<40;f++){ SIM.step(1/60); }',
      'var gl=R.gl, grainWas=R.ART.grain; R.ART.grain=0;',
      'function snap(){ GAME.renderOnce(0);',
      '  var W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;',
      '  var b=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);',
      '  var n=W*H, L=new Float32Array(n);',
      '  for(var i=0;i<n;i++){ L[i]=0.2126*b[i*4]+0.7152*b[i*4+1]+0.0722*b[i*4+2]; }',
      '  return L; }',
      'function stats(key){ var was=R.ART[key];',
      '  var on=snap(); R.ART[key]=0; var off=snap(); R.ART[key]=was;',
      '  var n=on.length, mad=0, sum=0, mx=0, cov=0;',
      '  for(var i=0;i<n;i++){ var d=on[i]-off[i], a=Math.abs(d); mad+=a; sum+=d; if(a>mx)mx=a; if(a>1.5)cov++; }',
      '  return { mad:+(mad/n).toFixed(3), meanShift:+(Math.abs(sum)/n).toFixed(3),',
      '           cov:+(cov/n*100).toFixed(1), max:+mx.toFixed(1) }; }',
      'var out = { nullFloor: (function(){ var a=snap(), b=snap(), s=0;',
      '    for(var i=0;i<a.length;i++) s+=Math.abs(a[i]-b[i]); return +(s/a.length).toFixed(4); })(),',
      '  toothStrength:R.ART.toothStrength, specPower:R.ART.specPower,',
      '  spec:stats("specStrength"), tooth:stats("toothStrength"),',
      '  rim:stats("rimStrength"), ink:stats("inkStrength") };',
      'R.ART.grain=grainWas; JSON.stringify(out)'
    ].join(String.fromCharCode(10)) }
];
