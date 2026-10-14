"use strict";

module.exports = [
  { size: [1600, 900] },
  { wait: 700 },
  { eval: "(async function(){await window.__FORGE.ready;window.__FORGE.start();window.__FORGE.buildAll();window.__FORGE.spawnStress(44);window.__FORGE.beginWave();return {probe:'stress-setup',enemies:window.__FORGE.state().enemies.length,towers:window.__FORGE.state().towers.length};})()" },
  { wait: 3600 },
  { shot: "adversarial-stress" },
  { eval: "window.__FORGE.benchmark(90).then(function(v){v.probe='stress-benchmark';return v})" },
  { eval: "(function(){var s=window.__FORGE.state();var ids=s.enemies.map(function(e){return e.id});return {probe:'state-invariants',finite:s.enemies.every(function(e){return Number.isFinite(e.hp)&&Number.isFinite(e.distance)&&e.maxHp>0}),unique:new Set(ids).size===ids.length,gold:s.gold,lives:s.lives,enemies:s.enemies.length,towers:s.towers.length,errors:window.__FORGE.errors()};})()" },
  { eval: "globalThis.__shadowStress=window.__FORGE.shadowState();window.__FORGE.orbitCamera(-2.7,1.1,19);true" },
  { wait: 850 },
  { eval: "(function(){var b=window.__FORGE.shadowState(),d=0;b.matrix.forEach(function(v,i){d=Math.max(d,Math.abs(v-globalThis.__shadowStress.matrix[i]));});return {probe:'stress-shadow',matrixDelta:d};})()" },
  { eval: "window.__FORGE.setQuality('ultra');globalThis.__bosses=window.__FORGE.spawnLineup();true" },
  { wait: 1400 },
  { shot: "adversarial-ultra" },
  { eval: "({probe:'ultra',stats:window.__FORGE.stats(),errors:window.__FORGE.errors(),animationParts:Object.keys(window.__FORGE.animationState(globalThis.__bosses[4])).length})" },
  { size: [390, 844] },
  { wait: 700 },
  { shot: "adversarial-mobile" },
  { eval: "({probe:'mobile-stress',overflow:document.body.scrollWidth-window.innerWidth,errors:window.__FORGE.errors()})" }
];
