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
const path = require('path');
const { spawn } = require('child_process');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const [, , URL_, OUTDIR, STEPFILE] = process.argv;
const USERDIR = path.join(OUTDIR, '_chromeprofile');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${USERDIR}`,
    '--window-size=1600,900', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  // wait for the debugger endpoint
  let ver = null;
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!ver) { chrome.kill(); throw new Error('chrome debugger never came up'); }

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
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

  await send('Page.navigate', { url: URL_ });
  await sleep(3500);

  const steps = require(STEPFILE);
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

  console.log(JSON.stringify({ results, consoleErrors: consoleErrors.slice(0, 20) }, null, 1));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
