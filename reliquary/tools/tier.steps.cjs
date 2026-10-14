module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(40000); window.__RQ.upgradeAll(120000);',
      'window.__RQ.setWave(17); window.__RQ.startWave(); window.__RQ.step(12);',
      '// gl.finish() forces the pipeline to drain. Without it performance.now()',
      '// around a draw measures COMMAND SUBMISSION, not GPU work, and the tiers',
      '// come out in the wrong order because the stall lands on whichever',
      '// measurement happens to run second.',
      'var gl = R.gl;',
      'function bench(tier){',
      '  R.setTier(tier);',
      '  R.adaptive.on = false; R.quality.scale = 0.75;',
      '  R.resize(1400, 800, 1);',
      '  for(var w=0;w<5;w++){ GAME.renderOnce(1/60); } gl.finish();',
      '  var t0=performance.now(), n=14;',
      '  for(var i=0;i<n;i++) GAME.renderOnce(1/60);',
      '  gl.finish();',
      '  return { tier:tier, ms:+((performance.now()-t0)/n).toFixed(2),',
      '           taps:R.quality.shadowTaps, map:R.quality.shadowSize,',
      '           bloom:R.quality.bloom, scale:R.quality.scale }; }',
      'var res=[bench("high"), bench("medium"), bench("low"), bench("high")];',
      'R.setTier("medium"); R.adaptive.on = true;',
      'JSON.stringify(res)'
    ].join('\n') }
];
