#!/usr/bin/env node
/* WHICH LINES DID THIS CHANGE ADD THAT THE GATE NEVER EXECUTES?
 *
 * WHY THIS EXISTS. Session 38 added FIELD DOCTRINE, detachment cooldowns, a
 * debug module, an illustrated field manual and a stance-driven dialogue
 * fallback, wrote sixteen checks alongside them, and shipped a GREEN GATE
 * anyway with eight symbols no harness executed at all: musterCdFor,
 * musterReadyCount, ttEsc, Debug.lose, Debug.clearWave, Debug.heal,
 * Debug.render and both xeno feed tells. They were found by hand, after the
 * fact, and only because somebody thought to look. The standing law already
 * says it ("code no gate executes is code that ships untested"); what was
 * missing was anything that ASKS.
 *
 * WHY IT MEASURES RATHER THAN GREPS. The first cut of this tool searched the
 * harnesses for each added symbol's NAME. It reported nine findings of which
 * EIGHT were false: MUSTER_CD_BASE_SEC, HUMAN_VET_HP_STEP, Debug.inBattle,
 * Game.promote and the rest are all genuinely exercised, just never named,
 * because they are reached THROUGH another call. Zero out HUMAN_VET_HP_STEP
 * and check 38.7 fails immediately. A tool that is wrong eight times in nine
 * does not get believed the ninth time, and a gate nobody believes is worse
 * than no gate.
 *
 * So this runs the real suite under Chrome's precise coverage profiler and
 * reports added lines with an execution count of zero. No inference, no name
 * matching, no false positives from transitive reach.
 *
 *   node tools/newcoverage.js <url>              # against origin/main, or main
 *   node tools/newcoverage.js <url> HEAD~3       # against any ref
 *
 * Exit 0 when every added line was executed, 1 otherwise, so it can gate.
 *
 * WHAT IT STILL CANNOT TELL YOU. An executed line is not an ASSERTED line.
 * A harness that calls a function and checks nothing about the result will
 * light this up green. This is a floor, not a ceiling: it proves the gate
 * reaches the code, never that the gate would notice the code misbehaving.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const URL_ = process.argv[2];
if (!URL_ || !/^https?:\/\//.test(URL_)) {
  console.error('usage: node tools/newcoverage.js http://127.0.0.1:PORT [baseRef]');
  process.exit(2);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

let base = process.argv[3];
if (!base) {
  for (const cand of ['origin/main', 'main']) {
    try { git(['rev-parse', '--verify', '--quiet', cand]); base = cand; break; } catch (e) { /* next */ }
  }
}
if (!base) { console.error('newcoverage: no base ref found, pass one explicitly'); process.exit(2); }

/* ---- 1. the added lines, per file, from the diff ------------------------
   `--unified=0` so a hunk header names exactly the added run and nothing
   around it: context lines are not this change's responsibility. */
let diff;
/* THE WORKING TREE, not `base...HEAD`.
   The line numbers from the diff are used to index the file ON DISK, so the
   two sides have to be the same revision. Diffing the committed HEAD while
   reading an edited working tree shifts every number by however much is
   uncommitted: measured, it attributed 28 lines of untouched reward-screen
   code in js/ui.js to a change that never went near it, and reported them
   cold. Comparing to the working tree also matches how this is used, which is
   BEFORE committing, to ask what the change left unexercised. */
try { diff = git(['diff', '--unified=0', base, '--', 'js/']); }
catch (e) { console.error('newcoverage: git diff against ' + base + ' failed: ' + e.message); process.exit(2); }

const added = new Map();                 /* 'js/game.js' -> Set(lineNo) */
let file = null;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) { file = line.slice(6).trim(); continue; }
  const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (h && file) {
    const start = parseInt(h[1], 10), count = h[2] === undefined ? 1 : parseInt(h[2], 10);
    if (!added.has(file)) added.set(file, new Set());
    for (let i = 0; i < count; i++) added.get(file).add(start + i);
  }
}
if (!added.size) { console.log('newcoverage: no js/ lines added since ' + base); process.exit(0); }

/* ---- 2. run the real suite under the profiler --------------------------
   owner-sweep is the suite that actually drives the engine. MPT is
   deliberately not run: it installs wrappers over Net._orig and its own
   header says owner-sweep must run first on a fresh page. */
/* TWO PROFILED RUNS, unioned, each on its own page load.

   owner-sweep alone is not the gate. MPT is the only harness that calls
   Net.fingerprint, so profiling owner-sweep by itself reported every line of
   the Session 38 fingerprint additions in js/net.js as unexecuted, which is a
   false alarm about the one file where a false alarm is most expensive.

   They run SEPARATELY and in this order because the suite's own invariant
   requires it: MPT installs wrappers over Net._orig, so owner-sweep's
   source-reading checks would grep the wrapper rather than the engine if it
   ran second on the same page. gate.js splits them for the same reason. */
/* EVERY HARNESS THE GATE RUNS, at the SIZE the gate runs it. The mobile
   audit only exists at phone width (the dock tab strip is display:none above
   the breakpoint), so profiling it at 1600x900 would execute none of it and
   report its whole surface as dead. That is the same "one implicit desktop
   size" mistake tools/breakpoint-sweep.js was written about. */
const HARNESSES = [
  { path: 'tools/owner-sweep.js', size: [1600, 900] },
  { path: 'tools/multiplayer_test.js', size: [1600, 900], expr: ';MPT.all()' },
  { path: 'tools/mobile-hud-audit.js', size: [360, 800] },
];

const coverageEntries = [];
for (const hh of HARNESSES) {
  const h = hh.path;
  const stepsFile = path.join(os.tmpdir(),
    'newcov-' + path.basename(h, '.js') + '-' + process.pid + '.js');
  const harnessUrl = URL_.replace(/\/$/, '') + '/' + h;
  const expr = hh.expr ? ' + ' + JSON.stringify(hh.expr) : '';
  const load = '(async () => { const t = await (await fetch(' + JSON.stringify(harnessUrl) +
               ')).text(); return (0, eval)(t' + expr + '); })()';
  fs.writeFileSync(stepsFile,
    'module.exports = [{ size: [' + hh.size[0] + ', ' + hh.size[1] + '] }, { wait: 2200 }, { eval: ' +
    JSON.stringify(load) + ' }];' + String.fromCharCode(10));
  let raw;
  try {
    raw = execFileSync(process.execPath,
      /* index.html, NOT aegis-protocol.html. gate.js profiles the bundle,
         which is ONE inlined script: its byte offsets belong to the bundle
         and cannot be mapped back to a js/game.js line number. The
         separate-module page is the only one where a range names a file. */
      ['tools/headless.js', URL_.replace(/\/$/, '') + '/index.html',
       path.join(os.tmpdir(), 'newcov-out-' + process.pid), stepsFile, '--coverage'],
      { cwd: ROOT, encoding: 'utf8', timeout: 600000, maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    console.error('newcoverage: the profiled run of ' + h + ' failed: ' +
                  (e.stdout || e.message).toString().slice(-400));
    process.exit(2);
  } finally { try { fs.unlinkSync(stepsFile); } catch (e) { /* best effort */ } }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { console.error('newcoverage: could not parse the ' + h + ' run output'); process.exit(2); }
  coverageEntries.push(parsed.coverage || []);   /* one array PER RUN */
}

const out = { coverage: coverageEntries.flat() };
if (!out.coverage.length) {
  console.error('newcoverage: no coverage for js/ came back. Is the page serving separate modules?');
  process.exit(2);
}

/* ---- 3. offsets to lines, INNERMOST RANGE WINS ------------------------
   THE TRAP THIS AVOIDS, and the first cut walked straight into it. V8 block
   coverage returns, per function, an OUTER range carrying that function's
   own call count PLUS nested ranges carrying 0 for the blocks inside it that
   never ran. The obvious loop (skip ranges whose count is 0, mark the rest as
   hit) therefore lets the outer range paint the whole function green,
   including every dead branch inside it.

   Measured: that version reported 534 of 534 added lines executed. A perfect
   score on a change that demonstrably contains unreached branches is the
   shape of an instrument that has stopped measuring, not of code that is
   perfectly covered, and it would have been believed.

   The fix is to ask, for each line, which is the SMALLEST range containing
   it, and take that range's count. A nested zero beats the enclosing
   non-zero, which is exactly what block coverage means.

   Each line is probed at its first non-whitespace character rather than at
   its start, because ranges begin and end mid-line and a line's leading
   indentation usually belongs to the enclosing block rather than to the
   statement written on it. */
function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

/* COVERAGE IS UNIONED PER RUN, NOT POOLED.
   The first cut concatenated the ranges from all three runs into one list and
   took the count of the smallest range containing a line. That is not a union
   of coverage, it is a mixture of contradictory reports: the desktop run
   carries a count-0 range for the dock-tab handler (the tab strip is
   display:none at 1600px, so it never fires there) and the phone run carries
   a count-1 range for the same code. Whichever happened to be smaller won,
   and four lines that demonstrably execute were reported dead while the
   mobile harness that executes them passed 9 of 9.

   A line is covered if ANY run executed it, so each run is resolved to its
   own hit set first and the sets are unioned. */
const fileText = new Map();
function startsFor(rel) {
  if (!fileText.has(rel)) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return null;
    fileText.set(rel, lineIndex(fs.readFileSync(abs, 'utf8')));
  }
  return fileText.get(rel);
}

const covered = new Map();
const seenFile = new Set();
for (const runEntries of coverageEntries) {
  const perRun = new Map();
  for (const entry of runEntries) {
    const m = /\/(js\/[A-Za-z0-9_]+\.js)/.exec(entry.url || '');
    if (!m) continue;
    const rel = m[1];
    if (!startsFor(rel)) continue;
    seenFile.add(rel);
    if (!perRun.has(rel)) perRun.set(rel, []);
    const rs = perRun.get(rel);
    for (const fn of entry.functions || [])
      for (const r of fn.ranges || []) rs.push(r);
  }
  for (const [rel, ranges] of perRun) {
    ranges.sort((x, y) => (x.endOffset - x.startOffset) - (y.endOffset - y.startOffset));
    const starts = startsFor(rel);
    if (!covered.has(rel)) covered.set(rel, new Set());
    const hit = covered.get(rel);
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    const code = codeLines(src);
    for (let L = 1; L <= src.length; L++) {
      if (!code[L - 1]) continue;
      const text = src[L - 1];
      const lead = text.length - text.replace(/^\s+/, '').length;
      const off = starts[L - 1] + lead;
      let c = null;
      for (const r of ranges) if (r.startOffset <= off && off < r.endOffset) { c = r.count; break; }
      if (c) hit.add(L);
    }
  }
}

/* ---- 4. added AND never executed ---------------------------------------
   Blank lines, comments and bare closers are not executable and would drown
   the answer, so they are dropped before reporting rather than counted and
   explained away afterwards. */
/* A per-line test cannot see a block comment: its CONTINUATION lines start
   with ordinary words, so the first cut reported ten lines of the fingerprint
   comment in js/net.js as unexecuted code. Comment state has to be carried
   down the file, which means classifying the whole file once. */
function codeLines(src) {
  const out = new Array(src.length).fill(false);
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const x = raw.trim();
    const wasInBlock = inBlock;
    let j = 0, sawCode = false;
    while (j < raw.length) {
      if (inBlock) {
        const e = raw.indexOf('*/', j);
        if (e === -1) { j = raw.length; } else { inBlock = false; j = e + 2; }
        continue;
      }
      const b = raw.indexOf('/*', j), l = raw.indexOf('//', j);
      if (b !== -1 && (l === -1 || b < l)) {
        if (raw.slice(j, b).trim()) sawCode = true;
        inBlock = true; j = b + 2; continue;
      }
      if (l !== -1) { if (raw.slice(j, l).trim()) sawCode = true; j = raw.length; continue; }
      if (raw.slice(j).trim()) sawCode = true;
      j = raw.length;
    }
    if (!x) continue;
    if (wasInBlock && !sawCode) continue;
    if (/^[)\]};,]+$/.test(x)) continue;
    out[i] = sawCode;
  }
  return out;
}

let totalAdded = 0, totalCold = 0;
const report = [];
for (const [rel, lines] of added) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  if (!seenFile.has(rel)) continue;      /* this page never loaded that file */
  const hit = covered.get(rel) || new Set();
  const src = fs.readFileSync(abs, 'utf8').split('\n');
  const isCode = codeLines(src);
  const cold = [];
  for (const L of [...lines].sort((a, b) => a - b)) {
    const text = src[L - 1];
    if (text === undefined || !isCode[L - 1]) continue;
    totalAdded++;
    if (!hit.has(L)) { totalCold++; cold.push({ L, text: text.trim().slice(0, 88) }); }
  }
  if (cold.length) report.push({ rel, cold });
}

const pct = totalAdded ? Math.round((totalAdded - totalCold) / totalAdded * 100) : 100;
console.log('newcoverage: ' + totalAdded + ' executable line(s) added since ' + base +
            ', ' + totalCold + ' never executed by the gate (' + pct + '% reached)');
if (!totalCold) { console.log('  every added line runs under the gate'); process.exit(0); }
console.log('');
for (const f of report) {
  console.log('  ' + f.rel);
  for (const c of f.cold.slice(0, 12)) console.log('    ' + String(c.L).padStart(5) + '  ' + c.text);
  if (f.cold.length > 12) console.log('    ' + '...'.padStart(5) + '  and ' + (f.cold.length - 12) + ' more');
}
console.log('\nEach line above is code the gate cannot reach. Write the check, or');
console.log('say out loud in the summary that it shipped unexercised.');
process.exit(1);
