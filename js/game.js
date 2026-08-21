/* ==========================================================================
   COSMIC CONQUEST — Core State, Simulation & World Rendering
   ========================================================================== */

'use strict';

const STEP = 1 / 60;
const MAX_STEPS = 8;
const MAX_PARTICLES = 420;
const MAX_FLOATERS = 80;

/** The active battlefield geometry, rebuilt from the chosen map. */
let FIELD = null;

/** Fresh command-upgrade multiplier block. PLAYER_MODS mutate this. */
function freshMods() {
  return { damage: 1, rate: 1, range: 1, splash: 1, status: 1, gold: 1,
           pierce: 0, crit: 0, cost: 1, upCost: 1, reanim: 1, doubleReanim: 0, sellRate: 0.7,
           interest: 1, relocFee: RELOCATE_FEE_FRAC };
}

class Side {
  constructor(index, isAI, diff) {
    this.index = index;
    this.isAI = isAI;
    this.gold = diff.gold;
    this.lives = this.maxLives = diff.lives;
    this.mods = freshMods();
    this.traits = freshTraits();
    this.commander = null;
    this.loadout = [];               // the 5 towers deployable this battle
    this.taken = [];                 // command upgrades chosen so far
    this.towers = [];
    this.totalAsc = 0;
    this.immortalUsed = false;
    /* MUSTER ledger. `musterIncome` is an additive PERCENT of the wave reward
       rather than a gold figure, so the bonus keeps pace with the economy
       while the cap that bounds it stays a single comparison. */
    this.musterIncome = 0; this.musterBuys = 0; this.musterThisWave = 0; this.lastMuster = 0;
    /* Detachment: the denizens this side may send, and the tiers they derive.
       Defaulted here so a Side is complete before start() assigns the real
       picks; start() replaces both. */
    this.musterLoadout = MUSTER_BASE_UNLOCK.slice();
    this.musterTiers = musterTiersFor(this.musterLoadout);
    /* RESONANT FIELD, per side. It used to be one game-global counter that
       only the player could pay into, so the rival's identical wave also
       arrived with the bounty bonus -- it collected a payout the player
       bought and could never be charged for one itself. The charge now rides
       only the spawn entries marching on the side that paid for it. */
    this.enrage = 0; this.enrageSpent = 0;
    /* Rubble THIS commander has demolished. The allowance (CLEAR_MAX plus
       SURVEY TEAM) and the compounding price are per side; one shared Set
       meant a rival's land card ate the player's allowance and raised the
       player's next price. Game.clearedTerrain remains the UNION of these,
       because `blocked` and the background describe one board with no owner
       -- and ownsTile partitions the grid, so the per-side sets are disjoint
       by construction. */
    this.cleared = new Set();
    this.stats = { kills: 0, goldEarned: 0, leaked: 0, built: 0, sent: 0, livesRestored: 0, mustered: 0 };
  }
  get alive() { return this.lives > 0; }
  /** How many of a tower type this side already fields — drives price growth. */
  countOf(type) { let n = 0; for (const t of this.towers) if (t.type === type) n++; return n; }
}

const Game = {

  canvas: null, ctx: null, width: 0, height: 0, dpr: 1, bgCanvas: null,

  state: 'menu',              // menu | playing | choosing | over
  paused: false, speed: 1,

  difficulty: null,
  lanes: [], sendPaths: [], airLanes: [], blocked: null,
  enemyDamp: [null, null],       /* set by defensive commander abilities */
  sides: [], viewSide: 0,

  enemies: [], projectiles: [], particles: [], floaters: [],
  beams: [], puddles: [], pendingSpawns: [], delayed: [],

  wave: 0, spawnQueue: [], prepTimer: 0, waveRunning: false,
  enemyMods: [], pendingChoice: null,
  clock: 0,

  selectedType: null, selected: null,
  /* Index of the ability armed for aiming, or null. It lives on Game rather
     than on the side because it is a cursor mode, not simulation state. */
  aimingAbility: null, constructs: [],
  /* The drag-out placement ring, or null. Cursor state for the same reason
     aimingAbility is: it decides what the next release means, and nothing in
     the simulation may read it. */
  radial: null,
  hover: { gx: -1, gy: -1, active: false },
  shakeAmt: 0, hurtFlash: 0, bannerText: '', bannerTimer: 0, bannerMax: 1, bannerColor: '#e6f5ff',

  /* ============================================================== SETUP */

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bgCanvas = document.createElement('canvas');
    this.bindInput();
    this.lastTs = 0; this.acc = 0;
    requestAnimationFrame(ts => this.loop(ts));
  },

  /**
   * The board used to be sized purely from `FIELD.cols * TILE` and never looked
   * at the viewport, so at 1366x768 -- one of the most common laptop sizes --
   * the bottom of the field was clipped by `body { overflow: hidden }` with no
   * scrollbar to recover it (Delta lost 85px, including a lane tile), while at
   * 1920x1080 roughly 856px of width simply went unused.
   *
   * The logical field keeps its exact tile dimensions, so every coordinate in
   * the simulation is untouched; only the CSS size is fitted to the available
   * box, and the backing store stays at device resolution so it stays sharp.
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.width = FIELD.cols * TILE;
    this.height = FIELD.rows * TILE;

    /* The container can report a near-zero box when the game screen has not been
       laid out yet -- mid screen-transition, or on the very first frame. Fitting
       to that would lock the board at the minimum scale and leave it there, so
       an implausible measurement falls back to the viewport and schedules a
       re-fit once layout settles. */
    const box = this.canvas.parentElement;
    let availW = box ? box.clientWidth - 8 : 0;
    let availH = box ? box.clientHeight - 10 : 0;
    const unlaidOut = availW < 240 || availH < 200;
    if (unlaidOut) {
      /* The sidebar is two columns wide on a big screen and one on a small
         one, so the guess reads the sidebar's own width when it has one and
         assumes the wide layout otherwise (see SIDEBAR_WIDE_PX). */
      const sbEl = document.getElementById('sidebar');
      const sbW = (sbEl && sbEl.offsetWidth) || SIDEBAR_WIDE_PX;
      availW = Math.max(320, window.innerWidth - sbW - STAGE_CHROME_PX);
      availH = Math.max(240, window.innerHeight - 210);
      if (!this._refitQueued) {
        this._refitQueued = true;
        requestAnimationFrame(() => {
          this._refitQueued = false;
          const b2 = this.canvas.parentElement;
          if (b2 && b2.clientWidth > 240 && b2.clientHeight > 200) {
            this.resize();
            if (FIELD) this.renderBackground();
          }
        });
      }
    }
    /* Fill the space that is actually available. The board is the game, so it
       gets to grow; 1.9x is where the hand-drawn sprites start to soften. */
    this.viewScale = Math.min(1.9, availW / this.width, availH / this.height);

    const cssW = Math.round(this.width * this.viewScale);
    const cssH = Math.round(this.height * this.viewScale);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    const k = dpr * this.viewScale;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
  },

  start(opts = {}) {
    this.difficulty = DIFFICULTIES.find(d => d.id === opts.difficulty) || DIFFICULTIES[1];
    /* THE MAELSTROM is synthesised from its seat count rather than authored,
       so it is not in MAPS and cannot be reached from the campaign trail. */
    this.map = opts.maelstrom ? maelstromMap(opts.maelstrom)
                              : (MAPS.find(m => m.id === opts.map) || MAPS[0]);
    FIELD = buildField(this.map);

    /* Who GARRISONS this world decides whether its own troops march beside the
       Vigil, and the roster is fixed ONCE here because the preview, the rival's
       threat model and the spawn all read it -- deriving it three times is how
       they would come to disagree. Both sides face the identical wave, so this
       is world state and not a lever either commander holds. */
    this.hostFaction = battleHostFaction(opts);
    this.battleRoster = battleRosterFor(this.map, this.hostFaction);

    /* Each side may have SEVERAL lanes; lanes[side] is an array of Paths. */
    this.lanes     = FIELD.lanes.map(side => side.map(p => new Path(p)));
    this.sendPaths = FIELD.sendPaths.map(p => new Path(p));
    /* In the arena every send route IS its victim's own lane -- the singularity
       is the only road in -- so the matrix points at the Paths built on the
       line above instead of at N^2 fresh copies of them. Four hundred
       duplicate Paths would also make `e.path === lanes[victim]` false for
       every sent unit, and things that compare paths (the AI's coverage
       sampling, the lane overlay) would be reasoning about the wrong object. */
    this.sendTriPaths = FIELD.sendTri
      ? FIELD.sendTri.map(row => row.map((p, j) =>
          !p ? null : (FIELD.radial ? this.lanes[j][0] : new Path(p))))
      : null;
    this.airLanes  = FIELD.airLanes.map(p => new Path(p));

    /* Unbuildable = every lane tile plus map terrain. Send paths are no longer
       separate ground — a reanimate retraces your own lane backwards and then
       runs your rival's forwards — so they contribute no tiles of their own.
       They stay in the loop below because the union is free and the code stays
       correct if a future map ever routes them elsewhere. */
    this.blocked = new Set(FIELD.terrain);
    /* Lane tiles are tracked apart from scenery. Rubble clearance reads this
       set to guarantee it can never demolish a tile the path runs through --
       which would silently reroute or break the lane. */
    this.laneBlocked = new Set();
    /* EVERY side's lanes, not the first two: on a three-commander board that
       omission left side 2's own corridor buildable, so it could wall its lane
       with towers and the other two could not. */
    for (const p of [].concat(...this.lanes, this.sendPaths))
      for (const k of p.blockedTiles()) { this.blocked.add(k); this.laneBlocked.add(k); }

    /* CONFLUENCE fields three commanders; everywhere else two. */
    this.triMode = !!FIELD.tri;
    /* THE ARENA RULE, read off the BOARD and never off a side: nothing that
       walks into a seat reanimates for its defender (see killEnemy). A rule
       held per-side would have to be re-stated twenty times and would be wrong
       the first time a seat was added. */
    this.noReanim = !!FIELD.noReanim;
    /* Drives the HUD swap below the seat ladder: twenty commanders cannot each
       have a panel, so the arena spends RIVAL II's slot on the ladder instead
       and the row keeps exactly the width a three-way board already ships. */
    document.body.classList.toggle('arena-field', !!FIELD.radial);
    /* The event horizon, in L1 tiles from the centre, and the ground it has
       already taken. Empty everywhere but the arena. */
    this.horizon = FIELD.horizon || 0;
    this.consumed = new Set();
    /* Drives the narrower three-panel HUD; two panels plus a third do not
       fit at 232px each below ~1180px wide. */
    document.body.classList.toggle('tri-field', this.triMode);
    /* The third commander's HUD panel is built LAZILY by the UI and nothing
       else ever removed it, so one CONFLUENCE battle left a dead rival's name
       and lives standing over every later two-sided one. Drop it here, at the
       one moment every battle passes through; syncLive rebuilds it when this
       field actually has a third commander. */
    if (typeof UI !== 'undefined' && UI.dropTriRival) UI.dropTriRival();
    /* One Side per seat: two for a duel, three for a tri board, up to
       MAELSTROM_MAX_SEATS in the arena. Every loop in the engine was already
       written against `this.sides.length`, so the only thing that changes here
       is how many there are. */
    const seatCount = FIELD.seats || (this.triMode ? 3 : 2);
    this.sides = [new Side(0, false, this.difficulty)];
    for (let i = 1; i < seatCount; i++) this.sides.push(new Side(i, true, this.difficulty));
    this.arenaSeats = seatCount;
    this.viewSide = 0;
    this.enemyDamp = this.sides.map(() => null);

    /* Factions: yours from the save, the rival's from whoever holds the world. */
    const myFaction = opts.faction || Meta.faction() || 'human';
    this.sides[0].faction = myFaction;
    this.sides[1].faction = opts.rivalFaction ||
      rivalFactionsOf(myFaction)[Math.floor(Math.random() * 3)];
    if (this.triMode) {
      /* On a CONTESTED world the two powers already fighting over it are the
         rivals; elsewhere the three core powers take the table. */
      let core = (opts.contestedBy || []).filter(f => f && f !== myFaction);
      if (core.length < 2)
        core = core.concat(['human', 'light', 'xeno', 'pirate']
          .filter(f => f !== myFaction && !core.includes(f)));
      this.sides[1].faction = core[0];
      this.sides[2].faction = core[1];
    }
    /* Seats past the third are the arena's. Powers are dealt round the ring in
       FACTION_ORDER so all four are represented and no arc of the board reads
       as one colour; the commander behind each seat is drafted in the kit
       block below, once the two rivals above have taken theirs. */
    for (let i = 3; i < this.sides.length; i++)
      this.sides[i].faction = FACTION_ORDER[i % FACTION_ORDER.length];
    for (const S of this.sides) {
      const f = FACTIONS[S.faction];
      if (f) f.apply(S);
    }

    /* Commanders: yours from the meta save, the rival's picked to contrast. */
    Meta.applyTo(this.sides[0], opts.commander || COMMANDERS[0].id);
    const rivalPool = COMMANDERS.filter(c => c.id !== this.sides[0].commander.id);
    let rival = (opts.rival && COMMANDERS.find(c => c.id === opts.rival)) ||
                rivalPool[Math.floor(Math.random() * rivalPool.length)];
    /* rivalPool excludes the player's own commander, but only the RANDOM
       fallback draws from it -- an explicit opts.rival was installed
       unchecked, so a world whose commander you happen to be fielding put the
       same name and portrait on both ends of the board. */
    if (rival.id === this.sides[0].commander.id)
      rival = COMMANDERS.find(c => c.faction === this.sides[1].faction &&
                                   c.id !== rival.id) || rivalPool[0];
    /* The rival is a fully-realised commander too — but realised to the same
       DEPTH you are. A flat "near-complete tree" meant a level-one profile met
       a rival with sixteen of eighteen tech points and no way to answer it.
       The rival's budget now tracks the player's own spend, magnified by the
       threat level, with a small floor so it is never a walkover. */
    const playerTech = Meta.techSpent(this.sides[0].commander.id);
    let rivalTech = clamp(Math.round(Math.max(2, playerTech) * (0.9 + 0.8 * this.difficulty.aiSkill)), 2, 18);
    /* A commander's own seat is a duel, not another skirmish: they field their
       complete technology chart and both abilities regardless of where the
       player's progression happens to be. */
    this.isSeatBattle = !!opts.seat;
    /* A multiplayer practice skirmish must never touch the campaign ledger. */
    this._skirmish = !!opts.skirmish;
    this._overDrawn = false;
    this.galaxyTier = this._skirmish ? 0 : ((Meta.campaign() && Meta.campaign().tier) || 0);
    if (this.isSeatBattle) rivalTech = 18;
    Meta.applyToAI(this.sides[1], rival.id, rivalTech);

    /* Loadouts: five towers each. The rival drafts its own coherent set. */
    this.sides[0].loadout = (opts.loadout && opts.loadout.length ? opts.loadout : TOWER_ORDER.slice(0, LOADOUT_SIZE)).slice(0, LOADOUT_SIZE);
    /* The rival drafts under the SAME origin law the player unlocks under:
       its own power's hardware plus the human and robotic commons, never a
       third power's. A shelf the player is forbidden is not a difficulty
       setting, it is an asymmetry. */
    this.sides[1].loadout = AI.pickLoadout(this.map, this.difficulty,
                                           Meta.unlockedTowers(), this.sides[1].faction);
    /* Variety parity: the rival fields exactly as many tower TYPES as you do.
       Once you have claimed two worlds it earns one more than you -- never
       more than the loadout maximum. */
    {
      const c = this._skirmish ? null : Meta.campaign();
      let conquered = 0;
      if (c && c.stars) for (const k in c.stars) if (c.stars[k] >= 3) conquered++;
      const variety = Math.min(LOADOUT_SIZE,
        this.sides[0].loadout.length + (conquered >= 2 ? 1 : 0));
      if (this.sides[1].loadout.length > variety)
        this.sides[1].loadout = this.sides[1].loadout.slice(0, variety);
    }
    /* MUSTER DETACHMENT: yours is the profile's picked denizens; the rival
       drafts its own spread from the SAME shared vault, capped at your
       detachment size -- parity on the pool and the count, its own taste on
       the picks, exactly as the tower loadout above is handled. Tiers are
       derived ONCE here because a detachment is fixed for a battle, and the
       send, the rival's valuation and the sidebar preview all read that one
       list, so they cannot disagree. */
    this.setMusterLoadout(0, (opts.musterLoadout && opts.musterLoadout.length)
      ? opts.musterLoadout : Meta.musterLoadout());
    this.setMusterLoadout(1, AI.pickMusterLoadout(Meta.musterUnlocked(), this.sides[0].musterLoadout.length));

    /* Talents are prepared before the match: yours from the saved trees, the
       rival's drafted to suit its own loadout — and only as deep as your own
       tower mastery currently reaches, plus a row on Overrun. */
    /* Soul investment: yours as banked, the rival's mirrored to the same average
       so progression parity holds the way the loadout roster already does. */
    if (this.isSeatBattle) {
      const rc = this.sides[1].commander;
      setTimeout(() => this.banner('⚔  ' + rc.name + ' — ' + rc.title.toUpperCase(), 3.4,
                                   FACTIONS[this.sides[1].faction].color), 500);
    }

    /* Base level. Starts at 1, raised by the Federation's ILLUMINATED bonus
       and by commander traits that grant a starting tower level -- both of
       which previously set flags nothing consumed. */
    for (const S of this.sides)
      S.baseLevel = 1 + (S.startLevelBonus || 0) + ((S.traits && S.traits.startLevel) || 0);

    /* SOUL LEVELS RETIRED. Session 11 made the soul shop unlocks-only and
       deleted the only writer of p.soulTower, so Meta.soulLevels() returned
       {} for every profile created since -- soulPower was dead code, and the
       rival's mirror averaged an empty dictionary, which made the "soul level
       mirrors the player's" half of ROADMAP:204 vacuous on BOTH sides. The
       path is removed rather than re-homed onto (fight-earned) mastery:
       re-homing +7.5% damage / +3.5% rate is a live balance change to both
       calibrated pins, not a dead-code fix. Mastery still carries weight --
       it gates talents, which is weight the engine actually reads. */

    this.sides[0].talentSets = {};
    for (const id of this.sides[0].loadout) this.sides[0].talentSets[id] = Meta.talentMods(id);
    const mine = this.sides[0].loadout.map(id => (this.sides[0].talentSets[id] || []).length);
    const myDepth = mine.length ? Math.round(mine.reduce((a, b) => a + b, 0) / mine.length) : 1;
    const rivalDepth = clamp(myDepth + (this.difficulty.aiSkill >= 1 ? 1 : 0), 1, TALENT_POINTS);
    this.sides[1].talentSets = AI.pickTalents(this.sides[1].loadout, rivalDepth);
    this.rivalDepth = rivalDepth; this.rivalTech = rivalTech;

    this.enemies = []; this.projectiles = []; this.particles = []; this.floaters = [];
    /* The UNION of every side's demolitions -- one board, one renderer, one
       `blocked` set. The ALLOWANCE that prices them lives on each Side. */
    this.clearedTerrain = new Set();
    this.escalationOwed = []; this.pendingEscalation = null; this.escalationBoon = 0;
    this.escalationQueue = 0;
    this.movingTower = null; this.selectedRubble = null; this.selectedNode = null;
    this.aimingAbility = null; this.constructs = []; this.radial = null;
    this.beams = []; this.puddles = []; this.pendingSpawns = []; this.spawnQueue = [];
    this.delayed = [];
    this.arenaSpeed = 1; this.arenaArmor = 0; this.arenaTempo = 1;
    this.enemyMods = []; this.pendingChoice = null;
    this.pendingEscalation = null; this.pendingDraft = false;
    this.drift = { hp: 0, speed: 0, armor: 0 };
    this.lastDrift = null;

    this.wave = 0; this.clock = 0;
    this.prepTimer = prepTime(0);
    this.waveRunning = false;
    this.speed = 1; this.paused = false;
    this.selectedType = null; this.selected = null;
    this.shakeAmt = 0; this.hurtFlash = 0;
    this.state = 'playing';

    if (this.triMode) {
      /* A free commander can already be sitting at side 1 -- a squatted world
         hands side 1 the world's own boss, who may be side 2's free pick --
         and the intro card then showed one portrait, one name and one colour
         twice. Every faction has five commanders, so the first branch always
         resolves. */
      let rc2 = freeCommanderOf(this.sides[2].faction);
      if (rc2 === this.sides[1].commander.id) {
        const alt = commandersOf(this.sides[2].faction).find(c => c.id !== rc2) ||
                    COMMANDERS.find(c => c.id !== rc2 && c.id !== this.sides[0].commander.id);
        if (alt) rc2 = alt.id;
      }
      Meta.applyToAI(this.sides[2], rc2, rivalTech);
      /* Its OWN power's arsenal. Copying side 1's handed the third commander
         hardware gated to a faction that is not theirs -- and their own never
         appeared on the board at all. Sliced to side 1's length because the
         variety-parity block above may already have trimmed side 1 to the
         player's own arsenal size, and the third seat may never field more
         tower types than either of them. */
      this.sides[2].loadout = AI.pickLoadout(this.map, this.difficulty,
                                             Meta.unlockedTowers(), this.sides[2].faction)
                                .slice(0, this.sides[1].loadout.length);
      this.setMusterLoadout(2, this.sides[1].musterLoadout);
      this.sides[2].talentSets = AI.pickTalents(this.sides[2].loadout, this.rivalDepth);
      this.sides[2].baseLevel = this.sides[1].baseLevel || 1;
    }
    /* Every arena seat past the third is a commander in its own right: its own
       technology chart, its own five towers, its own detachment, its own gold.
       Drafted HERE, after the two rivals above have claimed their officers, so
       no two seats field the same one while any is still unclaimed. Variety is
       held to the same count RIVAL I fields, which is the count parity the
       player is promised (ROADMAP:204) -- a seat with a wider shelf than the
       rival beside it would be a difficulty setting, not a commander. */
    if (this.arenaSeats > 3) {
      const taken = new Set(this.sides.slice(0, 3).map(S2 => S2.commander && S2.commander.id));
      const variety = this.sides[1].loadout.length;
      for (let i = 3; i < this.sides.length; i++) {
        const S2 = this.sides[i];
        const own = commandersOf(S2.faction).filter(c => !taken.has(c.id));
        const spare = COMMANDERS.filter(c => !taken.has(c.id));
        const cmd = own[0] || spare[0] || COMMANDERS[i % COMMANDERS.length];
        taken.add(cmd.id);
        Meta.applyToAI(S2, cmd.id, rivalTech);
        S2.loadout = AI.pickLoadout(this.map, this.difficulty, Meta.unlockedTowers(), S2.faction);
        if (S2.loadout.length > variety) S2.loadout = S2.loadout.slice(0, variety);
        this.setMusterLoadout(i, AI.pickMusterLoadout(Meta.musterUnlocked(),
                                                      this.sides[0].musterLoadout.length));
        S2.talentSets = AI.pickTalents(S2.loadout, this.rivalDepth);
        S2.baseLevel = this.sides[1].baseLevel || 1;
      }
    }
    /* One brain per AI side. The singleton pattern could not host two rivals. */
    this.brains = this.sides.slice(1).map((S2, i) => {
      const b = Object.create(AI); b.init(S2, this.difficulty);
      /* Nineteen brains sharing one 0.55s clock would all deliberate on the
         same frame; the stagger spreads them across the interval instead.
         GATED ON THE ARENA. One or two brains do not hitch anything, and
         moving a rival's deliberation clock by 0.11s on a board that already
         ships changes when it draws -- which is a different battle from the
         same seed, on the two boards the balance pins were measured on.
         Measured: with this gate, a seeded duel AND a seeded three-way replay
         are bit-identical to the unpatched engine. */
      if (FIELD.radial) b.think += i * MAELSTROM_THINK_STAGGER;
      return b;
    });
    AI.init(this.sides[1], this.difficulty);

    /* Campaign context: the node's arena modifier warps this battle for BOTH
       sides; your accumulated boons apply to you alone. */
    for (let i = 0; i < (opts.escStart || 0); i++) this.addEnemyMod();
    this.arenaMod = null;
    if (opts.arena) {
      this.arenaMod = ARENA_MODS.find(a => a.id === opts.arena) || null;
      if (this.arenaMod) this.arenaMod.apply(this);
    }
    const S0 = this.sides[0];
    S0.boonMods = {};
    for (const bid of (opts.boons || [])) {
      const b = BOONS.find(x => x.id === bid);
      if (b) b.apply(S0.boonMods);
    }
    if (S0.boonMods.bonusLives) { S0.maxLives += S0.boonMods.bonusLives; S0.lives += S0.boonMods.bonusLives; }
    if (S0.boonMods.bonusDraft) S0.traits.draftOptions += S0.boonMods.bonusDraft;
    if (S0.boonMods.goldMul) S0.mods.gold *= S0.boonMods.goldMul;
    if (S0.boonMods.reanimMul) S0.mods.reanim += S0.boonMods.reanimMul;
    if (S0.boonMods.leakShield) S0.traits.leakReduction += S0.boonMods.leakShield;

    /* Commanders that begin with doctrine already in hand. */
    let openedGround = false;
    for (const S of this.sides) {
      for (let i = 0; i < S.traits.startingMods; i++) {
        const m = pick(PLAYER_MODS);
        m.apply(S.mods, S);
        S.taken.push(m);
        if (m.land) openedGround = true;
      }
    }
    /* A land card in the OPENING HAND demolishes rubble the brains sampled as
       unbuildable in init(), which runs above this. Only the DRAFT path
       (AI.chooseMod) ever re-sampled, so a rival that opened with SAPPER CORPS
       spent the card and then never built on the ground it bought -- for the
       whole battle. The player has no such cache to go stale, which makes this
       a parity bug rather than a rendering one. */
    if (openedGround) for (const b of this.brains) b.buildSpots();

    this.resize();
    this.renderBackground();
    Sound.resume(); Sound.setIntensity(1); Sound.startMusic(1);
    this.banner('HOLD THE LINE', 2.4);
    UI.syncAll();
  },

  /* ========================================================== WAVE CYCLE */

  waveDef(n) {
    const legion = this.enemyMods.filter(m => m.countMul).reduce((a, m) => a * m.countMul, 1);
    /* One function still builds every wave, so the preview, the AI's threat
       model and the actual spawn cannot disagree -- that has not changed. What
       changed is that the composition now comes from this battle's roster on
       the introduction schedule, instead of from a global table plus a bolted
       -on denizen group. LEGION and COUNT_SCALE fold into one count multiplier
       so composeWave rounds ONCE, at the end, against the real target. */
    const roster = (this.battleRoster && this.battleRoster.length)
      ? this.battleRoster : battleRosterFor(this.map, null);
    return composeWave(n, roster, this.map,
                       waveCountMultiplier(n) * legion * COUNT_SCALE);
  },

  /** Composition summary used by the preview panel and by the AI's scouting. */
  /* THE health multiplier for a wave — the single definition every consumer
     reads. It existed three times before (startWave, waveProfile and the UI's
     roster panel), and the third copy silently omitted the galaxy-tier term,
     so from galaxy II onward the preview understated every enemy by 30% per
     tier. That is the FOURTH time this bug class has shipped, so there is now
     exactly one place to omit a term from. Drift is deliberately NOT folded
     in: the spawn applies it per unit, and callers that need it say so. */
  waveHpMul(n, rage) {
    return waveHpMultiplier(n) * this.difficulty.hp * UNIT_HP_SCALE
           * (1 + 0.3 * (this.galaxyTier || 0))
           * (1 + ENRAGE_HP * (rage || 0));
  },

  /* THE miniboss rule -- one escorts every fifth wave, one body per lane per
     side. startWave pushes it OUTSIDE def.groups, so every model that
     iterates def.groups alone silently misses the single heaviest body in the
     wave: the roster preview showed three ordinary types under a header that
     announced a miniboss, and AI.profile() under-built against waves 5/15/25
     by 22-46%. The rule was open-coded in startWave and again in the panel's
     `isMini`; it is now stated once and read three times. BATCH-A/numbers

     BOSS WAVES ARE NO LONGER EXEMPT, and that is a reschedule rather than a
     curve extension. The exemption dropped the SLOT but not the INDEX, so two
     of the five creatures -- VESPER and ORACLE -- were rostered at waves 35
     and 45. waveHpMultiplier's own comment calls ~25 "a terminus, not an
     asymptote", the calibration pins the deepest maxed run at 27, and wave 45
     carries 62,000x the mass of wave 27: those two were unreachable content,
     and their dossier cards (gated on a real spawn) could never open.
     Extending the curve to reach them would throw away a deliberate,
     documented terminus and every pin measured against it, so the rota moves
     instead. Measured consequence: waves 5, 15 and 25 field exactly the
     creature they field today, waves 10 and 20 gain an escort worth +4.0% of
     their mass beside a boss that already dominates them, and the "every 5
     waves" the sidebar and the Field Manual both print becomes true for the
     first time. `def` stays in the signature so waveProfile and startWave
     need no edit. BATCH-C/nside */
  minibossFor(n, def) {
    if (n % MINIBOSS_EVERY !== 0) return null;
    return MINIBOSSES[(Math.floor(n / MINIBOSS_EVERY) - 1) % MINIBOSSES.length];
  },

  waveProfile(n) {
    const def = this.waveDef(n);
    /* UNIT_HP_SCALE must be here too. startWave() applies it when the wave is
       actually built, so leaving it out of the model meant the player-facing
       preview understated every wave by 45% and AI.profile() -- which reads
       this -- under-built against every wave, permanently. */
    /* Drift is applied per unit at spawn (`if (o.drift) this.maxHp *= 1 +
       o.drift.hp`), which is why waveHpMul deliberately leaves it out -- but a
       THREAT MODEL is not a per-unit multiplier, it is what the wave will
       weigh, and AI.profile() reads this. Without the term the rival
       under-built against every wave by (1 + drift.hp), growing +0.10 each
       time VIGOUR is rolled. musterHpMul folds it in for the same reason. */
    const hpMul = this.waveHpMul(n) * (1 + this.drift.hp);
    const p = { total: 0, hp: 0, flyingHp: 0, groundHp: 0, armorHp: 0, shieldHp: 0,
                count: 0, flying: 0, healers: 0, boss: def.boss, roster: {},
                rosterHp: {}, name: def.name };
    for (const g of def.groups) {
      const e = ENEMY_TYPES[g.type];
      if (!e) continue;
      /* hpScale is the share of its slot's mass this group actually carries.
         It is a MULTIPLIER THE SPAWN APPLIES, so any model or panel that omits
         it understates the wave -- the same failure UNIT_HP_SCALE caused. */
      let hp = e.hp * hpMul * (g.hpScale || 1) * g.count;
      for (const m of this.enemyMods) if (m.hpMul) hp *= m.hpMul;
      p.hp += hp; p.count += g.count;
      p.roster[g.type] = (p.roster[g.type] || 0) + g.count;
      /* Total health per TYPE, so the preview can print what one of them will
         actually arrive with rather than re-deriving the multiplier chain. */
      p.rosterHp[g.type] = (p.rosterHp[g.type] || 0) + hp;
      if (e.flying) { p.flying += g.count; p.flyingHp += hp; } else p.groundHp += hp;
      if (e.armor >= 8) p.armorHp += hp;
      if (e.shield) p.shieldHp += hp;
      if (e.healRate) p.healers += g.count;
    }
    /* The escort, on the same terms the group loop uses -- same local hpMul,
       same escalation fold -- so the new row cannot disagree with the rows
       beside it. startWave queues one per lane per side and lanes are
       mirrored (and single on tri boards), so lanes[0].length is the
       per-side count; the guard covers a profile taken before Game.start. */
    const mb = this.minibossFor(n, def);
    p.miniboss = mb;
    const mbDef = mb ? ENEMY_TYPES[mb] : null;
    if (mbDef) {
      const count = (this.lanes && this.lanes[0]) ? this.lanes[0].length : 1;
      let hp = mbDef.hp * hpMul * count;
      for (const m of this.enemyMods) if (m.hpMul) hp *= m.hpMul;
      p.hp += hp; p.count += count;
      p.roster[mb] = (p.roster[mb] || 0) + count;
      p.rosterHp[mb] = (p.rosterHp[mb] || 0) + hp;
      if (mbDef.flying) { p.flying += count; p.flyingHp += hp; } else p.groundHp += hp;
      if (mbDef.armor >= 8) p.armorHp += hp;
      if (mbDef.shield) p.shieldHp += hp;
      if (mbDef.healRate) p.healers += count;
    }
    p.total = p.hp;
    return p;
  },

  /** True when the player may rush. Against the AI a single vote is enough. */
  canRush() {
    return this.state === 'playing' && !this.waveRunning && this.prepTimer > 0.4;
  },

  rushWave() {
    if (!this.canRush()) { Sound.play('denied'); return; }
    const skipped = this.prepTimer;
    const bonus = Math.round(skipped * RUSH_GOLD_PER_SEC);
    /* The floater must print what landed, not what was asked for: mods.gold
       sits between the two, and the button beside it now previews the same. */
    const paid = this.awardGold(0, bonus);
    this.addFloater(this.width * 0.25, 46, '+' + paid + ' RUSH', false, '#fbbf24', 20);
    /* The AI is compensated so rushing is a tempo choice, not free damage --
       EVERY rival, not side 1. On a three-way board the hard-coded index paid
       the third commander nothing, so the player bought tempo against it for
       free all match. On a two-sided board the loop runs exactly once and the
       behaviour is bit-identical. */
    for (let si = 1; si < this.sides.length; si++)
      this.awardGold(si, Math.round(bonus * RUSH_AI_COMPENSATION));
    this.prepTimer = 0;
    this.startWave();
  },

  startWave() {
    this.wave++;

    /* Every wave, one random enemy statistic drifts permanently upward. The
       HUD shows the running totals so the creep is always legible. */
    const d = pick(STAT_DRIFT);
    this.drift[d.id] += d.amount;
    this.lastDrift = d;

    const def = this.waveDef(this.wave);
    /* Resonance was bought against THIS wave, and it is the BUYER'S wave
       alone. One pair of multipliers per side: composition, count, lane and
       instant stay identical for everyone (that invariant is the whole point
       of attrition), and only the charge a commander paid for rides the wave
       marching on its own base. Spend and reset per side so a charge can
       never silently carry into the next wave either. */
    const hpMuls = [], bountyMuls = [], rageMuls = [];
    /* The charge's own share of the wave, taken as a RATIO of waveHpMul
       against itself rather than rebuilt out of ENRAGE_HP: that function is
       the single definition of a wave's health and restating any term of it
       is how the preview and the engine came to disagree six times. Carried
       on each unit so reanimate can take it back off the corpse. */
    const plainHp = this.waveHpMul(this.wave, 0);
    for (const S of this.sides) {
      const rage = S.enrage || 0;
      S.enrageSpent = rage;
      S.enrage = 0;
      hpMuls[S.index] = this.waveHpMul(this.wave, rage);
      rageMuls[S.index] = hpMuls[S.index] / plainHp;
      bountyMuls[S.index] = waveBountyMultiplier(this.wave) * (1 + ENRAGE_BOUNTY * rage);
    }

    /* Identical composition to BOTH sides at the same instants. On multi-lane
       maps each group alternates lanes so both forks stay live. */
    let laneCursor = 0;
    for (const grp of def.groups) {
      for (let i = 0; i < grp.count; i++) {
        const t = this.clock + (grp.delay + i * grp.gap) * SPAWN_TEMPO * this.arenaTempo;
        const lane = laneCursor++;
        for (let side = 0; side < this.sides.length; side++) {
          /* A seat that has already fallen receives nothing. Queueing a wave at
             a dead commander spawns units into a lane with no towers left, and
             every one of them walks the whole path purely to leak -- which
             re-enters the defeat path and re-announces the fall on every leak. */
          if (this.sides[side].defeated) continue;
          /* Identical entry for EVERY side still standing, group scalars
             included: the wave is the same wave for every commander, which is
             the parity the whole attrition loop rests on. */
          this.spawnQueue.push({ t, type: grp.type, side, lane,
                                 hpMul: hpMuls[side] * (grp.hpScale || 1),
                                 rageMul: rageMuls[side],
                                 bountyMul: bountyMuls[side] * (grp.bountyScale || 1) });
        }
      }
    }

    /* A miniboss escorts every fifth wave, boss waves included. The rule
       itself is minibossFor, so the preview and the threat model queue the
       same body this loop does. */
    const mb = this.minibossFor(this.wave, def);
    if (mb) {
      for (let side = 0; side < this.sides.length; side++)
        for (let lane = 0; lane < this.lanes[side].length && !this.sides[side].defeated; lane++)
          this.spawnQueue.push({ t: this.clock + 3, type: mb, side, lane,
                                 hpMul: hpMuls[side], rageMul: rageMuls[side],
                                 bountyMul: bountyMuls[side] });
      this.minibossName = ENEMY_TYPES[mb].name;
    } else this.minibossName = null;

    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.waveRunning = true;

    Sound.setIntensity(this.wave >= 12 ? 3 : this.wave >= 5 ? 2 : 1);
    Sound.setTempo(96 + Math.min(30, this.wave * 2));
    /* The boss banner OVERRIDES the miniboss one, and boss waves now carry an
       escort -- so it names both rather than letting the second-heaviest body
       in the wave arrive unannounced. BATCH-C/nside */
    if (def.boss) { Sound.play('bossWarn'); this.banner('⚠  ' + def.name +
      (this.minibossName ? '  +  ' + this.minibossName : '') + '  ⚠', 3.2, '#ef4444'); }
    else if (this.minibossName) { Sound.play('miniboss'); this.banner('MINIBOSS — ' + this.minibossName, 2.8, '#ffd166'); }
    else { Sound.play('waveStart'); this.banner('WAVE ' + this.wave + ' — ' + def.name, 2.2); }
    /* Announced after the wave banner because it OVERRIDES it: the ground
       going out from under you is the more urgent of the two, and the banner
       it writes carries the wave number so nothing is lost. */
    this.maelstromContract();
    UI.syncAll();
  },

  /** Called the moment the last unit of a wave has spawned. */
  onWaveSpawned() {
    this.waveRunning = false;
    this.prepTimer = prepTime(this.wave);

    for (const S of this.sides) {
      /* Interest is read BEFORE the wave reward lands, so it prices the gold
         you actually chose to hold rather than the gold you were just paid. */
      const int0 = interestOn(S.gold, this.wave, S.mods.interest);
      if (int0 > 0) {
        /* Record and report the CREDITED figure -- awardGold applies mods.gold
           on top of the interest rate, and the sidebar previews the same. */
        const paidInt = this.awardGold(S.index, int0);
        S.lastInterest = paidInt;
        if (S.index === 0) this.addFloater(this.width * 0.25, 66,
                                           '+' + paidInt + ' INTEREST', false, '#fbbf24', 17);
      } else { S.lastInterest = 0; }
      this.awardGold(S.index, waveReward(this.wave));
      /* MUSTER pays here, beside the wave reward, because it IS wave income:
         gold spent on aggression comes back every wave for the rest of the
         battle. `musterPayout` applies the ceiling, so no sequence of buys
         can turn this into the runaway the mechanic is prone to. */
      const mus = musterPayout(S.musterIncome, this.wave);
      if (mus > 0) {
        const paidMus = this.awardGold(S.index, mus);
        S.lastMuster = paidMus;
        if (S.index === 0) this.addFloater(this.width * 0.25, 88,
                                           '+' + paidMus + ' MUSTER', false, '#f97316', 17);
      } else { S.lastMuster = 0; }
      /* The per-cycle allowance resets with the wave that consumed it. */
      S.musterThisWave = 0;
      /* Halder's Triage, and the Vault's War Bonds technology. */
      if (S.traits.waveHeal) this.restoreLife(S.index, S.traits.waveHeal);
      for (const t of S.towers) if (t.stats.waveBonus) this.awardGold(S.index, t.stats.waveBonus, t);
    }
    Sound.play('waveClear');

    /* Every 10 waves the enemy escalates — and the later steps stack harder. */
    if (this.wave % 10 === 0) {
      const n = this.wave >= 30 ? 3 : this.wave >= 20 ? 2 : 1;
      for (let i = 0; i < n; i++) this.addEnemyMod();
    }

    /* Command upgrades arrive on each commander's own cadence. */
    for (let si = 1; si < this.sides.length; si++)
      if (this.wave % this.sides[si].traits.draftEvery === 0 && !this.sides[si].defeated)
        this.brains[si - 1].chooseMod(this.drawMods(this.sides[si]));
    if (this.wave % this.sides[0].traits.draftEvery === 0) this.offerChoiceWhenClear();
    UI.syncAll();
  },

  /** Buy a harder next wave for a bigger payout. Costs gold now, pays on kills. */
  /* Side-generic, like buyBaseLevel and muster before it: the price
     compounds against the BUYER's own stack, so two commanders bidding on the
     same wave each pay their own ladder. */
  enrageCost(side) {
    const S = this.sides[side || 0];
    return Math.round(waveReward(this.wave + 1) * 0.30 * Math.pow(1.7, S.enrage || 0));
  },
  buyEnrage(side) {
    const si = side || 0;
    const S = this.sides[si];
    if (!S || !S.alive) return false;
    if (this.waveRunning || (S.enrage || 0) >= ENRAGE_MAX) return false;
    const c = this.enrageCost(si);
    if (S.gold < c) return false;
    S.gold -= c;
    S.enrage = (S.enrage || 0) + 1;
    this.addFloater(this.width * (si === 0 ? 0.25 : 0.75), 88,
                    'RESONANCE ×' + S.enrage, false, '#a78bfa', 18);
    /* The sound is the PLAYER's feedback for the PLAYER's purchase; a rival
       charging its own field announces itself on the board, not in the ear. */
    if (si === 0) Sound.play('escalation');
    /* Gated exactly as build(), upgrade() and muster already are: syncAll
       re-renders the shop and the inspector, and a RIVAL charging its own
       field changes nothing on the player's side of the panel except the
       rival's readout, which syncLive draws. */
    if (si === this.viewSide) UI.syncAll(); else UI.syncLive();
    return true;
  },

  addEnemyMod() {
    /* The two callers are synchronous for-loops (campaign escStart, and the
       every-ten-waves step which asks for 2 from wave 20 and 3 from wave 30),
       but the offer is ANSWERED asynchronously. Each iteration used to
       overwrite pendingEscalation before the player could click, so an
       escStart of 3 opened three modals and applied one, and the refused
       cards of the discarded offers were not even banked. Queue the surplus
       and drain it as each choice resolves. BATCH-A/numbers */
    if (this.pendingEscalation) { this.escalationQueue = (this.escalationQueue || 0) + 1; return; }
    const pool = ENEMY_MODS.filter(m => !this.enemyMods.includes(m));
    if (!pool.length) return;
    /* The escalation is no longer dealt to you: three are offered and you take
       one. What you REFUSE is remembered, and the next escalation draws from
       the refused pile first -- so declining is a deferral, not a discount,
       and the choice cannot be farmed into a difficulty reduction. */
    const owed = this.escalationOwed.filter(m => !this.enemyMods.includes(m));
    const fresh = pool.filter(m => !owed.includes(m));
    const offer = [];
    while (offer.length < 3 && (owed.length || fresh.length)) {
      const src = (owed.length && offer.length === 0) ? owed : (fresh.length ? fresh : owed);
      offer.push(src.splice(Math.floor(Math.random() * src.length), 1)[0]);
    }
    if (offer.length <= 1) return this.commitEnemyMod(offer[0] || pick(pool));
    this.pendingEscalation = offer;
    this.state = 'escalating';
    Sound.play('escalation');
    UI.showEscalationChoice(offer);
  },

  /** Apply one escalation and bank the ones that were turned down. */
  takeEscalation(m) {
    const offer = this.pendingEscalation || [];
    for (const other of offer) {
      if (other !== m && !this.escalationOwed.includes(other)) this.escalationOwed.push(other);
    }
    this.pendingEscalation = null;
    this.state = 'playing';
    /* The bid has to stay symmetric. Escalations land on the wave that hits
       BOTH commanders, so letting the player alone choose which one arrives is
       a real edge. Price it: underwrite the severe option and YOU get the
       wider draft; duck it and your rivals get one instead. Either way the
       choice costs something, which is what stops it being a free discount. */
    const severe = offer.some(x => x.severity >= 2);
    if (m && m.severity >= 2) this.escalationBoon = (this.escalationBoon || 0) + 1;
    else if (severe) for (let i = 1; i < this.sides.length; i++) this.sides[i].draftBoon = (this.sides[i].draftBoon || 0) + 1;
    this.commitEnemyMod(m);
    /* `while`, not a single drain: addEnemyMod's one-card branch commits
       synchronously without setting pendingEscalation, which would strand
       the rest of the queue. The counter decrements on every pass, so an
       exhausted ENEMY_MODS pool still terminates the loop. */
    while (this.escalationQueue > 0 && !this.pendingEscalation) {
      this.escalationQueue--;
      this.addEnemyMod();
    }
    /* The draft this escalation displaced, if the same wave owed one. The
       drain above may have opened the NEXT escalation modal, so the draft is
       re-offered through offerChoiceWhenClear, which re-arms pendingDraft and
       returns false while state is 'escalating' rather than stacking a second
       modal on top of it. */
    if (this.pendingDraft) { this.pendingDraft = false; this.offerChoiceWhenClear(); }
    UI.syncAll();
  },

  commitEnemyMod(m) {
    if (!m) return;
    this.enemyMods.push(m);
    this.escalationOwed = this.escalationOwed.filter(x => x !== m);
    this.banner('ENEMY ESCALATION — ' + m.name, 3.6, '#ef4444');
    UI.showEscalation(m);
  },

  /** Distinct command upgrades; how many is commander-dependent. */
  drawMods(side) {
    const S0 = side || this.sides[0];
    /* A land card on a map with no rubble is a dead draw, so gate the pool. */
    /* MEASURED: comparing the two SIZES is meaningless — THE COIL has 50
       clearable rubble tiles and 112 lane tiles, so the old test returned
       false and silently deleted both land cards from every draft on the one
       map built around fragmented ground. Count the terrain that is actually
       off-lane instead. */
    let clearableTiles = 0;
    for (const k of FIELD.terrain) if (!this.laneBlocked.has(k)) { clearableTiles++; break; }
    const hasRubble = clearableTiles > 0;
    let n = S0.traits.draftOptions;
    /* Escalations you chose to take widen your own draft, once each. */
    if (S0 === this.sides[0]) {
      if (this.escalationBoon > 0) { n += 1; this.escalationBoon--; }
    } else if (S0.draftBoon > 0) { n += 1; S0.draftBoon--; }
    const pool = PLAYER_MODS.filter(m => !m.land || hasRubble);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  },

  /**
   * The command draft WAITS for an escalation. Every tenth wave is also a
   * draft wave on the shorter cadences, and the two modals opened on top of
   * each other: `addEnemyMod` parked the state at 'escalating' and
   * `offerChoice` immediately overwrote it with 'choosing', so answering
   * either one handed the battle back while the other was still up -- and
   * number keys, which are gated on 'choosing', drove the wrong card.
   */
  offerChoiceWhenClear() {
    if (this.state === 'escalating') { this.pendingDraft = true; return false; }
    this.offerChoice();
    return true;
  },

  offerChoice() {
    this.pendingChoice = this.drawMods(this.sides[0]);
    this.state = 'choosing';
    Sound.play('choice');
    UI.showChoice(this.pendingChoice);
  },

  takeMod(mod) {
    const s = this.sides[0];
    mod.apply(s.mods, s);
    s.taken.push(mod);
    for (const t of s.towers) t.recompute();
    this.recomputeAuras();
    this.pendingChoice = null;
    this.state = 'playing';
    Sound.play('upgrade');
    this.banner('COMMAND UPGRADE — ' + mod.name, 2.4, '#4ade80');
    UI.hideChoice();
    UI.syncAll();
  },

  spawnFromQueue(entry) {
    /* An eliminated commander receives nothing further. Without this the
       queue kept delivering every wave to a side with no towers left, and
       each of those units walked the lane purely to leak -- re-entering
       loseLives, which re-fired the side's HAS FALLEN banner over whatever
       was on screen, boss warnings included. step() shifts the entry off the
       queue BEFORE calling this, so an early return still drains it and the
       wave still completes. */
    if (this.sides[entry.side].defeated) return;
    const def = ENEMY_TYPES[entry.type];
    if (!def) return;
    const lanes = this.lanes[entry.side];
    const path = def.flying ? this.airLanes[entry.side] : lanes[(entry.lane || 0) % lanes.length];
    const e = new Enemy(def, path, {
      hpMul: entry.hpMul, bountyMul: entry.bountyMul, rageMul: entry.rageMul,
      hostileTo: entry.side, owner: -1,
      offset: def.flying ? rand(-22, 22) : rand(-7, 7),
      drift: this.drift, mods: this.enemyMods
    });
    e.baseSpeed *= this.arenaSpeed;
    e.armor += this.arenaArmor;
    this.enemies.push(e);
    /* A never-before-seen enemy pauses the war for its dossier -- once ever. */
    if (entry.side === 0 && !e.reanimated && Meta.markSeen(e.type))
      UI.showEnemyIntro(e.def, e);
  },

  /* ============================================================ BUILDING */

  tileKey(gx, gy) { return gx + ',' + gy; },
  towerAt(gx, gy) {
    for (const s of this.sides) for (const t of s.towers) if (t.gx === gx && t.gy === gy) return t;
    return null;
  },
  ownsTile(side, gx, gy) {
    if (FIELD.ownerGrid) return gy !== undefined && FIELD.ownerGrid[gy] && FIELD.ownerGrid[gy][gx] === side;
    return side === 0 ? gx <= FIELD.buildMax[0] : gx >= FIELD.buildMax[1];
  },

  canBuild(side, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= FIELD.cols || gy >= FIELD.rows) return false;
    if (!this.ownsTile(side, gx, gy)) return false;
    if (this.blocked.has(this.tileKey(gx, gy))) return false;
    if (this.towerAt(gx, gy)) return false;
    return true;
  },

  /**
   * Price grows with every copy you already own, at a rate specific to the
   * tower (see appliedGrowth -- Bolt is the gentlest curve, Vault the
   * steepest). This is the main lever deciding what a board looks like.
   */
  /** Price of raising this side's base to the next level. */
  baseLevelCost(side) {
    const S = this.sides[side];
    /* Each level also carries a compounding 10% premium on top of the step
       cost, so deep bases keep pulling ahead of raw tower spend. */
    return Math.round(baseLevelStepCost((S.baseLevel || 1) + 1, S.mods.upCost)
                      * Math.pow(1.10, (S.baseLevel || 1) - 1));
  },

  /** Bring one tower up to the base's floor: MK levels, then the owed
      specialisation, then ascension levels. Shared by placement and by
      buying a base level (which now retrofits everything already standing). */
  applyBaseLevelTo(t, bl) {
    let changed = false;
    const lvlTarget = Math.min(3, bl);
    if (t.level < lvlTarget) { t.level = lvlTarget; changed = true; }
    if (bl >= 4 && t.def.branches && t.def.branches.length) {
      if (!t.branch && !t.pendingBranch) { t.pendingBranch = true; changed = true; }
      const ascTarget = bl - 4;
      if (t.asc < ascTarget) { t.asc = ascTarget; changed = true; }
    }
    if (changed) t.recompute();
    return changed;
  },

  /** What the step to `level` would cost, for look-ahead pricing. */
  baseLevelCostAt(side, level) {
    const S = this.sides[side];
    return Math.round(baseLevelStepCost(level, S.mods.upCost) * Math.pow(1.10, level - 2));
  },

  buyBaseLevel(side) {
    const S = this.sides[side];
    const cost = this.baseLevelCost(side);
    if (S.gold < cost) { if (side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
    S.gold -= cost;
    S.baseLevel = (S.baseLevel || 1) + 1;
    S.maxLives += 2; S.lives += 2;
    S.mods.reanim = (S.mods.reanim || 1) * 1.05;
    /* The floor rises for everything ALREADY standing, not just future builds. */
    let raised = 0;
    for (const t of S.towers) if (this.applyBaseLevelTo(t, S.baseLevel)) raised++;
    /* applyBaseLevelTo ends in t.recompute(), which READS aura and lattice
       state but never republishes it -- and this is the one board mutation
       that skipped recomputeAuras (build, sell, upgrade, relocate and takeMod
       all call it). A retrofitted beacon raised its own auraDmg and radius
       while every neighbour kept reading the old snapshot, so up to 17% of
       the damage just paid for never arrived, and the per-frame ward pass
       actively pinned the stale value by restoring from _baseAura. Called
       unconditionally, matching every other mutation, and before the UI sync
       below so the panel prints the corrected numbers the same frame. */
    this.recomputeAuras();
    if (side === 0 && raised) this.addFloater(this.width / 2, 60,
      raised + (raised === 1 ? ' TOWER RAISED' : ' TOWERS RAISED'), false, '#7dd3fc', 14);
    if (side === 0) {
      Sound.play('branch');
      this.banner('⌂ BASE LEVEL ' + S.baseLevel, 2.0, '#7dd3fc');
      UI.syncAll();
    }
    return true;
  },

  towerCost(side, type) {
    const S = this.sides[side];
    const def = TOWER_TYPES[type];
    const owned = Math.max(0, S.countOf(type) - (S.traits.freeCopies || 0));
    /* COST_GROWTH_STEEPEN of the fractional part -- x1.50 becomes x2.25,
       x2.35 becomes x4.38. Through appliedGrowth so the four surfaces that
       QUOTE this rate are reading the same arithmetic that charges it. */
    const growth = appliedGrowth(def, S.traits.costGrowthMul || 1);
    /* EVERY tower ever purchased inflates ALL future prices; this stacks on
       top of the per-copy curve, so a sprawling board taxes itself twice. */
    const inflation = Math.pow(1.075, S.towers.length);
    const boon = (S.boonMods && S.boonMods.costMul) || 1;
    return Math.max(1, Math.round(def.cost * Math.pow(growth, owned) * inflation * S.mods.cost * boon));
  },

  build(side, type, gx, gy) {
    const S = this.sides[side];
    const cost = this.towerCost(side, type);
    if (!TOWER_TYPES[type] || !this.canBuild(side, gx, gy)) { if (side === 0) Sound.play('denied'); return null; }
    /* Only the five towers you deployed with may be built. */
    if (!S.loadout.includes(type)) { if (side === 0) Sound.play('denied'); return null; }
    if (S.gold < cost) { if (side === 0) { Sound.play('denied'); UI.flashGold(); } return null; }
    S.gold -= cost;
    const t = new Tower(type, gx, gy, side);
    /* The base's level is the floor every new tower starts from. Past level 3
       the specialisation is included -- the player picks it immediately, free
       -- and anything beyond that arrives as real ascension levels. */
    if ((S.baseLevel || 1) > 1) this.applyBaseLevelTo(t, S.baseLevel);
    S.towers.push(t);
    S.stats.built++;
    this.recomputeAuras();
    if (side === this.viewSide) { Sound.play('build'); this.spawnBurst(t.x, t.y, 12, t.def.color, 110); }
    if (side === 0) { this.selected = t; UI.syncAll(); }
    return t;
  },

  upgrade(tower, branchIndex = null) {
    const S = this.sides[tower.side];
    const next = tower.nextUpgrade();
    if (!next) return false;

    if (next.kind === 'level') {
      const cost = tower.upgradeCost('level', next.data.cost);
      if (S.gold < cost) { if (tower.side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
      S.gold -= cost; tower.invested += cost; tower.level++;
      /* Each level also rolls one random minor buff — no decision to make. */
      const roll = tower.addRoll();
      if (tower.side === this.viewSide) {
        Sound.play('upgrade');
        this.addFloater(tower.x, tower.y - 22, roll.name, false, '#7dd3fc', 13);
      }
    } else if (next.kind === 'branch') {
      const b = next.data[branchIndex];
      if (!b) return false;
      /* A branch owed by the base level is free -- Tower.upgradeCost states
         that rule now, so the engine, the inspector and the rival all read
         the same price. */
      const cost = tower.upgradeCost('branch', b.cost);
      if (S.gold < cost) { if (tower.side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
      S.gold -= cost; tower.invested += cost; tower.branch = b; tower.level = 4;
      tower.pendingBranch = false;
      if (tower.side === this.viewSide) Sound.play('branch');
    } else {
      const cost = tower.upgradeCost('ascend', next.cost);
      if (S.gold < cost) { if (tower.side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
      S.gold -= cost; tower.invested += cost; tower.asc++;
      if (tower.side === this.viewSide) Sound.play(tower.asc % S.traits.surgeEvery === 0 ? 'branch' : 'ascend');
    }

    tower.recompute();
    this.recomputeAuras();
    if (tower.side === this.viewSide) this.spawnBurst(tower.x, tower.y, 16, tower.def.color, 130);
    if (tower.side === 0) UI.syncAll();
    return true;
  },

  sell(tower) {
    const S = this.sides[tower.side];
    const i = S.towers.indexOf(tower);
    if (i < 0) return;
    S.gold += tower.sellValue;
    S.towers.splice(i, 1);
    if (this.selected === tower) this.selected = null;
    /* An armed MOVE must die with its tower. Without this the next click on
       empty ground charged the relocate fee for a tower that is no longer on
       the board, re-selected it, and opened a phantom inspector whose upgrade
       buttons all still worked — 54k gold could be burned on a tower that
       never fires and never renders. Nothing sets `dead` on a Tower, so the
       downstream `!movingTower.dead` guard could never have caught it. The
       `S` hotkey reaches sell too, so the panel is not the only vector. */
    if (this.movingTower === tower) this.movingTower = null;
    this.recomputeAuras();
    if (tower.side === this.viewSide) { Sound.play('sell'); this.spawnBurst(tower.x, tower.y, 10, '#94a3b8', 90); }
    if (tower.side === 0) UI.syncAll();
  },

  recomputeAuras() {
    for (const S of this.sides) {
      for (const t of S.towers) { t.aura.dmg = 0; t.aura.rate = 0; t.aura.range = 0; }
      for (const b of S.towers) {
        if (b.def.attack !== 'aura') continue;
        const r2 = (b.stats.range * TILE) ** 2;
        for (const t of S.towers) {
          if (t === b || t.def.attack === 'aura') continue;
          if (dist2(b.x, b.y, t.x, t.y) <= r2) {
            t.aura.dmg   += b.stats.auraDmg   || 0;
            t.aura.rate  += b.stats.auraRate  || 0;
            t.aura.range += b.stats.auraRange || 0;
          }
        }
      }
      /* ROBOTIC LATTICE. Reverse-engineered hardware carries no proc at all,
         so its whole identity is standing together: each robotic tower counts
         its robotic neighbours, plus one for a build node (a tile with a power
         tap of its own), and recompute() turns the count into flat output.
         Counted INSIDE this pass rather than in a traversal of its own --
         recomputeAuras already walks every tower and already ends by
         recomputing each of them, so a second traversal would be pure waste
         and a second place for the two counts to disagree. */
      const lat2 = (ORIGIN_LATTICE_TILES * TILE) ** 2;
      for (const t of S.towers) {
        if (t.def.origin !== 'robotic') { t.latticeRaw = 0; continue; }
        let n = t.node ? 1 : 0;
        for (const o of S.towers)
          if (o !== t && o.def.origin === 'robotic' && dist2(t.x, t.y, o.x, o.y) <= lat2) n++;
        /* A PYLON is the keystone: it reaches further than a plain link and
           lends more than one, which is the only reason to field one. */
        for (const p of S.towers) {
          const lb = p !== t && p.stats && p.stats.latticeBonus;
          if (!lb) continue;
          if (dist2(t.x, t.y, p.x, p.y) <= p.rangePx * p.rangePx) n += lb;
        }
        t.latticeRaw = n;
      }

      /* Nyx's Overdrive scales with total ascension across the whole board. */
      S.totalAsc = S.towers.reduce((n, t) => n + t.asc, 0);
      for (const t of S.towers) {
        t._baseAura = { dmg: t.aura.dmg, rate: t.aura.rate, range: t.aura.range };
        t.recompute();
      }
    }
  },

  /* ============================================================== EVENTS */

  /**
   * What `awardGold` WOULD credit for `amount`. THE single gold transform:
   * every figure the UI shows before the fact -- the muster bar's BASE
   * income, each tier's per-wave gain, the rush bonus, banked interest --
   * runs through this, because a preview that skips `mods.gold` under-reports
   * the payout by 25% per BATTLEFIELD SALVAGE and the player prices a
   * purchase against a return that looks weaker than it is. Four previews had
   * already drifted; there is now one place to forget it from, and awardGold
   * itself is a caller so the two can never disagree.
   */
  previewGold(side, amount) {
    const S = this.sides[side];
    if (!S || !(amount > 0)) return 0;
    /* The rival's economic edge is a real difficulty lever, not decoration. */
    const econ = S.isAI ? this.difficulty.aiEcon : 1;
    return Math.round(amount * S.mods.gold * econ);
  },

  /** Credits gold and RETURNS what actually landed, so a floater beside the
      call reports the paid figure rather than the requested one. */
  awardGold(side, amount, tower) {
    if (amount <= 0) return 0;
    const S = this.sides[side];
    const g = this.previewGold(side, amount);
    S.gold += g; S.stats.goldEarned += g;
    if (tower) tower.goldMade += g;
    return g;
  },

  restoreLife(side, n, tower) {
    const S = this.sides[side];
    if (S.lives >= S.maxLives) return;
    S.lives = Math.min(S.maxLives, S.lives + n);
    S.stats.livesRestored += n;
    if (tower) tower.livesRestored += n;
    if (side === this.viewSide) {
      Sound.play('heal');
      this.addFloater(tower ? tower.x : this.width / 2, tower ? tower.y - 20 : 60, '+' + n + ' ♥', false, '#4ade80', 16);
    }
    UI.syncLive();
  },

  /**
   * Elemental marks and combos. A marking element leaves its mark; a hit from
   * a DIFFERENT marking element consumes it and triggers the reaction.
   * Elemental resistance dampens the reaction on resistant enemies.
   */
  applyElement(enemy, element, dealt, tower) {
    /* A build node lends its element to a tower that marks nothing of its own.
       Substituted here rather than at the five call sites, which all pass
       def.element and would otherwise each need the same branch. */
    if (tower && tower.nodeEl) element = tower.nodeEl;
    const spec = ELEMENTS[element];
    /* Elemental WEAKNESS: a mob weak to this element takes a rider of pure
       damage on every hit -- kit-building against a map's roster now matters
       before any reaction even fires. (Resistances already damp reactions.) */
    const weak = enemy.def.elemWeak && enemy.def.elemWeak[element];
    if (weak && dealt > 0 && !enemy.dead) {
      const bonus = enemy.takeDamage(dealt * weak, 'pure', {});
      tower.damageDealt += bonus;
      if (enemy.hostileTo === this.viewSide && Math.random() < 0.12)
        this.addFloater(enemy.x, enemy.y - 12, 'WEAK', false, spec.color, 10);
    }
    if (!spec || !spec.marks || enemy.dead) return;
    /* Federation SUPPRESSION strips ELEMENTAL resistance too, which is what
       makes a Light tower in the line the difference between a reaction that
       lands and one the map's own denizens were built to shrug off. */
    const resist = ((enemy.def.elemResist && enemy.def.elemResist[element]) || 0)
                 * (enemy.suppressT > 0 ? (1 - ORIGIN_LIGHT_STRIP) : 1);
    if (enemy.markEl && enemy.markEl !== element && enemy.comboCd <= 0) {
      const combo = COMBOS[enemy.markEl] && COMBOS[enemy.markEl][element];
      if (combo) {
        enemy.comboCd = 0.5;
        const mark = enemy.markEl;
        enemy.markEl = null; enemy.markT = 0;
        const power = dealt * (1 - resist);
        switch (combo.id) {
          case 'thermal': {
            const d = enemy.takeDamage(power * 2.2, 'pure', {});
            tower.registerDamage(d, enemy, this, true);
            break;
          }
          case 'plasma': {
            const r2 = (1.2 * TILE) ** 2;
            for (const o of this.enemies) {
              if (o.dead || o.hostileTo !== enemy.hostileTo) continue;
              if (dist2(enemy.x, enemy.y, o.x, o.y) <= r2) {
                const d = o.takeDamage(power * 1.4, 'magic', {});
                tower.registerDamage(d, o, this, false, true);
              }
            }
            this.spawnExplosion(enemy.x, enemy.y, 1.2 * TILE, '#c084fc');
            break;
          }
          case 'superconduct': enemy.applyShred(12 * (1 - resist), 6); break;
          case 'paralysis':    enemy.applyFreeze(0.7 * (1 - resist)); break;
          case 'catalyse':     enemy.applyVuln(0.25 * (1 - resist), 3); break;
          case 'immolate': {
            const burn = Math.max(18, enemy.poisonStacks * 9) * (1 - resist);
            enemy.applyBurn(burn, 3, tower);
            break;
          }
          case 'collapse': {
            const d = enemy.takeDamage(power * 2.6, 'pure', {});
            tower.registerDamage(d, enemy, this, true);
            this.spawnImplosion(enemy.x, enemy.y, TILE * 1.1, '#818cf8');
            break;
          }
          case 'rupture': {
            enemy.applyShred(16 * (1 - resist), 5);
            if (!enemy.boss && !enemy.miniboss) enemy.applyFreeze(0.45 * (1 - resist));
            break;
          }
          case 'blight': {
            enemy.poisonStacks = Math.min((enemy.maxStacksSeen || 8), enemy.poisonStacks * 2 || 2);
            let nearest = null, nd = (TILE * 2.2) ** 2;
            for (const o of this.enemies) {
              if (o === enemy || o.dead || o.hostileTo !== enemy.hostileTo) continue;
              const d2 = dist2(enemy.x, enemy.y, o.x, o.y);
              if (d2 < nd) { nd = d2; nearest = o; }
            }
            if (nearest) nearest.applyPoison(power * 0.25, 0, 0, 4, 4, 0, tower);
            break;
          }
          case 'entropy': {
            if (enemy.slowTimer > 0) enemy.slowTimer += 1.5;
            if (enemy.burnTimer > 0) enemy.burnTimer += 1.5;
            if (enemy.poisonTimer > 0) enemy.poisonTimer += 1.5;
            enemy.applyVuln(0.15 * (1 - resist), 2);
            break;
          }
        }
        if (enemy.hostileTo === this.viewSide) {
          this.addFloater(enemy.x, enemy.y - 16, combo.name, false, ELEMENTS[element].color, 12);
          Sound.play('combo');
        }
        return;
      }
    }
    enemy.markEl = element;
    /* A marking tower standing on a node of ANOTHER element cannot re-flavour
       its own hits, so the node holds the charge instead: the mark lingers,
       which buys a slower partner tower time to arrive. */
    enemy.markT = (tower && tower.nodeHold) ? NODE_HOLD_MARK : MARK_SECONDS;
  },

  /**
   * Take a tower offline through HOSTILE disruption -- an enemy Jammer pulse
   * or a rival SABOTEUR. The single place immunity and resistance are spent,
   * because two callers each writing jamTimer is two places for a commander's
   * promise to be honoured by one and missed by the other.
   *
   * Self-inflicted downtime does NOT come through here: relocation and the
   * PIRATE overload heat lockout are prices the player chose to pay, and
   * ORIN's disruption training has no business discounting them.
   *
   * Returns true when the tower actually went down.
   */
  jamTower(t, seconds) {
    if (t.jamImmune) return false;
    const tr = this.sides[t.side] && this.sides[t.side].traits;
    const cut = Math.min(JAM_RESIST_CAP, (tr && tr.jamResist) || 0);
    t.jamTimer = Math.max(t.jamTimer, seconds * (1 - cut));
    return true;
  },

  /** JAMMER pulse: silences every tower defending against this unit. */
  jamTowers(enemy, jam) {
    const S = this.sides[enemy.hostileTo];
    const r2 = (jam.radius * TILE) ** 2;
    let hit = 0;
    for (const t of S.towers) {
      if (t.jamImmune) continue;
      if (dist2(enemy.x, enemy.y, t.x, t.y) <= r2 && this.jamTower(t, jam.duration)) hit++;
    }
    if (hit) {
      this.beams.push({ points: [{ x: enemy.x, y: enemy.y }], life: 0.4, maxLife: 0.4,
                        color: '#f59e0b', width: 2, ring: jam.radius * TILE });
      if (enemy.hostileTo === this.viewSide) { Sound.play('jam'); this.shake(3); }
    }
  },

  onRevive(enemy) {
    this.spawnBurst(enemy.x, enemy.y, 18, '#e2e8f0', 140);
    if (enemy.hostileTo === this.viewSide) {
      Sound.play('revive');
      this.addFloater(enemy.x, enemy.y - 18, 'RISEN', false, '#e2e8f0', 13);
    }
  },

  loseLives(side, n) {
    const S = this.sides[side];
    /* Halder's Shield Wall blunts every leak; his Immortal Line catches one. */
    if (S.traits.leakReduction) n = Math.max(1, n - S.traits.leakReduction);
    if (S.lives - n <= 0 && S.traits.immortalLine && !S.immortalUsed) {
      S.immortalUsed = true;
      S.lives = 1; S.stats.leaked += n;
      if (side === this.viewSide) { this.banner('IMMORTAL LINE HOLDS', 2.6, '#4ade80'); Sound.play('heal'); this.shake(10); }
      UI.syncLive();
      return;
    }
    S.lives -= n; S.stats.leaked += n;
    if (side === this.viewSide) { this.hurtFlash = 1; this.shake(6); Sound.play('leak'); }
    if (S.lives <= 0) {
      S.lives = 0;
      /* On the Confluence a fallen rival is eliminated, not the end: its
         towers go dark and the war narrows. The match resolves when the
         player falls, or when no rival still stands. */
      if (this.triMode && side > 0) {
        S.defeated = true;
        S.towers.length = 0;
        for (const e2 of this.enemies) if (e2.hostileTo === side) e2.dead = true;
        this.banner(FACTIONS[S.faction].icon + ' ' + (S.commander ? S.commander.name : 'RIVAL') +
                    ' HAS FALLEN', 3, FACTIONS[S.faction].color);
        if (this.sides.slice(1).every(x => x.defeated)) this.endMatch(true);
      } else this.endMatch(side === 0 ? false : undefined);
    }
    UI.syncLive();
  },

  endMatch(wonOverride, abandon) {
    if (this.state === 'over') return;
    this.state = 'over';
    Sound.stopMusic();
    /* `wonOverride` lets an abandon resolve as a genuine loss without having to
       zero the player's lives first. `abandon` marks that loss as VOLUNTARY:
       a battlefield defeat keeps the campaign, an abandon forfeits it. */
    const won = wonOverride === undefined ? this.sides[0].alive : wonOverride;
    Sound.play(won ? 'victory' : 'defeat');
    /* Commander experience is the persistent reward for every run. */
    const boons = this.sides[0].boonMods || {};
    /* The victory bonus inside xpForRun used to re-derive the result from
       seat 1's lives, which is only the same question on a two-sided board.
       `won` is decided immediately above and is the single definition of who
       took the world; passing it is what stops a multi-seat defeat being paid
       as a win. BATCH-C/nside */
    this.lastXp = Meta.addXp(this.sides[0].commander.id,
      Meta.xpForRun(this, won) * (boons.xpMul || 1));
    /* Tower mastery: every deployed tower learns from the battle. */
    this.lastMastery = [];
    for (const type of this.sides[0].loadout) {
      const used = this.sides[0].towers.filter(t => t.type === type);
      const dmg = used.reduce((a, t) => a + t.damageDealt, 0);
      const kills = used.reduce((a, t) => a + t.kills, 0);
      const xp = Math.round((dmg / 60 + kills * 2 + this.wave * 4) * (boons.masteryMul || 1));
      if (xp > 0) this.lastMastery.push({ type, ...Meta.addTowerXp(type, xp) });
    }
    /* Campaign: victory advances the path; a DEFEAT keeps the galaxy (the
       loss is the stars it did not earn plus the rivals' free move below);
       only a voluntary abandon resolves the campaign. */
    /* Star the world before the campaign advances, so the summary can show
       what this battle actually earned on the galaxy map. */
    const c0 = this._skirmish ? null : Meta.campaign();
    const node = c0 && c0.chosen;
    this.lastStars = node
      ? Meta.recordWorld(node.world, ratingFor(won, this.sides[0].lives, this.sides[0].maxLives, this.wave))
      : null;
    this.campaignResult = c0
      ? (won ? Meta.campaignAdvance(this)
             : abandon ? Meta.campaignEnd(this) : Meta.campaignDefeat(this))
      : null;
    /* Rivals expand while you were busy -- win OR lose. Now that a defeat
       keeps the galaxy, the rivals' move is what makes losing cost something
       beyond the stars you did not earn; it is the same seeded roll the
       victory path makes, so the galaxy the player and the rival brains face
       is identical either way. An abandoned campaign has no galaxy left. */
    if (c0 && (won || !abandon)) {
      const gx = Meta.galaxy();
      let seed = (c0.seed + this.wave) >>> 0;
      const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      this.rivalMoves = advanceRivals(gx, c0.stars || {}, rnd);
      /* advanceRivals moves owners on the LIVE galaxy, and Meta.galaxy()
         rebuilds that object from the seed the next time it is asked for.
         Bank the takes or the rivals never actually hold anything: the
         summary reads "took Vell II in CORVUS" and the map, one reload later,
         disagrees. */
      Meta.recordRivalMoves(this.rivalMoves);
    } else this.rivalMoves = null;
    Storage.recordRun(this, won);
    UI.showEnd(won);
  },

  onBossPhase(enemy, phase) {
    if (enemy.hostileTo !== this.viewSide) return;
    this.banner(phase.msg, 2.2, '#ef4444');
    this.shake(9);
    this.spawnExplosion(enemy.x, enemy.y, 80, '#ef4444');
    Sound.play('bossWarn');
  },

  summonFrom(enemy, summon) {
    const def = ENEMY_TYPES[summon.type];
    if (!def) return;
    for (let i = 0; i < summon.count; i++) {
      /* waveHpMul is THE definition; open-coding it here dropped
         UNIT_HP_SCALE and the galaxy-tier term, so a summon arrived at 0.32
         of a wave body (0.17 at galaxy III) while the literal beside it said
         0.6. Drift and escalations are passed the way spawnFromQueue passes
         them -- the constructor applies each exactly once -- which also
         restores the armour a summon was arriving without. BATCH-A/numbers */
      this.pendingSpawns.push(new Enemy(def, enemy.path, {
        /* 19.16 -- a brood is a summoned body like any other, on the same
           curve. Symmetric by construction: a wave arrives identically on
           every seat, so the term cannot favour one commander. */
        hpMul: this.waveHpMul(Math.max(1, this.wave)) * SUMMON_DAMP * spawnHpPenaltyMul(this.wave),
        bountyMul: 0.5, hostileTo: enemy.hostileTo, owner: enemy.owner,
        reanimated: enemy.reanimated,
        startDist: Math.max(0, enemy.dist - 12), offset: rand(-14, 14),
        drift: this.drift, mods: this.enemyMods
      }));
    }
    this.spawnBurst(enemy.x, enemy.y, 12, '#d8b4fe', 110);
    Sound.play('split');
  },

  /* ============================================================== MUSTER */

  /** Live rivals a muster from `side` would march on. */
  /* THE single answer to "who does this side send at". Two-sided boards have
     exactly one rival, tri boards have two, and THE MAELSTROM has up to twenty
     — so `1 - side`, which three call sites still open-coded, is undefined the
     moment a third seat exists. Returns a live opponent, or -1 if none remain. */
  rivalOf(side) {
    const v = this.musterVictims(side);
    return v.length ? v[0] : -1;
  },

  musterVictims(side) {
    /* In the arena a send marches on ONE seat -- the next still standing round
       the ring. Nineteen victims per purchase would put 19x tier.count units on
       the board at a stroke, and the muster panel prints what this returns. */
    if (FIELD.radial) {
      const v = this.maelstromVictim(side);
      return v < 0 ? [] : [v];
    }
    const out = [];
    for (let v = 0; v < this.sides.length; v++)
      if (v !== side && !this.sides[v].defeated && this.sides[v].alive) out.push(v);
    return out;
  },

  /** The seat a send from `side` lands on: MAELSTROM_SEND_ARC places round the
      ring, walking on past any seat that has already fallen. -1 when this side
      is the last one standing. */
  maelstromVictim(side) {
    const n = this.sides.length;
    for (let k = 0; k < n; k++) {
      const v = (side + MAELSTROM_SEND_ARC + k) % n;
      if (v === side) continue;
      const S = this.sides[v];
      if (S && !S.defeated && S.alive) return v;
    }
    return -1;
  },

  /**
   * THE CONTRACTION. Called once a wave; every MAELSTROM_CONTRACT_WAVES it
   * pulls the horizon one step outward and everything inside is gone. It is
   * measured in L1 -- the metric the board is laid out in -- so it takes a
   * similar slice out of every wedge instead of favouring whichever seat
   * happens to point at a corner, and it stops short of the bases so no seat
   * can be eliminated by geometry alone.
   */
  maelstromContract() {
    if (!FIELD.radial || this.state !== 'playing') return;
    if (this.wave % MAELSTROM_CONTRACT_WAVES !== 0) return;
    const next = Math.min(FIELD.horizonMax, this.horizon + MAELSTROM_HORIZON_STEP);
    if (next <= this.horizon + 1e-6) return;
    this.horizon = next;

    const cx = FIELD.centre[0], cy = FIELD.centre[1];
    for (let gy = 0; gy < FIELD.rows; gy++)
      for (let gx = 0; gx < FIELD.cols; gx++) {
        if (Math.abs(gx - cx) + Math.abs(gy - cy) > this.horizon) continue;
        const k = this.tileKey(gx, gy);
        if (this.consumed.has(k)) continue;
        this.consumed.add(k);
        this.blocked.add(k);
      }

    /* Towers standing on ground the horizon just took go with it. They are
       removed by MEMBERSHIP of the owning side's list -- the same test the
       inspector and the relocate cursor are cleared against here, because a
       cursor still holding a tower that is no longer on the board is how a
       phantom inspector and an unbounded relocate fee happen. */
    let mine = 0;
    for (const S of this.sides) {
      for (let i = S.towers.length - 1; i >= 0; i--) {
        const t = S.towers[i];
        if (!this.consumed.has(this.tileKey(t.gx, t.gy))) continue;
        S.towers.splice(i, 1);
        if (this.selected === t) this.selected = null;
        if (this.movingTower === t) this.movingTower = null;
        this.spawnImplosion(t.x, t.y, TILE * 1.15, '#a78bfa');
        if (S.index === 0) mine++;
      }
    }
    /* Cached build spots still list ground that no longer exists, and a beacon
       that has just been eaten is still buffing its neighbours until the auras
       are recomputed. */
    for (const b of this.brains) b.buildSpots();
    this.recomputeAuras();
    this.renderBackground();
    this.banner('WAVE ' + this.wave + ' — THE HORIZON CONTRACTS' + (mine ? ' · ' + mine + ' LOST' : ''),
                3, '#a78bfa');
    if (mine) { Sound.play('wallBreak'); this.shake(7); }
  },

  /**
   * Health multiplier a mustered unit arrives with. A bought unit has no
   * parent corpse to inherit from the way a reanimate does, so the wave's own
   * scaling stands in as the parent and the same damping is applied on top.
   *
   * Everything the live wave applies is composed HERE, once: the preview and
   * the spawn both read this function, because a preview that quietly drops a
   * multiplier is a shipped bug this project has already paid for twice.
   * Equally, the result already contains drift and every escalation, so the
   * caller must NOT also pass `drift`/`mods` -- that double application is the
   * measured 3.02x reanimate carried before it was caught.
   */
  musterHpMul(side, victim) {
    /* Reads the ONE definition rather than open-coding the tier term a third
       time; drift is applied here because a mustered unit carries it. */
    let m = this.waveHpMul(Math.max(1, this.wave)) * (1 + this.drift.hp);
    for (const mod of this.enemyMods) if (mod.hpMul) m *= mod.hpMul;
    m *= MUSTER_DAMP * this.sides[side].mods.reanim;
    /* 19.16. A bought body is worth a FRACTION of a wave body in the opening
       and the full damped figure from wave 10 on. It sits inside musterHpMul
       rather than at the spawn, because the muster bar, the rival's pressure
       estimate and the spawn all read this function -- putting it anywhere
       else is how a preview and a payout disagree. */
    m *= spawnHpPenaltyMul(this.wave);
    const V = this.sides[victim];
    if (V) m *= (1 - (V.traits.reanimResist || 0));
    return m;
  },

  /** Assign a side's detachment and derive its tiers in one place. */
  setMusterLoadout(side, ids) {
    const S = this.sides[side];
    if (!S) return [];
    S.musterTiers = musterTiersFor(ids);
    S.musterLoadout = S.musterTiers.map(t => t.id);
    return S.musterTiers;
  },

  /** The derived tier list a side's muster detachment carries this battle. */
  musterTiers(side) {
    const S = this.sides[side];
    return (S && S.musterTiers) || [];
  },

  musterCost(side, tier) {
    return musterCost(tier, this.wave, this.sides[side].musterBuys || 0);
  },

  /**
   * Gold per wave this purchase would ACTUALLY add. Reads the difference
   * between the payout before and after, so once the ceiling is reached the
   * control reports the honest +0 rather than a number it will never pay.
   */
  musterGain(side, tier) {
    const S = this.sides[side];
    const w = this.waveRunning ? this.wave : this.wave + 1;
    const step = musterIncomeStep(tier);
    /* Both halves run the transform awardGold will run, so the delta on the
       button is the gold that will actually land. Taking the difference of
       two previews rather than previewing the difference keeps the honest +0
       once the ceiling is reached. The rival's brain reads this too, so it
       must NOT apply aiEcon again on its side (see js/ai.js). */
    return this.previewGold(side, musterPayout((S.musterIncome || 0) + step, w))
         - this.previewGold(side, musterPayout(S.musterIncome, w));
  },

  /** `tier` omitted asks only whether the control is live at all. */
  canMuster(side, tier) {
    const S = this.sides[side];
    if (!S || this.state !== 'playing' || !S.alive || S.defeated) return false;
    if ((S.musterThisWave || 0) >= MUSTER_PER_WAVE) return false;
    if (!this.musterVictims(side).length) return false;
    return !tier || S.gold >= this.musterCost(side, tier);
  },

  /** Buy a send. The gold buys units now AND income for the rest of the match. */
  muster(side, tier) {
    if (typeof tier === 'string') tier = this.musterTiers(side).find(t => t.id === tier);
    if (!tier || !this.canMuster(side, tier)) return false;
    const S = this.sides[side];
    const base = ENEMY_TYPES[tier.type];
    if (!base) return false;

    const cost = this.musterCost(side, tier);
    /* Flat percent per purchase -- the ceiling inside musterPayout is the
       only thing bounding the total, by the owner's spec. */
    const step = musterIncomeStep(tier);
    S.gold -= cost;
    S.musterIncome = (S.musterIncome || 0) + step;
    S.musterBuys = (S.musterBuys || 0) + 1;
    S.musterThisWave = (S.musterThisWave || 0) + 1;

    /* On the Confluence a send marches on BOTH rivals, exactly as a kill
       does there -- the map's identity, not a muster-specific bonus. */
    let sentUnits = 0;
    for (const vic of this.musterVictims(side)) {
      const path = (this.triMode && this.sendTriPaths && this.sendTriPaths[side])
        ? this.sendTriPaths[side][vic] : this.sendPaths[side];
      if (!path) continue;
      const dbl = S.mods.doubleReanim || 0;
      for (let i = 0; i < tier.count; i++) {
        /* The double-reanimate roll applies here too, so the tech that widens
           a kill widens a purchase by the same rule. */
        const copies = 1 + ((dbl > 0 && Math.random() < dbl) ? 1 : 0);
        for (let k = 0; k < copies; k++) {
          this.pendingSpawns.push(new Enemy(base, path, {
            hpMul: this.musterHpMul(side, vic),
            bountyMul: 1, speedMul: S.traits.reanimSpeed,
            /* Armour crosses explicitly for the same reason the health does. */
            armorFlat: ((base.armor || 0) + this.drift.armor) * MUSTER_DAMP,
            /* `reanimated` is what stops a bought unit being reanimated into a
               third life, and what gives it the frailty and halved leak cost
               every sent unit already carries. */
            hostileTo: vic, owner: side, reanimated: true,
            startDist: rand(0, 10), offset: rand(-8, 8)
          }));
          sentUnits++;
          S.stats.sent++;
          S.stats.mustered++;
        }
      }
    }
    /* One payment for the whole detachment, at the buyer's own reanimate rate. */
    if (S.traits.reanimGold && sentUnits)
      this.awardGold(side, Math.round(S.traits.reanimGold * MUSTER_REANIM_GOLD_MUL * sentUnits));

    if (side === this.viewSide) {
      Sound.play('reanimate');
      this.addFloater(this.width * 0.5, 108, base.name.toUpperCase() + ' ' + tier.name + ' MUSTERED', false, '#f97316', 18);
      /* Gated exactly as build() and upgrade() are. A full syncAll re-renders
         the shop and the inspector; running it on every RIVAL muster -- which
         the brain can fire every 0.55s -- is DOM churn nothing on screen
         needed, since step() already drives syncLive (and so syncMuster) at
         8Hz and the only player-visible consequence is the inbound units. */
      UI.syncAll();
    }
    return true;
  },

  /** THE core PvP loop: your kills become your opponent's problem. */
  reanimate(e) {
    const killer = e.hostileTo;             // only that side's towers could have killed it
    /* `1 - killer` is the two-sided answer, and it is undefined the moment a
       third seat exists -- the exact shape of the SIREN crash, kept off the
       board today only by the arena's noReanim flag. Game.rivalOf is THE
       definition of who a side sends at, and on a duel it returns precisely
       what the subtraction returned. BATCH-C/nside */
    const victim = this.rivalOf(killer);
    const S = this.sides[killer];
    const base = ENEMY_TYPES[e.type];
    /* On the Confluence every kill marches on BOTH rivals -- the doubled dead. */
    if (this.triMode && FIELD.sendTri) {
      for (let vic = 0; vic < this.sides.length; vic++) {
        if (vic === killer || this.sides[vic].defeated) continue;
        this.pendingSpawns.push(new Enemy(base, this.sendTriPaths[killer][vic], {
          /* `rageMul` divides back out: RESONANT FIELD is a bet on your own
             wave, and the codex, the tooltip and startWave all say so. The
             send derives from the corpse, so without this the buyer's charge
             rode across the board and arrived up to 87% tougher. */
          hpMul: (e.maxHp / base.hp / (e.rageMul || 1)) * 0.6 * S.mods.reanim *
                 (1 - (this.sides[vic].traits.reanimResist || 0)),
          bountyMul: 1, speedMul: S.traits.reanimSpeed,
          armorFlat: e.armor * 0.6,
          hostileTo: vic, owner: killer, reanimated: true,
          startDist: rand(0, 10), offset: rand(-8, 8)
        }));
        S.stats.sent++;
      }
      if (S.traits.reanimGold) this.awardGold(killer, S.traits.reanimGold * 2);
      if (killer === this.viewSide) Sound.play('reanimate');
      return;
    }
    /* Nobody left to receive it: reachable only in the frame the last rival
       falls, and a send into a defeated seat's lane is the posthumous-wave
       defect from the other direction. */
    if (victim < 0) return;
    const path = this.sendPaths[killer];
    /* FIELD.sendPaths is hard-coded to two entries on both multi-seat
       builders as a legacy accessor, so any board that reached here with a
       third seat would hand back undefined -- and an Enemy with no path
       throws inside updatePosition on its first step. BATCH-C/nside */
    if (!path) return;

    let copies = 1;
    if (S.mods.doubleReanim > 0 && Math.random() < S.mods.doubleReanim) copies = 2;

    for (let i = 0; i < copies; i++) {
      this.pendingSpawns.push(new Enemy(base, path, {
        /* `e.maxHp` ALREADY contains wave scaling, drift and every escalation,
           so passing `drift`/`mods` again made the constructor apply both a
           second time -- a measured 3.02x the original where the design says
           0.6x, inverting the anti-snowball rule outright. Armour is carried
           across explicitly for the same reason. */
        /* The receiving side's commander can blunt what arrives, and the
           SENDING side's resonance charge divides back out -- see the tri
           branch above for why. */
        hpMul: (e.maxHp / base.hp / (e.rageMul || 1)) * 0.6 * S.mods.reanim *
               (1 - (this.sides[victim].traits.reanimResist || 0)),
        bountyMul: 1, speedMul: S.traits.reanimSpeed,
        armorFlat: e.armor * 0.6,
        hostileTo: victim, owner: killer, reanimated: true,
        startDist: rand(0, 10), offset: rand(-8, 8)
      }));
      S.stats.sent++;
      if (S.traits.reanimGold) this.awardGold(killer, S.traits.reanimGold);
    }
    if (killer === this.viewSide) Sound.play('reanimate');
  },

  killEnemy(e) {
    /* A charmed unit was removed by SIREN, not killed. It already walked away
       as a converted copy; paying bounty and reanimating it as well meant one
       charm produced TWO hostiles on the rival lane plus full gold. The
       `charmed` flag was written and never read until now. */
    if (e.charmed) return;
    const killer = e.hostileTo;
    /* An eliminated seat's corpse pile was SWEPT, not killed -- the same
       distinction `charmed` above draws. loseLives flags every attacker still
       aimed at a fallen commander `dead`; the reap then runs each one through
       here, so the dead seat went on collecting bounty, banking kills and
       reanimating its whole in-flight wave in its own name. Measured on
       CONFLUENCE one simulated second after the fall: +59 gold, +19 kills and
       21 posthumous units, eleven of them marching on the player. `defeated`
       is only ever set for side > 0, so the player's own credit and
       reanimation can never be gated by this. BATCH-C/nside */
    if (this.sides[killer].defeated) return;
    const S = this.sides[killer];
    /* APEX PREDATOR pays double on elites. Applied to the base bounty so it
       compounds with execBounty and mods.gold exactly as the wording reads --
       "they pay double bounty", not "they pay double before your other
       income modifiers stop applying". */
    let bounty = (e.boss || e.miniboss) ? e.bounty * (S.traits.eliteBounty || 1) : e.bounty;
    if (e.executed) {
      let bonus = 0;
      for (const t of S.towers) if (t.stats.execBounty) bonus = Math.max(bonus, t.stats.execBounty);
      bounty = Math.round(bounty * (1 + bonus));
    }
    this.awardGold(killer, bounty);
    S.stats.kills++;

    /* Alchemists transmute nearby deaths into permanent power. */
    for (const t of S.towers) {
      if (!t.stats.transmute) continue;
      if (dist2(t.x, t.y, e.x, e.y) <= t.rangePx * t.rangePx) {
        t.alchStacks = (t.alchStacks || 0) + 1;
        if (t.stats.transGold) this.awardGold(killer, t.stats.transGold, t);
      }
    }

    /* Vaults skim a cut from every kill inside their radius. */
    for (const t of S.towers) {
      if (t.def.attack !== 'economy') continue;
      if (dist2(t.x, t.y, e.x, e.y) <= t.rangePx * t.rangePx) {
        const cut = Math.round((t.stats.killCut || 0) * t.ascDamage * (S.traits.vaultBonus || 1));
        this.awardGold(killer, cut, t);
      }
    }

    if (e.boss) {
      Sound.play('bossKill'); this.shake(18);
      for (let i = 0; i < 5; i++)
        setTimeout(() => this.spawnExplosion(e.x + rand(-36, 36), e.y + rand(-36, 36), rand(45, 80), '#ef4444'), i * 100);
    } else if (killer === this.viewSide) {
      Sound.play('kill');
      this.spawnBurst(e.x, e.y, Math.min(18, 5 + e.radius), e.def.color, 110);
    }

    /* UNSTABLE escalation: the dead heal their neighbours. */
    if (e.deathHeal) {
      const r2 = (2.6 * TILE) ** 2;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.hostileTo !== e.hostileTo) continue;
        if (dist2(e.x, e.y, o.x, o.y) <= r2) o.hp = Math.min(o.maxHp, o.hp + e.maxHp * e.deathHeal);
      }
    }

    /* PLAGUE contagion: exactly ONE jump, to the single nearest target, and
       the recipient cannot pass it on. Previously this infected everything in
       radius and each of those could infect again, which cascaded through a
       whole wave off one kill. */
    if (e.poisonStacks > 0 && e.poisonContagion > 0 && !e.contagionSpent) {
      const r2 = (e.poisonContagion * TILE) ** 2;
      let best = null, bd = Infinity;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.hostileTo !== e.hostileTo || o.contagionSpent) continue;
        const d2 = dist2(e.x, e.y, o.x, o.y);
        if (d2 <= r2 && d2 < bd) { bd = d2; best = o; }
      }
      if (best) {
        /* The max-health share crosses with the rest of the cloud, or a
           contagion jump would silently launder CANISTER gas into TOXIN. */
        best.applyPoison(e.poisonDps, e.poisonPct, e.poisonMaxPct, 4, 10, 0, e.poisonSrc);
        best.poisonStacks = Math.max(best.poisonStacks, e.poisonStacks);
        best.contagionSpent = true;
        this.beams.push({ points: [{ x: e.x, y: e.y }, { x: best.x, y: best.y }],
                          life: 0.3, maxLife: 0.3, color: '#a3e635', width: 2.5 });
        this.spawnBurst(e.x, e.y, 10, '#a3e635', 90);
      }
    }

    if (e.def.splitInto) {
      const def = ENEMY_TYPES[e.def.splitInto];
      for (let i = 0; i < (e.def.splitCount || 2); i++) {
        this.pendingSpawns.push(new Enemy(def, e.path, {
          /* Same double-application as reanimate(): the parent's maxHp already
             carries every escalation, so re-passing `mods` squared them. */
          hpMul: (e.maxHp / ENEMY_TYPES[e.type].hp) * 0.9, bountyMul: 1,
          /* Or a Bloatpod's four children launder the parent's charge across
             the board: they are not flagged `reanimated`, so they DO
             reanimate, and the correction below would miss them. */
          rageMul: e.rageMul,
          armorFlat: e.armor,
          hostileTo: e.hostileTo, owner: e.owner, reanimated: e.reanimated,
          startDist: e.dist, offset: e.offset + (i - 1) * 11
        }));
      }
      Sound.play('split');
    }

    /* Reanimation — but a reanimated unit can never be reanimated again, and
       inside THE MAELSTROM nothing reanimates at all. The gate is the ARENA's
       (`noReanim` comes off the field), not a side's: killing an attacker in
       the arena leaves you nothing to send, for every seat equally. What you
       send you buy, and every reanimation bonus you own still rides it --
       Game.muster applies mods.reanim, doubleReanim, traits.reanimSpeed and
       traits.reanimGold exactly as it does anywhere else. */
    if (!e.reanimated && !this.noReanim) this.reanimate(e);
  },

  /* ============================================================= HELPERS */

  /** Paths carrying units hostile to `side` — its lanes plus incoming reanimates. */
  defendedPaths(side) {
    /* In the arena everything hostile to a seat -- its own wave and every send
       aimed at it -- comes out of the singularity down that seat's ONE lane, so
       the honest answer is one path. Falling through to the tri branch below
       would return the same lane nineteen times over and weight the rival's
       coverage sampling by however many seats are still alive. */
    if (FIELD.radial) return this.lanes[side].slice();
    if (this.triMode && this.sendTriPaths) {
      const inbound = [];
      for (let k = 0; k < this.sides.length; k++)
        if (k !== side && this.sendTriPaths[k][side]) inbound.push(this.sendTriPaths[k][side]);
      return [...this.lanes[side], ...inbound];
    }
    const r = this.rivalOf(side);
    return r < 0 ? [...this.lanes[side]]
                 : [...this.lanes[side], this.sendPaths[r]];
  },

  /** A random point on a defended lane within `range` of (x, y). For Sapper. */
  randomLaneSpot(side, x, y, range) {
    const paths = this.defendedPaths(side);
    const r2 = range * range;
    for (let tries = 0; tries < 24; tries++) {
      const p = paths[Math.floor(Math.random() * paths.length)];
      const d = rand(0, p.total);
      const pt = p.posAt(d, {});
      if (dist2(x, y, pt.x, pt.y) <= r2) {
        /* Nudge off-centre so a cluster of mines doesn't sit in one dot. */
        return { x: pt.x - pt.uy * rand(-9, 9), y: pt.y + pt.ux * rand(-9, 9) };
      }
    }
    return null;
  },

  shake(a) { this.shakeAmt = Math.min(9, this.shakeAmt + a * 0.55); },
  banner(text, dur = 2, color = '#e6f5ff') {
    this.bannerText = text; this.bannerTimer = dur; this.bannerMax = dur; this.bannerColor = color;
  },

  spawnParticle(x, y, vx, vy, life, size, color, kind = 'spark') {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, kind });
  },
  spawnBurst(x, y, n, color, speed = 100) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.5), rand(1.5, 3.4), color, 'spark');
    }
  },
  spawnExplosion(x, y, radius, color) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.32, maxLife: 0.32, size: radius, color, kind: 'shock' });
    const n = Math.min(26, Math.round(radius / 3));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, radius * 3.2);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.24, 0.55), rand(2, 5), Math.random() < 0.45 ? '#ffd166' : color, 'fire');
    }
  },
  /** Inward-collapsing ring — the Singularity's signature. */
  spawnImplosion(x, y, radius, color) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, size: radius, color, kind: 'implode' });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), d = rand(radius * 0.5, radius);
      this.spawnParticle(x + Math.cos(a) * d, y + Math.sin(a) * d,
        -Math.cos(a) * d * 2.6, -Math.sin(a) * d * 2.6, 0.38, rand(1.6, 3.2), color, 'pull');
    }
  },
  /* ------------------------------------------------- AIMED ABILITIES */

  /** The point on the defended lane nearest an aimed tile, or null when the
      aim is too far from any lane to be what the commander meant. */
  laneAnchor(side, gx, gy) {
    const x = (gx + 0.5) * TILE, y = (gy + 0.5) * TILE;
    const lim = (AIM_SNAP_TILES * TILE) * (AIM_SNAP_TILES * TILE);
    let best = null;
    for (const p of this.defendedPaths(side)) {
      /* A defended-path slot can legitimately be empty (a tri send route that
         does not exist), and one undefined entry here would take the frame
         down with it. */
      if (!p) continue;
      const n = p.nearestDist(x, y);
      if (n.d2 > lim || (best && n.d2 >= best.d2)) continue;
      /* The SNAP is checked for ownership, not just the aimed tile. A send
         route retraces its killer's own lane, so the nearest point to a tile
         on the border can sit inside another commander's ground -- and the
         tile check upstream would have waved it through. Neutral ground stays
         legal: that is where the lanes meet and where a wall belongs. */
      const pt = p.posAt(n.dist, {});
      if (this.tileHeldByRival(side, Math.floor(pt.x / TILE), Math.floor(pt.y / TILE))) continue;
      best = { path: p, dist: n.dist, d2: n.d2, x: pt.x, y: pt.y };
    }
    return best;
  },

  /** True when a commander OTHER than `side` holds this tile. Unowned middle
      ground is not held by anyone, so it answers false. */
  tileHeldByRival(side, gx, gy) {
    if (FIELD.ownerGrid) {
      const row = FIELD.ownerGrid[gy];
      const o = row ? row[gx] : undefined;
      return o !== undefined && o !== -1 && o !== side;
    }
    return side === 0 ? gx >= FIELD.buildMax[1] : gx <= FIELD.buildMax[0];
  },

  /** Is this a legal tile for an aimed ability? The rival is held to exactly
      the same rule, which is what stops it aiming into ground it does not
      hold — or at its own base. */
  canAim(side, gx, gy, def) {
    if (this.state !== 'playing') return false;
    if (gx < 0 || gy < 0 || gx >= FIELD.cols || gy >= FIELD.rows) return false;
    if (!this.ownsTile(side, gx, gy)) return false;
    if (def && def.lane) return this.laneAnchor(side, gx, gy) !== null;
    if (this.towerAt(gx, gy)) return false;
    /* Lane tiles count as `blocked` for building but are exactly where an
       emplacement wants to stand; authored rubble is not. */
    const k = this.tileKey(gx, gy);
    return !this.blocked.has(k) || this.laneBlocked.has(k);
  },

  /** The def of the ability currently armed for aiming, or null. */
  aimedDef() {
    if (this.aimingAbility === null) return null;
    const a = this.sides[0].abil && this.sides[0].abil[this.aimingAbility];
    return a ? a.def : null;
  },

  /** Q/E and the ability bar both come through here. An aimed ability arms
      the cursor instead of firing: the tile is part of the price. */
  armAbility(i) {
    const S = this.sides[0];
    const a = S.abil && S.abil[i];
    if (!a || this.state !== 'playing') return false;
    if (!a.def.aim) return useAbility(S, this, i);
    if (a.cd > 0 || a.active > 0) return false;
    this.aimingAbility = this.aimingAbility === i ? null : i;
    /* One cursor mode at a time, or a single click would mean two things. */
    this.selectedType = null; this.movingTower = null;
    Sound.play('click');
    UI.syncAll();
    return true;
  },

  /** Put an aimed ability's construct on the board. One per ability per side:
      stacking blockers would turn a delay into a gate. */
  deployConstruct(side, def, at) {
    this.clearConstructs(side.index, def.id);
    const c = makeAbilityConstruct(side, this, def, at);
    if (c) this.constructs.push(c);
    return c;
  },

  clearConstructs(sideIndex, abilityId) {
    this.constructs = this.constructs.filter(c => !(c.side === sideIndex && c.abilityId === abilityId));
  },

  /** True when this tile is scenery THIS side may pay to demolish. */
  canClear(side, gx, gy) {
    const S = this.sides[side];
    if (!S) return false;
    const k = this.tileKey(gx, gy);
    if (!this.blocked.has(k)) return false;
    if (this.laneBlocked.has(k)) return false;      /* never the lane itself */
    if (!FIELD.terrain.has(k)) return false;        /* only authored scenery */
    if (!this.ownsTile(side, gx, gy)) return false;
    /* The allowance is this commander's own. Comparing the SHARED union here
       meant a rival's demolitions counted against the player's five. */
    return S.cleared.size < this.clearLimit(side);
  },

  /** Price of this side's Nth clearance. ONE definition: the rubble panel's
      "next costs" line and the charge the engine takes must never disagree,
      and a 35% SAPPER CORPS discount is exactly the kind of multiplier a
      preview has silently dropped before (see ROADMAP, the UI-number rule). */
  clearCostAt(side, n) {
    const d = this.sides[side].mods.clearDiscount || 0;
    return Math.max(CLEAR_COST_FLOOR, Math.round(clearCost(n) * (1 - d)));
  },
  clearCostNow(side) { return this.clearCostAt(side, this.sides[side].cleared.size); },
  clearLimit(side) { return CLEAR_MAX + (this.sides[side].mods.clearBonus || 0); },

  /** Free demolitions from a land card: the rubble nearest the DRAFTING
      commander's own base, on the DRAFTING commander's own half. Both used to
      be hard-coded to side 0, so a rival's SAPPER CORPS opened ground beside
      the player's base and spent the player's allowance doing it. */
  grantClearances(sideIndex, n) {
    const si = sideIndex || 0;
    const S = this.sides[si];
    if (!S || !FIELD || !FIELD.bases[si]) return 0;
    const home = FIELD.bases[si];
    const list = [];
    for (const k of FIELD.terrain) {
      if (this.clearedTerrain.has(k)) continue;
      const [gx, gy] = k.split(',').map(Number);
      if (this.laneBlocked.has(k) || !this.ownsTile(si, gx, gy)) continue;
      list.push([k, gx, gy, dist2(gx, gy, home[0], home[1])]);
    }
    list.sort((a, b) => a[3] - b[3]);
    let done = 0;
    for (const [k, gx, gy] of list) {
      if (done >= n) break;
      this.blocked.delete(k);
      this.clearedTerrain.add(k);
      S.cleared.add(k);
      /* The explosion stays for BOTH sides: a tile visibly vanishing off the
         rival's half needs the same explanation the player's does. Only the
         SOUND is the player's, exactly as clearTerrain already has it. */
      this.spawnExplosion(gx * TILE + TILE / 2, gy * TILE + TILE / 2, TILE * 0.9, '#94a3b8');
      done++;
    }
    if (done) { this.renderBackground(); if (si === 0) Sound.play('wallBreak'); }
    return done;
  },

  /** Demolish one rubble tile into buildable ground. */
  clearTerrain(side, gx, gy) {
    const S = this.sides[side];
    if (!this.canClear(side, gx, gy)) { if (side === 0) Sound.play('denied'); return false; }
    const cost = this.clearCostNow(side);
    if (S.gold < cost) { if (side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
    S.gold -= cost;
    const k = this.tileKey(gx, gy);
    this.blocked.delete(k);
    this.clearedTerrain.add(k);
    S.cleared.add(k);
    this.renderBackground();
    if (side === 0) {
      this.spawnExplosion(gx * TILE + TILE / 2, gy * TILE + TILE / 2, TILE * 0.9, '#94a3b8');
      this.addFloater(gx * TILE + TILE / 2, gy * TILE - 10,
                      '−◈' + formatNum(cost) + ' CLEARED', false, '#cbd5e1', 14);
      Sound.play('wallBreak');
    }
    /* Same gate as every other sink: the rival demolishing its own rubble is
       not a reason to rebuild the player's shop. */
    if (side === this.viewSide) UI.syncAll(); else UI.syncLive();
    return true;
  },

  /** What moving this tower costs right now. Reads the CURRENT investment,
      so relocating an ascended tower is genuinely expensive. */
  relocateCost(t) {
    /* The default belongs to the SAME const the Field Manual quotes. Hoisting
       RELOCATE_FEE_FRAC and leaving a second literal here is the exact desync
       the hoist exists to prevent: any side whose mods never ran through
       freshMods would have been charged 35% under a manual promising 33%. */
    return Math.max(RELOCATE_MIN_FEE,
                    Math.round(t.invested * (this.sides[t.side].mods.relocFee || RELOCATE_FEE_FRAC)));
  },

  /** Pick a tower up and set it down elsewhere: keeps every upgrade, costs a
     fee, and goes dark for a few seconds. Commitment becomes priced rather
     than permanent. Never refunds and never resets level/branch/asc, so it
     cannot be used to launder the per-copy price curve. */
  relocate(t, gx, gy) {
    if (!t) return false;
    const S = this.sides[t.side];
    /* MEMBERSHIP, not a `dead` flag. Nothing in the codebase ever sets `dead`
       on a Tower — all 18 writers are enemies, projectiles or constructs — so
       the old guard was vestigial and a sold tower could still be relocated,
       charged for, and re-selected. Being in its side's list is the only
       honest test of whether a tower is still on the board. */
    if (!S || S.towers.indexOf(t) < 0) return false;
    if (!this.canBuild(t.side, gx, gy)) { if (t.side === 0) Sound.play('denied'); return false; }
    const fee = this.relocateCost(t);
    if (S.gold < fee) { if (t.side === 0) { Sound.play('denied'); UI.flashGold(); } return false; }
    S.gold -= fee;
    t.gx = gx; t.gy = gy;
    t.x = gx * TILE + TILE / 2;
    t.y = gy * TILE + TILE / 2;
    /* Node affinity is a property of the TILE, so moving on or off one has to
       re-read it, and recompute is where that reading happens. */
    t.recompute();
    /* The downtime is the real cost. The jam path already models a fully
       offline tower, so reuse it rather than inventing a second concept.
       Note `jammed` is a getter over jamTimer -- writing to it does nothing. */
    t.jamTimer = Math.max(t.jamTimer || 0, RELOCATE_DOWNTIME);
    if (t.wallList) t.wallList.length = 0;
    this.recomputeAuras();
    this.renderBackground();
    if (t.side === 0) {
      this.addFloater(t.x, t.y - 22, '−◈' + formatNum(fee) + ' MOVED', false, '#7dd3fc', 14);
      Sound.play('place');
    }
    if (t.side === this.viewSide) UI.syncAll(); else UI.syncLive();
    return true;
  },

  addFloater(x, y, text, crit = false, color = null, size = null) {
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({ x: x + rand(-5, 5), y,
      text: typeof text === 'number' ? formatNum(text) : text,
      life: crit ? 1.0 : 0.7, maxLife: crit ? 1.0 : 0.7,
      color: color || (crit ? '#ffffff' : '#ffe9a8'),
      size: size || (crit ? 18 : 11), vy: crit ? -36 : -26 });
  },

  /* ================================================================ LOOP */

  loop(ts) {
    const dtReal = Math.min(0.1, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;
    /* In the menu the canvas is hidden, yet this loop kept simulating particles
       and DRAWING the finished battle's full entity set every frame -- which is
       why menus grew sluggish after long sessions and snapped back the moment a
       new match cleared the arrays. Idle completely instead. */
    if (this.state === 'menu') {
      requestAnimationFrame(t => this.loop(t));
      return;
    }
    if (this.state === 'playing' && !this.paused) {
      this.acc += dtReal * this.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) { this.step(STEP); this.acc -= STEP; steps++; }
      if (steps >= MAX_STEPS) this.acc = 0;
    } else {
      this.acc = 0;
      this.updateParticles(dtReal);
      if (this.bannerTimer > 0) this.bannerTimer -= dtReal;
      if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dtReal * 40);
      if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dtReal * 2.2);
    }
    /* The end screen sits over a frozen field; one painted frame is enough. */
    if (this.sides.length && (this.state !== 'over' || !this._overDrawn)) {
      this.draw();
      if (this.state === 'over') this._overDrawn = true;
    }
    requestAnimationFrame(t => this.loop(t));
  },

  step(dt) {
    this.clock += dt;

    /* --- wave timing ---
       Counts down unconditionally while no wave is spawning. Guarding this on
       `prepTimer > 0` would deadlock the whole cycle if the timer ever reached
       exactly zero by any route other than this branch. */
    if (!this.waveRunning) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) { this.prepTimer = 0; this.startWave(); }
    }
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.clock) this.spawnFromQueue(this.spawnQueue.shift());
    if (this.waveRunning && !this.spawnQueue.length) this.onWaveSpawned();

    /* --- towers --- */
    for (const S of this.sides) for (const t of S.towers) { t.tickCooldowns(dt); t.update(dt, this); }

    /* --- ability constructs ---
       They are not towers and no tower owns them, so nothing else would tick
       them. Reverse order because an expiring construct removes itself. */
    for (let i = this.constructs.length - 1; i >= 0; i--) {
      this.constructs[i].update(dt, this);
      if (this.constructs[i].dead) this.constructs.splice(i, 1);
    }

    for (const b of this.brains) if (!b.side.defeated) b.update(dt, this);
    for (const S of this.sides) tickAbilities(S, this, dt);

    /* --- burning ground --- */
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.life -= dt;
      if (p.life <= 0) { this.puddles.splice(i, 1); continue; }
      const r2 = p.radius * p.radius;
      for (const e of this.enemies) {
        if (e.dead || e.flying || e.hostileTo !== p.side) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= r2) {
          const dealt = e.takeDamage(p.dps * dt, 'magic', { dot: true });
          if (p.tower) p.tower.registerDamage(dealt, e, this, false, true);
          e.applyBurn(p.dps * 0.4, 1.2, p.tower);
        }
      }
      if (Math.random() < dt * 20) this.spawnParticle(p.x + rand(-p.radius, p.radius), p.y + rand(-p.radius, p.radius),
        rand(-8, 8), rand(-30, -10), rand(0.3, 0.6), rand(2, 4), '#ff8a3d', 'fire');
    }

    /* --- enemies ---
       A defensive ability damps everything walking at the side that used it. */
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const damp = this.enemyDamp[e.hostileTo];
      /* `reanimOnly` damping bites the dead your rival sent and nothing else. */
      if (damp && !e.boss && !e.miniboss && (!damp.reanimOnly || e.reanimated)) {
        e.dampSpeed = damp.speed; e.dampPower = damp.power;
      } else { e.dampSpeed = 1; e.dampPower = 1; }
      e.update(dt);
    }

    /* --- delayed effects (cyclone drops, aftershocks) --- */
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) { this.delayed.splice(i, 1); try { d.fn(); } catch (e) {} }
    }

    /* --- WARD fields: mark protected towers, apply their combat blessing --- */
    this._purgeFields = this._purgeFields || [];
    this._purgeFields.length = 0;
    for (const S of this.sides) {
      for (const t of S.towers) {
        /* FEDERATION hardware suppresses status on ITSELF as well: a Light
           tower is never jammed or sabotaged. Set here rather than in
           recompute because this pass already clears the flag every frame,
           so there is nowhere for a stale immunity to survive. */
        t.jamImmune = (t.def.origin === 'light') || !!(S.traits && S.traits.jamImmune);
        /* restore the beacon-derived baseline before wards re-apply */
        if (t._baseAura) { t.aura.dmg = t._baseAura.dmg; t.aura.rate = t._baseAura.rate; t.aura.range = t._baseAura.range; }
        else t._baseAura = { dmg: t.aura.dmg, rate: t.aura.rate, range: t.aura.range };
      }
      for (const w of S.towers) {
        if (w.def.attack !== 'ward') continue;
        const r2 = w.rangePx * w.rangePx;
        /* PURGE. A sanctity field does not only protect what stands inside it,
           it dims what the ENEMY's aura carriers project there. Banked as a
           flat list so the aura pass below resolves it once per unit instead
           of once per (carrier, unit) pair. */
        if (w.stats.wardPurge)
          this._purgeFields.push({ x: w.x, y: w.y, r2, amt: w.stats.wardPurge, side: S.index });
        for (const t of S.towers) {
          if (t === w) continue;
          if (dist2(w.x, w.y, t.x, t.y) <= r2) {
            t.jamImmune = true;
            t.aura.dmg   += w.stats.wardDmg || 0;
            t.aura.rate  += w.stats.wardRate || 0;
            t.aura.range += w.stats.wardRange || 0;
          }
        }
      }
    }

    /* --- SHEPHERD fields: bless your outgoing reanimates once each --- */
    for (const S of this.sides) {
      for (const sh of S.towers) {
        if (sh.def.attack !== 'shepherd') continue;
        const r2 = sh.rangePx * sh.rangePx;
        for (const e of this.enemies) {
          if (e.dead || !e.reanimated || e.blessed || e.owner !== S.index) continue;
          if (dist2(sh.x, sh.y, e.x, e.y) > r2) continue;
          e.blessed = true;
          const st = sh.stats;
          e.maxHp *= 1 + (st.flockHp || 0);
          e.hp = e.maxHp;
          e.baseSpeed *= 1 + (st.flockSpeed || 0);
          if (st.flockLives) e.livesCost += st.flockLives;
          if (st.flockGold) this.awardGold(S.index, st.flockGold, sh);
          this.spawnBurst(e.x, e.y, 6, sh.def.color, 70);
        }
      }
    }

    /* --- aura carriers: recompute every frame so killing one instantly
           strips the buff from everything it was protecting --- */
    for (const e of this.enemies) {
      e.auraSlowResist = 0; e.auraPullResist = 0; e.auraSpeed = 0; e.auraArmor = 0; e.auraTint = null;
      /* Strongest overlapping field wins rather than stacking, matching the
         Math.max the carriers themselves use one loop down. */
      let damp = 1;
      for (const f of this._purgeFields)
        if (f.side === e.hostileTo && dist2(f.x, f.y, e.x, e.y) <= f.r2) damp = Math.min(damp, 1 - f.amt);
      e.auraDamp = damp;
    }
    for (const c of this.enemies) {
      const a = c.def.aura;
      if (!a || c.dead) continue;
      const r2 = (a.radius * TILE) ** 2;
      for (const e of this.enemies) {
        if (e.dead || e.hostileTo !== c.hostileTo) continue;
        if (dist2(c.x, c.y, e.x, e.y) > r2) continue;
        const k = e.auraDamp === undefined ? 1 : e.auraDamp;
        if (a.slowResist) e.auraSlowResist = Math.max(e.auraSlowResist, a.slowResist * k);
        if (a.pullResist) e.auraPullResist = Math.max(e.auraPullResist, a.pullResist * k);
        if (a.speed)      e.auraSpeed      = Math.max(e.auraSpeed, a.speed * k);
        if (a.armor)      e.auraArmor      = Math.max(e.auraArmor, a.armor * k);
        if (e !== c) e.auraTint = a.tint;
      }
    }

    /* --- menders repair their own faction only --- */
    for (const m of this.enemies) {
      if (m.dead || !m.def.healRate) continue;
      const r2 = (m.def.healRadius * TILE) ** 2;
      for (const e of this.enemies) {
        if (e === m || e.dead || e.hp >= e.maxHp || e.hostileTo !== m.hostileTo) continue;
        if (dist2(m.x, m.y, e.x, e.y) <= r2) {
          e.hp = Math.min(e.maxHp, e.hp + m.def.healRate * dt);
          if (Math.random() < dt * 2) this.spawnParticle(e.x + rand(-5, 5), e.y + rand(-5, 5), 0, rand(-28, -12), 0.45, 2.2, '#34d399', 'spark');
        }
      }
    }

    /* --- projectiles --- */
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this);
      if (p.dead) this.projectiles.splice(i, 1);
    }

    /* --- reap --- */
    const leaked = this.sides.map(() => 0);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.killEnemy(e); this.enemies.splice(i, 1); }
      else if (e.leaked) {
        /* A defensive ability that weakens attackers also blunts what a leak
           costs, and VESS-style traits shave one life off every breach. */
        let cost = e.livesCost * ((this.enemyDamp[e.hostileTo] || {}).power || 1);
        const red = this.sides[e.hostileTo].traits.leakReduction || 0;
        cost = Math.max(1, Math.round(cost - red));
        leaked[e.hostileTo] += cost;
        this.enemies.splice(i, 1);
      }
    }
    for (let s = 0; s < this.sides.length; s++) if (leaked[s] > 0) this.loseLives(s, leaked[s]);

    if (this.pendingSpawns.length) {
      for (const e of this.pendingSpawns) this.enemies.push(e);
      this.pendingSpawns.length = 0;
    }

    this.updateParticles(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);

    this.uiTick = (this.uiTick || 0) + dt;
    if (this.uiTick > 0.12) { this.uiTick = 0; UI.syncLive(); }
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'fire') { p.vy -= 32 * dt; p.vx *= 0.94; p.vy *= 0.96; }
      else if (p.kind === 'spark') { p.vx *= 0.9; p.vy *= 0.9; p.vy += 58 * dt; }
      else if (p.kind === 'pull') { p.vx *= 0.9; p.vy *= 0.9; }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      f.y += f.vy * dt; f.vy *= 0.93;
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
  },

  /* =========================================================== RENDERING */

  renderBackground() {
    /* Bake the terrain at the same effective resolution the board is displayed
       at, so a fitted board stays as crisp as an unfitted one. */
    const c = this.bgCanvas, k = this.dpr * (this.viewScale || 1);
    c.width = Math.round(this.width * k); c.height = Math.round(this.height * k);
    const x = c.getContext('2d');
    x.setTransform(k, 0, 0, k, 0, 0);

    const g = x.createLinearGradient(0, 0, this.width, 0);
    g.addColorStop(0,    '#081420');
    g.addColorStop(0.42, '#0a0f1a');
    g.addColorStop(0.5,  '#0d0a14');
    g.addColorStop(0.58, '#0a0f1a');
    g.addColorStop(1,    '#1a0d16');
    x.fillStyle = g; x.fillRect(0, 0, this.width, this.height);

    /* territory tint so ownership reads instantly */
    /* The grid STROKE beneath this used the hard-coded pair while the fill
       above it was already per-faction, so on a tri board the third seat's
       ground was washed in its own colour and outlined in the second seat's.
       Precomputed per side rather than per tile: this loop runs cols x rows.
       BATCH-C/nside */
    const line = this.sides.map((S2, i) => sideRgba(i, 0.075));
    const tint = this.sides.map((S2, i) => {
      const col = FACTIONS[S2.faction] ? FACTIONS[S2.faction].color : (i ? '#ff6b9d' : '#38e8ff');
      const c2 = col.replace('#', '');
      const rr = parseInt(c2.slice(0, 2), 16), gg = parseInt(c2.slice(2, 4), 16), bb = parseInt(c2.slice(4, 6), 16);
      return `rgba(${rr},${gg},${bb},0.030)`;
    });
    for (let gy = 0; gy < FIELD.rows; gy++) {
      for (let gx = 0; gx < FIELD.cols; gx++) {
        const neutral = FIELD.ownerGrid
          ? FIELD.ownerGrid[gy][gx] === -1
          : (gx >= FIELD.neutral.from && gx <= FIELD.neutral.to);
        const side = FIELD.ownerGrid
          ? FIELD.ownerGrid[gy][gx]
          : (gx <= FIELD.buildMax[0] ? 0 : gx >= FIELD.buildMax[1] ? 1 : -1);
        if (this.blocked.has(this.tileKey(gx, gy))) continue;
        const px = gx * TILE, py = gy * TILE;
        x.fillStyle = neutral ? 'rgba(255,255,255,0.012)' : (side >= 0 ? tint[side] : 'rgba(255,255,255,0.012)');
        x.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        x.strokeStyle = neutral || side < 0 ? 'rgba(160,160,190,0.05)' : (line[side] || 'rgba(160,160,190,0.05)');
        x.lineWidth = 1;
        x.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      }
    }

    /* lanes */
    const trace = (p, ctx2) => {
      ctx2.beginPath();
      ctx2.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) ctx2.lineTo(p.pts[i].x, p.pts[i].y);
    };
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const p of [].concat(...this.lanes)) {
      trace(p, x); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = TILE + 5; x.stroke();
      trace(p, x); x.strokeStyle = '#151b28';          x.lineWidth = TILE - 2; x.stroke();
      trace(p, x); x.strokeStyle = 'rgba(90,150,200,0.18)'; x.lineWidth = TILE - 7; x.stroke();
    }

    /* Impassable terrain — rubble that removes build space entirely. */
    for (const key of FIELD.terrain) {
      if (this.clearedTerrain.has(key)) continue;   /* bought and demolished */
      const [gx, gy] = key.split(',').map(Number);
      const px = gx * TILE, py = gy * TILE;
      x.fillStyle = '#0c1119';
      x.fillRect(px, py, TILE, TILE);
      x.fillStyle = 'rgba(120,140,170,0.10)';
      for (let i = 0; i < 4; i++) {
        const rx = px + 4 + ((gx * 7 + i * 13) % (TILE - 12));
        const ry = py + 4 + ((gy * 11 + i * 17) % (TILE - 12));
        x.fillRect(rx, ry, 5 + (i % 3) * 3, 4 + (i % 2) * 3);
      }
      x.strokeStyle = 'rgba(90,110,140,0.22)';
      x.lineWidth = 1;
      x.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }

    /* Ground outside the arena, and ground the singularity has eaten. Both are
       baked with the terrain because both are static until the next
       contraction -- which re-bakes. The eaten tiles are painted TILE BY TILE,
       so what the board shows is exactly the set `blocked` refuses. */
    if (FIELD.radial) {
      for (const key of FIELD.voidTiles) {
        const p = key.split(',');
        x.fillStyle = '#05070d';
        x.fillRect(p[0] * TILE, p[1] * TILE, TILE, TILE);
      }
      /* `|| []` because a resize can re-bake the background between a field
         being built and a match owning it. */
      for (const key of (this.consumed || [])) {
        const p = key.split(',');
        const px2 = p[0] * TILE, py2 = p[1] * TILE;
        x.fillStyle = '#06030c';
        x.fillRect(px2, py2, TILE, TILE);
        x.strokeStyle = 'rgba(167,139,250,0.16)';
        x.lineWidth = 1;
        x.strokeRect(px2 + 0.5, py2 + 0.5, TILE - 1, TILE - 1);
      }
    }

    /* Terrain nodes. Static for the whole battle, so the offscreen bake that
       already carries the terrain carries these for free. Drawn after the lane
       pass because a lane node has to read ON the lane it charges. */
    x.save();
    for (const n of (FIELD.nodes || [])) {
      const el = ELEMENTS[n.el];
      if (!el) continue;
      const ncx = (n.gx + 0.5) * TILE, ncy = (n.gy + 0.5) * TILE;
      const ng = x.createRadialGradient(ncx, ncy, 2, ncx, ncy, TILE * 0.92);
      ng.addColorStop(0, el.color + '55');
      ng.addColorStop(1, el.color + '00');
      x.fillStyle = ng;
      x.beginPath(); x.arc(ncx, ncy, TILE * 0.92, 0, TAU); x.fill();
      x.strokeStyle = el.color; x.lineWidth = 1.6; x.globalAlpha = 0.85;
      x.beginPath();
      if (n.kind === 'lane') {
        /* A lane node reads as a gate you pass through; a build node as a
           socket you stand a tower in. One glance has to say which. */
        x.setLineDash([4, 4]);
        x.arc(ncx, ncy, TILE * 0.42, 0, TAU);
        x.stroke(); x.setLineDash([]);
      } else {
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 - Math.PI / 2;
          const hx = ncx + Math.cos(a) * TILE * 0.38, hy = ncy + Math.sin(a) * TILE * 0.38;
          if (i) x.lineTo(hx, hy); else x.moveTo(hx, hy);
        }
        x.closePath(); x.stroke();
      }
      x.globalAlpha = 0.95;
      x.fillStyle = el.color;
      x.font = '13px ui-monospace, monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(el.icon, ncx, ncy + 0.5);
    }
    x.restore();

    /* neutral corridor marking -- a band between two facing halves, which is
       not a thing a radial board has: there the neutral ground is the hub, and
       the singularity is drawn over it every frame. */
    if (!FIELD.radial) {
      const nx = FIELD.neutral.from * TILE, nw = (FIELD.neutral.to - FIELD.neutral.from + 1) * TILE;
      x.fillStyle = 'rgba(200,180,255,0.035)';
      x.fillRect(nx, 0, nw, this.height);
      x.strokeStyle = 'rgba(200,180,255,0.22)';
      x.setLineDash([7, 9]); x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(nx, 0); x.lineTo(nx, this.height);
      x.moveTo(nx + nw, 0); x.lineTo(nx + nw, this.height); x.stroke();
      x.setLineDash([]);
    }

    /* spawn maw */
    const cx = FIELD.spawn ? (FIELD.spawn[0] + 0.5) * TILE : this.width / 2;
    const cy = FIELD.spawn ? (FIELD.spawn[1] + 0.5) * TILE : (7 + 0.5) * TILE;
    const rg = x.createRadialGradient(cx, cy, 4, cx, cy, TILE * 2.2);
    rg.addColorStop(0, 'rgba(216,180,254,0.5)');
    rg.addColorStop(1, 'rgba(216,180,254,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, TILE * 2.2, 0, TAU); x.fill();

    /* base markers */
    const bcol = this.sides.map((S2, i) => FACTIONS[S2.faction] ? FACTIONS[S2.faction].color : (i ? '#ff6b9d' : '#38e8ff'));
    for (let s = 0; s < this.sides.length && s < FIELD.bases.length; s++) {
      const b = FIELD.bases[s];
      const bx = (b[0] + 0.5) * TILE, by = (b[1] + 0.5) * TILE;
      const bg = x.createRadialGradient(bx, by, 4, bx, by, TILE * 2.4);
      /* The ring drawn immediately below already uses the seat's faction
         colour; the glow under it did not, so on every board past the second
         seat -- and on any duel where the player is not human -- the two
         disagreed. BATCH-C/nside */
      bg.addColorStop(0, sideRgba(s, 0.4));
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = bg; x.beginPath(); x.arc(bx, by, TILE * 2.4, 0, TAU); x.fill();
      x.strokeStyle = bcol[s]; x.lineWidth = 2;
      x.beginPath(); x.arc(bx, by, TILE * 0.8, 0, TAU); x.stroke();
    }

    const v = x.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.38,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = v; x.fillRect(0, 0, this.width, this.height);
  },

  draw() {
    const ctx = this.ctx;
    /* This MUST include viewScale. Resetting to dpr alone drew the world at 1:1
       into a backing store sized for the fitted board, so the field rendered
       cropped and every pointer coordinate was offset. */
    const k = this.dpr * (this.viewScale || 1);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.shakeAmt > 0.2) ctx.translate(rand(-this.shakeAmt, this.shakeAmt) * 0.16, rand(-this.shakeAmt, this.shakeAmt) * 0.16);

    ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
    this.drawSingularity(ctx);
    this.drawLaneFlow(ctx);
    this.drawPuddles(ctx);
    for (const S of this.sides) for (const t of S.towers) {
      if (t.isSupport) t.drawAuraField(ctx);
      if (t.drawExpansionField) t.drawExpansionField(ctx);
    }
    this.drawBuildOverlay(ctx);
    this.drawAimOverlay(ctx);
    this.drawSelection(ctx);

    for (const S of this.sides) for (const t of S.towers) t.draw(ctx, this);
    for (const c of this.constructs) c.draw(ctx, this);
    for (const e of this.enemies) if (!e.flying) e.draw(ctx);
    for (const e of this.enemies) if (e.flying) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    this.drawBeams(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
    this.drawOverlays(ctx);
    /* Last, and outside the shake transform above: a menu that shakes with
       the battlefield cannot be read, let alone aimed at. */
    this.drawRadial(ctx);
  },

  drawLaneFlow(ctx) {
    ctx.save();
    ctx.setLineDash([10, 18]);
    ctx.lineDashOffset = -(this.clock * 40) % 28;
    for (let s = 0; s < this.lanes.length; s++) {
      /* Three authored tints cover a tri board. Past that the seat's own power
         colours its lane, or twenty lanes would share one colour. */
      ctx.strokeStyle = LANE_FLOW_TINTS[s] || this.seatTint(s, 0.26);
      ctx.lineWidth = 2.5;
      for (const p of this.lanes[s]) {
        ctx.beginPath(); ctx.moveTo(p.pts[0].x, p.pts[0].y);
        for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
        ctx.stroke();
      }
    }
    /* air corridors, brightened when flyers are inbound */
    const airborne = this.enemies.some(e => e.flying);
    const incoming = airborne || this.flyersExpected();
    ctx.setLineDash([4, 11]);
    ctx.lineDashOffset = -(this.clock * 55) % 15;
    ctx.strokeStyle = `rgba(94,234,212,${incoming ? 0.4 : 0.1})`;
    ctx.lineWidth = incoming ? 2.4 : 1.6;
    for (const p of this.airLanes) {
      ctx.beginPath(); ctx.moveTo(p.pts[0].x, p.pts[0].y); ctx.lineTo(p.pts[1].x, p.pts[1].y); ctx.stroke();
    }
    ctx.restore();
  },

  flyersExpected() {
    for (const s of this.spawnQueue) { const d = ENEMY_TYPES[s.type]; if (d && d.flying) return true; }
    for (const g of this.waveDef(this.wave + 1).groups) { const d = ENEMY_TYPES[g.type]; if (d && d.flying) return true; }
    return false;
  },

  /** A seat's colour, from the power that holds it. */
  seatTint(s, alpha) {
    const S = this.sides[s];
    const col = (S && FACTIONS[S.faction] && FACTIONS[S.faction].color) || '#94a3b8';
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  },

  /** The singularity. The ground it has already taken is baked into the
      background, so this draws only what moves — and the horizon is drawn as
      the DIAMOND the rule is actually measured in, not as a circle it is not. */
  drawSingularity(ctx) {
    if (!FIELD.radial) return;
    const cx = (FIELD.centre[0] + 0.5) * TILE, cy = (FIELD.centre[1] + 0.5) * TILE;
    const r = Math.max(this.horizon, FIELD.core) * TILE;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.7);
    g.addColorStop(0, 'rgba(8,3,18,0.96)');
    g.addColorStop(0.5, 'rgba(76,29,149,0.42)');
    g.addColorStop(1, 'rgba(76,29,149,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, TAU); ctx.fill();
    for (let i = 0; i < MAELSTROM_DISC_ARCS; i++) {
      const rr = r * (0.5 + i * 0.3);
      const a0 = this.clock * (0.75 + i * 0.4) * (i % 2 ? -1 : 1);
      ctx.strokeStyle = i % 2 ? 'rgba(167,139,250,0.32)' : 'rgba(56,232,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 + 2.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0 + Math.PI, a0 + Math.PI + 1.35); ctx.stroke();
    }
    const h = this.horizon * TILE;
    ctx.strokeStyle = 'rgba(216,180,254,0.55)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 7]);
    ctx.lineDashOffset = -(this.clock * 12) % 13;
    ctx.beginPath();
    ctx.moveTo(cx + h, cy); ctx.lineTo(cx, cy + h); ctx.lineTo(cx - h, cy); ctx.lineTo(cx, cy - h);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  drawPuddles(ctx) {
    for (const p of this.puddles) {
      const f = p.life / p.maxLife;
      ctx.save(); ctx.globalAlpha = 0.26 + f * 0.32;
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius);
      g.addColorStop(0, '#ffb347'); g.addColorStop(0.55, 'rgba(255,107,74,0.7)'); g.addColorStop(1, 'rgba(160,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (0.85 + Math.sin(this.clock * 2 + p.seed) * 0.08), 0, TAU); ctx.fill();
      ctx.restore();
    }
  },

  drawBuildOverlay(ctx) {
    if (!this.selectedType || !this.hover.active || this.state !== 'playing') return;
    const def = TOWER_TYPES[this.selectedType];
    const { gx, gy } = this.hover;
    const cx = (gx + 0.5) * TILE, cy = (gy + 0.5) * TILE;
    const ok = this.canBuild(0, gx, gy) && this.sides[0].gold >= this.towerCost(0, this.selectedType);
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(74,222,128,0.09)' : 'rgba(239,68,68,0.11)';
    ctx.strokeStyle = ok ? 'rgba(74,222,128,0.9)' : 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, def.base.range * TILE * this.sides[0].mods.range, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([5, 5]); ctx.strokeRect(gx * TILE + 2, gy * TILE + 2, TILE - 4, TILE - 4); ctx.setLineDash([]);
    ctx.globalAlpha = 0.6; ctx.fillStyle = ok ? def.color : '#ef4444';
    ctx.beginPath(); ctx.roundRect(cx - 13, cy - 13, 26, 26, 5); ctx.fill();
    ctx.restore();
  },

  /** Ghost for an armed aimed ability: where the construct would land and
      whether the tile will take it. It deliberately mirrors the build ghost,
      because aiming should feel like placing — it is placing. */
  drawAimOverlay(ctx) {
    const def = this.aimedDef();
    if (!def || !this.hover.active || this.state !== 'playing') return;
    const { gx, gy } = this.hover;
    const ok = this.canAim(0, gx, gy, def);
    const anchor = (ok && def.lane) ? this.laneAnchor(0, gx, gy) : null;
    const cx = anchor ? anchor.x : (gx + 0.5) * TILE;
    const cy = anchor ? anchor.y : (gy + 0.5) * TILE;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(125,211,252,0.10)' : 'rgba(239,68,68,0.11)';
    ctx.strokeStyle = ok ? 'rgba(125,211,252,0.95)' : 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, constructFootprint(def) * TILE, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(gx * TILE + 2, gy * TILE + 2, TILE - 4, TILE - 4);
    /* The tether shows the snap: the wall lands on the lane, not the tile. */
    if (anchor) { ctx.beginPath(); ctx.moveTo((gx + 0.5) * TILE, (gy + 0.5) * TILE); ctx.lineTo(cx, cy); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.restore();
  },

  drawSelection(ctx) {
    const t = this.selected;
    if (!t) return;
    ctx.save();
    ctx.strokeStyle = t.def.color; ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = -(this.clock * 20) % 26;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.rangePx, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.09; ctx.fillStyle = t.def.color; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeRect(t.gx * TILE + 2, t.gy * TILE + 2, TILE - 4, TILE - 4);
    ctx.restore();
  },

  drawBeams(ctx) {
    for (const b of this.beams) {
      const f = b.life / b.maxLife;
      /* A jam pulse is an expanding ring, not a line. */
      if (b.ring) {
        ctx.save();
        ctx.globalAlpha = f * 0.8;
        ctx.strokeStyle = b.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.points[0].x, b.points[0].y, b.ring * (1 - f), 0, TAU); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalAlpha = f; ctx.shadowColor = b.color; ctx.shadowBlur = 14;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.width * f + 0.5; ctx.lineCap = 'round';
      ctx.beginPath();
      const pts = b.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        if (b.jagged) {
          const a = pts[i - 1], c = pts[i];
          for (let s = 1; s <= 4; s++) {
            const t = s / 4;
            ctx.lineTo(lerp(a.x, c.x, t) + (s === 4 ? 0 : rand(-6, 6)), lerp(a.y, c.y, t) + (s === 4 ? 0 : rand(-6, 6)));
          }
        } else if (b.chain) {
          /* tether cable sags between its endpoints */
          const a = pts[i - 1], c = pts[i];
          for (let s = 1; s <= 6; s++) {
            const t = s / 6;
            ctx.lineTo(lerp(a.x, c.x, t), lerp(a.y, c.y, t) + Math.sin(t * Math.PI) * 7 * f);
          }
        } else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.6, b.width * f * 0.35); ctx.stroke();
      ctx.restore();
    }
  },

  drawParticles(ctx) {
    for (const p of this.particles) {
      const f = p.life / p.maxLife;
      if (p.kind === 'shock' || p.kind === 'implode') {
        const grow = p.kind === 'shock' ? (1.15 - f) : f;
        ctx.save();
        ctx.globalAlpha = f * 0.72; ctx.strokeStyle = p.color; ctx.lineWidth = 3 * f + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * grow, 0, TAU); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = f; ctx.fillStyle = p.color;
      const s = p.size * (p.kind === 'fire' ? f : 1);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  },

  drawFloaters(ctx) {
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const t = f.life / f.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.8);
      ctx.font = `bold ${f.size}px ui-monospace, Consolas, monospace`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  },

  drawOverlays(ctx) {
    /* Ability activation signature: offense radiates from the base outward,
       defense draws inward -- tinted by the commander who fired it. */
    if (this.fxRing && this.fxRing.t < this.fxRing.dur) {
      const f = this.fxRing; f.t += 1 / 60;
      const k = f.t / f.dur;
      const e = 1 - Math.pow(1 - k, 3);
      const b = FIELD.bases[0];
      /* An aimed ability carries its own origin; everything else still
         radiates from the base. */
      const cx0 = f.x !== undefined ? f.x : (b[0] + 0.5) * TILE;
      const cy0 = f.y !== undefined ? f.y : (b[1] + 0.5) * TILE;
      const maxR = Math.max(this.width, this.height) * 0.9;
      const r = f.kind === 'offense' ? e * maxR : (1 - e) * maxR;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = f.color; ctx.lineWidth = 3 + (1 - k) * 5;
      ctx.beginPath(); ctx.arc(cx0, cy0, Math.max(4, r), 0, TAU); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.10;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    /* base health pips at every base */
    /* This loop was `s < 2` long after its sibling in renderBackground had
       been N-ified, so CONFLUENCE's third base carried a faction ring and no
       life count and THE MAELSTROM left eighteen of twenty seats without one
       -- in the mode where seat attrition IS the game, and where the ladder
       deliberately prints alive/dead only and the third-commander HUD panel
       is hidden by CSS. It is now shaped exactly like that sibling. The
       caption asks the engine who the rival is (Game.musterVictims, the same
       answer the muster panel and every send use) instead of assuming seat 1,
       so an eliminated seat stops wearing the RIVAL label after the war has
       narrowed past it. BATCH-C/nside */
    const foes = this.musterVictims(this.viewSide);
    const crowd = this.sides.length > PIP_CROWD_SEATS;
    for (let s = 0; s < this.sides.length && s < FIELD.bases.length; s++) {
      const S = this.sides[s];
      const b = FIELD.bases[s];
      /* The x clamp keeps a pip on a board-edge base readable. A ring board
         has no edge bases, and there the clamp only drags the outermost seats'
         text off the markers it belongs to. */
      const bx0 = (b[0] + 0.5) * TILE;
      const bx = FIELD.radial ? bx0 : clamp(bx0, 34, this.width - 34), by = (b[1] + 0.5) * TILE;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + (crowd ? PIP_FONT_PX_CROWD : PIP_FONT_PX) + 'px ui-monospace, monospace';
      ctx.fillStyle = sideColor(s);
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
      /* The HUD prints ♥☠ for a fallen commander; a pip reading ♥ 0 for the
         rest of the battle said the seat was merely on its last life. */
      ctx.fillText(S.defeated ? '☠' : '♥ ' + S.lives, bx, by + 5);
      ctx.font = (crowd ? PIP_LABEL_PX_CROWD : PIP_LABEL_PX) + 'px ui-monospace, monospace';
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(s === this.viewSide ? 'YOU'
                 : S.defeated ? 'FALLEN'
                 : foes.indexOf(s) >= 0 ? 'RIVAL' : 'SEAT ' + s, bx, by + 20);
      ctx.restore();
    }

    if (this.hurtFlash > 0) {
      const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.28, this.width / 2, this.height / 2, this.height * 0.85);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(1, `rgba(239,68,68,${this.hurtFlash * 0.55})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.bannerTimer > 0) {
      const f = this.bannerTimer / this.bannerMax;
      ctx.save();
      ctx.globalAlpha = clamp(Math.min(1, f * 3) * Math.min(1, (1 - f) * 6 + 0.35), 0, 1);
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px ui-monospace, Consolas, monospace';
      const y = this.height * 0.22;
      const w = ctx.measureText(this.bannerText).width + 50;
      ctx.fillStyle = 'rgba(4,8,14,0.78)'; ctx.fillRect(this.width / 2 - w / 2, y - 28, w, 42);
      ctx.strokeStyle = this.bannerColor; ctx.lineWidth = 2;
      ctx.strokeRect(this.width / 2 - w / 2, y - 28, w, 42);
      ctx.shadowColor = this.bannerColor; ctx.shadowBlur = 18;
      ctx.fillStyle = this.bannerColor; ctx.fillText(this.bannerText, this.width / 2, y);
      ctx.restore(); ctx.textAlign = 'left';
    }

    if (this.paused && this.state === 'playing') {
      ctx.fillStyle = 'rgba(4,8,14,0.6)'; ctx.fillRect(0, 0, this.width, this.height);
      ctx.save(); ctx.textAlign = 'center';
      ctx.fillStyle = '#e6f5ff'; ctx.font = 'bold 36px ui-monospace, monospace';
      ctx.fillText('PAUSED', this.width / 2, this.height / 2);
      ctx.restore();
    }
  },

  /* =============================================================== INPUT */

  /**
   * Pointer -> LOGICAL board coordinates. The canvas is FITTED with CSS while
   * its backing store stays at device resolution, so the ratio between the
   * element's live box and the logical board IS the view transform -- reading
   * it off getBoundingClientRect is what makes every measurement below track
   * the tile at any viewScale, with nothing to keep in step by hand.
   */
  pointerToBoard(evt) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (evt.clientX - r.left) * (this.width / r.width),
             y: (evt.clientY - r.top) * (this.height / r.height) };
  },

  pointerToGrid(evt) {
    const p = this.pointerToBoard(evt);
    return { gx: Math.floor(p.x / TILE), gy: Math.floor(p.y / TILE) };
  },

  /* ====================================================== RADIAL PLACEMENT */

  /**
   * Value-per-gold of putting `type` on this tile, in the units
   * AI.bestAction already scores a build in — the same effectiveness,
   * utility, coverage and diversity terms, read through a scratch scorer
   * bound to the player's side. The ordering the ring recommends is therefore
   * the ordering the RIVAL would act on: one model of the board, shown to
   * both commanders (ROADMAP:204).
   *
   * bestAction's board-crowding term is deliberately absent. It is identical
   * for every candidate at one instant, so it cannot change an ordering, and
   * carrying it would only invite the reader to think it might.
   */
  radialValue(scorer, type, gx, gy, prof) {
    const def = TOWER_TYPES[type];
    if (!def) return 0;
    const probe = new Tower(type, gx, gy, 0);
    const spot = { gx, gy, x: probe.x, y: probe.y, node: nodeAt(gx, gy, 'build') };
    let v;
    if (probe.isSupport) v = scorer.utilityValue(type, prof, spot);
    else {
      v = scorer.effectiveness(def, probe.stats, probe.estimateDps(), prof)
        + scorer.utilityValue(type, prof, spot);
      /* Coverage gates everything — a great tower on a dead tile is dead. */
      v *= scorer.covMul(scorer.coverage(probe.x, probe.y, probe.effRange));
    }
    v *= Math.pow(BUILD_DIVERSITY_FALLOFF, scorer.countOf(type));
    return v / Math.max(1, this.towerCost(0, type));
  },

  /**
   * The angle the PICKER will read once the drag reaches the icon ring.
   *
   * Ring space and gesture space share no origin. The ring is drawn and
   * picked around (mx, my), which slides inboard near a board edge, while the
   * gesture is drawn from wherever the finger landed inside the tile. Walking
   * the drag ray out to the ring and taking ITS angle converts one frame into
   * the other; with nothing clamped and a press on the tile centre it reduces
   * to the plain drag angle, which is all it ever was.
   *
   * The ray is measured against RADIAL_RING_TILES -- the icon ring itself --
   * so the answer is the angle of the icon the finger is about to arrive on,
   * not of the point it is passing through now.
   */
  radialAim(fromX, fromY, atX, atY, mx, my) {
    const vx = atX - fromX, vy = atY - fromY;
    const len = Math.hypot(vx, vy);
    if (len < 1e-6) return 0;
    const dx = vx / len, dy = vy / len;
    const px = fromX - mx, py = fromY - my;
    const rr = RADIAL_RING_TILES * TILE;
    const b = px * dx + py * dy;
    const disc = b * b - (px * px + py * py - rr * rr);
    /* A ray that never reaches the ring -- a press already outside it, aimed
       away -- has no crossing to measure, and the raw drag angle is the only
       honest answer left. */
    if (disc < 0) return Math.atan2(vy, vx);
    const t = -b + Math.sqrt(disc);
    if (!(t > 0)) return Math.atan2(vy, vx);
    return Math.atan2(py + t * dy, px + t * dx);
  },

  /**
   * Open the ring on a tile. Returns false when there is nothing to offer,
   * which is what tells the gesture to stand down and leave the press to the
   * handlers that already own this canvas.
   */
  openRadial(gx, gy, fromX, fromY, atX, atY) {
    const S = this.sides[0];
    if (!S || !this.canBuild(0, gx, gy)) return false;
    const types = (S.loadout || []).filter(t => TOWER_TYPES[t]);
    if (!types.length) return false;

    const scorer = Object.create(AI);
    scorer.side = S; scorer.diff = this.difficulty;
    /* buildSpots fills `samples`, which coverage() reads. The scratch scorer
       owns its own arrays, so nothing it does can reach the rival's. */
    scorer.buildSpots();
    const prof = scorer.profile();
    const items = types.map(type => ({
      type, ang: 0, afford: false,
      cost: this.towerCost(0, type),
      value: this.radialValue(scorer, type, gx, gy, prof)
    }));

    /* SMART ORDER: what you can afford leads, and inside each group the best
       value-per-gold leads. The ORDER is frozen here on purpose — gold moves
       every time something dies, and a ring that re-sorted under the player's
       thumb would build the tower they had stopped pointing at. Only the
       order is frozen: the prices and the greying are re-read every frame,
       and Game.build re-checks the purse at release, so a stale order can
       never let an unpayable build through. */
    for (const it of items) it.afford = S.gold >= it.cost;
    items.sort((a, b) => ((b.afford ? 1 : 0) - (a.afford ? 1 : 0)) || (b.value - a.value));

    /* Keep the whole ring on the board. Side 0 owns the left columns, where a
       ring centred on the tile would hang off the canvas and clip the icons
       it is offering; near an edge it slides inboard instead and drawRadial
       draws a stalk back to the tile the build will actually land on.

       Resolved BEFORE the angles, because the angles are measured in this
       centre's frame -- see below. */
    const pad = (RADIAL_RING_TILES + RADIAL_ICON_TILES) * TILE + RADIAL_EDGE_PAD_PX;
    const cx = (gx + 0.5) * TILE, cy = (gy + 0.5) * TILE;
    const mx = clamp(cx, pad, Math.max(pad, this.width - pad));
    const my = clamp(cy, pad, Math.max(pad, this.height - pad));

    /* The leader sits ON the drag vector and the rest fan out either side of
       it, so simply carrying on in the direction you already started commits
       the tower the ring is recommending. The press point is still the ray's
       ORIGIN -- a press lands anywhere in a 38px tile, and the vector the
       player drew is the one they meant -- but the ANGLE is taken where that
       ray crosses the icon ring, measured from (mx, my). radialPick measures
       from there too, and near a board edge the clamp puts a whole ring's
       width plus RADIAL_EDGE_PAD_PX between the tile and the ring centre: an
       angle taken from the press point named a direction the picker never
       measures, so carrying on straight committed the NEIGHBOUR. */
    const dir = this.radialAim(fromX, fromY, atX, atY, mx, my);
    const step = TAU / items.length;
    items.forEach((it, i) => { it.ang = dir + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * step; });

    this.radial = { gx, gy, cx, cy, mx, my, items, dir,
                    hover: -1, born: performance.now() };
    Sound.play('click');
    return true;
  },

  /** Which item a board-space point is over, or -1 for "no choice". */
  radialPick(bx, by) {
    const r = this.radial;
    if (!r) return -1;
    const dx = bx - r.mx, dy = by - r.my;
    const d = Math.hypot(dx, dy);
    if (d < RADIAL_DEAD_TILES * TILE || d > RADIAL_OUTER_TILES * TILE) return -1;
    const a = Math.atan2(dy, dx);
    let best = -1, bestOff = Infinity;
    for (let i = 0; i < r.items.length; i++) {
      /* Shortest way round the circle, so an item at −170° and a pointer at
         +175° read as 15° apart rather than 345°. */
      const off = Math.abs(((a - r.items[i].ang + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (off < bestOff) { bestOff = off; best = i; }
    }
    /* A WEDGE, not a hotspot: on a touchscreen the finger is wider than the
       icon, so the whole sector selects it. */
    return bestOff <= Math.PI / r.items.length ? best : -1;
  },

  /**
   * Release. Builds through Game.build — the same call the shop makes — so
   * loadout membership, tile ownership, blocked ground and the purse are all
   * still decided in one place, and an unaffordable choice is refused there
   * rather than being talked out of here.
   */
  radialCommit() {
    const r = this.radial;
    this.radial = null;
    if (!r || r.hover < 0) return null;
    const t = this.build(0, r.items[r.hover].type, r.gx, r.gy);
    /* build() already selects and syncs on success; a refusal still has to
       repaint, because the gold flash is what explains the refusal. */
    if (!t) UI.syncAll();
    return t;
  },

  /** The tower's REAL sprite, painted once per type through UI.towerStub —
      the same stand-in every other tower preview draws through, so the menu
      can never show art the board will not. */
  radialIcon(type) {
    if (!this._radialIcons) this._radialIcons = Object.create(null);
    if (type in this._radialIcons) return this._radialIcons[type];
    let cv = null;
    try {
      const px = Math.round(RADIAL_ICON_TILES * TILE * 2 * RADIAL_ICON_OVERSAMPLE);
      const stub = UI.towerStub(type);
      cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      c.translate(px / 2, px / 2);
      c.scale(px / RADIAL_ICON_BOX, px / RADIAL_ICON_BOX);
      const fn = Tower.prototype['draw_' + type];
      if (fn) fn.call(stub, c, stub.age);
      else if (stub.def.glyph) Tower.prototype.draw_glyph.call(stub, c, stub.age);
      else Tower.prototype.draw_bolt.call(stub, c, stub.age);
    } catch (e) { cv = null; }   /* never let one sprite break the menu */
    this._radialIcons[type] = cv;
    return cv;
  },

  drawRadial(ctx) {
    const r = this.radial;
    if (!r) return;
    /* A finished battle cannot take a build, so the ring goes with it. */
    if (this.state !== 'playing') { this.radial = null; return; }
    const S = this.sides[0];

    /* Every price on the ring is asked of Game.towerCost on the frame it is
       drawn. A number cached at open would be a number the build no longer
       charges the moment anything on the board changed — which is the one
       desync this codebase keeps re-shipping. */
    for (const it of r.items) {
      it.cost = this.towerCost(0, it.type);
      it.afford = S.gold >= it.cost;
    }

    const grow = clamp((performance.now() - r.born) / (RADIAL_GROW_SECS * 1000), 0, 1);
    const ease = 1 - Math.pow(1 - grow, 3);
    const ring = RADIAL_RING_TILES * TILE * (0.55 + 0.45 * ease);
    const iconR = RADIAL_ICON_TILES * TILE;

    ctx.save();
    ctx.globalAlpha = ease;

    const g = ctx.createRadialGradient(r.mx, r.my, TILE * 0.25, r.mx, r.my, ring + iconR * 1.9);
    g.addColorStop(0, 'rgba(4,8,14,0.88)');
    g.addColorStop(1, 'rgba(4,8,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(r.mx, r.my, ring + iconR * 1.9, 0, TAU); ctx.fill();

    /* The tile the build lands on, and — when the ring slid inboard off an
       edge — the stalk that says the two are the same decision. */
    ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 2;
    if (r.mx !== r.cx || r.my !== r.cy) {
      ctx.globalAlpha = ease * 0.5;
      ctx.beginPath(); ctx.moveTo(r.cx, r.cy); ctx.lineTo(r.mx, r.my); ctx.stroke();
      ctx.globalAlpha = ease;
    }
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(r.gx * TILE + 2, r.gy * TILE + 2, TILE - 4, TILE - 4);
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    for (let i = 0; i < r.items.length; i++) {
      const it = r.items[i];
      const on = i === r.hover;
      const ix = r.mx + Math.cos(it.ang) * ring;
      const iy = r.my + Math.sin(it.ang) * ring;
      const col = it.afford ? TOWER_TYPES[it.type].color : '#64748b';

      if (on) {
        ctx.strokeStyle = col; ctx.globalAlpha = ease * 0.32; ctx.lineWidth = iconR * 0.9;
        ctx.beginPath(); ctx.moveTo(r.mx, r.my); ctx.lineTo(ix, iy); ctx.stroke();
        ctx.globalAlpha = ease;
      }
      ctx.fillStyle = 'rgba(6,10,17,0.95)';
      ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.6;
      ctx.shadowColor = col; ctx.shadowBlur = on ? 16 : 6;
      ctx.beginPath(); ctx.arc(ix, iy, iconR, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      const icon = this.radialIcon(it.type);
      ctx.globalAlpha = ease * (it.afford ? 1 : 0.34);
      if (icon) ctx.drawImage(icon, ix - iconR, iy - iconR, iconR * 2, iconR * 2);
      else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ix, iy, iconR * 0.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = ease;

      /* The price stays legible on the ones you cannot afford: greying an
         option without saying what it would take is a dead end, not a hint. */
      ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
      ctx.fillStyle = it.afford ? '#e6f5ff' : '#94a3b8';
      ctx.fillText('◈' + it.cost, ix, iy + iconR + 12);
    }

    /* Only the armed choice is named, in the middle. Five labels around a
       ring is the clutter that makes a pie menu unreadable. */
    if (r.hover >= 0) {
      const it = r.items[r.hover];
      ctx.font = 'bold 13px ui-monospace, Consolas, monospace';
      ctx.fillStyle = it.afford ? TOWER_TYPES[it.type].color : '#f87171';
      ctx.fillText(it.afford ? TOWER_TYPES[it.type].name : 'NOT ENOUGH GOLD',
                   r.mx, r.my - TILE * 0.95);
    }
    ctx.restore();
  },

  bindInput() {
    const cv = this.canvas;
    /* The ring runs on POINTER events so one code path serves a mouse, a
       trackpad and a finger; `drag` is the press it is currently tracking. */
    const drag = { id: null, sx: 0, sy: 0, gx: -1, gy: -1, open: false, live: false };
    cv.addEventListener('mousemove', e => {
      if (this.state !== 'playing') return;
      const p = this.pointerToGrid(e);
      this.hover.gx = p.gx; this.hover.gy = p.gy; this.hover.active = true;
      const aimed = this.aimedDef();
      cv.style.cursor = aimed
        ? (this.canAim(0, p.gx, p.gy, aimed) ? 'crosshair' : 'not-allowed')
        : this.selectedType
          ? (this.canBuild(0, p.gx, p.gy) ? 'copy' : 'not-allowed')
          : (this.towerAt(p.gx, p.gy) ? 'pointer' : 'default');
    });
    cv.addEventListener('mouseleave', () => { this.hover.active = false; });
    cv.addEventListener('click', e => {
      if (this.state !== 'playing') return;
      Sound.resume();
      const p = this.pointerToGrid(e);
      /* An armed ability consumes the next click ahead of everything else:
         while it is aimed, the cursor means one thing only. Arming it already
         cleared the build and relocate modes, so the order below is a
         formality — but it is the order the player sees. */
      if (this.aimingAbility !== null) {
        const i = this.aimingAbility;
        this.aimingAbility = null;
        if (!useAbility(this.sides[0], this, i, { gx: p.gx, gy: p.gy })) Sound.play('denied');
        UI.syncAll();
        return;
      }
      const existing = this.towerAt(p.gx, p.gy);
      /* A tower armed for relocation consumes the next click on empty ground. */
      if (this.movingTower && !this.movingTower.dead) {
        if (!existing && this.relocate(this.movingTower, p.gx, p.gy)) {
          this.selected = this.movingTower;
          this.movingTower = null;
          UI.syncAll();
        } else if (existing) {
          this.movingTower = null; this.selected = existing; UI.syncAll();
        }
        return;
      }
      if (this.selectedType) {
        if (existing) { this.selected = existing; this.selectedType = null; UI.syncAll(); return; }
        this.build(0, this.selectedType, p.gx, p.gy);
        if (!e.shiftKey) { this.selectedType = null; UI.syncAll(); }
        return;
      }
      this.selected = existing || null;
      /* Clicking scenery you could pay to remove opens the demolish panel. */
      this.selectedRubble = (!existing && this.canClear(0, p.gx, p.gy)) ? [p.gx, p.gy] : null;
      /* An empty node explains itself BEFORE you commit a tower to it -- the
         decision it changes is where you build, so it has to be readable first. */
      this.selectedNode = (!existing && !this.selectedRubble && nodeAt(p.gx, p.gy)) ? [p.gx, p.gy] : null;
      if (existing || this.selectedRubble || this.selectedNode) Sound.play('click');
      UI.syncAll();
    });
    cv.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.selectedType = null; this.selected = null; this.movingTower = null;
      this.aimingAbility = null; this.radial = null; drag.live = false; drag.open = false;
      UI.syncAll();
    });

    /* ---- drag-out radial placement -------------------------------------
       The gesture only ever ARMS on a press that could already have become a
       build. Every other cursor mode on this canvas — an aimed ability, a
       tower armed for relocation, a shop-armed tower type — already means one
       thing, and a ring that overrode any of them would be a second meaning
       for the same press. */
    cv.addEventListener('pointerdown', e => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      /* Cleared here rather than in the click handler, so a release that
         lands off-canvas — which produces no click at all — cannot leave the
         suppression armed for the next genuine one. */
      this._radialAte = false;
      /* Self-healing: a ring left open by a gesture that never released — a
         pointerup swallowed by another window, a second finger — must not
         outlive the next press. */
      this.radial = null;
      drag.live = false; drag.open = false; drag.id = e.pointerId;
      if (this.state !== 'playing') return;
      if (this.aimingAbility !== null || this.movingTower || this.selectedType) return;
      const S = this.sides[0];
      if (!S || !S.loadout || !S.loadout.length) return;
      const p = this.pointerToGrid(e);
      if (!this.canBuild(0, p.gx, p.gy)) return;
      const b = this.pointerToBoard(e);
      drag.live = true; drag.sx = b.x; drag.sy = b.y; drag.gx = p.gx; drag.gy = p.gy;
    });

    /* On window, not the canvas: a drag that leaves the board still has to be
       tracked, and its release still has to be answered. */
    window.addEventListener('pointermove', e => {
      if (!drag.live || e.pointerId !== drag.id) return;
      const b = this.pointerToBoard(e);
      if (!drag.open) {
        /* The threshold is in CSS pixels, so the gesture feels identical at
           every board scale — the player's hand does not scale with the
           fitted canvas, so the number that gates it must not either. */
        if (Math.hypot(b.x - drag.sx, b.y - drag.sy) * (this.viewScale || 1) < RADIAL_OPEN_PX) return;
        drag.open = this.openRadial(drag.gx, drag.gy, drag.sx, drag.sy, b.x, b.y);
        if (!drag.open) { drag.live = false; return; }
      }
      if (this.radial) this.radial.hover = this.radialPick(b.x, b.y);
    }, { passive: true });

    window.addEventListener('pointerup', e => {
      if (!drag.live || e.pointerId !== drag.id) return;
      drag.live = false;
      if (!drag.open || !this.radial) return;
      drag.open = false;
      const b = this.pointerToBoard(e);
      this.radial.hover = this.radialPick(b.x, b.y);
      this.radialCommit();
      /* The release also produces a click on the canvas, and that click must
         not reach the select/place handler — the gesture has already been
         answered. */
      this._radialAte = true;
    });

    window.addEventListener('pointercancel', e => {
      if (!drag.live || e.pointerId !== drag.id) return;
      drag.live = false;
      if (drag.open) { drag.open = false; this.radial = null; this._radialAte = true; }
    });

    /* Capture phase on the WRAP, so a suppressed click is stopped before it
       can reach the canvas's own click listener. Precedent: GalaxyFX stops a
       travelled world-map drag from also counting as a click on a world in
       exactly this shape. */
    (cv.parentElement || document).addEventListener('click', e => {
      if (!this._radialAte) return;
      this._radialAte = false;
      e.stopPropagation(); e.preventDefault();
    }, true);
  }
};

/* ------------------------------------------------------ persistent stats */

/* Settings and per-map records live alongside commander progression. */
const Storage = {
  loadSettings() { return Object.assign({ sfx: 0.7, music: 0.4, sfxOn: true, musicOn: true }, Meta.getSettings()); },
  saveSettings(s) { Meta.setSettings(s); },
  recordRun(game, won) {
    const d = Meta.load();
    const key = game.map.id + '|' + game.difficulty.id;
    const prev = d.best[key];
    const rec = { wave: game.wave, kills: game.sides[0].stats.kills, sent: game.sides[0].stats.sent, won };
    if (!prev || rec.wave > prev.wave) d.best[key] = rec;
    Meta.save();
  },
  best(mapId, diffId) { return Meta.load().best[mapId + '|' + diffId] || null; }
};
