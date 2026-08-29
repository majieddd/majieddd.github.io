/* RELIQUARY :: 14-ui
   The DOM layer: start screen, HUD, inspector, banners, floating combat text.

   WHY DOM AND NOT CANVAS. Text rendered into the WebGL canvas would have to
   reimplement font shaping, wrapping, focus, tab order and screen-reader
   access, all of which the browser already does correctly. The canvas gets the
   world; the DOM gets everything the player reads.

   THE COST THAT MATTERS is layout thrash. Reading a computed style or an
   offset forces a synchronous layout, and doing that per element per frame is
   how a HUD ends up costing more than the renderer under it. So:
     - refresh() rebuilds structure only when structure CHANGES
     - tickOverlay() runs every frame but only ever WRITES transforms and
       opacity, never reads geometry back
     - floating text divs are POOLED, because a busy wave creates and destroys
       dozens a second and the churn is visible in the profiler */
'use strict';

var UI = (function () {

  var el = {};
  var floatPool = [];
  var floatUsed = [];
  var barPool = [];
  var lastDockSig = '';
  var lastInspectSig = '';
  var bannerTimer = 0;
  var toastTimer = 0;
  var lastGold = -1;
  var perfOn = false;

  var pending = {
    faction: 'human',
    enemyFaction: 'xeno',
    commander: 'vanta',
    board: 0,
    difficulty: 1
  };

  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function init() {
    el.hud = $('hud');
    el.topbar = $('topbar');
    el.wave = $('v-wave');
    el.gold = $('v-gold');
    el.lives = $('v-lives');
    el.wavefill = $('wavefill');
    el.dock = $('dock');
    el.inspector = $('inspector');
    el.abilities = $('abilities');
    el.banner = $('banner');
    el.floats = $('floats');
    el.toast = $('toast');
    el.perf = $('perf');
    el.startScreen = $('start-screen');
    el.endScreen = $('end-screen');
    el.pauseScreen = $('pause-screen');
    el.speedBtn = $('btn-speed');
    el.pauseBtn = $('btn-pause');
    el.nextBtn = $('btn-next');

    buildStartScreen();
    bindChrome();
    applyPalette(pending.faction);
    return true;
  }

  /* ---------- palette ----------
     One accent, driven from the chosen faction, so the whole interface is the
     same colour as the world it sits on top of (gate G3). */
  function applyPalette(factionId) {
    var pal = PAINT.FACTIONS[factionId] || PAINT.FACTIONS.human;
    var rgb = U.hex2rgb(pal.accent);
    var r = Math.round(rgb[0] * 255), g = Math.round(rgb[1] * 255), b = Math.round(rgb[2] * 255);
    var s = document.documentElement.style;
    s.setProperty('--accent', pal.accent);
    s.setProperty('--accent-2', pal.accent2);
    s.setProperty('--accent-dim', 'rgba(' + r + ',' + g + ',' + b + ',0.18)');
    s.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.42)');
  }

  /* ---------- start screen ---------- */

  function buildStartScreen() {
    var sheet = $('start-sheet');
    if (!sheet) return;
    sheet.innerHTML = '';

    var head = mk('div');
    head.appendChild(mk('h1', 'title',
      'COSMIC CONQUEST<br><span class="thin">RELIQUARY</span>'));
    head.appendChild(mk('p', 'tagline',
      'A low-poly tower defence painted in the Neon Reliquary language. ' +
      'Hold the lane, build the lattice, and read the reactions before wave twenty arrives.'));
    sheet.appendChild(head);

    /* FACTION: sets the palette of the whole board and interface. */
    sheet.appendChild(mk('div', 'grouplabel', 'YOUR BANNER'));
    var fw = mk('div', 'opts');
    ['human', 'light', 'xeno', 'pirate', 'robotic'].forEach(function (fid) {
      var p = PAINT.FACTIONS[fid];
      var b = mk('button', 'opt' + (fid === pending.faction ? ' sel' : ''));
      b.type = 'button';
      b.innerHTML = '<div class="on"><span class="swatch" style="background:' + p.accent + '"></span>' +
        p.name + '</div><div class="od">' + p.motto + '</div>';
      b.onclick = function () {
        pending.faction = fid;
        applyPalette(fid);
        /* Fighting your own banner would break the style law that rival
           colours never share a frame, and is also nonsense. */
        if (pending.enemyFaction === fid) {
          pending.enemyFaction = fid === 'xeno' ? 'pirate' : 'xeno';
        }
        buildStartScreen();
        AUDIO.play('click');
      };
      fw.appendChild(b);
    });
    sheet.appendChild(fw);

    sheet.appendChild(mk('div', 'grouplabel', 'WHAT IS COMING'));
    var ew = mk('div', 'opts');
    ['xeno', 'pirate', 'robotic', 'human', 'light'].forEach(function (fid) {
      if (fid === pending.faction) return;
      var p = PAINT.FACTIONS[fid];
      var b = mk('button', 'opt' + (fid === pending.enemyFaction ? ' sel' : ''));
      b.type = 'button';
      var names = DATA.FACTION_NAMES[fid];
      b.innerHTML = '<div class="on"><span class="swatch" style="background:' + p.accent + '"></span>' +
        p.name + '</div><div class="od">Fields ' + names.chitling.toLowerCase() +
        ', ' + names.hivelord.toLowerCase() + ' and ' + names.harbinger.toLowerCase() + '.</div>';
      b.onclick = function () { pending.enemyFaction = fid; buildStartScreen(); AUDIO.play('click'); };
      ew.appendChild(b);
    });
    sheet.appendChild(ew);

    sheet.appendChild(mk('div', 'grouplabel', 'COMMANDER'));
    var cw = mk('div', 'opts');
    DATA.COMMANDER_ORDER.forEach(function (cid) {
      var c = DATA.COMMANDERS[cid];
      var p = PAINT.FACTIONS[c.faction];
      var b = mk('button', 'opt' + (cid === pending.commander ? ' sel' : ''));
      b.type = 'button';
      /* Mechanics first, flavour second (gate G12). */
      b.innerHTML = '<div class="on"><span class="swatch" style="background:' + p.accent + '"></span>' +
        c.name + '</div><div class="od"><strong>' + c.trait + '</strong>: ' + c.traitBlurb +
        '<br>Q ' + c.q.name + ' &middot; E ' + c.e.name + '</div>';
      b.onclick = function () { pending.commander = cid; buildStartScreen(); AUDIO.play('click'); };
      cw.appendChild(b);
    });
    sheet.appendChild(cw);

    sheet.appendChild(mk('div', 'grouplabel', 'BOARD'));
    var bw = mk('div', 'opts');
    DATA.BOARDS.forEach(function (bd, i) {
      var b = mk('button', 'opt' + (i === pending.board ? ' sel' : ''));
      b.type = 'button';
      b.innerHTML = '<div class="on">' + bd.name + '</div><div class="od">' + bd.blurb +
        '<br><span class="faint">' + bd.sub + '</span></div>';
      b.onclick = function () { pending.board = i; buildStartScreen(); AUDIO.play('click'); };
      bw.appendChild(b);
    });
    sheet.appendChild(bw);

    sheet.appendChild(mk('div', 'grouplabel', 'DIFFICULTY'));
    var dw = mk('div', 'opts');
    DATA.DIFFICULTIES.forEach(function (df, i) {
      var b = mk('button', 'opt' + (i === pending.difficulty ? ' sel' : ''));
      b.type = 'button';
      b.innerHTML = '<div class="on">' + df.name + '</div><div class="od">' +
        df.lives + ' lives, enemy health x' + df.hp.toFixed(2) +
        '<br><span class="faint">' + df.blurb + '</span></div>';
      b.onclick = function () { pending.difficulty = i; buildStartScreen(); AUDIO.play('click'); };
      dw.appendChild(b);
    });
    sheet.appendChild(dw);

    var row = mk('div', 'startrow');
    var go = mk('button', 'btn btn-primary', 'DEPLOY');
    go.type = 'button';
    go.onclick = function () { AUDIO.resume(); AUDIO.play('click'); beginRun(); };
    row.appendChild(go);
    var help = mk('button', 'btn', 'CODEX');
    help.type = 'button';
    help.onclick = function () { AUDIO.play('click'); showHelp(); };
    row.appendChild(help);
    row.appendChild(mk('div', 'spacer'));
    row.appendChild(mk('div', 'faint',
      'Drag to orbit, wheel to zoom. 1 to 9 picks a tower, U upgrades, S sells.'));
    sheet.appendChild(row);
  }

  function beginRun() {
    var opts = {
      faction: pending.faction,
      enemyFaction: pending.enemyFaction,
      commander: pending.commander,
      boardDef: DATA.BOARDS[pending.board],
      difficulty: DATA.DIFFICULTIES[pending.difficulty]
    };
    el.startScreen.classList.remove('show');
    el.endScreen.classList.remove('show');
    GAME.start(opts);
    lastDockSig = ''; lastInspectSig = '';
    buildAbilities();
    refresh();
    showBanner('WAVE 1', 'HOLD THE LANE', 2.2);
  }

  /* ---------- chrome ---------- */

  function bindChrome() {
    if (el.speedBtn) el.speedBtn.onclick = function () { AUDIO.play('click'); GAME.toggleSpeed(); };
    if (el.pauseBtn) el.pauseBtn.onclick = function () { AUDIO.play('click'); GAME.togglePause(); };
    if (el.nextBtn) el.nextBtn.onclick = function () {
      var G = GAME.state;
      if (G && !G.waveActive) { AUDIO.play('click'); SIM.startWave(); refresh(); }
      else AUDIO.play('denied');
    };
    var mute = $('btn-mute');
    if (mute) mute.onclick = function () {
      var on = mute.classList.toggle('on');
      AUDIO.setMuted(on);
      mute.textContent = on ? 'MUTED' : 'SOUND';
    };
    var perf = $('btn-perf');
    if (perf) perf.onclick = function () {
      perfOn = !perfOn;
      perf.classList.toggle('on', perfOn);
      el.perf.classList.toggle('hidden', !perfOn);
      AUDIO.play('click');
    };
    var resume = $('btn-resume');
    if (resume) resume.onclick = function () { AUDIO.play('click'); GAME.togglePause(); };
    var quit = $('btn-quit');
    if (quit) quit.onclick = function () {
      AUDIO.play('click');
      GAME.paused = false;
      el.pauseScreen.classList.remove('show');
      el.startScreen.classList.add('show');
      GAME.stop();
    };
    var again = $('btn-again');
    if (again) again.onclick = function () { AUDIO.play('click'); beginRun(); };
    var back = $('btn-back');
    if (back) back.onclick = function () {
      AUDIO.play('click');
      el.endScreen.classList.remove('show');
      el.startScreen.classList.add('show');
      buildStartScreen();
    };
    var closeHelp = $('btn-closehelp');
    if (closeHelp) closeHelp.onclick = function () {
      AUDIO.play('click');
      $('help-screen').classList.remove('show');
    };
    window.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      GAME.keydown(e);
    });
  }

  /* ---------- abilities ---------- */

  function buildAbilities() {
    var G = GAME.state;
    if (!G || !el.abilities) return;
    el.abilities.innerHTML = '';
    ['q', 'e'].forEach(function (slot) {
      var a = slot === 'q' ? G.commander.q : G.commander.e;
      var n = mk('button', 'ability glass');
      n.type = 'button';
      n.id = 'ab-' + slot;
      n.title = a.name + ': ' + a.blurb;
      n.innerHTML = '<span class="sweep"></span>' +
        '<span class="key">' + slot.toUpperCase() + '</span>' +
        '<span><span class="nm">' + a.name + '</span><br><span class="cd">READY</span></span>';
      n.onclick = function () { SIM.useAbility(slot); refresh(); };
      el.abilities.appendChild(n);
    });
  }

  /* ---------- dock ---------- */

  function refresh() {
    var G = GAME.state;
    if (!G) return;

    /* Structure is rebuilt only when the SIGNATURE changes. Rebuilding the
       dock every frame would destroy and recreate fourteen buttons sixty times
       a second, which loses hover state and costs more than the renderer.

       THE SIGNATURE USES AFFORDABILITY, NOT RAW GOLD. Keying it on G.gold
       meant the dock rebuilt on every single coin earned, which during a wave
       is several times a second: the guard was present and doing nothing. What
       the dock actually renders from gold is one bit per card (can I afford
       this), so that is what the signature carries. */
    var afford = '';
    for (var ai = 0; ai < DATA.TOWER_ORDER.length; ai++) {
      afford += (G.gold >= DATA.TOWERS[DATA.TOWER_ORDER[ai]].cost) ? '1' : '0';
    }
    var sig = G.selected + '|' + afford + '|' + G.towers.length;
    if (sig !== lastDockSig) { buildDock(); lastDockSig = sig; }

    var isig = G.inspecting ? (G.inspecting.uid + ':' + G.inspecting.tier + ':' + G.gold) : 'none';
    if (isig !== lastInspectSig) { buildInspector(); lastInspectSig = isig; }

    if (el.wave) el.wave.textContent = Math.max(1, G.wave) + '/' + DATA.WAVES.length;
    if (el.gold) {
      el.gold.textContent = U.fmt(G.gold);
      if (lastGold >= 0 && G.gold !== lastGold) {
        el.gold.classList.remove('bump');
        /* Force a reflow so the animation restarts. This is the one place a
           forced layout is correct: it is once per gold change, not per
           frame. */
        void el.gold.offsetWidth;
        el.gold.classList.add('bump');
      }
      lastGold = G.gold;
    }
    if (el.lives) {
      el.lives.textContent = G.lives;
      el.lives.classList.toggle('low', G.lives <= Math.max(3, G.maxLives * 0.3));
    }
    if (el.speedBtn) el.speedBtn.textContent = GAME.speed + 'x';
    if (el.pauseBtn) el.pauseBtn.textContent = GAME.paused ? 'PLAY' : 'PAUSE';
    if (el.nextBtn) el.nextBtn.disabled = G.waveActive;
  }

  function buildDock() {
    var G = GAME.state;
    if (!el.dock || !G) return;
    el.dock.innerHTML = '';
    DATA.TOWER_ORDER.forEach(function (id, i) {
      var d = DATA.TOWERS[id];
      var poor = G.gold < d.cost;
      var b = mk('button', 'card' + (G.selected === id ? ' sel' : '') + (poor ? ' poor' : ''));
      b.type = 'button';
      b.title = d.name + ': ' + d.blurb;
      b.innerHTML =
        (i < 9 ? '<span class="hk">' + (i + 1) + '</span>' : '') +
        '<div class="el" style="background:' + DATA.ELEMENTS[d.element].color + '"></div>' +
        '<div class="nm">' + d.name + '</div>' +
        '<div class="rl">' + d.role + '</div>' +
        '<div class="cost mono">' + d.cost + '</div>';
      b.onmouseenter = function () { AUDIO.play('hover'); };
      b.onclick = function () {
        G.selected = (G.selected === id) ? null : id;
        G.inspecting = null;
        AUDIO.play('click');
        lastDockSig = '';
        refresh();
      };
      el.dock.appendChild(b);
    });
  }

  function buildInspector() {
    var G = GAME.state;
    if (!el.inspector || !G) return;
    var t = G.inspecting;
    if (!t) { el.inspector.classList.remove('show'); return; }

    var d = DATA.TOWERS[t.id];
    var s = SIM.stats(t);
    var next = t.tier < 2 ? d.upgrades[t.tier] : null;
    var upCost = SIM.upgradeCost(t);
    var canUp = next && G.gold >= upCost;

    var h = '';
    h += '<h3>' + d.name + '</h3>';
    h += '<div class="sub">' + DATA.ELEMENTS[d.element].name + ' &middot; TIER ' + (t.tier + 1) + '</div>';
    h += '<div class="tiers">';
    for (var i = 0; i < 3; i++) h += '<span class="tierpip' + (i <= t.tier ? ' on' : '') + '"></span>';
    h += '</div>';
    h += '<div class="rows">';
    if (d.kind !== 'support') {
      h += row('Damage', Math.round(s.dps) + '/s');
      h += row('Range', s.range.toFixed(1));
    }
    if (d.kind === 'support') h += row('Income', '+' + Math.round(s.income) + '/wave');
    if (s.splash > 0) h += row('Splash', s.splash.toFixed(1));
    if (s.chains > 0) h += row('Chains', String(s.chains));
    if (s.execute > 0) h += row('Execute', Math.round(s.execute * 100) + '%');
    if (!d.air) h += row('Targets', 'Ground only');
    if (d.airBonus > 1) h += row('Vs air', 'x' + d.airBonus.toFixed(1));
    h += row('Kills', String(t.kills));
    h += row('Damage done', U.fmt(t.damage));
    h += '</div>';
    h += '<div class="flavor">' + d.flavor + '</div>';
    if (next) {
      h += '<div class="rows" style="margin-top:12px"><div class="row"><span class="k">Next tier</span>' +
        '<span class="v up">' + upCost + 'g</span></div></div>';
      h += '<div class="faint" style="font-size:11.5px">' + next.note + '</div>';
    }
    h += '<div class="acts">';
    h += '<button type="button" class="btn' + (canUp ? ' btn-primary' : '') + '" id="ins-up"' +
      (canUp ? '' : ' disabled') + '>' + (next ? 'UPGRADE' : 'MAX') + '</button>';
    h += '<button type="button" class="btn" id="ins-sell">SELL ' + SIM.sellValue(t) + '</button>';
    h += '</div>';

    el.inspector.innerHTML = h;
    el.inspector.classList.add('show');

    var up = $('ins-up');
    if (up) up.onclick = function () {
      if (SIM.upgrade(t)) {
        AUDIO.play('upgrade', { pan: SIM.panOf(t.pos) });
        FX.burst([t.pos[0], t.pos[1] + 2, t.pos[2]], R.palette().rim,
          { count: 24, speed: 9, life: 0.7, size: 0.42 });
        FX.shockRing([t.pos[0], t.pos[1] + 0.3, t.pos[2]], R.palette().rim, 5, 0.4);
        FX.hit(0.3);
      } else AUDIO.play('denied');
      lastInspectSig = ''; lastDockSig = '';
      refresh();
    };
    var sell = $('ins-sell');
    if (sell) sell.onclick = function () {
      AUDIO.play('sell', { pan: SIM.panOf(t.pos) });
      FX.burst([t.pos[0], t.pos[1] + 1, t.pos[2]], [0.9, 0.75, 0.3],
        { count: 16, speed: 7, life: 0.6, size: 0.34 });
      SIM.sell(t);
      lastInspectSig = ''; lastDockSig = '';
      refresh();
    };
  }

  function row(k, v) {
    return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  /* ---------- banner and toast ---------- */

  function showBanner(big, small, seconds) {
    if (!el.banner) return;
    el.banner.innerHTML = '<div class="big">' + big + '</div>' +
      (small ? '<div class="small">' + small + '</div>' : '');
    el.banner.classList.add('show');
    bannerTimer = seconds || 2.0;
  }

  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    toastTimer = 2.2;
  }

  /* ---------- per-frame overlay ----------
     WRITES ONLY. Nothing in this function reads layout back from the DOM,
     which is what keeps a HUD with fifty live elements off the critical path.
     Floating text divs come from a pool and are parked off-screen rather than
     removed, because removing and re-adding nodes is what makes the browser
     recalculate style for the whole container. */
  function tickOverlay(dt) {
    var G = GAME.state;
    if (!G) return;

    /* THE HUD MUST TRACK THE SIMULATION, NOT THE INPUT.
       refresh() used to be called only from click and key handlers, so gold,
       lives and the wave counter went stale the moment the player stopped
       touching anything: a screenshot at wave nine showed the banner reading
       WAVE 9 over a top bar still reading WAVE 1. Gold changes on every kill
       and lives change on every leak, neither of which is an input event.
       Calling it per frame is correct and cheap, because both structural
       rebuilds inside it are behind signature guards. */
    refresh();

    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('show');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }

    /* wave progress */
    if (el.wavefill) {
      var frac = 0;
      if (G.waveActive) {
        var total = 0, alive = 0;
        for (var i = 0; i < G.denizens.length; i++) if (G.denizens[i].alive) alive++;
        total = alive + G.spawnQueue.length;
        var w = DATA.WAVES[G.wave - 1];
        var started = 0;
        if (w) for (var q = 0; q < w.groups.length; q++) started += w.groups[q].count;
        frac = started > 0 ? 1 - (total / started) : 0;
      } else {
        frac = U.sat(G.waveTimer / G.betweenWaves);
      }
      el.wavefill.style.width = (U.sat(frac) * 100).toFixed(1) + '%';
    }

    /* ability cooldown sweeps */
    ['q', 'e'].forEach(function (slot) {
      var n = $('ab-' + slot);
      if (!n) return;
      var a = slot === 'q' ? G.commander.q : G.commander.e;
      var st = G.abilities[slot];
      var sweep = n.querySelector('.sweep');
      var cdText = n.querySelector('.cd');
      var frac = st.cd > 0 ? st.cd / a.cd : 0;
      if (sweep) sweep.style.transform = 'scaleY(' + frac.toFixed(3) + ')';
      if (cdText) cdText.textContent = st.cd > 0 ? Math.ceil(st.cd) + 's' :
        (st.active > 0 ? 'ACTIVE' : 'READY');
      n.classList.toggle('ready', st.cd <= 0);
    });

    /* floating combat text */
    var texts = FX.texts;
    var used = 0;
    for (var t = 0; t < texts.length; t++) {
      var f = texts[t];
      var p = R.project([f.x, f.y, f.z]);
      if (!p) continue;
      var node = floatPool[used];
      if (!node) {
        node = mk('div', 'float');
        el.floats.appendChild(node);
        floatPool[used] = node;
      }
      used++;
      var life = f.life / f.max;
      var cls = 'float' + (f.cls ? ' ' + f.cls : '');
      if (node.__cls !== cls) { node.className = cls; node.__cls = cls; }
      if (node.__str !== f.str) { node.textContent = f.str; node.__str = f.str; }
      if (node.__col !== f.color) { node.style.color = f.color; node.__col = f.color; }
      node.style.transform = 'translate(-50%,-50%) translate(' +
        p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) scale(' +
        (f.size * (0.8 + life * 0.35)).toFixed(3) + ')';
      node.style.opacity = life > 0.7 ? '1' : (life / 0.7).toFixed(2);
      node.style.display = '';
    }
    for (var k = used; k < floatPool.length; k++) {
      if (floatPool[k].style.display !== 'none') floatPool[k].style.display = 'none';
    }

    /* HEALTH BARS, only on bodies that have actually been hurt.
       Showing one over every unit turns a wave into a bar chart and hides the
       art; showing none means the player cannot tell a body about to die from
       one at full health, which is the single most important read in the game
       during a boss. Pooled and parked rather than created and destroyed, for
       the same reason the floating text is. */
    var bars = 0;
    for (var bi = 0; bi < G.denizens.length; bi++) {
      var dn = G.denizens[bi];
      if (!dn.alive || dn.hp >= dn.maxHp - 0.5) continue;
      var bp = R.project([dn.pos[0], dn.pos[1] + 2.35 * dn.scale, dn.pos[2]]);
      if (!bp) continue;
      var bar = barPool[bars];
      if (!bar) {
        bar = mk('div', 'hpbar');
        bar.appendChild(mk('i'));
        el.floats.appendChild(bar);
        barPool[bars] = bar;
      }
      bars++;
      var frac = U.sat(dn.hp / dn.maxHp);
      var w = dn.def.boss ? 86 : (dn.scale > 1.4 ? 46 : 30);
      bar.style.transform = 'translate(-50%,-50%) translate(' +
        bp.x.toFixed(1) + 'px,' + bp.y.toFixed(1) + 'px)';
      bar.style.width = w + 'px';
      bar.firstChild.style.transform = 'scaleX(' + frac.toFixed(3) + ')';
      bar.className = 'hpbar' + (dn.def.boss ? ' boss' : '') + (frac < 0.3 ? ' crit' : '');
      bar.style.display = '';
    }
    for (var bk = bars; bk < barPool.length; bk++) {
      if (barPool[bk].style.display !== 'none') barPool[bk].style.display = 'none';
    }

    if (perfOn && el.perf) {
      el.perf.textContent =
        Math.round(GAME.stats.fps) + ' fps  ' +
        GAME.stats.frameMs.toFixed(1) + ' ms  ' +
        FX.count + ' particles  ' +
        G.denizens.length + ' units  ' +
        G.towers.length + ' towers';
    }

    /* wave transitions produce their own banners */
    if (G.__lastWave !== G.wave && G.waveActive) {
      G.__lastWave = G.wave;
      var w = DATA.WAVES[G.wave - 1];
      showBanner('WAVE ' + G.wave, w && w.banner ? w.banner : '', w && w.boss ? 3.0 : 1.8);
      lastDockSig = '';
    }
    if (G.status === 'won' || G.status === 'lost') {
      if (!G.__ended) { G.__ended = true; showEnd(G.status === 'won'); }
    }
    if (GAME.paused && !el.pauseScreen.classList.contains('show')) {
      el.pauseScreen.classList.add('show');
    } else if (!GAME.paused && el.pauseScreen.classList.contains('show')) {
      el.pauseScreen.classList.remove('show');
    }
  }

  function showEnd(won) {
    var G = GAME.state;
    var sheet = $('end-sheet');
    if (!sheet) return;
    var reactions = 0;
    for (var k in G.reactionCounts) reactions += G.reactionCounts[k];
    var best = null, bestN = 0;
    for (var r in G.reactionCounts) if (G.reactionCounts[r] > bestN) { bestN = G.reactionCounts[r]; best = r; }
    var bestName = '-';
    for (var i = 0; i < DATA.REACTIONS.length; i++) {
      if (DATA.REACTIONS[i].id === best) bestName = DATA.REACTIONS[i].name;
    }

    var h = '';
    h += '<h1 class="title">' + (won ? 'THE LANE HELD' : 'THE LANE BROKE') + '</h1>';
    h += '<p class="tagline">' + (won
      ? 'Twenty waves answered. The reliquary stands, and whatever was walking toward it has stopped.'
      : 'Wave ' + G.wave + ' reached the plate. Rebuild, re-read the reactions, and take the lane back.') + '</p>';
    h += '<div class="endstats">';
    h += endStat('WAVE', G.wave + '/' + DATA.WAVES.length);
    h += endStat('KILLS', U.fmt(G.kills));
    h += endStat('DAMAGE', U.fmt(G.damageDealt));
    h += endStat('GOLD EARNED', U.fmt(G.goldEarned));
    h += endStat('LIVES LEFT', String(G.lives));
    h += endStat('REACTIONS', U.fmt(reactions));
    h += '</div>';
    h += '<div class="faint" style="margin-top:12px;font-size:12px">Most used reaction: <strong>' +
      bestName + '</strong>' + (bestN ? ' (' + bestN + ')' : '') + '</div>';
    h += '<div class="startrow">' +
      '<button type="button" class="btn btn-primary" id="btn-again">RUN IT AGAIN</button>' +
      '<button type="button" class="btn" id="btn-back">CHANGE LOADOUT</button></div>';
    sheet.innerHTML = h;
    el.endScreen.classList.add('show');
    bindChrome();
  }

  function endStat(k, v) {
    return '<div class="endstat"><div class="k">' + k + '</div><div class="v mono">' + v + '</div></div>';
  }

  /* ---------- codex ---------- */

  function showHelp() {
    var sheet = $('help-sheet');
    if (!sheet) return;
    var h = '';
    h += '<h1 class="title" style="font-size:26px">CODEX</h1>';
    h += '<div class="cols">';

    h += '<div><div class="grouplabel">CONTROLS</div><div class="keylist">';
    [['1 to 9', 'Select a tower'], ['Click', 'Place, or inspect a built tower'],
     ['U', 'Upgrade the inspected tower'], ['S', 'Sell it'],
     ['Q / E', 'Commander abilities'], ['Enter', 'Call the next wave early'],
     ['Space', 'Cycle speed 1x 2x 4x'], ['P', 'Pause'],
     ['Drag', 'Orbit the camera'], ['Wheel', 'Zoom']].forEach(function (r) {
      h += '<div class="keyrow"><kbd>' + r[0] + '</kbd><span class="dim">' + r[1] + '</span></div>';
    });
    h += '</div></div>';

    h += '<div><div class="grouplabel">HOW REACTIONS WORK</div>' +
      '<p class="dim" style="font-size:12.5px;margin:0">A hit leaves an elemental MARK. ' +
      'Hitting a marked body with a DIFFERENT element consumes the mark and triggers a reaction. ' +
      'One mark at a time, so the next reaction is always predictable.</p>' +
      '<div class="reactgrid">';
    DATA.REACTIONS.forEach(function (r) {
      h += '<div class="reactrow"><div class="nm" style="color:' + r.color + '">' + r.name + '</div>' +
        '<div class="pair">' + DATA.ELEMENTS[r.a].name + ' + ' + DATA.ELEMENTS[r.b].name +
        ' &middot; x' + r.mult.toFixed(2) + '</div>' +
        '<div class="dim" style="margin-top:3px">' + r.blurb + '</div></div>';
    });
    h += '</div></div>';
    h += '</div>';
    h += '<div class="startrow"><button type="button" class="btn btn-primary" id="btn-closehelp">CLOSE</button></div>';
    sheet.innerHTML = h;
    $('help-screen').classList.add('show');
    bindChrome();
  }

  return {
    init: init,
    refresh: refresh,
    tickOverlay: tickOverlay,
    showBanner: showBanner,
    toast: toast,
    applyPalette: applyPalette,
    buildAbilities: buildAbilities,
    beginRun: beginRun,
    showHelp: showHelp,
    pending: pending
  };
})();
