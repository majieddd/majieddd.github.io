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

  /* `docs` IS IN THE SCAN. The owner's no-em-dash rule is absolute and covers
     prose, not just shipped strings, and docs/ was outside this list for its
     whole life: docs/ART-BIBLE.md carried one for months and was flagged in
     three separate sessions as "outside the gate's scan" rather than fixed.
     A rule phrased with never needs an exhaustive scan or it is a preference. */
  const em = run(process.execPath, ['tools/emdash.js', 'js', 'css', 'tools', 'docs', 'build.js', 'index.html']);
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

  /* THE EARTH-SYSTEM FACTION LOCK (owner, Session 42). An unlock gate is the
     kind of code that only ever runs on a save nobody in development has: a
     fresh account. It is also the kind that fails SILENTLY in the generous
     direction, handing the player everything, which no playtest reports as a
     bug. Mutation-tested: three planted defects, and the third (dropping the
     "faction is human" condition) escaped the first five checks and forced a
     sixth. See tools/probe-factionlock.js. */
  const fl = run(process.execPath, ['tools/probe-factionlock.js']);
  if (fl.code === 0) say('faction lock: ' + (fl.out.trim().split('\n').pop() || '').trim());
  else fail('faction lock: ' + fl.out.trim().split('\n')
                                 .filter(l => l.indexOf('[FAIL]') >= 0)
                                 .map(l => l.replace(/^\s*\[FAIL\]\s*/, '')).join('; '));

  /* THE COLD OPEN (owner, Session 42). Its guards all fail CLOSED, back to the
     ordinary menus, which is correct behaviour and also means a broken cold
     open is INVISIBLE: the player just sees the screens the game always had
     and nothing reports anything. So the preconditions are pinned instead. */
  /* THE AUTHORED WORLD TEXT. A bulk rewrite over planetcuts.js destroyed 28 of
     35 world NAMES and every existing gate stayed green: the file parsed, the
     line count held, the lengths held, and the storyboard reads names from the
     galaxy so it rendered perfectly over broken data. Verifying what you
     changed is not verifying what you might have broken. */
  const pc = run(process.execPath, ['tools/probe-planetcuts.js']);
  if (pc.code === 0) say('planet text: ' + (pc.out.trim().split('\n').pop() || '').trim());
  else fail('planet text: ' + pc.out.trim().split('\n')
                                .filter(l => l.indexOf('[FAIL]') >= 0)
                                .map(l => l.replace(/^\s*\[FAIL\]\s*/, '')).join('; '));

  const co = run(process.execPath, ['tools/probe-coldopen.js']);
  if (co.code === 0) say('cold open: ' + (co.out.trim().split('\n').pop() || '').trim());
  else fail('cold open: ' + co.out.trim().split('\n')
                              .filter(l => l.indexOf('[FAIL]') >= 0)
                              .map(l => l.replace(/^\s*\[FAIL\]\s*/, '')).join('; '));

  /* AN UNCLOSED CSS BLOCK CANNOT THROW, so it needs a counter. css/polish.css
     shipped with an `@media (max-width: 860px)` opened and never closed, which
     silently scoped the debug bar and the entire field-manual figure layout to
     phones: measured at 1280px, `.ce-fig` computed to display:inline at 0x0,
     so the portraits worked on a phone and were invisible on every desktop.
     No error, no red gate, because CSS auto-closes at EOF. */
  const cb = run(process.execPath, ['tools/cssbrace.js']);
  if (cb.code === 0) say(cb.out.trim());
  else fail('css braces: ' + cb.out.trim().split('\n')[0]);

  /* GAME DATA, ASSERTED BY LOADING THE GAME. tools/facts.js check holds the
     commander signature contract (own-origin towers, own-faction denizens, no
     shared pairs) and the banner-to-origin mapping that flyTheBanner depends
     on. It runs HERE, before the build, because it is a source-level contract
     and because it is fast: it loads the data modules in-process rather than
     driving a browser. */
  const ft = run(process.execPath, ['tools/facts.js', 'check']);
  if (ft.code === 0) say('commander signatures: ' + ft.out.trim().replace(/^facts check OK: /, ''));
  else fail('commander signatures: ' + ft.out.trim().split('\n').slice(1).map(l => l.trim()).join('; '));

  /* GEOMETRY PROPERTIES of every procedural board, in node because they are
     pure functions of (family, seed) and need no browser. Determinism is the
     one that matters for duels: both clients build the board from the same
     seed, so a non-deterministic generator desyncs on the first spawn. */
  const pm = run(process.execPath, ['tools/probe-mapgen.js', '40']);
  const pmLines = pm.out.trim().split(/\r?\n/).filter(l => l.trim());
  if (pm.code === 0) say('map geometry: ' + pmLines[pmLines.length - 1]);
  else {
    /* A CRASH IS NOT A FAILED PROPERTY, and the first cut printed an empty
       reason for one. Planting a laneless family made probe-mapgen.js throw
       before it could print any `FAIL Gn` line, so the filter matched nothing
       and the gate reported "map geometry:" followed by silence. Fall back to
       the tail of whatever it did say, which is the stack. */
    const named = pmLines.filter(l => /^FAIL/.test(l));
    /* The MESSAGE, not the tail of the stack. `slice(-3)` gave
       "at Module.executeUserEntryPoint ... Node.js v24.14.0", which says a
       crash happened and nothing about what. The throw line is the one that
       names it. */
    const thrown = pmLines.filter(l => /(Error|Cannot|undefined|is not a function)/.test(l))[0];
    fail('map geometry: ' + (named.length ? named.join(' | ')
                                          : (thrown || pmLines.slice(-1)[0] || 'probe produced no output')));
  }

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
  /* RETRY ONLY A FAILURE TO LAUNCH, and only once.
     Chrome intermittently never brings its debugger port up when the gate runs
     six browsers back to back against a machine whose GPU is saturated by a
     render. Measured twice in one session, on two different harnesses, and
     both times a plain re-run of the whole gate came back clean, which is the
     worst possible situation: a flake that is cleared by re-running is
     indistinguishable from a real failure that is being waved through.
     So the retry is NARROW. It fires only on the startup signature, never on a
     harness that actually ran and returned failures, and it says so in the
     output so a flaky machine is visible rather than silently smoothed over.
     If this line ever starts printing every run, the machine is the problem
     and hiding it here would be the bug. */
  const LAUNCH_FAIL = /chrome debugger never came up|Failed to launch|ERR_CONNECTION_REFUSED/i;
  let r = run(process.execPath, ['tools/headless.js', url, outDir, stepsFile], { timeout: 600000 });
  if (LAUNCH_FAIL.test(r.out || '')) {
    say(label + ': chrome did not start, retrying once (this is the browser, not the game)');
    r = run(process.execPath, ['tools/headless.js', url + 'r', outDir, stepsFile], { timeout: 600000 });
  }
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
  /* GEOMETRY IS NOT PLAYABILITY. probe-mapgen.js proves the arrays are sane;
     this starts a real battle on every procedural board and walks a body the
     length of the lane. A road that is generated, drawn, and never completed
     by anything looks perfect in every static check. */
  browserHarness('boards-play', '/tools/probe-boards-play.js', null);
  if (!QUICK) browserHarness('mpt', '/tools/multiplayer_test.js', ';MPT.all()');
  /* THE PHONE. Its own run at a real phone size, because every check above
     runs at 1600x900 where none of the phone rules exist. The owner's report
     that the game "doesn't really function that well on mobile" was true
     while this gate was clean, and nothing here could have said so. 360x800
     is the tightest of the common Android sizes and the one that failed the
     hardest when it was first measured. */
  browserHarness('mobile', '/tools/mobile-hud-audit.js', null, [360, 800]);
  /* THE BOARD ITSELF, which is a different question from the layout. The
     mobile audit measures how much CANVAS is not under a panel; this measures
     how much of the WORLD that canvas is showing and whether a hand can reach
     the rest. A canvas can pass every layout check and still be a keyhole:
     measured before this release, a fresh phone battle showed 25% of the
     board and had no gesture that could change the zoom in either direction. */
  browserHarness('board-view', '/tools/probe-board-view.js', null, [390, 844]);
  /* THE MIX WHEN NOTHING IS PLAYING. An always-on voice is the easiest thing
     in an audio engine to add and the hardest to notice: it never triggers, it
     never errors, and the person who finds it is the player. A room-tone bed
     shipped that way and was 30 dB of a mix that was supposed to be empty. */
  browserHarness('audio-silence', '/tools/probe-hiss.js', null, [1280, 800]);
} else if (!BASE) {
  say('browser gates: SKIPPED (no URL given; pass one to run them)');
}

console.log(out.join('\n'));
console.log(fails.length ? '\nGATE FAILED: ' + fails.length + ' problem(s)' : '\nGATE CLEAN');
process.exit(fails.length ? 1 : 0);
