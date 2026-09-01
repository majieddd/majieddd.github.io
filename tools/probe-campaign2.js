/* THE THREE-ACT CAMPAIGN GATE.  node tools/probe-campaign2.js  (exit 1 on FAIL)
 *
 * js/campaign2.js is the owner's reworked campaign as data, and it is NOT yet
 * wired into the engine: the live game still generates the five-system galaxy.
 * Unwired data is exactly the kind that rots, because nothing playing the game
 * ever disagrees with it. These checks are what stands in for the engine until
 * the engine arrives:
 *
 *   C2.1  three acts, 5 to 7 planets each (the owner's budget)
 *   C2.2  planets hold 1 to 12 locations (Earth carries twelve by owner
 *         call); at most one whole-body battle per
 *         planet, and where there is one it is LAST, because it is the fight
 *         the smaller locations were rehearsals for
 *   C2.3  every id unique, and every ref (act/planet/location) unique
 *   C2.4  every named board resolves to a real MAPS entry
 *   C2.5  no board serves two locations: two battles on identical ground
 *         would be one board wearing two names
 *   C2.6  challenge on every location, in the terrain codex vocabulary
 *   C2.7  every power plays all three acts exactly once and OPENS AT HOME
 *   C2.8  every power is hosted by exactly one act; every act is somebody's
 *         home
 *   C2.9  every location that still needs a board says what it is for, so the
 *         backlog is a specification and not a list of holes
 *   C2.10 every parked body (bonus content) records WHY it was parked, and
 *         claims no board that a campaign location is already using
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

const G = vm.runInContext('({ CAMPAIGN_ACTS, CAMPAIGN_ORDER, CAMPAIGN_ACT_BY_ID, CAMPAIGN_BONUS, MAPS, TERRA_VOCAB })', ctx);

let pass = 0, fail = 0;
function T(id, ok, detail) {
  if (ok) { pass++; console.log('  [PASS] ' + id + (detail ? ' :: ' + detail : '')); }
  else { fail++; console.log('  [FAIL] ' + id + ' :: ' + (detail || '')); }
}

const POWERS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const locs = [];
for (const a of G.CAMPAIGN_ACTS)
  for (const p of a.planets)
    for (const l of p.locations) locs.push({ act: a, planet: p, loc: l, ref: a.id + '/' + p.id + '/' + l.id });

/* ---- C2.1 act and planet budget ---- */
{
  const bad = G.CAMPAIGN_ACTS.filter(a => a.planets.length < 5 || a.planets.length > 7)
    .map(a => a.id + ' has ' + a.planets.length);
  T('C2.1 three acts, 5 to 7 planets each',
    G.CAMPAIGN_ACTS.length === 3 && bad.length === 0,
    bad.length ? bad.join('; ')
      : G.CAMPAIGN_ACTS.map(a => a.id + ':' + a.planets.length).join(', ') +
        ' (' + locs.length + ' locations)');
}

/* ---- C2.2 location budget and the whole-body rung ---- */
{
  const bad = [];
  for (const a of G.CAMPAIGN_ACTS) for (const p of a.planets) {
    const n = p.locations.length;
    if (n < 1 || n > 12) bad.push(p.id + ' has ' + n + ' locations');
    const wholes = p.locations.filter(l => l.whole);
    if (wholes.length > 1) bad.push(p.id + ' has ' + wholes.length + ' whole-body battles');
    if (wholes.length === 1 && p.locations[p.locations.length - 1] !== wholes[0])
      bad.push(p.id + ': the whole-body battle is not last');
  }
  const withWhole = G.CAMPAIGN_ACTS.reduce((n, a) =>
    n + a.planets.filter(p => p.locations.some(l => l.whole)).length, 0);
  T('C2.2 location budget, and the whole-body battle closes its planet',
    bad.length === 0, bad.slice(0, 4).join('; ') ||
    withWhole + ' of ' + G.CAMPAIGN_ACTS.reduce((n, a) => n + a.planets.length, 0) +
    ' planets end in a planetary battle');
}

/* ---- C2.3 identity ---- */
{
  const dupes = [];
  const seenRef = new Set(), seenAct = new Set();
  for (const a of G.CAMPAIGN_ACTS) {
    if (seenAct.has(a.id)) dupes.push('act ' + a.id);
    seenAct.add(a.id);
    const seenPlanet = new Set();
    for (const p of a.planets) {
      if (seenPlanet.has(p.id)) dupes.push('planet ' + a.id + '/' + p.id);
      seenPlanet.add(p.id);
      const seenLoc = new Set();
      for (const l of p.locations) {
        if (seenLoc.has(l.id)) dupes.push('location ' + a.id + '/' + p.id + '/' + l.id);
        seenLoc.add(l.id);
      }
    }
  }
  for (const r of locs) { if (seenRef.has(r.ref)) dupes.push('ref ' + r.ref); seenRef.add(r.ref); }
  T('C2.3 every act, planet, location and ref is unique', dupes.length === 0,
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

/* ---- C2.7 act order per power ---- */
{
  const bad = [];
  for (const f of POWERS) {
    const order = G.CAMPAIGN_ORDER[f];
    if (!Array.isArray(order) || order.length !== 3) { bad.push(f + ': not three acts'); continue; }
    if (new Set(order).size !== 3) bad.push(f + ': repeats an act');
    for (const id of order) if (!G.CAMPAIGN_ACT_BY_ID[id]) bad.push(f + ': unknown act ' + id);
    const home = G.CAMPAIGN_ACT_BY_ID[order[0]];
    if (home && home.hosts.indexOf(f) < 0)
      bad.push(f + ' opens in ' + order[0] + ', which is not its home');
  }
  T('C2.7 every power plays all three acts once and opens at home', bad.length === 0,
    bad.slice(0, 4).join('; ') ||
    POWERS.map(f => f + ':' + G.CAMPAIGN_ORDER[f].join('>')).join('  '));
}

/* ---- C2.8 hosting ---- */
{
  const hosted = {};
  for (const a of G.CAMPAIGN_ACTS) for (const h of (a.hosts || [])) hosted[h] = (hosted[h] || 0) + 1;
  const bad = POWERS.filter(f => hosted[f] !== 1).map(f => f + ' hosted ' + (hosted[f] || 0) + ' times');
  const homeless = G.CAMPAIGN_ACTS.filter(a => !(a.hosts || []).length).map(a => a.id);
  T('C2.8 every power has exactly one home act, every act has a resident',
    bad.length === 0 && homeless.length === 0,
    bad.concat(homeless.map(a => a + ' hosts nobody')).join('; ') ||
    G.CAMPAIGN_ACTS.map(a => a.id + '=' + a.hosts.join('+')).join(', '));
}

/* ---- C2.9 the backlog is a specification ---- */
{
  const todo = locs.filter(r => !r.loc.board);
  const vague = todo.filter(r => typeof r.loc.brief !== 'string' || r.loc.brief.length < 40)
    .map(r => r.ref);
  const byAct = {};
  for (const r of todo) byAct[r.act.id] = (byAct[r.act.id] || 0) + 1;
  T('C2.9 every board still to be built says what it is for', vague.length === 0,
    vague.slice(0, 4).join('; ') ||
    todo.length + ' boards to author (' +
    Object.keys(byAct).map(k => k + ' ' + byAct[k]).join(', ') + '), all specified');
}


/* ---- C2.10 the parked set. A place demoted out of the campaign has to stay
        a recorded decision with a reason, or a later session cannot tell
        whether it was cut on purpose or lost in an edit. And a board cannot
        serve a campaign location AND a bonus body at once: a bonus body
        whose boards moved into an act must say so and claim none. ---- */
{
  const bonus = G.CAMPAIGN_BONUS || [];
  const bad = [];
  const used = new Set();
  for (const a of G.CAMPAIGN_ACTS)
    for (const p of a.planets)
      for (const l of p.locations) if (l.board) used.add(l.board);
  for (const b of bonus) {
    if (!b.id || !b.name) bad.push('an entry has no id or name');
    if (typeof b.why !== 'string' || b.why.length < 40)
      bad.push(b.id + ': no reason recorded for parking it');
    if (['body', 'system'].indexOf(b.kind) < 0) bad.push(b.id + ': kind is ' + JSON.stringify(b.kind));
    for (const m of (b.boards || [])) {
      if (!G.MAPS.some(x => x.id === m)) bad.push(b.id + ': board ' + m + ' does not exist');
      if (used.has(m)) bad.push(b.id + ': board ' + m + ' is also a campaign location board');
    }
    if (b.reparented && (b.boards || []).length)
      bad.push(b.id + ': re-parented but still claims boards');
    if (b.reparented && !G.CAMPAIGN_ACT_BY_ID[b.reparentedTo])
      bad.push(b.id + ': re-parented to unknown act ' + b.reparentedTo);
  }
  /* Nothing in the campaign may name a parked place as a host. */
  for (const a of G.CAMPAIGN_ACTS)
    if (bonus.some(b => b.id === a.id)) bad.push(a.id + ' is both an act and parked');
  T('C2.10 every parked body records why, and claims no campaign board',
    bad.length === 0 && bonus.length > 0,
    bad.slice(0, 4).join('; ') ||
    bonus.length + ' parked: ' + bonus.map(b => b.id + (b.reparented ? ' (boards re-parented)' : '')).join(', '));
}

console.log(fail ? 'CAMPAIGN REWORK: ' + fail + ' FAILURE(S)'
                 : 'CAMPAIGN REWORK: ' + pass + ' checks, all pass');
process.exit(fail ? 1 : 0);
