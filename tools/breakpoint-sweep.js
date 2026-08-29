#!/usr/bin/env node
/**
 * BREAKPOINT SWEEP: run a harness across the widths that matter, not one
 * implicit desktop size.
 *
 * WHY THIS EXISTS. A CSS regression (Session 32) put a commander bar 259.8px
 * below the fold at a max-width:1050px breakpoint. It shipped, and the
 * regular verification pass never caught it, because "run owner-sweep" meant
 * "run it once, at whatever size headless.js's window defaults to" -- and
 * that default is 1600x900, a width the broken breakpoint never activates at
 * all. The check that would have caught it (owner-sweep.js 28.1) can only
 * fail at a width <= 1050px; run at 1600x900 it reports INFO, correctly, and
 * a session that stops there has learned nothing about the breakpoint.
 *
 * This script is the fix for THAT gap, not for the CSS bug itself: it makes
 * "the width that matters" the default rather than something to remember.
 * Every breakpoint in DEFAULT_BREAKPOINTS runs the SAME harness, and any
 * check whose verdict DIFFERS between breakpoints is surfaced explicitly, so
 * a bug that only exists at one width cannot hide behind a green run at
 * another.
 *
 * USAGE:
 *   python -m http.server 8471 --bind 127.0.0.1
 *   node tools/breakpoint-sweep.js http://127.0.0.1:8471/index.html <outdir> \
 *     [harnessPath] [w1xh1,w2xh2,...]
 *
 *   harnessPath   defaults to tools/owner-sweep.js, fetched relative to the
 *                 URL's origin the same way steps files already do
 *   breakpoints   defaults to the four widths this project's own layout
 *                 audit actually used: 1600x900 (desktop), 1024x900 (just
 *                 inside the 1050px CSS breakpoint), 768x1024 (tablet), and
 *                 390x844 (phone)
 *
 * Exit 0 if every breakpoint's harness reports fail:0. Exit 1 otherwise, with
 * every breakpoint-specific failure and every breakpoint-only DIVERGENCE
 * (same check, different verdict at a different width) printed by name.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const DEFAULT_BREAKPOINTS = ['1600x900', '1024x900', '768x1024', '390x844'];

const [, , URL_, OUTDIR, HARNESS_ARG, BP_ARG] = process.argv;
if (!URL_ || !OUTDIR) {
  console.log('usage: node breakpoint-sweep.js <url> <outdir> [harnessPath] [w1xh1,w2xh2,...]');
  process.exit(2);
}
const harnessPath = HARNESS_ARG || 'tools/owner-sweep.js';
const breakpoints = (BP_ARG ? BP_ARG.split(',') : DEFAULT_BREAKPOINTS)
  .map(s => s.trim()).filter(Boolean)
  .map(s => { const [w, h] = s.split('x').map(Number); return { w, h, label: s }; });

fs.mkdirSync(OUTDIR, { recursive: true });

function stepsFileFor(bp) {
  /* Fetched, not pasted: the whole reason a 69KB harness costs a few hundred
     tokens instead of tens of thousands (AGENTS.md, "what actually saves
     tokens here"). Kept true here even though this script's caller is Node,
     not a transcript, because the FILE this writes is what a human or a
     future session reads back when a run needs to be reproduced by hand. */
  const urlPath = '/' + harnessPath.replace(/^\/+/, '');
  const RUN = "(async () => { (0, eval)(await (await fetch(" + JSON.stringify(urlPath) +
              ")).text()); return window.__SWEEP || (typeof MPT !== 'undefined' ? MPT.all() : null); })()";
  const body = 'module.exports = [{size:[' + bp.w + ',' + bp.h + ']},{wait:2500},{eval:' +
               JSON.stringify(RUN) + '}];';
  const f = path.join(OUTDIR, 'steps_' + bp.label + '.js');
  fs.writeFileSync(f, body);
  return f;
}

const results = [];
for (const bp of breakpoints) {
  const stepsFile = stepsFileFor(bp);
  const r = spawnSync('node', [path.join(HERE, 'headless.js'), URL_, path.join(OUTDIR, bp.label), stepsFile],
                       { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    results.push({ breakpoint: bp.label, error: (r.stderr || r.stdout || 'unknown failure').trim() });
    continue;
  }
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch (e) {
    results.push({ breakpoint: bp.label, error: 'headless.js did not return JSON: ' + r.stdout.slice(0, 300) });
    continue;
  }
  const sweep = parsed.results && parsed.results[0] && parsed.results[0].value;
  results.push({ breakpoint: bp.label, sweep, consoleErrors: parsed.consoleErrors || [] });
}

/* Surface anything that FAILED at any single breakpoint, plainly. */
let anyFail = false;
for (const r of results) {
  if (r.error) { anyFail = true; console.log(r.breakpoint + ': DRIVER ERROR: ' + r.error); continue; }
  if (!r.sweep || !r.sweep.checks) { anyFail = true; console.log(r.breakpoint + ': no sweep result'); continue; }
  const fails = r.sweep.checks.filter(c => c.verdict === 'FAIL');
  console.log(r.breakpoint + ': pass ' + r.sweep.pass + ' fail ' + r.sweep.fail + ' info ' + r.sweep.info +
              (r.consoleErrors.length ? '  (' + r.consoleErrors.length + ' console errors)' : ''));
  for (const f of fails) { anyFail = true; console.log('  FAIL  ' + f.id + '  ' + f.detail); }
}

/* Surface DIVERGENCE: the same check id passing at one breakpoint and
   failing at another. This is the specific shape of bug this file exists
   for -- a check that is only ever exercised, and only ever fails, at a
   width nobody thought to run it at. */
const byId = new Map();
for (const r of results) {
  if (!r.sweep || !r.sweep.checks) continue;
  for (const c of r.sweep.checks) {
    if (!byId.has(c.id)) byId.set(c.id, []);
    byId.get(c.id).push({ breakpoint: r.breakpoint, verdict: c.verdict });
  }
}
let anyDivergence = false;
for (const [id, rows] of byId) {
  const verdicts = new Set(rows.map(r => r.verdict).filter(v => v !== 'INFO'));
  if (verdicts.size > 1) {
    anyDivergence = true;
    console.log('DIVERGES BY WIDTH: ' + id);
    for (const row of rows) console.log('  ' + row.breakpoint + ': ' + row.verdict);
  }
}

console.log('\n' + (anyFail || anyDivergence ? 'FAIL' : 'PASS') + ': ' + breakpoints.length +
            ' breakpoints swept' + (anyDivergence ? ', divergence found' : ''));
process.exit(anyFail || anyDivergence ? 1 : 0);
