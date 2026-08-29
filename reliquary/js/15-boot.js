/* RELIQUARY :: 15-boot
   Bring-up, the failure screen, and the automation surface.

   THE BOOT ORDER MATTERS AND IS ASSERTED. Every module here is a plain script
   with no module system, so a missing or reordered <script> tag produces a
   ReferenceError deep inside a frame rather than at load. Checking the globals
   up front turns that into one legible message.

   THE FAILURE SCREEN IS NOT DECORATION. A WebGL2 context can fail to create on
   older hardware, in a locked-down enterprise browser, or when the GPU process
   has crashed. Without this the page is a black rectangle with an error only
   in the console, which reads as a broken link rather than as an unsupported
   browser. */
'use strict';

(function () {

  var REQUIRED = ['U', 'GL', 'MESH', 'SH', 'PAINT', 'R', 'TERRAIN', 'RIG',
                  'DATA', 'MODELS', 'AUDIO', 'FX', 'SIM', 'GAME', 'UI'];

  function fatal(title, detail) {
    var wrap = document.createElement('div');
    wrap.setAttribute('style',
      'position:fixed;inset:0;z-index:999;display:flex;align-items:center;' +
      'justify-content:center;padding:32px;background:#0a0e17;color:#e8ecf8;' +
      'font-family:Inter,system-ui,sans-serif');
    var box = document.createElement('div');
    box.setAttribute('style', 'max-width:560px');
    var h = document.createElement('h1');
    h.textContent = title;
    h.setAttribute('style', 'font-size:24px;letter-spacing:.08em;margin:0 0 12px');
    var p = document.createElement('p');
    p.textContent = detail;
    p.setAttribute('style', 'color:#a8b4d0;font-size:14px;line-height:1.55;margin:0');
    box.appendChild(h);
    box.appendChild(p);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

  function boot() {
    var missing = [];
    for (var i = 0; i < REQUIRED.length; i++) {
      if (typeof window[REQUIRED[i]] === 'undefined') missing.push(REQUIRED[i]);
    }
    if (missing.length) {
      fatal('Failed to load',
        'These modules did not load: ' + missing.join(', ') +
        '. If you are opening this from a file:// path, serve the folder over HTTP instead.');
      return;
    }

    var canvas = document.getElementById('gl');
    try {
      GAME.init(canvas);
    } catch (e) {
      fatal('WebGL2 is not available',
        'This game needs WebGL2, which this browser or this machine did not provide. ' +
        'Details: ' + (e && e.message ? e.message : String(e)));
      return;
    }

    UI.init();

    /* The AudioContext cannot start without a gesture, so the first click or
       key anywhere arms it. Registered once and then removed rather than left
       attached, because it fires on every subsequent interaction otherwise. */
    function armAudio() {
      AUDIO.init();
      AUDIO.resume();
      window.removeEventListener('pointerdown', armAudio);
      window.removeEventListener('keydown', armAudio);
    }
    window.addEventListener('pointerdown', armAudio);
    window.addEventListener('keydown', armAudio);

    /* ---------- automation surface ----------
       Everything the headless verifier needs to drive a real run without a
       mouse. This is deliberately part of the shipped file rather than a test
       build: a probe that runs against a DIFFERENT build than the one that
       ships has proved something about a program nobody plays. */
    window.__RQ = {
      version: '1.0.0',

      ready: function () {
        return !!(GAME && UI && R && R.caps());
      },
      caps: function () { return R.caps(); },

      /* Errors from every buffer in the project, in one place, so the harness
         has exactly one thing to assert is empty. The project law is that an
         error buffer without a named reader is a place errors go to be
         ignored; this is that reader. */
      errors: function () {
        return {
          gl: GL.errors(),
          render: R.errors(),
          sim: SIM.errors ? SIM.errors() : [],
          game: GAME.errors(),
          audio: AUDIO.errors()
        };
      },
      errorCount: function () {
        var e = this.errors(), n = 0;
        for (var k in e) n += e[k].length;
        return n;
      },

      start: function (opts) {
        opts = opts || {};
        UI.pending.faction = opts.faction || 'human';
        UI.pending.enemyFaction = opts.enemyFaction || 'xeno';
        UI.pending.commander = opts.commander || 'vanta';
        UI.pending.board = opts.board === undefined ? 0 : opts.board;
        UI.pending.difficulty = opts.difficulty === undefined ? 1 : opts.difficulty;
        UI.beginRun();
        return this.snapshot();
      },

      /* Advance the simulation deterministically, without waiting for real
         frames. Used by the verifier to reach wave twenty in seconds. */
      step: function (seconds, sub) {
        sub = sub || (1 / 120);
        var n = Math.max(1, Math.round(seconds / sub));
        for (var i = 0; i < n; i++) {
          SIM.step(sub);
          FX.update(sub);
          FX.updateText(sub);
        }
        return this.snapshot();
      },

      snapshot: function () {
        var G = GAME.state;
        if (!G) return { ok: false };
        var alive = 0, marked = 0;
        for (var i = 0; i < G.denizens.length; i++) {
          if (G.denizens[i].alive) alive++;
          if (G.denizens[i].mark) marked++;
        }
        var reactions = 0;
        for (var k in G.reactionCounts) reactions += G.reactionCounts[k];
        return {
          ok: true,
          status: G.status,
          wave: G.wave,
          waveActive: G.waveActive,
          gold: Math.round(G.gold),
          lives: G.lives,
          towers: G.towers.length,
          denizens: G.denizens.length,
          alive: alive,
          marked: marked,
          projectiles: G.projs.length,
          kills: G.kills,
          leaked: G.leaked,
          damage: Math.round(G.damageDealt),
          reactions: reactions,
          reactionCounts: G.reactionCounts,
          particles: FX.count,
          plots: G.board.plots.length,
          freePlots: G.board.plots.filter(function (p) { return !p.tower; }).length
        };
      },

      /* Build a tower on the Nth free plot. Returns the tower id or null. */
      build: function (towerId, plotIndex) {
        var G = GAME.state;
        if (!G) return null;
        var free = G.board.plots.filter(function (p) { return !p.tower; });
        var plot = free[plotIndex === undefined ? 0 : plotIndex % free.length];
        if (!plot) return null;
        var t = SIM.place(plot.id, towerId);
        return t ? t.uid : null;
      },

      /* Build one of every tower, spreading them along the lane. The verifier
         uses this to prove all fourteen place, target and fire. */
      buildAll: function (gold) {
        var G = GAME.state;
        if (!G) return null;
        if (gold) G.gold = gold;
        var built = [];
        var free = G.board.plots.filter(function (p) { return !p.tower; });
        /* Nearest to the lane first, so every tower actually has something in
           range rather than sitting in a corner proving nothing. */
        free.sort(function (a, b) { return a.dist - b.dist; });
        for (var i = 0; i < DATA.TOWER_ORDER.length && i < free.length; i++) {
          var t = SIM.place(free[i].id, DATA.TOWER_ORDER[i]);
          if (t) built.push(DATA.TOWER_ORDER[i]);
        }
        return built;
      },

      upgradeAll: function (gold) {
        var G = GAME.state;
        if (!G) return 0;
        if (gold) G.gold = gold;
        var n = 0;
        for (var pass = 0; pass < 2; pass++) {
          for (var i = 0; i < G.towers.length; i++) {
            if (SIM.upgrade(G.towers[i])) n++;
          }
        }
        return n;
      },

      /* Force a specific denizen onto the board, for testing behaviours the
         wave table would take minutes to reach. */
      spawn: function (typeId, count, dist) {
        var out = [];
        for (var i = 0; i < (count || 1); i++) {
          var d = SIM.spawnDenizen(typeId, { dist: (dist || 0) + i * 2 });
          if (d) out.push(d.uid);
        }
        return out;
      },

      setGold: function (v) { if (GAME.state) GAME.state.gold = v; return v; },
      setWave: function (n) { if (GAME.state) GAME.state.wave = n; return n; },
      startWave: function () { return SIM.startWave(); },
      ability: function (slot) { return SIM.useAbility(slot); },

      /* Drive a reaction directly, so the verifier can prove all ten fire
         without needing the exact tower pair on the board. */
      forceReaction: function (a, b) {
        var G = GAME.state;
        if (!G) return null;
        var d = SIM.spawnDenizen('stockman', { dist: G.board.path.length * 0.4 });
        if (!d) return null;
        d.hp = d.maxHp = 900000;
        var before = 0;
        for (var k in G.reactionCounts) before += G.reactionCounts[k];
        SIM.damage(d, 1, { element: a });
        SIM.damage(d, 1, { element: b });
        var after = 0;
        for (var k2 in G.reactionCounts) after += G.reactionCounts[k2];
        var r = DATA.reactionFor(a, b);
        d.hp = 0; SIM.kill(d, {});
        return { pair: a + '+' + b, expected: r ? r.id : null, fired: after > before };
      },

      towerReport: function () {
        var G = GAME.state;
        if (!G) return [];
        return G.towers.map(function (t) {
          return {
            id: t.id, tier: t.tier,
            kills: t.kills,
            damage: Math.round(t.damage),
            hasTarget: !!t.target
          };
        });
      },

      camera: function (o) {
        if (o.dist !== undefined) GAME.cam.targetDist = GAME.cam.dist = o.dist;
        if (o.yaw !== undefined) GAME.cam.targetYaw = GAME.cam.yaw = o.yaw;
        if (o.pitch !== undefined) GAME.cam.targetPitch = GAME.cam.pitch = o.pitch;
        if (o.focus) { GAME.cam.targetFocus = o.focus.slice(); GAME.cam.focus = o.focus.slice(); }
        return { dist: GAME.cam.dist, yaw: GAME.cam.yaw, pitch: GAME.cam.pitch };
      },

      select: function (towerId) { if (GAME.state) GAME.state.selected = towerId; },
      inspect: function (i) {
        var G = GAME.state;
        if (!G || !G.towers[i]) return null;
        G.inspecting = G.towers[i];
        UI.refresh();
        return G.towers[i].id;
      },
      screen: function (which) {
        var ids = { start: 'start-screen', end: 'end-screen', help: 'help-screen', pause: 'pause-screen' };
        var n = document.getElementById(ids[which]);
        return n ? n.classList.contains('show') : null;
      },
      closeScreens: function () {
        ['start-screen', 'end-screen', 'help-screen', 'pause-screen'].forEach(function (id) {
          var n = document.getElementById(id);
          if (n) n.classList.remove('show');
        });
      },
      audioState: function () {
        return { ready: AUDIO.isReady(), state: AUDIO.state(), sfx: AUDIO.SFX_NAMES.length };
      },
      counts: function () {
        return {
          towers: DATA.TOWER_ORDER.length,
          denizens: DATA.DENIZEN_ORDER.length,
          reactions: DATA.REACTIONS.length,
          elements: DATA.ELEMENT_ORDER.length,
          commanders: DATA.COMMANDER_ORDER.length,
          boards: DATA.BOARDS.length,
          waves: DATA.WAVES.length,
          sfx: AUDIO.SFX_NAMES.length
        };
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
