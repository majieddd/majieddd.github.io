"use strict";

module.exports = [
  { size: [1600, 900] },
  { wait: 900 },
  { eval: "(async function(){await window.__FORGE.ready;window.__FORGE.start();window.__FORGE.buildAll();window.__FORGE.spawnStress(28);return {ready:true,state:{enemies:window.__FORGE.state().enemies.length,towers:window.__FORGE.state().towers.length},errors:window.__FORGE.errors()};})()" },
  { wait: 2400 },
  { shot: "forge-stress" },
  { eval: "window.__FORGE.beginWave(); true" },
  { wait: 2600 },
  { shot: "forge-action" },
  { eval: "window.__FORGE.benchmark(90)" }
];
