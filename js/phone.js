/* ==========================================================================
   THE PHONE BATTLE HUD.

   Owner, Session 39, first pass: "the mobile version doesn't really need too
   much of a hud ... just giving the information of your econ, the upcoming
   wave and the HP of yourself and your opponent, as well as the ability to
   rush wave and do your skill", tap a tile to place a tower, sending on the
   bottom.

   Owner, Session 40, this pass: a RADIAL on a tower like Kingdom Rush, pause
   and speed gone, the numbers moved to the TOP, and the bottom always showing
   the base upgrade, the commander skill and the sendable units. Plus a
   standing instruction: "really trying to declutter the ui and replace with
   smart inferred actions or condensing choices".

   THE SHAPE THAT ANSWERS ALL OF IT

       top strip     your lives and gold, the wave, the rival's gold and lives
       the board     everything between, which is most of the screen
       bottom bar    BASE, your skills, your sendable units, always
       on the board  tap empty ground to place, tap a tower for its radial

   FOUR CONTROLS WERE REMOVED RATHER THAN RE-HOMED, which is the decluttering
   the owner asked for:

     RUSH        folded into the wave chip. The chip already says WAVE 3 and
                 the seconds left, and the only thing a player wants to do to
                 a countdown is skip it, so the readout IS the button.
     TARGETING   folded into the radial as one cycling control. It was a row
                 of four buttons in a panel nobody opened mid-wave.
     PAUSE       gone on a phone, per the owner.
     SPEED       gone on a phone, per the owner.

   NOTHING HERE RE-IMPLEMENTS A READOUT. #muster-bar and #btn-baselvl are
   rendered and kept current by js/ui.js, so this MOVES those elements into
   the bar rather than drawing second copies, and puts them back above the
   breakpoint. The radial reads t.nextUpgrade() and t.sellValue, the same
   sources the desktop inspector reads. A duplicate would be a second thing to
   keep in step and this file would lose that race.

   Desktop is untouched: `Phone.on` is false above 760px and every entry point
   returns immediately.
   ========================================================================== */
const Phone = {
  on: false,
  _built: false,
  /* The tile a tap armed, waiting for a tower to be chosen for it. */
  pendingTile: null,
  /* The tower whose radial is open. */
  radialTower: null,
  _mq: null,
  _home: null,

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

  apply() {
    const was = this.on;
    this.on = this.isPhone();
    document.body.classList.toggle('phone-hud', this.on);
    if (this.on && !was) this.adopt();
    if (!this.on && was) { this.closeSheet(); this.closeRadial(); this.restore(); }
  },

  /* ------------------------------------------------- borrowed UI elements */

  /** Move the UI-owned controls that live on the bar permanently. */
  adopt() {
    const slotBase = document.getElementById('pb-base-slot');
    const slotUnits = document.getElementById('pb-units-slot');
    const base = document.getElementById('btn-baselvl');
    const units = document.getElementById('muster-bar');
    if (!this._home) this._home = new Map();
    [[base, slotBase], [units, slotUnits]].forEach(pair => {
      const el = pair[0], slot = pair[1];
      if (!el || !slot) return;
      if (!this._home.has(el)) this._home.set(el, el.parentNode);
      if (el.parentNode !== slot) slot.appendChild(el);
    });
  },

  /** Put every borrowed element back under its original parent. */
  restore() {
    if (!this._home) return;
    this._home.forEach((parent, el) => { if (parent && el.parentNode !== parent) parent.appendChild(el); });
  },

  /* ---------------------------------------------------------------- build */

  build() {
    const top = document.createElement('div');
    top.id = 'phone-top';
    top.innerHTML =
      '<span class="pt-side mine">' +
        '<i class="pt-ic hp">&#9829;</i><b id="pb-my-hp">20</b>' +
        '<i class="pt-ic gold">&#9670;</i><b id="pb-my-gold">0</b>' +
      '</span>' +
      /* THE READOUT IS THE BUTTON. A countdown has exactly one thing a player
         wants to do to it, so RUSH is not a separate control any more. */
      '<button id="pb-wave" class="pt-wave" type="button">' +
        '<b id="pb-wave-n">WAVE 1</b><em id="pb-phase"></em></button>' +
      '<span class="pt-side rival">' +
        '<i class="pt-ic gold">&#9670;</i><b id="pb-ai-gold">0</b>' +
        '<i class="pt-ic hp">&#9829;</i><b id="pb-ai-hp">20</b>' +
      '</span>';
    document.body.appendChild(top);

    const bar = document.createElement('div');
    bar.id = 'phone-bar';
    bar.innerHTML =
      '<span id="pb-base-slot" class="pb-slot base"></span>' +
      '<span id="pb-abils" class="pb-abils"></span>' +
      '<span id="pb-units-slot" class="pb-slot units"></span>';
    document.body.appendChild(bar);

    const radial = document.createElement('div');
    radial.id = 'phone-radial';
    radial.hidden = true;
    radial.innerHTML = '<div class="pr-scrim"></div><div class="pr-ring"></div>';
    document.body.appendChild(radial);
    radial.querySelector('.pr-scrim').addEventListener('pointerdown', () => this.closeRadial());

    const sheet = document.createElement('div');
    sheet.id = 'phone-sheet';
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="ps-scrim"></div>' +
      '<div class="ps-panel" role="dialog" aria-modal="true" aria-labelledby="ps-title">' +
        '<div class="ps-head"><h2 id="ps-title">TOWERS</h2>' +
          '<button class="ps-close" type="button" aria-label="Close">&#10005;</button></div>' +
        '<div class="ps-body"></div>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.querySelector('.ps-scrim').addEventListener('pointerdown', () => this.closeSheet());
    sheet.querySelector('.ps-close').addEventListener('click', () => this.closeSheet());

    top.querySelector('#pb-wave').addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.resume();
      if (Game.canRush()) { Game.rushWave(); this.sync(); }
      else if (typeof Sound !== 'undefined') Sound.play('denied');
    });

    /* Tap a tower card while a tile is armed and it lands on that tile. Bound
       on the sheet so js/ui.js's own delegated shop handler runs first and has
       already set Game.selectedType by the time the deferred commit reads it. */
    sheet.addEventListener('click', ev => {
      if (!this.pendingTile || !ev.target.closest('#shop-list')) return;
      setTimeout(() => this.commitPendingBuild(), 0);
    });

    /* A camera move invalidates every radial position, and recomputing on each
       frame would tie a DOM layout to the render loop. Closing is honest and
       costs nothing: the tower is still there to tap again. */
    const cv = document.getElementById('game');
    if (cv) ['wheel', 'pointerdown'].forEach(t =>
      cv.addEventListener(t, () => { if (this.radialTower) this.closeRadial(); }, { passive: true }));
  },

  /**
   * Put the tower the player just chose onto the tile they tapped.
   *
   * A NAMED METHOD rather than the body of the setTimeout that calls it, so a
   * check can drive the real placement instead of a reimplementation of it.
   * The first cut of the mobile M9 check built with Game.build directly and
   * passed against a planted defect that had broken this path entirely.
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
    /* setTimeout, NOT requestAnimationFrame. Both exist only to give the
       transition a start frame, and rAF does not fire at all in a hidden or
       backgrounded tab: the panel would then stay at opacity 0 with the
       scrim swallowing taps, which is worse than no animation. Measured in
       a non-compositing pane, where the rAF version never opened. */
    setTimeout(() => sheet.classList.add('open'), 0);
  },

  closeSheet() {
    const sheet = document.getElementById('phone-sheet');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    this.pendingTile = null;
    document.body.classList.remove('pb-placing');
    setTimeout(() => {
      sheet.hidden = true;
      /* Only the sheet's own borrowings go home. The bar keeps its two. */
      const shop = document.getElementById('shop-list');
      if (shop && this._home && this._home.has(shop)) {
        const p = this._home.get(shop);
        if (p && shop.parentNode !== p) p.appendChild(shop);
      }
    }, 180);
  },

  /** An empty buildable tile was tapped: choose what goes on it. */
  openBuildAt(gx, gy) {
    if (!this.on) return false;
    const list = document.getElementById('shop-list');
    if (!list) return false;
    this.closeRadial();
    this.pendingTile = { gx: gx, gy: gy };
    document.body.classList.add('pb-placing');
    this.openSheet('PLACE A TOWER', list, 'Tap a tower to build it on the tile you chose.');
    return true;
  },

  /* --------------------------------------------------------------- radial */

  /**
   * The Kingdom Rush ring: the tower's whole decision, on the tower.
   *
   * Reads t.nextUpgrade(), which is the same call the desktop inspector makes,
   * so a level, a specialisation choice and an ascension all present here
   * exactly as the engine describes them. A branch offers its two options as
   * two buttons, which is the one case where the ring has four items.
   */
  openRadial(t) {
    if (!this.on || !t || t.dead || t.side !== 0) return false;
    const host = document.getElementById('phone-radial');
    const ring = host.querySelector('.pr-ring');
    this.radialTower = t;

    const items = [];
    const gold = Game.sides[0].gold;
    let next = null;
    try { next = t.nextUpgrade(); } catch (e) { next = null; }
    if (next && next.kind === 'level') {
      const c = t.upgradeCost('level', next.data.cost);
      items.push({ cls: 'up', icon: '&#9650;', label: next.data.name, cost: c,
                   can: gold >= c, act: () => Game.upgrade(t) });
    } else if (next && next.kind === 'branch') {
      next.data.forEach((b, i) => {
        const c = t.pendingBranch ? 0 : t.upgradeCost('branch', b.cost);
        items.push({ cls: 'up branch', icon: '&#10022;', label: b.name, cost: c,
                     can: gold >= c, act: () => Game.upgrade(t, i) });
      });
    } else if (next) {
      const c = t.upgradeCost('ascend', next.cost);
      items.push({ cls: 'up asc', icon: '&#9733;', label: 'ASCEND', cost: c,
                   can: gold >= c, act: () => Game.upgrade(t) });
    }

    /* TARGETING, condensed from a four-button row into one cycling control.
       A depot or a watch aims at nothing, so it is offered nothing, which is
       the same rule the desktop panel applies. */
    const aims = !(t.isSupport || t.def.attack === 'depot' || t.def.attack === 'vigil');
    if (aims && typeof TARGET_MODES !== 'undefined') {
      const i = Math.max(0, TARGET_MODES.findIndex(m => m.id === t.targetMode));
      const cur = TARGET_MODES[i] || TARGET_MODES[0];
      items.push({ cls: 'mode', icon: '&#9678;', label: cur.name, cost: null, can: true,
                   keepOpen: true,
                   act: () => { t.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length].id; } });
    }

    items.push({ cls: 'sell', icon: '&#8722;', label: 'SELL', cost: t.sellValue, can: true,
                 sellish: true, act: () => Game.sell(t) });

    ring.innerHTML = items.map((it, i) =>
      '<button class="pr-btn ' + it.cls + (it.can ? '' : ' poor') + '" type="button" data-ri="' + i + '"' +
      (it.can ? '' : ' disabled') + '>' +
        '<b>' + it.icon + '</b>' +
        '<em>' + it.label + '</em>' +
        (it.cost === null ? '' : '<span class="pr-cost">' + (it.sellish ? '+' : '') +
          '&#9670;' + Math.round(it.cost) + '</span>') +
      '</button>').join('');

    ring.querySelectorAll('[data-ri]').forEach(b => {
      b.addEventListener('click', () => {
        const it = items[Number(b.dataset.ri)];
        if (!it || !it.can) { if (typeof Sound !== 'undefined') Sound.play('denied'); return; }
        it.act();
        if (typeof UI !== 'undefined') UI.syncAll();
        if (it.keepOpen && this.radialTower && !this.radialTower.dead) this.openRadial(this.radialTower);
        else this.closeRadial();
      });
    });

    host.hidden = false;
    this.placeRadial(t, items.length);
    setTimeout(() => host.classList.add('open'), 0);   /* see openSheet */
    return true;
  },

  /**
   * Lay the buttons on a circle around the tower, then pull any that fell off
   * the screen back on.
   *
   * CLAMPED PER BUTTON rather than by shifting the whole ring: a tower in a
   * corner would otherwise drag every button away from it and the ring would
   * stop reading as belonging to that tower. The bars at the top and bottom
   * are treated as edges too, because a control underneath one cannot be
   * tapped.
   */
  placeRadial(t, n) {
    const host = document.getElementById('phone-radial');
    const ring = host.querySelector('.pr-ring');
    const at = Game.boardToClient ? Game.boardToClient(t.x, t.y) : null;
    if (!at) return;
    ring.style.left = at.x + 'px';
    ring.style.top = at.y + 'px';

    const topBar = document.getElementById('phone-top');
    const botBar = document.getElementById('phone-bar');
    const tb = topBar ? topBar.getBoundingClientRect().bottom : 0;
    const bb = botBar ? botBar.getBoundingClientRect().top : window.innerHeight;

    const R = n <= 2 ? 62 : 74;
    const btns = ring.querySelectorAll('.pr-btn');
    btns.forEach((b, i) => {
      /* Start at the top and go clockwise, so the upgrade (always first) sits
         above the tower where a thumb is not covering it. */
      const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
      let x = Math.cos(a) * R, y = Math.sin(a) * R;
      const w = 62, h = 52;
      const absX = at.x + x, absY = at.y + y;
      const minX = 6 + w / 2, maxX = window.innerWidth - 6 - w / 2;
      const minY = tb + 6 + h / 2, maxY = bb - 6 - h / 2;
      x += Math.min(0, maxX - absX) + Math.max(0, minX - absX);
      y += Math.min(0, maxY - absY) + Math.max(0, minY - absY);
      b.style.transform = 'translate(-50%, -50%) translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    });
  },

  closeRadial() {
    const host = document.getElementById('phone-radial');
    if (!host || host.hidden) return;
    host.classList.remove('open');
    this.radialTower = null;
    setTimeout(() => { host.hidden = true; }, 150);
  },

  /* --------------------------------------------------------------- sync */

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
    set('pb-wave-n', 'WAVE ' + (Game.wave || 1));

    const phase = document.getElementById('pb-phase');
    const chip = document.getElementById('pb-wave');
    if (phase && chip) {
      const can = Game.canRush();
      const prep = Game.prepTimer > 0 ? Math.ceil(Game.prepTimer) : 0;
      const txt = Game.waveRunning ? 'INCOMING' : (can ? prep + 's · SEND IT' : (prep > 0 ? prep + 's' : 'READY'));
      if (phase.textContent !== txt) phase.textContent = txt;
      chip.classList.toggle('canrush', can);
      chip.disabled = !can;
    }

    this.syncAbilities();
    /* The radial is anchored to a world position, so it follows a board that
       moved under it for any reason other than a gesture (a resize, a rush). */
    if (this.radialTower) {
      if (this.radialTower.dead) this.closeRadial();
      else this.placeRadial(this.radialTower,
        document.querySelectorAll('#phone-radial .pr-btn').length || 1);
    }
  },

  /** The FIRST WORD, never a mid-word cut. A flat slice(0, 8) rendered
      STEADY AIM as "STEADY A", which reads as a typo rather than as an
      abbreviation. */
  shortName(name) {
    const w = String(name || '').trim().split(/\s+/)[0] || '';
    return w.length > 9 ? w.slice(0, 8) + '.' : w;
  },

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
          /* Game.armAbility, the same entry point the desktop bar uses, so an
             AIMED ability arms the cursor here too. */
          if (!Game.armAbility(Number(b.dataset.pabil))) Sound.play('denied');
          if (typeof UI !== 'undefined') UI.syncAll();
        });
      });
    }
    host.querySelectorAll('[data-pabil]').forEach(b => {
      const a = list[Number(b.dataset.pabil)];
      if (!a) return;
      /* THE SAME FRACTION js/ui.js computes, including the active phase: an
         ability that is RUNNING is not on cooldown and must not read as
         unavailable. */
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
