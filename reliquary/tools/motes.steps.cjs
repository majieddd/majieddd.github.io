module.exports = [
  { size: [1400, 800] },
  { wait: 2500 },
  { eval: [
      'var err=null;',
      'try{ window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      '  window.__RQ.closeScreens();',
      '  for(var f=0;f<180;f++){ SIM.step(1/60); FX.update(1/60); FX.moteUpdate(1/60); }',
      '}catch(e){ err = e.message; }',
      'var n=0, total=FX.count;',
      'for(var i=0;i<FX.count;i++){}',
      'var dbg = FX.debugKindCounts ? FX.debugKindCounts() : null;',
      'JSON.stringify({ err:err, particleCount:FX.count, bounds:FX.motes && FX.motes.bounds,',
      '  want:FX.motes && FX.motes.want, hasRand: typeof U.rand })'
    ].join(String.fromCharCode(10)) }
];
