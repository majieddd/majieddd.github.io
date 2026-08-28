/* ==========================================================================
   THE PHONE BATTLE HUD.

   Owner, Session 39: "the mobile version doesn't really need too much of a
   hud, anything at the bottom it should be something that is just giving the
   information of your econ, the upcoming wave and the HP of yourself and your
   opponent, as well as the ability to rush wave and do your skill. When
   you're placing objects such as towers you should be able to just click on a
   tile and you could place a tower. Unit sending can also be on the bottom."

   WHAT WAS THERE, measured at 375x812 on the shipped build:

       #canvas-wrap   y 6    h 569     the board
       #dock          y 434  h 188     covering the bottom 141px OF the board
       #hud           y 622  h 96
       #btn-rush      y 718  h 48
       #battle-controls y 766 h 52

   Four separate bars totalling 384px of a 812px screen, one of them parked on
   top of the board, and the player still had to open a tabbed panel to do
   anything. This replaces all four with ONE bar of about 92px and a sheet
   that is only on screen while you are choosing something.

   THE RULE THAT KEPT IT HONEST: nothing here re-implements a readout. The
   shop list, the detachment row, the ability bar and the inspector are all
   rendered by js/ui.js into fixed ids, so this MOVES those elements into the
   sheet rather than drawing second copies of them. A duplicate would be a
   second thing to keep in step and this file would lose that race. The
   numbers on the bar are read from Game each sync for the same reason.

   Desktop is untouched. Everything here is gated on the same
   `(max-width: 760px)` query the rest of the phone work uses, and on a wide
   screen `Phone.on` is false and every entry point returns immediately.
   ========================================================================== */
const Phone = {
  on: false,
  _built: false,
  /* The tile a tap armed, waiting for a tower to be chosen for it. */
  pendingTile: null,
  _mq: null,

  /** True on a phone-width viewport. Read live, because the audit resizes. */
  isPhone() {
    if (!this._mq && typeof window.matchMedia === 'function')
      this._mq = window.matchMedia('(max-width: 760px)');
    return this._mq ? this._mq.matches : (window.innerWidth <= 760);
  },

  init() {
    if (this._built) return;
    this._built = true;
    this.build();
    if (this._mq && this._mq.addEventListener)
      this._mq.addEventListener('change', () => { this.apply(); this.sync(); });
    this.apply();
  },

  /** Attach or detach the phone shape. Idempotent. */
  apply() {
    this.on = this.isPhone();
    document.body.classList.toggle('phone-hud', this.on);
    if (!this.on) { this.closeSheet(); this.restoreDock(); }
  },

  /* ---------------------------------------------------------------- build */

  build() {
    const bar = document.createElement('div');
    bar.id = 'phone-bar';
    bar.innerHTML =
      '<div class="pb-stat">' +
        '<span class="pb-side mine">' +
          '<b id="pb-my-hp">20</b><i class="pb-ic">♥</i>' +
          '<b id="pb-my-gold">0</b><i class="pb-ic gold">◈</i>' +
        '</span>' +
        '<span class="pb-wave"><b id="pb-wave">WAVE 1</b><em id="pb-phase"></em></span>' +
        '<span class="pb-side rival">' +
          '<i class="pb-ic gold">◈</i><b id="pb-ai-gold">0</b>' +
          '<i class="pb-ic">♥</i><b id="pb-ai-hp">20</b>' +
        '</span>' +
      '</div>' +
      '<div class="pb-act">' +
        '<button id="pb-rush" class="pb-btn wide" type="button">' +
          '<b>RUSH</b><em id="pb-rush-sub"></em></button>' +
        '<span id="pb-abils" class="pb-abils"></span>' +
        '<button id="pb-send" class="pb-btn" type="button"><b>⚑</b><em>SEND</em></button>' +
      '</div>';
    document.body.appendChild(bar);

    /* The sheet is a HOST, not a panel: openSheet moves an element that js/ui.js
       already owns into it. `pointerdown` on the scrim rather than click, so a
       dismiss cannot be swallowed by whatever is under it. */
    const sheet = document.createElement('div');
    sheet.id = 'phone-sheet';
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="ps-scrim"></div>' +
      '<div class="ps-panel" role="dialog" aria-modal="true" aria-labelledby="ps-title">' +
        '<div class="ps-head"><h2 id="ps-title">TOWERS</h2>' +
          '<button class="ps-close" type="button" aria-label="Close">✕</button></div>' +
        '<div class="ps-body"></div>' +
      '</div>';
    document.body.appendChild(sheet);

    sheet.querySelector('.ps-scrim').addEventListener('pointerdown', () => this.closeSheet());
    sheet.querySelector('.ps-close').addEventListener('click', () => this.closeSheet());

    bar.querySelector('#pb-rush').addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.resume();
      Game.rushWave();
      this.sync();
    });
    bar.querySelector('#pb-send').addEventListener('click', () => this.openSend());

    /* TAP A TOWER CARD WHILE A TILE IS ARMED AND IT LANDS ON THAT TILE.
       Bound on the sheet, AFTER ui.js's own delegated shop handler has run, so
       `Game.selectedType` is already set by the time this reads it: the
       existing handler keeps doing exactly what it does on desktop and this
       only adds the placement. Nothing in js/ui.js had to change. */
    sheet.addEventListener('click', ev => {
      if (!this.pendingTile) return;
      if (!ev.target.closest('#shop-list')) return;
      /* A frame later: the shop handler runs on the same click and assigns
         Game.selectedType, and reading it synchronously here is a race whose
         result depends on listener order. */
      setTimeout(() => this.commitPendingBuild(), 0);
    });
  },

  /**
   * Put the tower the player just chose onto the tile they tapped.
   *
   * A NAMED METHOD rather than the body of the setTimeout that calls it, so a
   * check can drive the real placement instead of a reimplementation of it.
   * The first cut of owner-sweep's mobile M9 built with Game.build directly
   * and passed against a planted defect that had broken this path entirely,
   * because it never touched it. A test of a copy proves the copy works.
   *
   * Returns true when a tower was placed, so a caller can assert on it.
   */
  commitPendingBuild() {
    if (!this.pendingTile || !Game.selectedType) return false;
    const t = this.pendingTile;
    const built = Game.build(0, Game.selectedType, t.gx, t.gy);
    if (!built && typeof Sound !== 'undefined') Sound.play('denied');
    Game.selectedType = null;
    this.pendingTile = null;
    this.closeSheet();
    if (typeof UI !== 'undefined') UI.syncAll();
    return !!built;
  },

  /* ---------------------------------------------------------------- sheet */

  /** Move a UI-owned element into the sheet and show it. */
  openSheet(title, el, note) {
    if (!this.on || !el) return;
    const sheet = document.getElementById('phone-sheet');
    const body = sheet.querySelector('.ps-body');
    if (!this._home) this._home = new Map();
    if (!this._home.has(el)) this._home.set(el, el.parentNode);
    sheet.querySelector('#ps-title').textContent = title;
    body.innerHTML = '';
    if (note) {
      const n = document.createElement('p');
      n.className = 'ps-note';
      n.textContent = note;
      body.appendChild(n);
    }
    body.appendChild(el);
    sheet.hidden = false;
    /* Next frame, so the transition has a start state to run from. */
    requestAnimationFrame(() => sheet.classList.add('open'));
  },

  closeSheet() {
    const sheet = document.getElementById('phone-sheet');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    this.pendingTile = null;
    document.body.classList.remove('pb-placing');
    /* Held open for the exit, then emptied. The elements go back where ui.js
       expects them so a later desktop resize finds its own panels intact. */
    const done = () => { sheet.hidden = true; this.restoreDock(); };
    if (typeof sheet.addEventListener === 'function') setTimeout(done, 180);
    else done();
  },

  /** Put every borrowed element back under its original parent. */
  restoreDock() {
    if (!this._home) return;
    this._home.forEach((parent, el) => { if (parent && el.parentNode !== parent) parent.appendChild(el); });
  },

  /* ------------------------------------------------------------- openers */

  /** An empty buildable tile was tapped: choose what goes on it. */
  openBuildAt(gx, gy) {
    if (!this.on) return false;
    const list = document.getElementById('shop-list');
    if (!list) return false;
    this.pendingTile = { gx: gx, gy: gy };
    document.body.classList.add('pb-placing');
    this.openSheet('PLACE A TOWER', list, 'Tap a tower to build it on the tile you chose.');
    return true;
  },

  /** A tower was tapped: its own panel, which ui.js keeps current. */
  openInspector() {
    if (!this.on) return false;
    const insp = document.getElementById('dock-inspector');
    if (!insp) return false;
    this.openSheet('COMMAND', insp, null);
    return true;
  },

  openSend() {
    if (!this.on) return;
    const bar = document.getElementById('muster-bar');
    if (!bar) return;
    if (typeof Sound !== 'undefined') Sound.resume();
    this.openSheet('SEND A UNIT', bar, null);
  },

  /* --------------------------------------------------------------- sync */

  /** Called from UI.syncAll. Reads Game, writes the bar. Cheap and idempotent. */
  sync() {
    if (!this._built) return;
    this.apply();
    if (!this.on) return;
    const S = Game.sides && Game.sides[0], R = Game.sides && Game.sides[1];
    if (!S) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== String(v)) e.textContent = v; };

    set('pb-my-hp', Math.max(0, Math.round(S.lives)));
    set('pb-my-gold', Math.round(S.gold));
    set('pb-ai-hp', R ? Math.max(0, Math.round(R.lives)) : 0);
    set('pb-ai-gold', R ? Math.round(R.gold) : 0);
    set('pb-wave', 'WAVE ' + (Game.wave || 1));

    /* The phase line is the one place the bar says what is ABOUT to happen,
       which is the "upcoming wave" the owner asked for. */
    const phase = document.getElementById('pb-phase');
    if (phase) {
      const prep = Game.prepTimer > 0 ? Math.ceil(Game.prepTimer) : 0;
      const txt = Game.waveRunning ? 'INCOMING' : (prep > 0 ? prep + 's' : 'READY');
      if (phase.textContent !== txt) phase.textContent = txt;
    }

    const rush = document.getElementById('pb-rush');
    if (rush) {
      /* Game.canRush() is the engine's own answer, not a copy of its rule:
         it also gates on the prep timer having more than 0.4s left, which a
         reimplementation here would have got wrong the first time the rule
         moved. */
      rush.disabled = !Game.canRush();
      const sub = document.getElementById('pb-rush-sub');
      if (sub) {
        const t = Game.waveRunning ? 'IN PROGRESS' : 'START WAVE ' + ((Game.wave || 0) + 1);
        if (sub.textContent !== t) sub.textContent = t;
      }
    }

    this.syncAbilities();
  },

  /** The FIRST WORD, never a mid-word cut. A flat slice(0, 8) rendered
      STEADY AIM as "STEADY A", which reads as a typo rather than as an
      abbreviation. A single long word is still cut, with a full stop so it is
      visibly shortened rather than silently wrong. */
  shortName(name) {
    const w = String(name || '').trim().split(/\s+/)[0] || '';
    return w.length > 9 ? w.slice(0, 8) + '.' : w;
  },

  /** Two compact ability buttons, driven by the same Game state the dock bar
      uses. Rebuilt only when the commander's ability list changes, because
      this runs on every sync and innerHTML on every frame is a repaint. */
  syncAbilities() {
    const host = document.getElementById('pb-abils');
    if (!host) return;
    const S = Game.sides[0];
    const list = (S && S.abil) || [];
    const sig = list.map(a => a.def.id).join('|');
    if (sig !== this._abilSig) {
      this._abilSig = sig;
      host.innerHTML = list.slice(0, 2).map((a, i) =>
        '<button class="pb-btn abil" type="button" data-pabil="' + i + '">' +
          '<b>' + (a.def.icon || (i === 0 ? 'Q' : 'E')) + '</b>' +
          '<em>' + this.shortName(a.def.name) + '</em>' +
          '<span class="pb-cd"></span></button>').join('');
      host.querySelectorAll('[data-pabil]').forEach(b => {
        b.addEventListener('click', () => {
          if (typeof Sound !== 'undefined') Sound.resume();
          /* Game.armAbility, the same entry point the desktop ability bar
             uses, so an AIMED ability arms the cursor here too and the two
             surfaces cannot disagree about what pressing one means. */
          if (!Game.armAbility(Number(b.dataset.pabil))) Sound.play('denied');
          UI.syncAll();
        });
      });
    }
    /* Cooldown as a fill, not a number: at this size a number is unreadable
       and the shape answers the only question being asked. */
    host.querySelectorAll('[data-pabil]').forEach(b => {
      const a = list[Number(b.dataset.pabil)];
      if (!a) return;
      /* THE SAME FRACTION js/ui.js computes for the desktop bar, including
         the active phase, rather than cd over def.cd: an ability that is
         RUNNING is not on cooldown and must not read as unavailable. */
      const ready = a.cd <= 0 && a.active <= 0;
      const frac = a.active > 0 ? a.active / a.def.dur
                 : a.cd > 0 ? 1 - a.cd / (a.def.cd + a.def.dur) : 1;
      b.classList.toggle('ready', ready);
      b.classList.toggle('live', a.active > 0);
      b.classList.toggle('aiming', Game.aimingAbility === Number(b.dataset.pabil));
      const fill = b.querySelector('.pb-cd');
      if (fill) fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)).toFixed(3) + ')';
    });
  }
};
