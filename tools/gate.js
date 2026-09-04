/* THE WHOLE GATE, ONE COMMAND, ONE COMPACT ANSWER.
 *
 * Why this exists. A verification pass on this project is: node --check every
 * module, the em dash gate, the byte gate, the build.js module list, a build,
 * then owner-sweep in a real browser, then MPT in a SEPARATE real browser
 * (invariant 3: MPT installs wrappers, so owner-sweep's source-reading checks
 * would grep the wrapper instead of the engine if they shared a page). Run by
 * hand that is six-plus commands, two Chrome launches, and several thousand
 * characters of JSON to read back. Measured in the session that produced this
 * file: the same gates were re-run six times across three sandbox tiers, and
 * each owner-sweep alone returned 11,325 characters of which four numbers
 * mattered.
 *
 * So this does three things the hand-run version does not:
 *   1. ENFORCES THE ORDER. owner-sweep and MPT each get their own fresh page
 *      load, by construction, because they are separate headless.js runs.
 *      The invariant stops being prose somebody has to remember.
 *   2. Prints ONE compact block. Counts, plus failing rows in full, plus
 *      console errors. A green run is about ten lines.
 *   3. Exits non-zero on any failure, so it is usable as a CI step or a
 *      pre-commit check rather than something a human reads and interprets.
 *
 * USAGE:
 *   python -m http.server 8601 --bind 127.0.0.1     # from the repo root
 *   node tools/gate.js http://127.0.0.1:8601
 *
 *   node tools/gate.js http://127.0.0.1:8601 --quick    # skip MPT (slow)
 *   node tools/gate.js --static                          # node-side gates only
 *
 * The URL should point at aegis-protocol.html's directory root. The gate
 * appends the filename and a cache-busting query itself, because `?v=N` on
 * the document busts nothing for module script tags and a stale bundle is
 * how a fixed defect reads as still broken.
 */
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const BASE = args.find(a => /^https?:\/\//.test(a)) || null;
const QUICK = args.includes('--quick');
const STATIC_ONLY = args.includes('--static') || !BASE;

const out = [];
const fails = [];
const say = s => out.push(s);
const fail = s => { fails.push(s); out.push('FAIL ' + s); };

function run(cmd, argv, opts) {
  const r = spawnSync(cmd, argv, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts || {}));
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/* ---------------------------------------------------------- node-side gates */

function staticGates() {
  const js = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
  let bad = 0;
  for (const f of js.concat(['build.js'])) {
    const p = f === 'build.js' ? 'build.js' : path.join('js', f);
    const r = run(process.execPath, ['--check', p]);
    if (r.code !== 0) { fail('parse ' + p + ': ' + r.out.split('\n')[0]); bad++; }
  }
  say('parse: ' + (js.length + 1) + ' files, ' + bad + ' bad');

  /* build.js's hardcoded module list vs what is actually on disk. A module
     added to js/ but not the list works when SERVED and breaks when BUNDLED,
     which is the worst possible failure shape: the dev path is fine and the
     two shipping surfaces silently lose it. This exact gap shipped once. */
  const listed = (fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8')
    .match(/const js\s*=\s*\[([^\]]*)\]/) || [, ''])[1].match(/[a-zA-Z0-9_]+/g) || [];
  const onDisk = js.map(f => f.replace(/\.js$/, ''));
  const missing = onDisk.filter(m => !listed.includes(m));
  if (missing.length) fail('build.js never inlines: ' + missing.join(', '));
  else say('module list: all ' + onDisk.length + ' listed');

  const em = run(process.execPath, ['tools/emdash.js', 'js', 'css', 'tools', 'build.js', 'index.html']);
  if (/would fix 0 occurrences/.test(em.out)) say('em dash: clean');
  else fail('em dash: ' + em.out.trim().split('\n').slice(0, 4).join(' | '));

  const bg = run(process.execPath, ['tools/bytegate.js', '.']);
  if (/clean/.test(bg.out)) say('bytes: clean');
  else fail('bytegate: ' + bg.out.trim().split('\n')[0]);

  /* A config field nothing reads is a promise the engine does not keep, and
     this project shipped two of them straight to the owner: scenario.spawn
     said "there is no far side at all" while every survive board drew a full
     rival half, and scenario.kind said 'survive' while no code gave a survive
     board any way to be won. Both read correctly and both were inert. */
  const df = run(process.execPath, ['tools/deadfields.js']);
  if (df.code === 0) say('dead config fields: none');
  else fail('dead config fields: ' + df.out.trim().split('\n').filter(l => /^\s{2}\S/.test(l))
                                       .map(l => l.trim().split(/\s+/)[0]).join(', '));

  const b = run(process.execPath, ['build.js']);
  if (b.code !== 0) fail('build.js: ' + b.out.trim().split('\n')[0]);
  else {
    const bundle = fs.readFileSync(path.join(ROOT, 'aegis-protocol.html'), 'utf8');
    if (bundle.includes('<script src=')) fail('bundle still references an external script');
    else say('build: ok, ' + (bundle.length / 1024).toFixed(0) + ' KB');
  }
}

/* ------------------------------------------------------------ browser gates */

/* Each harness gets its OWN headless.js run, which is its own page load and
   its own browser. That is what makes the ordering invariant structural
   rather than remembered. */
function browserHarness(label, harnessPath, expression, size) {
  const stepsFile = path.join(os.tmpdir(), 'gate-steps-' + label + '-' + process.pid + '.js');
  const outDir = path.join(os.tmpdir(), 'gate-shots-' + process.pid);
  const load = '(async () => { const t = await (await fetch(' + JSON.stringify(harnessPath) +
    ')).text(); return (0, eval)(t' + (expression ? ' + ' + JSON.stringify(expression) : '') + '); })()';
  /* THE SIZE IS AN ARGUMENT NOW. It was hard-coded to 1600x900, which is a
     width the phone rules never activate at: the mobile HUD could be, and
     was, completely broken with this gate fully green. tools/breakpoint-sweep.js
     already made this exact argument about a different breakpoint. */
  const px = size || [1600, 900];
  fs.writeFileSync(stepsFile,
    'module.exports = [{ size: [' + px[0] + ', ' + px[1] + '] }, { wait: 2200 },' +
    ' { eval: ' + JSON.stringify('document.hidden') + ' },' +
    ' { eval: ' + JSON.stringify(load) + ' }];\n');

  const url = BASE.replace(/\/$/, '') + '/aegis-protocol.html?v=gate' + Date.now() + label;
  const r = run(process.execPath, ['tools/headless.js', url, outDir, stepsFile], { timeout: 600000 });
  try { fs.unlinkSync(stepsFile); } catch (e) {}

  let d = null;
  try { d = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch (e) {
    fail(label + ': could not parse headless output: ' + r.out.trim().split('\n').slice(-2).join(' '));
    return;
  }
  const vals = (d.results || []).map(x => x.value);
  if (vals[0] === true) fail(label + ': document.hidden was true, measurements are not trustworthy');
  const res = vals.find(v => v && typeof v === 'object' && (v.checks || v.pass !== undefined));
  if (!res) { fail(label + ': harness returned nothing usable'); return; }

  const checks = res.checks || [];
  const f = checks.filter(c => c && c.verdict === 'FAIL');
  const p = typeof res.pass === 'number' ? res.pass : checks.filter(c => c.verdict === 'PASS').length;
  const i = typeof res.info === 'number' ? res.info : checks.filter(c => c.verdict === 'INFO').length;
  say(label + ': pass=' + p + ' fail=' + f.length + ' info=' + i + ' total=' + (checks.length || '?'));
  for (const c of f) fail(label + ' ' + c.id + ' :: ' + String(c.detail).slice(0, 240));

  const ce = d.consoleErrors || [];
  if (ce.length) fail(label + ': ' + ce.length + ' console error(s): ' + ce.slice(0, 2).join(' | '));
}

/* ------------------------------------------------------------------- report */

staticGates();
if (!STATIC_ONLY) {
  browserHarness('owner-sweep', '/tools/owner-sweep.js', null);
  /* THE SESSION 39 PROBE, run against the BUNDLE like everything else here.
     That is deliberately the harder target: the bundle DROPS the 875 planet
     plates (build.js), so this run exercises the degrade path every time,
     which is the path a partial render and the single-file download both take
     and which nothing else was covering. Its detection rate is measured by
     tools/probe-s39-mutants.js: 10 planted defects, 10 caught by the
     predicted check. Placed after owner-sweep and before MPT because it reads
     source-level state and MPT installs wrappers (invariant 3). */
  browserHarness('planet-cutscenes', '/tools/probe-s39.js', null);
  /* Same-page relative pins for the hostile-query hot paths. Absolute
     milliseconds are INFO; semantic parity and the relative wins are gated. */
  browserHarness('performance', '/tools/performance_test.js', null);
  /* Canvas draw has its own hot path. This page proves both the camera
     boundary and the whole-board detail contract, then measures the saved
     offscreen work against an unculled control in the same browser. */
  browserHarness('render-performance', '/tools/render_performance_test.js', null);
  if (!QUICK) browserHarness('mpt', '/tools/multiplayer_test.js', ';MPT.all()');
  /* THE PHONE. Its own run at a real phone size, because every check above
     runs at 1600x900 where none of the phone rules exist. The owner's report
     that the game "doesn't really function that well on mobile" was true
     while this gate was clean, and nothing here could have said so. 360x800
     is the tightest of the common Android sizes and the one that failed the
     hardest when it was first measured. */
  browserHarness('mobile', '/tools/mobile-hud-audit.js', null, [360, 800]);
} else if (!BASE) {
  say('browser gates: SKIPPED (no URL given; pass one to run them)');
}

console.log(out.join('\n'));
console.log(fails.length ? '\nGATE FAILED: ' + fails.length + ' problem(s)' : '\nGATE CLEAN');
process.exit(fails.length ? 1 : 0);
