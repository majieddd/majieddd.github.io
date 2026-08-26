/* Inlines css/ and js/ into a single distributable HTML file.
   Run with:  node build.js   →  writes aegis-protocol.html          */
const fs = require('fs');
const path = require('path');
const here = __dirname;

const read = p => fs.readFileSync(path.join(here, p), 'utf8');

const html = read('index.html');
const css  = read('css/style.css') + String.fromCharCode(10) + read('css/polish.css');
const js   = ['artpack', 'mapgen', 'config', 'factions', 'towers2', 'abilities', 'roster', 'dialogue', 'commanders', 'audio', 'entities', 'entities2', 'ai', 'galaxy', 'game', 'net', 'ui', 'main']
  .map(n => `/* ── ${n}.js ─────────────────────────────────── */\n` + read(`js/${n}.js`))
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
