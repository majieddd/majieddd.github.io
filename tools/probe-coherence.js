/* Term consistency and interlinking fidelity across the whole narrative.
 *
 * Owner asked for a pass ensuring the dialogue, the act framing and the spine
 * all agree, and that terminology is uniform. Eyeballing 525 dialogue cells,
 * 30 spine beats, 25 act scenarios, 25 morals and 51 cutscene slides is exactly
 * the size where "carefully" becomes "the first few".
 *
 * It already earned itself: the act-one scenario still ended "on the far side
 * of the Moon, digging out the relay" months after act one was reordered to end
 * at Saturn. Every sentence in it was fine. The interlink was wrong.
 *
 * Failure is a THROW. A returned string is always pass detail.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story',
                 'galaxy', 'cutscenes', 'planetcuts', 'dialogue', 'worldlore', 'missions'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f }); }
  catch (e) {}

const G = vm.runInContext('({ STORY, STORY_ACTS, ACT_SCENARIOS, ACT_MORALS, CUTSCENES, ' +
  'PLANET_CUTS, PLANET_MOMENTS, GX_HOME_SYSTEMS, FACTIONS, COMMANDER_ROSTER, ' +
  'LORE_CODEX, UNIT_TYPES, DIALOGUE, LORE, BOONS })', ctx);
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];

/* Every string a player can read, with where it came from. */
const CELLS = [];
const add = (where, text) => { if (text && typeof text === 'string') CELLS.push({ where, text }); };
FACS.forEach(f => {
  (G.CUTSCENES[f] && G.CUTSCENES[f].intro || []).forEach((s, i) => add(f + ' intro ' + (i + 1), s.text));
  (G.CUTSCENES[f] && G.CUTSCENES[f].sys || []).forEach((s, i) => { add(f + ' act' + (i + 1) + 'a', s.a); add(f + ' act' + (i + 1) + 'b', s.b); });
  (G.STORY[f] || []).forEach((b, i) => { add(f + ' beat' + i + ' line', b.line); add(f + ' beat' + i + ' reveal', b.reveal); });
  ((G.ACT_SCENARIOS || {})[f] || []).forEach((t, i) => add(f + ' scenario ' + (i + 1), t));
  ((G.ACT_MORALS || {})[f] || []).forEach((t, i) => add(f + ' moral ' + (i + 1), t));
});
Object.entries(G.PLANET_CUTS).forEach(([k, e]) => {
  if (!/^\d\d$/.test(k)) return;
  add(k + ' ground', e.ground); add(k + ' works', e.works);
  FACS.forEach(f => ((e.f && e.f[f]) || []).forEach((l, i) => add(k + ' ' + f + ' b' + (i + 1), l)));
});
Object.entries(G.PLANET_MOMENTS || {}).forEach(([kind, byFac]) =>
  Object.entries(byFac).forEach(([f, t]) => add('moment ' + kind + '/' + f, t)));
/* LORE_CODEX is the Field Manual: the game's own comment on it calls this
   "the ONE screen a new player learns the game from." It went unscanned for a
   whole session, during which it kept describing THE PARALLEL as "the Vigil"
   throughout, the exact conflation this file's CO.8 exists to catch, and CO.8
   could not see it because it only fires when both words share a cell. */
(G.LORE_CODEX || []).forEach(e => add('codex/' + e.id, e.body));
Object.values(G.UNIT_TYPES || {}).forEach(u => add('unit/' + u.id, u.desc));
/* Found the same way LORE_CODEX was found: a live Compact/Accord leak (a
   boon's lore: string, two comment headers) sat in towers2.js and a JSON
   sync gap sat in the commander bios, both on surfaces COMMANDER_ROSTER and
   DIALOGUE were already LOADED for but never actually scanned. Roster was
   even sitting in G already, destructured and unused for cells. */
(G.COMMANDER_ROSTER || []).forEach(c => add('roster/' + c.id + '/blurb', c.blurb));
Object.values((G.LORE && G.LORE.commanders) || {}).forEach(c => {
  add('lore/' + c.id + '/history', c.history);
  add('lore/' + c.id + '/motive', c.motive);
  add('lore/' + c.id + '/fracture', c.fracture);
  add('lore/' + c.id + '/voice', c.voice);
});
(G.BOONS || []).forEach(b => add('boon/' + b.id, b.lore));
Object.values(G.FACTIONS || {}).forEach(f => {
  add('faction/' + f.id + '/creed', f.creed);
  add('faction/' + f.id + '/tagline', f.tagline);
  add('faction/' + f.id + '/blurb', f.blurb);
});
Object.entries((G.DIALOGUE && G.DIALOGUE.openers) || {}).forEach(([id, t]) => add('dialogue/opener/' + id, t));
Object.entries((G.DIALOGUE && G.DIALOGUE.answers) || {}).forEach(([id, t]) => add('dialogue/answer/' + id, t));
Object.entries((G.DIALOGUE && G.DIALOGUE.stanceAnswers) || {}).forEach(([fac, byStance]) =>
  Object.entries(byStance).forEach(([stance, arr]) =>
    (arr || []).forEach((t, i) => add('dialogue/stanceAnswer/' + fac + '/' + stance + '/' + i, t))));

const checks = [];
function T(id, fn) {
  let d; try { d = fn(); } catch (e) { checks.push({ id, verdict: 'FAIL', detail: e.message }); return; }
  checks.push({ id, verdict: 'PASS', detail: String(d) });
}
/* The message is a FUNCTION, not a string. The eager form evaluated
   bad[0].where even when bad was empty, so a passing check threw. A probe that
   crashes on success is worse than no probe. */
function must(c, m) { if (!c) throw new Error(typeof m === 'function' ? m() : m); }
const hits = rx => CELLS.filter(c => rx.test(c.text));

/* ---- 1. retired terminology ---- */
T('CO.1 no retired faction terms survive', () => {
  const bad = hits(/\bCompact\b|\bAccord\b|Luminous\b/);
  must(!bad.length, () => bad.length + ' still say Compact or Accord, first: ' +
       bad[0].where + ' "' + bad[0].text.slice(0, 70) + '"');
  return 'no Compact, no Accord, no Luminous';
});

/* ---- 2. retired WORLDS ---- */
T('CO.2 no dialogue names a world that no longer exists', () => {
  const gone = /\bCERES\b|\bEUROPA\b|\bTITAN\b|BARNARD|KIC-8462|HARBOUR NINE|TABBY/i;
  const bad = hits(gone);
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'Ceres, Europa, Titan, Barnard, KIC-8462, Harbour Nine and Tabby are all gone';
});

/* ---- 3. every act ends where the act actually ends ---- */
T('CO.3 act framing does not point at the wrong seat', () => {
  /* Act one ends at SATURN. A scenario or end-beat that says the act ends on
     the Moon is the interlink defect this probe was written for. */
  const seatOf = fac => {
    const home = { human: 'human', light: 'light', xeno: 'xeno', pirate: 'pirate', robot: 'robot' };
    return G.GX_HOME_SYSTEMS[home[fac]].worlds[6];
  };
  const bad = [];
  FACS.forEach(f => {
    const sc = ((G.ACT_SCENARIOS || {})[f] || [])[0] || '';
    const endsElsewhere = /it ends (on|at) the (far side|Moon)/i.test(sc);
    if (endsElsewhere) bad.push(f + ' act one claims it ends on the Moon');
  });
  must(!bad.length, bad.join('; '));
  return 'no act claims an ending its seat contradicts';
});

/* ---- 4. spine length and act names line up ---- */
T('CO.4 every power has one beat per act plus the departure', () => {
  const bad = [];
  FACS.forEach(f => {
    const n = (G.STORY[f] || []).length;
    if (n !== G.STORY_ACTS.length) bad.push(f + ' has ' + n + ' beats for ' + G.STORY_ACTS.length + ' acts');
  });
  must(!bad.length, bad.join('; '));
  return G.STORY_ACTS.length + ' acts, ' + G.STORY_ACTS.map(a => a.name).join(' / ');
});

/* ---- 5. every spine speaker is a real commander ---- */
T('CO.5 every spine speaker exists on the roster', () => {
  const ids = new Set(G.COMMANDER_ROSTER.map(c => c.id));
  const figures = new Set(Object.keys(vm.runInContext('typeof STORY_FIGURES!=="undefined"?STORY_FIGURES:{}', ctx)));
  const bad = [];
  FACS.forEach(f => (G.STORY[f] || []).forEach((b, i) => {
    if (b.speaker && !ids.has(b.speaker) && !figures.has(b.speaker))
      bad.push(f + ' beat ' + i + ' speaker "' + b.speaker + '"');
  }));
  must(!bad.length, bad.join('; '));
  return 'all 30 spine speakers resolve';
});

/* ---- 6. scenario and moral coverage ---- */
T('CO.6 every power has five act scenarios and five morals', () => {
  const bad = [];
  FACS.forEach(f => {
    const s = ((G.ACT_SCENARIOS || {})[f] || []).length;
    const m = ((G.ACT_MORALS || {})[f] || []).length;
    if (s !== 5) bad.push(f + ' has ' + s + ' scenarios');
    if (m !== 5) bad.push(f + ' has ' + m + ' morals');
  });
  must(!bad.length, bad.join('; '));
  return '25 scenarios and 25 morals';
});

/* ---- 7. the openings ---- */
T('CO.7 every opening exists and closes on its own banner', () => {
  const bad = [];
  FACS.forEach(f => {
    const intro = (G.CUTSCENES[f] && G.CUTSCENES[f].intro) || [];
    if (intro.length < 5) bad.push(f + ' opening is ' + intro.length + ' slides');
    /* Not every opening ends on "BEGINS": the human one ends on the owner's
       own line, and the pirates end on "BEGIN". What matters is that the last
       panel SPEAKS, because a silent final slide ends the sequence on nothing. */
    const last = (intro[intro.length - 1] || {}).text || '';
    if (!last.trim()) bad.push(f + ' opening ends on a silent panel');
  });
  must(!bad.length, bad.join('; '));
  return FACS.map(f => f + ':' + (G.CUTSCENES[f].intro || []).length).join(' ');
});

/* ---- 8. the Vigil is never the Parallel ---- */
/* Blunt co-occurrence was the whole check until faction/robot/blurb joined
   the corpus: "The Vigil still runs the jurisdiction it was handed... The
   Parallel is what diverged from it." Correct, load-bearing lore, flagged
   anyway, because the original rule could not tell EXPLAINING the split
   from ERASING it. A cell that says the two are different is not the
   defect this check exists to catch; only a cell that says or implies
   they are the same one is. */
T('CO.8 the Vigil is never conflated with the Parallel', () => {
  const DIFFERENTIATES = /\bdiverged?\b|\bdivergence\b|\bis not\b|\bare not\b|\bunlike\b|\bseparate from\b|\bdistinct from\b|\bused to be\b|\bno longer\b|\bbroke from\b|\bfork(?:ed)?\b/i;
  const bad = CELLS.filter(c => /\bVigil\b/i.test(c.text) && /\bParallel\b/i.test(c.text) && !DIFFERENTIATES.test(c.text));
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'no cell treats them as one body';
});

/* ---- 8b. the Vigil never does the Parallel's specific narrative work ---- */
T('CO.8b the Vigil is never described holding worlds or built by the Ancients', () => {
  /* The narrower version of CO.8: a cell can say "Vigil" alone (correctly, it
     is a real separate thing) and never say "Parallel" at all, and STILL be
     wrong if it hands the Vigil the Parallel's own established facts: built by
     the Ancients, recovered prime directives, holding worlds/seats, or the verb
     CONTINUE (the Parallel's signature verb in the five-ways-to-conquer set).
     Found live: the Field Manual's "order" and "verbs" and "ancients" entries
     all did exactly this, undetected for a session because nothing scanned
     LORE_CODEX at all and CO.8 only fires on CO-occurrence. */
  const bad = CELLS.filter(c => /\bVigil\b/i.test(c.text) && (
    /\bVigil\b[^.!?]{0,60}\b(hold|holds|holding|own|owns|belong|belongs)\b/i.test(c.text) ||
    /\b(stand|stands)\b[^.!?]{0,30}\bthe Vigil\b/i.test(c.text) ||
    /\bVigil\b[^.!?]{0,40}\bCONTINUE/i.test(c.text) ||
    /\bAncients\b[^.!?]{0,60}\bVigil\b|\bVigil\b[^.!?]{0,60}\bAncients\b/i.test(c.text) ||
    /\bVigil\b[^.!?]{0,60}\bprime directive/i.test(c.text)
  ));
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'no cell hands the Vigil the Parallel\'s origin, directives or claim to worlds';
});

/* ---- 9. the Xeno is never written as a species ---- */
T('CO.9 the Xeno is never a species', () => {
  const bad = hits(/\ba Xeno\b|\bXenos\b|\bXeno (species|race|biology)/i);
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'no cell makes it a lineage';
});

/* ---- 11. worldlore.js and missions.js, read as raw source ----
 * Both carry player-facing prose in banks that live inside an IIFE (var
 * OWNER_LINES, KIND_LINES, etc in worldlore.js) or need a full dependency
 * chain to evaluate through the public API (missions.js's AW_MISSIONS).
 * Neither is a clean exported object the CELLS extraction above can walk, so
 * this checks the source text directly instead of skipping them, which is
 * exactly how OWNER_LINES.robot sat mislabeled "Vigil" for a whole session:
 * nothing was reading this file at all. */
T('CO.11 worldlore.js and missions.js carry no retired term or Vigil claim', () => {
  const bad = [];
  ['js/worldlore.js', 'js/missions.js'].forEach(rel => {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
    if (/\bCompact\b|\bAccord\b|\bSeverance\b|\bDisclosure Fracture\b|\bLattice\b/.test(src))
      bad.push(rel + ': retired term (Compact/Accord/Severance/Disclosure Fracture/Lattice)');
    if (/\bCERES\b|\bEUROPA\b|\bTITAN\b|BARNARD|TABBY|KIC-8462|HARBOUR NINE/.test(src))
      bad.push(rel + ': names a retired world');
    if (/\bVigil\b[^'"\n]{0,60}\b(holds|hold|owns|own|maintains)\b/.test(src) &&
        !/nest/i.test(src.slice(Math.max(0, src.search(/\bVigil\b/) - 40), src.search(/\bVigil\b/) + 80)))
      bad.push(rel + ': "Vigil" paired with a holding/owning verb outside a nest context');
  });
  must(!bad.length, () => bad.join('; '));
  return 'no retired term, no retired world, no Vigil holding claim';
});

/* boonFor() (js/towers2.js) falls back to a RANDOM other faction's boon
   whenever BOONS has no entry for the (faction, kind) it was asked for --
   a graceful degrade written for old saves holding an owner or kind the
   table has never heard of. It also, silently and correctly by its own
   logic, degraded EVERY robot-held world in the game: BOONS had all 20
   human/light/xeno/pirate entries and zero robot ones, so every one of
   robot's five kinds (standard, fortress, forge, nest, apex) fell through.
   robot is a rival for every other playable faction, so this fired on
   ordinary campaigns, not just a robot playthrough. Caught only by
   noticing the array stopped after pirate; nothing had ever asked "does
   every faction have every kind" as a question. This asks it permanently,
   for whichever five factions FACTIONS actually declares, not a
   hand-written list that would itself go stale the next time a faction
   is added or renamed. */
T('CO.12 every faction has a boon for every kind', () => {
  const KINDS = ['standard', 'fortress', 'forge', 'nest', 'apex'];
  const facs = Object.keys(G.FACTIONS || {}).length ? Object.keys(G.FACTIONS) : FACS;
  const bad = [];
  facs.forEach(f => {
    const have = new Set((G.BOONS || []).filter(b => b.f === f).map(b => b.k));
    const missing = KINDS.filter(k => !have.has(k));
    if (missing.length) bad.push(f + ' missing ' + missing.join('/'));
  });
  const ids = (G.BOONS || []).map(b => b.id);
  if (new Set(ids).size !== ids.length) bad.push('duplicate boon id');
  must(!bad.length, () => bad.join('; '));
  return facs.length + ' factions, ' + KINDS.length + ' kinds, ' + (G.BOONS || []).length + ' boons, no gaps';
});

const fails = checks.filter(c => c.verdict === 'FAIL');
checks.forEach(c => console.log('  [' + c.verdict + '] ' + c.id + ' :: ' + c.detail));
console.log('\ncells checked: ' + CELLS.length);
console.log(fails.length ? 'COHERENCE: ' + fails.length + ' FAILURE(S)'
                         : 'COHERENCE: ' + checks.length + ' checks, all pass');
process.exit(fails.length ? 1 : 0);
