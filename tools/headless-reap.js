/* HEADLESS REAPER.
 *
 * tools/headless.js's own cleanup (its cleanup() function, run from a
 * try/finally in main()) only executes if the NODE PROCESS ITSELF gets to
 * run that JS. A hard external kill, which is what a shell tool's own
 * timeout sends, terminates the process before finally can run: the chrome
 * child and its --user-data-dir profile are both orphaned, silently, every
 * time.
 *
 * Measured on this machine after one session that hit that timeout twice:
 * 10 orphaned aegis-headless-* profile directories, 1.17 GB, plus however
 * many chrome.exe processes were still alive holding their locks. Neither
 * shows up in headless.js's own output, because the process that would have
 * reported it never got to run again.
 *
 * This is deliberately narrow. It targets ONLY chrome processes whose
 * command line names a --user-data-dir under the OS temp directory matching
 * the aegis-headless-* prefix headless.js:50 mkdtemps into. That prefix
 * cannot collide with a user's real interactive Chrome profile, so nothing
 * here can ever touch a browser window a person is actually looking at.
 *
 * USAGE:
 *   node tools/headless-reap.js          dry run, reports what it would do
 *   node tools/headless-reap.js --fix    kills the processes, removes the dirs
 *
 * Run this before a batch of headless.js calls if a prior session may have
 * timed one out, and after, as routine housekeeping. It is safe to run with
 * nothing to reap: reports "nothing to reap" and exits 0.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const FIX = process.argv.includes('--fix');
const PREFIX = 'aegis-headless-';
const BROWSER_PROCESS_RE = /(?:^|\/)(?:Google Chrome|Chromium|chromium|google-chrome|chrome)(?:\s|$)/;

function listOrphanDirs() {
  const tmp = os.tmpdir();
  let entries;
  try { entries = fs.readdirSync(tmp, { withFileTypes: true }); }
  catch (e) { console.error('cannot read ' + tmp + ': ' + e.message); return []; }
  return entries
    .filter(e => e.isDirectory() && e.name.startsWith(PREFIX))
    .map(e => path.join(tmp, e.name));
}

function listChromeWithUserDir() {
  if (process.platform !== 'win32') {
    let out;
    try {
      out = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    } catch (e) {
      console.error('could not enumerate browser processes: ' + e.message);
      return [];
    }
    return out.split('\n').map(line => {
      const match = line.match(/^\s*(\d+)\s+(.+)$/);
      return match ? { ProcessId: Number(match[1]), CommandLine: match[2] } : null;
    }).filter(p => p && p.CommandLine.includes(PREFIX) && BROWSER_PROCESS_RE.test(p.CommandLine));
  }

  /* PowerShell's CIM query is the reliable Windows route to a process's full
     command line, which plain tasklist does not expose. */
  let out;
  try {
    out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
      "Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"
    ], { encoding: 'utf8', windowsHide: true });
  } catch (e) {
    console.error('could not enumerate chrome.exe processes: ' + e.message);
    return [];
  }
  let parsed;
  try { parsed = JSON.parse(out || '[]'); } catch (e) { return []; }
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed.filter(p => p && typeof p.CommandLine === 'string' && p.CommandLine.includes(PREFIX));
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function main() {
  const dirs = listOrphanDirs();
  const procs = listChromeWithUserDir();

  if (!dirs.length && !procs.length) {
    console.log('nothing to reap');
    return;
  }

  console.log('found ' + procs.length + ' orphaned aegis-headless chrome process(es)');
  for (const p of procs) console.log('  PID ' + p.ProcessId + '  ' + p.CommandLine.slice(0, 140));
  console.log('found ' + dirs.length + ' orphaned profile director' + (dirs.length === 1 ? 'y' : 'ies'));
  let totalBytes = 0;
  for (const d of dirs) {
    let size = 0;
    try {
      const walk = p => fs.readdirSync(p, { withFileTypes: true }).forEach(e => {
        const fp = path.join(p, e.name);
        if (e.isDirectory()) walk(fp); else { try { size += fs.statSync(fp).size; } catch (e2) {} }
      });
      walk(d);
    } catch (e) {}
    totalBytes += size;
    console.log('  ' + d + '  (' + (size / 1024 / 1024).toFixed(1) + ' MB)');
  }
  console.log('total: ' + (totalBytes / 1024 / 1024).toFixed(1) + ' MB');

  if (!FIX) {
    console.log('\ndry run: pass --fix to actually kill and remove');
    return;
  }

  for (const p of procs) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(p.ProcessId), '/F'], { windowsHide: true });
      else process.kill(p.ProcessId, 'SIGTERM');
    }
    catch (e) { console.error('  could not kill PID ' + p.ProcessId + ': ' + e.message); }
  }
  /* A just-killed chrome can hold its own profile's file locks for a short
     window (the same race headless.js's own cleanup() comment at :69-76
     documents), so retry the removal a few times rather than fail on the
     first collision. */
  for (const d of dirs) {
    let removed = false;
    for (let i = 0; i < 5 && !removed; i++) {
      try { fs.rmSync(d, { recursive: true, force: true }); removed = true; }
      catch (e) { if (i < 4) pause(300); }
    }
    console.log((removed ? '  removed ' : '  FAILED to remove ') + d);
  }
  console.log('done: reclaimed up to ' + (totalBytes / 1024 / 1024).toFixed(1) + ' MB');
}

main();
