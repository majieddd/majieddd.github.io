// ===== ui.js : HUD controller. Binds DOM to the Game. =====

function makeUI(game, audio) {
  const U = {};
  U.game = game; U.audio = audio;
  U.$ = (id) => document.getElementById(id);
  U.tip = U.$('tip');

  const ICONS = {
    cannon: '<svg viewBox="0 0 40 40"><rect x="16" y="14" width="8" height="14" rx="2" fill="#2a3a52"/><rect x="14" y="22" width="12" height="6" rx="2" fill="#37506f"/><circle cx="20" cy="30" r="4" fill="#38e8ff"/></svg>',
    tesla: '<svg viewBox="0 0 40 40"><rect x="17" y="10" width="6" height="20" rx="2" fill="#33485f"/><circle cx="20" cy="14" r="6" fill="#8ad8ff"/><path d="M20 4 L24 12 L16 12 Z" fill="#38e8ff"/></svg>',
    frost: '<svg viewBox="0 0 40 40"><polygon points="20,6 30,20 20,34 10,20" fill="#2c4a5e"/><circle cx="20" cy="20" r="5" fill="#7fe9ff"/></svg>',
    flak: '<svg viewBox="0 0 40 40"><rect x="17" y="16" width="6" height="12" rx="2" fill="#2e4258"/><rect x="10" y="14" width="4" height="16" rx="2" fill="#46627e"/><rect x="26" y="14" width="4" height="16" rx="2" fill="#46627e"/><circle cx="20" cy="30" r="5" fill="#5ad1ff"/></svg>',
    lance: '<svg viewBox="0 0 40 40"><rect x="17" y="12" width="6" height="18" rx="2" fill="#2a3c54"/><rect x="10" y="8" width="20" height="4" rx="2" fill="#3a5470"/><circle cx="20" cy="8" r="4" fill="#bafcff"/><path d="M20 2 L24 8 L16 8 Z" fill="#38e8ff"/></svg>',
  };

  // Build palette cards
  U.cards = {};
  const cardsEl = U.$('cards');
  for (const type of TOWER_ORDER) {
    const def = TOWERS[type];
    const el = document.createElement('div');
    el.className = 'card'; el.dataset.type = type;
    el.innerHTML = `<div class="ic">${ICONS[type]}</div><div class="nm">${def.name}</div><div class="cost">◆${def.cost}</div>`;
    el.addEventListener('click', () => { U.audio.resume(); U.selectBuild(type); });
    el.addEventListener('mouseenter', (e) => U.showTip(e, `<b>${def.name}</b> — ${def.role}<br>${def.desc}<br><br>Dmg ${def.dmg} · Rng ${def.range} · ${def.rate}/s${def.splash ? ' · Splash' : ''}${def.slow ? ' · Slow' : ''}${def.chain ? ' · Chain' : ''}`));
    el.addEventListener('mousemove', (e) => U.moveTip(e));
    el.addEventListener('mouseleave', () => U.hideTip());
    cardsEl.appendChild(el); U.cards[type] = el;
  }

  U.selectBuild = function (type) {
    game.selectBuild(type);
    for (const t of TOWER_ORDER) U.cards[t].classList.toggle('sel', t === type);
    U.$('inspect').classList.remove('show');
  };

  // Inspect panel buttons
  U.$('b-up').addEventListener('click', () => { U.audio.resume(); game.tryUpgrade(); });
  U.$('b-sell').addEventListener('click', () => { game.trySell(); U.refreshInspect(); });
  // Wave / top controls
  U.$('b-wave').addEventListener('click', () => { U.audio.resume(); game.startWave(false); });
  U.$('b-speed').addEventListener('click', () => { const s = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1; game.setSpeed(s); U.$('b-speed').textContent = s + '×'; });
  U.$('b-pause').addEventListener('click', () => { game.togglePause(); U.$('b-pause').textContent = game.paused ? 'RESUME' : 'PAUSE'; });
  U.$('b-restart').addEventListener('click', () => { U.audio.resume(); game.reset(); U.hideOverlay(); U.syncAll(); });
  U.$('b-mute').addEventListener('click', () => { const m = U.$('b-mute').textContent === '♪'; audio.setMuted(m); U.$('b-mute').textContent = m ? '✕' : '♪'; });

  // Pips
  const pipsEl = U.$('pips');
  for (let i = 0; i < game.sim.totalWaves; i++) { const p = document.createElement('div'); p.className = 'pip'; pipsEl.appendChild(p); }
  U.pips = pipsEl.children;

  // Tooltip
  U.showTip = function (e, html) { U.tip.innerHTML = html; U.tip.style.display = 'block'; U.moveTip(e); };
  U.moveTip = function (e) { const x = e.clientX + 14, y = e.clientY + 14; U.tip.style.left = Math.min(x, window.innerWidth - 260) + 'px'; U.tip.style.top = Math.min(y, window.innerHeight - 120) + 'px'; };
  U.hideTip = function () { U.tip.style.display = 'none'; };

  U.toast = function (msg, cls) {
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.textContent = msg;
    U.$('toast').appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2200);
  };

  U.refreshInspect = function () {
    const id = game.selectedTower;
    const panel = U.$('inspect');
    if (id == null) { panel.classList.remove('show'); return; }
    const t = game.sim.towers.find((x) => x.id === id);
    if (!t) { panel.classList.remove('show'); return; }
    panel.classList.add('show');
    U.$('insp-name').textContent = t.def.name;
    U.$('insp-role').textContent = t.def.role + ' · LV ' + t.level;
    U.$('insp-dmg').textContent = Math.round(t.dmg);
    U.$('insp-range').textContent = t.range.toFixed(1);
    U.$('insp-rate').textContent = t.rate.toFixed(2) + '/s';
    U.$('insp-lvl').textContent = t.level + '/3';
    const up = U.$('b-up');
    if (t.level >= 3) { up.textContent = 'MAX'; up.disabled = true; up.style.opacity = 0.4; }
    else { const cost = Math.round(t.def.cost * 0.75 * t.level); up.textContent = 'UP ◆' + cost; up.disabled = false; up.style.opacity = 1; up.style.color = game.sim.gold >= cost ? '' : 'var(--red)'; }
    U.$('b-sell').textContent = 'SELL ◆' + Math.round(t.totalSpent * 0.6);
  };

  U.syncAll = function () {
    U.$('s-gold').textContent = Math.floor(game.sim.gold);
    U.$('s-lives').textContent = game.sim.lives;
    U.$('s-wave').textContent = (game.sim.waveIndex + 1 > game.sim.totalWaves ? game.sim.totalWaves : game.sim.waveIndex + 1) + '/' + game.sim.totalWaves;
    U.$('s-score').textContent = Math.floor(game.sim.score);
    U.$('wave-label').textContent = 'WAVE ' + (game.sim.waveIndex + 1);
    const w = game.sim.waveIndex;
    for (let i = 0; i < U.pips.length; i++) { U.pips[i].className = 'pip' + (i < w ? ' done' : i === w && game.sim.waveActive ? ' active' : ''); }
    const waveBtn = U.$('b-wave');
    if (game.sim.waveActive) { waveBtn.textContent = 'IN PROGRESS'; waveBtn.disabled = true; waveBtn.style.opacity = 0.5; }
    else if (game.sim.waveIndex + 1 >= game.sim.totalWaves) { waveBtn.textContent = 'NONE'; waveBtn.disabled = true; waveBtn.style.opacity = 0.5; }
    else { waveBtn.textContent = game.sim.waveIndex >= 0 ? 'NEXT WAVE ▶' : 'START WAVE ▶'; waveBtn.disabled = false; waveBtn.style.opacity = 1; }
    for (const type of TOWER_ORDER) U.cards[type].classList.toggle('poor', game.sim.gold < TOWERS[type].cost);
    U.refreshInspect();
    // end-state overlay (robust to rAF throttling since this runs every frame)
    if (game.sim.state !== 'playing') { if (!U._endedShown) { U._endedShown = true; U.showOverlay(game.sim.state === 'victory' ? 'win' : 'lose', game.sim); } }
    else { if (U._endedShown) { U._endedShown = false; U.hideOverlay(); } }
  };

  U.showOverlay = function (kind, sim) {
    const m = U.$('modal'); const ov = U.$('overlay');
    if (kind === 'win') {
      m.innerHTML = `<h1 class="win">EARTH HOLDS</h1><div class="sub">Campaign Clear · ${sim.waveIndex + 1} Waves</div>
        <p>${LORE.win}</p>
        <div class="stats"><div>SCORE<b>${Math.floor(sim.score)}</b></div><div>KILLS<b>${sim.kills}</b></div><div>LEAKS<b>${sim.leaks}</b></div></div>
        <button class="btn primary" id="b-again">PLAY AGAIN</button>`;
    } else {
      m.innerHTML = `<h1 class="lose">CORE LOST</h1><div class="sub">Wave ${sim.waveIndex + 1} of ${sim.totalWaves}</div>
        <p>${LORE.lose}</p>
        <div class="stats"><div>SCORE<b>${Math.floor(sim.score)}</b></div><div>KILLS<b>${sim.kills}</b></div><div>WAVES<b>${sim.waveIndex + 1}</b></div></div>
        <button class="btn primary" id="b-again">RETRY</button>`;
    }
    ov.classList.remove('hide');
    U.$('b-again').addEventListener('click', () => { U.audio.resume(); game.reset(); U.hideOverlay(); U.syncAll(); });
  };
  U.hideOverlay = function () { U.$('overlay').classList.add('hide'); };

  // floating world-anchored gold text on kill
  U.floatText = function (wx, wz, text, hue) {
    const v = new window.THREE.Vector3(wx, 0.6, wz);
    v.project(game.rt.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-family:var(--mono);font-weight:700;font-size:15px;color:#${hue.toString(16).padStart(6,'0')};text-shadow:0 0 8px rgba(251,191,36,0.6);pointer-events:none;z-index:15;transition:all .8s ease-out;opacity:1;`;
    document.getElementById('hud').appendChild(el);
    requestAnimationFrame(() => { el.style.top = (y - 34) + 'px'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 820);
  };

  // big center wave banner
  U.banner = function (title, sub) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;z-index:18;opacity:0;transition:opacity .3s;';
    el.innerHTML = `<div style="font-size:46px;letter-spacing:6px;font-weight:800;color:var(--cyan);text-shadow:0 0 30px rgba(56,232,255,0.6)">${title}</div><div style="font-size:13px;letter-spacing:4px;color:var(--text-mute);text-transform:uppercase;margin-top:6px">${sub}</div>`;
    document.getElementById('hud').appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; }, 1400);
    setTimeout(() => el.remove(), 1800);
  };

  return U;
}
