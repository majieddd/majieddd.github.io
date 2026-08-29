function shot(mode, name) {
  return [
    { eval: 'R.ART.debugMode = ' + mode + '; GAME.renderOnce(1/60); "ok"' },
    { wait: 400 },
    { shot: name }
  ];
}
module.exports = [].concat(
  [ { size: [1200, 700] }, { wait: 2500 },
    { eval: [
      'window.__RQ.start({faction:"human",enemyFaction:"xeno",commander:"vanta",board:0,difficulty:1});',
      'window.__RQ.closeScreens(); window.__RQ.buildAll(30000);',
      'for(var i=0;i<10;i++){ var d=SIM.spawnDenizen(i%2?"hivelord":"broodmother",{dist:18+i*5}); if(d) d.hp=d.maxHp=9e9; }',
      'for(var f=0;f<40;f++){ SIM.step(1/60); }',
      'window.__RQ.camera({dist:44, pitch:0.62, yaw:0.3});',
      'JSON.stringify({ shadowsOn: R.quality.shadows, shadowSize: R.quality.shadowSize,',
      '  sunExtent: R.sun.extent, sunDir: R.sun.dir, camDist: GAME.cam.dist, scale: R.quality.scale })'
    ].join('\n') } ],
  shot(0, 'sh-normal'),
  shot(5, 'sh-visibility'),
  shot(2, 'sh-band'),
  [ { eval: 'R.ART.debugMode = 0; "ok"' } ]
);
