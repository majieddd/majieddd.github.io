/* ==========================================================================
   COSMIC CONQUEST, Core State, Simulation & World Rendering
   ========================================================================== */

'use strict';

const STEP = 1 / 60;
const MAX_STEPS = 8;
const MAX_PARTICLES = 420;
const MAX_FLOATERS = 80;

/* REDUCED MOTION, the OS preference OR the OPTIONS checkbox. Cached, and
   read through one function: the gates below run per spawned particle, and a
   matchMedia() construction per call would cost more than the particles do.
   The checkbox is the USER'S switch for machines whose OS preference is out
   of reach; the OS half updates itself. Gating lives in the spawn functions
   -- not their call sites -- so no effect can be added later that forgets. */
let RM_OS = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let RM_USER = false;
if (typeof matchMedia !== 'undefined') {
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { RM_OS = e.matches; }); } catch (e) {}
}
function motionReduced() { return RM_OS || RM_USER; }
/* mulberry32, the same generator the relay and the pin harness use --
   identical arithmetic in every engine is the point. */
function seededDraw(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function setReducedMotion(user) { RM_USER = !!user; }

/* DAMAGE NUMBERS, same cached-gate shape as reduced motion, and for the same
   reason: the check runs once per landed hit. Default ON because a new player
   learning which tower is doing the work needs the numbers; the OPTIONS
   checkbox exists for the player who finds them noise. The gate lives in
   registerDamage, not addFloater, floaters also carry gold and MUSTER
   notices, and those must survive the toggle. */
let DMG_NUMBERS = true;
function damageNumbersOn() { return DMG_NUMBERS; }
function setDamageNumbers(on) { DMG_NUMBERS = !!on; }

/** The active battlefield geometry, rebuilt from the chosen map. */
let FIELD = null;

/** Fresh command-upgrade multiplier block. PLAYER_MODS mutate this. */
function freshMods() {
  return { damage: 1, rate: 1, range: 1, splash: 1, status: 1, gold: 1,
           /* `crit` is the CHANCE and `critMult` the DAMAGE. Both are side-wide
              accumulators; only the chance had a home here, so every talent and
              boon that promised harder crits wrote into a trait nothing read. */
           pierce: 0, crit: 0, critMult: 0,
           cost: 1, upCost: 1, reanim: 1, doubleReanim: 0, sellRate: 0.7,
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
    /* THE RITE this commander summons by, and its working state. Defaulted to
       CONSCRIPTION so a Side is complete before start() resolves the real one
       from the commander; every field is sim state and every one is
       fingerprinted, because a duel where one client's procession is a beat
       ahead is a duel that has already parted. */
    this.doctrine = 'human';
    this.procIdx = 0; this.procCycle = 0; this.procTimer = 0;
    this.rollDebt = 0;
    this.summonPower = 0;
    /* How far a compiling commander has rewritten itself. */
    this.compileLevel = 0;
    /* Fractional life regeneration, banked between waves. */
    this.lifeRegenBank = 0;
    /* Rubble THIS commander has demolished. The allowance (CLEAR_MAX plus
       SURVEY TEAM) and the compounding price are per side; one shared Set
       meant a rival's land card ate the player's allowance and raised the
       player's next price. Game.clearedTerrain remains the UNION of these,
       because `blocked` and the background describe one board with no owner
       -- and ownsTile partitions the grid, so the per-side sets are disjoint
       by construction. */
    this.cleared = new Set();
    /* BLOOD PRICE's ledger. Lives this commander has SPENT on a tower, which
       is a different quantity from lives lost -- `stats.leaked` is that one.
       Tower.rateMul reads this and only this, so the doctrine pays for
       commitment and pays nothing at all for a leak. */
    this.livesPaid = 0;
    this.stats = { kills: 0, goldEarned: 0, leaked: 0, built: 0, sent: 0, livesRestored: 0, mustered: 0,
                   leaksRecovered: 0, jammed: 0 };
    /* WHAT KILLED YOU -- lives actually lost, keyed by the class that walked
       them off the board: { n, lives, sent }. `stats.leaked` is one number and
       a number is not a lesson: a player who cannot name the contact that beat
       them rebuilds the same board next run. Count and lives accumulate apart
       so the end screen can rank by damage done rather than by body count (one
       COLOSSUS is not four Motes), and `sent` remembers how many of those
       breaches were bodies the RIVAL put on the lane, which is the half of
       this game a leak report is likeliest to teach.
       Written ONLY from loseLives, never from the seat: since the carrier
       shipped, reaching the seat costs nothing, and a theft shot down on its
       way out is refunded in full -- booking at the seat would report deaths
       that never happened, which is the exact wrong lesson for a block whose
       job is teaching what killed you. `stats.leaksRecovered` counts those
       refunds instead, because the recovery is the counterplay. */
    this.leakLog = {};
    /* THE HARVEST -- kills keyed by class: { n, bounty }. leakLog's mirror,
       for the same reason: stats.kills is one number, and the debrief wants
       to say WHICH contacts fed this commander, not how many. `bounty` books
       the base figure after elite/execute adjustments and before gold mods,
       because the lesson is what the class was worth, not what the economy
       inflated it to. Written only from killEnemy; never read by the sim. */
    this.killLog = {};
  }
  get alive() { return this.lives > 0; }
  /** How many of a tower type this side already fields, drives price growth. */
  countOf(type) { let n = 0; for (const t of this.towers) if (t.type === type) n++; return n; }
}

/* ── HOW A BOON REACHES THE ENGINE ────────────────────────────────────────
   Every key a boon's `apply` may write, and what that key DOES. This table is
   the whole contract: a key absent from here is a boon that silently does
   nothing, which is precisely how five talents and six commander traits
   shipped inert. `assertBoonKeysAreLive` below checks the twenty boons
   against it at load, so the mistake cannot survive a page refresh.

   Multiplicative keys arrive pre-multiplied (a boon writes `x * 1.18`), so
   the fold multiplies rather than adds. Additive keys arrive as the delta. */
const BOON_FOLD = {
  /* lives and leaks */
  bonusLives:     (S, v) => { S.maxLives += v; S.lives += v; },
  leakShield:     (S, v) => { S.traits.leakReduction += v; },
  waveHeal:       (S, v) => { S.traits.waveHeal += v; },
  immortalLine:   (S, v) => { if (v) S.traits.immortalLine = true; },
  lastStandAt:    (S, v) => { S.traits.lastStandAt = Math.max(S.traits.lastStandAt, v); },
  lastStandDmg:   (S, v) => { S.traits.lastStandDmg += v; },
  /* economy */
  goldMul:        (S, v) => { S.mods.gold *= v; },
  costMul:        () => {},   /* read directly in towerCost -- see below */
  costGrowthMul:  (S, v) => { S.traits.costGrowthMul *= v; },
  /* SELLING, CLAMPED. These four write `mods` and not `traits`, because a
     trait only reaches the engine through foldTraits and boons are applied
     246 lines AFTER the fold has already run (Meta.applyTo at Game.start vs
     the boon loop below it). Written as traits they were silently dead:
     AUREOLE promised aura range and harder status and delivered neither,
     LETTERS OF MARQUE promised crit chance and damage and delivered neither,
     and both SALVAGE RIGHTS and SCUTTLE delivered only their other half.
     The clamp is not decoration: mods.sellRate starts at 0.7, SCUTTLE is
     worth +60%, and a sell that returns MORE than it cost is a build-and-
     sell loop that prints gold forever. */
  sellRate:       (S, v) => { S.mods.sellRate = Math.min(1, S.mods.sellRate * (1 + v)); },
  freeCopies:     (S, v) => { S.traits.freeCopies += v; },
  siphonRate:     (S, v) => { S.traits.siphonRate *= v; },
  reanimGold:     (S, v) => { S.traits.reanimGold += v; },
  /* towers */
  ascCostMul:     (S, v) => { S.traits.ascCostMul *= v; },
  ascDamageMul:   (S, v) => { S.traits.ascDamage *= v; },
  auraRangeMul:   (S, v) => { S.traits.auraRangeMul *= v; },
  jamResist:      (S, v) => { S.traits.jamResist += v; },
  status:         (S, v) => { S.mods.status *= (1 + v); },
  crit:           (S, v) => { S.mods.crit += v; },
  critMult:       (S, v) => { S.mods.critMult += v; },
  killRamp:       (S, v) => { S.traits.killRamp += v; },
  eliteDamageMul: (S, v) => { S.traits.eliteDamage *= v; },
  eliteBountyMul: (S, v) => { S.traits.eliteBounty *= v; },
  /* the send */
  reanimMul:      (S, v) => { S.mods.reanim += v; },
  reanimSpeedMul: (S, v) => { S.traits.reanimSpeed *= v; },
  reanimResist:   (S, v) => { S.traits.reanimResist += v; },
  musterHpMul:    (S, v) => { S.traits.musterHpMul = (S.traits.musterHpMul || 1) * v; },
  musterCostMul:  (S, v) => { S.traits.musterCostMul = (S.traits.musterCostMul || 1) * v; },
  /* drafting */
  bonusDraft:     (S, v) => { S.traits.draftOptions += v; },
  draftSooner:    (S, v) => { S.traits.draftEvery = Math.max(2, S.traits.draftEvery - v); },
  /* paid out after the battle rather than during it */
  xpMul:          () => {},
  masteryMul:     () => {}
};

/* Runs once at load. A boon whose key is missing from BOON_FOLD would be a
   promise the engine never keeps, so it fails loudly here instead of quietly
   in front of a player. */
function assertBoonKeysAreLive() {
  const missing = [];
  for (const b of BOONS) {
    const probe = {};
    try { b.apply(probe); } catch (e) { missing.push(b.id + ' threw: ' + e.message); continue; }
    for (const k in probe) if (!(k in BOON_FOLD)) missing.push(b.id + ' writes ' + k);
  }
  if (missing.length) {
    console.error('INERT BOON KEYS -- these do nothing:', missing);
    throw new Error('BOON_FOLD is missing: ' + missing.join(', '));
  }
  return BOONS.length;
}
assertBoonKeysAreLive();

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
  /* THE BROOD's clutches. Sim state, not decoration: fingerprinted, ticked in
     step, and drawn read-only. */
  incubators: [],
  /* THE PARALLEL's relay nodes, same rules. */
  relayNodes: [],
  /* Per side: the temporary lane a Splicer cut into that board, or null. */
  spliceState: [],

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

    /* PUBLISH THE HUD'S REAL HEIGHT. #battle-controls is absolutely
       positioned and, below 1550px, moves to the top to get out of the dock's
       way; the top is where #hud already is, so the two overlapped by a
       measured 12236 square pixels at every phone size and the speed buttons
       sat on the player's own commander card. CSS cannot ask a sibling how
       tall it is, and the alternative was hardcoding a number that the HUD
       would then drift away from, which is this project's signature defect.
       So the measurement is published once per resize and the CSS
       reads it. Presentation only: nothing here is read by the simulation. */
    const hudEl = document.getElementById('hud');
    const sgEl = document.getElementById('screen-game');
    if (hudEl && sgEl) {
      const publish = () => {
        /* The BOTTOM EDGE, not the height. #hud is inset from the top of the
           screen, so positioning a sibling at `height + gap` lands it INSIDE
           the HUD by exactly that inset: measured, a constant 544px2 of
           overlap at every phone size, which is 2px down a 266px control and
           precisely the 10px top inset minus the 8px gap. What the controls
           need to clear is where the HUD ENDS. */
        const hb = hudEl.getBoundingClientRect(), sb = sgEl.getBoundingClientRect();
        const bottom = Math.round(hb.bottom - sb.top);
        if (hb.height > 0) sgEl.style.setProperty('--hud-b', bottom + 'px');
      };
      publish();
      /* A RESIZE IS NOT THE ONLY THING THAT CHANGES THE HUD'S HEIGHT. Chips
         appear and vanish as doctrine and escalations land, and the row count
         moves with them: publishing only here left the variable a couple of
         pixels stale and the controls still clipped the HUD by a measured
         544px2. An observer tracks the real box whenever it changes, for any
         reason, and removes the whole staleness class rather than the two
         pixels of it that happened to be visible. Bound once. */
      if (!this._hudRO && typeof ResizeObserver === 'function') {
        this._hudRO = new ResizeObserver(publish);
        this._hudRO.observe(hudEl);
      }
    }

    /* The container can report a near-zero box when the game screen has not been
       laid out yet -- mid screen-transition, or on the very first frame. Fitting
       to that would lock the board at the minimum scale and leave it there, so
       an implausible measurement falls back to the viewport and schedules a
       re-fit once layout settles. */
    const box = this.canvas.parentElement;
    /* clientWidth INCLUDES padding, so a padded wrap would read wider than its
       actual content box. Neither layout pads #canvas-wrap today, so this
       reads 0 in both, but it costs nothing to keep reading the real box
       rather than assume the padding stays zero forever. */
    const boxPad = box ? getComputedStyle(box) : null;
    const padW = boxPad ? (parseFloat(boxPad.paddingLeft) || 0) + (parseFloat(boxPad.paddingRight) || 0) : 0;
    const padH = boxPad ? (parseFloat(boxPad.paddingTop) || 0) + (parseFloat(boxPad.paddingBottom) || 0) : 0;
    /* The 8 and the 10 are the FITTED layout's breathing room -- the gap that
       keeps a framed board off the stage's edges. A background has no edges to
       keep off, so immersive spends none of it and the canvas reaches the
       window on all four sides. */
    const gapW = document.body.classList.contains('immersive') ? 0 : 8;
    const gapH = document.body.classList.contains('immersive') ? 0 : 10;
    let availW = box ? box.clientWidth - padW - gapW : 0;
    let availH = box ? box.clientHeight - padH - gapH : 0;
    const unlaidOut = availW < 240 || availH < 200;
    if (unlaidOut) {
      /* No side rail to subtract for any more (Session 34): the board is the
         only flex item left in #stage, so the guess is just the window minus
         the stage's own chrome. */
      availW = Math.max(320, window.innerWidth - STAGE_CHROME_PX);
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
    /* THE BOARD IS THE BACKGROUND, and that is a COVER, not a fit.
       ────────────────────────────────────────────────────────────────
       Fitting sizes the canvas ELEMENT to the board's own aspect and centres
       it, so on any window whose shape differs from the board's there is dead
       page either side of it -- a bordered box floating in a dark room, which
       is what the owner has now reported three times. The galaxy never does
       this: its scale COVERS the window, and its chrome floats on top.

       So in immersive the canvas spans the whole stage and the board is scaled
       to cover it. `fitScale` is kept because it is what "the whole board is
       visible" means, and camZoom's floor is derived from it -- scrolling out
       returns to exactly the old fitted view, so nothing is lost, it is just
       no longer the only option.

       Outside immersive nothing changes: viewScale IS fitScale there and the
       canvas is sized to the board exactly as it always was. */
    this.fitScale = Math.min(1.9, availW / this.width, availH / this.height);
    const immersive = document.body.classList.contains('immersive');
    this.viewScale = immersive
      ? Math.min(BOARD_COVER_MAX, Math.max(availW / this.width, availH / this.height))
      : this.fitScale;

    const cssW = Math.round(immersive ? availW : this.width * this.viewScale);
    const cssH = Math.round(immersive ? availH : this.height * this.viewScale);
    /* The canvas's CSS size in its own right: with a cover fit it is no longer
       derivable from width * viewScale, and the camera and every pointer
       conversion need the real span. */
    this.viewW = cssW; this.viewH = cssH;
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
    /* THE SCENARIO, RESOLVED AT START. `worldScenarioOf` is index-derived, so
       asking it here and asking it again in endMatch cannot disagree. Defaults
       to the standing duel for skirmishes and for any caller that passes no
       world, which is what keeps every existing battle bit-identical. */
    this.scenario = (typeof SCENARIOS !== 'undefined') ? SCENARIOS[0] : null;
    if (opts.scenario) this.scenario = opts.scenario;
    else if (opts.world && typeof worldScenarioOf === 'function' && typeof Meta !== 'undefined') {
      const gx0 = Meta.galaxy && Meta.galaxy();
      if (gx0) for (const sy of gx0.systems) {
        const w0 = sy.worlds.find(x => x.id === opts.world);
        if (w0) {
          /* Ground already yours (owner, Session 33): ownedWorldScenarioOf
             returns null for the ordinary world, same fallback pattern as
             every other reader of it. */
          const c0 = typeof Meta.campaign === 'function' && Meta.campaign();
          const prog0 = (c0 && c0.stars) || {};
          this.scenario = (typeof ownedWorldScenarioOf === 'function' && ownedWorldScenarioOf(w0, prog0))
            || worldScenarioOf(w0);
          break;
        }
      }
    }
    /* A SURVIVE BOARD HAS NO RIVAL SEAT. The owner's Session 30 note: a card
       reading "there is no commander to beat" while a commander sat opposite
       was a contradiction the game stated about itself. */
    this.soloSurvive = !!(this.scenario && this.scenario.noCommander);

    /* THE EPOCH IS CAPTURED ONCE, HERE. Passing it explicitly means the map
       object this match runs on can never be reshaped by an hour boundary
       crossing mid-battle, and a replay handed the same epoch rebuilds the
       same arena exactly. */
    this.maelstromEpoch = opts.maelstrom
      ? (opts.epoch !== undefined ? (opts.epoch | 0) : maelstromEpoch()) : null;
    this.map = opts.maelstrom ? maelstromMap(opts.maelstrom, this.maelstromEpoch)
                              : (MAPS.find(m => m.id === opts.map) || MAPS[0]);
    /* Procedural maps seed their geometry from the world id so both duel
       clients compute identical boards. BOTH `opts.world` (campaign,
       js/ui.js:520, "the world id" per its own comment) and `opts.worldId`
       (multiplayer, js/net.js:1244; skirmish) are STRINGS -- neither caller
       ever passes a world object, so `opts.world.id` on the campaign path
       always read undefined and every campaign battle fell through to the
       literal 'default'. MEASURED: 16 of 16 same-family campaign worlds
       sampled came back byte-identical boards; a whole galaxy of twin-channel
       worlds was one map wearing many names. Fixed by reading `opts.world`
       itself as the id, which is what the comment already claimed it was.

       A CAMPAIGN additionally salts the seed with its own seed, so two
       campaigns that happen to hold the same world fight on different
       boards, while a duel never does: only the campaign path is salted, so
       both MP clients still compute the bare world id and skirmish/maelstrom
       keep their standing seeds. */
    /* `let`, not const: the campaign salt below appends to this. As a const it
       threw "Assignment to constant variable" out of Game.start on EVERY
       campaign battle, because every campaign carries a seed and every
       campaign battle passes opts.world. node --check cannot see it (it is a
       runtime TypeError) and no harness drives this path, so the gate stayed
       green while the campaign was unstartable. */
    let mapSeed = opts.worldId || opts.world || 'default';
    if (opts.world && typeof Meta !== 'undefined' && typeof Meta.campaign === 'function') {
      const c0s = Meta.campaign();
      if (c0s && c0s.seed !== undefined) mapSeed += ':' + c0s.seed;
    }
    FIELD = buildField(this.map, mapSeed);

    /* Who GARRISONS this world decides whether its own troops march beside the
       Vigil, and the roster is fixed ONCE here because the preview, the rival's
       threat model and the spawn all read it -- deriving it three times is how
       they would come to disagree. Both sides face the identical wave, so this
       is world state and not a lever either commander holds. */
    this.hostFaction = battleHostFaction(opts);
    this.battleRoster = battleRosterFor(this.map, this.hostFaction);
    /* AT MOST TWO SPECIES YOU HAVE NEVER FOUGHT, per planet (owner, Session
       26). The campaign remembers what its battles have fielded; a roster may
       carry everything already met plus the first two strangers, and the rest
       wait for a later world. Bosses and minibosses are exempt, as specified,
       and they do not travel through this roster anyway. Campaign only: a
       skirmish, a duel and the pins have no memory and get the full roster,
       which is exactly what they got before. */
    {
      const cN = (!this._skirmish && typeof opts.systemIndex === 'number') ? Meta.campaign() : null;
      if (cN) {
        if (!Array.isArray(cN.seenTypes)) cN.seenTypes = [];
        const seen = new Set(cN.seenTypes);
        let strangers = 0;
        this.battleRoster = this.battleRoster.filter(id => {
          const d = ENEMY_TYPES[id];
          if (!d || d.boss || d.miniboss) return true;
          if (seen.has(id)) return true;
          return ++strangers <= 2;
        });
        for (const id of this.battleRoster) if (!seen.has(id)) cN.seenTypes.push(id);
        Meta.save();
      }
    }

    /* Each side may have SEVERAL lanes; lanes[side] is an array of Paths. */
    this.lanes     = FIELD.lanes.map(side => side.map(p => new Path(p)));
    this.sendPaths = FIELD.sendPaths.map(p => new Path(p));
    /* PATROL ROUTES, solo boards only. A survive board has no rival base to
       march on, so a bought unit walks YOUR OWN lane BACKWARDS: out from your
       base toward the mouth the wave comes from, which is the one direction
       that puts it face to face with what is walking at you. Reversed copies
       of the player's own lanes, so a patrol shares the road it defends and
       needs no new geometry from buildField (whose shape several harnesses
       assert on). Built only where they are used; null everywhere else. */
    this.patrolPaths = this.soloSurvive
      ? FIELD.lanes[0].map(p => new Path(p.slice().reverse()))
      : null;
    /* AIR SEND ROUTES (Session 26): a sent flyer flies base to base, the
       straight chord, instead of walking the whole ground send route while
       flagged flying. Derived from bases with zero rnd() draws. */
    this.airSendPaths = FIELD.bases.map((a, i) =>
      FIELD.bases.map((b, j) => (i === j || !a || !b) ? null : new Path([a, b])));
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
       separate ground, a reanimate retraces your own lane backwards and then
       runs your rival's forwards, so they contribute no tiles of their own.
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
    /* A SURVIVE BOARD REANIMATES NOTHING. Reanimation exists to send the dead
       back at a rival; with no rival the bodies march at a phantom seat that
       cannot be hurt, so the whole mechanic becomes a silent tax on every kill.
       Reusing the field's own flag rather than inventing a second switch means
       every existing reader (canMuster's waiver, doctrineOnKill, the carrier
       path) already honours it. */
    this.noReanim = !!FIELD.noReanim || !!this.soloSurvive;
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
    /* NO RIVAL TO SHOW. `soloSurvive` already hides the muster path and the
       spawn queue; this is the same fact stated to the HUD and the canvas.
       CSS-only, same idiom as tri-field above: `#hud-rivals` (name, gold,
       towers, the lives bar) hides outright, and draw() below reads this
       class rather than re-deriving soloSurvive on every frame. */
    document.body.classList.toggle('solo-field', this.soloSurvive);
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
      /* `% length`, not a literal 3. rivalFactionsOf returns everyone who
         is not you, which is three powers for the four that hold worlds and
         FOUR for the Parallel -- so the literal made the Pirates unreachable
         as a skirmish rival for exactly one banner. */
      rivalFactionsOf(myFaction)[Math.floor(Math.random() * rivalFactionsOf(myFaction).length)];
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
    /* THE PARALLEL never seats a rival. It holds no worlds, so a machine
       commander behind a garrison would be a power the campaign has no way to
       take -- and the secret would be spoiled by meeting it. */
    const rivalPool = COMMANDERS.filter(c => c.id !== this.sides[0].commander.id &&
                                             c.faction !== 'robot');
    let rival = (opts.rival && COMMANDERS.find(c => c.id === opts.rival)) ||
                rivalPool[Math.floor(Math.random() * rivalPool.length)];
    /* rivalPool excludes the player's own commander, but only the RANDOM
       fallback draws from it -- an explicit opts.rival was installed
       unchecked, so a world whose commander you happen to be fielding put the
       same name and portrait on both ends of the board. */
    if (rival.id === this.sides[0].commander.id)
      rival = COMMANDERS.find(c => c.faction === this.sides[1].faction &&
                                   c.id !== rival.id) || rivalPool[0];
    /* The rival is a fully-realised commander too, but realised to the same
       DEPTH you are. A flat "near-complete tree" meant a level-one profile met
       a rival with sixteen of eighteen tech points and no way to answer it.
       The rival's budget now tracks the player's own spend, magnified by the
       threat level, with a small floor so it is never a walkover. */
    const playerTech = Meta.techSpent(this.sides[0].commander.id);
    let rivalTech = clamp(Math.round(Math.max(2, playerTech) * (0.9 + 0.8 * this.difficulty.aiSkill)), 2, 18);
    /* Stage 0: a shallow commander regardless of yours. Stage 1: never deeper
       than yours. Stage 2 keeps the scaled figure. */
    if (this.rivalStage === 0) rivalTech = Math.min(rivalTech, 4);
    else if (this.rivalStage === 1) rivalTech = Math.min(rivalTech, Math.max(2, playerTech));
    /* A commander's own seat is a duel, not another skirmish: they field their
       complete technology chart and both abilities regardless of where the
       player's progression happens to be. */
    this.isSeatBattle = !!opts.seat;
    /* A multiplayer practice skirmish must never touch the campaign ledger. */
    this._skirmish = !!opts.skirmish;
    this._overDrawn = false;
    this.galaxyTier = this._skirmish ? 0 : ((Meta.campaign() && Meta.campaign().tier) || 0);
    /* THE RAMP and THE FLATTENING, both resolved from OPTIONS rather than
       from the save. That is the whole safety property: a skirmish, a duel,
       the Maelstrom and the balance pins pass none of these, so they get the
       engine's own defaults and measure the same game they always did. Only a
       campaign node threads the values in, and only the FIRST galaxy is
       flattened -- once a tier has been cleared the player has chosen a ramp
       and the training wheels come off for good. */
    {
      const R = (opts.ramp && RAMP_PRESETS[opts.ramp]) || RAMP_PRESETS[RAMP_DEFAULT];
      this.tierHpStep = R.tierHpStep;
      const si = (typeof opts.systemIndex === 'number') ? opts.systemIndex : null;
      const flatten = si !== null && this.galaxyTier === 0 && !this._skirmish;
      this.hpEase = flatten ? (TIER0_HP_EASE[si] || 0) : 0;
      this.rosterIntroEvery = flatten ? (TIER0_INTRO_EVERY[si] || ROSTER_INTRO_EVERY) : ROSTER_INTRO_EVERY;
      this.minibossDelayWaves = flatten ? (TIER0_MINIBOSS_DELAY[si] || 0) : 0;
      /* THE RIVAL'S TACTIC TIER (owner call O3), resolved from OPTIONS on the
         same safety property as the ramp above: a battle that passes no system
         index is not a campaign battle, and gets AI_TIER_BASELINE -- which IS
         the rival every skirmish, Maelstrom, duel and balance pin has always
         faced. Only a campaign node moves this, so nothing outside the
         campaign changes and the pins stay comparable to their own history. */
      this.aiTier = (si === null || this._skirmish) ? AI_TIER_BASELINE
        : (AI_TIER_STEPS[Math.min(AI_TIER_STEPS.length - 1,
                                  (this.galaxyTier || 0) * SYSTEMS_PER_GALAXY + si)]);
      /* THE RIVAL STAGE (owner, Session 26), the second half of the ramp. The
         tactic ladder says WHAT the rival may do; the stage says how BIG and
         how SHARP it is. Solar system 1: it fields fewer towers than you,
         one fewer soldier, a shallow commander, and it thinks slowly. System
         2: the caps lift and its commander is at or below your level. System
         3 on, and every NG+ galaxy: prestiged commander, full loadout, its
         own pace. null outside the campaign, and every stage rule gates on
         that, so skirmishes, duels, the Maelstrom and the pins see none of
         this. */
      this.rivalStage = (si === null || this._skirmish) ? null
        : ((this.galaxyTier || 0) > 0 ? 2 : Math.min(2, si));
      /* Bounded so a hand-built save or a future galaxy shape can never hand
         the brain a tier the ladder has no rung for. */
      if (!(this.aiTier >= 0)) this.aiTier = AI_TIER_BASELINE;
    }
    if (this.isSeatBattle) rivalTech = 18;
    Meta.applyToAI(this.sides[1], rival.id, rivalTech);
    /* Stage 2: the commander arrives PRESTIGED, the way a late-campaign power
       should. One star, through the same applyPrestigeBonus every prestiged
       player commander uses, applied after the fold exactly as applyTo does. */
    if (this.rivalStage === 2 && typeof applyPrestigeBonus === 'function') {
      this.sides[1].prestigeStars = Math.max(1, this.sides[1].prestigeStars || 0);
      applyPrestigeBonus(this.sides[1], rival.faction || this.sides[1].faction || 'human', 1);
    }

    /* Loadouts: LOADOUT_SIZE towers each. The rival drafts its own coherent set. */
    this.sides[0].loadout = (opts.loadout && opts.loadout.length ? opts.loadout : TOWER_ORDER.slice(0, LOADOUT_SIZE)).slice(0, LOADOUT_SIZE);
    /* The rival drafts under the SAME origin law the player unlocks under:
       its own power's hardware plus the human and robotic commons, never a
       third power's. A shelf the player is forbidden is not a difficulty
       setting, it is an asymmetry. */
    this.sides[1].loadout = AI.pickLoadout(this.map, this.difficulty,
                                           Meta.unlockedTowers(), this.sides[1].faction,
                                           (typeof opts.loadoutSeed === 'number')
                                             ? seededDraw(opts.loadoutSeed) : undefined);
    /* Variety parity: the rival fields exactly as many tower TYPES as you do.
       Once you have claimed two worlds it earns one more than you -- never
       more than the loadout maximum. */
    {
      const c = this._skirmish ? null : Meta.campaign();
      let conquered = 0;
      if (c && c.stars) for (const k in c.stars) if (c.stars[k] >= 3) conquered++;
      let variety = Math.min(LOADOUT_SIZE,
        this.sides[0].loadout.length + (conquered >= 2 ? 1 : 0));
      /* Stage 2 fields its FULL draft; stage 0 fields one type fewer than
         you, floored at two so it is still a rival. */
      if (this.rivalStage === 2) variety = LOADOUT_SIZE;
      if (this.rivalStage === 0) variety = Math.max(2, this.sides[0].loadout.length - 1);
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
    this.setMusterLoadout(1, AI.pickMusterLoadout(Meta.musterUnlocked(),
      Math.max(1, this.sides[0].musterLoadout.length - (this.rivalStage === 0 ? 1 : 0))));

    /* Talents are prepared before the match: yours from the saved trees, the
       rival's drafted to suit its own loadout, and only as deep as your own
       tower mastery currently reaches, plus a row on Overrun. */
    /* Soul investment: yours as banked, the rival's mirrored to the same average
       so progression parity holds the way the loadout roster already does. */
    if (this.isSeatBattle) {
      const rc = this.sides[1].commander;
      setTimeout(() => this.banner('⚔  ' + rc.name + ' · ' + rc.title.toUpperCase(), 3.4,
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
    this.sides[1].talentSets = AI.pickTalents(this.sides[1].loadout, rivalDepth, this.difficulty);
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
    this.incubators = [];
    this.relayNodes = [];
    this.spliceState = [];
    /* The one piece of doctrine state that lives in a module rather than on
       the Game, and so had to be told about the new match by hand. */
    if (typeof resetUnitDoctrineState === 'function') resetUnitDoctrineState();
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
      this.sides[2].talentSets = AI.pickTalents(this.sides[2].loadout, this.rivalDepth, this.difficulty);
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
        /* Arena seats are the galaxy's powers too -- no machine commanders. */
        const own = commandersOf(S2.faction).filter(c => !taken.has(c.id) && c.faction !== 'robot');
        const spare = COMMANDERS.filter(c => !taken.has(c.id) && c.faction !== 'robot');
        const cmd = own[0] || spare[0] || COMMANDERS[i % COMMANDERS.length];
        taken.add(cmd.id);
        Meta.applyToAI(S2, cmd.id, rivalTech);
        S2.loadout = AI.pickLoadout(this.map, this.difficulty, Meta.unlockedTowers(), S2.faction);
        if (S2.loadout.length > variety) S2.loadout = S2.loadout.slice(0, variety);
        this.setMusterLoadout(i, AI.pickMusterLoadout(Meta.musterUnlocked(),
                                                      this.sides[0].musterLoadout.length));
        S2.talentSets = AI.pickTalents(S2.loadout, this.rivalDepth, this.difficulty);
        S2.baseLevel = this.sides[1].baseLevel || 1;
      }
    }
    /* THE RITE, resolved once for every seat now that every commander is
       seated. The COMMANDER carries the summoning, not the banner: a
       cross-faction commander brings their own rite to your flag while your
       roster supplies the soldiers, which is the whole mixing contract.
       CADRE is unaligned and has no faction, so it falls through to the sworn
       banner. `doctrineOverrides` is the story hook -- today the only door to
       THE LATTICE, because no seat is robotic yet. */
    /* THE LATE SKEW. FACTIONS[x].apply runs before any commander is seated,
       and Meta.applyTo/applyToAI then do `side.traits = freshTraits()` -- so
       anything a faction wrote to TRAITS was thrown away before the first
       wave. Every existing apply() writes mods or plain fields for exactly
       that reason. `applyLate` is the other half: it runs HERE, once every
       seat has its commander and its traits are folded, so a power can shape
       the half of the game that lives on traits. Optional, so the two powers
       whose identity was already right carry no hook at all. */
    for (const S2 of this.sides) {
      const f2 = FACTIONS[S2.faction];
      if (f2 && typeof f2.applyLate === 'function') f2.applyLate(S2);
    }
    for (const S2 of this.sides) {
      const over = opts.doctrineOverrides && opts.doctrineOverrides[S2.index];
      const want = over || (S2.commander && S2.commander.faction) || S2.faction || 'human';
      S2.doctrine = SUMMON_DOCTRINES[want] ? want : 'human';
      /* Any level a chart pre-granted is owed before the first wave, or a
         commander who bought its way to level one would still open at zero. */
      this.applyCompile(S2);
    }

    /* One brain per AI side. The singleton pattern could not host two rivals.
       A SURVIVE BOARD GETS NONE: nobody commands the far seat, so nothing
       builds there, nothing drafts an arsenal, and nothing sends at you. */
    this.brains = (this.soloSurvive ? [] : this.sides.slice(1)).map((S2, i) => {
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
    /* Folded through BOON_FOLD rather than by a hand-written line per key.
       The old shape needed one `if` in here for every key any boon might
       write, so a boon naming a sixth key did nothing AT ALL and did it
       silently -- the same failure that shipped five inert talents and six
       inert commander traits. assertBoonKeysAreLive() makes that
       unshippable rather than merely unlikely. */
    for (const key in S0.boonMods) {
      const fold = BOON_FOLD[key];
      if (fold) fold(S0, S0.boonMods[key]);
    }

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

    /* Every battle opens on the whole board. A camera carried in from the
       last one would start a match looking at a corner of a map the player
       has not seen yet. */
    this.resetCam();
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
                       waveCountMultiplier(n) * legion * COUNT_SCALE,
                       this.rosterIntroEvery || ROSTER_INTRO_EVERY);
  },

  /** Composition summary used by the preview panel and by the AI's scouting. */
  /* THE health multiplier for a wave, the single definition every consumer
     reads. It existed three times before (startWave, waveProfile and the UI's
     roster panel), and the third copy silently omitted the galaxy-tier term,
     so from galaxy II onward the preview understated every enemy by 30% per
     tier. That is the FOURTH time this bug class has shipped, so there is now
     exactly one place to omit a term from. Drift is deliberately NOT folded
     in: the spawn applies it per unit, and callers that need it say so. */
  waveHpMul(n) {
    return waveHpMultiplier(n) * this.difficulty.hp * UNIT_HP_SCALE
           * (1 + (this.tierHpStep || 0.30) * (this.galaxyTier || 0))
           /* The first galaxy's relief tent. 1.0 for every battle that did
              not ask for it, and 1.0 again from wave 15 on, so the terminus
              past wave 20 is bit-identical to what it always was. */
           * tier0ReliefMul(n, this.hpEase || 0);
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
    /* THE OPENING SYSTEM'S GRACE. A COLOSSUS on wave 5 arrives before a
       fourth tower is affordable, which is a wall rather than a lesson. The
       delay shifts the whole ROTA rather than skipping an entry, so the
       teaching order survives intact -- the first system meets COLOSSUS on
       wave 10 and VESPER on 15, in that order, just later. Zero for every
       battle that did not ask, so the schedule is unchanged everywhere else. */
    const d = this.minibossDelayWaves || 0;
    if (d) {
      if (n <= d) return null;
      return MINIBOSSES[(Math.floor((n - d) / MINIBOSS_EVERY) - 1 + MINIBOSSES.length) % MINIBOSSES.length];
    }
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
    /* One health/bounty multiplier per side, filled in the loop below. Both
       happen to read the same for every side today -- RESONANT FIELD was the
       one thing here that varied by seat, and it is gone (Session 35) -- but
       the per-side shape stays because the spawn-queue push below is keyed
       on side already and a scalar here would just be re-indexed there. */
    const hpMuls = [], bountyMuls = [];
    for (const S of this.sides) {
      /* BOOTSTRAP and THE COMPILE, both on the wave boundary because waves
         are the only clock two clients are guaranteed to agree on.
         The ramp is recomputed from the wave number rather than accumulated,
         so it can never drift and needs no state of its own. */
      if (S.bootUp) {
        const steps = Math.min(ROBOT_BOOT_WAVES,
                               Math.max(0, this.wave - 1 + ((S.traits && S.traits.bootAdvance) || 0)));
        const target = -ROBOT_BOOT_FLOOR + ROBOT_BOOT_STEP * steps;
        const prev = S._bootAt === undefined ? -ROBOT_BOOT_FLOOR : S._bootAt;
        const d = target - prev;
        if (d) { S.mods.damage += d; S.mods.rate += d; S.mods.range += d; }
        S._bootAt = target;
        if (steps >= ROBOT_BOOT_WAVES && !S._bootLit) {
          S._bootLit = true;
          if (S.index === this.viewSide) this.banner('LATTICE FULLY LIT', 2.6, '#e2e8f0');
        }
      }
      this.applyCompile(S);
      /* A spliced lane is measured in waves and closes on the boundary, so
         the wave that starts now is the one it was cut for. */
      const sp = this.spliceState[S.index];
      if (sp) { sp.wavesLeft--; if (sp.wavesLeft < 0) this.closeSplice(S.index); }
      hpMuls[S.index] = this.waveHpMul(this.wave);
      bountyMuls[S.index] = waveBountyMultiplier(this.wave);
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
          /* On a survive board the far seat has no commander and no towers, so
             queueing its wave would march every body straight into its base,
             leak it out in a handful of waves, and END THE MATCH the player is
             supposed to be outlasting. The swarm comes for YOU only. */
          if (this.soloSurvive && side !== 0) continue;
          /* Identical entry for EVERY side still standing, group scalars
             included: the wave is the same wave for every commander, which is
             the parity the whole attrition loop rests on. */
          this.spawnQueue.push({ t, type: grp.type, side, lane,
                                 hpMul: hpMuls[side] * (grp.hpScale || 1),
                                 bountyMul: bountyMuls[side] * (grp.bountyScale || 1) });
        }
      }
    }

    /* A miniboss escorts every fifth wave, boss waves included. The rule
       itself is minibossFor, so the preview and the threat model queue the
       same body this loop does. */
    const mb = this.minibossFor(this.wave, def);
    if (mb) {
      for (let side = 0; side < this.sides.length; side++) {
        /* THE SAME SURVIVE GUARD AS THE GROUP LOOP ABOVE. This is a SECOND
           queue push and it was missed the first time: with the group loop
           guarded and this one open, minibosses were still marching at the
           phantom seat. Measured before the fix: two mb_colossus bodies with
           owner -1 bound for seat 1 on a swarm board. Any new spawn path must
           carry this guard too. */
        if (this.soloSurvive && side !== 0) continue;
        for (let lane = 0; lane < this.lanes[side].length && !this.sides[side].defeated; lane++)
          this.spawnQueue.push({ t: this.clock + 3, type: mb, side, lane,
                                 hpMul: hpMuls[side], bountyMul: bountyMuls[side] });
      }
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
    else if (this.minibossName) { Sound.play('miniboss'); this.banner('MINIBOSS · ' + this.minibossName, 2.8, '#ffd166'); }
    else { Sound.play('waveStart'); this.banner('WAVE ' + this.wave + ' · ' + def.name, 2.2); }
    /* Announced after the wave banner because it OVERRIDES it: the ground
       going out from under you is the more urgent of the two, and the banner
       it writes carries the wave number so nothing is lost. */
    this.maelstromContract();
    UI.syncAll();
  },

  /** Called the moment the last unit of a wave has spawned. */
  /** A BOUNDED SURVIVE BOARD CAN BE WON, not merely outlasted.
   *
   * `endMatch`'s win test is `this.sides[0].alive`, which only ever resolves
   * when some OTHER seat falls. Nothing attacks the far seat on a survive
   * board (the spawn loops skip it deliberately), so before this the only
   * exit from a swarm was losing: a flawless defence and a collapse both
   * ended in defeat, scored on the wave you happened to die at.
   *
   * `scenario.surviveWaves` is the wave that, once spawned AND cleared, ends
   * the battle as a victory. Scenarios without the field are unbounded and
   * behave exactly as before, which is what keeps THE LONG VIGIL endless:
   * "No end. Stand as long as you can." is its whole identity.
   *
   * Cleared means what a player means by it: nothing of that wave is still
   * walking at you. Dead and leaked bodies linger in `this.enemies` for a
   * tick, so both are excluded, and `hostileTo` is checked so a body bound
   * for another seat could never hold the win open on a multi-seat board.
   */
  checkSurviveWin() {
    const n = this.scenario && this.scenario.surviveWaves;
    if (!n || this.state === 'over') return;
    if (this.wave < n || this.waveRunning || this.spawnQueue.length) return;
    for (const e of this.enemies)
      if (!e.dead && !e.leaked && e.hostileTo === 0) return;
    this.banner('THE LINE HELD', 4, '#4ade80');
    this.endMatch(true);
  },

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
      /* REINFORCEMENT LINE (owner, Session 33). No second AI-controlled side
         exists to stand beside you as a real ally, so this scenario's
         "co-op" is honestly stated as matériel, not a body on the board: a
         flat gold grant on the stated cadence, through the same awardGold
         every other wave-income source in this loop already uses. Reads a
         scenario field nothing else sets, so every existing scenario is
         unaffected -- this can only fire on the one scenario that opts in. */
      const rf = this.scenario && this.scenario.reinforce;
      if (rf && S.index === 0 && this.wave > 0 && this.wave % rf.every === 0) {
        const paidRf = this.awardGold(S.index, rf.gold);
        this.addFloater(this.width * 0.25, 110,
                         '+' + paidRf + ' REINFORCEMENT', false, '#38e8ff', 17);
      }
      const mus = musterPayout(S.musterIncome, this.wave, this.musterCapPct(S.index));
      if (mus > 0) {
        const paidMus = this.awardGold(S.index, mus);
        S.lastMuster = paidMus;
        if (S.index === 0) this.addFloater(this.width * 0.25, 88,
                                           '+' + paidMus + ' ECON', false, '#f97316', 17);
      } else { S.lastMuster = 0; }
      /* The per-cycle allowance resets with the wave that consumed it. */
      S.musterThisWave = 0;
      /* THE VIGIL boon (towers2.js `l_vigil`) is the only writer of waveHeal.
         This comment used to credit "Halder's Triage and the Vault's War
         Bonds", and neither is it: TRIAGE is VESS's talent and writes
         lifeRegen (handled below), and WAR BONDS writes the tower stat
         `waveBonus`, spent on the line after this one. Naming the wrong
         source is how lifeRegen stayed dead in plain sight -- the reader was
         right there and appeared to be its reader. */
      if (S.traits.waveHeal) this.restoreLife(S.index, S.traits.waveHeal);
      /* FIELD MEDIC, TRIAGE, CHORAL RECOVERY and the Federation's prestige
         reward all pay `lifeRegen` PER WAVE, in fractions of a life -- "one
         life every four waves" is 0.25. Nothing read the key, so a Light
         commander could prestige to five stars for a reward the confirmation
         dialog printed and the engine ignored. Banked rather than rounded at
         each wave: 0.25 a wave must pay on the fourth wave, and rounding a
         quarter-life four times pays nothing forever. */
      if (S.traits.lifeRegen) {
        S.lifeRegenBank = (S.lifeRegenBank || 0) + S.traits.lifeRegen;
        const whole = Math.floor(S.lifeRegenBank);
        if (whole >= 1) { S.lifeRegenBank -= whole; this.restoreLife(S.index, whole); }
      }
      for (const t of S.towers) if (t.stats.waveBonus) this.awardGold(S.index, t.stats.waveBonus, t);
    }
    Sound.play('waveClear');

    /* Every 10 waves the enemy escalates, and the later steps stack harder. */
    if (this.wave % 10 === 0) {
      const n = this.wave >= 30 ? 3 : this.wave >= 20 ? 2 : 1;
      for (let i = 0; i < n; i++) this.addEnemyMod();
    }

    /* Command upgrades arrive on each commander's own cadence. The brain is
       read by INDEX and a survive board has none, so the lookup is guarded
       rather than the loop skipped: a seat with no commander simply never
       drafts, which is the same statement the card makes about it. */
    for (let si = 1; si < this.sides.length; si++) {
      const brain = this.brains[si - 1];
      if (brain && this.wave % this.sides[si].traits.draftEvery === 0 && !this.sides[si].defeated)
        brain.chooseMod(this.drawMods(this.sides[si]));
    }
    if (this.wave % this.sides[0].traits.draftEvery === 0) this.offerChoiceWhenClear();
    UI.syncAll();
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
    /* Every fresh offer opens un-held: the hold is a per-offer decision, and
       a stale flag from the last offer would skip the modal outright. */
    this.escalationHold = false;
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
    this.escalationHold = false;
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
    this.banner('ENEMY ESCALATION · ' + m.name, 3.6, '#ef4444');
    UI.showEscalation(m);
  },

  /** Distinct command upgrades; how many is commander-dependent. */
  drawMods(side) {
    const S0 = side || this.sides[0];
    /* A land card on a map with no rubble is a dead draw, so gate the pool. */
    /* MEASURED: comparing the two SIZES is meaningless. THE COIL has 50
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

  /* `seat` defaults to 0, which is every singleplayer call unchanged. A duel
     drafts BOTH commanders from the same halted frame (js/net.js), and a
     lockstep command has to name the seat it belongs to -- a draft applied
     to whoever happens to sit at index 0 would pay the wrong player on one
     of the two clients. */
  takeMod(mod, seat = 0) {
    const s = this.sides[seat];
    mod.apply(s.mods, s);
    s.taken.push(mod);
    for (const t of s.towers) t.recompute();
    this.recomputeAuras();
    this.pendingChoice = null;
    this.state = 'playing';
    Sound.play('upgrade');
    this.banner('COMMAND UPGRADE · ' + mod.name, 2.4, '#4ade80');
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
  /** The tower COVERING (gx, gy) -- any tile of a multi-tile footprint
      answers, so clicks, the lockstep command lookups in js/net.js and the
      AI's occupancy re-tests all agree on what "here" means. (t.gx, t.gy)
      stays the TOP-LEFT anchor, which is what the wire and the fingerprint
      carry; footprints cannot overlap, so the match is never ambiguous. */
  towerAt(gx, gy) {
    for (const s of this.sides) for (const t of s.towers) {
      const f = t.foot || 1;
      if (gx >= t.gx && gx < t.gx + f && gy >= t.gy && gy < t.gy + f) return t;
    }
    return null;
  },
  ownsTile(side, gx, gy) {
    if (FIELD.ownerGrid) return gy !== undefined && FIELD.ownerGrid[gy] && FIELD.ownerGrid[gy][gx] === side;
    return side === 0 ? gx <= FIELD.buildMax[0] : gx >= FIELD.buildMax[1];
  },

  /** May `side` place a tower whose TOP-LEFT tile is (gx, gy)? `foot` widens
      the test to the whole foot x foot rectangle: bounds, ownership, lanes,
      authored terrain and arena rubble (all three live in `blocked`) and
      standing towers are checked per covered tile, so a heavy obeys exactly
      the rules a 1x1 does, four times over. `ignore` lets a relocation
      overlap the mover's own current footprint. Deterministic: reads only
      FIELD and board state, so a lockstep replay reaches the same verdict. */
  canBuild(side, gx, gy, foot = 1, ignore = null) {
    for (let dy = 0; dy < foot; dy++) for (let dx = 0; dx < foot; dx++) {
      const tx = gx + dx, ty = gy + dy;
      if (tx < 0 || ty < 0 || tx >= FIELD.cols || ty >= FIELD.rows) return false;
      if (!this.ownsTile(side, tx, ty)) return false;
      if (this.blocked.has(this.tileKey(tx, ty))) return false;
      const t = this.towerAt(tx, ty);
      if (t && t !== ignore) return false;
    }
    return true;
  },

  /** Does ANY foot x foot rectangle fit in this side's buildable ground right
      now? Deploy-screen honesty for heavies (UI.deploy); called once per
      deploy, so the full-grid scan is fine. */
  canFitFoot(side, foot) {
    for (let gy = 0; gy <= FIELD.rows - foot; gy++)
      for (let gx = 0; gx <= FIELD.cols - foot; gx++)
        if (this.canBuild(side, gx, gy, foot)) return true;
    return false;
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
    /* `=== this.viewSide`, not `=== 0`, for every refusal below. A duel replays
       BOTH seats' commands on BOTH machines with the real seat index, so a
       seat-0 refusal under the old gate printed the host's price on the
       guest's screen and gave the guest's own refusals nothing at all. This is
       the gate the success lines beside it already use. */
    if (S.gold < cost) {
      if (side === this.viewSide) UI.denied('BASE LEVEL ' + ((S.baseLevel || 1) + 1) + ' needs ◈' + formatNum(cost));
      return false;
    }
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
    /* A life-priced tower costs no gold AT ALL, and every surface that prints
       a price prints this figure beside a gold glyph. Falling through to the
       Math.max(1, ...) below would have quoted 1 gold for a purchase the
       engine never charges gold for -- a small lie, but the exact shape of
       the seven UI/engine desyncs this project has already shipped.
       Game.towerLifeCost is where the real price lives. */
    if (def && def.base && def.base.lifeCost) return 0;
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

  /* --- THE SECOND CURRENCY ------------------------------------------------
     BLOOD PRICE is bought with lives. Four calls, and every surface that
     prices, offers, greys out or charges a build goes through one of them, so
     there is exactly one statement of what a life-priced tower costs. */

  /** The life price of the next copy, or 0 for everything bought with gold.
      Compounds per copy the way gold prices already do, so a second Blood
      Price is a statement about the run rather than a default opening. */
  towerLifeCost(side, type) {
    const def = TOWER_TYPES[type];
    const base = def && def.base && def.base.lifeCost;
    if (!base) return 0;
    return Math.ceil(base * Math.pow(BLOOD_PRICE_GROWTH, this.sides[side].countOf(type)));
  },

  /** Can this side pay for that build right now, in whichever currency it is
      denominated? THE affordability test -- the radial, the build ghost and
      Game.build all ask it, so a greyed option and a refused purchase can
      never disagree. */
  canAffordBuild(side, type) {
    const S = this.sides[side];
    if (!S) return false;
    const life = this.towerLifeCost(side, type);
    /* THE HARD FLOOR, identical for both seats. A tower that can take your
       last life is not a decision, it is a delayed loss wearing one. */
    if (life > 0) return S.lives - life >= BLOOD_PRICE_FLOOR;
    return S.gold >= this.towerCost(side, type);
  },

  /** The denominator the RIVAL divides a build's value by, in gold, for
      everything -- including what is not bought with gold.

      AI.bestAction scores a candidate as `value / cost`. A life-priced tower
      quotes zero, and `value / 0` is Infinity: measured on a mirror board,
      the rival picked BLOOD PRICE on every build tick it had a spot for and
      had spent its buffer down to the floor by wave 4, which made the FRESH
      pin look better while making the match worse -- exactly the failure the
      design note warns about. Stating the life price in gold lets the two
      currencies compete honestly. Infinity is returned rather than a refusal
      because AI.bestAction's own `cost > gold * 1.8` test already reads that
      as "not this tick", so no change is needed on its side of the call. */
  bidCost(side, type) {
    const life = this.towerLifeCost(side, type);
    if (!life) return this.towerCost(side, type);
    const S = this.sides[side];
    if (S.lives - life < BLOOD_PRICE_FLOOR) return Infinity;
    /* A PREFERENCE, not a rule, and only for a commander the player is not
       driving -- exactly the shape MUSTER_AI_SAFE_LIVES already has for
       sends. The rule above applies to both seats identically. */
    if (S.isAI && S.lives - life < S.maxLives * BLOOD_PRICE_AI_RESERVE) return Infinity;
    return life * BLOOD_PRICE_BID_GOLD;
  },

  /** Spend lives on a purchase. Deliberately NOT loseLives: a leak books a
      breach, flashes the screen, feeds `stats.leaked` and can end the match.
      This is a transaction, it is floored above zero by canAffordBuild, and
      it can never resolve a battle. */
  spendLives(side, n) {
    const S = this.sides[side];
    S.lives -= n;
    S.livesPaid = (S.livesPaid || 0) + n;
    if (side === this.viewSide) {
      this.hurtFlash = 0.5; this.shake(5); Sound.play('leak');
      this.addFloater(this.width / 2, 60, '-' + n + ' ♥ PAID', false, '#ef4444', 16);
    }
    UI.syncLive();
  },

  /**
   * REPLICATOR's free emplacement.
   *
   * Everything Game.build enforces except the payment: loadout membership,
   * tile legality through canBuild (ownership, lane, authored terrain, arena
   * rubble, anything already standing) and the base-level floor. It cannot
   * be reached by a player and takes no price, so it deliberately does NOT
   * re-enter build() -- a "free" flag on the paid path is how a discount ends
   * up reachable from the shop.
   */
  buildFree(side, type, gx, gy) {
    const S = this.sides[side];
    if (!S || !TOWER_TYPES[type]) return null;
    if (!S.loadout.includes(type)) return null;
    if (!this.canBuild(side, gx, gy, towerFoot(TOWER_TYPES[type]))) return null;
    const t = new Tower(type, gx, gy, side);
    if ((S.baseLevel || 1) > 1) this.applyBaseLevelTo(t, S.baseLevel);
    S.towers.push(t);
    /* Counted as built: it raises this side's tower count, which raises every
       future price through the inflation term in towerCost. A free tower that
       did not is a free tower that costs nothing at all, and the board cost
       is the whole balance of REPLICATOR. */
    S.stats.built++;
    this.recomputeAuras();
    if (side === 0) UI.syncAll();
    return t;
  },

  build(side, type, gx, gy) {
    const S = this.sides[side];
    const cost = this.towerCost(side, type);
    const life = this.towerLifeCost(side, type);
    const def = TOWER_TYPES[type];
    const foot = def ? towerFoot(def) : 1;
    if (!def || !this.canBuild(side, gx, gy, foot)) {
      /* A heavy refused for its own SIZE is not a closed tile, and saying the
         tile is closed sends the player hunting for terrain that is already
         fine. The same canBuild at foot 1 separates the two: if the anchor
         tile alone is legal, the only thing wrong is that the block does not
         fit -- which is the refusal drawRadial already prints as NO ROOM. */
      if (side === this.viewSide) UI.denied(def && foot > 1 && this.canBuild(side, gx, gy)
        ? def.name + ' needs a clear ' + foot + '×' + foot + ' block'
        : 'No room there: that ground is a lane, rubble, not yours, or already built on', false);
      return null;
    }
    /* Only the towers you deployed with may be built. */
    if (!S.loadout.includes(type)) {
      if (side === this.viewSide) UI.denied(def.name + ' is not in the loadout you deployed with', false);
      return null;
    }
    if (!this.canAffordBuild(side, type)) {
      /* BLOOD PRICE is charged in LIVES, and towerCost deliberately quotes 0
         gold for it, so a single gold sentence here would have read "needs
         ◈0" -- a refusal naming a price the engine never charges. canAffordBuild
         refuses on the floor as well as on the balance, so the line states both. */
      if (side === this.viewSide) UI.denied(life
        ? def.name + ' costs ♥' + life + ', never below ♥' + BLOOD_PRICE_FLOOR + ' left'
        : def.name + ' needs ◈' + formatNum(cost), !life);
      return null;
    }
    if (life > 0) this.spendLives(side, life); else S.gold -= cost;
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
      /* Named for the step the button offered ("UPGRADE → RAPID CORE"), never a
         level number: the phrase the player just clicked is the only one they
         can match the refusal back to. */
      if (S.gold < cost) {
        if (tower.side === this.viewSide) UI.denied(tower.def.name + ' → ' + next.data.name + ' needs ◈' + formatNum(cost));
        return false;
      }
      S.gold -= cost; tower.invested += cost; tower.level++;
      /* Each level also rolls one random minor buff, no decision to make. */
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
      if (S.gold < cost) {
        if (tower.side === this.viewSide) UI.denied(b.name + ' needs ◈' + formatNum(cost));
        return false;
      }
      S.gold -= cost; tower.invested += cost; tower.branch = b; tower.level = 4;
      tower.pendingBranch = false;
      if (tower.side === this.viewSide) Sound.play('branch');
    } else {
      const cost = tower.upgradeCost('ascend', next.cost);
      if (S.gold < cost) {
        if (tower.side === this.viewSide) UI.denied(tower.def.name + ' ASCEND → +' + (tower.asc + 1) + ' needs ◈' + formatNum(cost));
        return false;
      }
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
       buttons all still worked. 54k gold could be burned on a tower that
       never fires and never renders. Nothing sets `dead` on a Tower, so the
       downstream `!movingTower.dead` guard could never have caught it. The
       `S` hotkey reaches sell too, so the panel is not the only vector. */
    if (this.movingTower === tower) this.movingTower = null;
    this.recomputeAuras();
    if (tower.side === this.viewSide) { Sound.play('sell'); this.spawnBurst(tower.x, tower.y, 10, '#94a3b8', 90); }
    if (tower.side === 0) UI.syncAll();
  },

  /* THE ONE WRITER of a tower's targeting. Tower.acquire switches on
     targetMode for every tower on every tick (entities.js), which makes it
     simulation state -- and the inspector and the Tab key both used to assign
     it raw. The mode changed on one screen only, that client's guns started
     picking a different enemy, and the duel died on the next agreement check
     with THE BOARDS HAVE PARTED about a hundred milliseconds later. A single
     entry point is what gives the relay something to wrap (js/net.js).

     Ownership is deliberately NOT tested here. The inspector already gates on
     `mine` and the relay gates a replayed command on `_side === c.seat`; a
     test in the writer would refuse the RIVAL's own command at the moment
     this client replays it, which is the one place it must not. */
  setTargetMode(tower, mode) {
    if (!tower) return false;
    /* A mode arriving off the wire is not trusted to be one of ours. acquire's
       switch falls through to FIRST on anything else, so a garbled string
       would not part the boards -- it would quietly mislabel the panel and
       make the Tab cycle skip a step. Refuse it where it can still be. */
    if (!TARGET_MODES.some(m => m.id === mode)) return false;
    tower.targetMode = mode;
    /* Nothing is spent and no stat is rebuilt: the mode is read at aim time,
       never baked into recompute. The sound and the panel are the whole of it,
       and the sound lives here so the relay's own press-click is not doubled
       by a second one at the call site. */
    if (tower.side === this.viewSide) Sound.play('click');
    if (tower.side === 0) UI.syncAll();
    return true;
  },

  recomputeAuras() {
    for (const S of this.sides) {
      for (const t of S.towers) { t.aura.dmg = 0; t.aura.rate = 0; t.aura.range = 0; }
      for (const b of S.towers) {
        if (b.def.attack !== 'aura') continue;
        /* SERAPH's RADIANCE widens the field itself. `auraRangeMul` was
           written by her trait, by two talents and by a boon, had its own
           BOON_FOLD entry, and was read by nothing at all -- so the one
           commander whose identity is aura WIDTH had no wider auras. */
        const r2 = (b.stats.range * TILE * (S.traits.auraRangeMul || 1)) ** 2;
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
        /* A REACTOR does not add links -- it SUPPLIES them: a machine in its
           field runs at the reactor's rated fill wherever its neighbours
           stand, and the rating may exceed ORIGIN_LATTICE_MAX -- recompute
           honours that through latticeFillCap. Counted inside this pass for
           the same reason the pylon is: it already walks every tower. */
        t.latticeFillCap = 0;
        for (const p of S.towers) {
          const raw = p !== t && p.stats && p.stats.latticeFill;
          if (!raw) continue;
          /* However far SUPERCRITICAL surges the rating, the fill never
             exceeds LATTICE_FILL_MAX: surges skip STAT_CEIL, so the ceiling
             lives at the one place the rating is read. */
          const lf = Math.min(LATTICE_FILL_MAX, raw);
          if (dist2(t.x, t.y, p.x, p.y) <= p.rangePx * p.rangePx) {
            n = Math.max(n, lf);
            t.latticeFillCap = Math.max(t.latticeFillCap, lf);
          }
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
    /* HALDER's DEEP LINE and AURELIA's CHORAL RECOVERY both promise that
       "every source of life recovery" is worth more, and `lifeGainMul` was
       written by two commander traits and six talents while nothing read it.
       Applied HERE, at the one funnel every heal passes through -- menders,
       the Custodian, waveHeal and the wave-clear regen -- so the promise is
       true of every source rather than of whichever one got remembered. */
    const gain = 1 + (S.traits.lifeGainMul || 0);
    if (gain !== 1) n = Math.max(1, Math.round(n * gain));
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
      /* THE ROLL COMES FIRST ON PURPOSE. `&&` short-circuits, so with the
         viewSide test in front this draw happened on one client and not on
         the other -- and two lockstep peers do not share a viewSide, so the
         shared random stream would part company here and nowhere else. The
         floater is unchanged; only the order of the test is. See js/net.js. */
      if (Math.random() < 0.12 && enemy.hostileTo === this.viewSide)
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
    /* Counted per ATTEMPT, not per tower jammed: LUMEN-R is learning that it
       is being intruded upon, and a commander whose towers are already
       immune is still being attacked. Booked against the side under attack. */
    S.stats.jammed = (S.stats.jammed || 0) + 1;
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

  /**
   * WHAT A BREACH ACTUALLY COSTS, one definition, three readers.
   *
   * The reap charged this, and the HUD's lives-in-flight figure and the theft
   * floater both printed the RAW `livesCost` instead, under a comment
   * claiming both panels obeyed the same law. A Shield Wall commander watched
   * `(3⚑)` walk out and paid 2. The number a player is asked to defend has to
   * be the number they are charged.
   */
  leakCostOf(e) {
    const damp = (this.enemyDamp[e.hostileTo] || {}).power || 1;
    const red = (this.sides[e.hostileTo] && this.sides[e.hostileTo].traits.leakReduction) || 0;
    return Math.max(1, Math.round(e.livesCost * damp - red));
  },

  loseLives(side, n, breaches) {
    const S = this.sides[side];
    /* LEAK REDUCTION IS NOT APPLIED HERE, and that is the fix rather than the
       omission. It was applied in BOTH places: once per breach in the reap
       (`cost = max(1, round(cost - red))`) and again to the frame's total on
       this line. A Shield Wall commander therefore paid the discount twice --
       a lone three-life miniboss cost 1 instead of the advertised 2, and
       every trait and boon writing `leakReduction` was worth roughly double
       what it said. The reap is the correct owner: the trait reads "every
       BREACH costs one less", and the manifest the reap builds has to carry
       per-enemy costs the defeat screen can print. Everything reaching this
       function is already final -- Net's remote result and the duel harness
       both charge an authoritative number that must not be re-discounted. */
    /* WHAT KILLED YOU, part two: book the manifest against `n`. Both endings
       below add exactly this `n` to stats.leaked, so the log and the ledger
       cannot disagree. With the double-discount gone `n` IS the sum of the
       breach costs, so the proportional split below is an identity for the
       ordinary path; it is kept because a caller may still charge a total
       that is not the manifest's sum (a kill blow, a remote result), and the
       shares must always sum to n exactly. The argument is optional because
       those callers pass no manifest, and a missing manifest must cost
       nothing. */
    if (breaches) {
      let raw = 0;
      for (const b of breaches) raw += b.cost;
      let left = n;
      for (let i = 0; i < breaches.length; i++) {
        const b = breaches[i];
        const share = i === breaches.length - 1
          ? left : Math.min(left, Math.max(1, Math.round(n * b.cost / raw)));
        left -= share;
        const row = S.leakLog[b.type] || (S.leakLog[b.type] = { n: 0, lives: 0, sent: 0 });
        row.n++; row.lives += share; if (b.sent) row.sent++;
      }
    }
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
    /* The seed dies with the match; the menu and the next battle start clean. */
    this.seed = null; this._seedDraw = null;
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
    /* 20.5 -- levels were paid here and then forgotten. Nothing routed the
       player to the chart, so points piled up unspent and unnoticed. The
       end screen reads this to decide where its continue button leads. It
       is computed HERE, on the line after the award, so the number the
       button prints is the number the tree will honour -- and it is paid on
       a DEFEAT exactly as the XP above is, because the XP above is. */
    this.lastLevelUp = Meta.levelUpAward(this.sides[0].commander.id,
                                         this.lastXp.levelsGained);
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
    /* The WORLD, not just its id: ratingFor needs it to ask which scenario this
       board ran, and the scenario owns the star thresholds. Resolved here, once,
       so the rating and the preview card cannot consult different objects. */
    this.worldRecord = null;
    if (node && node.world && typeof Meta.galaxy === 'function') {
      const gx = Meta.galaxy();
      if (gx) for (const sy of gx.systems) {
        const w = sy.worlds.find(x => x.id === node.world);
        if (w) { this.worldRecord = w; break; }
      }
    }
    /* c0.stars is progress as of BEFORE this battle: fetched above, before
       recordWorld below can move it. ratingFor needs exactly that snapshot to
       know whether the board that just finished was already yours going in,
       not whether it is now -- which this same call is what decides. */
    this.lastStars = node
      ? Meta.recordWorld(node.world, ratingFor(won, this.sides[0].lives, this.sides[0].maxLives,
                                               this.wave, this.worldRecord, c0 && c0.stars))
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
    /* ACHIEVEMENT COUNTERS (Session 29). Placed HERE, after lastStars and
       campaignResult are resolved, because three of the counters read them.
       Runs on a DEFEAT exactly as on a win, which is the entire point: the
       participation rows are the soul income for a player who is stuck.

       Every figure comes from a counter the match already kept, so this adds
       no bookkeeping to the hot loop. `built` is the running total of towers
       RAISED, not the ones left standing, so selling or losing one does not
       quietly un-earn progress. `galaxies` is absent on purpose: it is
       DERIVED from galaxyTier inside Meta.stats, because bumping it here
       would count every battle fought after the last galaxy fell. */
    const rs = this.sides[0].stats || {};
    const starsGained = this.lastStars && this.lastStars.improved
      ? (this.lastStars.stars - this.lastStars.previous) : 0;
    Meta.bumpStats({
      battles: 1,
      waves: Math.max(0, this.wave),
      kills: rs.kills || 0,
      built: rs.built || 0,
      losses: won ? 0 : 1,
      stars: starsGained,
      systems: (this.lastStars && this.lastStars.systemTaken) ? 1 : 0,
      vaulted: (this.lastStars && this.lastStars.saved) ? this.lastStars.saved.length : 0
    });
    this.lastAchievements = Meta.claimAchievements();
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
 so `1 - side`, which three call sites still open-coded, is undefined the
     moment a third seat exists. Returns a live opponent, or -1 if none remain. */
  rivalOf(side) {
    const v = this.musterVictims(side);
    return v.length ? v[0] : -1;
  },

  musterVictims(side) {
    /* A SURVIVE BOARD HAS NOBODY TO SEND AT. The far seat has no commander, no
       towers and no lives that matter, so a send there is gold spent on a
       phantom. Returning nothing here closes the whole path at once: canMuster
       reads this, and so does the muster panel, so the button is not merely
       inert, it is absent. */
    if (this.soloSurvive) return [];
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
        /* ANY covered tile taken by the horizon takes the whole emplacement --
           a heavy standing half in the void is not a thing the board can draw
           or the blocked set can express. */
        const tf = t.foot || 1;
        let eaten = false;
        for (let fdy = 0; fdy < tf && !eaten; fdy++)
          for (let fdx = 0; fdx < tf && !eaten; fdx++)
            if (this.consumed.has(this.tileKey(t.gx + fdx, t.gy + fdy))) eaten = true;
        if (!eaten) continue;
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
    this.banner('WAVE ' + this.wave + ' · THE HORIZON CONTRACTS' + (mine ? ' · ' + mine + ' LOST' : ''),
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
  musterHpMul(side, victim, damp = MUSTER_DAMP) {
    /* Reads the ONE definition rather than open-coding the tier term a third
       time; drift is applied here because a mustered unit carries it.
       `damp` is a parameter rather than the constant so THE PROCESSION -- the
       one rite whose bodies have no parent corpse and were never paid for --
       can pay its steeper tax through this same function instead of forking a
       second copy of the wave maths. Default is the bought-send figure, so
       every existing caller is unchanged. */
    let m = this.waveHpMul(Math.max(1, this.wave)) * (1 + this.drift.hp);
    for (const mod of this.enemyMods) if (mod.hpMul) m *= mod.hpMul;
    m *= damp * this.sides[side].mods.reanim;
    /* 19.16. A bought body is worth a FRACTION of a wave body in the opening
       and the full damped figure from wave 10 on. It sits inside musterHpMul
       rather than at the spawn, because the muster bar, the rival's pressure
       estimate and the spawn all read this function -- putting it anywhere
       else is how a preview and a payout disagree. */
    m *= spawnHpPenaltyMul(this.wave);
    /* The sender's own swell, applied before the victim's resistance so
       the two read as attack against defence rather than one number. */
    const mine = this.sides[side].traits;
    if (mine && mine.musterHpMul) m *= mine.musterHpMul;
    /* Every buy hardens what you send, for good. See POWER_PER_BUY. */
    m *= (1 + (this.sides[side].summonPower || 0));
    const V = this.sides[victim];
    if (V) m *= (1 - (V.traits.reanimResist || 0));
    return m;
  },

  /**
   * THE COMPILE ENGINE.
   *
   * A compiling commander opens the battle weaker than the thing it copied
   * and rewrites itself as the battle teaches it. The metric is whatever
   * that commander actually learns from -- ascensions, kills, intrusions
   * survived, gold committed to the board, or simply waves endured.
   */
  compileMetric(S, kind) {
    if (kind === 'asc') return S.totalAsc || 0;
    if (kind === 'kills') return S.stats.kills || 0;
    /* A board that never jams would strand this commander at level zero
       forever, so the wave count is a floor under it: the training arrives
       either from the rival or from the calendar. */
    if (kind === 'jams') return (S.stats.jammed || 0) + Math.floor(this.wave / 5);
    if (kind === 'invested') {
      let g = 0;
      for (const t of S.towers) g += t.invested || 0;
      return g;
    }
    return this.wave;   /* 'waves' */
  },

  /**
   * Apply every compile level this side has now reached.
   *
   * Levels apply ONE-SHOT DELTAS at wave boundaries and never re-fold the
   * commander from scratch. That is deliberate: a boon, a draft card or a
   * bought base level taken after wave one would be erased by a refold, and
   * losing a drafted card to a scheduled recompile is the worst bug this
   * design could ship.
   */
  applyCompile(S) {
    const cmd = S.commander;
    if (!cmd || !cmd.compile) return;
    const spec = cmd.compile;
    const metric = this.compileMetric(S, spec.metric) * (S.traits.compileRateMul || 1);
    let want = S.traits.compileFloor || 0;
    for (let i = 0; i < spec.levels.length; i++) if (metric >= spec.levels[i].at) want = Math.max(want, i + 1);
    want = Math.min(want, spec.levels.length);
    if (want <= (S.compileLevel || 0)) return;
    for (let i = S.compileLevel || 0; i < want; i++) {
      const lv = spec.levels[i];
      if (lv && lv.apply) lv.apply(S.traits, S, S.mods);
    }
    S.compileLevel = want;
    /* NO RE-FOLD HERE, and that is deliberate. foldTraits MULTIPLIES mods by
       the trait accumulators (`m.damage *= 1 + t.dmg`), so it is not
       idempotent: calling it once per recompile re-applied the commander's
       whole trait block every time. Measured on DREGG-R, whose trait carries
       +12% damage: mods.damage climbed 0.986 -> 1.104 -> 1.236 -> 1.385 over
       three compiles, a 40% inflation nothing advertised and nothing capped.
       Levels that want a MODS change now write `m` directly (the third
       argument); levels that want a live-read trait -- jamImmune, killRamp,
       costGrowthMul, ascCostMul -- write `t` and the engine reads those from
       traits anyway. */
    if (S.index === this.viewSide) {
      this.addFloater(this.width * 0.5, 128, '⟲ RECOMPILED, ' + spec.name, false, '#e2e8f0', 16);
      Sound.play('branch');
    }
  },

  /** The rite a seat summons by. One reader, so no call site open-codes it. */
  doctrineOf(side) {
    const S = this.sides[side];
    return (S && SUMMON_DOCTRINES[S.doctrine]) || SUMMON_DOCTRINES.human;
  },

  /** The income ceiling this seat's rite obeys. Infinity for the Marque. */
  musterCapPct(side) { return this.doctrineOf(side).incomeCapPct; },

  /**
   * THE POWER FIGURE the HUD quotes: everything that multiplies what this
   * side sends, before the victim's own resistance. Defined once here so the
   * chip, the ledger footer and the tooltip can never drift from the spawn.
   */
  powerOf(side) {
    const S = this.sides[side];
    if (!S) return 1;
    return MUSTER_DAMP * S.mods.reanim * spawnHpPenaltyMul(this.wave) *
           ((S.traits && S.traits.musterHpMul) || 1) * (1 + (S.summonPower || 0));
  },

  /**
   * THE CORPSE BUDGET, the one conservation number.
   *
   * A doctrine may change the SHELL a kill returns in; it may never change
   * the MASS. Every rite that spends a corpse spends exactly this, so the
   * shapes stay comparable and no faction can print health by rolling well.
   * These are the same terms the old universal reanimate applied inline
   * (maxHp already carries wave scaling, drift and every escalation, which is
   * why neither is re-applied here -- that double application was a measured
   * 3.02x and is the reason this is a function and not three copies).
   * The victim's reanimResist is deliberately NOT folded in: it belongs to
   * whoever RECEIVES the body, and on a tri board one kill can march on two
   * seats with different resistances.
   */
  corpseBudget(e) {
    const S = this.sides[e.hostileTo];
    return {
      hp: e.maxHp / (e.rageMul || 1) * 0.6 * S.mods.reanim * (1 + (S.summonPower || 0)),
      armor: e.armor * 0.6
    };
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
    /* THE funnel for what a send costs -- canMuster and muster both read it,
       so a discount applied here cannot show one price and charge another. */
    const t = this.sides[side].traits;
    const d = this.doctrineOf(side);
    return Math.max(1, Math.round(
      musterCost(tier, this.wave, this.sides[side].musterBuys || 0, d.costGrowth, d.costSteps)
      * (t && t.musterCostMul ? t.musterCostMul : 1)));
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
    const cap = this.musterCapPct(side);
    return this.previewGold(side, musterPayout((S.musterIncome || 0) + step, w, cap))
         - this.previewGold(side, musterPayout(S.musterIncome, w, cap));
  },

  /** `tier` omitted asks only whether the control is live at all. */
  /** Patrol routes a muster from `side` would walk, empty off a solo board.
   *
   * Only seat 0 patrols: the far seat on a survive board is a spawn mouth
   * with nobody behind it, and the AI brains are already empty there
   * (`this.brains` is [] under soloSurvive), so nothing else would ever ask.
   */
  patrolRoutesFor(side) {
    if (!this.soloSurvive || side !== 0 || !this.patrolPaths) return [];
    return this.patrolPaths;
  },

  /** How many times `tier.count` a single buy actually puts on the board.
   *
   * One per victim on a two-sided board, two on the Confluence, one per
   * patrolled lane on a survive board. THE PANEL AND THE ENGINE MUST AGREE:
   * muster() loops victims and then patrol routes, so anything previewing a
   * buy asks this rather than re-deriving it and quoting a number the buy
   * will not deliver. */
  musterFanout(side) {
    return Math.max(1, this.musterVictims(side).length + this.patrolRoutesFor(side).length);
  },

  canMuster(side, tier) {
    const S = this.sides[side];
    if (!S || this.state !== 'playing' || !S.alive || S.defeated) return false;
    /* THE LATTICE does not buy -- unless the board gives it nothing else. On
       a no-reanimate arena every rite's free half is switched off, and a seat
       that can neither earn a body nor buy one has no offence at all, so the
       refusal is waived rather than leaving it mute. */
    if (this.doctrineOf(side).noPurchase && !this.noReanim) return false;
    if ((S.musterThisWave || 0) >= MUSTER_PER_WAVE) return false;
    /* A survive board has nobody to send AT, but it does have somewhere to
       send TO: your own lane, walked backwards as a patrol. musterVictims
       stays empty there on purpose (it answers "who is on the other side of
       this board", and the honest answer is nobody, which is what keeps
       privateerTake, rivalOf and reanimation closed). So the patrol route is
       the second thing that can satisfy this gate, not a loosening of the
       first. */
    if (!this.musterVictims(side).length && !this.patrolRoutesFor(side).length) return false;
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
    /* And the buy hardens every future send, permanently. Without this a
       summon bought past the income ceiling was pure tempo and the button's
       standing promise was half a lie. Bounded for four rites; for LETTERS OF
       MARQUE it is the owner's uncapped power bonus, priced by cost growth. */
    {
      const d = this.doctrineOf(side);
      S.summonPower = Math.min(d.powerCap, (S.summonPower || 0) + d.powerPerBuy);
    }

    /* On the Confluence a send marches on BOTH rivals, exactly as a kill
       does there -- the map's identity, not a muster-specific bonus. */
    let sentUnits = 0;
    for (const vic of this.musterVictims(side)) {
      const path = this.sendPathFor(side, vic, base);
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

    /* THE PATROL, solo boards only. Same purchase, same cost, same income:
       the only thing that differs is where the bodies go and what they do at
       the end of the road.

       `hostileTo: 1` is what makes them FIGHT. The melee pass pairs bodies
       whose hostileTo differs and skips only pairs where BOTH are unowned
       (the wave-is-weather gate), so a patrol at hostileTo 1 and owner 0
       engages the wave's hostileTo 0 bodies exactly as a send engages a
       rival's defenders. It never means "seat 1 owns this" -- seat 1 is a
       spawn mouth with nobody behind it, and `patrol` below guarantees these
       bodies never reach a base to leak into, which is also what stops a
       patrol walking into the phantom seat and winning the match. */
    for (const path of this.patrolRoutesFor(side)) {
      const dbl = S.mods.doubleReanim || 0;
      for (let i = 0; i < tier.count; i++) {
        const copies = 1 + ((dbl > 0 && Math.random() < dbl) ? 1 : 0);
        for (let k = 0; k < copies; k++) {
          this.pendingSpawns.push(new Enemy(base, path, {
            /* THE SAME FUNCTION THE PANEL QUOTES. musterHpMul on a victim
               that does not exist skips exactly one term, the victim's
               reanimResist, and keeps every other: wave scaling, drift, the
               early-wave penalty, the sender's swell and summonPower. Passing
               the raw MUSTER_DAMP constant instead would have dropped all of
               those, leaving a patrol frozen at its wave-1 strength while the
               waves it fights kept scaling, and would have disagreed with the
               figure the muster panel prints for the same buy. */
            hpMul: this.musterHpMul(side, -1),
            bountyMul: 1, speedMul: S.traits.reanimSpeed,
            armorFlat: ((base.armor || 0) + this.drift.armor) * MUSTER_DAMP,
            hostileTo: 1, owner: side, reanimated: true, patrol: true,
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
      this.addFloater(this.width * 0.5, 108, base.name.toUpperCase() + ' ' + tier.name + ' SUMMONED', false, '#f97316', 18);
      /* Gated exactly as build() and upgrade() are. A full syncAll re-renders
         the shop and the inspector; running it on every RIVAL muster -- which
         the brain can fire every 0.55s -- is DOM churn nothing on screen
         needed, since step() already drives syncLive (and so syncMuster) at
         8Hz and the only player-visible consequence is the inbound units. */
      UI.syncAll();
    }
    return true;
  },

  /**
   * THE DISPATCH. A corpse belongs to the killer's rite; this is the only
   * place that decides which one gets it.
   *
   * `onKill: null` rites (THE PROCESSION, LETTERS OF MARQUE) take nothing
   * from a kill at all -- that is precisely what they traded away -- so they
   * return here having done nothing, and that is not an omission.
   */
  /** The path a body OWNED BY `side` marches at `vic`: the tri table, the
      duo send lane, or the air chord for a flyer. One function, because four
      spawn sites picking paths independently is how a flyer walked. */
  sendPathFor(side, vic, def) {
    if (UNIT_ROLES_ON && def && def.flying && this.airSendPaths &&
        this.airSendPaths[side] && this.airSendPaths[side][vic])
      return this.airSendPaths[side][vic];
    return (this.triMode && FIELD.sendTri) ? this.sendTriPaths[side][vic] : this.sendPaths[side];
  },

  /**
   * MELEE (Session 26). Infantry fights the first enemy unit it meets.
   *
   * Deterministic and O(N): every live grounded body is bucketed by tile,
   * each infantry attacker scans its 3x3 neighbourhood for the nearest
   * opposing infantry, and an engaged pair halts and trades timed strikes.
   * Runs INSIDE step, after movement and before the reap, so deaths book
   * through the unchanged funnel and both clients of a duel walk the same
   * frames; the one random draw is a cosmetic spark that rides the seeded
   * stream the way every particle inside step does.
   *
   * THE GATE THAT KEEPS IT SANE: at least one of the pair must be a
   * player-sent body (owner >= 0). Wave against wave stays the ghost-through
   * it has always been, because mirrored waves spawn on adjacent or shared
   * tiles and would otherwise lock the spawn mouth into a killball on every
   * board, worst on tri and radial fields where lanes share their opening
   * tiles outright. Carriers are exempt both ways: a carrier is already a
   * fixed-pace special state, and infantry pinning stolen lives would
   * silently reprice every leak. Bosses and minibosses swing but are never
   * halted, the same exemption the Barricade grants.
   */
  resolveMelee(dt) {
    if (!UNIT_ROLES_ON) return;
    const es = this.enemies;
    /* WHO CAN MEET WHOM. Infantry fight infantry, and stealth fight STEALTH
       (owner): a screen of knives is answered by knives, not by the line
       infantry it was built to walk past. Air still touches nothing. The
       pairing rule below is `v.role === e.role`, which is what keeps stealth
       slipping past infantry exactly as it always has while giving the
       counter-stealth matchup somewhere to happen. */
    const meleeRole = r => r === 'infantry' || r === 'stealth';
    /* Cheap gate: melee needs at least one sent grounded meleeable body. */
    let anySent = false;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e.dead && !e.leaked && e.owner >= 0 && meleeRole(e.role) && !e.carrier) { anySent = true; break; }
    }
    if (!anySent) return;
    /* Bucket grounded, meleeable bodies by tile. Integer keys, insertion
       ordered, deterministic. */
    const buckets = new Map();
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead || e.leaked || e.carrier || !meleeRole(e.role)) continue;
      if (e.flying && !e.grounded) continue;
      const k = ((e.x / TILE) | 0) << 8 | ((e.y / TILE) | 0);
      let b = buckets.get(k);
      if (!b) buckets.set(k, b = []);
      b.push(e);
    }
    const held = new Map();
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead || e.leaked || e.carrier || !meleeRole(e.role)) continue;
      if (e.flying && !e.grounded) continue;
      const gx = (e.x / TILE) | 0, gy = (e.y / TILE) | 0;
      let best = null, bd = Infinity;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const b = buckets.get((gx + ox) << 8 | (gy + oy));
        if (!b) continue;
        for (let j = 0; j < b.length; j++) {
          const v = b[j];
          if (v === e || v.dead || v.hostileTo === e.hostileTo) continue;
          /* LIKE MEETS LIKE. Infantry never stops stealth (that is the whole
             of what stealth buys) and stealth never stops infantry, so the
             only new matchup this opens is stealth against stealth. */
          if (v.role !== e.role) continue;
          /* THE WAVE-WEATHER GATE: no pair of unowned bodies ever fights. */
          if (e.owner < 0 && v.owner < 0) continue;
          const reach = e.radius + v.radius + MELEE_RANGE_PAD;
          const d2 = dist2(e.x, e.y, v.x, v.y);
          if (d2 <= reach * reach && d2 < bd) { bd = d2; best = v; }
        }
      }
      if (!best) { e._meleeRef = null; continue; }
      const holders = held.get(best) || 0;
      if (holders >= MELEE_HOLD_CAP) { e._meleeRef = null; continue; }
      held.set(best, holders + 1);
      if (e._meleeRef !== best) { e._meleeRef = best; e._meleeAt = e.dist; e.meleeT = Math.min(e.meleeT || 0, MELEE_PERIOD * 0.5); }
      if (!e.boss && !e.miniboss) {
        e.dist = Math.min(e.dist, e._meleeAt);
        e.updatePosition();
      }
      e.meleeT -= dt;
      if (e.meleeT <= 0) {
        e.meleeT = MELEE_PERIOD;
        const dealt = best.takeDamage(Math.max(1, Math.round(e.maxHp * MELEE_STRIKE_FRAC)), 'physical', {});
        /* THE DRAW COMES BEFORE THE GATE. viewSide differs between the two
           clients of a duel, so a draw gated on it would move the seeded
           stream on one machine and not the other: the same desync the
           damage-number toggle shipped in Session 22, and the same fix. */
        const sparkRoll = Math.random();
        if (dealt > 0 && (e.hostileTo === this.viewSide || best.hostileTo === this.viewSide) &&
            sparkRoll < dt * 8)
          this.spawnBurst((e.x + best.x) / 2, (e.y + best.y) / 2, 3, '#e2e8f0', 40);
      }
    }
  },

  doctrineOnKill(e) {
    const d = this.doctrineOf(e.hostileTo);
    if (d.onKill === 'clone') return this.reanimate(e);
    if (d.onKill === 'roll') return this.conscript(e);
    if (d.onKill === 'incubate') return this.incubate(e);
  },

  /**
   * CONSCRIPTION, the human rite. The fallen return as a soldier drawn from
   * YOUR roster, at the mass of the corpse that paid for them.
   */
  conscript(e) {
    const killer = e.hostileTo;
    const S = this.sides[killer];
    const list = S.musterLoadout || [];
    if (!list.length) return;
    const P = this.corpseBudget(e);

    /* THE DEBT comes first. A clamped roll earlier in the match spawned more
       mass than its corpse was worth; until that is paid back, kills feed the
       ledger instead of the lane. This is what stops the clamp printing. */
    if (S.rollDebt > 0) {
      S.rollDebt -= P.hp;
      if (S.rollDebt < 0) S.rollDebt = 0;
      return;
    }

    /* Eligible = every unit whose shell the budget can fill without becoming
       either a husk or a pebble. Rolled uniformly -- the owner's rule -- and
       inside step(), so the seeded stream carries it. */
    const ok = [];
    for (const id of list) {
      const U = ENEMY_TYPES[id];
      if (!U) continue;
      const k = P.hp / U.hp;
      if (k >= HUMAN_ROLL_HPMUL_MIN && k <= HUMAN_ROLL_HPMUL_MAX) ok.push(id);
    }
    let pickId, hpMulBase;
    if (ok.length) {
      pickId = ok[Math.floor(Math.random() * ok.length)];
      hpMulBase = P.hp / ENEMY_TYPES[pickId].hp;
    } else {
      /* Nothing fits: take the lightest shell the roster has, clamp it, and
         BOOK the difference. Lightest because it is the cheapest lie. */
      pickId = list[0];
      for (const id of list)
        if (ENEMY_TYPES[id] && ENEMY_TYPES[id].hp < ENEMY_TYPES[pickId].hp) pickId = id;
      const U = ENEMY_TYPES[pickId];
      const raw = P.hp / U.hp;
      hpMulBase = clamp(raw, HUMAN_ROLL_HPMUL_MIN, HUMAN_ROLL_HPMUL_MAX);
      if (hpMulBase > raw) S.rollDebt += (hpMulBase - raw) * U.hp;
    }
    const base = ENEMY_TYPES[pickId];
    if (!base) return;

    /* One roll, marched at every live rival -- the doubled dead, same rule
       the machine rite obeys. The debt was charged once, above, per kill. */
    const vics = this.musterVictims(killer);
    for (const vic of vics) {
      const path = this.sendPathFor(killer, vic, base);
      if (!path) continue;
      let copies = 1;
      if (S.mods.doubleReanim > 0 && Math.random() < S.mods.doubleReanim) copies = 2;
      for (let i = 0; i < copies; i++) {
        this.pendingSpawns.push(new Enemy(base, path, {
          hpMul: hpMulBase * (1 - (this.sides[vic].traits.reanimResist || 0)),
          bountyMul: 1, speedMul: S.traits.reanimSpeed,
          armorFlat: P.armor,
          hostileTo: vic, owner: killer, reanimated: true,
          startDist: rand(0, 10), offset: rand(-8, 8)
        }));
        S.stats.sent++;
        if (S.traits.reanimGold) this.awardGold(killer, S.traits.reanimGold);
      }
    }
    if (vics.length && killer === this.viewSide) {
      Sound.play('reanimate');
      this.addFloater(e.x, e.y, '▸ ' + base.name.toUpperCase(), false, base.color, 12);
    }
  },

  /**
   * THE BROOD, the xeno rite. A kill does not march; it stays where it fell
   * and becomes something else. Kills near a clutch hurry it along, which is
   * the combo the whole faction is built to play.
   */
  incubate(e) {
    const killer = e.hostileTo;
    const S = this.sides[killer];
    const list = S.musterLoadout || [];
    if (!list.length) return;

    /* FEED FIRST, then lay. A kill beside a clutch is worth more than the
       clutch it would have started, and doing it in this order means the pod
       this kill creates cannot feed itself on its own creation. */
    let fed = false;
    for (const pod of this.incubators) {
      if (pod.side !== killer) continue;
      if (dist2(pod.x, pod.y, e.x, e.y) <= (XENO_INC_FEED_RADIUS * TILE) * (XENO_INC_FEED_RADIUS * TILE)) {
        pod.t -= XENO_INC_FEED_SEC; fed = true;
      }
    }

    let mine = 0;
    for (const pod of this.incubators) if (pod.side === killer) mine++;
    if (mine >= XENO_INC_CAP) {
      /* A full nest still rewards killing: a kill that had no clutch beside
         it feeds the nearest one board-wide instead, so nothing is wasted.
         Only when it fed NOTHING -- a kill next to a pod has already been
         paid, and paying it twice would make a full nest better than a
         working one, which is the opposite of a cap. */
      if (!fed) {
        let best = null, bestD = Infinity;
        for (const pod of this.incubators) {
          if (pod.side !== killer) continue;
          const d = dist2(pod.x, pod.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = pod; }
        }
        if (best) best.t -= XENO_INC_FEED_SEC;
      }
      return;
    }

    const P = this.corpseBudget(e);
    const lidx = Math.floor(Math.random() * list.length);
    const unitId = list[lidx];
    const U = ENEMY_TYPES[unitId];
    if (!U) return;
    /* The ROLLED unit sets the gestation, not the unit killed -- which is why
       the pod draws what it is becoming. That glyph is the tell. */
    const need = XENO_INC_BASE_SEC + XENO_INC_SQRT_SEC * Math.sqrt(U.hp);
    this.incubators.push({
      side: killer, x: e.x, y: e.y, unitId: unitId, lidx: lidx,
      powerHp: P.hp * XENO_INC_SHARE, armorFlat: P.armor,
      t: need, need: need
    });
    if (killer === this.viewSide) Sound.play('reanimate');
  },

  /** A clutch comes due: it hatches at every live rival, or dies unhatched. */
  hatchIncubator(pod) {
    const S = this.sides[pod.side];
    const base = ENEMY_TYPES[pod.unitId];
    if (!S || !base) return;
    const vics = this.musterVictims(pod.side);
    for (const vic of vics) {
      const path = this.sendPathFor(pod.side, vic, base);
      if (!path) continue;
      let copies = 1;
      if (S.mods.doubleReanim > 0 && Math.random() < S.mods.doubleReanim) copies = 2;
      /* IT HATCHES WHERE IT INCUBATED. `startDist` is distance ALONG the send
         path, and this used to pass rand(0,10) -- the path's very beginning --
         so every hatchling walked out of the base while the pod's burst, its
         floater and its glyph all played at the kill site. The owner saw
         exactly that: the clutch appears where the body fell and the creature
         appears at home.
         Projecting the pod onto the path with nearestDist is the fix: the
         hatchling enters the lane at the point closest to its own clutch. A
         FLYING unit keeps the old behaviour on purpose -- it does not walk the
         lane, so the path point it would inherit is meaningless and launching
         from the base is the honest reading (and the owner said as much). */
      const proj = base.flying ? null : path.nearestDist(pod.x, pod.y);
      /* `total`, not `length` -- Path has no `length`, and reading it would give
         undefined, clamp the ceiling to NaN and put every hatchling straight
         back at the base, which is the exact bug this replaces. */
      const enterAt = proj ? clamp(proj.dist, 0, Math.max(0, path.total - TILE)) : rand(0, 10);
      for (let i = 0; i < copies; i++) {
        this.pendingSpawns.push(new Enemy(base, path, {
          hpMul: (pod.powerHp / base.hp) * (1 - (this.sides[vic].traits.reanimResist || 0)),
          bountyMul: 1, speedMul: S.traits.reanimSpeed,
          armorFlat: pod.armorFlat,
          hostileTo: vic, owner: pod.side, reanimated: true,
          startDist: enterAt, offset: rand(-8, 8)
        }));
        S.stats.sent++;
        if (S.traits.reanimGold) this.awardGold(pod.side, S.traits.reanimGold);
      }
    }
    if (pod.side === this.viewSide) {
      this.spawnBurst(pod.x, pod.y, 14, base.color, 120);
      this.addFloater(pod.x, pod.y, 'HATCHED · ' + base.name.toUpperCase(), false, base.color, 12);
      Sound.play('reanimate');
    }
  },

  /**
   * THE PROCESSION, the Federation's clock. Ticked from step(), never from
   * draw(): a rite that fires on a frame rate is a rite two clients disagree
   * about.
   */
  tickProcession(dt) {
    if (this.noReanim) return;
    for (const S of this.sides) {
      if (!this.doctrineOf(S.index).scheduler) continue;
      if (!S.alive || S.defeated) continue;
      /* THE PROCESSION DOES NOT KEEP OFFICE HOURS. This used to read
         `!this.waveRunning || ...`, and the `S.procTimer -= dt` below sits
         AFTER the gate -- so the clock did not merely pause between waves, it
         did not TICK. The prep window is the longest quiet stretch in a
         battle, so most of the nine-second cadence was spent not counting, and
         the march arrived roughly once per wave instead of "constantly", which
         is what the owner reported. The wave gate stays: the rite still opens
         on FOL_START_WAVE. */
      if (this.wave < FOL_START_WAVE) continue;
      S.procTimer -= dt;
      if (S.procTimer > 0) continue;
      const list = S.musterLoadout || [];
      if (!list.length) { S.procTimer = FOL_CADENCE_SEC; continue; }
      const vics = this.musterVictims(S.index);
      const base = ENEMY_TYPES[list[S.procIdx % list.length]];
      if (base && vics.length) {
        const count = Math.min(1 + S.procCycle, FOL_CYCLE_COUNT_CAP);
        for (const vic of vics) {
          const path = this.sendPathFor(S.index, vic, base);
          if (!path) continue;
          for (let n = 0; n < count; n++) {
            let copies = 1;
            if (S.mods.doubleReanim > 0 && Math.random() < S.mods.doubleReanim) copies = 2;
            for (let i = 0; i < copies; i++) {
              this.pendingSpawns.push(new Enemy(base, path, {
                /* Through the same funnel a bought send uses, at a steeper
                   damp -- nobody paid for these. No reanimGold: there is no
                   corpse, and paying a per-corpse bounty on a clock prints. */
                hpMul: this.musterHpMul(S.index, vic, PROCESSION_DAMP),
                bountyMul: 1, speedMul: S.traits.reanimSpeed,
                armorFlat: (base.armor + this.drift.armor) * PROCESSION_DAMP,
                hostileTo: vic, owner: S.index, reanimated: true,
                startDist: rand(0, 10), offset: rand(-8, 8)
              }));
              S.stats.sent++;
            }
          }
        }
        if (S.index === this.viewSide) Sound.play('reanimate');
      }
      /* Advance the march. A full lap makes every entry heavier -- the
         owner's compounding -- and stretches the period, which is what keeps
         mass-per-minute linear instead of exponential. */
      S.procIdx = (S.procIdx + 1) % list.length;
      if (S.procIdx === 0) {
        S.procCycle++;
        if (S.index === this.viewSide)
          this.addFloater(this.width * 0.5, 108, 'THE PROCESSION SWELLS · ×' + Math.min(1 + S.procCycle, FOL_CYCLE_COUNT_CAP),
                          false, FACTIONS.light.color, 16);
      }
      S.procTimer = FOL_CADENCE_SEC + S.procCycle * FOL_CADENCE_GROWTH;
    }
  },

  /**
   * THE SPLICE, the Parallel's survey rig, and the one mechanic that edits
   * the board itself.
   *
   * The detour is DERIVED rather than authored per map: it enters the
   * victim's half at the spawn edge on the opposite flank, runs to the
   * column where the real lane already is, and REJOINS it partway along. Two
   * properties fall out of that construction for free on every map, which is
   * why it is built this way rather than hand-drawn fifteen times: it always
   * reaches the base (it is the authored lane from the join onward), and only
   * the new prefix can ever add blocked tiles.
   */
  spliceWaypoints(side) {
    const raw = FIELD.lanes && FIELD.lanes[side] && FIELD.lanes[side][0];
    if (!raw || raw.length < 3 || FIELD.radial) return null;
    const j = Math.max(1, Math.min(raw.length - 2, Math.round(raw.length * 0.45)));
    const entry = raw[0], join = raw[j];
    /* Toward whichever flank has room. Mirroring across the midline was the
       obvious rule and the wrong one: most lanes enter dead centre, so the
       mirror of the entry is the entry and there is no detour at all. */
    const k = Math.max(2, Math.round(FIELD.rows * 0.35));
    const y2 = (entry[1] * 2 < FIELD.rows)
      ? Math.min(FIELD.rows - 2, entry[1] + k)
      : Math.max(1, entry[1] - k);
    if (Math.abs(y2 - entry[1]) < 2) return null;
    /* Axis-aligned throughout: out to the flank, along it to the join
       column, then the authored lane the rest of the way home. */
    return [[entry[0], y2], [join[0], y2]].concat(raw.slice(j));
  },

  /** Cut the lane. Wave-aligned: it opens now and closes at a wave boundary,
      because startWave enumerates a wave's spawn entries per lane exactly
      once -- an expiry mid-wave would strand everything already queued. */
  openSplice(victim, waves) {
    const S = this.sides[victim];
    if (!S || S.defeated) return false;
    const cur = this.spliceState[victim];
    if (cur) { cur.wavesLeft = Math.max(cur.wavesLeft, waves); return true; }
    const wp = this.spliceWaypoints(victim);
    if (!wp) return false;
    const path = new Path(wp);
    this.lanes[victim].push(path);
    /* Only tiles that were not ALREADY blocked are recorded, so closing the
       splice can never un-block a tile that belongs to the real lane or to
       the map's own scenery. */
    const added = [];
    for (const k of path.blockedTiles()) {
      if (!this.blocked.has(k)) { this.blocked.add(k); this.laneBlocked.add(k); added.push(k); }
    }
    this.spliceState[victim] = { wavesLeft: waves, laneIdx: this.lanes[victim].length - 1, added };
    this.renderBackground();
    if (victim === this.viewSide) {
      this.banner('LANE SPLICED · THE BOARD FORKS', 2.6, '#e2e8f0');
      Sound.play('wallBreak');
    }
    return true;
  },

  /** Close it and hand the ground back. Towers built on spliced tiles are
      GRANDFATHERED -- they were legal when they were placed, they keep
      firing throughout, and nothing is refunded or torn down. */
  closeSplice(victim) {
    const st = this.spliceState[victim];
    if (!st) return;
    for (const k of st.added) { this.blocked.delete(k); this.laneBlocked.delete(k); }
    const lanes = this.lanes[victim];
    if (lanes.length > st.laneIdx) lanes.splice(st.laneIdx, 1);
    this.spliceState[victim] = null;
    this.renderBackground();
    if (victim === this.viewSide) this.addFloater(this.width * 0.5, 128, 'SPLICE COLLAPSED', false, '#e2e8f0', 15);
  },

  /**
   * THE RELAY NETWORK. Nodes burn down, and every Parallel body walking the
   * board they were left on spends the strongest one in reach.
   *
   * Non-stacking by construction: a body reads the single best node rather
   * than summing them, so a corridor of six is a road and not a runway. The
   * buff is re-applied from scratch each tick rather than accumulated, which
   * is why leaving the radius takes it straight back off.
   */
  tickRelays(dt) {
    const nodes = this.relayNodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      nodes[i].t -= dt;
      if (nodes[i].t <= 0) nodes.splice(i, 1);
    }
    /* NO EARLY RETURN ON AN EMPTY LIST, and that is the fix. There used to be
       one here, which meant the frame the LAST node expired was the frame the
       removal pass below never ran -- so every body still standing in that
       node's radius kept its speed and armour for the rest of the match, with
       no relay left on the board to explain it. A node lives six seconds
       against a march measured in tens, so the last node dying under a
       walking body is the common case, not the corner. With the list empty
       `best` is 0 for everyone and the toggle takes the buff back off, which
       is exactly what the docstring below has always claimed happens. */
    const r2 = (UNIT_RELAY_RADIUS * TILE) * (UNIT_RELAY_RADIUS * TILE);
    for (const e of this.enemies) {
      if (e.dead || e.leaked || !e.reanimated || e.owner === undefined || e.owner < 0) continue;
      if (!e.def || e.def.faction !== 'robot') continue;
      let best = 0;
      for (const n of nodes) {
        /* Same owner AND same board: a node the Parallel left on one rival's
           lane is worth nothing on another's. */
        if (n.owner !== e.owner || n.board !== e.hostileTo) continue;
        if (dist2(n.x, n.y, e.x, e.y) > r2) continue;
        if (n.t > best) best = n.t;
      }
      const on = best > 0;
      if (on === !!e._relayed) continue;
      /* `baseSpeed`, NOT `speedMul`: the latter is a constructor option the
         Enemy copies once and never reads again, so writing it live would be
         a silent no-op of the Tower.jammed class. Toggled symmetrically and
         only on a CHANGE of state, so it cannot compound frame to frame. */
      e._relayed = on;
      if (on) { e.baseSpeed *= (1 + UNIT_RELAY_SPEED); e.armor += UNIT_RELAY_ARMOR; }
      else { e.baseSpeed /= (1 + UNIT_RELAY_SPEED); e.armor -= UNIT_RELAY_ARMOR; }
    }
  },

  /** Clutches come due. Same step window as everything else that spawns. */
  tickIncubators(dt) {
    for (let i = this.incubators.length - 1; i >= 0; i--) {
      const pod = this.incubators[i];
      const S = this.sides[pod.side];
      if (!S || S.defeated || !S.alive) { this.incubators.splice(i, 1); continue; }
      pod.t -= dt;
      if (pod.t > 0) continue;
      this.hatchIncubator(pod);
      this.incubators.splice(i, 1);
    }
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
    const kl = S.killLog[e.type] || (S.killLog[e.type] = { n: 0, bounty: 0 });
    kl.n++; kl.bounty += bounty;

    /* THE RECOVERY, and what it is NOT.
       Killing a carrier PREVENTS a loss; it does not repay one, because
       nothing was taken. Reaching the seat spends no lives at all -- that is
       the whole carrier design (entities.js: "only walking off that edge
       makes the loss real") and the HUD says so, printing lives IN FLIGHT as
       `12 (3⚑)` rather than deducting them.
       This used to call restoreLife here, which HEALED the robbed seat by
       the full livesCost. Measured: a side on 12 of 30 let one Gantry reach
       the seat and killed it on the way out, and came away with 15 -- three
       lives it had never lost. It made deliberately leaking and then killing
       strictly better than killing early, which inverts the entire point of
       a defence. The theft is now simply averted.
       The early return below is still the value gate: no vault skim, no
       transmutation, no contagion, no split walking your lane again --
       bounty was zeroed at conversion, so the award above was a no-op.
       `reanimated` was set at conversion too, so the generic gate at the
       bottom of this funnel can never fire for a carrier: the doctrine call
       here is the only summon it gets, and only when carrierFresh says the
       corpse never marched before. */
    if (e.carrier) {
      /* Counted, never logged: a recovered theft belongs on the defeat screen
         as the COUNTERPLAY line, not as a row in WHAT KILLED YOU -- it cost
         this side nothing at all. stats.livesRestored cannot stand in for it:
         menders, the Custodian and waveHeal all write there too, and
         restoreLife returns early at full lives, so it under-counts exactly
         the case worth teaching. `killer` is `e.hostileTo`, so S is the robbed
         seat and a rival's recovery books against the rival. */
      S.stats.leaksRecovered++;
      if (e.carrierFresh && !this.noReanim) this.doctrineOnKill(e);
      if (killer === this.viewSide) this.spawnBurst(e.x, e.y, 12, '#f87171', 110);
      return;
    }

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
    if (e.deathHeal && !e.nulled) {
      const r2 = (2.6 * TILE) ** 2;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.hostileTo !== e.hostileTo || o.nulled) continue;
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

    /* Reanimation, but a reanimated unit can never be reanimated again, and
       inside THE MAELSTROM nothing reanimates at all. The gate is the ARENA's
       (`noReanim` comes off the field), not a side's: killing an attacker in
       the arena leaves you nothing to send, for every seat equally. What you
       send you buy, and every reanimation bonus you own still rides it --
       Game.muster applies mods.reanim, doubleReanim, traits.reanimSpeed and
       traits.reanimGold exactly as it does anywhere else. */
    if (!e.reanimated && !this.noReanim) this.doctrineOnKill(e);
  },

  /* ============================================================= HELPERS */

  /** Paths carrying units hostile to `side`, its lanes plus incoming reanimates. */
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

  shake(a) { if (motionReduced()) return; this.shakeAmt = Math.min(9, this.shakeAmt + a * 0.55); },
  banner(text, dur = 2, color = '#e6f5ff') {
    this.bannerText = text; this.bannerTimer = dur; this.bannerMax = dur; this.bannerColor = color;
  },

  spawnParticle(x, y, vx, vy, life, size, color, kind = 'spark') {
    if (motionReduced()) return;
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
    if (motionReduced()) return;
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.32, maxLife: 0.32, size: radius, color, kind: 'shock' });
    const n = Math.min(26, Math.round(radius / 3));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, radius * 3.2);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.24, 0.55), rand(2, 5), Math.random() < 0.45 ? '#ffd166' : color, 'fire');
    }
  },
  /** Inward-collapsing ring, the Singularity's signature. */
  spawnImplosion(x, y, radius, color) {
    if (motionReduced()) return;
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
      hold, or at its own base. */
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
    if (!this.canClear(side, gx, gy)) {
      /* canClear refuses for two DIFFERENT reasons and only one of them is
         about the tile. A land card's free demolitions come out of this same
         allowance and can spend the last of it while the rubble is still
         standing and still selectable, so "nothing to demolish" would be a lie
         at exactly the moment the player is most confused about why DEMOLISH
         stopped working. */
      if (side === this.viewSide) UI.denied(S && S.cleared.size >= this.clearLimit(side)
        ? 'No clearances left, ' + this.clearLimit(side) + ' is the allowance for this battle'
        : 'Nothing to demolish there: authored rubble on your own ground only, never the lane', false);
      return false;
    }
    const cost = this.clearCostNow(side);
    if (S.gold < cost) {
      if (side === this.viewSide) UI.denied('DEMOLISH needs ◈' + formatNum(cost));
      return false;
    }
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
       on a Tower, all 18 writers are enemies, projectiles or constructs, so
       the old guard was vestigial and a sold tower could still be relocated,
       charged for, and re-selected. Being in its side's list is the only
       honest test of whether a tower is still on the board. */
    if (!S || S.towers.indexOf(t) < 0) return false;
    /* The destination rectangle is tested with the mover EXCLUDED, so a heavy
       may shuffle one tile across its own current footprint -- the tiles it
       stands on are the tiles it is about to vacate. */
    if (!this.canBuild(t.side, gx, gy, t.foot || 1, t)) {
      /* The same split build() makes: a heavy that cannot set down because its
         2x2 overlaps something is not a closed tile. The mover is excluded
         from both tests, so its own footprint can never read as the obstacle
         in the sentence explaining why it may not move. */
      if (t.side === this.viewSide) UI.denied((t.foot || 1) > 1 && this.canBuild(t.side, gx, gy, 1, t)
        ? t.def.name + ' needs a clear ' + t.foot + '×' + t.foot + ' block to set down'
        : 'Cannot set down there: that ground is a lane, rubble, not yours, or already built on', false);
      return false;
    }
    const fee = this.relocateCost(t);
    if (S.gold < fee) {
      if (t.side === this.viewSide) UI.denied('Moving ' + t.def.name + ' costs ◈' + formatNum(fee));
      return false;
    }
    S.gold -= fee;
    t.gx = gx; t.gy = gy;
    t.x = (gx + (t.foot || 1) / 2) * TILE;
    t.y = (gy + (t.foot || 1) / 2) * TILE;
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

  addFloater(x, y, text, crit = false, color = null, size = null, dmg = false) {
    /* THE JITTER IS DRAWN BEFORE THE GATE, ALWAYS. rand() here is the SIM
       stream -- Net swaps Math.random per tick -- so a floater the player
       switched off must still cost the same draw, or two clients running the
       same seed with different display settings would part company inside a
       wave. Same law spawnBurst obeys: it draws every value itself and hands
       them to a spawnParticle that may discard them. A presentation toggle
       may never be visible to the simulation. */
    const jx = x + rand(-5, 5);
    if (dmg && !damageNumbersOn()) return;
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({ x: jx, y,
      text: typeof text === 'number' ? formatNum(text) : text,
      life: crit ? 1.0 : 0.7, maxLife: crit ? 1.0 : 0.7,
      color: color || (crit ? '#ffffff' : '#ffe9a8'),
      size: size || (crit ? 18 : 11), vy: crit ? -36 : -26 });
  },

  /* ================================================================ LOOP */

  /**
   * THE FRAME. It must never be possible for this to be the LAST one.
   *
   * Everything below used to run bare, and the `requestAnimationFrame` that
   * keeps the game alive sits at the BOTTOM of it. So a single throw anywhere
   * in step() or draw() -- one undefined field on one entity, on one frame --
   * skipped the reschedule and the loop simply stopped. The board froze
   * mid-wave with no error visible to the player, the HUD kept accepting
   * clicks, and the pause button toggled a flag nothing was left to read:
   * "it randomly freezes" and "pause will not un-pause" are the same defect
   * wearing two faces.
   *
   * `finally` is the whole fix: the next frame is booked before anything can
   * decide not to book it. What is NOT done here is swallowing the error --
   * this project's signature defect is a catch that hides the thing it caught,
   * so the throw is reported once per distinct message, parked on
   * `Game.loopErrors` for the sweep to read, and the frame is abandoned rather
   * than half-run.
   */
  loop(ts) {
    let rescheduled = false;
    try {
      this.frame(ts);
    } catch (e) {
      this.recordLoopError(e);
    } finally {
      /* Booked LAST and unconditionally. A second guard in case `frame` itself
         somehow schedules -- two rAFs racing would double the game speed. */
      if (!rescheduled) requestAnimationFrame(t => this.loop(t));
    }
  },

  /** Every distinct failure once, with a count, so a per-frame throw cannot
      flood the console into uselessness -- and so the sweep has something to
      assert against. */
  recordLoopError(e) {
    const msg = (e && e.message) || String(e);
    this.loopErrors = this.loopErrors || {};
    const first = !this.loopErrors[msg];
    this.loopErrors[msg] = (this.loopErrors[msg] || 0) + 1;
    if (first) {
      console.error('FRAME THREW (the loop survived it; the frame did not): ' + msg,
                    (e && e.stack) || '');
    }
  },

  frame(ts) {
    const dtReal = Math.min(0.1, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;
    /* In the menu the canvas is hidden, yet this loop kept simulating particles
       and DRAWING the finished battle's full entity set every frame -- which is
       why menus grew sluggish after long sessions and snapped back the moment a
       new match cleared the arrays. Idle completely instead. */
    if (this.state === 'menu') return;
    if (this.state === 'playing' && !this.paused) {
      this.acc += dtReal * this.speed;
      let steps = 0;
      /* THE GATE IS RE-READ EVERY PASS, and that is the whole point. A step can
         halt the board from the inside -- onWaveSpawned hands the rival its
         draft, and in a duel that brain is Net.pendDraft, which sets state to
         'choosing' from inside step() -- and reading `state` once before the
         loop let the rest of the frame's batch run straight past the halt. At
         speed 2 or 3 almost every frame carries two or three steps, and the two
         windows' frame phases are independent, so which step of the batch the
         wave-5 draft landed on was a coin flip per client: one board ran a tick
         with the drafted mod live that the other ran without it, and applyOob
         then seeded its tie-breaks off two different tick numbers. The same
         read stops a batch simulating past the tick endMatch resolved on. */
      while (this.acc >= STEP && steps < MAX_STEPS &&
             this.state === 'playing' && !this.paused) { this.step(STEP); this.acc -= STEP; steps++; }
      /* A batch cut short by a halt leaves time in the accumulator. The branch
         below spends it on the next frame, so answering a draft never hands
         the board back fast-forwarded. */
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
    /* No reschedule here: `loop` books the next frame in a finally, so this
       function is free to throw without taking the game down with it. */
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
    this.checkSurviveWin();

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

    /* --- the summoning rites ---
       Both live in step, never in draw: a clutch that hatched on a frame rate
       would hatch at different moments on two clients running one seed. */
    this.tickProcession(dt);
    this.tickIncubators(dt);
    this.tickRelays(dt);

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

    this.resolveMelee(dt);

    /* --- delayed effects (cyclone drops, aftershocks) --- */
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      /* REPORTED, not swallowed. A delayed effect is a cyclone drop or an
         aftershock: real simulation work, on a real timer, inside step(). An
         empty catch here meant one could throw on every trigger forever while
         every gate stayed green, which is this project's named signature
         defect. recordLoopError is the buffer owner-sweep 22.12 already
         reads, so this needs no new machinery to become visible. */
      if (d.t <= 0) { this.delayed.splice(i, 1); try { d.fn(); } catch (e) { this.recordLoopError(e); } }
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
      /* NULL FIELD. A carrier's field is an ability, so nothing inside the
         null receives one. Resolved here rather than in the carrier loop
         below because auraDamp is already the single per-unit answer to "how
         much of a projected field reaches this body", and a second gate one
         loop down would be a second answer to the same question. */
      if (e.nulled) damp = 0;
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
      /* NULL FIELD gates BOTH ends: a mender standing in the field cannot
         work, and a body inside it cannot be worked on from outside. Either
         alone leaves a visible hole -- a mender parked at the edge healing
         into the null, or one inside it healing the column behind. */
      if (m.nulled) continue;
      const r2 = (m.def.healRadius * TILE) ** 2;
      for (const e of this.enemies) {
        if (e === m || e.dead || e.hp >= e.maxHp || e.hostileTo !== m.hostileTo) continue;
        if (e.nulled) continue;
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
    /* WHAT KILLED YOU, part one: WHO was in this frame's charge. The manifest
       is gathered here and BOOKED in loseLives, so the log and the ledger add
       up to the same number.
       `cost` below is the FINAL figure -- the Shield Wall reduction is
       applied right here and nowhere else. This note used to say the opposite
       ("still one Shield Wall reduction short of what the seat actually
       pays"), which was the description of the double-discount bug rather
       than of the code, and an open invitation to reintroduce it. Lazy
       arrays: most frames breach nothing. */
    const breaches = this.sides.map(() => null);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.killEnemy(e); this.enemies.splice(i, 1); }
      else if (e.leaked) {
        /* A defensive ability that weakens attackers also blunts what a leak
           costs, and VESS-style traits shave one life off every breach. */
        const cost = this.leakCostOf(e);
        leaked[e.hostileTo] += cost;
        /* `carrierFresh` is false exactly when the body was a reanimate or a
           bought detachment BEFORE it turned around, so it is the only honest
           read of "your rival sent this one" left: becomeCarrier sets
           `reanimated` on every carrier, fresh or not. */
        (breaches[e.hostileTo] || (breaches[e.hostileTo] = []))
          .push({ type: e.type, cost: cost, sent: e.carrierFresh === false });
        this.enemies.splice(i, 1);
      }
    }
    for (let s = 0; s < this.sides.length; s++) if (leaked[s] > 0) this.loseLives(s, leaked[s], breaches[s]);

    if (this.pendingSpawns.length) {
      for (const e of this.pendingSpawns) this.enemies.push(e);
      this.pendingSpawns.length = 0;
    }

    this.updateParticles(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);

    this.uiTick = (this.uiTick || 0) + dt;
    /* THE HUD IS CALLED FROM INSIDE THE SIMULATION, and it is the one thing in
       here that touches the DOM. A throw anywhere under UI.syncLive used to
       leave step() by this line -- which skipped `this.acc -= STEP` in the
       batch above, aborted the rest of the frame, and never reached draw().
       Two clients whose HUDs threw on different frames then disagreed about
       the accumulator, so this guard is a determinism fix as much as a
       robustness one. Reported once per distinct message, never swallowed. */
    if (this.uiTick > 0.12) {
      this.uiTick = 0;
      try { UI.syncLive(); } catch (e) { this.recordLoopError(e); }
    }
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
        let neutral = FIELD.ownerGrid
          ? FIELD.ownerGrid[gy][gx] === -1
          : (gx >= FIELD.neutral.from && gx <= FIELD.neutral.to);
        let side = FIELD.ownerGrid
          ? FIELD.ownerGrid[gy][gx]
          : (gx <= FIELD.buildMax[0] ? 0 : gx >= FIELD.buildMax[1] ? 1 : -1);
        /* NO ENEMY SIDE TO OWN GROUND. buildField still mirrors the far half's
           terrain (rubble and nodes stay authored ground the swarm walks
           through), but painting it in the rival's tint told the player a
           commander held it. On a solo board every tile that is not yours is
           unclaimed, read exactly like the corridor already reads. */
        if (this.soloSurvive && side === 1) { side = -1; neutral = true; }
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

    /* Impassable terrain, rubble that removes build space entirely. */
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
       the singularity is drawn over it every frame. Not a thing a solo board
       has either: the band marks a DMZ between two commanders, and a swarm
       board has one commander and open ground. */
    if (!FIELD.radial && !this.soloSurvive) {
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

    /* base markers. Seat 1 stops here on a solo board: soloSeatCap is 1 while
       Game.sides.length is still 2 (the seat exists so the spawn/AI code
       every other loop already guards keeps working), so this is the one
       loop bound that changes rather than a new guard threaded through the
       whole function. */
    const soloSeatCap = this.soloSurvive ? 1 : this.sides.length;
    const bcol = this.sides.map((S2, i) => FACTIONS[S2.faction] ? FACTIONS[S2.faction].color : (i ? '#ff6b9d' : '#38e8ff'));
    for (let s = 0; s < soloSeatCap && s < FIELD.bases.length; s++) {
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
    /* THE CAMERA. At zoom 1 the camera is clamped to the origin and this
       reduces to exactly the transform above it -- which is the safety
       property the whole feature rests on: a player who never zooms is
       playing the board that shipped, pixel for pixel. Cleared in DEVICE
       space first, because a translated world transform no longer covers the
       whole backing store. */
    const z = this.camZoom();
    const c = this.camClamped();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k * z, 0, 0, k * z, -c.x * k * z, -c.y * k * z);
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
    this.drawIncubators(ctx);
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
      background, so this draws only what moves, and the horizon is drawn as
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
    if (!this.selectedType || !this.hover.active || !this.boardInteractive()) return;
    const def = TOWER_TYPES[this.selectedType];
    const foot = towerFoot(def);
    const { gx, gy } = this.hover;
    /* The hovered tile is the TOP-LEFT anchor; the ghost's centre -- range
       ring and chassis cube alike -- sits mid-rectangle, exactly where the
       built tower's x,y will land. */
    const cx = (gx + foot / 2) * TILE, cy = (gy + foot / 2) * TILE;
    /* THE SEAT IN FRONT OF THIS SCREEN, not seat 0. draw runs with Net's lens
       suspended so the canvas keeps true seat order, which means a literal 0
       here reached the engine as the REAL seat 0: the guest's ghost went green
       over the HOST's half of the board and red over their own, priced itself
       out of the host's purse, and drew the host's range mod. viewSide is the
       field that already means "me" on both clients -- net.js sets it to the
       local seat -- and it is a real index, so it needs no lens to be right. */
    const me = this.viewSide;
    const ok = this.canBuild(me, gx, gy, foot) && this.canAffordBuild(me, this.selectedType);
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(74,222,128,0.09)' : 'rgba(239,68,68,0.11)';
    ctx.strokeStyle = ok ? 'rgba(74,222,128,0.9)' : 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 2;
    /* A DEAD ZONE is drawn as an actual hole, not implied by a stat row. The
       fill is an annulus by even-odd, so the ground BOMBARD cannot cover is
       visibly not covered while you are still choosing where to put it --
       which is the only moment the information is worth anything. */
    const gRange = def.base.range * TILE * this.sides[me].mods.range;
    const gDead = (def.base.minRange || 0) * TILE;
    ctx.beginPath(); ctx.arc(cx, cy, gRange, 0, TAU);
    if (gDead > 0) ctx.arc(cx, cy, gDead, 0, TAU, true);
    ctx.fill('evenodd'); ctx.stroke();
    if (gDead > 0) {
      ctx.save();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(239,68,68,0.85)';
      ctx.beginPath(); ctx.arc(cx, cy, gDead, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([5, 5]); ctx.strokeRect(gx * TILE + 2, gy * TILE + 2, TILE * foot - 4, TILE * foot - 4); ctx.setLineDash([]);
    ctx.globalAlpha = 0.6; ctx.fillStyle = ok ? def.color : '#ef4444';
    ctx.beginPath(); ctx.roundRect(cx - 13 * foot, cy - 13 * foot, 26 * foot, 26 * foot, 5 * foot); ctx.fill();
    ctx.restore();
  },

  /** Ghost for an armed aimed ability: where the construct would land and
      whether the tile will take it. It deliberately mirrors the build ghost,
      because aiming should feel like placing, it is placing. */
  drawAimOverlay(ctx) {
    const def = this.aimedDef();
    if (!def || !this.hover.active || this.state !== 'playing') return;
    const { gx, gy } = this.hover;
    /* Suspended draw again: a literal 0 is the real seat 0, so the guest was
       told the HOST's lanes would take the wall. See drawBuildOverlay. */
    const me = this.viewSide;
    const ok = this.canAim(me, gx, gy, def);
    const anchor = (ok && def.lane) ? this.laneAnchor(me, gx, gy) : null;
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
    /* Live minRange, so the ring shrinks the moment ROLLING CARRIAGE lands. */
    const dead = (t.stats.minRange || 0) * TILE;
    if (dead > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(t.x, t.y, dead, 0, TAU); ctx.stroke();
      ctx.strokeStyle = t.def.color;
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.09; ctx.fillStyle = t.def.color;
    if (dead > 0) {
      ctx.beginPath(); ctx.arc(t.x, t.y, t.rangePx, 0, TAU);
      ctx.arc(t.x, t.y, dead, 0, TAU, true);
      ctx.fill('evenodd');
    } else ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeRect(t.gx * TILE + 2, t.gy * TILE + 2, TILE * (t.foot || 1) - 4, TILE * (t.foot || 1) - 4);
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

  /**
   * THE CLUTCHES on the board. Read-only and RANDOM-FREE: this runs in draw,
   * which is frame-rate dependent, so a single rand() here would make two
   * clients running one seed disagree. The pulse phase is derived from the
   * pod's own position instead, which is stable, per-pod and free.
   *
   * Only the viewing seat's clutches are drawn -- a rival's nest is not your
   * information, and the pod sitting on their half would read as yours.
   */
  drawIncubators(ctx) {
    if (!this.incubators.length) return;
    for (const pod of this.incubators) {
      if (pod.side !== this.viewSide) continue;
      const def = ENEMY_TYPES[pod.unitId];
      const col = (def && def.color) || '#a855f7';
      const frac = clamp(1 - pod.t / Math.max(0.001, pod.need), 0, 1);
      /* Position IS the seed. Same pod, same phase, every frame and every
         client, with no state to carry and nothing to desync. */
      const phase = (pod.x * 0.37 + pod.y * 0.61);
      const pulse = motionReduced() ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 2.2 + phase);
      const r = 9 + 3 * frac;
      ctx.save();
      ctx.globalAlpha = 0.20 + 0.16 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pod.x, pod.y, r + 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pod.x, pod.y, r, 0, TAU); ctx.stroke();
      /* THE TELL: the glyph of what it is becoming, so a player can plan
         around the clutch instead of being surprised by it. */
      if (def && def.shape) {
        ctx.globalAlpha = 0.5 + 0.3 * frac;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(pod.x, pod.y, 3.2, 0, TAU); ctx.fill();
      }
      /* The gestation arc, filling clockwise from twelve. */
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pod.x, pod.y, r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
      ctx.restore();
    }
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
      /* useAbility only raises fxRing behind `side.index === game.viewSide`
         (abilities.js), so the ring belongs to the local commander and has to
         radiate from the local commander's base. Seat 0's base threw the
         guest's every unaimed ability out of the opponent's ground. */
      const b = FIELD.bases[this.viewSide];
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
    /* Same solo cap as the base-marker loop above: a ♥ N / RIVAL pip floating
       over a seat with no commander is the same defect as the base ring. */
    const soloSeatCap2 = this.soloSurvive ? 1 : this.sides.length;
    for (let s = 0; s < soloSeatCap2 && s < FIELD.bases.length; s++) {
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
    /* THE EXACT INVERSE of the draw transform, and it has to stay that way:
       the one time these two disagreed the field rendered cropped and every
       pointer coordinate was offset. At zoom 1 the camera is the origin and
       both terms below vanish, leaving the plain element-rect ratio this
       always was. */
    const z = this.camZoom();
    const c = this.camClamped();
    /* THE SAME ZERO-SIZED RECT the drag handler guards against: a hidden or
       mid-layout canvas measures 0, and `width / 0` is Infinity. A non-finite
       board coordinate reaches Game.hover and every build/aim gate that reads
       it, so it is refused here rather than propagated. */
    if (!(r.width > 0) || !(r.height > 0)) return { x: c.x, y: c.y };
    /* 1 / (viewScale * z) IS the inverse of the draw transform's scale, and it
       is what `this.width / r.width / z` silently meant back when the rect was
       always the board times viewScale. Under a cover fit it is not, so the
       conversion is written as what it actually is. */
    const inv = 1 / (this.viewScale * z);
    return { x: c.x + (evt.clientX - r.left) * inv,
             y: c.y + (evt.clientY - r.top) * inv };
  },

  pointerToGrid(evt) {
    const p = this.pointerToBoard(evt);
    return { gx: Math.floor(p.x / TILE), gy: Math.floor(p.y / TILE) };
  },

  /* ====================================================== RADIAL PLACEMENT */

  /**
   * Value-per-gold of putting `type` on this tile, in the units
   * AI.bestAction already scores a build in, the same effectiveness,
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
      /* Coverage gates everything, a great tower on a dead tile is dead. */
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
    /* NO VECTOR AT ALL is the normal case now, not a degenerate one: the ring
       opens on a TAP, which has an origin and no direction. Aim the leader
       straight UP so the fan is the same every time and reads as a menu
       rather than as a compass; items alternate either side of it from
       there. This used to return 0 (due east) back when only a drag could
       open the ring and a zero vector meant something had gone wrong. */
    if (len < 1e-6) return -Math.PI / 2;
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
      /* A heavy needs its whole rectangle from THIS anchor tile. A ring that
         offered it over ground it cannot take would refuse at release --
         which reads as a bug -- so it is greyed instead, with the reason
         printed on hover exactly like an unpayable price. */
      fits: this.canBuild(0, gx, gy, towerFoot(TOWER_TYPES[type])),
      cost: this.towerCost(0, type),
      value: this.radialValue(scorer, type, gx, gy, prof)
    }));

    /* SMART ORDER: what you can afford leads, and inside each group the best
       value-per-gold leads. The ORDER is frozen here on purpose, gold moves
       every time something dies, and a ring that re-sorted under the player's
       thumb would build the tower they had stopped pointing at. Only the
       order is frozen: the prices and the greying are re-read every frame,
       and Game.build re-checks the purse at release, so a stale order can
       never let an unpayable build through. */
    /* Through canAffordBuild, not `S.gold >= cost`, so the ring can order a
       life-priced tower by whether it is actually payable. */
    for (const it of items) it.afford = it.fits && this.canAffordBuild(0, it.type);
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
   * Release. Builds through Game.build, the same call the shop makes, so
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

  /** The tower's REAL sprite, painted once per type through UI.towerStub
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
    if (!this.boardInteractive()) { this.radial = null; return; }

    /* Every price on the ring is asked of Game.towerCost on the frame it is
       drawn. A number cached at open would be a number the build no longer
       charges the moment anything on the board changed, which is the one
       desync this codebase keeps re-shipping. */
    /* Asked FOR THE VIEWER. openRadial runs on the input path with the lens
       on, where 0 already means the local seat; drawRadial runs inside the
       suspended draw, where 0 means seat 0 -- so the ring a guest opened on
       their own ground quoted the host's prices and greyed against the host's
       purse, every frame, on the most common action in the game. */
    const me = this.viewSide;
    for (const it of r.items) {
      it.cost = this.towerCost(me, it.type);
      it.life = this.towerLifeCost(me, it.type);
      it.fits = this.canBuild(me, r.gx, r.gy, towerFoot(TOWER_TYPES[it.type]));
      it.afford = it.fits && this.canAffordBuild(me, it.type);
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

    /* The tile the build lands on, and, when the ring slid inboard off an
       edge, the stalk that says the two are the same decision. */
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
      /* THE PRICE IN ITS OWN CURRENCY. A life-priced tower quotes ♥ and its
         life figure; quoting the ◈0 that towerCost truthfully returns would
         read as free, which is the one thing this purchase is not. */
      ctx.fillStyle = it.life ? (it.afford ? '#fca5a5' : '#7f1d1d')
                              : (it.afford ? '#e6f5ff' : '#94a3b8');
      ctx.fillText(it.life ? '♥' + it.life : '◈' + it.cost, ix, iy + iconR + 12);
    }

    /* Only the armed choice is named, in the middle. Five labels around a
       ring is the clutter that makes a pie menu unreadable. */
    if (r.hover >= 0) {
      const it = r.items[r.hover];
      ctx.font = 'bold 13px ui-monospace, Consolas, monospace';
      ctx.fillStyle = it.afford ? TOWER_TYPES[it.type].color : '#f87171';
      const refusal = !it.fits ? 'NO ROOM (2×2)' : it.life ? 'NOT ENOUGH LIVES' : 'NOT ENOUGH GOLD';
      ctx.fillText(it.afford ? TOWER_TYPES[it.type].name : refusal,
                   r.mx, r.my - TILE * 0.95);
    }
    ctx.restore();
  },

  /* ================================================== THE BATTLE CAMERA ==
     The board has always been fitted whole to the window, which is right for
     reading it and wrong for being in it. Zoom is OPT-IN and the identity
     case is exact: at zoom 1 the camera clamps to the origin, the draw
     transform reduces to the fitted one, and pointerToBoard reduces to the
     plain element-rect ratio it always was.

     Every gesture is one nothing else already owns: the wheel, the middle
     button, the arrow keys and 0. Left-drag belongs to the radial build ring
     and right-click to cancel, and neither is touched. */
  cam: { x: 0, y: 0, z: 1 },
  /**
   * THE CAMERA IS NAN-PROOF AT ITS BOUNDARY, and it has to be, because
   * `clamp` is not: `clamp = (v,a,b) => v < a ? a : (v > b ? b : v)` returns
   * NaN unchanged, since NaN compares false against everything. So a single
   * non-finite value reaching cam.x stayed there for the rest of the match --
   * no later pan, zoom or clamp could wash it out -- and every frame after it
   * built its transform from NaN. `ctx.setTransform` silently IGNORES a
   * non-finite matrix, so the board simply stopped moving on screen while the
   * simulation carried on underneath: the game "froze" with no error.
   *
   * One value could produce it. The drag handler divides by
   * `getBoundingClientRect().width`, which is 0 whenever the canvas is hidden
   * or mid-layout -- a screen switch, an immersive-mode toggle, a resize --
   * and `0 * (width / 0)` is `0 * Infinity`, which is NaN.
   *
   * `fin` is the whole guard: anything not finite falls back rather than
   * propagating. Deliberately NOT a change to `clamp` itself, which the
   * simulation uses everywhere and which must keep behaving exactly as the
   * balance pins measured it.
   */
  /** How far out the camera may pull: exactly far enough to show the whole
      board, and no further. Outside immersive viewScale IS fitScale, so this
      is 1 and the clamp is the one that always shipped. */
  camMinZoom() {
    if (!(this.fitScale > 0) || !(this.viewScale > 0)) return 1;
    /* ZOOM_OUT_EXTRA widens the floor past the exact whole-board view, so
       pulling back buys real margin around the field: the larger FOV the
       owner asked for, with the surplus centred by camClamped. */
    return Math.min(1, (this.fitScale / this.viewScale) * ZOOM_OUT_EXTRA);
  },
  camZoom() { return clamp(fin((this.cam && this.cam.z), 1), this.camMinZoom(), BATTLE_ZOOM_MAX); },
  /** The camera's top-left in world pixels, clamped so the view can never
      leave the board. At zoom 1 the view IS the board, so this is the
      origin and the transform above collapses to the fitted one. */
  camClamped() {
    const z = this.camZoom();
    /* THE VISIBLE SPAN IN WORLD UNITS, from the canvas's real CSS size rather
       than from the board's -- under a cover fit the two are different, and
       assuming they were equal is what would put the board's top-left in the
       window's top-left instead of its middle. */
    const vw = fin(this.viewW, this.width * this.viewScale) / (this.viewScale * z);
    const vh = fin(this.viewH, this.height * this.viewScale) / (this.viewScale * z);
    /* `this.cam` guarded like camZoom already guards it: draw() reads this
       every frame, and an undefined camera threw a TypeError straight out of
       the frame. */
    const cx = fin(this.cam && this.cam.x, 0), cy = fin(this.cam && this.cam.y, 0);
    /* When the view shows MORE than the board -- which is the whole point of
       being able to zoom out to the fitted view -- there is nothing to pan
       along that axis, and the board is CENTRED in the surplus rather than
       shoved against the top-left corner. */
    return { x: vw >= this.width ? (this.width - vw) / 2 : clamp(cx, 0, this.width - vw),
             y: vh >= this.height ? (this.height - vh) / 2 : clamp(cy, 0, this.height - vh) };
  },
  /** Zoom about a fixed world point, so the tile under the cursor stays put. */
  zoomAt(worldX, worldY, factor) {
    const z0 = this.camZoom();
    /* Floored at camMinZoom, NOT at 1. Under the cover fit, 1 is the cropped
       default view, and clamping here at 1 meant the WHEEL could never reach
       the whole-board view that the 0 key reaches: scroll-out simply stopped.
       That is the exact complaint this line answers. */
    const z1 = clamp(fin(z0 * factor, z0), this.camMinZoom(), BATTLE_ZOOM_MAX);
    if (z1 === z0) return;
    /* The anchor point comes from a pointer event, so it is exactly as
       trustworthy as the rect it was derived from. */
    const wx = fin(worldX, 0), wy = fin(worldY, 0);
    this.cam.x = fin(wx - (wx - fin(this.cam.x, 0)) * (z0 / z1), 0);
    this.cam.y = fin(wy - (wy - fin(this.cam.y, 0)) * (z0 / z1), 0);
    this.cam.z = z1;
    const c = this.camClamped();
    this.cam.x = c.x; this.cam.y = c.y;
  },
  panBy(dx, dy) {
    /* A non-finite delta is DROPPED, not applied and then clamped -- clamping
       it would keep the NaN. This is the line the whole freeze came through. */
    this.cam.x = fin(this.cam.x, 0) + fin(dx, 0);
    this.cam.y = fin(this.cam.y, 0) + fin(dy, 0);
    const c = this.camClamped();
    this.cam.x = c.x; this.cam.y = c.y;
  },
  /* HOME is the whole board, which under a cover fit is the zoomed-OUT view
     rather than zoom 1. camClamped centres it from there. */
  resetCam() { if (this.cam) { this.cam.x = 0; this.cam.y = 0; this.cam.z = this.camMinZoom(); } },

  /* One answer for every board-input gate. 'playing' is the normal case; the
     second clause is D3: an escalation halt the player chose to HOLD is spent
     time, and spending it placing towers is the point of holding. Abilities
     and musters keep their own 'playing'-only gates -- they are timed acts,
     and firing them into a parked sim would bank their whole duration free.
     Never true in a duel: the modal (and so the hold) is singleplayer-only;
     multiplayer deals escalations without asking. */
  boardInteractive() {
    return this.state === 'playing' ||
           (this.state === 'escalating' && this.escalationHold);
  },

  bindInput() {
    const cv = this.canvas;
    /* The ring runs on POINTER events so one code path serves a mouse, a
       trackpad and a finger; `drag` is the press it is currently tracking. */
    const drag = { id: null, sx: 0, sy: 0, gx: -1, gy: -1, open: false, live: false, cx: 0, cy: 0 };
    cv.addEventListener('mousemove', e => {
      if (!this.boardInteractive()) return;
      const p = this.pointerToGrid(e);
      this.hover.gx = p.gx; this.hover.gy = p.gy; this.hover.active = true;
      const aimed = this.aimedDef();
      cv.style.cursor = aimed
        ? (this.canAim(0, p.gx, p.gy, aimed) ? 'crosshair' : 'not-allowed')
        : this.selectedType
          ? (this.canBuild(0, p.gx, p.gy, towerFoot(TOWER_TYPES[this.selectedType])) ? 'copy' : 'not-allowed')
          : (this.towerAt(p.gx, p.gy) ? 'pointer' : 'default');
    });
    cv.addEventListener('mouseleave', () => { this.hover.active = false; });

    /* ---- the camera's own gestures ----------------------------------------
       Deliberately the ones nothing else claims. The wheel zooms about the
       cursor; the MIDDLE button drags; arrows nudge; 0 recentres (bound with
       the other keys in main.js). Left-drag stays the build ring's and
       right-click stays cancel. */
    cv.addEventListener('wheel', e => {
      if (!this.boardInteractive()) return;
      e.preventDefault();
      const p = this.pointerToBoard(e);
      this.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    let panning = null;
    cv.addEventListener('pointerdown', e => {
      /* THE MIDDLE BUTTON PANS UNCONDITIONALLY, as it always has. The LEFT
         button now pans too, the way the galaxy map does -- but only from a
         press nothing else on this canvas claims: an armed ability, a tower
         being placed or moved, all mean the next gesture already. And on
         BUILDABLE ground at rest the drag-out radial owns the press (it is
         the quick-build gesture), so a left pan starts there only once the
         camera is actually zoomed -- which is also the only time there is
         anywhere to pan TO. A left press is a MAYBE-pan: it does nothing
         until it travels PAN_OPEN_PX, so a click is still a click. */
      /* A DRAG ALWAYS PANS NOW (owner, Session 38): "so you can navigate by
         touch by clicking and dragging, and in order to place a tower you
         have to specifically click on a tile." The ring used to own the press
         on buildable ground at rest, which is why panning there was refused,
         and it is exactly the collision the note above worried about. The
         ring is a TAP now (see the radial block below), so the two gestures
         no longer compete: press-and-travel is the camera, press-and-release
         is the ring. A left press is still a MAYBE-pan and does nothing until
         it travels PAN_OPEN_PX, so a tap remains a clean tap. */
      let ok = false;
      if (e.button === 1) ok = true;
      else if (e.button === 0 && this.boardInteractive() &&
               this.aimingAbility === null && !this.movingTower && !this.selectedType) ok = true;
      if (!ok) return;
      if (e.button === 1) e.preventDefault();
      panning = { id: e.pointerId, x: e.clientX, y: e.clientY,
                  primary: e.button === 0, opened: e.button === 1, applied: 0 };
      /* Capture can legitimately refuse -- a pointer already released by the
         time this runs -- and a throw here would strand the maybe-pan armed. */
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      if (panning.opened) cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', e => {
      if (!panning || e.pointerId !== panning.id) return;
      /* The maybe-pan opens on travel, exactly the radial's own rule: the
         threshold is in CSS pixels because the player's hand does not scale
         with the fitted canvas. Until it opens, nothing moves and a release
         is still a clean click. */
      if (!panning.opened) {
        if (Math.hypot(e.clientX - panning.x, e.clientY - panning.y) < PAN_OPEN_PX) return;
        panning.opened = true;
        cv.style.cursor = 'grabbing';
      }
      const r = this.canvas.getBoundingClientRect();
      /* A HIDDEN OR MID-LAYOUT CANVAS MEASURES ZERO, and dividing by it is
         where the camera used to be poisoned for the rest of the match. There
         is nothing sensible to pan by when the board has no size on screen, so
         the drag is simply ignored until it does. */
      if (!(r.width > 0) || !(r.height > 0)) { panning.x = e.clientX; panning.y = e.clientY; return; }
      const z = this.camZoom();
      const c0 = this.camClamped();
      const inv = 1 / (this.viewScale * z);
      this.panBy(-(e.clientX - panning.x) * inv, -(e.clientY - panning.y) * inv);
      const c1 = this.camClamped();
      /* What the camera ACTUALLY did, not what the hand asked for: at zoom 1
         the clamp holds the view still, and a drag that moved nothing must
         not eat the click that follows it. */
      panning.applied += Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y);
      panning.x = e.clientX; panning.y = e.clientY;
    });
    const endPan = e => {
      if (!panning || (e && e.pointerId !== panning.id)) return;
      /* A left pan that moved the camera has already been answered, and its
         release also fires a click on the canvas. Suppressed through the same
         capture-phase flag the radial uses -- one mechanism, one meaning:
         "this press was a gesture, not a click". */
      if (panning.primary && panning.applied > 0.5) this._radialAte = true;
      panning = null; cv.style.cursor = '';
    };
    cv.addEventListener('pointerup', endPan);
    cv.addEventListener('pointercancel', endPan);
    cv.addEventListener('click', e => {
      if (!this.boardInteractive()) return;
      Sound.resume();
      const p = this.pointerToGrid(e);
      /* An armed ability consumes the next click ahead of everything else:
         while it is aimed, the cursor means one thing only. Arming it already
         cleared the build and relocate modes, so the order below is a
         formality, but it is the order the player sees. */
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
       build. Every other cursor mode on this canvas, an aimed ability, a
       tower armed for relocation, a shop-armed tower type, already means one
       thing, and a ring that overrode any of them would be a second meaning
       for the same press. */
    cv.addEventListener('pointerdown', e => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      /* Cleared here rather than in the click handler, so a release that
         lands off-canvas, which produces no click at all, cannot leave the
         suppression armed for the next genuine one. */
      this._radialAte = false;

      /* A RING IS ALREADY OPEN: this press answers it. Handled before the
         self-heal below, because that clear would otherwise throw the ring
         away on the very press meant to choose from it. Tapping a wedge
         builds; tapping the dead centre, past the outer edge, or anywhere
         else dismisses. Either way the press is spent and must not also
         reach the select/place click handler. */
      if (this.radial) {
        const pp = this.pointerToGrid(e);
        /* TAPPING THE TILE AGAIN CLOSES IT, and this test comes first on
           purpose. Near a board edge the ring centre is clamped inward by a
           whole ring's width, so the tile the ring belongs to can sit UNDER
           one of its own wedges: measured at tile (0,0), a second tap on the
           very spot that opened the ring built a tower instead of dismissing
           it. Geometrically the picker was right and the player was not
           wrong either, which is exactly the kind of disagreement to settle
           with a rule rather than with more geometry. Tap the tile, get the
           ring; tap it again, get rid of it, wherever it was clamped to. */
        if (pp && pp.gx === this.radial.gx && pp.gy === this.radial.gy) {
          this.radial = null; UI.syncAll();
        } else {
          const bb = this.pointerToBoard(e);
          this.radial.hover = this.radialPick(bb.x, bb.y);
          if (this.radial.hover >= 0) this.radialCommit();
          else { this.radial = null; UI.syncAll(); }
        }
        drag.live = false; drag.open = false;
        this._radialAte = true;
        return;
      }

      drag.live = false; drag.open = false; drag.id = e.pointerId;
      if (!this.boardInteractive()) return;
      if (this.aimingAbility !== null || this.movingTower || this.selectedType) return;
      const S = this.sides[0];
      if (!S || !S.loadout || !S.loadout.length) return;
      const p = this.pointerToGrid(e);
      if (!this.canBuild(0, p.gx, p.gy)) return;
      const b = this.pointerToBoard(e);
      /* Armed as a TAP, not a drag: sx/sy are the origin a release is measured
         against, and the ring opens only if the pointer never travelled. */
      drag.live = true; drag.sx = b.x; drag.sy = b.y; drag.gx = p.gx; drag.gy = p.gy;
      drag.cx = e.clientX; drag.cy = e.clientY;
    });

    /* Hover, for a mouse. A touch has no hover, which is exactly why the ring
       had to stop being a drag: there was no way to see what you were about
       to pick until you had already committed to picking it. */
    window.addEventListener('pointermove', e => {
      if (this.radial) {
        const b = this.pointerToBoard(e);
        this.radial.hover = this.radialPick(b.x, b.y);
      }
    }, { passive: true });

    window.addEventListener('pointerup', e => {
      if (!drag.live || e.pointerId !== drag.id) return;
      drag.live = false;
      /* TAP, NOT DRAG. Measured in CSS pixels against the press origin, the
         same units and the same reason PAN_OPEN_PX uses them: the player's
         hand does not scale with the fitted canvas, so the number that gates
         the gesture must not either. Anything that travelled was a pan and
         has already been answered by the pan handler. */
      if (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) >= PAN_OPEN_PX) return;
      if (!this.openRadial(drag.gx, drag.gy, drag.sx, drag.sy, drag.sx, drag.sy)) return;
      /* Open and STICKY: nothing is chosen yet, and the ring waits for a
         second, deliberate tap. The release also produces a click on the
         canvas, and that click must not reach the select/place handler. */
      this._radialAte = true;
      UI.syncAll();
    });

    window.addEventListener('pointercancel', e => {
      if (!drag.live || e.pointerId !== drag.id) return;
      drag.live = false;
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

/* THE SEEDED WINDOW (the OPTIONS battle seed). One stream, installed around
   exactly two things and nothing else: the whole of start() -- the rival
   commander, the rival faction and the opening board are all drawn there, so
   a seed that skipped it would replay a different match -- and then each
   simulation step. Between and around those windows the native generator is
   always back in place, so cosmetic rolls in draw code stay off the seeded
   stream and a replay cannot be perturbed by frame rate; that coupling is
   the failure the contributed patch set shipped, and its headless test
   stubbed rendering so it could not see it. Ignored in a duel: the relay
   owns the stream there and re-seeds it per tick (js/net.js). Unseeded
   matches pass straight through, untouched. */
Game._rawStart = Game.start;
Game.start = function (opts = {}) {
  const wantSeed = opts.seed !== undefined && opts.seed !== null &&
                   !(typeof Net !== 'undefined' && Net.live);
  this.seed = wantSeed ? (opts.seed | 0) : null;
  this._seedDraw = wantSeed ? seededDraw(this.seed) : null;
  if (!this._seedDraw) return this._rawStart(opts);
  const native = Math.random;
  Math.random = this._seedDraw;
  try { return this._rawStart(opts); } finally { Math.random = native; }
};
Game._rawStep = Game.step;
Game.step = function (dt) {
  if (!this._seedDraw) return this._rawStep(dt);
  const native = Math.random;
  Math.random = this._seedDraw;
  try { return this._rawStep(dt); } finally { Math.random = native; }
};

/* Settings and per-map records live alongside commander progression. */
const Storage = {
  loadSettings() { return Object.assign({ sfx: 0.7, music: 0.4, sfxOn: true, musicOn: true, reducedMotion: false, damageNumbers: true,
                                  /* THE BOARD IS THE SCREEN, by default. The
                                     owner asked for the battle map to fill the
                                     browser "just like the galaxy map, with the
                                     right column overlayed on top of it". This
                                     shipped as an opt-in toggle nobody found;
                                     it is the default now, and the toggle
                                     turns it OFF for anyone who preferred the
                                     windowed board. An existing save that
                                     never touched the setting has no key, so
                                     Object.assign gives it the new default --
                                     which is the intent, not a migration. */
                                  immersive: true }, Meta.getSettings()); },
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
