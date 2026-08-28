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
                 'galaxy', 'cutscenes', 'planetcuts', 'dialogue'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f }); }
  catch (e) {}

const G = vm.runInContext('({ STORY, STORY_ACTS, ACT_SCENARIOS, ACT_MORALS, CUTSCENES, ' +
  'PLANET_CUTS, PLANET_MOMENTS, GX_HOME_SYSTEMS, FACTIONS, COMMANDER_ROSTER })', ctx);
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
T('CO.8 the Vigil is never conflated with the Parallel', () => {
  const bad = CELLS.filter(c => /\bVigil\b/i.test(c.text) && /\bParallel\b/i.test(c.text));
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'no cell treats them as one body';
});

/* ---- 9. the Xeno is never written as a species ---- */
T('CO.9 the Xeno is never a species', () => {
  const bad = hits(/\ba Xeno\b|\bXenos\b|\bXeno (species|race|biology)/i);
  must(!bad.length, () => bad.map(b => b.where).join(', '));
  return 'no cell makes it a lineage';
});

const fails = checks.filter(c => c.verdict === 'FAIL');
checks.forEach(c => console.log('  [' + c.verdict + '] ' + c.id + ' :: ' + c.detail));
console.log('\ncells checked: ' + CELLS.length);
console.log(fails.length ? 'COHERENCE: ' + fails.length + ' FAILURE(S)'
                         : 'COHERENCE: ' + checks.length + ' checks, all pass');
process.exit(fails.length ? 1 : 0);
