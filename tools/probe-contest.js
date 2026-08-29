/* Every contested world must name two DIFFERENT, REAL factions, in the order
   [holder, challenger], because ui.js takes the second one as contestedBy[1]
   and falls back to the pirates when it is missing. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const m of ['config', 'lore', 'factions', 'towers2', 'roster', 'story', 'galaxy'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', m + '.js'), 'utf8'), ctx, { filename: m }); }
  catch (e) {}
const gen = vm.runInContext('generateGalaxy', ctx);
const FACTIONS = vm.runInContext('FACTIONS', ctx);
const wso = vm.runInContext('worldScenarioOf', ctx);

const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
let contested = 0, bad = [], scen = {};
for (let seed = 1; seed <= 60; seed++) for (const f of FACS) {
  const g = gen(seed, f, 0, null, 2);
  g.systems.forEach(s => s.worlds.forEach(w => {
    const sc = wso(w);
    scen[sc.id] = (scen[sc.id] || 0) + 1;
    if (!w.contested) return;
    contested++;
    const cb = w.contestedBy;
    const why = !Array.isArray(cb) ? 'not an array'
      : cb.length !== 2 ? 'length ' + cb.length
      : !FACTIONS[cb[0]] ? 'holder "' + cb[0] + '" is not a faction'
      : !FACTIONS[cb[1]] ? 'challenger "' + cb[1] + '" is not a faction'
      : cb[0] === cb[1] ? 'contested against itself'
      : cb[0] !== w.owner ? 'first entry is not the holder'
      : null;
    if (why && bad.length < 5) bad.push(seed + '/' + f + ' ' + w.name + ': ' + why);
    if (why) bad.dirty = true;
  }));
}
console.log('contested worlds checked:', contested);
console.log('scenario spread across all worlds:', JSON.stringify(scen));
if (bad.length) { console.log('FAIL'); bad.forEach(b => console.log('  ' + b)); process.exit(1); }
console.log('OK: every contested world is [holder, challenger], both real, both different');
