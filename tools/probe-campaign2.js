/* THE CAMPAIGN GATE.  node tools/probe-campaign2.js  (exit 1 on FAIL)
 *
 * js/campaign2.js is the owner's reworked campaign as data, and it is NOT yet
 * wired into the engine: the live game still generates the five-system galaxy.
 * Unwired data is exactly the kind that rots, because nothing playing the game
 * ever disagrees with it. These checks are what stands in for the engine until
 * the engine arrives.
 *
 * The model (Sessions 46 and 47): four THEATRES, faction-independent places,
 * each theatre -> planet -> location; and three ACTS per power, each act an
 * ordered group of theatres. Humanity's acts are the owner's stated shape:
 * Act 1 just Earth, Act 2 the entire Solar System, Act 3 the other two systems.
 *
 *   C2.1  four theatres: Earth alone is one planet fought at least eight
 *         locations deep; every other theatre holds 5 to 7 planets (the
 *         owner's budget)
 *   C2.2  planets hold 1 to 12 locations (Earth carries twelve by owner
 *         call); at most one whole-body battle per planet, and where there is
 *         one it is LAST, because it is the fight the smaller locations were
 *         rehearsals for
 *   C2.3  every id unique, and every ref (theatre/planet/location) unique
 *   C2.4  every named board resolves to a real MAPS entry
 *   C2.5  no board serves two locations: two battles on identical ground
 *         would be one board wearing two names
 *   C2.6  challenge on every location, in the terrain codex vocabulary
 *   C2.7  every power plays exactly three acts that together visit every
 *         theatre exactly once, OPENS AT HOME, and humanity's three are the
 *         owner's boundaries word for word
 *   C2.8  every theatre has a resident power; every power hosts a theatre;
 *         the two Sol theatres are humanity's alone
 *   C2.9  every location that still needs a board says what it is for, so the
 *         backlog is a specification and not a list of holes
 *   C2.10 every parked body (bonus content) records WHY it was parked, and
 *         claims no board that a campaign location is already using (a
 *         re-parented system may keep the boards no location took)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['mapgen', 'config', 'worldmaps', 'campaign2'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });

const G = vm.runInContext('({ CAMPAIGN_THEATRES, CAMPAIGN_THEATRE_BY_ID, CAMPAIGN_ACTS_BY_POWER, CAMPAIGN_BONUS, MAPS, TERRA_VOCAB })', ctx);

let pass = 0, fail = 0;
function T(id, ok, detail) {
  if (ok) { pass++; console.log('  [PASS] ' + id + (detail ? ' :: ' + detail : '')); }
  else { fail++; console.log('  [FAIL] ' + id + ' :: ' + (detail || '')); }
}

const POWERS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const TH = G.CAMPAIGN_THEATRES;
const locs = [];
for (const t of TH)
  for (const p of t.planets)
    for (const l of p.locations) locs.push({ th: t, planet: p, loc: l, ref: t.id + '/' + p.id + '/' + l.id });
const planetCount = TH.reduce((n, t) => n + t.planets.length, 0);

/* ---- C2.1 theatre and planet budget ---- */
{
  const bad = [];
  const earth = G.CAMPAIGN_THEATRE_BY_ID.earth;
  if (!earth) bad.push('no earth theatre');
  else {
    if (earth.planets.length !== 1) bad.push('earth holds ' + earth.planets.length + ' planets, not one');
    const deep = earth.planets[0] ? earth.planets[0].locations.length : 0;
    if (deep < 8) bad.push('earth is fought ' + deep + ' locations deep, fewer than eight');
  }
  for (const t of TH) {
    if (t.id === 'earth') continue;
    if (t.planets.length < 5 || t.planets.length > 7) bad.push(t.id + ' has ' + t.planets.length + ' planets');
  }
  for (const t of TH) if (typeof t.system !== 'string' || !t.system) bad.push(t.id + ' names no system');
  T('C2.1 four theatres: Earth alone and deep, the others 5 to 7 planets',
    TH.length === 4 && bad.length === 0,
    bad.length ? bad.join('; ')
      : TH.map(t => t.id + ':' + t.planets.length).join(', ') +
        ' (' + planetCount + ' planets, ' + locs.length + ' locations)');
}

/* ---- C2.2 location budget and the whole-body rung ---- */
{
  const bad = [];
  for (const t of TH) for (const p of t.planets) {
    const n = p.locations.length;
    if (n < 1 || n > 12) bad.push(p.id + ' has ' + n + ' locations');
    const wholes = p.locations.filter(l => l.whole);
    if (wholes.length > 1) bad.push(p.id + ' has ' + wholes.length + ' whole-body battles');
    if (wholes.length === 1 && p.locations[p.locations.length - 1] !== wholes[0])
      bad.push(p.id + ': the whole-body battle is not last');
  }
  const withWhole = TH.reduce((n, t) =>
    n + t.planets.filter(p => p.locations.some(l => l.whole)).length, 0);
  T('C2.2 location budget, and the whole-body battle closes its planet',
    bad.length === 0, bad.slice(0, 4).join('; ') ||
    withWhole + ' of ' + planetCount + ' planets end in a planetary battle');
}

/* ---- C2.3 identity ---- */
{
  const dupes = [];
  const seenRef = new Set(), seenTh = new Set(), seenPlanetAll = new Set();
  for (const t of TH) {
    if (seenTh.has(t.id)) dupes.push('theatre ' + t.id);
    seenTh.add(t.id);
    for (const p of t.planets) {
      if (seenPlanetAll.has(p.id)) dupes.push('planet ' + t.id + '/' + p.id);
      seenPlanetAll.add(p.id);
      const seenLoc = new Set();
      for (const l of p.locations) {
        if (seenLoc.has(l.id)) dupes.push('location ' + t.id + '/' + p.id + '/' + l.id);
        seenLoc.add(l.id);
      }
    }
  }
  for (const r of locs) { if (seenRef.has(r.ref)) dupes.push('ref ' + r.ref); seenRef.add(r.ref); }
  for (const f of POWERS) {
    const names = new Set();
    for (const a of (G.CAMPAIGN_ACTS_BY_POWER[f] || [])) {
      if (typeof a.name !== 'string' || !a.name) dupes.push(f + ': an act has no name');
      if (names.has(a.name)) dupes.push(f + ': two acts named ' + a.name);
      names.add(a.name);
    }
  }
  T('C2.3 every theatre, planet, location, ref and act name is unique', dupes.length === 0,
    dupes.slice(0, 4).join('; ') || seenRef.size + ' unique refs');
}

/* ---- C2.4 board references resolve ---- */
{
  const missing = locs.filter(r => r.loc.board && !G.MAPS.some(m => m.id === r.loc.board))
    .map(r => r.ref + ' -> ' + r.loc.board);
  const named = locs.filter(r => r.loc.board).length;
  T('C2.4 every named board resolves to a real MAPS entry', missing.length === 0,
    missing.slice(0, 4).join('; ') || named + ' of ' + locs.length + ' locations carry a live board');
}

/* ---- C2.5 no board serves two locations ---- */
{
  const by = new Map(), dupes = [];
  for (const r of locs) {
    if (!r.loc.board) continue;
    if (by.has(r.loc.board)) dupes.push(r.loc.board + ': ' + by.get(r.loc.board) + ' and ' + r.ref);
    else by.set(r.loc.board, r.ref);
  }
  T('C2.5 no board serves two locations', dupes.length === 0,
    dupes.slice(0, 4).join('; ') || by.size + ' boards, each used once');
}

/* ---- C2.6 challenge ---- */
{
  const bad = locs.filter(r => G.TERRA_VOCAB.challenge.indexOf(r.loc.challenge) < 0)
    .map(r => r.ref + '=' + JSON.stringify(r.loc.challenge));
  const spread = {};
  for (const r of locs) spread[r.loc.challenge] = (spread[r.loc.challenge] || 0) + 1;
  T('C2.6 every location declares a challenge in the codex vocabulary', bad.length === 0,
    bad.slice(0, 4).join('; ') ||
    G.TERRA_VOCAB.challenge.map(v => v + ' ' + (spread[v] || 0)).join(', '));
}

/* ---- C2.7 acts per power ---- */
{
  const bad = [];
  const allTh = TH.map(t => t.id).sort().join(',');
  for (const f of POWERS) {
    const acts = G.CAMPAIGN_ACTS_BY_POWER[f];
    if (!Array.isArray(acts) || acts.length !== 3) { bad.push(f + ': not three acts'); continue; }
    const visited = [];
    for (const a of acts) {
      if (!Array.isArray(a.theatres) || !a.theatres.length) { bad.push(f + ': act ' + a.name + ' holds no theatre'); continue; }
      for (const id of a.theatres) {
        if (!G.CAMPAIGN_THEATRE_BY_ID[id]) bad.push(f + ': unknown theatre ' + id);
        visited.push(id);
      }
    }
    if (visited.slice().sort().join(',') !== allTh)
      bad.push(f + ' visits ' + visited.join('>') + ', not every theatre exactly once');
    const opening = acts[0].theatres.map(id => G.CAMPAIGN_THEATRE_BY_ID[id]).filter(Boolean);
    if (!opening.some(t => t.hosts.indexOf(f) >= 0))
      bad.push(f + ' opens in ' + acts[0].theatres.join('+') + ', which is not its home');
  }
  /* The owner's boundaries for humanity, word for word (Session 47). */
  const human = (G.CAMPAIGN_ACTS_BY_POWER.human || []).map(a => a.theatres.join('+')).join(' / ');
  if (human !== 'earth / sol / proxima+zeta')
    bad.push('humanity plays ' + human + ', not earth / sol / proxima+zeta');
  T('C2.7 three acts per power covering every theatre once, opening at home; humanity Earth, Sol, the other two',
    bad.length === 0,
    bad.slice(0, 4).join('; ') ||
    POWERS.map(f => f + ':' + G.CAMPAIGN_ACTS_BY_POWER[f].map(a => a.theatres.join('+')).join('>')).join('  '));
}

/* ---- C2.8 hosting ---- */
{
  const hosted = {};
  for (const t of TH) for (const h of (t.hosts || [])) hosted[h] = (hosted[h] || 0) + 1;
  const bad = POWERS.filter(f => !hosted[f]).map(f => f + ' hosts nothing');
  const homeless = TH.filter(t => !(t.hosts || []).length).map(t => t.id + ' hosts nobody');
  for (const id of ['earth', 'sol']) {
    const t = G.CAMPAIGN_THEATRE_BY_ID[id];
    if (t && (t.hosts.length !== 1 || t.hosts[0] !== 'human')) bad.push(id + ' is hosted by ' + t.hosts.join('+') + ', not humanity alone');
  }
  T('C2.8 every theatre has a resident, every power a home, and Sol is humanity\'s',
    bad.length === 0 && homeless.length === 0,
    bad.concat(homeless).join('; ') ||
    TH.map(t => t.id + '=' + t.hosts.join('+')).join(', '));
}

/* ---- C2.9 the backlog is a specification ---- */
{
  const todo = locs.filter(r => !r.loc.board);
  const vague = todo.filter(r => typeof r.loc.brief !== 'string' || r.loc.brief.length < 40)
    .map(r => r.ref);
  const byTh = {};
  for (const r of todo) byTh[r.th.id] = (byTh[r.th.id] || 0) + 1;
  T('C2.9 every board still to be built says what it is for', vague.length === 0,
    vague.slice(0, 4).join('; ') ||
    todo.length + ' boards to author (' +
    Object.keys(byTh).map(k => k + ' ' + byTh[k]).join(', ') + '), all specified');
}

/* ---- C2.10 the parked set. A place demoted out of the campaign has to stay
        a recorded decision with a reason, or a later session cannot tell
        whether it was cut on purpose or lost in an edit. And a board cannot
        serve a campaign location AND a bonus body at once: a bonus body
        whose boards moved into a theatre says so, and may keep only the
        boards no location took (the Pleiades keep the Dust Wake). ---- */
{
  const bonus = G.CAMPAIGN_BONUS || [];
  const bad = [];
  const used = new Set();
  for (const r of locs) if (r.loc.board) used.add(r.loc.board);
  for (const b of bonus) {
    if (!b.id || !b.name) bad.push('an entry has no id or name');
    if (typeof b.why !== 'string' || b.why.length < 40)
      bad.push(b.id + ': no reason recorded for parking it');
    if (['body', 'system'].indexOf(b.kind) < 0) bad.push(b.id + ': kind is ' + JSON.stringify(b.kind));
    for (const m of (b.boards || [])) {
      if (!G.MAPS.some(x => x.id === m)) bad.push(b.id + ': board ' + m + ' does not exist');
      if (used.has(m)) bad.push(b.id + ': board ' + m + ' is also a campaign location board');
    }
    if (b.reparented && !G.CAMPAIGN_THEATRE_BY_ID[b.reparentedTo])
      bad.push(b.id + ': re-parented to unknown theatre ' + b.reparentedTo);
  }
  /* Nothing in the campaign may name a parked place as a theatre. */
  for (const t of TH)
    if (bonus.some(b => b.id === t.id)) bad.push(t.id + ' is both a theatre and parked');
  T('C2.10 every parked body records why, and claims no campaign board',
    bad.length === 0 && bonus.length > 0,
    bad.slice(0, 4).join('; ') ||
    bonus.length + ' parked: ' + bonus.map(b => b.id + (b.reparented ? ' (boards re-parented)' : '')).join(', '));
}

console.log(fail ? 'CAMPAIGN REWORK: ' + fail + ' FAILURE(S)'
                 : 'CAMPAIGN REWORK: ' + pass + ' checks, all pass');
process.exit(fail ? 1 : 0);
