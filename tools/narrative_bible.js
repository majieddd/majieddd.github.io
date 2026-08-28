/* THE NARRATIVE BIBLE: one HTML page per faction showing that faction's whole
   campaign as a screenplay, with every plate rendered inline beside the line
   the player reads over it.

   WHY THIS AND NOT tools/screenplay.js. The screenplay dump is text, written
   for reading the FLOW: it is what caught THE DEPARTURE firing an act late.
   This is written for the other half of the job, judging whether the ART and
   the WRITING line up, which needs both on screen together and cannot be done
   in a terminal. Same data, same play order, different instrument.

   The pages reference `../art/pcut_*.webp` rather than embedding anything, so
   the whole bible is a few hundred KB of markup against 187MB of plates that
   are already deployed. Images are lazy, so a page costs what you scroll.
   Every plate carries its KEY on screen and its full prompt on hover, which
   is what makes a review actionable: "fix pcut_23_xeno_3" names one file.

   Writes narrative/<faction>.html plus narrative/index.html. Committed and
   deployed, so it is readable on the live site as well as locally.

   Usage: node tools/narrative_bible.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'galaxy', 'story', 'cutscenes',
                 'planetcuts', 'roster', 'dialogue'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });

/* Top-level `const` in runInContext does not attach to the context object;
   lift the bindings out with an in-context expression. */
const G = vm.runInContext(
  '({ GX_UNIVERSE_ORDER, GX_HOME_SYSTEMS, GX_V2_HOLDER, CUTSCENES, PLANET_CUTS, ' +
  'PLANET_MOMENTS, STORY, STORY_ACTS, COMMANDER_ROSTER, FACTIONS })', ctx);

/* The prompt subjects, for the hover title on each plate. Read from the same
   catalogue the renderer used, so a drifted prompt shows up here too. */
let PROMPTS = {};
try {
  const out = require('child_process').execSync(
    '"' + path.join(path.dirname(ROOT), 'artgen-env', 'Scripts', 'python.exe') + '" -c ' +
    '"import sys,json; sys.path.insert(0,\'artgen\'); ' +
    'from krea_jobs import CUTSCENE_PALETTE, STYLE; from planet_jobs import planet_jobs; ' +
    'print(json.dumps({k: p.split(\'. Dramatic staging\')[0] for k,p,*_ in planet_jobs(CUTSCENE_PALETTE, STYLE)}))"',
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
  PROMPTS = JSON.parse(out);
} catch (e) { console.log('  (prompts unavailable, hover titles omitted: ' + e.message.split('\n')[0] + ')'); }

const BEATS = ['APPROACH', 'THE GROUND', 'THE ASSAULT', 'AFTERMATH', 'NEW ORDER'];
const MOMENTS = [
  ['seat', 'SEAT, the act climax'], ['contested', 'CONTESTED world'],
  ['renegade', 'against your OWN banner'], ['retaken', 'a world a rival took back'],
  ['flawless', 'THREE STARS, replaces AFTERMATH'], ['defeat', 'a campaign LOSS'],
];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const facName = id => (G.FACTIONS[id] && G.FACTIONS[id].name) || id;
const facColor = id => (G.FACTIONS[id] && G.FACTIONS[id].color) || '#7dd3fc';
const cmdName = id => {
  const c = G.COMMANDER_ROSTER.find(x => x.id === id);
  const fig = vm.runInContext('STORY_FIGURES[' + JSON.stringify(id) + '] || null', ctx);
  if (c) return c.name + ', ' + c.title;
  if (fig) return fig.name + (fig.title ? ', ' + fig.title : '');
  return id.toUpperCase();
};

const CSS = `
:root{--bg:#0a0e17;--ink:#e2e8f0;--dim:#94a3b8;--line:rgba(148,163,184,.22);--fc:#7dd3fc}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.6 ui-sans-serif,system-ui,"Segoe UI",sans-serif}
a{color:var(--fc)}
header{position:sticky;top:0;z-index:9;background:rgba(10,14,23,.94);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 20px}
header h1{margin:0;font-size:19px;letter-spacing:.06em;color:var(--fc)}
nav{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
nav a{font-size:12px;padding:4px 9px;border:1px solid var(--line);border-radius:99px;
  text-decoration:none;color:var(--dim)}
nav a:hover{color:var(--fc);border-color:var(--fc)}
main{max-width:1180px;margin:0 auto;padding:22px 20px 90px}
h2{font-size:16px;letter-spacing:.08em;color:var(--fc);margin:38px 0 4px;
  padding-top:14px;border-top:1px solid var(--line)}
h3{font-size:15px;margin:26px 0 8px;letter-spacing:.04em}
h3 .seat{font-size:10px;color:var(--bg);background:var(--fc);border-radius:3px;
  padding:2px 6px;margin-left:8px;letter-spacing:.08em;vertical-align:2px}
.sub{color:var(--dim);font-size:12.5px;margin:0 0 14px}
.oath{border-left:2px solid var(--fc);padding:2px 0 2px 16px;margin:14px 0}
.oath p{margin:8px 0}
.spine{width:100%;border-collapse:collapse;margin:14px 0 8px;font-size:13px}
.spine th,.spine td{border:1px solid var(--line);padding:8px 10px;vertical-align:top;text-align:left}
.spine th{color:var(--dim);font-weight:600;font-size:11px;letter-spacing:.08em}
.spine td b{color:var(--fc)}
.beats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.beat{display:flex;flex-direction:column;gap:6px;min-width:0}
.beat img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;
  border:1px solid var(--line);background:#000;display:block}
.beat .lbl{font-size:10px;letter-spacing:.09em;color:var(--fc)}
.beat .key{font-size:10px;color:#64748b;word-break:break-all;
  font-family:ui-monospace,Consolas,monospace}
.beat p{margin:0;font-size:12.5px;line-height:1.5}
.gap{aspect-ratio:16/9;border:1px dashed var(--line);border-radius:6px;
  display:grid;place-items:center;font-size:11px;color:#64748b}
.story{border:1px solid var(--line);border-left:3px solid var(--fc);
  border-radius:6px;padding:14px 16px;margin:20px 0;background:rgba(148,163,184,.05)}
.story .act{font-size:11px;letter-spacing:.1em;color:var(--fc)}
.story .who{font-size:12px;color:var(--dim);margin:6px 0 8px}
.story blockquote{margin:0;font-size:14px}
.story .rev{margin-top:10px;font-size:12px;color:var(--dim);font-style:italic}
.turn{border-left:2px solid rgba(148,163,184,.4);padding-left:16px;margin:18px 0;
  font-size:13.5px;color:#cbd5e1}
.moment{border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin:10px 0}
.moment b{font-size:11px;letter-spacing:.08em;color:var(--fc);display:block;margin-bottom:4px}
@media(max-width:900px){.beats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.beats{grid-template-columns:1fr}}
`;

function page(fac) {
  const home = G.GX_UNIVERSE_ORDER.indexOf(fac);
  const col = facColor(fac);
  const o = [];
  const w = s => o.push(s);

  const acts = [];
  for (let t = 0; t < 5; t++) {
    const si = (home + t) % 5;
    acts.push({ tier: t, si, sysFac: G.GX_UNIVERSE_ORDER[si],
                sys: G.GX_HOME_SYSTEMS[G.GX_UNIVERSE_ORDER[si]],
                holder: G.GX_V2_HOLDER[G.GX_UNIVERSE_ORDER[si]][fac] });
  }

  w('<!doctype html><html lang="en"><head><meta charset="utf-8">');
  w('<meta name="viewport" content="width=device-width,initial-scale=1">');
  w('<title>' + esc(facName(fac)) + ' | Narrative Bible</title>');
  w('<style>' + CSS + '</style></head><body style="--fc:' + col + '">');
  w('<header><h1>' + esc(facName(fac)) + ' &mdash; THE COMPLETE CAMPAIGN</h1><nav>');
  w('<a href="index.html">&larr; all factions</a>');
  acts.forEach(a => w('<a href="#act' + (a.tier + 1) + '">ACT ' + (a.tier + 1) + ': ' + esc(a.sys.name) + '</a>'));
  w('<a href="#moments">moments</a><a href="#finale">finale</a></nav></header><main>');

  /* ---------- at a glance ---------- */
  w('<h2 id="spine">AT A GLANCE: the five acts</h2>');
  w('<p class="sub">The order this faction takes the galaxy in. Each act ends on a commander seat, ' +
    'and the seat is the only slide sequence every player of this faction sees in a fixed order.</p>');
  w('<table class="spine"><tr><th>ACT</th><th>SYSTEM</th><th>GARRISON</th><th>SEAT</th>' +
    '<th>STORY BEAT</th><th>WHAT IT MEANS</th></tr>');
  acts.forEach(a => {
    const seatW = G.PLANET_CUTS['' + a.si + '6'];
    const b = G.STORY[fac][a.tier];
    w('<tr><td><b>' + (a.tier + 1) + '</b></td><td>' + esc(a.sys.name) + '</td>' +
      '<td>' + esc(facName(a.holder)) + '</td><td><b>' + esc(seatW.name) + '</b></td>' +
      '<td>' + esc(b.title) + '</td><td>' + esc(b.reveal || '') + '</td></tr>');
  });
  w('</table>');

  /* ---------- the oath and the departure ---------- */
  w('<h2 id="oath">THE OATH <span style="color:var(--dim);font-size:12px">(campaign start)</span></h2>');
  w('<div class="oath">');
  G.CUTSCENES[fac].intro.forEach((s, i) => w('<p><b>' + (i + 1) + '.</b> ' + esc(s.text) + '</p>'));
  w('</div>');
  const dep = G.STORY[fac][0];
  w(storyBlock(dep, G.STORY_ACTS[0].name, 'interstitial, straight after the oath'));

  /* ---------- the acts ---------- */
  acts.forEach(a => {
    w('<h2 id="act' + (a.tier + 1) + '">ACT ' + (a.tier + 1) + ': ' + esc(a.sys.name) +
      ' <span style="color:var(--dim);font-size:12px">garrisoned by ' + esc(facName(a.holder)) + '</span></h2>');
    for (let wi = 0; wi < 7; wi++) {
      const e = G.PLANET_CUTS['' + a.si + wi];
      const L = e.f[fac];
      w('<h3>' + esc(e.name) + (wi === 6 ? '<span class="seat">SEAT</span>' : '') + '</h3>');
      w('<div class="beats">');
      for (let b = 1; b <= 5; b++) {
        const key = 'pcut_' + a.si + wi + '_' + fac + '_' + b;
        const text = b === 1 ? L[0] : b === 2 ? e.ground : b === 3 ? e.works : b === 4 ? L[1] : L[2];
        w('<div class="beat"><span class="lbl">' + b + '. ' + BEATS[b - 1] + '</span>');
        w('<img loading="lazy" decoding="async" src="../art/' + key + '.webp" alt="' + key +
          '" title="' + esc(PROMPTS[key] || '') + '">');
        w('<span class="key">' + key + '</span><p>' + esc(text) + '</p></div>');
      }
      w('</div>');
    }
    if (a.tier > 0) w(storyBlock(G.STORY[fac][a.tier], G.STORY_ACTS[a.tier].name, 'result screen, after the seat falls'));
    const t = G.CUTSCENES[fac].sys[a.tier];
    w('<div class="turn"><b style="color:var(--fc);font-size:11px;letter-spacing:.08em">THE TURNING</b>' +
      '<p>' + esc(t.a) + '</p><p>' + esc(t.b) + '</p></div>');
  });

  /* ---------- moments and finale ---------- */
  w('<h2 id="moments">CAMPAIGN MOMENTS <span style="color:var(--dim);font-size:12px">' +
    '(state-triggered, can replace a beat voice on any world)</span></h2>');
  MOMENTS.forEach(([k, label]) => {
    const line = G.PLANET_MOMENTS[k] && G.PLANET_MOMENTS[k][fac];
    if (line) w('<div class="moment"><b>' + esc(label.toUpperCase()) + '</b>' + esc(line) + '</div>');
  });
  w('<h2 id="finale">FINALE</h2>');
  w(storyBlock(G.STORY[fac][5], G.STORY_ACTS[5].name, 'galaxy conquered screen'));
  w('</main></body></html>');
  return o.join('\n');

  function storyBlock(b, actName, where) {
    return '<div class="story"><span class="act">' + esc(actName) +
      ' &middot; ' + esc(where) + '</span>' +
      '<p class="who">' + esc(cmdName(b.speaker)) + (b.title ? ' &mdash; &ldquo;' + esc(b.title) + '&rdquo;' : '') + '</p>' +
      '<blockquote>' + esc(b.line) + '</blockquote>' +
      (b.reveal ? '<p class="rev">' + esc(b.reveal) + '</p>' : '') + '</div>';
  }
}

function index() {
  const o = [];
  o.push('<!doctype html><html lang="en"><head><meta charset="utf-8">');
  o.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  o.push('<title>Cosmic Conquest | Narrative Bible</title><style>' + CSS +
    '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:20px}' +
    '.card{border:1px solid var(--line);border-left:4px solid var(--cc);border-radius:8px;' +
    'padding:16px;text-decoration:none;color:var(--ink);display:block}' +
    '.card:hover{border-color:var(--cc)}.card b{display:block;font-size:15px;color:var(--cc)}' +
    '.card span{font-size:12.5px;color:var(--dim)}</style></head><body>');
  o.push('<header><h1>COSMIC CONQUEST &mdash; NARRATIVE BIBLE</h1></header><main>');
  o.push('<p class="sub">Every faction’s whole campaign, in the order that faction plays it: ' +
    'the oath, five acts of seven worlds, five beats per world with the plate that shows it, ' +
    'the story beat as each seat falls, and the finale. 875 plates in narrative order. ' +
    'Hover any plate to read the prompt it was generated from; its key is printed beneath it, ' +
    'so anything worth changing can be named exactly.</p>');
  o.push('<div class="cards">');
  G.GX_UNIVERSE_ORDER.forEach(f => {
    const home = G.GX_HOME_SYSTEMS[f];
    o.push('<a class="card" href="' + f + '.html" style="--cc:' + facColor(f) + '">' +
      '<b>' + esc(facName(f)) + '</b><span>opens at ' + esc(home.name) + ', 35 worlds, 175 plates</span></a>');
  });
  o.push('</div></main></body></html>');
  return o.join('\n');
}

const dir = path.join(ROOT, 'narrative');
fs.mkdirSync(dir, { recursive: true });
let plates = 0;
const missing = [];
for (const fac of G.GX_UNIVERSE_ORDER) {
  const html = page(fac);
  /* EVERY REFERENCE IS CHECKED AGAINST DISK. A bible that silently emits
     broken <img> tags is worse than no bible: it would read as "this beat has
     no art" during a review and send someone re-rendering a plate that was
     only ever mis-linked. Fails the build instead. */
  for (const m of html.matchAll(/src="\.\.\/art\/([A-Za-z0-9_]+)\.webp"/g)) {
    plates++;
    if (!fs.existsSync(path.join(ROOT, 'art', m[1] + '.webp'))) missing.push(m[1]);
  }
  fs.writeFileSync(path.join(dir, fac + '.html'), html);
  console.log('narrative/' + fac + '.html  ' + Math.round(html.length / 1024) + 'KB');
}
if (missing.length) {
  console.error('narrative_bible: ' + missing.length + ' referenced plates are not in art/: ' +
                missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' ...' : ''));
  console.error('Run artgen/krea_gen.py --pack, or render the missing keys, before regenerating.');
  process.exit(1);
}
fs.writeFileSync(path.join(dir, 'index.html'), index());
console.log('narrative/index.html');
console.log(plates + ' plates referenced across 5 faction pages, all present in art/');
