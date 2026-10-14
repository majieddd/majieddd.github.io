/* probe Terrain.buildable across the bot's lane slots */
const t = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
await send('Runtime.enable');
await send('Page.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

/* tiny inline server for aegis-3d */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('..', '..');
let PORT = 0;
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, urlPath.replace(/^\/+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
PORT = server.address().port;
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
await new Promise((r) => setTimeout(r, 3000));
await ev(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
await new Promise((r) => setTimeout(r, 2500));
const out = await ev(`(() => {
  const lane = [0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7];
  const rows = [];
  for (const t of lane) {
    const p = Terrain.posAt(t);
    const off = 5.5;
    const a = { x: +(p.x + p.nx * off).toFixed(1), z: +(p.z + p.nz * off).toFixed(1) };
    const b = { x: +(p.x - p.nx * off).toFixed(1), z: +(p.z - p.nz * off).toFixed(1) };
    rows.push({
      t,
      pos: [p.x.toFixed(1), p.z.toFixed(1)].join(','),
      nx: p.nx.toFixed(2), nz: p.nz.toFixed(2),
      a: JSON.stringify(a), aOk: Terrain.buildable(a.x, a.z, 1.5), aPd: Terrain.pathDist(a.x, a.z).toFixed(1),
      b: JSON.stringify(b), bOk: Terrain.buildable(b.x, b.z, 1.5), bPd: Terrain.pathDist(b.x, b.z).toFixed(1)
    });
  }
  return JSON.stringify(rows, null, 1);
})()`);
console.log(out);
ws.close();
server.close();
process.exit(0);
