module.exports = [
  { size: [1600, 900] },
  { wait: 1800 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 900 },
  { eval: 'window.__RQ.closeScreens(); document.getElementById("banner").style.display="none"; "ok"' },
  { eval: 'window.__RQ.spawn("stockman", 1, 30); window.__RQ.step(0.4); "spawned"' },
  // FREEZE the creature (stun stops d.dist advancing) so the body is one rigid pose
  { eval: '(function(){var d=GAME.state.denizens[0];d.stun=9999;return JSON.stringify({pos:d.pos,yaw:d.yaw,dist:d.dist});})()' },
  // STATIC base camera, one pose for every shot (framed on the straight WP2->WP3 segment)
  { eval: '(function(){window.__RQ.camera({focus:[-9,0.9,-6.1],dist:12.5,pitch:0.45,yaw:2.256});return "camera-set";})()' },
  // ---- A: creature at lane dist 32 (near WP2 end) ----
  { eval: '(function(){var d=GAME.state.denizens[0];d.dist=32;window.__RQ.step(0.02);return JSON.stringify({pos:d.pos,yaw:d.yaw,dist:d.dist});})()' },
  { wait: 400 },
  { shot: 'ab-A-front' },
  { eval: '(function(){var G=GAME.state;var d=G.denizens[0];window.__RQ.camera({focus:d.pos.slice(),dist:12.5,pitch:0.45,yaw:2.256+1.35});return JSON.stringify({pos:d.pos,yaw:d.yaw});})()' },
  { wait: 400 },
  { shot: 'ab-A-side' },
  // ---- B: creature at lane dist 40 (near WP3 end), restore STATIC base camera ----
  { eval: '(function(){var G=GAME.state;var d=G.denizens[0];window.__RQ.camera({focus:[-9,0.9,-6.1],dist:12.5,pitch:0.45,yaw:2.256});d.dist=40;window.__RQ.step(0.02);return JSON.stringify({pos:d.pos,yaw:d.yaw,dist:d.dist});})()' },
  { wait: 400 },
  { shot: 'ab-B-front' },
  { eval: '(function(){var G=GAME.state;var d=G.denizens[0];window.__RQ.camera({focus:d.pos.slice(),dist:12.5,pitch:0.45,yaw:2.256+1.35});return JSON.stringify({pos:d.pos,yaw:d.yaw});})()' },
  { wait: 400 },
  { shot: 'ab-B-side' },
  { eval: '(function(){var d=GAME.state.denizens[0];return JSON.stringify({pos:d.pos,yaw:d.yaw,dist:d.dist,stun:d.stun,alive:d.alive});})()' }
];
