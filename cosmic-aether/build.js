/* AETHER :: build
   Fuses index.html, the stylesheet and the sixteen modules into ONE
   self-contained HTML file that runs from file:// with no server and no
   network.

   Same contract as the reliquary build it descends from:
     - refuses to ship a module that does not parse
     - refuses to ship a module listed here but missing from disk, or on disk
       but missing here
     - asserts no surviving <script src= or local stylesheet link
     - asserts no em dash anywhere in the bundle
   The Google Fonts link is the one intentional network reference. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'cosmic-aether.html');

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

const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/,
  '<style>\n' + css + '\n</style>');

let bundle = '';
for (const f of referenced) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  bundle += '\n/* ===== ' + f + ' ===== */\n' + src + '\n';
}

let first = true;
html = html.replace(scriptRe, () => {
  if (first) { first = false; return '<script>\n' + bundle + '\n</script>\n'; }
  return '';
});

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
const NDASH = String.fromCharCode(8211);
if (html.indexOf(DASH) >= 0 || html.indexOf(NDASH) >= 0) {
  console.error('BUILD FAILED: an em/en dash reached the bundle');
  process.exit(1);
}

fs.writeFileSync(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('WROTE ' + path.basename(OUT) + '  ' + kb + ' KB  ' +
  referenced.length + ' modules  ' + (css.length / 1024).toFixed(1) + ' KB css');
