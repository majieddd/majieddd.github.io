/* Storyboard of the Session 42 change, for owner review BEFORE anything renders.
 *
 * The narrative bible (tools/narrative_bible.js) shows the game as it IS. This
 * shows the game as it WILL BE, with three states marked on every scene:
 *
 *   KEEP    unchanged, listed so the review is complete rather than partial
 *   PARKED  being retired. Shown in full, greyed, NOT deleted, because the
 *           owner asked to keep replaced scenes available as reference.
 *   NEW     written this session, not yet rendered
 *
 * Run: node tools/storyboard_changes.js   ->  narrative/CHANGES.html
 */

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
  '({ GX_UNIVERSE_ORDER, GX_HOME_SYSTEMS, PLANET_CUTS, STORY, STORY_ACTS, ' +
  'ACT_SCENARIOS, ACT_MORALS, FACTIONS })', ctx);

const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const facName = id => (G.FACTIONS[id] && G.FACTIONS[id].name) || id;
const facColor = id => (G.FACTIONS[id] && G.FACTIONS[id].color) || '#7dd3fc';

/* Hermes drafts, where they exist. Absent files are reported as gaps rather
   than silently omitted: a storyboard that hides its holes is not a review. */
const OUT = path.join(ROOT, '_hermes', 'out');
const ERR = /API call failed|HTTP \d{3}|Rate limit exceeded|Billing or credits/;
function draft(name) {
  try {
    const t = fs.readFileSync(path.join(OUT, name + '.md'), 'utf8');
    if (!t.trim() || ERR.test(t)) return null;
    return t.trim();
  } catch (e) { return null; }
}

/* ---------------- the new worlds, authored this session ---------------- */
const NEW_CORE = {
  3: { sys: 'PROXIMA CENTAURI', was: "BARNARD'S STAR", home: 'pirate',
       note: 'Both are red flare dwarfs, so all seven world functions transfer and the flare shelter stays literally correct. Proxima is additionally the closest star to Earth, which makes it the first port out and the natural home of a power whose whole identity is passage.',
       worlds: [
    ['PROXIMA d', 'the wreck yards', 'a scorched inner rock whipping round its small red star every five days, its daylit face crowded with the dark hulls of ships dragged here to die', 'innermost candidate planet, ~0.029 AU, a 5.1 day year'],
    ['PROXIMA b', 'the terminator strip', 'a tide locked world holding one face to its red star for ever, a single liveable band running pole to pole between a burning day side and a frozen night side', 'confirmed, ~1.1 Earth masses at 0.0485 AU, tide locked'],
    ['PROXIMA c', 'the cold refinery', 'a frozen super Earth far out from its star, its whole surface a pale blue ice sheet under a sun no bigger than a coin', 'candidate super Earth ~7 Earth masses at ~1.5 AU, frozen'],
    ['THE FLARE SHELTER', 'the dug in warren', 'a bare rock under a star mid flare, the whole sky washed hard violet white and the ground below stripped back to naked stone', 'Proxima flares almost daily, with superflares every few months'],
    ['THE NARROWS', 'the toll gate', 'a debris lane threaded between three suns, ten thousand tumbling rocks catching the light of a triple star', 'the lane through the Alpha Centauri triple debris'],
    ['THE DARK LOCKER', 'the black market vault', 'an unlit rock in the outer dark, so far from its small red star that it shows only as a shape against the stars', 'the outer dark, never lit by the flare star'],
    ['PROXIMA GATE', 'the sanctuary bay (SEAT)', 'the closest star to Earth burning small and red over a great hollowed rock, every window of the harbour inside it lit at once', 'Proxima is 4.24 ly from Sol, the first port out'],
  ]},
  4: { sys: 'SIRIUS', was: "TABBY'S STAR", home: 'robot',
       note: 'Sirius B is a white dwarf: a star once LARGER than Sirius A that burned through, shed most of itself and collapsed into a core the size of Earth carrying the mass of the Sun. The makers own star shed its form, which is a better home image for a power that outlived its bodies than an irregularly dimming star was.',
       worlds: [
    ['SIRIUS A I', 'the machine garden', 'an inner world under a blue white star twenty five times brighter than the Sun, its terraces standing in light too hard to look at directly', 'Sirius A is spectral type A1V, ~25 solar luminosities'],
    ['SIRIUS A II', 'the foundry', 'a blazing white world with no night worth the name, its canyon floor glowing where the casting halls run without stopping', 'hard shadows, no meaningful night'],
    ['THE ASH FIELD', 'the archive', 'a plain of grey dust that was once the outer envelope of a dying star, stacked memory cores standing up out of it like headstones', 'debris Sirius B threw off collapsing from ~5 solar masses'],
    ['SIRIUS B I', 'the quarantine', 'a small world orbiting a white dwarf, its sealed halls glowing faintly under a companion star no bigger than Earth and hotter than anything else in the sky', '~1.02 solar masses in an Earth sized body'],
    ['THE DIAMOND SHELF', 'the repair yards', 'a shelf of raw carbon under a fierce white pinpoint of a star, the ground glittering only where the light catches it', 'Sirius B has NOT crystallised yet: 25,000 K, 126 Myr of cooling. The Parallel named it for what it will become'],
    ['THE COMPANION', 'the task queue relay', 'a white dwarf close enough to fill half the sky, tiny and ferociously bright, a relay mast standing black against it', 'the dwarf, close in'],
    ['THE DOG STAR', 'the origin (SEAT)', "the brightest star in Earth's sky seen from underneath it, a blue white blaze over a capital built entirely of instruction halls", 'the Dogon Sirius B tradition; Law of One Sirius complex'],
  ]},
};

const BONUS = [
  ["TABBY'S STAR", 'SIRIUS', [
    ['THE VEIL', 'the swarm scaffold, a collector lattice the size of a planet, still half built'],
    ['THE DIMMING', 'the shadow band, ground under the 21 per cent dip that has never seen full daylight'],
  ], 'The swarm survives as somebody else unexplained work, so displacing the Parallel from it costs the arc nothing and gains it a mystery. Real dips of 15 per cent in 2011 and 21 per cent in 2013; the leading natural explanation is now dust, because the dips dim blue light harder than red.'],
  ["BARNARD'S STAR", 'PROXIMA CENTAURI', [
    ['BARNARD b', 'the cold rock, a sub Earth on a three day orbit, too close in to hold air'],
    ['HARBOUR NINE', 'the ghost port, the sanctuary bay the Free Captains used before Proxima, still lit, mostly empty'],
  ], 'Keeping HARBOUR NINE as a ruin rather than deleting it means the old pirate seat becomes a place their own campaign can mourn. Barnard has the largest proper motion of any star, 10.4 arcseconds a year, and four confirmed sub Earth planets all under a seven day year.'],
  ['KEPLER', 'THE PLEIADES', [
    ['KEPLER-186f', 'the first registry world, filed and never visited'],
    ['KEPLER-442b', 'the best case, the highest habitability index in the catalogue'],
    ['KEPLER-452b', 'the older cousin, what home looks like with a head start'],
  ], 'The registry of Earth like worlds, a Federation obsession: the list of places worth protecting is also the list of places worth taking. 452b is the thematic one, what Earth looks like with a head start, and the Federation filed it rather than went to it.'],
  ['ARCTURUS', 'THE EARTH SYSTEM', [
    ['THE AMBER COURT', 'an orbital ring under a swollen orange star, a power that will not take a side'],
    ['THE LONG WATCH', 'the station that has recorded every faction for longer than any faction has existed'],
  ], 'No confirmed planets, which is honest and usable: nowhere to stand, only orbit. Arcturus is a metal poor halo star moving at 122 km/s in the Arcturus stream, debris of a dwarf galaxy the Milky Way swallowed. The one power that refuses this war is itself the remnant of a home that was eaten. Source is Norma Milanovich, NOT the Law of One and NOT Edgar Cayce.'],
  ['VEGA / LYRA', 'ZETA RETICULI', [
    ['THE DEBRIS RING', 'the disk itself, real and still colliding'],
    ['VEGA b', 'the world that may not be there at all, inferred from a dent in the disk and never imaged'],
    ['THE FIRST NEST', 'the claimed origin of the human line, with no evidence either way'],
  ], 'Vega points its pole within five degrees of Earth, so the whole system is seen face on like a target, which hands the art its composition for free. Hanging Lyra off the Xeno act is deliberate: the power that farms humanity unlocks the place that claims to have made it. Source is Billy Meier, NOT the Law of One.'],
];

const SEATS = { 0: 'LUNA', 1: 'ALCYONE', 2: 'SERPO', 3: 'PROXIMA GATE', 4: 'THE DOG STAR' };
const SYSNAME = { 0: 'THE EARTH SYSTEM', 1: 'THE PLEIADES', 2: 'ZETA RETICULI',
                  3: 'PROXIMA CENTAURI', 4: 'SIRIUS' };

const CSS = `
body{background:#0a0e14;color:#c9d6e4;font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;
 margin:0;padding:0 0 80px}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
h1{font-size:28px;letter-spacing:.06em;margin:34px 0 6px;color:#fff}
h2{font-size:20px;letter-spacing:.05em;margin:42px 0 10px;color:#fff;
 border-bottom:1px solid #22303f;padding-bottom:8px}
h3{font-size:16px;margin:26px 0 8px;color:#e8f0f7}
.sub{color:#7f93a8;margin:0 0 24px}
.nav{position:sticky;top:0;background:#0a0e14ee;border-bottom:1px solid #22303f;
 padding:10px 0;z-index:9;backdrop-filter:blur(6px)}
.nav a{color:#7dd3fc;text-decoration:none;margin-right:16px;font-size:13px}
.nav a:hover{text-decoration:underline}
table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:14px}
th,td{border:1px solid #22303f;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#111a24;color:#9fb3c8;font-weight:600}
.tag{display:inline-block;font-size:11px;letter-spacing:.08em;padding:2px 8px;
 border-radius:3px;font-weight:700;margin-right:8px}
.keep{background:#14331f;color:#6ee7a0;border:1px solid #205434}
.parked{background:#3a2a12;color:#f0b45e;border:1px solid #5c4420}
.new{background:#122c3f;color:#7dd3fc;border:1px solid #1d4a67}
.gap{background:#3a1616;color:#f08a8a;border:1px solid #5c2020}
.card{border:1px solid #22303f;border-radius:6px;padding:14px 16px;margin:12px 0;background:#0d141c}
.card.p{opacity:.55;background:#12100c;border-color:#3a2f1a}
.card.n{border-color:#1d4a67;background:#0c151d}
.fld{margin:6px 0}
.fld b{color:#8fa6bb;font-weight:600;font-size:12px;letter-spacing:.06em;
 display:inline-block;min-width:64px}
.line{margin:5px 0 5px 10px;padding-left:12px;border-left:2px solid #22303f;color:#b9c9d8}
.fac{font-weight:700;font-size:12px;letter-spacing:.06em}
.why{color:#8aa0b5;font-style:italic;margin:8px 0 14px}
pre{white-space:pre-wrap;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;
 color:#b9c9d8;margin:6px 0;background:#0b1219;padding:10px 12px;border-radius:4px;
 border:1px solid #1a2530}
.note{background:#111a24;border-left:3px solid #7dd3fc;padding:12px 16px;margin:18px 0}
`;

const out = [];
const w = s => out.push(s);

w('<!doctype html><meta charset="utf-8"><title>Cosmic Conquest: Session 42 storyboard changes</title>');
w('<style>' + CSS + '</style><div class="wrap">');
w('<div class="nav"><a href="#top">TOP</a><a href="#review">STORY REVIEW</a>' +
  '<a href="#swap">THE SWAP</a>' +
  '<a href="#parked">PARKED SCENES</a><a href="#new">NEW WORLDS</a>' +
  '<a href="#bonus">BONUS SYSTEMS</a><a href="#beat5">BEAT 5</a><a href="#morals">MORALS</a></div>');

w('<h1 id="top">SESSION 42: what changes in the storyboard</h1>');
w('<p class="sub">Every scene below is marked <span class="tag keep">KEEP</span>' +
  '<span class="tag parked">PARKED</span><span class="tag new">NEW</span>. ' +
  'Nothing here has been rendered. Nothing has been deleted: parked scenes are ' +
  'reproduced in full so they stay available as reference.</p>');

w('<div class="note"><b>The one structural change.</b> Two of the five core systems are ' +
  'replaced. Barnard\'s Star becomes PROXIMA CENTAURI, home of the Free Captains. ' +
  'Tabby\'s Star becomes SIRIUS, home of the Parallel. Both displaced systems survive as ' +
  'bonus systems, so no image is lost. Every other act is untouched.</div>');

/* ---------------- section: adversarial story review ---------------- */
let AUDIT = null, FINDINGS = [];
try { FINDINGS = require('./story_findings.js').FINDINGS; } catch (e) { }
try {
  require('child_process').execSync('node "' + path.join(ROOT, 'tools', 'story_audit.js') +
    '" --json', { cwd: ROOT, stdio: 'ignore' });
  AUDIT = JSON.parse(fs.readFileSync(path.join(ROOT, '_review', 'story_audit.json'), 'utf8'));
} catch (e) { console.log('  (audit unavailable: ' + e.message.split('\n')[0] + ')'); }

w('<h2 id="review">1. Adversarial story review</h2>');
w('<p class="sub">Read as a creative director would: looking for the places this stops being a ' +
  'story and becomes a spreadsheet. Every number below is re-measured by ' +
  '<code>tools/story_audit.js</code> each time this page is built, so a claim here cannot drift ' +
  'from the text it describes.</p>');

if (AUDIT) {
  w('<table><tr><th>Measurement</th><th>Result</th><th>Reading</th></tr>');
  const rows = [
    ['Location descriptions that read as labels, not narration',
     AUDIT.labelGrounds.length + ' of ' + AUDIT.totals.worlds,
     'Nobody narrates in noun phrases. This is the defect the owner spotted first.'],
    ['Closing lines that open by naming their own world',
     AUDIT.beat3NamesItself + ' of ' + AUDIT.beat3Total,
     'A template. The third beat is where a power says what it MADE of a place.'],
    ['Parallel lines using the construction "X RESTORED"',
     AUDIT.robotRestored + ' of ' + AUDIT.robotTotal,
     'The machine voice has become a form to fill in.'],
    ['Dialogue cells referencing the inciting event',
     AUDIT.premiseByAct.reduce((n, a) => n + a.hits, 0) + ' of ' + AUDIT.totals.cells,
     'The reason any of this is happening disappears after act one.'],
    ['Encyclopedia vocabulary reaching the player',
     AUDIT.leaks.length + ' of ' + AUDIT.totals.cells,
     'Not a leak problem. The lore is not in the story at all.'],
  ];
  rows.forEach(r => w('<tr><td>' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td><td>' +
    esc(r[2]) + '</td></tr>'));
  w('</table>');

  w('<h3>Does the premise survive the campaign?</h3>');
  w('<table><tr><th>Act</th><th>Cells referencing why the war started</th></tr>');
  AUDIT.premiseByAct.forEach(a => {
    const bad = a.hits === 0;
    w('<tr><td>' + esc(a.system) + '</td><td' + (bad ? ' style="color:#f08a8a;font-weight:700"' : '') +
      '>' + a.hits + ' of ' + a.of + (bad ? '  (silent)' : '') + '</td></tr>');
  });
  w('</table>');

  if (AUDIT.tics) {
    w('<h3>Word tics, per power</h3><table><tr><th>Power</th><th>Most repeated words</th></tr>');
    Object.entries(AUDIT.tics).forEach(([f, t]) =>
      w('<tr><td style="color:' + facColor(f) + '">' + esc(facName(f)) + '</td><td>' +
        esc(t.slice(0, 6).map(x => x[0] + ' (' + x[1] + ')').join(', ')) + '</td></tr>'));
    w('</table>');
  }
}

w('<h3>Findings</h3>');
const SEV = { CRITICAL: 'gap', MAJOR: 'parked', MINOR: 'keep' };
const STAT = { OPEN: 'gap', FIXING: 'parked', FIXED: 'keep', DECIDE: 'new' };
FINDINGS.forEach(f => {
  w('<div class="card">');
  w('<div class="fld"><span class="tag ' + (SEV[f.severity] || 'keep') + '">' + esc(f.severity) +
    '</span><span class="tag ' + (STAT[f.status] || 'keep') + '">' + esc(f.status) +
    '</span> <b style="color:#fff">' + esc(f.id) + '. ' + esc(f.title) + '</b></div>');
  w('<div class="fld"><b>EVIDENCE</b> ' + esc(f.evidence) + '</div>');
  w('<div class="fld"><b>WHY</b> ' + esc(f.why) + '</div>');
  w('<div class="fld"><b>FIX</b> ' + esc(f.fix) + '</div>');
  w('<div class="fld"><b>COST</b> <span style="color:#7f93a8">' + esc(f.cost) + '</span></div>');
  w('</div>');
});
w('<div class="note"><b>DECIDE</b> means the call is the owner\'s, not mine: F1 changes when the ' +
  'campaign is set, and F6 decides whether 130 mythos operations are player content or an author ' +
  'bible. Everything else I can just fix.</div>');

/* ---------------- section: the swap ---------------- */
w('<h2 id="swap">2. The swap, at a glance</h2>');
w('<table><tr><th>Act</th><th>System</th><th>Home of</th><th>Status</th><th>Seat</th></tr>');
[0, 1, 2, 3, 4].forEach(si => {
  const isNew = !!NEW_CORE[si];
  const home = isNew ? NEW_CORE[si].home : G.GX_UNIVERSE_ORDER[si];
  const tag = isNew
    ? '<span class="tag new">REPLACED</span> was ' + esc(NEW_CORE[si].was)
    : '<span class="tag keep">UNCHANGED</span>';
  w('<tr><td>' + (si + 1) + '</td><td><b>' + esc(SYSNAME[si]) + '</b></td>' +
    '<td style="color:' + facColor(home) + '">' + esc(facName(home)) + '</td>' +
    '<td>' + tag + '</td><td>' + esc(SEATS[si]) + '</td></tr>');
});
w('</table>');
Object.keys(NEW_CORE).forEach(si => {
  w('<p class="why"><b>' + esc(NEW_CORE[si].sys) + '.</b> ' + esc(NEW_CORE[si].note) + '</p>');
});

/* ---------------- section: parked scenes ---------------- */
w('<h2 id="parked">3. Parked scenes: the 14 worlds being retired</h2>');
w('<p class="sub">These are the current Barnard\'s Star and Tabby\'s Star worlds and every ' +
  'line written for them: 14 worlds times 5 powers, reproduced in full. They are being ' +
  'replaced, not deleted. If a line here is better than its replacement, say so and it ' +
  'moves across.</p>');

/* Read the parked worlds from the SNAPSHOT, not from live PLANET_CUTS. Once the
   new worlds landed in js/planetcuts.js, those keys hold Proxima and Sirius, so
   reading live data here would have shown the replacements labelled as the
   things they replaced. The snapshot is the record the owner asked to keep. */
let PARKED = {};
try {
  const src = fs.readFileSync(
    path.join(ROOT, 'docs', 'parked', 'planetcuts-si3-si4-preS42.js'), 'utf8');
  const pctx = { }; vm.createContext(pctx);
  vm.runInContext(src, pctx, { filename: 'parked.js' });
  PARKED = vm.runInContext('PARKED_PRE_S42', pctx);
} catch (e) { console.log('  (parked snapshot unreadable: ' + e.message.split('\n')[0] + ')'); }

let parkedWorlds = 0, parkedLines = 0;
[3, 4].forEach(si => {
  const oldSys = NEW_CORE[si].was;
  w('<h3>' + esc(oldSys) + ' <span class="tag parked">PARKED</span></h3>');
  for (let wi = 0; wi < 7; wi++) {
    const key = String(si) + String(wi);
    const e = PARKED[key];
    if (!e) continue;
    parkedWorlds++;
    w('<div class="card p">');
    w('<div class="fld"><b>WORLD</b> ' + esc(e.name) + '</div>');
    if (e.ground) w('<div class="fld"><b>GROUND</b> ' + esc(e.ground) + '</div>');
    if (e.works) w('<div class="fld"><b>WORKS</b> ' + esc(e.works) + '</div>');
    FACS.forEach(f => {
      const lines = (e.f && e.f[f]) || [];
      if (!lines.length) return;
      w('<div class="fac" style="color:' + facColor(f) + '">' + esc(facName(f)) + '</div>');
      lines.forEach(l => { parkedLines++; w('<div class="line">' + esc(l) + '</div>'); });
    });
    w('</div>');
  }
});

/* ---------------- section: new worlds ---------------- */
w('<h2 id="new">4. New worlds, written and not yet rendered</h2>');
w('<p class="sub">The art driving strings are authored. The faction dialogue for these ' +
  'worlds is still being written: where a cell is missing it is marked as a gap rather ' +
  'than quietly skipped.</p>');

[3, 4].forEach(si => {
  const N = NEW_CORE[si];
  w('<h3>' + esc(N.sys) + ' <span class="tag new">NEW</span> ' +
    '<span style="color:#7f93a8;font-size:13px;font-weight:400">home of ' +
    esc(facName(N.home)) + ', replaces ' + esc(N.was) + '</span></h3>');
  N.worlds.forEach((row, wi) => {
    const [name, fn, sky, ground] = row;
    w('<div class="card n">');
    w('<div class="fld"><b>WORLD</b> <b style="color:#fff">' + esc(name) + '</b>, ' + esc(fn) + '</div>');
    w('<div class="fld"><b>SKY</b> ' + esc(sky) + '</div>');
    w('<div class="fld"><b>REAL</b> <span style="color:#7f93a8">' + esc(ground) + '</span></div>');
    /* The written dialogue, read live, so this page cannot claim a line that is
       not actually in the game. */
    const live = G.PLANET_CUTS[String(si) + String(wi)];
    if (live) {
      if (live.ground) w('<div class="fld"><b>GROUND</b> ' + esc(live.ground) + '</div>');
      if (live.works) w('<div class="fld"><b>WORKS</b> ' + esc(live.works) + '</div>');
      FACS.forEach(f => {
        const lines = (live.f && live.f[f]) || [];
        if (!lines.length) {
          w('<div class="fac" style="color:' + facColor(f) + '">' + esc(facName(f)) +
            ' <span class="tag gap">NO LINES</span></div>');
          return;
        }
        w('<div class="fac" style="color:' + facColor(f) + '">' + esc(facName(f)) + '</div>');
        lines.forEach(l => w('<div class="line">' + esc(l) + '</div>'));
      });
    } else {
      w('<div class="fld"><span class="tag gap">NOT YET WRITTEN</span></div>');
    }
    const s = draft('scen_' + si + wi);
    if (s) w('<div class="fld"><b>SCENARIO NOTE</b></div><pre>' + esc(s) + '</pre>');
    w('</div>');
  });
});

/* ---------------- section: bonus ---------------- */
w('<h2 id="bonus">5. Bonus systems, all new</h2>');
w('<p class="sub">Not acts. Each hangs off the core act it comments on and unlocks when ' +
  'that act is cleared. Two to three worlds each, twelve in total, and the place the ' +
  'neutral machine units and towers live.</p>');
w('<table><tr><th>System</th><th>Unlocks after</th><th>Worlds</th></tr>');
BONUS.forEach(([sys, after, worlds]) => {
  w('<tr><td><b>' + esc(sys) + '</b></td><td>' + esc(after) + '</td><td>' +
    worlds.map(x => esc(x[0])).join(', ') + '</td></tr>');
});
w('</table>');
BONUS.forEach(([sys, after, worlds, why]) => {
  w('<div class="card n"><div class="fld"><b>SYSTEM</b> <b style="color:#fff">' + esc(sys) +
    '</b>, after ' + esc(after) + '</div>');
  worlds.forEach(([n, f]) => w('<div class="fld"><b>WORLD</b> ' + esc(n) + ', ' + esc(f) + '</div>'));
  w('<p class="why">' + esc(why) + '</p></div>');
});

/* ---------------- section: beat 5 ---------------- */
w('<h2 id="beat5">6. Beat 5 stops being one image</h2>');
w('<p class="sub">The flag still plants on ordinary worlds. On each act\'s SEAT the act ' +
  'ends instead on a commander at a distance watching somebody else plant it, and ' +
  'wondering. Roughly five reflective endings against thirty planted ones per campaign, ' +
  'which is what keeps the planted flag meaning anything.</p>');
let b5have = 0, b5want = 0;
[0, 1, 2, 3, 4].forEach(si => {
  w('<h3>ACT ' + (si + 1) + ': ' + esc(SYSNAME[si]) + ', seat ' + esc(SEATS[si]) + '</h3>');
  FACS.forEach(f => {
    b5want++;
    const d = draft('beat5_' + f + '_' + si);
    w('<div class="card' + (d ? ' n' : '') + '">');
    w('<div class="fac" style="color:' + facColor(f) + '">' + esc(facName(f)) + '</div>');
    if (d) { b5have++; w('<pre>' + esc(d) + '</pre>'); }
    else w('<div class="fld"><span class="tag gap">PENDING</span></div>');
    w('</div>');
  });
});

/* ---------------- section: morals ---------------- */
w('<h2 id="morals">7. The moral of each act</h2>');
w('<p class="sub">The Avatar and Tyranny model: the player should learn something by ' +
  'vicariously BEING this power, and should never be lectured. Each entry states what the ' +
  'power sincerely believes, what somebody else pays for that belief, what the player is ' +
  'left holding, and the one thing the power still cannot see about itself.</p>');
let mhave = 0, mwant = 0;
[0, 1, 2, 3, 4].forEach(si => {
  w('<h3>ACT ' + (si + 1) + ': ' + esc(SYSNAME[si]) + '</h3>');
  FACS.forEach(f => {
    mwant++;
    const d = draft('moral_' + f + '_' + si);
    w('<div class="card' + (d ? ' n' : '') + '">');
    w('<div class="fac" style="color:' + facColor(f) + '">' + esc(facName(f)) + '</div>');
    if (d) { mhave++; w('<pre>' + esc(d) + '</pre>'); }
    else w('<div class="fld"><span class="tag gap">PENDING</span></div>');
    w('</div>');
  });
});

/* ---------------- section: mythos operations, for owner triage ---------------- */
w('<h2 id="mythos">8. The 130 Mythos Operations, listed for your decision</h2>');
w('<p class="sub">Every one is <code>status: scenario-seed</code> and <code>evidence: F</code>, ' +
  'this project\'s own label for fiction. They were never written as planet flavour: each is a ' +
  'MISSION PREMISE. Listed in full rather than summarised, because a summary of a list somebody ' +
  'has to triage is useless to them.</p>');
w('<div class="note"><b>The test being applied.</b> If an entry can become a unit, a tower, a ' +
  'bonus world or a playable mission, it is content and it ships. If it is only atmosphere ' +
  'attached to a planet and does not move the story, it does not. The suggested column is my ' +
  'read, not a decision.</div>');

const MO = vm.runInContext('LORE.mythosOperations', ctx) || {};
const moRows = Object.values(MO);
/* Categories whose entries can plausibly become a mechanic rather than a caption. */
const MECHANICAL = {
  'Crash retrieval and black aerospace': 'UNIT or TOWER, human black-project craft',
  'Secret space programs': 'UNIT, human black-project craft',
  'Moon Mars and secret space': 'BONUS WORLD',
  'Technosignature candidates': 'BONUS WORLD',
  'Orbital archaeology': 'BONUS WORLD',
  'Lunar anomalies': 'BONUS WORLD, hangs off LUNA',
  'Lunar myth': 'BONUS WORLD, hangs off LUNA',
  'Galactic strategy': 'MISSION',
  'Weather, atmosphere, and environment': 'ARENA MODIFIER',
  'Population, biosphere, and control': 'MISSION, Compact acts',
  'Depopulation and elite escape': 'MISSION, Compact acts',
  'Abduction and future-human lore': 'MISSION',
  'Time and reality': 'MISSION, Parallel acts',
  'Mythic geography': 'BONUS WORLD',
  'Lost civilization / archaeology': 'BONUS WORLD',
};
const byCat = {};
moRows.forEach(m => (byCat[m.category] = byCat[m.category] || []).push(m));
const cats = Object.keys(byCat).sort((a, b) => {
  const am = MECHANICAL[a] ? 0 : 1, bm = MECHANICAL[b] ? 0 : 1;
  return am - bm || byCat[b].length - byCat[a].length || a.localeCompare(b);
});
const mech = cats.filter(c => MECHANICAL[c]).reduce((n, c) => n + byCat[c].length, 0);
w('<p class="sub"><b>' + mech + ' of ' + moRows.length + '</b> sit in categories that can carry a ' +
  'mechanic. The remaining ' + (moRows.length - mech) + ' are, on my read, author bible.</p>');

cats.forEach(c => {
  const useful = MECHANICAL[c];
  w('<h3>' + esc(c) + ' <span class="tag ' + (useful ? 'new' : 'parked') + '">' +
    (useful ? esc(useful) : 'AUTHOR BIBLE') + '</span> ' +
    '<span style="color:#7f93a8;font-size:13px;font-weight:400">' + byCat[c].length + ' entries</span></h3>');
  w('<table><tr><th style="width:70px">ID</th><th style="width:230px">Title</th><th>Premise</th></tr>');
  byCat[c].forEach(m => w('<tr><td>' + esc(m.id) + '</td><td><b>' + esc(m.title) + '</b></td><td>' +
    esc(m.premise || '') + '</td></tr>'));
  w('</table>');
});

w('<h2>Coverage of this document</h2>');
w('<table><tr><th>Section</th><th>Written</th><th>Pending</th></tr>');
w('<tr><td>Parked scenes preserved</td><td>' + parkedWorlds + ' worlds, ' + parkedLines +
  ' lines</td><td>n/a</td></tr>');
w('<tr><td>New core worlds, art strings</td><td>14 of 14</td><td>0</td></tr>');
w('<tr><td>Beat 5 reflective endings</td><td>' + b5have + ' of ' + b5want + '</td><td>' +
  (b5want - b5have) + '</td></tr>');
w('<tr><td>Per act morals</td><td>' + mhave + ' of ' + mwant + '</td><td>' +
  (mwant - mhave) + '</td></tr>');
w('</table>');
w('<p class="sub">Gaps are the free model\'s daily quota running out mid batch, not ' +
  'design decisions. They will be filled before anything renders.</p>');
w('</div>');

const dir = path.join(ROOT, 'narrative');
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, 'CHANGES.html');
fs.writeFileSync(dest, out.join('\n'), 'utf8');
console.log('wrote ' + dest);
console.log('  parked: ' + parkedWorlds + ' worlds, ' + parkedLines + ' lines preserved');
console.log('  beat5:  ' + b5have + '/' + b5want + '   morals: ' + mhave + '/' + mwant);
