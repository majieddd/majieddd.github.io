// Headless smoke test: run the REAL game modules under Node with mocked THREE/DOM/Audio.
// Catches internal crashes (undefined refs, bad signatures, sim/render/UI wiring) without a browser.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const SRC = path.join(path.dirname(fs.realpathSync(new URL(import.meta.url))), '..', 'src');

// ---- THREE mock (permissive, but value holders are real) ----
class Vec { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(a,b,c){this.x=a;this.y=b;this.z=c;return this;} setScalar(s){this.x=this.y=this.z=s;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} add(){return this;} sub(){return this;} normalize(){return this;} clone(){return new Vec(this.x,this.y,this.z);} multiplyScalar(){return this;} length(){return 0;} distanceTo(){return 0;} dot(){return 0;} applyQuaternion(){return this;} project(){ return this; } unproject(){ return this; } }
class Col { constructor(){this.r=1;this.g=1;this.b=1;} set(){return this;} setHex(){return this;} setRGB(){return this;} getHex(){return 0;} clone(){return new Col();} }
function inst() {
  const o = { position: new Vec(), rotation: new Vec(), scale: new Vec(), userData: {}, children: [], visible: true,
    material: { color: new Col(), emissive: new Col(), emissiveIntensity: 1, opacity: 1, transparent: false, dispose(){} },
    geometry: { attributes: { position: { count: 0, getX:()=>0, getY:()=>0, getZ:()=>0, setXYZ(){} } }, computeVertexNormals(){}, dispose(){}, setFromPoints(){return this;} } };
  return new Proxy(o, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'add') return (x) => { t.children.push(x); return x; };
      if (p === 'remove') return () => {};
      if (p === 'clone') return () => inst();
      if (p === 'lookAt' || p === 'traverse' || p === 'setScalar' || p === 'setHex' || p === 'dispose' || p === 'render' || p === 'setRenderTarget' || p === 'setSize' || p === 'setPixelRatio' || p === 'setClearColor' || p === 'computeVertexNormals' || p === 'updateProjectionMatrix' || p === 'connect' || p === 'start' || p === 'stop' || p === 'setAttribute' || p === 'setFromPoints' || p === 'setIndex' || p === 'computeBoundingSphere' || p === 'translate' || p === 'rotateX' || p === 'rotateY' || p === 'rotateZ' || p === 'toNonIndexed' || p === 'mergeVertices') return () => {};
      if (p === 'getSize') return (v) => { if (v && 'x' in v) { v.x = 800; v.y = 600; } return v || new Vec(800, 600); };
      if (p === 'getPoints') return () => [];
      if (p === 'getChannelData') return () => new Float32Array(16);
      if (p === 'isObject3D') return true;
      return inst();
    },
    set(t, p, val) { t[p] = val; return true; },
  });
}
function threeClass() { const f = function () { return inst(); }; return new Proxy(f, { construct() { return inst(); }, get() { return threeClass(); } }); }
const THREE = new Proxy({}, {
  get(t, p) {
    if (p === 'Vector2' || p === 'Vector3') return function (x, y, z) { return new Vec(x || 0, y || 0, z || 0); };
    return threeClass();
  },
  set() { return true; },
});

// ---- AudioContext mock ----
function audioParam(){ return { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){}, linearRampToValueAtTime(){} }; }
function AudioContextMock() {
  return {
    sampleRate: 44100, currentTime: 0, state: 'running', destination: {}, resume(){},
    createGain(){ return { gain: audioParam(), connect(){} }; },
    createOscillator(){ return { type:'sine', frequency: audioParam(), detune: audioParam(), connect(){}, start(){}, stop(){} }; },
    createBufferSource(){ return { buffer:null, connect(){}, start(){}, stop(){} }; },
    createBiquadFilter(){ return { type:'lowpass', frequency: audioParam(), connect(){} }; },
    createConvolver(){ return { buffer: null, connect(){} }; },
    createBuffer(ch, len){ return { getChannelData(){ return new Float32Array(len); } }; },
  };
}

// ---- DOM mock ----
function makeEl() {
  const store = { style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, value: '', children: [] };
  const classList = { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){ if(f===undefined) this._s.has(c)?this._s.delete(c):this._s.add(c); else f?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} };
  const o = {
    style: store.style, dataset: store.dataset, classList, children: store.children,
    addEventListener(){}, removeEventListener(){}, appendChild(c){ store.children.push(c); return c; }, removeChild(){},
    setAttribute(){}, removeAttribute(){}, setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect(){ return { left:0, top:0, width:1280, height:720 }; },
    click(){ /* invoke any click handler? we don't store them; gate handler is registered via addEventListener mock */ },
    focus(){}, querySelector(){ return makeEl(); }, getContext(){ return null; },
    clientWidth: 1280, clientHeight: 720,
  };
  return new Proxy(o, { get(t,p){ if (p in t) return t[p]; if (p==='textContent'||p==='innerHTML'||p==='disabled'||p==='value') return store[p]; return undefined; }, set(t,p,v){ if(p in store) store[p]=v; else t[p]=v; return true; } });
}
const elCache = {};
const document = {
  getElementById(id){ return elCache[id] || (elCache[id] = makeEl()); },
  createElement(){ return makeEl(); },
  querySelector(){ return makeEl(); },
  addEventListener(){}, body: makeEl(),
};
const windowMock = {
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  AudioContext: AudioContextMock, webkitAudioContext: AudioContextMock,
  addEventListener(){}, removeEventListener(){},
  requestAnimationFrame(){ return 0; }, // no-op: we drive frames manually
};
windowMock.THREE = THREE;

// ---- vm context ----
const ctx = { Math, Set, Map, JSON, console, THREE, window: windowMock, document,
  requestAnimationFrame: () => 0, setTimeout: () => 0, Float32Array, Array, Object, Number, String, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;
vm.createContext(ctx);
// modules reference bare `window`, `document`, `requestAnimationFrame`, `THREE`
for (const f of ['02_data.js','03_sim.js','04_art.js','05_render.js','06_audio.js','07_game.js','08_ui.js','09_input.js','10_boot.js']) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}

// drive
try {
  const g = ctx.window.__cc && ctx.window.__cc.game;
  if (!g) throw new Error('window.__cc.game not exposed');
  const origNow = 0; let now = 0;
  // simulate gate: start audio + music
  ctx.window.__cc.audio.resume(); ctx.window.__cc.audio.startMusic();
  // build a defensive line
  const spots = [[5,0],[5,2],[10,2],[10,4],[15,0],[15,4],[16,6]];
  let placed = 0;
  for (const [c, r] of spots) {
    g.selectBuild('cannon'); g.tryBuildAt(c, r);
    g.selectBuild('tesla'); if (g.sim.canBuildAt(c, r < 12 ? r + 1 : r - 1)) g.tryBuildAt(c, r < 12 ? r + 1 : r - 1);
    placed++;
  }
  g.startWave(false);
  let maxEnemies = 0, frames = 0;
  for (let i = 0; i < 60 * 60; i++) {
    now += 16; g.frame(now); frames++;
    maxEnemies = Math.max(maxEnemies, g.sim.enemies.length);
    ctx.window.__cc.ui.syncAll();
    if (g.sim.state !== 'playing') break;
    if (!g.sim.waveActive && g.sim.enemies.length === 0 && g.sim.waveIndex < g.sim.totalWaves - 1) g.startWave(false);
    if (frames % 120 === 0) for (const t of g.sim.towers) g.sim.upgradeTower(t.id);
  }
  console.log(`SMOKE OK | frames=${frames} towers=${g.sim.towers.length} maxEnemies=${maxEnemies} kills=${g.sim.kills} gold=${Math.floor(g.sim.gold)} lives=${g.sim.lives} state=${g.sim.state} wave=${g.sim.waveIndex+1}/${g.sim.totalWaves}`);
  if (g.sim.towers.length === 0) throw new Error('no towers built');
  if (maxEnemies === 0) throw new Error('no enemies spawned');
  console.log('SMOKE PASS');
} catch (e) {
  console.error('SMOKE FAIL:', e && e.stack ? e.stack : e);
  process.exit(1);
}
