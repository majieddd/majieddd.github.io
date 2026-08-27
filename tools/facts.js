#!/usr/bin/env node
/* WHAT IS ACTUALLY IN THE GAME, ANSWERED BY LOADING IT.
 *
 * WHY THIS EXISTS. Session 38, asked how many towers each origin has, I ran
 *
 *     re.search(r"const TOWER_ORDER = \[(.*?)\]", src, re.S)
 *
 * against the source text. `.*?` is non-greedy, TOWER_ORDER is authored as
 * several bracketed runs, and the match stopped at the FIRST `]`. It reported
 * 19 towers. There are 60. I then built an entire design argument on top of
 * the wrong number ("Federation and Xeno only have two towers each, so an
 * own-origin loadout is arithmetically impossible") and started implementing
 * it. The owner caught it: "There are way more towers than this."
 *
 * That is not a one-off. It is the same failure the suite has already been
 * bitten by four separate ways, all recorded in references/verification.md:
 * a grep against a single-line 221KB file, an ordered `id:...name:...origin:`
 * regex that returned zero because the real defs put `origin` first, a scan
 * that counted a COMMENT describing a fix as an instance of the defect, and
 * a listing that counted branch-upgrade ids as buildable towers.
 *
 * The pattern: SOURCE TEXT IS NOT THE PROGRAM. Any question of the form "how
 * many X are there", "which X belong to Y", "does X exist" has an authoritative
 * answer available for the price of loading the modules, and a regex only ever
 * approximates it. So this loads them.
 *
 * THE STANDING RULE THIS ENFORCES, also written into the aegis-gamedev skill:
 * never answer a question about game DATA by pattern-matching js/*.js. Run
 * this. If it cannot answer your question yet, add a subcommand: that is
 * cheaper than being wrong, and it is permanent.
 *
 *   node tools/facts.js counts       every headline number, one line each
 *   node tools/facts.js towers       all towers by origin, with role and cost
 *   node tools/facts.js units        all denizens by faction
 *   node tools/facts.js commanders   roster with faction, trait and signature
 *   node tools/facts.js signatures   the signature table alone
 *   node tools/facts.js check        signature legality gate (exit 1 on fail)
 *   node tools/facts.js get <expr>   evaluate <expr> against the loaded globals
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* THE MODULE LIST IS READ FROM build.js, never written here. The skill's own
   law is "never hand-write a number a command can print", and a hand-copied
   module list is the same defect with a longer fuse: it goes stale silently
   the next time a module is added, and then this tool reports on a version of
   the game that no longer exists. build.js is the one place that list is
   authoritative, because the shipped bundle is built from it. */
function moduleOrder() {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const m = src.match(/const js\s*=\s*\[([^\]]*)\]/);
  if (!m) throw new Error('build.js no longer declares `const js = [...]`, so the module order is unknown. Fix this reader rather than guessing an order.');
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/* Modules that need no DOM. Everything from here on wants document/canvas and
   belongs in a browser harness (tools/headless.js), not in this process.
   Derived from the build order rather than listed, so adding a data module
   upstream of `commanders` picks it up automatically. */
const DATA_END = 'commanders';

function loadGame() {
  const order = moduleOrder();
  const stop = order.indexOf(DATA_END);
  if (stop < 0) throw new Error('build.js no longer builds `' + DATA_END + '`. Update DATA_END in this file.');
  const names = order.slice(0, stop + 1);

  const parts = [];
  const skipped = [];
  for (const n of names) {
    const f = path.join(ROOT, 'js', n + '.js');
    if (!fs.existsSync(f)) { skipped.push(n + ' (no file)'); continue; }
    parts.push('/* ' + n + ' */\n' + fs.readFileSync(f, 'utf8'));
  }

  /* A window stub, because a couple of data modules touch it at load. NOT a
     try/catch around the load: a module that throws here must say so loudly,
     since every number this tool prints would otherwise be computed from a
     half-loaded game. That is the "never catch an exception you do not
     report" law, and this is exactly the place it bites. */
  const win = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const body = parts.join('\n\n') + '\n; return this;';
  let G;
  try {
    G = new Function('window', 'document', 'self', body).call(Object.create(null), win, undefined, win);
  } catch (e) {
    throw new Error('loading js/ modules failed at runtime: ' + e.message +
                    '\nThis is a real defect in the game source, not in this tool. ' +
                    'Run `node --check` on the modules above.');
  }
  /* `return this` inside a non-strict Function body hands back the receiver,
     which does NOT carry top-level `const`/`function` declarations. So collect
     the names explicitly instead of hoping. */
  const want = ['TOWER_TYPES', 'TOWER_ORDER', 'TOWER_ORIGINS', 'ORIGIN_ORDER',
                'ENEMY_TYPES', 'FACTION_UNITS', 'FACTION_ENEMIES', 'FACTIONS',
                'POWER_ORDER', 'FACTION_ORDER', 'COMMANDER_ROSTER', 'COMMANDERS',
                'LOADOUT_SIZE', 'LOADOUT_OWN_ORIGIN', 'MUSTER_LOADOUT_SIZE',
                'originKeyOf', 'POWER_ORIGIN', 'SUMMON_DOCTRINES', 'DOCTRINE_ORDER'];
  const picked = new Function('window', 'document', 'self',
    body.replace('; return this;', '; return {' + want.map(w =>
      'get ' + w + '(){ return typeof ' + w + ' === "undefined" ? undefined : ' + w + '; }').join(',') + '};'))
    .call(Object.create(null), win, undefined, win);

  const out = {};
  for (const w of want) out[w] = picked[w];
  out.__modules = names;
  out.__skipped = skipped;
  return out;
}

/* Anything whose primary job is killing, and anything that answers air. These
   two lists live in js/ai.js and are the brain's own judgement, so they are
   read from there rather than restated: a copy here would drift the first time
   a tower is added and would then misreport whether an origin can fight. */
function aiLists() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'ai.js'), 'utf8');
  const grab = name => {
    /* Tolerant of the alignment padding the source actually uses. The first
       cut matched the literal 'const AIR =' and js/ai.js writes
       'const AIR    = [', so it threw on its very first run. Kept as a
       THROW rather than a silent empty list, because an empty AIR list would
       have quietly reported that no origin can answer air. */
    /* No regex at all on the second cut. Building one through a string
       literal is how the escapes collapsed (`'const\s+'` became `consts+`,
       an unterminated character class), which is the SAME class of mistake
       this whole file exists to retire. A line scan cannot be escaped wrong. */
    const lines = src.split('\n');
    const li = lines.findIndex(l => l.trimStart().startsWith('const ' + name) &&
                                    /^const\b/.test(l.trimStart().slice(0)) &&
                                    l.includes('['));
    if (li < 0) throw new Error('js/ai.js no longer declares ' + name + ' as a bracketed const. Fix this reader.');
    const i = src.indexOf(lines[li]);
    const open = src.indexOf('[', i), close = src.indexOf('];', open);
    return src.slice(open + 1, close).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))
              .filter(s => /^[a-z0-9_]+$/.test(s));
  };
  return { DAMAGE: grab('DAMAGE'), AIR: grab('AIR') };
}

const pad = (s, n) => String(s).padEnd(n);

function cmdCounts(G) {
  const { DAMAGE, AIR } = aiLists();
  console.log('modules loaded        ' + G.__modules.length + '  (' + G.__modules.join(', ') + ')');
  if (G.__skipped.length) console.log('modules skipped       ' + G.__skipped.join(', '));
  console.log('buildable towers      ' + G.TOWER_ORDER.length);
  console.log('tower defs           ' + Object.keys(G.TOWER_TYPES).length);
  console.log('origins               ' + G.ORIGIN_ORDER.length + '  (' + G.ORIGIN_ORDER.join(', ') + ')');
  console.log('powers                ' + G.POWER_ORDER.length + '  (' + G.POWER_ORDER.join(', ') + ')');
  console.log('commanders            ' + G.COMMANDER_ROSTER.length +
              '  (' + G.COMMANDER_ROSTER.filter(c => c.faction).length + ' factioned, ' +
              G.COMMANDER_ROSTER.filter(c => !c.faction).length + ' unaligned)');
  console.log('denizen types         ' + Object.keys(G.ENEMY_TYPES).length +
              '  (' + G.POWER_ORDER.reduce((a, f) => a + (G.FACTION_UNITS[f] || []).length, 0) + ' sendable)');
  console.log('LOADOUT_SIZE          ' + G.LOADOUT_SIZE);
  console.log('LOADOUT_OWN_ORIGIN    ' + G.LOADOUT_OWN_ORIGIN);
  console.log('MUSTER_LOADOUT_SIZE   ' + G.MUSTER_LOADOUT_SIZE);
  console.log('');
  console.log('origin     towers  damage  anti-air  own-origin loadout viable');
  for (const o of G.ORIGIN_ORDER) {
    const own = G.TOWER_ORDER.filter(t => (G.TOWER_TYPES[t] || {}).origin === o);
    const d = own.filter(t => DAMAGE.includes(t)).length;
    const a = own.filter(t => AIR.includes(t)).length;
    console.log(pad(o, 11) + pad(own.length, 8) + pad(d, 8) + pad(a, 10) +
                (d >= 2 && a >= 1 ? 'yes' : 'NO'));
  }
}

function cmdTowers(G) {
  const { DAMAGE, AIR } = aiLists();
  for (const o of G.ORIGIN_ORDER) {
    const own = G.TOWER_ORDER.filter(t => (G.TOWER_TYPES[t] || {}).origin === o);
    console.log('=== ' + o + ' (' + own.length + ') ===');
    for (const t of own) {
      const d = G.TOWER_TYPES[t];
      const tag = (DAMAGE.includes(t) ? 'D' : '-') + (AIR.includes(t) ? 'A' : '-');
      console.log('   ' + pad(t, 14) + pad(d.name || '', 16) + pad('g' + d.cost, 6) + pad(tag, 4) + (d.role || ''));
    }
  }
}

function cmdUnits(G) {
  for (const f of G.POWER_ORDER) {
    const u = G.FACTION_UNITS[f] || [];
    console.log('=== ' + f + ' (' + u.length + ' sendable of ' + (G.FACTION_ENEMIES[f] || []).length + ') ===');
    for (const id of u) {
      const e = G.ENEMY_TYPES[id];
      console.log('   ' + pad(id, 14) + pad(e.name || '', 14) + 'hp=' + e.hp);
    }
  }
}

function cmdCommanders(G) {
  for (const c of G.COMMANDER_ROSTER) {
    const s = c.signature;
    console.log(pad('[' + (c.faction || 'none') + ']', 10) + pad(c.id, 11) + pad(c.name, 16) +
                pad(c.trait && c.trait.name || '-', 22) +
                (s ? 'towers ' + s.towers.join('+') + '  units ' + s.units.join('+') : 'no signature'));
  }
}

function cmdSignatures(G) {
  for (const c of G.COMMANDER_ROSTER) {
    if (!c.signature) { console.log(pad(c.id, 11) + '(none)'); continue; }
    console.log(pad(c.id, 11) + pad(c.faction, 8) +
                pad(c.signature.towers.join(', '), 30) + c.signature.units.join(', '));
  }
}

/* The gate. Every rule the signature block in js/roster.js promises, asserted
   here so the promise cannot rot. Wired into tools/gate.js. */
function cmdCheck(G) {
  const fails = [];
  const seenT = new Map(), seenU = new Map();
  const key = a => a.slice().sort().join('+');

  for (const c of G.COMMANDER_ROSTER) {
    const s = c.signature;
    if (!c.faction) {
      if (s) fails.push(c.id + ' is unaligned and must carry no signature');
      continue;
    }
    if (!s) { fails.push(c.id + ' has no signature'); continue; }
    if (!Array.isArray(s.towers) || s.towers.length !== 2) fails.push(c.id + ' needs exactly 2 signature towers');
    if (!Array.isArray(s.units) || s.units.length !== 2) fails.push(c.id + ' needs exactly 2 signature units');

    const origin = G.originKeyOf(c.faction);
    for (const t of s.towers || []) {
      if (!G.TOWER_ORDER.includes(t)) fails.push(c.id + ' names ' + t + ', which is not a buildable tower');
      else if ((G.TOWER_TYPES[t] || {}).origin !== origin)
        fails.push(c.id + ' (' + c.faction + '/' + origin + ') names ' + t +
                   ', whose origin is ' + (G.TOWER_TYPES[t] || {}).origin);
    }
    for (const u of s.units || []) {
      if (!(G.FACTION_UNITS[c.faction] || []).includes(u))
        fails.push(c.id + ' names denizen ' + u + ', which is not a sendable ' + c.faction + ' unit');
    }
    if (s.towers && s.towers[0] === s.towers[1]) fails.push(c.id + ' names the same tower twice');
    if (s.units && s.units[0] === s.units[1]) fails.push(c.id + ' names the same denizen twice');

    if (s.towers) {
      const k = key(s.towers);
      if (seenT.has(k)) fails.push(c.id + ' shares its tower pair (' + k + ') with ' + seenT.get(k));
      else seenT.set(k, c.id);
    }
    if (s.units) {
      const k = key(s.units);
      if (seenU.has(k)) fails.push(c.id + ' shares its denizen pair (' + k + ') with ' + seenU.get(k));
      else seenU.set(k, c.id);
    }
  }

  /* The banner-key trap that caused all of this: every power must map to a
     real origin, or flyTheBanner silently finds nothing to fly. */
  for (const f of G.POWER_ORDER) {
    const o = G.originKeyOf(f);
    if (!G.ORIGIN_ORDER.includes(o))
      fails.push('power ' + f + ' maps to origin ' + o + ', which is not in ORIGIN_ORDER');
    const n = G.TOWER_ORDER.filter(t => (G.TOWER_TYPES[t] || {}).origin === o).length;
    if (n < G.LOADOUT_SIZE)
      fails.push('power ' + f + ' has only ' + n + ' own-origin towers against LOADOUT_SIZE ' + G.LOADOUT_SIZE);
  }

  if (fails.length) {
    console.error('facts check FAILED, ' + fails.length + ' violation' + (fails.length > 1 ? 's' : '') + ':');
    for (const f of fails) console.error('  ' + f);
    process.exit(1);
  }
  console.log('facts check OK: ' + seenT.size + ' commanders, all signature towers own-origin, ' +
              seenT.size + ' distinct tower pairs, ' + seenU.size + ' distinct denizen pairs, ' +
              G.POWER_ORDER.length + ' powers map to a real origin');
}

function main() {
  const cmd = process.argv[2] || 'counts';
  const G = loadGame();
  switch (cmd) {
    case 'counts':     return cmdCounts(G);
    case 'towers':     return cmdTowers(G);
    case 'units':      return cmdUnits(G);
    case 'commanders': return cmdCommanders(G);
    case 'signatures': return cmdSignatures(G);
    case 'check':      return cmdCheck(G);
    case 'get': {
      const expr = process.argv.slice(3).join(' ');
      if (!expr) { console.error('usage: node tools/facts.js get <expression>'); process.exit(2); }
      const names = Object.keys(G).filter(k => !k.startsWith('__'));
      const val = new Function(...names, 'return (' + expr + ');')(...names.map(n => G[n]));
      return console.log(typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val));
    }
    default:
      console.error('unknown subcommand ' + cmd + '. See the header of this file.');
      process.exit(2);
  }
}

main();
