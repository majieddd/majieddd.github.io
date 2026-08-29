/* HIGHPOLY :: build
   Fuses index.html, the stylesheet and the fifteen modules into ONE
   self-contained HTML file that runs from file:// with no server and no
   network.

   WHY A SINGLE FILE. The whole point of the zero-dependency constraint is that
   the artifact is portable: one file you can mail, drop on any static host, or
   open from a USB stick. Fifteen script tags and a stylesheet are not that.

   WHAT IT REFUSES TO SHIP:
     - a module that does not parse
     - a module listed here but missing from disk, or on disk but missing here
       (the second is the one that actually happens, and it ships a game with a
       silently absent system)
     - any surviving <script src= or <link rel=stylesheet, which would mean the
       inlining did not happen and the file is not self-contained at all

   The Google Fonts link IS intentionally left as a network reference, and the
   font stack has real local fallbacks, so the file still renders correctly
   offline. That is the one exception and it is checked for explicitly rather
   than allowed by a loose regex. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'cosmic-highpoly.html');

/* The module list is DERIVED from disk and then cross-checked against the
   order in index.html, rather than restated here. A hand-maintained list is
   how a module gets added to the folder and never to the build. */
const jsDir = path.join(ROOT, 'js');
const onDisk = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const scriptRe = /<script\s+src="js\/([^"]+)"\s*><\/script>\s*/g;
const referenced = [];
let m;
while ((m = scriptRe.exec(html)) !== null) referenced.push(m[1]);

const missingFromHtml = onDisk.filter(f => referenced.indexOf(f) === -1);
const missingFromDisk = referenced.filter(f => onDisk.indexOf(f) === -1);
if (missingFromHtml.length) {
  console.error('BUILD FAILED: on disk but not in index.html: ' + missingFromHtml.join(', '));
  process.exit(1);
}
if (missingFromDisk.length) {
  console.error('BUILD FAILED: in index.html but not on disk: ' + missingFromDisk.join(', '));
  process.exit(1);
}

/* Parse every module before inlining. A syntax error inside a concatenated
   file reports a line number that means nothing. */
const { execFileSync } = require('child_process');
for (const f of referenced) {
  try {
    execFileSync(process.execPath, ['--check', path.join(jsDir, f)], { encoding: 'utf8' });
  } catch (e) {
    console.error('BUILD FAILED: ' + f + ' does not parse');
    console.error((e.stdout || '') + (e.stderr || ''));
    process.exit(1);
  }
}

/* Inline the stylesheet. */
const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/,
  '<style>\n' + css + '\n</style>');

/* Inline the modules, in the order index.html lists them. Concatenating in
   directory order instead would work today only because the filenames are
   numbered, and would break silently the first time one is renamed. */
let bundle = '';
for (const f of referenced) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  bundle += '\n/* ===== ' + f + ' ===== */\n' + src + '\n';
}

/* Replace the first script tag with the bundle and delete the rest. */
let first = true;
html = html.replace(scriptRe, () => {
  if (first) { first = false; return '<script>\n' + bundle + '\n</script>\n'; }
  return '';
});

/* Post-conditions. These are the two things the published site's own workflow
   checks, asserted here so a broken bundle never reaches it. */
if (/<script\s+src=/.test(html)) {
  console.error('BUILD FAILED: a <script src= survived inlining');
  process.exit(1);
}
if (/<link[^>]+rel="stylesheet"[^>]+href="css\//.test(html)) {
  console.error('BUILD FAILED: a local stylesheet link survived inlining');
  process.exit(1);
}
const externalScripts = html.match(/<script[^>]+src="https?:/g);
if (externalScripts) {
  console.error('BUILD FAILED: external script reference: ' + externalScripts.join(', '));
  process.exit(1);
}

const DASH = String.fromCharCode(8212);
if (html.indexOf(DASH) >= 0) {
  console.error('BUILD FAILED: an em dash reached the bundle');
  process.exit(1);
}

fs.writeFileSync(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('WROTE ' + path.basename(OUT) + '  ' + kb + ' KB  ' +
  referenced.length + ' modules  ' + (css.length / 1024).toFixed(1) + ' KB css');
