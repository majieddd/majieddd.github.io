module.exports = [
  { size: [1600, 900] },
  { wait: 1600 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 800 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { wait: 200 },
  { eval: 'JSON.stringify({msaa: R.quality.msaa, tier: R.quality.tier, main: R.probeMain(0.5, 0.55)})' },
  { wait: 1500 },
  { eval: 'JSON.stringify({msaa: R.quality.msaa, tier: R.quality.tier, main: R.probeMain(0.5, 0.55)})' },
  { shot: 'probe-late' }
];
