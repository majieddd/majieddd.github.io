const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const cut = raw.indexOf('\ncleanup');
const js = cut >= 0 ? raw.slice(0, cut) : raw;
const obj = JSON.parse(js);
const KEYRE = /padTop|baseY|targetPlot|groundY|pickedNearest|plotCount|screen|baseDelta|dock|abilities|fps|towersNow|status/i;
for (const r of obj.results) {
  const v = r.value;
  const ev = String(r.eval || '');
  const big = (typeof v === 'string') ? v : JSON.stringify(v);
  if (big && KEYRE.test(big)) console.log('EVAL:', ev.slice(0, 50), '\n  VAL:', big.slice(0, 800), '\n');
}
