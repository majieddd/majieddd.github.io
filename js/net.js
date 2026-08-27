/* ═══════════════════════════════════════════════════════════════════════
   THE DUEL RELAY, two humans, two clients, one battle.

   WHY THIS SHAPE. The house rule is no external libraries, ever, and the game
   must run offline from one inlined HTML file. That rules out every signalling
   service, SDK and matchmaking backend there is. It rules IN the browser's own
   APIs, and of those BroadcastChannel is the only one that needs no third
   party at all: two tabs or two windows of the same origin, on one machine,
   talking directly, offline, with no setup. So that is what ships, a duel
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
 a duel has nothing for the machine to decide.

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
/* 2: targeting became a command kind and the turn fingerprint learnt four
   more fields. An unpatched window would drop every `t` packet it received
   and hash a different set of state, so the two boards would part on turn
   zero for a reason nobody could read off the overlay. Refuse the link. */
/* 3: summoning became five doctrines. The rite decides what a kill returns
   as, so two builds that disagree about it diverge on the first corpse -- and
   the fingerprint now carries the procession's place in its march, the
   clutches on the board, the conscription debt and the power step. No new
   command kinds: a buy is still `m`, and every rite runs itself identically
   on both clients from the same seed. */
/* 4: the fingerprint learnt the relay network, the spliced lane, the compile
   level, the intrusion count and the bootstrap ramp. Protocol 3 shipped
   without them, so a 3 and a 4 hash different sets and would part on turn
   zero for a reason nobody could read off the overlay. Refuse the link. */
/* 5: the seat contract carries UNIT talents as well as tower talents. A 4
   sends only the tower half, so a 4 and a 5 derive different pack sizes from
   the same summon -- and pack size moves gold, stats.sent and musterIncome,
   all three of them hashed. Refuse the link. */
/* 6: Session 26 unit roles. Melee moves enemy x/y/hp the fingerprint already
   hashes, so builds on either side of the feature simulate different worlds
   and must refuse each other with a sentence instead of desyncing at the
   first engagement. */
/* 7: the roster grew (ASHTAR, ISA). A duel between a build that has them
   and one that does not desyncs the moment either is fielded, so the
   version fence moves. */
const NET_PROTOCOL = 7;
/* A turn is six ticks. 100ms at 1x. Smaller windows stall constantly the
   moment one browser deprioritises anything; larger ones are felt as lag. */
const NET_TURN_TICKS = 6;
/* Two turns of scheduling headroom. One leaves no slack at all: a packet a
   frame late then stalls the peer on every single turn. */
const NET_INPUT_DELAY = 2;
/* Advertising cadence for an open table, fast enough that a second window
   opening the lobby sees it within a blink. */
const NET_ADVERT_MS = 900;
const NET_HEARTBEAT_MS = 700;
/* Silence longer than this is a closed window. Seven heartbeats is generous
   enough that a tab briefly throttled to 1Hz is not evicted mid-duel. */
const NET_PEER_TIMEOUT_MS = 5000;
/* How long a stall may last before the waiting player is told why the board
   stopped. Under this it is invisible, and saying anything would be noise. */
const NET_STALL_NOTICE_MS = 450;
/* And how long before it is CALLED. A notice with no ceiling is not a verdict.
   `beat` refreshes lastHeard, so a window that is open but not simulating --
   a background tab, whose setInterval keeps heartbeating while its rAF is
   parked -- answered the peer timeout forever while producing no turns, and
   the other commander sat in front of a frozen board with no end to it. This
   is measured against the peer's own turn counter, never against silence. */
const NET_STALL_VOID_MS = 20000;
/* The message kinds only the current peer may speak. Everything here either
   mutates the simulation, ends the duel, or feeds the liveness clocks, so a
   sender check is the difference between a relay and an open command port. */
const NET_PEER_ONLY = ['pkt', 'oob', 'ctl', 'quit', 'done', 'beat'];
/* The two Game properties a 'ctl' may name. applyCtl assigns by name, and a
   name chosen by the wire would be arbitrary state injection from any tab on
   the origin -- speed and pause are the shared controls, and the only two. */
const NET_CTL_KEYS = ['speed', 'paused'];
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
  /* Silence and STASIS are two different failures. lastHeard answers "is the
     window still there", which a heartbeat can answer while the simulation
     behind it is parked; peerTurn and lastProgress answer "is it still
     playing", which only a RISING turn number can. */
  peerTurn: -1, lastProgress: 0,
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
   * concerned, a hand-signalled RTCDataChannel would attach here and need no
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
    /* The join deadline. The table that did not answer is the table that is
       gone, so its row goes with the verdict -- leaving it would invite the
       same click into the same silence. */
    if (this.phase === 'joining' && now - this.joinSince > NET_PEER_TIMEOUT_MS) {
      this.tables = this.tables.filter(t => t.id !== this.joinTarget);
      this.phase = 'idle'; this.table = null; this.joinTarget = null;
      this.status('The table did not answer: the host may have closed that window. Pick another.');
      if (this.onLobby) this.onLobby();
    }
    if ((this.phase === 'linked' || this.phase === 'playing') && now - this.lastBeat > NET_HEARTBEAT_MS) {
      this.lastBeat = now;
      /* The turn rides along. A bare heartbeat proves a window exists; it does
         not prove the simulation inside it is moving, and that distinction is
         the whole of the frozen-tab failure. */
      this.post({ t: 'beat', to: this.peer && this.peer.id, turn: this.turn });
    }
    if ((this.phase === 'linked' || this.phase === 'playing') &&
        now - this.lastHeard > NET_PEER_TIMEOUT_MS) this.dropPeer('timeout');
    /* The stall's ceiling, measured from the LATER of "when WE began waiting"
       and "the peer's last real progress", never from lastProgress alone. A
       draft halts both boards without sealing anything, so lastProgress goes
       arbitrarily stale during a long deliberation and a lastProgress-only
       clock would void a duel against a peer that never stopped on the first
       stalled tick after it. And never from stallSince alone either: a peer
       that advanced once mid-wait and then froze would satisfy "moved since
       the wait began" forever and never be called. The max starts the clock at
       whichever sign of life was most recent; a peer genuinely still playing
       keeps raising the turn it beats and keeps resetting it, including when
       THIS window is the backgrounded one, where a stalled-alone test would
       blame the peer for our own throttle. */
    if (this.live && this.stalled &&
        now - Math.max(this.stallSince, this.lastProgress) > NET_STALL_VOID_MS)
      this.dropPeer('frozen');
    /* Tables go stale the moment the window advertising one closes. */
    const before = this.tables.length;
    this.tables = this.tables.filter(t => now - t.seen < NET_ADVERT_MS * 4);
    if (this.tables.length !== before && this.onLobby) this.onLobby();
  },

  receive(m) {
    if (!m || m.from === this.id) return;
    if (m.v !== NET_PROTOCOL) return;
    if (m.to && m.to !== this.id) return;
    /* THE MATCH FAMILY SPEAKS ONLY FOR THE PEER. Every in-family sender posts
       addressed messages, but BroadcastChannel is same-origin, any tab on
       this origin can post a `to`-less packet, and before this gate a forged
       'ctl' reached applyCtl and a forged 'quit' conceded a duel the player
       was winning. Lobby traffic ('hello', 'table', 'join', ...) stays open:
       it is how strangers meet. 'bye' is not listed because it is both, from
       the peer it is a drop, from anyone else it merely clears a lobby row,
       and its own case already tells them apart by sender. */
    if (NET_PEER_ONLY.indexOf(m.t) >= 0 &&
        (!this.peer || m.from !== this.peer.id)) return;
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
        /* A sealed turn IS progress, and the strongest evidence of it -- a
           client that seals turns is a client that is stepping. */
        this.notePeerTurn(m.turn);
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

      case 'beat':
        /* The turn rides the beat so a stalled window can tell a peer that is
           merely quiet from one that is stuck: a rising turn is progress even
           before any packet for OUR turn arrives. Without this reader the
           field was write-only and the frozen-tab clock ran on packets alone.
           An old window's beat carries no turn; notePeerTurn refuses it. */
        this.notePeerTurn(m.turn);
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
    /* Any phase that is not a LOBBY phase is a leftover: the lobby is entered
       from the star map, with no table open and no duel running. Clearing only
       'lost' let a finished duel's link walk into the next lobby with it. */
    if (this.phase !== 'hosting' && this.phase !== 'joining') { this.phase = 'idle'; this.peer = null; }
    this.post({ t: 'hello' });
    return true;
  },

  profileName() {
    Meta.load();
    return (Meta._root && Meta._root.active) || 'COMMANDER';
  },

  /* THE SEAT LAW. A duel contract carries exactly one profile, one input
     stream, one offers slot and one `oob` producer PER SEAT -- and the only
     producer there is stamps `seat: N.seat`, which is only ever a seat THIS
     client holds. A board that deals more seats than the contract has
     profiles therefore hands the extra seat to nobody: its first draft parks
     in offers[] on wave 5 (draftEvery 5, commanders.js), syncDraft halts the
     board on any parked offer, and there is no timeout behind it. That is a
     permanent freeze, so the count is checked where a table is opened rather
     than discovered where the board is dealt.

     Mirrors Game.start's own `FIELD.seats || (triMode ? 3 : 2)` off the map
     DEFINITION, which is the same table buildField is built from. */
  seatsOnMap(mapId) {
    const m = MAPS.find(x => x.id === mapId);
    if (!m) return 0;                       // an unknown board is not a duel board
    return m.seats || (m.tri ? 3 : 2);
  },

  /**
   * Why this world cannot host a duel, in the words a player is owed, or null
   * when it can. Every CONTESTED world is dealt a three-way map by the galaxy
   * generator, which is ten of the thirty-five clickable worlds -- so this
   * refusal is common enough that it has to read like a rule, not an error.
   */
  duelRefusal(world) {
    if (!world) return 'There is no world here to fight a duel over.';
    const n = this.seatsOnMap(world.map);
    if (n === 2) return null;
    if (!n) return 'This world is fought on a board this build does not carry.';
    return 'This world is already a ' + n + '-way war. A duel seats two commanders, ' +
           'and the third chair here would sit empty -- nobody to answer its command ' +
           'draft, and a board that never starts again once it stops.';
  },

  host(world) {
    /* Refused BEFORE the channel opens, so a board nobody can finish is never
       advertised into the other window in the first place. */
    const why = this.duelRefusal(world);
    if (why) { this.status(why); return false; }
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
    /* A table is a message, and a message can come from a window running any
       build. The seat law is the guest's to enforce too, or a host from before
       this change could still seat this client at the board that freezes. */
    const why = this.duelRefusal(row.world);
    if (why) { this.status(why); return false; }
    this.phase = 'joining';
    this.table = row.world;
    /* A join is a question with a deadline. The only answers are the host's
       'accept' and 'busy', both of which need the host to still exist -- so a
       joiner whose host closed between the advert and the click used to spin
       on "Joining..." forever. tickWall holds the deadline. */
    this.joinSince = Date.now();
    this.joinTarget = tableId;
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
    /* TOWERS **AND** SOLDIERS. Units share the tower talent store by design
       (`addUnitXp` is `addTowerXp`), and their picks change what a summon IS:
       unitFieldMods feeds musterTierFor, which derives the pack COUNT, the
       mass, the cost and the income percent. Sending only the tower half left
       every unit talent to be read off whichever machine happened to be
       asking -- so two commanders with different unit trees derived different
       pack sizes from the same command, and gold, stats.sent and musterIncome
       are all fingerprinted. The first muster parted the boards. */
    for (const id of loadout.concat(Meta.musterLoadout()))
      talents[id] = Meta.talentMods(id).map(t => t.id);
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
     exactly why it is here, identical arithmetic in every engine. */
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
   * state, that is the whole contract, and the audit behind it is in the
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
     duellist holds seat 0, and a lie to the other one, whose lives, gold,
     arsenal and upgrade buttons would every one of them describe an opponent.
     The simulation cannot be re-seated to fix it: seat order decides tower
     update order, which decides the order floating-point damage accumulates
     in, which decides agreement. So the relabelling happens at the
     PRESENTATION boundary instead. While the lens is on, index 0 means "the
     commander in front of this screen". It is suspended for the whole of
     step, start, draw and command execution, which is every line of engine
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
    clearCostAt: [0], clearCostNow: [0], clearLimit: [0]
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
    /* TARGETING IS SIMULATION STATE, not a display preference. Tower.acquire
       switches on it every tick, so a mode set on one screen and nowhere else
       aims that client's guns at a different enemy and the two boards part
       inside a second. Addressed by tile like the three above it, and carried
       as an INDEX into TARGET_MODES so no string off the wire ever reaches
       acquire's switch -- the replay looks the id back up here or drops the
       command. */
    cmd('setTargetMode', (t, mode) => {
          const i = TARGET_MODES.map(m => m.id).indexOf(mode);
          return (t && i >= 0) ? { k: 't', gx: t.gx, gy: t.gy, mode: i } : null;
        },
        c => { const t = Game.towerAt(c.gx, c.gy), m = TARGET_MODES[c.mode];
               if (t && m && t._side === c.seat) O.cmd_setTargetMode.call(Game, t, m.id); });

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
       seat a fixed fraction of it, a ratio calibrated against a machine that
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
       RIVAL's draft, take the severe card and your own draft widens, duck it
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
    /* A HALTED BOARD DOES NOT TICK, whoever is asking. Game.loop re-reads the
       state on every pass of its batch now, but it must not be the only thing
       that knows: a draft opened from inside step() has to stop the tick
       counter on the exact tick it opened on, or applyOob seeds
       _hash(this.tick, ...) from two different numbers and the two boards
       break the same card's ties differently. The halt is a fact about the
       simulation; the frame that noticed it is not. */
    if (Game.state !== 'playing') {
      /* The halt outranks the wait: a WAITING notice left standing behind the
         draft modal would blame the peer for a pause this client asked for. */
      if (this.stalled) { this.stalled = false; this.showStall(false); }
      return;
    }
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

  /** The peer's turn counter, and the moment it last ROSE. A number that only
      repeats is a window that is open and not playing, which is exactly the
      case the stall ceiling exists to end. Silently ignores a missing turn so
      a peer whose beats predate this field is judged on its packets alone --
      and a peer sending neither is not stepping, which is the right verdict. */
  notePeerTurn(t) {
    if (typeof t !== 'number' || t <= this.peerTurn) return;
    this.peerTurn = t;
    this.lastProgress = Date.now();
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
    const K = { b: 'build', m: 'muster', l: 'buyBaseLevel',
                c: 'clearTerrain', u: 'upgrade', s: 'sell', r: 'relocate', a: 'ability',
                t: 'setTargetMode' };
    /* A packet names its own seat; a command inside it may not claim another. */
    c.seat = fromSeat;
    const fn = this._run[K[c.k]];
    if (!fn) return;
    try { fn(c); } catch (e) { console.error('[net] command failed', c, e); }
    /* syncLive inside step redraws the numbers at 8Hz, but the shop and the
       inspector are only rebuilt when something is actually spent. */
    if (c.seat === this.seat) UI.syncAll();
  },

  /* Commands taken while the simulation is HALTED, a draft modal is open, so
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
    if (NET_CTL_KEYS.indexOf(ctl) < 0) return;
    this._applyingCtl = !!remote;
    try { Game[ctl] = value; } finally { this._applyingCtl = false; }
    if (ctl === 'speed')
      document.querySelectorAll('.speed-btn').forEach(x =>
        x.classList.toggle('active', +x.dataset.speed === value));
  },

  /* ── 8. agreement ──────────────────────────────────────────────────── */

  /**
   * A fingerprint of everything the simulation decides and nothing it merely
   * draws. Particles, floaters, beams and banners are deliberately absent
   * they are ALLOWED to differ between two clients, and folding them in would
   * report every cosmetic difference as a desync.
   */
  fingerprint() {
    let h = 0x811c9dc5;
    const q = v => Math.round((v || 0) * NET_SUM_SCALE) | 0;
    const mix = v => { h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0; };
    mix(Game.wave); mix(this.tick); mix(q(Game.prepTimer)); mix(Game.waveRunning ? 1 : 0);
    mix(Game.spawnQueue.length); mix(Game.projectiles.length); mix(Game.enemyMods.length);
    const modeIds = TARGET_MODES.map(m => m.id);
    /* IDENTITY, not merely count, for everything the seeded stream CHOSE. An
       escalation is drawn at random out of ENEMY_MODS and a drift is one
       statistic picked out of three at every startWave: two boards can hold
       the same NUMBER of escalations and not the same escalations, and the
       same count of drift and not the same creep. Neither shows anywhere at
       all until the next wave spawns under it, so a length-only sum names a
       turn nowhere near the turn that actually went wrong. */
    for (const m of Game.enemyMods) mix(ENEMY_MODS.indexOf(m));
    mix(q(Game.drift.hp)); mix(q(Game.drift.speed)); mix(q(Game.drift.armor));
    /* THE CLUTCHES. A pod is a body that has not arrived yet, so two boards
       that disagree about one are already two different matches -- they just
       do not find out until it hatches. `lidx` rather than a UNIT_ORDER index
       because the loadout crosses the wire in the seat contract and so means
       the same thing on both clients regardless of build. */
    mix((Game.incubators || []).length);
    for (const pod of (Game.incubators || [])) {
      mix(pod.side); mix(q(pod.x)); mix(q(pod.y));
      mix(q(pod.t)); mix(q(pod.powerHp)); mix(pod.lidx | 0);
    }
    /* THE RELAY NETWORK and THE SPLICE. Both are duel-reachable -- any
       commander may field Parallel soldiers once the install has taken a
       galaxy -- and both change what arrives and where it walks: a relay
       moves speed and armour, a splice adds a whole LANE. Hash the cause,
       not the symptom: without these a divergence here would surface later
       as an enemy in the wrong place and name a turn nowhere near the one
       that actually parted. */
    mix((Game.relayNodes || []).length);
    for (const n of (Game.relayNodes || [])) {
      mix(n.owner); mix(n.board); mix(q(n.x)); mix(q(n.y)); mix(q(n.t));
    }
    for (let i = 0; i < Game.lanes.length; i++) {
      mix(Game.lanes[i] ? Game.lanes[i].length : 0);
      const sp = (Game.spliceState || [])[i];
      mix(sp ? (sp.wavesLeft | 0) + 1 : 0);
    }
    for (const S of this._realSides) {
      mix(S.gold); mix(S.lives); mix(q(S.musterIncome));
      mix(S.towers.length); mix(S.cleared.size); mix(S.taken.length);
      /* Same rule as the escalations above: the draft SPLICES cards out of
         PLAYER_MODS at random, so which cards a commander holds is a decision
         of the stream and the count of them proves nothing about it. */
      for (const m of S.taken) mix(PLAYER_MODS.indexOf(m));
      mix(S.baseLevel || 1); mix(S.stats.sent); mix(S.stats.kills); mix(S.stats.leaked);
      /* The rite and its working state. Unconditional for every seat: a
         doctrine field that only hashed when it was interesting would be a
         field that stops proving anything the moment it matters. */
      mix(DOCTRINE_ORDER.indexOf(S.doctrine));
      mix(S.procIdx | 0); mix(S.procCycle | 0); mix(q(S.procTimer || 0));
      mix(q(S.rollDebt || 0)); mix(q(S.summonPower || 0));
      mix(S.musterThisWave | 0);
      /* FIELD DOCTRINE's banked credit, and the detachment cooldowns that
         replaced MUSTER_PER_WAVE. Both GATE what a seat may do next, so a
         client that disagrees about either has already made a different
         decision available -- the same reasoning the clutch block above gives.
         Walked in musterTiers order rather than by iterating the cooldown
         object, because key insertion order encodes the sequence of buys and
         two clients that bought the same set in a different order would then
         hash differently while being in identical states. */
      mix(q(S.reqCredit || 0));
      /* THE BROOD'S OPEN WINDOWS travel with the cooldowns, and for the same
         reason: a window is readiness, so a client that disagrees about one
         disagrees about what this seat may buy on this turn. Walked in
         musterTiers order like the cooldowns, never by iterating the object,
         because key insertion order encodes the sequence clutches matured in
         and two clients in identical states would then hash differently. */
      for (const t of (S.musterTiers || [])) {
        mix(q((S.musterCd && S.musterCd[t.id]) || 0));
        const w = S.broodOpen && S.broodOpen[t.id];
        mix(w ? q(w.t) : 0);
        mix(w ? q(w.prev) : 0);
      }
      /* THE COMPILE and THE BOOTSTRAP. A clone commander rewrites its own
         traits at wave boundaries and the Parallel's towers ramp every wave,
         so both sides' STATS depend on these even though `mods` themselves
         are not hashed. `stats.jammed` is in because it is the metric
         LUMEN-R compiles on -- a client that counted one more intrusion
         would recompile a wave early and diverge on tower damage. */
      mix(S.compileLevel | 0);
      mix(S.stats.jammed | 0);
      mix(q(S._bootAt || 0));
      for (const t of S.towers) {
        mix(t.gx); mix(t.gy); mix(t.level); mix(t.asc || 0);
        mix(t.invested || 0); mix(t.kills || 0); mix(q(t.damageDealt));
        /* A branch and every ascension after it leave `level` sitting at 4
           while changing what the gun does, so level cannot tell two
           differently specialised towers apart. Rolls are the other die the
           engine throws at a tower, and `level` does not count them either --
           applyBaseLevelTo raises a tower to level 3 and adds no rolls at all,
           so rolls.length is not derivable from anything else here. */
        mix(t.def.branches ? t.def.branches.indexOf(t.branch) : -1);
        for (const r of t.rolls) mix(LEVEL_ROLLS.indexOf(r));
        /* Targeting is carried because a writer outside the relay shipped for
           this field once already. It is a lockstep command now; this is what
           names the NEXT out-of-band writer at the turn boundary it happened
           on, instead of by the damage it eventually does. */
        mix(modeIds.indexOf(t.targetMode));
      }
    }
    for (const e of Game.enemies) {
      mix(q(e.x)); mix(q(e.y)); mix(q(e.hp)); mix(e.hostileTo); mix(e.dead ? 1 : 0);
      /* VETERANCY. `maxHp` is what a promotion moves, and resolveMelee reads
         maxHp to price every strike, so a veteran is a body that hits harder.
         Hashing the rank rather than maxHp keeps this one integer wide: the
         rank determines maxHp exactly, and an integer cannot drift the way a
         quantised float can. */
      mix(e.vetRank | 0);
    }
    return h >>> 0;
  },

  checkSum(t) {
    const s = this.sums[t];
    if (!s || s[0] === null || s[1] === null || s[0] === undefined || s[1] === undefined) return;
    if (s[0] !== s[1] && !this.desync) {
      this.desync = { turn: t, mine: s[this.seat], theirs: s[1 - this.seat] };
      /* Through voidMatch, not showFatal. Raising the overlay was the whole of
         what a parting used to do: `live` and the lens stayed on behind it, the
         draft modal stayed up and still clickable, and the heartbeat kept the
         peer's own timeout from ever firing, until somebody clicked RETURN. */
      this.voidMatch('THE BOARDS HAVE PARTED',
        'The two simulations stopped agreeing at turn ' + t + '. The duel is halted rather ' +
        'than played out on two different boards. Nothing has been recorded.');
    }
    delete this.sums[t];
  },

  /* ── 9. match lifecycle ────────────────────────────────────────────── */

  beginMatch(seat) {
    /* THE LAST LINE OF THE SEAT LAW, and the only one that runs on both
       clients whichever of them opened the table. host() and join() already
       refuse, but neither of them AUTHORS the contract -- a peer does, and
       sends it. Refusing here costs a lobby round trip; not refusing costs a
       duel that halts on wave 5 with no way out of it. */
    const cfg0 = this.cfg;
    const dealt = cfg0 ? this.seatsOnMap(cfg0.map) : 0;
    if (!cfg0 || !cfg0.seats || dealt !== cfg0.seats.length) {
      this.live = false;
      this.phase = 'idle';
      this.post({ t: 'bye', to: this.peer && this.peer.id });
      this.peer = null; this.table = null;
      this.showFatal('THAT WORLD IS NOT A DUEL BOARD',
        'It is fought on a board for ' + (dealt || 'a number of') + ' commanders, and this ' +
        'table seats ' + ((cfg0 && cfg0.seats) ? cfg0.seats.length : 0) + '. It has been closed ' +
        'rather than opened onto a battle an empty chair would stall forever. ' +
        'Nothing has been recorded.');
      return false;
    }
    this.hook();
    this.seat = seat;
    this.tick = 0; this.turn = 0; this.tickInTurn = 0;
    this.queued = []; this.inbox = {}; this.sums = {};
    this.desync = null; this.stalled = false;
    /* Sized from the contract rather than from the number two: offers[] is the
       array the seat law is actually about, and a literal here would go on
       claiming two seats on a board that had dealt three. */
    this.offers = this.cfg.seats.map(() => null);
    this._peerDone = false; this._conceded = false;
    this.lastHeard = Date.now();
    /* Both start at the opening whistle, or the first tickWall of a fresh duel
       would measure the peer's progress against the epoch and void instantly. */
    this.peerTurn = -1; this.lastProgress = Date.now();
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
        /* Shared by both clients (host builds the table, guest receives it
           verbatim) -- procedural map geometry seeds from this so the two
           boards are byte-identical without a new network message. */
        worldId: cfg.world.id,
        boons: []
      });
      /* INSIDE THE LENS, and seat by seat. setMusterLoadout derives every
         tier through musterTierFor -> unitFieldMods -> Meta.talentMods, so
         run OUTSIDE the lens it read this machine's unit trees for both
         seats -- two commanders with different unit builds then derived
         different pack sizes from the same command, and gold, stats.sent and
         musterIncome are all fingerprinted.
         The lens itself pins talentMods to SEAT 0 (it exists to answer for
         the seat being built), so deriving both seats under it unchanged
         would hand seat 1 seat 0's soldiers. Pointed at each seat's own wire
         picks in turn instead. The cache is cleared around every swap because
         it is keyed by unit id alone: an entry built for one seat would
         otherwise be served to the other. */
      const S = this._realSides;
      const sets = [this.talentSetsFor(cfg.seats[0]), this.talentSetsFor(cfg.seats[1])];
      const lensedTalentMods = Meta.talentMods;
      for (let i = 0; i < 2; i++) {
        S[i].loadout = cfg.seats[i].loadout.slice();
        Meta.talentMods = id => sets[i][id] || [];
        clearUnitFieldCache();
        Game.setMusterLoadout(i, cfg.seats[i].muster.slice());
        S[i].talentSets = sets[i];
      }
      Meta.talentMods = lensedTalentMods;
    } finally { this._starting = false; this.unlensProfile(); clearUnitFieldCache(); }
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
    Game.banner('DUEL · ' + ((this.peer && this.peer.name) || 'COMMANDER'), 3,
                FACTIONS[this._realSides[seat].faction].color);
  },

  /** Talent objects rebuilt from ids, so both clients read the same tree. */
  talentSetsFor(p) {
    const out = {};
    for (const id of p.loadout.concat(p.muster || [])) {
      const def = Meta.talentDefOf(id);
      const ids = (p.talents && p.talents[id]) || [];
      out[id] = def ? ids.map(tid => def.talents.find(t => t.id === tid)).filter(Boolean) : [];
    }
    return out;
  },

  /**
   * Game.start builds a seat out of THIS machine's save file. For the duration
   * of one start every profile read is answered from the wire instead, for
   * whichever seat is being built, which Meta.applyTo names in its own first
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
       also what lets both duellists field the SAME commander, start()
       reassigns a mirrored rival, and the wire overrules it. */
    keep.applyToAI = M.applyToAI;
    M.applyToAI = function (side, cmdId, depth) {
      if (!side || side.index > 1) return keep.applyToAI.call(M, side, cmdId, depth);
      return M.applyTo(side, cmdId);
    };
    /* The rival drafts nothing in a duel, and every draft it would have made
       draws from the seeded stream. The budgets it is handed come from local
       save files, so those draws would move the stream by a different amount
       on each client. Answer from the wire and consume nothing. */
    /* THE PRICE OF A SEAT IS THE CONTRACT'S, NOT THIS SAVE'S. Game.start
       budgets every seat past the first off Meta.techSpent and off seat 0's
       own talent depth -- both read from the LOCAL profile, which is a
       different number in each window. Seat 1 never showed it because the wire
       rebuilds that seat below, but Game.rivalTech and Game.rivalDepth are
       computed either way and they ARE the board for any further seat: two
       clients would spend a different budget on the same commander and the
       fingerprint would part on gold and base level. Answered from the
       contract so both windows do the same arithmetic. */
    const sets0 = this.talentSetsFor(cfg.seats[0]);
    keep.techSpent = M.techSpent;
    keep.talentMods = M.talentMods;
    M.techSpent = () => {
      const p = cur || cfg.seats[0];
      const cmd = COMMANDERS.find(c => c.id === p.commander);
      if (!cmd) return 0;
      let n = 0;
      for (const t of cmd.tech) if ((p.tech || []).indexOf(t.id) >= 0) n += t.cost;
      return n;
    };
    M.talentMods = id => sets0[id] || [];
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
                     'campaign', 'applyTo', 'applyToAI',
                     'techSpent', 'talentMods']) if (k[n]) Meta[n] = k[n];
    AI.pickLoadout = k.pickLoadout;
    AI.pickMusterLoadout = k.pickMuster;
    AI.pickTalents = k.pickTalents;
    this._metaKeep = null;
  },

  /* THERE IS EXACTLY ONE PLACE THAT ENDS A MATCH, AND EVERY EXIT ROUTES THROUGH
     IT. For the relay that place is `finish`: Game.endMatch's wrapper calls it
     from a `finally`, and voidMatch calls it for a duel that has no result to
     record. Everything a live duel switched on is switched off here and nowhere
     else -- there used to be four half-teardowns, and every bug in this section
     was one of them forgetting a line another one remembered. */
  finish(voided) {
    const peer = this.peer;
    this.live = false;
    this.lens.on = false;
    this.showStall(false);
    /* A PARKED OFFER OUTLIVES THE BOARD. #overlay-choice is body-level and
       nothing but this hides it; left standing, its cards are still bound to
       Game.takeMod, and with `live` already false that reaches the engine's own
       takeMod -- which sets the state back to 'playing' and hands Game.loop a
       dead board to step behind the notice saying nothing was recorded. */
    this.offers = [];
    Game.pendingChoice = null;
    UI.hideChoice();
    /* A FINISHED DUEL IS NOT A STANDING PARTNERSHIP. Keeping `peer` and phase
       'linked' left enterLobby -- which only ever reset 'lost' -- to greet the
       next lobby with "The other commander closed their window." about a window
       that had merely finished its match. */
    this.phase = 'idle';
    this.peer = null;
    /* `done`, not `bye`: a resolved duel and a closed window are different
       news, and the peer must not hear the second when it is the first. A
       VOIDED duel is neither and says nothing: the peer reads the same parted
       fingerprints, or the same silence, and reaches the same verdict itself. */
    if (!voided) this.post({ t: 'done', to: peer && peer.id });
  },

  /**
   * The same exit for a duel with NO result, the boards parted, or the peer
   * stopped answering. Game.endMatch is deliberately not called: there is
   * nothing to record and a forfeit would be inventing one. The teardown is the
   * identical one, because a duel that ends without tearing down is the whole
   * of what went wrong here.
   */
  voidMatch(title, text) {
    if (!this.live) return;
    Game.state = 'over';
    Sound.stopMusic();
    this.finish(true);
    this.showFatal(title, text);
  },

  dropPeer(why) {
    const wasLive = this.live;
    this.peer = null;
    if (!wasLive) { this.phase = 'lost'; this.status('The other commander closed their window.'); return; }
    /* Halt rather than resolve. A duel that lost half its inputs has no result
       to record, and calling it a forfeit would be inventing one. */
    /* Three different silences, and a player who is told the wrong one goes
       looking for the wrong problem. 'frozen' is the common one and the one
       that used to have no words at all: a second WINDOW read as a second TAB,
       throttled by the browser into heartbeating without stepping. */
    this.voidMatch('THE RELAY CLOSED',
      why === 'frozen'
        ? 'The other commander\'s window is open but has stopped simulating. A background TAB is throttled by the browser and cannot fight a duel: the second window has to be visible. The duel is void: nothing has been recorded.'
        : why === 'timeout'
        ? 'The other commander stopped answering. The duel is void: nothing has been recorded.'
        : 'The other commander closed their window. The duel is void: nothing has been recorded.');
    /* AFTER the teardown, which lands on 'idle'. The lobby has to know this
       link is gone rather than merely finished, and enterLobby clears 'lost'. */
    this.phase = 'lost';
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
      /* The notice says WHY it might not end. Told this while the board is
         still stopped, a player can front the other window and recover the
         duel; told nothing, they wait out the ceiling and lose the match. */
      el.innerHTML = 'WAITING FOR THE OTHER COMMANDER' +
        '<div style="margin-top:4px;font-weight:400;letter-spacing:.06em;opacity:.7">' +
        'a background tab is throttled: keep both windows visible</div>';
      document.body.appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
  },

  showFatal(title, text) {
    this.showStall(false);
    let el = document.getElementById('net-fatal');
    if (!el) {
      el = document.createElement('div');
      /* `required` keeps Esc off it (closeTopOverlay, js/main.js). Esc HIDES an
         overlay and does nothing else, so dismissing this one left a frozen
         board carrying no explanation and no road off it. RETURN is the only
         way out because RETURN is the thing that leaves the board. */
      el.id = 'net-fatal'; el.className = 'overlay required';
      document.body.appendChild(el);
    }
    el.classList.remove('hidden');
    el.innerHTML = '<div class="modal"><div class="mv-body">' +
      '<b class="mv-title">' + title + '</b><p class="mv-text">' + text + '</p>' +
      '<div class="modal-actions"><button id="net-fatal-ok" class="btn btn-primary">RETURN</button>' +
      '</div></div></div>';
    document.getElementById('net-fatal-ok').addEventListener('click', () => {
      el.classList.add('hidden');
      /* The duel was torn down by voidMatch before this overlay was ever
         raised. The button only decides where the player stands afterwards:
         doing half a teardown here as well is what let an OVERLAY be the thing
         that ends a match, and left every path that skipped it half-ended. */
      Game.state = 'menu';
      UI.show('screen-multiverse'); UI.renderMultiverse();
    });
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   THE SECOND WIRE, the same duel, fought across two machines.

   Everything above this line is transport-agnostic on purpose: Net.attach
   takes anything with postMessage(msg) and an onmessage callback, and the
   lobby, the lockstep, the fingerprints and the liveness clocks run over it
   unchanged. This section is the transport the header promised, a
   hand-signalled RTCDataChannel, and it touches nothing above the seam.

   THERE IS NO SERVER, AND THE PLAYERS ARE TOLD SO. WebRTC still needs the
   two session descriptions carried between the machines somehow, and every
   signalling service there is to rent is a dependency the house rule
   forbids. So the two commanders carry them: the host copies an offer blob
   out, the guest pastes it and copies an answer back, the host pastes that,
   and from then on the machines talk directly. The ritual is the price of
   the rule, and the UI copy says so in as many words.

   NO ICE SERVERS EITHER. A bare RTCPeerConnection gathers host candidates
   only, which reach across one LAN, two machines in one room, the
   realistic shape of this duel for a game that ships as a single offline
   file. A public STUN url would cross NATs and would also put a third
   party in every duel; NET_RTC_CONFIG below is where one would go, and it
   is empty on purpose. */

const NET_RTC_CONFIG = {};   // no iceServers: host candidates, one LAN

const NetRTC = {

  supported: (typeof RTCPeerConnection === 'function'),
  pc: null,          // the connection being built, or the one in use
  dc: null,          // its single channel, ordered and reliable by default,
                     // which is exactly what lockstep already assumes
  adapter: null,     // the postMessage/onmessage shim Net is attached to
  onState: null,     // UI hook: a line of ritual progress
  onLink: null,      // UI hook: the wire is live

  state(text) { if (this.onState) this.onState(text); },

  /* A blob is base64 over JSON so it survives whatever carries it, chat
     clients that mangle newlines, mail that folds lines, clipboards that
     smart-quote. Whitespace picked up in transit is stripped on the way in.
     escape/unescape keep the round trip unicode-safe with no library. */
  _enc(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); },
  _dec(s) { return JSON.parse(decodeURIComponent(escape(atob(String(s).replace(/\s+/g, ''))))); },

  /* ONE BLOB PER DIRECTION. Trickling candidates needs a wire, and the wire
     is the thing being built, so gathering must FINISH before the blob is
     worth copying, and iceGatheringState 'complete' is how the browser says
     it has. With no ICE servers to consult this is milliseconds. */
  _gathered(pc) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res(pc.localDescription);
      pc.addEventListener('icegatheringstatechange', function h() {
        if (pc.iceGatheringState !== 'complete') return;
        pc.removeEventListener('icegatheringstatechange', h);
        res(pc.localDescription);
      });
    });
  },

  _open() {
    this.abort();
    const R = this, pc = this.pc = new RTCPeerConnection(NET_RTC_CONFIG);
    /* 'failed' and 'closed' are verdicts. 'disconnected' is deliberately NOT
       here: it can be a transient blip that recovers on its own, and the
       existing heartbeat timeout already ends a genuine loss with the same
       honesty five seconds later. */
    pc.onconnectionstatechange = () => {
      if (pc !== R.pc) return;                          // an aborted build talking
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') R._lost();
    };
    return pc;
  },

  /** HOST, step one: build the connection, hand back the offer blob. */
  async host() {
    if (!this.supported) throw new Error('This browser has no WebRTC.');
    const pc = this._open();
    this._arm(pc.createDataChannel('duel'));
    await pc.setLocalDescription(await pc.createOffer());
    const d = await this._gathered(pc);
    return this._enc({ v: NET_PROTOCOL, d: { type: d.type, sdp: d.sdp } });
  },

  /** GUEST: take the offer, hand back the answer blob. */
  async answer(blob) {
    if (!this.supported) throw new Error('This browser has no WebRTC.');
    let o; try { o = this._dec(blob); } catch (e) { throw new Error('That is not an offer blob: copy the WHOLE of it and try again.'); }
    if (o.v !== NET_PROTOCOL) throw new Error('The two machines are running different builds of the game. Reload both from the site, then start over.');
    const pc = this._open();
    pc.ondatachannel = ev => this._arm(ev.channel);
    await pc.setRemoteDescription(o.d);
    await pc.setLocalDescription(await pc.createAnswer());
    const d = await this._gathered(pc);
    return this._enc({ v: NET_PROTOCOL, d: { type: d.type, sdp: d.sdp } });
  },

  /** HOST, step two: take the answer. The channel opens by itself after. */
  async accept(blob) {
    let a; try { a = this._dec(blob); } catch (e) { throw new Error('That is not an answer blob: copy the WHOLE of it and try again.'); }
    if (a.v !== NET_PROTOCOL) throw new Error('The two machines are running different builds of the game. Reload both from the site, then start over.');
    if (!this.pc) throw new Error('There is no offer waiting for this answer. Start the ritual again.');
    await this.pc.setRemoteDescription(a.d);
    this.state('Answer taken. The machines are finding each other…');
  },

  _arm(dc) {
    const R = this;
    this.dc = dc;
    dc.onopen = () => R._live(dc);
    dc.onclose = () => R._lost();
  },

  /* The channel is open: wrap it in the exact shape Net.attach was built
     for. BroadcastChannel carries structured clones and a DataChannel
     carries text, so JSON is the whole of the adaptation, post() gains a
     stringify, receive() gains a parse, and nothing else differs. */
  _live(dc) {
    const R = this;
    const adapter = this.adapter = {
      onmessage: null,
      postMessage(msg) { try { dc.send(JSON.stringify(msg)); } catch (e) { console.error('[rtc] send', e); } },
      close() { try { dc.close(); } catch (e) {} }
    };
    dc.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }   // not JSON, not ours
      if (adapter.onmessage) adapter.onmessage({ data: m });
    };
    /* The same-machine channel retires first, two live transports would
       double every lobby message. The next same-machine lobby rebuilds a
       fresh BroadcastChannel through Net.open() as if this never happened. */
    if (Net.ch && Net.ch !== adapter && typeof Net.ch.close === 'function') { try { Net.ch.close(); } catch (e) {} }
    Net.ch = null;
    /* `supported` gates every lobby entry on BroadcastChannel existing. A
       browser without one can still hold THIS wire, and with the adapter
       attached the gate must answer for the wire that exists. */
    Net.supported = true;
    Net.attach(adapter);
    /* A closing window must reach the peer as a closed CONNECTION, not as
       five seconds of unexplained silence: pc.close() fires the far side's
       onclose the moment the last packet lands. */
    if (!this._unloadHooked) {
      this._unloadHooked = true;
      window.addEventListener('beforeunload', () => { if (R.pc) { try { R.pc.close(); } catch (e) {} } });
    }
    this.state('The wire is live.');
    if (this.onLink) this.onLink();
  },

  /* Every way the wire dies lands here, dc.onclose, connectionState failed
     or closed, the peer's window closing, and routes into the SAME dropPeer
     the heartbeat timeout uses. Mid-duel that voids with the existing copy;
     in the lobby it reads as the closed window it is. A death before the
     link ever opened is neither: it is the ritual failing, said in ritual
     terms. */
  _lost() {
    if (!this.pc && !this.adapter) return;              // already torn down
    const hadLink = !!this.adapter;
    this.teardown();
    if (hadLink) { Net.ch = null; Net.dropPeer('closed'); }
    else this.state('The machines could not reach each other. Same network? Whole blobs? Start the ritual again.');
  },

  /** The RTC objects only. Net keeps whatever state it is in. */
  teardown() {
    const pc = this.pc, dc = this.dc;
    this.pc = null; this.dc = null; this.adapter = null;
    if (dc) { dc.onopen = dc.onclose = dc.onmessage = null; try { dc.close(); } catch (e) {} }
    if (pc) { pc.onconnectionstatechange = null; pc.ondatachannel = null; try { pc.close(); } catch (e) {} }
  },

  /** Esc, BACK, or a fresh start mid-ritual: nothing survives it. */
  abort() {
    if (this.adapter && Net.ch === this.adapter) Net.ch = null;
    this.teardown();
  }
};

/* ══════════════════════ THE APPEND-ONLY LOCK ═══════════════════════════

   Five tables are INDEX-COUPLED across the wire. A duel never sends the name
   of a draft card, an arena modifier, a targeting mode, a level roll or a
   summoning rite -- it sends the INDEX, and the far machine looks it up in
   its own copy. Reorder one entry, delete one, or insert in the middle, and
   two builds on the same NET_PROTOCOL will silently disagree about what the
   number means: one seat drafts SAPPER CORPS, the other drafts SURVEYORS,
   and the divergence surfaces waves later as a fingerprint mismatch nobody
   can trace back to the edit that caused it.

   Until now that rule lived only in a comment, which is to say it lived
   nowhere. This is the same rule as executable code: the prefix each table
   had at NET_PROTOCOL 5, checked at load. APPENDING is always legal and is
   the only legal edit -- a longer table with an intact prefix passes.

   WHEN YOU DELIBERATELY BREAK ONE: bump NET_PROTOCOL (which makes the two
   builds refuse each other with a sentence instead of desyncing), then
   update the prefix below to the new order in the same commit. Doing one
   without the other is the mistake this guard exists to catch. */
const LOCKSTEP_PREFIX = {
  PLAYER_MODS: ['sappers', 'surveyors', 'overcharge', 'cycling', 'optics', 'ap', 'crit',
                'ordnance', 'catalyst', 'salvage', 'logistics', 'necrotic', 'conscript', 'bulwarks'],
  ENEMY_MODS:  ['carapace', 'adrenal', 'vitality', 'warding', 'plating', 'regen',
                'resilient', 'sturdy', 'veiled', 'brutal', 'legion', 'unstable'],
  TARGET_MODES: ['first', 'last', 'strong', 'weak', 'close'],
  LEVEL_ROLLS: ['r_dmg', 'r_rate', 'r_range', 'r_splash', 'r_status', 'r_pierce', 'r_crit', 'r_mixed'],
  DOCTRINE_ORDER: ['human', 'light', 'xeno', 'pirate', 'robot']
};

/** Every table whose prefix has moved, with the index that moved and both
    names. Empty means the wire contract still holds. Cheap enough to run at
    load; `tools/owner-sweep.js` asserts it is empty. */
Net.lockstepAudit = function () {
  const live = {
    PLAYER_MODS:    typeof PLAYER_MODS    !== 'undefined' ? PLAYER_MODS.map(m => m.id)    : null,
    ENEMY_MODS:     typeof ENEMY_MODS     !== 'undefined' ? ENEMY_MODS.map(m => m.id)     : null,
    TARGET_MODES:   typeof TARGET_MODES   !== 'undefined' ? TARGET_MODES.map(m => m.id)   : null,
    LEVEL_ROLLS:    typeof LEVEL_ROLLS    !== 'undefined' ? LEVEL_ROLLS.map(m => m.id)    : null,
    DOCTRINE_ORDER: typeof DOCTRINE_ORDER !== 'undefined' ? DOCTRINE_ORDER.slice()        : null
  };
  const bad = [];
  for (const name of Object.keys(LOCKSTEP_PREFIX)) {
    const want = LOCKSTEP_PREFIX[name], got = live[name];
    if (!got) { bad.push({ table: name, at: -1, want: '(table present)', got: '(undefined)' }); continue; }
    if (got.length < want.length) {
      bad.push({ table: name, at: got.length, want: want[got.length], got: '(truncated)' });
      continue;
    }
    for (let i = 0; i < want.length; i++)
      if (got[i] !== want[i]) { bad.push({ table: name, at: i, want: want[i], got: got[i] }); break; }
  }
  return bad;
};

/* Loud at load, because a desync found here costs one line and a desync
   found in a duel costs an evening. Never throws: a broken guard must not
   take the single-player game down with it. */
(function lockstepGuard() {
  try {
    const bad = Net.lockstepAudit();
    if (!bad.length) return;
    console.error('LOCKSTEP CONTRACT BROKEN: an index-coupled table was reordered ' +
                  'without a NET_PROTOCOL bump. Duels between builds will desync.');
    for (const b of bad)
      console.error('  ' + b.table + '[' + b.at + '] should be "' + b.want + '", is "' + b.got + '"');
  } catch (e) { /* a guard that breaks the game is worse than no guard */ }
})();
