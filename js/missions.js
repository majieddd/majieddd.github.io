/* ==========================================================================
   COSMIC CONQUEST, THE ARCHIVE WAR MISSION LAYER
   --------------------------------------------------------------------------
   Canon: docs/lore/docs/game/archive-war-mission-seeds.md, generated into
   LORE.archiveWarMissions (37 entries, AW-01 to AW-37). This module is
   AUTHORED, like js/story.js and unlike js/lore.js.

   WHY IT EXISTS. A generated world currently states its terrain, its kind,
   its holder and its scenario, and every one of those is a rule. None of them
   is a reason. The canon supplies 37 authored scenario seeds whose entire
   purpose is to make an individual world read as written rather than rolled,
   and until now nothing in the game could reach them.

   WHAT IT IS NOT. It is presentation only. Nothing here is read by the
   simulation, nothing enters the lockstep fingerprint, nothing touches a save
   key, a balance number, a campaign seed or NET_PROTOCOL, and NOTHING DRAWS
   FROM Math.random. That last one is not a style preference: Math.random is
   replaced by a seeded PRNG during multiplayer, so a single draw from a
   briefing card would desync every duel that hovered it. There is no call to
   Math.random in this file, and selfCheck asserts the assignment is
   reproducible, which is the observable form of the same promise.

   HOW A MISSION IS CHOSEN, AND WHY THAT IS SAFE
   ---------------------------------------------
   Every mission names an exact battlefield, an exact world kind and an exact
   commander. A generated world already carries a map id, a kind and a holder.
   The match is therefore a JOIN on fields that already exist, not a new roll:

     world.map    joins mission.battlefield   (REQUIRED, the hard gate)
     world.kind   joins mission.world_kind    (worth 40)
     the world's commander joins mission.commander (worth 25, or 12 when only
                                              the faction agrees)
     a small index nudge (worth 3) so equal candidates spread across systems
                                              instead of clumping on system 0

   The battlefield is a hard gate on purpose. It is the anchor the canon
   author actually chose, and eight of the 28 shipping maps have no mission
   written for them. A world on one of those eight has no authored mission and
   must say so by returning null, because inventing a fit is how a lore layer
   starts contradicting the lore.

   NEVER THE SAME MISSION TWICE IN ONE GALAXY. The assignment is computed for
   the WHOLE galaxy at once, as a stable greedy maximal matching: score every
   legal (world, mission) pair, sort by score then world order then mission
   order, and take pairs whose world and mission are both still free. Each
   mission id is consumed once, so a galaxy can never show one twice. The
   comparator is total (no two pairs share all three keys), so the result does
   not depend on sort stability.

   NO CACHE, ON PURPOSE. forWorld recomputes the whole assignment on every
   call. It is 35 worlds against 37 missions, so about 1,300 integer
   comparisons and a short sort, which is far below a frame at hover rates. A
   memo would be observationally pure and would still be hidden state, and
   hidden state is the thing this module is not allowed to have.

   DEGRADES TO SILENCE. If LORE is undefined, or has no archiveWarMissions,
   the list is empty, every accessor returns null or an empty array, and a
   page that has not rebuilt renders exactly what it rendered before.

   THE EDITORIAL RULE THIS FILE ENFORCES
   -------------------------------------
   These missions draw on real UFO, contactee and government-secrecy records.
   The canon's own guardrails are explicit: a historical source can inspire an
   invented event without becoming evidence for it, "classified" means access
   is restricted rather than "alien", and "unresolved" means the evidence is
   insufficient rather than "extraterrestrial". Nothing surfaced here may read
   as verified alien history.

   Three things enforce that, and they are structural rather than a matter of
   an editor remembering:

     1. EVERY mission surfaced carries its evidence layer in words. The canon
        grades each seed on an A to F ladder and then ships the bare letters,
        which mean nothing to a player. AW_EVIDENCE turns them into plain
        language ("authentic record, attribution unresolved", "invented for
        this war"), so where the record stops is printed on the card by
        construction, not by memory.
     2. EVERY mission surfaced carries a caution line stating what the archive
        is claiming. Seeds graded D or E (traceable fringe, contactee, forged,
        circular) get the stronger form and are flagged `sensitive`, and that
        flag is DERIVED from the grade rather than hand listed, so a future
        lore release cannot quietly add a D grade that misses the warning.
     3. Three premises are reframed below, with the reason recorded at each.
        The canon text is never mutated: LORE is frozen and is the source of
        truth. AW_REFRAME is a local display override, and selfCheck asserts
        every key in it still names a real mission, so a reframe cannot
        silently outlive the seed it was written for.

   Audited all 37 premises against the guardrails. The canon is already
   careful ("alleged ground traces", "records modeled on", "reported as
   showing", "a document can be archived and investigated without being
   authentic"), so the reframes are few and specific rather than a rewrite.
   ========================================================================== */

'use strict';

/* The canon's evidence ladder, from the lore bible's own definitions, said in
   the words a briefing card can print. The letters are the join to canon and
   are never renamed; only the gloss is authored here. */
const AW_LADDER = 'ABCDEF';
const AW_EVIDENCE = {
  A: 'documented core',
  B: 'authentic record, attribution unresolved',
  C: 'documented belief history',
  D: 'traceable fringe or contactee claim',
  E: 'contaminated, forged, or circular',
  F: 'invented for this war'
};

/* Weights. Only the relative order matters: a battlefield match outranks
   everything, kind outranks commander, and the spread nudge is small enough
   that it can only break a tie between otherwise identical candidates. */
const AW_W = { field: 100, kind: 40, commander: 25, faction: 12, spread: 3 };

/* DISPLAY OVERRIDES, three of them, each with its reason. The canon text is
   left untouched in LORE; this table only changes what a player reads. */
const AW_REFRAME = {

  /* Canon ships the bare grade letter inside the prose: "the future coordinate
     interpretation is F". A player has no ladder to read that against, so the
     sentence lands as a typo instead of as the disclosure it is. Said in
     words, and the authenticity claim is attached to the paperwork rather
     than to the sighting, which is what the grade actually means. */
  'AW-01': {
    premise: 'A Blue Book residual acquires meaning only once a Lattice coordinate frame is recovered. The file is a genuine record of a report. The coordinate reading laid over it is invented for this war, not a finding about the file.'
  },

  /* Canon: "A Navy denial confirms responsive classified UAP photographs
     existed but not what they depict." Read cold, that is a flat historical
     assertion about a real service, and the verb "confirms" does work the
     record does not support. A refusal to release acknowledges that matching
     files exist. It is not testimony about their contents. */
  'AW-11': {
    premise: 'A refusal to release acknowledges that classified images matching the request exist. It says nothing about what is in them, and the archive is required to treat that silence as silence.'
  },

  /* Canon opens with "Historical records describe", which invites the player
     to read the line as OUR history rather than as the game's archive, and
     the seed is about a real installation. Named as base records, with the
     split stated outright: the reports are in the file, what was over the
     site is not. */
  'AW-16': {
    premise: 'Base records describe unidentified craft reported near a weapons site, and an interception attempt. The reports are in the file. What was over the site is not.'
  }
};

/* The standing frames. The first is printed on every mission, the second
   replaces it wherever the evidence grade admits fringe, contactee, forged or
   circular material, and the third is appended wherever part of the seed is
   this game's own invention. */
const AW_FRAME_RECORD =
  'A record, not a verdict. The archive keeps what was filed, not what was true.';
const AW_FRAME_DISPUTED =
  'Disputed at the source. Sincerity, fraud, and later mythology are three separate questions here, and the file does not settle any of them.';
const AW_FRAME_INVENTED =
  'Part of this seed is invented for this war. The evidence line marks where the record stops.';

/**
 * Expand a canon evidence field into its letters. The generated data uses
 * three shapes: a single letter ("B"), a slash list ("A/B", "D/E"), and a
 * range ("B-D", meaning B through D). Anything unrecognised yields nothing
 * rather than throwing, so a future grade cannot break a briefing card.
 */
function awGrades(raw) {
  const out = [];
  if (typeof raw !== 'string') return out;
  const push = ch => { if (AW_LADDER.indexOf(ch) >= 0 && out.indexOf(ch) < 0) out.push(ch); };
  raw.toUpperCase().split('/').forEach(tok => {
    const t = tok.replace(/[^A-F-]/g, '');
    const dash = t.indexOf('-');
    if (dash > 0 && dash < t.length - 1) {
      const a = AW_LADDER.indexOf(t.charAt(dash - 1));
      const b = AW_LADDER.indexOf(t.charAt(dash + 1));
      if (a >= 0 && b >= a) { for (let i = a; i <= b; i++) push(AW_LADDER.charAt(i)); return; }
    }
    for (let i = 0; i < t.length; i++) push(t.charAt(i));
  });
  return out;
}

/** One display line naming the layers this seed sits on, in plain language. */
function awEvidenceLine(raw) {
  const g = awGrades(raw);
  if (!g.length) return '';
  const parts = g.map(ch => AW_EVIDENCE[ch]);
  const body = parts.length === 1 ? parts[0]
             : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  return 'Layer ' + g.join('/') + ': ' + body + '.';
}

/** What the archive is claiming, and what it is not. */
function awCaution(grades) {
  const disputed = grades.indexOf('D') >= 0 || grades.indexOf('E') >= 0;
  const line = [disputed ? AW_FRAME_DISPUTED : AW_FRAME_RECORD];
  if (grades.indexOf('F') >= 0) line.push(AW_FRAME_INVENTED);
  return line.join(' ');
}

/* --------------------------------------------------------------------------
   THE LIST
   Built once at load into PLAIN objects of this module's own. LORE is frozen
   and is the source of truth, so nothing here writes back to it, and the
   scoring index a matcher needs lives on the copy rather than on the canon.
-------------------------------------------------------------------------- */
const AW_MISSIONS = (function () {
  const src = (typeof LORE !== 'undefined' && LORE && LORE.archiveWarMissions) || null;
  if (!src) return [];
  /* The generator currently emits an object keyed by id. It has emitted an
     array before, and the ids are zero padded (AW-01), so sorting the keys
     gives canonical order under either shape and does not depend on the
     generator's emission order. */
  const rows = Array.isArray(src)
    ? src.slice()
    : Object.keys(src).sort().map(k => src[k]);

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if (!m || !m.id) continue;
    const grades = awGrades(m.evidence);
    const over = AW_REFRAME[m.id] || {};
    out.push(Object.freeze({
      id: m.id,
      name: m.name || m.id,
      /* DISPLAY READY. Reframed where the audit found a line that could read
         as a verified historical claim, otherwise the canon's own words. */
      premise: over.premise || m.premise || '',
      objective: over.objective || m.objective || '',
      /* The record status, always present, never optional. */
      evidence: m.evidence || '',
      evidenceLine: awEvidenceLine(m.evidence),
      grades: Object.freeze(grades),
      sensitive: grades.indexOf('D') >= 0 || grades.indexOf('E') >= 0,
      caution: awCaution(grades),
      /* Pass through, for a caller that wants to draw the anchors. NOTE for
         whoever renders these: 23 of the 24 distinct anchors are tower ids,
         and `jammer` (AW-04) is an ENEMY id, so resolve against both tables
         and skip what neither knows. */
      commander: m.commander || null,
      battlefield: m.battlefield || null,
      worldKind: m.world_kind || null,
      anchors: Object.freeze((m.asset_anchors || []).slice()),
      /* Position in canonical order. Used by the spread nudge and by the
         total-order tiebreak, so the matching cannot depend on object key
         enumeration. */
      index: out.length
    }));
  }
  return Object.freeze(out);
})();

const AW_BY_ID = (function () {
  const map = Object.create(null);
  for (let i = 0; i < AW_MISSIONS.length; i++) map[AW_MISSIONS[i].id] = AW_MISSIONS[i];
  return map;
})();

/* --------------------------------------------------------------------------
   THE MATCH
-------------------------------------------------------------------------- */

/**
 * The lookups the scorer needs, resolved once per assignment.
 *
 * Both are OPTIONAL by design. worldBossOf and COMMANDER_ROSTER live in other
 * modules, and this file has to load and answer in a probe that has loaded
 * nothing else. When they are absent the commander signal simply scores zero
 * and the battlefield and kind signals still decide the match.
 */
function awContext() {
  const faction = Object.create(null);
  try {
    if (typeof COMMANDER_ROSTER !== 'undefined' && Array.isArray(COMMANDER_ROSTER))
      for (let i = 0; i < COMMANDER_ROSTER.length; i++) {
        const c = COMMANDER_ROSTER[i];
        if (c && c.id) faction[c.id] = c.faction || null;
      }
  } catch (e) { /* no roster loaded, commander faction signal stays silent */ }

  return {
    factionOf: id => faction[id] || null,
    /* Who actually commands THIS world. galaxy.js derives it from the world
       index rather than from a draw, so calling it costs the PRNG nothing.
       sys.boss is the fallback, and it is the right one: it is what
       worldBossOf itself returns for every world the holder still owns. */
    bossOf: (sys, w) => {
      try {
        if (typeof worldBossOf === 'function') return worldBossOf(sys, w);
      } catch (e) { /* fall through */ }
      return (sys && sys.boss) || null;
    }
  };
}

/**
 * How well one mission fits one world. Zero means no fit at all, and zero is
 * the common answer: the battlefield is a hard gate, so a mission only scores
 * on the exact map it was written for.
 */
function awScore(m, w, sys, ctx) {
  if (!m || !w || !m.battlefield || m.battlefield !== w.map) return 0;
  let s = AW_W.field;
  if (m.worldKind && m.worldKind === w.kind) s += AW_W.kind;
  if (m.commander) {
    const boss = ctx.bossOf(sys, w);
    if (boss && boss === m.commander) s += AW_W.commander;
    else if (ctx.factionOf(m.commander) === w.owner) s += AW_W.faction;
  }
  /* Spread. Without it, two worlds on the same map in different systems both
     want the lowest-indexed mission and the greedy pass hands the good ones
     to system 0 every time. Pure index arithmetic, no draw. */
  const si = (sys && typeof sys.index === 'number') ? sys.index : 0;
  if (AW_MISSIONS.length && (m.index % 5) === (si % 5)) s += AW_W.spread;
  return s;
}

/**
 * Assign missions across a WHOLE galaxy at once. Returns a plain object
 * mapping world id to mission id, containing only the worlds that matched.
 *
 * Whole-galaxy is the only way to keep the no-repeats promise while staying a
 * pure function: uniqueness is a property of the set, so the set is what gets
 * computed. The greedy pass over a score-sorted candidate list is a stable
 * maximal matching, and the comparator is total, so two calls on equal
 * galaxies return equal answers on any engine.
 */
function awAssign(galaxy) {
  const out = Object.create(null);
  if (!AW_MISSIONS.length || !galaxy || !Array.isArray(galaxy.systems)) return out;

  const ctx = awContext();
  const pairs = [];
  for (let si = 0; si < galaxy.systems.length; si++) {
    const sys = galaxy.systems[si];
    const worlds = (sys && Array.isArray(sys.worlds)) ? sys.worlds : [];
    for (let wi = 0; wi < worlds.length; wi++) {
      const w = worlds[wi];
      if (!w || !w.id) continue;
      const order = si * 1024 + wi;
      for (let mi = 0; mi < AW_MISSIONS.length; mi++) {
        const s = awScore(AW_MISSIONS[mi], w, sys, ctx);
        if (s > 0) pairs.push({ s: s, order: order, mi: mi, wid: w.id });
      }
    }
  }

  pairs.sort((a, b) => (b.s - a.s) || (a.order - b.order) || (a.mi - b.mi));

  const usedW = Object.create(null), usedM = Object.create(null);
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (usedW[p.wid] || usedM[p.mi]) continue;
    usedW[p.wid] = 1;
    usedM[p.mi] = 1;
    out[p.wid] = AW_MISSIONS[p.mi].id;
  }
  return out;
}

/* --------------------------------------------------------------------------
   A SYNTHETIC GALAXY, for selfCheck only.
   Built from the mission table itself so a probe can assert the matching
   without loading galaxy.js, config.js or a seed. Deterministic by
   construction: every field is index arithmetic.
-------------------------------------------------------------------------- */
function awProbeGalaxy() {
  const fields = [];
  for (let i = 0; i < AW_MISSIONS.length; i++)
    if (AW_MISSIONS[i].battlefield && fields.indexOf(AW_MISSIONS[i].battlefield) < 0)
      fields.push(AW_MISSIONS[i].battlefield);
  /* One map with no mission written for it, so the probe also exercises the
     null path rather than only the matching path. */
  fields.push('__no-mission__');

  const kinds = ['standard', 'fortress', 'forge', 'nest'];
  const owners = ['human', 'light', 'xeno', 'pirate'];
  const systems = [];
  for (let si = 0; si < 5; si++) {
    const worlds = [];
    for (let wi = 0; wi < 7; wi++) {
      const n = si * 7 + wi;
      worlds.push({
        id: 's' + si + 'w' + wi, si: si, wi: wi,
        map: fields[n % fields.length],
        kind: kinds[n % kinds.length],
        owner: owners[n % owners.length],
        seat: wi === 6
      });
    }
    systems.push({ id: 'sys' + si, index: si, holder: owners[si % owners.length],
                   boss: null, worlds: worlds });
  }
  return { seed: 0, playerFaction: 'human', raider: 'pirate', systems: systems };
}

/* --------------------------------------------------------------------------
   THE PUBLIC SURFACE
-------------------------------------------------------------------------- */
const Missions = {

  /** Every authored seed, in canonical order. Empty when LORE is absent. */
  all() { return AW_MISSIONS; },

  /** How many seeds the canon supplied. Zero when LORE is absent. */
  count() { return AW_MISSIONS.length; },

  /** One seed by its stable id, or null. */
  get(id) { return AW_BY_ID[id] || null; },

  /**
   * The mission assigned to this world, or null when the canon wrote none for
   * this battlefield. The galaxy argument is REQUIRED and is not decoration:
   * the no-repeats promise is a property of the galaxy, so without it there is
   * no honest answer and the honest answer is null.
   *
   * PURE. Same world, same galaxy, same mission, every call, no draws.
   */
  forWorld(world, sys, galaxy) {
    if (!world || !world.id || !galaxy) return null;
    const id = awAssign(galaxy)[world.id];
    return id ? (AW_BY_ID[id] || null) : null;
  },

  /**
   * The whole assignment in one pass: world id to mission object, containing
   * only worlds that matched. Prefer this over forWorld when painting a map,
   * so the matching runs once for the frame rather than once per world.
   */
  forGalaxy(galaxy) {
    const ids = awAssign(galaxy);
    const out = Object.create(null);
    for (const wid in ids) out[wid] = AW_BY_ID[ids[wid]] || null;
    return out;
  },

  /** The evidence ladder in words, for a legend or a codex page. */
  ladder() {
    return AW_LADDER.split('').map(ch => ({ grade: ch, label: AW_EVIDENCE[ch] }));
  },

  /** Turn a raw canon grade string ("A/B", "B-D") into a display line. */
  evidenceLine(raw) { return awEvidenceLine(raw); },

  /**
   * Assertions a probe can run. Pass a real galaxy to check the matching
   * against live generation; with no argument it builds its own deterministic
   * galaxy and checks against that.
   *
   * Returns { ok, degraded, checks, failures }. `degraded` true means LORE was
   * absent, which is a PASS: the module is required to load and answer
   * emptily rather than throw.
   */
  selfCheck(galaxy) {
    const failures = [];
    const checks = [];
    const t = (name, cond, detail) => {
      checks.push(name);
      if (!cond) failures.push(name + (detail ? ': ' + detail : ''));
    };

    if (!AW_MISSIONS.length) {
      /* Degraded is a supported state, not a failure. Assert it is SILENT
         rather than broken. */
      t('degraded.all', Array.isArray(Missions.all()) && Missions.all().length === 0);
      t('degraded.forWorld', Missions.forWorld({ id: 's0w0' }, null, { systems: [] }) === null);
      t('degraded.get', Missions.get('AW-01') === null);
      return { ok: failures.length === 0, degraded: true, checks: checks, failures: failures };
    }

    t('count.37', AW_MISSIONS.length === 37, 'saw ' + AW_MISSIONS.length);

    const seen = Object.create(null);
    let blanks = 0, noField = 0, noEvidence = 0, dashes = 0;
    const EM = String.fromCharCode(0x2014);
    for (let i = 0; i < AW_MISSIONS.length; i++) {
      const m = AW_MISSIONS[i];
      if (seen[m.id]) failures.push('duplicate id ' + m.id);
      seen[m.id] = 1;
      if (!m.name || !m.premise || !m.objective) blanks++;
      if (!m.battlefield) noField++;
      if (!m.evidenceLine) noEvidence++;
      if ((m.premise + m.objective + m.caution + m.evidenceLine).indexOf(EM) >= 0) dashes++;
    }
    t('ids.unique', true);
    t('fields.present', blanks === 0, blanks + ' seeds missing name, premise or objective');
    t('battlefield.present', noField === 0, noField + ' seeds without a battlefield');
    t('evidence.resolves', noEvidence === 0, noEvidence + ' seeds whose grade resolved to nothing');
    t('copy.noEmDash', dashes === 0, dashes + ' seeds carrying the character');

    /* Every reframe must still name a live seed, so an override cannot outlive
       the mission it was written for. */
    let orphan = 0;
    for (const k in AW_REFRAME) if (!AW_BY_ID[k]) orphan++;
    t('reframe.anchored', orphan === 0, orphan + ' overrides naming missions that no longer exist');

    /* The caution line is not optional on any seed, and the disputed form is
       DERIVED, so assert the derivation actually fired somewhere. */
    let noCaution = 0, sensitive = 0;
    for (let i = 0; i < AW_MISSIONS.length; i++) {
      if (!AW_MISSIONS[i].caution) noCaution++;
      if (AW_MISSIONS[i].sensitive) sensitive++;
    }
    t('caution.always', noCaution === 0, noCaution + ' seeds without a caution line');
    t('caution.disputedFires', sensitive > 0, 'no seed was graded D or E');

    const gx = (galaxy && Array.isArray(galaxy.systems)) ? galaxy : awProbeGalaxy();

    const a = awAssign(gx);
    const b = awAssign(gx);
    let drift = 0, assigned = 0;
    const used = Object.create(null);
    let repeat = 0;
    for (const wid in a) {
      assigned++;
      if (a[wid] !== b[wid]) drift++;
      if (used[a[wid]]) repeat++;
      used[a[wid]] = 1;
      if (!AW_BY_ID[a[wid]]) failures.push('assigned unknown mission ' + a[wid]);
    }
    for (const wid in b) if (!(wid in a)) drift++;

    t('assign.deterministic', drift === 0, drift + ' worlds differed between two calls');
    t('assign.noRepeats', repeat === 0, repeat + ' missions assigned more than once');
    t('assign.nonEmpty', assigned > 0, 'nothing matched, so the join is broken');

    /* Every assignment must be a LEGAL one: the battlefield gate is the whole
       basis of the claim that these seeds fit the worlds they land on. */
    let illegal = 0;
    for (let si = 0; si < gx.systems.length; si++) {
      const sys = gx.systems[si];
      const worlds = (sys && sys.worlds) || [];
      for (let wi = 0; wi < worlds.length; wi++) {
        const w = worlds[wi];
        const m = w && a[w.id] ? AW_BY_ID[a[w.id]] : null;
        if (m && m.battlefield !== w.map) illegal++;
      }
    }
    t('assign.battlefieldHolds', illegal === 0, illegal + ' worlds got a mission for another map');

    /* A world the canon wrote nothing for must say so. */
    let unmatchedFound = false;
    for (let si = 0; si < gx.systems.length && !unmatchedFound; si++) {
      const worlds = (gx.systems[si] && gx.systems[si].worlds) || [];
      for (let wi = 0; wi < worlds.length; wi++) {
        const w = worlds[wi];
        if (w && !a[w.id]) {
          unmatchedFound = Missions.forWorld(w, gx.systems[si], gx) === null;
          break;
        }
      }
    }
    t('forWorld.nullPath', unmatchedFound || assigned === 35,
      'an unmatched world did not return null');

    t('forWorld.noGalaxy', Missions.forWorld({ id: 's0w0' }, null, null) === null);
    t('forWorld.unknownWorld', Missions.forWorld({ id: 'not-a-world' }, null, gx) === null);
    t('get.unknown', Missions.get('AW-999') === null);

    return { ok: failures.length === 0, degraded: false, checks: checks, failures: failures };
  }
};
