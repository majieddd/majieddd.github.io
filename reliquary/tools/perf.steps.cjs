module.exports = [
  { size: [1600, 900] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(40000); window.__RQ.upgradeAll(120000);',
      'window.__RQ.setWave(17); window.__RQ.startWave(); R.setProfiling(true);',
      'window.__RQ.step(14);',
      'var simMs=0, drawMs=0, n=24;',
      'for (var i=0;i<n;i++){',
      '  var a=performance.now(); for(var k=0;k<2;k++) SIM.step(1/120); var b=performance.now();',
      '  GAME.renderOnce(1/60); var c=performance.now();',
      '  simMs+=b-a; drawMs+=c-b; }',
      'var st=R.stats();',
      'JSON.stringify({ sim:+(simMs/n).toFixed(2), draw:+(drawMs/n).toFixed(2),',
      '  draws:st.draws, shadowDraws:st.shadowDraws, particles:st.particles,',
      '  denizens:GAME.state.denizens.length, towers:GAME.state.towers.length,',
      '  passes:Object.keys(st.ms).filter(function(k){return k[0]!=="_";})',
      '    .reduce(function(o,k){o[k]=+st.ms[k].toFixed(2);return o;},{}) })'
    ].join('\n') }
];
