const RUN = "(async () => (0, eval)(await (await fetch('/cosmic-aether/tools/verify.js')).text()))()";
module.exports = [
  { size: [1600, 900] },
  { wait: 2500 },
  { eval: RUN }
];
