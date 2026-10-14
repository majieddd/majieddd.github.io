/* INVARIANT 2: the galaxy PRNG stream must not move.
 *
 * Authoring the other four acts rewrites owner/contested/scenario for 28
 * worlds ON PURPOSE, so a whole-galaxy hash is the wrong instrument: it would
 * go red for the intended change and tell us nothing about the unintended
 * one. What must be byte-identical is everything the STREAM produces --
 * ids, names, positions, kinds, maps, arenas, boons, seats -- because those
 * come from rnd() calls that this change must not have moved by one.
 *
 * Compares the working tree against a git revision across many seed/faction
 * pairs. The revision is an ARGUMENT and not hardcoded to HEAD on purpose:
 * once the change is committed, working-tree-versus-HEAD compares a thing to
 * itself and passes forever, which is the shape of a gate that has stopped
 * being a gate. Name the revision from BEFORE the change.
 *
 *   node tools/probe-stream.js            # against HEAD (uncommitted work)
 *   node tools/probe-stream.js HEAD~1     # after committing
 *   node tools/probe-stream.js bcb9cfa    # against any known-good revision
 */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const MODS = ['config', 'lore', 'factions', 'towers2', 'roster', 'story', 'galaxy'];

function loadGalaxy(srcFor) {
  const ctx = { console, window: {}, document: undefined };
  vm.createContext(ctx);
  for (const m of MODS) {
    try { vm.runInContext(srcFor(m), ctx, { filename: m }); } catch (e) {}
  }
  return ctx;
}

const workTree = m => fs.readFileSync(path.join(ROOT, 'js', m + '.js'), 'utf8');
const REV = process.argv[2] || 'HEAD';
const headTree = m => execSync(`git show ${REV}:js/${m}.js`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();

/* Fields fed by the stream. `owner`, `contested`, `contestedBy` and the
   scenario are deliberately NOT here: they are what this change rewrites. */
const STREAM_FIELDS = ['id', 'name', 'kind', 'map', 'arena', 'boon', 'seat', 'si', 'wi'];

function fingerprint(ctx, seed, fac) {
  const gen = vm.runInContext('generateGalaxy', ctx);
  const g = gen(seed, fac, 0, null, 2);
  const rows = [];
  (g.systems || []).forEach(s => (s.worlds || []).forEach(w => {
    rows.push(STREAM_FIELDS.map(f => f + '=' + JSON.stringify(w[f])).join('|') +
              '|x=' + Math.round((w.x || 0) * 1e6) + '|y=' + Math.round((w.y || 0) * 1e6));
  }));
  return rows.join('\n');
}

const a = loadGalaxy(workTree);
const b = loadGalaxy(headTree);
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
let pairs = 0, bad = 0;
const examples = [];
for (let seed = 1; seed <= 36; seed++) {
  for (const fac of FACS) {
    pairs++;
    const fa = fingerprint(a, seed, fac), fb = fingerprint(b, seed, fac);
    if (fa !== fb) {
      bad++;
      if (examples.length < 3) {
        const la = fa.split('\n'), lb = fb.split('\n');
        const i = la.findIndex((l, k) => l !== lb[k]);
        examples.push(`seed ${seed}/${fac} line ${i}\n    work: ${la[i]}\n    head: ${lb[i]}`);
      }
    }
  }
}
console.log(`stream fingerprint, working tree vs ${REV}, over ${pairs} seed/faction pairs`);
console.log(`  ${STREAM_FIELDS.join(', ')}, x, y`);
if (bad) {
  console.log(`\nFAIL: ${bad} of ${pairs} pairs differ -- the stream MOVED`);
  examples.forEach(e => console.log('  ' + e));
  process.exit(1);
}
console.log(`\nOK: identical in all ${pairs} pairs. The stream did not move.`);
