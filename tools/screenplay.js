/* THE SCREENPLAY DUMP: one faction's ENTIRE campaign narrative, in true play
   order, as continuous prose a person can read end to end.

   WHY. The campaign's text lives in four modules written across four
   different sessions: the OATH intro (cutscenes.js), the per-world beats
   (planetcuts.js), the per-system STORY beats with named speakers (story.js),
   and THE TURNING interstitials (cutscenes.js again). Each was verified in
   isolation. Nobody, human or model, had ever READ one faction's campaign the
   way a player receives it: interleaved, in order, across all four layers.
   The Session 39 arc audit (probe 39.29-39.32) checks structural invariants;
   this emits the actual text so the FLOW can be judged, which no invariant
   can do.

   PLAY ORDER, verified against the call sites rather than assumed:
     campaign start   -> OATH intro, then STORY beat 0, THE DEPARTURE
                         (ui.js faction-go handler; moved there Session 40
                         after this tool showed "Set course for Luna"
                         rendering AFTER Luna had fallen)
     each world       -> beats 1-3, battle, beats 4-5 on a 1+ star win
     seat falls       -> result screen carries the STORY beat for
                         (systems taken - 1); index 0 suppressed there
     leaving for map  -> THE TURNING act for that system (ui.js:421)
     campaign end     -> STORY beat 5, THE MAELSTROM

   Usage: node tools/screenplay.js [faction]   (default: all five)
   Writes _review/screenplay_<faction>.md, gitignored scratch. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
/* config first: roster and galaxy read its constants at load. lore before
   dialogue: canonExchange reads LORE.relationships. */
for (const f of ['config', 'lore', 'factions', 'galaxy', 'story', 'cutscenes', 'planetcuts', 'roster', 'dialogue'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });

/* Top-level `const` inside runInContext does NOT attach to the context
   object -- the skill's own measured-trap table records this one, and this
   file hit it anyway on its first run. Evaluate an expression IN the context
   to lift the bindings out. */
const { GX_UNIVERSE_ORDER, GX_HOME_SYSTEMS, GX_V2_HOLDER, CUTSCENES, PLANET_CUTS, STORY,
        STORY_ACTS, COMMANDER_ROSTER, FACTIONS } = vm.runInContext(
  '({ GX_UNIVERSE_ORDER, GX_HOME_SYSTEMS, GX_V2_HOLDER, CUTSCENES, PLANET_CUTS, STORY, ' +
  'STORY_ACTS, COMMANDER_ROSTER, FACTIONS })', ctx);
const BEATS = ['APPROACH', 'THE GROUND', 'THE ASSAULT', 'AFTERMATH', 'NEW ORDER'];
const facName = id => (FACTIONS[id] && FACTIONS[id].name) || id;
const cmdName = id => {
  const c = COMMANDER_ROSTER.find(x => x.id === id);
  return c ? (c.name + ', ' + c.title) : id.toUpperCase();
};

function screenplay(fac) {
  const home = GX_UNIVERSE_ORDER.indexOf(fac);
  const out = [];
  const w = s => out.push(s);
  w('# ' + facName(fac).toUpperCase() + ': THE COMPLETE CAMPAIGN, IN PLAY ORDER');
  w('');
  w('## THE OATH (campaign start)');
  CUTSCENES[fac].intro.forEach((s, i) => { w(''); w('**' + (i + 1) + '.** ' + s.text); });
  const dep = STORY[fac][0];
  w(''); w('#### STORY BEAT: ' + STORY_ACTS[0].name + '  (interstitial, after the oath)');
  w('*' + cmdName(dep.speaker) + (dep.title ? ' -- "' + dep.title + '"' : '') + ':*');
  w('> ' + dep.line);
  if (dep.reveal) w('> *REVEAL: ' + dep.reveal + '*');

  for (let tier = 0; tier < 5; tier++) {
    const si = (home + tier) % 5;
    const sysFac = GX_UNIVERSE_ORDER[si];
    const sys = GX_HOME_SYSTEMS[sysFac];
    const holder = GX_V2_HOLDER[sysFac][fac];
    w(''); w('---'); w('');
    w('## ACT ' + (tier + 1) + ': ' + sys.name + '  (garrisoned by ' + facName(holder) + ')');
    for (let wi = 0; wi < 7; wi++) {
      const e = PLANET_CUTS['' + si + wi];
      const L = e.f[fac];
      w(''); w('### ' + e.name + (wi === 6 ? '  [THE SEAT]' : ''));
      w('');
      w('**' + BEATS[0] + '.** ' + L[0]);
      w('**' + BEATS[1] + '.** ' + e.ground + ' *' + facName(holder) + ' hold this ground.*');
      w('**' + BEATS[2] + '.** ' + e.works);
      w('*[ battle ]*');
      w('**' + BEATS[3] + '.** ' + L[1]);
      w('**' + BEATS[4] + '.** ' + L[2]);
    }
    /* The seat fell: story beat for (taken-1), then the turning. Index 0
       plays at campaign start instead, so seat 1 carries no beat card. */
    if (tier > 0) {
      const beat = STORY[fac][tier];
      w(''); w('#### STORY BEAT: ' + STORY_ACTS[tier].name + '  (result screen)');
      w('*' + cmdName(beat.speaker) + (beat.title ? ' -- "' + beat.title + '"' : '') + ':*');
      w('> ' + beat.line);
      if (beat.reveal) w('> *REVEAL: ' + beat.reveal + '*');
    }
    const t = CUTSCENES[fac].sys[tier];
    w(''); w('#### THE TURNING  (interstitial)');
    w('> ' + t.a); w('>'); w('> ' + t.b);
  }
  w(''); w('---'); w('');
  w('## CAMPAIGN MOMENTS  (state-triggered, any world)');
  [['seat', 'Deploying to a commander SEAT, the act climax (beat 1 voice)'],
   ['contested', 'Deploying to a CONTESTED world (beat 1 voice)'],
   ['renegade', 'Deploying against your OWN banner (beat 1 voice)'],
   ['retaken', 'Deploying to a world you took and a rival took back (beat 1 voice)'],
   ['flawless', 'A THREE-STAR conquest (replaces the AFTERMATH voice)'],
   ['defeat', 'A campaign battle LOST (one slide before the result screen)']]
    .forEach(([k, label]) => {
      const m = vm.runInContext('PLANET_MOMENTS[' + JSON.stringify(k) + '][' + JSON.stringify(fac) + ']', ctx);
      w(''); w('**' + label + '.**'); w('> ' + m);
    });

  const fin = STORY[fac][5];
  w(''); w('---'); w('');
  w('## FINALE: ' + STORY_ACTS[5].name);
  w('*' + cmdName(fin.speaker) + (fin.title ? ' -- "' + fin.title + '"' : '') + ':*');
  w('> ' + fin.line);
  if (fin.reveal) w('> *REVEAL: ' + fin.reveal + '*');
  return out.join('\n');
}

const want = process.argv[2] ? [process.argv[2]] : GX_UNIVERSE_ORDER;
fs.mkdirSync(path.join(ROOT, '_review'), { recursive: true });
for (const fac of want) {
  const p = path.join(ROOT, '_review', 'screenplay_' + fac + '.md');
  const text = screenplay(fac);
  fs.writeFileSync(p, text);
  console.log(p, text.length, 'chars');
}
