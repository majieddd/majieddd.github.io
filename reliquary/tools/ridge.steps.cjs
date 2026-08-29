/* SURFACE MICRO-CONTRAST. Renders one deterministic frame, reads a block of
   pixels off the drawing buffer in the SAME eval as the draw (a later step
   gets zeros: the buffer is not preserved), and reports high-frequency
   energy, the mean absolute difference between a pixel and the average of its
   four neighbours. Smooth plastic scores low, a surface carrying paint crests
   scores high.

   EVERY FIGURE REPORTED IS MEAN-INDEPENDENT, and that is not a detail. The
   first version of this probe reported the fraction of pixels above 1.45x the
   frame mean, which quadrupled on a change that had barely touched texture at
   all: the threshold is defined in terms of the mean, so it moves whenever
   the picture merely darkens, and it did. Dividing by the mean (hfNorm, cv)
   measures the thing the eye actually reads as texture, which is contrast
   RELATIVE to local brightness, and cannot be faked by an exposure change. Runs against two builds in one session so the software
   rasteriser, canvas size and colour path are identical, which is the only
   condition under which these numbers may be compared at all. */
module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(30000);',
      'for(var f=0;f<40;f++){ SIM.step(1/60); }',
      'GAME.renderOnce(1/60);',
      'var gl=R.gl, W=gl.drawingBufferWidth, H=gl.drawingBufferHeight;',
      'var x0=Math.floor(W*0.28), y0=Math.floor(H*0.30);',
      'var cw=Math.floor(W*0.44), ch=Math.floor(H*0.34);',
      'var buf=new Uint8Array(cw*ch*4);',
      'gl.readPixels(x0, y0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, buf);',
      'var lum=new Float32Array(cw*ch), sum=0;',
      'for(var i=0;i<cw*ch;i++){ lum[i]=0.2126*buf[i*4]+0.7152*buf[i*4+1]+0.0722*buf[i*4+2]; sum+=lum[i]; }',
      'var mean=sum/(cw*ch), hf=0, n=0, var2=0;',
      'for(var y=1;y<ch-1;y++) for(var x=1;x<cw-1;x++){ var k=y*cw+x;',
      '  var nb=(lum[k-1]+lum[k+1]+lum[k-cw]+lum[k+cw])*0.25;',
      '  hf+=Math.abs(lum[k]-nb); n++; }',
      'for(var q=0;q<cw*ch;q++){ var dv=lum[q]-mean; var2+=dv*dv; }',
      'var sd=Math.sqrt(var2/(cw*ch));',
      'var aM=-1,aS=-1;',
      'try{ var cvA=PAINT.buildAtlas(256), ad=cvA.getContext("2d").getImageData(0,0,256,256).data;',
      '  var s1=0,s2=0,N=ad.length/4;',
      '  for(var q=3;q<ad.length;q+=4){ s1+=ad[q]; s2+=ad[q]*ad[q]; }',
      '  aM=s1/N; aS=Math.sqrt(Math.max(0,s2/N-aM*aM)); }catch(e){ aM=-2; }',
      'JSON.stringify({ hfNorm:+((hf/n)/mean).toFixed(5), cv:+(sd/mean).toFixed(4),',
      '  hf:+(hf/n).toFixed(3), meanLum:+mean.toFixed(1),',
      '  atlasAlphaMean:+aM.toFixed(1), atlasAlphaStd:+aS.toFixed(1), px:n })'
    ].join(String.fromCharCode(10)) }
];
