/* Adversarial read of the campaign text, as data.
 *
 * A creative judgement is only worth as much as what it looked at, and 35
 * worlds times 5 powers times 3 lines is 525 strings: exactly the size where
 * reading "carefully" silently becomes reading the first three and inferring
 * the rest. This measures the things a director would otherwise assert.
 *
 * Run: node tools/story_audit.js            (report)
 *      node tools/story_audit.js --json     (machine readable, for the storyboard)
 */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'roster', 'story', 'cutscenes', 'planetcuts'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* module not needed for this read */ }

const P = vm.runInContext('PLANET_CUTS', ctx);
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const SYS = ['THE EARTH SYSTEM', 'THE PLEIADES', 'ZETA RETICULI', 'PROXIMA CENTAURI', 'SIRIUS'];

/* ---- collect every cell ---- */
const cells = [];          // {si,wi,world,fac,beat,text}
const grounds = [];        // {si,wi,world,text}
for (const si of [0, 1, 2, 3, 4]) for (let wi = 0; wi < 7; wi++) {
  const e = P['' + si + wi];
  if (!e) continue;
  grounds.push({ si, wi, world: e.name, ground: e.ground || '', works: e.works || '' });
  FACS.forEach(f => ((e.f && e.f[f]) || []).forEach((t, b) =>
    cells.push({ si, wi, world: e.name, fac: f, beat: b, text: t })));
}

/* ---- 1. Narration test: does a line open as a SENTENCE or as a label? ----
   A human narrating says "The fragments came down over a coastal city."
   A museum placard says "A coastal city under the fall, where the fragments..."
   Heuristic: take the first clause (up to the first comma or full stop) and ask
   whether it contains a finite verb. A bare noun phrase has none. This is a
   heuristic and it is reported as a flag to read, never as an automatic verdict. */
/* The finite-verb list is the instrument, and it was WRONG before it was right.
   First pass flagged five lines that are perfectly good narration, because the
   list did not contain floats, cut, climbs, rises or strips. A detector with a
   hand-written vocabulary will always under-report; it is kept because the
   defect it looks for (an opening clause that is a bare noun phrase) has no
   cheaper test, and every flag is read by eye before anything is rewritten.
   Suspect the instrument before the system. */
const FINITE = new RegExp('\\b(' + [
  'is|are|was|were|be|been|has|have|had|does|do|did',
  'will|would|can|could|should|must|may|might',
  'came|come|comes|stands?|stood|runs?|ran|holds?|held|sits?|sat|lies?|lay',
  'keeps?|kept|goes|go|went|makes?|made|took|takes?|turns?|turned',
  'burns?|burned|hangs?|hung|locks?|locked|opens?|opened|closes?|closed',
  'walks?|walked|left|leaves?|gave|gives?|threw|throws?|says?|said',
  'knows?|knew|built|builds?|drove|drives?|dug|digs?|floats?|floated',
  'cut|cuts|climbs?|climbed|rises?|rose|strips?|stripped|banks?|banked',
  'tries|tried|moors?|moored|spins?|spun|feeds?|fed|fires?|fired',
  'covers?|covered|seals?|sealed|guards?|guarded|never',
].join('|') + ')\\b', 'i');

function firstClause(s) {
  const m = String(s).split(/[,.;:]/)[0] || '';
  return m.trim();
}
const labelGrounds = grounds.filter(g => g.ground && !FINITE.test(firstClause(g.ground)));

/* ---- 2. Formula detection across the 525 lines ---- */
function opener(s, n) { return String(s).trim().split(/\s+/).slice(0, n).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, ''); }

const openerCount = {};
cells.forEach(c => {
  const k = opener(c.text, 3);
  (openerCount[k] = openerCount[k] || []).push(c);
});
const repeatedOpeners = Object.entries(openerCount)
  .filter(([, v]) => v.length >= 4)
  .sort((a, b) => b[1].length - a[1].length);

/* Beat 3 formula: how many "new order" lines simply restate the world name */
const beat3 = cells.filter(c => c.beat === 2);
const beat3NamesItself = beat3.filter(c =>
  new RegExp('^\\s*' + c.world.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(c.text));

/* The robot voice leans on a single construction */
const robotRestored = cells.filter(c => c.fac === 'robot' && / RESTORED\b/.test(c.text));

/* ---- 3. Repeated phrases: 5-grams appearing in 3+ different worlds ---- */
const gram = {};
cells.forEach(c => {
  const w = c.text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i + 5 <= w.length; i++) {
    const g = w.slice(i, i + 5).join(' ');
    (gram[g] = gram[g] || new Set()).add(c.si + '' + c.wi + c.fac);
  }
});
const stockPhrases = Object.entries(gram)
  .filter(([, s]) => s.size >= 3)
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 25)
  .map(([g, s]) => ({ phrase: g, uses: s.size }));

/* ---- 4. Does the premise propagate? ---- */
/* Does a cell connect its world back to WHY the war started?
 *
 * This pattern was widened once, after the reversal pass, because the new lines
 * say "the Earth event" and "before the rock turned" and the first version only
 * knew the word Apophis. Widening a metric to improve your own score is exactly
 * what goalpost-moving looks like from outside, so every match is PRINTED for
 * inspection rather than only counted. If a listed line is not really a premise
 * reference, the pattern is wrong and should be narrowed again. */
const PREMISE = new RegExp([
  'apophis', 'the rock\\b', 'the rock turned', 'hollow', 'trojan',
  'delivery vehicle', 'the earth (?:event|delivery|entry|account|file)',
  'protection order', 'what came out of', 'the fall\\b',
  'the intercept', 'fragment hull', 'before the rock',
].join('|'), 'i');
const premiseByAct = SYS.map((s, si) => ({
  system: s,
  hits: cells.filter(c => c.si === si && PREMISE.test(c.text)).length,
  of: cells.filter(c => c.si === si).length,
  examples: cells.filter(c => c.si === si && PREMISE.test(c.text))
    .map(c => c.world + '/' + c.fac + ': ' + c.text.slice(0, 88)),
}));

/* ---- 5. Leaks from the encyclopedia layer ---- */
const LEAK = /\blattice\b|\barchive wars?\b|\bseverance\b|\barchon|\banunnaki|\broswell|\bserpent court|\bevidence (?:layer|grade)/i;
const leaks = cells.filter(c => LEAK.test(c.text))
  .concat(grounds.filter(g => LEAK.test(g.ground) || LEAK.test(g.works))
    .map(g => ({ si: g.si, wi: g.wi, world: g.world, fac: 'GROUND', beat: -1, text: g.ground })));

/* ---- 6. Per-faction tics ---- */
const tics = {};
FACS.forEach(f => {
  const t = cells.filter(c => c.fac === f);
  const words = {};
  t.forEach(c => c.text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 4)
    .forEach(w => words[w] = (words[w] || 0) + 1));
  tics[f] = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 8);
});

const report = {
  totals: { worlds: grounds.length, cells: cells.length },
  labelGrounds: labelGrounds.map(g => ({ key: '' + g.si + g.wi, world: g.world, ground: g.ground })),
  repeatedOpeners: repeatedOpeners.map(([k, v]) => ({
    opener: k, count: v.length,
    where: v.slice(0, 6).map(c => c.world + '/' + c.fac + '/b' + (c.beat + 1)),
  })),
  beat3NamesItself: beat3NamesItself.length,
  beat3Total: beat3.length,
  robotRestored: robotRestored.length,
  robotTotal: cells.filter(c => c.fac === 'robot').length,
  stockPhrases,
  premiseByAct,
  leaks: leaks.map(l => ({ world: l.world, fac: l.fac, text: l.text.slice(0, 120) })),
  tics,
};

if (process.argv.includes('--json')) {
  const dest = path.join(ROOT, '_review', 'story_audit.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(report, null, 2), 'utf8');
  console.log('wrote ' + dest);
} else {
  const R = report;
  console.log('worlds ' + R.totals.worlds + ', dialogue cells ' + R.totals.cells + '\n');
  console.log('1. GROUND LINES THAT READ AS LABELS, NOT NARRATION: ' +
    R.labelGrounds.length + ' of ' + R.totals.worlds);
  R.labelGrounds.slice(0, 8).forEach(g => console.log('   ' + g.key + ' ' + g.world + ': ' + g.ground.slice(0, 68)));
  console.log('\n2. REPEATED 3-WORD OPENERS (4+ uses): ' + R.repeatedOpeners.length);
  R.repeatedOpeners.slice(0, 8).forEach(o => console.log('   x' + o.count + '  "' + o.opener + '"'));
  console.log('\n3. BEAT 3 THAT OPENS BY NAMING ITS OWN WORLD: ' +
    R.beat3NamesItself + ' of ' + R.beat3Total);
  console.log('   ROBOT lines using "X RESTORED": ' + R.robotRestored + ' of ' + R.robotTotal);
  console.log('\n4. STOCK PHRASES (same 5 words, 3+ worlds): ' + R.stockPhrases.length);
  R.stockPhrases.slice(0, 8).forEach(p => console.log('   x' + p.uses + '  "' + p.phrase + '"'));
  console.log('\n5. DOES THE PREMISE PROPAGATE?');
  R.premiseByAct.forEach(a => console.log('   ' + a.system.padEnd(18) + ' ' + a.hits + '/' + a.of + ' cells reference the inciting event'));
  console.log('\n6. ENCYCLOPEDIA LEAKS INTO PLAYER TEXT: ' + R.leaks.length);
  R.leaks.slice(0, 6).forEach(l => console.log('   ' + l.world + '/' + l.fac + ': ' + l.text.slice(0, 80)));
  console.log('\n7. PER-POWER WORD TICS');
  Object.entries(R.tics).forEach(([f, t]) =>
    console.log('   ' + f.padEnd(7) + t.slice(0, 6).map(x => x[0] + ':' + x[1]).join('  ')));
}
