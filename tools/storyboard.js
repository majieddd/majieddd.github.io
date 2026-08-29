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
  'STORY, FACTIONS, COMMANDER_ROSTER, UNIT_TYPES, DIALOGUE, LORE, ' +
  'ACT_MORALS, ACT_SCENARIOS, BOONS, GX_SOL_ENCOUNTERS, GX_ACT_ENCOUNTERS })', ctx);

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
/* Systems 3 and 4 changed identity wholesale and are still stale.
   The Earth System has been RE-PLATED (tools/_s42_replate.js): the Luna art
   moved onto Luna and the Venus art onto Venus, and the plates for worlds that
   no longer exist were set aside to art/_retired rather than deleted. So Sol
   no longer has any world showing the WRONG place; it has four showing NOTHING,
   which the missing-plate frame already reports honestly. */
/* WHICH PLATES ARE STALE IS NOW MEASURED, not assumed by system index.
   `key[0] === '3' || key[0] === '4'` was right when the whole of systems 3
   and 4 was known-wrong, and it is wrong the moment they start being
   re-rendered one plate at a time: it would keep stamping OLD ART on plates
   that had just been fixed, and it would never clear by itself.
   artgen/krea_gen.py publishes cache_krea/.stale.json on every run; that is
   the only process that can compare a plate against the prompt that made it.
   Falls back to the old rule when artgen has never run here, so a clone with
   no caches still marks the systems it cannot vouch for. */
const STALE_SET = (() => {
  try {
    const rec = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'artgen', 'cache_krea', '.stale.json'), 'utf8'));
    return new Set([].concat(rec.stale || [], rec.missing || []));
  } catch (e) { return null; }
})();
const staleWorld = (key, fac) => STALE_SET
  ? [1, 2, 3, 4, 5].some(b => STALE_SET.has('pcut_' + key + '_' + fac + '_' + b))
  : (key[0] === '3' || key[0] === '4');
const plate = (k, stale) => has(k)
  ? '<img loading="lazy" src="../art/' + k + '.webp" alt="">' +
    (stale ? '<span class="stale">OLD ART &middot; NOT THIS PLACE</span>' : '')
  : '<span class="noart">NO PLATE<br><b>' + esc(k) + '</b></span>';

/* The five acts a given power plays, in order. Each power opens at home and
   rotates outward, which is campTier in js/galaxy.js. */
/* READ THE ORDER, DO NOT ASSUME IT. This used to compute (home + t) % 5, which
   was true only while every power rotated. Humanity's acts are authored now
   (Earth, then PROXIMA CENTAURI, the nearest star and the one the door under
   Saturn opens onto), so a page that assumed the rotation would have shown the
   Pleiades as act two and quietly disagreed with the game. */
function actsFor(fac) {
  const byName = {};
  FACS.forEach(f => { byName[G.GX_HOME_SYSTEMS[f].name] = f; });
  try {
    const gctx = { console, window: {}, document: undefined };
    vm.createContext(gctx);
    for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story'])
      try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), gctx, { filename: f }); } catch (e) {}
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'galaxy.js'), 'utf8'), gctx, { filename: 'galaxy.js' });
    const g = vm.runInContext('generateGalaxy(20290413,"' + fac + '",0,1,2)', gctx);
    return g.systems.map((sy, t) => {
      const owner = byName[sy.name] || FACS[t];
      return { tier: t, si: SYSOF[owner], sys: sy.name,
               worlds: G.GX_HOME_SYSTEMS[owner].worlds, homeOf: owner };
    });
  } catch (e) {
    console.log('  (act order unavailable, falling back to rotation: ' + String(e.message).slice(0, 60) + ')');
    const home = SYSOF[fac];
    const out = [];
    for (let t = 0; t < 5; t++) {
      const owner = FACS[(home + t) % 5];
      out.push({ tier: t, si: (home + t) % 5, sys: G.GX_HOME_SYSTEMS[owner].name,
                 worlds: G.GX_HOME_SYSTEMS[owner].worlds, homeOf: owner });
    }
    return out;
  }
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
.enc{color:#7dd3fc;border-color:#1d4a67;background:#0c1a25}
.encnote{color:#8aa0b5;font-size:13px;margin:0 0 8px;font-style:italic}
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
.power{border-left:3px solid var(--fc);padding:2px 0 2px 16px;margin:14px 0 6px}
.creed{font-size:17px;color:#fff;letter-spacing:.05em;margin-bottom:6px}
.blurb{color:#b9c9d8;font-size:14px;margin:0 0 10px;max-width:900px}
.bonus{display:inline-block;background:#0d141c;border:1px solid #1d2836;border-radius:5px;
 padding:7px 12px;font-size:13px;color:#b9c9d8}
.bonus b{color:var(--fc);letter-spacing:.06em;margin-right:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;margin:10px 0 6px}
.card{background:#0d141c;border:1px solid #1d2836;border-radius:6px;padding:11px 13px;
 display:flex;flex-direction:column;gap:5px}
.card b{color:#fff;font-size:14px;letter-spacing:.05em}
.card .nums{color:var(--fc);font-size:11px;letter-spacing:.1em}
.card span{color:#93a7ba;font-size:12.5px;line-height:1.5}
.card i{color:#75899e;font-style:normal;letter-spacing:.06em;font-size:11px}
.card .quote{color:#c3d2e0;border-left:2px solid #23303f;padding-left:9px;font-style:italic}
.beat .reveal{display:block;margin-top:7px;padding-top:7px;border-top:1px solid #1d2836;
 color:#8aa0b5;font-size:13px}
.beat.moral{border-color:#3d3320;background:#12100c}
.beat.moral b{color:#fbbf24}
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
/* One per act, at wi 5, the world before the seat. Key 05 was TITAN and its
   reversal was a fragment hull older than Apophis; the Earth System reorder
   made 05 JUPITER, so the label follows the text that is actually there now.
   The Titan crater beat is retired with the world, not silently relabelled. */
const REVERSALS = { '05': 'the traffic out here already ends at Saturn',
                    '15': 'the protection order was granted, then withdrawn',
                    '25': 'Earth is in the ledger as a SUPPLIER',
                    '35': 'the Free Captains carried the freight',
                    '45': 'the mast falls and the orders keep coming' };

/* Who garrisons each world, and under which scenario, read from a live galaxy
   on the canon seed. The renderer needs this: it decides who is IN the picture.
   The Earth System is authored (GX_SOL_ENCOUNTERS); everywhere else is the
   canon seed's roll, which is what a player on that seed actually meets. */
function encountersFor(fac) {
  const out = {};
  try {
    const gctx = { console, window: {}, document: undefined };
    vm.createContext(gctx);
    for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story'])
      try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), gctx, { filename: f }); } catch (e) {}
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'galaxy.js'), 'utf8'), gctx, { filename: 'galaxy.js' });
    const g = vm.runInContext('generateGalaxy(20290413,"' + fac + '",0,1,2)', gctx);
    const sc = vm.runInContext('worldScenarioOf', gctx);
    const SOL = vm.runInContext('typeof GX_SOL_ENCOUNTERS !== "undefined" ? GX_SOL_ENCOUNTERS : {}', gctx);
    const homeOf = { human: 0, light: 1, xeno: 2, pirate: 3, robot: 4 };
    g.systems.forEach(sys => sys.worlds.forEach(wd => {
      /* Re-key from the player-relative si back to the UNIVERSE index, which is
         what planetcuts and the plate names use. */
      const uni = (homeOf[fac] + wd.si) % 5;
      const who = facName(wd.owner) +
        (wd.contested && wd.contestedBy ? ' and ' + [].concat(wd.contestedBy).map(facName).join(' and ') : '');
      const a = sys.name === 'THE EARTH SYSTEM' ? SOL[wd.wi] : null;
      out['' + uni + wd.wi] = { scenario: sc(wd).name, who: who, note: a && a.note };
    }));
  } catch (e) { console.log('  (encounters unavailable: ' + String(e.message).slice(0, 80) + ')'); }
  return out;
}

function page(fac) {
  const o = [];
  const ENC = encountersFor(fac);
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

  /* ---- who you are: the role-playing layer, on the same sheet ---- */
  const F = G.FACTIONS[fac] || {};
  w('<div class="power">');
  w('<div class="creed">' + esc(F.creed || '') + '</div>');
  if (F.tagline) w('<p class="sub" style="margin:0 0 10px">' + esc(F.tagline) + '</p>');
  if (F.blurb) w('<p class="blurb">' + esc(F.blurb) + '</p>');
  if (F.bonusName) w('<div class="bonus"><b>' + esc(F.bonusName) + '</b> ' + esc(F.bonusDesc || '') + '</div>');
  w('</div>');

  /* Units. What the player actually fields, beside the story about them. */
  const units = Object.values(G.UNIT_TYPES || {}).filter(u => u.faction === fac);
  if (units.length) {
    w('<h2>What you field</h2>');
    w('<div class="cards">');
    units.forEach(u => w('<div class="card"><b>' + esc(u.name) + '</b>' +
      '<span class="nums">' + [u.hp && ('hp ' + u.hp), u.speed && ('spd ' + u.speed),
        u.armor && ('armour ' + u.armor)].filter(Boolean).join(' &middot; ') + '</span>' +
      '<span>' + esc(u.desc || '') + '</span></div>'));
    w('</div>');
  }

  /* Commanders, with the lore entry that explains them. */
  const roster = (G.COMMANDER_ROSTER || []).filter(c => c.faction === fac);
  if (roster.length) {
    w('<h2>Who leads</h2>');
    w('<div class="cards">');
    roster.forEach(c => {
      const lo = (G.LORE && G.LORE.commanders && G.LORE.commanders[c.id]) || {};
      const open = (G.DIALOGUE && G.DIALOGUE.openers && G.DIALOGUE.openers[c.id]) || '';
      w('<div class="card"><b>' + esc(c.name) + '</b>' +
        '<span class="nums">' + esc(c.title || '') + '</span>' +
        (lo.role ? '<span>' + esc(lo.role) + '</span>' : '') +
        (lo.motive ? '<span><i>Wants:</i> ' + esc(lo.motive) + '</span>' : '') +
        (lo.fracture ? '<span><i>Breaks on:</i> ' + esc(lo.fracture) + '</span>' : '') +
        (open ? '<span class="quote">' + esc(open) + '</span>' : '') +
        '</div>');
    });
    w('</div>');
  }

  /* The spine: six beats that carry the whole tragedy, with what each reveals. */
  const spine = (G.STORY && G.STORY[fac]) || [];
  if (spine.length) {
    w('<h2>The spine</h2>');
    w('<p class="sub">Six beats that carry the arc. Everything else on this page hangs off them.</p>');
    spine.forEach((b, i) => w('<div class="beat"><b>BEAT ' + (i + 1) + '</b>' + esc(b.line || '') +
      (b.reveal ? '<span class="reveal">' + esc(b.reveal) + '</span>' : '') + '</div>'));
  }

  /* The six alternate opening lines a world can speak instead of its own. */
  const MOM = [['seat', 'a throne world'], ['contested', 'two rivals already here'],
               ['renegade', 'your own banner holds it'], ['retaken', 'you lost this once'],
               ['flawless', 'three stars'], ['defeat', 'you lost the campaign']];
  if (G.PLANET_MOMENTS) {
    w('<h2>Alternate voices</h2>');
    w('<p class="sub">These replace the first line on any world where they apply, most surprising fact first.</p>');
    w('<div class="cards">');
    MOM.forEach(([k, label]) => {
      const t = G.PLANET_MOMENTS[k] && G.PLANET_MOMENTS[k][fac];
      if (t) w('<div class="card"><b>' + esc(k.toUpperCase()) + '</b><span class="nums">' +
               esc(label) + '</span><span class="quote">' + esc(t) + '</span></div>');
    });
    w('</div>');
  }

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
    /* What this act IS, and what the player is meant to be left holding. Both
       are authored per power per act and were previously visible nowhere. */
    const scen = (G.ACT_SCENARIOS && G.ACT_SCENARIOS[fac] || [])[ai];
    const moral = (G.ACT_MORALS && G.ACT_MORALS[fac] || [])[ai];
    if (scen) w('<div class="beat"><b>WHAT THIS ACT IS</b>' + esc(scen) + '</div>');
    if (sysBeat)
      w('<div class="beat"><b>WHEN THE ACT ENDS</b>' + esc(sysBeat.a) + ' ' + esc(sysBeat.b) + '</div>');
    if (moral) w('<div class="beat moral"><b>WHAT THE PLAYER IS LEFT HOLDING</b>' + esc(moral) + '</div>');

    act.worlds.forEach((wname, wi) => {
      const key = '' + act.si + wi;
      const e = G.PLANET_CUTS[key];
      const lines = (e && e.f && e.f[fac]) || [];
      const rev = REVERSALS[key];
      w('<div class="world">');
      /* WHO IS IN THE PICTURE. Read live off the generated galaxy so the
         renderer is told the same garrison the battle will actually field.
         Only the Earth System is authored today; everywhere else this is the
         canon seed's roll and is labelled as such. */
      const enc = ENC[key];
      w('<div class="whead"><span class="wname">' + esc(wname) + '</span>' +
        (wi === 6 ? '<span class="chip seat">SEAT &middot; ACT ENDS HERE</span>' : '') +
        (rev ? '<span class="chip rev">REVERSAL &middot; ' + esc(rev) + '</span>' : '') +
        (enc ? '<span class="chip enc">' + esc(enc.scenario) + ' &middot; ' +
               esc(enc.who) + '</span>' : '') + '</div>');
      if (enc && enc.note) w('<p class="encnote">' + esc(enc.note) + '</p>');
      if (!e) { w('<p class="sub">No authored entry for this world yet.</p></div>'); return; }
      const k = b => 'pcut_' + key + '_' + fac + '_' + b;
      const st = staleWorld(key, fac);
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
      if (!has(kk)) missing++; else if (staleWorld(key, fac)) stale++;
    }
  })));
  /* DECIDED vs SHIPPED. Every row runs a check against the code, so a decision
     that never landed cannot sit here looking done. */
  let rows = [];
  try {
    const gx2 = vm.runInContext('({ CUTSCENES, GX_HOME_SYSTEMS, PLANET_CUTS, UNIT_TYPES, LORE, ' +
                                'GX_SOL_ENCOUNTERS, GX_ACT_ENCOUNTERS })', ctx);
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

  /* THE RUNNING TASK LIST. Owner asked for this on the page itself so a session
     that stops mid-flight can be resumed without reconstructing where it got to.
     Rows with a check read the CODE; rows without are judgement calls and say so. */
  w('<h2>Task list</h2>');
  w('<p class="sub">Where this is up to. Rows marked <b style="color:#6ee7a0">IN</b> are ' +
    'verified against the code on every rebuild. Rows marked <b style="color:#ffd89b">TODO</b> ' +
    'are the work queue, in the order I would take it.</p>');
  /* "Re-render the planet plates whose prompts moved" used to live here as a
     hand-written row and went wrong twice: first a hardcoded "502 of 875"
     that stayed 502 forever, then a live count that still printed under TODO
     after it reached zero, because nothing here changed a row's SECTION, only
     its text. Moved to decisions.js as 'every planet plate matches its
     current prompt', which is a real checked row and reads IN or NOT YET on
     its own rather than needing someone to notice the count hit zero and
     delete it by hand. */
  const TODO = [
    ['TODO', 'Re-baseline the balance pins IN A BROWSER',
     'Verified headlessly that no existing stat moved: 54 bodies unchanged, 15 added, 0 removed. But PINS is window.PINS and this project compares pins only inside one page session, so the A/B still needs a live build. See docs/BALANCE-BASELINE.md.'],
    ['LORE', 'The five bonus systems stay lore, by decision',
     'Kepler, Arcturus, Vega and the two demoted acts are NOT being built. They remain in the canon and in GALAXY-SCOPE-S42.md so the galaxy has edges the player can hear about, and nothing in the game promises them.'],
  ];
  w('<table class="dec">');
  rows.filter(r => r.ok).forEach(r => w('<tr class="y"><td>IN</td><td><b>' + esc(r.id) +
    '</b><br><span>' + esc(r.why) + '</span></td><td>' + esc(r.got) + '</td></tr>'));
  TODO.forEach(t => w('<tr class="n"><td>' + esc(t[0]) + '</td><td><b>' + esc(t[1]) +
    '</b></td><td>' + esc(t[2]) + '</td></tr>'));
  w('</table>');

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
