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
try { diff = git(['diff', '--unified=0', base + '...HEAD', '--', 'js/']); }
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
const HARNESSES = ['tools/owner-sweep.js', 'tools/multiplayer_test.js'];
const EXPRESSION = { 'tools/multiplayer_test.js': ';MPT.all()' };

const coverageEntries = [];
for (const h of HARNESSES) {
  const stepsFile = path.join(os.tmpdir(),
    'newcov-' + path.basename(h, '.js') + '-' + process.pid + '.js');
  const harnessUrl = URL_.replace(/\/$/, '') + '/' + h;
  const expr = EXPRESSION[h] ? ' + ' + JSON.stringify(EXPRESSION[h]) : '';
  const load = '(async () => { const t = await (await fetch(' + JSON.stringify(harnessUrl) +
               ')).text(); return (0, eval)(t' + expr + '); })()';
  fs.writeFileSync(stepsFile,
    'module.exports = [{ size: [1600, 900] }, { wait: 2200 }, { eval: ' +
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
  if (parsed.coverage) coverageEntries.push(...parsed.coverage);
}

const out = { coverage: coverageEntries };
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

const perFile = new Map();               /* 'js/game.js' -> { starts, ranges } */
for (const entry of out.coverage) {
  const m = /\/(js\/[A-Za-z0-9_]+\.js)/.exec(entry.url || '');
  if (!m) continue;
  const rel = m[1];
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  if (!perFile.has(rel))
    perFile.set(rel, { starts: lineIndex(fs.readFileSync(abs, 'utf8')), ranges: [] });
  const bucket = perFile.get(rel);
  for (const fn of entry.functions || [])
    for (const r of fn.ranges || []) bucket.ranges.push(r);
}
/* Smallest first, so the FIRST range containing an offset is the innermost. */
for (const b of perFile.values())
  b.ranges.sort((x, y) => (x.endOffset - x.startOffset) - (y.endOffset - y.startOffset));

function countAt(bucket, off) {
  for (const r of bucket.ranges)
    if (r.startOffset <= off && off < r.endOffset) return r.count;
  return null;                           /* no range covers it: unknown, not cold */
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
  const bucket = perFile.get(rel);
  if (!bucket) continue;                 /* this page never loaded that file */
  const src = fs.readFileSync(abs, 'utf8').split('\n');
  const isCode = codeLines(src);
  const cold = [];
  for (const L of [...lines].sort((a, b) => a - b)) {
    const text = src[L - 1];
    if (text === undefined || !isCode[L - 1]) continue;
    const lead = text.length - text.replace(/^\s+/, '').length;
    const off = bucket.starts[L - 1] + lead;
    const c = countAt(bucket, off);
    if (c === null) continue;            /* unattributed, do not guess */
    totalAdded++;
    if (c === 0) { totalCold++; cold.push({ L, text: text.trim().slice(0, 88) }); }
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
