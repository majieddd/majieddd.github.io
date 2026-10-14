// Targeted check: wall tiles must be inside FIELD.terrain (the unbuildable set
// game.js reads at line 460), so players cannot build towers inside walls.
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

const results = [];
for (const id of ['twin-channel', 'open-field']) {
  await cdp.send('Page.navigate', { url: BASE + '?t=' + Date.now() });
  await sleep(2600);
  const r = await ev(`(() => {
    try {
      Game.start({ map: ${JSON.stringify(id)}, worldId: 'livecheck' });
      UI.show('screen-game');
      const F = FIELD;
      let inTerrain = 0, total = 0;
      for (const k of F.walls) { total++; if (F.terrain.has(k)) inTerrain++; }
      return { id: ${JSON.stringify(id)}, terrainSize: F.terrain.size, wallsTotal: total, wallsInTerrain: inTerrain };
    } catch (e) { return { err: String(e).slice(0, 300) }; }
  })()`);
  results.push(r);
  console.log(JSON.stringify(r));
}
const ok = results.every(r => r && r.wallsInTerrain === r.wallsTotal && r.terrainSize > 0);
console.log(ok ? 'PASS: all wall tiles are unbuildable terrain' : 'FAIL');
cdp.close();
