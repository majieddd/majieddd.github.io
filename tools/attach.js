/* ATTACH to a Chrome that is ALREADY RUNNING and already logged in.

   tools/headless.js spawns its own Chrome with a throwaway profile, which is
   right for gates: a test browser must carry no session, no history and no
   extensions, or it is not testing what players get. This is the opposite
   tool. It attaches to a browser YOU launched and YOU are signed into, so a
   script can act on a page that required a login to reach.

   Zero dependencies, same as headless.js: Node 22+ ships a global WebSocket,
   so CDP needs nothing installed.

   ONE-TIME SETUP, and the gotcha that will otherwise cost an hour. Chrome 136
   REFUSES --remote-debugging-port when pointed at the default profile
   directory; it starts, ignores the flag, and the debug port simply never
   opens. There is no error message. So the profile must be a dedicated one,
   logged in once by hand:

     "C:/Program Files/Google/Chrome/Application/chrome.exe" ^
       --remote-debugging-port=9222 ^
       --user-data-dir="D:/ClaudeProjects/RemoteWorkspace/.chrome-attach"

   Sign in to whatever service you need in that window. The profile persists,
   so this is once, not once per run.

   USAGE:
     node tools/attach.js --list
     node tools/attach.js --url https://firefly.adobe.com --shot out/ff.png
     node tools/attach.js --eval "document.title"
     node tools/attach.js --eval-file tools/steps/whatever.js

   The target tab is chosen by --match (substring of URL or title), else the
   first page target. */
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const PORT = Number(arg('port', process.env.CHROME_DEBUG_PORT || 9222));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function targets() {
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  } catch (e) {
    /* The single most likely failure, and the one with a non-obvious cause,
       so it gets a real message rather than ECONNREFUSED. */
    throw new Error(
      `nothing is listening on 127.0.0.1:${PORT}.\n` +
      `  Either Chrome is not running with --remote-debugging-port=${PORT},\n` +
      `  or it IS running but was pointed at the DEFAULT profile, which\n` +
      `  Chrome 136+ silently refuses to expose. Use a dedicated\n` +
      `  --user-data-dir; see the header of this file.`);
  }
  return (await r.json()).filter(t => t.type === 'page');
}

/* A CDP session over one tab. Same shape as headless.js's inner send(), kept
   separate rather than shared because that file owns a browser lifecycle and
   this one deliberately owns nothing: it must never kill a browser the user
   is sitting in front of. */
async function session(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('could not open a CDP socket')), { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, m => m.error
      ? rej(new Error(method + ': ' + JSON.stringify(m.error)))
      : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, close: () => { try { ws.close(); } catch (e) { /* already closed */ } } };
}

async function main() {
  const pages = await targets();
  if (!pages.length) throw new Error('Chrome is up but has no page targets open');

  if (arg('list')) {
    pages.forEach((t, i) => console.log(`[${i}] ${t.title}\n    ${t.url}`));
    return;
  }

  const match = arg('match', null);
  const target = match
    ? pages.find(t => (t.url + ' ' + t.title).toLowerCase().includes(String(match).toLowerCase()))
    : pages[0];
  if (!target) throw new Error(`no open tab matches ${JSON.stringify(match)}`);

  const { send, close } = await session(target);
  try {
    await send('Page.enable');
    await send('Runtime.enable');

    const url = arg('url', null);
    if (url && url !== true) {
      await send('Page.navigate', { url });
      /* A fixed wait, because "loaded" is not "ready" on a React SPA and
         Page.loadEventFired fires long before the app has rendered. Callers
         that need a real signal should --eval a poll instead of trusting
         this. */
      await sleep(Number(arg('wait', 4000)));
    } else if (arg('wait')) {
      await sleep(Number(arg('wait')));
    }

    let expr = arg('eval', null);
    const evalFile = arg('eval-file', null);
    if (evalFile && evalFile !== true) expr = fs.readFileSync(evalFile, 'utf8');
    if (expr && expr !== true) {
      const r = await send('Runtime.evaluate', {
        expression: String(expr), returnByValue: true, awaitPromise: true,
      });
      const ex = r.exceptionDetails;
      console.log(JSON.stringify(ex
        ? { ERROR: ex.text, message: (ex.exception && (ex.exception.description || ex.exception.value)) || '' }
        : (r.result && r.result.value), null, 1));
    }

    const shot = arg('shot', null);
    if (shot && shot !== true) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(path.resolve(shot)), { recursive: true });
      fs.writeFileSync(shot, Buffer.from(r.data, 'base64'));
      console.log('wrote ' + shot + ' (' + fs.statSync(shot).size + ' bytes)');
    }
  } finally {
    /* Close the SOCKET, never the browser. */
    close();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
