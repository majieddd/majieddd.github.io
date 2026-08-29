/* Live production smoke test. Self-contained on purpose: the full harnesses
   fetch verify.js from the serving origin, and a single-file build published
   on its own has no tools directory beside it, so that fetch returns the 404
   page and evals as HTML. Everything here is inline. */
module.exports = [
  { size: [1400, 800] },
  { wait: 4000 },
  { eval: [
      'var out = { errors: [] };',
      'try {',
      '  out.hasGame = typeof GAME === "object";',
      '  out.hasR = typeof R === "object" && !!R.gl;',
      '  window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      '  window.__RQ.closeScreens(); window.__RQ.buildAll(40000);',
      '  window.__RQ.setWave(6); window.__RQ.startWave();',
      '  for (var f=0; f<600; f++) { SIM.step(1/60); FX.update(1/60); FX.moteUpdate(1/60); }',
      '  var g = GAME.state;',
      '  out.towers = g.towers.length;',
      '  out.wave = g.wave;',
      '  out.lives = g.lives;',
      '  out.kills = g.kills !== undefined ? g.kills : null;',
      '  out.rendered = GAME.renderOnce(1/60);',
      '  out.draws = R.stats().draws;',
      '  out.motes = (FX.debugKindCounts()[FX.KIND.MOTE]) || 0;',
      '  var badCol = 0, origPush = R.pushParticle;',
      '  R.pushParticle = function(x,y,z,r,gg,b,a,size,rot,kind){ if(kind!==FX.KIND.MOTE) return origPush.apply(R, arguments); if(!isFinite(r)||!isFinite(gg)||!isFinite(b)||r<0||r>1.3||gg<0||gg>1.3||b<0||b>1.3) badCol++; return origPush.apply(R, arguments); };',
      '  FX.submit(); R.pushParticle = origPush;',
      '  out.badMoteColors = badCol;',
      '  out.particleSoftness = R.ART.particleSoftness;',
      '  out.specPower = R.ART.specPower;',
      '  out.cull = R.ART.cull;',
      '  out.glErrors = R.errors().length;',
      /* A real pixel read, so this proves the page actually PAINTED rather
         than merely that its objects exist. */
      '  var gl=R.gl, W=gl.drawingBufferWidth, H=gl.drawingBufferHeight;',
      '  var b=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);',
      '  var s=0,n=W*H,nonBlack=0;',
      '  for (var i=0;i<n;i++){ var L=0.2126*b[i*4]+0.7152*b[i*4+1]+0.0722*b[i*4+2]; s+=L; if(L>8) nonBlack++; }',
      '  out.meanLum = +(s/n).toFixed(1);',
      '  out.litFraction = +(nonBlack/n).toFixed(3);',
      '} catch (e) { out.errors.push(e.message); }',
      'JSON.stringify(out)'
    ].join(String.fromCharCode(10)) }
];
