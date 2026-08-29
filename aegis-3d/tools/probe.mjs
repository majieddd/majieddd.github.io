/* quick CDP probe — read state off the live page */
const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result.value; };
await send('Runtime.enable');
await send('Page.enable');
console.log('URL:', await ev('location.href'));
console.log('Game type:', await ev('typeof Game'));
console.log('camTarget:', await ev('typeof Game.camTarget + " " + (Game.camTarget ? JSON.stringify({x:Game.camTarget.x.toFixed(1),z:Game.camTarget.z.toFixed(1)}) : "UNDEFINED")'));
console.log('keys:', await ev('Object.keys(Game).filter(k => !["scene","camera","ui","bloom"].includes(k)).join(",")'));
console.log('state:', await ev('Game.state'));
ws.close();
process.exit(0);
