/* audio probe: with autoplay allowed, verify the AudioContext runs and the
   music sequencer advances. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('..', '..');
let PORT = 0;
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, urlPath.replace(/^\/+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
PORT = server.address().port;

const t = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
const errs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
await send('Runtime.enable');
await send('Page.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

async function navigateRetry(c, url, tries) {
  for (let i = 0; i < (tries || 4); i++) {
    await c.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 2000));
    const href = await c.eval('location.href');
    if (href.startsWith('http://127.0.0.1')) return true;
  }
  return false;
}

const ok = await navigateRetry(c, `http://127.0.0.1:${PORT}/aegis-3d/index.html`, 4);
console.log('page loaded:', ok, await ev('location.href'));
console.log('init result:', await ev(`(() => { try { Audio.init(); const st = Audio.state.ctx.state; Audio.state.ctx.resume(); return 'ok state=' + st; } catch (e) { return 'ERR ' + e.message; } })()`));
await new Promise((r) => setTimeout(r, 500));
const a = await ev(`(() => ({ state: Audio.state.ctx.state, t: Audio.state.ctx.currentTime.toFixed(2), step: Audio.state._step }))()`);
await new Promise((r) => setTimeout(r, 2500));
const b = await ev(`(() => ({ state: Audio.state.ctx.state, t: Audio.state.ctx.currentTime.toFixed(2), step: Audio.state._step }))()`);
console.log('t=0.5s:', JSON.stringify(a));
console.log('t=3.0s:', JSON.stringify(b));
console.log('music advanced:', b.t > a.t && b.step > a.step);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
ws.close();
server.close();
process.exit(0);
