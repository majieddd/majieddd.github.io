#!/usr/bin/env node
/* DEAD CONFIG FIELDS. A key that a config table declares and no code ever
   reads is not documentation, it is a promise the engine does not keep.

   WHY THIS EXISTS. Session 37 shipped two owner-reported defects that were
   both exactly this shape, and both had been sitting in the tree for
   sessions with every gate green:

     scenario.spawn  'neutral' vs 'enemyside', declared on all five
                     commanderless scenarios, read NOWHERE. Its own comment
                     said "there is no far side at all" while buildField
                     mirrored a full rival half onto every one of them.
     scenario.kind   'survive' vs 'endless', declared on the same five, read
                     NOWHERE. So a survive board had no win condition at all:
                     the only exit was losing, scored on the wave you died at.

   Neither is findable by reading the config, because the config LOOKS right.
   They are only findable by asking whether anything reads it, which is a
   question a machine should ask, not a person.

   WHAT IT SCANS. Top-level SCREAMING_CASE config tables (`const NAME = [`
   or `const NAME = {`), which is where this project keeps the data that
   describes behaviour. Object keys inside them are collected, then every
   js/ and tools/ file is searched for a READ of that key: `.key`,
   `['key']`, `["key"]`, or a `{ key }` destructure. Zero reads is a finding.

   IT IS A LINTER, NOT AN ORACLE. A key reached only through a computed
   lookup (`def[someVar]`) reads as dead here and is not. That is what
   ALLOW is for, and every entry in it carries the reason it is there, so
   the list stays auditable instead of becoming a place findings go to die.

   Usage:  node tools/deadfields.js          # report, exit 1 on findings
           node tools/deadfields.js --list   # report, always exit 0
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIRS = ['js', 'tools'];

/* Keys that are genuinely read, but not in a form the scan below can see.
   Each entry states WHY, so a future session can re-check rather than trust. */
const ALLOW = new Map([
  ['id',    'universal; read through countless computed lookups and find() predicates'],
  ['name',  'universal display field, read through generic renderers'],
  ['icon',  'universal display field, read through generic renderers'],
  ['color', 'universal display field, read through generic renderers'],
  ['desc',  'universal display field, read through generic renderers'],
  /* THE STANCE KEYS of DIALOGUE.answers.<faction>. All seven are read by one
     computed dispatch, `(set && set[stance])` in battleDialogue
     (js/dialogue.js), where `stance` comes from DIALOGUE.stance[rivalId].
     There is no literal `.certainty` anywhere and there never will be.
     All seven are listed even though the scan flagged only `certainty`: the
     other six are currently spared by coincidental `.offer` / `.duty` style
     matches elsewhere in the tree, so listing just the one that fired would
     leave the rest to go red the moment an unrelated reference is deleted. */
  ['certainty', 'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['contempt',  'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['appetite',  'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['offer',     'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['plunder',   'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['duty',      'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
  ['doubt',     'DIALOGUE.answers stance key, read via set[stance] in battleDialogue'],
]);

/* Whole SHAPES of key that are read by computed access, with the dispatch
   site that proves it. A pattern is preferred to a list of names because the
   next tower stat ending in Mul must not have to be added here by hand. */
const ALLOW_PATTERNS = [
  { re: /Mul$/,
    why: "Tower.applyTech dispatches on k.endsWith('Mul') over `for (const k in mods)` (js/entities.js:1483-1487)" },
];

/* THE BLIND SPOT, AND THE CURE.
   A bare `.key` scan cannot tell WHOSE key it found. `scenario.kind` was dead
   for sessions while `world.kind` was read on nearly every screen, so the
   scan saw `.kind` and called it live: this tool's first cut missed both of
   the defects it was written for, which is the single most important thing to
   know about it.

   For tables whose fields DESCRIBE BEHAVIOUR, name the variables that hold
   one of their entries. The scan then asks the precise question ("does
   anything read `scenario.kind`") instead of the loose one ("does anything
   anywhere read a property called kind"). Tables absent from this map fall
   back to the loose scan, which still finds uniquely-named dead fields and
   still cannot see through a name collision. */
const ALIASES = new Map([
  ['SCENARIOS',               ['scenario', 'sc', 'sc0', 'scn']],
  ['OWNED_REVISIT_SCENARIOS', ['scenario', 'sc', 'sc0', 'scn']],
]);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* A read of `key`: property access, bracket access, or a destructure. */
function readsKey(key) {
  const k = esc(key);
  return new RegExp(
    '\\.' + k + '\\b' +                         // obj.key
    '|\\[\\s*[\'"]' + k + '[\'"]\\s*\\]' +      // obj['key']
    '|\\{[^{}\\n]*\\b' + k + '\\b[^{}\\n]*\\}\\s*=',  // const { key } = obj
    '');
}

/* A read of `key` ON one of this table's own consumers. */
function readsKeyVia(key, aliases) {
  const k = esc(key);
  const alt = aliases.map(a => '(?:\\w+\\.)*' + esc(a)).join('|');
  return new RegExp('(?:' + alt + ')\\s*(?:\\.' + k + '\\b|\\[\\s*[\'"]' + k + '[\'"]\\s*\\])', '');
}

/* Walk from an opening bracket to its match, respecting strings, template
   literals, regex-ish slashes and comments well enough for this codebase. */
function extentFrom(s, open) {
  const closeOf = { '[': ']', '{': '}' };
  const want = closeOf[s[open]];
  if (!want) return -1;
  let depth = 0, i = open;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* Blank the CONTENTS of every string and template literal, keeping the quotes
   so the surrounding syntax still parses by eye.

   WHY: the key scan looks for `word:`, and this game's config is full of
   prose that contains exactly that. `'OBSERVATION, unauthorised: the queue
   defends itself.'` was reported as a dead config field named
   `unauthorised`. Any dialogue line with a colon in it would do the same, so
   the fix belongs here rather than in ALLOW. */
function stripStrings(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += q; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const files = [];
for (const d of SRC_DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir))
    if (/\.(js|mjs)$/.test(f)) files.push(path.join(dir, f));
}
const bodies = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]));
/* READS ARE SEARCHED IN CODE, NEVER IN PROSE. This file's own header quotes
   `scenario.kind` and `scenario.spawn` as the examples that motivated it, and
   with comments left in the corpus the scanner found those two strings and
   pronounced both fields live: the linter's documentation defeated the
   linter. Stripping comments first fixes the whole class, not just this
   file's self-reference, because a comment anywhere that names a property is
   otherwise indistinguishable from code that reads it. */
const codeOnly = new Map([...bodies].map(([f, b]) => [f, stripComments(b)]));

/* 1. find the config tables */
const tables = [];
for (const [file, body] of bodies) {
  const re = /(?:^|\n)\s*const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*([[{])/g;
  let m;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].lastIndexOf(m[2]);
    const end = extentFrom(body, open);
    if (end < 0) continue;
    tables.push({ file, name: m[1], text: body.slice(open, end + 1),
                  line: body.slice(0, open).split('\n').length });
  }
}

/* 2. collect the SCHEMA FIELDS each table declares.
   THE DISCRIMINATOR IS REPETITION. A config table is either a dictionary
   keyed by entity id (`ENEMY_TYPES = { aegis: {...}, basalt: {...} }`) or a
   list of records that share a shape (`SCENARIOS = [ {id, kind, spawn}, ...
   ]`). An id appears ONCE in its table and is read through a computed lookup
   this scan cannot see; a schema field REPEATS across sibling entries and is
   read by name. Requiring at least two occurrences in one table is what
   separates them, and it is why the first cut of this tool reported 200+
   entity ids as dead fields. */
const MIN_OCCURRENCES = 2;
/* A string value at least this long is prose, not a behaviour token. Chosen
   above the longest enum value this config uses ('enemyside' is 9) and below
   the shortest authored sentence. */
const PROSE_CHARS = 40;
const declared = new Map();   // key -> [{table, file, line}]
for (const t of tables) {
  const clean = stripStrings(stripComments(t.text));
  const kre = /(?:[{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g;
  const counts = new Map();
  let k;
  while ((k = kre.exec(clean))) counts.set(k[1], (counts.get(k[1]) || 0) + 1);
  /* PROSE IS CONTENT, NOT A PROMISE. A field whose value is a sentence is
     lore the writer may be holding back on purpose (FACTION_CAMPAIGN.crisis
     is deliberately never rendered: "discovering it is the campaign",
     js/ui.js:1206-1209). A field whose value is 'neutral' or 70 or [12,16,20]
     is a BEHAVIOUR PARAMETER, and an unread one is the engine failing to keep
     a promise the config makes. Only the second kind is a defect, so measure
     the values rather than lumping both together. */
  const proseRe = new RegExp('\\b([a-zA-Z_$][\\w$]*)\\s*:\\s*([\'"`])([\\s\\S]{' + PROSE_CHARS + ',}?)\\2', 'g');
  const prose = new Map();
  const withStrings = stripComments(t.text);
  let pm;
  while ((pm = proseRe.exec(withStrings))) prose.set(pm[1], (prose.get(pm[1]) || 0) + 1);
  for (const [key, n] of counts) {
    if (n < MIN_OCCURRENCES) continue;
    if ((prose.get(key) || 0) >= n) continue;   /* every value is a sentence */
    /* THE TERRAIN CODEX (Session 44, docs/WORLDMAPS-DESIGN.md). worldmaps.js
       carries a design-classification block per board: closed-vocabulary
       tokens that are DESIGN content, not engine promises, the same
       distinction the prose rule above draws for sentences. Their contract
       deliberately lives tool-side: probe-worldmaps WM.5 fails the gate on
       any value outside TERRA_VOCAB, and the narrative spine renders every
       field. Scoped to worldmaps.js and to exactly these names, so a real
       behaviour field added to that file is still caught (verified by
       planting `surgeRate: 7` on two boards: flagged; control green). */
    if (/worldmaps\.js$/.test(t.file) &&
        ['class', 'flow', 'cover', 'barriers', 'sight', 'basis'].indexOf(key) >= 0) continue;
    if (!declared.has(key)) declared.set(key, []);
    const hit = declared.get(key);
    if (!hit.some(h => h.table === t.name)) hit.push({ table: t.name, file: t.file, line: t.line });
  }
}

/* 3. a key is LIVE if anything reads it. Tables with declared consumers are
      asked the precise question; the rest fall back to the loose scan. */
/* EVERY ENTITY ID THE CONFIG DECLARES. A field whose name is also an id is
   almost always a map keyed by that id (`elemResist: { frost: .6 }`,
   `KIND_WEIGHTS: { nest: 26 }`) and is read as `map[id]`, which no name scan
   can see. Derived from the tables themselves rather than listed, so a new
   element or world kind needs no edit here. */
const knownIds = new Set();
for (const t of tables) {
  const clean = stripComments(t.text);
  let m;
  const idRe = /\bid\s*:\s*['"]([\w-]+)['"]/g;
  while ((m = idRe.exec(clean))) knownIds.add(m[1]);
  /* dictionary tables: `const X = { someId: { ... } }` */
  if (t.text[0] === '{') {
    const topRe = /(?:^\{|,)\s*([a-zA-Z_$][\w$]*)\s*:\s*[{[]/g;
    while ((m = topRe.exec(clean))) knownIds.add(m[1]);
  }
}

const findings = [];
for (const [key, where] of declared) {
  if (ALLOW.has(key)) continue;
  if (key.length < 3) continue;               /* x, y, r: positional, always read positionally */
  if (ALLOW_PATTERNS.some(p => p.re.test(key))) continue;
  if (knownIds.has(key)) continue;            /* a map keyed by an entity id */
  /* A field is only dead if it is dead in EVERY table that declares it: the
     same name can be behaviour in one table and live data in another. */
  const deadIn = [];
  for (const h of where) {
    const aliases = ALIASES.get(h.table);
    const re = aliases ? readsKeyVia(key, aliases) : readsKey(key);
    let live = false;
    for (const [, body] of codeOnly) { if (re.test(body)) { live = true; break; } }
    if (!live) deadIn.push(h);
  }
  if (deadIn.length) findings.push({ key, where: deadIn, scoped: deadIn.some(h => ALIASES.has(h.table)) });
}

findings.sort((a, b) => a.key.localeCompare(b.key));

const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
if (!findings.length) {
  console.log('dead config fields: none across ' + tables.length + ' tables in ' + files.length + ' files');
} else {
  console.log('DEAD CONFIG FIELDS (declared, never read) across ' +
              tables.length + ' tables in ' + files.length + ' files:\n');
  for (const f of findings) {
    const w = f.where.map(h => h.table + ' (' + rel(h.file) + ':' + h.line + ')').join(', ');
    console.log('  ' + f.key.padEnd(22) + w);
  }
  console.log('\n' + findings.length + ' finding(s). Either wire the field to behaviour, delete it, or');
  console.log('add it to ALLOW in this file WITH THE REASON it is unreadable by the scan.');
}
process.exit(process.argv.includes('--list') ? 0 : (findings.length ? 1 : 0));
