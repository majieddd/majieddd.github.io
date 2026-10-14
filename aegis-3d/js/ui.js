/* aegis-3d/js/ui.js — every DOM surface: start screen, battle HUD, tower shop
   with live 3D previews, tower inspector, banners, pause/end screens, settings.
   The engine calls into this object (Game.ui); this module never mutates game
   state except through the handlers wired here. */
(function () {
  'use strict';

  const U = {};
  const $ = (id) => document.getElementById(id);

  let shopCards = [];
  let selectedFaction = 'human';
  let selectedCommander = 'vanta';
  let selectedDifficulty = 'contested';
  let previewRenderer = null, previewScene = null, previewCamera = null;
  const previewCanvases = {};

  /* ------------------------------------------------------------ */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ------------------------------------------------------------ */
  U.init = function () {
    buildMenu();
    wireHud();
    Game.ui = U;
  };

  /* ------------------------- MENU ------------------------------ */
  function buildMenu() {
    const menu = $('menu');
    menu.innerHTML = '';

    const header = el('div', 'menu-header');
    header.innerHTML = `
      <div class="kicker">COSMIC CONQUEST</div>
      <h1>LOWPOLY</h1>
      <div class="subtitle">A tower defence in the Neon Reliquary — painted, faceted, alive.</div>`;
    menu.appendChild(header);

    /* Faction + commander select. */
    const row = el('div', 'menu-row');
    const facPanel = el('div', 'panel menu-panel');
    facPanel.appendChild(el('div', 'panel-title', 'CHOOSE YOUR POWER'));
    const facGrid = el('div', 'faction-grid');
    for (const id in Data.FACTIONS) {
      const f = Data.FACTIONS[id];
      const btn = el('button', 'faction-card' + (id === 'human' ? ' active' : ''), '');
      btn.style.setProperty('--fc', f.color);
      btn.innerHTML = `<span class="faction-sigil"></span><span class="faction-name">${f.name}</span>`;
      btn.onclick = () => selectFaction(id);
      facGrid.appendChild(btn);
    }
    facPanel.appendChild(facGrid);

    const cmdPanel = el('div', 'panel menu-panel');
    cmdPanel.appendChild(el('div', 'panel-title', 'COMMANDER'));
    const cmdCard = el('div', 'commander-card');
    cmdCard.id = 'cmd-card';
    cmdPanel.appendChild(cmdCard);

    const diffPanel = el('div', 'panel menu-panel');
    diffPanel.appendChild(el('div', 'panel-title', 'DIFFICULTY'));
    const diffRow = el('div', 'chip-row');
    for (const d of Data.DIFFICULTIES) {
      const chip = el('button', 'chip' + (d.id === 'contested' ? ' active' : ''), d.name);
      chip.onclick = () => {
        selectedDifficulty = d.id;
        diffRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        Audio.sfx.click();
      };
      diffRow.appendChild(chip);
    }
    diffPanel.appendChild(diffRow);

    const start = el('button', 'btn-primary', 'DEPLOY');
    start.onclick = () => {
      Audio.init();
      Audio.sfx.click();
      const diff = Data.DIFFICULTIES.find((d) => d.id === selectedDifficulty);
      $('menu').classList.add('hidden');
      $('hud').classList.remove('hidden');
      Game.startMatch({ commander: selectedCommander, difficulty: diff });
    };
    diffPanel.appendChild(start);
    const tip = el('div', 'menu-tip',
      'Right-drag to pan · scroll to zoom · click ground to place · <b>N</b> rushes the wave · <b>Q</b>/<b>E</b> commander abilities · <b>Space</b> pause');
    diffPanel.appendChild(tip);

    row.appendChild(facPanel);
    row.appendChild(cmdPanel);
    row.appendChild(diffPanel);
    menu.appendChild(row);

    selectFaction('human');
  }

  function selectFaction(id) {
    selectedFaction = id;
    document.querySelectorAll('.faction-card').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('.faction-card')[Object.keys(Data.FACTIONS).indexOf(id)].classList.add('active');
    const commander = Data.COMMANDERS.find((c) => c.faction === id);
    selectedCommander = commander.id;
    renderCommanderCard(commander);
    document.body.style.setProperty('--fc', Data.FACTIONS[id].color);
    document.body.style.setProperty('--fa', Data.FACTIONS[id].accent);
  }

  function renderCommanderCard(c) {
    const card = $('cmd-card');
    const cv = document.createElement('canvas');
    cv.className = 'commander-emblem';
    cv.width = 192; cv.height = 192;
    cv.getContext('2d').drawImage(Paint.emblem(c.id), 0, 0);
    card.innerHTML = '';
    card.appendChild(cv);
    const body = el('div', 'commander-body');
    body.innerHTML = `
      <div class="commander-name">${c.name}</div>
      <div class="commander-title">${c.title}</div>
      <div class="commander-line">"${c.line}"</div>
      <div class="commander-abilities">
        <div class="ab"><span class="ab-key">Q</span><b>${c.Q.name}</b> — ${c.Q.desc}</div>
        <div class="ab"><span class="ab-key">E</span><b>${c.E.name}</b> — ${c.E.desc}</div>
      </div>
      <div class="commander-passive">${c.passive.name}: ${c.passive.desc}</div>`;
    card.appendChild(body);
  }

  /* ------------------------- HUD ------------------------------- */
  function wireHud() {
    $('btn-pause').onclick = () => Game.togglePause();
    $('btn-speed').onclick = () => Game.setSpeed(Game.speed === 1 ? 2 : Game.speed === 2 ? 4 : 1);
    $('btn-mute').onclick = () => {
      Audio.setMuted(!Audio.state.muted);
      $('btn-mute').classList.toggle('muted', Audio.state.muted);
    };
    $('btn-settings').onclick = () => { $('settings').classList.toggle('hidden'); };
    $('btn-settings-close').onclick = () => { $('settings').classList.add('hidden'); };

    $('pause-btn-resume').onclick = () => Game.togglePause();
    $('pause-btn-menu').onclick = () => backToMenu();
    /* btn-rematch / btn-menu are built dynamically in endScreen. */

    /* Settings. */
    const vols = [['master', 'vol-master'], ['music', 'vol-music'], ['sfx', 'vol-sfx']];
    for (const [key, id] of vols) {
      const s = $(id);
      s.value = Audio.state.vol[key] * 100;
      s.oninput = () => Audio.setVolume(key, s.value / 100);
    }
    $('q-bloom').onchange = (e) => Game.setQuality('bloom', e.target.checked);
    $('q-shadow').onchange = (e) => Game.setQuality('shadows', e.target.checked);
    $('q-res').onchange = (e) => Game.setQuality('dpr', e.target.checked ? 2 : 1);

    buildShop();
    buildCommanderPanel();
  }

  function backToMenu() {
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('menu').classList.remove('hidden');
    Game.state = 'menu';
    Game.placing = false;
    Game.selected = null;
    $('inspector').classList.add('hidden');
    shopHighlight(null);
    U.syncHud();
  }

  /* ------------------------ SHOP ------------------------------- */
  function buildShop() {
    const bar = $('shop');
    bar.innerHTML = '';
    shopCards = [];
    Data.TOWERS.forEach((t, i) => {
      const card = el('button', 'shop-card', '');
      card.style.setProperty('--ec', Data.ELEMENT_META[t.element].color);
      const cv = document.createElement('canvas');
      cv.className = 'preview-canvas';
      cv.width = 96; cv.height = 96;
      card.appendChild(cv);
      const meta = el('div', 'shop-meta',
        `<span class="shop-name">${t.name}</span><span class="shop-cost">${t.cost}</span>`);
      card.appendChild(meta);
      card.title = `${t.name} — ${t.role}. ${t.desc}`;
      card.onclick = () => {
        Audio.init();
        if (Game.state !== 'build' && Game.state !== 'battle') return;
        if (Game.placing && Game.shopPick === t.id) {
          Game.placing = false;
          shopHighlight(null);
        } else {
          Game.placing = true;
          Game.shopPick = t.id;
          Game.castMode = false;
          U.castHint(false);
          shopHighlight(i);
          Audio.sfx.click();
        }
      };
      bar.appendChild(card);
      shopCards.push(card);
      previewCanvases[t.id] = cv;
    });
    renderPreviews();
  }

  function shopHighlight(idx) {
    shopCards.forEach((c, i) => c.classList.toggle('active', i === idx));
  }
  U.shopHighlight = shopHighlight;

  /* Live 3D thumbnails: one tiny renderer draws each tower once into its card. */
  function renderPreviews() {
    try {
      previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      previewRenderer.setClearColor(0x000000, 0);
      previewRenderer.setSize(96, 96);
      previewScene = new THREE.Scene();
      previewScene.add(new THREE.HemisphereLight(0xbfa8ff, 0x0a0e17, 1.15));
      const dl = new THREE.DirectionalLight(0xffffff, 1.1);
      dl.position.set(3, 5, 4);
      previewScene.add(dl);
      previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
      previewCamera.position.set(2.6, 3.2, 4.4);
      previewCamera.lookAt(0, 0.9, 0);
      for (const t of Data.TOWERS) {
        const model = Towers.previewModel(t.id, 1);
        model.rotation.y = 0.6;
        previewScene.add(model);
        previewRenderer.render(previewScene, previewCamera);
        previewScene.remove(model);
        const ctx = previewCanvases[t.id].getContext('2d');
        ctx.drawImage(previewRenderer.domElement, 0, 0, 96, 96);
      }
    } catch (e) {
      console.warn('preview renderer unavailable', e);
    }
  }

  /* --------------------- COMMANDER PANEL ----------------------- */
  function buildCommanderPanel() {
    const p = $('commander-panel');
    p.innerHTML = '';
    for (const slot of ['Q', 'E']) {
      const btn = el('button', 'ab-btn', '');
      btn.id = 'ab-' + slot;
      btn.innerHTML = `<span class="ab-key">${slot}</span><span class="ab-name"></span><span class="ab-cd"></span>`;
      btn.onclick = () => {
        Audio.init();
        if (Game.state !== 'battle' && Game.state !== 'build') return;
        if (slot === 'Q') Commander.castQ();
        else {
          const c = Commander.current;
          if (c && c.def.E.cast) {
            if (!Game.castMode && c.E.cd <= 0) {
              Game.placing = false;
              shopHighlight(null);
            }
          }
          Commander.castE();
        }
        U.syncHud();
      };
      p.appendChild(btn);
    }
  }

  /* ------------------------ INSPECTOR -------------------------- */
  U.selectTower = function (t) {
    const box = $('inspector');
    if (!t) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    const s = t.stats;
    const u = t.upgradeDef;
    box.innerHTML = `
      <div class="insp-title"><span class="el-dot" style="background:${Data.ELEMENT_META[t.def.element].color}"></span>
        ${t.def.name}<span class="insp-tier">${'●'.repeat(t.tier)}${'○'.repeat(3 - t.tier)}</span></div>
      <div class="insp-role">${t.def.role}</div>
      <div class="insp-stats">
        <div><span>DMG</span><b>${Math.round(s.damage * 10) / 10}</b></div>
        <div><span>RATE</span><b>${Math.round(s.rate * 10) / 10}/s</b></div>
        <div><span>RANGE</span><b>${Math.round(s.range)}</b></div>
        <div><span>ELEMENT</span><b>${Data.ELEMENT_META[t.def.element].name}</b></div>
      </div>
      <div class="insp-target" id="insp-target">TARGET: FIRST</div>
      ${u ? `<button class="btn-upgrade" id="btn-upg">${u.name} — ${u.cost}</button>`
          : (t.asc === 0
              ? `<button class="btn-upgrade" id="btn-asc">ASCEND — ${t.ascCost}</button>`
              : `<button class="btn-upgrade" id="btn-asc">ASCEND ${t.asc} — ${t.ascCost}</button>`)}
      <button class="btn-sell" id="btn-sell">SELL — ${t.sellValue}</button>`;
    $('btn-upg') && ($('btn-upg').onclick = () => {
      if (Game.gold >= u.cost) {
        Game.gold -= u.cost;
        t.upgrade();
        U.selectTower(t);
        U.syncHud();
      } else Audio.sfx.err();
    });
    $('btn-asc') && ($('btn-asc').onclick = () => {
      if (Game.gold >= t.ascCost) {
        Game.gold -= t.ascCost;
        t.ascend();
        U.selectTower(t);
        U.syncHud();
      } else Audio.sfx.err();
    });
    $('btn-sell').onclick = () => {
      Towers.sell(t);
      U.selectTower(null);
      U.syncHud();
    };
    $('insp-target').onclick = () => {
      const modes = ['FIRST', 'CLOSE', 'STRONG', 'LAST'];
      const i = modes.indexOf(t.targeting);
      t.targeting = modes[(i + 1) % modes.length];
      $('insp-target').textContent = 'TARGET: ' + t.targeting.toUpperCase();
      Audio.sfx.click();
    };
  };

  /* ------------------------ BANNERS ---------------------------- */
  let bannerTimer = null;
  U.banner = function (title, sub) {
    const b = $('banner');
    b.innerHTML = `<div class="banner-title">${title}</div>${sub ? `<div class="banner-sub">${sub}</div>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
  };

  U.castHint = function (on) {
    $('cast-hint').classList.toggle('show', on);
  };

  U.livesFlash = function (lost) {
    const chip = $('lives-chip');
    chip.classList.remove('flash');
    void chip.offsetWidth;
    chip.classList.add('flash');
    U.syncHud();
  };

  U.pauseOverlay = function (on) {
    $('pause').classList.toggle('hidden', !on);
  };

  U.speedUI = function (s) {
    $('btn-speed').textContent = s + '×';
  };

  U.enterBattle = function () {
    $('inspector').classList.add('hidden');
    U.syncHud();
    U.speedUI(Game.speed);
  };

  U.tick = function (dt) {
    const c = Commander.current;
    if (c) {
      const q = $('ab-Q'), e = $('ab-E');
      if (q) {
        const qReady = c.Q.cd <= 0;
        q.classList.toggle('ready', qReady);
        q.classList.toggle('active', c.QActiveT > 0);
        q.querySelector('.ab-cd').textContent = qReady ? '' : Math.ceil(c.Q.cd) + 's';
      }
      if (e) {
        const eReady = c.E.cd <= 0;
        e.classList.toggle('ready', eReady);
        e.classList.toggle('active', c.EActiveT > 0 || Game.castMode);
        e.querySelector('.ab-cd').textContent = eReady ? '' : Math.ceil(c.E.cd) + 's';
      }
    }
    /* FPS. */
    if (Game._fpsEl === undefined) Game._fpsEl = $('fps');
    if (Game._fpsEl && (Game._fpsAcc = (Game._fpsAcc || 0) + dt) > 0.5) {
      Game._fpsEl.textContent = Math.round(1 / Math.max(0.0001, dt)) + ' fps';
      Game._fpsAcc = 0;
    }
  };

  U.syncHud = function () {
    $('wave-chip').textContent = 'WAVE ' + Math.max(1, Game.wave);
    $('gold-chip').textContent = Game.gold;
    $('lives-chip').textContent = '♥ ' + Game.lives;
    /* Commander names on buttons. */
    const c = Commander.current;
    if (c) {
      $('ab-Q').querySelector('.ab-name').textContent = c.def.Q.name;
      $('ab-E').querySelector('.ab-name').textContent = c.def.E.name;
    }
    /* Shop affordability. */
    shopCards.forEach((card, i) => {
      card.classList.toggle('poor', Game.gold < Data.TOWERS[i].cost);
    });
  };

  /* ------------------------ END SCREEN ------------------------- */
  U.endScreen = function (won) {
    const s = Game.stats;
    const box = $('end');
    box.classList.remove('hidden');
    const reactionCount = Object.keys(s.reactions).length;
    const totalReactions = Object.values(s.reactions).reduce((a, b) => a + b, 0);
    box.innerHTML = `
      <div class="end-kicker">${won ? 'LINE HELD' : 'THE LINE FALLS'}</div>
      <h1 class="${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</h1>
      <div class="end-sub">${won ? 'The Vigil broke against your line.' : 'The Vigil walks past your guns.'}</div>
      <div class="stats-grid">
        <div class="stat"><span>WAVES CLEARED</span><b>${s.wavesCleared}/20</b></div>
        <div class="stat"><span>KILLS</span><b>${s.kills}</b></div>
        <div class="stat"><span>LEAKS</span><b>${s.leaks}</b></div>
        <div class="stat"><span>GOLD EARNED</span><b>${s.goldEarned}</b></div>
        <div class="stat"><span>REACTIONS TRIGGERED</span><b>${totalReactions} (${reactionCount} kinds)</b></div>
        <div class="stat"><span>TOWERS BUILT</span><b>${s.towersBuilt}</b></div>
        <div class="stat"><span>BATTLE TIME</span><b>${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}</b></div>
        <div class="stat"><span>DIFFICULTY</span><b>${Game.difficulty.name}</b></div>
      </div>
      <div class="end-actions">
        <button class="btn-primary" id="btn-rematch">DEPLOY AGAIN</button>
        <button class="btn-ghost" id="btn-menu">MAIN MENU</button>
      </div>`;
    $('btn-rematch').onclick = () => {
      box.classList.add('hidden');
      const diff = Data.DIFFICULTIES.find((d) => d.id === selectedDifficulty);
      Game.startMatch({ commander: selectedCommander, difficulty: diff, seed: Game.seed + 1 });
    };
    $('btn-menu').onclick = backToMenu;
    Audio.setIntensity(0);
  };

  window.Ui = U;
})();
