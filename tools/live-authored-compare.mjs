// Baseline: render a HAND-AUTHORED map (MAPS[0]) through the identical live path,
// so procedural-map screenshots can be compared against known-good game visuals.
import { writeFileSync } from 'node:fs';

const PORT = 9222;
const BASE = 'http://localhost:8471/';

async function getPageWs() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  const tabs = await res.json();
  return tabs.filter(t => t.type === 'page')[0].webSocketDebuggerUrl;
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res2, rej2) => {
          const mid = ++id; pending.set(mid, { res2, rej2 });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      }, close() { ws.close(); },
    });
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) {
        const p = pending.get(d.id); pending.delete(d.id);
        d.error ? p.rej2(new Error(JSON.stringify(d.error))) : p.res2(d.result);
      }
    };
    ws.onerror = () => reject(new Error('ws error'));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cdp = await connect(await getPageWs());
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

const ev = async expr => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || '').slice(0, 300));
  return r.result.value;
};

await cdp.send('Page.navigate', { url: BASE + '?t=' + Date.now() });
await sleep(2600);
const info = await ev(`(() => {
  try {
    const m = MAPS[0];
    Game.start({ map: m.id, worldId: 'livecheck' });
    UI.show('screen-game');
    return { id: m.id, name: m.name, cols: FIELD.cols, rows: FIELD.rows,
             buildMax: FIELD.buildMax, lanes: [FIELD.lanes[0].length, FIELD.lanes[1].length] };
  } catch (e) { return { err: String(e).slice(0, 300) }; }
})()`);
console.log(JSON.stringify(info));
await sleep(1800);
const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync('live-authored-baseline.png', Buffer.from(r.data, 'base64'));
console.log('[shot] live-authored-baseline.png');
cdp.close();
