/* Inlines css/ and js/ into a single distributable HTML file.
   Run with:  node build.js   →  writes aegis-protocol.html          */
const fs = require('fs');
const path = require('path');
const here = __dirname;

const read = p => fs.readFileSync(path.join(here, p), 'utf8');

const html = read('index.html');
const css  = read('css/style.css') + String.fromCharCode(10) + read('css/polish.css');
/* `lore` sits early and before `dialogue`, `commanders` and `ui`, which are the
   modules that read it. It is a frozen data object with no dependencies of its
   own, generated from the lore repository (docs/lore/) and never hand-edited. */
/* The `cut` class ships as real files under art/ so the live site does not put
   13MB of story plates on the first-load path (see write_pack in
   artgen/krea_gen.py). A single-file download cannot fetch a sibling file, so
   inline them back HERE and only here: the bundle carries data URIs, the site
   carries URLs, and both are read through the same art() accessor. */
/* The animated plates are deliberately NOT inlined. A single-file download
   cannot fetch a sibling file, so the choice is inline them or drop them, and
   five clips would add about 6MB of base64 to a bundle that is already 22MB
   for art nobody asked to download. Dropping ARTVID to an empty map is the
   honest option: cutscenes.js already treats an absent key as the normal case
   and plays the still, which is the same thing a reader with reduced-motion
   set gets. The bundle stays self-contained and stays lean. */
const stripVideo = s => s.replace(/const ARTVID = \{[^\n]*?\};/, 'const ARTVID = {};');

/* THE PLANET PLATES ARE DROPPED FROM THE BUNDLE, NOT INLINED.
   The `cut` class is inlined below because 50 plates is about 10MB and a
   single-file download that silently lost its story art would be a worse
   trade. The `pcut` class cannot take that deal: 875 plates at ~200KB is
   roughly 175MB of raw art, which base64 inflates by a further third, against
   a bundle that is 22MB today. A 230MB single HTML file is not a download, it
   is a denial of service, and most browsers will not parse it.

   So the bundle drops them, and js/ui.js falls back to the world plate for any
   planet beat whose key is absent. That fallback is not special-cased for the
   bundle: it is the same path a partially rendered pack takes, so it is
   exercised on every machine that has ever run this game mid-render rather
   than only on the one artefact nobody tests. The live site, which CAN fetch a
   sibling file, serves all 875 from art/ on demand.

   Verified by the two guards at the foot of this file: the bundle must contain
   no `art/` URL at all, so a pcut entry surviving this strip fails the build
   rather than shipping a broken image. */
const PLANET_ENTRY_RE = /"pcut_[A-Za-z0-9_]+":"art\/pcut_[A-Za-z0-9_]+\.webp",?/g;
const stripPlanet = s => {
  const before = (s.match(PLANET_ENTRY_RE) || []).length;
  let out = s.replace(PLANET_ENTRY_RE, '');
  /* Removing the final entry of the object leaves a dangling comma. Repair it
     rather than trusting key order, which json.dumps does not promise. */
  out = out.replace(/,\s*\}/g, '}').replace(/\{\s*,/g, '{');
  if (before) console.log('  dropped ' + before + ' planet plates from the bundle');
  return out;
};

const ONDEMAND_RE = /"art\/([A-Za-z0-9_]+)\.webp"/g;
const inlineOnDemand = s => s.replace(ONDEMAND_RE, (m, key) => {
  const file = path.join(here, 'art', key + '.webp');
  if (!fs.existsSync(file)) {
    console.error('Bundle needs art/' + key + '.webp and it is missing. Run krea_gen.py --pack.');
    process.exit(1);
  }
  return '"data:image/webp;base64,' + fs.readFileSync(file).toString('base64') + '"';
});

const js   = ['artpack', 'mapgen', 'lore', 'story', 'cutscenes', 'planetcuts', 'worldlore', 'missions', 'config', 'factions', 'towers2', 'abilities', 'roster', 'dialogue', 'commanders', 'audio', 'entities', 'entities2', 'ai', 'galaxy', 'game', 'net', 'ui', 'main']
  .map(n => `/* ── ${n}.js ─────────────────────────────────── */\n` +
            (n === 'artpack' ? stripVideo(inlineOnDemand(stripPlanet(read(`js/${n}.js`)))) : read(`js/${n}.js`)))
  .join('\n\n');

/* The replacement text is passed as a FUNCTION on purpose. A plain string
   would let `$$`, `$&`, `` $` `` and `$'` inside the source be interpreted as
   replacement patterns, which silently rewrote `const $$ =` to `const $ =`
   and produced a duplicate-declaration SyntaxError. */
const out = html
  .replace(/<link rel="stylesheet" href="css\/style\.css">\s*<link rel="stylesheet" href="css\/polish\.css">/, () =>
           `<style>\n${css}\n</style>`)
  .replace(/<script src="js\/artpack\.js"><\/script>[\s\S]*?<script src="js\/main\.js"><\/script>/, () =>
           `<script>\n${js}\n</script>`);

if (out.includes('<script src=') || out.includes('stylesheet')) {
  console.error('Bundle still references external files, aborting.');
  process.exit(1);
}

/* A single-file download that still points at art/ paints the crest fallback
   instead of the plate, and does it silently. That is exactly the failure the
   two-tier pack exists to make impossible, so it is a hard stop. */
ONDEMAND_RE.lastIndex = 0;
if (ONDEMAND_RE.test(out)) {
  console.error('Bundle still references art/ URLs, aborting.');
  process.exit(1);
}

/* Same law for the clips: a bundle that points at art/*.mp4 would show a
   broken video element instead of the plate, and would do it silently. */
if (/"art\/[A-Za-z0-9_]+\.mp4"/.test(out)) {
  console.error('Bundle still references art/ video URLs, aborting.');
  process.exit(1);
}

fs.writeFileSync(path.join(here, 'aegis-protocol.html'), out);
console.log('Wrote aegis-protocol.html (' + (out.length / 1024).toFixed(1) + ' KB)');

/* Artifact variant: the host supplies <!doctype>, <html>, <head> and <body>,
   so emit only the page content (title, style, markup, script). */
const inner = out
  .replace(/^[\s\S]*?<title>/, '<title>')
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta[^>]*>\s*/g, '')
  .replace(/<link rel="icon"[^>]*>\s*/, '');

/* The meta strip above takes the charset with it, and the artifact host's own
   <head> is not ours to edit. Served without one, a browser falls back to
   windows-1252 and every ◈ ✦ ♥ ⚔ in the UI turns to mojibake. A charset meta
   inside the body is still honoured by the encoding prescan as long as it
   lands in the first 1024 bytes, so put it back at the very front. */
const withCharset = '<meta charset="utf-8">' + inner;

if (/<\/?(html|head|body)\b/i.test(inner) || /<!DOCTYPE/i.test(inner)) {
  console.error('Artifact variant still contains document-level tags, aborting.');
  process.exit(1);
}
fs.writeFileSync(path.join(here, 'aegis-artifact.html'), withCharset);
console.log('Wrote aegis-artifact.html (' + (withCharset.length / 1024).toFixed(1) + ' KB)');
