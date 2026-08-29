/* HEADLESS DRIVER. Zero dependencies: Node 22+ ships a global WebSocket, so a
   headless Chrome can be driven over CDP with nothing installed.

   WHY IT EXISTS: the in-app Browser pane cannot composite, so screenshots time out.
   Bare `chrome.exe --headless` (OLD mode) does composite, but was measured producing
   fail=44 against a true fail=1 on this codebase, because old headless breaks
   layout-dependent checks. This uses --headless=new, which reproduces the correct
   result (measured 2026-08-25: pass 56, fail 1, info 2, total 59).

   USAGE:
     # terminal 1
     python -m http.server 8471 --bind 127.0.0.1
     # terminal 2
     node tools/headless.js http://127.0.0.1:8471/index.html <outdir> <stepsfile>

   A steps file exports an array of:
     { size: [w,h] }   set viewport
     { wait: ms }      pause
     { eval: 'js' }    evaluate, awaits promises, returns by value
     { shot: 'name' }  write <outdir>/name.png

   Load a harness BY FETCH so its 69KB body never enters a transcript. In a steps file:
     const RUN = "(async () => (0, eval)(await (await fetch('/tools/owner-sweep.js')).text()))()";
     module.exports = [{ wait: 2500 }, { eval: RUN }];
   MPT is a top-level const with no window assignment, so it needs an explicit hand-off
   to survive between calls:
     globalThis.MPT = (0, eval)(text + ';MPT')

   HARNESS ORDER STILL APPLIES: owner-sweep before MPT, each on a fresh load. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/* The Windows install path is the default because that is where this runs
   every day, but it is the ONE line that makes this file unrunnable anywhere
   else, and `references/verification.md` section 9 has called for these gates
   to run in CI since Session 28. An env var costs nothing here and is what a
   ubuntu-latest job would set (CHROME_PATH=$(which google-chrome)). */
const CHROME = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* A RANDOM port, not a fixed one (owner audit, Session 32). PORT = 9333 was
   hardcoded, so two agents running this at once fought over the same debugger
   port -- one silently attaches to the OTHER's browser rather than its own, a
   defect that reads as a passing sweep against the wrong page. A different
   base range from aegis-mcp.js's own 9222-9621 (mcp/aegis-mcp.js:49) keeps the
   two tools from colliding with EACH OTHER too, on top of not colliding with
   themselves. */
const PORT = 9700 + Math.floor(Math.random() * 400);
/* Flags: --coverage collects per-module V8 coverage; --bare prints only the
   last eval's return value on stdout (errors go to stderr). */
const [, , URL_, OUTDIR, STEPFILE] = process.argv;
/* An OS temp dir, not a folder inside OUTDIR (owner audit, Session 32): the
   old USERDIR lived under the harness's own output directory and was never
   removed, so every run left a full Chrome profile behind next to whatever
   the run was actually meant to produce. */
const USERDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-headless-'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --hide-scrollbars is OPT-IN, not default (owner audit, Session 32). Two
   findings in one session traced back to it hiding the real scrollbar gutter:
   a layout gate measuring a viewport the player never actually gets, because
   the browser under test was silently wider than the one people play in. Set
   AEGIS_HIDE_SCROLLBARS=1 for the rare case a screenshot needs a clean edge. */
const chromeFlags = [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--mute-audio', '--no-first-run', '--no-default-browser-check',
  /* --mute-audio silences the SPEAKERS; it does not stop the graph. What did
     stop the graph was autoplay policy: with no trusted user gesture the
     AudioContext stays `suspended`, every node processes nothing, and an
     analyser tapped off the music bus reads a flat 0. That zero looks exactly
     like broken audio and is not, which makes it the worst possible reading
     to get from a gate. The two flags are complementary: this one lets the
     context RUN so signal can be measured, --mute-audio keeps the machine
     quiet while it does. */
  '--autoplay-policy=no-user-gesture-required',
  '--disable-extensions', '--disable-background-networking',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${USERDIR}`,
  '--window-size=1600,900', 'about:blank',
];
if (process.env.AEGIS_HIDE_SCROLLBARS) chromeFlags.splice(3, 0, '--hide-scrollbars');

async function cleanup(chrome) {
  /* kill() returning is not the process being GONE (owner audit, Session 32,
     found by measurement: a synchronous kill()-then-rmSync left the profile
     directory behind on every successful run, 1 for 1). Windows in particular
     can hold the profile's file locks for a short window after the signal is
     sent, so rmSync raced a process that was still shutting down and lost
     silently under the old bare catch. Wait for the real 'exit' event first
     (bounded, in case it never fires), then retry the removal a few times: a
     removal failure is reported, not hidden, if every retry still fails. */
  try { chrome.kill(); } catch (e) { /* already gone */ }
  await Promise.race([
    new Promise(r => chrome.once('exit', r)),
    sleep(2000),
  ]);
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(USERDIR, { recursive: true, force: true }); return; }
    catch (e) { if (i === 4) console.error('cleanup: could not remove ' + USERDIR + ': ' + e.message);
                else await sleep(200); }
  }
}

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const chrome = spawn(CHROME, chromeFlags, { stdio: 'ignore', detached: false });
  let ws = null;

  /* EVERY EXIT PATH CLEANS UP, not just the two that used to remember to
     (owner audit, Session 32). An exception thrown by any `await send(...)`
     between here and the results log used to skip cleanup entirely: the
     catch in main().catch(...) below has no access to `chrome` at all, so a
     mid-script failure left the browser running and its temp profile on
     disk. try/finally is unconditional by construction; there is no path
     through this function that can forget it again. */
  try {
  // wait for the debugger endpoint
  let ver = null;
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!ver) throw new Error('chrome debugger never came up');

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, m => m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable').catch(() => {});

  const consoleErrors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      consoleErrors.push(m.params.entry.text);
    if (m.method === 'Runtime.exceptionThrown')
      consoleErrors.push(m.params.exceptionDetails.text + ' ' +
        (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || ''));
  });

  /* PRECISE COVERAGE, opt in. Enabled BEFORE navigation so the modules'
     top-level execution is counted too, not just what a harness calls into
     afterwards. Off by default: it costs a few hundred ms and every existing
     caller (gate.js) wants neither the cost nor the extra output. */
  const WANT_COVERAGE = process.argv.includes('--coverage');
  if (WANT_COVERAGE) {
    await send('Profiler.enable');
    await send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  }

  await send('Page.navigate', { url: URL_ });
  await sleep(3500);

  /* RESOLVE AGAINST THE CALLER'S CWD, not against this file.
     `require` resolves a relative specifier relative to the REQUIRING module,
     so the usage line at the top of tools/mutants.js
       node tools/headless.js <url> <outdir> tools/mutants.js
     resolved to tools/tools/mutants.js and died with "Cannot find module".
     gate.js never hit it because it passes an absolute tmpdir path, so the
     documented CLI form was the only broken one and nothing exercised it. */
  const steps = require(path.resolve(process.cwd(), STEPFILE));
  const results = [];
  for (const step of steps) {
    if (step.size) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: step.size[0], height: step.size[1], deviceScaleFactor: 1, mobile: false,
      });
      await sleep(600);
    }
    if (step.wait) await sleep(step.wait);
    if (step.eval) {
      const r = await send('Runtime.evaluate', {
        expression: step.eval, returnByValue: true, awaitPromise: true,
      });
      const ex = r.exceptionDetails;
      const v = ex
        ? { ERROR: ex.text,
            message: (ex.exception && (ex.exception.description || ex.exception.value)) || '',
            line: ex.lineNumber, col: ex.columnNumber }
        : (r.result && r.result.value);
      results.push({ eval: String(step.eval).slice(0, 70), value: v });
    }
    if (step.shot) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUTDIR, step.shot + '.png');
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      results.push({ shot: step.shot, bytes: fs.statSync(f).size, file: f });
    }
  }


    let coverage = null;
    if (WANT_COVERAGE) {
      const cov = await send('Profiler.takePreciseCoverage');
      /* Only this project's own modules. The page also runs Chrome internals
         and any inlined blob, and neither is anybody's diff. */
      coverage = (cov.result || []).filter(e => /\/js\/[A-Za-z0-9_]+\.js(\?|$)/.test(e.url || ''));
      await send('Profiler.stopPreciseCoverage').catch(() => {});
    }
    /* --bare prints ONLY the last eval's return value, unwrapped, and sends
       everything else to stderr.

       WHY THIS FLAG EXISTS. The full JSON report is the right default for a
       human reading a failure, and it is the wrong thing entirely for a
       caller that wants one number. Every probe in this project was being
       piped through a regex to dig its own result back out of that report,
       and on this machine the shell collapses backslashes on the way into
       python and node, so those regexes silently lost their escapes. Four
       consecutive attempts to read a single measurement failed on quoting
       rather than on anything about the game. A probe whose result is
       expensive to READ does not get run.

       consoleErrors still surface, on stderr, so --bare can never hide a page
       that threw while producing a clean-looking number. */
    const BARE = process.argv.includes('--bare');
    if (BARE) {
      if (consoleErrors.length) {
        console.error('CONSOLE ERRORS (' + consoleErrors.length + '):');
        consoleErrors.slice(0, 20).forEach(e => console.error('  ' + e));
      }
      const evals = results.filter(r => 'value' in r);
      const last = evals.length ? evals[evals.length - 1].value : null;
      console.log(typeof last === 'string' ? last : JSON.stringify(last));
    } else {
      console.log(JSON.stringify({ results, consoleErrors: consoleErrors.slice(0, 20),
                                   coverage }, null, 1));
    }
  } finally {
    if (ws) { try { ws.close(); } catch (e) { /* already closed */ } }
    await cleanup(chrome);
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
