module.exports = [
  { size: [1600, 900] },
  { wait: 1600 },
  { eval: 'window.__RQ.start({ faction: "human", enemyFaction: "xeno", commander: "vanta", board: 0, difficulty: 1 }); "ok"' },
  { wait: 800 },
  { eval: 'window.__RQ.closeScreens(); "ok"' },
  { eval: 'window.__RQ.setGold(9000); window.__RQ.buildAll(); "built"' },
  { wait: 300 },
  { eval: 'R.quality.triplanar = 0; R.quality.autoexp = 0; R.quality.streak = 0; R.quality.bloom = 0; R.quality.ssao = 0; "flat"' },
  { wait: 200 },
  { shot: 'ab2-0-notriplanar' },
  { eval: 'R.setTier("medium"); "medium"' },
  { wait: 200 },
  { shot: 'ab2-1-medium' },
  { eval: 'R.setTier("high"); R.quality.msaa = 0; "hignomsaa"' },
  { wait: 400 },
  { shot: 'ab2-2-high-nomsaa' }
];
