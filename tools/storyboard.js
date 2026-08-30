/* THE LIVING STORYBOARD AND SPINE.  node tools/storyboard.js  ->  narrative/
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
 *
 * THE SPINE (owner directive, Session 43). This document is the canonical
 * reference for EVERYTHING on main: every tower, denizen, commander, boon,
 * element, reaction, ability, doctrine, world, slide and story beat, each
 * with a stable ref (`tower:flak`, `human/act2/MARS`, `human/intro/slide7`)
 * and a link to the exact source line on GitHub. narrative/spine.json maps
 * every ref to its page anchor and source location, so an owner note like
 * "flak feels weak" or "slide 7 of the human intro reads flat" resolves to
 * one card and one line of code without a conversation about where it lives.
 *
 * Because it is generated from the loaded game modules, it can only describe
 * what main actually holds. Two things keep it that way:
 *   - node tools/storyboard.js --check   regenerates in memory and exits 1
 *     if the committed pages are stale; tools/gate.js runs it.
 *   - .github/workflows/pages.yml regenerates before every deploy, so the
 *     live document always matches the commit being published.
 */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const f of ['artpack', 'config', 'lore', 'factions', 'towers2', 'abilities', 'roster', 'story',
                 'galaxy', 'cutscenes', 'planetcuts', 'dialogue'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' }); }
  catch (e) { console.log('  (skipped ' + f + ': ' + e.message.split('\n')[0] + ')'); }

const G = vm.runInContext(
  '({ GX_HOME_SYSTEMS, GX_UNIVERSE_ORDER, PLANET_CUTS, PLANET_MOMENTS, CUTSCENES, ' +
  'STORY, FACTIONS, COMMANDER_ROSTER, UNIT_TYPES, DIALOGUE, LORE, ' +
  'ACT_MORALS, ACT_SCENARIOS, BOONS, GX_SOL_ENCOUNTERS, GX_ACT_ENCOUNTERS, ' +
  'TOWER_TYPES, TOWER_ORDER, ENEMY_TYPES, FACTION_UNITS, POWER_ORDER, ' +
  'ELEMENTS, COMBOS, ABILITIES, PLAYER_MODS, ENEMY_MODS, SUMMON_DOCTRINES, ' +
  'MACHINE_HOST, originKeyOf, ARTPACK, ' +
  'MAPS, SCENARIOS, ARENA_MODS, TARGET_MODES, LEVEL_ROLLS, SECRET_FACTIONS, LORE_CODEX })', ctx);

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

/* ==========================================================================
   THE SPINE: stable refs, page anchors, and source lines.

   Every card this document renders gets three coordinates:
     ref     what a human types in a note        tower:flak, human/act2/MARS
     anchor  where it lives on the page          human.html#tw-flak
     src     where it lives in the code          js/config.js:2101, on GitHub

   All three are collected into narrative/spine.json so a note against any
   ref resolves to a page location AND a source location mechanically.

   LOCATING SOURCE LINES. The data itself comes from the LOADED modules (the
   facts.js law: source text is not the program). The line number is the one
   thing loading cannot give, so it is found by searching the defining file
   for the entry's own `id:'x'` field, disambiguated by requiring the def's
   NAME nearby when the id string appears more than once, and THROWING when
   that still is not unique or when nothing is found. A spine that silently
   lacked an entry, or pointed a note at the wrong line, would be worse than
   no spine, so every miss is loud and fails the gate.
   ========================================================================== */
const REPO_BLOB = 'https://github.com/majieddd/majieddd.github.io/blob/main/';
const SPINE = [];
const SRC_CACHE = {};
const srcLines = rel => SRC_CACHE[rel] ||
  (SRC_CACHE[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n'));

/* Find the one place `id:'<id>'` (space optional) is defined across `rels`
   (a path or a list of paths: towers split config.js/towers2.js). `name`
   disambiguates: when the id string occurs on several lines, the def line is
   the one whose 3-line window also carries the entry's exact name value.
   Returns 'js/file.js:123'. Anything but exactly one survivor throws. */
function locateId(rels, id, name, opts) {
  const files = Array.isArray(rels) ? rels : [rels];
  const pat = new RegExp("id:\\s*'" + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  let hits = [];
  for (const rel of files) {
    const lines = srcLines(rel);
    for (let i = 0; i < lines.length; i++)
      if (pat.test(lines[i])) hits.push({ rel, i, win: lines[i] + (lines[i + 1] || '') + (lines[i + 2] || '') });
  }
  if (hits.length > 1 && name) {
    const near = hits.filter(h => h.win.indexOf(name) >= 0);
    if (near.length) hits = near;
  }
  /* `first` is for the ONE table that legitimately authors an id twice: the
     combo matrix is symmetric, so fire+frost and frost+fire both carry
     id:'thermal' and both lines ARE the same reaction. Every hit must still
     carry the same name, or two different defs are sharing an id and that is
     a real defect this must not paper over. */
  if (opts && opts.first && hits.length > 1) {
    if (name && hits.some(h => h.win.indexOf(name) < 0))
      throw new Error('spine: id ' + id + ' has ' + hits.length + ' defs with DIFFERENT names in ' +
                      files.join(', '));
    hits = [hits[0]];
  }
  if (hits.length !== 1)
    throw new Error('spine: id ' + id + ' matched ' + hits.length + ' lines across ' +
                    files.join(', ') + ' (need exactly 1). Fix locateId or the def.');
  return hits[0].rel + ':' + (hits[0].i + 1);
}

/* Like locateId but bounded to one table's declaration block. Needed because
   config.js legitimately reuses an id ACROSS tables: `overrun` is both a
   difficulty preset and a scenario, with the same display name, so neither
   the id nor the name can disambiguate globally. Within its own table an id
   is unique by construction. */
function locateIdUnder(rel, constName, id, name) {
  const lines = srcLines(rel);
  const decl = new RegExp('^const ' + constName + '\\s*=');
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) if (decl.test(lines[i])) { start = i; break; }
  if (start < 0) throw new Error('spine: const ' + constName + ' not found in ' + rel);
  for (let i = start + 1; i < lines.length; i++) if (/^const /.test(lines[i])) { end = i; break; }
  const pat = new RegExp("id:\\s*'" + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
  const hits = [];
  for (let i = start; i < end; i++) if (pat.test(lines[i])) hits.push(i);
  if (hits.length !== 1)
    throw new Error('spine: id ' + id + ' matched ' + hits.length + ' lines under ' + constName +
                    ' in ' + rel + ' (need exactly 1).');
  return rel + ':' + (hits[0] + 1);
}

/* Find the 1-based line of a KEY (`kinetic: {` or `'05': {`) between the
   declaration of `constName` and the next top-level `const`. For tables whose
   entries carry no id field. */
function locateKey(rel, constName, key) {
  const lines = srcLines(rel);
  let start = -1, end = lines.length;
  /* EXACT name then `=`: `const STORY` must not lock onto `const STORY_ACTS`,
     which is a real prefix collision in js/story.js. */
  const decl = new RegExp('^const ' + constName + '\\s*=');
  for (let i = 0; i < lines.length; i++)
    if (decl.test(lines[i])) { start = i; break; }
  if (start < 0) throw new Error('spine: const ' + constName + ' not found in ' + rel);
  for (let i = start + 1; i < lines.length; i++)
    if (/^const /.test(lines[i])) { end = i; break; }
  const pat = new RegExp("^\\s*'?" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'?:\\s*[{\\[]");
  const hits = [];
  for (let i = start; i < end; i++) if (pat.test(lines[i])) hits.push(i);
  if (hits.length !== 1)
    throw new Error('spine: key ' + key + ' matched ' + hits.length + ' lines under ' +
                    constName + ' in ' + rel + ' (need exactly 1).');
  return rel + ':' + (hits[0] + 1);
}

/* ==========================================================================
   FIGURES. Everything with art shows its art (owner directive, Session 43).
   The painted portraits live as data URIs inside js/artpack.js; the pages
   are static files, so every key a card references is DECODED OUT to
   narrative/assets/<key>.webp by the same run that writes the pages, and
   the --check freshness gate byte-compares those files too. Where no
   painted key exists the card degrades to the same thing the in-game codex
   degrades to: the entity's own colour and glyph, never a placeholder that
   pretends to be art.
   ========================================================================== */
const ASSET_KEYS = new Set();
function fig(key, cls, alt) {
  const v = G.ARTPACK && G.ARTPACK[key];
  if (!v) return null;
  if (v.slice(0, 23) !== 'data:image/webp;base64,')
    throw new Error('artpack key ' + key + ' is not the webp data URI this extractor expects');
  ASSET_KEYS.add(key);
  return '<img class="' + cls + '" loading="lazy" src="assets/' + key + '.webp" alt="' +
         esc(alt || '') + '">';
}
function chipFig(color, glyph) {
  return '<span class="cfig chip-fig" style="--cc:' + esc(color || '#7dd3fc') + '">' +
         esc(glyph || '') + '</span>';
}
function assetBytes(key) {
  return Buffer.from(G.ARTPACK[key].slice(23), 'base64');
}

/* Register one addressable thing and return the little ref chip that renders
   under its card: the ref string, then the source line, linked to GitHub.
   `src` is 'js/file.js:123', or 'js/file.js' for the one-line canon file. */
function spine(ref, kind, name, fac, page, anchor, src) {
  SPINE.push({ ref, kind, name, faction: fac || null, page: page + '#' + anchor, src });
  const m = /^(.*?):(\d+)$/.exec(src);
  const href = m ? REPO_BLOB + m[1] + '#L' + m[2] : REPO_BLOB + src;
  return '<a class="src" href="' + href + '" title="the exact source of this entry">' +
         esc(ref) + ' &middot; ' + esc(src) + '</a>';
}

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
[id]{scroll-margin-top:64px}
.src{display:block;margin-top:auto;padding-top:6px;font:10.5px/1.4 ui-monospace,Consolas,monospace;
 color:#5b6b7d;text-decoration:none;letter-spacing:.02em}
.src:hover{color:#7dd3fc}
.tdet{margin:2px 0 0}
.tdet summary{cursor:pointer;color:#75899e;font-size:11px;letter-spacing:.1em;list-style:none}
.tdet summary::before{content:'+ ';color:var(--fc)}
.tdet[open] summary::before{content:'\\2212 '}
.tdet ul{margin:6px 0 2px;padding-left:16px}
.tdet li{color:#93a7ba;font-size:12.5px;line-height:1.5;margin:3px 0}
.tdet li b{color:#c3d2e0;font-weight:600;letter-spacing:.04em}
.sig{color:#8aa0b5;font-size:12px}
.sig b{color:#c3d2e0;font-weight:600}
.whead .src,.actbar .src,.sub .src{display:inline;margin:0;padding:0}
.chead{display:flex;gap:10px;align-items:center;min-width:0}
.cheadt{display:flex;flex-direction:column;gap:3px;min-width:0}
.cfig{width:52px;height:52px;border-radius:6px;flex:none;object-fit:cover;
 border:1px solid #1d2836;background:#060a0f}
.chead .cfig.lg{width:64px;height:64px}
.chip-fig{display:flex;align-items:center;justify-content:center;font-size:22px;
 color:var(--cc);border-color:var(--cc);background:#0a0f16}
.crest{display:inline-block;width:24px;height:24px;vertical-align:-3px;margin-right:9px}
.crest svg{width:100%;height:100%;display:block}
.fhero{float:right;width:190px;aspect-ratio:1;object-fit:cover;border-radius:8px;
 border:1px solid #1d2836;margin:0 0 12px 18px}
@media(max-width:700px){.fhero{float:none;width:100%;aspect-ratio:16/9;margin:0 0 12px}}
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

function panel(key, label, text, after, stale, anchor) {
  return '<div class="pan' + (after ? ' after' : '') + (stale ? ' stalepan' : '') + '"' +
         (anchor ? ' id="' + esc(anchor) + '"' : '') + '>' +
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

/* ==========================================================================
   THE FIELD MANUAL. Towers, denizens and boons on the power's own page;
   the Vigil, the shared systems, the timeline and the relationship web on
   the index. Every number is read off the loaded tables, so a stat printed
   here IS the stat in the game, and every card carries its ref and its
   source line. Counters accumulate so the run can ASSERT total coverage:
   a tower this document skipped would otherwise be invisible forever.
   ========================================================================== */
const TOWER_FILES = ['js/config.js', 'js/towers2.js'];
/* ENEMY_TYPES is authored in config.js and EXTENDED by factions.js
   (Object.assign(ENEMY_TYPES, FACTION_ENEMY_TYPES) at the merge line), so a
   denizen def can live in either file. */
const UNIT_FILES = ['js/config.js', 'js/factions.js'];
const COVER = { towers: 0, units: 0, vigil: 0, commanders: 0, boons: 0 };

function towerCard(id, fac, page) {
  const t = G.TOWER_TYPES[id];
  const b = t.base || {};
  const el = G.ELEMENTS[t.element] || {};
  const lo = (G.LORE && G.LORE.towers && G.LORE.towers[id]) || {};
  const nums = [
    b.damage !== undefined ? 'dmg ' + b.damage : '',
    b.rate !== undefined ? 'rate ' + b.rate + '/s' : '',
    b.range !== undefined ? 'range ' + b.range : '',
    b.dmgType || '',
    b.splash ? 'splash ' + b.splash : ''
  ].filter(Boolean).join(' &middot; ');
  const ladder = [];
  (t.levels || []).forEach((l, i) =>
    ladder.push('<li><b>' + esc(l.name) + '</b> upgrade ' + (i + 1) + ', ' + l.cost + 'g</li>'));
  (t.talents || []).forEach(x =>
    ladder.push('<li><b>' + esc(x.name) + '</b> ' + esc(x.desc || '') + '</li>'));
  (t.branches || []).forEach(x =>
    ladder.push('<li><b>' + esc(x.name) + '</b> tier 4 branch, ' + x.cost + 'g. ' + esc(x.note || '') + '</li>'));
  COVER.towers++;
  return '<div class="card" id="tw-' + esc(id) + '">' +
    '<div class="chead">' +
      (fig('twr_' + id, 'cfig', t.name) || chipFig(t.color, t.glyph || t.name.charAt(0))) +
      '<div class="cheadt"><b>' + esc(t.name) + '</b>' +
      '<span class="nums">' + esc(t.role || '') + ' &middot; ' + (el.icon || '') + ' ' +
        esc(el.name || t.element) + ' &middot; ' + t.cost + 'g, growth &times;' + t.costGrowth + '</span>' +
      '</div></div>' +
    (nums ? '<span class="nums">' + nums + '</span>' : '') +
    '<span>' + esc(t.desc || '') + '</span>' +
    (lo.historical_origin ? '<span class="quote">' + esc(lo.historical_origin) + '</span>' : '') +
    (lo.canon_mechanic ? '<span><i>Canon:</i> ' + esc(lo.canon_mechanic) + '</span>' : '') +
    (ladder.length ? '<details class="tdet"><summary>THE LADDER: ' +
      (t.levels || []).length + ' upgrades, ' + (t.talents || []).length + ' talents, ' +
      (t.branches || []).length + ' branches</summary><ul>' + ladder.join('') + '</ul></details>' : '') +
    spine('tower:' + id, 'tower', t.name, fac, page, 'tw-' + id, locateId(TOWER_FILES, id, t.name)) +
    '</div>';
}

function unitCard(id, fac, page) {
  const e = G.ENEMY_TYPES[id];
  const u = G.UNIT_TYPES[id] || {};
  const lo = (G.LORE && G.LORE.units && G.LORE.units[id]) || {};
  const specials = [
    e.flying ? 'FLYING' : '', e.stealth ? 'stealth' : '',
    e.shield ? 'shield ' + e.shield + (e.shieldRegen ? ', +' + e.shieldRegen + '/s' : '') : '',
    e.healRate ? 'heals allies ' + e.healRate + '/s' : '',
    e.splitInto ? 'splits into ' + (e.splitCount || 2) + ' on death' : '',
    e.splashResist ? 'splash resist ' + Math.round(e.splashResist * 100) + '%' : ''
  ].filter(Boolean).join(' &middot; ');
  const weak = e.elemWeak ? Object.keys(e.elemWeak).map(k => (G.ELEMENTS[k] || {}).name || k).join(', ') : '';
  const res = e.elemResist ? Object.keys(e.elemResist).map(k => (G.ELEMENTS[k] || {}).name || k).join(', ') : '';
  const talents = (u.talents || []).map(x =>
    '<li><b>' + esc(x.name) + '</b> ' + esc(x.desc || '') + '</li>');
  COVER.units++;
  return '<div class="card" id="un-' + esc(id) + '">' +
    '<div class="chead">' +
      (fig('foe_' + id, 'cfig', e.name) || chipFig(e.color, e.name.charAt(0))) +
      '<div class="cheadt"><b>' + esc(e.name) + '</b>' +
      '<span class="nums">' + e.hp + ' hp &middot; ' + (e.armor || 0) + ' armour &middot; speed ' +
        e.speed + ' &middot; bounty ' + e.bounty + ' &middot; ' + e.lives + ' live' + (e.lives === 1 ? '' : 's') + '</span>' +
      '</div></div>' +
    (specials ? '<span class="nums">' + specials + '</span>' : '') +
    ((weak || res) ? '<span class="nums">' + (weak ? 'weak to ' + esc(weak) : '') +
      (weak && res ? ' &middot; ' : '') + (res ? 'resists ' + esc(res) : '') + '</span>' : '') +
    '<span>' + esc(e.desc || '') + '</span>' +
    (lo.formation ? '<span><i>Formation:</i> ' + esc(lo.formation) + '</span>' : '') +
    (lo.canon ? '<span class="quote">' + esc(lo.canon) + '</span>' : '') +
    (talents.length ? '<details class="tdet"><summary>DOCTRINE TALENTS: ' + talents.length +
      '</summary><ul>' + talents.join('') + '</ul></details>' : '') +
    spine('unit:' + id, 'unit', e.name, fac, page, 'un-' + id, locateId(UNIT_FILES, id, e.name)) +
    '</div>';
}

function commanderCard(c, fac, page) {
  const lo = (G.LORE && G.LORE.commanders && G.LORE.commanders[c.id]) || {};
  const open = (G.DIALOGUE && G.DIALOGUE.openers && G.DIALOGUE.openers[c.id]) || '';
  const abil = (c.abilities || []).map(a => G.ABILITIES[a]).filter(Boolean)
    .map(a => '<li><b>' + a.icon + ' ' + esc(a.name) + '</b> ' + esc(a.desc) +
              ' (' + a.cd + 's cooldown, ' + a.dur + 's)</li>');
  const sig = c.signature
    ? '<span class="sig"><i>Signature:</i> ' +
      c.signature.towers.map(t => '<b>' + esc((G.TOWER_TYPES[t] || {}).name || t) + '</b>').join(' + ') +
      ' with ' +
      c.signature.units.map(u => '<b>' + esc((G.ENEMY_TYPES[u] || {}).name || u) + '</b>').join(' + ') + '</span>'
    : '';
  const tech = (c.tech ? Object.values(c.tech) : []).filter(n => n && n.name && n.desc)
    .map(n => '<li><b>' + esc(n.name) + '</b> ' + esc(n.desc) + '</li>');
  COVER.commanders++;
  return '<div class="card" id="cd-' + esc(c.id) + '">' +
    '<div class="chead">' +
      (fig('cmd_' + c.id, 'cfig lg', c.name) || chipFig(c.color, c.icon)) +
      '<div class="cheadt"><b>' + (c.icon ? c.icon + ' ' : '') + esc(c.name) + '</b>' +
      '<span class="nums">' + esc(c.title || '') + '</span></div></div>' +
    (c.blurb ? '<span>' + esc(c.blurb) + '</span>' : '') +
    (c.trait ? '<span><i>' + esc(c.trait.name) + ':</i> ' + esc(c.trait.desc) + '</span>' : '') +
    sig +
    (lo.role ? '<span>' + esc(lo.role) + '</span>' : '') +
    (lo.motive ? '<span><i>Wants:</i> ' + esc(lo.motive) + '</span>' : '') +
    (lo.fracture ? '<span><i>Breaks on:</i> ' + esc(lo.fracture) + '</span>' : '') +
    (open ? '<span class="quote">' + esc(open) + '</span>' : '') +
    ((abil.length || tech.length)
      ? '<details class="tdet"><summary>ABILITIES AND TECH: ' + abil.length + ' abilities, ' +
        tech.length + ' tech nodes</summary><ul>' + abil.join('') + tech.join('') + '</ul></details>' : '') +
    spine('commander:' + c.id, 'commander', c.name, fac, page, 'cd-' + c.id,
          locateId('js/roster.js', c.id, c.name)) +
    '</div>';
}

function boonCard(b, fac, page) {
  COVER.boons++;
  return '<div class="card" id="bn-' + esc(b.id) + '">' +
    '<b>' + (b.icon ? b.icon + ' ' : '') + esc(b.name) + '</b>' +
    '<span class="nums">on ' + esc(b.k) + ' worlds</span>' +
    '<span>' + esc(b.desc || '') + '</span>' +
    (b.lore ? '<span class="quote">' + esc(b.lore) + '</span>' : '') +
    spine('boon:' + b.id, 'boon', b.name, fac, page, 'bn-' + b.id,
          locateId('js/towers2.js', b.id, b.name)) +
    '</div>';
}

function vigilCard(id) {
  const e = G.ENEMY_TYPES[id];
  const lo = (G.LORE && G.LORE.vigil && G.LORE.vigil[id]) || {};
  COVER.vigil++;
  return '<div class="card" id="vg-' + esc(id) + '">' +
    '<div class="chead">' +
      (fig('foe_' + id, 'cfig', e.name) || chipFig(e.color, e.name.charAt(0))) +
      '<div class="cheadt"><b>' + esc(e.name) + '</b>' +
      '<span class="nums">' + e.hp + ' hp &middot; ' + (e.armor || 0) + ' armour &middot; speed ' +
        e.speed + ' &middot; bounty ' + e.bounty + ' &middot; ' + e.lives + ' live' + (e.lives === 1 ? '' : 's') +
        (e.flying ? ' &middot; FLYING' : '') + '</span>' +
      '</div></div>' +
    '<span>' + esc(e.desc || '') + '</span>' +
    (lo.original_function ? '<span><i>Was:</i> ' + esc(lo.original_function) + '</span>' : '') +
    (lo.canon ? '<span class="quote">' + esc(lo.canon) + '</span>' : '') +
    spine('vigil:' + id, 'vigil', e.name, null, 'index.html', 'vg-' + id,
          locateId(UNIT_FILES, id, e.name)) +
    '</div>';
}

/* The five powers' sendable rosters, asserted against FACTION_UNITS so the
   pages and the muster can never disagree about who is sendable. */
function armyOf(fac) {
  const ids = G.FACTION_UNITS[fac] || [];
  if (!ids.length) throw new Error('spine: FACTION_UNITS.' + fac + ' is empty; the muster disagrees');
  return ids;
}
function arsenalOf(fac) {
  const ok = G.originKeyOf(fac);
  const ids = G.TOWER_ORDER.filter(id => G.TOWER_TYPES[id].origin === ok);
  if (!ids.length) throw new Error('spine: no towers under origin ' + ok + ' for ' + fac);
  return ids;
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
  const crest = (G.FACTIONS[fac] || {}).crest;
  w(fig('fac_' + fac, 'fhero', facName(fac) + ' banner art') || '');
  w('<h1 style="color:' + facColor(fac) + '">' +
    (crest ? '<span class="crest">' + crest + '</span>' : '') + esc(facName(fac)) + '</h1>');
  w('<p class="sub">The campaign in play order, then the full field manual: arsenal, army, ' +
    'leaders and boons, every number live from the game data. ' +
    'Type in any box to leave a note, then SAVE NOTES to download them.</p>');
  w('<p class="sub" style="margin-top:-8px">' +
    ['<a href="#arsenal">arsenal</a>', '<a href="#army">what you field</a>',
     '<a href="#leaders">who leads</a>', '<a href="#boons">war boons</a>',
     '<a href="#story">the spine</a>', '<a href="#intro">opening</a>',
     '<a href="#act-1">acts</a>'].join(' &middot; ') + '</p>');

  /* ---- who you are: the role-playing layer, on the same sheet ---- */
  const F = G.FACTIONS[fac] || {};
  const pageFile = fac + '.html';
  const doc = (G.SUMMON_DOCTRINES || {})[fac];
  w('<div class="power" id="power">');
  w('<div class="creed">' + esc(F.creed || '') + '</div>');
  if (F.tagline) w('<p class="sub" style="margin:0 0 10px">' + esc(F.tagline) + '</p>');
  if (F.blurb) w('<p class="blurb">' + esc(F.blurb) + '</p>');
  if (F.bonusName) w('<div class="bonus"><b>' + esc(F.bonusName) + '</b> ' + esc(F.bonusDesc || '') + '</div>');
  if (doc) w(' <div class="bonus" id="doctrine"><b>' + esc(doc.name) + '</b> ' + esc(doc.desc || '') + '</div>');
  if ((G.SECRET_FACTIONS || []).includes(fac))
    w('<p class="sub" style="margin:10px 0 0"><span class="chip seat">SECRET BANNER</span> ' +
      'This power unlocks only once the game is beaten; its arsenal is the prize of the campaign.</p>');
  w(spine('faction:' + fac, 'faction', F.name || fac, fac, pageFile, 'power',
          locateId('js/factions.js', fac, F.name)));
  if (doc) w(spine('doctrine:' + fac, 'doctrine', doc.name, fac, pageFile, 'doctrine',
                   locateKey('js/factions.js', 'SUMMON_DOCTRINES', fac)));
  w('</div>');

  /* THE ARSENAL. Every tower this origin builds, full dossier, in the order
     TOWER_ORDER introduces them. Read off the loaded tables: a stat printed
     here IS the stat in the game on this commit. */
  const arsenal = arsenalOf(fac);
  w('<h2 id="arsenal">The arsenal</h2>');
  w('<p class="sub">' + arsenal.length + ' towers. Numbers are base values before marks, talents, ' +
    'commander traits or boons. Open THE LADDER on any card for its full upgrade tree.</p>');
  w('<div class="cards">');
  arsenal.forEach(id => w(towerCard(id, fac, pageFile)));
  w('</div>');

  /* WHAT YOU FIELD. The sendable roster, lightest first, exactly the muster
     order, with the full combat sheet the enemy reads off ENEMY_TYPES. */
  const army = armyOf(fac);
  w('<h2 id="army">What you field</h2>');
  w('<p class="sub">' + army.length + ' denizens, lightest first, which is also the order the muster ' +
    'introduces them. The same body the rival meets when you send it.</p>');
  w('<div class="cards">');
  army.forEach(id => w(unitCard(id, fac, pageFile)));
  w('</div>');

  /* Commanders, with trait, signature, abilities, tech and the lore entry
     that explains them. */
  const roster = (G.COMMANDER_ROSTER || []).filter(c => c.faction === fac);
  if (roster.length) {
    w('<h2 id="leaders">Who leads</h2>');
    w('<p class="sub">' + roster.length + ' commanders under this banner. CADRE, the unaligned ' +
      'baseline everyone starts with, lives on the <a href="index.html#cd-cadre">index</a>.</p>');
    w('<div class="cards">');
    roster.forEach(c => w(commanderCard(c, fac, pageFile)));
    w('</div>');
  }

  /* WAR BOONS. The five per-power picks a world can offer this banner. */
  const boons = (G.BOONS || []).filter(b => b.f === fac);
  if (boons.length) {
    w('<h2 id="boons">War boons</h2>');
    w('<p class="sub">' + boons.length + ' boons a world can grant this power, by world kind.</p>');
    w('<div class="cards">');
    boons.forEach(b => w(boonCard(b, fac, pageFile)));
    w('</div>');
  }

  /* The story spine: the beats that carry the whole tragedy, with what each
     reveals. (`beats`, not `spine`: spine() is the ref collector now.) */
  const beats = (G.STORY && G.STORY[fac]) || [];
  if (beats.length) {
    const beatsSrc = locateKey('js/story.js', 'STORY', fac);
    w('<h2 id="story">The spine</h2>');
    w('<p class="sub">' + beats.length + ' beats that carry the arc. Everything else on this page ' +
      'hangs off them. ' + spine(fac + '/story', 'story', facName(fac) + ' story spine', fac,
                                 pageFile, 'story', beatsSrc) + '</p>');
    beats.forEach((b, i) => {
      SPINE.push({ ref: fac + '/beat' + (i + 1), kind: 'beat', name: b.title || ('beat ' + (i + 1)),
                   faction: fac, page: pageFile + '#beat-' + (i + 1), src: beatsSrc });
      w('<div class="beat" id="beat-' + (i + 1) + '"><b>BEAT ' + (i + 1) +
        (b.title ? ' &middot; ' + esc(b.title) : '') + '</b>' + esc(b.line || '') +
        (b.reveal ? '<span class="reveal">' + esc(b.reveal) + '</span>' : '') + '</div>');
    });
  }

  /* The six alternate opening lines a world can speak instead of its own. */
  const MOM = [['seat', 'a throne world'], ['contested', 'two rivals already here'],
               ['renegade', 'your own banner holds it'], ['retaken', 'you lost this once'],
               ['flawless', 'three stars'], ['defeat', 'you lost the campaign']];
  if (G.PLANET_MOMENTS) {
    w('<h2 id="voices">Alternate voices</h2>');
    w('<p class="sub">These replace the first line on any world where they apply, most surprising fact first.</p>');
    w('<div class="cards">');
    MOM.forEach(([k, label]) => {
      const t = G.PLANET_MOMENTS[k] && G.PLANET_MOMENTS[k][fac];
      if (t) w('<div class="card" id="vc-' + esc(k) + '"><b>' + esc(k.toUpperCase()) + '</b><span class="nums">' +
               esc(label) + '</span><span class="quote">' + esc(t) + '</span>' +
               spine(fac + '/voice/' + k, 'voice', k.toUpperCase(), fac, pageFile, 'vc-' + k,
                     locateKey('js/planetcuts.js', 'PLANET_MOMENTS', k)) + '</div>');
    });
    w('</div>');
  }

  /* ---- the intro ---- */
  const introSrc = locateKey('js/cutscenes.js', 'CUTSCENES', fac);
  w('<h2 id="intro">Opening cinematic</h2>');
  const intro = cs.intro || [];
  w('<p class="sub">' + intro.length + ' slides. ' +
    spine(fac + '/intro', 'cinematic', facName(fac) + ' opening', fac, pageFile, 'intro', introSrc) +
    '</p>');
  w('<div class="strip">');
  intro.forEach((sl, i) => {
    SPINE.push({ ref: fac + '/intro/slide' + (i + 1), kind: 'slide',
                 name: 'opening slide ' + (i + 1) + (sl.text ? '' : ' (silent)'),
                 faction: fac, page: pageFile + '#intro-' + (i + 1), src: introSrc });
    w(panel(sl.key, 'SLIDE ' + (i + 1), sl.text, false, false, 'intro-' + (i + 1)));
  });
  w('</div>');
  w(noteBox(fac + ' / INTRO', 'Notes on the opening cinematic...'));

  /* ---- the acts ---- */
  actsFor(fac).forEach((act, ai) => {
    const sysBeat = (cs.sys || [])[ai];
    w('<div class="act" id="act-' + (ai + 1) + '">');
    w('<div class="actbar"><span class="actno">ACT ' + (ai + 1) + '</span>' +
      '<span class="actname">' + esc(act.sys) + '</span>' +
      '<span class="actwho">' + (act.homeOf === fac ? 'your home' : 'home of ' + esc(facName(act.homeOf))) +
      '</span>' +
      spine(fac + '/act' + (ai + 1), 'act', act.sys, fac, pageFile, 'act-' + (ai + 1),
            locateKey('js/story.js', 'ACT_SCENARIOS', fac)) + '</div>');
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
      const wref = fac + '/act' + (ai + 1) + '/' + wname;
      const wsrc = e ? locateKey('js/planetcuts.js', 'PLANET_CUTS', key) : 'js/planetcuts.js';
      w('<div class="whead" id="w-' + key + '"><span class="wname">' + esc(wname) + '</span>' +
        (wi === 6 ? '<span class="chip seat">SEAT &middot; ACT ENDS HERE</span>' : '') +
        (rev ? '<span class="chip rev">REVERSAL &middot; ' + esc(rev) + '</span>' : '') +
        (enc ? '<span class="chip enc">' + esc(enc.scenario) + ' &middot; ' +
               esc(enc.who) + '</span>' : '') +
        spine(wref, 'world', wname, fac, pageFile, 'w-' + key, wsrc) + '</div>');
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
  w('<!doctype html><meta charset="utf-8"><title>Cosmic Conquest spine</title>');
  w('<style>' + CSS + '</style><body data-fac="index">');
  w('<div class="wrap"><h1>COSMIC CONQUEST &mdash; THE SPINE</h1>');
  w('<p class="sub">The canonical reference for everything on main: every campaign in play order, ' +
    'every tower, denizen, commander, boon, element, reaction and ability, each with its stable ' +
    'ref and the exact source line it is generated from. Rebuilt from the game itself on every ' +
    'push to main, so it can never describe a version that no longer exists. Pick a power and ' +
    'read its campaign, its arsenal and its army on one sheet.</p>');
  w('<div class="grid5">');
  FACS.forEach(f => {
    const st = G.STORY && G.STORY[f];
    const hook = (st && st[0] && st[0].line) ? String(st[0].line).slice(0, 120) : '';
    const cr = (G.FACTIONS[f] || {}).crest;
    w('<a class="fcard" href="' + f + '.html" style="--fc:' + facColor(f) + '">' +
      '<b style="color:' + facColor(f) + '">' +
      (cr ? '<span class="crest">' + cr + '</span>' : '') + esc(facName(f)) + '</b>' +
      '<span>' + esc(hook) + '</span></a>');
  });
  w('</div>');

  /* ---- how to give a note against anything in the game ---- */
  const exTower = arsenalOf('human')[4], exUnit = armyOf('human')[1];
  w('<h2 id="howto">How to reference anything here</h2>');
  w('<p class="sub">Every card on every page carries a mono line: its <b style="color:#fff">ref</b>, ' +
    'then the source it is generated from, linked to the exact line on GitHub. Quote the ref in a ' +
    'note ("<b style="color:#fff">tower:' + esc(exTower) + ' feels weak", "human/intro/slide7 reads ' +
    'flat</b>") and it resolves mechanically: <a href="spine.json">spine.json</a> maps every ref to ' +
    'its page anchor and its source location, for people and for the AI working on the game.</p>');
  w('<table class="dec">');
  [['tower:' + exTower, 'a tower, on its power&#39;s page under THE ARSENAL'],
   ['unit:' + exUnit, 'a sendable denizen, under WHAT YOU FIELD'],
   ['commander:' + (G.COMMANDER_ROSTER.find(c => c.faction) || {}).id, 'a commander, under WHO LEADS'],
   ['boon:' + (G.BOONS[0] || {}).id, 'a war boon, under WAR BOONS'],
   ['vigil:' + Object.keys(G.ENEMY_TYPES).find(id => !(G.ENEMY_TYPES[id].faction)), 'a Vigil machine, on this page'],
   ['human/act2', 'an act on a power&#39;s page; human/act2/' + esc((G.GX_HOME_SYSTEMS.human.worlds || [])[0] || 'EARTH') + ' is one world in it'],
   ['human/intro/slide7', 'one slide of a power&#39;s opening cinematic'],
   ['human/beat3', 'one beat of a power&#39;s story spine; human/voice/seat is an alternate voice'],
   ['element:fire &middot; reaction:' + (Object.values(G.COMBOS.fire || {})[0] || {}).id +
    ' &middot; ability:' + Object.keys(G.ABILITIES)[0] +
    ' &middot; doctrine:light &middot; playermod:' + (G.PLAYER_MODS[0] || {}).id +
    ' &middot; timeline:12', 'the shared systems, below on this page'],
   ['map:' + (G.MAPS[0] || {}).id + ' &middot; scenario:' + (G.SCENARIOS[0] || {}).id +
    ' &middot; arena:' + (G.ARENA_MODS[0] || {}).id + ' &middot; target:' + (G.TARGET_MODES[0] || {}).id +
    ' &middot; waveroll:' + (G.LEVEL_ROLLS[0] || {}).id + ' &middot; lorecodex:' + (G.LORE_CODEX[0] || {}).id,
    'boards, scenarios, arena modifiers, targeting, wave rolls and the lore codex, below']]
    .forEach(r => w('<tr class="y"><td>REF</td><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'));
  w('</table>');
  w('<p class="sub">Canon this page does not render (mythos operations, visual briefs, world ' +
    'generation, arena modifiers, scenarios, maps) lives under those keys in ' +
    '<a href="' + REPO_BLOB + 'js/lore.js">js/lore.js</a>, the frozen lore bible. The pages and ' +
    'spine.json are regenerated together by <a href="' + REPO_BLOB + 'tools/storyboard.js">' +
    'tools/storyboard.js</a>; tools/gate.js fails if they go stale, and the deploy workflow ' +
    'rebuilds them on every push to main, so only what is actually on main can appear here.</p>');

  /* ---- the commander everyone starts with ---- */
  const cadre = G.COMMANDER_ROSTER.filter(c => !c.faction);
  if (cadre.length) {
    w('<h2 id="baseline">The baseline commander</h2>');
    w('<p class="sub">Unaligned, free, and issued to every profile. The factioned rosters live on ' +
      'their power&#39;s own page.</p>');
    w('<div class="cards">');
    cadre.forEach(c => w(commanderCard(c, null, 'index.html')));
    w('</div>');
  }

  /* ---- the shared systems every power plays under ---- */
  w('<h2 id="systems">The shared systems</h2>');
  w('<p class="sub">The rules underneath every banner: what marks, what reacts, what a commander ' +
    'can call down, and what a wave can arrive carrying.</p>');

  const elemIds = Object.keys(G.ELEMENTS);
  w('<h2 id="elements" style="font-size:13px;margin-top:26px">Elements, ' + elemIds.length + '</h2>');
  w('<div class="cards">');
  elemIds.forEach(id => {
    const e = G.ELEMENTS[id];
    const tw = G.TOWER_ORDER.filter(t => G.TOWER_TYPES[t].element === id);
    w('<div class="card" id="el-' + esc(id) + '"><b>' + e.icon + ' ' + esc(e.name) + '</b>' +
      '<span>' + (e.marks
        ? 'Leaves a mark. A hit from a different marking element consumes it and triggers a reaction.'
        : 'Does not mark. Straight damage, no reactions, that is the trade.') + '</span>' +
      '<span class="nums">' + tw.length + ' tower' + (tw.length === 1 ? '' : 's') + ': ' +
      esc(tw.map(t => G.TOWER_TYPES[t].name).join(', ')) + '</span>' +
      spine('element:' + id, 'element', e.name, null, 'index.html', 'el-' + id,
            locateKey('js/towers2.js', 'ELEMENTS', id)) + '</div>');
  });
  w('</div>');

  const seenRx = new Set();
  w('<h2 id="reactions" style="font-size:13px;margin-top:26px">Reactions</h2>');
  w('<div class="cards">');
  for (const a in G.COMBOS) for (const b in G.COMBOS[a]) {
    const c = G.COMBOS[a][b];
    if (seenRx.has(c.id)) continue;
    seenRx.add(c.id);
    w('<div class="card" id="rx-' + esc(c.id) + '"><b>' + esc(c.name) + '</b>' +
      '<span class="nums">' + G.ELEMENTS[a].icon + ' ' + esc(G.ELEMENTS[a].name) + ' + ' +
      G.ELEMENTS[b].icon + ' ' + esc(G.ELEMENTS[b].name) + '</span>' +
      '<span>' + esc(c.desc || '') + '</span>' +
      spine('reaction:' + c.id, 'reaction', c.name, null, 'index.html', 'rx-' + c.id,
            locateId('js/towers2.js', c.id, c.name, { first: true })) + '</div>');
  }
  w('</div>');

  const abilIds = Object.keys(G.ABILITIES);
  w('<h2 id="abilities" style="font-size:13px;margin-top:26px">Commander abilities, ' + abilIds.length + '</h2>');
  w('<div class="cards">');
  abilIds.forEach(id => {
    const a = G.ABILITIES[id];
    w('<div class="card" id="ab-' + esc(id) + '">' +
      '<div class="chead">' +
      (fig('abil_' + id, 'cfig', a.name) || chipFig(a.kind === 'offense' ? '#fbbf24' : '#7dd3fc', a.icon)) +
      '<div class="cheadt"><b>' + a.icon + ' ' + esc(a.name) + '</b>' +
      '<span class="nums">' + (a.kind === 'offense' ? 'OFFENSIVE' : 'DEFENSIVE') + ' &middot; ' +
      a.cd + 's cooldown &middot; ' + a.dur + 's duration</span></div></div>' +
      '<span>' + esc(a.desc || '') + '</span>' +
      spine('ability:' + id, 'ability', a.name, null, 'index.html', 'ab-' + id,
            locateId('js/abilities.js', id, a.name)) + '</div>');
  });
  w('</div>');

  w('<h2 id="mods" style="font-size:13px;margin-top:26px">Wave modifiers: ' +
    G.PLAYER_MODS.length + ' yours, ' + G.ENEMY_MODS.length + ' theirs</h2>');
  w('<p class="sub">Index-coupled tables (the duel wire carries indices), so these are append-only ' +
    'and shown in wire order.</p>');
  w('<div class="cards">');
  G.PLAYER_MODS.forEach(m =>
    w('<div class="card" id="pm-' + esc(m.id) + '"><b>' + (m.icon || '') + ' ' + esc(m.name) + '</b>' +
      '<span class="nums">yours</span><span>' + esc(m.desc || '') + '</span>' +
      spine('playermod:' + m.id, 'playermod', m.name, null, 'index.html', 'pm-' + m.id,
            locateIdUnder('js/config.js', 'PLAYER_MODS', m.id, m.name)) + '</div>'));
  G.ENEMY_MODS.forEach(m =>
    w('<div class="card" id="em-' + esc(m.id) + '"><b>' + (m.icon || '') + ' ' + esc(m.name) + '</b>' +
      '<span class="nums">theirs</span><span>' + esc(m.desc || '') + '</span>' +
      spine('enemymod:' + m.id, 'enemymod', m.name, null, 'index.html', 'em-' + m.id,
            locateIdUnder('js/config.js', 'ENEMY_MODS', m.id, m.name)) + '</div>'));
  w('</div>');

  w('<h2 id="targeting" style="font-size:13px;margin-top:26px">Targeting modes, ' +
    G.TARGET_MODES.length + ' &middot; Wave rolls, ' + G.LEVEL_ROLLS.length + '</h2>');
  w('<p class="sub">Both index-coupled on the duel wire, so append-only and shown in wire order.</p>');
  w('<div class="cards">');
  G.TARGET_MODES.forEach(m =>
    w('<div class="card" id="tg-' + esc(m.id) + '"><b>' + esc(m.name) + '</b>' +
      '<span class="nums">targeting</span><span>' + esc(m.desc || '') + '</span>' +
      spine('target:' + m.id, 'target', m.name, null, 'index.html', 'tg-' + m.id,
            locateIdUnder('js/config.js', 'TARGET_MODES', m.id, m.name)) + '</div>'));
  G.LEVEL_ROLLS.forEach(m =>
    w('<div class="card" id="lr-' + esc(m.id) + '"><b>' + esc(m.name) + '</b>' +
      '<span class="nums">wave roll</span><span>' + esc(m.desc || '') + '</span>' +
      spine('waveroll:' + m.id, 'waveroll', m.name, null, 'index.html', 'lr-' + m.id,
            locateIdUnder('js/config.js', 'LEVEL_ROLLS', m.id, m.name)) + '</div>'));
  w('</div>');

  w('<h2 id="arenas" style="font-size:13px;margin-top:26px">Arena modifiers, ' + G.ARENA_MODS.length + '</h2>');
  w('<p class="sub">A world can impose one of these on its whole battle.</p>');
  w('<div class="cards">');
  G.ARENA_MODS.forEach(m =>
    w('<div class="card" id="ar-' + esc(m.id) + '"><b>' + (m.icon || '') + ' ' + esc(m.name) + '</b>' +
      '<span>' + esc(m.desc || '') + '</span>' +
      spine('arena:' + m.id, 'arena', m.name, null, 'index.html', 'ar-' + m.id,
            locateIdUnder('js/towers2.js', 'ARENA_MODS', m.id, m.name)) + '</div>'));
  w('</div>');

  w('<h2 id="scenarios" style="font-size:13px;margin-top:26px">Scenarios, ' + G.SCENARIOS.length + '</h2>');
  w('<p class="sub">The shapes a battle can take, each with its three stars.</p>');
  w('<div class="cards">');
  G.SCENARIOS.forEach(s =>
    w('<div class="card" id="sc-' + esc(s.id) + '"><b>' + (s.icon || '') + ' ' + esc(s.name) + '</b>' +
      '<span>' + esc(s.brief || '') + '</span>' +
      ((s.stars || []).length ? '<span class="nums">stars: ' + s.stars.map(esc).join(' &middot; ') + '</span>' : '') +
      (s.flavor ? '<span class="quote">' + esc(s.flavor) + '</span>' : '') +
      spine('scenario:' + s.id, 'scenario', s.name, null, 'index.html', 'sc-' + s.id,
            locateIdUnder('js/config.js', 'SCENARIOS', s.id, s.name)) + '</div>'));
  w('</div>');

  const authoredMaps = G.MAPS.filter(m => !m.procedural), procMaps = G.MAPS.filter(m => m.procedural);
  w('<h2 id="boards" style="font-size:13px;margin-top:26px">The boards, ' + G.MAPS.length +
    ' (' + authoredMaps.length + ' authored, ' + procMaps.length + ' procedural)</h2>');
  w('<p class="sub">Every battlefield the galaxy can deal. Procedural boards are families: each ' +
    'world rolls its own layout from the family and its seed.</p>');
  w('<div class="cards">');
  G.MAPS.forEach(m =>
    w('<div class="card" id="mp-' + esc(m.id) + '"><b>' + esc(m.name) + '</b>' +
      '<span class="nums">' + (m.procedural ? 'procedural, family ' + esc(m.family || m.id) : 'authored') +
      (m.tier !== undefined ? ' &middot; tier ' + m.tier : (m.minTier !== undefined ? ' &middot; from tier ' + m.minTier : '')) +
      (m.adj ? ' &middot; ' + esc(m.adj) : '') + '</span>' +
      (m.sigNote ? '<span>' + esc(m.sigNote) + '</span>' : '') +
      spine('map:' + m.id, 'map', m.name, null, 'index.html', 'mp-' + m.id,
            locateIdUnder('js/config.js', 'MAPS', m.id, m.name)) + '</div>'));
  w('</div>');

  w('<h2 id="lorecodex">The lore codex, ' + G.LORE_CODEX.length + ' entries</h2>');
  w('<p class="sub">The in-game Field Manual&#39;s lore pages, word for word.</p>');
  w('<div class="cards">');
  G.LORE_CODEX.forEach(l =>
    w('<div class="card" id="lc-' + esc(l.id) + '"><b>' + esc(l.title) + '</b>' +
      '<span>' + esc(l.body || '') + '</span>' +
      spine('lorecodex:' + l.id, 'lorecodex', l.title, null, 'index.html', 'lc-' + l.id,
            locateIdUnder('js/factions.js', 'LORE_CODEX', l.id, l.title)) + '</div>'));
  w('</div>');

  /* ---- the machines everyone fights ---- */
  const facUnitIds = new Set(FACS.flatMap(f => G.FACTION_UNITS[f] || []));
  const vigilIds = Object.keys(G.ENEMY_TYPES).filter(id => !facUnitIds.has(id));
  /* ONE NAME, TWO ROLES: the playable banner and this host are both THE
     VIGIL by owner directive, so this section is titled by ROLE. */
  w('<h2 id="vigil">The Vigil&#39;s standing guard, ' + vigilIds.length + ' machines</h2>');
  w('<p class="sub">The neutral enforcement waves of the machine civilization, garrisoning every ' +
    'world no living banner holds. Same polity as <a href="robot.html">the playable Vigil banner</a>, ' +
    'different role: these hold nothing and answer to standing orders older than the war. ' +
    'The five powers&#39; own denizens live on their pages.</p>');
  w('<div class="cards">');
  vigilIds.forEach(id => w(vigilCard(id)));
  w('</div>');

  /* ---- the timeline ---- */
  const tl = (G.LORE && G.LORE.timeline && G.LORE.timeline.events) || [];
  if (tl.length) {
    w('<h2 id="timeline">The timeline, ' + tl.length + ' events</h2>');
    w('<p class="sub">The canon record, oldest first, from the frozen lore bible ' +
      '(<a href="' + REPO_BLOB + 'js/lore.js">js/lore.js</a>, release ' +
      esc((G.LORE && G.LORE.version) || '') + '). Ref any row as timeline:N.</p>');
    w('<table class="dec">');
    tl.forEach((ev, i) => {
      SPINE.push({ ref: 'timeline:' + (i + 1), kind: 'timeline', name: String(ev.event || '').slice(0, 80),
                   faction: null, page: 'index.html#tl-' + (i + 1), src: 'js/lore.js' });
      w('<tr class="y" id="tl-' + (i + 1) + '"><td>' + esc(ev.date || '') + '</td><td><b>' +
        esc(ev.event || '') + '</b>' + (ev.cause ? '<br><span>' + esc(ev.cause) + '</span>' : '') +
        '</td><td>' + (i + 1) + (ev.status && ev.status !== 'canon' ? ' &middot; ' + esc(ev.status) : '') +
        '</td></tr>');
    });
    w('</table>');
  }

  /* ---- who cannot stand whom ---- */
  const rels = (G.LORE && G.LORE.relationships) || [];
  if (rels.length) {
    const cname = id => { const c = G.COMMANDER_ROSTER.find(x => x.id === id); return c ? c.name : id; };
    w('<h2 id="relationships">The relationship web, ' + rels.length + ' threads</h2>');
    w('<p class="sub">Every authored tension between commanders, from the lore bible. ' +
      'Ref a thread as rel:a-b.</p>');
    w('<table class="dec">');
    rels.forEach(r => {
      SPINE.push({ ref: 'rel:' + r.a + '-' + r.b, kind: 'relationship',
                   name: cname(r.a) + ' and ' + cname(r.b), faction: null,
                   page: 'index.html#rel-' + r.a + '-' + r.b, src: 'js/lore.js' });
      w('<tr class="y" id="rel-' + esc(r.a) + '-' + esc(r.b) + '"><td>' + esc(cname(r.a)) + ' &amp; ' +
        esc(cname(r.b)) + '</td><td><b>' + esc(r.theme || '') + '</b><br><span>' +
        esc(r.conflict || '') + '</span></td><td>rel:' + esc(r.a) + '-' + esc(r.b) + '</td></tr>');
    });
    w('</table>');
  }

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
  w('<div class="stat" style="margin-top:8px"><span><b>' + G.TOWER_ORDER.length + '</b> towers</span>' +
    '<span><b>' + Object.keys(G.ENEMY_TYPES).length + '</b> denizen types, of which <b>' +
    FACS.reduce((a, f) => a + (G.FACTION_UNITS[f] || []).length, 0) + '</b> sendable</span>' +
    '<span><b>' + G.COMMANDER_ROSTER.length + '</b> commanders</span>' +
    '<span><b>' + G.BOONS.length + '</b> boons</span>' +
    '<span><b>' + Object.keys(G.ELEMENTS).length + '</b> elements</span>' +
    '<span><b>' + seenRx.size + '</b> reactions</span>' +
    '<span><b>' + Object.keys(G.ABILITIES).length + '</b> abilities</span></div>');
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
const CHECK = process.argv.includes('--check');

/* Faction pages FIRST, index second: the coverage counters and the spine
   accumulate across every page, and the assertions below hold the totals to
   the loaded tables. */
const files = {};
FACS.forEach(f => { files[f + '.html'] = page(f); });
files['index.html'] = index();

/* COVERAGE IS ASSERTED, NOT ASSUMED. A tower this document silently skipped
   would be invisible in every future review, which is the dead-field failure
   with a longer fuse. Any mismatch kills the run, and the gate with it. */
const facUnitTotal = FACS.reduce((a, f) => a + (G.FACTION_UNITS[f] || []).length, 0);
[['towers', COVER.towers, G.TOWER_ORDER.length],
 ['sendable denizens', COVER.units, facUnitTotal],
 ['vigil machines', COVER.vigil, Object.keys(G.ENEMY_TYPES).length - facUnitTotal],
 ['commanders', COVER.commanders, G.COMMANDER_ROSTER.length],
 ['boons', COVER.boons, G.BOONS.length]
].forEach(([what, got, want]) => {
  if (got !== want)
    throw new Error('spine coverage: rendered ' + got + ' ' + what + ' but the game holds ' + want);
});

/* A ref that resolves to two places is worse than no ref. */
{
  const seen = new Set();
  for (const e of SPINE) {
    if (seen.has(e.ref)) throw new Error('spine: duplicate ref ' + e.ref);
    seen.add(e.ref);
  }
}

files['spine.json'] = JSON.stringify({
  what: 'Every stable ref in the Cosmic Conquest spine: ref, kind, name, faction, page anchor, source location. Regenerated by tools/storyboard.js; only what is on main can appear here.',
  repo: 'https://github.com/majieddd/majieddd.github.io',
  entries: SPINE
}, null, 1) + '\n';

/* The figure files the pages reference, decoded from js/artpack.js. The
   assets directory is fully DERIVED: exactly the referenced keys exist there,
   an orphan is staleness, and --check holds bytes equal. */
const ASSETS = {};
for (const k of ASSET_KEYS) ASSETS[k + '.webp'] = assetBytes(k);
const assetDir = path.join(dir, 'assets');
const assetCounts = (() => {
  const by = {};
  for (const k of ASSET_KEYS) { const p = k.split('_')[0]; by[p] = (by[p] || 0) + 1; }
  return Object.keys(by).sort().map(p => by[p] + ' ' + p).join(', ');
})();

if (CHECK) {
  /* Regenerate in memory and compare. The read may fail because the file is
     MISSING, which is just the loudest kind of stale, so it reports as stale
     rather than throwing. */
  const stale = Object.keys(files).filter(n => {
    try { return fs.readFileSync(path.join(dir, n), 'utf8') !== files[n]; }
    catch (e) { return true; }
  });
  for (const n of Object.keys(ASSETS)) {
    try { if (!fs.readFileSync(path.join(assetDir, n)).equals(ASSETS[n])) stale.push('assets/' + n); }
    catch (e) { stale.push('assets/' + n); }
  }
  try {
    for (const f of fs.readdirSync(assetDir))
      if (f.endsWith('.webp') && !ASSETS[f]) stale.push('assets/' + f + ' (orphaned)');
  } catch (e) { /* no assets dir at all is already reported above, per key */ }
  if (stale.length) {
    console.log('narrative spine STALE: ' + stale.slice(0, 8).join(', ') +
      (stale.length > 8 ? ' and ' + (stale.length - 8) + ' more' : '') +
      '. Run: node tools/storyboard.js');
    process.exit(1);
  }
  console.log('narrative spine fresh: ' + Object.keys(files).length + ' files, ' + SPINE.length +
    ' refs, ' + ASSET_KEYS.size + ' figures');
} else {
  fs.mkdirSync(assetDir, { recursive: true });
  let wrote = 0;
  for (const n of Object.keys(files)) fs.writeFileSync(path.join(dir, n), files[n], 'utf8');
  for (const n of Object.keys(ASSETS)) {
    const p = path.join(assetDir, n);
    let cur = null;
    try { cur = fs.readFileSync(p); } catch (e) { /* missing: write below */ }
    if (!cur || !cur.equals(ASSETS[n])) { fs.writeFileSync(p, ASSETS[n]); wrote++; }
  }
  for (const f of fs.readdirSync(assetDir))
    if (f.endsWith('.webp') && !ASSETS[f]) { fs.unlinkSync(path.join(assetDir, f)); }
  console.log('wrote narrative/: ' + FACS.length + ' campaign pages, index.html, spine.json (' +
    SPINE.length + ' refs; ' + COVER.towers + ' towers, ' + (COVER.units + COVER.vigil) +
    ' denizens, ' + COVER.commanders + ' commanders, ' + COVER.boons + ' boons; figures: ' +
    assetCounts + '; ' + wrote + ' asset files updated)');
}
