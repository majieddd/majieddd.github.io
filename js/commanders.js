/* ==========================================================================
   COSMIC CONQUEST, Commanders, Talent Trees & Meta Progression
   --------------------------------------------------------------------------
   Commander charts are laid out like a classic MMO talent tree: three columns,
   three rows, vertical prerequisite chains, and rows gated behind total points
   spent in the tree. Deeper rows cost more, so a full column is a real
   commitment rather than a shopping list.
   ========================================================================== */

'use strict';

/** Points that must be spent in the tree before a row unlocks. */
const TALENT_ROW_GATE = [0, 2, 5];

/* Towers must be UNLOCKED with souls before they can be deployed. Five core
   towers are issued free so a legal loadout always exists, and a new profile
   is granted enough souls to unlock three more immediately. */
/* You begin with a single tower. The loop the game is built around is losing,
   unlocking one more thing, and going back in -- which only works if the first
   unlock is a real event rather than the fifth of five. */
const STARTER_TOWERS = ['bolt'];
const TOWER_UNLOCK_COST = 6;
const STARTING_SOULS = TOWER_UNLOCK_COST;   /* exactly one extra tower */

function freshTraits() {
  return {
    draftEvery: 5, draftOptions: 3, startingMods: 0, perModDamage: 0,
    costGrowthMul: 1, freeCopies: 0,
    ascCostMul: 1, ascDamage: ASCENSION.damage, surgeEvery: ASCENSION.surgeEvery, surgeMul: 1,
    reanimSpeed: 1, reanimGold: 0, siphonRate: 1,
    leakReduction: 0, lastStandAt: 0, lastStandDmg: 0, waveHeal: 0,
    /* THESE ARE ALL LIVE NOW, and this comment used to say otherwise.
       `freeCopies`, `siphonRate`, `lastStandAt`, `lastStandDmg`, `waveHeal`
       and `immortalLine` were dormant hooks -- read by engine code, written
       by nobody -- until the twenty faction boons woke them: FIELD REFIT,
       THE LAST LINE and RENDERING write them through BOON_FOLD (towers2.js,
       game.js:149+). The old note still described them as inert, which is
       exactly how a stale comment earns its keep: nobody re-checks a key the
       file has already told them is switched off.

       STILL WRITER-LESS as of Session 22, audited key by key -- these are
       read by live engine code and written by nothing, so every read sits on
       the default and is inert. Grant one from a chart node or a boon to turn
       the mechanic on, and move it out of this list when you do:
         surgeMul        entities.js, the ascension surge multiplier
         vaultBonus      entities.js + game.js, the Vault's skim (the tower
                         inspector prints a figure derived from it)
         compileRateMul  game.js applyCompile, scales a compile metric
         mods.interest   game.js interestOn, the banked-capital multiplier
       Everything else in freshTraits() and freshMods() was verified to have
       both a writer and a reader. */
    ascendBonusRate: 0, perAscDamage: 0, immortalLine: false, vaultBonus: 1,

    /* Accumulators the twenty-commander roster writes into. They are folded
       into `side.mods` once every trait and tech node has applied, so a chart
       can add to the same statistic from three different columns without each
       node needing to know about the others. */
    dmg: 0, rate: 0, rng: 0, splash: 0, pierce: 0, crit: 0, critMult: 0, status: 0,
    reanimResist: 0,
    goldMul: 0, upgradeMul: 1, sellRate: 0,
    reanimHp: 1, dotMul: 1, slowVuln: 0, killRamp: 0,
    eliteDamage: 1, eliteBounty: 1, startLevel: 0, lifeRegen: 0, lifeGainMul: 0,
    jamResist: 0, jamImmune: false, immortal: false,
    leakReduce: 0, auraRangeMul: 1,
    /* THE COMPILE. `compileFloor` pre-grants levels a chart has bought;
       `compileRateMul` scales the metric a commander is measured on. Both
       are read by Game.applyCompile and nowhere else. */
    compileFloor: 0, compileRateMul: 1
  };
}

/**
 * Fold the roster's trait accumulators into the side's live modifier set.
 * Called once, after the commander trait and every unlocked tech node has run.
 */
function foldTraits(side) {
  const t = side.traits, m = side.mods;
  /* Prestige: every numeric talent value is worth 20% more per star, rounded
     to the nearest whole percent. Applied to the accumulators before they are
     folded, so a value authored as +7% reads +8%/+10%/... at 1/2/... stars. */
  const stars = side.prestigeStars || 0;
  if (stars > 0) {
    const f = 1 + 0.2 * stars;
    const pct = v => Math.round(v * f * 100) / 100;
    t.dmg = pct(t.dmg); t.rate = pct(t.rate); t.rng = pct(t.rng);
    t.splash = pct(t.splash); t.status = pct(t.status); t.goldMul = pct(t.goldMul);
    t.pierce = Math.min(0.9, pct(t.pierce)); t.crit = Math.min(0.75, pct(t.crit));
    t.critMult = pct(t.critMult); t.slowVuln = pct(t.slowVuln);
    t.perModDamage = pct(t.perModDamage); t.perAscDamage = pct(t.perAscDamage);
    t.lifeGainMul = pct(t.lifeGainMul); t.reanimResist = Math.min(0.6, pct(t.reanimResist));
    t.reanimHp = 1 + pct(t.reanimHp - 1);
    t.dotMul = 1 + pct(t.dotMul - 1);
  }
  m.damage *= (1 + t.dmg);
  m.rate   *= (1 + t.rate);
  m.range  *= (1 + t.rng);
  m.splash *= (1 + t.splash);
  m.status *= (1 + t.status);
  m.gold   *= (1 + t.goldMul);
  m.upCost *= t.upgradeMul;
  m.pierce += t.pierce;
  m.crit   += t.crit;
  /* The other half of a crit. CRUSH, OBLITERATE, NO QUARTER and the MARQUE
     boon all wrote `critMult` and nothing ever folded it, so ULGRIM's and
     SCARLET's whole third column advertised crit damage and changed no
     number on the board. */
  m.critMult += t.critMult;
  m.reanim *= t.reanimHp;
  if (t.sellRate) m.sellRate = t.sellRate;
  if (t.leakReduce) t.leakReduction = Math.max(t.leakReduction, t.leakReduce);
  if (t.immortal) t.immortalLine = true;
}

/* The roster now lives in roster.js: twenty commanders across four factions,
   one free per faction and the rest bought with souls. */
const COMMANDERS = COMMANDER_ROSTER;

/* One arsenal shelf per banner, plus `none` for a profile that has not sworn
   yet -- whose shelf is folded into the banner's the moment it does. */
const NO_BANNER_SHELF = 'none';
function arsenalShelfKeys() { return Object.keys(FACTIONS).concat([NO_BANNER_SHELF]); }

/* THE FOUR SHOPS souls buy from. Each keeps its OWN inflation ladder on each
   banner. One shared counter meant a commander recruited on Tuesday raised
   Wednesday's tower price: the same CRYO cost 6 souls to a player who opened
   the arsenal first and 22 to one who recruited first, for no reason the shop
   ever stated. A ladder now answers for its own aisle and nobody else's. */
const SOUL_SHOP_KINDS = ['tower', 'unit', 'commander', 'ability'];
/* `banner/kind`. No faction id and no NO_BANNER_SHELF contains a slash, so the
   key is unambiguous and still legible in a dumped save. */
function soulLedgerKeys() {
  const out = [];
  for (const b of arsenalShelfKeys())
    for (const k of SOUL_SHOP_KINDS) out.push(b + '/' + k);
  return out;
}

/* --------------------------------------------------------------------------
   META PROGRESSION
-------------------------------------------------------------------------- */
const Meta = {
  KEY: 'aegis-attrition-profiles-v1',
  _root: null,

  /* ---------------------------------------------------------- profiles ---
     Everything below operates on the ACTIVE profile. Progression, talents,
     unlocked maps and records are all per-profile; only audio settings are
     shared. No passwords, this is a local roster, not an account system. */

  root() {
    if (this._root) return this._root;
    let d = {};
    try { d = JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { d = {}; }
    d.profiles = d.profiles || {};
    d.settings = d.settings || {};
    if (!Object.keys(d.profiles).length) { d.profiles['COMMANDER'] = this.blankProfile(); d.active = 'COMMANDER'; }
    if (!d.active || !d.profiles[d.active]) d.active = Object.keys(d.profiles)[0];
    this._root = d;
    return d;
  },
  blankProfile() {
    const p = { commanders: {}, talents: {}, best: {}, created: 0, runs: 0,
                towerXp: {}, souls: STARTING_SOULS,
                unlocked: STARTER_TOWERS.slice(), campaign: null,
                faction: null, galaxyTier: 0, prestige: {}, seenEnemies: [],
                /* One commander per faction is free; the rest are bought. */
                /* Only CADRE at the start. Each faction's base commander is
                   granted the moment you swear to that faction. */
                cmdUnlocked: alwaysUnlocked(),
                abilUnlocked: [],
                /* Muster detachment: which SAVED denizens deploy with you.
                   Empty means "the first unlocked" -- resolved on read. */
                musterLoadout: [],
                /* The standing order: which commander deploys. null = never
                   chosen; the commander screen's EQUIP button writes it. */
                equippedCommander: null,
                /* ACHIEVEMENTS (Session 29). `stats` are cumulative counters
                   that never reset; `achievements` holds CLAIMED ids as
                   strings, so the table may be reordered freely. */
                stats: blankAchievementStats(),
                achievements: [] };
    for (const c of COMMANDERS) p.commanders[c.id] = { xp: 0, unlocked: [] };
    for (const id of TOWER_ORDER) { p.talents[id] = []; p.towerXp[id] = 0; }
    /* Units share the tower tracks rather than growing their own: one talent
       store, one mastery store, one set of readers. Enumerated separately only
       because UNIT_ORDER is built in factions.js, after TOWER_ORDER. */
    for (const id of unitTrackIds()) { p.talents[id] = []; p.towerXp[id] = 0; }
    return p;
  },
  profileNames() { return Object.keys(this.root().profiles); },
  activeName() { return this.root().active; },
  setActive(name) { const r = this.root(); if (r.profiles[name]) { r.active = name; this.save(); } },
  createProfile(name) {
    name = String(name || '').trim().toUpperCase().slice(0, 14);
    if (!name) return null;
    const r = this.root();
    if (r.profiles[name]) return null;
    r.profiles[name] = this.blankProfile();
    r.active = name;
    this.save();
    return name;
  },
  deleteProfile(name) {
    const r = this.root();
    if (Object.keys(r.profiles).length <= 1) return false;
    delete r.profiles[name];
    if (r.active === name) r.active = Object.keys(r.profiles)[0];
    this.save();
    return true;
  },

  /** The active profile, normalised so new fields appear on old saves. */
  load() {
    const r = this.root();
    const p = r.profiles[r.active];
    p.commanders = p.commanders || {};
    /* Normalise IN PLACE, recreating these objects would orphan any
       reference taken from an earlier load() call mid-transaction. */
    for (const c of COMMANDERS) {
      if (!p.commanders[c.id]) p.commanders[c.id] = { xp: 0, unlocked: [] };
      if (typeof p.commanders[c.id].xp !== 'number') p.commanders[c.id].xp = 0;
      if (!Array.isArray(p.commanders[c.id].unlocked)) p.commanders[c.id].unlocked = [];
    }
    p.talents = p.talents || {};
    for (const id of TOWER_ORDER) p.talents[id] = p.talents[id] || [];
    p.best = p.best || {};
    p.towerXp = p.towerXp || {};
    if (!Array.isArray(p.unlocked)) p.unlocked = STARTER_TOWERS.slice();
    if (!Array.isArray(p.cmdUnlocked)) p.cmdUnlocked = alwaysUnlocked();
    for (const id of alwaysUnlocked()) if (!p.cmdUnlocked.includes(id)) p.cmdUnlocked.push(id);
    if (!Array.isArray(p.abilUnlocked)) p.abilUnlocked = [];
    if (!Array.isArray(p.musterLoadout)) p.musterLoadout = [];
    /* Saves written before the map-pool pin regenerate against the ELEVEN
       non-tri boards that existed then (spine through anvil). A frozen
       literal on purpose: recomputing it from live MAPS would re-break the
       exact thing the pin exists to protect. */
    if (p.campaign && (typeof p.campaign.mapPool !== 'number' || !isFinite(p.campaign.mapPool)))
      p.campaign.mapPool = 11;
    if (p.faction === undefined) p.faction = null;
    /* The equipped commander arrived after every profile in existence was
       written, so it is defaulted on READ the way the unit tracks were. null
       means "never chosen" -- deploy falls back to the session pick. */
    if (typeof p.equippedCommander !== 'string') p.equippedCommander = null;
    if (typeof p.galaxyTier !== 'number') p.galaxyTier = 0;
    if (!p.prestige || typeof p.prestige !== 'object') p.prestige = {};
    if (!Array.isArray(p.seenEnemies)) p.seenEnemies = [];
    if (typeof p.souls !== 'number') p.souls = 0;
    for (const id of TOWER_ORDER) if (typeof p.towerXp[id] !== 'number') p.towerXp[id] = 0;
    /* Units arrived after every profile in existence was written, so they are
       defaulted on READ exactly the way musterUnlocked was -- an old save must
       gain the tracks, never be rebuilt around them. */
    for (const id of unitTrackIds()) {
      if (!Array.isArray(p.talents[id])) p.talents[id] = [];
      if (typeof p.towerXp[id] !== 'number') p.towerXp[id] = 0;
    }
    /* The campaign is a profile field too, and it was the ONE this function
       never touched: fifteen fields normalised beside an object that grew
       stars, systemsTaken, defeats and owners long after it first shipped. A
       campaign written before any of those existed reached campaignAdvance
       with no boons array and recordWorld with no stars map, and threw --
       losing the whole galaxy to a save that was merely OLD. */
    this.migrateCampaign(p.campaign, p);
    return p;
  },

  /** Default every field campaign code reads, IN PLACE.

     In place because a caller may already be holding this object --
     campaignAdvance takes it out of p.campaign and mutates it -- so handing
     back a replacement would orphan the write. Anything the reader already
     guards (systemsTaken, defeats) is defaulted here anyway: a guard at one
     of two call sites is how these fields came to be missing at the other. */
  migrateCampaign(c, p) {
    if (!c || typeof c !== 'object') return null;
    /* A galaxy is REBUILT from its seed, so a campaign without one has no
       galaxy at all. Pinned rather than re-rolled: a fixed fallback at least
       gives the same galaxy on every later load, where Math.random would hand
       the player a different one each time they opened the map. */
    if (c.seed === undefined || c.seed === null) c.seed = 1;
    if (typeof c.depth !== 'number' || !isFinite(c.depth)) c.depth = 0;
    if (typeof c.totalWaves !== 'number' || !isFinite(c.totalWaves)) c.totalWaves = 0;
    if (typeof c.defeats !== 'number' || !isFinite(c.defeats)) c.defeats = 0;
    if (typeof c.tier !== 'number' || !isFinite(c.tier)) c.tier = 0;
    if (typeof c.system !== 'number' || !isFinite(c.system)) c.system = 0;
    if (!Array.isArray(c.boons)) c.boons = [];
    if (!Array.isArray(c.systemsTaken)) c.systemsTaken = [];
    if (!Array.isArray(c.log)) c.log = [];
    if (!Array.isArray(c.options)) c.options = [];
    if (!c.stars || typeof c.stars !== 'object') c.stars = {};
    /* Where the rivals' expansion lives between sessions. */
    if (!c.owners || typeof c.owners !== 'object') c.owners = {};
    if (c.chosen === undefined) c.chosen = null;
    /* Campaigns that predate NEW GAME PLUS resolve to the law they were
       played under, which is exactly what VETERAN is. */
    if (!RAMP_PRESETS[c.ramp]) c.ramp = RAMP_DEFAULT;
    /* The campaign's own banner. Falling back to the profile's keeps the
       galaxy pointed at the right rivals; 'human' is the last resort, and it
       is the same fallback galaxy() has always used. */
    if (!c.faction) c.faction = (p && p.faction) || 'human';
    return c;
  },

  /* Audio/accessibility settings belong to the INSTALL, not to a profile. They
     used to be copied from root onto the profile on every load while the writer
     only ever wrote the profile copy, so muting the music silently un-muted
     itself the next time any screen rendered. */
  getSettings() { const r = this.root(); r.settings = r.settings || {}; return r.settings; },

  /* ─────────────────────────────── SHARED UNLOCK VAULT ────────────────────
     Anything bought in the Soul Shop belongs to the INSTALL, not to one
     profile: unlock a tower once and every commander file can field it.
     Migrated on first read from the union of whatever the profiles held. */
  vault() {
    const r = this.root();
    if (!r.vault) {
      r.vault = { unlocked: [], cmdUnlocked: [], abilUnlocked: [] };
      for (const name in r.profiles) {
        const p = r.profiles[name];
        for (const k of ['unlocked', 'cmdUnlocked', 'abilUnlocked'])
          for (const id of (p[k] || [])) if (!r.vault[k].includes(id)) r.vault[k].push(id);
      }
      for (const id of STARTER_TOWERS) if (!r.vault.unlocked.includes(id)) r.vault.unlocked.push(id);
      for (const id of alwaysUnlocked()) if (!r.vault.cmdUnlocked.includes(id)) r.vault.cmdUnlocked.push(id);
      this.save();
    }
    /* musterUnlocked arrived after vault() first shipped, so an EXISTING
       root.vault predates it and the init above never runs again. Default it
       on read -- the same migration pattern unlocked/cmdUnlocked used. */
    if (!Array.isArray(r.vault.musterUnlocked)) {
      r.vault.musterUnlocked = MUSTER_BASE_UNLOCK.slice();
      this.save();
    }

    /* ARSENAL SHELVES. Tower unlocks used to be ONE install-wide list while
       souls were -- and still are -- per profile. So a Xeno file could bank
       the souls, buy TOXIN, and a Federation file that never paid a soul
       owned it, in defiance of the origin gate that would have refused the
       purchase on that banner outright. One shelf per banner puts the scope
       of the grant back where the scope of the spend already was. Existing
       installs are grandfathered -- every shelf is seeded from the old flat
       list -- so the migration takes nothing away from anybody. */
    if (!r.vault.unlockedBy) {
      const legacy = Array.isArray(r.vault.unlocked) ? r.vault.unlocked : [];
      r.vault.unlockedBy = {};
      for (const k of arsenalShelfKeys()) r.vault.unlockedBy[k] = legacy.slice();
      /* Deleted rather than left beside its replacement. A stale second copy
         of the same fact is how one vault came to be read from two places. */
      delete r.vault.unlocked;
      this.save();
    }
    /* ONE LEDGER PER SHOP PER BANNER (20.7i). `bought` was a single integer
       per banner that all four shops incremented and all four read, so the
       arsenal was taxed for recruiting and the recruiter was taxed for the
       arsenal. Split per shop, and named `boughtBy` beside `unlockedBy`
       because it is the same migration for the same reason -- the presence
       of the key IS the version marker, so this runs exactly once.

       Grandfathered saves start every ladder at ZERO. That is the rule the
       flat counter already shipped under, and it is the only seed that cannot
       charge a live profile MORE for its next purchase than it would have been
       charged today. Nothing owned is read or touched here: `unlockedBy`,
       `cmdUnlocked`, `abilUnlocked` and `musterUnlocked` are not named. */
    if (!r.vault.boughtBy) {
      r.vault.boughtBy = {};
      for (const k of soulLedgerKeys()) r.vault.boughtBy[k] = 0;
      /* Deleted rather than left beside its replacement, exactly as the flat
         `unlocked` list was: a stale second copy of the same fact is how one
         vault came to be read from two places. */
      delete r.vault.bought;
      this.save();
    }
    /* COMMANDERS AND SECOND ABILITIES JOIN THE BANNER SPLIT (owner, Session 21
       round two). Towers went per banner in 19.6 for a reason that applies
       word-for-word here: souls are spent UNDER A BANNER, so what they buy is
       scoped to the banner that paid. Recruiting stays possible across the
       line -- the cross-faction premium in soulPrice already prices that --
       but the recruit belongs to the banner that recruited them.

       Existing installs are grandfathered (owner decision 4A): every shelf is
       seeded from the old flat lists, so nobody loses a commander or an
       ability they paid for, on any banner they will ever swear to. */
    if (!r.vault.cmdUnlockedBy) {
      const legacyCmd = Array.isArray(r.vault.cmdUnlocked) ? r.vault.cmdUnlocked : [];
      const legacyAbil = Array.isArray(r.vault.abilUnlocked) ? r.vault.abilUnlocked : [];
      r.vault.cmdUnlockedBy = {};
      r.vault.abilUnlockedBy = {};
      for (const k of arsenalShelfKeys()) {
        r.vault.cmdUnlockedBy[k] = legacyCmd.slice();
        r.vault.abilUnlockedBy[k] = legacyAbil.slice();
      }
      /* Deleted rather than left beside their replacements, for the same
         reason `unlocked` and `bought` were. */
      delete r.vault.cmdUnlocked;
      delete r.vault.abilUnlocked;
      this.save();
    }
    /* THE CONQUEST LEDGER, install-wide. Which commander finished a galaxy is
       nobody's business but theirs; whether THIS INSTALL ever has is what
       unlocks the fifth banner, and it has to outlive the profile that earned
       it or the reward would vanish with the run that won it. Grandfathered
       from the only evidence older saves kept -- a profile that has advanced
       a galaxy tier has finished a galaxy, by definition. */
    if (typeof r.vault.victories !== 'number') {
      let v = 0;
      for (const n in r.profiles) v += (r.profiles[n] && r.profiles[n].galaxyTier) || 0;
      r.vault.victories = v;
      this.save();
    }
    /* A banner that did not exist when the shelves were carved gets an empty
       one on read. Safe to run forever, and it is what lets THE PARALLEL be
       added to a live install without a migration of its own. */
    for (const k of arsenalShelfKeys()) {
      if (!Array.isArray(r.vault.unlockedBy[k])) r.vault.unlockedBy[k] = STARTER_TOWERS.slice();
      if (!Array.isArray(r.vault.cmdUnlockedBy[k])) r.vault.cmdUnlockedBy[k] = alwaysUnlocked().slice();
      if (!Array.isArray(r.vault.abilUnlockedBy[k])) r.vault.abilUnlockedBy[k] = [];
    }
    for (const k of soulLedgerKeys()) if (typeof r.vault.boughtBy[k] !== 'number') r.vault.boughtBy[k] = 0;
    return r.vault;
  },

  /** Has THIS INSTALL ever taken a galaxy? The fifth banner's only gate. */
  gameBeaten() { return (this.vault().victories || 0) > 0; },
  setSettings(s) { const r = this.root(); r.settings = Object.assign(r.settings || {}, s); this.save(); },
  /* Saving used to serialise the WHOLE root synchronously on every mutation --
     measured at 1.93 ms per call against a 253 KB blob, and the blob only grows
     as a player accumulates profiles and tower XP. Dozens of little writes
     (a talent pick, an XP award, a mastery tick) turned into dozens of
     main-thread stalls, which is why sessions got progressively less responsive.
     Writes are now coalesced; anything urgent can force one. */
  save(immediate) {
    this._dirty = true;
    if (immediate) return this.flush();
    if (this._saveT) return;
    this._saveT = setTimeout(() => { this._saveT = 0; this.flush(); }, 400);
  },
  flush() {
    if (!this._dirty) return;
    this._dirty = false;
    if (this._saveT) { clearTimeout(this._saveT); this._saveT = 0; }
    try { localStorage.setItem(this.KEY, JSON.stringify(this.root())); } catch (e) {}
  },

  /* ================================================== TOWER MASTERY ====
     Playing a tower earns it experience. Mastery levels gate its talents:
     the first column of each row unlocks at levels 1/3/5, the second at
     2/4/6. Soul-bought levels stack on top. */
  masteryXpFor(n) { return n <= 1 ? 0 : Math.round(320 * Math.pow(n - 1, 1.55)); },
  masteryOf(towerId) {
    const p = this.load();
    const xp = p.towerXp[towerId] || 0;
    let lvl = 1;
    while (lvl < 20 && xp >= this.masteryXpFor(lvl + 1)) lvl++;
    /* Mastery is fight-earned and nothing else: the soul-bought levels that
       used to stack here had no writer after Session 11 made the soul shop
       unlocks-only, so the term was reading an object nothing ever filled. */
    return lvl;
  },
  masteryProgress(towerId) {
    const p = this.load();
    const xp = p.towerXp[towerId] || 0;
    let lvl = 1;
    while (lvl < 20 && xp >= this.masteryXpFor(lvl + 1)) lvl++;
    const cur = this.masteryXpFor(lvl), next = this.masteryXpFor(lvl + 1);
    return { level: this.masteryOf(towerId), into: xp - cur, need: next - cur,
             frac: clamp((xp - cur) / Math.max(1, next - cur), 0, 1) };
  },
  addTowerXp(towerId, amount) {
    const p = this.load();
    const before = this.masteryOf(towerId);
    p.towerXp[towerId] = (p.towerXp[towerId] || 0) + Math.max(0, Math.round(amount));
    this.save();
    return { gained: Math.round(amount), levels: this.masteryOf(towerId) - before, level: this.masteryOf(towerId) };
  },
  /** Mastery level a talent needs before it can even be selected. */
  talentMasteryReq(node) { return node.row * 2 + 1 + node.col; },

  /* ================================================== CAMPAIGN =========
     An endless forking path. Each node is a battlefield with an arena
     modifier, a named rival commander, and a boon you keep on victory.
     A DEFEAT keeps the campaign: a lost battle pays no stars and the rivals
     move, but the galaxy and every star survive (campaignDefeat). Only a
     voluntary abandon resolves a campaign (campaignEnd). */
  _rng(seed) {
    let x = seed | 0 || 1;
    return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) / 4294967296); };
  },
  campaign() { return this.load().campaign; },
  campaignStart(factionId, rampId) {
    const p = this.load();
    if (factionId) {
      p.faction = factionId;
      /* ...and takes the unsworn arsenal shelf with it. */
      this.adoptShelf(factionId);
      /* Swearing to a faction hands you its base commander, permanently --
         on THIS banner's shelf, which shelfKey() already resolves to because
         p.faction was assigned above. */
      const base = freeCommanderOf(factionId);
      const shelf = this.cmdShelf();
      if (base && !shelf.includes(base)) shelf.push(base);
    }
    const seed = (p.runs * 7919 + 104729 + Math.floor(Math.random() * 1e6)) | 0;
    /* A campaign is a galaxy. Only the seed and the star progress are stored;
       the galaxy itself is regenerated from the seed, so a save stays tiny and
       a given campaign is always the same campaign. */
    p.campaign = { seed, depth: 0, boons: [], totalWaves: 0, options: null,
                   /* The non-tri map pool AS IT STANDS TODAY, pinned so this
                      campaign's galaxy keeps its boards when maps are added
                      later. Live-counted here, frozen-literal in migration. */
                   mapPool: MAPS.filter(m => !m.tri).length,
                   faction: p.faction || 'human', tier: p.galaxyTier || 0,
                   /* A first galaxy never chooses its slope -- the choice is
                      the reward for finishing one, and VETERAN is the law the
                      campaign already shipped with. */
                   ramp: ((p.galaxyTier || 0) > 0 && RAMP_PRESETS[rampId]) ? rampId : RAMP_DEFAULT,
                   stars: {}, chosen: null, system: 0, log: [] };
    p.campaign.options = this.campaignOptions();
    this.save();
    return p.campaign;
  },

  /** The galaxy for the live campaign, rebuilt from its seed -- and then
      re-taken by whatever the rivals seized while it was not loaded. */
  galaxy() {
    const c = this.campaign();
    if (!c) return null;
    if (!this._gx || this._gxSeed !== (c.seed + ':' + (c.mapPool || 0))) {
      this._gx = generateGalaxy(c.seed, c.faction || 'human', c.mapPool);
      this._gxSeed = c.seed + ':' + (c.mapPool || 0);
      /* Generation is PURE: it derives every world's owner from the seed, so
         it always hands back the galaxy as it stood on day one. advanceRivals
         moves owners on the live object only, which meant every world the
         rivals took came back to them on the next load and the campaign's
         opposing-pressure loop silently did nothing across sessions. Replay
         the takes here -- the one place a galaxy is ever built. */
      this.applyRivalHoldings(this._gx, c);
    }
    return this._gx;
  },

  /** Stamp the banked rival takes back onto a freshly generated galaxy.
      Unknown ids and unknown factions are ignored rather than trusted: this
      map is player-writable storage, and a bad owner would paint a world in a
      colour FACTIONS has no entry for. Returns how many worlds moved. */
  applyRivalHoldings(gx, c) {
    const owners = c && c.owners;
    if (!gx || !owners) return 0;
    let n = 0;
    for (const sys of gx.systems)
      for (const w of sys.worlds) {
        const f = owners[w.id];
        /* NEVER over a RENEGADE world. Its owner IS the player's own power by
           construction, and a banked take from a save written before renegade
           worlds existed would stamp a rival on top while `renegade` stayed
           true -- a world flying a rival's colours that still pays your own
           power's boon and fields your own troops. The splinter is not
           somebody a rival can conquer; it is the reason the world is on the
           map. */
        if (w.renegade) continue;
        if (f && FACTIONS[f] && f !== w.owner) { w.owner = f; n++; }
      }
    return n;
  },

  /** Bank the rivals' move so it outlives the session that rolled it. */
  recordRivalMoves(moves) {
    const c = this.campaign();
    if (!c || !moves || !moves.length) return 0;
    c.owners = c.owners || {};
    let n = 0;
    for (const mv of moves)
      if (mv && mv.worldId && FACTIONS[mv.faction])
        { c.owners[mv.worldId] = mv.faction; n++; }
    /* Forced, not coalesced. This runs as the end-of-battle screen appears,
       which is exactly the screen a player closes the tab from -- and the
       400 ms write window is more than enough to lose the whole move. */
    if (n) this.save(true);
    return n;
  },
  /** Record a result on a world; returns what changed. */
  recordWorld(worldId, stars) {
    const c = this.campaign();
    if (!c) return null;
    const p = this.load();
    const prev = c.stars[worldId] || 0;
    let souls = 0;
    /* OWNER-SET (Session 29): a FLAT BASE the first time this world is cleared,
       plus ONE per star. A clean three-star sweep is still 3 + 3 = 6, exactly
       what the old flat-2-per-star ladder paid, so one conquered world still
       lands on one TOWER_UNLOCK_COST and the shop's pricing does not move.
       What changes is the floor: a single-star clear pays 4 instead of 2, so a
       player stuck on a hard world still banks progress. `prev` is the best
       result ever recorded here, so this pays the base exactly once. */
    if (prev < 1 && stars >= 1) souls += this.SOULS_BASE;
    for (let n = prev + 1; n <= stars; n++) souls += this.soulsForStar(n);
    if (stars > prev) c.stars[worldId] = stars;

    /* A solar system whose every world is conquered pays a bounty, once. */
    let systemTaken = null, saved = [], storyTower = null, refusedOffer = null;
    if (souls || stars > prev) {
      const gx = this.galaxy();
      const sys = gx && gx.systems.find(s2 => s2.worlds.some(w => w.id === worldId));
      if (sys && sys.worlds.every(w => (c.stars[w.id] || 0) >= 3)) {
        c.systemsTaken = c.systemsTaken || [];
        if (!c.systemsTaken.includes(sys.id)) {
          c.systemsTaken.push(sys.id);
          souls += this.SYSTEM_BOUNTY;
          systemTaken = sys.name;
          /* The machine line is the reward for a WHOLE system, so it hangs
             off the one place a system is recognised as taken. Anywhere else
             and it is either paid twice or missed entirely. */
          storyTower = this.grantStoryTower();
        }
      }
      /* Conquest SAVES the world's denizens: its map's roster joins the
         shared muster vault, so every profile can send them from now on.
         Bosses and heavy multi-life mobs are filtered inside saveDenizens. */
      if (stars >= 3 && prev < 3 && sys) {
        const world = sys.worlds.find(w2 => w2.id === worldId);
        const wMap = world && MAPS.find(m => m.id === world.map);
        if (wMap && wMap.denizens) saved = this.saveDenizens(wMap.denizens);
        /* THE SECOND RESCUE TRACK (roadmap 19.10 / 19.11). The machines above
           are the MAP'S; these are the WORLD'S, and which power's soldiers
           stand on a world is precisely what the galaxy map's ownership colour
           has been painting and never cashing. The map's tier picks which of
           that power's five -- early worlds hand you Chitlings, late worlds
           hand you Broodmothers.

           Two ids, and the difference between them IS the gate. `offer` is
           whoever held the world; saveDenizens refuses it unless you are sworn
           to that power, and refusedOffer names it so the summary can say who
           would not march. `garrison` is your own power's soldiers, who now
           hold the world you just took -- and they are the reason this feature
           is not inert: generateGalaxy gives your own banner no world at all,
           so an offer-only rule would have left every faction unit in the game
           unreachable by rescue. */
        /* THE CADENCE GATE (owner, Session 29). Not every world pays a
           soldier. worldGrantsUnit is index-derived, so the same worlds pay on
           every reload and on both clients, and the preview card can promise it
           truthfully before the battle. The map's own denizens above are NOT
           gated: those are the board's creatures and saving them is what
           conquering the board means. */
        const paysUnit = typeof worldGrantsUnit === 'function' ? worldGrantsUnit(world) : true;
        const rescue = paysUnit ? worldRescueOffer(world, wMap, c.faction || p.faction) : null;
        refusedOffer = rescue ? (this.refusedDenizens([rescue.offer])[0] || null) : null;
        /* ONE soldier per conquest (owner, Session 26). Granting both the
           offer and the garrison meant a clean take could hand over two units
           at once, and the briefing card could not honestly name what a
           three-star pays. The rule the card shows is the rule applied here:
           the holder's soldier when your banner may take it, otherwise your
           own garrison's. */
        if (rescue) {
          const pickId = this.unitRescueLock(rescue.offer) ? rescue.garrison : rescue.offer;
          saved = saved.concat(this.saveDenizens([pickId]));
        }
      }
    }
    if (souls) p.souls += souls;
    this.save();
    return { worldId, stars, previous: prev, improved: stars > prev,
             conquered: stars >= 3 && prev < 3, souls, systemTaken, saved, storyTower,
             refusedOffer };
  },
  /** 2-3 forks generated deterministically from the campaign seed + depth. */
  campaignOptions() {
    const c = this.campaign();
    if (!c) return [];
    const rng = this._rng(c.seed + c.depth * 2654435761);
    const count = 2 + (rng() < 0.5 ? 1 : 0);
    const opts = [];
    const usedMaps = new Set();
    for (let i = 0; i < count; i++) {
      let m = MAPS[Math.floor(rng() * MAPS.length)];
      let guard = 0;
      while (usedMaps.has(m.id) && guard++ < 8) m = MAPS[Math.floor(rng() * MAPS.length)];
      usedMaps.add(m.id);
      const diff = c.depth < 2 ? DIFFICULTIES[0] : c.depth < 5 ? DIFFICULTIES[1] : DIFFICULTIES[2];
      opts.push({
        map: m.id,
        arena: c.depth === 0 ? null : ARENA_MODS[Math.floor(rng() * ARENA_MODS.length)].id,
        rival: COMMANDERS[Math.floor(rng() * COMMANDERS.length)].id,
        boon: BOONS[Math.floor(rng() * BOONS.length)].id,
        difficulty: diff.id,
        escStart: Math.floor(c.depth / 3)
      });
    }
    return opts;
  },
  /** Victory: bank the node's boon, deepen the path, fork again. */
  campaignAdvance(game) {
    const p = this.load();
    const c = p.campaign;
    if (!c) return null;
    const node = c.chosen;
    if (node && node.boon) c.boons.push(node.boon);
    c.depth++;
    c.totalWaves += game.wave;
    c.options = this.campaignOptions();
    c.chosen = null;
    /* Victory used to bank NOTHING. campaignEnd was reachable only from defeat,
       so a player twenty nodes deep still had their starting souls. A dividend
       on every win means progress accrues from playing well, not only from
       finally losing. */
    const dividend = 0;   /* souls come from stars now, paid in recordWorld */
    this.save();
    return { advanced: true, depth: c.depth, souls: dividend,
             boon: node && BOONS.find(b => b.id === node.boon) };
  },

  /** Defeat: the galaxy SURVIVES. Losing used to null the campaign, which
      threw away a whole map of stars for one bad battle -- owner decision
      (Session 15): a defeat is a setback ON the map, not a reset OF it. The
      loss still costs: no stars, the wave payouts stop, and Game.endMatch
      lets the rivals take their move just as it does after a victory. The
      plotted course is cleared so the galaxy screen offers the choice again
      (the world's holder may just have changed hands). */
  campaignDefeat(game) {
    const p = this.load();
    const c = p.campaign;
    if (!c) return null;
    c.defeats = (c.defeats || 0) + 1;
    c.chosen = null;
    this.save();
    return { ended: false, kept: true, souls: 0, depth: c.depth,
             defeats: c.defeats, wave: game ? game.wave : 0 };
  },

  /** Souls a campaign would pay if it ended right now. */
  campaignPayout(waveNow = 0) {
    const c = this.load().campaign;
    if (!c) return 0;
    /* Depth dominates. The old formula was depth*4 + (waves)/3, and because
       waves are endless while depth below 2 is pinned to the easiest tier, it
       paid a player to park on the safest node and grind -- 90 waves at depth 0
       out-earned three real victories. The grind term is now capped relative to
       depth so advancing is always the better play. */
    const grind = Math.min(c.totalWaves + waveNow, 25 * (c.depth + 1));
    /* Stars are the real measure of a campaign -- depth alone under-counted a
       player who took worlds cleanly, and a fully conquered galaxy could pay
       out a single soul. Each star is worth banking; a conquered world (three
       of them) is worth noticeably more than three scrappy wins. */
    let stars = 0, conquered = 0;
    for (const k in (c.stars || {})) { stars += c.stars[k]; if (c.stars[k] >= 3) conquered++; }
    return Math.max(1, c.depth * c.depth + c.depth * 6 +
                       stars * 2 + conquered * 3 + Math.round(grind / 3));
  },

  /* Souls are paid the moment a star is EARNED, plus a bounty for every solar
     system taken. There is nothing to bank later, so extraction no longer
     exists. */
  /* OWNER-SET (Session 16): a map pays TWICE the stars you earned, flat 2 per
     star, so a clean sweep is 6 rather than the old doubling ladder's 21. That
     lands one fully-conquered world on exactly one TOWER_UNLOCK_COST, which is
     the pace the shop was priced for. */
  /* ══════════════════════════ ACHIEVEMENTS ═════════════════════════════
     A soul income that does not require winning. Participation counters move
     on a DEFEAT exactly as on a win, which is the whole point: a player stuck
     on a world can still earn the souls that buy the tower which unsticks
     them. */

  /** Read the counters, migrating an older profile to the full shape. */
  stats(p) {
    const prof = p || this.load();
    if (!prof.stats) prof.stats = blankAchievementStats();
    for (const k of ACHIEVEMENT_STATS) if (typeof prof.stats[k] !== 'number') prof.stats[k] = 0;
    if (!Array.isArray(prof.achievements)) prof.achievements = [];
    /* DERIVED, not bumped. `galaxies` is a state the profile already knows
       (galaxyTier rises once per galaxy claimed), so incrementing it at battle
       end would count every battle fought after the last one was taken. A
       derived counter cannot drift and needs no migration. */
    prof.stats.galaxies = prof.galaxyTier || 0;
    return prof.stats;
  },

  /** Add to counters. Pass only what moved, e.g. { battles: 1, waves: 12 }. */
  bumpStats(delta) {
    const p = this.load();
    const st = this.stats(p);
    for (const k in delta) {
      if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
      if (ACHIEVEMENT_STATS.indexOf(k) < 0) continue;      /* ignore unknown keys */
      const n = Number(delta[k]);
      if (!isFinite(n) || n <= 0) continue;                 /* counters only rise */
      st[k] += n;
    }
    return st;
  },

  /**
   * Pay every achievement whose threshold is now met and which has not been
   * paid before. Returns the rows unlocked THIS call, so the summary can name
   * them. Idempotent: an id already in `achievements` is never paid twice.
   */
  claimAchievements() {
    const p = this.load();
    const st = this.stats(p);
    const won = [];
    for (const a of ACHIEVEMENTS) {
      if (p.achievements.indexOf(a.id) >= 0) continue;
      if ((st[a.stat] || 0) < a.need) continue;
      p.achievements.push(a.id);
      p.souls += a.souls;
      won.push(a);
    }
    if (won.length) this.save();
    return won;
  },

  /** Everything the achievements screen needs, in one read. */
  achievementRows() {
    const p = this.load();
    const st = this.stats(p);
    return ACHIEVEMENTS.map(a => ({
      id: a.id, name: a.name, desc: a.desc, souls: a.souls,
      have: Math.min(st[a.stat] || 0, a.need), need: a.need,
      done: p.achievements.indexOf(a.id) >= 0
    }));
  },

  SOULS_BASE: 3,
  soulsForStar(n) { return 1; },
  /* Scaled with it: the bounty was ~1.9 worlds' worth under the old ladder and
     stays ~2 worlds' worth under the new one, instead of dwarfing every world. */
  SYSTEM_BOUNTY: 12,

  /** Voluntary retirement: kept only so old saves mid-flight still resolve. */
  /**
   * A galaxy claimed. One writer for the whole ceremony, because the tier,
   * the install's conquest ledger and the payout all have to move together
   * or the fifth banner unlocks on a run that was never finished.
   */
  claimGalaxy() {
    const p = this.load();
    const firstEver = !this.gameBeaten();
    p.galaxyTier = (p.galaxyTier || 0) + 1;
    this.vault().victories = (this.vault().victories || 0) + 1;
    this.save(true);
    const res = this.campaignExtract();
    return { souls: (res && res.souls) || 0, firstEver };
  },

  campaignExtract() {
    const p = this.load();
    if (!p.campaign) return null;
    /* The ramp pays at EXTRACTION, never per star: a bonus on the per-star
       payout would let a commander farm the opening system on APEX and walk
       away, which rewards abandoning a run rather than finishing one. */
    const R = RAMP_PRESETS[p.campaign.ramp] || RAMP_PRESETS[RAMP_DEFAULT];
    const souls = Math.round(this.campaignPayout(0) * R.soulsMul);
    const depth = p.campaign.depth;
    p.souls += souls;
    p.campaign = null;
    p.runs++;
    this.save();
    return { extracted: true, souls, depth };
  },
  /** VOLUNTARY abandon only (the battle's close button, through confirmBox):
      the campaign, its galaxy and every star on it are forfeited and the next
      campaign rolls a fresh galaxy. A battlefield defeat no longer comes here
      -- see campaignDefeat. */
  campaignEnd(game) {
    const p = this.load();
    const c = p.campaign;
    if (!c) return null;
    const souls = 0;      /* stars already paid; abandoning costs the campaign, not souls */
    p.campaign = null;
    p.runs++;
    this.save();
    return { ended: true, souls, depth: c.depth };
  },
  souls() { return this.load().souls; },

  /* ---- tower unlocks -- ONE SHELF PER BANNER ---- */
  /** The banner whose shelf the active profile spends on and reads from. */
  shelfKey() { return this.load().faction || NO_BANNER_SHELF; },
  /** The active banner's shelf, defaulted on read: an unknown faction id (an
      edited save, a power added later) gets a legal starter shelf instead of
      throwing, and the starters can never go missing from one. */
  arsenalShelf() {
    const v = this.vault();
    const k = this.shelfKey();
    const shelf = (v.unlockedBy[k] = v.unlockedBy[k] || STARTER_TOWERS.slice());
    for (const id of STARTER_TOWERS) if (!shelf.includes(id)) shelf.push(id);
    return shelf;
  },
  isTowerUnlocked(id) { return this.arsenalShelf().includes(id); },
  unlockedTowers() { return this.arsenalShelf().slice(); },

  /* ---- soul prices -- ONE definition each, printed AND charged ---- */
  /** Where one shop's ladder is booked on the active banner. */
  soulLedgerKey(kind) { return this.shelfKey() + '/' + kind; },
  /** Every purchase in a SHOP raises every later purchase in THAT shop on this
      banner. Read by the panel and by every deduction, because two expressions
      for one price is exactly how a panel came to promise 21 souls while
      paying 6. */
  soulSurcharge(kind) {
    return (this.vault().boughtBy[this.soulLedgerKey(kind)] || 0) * SOUL_INFLATION_STEP;
  },
  /** THE ONE PRICE TABLE. Every printed price and every charge is this call,
      so a price cannot be quoted from one expression and taken from another,
      and a purchase cannot be booked against a shop it was not priced in:
      `kind` is named ONCE per purchase, by chargeSouls, which prices it. */
  soulPrice(kind, id) {
    const s = this.soulSurcharge(kind);
    if (kind === 'tower') return TOWER_UNLOCK_COST + s;
    if (kind === 'unit') return UNIT_UNLOCK_COST + s;
    if (kind === 'ability') return ABILITY_UNLOCK_COST + s;
    if (kind === 'commander') {
      const c = COMMANDER_ROSTER.find(x => x.id === id);
      /* A commander outside your own faction costs more -- you are recruiting
         across a line that is supposed to mean something. */
      return (c && c.faction === this.faction() ? 12 : 18) + s;
    }
    return Infinity;   /* an unnamed shop is unaffordable, never free */
  },
  /** Price it, take the souls, and book the purchase that raises the next
      price IN THE SAME SHOP. Every buyer goes through here, so no purchase can
      escape its own ladder and none can ride another's. */
  chargeSouls(kind, id) {
    const cost = this.soulPrice(kind, id);
    const p = this.load(), v = this.vault();
    if (p.souls < cost) return false;
    p.souls -= cost;
    const k = this.soulLedgerKey(kind);
    v.boughtBy[k] = (v.boughtBy[k] || 0) + 1;
    return true;
  },
  towerUnlockCost() { return this.soulPrice('tower'); },

  /** ORIGIN GATING. A tower built by one of the three POWERS may only be
      bought while you are sworn to that power -- their arsenals are the point
      of swearing. HUMAN and ROBOTIC are open to everybody, permanently; the
      reasoning is written out in full beside TOWER_ORIGINS in factions.js.
      Returns the blocking origin record, or null when the buy is legal. */
  towerOriginLock(id) {
    const def = TOWER_TYPES[id];
    const o = def && TOWER_ORIGINS[def.origin];
    if (!o || !o.gated) return null;
    const f = this.faction();
    return (f && f === o.faction) ? null : o;
  },
  /** Gating decides what may be BOUGHT and never what you already own: an
      unlock made under a previous banner is kept for good, which is also why
      the shared vault is never filtered on read. */
  canUnlockTower(id) {
    return !this.isTowerUnlocked(id) && !this.towerOriginLock(id) && !this.towerStoryLock(id);
  },

  /* ---- the machine line: earned through the story, never sold ---- */
  isStoryTower(id) { return originOf(id).id === STORY_TOWER_ORIGIN; },
  /** The ladder in issue order. A robotic tower the order forgot is appended
      rather than becoming unreachable -- it can be neither bought nor earned
      otherwise, which is the worst of both laws. */
  storyLadder() {
    const named = ROBOTIC_UNLOCK_ORDER.filter(id => TOWER_TYPES[id]);
    return named.concat(TOWER_ORDER.filter(id => this.isStoryTower(id) && !named.includes(id)));
  },
  /** Everything still owed, next one first. */
  storyPending() { return this.storyLadder().filter(id => !this.isTowerUnlocked(id)); },
  /** How many more solar systems this machine is away; 0 once it is yours.
      The shop prints this and grantStoryTower issues from the same list, so
      the promise on the card is the promise the campaign keeps. */
  storySystemsFor(id) {
    const i = this.storyPending().indexOf(id);
    return i < 0 ? 0 : i + 1;
  },
  /** Why the shop refuses to price this one, or null. */
  towerStoryLock(id) {
    if (!this.isStoryTower(id) || this.isTowerUnlocked(id)) return null;
    return { origin: TOWER_ORIGINS[STORY_TOWER_ORIGIN], systems: this.storySystemsFor(id) };
  },
  /** Issue the next machine. Called where a solar system is recognised as
      taken and nowhere else, so it can be neither earned twice nor missed. */
  grantStoryTower() {
    const next = this.storyPending()[0];
    if (!next) return null;
    this.arsenalShelf().push(next);
    this.save();
    return next;
  },

  /* ---- muster (saved denizen) unlocks -- conquest-fed, shared vault ---- */
  /** Filtered on read so a stale save can never surface an unsendable id. */
  musterUnlocked() { return this.vault().musterUnlocked.filter(musterSendable); },
  isMusterUnlocked(id) { return musterSendable(id) && this.vault().musterUnlocked.includes(id); },
  /** Push newly-saved denizen ids into the shared vault; returns the NEW ones
      so the reward summary can report exactly what this conquest earned. */
  /** THE RESCUE GATE (roadmap 19.14). The tower origin law applied a second
      time, deliberately -- `towerOriginLock` above and this read as one rule
      about who may hold whose hardware, not as two rules that happen to look
      alike. A neutral machine answers to nobody and is legal to every banner,
      for the same reason ROBOTIC hardware is. Another power's soldiers are
      not: a Votary's life is surrendered eternally to the cause, a Xeno body
      folds back into the mass that grew it, and a pirate keeps no flag long
      enough to swear a new one.

      Returns the blocking FACTION record, or null when the rescue is legal.
      Like the tower law it gates what may be TAKEN and never what is owned --
      a unit already in the vault stays usable by every banner and every
      commander in the install, which is the whole of the Soul Profile half. */
  /**
   * THE PARALLEL'S TECHNOLOGY IS THE PRIZE, and this is the door to it.
   *
   * A secret faction's soldiers are the one set the ordinary banner law
   * cannot deliver. No world flies machine colours -- the Parallel is absent
   * from FACTION_ORDER by design -- so no world ever OFFERS a machine unit,
   * and the own-banner purchase rule then left five soldiers, a whole unit
   * doctrine (RELAY) and the temporary-lane mechanic (THE SPLICE) as content
   * no player could reach by any route. Measured before this existed:
   * `canUnlockUnit('splicer')` refused every banner, and a galaxy generated
   * for a human player contained no robot-owned world at all.
   *
   * So beating the game opens the machines' ARSENAL as well as their banner:
   * once this install has taken a galaxy, any commander may buy Parallel
   * soldiers with souls and field them under their own rite. That is the
   * lore stated as a rule -- the Parallel does not recruit, it gets copied --
   * and it is what makes RELAY and THE SPLICE live mechanics instead of
   * dead ones. The gate is the SECRET, never the banner, because a rule that
   * required swearing to the machines would hand their units only to the one
   * commander whose rite can never send them.
   */
  secretUnitOpen(id) {
    const f = unitFactionOf(id);
    return !!(f && typeof SECRET_FACTIONS !== 'undefined' &&
              SECRET_FACTIONS.indexOf(f) >= 0 && this.gameBeaten());
  },

  unitRescueLock(id) {
    const f = unitFactionOf(id);
    if (!f) return null;
    if (this.secretUnitOpen(id)) return null;
    return this.faction() === f ? null : (FACTIONS[f] || null);
  },
  /** Which of `ids` this banner is forbidden to rescue -- reported so the
      summary can name the soldiers that would not march rather than silently
      dropping them, which reads as the reward having been miscounted. */
  refusedDenizens(ids) {
    return (ids || []).filter(id => musterSendable(id) && !this.isMusterUnlocked(id) &&
                                    this.unitRescueLock(id));
  },
  saveDenizens(ids) {
    const v = this.vault();
    const fresh = [];
    for (const id of (ids || [])) {
      if (!musterSendable(id) || v.musterUnlocked.includes(id)) continue;
      if (this.unitRescueLock(id)) continue;
      v.musterUnlocked.push(id);
      fresh.push(id);
    }
    if (fresh.length) this.save();
    return fresh;
  },

  /* ---- units bought outright -- the Soul Profile half of 19.14 ---- */
  /** Bought on the SAME banner law the arsenal is bought on. Once bought the
      vault is install-wide, so the unit is usable by any faction and any
      commander from then on -- that asymmetry between the purchase and the
      use is the point of the two tiers, not an oversight. */
  unitOriginLock(id) {
    const f = unitFactionOf(id);
    if (!f) return null;
    /* Same door as the rescue gate, for the same reason -- the two locks are
       one law asked twice, and letting them disagree is how a unit becomes
       buyable on one screen and refused on the other. */
    if (this.secretUnitOpen(id)) return null;
    return this.faction() === f ? null : (FACTIONS[f] || null);
  },
  unitUnlockCost() { return this.soulPrice('unit'); },
  canUnlockUnit(id) {
    return !!(typeof UNIT_TYPES !== 'undefined' && UNIT_TYPES[id]) &&
           musterSendable(id) && !this.isMusterUnlocked(id) && !this.unitOriginLock(id);
  },
  unlockUnit(id) {
    if (!this.canUnlockUnit(id)) return false;
    /* The charge is priced by the SAME call the shop button printed from. */
    if (!this.chargeSouls('unit')) return false;
    this.vault().musterUnlocked.push(id);
    this.save(true);
    return true;
  },

  /** Mastery a unit earns from the bodies it puts in a lane. Deliberately the
      same store and the same ladder a tower's mastery uses -- addTowerXp is
      keyed by id, and masteryOf reads that key -- so the unit talent gate and
      the tower talent gate cannot drift apart. Called from the Enemy hook in
      entities2.js, which is the only place a sent body is known to be done. */
  addUnitXp(id, amount) { return this.addTowerXp(id, amount); },
  /** The profile's picked detachment, normalised: stale ids (another install,
      an edited save) are dropped, and an empty pick falls back to the first
      unlock so a battle always derives at least one tier. */
  musterLoadout() {
    const p = this.load();
    const pool = this.musterUnlocked();
    let picks = (p.musterLoadout || []).filter(id => pool.includes(id)).slice(0, MUSTER_LOADOUT_SIZE);
    if (!picks.length) picks = pool.slice(0, 1);
    return picks;
  },
  setMusterLoadout(ids) {
    const p = this.load();
    const pool = this.musterUnlocked();
    p.musterLoadout = [...new Set((ids || []).filter(id => pool.includes(id)))].slice(0, MUSTER_LOADOUT_SIZE);
    this.save();
    return p.musterLoadout.slice();
  },
  /** Toggle one pick. The last pick may not be removed: an empty detachment
      would silently fall back to the base unlock, which reads as the click
      doing nothing. Returns true when something changed. */
  toggleMuster(id) {
    if (!this.isMusterUnlocked(id)) return false;
    const cur = this.musterLoadout();
    const i = cur.indexOf(id);
    if (i >= 0) { if (cur.length <= 1) return false; cur.splice(i, 1); }
    else if (cur.length < MUSTER_LOADOUT_SIZE) cur.push(id);
    else return false;
    this.setMusterLoadout(cur);
    return true;
  },

  /* ============================== FACTION / COMMANDER / ABILITY UNLOCKS == */

  faction() { return this.load().faction; },
  setFaction(id) { const p = this.load(); p.faction = id; this.adoptShelf(id); this.save(); return id; },

  /* THE EQUIPPED COMMANDER. The session pick (UI.sel.commander) is browsing
     state and dies with the tab; this is the standing order. Validated on
     read rather than write, because the shelf is per banner: a commander
     equipped under one banner and browsed from another must not deploy
     there. */
  equipped() {
    const id = this.load().equippedCommander;
    return (id && this.isCommanderUnlocked(id)) ? id : null;
  },
  equipCommander(id) {
    if (!this.isCommanderUnlocked(id)) return false;
    const p = this.load();
    p.equippedCommander = id;
    this.save(true);
    return true;
  },

  /** Swearing to a banner takes the unsworn shelf with you. A profile can
      reach the shop before it has a faction, and stranding those unlocks on a
      shelf nothing reads again would charge souls for nothing. */
  /** THE BANNER'S OWN FIRST SOLDIER, granted once and then owned like any
      other vaulted unit. Idempotent: a profile that already has it is left
      alone, so this is safe to call on every load and every banner change,
      and an EXISTING save picks its starter up the first time it swears. */
  grantStarterDenizen(faction, vaultRef) {
    if (typeof starterDenizenOf !== 'function') return null;
    const id = starterDenizenOf(faction);
    if (!id) return null;
    /* `vaultRef` exists so a CALLER ALREADY INSIDE vault() can hand its own
       object in. Calling this.vault() from within vault()'s own migration
       block is unbounded recursion -- a stack overflow, which on this project
       presents as exactly the freeze this session is chasing. */
    const v = vaultRef || this.vault();
    if (!Array.isArray(v.musterUnlocked)) v.musterUnlocked = MUSTER_BASE_UNLOCK.slice();
    if (v.musterUnlocked.includes(id)) return null;
    v.musterUnlocked.push(id);
    /* And put it IN the detachment, not merely in the vault. A unit sitting
       unslotted changes nothing: musterLoadout() only ever returns what was
       picked, so the rites would still be reading a list of one. */
    const p = this.load();
    if (!Array.isArray(p.musterLoadout)) p.musterLoadout = [];
    if (p.musterLoadout.length < MUSTER_LOADOUT_SIZE && !p.musterLoadout.includes(id)) {
      /* The crawler comes first only because it was there first; a sworn
         banner leads with its own. */
      p.musterLoadout = [id].concat(p.musterLoadout.filter(x => x !== id))
                            .slice(0, MUSTER_LOADOUT_SIZE);
    }
    this.save();
    return id;
  },

  adoptShelf(id) {
    if (!id) return;
    this.grantStarterDenizen(id);
    const v = this.vault();
    const from = v.unlockedBy[NO_BANNER_SHELF] || [];
    const to = (v.unlockedBy[id] = v.unlockedBy[id] || STARTER_TOWERS.slice());
    for (const t of from) if (!to.includes(t)) to.push(t);
    /* Every shop's unsworn ladder travels with it. Missing one would forgive
       that shop's bill for swearing late, and writing the retired flat key
       would be a silent no-op -- nothing reads it any more. */
    for (const kind of SOUL_SHOP_KINDS) {
      const fk = NO_BANNER_SHELF + '/' + kind, tk = id + '/' + kind;
      v.boughtBy[tk] = (v.boughtBy[tk] || 0) + (v.boughtBy[fk] || 0);
      v.boughtBy[fk] = 0;
    }
    v.unlockedBy[NO_BANNER_SHELF] = STARTER_TOWERS.slice();
    /* The commander and ability shelves adopt identically -- a recruit made
       before swearing would otherwise be stranded on a shelf nothing reads. */
    const cFrom = v.cmdUnlockedBy[NO_BANNER_SHELF] || [];
    const cTo = (v.cmdUnlockedBy[id] = v.cmdUnlockedBy[id] || alwaysUnlocked());
    for (const c of cFrom) if (!cTo.includes(c)) cTo.push(c);
    const aFrom = v.abilUnlockedBy[NO_BANNER_SHELF] || [];
    const aTo = (v.abilUnlockedBy[id] = v.abilUnlockedBy[id] || []);
    for (const a of aFrom) if (!aTo.includes(a)) aTo.push(a);
    v.cmdUnlockedBy[NO_BANNER_SHELF] = alwaysUnlocked();
    v.abilUnlockedBy[NO_BANNER_SHELF] = [];
  },

  /** The active banner's commander shelf, defaulted on read: an unknown
      banner gets a legal starter roster instead of throwing, and the free
      commanders can never go missing from one. Mirrors arsenalShelf(). */
  cmdShelf() {
    const v = this.vault();
    const k = this.shelfKey();
    const shelf = (v.cmdUnlockedBy[k] = v.cmdUnlockedBy[k] || alwaysUnlocked());
    for (const id of alwaysUnlocked()) if (!shelf.includes(id)) shelf.push(id);
    return shelf;
  },
  abilShelf() {
    const v = this.vault();
    const k = this.shelfKey();
    return (v.abilUnlockedBy[k] = v.abilUnlockedBy[k] || []);
  },

  isCommanderUnlocked(id) { return this.cmdShelf().includes(id); },
  commanderCost(id) { return this.soulPrice('commander', id); },
  unlockCommander(id) {
    const shelf = this.cmdShelf();
    if (shelf.includes(id)) return false;
    /* The charge is priced by the SAME call the shop button printed from. */
    if (!this.chargeSouls('commander', id)) return false;
    shelf.push(id);
    this.save(true);
    return true;
  },

  /** The second (defensive) ability unlocks with a full chart, or with souls. */
  hasSecondAbility(cmdId) {
    if (this.abilShelf().includes(cmdId)) return true;
    const c = COMMANDER_ROSTER.find(x => x.id === cmdId);
    if (!c) return false;
    return c.tech.every(t => this.isUnlocked(cmdId, t.id));
  },
  abilityCost() { return this.soulPrice('ability'); },

  /** First encounter with an enemy type. Returns true exactly once, forever. */
  markSeen(type) {
    const p = this.load();
    if (p.seenEnemies.includes(type)) return false;
    p.seenEnemies.push(type);
    this.save();
    return true;
  },

  /* ========================================================= PRESTIGE ====
     A MAXED commander (every node on their technology chart unlocked) can be
     prestiged: their level and chart reset, they gain a permanent star (five
     at most), a stacking flat bonus keyed to their faction, and every numeric
     talent value they will ever take is worth 20% more per star. */
  prestigeOf(id) { return (this.load().prestige || {})[id] || 0; },
  canPrestige(id) {
    const c = COMMANDER_ROSTER.find(x => x.id === id);
    if (!c || this.prestigeOf(id) >= 5) return false;
    return c.tech.every(t => this.isUnlocked(id, t.id));
  },
  doPrestige(id) {
    if (!this.canPrestige(id)) return null;
    const p = this.load();
    p.prestige[id] = (p.prestige[id] || 0) + 1;
    p.commanders[id].unlocked = [];
    p.commanders[id].xp = 0;
    this.save(true);
    return { stars: p.prestige[id] };
  },
  unlockAbility(cmdId) {
    const shelf = this.abilShelf();
    if (shelf.includes(cmdId)) return false;
    /* The raw constant used to be charged here while the shop printed
       abilityCost(). They were equal, which is why it survived -- and the
       moment a surcharge landed on one of them they would have parted. */
    if (!this.chargeSouls('ability')) return false;
    shelf.push(cmdId);
    this.save(true);
    return true;
  },
  unlockTower(id) {
    if (this.isTowerUnlocked(id)) return false;
    /* Refused at the store, not merely hidden in the shop -- the shop SHOWS
       locked entries, so the button exists and has to be honest. A machine is
       refused for a second reason: it has no price to pay at all. */
    if (this.towerOriginLock(id) || this.towerStoryLock(id)) return false;
    if (!this.chargeSouls('tower')) return false;
    this.arsenalShelf().push(id);
    this.save();
    return true;
  },
  /* SOUL LEVELS RETIRED. `soulCmdCost` / `soulTowerCost` / `soulLevels` /
     `soulPower` / `buySoulCmd` / `buySoulTower` lived here until this patch.
     Session 11 made the soul shop unlocks-only and deleted every call site,
     so `p.soulTower` had no writer, `soulLevels()` returned {} for every
     profile made since, and `soulPower`'s +7.5% damage / +3.5% rate was
     unreachable -- including the rival's mirror of it, which averaged an
     empty dictionary and made half of ROADMAP:204's parity clause vacuous on
     both sides. The path is deleted rather than re-homed onto (fight-earned)
     mastery: re-homing is a live balance change to both calibrated pins, not
     a dead-code fix. Souls buy commanders, second abilities and arsenal
     slots; mastery gates talents. Both are weight the engine reads. */

  xpForLevel(n) { return n <= 1 ? 0 : Math.round(190 * Math.pow(n - 1, 1.45)); },
  levelOf(id) {
    const xp = this.load().commanders[id].xp;
    let lvl = 1;
    while (lvl < 40 && xp >= this.xpForLevel(lvl + 1)) lvl++;
    return lvl;
  },
  progress(id) {
    const xp = this.load().commanders[id].xp;
    const lvl = this.levelOf(id);
    const cur = this.xpForLevel(lvl), next = this.xpForLevel(lvl + 1);
    return { level: lvl, xp, into: xp - cur, need: next - cur, frac: (xp - cur) / Math.max(1, next - cur) };
  },

  spentIn(id) {
    const c = this.load().commanders[id];
    const cmd = COMMANDERS.find(x => x.id === id);
    return c.unlocked.reduce((s, tid) => s + (cmd.tech.find(t => t.id === tid) || { cost: 0 }).cost, 0);
  },
  pointsAvailable(id) { return this.levelOf(id) - this.spentIn(id); },
  /** Every talent this commander could legally take RIGHT NOW. */
  spendableTech(id) {
    const cmd = COMMANDERS.find(x => x.id === id);
    return cmd ? cmd.tech.filter(t => this.canUnlock(id, t.id)) : [];
  },
  /* A level is only worth sending the player to the chart for if the chart
     can accept it. Routing on `pointsAvailable` alone would drag a maxed
     commander to a screen with nothing to click after every single run --
     the tree is finished, the levels still pay, and the points are banked
     for a prestige that resets them. Asking what is UNLOCKABLE answers the
     question the route is actually about, and one call answers it for both
     the end screen and the button that leads there, so the count printed
     and the count the tree will honour cannot drift apart. */
  levelUpAward(id, levelsGained) {
    const levels = Math.max(0, levelsGained | 0);
    const spendable = this.spendableTech(id).length;
    return { commander: id, levels, level: this.levelOf(id),
             points: this.pointsAvailable(id), spendable,
             route: levels > 0 && spendable > 0 };
  },
  isUnlocked(id, techId) { return this.load().commanders[id].unlocked.includes(techId); },

  /** The node directly above this one, which acts as its prerequisite. */
  parentOf(cmd, node) {
    return node.row === 0 ? null : cmd.tech.find(t => t.col === node.col && t.row === node.row - 1);
  },

  /** Gated by points available, by the node above, and by total points spent. */
  lockReason(id, techId) {
    const cmd = COMMANDERS.find(x => x.id === id);
    const node = cmd.tech.find(t => t.id === techId);
    if (!node) return 'unknown';
    if (this.isUnlocked(id, techId)) return 'owned';
    const gate = TALENT_ROW_GATE[node.row] || 0;
    if (this.spentIn(id) < gate) return `requires ${gate} points spent`;
    const parent = this.parentOf(cmd, node);
    if (parent && !this.isUnlocked(id, parent.id)) return `requires ${parent.name}`;
    if (this.pointsAvailable(id) < node.cost) return 'not enough points';
    return null;
  },
  canUnlock(id, techId) { return this.lockReason(id, techId) === null; },

  unlock(id, techId) {
    if (!this.canUnlock(id, techId)) return false;
    this.load().commanders[id].unlocked.push(techId);
    this.save();
    return true;
  },
  resetTree(id) { this.load().commanders[id].unlocked = []; this.save(); },

  addXp(id, amount) {
    const d = this.load();
    const before = this.levelOf(id);
    d.commanders[id].xp += Math.max(0, Math.round(amount));
    this.save();
    return { gained: Math.round(amount), levelsGained: this.levelOf(id) - before, level: this.levelOf(id) };
  },
  /* The 700 is the bonus for TAKING the world, and the world is taken when
     no rival still stands -- not when seat 1 happens to be dead. On a tri
     board or in the arena the ordinary path (you eliminate one rival, another
     kills you) satisfied the old test, so a defeat was paid the full victory
     bonus: a measured wave-10 arena loss with eighteen seats still standing
     banked 1320 XP, byte-identical to a genuine twenty-seat win. `won` comes
     from Game.endMatch, which is the one place the result is decided; the
     fallback keeps the reading honest for any caller that does not know it,
     and on a duel every form of the test agrees. BATCH-C/nside */
  xpForRun(game, won) {
    const s = game.sides[0];
    const took = won === undefined
      ? game.sides.slice(1).every(x => x.defeated || x.lives <= 0)
      : !!won;
    return game.wave * 62 + s.stats.kills * 1.1 + s.stats.sent * 0.7 + (took ? 700 : 0);
  },

  /* ---- per-tower talent allocation (pre-match, 2 points each) ---- */

  talentsOf(towerId) { return this.load().talents[towerId] || []; },
  talentSpent(towerId) { return this.talentsOf(towerId).length; },
  hasTalent(towerId, tid) { return this.talentsOf(towerId).includes(tid); },

  /** The record a talent tree is spent in. Towers and UNITS are the same shape
      by construction (UNIT_TYPES is authored to it), so one lookup lets the
      mastery gate, the row gate, the stock build and the partial-allocation
      merge serve both -- rather than a second allocator drifting out of step
      with this one, which is what "reuse the tower talent shape" is for. */
  talentDefOf(id) {
    return TOWER_TYPES[id] ||
           ((typeof UNIT_TYPES !== 'undefined' && UNIT_TYPES[id]) || null);
  },

  talentLockReason(towerId, tid) {
    const def = this.talentDefOf(towerId);
    if (!def) return 'unknown';
    const node = def.talents.find(t => t.id === tid);
    if (!node) return 'unknown';
    if (this.hasTalent(towerId, tid)) return 'owned';
    const req = this.talentMasteryReq(node);
    if (this.masteryOf(towerId) < req) return 'mastery ' + req;
    if (this.talentSpent(towerId) >= TALENT_POINTS) return 'no points left';
    if (node.row > 0) {
      const above = def.talents.filter(t => t.row === node.row - 1).map(t => t.id);
      if (!above.some(u => this.hasTalent(towerId, u))) return 'row above first';
    }
    return null;
  },
  canTakeTalent(towerId, tid) { return this.talentLockReason(towerId, tid) === null; },
  takeTalent(towerId, tid) {
    if (!this.canTakeTalent(towerId, tid)) return false;
    (this.load().talents[towerId] = this.talentsOf(towerId)).push(tid);
    /* A unit's folded doctrine is cached on its BUILD, and this is the only
       place a build changes. Dropping it here is what stops the loadout card
       quoting the pack size the unit had before the click. */
    if (typeof clearUnitFieldCache === 'function') clearUnitFieldCache();
    this.save();
    return true;
  },
  clearTalents(towerId) {
    this.load().talents[towerId] = [];
    if (typeof clearUnitFieldCache === 'function') clearUnitFieldCache();
    this.save();
  },

  /**
   * The resolved talent mods a tower deploys with. A tower the player has
   * never touched deploys with a sensible DEFAULT build rather than nothing
   * the rival always brings a full allocation, so an empty tree would quietly
   * handicap anyone who skipped the talent screen.
   */
  /* Spending your FIRST talent point used to make a tower WEAKER: an untouched
     tower deployed with a three-node stock build, but the moment one point was
     spent the stock build was discarded entirely and the tower deployed with
     one. The trap landed squarely on the curious player, and nothing warned
     them. Saved picks now merge OVER the stock build instead of replacing it,
     so a partial allocation is never worse than none. */
  talentMods(towerId) {
    const def = this.talentDefOf(towerId);
    if (!def) return [];
    const saved = this.talentsOf(towerId)
      .map(tid => def.talents.find(t => t.id === tid))
      .filter(Boolean);
    if (!saved.length) return this.defaultTalents(towerId);
    const out = saved.slice();
    const rows = new Set(out.map(t => t.row || 0));
    for (const t of this.defaultTalents(towerId))
      if (!rows.has(t.row || 0) && out.length < TALENT_POINTS) { out.push(t); rows.add(t.row || 0); }
    return out;
  },

  /** One talent per row, taking the first option, a reasonable stock build. */
  defaultTalents(towerId) {
    const def = this.talentDefOf(towerId);
    if (!def) return [];
    const mastery = this.masteryOf(towerId);
    const out = [];
    for (const row of [0, 1, 2]) {
      const opt = def.talents.find(t => t.row === row && t.col === 0);
      if (opt && out.length < TALENT_POINTS &&
          mastery >= this.talentMasteryReq(opt)) out.push(opt);
    }
    return out;
  },
  /** True when the player has not customised this tower's tree. */
  usingDefaults(towerId) { return this.talentSpent(towerId) === 0; },

  /** Total tech points the player has actually committed on a commander. */
  techSpent(commanderId) {
    const cmd = COMMANDERS.find(c => c.id === commanderId);
    if (!cmd) return 0;
    let n = 0;
    for (const t of cmd.tech) if (this.isUnlocked(cmd.id, t.id)) n += t.cost;
    return n;
  },

  applyTo(side, commanderId) {
    const cmd = COMMANDERS.find(c => c.id === commanderId) || COMMANDERS[0];
    side.commander = cmd;
    side.traits = freshTraits();
    side.prestigeStars = this.prestigeOf(cmd.id);
    cmd.trait.apply(side.traits, side, side.mods);
    for (const t of cmd.tech) if (this.isUnlocked(cmd.id, t.id)) t.apply(side.traits, side, side.mods);
    foldTraits(side);
    applyPrestigeBonus(side, cmd.faction || this.faction() || 'human', side.prestigeStars);
    initAbilities(side, cmd, this.hasSecondAbility(cmd.id));
    return cmd;
  },

  applyToAI(side, commanderId, techDepth) {
    const cmd = COMMANDERS.find(c => c.id === commanderId) || COMMANDERS[1];
    side.commander = cmd;
    side.traits = freshTraits();
    cmd.trait.apply(side.traits, side, side.mods);
    /* Walk columns top-down so prerequisites are always satisfied. */
    const sorted = cmd.tech.slice().sort((a, b) => a.row - b.row || a.col - b.col);
    let budget = techDepth;
    for (const t of sorted) {
      if (budget < t.cost) continue;
      t.apply(side.traits, side, side.mods);
      budget -= t.cost;
    }
    foldTraits(side);
    /* The rival gets both abilities once it is deep enough to have earned them. */
    initAbilities(side, cmd, techDepth >= 10);
    return cmd;
  }
};
