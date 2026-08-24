/* ═══════════════════════════════════════════════════════════════════════
   THE DUEL RELAY — two humans, two clients, one battle.

   WHY THIS SHAPE. The house rule is no external libraries, ever, and the game
   must run offline from one inlined HTML file. That rules out every signalling
   service, SDK and matchmaking backend there is. It rules IN the browser's own
   APIs, and of those BroadcastChannel is the only one that needs no third
   party at all: two tabs or two windows of the same origin, on one machine,
   talking directly, offline, with no setup. So that is what ships — a duel
   between two windows that genuinely works, rather than an internet mode that
   genuinely does not. Everything above the wire is transport-agnostic (see
   Net.attach) so a hand-signalled RTCDataChannel can be dropped underneath it
   later without a line of the lockstep below changing.

   HOW AGREEMENT IS GUARANTEED. The engine already runs a fixed 1/60 step,
   which is what makes lockstep possible at all; determinism is NOT free on top
   of that, because Math.random is called throughout the simulation. Three
   things close the gap, and each is measured by tools/multiplayer_test.js
   rather than asserted here:

     1. THE SIM OWNS ITS OWN RANDOM STREAM. Math.random is replaced by a seeded
        generator for exactly the duration of Game.step (and Game.start), and
        re-seeded from (matchSeed, tick) at the top of EVERY step. A continuous
        stream would have to survive a whole match without one stray draw; a
        per-tick stream only has to survive 16ms, which is short enough to
        enumerate exhaustively and prove.
     2. COSMETIC DRAWS ARE OFF THE SIM STREAM. Some forty branches in the
        engine read `=== viewSide`, and two duellists do not share a viewSide,
        so anything rolling dice behind such a branch would consume a different
        number of draws on each client and the boards would part within a
        second. Every one of those branches was audited: they reach randomness
        only through Sound.play, spawnBurst, spawnExplosion, spawnImplosion and
        addFloater, all wrapped here to run on the native generator. The single
        exception was one open-coded roll in Game.applyElement, and that is the
        one-line reorder this patch makes to js/game.js.
     3. THE RIVAL BRAIN IS OFF. Both seats are human, so Game.brains is emptied
        — a duel has nothing for the machine to decide.

   WHAT CROSSES THE WIRE. Commands, not state. Every player action becomes a
   small record, scheduled NET_INPUT_DELAY turns ahead, and executed on both
   clients on the same tick. The send/muster/reanimate loop is the whole point
   of this game's PvP and it crosses exactly like a tower does: Game.muster is
   a command like any other, and reanimation is simulation, so it needs no
   message at all.
   ═══════════════════════════════════════════════════════════════════════ */

/* These belong in js/config.js by house rule. They are here because config.js
   is shared with three other lanes this round and a NET_ block appended there
   would collide; move them across when the round closes. */

/* One channel for the whole game, versioned: a protocol change must refuse to
   half-link an old window to a new one rather than desync silently. */
const NET_CHANNEL = 'cosmic-conquest-duel/1';
const NET_PROTOCOL = 1;
/* A turn is six ticks — 100ms at 1x. Smaller windows stall constantly the
   moment one browser deprioritises anything; larger ones are felt as lag. */
const NET_TURN_TICKS = 6;
/* Two turns of scheduling headroom. One leaves no slack at all: a packet a
   frame late then stalls the peer on every single turn. */
const NET_INPUT_DELAY = 2;
/* Advertising cadence for an open table — fast enough that a second window
   opening the lobby sees it within a blink. */
const NET_ADVERT_MS = 900;
const NET_HEARTBEAT_MS = 700;
/* Silence longer than this is a closed window. Seven heartbeats is generous
   enough that a tab briefly throttled to 1Hz is not evicted mid-duel. */
const NET_PEER_TIMEOUT_MS = 5000;
/* How long a stall may last before the waiting player is told why the board
   stopped. Under this it is invisible, and saying anything would be noise. */
const NET_STALL_NOTICE_MS = 450;
/* Fixed-point scale for the agreement fingerprint. Positions compare to
   1/1024 px: fine enough to catch a real divergence within a few ticks,
   coarse enough that the fingerprint is never itself the false alarm. */
const NET_SUM_SCALE = 1024;
/* One authored difficulty for every duel, so neither commander brings a
   different purse or a different life total to the same board. */
const NET_DUEL_DIFFICULTY = 'contested';

const Net = {

  /* ── state ─────────────────────────────────────────────────────────── */

  supported: (typeof BroadcastChannel === 'function'),
  ch: null,
  id: null,
  name: 'COMMANDER',
  /* idle | hosting | joining | linked | playing | lost */
  phase: 'idle',
  peer: null,              // { id, name }
  table: null,             // the world this table is fought over
  tables: [],              // open tables seen in the lobby
  seat: 0,                 // THIS client's seat in the simulation
  cfg: null,               // the agreed match contract
  live: false,             // a duel simulation is running
  onLobby: null,           // UI hook: the table list changed
  onStatus: null,          // UI hook: a line worth showing changed

  /* lockstep */
  tick: 0, turn: 0, tickInTurn: 0,
  queued: [], inbox: null, sums: null,
  stallSince: 0, stalled: false, desync: null,
  lastHeard: 0, lastBeat: 0, lastAdvert: 0,
  offers: [null, null],    // a parked draft offer per seat

  /* ── 1. transport ──────────────────────────────────────────────────── */

  /** Open the channel. Safe to call repeatedly. */
  open() {
    if (!this.supported || this.ch) return this.supported;
    this.id = 'c' + Math.random().toString(36).slice(2, 10);
    this.ch = new BroadcastChannel(NET_CHANNEL);
    this.ch.onmessage = ev => { try { this.receive(ev.data); } catch (e) { console.error('[net]', e); } };
    /* A window closing mid-duel must not leave the other one waiting out the
       full timeout in front of a frozen board. */
    window.addEventListener('beforeunload', () => this.post({ t: 'bye' }));
    if (!this._pump) this._pump = setInterval(() => this.tickWall(), 250);
    return true;
  },

  /**
   * The seam a second transport hangs off. Anything with postMessage(msg) and
   * an onmessage callback is a relay as far as every line below here is
   * concerned — a hand-signalled RTCDataChannel would attach here and need no
   * other change in the file.
   */
  attach(transport) {
    this.ch = transport;
    this.id = this.id || ('c' + Math.random().toString(36).slice(2, 10));
    transport.onmessage = ev => { try { this.receive(ev.data); } catch (e) { console.error('[net]', e); } };
    if (!this._pump) this._pump = setInterval(() => this.tickWall(), 250);
    return true;
  },

  post(msg) {
    if (!this.ch) return;
    msg.v = NET_PROTOCOL; msg.from = this.id;
    this.ch.postMessage(msg);
  },

  /** Wall-clock housekeeping: adverts, heartbeats, a peer that stopped. */
  tickWall() {
    const now = Date.now();
    if (this.phase === 'hosting' && now - this.lastAdvert > NET_ADVERT_MS) {
      this.lastAdvert = now;
      this.post({ t: 'table', name: this.name, world: this.table });
    }
    if ((this.phase === 'linked' || this.phase === 'playing') && now - this.lastBeat > NET_HEARTBEAT_MS) {
      this.lastBeat = now;
      this.post({ t: 'beat', to: this.peer && this.peer.id });
    }
    if ((this.phase === 'linked' || this.phase === 'playing') &&
        now - this.lastHeard > NET_PEER_TIMEOUT_MS) this.dropPeer('timeout');
    /* Tables go stale the moment the window advertising one closes. */
    const before = this.tables.length;
    this.tables = this.tables.filter(t => now - t.seen < NET_ADVERT_MS * 4);
    if (this.tables.length !== before && this.onLobby) this.onLobby();
  },

  receive(m) {
    if (!m || m.from === this.id) return;
    if (m.v !== NET_PROTOCOL) return;
    if (m.to && m.to !== this.id) return;
    if (this.peer && m.from === this.peer.id) this.lastHeard = Date.now();

    switch (m.t) {
      case 'hello':                                   // a window opened the lobby
        if (this.phase === 'hosting')
          this.post({ t: 'table', to: m.from, name: this.name, world: this.table });
        break;

      case 'table': {
        const i = this.tables.findIndex(t => t.id === m.from);
        const row = { id: m.from, name: m.name, world: m.world, seen: Date.now() };
        if (i < 0) this.tables.push(row); else this.tables[i] = row;
        if (this.onLobby) this.onLobby();
        break;
      }

      case 'closed':
        this.tables = this.tables.filter(t => t.id !== m.from);
        if (this.onLobby) this.onLobby();
        break;

      case 'join':
        if (this.phase !== 'hosting') { this.post({ t: 'busy', to: m.from }); break; }
        this.peer = { id: m.from, name: m.name };
        this.lastHeard = Date.now();
        this.cfg = this.buildConfig(this.localProfile(), m.profile);
        this.phase = 'linked';
        this.post({ t: 'accept', to: m.from, name: this.name, cfg: this.cfg });
        this.post({ t: 'closed' });
        this.beginMatch(0);
        break;

      case 'busy':
        this.phase = 'idle';
        this.status('That table is no longer open.');
        break;

      case 'accept':
        if (this.phase !== 'joining') break;
        this.peer = { id: m.from, name: m.name };
        this.lastHeard = Date.now();
        this.cfg = m.cfg;
        this.phase = 'linked';
        this.beginMatch(1);
        break;

      case 'pkt': {                                   // a sealed turn of input
        if (!this.inbox) break;
        (this.inbox[m.turn] = this.inbox[m.turn] || [null, null])[m.seat] = m.cmds || [];
        if (m.sum !== undefined && m.sum !== null) {
          (this.sums[m.sumTurn] = this.sums[m.sumTurn] || [null, null])[m.seat] = m.sum;
          this.checkSum(m.sumTurn);
        }
        break;
      }

      case 'oob':                                     // taken while the sim is halted
        this.applyOob(m.cmd);
        break;

      case 'ctl':
        this.applyCtl(m.ctl, m.value, true);
        break;

      case 'quit':                                    // the other commander conceded
        if (this.live) { this._conceded = true; Game.endMatch(); }
        break;

      case 'done':
        /* Their board resolved. Lockstep keeps the two within a couple of
           turns of each other, so this can arrive while this client is still
           stepping the last of them -- which is a finished duel, not a lost
           relay, and must not raise the void notice. */
        this._peerDone = true;
        break;

      case 'bye':
        if (this.peer && m.from === this.peer.id && !this._peerDone) this.dropPeer('closed');
        else {
          this.tables = this.tables.filter(t => t.id !== m.from);
          if (this.onLobby) this.onLobby();
        }
        break;
    }
  },

  status(text) { this._status = text; if (this.onStatus) this.onStatus(text); },

  /* ── 2. lobby ──────────────────────────────────────────────────────── */

  enterLobby(name) {
    if (!this.open()) return false;
    this.name = String(name || this.profileName()).toUpperCase().slice(0, 14);
    this.tables = [];
    if (this.phase === 'lost') this.phase = 'idle';
    this.post({ t: 'hello' });
    return true;
  },

  profileName() {
    Meta.load();
    return (Meta._root && Meta._root.active) || 'COMMANDER';
  },

  host(world) {
    if (!this.open()) return false;
    this.table = { id: world.id, name: world.name, map: world.map, kind: world.kind,
                   owner: world.owner, arena: world.arena || null, contested: !!world.contested };
    this.phase = 'hosting';
    this.lastAdvert = 0;
    this.post({ t: 'table', name: this.name, world: this.table });
    return true;
  },

  join(tableId) {
    if (!this.open()) return false;
    const row = this.tables.find(t => t.id === tableId);
    if (!row) return false;
    this.phase = 'joining';
    this.table = row.world;
    this.post({ t: 'join', to: tableId, name: this.name, profile: this.localProfile() });
    return true;
  },

  cancel() {
    if (this.phase === 'hosting') this.post({ t: 'closed' });
    this.phase = 'idle'; this.table = null; this.peer = null;
  },

  /* ── 3. the match contract ─────────────────────────────────────────── */

  /** The commander this client will field, under the same rule UI.deploy uses. */
  localCommander() {
    const picked = UI.sel && UI.sel.commander;
    if (picked && Meta.isCommanderUnlocked(picked)) return picked;
    const free = freeCommanderOf(Meta.faction() || 'human');
    return Meta.isCommanderUnlocked(free) ? free : 'cadre';
  },

  localLoadout() {
    const owned = Meta.unlockedTowers();
    const sel = (UI.sel && UI.sel.loadout) || [];
    const kept = sel.filter(id => owned.indexOf(id) >= 0);
    return (kept.length ? kept : owned).slice(0, LOADOUT_SIZE);
  },

  /**
   * Everything about this commander the OTHER client needs to build an
   * identical seat. Ids only: both clients hold the same COMMANDERS, TOWER and
   * talent tables, so sending anything but ids would be sending the same data
   * twice and inviting the two copies to disagree.
   */
  localProfile() {
    const cmdId = this.localCommander();
    const cmd = COMMANDERS.find(c => c.id === cmdId) || COMMANDERS[0];
    const loadout = this.localLoadout();
    const talents = {};
    for (const id of loadout) talents[id] = Meta.talentMods(id).map(t => t.id);
    return {
      name: this.name,
      faction: Meta.faction() || cmd.faction || 'human',
      commander: cmd.id,
      loadout: loadout,
      muster: Meta.musterLoadout().slice(),
      talents: talents,
      prestige: Meta.prestigeOf(cmd.id) || 0,
      tech: cmd.tech.filter(t => Meta.isUnlocked(cmd.id, t.id)).map(t => t.id),
      second: !!Meta.hasSecondAbility(cmd.id)
    };
  },

  /** The host authors the match; the guest receives it verbatim. */
  buildConfig(a, b) {
    return {
      seed: ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0),
      world: this.table,
      map: this.table.map,
      difficulty: NET_DUEL_DIFFICULTY,
      seats: [a, b]
    };
  },

  /* ── 4. determinism ────────────────────────────────────────────────── */

  /* mulberry32: thirty-two bits of state and nothing but Math.imul, which is
     exactly why it is here — identical arithmetic in every engine. */
  _rngState: 0,
  _native: null,
  _isolate: true,          // the test flips this off to measure the effect

  _hash(a, b) {
    let h = (a ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ ((b + 0x85ebca6b) | 0), 0xcc9e2d51) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return Math.imul(h, 0x1b873593) >>> 0;
  },

  _draw() {
    const a = (Net._rngState = (Net._rngState + 0x6D2B79F5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  /** Seed the simulation stream for one tick and take the wheel. */
  enterSim(tick) {
    this._rngState = this._hash(this.cfg ? this.cfg.seed : 1, tick);
    if (!this._native) this._native = Math.random;
    Math.random = this._draw;
  },
  exitSim() { if (this._native) Math.random = this._native; },

  /**
   * Run a cosmetic effect on the NATIVE generator. A particle burst behind an
   * `=== viewSide` branch would otherwise draw from the simulation stream on
   * one client and not on the other. Nothing in here may touch simulation
   * state — that is the whole contract, and the audit behind it is in the
   * header of this file.
   */
  fx(fn, self, args) {
    if (!this._isolate || !this._native || Math.random === this._native) return fn.apply(self, args);
    const sim = Math.random;
    Math.random = this._native;
    try { return fn.apply(self, args); } finally { Math.random = sim; }
  },

  /* ── 5. the seat lens ──────────────────────────────────────────────── */

  /* THE PROBLEM THIS SOLVES. Every screen in js/ui.js reads Game.sides[0] as
     "you" and Game.sides[1] as "the rival", and every button hands the engine
     a literal 0. That is right for singleplayer and right for whichever
     duellist holds seat 0 — and a lie to the other one, whose lives, gold,
     arsenal and upgrade buttons would every one of them describe an opponent.
     The simulation cannot be re-seated to fix it: seat order decides tower
     update order, which decides the order floating-point damage accumulates
     in, which decides agreement. So the relabelling happens at the
     PRESENTATION boundary instead. While the lens is on, index 0 means "the
     commander in front of this screen". It is suspended for the whole of
     step, start, draw and command execution — which is every line of engine
     code that means a real seat. */

  lens: { on: false, pi: [0, 1] },
  _realSides: [],
  _viewSides: [],

  installLens() {
    if (this._lensInstalled) return;
    this._lensInstalled = true;
    const N = this;
    N._realSides = Game.sides;
    N.rebuildView();
    Object.defineProperty(Game, 'sides', {
      configurable: true,
      get() {
        if (!(N.live && N.lens.on)) return N._realSides;
        /* Game.start assigns the array and then PUSHES the remaining seats
           onto it, so a view built once at assignment is a seat short and
           every screen reads undefined.gold. Length is the only thing that
           can go stale -- Side objects never move once the match is up. */
        if (N._viewSides.length !== N._realSides.length) N.rebuildView();
        return N._viewSides;
      },
      set(v) { N._realSides = v; N.rebuildView(); }
    });
  },

  rebuildView() {
    const pi = this.lens.pi;
    this._viewSides = this._realSides.map((_, i) => this._realSides[pi[i] === undefined ? i : pi[i]]);
  },

  /** Point index 0 at `seat`. With two seats the permutation is its own inverse. */
  setSeatView(seat) {
    this.lens.pi = this._realSides.map((_, i) => (i === 0 ? seat : (i === seat ? 0 : i)));
    this.rebuildView();
  },

  seatIn(s) { return (this.live && this.lens.on && typeof s === 'number') ? this.lens.pi[s] : s; },

  /** Suspend for the duration of an engine call; restored on the way out. */
  suspend(fn, self, args) {
    const was = this.lens.on;
    this.lens.on = false;
    try { return fn.apply(self, args); } finally { this.lens.on = was; }
  },

  /* Methods the UI and the input layer call with a seat index. The lens maps
     the index in, suspends itself for the call, and maps any seat index out. */
  SEAT_ARG: {
    ownsTile: [0], canBuild: [0], canAim: [0], canClear: [0],
    baseLevelCost: [0], baseLevelCostAt: [0], towerCost: [0], towerLifeCost: [0],
    canAffordBuild: [0], bidCost: [0], previewGold: [0],
    musterTiers: [0], musterCost: [0], musterGain: [0], canMuster: [0], musterHpMul: [0, 1],
    clearCostAt: [0], clearCostNow: [0], clearLimit: [0], enrageCost: [0]
  },
  SEAT_RET: { rivalOf: 'i', musterVictims: 'a', maelstromVictim: 'i' },

  /* ── 6. engine hooks ───────────────────────────────────────────────── */

  _hooked: false,
  _orig: {},
  _run: {},

  hook() {
    if (this._hooked) return;
    this._hooked = true;
    const N = this;
    const O = this._orig;

    /* -- cosmetic isolation: everything a `=== viewSide` branch can reach -- */
    for (const k of ['spawnBurst', 'spawnExplosion', 'spawnImplosion', 'addFloater']) {
      const orig = Game[k]; O['fx_' + k] = orig;
      Game[k] = function () { return N.fx(orig, this, arguments); };
    }
    /* Sound reaches a noise buffer that fills a whole Float32Array from
       Math.random, so a match begun with music off on one client and on on
       the other would start from two different stream positions. */
    for (const k of ['play', 'resume', 'startMusic', 'stopMusic', 'setIntensity']) {
      if (typeof Sound[k] !== 'function') continue;
      const orig = Sound[k]; O['snd_' + k] = orig;
      Sound[k] = function () { return N.fx(orig, this, arguments); };
    }

    /* -- the simulation window -- */
    O.step = Game.step;
    Game.step = function (dt) {
      if (!N.live) return O.step.call(this, dt);
      return N.stepLockstep(dt);
    };
    O.start = Game.start;
    Game.start = function (opts) {
      if (!N._starting) return O.start.call(this, opts);
      N.enterSim(0);
      const was = N.lens.on; N.lens.on = false;
      try { return O.start.call(this, opts); } finally { N.lens.on = was; N.exitSim(); }
    };
    /* draw and the baked background mean real seats from end to end. */
    for (const k of ['draw', 'renderBackground']) {
      const orig = Game[k]; O['sus_' + k] = orig;
      Game[k] = function () { return N.live ? N.suspend(orig, this, arguments) : orig.apply(this, arguments); };
    }

    /* -- the lens over every seat-indexed entry point -- */
    for (const name in this.SEAT_ARG) {
      const idx = this.SEAT_ARG[name], orig = Game[name];
      if (typeof orig !== 'function') continue;
      O['seat_' + name] = orig;
      Game[name] = function () {
        if (!N.live) return orig.apply(this, arguments);
        const a = Array.prototype.slice.call(arguments);
        if (N.lens.on) for (const i of idx) a[i] = N.seatIn(a[i] === undefined && i === 0 ? 0 : a[i]);
        return N.suspend(orig, this, a);
      };
    }
    for (const name in this.SEAT_RET) {
      const kind = this.SEAT_RET[name], orig = Game[name];
      if (typeof orig !== 'function') continue;
      O['ret_' + name] = orig;
      Game[name] = function () {
        if (!N.live) return orig.apply(this, arguments);
        const on = N.lens.on;
        const a = Array.prototype.slice.call(arguments);
        if (on) a[0] = N.seatIn(a[0]);
        const out = N.suspend(orig, this, a);
        if (!on) return out;
        const back = v => (typeof v === 'number' && v >= 0 ? N.lens.pi[v] : v);
        return kind === 'a' ? out.map(back) : back(out);
      };
    }

    /* -- a tower carries a real seat index, and the inspector reads it as
          "mine". Backed by _side so the engine still sees the truth. -- */
    O.towerSide = Object.getOwnPropertyDescriptor(Tower.prototype, 'side');
    Object.defineProperty(Tower.prototype, 'side', {
      configurable: true,
      get() { return (N.live && N.lens.on) ? N.lens.pi[this._side] : this._side; },
      set(v) { this._side = v; }
    });

    /* -- UI code always means "this client's commander" at index 0, even when
          the engine calls it from inside a suspended step. -- */
    for (const k in UI) {
      if (typeof UI[k] !== 'function') continue;
      const orig = UI[k]; O['ui_' + k] = orig;
      UI[k] = function () {
        if (!N.live) return orig.apply(this, arguments);
        const was = N.lens.on; N.lens.on = true;
        try { return orig.apply(this, arguments); } finally { N.lens.on = was; }
      };
    }

    this.hookCommands();
    this.installLens();
  },

  hookCommands() {
    const N = this, O = this._orig;

    /** Wrap a mutating entry point so a local call becomes a scheduled command. */
    const cmd = (name, make, run) => {
      const orig = Game[name];
      O['cmd_' + name] = orig;
      N._run[name] = run;
      Game[name] = function () {
        if (!N.live || N._replaying) return orig.apply(this, arguments);
        const c = make.apply(null, arguments);
        if (!c) return false;
        c.seat = N.seat;
        if (c.side !== undefined) c.side = N.seat;
        N.issue(c);
        return true;
      };
    };

    cmd('build', (side, type, gx, gy) => ({ k: 'b', side: N.seatIn(side), type, gx, gy }),
        c => O.cmd_build.call(Game, c.seat, c.type, c.gx, c.gy));
    cmd('muster', (side, tier) => ({ k: 'm', side: N.seatIn(side), tier: (tier && tier.id) || tier }),
        c => O.cmd_muster.call(Game, c.seat, c.tier));
    cmd('buyBaseLevel', side => ({ k: 'l', side: N.seatIn(side) }),
        c => O.cmd_buyBaseLevel.call(Game, c.seat));
    cmd('buyEnrage', side => ({ k: 'e', side: N.seatIn(side === undefined ? 0 : side) }),
        c => O.cmd_buyEnrage.call(Game, c.seat));
    cmd('clearTerrain', (side, gx, gy) => ({ k: 'c', side: N.seatIn(side), gx, gy }),
        c => O.cmd_clearTerrain.call(Game, c.seat, c.gx, c.gy));
    /* Towers are addressed by the tile they stand on. A tile is unique on the
       board and survives the wire; an object reference does neither. */
    cmd('upgrade', (t, branch) => (t ? { k: 'u', gx: t.gx, gy: t.gy,
                                         branch: (branch === null || branch === undefined) ? -1 : branch } : null),
        c => { const t = Game.towerAt(c.gx, c.gy);
               if (t && t._side === c.seat) O.cmd_upgrade.call(Game, t, c.branch < 0 ? null : c.branch); });
    cmd('sell', t => (t ? { k: 's', gx: t.gx, gy: t.gy } : null),
        c => { const t = Game.towerAt(c.gx, c.gy);
               if (t && t._side === c.seat) O.cmd_sell.call(Game, t); });
    cmd('relocate', (t, gx, gy) => (t ? { k: 'r', gx: t.gx, gy: t.gy, tx: gx, ty: gy } : null),
        c => { const t = Game.towerAt(c.gx, c.gy);
               if (t && t._side === c.seat) O.cmd_relocate.call(Game, t, c.tx, c.ty); });

    /* Abilities enter through one global function for both the aimed and the
       unaimed kind, so that is the only place they have to be caught. */
    O.useAbility = window.useAbility;
    window.useAbility = function (side, game, i, at) {
      if (!N.live || N._replaying) return O.useAbility(side, game, i, at);
      if (!side || side.index !== N.seat) return false;
      N.issue({ k: 'a', seat: N.seat, i: i, gx: at ? at.gx : -1, gy: at ? at.gy : -1 });
      return true;
    };
    N._run.ability = c => O.useAbility(N._realSides[c.seat], Game, c.i,
                                       c.gx < 0 ? undefined : { gx: c.gx, gy: c.gy });

    /* NO DOSSIER STOPS A DUEL. A never-before-seen enemy pauses the war for its
       card, and that card is decided by THIS machine's save file: two windows
       with different save files would stop the board at different moments, and
       the commander who has met everything cannot be asked to sit and wait
       while the other one reads. The sighting is still banked -- the codex
       fills up exactly as it would -- but it never interrupts. */
    O.markSeen = Meta.markSeen;
    Meta.markSeen = function (type) {
      const first = O.markSeen.call(this, type);
      return N.live ? false : first;
    };

    /* RUSH IS OFF IN A DUEL. rushWave pays the rusher a bonus and every other
       seat a fixed fraction of it — a ratio calibrated against a machine that
       does not care when the wave starts. Between two people it is a purchase
       the other cannot answer, so the button greys out rather than shipping an
       asymmetry with no reply to it. */
    O.canRush = Game.canRush;
    Game.canRush = function () { return N.live ? false : O.canRush.call(this); };

    /* THE DRAFT IS PER SEAT, ON THE ENGINE'S OWN CADENCE. onWaveSpawned already
       draws a separate offer for every seat -- seat 0 through offerChoice,
       every other seat through its brain -- from the seeded stream inside the
       same step, so both clients compute both offers and agree on them with no
       message at all. All that changes here is who answers: each offer waits
       for the person holding that seat. */
    O.offerChoice = Game.offerChoice;
    Game.offerChoice = function () {
      if (!N.live) return O.offerChoice.call(this);
      N.pendDraft(0, Game.drawMods(N._realSides[0]));
    };
    O.takeMod = Game.takeMod;
    Game.takeMod = function (mod, seat) {
      if (!N.live || N._replaying) return O.takeMod.call(this, mod, seat);
      const mine = N.offers[N.seat];
      const i = mine ? mine.indexOf(mod) : -1;
      if (i < 0) return;
      const c = { k: 'd', seat: N.seat, pick: i };
      N.post({ t: 'oob', to: N.peer && N.peer.id, cmd: c });
      N.applyOob(c);
    };

    /* ESCALATIONS ARE DEALT, NOT DRAFTED. The engine prices that choice in the
       RIVAL's draft — take the severe card and your own draft widens, duck it
       and theirs does. That bid is meaningful against a machine and merely
       unfair between two people, since only one of them can hold the modal.
       So the card is drawn from the shared stream, taken through the engine's
       own path (which is what keeps the refused pile banked), and the bid on
       either side of it is refunded. */
    O.addEnemyMod = Game.addEnemyMod;
    Game.addEnemyMod = function () {
      if (!N.live) return O.addEnemyMod.call(this);
      const shown = UI.showEscalationChoice;
      UI.showEscalationChoice = function () {};
      try { O.addEnemyMod.call(this); } finally { UI.showEscalationChoice = shown; }
      const offer = Game.pendingEscalation;
      if (!offer || !offer.length) return;
      Game.takeEscalation(offer[Math.floor(Math.random() * offer.length)]);
      Game.escalationBoon = 0;
      for (const S of N._realSides) S.draftBoon = 0;
    };

    /* Speed and pause are shared controls. One client racing ahead only stalls
       against the other, and a private pause would freeze a peer who cannot
       see why. Neither changes anything the simulation computes. */
    for (const key of ['speed', 'paused']) {
      let v = Game[key];
      Object.defineProperty(Game, key, {
        configurable: true,
        get() { return v; },
        set(nv) {
          const changed = v !== nv;
          v = nv;
          if (N.live && changed && !N._applyingCtl)
            N.post({ t: 'ctl', to: N.peer && N.peer.id, ctl: key, value: nv });
        }
      });
    }

    /* The end of a duel is decided for the commander in front of THIS screen,
       and the run it pays is that commander's own. The lens on for the whole
       of endMatch is what makes `sides[0]` the local seat inside xpForRun and
       the tower-mastery loop; `_skirmish` is what keeps the campaign ledger
       out of it entirely. */
    O.endMatch = Game.endMatch;
    Game.endMatch = function (wonOverride, abandon) {
      if (!N.live) return O.endMatch.call(this, wonOverride, abandon);
      const me = N._realSides[N.seat];
      /* THE RESULT BELONGS TO THIS SEAT. loseLives resolves a two-sided board
         with `endMatch(side === 0 ? false : undefined)` -- seat 0's question,
         and the right question on exactly one of the two clients. The seat in
         front of this screen is still standing or it is not, and that is the
         whole of it; a concession from the other window is the one result the
         board itself cannot show. */
      const won = N._conceded ? true : (abandon ? false : me.alive);
      N._conceded = false;
      if (abandon) N.post({ t: 'quit', to: N.peer && N.peer.id });
      const was = N.lens.on; N.lens.on = true;
      try { return O.endMatch.call(this, won, abandon); }
      finally { N.lens.on = was; N.finish(); }
    };
  },

  /* ── 7. lockstep ───────────────────────────────────────────────────── */

  issue(c) {
    this.queued.push(c);
    /* The only local feedback available before the command lands. It is real,
       it is simply two turns from happening. */
    Sound.play('click');
  },

  stepLockstep(dt) {
    if (this.desync) return;
    if (this.tickInTurn === 0 && !this.turnReady(this.turn)) {
      if (!this.stalled) { this.stalled = true; this.stallSince = Date.now(); }
      if (Date.now() - this.stallSince > NET_STALL_NOTICE_MS) this.showStall(true);
      return;
    }
    if (this.stalled) { this.stalled = false; this.showStall(false); }

    /* THE COMMANDS RUN INSIDE THE SEEDED WINDOW, not before it. A muster rolls
       its arrival offsets and its double-send; a level-up rolls its minor
       buff. Executing a turn ahead of enterSim left those on the native
       generator, and the two boards parted the first time anyone bought
       anything -- measured, and the reason this line is where it is. */
    this.enterSim(this.tick);
    const was = this.lens.on; this.lens.on = false;
    try {
      if (this.tickInTurn === 0) this.executeTurn(this.turn);
      this._orig.step.call(Game, dt);
    } finally { this.lens.on = was; this.exitSim(); }

    this.tick++;
    if (++this.tickInTurn >= NET_TURN_TICKS) {
      this.tickInTurn = 0;
      this.turn++;
      this.seal(this.turn + NET_INPUT_DELAY - 1);
    }
  },

  turnReady(t) {
    const p = this.inbox[t];
    return !!(p && p[0] && p[1]);
  },

  /** Ship this client's commands for a future turn, and the agreement
      fingerprint for the turn just finished. */
  seal(forTurn) {
    const cmds = this.queued; this.queued = [];
    (this.inbox[forTurn] = this.inbox[forTurn] || [null, null])[this.seat] = cmds;
    const sumTurn = this.turn - 1;
    const sum = this.fingerprint();
    (this.sums[sumTurn] = this.sums[sumTurn] || [null, null])[this.seat] = sum;
    this.post({ t: 'pkt', to: this.peer && this.peer.id, seat: this.seat,
                turn: forTurn, cmds: cmds, sum: sum, sumTurn: sumTurn });
    this.checkSum(sumTurn);
  },

  /** Both seats' commands for one turn, seat 0 first so the order is agreed. */
  executeTurn(t) {
    const p = this.inbox[t];
    if (!p) return;
    this._replaying = true;
    const was = this.lens.on; this.lens.on = false;
    try {
      for (let s = 0; s < 2; s++) for (const c of (p[s] || [])) this.execute(c, s);
    } finally { this._replaying = false; this.lens.on = was; }
    delete this.inbox[t];
  },

  execute(c, fromSeat) {
    const K = { b: 'build', m: 'muster', l: 'buyBaseLevel', e: 'buyEnrage',
                c: 'clearTerrain', u: 'upgrade', s: 'sell', r: 'relocate', a: 'ability' };
    /* A packet names its own seat; a command inside it may not claim another. */
    c.seat = fromSeat;
    const fn = this._run[K[c.k]];
    if (!fn) return;
    try { fn(c); } catch (e) { console.error('[net] command failed', c, e); }
    /* syncLive inside step redraws the numbers at 8Hz, but the shop and the
       inspector are only rebuilt when something is actually spent. */
    if (c.seat === this.seat) UI.syncAll();
  },

  /* Commands taken while the simulation is HALTED — a draft modal is open, so
     no tick passes on either client. There is no tick to schedule against and
     no ordering question to answer: the two picks apply to different sides, so
     the result is the same whichever lands first. */
  applyOob(c) {
    if (!c || c.k !== 'd') return;
    const offer = this.offers[c.seat];
    const mod = offer && offer[c.pick];
    if (!mod) return;
    this.offers[c.seat] = null;
    this._replaying = true;
    const was = this.lens.on; this.lens.on = false;
    /* A card can roll -- SAPPER CORPS demolishes "the two nearest" tiles, and
       nearest is a tie the engine breaks with a draw. Seeded off the halted
       tick and the seat, so both clients break the tie the same way. */
    this.enterSim(this._hash(this.tick, 0x4d + c.seat));
    try { this._orig.takeMod.call(Game, mod, c.seat); }
    finally { this._replaying = false; this.lens.on = was; this.exitSim(); }
    this.syncDraft();
  },

  /** Park one seat's offer and halt the board until whoever holds it answers. */
  pendDraft(seat, offer) {
    if (!offer || !offer.length) return;
    this.offers[seat] = offer;
    if (seat === this.seat) Sound.play('choice');
    this.syncDraft();
  },

  /* The board is handed back only when EVERY seat has drafted. takeMod sets
     the state to playing on its way out, which is right for one commander and
     wrong for two, so the state is decided here instead. */
  syncDraft() {
    if (!this.offers.filter(Boolean).length) {
      Game.state = 'playing';
      Game.pendingChoice = null;
      UI.hideChoice();
      this.showStall(false);
      return;
    }
    Game.state = 'choosing';
    if (this.offers[this.seat]) {
      this.showStall(false);
      Game.pendingChoice = this.offers[this.seat];
      UI.showChoice(Game.pendingChoice);
    } else {
      UI.hideChoice();
      this.showStall(true);
    }
  },

  /**
   * A seat with a person behind it still needs an object in Game.brains:
   * onWaveSpawned indexes brains[si-1] to deliver that seat's draft, and
   * Game.loop has no try/catch to survive it being missing. This one decides
   * nothing -- it only carries the offer to the commander it belongs to.
   */
  inertBrain(seatIndex) {
    const N = this;
    return {
      side: N._realSides[seatIndex],
      seat: seatIndex,
      think: 0,
      update() {},
      buildSpots() {},
      chooseMod(offer) { N.pendDraft(this.seat, offer); }
    };
  },

  applyCtl(ctl, value, remote) {
    this._applyingCtl = !!remote;
    try { Game[ctl] = value; } finally { this._applyingCtl = false; }
    if (ctl === 'speed')
      document.querySelectorAll('.speed-btn').forEach(x =>
        x.classList.toggle('active', +x.dataset.speed === value));
  },

  /* ── 8. agreement ──────────────────────────────────────────────────── */

  /**
   * A fingerprint of everything the simulation decides and nothing it merely
   * draws. Particles, floaters, beams and banners are deliberately absent —
   * they are ALLOWED to differ between two clients, and folding them in would
   * report every cosmetic difference as a desync.
   */
  fingerprint() {
    let h = 0x811c9dc5;
    const q = v => Math.round((v || 0) * NET_SUM_SCALE) | 0;
    const mix = v => { h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0; };
    mix(Game.wave); mix(this.tick); mix(q(Game.prepTimer)); mix(Game.waveRunning ? 1 : 0);
    mix(Game.spawnQueue.length); mix(Game.projectiles.length); mix(Game.enemyMods.length);
    for (const S of this._realSides) {
      mix(S.gold); mix(S.lives); mix(S.enrage || 0); mix(q(S.musterIncome));
      mix(S.towers.length); mix(S.cleared.size); mix(S.taken.length);
      mix(S.baseLevel || 1); mix(S.stats.sent); mix(S.stats.kills); mix(S.stats.leaked);
      for (const t of S.towers) {
        mix(t.gx); mix(t.gy); mix(t.level); mix(t.asc || 0);
        mix(t.invested || 0); mix(t.kills || 0); mix(q(t.damageDealt));
      }
    }
    for (const e of Game.enemies) {
      mix(q(e.x)); mix(q(e.y)); mix(q(e.hp)); mix(e.hostileTo); mix(e.dead ? 1 : 0);
    }
    return h >>> 0;
  },

  checkSum(t) {
    const s = this.sums[t];
    if (!s || s[0] === null || s[1] === null || s[0] === undefined || s[1] === undefined) return;
    if (s[0] !== s[1] && !this.desync) {
      this.desync = { turn: t, mine: s[this.seat], theirs: s[1 - this.seat] };
      this.showFatal('THE BOARDS HAVE PARTED',
        'The two simulations stopped agreeing at turn ' + t + '. The duel is halted rather ' +
        'than played out on two different boards. Nothing has been recorded.');
    }
    delete this.sums[t];
  },

  /* ── 9. match lifecycle ────────────────────────────────────────────── */

  beginMatch(seat) {
    this.hook();
    this.seat = seat;
    this.tick = 0; this.turn = 0; this.tickInTurn = 0;
    this.queued = []; this.inbox = {}; this.sums = {};
    this.desync = null; this.stalled = false;
    this.offers = [null, null];
    this._peerDone = false; this._conceded = false;
    this.lastHeard = Date.now();
    this.showStall(false);

    /* Both clients hold the first NET_INPUT_DELAY turns open with empty
       packets, or turn zero would wait on input nobody has issued yet. */
    for (let t = 0; t < NET_INPUT_DELAY; t++) {
      this.inbox[t] = [[], []];
      this.post({ t: 'pkt', to: this.peer && this.peer.id, seat: this.seat, turn: t, cmds: [] });
    }

    const cfg = this.cfg;
    this._starting = true;
    this.live = true;
    this.lensProfile(cfg);
    try {
      Game.start({
        skirmish: true,                     // the campaign ledger is never touched
        map: cfg.map,
        difficulty: cfg.difficulty,
        commander: cfg.seats[0].commander,
        faction: cfg.seats[0].faction,
        loadout: cfg.seats[0].loadout.slice(),
        musterLoadout: cfg.seats[0].muster.slice(),
        rival: cfg.seats[1].commander,
        rivalFaction: cfg.seats[1].faction,
        worldKind: cfg.world.kind,
        arena: cfg.world.arena,
        boons: []
      });
    } finally { this._starting = false; this.unlensProfile(); }

    /* What Game.start could only derive from THIS machine's save file is
       replaced, for both seats on both clients, by what the wire agreed. */
    const S = this._realSides;
    for (let i = 0; i < 2; i++) {
      S[i].loadout = cfg.seats[i].loadout.slice();
      Game.setMusterLoadout(i, cfg.seats[i].muster.slice());
      S[i].talentSets = this.talentSetsFor(cfg.seats[i]);
    }
    /* Two commanders and nothing for a machine to decide -- but the brain
       SLOT has to stay, because onWaveSpawned reaches into brains[si-1] to
       hand each rival its draft and Game.loop has no try/catch: an empty
       array froze the battle on the first draft wave. The stand-in never
       builds and never musters; its one job is to carry the offer the engine
       already draws for that seat to the person holding it. */
    Game.brains = Game.sides.slice(1).map(S2 => this.inertBrain(S2.index));
    Game.viewSide = seat;
    this.setSeatView(seat);
    this.lens.on = true;
    this.phase = 'playing';
    /* The lobby modal and the universe map are behind the board now; the
       relay owns the transition because the relay is what decided the match
       had started, and both clients cross at the same moment. */
    const ov = document.getElementById('mv-search');
    if (ov) ov.classList.add('hidden');
    Sound.resume();
    UI.show('screen-game');
    UI.buildShop(); UI.buildAbilityBar(); Game.resize(); UI.syncAll();
    Game.banner('DUEL — ' + ((this.peer && this.peer.name) || 'COMMANDER'), 3,
                FACTIONS[this._realSides[seat].faction].color);
  },

  /** Talent objects rebuilt from ids, so both clients read the same tree. */
  talentSetsFor(p) {
    const out = {};
    for (const id of p.loadout) {
      const def = Meta.talentDefOf(id);
      const ids = (p.talents && p.talents[id]) || [];
      out[id] = def ? ids.map(tid => def.talents.find(t => t.id === tid)).filter(Boolean) : [];
    }
    return out;
  },

  /**
   * Game.start builds a seat out of THIS machine's save file. For the duration
   * of one start every profile read is answered from the wire instead, for
   * whichever seat is being built — which Meta.applyTo names in its own first
   * argument. Without this the guest's client would hand the host's seat the
   * guest's technology, and the two boards would begin life disagreeing.
   */
  lensProfile(cfg) {
    const M = Meta, keep = this._metaKeep = {};
    let cur = null;
    const seatOf = side => cfg.seats[(side && side.index === 1) ? 1 : 0];

    for (const k of ['faction', 'prestigeOf', 'isUnlocked', 'hasSecondAbility', 'campaign'])
      keep[k] = M[k];
    M.faction = () => (cur ? cur.faction : keep.faction.call(M));
    M.prestigeOf = id => (cur ? cur.prestige : keep.prestigeOf.call(M, id));
    M.isUnlocked = (cid, tid) => (cur ? cur.tech.indexOf(tid) >= 0 : keep.isUnlocked.call(M, cid, tid));
    M.hasSecondAbility = id => (cur ? !!cur.second : keep.hasSecondAbility.call(M, id));
    M.campaign = () => null;                        // a duel is not a campaign run

    keep.applyTo = M.applyTo;
    M.applyTo = function (side, cmdId) {
      const p = seatOf(side); cur = p;
      try { return keep.applyTo.call(M, side, p ? p.commander : cmdId); } finally { cur = null; }
    };
    /* Seat 1 is a person, not a rival brain: it is built by exactly the code
       that builds seat 0, out of its own commander's own technology. This is
       also what lets both duellists field the SAME commander — start()
       reassigns a mirrored rival, and the wire overrules it. */
    keep.applyToAI = M.applyToAI;
    M.applyToAI = function (side, cmdId, depth) {
      if (!side || side.index > 1) return keep.applyToAI.call(M, side, cmdId, depth);
      return M.applyTo(side, cmdId);
    };
    /* The rival drafts nothing in a duel — and every draft it would have made
       draws from the seeded stream. The budgets it is handed come from local
       save files, so those draws would move the stream by a different amount
       on each client. Answer from the wire and consume nothing. */
    keep.pickLoadout = AI.pickLoadout;
    keep.pickMuster = AI.pickMusterLoadout;
    keep.pickTalents = AI.pickTalents;
    AI.pickLoadout = () => cfg.seats[1].loadout.slice();
    AI.pickMusterLoadout = () => cfg.seats[1].muster.slice();
    AI.pickTalents = () => ({});
  },

  unlensProfile() {
    const k = this._metaKeep; if (!k) return;
    for (const n of ['faction', 'prestigeOf', 'isUnlocked', 'hasSecondAbility',
                     'campaign', 'applyTo', 'applyToAI']) if (k[n]) Meta[n] = k[n];
    AI.pickLoadout = k.pickLoadout;
    AI.pickMusterLoadout = k.pickMuster;
    AI.pickTalents = k.pickTalents;
    this._metaKeep = null;
  },

  /** The duel is over on this client. The relay stays open for another. */
  finish() {
    this.live = false;
    this.lens.on = false;
    this.showStall(false);
    this.phase = this.peer ? 'linked' : 'idle';
    /* `done`, not `bye`: a resolved duel and a closed window are different
       news, and the peer must not hear the second when it is the first. */
    this.post({ t: 'done', to: this.peer && this.peer.id });
  },

  dropPeer(why) {
    const wasLive = this.live;
    this.peer = null;
    this.phase = 'lost';
    if (!wasLive) { this.status('The other commander closed their window.'); return; }
    /* Halt rather than resolve. A duel that lost half its inputs has no result
       to record, and calling it a forfeit would be inventing one. */
    this.live = false;
    this.lens.on = false;
    Game.state = 'over';
    this.showFatal('THE RELAY CLOSED',
      why === 'timeout'
        ? 'The other commander stopped answering. The duel is void — nothing has been recorded.'
        : 'The other commander closed their window. The duel is void — nothing has been recorded.');
  },

  /* ── 10. the two overlays a duel owns ──────────────────────────────── */

  /* Styled inline rather than in css/polish.css. Two elements are not worth a
     cross-lane edit, and build.js aborts on the literal word for a CSS link
     surviving into the bundle -- which a comment naming it would trip. */
  showStall(on) {
    let el = document.getElementById('net-stall');
    if (!el) {
      el = document.createElement('div');
      el.id = 'net-stall';
      el.style.cssText = 'position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:60;' +
        'padding:7px 16px;border:1px solid rgba(56,232,255,.35);border-radius:4px;' +
        'background:rgba(8,14,23,.92);color:#7dd3fc;font:600 11px/1.4 system-ui,sans-serif;' +
        'letter-spacing:.12em;pointer-events:none';
      el.textContent = 'WAITING FOR THE OTHER COMMANDER';
      document.body.appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
  },

  showFatal(title, text) {
    this.showStall(false);
    let el = document.getElementById('net-fatal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'net-fatal'; el.className = 'overlay';
      document.body.appendChild(el);
    }
    el.classList.remove('hidden');
    el.innerHTML = '<div class="modal"><div class="mv-body">' +
      '<b class="mv-title">' + title + '</b><p class="mv-text">' + text + '</p>' +
      '<div class="modal-actions"><button id="net-fatal-ok" class="btn btn-primary">RETURN</button>' +
      '</div></div></div>';
    document.getElementById('net-fatal-ok').addEventListener('click', () => {
      el.classList.add('hidden');
      this.live = false; this.lens.on = false;
      UI.show('screen-multiverse'); UI.renderMultiverse();
    });
  }
};
