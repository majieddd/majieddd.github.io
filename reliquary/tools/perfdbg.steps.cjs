module.exports = [
  { size: [1600, 900] },
  { wait: 2500 },
  { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(40000); window.__RQ.upgradeAll(120000);',
      'window.__RQ.setWave(17); window.__RQ.startWave();',
      'window.__RQ.step(14);',
      'R.setProfiling(true);',
      'var rows=[];',
      'for (var i=0;i<30;i++){',
      '  var t0=performance.now(); GAME.renderOnce(1/60); var t1=performance.now();',
      '  var m=R.stats().ms, sum=0, o={};',
      '  Object.keys(m).forEach(function(k){ if(k[0]!=="_"){ o[k]=+m[k].toFixed(2); sum+=m[k]; } });',
      '  rows.push({ w:+(t1-t0).toFixed(2), s:+R.quality.scale.toFixed(3), d:R.stats().draws });',
      '}',
      'JSON.stringify(rows)'
    ].join(String.fromCharCode(10)) }
];
