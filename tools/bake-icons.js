/* BAKE THE GAME'S OWN ICONS INTO FILES.  node tools/bake-icons.js <url>
 *
 * The narrative spine is static HTML, but the tower and unit icons are
 * PROCEDURAL: UI.paintTowerIcons draws every tower with its real
 * Tower.prototype.draw_<id> at tier-3 preview stats on the battlefield
 * plinth, and UI.paintUnitIcons draws every denizen with Enemy.prototype.draw
 * normalised to the tile. The manual and the board agree by construction,
 * which is exactly why this does NOT re-implement the drawing: it loads the
 * real bundle in headless Chrome, runs the game's own painters, and saves the
 * pixels to narrative/assets/icon_tw_<id>.webp and icon_un_<id>.webp at 2x.
 *
 * The baked files are committed like the art plates are, because the deploy
 * regeneration (pages.yml) runs node-only and cannot launch a browser. That
 * means a changed draw function needs a re-bake; tools/storyboard.js --check
 * fails when an icon a page references is MISSING, and this tool is the fix
 * it names. Content staleness after a redraw is accepted and visible, the
 * same standing the plates have.
 *
 * The painters swallow draw exceptions on purpose ("never let one sprite
 * break a menu"), which for a BAKE would mean shipping a plinth with no
 * turret and no error. So each draw is wrapped to record throws, and the
 * bake fails loudly on any throw or any suspiciously tiny image instead of
 * writing it.
 *
 * USAGE:
 *   python -m http.server 8623 --bind 127.0.0.1     # repo root
 *   node tools/bake-icons.js http://127.0.0.1:8623
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.argv[2];
if (!/^https?:\/\//.test(BASE || '')) {
  console.error('usage: node tools/bake-icons.js http://127.0.0.1:8623');
  process.exit(2);
}

/* One tower or unit per painter call, so a wrapped draw that throws can name
   the id it threw for. Sizes are 2x the on-page display (52px) for crisp
   rendering at devicePixelRatio 1, which is what headless gives. */
const EVAL = `(async () => {
  const out = { towers: {}, units: {}, thrown: [], usedFallback: [] };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(box);
  for (const id of TOWER_ORDER) {
    box.innerHTML = UI.towerIconHTML(id, 92);
    const fnName = 'draw_' + id;
    const orig = Tower.prototype[fnName];
    if (!orig && !TOWER_TYPES[id].glyph) out.usedFallback.push('tower ' + id);
    let threw = null;
    if (orig) Tower.prototype[fnName] = function () {
      try { return orig.apply(this, arguments); }
      catch (e) { threw = e.message; throw e; }
    };
    UI.paintTowerIcons(box);
    if (orig) Tower.prototype[fnName] = orig;
    if (threw) out.thrown.push('tower ' + id + ': ' + threw);
    out.towers[id] = box.firstChild.toDataURL('image/webp', 0.92);
  }
  const origDraw = Enemy.prototype.draw;
  for (const id of Object.keys(ENEMY_TYPES)) {
    box.innerHTML = UI.unitIconHTML(id, 88);
    let threw = null;
    Enemy.prototype.draw = function () {
      try { return origDraw.apply(this, arguments); }
      catch (e) { threw = e.message; throw e; }
    };
    UI.paintUnitIcons(box);
    Enemy.prototype.draw = origDraw;
    if (threw) out.thrown.push('unit ' + id + ': ' + threw);
    out.units[id] = box.firstChild.toDataURL('image/webp', 0.92);
  }
  box.remove();
  return out;
})()`;

const steps = [{ size: [1600, 900] }, { wait: 3500 }, { eval: EVAL }];
const stepFile = path.join(os.tmpdir(), 'bake-icons-steps-' + process.pid + '.js');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-icons-'));
fs.writeFileSync(stepFile, 'module.exports = ' + JSON.stringify(steps) + ';');

const r = spawnSync(process.execPath,
  ['tools/headless.js', BASE + '/aegis-protocol.html?v=' + Date.now(), outDir, stepFile],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
try { fs.unlinkSync(stepFile); } catch (e) { /* best effort on a temp file */ }

/* headless.js may pretty-print; take everything from the first brace. */
const braceAt = (r.stdout || '').indexOf('{');
if (braceAt < 0) {
  console.error('headless run produced no JSON. stderr:\n' + (r.stderr || '').slice(0, 800));
  process.exit(1);
}
const payload = JSON.parse(r.stdout.slice(braceAt));
const res = (payload.results || []).map(x => x.value).find(v => v && v.towers);
if (!res) {
  console.error('eval returned no icon payload: ' +
    JSON.stringify((payload.results || []).slice(-1)).slice(0, 500));
  process.exit(1);
}
if (res.thrown && res.thrown.length) {
  console.error('draw functions threw during the bake (the in-game painter would have ' +
    'swallowed these):\n  ' + res.thrown.join('\n  '));
  process.exit(1);
}
if (res.usedFallback && res.usedFallback.length)
  console.log('note: generic draw fallback (no draw_<id>, no glyph): ' + res.usedFallback.join(', '));

/* A webp under this floor is a plinth with nothing on it, or an empty tile.
   Measured on the first real bake: the smallest genuine tower icon and unit
   tile both clear it with room. If a legitimate icon ever trips this, raise
   the evidence, not the floor. */
const FLOOR = 250;
const assetDir = path.join(ROOT, 'narrative', 'assets');
fs.mkdirSync(assetDir, { recursive: true });
let wrote = 0, kept = 0, sizes = [];
function put(name, dataUri, what) {
  if (dataUri.slice(0, 23) !== 'data:image/webp;base64,')
    throw new Error(what + ' did not encode as webp: ' + dataUri.slice(0, 40));
  const buf = Buffer.from(dataUri.slice(23), 'base64');
  if (buf.length < FLOOR)
    throw new Error(what + ' baked to only ' + buf.length + ' bytes, which is a blank tile, not an icon');
  sizes.push(buf.length);
  const p = path.join(assetDir, name);
  let cur = null;
  try { cur = fs.readFileSync(p); } catch (e) { /* missing: write below */ }
  if (cur && cur.equals(buf)) { kept++; return; }
  fs.writeFileSync(p, buf);
  wrote++;
}
const expected = new Set();
for (const id of Object.keys(res.towers)) { expected.add('icon_tw_' + id + '.webp'); put('icon_tw_' + id + '.webp', res.towers[id], 'tower ' + id); }
for (const id of Object.keys(res.units)) { expected.add('icon_un_' + id + '.webp'); put('icon_un_' + id + '.webp', res.units[id], 'unit ' + id); }

/* Icon files are THIS tool's to manage (storyboard.js's orphan pass leaves
   icon_* alone): a tower or denizen removed from the game loses its file on
   the next bake, here. */
let removed = 0;
for (const f of fs.readdirSync(assetDir))
  if (/^icon_(tw|un)_.*\.webp$/.test(f) && !expected.has(f)) { fs.unlinkSync(path.join(assetDir, f)); removed++; }

sizes.sort((a, b) => a - b);
console.log('baked ' + Object.keys(res.towers).length + ' tower icons and ' +
  Object.keys(res.units).length + ' unit icons: ' + wrote + ' written, ' + kept +
  ' unchanged, ' + removed + ' stale removed; bytes min ' + sizes[0] + ', median ' + sizes[Math.floor(sizes.length / 2)] +
  ', max ' + sizes[sizes.length - 1]);
console.log('now run: node tools/storyboard.js');
