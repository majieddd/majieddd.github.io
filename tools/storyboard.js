/* THE LIVING STORYBOARD.  node tools/storyboard.js  ->  narrative/
 *
 * One page per power, showing that power's campaign in PLAY ORDER and nothing
 * else. The previous review document tried to show all five powers on every
 * world at once, which is 525 lines on one page, and the owner correctly
 * called it hard to follow. A storyboard is one story at a time.
 *
 * The unit is the PANEL, laid out exactly as the game plays it:
 *
 *     [1 APPROACH] [2 THE GROUND] [3 THE ASSAULT]  -> BATTLE -> [4 AFTERMATH] [5 NEW ORDER]
 *
 * Three plates before the fight and two after, which is what ui.worldSlides
 * and ui.outroSlides actually build. Read the mapping off the source rather
 * than describing it, so this page cannot drift from the game.
 *
 * Every panel carries its real plate. Missing art is drawn as an empty frame
 * rather than skipped, because a storyboard that hides its holes is not a
 * review. Notes are per world, saved to localStorage, exported by one button.
 */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story',
                 'galaxy', 'cutscenes', 'planetcuts', 'dialogue'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' }); }
  catch (e) { console.log('  (skipped ' + f + ': ' + e.message.split('\n')[0] + ')'); }

const G = vm.runInContext(
  '({ GX_HOME_SYSTEMS, GX_UNIVERSE_ORDER, PLANET_CUTS, PLANET_MOMENTS, CUTSCENES, ' +
  'STORY, FACTIONS })', ctx);

const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const SYSOF = { human: 0, light: 1, xeno: 2, pirate: 3, robot: 4 };
const BEAT = ['APPROACH', 'THE GROUND', 'THE ASSAULT', 'AFTERMATH', 'NEW ORDER'];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const facName = id => (G.FACTIONS[id] && G.FACTIONS[id].name) || id;
const facColor = id => (G.FACTIONS[id] && G.FACTIONS[id].color) || '#7dd3fc';

const ART = path.join(ROOT, 'art');
const has = k => { try { return fs.existsSync(path.join(ART, k + '.webp')); } catch (e) { return false; } };

/* A PLATE THAT EXISTS IS NOT NECESSARILY THE RIGHT PLATE.
 *
 * Systems 3 and 4 were Barnard's Star and Tabby's Star and are now Proxima
 * Centauri and Sirius. The plate KEYS are positional (pcut_<si><wi>_...), so
 * every one of those 350 files still resolves and the page would happily show
 * a wreck yard under a terminator strip. "0 missing" would have been a lie.
 * They are marked STALE until they are re-rendered. */
const staleWorld = key => key[0] === '3' || key[0] === '4';
const plate = (k, stale) => has(k)
  ? '<img loading="lazy" src="../art/' + k + '.webp" alt="">' +
    (stale ? '<span class="stale">OLD ART &middot; NOT THIS PLACE</span>' : '')
  : '<span class="noart">NO PLATE<br><b>' + esc(k) + '</b></span>';

/* The five acts a given power plays, in order. Each power opens at home and
   rotates outward, which is campTier in js/galaxy.js. */
function actsFor(fac) {
  const home = SYSOF[fac];
  const out = [];
  for (let t = 0; t < 5; t++) {
    const si = (home + t) % 5;
    const owner = FACS[si];
    out.push({ tier: t, si, sys: G.GX_HOME_SYSTEMS[owner].name,
               worlds: G.GX_HOME_SYSTEMS[owner].worlds, homeOf: owner });
  }
  return out;
}

const CSS = `
*{box-sizing:border-box}
body{background:#080b11;color:#c9d6e4;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;margin:0}
a{color:#7dd3fc}
.wrap{max-width:1500px;margin:0 auto;padding:0 20px 100px}
.top{position:sticky;top:0;z-index:20;background:#080b11f2;backdrop-filter:blur(8px);
 border-bottom:1px solid #1d2836;padding:10px 0;margin-bottom:8px}
.top .in{max-width:1500px;margin:0 auto;padding:0 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.top a{text-decoration:none;font-size:13px;letter-spacing:.04em;padding:4px 10px;border-radius:4px;
 border:1px solid #23303f;color:#9fb3c8}
.top a.on{color:#fff;border-color:currentColor}
h1{font-size:26px;letter-spacing:.05em;margin:26px 0 4px;color:#fff}
h2{font-size:15px;letter-spacing:.14em;margin:38px 0 6px;color:#fff;text-transform:uppercase}
.sub{color:#75899e;margin:0 0 18px;font-size:14px}
.act{border-left:3px solid var(--fc);padding-left:16px;margin:34px 0 0}
.actbar{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:2px}
.actno{font-size:11px;letter-spacing:.2em;color:#75899e}
.actname{font-size:19px;color:#fff;letter-spacing:.04em}
.actwho{font-size:12px;color:#75899e}
.beat{background:#0d141c;border:1px solid #1d2836;border-radius:6px;padding:10px 14px;margin:10px 0 18px;
 font-size:14px;color:#b9c9d8}
.beat b{color:var(--fc);font-size:11px;letter-spacing:.14em;display:block;margin-bottom:4px}
.world{margin:22px 0 30px;border-top:1px solid #16202c;padding-top:14px}
.whead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.wname{font-size:16px;color:#fff;letter-spacing:.05em;font-weight:600}
.chip{font-size:10px;letter-spacing:.12em;padding:2px 7px;border-radius:3px;border:1px solid}
.seat{color:#fbbf24;border-color:#7c5e14;background:#241c07}
.rev{color:#f0a8a8;border-color:#6b2a2a;background:#2a1212}
.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.pan{background:#0b1119;border:1px solid #1a2531;border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.pan.after{border-color:#2a2136}
.pimg{position:relative}
.pan img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#060a0f}
.stalepan{border-color:#5c4420}
.stalepan img{filter:grayscale(.7) brightness(.62)}
.stale{position:absolute;left:0;right:0;bottom:0;background:#5c4420ee;color:#ffd89b;
 font-size:9px;letter-spacing:.14em;text-align:center;padding:3px 4px}
.noart{display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;font-size:10px;
 color:#5b6b7d;text-align:center;background:#0a0f16;letter-spacing:.1em;line-height:1.5}
.plab{font-size:9.5px;letter-spacing:.16em;color:#7f93a8;padding:7px 9px 3px}
.pan.after .plab{color:#a78bfa}
.ptxt{font-size:12.5px;line-height:1.55;color:#c3d2e0;padding:0 9px 10px}
.split{grid-column:1/-1;height:0;position:relative;margin:-2px 0 2px}
.split span{position:absolute;left:50%;transform:translate(-50%,-50%);background:#080b11;
 color:#5b6b7d;font-size:9.5px;letter-spacing:.24em;padding:0 10px}
.note{width:100%;background:#0b1119;border:1px solid #1d2836;color:#dbe6f0;border-radius:5px;
 padding:8px 10px;font:13px/1.5 inherit;margin-top:10px;resize:vertical;min-height:38px}
.note:focus{outline:none;border-color:var(--fc)}
.bar{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;gap:8px}
.bar button{background:#132030;color:#dbe6f0;border:1px solid #2b3a4d;border-radius:6px;
 padding:9px 14px;font:600 13px inherit;cursor:pointer;letter-spacing:.05em}
.bar button:hover{border-color:#7dd3fc;color:#fff}
.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.fcard{display:block;text-decoration:none;background:#0d141c;border:1px solid #1d2836;
 border-left:3px solid var(--fc);border-radius:6px;padding:14px}
.fcard:hover{border-color:var(--fc)}
.fcard b{color:#fff;font-size:15px;letter-spacing:.05em;display:block;margin-bottom:4px}
.fcard span{color:#75899e;font-size:12.5px;line-height:1.5}
.stat{display:flex;gap:18px;flex-wrap:wrap;margin:14px 0 0;font-size:13px;color:#8aa0b5}
.stat b{color:#fff}
table.dec{border-collapse:collapse;width:100%;margin:12px 0 8px;font-size:13.5px}
table.dec td{border-top:1px solid #16202c;padding:9px 10px;vertical-align:top}
table.dec td:first-child{width:78px;font-size:10px;letter-spacing:.14em;white-space:nowrap;padding-top:12px}
table.dec td:last-child{color:#75899e;width:34%}
table.dec tr.y td:first-child{color:#6ee7a0}
table.dec tr.n td:first-child{color:#f0a8a8}
table.dec tr.n b{color:#ffd89b}
table.dec b{color:#fff;font-weight:600}
table.dec span{color:#75899e;font-size:12.5px}
@media(max-width:1100px){.strip{grid-template-columns:repeat(2,1fr)}.grid5{grid-template-columns:1fr 1fr}}
`;

const SAVEJS = `
(function(){
 var K='cc-storyboard-'+document.body.dataset.fac;
 function all(){return Array.prototype.slice.call(document.querySelectorAll('.note'));}
 try{var s=JSON.parse(localStorage.getItem(K)||'{}');all().forEach(function(n){if(s[n.dataset.k])n.value=s[n.dataset.k];});}catch(e){}
 function persist(){var o={};all().forEach(function(n){if(n.value.trim())o[n.dataset.k]=n.value;});
  try{localStorage.setItem(K,JSON.stringify(o));}catch(e){}}
 document.addEventListener('input',function(e){if(e.target.classList.contains('note'))persist();});
 window.ccSave=function(){var out=[],t=document.title;
  all().forEach(function(n){if(n.value.trim())out.push('## '+n.dataset.k+'\\n'+n.value.trim());});
  if(!out.length){alert('No notes yet. Type in any box first.');return;}
  var blob=new Blob(['# '+t+'\\n\\n'+out.join('\\n\\n')],{type:'text/markdown'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=document.body.dataset.fac+'-notes.md';a.click();};
 window.ccClear=function(){if(!confirm('Clear every note on this page?'))return;
  all().forEach(function(n){n.value='';});persist();};
})();
`;

function panel(key, label, text, after, stale) {
  return '<div class="pan' + (after ? ' after' : '') + (stale ? ' stalepan' : '') + '">' +
         '<div class="pimg">' + plate(key, stale) + '</div>' +
         '<div class="plab">' + label + '</div>' +
         '<div class="ptxt">' + esc(text || '') + '</div></div>';
}

function noteBox(k, ph) {
  return '<textarea class="note" data-k="' + esc(k) + '" placeholder="' + esc(ph) + '"></textarea>';
}

/* Worlds whose act is designed to turn. Kept here rather than inferred so the
   page states the intent even before the art is re-rendered. */
const REVERSALS = { '05': 'Apophis was not the first delivery',
                    '15': 'the protection order was granted, then withdrawn',
                    '25': 'Earth is in the ledger as a SUPPLIER',
                    '35': 'the Free Captains carried the freight',
                    '45': 'the mast falls and the orders keep coming' };

function page(fac) {
  const o = [];
  const w = s => o.push(s);
  const cs = G.CUTSCENES[fac] || {};
  w('<!doctype html><meta charset="utf-8"><title>' + esc(facName(fac)) + ' storyboard</title>');
  w('<style>' + CSS + '</style><body data-fac="' + fac + '" style="--fc:' + facColor(fac) + '">');
  w('<div class="top"><div class="in"><a href="index.html">ALL POWERS</a>' +
    FACS.map(f => '<a href="' + f + '.html"' + (f === fac ? ' class="on" style="color:' + facColor(f) + '"' : '') +
      '>' + esc(facName(f)) + '</a>').join('') + '</div></div>');
  w('<div class="wrap">');
  w('<h1 style="color:' + facColor(fac) + '">' + esc(facName(fac)) + '</h1>');
  w('<p class="sub">The campaign in play order. Three panels before each battle, two after. ' +
    'Type in any box to leave a note, then SAVE NOTES to download them.</p>');

  /* ---- the intro ---- */
  w('<h2>Opening cinematic</h2>');
  const intro = cs.intro || [];
  w('<div class="strip">');
  intro.forEach((sl, i) => w(panel(sl.key, 'SLIDE ' + (i + 1), sl.text, false)));
  w('</div>');
  w(noteBox(fac + ' / INTRO', 'Notes on the opening cinematic...'));

  /* ---- the acts ---- */
  actsFor(fac).forEach((act, ai) => {
    const sysBeat = (cs.sys || [])[ai];
    w('<div class="act">');
    w('<div class="actbar"><span class="actno">ACT ' + (ai + 1) + '</span>' +
      '<span class="actname">' + esc(act.sys) + '</span>' +
      '<span class="actwho">' + (act.homeOf === fac ? 'your home' : 'home of ' + esc(facName(act.homeOf))) +
      '</span></div>');
    if (sysBeat)
      w('<div class="beat"><b>WHEN THE ACT ENDS</b>' + esc(sysBeat.a) + ' ' + esc(sysBeat.b) + '</div>');

    act.worlds.forEach((wname, wi) => {
      const key = '' + act.si + wi;
      const e = G.PLANET_CUTS[key];
      const lines = (e && e.f && e.f[fac]) || [];
      const rev = REVERSALS[key];
      w('<div class="world">');
      w('<div class="whead"><span class="wname">' + esc(wname) + '</span>' +
        (wi === 6 ? '<span class="chip seat">SEAT &middot; ACT ENDS HERE</span>' : '') +
        (rev ? '<span class="chip rev">REVERSAL &middot; ' + esc(rev) + '</span>' : '') + '</div>');
      if (!e) { w('<p class="sub">No authored entry for this world yet.</p></div>'); return; }
      const k = b => 'pcut_' + key + '_' + fac + '_' + b;
      const st = staleWorld(key);
      w('<div class="strip">');
      w(panel(k(1), BEAT[0], wname + '. ' + (lines[0] || ''), false, st));
      w(panel(k(2), BEAT[1], e.ground, false, st));
      w(panel(k(3), BEAT[2], e.works, false, st));
      w('<div class="split"><span>BATTLE</span></div>');
      w(panel(k(4), BEAT[3], lines[1] || '', true, st));
      w(panel(k(5), BEAT[4], lines[2] || '', true, st));
      w('</div>');
      w(noteBox(fac + ' / ' + act.sys + ' / ' + wname, 'Notes on ' + wname + '...'));
      w('</div>');
    });
    w('</div>');
  });

  w('</div><div class="bar"><button onclick="ccSave()">SAVE NOTES</button>' +
    '<button onclick="ccClear()">CLEAR</button></div>');
  w('<script>' + SAVEJS + '</script>');
  return o.join('\n');
}

function index() {
  const o = [];
  const w = s => o.push(s);
  w('<!doctype html><meta charset="utf-8"><title>Cosmic Conquest storyboard</title>');
  w('<style>' + CSS + '</style><body data-fac="index">');
  w('<div class="wrap"><h1>COSMIC CONQUEST &mdash; STORYBOARD</h1>');
  w('<p class="sub">A living document. Rebuilt from the game itself every time it changes, ' +
    'so it can never describe a version that no longer exists. Pick a power and read its ' +
    'campaign in play order.</p>');
  w('<div class="grid5">');
  FACS.forEach(f => {
    const st = G.STORY && G.STORY[f];
    const hook = (st && st[0] && st[0].line) ? String(st[0].line).slice(0, 120) : '';
    w('<a class="fcard" href="' + f + '.html" style="--fc:' + facColor(f) + '">' +
      '<b style="color:' + facColor(f) + '">' + esc(facName(f)) + '</b>' +
      '<span>' + esc(hook) + '</span></a>');
  });
  w('</div>');

  let panels = 0, missing = 0, stale = 0, worlds = 0;
  FACS.forEach(fac => actsFor(fac).forEach(act => act.worlds.forEach((wn, wi) => {
    const key = '' + act.si + wi;
    if (!G.PLANET_CUTS[key]) return;
    worlds++;
    for (let b = 1; b <= 5; b++) {
      panels++;
      const kk = 'pcut_' + key + '_' + fac + '_' + b;
      if (!has(kk)) missing++; else if (staleWorld(key)) stale++;
    }
  })));
  /* DECIDED vs SHIPPED. Every row runs a check against the code, so a decision
     that never landed cannot sit here looking done. */
  let rows = [];
  try {
    const gx2 = vm.runInContext('({ CUTSCENES, GX_HOME_SYSTEMS, PLANET_CUTS, UNIT_TYPES, LORE })', ctx);
    rows = require('./decisions.js').build(gx2, k => has(k.replace(/\.webp$/, '')));
  } catch (e) { console.log('  (decisions unavailable: ' + e.message.split('\n')[0] + ')'); }
  if (rows.length) {
    const done = rows.filter(r => r.ok).length;
    w('<h2>Decided, and whether it is actually in the game</h2>');
    w('<p class="sub"><b style="color:#fff">' + done + ' of ' + rows.length + '</b> landed. ' +
      'Every row below runs a check against the code on every rebuild, so nothing here can ' +
      'claim to be done because somebody typed that it was.</p>');
    w('<table class="dec">');
    rows.forEach(r => w('<tr class="' + (r.ok ? 'y' : 'n') + '"><td>' + (r.ok ? 'IN' : 'NOT YET') +
      '</td><td><b>' + esc(r.id) + '</b><br><span>' + esc(r.why) + '</span></td>' +
      '<td>' + esc(r.got) + '</td></tr>'));
    w('</table>');
  }

  w('<h2>Where we are</h2>');
  w('<div class="stat"><span><b>' + panels + '</b> panels across five campaigns</span>' +
    '<span><b>' + (panels - missing - stale) + '</b> art matches the text</span>' +
    '<span style="color:#ffd89b"><b>' + stale + '</b> showing OLD art, needs re-render</span>' +
    '<span><b>' + missing + '</b> with no plate at all</span>' +
    '<span><b>' + worlds + '</b> world entries</span></div>');
  w('<p class="sub" style="margin-top:10px">The stale panels are Proxima Centauri and Sirius. ' +
    'Those systems replaced the old Barnard and Tabby acts, and the plate keys are ' +
    'positional, so every old file still resolves and would quietly show a wreck yard under a ' +
    'terminator strip. Nothing renders until the words are settled.</p>');
  w('<p class="sub" style="margin-top:18px">Deeper review, including the retired scenes kept ' +
    'for reference, the measured story audit and all 130 Mythos Operations: ' +
    '<a href="CHANGES.html">the change document</a>.</p>');
  w('</div>');
  return o.join('\n');
}

const dir = path.join(ROOT, 'narrative');
fs.mkdirSync(dir, { recursive: true });
FACS.forEach(f => fs.writeFileSync(path.join(dir, f + '.html'), page(f), 'utf8'));
fs.writeFileSync(path.join(dir, 'index.html'), index(), 'utf8');
console.log('wrote narrative/index.html and ' + FACS.length + ' campaign pages');
