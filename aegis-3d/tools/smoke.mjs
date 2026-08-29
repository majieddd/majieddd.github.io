/* aegis-3d/tools/smoke.mjs — live CDP smoke test. Zero dependencies.
   Drives the Helium/Chrome debug instance on :9222: serves the repo root,
   opens a fresh tab, captures runtime errors from BEFORE navigation, then
   runs a battery of in-page probes against the live game and screenshots
   each phase to qa/.

   Usage: node tools/smoke.mjs [scenario]   (scenario: menu|battle|all)   */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QA = path.join(path.dirname(__dirname), 'qa');
fs.mkdirSync(QA, { recursive: true });

/* ---------------- static server ---------------- */
let PORT = 0;
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(REPO_ROOT, urlPath.replace(/^\/+/, ''));
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(REPO_ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    const ext = path.extname(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
PORT = server.address().port;
console.log('[smoke] serving', REPO_ROOT, 'on', PORT);

/* ---------------- CDP plumbing ---------------- */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleLogs = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else {
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
          this.consoleLogs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
        }
        if (m.method === 'Runtime.exceptionThrown') {
          const d = m.params.exceptionDetails;
          const loc = d.url ? ` [${d.url.split('/').pop()}:${d.lineNumber}:${d.columnNumber}]` : '';
          const frames = (d.stackTrace?.callFrames || []).slice(0, 5)
            .map((f) => `${f.functionName || '(anon)'}@${(f.url || '').split('/').pop()}:${f.lineNumber}`).join(' <- ');
          this.consoleLogs.push('EXCEPTION: ' + (d.exception?.description || d.text) + loc + (frames ? ' @ ' + frames : ''));
        }
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
          this.consoleLogs.push('LOG: ' + m.params.entry.text);
        }
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function openTab() {
  /* Create OUR OWN tab — never drive an existing page target, which may
     belong to another session working on this shared debug browser. */
  const t = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' })
    .then((r) => r.json());
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const c = new CDP(ws);
  await c.send('Runtime.enable');
  await c.send('Log.enable');
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(c, name) {
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(QA, name + '.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('[smoke] screenshot', file);
  return file;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
}

const ev = (expr) => `(() => { ${expr} })()`;

/* ---------------- menu ---------------- */
async function scenarioMenu(c) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  const state = await c.eval('typeof Game !== "undefined" ? {state: Game.state, children: Game.scene.children.length} : "no Game"');
  check('Game boots into menu', state !== 'no Game' && state.state === 'menu', JSON.stringify(state));
  const menuBuilt = await c.eval('document.querySelectorAll(".faction-card").length === 4 && !!document.querySelector("#cmd-card")');
  check('menu built (4 factions + commander card)', menuBuilt);
  const shopOk = await c.eval('document.querySelectorAll(".shop-card").length === 12 && document.querySelectorAll(".preview-canvas").length === 12');
  check('12 shop cards + 12 preview canvases', shopOk);
  const painted = await c.eval(`(() => {
    const cv = document.querySelector('.preview-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, 96, 96).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  })()`);
  check('shop previews painted (non-blank pixels)', painted > 200, painted + ' px');
  await c.eval(`(() => { document.querySelectorAll('.faction-card')[2].click(); return 1; })()`);
  await sleep(300);
  const xeno = await c.eval('document.querySelector(".commander-name").textContent');
  check('faction switch → xeno commander', xeno === 'SEVRA', xeno);
  const fc = await c.eval('getComputedStyle(document.body).getPropertyValue("--fc").trim()');
  check('faction colour var set', fc === '#a855f7', fc);
  const camOk = await c.eval('typeof Game.camTarget !== "undefined" && Game.camTarget.x !== undefined && Game.camTarget.z !== undefined');
  check('camera target exposed to audio panning', camOk);
  /* Trap any render call that passes an undefined camera. */
  await c.eval(`(() => {
    window.__badRenders = [];
    const orig = THREE.WebGLRenderer.prototype.render;
    THREE.WebGLRenderer.prototype.render = function (scene, cam) {
      if (!cam) window.__badRenders.push(new Error('render: camera undefined').stack.split('\\n').slice(1, 4).join(' | '));
      return orig.call(this, scene, cam);
    };
    return 1;
  })()`);
  await shot(c, '00-menu');
}

/* ---------------- battle ---------------- */
async function scenarioBattle(c) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  await c.eval(`(() => { document.querySelectorAll('.faction-card')[0].click(); return 1; })()`);
  await sleep(200);
  await c.eval(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2500);
  let s = await c.eval('({state: Game.state, gold: Game.gold, lives: Game.lives})');
  check('deploy → build state', s.state === 'build' && s.gold === 320 && s.lives === 20, JSON.stringify(s));
  await shot(c, '01-build');

  /* Test economy, place a mixed line during build. */
  await c.eval(`(() => {
    Game.gold = 99999;
    Towers.place('bolt', -30, -8);
    Towers.place('bolt', -24, -16);
    Towers.place('mortar', -34, -14);
    Towers.place('cryo', -18, -18);
    return Towers.list.length;
  })()`);
  await shot(c, '02-line');

  /* Diagnostic: buildability along the fullrun bot's lane slots. */
  const buildableTable = await c.eval(`(() => {
    const lane = [0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7];
    return lane.map((t) => {
      const p = Terrain.posAt(t);
      const off = 5.5;
      const a = [p.x + p.nx * off, p.z + p.nz * off];
      const b = [p.x - p.nx * off, p.z - p.nz * off];
      return t + ': a=' + a.map((v) => v.toFixed(1)).join(',') + ' ok:' + Terrain.buildable(a[0], a[1], 1.5) + ' pd:' + Terrain.pathDist(a[0], a[1]).toFixed(1)
        + ' || b=' + b.map((v) => v.toFixed(1)).join(',') + ' ok:' + Terrain.buildable(b[0], b[1], 1.5) + ' pd:' + Terrain.pathDist(b[0], b[1]).toFixed(1);
    }).join(' | ');
  })()`);
  console.log('[smoke] buildable table:', buildableTable);

  /* Rush wave 1 and watch a 6s window. */
  await c.eval('Game.rush()');
  await sleep(6000);
  s = await c.eval('({state: Game.state, wave: Game.wave, units: Units.list.length, kills: Game.stats.kills, dmg: Math.round(Game.stats.towerDamage)})');
  check('wave 1 ran, enemies spawned', s.wave >= 1 && s.units + s.kills > 0, JSON.stringify(s));
  check('towers dealt damage', s.dmg > 0, s.dmg + ' damage');
  const dmg = s.dmg;
  await shot(c, '03-wave1');

  /* Reactions: tanky juggernauts down the mortar/cryo lane. */
  await c.eval(`(() => {
    for (let i = 0; i < 3; i++) Units.spawn('juggernaut', { t: 0.05 + i * 0.02 });
    return 1;
  })()`);
  await sleep(10000);
  const reacts = await c.eval('Object.keys(Game.stats.reactions).join(",")');
  const reactCounts = await c.eval('JSON.stringify(Game.stats.reactions)');
  check('element reactions fire (mortar+cryo lane)', reacts.length > 0, reactCounts);

  /* Full roster: every remaining tower type placed beside the lane and
     given targets; all twelve must fire at least once. */
  const roster = await c.eval(`(() => {
    const ids = Data.TOWERS.map((t) => t.id);
    const placed = Towers.list.map((t) => t.def.id);
    const missing = ids.filter((id) => !placed.includes(id));
    let i = 0;
    for (const id of missing) {
      const t = 0.18 + (i / Math.max(1, missing.length - 1)) * 0.64;
      const p = Terrain.posAt(t);
      const off = 5.5;
      let x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (!Terrain.buildable(x, z, 1.5)) { x = p.x - p.nx * off; z = p.z - p.nz * off; }
      Towers.place(id, x, z);
      i++;
    }
    return Towers.list.map((t) => t.def.id).join(',');
  })()`);
  check('all 12 towers placed', roster.split(',').filter(Boolean).length >= 12, roster);
  /* Spread tanky ground units and flyers across the WHOLE lane so every
     tower has targets. */
  await c.eval(`(() => {
    for (let i = 0; i < 7; i++) Units.spawn('juggernaut', { t: 0.08 + i * 0.12 });
    for (let i = 0; i < 4; i++) Units.spawn('wisp', { t: 0.2 + i * 0.15 });
    for (let i = 0; i < 6; i++) Units.spawn('crawler', { t: 0.15 + i * 0.1 });
    return Units.list.length;
  })()`);
  await sleep(14000);
  const shotMap = await c.eval('Towers.list.map((t) => t.def.id + ":" + t.shots).join(" ")');
  const allFired = await c.eval('Towers.list.every((t) => t.shots > 0)');
  check('all 12 tower types fired', allFired, shotMap);

  /* FPS under load: count rAF frames for 2.5s while everything fires. */
  await c.eval(`(() => {
    window.__fpsN = 0;
    window.__fpsHook = () => { window.__fpsN++; requestAnimationFrame(window.__fpsHook); };
    requestAnimationFrame(window.__fpsHook);
    return 1;
  })()`);
  await sleep(2500);
  const fps = await c.eval('Math.round(window.__fpsN / 2.5)');
  check('fps >= 55 under full-roster fire', fps >= 55, fps + ' fps');

  /* Enemy behaviours — poll HP/position live so fates are visible. */
  await c.eval(`(() => {
    Units.clear(); Towers.clear();
    Game.gold = 99999;
    Towers.place('bolt', -30, -8);
    return 1;
  })()`);
  await c.eval(`(() => {
    Units.spawn('cluster'); Units.spawn('carrier'); Units.spawn('mender');
    Units.spawn('aegis'); Units.spawn('wisp'); Units.spawn('warden');
    Units.spawn('juggernaut'); Units.spawn('mb_colossus'); Units.spawn('harbinger');
    return Units.list.map((e) => e.def.id).join(',');
  })()`);
  await sleep(3000);
  await shot(c, '05-menagerie-3s');
  const snap3 = await c.eval('Units.list.map((e) => e.def.id + ":" + Math.round(e.hp) + "/" + Math.round(e.maxHp) + "@" + e.pathT.toFixed(2)).join(" ")');
  check('menagerie units alive at 3s', snap3.length > 0, snap3);
  await sleep(6000);
  const snap9 = await c.eval('Units.list.map((e) => e.def.id + ":" + Math.round(e.hp) + "/" + Math.round(e.maxHp) + "@" + e.pathT.toFixed(2)).join(" ")');
  await shot(c, '06-menagerie-9s');
  check('tanky units alive at 9s', /juggernaut|harbinger|colossus/.test(snap9), snap9);
  /* Cluster split. */
  const spawnlingAt9 = await c.eval('Units.list.filter((e) => e.def.id === "spawnling").length');
  const spawnlingEver = await c.eval('(function(){ for (let i=0; i<Units.list.length; i++) if (Units.list[i].def.id==="spawnling") return true; return false; })()');
  check('cluster split into spawnlings', spawnlingAt9 > 0 || spawnlingEver, 'alive: ' + spawnlingAt9);
  /* Carrier mites. */
  const mitesAt9 = await c.eval('Units.list.filter((e) => e.def.id === "mite").length');
  check('carrier summons mites', mitesAt9 > 0, 'alive: ' + mitesAt9);
  /* Aegis shield regen. */
  const shield = await c.eval(`(() => { const a = Units.list.find((e) => e.def.id === 'aegis'); return a ? a.shield : -1; })()`);
  check('aegis shield regenerated', shield > 0, 'shield=' + Math.round(shield));
  /* Mender healed someone. */
  const healed = await c.eval(`(() => { const m = Units.list.find((e) => e.def.id === 'mender'); return m ? Math.round(m.healed) : -1; })()`);
  check('mender healed allies', healed > 0, 'healed=' + healed);
  /* Wisp flying — spawn one far down the lane so the entry bolt can't
     reach it, then sample altitude quickly. */
  await c.eval(`(() => { Units.spawn('wisp', { t: 0.85 }); return 1; })()`);
  await sleep(400);
  const wispAlt = await c.eval(`(() => { const w = Units.list.find((e) => e.def.id === 'wisp'); return w && !w.dead ? Math.round(w.y - Terrain.heightAt(w.x, w.z)) : -1; })()`);
  check('wisp flies at altitude', wispAlt >= 2, 'alt=' + wispAlt);
  /* Harbinger phase. */
  await c.eval(`(() => {
    const h = Units.list.find((e) => e.def.id === 'harbinger');
    if (h && !h.dead) h.takeDamage(h.maxHp * 0.4, 'void', null, { noMark: true });
    return 1;
  })()`);
  await sleep(500);
  const bossPhase = await c.eval(`(() => {
    const h = Units.list.find((e) => e.def.id === 'harbinger');
    return h && !h.dead ? { phase: h.phaseIdx, armor: h.armor, speed: h.speed } : 'gone';
  })()`);
  check('harbinger phase 1 triggered', bossPhase !== 'gone' && bossPhase.phase >= 1, JSON.stringify(bossPhase));

  /* Abilities (VANTA). */
  await c.eval('Commander.castQ()');
  await sleep(400);
  const qActive = await c.eval('Commander.current.QActiveT > 0');
  check('commander Q casts (overclock)', qActive);
  await c.eval(`(() => { Game.requestCastE(); return Commander.castE(-20, -6); })()`);
  const eActive = await c.eval('Commander.current.EActiveT > 0');
  check('commander E casts (dampening field)', eActive);
  await shot(c, '06-abilities');

  /* Pause, speed, inspector, sell, upgrade. */
  await c.eval('Game.togglePause()');
  await sleep(250);
  check('pause works', await c.eval('Game.paused === true'));
  await c.eval('Game.togglePause()');
  await c.eval('Game.setSpeed(2)');
  check('speed 2x works', await c.eval('Game.speed === 2'));
  await c.eval('Game.setSpeed(1)');
  await c.eval(`(() => { Ui.selectTower(Towers.list[0]); return 1; })()`);
  check('inspector opens', await c.eval('!document.getElementById("inspector").classList.contains("hidden")'));
  await c.eval(`(() => { const t = Towers.list[0]; if (t.tier < 3) { Game.gold = 99999; t.upgrade(); } return t.tier; })()`);
  const tier = await c.eval('Towers.list[0] ? Towers.list[0].tier : 0');
  check('upgrade raises tier', tier === 2, 'tier ' + tier);
  const before = await c.eval('Towers.list.length');
  await c.eval(`(() => { Towers.sell(Towers.list[0]); return 1; })()`);
  check('sell removes tower', await c.eval(`Towers.list.length === ${before - 1}`));
  await shot(c, '07-inspector');

  /* Audio graph. */
  const ac = await c.eval('typeof Audio !== "undefined" && Audio.state.ctx ? {state: Audio.state.ctx.state, timer: !!Audio.state._schedTimer} : "no ctx"');
  check('audio engine constructed', ac !== 'no ctx' && ac.timer, JSON.stringify(ac));
}

/* ---------------- fullrun: a scripted 20-wave campaign ---------------- */
async function scenarioFullrun(c) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  await c.eval(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2500);
  await c.eval('Game.setSpeed(4)');
  /* Build order bot: keeps a line growing along the lane, upgrades depth-first. */
  await c.eval(`(() => {
    window.__bot = () => {
      if (Game.state !== 'build') return;
      const lane = [0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.9, 0.2];
      const want = ['bolt', 'prism', 'railgun', 'arc', 'mortar', 'cryo', 'toxin', 'flak', 'singularity', 'bolt'];
      let i = 0;
      for (const t of lane) {
        if (Towers.list.length > i) { i++; continue; }
        const id = want[i % want.length];
        const def = Data.TOWERS.find((x) => x.id === id);
        if (Game.gold < def.cost) break;
        const p = Terrain.posAt(t);
        const off = 5.5;
        let x = p.x + p.nx * off, z = p.z + p.nz * off;
        if (!Terrain.buildable(x, z, 1.5)) { x = p.x - p.nx * off; z = p.z - p.nz * off; }
        Game.gold -= def.cost;
        Towers.place(id, x, z);
        i++;
      }
      for (const t of Towers.list) {
        if (t.tier < 3 && t.upgradeDef && Game.gold >= t.upgradeDef.cost) {
          Game.gold -= t.upgradeDef.cost;
          t.upgrade();
        } else if (t.tier >= 3 && Game.gold >= t.ascCost && t.asc < 2) {
          Game.gold -= t.ascCost;
          t.ascend();
        }
      }
      /* Abilities on cooldown, like a real player. */
      const cm = Commander.current;
      if (cm && cm.Q.cd <= 0 && Game.state === 'battle') Commander.castQ();
      if (cm && cm.E.cd <= 0 && cm.def.E.cast && Game.state === 'battle') {
        const p = Terrain.posAt(0.5);
        Commander.castE(p.x, p.z);
      } else if (cm && cm.E.cd <= 0 && Game.state === 'battle') {
        Commander.castE();
      }
      if (Game.state === 'build') Game.rush();
    };
    window.__botTimer = setInterval(() => window.__bot(), 250);
    return 1;
  })()`);
  /* Run until the match ends or 430s. */
  const deadline = Date.now() + 430000;
  let end = null;
  let lastLog = 0;
  while (Date.now() < deadline) {
    await sleep(3000);
    end = await c.eval(`(() => ({
      state: Game.state, wave: Game.wave, lives: Game.lives, gold: Game.gold,
      kills: Game.stats.kills, towers: Towers.list.length, result: Game.result,
      alive: Units.list.length,
      hpSum: Math.round(Units.list.reduce((a, e) => a + e.hp, 0)),
      tierAvg: (Towers.list.reduce((a, t) => a + t.tier + t.asc, 0) / Math.max(1, Towers.list.length)).toFixed(2),
      types: JSON.stringify((() => { const m = {}; for (const e of Units.list) m[e.def.id] = (m[e.def.id] || 0) + 1; return m; })())
    }))()`);
    if (Date.now() - lastLog > 25000 || end.state === 'over') {
      lastLog = Date.now();
      console.log(`[fullrun t=${Math.round((Date.now() - (deadline - 430000)) / 1000)}s] wave=${end.wave} alive=${end.alive} hp=${end.hpSum} tierAvg=${end.tierAvg} types=${end.types}`);
    }
    if (end.state === 'over' || (end.state === 'build' && end.wave >= 20)) break;
  }
  await c.eval('clearInterval(window.__botTimer)');
  await c.eval('Game.setSpeed(1)');
  console.log('[fullrun] final:', JSON.stringify(end));
  check('full run reaches an end state', end.state === 'over', JSON.stringify(end));
  check('full run victory at wave 20', end.result === 'victory', JSON.stringify(end));
  await shot(c, '08-fullrun-end');
  const errs = c.consoleLogs.filter((e) =>
    !/favicon/i.test(e) && !/Failed to load resource/i.test(e) && !/preview renderer unavailable/i.test(e));
  check('full run zero runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));
}

/* ---------------- wavestudy: isolate a late wave and measure ---------------- */
async function scenarioWaveStudy(c, waveNum) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  await c.eval(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2500);
  /* Cheat-build the endgame line: the 10-slot build, tier 3 + one ascension. */
  await c.eval(`(() => {
    Game.gold = 999999;
    const lane = [0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.9, 0.2];
    const want = ['bolt', 'prism', 'railgun', 'arc', 'mortar', 'cryo', 'toxin', 'flak', 'singularity', 'bolt'];
    lane.forEach((t, i) => {
      const p = Terrain.posAt(t);
      const off = 5.5;
      let x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (!Terrain.buildable(x, z, 1.5)) { x = p.x - p.nx * off; z = p.z - p.nz * off; }
      const tw = Towers.place(want[i], x, z);
      tw.tier = 3; tw.stats = tw.computeStats(); tw.buildModel();
      tw.asc = 1; tw.ascSpent = tw.ascCost; tw.stats = tw.computeStats();
      tw.group.scale.setScalar(1.05);
    });
    Game.gold = 500;
    return Towers.list.length;
  })()`);
  /* Spawn the target wave's composition spread along the lane. */
  await c.eval(`(() => {
    const mix = Data.waveComposition(${waveNum}, Util.mulberry32(Game.seed * 31 + ${waveNum} * 7));
    let i = 0;
    for (const entry of mix) {
      Units.spawn(entry.id, { t: 0.05 + (i / Math.max(1, mix.length - 1)) * 0.8 });
      i++;
    }
    Game.state = 'battle';
    Game.wave = ${waveNum};
    Game.setSpeed(4);
    return Units.list.length;
  })()`);
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < 150000) {
    await sleep(5000);
    const s = await c.eval(`(() => {
      const types = {};
      let hp = 0;
      for (const e of Units.list) { hp += e.hp; types[e.def.id] = (types[e.def.id] || 0) + 1; }
      return { alive: Units.list.length, hp: Math.round(hp), types: JSON.stringify(types) };
    })()`);
    if (Date.now() - lastLog > 20000 || s.alive === 0) {
      lastLog = Date.now();
      console.log(`[wavestudy w${waveNum}] t=${Math.round((Date.now() - start) / 1000)}s alive=${s.alive} hp=${s.hp} types=${s.types}`);
    }
    if (s.alive === 0) break;
  }
  const done = await c.eval('Units.list.length === 0');
  const took = Math.round((Date.now() - start) / 1000);
  check(`wave ${waveNum} clears`, done, done ? `${took}s real at 4x (${took * 4}s sim)` : `NOT cleared in ${took}s real`);
  await shot(c, `09-wavestudy-${waveNum}`);
}

/* ---------------- reactions: all ten, driven directly ---------------- */
async function scenarioReactions(c) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  await c.eval(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2500);
  /* Each row: [mark element, hit element] — the table must contain all ten
     canonical pairs. Fresh juggernaut per pair; no towers interfere. */
  const out = await c.eval(`(() => {
    const pairs = [['fire', 'frost'], ['storm', 'fire'], ['storm', 'frost'], ['storm', 'venom'],
                   ['void', 'fire'], ['void', 'frost'], ['void', 'storm'], ['void', 'venom'],
                   ['fire', 'venom'], ['frost', 'venom']];
    const results = [];
    for (const [mark, hit] of pairs) {
      Units.clear(); Towers.clear();
      const e = Units.spawn('juggernaut', { t: 0.4 });
      e.hp = e.maxHp * 10;
      const before = { ...Game.stats.reactions };
      e.takeDamage(1, mark, null, { noMark: false });
      e.takeDamage(1, hit, null, {});
      const name = Data.reactionOf(mark, hit).name;
      const fired = (Game.stats.reactions[name] || 0) > (before[name] || 0);
      results.push(name + ':' + fired);
    }
    return results.join(' ');
  })()`);
  const all = out.split(' ').filter((s) => s.endsWith(':true'));
  check('all 10 reactions fire', all.length === 10, out);

  /* Commander selection: all four faction cards render their commander, and
     a deploy picks the selection up into Commander.current. */
  const cmds = await c.eval(`(() => {
    const out = [];
    for (const id in Data.FACTIONS) {
      document.querySelectorAll('.faction-card')[Object.keys(Data.FACTIONS).indexOf(id)].click();
      out.push(document.querySelector('.commander-name').textContent);
    }
    return out.join(',');
  })()`);
  check('all 4 commander cards render', cmds === 'VANTA,SERAPH,SEVRA,RAKE', cmds);
  await c.eval(`(() => { document.querySelectorAll('.faction-card')[2].click(); document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2000);
  const picked = await c.eval(`(() => ({
    state: Game.state,
    cmdr: (typeof Commander !== 'undefined' && Commander.current) ? Commander.current.id : 'null',
    card: document.querySelector('.commander-name') ? document.querySelector('.commander-name').textContent : 'no-card',
    menuHidden: document.getElementById('menu').classList.contains('hidden')
  }))()`);
  check('deploy picks the selected commander', picked.cmdr === 'sevra', JSON.stringify(picked));

  /* Slow / pull immunity rules. */
  const imm = await c.eval(`(() => {
    Units.clear(); Towers.clear();
    const w = Units.spawn('warden', { t: 0.4 });
    w.slow = 0.9; w.slowT = 5;
    const wImm = w.effSlow === 0;
    const d0 = w.dist;
    w.pullBack(20);
    const wPullImm = w.dist === d0;
    const j = Units.spawn('juggernaut', { t: 0.4 });
    j.slow = 0.6; j.slowT = 5;
    const jRes = Math.abs(j.effSlow - 0.6 * (1 - 0.45)) < 0.001;
    return { wImm, wPullImm, jRes };
  })()`);
  check('warden immune to slow + pull, juggernaut resists slow', imm.wImm && imm.wPullImm && imm.jRes, JSON.stringify(imm));
}

/* ---------------- bossfight: real wave-20 → victory end screen ---------------- */
async function scenarioBoss(c) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/aegis-3d/index.html` });
  await sleep(3500);
  await c.eval(`(() => { document.querySelector('.btn-primary').click(); return 1; })()`);
  await sleep(2500);
  await c.eval(`(() => {
    Game.gold = 999999;
    const lane = [0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.9, 0.2];
    const want = ['bolt', 'prism', 'railgun', 'arc', 'mortar', 'cryo', 'toxin', 'flak', 'singularity', 'bolt'];
    lane.forEach((t, i) => {
      const p = Terrain.posAt(t);
      const off = 5.5;
      let x = p.x + p.nx * off, z = p.z + p.nz * off;
      if (!Terrain.buildable(x, z, 1.5)) { x = p.x - p.nx * off; z = p.z - p.nz * off; }
      const tw = Towers.place(want[i], x, z);
      tw.tier = 3; tw.stats = tw.computeStats(); tw.buildModel();
      tw.asc = 1; tw.ascSpent = tw.ascCost; tw.stats = tw.computeStats();
    });
    Game.gold = 500;
    Game.state = 'battle';
    Game.wave = 19;
    const mix = Data.waveComposition(20, Util.mulberry32(Game.seed * 31 + 20 * 7));
    let i = 0;
    for (const entry of mix) {
      Units.spawn(entry.id, { t: 0.1 + (i / Math.max(1, mix.length - 1)) * 0.7 });
      i++;
    }
    Game.setSpeed(4);
    return Units.list.length;
  })()`);
  const start = Date.now();
  let end = null;
  while (Date.now() - start < 150000) {
    await sleep(3000);
    end = await c.eval(`(() => ({
      state: Game.state, result: Game.result, wave: Game.wave, lives: Game.lives,
      alive: Units.list.length, bossHp: (() => { const h = Units.list.find((e) => e.def.id === 'harbinger'); return h ? Math.round(h.hp) : 0; })()
    }))()`);
    if (end.state === 'over') break;
  }
  console.log('[bossfight] final:', JSON.stringify(end));
  check('boss wave clears to victory', end.state === 'over' && end.result === 'victory', JSON.stringify(end));
  const endUi = await c.eval(`(() => ({
    visible: !document.getElementById('end').classList.contains('hidden'),
    text: document.getElementById('end').innerText.slice(0, 120),
    hasRematch: !!document.getElementById('btn-rematch')
  }))()`);
  check('victory end screen shown with rematch', endUi.visible && /VICTORY/.test(endUi.text) && endUi.hasRematch, JSON.stringify(endUi));
  await shot(c, '10-victory');
  /* Rematch: the restart path must work from the end screen. */
  await c.eval(`(() => { document.getElementById('btn-rematch').click(); return 1; })()`);
  await sleep(2500);
  const rematch = await c.eval('({ state: Game.state, wave: Game.wave, lives: Game.lives, towers: Towers.list.length, hidden: document.getElementById("end").classList.contains("hidden") })');
  check('rematch starts a fresh build phase', rematch.state === 'build' && rematch.wave === 0 && rematch.towers === 0 && rematch.hidden, JSON.stringify(rematch));
}

/* ---------------- main ---------------- */
const scenario = process.argv[2] || 'all';
let c = null;
try {
  c = await openTab();
  if (scenario === 'menu' || scenario === 'all') await scenarioMenu(c);
  if (scenario === 'battle' || scenario === 'all') await scenarioBattle(c);
  if (scenario === 'fullrun') await scenarioFullrun(c);
  if (scenario === 'wavestudy') await scenarioWaveStudy(c, parseInt(process.argv[3] || '19', 10));
  if (scenario === 'boss') await scenarioBoss(c);
  if (scenario === 'reactions') await scenarioReactions(c);
  const errs = c.consoleLogs.filter((e) =>
    !/favicon/i.test(e) && !/Failed to load resource/i.test(e) && !/preview renderer unavailable/i.test(e));
  check('zero runtime errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  const badRenders = await c.eval('(window.__badRenders || []).join(" || ")');
  if (badRenders) console.log('[smoke] BAD RENDER CALLS:', badRenders);
  const f = results.filter((r) => !r.ok).length;
  console.log(`\n[smoke] ${results.length - f}/${results.length} checks passed, ${f} failed`);
  if (f > 0) process.exitCode = 1;
} catch (e) {
  console.error('[smoke] DRIVER ERROR:', e.message);
  process.exitCode = 2;
} finally {
  try { c && c.ws.close(); } catch (_) {}
  server.close();
  process.exit();
}
