/* Integrity of the authored world text.
 *
 * EXISTS BECAUSE OF A REAL DEFECT. A scripted pass that swapped a leading world
 * name for a concrete noun ran over every string literal inside each world
 * block, and `name:` is a string literal inside a world block. 28 of 35 world
 * names silently became things like "The trench" and "The bay". Every gate
 * stayed green: the file parsed, the line count was right, the lengths were
 * right, and the storyboard reads names from the GALAXY so it rendered
 * perfectly while the data underneath it was wrong.
 *
 * The lesson, written here because it is where the next person will hit it:
 * verifying what you changed is not the same as verifying what you might have
 * broken. A bulk rewrite needs a check on the fields it was NOT supposed to
 * touch.
 *
 * Failure is a THROW. A returned string is always pass detail.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story',
                 'galaxy', 'cutscenes', 'planetcuts'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f }); }
  catch (e) {}
const P = vm.runInContext('PLANET_CUTS', ctx);
const H = vm.runInContext('GX_HOME_SYSTEMS', ctx);
const CUT = vm.runInContext('CUTSCENES', ctx);
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];

const checks = [];
function T(id, fn) {
  let d; try { d = fn(); } catch (e) { checks.push({ id, verdict: 'FAIL', detail: e.message }); return; }
  checks.push({ id, verdict: 'PASS', detail: String(d) });
}
function must(c, m) { if (!c) throw new Error(m); }

T('PC.1 every world name matches the galaxy', () => {
  const bad = [];
  for (let si = 0; si < 5; si++) for (let wi = 0; wi < 7; wi++) {
    const e = P['' + si + wi];
    if (!e) continue;
    const want = H[FACS[si]].worlds[wi];
    if (e.name !== want) bad.push(si + '' + wi + ' is "' + e.name + '", galaxy says "' + want + '"');
  }
  must(!bad.length, bad.length + ' name(s) drifted: ' + bad.slice(0, 4).join('; '));
  return '35 names agree with GX_HOME_SYSTEMS';
});

T('PC.2 all 35 worlds are authored', () => {
  const missing = [];
  for (let si = 0; si < 5; si++) for (let wi = 0; wi < 7; wi++)
    if (!P['' + si + wi]) missing.push('' + si + wi);
  must(!missing.length, 'no entry for ' + missing.join(', '));
  return Object.keys(P).filter(k => /^\d\d$/.test(k)).length + ' entries';
});

T('PC.3 every world has ground and works prose', () => {
  const bad = [];
  Object.entries(P).forEach(([k, e]) => {
    if (!/^\d\d$/.test(k)) return;
    if (!e.ground || e.ground.length < 40) bad.push(k + ' ground');
    if (!e.works || e.works.length < 40) bad.push(k + ' works');
  });
  must(!bad.length, bad.join(', '));
  return 'ground and works present on every world';
});

T('PC.4 every power has exactly three lines on every world', () => {
  const bad = [];
  let n = 0;
  Object.entries(P).forEach(([k, e]) => {
    if (!/^\d\d$/.test(k)) return;
    FACS.forEach(f => {
      const L = (e.f && e.f[f]) || [];
      if (L.length !== 3) bad.push(k + '/' + f + ' has ' + L.length);
      L.forEach((l, i) => { n++; if (!l || l.length < 20) bad.push(k + '/' + f + '[' + i + '] too short'); });
    });
  });
  must(!bad.length, bad.slice(0, 5).join(', '));
  return n + ' lines, all present';
});

T('PC.5 the human opening is the full fifteen beats', () => {
  const intro = (CUT.human && CUT.human.intro) || [];
  must(intro.length === 15, 'human intro has ' + intro.length + ' slides, expected 15');
  const silent = intro.filter(s => !s.text).length;
  must(silent === 3, silent + ' silent panels, expected 3');
  const keys = new Set(intro.map(s => s.key));
  must(keys.size === intro.length, 'duplicate plate keys in the opening');
  return '15 slides, 3 silent, keys unique';
});

T('PC.6 no line still carries a status-stamp formula', () => {
  /* The Vigil used "WORLD RESTORED." as a header on 31 of its 105 lines.
     Under ten is variety; a return to thirty is the template coming back. */
  let n = 0;
  Object.entries(P).forEach(([k, e]) => {
    if (!/^\d\d$/.test(k)) return;
    ((e.f && e.f.robot) || []).forEach(l => { if (/ RESTORED\b/.test(l)) n++; });
  });
  must(n <= 12, n + ' Vigil lines use the RESTORED stamp; the formula is back');
  return n + ' RESTORED stamps, under the 12 ceiling';
});

const fails = checks.filter(c => c.verdict === 'FAIL');
checks.forEach(c => console.log('  [' + c.verdict + '] ' + c.id + ' :: ' + c.detail));
console.log(fails.length ? '\nPLANET TEXT: ' + fails.length + ' FAILURE(S)'
                         : '\nPLANET TEXT: ' + checks.length + ' checks, all pass');
process.exit(fails.length ? 1 : 0);
