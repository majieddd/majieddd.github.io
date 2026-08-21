/* ==========================================================================
   AEGIS PROTOCOL: ATTRITION — Interface Layer
   --------------------------------------------------------------------------
   Screens: COMMAND (commander + technology chart) → THEATRE (world map) →
   LOADOUT (five towers) → BATTLE.

   The battle sidebar is deliberately split into independent regions that
   re-render only when their own data changes. Re-rendering the whole panel on
   every tick is what made it flicker and drop hover state before.
   ========================================================================== */

'use strict';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const UI = {

  sel: { commander: COMMANDERS[0].id, map: MAPS[0].id, difficulty: 'contested', loadout: [] },
  el: {},
  _inspKey: null,          // signature of what the inspector currently shows

  init() {
    const e = this.el;
    e.screens    = $$('.screen');
    e.myLives = $('#my-lives'); e.myGold = $('#my-gold'); e.myBar = $('#my-bar'); e.myTowers = $('#my-towers');
    e.aiLives = $('#ai-lives'); e.aiGold = $('#ai-gold'); e.aiBar = $('#ai-bar'); e.aiTowers = $('#ai-towers');
    /* The panel itself, so a fallen rival can be marked. It is the only HUD
       panel with no id of its own until now; syncTriRival's third panel is
       built at runtime and has always carried one. BATCH-C/nside */
    e.aiPanel = $('#hud-rival1');
    e.wave = $('#stat-wave'); e.phase = $('#phase-label'); e.prepBar = $('#prep-bar');
    e.btnRush = $('#btn-rush'); e.btnPause = $('#btn-pause');
    e.speedBtns = $$('.speed-btn');
    e.shop = $('#shop-list'); e.inspector = $('#inspector');
    e.modStrip = $('#mod-strip'); e.escStrip = $('#esc-strip');
    e.tooltip = $('#tooltip');
    e.endOverlay = $('#overlay-end'); e.endBody = $('#end-body');
    e.choiceOv = $('#overlay-choice'); e.choiceBody = $('#choice-body');
    e.techOv = $('#overlay-tech'); e.techBody = $('#tech-body');
    e.codexBody = $('#codex-body');

    this.buildCommanderScreen();
    this.buildTheatreScreen();
    this.buildCodex();
    this.bind();
    this.loadSettings();
    this.renderTitle();
    if (this._showMenu) this._showMenu('main');
    this.show('screen-title');
  },

  /* ═══════════════════════════════════════════════ SCREEN 0 — TITLE ═══ */

  renderTitle() {
    const names = Meta.profileNames();
    const active = Meta.activeName();
    /* Tower and commander unlocks moved to the install-wide vault; the
       per-profile arrays they left behind are still seeded to the starters and
       never written again, so reading them reported "1 towers unlocked" on a
       full install. Souls stay per-profile and are still read from the row. */
    const vault = Meta.vault();
    $('#profile-list').innerHTML = names.map(n => {
      const r = Meta.root().profiles[n];
      const lv = Object.values(r.commanders || {}).reduce((s, c) => s + (c.xp || 0), 0);
      const fa = r.faction ? FACTIONS[r.faction] : null;
      return `<button class="profile-row ${n === active ? 'active' : ''}" data-profile="${n}"
              data-tt="${n}|${fa ? fa.name + '. ' : 'No allegiance chosen. '}Arsenal is shared across every profile: ${
                vault.unlocked.length} towers and ${vault.cmdUnlocked.length} commanders unlocked. ${
                r.souls || 0} souls banked.${r.campaign ? ' Campaign in progress.' : ''}">
        <span class="pr-name">${n}</span>
        <span class="pr-meta">◉ ${r.souls || 0} souls · ${r.campaign ? 'node ' + (r.campaign.depth + 1) : 'no campaign'} · ${formatNum(lv)} XP</span>
        ${names.length > 1 ? `<span class="pr-del" data-del="${n}" title="Delete">✕</span>` : ''}
      </button>`;
    }).join('');
    const mpList = $('#profile-list-mp');
    if (mpList) mpList.innerHTML = $('#profile-list').innerHTML;
    this.bindChipTips($('#profile-list'));
    this.bindChipTips(mpList);
    $$('[data-profile]').forEach(b => b.addEventListener('click', ev => {
      if (ev.target.dataset.del) return;
      Meta.setActive(b.dataset.profile); Sound.play('click');
      /* Selections belong to a profile; never leak them across a switch. */
      this.sel.loadout = []; this.sel.commander = null; this._cmdTouched = false; Meta._gx = null;
      this.renderTitle();
    }));
    const play = $('#btn-title-play');
    if (play) play.textContent = Meta.campaign() ? 'CONTINUE CAMPAIGN' : 'BEGIN CAMPAIGN';

    $$('[data-del]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      if (Meta.deleteProfile(b.dataset.del)) { Sound.play('sell'); this.renderTitle(); }
    }));
  },

  show(id) {
    this.el.screens.forEach(s => s.classList.toggle('hidden', s.id !== id));
    /* A loadout card left open when the screen goes away keeps its firing
       preview drawing behind every battle for the rest of the session. Hover
       closes it and blur closes it; a touch tap gives neither, because the
       card opens on pointerdown and DEPLOY is the next thing tapped. Closing
       on the way OFF the screen retires the whole class rather than one
       route, and costs nothing when no card is open -- closeLoadoutCard
       returns on its first line unless one is. */
    this.closeLoadoutCard();
    /* The title universe only spends frames while it is actually on screen. */
    if (typeof TitleFX !== 'undefined') TitleFX.toggle(id === 'screen-title');
    /* And the galaxy starfield only while a MAP is on screen. TitleFX has
       always idled off-screen; this loop never did, so once a map had been
       drawn its full-viewport repaint ran on behind every battle, every menu
       and every soul shop for the rest of the session. Its own mount restarts
       it, so LEAVING is the only edge that has to be said here. */
    if (typeof GalaxyFX !== 'undefined')
      GalaxyFX.toggle(id === 'screen-theatre' || id === 'screen-multiverse');
    /* endMatch parks the state at 'over' and only UI.toMenu ever moved it on,
       so the POST-BATTLE PRIMARY BUTTON -- the route players actually take --
       left the loop running its full else-branch behind the galaxy map, the
       commander screen, the soul shop and the loadout screen. Doing it here,
       on the way off the battle screen, retires the whole "this exit forgot
       to idle" class instead of one button. */
    if (id !== 'screen-game' && typeof Game !== 'undefined' && Game.state === 'over') Game.state = 'menu';
  },

  /** ONE entry point for the Soul Shop. It is an OVERLAY, not a screen, so
      nothing has to tell the player where to find it -- copy naming a location
      is exactly what went stale when the button moved off the title screen.
      `onClose` lets the caller redraw itself once the shop is dismissed. */
  openSoulShop(onClose) {
    Sound.play('click');
    this.renderSoulShop();
    $('#overlay-souls').classList.remove('hidden');
    this._soulShopClosed = onClose || null;
  },

  bind() {
    /* Main menu: SINGLEPLAYER / MULTIPLAYER / OPTIONS. */
    this._showMenu = (id) => {
      $('#menu-main').classList.toggle('hidden', id !== 'main');
      $('#menu-sp').classList.toggle('hidden', id !== 'sp');
      $('#menu-mp').classList.toggle('hidden', id !== 'mp');
    };
    $('#btn-menu-sp').addEventListener('click', () => { Sound.resume(); Sound.play('click'); this._showMenu('sp'); this.renderTitle(); });
    $('#btn-menu-mp').addEventListener('click', () => { Sound.resume(); Sound.play('click'); this._showMenu('mp'); this.renderTitle(); });
    $('#btn-menu-back-sp').addEventListener('click', () => { Sound.play('click'); this._showMenu('main'); });
    $('#btn-menu-back-mp').addEventListener('click', () => { Sound.play('click'); this._showMenu('main'); });
    $('#btn-enter-mp').addEventListener('click', () => { Sound.play('click'); this.show('screen-multiverse'); this.renderMultiverse(); });
    $('#btn-mv-back').addEventListener('click', () => { Sound.play('click'); this.show('screen-title'); this.renderTitle(); });

    $('#btn-title-play').addEventListener('click', () => {
      Sound.resume(); Sound.play('click');
      /* Allegiance is chosen ONCE per profile. A new profile picks a faction;
         everyone else goes straight to their commanders, and a fresh campaign
         simply continues under the same banner. */
      if (!Meta.faction()) { this.show('screen-faction'); this.renderFactions(); return; }
      if (!Meta.campaign()) { Meta.campaignStart(Meta.faction()); this.sel.loadout = []; }
      this.show('screen-command'); this.buildCommanderScreen();
    });
    $('#btn-soul-shop').addEventListener('click', () => this.openSoulShop());
    /* Whatever opened the shop may need to redraw once it closes: the loadout
       grid lists only towers you already own, so a purchase must show up on
       the screen the player buys it from. */
    const soulClose = $('[data-close="souls"]');
    if (soulClose) soulClose.addEventListener('click', () => {
      const cb = this._soulShopClosed; this._soulShopClosed = null; if (cb) cb();
    });
    $('#btn-new-profile').addEventListener('click', () => {
      const input = $('#profile-name');
      if (Meta.createProfile(input.value)) { input.value = ''; Sound.play('tech'); this.renderTitle(); }
      else Sound.play('denied');
    });
    $('#profile-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('#btn-new-profile').click(); }
    });
    $('#btn-back-title').addEventListener('click', () => { Sound.play('click'); this.renderTitle(); this.show('screen-title'); });

    $('#btn-to-theatre').addEventListener('click', () => { Sound.resume(); Sound.play('click');
      if (!Meta.campaign()) { this.show('screen-faction'); this.renderFactions(); }
      else { this.show('screen-theatre'); this.renderTheatre(); } });
    $('#btn-faction-back').addEventListener('click', () => { Sound.play('click'); this.show('screen-title'); this.renderTitle(); });
    $('#btn-faction-go').addEventListener('click', () => {
      const f = this.sel.faction;
      if (!f) { Sound.play('denied'); return; }
      Meta.setFaction(f);
      Meta.campaignStart(f);   /* also grants the faction's base commander */
      this._cmdTouched = false;
      this.sel.loadout = []; this.sel.commander = null;   /* a new war, a clean slate */
      Sound.play('branch');
      /* Commander choice comes AFTER allegiance, never before. */
      this.show('screen-command'); this.buildCommanderScreen();
    });
    $('#btn-back-command').addEventListener('click', () => { Sound.play('click'); this.show('screen-command'); this.renderCommanders(); });
    $('#btn-to-loadout').addEventListener('click', () => { Sound.play('click'); this.show('screen-loadout'); this.renderLoadout(); });
    $('#btn-back-theatre').addEventListener('click', () => { Sound.play('click'); this.show('screen-theatre'); });
    $('#btn-deploy').addEventListener('click', () => this.deploy());

    $('#btn-rush').addEventListener('click', () => { Sound.resume(); Game.rushWave(); });
    /* Delegated: the muster row is rebuilt whenever its numbers move, so a
       listener bound to the buttons themselves would not survive a sync. */
    $('#muster-bar').addEventListener('click', ev => {
      const b = ev.target.closest('[data-muster]');
      if (!b) return;
      Sound.resume();
      if (!Game.muster(0, b.dataset.muster)) Sound.play('denied');
    });
    $('#btn-baselvl').addEventListener('click', () => { Sound.resume(); Game.buyBaseLevel(0); });
    $('#btn-pause').addEventListener('click', () => this.togglePause());
    $('#btn-quit').addEventListener('click', () => this.confirmAbandon());
    this.el.speedBtns.forEach(b => b.addEventListener('click', () => { Game.speed = Number(b.dataset.speed); Sound.play('click'); this.syncSpeed(); }));

    $$('[data-open]').forEach(b => b.addEventListener('click', () => { $('#overlay-' + b.dataset.open).classList.remove('hidden'); Sound.play('click'); }));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => { $('#overlay-' + b.dataset.close).classList.add('hidden'); Sound.play('click'); }));

    const sfx = $('#set-sfx'), music = $('#set-music'), sfxOn = $('#set-sfx-on'), musicOn = $('#set-music-on');
    sfx.addEventListener('input',   () => { Sound.setSfxVolume(sfx.value / 100); this.saveSettings(); });
    music.addEventListener('input', () => { Sound.setMusicVolume(music.value / 100); this.saveSettings(); });
    sfxOn.addEventListener('change',   () => { Sound.toggleSfx(sfxOn.checked); this.saveSettings(); });
    musicOn.addEventListener('change', () => { Sound.toggleMusic(musicOn.checked); this.saveSettings(); });

    $('#btn-end-menu').addEventListener('click', () => { this.el.endOverlay.classList.add('hidden'); this.toMenu(); });
    $('#btn-end-retry').addEventListener('click', () => {
      this.el.endOverlay.classList.add('hidden');
      /* A skirmish has no galaxy behind it. Sending one there did not merely
         land on the wrong screen: renderTheatre OPENS a campaign for any sworn
         profile that has none, so finishing an arena run silently rolled a
         campaign seed the player never asked for -- the exact ledger the
         multiplayer route promises never to touch. Game._skirmish is still
         true while the end overlay is up. BATCH-C/nside */
      if (Game._skirmish) { this.show('screen-multiverse'); this.renderMultiverse(); return; }
      /* Win or lose, the road leads back to the galaxy. */
      this.show('screen-theatre'); this.renderTheatre();
    });
  },

  /**
   * Abandoning mid-match used to be free: it returned to the title without ever
   * calling endMatch(), so depth, boons and the chosen node all survived and the
   * campaign could be retried indefinitely. It now resolves the campaign, and
   * says so plainly before it does.
   *
   * A battlefield DEFEAT, by contrast, keeps the galaxy (Session 15). Abandon
   * is the only road that forfeits it, which is why this is the dialog that
   * warns -- and why it passes `abandon = true` into endMatch.
   */
  confirmAbandon() {
    Sound.play('click');
    const c = Meta.campaign();
    if (!c) { this.toMenu(); return; }
    if (Game._skirmish) {
      /* A garrison skirmish never touched the campaign ledger, so it must not
         threaten it either. */
      this.confirmBox('ABANDON SKIRMISH?',
        '<p>The garrison keeps the world. Nothing in your campaign changes.</p>',
        'ABANDON', () => Game.endMatch(false, true));
      return;
    }
    this.confirmBox('ABANDON CAMPAIGN?',
      '<p>Abandoning <b>forfeits the whole campaign</b>: this galaxy and every ' +
      'star on it are gone, and your next campaign rolls a fresh galaxy. Souls ' +
      'already banked stay yours.</p>' +
      '<p><b>Losing the battle does not do this</b> &mdash; a defeat keeps the ' +
      'galaxy. Cancel and fight on if that is what you want.</p>',
      'ABANDON \u2014 FORFEIT GALAXY',
      () => Game.endMatch(false, true));
  },

  toMenu() {
    Game.state = 'menu'; Sound.stopMusic();
    this.el.endOverlay.classList.add('hidden');
    this.el.choiceOv.classList.add('hidden');
    this.renderTitle();
    this.show('screen-title');
  },

  /** How many slots this profile can actually fill. */
  loadoutTarget() { return Math.min(LOADOUT_SIZE, Meta.unlockedTowers().length); },

  deploy() {
    /* You begin the game owning a single tower, so the requirement is "every
       slot you can fill", not a flat five. */
    if (this.sel.loadout.length !== this.loadoutTarget()) { Sound.play('denied'); return; }
    const c = Meta.campaign();
    const node = c && c.chosen;
    if (!node) { Sound.play('denied'); this.show('screen-theatre'); this.renderTheatre(); return; }
    Sound.resume();
    const seatWorld = Meta.galaxy() && this.worldById(Meta.galaxy(), node.world);
    Game.start({ seat: !!(seatWorld && seatWorld.seat),
                 rivalFaction: node.rivalFaction,
                 contestedBy: node.contestedBy,
                 /* Both are read by battleHostFaction: they decide whether the
                    holder has troops on the ground or only a claim on a map. */
                 contested: node.contested, worldKind: node.kind,
                 map: node.map, difficulty: node.difficulty,
                 /* If the commander screen was never visited, default to your
                    faction's own commander rather than an arbitrary one. */
                 commander: (this.sel.commander && Meta.isCommanderUnlocked(this.sel.commander))
                   ? this.sel.commander
                   : (Meta.isCommanderUnlocked(freeCommanderOf(Meta.faction() || 'human'))
                       ? freeCommanderOf(Meta.faction() || 'human') : 'cadre'),
                 loadout: this.sel.loadout.slice(),
                 arena: node.arena, boons: c.boons, rival: node.rival,
                 escStart: node.escStart });
    this.show('screen-game');
    this._inspKey = null;
    this.buildShop();
    this.buildAbilityBar();
    if (!Game._skirmish) this.showBattleIntro();
    this.syncAll();
  },

  /* ══════════════════════════════════════════════ SCREEN 1 — COMMAND ═══ */

  /**
   * Renders a tower's ACTUAL in-game sprite into a small canvas, so every
   * menu preview shows the thing you will place rather than a colour swatch.
   * A plain stub stands in for a live Tower: the draw routines only read
   * display state, so this reuses the real artwork with no duplication.
   */
  /** The lightweight stand-in every tower preview draws through. */
  towerStub(id) {
    const def = TOWER_TYPES[id];
    const stats = Object.assign({ techStatus: 1 }, def.base);
    if (def.levels && def.levels[0]) Object.assign(stats, def.levels[0].mods);
    if (def.levels && def.levels[1]) Object.assign(stats, def.levels[1].mods);
    return {
      def, type: id, side: 0, level: 3, branch: null, asc: 0,
      stats, age: 1.35, recoil: 0, angle: -0.45, firing: false,
      mines: new Array(Math.min(4, stats.maxMines || 0)).fill(0),
      drones: new Array(stats.drones || 0).fill(0),
      minionList: [], wallList: [], glaiveList: [],
      charge: (stats.chargeMax || 0) * 0.55, windT: (stats.windMax || 0) * 0.6,
      drainMeter: (stats.drainPer || 0) * 0.45,
      incomeTimer: (stats.incomeEvery || 0) * 0.6,
      alchStacks: 0, jamTimer: 0, rampMult: 2, cooldown: 0.25, effRate: 1,
      aura: { dmg: 0, rate: 0, range: 0 },
      aimed(c2, fn) { c2.save(); c2.rotate(this.angle); fn(); c2.restore(); }
    };
  },

  towerIconHTML(id, size) {
    size = size || 46;
    return '<canvas class="tower-icon" data-icon="' + id + '" width="' + size + '" height="' + size + '"></canvas>';
  },

  paintTowerIcons(root) {
    $$('[data-icon]', root || document).forEach(cv => {
      if (cv._painted) return;
      cv._painted = true;
      const id = cv.dataset.icon;
      const def = TOWER_TYPES[id];
      if (!def) return;
      const ctx = cv.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const css = cv.width;
      cv.width = css * dpr; cv.height = css * dpr;
      cv.style.width = css + 'px'; cv.style.height = css + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* A tier-3 preview: enough progression that multi-barrel and multi-node
         art reads correctly, without pretending the tower is specialised. */
      const stats = Object.assign({ techStatus: 1 }, def.base);
      if (def.levels && def.levels[0]) Object.assign(stats, def.levels[0].mods);
      if (def.levels && def.levels[1]) Object.assign(stats, def.levels[1].mods);

      const stub = {
        def, type: id, side: 0, level: 3, branch: null, asc: 0,
        stats, age: 1.35, recoil: 0, angle: -0.45, firing: false,
        mines: new Array(Math.min(4, stats.maxMines || 0)).fill(0),
        drones: new Array(stats.drones || 0).fill(0),
        minionList: [], wallList: [], glaiveList: [],
        charge: (stats.chargeMax || 0) * 0.55, windT: (stats.windMax || 0) * 0.6,
        drainMeter: (stats.drainPer || 0) * 0.45,
        incomeTimer: (stats.incomeEvery || 0) * 0.6,
        alchStacks: 0, jamTimer: 0, rampMult: 2, cooldown: 0.25, effRate: 1,
        aura: { dmg: 0, rate: 0, range: 0 },
        aimed(c2, fn) { c2.save(); c2.rotate(this.angle); fn(); c2.restore(); }
      };

      const scale = css / 46;
      ctx.save();
      ctx.translate(css / 2, css / 2);
      ctx.scale(scale, scale);

      /* platform, matching the battlefield plinth */
      ctx.fillStyle = 'rgba(8,12,20,0.9)';
      ctx.strokeStyle = def.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 6); ctx.fill(); ctx.stroke();

      ctx.shadowColor = def.color; ctx.shadowBlur = 10;
      try {
        const fn = Tower.prototype['draw_' + id];
        if (fn) fn.call(stub, ctx, stub.age);
        else if (def.glyph) Tower.prototype.draw_glyph.call(stub, ctx, stub.age);
        else Tower.prototype.draw_bolt.call(stub, ctx, stub.age);
      } catch (e) { /* never let one sprite break a menu */ }
      ctx.restore();
    });
  },

  /** Wires styled hover popups onto every [data-tt="TITLE|body"] in a root. */
  /* COARSE-POINTER COMMIT GUARD. A tap has no hover before it, so a control
     whose click is destructive would fire on the very first touch with the
     player never having seen what it does. `armed` returns true only once the
     same target has been tapped a second time; the first tap runs `preview`
     and arms. Fine pointers skip the whole thing — they hovered first. */
  tapArm(el, preview) {
    if (!window.matchMedia('(hover: none)').matches) return true;
    if (this._tapArm === el) { this._tapArm = null; return true; }
    this._tapArm = el;
    if (preview) preview();
    return false;
  },

  bindChipTips(root) {
    if (!root) return;
    $$('[data-tt]', root).forEach(el => {
      if (el._ttBound) return;
      el._ttBound = true;
      el.addEventListener('mouseenter', ev => {
        const parts = (el.dataset.tt || '').split('|');
        this.showTooltip(ev, `<div class="tt-head">${parts[0]}</div><p class="tt-desc">${parts[1] || ''}</p>`);
      });
      el.addEventListener('mousemove', ev => this.moveTooltip(ev));
      el.addEventListener('mouseleave', () => this.hideTooltip());
      /* Coarse pointers have no hover: first tap shows the briefing, a second
         tap (or tapping elsewhere) dismisses it. */
      el.addEventListener('click', ev => {
        if (!window.matchMedia('(hover: none)').matches) return;
        if (this._ttFor === el) { this.hideTooltip(); this._ttFor = null; return; }
        const parts = (el.dataset.tt || '').split('|');
        this.showTooltip(ev, `<div class="tt-head">${parts[0]}</div><p class="tt-desc">${parts[1] || ''}</p>`);
        this._ttFor = el;
      });
    });
  },

  /** The soul shop: permanent starting levels bought with campaign souls. */
  renderSoulShop() {
    const body = $('#souls-body');
    body.innerHTML = `
      <div class="soul-bank">◉ <b>${Meta.souls()}</b> souls banked</div>
      <h3 class="section-label">COMMANDERS — recruit permanently</h3>
      <div class="soul-grid cmds">${COMMANDER_ROSTER.filter(c => !Meta.isCommanderUnlocked(c.id) &&
          (!Meta.faction() || c.always || c.faction === Meta.faction())).map(c => {
        const f = FACTIONS[c.faction];
        const cost = Meta.commanderCost(c.id);
        return `<button class="soul-item cmd" data-unlock-cmd="${c.id}" style="--cc:${c.color}"
                ${Meta.souls() < cost ? 'disabled' : ''}
                data-tt="${c.name}, ${c.title}|${c.blurb}">
          <span class="si-ic">${c.icon}</span>
          <span class="si-name">${c.name}</span>
          <span class="si-el" style="--el:${f.color}">${f.icon} ${f.short}</span>
          <span class="si-cost">◉ ${cost}</span>
        </button>`;
      }).join('') || '<p class="hint">Every commander is recruited.</p>'}</div>

      <h3 class="section-label">SECOND ABILITY — unlock a commander's defensive power (◉${Meta.abilityCost()})</h3>
      <div class="soul-grid cmds">${COMMANDER_ROSTER.filter(c =>
          Meta.isCommanderUnlocked(c.id) && !Meta.hasSecondAbility(c.id)).map(c => {
        const ab = ABILITIES[c.abilities[1]];
        return `<button class="soul-item cmd" data-unlock-abil="${c.id}" style="--cc:${c.color}"
                ${Meta.souls() < Meta.abilityCost() ? 'disabled' : ''}
                data-tt="${ab.name}|${ab.desc}">
          <span class="si-ic">${ab.icon}</span>
          <span class="si-name">${c.name}</span>
          <span class="si-el" style="--el:#7dd3fc">${ab.name}</span>
          <span class="si-cost">◉ ${Meta.abilityCost()}</span>
        </button>`;
      }).join('') || '<p class="hint">Every recruited commander has both abilities.</p>'}</div>

      <h3 class="section-label">ARSENAL — unlock a tower permanently (◉${Meta.towerUnlockCost()} each)</h3>
      <p class="hint">Human and robotic hardware is sold to everyone. A power's own
        arsenal is only for sale while you are sworn to it.</p>
      <div class="soul-grid unlocks">${TOWER_ORDER.filter(id => !Meta.isTowerUnlocked(id)).map(id => {
        const t = TOWER_TYPES[id];
        const el = ELEMENTS[t.element];
        const og = originOf(id);
        /* A locked entry is SHOWN and told why. Hiding it made the arsenal
           look smaller than it is and gave the faction choice no visible
           consequence -- the whole reason the gate exists. */
        const lock = Meta.towerOriginLock(id);
        const poor = Meta.souls() < Meta.towerUnlockCost();
        return `<button class="soul-item unlock${lock ? ' origin-locked' : ''}" data-unlock="${id}"
                style="--cc:${lock ? og.color : t.color}"
                ${(lock || poor) ? 'disabled' : ''}
                data-preview="${id}">
          <span class="si-fig">${this.towerIconHTML(id, 40)}</span>
          <span class="si-name">${t.name}</span>
          <span class="si-el" style="--el:${el.color}">${el.icon} ${el.name}</span>
          <span class="si-og" style="--og:${og.color}">${og.icon} ${og.name}</span>
          ${lock
            ? `<span class="si-lock">⊘ SWORN TO ${lock.name} ONLY</span>`
            : `<span class="si-cost">◉ ${Meta.towerUnlockCost()}</span>`}
        </button>`;
      }).join('') || '<p class="hint">Every tower is unlocked.</p>'}</div>`;

    this.paintTowerIcons(body);
    this.bindChipTips(body);
    $$('[data-unlock-cmd]', body).forEach(b => b.addEventListener('click', () => {
      if (Meta.unlockCommander(b.dataset.unlockCmd)) { Sound.play('branch'); this.renderSoulShop(); }
      else Sound.play('denied');
    }));
    $$('[data-unlock-abil]', body).forEach(b => b.addEventListener('click', () => {
      if (Meta.unlockAbility(b.dataset.unlockAbil)) { Sound.play('branch'); this.renderSoulShop(); }
      else Sound.play('denied');
    }));
    this.bindTowerPreviews(body);
    $$('[data-unlock]', body).forEach(b => b.addEventListener('click', () => {
      if (Meta.unlockTower(b.dataset.unlock)) { Sound.play('branch'); this.renderSoulShop(); this.renderTitle(); }
      else Sound.play('denied');
    }));
  },

  buildCommanderScreen() {
    /* Only commanders you have actually recruited, grouped by faction and with
       your own faction first -- picking the Federation and then deploying with
       a Humanity commander made neither choice mean anything. */
    const mine = Meta.faction();
    /* The campaign involves YOUR faction: only its commanders (and the
       unaligned CADRE) can be fielded or browsed here. */
    const owned = COMMANDER_ROSTER.filter(c => Meta.isCommanderUnlocked(c.id) &&
      (c.always || !mine || c.faction === mine));
    /* Your own faction first, then the other powers, with the unaligned CADRE
       last so the list reads as "yours, theirs, the house". */
    const rank = c => c.faction === mine ? -2 : c.faction ? FACTION_ORDER.indexOf(c.faction) : 90;
    owned.sort((a, b) => rank(a) - rank(b));
    /* Default to a commander of your own faction until you deliberately pick
       otherwise -- choosing the Xeno and being handed a Humanity commander made
       the faction choice look cosmetic. */
    const sel = owned.find(c => c.id === this.sel.commander);
    if (!sel || (!this._cmdTouched && sel.faction !== mine))
      this.sel.commander = (owned.find(c => c.faction === mine) || owned[0]).id;

    $('#commander-list').innerHTML = owned.map(c => {
      /* CADRE is unaligned, so there is no faction record to read. */
      const f = c.faction ? FACTIONS[c.faction] : { color: '#94a3b8', icon: '⌂', short: 'Unaligned' };
      const a0 = ABILITIES[c.abilities[0]], a1 = ABILITIES[c.abilities[1]];
      const has2 = Meta.hasSecondAbility(c.id);
      const stars = Meta.prestigeOf(c.id);
      return `<button class="cmd-card" data-cmd="${c.id}" style="--cc:${c.color}"
              data-tt="${c.name}, ${c.title}|${c.trait.name}: ${c.trait.desc} — Q: ${a0.name}, ${a0.desc} — E: ${a1.name}${
                has2 ? ': ' + a1.desc : ' (LOCKED — fill the technology chart, or ' + Meta.abilityCost() + ' souls)'}">
        <span class="cmd-icon">${commanderPortrait(c, 44)}</span>
        <span class="cmd-body">
          <span class="cmd-name">${stars ? '<em class="pstars">' + '★'.repeat(stars) + '</em> ' : ''}${c.name}</span>
          <span class="cmd-title">${c.title}</span>
          <span class="cmd-fac" style="--fc:${f.color}">${f.icon} ${f.short}</span>
          <span class="cmd-lvl">LVL <b data-lvl="${c.id}">1</b></span>
        </span>
      </button>`;
    }).join('') + (() => {
      const pool = COMMANDER_ROSTER.filter(c2 => c2.always || !mine || c2.faction === mine);
      const locked = pool.length - owned.length;
      return locked ? `<div class="cmd-more">${locked} more ${locked === 1 ? 'commander' : 'commanders'} of your faction
        can be recruited with souls in the Soul Shop.</div>` : '';
    })();
    $$('[data-cmd]').forEach(b => b.addEventListener('click', () => {
      this.sel.commander = b.dataset.cmd; this._cmdTouched = true;
      Sound.play('click'); this.renderCommanders();
    }));
    this.bindChipTips($('#commander-list'));
    this.renderCommanders();
  },

  renderCommanders() {
    $$('[data-cmd]').forEach(b => b.classList.toggle('active', b.dataset.cmd === this.sel.commander));
    for (const c of COMMANDER_ROSTER) {
      const el = $(`[data-lvl="${c.id}"]`);
      if (el) el.textContent = Meta.levelOf(c.id);
    }
    const c = COMMANDERS.find(x => x.id === this.sel.commander) || COMMANDERS[0];
    const p = Meta.progress(c.id);
    const pts = Meta.pointsAvailable(c.id);

    $('#commander-detail').innerHTML = `
      <div class="cd-head" style="--cc:${c.color}">
        <div class="cd-icon">${commanderPortrait(c, 62)}</div>
        <div>
          <h2 class="cd-name">${c.name}</h2>
          <p class="cd-title">${c.title}</p>
        </div>
        <div class="cd-level">
          <b>${Meta.prestigeOf(c.id) ? '<em class="pstars">' + '★'.repeat(Meta.prestigeOf(c.id)) + '</em> ' : ''}LVL ${p.level}</b>
          <span class="xpbar"><i style="width:${(p.frac * 100).toFixed(1)}%"></i></span>
          <span class="xp-num">${p.into} / ${p.need} XP</span>
        </div>
      </div>
      <p class="cd-blurb">${c.blurb}</p>
      <div class="cd-trait" style="--cc:${c.color}">
        <b>${c.trait.name}</b>
        <span>${c.trait.desc}</span>
      </div>
      <div class="cd-techhead">
        <h3 class="section-label">TECHNOLOGY CHART</h3>
        <span class="pts ${pts > 0 ? 'has' : ''}">${pts} point${pts === 1 ? '' : 's'} available</span>
      </div>
      ${this.renderTechChart(c)}
      <div class="cd-foot">
        <p class="hint">Talents are permanent. Fight with a commander to earn levels; each level grants one point. Deeper rows unlock once enough points are spent in the tree.</p>
        ${Meta.canPrestige(c.id)
          ? `<button class="btn btn-sm prestige-btn" data-prestige="1">✦ PRESTIGE (${Meta.prestigeOf(c.id)}/5)</button>`
          : Meta.prestigeOf(c.id)
            ? `<span class="prestige-tag" data-tt="PRESTIGE ${Meta.prestigeOf(c.id)}/5|Talent values +${Meta.prestigeOf(c.id) * 20}%, plus the stacking faction bonus. Max the chart again to prestige further.">✦ ${Meta.prestigeOf(c.id)}/5 · talents +${Meta.prestigeOf(c.id) * 20}%</span>`
            : ''}
        <button class="btn btn-sm" data-reset-tree="1">RESET TREE</button>
      </div>`;

    $$('[data-tech]').forEach(b => b.addEventListener('click', () => {
      if (Meta.unlock(c.id, b.dataset.tech)) { Sound.play('tech'); this.renderCommanders(); }
      else Sound.play('denied');
    }));
    const reset = $('[data-reset-tree]');
    if (reset) reset.addEventListener('click', () => { Meta.resetTree(c.id); Sound.play('sell'); this.renderCommanders(); });
    const pbtn = $('[data-prestige]');
    if (pbtn) pbtn.addEventListener('click', () => {
      const next = Meta.prestigeOf(c.id) + 1;
      const fb = PRESTIGE_BONUS[c.faction || Meta.faction() || 'human'];
      this.confirmBox('PRESTIGE ' + c.name + '?',
        '<p>Their level and technology chart <b>reset</b>. In return, permanently:</p>' +
        '<ul class="cfm-list"><li>\u2726 prestige star <b>' + next + ' of 5</b></li>' +
        '<li>\u2726 ' + fb.desc + '</li>' +
        '<li>\u2726 every talent value <b>+20%</b> per star</li></ul>',
        '\u2726 PRESTIGE',
        () => {
          Meta.doPrestige(c.id);
          Sound.play('victory');
          this.toast('\u2726 ' + c.name + ' \u2014 PRESTIGE ' + next + '/5');
          this.renderCommanders(); this.bindChipTips($('#commander-detail'));
        });
    });
  },

  /**
   * A classic talent tree: three columns, three rows, icon frames, vertical
   * dependency arrows, and rows gated behind total points spent in the tree.
   */
  renderTechChart(c) {
    const spent = Meta.spentIn(c.id);
    const grid = [];
    for (let row = 0; row < 3; row++) {
      const gate = TALENT_ROW_GATE[row] || 0;
      const rowLocked = spent < gate;
      const cells = [];
      for (let col = 0; col < 3; col++) {
        const n = c.tech.find(t => t.col === col && t.row === row);
        if (!n) { cells.push('<div class="tal-cell empty"></div>'); continue; }
        const owned = Meta.isUnlocked(c.id, n.id);
        const reason = Meta.lockReason(c.id, n.id);
        const can = reason === null;
        const parent = Meta.parentOf(c, n);
        const arrow = parent
          ? `<span class="tal-arrow ${Meta.isUnlocked(c.id, parent.id) ? 'lit' : ''}">▲</span>` : '';
        cells.push(`<div class="tal-cell">
          ${arrow}
          <button class="tal-node ${owned ? 'owned' : can ? 'can' : 'locked'}"
                  data-tech="${n.id}" ${owned || !can ? 'disabled' : ''} style="--cc:${c.color}"
                  title="${n.desc}${owned ? '' : reason ? ' — ' + reason : ''}">
            <span class="tal-icon">${n.icon}</span>
            <span class="tal-rank">${owned ? n.cost + '/' + n.cost : '0/' + n.cost}</span>
          </button>
          <span class="tal-name">${n.name}</span>
          <span class="tal-desc">${n.desc}</span>
        </div>`);
      }
      grid.push(`<div class="tal-row ${rowLocked ? 'row-locked' : ''}">
        <div class="tal-gate">${gate === 0 ? 'OPEN' : gate + ' PTS'}</div>
        <div class="tal-cells">${cells.join('')}</div>
      </div>`);
    }
    return `<div class="talent-tree">${grid.join('')}</div>`;
  },

  /* ══════════════════════════════════════════════ SCREEN 2 — THEATRE ═══ */

  /* Difficulty now arrives with each campaign node; nothing to prebuild. */
  buildTheatreScreen() {},


  /**
   * The campaign presented as a WORLD MAP: a stylised landmass with the route
   * you have travelled drawn behind you, your current position marked, and the
   * roads ahead branching to the next battlefields. Hovering a destination
   * opens a full briefing card.
   *
   * Node positions derive from the campaign seed, so a given campaign always
   * draws the same journey.
   */
  /* ==================================================== FACTION SELECT == */

  renderFactions() {
    /* A faction is chosen once per PROFILE and never again -- soul-store
       unlocks persist across campaigns, and so does the banner they were
       bought under. Anyone with a faction has nothing to choose here. */
    if (Meta.faction()) { this.show('screen-command'); this.buildCommanderScreen(); return; }
    const chosen = this.sel.faction;
    $('#faction-grid').innerHTML = FACTION_ORDER.map(id => {
      const f = FACTIONS[id];
      const cmd = COMMANDER_ROSTER.find(c => c.id === freeCommanderOf(id)) || COMMANDER_ROSTER[0];
      return `<button class="fac-card ${chosen === id ? 'on' : ''}" data-fac="${id}"
                      style="--fc:${f.color};--fa:${f.accent}"
                      data-tt="${f.name}|${f.bonusName}: ${f.bonusDesc} Their rivals are ${
                        rivalFactionsOf(id).map(x => FACTIONS[x].short).join(', ')}. You begin with ${cmd.name}, ${cmd.title}.">
        <span class="fac-crest" aria-hidden="true">${
          (typeof ARTPACK !== 'undefined' && ARTPACK['fac_' + id])
            ? `<img src="${ARTPACK['fac_' + id]}" alt="" width="128" height="128">`
            : f.crest}</span>
        <span class="fac-name">${f.name}</span>
        <span class="fac-creed">${f.creed}</span>
        <span class="fac-blurb">${f.tagline}</span>
        <span class="fac-bonus"><b>${f.bonusName}</b>${f.bonusDesc}</span>
        <span class="fac-cmd">First commander &middot; <b>${cmd.name}</b>, ${cmd.title}</span>
      </button>`;
    }).join('');
    $$('[data-fac]').forEach(b => b.addEventListener('click', () => {
      this.sel.faction = b.dataset.fac; Sound.play('click'); this.renderFactions();
    }));
    this.bindChipTips($('#faction-grid'));
    $('#btn-faction-go').disabled = !(this.sel.faction || Meta.faction());
  },

  /* ======================================================= GALAXY MAP === */

  /**
   * THE BACKDROP behind a galaxy map: nebula, its noise clouds, and the star
   * scatter, drawn to the frame in config.js.
   *
   * `p` prefixes every id it defines. Both maps live in the document at the
   * same time and a duplicate SVG id resolves to whichever element the
   * document reached first, so THE UNIVERSE would have painted itself out of
   * THE GALAXY's gradients -- or, once the campaign map is torn down, out of
   * nothing at all.
   */
  gxBackdrop(p) {
    const V = GX_VIEW, mx = V.x + V.w / 2, my = V.y + V.h / 2;
    const stars = [];
    for (let i = 0; i < GX_BACKDROP_STARS; i++) {
      /* Golden-angle scatter: even coverage of the frame with no lattice. */
      const a = i * 2.399963, r = 2 + (i / GX_BACKDROP_STARS) * (V.w / 2 - 2);
      const sx = mx + Math.cos(a) * r, sy = my + Math.sin(a) * r * (V.h / V.w);
      stars.push(`<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="${(0.1 + (i % 3) * 0.055).toFixed(2)}"
                 fill="rgba(255,255,255,${(0.10 + (i % 5) * 0.035).toFixed(2)})"/>`);
    }
    return `<defs>
      <radialGradient id="${p}neb" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(150,120,255,.20)"/>
        <stop offset="55%" stop-color="rgba(80,60,180,.07)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
      <filter id="${p}nebNoise" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix"
          values="0 0 0 0 0.32  0 0 0 0 0.28  0 0 0 0 0.55  0 0 0 0.55 0"/>
        <feComposite operator="in" in2="SourceGraphic"/>
        <feGaussianBlur stdDeviation="1.4"/>
      </filter>
      <radialGradient id="${p}worldCore" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stop-color="rgba(255,255,255,.28)"/>
        <stop offset="45%" stop-color="rgba(255,255,255,.05)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,.4)"/>
      </radialGradient>
    </defs>
    <rect x="${V.x}" y="${V.y}" width="${V.w}" height="${V.h}" fill="url(#${p}neb)"/>
    <ellipse cx="30" cy="20" rx="44" ry="21" fill="#5b4ee0" filter="url(#${p}nebNoise)" opacity=".5"/>
    <ellipse cx="95" cy="62" rx="40" ry="18" fill="#0e7490" filter="url(#${p}nebNoise)" opacity=".45"/>
    ${stars.join('')}`;
  },

  /**
   * ONE world, painted. Paint order bottom to top: dot, painted planet clipped
   * to the disc, core shading, owner ring(s), the contested ⚔, then the star
   * pips. The ring and the ⚔ stay ABOVE the picture -- they are the ownership
   * read and the picture is decoration.
   *
   * THE UNIVERSE drew a bare dot and had never received any of this. Both maps
   * call it now, so the next thing added to a world arrives on both.
   * `opts.pips` is the star record, which only a campaign has.
   */
  gxWorldPaint(p, w, wy, r, opts) {
    const o = opts || {};
    const out = [];
    const cx = w.x.toFixed(2), cy = wy.toFixed(2);
    out.push(`<circle class="gx-dot" cx="${cx}" cy="${cy}" r="${r}"/>`);
    /* One of three painted variants per world KIND, chosen from the world's
       own id so a system reads as a set of distinct places and stays stable
       across renders. Absent from the pack it simply is not drawn: the dot and
       the core below it are the artwork the map shipped with. */
    const pl = planetArtFor(w);
    if (pl) {
      const cid = p + 'pc_' + String(w.id).replace(/[^a-z0-9]/gi, '');
      out.push(`<clipPath id="${cid}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
      out.push(`<image class="gx-planet" href="${pl}" x="${(w.x - r).toFixed(2)}" y="${(wy - r).toFixed(2)}"
                 width="${(r * 2).toFixed(2)}" height="${(r * 2).toFixed(2)}"
                 clip-path="url(#${cid})" preserveAspectRatio="xMidYMid slice" pointer-events="none"/>`);
    }
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${p}worldCore)" pointer-events="none" opacity="${pl ? 0.35 : 1}"/>`);
    if (o.contested) {
      const c2 = FACTIONS[w.contestedBy && w.contestedBy[1]] || FACTIONS.pirate;
      out.push(`<circle class="gx-ring" cx="${cx}" cy="${cy}" r="${r + 0.7}"
                 pathLength="100" stroke-dasharray="50 50"/>`);
      out.push(`<circle class="gx-ring gx-ring2" cx="${cx}" cy="${cy}" r="${r + 0.7}"
                 style="--fc:${c2.color}" pathLength="100" stroke-dasharray="50 50" stroke-dashoffset="-50"/>`);
      out.push(`<text class="gx-tri" x="${cx}" y="${(wy - r - 1.4).toFixed(2)}"
                 text-anchor="middle">⚔</text>`);
    } else {
      out.push(`<circle class="gx-ring" cx="${cx}" cy="${cy}" r="${r + 0.7}"/>`);
    }
    if (o.pips !== null && o.pips !== undefined) {
      for (let i = 0; i < 3; i++)
        out.push(`<rect class="gx-pip ${o.pips > i ? 'on' : ''}" x="${(w.x - 2.1 + i * 1.5).toFixed(2)}"
                   y="${(wy + r + 1.1).toFixed(2)}" width="1.1" height="1.1"
                   transform="rotate(45 ${(w.x - 1.55 + i * 1.5).toFixed(2)} ${(wy + r + 1.65).toFixed(2)})"/>`);
    }
    return out.join('');
  },

  /** Lay a freshly-rendered map on the 2.5D plane and give it the affordance
      hint, which a static map cannot advertise for itself. Both maps come
      through here, so the viewport can never again be something only one of
      them has. */
  mountGalaxyViewport(wrap) {
    if (!wrap || typeof GalaxyFX === 'undefined') return;
    GalaxyFX.mount(wrap);
    if (!wrap.querySelector('.gx-hint')) {
      const h = document.createElement('div');
      h.className = 'gx-hint';
      h.textContent = 'DRAG TO PAN · SCROLL TO ZOOM';
      wrap.appendChild(h);
    }
  },

  renderTheatre() {
    let c = Meta.campaign();
    /* A defeat no longer ends a campaign, so this branch is reached only after
       an abandon or a claimed galaxy -- and the allegiance outlives both. The
       road back from a finished battle must still land on the world map, not
       on the commander screen, so a sworn profile silently opens a fresh
       campaign under the same banner and the galaxy simply appears. */
    if (!c && Meta.faction()) { c = Meta.campaignStart(Meta.faction()); this.sel.loadout = []; }
    if (!c) { this.show('screen-faction'); this.renderFactions(); return; }
    const gx = Meta.galaxy();
    const prog = c.stars || {};
    /* Every seat taken: the galaxy is done, and the campaign resolves into a
       victory rather than trailing off with nothing left to click. */
    if (galaxyComplete(gx, prog)) return this.renderGalaxyVictory(gx, prog);
    const hold = galaxyHoldings(gx, prog);
    const total = gx.systems.reduce((a, s) => a + s.worlds.length, 0);
    const myF = FACTIONS[gx.playerFaction];

    $('#campaign-trail').innerHTML = `
      <div class="gx-status">
        <span class="gx-tier" data-tt="GALAXY TIER|Each conquered galaxy raises enemy strength 30% in the next.">✦ GALAXY ${['I','II','III','IV','V','VI','VII'][c.tier || 0]}</span>
        <span class="gx-flag" style="--fc:${myF.color}">${myF.icon} ${myF.name}</span>
        <span class="gx-hold">${hold[gx.playerFaction]} / ${total} worlds held</span>
        <span class="gx-seats" data-tt="COMMANDER SEATS|Take every seat and the galaxy is yours. A seat opens once you hold most of its system.">⚔ ${seatsRemaining(gx, prog)} seats standing</span>
        <span class="gx-bar">${FACTION_ORDER.map(f =>
          `<i style="--fc:${FACTIONS[f].color};flex:${Math.max(0.001, hold[f])}"
              data-tt="${FACTIONS[f].name}|${hold[f]} worlds held"></i>`).join('')}</span>
        <span class="gx-boons">${(c.boons || []).length
          ? (c.boons || []).map(id => { const b = BOONS.find(x => x.id === id);
              return b ? `<i class="gx-boon" data-tt="${b.name}|${b.desc}">${b.icon}</i>` : ''; }).join('')
          : '<i class="gx-noboon">no boons banked</i>'}</span>
        <span class="gx-souls">&#9673; ${Meta.souls()}</span>
      </div>`;
    this.bindChipTips($('#campaign-trail'));

    const svg = [];
    svg.push(`<svg class="galaxy" viewBox="${GX_VIEWBOX}" role="img"
                   aria-label="Galaxy map, ${gx.systems.length} solar systems">`);
    svg.push(this.gxBackdrop('gx'));
    for (let i = 1; i < gx.systems.length; i++) {
      const a = gx.systems[i - 1], b = gx.systems[i];
      const open = isSystemOpen(gx, b, prog);
      const mx = (a.x + b.x) / 2, my = ((a.y + b.y) / 2) * GX_RENDER_SQUASH - 6;
      svg.push(`<path class="gx-link ${open ? 'on' : ''}" fill="none"
        d="M${a.x.toFixed(2)} ${(a.y * GX_RENDER_SQUASH).toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)}
           ${b.x.toFixed(2)} ${(b.y * GX_RENDER_SQUASH).toFixed(2)}"/>`);
    }
    for (const sys of gx.systems) {
      const open = isSystemOpen(gx, sys, prog);
      const sp = systemProgress(sys, prog);
      const hf = FACTIONS[sys.holder];
      const sy = sys.y * GX_RENDER_SQUASH;
      svg.push(`<g class="gx-sys ${open ? '' : 'locked'}">`);
      svg.push(`<circle class="gx-halo" cx="${sys.x.toFixed(2)}" cy="${sy.toFixed(2)}" r="16"
                 style="--fc:${hf.color}"/>`);
      svg.push(`<text class="gx-sysname" x="${sys.x.toFixed(2)}" y="${(sy - 17.4).toFixed(2)}"
                 text-anchor="middle">${sys.name}</text>`);
      svg.push(`<text class="gx-sysmeta" x="${sys.x.toFixed(2)}" y="${(sy + 18.6).toFixed(2)}"
                 text-anchor="middle">${open ? sp.taken + '/' + sp.total + ' TAKEN' : 'SEALED'}</text>`);
      for (const w of sys.worlds) {
        const stars = starsOn(prog, w.id);
        const mine = stars >= 3;
        const canPlay = open && isWorldOpen(sys, w, prog);
        const of = FACTIONS[mine ? gx.playerFaction : w.owner];
        const wy = w.y * GX_RENDER_SQUASH;
        const cls = ['gx-world', canPlay ? 'open' : 'shut', mine ? 'mine' : '',
                     w.seat ? 'seat' : '', planetArtFor(w) ? 'has-planet' : '',
                     (c.chosen && c.chosen.world === w.id) ? 'sel' : ''].join(' ');
        svg.push(`<g class="${cls}" data-world="${w.id}" style="--fc:${of.color}" tabindex="0"
                   role="button" aria-label="${w.name}, ${of.short}, ${stars} stars">`);
        if (w.seat) svg.push(`<circle class="gx-seat" cx="${w.x.toFixed(2)}" cy="${wy.toFixed(2)}" r="4.1"/>`);
        const wr2 = w.seat ? 2.7 : 2.0;
        svg.push(this.gxWorldPaint('gx', w, wy, wr2,
                  { contested: w.contested && !mine, pips: stars }));
        svg.push(`</g>`);
      }
      svg.push(`</g>`);
    }
    svg.push(`</svg><p class="wm-hint">Hover a world for its briefing &middot; click to set course &middot; three stars conquers it</p>`);
    $('#worldmap-wrap').innerHTML = svg.join('');

    /* Lay the freshly-rendered map on the 2.5D plane before wiring clicks, so
       the nodes bind inside the structure they will actually live in. */
    this.mountGalaxyViewport($('#worldmap-wrap'));
    $$('#worldmap-wrap .gx-world').forEach(g => {
      const w = this.worldById(gx, g.dataset.world);
      const sys = gx.systems[w.si];
      const brief = ev => this.showTooltip(ev, this.worldBriefing(gx, sys, w, prog));
      g.addEventListener('mouseenter', brief);
      g.addEventListener('focus', brief);
      g.addEventListener('mousemove', ev => this.moveTooltip(ev));
      g.addEventListener('mouseleave', () => this.hideTooltip());
      g.addEventListener('blur', () => this.hideTooltip());
      const pick = () => {
        if (!isSystemOpen(gx, sys, prog) || !isWorldOpen(sys, w, prog)) { Sound.play('denied'); return; }
        c.chosen = { world: w.id, map: w.map, arena: w.arena, boon: w.boon,
                     /* The world's own commander, not the system's -- these
                        two ship together into sides[1] and nothing
                        downstream reconciles them. */
                     rival: worldBossOf(sys, w), rivalFaction: w.owner, kind: w.kind,
                     contested: !!w.contested, contestedBy: w.contestedBy,
                     difficulty: w.si < 1 ? 'skirmish' : w.si < 3 ? 'contested' : 'overrun',
                     escStart: Math.floor(w.si * 0.8) };
        Meta.save(); Sound.play('click'); this.renderTheatre();
      };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    });

    const chosenW = c.chosen && this.worldById(gx, c.chosen.world);
    $('#theatre-detail').innerHTML = (chosenW
      ? '<div class="course-set">&#9672; COURSE SET</div>' +
        this.worldBriefing(gx, gx.systems[chosenW.si], chosenW, prog, true)
      : '<p class="hint">Select a world on the map to plot your course.</p>') +
      `<div class="soul-note">
         <b>◉ SOULS</b>
         <p>Stars pay souls the moment you earn them — <b>${Meta.soulsForStar(1)}</b>
            per star, so a clean three-star conquest is <b>${[1, 2, 3].reduce((a, n) => a + Meta.soulsForStar(n), 0)}</b>,
            and <b>+${Meta.SYSTEM_BOUNTY}</b> for every solar system taken whole.
            Spend them in the Soul Shop.</p>
       </div>`;


    $('#btn-to-loadout').disabled = !c.chosen;
  },

  /** The end of a campaign that was actually won. */
  renderGalaxyVictory(gx, prog) {
    const f = FACTIONS[gx.playerFaction];
    const hold = galaxyHoldings(gx, prog);
    const total = gx.systems.reduce((a, s) => a + s.worlds.length, 0);
    const stars = Object.values(prog).reduce((a, b) => a + b, 0);
    const payout = Meta.campaignPayout(0);

    $('#campaign-trail').innerHTML = '';
    /* The map is gone from this screen, so its starfield has nothing left to
       sit behind -- and the wrap is still connected, which is the only thing
       the loop checks for itself. */
    if (typeof GalaxyFX !== 'undefined') GalaxyFX.stop();
    $('#worldmap-wrap').innerHTML = `
      <div class="gv" style="--fc:${f.color}">
        <span class="gv-sigil">${f.icon}</span>
        <h2>GALAXY CONQUERED</h2>
        <p class="gv-sub">Every commander seat has fallen. ${f.name} holds
           <b>${hold[gx.playerFaction]} of ${total}</b> worlds across five solar systems.</p>
        <div class="gv-stats">
          <div><b>${gx.systems.length}</b><span>systems taken</span></div>
          <div><b>${stars}</b><span>stars earned</span></div>
          <div><b>${Math.round(stars / (total * 3) * 100)}%</b><span>of a perfect galaxy</span></div>
        </div>
        <p class="gv-next">Galaxy ${['II','III','IV','V','VI','VII','VIII'][Meta.load().galaxyTier || 0]} is already mustering — its garrisons will be 30% stronger.</p>
        <button id="btn-gv-claim" class="btn btn-primary btn-big">◉ CLAIM ${payout} SOULS &amp; ADVANCE</button>
      </div>`;
    $('#theatre-detail').innerHTML = '';
    $('#btn-to-loadout').disabled = true;
    Sound.play('victory');

    $('#btn-gv-claim').addEventListener('click', () => {
      /* Advancing raises the permanent galaxy tier; the next campaign is
         generated at +30% enemy strength per tier. */
      const pl = Meta.load(); pl.galaxyTier = (pl.galaxyTier || 0) + 1; Meta.save(true);
      const res = Meta.campaignExtract();
      this.toast('Galaxy conquered — banked ◉ ' + res.souls + ' souls.');
      this.show('screen-title'); this.renderTitle();
    });
  },

  /* ═══════════════════════════════ MULTIVERSE (multiplayer lobby) ═══ */

  renderMultiverse() {
    const fac = Meta.faction() || 'human';
    if (!this._mvGx) this._mvGx = generateGalaxy(777001, fac);
    const gx = this._mvGx;
    /* PARITY WITH THE GALAXY. This map was drawing bare dots on a flat
       gradient: no nebula, no painted planets, no owner rings, no seat marks,
       no 2.5D viewport -- every one of which THE GALAXY has had since Session
       15. It is the same generated galaxy; there was never a reason for it to
       be a poorer picture of one. */
    const svg = [`<svg class="galaxy" viewBox="${GX_VIEWBOX}" role="img" aria-label="Universe map">`];
    svg.push(this.gxBackdrop('mv'));
    for (let i = 1; i < gx.systems.length; i++) {
      const a = gx.systems[i - 1], b = gx.systems[i];
      const mx = (a.x + b.x) / 2, my = ((a.y + b.y) / 2) * GX_RENDER_SQUASH - 6;
      svg.push(`<path class="gx-link on" fill="none"
        d="M${a.x.toFixed(2)} ${(a.y * GX_RENDER_SQUASH).toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)}
           ${b.x.toFixed(2)} ${(b.y * GX_RENDER_SQUASH).toFixed(2)}"/>`);
    }
    for (const sys of gx.systems) {
      const hf = FACTIONS[sys.holder];
      const sy = sys.y * GX_RENDER_SQUASH;
      svg.push(`<g class="gx-sys">`);
      svg.push(`<circle class="gx-halo" cx="${sys.x.toFixed(2)}" cy="${sy.toFixed(2)}" r="16"
                 style="--fc:${hf.color}"/>`);
      svg.push(`<text class="gx-sysname" x="${sys.x.toFixed(2)}" y="${(sy - 17.4).toFixed(2)}"
                 text-anchor="middle">${sys.name}</text>`);
      svg.push(`<text class="gx-sysmeta" x="${sys.x.toFixed(2)}" y="${(sy + 18.6).toFixed(2)}"
                 text-anchor="middle">${sys.worlds.length} WORLDS OPEN</text>`);
      for (const w of sys.worlds) {
        const of = FACTIONS[w.owner];
        const wy = w.y * GX_RENDER_SQUASH;
        const wr2 = w.seat ? 2.7 : 2.0;
        const cls = ['gx-world', 'open', w.seat ? 'seat' : '',
                     planetArtFor(w) ? 'has-planet' : ''].join(' ');
        svg.push(`<g class="${cls}" data-mv="${w.id}" style="--fc:${of.color}" tabindex="0"
                   role="button" aria-label="${w.name}, ${of.short}">`);
        if (w.seat) svg.push(`<circle class="gx-seat" cx="${w.x.toFixed(2)}" cy="${wy.toFixed(2)}" r="4.1"/>`);
        /* No pips: the relay keeps no star ledger, so there is no record to
           show and three empty diamonds would be a claim about one. */
        svg.push(this.gxWorldPaint('mv', w, wy, wr2, { contested: w.contested, pips: null }));
        svg.push(`</g>`);
      }
      svg.push(`</g>`);
    }
    svg.push(`</svg><p class="wm-hint">Drag to pan &middot; click a world to look for another commander fighting over it</p>`);
    $('#multiverse-wrap').innerHTML = svg.join('');
    this.mountGalaxyViewport($('#multiverse-wrap'));

    $$('#multiverse-wrap .gx-world').forEach(g => {
      const w = this.worldById(gx, g.dataset.mv);
      const sys = gx.systems[w.si];
      const mp = MAPS.find(x => x.id === w.map);
      const brief = ev => this.showTooltip(ev, `<div class="brief">
        <div class="br-head"><b>${w.name}</b>
          <span class="tag" style="color:${FACTIONS[w.owner].color}">${FACTIONS[w.owner].short}</span></div>
        <div class="br-trait">${sys.name} · ${WORLD_KINDS[w.kind].icon} ${WORLD_KINDS[w.kind].label}</div>
        ${mp ? `<div class="br-map"><b>${mp.name}</b> — ${mp.trait}</div>` : ''}
        ${mp && mp.blurb ? `<p class="br-blurb">${mp.blurb}</p>` : ''}
        <div class="br-rows">${w.contested ? `<div class="br-row"><span class="br-ic">⚔</span>
          <span>A three-way board. Every kill reanimates toward BOTH rivals.</span></div>` : ''}
          <div class="br-row"><span class="br-ic">⚔</span>
          <span>Click to challenge — the relay searches for another commander here.</span></div></div></div>`);
      g.addEventListener('mouseenter', brief);
      g.addEventListener('focus', brief);
      g.addEventListener('mousemove', ev => this.moveTooltip(ev));
      g.addEventListener('mouseleave', () => this.hideTooltip());
      g.addEventListener('blur', () => this.hideTooltip());
      g.addEventListener('click', ev => {
        /* On touch the first tap shows the world; only the second challenges. */
        if (!this.tapArm(g, () => brief(ev))) return;
        this.hideTooltip(); this.mpSearch(w);
      });
    });
    this.mountMaelstrom();
  },

  /**
   * Matchmaking front door. There is no live relay yet -- the campaign's whole
   * data model (a seed plus a star ledger) was built so one can attach later --
   * so the search resolves honestly and offers the garrison as practice.
   */
  mpSearch(w) {
    const ov = $('#mv-search'), body = $('#mv-search-body');
    ov.classList.remove('hidden');
    body.innerHTML = `<b class="mv-title">OPENING RELAY</b><div class="mv-spin"></div>
      <p class="mv-text">Searching for a commander over <b>${w.name}</b>…</p>`;
    clearTimeout(this._mvT);
    this._mvT = setTimeout(() => {
      body.innerHTML = `<b class="mv-title">NO ANSWER</b>
        <p class="mv-text">No commander answered over <b>${w.name}</b>. The live relay comes
           online in a future update — for now, its garrison will oblige.</p>
        <div class="modal-actions">
          <button id="btn-mv-practice" class="btn btn-primary">SKIRMISH THE GARRISON</button>
          <button id="btn-mv-cancel" class="btn">CANCEL</button></div>`;
      $('#btn-mv-practice').addEventListener('click', () => {
        ov.classList.add('hidden'); Sound.resume();
        const fac = Meta.faction() || 'human';
        const cmd = Meta.isCommanderUnlocked(freeCommanderOf(fac)) ? freeCommanderOf(fac) : 'cadre';
        const owned = Meta.unlockedTowers();
        Game.start({ skirmish: true, map: w.map, difficulty: 'contested', commander: cmd,
                     loadout: owned.slice(0, Math.min(LOADOUT_SIZE, owned.length)),
                     rivalFaction: w.owner, worldKind: w.kind, arena: w.arena });
        this.show('screen-game'); this.buildShop(); this.buildAbilityBar(); Game.resize();
      });
      $('#btn-mv-cancel').addEventListener('click', () => ov.classList.add('hidden'));
    }, 3600);
  },

  /* ═══════════════════════════════ THE MAELSTROM ═══ */

  /**
   * Hangs the singularity in the middle of the universe map and starts the
   * pull. The systems keep the coordinates the galaxy gave them: the drift is
   * a transform laid over the top, so leaving the screen and coming back finds
   * the map exactly where it was authored rather than wherever it had fallen.
   */
  mountMaelstrom() {
    const svg = $('#multiverse-wrap svg');
    if (!svg) return;
    this.stopMaelstromDrift();

    /* THE FRAME IS READ, NOT ASSUMED. The hole belongs at the centre of
       whatever viewBox this map is drawn in, and that box is a constant the
       galaxy owns -- it has already changed once. Everything below is sized
       off it too, so the singularity keeps its proportions in any frame. */
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const framed = vb.length === 4 && vb.every(v => isFinite(v)) && vb[2] > 0 && vb[3] > 0;
    const hx = framed ? vb[0] + vb[2] / 2 : MV_HOLE_X;
    const hy = framed ? vb[1] + vb[3] / 2 : MV_HOLE_Y;
    /* The map squashes y, so a disc has to be squashed with it or it reads as
       a sphere sitting on top of the plane instead of in it. */
    const sq = (typeof GX_RENDER_SQUASH === 'number' && GX_RENDER_SQUASH > 0)
             ? GX_RENDER_SQUASH : MV_HOLE_SQUASH;
    const R = ((framed ? vb[2] : MV_HOLE_W) / MV_HOLE_W) * 14;
    /* Published because it is the map's REAL centre, not the fallback: the
       test measures the pull against this, and so should anything else. */
    this._mvHole = { x: hx, y: hy, r: R };

    const NS = 'http://www.w3.org/2000/svg';
    const hole = document.createElementNS(NS, 'g');
    hole.setAttribute('class', 'mv-hole');
    const shape = (tag, cls, attrs) => {
      let out = '<' + tag + ' class="' + cls + '"';
      for (const k in attrs) out += ' ' + k + '="' + (+attrs[k]).toFixed(3) + '"';
      return out + '/>';
    };
    /* THE PAINTED SINGULARITY, under the vector rings rather than instead of
       them: a raster cannot spin, cannot light on hover and cannot carry the
       label, so the plate becomes the ground the existing geometry turns on.
       Masked to a soft ellipse because the plate is square and what is behind
       it is a starfield. With no plate in the pack the string is empty and
       the hole is exactly the vector drawing it has always been. */
    const plate = art('blackhole');
    const pw = R * MV_HOLE_PLATE_SPREAD, ph = pw * sq;
    const painted = !plate ? '' :
      '<defs><radialGradient id="mv-hole-fade">' +
        '<stop offset="' + (MV_HOLE_PLATE_FADE * 100).toFixed(1) + '%" stop-color="#fff"/>' +
        '<stop offset="100%" stop-color="#000"/>' +
      '</radialGradient><mask id="mv-hole-mask">' +
        '<ellipse cx="' + hx.toFixed(3) + '" cy="' + hy.toFixed(3) + '" rx="' + pw.toFixed(3) +
        '" ry="' + ph.toFixed(3) + '" fill="url(#mv-hole-fade)"/>' +
      '</mask></defs>' +
      '<image class="mv-hole-art" mask="url(#mv-hole-mask)" preserveAspectRatio="xMidYMid slice"' +
        ' x="' + (hx - pw).toFixed(3) + '" y="' + (hy - ph).toFixed(3) +
        '" width="' + (pw * 2).toFixed(3) + '" height="' + (ph * 2).toFixed(3) +
        '" href="' + plate + '"/>';
    hole.innerHTML = painted +
      shape('ellipse', 'mv-disc', { cx: hx, cy: hy, rx: R, ry: R * sq }) +
      shape('ellipse', 'mv-disc in', { cx: hx, cy: hy, rx: R * 0.671, ry: R * 0.671 * sq }) +
      shape('circle', 'mv-rim', { cx: hx, cy: hy, r: R * 0.25 }) +
      shape('circle', 'mv-core', { cx: hx, cy: hy, r: R * 0.229 }) +
      '<text class="mv-hole-label" x="' + hx.toFixed(3) + '" y="' + (hy + R * 0.957).toFixed(3) +
        '" text-anchor="middle">THE MAELSTROM</text>';
    /* Behind the systems: they fall INTO it, so it cannot be painted on top.
       The reference node has to be a DIRECT CHILD of the svg -- systems are
       wrapped in a `g.gx-sys` on this map now, and insertBefore against a
       grandchild throws NotFoundError and takes the whole render down with it. */
    let ref = svg.querySelector('.gx-halo, .gx-sys, .gx-world');
    while (ref && ref.parentNode !== svg) ref = ref.parentNode;
    if (ref) svg.insertBefore(hole, ref); else svg.appendChild(hole);

    /* THE HIT TARGET GOES ON TOP, and only the painting stays buried. A system
       sits within a couple of units of the middle of this map and its halo is
       a FILLED circle sixteen units across, so a hit target buried with the
       rest of the hole is a door the halo swallows whole -- there is no click
       anywhere on the singularity that reaches it. Kept down to the black disc
       the player actually aims at (R*0.36 against a core of R*0.229) so it
       does not in turn swallow the worlds that fall closest: the pull floors
       at 1 - MV_PULL_MAX, which leaves the nearest of them outside it. */
    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('class', 'mv-hit');
    hit.setAttribute('cx', hx.toFixed(3));
    hit.setAttribute('cy', hy.toFixed(3));
    hit.setAttribute('r', (R * 0.36).toFixed(3));
    svg.appendChild(hit);

    const drift = [];
    $$('#multiverse-wrap .gx-halo, #multiverse-wrap .gx-sysname, ' +
       '#multiverse-wrap .gx-sysmeta, #multiverse-wrap .gx-world')
      .forEach(el => {
        const c = el.tagName.toLowerCase() === 'g' ? el.querySelector('circle') : el;
        if (!c) return;
        const ax = c.getAttribute('cx'), ay = c.getAttribute('cy');
        const bx = ax === null ? c.getAttribute('x') : ax;
        const by = ay === null ? c.getAttribute('y') : ay;
        /* No resolvable centre means no honest displacement. Falling back to
           (0,0) would not leave such an element alone -- it would drift it as
           if it stood in the corner of the frame. */
        if (bx === null || by === null) return;
        const x = parseFloat(bx), y = parseFloat(by);
        if (!isFinite(x) || !isFinite(y)) return;
        drift.push({ el, dx: x - hx, dy: y - hy });
      });
    /* The links between systems are EXTENDED geometry: one translate cannot
       follow two endpoints that are each turning and closing in, so a link
       would hang in space while both systems it joins fell away from it. They
       take the same rotate-and-close about the hole as a MATRIX instead --
       which is exactly the map every point above is under. */
    const links = $$('#multiverse-wrap .gx-link');

    const tip = ev => this.showTooltip(ev, '<div class="brief"><div class="br-head">' +
      '<b>THE MAELSTROM</b><span class="tag">ARENA</span></div>' +
      '<div class="br-trait">A singularity at the centre of the universe · up to ' +
      MAELSTROM_MAX_SEATS + ' seats</div><div class="br-rows"><div class="br-row">' +
      '<span class="br-ic">&#9673;</span><span>Every commander holds their own lane and their own base. ' +
      'Nothing you kill comes back to you — you send by muster alone.</span></div></div></div>');
    /* The label used to be lit by a sibling selector, which the split above
       breaks -- the two are no longer siblings. A class on the buried group
       says the same thing and survives wherever either one is parented. */
    hit.addEventListener('mouseenter', ev => { hole.classList.add('lit'); tip(ev); });
    hit.addEventListener('mousemove', ev => this.moveTooltip(ev));
    hit.addEventListener('mouseleave', () => { hole.classList.remove('lit'); this.hideTooltip(); });
    hit.addEventListener('click', ev => {
      /* Same rule as the universe nodes: entering the arena is a commitment,
         and a touch player has had no hover in which to read what it is. */
      if (!this.tapArm(hit, () => { hole.classList.add('lit'); tip(ev); })) return;
      this.hideTooltip(); Sound.play('click'); this.openMaelstrom();
    });

    const clock = () => (window.performance && performance.now) ? performance.now() : Date.now();
    const t0 = clock();
    /* Reads the timestamp the frame callback is HANDED rather than asking the
       clock again: it is the time that frame is being painted for, and it is
       the only handle anything outside has on how far the pull has run. */
    const tick = ts => {
      const screen = document.getElementById('screen-multiverse');
      /* Stops itself the moment the screen goes away, so the map does not keep
         a frame loop alive behind a battle. */
      if (!screen || screen.classList.contains('hidden') || !svg.parentNode) { this._mvRaf = 0; return; }
      const t = ((ts === undefined ? clock() : ts) - t0) / 1000;
      const pull = MV_PULL_MAX * (1 - Math.exp(-t / MV_PULL_TAU));
      const a = pull * MV_SWIRL_TURNS * TAU, ca = Math.cos(a), sa = Math.sin(a), k = 1 - pull;
      for (const d of drift) {
        const nx = (d.dx * ca - d.dy * sa) * k, ny = (d.dx * sa + d.dy * ca) * k;
        d.el.setAttribute('transform',
          'translate(' + (nx - d.dx).toFixed(3) + ' ' + (ny - d.dy).toFixed(3) + ')');
      }
      if (links.length) {
        const m = 'translate(' + hx.toFixed(3) + ' ' + hy.toFixed(3) + ') rotate(' +
                  (a * 180 / Math.PI).toFixed(3) + ') scale(' + k.toFixed(5) + ') translate(' +
                  (-hx).toFixed(3) + ' ' + (-hy).toFixed(3) + ')';
        for (let i = 0; i < links.length; i++) links[i].setAttribute('transform', m);
      }
      this._mvRaf = requestAnimationFrame(tick);
    };
    this._mvRaf = requestAnimationFrame(tick);
  },

  stopMaelstromDrift() {
    if (this._mvRaf) cancelAnimationFrame(this._mvRaf);
    this._mvRaf = 0;
  },

  /** The seat lobby. The count is the only setting: everything else about the
      board is solved from it. */
  openMaelstrom() {
    const ov = $('#mv-maelstrom'), body = $('#mv-maelstrom-body');
    if (!ov || !body) return;
    const seats = [];
    for (let n = MAELSTROM_MIN_SEATS; n <= MAELSTROM_MAX_SEATS; n += 4) seats.push(n);
    if (this._mvSeats === undefined) this._mvSeats = MAELSTROM_MAX_SEATS;
    /* The arena gets its own world plate, heading the lobby the way a map
       plate heads a world briefing. HOISTED OUT of draw(): every seat button
       redraws, and rebuilding a 34 KB data-URI <img> five times over flashes
       the painting back in on a node the browser has only just inserted. */
    const plate = artImg('world_maelstrom', 'mv-art', 'THE MAELSTROM');
    body.innerHTML = (plate ? '<div class="mv-plate">' + plate + '</div>' : '') +
                     '<div class="mv-lobby"></div>';
    const lobby = $('.mv-lobby', body);
    const draw = () => {
      const m = maelstromMap(this._mvSeats);
      lobby.innerHTML = '<b class="mv-title">THE MAELSTROM</b>' +
        '<p class="mv-text">One board, one singularity, a base and a lane for every commander. ' +
        'Nothing that walks into your lane reanimates for you — killing it leaves you nothing ' +
        'to send. You send by <b>MUSTER</b>, and every reanimation bonus you hold still rides ' +
        'what you send. The horizon contracts every ' + MAELSTROM_CONTRACT_WAVES +
        ' waves and keeps whatever is standing inside it.</p>' +
        '<div class="mv-seats">' + seats.map(n =>
          '<button class="btn seat-btn' + (n === this._mvSeats ? ' active' : '') +
          '" data-seats="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<p class="mv-note">' + m.cols + ' × ' + m.rows + ' tiles · ' +
        (this._mvSeats - 1) + ' rival commanders · your sends march on the seat beside you</p>' +
        '<div class="modal-actions">' +
        '<button id="btn-mael-go" class="btn btn-primary">ENTER THE MAELSTROM</button>' +
        '<button id="btn-mael-cancel" class="btn">CANCEL</button></div>';
      $$('[data-seats]', lobby).forEach(b => b.addEventListener('click', () => {
        this._mvSeats = +b.dataset.seats; Sound.play('click'); draw();
      }));
      $('#btn-mael-go').addEventListener('click', () => this.startMaelstrom(this._mvSeats));
      $('#btn-mael-cancel').addEventListener('click', () => { ov.classList.add('hidden'); Sound.play('click'); });
    };
    draw();
    ov.classList.remove('hidden');
  },

  /** Drops into the arena as a SKIRMISH: the campaign ledger is not this
      board's business, and a twenty-seat brawl is not a world to be starred. */
  startMaelstrom(seats) {
    $('#mv-maelstrom').classList.add('hidden');
    this.stopMaelstromDrift();
    Sound.resume();
    const fac = Meta.faction() || 'human';
    const cmd = Meta.isCommanderUnlocked(freeCommanderOf(fac)) ? freeCommanderOf(fac) : 'cadre';
    const owned = Meta.unlockedTowers();
    Game.start({ skirmish: true, maelstrom: seats, difficulty: 'contested',
                 commander: cmd, faction: fac,
                 loadout: owned.slice(0, Math.min(LOADOUT_SIZE, owned.length)),
                 musterLoadout: Meta.musterLoadout() });
    this.show('screen-game'); this.buildShop(); this.buildAbilityBar(); Game.resize();
  },

  /** The seat ladder: one pip per seat, dimmed as they fall. Twenty commanders
      will not fit as HUD panels, and a count alone does not say who is left. */
  syncArenaLadder() {
    const host = $('#hud-rivals');
    if (!host) return;
    let el = $('#arena-ladder');
    if (!el) {
      el = document.createElement('div');
      el.id = 'arena-ladder';
      el.className = 'arena-ladder';
      host.insertBefore(el, $('.ctl-group', host));
    }
    /* Keyed on the standing/fallen pattern alone. Lives change every frame and
       rebuilding twenty pips at 8Hz for a number this strip does not show is
       DOM churn nothing on screen needed. */
    const key = Game.sides.map(S => (S.defeated || !S.alive) ? '0' : '1').join('');
    if (el.dataset.lkey === key) return;
    el.dataset.lkey = key;
    const live = Game.sides.filter(S => !S.defeated && S.alive).length;
    el.innerHTML = '<span class="al-head">&#9678; <b>' + live + '</b>/' + Game.sides.length + ' SEATS</span>' +
      '<span class="al-pips">' + Game.sides.map((S, i) => {
        const f = FACTIONS[S.faction] || FACTIONS.pirate;
        const out = (S.defeated || !S.alive) ? ' out' : '';
        return '<i class="pip' + out + (i === 0 ? ' me' : '') + '" style="--cc:' + f.color +
               '" title="' + (i === 0 ? 'YOU' : (S.commander ? S.commander.name : 'SEAT ' + i)) + '"></i>';
      }).join('') + '</span>';
  },

  dropArenaLadder() {
    const el = $('#arena-ladder');
    if (el) el.remove();
  },

  worldById(gx, id) {
    for (const s of gx.systems) for (const w of s.worlds) if (w.id === id) return w;
    return null;
  },

  worldBriefing(gx, sys, w, prog, inline) {
    /* `blurb` and `sigNote` are authored on all fifteen maps and were rendered
       nowhere: the card named the WORLD and never the board you would actually
       be standing on, which is the one thing a loadout is chosen against. */
    const m = MAPS.find(x => x.id === w.map);
    const stars = starsOn(prog, w.id);
    const mine = stars >= 3;
    const of = FACTIONS[mine ? gx.playerFaction : w.owner];
    const boss = COMMANDER_ROSTER.find(c => c.id === worldBossOf(sys, w));
    const kind = WORLD_KINDS[w.kind];
    const arena = w.arena && ARENA_MODS.find(a => a.id === w.arena);
    const boon = BOONS.find(b => b.id === w.boon);
    const open = isSystemOpen(gx, sys, prog) && isWorldOpen(sys, w, prog);
    /* The battlefield itself, painted. Falls back to the plain header when
       the art pack has no plate for this map. */
    /* Held worlds take the holder's duotone plate so the card reads as THEIR
       territory at a glance; fall back to the neutral painting. */
    const holder = mine ? gx.playerFaction : w.owner;
    const plate = artImg('world_' + w.map + '_' + holder, 'br-art', w.name)
               || artImg('world_' + w.map, 'br-art', w.name);
    return `<div class="brief ${inline ? 'inline' : ''} ${plate ? 'has-art' : ''}">
      ${plate ? `<div class="br-plate" style="--fc:${of.color}">${plate}</div>` : ''}
      <div class="br-head"><b>${w.name}</b>
        <span class="tag" style="color:${of.color}">${of.short}</span></div>
      <div class="br-trait">${sys.name} &middot; ${kind.icon} ${kind.label}${w.seat ? ' &middot; COMMANDER SEAT' : ''}</div>
      ${m ? `<div class="br-map"><b>${m.name}</b> &mdash; ${m.trait}</div>` : ''}
      ${m && m.blurb ? `<p class="br-blurb">${m.blurb}</p>` : ''}
      ${w.contested ? `<div class="br-contested">
        <b>⚔ CONTESTED — THREE-WAY WAR</b>
        <span>${w.contestedBy.map(f => `<i style="color:${FACTIONS[f].color}">${FACTIONS[f].icon} ${FACTIONS[f].short}</i>`).join(' vs ')}
        vs <i style="color:${FACTIONS[gx.playerFaction].color}">you</i>. Every kill reanimates toward BOTH rivals.</span>
      </div>` : ''}
      <div class="br-stars">${[1, 2, 3].map(i =>
        `<span class="${stars >= i ? 'on' : ''}">&#9733;</span>`).join('')}
        <em>${mine ? 'CONQUERED' : stars ? 'held, not cleanly' : 'unclaimed'}</em></div>
      <div class="br-starreq">
        <div class="${stars >= 1 ? 'got' : ''}"><span>&#9733;</span><em>Win the battle</em></div>
        <div class="${stars >= 2 ? 'got' : ''}"><span>&#9733;&#9733;</span><em>Win keeping 55%+ of your lives</em></div>
        <div class="${stars >= 3 ? 'got' : ''}"><span>&#9733;&#9733;&#9733;</span><em>Win keeping 90%+ — conquers the world</em></div>
      </div>
      <div class="br-rows">
        ${kind.note ? `<div class="br-row"><span class="br-ic">${kind.icon}</span><span>${kind.note}</span></div>` : ''}
        ${m && m.sigNote ? `<div class="br-row"><span class="br-ic">&#8258;</span><span>${m.sigNote}</span></div>` : ''}
        <div class="br-row"><span class="br-ic">&#9760;</span><span><b>${boss.name}</b>, ${boss.title} &mdash; ${
          w.owner === sys.holder ? 'commands this system' : 'holds this world'}</span></div>
        <div class="br-row"><span class="br-ic">&#9709;</span><span>${arena ? '<b>' + arena.name + '</b> &mdash; ' + arena.desc : 'No arena modifier'}</span></div>
        <div class="br-row"><span class="br-ic gold">&#9829;</span><span>Victory boon: <b>${boon.name}</b> &mdash; ${boon.desc}</span></div>
        ${open ? '' : '<div class="br-row esc"><span class="br-ic">&#8856;</span><span><b>Sealed.</b> Take an adjacent world first.</span></div>'}
      </div>
      <div class="br-foot">A conquered world is territory: it counts toward the seat, and rivals cannot take it back.</div>
    </div>`;
  },

/** Rich briefing card for a campaign destination. */
  nodeBriefing(o, inline) {
    const m = MAPS.find(x => x.id === o.map);
    const rv = COMMANDERS.find(x => x.id === o.rival);
    const ar = o.arena ? ARENA_MODS.find(x => x.id === o.arena) : null;
    const bn = BOONS.find(x => x.id === o.boon);
    const df = DIFFICULTIES.find(x => x.id === o.difficulty);
    return '<div class="brief ' + (inline ? 'inline' : '') + '">' +
      '<div class="br-head"><b>' + m.name + '</b><span class="tag">' + df.name + '</span></div>' +
      '<div class="br-thumb">' + this.mapThumb(m) + '</div>' +
      '<div class="br-trait">' + m.trait + '</div>' +
      (mapNodeChips(m).length ? '<div class="br-nodes">' + mapNodeChips(m).map(nd =>
        '<span class="brn" style="--nc:' + ELEMENTS[nd.el].color + '">' + ELEMENTS[nd.el].icon +
        ' ' + ELEMENTS[nd.el].name + ' ' + (nd.kind === 'lane' ? 'LANE' : 'BUILD') +
        '</span>').join('') + '</div>' : '') +
      '<div class="br-rows">' +
        '<div class="br-row"><span class="br-ic" style="color:' + rv.color + '">' + rv.icon + '</span>' +
          '<span><b>' + rv.name + '</b>, ' + rv.title + ' — commands here</span></div>' +
        '<div class="br-row">' + (ar
          ? '<span class="br-ic gold">' + ar.icon + '</span><span><b>' + ar.name + '</b> — ' + ar.desc + '</span>'
          : '<span class="br-ic">—</span><span>No arena modifier</span>') + '</div>' +
        '<div class="br-row"><span class="br-ic green">' + bn.icon + '</span>' +
          '<span>Victory boon: <b>' + bn.name + '</b> — ' + bn.desc + '</span></div>' +
        (o.escStart ? '<div class="br-row esc"><span class="br-ic">☠</span>' +
          '<span>Opens with <b>' + o.escStart + '</b> escalation' + (o.escStart > 1 ? 's' : '') + ' already active</span></div>' : '') +
      '</div>' +
    '</div>';
  },

  /** Miniature of a battlefield: every lane on both sides, plus terrain. */
  mapThumb(m) {
    const f = buildField(m);
    const w = 300, h = Math.round(300 * m.rows / m.cols);
    const sx = w / m.cols, sy = h / m.rows;
    const line = (pts, col, wid) => `<path d="${pts.map(([x, y], i) =>
      `${i ? 'L' : 'M'}${((x + 0.5) * sx).toFixed(1)},${((y + 0.5) * sy).toFixed(1)}`).join(' ')}"
      fill="none" stroke="${col}" stroke-width="${wid}" stroke-linejoin="round" stroke-linecap="round"/>`;
    /* lanes[side] is an ARRAY of lanes — a map may fork, and a tri board has
       a third side whose lane used to be left off the thumbnail entirely. */
    const lanes = f.lanes.map((side, i) => side.map(l =>
      line(l, LANE_TINTS[i] || LANE_TINTS[LANE_TINTS.length - 1], 6)).join('')).join('');
    const rubble = [...f.terrain].map(k => {
      const [gx, gy] = k.split(',').map(Number);
      return `<rect x="${(gx * sx).toFixed(1)}" y="${(gy * sy).toFixed(1)}"
        width="${sx.toFixed(1)}" height="${sy.toFixed(1)}" fill="#1b2230"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <rect width="${w}" height="${h}" fill="#0b1018"/>
      ${rubble}
      ${f.tri ? '' : `<rect x="${f.neutral.from * sx}" y="0"
            width="${(f.neutral.to - f.neutral.from + 1) * sx}"
            height="${h}" fill="#1a1430" opacity="0.75"/>`}
      ${lanes}
      ${(f.nodes || []).map(n => `<circle cx="${((n.gx + 0.5) * sx).toFixed(1)}" cy="${((n.gy + 0.5) * sy).toFixed(1)}"
        r="${(Math.min(sx, sy) * (n.kind === 'lane' ? 0.30 : 0.44)).toFixed(1)}"
        fill="${ELEMENTS[n.el].color}" fill-opacity="${n.kind === 'lane' ? 0.9 : 0.35}"
        stroke="${ELEMENTS[n.el].color}" stroke-width="1.6"/>`).join('')}
    </svg>`;
  },

  /* ══════════════════════════════════════════════ SCREEN 3 — LOADOUT ═══ */

  /* ═════════════════════════════ PROGRESSIVE TOWER CARDS ═══ */

  /**
   * The printed statistics of a tower, ONE formatter.
   *
   * The expanded loadout card and the soul-shop firing preview both print
   * them, and every value is read straight off `t.base` -- the same table the
   * engine builds a tower from. Two renderers each formatting the same facts
   * is one more place for the number on screen to drift from the number the
   * simulation uses.
   */
  towerStatRows(id) {
    const t = TOWER_TYPES[id], b = t.base;
    /* Cones and beams bill damage per second and have no discrete cadence, so
       printing a "fire rate" for them would be inventing one. */
    const sustained = t.attack === 'cone' || t.attack === 'beam';
    return [
      ['Damage', b.damage ? b.damage + (sustained ? ' /sec' : '')
                          : (b.droneDamage ? b.droneDamage + ' × ' + b.drones : '—')],
      ['Fire rate', sustained ? 'sustained' : (b.rate ? b.rate.toFixed(2) + ' /s' : '—')],
      ['Range', (b.range || 0).toFixed(1) + ' tiles'],
      ['Type', b.dmgType || 'special'],
      ['Price growth', '×' + appliedGrowth(t).toFixed(2) + ' per copy']
    ];
  },

  /**
   * One loadout card.
   *
   * AT REST it carries four facts -- glyph, name, cost, origin mark -- because
   * the screen's actual problem is that 39 cards each showing a full stat
   * block is a wall on first glance. Everything else renders into
   * `.lo-detail`, which stays collapsed to nothing until the card is hovered,
   * focused or tapped.
   *
   * The card sits INSIDE a fixed-height `.lo-slot` and is positioned within
   * it, so opening one cannot move its neighbours: the grid measures slots,
   * and a slot never changes size.
   */
  loadoutCardHTML(id, sel) {
    const t = TOWER_TYPES[id];
    const el = ELEMENTS[t.element];
    const o = originOf(id);
    const idx = sel.indexOf(id);
    return `<div class="lo-slot" data-slot="${id}">
      <button class="lo-card ${idx >= 0 ? 'on' : ''}" data-lo="${id}"
              style="--tc:${t.color}; --cc:${o.color}" aria-expanded="false">
        <span class="lo-rest">
          <span class="lo-figure">${this.towerIconHTML(id, 40)}${
            idx >= 0 ? `<span class="lo-num">${idx + 1}</span>` : ''}</span>
          <span class="lo-id">
            <span class="lo-top"><b>${t.name}</b></span>
            <span class="lo-meta"><span class="lo-og" style="--og:${o.color}">${
              o.icon} ${o.short}</span><em>◈${t.cost}</em></span>
          </span>
        </span>
        <span class="lo-detail"><span class="lo-detail-in">
          <span class="lo-role">${t.role}</span>
          <span class="lo-chips"><span class="elem-badge" style="--el:${el.color}">${
            el.icon} ${el.name}</span>${this.originBadge(id)}</span>
          <span class="lo-stats">${this.towerStatRows(id).map(r =>
            `<i><span>${r[0]}</span><b>${r[1]}</b></i>`).join('')}</span>
          <span class="lo-desc">${t.desc}</span>
          <canvas class="lo-stage" data-stage="${id}" width="286" height="86"></canvas>
        </span></span>
      </button>
    </div>`;
  },

  /** Expand one card, over the top of the grid rather than inside it. */
  openLoadoutCard(slot) {
    if (!slot || this._loOpen === slot) return;
    this.closeLoadoutCard();
    this._loOpen = slot;
    /* Open UPWARD when opening downward would run off the bottom of the
       window: on the last row the panel otherwise lands on the DEPLOY button.
       A collapsed panel still reports its full content height through
       scrollHeight, so the direction is decided before the animation starts
       rather than halfway through it. */
    const inner = slot.querySelector('.lo-detail-in');
    const grow = (inner ? inner.scrollHeight : 0) + LO_CARD_EDGE_PAD;
    const r = slot.getBoundingClientRect();
    slot.classList.toggle('up',
      r.bottom + grow > window.innerHeight && r.top - grow > LO_CARD_EDGE_PAD);
    slot.classList.add('open');
    const card = slot.querySelector('.lo-card');
    if (card) card.setAttribute('aria-expanded', 'true');
    /* The soul shop's firing preview, hosted inside the card. A tooltip that
       follows the pointer would land on top of the very card it describes. */
    const cv = slot.querySelector('.lo-stage');
    if (cv) this.runTowerPreview(cv, slot.dataset.slot);
  },

  closeLoadoutCard() {
    const slot = this._loOpen;
    this._loOpen = null;
    if (!slot) return;
    slot.classList.remove('open', 'up');
    const card = slot.querySelector('.lo-card');
    if (card) card.setAttribute('aria-expanded', 'false');
    /* The preview draws into a canvas this card owns; left running past the
       collapse it costs a frame every frame for nothing on screen. */
    this.stopTowerPreview();
  },

  /** Hover, keyboard focus and touch all reach the same expansion. */
  bindLoadoutCards() {
    const grid = $('#loadout-grid');
    if (!grid) return;
    $$('.lo-slot', grid).forEach(slot => {
      const card = slot.querySelector('.lo-card');
      const id = slot.dataset.slot;
      card.addEventListener('mouseenter', () => { Sound.play('hover'); this.openLoadoutCard(slot); });
      card.addEventListener('mouseleave', () => { if (!card.matches(':focus')) this.closeLoadoutCard(); });
      card.addEventListener('focus', () => this.openLoadoutCard(slot));
      /* A re-render detaches the focused card; a blur from a node that is no
         longer in the document must not close the card that replaced it. */
      card.addEventListener('blur', () => {
        if (card.isConnected && !card.matches(':hover')) this.closeLoadoutCard();
      });
      /* Touch has no hover, so the FIRST tap opens the card and only the
         second commits the pick -- otherwise a phone player selects a tower
         whose detail they were given no way to read. */
      card.addEventListener('pointerdown', ev => {
        const coarse = ev.pointerType === 'touch' || ev.pointerType === 'pen';
        this._loTapPending = (coarse && this._loOpen !== slot) ? slot : null;
        if (coarse) this.openLoadoutCard(slot);
      });
      card.addEventListener('click', ev => {
        if (this._loTapPending === slot) { this._loTapPending = null; return; }
        if (!Meta.isTowerUnlocked(id)) { Sound.play('denied'); return; }
        const i = this.sel.loadout.indexOf(id);
        if (i >= 0) this.sel.loadout.splice(i, 1);
        else if (this.sel.loadout.length < this.loadoutTarget()) this.sel.loadout.push(id);
        else { Sound.play('denied'); return; }
        /* The whole grid is rebuilt below. Without this the card under the
           cursor sits collapsed until the pointer happens to move again. */
        this._loKeep = id;
        /* A KEYBOARD pick has the same problem and worse: the re-render
           destroys the focused button, focus falls back to the document body,
           and the next Tab restarts at the top of the page -- so picking five
           towers by keyboard means walking the whole grid five times. Only a
           keyboard pick asks for focus back; a mouse user would just be given
           a focus ring they never asked for. */
        this._loRefocus = ev.detail === CLICK_DETAIL_KEYBOARD;
        Sound.play('click'); this.renderLoadout();
      });
    });
    const keep = this._loKeep; this._loKeep = '';
    const refocus = this._loRefocus; this._loRefocus = false;
    if (keep) {
      const slot = grid.querySelector('.lo-slot[data-slot="' + keep + '"]');
      this.openLoadoutCard(slot);
      /* The REPLACEMENT for the button the pick destroyed. Focused after the
         open, so the focus handler finds the card already expanded and does
         nothing. Plain focus(), not preventScroll: the re-render also reset
         the grid's scroll, and scrolling the card back under the reader's eye
         is the other half of not losing their place. */
      const card = slot && slot.querySelector('.lo-card');
      if (refocus && card && card.focus) card.focus();
    }
  },

  renderLoadout() {
    /* The grid is about to be replaced wholesale, so a card left open -- and
       the preview loop drawing into its canvas -- is holding nodes that will
       not exist a line from now. */
    this._loOpen = null;
    this.stopTowerPreview();
    /* A stale selection (another profile, an earlier campaign, a tower no
       longer owned) must never wedge the deploy button. */
    this.sel.loadout = this.sel.loadout.filter(id => Meta.isTowerUnlocked(id));
    const sel = this.sel.loadout;
    /* Only what you actually own. Rendering the locked two-thirds of the roster
       filled the grid with cards whose lock badge collided with their own title,
       and offered nothing but a wall of things you cannot pick. What you can
       unlock belongs in the Soul Shop, which is where you spend souls. */
    const owned = TOWER_ORDER.filter(id => Meta.isTowerUnlocked(id));
    const lockedCount = TOWER_ORDER.length - owned.length;
    /* Grouped by TECH ORIGIN so 39 towers read as five arsenals instead of
       one list. Order, colour, glyph and rule all come from factions.js --
       an origin you own nothing from prints no heading at all. */
    const byOrigin = {};
    for (const id of owned) {
      const oid = originOf(id).id;
      (byOrigin[oid] = byOrigin[oid] || []).push(id);
    }
    const grid = $('#loadout-grid');
    /* The three geometry numbers live in config.js and reach the CSS from
       here, so the height the layout reserves and the height the open/close
       maths measures against are the same number by construction. (The word
       for a linked .css file is banned in these sources: build.js aborts the
       bundle if it survives into the output.) */
    grid.style.setProperty('--lo-rest-h', LO_CARD_REST_H + 'px');
    grid.style.setProperty('--lo-expand', LO_CARD_EXPAND_MS + 'ms');
    grid.innerHTML = ORIGIN_ORDER.filter(oid => byOrigin[oid]).map(oid => {
      const o = TOWER_ORIGINS[oid], n = byOrigin[oid].length;
      return `<div class="lo-family" style="--og:${o.color}">
          <span class="lo-fam-mark">${o.icon}</span><b>${o.name}</b>
          <span class="lo-fam-rule">${o.rule}</span>
          <span class="lo-fam-n">${n} ${n === 1 ? 'tower' : 'towers'}</span>
        </div>` + byOrigin[oid].map(id => this.loadoutCardHTML(id, sel)).join('');
    }).join('') + (lockedCount
      ? `<div class="lo-locked-note">
           <b>${lockedCount} more ${lockedCount === 1 ? 'tower' : 'towers'} in the arsenal</b>
           <p>Unlock them with souls in the SOUL SHOP &mdash; open it from here.</p>
           <button class="btn" id="btn-loadout-souls">&#9673; SOUL SHOP</button>
         </div>`
      : '');
    this.paintTowerIcons(grid);
    /* The note used to name a screen ("on the title screen") and the shop had
       already moved twice. A control that OPENS the overlay cannot go stale,
       and the grid redraws so a purchase appears immediately. */
    const loSouls = $('#btn-loadout-souls');
    if (loSouls) loSouls.addEventListener('click', () => this.openSoulShop(() => this.renderLoadout()));
    this.bindLoadoutCards();
    const unlockedCount = Meta.unlockedTowers().length;
    $('#loadout-unlocked').innerHTML =
      `<span class="chip" data-tt="ARSENAL|You have unlocked ${unlockedCount} of ${TOWER_ORDER.length} towers. Unlock more with souls in the SOUL SHOP — the button below the grid opens it, and the commander screen carries the same one.">▲ ${unlockedCount}/${TOWER_ORDER.length} unlocked</span>` +
      `<span class="chip" data-tt="SOULS|Souls buy three things in the SOUL SHOP: recruit a commander, unlock a commander's second ability, and add a tower to your arsenal. Tower mastery is earned in battle, never bought.">◉ ${Meta.souls()}</span>`;
    this.bindChipTips($('#loadout-unlocked'));
    $('#loadout-count').textContent = `${sel.length} / ${this.loadoutTarget()}`;
    $('#loadout-count').className = sel.length === this.loadoutTarget() ? 'lo-count ready' : 'lo-count';
    $('#btn-deploy').disabled = sel.length !== this.loadoutTarget();
    this.renderTowerTalents();
    this.renderMusterLoadout();

    /* Warn about the two coverage holes that actually lose games. */
    const hasAir = sel.some(id => !TOWER_TYPES[id].groundOnly);
    const hasNonMagic = sel.some(id => TOWER_TYPES[id].base.dmgType === 'physical');
    const hasMagic = sel.some(id => ['magic', 'pure'].includes(TOWER_TYPES[id].base.dmgType) || TOWER_TYPES[id].base.poisonDps);
    const warn = [];
    if (!hasAir) warn.push('Nothing in this loadout can hit a flyer.');
    if (!hasMagic) warn.push('No magic damage — armoured Palisades and Ironmarches will be very slow to kill.');
    if (!hasNonMagic) warn.push('No physical damage — a Nullifier is immune to everything you brought.');

    /* Which elemental reactions this loadout can actually produce. The combo
       system is invisible until a player is shown, at the moment of choosing,
       that two of their picks talk to each other. */
    const els = [...new Set(sel.map(id => TOWER_TYPES[id].element))];
    const pairs = [];
    for (const a of els) for (const b of els) {
      if (a === b) continue;
      const combo = COMBOS[a] && COMBOS[a][b];
      if (combo && !pairs.some(p => p.id === combo.id)) pairs.push(combo);
    }

    /* Warnings are only meaningful once something is actually selected -- they
       used to all fire at 0/5, before the player had picked anything. */
    $('#loadout-warn').innerHTML = !sel.length
      ? '<div class="lo-hint">Pick five towers. Warnings about coverage gaps appear as you build the set.</div>'
      : (warn.length
          ? warn.map(w => `<div class="lo-warn">⚠ ${w}</div>`).join('')
          : '<div class="lo-ok">✓ This loadout covers air, armour and magic immunity.</div>')
        + (pairs.length
            ? `<div class="lo-combos"><b>REACTIONS AVAILABLE</b>${pairs.map(c =>
                 `<span class="chip" data-tt="${c.name}|${c.desc}">${c.name}</span>`).join('')}</div>`
            : (els.some(e => ELEMENTS[e].marks)
                ? '<div class="lo-hint">No elemental reactions — these towers share elements, or their partners are missing. Overlap two DIFFERENT marking elements on the same stretch of lane to trigger one.</div>'
                : '<div class="lo-hint">Nothing here marks. Kinetic and Radiant deal straight damage and never trigger reactions.</div>'));
    this.bindChipTips($('#loadout-warn'));
  },

  /**
   * MUSTER DETACHMENT — which saved denizens deploy with you. Unlocked mobs
   * are picks (up to MUSTER_LOADOUT_SIZE); locked ones are greyed and name
   * the battlefields whose worlds save them. Every number shown is produced
   * by musterTierFor, the SAME derivation the battle uses — a preview that
   * disagrees with the engine is the bug class this project shipped 3 times.
   */
  renderMusterLoadout() {
    const wrap = $('#muster-loadout');
    if (!wrap) return;
    const unlocked = Meta.musterUnlocked();
    const picked = Meta.musterLoadout();
    /* A locked entry is only shown when some world can actually save it. */
    const savable = [...new Set(MAPS.flatMap(m => m.denizens || []))]
      .filter(id => musterSendable(id) && !unlocked.includes(id));
    const byHp = (a, b) => ENEMY_TYPES[a].hp - ENEMY_TYPES[b].hp;
    unlocked.sort(byHp); savable.sort(byHp);
    const homes = id => MAPS.filter(m => (m.denizens || []).includes(id)).map(m => m.name).join(' or ');

    const card = (id, locked) => {
      const def = ENEMY_TYPES[id];
      const tier = musterTierFor(id);
      const on = picked.includes(id);
      if (locked) {
        return `<div class="mlo-card lockd" data-tt="${def.name} — LOCKED|Conquer (★★★) a world fought on ${homes(id)} to save its denizens for your own musters.">
          <span class="mlo-dot" style="--tc:${def.color}"></span>
          <span class="mlo-name">${def.name}</span><em>save ${homes(id)} worlds</em></div>`;
      }
      return `<button class="mlo-card ${on ? 'on' : ''}" data-mlo="${id}"
        data-tt="${def.name} — ${tier.name}|Sends ${tier.count} at a time for roughly ${Math.round(tier.cost * 100)}% of a wave reward, adding +${Math.round(tier.incomePct * 100)}% wave income per muster.">
        ${on ? `<span class="mlo-num">${picked.indexOf(id) + 1}</span>` : ''}
        <span class="mlo-dot" style="--tc:${def.color}"></span>
        <span class="mlo-name">${def.name}</span>
        <em>${tier.count}× · +${Math.round(tier.incomePct * 100)}% · ${tier.name}</em>
      </button>`;
    };
    wrap.innerHTML = `<div class="mlo-head"><b>MUSTER DETACHMENT</b>
        <span>${picked.length} / ${Math.min(MUSTER_LOADOUT_SIZE, unlocked.length)} picked</span>
        <em>saved denizens march for you — conquer worlds to save more</em>
      </div>
      <div class="mlo-grid">${unlocked.map(id => card(id, false)).join('')}${savable.map(id => card(id, true)).join('')}</div>`;
    wrap.querySelectorAll('[data-mlo]').forEach(b => {
      b.addEventListener('click', () => {
        if (!Meta.toggleMuster(b.dataset.mlo)) { Sound.play('denied'); return; }
        Sound.play('click');
        this.renderMusterLoadout();
      });
      b.addEventListener('mouseenter', () => Sound.play('hover'));
    });
    this.bindChipTips(wrap);
  },

  /**
   * A miniature talent tree per selected tower, prepared before the match.
   * Two points each, and the lower row needs a point in the upper row first.
   */
  renderTowerTalents() {
    const sel = this.sel.loadout;
    const wrap = $('#tower-talents');
    if (!sel.length) {
      wrap.innerHTML = '<p class="hint">Select towers above to prepare their talents.</p>';
      return;
    }
    wrap.innerHTML = sel.map(id => {
      const def = TOWER_TYPES[id];
      const spent = Meta.talentSpent(id);
      /* Render every row the tower actually defines, not a fixed two. */
      const rowIds = [...new Set(def.talents.map(t => t.row))].sort();
      const rows = rowIds.map(row => {
        const cols = [...new Set(def.talents.filter(t => t.row === row).map(t => t.col))].sort();
        const cells = cols.map(col => {
          const n = def.talents.find(t => t.row === row && t.col === col);
          if (!n) return '<div class="tt-cell empty"></div>';
          const owned = Meta.hasTalent(id, n.id);
          const reason = Meta.talentLockReason(id, n.id);
          const can = reason === null;
          const mReq = Meta.talentMasteryReq(n);
          const mLock = Meta.masteryOf(id) < mReq;
          return `<button class="tal-node sm ${owned ? 'owned' : can ? 'can' : 'locked'}"
                    data-talent="${id}:${n.id}" ${owned || !can ? 'disabled' : ''} style="--cc:${def.color}"
                    title="${n.desc}${owned ? '' : reason ? ' — ' + reason : ''}">
              <span class="tal-rank">${owned ? '1/1' : mLock ? 'M' + mReq : '0/1'}</span>
              <span class="tal-tname">${mLock && !owned ? '🔒 ' : ''}${n.name}</span>
              <span class="tal-tdesc">${n.desc}</span>
            </button>`;
        }).join('');
        /* A row needs a point invested in the row directly above it. */
        const gated = row > 0 && !def.talents.filter(t => t.row === row - 1).some(t => Meta.hasTalent(id, t.id));
        /* The grid follows the ROW. A hard two columns orphaned RAMPART's
           third middle-row talent onto a line of its own, half-width and
           adrift from the pair it belongs to. */
        return `<div class="tt-row ${gated ? 'row-locked' : ''}" style="--tt-cols:${cols.length}">${cells}</div>`;
      }).join('');
      const stock = Meta.usingDefaults(id);
      const mp = Meta.masteryProgress(id);
      return `<div class="tt-tree" style="--tc:${def.color}">
        <div class="tt-head-row">
          <span class="tt-icon">${this.towerIconHTML(id, 30)}</span>
          <b>${def.name}</b>
          <span class="tt-mastery" data-tt="MASTERY ${mp.level}|Earn mastery by fighting with this tower. Higher mastery unlocks deeper talents.">M${mp.level}</span>
          ${stock ? '<span class="tt-stock">stock build</span>' : ''}
          <span class="tt-pts ${spent === TALENT_POINTS ? 'full' : ''}">${spent}/${TALENT_POINTS}</span>
          <button class="icon-btn sm" data-clear-talent="${id}" title="Clear">↺</button>
        </div>
        ${rows}
      </div>`;
    }).join('');

    this.paintTowerIcons(wrap);
    $$('[data-talent]').forEach(b => b.addEventListener('click', () => {
      const [tower, tid] = b.dataset.talent.split(':');
      if (Meta.takeTalent(tower, tid)) { Sound.play('tech'); this.renderTowerTalents(); }
      else Sound.play('denied');
    }));
    $$('[data-clear-talent]').forEach(b => b.addEventListener('click', () => {
      Meta.clearTalents(b.dataset.clearTalent); Sound.play('sell'); this.renderTowerTalents();
    }));
  },

  /* ═══════════════════════════════════════════════════════ BATTLE UI ═══ */

  buildShop() {
    const keys = ['1', '2', '3', '4', '5'];
    this.el.shop.innerHTML = Game.sides[0].loadout.map((id, i) => {
      const t = TOWER_TYPES[id];
      /* The shop's five cards carry their ORIGIN colour on the machined top
         rule, exactly as the loadout family headings do, so the same five
         arsenals read the same way in battle. The shop card is a different
         component from the loadout card (.tower-card vs .lo-card) and already
         rests minimal at five entries, so it needs no disclosure of its own. */
      return `<button class="tower-card" data-tower="${id}" style="--tc:${t.color}; --cc:${originOf(id).color}">
        <span class="tc-key">${keys[i]}</span>
        <span class="tc-mini">${this.towerIconHTML(id, 30)}</span>
        <span class="tc-main">
          <span class="tc-name">${t.name}<i class="tc-og" style="--og:${
            originOf(id).color}" title="${originOf(id).name} — ${originOf(id).rule}">${
            originOf(id).icon}</i></span>
          <span class="tc-role">${t.role}</span>
        </span>
        <span class="tc-cost" data-cost="${id}">◈${t.cost}</span>
      </button>`;
    }).join('');
    this.paintTowerIcons(this.el.shop);
    $$('[data-tower]').forEach(b => {
      const id = b.dataset.tower;
      b.addEventListener('click', () => {
        Sound.resume();
        Game.selectedType = Game.selectedType === id ? null : id;
        Game.selected = null; Sound.play('click'); this.syncAll();
      });
      b.addEventListener('mouseenter', ev => { Sound.play('hover'); this.showTooltip(ev, this.towerTooltip(id)); });
      b.addEventListener('mousemove', ev => this.moveTooltip(ev));
      b.addEventListener('mouseleave', () => this.hideTooltip());
    });
  },

  towerTooltip(id) {
    const t = TOWER_TYPES[id], b = t.base;
    const owned = Game.sides[0].countOf(id);
    const rows = [];
    if (b.damage) rows.push(['Damage', b.damage + (t.attack === 'cone' || t.attack === 'beam' ? ' /sec' : '')]);
    if (b.droneDamage) rows.push(['Drones', b.droneDamage + ' × ' + b.drones]);
    if (b.rate && !['cone', 'beam'].includes(t.attack)) rows.push(['Fire rate', b.rate.toFixed(2) + ' /s']);
    rows.push(['Range', (b.range || 0).toFixed(1) + ' tiles']);
    if (b.dmgType && b.dmgType !== 'none') rows.push(['Type', b.dmgType]);
    if (b.splash) rows.push(['Splash', b.splash.toFixed(2)]);
    if (b.income) rows.push(['Income', `◈${b.income}/${b.incomeEvery}s`]);
    rows.push(['Owned', owned + ' — next costs ◈' + Game.towerCost(0, id)]);
    const el = ELEMENTS[t.element];
    return `<div class="tt-head" style="color:${t.color}">${t.name}<span class="tt-cost">◈${Game.towerCost(0, id)}</span></div>
      <div class="tt-figure">${this.towerIconHTML(id, 54)}
        <span class="elem-badge" style="--el:${el.color}">${el.icon} ${el.name}</span>
        ${this.originBadge(id)}</div>
      <div class="tt-role">${t.role}</div>
      <div class="tt-origin" style="--og:${originOf(id).color}"><b>${originOf(id).rule}</b> — ${originOf(id).desc}</div>
      <p class="tt-desc">${t.desc}</p>
      <div class="tt-stats">${rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
      ${t.groundOnly ? '<div class="tt-warn">⚠ Cannot target flying enemies</div>' : ''}
      ${t.airOnly ? '<div class="tt-warn">⚠ Can ONLY target flying enemies</div>' : ''}
      <div class="tt-foot">Price rises <b>×${appliedGrowth(t, Game.sides[0].traits.costGrowthMul).toFixed(2)}</b> with each copy you own.</div>`;
  },

  /* ---- inspector: rebuilt only when its signature changes ------------- */

  /* FIGURES THAT MOVE WITH NOTHING CLICKED.
     The inspector is rebuilt only when inspectorKey changes, and these five
     cannot be keyed: a damage counter changes on almost every shot, so a key
     term for it would blow away and rebind the panel -- and the buttons under
     the cursor -- many times a second, which is the regression the header
     comment of this file exists to prevent. So they are printed through ONE
     table and re-read from the SAME table by syncLiveFigures. The template
     and the live refresh are the same expression, so they cannot drift apart
     in format the way "1.2k" and "1200" would. Each entry returns null when
     its row is not on screen, and the refresher skips null.
     Before this, all five froze: Damage/Kills/Earned/Drain stayed at their
     render-time values for an entire wave of combat, and the BANKED interest
     preview read +42 while the engine credited +357. BATCH-A/numbers */
  liveFigures: {
    dmg:    t => t ? formatNum(t.damageDealt) : null,
    kills:  t => t ? String(t.kills) : null,
    earned: t => t ? '◈' + formatNum(t.goldMade) : null,
    drain:  t => (t && t.stats.drainPer)
                 ? Math.round(t.drainMeter || 0) + '/' + t.stats.drainPer : null,
    /* Interest is credited through awardGold like everything else, so the
       preview runs the same transform or it under-reports the bank. */
    bank:   () => '+' + formatNum(Game.previewGold(0,
              interestOn(Game.sides[0].gold, Game.wave + 1, Game.sides[0].mods.interest)))
  },

  /** The printed form of one live figure. Panels call it; so does the refresh. */
  liveFigure(id, t) {
    const f = this.liveFigures[id];
    const v = f ? f(t) : null;
    return v == null ? '' : v;
  },

  inspectorKey() {
    const t = Game.selected;
    /* Resonance and the clearance ledger are per side now, so the signature
       has to watch the PLAYER's, not the union -- a rival demolishing a tile
       must not repaint the player's panel with the player's own figures. */
    if (!t) return ['wave', Game.wave, Game.enemies.filter(e => e.reanimated).length,
                    Game.sides[0].enrage || 0, Game.sides[0].enrageSpent || 0,
                    Game.waveRunning ? 1 : 0,
                    Game.sides[0].gold >= Game.enrageCost(0) ? 1 : 0,
                    (Game.selectedRubble || []).join('.'), Game.sides[0].cleared.size,
                    (Game.selectedNode || []).join('.'),
                    Game.sides[0].gold >= Game.clearCostNow(0) ? 1 : 0].join(':');
    /* The ability pulse MUST be part of the signature. Without it the panel
       kept showing pre-ability numbers for the whole duration, which read as
       "the commander skill does nothing" even though the damage was applied. */
    const p = Game.sides[t.side].pulse || {};
    /* JAM belongs in the signature too. Relocation downtime expires with gold
       static and nothing else in the key moving, so the "JAMMED -- offline"
       banner stayed up until something unrelated happened to shift the key.
       Same recurrence for JAMMER enemies. */
    /* A barricade's wall is the only figure on an inspector that moves with
       nothing clicked, so the panel is allowed to follow it -- bucketed to
       INSPECTOR_WALL_STEPS so grinding a wall down does not rebuild the panel
       (and the buttons under the cursor) every frame. */
    const wall = (t.wallList || []).map(w =>
      Math.round(w.hp / Math.max(1, w.maxHp) * INSPECTOR_WALL_STEPS)
      + '.' + (w.held || 0) + '.' + (w.overflow || 0)).join(',');
    /* And the REBUILD COUNTDOWN. With no wall standing the panel prints
       "rebuilding Ns" -- a number that, without a term here, never counts
       down, which is exactly the defect class this patch exists to kill.
       Whole seconds, so it ticks once a second and only while a barricade
       with no wall up is the selected tower. */
    const wallWait = t.wallList && !t.wallList.length ? Math.ceil(t.wallT || 0) : '-';
    /* livesRestored is the one live figure that makes a ROW APPEAR rather
       than change, and no in-place text refresh can create a node that was
       never rendered. It moves once per life restored, so keying on it costs
       nothing. */
    return [t.gx, t.gy, t.side, t.level, t.branch ? t.branch.id : '-', t.asc,
            t.rolls.length, t.targetMode, t.pendingBranch ? 'pb' : '-',
            t.livesRestored || 0,
            /* the origin riders are LIVE state -- a lattice link formed by the
               tower next door, or a pirate heat bank filling, must repaint the
               panel or it reads as the origin doing nothing. */
            t.lattice || 0, t.heat || 0,
            (p.damage || 1).toFixed(2), (p.rate || 1).toFixed(2), (p.range || 1).toFixed(2),
            Game.movingTower === t ? 'mv' : '-',
            t.jamTimer > 0 ? 'jam' : '-', t.sabLingerT > 0 ? 'sab' : '-', wall, wallWait,
            Game.sides[0].gold > (t.nextUpgrade().cost || 0) ? 1 : 0].join(':');
  },

  renderInspector(force) {
    const key = this.inspectorKey();
    if (!force && key === this._inspKey) return;
    this._inspKey = key;
    const t = Game.selected;
    this.el.inspector.innerHTML = t ? this.towerPanel(t)
      : (Game.selectedRubble ? this.rubblePanel()
      : (Game.selectedNode ? this.nodePanel() : this.wavePanel()));
    if (t) { this.bindTowerPanel(t); return; }
    const dm = $('#btn-demolish');
    if (dm) dm.addEventListener('click', () => {
      const r = Game.selectedRubble;
      if (r && Game.clearTerrain(0, r[0], r[1])) Game.selectedRubble = null;
      this.renderInspector(true);
    });
    const er = $('#btn-enrage');
    if (er) er.addEventListener('click', () => {
      if (!Game.buyEnrage()) Sound.play('denied');
    });
    this.bindChipTips(this.el.inspector);
  },

  towerPanel(t) {
    const mine = t.side === 0;
    const s = t.stats;
    const rows = [];
    const buffed = t.aura.dmg > 0 || t.aura.rate > 0 || t.aura.range > 0;

    if (t.def.attack === 'economy') {
      rows.push(['Income', '◈' + Math.round((s.income || 0) * t.ascDamage * (t.traits.vaultBonus || 1)) + '/' + s.incomeEvery + 's', 1]);
      rows.push(['Kill skim', '◈' + Math.round((s.killCut || 0) * t.ascDamage * (t.traits.vaultBonus || 1)), 1]);
      rows.push(['Earned', this.liveFigure('earned', t), 1, 'earned']);
    } else if (t.def.attack === 'aura') {
      rows.push(['Damage aura', '+' + Math.round(s.auraDmg * 100) + '%', 1]);
      rows.push(['Rate aura', '+' + Math.round(s.auraRate * 100) + '%', 1]);
      if (s.auraRange) rows.push(['Range aura', '+' + Math.round(s.auraRange * 100) + '%', 1]);
    } else if (t.def.attack === 'barricade') {
      /* A barricade sells wall health and HOLD CAPACITY, not damage: the wall
         stops a fixed NUMBER of attackers and the overflow squeezes past. The
         panel showed a DPS figure (thorns only, usually zero) and no wall
         stats at all, so REDOUBT's 4->5 hold and 400->725 wall for 290 gold
         changed no number on screen and DEEP RANKS' "+2 more attackers" named
         a base value the game never stated.
         Wall health runs the SAME waveScaled() the Barricade constructor
         runs, so this is the wall that will actually be raised. */
      const cap = Math.max(1, Math.round(s.wallBlocks || 3));
      const walls = t.wallList || [];
      rows.push(['Wall HP', formatNum(Math.round(waveScaled((s.wallHp || 400) * (s.wallHpMul || 1)))), 1]);
      rows.push(['Holds', cap + (cap === 1 ? ' attacker' : ' attackers'), 1]);
      if ((s.walls || 1) > 1) rows.push(['Barricades', s.walls, 1]);
      rows.push(['Rebuild', ((s.wallRebuild || 8) * (s.wallRebuildMul || 1)).toFixed(1) + 's']);
      if (s.wallThorns) rows.push(['Spikes', formatNum(t.effDamageFor(s.wallThorns)) + '/s']);
      if (s.wallVuln) rows.push(['At-wall vuln', '+' + Math.round(s.wallVuln * 100) + '%']);
      if (walls.length) {
        const held = walls.reduce((a, w) => a + (w.held || 0), 0);
        const over = walls.reduce((a, w) => a + (w.overflow || 0), 0);
        rows.push(['Standing', formatNum(Math.round(walls.reduce((a, w) => a + w.hp, 0))) + ' / '
                             + formatNum(Math.round(walls.reduce((a, w) => a + w.maxHp, 0))), 1]);
        rows.push(['At the wall', held + '/' + cap * walls.length
                                + (over ? ' — ' + over + ' past' : ''), over > 0]);
      } else {
        rows.push(['Standing', t.wallT > 0 ? 'rebuilding ' + Math.ceil(t.wallT) + 's' : 'no lane in reach']);
      }
    } else {
      rows.push(['DPS', formatNum(t.estimateDps()), 1]);
      if (s.damage) rows.push([['cone', 'beam'].includes(t.def.attack) ? 'Damage/s' : 'Damage', formatNum(t.effDamage), t.aura.dmg > 0]);
      if (s.droneDamage) rows.push(['Drones', formatNum(t.effDamageFor(s.droneDamage)) + ' ×' + s.drones, 1]);
      if (s.rate && !['cone', 'beam'].includes(t.def.attack)) rows.push(['Rate', t.effRate.toFixed(2) + '/s', t.aura.rate > 0]);
    }
    rows.push(['Range', t.effRange.toFixed(2), t.aura.range > 0]);
    if (s.dmgType && s.dmgType !== 'none') rows.push(['Type', s.dmgType]);
    if (t.effSplash) rows.push(['Splash', t.effSplash.toFixed(2)]);
    if (s.chains) rows.push(['Chains', s.chains + '×' + Math.round((s.falloff || .75) * 100) + '%']);
    if (s.pull) rows.push(['Pull', (s.pull * t.effStatus).toFixed(1)]);
    if (s.ramp) rows.push(['Ramp', `+${Math.round(s.ramp * 100)}%/s →×${s.rampMax}`]);
    if (s.split) rows.push(['Beams', s.split]);
    if (s.maxMines) rows.push(['Mines', t.mines.length + '/' + s.maxMines]);
    if (s.gravity) rows.push(['Gravity', (s.gravity * t.effStatus).toFixed(1)]);
    if (s.drones) rows.push(['Drones', s.drones]);
    if (s.slow) rows.push(['Slow', Math.round(s.slow * t.effStatus * 100) + '%']);
    if (s.burn) rows.push(['Burn', Math.round(s.burn * t.effStatus) + '/s']);
    if (s.bleed) rows.push(['Bleed', Math.round(s.bleed * t.effStatus) + '/s']);
    if (s.poisonDps) rows.push(['Venom', `${Math.round(s.poisonDps * t.effStatus)}+${(s.poisonPct * 100).toFixed(1)}%×${s.maxStacks}`]);
    if (t.effPierce) rows.push(['Pierce', Math.round(t.effPierce * 100) + '%']);
    const crit = (s.crit || 0) + t.sideMods.crit;
    if (crit > 0) rows.push(['Crit', Math.round(crit * 100) + '%']);
    if (s.drainPer) rows.push(['Drain', this.liveFigure('drain', t), 1, 'drain']);

    /* --- talents prepared before the match, and random level rolls --- */
    const talents = (Game.sides[t.side].talentSets || {})[t.type] || [];
    const chosen = talents.map(x => `<span class="chip good sm" title="${x.desc}">${x.name}</span>`).join('')
      + t.rolls.map(r => `<span class="chip roll sm" title="${r.desc}">${r.name}</span>`).join('');
    const techHtml = '';

    /* --- upgrade --- */
    let upHtml = '';
    if (mine) {
      const next = t.nextUpgrade();
      if (next.kind === 'level') {
        const c = t.upgradeCost('level', next.data.cost);
        upHtml = `<button class="btn upgrade-btn ${Game.sides[0].gold >= c ? '' : 'poor'}" data-upgrade="1" data-cost="${c}">
            <span class="ub-title">UPGRADE → ${next.data.name}</span><span class="ub-cost">◈${formatNum(c)}</span></button>
          <p class="branch-note">Also grants one random minor buff.</p>`;
      } else if (next.kind === 'branch') {
        upHtml = `<div class="branch-title">${t.pendingBranch ? 'SPECIALISATION — INCLUDED WITH YOUR BASE LEVEL' : 'CHOOSE A SPECIALISATION — permanent'}</div>` +
          next.data.map((b, i) => {
            const c = t.pendingBranch ? 0 : t.upgradeCost('branch', b.cost);
            return `<button class="btn branch-btn ${Game.sides[0].gold >= c ? '' : 'poor'}" data-branch="${i}" data-cost="${c}">
                <span class="ub-title">${b.name}</span><span class="ub-cost">◈${formatNum(c)}</span></button>
              <p class="branch-note">${b.note}</p>`;
          }).join('');
      } else {
        const c = t.upgradeCost('ascend', next.cost);
        const every = t.traits.surgeEvery;
        const surging = (t.asc + 1) % every === 0;
        const paidBranch = t.branch.cost * UPGRADE_COST_SCALE;
        const ascStep = ascendCost(paidBranch, t.asc + 1) / Math.max(1, ascendCost(paidBranch, t.asc));
        upHtml = `<button class="btn upgrade-btn asc-btn ${Game.sides[0].gold >= c ? '' : 'poor'}" data-upgrade="1" data-cost="${c}">
            <span class="ub-title">ASCEND → +${t.asc + 1}</span><span class="ub-cost">◈${formatNum(c)}</span></button>
          <p class="branch-note">Compounding +${Math.round((t.traits.ascDamage - 1) * 100)}% damage, +7% rate, +3.5% range.
          The one after this costs <b>×${ascStep.toFixed(1)}</b> again — the step itself steepens.
          ${surging ? `<b class="surge-note">This one triggers a SURGE.</b>` : `SURGE every ${every}.`}</p>`;
      }
    }

    const modes = (t.isSupport || !mine) ? '' : `
      <div class="section-label">TARGETING</div>
      <div class="mode-row">${TARGET_MODES.map(m =>
        `<button class="mode-btn ${t.targetMode === m.id ? 'active' : ''}" data-mode="${m.id}" title="${m.desc}">${m.name}</button>`).join('')}</div>`;

    const pulse = Game.sides[t.side].pulse || {};
    const boosted = (pulse.damage || 1) > 1.001 || (pulse.rate || 1) > 1.001 || (pulse.range || 1) > 1.001;
    return `<div class="insp ${boosted ? 'boosted' : ''}" style="--tc:${t.def.color}">
      ${boosted ? `<div class="insp-boost">${Game.sides[t.side].commander.icon} ABILITY ACTIVE${
        (pulse.damage || 1) > 1.001 ? ` · +${Math.round((pulse.damage - 1) * 100)}% DMG` : ''}${
        (pulse.rate || 1) > 1.001 ? ` · +${Math.round((pulse.rate - 1) * 100)}% RATE` : ''}${
        (pulse.range || 1) > 1.001 ? ` · +${Math.round((pulse.range - 1) * 100)}% RANGE` : ''}</div>` : ''}
      <div class="insp-head">
        <div>
          <div class="insp-name">${t.def.name}${mine ? '' : ' <em class="rival-tag">RIVAL</em>'}</div>
          <div class="insp-tier">${t.tierName}</div>
        </div>
        <div class="tier-pips">${[1, 2, 3, 4].map(i => `<i class="${i <= Math.min(4, t.branch ? 4 : t.level) ? 'on' : ''}"></i>`).join('')}
          ${t.asc ? `<b class="asc-badge">+${t.asc}</b>` : ''}</div>
      </div>
      ${t.jammed ? '<div class="warn-flag">⊘ JAMMED — offline</div>' : ''}
      ${!t.jammed && t.sabLingerT > 0 ? `<div class="warn-flag">⊘ SABOTAGED — ${Math.round(t.sabLingerAmt * 100)}% rate for ${Math.ceil(t.sabLingerT)}s</div>` : ''}
      ${t.node ? `<div class="node-flag" style="--nc:${ELEMENTS[t.node.el].color}">${
        ELEMENTS[t.node.el].icon} ${ELEMENTS[t.node.el].name} NODE — ${
        t.nodeAttuned ? `ATTUNED · +${Math.round((NODE_ATTUNE_DAMAGE - 1) * 100)}% damage`
        : t.nodeEl ? `INFUSED · marks ${ELEMENTS[t.nodeEl].name} on every hit`
        : `RESONANT · its own mark lasts ${NODE_HOLD_MARK}s`}</div>` : ''}
      <div class="origin-flag" style="--og:${originOf(t.type).color}">${originOf(t.type).icon} ${
        originOf(t.type).name} · ${this.originStatus(t)}</div>
      ${buffed ? `<div class="aura-flag">⬆ AMPLIFIED ${t.aura.dmg ? `+${Math.round(t.aura.dmg * 100)}% dmg` : ''} ${t.aura.rate ? `+${Math.round(t.aura.rate * 100)}% rate` : ''}</div>` : ''}
      ${t.def.groundOnly ? '<div class="warn-flag">⚠ Cannot hit flyers</div>' : ''}
      ${t.def.airOnly ? '<div class="warn-flag">⚠ Air targets only</div>' : ''}
      <div class="stat-grid">${rows.map(r => `<div class="${r[2] ? 'hl' : ''}"><span>${r[0]}</span><b${
        r[3] ? ` data-live="${r[3]}"` : ''}>${r[1]}</b></div>`).join('')}</div>
      ${chosen ? `<div class="chip-row">${chosen}</div>` : ''}
      <div class="perf">
        <div><span>Damage</span><b data-live="dmg">${this.liveFigure('dmg', t)}</b></div>
        <div><span>Kills</span><b data-live="kills">${this.liveFigure('kills', t)}</b></div>
        ${t.livesRestored ? `<div><span>Lives</span><b>+${t.livesRestored}</b></div>` : ''}
      </div>
      ${techHtml}
      ${modes}
      <div class="upgrade-zone">${upHtml}</div>
      ${mine ? `<div class="insp-actions">
        <button class="btn move-btn ${Game.movingTower === t ? 'armed' : ''}" data-move="1"
                data-tt="RELOCATE|Pick this tower up and set it down anywhere you own. Keeps every level, branch and ascension. Costs ◈${
                  formatNum(Game.relocateCost(t))} and the tower is offline for ${RELOCATE_DOWNTIME}s.">${
          Game.movingTower === t ? 'CANCEL MOVE' : 'MOVE · ◈' + formatNum(Game.relocateCost(t))}</button>
        <button class="btn sell-btn" data-sell="1">SELL · ◈${formatNum(t.sellValue)}</button>
      </div>` : ''}
    </div>`;
  },

  bindTowerPanel(t) {
    const root = this.el.inspector;
    const up = $('[data-upgrade]', root);
    if (up) up.addEventListener('click', () => { Game.upgrade(t); this.renderInspector(true); });
    $$('[data-branch]', root).forEach(b => b.addEventListener('click', () => { Game.upgrade(t, +b.dataset.branch); this.renderInspector(true); }));
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { t.targetMode = b.dataset.mode; Sound.play('click'); this.renderInspector(true); }));
    const sell = $('[data-sell]', root);
    if (sell) sell.addEventListener('click', () => { Game.sell(t); this.renderInspector(true); });
    const mv = $('[data-move]', root);
    if (mv) mv.addEventListener('click', () => {
      Game.movingTower = Game.movingTower === t ? null : t;
      if (Game.movingTower) { Game.selectedType = null; Sound.play('click'); }
      this.renderInspector(true);
      this.syncShop();
    });
  },

  /** An empty terrain node: what it would do to a tower placed on it. Shown
      BEFORE anything is committed, because the decision it changes is where
      you build -- a node you only learn about after paying is a trap. */
  nodePanel() {
    const [gx, gy] = Game.selectedNode;
    const n = nodeAt(gx, gy);
    if (!n) return this.wavePanel();
    const el = ELEMENTS[n.el];
    const attunes = TOWER_ORDER.filter(id => TOWER_TYPES[id].element === n.el)
      .map(id => TOWER_TYPES[id].name);
    return `<div class="nodep" style="--nc:${el.color}">
      <div class="section-label">${n.kind === 'build' ? 'BUILD' : 'LANE'} NODE — ${gx},${gy}</div>
      <div class="np-art">${el.icon}</div>
      <div class="np-el">${el.name}</div>
      ${n.kind === 'build' ? `<p class="hint">Charged ground. Whatever you stand here is changed by it.</p>
        <div class="np-rules">
          <div><b>ATTUNED</b><span>A ${el.name} tower gains +${Math.round((NODE_ATTUNE_DAMAGE - 1) * 100)}% damage.</span></div>
          <div><b>INFUSED</b><span>A tower that marks nothing — KINETIC or RADIANT — marks ${el.name} instead.</span></div>
          <div><b>RESONANT</b><span>Any other marking tower holds its own mark ${NODE_HOLD_MARK}s instead of ${MARK_SECONDS}s.</span></div>
        </div>
        ${attunes.length ? `<div class="np-foot">Attunes: ${attunes.join(', ')}</div>` : ''}`
      : `<p class="hint">A charged stretch of lane. Anything crossing it carrying <b>no mark</b>
          leaves marked ${el.name} for ${NODE_LANE_MARK}s — half a reaction, handed over by the
          map. It never overwrites a mark one of your own towers put there.</p>
        <div class="np-foot">Ground units only. Flyers pass above it.</div>`}
    </div>`;
  },

  /** Rubble you may pay to demolish into buildable ground. */
  rubblePanel() {
    const [gx, gy] = Game.selectedRubble;
    const cost = Game.clearCostNow(0);
    /* A land card's free demolitions come out of this same allowance and can
       exhaust it -- or overshoot it, since they are granted rather than
       bought. DEMOLISH stayed live and priced afterwards, and the click was
       refused by canClear with a denied blip and no explanation. */
    const left = Math.max(0, Game.clearLimit(0) - Game.sides[0].cleared.size);
    const afford = Game.sides[0].gold >= cost;
    return `<div class="rubble">
      <div class="section-label">TERRAIN — ${gx},${gy}</div>
      <div class="rb-art">▦</div>
      <p class="hint">Collapsed rubble. Ground you cannot build on — unless you pay to have it
        hauled away. Clearing is permanent for this battle only, and never touches the lane.</p>
      <button class="btn btn-primary" id="btn-demolish" ${left && afford ? '' : 'disabled'}>
        ${left ? 'DEMOLISH · ◈' + formatNum(cost) : 'NO CLEARANCES LEFT'}</button>
      <div class="rb-foot">
        <span>${left} of ${Game.clearLimit(0)} clearances left</span>
        <span>${left ? 'next costs ◈' + formatNum(Game.clearCostAt(0, Game.sides[0].cleared.size + 1))
                     : 'a land card spent the last of them'}</span>
      </div>
    </div>`;
  },

  /** ENRAGE — spend gold to make the next wave worth more. */
  enragePanel(rage) {
    if (Game.waveRunning) {
      return rage ? `<div class="enrage live">✦ FIELD RESONATING ×${rage} — kills pay +${
        Math.round(ENRAGE_BOUNTY * rage * 100)}%</div>` : '';
    }
    const maxed = rage >= ENRAGE_MAX;
    const cost = Game.enrageCost(0);
    const afford = Game.sides[0].gold >= cost;
    return `<div class="enrage-wrap">
      <button class="enrage-btn ${maxed ? 'maxed' : ''} ${afford || maxed ? '' : 'poor'}"
              id="btn-enrage" ${maxed || !afford ? 'disabled' : ''}
              data-tt="RESONANT FIELD|Charge an ionic field over the next wave: enemies arrive ${
                Math.round(ENRAGE_HP * 100)}% tougher and every kill pays ${
                Math.round(ENRAGE_BOUNTY * 100)}% more. YOUR wave only — a rival must charge its own field, and can. Stacks up to ${ENRAGE_MAX}, and the charge never carries past this wave.">
        <span class="er-ic">✦</span>
        <span class="er-body"><b>${maxed ? 'FIELD SATURATED' : 'RESONANT FIELD'}</b>
          <em>${maxed ? `×${rage} — +${Math.round(ENRAGE_BOUNTY * rage * 100)}% bounty`
                      : `◈${formatNum(cost)} → +${Math.round(ENRAGE_HP * 100)}% HP, +${
                          Math.round(ENRAGE_BOUNTY * 100)}% gold`}</em></span>
        ${rage ? `<span class="er-stacks">×${rage}</span>` : ''}
      </button>
      <div class="bank-row" data-tt="BANKED CAPITAL|Gold you still hold when a wave finishes spawning earns ${
        Math.round(INTEREST_RATE * 100)}% interest, capped per wave. Not spending is a play.">
        <span>◈ BANKED</span><b data-live="bank">${this.liveFigure('bank')}</b><em>interest next wave</em>
      </div>
    </div>`;
  },

  wavePanel() {
    const next = Game.wave + 1;
    const p = Game.waveProfile(next);
    /* UNIT_HP_SCALE belongs here too -- omitting it made the roster preview
       understate every unit's health by 2.6x after the count/strength retune. */
    /* TWO DIFFERENT CHARGES, AND THEY MUST NOT SHARE A NAME.
       `enrage` is what is riding the wave this panel is titled after -- the
       NEXT one. It is always 0 while a wave is running (startWave zeroes it
       and buyEnrage refuses mid-wave), which is exactly right: the roster HP
       preview and the "NEXT — WAVE n" label must describe an uncharged wave,
       because that is what will spawn.
       `enrageSpent` is what the CURRENT wave is carrying, and it belongs to
       the live banner alone -- the confirmation of what the player had just
       paid for, which never once rendered because this line read the counter
       startWave had already zeroed. Feeding enrageSpent to the preview would
       fix the banner by printing next wave's roster ENRAGE_HP too high and
       labelling an uncharged wave as resonating: the same UI-number trap,
       moved one field over. Two names, two readers. */
    const rage = Game.sides[0].enrage || 0;
    const spent = (Game.waveRunning && Game.sides[0].enrageSpent) || 0;
    /* Per-type health is READ OUT of the profile instead of re-derived from
       Game.waveHpMul. The profile already carries that multiplier, the
       escalations, this wave's per-group hpScale AND the per-wave stat drift
       (game.js folds drift in so the rival's threat model sees it). The ONLY
       term left to apply here is the resonance the player just bought, which
       is theirs alone and so cannot live in a shared profile -- hence the
       name. Multiplying drift in a second time overstated every printed unit
       by (1 + drift.hp), i.e. 30-90% by wave 20; anyone re-adding a drift
       term here reintroduces exactly that. BATCH-A/numbers */
    const rageMul = (1 + ENRAGE_HP * rage);
    /* Read the profile's own answer rather than restating the rule: the
       header and the roster below it now agree by construction. */
    const isMini = !!p.miniboss;
    const list = Object.entries(p.roster).map(([type, count]) => {
      const e = ENEMY_TYPES[type];
      const traits = [];
      if (e.flying) traits.push('FLYING');
      if (e.jam) traits.push('JAMS TOWERS');
      if (e.teleport) traits.push('TELEPORTS');
      if (e.pullImmune) traits.push('IMMOVABLE');
      if (e.magicImmune) traits.push('MAGIC-IMMUNE');
      if (e.phase) traits.push('PHASES');
      if (e.revive) traits.push('REVIVES');
      if (e.armor >= 8) traits.push('ARMOURED');
      if (e.shield) traits.push('SHIELDED');
      if (e.healRate) traits.push('HEALER');
      if (e.splitInto) traits.push('SPLITS');
      const hp = (p.rosterHp[type] || 0) / Math.max(1, count) * rageMul;
      /* Somebody's soldiers read differently from the Vigil, so the preview
         names whose they are before it lists what they do. */
      if (e.faction && FACTIONS[e.faction]) traits.unshift(FACTIONS[e.faction].short.toUpperCase());
      return `<div class="roster-row" title="${e.desc}">
        <span class="dot" style="background:${e.color}"></span>
        <span class="rr-name">${e.name}</span>
        <span class="rr-traits">${traits.join(' · ')}</span>
        <span class="rr-count">×${count}</span>
        <span class="rr-hp">${formatNum(Math.round(hp))}</span></div>`;
    }).join('');

    const inbound = Game.enemies.filter(e => e.hostileTo === 0 && e.reanimated).length;
    /* YOU SENT means units the PLAYER owns, wherever they are walking. Keying
       it on `hostileTo === 1` printed half of a CONFLUENCE send (a kill there
       marches on both rivals), counted a third commander's sends at seat 1 as
       the player's, and fell permanently to zero in the arena the moment seat
       1 was eliminated and the send arc moved on. BATCH-C/nside */
    const outbound = Game.enemies.filter(e => e.owner === 0 && e.hostileTo !== 0 && e.reanimated).length;

    return `<div class="wave-info">
      <div class="attrition">
        <div class="att-cell out"><b>${outbound}</b><span>YOU SENT</span></div>
        <div class="att-arrow">⇄</div>
        <div class="att-cell in"><b>${inbound}</b><span>INBOUND</span></div>
      </div>
      <div class="section-label">NEXT — WAVE ${next}${p.boss ? '  ⚠ BOSS' : isMini ? '  ◆ MINIBOSS' : ''}${rage ? `  ✦ RESONATING ×${rage}` : ''}</div>
      <div class="wave-name ${p.boss ? 'boss' : isMini ? 'mini' : ''} ${rage ? 'enraged' : ''}">${p.name}</div>
      <div class="roster">${list}</div>
      ${this.enragePanel(Game.waveRunning ? spent : rage)}
      <div class="hint-block">
        <div class="section-label">ATTRITION</div>
        <p class="hint">Waves spawn in the <b>neutral zone</b> and hit every base identically. Everything <b>you</b> kill is reanimated and sent at your rival — reanimates never reanimate again.</p>
        <p class="hint">Each wave permanently raises one enemy stat (shown top-centre). Escalations land every <b>10</b> waves, minibosses every <b>${MINIBOSS_EVERY}</b>.</p>
      </div>
    </div>`;
  },

  /**
   * MUSTER. Both consequences are printed on the button the player presses,
   * because the whole point of the mechanic is that aggression and income are
   * the same purchase -- hiding either half turns it back into a plain send.
   *
   * The health shown is produced by `Game.musterHpMul`, the SAME function the
   * spawn calls, and the income shown is the post-ceiling delta rather than
   * the nominal step, so neither number can advertise what the send will not
   * deliver.
   */
  syncMuster() {
    const bar = $('#muster-bar');
    if (!bar) return;
    if (Game.state !== 'playing' || !Game.sides.length) {
      if (bar.dataset.mkey !== '') { bar.innerHTML = ''; bar.dataset.mkey = ''; }
      return;
    }
    const S = Game.sides[0];
    const left = MUSTER_PER_WAVE - (S.musterThisWave || 0);
    /* mods.gold belongs in the signature: a BATTLEFIELD SALVAGE draft moves
       every figure in this bar without touching the purse. */
    const key = [Game.wave, S.gold, S.musterBuys || 0, left,
                 Game.waveRunning ? 1 : 0, S.mods.gold].join(':');
    if (bar.dataset.mkey === key) return;
    bar.dataset.mkey = key;

    const w = Game.waveRunning ? Game.wave : Game.wave + 1;
    /* Two figures, per the owner's spec: BASE is the wave reward every
       commander already earns (made visible at last), MUSTER is the additive
       percent your sends have stacked on top of it. Both come from the same
       functions the wave-end payout calls, through the same Game.previewGold
       transform, so `mods.gold` cannot go missing from the preview and not
       from the payout. */
    const baseIncome = Game.previewGold(0, waveReward(w));
    const pct = Math.min(S.musterIncome || 0, MUSTER_INCOME_CAP_PCT);
    const capped = (S.musterIncome || 0) >= MUSTER_INCOME_CAP_PCT;
    const vic = Game.musterVictims(0)[0];
    const rows = Game.musterTiers(0).map(tier => {
      const base = ENEMY_TYPES[tier.type];
      const cost = Game.musterCost(0, tier);
      const gain = Game.musterGain(0, tier);
      const ok = Game.canMuster(0, tier);
      const addPct = Math.round(tier.incomePct * 100);
      /* THE ENGINE'S OWN NUMBERS, both of them.
         Game.muster sends tier.count at EVERY victim, so on a board with more
         than one the printed figure has to count them all rather than show one
         victim's slice of it -- and musterHpMul is a function OF THE VICTIM
         (traits.reanimResist, up to -60%), so two rivals do not necessarily
         receive the same unit. Where they differ the panel prints the range it
         will actually send instead of quietly quoting the first one. */
      const vics = Game.musterVictims(0);
      const sent = tier.count * Math.max(1, vics.length);
      const hps = (vics.length ? vics : [vic]).map(v => Math.round(base.hp * Game.musterHpMul(0, v)));
      const hpLo = Math.min.apply(null, hps), hpHi = Math.max.apply(null, hps);
      const hp = hpLo;
      const hpTxt = hpLo === hpHi ? formatNum(hpLo) : formatNum(hpLo) + '–' + formatNum(hpHi);
      return `<button class="muster-btn ${ok ? '' : 'poor'}" data-muster="${tier.id}"${ok ? '' : ' disabled'}
        data-tt="MUSTER — ${tier.name}|Send ${sent} × ${base.name} at ${hpTxt} health each, and add ${
          addPct}% of every wave reward to your income for the rest of the battle — worth ◈${
          formatNum(gain)} on the next wave. Sent units are damped to ${
          Math.round(MUSTER_DAMP * 100)}% and can never be reanimated again. The bonus is flat additive, capped at +${
          Math.round(MUSTER_INCOME_CAP_PCT * 100)}%.">
        <span class="mu-ic">${tier.icon}</span>
        <span class="mu-body"><b>${sent}× ${base.name.toUpperCase()} · ◈${formatNum(cost)}</b>
          <em>${tier.name} · ${hpTxt} hp → +${addPct}% (+◈${formatNum(gain)}/wave)</em></span>
      </button>`;
    }).join('');

    bar.innerHTML = `<div class="muster-head" data-tt="INCOME|Every commander earns the BASE wave reward. Musters stack a flat percent of it on top, every wave, for the rest of the battle — so aggression and economy stop being opposite choices. Pick your detachment on the loadout screen; conquer worlds to save more denizens for it.">
        <span>BASE</span><b>+◈${formatNum(baseIncome)}/wave</b>
        <span class="mu-sep">MUSTER</span><b class="${capped ? 'capped' : ''}">+${Math.round(pct * 100)}%</b>
        <em>${capped ? 'AT CAP' : left + ' left'}</em>
      </div>${rows}`;
    this.bindChipTips(bar);
  },

  /* ============================================================== SYNC */

  syncAll() { this.syncLive(); this.syncShop(); this.renderInspector(true); this.syncSpeed(); this.syncMods(); },

  syncLive() {
    const e = this.el;
    if (!Game.sides.length) return;
    this.syncAbilities();
    this.syncAfford();
    this.syncMuster();
    if (Game.selected) this.renderInspector();
    /* base-level button state */
    const bb = $('#btn-baselvl');
    if (bb && Game.sides.length) {
      const S = Game.sides[0], cost = Game.baseLevelCost(0);
      $('#bb-lvl').textContent = S.baseLevel || 1;
      $('#bb-next').textContent = '→ ' + ((S.baseLevel || 1) + 1);
      $('#bb-cost').textContent = '◈ ' + formatNum(cost);
      bb.classList.toggle('poor', S.gold < cost);
    }
    const me = Game.sides[0], ai = Game.sides[1];
    e.myGold.textContent = formatNum(me.gold);
    e.myLives.textContent = me.lives;
    e.myTowers.textContent = me.towers.length;
    e.myBar.style.width = (me.lives / me.maxLives * 100) + '%';
    e.aiGold.textContent = formatNum(ai.gold);
    /* syncTriRival has printed ♥☠ for a fallen third commander since the tri
       boards shipped; the static panel beside it printed a bare 0 and kept
       full brightness, so on the board where the first rival falls early it
       read as a rival hanging on rather than one already gone. The dim rule
       in css/polish.css was scoped `.cmdr.third.down`, which this panel can
       never match -- it is widened to `.cmdr.down` by the same patch.
       BATCH-C/nside */
    e.aiLives.textContent = ai.defeated ? '☠' : ai.lives;
    if (e.aiPanel) e.aiPanel.classList.toggle('down', !!ai.defeated);
    /* A third commander needs its own readout, not a squashed join -- and the
       moment the field is not a three-way the panel comes down, or it survives
       into the next battle showing a finished rival's name and lives. */
    if (Game.triMode) this.syncTriRival(); else this.dropTriRival();
    e.aiTowers.textContent = ai.towers.length;
    e.aiBar.style.width = (ai.lives / ai.maxLives * 100) + '%';
    e.wave.textContent = Game.wave;

    if (Game.waveRunning) {
      e.phase.textContent = 'WAVE ACTIVE';
      e.prepBar.style.width = '100%';
      e.prepBar.classList.add('running');
      e.btnRush.disabled = true;
      e.btnRush.innerHTML = '<span>WAVE ACTIVE</span>';
    } else {
      const total = prepTime(Game.wave) || 1;
      e.phase.textContent = 'BUILD · ' + Math.ceil(Game.prepTimer) + 's';
      e.prepBar.style.width = (Game.prepTimer / total * 100) + '%';
      e.prepBar.classList.remove('running');
      e.btnRush.disabled = !Game.canRush();
      /* Same transform rushWave() pays through -- see Game.previewGold. */
      e.btnRush.innerHTML = `<span>RUSH WAVE ${Game.wave + 1}</span><em>+◈${
        formatNum(Game.previewGold(0, Math.round(Game.prepTimer * RUSH_GOLD_PER_SEC)))}</em>`;
    }

    $$('[data-tower]').forEach(b => {
      const type = b.dataset.tower;
      const cost = Game.towerCost(0, type);
      b.classList.toggle('poor', me.gold < cost);
      const c = $(`[data-cost="${type}"]`, b);
      if (c) c.textContent = '◈' + formatNum(cost);
    });

    /* Refresh the panel only when its content signature actually changed. */
    this.renderInspector(false);
  },

  syncMods() {
    const me = Game.sides[0];
    if (!me) return;
    /* per-wave stat drift, named and hoverable */
    const d = Game.drift || { hp: 0, speed: 0, armor: 0 };
    $('#drift-strip').innerHTML = STAT_DRIFT.map(sd => {
      const v = d[sd.id] || 0;
      const txt = sd.id === 'armor' ? '+' + v.toFixed(1) : '+' + Math.round(v * 100) + '%';
      return `<span class="chip drift" data-tt="${sd.name}|Every wave permanently raises one random enemy statistic. Accumulated ${sd.label} bonus on all enemies: ${txt}.">
        ${sd.icon} <b>${sd.name}</b> ${txt}</span>`;
    }).join('');
    this.bindChipTips($('#drift-strip'));
    const counts = {};
    for (const m of me.taken) counts[m.id] = (counts[m.id] || 0) + 1;
    this.el.modStrip.innerHTML = Object.keys(counts).length
      ? Object.entries(counts).map(([id, n]) => {
          const m = PLAYER_MODS.find(x => x.id === id);
          return `<span class="chip good" title="${m.desc}">${m.icon}${n > 1 ? '×' + n : ''}</span>`;
        }).join('')
      : '<span class="chip empty">no doctrine</span>';
    this.el.escStrip.innerHTML = Game.enemyMods.length
      ? Game.enemyMods.map(m => `<span class="chip bad" data-tt="${m.name}|${m.desc}">${m.icon} <b>${m.name}</b></span>`).join('')
      : '<span class="chip empty">no escalations</span>';
    this.bindChipTips(this.el.modStrip.parentElement);
  },

  /** The inspector's buttons used to freeze their grey state at render time,
      so gold arriving while you hovered left an affordable upgrade looking
      unaffordable. Costs are stamped on the buttons and re-checked live. */
  syncAfford() {
    if (!Game.sides.length) return;
    const gold = Game.sides[0].gold;
    $$('[data-cost]', this.el.inspector).forEach(b =>
      b.classList.toggle('poor', gold < +b.dataset.cost));
    this.syncLiveFigures();
  },

  /** Re-read every [data-live] cell from the table the panel printed it with.
      No rebuild, so nothing under the cursor is disturbed. */
  syncLiveFigures() {
    const t = Game.selected;
    $$('[data-live]', this.el.inspector).forEach(n => {
      const f = this.liveFigures[n.dataset.live];
      if (!f) return;
      const v = f(t);
      /* null means the row belongs to a panel that is no longer on screen --
         the next renderInspector will replace it, so leave it alone. */
      if (v != null && n.textContent !== v) n.textContent = v;
    });
  },

  /** Take the third commander's panel down. It is the only HUD element created
      at runtime, so it is also the only one with no markup to fall back to:
      without this it outlived its battle and kept a dead rival on screen. */
  dropTriRival() {
    const el = $('#rival3');
    if (el) el.remove();
    /* The ladder is built at runtime for the same reason and outlives its
       battle the same way if nothing takes it down. */
    this.dropArenaLadder();
  },

  /** The second rival's panel on a three-way field. */
  syncTriRival() {
    const S = Game.sides[2];
    if (!S) return;
    let el = $('#rival3');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rival3';
      el.className = 'cmdr right third';
      /* Before the pause/speed group, or the third commander sits stranded
         past the controls instead of beside the rival it is fighting. */
      const host = $('#hud-rivals');
      host.insertBefore(el, $('.ctl-group', host));
    }
    const f = FACTIONS[S.faction] || FACTIONS.pirate;
    el.style.setProperty('--cc', f.color);
    el.classList.toggle('down', !!S.defeated);
    el.innerHTML = `<span class="cmdr-tag" style="color:${f.color}">${f.icon} ${S.commander ? S.commander.name : 'RIVAL II'}</span>
      <div class="cmdr-stats">
        <span class="s-lives">♥<b>${S.defeated ? '☠' : S.lives}</b></span>
        <span class="s-gold">◈<b>${formatNum(Math.round(S.gold))}</b></span>
        <span class="s-tow">▲<b>${S.towers.length}</b></span>
      </div>`;
    /* Past three seats the two rival panels stop being the whole story, so the
       ladder carries the rest. */
    if (Game.arenaSeats > 3) this.syncArenaLadder(); else this.dropArenaLadder();
  },

  syncShop() { $$('[data-tower]').forEach(b => b.classList.toggle('active', Game.selectedType === b.dataset.tower)); },
  syncSpeed() {
    this.el.speedBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === Game.speed));
    this.el.btnPause.textContent = Game.paused ? '▶' : '❚❚';
  },
  togglePause() { if (Game.state === 'playing') { Game.paused = !Game.paused; Sound.play('click'); this.syncSpeed(); } },
  flashGold() { const g = this.el.myGold.parentElement; g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); },

  /* ============================================================ CHOICE */

  showChoice(options) {
    const c = Game.sides[0].commander;
    this.el.choiceBody.innerHTML = `
      <div class="choice-head">
        <h2>COMMAND UPGRADE</h2>
        <p>Wave ${Game.wave} survived. ${c.name} offers ${options.length} — take one. It applies to your whole board, permanently.</p>
      </div>
      <div class="choice-grid n${options.length}">
        ${options.map((m, i) => {
          const n = Game.sides[0].taken.filter(x => x.id === m.id).length;
          return `<button class="choice-card" data-choice="${i}">
            <span class="cc-key">${i + 1}</span>
            <span class="cc-icon">${m.icon}</span>
            <span class="cc-name">${m.name}</span>
            <span class="cc-desc">${m.desc}</span>
            ${n ? `<span class="cc-stack">held ×${n} — stacks</span>` : ''}
          </button>`;
        }).join('')}
      </div>`;
    this.el.choiceOv.classList.remove('hidden');
    $$('[data-choice]').forEach(b => {
      b.addEventListener('mouseenter', () => Sound.play('hover'));
      b.addEventListener('click', () => Game.takeMod(options[+b.dataset.choice]));
    });
  },
  hideChoice() { this.el.choiceOv.classList.add('hidden'); },

  /* ======================================================= ABILITIES ==== */

  /**
   * The ability bar. Rebuilt only when the SET of abilities changes; the
   * cooldown sweep is a cheap style write on every sync so it stays smooth
   * without touching the DOM structure.
   */
  buildAbilityBar() {
    const bar = $('#ability-bar');
    if (!bar) return;
    const S = Game.sides[0];
    const list = S.abil || [];
    this._abilSig = list.map(a => a.def.id).join('|');
    bar.innerHTML = list.map((a, i) => `
      <button class="abil ${a.def.kind}${a.def.aim ? ' aimed' : ''}" data-abil="${i}"
              data-tt="${a.def.name} — ${i === 0 ? 'Q' : 'E'}|${a.def.desc}">
        <span class="ab-sweep"></span>
        <span class="ab-icon">${artImg('abil_' + a.def.id, 'ab-art', '') || a.def.icon}</span>
        <span class="ab-body"><b>${a.def.name}</b><em>${i === 0 ? 'Q' : 'E'}${a.def.aim ? ' · AIM' : ''}</em></span>
        <span class="ab-cd"></span>
      </button>`).join('') ||
      '<div class="abil-none">No commander abilities</div>';
    $$('[data-abil]', bar).forEach(b2 => b2.addEventListener('click', () => {
      /* Aimed abilities arm the cursor from here too, so the bar and the
         hotkeys cannot disagree about what pressing one means. */
      if (Game.armAbility(+b2.dataset.abil)) this.syncAbilities();
      else Sound.play('denied');
    }));
    this.bindChipTips(bar);
    this.syncAbilities();
  },

  syncAbilities() {
    const bar = $('#ability-bar');
    if (!bar) return;
    const list = Game.sides[0].abil || [];
    if (list.map(a => a.def.id).join('|') !== this._abilSig) return this.buildAbilityBar();
    for (let i = 0; i < list.length; i++) {
      const a = list[i], el = bar.children[i];
      if (!el) continue;
      const ready = a.cd <= 0 && a.active <= 0;
      el.classList.toggle('ready', ready);
      el.classList.toggle('live', a.active > 0);
      el.classList.toggle('aiming', Game.aimingAbility === i);
      const frac = a.active > 0 ? a.active / a.def.dur
                 : a.cd > 0 ? 1 - a.cd / (a.def.cd + a.def.dur) : 1;
      el.querySelector('.ab-sweep').style.transform = `scaleX(${clamp(frac, 0, 1)})`;
      const cd = el.querySelector('.ab-cd');
      cd.textContent = a.active > 0 ? Math.ceil(a.active) + 's'
                     : a.cd > 0 ? Math.ceil(a.cd) + '' : '';
    }
  },

  /* ------------------------------------------------- TECH ORIGINS ====== */

  /** The origin chip. ONE helper so the loadout card, the shop tooltip, the
      firing preview, the inspector and the soul shop cannot drift apart --
      five renderers each formatting the same fact is five chances to ship a
      different one. */
  originBadge(id) {
    const o = originOf(id);
    return `<span class="origin-badge" style="--og:${o.color}">${o.icon} ${o.name}</span>`;
  },

  /** What the origin is DOING to this specific tower, right now. Every number
      below is derived from the same constant the engine multiplies by, and
      from the same live link count, so the panel cannot promise a figure the
      simulation is not applying. */
  originStatus(t) {
    const o = originOf(t.type);
    switch (o.id) {
      case 'robotic': {
        const n = t.lattice || 0;
        return n
          ? `LATTICE ${n}/${ORIGIN_LATTICE_MAX} · +${Math.round(ORIGIN_LATTICE_DAMAGE * n * 100)}% damage · +${
              Math.round(ORIGIN_LATTICE_RATE * n * 100)}% rate`
          : 'LATTICE 0 — place another machine within ' + ORIGIN_LATTICE_TILES + ' tiles';
      }
      case 'human':
        return t.node
          ? `ADAPTIVE MOUNT — attuned to a ${ELEMENTS[t.node.el].name} node · +${
              Math.round((NODE_ATTUNE_DAMAGE - 1) * 100)}% damage`
          : 'PROVEN — no clause, no proc, the card is the number';
      case 'light':
        return `SUPPRESSION — hits strip ${Math.round(ORIGIN_LIGHT_STRIP * 100)}% resistance for ${
          ORIGIN_LIGHT_SUPPRESS}s · cannot be jammed`;
      case 'xeno':
        return `PUNISH — up to +${Math.round(ORIGIN_XENO_PUNISH * 100)}% against a nearly-dead target`;
      case 'pirate':
        return `OVERLOAD ${t.heat || 0}/${ORIGIN_PIRATE_HEAT_MAX} — ${
          Math.round(ORIGIN_PIRATE_PROC * 100)}% for ×${ORIGIN_PIRATE_MULT.toFixed(2)}, then a jam`;
      default: return o.rule;
    }
  },

  /** Wire every [data-preview] inside `root` to the live firing preview. */
  bindTowerPreviews(root) {
    if (!root) return;
    $$('[data-preview]', root).forEach(el => {
      if (el._pvBound) return;
      el._pvBound = true;
      el.addEventListener('mouseenter', ev => this.showTowerPreview(ev, el.dataset.preview));
      el.addEventListener('mousemove', ev => this.moveTooltip(ev));
      el.addEventListener('mouseleave', () => this.stopTowerPreview());
    });
  },

  /* ================================================ TOWER PREVIEW ====== */

  /**
   * A hover card that shows the tower FIRING rather than describing it.
   *
   * The soul shop asks a player to spend a scarce resource on something they
   * have never seen work. This runs a tiny self-contained loop: the real sprite,
   * a dummy target walking a straight lane, and the tower's own projectile
   * colour and cadence.
   */
  showTowerPreview(ev, id) {
    const t = TOWER_TYPES[id];
    const el = ELEMENTS[t.element];
    this.showTooltip(ev, `
      <div class="tp">
        <div class="tt-head" style="color:${t.color}">${t.name}
          <span class="tt-cost">◉ ${Meta.towerUnlockCost()}</span></div>
        <div class="tt-role">${t.role} · <span style="color:${el.color}">${el.icon} ${el.name}</span></div>
        <div class="tt-origin" style="--og:${originOf(id).color}">${originOf(id).icon} <b>${
          originOf(id).name}</b> · ${originOf(id).rule}</div>
        <canvas class="tp-stage" width="286" height="96"></canvas>
        <p class="tt-desc">${t.desc}</p>
        <div class="tt-stats">${this.towerStatRows(id).map(r =>
          `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
      </div>`);
    const cv = this.el.tooltip.querySelector('.tp-stage');
    if (cv) this.runTowerPreview(cv, id);
  },

  runTowerPreview(cv, id) {
    this.stopTowerPreview();
    const ctx = cv.getContext('2d');
    const t = TOWER_TYPES[id];
    const el = ELEMENTS[t.element];
    const W = cv.width, H = cv.height;
    const tx = 52, ty = H - 26;
    const stub = this.towerStub(id);
    let mark = 0, shots = [], age = 0, cd = 0;
    const targets = [{ x: 150, r: 9 }, { x: 214, r: 8 }, { x: 268, r: 7 }];

    const frame = () => {
      age += 1 / 60; cd -= 1 / 60;
      ctx.clearRect(0, 0, W, H);
      /* lane */
      ctx.strokeStyle = 'rgba(120,160,200,.14)'; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(0, ty - 26); ctx.lineTo(W, ty - 26); ctx.stroke();

      /* marching dummies */
      for (const g of targets) {
        g.x -= 22 / 60;
        if (g.x < 96) g.x = W + 14;
        ctx.fillStyle = '#e05555';
        ctx.beginPath(); ctx.arc(g.x, ty - 26, g.r, 0, TAU); ctx.fill();
      }
      /* the tower, drawn by its real routine */
      ctx.save(); ctx.translate(tx, ty);
      stub.age = age; stub.angle = -0.42; stub.recoil = Math.max(0, 1 - (0.5 - cd) * 4);
      try { Tower.prototype['draw_' + id].call(stub, ctx); } catch (e) {}
      ctx.restore();

      /* fire on the tower's own cadence */
      if (cd <= 0) {
        cd = 1 / Math.max(0.5, t.base.rate || 1);
        shots.push({ x: tx + 12, y: ty - 20, tx: targets[0].x, ty: ty - 26, t: 0 });
      }
      ctx.fillStyle = el.color;
      for (let i = shots.length - 1; i >= 0; i--) {
        const s2 = shots[i]; s2.t += 1 / 18;
        const x = s2.x + (s2.tx - s2.x) * s2.t, y = s2.y + (s2.ty - s2.y) * s2.t;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
        if (s2.t >= 1) {
          shots.splice(i, 1);
          ctx.fillStyle = 'rgba(255,255,255,.65)';
          ctx.beginPath(); ctx.arc(s2.tx, s2.ty, 8, 0, TAU); ctx.fill();
          ctx.fillStyle = el.color;
        }
      }
      this._tpRaf = requestAnimationFrame(frame);
    };
    frame();
  },
  stopTowerPreview() {
    if (this._tpRaf) { cancelAnimationFrame(this._tpRaf); this._tpRaf = 0; }
    this.hideTooltip();
  },

  /**
   * In-game confirmation dialog.
   *
   * `window.confirm` silently returns false inside the sandboxed iframe the
   * published artifact runs in, so everything gated on it -- prestige, extract,
   * abandon -- looked like a dead button to anyone playing the hosted build.
   * This modal is the replacement everywhere.
   */
  confirmBox(title, bodyHtml, okLabel, onOk) {
    let ov = $('#confirm-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'confirm-ov';
      ov.className = 'overlay hidden';
      ov.innerHTML = '<div class="modal cfm"><b id="cfm-title"></b><div id="cfm-body"></div>' +
        '<div class="modal-actions"><button id="cfm-ok" class="btn btn-primary"></button>' +
        '<button id="cfm-cancel" class="btn">CANCEL</button></div></div>';
      document.body.appendChild(ov);
    }
    /* Escape hides an overlay through closeTopOverlay WITHOUT running
       `done`, so a dismissed confirm left its OK handler attached and the next
       confirm ran BOTH -- and one of the two callers forfeits the campaign.
       Rebuilding the buttons here puts the strip on the way IN, the one path
       every open passes, instead of on a way out that can be skipped. */
    $('#cfm-ok').replaceWith($('#cfm-ok').cloneNode(true));
    $('#cfm-cancel').replaceWith($('#cfm-cancel').cloneNode(true));
    $('#cfm-title').textContent = title;
    $('#cfm-body').innerHTML = bodyHtml;
    $('#cfm-ok').textContent = okLabel || 'CONFIRM';
    ov.classList.remove('hidden');
    const done = ok => { ov.classList.add('hidden'); okB.replaceWith(okB.cloneNode(true)); noB.replaceWith(noB.cloneNode(true)); if (ok) onOk(); };
    const okB = $('#cfm-ok'), noB = $('#cfm-cancel');
    okB.addEventListener('click', () => done(true), { once: true });
    noB.addEventListener('click', () => done(false), { once: true });
  },

  /* ════════════════════════════════ ABILITY FLASH ═══ */

  abilityFlash(side, def) {
    const cmd = side.commander;
    let el = $('#abil-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'abil-flash';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="af-port">${commanderPortrait(cmd, 40)}</span>
      <span class="af-body"><b style="color:${cmd.color}">${cmd.name}</b>
      <em>${def.icon} ${def.name}</em></span>`;
    el.className = 'show ' + def.kind;
    clearTimeout(this._afT);
    this._afT = setTimeout(() => { el.className = ''; }, 1500);
  },

  /* ════════════════════════════════ PRE-BATTLE DIALOGUE ═══ */

  showBattleIntro(done) {
    const me = Game.sides[0], rival = Game.sides[1];
    let lines = battleDialogue(me.commander, rival.commander, me.faction);
    /* On a contested world all three commanders address the table. */
    if (Game.triMode && Game.sides[2]) {
      const third = Game.sides[2];
      const t3 = battleDialogue(me.commander, third.commander, me.faction);
      lines = [lines[0], { cmd: third.commander, side: 2, text: t3[0].text }, lines[1]];
    }
    let ov = $('#battle-intro');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'battle-intro';
      ov.className = 'overlay hidden';
      ov.innerHTML = '<div class="modal vs"><div id="bi-body"></div></div>';
      document.body.appendChild(ov);
    }
    const w = Meta.galaxy() && Meta.campaign() && Meta.campaign().chosen
      ? this.worldById(Meta.galaxy(), Meta.campaign().chosen.world) : null;
    const sit = battleSituation(w, me.faction);
    $('#bi-body').innerHTML = `
      <p class="bi-where">${sit.place} — CONTESTED</p>
      <div class="bi-heads ${Game.triMode ? 'tri' : ''}">
        <div class="bi-side you"><span>${commanderPortrait(me.commander, Game.triMode ? 66 : 84)}</span>
          <b style="color:${me.commander.color}">${me.commander.name}</b></div>
        <span class="bi-vs">VS</span>
        <div class="bi-side foe"><span>${commanderPortrait(rival.commander, Game.triMode ? 66 : 84)}</span>
          <b style="color:${rival.commander.color}">${rival.commander.name}</b></div>
        ${Game.triMode && Game.sides[2] ? `<span class="bi-vs">VS</span>
        <div class="bi-side foe"><span>${commanderPortrait(Game.sides[2].commander, 66)}</span>
          <b style="color:${Game.sides[2].commander.color}">${Game.sides[2].commander.name}</b></div>` : ''}
      </div>
      <div class="bi-sit">
        <p class="bi-sit-flavour">${sit.flavour}</p>
        <p class="bi-sit-vigil">${sit.vigil}</p>
      </div>
      <div class="bi-lines seq">${lines.map((l, i) => `
        <p class="bi-line ${l.side ? 'foe' : 'you'}" data-seq="${i}" data-side="${l.side || 0}">
          <b style="color:${l.cmd.color}">${l.cmd.name}</b> — <span class="bi-text">${l.text}</span></p>`).join('')}</div>
      <button id="bi-go" class="btn btn-primary">SKIP</button>`;
    ov.classList.remove('hidden');
    Game.paused = true;
    /* The button is the readout for this, and nothing was telling it. */
    this.syncSpeed();

    /* PACING. Every line used to be painted at once with a CSS delay while the
       button was already live, so the exchange read as one block of text the
       player clicked past. Now the lines land one at a time, the speaking
       commander's portrait lifts while the others dim, and the button says
       SKIP until the last line has landed. Reading is the default; skipping is
       a choice. Cleared on close so a second battle starts clean. */
    const seq = $$('#bi-body .bi-line');
    const heads = $$('#bi-body .bi-side');
    const btn = $('#bi-go');
    let step = 0;
    /* The speaker is the LINE's own side, not "you or not-you". On a
       contested world the third commander's line is `foe` as well, so the
       RIVAL's portrait lit while somebody else was talking. */
    const light = (i) => {
      const side = i < 0 ? -1 : Number(seq[i].dataset.side);
      heads.forEach((h, hi) => h.classList.toggle('speaking', hi === side));
    };
    const advance = () => {
      if (step >= seq.length) {
        light(-1);
        btn.textContent = 'BEGIN THE BATTLE';
        btn.classList.add('ready');
        return;
      }
      seq[step].classList.add('in');
      light(step);
      Sound.play('click');
      step++;
      this._biTimer = setTimeout(advance, BATTLE_LINE_BEAT * 1000);
    };
    clearTimeout(this._biTimer);
    this._biTimer = setTimeout(advance, 0.5 * 1000);
    /* Skipping lands every remaining line at once rather than discarding them.
       Capture phase, and it STOPS the event: without that the close handler
       below would also fire and the first click would skip AND start the
       battle in one go. */
    btn.addEventListener('click', (e) => {
      if (step < seq.length) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        clearTimeout(this._biTimer);
        seq.forEach(el => el.classList.add('in'));
        step = seq.length;
        light(-1);
        btn.textContent = 'BEGIN THE BATTLE';
        btn.classList.add('ready');
        Sound.play('click');
      }
    }, true);

    /* ONE close path, taken by the button AND by Escape. Escape used to hide
       the modal and stop there: the battle stayed paused with a play button
       claiming otherwise, the line timer kept advancing and clicking on a
       hidden modal, and `done` -- which is what actually starts the battle --
       never ran. `_escDismiss` is the hook closeTopOverlay calls. */
    const closeIntro = () => {
      if (!this._biOpen) return;
      this._biOpen = false;
      clearTimeout(this._biTimer);
      ov._escDismiss = null;
      ov.classList.add('hidden');
      Game.paused = false;
      this.syncSpeed();
      if (done) done();
    };
    this._biOpen = true;
    ov._escDismiss = closeIntro;
    $('#bi-go').addEventListener('click', () => { Sound.play('click'); closeIntro(); }, { once: true });
  },

  /* ═══════════════════════════════ ENEMY DOSSIER (first encounter) ═══ */

  showEnemyIntro(def, live) {
    Game.paused = true;
    this.syncSpeed();
    let ov = $('#enemy-intro');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'enemy-intro';
      ov.className = 'overlay hidden';
      ov.innerHTML = '<div class="modal dossier"><div id="ei-body"></div></div>';
      document.body.appendChild(ov);
    }
    const traits = [];
    if (def.flying) traits.push('FLYING');
    if (def.shield) traits.push('SHIELDED');
    if (def.healRate) traits.push('HEALER');
    if (def.jam) traits.push('JAMS TOWERS');
    if (def.teleport) traits.push('TELEPORTS');
    if (def.slowResist >= 1) traits.push('SLOW-IMMUNE');
    else if (def.slowResist) traits.push('SLOW-RESIST');
    if (def.splashResist) traits.push('SPLASH-RESIST ' + Math.round(def.splashResist * 100) + '%');
    if (def.splitInto) traits.push('SPLITS');
    if (def.phase) traits.push('PHASES');
    const weak = def.elemWeak
      ? Object.entries(def.elemWeak).map(([el2, v]) =>
          `<span class="ei-el" style="--el:${ELEMENTS[el2].color}">${ELEMENTS[el2].icon} ${ELEMENTS[el2].name} +${Math.round(v * 100)}%</span>`).join('')
      : '<span class="ei-none">none</span>';
    const resist = def.elemResist
      ? Object.entries(def.elemResist).map(([el2, v]) =>
          `<span class="ei-el" style="--el:${ELEMENTS[el2].color}">${ELEMENTS[el2].icon} ${ELEMENTS[el2].name} −${Math.round(v * 100)}%</span>`).join('')
      : '<span class="ei-none">none</span>';
    $('#ei-body').innerHTML = `
      <p class="ei-eyebrow">NEW CONTACT — DOSSIER · ${
        def.faction && FACTIONS[def.faction] ? FACTIONS[def.faction].name : MACHINE_HOST.name}</p>
      <h2 class="ei-name" style="color:${def.color}">${def.name.toUpperCase()}</h2>
      <div class="ei-stage-wrap ${art('foe_' + def.id) ? 'has-art' : ''}">
        ${artImg('foe_' + def.id, 'ei-art', def.name)}
        <canvas class="ei-stage" width="240" height="120"></canvas>
      </div>
      <p class="ei-desc">${def.desc || ''}</p>
      ${traits.length ? `<div class="ei-traits">${traits.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
      <div class="ei-stats">
        <div><span>HEALTH</span><b>${formatNum(Math.round(live ? live.maxHp : def.hp))}</b></div>
        <div><span>SPEED</span><b>${def.speed.toFixed(2)}</b></div>
        <div><span>ARMOUR</span><b>${def.armor || 0}</b></div>
        <div><span>LIVES COST</span><b>${def.lives || 1}</b></div>
      </div>
      <div class="ei-elems"><div><span>WEAK TO</span>${weak}</div><div><span>DAMPS REACTIONS</span>${resist}</div></div>
      <p class="ei-desc">A weakness adds that much damage to every hit of the element. A resistance takes that much off elemental <b>reactions</b> only — the hit itself lands in full.</p>
      <button id="ei-go" class="btn btn-primary">ENGAGE</button>`;
    ov.classList.remove('hidden');

    /* the live sprite, walking in place */
    const cv = ov.querySelector('.ei-stage'), ctx = cv.getContext('2d');
    const stub = live || new Enemy(def, Game.lanes[0][0], { hostileTo: 0, owner: -1, offset: 0,
      drift: { hp: 0, speed: 0, armor: 0 }, mods: [] });
    const sx = stub.x, sy = stub.y;
    if (this._eiRaf) cancelAnimationFrame(this._eiRaf);
    let t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = 'rgba(120,160,200,.12)'; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(0, 78); ctx.lineTo(cv.width, 78); ctx.stroke();
      stub.x = cv.width / 2 + Math.sin(t * 1.1) * 16;
      stub.y = 66 + Math.sin(t * 3.1) * 2;
      stub.ux = Math.cos(t * 1.1) >= 0 ? 1 : -1; stub.uy = 0;
      try { stub.draw(ctx); } catch (e) {}
      this._eiRaf = requestAnimationFrame(frame);
    };
    frame();

    /* Same single close path as the pre-battle dialogue: Escape left the
       battle paused behind a dossier that was no longer on screen, and left
       the sprite's rAF running against a canvas nobody could see. */
    const closeDossier = () => {
      if (!this._eiOpen) return;
      this._eiOpen = false;
      if (this._eiRaf) { cancelAnimationFrame(this._eiRaf); this._eiRaf = 0; }
      stub.x = sx; stub.y = sy;
      ov._escDismiss = null;
      ov.classList.add('hidden');
      Game.paused = false;
      this.syncSpeed();
    };
    this._eiOpen = true;
    ov._escDismiss = closeDossier;
    $('#ei-go').addEventListener('click', () => { Sound.play('click'); closeDossier(); }, { once: true });
  },

  /** Transient status line, reused by extraction and other one-off confirmations. */
  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${text}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 5000);
  },

  /** Three escalations offered; the player underwrites one. */
  showEscalationChoice(offer) {
    let ov = $('#escal-choice');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'escal-choice';
      /* `required` = Esc may not dismiss this; see closeTopOverlay in main.js. */
      ov.className = 'overlay hidden required';
      ov.innerHTML = '<div class="modal escal"><div id="ec-body"></div></div>';
      document.body.appendChild(ov);
    }
    const owed = Game.escalationOwed.length;
    $('#ec-body').innerHTML = `
      <p class="ec-eyebrow">WAVE ${Game.wave} — THE ENEMY ADAPTS</p>
      <h2 class="ec-title">CHOOSE YOUR ESCALATION</h2>
      <p class="ec-sub">One of these lands now. The two you refuse are remembered and come back first.
        Taking a <b class="ec-hard">severe</b> escalation widens your next command draft.</p>
      <div class="ec-cards">
        ${offer.map((m, i) => `
          <button class="ec-card ${m.severity >= 2 ? 'hard' : ''}" data-esc="${i}">
            <span class="ec-ic">${m.icon}</span>
            <b>${m.name}</b>
            <em>${m.desc}</em>
            <span class="ec-tag">${m.severity >= 2 ? '⚠ SEVERE · +1 DRAFT OPTION' : 'MODERATE'}</span>
          </button>`).join('')}
      </div>
      ${owed ? `<p class="ec-owed">${owed} refused escalation${owed > 1 ? 's' : ''} still owed.</p>` : ''}`;
    ov.classList.remove('hidden');
    $$('[data-esc]', ov).forEach(b => b.addEventListener('click', () => {
      ov.classList.add('hidden');
      Game.takeEscalation(offer[+b.dataset.esc]);
    }));
  },

  showEscalation(m) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${m.icon} ENEMY ESCALATION</b><span>${m.name} — ${m.desc}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 5200);
    setTimeout(() => el.remove(), 6000);
  },

  /* =========================================================== TOOLTIP */

  showTooltip(ev, html) {
    const t = this.el.tooltip;
    t.innerHTML = html;
    t.classList.remove('hidden');
    this.paintTowerIcons(t);
    this.moveTooltip(ev);
  },
  moveTooltip(ev) {
    const t = this.el.tooltip;
    if (t.classList.contains('hidden')) return;
    const r = t.getBoundingClientRect();
    let x = ev.clientX - r.width - 16;
    if (x < 8) x = ev.clientX + 16;
    t.style.left = x + 'px';
    t.style.top = clamp(ev.clientY - r.height / 2, 8, window.innerHeight - r.height - 8) + 'px';
  },
  hideTooltip() { this.el.tooltip.classList.add('hidden'); },

  /* ========================================================= END SCREEN */

  /**
   * The reward summary.
   *
   * A loss screen is the retention surface of a roguelike, and this one used to
   * be a static scoreboard. Rewards now ARRIVE: stars stamp in one at a time,
   * the experience bar fills, level-ups punch, and every soul earned is counted
   * onto the total. Everything is driven off one timeline so it can be skipped
   * with a click and never blocks the player.
   */
  showEnd(won) {
    /* "The rival" is seat 1 only on a two-sided board. On a tri board or in
       the arena seat 1 is very often the seat that fell FIRST, so the loss
       line reported a rout as a close-run thing -- "They held with 0." with
       seventeen commanders still standing. rivalOf(0) returns -1 on a clean
       sweep and `ai` is read on the victory screen too, so the fallback is
       load-bearing. BATCH-C/nside */
    const me = Game.sides[0], ai = Game.sides[Game.rivalOf(0)] || Game.sides[1];
    const standing = Game.sides.slice(1).filter(s => !s.defeated && s.alive);
    const towers = [...me.towers].sort((a, b) => b.damageDealt - a.damageDealt).slice(0, 6);
    const total = me.towers.reduce((s, t) => s + t.damageDealt, 0) || 1;
    const xp = Game.lastXp || { gained: 0, levelsGained: 0, level: 1 };
    const p = Meta.progress(me.commander.id);
    const st = Game.lastStars;
    const stars = st ? st.stars : 0;
    const res = Game.campaignResult || {};
    const soulsEarned = (st && st.souls) || res.souls || 0;
    const fac = FACTIONS[me.faction] || FACTIONS.human;

    this.el.endBody.innerHTML = `
      <div class="rw" style="--fc:${fac.color};--cc:${me.commander.color}">

        <div class="rw-verdict ${won ? 'win' : 'lose'}">
          <span class="rw-flag">${fac.icon}</span>
          <b>${won ? 'WORLD TAKEN' : 'DRIVEN OFF'}</b>
          <em>${won
            ? `Your dead broke their line on wave ${Game.wave} of ${Game.map.name}.`
            : `Your base fell on wave ${Game.wave} of ${Game.map.name}. ${standing.length > 1
                ? `${standing.length} commanders were still standing.`
                : `They held with ${(standing[0] || ai).lives}.`}${
                res.kept ? ' The galaxy stands \u2014 every star you hold is still yours.' : ''}`}</em>
        </div>

        <div class="rw-stars" id="rw-stars">
          ${[1, 2, 3].map(i => `<span class="rw-star" data-i="${i}">★</span>`).join('')}
          <span class="rw-starnote">${stars >= 3
            ? 'CONQUERED — this world is yours'
            : won ? 'Held, but not cleanly. Three stars needs 90% of your lives.'
                  : res.kept ? 'No stars. The world stays theirs \u2014 your galaxy and every star on it stay yours.'
                             : 'No stars. The world stays theirs.'}</span>
        </div>

        <div class="rw-track" id="rw-xp">
          <div class="rw-head"><span>${me.commander.icon} ${me.commander.name}</span>
            <span class="rw-lvl">LVL <b id="rw-lvlnum">${p.level - (xp.levelsGained || 0)}</b></span></div>
          <div class="rw-bar"><i id="rw-xpfill"></i></div>
          <div class="rw-foot"><span id="rw-xpnum">+0 XP</span>
            <span id="rw-lvlup" class="rw-lvlup"></span></div>
        </div>

        <div class="rw-track" id="rw-souls">
          <div class="rw-head"><span>◉ SOULS</span>
            <span class="rw-lvl"><b id="rw-soulnum">${Meta.souls() - soulsEarned}</b></span></div>
          <div class="rw-bar"><i id="rw-soulfill"></i></div>
          <div class="rw-foot"><span id="rw-souldelta">${soulsEarned ? '+0' : 'no new stars — no souls'}</span>
            ${st && st.systemTaken ? `<span class="rw-sysbounty">✦ ${st.systemTaken} TAKEN — +${Meta.SYSTEM_BOUNTY}</span>` : ''}</div>
        </div>

        ${Game.lastMastery && Game.lastMastery.length ? `
          <div class="rw-mastery" id="rw-mastery">${Game.lastMastery.map(m =>
            `<span class="rw-mchip" data-tt="${TOWER_TYPES[m.type].name} MASTERY|+${m.gained} XP${m.levels ? ' — LEVEL UP to M' + m.level : ''}">
              ${TOWER_TYPES[m.type].name} <b>+${m.gained}</b>${m.levels ? ' ▲' : ''}</span>`).join('')}</div>` : ''}

        ${st && st.saved && st.saved.length ? `
          <div class="rw-saved"><b>DENIZENS SAVED</b>${st.saved.map(id =>
            `<span style="--tc:${ENEMY_TYPES[id].color}">${ENEMY_TYPES[id].name}</span>`).join('')}
            <em>freed from the fallen garrison — now available to your muster detachment</em></div>` : ''}

        ${Game.rivalMoves && Game.rivalMoves.length ? `
          <div class="rw-rivals"><b>WHILE YOU FOUGHT</b>${Game.rivalMoves.map(mv =>
            `<span style="--fc:${FACTIONS[mv.faction].color}">${FACTIONS[mv.faction].icon} ${FACTIONS[mv.faction].short} took ${mv.world} in ${mv.system}</span>`).join('')}</div>` : ''}

        <div class="rw-stats">
          <div><b>${Game.wave}</b><span>waves</span></div>
          <div><b>${formatNum(me.stats.kills)}</b><span>killed</span></div>
          <div><b>${formatNum(me.stats.sent)}</b><span>sent</span></div>
          <div><b>${me.towers.length}</b><span>towers</span></div>
        </div>

        <div class="rw-damage">${towers.map(t => `
          <div class="rw-dmg">
            <span class="rw-dname" style="--tc:${t.def.color}">${t.def.name}${t.branch ? ' ' + t.branch.name : ''}</span>
            <span class="rw-dbar"><i style="--tc:${t.def.color};width:${(t.damageDealt / total * 100).toFixed(1)}%"></i></span>
            <span class="rw-dnum">${formatNum(Math.round(t.damageDealt))}</span>
          </div>`).join('')}</div>

        <p class="rw-skip" id="rw-skip">click to skip</p>
      </div>`;

    this.bindChipTips(this.el.endBody);
    /* The continue button ROUTES on Game._skirmish (see the click handler
       above), but its label was static markup that always read "TO THE
       GALAXY" -- so a skirmish promised the campaign and then correctly
       delivered the multiverse. Label and destination are now derived from
       the one condition, in one place, so they cannot drift apart. */
    this.endRetryLabel();
    this.el.endOverlay.classList.remove('hidden');
    this.playRewardTimeline({ stars, xp, p, soulsEarned, soulsTotal: Meta.souls() });
  },

  /** Name the continue button after wherever it is actually about to go. */
  endRetryLabel() {
    const b = $('#btn-end-retry');
    if (b) b.textContent = Game._skirmish ? 'TO THE MULTIVERSE →'
                                          : 'TO THE GALAXY →';
  },

  /** Staged reward reveal. Every step is a timeout so the whole thing is skippable. */
  playRewardTimeline(d) {
    if (this._rwTimers) this._rwTimers.forEach(clearTimeout);
    this._rwTimers = [];
    const at = (ms, fn) => this._rwTimers.push(setTimeout(fn, ms));
    const q = sel => this.el.endBody.querySelector(sel);

    /* stars stamp in */
    for (let i = 1; i <= d.stars; i++) {
      at(260 + i * 380, () => {
        const el = q(`.rw-star[data-i="${i}"]`);
        if (el) { el.classList.add('on'); Sound.play(i === 3 ? 'branch' : 'upgrade'); }
      });
    }

    /* experience fills, then any level-ups punch through */
    const xpStart = 340 + d.stars * 380;
    at(xpStart, () => {
      const fill = q('#rw-xpfill');
      if (fill) fill.style.width = (d.p.frac * 100).toFixed(1) + '%';
      const num = q('#rw-xpnum');
      if (num) this.countUp(num, 0, d.xp.gained, 900, v => '+' + formatNum(v) + ' XP');
      Sound.play('tech');
    });
    for (let i = 1; i <= (d.xp.levelsGained || 0); i++) {
      at(xpStart + 700 + i * 420, () => {
        const n = q('#rw-lvlnum'), tag = q('#rw-lvlup');
        if (n) { n.textContent = (d.p.level - d.xp.levelsGained + i); n.classList.add('pop');
                 setTimeout(() => n.classList.remove('pop'), 400); }
        if (tag) { tag.textContent = 'LEVEL UP'; tag.classList.add('show'); }
        Sound.play('victory');
      });
    }

    /* souls count onto the running total last — it is the thing you spend */
    const soulStart = xpStart + 900 + (d.xp.levelsGained || 0) * 420;
    if (d.soulsEarned) at(soulStart, () => {
      const fill = q('#rw-soulfill');
      if (fill) fill.style.width = '100%';
      const num = q('#rw-soulnum'), delta = q('#rw-souldelta');
      if (num) this.countUp(num, d.soulsTotal - d.soulsEarned, d.soulsTotal, 1000, v => formatNum(v));
      if (delta) this.countUp(delta, 0, d.soulsEarned, 1000, v => '+' + v + ' banked');
      Sound.play('branch');
    });

    at(soulStart + 1100, () => {
      const m = q('#rw-mastery');
      if (m) m.classList.add('show');
    });

    const skipAll = () => {
      this._rwTimers.forEach(clearTimeout); this._rwTimers = [];
      for (let i = 1; i <= d.stars; i++) { const el = q(`.rw-star[data-i="${i}"]`); if (el) el.classList.add('on'); }
      const fill = q('#rw-xpfill'); if (fill) fill.style.width = (d.p.frac * 100).toFixed(1) + '%';
      const num = q('#rw-xpnum'); if (num) num.textContent = '+' + formatNum(d.xp.gained) + ' XP';
      const n = q('#rw-lvlnum'); if (n) n.textContent = d.p.level;
      if (d.xp.levelsGained) { const tag = q('#rw-lvlup'); if (tag) { tag.textContent = 'LEVEL UP'; tag.classList.add('show'); } }
      const sf = q('#rw-soulfill'); if (sf && d.soulsEarned) sf.style.width = '100%';
      const sn = q('#rw-soulnum'); if (sn) sn.textContent = formatNum(d.soulsTotal);
      const sd = q('#rw-souldelta'); if (sd && d.soulsEarned) sd.textContent = '+' + d.soulsEarned + ' banked';
      const m = q('#rw-mastery'); if (m) m.classList.add('show');
      const sk = q('#rw-skip'); if (sk) sk.remove();
    };
    const wrap = this.el.endBody.querySelector('.rw');
    if (wrap) wrap.addEventListener('click', skipAll, { once: true });
  },

  /** Ease a number from a to b, writing it through `fmt`. */
  countUp(el, a, b, ms, fmt) {
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(a + (b - a) * e));
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  },

/* ============================================================== CODEX */

  buildCodex() {
    const towers = TOWER_ORDER.map(id => {
      const t = TOWER_TYPES[id];
      return `<div class="codex-entry" style="--tc:${t.color}">
        <div class="ce-head"><b>${t.name}</b><span>◈${t.cost} · growth ×${appliedGrowth(t).toFixed(2)}</span></div>
        <p>${t.desc}</p>
        <div class="ce-branches">
          <div><b>TALENTS</b> — ${t.talents.map(x => x.name).join(' / ')}</div>
          <div><b>${t.branches[0].name}</b> / <b>${t.branches[1].name}</b> at tier 4</div>
        </div></div>`;
    }).join('');
    const enemies = Object.values(ENEMY_TYPES).map(e => {
      /* Allegiance first: the codex is where a player works out why one
         creature is grey chrome and the next one is somebody's soldier. */
      const h = e.faction && FACTIONS[e.faction] ? FACTIONS[e.faction] : MACHINE_HOST;
      return `<div class="codex-entry" style="--tc:${e.color}">
        <div class="ce-head"><b>${e.name}</b><span>${h.icon} ${h.short} · ${
          e.hp} HP · ${e.armor} arm</span></div>
        <p>${e.desc}</p></div>`;
    }).join('');
    const mods = PLAYER_MODS.map(m => `<div class="codex-entry" style="--tc:#4ade80">
      <div class="ce-head"><b>${m.icon} ${m.name}</b></div><p>${m.desc}</p></div>`).join('');
    const esc = ENEMY_MODS.map(m => `<div class="codex-entry" style="--tc:#ef4444">
      <div class="ce-head"><b>${m.icon} ${m.name}</b></div><p>${m.desc}</p></div>`).join('');

    /* Lore, factions, elements and abilities were all defined in data and never
       shown anywhere. The Field Manual is the one place a player goes to find
       out what a system IS, so all four live here now. */
    const lore = LORE.map(l => `
      <div class="lore-entry"><b>${l.title}</b><p>${l.body}</p></div>`).join('');

    const factions = FACTION_ORDER.map(id => {
      const f = FACTIONS[id];
      return `<div class="codex-entry fac" style="--tc:${f.color}">
        <b>${f.icon} ${f.name}</b>
        <em class="fx-creed">${f.creed}</em>
        <span>${f.blurb}</span>
        <span class="fx-bonus"><b>${f.bonusName}</b> — ${f.bonusDesc}</span>
      </div>`;
    }).join('');

    const elemRows = Object.keys(ELEMENTS).map(id => {
      const e = ELEMENTS[id];
      const towers = TOWER_ORDER.filter(t => TOWER_TYPES[t].element === id);
      return `<div class="codex-entry" style="--tc:${e.color}">
        <b>${e.icon} ${e.name}</b>
        <span>${e.marks
          ? 'Leaves a mark. A hit from a DIFFERENT marking element consumes it and triggers a reaction.'
          : 'Does not mark. Straight damage, no reactions — that is the trade.'}</span>
        <span class="el-towers">${towers.length} tower${towers.length === 1 ? '' : 's'}: ${towers.map(t => TOWER_TYPES[t].name).join(', ')}</span>
      </div>`;
    }).join('');

    const seen = new Set();
    const comboRows = [];
    for (const a in COMBOS) for (const b in COMBOS[a]) {
      const c = COMBOS[a][b];
      const key = c.id;
      if (seen.has(key)) continue;
      seen.add(key);
      comboRows.push(`<div class="codex-entry" style="--tc:${ELEMENTS[a].color}">
        <b>${c.name}</b>
        <span class="cb-recipe">${ELEMENTS[a].icon} ${ELEMENTS[a].name} + ${ELEMENTS[b].icon} ${ELEMENTS[b].name}</span>
        <span>${c.desc}</span>
      </div>`);
    }

    /* The aimed roster and the barricade's hold are DERIVED, never listed: a
       fifth aimed ability, a lane flag moved, or a re-tuned wallBlocks must not
       be able to leave a paragraph of this manual lying. */
    const aimedPoint = Object.values(ABILITIES).filter(a => a.aim && !a.lane);
    const aimedLane  = Object.values(ABILITIES).filter(a => a.aim && a.lane);
    const nameList = xs => xs.map(a => a.name).join(' and ');
    const rp = TOWER_TYPES.rampart;
    const rpCaps = `<b>${rp.base.wallBlocks}</b> at base` +
      rp.levels.map(l => `, <b>${l.mods.wallBlocks}</b> as a ${l.name}`).join('');

    const abilRows = Object.values(ABILITIES).map(a => `
      <div class="codex-entry" style="--tc:${a.kind === 'offense' ? '#fbbf24' : '#7dd3fc'}">
        <b>${a.icon} ${a.name}</b>
        <span class="ab-kind">${a.kind === 'offense' ? 'OFFENSIVE' : 'DEFENSIVE'} · ${a.cd}s cooldown · ${a.dur}s duration</span>
        <span>${a.desc}</span>
      </div>`).join('');

    const cmdRows = COMMANDER_ROSTER.map(c => {
      const f = c.faction ? FACTIONS[c.faction] : null;
      return `<div class="codex-entry" style="--tc:${c.color}">
        <b>${c.icon} ${c.name}</b>
        <span class="cx-title">${c.title}${f ? ' · ' + f.short : ' · Unaligned'}</span>
        <span><b>${c.trait.name}</b> — ${c.trait.desc}</span>
        <span class="cx-abil">${c.abilities.map(a => ABILITIES[a].icon + ' ' + ABILITIES[a].name).join(' · ')}</span>
      </div>`;
    }).join('');

    this.el.codexBody.innerHTML = `
      <section><h3>The Galaxy</h3><div class="lore-grid">${lore}</div></section>
      <section><h3>Powers</h3><div class="codex-grid">${factions}</div></section>
      <section><h3>Conquest</h3><div class="codex-note">
        <p>A campaign is a galaxy: five solar systems, seven worlds each, held by the three
           powers that are not yours and by the pirates.</p>
        <p><b>Stars.</b> Winning takes a world. Winning <em>cleanly</em> — with 90% of your
           lives intact — earns three stars and CONQUERS it for your faction. Two stars needs
           55%. One star is any other victory.</p>
        <p><b>Openings.</b> Worlds unlock outward from the first in each system. A commander's
           seat opens once you hold most of their system, and taking a seat unlocks the next
           system. Rival commanders take worlds of their own while you fight.</p>
        <p><b>Defeat.</b> Losing a battle costs you the stars you did not earn and hands
           the rivals a free move &mdash; but the galaxy and every star already on it stay
           yours. Only <em>abandoning</em> a campaign from the battle's \u2715 button forfeits
           it.</p>
      </div></section>
      <section><h3>Commander abilities</h3><div class="codex-note">
        <p>Every commander carries two: an offensive power on <b>Q</b> and a defensive one on
           <b>E</b>. The second is locked until you have spent every point on that commander's
           technology chart, or unlock it outright in the Soul Shop.</p>
        <p><b>Aimed powers.</b> ${aimedPoint.length + aimedLane.length} of them do not put a number on
           the whole board &mdash; they deliver a <em>construct</em> at a tile you choose, so spending one
           costs a placement decision as well as a cooldown. Press <b>Q</b> or <b>E</b> (or click the
           button) to arm the cursor, then click the ground. ${nameList(aimedPoint)} may go on any tile
           you hold that is not rubble and has no tower on it; ${nameList(aimedLane)} must be aimed at a
           lane, and snap to the nearest lane you defend within <b>${AIM_SNAP_TILES}</b> tiles. An
           illegal tile simply does not fire &mdash; it never burns the cooldown. Each construct stands
           for its ability's duration only, and cannot be stacked or refreshed while it is up: a wall you
           could park forever would erase the consequence of a leak rather than charge for it.</p>
      </div><div class="codex-grid">${abilRows}</div></section>
      <section><h3>Elements</h3><div class="codex-note">
        <p>A marking element leaves a mark on what it hits — drawn as a ringed glyph over the
           unit. A hit from a <em>different</em> marking element consumes that mark and triggers
           a reaction. Marks last four seconds, so a reaction needs two different elements
           covering the <b>same stretch of lane</b>. That is what makes placement an elemental
           decision and not only a spatial one.</p>
      </div><div class="codex-grid">${elemRows}</div></section>
      <section><h3>Reactions</h3><div class="codex-grid">${comboRows.join('')}</div></section>
      <section><h3>Commanders</h3><div class="codex-grid">${cmdRows}</div></section>
      <section><h3>Attrition</h3><div class="codex-note">
        <p>Neutral waves spawn in the centre corridor and march on <b>both</b> bases at once — same composition, same instant.</p>
        <p>Anything <b>you</b> destroy is <b>reanimated</b> and sent down your rival's lane at 60% health and 45% faster. A reanimated unit that dies is gone for good, so kills never cascade.</p>
      </div></section>
      <section><h3>Escalation</h3><div class="codex-note">
        <p>Every wave permanently raises one random enemy statistic — health, speed or armour. The running totals sit at the top of the battlefield.</p>
        <p>Every <b>${MINIBOSS_EVERY}</b> waves brings a <b>miniboss</b>. Enemy health also compounds: roughly ×${Math.round(waveHpMultiplier(10))} by wave 10, ×${Math.round(waveHpMultiplier(20))} by wave 20 and ×${formatNum(Math.round(waveHpMultiplier(30)))} by wave 30.</p>
        <p><b>The bid.</b> Every <b>10</b> waves the enemy adapts, and the battle <em>halts</em> while you
           underwrite it. Three escalations are offered and you take exactly one. The two you refuse are
           remembered and are drawn <b>first</b> the next time the enemy adapts, so refusing is a
           deferral and never a discount. Late in a long battle, once there is little left the enemy has
           not already learned, whatever remains simply lands.</p>
        <p><b>The price.</b> An escalation is dealt to <em>every</em> commander on the field at once, so
           choosing which one arrives is worth something and is charged for. Underwrite a
           <b>severe</b> escalation — the ones marked ⚠ on the card — and your next command draft is one
           option wider. Duck it, and each of your rivals gets that extra option instead.</p>
      </div></section>
      <section><h3>Resonant field</h3><div class="codex-note">
        <p>During a build phase you may charge the field: pay gold now and the <em>next</em> wave arrives
           with <b>+${Math.round(ENRAGE_HP * 100)}%</b> health, while every kill in it pays
           <b>+${Math.round(ENRAGE_BOUNTY * 100)}%</b> gold. Up to <b>${ENRAGE_MAX}</b> charges, each one
           costing well over the last. It is the one purchase that buys difficulty on purpose.</p>
        <p>Charges are spent by the wave they were bought for and never carry into another. And a
           charge rides the buyer's own wave alone: the heavier attackers and the richer bounty arrive
           on <em>your</em> half of the field, while a commander who did not pay meets the wave it would
           have met anyway. Composition, count, lane and timing stay identical for everyone &mdash; that
           invariant is the whole point of attrition &mdash; so a charge is a bet on your own defence,
           never a weapon aimed across the board.</p>
      </div></section>
      <section><h3>Economy</h3><div class="codex-note">
        <p>Each tower's price rises with <b>every copy you already own</b>, at its own rate. A Bolt at ×${appliedGrowth(TOWER_TYPES.bolt).toFixed(2)} is the gentlest curve in the game; a Vault at ×${appliedGrowth(TOWER_TYPES.vault).toFixed(2)} is effectively unique. That is what makes a board a composition rather than a stack. Commanders who trade in price growth soften these figures, and the build tooltip quotes your own.</p>
        <p>Ascension has no flat multiplier to quote: a step costs the tower's paid specialisation
           <b>×${ASCENSION.expBase}</b>, raised to a power that itself compounds by
           <b>×${ASCENSION.expGolden}</b> every step — so the second ascension is dear and the fifth is
           absurd next to simply placing another tower. Each step gives ×${ASCENSION.damage} damage,
           ×${ASCENSION.rate} rate and ×${ASCENSION.range} range: a deliberate wall that only a focused
           economy can climb.</p>
        <p><b>Banked capital.</b> Gold still in hand when a wave finishes spawning pays
           <b>${Math.round(INTEREST_RATE * 100)}%</b> interest, capped each wave at
           <b>${Math.round(INTEREST_CAP_FRAC * 100)}%</b> of that wave's own reward. It is read
           <em>before</em> the wave reward lands, so it prices the gold you chose to hold rather than the
           gold you were just paid; and because the ceiling is a share of the reward rather than a flat
           number, banking is worth about the same at wave 3 as at wave 30. Not spending is a play.</p>
      </div></section>
      <section><h3>Muster</h3><div class="codex-note">
        <p>Gold buys aggression. A <b>muster</b> marches a detachment of saved denizens down your rival's
           lane at once, and pays you a <em>permanent</em> share of every wave reward for the rest of the
           battle. It is the only purchase in the game that is an attack and an income at the same time.</p>
        <p>You carry up to <b>${MUSTER_LOADOUT_SIZE}</b> saved denizens into a battle, chosen on the
           deployment loadout screen; each becomes one row of the muster bar, and its pack size, price and
           income are all derived from that denizen's own health, so a swarm of frail mobs and a pair of
           heavies put comparable mass in the lane. A denizen is <b>saved</b> by conquering the world it
           defends outright — three stars, first time — and it joins a vault every profile shares.</p>
        <p>A purchase costs a share of the <em>next</em> wave's reward and rises
           <b>${Math.round((MUSTER_COST_GROWTH - 1) * 100)}%</b> each time for the first
           <b>${MUSTER_COST_STEPS}</b> buys, then flattens. The income each purchase adds stacks flat and
           is capped at <b>+${Math.round(MUSTER_INCOME_CAP_PCT * 100)}%</b> of a wave reward, and you may
           buy at most <b>${MUSTER_PER_WAVE}</b> per wave — a mustered army is built across a match, not
           bought in one build phase.</p>
        <p>Sent units count as <b>reanimated</b>: they arrive damped, cost half as many lives on a leak,
           and cannot be reanimated a second time. On the Confluence one purchase marches on
           <b>both</b> rivals, exactly as a kill does there.</p>
      </div></section>
      <section><h3>The ground</h3><div class="codex-note">
        <p><b>Rubble.</b> On some maps half the board is scenery — and scenery is purchasable. Any rubble
           tile on your own half that the lane does not run through can be demolished into buildable
           ground. The first clearance is the cheapest; each one after it costs <b>×${CLEAR_GROWTH}</b>
           the last, and you may clear <b>${CLEAR_MAX}</b> in a battle. Clearances last the battle only and
           are never written to the campaign.</p>
        <p><b>Land cards.</b> Two command upgrades hand you <em>board</em> instead of a percentage.
           ${PLAYER_MODS.filter(m => m.land).map(m => '<b>' + m.name + '</b>').join(' and ')} are offered
           only on maps that actually have rubble to clear, so they can never be a dead draw.</p>
        <p><b>Terrain nodes.</b> A handful of tiles on some maps carry an elemental charge, mirrored onto
           both halves so neither commander gets the better board. Stand a tower of the node's <em>own</em>
           element on it and its damage rises <b>${Math.round((NODE_ATTUNE_DAMAGE - 1) * 100)}%</b>. Stand
           one that marks nothing on it and the tower borrows the node's element — which is how a map
           joins the reaction table. Stand a marking tower of some <em>other</em> element on it and it
           keeps its own element, but holds its mark <b>${NODE_HOLD_MARK}s</b> instead of
           ${MARK_SECONDS}s: patience rather than raw damage. A lane node works on the enemy instead of the
           tower — anything walking over it that is not flying and not already marked picks that element
           up for <b>${NODE_LANE_MARK}s</b>, long enough to carry into a killzone and too short to stand as
           half a reaction on its own. A node is a property of the tile, so a tower moved onto or off one
           re-reads it immediately.</p>
      </div></section>
      <section><h3>Barricades</h3><div class="codex-note">
        <p>A <b>${rp.name}</b> throws a physical wall across the nearest lane within its reach. Ground
           attackers stop at it and batter it down; when it falls the tower raises another after its
           rebuild time.</p>
        <p>A wall is <b>throughput, not a gate</b>. It holds a specific number of attackers at once —
           ${rpCaps}, +2 with DEEP RANKS, and whatever its branch sets after that — and everything past
           that number squeezes by while the held ones are fighting. Contact is resolved
           furthest-along-first, so the leaders are held and the stragglers slip through. Fliers ignore
           walls entirely, and bosses and minibosses are never held: they walk on through and tear the
           wall down far faster than anything else on the field.</p>
      </div></section>
      <section><h3>Moving a tower</h3><div class="codex-note">
        <p>A placement is a commitment you can buy your way out of. Any tower can be picked up and set
           down anywhere you could have built it, keeping every level, branch, roll and ascension. The fee
           is <b>${Math.round(RELOCATE_FEE_FRAC * 100)}%</b> of what is currently invested in that tower,
           so moving a finished ascended tower is genuinely expensive, and the tower is <b>offline for
           ${RELOCATE_DOWNTIME}s</b> once it lands — long enough to hurt mid-wave, close to free between
           them. Nothing is refunded and nothing is reset, so a move can never be used to launder the
           per-copy price curve.</p>
      </div></section>
      <section><h3>Towers</h3><div class="codex-grid">${towers}</div></section>
      <section><h3>Command upgrades</h3><div class="codex-grid">${mods}</div></section>
      <section><h3>Enemy escalations</h3><div class="codex-grid">${esc}</div></section>
      <section><h3>Enemies</h3><div class="codex-grid">${enemies}</div></section>`;
  },

  /* =========================================================== SETTINGS */

  loadSettings() {
    const s = Storage.loadSettings();
    $('#set-sfx').value = Math.round(s.sfx * 100);
    $('#set-music').value = Math.round(s.music * 100);
    $('#set-sfx-on').checked = s.sfxOn;
    $('#set-music-on').checked = s.musicOn;
    Sound.setSfxVolume(s.sfx); Sound.setMusicVolume(s.music);
    Sound.toggleSfx(s.sfxOn); Sound.toggleMusic(s.musicOn);
  },
  saveSettings() {
    Storage.saveSettings({ sfx: $('#set-sfx').value / 100, music: $('#set-music').value / 100,
      sfxOn: $('#set-sfx-on').checked, musicOn: $('#set-music-on').checked });
  }
};


/* ==========================================================================
   TITLE STARFIELD — a small simulated universe behind the menu.

   Three parallax depths of stars and a slow nebula drift; the whole field
   eases toward the cursor (huashu expoOut-style smoothing, never linear) and
   stars near the pointer are gently shouldered aside, so the screen answers
   the hand without ever fighting the menu for attention. Runs only while the
   title screen is visible, and not at all under prefers-reduced-motion.
   ========================================================================== */
const TitleFX = {
  cv: null, cx: null, stars: [], running: false, raf: 0,
  px: 0, py: 0,          /* eased parallax, -1..1 */
  tx: 0, ty: 0,          /* target parallax from the pointer */
  mx: -1e4, my: -1e4,    /* pointer in canvas px, far away until it arrives */
  t: 0, _last: 0,

  ensure() {
    if (this.cv) return;
    const host = document.getElementById('screen-title');
    if (!host) return;
    this.cv = document.createElement('canvas');
    this.cv.id = 'title-stars';
    host.insertBefore(this.cv, host.firstChild);
    this.cx = this.cv.getContext('2d');
    const seed = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    /* Three depths: far dust, mid field, near sparks. Deeper moves less. */
    const LAYERS = [[110, 0.25, 0.9], [70, 0.55, 1.5], [34, 1.0, 2.2]];
    this.stars = [];
    LAYERS.forEach(([count, depth, size], li) => {
      for (let i = 0; i < count; i++) {
        this.stars.push({
          u: seed(i, li * 3 + 1), v: seed(i, li * 3 + 2),
          depth, r: size * (0.5 + seed(i, li * 3 + 3)),
          tw: 2 + seed(i, li * 7) * 4,          /* twinkle rate */
          ph: seed(i, li * 11) * Math.PI * 2,   /* twinkle phase */
          hue: seed(i, li * 13),                /* 0 cyan .. 1 magenta */
          ox: 0, oy: 0                          /* cursor-shove offset */
        });
      }
    });
    window.addEventListener('pointermove', e => {
      const r = this.cv.getBoundingClientRect();
      if (!r.width) return;
      this.mx = (e.clientX - r.left) * (this.cv.width / r.width);
      this.my = (e.clientY - r.top) * (this.cv.height / r.height);
      this.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    }, { passive: true });
    this.resize = () => {
      const r = this.cv.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      this.cv.width = Math.max(1, Math.round(r.width * d));
      this.cv.height = Math.max(1, Math.round(r.height * d));
    };
    window.addEventListener('resize', () => { if (this.running) this.resize(); });
  },

  toggle(on) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ensure();
    if (!this.cv) return;
    if (on && !still) {
      if (this.running) return;
      this.running = true;
      this.resize();
      this._last = performance.now();
      this.raf = requestAnimationFrame(t => this.frame(t));
    } else {
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (on && still) { this.resize(); this.draw(0.016); }  /* one calm frame */
      else if (this.cx && this.cv.width) this.cx.clearRect(0, 0, this.cv.width, this.cv.height);
    }
  },

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000 || 0.016);
    this._last = now;
    this.t += dt;
    /* Exponential ease toward the pointer — framerate-independent. */
    const k = 1 - Math.pow(0.0025, dt);
    this.px += (this.tx - this.px) * k;
    this.py += (this.ty - this.py) * k;
    this.draw(dt);
    this.raf = requestAnimationFrame(t => this.frame(t));
  },

  draw(dt) {
    const { cx, cv } = this;
    const W = cv.width, H = cv.height;
    cx.clearRect(0, 0, W, H);
    const shove = 46 * (W / 1600);           /* cursor influence radius scale */
    for (const s of this.stars) {
      /* Slow universal drift plus parallax; wraps at the edges. */
      let x = ((s.u + this.t * 0.004 * s.depth) % 1) * W;
      let y = s.v * H;
      x += this.px * 26 * s.depth * (W / 1600) * -1;
      y += this.py * 18 * s.depth * (H / 900) * -1;

      /* The cursor shoulders nearby stars aside; they ease home after. */
      const dx = x - this.mx, dy = y - this.my;
      const d2 = dx * dx + dy * dy, R = 140 * (W / 1600) * (0.5 + s.depth);
      if (d2 < R * R && d2 > 1) {
        const d = Math.sqrt(d2), f = (1 - d / R) * shove * s.depth;
        s.ox += ((dx / d) * f - s.ox) * 0.14;
        s.oy += ((dy / d) * f - s.oy) * 0.14;
      } else {
        s.ox *= 1 - Math.min(1, 2.2 * dt);
        s.oy *= 1 - Math.min(1, 2.2 * dt);
      }
      x += s.ox; y += s.oy;
      if (x < -4) x += W + 8; if (x > W + 4) x -= W + 8;

      const tw = 0.55 + 0.45 * Math.sin(this.t * s.tw + s.ph);
      const a = (0.28 + 0.5 * tw) * (0.45 + 0.55 * s.depth);
      /* Vaporwave dust: cyan through violet to magenta by star. */
      const hue = 185 + s.hue * 115;
      cx.fillStyle = `hsla(${hue}, 90%, ${62 + 16 * tw}%, ${a})`;
      const r = s.r * (W / 1600) * (0.8 + 0.4 * tw);
      cx.beginPath();
      cx.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2);
      cx.fill();
      /* the near layer gets a soft bloom */
      if (s.depth === 1.0 && tw > 0.75) {
        cx.fillStyle = `hsla(${hue}, 95%, 70%, ${a * 0.16})`;
        cx.beginPath(); cx.arc(x, y, r * 3.2, 0, Math.PI * 2); cx.fill();
      }
    }
  }
};


/* ==========================================================================
   GALAXY VIEWPORT — a 2.5D, drag-panned star map.

   The owner asked for a spatial render you scroll through, and suggested
   three.js. This game inlines into ONE self-contained HTML file that must run
   from file:// with no network, so a 600KB WebGL library is the wrong trade
   for what is, geometrically, a tilted plane. Instead:

     - the SVG map is laid on a CSS 3D plane with `perspective` + `rotateX`,
       so it recedes toward the horizon and reads as space rather than paper
       (browsers hit-test transformed SVG correctly, so every world stays
       clickable);
     - a Canvas2D starfield sits behind it and pans at a FRACTION of the
       plane's rate, which is the parallax that sells the depth;
     - drag pans, the wheel zooms about the cursor, and released drags carry
       momentum, so the map feels like a place rather than a diagram.

   All of it is inert under prefers-reduced-motion except the panning itself,
   which is an input, not an animation.
   ========================================================================== */
const GalaxyFX = {
  wrap: null, plane: null, cv: null, cx: null,
  x: 0, y: 0, z: 1,              /* pan offset and zoom            */
  vx: 0, vy: 0,                  /* momentum                       */
  dragging: false, moved: 0, raf: 0, stars: [], last: 0,

  MIN_Z: 0.75, MAX_Z: 2.4, TILT: 16,

  /** Restructure the wrap into starfield + tilted plane, once per render. */
  mount(wrap) {
    if (!wrap) return;
    const svg = wrap.querySelector('svg');
    if (!svg) return;
    /* TWO maps mount this now. Re-rendering the SAME map must keep the pan the
       player set -- the campaign map re-renders on every click -- while
       arriving on a DIFFERENT one must not inherit it, or THE UNIVERSE opens
       scrolled to wherever THE GALAXY was left. */
    if (this.wrap !== wrap) { this.x = 0; this.y = 0; this.z = 1; this.vx = 0; this.vy = 0; }
    this.wrap = wrap;
    wrap.classList.add('gx-viewport');

    /* A CLASS, not an id: two wraps each need their own canvas and two
       elements answering to #gx-stars is a document with a duplicate id in
       it. The CSS rule moved with it. */
    let cv = wrap.querySelector('.gx-stars-cv');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'gx-stars-cv';
      wrap.insertBefore(cv, wrap.firstChild);
    }
    let plane = wrap.querySelector('.gx-plane');
    if (!plane) {
      plane = document.createElement('div');
      plane.className = 'gx-plane';
      wrap.appendChild(plane);
    }
    if (svg.parentElement !== plane) plane.appendChild(svg);

    this.cv = cv; this.cx = cv.getContext('2d'); this.plane = plane;
    if (!this.stars.length) this.seed();
    this.bind(wrap);
    this.resize();
    this.apply();
    this.start();
  },

  seed() {
    /* Three depths. Deeper stars are dimmer, smaller and pan least. */
    const rnd = (i, k) => { const v = Math.sin(i * 91.7 + k * 47.3) * 43758.5453; return v - Math.floor(v); };
    this.stars = [];
    [[150, 0.12, 0.8], [90, 0.28, 1.3], [40, 0.5, 1.9]].forEach(([n, depth, size], li) => {
      for (let i = 0; i < n; i++)
        this.stars.push({ u: rnd(i, li * 5 + 1), v: rnd(i, li * 5 + 2), depth,
                          r: size * (0.5 + rnd(i, li * 5 + 3)),
                          hue: 185 + rnd(i, li * 5 + 4) * 115,
                          tw: 1.5 + rnd(i, li * 5 + 5) * 3 });
    });
  },

  /**
   * WINDOW listeners exactly once; WRAP listeners once per wrap.
   *
   * The old single `_bound` flag bound both sets to whichever wrap mounted
   * first. With a second map that is two bugs at once: THE UNIVERSE would get
   * no drag or wheel of its own, and had the window set been re-bound per
   * mount instead, one pointermove would have moved the plane twice.
   */
  bind(wrap) {
    if (!this._wired) {
      this._wired = true;
      window.addEventListener('pointermove', (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.px, dy = e.clientY - this.py;
        this.px = e.clientX; this.py = e.clientY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.x += dx; this.y += dy;
        this.vx = dx; this.vy = dy;
        this.clamp(); this.apply();
      }, { passive: true });
      window.addEventListener('pointerup', () => {
        if (!this.dragging) return;
        this.dragging = false;
        if (this.wrap) this.wrap.classList.remove('dragging');
      });
      window.addEventListener('resize', () => {
        if (this.wrap && this.wrap.isConnected) { this.resize(); this.apply(); }
      });
    }
    if (wrap._gxWired) return;
    wrap._gxWired = true;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (this.wrap !== wrap) return;
      this.dragging = true; this.moved = 0;
      this.px = e.clientX; this.py = e.clientY;
      this.vx = 0; this.vy = 0;
      wrap.classList.add('dragging');
    });
    /* A drag that travelled must not also count as a click on a world. */
    wrap.addEventListener('click', (e) => {
      if (this.moved > 6) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    wrap.addEventListener('wheel', (e) => {
      if (this.wrap !== wrap) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const ox = e.clientX - r.left - r.width / 2, oy = e.clientY - r.top - r.height / 2;
      const z0 = this.z;
      this.z = Math.max(this.MIN_Z, Math.min(this.MAX_Z, this.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      /* Keep the point under the cursor fixed while zooming. */
      const k = this.z / z0;
      this.x = ox - (ox - this.x) * k;
      this.y = oy - (oy - this.y) * k;
      this.clamp(); this.apply();
    }, { passive: false });
  },

  /** Never let the map be dragged entirely off its own viewport. */
  clamp() {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const lim = Math.max(0, (this.z - 1) * 0.5 * r.width) + r.width * 0.28;
    const limY = Math.max(0, (this.z - 1) * 0.5 * r.height) + r.height * 0.28;
    this.x = Math.max(-lim, Math.min(lim, this.x));
    this.y = Math.max(-limY, Math.min(limY, this.y));
  },

  apply() {
    if (!this.plane) return;
    this.plane.style.transform =
      `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) scale(${this.z.toFixed(3)})`;
  },

  resize() {
    if (!this.wrap || !this.cv) return;
    const r = this.wrap.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.max(1, Math.round(r.width * d));
    this.cv.height = Math.max(1, Math.round(r.height * d));
  },

  start() {
    if (this._running) return;
    this._running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this._running || !this.wrap || !this.wrap.isConnected
          || !this.cv || !this.cv.isConnected) { this._running = false; return; }
      const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
      this.last = t;
      /* Momentum after release, with a firm decay so it settles quickly. */
      if (!this.dragging && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) {
        this.x += this.vx; this.y += this.vy;
        const k = Math.pow(0.0016, dt);
        this.vx *= k; this.vy *= k;
        this.clamp(); this.apply();
      }
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop() { this._running = false; cancelAnimationFrame(this.raf); },

  /** Mirrors TitleFX.toggle: frames are only spent on a visible map. */
  toggle(on) { if (on) this.start(); else this.stop(); },

  draw(t) {
    const { cx, cv } = this;
    if (!cx || !cv.width) return;
    /* A hidden screen reports a zero-width box and the parallax below divides
       by it, which puts NaN into every star position for good. */
    const cw = this.wrap.clientWidth, ch = this.wrap.clientHeight;
    if (!cw || !ch) return;
    const W = cv.width, H = cv.height;
    cx.clearRect(0, 0, W, H);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const s of this.stars) {
      /* Parallax: a star at depth d moves d of the plane's pan. */
      let x = (s.u * W + this.x * s.depth * (W / cw)) % W;
      let y = (s.v * H + this.y * s.depth * (H / ch)) % H;
      if (x < 0) x += W; if (y < 0) y += H;
      const tw = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * s.tw + s.u * 9);
      cx.fillStyle = `hsla(${s.hue}, 88%, ${58 + 18 * tw}%, ${(0.18 + 0.42 * tw) * (0.4 + s.depth)})`;
      cx.beginPath();
      cx.arc(x, y, Math.max(0.4, s.r * (W / 1400) * (0.85 + 0.3 * tw)), 0, Math.PI * 2);
      cx.fill();
    }
  }
};
