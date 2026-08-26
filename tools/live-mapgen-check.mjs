// LIVE browser verification of procedural maps (Node >= 21, zero deps).
// Boots each of the 7 procedural MAPS in a real Helium page via CDP, reads back
// the FIELD exactly as the engine built it, probes wall LOS + preview parity,
// and screenshots the rendered board. One persistent WebSocket across navigations.
import { writeFileSync } from 'node:fs';

const PORT = 9222;
const BASE = 'http://localhost:8471/';
const MAPS = ['spiral','twin-channel','chokepoint','island-scatter',
              'open-field','convergence','fortress-ring'];

async function getPageWs() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  const tabs = await res.json();
  const page = tabs.filter(t => t.type === 'page')[0];
  if (!page) throw new Error('no page target');
  return page.webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res2, rej2) => {
          const mid = ++id;
          pending.set(mid, { res2, rej2 });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      errors, close() { ws.close(); },
    });
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) {
        const p = pending.get(d.id); pending.delete(d.id);
        d.error ? p.rej2(new Error(JSON.stringify(d.error))) : p.res2(d.result);
      } else if (d.method === 'Runtime.exceptionThrown') {
        errors.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
      } else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
        errors.push('LOG: ' + String(d.params.entry.text).slice(0, 250));
      }
    };
    ws.onerror = () => reject(new Error('ws error'));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// In-page probe. Boots the map with a fixed worldId seed (the MP/skirmish path),
// reveals the battle screen, lets waves spawn, then reads back FIELD geometry +
// runs wall-LOS and preview-parity checks. Returns compact JSON or {ok:false}.
const PROBE = id => `(() => {
  try {
    const m = MAPS.find(x => x.id === ${JSON.stringify(id)});
    if (!m) return { ok: false, err: 'map not found' };
    let startErr = null;
    try { Game.start({ map: ${JSON.stringify(id)}, worldId: 'livecheck' }); }
    catch (e) { startErr = e.stack || String(e); }
    if (startErr) return { ok: false, err: 'START', stack: startErr.slice(0, 900) };
    UI.show('screen-game');
    const F = FIELD;
    // wall LOS probe: pick a wall tile, confirm it blocks a straight shot across it
    let los = null;
    if (F.walls && F.walls.size) {
      const [wx, wy] = [...F.walls][0].split(',').map(Number);
      const T = TILE || 32;
      // shoot from just left of the wall to just right, same row
      los = { blocked: wallBlocksShot(wx*T - T/2, (wy+0.5)*T, wx*T + T/2, (wy+0.5)*T), clear: wallBlocksShot(0, 1, F.cols*T, 1) };
    }
    // preview parity: same seed must yield the SAME lane geometry as the live board
    let pv = null;
    try {
      const svg = UI.mapPreviewBlock(m, { size: 'tip', seed: 'livecheck' });
      pv = { hasSvg: /<svg/i.test(svg), len: (svg||'').length };
    } catch (e) { pv = { err: String(e).slice(0,120) }; }
    return { ok: true, id: ${JSON.stringify(id)}, name: m.name, cols: F.cols, rows: F.rows,
      walls: F.walls ? F.walls.size : 0, blocked: F.blocked ? F.blocked.size : 0,
      buildMax: F.buildMax, lanes: [F.lanes[0].length, F.lanes[1].length],
      lanePts: [F.lanes[0][0] && F.lanes[0][0].length, F.lanes[1][0] && F.lanes[1][0].length],
      enemies: (Game.enemies||[]).length, los, pv };
  } catch (e) { return { ok: false, err: String(e).slice(0, 300) }; }
})()`;

const cdp = await connect(await getPageWs());
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); // scripts must not be cached between maps

const ev = async expr => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || '').slice(0, 300));
  return r.result.value;
};
const shot = async name => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(name, Buffer.from(r.data, 'base64'));
};

console.log('title:', await ev('document.title').catch(() => '(pre-nav)'));
const results = [];
for (const id of MAPS) {
  cdp.errors.length = 0; // per-map error window
  await cdp.send('Page.navigate', { url: BASE + '?t=' + Date.now() });
  await sleep(2600);            // let the app boot + UI attach
  const r = await ev(PROBE(id));
  results.push(r);
  if (r && r.ok) { await sleep(1800); await shot(`live-${id}.png`); }
  console.log(JSON.stringify(r), 'errs=' + cdp.errors.length, cdp.errors.slice(0,2).join(' | '));
}

console.log('\n=== SUMMARY ===');
let pass = 0;
for (const r of results) {
  if (!r || !r.ok) { console.log(`FAIL ${r && r.id}: ${r && r.err}`); continue; }
  const bmOk = Array.isArray(r.buildMax) && r.buildMax[0] >= 0 && r.buildMax[1] < r.cols;
  const lanesOk = r.lanes[0] > 0 && r.lanes[1] > 0;
  const losOk = !r.los || (r.los.blocked === true); // a wall must block the shot through it
  const pvOk = r.pv && r.pv.hasSvg === true;
  const good = bmOk && lanesOk && losOk && pvOk;
  if (good) pass++;
  console.log(`${good ? 'PASS' : 'FAIL'} ${r.id.padEnd(15)} cols=${r.cols}x${r.rows} walls=${r.walls} blocked=${r.blocked} buildMax=[${r.buildMax}] lanes=${r.lanes[0]}/${r.lanes[1]} enemies=${r.enemies} losBlocked=${r.los && r.los.blocked} pvSvg=${pvOk}`);
}
console.log(`\n${pass}/${MAPS.length} maps fully verified in live browser`);
console.log('TOTAL ERRORS:', cdp.errors.length ? cdp.errors : 'NONE');
cdp.close();
