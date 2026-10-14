/* THE WORLD-BOARDS GATE.  node tools/probe-worldmaps.js   (exit 1 on any FAIL)
 *
 * Holds the handcrafted campaign grounds (js/worldmaps.js, design in
 * docs/WORLDMAPS-DESIGN.md) to their contract:
 *
 *   WM.1  coverage: exactly one board per campaign planet, keyed by name,
 *         a bijection with GX_HOME_SYSTEMS
 *   WM.2  geometry law per board: even cols, lanes start on the mirror
 *         axis (x = cols/2 - 1), end at the base (x = -1), axis-aligned,
 *         no zero-length segments, everything authored in the left half
 *   WM.3  walls never sit on lane tiles (a wall under a lane is a
 *         soft-lock: enemies standing there are unkillable)
 *   WM.4  every authored node survives: build nodes on open ground off
 *         the lane, lane nodes on the lane, nothing on blocks or walls
 *         (buildField silently DROPS a node on blocked ground)
 *   WM.5  the terrain codex: terra present, every closed field a member
 *         of TERRA_VOCAB, basis a real sentence
 *   WM.6  rosters: real, non-boss Vigil ids; the two denizens lead them
 *   WM.7  buildable ground per side within the authored band, so a board
 *         cannot ship with nowhere to stand
 *   WM.8  THE STREAM PIN: owners, kinds, seats, contested pairs, arenas
 *         and boons across 80 galaxies byte-equal to the fixture captured
 *         before the map override existed (tools/fixtures/
 *         galaxy-stream-pin.json). Maps are the one thing allowed to move.
 *   WM.9  assignment: on a live galaxy every campaign world fields its
 *         own board, except contested worlds on the shared tri grounds
 *   WM.10 one universe: the same planet fields the same ground in every
 *         campaign (si is player-relative, so anything keyed on the tier
 *         index diverges across factions; owner-sweep 38.1 caught that live)
 *   WM.11 every procedural family has its handcrafted reference board,
 *         named alike, and no reference board is playable
 *   WM.12 THE OWNER'S RULE: every board entry resolves to geometry a page
 *         can draw. This is the check that would have caught the 19 blank
 *         entries that prompted the reference set
 *   WM.13 the challenge dimension is present on every authored board, in
 *         vocabulary, and actually spread across all five levels
 *   WM.14 no two authored boards share the same geometry
 *   WM.15 the codex covers EVERY board in the game (pool and three-way
 *         boards included, classified in POOL_TERRA), every value in
 *         vocabulary, and every vocabulary term earned by some board
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['mapgen', 'config', 'worldmaps', 'lore', 'factions', 'towers2', 'roster', 'story', 'galaxy'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });

const G = vm.runInContext(
  '({ WORLD_MAPS, WORLD_MAP_BY_NAME, TERRA_VOCAB, MAPS, ENEMY_TYPES, GX_HOME_SYSTEMS, ' +
  'FAMILY_REFERENCE, FAMILY_REFERENCE_BY_ID })', ctx);

/* Every board this project AUTHORS: the 35 planet grounds plus the one
   handcrafted reference board per procedural family. Both obey the same
   geometry contract and the same terrain codex, which is the point of the
   reference set: a generator can be judged against a real example. */
const AUTHORED = G.WORLD_MAPS.concat(G.FAMILY_REFERENCE);
const nameOf = m => m.id || ('reference:' + m.family);
/* Everything carrying a codex entry: the authored set above plus the older
   pool and three-way boards, which are classified in POOL_TERRA and merged
   onto their live MAPS entries. The codex is only a sorting system if it
   covers the whole shelf. */
const CLASSIFIED = G.MAPS.filter(m => m.terra).concat(G.FAMILY_REFERENCE);

let pass = 0, fail = 0;
const bad = [];
function T(id, ok, detail) {
  if (ok) { pass++; console.log('  [PASS] ' + id + (detail ? ' :: ' + detail : '')); }
  else { fail++; bad.push(id); console.log('  [FAIL] ' + id + ' :: ' + (detail || '')); }
}

/* Waypoints to tiles, the same expansion orthoLane and showboard use. */
function laneTiles(lane) {
  const out = [];
  for (let i = 0; i < lane.length - 1; i++) {
    const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    out.push(x + ',' + y);
    while (x !== x1 || y !== y1) { x += dx; y += dy; out.push(x + ',' + y); }
  }
  return out;
}
function rectTiles(rects) {
  const s = new Set();
  for (const [x0, y0, x1, y1] of (rects || []))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.add(x + ',' + y);
  return s;
}

/* ---- WM.1 coverage ---- */
{
  const want = [];
  for (const f of Object.keys(G.GX_HOME_SYSTEMS)) want.push(...G.GX_HOME_SYSTEMS[f].worlds);
  const have = G.WORLD_MAPS.map(m => m.world);
  const missing = want.filter(w => !G.WORLD_MAP_BY_NAME[w]);
  const extra = have.filter(w => want.indexOf(w) < 0);
  const dupIds = G.WORLD_MAPS.map(m => m.id).filter((id, i, a) => a.indexOf(id) !== i);
  T('WM.1 one board per campaign planet, keyed by name',
    missing.length === 0 && extra.length === 0 && dupIds.length === 0 &&
    have.length === want.length,
    have.length + ' of ' + want.length + (missing.length ? '; missing ' + missing.join(', ') : '') +
    (extra.length ? '; extra ' + extra.join(', ') : '') +
    (dupIds.length ? '; duplicate ids ' + dupIds.join(', ') : ''));
}

/* ---- WM.2..WM.7 per board ---- */
{
  const errs = { geo: [], wall: [], node: [], terra: [], roster: [], ground: [] };
  const groundCounts = [];
  for (const m of AUTHORED) {
    const half = m.cols / 2 - 1;
    if (m.cols % 2) errs.geo.push(nameOf(m) + ': odd cols ' + m.cols);
    const lt = new Set();
    for (const lane of (m.lanes || [])) {
      if (lane[0][0] !== half) errs.geo.push(nameOf(m) + ': lane starts at x=' + lane[0][0] + ', axis is ' + half);
      const last = lane[lane.length - 1];
      if (last[0] !== -1) errs.geo.push(nameOf(m) + ': lane ends at x=' + last[0] + ', base is x=-1');
      for (let i = 0; i < lane.length - 1; i++) {
        const [x0, y0] = lane[i], [x1, y1] = lane[i + 1];
        if (x0 !== x1 && y0 !== y1) errs.geo.push(nameOf(m) + ': diagonal segment ' + i);
        if (x0 === x1 && y0 === y1) errs.geo.push(nameOf(m) + ': zero-length segment ' + i);
      }
      for (const [x, y] of lane) {
        if (x > half || y < 0 || y > m.rows - 1 || x < -1)
          errs.geo.push(nameOf(m) + ': waypoint out of half [' + x + ',' + y + ']');
      }
      laneTiles(lane).forEach(t => lt.add(t));
    }
    for (const [x0, y0, x1, y1] of (m.blocks || []).concat(m.walls || [])) {
      if (!(x0 >= 0 && x0 <= x1 && x1 <= half && y0 >= 0 && y0 <= y1 && y1 <= m.rows - 1))
        errs.geo.push(nameOf(m) + ': rect out of half [' + [x0, y0, x1, y1] + ']');
    }
    const wallT = rectTiles(m.walls);
    for (const t of wallT) if (lt.has(t)) errs.wall.push(nameOf(m) + ': wall on lane at ' + t);
    const blockT = rectTiles(m.blocks);
    for (const nd of (m.nodes || [])) {
      const key = nd[0] + ',' + nd[1];
      if (blockT.has(key) || wallT.has(key)) errs.node.push(nameOf(m) + ': node dropped by terrain at ' + key);
      if (nd[3] === 'lane' && !lt.has(key)) errs.node.push(nameOf(m) + ': lane node off the lane at ' + key);
      if (nd[3] === 'build' && lt.has(key)) errs.node.push(nameOf(m) + ': build node on the lane at ' + key);
      if (nd[0] > half) errs.node.push(nameOf(m) + ': node in the mirror half at ' + key);
    }
    if (!m.terra) errs.terra.push(nameOf(m) + ': no terra codex');
    else {
      for (const k of Object.keys(G.TERRA_VOCAB))
        if (G.TERRA_VOCAB[k].indexOf(m.terra[k]) < 0)
          errs.terra.push(nameOf(m) + ': terra.' + k + '=' + JSON.stringify(m.terra[k]) + ' not in vocabulary');
      if (typeof m.terra.basis !== 'string' || m.terra.basis.length < 40)
        errs.terra.push(nameOf(m) + ': terra.basis is not a real sentence');
    }
    /* ROSTERS ARE FOR PLAYABLE GROUND ONLY. A reference board is never
       fought on, so demanding a wave roster of it would be inventing a
       promise nothing keeps. */
    const usable = id => G.ENEMY_TYPES[id] && !G.ENEMY_TYPES[id].boss && !G.ENEMY_TYPES[id].miniboss;
    if (m.world && (!Array.isArray(m.roster) || m.roster.length !== 8 || !m.roster.every(usable)))
      errs.roster.push(nameOf(m) + ': roster is not 8 usable Vigil ids');
    if (m.world && (!Array.isArray(m.denizens) || m.denizens.length !== 2 ||
        !m.denizens.every(d => (m.roster || []).indexOf(d) >= 0)))
      errs.roster.push(nameOf(m) + ': denizens are not 2 ids drawn from the roster');
    /* Left-half open ground: not lane, not blocked. The band bottom is what
       matters: a board with nowhere to stand ships a lost battle. */
    let open = 0;
    for (let y = 0; y < m.rows; y++) for (let x = 0; x <= half; x++) {
      const k = x + ',' + y;
      if (!lt.has(k) && !blockT.has(k) && !wallT.has(k)) open++;
    }
    groundCounts.push(open);
    if (open < 40) errs.ground.push(nameOf(m) + ': only ' + open + ' open tiles a side');
  }
  T('WM.2 geometry law on every board', errs.geo.length === 0, errs.geo.slice(0, 4).join('; ') || AUTHORED.length + ' boards clean');
  T('WM.3 no wall on a lane tile', errs.wall.length === 0, errs.wall.slice(0, 4).join('; ') || 'clean');
  T('WM.4 every authored node survives, on its right ground', errs.node.length === 0, errs.node.slice(0, 4).join('; ') || 'clean');
  T('WM.5 terrain codex complete and in vocabulary', errs.terra.length === 0, errs.terra.slice(0, 4).join('; ') || 'clean');
  T('WM.6 rosters real and led by their denizens', errs.roster.length === 0, errs.roster.slice(0, 4).join('; ') || 'clean');
  T('WM.7 open ground per side at or above the floor', errs.ground.length === 0,
    errs.ground.slice(0, 4).join('; ') || ('min ' + Math.min(...groundCounts) + ' tiles'));
}

/* ---- WM.8 the stream pin ---- */
{
  const file = path.join(ROOT, 'tools', 'fixtures', 'galaxy-stream-pin.json');
  const pin = JSON.parse(fs.readFileSync(file, 'utf8'));
  let checked = 0, diffs = [];
  for (const key of Object.keys(pin)) {
    const [seed, fac, pool] = key.split(':');
    const g = vm.runInContext(
      'generateGalaxy(' + seed + ',' + JSON.stringify(fac) + ',' + pool + ',1,2)', ctx);
    const rows = [];
    g.systems.forEach(sys => sys.worlds.forEach(w => {
      rows.push([sys.name, w.name, w.owner, w.kind, w.seat ? 1 : 0,
                 w.contested ? (w.contestedBy || []).join('+') : '',
                 w.renegade ? 1 : 0, w.arena || '', w.boon || ''].join('|'));
    }));
    for (let i = 0; i < Math.max(rows.length, pin[key].length); i++) {
      checked++;
      if (rows[i] !== pin[key][i] && diffs.length < 3)
        diffs.push(key + ' world ' + i + ': ' + JSON.stringify(pin[key][i]) + ' -> ' + JSON.stringify(rows[i]));
    }
    if (diffs.length >= 3) break;
  }
  T('WM.8 the galaxy stream pin holds (maps excepted by design)', diffs.length === 0,
    diffs.join(' | ') || checked + ' world rows equal across ' + Object.keys(pin).length + ' galaxies');
}

/* ---- WM.9 live assignment ---- */
{
  const diffs = [];
  let worlds = 0, contested = 0;
  for (const fac of ['human', 'light', 'xeno', 'pirate', 'robot']) {
    const g = vm.runInContext('generateGalaxy(20290413,' + JSON.stringify(fac) + ',0,1,2)', ctx);
    g.systems.forEach(sys => sys.worlds.forEach(w => {
      worlds++;
      const wm = G.WORLD_MAP_BY_NAME[w.name];
      /* The exact invariant after Session 44: contested means three-way
         GROUND (a tri board), and everything else means the planet's own
         handcrafted board. No campaign world may keep a pool roll. */
      if (w.contested) {
        contested++;
        const def = G.MAPS.find(m => m.id === w.map);
        if (!def || !def.tri) diffs.push(fac + ' ' + w.name + ': contested on non-tri ' + w.map);
      } else if (wm && w.map !== wm.id) {
        diffs.push(fac + ' ' + w.name + ': fields ' + w.map + ' not ' + wm.id);
      } else if (!wm) {
        diffs.push(fac + ' ' + w.name + ': no authored board');
      }
    }));
  }
  T('WM.9 every campaign world fields its own board (tri on contested)', diffs.length === 0,
    diffs.slice(0, 4).join('; ') || (worlds + ' worlds, ' + contested + ' contested on tri grounds'));
}

/* ---- WM.10 one universe: the same planet fields the same ground in every
        campaign. Systems sit at different tiers per faction, so anything
        keyed off the tier index diverges across factions; owner-sweep 38.1
        caught exactly that in a real page when the first tri assignment
        used (si, wi). This is the node-side twin of that check. ---- */
{
  const byName = {};
  const diffs = [];
  for (const fac of ['human', 'light', 'xeno', 'pirate', 'robot']) {
    const g = vm.runInContext('generateGalaxy(20290413,' + JSON.stringify(fac) + ',0,1,2)', ctx);
    g.systems.forEach(sys => sys.worlds.forEach(w => {
      if (byName[w.name] === undefined) byName[w.name] = { map: w.map, fac };
      else if (byName[w.name].map !== w.map && diffs.length < 4)
        diffs.push(w.name + ': ' + byName[w.name].map + ' (' + byName[w.name].fac + ') vs ' +
                   w.map + ' (' + fac + ')');
    }));
  }
  T('WM.10 the same planet fields the same ground in every campaign', diffs.length === 0,
    diffs.join('; ') || Object.keys(byName).length + ' planets consistent across 5 campaigns');
}


/* ---- WM.11 every procedural family has its handcrafted reference board,
        named exactly as the family's MAPS entry names it. The reference set
        is the design corpus a future generator is judged against, so a
        family without one is a family nobody ever specified. ---- */
{
  const fams = G.MAPS.filter(m => m.procedural).map(m => m.family);
  const missing = fams.filter(f => !G.FAMILY_REFERENCE_BY_ID[f]);
  const extra = G.FAMILY_REFERENCE.map(r => r.family).filter(f => fams.indexOf(f) < 0);
  const drift = [];
  for (const f of fams) {
    const ref = G.FAMILY_REFERENCE_BY_ID[f], def = G.MAPS.find(m => m.family === f);
    if (ref && def && String(ref.name).toUpperCase() !== String(def.name).toUpperCase())
      drift.push(f + ': reference "' + ref.name + '" vs board "' + def.name + '"');
  }
  /* And they must stay UNPLAYABLE: a reference board that reached MAPS would
     start being dealt to real worlds by the pool draw. */
  const leaked = G.MAPS.filter(m => G.FAMILY_REFERENCE.indexOf(m) >= 0).map(m => m.family);
  T('WM.11 every family has a reference board, named alike, none playable',
    missing.length === 0 && extra.length === 0 && drift.length === 0 && leaked.length === 0,
    (missing.length ? 'missing ' + missing.join(', ') + '; ' : '') +
    (extra.length ? 'extra ' + extra.join(', ') + '; ' : '') +
    (drift.length ? drift.join('; ') + '; ' : '') +
    (leaked.length ? 'LEAKED INTO MAPS: ' + leaked.join(', ') : '') ||
    fams.length + ' families, all referenced, none in MAPS');
}

/* ---- WM.12 THE OWNER'S RULE: no board entry may lack a map. Every entry
        the document lists must resolve to real geometry it can draw, by one
        of exactly four routes. This is the check that would have caught the
        19 blank entries that prompted the whole batch. ---- */
{
  const undrawable = [];
  for (const m of G.MAPS) {
    const drawable =
      (m.tri && Array.isArray(m.triLanes) && m.triLanes.length > 0) ||
      (m.procedural && !!G.FAMILY_REFERENCE_BY_ID[m.family]) ||
      (!m.tri && !m.procedural && Array.isArray(m.lanes) && m.lanes.length > 0);
    if (!drawable) undrawable.push(m.id);
  }
  T('WM.12 every board entry resolves to geometry a page can draw',
    undrawable.length === 0,
    undrawable.length ? 'no drawable geometry: ' + undrawable.join(', ')
                      : G.MAPS.length + ' entries all drawable');
}

/* ---- WM.13 the challenge dimension: present on everything this project
        authors, in vocabulary, and actually SPREAD. A codex field where every
        board says the same thing has stopped classifying anything. ---- */
{
  const missing = AUTHORED.filter(m => !m.terra || !m.terra.challenge).map(nameOf);
  const spread = {};
  for (const m of AUTHORED) if (m.terra && m.terra.challenge)
    spread[m.terra.challenge] = (spread[m.terra.challenge] || 0) + 1;
  const unused = G.TERRA_VOCAB.challenge.filter(v => !spread[v]);
  T('WM.13 every authored board declares a challenge, and every level is used',
    missing.length === 0 && unused.length === 0,
    (missing.length ? 'no challenge: ' + missing.slice(0, 4).join(', ') : '') ||
    (unused.length ? 'level never used: ' + unused.join(', ') : '') ||
    G.TERRA_VOCAB.challenge.map(v => v + ' ' + spread[v]).join(', '));
}

/* ---- WM.14 uniqueness. The owner asked for boards that are all different;
        two entries with identical geometry would be one board wearing two
        names, and the codex would be describing a duplicate. ---- */
{
  const seen = new Map();
  const dupes = [];
  for (const m of AUTHORED) {
    const key = JSON.stringify([m.cols, m.rows, m.lanes, m.blocks || [], m.walls || []]);
    if (seen.has(key)) dupes.push(nameOf(m) + ' is identical to ' + seen.get(key));
    else seen.set(key, nameOf(m));
  }
  T('WM.14 no two authored boards share the same geometry', dupes.length === 0,
    dupes.slice(0, 3).join('; ') || AUTHORED.length + ' boards, all distinct');
}


/* ---- WM.15 the codex covers every board in the game, not just the ones
        this batch authored. A classification scheme applied to half the
        shelf cannot be sorted by, and a value outside the vocabulary is a
        classification nobody can query. ---- */
{
  const bare = G.MAPS.filter(m => !m.terra && !m.procedural).map(m => m.id);
  const off = [];
  for (const m of CLASSIFIED) {
    for (const k of Object.keys(G.TERRA_VOCAB))
      if (G.TERRA_VOCAB[k].indexOf(m.terra[k]) < 0)
        off.push(nameOf(m) + '.' + k + '=' + JSON.stringify(m.terra[k]));
    if (typeof m.terra.basis !== 'string' || m.terra.basis.length < 40)
      off.push(nameOf(m) + '.basis is not a real sentence');
  }
  /* Every vocabulary value must be EARNED by some board. A term nothing uses
     is a category that was imagined rather than observed. */
  const unused = [];
  for (const k of Object.keys(G.TERRA_VOCAB))
    for (const v of G.TERRA_VOCAB[k])
      if (!CLASSIFIED.some(m => m.terra[k] === v)) unused.push(k + ':' + v);
  T('WM.15 every board carries the codex, in vocabulary, and every term is used',
    bare.length === 0 && off.length === 0 && unused.length === 0,
    (bare.length ? 'unclassified: ' + bare.join(', ') + '; ' : '') +
    (off.length ? 'out of vocabulary: ' + off.slice(0, 3).join(', ') + '; ' : '') +
    (unused.length ? 'term never used: ' + unused.join(', ') : '') ||
    CLASSIFIED.length + ' boards classified, every vocabulary term earned');
}

console.log((fail ? 'WORLD BOARDS: ' + fail + ' FAILURE(S)' : 'WORLD BOARDS: ' + pass + ' checks, all pass'));
process.exit(fail ? 1 : 0);
