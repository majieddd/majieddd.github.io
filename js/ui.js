/* ==========================================================================
   COSMIC CONQUEST — Interface Layer
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

/* -- THE FOUR-COLUMN LOADOUT (roadmap 19.12 / 19.15) ----------------------
   House rule puts every tunable in config.js. These live here for one round
   only because the units data model owns that file in parallel; move them
   across when it lands. */

/* Under this width the four columns cannot all hold a legible minimum.
   MEASURED, not guessed: two detail columns at 272 plus two pickers holding
   their two 138px tracks (2x138 + 9 gap + 28 padding = 313) plus three 14px
   gaps is 1212 of content, and .setup-wrap spends 48 more on its own padding
   -- 1260. 1280 is that with a little headroom.

   Below it the two DETAIL columns leave the grid for a drawer and the two
   PICKERS keep both tracks. Reflowing the pickers instead would stack the two
   decisions this screen exists to pair, which is a worse loss than the
   detail. Must stay equal to the media query in polish.css -- the drawer is
   opened from here and laid out from there, so a disagreement is a drawer
   that opens invisibly. */
const LO_FOUR_COL_MIN_PX = 1280;

/* How long after the souls counter settles the level-up call to action
   arrives on the end screen. It exists to stop the reward summary saying
   "points to spend" before the experience bar that earned them has moved:
   the punch has to follow the thing it is punching about. Same one-round
   exception as the constants above -- config.js is owned in parallel this
   session; move it across when that lands. */
const RW_SPEND_DELAY_MS = 1400;

/* The detail stage. Wider than the retired in-card stage (286) because it now
   has a column to itself, and a unit preview needs the run-up for a blink or
   a split to land on screen instead of starting off the left edge. */
const LO_STAGE_W = 300;
const LO_STAGE_H = 104;

/* Enemy radii are authored up to 18 (Broodmother), which is a third of the
   stage height before anything it carries is drawn. */
const UNIT_PREVIEW_MAX_R = 13;
/* Lane speed in px/sec, deliberately NOT the unit's own `speed`: a Luminark
   at its authored 0.62 crosses the stage in eleven seconds and nobody hovers
   that long. The card is a demonstration; the printed SPEED stat beside it is
   still the engine's number, which is the half that has to be true. */
const UNIT_PREVIEW_PPS = 46;
/* Traits are authored on a battle clock -- a Broodmother births every 4.0s, a
   Scrapjack jams every 6.8s -- so at authored cadence a hovering player sees
   neither happen. The stage runs them faster and the panel prints the
   authored interval next to it. */
const UNIT_TRAIT_TEMPO = 0.34;
const UNIT_BLINK_PX = 54;      /* one grapple, at stage scale               */
const UNIT_DOWN_S = 0.75;      /* how long a reviver stays down             */
const UNIT_PULSE_S = 0.85;     /* healer / aura pulse cadence               */
const UNIT_WARD_HIT_S = 1.9;   /* how often something breaks a ward         */
const UNIT_AURA_PX = 34;       /* aura ring at stage scale, not radius*TILE */

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
    /* Tower unlocks are shelved per BANNER since 19.6 and commanders are
       still install-wide, so a row reports ITS OWN shelf. The retired flat
       list was read here, and the copy beside it promised every profile the
       same arsenal -- which is the arrangement 19.6 exists to end. Souls stay
       per-profile and are still read from the row. */
    const vault = Meta.vault();
    $('#profile-list').innerHTML = names.map(n => {
      const r = Meta.root().profiles[n];
      const shelf = vault.unlockedBy[r.faction || NO_BANNER_SHELF] || STARTER_TOWERS;
      const lv = Object.values(r.commanders || {}).reduce((s, c) => s + (c.xp || 0), 0);
      const fa = r.faction ? FACTIONS[r.faction] : null;
      return `<button class="profile-row ${n === active ? 'active' : ''}" data-profile="${n}"
              data-tt="${n}|${fa ? fa.name + '. ' : 'No allegiance chosen. '}This banner's arsenal holds ${
                shelf.length} ${shelf.length === 1 ? 'tower' : 'towers'}; ${
                ((vault.cmdUnlockedBy || {})[r.faction || NO_BANNER_SHELF] || []).length} ${
                ((vault.cmdUnlockedBy || {})[r.faction || NO_BANNER_SHELF] || []).length === 1
                  ? 'commander is' : 'commanders are'
                } recruited under this banner. ${
                r.souls || 0} souls banked.${r.campaign ? ' Campaign in progress.' : ''}">
        <span class="pr-name">${n}</span>
        <span class="pr-meta">◉ ${r.souls || 0} souls · ${r.campaign ? 'node ' + (r.campaign.depth + 1) : 'no campaign'} · ${formatNum(lv)} XP</span>
        ${names.length > 1 ? `<span class="pr-del" data-del="${n}" title="Delete" role="button" aria-label="Delete profile ${n}">✕</span>` : ''}
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
    /* THE HOLD CHIP DIES WITH THE BATTLE. It used to be removed only by
       showEscalationChoice's two re-entry paths, so leaving a match with an
       escalation held left the pulsing chip on top of the NEXT board -- and
       clicking it reopened a `required` modal (Esc cannot dismiss it) holding
       the LAST match's three cards, which takeEscalation would then commit
       for real onto a battle they were never offered in. Retired here because
       this is the one place every exit route passes through, the same
       reasoning closeLoadoutCard is called on the line above. */
    if (id !== 'screen-game') this._removeEscHoldChip();
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
    const ov = $('#overlay-souls');
    ov.classList.remove('hidden');
    this._soulShopClosed = onClose || null;
    /* Escape dismisses an overlay through closeTopOverlay, which never ran
       the caller's redraw -- so a tower bought and then dismissed with the
       key instead of the X was owned by the save and invisible to the screen
       underneath. Publishing the hook here puts it on the way IN, the one
       path every open passes. */
    ov._escDismiss = () => {
      const cb = this._soulShopClosed; this._soulShopClosed = null; if (cb) cb();
    };
  },

  /** Republish an arsenal change to every screen that renders from it.
      Called the MOMENT the vault changes rather than on the way out of the
      shop: the redraw used to hang off one of the shop's two exits, so a
      purchase was not selectable until the screen was left and re-entered. */
  refreshArsenalViews() {
    this.renderTitle();
    if (!$('#screen-loadout').classList.contains('hidden')) this.renderLoadout();
    if (!$('#screen-command').classList.contains('hidden')) this.buildCommanderScreen();
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
      if (!Meta.campaign()) { this.beginCampaign(); return; }
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
    $('#btn-back-title').addEventListener('click', () => { Sound.play('click');
      /* Walking out of the commander screen abandons the post-match detour
         with it. Left standing, a skirmish's pending route would divert the
         NEXT press of SELECT THEATRE to the multiverse. */
      this.clearLevelRoute();
      this.renderTitle(); this.show('screen-title'); });

    $('#btn-to-theatre').addEventListener('click', () => { Sound.resume(); Sound.play('click');
      /* A post-match level-up borrows this button for exactly one press: it
         is the way off the commander screen, so resuming the route here
         costs the detour no extra click and cannot strand a skirmish on the
         campaign map -- renderTheatre OPENS a campaign for any sworn profile
         that has none, which is the ledger a skirmish promises not to touch. */
      const lr = this._levelRoute;
      this.clearLevelRoute();
      if (lr && lr.dest === 'multiverse') { this.show('screen-multiverse'); this.renderMultiverse(); return; }
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

    /* Reduced motion. The checkbox is the USER override -- the OS preference
       already works without it. One writer for all three surfaces: the cached
       canvas gate, the CSS class, and the saved setting. */
    const rm = $('#set-reduced-motion');
    rm.addEventListener('change', () => {
      setReducedMotion(rm.checked);
      document.body.classList.toggle('rm-user', rm.checked);
      this.saveSettings();
    });

    /* IMMERSIVE BOARD. The HUD and the sidebar become layers over a board
       that fills the window. Game.resize has to run AFTER the class lands or
       it measures the box the canvas is leaving, not the one it is taking --
       and the background is baked at the fitted scale, so it is re-baked too. */
    const imm = $('#btn-immersive');
    if (imm) imm.addEventListener('click', () => { this.toggleImmersive(); Sound.play('click'); });

    /* Damage numbers. Presentation only -- the gate sits in registerDamage,
       so flipping it mid-battle takes effect on the next landed hit. */
    const dn = $('#set-dmg-numbers');
    dn.addEventListener('change', () => {
      setDamageNumbers(dn.checked);
      this.saveSettings();
    });

    /* SAVE FILE I/O. localStorage is one browser-profile eviction away from a
       lost campaign, and there was no way to move an install between
       machines. Export writes the whole profile root; import replaces it. */
    $('#btn-export-save').addEventListener('click', () => this.exportSave());
    $('#btn-import-save').addEventListener('click', () => $('#import-file-input').click());
    $('#import-file-input').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this.importSave(f);
      e.target.value = '';
    });

    $('#btn-end-menu').addEventListener('click', () => { this.el.endOverlay.classList.add('hidden'); this.toMenu(); });
    $('#btn-end-retry').addEventListener('click', () => {
      this.el.endOverlay.classList.add('hidden');
      /* 20.5 -- a run that earned points the chart can accept goes to the
         CHART first and to its real destination after. The destination is
         decided HERE, while Game._skirmish is still true, and carried on
         _levelRoute; the condition is Game.lastLevelUp.route, the same one
         endRetryLabel names the button after, so the label cannot promise a
         place the click does not go. Win or lose: a defeat pays the XP too. */
      const lu = Game.lastLevelUp;
      if (lu && lu.route) {
        this._levelRoute = { dest: Game._skirmish ? 'multiverse' : 'theatre',
                             commander: lu.commander, points: lu.points };
        /* The chart that opens must be the chart that levelled. Without the
           touched flag buildCommanderScreen re-defaults an unaligned CADRE
           back to a commander of your own faction, which is the one screen
           this route must never land on. */
        this.sel.commander = lu.commander; this._cmdTouched = true;
        const foot = $('#btn-to-theatre');
        if (foot) {
          if (this._cmdFootLabel === undefined) this._cmdFootLabel = foot.textContent;
          foot.textContent = this._levelRoute.dest === 'multiverse'
            ? 'TO THE MULTIVERSE →' : 'TO THE GALAXY →';
        }
        this.show('screen-command'); this.buildCommanderScreen();
        return;
      }
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

  /** Retire a pending post-match detour and put the footer button's own
      name back. One place, because two would eventually disagree. */
  clearLevelRoute() {
    if (!this._levelRoute) return;
    this._levelRoute = null;
    const foot = $('#btn-to-theatre');
    if (foot && this._cmdFootLabel !== undefined) foot.textContent = this._cmdFootLabel;
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
    /* THE DUEL QUESTION IS ASKED FIRST AND THE SKIRMISH QUESTION SECOND, because
       a duel answers `Game._skirmish` true and answers the campaign lookup null.
       With the lookup first, abandoning a duel returned to the title without
       ever calling endMatch — the only path Net.finish hangs off — so the relay
       stayed live: the peer waited on a heartbeat that never stopped, and the
       next Game.start built Game.sides through a lens still switched on and died
       on undefined.faction with no try/catch above it. */
    if (Net.live) {
      /* No garrison holds a duel board — the other commander does, and leaving
         hands them the win the moment the concession lands (net.js posts
         `quit`, and the peer resolves it as a win). */
      this.confirmBox('CONCEDE THE DUEL?',
        '<p>Your rival <b>takes the win</b> the moment you leave the field. ' +
        'Nothing in your campaign changes &mdash; a duel never writes to it.</p>',
        'CONCEDE', () => Game.endMatch(false, true));
      return;
    }
    if (Game._skirmish) {
      /* A garrison skirmish never touched the campaign ledger, so it must not
         threaten it either. */
      this.confirmBox('ABANDON SKIRMISH?',
        '<p>The garrison keeps the world. Nothing in your campaign changes.</p>',
        'ABANDON', () => Game.endMatch(false, true));
      return;
    }
    const c = Meta.campaign();
    /* No campaign and no skirmish is a board that should not exist, and it still
       leaves through endMatch: an exit that skips endMatch skips everything
       endMatch tears down. */
    if (!c) { Game.endMatch(false, true); return; }

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
    /* THE LAST GATE ON THE ONE-EXIT RULE. Every road out of a battle is meant to
       pass through endMatch, which is the only caller of Net.finish; a road that
       does not leaves a relay live behind a title screen, and the next
       Game.start dies building its sides through a lens nobody switched off.
       Callers that already ended properly read `live` false and pay nothing. */
    if (Net.live) Game.endMatch(false, true);
    Game.state = 'menu'; Sound.stopMusic();
    this.el.endOverlay.classList.add('hidden');
    /* Through hideChoice, which is the one place that also EMPTIES the body.
       Adding the class alone left the cards bound to Game.takeMod, standing
       invisibly behind the title screen with a click still able to reach the
       engine. */
    this.hideChoice();
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
                 /* The EQUIPPED commander is the standing order and outranks
                    the session's browsing pick -- that is what EQUIP means.
                    With no standing order: the session pick if visited, else
                    your faction's own commander rather than an arbitrary one. */
                 commander: Meta.equipped() ||
                   ((this.sel.commander && Meta.isCommanderUnlocked(this.sel.commander))
                   ? this.sel.commander
                   : (Meta.isCommanderUnlocked(freeCommanderOf(Meta.faction() || 'human'))
                       ? freeCommanderOf(Meta.faction() || 'human') : 'cadre')),
                 loadout: this.sel.loadout.slice(),
                 arena: node.arena, boons: c.boons, rival: node.rival,
                 escStart: node.escStart,
                 /* THE RAMP and THE SYSTEM, handed over as options. Game.start
                    reads these and nothing else to decide the tier step and
                    whether the first galaxy's flattening applies -- which is
                    why a skirmish, a duel and the pins, none of which pass
                    them, keep the engine defaults. */
                 ramp: (c && c.ramp) || RAMP_DEFAULT,
                 systemIndex: (typeof node.si === 'number') ? node.si : undefined,
                 /* The OPTIONS battle seed, if one is set. Blank means today's
                    behaviour exactly. */
                 seed: (() => { const v = ($('#set-seed') || {}).value;
                                return v && v.trim() ? (parseInt(v, 10) | 0) : undefined; })() });
    this.show('screen-game');
    this._inspKey = null;
    this.buildShop();
    this.buildAbilityBar();
    /* DEPLOY-TIME HONESTY for 2x2 heavies: the loadout slot is spent either
       way, but a commander must learn the map cannot seat one NOW, not three
       waves in with the gold already saved. Checked against the REAL built
       FIELD (Game.start has run), and non-blocking -- the other towers still
       fight, and rubble clearance can open ground later. */
    if (this.sel.loadout.some(t => towerFoot(TOWER_TYPES[t]) > 1) && !Game.canFitFoot(0, 2))
      Game.banner('NO GROUND FITS A 2×2 EMPLACEMENT ON THIS MAP', 4, '#f59e0b');
    if (!Game._skirmish) this.showBattleIntro();
    this.startFirstRunCoach();
    this.syncAll();
  },

  /* ═══════════════════════════════════ THE FIRST-RUN COACH (A1) ═══ */

  /** The first campaign battle a profile fights gets four hints keyed to what
      is actually happening on its board. The only teaching surfaces this game
      ships are a 50K-character field manual and per-enemy dossiers, and
      neither is read during wave two -- the novice wall the repo measures at
      waves 6-10 is reached by players who were never told the rules that
      decide it. Every beat is a LIVE predicate over engine state rather than a
      timer, so a hint can never describe something the player has not seen.

      What each guard prevents:
      - `Net.live`: a duel is lockstep. Nothing here mutates the simulation,
        but a coach is still one client running a loop the other is not, and
        the guard costs a comparison. Today no duel reaches this function --
        Net.start passes `skirmish: true` (js/net.js) -- and that is exactly
        the kind of accident the next entry point stops inheriting.
      - `Game.noReanim`: the arena suspends reanimation outright (config.js),
        so the reanimation beat would be teaching a law that board repeals.
        Guarded on the STEP, not on the coach: a three-seat contested world
        still reanimates and its commander still needs the other three hints.
      - `coachDone` rides the ACTIVE PROFILE, not the install: a second
        commander file is a second first battle. It is a plain field on the
        object Meta.load() returns, so the OPTIONS save export carries it and
        an import restores it with no allow-list to keep in step.

      Nothing here draws a random number. The seeded battle window wraps
      Game.start and Game.step and nothing else (js/game.js); this loop is a
      timer callback outside both, so a seeded replay is identical with the
      coach running or retired. */
  startFirstRunCoach() {
    if (Game._skirmish) return;
    if (typeof Net !== 'undefined' && Net.live) return;
    if (Meta.load().coachDone) return;
    const S = Game.sides[0];
    /* Read off the board rather than hard-coded: hotkey 1 is loadout[0], and
       that is whatever the player put in the first slot, not always BOLT. */
    const first = TOWER_TYPES[S.loadout[0]];
    const steps = [
      { at: () => true,
        text: 'Press 1 to take ' + ((first && first.name) || 'your first tower') +
              ', then click a buildable tile on YOUR half of the board.' },
      { at: () => S.towers.length > 0,
        text: 'It fires on its own. Kills pay gold — U upgrades the tower you have selected, S sells it back.' },
      /* Keyed to a reanimate ALREADY WALKING, never to the kill counter: a
         carrier kill increments stats.kills too (game.js killEnemy), and a
         carrier hands lives back instead of marching, so the counter would
         have fired this line on the one death that disproves it. */
      /* KEYED TO THE RITE. The universal "everything you kill rises" line was
         true for one doctrine out of five once summoning split; teaching a
         Federation player that their kills come back would be teaching them
         the one thing their commander cannot do. Each beat waits for the
         thing its own rite actually produces. */
      (() => {
        const d = (Game.doctrineOf && Game.doctrineOf(0)) || null;
        const id = d ? d.id : 'human';
        if (id === 'light') return {
          at: () => !Game.noReanim && S.procCycle + S.procIdx > 0,
          text: 'THE PROCESSION marches on a clock, kills or no kills — and every full cycle it marches heavier.' };
        if (id === 'xeno') return {
          at: () => !Game.noReanim && Game.incubators.some(p => p.side === 0),
          text: 'That kill did not die — it is incubating where it fell. Kills beside a clutch hatch it sooner.' };
        if (id === 'pirate') return {
          at: () => Game.canMuster(0) && Game.musterTiers(0).some(t => Game.canMuster(0, t)),
          text: 'Nothing rises free under your flag. Bodies are bought — and your POWER and ECON have no ceiling.' };
        if (id === 'robotic') return {
          at: () => !Game.noReanim &&
                    Game.enemies.some(e => e.hostileTo === 0 && e.reanimated && !e.carrier),
          text: 'THE LATTICE returns every kill exactly as it fell. It cannot be bought, and it does not need to be.' };
        return {
          at: () => !Game.noReanim &&
                    Game.enemies.some(e => e.hostileTo === 0 && e.reanimated && !e.carrier),
          text: 'Your kills draft — each one summons a soldier from your own roster and marches it at your rival. That is the INBOUND count in the sidebar.' };
      })(),
      /* THE THEFT, not the loss. A leak no longer spends lives on contact:
         the unit turns around carrying them and only charges you if it walks
         off the spawn edge, so the teachable moment is while the carrier is
         still on the board and still killable. */
      { at: () => Game.enemies.some(e => e.hostileTo === 0 && e.carrier),
        text: 'That one is carrying your lives to the edge. Nothing is spent until it gets out — kill it first and you pay nothing.' },
    ];
    const fired = steps.map(() => false);
    let shown = 0, done = false, hideT = 0;
    const tip = () => document.getElementById('coach-tip');
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(poll); clearTimeout(stopT); clearTimeout(hideT);
      /* Only a coach that actually TAUGHT something is retired. Opening a
         battle and walking straight back out is not a lesson, and burning the
         flag there is how a first-run aid becomes one nobody ever sees. */
      if (shown > 0) { Meta.load().coachDone = true; Meta.save(true); }
      const t = tip(); if (t) t.remove();
    };
    const poll = setInterval(() => {
      if (done) return;
      /* LEFT THE BOARD. The screen is the truth here, because Game.state parks
         at 'over' until UI.show moves it on and passes through 'choosing' and
         'escalating' mid-battle -- a state test retired the coach on the first
         draft. Returning as well as finishing is the other half: without the
         return this tick went on to build a tip on the screen it had just
         left, with a GOT IT whose handler was already spent. */
      if ($('#screen-game').classList.contains('hidden')) { finish(); return; }
      /* A hint must not burn its nine seconds behind a modal, behind a pause,
         or in a backgrounded tab -- nobody is reading it in any of the three.
         `.overlay:not(.hidden)` is the guard main.js already uses; an id list
         goes stale on the next overlay somebody adds. */
      if (Game.paused || document.hidden) return;
      if (document.querySelector('.overlay:not(.hidden)')) return;
      /* Independent, not sequential: a beat that never happens on this board
         must not dam the beats behind it. */
      const i = steps.findIndex((s, n) => !fired[n] && s.at());
      if (i < 0) return;
      fired[i] = true; shown++;
      let box = tip();
      if (!box) {
        box = document.createElement('div');
        box.id = 'coach-tip';
        box.className = 'coach-tip';
        /* Static markup only; the step copy is engine text and lands through
           textContent below. */
        box.innerHTML = '<b>COACH</b><span></span><button class="btn btn-sm" id="coach-done">GOT IT</button>';
        document.body.appendChild(box);
        $('#coach-done', box).addEventListener('click', () => { Sound.play('click'); finish(); });
      }
      $('span', box).textContent = steps[i].text;
      box.classList.add('show');
      Sound.play('click');
      clearTimeout(hideT);
      hideT = setTimeout(() => { const b = tip(); if (!done && b) b.classList.remove('show'); }, 9000);
      if (fired.every(Boolean)) setTimeout(finish, 9200);
    }, 1500);
    /* A hard stop, so the loop can never outlive a tab left open on a paused
       battle for an afternoon. */
    const stopT = setTimeout(finish, 8 * 60 * 1000);
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
      /* The engine's own aimed() (entities.js) pulls the barrel back by
         recoil*4. Dropping the translate here meant the firing preview
         computed a recoil every frame and then threw it away, so the gun in
         the shop never once reacted to its own shot. Static icons pass
         recoil 0, so the translate is a no-op for them. */
      aimed(c2, fn) {
        c2.save(); c2.rotate(this.angle); c2.translate(-this.recoil * 4, 0);
        fn(); c2.restore();
      }
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
      <p class="hint">Human hardware is sold to everyone. A power's own arsenal is only for
        sale while you are sworn to it, and whatever you buy joins <b>that banner's</b>
        shelf — another commander's file does not inherit it. Each ARSENAL purchase
        raises the next arsenal price on this banner by ${SOUL_INFLATION_STEP};
        commanders and abilities climb their own ladders, not this one.</p>
      <div class="soul-grid unlocks">${TOWER_ORDER.filter(id =>
          !Meta.isTowerUnlocked(id) && !Meta.isStoryTower(id)).map(id => {
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
                ${(lock || poor) ? 'aria-disabled="true"' : ''}
                data-preview="${id}">
          <span class="si-fig">${this.towerIconHTML(id, 40)}</span>
          <span class="si-name">${t.name}</span>
          <span class="si-el" style="--el:${el.color}">${el.icon} ${el.name}</span>
          <span class="si-og" style="--og:${og.color}">${og.icon} ${og.name}</span>
          ${lock
            ? `<span class="si-lock">⊘ SWORN TO ${lock.name} ONLY</span>`
            : `<span class="si-cost">◉ ${Meta.towerUnlockCost()}</span>`}
        </button>`;
      }).join('') || '<p class="hint">Every tower on sale is unlocked.</p>'}</div>

      <h3 class="section-label">DETACHMENT — recruit a soldier permanently (◉${Meta.unitUnlockCost()} each)</h3>
      <p class="hint">A unit bought outright is <b>install-wide</b>: any commander, under any
        banner, may field it from then on. Your own power's soldiers are always for sale;
        another power's are rescued on the battlefield, not bought — and machine soldiers
        go on sale to everyone once this install has taken a galaxy.</p>
      ${/* THE MISSING DOOR. canUnlockUnit, unlockUnit, soulPrice('unit') and
            the `banner/unit` ledger key all shipped and had NO call site
            anywhere -- while two other surfaces told the player to come here
            and buy one, one of them a button that opened this very shop. */ ''}
      <div class="soul-grid unlocks">${(typeof unitTrackIds === 'function' ? unitTrackIds() : [])
          .filter(id => !Meta.isMusterUnlocked(id)).map(id => {
        const d = ENEMY_TYPES[id]; if (!d) return '';
        const host = d.faction ? FACTIONS[d.faction] : MACHINE_HOST;
        const lock = Meta.unitOriginLock(id);
        const poor = Meta.souls() < Meta.unitUnlockCost();
        return `<button class="soul-item unlock${lock ? ' origin-locked' : ''}" data-unlock-unit="${id}"
                style="--cc:${lock ? host.color : d.color}"
                ${(lock || poor) ? 'aria-disabled="true"' : ''}>
          <span class="si-fig">${this.unitIconHTML(id, 40)}</span>
          <span class="si-name">${d.name}</span>
          <span class="si-og" style="--og:${host.color}">${host.icon} ${host.short || host.name}</span>
          ${lock
            ? `<span class="si-lock">⊘ RESCUED, NOT SOLD — ${lock.name}</span>`
            : `<span class="si-cost">◉ ${Meta.unitUnlockCost()}</span>`}
        </button>`;
      }).join('') || '<p class="hint">Every soldier on sale is already yours.</p>'}</div>

      <h3 class="section-label">THE MACHINE LINE — issued, never sold</h3>
      <p class="hint">Robotic hardware answers to no power and is not for sale at any price.
        Conquer a solar system and the next machine on the line is issued to you.</p>
      <!-- Listed in ISSUE order, not roster order: the ladder is the whole
           point of the section, and storyPending is the same list
           grantStoryTower draws the next machine from. -->
      <div class="soul-grid unlocks">${Meta.storyPending().map(id => {
        const t = TOWER_TYPES[id];
        const el = ELEMENTS[t.element];
        const og = originOf(id);
        /* No price and no button behaviour: this entry cannot be bought, so
           it must not carry a figure that looks like one. `n` comes from the
           same pending list grantStoryTower issues from. */
        const n = Meta.storySystemsFor(id);
        return `<button class="soul-item unlock story-locked" data-story="${id}"
                style="--cc:${og.color}" aria-disabled="true" data-preview="${id}">
          <span class="si-fig">${this.towerIconHTML(id, 40)}</span>
          <span class="si-name">${t.name}</span>
          <span class="si-el" style="--el:${el.color}">${el.icon} ${el.name}</span>
          <span class="si-og" style="--og:${og.color}">${og.icon} ${og.name}</span>
          <span class="si-lock">✦ ${n === 1 ? 'TAKE A SOLAR SYSTEM'
                                             : 'TAKE ' + n + ' SOLAR SYSTEMS'}</span>
        </button>`;
      }).join('') || '<p class="hint">The whole machine line has been issued.</p>'}</div>`;

    this.paintTowerIcons(body);
    this.bindChipTips(body);
    /* Every buyer redraws the SHOP (prices just went up for everything else on
       this banner) and then republishes to the screens underneath. */
    $$('[data-unlock-cmd]', body).forEach(b => b.addEventListener('click', () => {
      if (Meta.unlockCommander(b.dataset.unlockCmd))
        { Sound.play('branch'); this.renderSoulShop(); this.refreshArsenalViews(); }
      else Sound.play('denied');
    }));
    $$('[data-unlock-abil]', body).forEach(b => b.addEventListener('click', () => {
      if (Meta.unlockAbility(b.dataset.unlockAbil))
        { Sound.play('branch'); this.renderSoulShop(); this.refreshArsenalViews(); }
      else Sound.play('denied');
    }));
    this.bindTowerPreviews(body);
    $$('[data-unlock]', body).forEach(b => b.addEventListener('click', () => {
      /* aria-disabled, not disabled: a DISABLED button receives no mouse
         events at all in Chromium or Firefox, which silently killed the
         firing preview on every card a player had not yet bought -- which is
         every card this grid shows. The refusal moved here instead. */
      if (b.getAttribute('aria-disabled') === 'true') { Sound.play('denied'); return; }
      if (Meta.unlockTower(b.dataset.unlock))
        { Sound.play('branch'); this.renderSoulShop(); this.refreshArsenalViews(); }
      else Sound.play('denied');
    }));
    $$('[data-unlock-unit]', body).forEach(b => b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') { Sound.play('denied'); return; }
      if (Meta.unlockUnit(b.dataset.unlockUnit))
        { Sound.play('branch'); this.renderSoulShop(); this.refreshArsenalViews(); }
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
    /* Default to the EQUIPPED commander, then to one of your own faction --
       choosing the Xeno and being handed a Humanity commander made the
       faction choice look cosmetic, and an equip order that the screen then
       ignored would make the EQUIP button look cosmetic too. */
    const eq = Meta.equipped();
    const sel = owned.find(c => c.id === this.sel.commander);
    if (!sel || (!this._cmdTouched && sel.id !== eq && sel.faction !== mine))
      this.sel.commander = (owned.find(c => c.id === eq) ||
                            owned.find(c => c.faction === mine) || owned[0]).id;

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
          <span class="cmd-name">${stars ? '<em class="pstars">' + '★'.repeat(stars) + '</em> ' : ''}${c.name}${
            Meta.equipped() === c.id ? ' <em class="cmd-eq-badge">⚑ IN COMMAND</em>' : ''}</span>
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
    /* Live, not the count the end screen quoted: the banner has to vanish on
       the click that spends the last legal point rather than sit there
       announcing work already done. */
    const spendNow = (this._levelRoute && this._levelRoute.commander === c.id)
      ? Meta.spendableTech(c.id).length : 0;

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
      ${Meta.equipped() === c.id
        ? `<div class="cd-equipped" role="status">⚑ IN COMMAND — ${c.name} deploys with your next battle.</div>`
        : `<button class="btn btn-primary cd-equip" data-equip="${c.id}">⚑ EQUIP ${c.name}</button>`}
      ${spendNow ? `
        <div class="cd-spend" role="status" style="--cc:${c.color}">
          <b>${pts} POINT${pts === 1 ? '' : 'S'} TO SPEND</b>
          <span>Earned in your last battle. ${spendNow === 1
            ? 'One talent can be taken now' : spendNow + ' talents can be taken now'} — they are the lit ones.
            ${this._levelRoute.dest === 'multiverse' ? 'The multiverse' : 'The galaxy'} is one press away when you are done.</span>
        </div>` : ''}
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

    /* The slot above the rail: one line that always answers "who deploys?".
       Rendered here rather than in buildCommanderScreen so an EQUIP click
       (which only re-renders) still moves it. */
    const slot = $('#cmd-slot');
    if (slot) {
      const eqc = COMMANDERS.find(x => x.id === Meta.equipped());
      slot.innerHTML = eqc
        ? `<b>IN COMMAND</b>
           <span class="cs-name" style="--cc:${eqc.color}">${eqc.name}</span>
           <em>${eqc.title}</em>`
        : `<b>IN COMMAND</b>
           <span class="cs-none">No standing order — press ⚑ EQUIP on a commander.</span>`;
    }
    const eqBtn = $('[data-equip]');
    if (eqBtn) eqBtn.addEventListener('click', () => {
      if (Meta.equipCommander(eqBtn.dataset.equip)) {
        this.sel.commander = eqBtn.dataset.equip; this._cmdTouched = true;
        Sound.play('tech');
        this.buildCommanderScreen();
      } else Sound.play('denied');
    });

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
    /* Only while a post-match detour is standing on THIS commander. A chart
       that pulses every time it has a spare point would stop meaning
       anything, and the point of the route is that this visit is different. */
    const lit = !!(this._levelRoute && this._levelRoute.commander === c.id);
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
          <button class="tal-node ${owned ? 'owned' : can ? 'can' : 'locked'}${lit && !owned && can ? ' ready' : ''}"
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
    /* The fifth banner appears only once this install has taken a galaxy, and
       until then there is no card at all -- not a locked one. A locked card is
       an advertisement, and a secret that advertises itself is a menu item. */
    const secret = Meta.gameBeaten() ? SECRET_FACTIONS : [];
    $('#faction-grid').innerHTML = FACTION_ORDER.concat(secret).map(id => {
      const f = FACTIONS[id];
      const isSecret = secret.indexOf(id) >= 0;
      const cmd = COMMANDER_ROSTER.find(c => c.id === freeCommanderOf(id)) || COMMANDER_ROSTER[0];
      return `<button class="fac-card ${chosen === id ? 'on' : ''}" data-fac="${id}"
                      style="--fc:${f.color};--fa:${f.accent}"
                      data-tt="${f.name}|${f.bonusName}: ${f.bonusDesc} Their rivals are ${
                        rivalFactionsOf(id).map(x => FACTIONS[x].short).join(', ')}. You begin with ${cmd.name}, ${cmd.title}.${
                        isSecret ? ' Unlocked the day this install first conquered a galaxy.' : ''}">
        ${isSecret ? '<span class="fac-secret">SECRET BANNER · UNLOCKED BY CONQUEST</span>' : ''}
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
    const V = GX_WORLD;
    /* The nebula clouds are placed as FRACTIONS of the frame, not as the
       literal coordinates they used to be. Those literals were pitched at a
       137x99 frame; painted into a 620x400 one they would both have sat in the
       top-left eighth of the galaxy, which is how the map came to have art
       hanging off its own edge the last time the frame moved. */
    const f = (fx, fy, rx, ry) => ({ cx: (V.x + V.w * fx).toFixed(1), cy: (V.y + V.h * fy).toFixed(1),
                                     rx: (V.w * rx).toFixed(1), ry: (V.h * ry).toFixed(1) });
    const c1 = f(0.26, 0.24, 0.32, 0.22), c2 = f(0.72, 0.70, 0.30, 0.19);
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
    <ellipse cx="${c1.cx}" cy="${c1.cy}" rx="${c1.rx}" ry="${c1.ry}" fill="#5b4ee0" filter="url(#${p}nebNoise)" opacity=".5"/>
    <ellipse cx="${c2.cx}" cy="${c2.cy}" rx="${c2.rx}" ry="${c2.ry}" fill="#0e7490" filter="url(#${p}nebNoise)" opacity=".45"/>
    <g class="gx-bd"></g>`;
  },

  /**
   * The in-world starfield, built ONCE and cloned in afterwards.
   *
   * At the density GX_WORLD is tuned to this is 4287 stars. Emitted as one
   * <circle> each inside the innerHTML string that is 4287 elements the
   * browser re-parses on every click, on a screen that re-renders whenever a
   * course is set. Four pooled <path>s built once and cloned costs one parse
   * for the whole session -- and the stars are decoration, so nothing about
   * them needs to be addressable.
   */
  gxStarfield() {
    if (this._gxStars) return this._gxStars.cloneNode(true);
    const V = GX_WORLD, B = 4;
    /* R2, the two-dimensional low-discrepancy sequence off the plastic
       constant: uniform over the whole RECTANGLE with no lattice. The old
       golden-angle spiral only covered the ellipse inscribed in the frame and
       packed its middle -- on a frame this size that leaves four empty
       corners and a visible band, which reads as a bug rather than as space. */
    const g = 1.32471795724474602596, a1 = 1 / g, a2 = 1 / (g * g);
    const buckets = [];
    for (let b = 0; b < B; b++) buckets.push([]);
    for (let i = 1; i <= GX_BACKDROP_STARS; i++) {
      const sx = V.x + ((0.5 + a1 * i) % 1) * V.w;
      const sy = V.y + ((0.5 + a2 * i) % 1) * V.h;
      const k = i % B, r = (0.10 + k * 0.028).toFixed(3), d = (0.20 + k * 0.056).toFixed(3);
      buckets[k].push('M' + sx.toFixed(1) + ' ' + (sy - (0.10 + k * 0.028)).toFixed(2) +
                      'a' + r + ' ' + r + ' 0 1 0 0 ' + d + 'a' + r + ' ' + r + ' 0 1 0 0 -' + d + 'z');
    }
    const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g2.setAttribute('class', 'gx-bd');
    g2.innerHTML = buckets.map((b, k) =>
      '<path d="' + b.join('') + '" fill="rgba(255,255,255,' + (0.11 + k * 0.05).toFixed(2) + ')"/>').join('');
    this._gxStars = g2;
    return g2.cloneNode(true);
  },

  /** Swap the starfield placeholder for the built one. Called by both maps, so
      neither can be the one that quietly forgets its stars. */
  gxPaintStars(root) {
    const slot = root && root.querySelector('.gx-bd');
    if (slot) slot.replaceWith(this.gxStarfield());
  },

  /**
   * THE KEY. Six states drawn in four channels is a private language without
   * one, and a map whose whole job is showing progress cannot afford to be
   * read wrong. Every swatch is drawn from the same marks the worlds use, so
   * the key cannot drift away from the thing it explains. Campaign map only:
   * the universe map has one state and needs no key for it.
   */
  gxLegend(myF) {
    const sw = inner => `<svg viewBox="0 0 16 16" aria-hidden="true">${inner}</svg>`;
    const dot = '<circle class="lg-dot" cx="8" cy="8" r="4"/>';
    const ring = '<circle class="lg-ring" cx="8" cy="8" r="5.6"/>';
    const rows = [
      ['held', 'HELD', sw(dot + ring)],
      ['partial', 'TAKING', sw(dot + ring +
        '<circle class="lg-claim" cx="8" cy="8" r="7.2" pathLength="100" ' +
        'stroke-dasharray="33 100" transform="rotate(-90 8 8)"/>')],
      ['claimed', 'YOURS', sw('<circle class="lg-dot mine" cx="8" cy="8" r="4"/>' +
        '<circle class="lg-claim" cx="8" cy="8" r="7.2"/>')],
      ['contested', 'CONTESTED', sw(dot +
        '<circle class="lg-ring" cx="8" cy="8" r="5.6" pathLength="100" stroke-dasharray="50 50"/>' +
        '<circle class="lg-ring2" cx="8" cy="8" r="5.6" pathLength="100" ' +
        'stroke-dasharray="50 50" stroke-dashoffset="-50"/>')],
      ['seat', 'SEAT', sw(dot + '<circle class="lg-seat" cx="8" cy="8" r="7.2"/>')],
      ['locked', 'SEALED', sw(dot + ring)]
    ];
    return `<div class="gx-legend" style="--yc:${myF.color}" aria-hidden="true">` +
      rows.map(r => `<i class="lg lg-${r[0]}">${r[2]}<b>${r[1]}</b></i>`).join('') +
      `</div>`;
  },

  /**
   * ONE world, painted. Paint order bottom to top: dot, painted planet clipped
   * to the disc, core shading, YOUR CLAIM RISING UP THE DISC, owner ring(s),
   * the contested ⚔, the claim ring, your sigil, then the star pips. The rings
   * and the marks stay ABOVE the picture -- they are the ownership read and the
   * picture is decoration.
   *
   * `opts.claim` is 0..1 (stars / GX_CLAIM_STARS) and `opts.claimed` is the
   * third star landing; `opts.sigil` is the player faction's glyph. The
   * universe map passes none of them, because a relay keeps no star ledger and
   * a claim mark there would be a claim about a record that does not exist.
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
    /* THE TIDE. Your faction's colour rises up the world as you take it, a
       third of the disc per star, so a claim reads as IN PROGRESS instead of
       flipping all at once on the third. It reads without hue as well: a disc
       two-thirds full is a different SHAPE from an empty one at any zoom and
       to any eye. Clipped to the disc so the painted planet keeps its edge. */
    const claim = Math.max(0, Math.min(1, o.claim || 0));
    if (claim > 0) {
      const tid = p + 'ct_' + String(w.id).replace(/[^a-z0-9]/gi, '');
      const th = r * 2 * claim, top = wy + r - th;
      out.push(`<clipPath id="${tid}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
      out.push(`<g class="gx-tide${o.claimed ? ' full' : ''}" clip-path="url(#${tid})" pointer-events="none">
                 <rect x="${(w.x - r).toFixed(2)}" y="${top.toFixed(2)}"
                       width="${(r * 2).toFixed(2)}" height="${th.toFixed(2)}"/>
                 <line class="gx-tideline" x1="${(w.x - r).toFixed(2)}" y1="${top.toFixed(2)}"
                       x2="${(w.x + r).toFixed(2)}" y2="${top.toFixed(2)}"/></g>`);
    }
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
    /* THE CLAIM RING closes as the stars land -- a third of a circle each, in
       your colour, outside the holder's own ring. OPEN ARC versus CLOSED
       CIRCLE is the read that survives the far-out zoom, where every hue on
       this map washes to the same pale grey and hue alone says nothing. */
    if (claim > 0) {
      out.push(`<circle class="gx-claim${o.claimed ? ' full' : ''}" cx="${cx}" cy="${cy}"
                 r="${(r + GX_CLAIM_RING_PAD).toFixed(2)}" pathLength="100"
                 stroke-dasharray="${(claim * 100).toFixed(1)} 100"
                 transform="rotate(-90 ${cx} ${cy})" pointer-events="none"/>`);
    }
    /* And your own sigil once it is actually yours. Four powers, four distinct
       glyphs out of FACTIONS: the one channel on this map that says WHOSE
       without asking anyone to tell four colours apart. */
    if (o.claimed && o.sigil) {
      const bx = (w.x + r * GX_SIGIL_OFF).toFixed(2), by = (wy - r * GX_SIGIL_OFF).toFixed(2);
      out.push(`<g class="gx-claimed-mark" pointer-events="none">
                 <circle class="gx-sigil-bg" cx="${bx}" cy="${by}" r="${(r * GX_SIGIL_R).toFixed(2)}"/>
                 <text class="gx-sigil" x="${bx}" y="${(wy - r * GX_SIGIL_OFF + r * 0.24).toFixed(2)}"
                       text-anchor="middle" font-size="${(r * 0.66).toFixed(2)}">${o.sigil}</text></g>`);
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
  mountGalaxyViewport(wrap, key) {
    if (!wrap || typeof GalaxyFX === 'undefined') return;
    GalaxyFX.mount(wrap, key);
    if (!wrap.querySelector('.gx-nav')) {
      /* The map is bigger than the window now, so every way of moving it needs
         a control a coarse pointer and a keyboard can both reach. Wheel zoom
         is a mouse affordance and nothing else; RECENTRE is the answer to
         "where am I", which is a question a pannable map has to be able to
         answer or it is just a place to get lost in. */
      const nav = document.createElement('div');
      nav.className = 'gx-nav';
      nav.innerHTML =
        '<button type="button" class="gx-nav-btn" data-gx="in" aria-label="Zoom in">+</button>' +
        '<button type="button" class="gx-nav-btn" data-gx="out" aria-label="Zoom out">\u2212</button>' +
        '<button type="button" class="gx-nav-btn gx-home" data-gx="home">\u25CE RECENTRE</button>';
      wrap.appendChild(nav);
      nav.addEventListener('click', ev => {
        const b = ev.target.closest('[data-gx]');
        if (!b) return;
        ev.stopPropagation();
        if (b.dataset.gx === 'in') GalaxyFX.zoomBy(1.25);
        else if (b.dataset.gx === 'out') GalaxyFX.zoomBy(1 / 1.25);
        else GalaxyFX.home();
        Sound.play('click');
      });
    }
    if (!wrap.querySelector('.gx-hint')) {
      const h = document.createElement('div');
      h.className = 'gx-hint';
      h.textContent = 'DRAG OR ARROWS TO PAN · SCROLL OR ± TO ZOOM · HOME RECENTRES';
      wrap.appendChild(h);
    }
  },

  /**
   * WHERE THE PLAYER IS: the first world, in campaign order, that is open and
   * not yet conquered. On a fresh galaxy that is the first world of the first
   * system -- which is what note 19.3 asks the map to open on -- and it moves
   * forward by itself as systems fall.
   *
   * Setting a COURSE deliberately does not move it. A camera that flies to
   * whatever was last clicked is the jumpiness the owner called cheap, and it
   * takes the "where am I" answer away at the moment it is most wanted.
   */
  gxAnchorWorld(gx, prog) {
    for (const sys of gx.systems) {
      if (!isSystemOpen(gx, sys, prog)) continue;
      for (const w of sys.worlds)
        if (isWorldOpen(sys, w, prog) && !isConquered(prog, w.id)) return w;
    }
    return gx.systems[0].worlds[0];
  },

  /** Every world you could actually set course to next: open under the unlock
      rules AND not already three-starred. The courses are drawn off this list
      rather than off a distance of their own, so a dashed line can never
      promise a world the rules refuse -- and CONQUERED is excluded because a
      line to a world with nothing left to take is not a destination, it is
      history. MEASURED: without that term a late campaign drew 28 courses,
      23 of them to worlds already held. */
  gxReachable(gx, prog) {
    const out = [];
    for (const sys of gx.systems) {
      if (!isSystemOpen(gx, sys, prog)) continue;
      for (const w of sys.worlds)
        if (isWorldOpen(sys, w, prog) && !isConquered(prog, w.id)) out.push(w);
    }
    return out;
  },

  /**
   * THE ROUTES, drawn. One arc per edge of the galaxy's own route graph --
   * `gx.routes`, the same list isWorldOpen reads -- laid under the worlds and
   * inert, so an arc can never swallow a click meant for a destination.
   *
   * Three states, and every one of them is legible WITHOUT COLOUR, because a
   * map that says "you may go here" in hue alone says it to only some players:
   *
   *   travelled  SOLID       both ends have been fought on
   *   open       DASHED      a crossing the rules allow right now
   *   sealed     FINE DOTS   the route exists, but its tier or the neighbour
   *                          it depends on has not fallen
   *
   * The ordering also reads as ink -- the more line there is, the more of it
   * is yours -- which is the engraved register the rest of the map is in, and
   * is why this is dashes rather than three neon colours.
   *
   * Arcs out of the world you are STANDING on are drawn heavier again and
   * march away from it, because "where do I go next" is the question the whole
   * screen exists to answer.
   */
  gxRoutes(gx, prog, anchor) {
    const routes = (gx && gx.routes) || [];
    if (!routes.length) return '';
    const byId = {}, sysOpen = {};
    for (const sys of gx.systems) {
      sysOpen[sys.index] = isSystemOpen(gx, sys, prog);
      for (const w of sys.worlds) byId[w.id] = w;
    }
    /* Playable is asked of the ENGINE, never re-derived here. The click
       handler gates on exactly these three terms; a fourth definition of them
       is how a line comes to promise a world the rules refuse. */
    const playable = w => sysOpen[w.si] &&
                          isWorldOpen(gx.systems[w.si], w, prog) &&
                          !isConquered(prog, w.id);
    /* A crossing needs BOTH ends to be somewhere you have standing: ground you
       have already fought on, or a world you may attack right now.

       MEASURED, and the reason this is not `playable(A) || playable(B)`: with
       either-end, both gateways out of the opening system were drawn as OPEN
       routes on a fresh galaxy -- long, bright, marching arcs pointing at a
       system that isSystemOpen refuses until a seat falls. They were the
       loudest marks on the whole map and every one of them was a lie. A line
       that promises a crossing the rules refuse is the exact failure the ring
       and its straight courses were removed for. */
    const standing = w => starsOn(prog, w.id) > 0 || playable(w);
    const out = [];
    for (const r of routes) {
      let A = byId[r.a], B = byId[r.b];
      if (!A || !B) continue;
      const travelled = starsOn(prog, A.id) > 0 && starsOn(prog, B.id) > 0;
      const live = !travelled && standing(A) && standing(B);
      const state = travelled ? 'taken' : live ? 'live' : 'sealed';
      /* Draw from the end you HOLD toward the end you do not, so the marching
         dash always flows in the direction the fleet would travel. Swapping is
         safe: both bows below are symmetric about the chord's midpoint. */
      if (B === anchor ||
          (A !== anchor && starsOn(prog, B.id) > starsOn(prog, A.id))) {
        const t = A; A = B; B = t;
      }
      const next = live && A === anchor ? ' next' : '';
      const ax = A.x, ay = A.y * GX_RENDER_SQUASH;
      const bx = B.x, by = B.y * GX_RENDER_SQUASH;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      let cx, cy;
      if (r.kind === 'gate') {
        /* A gateway bows UP, the way the old system chain did -- it is the
           same crossing, said in worlds instead of in system blobs. */
        cx = mx; cy = my - len * GX_ROUTE_BOW;
      } else {
        const sys = gx.systems[A.si];
        const dx = mx - sys.x, dy = my - sys.y * GX_RENDER_SQUASH;
        const d = Math.hypot(dx, dy) || 1;
        cx = mx + dx / d * len * GX_ROUTE_BOW;
        cy = my + dy / d * len * GX_ROUTE_BOW;
      }
      out.push(`<path class="gx-route ${r.kind === 'gate' ? 'gate' : 'local'} ${state}${next}"
        d="M${ax.toFixed(2)} ${ay.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}"/>`);
    }
    return `<g class="gx-routes" aria-hidden="true">${out.join('')}</g>`;
  },

  /** The ramp a campaign is being played on, resolved once. */
  rampOf(c) { return (c && RAMP_PRESETS[c.ramp]) || RAMP_PRESETS[RAMP_DEFAULT]; },

  /**
   * Start a campaign — and, from the second galaxy on, ask what slope it is
   * to be fought at. A first run never sees this: it has not yet learnt what
   * it would be choosing between, and the ramp it would pick is the one it
   * is already on.
   */
  beginCampaign() {
    const go = ramp => {
      Meta.campaignStart(Meta.faction(), ramp);
      this.sel.loadout = [];
      this.show('screen-command'); this.buildCommanderScreen();
    };
    if ((Meta.load().galaxyTier || 0) < 1) return go(RAMP_DEFAULT);

    let ov = $('#ramp-choice');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ramp-choice';
      /* NOT `required`, unlike the escalation modal: this one is cancellable
         because nothing has been created yet. Escape here simply leaves the
         player where they were, with no campaign and no state to strand. */
      ov.className = 'overlay hidden';
      ov.innerHTML = '<div class="modal escal"><div id="rc-body"></div></div>';
      document.body.appendChild(ov);
    }
    const tier = Meta.load().galaxyTier || 0;
    const roman = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][Math.min(tier - 1, 6)] || 'NEXT';
    $('#rc-body').innerHTML = `
      <p class="ec-eyebrow">GALAXY ${roman} — YOU HAVE DONE THIS BEFORE</p>
      <h2 class="ec-title">NEW GAME PLUS</h2>
      <p class="ec-sub">Choose the slope. Every garrison is already stronger for the
        ${tier} galax${tier === 1 ? 'y' : 'ies'} behind you — this decides how much harder
        again, and what the run pays when you extract.</p>
      <div class="ec-cards">
        ${['veteran', 'onslaught', 'apex'].map(id => {
          const R = RAMP_PRESETS[id];
          return `<button class="ec-card ${id === 'apex' ? 'hard' : ''}" data-ramp="${id}">
            <b>${R.name}</b>
            <em>${R.blurb}</em>
            <span class="ec-tag">+${Math.round(R.tierHpStep * 100)}% PER TIER · ${
              R.soulsMul > 1 ? '+' + Math.round((R.soulsMul - 1) * 100) + '% SOULS' : 'STANDARD PAY'}</span>
          </button>`;
        }).join('')}
      </div>`;
    ov.classList.remove('hidden');
    $$('[data-ramp]', ov).forEach(b => b.addEventListener('click', () => {
      ov.classList.add('hidden');
      Sound.play('tech');
      go(b.dataset.ramp);
    }));
  },

  renderTheatre() {
    let c = Meta.campaign();
    /* A defeat no longer ends a campaign, so this branch is reached only after
       an abandon or a claimed galaxy -- and the allegiance outlives both. The
       road back from a finished battle must still land on the world map, not
       on the commander screen, so a sworn profile silently opens a fresh
       campaign under the same banner and the galaxy simply appears. */
    if (!c && Meta.faction()) {
      /* A commander who has finished a galaxy chooses the next one's slope
         before it is generated, so this road has to ask too rather than
         silently opening a VETERAN run behind their back. beginCampaign
         takes over the screen from here; the map redraws once it returns. */
      if ((Meta.load().galaxyTier || 0) >= 1) { this.beginCampaign(); return; }
      c = Meta.campaignStart(Meta.faction()); this.sel.loadout = [];
    }
    if (!c) { this.show('screen-faction'); this.renderFactions(); return; }
    const gx = Meta.galaxy();
    const prog = c.stars || {};
    /* Every seat taken: the galaxy is done, and the campaign resolves into a
       victory rather than trailing off with nothing left to click. */
    if (galaxyComplete(gx, prog)) return this.renderGalaxyVictory(gx, prog);
    const hold = galaxyHoldings(gx, prog);
    const total = gx.systems.reduce((a, s) => a + s.worlds.length, 0);
    const myF = FACTIONS[gx.playerFaction];
    /* Hoisted above the header because the header now PRINTS the size of this
       set. One computation, one number: the count in the status strip, the
       arcs drawn under the worlds and the click handler's own gate are all the
       same isWorldOpen, so none of the three can quote a different galaxy. */
    const anchor = this.gxAnchorWorld(gx, prog);
    const reach = this.gxReachable(gx, prog);

    $('#campaign-trail').innerHTML = `
      <div class="gx-status">
        <span class="gx-tier" data-tt="GALAXY TIER|Each conquered galaxy raises enemy strength 30% in the next.">✦ GALAXY ${['I','II','III','IV','V','VI','VII'][c.tier || 0]}</span>
        <span class="gx-flag" style="--fc:${myF.color}">${myF.icon} ${myF.name}</span>
        <span class="gx-hold">${hold[gx.playerFaction]} / ${total} worlds held</span>
        <span class="gx-seats" data-tt="COMMANDER SEATS|Take every seat and the galaxy is yours. A seat opens once you hold most of its system.">⚔ ${seatsRemaining(gx, prog)} seats standing</span>
        <span class="gx-open" data-tt="OPEN WORLDS|Worlds you may attack next. Every one is at the far end of a route out of ground you already hold.">⇢ ${reach.length} world${reach.length === 1 ? '' : 's'} open</span>
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

    const ax = anchor.x, ay = anchor.y * GX_RENDER_SQUASH;

    const svg = [];
    svg.push(`<svg class="galaxy" viewBox="${GX_WORLD_VIEWBOX}" role="img"
                   aria-label="Galaxy map, ${gx.systems.length} solar systems">`);
    svg.push(this.gxBackdrop('gx'));
    /* The single curve that used to run between system CENTRES is gone. It
       joined two blobs of empty space and named no world at either end, which
       made it decoration sitting on top of the one relationship the map has to
       carry. The gateway arcs inside gxRoutes are the same connection said
       properly: they land on the two worlds you would actually arrive at, and
       they are the same edges isWorldOpen consults. */
    svg.push(this.gxRoutes(gx, prog, anchor));
    /* WHERE YOU ARE STANDING, and nothing else.

       The TRAVEL RANGE ring and its fan of straight courses are gone. Between
       them they were one circle and up to thirty rulers trying to describe a
       set of destinations scattered over five systems -- and a ruler drawn
       from here to a world twelve orbits away in another system is not a
       route, it is a claim that the two are adjacent. The route graph above
       makes the same statement exactly and once: one arc per crossing the
       rules allow, along the line a fleet would actually travel. All that is
       left for this mark to say is which world the arcs lead out of. */
    svg.push(`<g class="gx-reach" aria-hidden="true">
        <circle class="gx-here" cx="${ax.toFixed(2)}" cy="${ay.toFixed(2)}" r="6.4"/>
        <text class="gx-here-lbl" x="${ax.toFixed(2)}" y="${(ay + 10.4).toFixed(2)}"
              text-anchor="middle">YOU ARE HERE</text></g>`);
    for (const sys of gx.systems) {
      const open = isSystemOpen(gx, sys, prog);
      const sp = systemProgress(sys, prog);
      const hf = FACTIONS[sys.holder];
      const sy = sys.y * GX_RENDER_SQUASH;
      svg.push(`<g class="gx-sys ${open ? '' : 'locked'}">`);
      svg.push(`<circle class="gx-halo" cx="${sys.x.toFixed(2)}" cy="${sy.toFixed(2)}" r="${GX_SYS_HALO_R}"
                 style="--fc:${hf.color}"/>`);
      svg.push(`<text class="gx-sysname" x="${sys.x.toFixed(2)}" y="${(sy + GX_SYS_NAME_DY).toFixed(2)}"
                 text-anchor="middle">${sys.name}</text>`);
      svg.push(`<text class="gx-sysmeta" x="${sys.x.toFixed(2)}" y="${(sy + GX_SYS_META_DY).toFixed(2)}"
                 text-anchor="middle">${open ? sp.taken + '/' + sp.total + ' TAKEN' : 'SEALED'}</text>`);
      for (const w of sys.worlds) {
        /* ONE source for who this world reads as. The paint, the class list
           and the accessible name all come out of the same call, so the map
           can never again say one thing in colour and another in words. */
        const al = worldAllegiance(gx, sys, w, prog);
        const stars = al.stars, mine = al.claimed;
        const canPlay = open && isWorldOpen(sys, w, prog);
        const of = FACTIONS[al.faction];
        const wy = w.y * GX_RENDER_SQUASH;
        const cls = ['gx-world', canPlay ? 'open' : 'shut', mine ? 'mine' : '',
                     'gx-' + al.state, (stars > 0 && !mine) ? 'partial' : '',
                     w.seat ? 'seat' : '', planetArtFor(w) ? 'has-planet' : '',
                     w === anchor ? 'here' : '',
                     (c.chosen && c.chosen.world === w.id) ? 'sel' : ''].join(' ');
        /* --fc is whose world it IS, --yc is whose claim is being painted on
           it. They resolve to the same colour only once the world is yours,
           which is precisely the moment the note is about. */
        svg.push(`<g class="${cls}" data-world="${w.id}" data-state="${al.state}"
                   data-stars="${stars}" style="--fc:${of.color};--yc:${myF.color}" tabindex="0"
                   role="button" aria-label="${w.name}, ${of.short}, ${allegianceLabel(al)}, ${stars} of ${GX_CLAIM_STARS} stars">`);
        if (w.seat) svg.push(`<circle class="gx-seat" cx="${w.x.toFixed(2)}" cy="${wy.toFixed(2)}" r="4.1"/>`);
        const wr2 = w.seat ? 2.7 : 2.0;
        svg.push(this.gxWorldPaint('gx', w, wy, wr2,
                  { contested: al.contested, pips: stars, claim: al.claim,
                    claimed: al.claimed, sigil: myF.icon }));
        svg.push(`</g>`);
      }
      svg.push(`</g>`);
    }
    svg.push(`</svg><div class="gx-keys">
      <div class="gx-legend" role="note" aria-label="Route key">
        <span><svg viewBox="0 0 30 6" aria-hidden="true"><path class="gx-route taken" d="M1 3 H29"/></svg>travelled</span>
        <span><svg viewBox="0 0 30 6" aria-hidden="true"><path class="gx-route live" d="M1 3 H29"/></svg>open route</span>
        <span><svg viewBox="0 0 30 6" aria-hidden="true"><path class="gx-route sealed" d="M1 3 H29"/></svg>sealed</span>
      </div>
      ${this.gxLegend(myF)}</div><p class="wm-hint">Hover a world for its briefing &middot; click to set course &middot; three stars conquers it</p>
`);
    $('#worldmap-wrap').innerHTML = svg.join('');

    /* Lay the freshly-rendered map on the 2.5D plane before wiring clicks, so
       the nodes bind inside the structure they will actually live in. The KEY
       is the campaign: re-rendering the SAME galaxy must keep the pan and zoom
       the player set, while a new campaign must not open scrolled to wherever
       the last one was left. */
    this.gxPaintStars($('#worldmap-wrap'));
    this.mountGalaxyViewport($('#worldmap-wrap'), 'gx:' + c.seed);
    $$('#worldmap-wrap .gx-world').forEach(g => {
      const w = this.worldById(gx, g.dataset.world);
      const sys = gx.systems[w.si];
      const brief = ev => this.showTooltip(ev, this.worldBriefing(gx, sys, w, prog));
      g.addEventListener('mouseenter', brief);
      g.addEventListener('focus', brief);
      /* A keyboard can now tab to a world that is off the side of the window.
         Focus without a pan moves the caret to something invisible, which is
         the one way a bigger map is strictly worse than a smaller one. */
      g.addEventListener('focus', () => GalaxyFX.bring(g));
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
                     /* THE RAMP decides the slope now. VETERAN's two functions
                        ARE the expressions that used to be written here, so a
                        first galaxy and a veteran NG+ run get precisely the
                        campaign this line always produced. `si` rides along
                        because the first galaxy's flattening is indexed by
                        solar system, and the battle must be told which. */
                     si: w.si,
                     difficulty: this.rampOf(c).diffFor(w.si),
                     escStart: this.rampOf(c).escFor(w.si) };
        Meta.save(); Sound.play('click'); this.renderTheatre();
      };
      /* Coarse pointers have had no hover in which to read the briefing, so
         the first tap shows it and only the second sets course -- the rule the
         universe map has used since Session 16. On a mouse tapArm returns true
         immediately and this is the plain click it always was. */
      g.addEventListener('click', ev => { if (this.tapArm(g, () => brief(ev))) pick(); });
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    });

    /* 19.3 -- open on the world you are standing on, and fly there again when
       the campaign advances. GalaxyFX only moves when the anchor CHANGES, so
       the re-render a course selection triggers leaves the camera alone. */
    GalaxyFX.setAnchor(ax, ay, anchor.id,
                       $(`#worldmap-wrap .gx-world[data-world="${anchor.id}"]`));

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
    /* And the viewport SHELL with it. The wrap is a fixed-height, block,
       overflow-hidden window while it holds a map; leaving it that way for the
       victory panel crops the panel to the map's height and pins it to the
       top-left corner of it. */
    $('#worldmap-wrap').classList.remove('gx-viewport', 'gx-far');
    $('#worldmap-wrap').removeAttribute('style');
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
        ${!Meta.gameBeaten() ? `
          <div class="gv-secret">
            <b>UNSCHEDULED SIGNAL</b>
            <p>The machines have watched you take a galaxy. A fifth banner is now yours to swear.</p>
            <em>A banner is sworn once per commander — raise a new profile to answer it.</em>
          </div>` : ''}
        <p class="gv-next">Galaxy ${['II','III','IV','V','VI','VII','VIII'][Meta.load().galaxyTier || 0]} is already massing — its garrisons will be
           ${Math.round(RAMP_PRESETS[RAMP_DEFAULT].tierHpStep * 100)}% stronger per tier, and you will set the ramp when it musters.</p>
        <button id="btn-gv-claim" class="btn btn-primary btn-big">◉ CLAIM ${payout} SOULS &amp; ADVANCE</button>
      </div>`;
    $('#theatre-detail').innerHTML = '';
    $('#btn-to-loadout').disabled = true;
    Sound.play('victory');

    $('#btn-gv-claim').addEventListener('click', () => {
      /* Advancing raises the permanent galaxy tier; the next campaign is
         generated at +30% enemy strength per tier. */
      const before = Meta.souls();
      /* One writer for the tier, the install's conquest ledger and the
         payout -- see Meta.claimGalaxy. */
      const res = Meta.claimGalaxy();
      /* THE CEREMONY. The souls are already banked -- campaignExtract paid
         them the line above -- so everything below is presentation: a payout
         this size deserves a counter that climbs, not a toast that vanishes.
         A refresh mid-count loses only the animation, never the souls. */
      const gv = $('#worldmap-wrap').querySelector('.gv');
      if (!gv) { this.show('screen-title'); this.renderTitle(); return; }
      gv.innerHTML = `
        <span class="gv-sigil">◉</span>
        <h2>SOULS BANKED</h2>
        <div class="gv-souls"><b id="gv-soulnum">◉ ${before}</b><em id="gv-souldelta">+0</em></div>
        <p class="gv-sub">The harvest of a conquered galaxy, paid in full.
           Spend it in the SOUL SHOP.</p>
        <button id="btn-gv-done" class="btn btn-primary btn-big">CONTINUE</button>`;
      Sound.play('branch');
      this.countUp($('#gv-soulnum'), before, before + res.souls, 1400, v => '◉ ' + formatNum(v));
      this.countUp($('#gv-souldelta'), 0, res.souls, 1400, v => '+' + v + ' banked');
      if (res.firstEver) this.toast('SIGNAL LOGGED — A FIFTH BANNER AWAITS A NEW COMMANDER.');
      $('#btn-gv-done').addEventListener('click', () => { this.show('screen-title'); this.renderTitle(); });
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
    const svg = [`<svg class="galaxy" viewBox="${GX_WORLD_VIEWBOX}" role="img" aria-label="Universe map">`];
    svg.push(this.gxBackdrop('mv'));
    for (let i = 1; i < gx.systems.length; i++) {
      const a = gx.systems[i - 1], b = gx.systems[i];
      const mx = (a.x + b.x) / 2, my = ((a.y + b.y) / 2) * GX_RENDER_SQUASH - GX_LINK_LIFT;
      svg.push(`<path class="gx-link on" fill="none"
        d="M${a.x.toFixed(2)} ${(a.y * GX_RENDER_SQUASH).toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)}
           ${b.x.toFixed(2)} ${(b.y * GX_RENDER_SQUASH).toFixed(2)}"/>`);
    }
    for (const sys of gx.systems) {
      const hf = FACTIONS[sys.holder];
      const sy = sys.y * GX_RENDER_SQUASH;
      svg.push(`<g class="gx-sys">`);
      svg.push(`<circle class="gx-halo" cx="${sys.x.toFixed(2)}" cy="${sy.toFixed(2)}" r="${GX_SYS_HALO_R}"
                 style="--fc:${hf.color}"/>`);
      svg.push(`<text class="gx-sysname" x="${sys.x.toFixed(2)}" y="${(sy + GX_SYS_NAME_DY).toFixed(2)}"
                 text-anchor="middle">${sys.name}</text>`);
      svg.push(`<text class="gx-sysmeta" x="${sys.x.toFixed(2)}" y="${(sy + GX_SYS_META_DY).toFixed(2)}"
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
    svg.push(`</svg><p class="wm-hint">Drag to pan &middot; click a world to open a duel table over it</p>`);
    $('#multiverse-wrap').innerHTML = svg.join('');
    this.gxPaintStars($('#multiverse-wrap'));
    this.mountGalaxyViewport($('#multiverse-wrap'), 'mv');

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
          <span>${Net.duelRefusal(w)
            ? 'No duel table opens here — this board seats more commanders than a duel does. Click for the garrison.'
            : 'Click to open a duel table here, or to join one already open.'}</span></div></div></div>`);
      g.addEventListener('mouseenter', brief);
      g.addEventListener('focus', brief);
      g.addEventListener('focus', () => GalaxyFX.bring(g));
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
   * THE DUEL TABLE. There is no matchmaking service behind this and there
   * never will be: the game ships as one offline file with no dependencies,
   * which rules out every relay there is to rent. What it does not rule out
   * is the browser talking to itself, so a duel is fought between two WINDOWS
   * of this game on one machine, over BroadcastChannel, at full fidelity --
   * towers, musters, sends, reanimation, the lot, on one simulation both
   * clients step in lockstep. TWO MACHINES fight the same duel over the
   * hand-signalled wire in mpRtc below, and the lobby past that link is this
   * one unchanged -- so this header must name both, or the next reader
   * trims the panel back down to the one shape it describes. The copy says
   * exactly that. See js/net.js.
   */
  mpSearch(w) {
    const ov = $('#mv-search'), body = $('#mv-search-body');
    ov.classList.remove('hidden');
    this._mvWorld = w;
    /* Esc must CLOSE the lobby, not merely hide it. Dismissing the overlay
       used to leave phase 'hosting' and the table advertised, so a later join
       from another window yanked this client into a live duel from whatever
       screen it was on -- the title, or the middle of a Maelstrom run. The
       same cleanup the CANCEL button does, published on the overlay's own
       dismiss hook. */
    ov._escDismiss = () => { Net.cancel(); Net.onLobby = null; };
    clearTimeout(this._mvT);

    if (!Net.supported) {
      /* No BroadcastChannel is no SAME-MACHINE duel. The hand-carried wire
         does not need it, so a browser this old is refused only the half it
         actually lacks. */
      const rtcOk = NetRTC.supported;
      body.innerHTML = `<b class="mv-title">NO RELAY IN THIS BROWSER</b>
        <p class="mv-text">A same-machine duel needs BroadcastChannel, which this browser does not
           provide. ${rtcOk
             ? 'Two machines can still fight over the hand-carried wire — or the garrison of <b>' + w.name + '</b> will oblige.'
             : 'Everything else still works — the garrison of <b>' + w.name + '</b> will oblige.'}</p>
        <div class="modal-actions">
          ${rtcOk ? '<button id="btn-mv-rtc" class="btn btn-primary">ACROSS TWO MACHINES</button>' : ''}
          <button id="btn-mv-practice" class="btn${rtcOk ? '' : ' btn-primary'}">SKIRMISH THE GARRISON</button>
          <button id="btn-mv-cancel" class="btn">CANCEL</button></div>`;
      const rb = $('#btn-mv-rtc');
      if (rb) rb.addEventListener('click', () => this.mpRtc(w));
      this.bindMpFooter(w);
      return;
    }

    /* A world the relay will not seat is said so here, in full, rather than
       quietly swapped for a different board or left to open a table that
       freezes on wave 5. The garrison skirmish below still fights this exact
       map -- a three-way board is only broken between two WINDOWS, never
       against the machine -- so the way in is offered, not withheld. */
    const refused = Net.duelRefusal(w);
    if (refused) {
      body.innerHTML = `<b class="mv-title">NO DUEL OVER ${w.name}</b>
        <p class="mv-text">${refused}</p>
        <p class="mv-text">Every uncontested world in the universe will host one, and the
           garrison of <b>${w.name}</b> will still fight you for this board.</p>
        <div class="modal-actions">
          <button id="btn-mv-practice" class="btn btn-primary">SKIRMISH THE GARRISON</button>
          <button id="btn-mv-cancel" class="btn">CANCEL</button></div>`;
      this.bindMpFooter(w);
      return;
    }

    Net.enterLobby();
    Net.onLobby = () => this.renderMpTables();
    Net.onStatus = t => { const n = $('#mv-note'); if (n) n.textContent = t; };

    const p = Net.localProfile();
    const cmd = COMMANDERS.find(c => c.id === p.commander);
    const towers = p.loadout.map(id => (TOWER_TYPES[id] || { name: id }).name).join(' · ');

    body.innerHTML = `<b class="mv-title">DUEL — ${w.name}</b>
      <p class="mv-text">A duel is fought between two windows of this game on this machine.
         Open a second window, take <b>MULTIPLAYER</b> into the same universe there, then one
         of you opens a table and the other joins it. Both commanders fight the whole battle
         on one simulation. Two machines can fight it too — <b>ACROSS TWO MACHINES</b> below,
         where the two of you carry the connection by hand.</p>
      <div class="mv-fielding" style="margin:10px 0;padding:8px 10px;border:1px solid rgba(120,180,220,.18);border-radius:4px;font-size:12px;line-height:1.5">
        <span class="mv-fk" style="display:block;font-size:10px;letter-spacing:.16em;opacity:.6">FIELDING</span>
        <b>${cmd ? cmd.name : p.commander}</b> · ${towers}
      </div>
      <div class="mv-tables" id="mv-tables" style="margin:10px 0;display:flex;flex-direction:column;gap:6px"></div>
      <p class="mv-note" id="mv-note" style="min-height:14px;font-size:11px;opacity:.7"></p>
      <div class="modal-actions">
        <button id="btn-mv-host" class="btn btn-primary">OPEN A TABLE</button>
        <button id="btn-mv-rtc" class="btn">ACROSS TWO MACHINES</button>
        <button id="btn-mv-practice" class="btn">SKIRMISH THE GARRISON</button>
        <button id="btn-mv-cancel" class="btn">CANCEL</button></div>
      <p class="hint">Duel rules: escalations are dealt rather than drafted, rushing a wave is
         off, and nothing a duel does is written to your campaign.</p>`;

    $('#btn-mv-host').addEventListener('click', () => {
      if (Net.phase === 'hosting') { Net.cancel(); this.renderMpTables(); return; }
      Net.host(w);
      this.renderMpTables();
    });
    /* The second wire. The panel replaces this body and hands straight back
       to mpSearch the moment the machines meet, so everything past the link
       is this same flow. */
    const rtc = $('#btn-mv-rtc');
    if (rtc) rtc.addEventListener('click', () => { Sound.play('click'); this.mpRtc(w); });
    this.bindMpFooter(w);
    this.renderMpTables();
  },

  /**
   * THE HAND-CARRIED WIRE. Two machines, no server: WebRTC with the
   * signalling done by the players themselves. The copy does not dress it
   * up — the offer and the answer are blobs the two of you ferry across by
   * any channel you already share, and after that the machines talk
   * directly. Everything past the link is the same lobby as the
   * same-machine duel; this panel's only job is to end. See NetRTC, js/net.js.
   */
  mpRtc(w) {
    const ov = $('#mv-search'), body = $('#mv-search-body');
    ov.classList.remove('hidden');
    /* Esc must kill the half-built connection too, or an abandoned ritual
       leaves a pc waiting to link this client into a duel from any screen.
       Same shape as the lobby's own dismiss, published on the same hook. */
    ov._escDismiss = () => { NetRTC.abort(); Net.cancel(); Net.onLobby = null; };

    const back = () => { NetRTC.abort(); this.mpSearch(w); };
    const TA = 'width:100%;min-height:72px;margin:6px 0;background:rgba(8,14,23,.9);color:#9fd8ef;' +
               'border:1px solid rgba(120,180,220,.25);border-radius:4px;font:11px/1.4 monospace;padding:6px';
    const note = t => { const n = $('#mv-rtc-note'); if (n) n.textContent = t; };
    NetRTC.onState = note;
    /* The link coming up is the exit for BOTH roles: back to the lobby the
       rest of the flow already owns, with the wire quietly underneath it. */
    NetRTC.onLink = () => {
      this.mpSearch(w);
      Net.status('The wire between the machines is live. One of you opens a table; the other joins it.');
    };

    if (!NetRTC.supported) {
      body.innerHTML = `<b class="mv-title">NO WIRE IN THIS BROWSER</b>
        <p class="mv-text">A two-machine duel needs WebRTC, which this browser does not provide.</p>
        <div class="modal-actions"><button id="btn-mv-rtc-back" class="btn">BACK</button></div>`;
      $('#btn-mv-rtc-back').addEventListener('click', back);
      return;
    }

    body.innerHTML = `<b class="mv-title">A DUEL ACROSS TWO MACHINES</b>
      <p class="mv-text">No server exists; <b>you are the wire</b>. One machine writes an
         offer, the other writes an answer, and the two of you carry those blobs across by
         hand — a chat message, an email, anything that moves text. Paste each one where it
         is asked for and the machines talk directly from then on. The same network is the
         honest expectation; across the open internet this wire may simply not reach.</p>
      <div class="modal-actions">
        <button id="btn-mv-rtc-host" class="btn btn-primary">THIS MACHINE HOSTS</button>
        <button id="btn-mv-rtc-guest" class="btn">THIS MACHINE ANSWERS</button>
        <button id="btn-mv-rtc-back" class="btn">BACK</button></div>
      <p class="mv-note" id="mv-rtc-note" style="min-height:14px;font-size:11px;opacity:.7"></p>`;
    $('#btn-mv-rtc-back').addEventListener('click', back);

    $('#btn-mv-rtc-host').addEventListener('click', async () => {
      let blob;
      try { blob = await NetRTC.host(); }
      catch (e) { note(e.message || String(e)); return; }
      body.innerHTML = `<b class="mv-title">HOSTING — CARRY THE OFFER</b>
        <p class="mv-text">1 — Give this offer to the other commander, whole.</p>
        <textarea id="mv-rtc-give" style="${TA}" readonly></textarea>
        <p class="mv-text">2 — They will hand you an answer back. Paste it here and proceed.</p>
        <textarea id="mv-rtc-take" style="${TA}" placeholder="the answer blob goes here"></textarea>
        <p class="mv-note" id="mv-rtc-note" style="min-height:14px;font-size:11px;opacity:.7"></p>
        <div class="modal-actions">
          <button id="btn-mv-rtc-copy" class="btn">COPY THE OFFER</button>
          <button id="btn-mv-rtc-go" class="btn btn-primary">PROCEED</button>
          <button id="btn-mv-rtc-back" class="btn">BACK</button></div>`;
      $('#mv-rtc-give').value = blob;
      $('#btn-mv-rtc-back').addEventListener('click', back);
      $('#btn-mv-rtc-copy').addEventListener('click', () => {
        const t = $('#mv-rtc-give'); t.select();
        try { navigator.clipboard.writeText(t.value); note('Copied.'); }
        catch (e) { note('The clipboard refused — select it all and copy by hand.'); }
      });
      $('#btn-mv-rtc-go').addEventListener('click', async () => {
        try { await NetRTC.accept($('#mv-rtc-take').value); }
        catch (e) { note(e.message || String(e)); }
      });
    });

    $('#btn-mv-rtc-guest').addEventListener('click', () => {
      body.innerHTML = `<b class="mv-title">ANSWERING — TAKE THE OFFER</b>
        <p class="mv-text">1 — Paste the host's offer here and proceed.</p>
        <textarea id="mv-rtc-take" style="${TA}" placeholder="the offer blob goes here"></textarea>
        <p class="mv-text">2 — Your answer appears below. Carry it back to the host; the
           lobby opens on both machines the moment they meet.</p>
        <textarea id="mv-rtc-give" style="${TA}" readonly></textarea>
        <p class="mv-note" id="mv-rtc-note" style="min-height:14px;font-size:11px;opacity:.7"></p>
        <div class="modal-actions">
          <button id="btn-mv-rtc-go" class="btn btn-primary">PROCEED</button>
          <button id="btn-mv-rtc-copy" class="btn">COPY THE ANSWER</button>
          <button id="btn-mv-rtc-back" class="btn">BACK</button></div>`;
      $('#btn-mv-rtc-back').addEventListener('click', back);
      $('#btn-mv-rtc-copy').addEventListener('click', () => {
        const t = $('#mv-rtc-give');
        if (!t.value) { note('Nothing to copy yet — take the offer first.'); return; }
        t.select();
        try { navigator.clipboard.writeText(t.value); note('Copied. The duel table opens when the host takes it.'); }
        catch (e) { note('The clipboard refused — select it all and copy by hand.'); }
      });
      $('#btn-mv-rtc-go').addEventListener('click', async () => {
        let ans;
        try { ans = await NetRTC.answer($('#mv-rtc-take').value); }
        catch (e) { note(e.message || String(e)); return; }
        $('#mv-rtc-give').value = ans;
        note('Answer written. Carry it back to the host.');
      });
    });
  },

  /** The open tables on this machine, repainted whenever the relay says so. */
  renderMpTables() {
    const box = $('#mv-tables');
    if (!box) return;
    const host = $('#btn-mv-host');
    if (host) host.textContent = Net.phase === 'hosting' ? 'CLOSE MY TABLE' : 'OPEN A TABLE';
    if (Net.phase === 'hosting') {
      box.innerHTML = `<div class="mv-table open" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:7px 10px;border:1px solid rgba(120,180,220,.18);border-radius:4px;font-size:12px"><span class="mv-spin"></span>
        <span>Your table over <b>${Net.table.name}</b> is open — waiting for a commander.</span></div>`;
      return;
    }
    if (Net.phase === 'joining') {
      box.innerHTML = `<div class="mv-table open" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:7px 10px;border:1px solid rgba(120,180,220,.18);border-radius:4px;font-size:12px"><span class="mv-spin"></span>
        <span>Joining…</span></div>`;
      return;
    }
    if (!Net.tables.length) {
      box.innerHTML = `<div class="mv-table empty" style="padding:7px 10px;font-size:12px;opacity:.55">No tables are open in another window.</div>`;
      return;
    }
    /* Names off the wire are text, never markup: a table row is a message any
       window on this origin composed, and interpolating it raw put whatever it
       carried into this document. A row with no world is dropped for the same
       reason it used to throw -- there is nothing legal to print for it. */
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    box.innerHTML = Net.tables.filter(t => t.world && t.world.name).map(t => `<div class="mv-table" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:7px 10px;border:1px solid rgba(120,180,220,.18);border-radius:4px;font-size:12px">
      <span><b>${esc(t.name)}</b> over <b>${esc(t.world.name)}</b></span>
      <button class="btn btn-sm" data-table="${esc(t.id)}">JOIN</button></div>`).join('');
    $$('#mv-tables [data-table]').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      Net.join(b.dataset.table);
      this.renderMpTables();
    }));
  },

  /** The garrison skirmish and the way out — shared by both lobby states. */
  bindMpFooter(w) {
    const ov = $('#mv-search');
    const pr = $('#btn-mv-practice');
    if (pr) pr.addEventListener('click', () => {
      ov.classList.add('hidden'); Net.cancel(); Sound.resume();
      const fac = Meta.faction() || 'human';
      const cmd = Meta.isCommanderUnlocked(freeCommanderOf(fac)) ? freeCommanderOf(fac) : 'cadre';
      const owned = Meta.unlockedTowers();
      Game.start({ skirmish: true, map: w.map, difficulty: 'contested', commander: cmd,
                   loadout: owned.slice(0, Math.min(LOADOUT_SIZE, owned.length)),
                   rivalFaction: w.owner, worldKind: w.kind, arena: w.arena });
      this.show('screen-game'); this.buildShop(); this.buildAbilityBar(); Game.resize();
    });
    const cn = $('#btn-mv-cancel');
    if (cn) cn.addEventListener('click', () => { Net.cancel(); Net.onLobby = null; ov.classList.add('hidden'); });
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
      MAELSTROM_MAX_SEATS + ' seats</div>' +
      this.mapPreviewBlock(maelstromMap(MAELSTROM_MAX_SEATS), { size: 'tip' }) +
      '<div class="br-rows"><div class="br-row">' +
      '<span class="br-ic">&#9673;</span><span>Every commander holds their own lane and their own base. ' +
      'Nothing you kill comes back to you — you send by paid summons alone.</span></div></div></div>');
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
        'to send. You send by <b>PAID SUMMONS</b>, and every POWER bonus you hold still rides ' +
        'what you send. The horizon contracts every ' + MAELSTROM_CONTRACT_WAVES +
        ' waves and keeps whatever is standing inside it.</p>' +
        /* Redrawn with the seat count, because the seat count is the only
           thing that decides this board and the ring visibly grows with it. */
        this.mapPreviewBlock(m, { size: 'brief' }) +
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
      ${m ? this.mapPreviewBlock(m, { size: inline ? 'brief' : 'tip' }) : ''}
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
      this.mapPreviewBlock(m, { size: inline ? 'brief' : 'tip' }) +
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

  /* ══════════════════════════════════════ BATTLEFIELD MINIMAP ═══ */

  /**
   * THE MINIMAP MODEL: the board a card is about to show, solved once.
   *
   * Everything on the preview comes out of `buildField(map)` -- the same call
   * `Game.start` makes -- and the unbuildable set is recomputed the way
   * `Game.start` recomputes it: authored terrain UNION every tile a lane or a
   * send route runs through. Nothing here is authored a second time, so
   * nothing here can drift from the board. Fifteen hand-kept thumbnails would
   * have guaranteed the opposite.
   *
   * MEMOISED because the arena's field runs a 200-pass ownership balance over
   * ~2,200 tiles and a tooltip fires on every mouseenter. Keyed on seat count
   * as well as id: the arena is a genuinely different board at four seats and
   * at twenty.
   */
  previewModel(m) {
    if (!this._pvModel) this._pvModel = {};
    const k = m.id + (m.maelstrom ? ':' + m.maelstrom : '');
    if (!this._pvModel[k]) this._pvModel[k] = this.buildPreview(m);
    return this._pvModel[k];
  },

  /**
   * Renders one board into an SVG whose viewBox is the board's own grid, so
   * every width inside it is a fraction of a TILE and the SAME renderer serves
   * a duel, a three-way board and the twenty-seat arena at any card size.
   */
  buildPreview(m) {
    const f = buildField(m);
    const cols = f.cols, rows = f.rows, seats = f.lanes.length;
    const q = v => Math.round(v * 100) / 100;

    /* THE ENGINE'S OWN UNBUILDABLE SET, by the engine's own rule. A tile a
       lane passes through is not ground, and a preview that painted it as
       ground would be offering placements `Game.canBuild` refuses. */
    const laneTiles = new Set();
    const lanes = [];
    f.lanes.forEach((side, si) => side.forEach(pts => {
      lanes.push({ si: si, pts: pts });
      for (const k of new Path(pts).blockedTiles()) laneTiles.add(k);
    }));
    for (const sp of (f.sendPaths || []))
      for (const k of new Path(sp).blockedTiles()) laneTiles.add(k);

    /* The arena is a diamond inside a square field; everything outside the L1
       rim is not board at all and must not be painted as ground. */
    const isVoid = f.voidTiles ? (x, y) => f.voidTiles.has(x + ',' + y) : () => false;
    /* Exactly Game.ownsTile: an ownerGrid where the board has one, the
       buildMax columns where it does not. */
    const ownerAt = f.ownerGrid
      ? (x, y) => { const r = f.ownerGrid[y]; const v = r ? r[x] : undefined; return v === undefined ? -1 : v; }
      : (x, y) => x <= f.buildMax[0] ? 0 : (x >= f.buildMax[1] ? 1 : -1);
    const rubble = (x, y) => f.terrain.has(x + ',' + y);
    const ground = (x, y) => !isVoid(x, y) && !rubble(x, y) && !laneTiles.has(x + ',' + y);

    /* Tiles merge into horizontal runs before they become geometry. The arena
       is 47x47 and one <rect> a tile is 2,209 nodes in a card that opens on
       hover; this is one <path> per layer instead. */
    const runs = pred => {
      let d = '';
      for (let y = 0; y < rows; y++) {
        let x0 = -1;
        for (let x = 0; x <= cols; x++) {
          if (x < cols && pred(x, y)) { if (x0 < 0) x0 = x; }
          else if (x0 >= 0) { d += 'M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h' + (x0 - x) + 'z'; x0 = -1; }
        }
      }
      return d;
    };
    const layer = (d, cls, extra) => d ? '<path class="' + cls + '" d="' + d + '"' + (extra || '') + '/>' : '';

    const g = [];
    g.push(layer(runs((x, y) => !isVoid(x, y)), 'pv-board'));
    g.push(layer(runs((x, y) => ground(x, y) && ownerAt(x, y) < 0), 'pv-neutral'));
    if (seats <= MAP_PV_TINT_MAX_SEATS) {
      for (let i = 0; i < seats; i++)
        g.push(layer(runs((x, y) => ground(x, y) && ownerAt(x, y) === i),
                     'pv-own', ' fill="' + previewSeatTint(i) + '"'));
    } else {
      g.push(layer(runs((x, y) => ground(x, y) && ownerAt(x, y) >= 0), 'pv-build'));
    }
    g.push(layer(runs(rubble), 'pv-rubble'));

    /* THE HORIZON, arena only. That the board SHRINKS is the mode's whole
       identity, and it is the one thing a lane drawing cannot say. Both rings
       are read off the built field, so the card cannot promise a contraction
       the engine will not run. */
    if (f.centre) {
      const dia = r => [[0, -r], [r, 0], [0, r], [-r, 0]]
        .map(p => q(f.centre[0] + 0.5 + p[0]) + ',' + q(f.centre[1] + 0.5 + p[1])).join(' ');
      g.push('<polygon class="pv-horizon-max" points="' + dia(f.horizonMax) + '"/>');
      g.push('<polygon class="pv-horizon" points="' + dia(f.core) + '"/>');
    }

    /* Lanes: every casing first, then every core, so a road crossing another
       road is not outlined over the top of it. The polyline IS the authored
       lane at tile centres -- the identical points `new Path(lane)` builds its
       segments from, divided by TILE. */
    const poly = pts => pts.map((p, i) =>
      (i ? 'L' : 'M') + q(p[0] + 0.5) + ' ' + q(p[1] + 0.5)).join(' ');
    for (const L of lanes)
      g.push('<path class="pv-lane-case" d="' + poly(L.pts) +
             '" stroke-width="' + MAP_PV_LANE_CASE_W + '"/>');
    for (const L of lanes)
      g.push('<path class="pv-lane" data-lane="' + L.si + '" d="' + poly(L.pts) +
             '" stroke="' + previewSeatTint(L.si) + '" stroke-width="' + MAP_PV_LANE_W + '"/>');

    /* Where a wave enters. On THE LATTICE that is three separate gates and the
       blurb spends a sentence on it; on a tri board it is the shared hub. */
    const gates = new Set();
    for (const L of lanes) gates.add(L.pts[0][0] + ',' + L.pts[0][1]);
    for (const key of gates) {
      const p = key.split(',').map(Number);
      g.push('<circle class="pv-gate" cx="' + q(p[0] + 0.5) + '" cy="' + q(p[1] + 0.5) +
             '" r="' + MAP_PV_SPAWN_R + '"/>');
    }

    for (const nd of (f.nodes || [])) {
      const el = ELEMENTS[nd.el];
      g.push('<circle class="pv-node' + (nd.kind === 'lane' ? ' lane' : '') +
             '" cx="' + q(nd.gx + 0.5) + '" cy="' + q(nd.gy + 0.5) +
             '" r="' + (nd.kind === 'lane' ? MAP_PV_NODE_LANE_R : MAP_PV_NODE_R) +
             '" fill="' + el.color + '" stroke="' + el.color + '"/>');
    }

    f.bases.forEach((b, i) => {
      g.push('<circle class="pv-base" data-base="' + i + '" cx="' + q(b[0] + 0.5) +
             '" cy="' + q(b[1] + 0.5) + '" r="' + MAP_PV_BASE_R +
             '" stroke="' + previewSeatTint(i) + '"/>');
      g.push('<circle class="pv-base-dot" cx="' + q(b[0] + 0.5) + '" cy="' + q(b[1] + 0.5) +
             '" r="' + q(MAP_PV_BASE_R * 0.34) + '" fill="' + previewSeatTint(i) + '"/>');
    });

    /* Ground SEAT 0 can actually build on, counted with the predicates above
       rather than estimated -- the caption prints this number, and a number
       the UI prints has to be the one the engine computes. */
    let own = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) if (ground(x, y) && ownerAt(x, y) === 0) own++;

    const pad = MAP_PV_PAD;
    const svg = '<svg class="pv-svg" viewBox="' + q(-pad) + ' ' + q(-pad) + ' ' +
      q(cols + pad * 2) + ' ' + q(rows + pad * 2) + '" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="' + m.name + ' battlefield: ' + cols + ' by ' + rows +
      ' tiles, ' + seats + ' seats, ' + lanes.length + ' lanes">' + g.join('') + '</svg>';

    return { svg: svg, field: f, cols: cols, rows: rows, seats: seats,
             lanes: lanes.length, perSide: f.lanes[0].length, ground: own,
             tall: rows / cols >= MAP_PV_TALL_ASPECT };
  },

  /** The minimap alone. `mapThumb`, the name this replaces, is deliberately
      NOT kept as an alias: its one caller moves to mapPreviewBlock below, and
      a method with no reader is this repository's signature defect. */
  mapPreview(m) { return m ? this.previewModel(m).svg : ''; },

  /**
   * The minimap plus the one line of fact under it.
   *
   * `size` picks the box, not the drawing: a tooltip and a briefing show the
   * IDENTICAL board, because a preview that said two different things about
   * one map would be the eighth desync.
   */
  mapPreviewBlock(m, o) {
    if (!m) return '';
    o = o || {};
    const p = this.previewModel(m);
    /* Kept to one line at 320px, the tooltip's width -- a caption that wraps
       under a picture reads as a paragraph and stops being scanned. */
    const cap = [p.cols + '\u00d7' + p.rows,
                 p.seats + ' seats',
                 p.perSide + (p.perSide === 1 ? ' lane' : ' lanes') + ' a side',
                 p.ground + ' buildable'];
    return '<div class="br-pv' + (o.size === 'tip' ? ' tip' : '') + (p.tall ? ' tall' : '') +
           '">' + p.svg + '</div><div class="pv-cap">' + cap.join(' \u00b7 ') + '</div>';
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
              style="--tc:${t.color}; --cc:${o.color}"
              aria-pressed="${idx >= 0 ? 'true' : 'false'}">
        <span class="lo-rest">
          <span class="lo-figure">${this.towerIconHTML(id, 40)}${
            idx >= 0 ? `<span class="lo-num">${idx + 1}</span>` : ''}</span>
          <span class="lo-id">
            <span class="lo-top"><b>${t.name}</b></span>
            <span class="lo-meta"><span class="lo-og" style="--og:${o.color}">${
              o.icon} ${o.short}</span><em><i class="lo-el" style="--el:${el.color}">${el.icon}</i>◈${t.cost}</em></span>
          </span>
        </span>
      </button>
    </div>`;
  },

  /* ============================================ THE UNITS ACCESSOR ==== */

  /**
   * The ONE place this screen reads the unit roster through.
   *
   * The units data model (19.10/19.11) lands in a parallel change that owns
   * factions.js, config.js and commanders.js. Every reader below asks for the
   * shape that change is expected to publish and falls back to the muster
   * roster shipping today, so this screen works standalone AND picks up the
   * real roster the moment it exists without another edit here. Nothing else
   * in this file may reach past these -- a second reader is exactly how the
   * two would come to disagree about what a unit is.
   */
  unitDef(id) {
    const U = (typeof UNIT_TYPES !== 'undefined' && UNIT_TYPES) || null;
    const E = (typeof ENEMY_TYPES !== 'undefined' && ENEMY_TYPES) || null;
    const u = U && U[id], e = E && E[id];
    if (!u) return e || null;
    if (!e) return u;
    /* A unit lives in two tables ON PURPOSE: the stat block and the drawing
       shape are the body it is fielded as, the identity, doctrine and talents
       are what the units model added on top. Merged once and cached, because
       every card, every icon and every preview frame asks for it. Both tables
       are authored, never mutated, so the cache can never go stale. */
    const c = this._unitDefs || (this._unitDefs = {});
    return c[id] || (c[id] = Object.assign({}, e, u));
  },
  /** First Meta method that exists, bound. Named preferences first. */
  metaFn() {
    if (typeof Meta === 'undefined') return null;
    for (let i = 0; i < arguments.length; i++) {
      const n = arguments[i];
      if (typeof Meta[n] === 'function') return Meta[n].bind(Meta);
    }
    return null;
  },
  unitCap() {
    if (typeof UNIT_LOADOUT_SIZE !== 'undefined') return UNIT_LOADOUT_SIZE;
    if (typeof MUSTER_LOADOUT_SIZE !== 'undefined') return MUSTER_LOADOUT_SIZE;
    return 3;
  },
  unitUnlocked() {
    const f = this.metaFn('unitUnlocked', 'musterUnlocked');
    return (f ? f() : []).filter(id => this.unitDef(id));
  },
  unitPicked() {
    const f = this.metaFn('unitLoadout', 'musterLoadout');
    return (f ? f() : []).filter(id => this.unitDef(id));
  },
  unitToggle(id) {
    const f = this.metaFn('toggleUnit', 'toggleMuster');
    return f ? !!f(id) : false;
  },
  /** Pack size, price and wave income. `musterTierFor` is the SAME derivation
      the spawn, the muster bar and the rival brain read; a second one here is
      the desync class this project has shipped seven times. */
  unitTier(id) {
    const f = (typeof unitTierFor === 'function') ? unitTierFor
            : (typeof musterTierFor === 'function') ? musterTierFor : null;
    return f ? f(id) : null;
  },
  unitSendable(id) {
    const f = (typeof unitSendable === 'function') ? unitSendable
            : (typeof musterSendable === 'function') ? musterSendable : null;
    return f ? !!f(id) : !!this.unitDef(id);
  },
  /**
   * Locked, but reachable in THIS playthrough.
   *
   * The unit track if the model publishes one, plus whatever the maps still
   * declare -- `m.units` is read beside `m.denizens` so a second per-map track
   * costs nothing here. Then the 19.14 campaign gate: a Pirate campaign can
   * never rescue a Votary, so a Votary is NOT a card in this column; it is a
   * Soul Shop purchase exactly as a locked tower is. That keeps the two
   * columns siblings in policy as well as in shape.
   */
  unitRescuable() {
    const pref = this.metaFn('unitRescuable');
    const have = this.unitUnlocked();
    const track = pref ? pref()
      : (typeof unitTrackIds === 'function' ? unitTrackIds() : []);
    const dens = (typeof MAPS !== 'undefined' ? MAPS : [])
      .reduce((a, m) => a.concat(m.denizens || [], m.units || []), []);
    return [...new Set(track.concat(dens))].filter(id =>
      this.unitDef(id) && this.unitSendable(id) &&
      have.indexOf(id) < 0 && !this.unitFactionLock(id));
  },
  /** The power that owns a unit this campaign may not rescue, or null. */
  unitFactionLock(id) {
    const f = this.metaFn('unitRescueLock');
    return f ? f(id) : null;
  },
  /** Everything the campaign gate holds back, for the Soul Shop note. */
  unitGated() {
    const have = this.unitUnlocked();
    const track = typeof unitTrackIds === 'function' ? unitTrackIds() : [];
    return track.filter(id => have.indexOf(id) < 0 && this.unitFactionLock(id));
  },
  unitSoulCost(id) {
    const f = this.metaFn('unitUnlockCost');
    return f ? f(id) : null;
  },
  /** The unit's own doctrine, when the model authors one. The tower detail
      prints its ORIGIN rule in the same slot; these are the same promise made
      to the two columns. */
  unitDoctrine(id) {
    if (typeof unitDoctrineOf !== 'function') return null;
    try { return unitDoctrineOf(id) || null; } catch (e) { return null; }
  },
  unitHomes(id) {
    return (typeof MAPS !== 'undefined' ? MAPS : [])
      .filter(m => [].concat(m.denizens || [], m.units || []).indexOf(id) >= 0)
      .map(m => m.name).join(' or ');
  },
  /** Whoever fields it. No allegiance means a Vigil machine, which is the
      rule factions.js already applies when it stamps `faction: null`. */
  unitHost(id) {
    const def = this.unitDef(id);
    const f = def && def.faction;
    return (f && typeof FACTIONS !== 'undefined' && FACTIONS[f]) || MACHINE_HOST;
  },
  /** Talent nodes, when the model has them (19.13). Absent today, so the
      panel prints the dossier instead of an empty section. */
  unitTalents(id) {
    const def = this.unitDef(id);
    return (def && Array.isArray(def.talents)) ? def.talents : [];
  },

  /**
   * The one thing this unit DOES, read off its definition rather than
   * authored a second time. A unit the parallel model adds gets the right
   * badge and the right preview without a line changing here -- and a trait
   * nobody reads cannot ship, because the badge and the animation are driven
   * from the same call.
   */
  unitTrait(id) {
    const d = this.unitDef(id);
    if (!d) return { key: 'march', label: 'MARCHES' };
    const nm = t => ((this.unitDef(t) || {}).name || t).toUpperCase();
    const f1 = v => (v || 0).toFixed(1);
    if (d.summon)   return { key: 'summon', label: 'BIRTHS ' + nm(d.summon.type) + ' EVERY ' + f1(d.summon.interval) + 's' };
    if (d.splitInto) return { key: 'split', label: 'SPLITS INTO ' + d.splitCount + ' ' + nm(d.splitInto) };
    if (d.teleport) return { key: 'blink',  label: 'GRAPPLES ' + f1(d.teleport.tiles) + ' TILES EVERY ' + f1(d.teleport.interval) + 's' };
    if (d.jam)      return { key: 'jam',    label: 'JAMS TOWERS FOR ' + f1(d.jam.duration) + 's' };
    if (d.revive)   return { key: 'revive', label: 'RISES ONCE AT ' + Math.round(d.revive * 100) + '%' };
    if (d.healRate) return { key: 'heal',   label: 'HEALS ' + d.healRate + '/s AHEAD OF IT' };
    if (d.aura)     return { key: 'aura',   label: (d.aura.label || 'AURA') + ' — ' + f1(d.aura.radius) + ' TILES' };
    if (d.shield)   return { key: 'ward',   label: 'WARD ' + d.shield + ', REFORMS IN ' + f1(d.shieldDelay) + 's' };
    if (d.phase)    return { key: 'phase',  label: 'PHASES OUT OF REACH' };
    if (d.flying)   return { key: 'fly',    label: 'FLIES THE MAZE' };
    if (d.pullImmune || d.slowResist) return { key: 'anchor', label: 'ANCHORED — BARELY SLOWED' };
    if (d.splashResist) return { key: 'plate', label: 'SPLASH-RESIST ' + Math.round(d.splashResist * 100) + '%' };
    return { key: 'march', label: 'HOLDS FORMATION' };
  },

  /* ================================= FOCUS AND THE DETAIL COLUMNS ===== */

  /** What each detail column is currently explaining. */
  loFocus() { return this._loFocus || (this._loFocus = { tower: null, unit: null }); },

  /**
   * Point one detail column at one card. Hover, keyboard focus, the chosen
   * strip and the first tap of a touch all arrive HERE, so the four input
   * routes cannot drift into showing four different things.
   */
  focusDetail(kind, id, force) {
    const f = this.loFocus();
    if (f[kind] === id && !force) return;
    f[kind] = id;
    const grid = $(kind === 'unit' ? '#unit-grid' : '#loadout-grid');
    if (grid) $$('.lo-card', grid).forEach(c =>
      c.classList.toggle('focus', c.dataset.lo === id || c.dataset.unit === id));
    if (kind === 'unit') this.renderUnitDetail(); else this.renderTowerDetail();
  },

  /* ========================================== THE NARROW DRAWER ======= */

  /** True while the viewport cannot hold four columns. */
  loNarrow() {
    return typeof window.matchMedia === 'function' &&
           window.matchMedia('(max-width: ' + (LO_FOUR_COL_MIN_PX - 1) + 'px)').matches;
  },
  /**
   * Each detail column becomes a drawer entering from the side its column
   * lives on, so the motion says WHICH picker it belongs to rather than
   * merely appearing. Returns false on a wide viewport, where both panels are
   * already on screen and there is nothing to open.
   */
  openLoadoutDrawer(kind) {
    const cols = $('#lo-columns');
    if (!cols || !this.loNarrow()) return false;
    cols.classList.add('drawer-open');
    cols.classList.toggle('drawer-unit', kind === 'unit');
    cols.classList.toggle('drawer-tower', kind === 'tower');
    this._loDrawer = kind;
    this.syncLoadoutLayout();
    const x = $((kind === 'unit' ? '#unit-detail' : '#tower-detail') + ' .lo-drawer-x');
    if (x && x.focus) x.focus();
    return true;
  },
  closeLoadoutDrawer() {
    const cols = $('#lo-columns');
    if (cols) cols.classList.remove('drawer-open', 'drawer-unit', 'drawer-tower');
    const kind = this._loDrawer;
    if (!kind) return;
    this._loDrawer = null;
    this.syncLoadoutLayout();
    /* Focus was inside a panel that is now off-canvas and inert. Handed back
       to the control that opened it, or the next Tab restarts at the top of
       the page -- the same failure the keyboard pick already had to fix.
       Skipped when the screen itself has gone away (offsetParent is null
       under .hidden), because that call comes from UI.show. */
    const b = $((kind === 'unit' ? '#unit-column' : '#tower-column') + ' .lo-detail-open');
    if (b && !b.hidden && cols && cols.offsetParent && b.focus) b.focus();
  },
  /**
   * Reconcile the layout with the viewport. An off-canvas drawer is still in
   * the accessibility tree, so without `inert` a screen reader walks a closed
   * drawer as ordinary page content sitting between the two pickers.
   */
  syncLoadoutLayout() {
    const cols = $('#lo-columns');
    if (!cols) return;
    const narrow = this.loNarrow();
    cols.classList.toggle('narrow', narrow);
    if (!narrow && this._loDrawer) {
      this._loDrawer = null;
      cols.classList.remove('drawer-open', 'drawer-unit', 'drawer-tower');
    }
    [['unit', '#unit-detail'], ['tower', '#tower-detail']].forEach(pair => {
      const p = $(pair[1]);
      if (!p) return;
      const shut = narrow && this._loDrawer !== pair[0];
      if (shut) p.setAttribute('inert', ''); else p.removeAttribute('inert');
      p.setAttribute('aria-hidden', shut ? 'true' : 'false');
    });
    $$('.lo-detail-open', cols).forEach(b => { b.hidden = !narrow; });
  },
  /** The header control that reaches the drawer names what it will show, so
      a narrow player is never asked to open an unlabelled panel. */
  syncDetailOpeners() {
    const f = this.loFocus();
    [['unit', '#unit-column'], ['tower', '#tower-column']].forEach(pair => {
      const b = $(pair[1] + ' .lo-detail-open');
      if (!b) return;
      const id = f[pair[0]];
      const d = pair[0] === 'unit' ? this.unitDef(id) : (id && TOWER_TYPES[id]);
      b.innerHTML = '◫ <b>' + (d ? d.name : 'DETAIL') + '</b>';
      b.setAttribute('aria-label', 'Open ' + (d ? d.name : pair[0]) + ' detail');
    });
  },

  /* =============================================== ONE PICKER BINDER == */

  /**
   * Units and towers are the same decision made twice, so they are the same
   * component twice: one binder, five input routes -- hover, keyboard focus,
   * arrow keys, the first tap and the second tap. Two implementations of this
   * would drift within a session.
   */
  bindPickerCards(grid, kind) {
    if (!grid) return;
    const attr = kind === 'unit' ? 'unit' : 'lo';
    $$('.lo-card', grid).forEach(card => {
      const id = card.dataset[attr];
      if (!id) return;
      card.addEventListener('mouseenter', () => { Sound.play('hover'); this.focusDetail(kind, id); });
      card.addEventListener('focus', () => this.focusDetail(kind, id));
      /* Touch has no hover, so the FIRST tap only READS the card -- it points
         the detail column, and opens the drawer when the panel is off-canvas
         -- and the SECOND commits. Otherwise a phone player picks something
         whose detail they were given no way to see. UI.tapArm is the same
         rule the universe map has used since Session 16, and it returns true
         immediately on a fine pointer, which hovered first. */
      card.addEventListener('click', ev => {
        const armed = this.tapArm(card, () => {
          this.focusDetail(kind, id);
          this.openLoadoutDrawer(kind);
        });
        if (!armed) return;
        this.focusDetail(kind, id);
        this.commitPick(kind, id, ev.detail === CLICK_DETAIL_KEYBOARD);
      });
      card.addEventListener('keydown', ev => this.pickerKey(ev, grid, kind, card));
    });

    /* The pick destroyed the button that was focused. A KEYBOARD pick asks
       for its replacement back; a mouse user would only be handed a focus
       ring they never asked for. */
    const keepKey = kind === 'unit' ? '_loKeepUnit' : '_loKeep';
    const refKey = kind === 'unit' ? '_loRefocusUnit' : '_loRefocus';
    const keep = this[keepKey]; this[keepKey] = '';
    const refocus = this[refKey]; this[refKey] = false;
    if (keep) {
      this.focusDetail(kind, keep, true);
      const card = grid.querySelector('.lo-card[data-' + attr + '="' + keep + '"]');
      if (refocus && card && card.focus) card.focus();
    }
  },

  /** One commit path for both columns, so "denied" means the same thing in
      both and neither can start toggling by a different rule. */
  commitPick(kind, id, byKeyboard) {
    if (kind === 'unit') {
      if (!this.unitToggle(id)) { Sound.play('denied'); return; }
      Sound.play('click');
      this._loKeepUnit = id; this._loRefocusUnit = !!byKeyboard;
      this.renderUnits();
      return;
    }
    if (!Meta.isTowerUnlocked(id)) { Sound.play('denied'); return; }
    const i = this.sel.loadout.indexOf(id);
    if (i >= 0) this.sel.loadout.splice(i, 1);
    else if (this.sel.loadout.length < this.loadoutTarget()) this.sel.loadout.push(id);
    else { Sound.play('denied'); return; }
    this._loKeep = id; this._loRefocus = !!byKeyboard;
    Sound.play('click');
    this.renderLoadout();
  },

  /** Track count MEASURED off the laid-out grid, never assumed: both pickers
      are auto-fill and the count changes with the viewport. */
  pickerCols(grid) {
    const slots = $$('.lo-slot', grid);
    if (!slots.length) return 1;
    const top = slots[0].offsetTop;
    let n = 0;
    for (const s of slots) { if (s.offsetTop !== top) break; n++; }
    return Math.max(1, n);
  },

  /**
   * Arrows walk a picker, and running off the INNER edge crosses into the
   * sibling picker. The layout claims these two columns are a pair; this is
   * that claim made true for a keyboard as well as for an eye.
   */
  pickerKey(ev, grid, kind, card) {
    const k = ev.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    const cards = $$('.lo-card', grid);
    const i = cards.indexOf(card);
    if (i < 0) return;
    ev.preventDefault();
    const cols = this.pickerCols(grid);
    const j = i + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols);
    if (j >= 0 && j < cards.length) { cards[j].focus(); return; }
    /* UNITS sit left of TOWERS, so exactly two of the eight edge cases are a
       crossing and the other six are the ends of the list. */
    const cross = (kind === 'unit' && k === 'ArrowRight') ? $('#loadout-grid')
                : (kind === 'tower' && k === 'ArrowLeft') ? $('#unit-grid') : null;
    if (!cross) return;
    const sib = $$('.lo-card', cross);
    if (sib.length) (kind === 'unit' ? sib[0] : sib[sib.length - 1]).focus();
  },

  /* Retained names. UI.show closes the screen through closeLoadoutCard, and
     what it used to close -- an expansion inside the card -- is now the
     detail column and its drawer. */
  openLoadoutCard(slot) {
    if (!slot) return;
    const uid = slot.dataset.uslot;
    const id = slot.dataset.slot || uid;
    if (id) this.focusDetail(uid ? 'unit' : 'tower', id, true);
  },
  closeLoadoutCard() {
    this.closeLoadoutDrawer();
    /* Returns on its first line unless a preview is actually running, which
       is what makes it free to call on every screen change. */
    if (!this._loPreviewOn) return;
    this._loPreviewOn = false;
    this.stopTowerPreview();
  },
  bindLoadoutCards() { this.bindPickerCards($('#loadout-grid'), 'tower'); },

  /* ============================================= THE CHOSEN STRIP ===== */

  /**
   * What you have taken so far, in order, in the header of the column that
   * took it. The empty slots say how many more you may take without a
   * sentence saying it, and both columns get the same strip because both
   * columns are the same kind of promise.
   */
  chosenStripHTML(kind, picks, cap) {
    const out = [];
    for (let i = 0; i < cap; i++) {
      const id = picks[i];
      if (!id) { out.push('<span class="lo-chip empty" aria-hidden="true"></span>'); continue; }
      const d = kind === 'unit' ? (this.unitDef(id) || {}) : (TOWER_TYPES[id] || {});
      out.push('<button class="lo-chip" type="button" data-chosen="' + kind + ':' + id +
               '" style="--tc:' + d.color + '" title="' + d.name + '"><i>' + (i + 1) +
               '</i><b>' + d.name + '</b></button>');
    }
    return out.join('');
  },
  bindChosenStrip(strip) {
    $$('[data-chosen]', strip).forEach(b => {
      const parts = b.dataset.chosen.split(':');
      b.addEventListener('mouseenter', () => this.focusDetail(parts[0], parts[1]));
      b.addEventListener('focus', () => this.focusDetail(parts[0], parts[1]));
      b.addEventListener('click', () => {
        Sound.play('click');
        this.focusDetail(parts[0], parts[1], true);
        this.openLoadoutDrawer(parts[0]);
      });
    });
  },

  /* ============================================ THE DETAIL COLUMNS ==== */

  /** Eyebrow plus the drawer's close control. One helper, so the two panels
      cannot grow different chrome. */
  detailChromeHTML(kind, eyebrow) {
    return '<div class="lo-d-top"><span class="lo-d-eyebrow">' +
      (kind === 'unit' ? 'DETACHMENT' : 'ARSENAL') + ' · ' + eyebrow +
      '</span><button class="lo-drawer-x icon-btn sm" type="button" aria-label="Close detail">✕</button></div>';
  },
  detailEmptyHTML(kind, msg) {
    return this.detailChromeHTML(kind, 'NOTHING SELECTED') + '<p class="hint">' + msg + '</p>';
  },
  bindDetailChrome(panel) {
    const x = panel.querySelector('.lo-drawer-x');
    if (x) x.addEventListener('click', () => { Sound.play('click'); this.closeLoadoutDrawer(); });
    this.bindChipTips(panel);
  },

  /**
   * THE RIGHT COLUMN -- the tower the towers column is currently offering.
   * Every statistic comes from towerStatRows, the same formatter the shop
   * tooltip prints from, so the two panels cannot drift apart.
   */
  renderTowerDetail() {
    const panel = $('#tower-detail');
    if (!panel) return;
    const id = this.loFocus().tower;
    const t = id && TOWER_TYPES[id];
    if (!t) {
      panel.innerHTML = this.detailEmptyHTML('tower', 'Hover or focus a tower to read it.');
      this.bindDetailChrome(panel);
      return;
    }
    const o = originOf(id), el = ELEMENTS[t.element];
    const at = this.sel.loadout.indexOf(id);
    panel.innerHTML = this.detailChromeHTML('tower', o.name) + `
      <div class="lo-d-head" style="--tc:${t.color}; --og:${o.color}">
        <span class="lo-d-fig">${this.towerIconHTML(id, 46)}</span>
        <span class="lo-d-name"><b>${t.name}</b><span class="lo-role">${t.role}</span></span>
        <span class="lo-d-cost">◈${t.cost}</span>
      </div>
      ${/* The painted plate, when the pack has one. artImg returns '' for a
            key the pack has not got, so an un-rendered tower shows the
            procedural icon above and nothing else -- no broken image, no
            layout shift. That is what lets the catalogue entry ship before
            the pixels do. */ ''}
      ${artImg('twr_' + id, 'lo-d-art', t.name)}
      <div class="lo-chips">
        <span class="elem-badge" style="--el:${el.color}">${el.icon} ${el.name}</span>
        ${this.originBadge(id)}
        ${at >= 0 ? `<span class="lo-d-in">IN LOADOUT · ${at + 1}</span>` : ''}
      </div>
      <canvas class="lo-stage" data-stage="${id}" width="${LO_STAGE_W}" height="${LO_STAGE_H}"></canvas>
      <p class="lo-desc">${t.desc}</p>
      <div class="lo-stats">${this.towerStatRows(id).map(r =>
        `<i><span>${r[0]}</span><b>${r[1]}</b></i>`).join('')}</div>
      <p class="lo-d-rule" style="--og:${o.color}"><b>${o.icon} ${o.rule}</b>${o.desc}</p>
      <div class="lo-d-sep"><span>TALENTS</span></div>
      <div id="tower-talents"></div>`;
    this.paintTowerIcons(panel);
    this.renderTowerTalents();
    this.bindDetailChrome(panel);
    const cv = panel.querySelector('.lo-stage');
    if (cv) { this._loPreviewOn = true; this.runTowerPreview(cv, id); }
    this.syncDetailOpeners();
  },

  /**
   * THE LEFT COLUMN -- the unit the units column is currently offering.
   *
   * Pack size, price and wave income come from unitTier, which is
   * musterTierFor: the same derivation the muster bar, the spawn and the
   * rival brain read. Health, speed, armour and the leak cost are printed off
   * the definition unscaled and labelled as base, because wave scaling is a
   * battle fact and this screen is not in one.
   */
  renderUnitDetail() {
    const panel = $('#unit-detail');
    if (!panel) return;
    const id = this.loFocus().unit;
    const def = id && this.unitDef(id);
    if (!def) {
      panel.innerHTML = this.detailEmptyHTML('unit', 'Hover or focus a unit to read it.');
      this.bindDetailChrome(panel);
      return;
    }
    const host = this.unitHost(id);
    const tier = this.unitTier(id);
    const trait = this.unitTrait(id);
    const doc = this.unitDoctrine(id);
    const at = this.unitPicked().indexOf(id);
    const owned = this.unitUnlocked().indexOf(id) >= 0;
    const homes = this.unitHomes(id);
    const gate = this.unitFactionLock(id);
    const cost = this.unitSoulCost(id);
    const lives = def.lives || 1;
    const rows = [
      ['Base health', formatNum(Math.round(def.hp))],
      ['Speed', (def.speed || 0).toFixed(2)],
      ['Armour', def.armor || 0],
      ['Costs on a leak', lives + (lives === 1 ? ' life' : ' lives')]
    ];
    if (tier) rows.push(
      ['Pack', tier.count + ' × ' + def.name],
      ['Price', Math.round(tier.cost * 100) + '% of a wave reward'],
      ['ECON', '+' + Math.round(tier.incomePct * 100) + '% per summon']);
    const els = (obj, sign) => obj
      ? Object.keys(obj).map(k => `<span class="ei-el" style="--el:${ELEMENTS[k].color}">${
          ELEMENTS[k].icon} ${ELEMENTS[k].name} ${sign}${Math.round(obj[k] * 100)}%</span>`).join('')
      : '';
    const marks = els(def.elemWeak, '+') + els(def.elemResist, '−');
    panel.innerHTML = this.detailChromeHTML('unit', host.name) + `
      <div class="lo-d-head" style="--tc:${def.color}; --og:${host.color}">
        <span class="lo-d-fig">${this.unitIconHTML(id, 46)}</span>
        <span class="lo-d-name"><b>${def.name}</b><span class="lo-role">${host.short || host.name}</span></span>
        ${tier ? `<span class="lo-d-cost">${tier.icon} ×${tier.count}</span>` : ''}
      </div>
      ${/* The painted troop plate, on the screen where troops are CHOSEN.
            Twenty of these were re-rendered specifically because the army art
            did not match the commander portraits (ROADMAP 19.25) and then
            appeared on exactly one surface: the once-ever NEW CONTACT dossier,
            which only fires for bodies marching AT you -- so a player who
            fielded a TROOPER every match could go a whole campaign without
            seeing its painting. Same key namespace as the dossier (`foe_`,
            units share the enemy registry) and the same artImg contract as
            the tower panel above: '' for a key the pack has not got, so the
            five machine soldiers show their procedural sprite and nothing
            else until their pixels exist. */ ''}
      ${artImg('foe_' + id, 'lo-d-art', def.name)}
      <div class="lo-chips">
        <span class="lo-d-trait" style="--tc:${def.color}">${trait.label}</span>
        ${at >= 0 ? `<span class="lo-d-in">IN DETACHMENT · ${at + 1}</span>` : ''}
      </div>
      <canvas class="lo-stage" data-ustage="${id}" width="${LO_STAGE_W}" height="${LO_STAGE_H}"></canvas>
      <p class="lo-desc">${def.desc || ''}</p>
      <div class="lo-stats">${rows.map(r =>
        `<i><span>${r[0]}</span><b>${r[1]}</b></i>`).join('')}</div>
      ${marks ? `<div class="lo-chips">${marks}</div>` : ''}
      ${doc ? `<p class="lo-d-rule" style="--og:${doc.color || host.color}"><b>${
          host.icon} ${doc.name}</b>${doc.desc}</p>` : ''}
      ${owned ? '' : `<p class="lo-d-gate">${gate
          ? 'A <b>' + gate.name + '</b> soldier. A campaign rescues only its own power’s units and neutral machines' +
            (cost != null ? ' — bought outright with <b>◉ ' + cost + '</b> it is install-wide, and any commander may field it.' : '.')
          : 'Not yet rescued. ' + (homes
              ? 'Conquer (★★★) a world fought on <b>' + homes + '</b> to bring it home.'
              : 'No world in this galaxy garrisons it.')}</p>`}
      ${this.unitTalents(id).length
        ? '<div class="lo-d-sep"><span>TALENTS</span></div><div id="unit-talents"></div>'
        : ''}`;
    this.paintUnitIcons(panel);
    this.renderUnitTalents();
    this.bindDetailChrome(panel);
    const cv = panel.querySelector('.lo-stage');
    if (cv) { this._loPreviewOn = true; this.runUnitPreview(cv, id); }
    this.syncDetailOpeners();
  },

  /* ================================================ ONE TALENT GRID == */

  /**
   * The talent grid for ANY definition carrying `talents` -- towers today,
   * units when 19.13 lands. The Meta calls are the tower tree's own, so a
   * unit tree inherits the pick-one-per-row rule, the mastery gate and the
   * stock-build merge rather than growing a parallel system beside them.
   *
   * If the allocator has not learned about a definition yet the nodes still
   * render, read-only: an empty section is how a shipped feature comes to
   * read as missing.
   */
  talentGridHTML(id, def) {
    const nodes = Array.isArray(def.talents) ? def.talents : [];
    if (!nodes.length) return '';
    let live = false;
    try {
      live = typeof Meta.talentLockReason === 'function' &&
             Meta.talentLockReason(id, nodes[0].id) !== undefined;
    } catch (e) { live = false; }
    const rowIds = [...new Set(nodes.map(t => t.row))].sort();
    return rowIds.map(row => {
      const cols = [...new Set(nodes.filter(t => t.row === row).map(t => t.col))].sort();
      const cells = cols.map(col => {
        const n = nodes.find(t => t.row === row && t.col === col);
        if (!n) return '<div class="tt-cell empty"></div>';
        const owned = live && Meta.hasTalent(id, n.id);
        const reason = live ? Meta.talentLockReason(id, n.id) : 'not allocatable yet';
        const can = live && reason === null;
        const mReq = Meta.talentMasteryReq(n);
        const mLock = live && Meta.masteryOf(id) < mReq;
        return `<button class="tal-node sm ${owned ? 'owned' : can ? 'can' : 'locked'}"
                  data-talent="${id}:${n.id}" ${owned || !can ? 'disabled' : ''} style="--cc:${def.color}"
                  title="${n.desc}${owned ? '' : reason ? ' — ' + reason : ''}">
            <span class="tal-rank">${owned ? '1/1' : mLock ? 'M' + mReq : '0/1'}</span>
            <span class="tal-tname">${mLock && !owned ? '🔒 ' : ''}${n.name}</span>
            <span class="tal-tdesc">${n.desc}</span>
          </button>`;
      }).join('');
      /* A row needs a point invested in the row directly above it. */
      const gated = live && row > 0 &&
        !nodes.filter(t => t.row === row - 1).some(t => Meta.hasTalent(id, t.id));
      return `<div class="tt-row ${gated ? 'row-locked' : ''}" style="--tt-cols:${cols.length}">${cells}</div>`;
    }).join('');
  },

  /** Head row and grid together. Every Meta reader is guarded because the
      unit half of this only became allocatable when the units model landed;
      a tree that throws is worse than one that renders read-only. */
  talentTreeHTML(id, def) {
    const grid = this.talentGridHTML(id, def);
    if (!grid) return '';
    let spent = 0, stock = false, lvl = 0;
    try { spent = Meta.talentSpent(id); } catch (e) {}
    try { stock = Meta.usingDefaults(id); } catch (e) {}
    try { lvl = Meta.masteryProgress(id).level; } catch (e) {}
    return `<div class="tt-tree" style="--tc:${def.color}">
      <div class="tt-head-row">
        <b>${def.name}</b>
        <span class="tt-mastery" data-tt="MASTERY ${lvl}|Earned by fighting with this, never bought. Higher mastery unlocks the deeper rows.">M${lvl}</span>
        ${stock ? '<span class="tt-stock">stock build</span>' : ''}
        <span class="tt-pts ${spent === TALENT_POINTS ? 'full' : ''}">${spent}/${TALENT_POINTS}</span>
        <button class="icon-btn sm" data-clear-talent="${id}" title="Clear" aria-label="Clear talent picks">↺</button>
      </div>
      ${grid}
    </div>`;
  },
  /** `after` is what re-renders. A UNIT talent changes its pack size through
      unitFieldMods, which musterTierFor folds -- so a unit tree must redraw
      the numbers beside it, not just itself, or the panel starts quoting a
      pack the engine will not march. */
  bindTalents(wrap, after) {
    this.bindChipTips(wrap);
    $$('[data-talent]', wrap).forEach(b => b.addEventListener('click', () => {
      const parts = b.dataset.talent.split(':');
      if (Meta.takeTalent(parts[0], parts[1])) { Sound.play('tech'); after(); }
      else Sound.play('denied');
    }));
    $$('[data-clear-talent]', wrap).forEach(b => b.addEventListener('click', () => {
      Meta.clearTalents(b.dataset.clearTalent); Sound.play('sell'); after();
    }));
  },


  /**
   * THE TOWERS COLUMN, plus everything the screen shares.
   *
   * The grid is the picker only. Statistics, description, the firing preview
   * and the talent tree all moved to the detail column beside it, which is
   * what lets the two pickers hold one card shape and one fixed row height --
   * the thing that makes them read as a pair rather than as two lists that
   * happen to be adjacent.
   */
  renderLoadout() {
    /* Both grids and both panels are about to be replaced wholesale, so a
       preview drawing into a canvas any of them owns is holding a node that
       will not exist a line from now. */
    this.stopTowerPreview();
    this._loPreviewOn = false;
    /* A stale selection (another profile, an earlier campaign, a tower no
       longer owned) must never wedge the deploy button. */
    this.sel.loadout = this.sel.loadout.filter(id => Meta.isTowerUnlocked(id));
    const sel = this.sel.loadout;
    /* Only what you actually own. What you can unlock belongs in the Soul
       Shop, which is where souls are spent. */
    const owned = TOWER_ORDER.filter(id => Meta.isTowerUnlocked(id));
    const lockedCount = TOWER_ORDER.length - owned.length;
    /* Grouped by TECH ORIGIN so 39 towers read as five arsenals instead of
       one list -- the same shape the units column uses for allegiance. */
    const byOrigin = {};
    for (const id of owned) {
      const oid = originOf(id).id;
      (byOrigin[oid] = byOrigin[oid] || []).push(id);
    }
    const grid = $('#loadout-grid');
    /* The row height reaches the CSS from here, so the height the grid
       reserves and the height the card is pinned to are one number. (The word
       for a linked .css file is banned in these sources: build.js aborts the
       bundle if it survives into the output.) */
    grid.style.setProperty('--lo-rest-h', LO_CARD_REST_H + 'px');
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
    /* A control that OPENS the overlay cannot go stale the way copy naming a
       screen did, and the grid redraws so a purchase appears immediately. */
    const loSouls = $('#btn-loadout-souls');
    if (loSouls) loSouls.addEventListener('click', () => this.openSoulShop(() => this.renderLoadout()));

    /* The detail column must survive a re-render pointed at something that
       still exists, and a column pointed at nothing explains the first thing
       a player would read anyway. */
    const f = this.loFocus();
    if (owned.indexOf(f.tower) < 0) f.tower = sel[0] || owned[0] || null;

    this.bindPickerCards(grid, 'tower');

    const target = this.loadoutTarget();
    const count = $('#loadout-count');
    count.textContent = `${sel.length} / ${target}`;
    count.className = sel.length === target ? 'lo-col-n ready' : 'lo-col-n';
    const strip = $('#tower-chosen');
    if (strip) {
      strip.innerHTML = this.chosenStripHTML('tower', sel, target);
      this.bindChosenStrip(strip);
    }
    /* B3: A DISABLED BUTTON THAT SAYS NOTHING READS AS A BROKEN BUTTON. A
       first-run profile owns one tower, so loadoutTarget() is 1 -- yet the
       header printed a flat "five" and DEPLOY greyed out with no word, so a
       new commander concluded the game was broken rather than that picking
       was required. The label carries the shortfall, the title carries the
       rule, and the header now prints the number the gate actually uses.
       .btn:disabled sets only opacity and cursor -- never pointer-events --
       so the browser still paints the title on the dead button, which is the
       one moment a player goes looking for it. The disabled test is the
       original expression untouched: this adds words, never a new gate. */
    const need = target - sel.length;
    const dep = $('#btn-deploy');
    dep.disabled = need !== 0;
    dep.textContent = need === 0 ? 'DEPLOY' : `SELECT ${need} MORE TOWER${need === 1 ? '' : 'S'}`;
    dep.title = need === 0
      ? ''
      : `This campaign fields ${target} tower${target === 1 ? '' : 's'}. ${need} slot${need === 1 ? '' : 's'} still empty — pick from the ARSENAL column.`;
    const tag = $('#loadout-tagline');
    if (tag) tag.innerHTML = `You may take <b>${target}</b> tower${target === 1 ? '' : 's'} into battle. Everything else stays home.`;

    const unlockedCount = Meta.unlockedTowers().length;
    $('#loadout-unlocked').innerHTML =
      `<span class="chip" data-tt="ARSENAL|You have unlocked ${unlockedCount} of ${TOWER_ORDER.length} towers. Unlock more with souls in the SOUL SHOP — the button below the grid opens it, and the commander screen carries the same one.">▲ ${unlockedCount}/${TOWER_ORDER.length} unlocked</span>` +
      `<span class="chip" data-tt="SOULS|Souls buy three things in the SOUL SHOP: recruit a commander, unlock a commander's second ability, and add a tower to your arsenal. Tower mastery is earned in battle, never bought.">◉ ${Meta.souls()}</span>`;
    this.bindChipTips($('#loadout-unlocked'));

    this.renderTowerDetail();
    this.renderUnits();

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

    /* Coverage warnings are only meaningful once something is selected -- but
       the DEPLOY gate is meaningful from the first frame, and this bar is the
       screen's ONE place for "what is wrong with this loadout". The gate
       sentence lands here rather than in a second hint element under the
       button: two surfaces stating the same rule drift apart the first time
       either is edited, and the button label is already the short form of
       this sentence. The count is loadoutTarget(), never a literal five --
       printing five to a profile that can field one was the whole of B3. */
    const gate = need === 0 ? ''
      : `<div class="lo-hint"><b>${need} more tower${need === 1 ? '' : 's'} to pick.</b> DEPLOY opens when ${target === 1 ? 'the slot is' : `all ${target} slots are`} filled — the rival fields a full arsenal whether or not you do.</div>`;
    $('#loadout-warn').innerHTML = gate + (!sel.length
      ? '<div class="lo-hint">Coverage warnings appear as you build the set.</div>'
      : (warn.length
          ? warn.map(w => `<div class="lo-warn">⚠ ${w}</div>`).join('')
          : '<div class="lo-ok">✓ This loadout covers air, armour and magic immunity.</div>')
        + (pairs.length
            ? `<div class="lo-combos"><b>REACTIONS AVAILABLE</b>${pairs.map(c =>
                 `<span class="chip" data-tt="${c.name}|${c.desc}">${c.name}</span>`).join('')}</div>`
            : (els.some(e => ELEMENTS[e].marks)
                ? '<div class="lo-hint">No elemental reactions — these towers share elements, or their partners are missing. Overlap two DIFFERENT marking elements on the same stretch of lane to trigger one.</div>'
                : '<div class="lo-hint">Nothing here marks. Kinetic and Radiant deal straight damage and never trigger reactions.</div>')));
    /* THE OTHER HALF OF THE DEPLOY GATE, SAID EARLY. UI.deploy already banners
       NO GROUND FITS A 2×2 EMPLACEMENT when Game.canFitFoot(0, 2) fails, but
       that fires AFTER the transition, on a map already committed to, with a
       loadout slot spent on a tower that cannot be placed. FIELD is not built
       on this screen, so the honest pre-flight is the caveat rather than the
       verdict -- and stating it here makes that battle banner a confirmation
       of something already read instead of a second, surprising voice. */
    if (sel.some(id => towerFoot(TOWER_TYPES[id]) > 1))
      $('#loadout-warn').insertAdjacentHTML('beforeend',
        '<div class="lo-hint">This set carries a 2×2 heavy emplacement. Not every map has four free tiles together — you are told on arrival if this one does not, and the rest of the loadout still fights.</div>');
    this.bindChipTips($('#loadout-warn'));

    this.bindLoadoutColumns();
  },

  /** One-time listeners for the four-column frame, then a layout reconcile.
      Bound on the container rather than per card, so a re-render of either
      grid cannot multiply them. */
  bindLoadoutColumns() {
    const cols = $('#lo-columns');
    if (!cols) return;
    if (!cols._loBound) {
      cols._loBound = true;
      cols.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && this._loDrawer) { ev.stopPropagation(); this.closeLoadoutDrawer(); }
      });
      /* The scrim is this element's own ::after, so a click that lands on the
         scrim reports the container as its target and nothing else does. */
      cols.addEventListener('click', ev => {
        if (ev.target === cols && this._loDrawer) this.closeLoadoutDrawer();
      });
      $$('.lo-detail-open', cols).forEach(b => b.addEventListener('click', () => {
        Sound.play('click'); this.openLoadoutDrawer(b.dataset.opens);
      }));
      window.addEventListener('resize', () => {
        const scr = $('#screen-loadout');
        if (scr && !scr.classList.contains('hidden')) this.syncLoadoutLayout();
      });
    }
    this.syncDetailOpeners();
    this.syncLoadoutLayout();
  },

  /**
   * THE UNITS COLUMN -- your detachment, picked exactly the way towers are.
   *
   * Same card, same slot height, same grid rule, same binder: this IS the
   * towers column with a different roster in it, which is why it cannot
   * quietly become a different component. Grouped by ALLEGIANCE the way the
   * towers column groups by tech origin, so both columns read as families of
   * things rather than as one list and one table.
   *
   * Every number printed here comes from unitTier -- musterTierFor -- which
   * is the same derivation the muster bar, the spawn and the rival brain use.
   */
  renderUnits() {
    const grid = $('#unit-grid');
    if (!grid) return;
    const unlocked = this.unitUnlocked();
    const rescuable = this.unitRescuable();
    const gated = this.unitGated();
    const picked = this.unitPicked();
    const cap = Math.min(this.unitCap(), Math.max(1, unlocked.length));
    const byHp = (a, b) => (this.unitDef(a).hp - this.unitDef(b).hp);
    unlocked.sort(byHp); rescuable.sort(byHp);

    const groups = {};
    for (const id of unlocked.concat(rescuable)) {
      const k = this.unitHost(id).id;
      (groups[k] = groups[k] || []).push(id);
    }
    /* Fixed order, machines first: the day-one unlock is a machine, and an
       order that shuffled with your faction would move the card under the
       cursor between visits. */
    /* POWER_ORDER, not FACTION_ORDER -- this grid asks "who has troops", which
       is the question POWER_ORDER exists to answer. FACTION_ORDER deliberately
       omits the Parallel (it holds no worlds and seats no bosses), so grouping
       by it silently discarded all five machine soldiers: `unitHost` returns
       the 'robot' key and `order.filter(k => groups[k])` threw the group away.
       The consequence ran the authored fantasy backwards -- the RIVAL draws
       from the same install-wide vault and could field them, so your board got
       spliced and you could never splice back -- and it stranded RELAY, THE
       SPLICE, 24 authored talents and both fields UNIT_FIELD_IDENTITY was
       extended for. */
    const order = [MACHINE_HOST.id].concat(
      typeof POWER_ORDER !== 'undefined' ? POWER_ORDER
        : (typeof FACTION_ORDER !== 'undefined' ? FACTION_ORDER : []));
    grid.style.setProperty('--lo-rest-h', LO_CARD_REST_H + 'px');
    grid.innerHTML = order.filter(k => groups[k]).map(k => {
      const h = this.unitHost(groups[k][0]);
      const n = groups[k].length;
      return `<div class="lo-family" style="--og:${h.color}">
          <span class="lo-fam-mark">${h.icon}</span><b>${h.name}</b>
          <span class="lo-fam-rule">${k === MACHINE_HOST.id ? 'NEUTRAL MACHINES' : 'SOLDIERS OF THIS POWER'}</span>
          <span class="lo-fam-n">${n} ${n === 1 ? 'unit' : 'units'}</span>
        </div>` + groups[k].map(id =>
          this.unitCardHTML(id, picked, unlocked.indexOf(id) >= 0)).join('');
    }).join('') + (gated.length
      ? `<div class="lo-locked-note">
           <b>${gated.length} ${gated.length === 1 ? 'unit belongs' : 'units belong'} to other powers</b>
           <p>A campaign rescues only its own power&rsquo;s soldiers and neutral machines.
              A unit bought outright with souls is install-wide &mdash; any commander may field it.</p>
           <button class="btn" id="btn-units-souls">&#9673; SOUL SHOP</button>
         </div>`
      : '');
    this.paintUnitIcons(grid);
    const unSouls = $('#btn-units-souls');
    if (unSouls) unSouls.addEventListener('click', () => this.openSoulShop(() => this.renderLoadout()));

    const f = this.loFocus();
    const all = unlocked.concat(rescuable);
    if (all.indexOf(f.unit) < 0) f.unit = picked[0] || unlocked[0] || all[0] || null;

    this.bindPickerCards(grid, 'unit');

    const count = $('#unit-count');
    if (count) {
      count.textContent = `${picked.length} / ${cap}`;
      count.className = picked.length === cap ? 'lo-col-n ready' : 'lo-col-n';
    }
    const strip = $('#unit-chosen');
    if (strip) {
      strip.innerHTML = this.chosenStripHTML('unit', picked, cap);
      this.bindChosenStrip(strip);
    }
    this.renderUnitDetail();
  },

  /* The old name. UI.renderLoadout and the screen teardown both reached for
     it, and a detachment IS the muster loadout -- one renderer, two names, so
     nothing has to be renamed in a file this patch does not own. */
  renderMusterLoadout() { this.renderUnits(); },

  /**
   * One unit card. Deliberately the SAME element tree as loadoutCardHTML --
   * .lo-slot > .lo-card > .lo-rest > (.lo-figure + .lo-id) -- so the two
   * pickers are styled by one rule and cannot be pulled apart by a later
   * edit to either one.
   */
  unitCardHTML(id, picked, owned) {
    const def = this.unitDef(id);
    const h = this.unitHost(id);
    const tier = this.unitTier(id);
    const idx = picked.indexOf(id);
    const homes = this.unitHomes(id);
    return `<div class="lo-slot" data-uslot="${id}">
      <button class="lo-card ${idx >= 0 ? 'on' : ''} ${owned ? '' : 'locked'}" data-unit="${id}"
              style="--tc:${def.color}; --cc:${h.color}"
              aria-pressed="${idx >= 0 ? 'true' : 'false'}"${owned ? '' : ' aria-disabled="true"'}>
        <span class="lo-rest">
          <span class="lo-figure">${this.unitIconHTML(id, 40)}${
            idx >= 0 ? `<span class="lo-num">${idx + 1}</span>` : ''}</span>
          <span class="lo-id">
            <span class="lo-top"><b>${def.name}</b></span>
            <span class="lo-meta"><span class="lo-og" style="--og:${h.color}">${
              h.icon} ${h.short || h.name}</span><em>${owned
                ? (tier ? `<i class="lo-el" style="--el:${def.color}">${tier.icon}</i>×${tier.count}` : '')
                : '✦ ' + (homes ? homes.split(' or ')[0] : 'unclaimed')}</em></span>
          </span>
        </span>
      </button>
    </div>`;
  },

  /**
   * The FOCUSED tower's tree, inside the detail column.
   *
   * Scoped to one tower now that there is a column to put it in: five stacked
   * trees was the old screen's answer to having nowhere else for them, and it
   * buried the tower a player was actually reading under four they were not.
   * The grid itself is talentGridHTML, shared with units.
   */
  renderTowerTalents() {
    const wrap = $('#tower-talents');
    if (!wrap) return;
    const id = this.loFocus().tower;
    const def = id && TOWER_TYPES[id];
    if (!def) { wrap.innerHTML = '<p class="hint">Select a tower to prepare its talents.</p>'; return; }
    wrap.innerHTML = this.talentTreeHTML(id, def);
    /* Only the tree redraws: towerStatRows reads `t.base`, which no talent
       moves, so nothing else on the panel can fall out of step -- and not
       redrawing the panel is what keeps the firing preview from restarting
       under the cursor on every point spent. */
    this.bindTalents(wrap, () => this.renderTowerTalents());
  },

  /** The unit tree. Unlike a tower's, a point here moves numbers printed
      above it, so the whole column redraws. */
  renderUnitTalents() {
    const wrap = $('#unit-talents');
    if (!wrap) return;
    const id = this.loFocus().unit;
    const def = id && this.unitDef(id);
    if (!def) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = this.talentTreeHTML(id, def);
    this.bindTalents(wrap, () => this.renderUnits());
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
      return `<button class="tower-card" data-tower="${id}" style="--tc:${t.color}; --cc:${originOf(id).color}"
        aria-label="Build ${t.name}, ${t.role.toLowerCase()}, ${Game.towerLifeCost(0, id)
          ? Game.towerLifeCost(0, id) + ' lives' : t.cost + ' gold'}, hotkey ${keys[i]}"
        aria-keyshortcuts="${keys[i]}">
        <span class="tc-key" aria-hidden="true">${keys[i]}</span>
        <span class="tc-mini" aria-hidden="true">${this.towerIconHTML(id, 30)}</span>
        <span class="tc-main">
          <span class="tc-name">${t.name}<i class="tc-og" aria-hidden="true" style="--og:${
            originOf(id).color}" title="${originOf(id).name} — ${originOf(id).rule}">${
            originOf(id).icon}</i></span>
          <span class="tc-role">${t.role}</span>
        </span>
        <span class="tc-cost" data-cost="${id}" aria-hidden="true">${Game.towerLifeCost(0, id)
          ? '♥' + Game.towerLifeCost(0, id) : '◈' + t.cost}</span>
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
    /* THE PRICE IN ITS OWN CURRENCY. BLOOD PRICE takes no gold at all, so
       Game.towerCost truthfully returns 0 and a ◈0 here reads as FREE -- the
       one thing this purchase is not. towerLifeCost is the only statement of
       what it costs, and the radial already quotes it that way. */
    const life = Game.towerLifeCost(0, id);
    rows.push(['Owned', owned + ' — next costs ' + (life ? '♥' + life : '◈' + Game.towerCost(0, id))]);
    const el = ELEMENTS[t.element];
    return `<div class="tt-head" style="color:${t.color}">${t.name}<span class="tt-cost">${
        life ? '♥' + life : '◈' + Game.towerCost(0, id)}</span></div>
      <div class="tt-figure">${this.towerIconHTML(id, 54)}
        <span class="elem-badge" style="--el:${el.color}">${el.icon} ${el.name}</span>
        ${this.originBadge(id)}</div>
      <div class="tt-role">${t.role}</div>
      <div class="tt-origin" style="--og:${originOf(id).color}"><b>${originOf(id).rule}</b> — ${originOf(id).desc}</div>
      <p class="tt-desc">${t.desc}</p>
      <div class="tt-stats">${rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
      ${t.groundOnly ? '<div class="tt-warn">⚠ Cannot target flying enemies</div>' : ''}
      ${t.airOnly ? '<div class="tt-warn">⚠ Can ONLY target flying enemies</div>' : ''}
      <div class="tt-foot">${life
        ? `The life price rises <b>×${BLOOD_PRICE_GROWTH.toFixed(2)}</b> with each copy you own, and never below ♥${BLOOD_PRICE_FLOOR} left.`
        : `Price rises <b>×${appliedGrowth(t, Game.sides[0].traits.costGrowthMul).toFixed(2)}</b> with each copy you own.`}</div>`;
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
    /* THE SIX. Every one of these reads a field the ENGINE writes, through
       SixRead in entities.js, which is also what the tick reads -- so there
       is no second copy of a ceiling or a cap anywhere in this file. A row
       that is not on the panel returns null and the refresher skips it. */
    wards:  t => (t && t.def.attack === 'sepulchre')
                 ? (t.wards || []).length + ' / ' + SixRead.wardCap(t) : null,
    wardDps: t => (t && t.def.attack === 'sepulchre')
                 ? formatNum(Math.round(SixRead.wardOutput(t))) + '/s' : null,
    holding: t => {
      if (!t || t.def.attack !== 'sepulchre') return null;
      const w = t.wards || [];
      return w.length ? w.map(x => x.name).join(', ')
                      : 'nothing — it catches the next tower you give up';
    },
    offering: t => {
      if (!t || t.def.attack !== 'orison') return null;
      const e = t.offering;
      if (!e) return t.orisonNamed ? 'settled — one rite a wave' : 'nothing named yet';
      return e.def.name + ' — ' + formatNum(Math.max(0, Math.round(e.hp)))
             + ' / ' + formatNum(Math.round(e.maxHp));
    },
    answers: t => (t && t.def.attack === 'antiphon')
                 ? Math.floor(t.answers || 0) + ' / ' + SixRead.answerCap(t) : null,
    gestalt: t => (t && t.def.attack === 'gestalt')
                 ? Math.round(t.gestaltStacks || 0) + ' / ' + SixRead.gestaltCap(t) : null,
    forget: t => {
      if (!t || t.def.attack !== 'gestalt') return null;
      const s = SixRead.gestaltForget(t);
      return s === null ? 'nothing to forget' : s.toFixed(1) + 's without a body';
    },
    mawNext: t => (t && t.def.attack === 'maw')
                 ? SixRead.mawNext(t).toFixed(1) + 's' : null,
    digest: t => {
      if (!t || t.def.attack !== 'maw') return null;
      const owed = SixRead.mawOwed(t);
      return owed > 0 ? '◈' + formatNum(Math.ceil(owed)) + ' of ◈'
                        + formatNum(Math.round(t.digestTotal || 0))
                        + ' over ' + SixRead.mawDigestDur(t).toFixed(1) + 's'
                      : 'nothing in the gullet';
    },
    debt:   t => {
      if (!t || t.def.attack !== 'veil') return null;
      const r = SixRead.veilDebt(t);
      return r.bodies ? formatNum(Math.round(r.debt)) + ' across ' + r.bodies
                        + (r.bodies === 1 ? ' body' : ' bodies')
                      : 'nothing owed in the field';
    },
    tithe:  t => (t && t.def.attack === 'veil' && t.stats.veilTithe)
                 ? Math.round(t.titheAcc || 0) + '/' + VEIL_TITHE_PER : null,
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
            /* THE SIX. Each of these changes which ROWS exist or what a row
               that no in-place refresh can create says, so the panel has to
               rebuild on it. Bucketed to whole units -- none of them moves
               more than a few times a wave. */
            (t.wards || []).length, t.offering ? t.offering.def.id : '-',
            Math.floor(t.answers || 0), Math.round(t.gestaltStacks || 0),
            (t.digestLeft || 0) > 0 ? 'dg' : '-',
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
    const buffed = t.aura.dmg > 0 || t.aura.rate > 0 || t.aura.range > 0
                || t.focusDmgAmt > 0 || t.focusRateAmt > 0 || t.focusRangeAmt > 0;

    if (t.def.attack === 'economy') {
      rows.push(['Income', '◈' + Math.round((s.income || 0) * t.ascDamage * (t.traits.vaultBonus || 1)) + '/' + s.incomeEvery + 's', 1]);
      rows.push(['Kill skim', '◈' + Math.round((s.killCut || 0) * t.ascDamage * (t.traits.vaultBonus || 1)), 1]);
      rows.push(['Earned', this.liveFigure('earned', t), 1, 'earned']);
    } else if (t.def.attack === 'depot') {
      /* A depot mints nothing, so an Income row would be a lie by omission of
         zero. It sells the discount and the lump, and the discount is printed
         through the SAME ceiling Tower.upgradeCost applies -- a panel quoting
         the authored figure past REQUISITION_MAX is precisely the desync this
         file's header exists to prevent. */
      rows.push(['Requisition', '−' + Math.round(Math.min(REQUISITION_MAX, s.requisition || 0) * 100) + '% on upgrades in range', 1]);
      rows.push(['Per wave', '◈' + Math.round((s.waveBonus || 0) * t.ascDamage), 1]);
      rows.push(['Earned', this.liveFigure('earned', t), 1, 'earned']);
    } else if (t.def.attack === 'vigil') {
      rows.push(['Wardens', (t.vigilLeft === undefined ? Math.round(s.vigilHold || 0) : t.vigilLeft)
                            + ' / ' + Math.round(s.vigilHold || 0), 1]);
      rows.push(['Relief', (s.vigilEvery || 10).toFixed(1) + 's per warden']);
      rows.push(['Breaches stopped', t.livesRestored || 0, 1]);
      if (s.vigilGold) rows.push(['Tithe', '◈' + s.vigilGold + ' per warden']);
    } else if (t.def.attack === 'aura') {
      /* BEACON lights ONE tower; PYLON runs a flat field. Both arrive here,
         and printing an aura figure for a Beacon that no longer carries one
         would read as +NaN%. */
      if (s.focusDmg) {
        rows.push(['Lends damage', '+' + Math.round(s.focusDmg * t.ascDamage * 100) + '%', 1]);
        rows.push(['Lends rate', '+' + Math.round((s.focusRate || 0) * 100) + '%', 1]);
        if (s.focusRange) rows.push(['Lends range', '+' + Math.round(s.focusRange * 100) + '%', 1]);
        rows.push(['Relights', (s.focusEvery || 3).toFixed(1) + 's'
                             + (Math.round(s.focusCount || 1) > 1 ? ' — ' + Math.round(s.focusCount) + ' towers' : '')]);
        rows.push(['Lit now', (t.lit && t.lit.length) ? t.lit.map(x => x.def.name).join(', ') : 'nothing in range', 1]);
      } else {
        rows.push(['Damage aura', '+' + Math.round((s.auraDmg || 0) * 100) + '%', 1]);
        rows.push(['Rate aura', '+' + Math.round((s.auraRate || 0) * 100) + '%', 1]);
        if (s.auraRange) rows.push(['Range aura', '+' + Math.round(s.auraRange * 100) + '%', 1]);
      }
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
    } else if (t.def.attack === 'sepulchre') {
      /* A chapel over empty ground is worth nothing and a chapel over a line
         you are about to sell is transformative, so the ward count IS the
         tower. Falling through to the generic DPS block printed one number
         that answered neither question. */
      rows.push(['Wards standing', this.liveFigure('wards', t), 1, 'wards']);
      rows.push(['Wards dealing', this.liveFigure('wardDps', t), 1, 'wardDps']);
      rows.push(['Holding', this.liveFigure('holding', t), (t.wards || []).length, 'holding']);
      rows.push(['Keeps', Math.round(SixRead.wardShare(t) * 100) + '% of what the tower was', 1]);
      rows.push(['Each ward stands', (s.sepulchreDur || 16).toFixed(1) + 's, or until the wave turns']);
      if (s.sepulchreGold) rows.push(['Grave goods', '◈' + s.sepulchreGold + ' per ward raised']);
    } else if (t.def.attack === 'orison') {
      rows.push(['Offering', this.liveFigure('offering', t), 1, 'offering']);
      rows.push(['Lends damage', '+' + Math.round((s.offeringDmg || 0) * 100)
                               + '% to every tower you own', 1]);
      if (s.offeringRate) rows.push(['Lends rate', '+' + Math.round(s.offeringRate * 100) + '%', 1]);
      const lives = SixRead.offeringLives(t);
      rows.push(['Pays', lives + (lives === 1 ? ' life' : ' lives')
                       + ' when the offering is killed', 1]);
      if (s.offeringGold) rows.push(['Alms', '◈' + s.offeringGold + ' as well']);
      if (s.offeringGuard) rows.push(['Sanctified',
        'the offering takes ' + Math.round(s.offeringGuard * 100) + '% less, so it lasts']);
      rows.push(['Names', 'one creature a wave, ' + ORISON_NAMING_DELAY.toFixed(0)
                        + 's after it starts arriving']);
      rows.push(['Lapses', 'if it leaks, is charmed or is swallowed — nothing is owed']);
    } else if (t.def.attack === 'maw') {
      rows.push(['Opens in', this.liveFigure('mawNext', t), 1, 'mawNext']);
      rows.push(['Then every', (s.mawCd || 18).toFixed(1) + 's']);
      rows.push(['Digesting', this.liveFigure('digest', t), (t.digestLeft || 0) > 0, 'digest']);
      rows.push(['A meal pays', '×' + SixRead.mawYield(t).toFixed(2) + ' of the bounty', 1]);
      rows.push(['Swallows', s.mawBoss ? 'anything walking, a boss included'
                                       : 'anything but a boss', s.mawBoss ? 1 : 0]);
      rows.push(['Removed, not killed', 'no bounty, no corpse, one fewer on the wave']);
    } else if (t.def.attack === 'veil') {
      rows.push(['Debt in reach', this.liveFigure('debt', t), 1, 'debt']);
      rows.push(['Bills', (s.veilHealTax || 0).toFixed(2) + ' damage per point ever healed', 1]);
      rows.push(['Calls in', Math.round(VEIL_COLLECT_RATE * 100) + '% of a body\'s ledger per second']);
      rows.push(['Ledger cap', VEIL_DEBT_CAP + '× a body\'s own health']);
      if (s.veilSlow) rows.push(['Drags', Math.round(s.veilSlow * t.effStatus * 100)
                                        + '% inside the field']);
      if (s.veilVuln) rows.push(['In arrears', '+' + Math.round(s.veilVuln * 100)
                                             + '% damage while it still owes']);
      if (s.veilTithe) rows.push(['Collections', '◈' + s.veilTithe + ' per ' + VEIL_TITHE_PER
                                               + ' — ' + this.liveFigure('tithe', t), 1, 'tithe']);
    } else {
      rows.push(['DPS', formatNum(t.estimateDps()), 1]);
      if (s.damage) rows.push([['cone', 'beam'].includes(t.def.attack) ? 'Damage/s' : 'Damage', formatNum(t.effDamage), t.aura.dmg > 0 || t.focusDmgAmt > 0]);
      if (s.droneDamage) rows.push(['Drones', formatNum(t.effDamageFor(s.droneDamage)) + ' ×' + s.drones, 1]);
      if (s.rate && !['cone', 'beam'].includes(t.def.attack)) rows.push(['Rate', t.effRate.toFixed(2) + '/s', t.aura.rate > 0 || t.focusRateAmt > 0]);
    }
    /* ANTIPHON and GESTALT are GUNS. They keep the DPS/Damage/Rate block
       above and take their own rows on top of it -- a second copy of that
       block inside a branch of their own is exactly how two figures for one
       thing start to drift. */
    if (t.def.attack === 'antiphon') {
      rows.push(['Answers banked', this.liveFigure('answers', t), 1, 'answers']);
      rows.push(['Per body lost', (s.antiphonPerLoss || 1)
                                + ' — your PAID dead, on rival ground only', 1]);
      rows.push(['Each answer', SixRead.volley(t) + ' shots']);
    }
    if (t.def.attack === 'gestalt') {
      rows.push(['Bodies folded in', this.liveFigure('gestalt', t), 1, 'gestalt']);
      /* Through effDamageFor, because the tick adds the stack to stats.damage
         BEFORE the aura/ascension/commander chain -- which is precisely what
         effDamageFor applies. */
      rows.push(['Each body adds', formatNum(t.effDamageFor((s.gestaltPerKill || 0)
                                   * (s.gestaltPerKillMul || 1)))
                                 + ' damage, ' + (s.gestaltRange || 0).toFixed(3) + ' tiles', 1]);
      rows.push(['Forgets the lot', this.liveFigure('forget', t),
                 (t.gestaltStacks || 0) > 0, 'forget']);
    }
    /* ORISON's range is 99 on purpose -- it names one creature out of the
       whole wave and never shoots. Printing "Range 99.00" beside a tower with
       no gun reads as a bug in the number rather than as the rule it is. */
    if (t.def.attack === 'orison') rows.push(['Reach', 'the whole board — it names, it does not shoot']);
    else rows.push(['Range', t.effRange.toFixed(2), t.aura.range > 0 || t.focusRangeAmt > 0]);
    /* MORTAR bills its fire mission as a SEPARATE reach, not as range: the
       tube's own circle is what it can hit unaided, and the extra tiles only
       exist over ground another of your weapons is holding. Printing one
       merged number would promise coverage the engine does not give. */
    if (s.spotting) rows.push(['Spotted reach', (t.effRange + s.spotting).toFixed(2) + ' on a spotter call']);
    if (s.dmgType && s.dmgType !== 'none') rows.push(['Type', s.dmgType]);
    if (t.effSplash) rows.push(['Splash', t.effSplash.toFixed(2)]);
    if (s.chains) rows.push(['Chains', s.chains + '×' + Math.round((s.falloff || .75) * 100) + '%']);
    if (s.runTiles) rows.push(['Runs the lane', '±' + s.runTiles.toFixed(1) + ' tiles at '
                                              + Math.round((s.runFalloff || .85) * 100) + '%/tile']);
    if (s.killReload) rows.push(['Kill refund', Math.round(Math.min(1, s.killReload) * 100) + '% of the reload']);
    if (s.downFor) rows.push(['Grounds for', Math.min(FLAK_DOWNED_CAP, s.downFor * t.effStatus).toFixed(1) + 's']);
    if (s.scrapline) rows.push(['Reclaim', '−' + s.scrapline.toFixed(2) + 's of forge per kill']);
    if (s.overheat) rows.push(['Tank', 'blows after ' + s.overheat.toFixed(1) + 's for '
                                     + formatNum(t.effDamageFor((s.blowDmg || 0) * (s.blowDmgMul || 1)))
                                     + ', then ' + PYRE_VENT_SECONDS.toFixed(1) + 's offline']);
    if (s.digest) {
      /* Printed through digestFrac at the reference wound the estimate uses,
         so the row, the DPS figure and the tick all quote one function. */
      const st = t.effStatus;
      rows.push(['Digest', (digestFrac(s.digest * st, DIGEST_REF_WOUND, false) * 100).toFixed(2)
                         + '% max hp/s at half health']);
    }
    if (s.pull) rows.push(['Pull', (s.pull * t.effStatus).toFixed(1)]);
    if (s.ramp) rows.push(['Ramp', `+${Math.round(s.ramp * 100)}%/s →×${s.rampMax}`]);
    if (s.split) rows.push(['Beams', s.split]);
    if (s.maxMines) rows.push(['Mines', t.mines.length + '/' + s.maxMines]);
    if (s.gravity) rows.push(['Gravity', (s.gravity * t.effStatus).toFixed(1)]);
    if (s.drones) rows.push(['Drones', s.drones]);
    if (s.slow) rows.push(['Slow', Math.round(s.slow * t.effStatus * 100) + '%']);
    if (s.burn) rows.push(['Burn', Math.round(s.burn * t.effStatus) + '/s']);
    if (s.bleed) rows.push(['Bleed', Math.round(s.bleed * t.effStatus) + '/s']);
    if (s.poisonDps) {
      /* TWO different clouds now, and the row has to say which -- CANISTER
         burns a share of MAX health and TOXIN a share of CURRENT health, and a
         player who cannot tell them apart cannot choose between them.
         Both halves are printed through effStatus because that is what the
         engine applies (applyRiders scales every status figure by it); the
         percentage used to be printed raw beside a status-scaled flat figure,
         which is the same quiet desync this file's header exists to prevent.
         The max-health figure comes back through maxHpVenomFrac, so the
         ceiling is visible on the panel the moment it starts biting. */
      const st = t.effStatus;
      const tail = s.poisonMaxPct
        ? (maxHpVenomFrac(s.poisonMaxPct * st, s.maxStacks || 1, false) * 100).toFixed(2) + '% max hp/s'
        : (s.poisonPct * st * 100).toFixed(1) + '%×' + s.maxStacks;
      rows.push([s.poisonMaxPct ? 'Gas' : 'Venom', `${Math.round(s.poisonDps * st)}+${tail}`]);
    }
    /* applyRiders shreds by shredPerStack x the stacks standing, so full
       stacks is the honest headline figure rather than the per-stack one. */
    if (s.shredPerStack) rows.push(['Armour strip', '−' + (s.shredPerStack * (s.maxStacks || 1)) + ' at full stacks']);
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

    /* A depot and a watch have nothing to aim, so a TARGETING row on either
       would offer a choice the engine never reads. */
    const modes = (t.isSupport || !mine || t.def.attack === 'depot' || t.def.attack === 'vigil') ? '' : `
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
      ${t.jammed ? `<div class="warn-flag">⊘ JAMMED — ${t.def.attack === 'null'
        ? 'riders offline, the volume still suppresses' : 'offline'}</div>` : ''}
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
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { Game.setTargetMode(t, b.dataset.mode); this.renderInspector(true); }));
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
      ${Game.seed !== null && Game.seed !== undefined ? `<div class="section-label" data-tt="BATTLE SEED|Same seed + same choices replays this exact match. Set it in OPTIONS.">SEED ${Game.seed}</div>` : ''}
      <div class="section-label">NEXT — WAVE ${next}${p.boss ? '  ⚠ BOSS' : isMini ? '  ◆ MINIBOSS' : ''}${rage ? `  ✦ RESONATING ×${rage}` : ''}</div>
      <div class="wave-name ${p.boss ? 'boss' : isMini ? 'mini' : ''} ${rage ? 'enraged' : ''}">${p.name}</div>
      <div class="roster">${list}</div>
      ${this.enragePanel(Game.waveRunning ? spent : rage)}
      <div class="hint-block">
        <div class="section-label">ATTRITION</div>
        <p class="hint">Waves spawn in the <b>neutral zone</b> and hit every base identically. What your kills become is your commander's rite — a body sent can never be sent again.</p>
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
       every figure in this bar without touching the purse. The doctrine's own
       live state joins it, coarsened to whole seconds -- the key is a RENDER
       BUDGET, and anything that moves faster than a second belongs to CSS,
       not to a re-render at 8Hz. */
    const key = [Game.wave, S.gold, S.musterBuys || 0, left,
                 Game.waveRunning ? 1 : 0, S.mods.gold,
                 S.baseLevel || 1, this.engineKey(S)].join(':');
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
    const capPct = Game.musterCapPct(0);
    const uncapped = !isFinite(capPct);
    const pct = Math.min(S.musterIncome || 0, capPct);
    const capped = !uncapped && (S.musterIncome || 0) >= capPct;
    const vic = Game.musterVictims(0)[0];
    const doc = Game.doctrineOf(0);
    /* 19.16 is already inside the health figure above, because that figure
       comes from Game.musterHpMul. It is SAID here as well so the number is
       explicable rather than merely correct -- and it is read from the same
       function the spawn reads, never re-derived. */
    const earlyPen = Math.round((1 - spawnHpPenaltyMul(Math.max(1, Game.wave))) * 100);
    const earlyTxt = earlyPen > 0
      ? ', and a summoned body is ' + earlyPen + '% lighter again this early — that fades to nothing by wave '
        + SPAWN_HP_PENALTY_END
      : '';
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
      /* THE THREE FIGURES the owner asked for, in one fixed order: what it
         COSTS, the POWER it puts in the lane, and the ECON it adds forever.
         `powDelivered` is the same total the rival's brain scores as
         `delivered` -- summed from the very health figures above, never
         re-derived, so the button and the engine cannot disagree. Band name,
         health range and the per-wave gold move into the tooltip: three
         numbers is what a glance can hold. */
      const powDelivered = hps.reduce((a, b) => a + b, 0) * tier.count;
      return `<button class="muster-btn ${ok ? '' : 'poor'}" data-muster="${tier.id}"${ok ? '' : ' disabled'}
        aria-label="Summon ${tier.name}: ${sent} ${base.name} for ${cost} gold, ${powDelivered} power, econ plus ${addPct} percent"
        data-tt="SUMMON — ${tier.name}|◈${formatNum(cost)} marches ${sent} × ${base.name} at ${hpTxt} health each — ${
          formatNum(powDelivered)} POWER into the lane${vics.length > 1 ? ', split across ' + vics.length + ' rivals' : ''} — and adds ${
          addPct}% of every wave reward to your ECON for the rest of the battle, worth ◈${
          formatNum(gain)} next wave. Every buy also hardens what you send by +${
          Math.round(doc.powerPerBuy * 100)}%${uncapped ? ' — with no ceiling, by the MARQUE' : ''}. Summoned bodies arrive at ${
          Math.round(MUSTER_DAMP * 100)}% and never rise again${earlyTxt}. ${
          uncapped ? 'Your ECON has no ceiling.' : 'ECON is flat additive, capped at +' + Math.round(capPct * 100) + '%.'}">
        <span class="mu-ic">${tier.icon}</span>
        <span class="mu-body"><b>${sent}× ${base.name.toUpperCase()}</b>
          <em class="mu-figs"><span class="mu-cost">◈${formatNum(cost)}</span>
            <span class="mu-pow">+${formatNum(powDelivered)} PWR</span>
            <span class="mu-eco">+${addPct}% ECON</span></em></span>
      </button>`;
    }).join('');

    bar.innerHTML = `${this.engineStripHtml(S, doc)}<div class="muster-head" data-tt="ECON|Every commander earns the BASE wave reward. Summons stack a flat percent of it on top, every wave, for the rest of the battle — so aggression and economy stop being opposite choices.${
        uncapped ? ' Under LETTERS OF MARQUE that percent has NO ceiling; what prices it instead is a summon cost that never stops climbing.' : ''} Pick your roster on the loadout screen; conquer worlds to save more denizens for it.">
        <span>BASE</span><b>+◈${formatNum(baseIncome)}/wave</b>
        <span class="mu-sep">ECON</span><b class="${capped ? 'capped' : ''}${uncapped ? ' uncapped' : ''}">+${Math.round((uncapped ? (S.musterIncome || 0) : pct) * 100)}%</b>
        <span class="mu-sep mu-powchip" tabindex="0" data-power="1">POWER</span><b>×${Game.powerOf(0).toFixed(2)}</b>
        <em>${doc.noPurchase && !Game.noReanim ? 'NO TRADE'
              : uncapped ? 'NO CAP' : capped ? 'AT CAP' : left + ' left'}</em>
      </div>${doc.noPurchase && !Game.noReanim ? this.latticePlateHtml(S) : rows}`;
    this.bindChipTips(bar);
    /* The POWER chip opens the ledger the owner asked for -- every attribute
       that feeds this number, quoted at the value the spawn will read. Bound
       directly rather than through data-tt because the body is built HTML. */
    const chip = bar.querySelector('[data-power]');
    if (chip) {
      const show = ev => this.showTooltip(ev, this.powerLedgerHtml(0));
      chip.addEventListener('mouseenter', show);
      chip.addEventListener('mousemove', ev => this.moveTooltip(ev));
      chip.addEventListener('focus', ev => show(ev));
      chip.addEventListener('mouseleave', () => this.hideTooltip());
      chip.addEventListener('blur', () => this.hideTooltip());
    }
  },

  /** Render-budget token: whatever about a rite's live state deserves a
      re-render, coarsened so nothing sub-second churns the DOM at 8Hz. */
  engineKey(S) {
    const d = Game.doctrineOf(S.index);
    if (d.scheduler) return d.id + S.procCycle + '.' + S.procIdx + '.' + Math.ceil(S.procTimer || 0);
    if (d.onKill === 'incubate') {
      let n = 0, soon = Infinity;
      for (const p of Game.incubators) if (p.side === S.index) { n++; if (p.t < soon) soon = p.t; }
      return d.id + n + '.' + (isFinite(soon) ? Math.ceil(soon) : 0);
    }
    if (d.onKill === 'roll' || d.onKill === 'clone')
      return d.id + (S.stats.sent - S.stats.mustered);
    return d.id + Math.round((S.musterIncome || 0) * 100);
  },

  /** The rite, named and live, above its own controls. */
  engineStripHtml(S, doc) {
    const f = FACTIONS[S.faction] || { color: '#94a3b8' };
    const vics = Game.musterVictims(S.index).length;
    /* `sent - mustered` IS the free-body count: Game.muster is the only writer
       of stats.mustered and it books one per unit, so the difference is every
       body a rite granted rather than sold. No new counter. */
    const free = S.stats.sent - S.stats.mustered;
    let state;
    if (Game.noReanim && (doc.scheduler || doc.onKill))
      state = 'ENGINE COLD — THE MAELSTROM PERMITS PAID SUMMONS ONLY';
    else if (doc.scheduler) {
      const list = S.musterLoadout || [];
      const nxt = ENEMY_TYPES[list[S.procIdx % Math.max(1, list.length)]];
      /* Before the march begins the clock is meaningless -- say when it
         starts instead of counting down to nothing. */
      state = Game.wave < FOL_START_WAVE
        ? 'THE MARCH BEGINS ON WAVE ' + FOL_START_WAVE
        : 'NEXT ' + Math.max(0, Math.ceil(S.procTimer || 0)) + 's' +
          (nxt ? ' · ' + nxt.name.toUpperCase() + ' ×' + Math.min(1 + S.procCycle, FOL_CYCLE_COUNT_CAP) : '') +
          ' · CYCLE ' + (S.procCycle + 1);
    } else if (doc.onKill === 'incubate') {
      let n = 0, soon = Infinity;
      for (const p of Game.incubators) if (p.side === S.index) { n++; if (p.t < soon) soon = p.t; }
      state = 'CLUTCHES ' + n + '/' + XENO_INC_CAP + (n ? ' · NEXT ' + Math.max(0, Math.ceil(soon)) + 's' : '');
    } else if (doc.onKill === 'roll') state = 'EVERY KILL DRAFTS · ' + free + ' RAISED';
    else if (doc.onKill === 'clone') state = 'EVERY KILL RETURNS AS ITSELF · ' + free + ' REBUILT';
    else if (doc.noPurchase) state = 'THE LATTICE DOES NOT BUY';
    else state = 'NOTHING RISES FREE · NO CEILING';
    return `<div class="engine-strip" style="--fc:${f.color}" data-tt="${doc.name}|${doc.desc}">
      <b>${doc.name}</b><em>${state}</em>${vics > 1 ? `<span class="eng-lanes">×${vics} LANES</span>` : ''}
    </div>`;
  },

  /** THE LATTICE has no controls to draw, and says so rather than showing an
      empty rail the player would read as a bug. */
  latticePlateHtml() {
    return `<div class="lattice-plate">
      <b>THE LATTICE DOES NOT SELL.</b>
      <em>Every kill returns as itself. Nothing here is for sale, and nothing needs to be.</em>
    </div>`;
  },

  /**
   * THE POWER LEDGER — every attribute that multiplies what you send, in the
   * order the engine applies them, each quoting the value the spawn will
   * actually read. Pure: it re-derives from live state and captures nothing,
   * because a ledger that estimates is worse than no ledger at all.
   */
  powerLedgerHtml(side) {
    const S = Game.sides[side];
    if (!S) return '';
    const rows = [];
    const add = (label, mul, note) => {
      if (Math.abs(mul - 1) < 0.0005) return;
      rows.push(`<div class="pl-row"><span>${label}</span><b>×${mul.toFixed(2)}</b>${
        note ? `<em>${note}</em>` : ''}</div>`);
    };
    add('STANDING LAW', MUSTER_DAMP, 'every summoned body arrives damped');
    const early = spawnHpPenaltyMul(Math.max(1, Game.wave));
    add('EARLY WAVE', early, 'fades to nothing by wave ' + SPAWN_HP_PENALTY_END);
    add('REANIMATION', S.mods.reanim, 'creed, commander tech, boons and drafts');
    if (S.traits && S.traits.musterHpMul) add('BOONS', S.traits.musterHpMul, 'what you summon arrives heavier');
    add('SUMMONS BOUGHT', 1 + (S.summonPower || 0),
        '+' + Math.round(Game.doctrineOf(side).powerPerBuy * 100) + '% a buy' +
        (isFinite(Game.doctrineOf(side).powerCap) ? '' : ', NO CAP'));
    const vics = Game.musterVictims(side);
    if (vics.length) {
      const r = Math.round((Game.sides[vics[0]].traits.reanimResist || 0) * 100);
      if (r) rows.push(`<div class="pl-row pl-them"><span>RIVAL RESISTANCE</span><b>−${r}%</b><em>their law, not yours</em></div>`);
    }
    return `<b>POWER ×${Game.powerOf(side).toFixed(2)}</b>
      <div class="pl-body">${rows.join('') || '<div class="pl-row"><span>nothing yet</span></div>'}</div>
      <em class="pl-foot">Everything above multiplies the health of every body you send. The rival's own resistance is applied last, per lane.</em>`;
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
    /* Lives IN FLIGHT: stolen by a carrier still walking out, recoverable
       until it crosses the spawn edge. Summed live from entity state by
       seat index -- no stored counter to drift -- so whichever seat is
       viewing, both panels obey the same law. */
    /* Through Game.leakCostOf, the same call the reap charges. This used to
       sum the RAW livesCost, so a Shield Wall commander watched `(3⚑)` walk
       off the board and paid 2 -- the panel asking you to defend a number
       that was not the number. */
    let meFlight = 0, aiFlight = 0;
    for (const en of Game.enemies) {
      if (!en.carrier || en.dead) continue;
      const c = Game.leakCostOf ? Game.leakCostOf(en) : en.livesCost;
      if (en.hostileTo === me.index) meFlight += c;
      else if (en.hostileTo === ai.index) aiFlight += c;
    }
    e.myGold.textContent = formatNum(me.gold);
    e.myLives.textContent = me.lives + (meFlight ? ' (' + meFlight + '⚑)' : '');
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
    e.aiLives.textContent = ai.defeated ? '☠' : ai.lives + (aiFlight ? ' (' + aiFlight + '⚑)' : '');
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
      /* BOTH CURRENCIES, through the same two calls the radial and Game.build
         already use. A card greyed on GOLD for a tower bought with LIVES is a
         refusal the player cannot read, and canAffordBuild is THE test -- a
         greyed option and a refused purchase can never disagree. */
      const life = Game.towerLifeCost(0, type);
      const cost = Game.towerCost(0, type);
      b.classList.toggle('poor', !Game.canAffordBuild(0, type));
      const c = $(`[data-cost="${type}"]`, b);
      if (c) c.textContent = life ? '♥' + life : '◈' + formatNum(cost);
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
  /* B1: the dossier and the pre-battle dialogue OWN the pause state -- each
     sets Game.paused on the way in and clears it in its own close path. The
     backdrop stops the mouse (.overlay is inset:0 at z-index 300), but nothing
     moves FOCUS off the HUD, so a pause button the player clicked a moment
     earlier is still document.activeElement and a Space or Enter meant for the
     modal natively re-fires it -- un-pausing a battle that then ran behind a
     modal nobody had dismissed. That is the desync closeTopOverlay documents
     and fixes for Escape, and which the keyboard path in main.js already
     refuses; only the button was left open. A marker CLASS rather than a list
     of ids, for the reason main.js gives: the next blocking modal that pauses
     is covered by wearing it. Codex, settings, the soul shop and the confirm
     box go unmarked on purpose -- they open over a live battle without owning
     its pause, and the button must keep working under them. The draft,
     escalation and end overlays need no marker either: each parks Game.state
     off 'playing', which the state check already refuses. */
  togglePause() {
    if (Game.state !== 'playing') return;
    if (document.querySelector('.overlay.owns-pause:not(.hidden)')) return;
    Game.paused = !Game.paused;
    Sound.play('click');
    this.syncSpeed();
  },
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
  /* HIDING IS NOT CLOSING. The cards stay bound to Game.takeMod, so a modal left
     standing when a duel voided was still a live control: one click reached the
     engine's own takeMod, set the state back to 'playing', and handed Game.loop
     a dead board to step behind an overlay that had just said nothing was
     recorded — which then paid XP, tower mastery and a recorded run when it
     resolved. Emptying the body is what makes the close a close. */
  hideChoice() { this.el.choiceOv.classList.add('hidden'); this.el.choiceBody.innerHTML = ''; },

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
          ? `LATTICE ${n}/${Math.max(ORIGIN_LATTICE_MAX, t.latticeFillCap || 0)} · +${Math.round(ORIGIN_LATTICE_DAMAGE * n * 100)}% damage · +${
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
      case 'pirate': {
        /* CARRONADE overrides the rider's constants; the card must print the
           gun's own figures or the next UI/engine desync ships right here. */
        const bank = t.stats.heatBank || ORIGIN_PIRATE_HEAT_MAX;
        const mult = Math.min(OVERLOAD_MULT_MAX, t.stats.overloadMult || ORIGIN_PIRATE_MULT);
        return `OVERLOAD ${t.heat || 0}/${bank} — ${
          Math.round(ORIGIN_PIRATE_PROC * 100)}% for ×${mult.toFixed(2)}, then a jam`;
      }
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
    /* The mark in the corner has to say what THIS profile would actually pay.
       A flat constant was printed here while the shop charged a surcharged
       price, and a machine has no price at all -- it is issued. */
    const story = Meta.towerStoryLock(id);
    const mark = Meta.isTowerUnlocked(id) ? 'IN ARSENAL'
               : story ? '✦ ' + story.systems + ' MORE SYSTEM' + (story.systems === 1 ? '' : 'S')
               : '◉ ' + Meta.towerUnlockCost();
    this.showTooltip(ev, `
      <div class="tp">
        <div class="tt-head" style="color:${t.color}">${t.name}
          <span class="tt-cost">${mark}</span></div>
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

  /**
   * Cancel the loop WITHOUT touching the tooltip.
   *
   * These were one function, and runTowerPreview opened with it -- so
   * showTowerPreview un-hid the tooltip, built the canvas, and then the first
   * line of the loop it started hid the tooltip again. The card flashed and
   * vanished, moveTooltip bailed on every later mousemove because it early-
   * returns while hidden, and the loop went on drawing at 60fps into a canvas
   * nobody could see. That is the whole "glitchy hover preview".
   *
   * The generation counter is the other half: it invalidates any frame
   * already in flight, so a burst of hovers across many cards can never leave
   * two loops alive competing for one `_tpRaf` handle.
   */
  cancelTowerPreview() {
    if (this._tpRaf) { cancelAnimationFrame(this._tpRaf); this._tpRaf = 0; }
    this._tpGen = (this._tpGen || 0) + 1;
    /* Every registered stage goes with it. The register is what lets one loop
       drive the two detail columns at once; leaving entries behind would have
       the next pump quietly resurrect stages the caller just stopped. */
    if (this._tpStages) this._tpStages.clear();
  },

  /**
   * THE PREVIEW HARNESS -- device-pixel backing store, the generation guard,
   * the detached-node guard, the dt clamp, and ONE rAF handle for every stage
   * on screen.
   *
   * 19.8's fix was that two preview loops must never both own `_tpRaf`. The
   * four-column screen has two stages visible at once, so the answer is not a
   * second loop but a REGISTRY: one handle, one teardown, N canvases. A stage
   * leaves the register the moment its canvas is detached, which is what a
   * re-render does to it -- measured before that guard existed: 63 frames
   * drawn into a canvas nobody could see, and it never stopped.
   */
  runPreview(cv, step) {
    const reg = this._tpStages || (this._tpStages = new Map());
    /* The authored size is the DRAWING size and is remembered on the node,
       because the backing store below is about to stop matching it. Without
       it the whole preview draws at CSS resolution and rescales -- soft edges
       on every sprite on a display Windows ships scaled by default. */
    const W = cv._tpW || (cv._tpW = cv.width);
    const H = cv._tpH || (cv._tpH = cv.height);
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * d)) {
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    }
    const s = { step: step, ctx: cv.getContext('2d'), W: W, H: H, d: d, last: 0 };
    reg.set(cv, s);
    /* Painted now, so a stage is never blank for a frame -- including the
       second stage registered in a tick where the loop is already running. */
    this.drawStage(cv, s, performance.now());
    this.pumpPreviews();
  },

  /** One stage, one frame. Returns false when the stage is dead and should
      leave the register: detached by a re-render, or hidden along with the
      tooltip hosting it, for which mouseleave never fires. */
  drawStage(cv, s, now) {
    if (!cv.isConnected ||
        (this.el.tooltip.contains(cv) && this.el.tooltip.classList.contains('hidden'))) return false;
    const dt = s.last ? Math.min(TP_MAX_DT, (now - s.last) / 1000) : 1 / 60;
    s.last = now;
    s.ctx.setTransform(s.d, 0, 0, s.d, 0, 0);
    s.ctx.clearRect(0, 0, s.W, s.H);
    try { s.step(s.ctx, dt, s.W, s.H); } catch (e) { return false; }
    return true;
  },

  /** ONE loop for every registered stage. Asks for another frame only while
      at least one stage is left, so an empty register costs nothing. */
  pumpPreviews() {
    if (this._tpRaf) return;
    const gen = (this._tpGen = (this._tpGen || 0) + 1);
    const tick = (now) => {
      /* A cancel landed while this frame was in flight. */
      if (gen !== this._tpGen) return;
      const reg = this._tpStages;
      reg.forEach((s, cv) => { if (!this.drawStage(cv, s, now)) reg.delete(cv); });
      this._tpRaf = reg.size ? requestAnimationFrame(tick) : 0;
    };
    this._tpRaf = requestAnimationFrame(tick);
  },

  runTowerPreview(cv, id) {
    const t = TOWER_TYPES[id];
    const el = ELEMENTS[t.element];
    const stub = this.towerStub(id);
    /* The cadence the panel PRINTS, so what the eye counts matches the number
       two lines above it. */
    const period = 1 / Math.max(TP_MIN_RATE, t.base.rate || 1);
    let shots = [], age = 0, cd = 0, sinceShot = period;
    const targets = [{ x: 150, r: 9 }, { x: 214, r: 8 }, { x: 268, r: 7 }];

    this.runPreview(cv, (ctx, dt, W, H) => {
      const tx = 52, ty = H - 26;
      age += dt; cd -= dt; sinceShot += dt;
      /* lane */
      ctx.strokeStyle = 'rgba(120,160,200,.14)'; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(0, ty - 26); ctx.lineTo(W, ty - 26); ctx.stroke();

      /* marching dummies */
      for (const g of targets) {
        g.x -= TP_MARCH_PPS * dt;
        if (g.x < 96) g.x = W + 14;
        ctx.fillStyle = '#e05555';
        ctx.beginPath(); ctx.arc(g.x, ty - 26, g.r, 0, TAU); ctx.fill();
      }
      /* the tower, drawn by its real routine. Recoil is TIME SINCE THE SHOT
         decayed at the engine's own rate: the old expression assumed every
         tower had a half-second cadence, so a mortar drew at recoil 6.3 and a
         railgun at 7.0 against a contract of 0 to 1. */
      ctx.save(); ctx.translate(tx, ty);
      stub.age = age; stub.angle = -0.42;
      stub.recoil = Math.max(0, 1 - sinceShot * TP_RECOIL_DECAY);
      /* THE SAME THREE-STEP FALLBACK the other three dispatch sites use
         (entities.js:2584, game.js:4438, ui.js:746), and its absence here was
         a real hole rather than a nicety: only sixteen of the sixty towers
         own a bespoke `draw_<id>`, so for the other forty-four this line
         threw TypeError on the first frame, the catch swallowed it, and the
         soul shop advertised a tower the player has never seen by showing an
         empty stage with a projectile leaving thin air. The shop is the one
         screen that exists to show the thing FIRING before it is bought. */
      try {
        const fn = Tower.prototype['draw_' + id];
        if (fn) fn.call(stub, ctx, stub.age);
        else if (t.glyph) Tower.prototype.draw_glyph.call(stub, ctx, stub.age);
        else Tower.prototype.draw_bolt.call(stub, ctx, stub.age);
      } catch (e) { /* never let one sprite break a menu */ }
      ctx.restore();

      /* fire on the tower's own cadence */
      if (cd <= 0) {
        cd = period; sinceShot = 0;
        shots.push({ x: tx + 12, y: ty - 20, tx: targets[0].x, ty: ty - 26, t: 0 });
      }
      ctx.fillStyle = el.color;
      for (let i = shots.length - 1; i >= 0; i--) {
        const s2 = shots[i]; s2.t += TP_SHOT_SPEED * dt;
        const x = s2.x + (s2.tx - s2.x) * s2.t, y = s2.y + (s2.ty - s2.y) * s2.t;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
        if (s2.t >= 1) {
          shots.splice(i, 1);
          ctx.fillStyle = 'rgba(255,255,255,.65)';
          ctx.beginPath(); ctx.arc(s2.tx, s2.ty, 8, 0, TAU); ctx.fill();
          ctx.fillStyle = el.color;
        }
      }
    });
  },

  /* ================================================= UNIT SPRITES ==== */

  /**
   * A drawable that is NOT an Enemy but draws as one: the prototype supplies
   * every shape routine, and the fields below are the ones Enemy.draw reads.
   * hp === maxHp and no shield means drawHealthBar returns on its first line,
   * which is what keeps a card sprite from wearing a battle readout.
   *
   * The aura is stripped from a preview-local COPY of the definition, never
   * from the table: Enemy.draw paints it at `radius * TILE`, which is more
   * than the whole height of a card. The ring the stage draws instead is
   * sized to the stage, and every number printed beside it still comes off
   * the real definition.
   */
  unitStub(id) {
    const def = this.unitDef(id);
    if (!def || typeof Enemy === 'undefined') return null;
    const pdef = def.aura ? Object.assign({}, def, { aura: null }) : def;
    return Object.assign(Object.create(Enemy.prototype), {
      def: pdef, type: id, x: 0, y: 0, age: 0,
      radius: Math.min(UNIT_PREVIEW_MAX_R, def.radius || 10),
      ux: 1, uy: 0, flash: 0, hp: 1, maxHp: 1, shield: 0, maxShield: 0,
      armor: 0, shredAmt: 0, poisonStacks: 0, boss: false, miniboss: false,
      flying: !!def.flying, reanimated: false, owner: -1, phaseOn: false,
      freezeTimer: 0, slowTimer: 0, vulnTimer: 0, vulnAmt: 0, burnTimer: 0,
      markEl: null, markT: 0, auraTint: null
    });
  },

  unitIconHTML(id, size) {
    size = size || 44;
    return '<canvas class="unit-icon" data-unit-icon="' + id + '" width="' + size + '" height="' + size + '"></canvas>';
  },

  /** The static tile, mirroring paintTowerIcons exactly. */
  paintUnitIcons(root) {
    $$('[data-unit-icon]', root || document).forEach(cv => {
      if (cv._painted) return;
      cv._painted = true;
      const stub = this.unitStub(cv.dataset.unitIcon);
      if (!stub) return;
      const ctx = cv.getContext('2d');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const css = cv.width;
      cv.width = css * dpr; cv.height = css * dpr;
      cv.style.width = css + 'px'; cv.style.height = css + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Normalised to the tile rather than drawn at the authored radius, so
         a Chitling and a Broodmother read at the same size in the grid and
         the card compares what they DO, not how big the sprite is. */
      const s = (css * 0.40) / Math.max(6, stub.radius);
      ctx.save(); ctx.translate(css / 2, css / 2); ctx.scale(s, s);
      stub.age = 1.2;
      try { Enemy.prototype.draw.call(stub, ctx); } catch (e) {}
      ctx.restore();
    });
  },

  /**
   * ONE unit, moving, using the one thing that unit does (19.15).
   *
   * Runs on runPreview: the same harness, the same generation counter and the
   * same single rAF handle as the tower preview. Direction is the argument --
   * the tower stage marches dummies RIGHT to LEFT into your guns, this one
   * marches the unit LEFT to RIGHT out of them, because a muster is something
   * you send. The trait comes from unitTrait, the same call that prints the
   * badge above the canvas, so the picture and the words cannot disagree.
   */
  runUnitPreview(cv, id) {
    const def = this.unitDef(id);
    const stub = this.unitStub(id);
    if (!def || !stub) return;
    const trait = this.unitTrait(id);
    const host = this.unitHost(id);
    const R = stub.radius;
    let x = -R * 2, t = 0, cd = 0, blink = 0, down = 0, fell = false, ward = 1, hit = 0;
    const spawn = [], ghosts = [], rings = [];
    /* Escorts exist only for the two traits that act on somebody else. */
    const escorts = (trait.key === 'heal' || trait.key === 'aura') ? [-30, 26] : [];
    let escortHp = 0.35;

    this.runPreview(cv, (ctx, dt, W, H) => {
      t += dt; cd -= dt;
      const ly = H - 30;

      /* The lane, and the direction of travel. A send crosses left to right;
         nothing on this card has to say so in words. */
      ctx.strokeStyle = 'rgba(120,160,200,.13)'; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,160,200,.20)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        const gx = ((t * 16 + i * 48) % (W + 48)) - 24;
        ctx.beginPath();
        ctx.moveTo(gx, ly - 8); ctx.lineTo(gx + 6, ly); ctx.lineTo(gx, ly + 8);
        ctx.stroke();
      }

      let speed = UNIT_PREVIEW_PPS, alpha = 1;

      /* ---------------- the signature trait, before the sprite ---------- */
      switch (trait.key) {
        case 'blink':
          blink -= dt;
          if (blink <= 0 && x > 8 && x < W - 70) {
            blink = def.teleport.interval * UNIT_TRAIT_TEMPO;
            ghosts.push({ x: x, a: 1 });
            x += UNIT_BLINK_PX;
          }
          break;
        case 'summon':
          if (cd <= 0 && x > 0) {
            cd = def.summon.interval * UNIT_TRAIT_TEMPO;
            for (let i = 0; i < (def.summon.count || 1); i++)
              spawn.push({ x: x - R, y: ly + (i - 1) * 7, vx: -6, a: 1, r: 4 });
          }
          break;
        case 'split':
          if (x > W * 0.58) {
            const n = def.splitCount || 2;
            for (let i = 0; i < n; i++)
              spawn.push({ x: x, y: ly + (i - (n - 1) / 2) * 7, vx: 24 + i * 6, a: 1, r: 4.5 });
            x = -R * 2;   /* the split IS the end of its run */
          }
          break;
        case 'jam':
          if (cd <= 0 && x > 0) { cd = def.jam.interval * UNIT_TRAIT_TEMPO; rings.push({ x: x, r: 2 }); }
          break;
        case 'heal':
          if (cd <= 0) { cd = UNIT_PULSE_S; rings.push({ x: x, r: 2, heal: true }); }
          escortHp = Math.max(0.2, escortHp - dt * 0.28);
          break;
        case 'aura':
          ctx.save();
          ctx.globalAlpha = 0.15 + Math.sin(t * 2) * 0.05;
          ctx.fillStyle = def.aura.tint || def.color;
          ctx.beginPath(); ctx.arc(x, ly, UNIT_AURA_PX, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6;
          ctx.strokeStyle = def.aura.tint || def.color;
          ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 12;
          ctx.beginPath(); ctx.arc(x, ly, UNIT_AURA_PX, 0, TAU); ctx.stroke();
          ctx.setLineDash([]); ctx.restore();
          break;
        case 'revive':
          if (!fell && x > W * 0.5) { fell = true; down = UNIT_DOWN_S; }
          if (down > 0) {
            down -= dt; speed = 0;
            alpha = down > UNIT_DOWN_S * 0.45 ? 0.22 : 0.85;
          }
          break;
        case 'ward':
          hit -= dt;
          if (hit <= 0) { hit = UNIT_WARD_HIT_S; ward = 0; rings.push({ x: x, r: 26, in: true }); }
          ward = Math.min(1, ward + dt / Math.max(0.4, def.shieldDelay || 1));
          break;
        case 'anchor': {
          /* A frost wash sweeps back down the lane. The escort ghost is
             visibly dragged by it; the unit is not, which is the trait. */
          const fx = W - ((t * 62) % (W + 90));
          ctx.save();
          ctx.fillStyle = 'rgba(138,184,255,.16)';
          ctx.fillRect(fx, ly - 15, 46, 30);
          ctx.globalAlpha = 0.75; ctx.fillStyle = 'rgba(150,190,240,.7)';
          const gx2 = x - 34 - Math.max(0, 26 - Math.abs(fx + 23 - x)) * 0.5;
          ctx.beginPath(); ctx.arc(gx2, ly, 5, 0, TAU); ctx.fill();
          ctx.restore();
          if (Math.abs(fx + 23 - x) < 30) {
            ctx.save(); ctx.strokeStyle = 'rgba(180,225,255,.8)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(x, ly, R + 5, 0, TAU); ctx.stroke(); ctx.restore();
          }
          break;
        }
        case 'plate': {
          /* A blast lands on it and most of it does not arrive. */
          if (cd <= 0 && x > W * 0.3) { cd = 1.4; rings.push({ x: x + 6, r: 3, blast: true }); }
          break;
        }
        case 'phase':
          stub.phaseOn = (t % (def.phase.on + def.phase.off)) < def.phase.on;
          break;
        default: break;
      }

      /* ---------------- escorts, spawn, ghosts and rings ---------------- */
      for (const off of escorts) {
        const ex = x + off;
        ctx.save();
        ctx.fillStyle = 'rgba(190,210,235,.75)';
        ctx.beginPath(); ctx.arc(ex, ly, 6, 0, TAU); ctx.fill();
        if (trait.key === 'heal') {
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(ex - 8, ly - 14, 16, 3);
          ctx.fillStyle = escortHp > 0.55 ? '#4ade80' : escortHp > 0.3 ? '#fbbf24' : '#ef4444';
          ctx.fillRect(ex - 8, ly - 14, 16 * escortHp, 3);
        } else if (trait.key === 'aura') {
          ctx.strokeStyle = def.aura.tint || def.color; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(ex, ly, 9, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
      for (let i = spawn.length - 1; i >= 0; i--) {
        const s = spawn[i];
        s.x += s.vx * dt; s.a -= dt * 0.32;
        if (s.a <= 0 || s.x > W + 12 || s.x < -12) { spawn.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = Math.max(0, s.a);
        ctx.fillStyle = def.color; ctx.shadowColor = def.color; ctx.shadowBlur = 7;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
        ctx.restore();
      }
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i]; g.a -= dt * 2.4;
        if (g.a <= 0) { ghosts.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = g.a * 0.5;
        ctx.strokeStyle = def.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(g.x, ly); ctx.lineTo(x, ly); ctx.stroke();
        ctx.beginPath(); ctx.arc(g.x, ly, R * 0.8, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += (r.in ? -46 : 78) * dt;
        if (r.r > 62 || r.r < 1) { rings.splice(i, 1); if (r.heal) escortHp = 1; continue; }
        ctx.save();
        ctx.globalAlpha = r.in ? 0.8 : Math.max(0, 1 - r.r / 62);
        ctx.strokeStyle = r.heal ? '#8ef0b0' : r.blast ? '#ff9a4d' : r.in ? '#e05555' : def.color;
        ctx.lineWidth = r.blast ? 2.4 : 1.8;
        ctx.beginPath(); ctx.arc(r.x, ly, Math.abs(r.r), 0, TAU); ctx.stroke();
        ctx.restore();
      }

      /* ---------------- the jammed tower a Scrapjack silences ---------- */
      if (trait.key === 'jam') {
        const jx = W - 34;
        const silenced = rings.some(r => Math.abs(jx - r.x) < r.r + 6);
        ctx.save();
        ctx.globalAlpha = silenced ? 0.35 : 1;
        ctx.strokeStyle = silenced ? '#7e94aa' : '#38e8ff'; ctx.lineWidth = 2;
        ctx.strokeRect(jx - 8, ly - 20, 16, 20);
        ctx.beginPath(); ctx.moveTo(jx, ly - 20); ctx.lineTo(jx, ly - 28); ctx.stroke();
        ctx.restore();
        if (silenced) {
          ctx.save(); ctx.fillStyle = '#f87171'; ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'center'; ctx.fillText('⊘', jx, ly - 30); ctx.restore();
        }
      }

      /* ---------------- the unit ---------------------------------------- */
      x += speed * dt;
      if (x > W + R * 2) {
        x = -R * 2; fell = false; down = 0; ward = 1; hit = 0;
        spawn.length = 0; ghosts.length = 0; rings.length = 0;
      }
      stub.age = t; stub.x = x; stub.y = ly;
      ctx.save();
      ctx.globalAlpha = alpha;
      try { Enemy.prototype.draw.call(stub, ctx); } catch (e) {}
      ctx.restore();

      /* The ward is drawn OVER the sprite, at the fraction it has reformed --
         the same thing shieldDelay buys in a battle. */
      if (trait.key === 'ward' && ward > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(96,165,250,${0.3 + ward * 0.5})`;
        ctx.fillStyle = `rgba(96,165,250,${0.06 + ward * 0.12})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, ly, R + 5 + ward * 3, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      /* Allegiance, bottom-left, so the stage says whose soldier this is even
         when the sprite is off the left edge mid-loop. */
      ctx.save();
      ctx.fillStyle = host.color; ctx.globalAlpha = 0.55;
      ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText(host.icon, 6, H - 6);
      ctx.restore();
    });
  },
  /** Leaving a card: stop the loop AND put the tooltip away. */
  stopTowerPreview() {
    this.cancelTowerPreview();
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
      /* `owns-pause`: this modal sets Game.paused below and clears it in
         closeIntro, so the HUD button must not toggle underneath it. The class
         is the whole of how UI.togglePause knows that. */
      ov.className = 'overlay hidden owns-pause';
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
    /* No {once:true}. The wrapper protected nothing -- #bi-body's innerHTML is
       rewritten on every open, so this button and its listener are destroyed and
       rebuilt anyway -- while costing a dead BEGIN THE BATTLE the instant anything
       makes closeIntro return early: listener fired and removed, overlay still on
       screen, Escape the only way out. _biOpen is the real gate; reading it here
       keeps a repeat click silent as well as harmless. */
    $('#bi-go').addEventListener('click', () => {
      if (!this._biOpen) return;
      Sound.play('click');
      closeIntro();
    });
  },

  /* ═══════════════════════════════ ENEMY DOSSIER (first encounter) ═══ */

  showEnemyIntro(def, live) {
    Game.paused = true;
    this.syncSpeed();
    let ov = $('#enemy-intro');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'enemy-intro';
      /* `owns-pause`: showEnemyIntro already set Game.paused and closeDossier
         clears it, so the HUD button must not toggle underneath it. Same marker
         the pre-battle dialogue wears; see UI.togglePause. */
      ov.className = 'overlay hidden owns-pause';
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
    /* No {once:true} here either, same reasoning as the dialogue's button: the
       wrapper is redundant against #ei-body's rebuilt innerHTML and turns any
       future early return in closeDossier into an ENGAGE nobody can press twice.
       closeDossier zeroes _eiRaf as it cancels, so even a double click cannot
       double-cancel the sprite loop -- but re-reading _eiOpen here stops a second
       click from firing a second click sound at a modal already gone. */
    $('#ei-go').addEventListener('click', () => {
      if (!this._eiOpen) return;
      Sound.play('click');
      closeDossier();
    });
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

  /** A REFUSAL THAT SAYS WHY. The blip and the gold flash were the entire
      vocabulary for "no", so a lane tile, an empty purse, a 2x2 that does not
      fit and a spent demolition allowance all sounded identical and a refused
      click taught the player nothing. Same blip, same flash -- but only when
      GOLD was the problem, because flashing the gold meter at a life-priced
      refusal points at the one number that is not short.

      ONE REUSED NODE, not this.toast(). A toast lives five seconds and several
      callers answer a held key: keydown has no e.repeat guard, so holding U on
      a tower you cannot afford fires this at the OS repeat rate, and appending
      per refusal would bury the battlefield under a column of the same line.
      Rewriting in place keeps a CHANGING reason readable while the screen
      never carries more than one, and the sound underneath is already
      throttled to 0.14s inside Sound.denied.

      textContent rather than the toast path's innerHTML: every caller today
      builds its line from TOWER_TYPES and formatNum, but a refusal is exactly
      the surface a later caller would be tempted to hand a profile or peer
      name to, and this one cannot render it. */
  denied(text, goldFlash = true) {
    Sound.play('denied');
    if (goldFlash) this.flashGold();
    let el = this._deniedToast;
    if (!el || !el.isConnected) {
      el = this._deniedToast = document.createElement('div');
      el.className = 'toast';
      el.appendChild(document.createElement('span'));
      $('#toasts').appendChild(el);
    }
    el.classList.remove('out');
    el.firstChild.textContent = text;
    clearTimeout(this._deniedFade); clearTimeout(this._deniedGone);
    this._deniedFade = setTimeout(() => el.classList.add('out'), 2600);
    this._deniedGone = setTimeout(() => {
      el.remove();
      if (this._deniedToast === el) this._deniedToast = null;
    }, 3200);
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
      ${owed ? `<p class="ec-owed">${owed} refused escalation${owed > 1 ? 's' : ''} still owed.</p>` : ''}
      <button class="btn btn-sm ec-hold" id="btn-ec-hold">⏸ HOLD — BUILD FIRST</button>`;
    ov.classList.remove('hidden');
    this._removeEscHoldChip();
    $$('[data-esc]', ov).forEach(b => b.addEventListener('click', () => {
      ov.classList.add('hidden');
      this._removeEscHoldChip();
      Game.takeEscalation(offer[+b.dataset.esc]);
    }));
    /* D3. The halt is the one moment the board stands still, and on a big
       seat count it is a LONG moment -- so let the player spend it. HOLD
       hides the modal without resolving it: the sim stays parked (state is
       still 'escalating'), but boardInteractive() now says yes, so towers can
       be placed, upgraded, sold and re-aimed. The chip is the way back, and
       the wave cannot restart until a card is taken. */
    $('#btn-ec-hold').addEventListener('click', () => {
      ov.classList.add('hidden');
      Game.escalationHold = true;
      const chip = document.createElement('button');
      chip.id = 'esc-hold-chip';
      chip.className = 'btn esc-hold-chip';
      chip.innerHTML = '⚠ THE ENEMY WAITS — CHOOSE ESCALATION';
      chip.addEventListener('click', () => {
        /* No `|| offer` fallback: a chip whose offer the engine has already
           cleared must be inert, not a replay of a battle that is over. */
        if (!Game.pendingEscalation) { this._removeEscHoldChip(); return; }
        Game.escalationHold = false;
        this.showEscalationChoice(Game.pendingEscalation);
      });
      $('#screen-game').appendChild(chip);
    });
  },

  /**
   * IMMERSIVE BOARD — the map takes the whole window and the chrome floats
   * over it, the same treatment the galaxy map gets.
   *
   * The resize MUST follow the class, not precede it: Game.resize measures
   * the canvas's parent box, so running it first measures the layout being
   * left rather than the one being taken. The background is baked at the
   * fitted scale, so it is re-baked at the new one or the terrain stays
   * blurry at the size it was drawn for.
   */
  toggleImmersive(on) {
    const want = (on === undefined) ? !document.body.classList.contains('immersive') : !!on;
    document.body.classList.toggle('immersive', want);
    const b = $('#btn-immersive');
    if (b) b.classList.toggle('on', want);
    Storage.saveSettings(Object.assign(Storage.loadSettings(), { immersive: want }));
    if (Game.canvas && FIELD) {
      Game.resize();
      Game.renderBackground();
    }
    return want;
  },

  /** The hold chip never outlives its offer -- both re-entry paths and every
      resolution path route through here. */
  _removeEscHoldChip() {
    const c = $('#esc-hold-chip');
    if (c) c.remove();
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
    /* A FocusEvent HAS NO COORDINATES, and three surfaces feed one in: the
       galaxy world nodes, the universe map, and the POWER chip -- which was
       given tabindex="0" precisely so a keyboard could reach it. `undefined
       - n` is NaN, `NaN < 8` is false so the flip never fired, clamp returns
       NaN unchanged, and the browser rejects both style writes: the card
       stayed frozen wherever the mouse last left it, or sat at the foot of
       the document. Anchor to the focused ELEMENT instead, which is where a
       keyboard user is actually looking. */
    let px = ev && ev.clientX, py = ev && ev.clientY;
    if (!isFinite(px) || !isFinite(py)) {
      const el = ev && ev.target && ev.target.getBoundingClientRect
        ? ev.target.getBoundingClientRect() : null;
      if (el) { px = el.right; py = el.top + el.height / 2; }
      else { px = window.innerWidth / 2; py = window.innerHeight / 2; }
    }
    let x = px - r.width - 16;
    if (x < 8) x = px + 16;
    /* And the horizontal needs the same clamp the vertical always had, or an
       element near the right edge pushes the card off the screen. */
    t.style.left = clamp(x, 8, Math.max(8, window.innerWidth - r.width - 8)) + 'px';
    t.style.top = clamp(py - r.height / 2, 8, Math.max(8, window.innerHeight - r.height - 8)) + 'px';
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
    /* endMatch always writes this, on a defeat exactly as on a win. The
       fallback exists for any caller that opens the end screen without
       having gone through endMatch, and it deliberately routes nowhere:
       an absent record is not a level-up. */
    const lu = Game.lastLevelUp || { route: false, points: 0, level: xp.level, spendable: 0 };
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

        ${lu.route ? `
          <div class="rw-levelup" id="rw-spend" style="--cc:${me.commander.color}">
            <b>${lu.points} POINT${lu.points === 1 ? '' : 'S'} TO SPEND</b>
            <span>${me.commander.name} ${lu.levels === 1
              ? `reached level ${lu.level}`
              : `gained ${lu.levels} levels, to ${lu.level}`}. ${lu.spendable === 1
              ? 'One talent' : lu.spendable + ' talents'} can be taken now — continue opens the technology chart.</span>
          </div>` : ''}

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
            <em>freed from the fallen garrison — now available to your summon roster</em></div>` : ''}

        ${st && st.storyTower ? `
          <div class="rw-saved"><b>MACHINE LINE</b>
            <span style="--tc:${TOWER_TYPES[st.storyTower].color}">${TOWER_TYPES[st.storyTower].name}</span>
            <em>issued for taking the system — it is in your arsenal now, not for sale to anyone</em></div>` : ''}

        ${Game.rivalMoves && Game.rivalMoves.length ? `
          <div class="rw-rivals"><b>WHILE YOU FOUGHT</b>${Game.rivalMoves.map(mv =>
            `<span style="--fc:${FACTIONS[mv.faction].color}">${FACTIONS[mv.faction].icon} ${FACTIONS[mv.faction].short} took ${mv.world} in ${mv.system}</span>`).join('')}</div>` : ''}

        <div class="rw-stats">
          <div><b>${Game.wave}</b><span>waves</span></div>
          <div><b>${formatNum(me.stats.kills)}</b><span>killed</span></div>
          <div><b>${formatNum(me.stats.sent)}</b><span>sent</span></div>
          <div><b>${me.towers.length}</b><span>towers</span></div>
        </div>
        <div class="rw-stats">
          <div><b>${formatNum(me.stats.goldEarned)}</b><span>gold earned</span></div>
          <div><b>${formatNum(me.stats.mustered)}</b><span>summoned</span></div>
          <div><b>${formatNum(me.stats.livesRestored)}</b><span>lives restored</span></div>
          <div><b>${formatNum(me.stats.leaksRecovered)}</b><span>thefts stopped</span></div>
        </div>

        ${(() => {
          /* THE HARVEST -- WHAT KILLED YOU's mirror, wins only. A defeat
             already carries its lecture below; a win deserves the ledger of
             what fed it. Ranked by body count, not bounty: the question a
             winner asks is "what did I mostly fight", and the bounty column
             answers "what was it worth" beside it. */
          if (!won) return '';
          const rows = Object.entries(me.killLog || {})
            .sort((a, b) => b[1].n - a[1].n).slice(0, 3);
          if (!rows.length) return '';
          return `<div class="rw-leaks rw-harvest"><b>THE HARVEST</b>${rows.map(([id, v]) => {
            const d = ENEMY_TYPES[id] || {};
            return `<div class="rw-leak" style="--tc:${d.color || '#94a3b8'}">
              <span class="rw-lname">${d.name || id}</span>
              <span class="rw-lnote">${formatNum(v.n)} killed · ◈${formatNum(v.bounty)} base bounty</span>
            </div>`;
          }).join('')}</div>`;
        })()}

        ${(() => {
          /* WHAT KILLED YOU. The top three classes by lives ACTUALLY lost,
             read from Side.leakLog -- which only loseLives writes, so a
             carrier shot down on its way out is absent by construction and
             can never be mourned here as a death that did not happen. The
             trait tag is the sentence that usually explains the leak on its
             own: TELEPORTS beside a slow-tower board needs no further
             comment. Derived from the same def fields the dossier and the
             next-wave panel read, so all three surfaces say one thing.
             Defeat only -- a win does not need a lecture.
             Three answers, not one, because a defeat has three causes and
             only the first is a row: what crossed, what you STOPPED crossing
             (the recovery is the counterplay this screen exists to teach),
             and what you spent yourself. A board can fall on BLOOD PRICE
             alone -- spendLives is deliberately not loseLives, so it books no
             breach -- and a block headed WHAT KILLED YOU that then listed
             nothing would be the same silence this fixes. */
          if (won) return '';
          const rows = Object.entries(me.leakLog || {}).filter(([, v]) => v.lives > 0)
            .sort((a, b) => b[1].lives - a[1].lives).slice(0, 3);
          const saved = me.stats.leaksRecovered || 0;
          const paid = me.livesPaid || 0;
          if (!rows.length && !saved && !paid) return '';
          const body = rows.map(([id, v]) => {
            const d = ENEMY_TYPES[id] || {};
            const tags = [];
            if (d.flying) tags.push('FLYING');
            if (d.teleport) tags.push('TELEPORTS');
            if (d.phase) tags.push('PHASES');
            if (d.slowResist >= 1) tags.push('SLOW-IMMUNE');
            if (d.jam) tags.push('JAMS TOWERS');
            if (d.healRate) tags.push('HEALER');
            if (d.revive) tags.push('REVIVES');
            if (d.splitInto) tags.push('SPLITS');
            if (d.armor >= 8) tags.push('ARMOURED');
            const tag = tags.slice(0, 2).join(' · ');
            return `<div class="rw-leak" style="--tc:${d.color || '#94a3b8'}">
              <span class="rw-lname">${d.name || id}${tag ? ` <span class="rw-ltag">${tag}</span>` : ''}</span>
              <span class="rw-lnote">−${v.lives} ♥ · ${v.n} breach${v.n === 1 ? '' : 'es'}${
                v.sent ? ` · ${v.sent} sent at you` : ''}</span>
            </div>`;
          }).join('');
          const lead = rows.length
            ? (saved
                ? `${saved} further theft${saved === 1 ? '' : 's'} never got out — a carrier killed before it crosses the spawn edge costs you nothing.`
                : 'Every theft above walked off the board. Kill the carrier on its way out and you never pay for it.')
            : (saved
                ? `Not one theft got out: all ${saved} carrier${saved === 1 ? '' : 's'} died before crossing the spawn edge.`
                : 'No breach cost you a life.');
          return `<div class="rw-leaks"><b>${rows.length ? 'WHAT KILLED YOU' : 'WHERE YOUR LIVES WENT'}</b>${body}
            <em>${lead}</em>
            ${paid ? `<em>${paid} ♥ went on BLOOD PRICE — you spent those yourself; no enemy took them.</em>` : ''}
            <em>The full dossier for every contact is in the FIELD MANUAL.</em></div>`;
        })()}

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
    this.playRewardTimeline({ stars, xp, p, soulsEarned, soulsTotal: Meta.souls(), spend: lu.route });
  },

  /** Name the continue button after wherever it is actually about to go. */
  endRetryLabel() {
    const b = $('#btn-end-retry');
    if (!b) return;
    /* Label and destination come off the ONE condition, together, for the
       same reason the skirmish label does: a button reading TO THE GALAXY
       that opens the technology chart is the drift this method exists to
       prevent. So the name is honest from the first frame and the reward
       timeline only reveals the EXPLANATION beneath it a beat later -- the
       timeline never gets a vote on where the button goes, which is what
       keeps an impatient click truthful. */
    const lu = Game.lastLevelUp;
    b.textContent = (lu && lu.route)
      ? 'SPEND ' + lu.points + ' POINT' + (lu.points === 1 ? '' : 'S') + ' →'
      : Game._skirmish ? 'TO THE MULTIVERSE →'
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

    /* The level-up lands last, after the bar that earned it has filled. */
    const revealSpend = () => {
      if (!d.spend) return;
      const s = q('#rw-spend');
      if (s) s.classList.add('show');
    };
    at(soulStart + RW_SPEND_DELAY_MS, revealSpend);

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
      revealSpend();
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

    /* The fifth power is documented the day it becomes real and not one day
       sooner. A manual that described a banner the player cannot swear would
       be the same advertisement the faction screen deliberately refuses to
       show -- but a player who HAS earned it needs somewhere to read what
       BOOTSTRAP and the Lattice actually do. */
    const powerIds = FACTION_ORDER.concat(
      (typeof SECRET_FACTIONS !== 'undefined' && Meta.gameBeaten()) ? SECRET_FACTIONS : []);
    const factions = powerIds.map(id => {
      const f = FACTIONS[id];
      const secret = FACTION_ORDER.indexOf(id) < 0;
      return `<div class="codex-entry fac" style="--tc:${f.color}">
        <b>${f.icon} ${f.name}${secret ? ' <em class="fx-secret">SECRET</em>' : ''}</b>
        <em class="fx-creed">${f.creed}</em>
        <span>${f.blurb}</span>
        <span class="fx-bonus"><b>${f.bonusName}</b> — ${f.bonusDesc}</span>
        ${secret ? `<span class="fx-bonus"><b>THE LATTICE</b> — ${SUMMON_DOCTRINES.robot.desc}
          Their commanders COMPILE: each opens weaker than the commander it was copied from and
          rewrites itself as the battle teaches it. Their soldiers are for sale to every banner
          now that a galaxy has fallen.</span>` : ''}
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
        <p>A campaign is a galaxy: five solar systems, seven worlds each, held by every
           power that is not yours${(() => {
             /* Counted, not hard-coded. A Parallel commander faces FOUR rivals
                because the machines hold no worlds of their own, and the old
                sentence said "the three powers that are not yours" to
                everybody. */
             const n = rivalFactionsOf(Meta.faction() || 'human').length;
             return n === 4 ? ' — all four of them, since the machines hold none' : '';
           })()}.</p>
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
        <p><b>The first galaxy is the gentle one.</b> Its opening system meets one new creature
           every three waves instead of two, holds its first miniboss back, and eases the health
           curve around the waves that usually end a first run \u2014 closing again by wave
           ${TIER0_EASE_END_WAVE}, so nothing past it changes.</p>
        <p><b>NEW GAME PLUS.</b> Take every commander seat and the galaxy is yours; the next one
           asks how hard you want it. <b>${RAMP_PRESETS.veteran.name}</b> is the galaxy as you
           fought it. <b>${RAMP_PRESETS.onslaught.name}</b> escalates every world once more and
           pays ${Math.round((RAMP_PRESETS.onslaught.soulsMul - 1) * 100)}% more souls at
           extraction. <b>${RAMP_PRESETS.apex.name}</b> is Overrun from the first world to the
           last for ${Math.round((RAMP_PRESETS.apex.soulsMul - 1) * 100)}% more. Each tier also
           makes every garrison stronger \u2014 ${Math.round(RAMP_PRESETS.veteran.tierHpStep * 100)}%,
           ${Math.round(RAMP_PRESETS.onslaught.tierHpStep * 100)}% or
           ${Math.round(RAMP_PRESETS.apex.tierHpStep * 100)}% per galaxy behind you. The harder
           ramps pay when you EXTRACT, never per star, so there is nothing to farm.</p>
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
        <p>What a kill becomes is decided by your commander's <b>rite</b>, not by a single
           universal law. <b>${SUMMON_DOCTRINES.robot.name}</b> returns the body exactly as it
           fell; <b>${SUMMON_DOCTRINES.human.name}</b> drafts a different soldier from your own
           roster; <b>${SUMMON_DOCTRINES.xeno.name}</b> leaves it to incubate where it died; and
           under <b>${SUMMON_DOCTRINES.light.name}</b> and <b>${SUMMON_DOCTRINES.pirate.name}</b> a
           kill yields nothing at all — they march on a clock and on gold instead. Whatever a rite
           sends arrives at <b>${Math.round(MUSTER_DAMP * 100)}%</b> health and can never be sent
           again, so kills never cascade.</p>
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
      <section><h3>Power &amp; summons</h3><div class="codex-note">
        <p>Two figures govern everything you put on a rival's lane. <b>POWER</b> is how heavy a body
           arrives. <b>ECON</b> is the permanent share of every wave reward your summons have bought you.
           A paid summon raises both at once — it is the only purchase in the game that is an attack and
           an income in the same press.</p>
        <p>You carry up to <b>${MUSTER_LOADOUT_SIZE}</b> saved denizens into a battle, chosen on the
           deployment loadout screen; each becomes one row of the summon bar, and its pack size, price and
           income are all derived from that denizen's own health, so a swarm of frail mobs and a pair of
           heavies put comparable mass in the lane. A denizen is <b>saved</b> by conquering the world it
           defends outright — three stars, first time — and it joins a vault every profile shares.</p>
        <p>A purchase costs a share of the <em>next</em> wave's reward and climbs with every buy; for most
           commanders it flattens after <b>${MUSTER_COST_STEPS}</b>, and the ECON it adds is capped at
           <b>+${Math.round(MUSTER_INCOME_CAP_PCT * 100)}%</b> of a wave reward. You may buy at most
           <b>${MUSTER_PER_WAVE}</b> per wave, under every flag — an army is built across a match, not
           bought in one build phase. Every buy also hardens what you send, permanently.</p>
        <p><b>THE FIVE RITES.</b> How a commander summons is decided by the commander, not the banner —
           a commander of another power brings their own rite to your flag, while your roster supplies the
           soldiers. One law binds all five: a rite may change the <em>shape</em> a kill returns in, never
           its <em>mass</em>.</p>
        <p><b>${SUMMON_DOCTRINES.human.name}</b> — ${SUMMON_DOCTRINES.human.desc}<br>
           <b>${SUMMON_DOCTRINES.light.name}</b> — ${SUMMON_DOCTRINES.light.desc} It begins on wave
           ${FOL_START_WAVE}, and pays a steeper tax than a bought body because nobody paid for it.<br>
           <b>${SUMMON_DOCTRINES.xeno.name}</b> — ${SUMMON_DOCTRINES.xeno.desc} A clutch keeps
           ${Math.round(XENO_INC_SHARE * 100)}% of what it was, hatches on its own clock, and a kill within
           ${XENO_INC_FEED_RADIUS} tiles takes ${XENO_INC_FEED_SEC}s off it. At most
           ${XENO_INC_CAP} at once.<br>
           <b>${SUMMON_DOCTRINES.pirate.name}</b> — ${SUMMON_DOCTRINES.pirate.desc} What prices it is a
           summon cost that never stops climbing.<br>
           <b>${SUMMON_DOCTRINES.robot.name}</b> — ${SUMMON_DOCTRINES.robot.desc}</p>
        <p>On a board where nothing rises — the Maelstrom — every rite's free half is switched off and
           all five buy their bodies instead.</p>
        <p><em>Older field manuals described every kill rising again. That law now belongs to the
           Lattice alone.</em></p>
        <p>Summoned units count as <b>reanimated</b>: they arrive damped, cost half as many lives on a
           leak, and can never be summoned a second time. On the Confluence one purchase marches on
           <b>both</b> rivals, exactly as a kill does there.</p>
        <p><b>A summoned body is not a wave body.</b> On top of that damping, anything you
           <em>summon</em> — a bought detachment, a tower's minions, a carrier's brood — arrives
           lighter for the first ${SPAWN_HP_PENALTY_END} waves, because the wave curve is flat that
           early and a bought body would otherwise be worth very nearly a scripted one against a
           defence that is still two towers. It is
           <b>${Math.round((1 - spawnHpPenaltyMul(1)) * 100)}%</b> lighter on wave 1,
           <b>${Math.round((1 - spawnHpPenaltyMul(SPAWN_HP_PENALTY_MID_WAVE)) * 100)}%</b> on wave
           ${SPAWN_HP_PENALTY_MID_WAVE}, and nothing at all from wave
           <b>${SPAWN_HP_PENALTY_END}</b> on. Early aggression is a tempo play; it is not a kill.
           Reanimates and charms are untouched — those convert a body the wave already paid for.</p>
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

  /* ============================================================ SAVE I/O */

  exportSave() {
    /* root() is the live object -- always at least as current as the
       coalesced write behind it, so no flush is needed to export. */
    const payload = { app: 'cosmic-conquest', version: 1,
                      exportedAt: new Date().toISOString(), data: Meta.root() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cosmic-conquest-save-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.toast('Save exported');
  },

  importSave(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const data = parsed && parsed.data ? parsed.data : parsed;
        if (!data || typeof data !== 'object' || !data.profiles ||
            !Object.keys(data.profiles).length)
          throw new Error('no profiles in this file');
        /* ORDER IS THE DEFENCE. flush() first: it clears the coalesced save
           timer, so no pending write of the OLD root can land after the
           import and silently undo it. Then overwrite, then drop the
           in-memory cache so the next read loads what was imported. */
        Meta.flush();
        localStorage.setItem(Meta.KEY, JSON.stringify(data));
        Meta._root = null;
        this.loadSettings();
        this.toast('Save imported');
      } catch (e) {
        this.toast('Import failed — ' + e.message);
      }
    };
    reader.readAsText(file);
  },

  loadSettings() {
    const s = Storage.loadSettings();
    $('#set-sfx').value = Math.round(s.sfx * 100);
    $('#set-music').value = Math.round(s.music * 100);
    $('#set-sfx-on').checked = s.sfxOn;
    $('#set-music-on').checked = s.musicOn;
    $('#set-reduced-motion').checked = !!s.reducedMotion;
    setReducedMotion(s.reducedMotion);
    document.body.classList.toggle('rm-user', !!s.reducedMotion);
    $('#set-dmg-numbers').checked = s.damageNumbers !== false;
    setDamageNumbers(s.damageNumbers !== false);
    /* The board preference outlives the session. Class only -- no resize
       here, because loadSettings runs before a battle exists. */
    document.body.classList.toggle('immersive', !!s.immersive);
    const ib = $('#btn-immersive');
    if (ib) ib.classList.toggle('on', !!s.immersive);
    Sound.setSfxVolume(s.sfx); Sound.setMusicVolume(s.music);
    Sound.toggleSfx(s.sfxOn); Sound.toggleMusic(s.musicOn);
  },
  saveSettings() {
    Storage.saveSettings({ sfx: $('#set-sfx').value / 100, music: $('#set-music').value / 100,
      sfxOn: $('#set-sfx-on').checked, musicOn: $('#set-music-on').checked,
      reducedMotion: $('#set-reduced-motion').checked,
      damageNumbers: $('#set-dmg-numbers').checked });
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
  wrap: null, plane: null, cv: null, ctx: null,
  camX: 0, camY: 0, z: GX_ZOOM_HOME,   /* the camera: a WORLD centre and a zoom */
  vx: 0, vy: 0,                        /* coasting velocity, world units/second */
  base: 1,                             /* px per world unit at zoom 1           */
  dragging: false, moved: 0, raf: 0, stars: [], last: 0,
  key: null, anchor: null, fly: null, pts: null,

  /** Restructure the wrap into starfield + tilted plane, once per render. */
  mount(wrap, key) {
    if (!wrap) return;
    const svg = wrap.querySelector('svg');
    if (!svg) return;
    /* TWO maps mount this, and one of them re-renders on every click. Re-
       rendering the SAME map must keep the pan and zoom the player set, while
       arriving on a DIFFERENT map -- or a different campaign, which is what
       the key adds -- must not inherit it, or the map opens scrolled to
       wherever the last one was left. */
    key = key || 'gx';
    const fresh = this.wrap !== wrap || this.key !== key;
    this.wrap = wrap; this.key = key;
    wrap.classList.add('gx-viewport');
    /* The viewport is a control now: arrows pan it and Home recentres it, and
       none of that reaches an element that cannot hold focus. */
    if (!wrap.hasAttribute('tabindex')) {
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', 'Galaxy map. Drag or use the arrow keys to pan, ' +
                                      'plus and minus to zoom, Home to recentre.');
    }

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

    this.cv = cv; this.ctx = cv.getContext('2d'); this.plane = plane;
    if (!this.stars.length) this.seed();
    this.bind(wrap);
    if (fresh) {
      this.z = GX_ZOOM_HOME; this.vx = 0; this.vy = 0; this.fly = null;
      this.camX = GX_WORLD.x + GX_WORLD.w / 2;
      this.camY = GX_WORLD.y + GX_WORLD.h / 2;
      this.anchor = null; this._anchorId = null;
    }
    this.resize();
    this._bw = wrap.clientWidth; this._bh = wrap.clientHeight;
    this.clamp();
    this.apply();
    this.start();
  },

  seed() {
    /* Three depths. Deeper stars are dimmer, smaller and pan least. The counts
       keep their old 150:90:40 proportions and are scaled off one config
       number, so the layering survives a re-tune. */
    const rnd = (i, k) => { const v = Math.sin(i * 91.7 + k * 47.3) * 43758.5453; return v - Math.floor(v); };
    const k = GX_STARFIELD_STARS / 280;
    this.stars = [];
    [[150, 0.12, 0.8], [90, 0.28, 1.3], [40, 0.5, 1.9]].forEach(([n, depth, size], li) => {
      n = Math.round(n * k);
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
      this.pts = new Map();
      window.addEventListener('pointermove', (e) => {
        const p = this.pts.get(e.pointerId);
        if (!p) return;
        const now = performance.now();
        const dt = Math.max(0.008, (now - p.t) / 1000);
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY; p.t = now;
        this.moved += Math.abs(dx) + Math.abs(dy);
        /* Two fingers down is a pinch, not two drags. Falling through to the
           pan below would move the map by the SUM of both fingers. */
        if (this.pts.size >= 2) { this.vx = 0; this.vy = 0; this.pinch(); return; }
        const s = this.base * this.z;
        this.camX -= dx / s; this.camY -= dy / s;
        /* Velocity is world units per SECOND, smoothed, so the glide is the
           same on a 60Hz and a 144Hz screen -- the old per-frame delta was
           silently twice as fast on the faster one. */
        this.vx = this.vx * 0.55 + (-dx / s / dt) * 0.45;
        this.vy = this.vy * 0.55 + (-dy / s / dt) * 0.45;
        this.clamp(); this.apply();
      }, { passive: true });
      const release = (e) => {
        if (!this.pts.delete(e.pointerId)) return;
        this._pinchD = 0;
        if (!this.pts.size) {
          this.dragging = false;
          if (this.wrap) this.wrap.classList.remove('dragging');
        }
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      window.addEventListener('resize', () => {
        if (this.wrap && this.wrap.isConnected) { this.resize(); this.clamp(); this.apply(); }
      });
    }
    if (wrap._gxWired) return;
    wrap._gxWired = true;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (this.wrap !== wrap) return;
      /* The nav buttons sit inside the viewport. Starting a drag under them
         leaves `moved` high, and the capture-phase guard below would then eat
         the very click that was aimed at RECENTRE. */
      if (e.target.closest && e.target.closest('.gx-nav')) return;
      this.dragging = true; this.moved = 0;
      this.fly = null;                    /* a hand on the map outranks a flight */
      this.vx = 0; this.vy = 0;
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      wrap.classList.add('dragging');
    });
    /* A drag that travelled must not also count as a click on a world. */
    wrap.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.gx-nav')) return;
      if (this.moved > 6) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    wrap.addEventListener('wheel', (e) => {
      if (this.wrap !== wrap) return;
      e.preventDefault();
      this.fly = null;
      this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    /* KEYBOARD PARITY. A map several windows across that only a mouse can move
       is a map a keyboard player cannot see most of. */
    wrap.addEventListener('keydown', (e) => {
      if (this.wrap !== wrap || e.altKey || e.ctrlKey || e.metaKey) return;
      const s = this.base * this.z;
      const stepX = wrap.clientWidth * GX_KEY_PAN / s, stepY = wrap.clientHeight * GX_KEY_PAN / s;
      switch (e.key) {
        case 'ArrowLeft':  this.camX -= stepX; break;
        case 'ArrowRight': this.camX += stepX; break;
        case 'ArrowUp':    this.camY -= stepY; break;
        case 'ArrowDown':  this.camY += stepY; break;
        case '+': case '=': this.zoomBy(1.18); e.preventDefault(); return;
        case '-': case '_': this.zoomBy(1 / 1.18); e.preventDefault(); return;
        case 'Home': this.home(); e.preventDefault(); return;
        default: return;
      }
      this.fly = null; this.vx = 0; this.vy = 0;
      this.clamp(); this.apply();
      e.preventDefault();
    });
  },

  /** Two fingers: zoom about the point between them. */
  pinch() {
    const ps = [];
    this.pts.forEach(p => ps.push(p));
    const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    if (this._pinchD > 4 && d > 4) this.zoomAt((ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2, d / this._pinchD);
    this._pinchD = d;
  },

  /** Zoom about a CLIENT point, keeping the world under it where it is. */
  zoomAt(px, py, k) {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    if (!r.width) return;
    const ox = px - r.left - r.width / 2, oy = py - r.top - r.height / 2;
    const s0 = this.base * this.z;
    const wx = this.camX + ox / s0, wy = this.camY + oy / s0;
    this.z = Math.max(GX_ZOOM_MIN, Math.min(GX_ZOOM_MAX, this.z * k));
    const s1 = this.base * this.z;
    this.camX = wx - ox / s1; this.camY = wy - oy / s1;
    this.clamp(); this.apply();
  },

  zoomBy(k) {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, k);
  },

  /**
   * THE CAMERA CANNOT LEAVE THE WORLD. The bound is on the camera CENTRE, in
   * world units -- the old bound was a fraction of the viewport in pixels,
   * which is a different rule at every zoom and every window size, and on a
   * map the size of its own window it did nothing at all.
   */
  clamp() {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const s = this.base * this.z;
    if (!r.width || !s) return;
    const hw = (r.width / 2) / s, hh = (r.height / 2) / s;
    const midX = GX_WORLD.x + GX_WORLD.w / 2, midY = GX_WORLD.y + GX_WORLD.h / 2;
    let lo = GX_WORLD.x + hw, hi = GX_WORLD.x + GX_WORLD.w - hw;
    /* Zoomed out past both edges there is no pan left to give: pinning to the
       middle beats letting the whole galaxy drift off one side. */
    this.camX = lo > hi ? midX : Math.max(lo, Math.min(hi, this.camX));
    lo = GX_WORLD.y + hh; hi = GX_WORLD.y + GX_WORLD.h - hh;
    this.camY = lo > hi ? midY : Math.max(lo, Math.min(hi, this.camY));
  },

  apply() {
    if (!this.plane) return;
    const s = this.base * this.z;
    const x = (GX_WORLD.x + GX_WORLD.w / 2 - this.camX) * s;
    const y = (GX_WORLD.y + GX_WORLD.h / 2 - this.camY) * s;
    this.plane.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${this.z.toFixed(4)})`;
    if (this.wrap) {
      this.wrap.classList.toggle('gx-far', this.z < GX_ZOOM_FAR);
      /* Labels are compensated back up as the marks shrink, so an overview
         still names its systems. Capped: uncapped, the minimum zoom would
         print them at nearly three times their authored size and they would
         collide with the very worlds they label. */
      this.wrap.style.setProperty('--gxlab', Math.min(GX_LABEL_MAX, 1 / this.z).toFixed(3));
    }
  },

  resize() {
    if (!this.wrap || !this.cv) return;
    const r = this.wrap.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    /* clientWidth is the CONTENT box; the rect is the BORDER box. The wrap has
       a 1px border under border-box sizing and the canvas is inset:0 inside it,
       which lays it out in the content box -- so sizing the backing store off
       the rect made a 689x381 buffer for a 687x379 display area. The browser
       downscaled the whole starfield by ~0.3%: a faint blur on every star, and
       the parallax drifting against the plane by the same fraction. These two
       now agree by construction rather than by coincidence. */
    const cw = this.wrap.clientWidth || r.width;
    const ch = this.wrap.clientHeight || r.height;
    this.cv.width = Math.max(1, Math.round(cw * d));
    this.cv.height = Math.max(1, Math.round(ch * d));
    /* Pixels per world unit at zoom 1 comes off the WINDOW, not off GX_WORLD.
       Sizing to fit the WORLD would have shrunk every mark, label and pip by
       the same factor the galaxy grew by, which is the map that already
       existed with extra steps.

       MAX, not min: it makes the wrap COVER the window, so the world span on
       screen is never wider than GX_VIEW.w nor taller than GX_VIEW.h whatever
       shape the box is. That is the invariant the world margins are sized
       against -- with min, a 420px-wide window showed 189 world units of
       height, the vertical clamp collapsed, and MEASURED, the top and bottom
       worlds could no longer be centred (56px out). Every world is centreable
       at every window shape only because of this line. */
    this.base = Math.max(0.01, r.width / GX_VIEW.w, r.height / GX_VIEW.h);
    if (this.plane) {
      const pw = GX_WORLD.w * this.base, ph = GX_WORLD.h * this.base;
      this.plane.style.width = pw.toFixed(1) + 'px';
      this.plane.style.height = ph.toFixed(1) + 'px';
      this.plane.style.marginLeft = (-pw / 2).toFixed(1) + 'px';
      this.plane.style.marginTop = (-ph / 2).toFixed(1) + 'px';
    }
  },

  /**
   * Fly the camera to a world point.
   *
   * `el` is the node that has to end up under the middle of the screen, and
   * it is not optional decoration: the map lies on a tilted plane under a CSS
   * perspective, so the analytic centre is several pixels out and only a
   * MEASURED correction closes it. Measuring at the DESTINATION and then
   * animating to the corrected camera means the flight lands exactly, rather
   * than landing near and then twitching.
   */
  focus(x, y, animate, el) {
    if (!this.wrap) return;
    const r0 = this.wrap.getBoundingClientRect();
    /* A hidden screen has no box to measure against, and centring against a
       zero-width one silently lands the map anywhere. Hold the request and let
       the frame loop spend it the moment the screen actually has a size. */
    if (!r0.width || !r0.height) { this._pending = { x, y, el: el || null }; return; }
    /* The world's CENTRE is its dot, not the bounding box of its group: that
       box also holds the contested mark above the world and the star pips
       below it, so centring on it would sit every world a little high. */
    const mark = (el && el.querySelector && el.querySelector('.gx-dot')) || el;
    const from = { x: this.camX, y: this.camY };
    this.camX = x; this.camY = y; this.clamp();
    if (mark && mark.isConnected) {
      this.apply();
      for (let i = 0; i < 3; i++) {
        const r = this.wrap.getBoundingClientRect(), b = mark.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (r.left + r.width / 2);
        const dy = (b.top + b.height / 2) - (r.top + r.height / 2);
        if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) break;
        const s = this.base * this.z;
        this.camX += dx / s; this.camY += dy / s;
        this.clamp(); this.apply();
      }
    }
    const to = { x: this.camX, y: this.camY };
    this.vx = 0; this.vy = 0;
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.fly = null; this.apply(); return;
    }
    this.camX = from.x; this.camY = from.y; this.apply();
    this.fly = { from, to, t0: performance.now() };
  },

  /**
   * Where the player is standing, and the only thing RECENTRE and Home mean.
   * The camera moves when the anchor CHANGES, never on a bare re-render --
   * the campaign map re-renders on every click, and a camera that re-centres
   * each time is the "cheap and buggy" note 19.3 is about.
   */
  setAnchor(x, y, id, el) {
    this.anchor = { x, y, el: el || null };
    if (this._anchorId === id && this._anchorKey === this.key) return;
    this._anchorId = id; this._anchorKey = this.key;
    this.focus(x, y, true, el);
  },

  home() {
    if (this.anchor) this.focus(this.anchor.x, this.anchor.y, true, this.anchor.el);
    else this.focus(GX_WORLD.x + GX_WORLD.w / 2, GX_WORLD.y + GX_WORLD.h / 2, true, null);
  },

  /** Pan only as far as it takes to bring a node inside the window. What a
      keyboard needs the moment the map outgrew the screen: focus without a pan
      puts the caret on something the player cannot see. */
  bring(el, animate) {
    if (!this.wrap || !el || !el.isConnected) return;
    const r = this.wrap.getBoundingClientRect(), b = el.getBoundingClientRect();
    if (!r.width) return;
    const pad = Math.min(110, r.width * 0.14);
    let dx = 0, dy = 0;
    if (b.left < r.left + pad) dx = b.left - (r.left + pad);
    else if (b.right > r.right - pad) dx = b.right - (r.right - pad);
    if (b.top < r.top + pad) dy = b.top - (r.top + pad);
    else if (b.bottom > r.bottom - pad) dy = b.bottom - (r.bottom - pad);
    if (!dx && !dy) return;
    const s = this.base * this.z;
    this.focus(this.camX + dx / s, this.camY + dy / s, animate !== false, el);
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
      /* The window can change size without the WINDOW resizing: opening the
         screen, the sidebar reflowing, a font arriving. The plane is sized in
         pixels off this box, so a stale box is a map drawn at the wrong scale
         -- and a box that was zero when the map mounted is a map that never
         centred on anything at all. */
      const bw = this.wrap.clientWidth, bh = this.wrap.clientHeight;
      if (bw && bh && (bw !== this._bw || bh !== this._bh)) {
        this._bw = bw; this._bh = bh;
        this.resize(); this.clamp(); this.apply();
      }
      if (this._pending && bw && bh) {
        const p = this._pending; this._pending = null;
        this.focus(p.x, p.y, true, p.el);
      }
      if (this.fly) {
        const k = Math.min(1, (t - this.fly.t0) / GX_FLY_MS);
        /* easeInOutCubic: it leaves and arrives slowly, which is what makes a
           long pan read as travel rather than as a cut. */
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.camX = this.fly.from.x + (this.fly.to.x - this.fly.from.x) * e;
        this.camY = this.fly.from.y + (this.fly.to.y - this.fly.from.y) * e;
        this.clamp(); this.apply();
        if (k >= 1) this.fly = null;
      } else if (!this.dragging && (Math.abs(this.vx) > 0.2 || Math.abs(this.vy) > 0.2)) {
        /* Momentum after release, with a firm decay so it settles quickly. */
        this.camX += this.vx * dt; this.camY += this.vy * dt;
        const k = Math.pow(GX_GLIDE_DECAY, dt);
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
    const { ctx, cv } = this;
    if (!ctx || !cv.width) return;
    /* A hidden screen reports a zero-width box and the parallax below divides
       by it, which puts NaN into every star position for good. */
    const cw = this.wrap.clientWidth, ch = this.wrap.clientHeight;
    if (!cw || !ch) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    /* The plane's own screen offset, so the parallax is driven by exactly what
       the player sees the map do rather than by a second copy of the sum. */
    const s = this.base * this.z;
    const px = (GX_WORLD.x + GX_WORLD.w / 2 - this.camX) * s;
    const py = (GX_WORLD.y + GX_WORLD.h / 2 - this.camY) * s;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const st of this.stars) {
      /* Parallax: a star at depth d moves d of the plane's pan. */
      let x = (st.u * W + px * st.depth * (W / cw)) % W;
      let y = (st.v * H + py * st.depth * (H / ch)) % H;
      if (x < 0) x += W; if (y < 0) y += H;
      const tw = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * st.tw + st.u * 9);
      ctx.fillStyle = `hsla(${st.hue}, 88%, ${58 + 18 * tw}%, ${(0.18 + 0.42 * tw) * (0.4 + st.depth)})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, st.r * (W / 1400) * (0.85 + 0.3 * tw)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
