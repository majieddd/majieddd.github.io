/* DECIDED vs SHIPPED.
 *
 * The owner caught this exactly: we agreed a fifteen slide human opening and
 * the storyboard was still showing five, because the storyboard renders the
 * GAME and the decision only ever reached a document. A living document that
 * only shows what shipped cannot tell you what is missing.
 *
 * So every decision is a row with a CHECK THAT READS THE CODE. Nothing here is
 * a status somebody typed. If a decision is undone, reverted, or never
 * implemented, its row goes red on the next build without anyone noticing in
 * time to update a note.
 *
 * Adding a decision: write the check first. If you cannot check it cheaply,
 * say so in `manual` and it renders as needing an eye rather than pretending.
 */

const fs = require('fs'), path = require('path');
const ROOT = path.dirname(__dirname);
const src = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; } };

function build(G, artHas) {
  const CUT = G.CUTSCENES || {};
  const HOME = G.GX_HOME_SYSTEMS || {};
  const P = G.PLANET_CUTS || {};
  const U = G.UNIT_TYPES || {};
  const LORE = G.LORE || {};
  const ui = src('js/ui.js'), cm = src('js/commanders.js'), gx = src('js/galaxy.js');

  const intro = f => (CUT[f] && CUT[f].intro) || [];
  const yearOf = d => {
    const s = String(d);
    if (/BCE/i.test(s)) return null;
    const m = s.match(/\b(1[5-9]\d\d|20\d\d|21\d\d)\b/);
    return m ? +m[1] : null;
  };
  const events = (LORE.timeline && LORE.timeline.events) || [];

  const D = [
    { id: 'the fifteen beat human opening', why: 'The act that carries the canon runs longer than the others.',
      check: () => intro('human').length === 15,
      got: () => intro('human').length + ' slides' },

    { id: 'three silent panels in that opening', why: 'The square before, during and after. A caption would narrate what the player is watching.',
      check: () => intro('human').filter(s => !s.text).length === 3,
      got: () => intro('human').filter(s => !s.text).length + ' silent' },

    { id: 'Apophis was never going to hit, then changed course', why: 'A rock ruled harmless that alters course is the whole conspiracy.',
      check: () => /changed course/i.test(intro('human').map(s => s.text).join(' ')) &&
                   /twenty thousand miles|tenth of the way to the Moon/i.test(intro('human').map(s => s.text).join(' ')),
      got: () => 'phrases present in the opening' },

    { id: 'Roswell 1947, and the 1959 Antarctic pact', why: 'Eighty years of arsenal is why a tower defence exists at all.',
      check: () => /1947/.test(intro('human').map(s => s.text).join(' ')) &&
                   /1959/.test(intro('human').map(s => s.text).join(' ')),
      got: () => 'both dates in the opening' },

    { id: 'EARTH is world zero', why: 'The campaign opens on the day the fragments came down; the player must stand there.',
      check: () => HOME.human && HOME.human.worlds[0] === 'EARTH',
      got: () => (HOME.human ? HOME.human.worlds[0] : '?') + ' at wi 0' },

    { id: 'the Free Captains are at PROXIMA CENTAURI', why: 'Also a red flare dwarf, and the closest star to Earth.',
      check: () => HOME.pirate && HOME.pirate.name === 'PROXIMA CENTAURI',
      got: () => (HOME.pirate ? HOME.pirate.name : '?') },

    { id: 'the Parallel are at SIRIUS', why: 'Sirius B is a star that gave up its own form.',
      check: () => HOME.robot && HOME.robot.name === 'SIRIUS',
      got: () => (HOME.robot ? HOME.robot.name : '?') },

    { id: 'the Parallel act ends at THE DOG STAR', why: 'They reach the source of every order and the chairs are empty.',
      check: () => HOME.robot && HOME.robot.worlds[6] === 'THE DOG STAR',
      got: () => (HOME.robot ? HOME.robot.worlds[6] : '?') },

    { id: 'human units are the craft the record argues about', why: 'Most of what was sighted for eighty years was already ours.',
      check: () => Object.values(U).some(u => u.faction === 'human' && u.name === 'TR-3B'),
      got: () => Object.values(U).filter(u => u.faction === 'human').map(u => u.name).join(', ') },

    { id: 'the campaign is set in 2029, not 2099', why: 'The lore dated the war seventy years after the inciting event.',
      check: () => !events.some(e => { const y = yearOf(e.date); return y && y > 2030; }),
      got: () => { const ys = events.map(e => yearOf(e.date)).filter(Boolean);
                   return 'latest event ' + (ys.length ? Math.max.apply(null, ys) : '?'); } },

    { id: 'the timeline reads in order', why: 'It placed 2094 to 2099 immediately before December 1960.',
      check: () => { const ys = events.map(e => yearOf(e.date)).filter(y => y !== null);
                     return !ys.some((y, i) => i && y < ys[i - 1]); },
      got: () => events.length + ' events, sorted' },

    { id: 'every location reads as narration, not a label', why: 'Nobody narrates in noun phrases.',
      check: () => {
        const FIN = /\b(is|are|was|were|has|have|had|came|comes|stands?|runs?|holds?|sits?|lies?|keeps?|goes|makes?|takes?|turns?|burns?|hangs?|locks?|opens?|walks?|leaves?|gives?|throws?|says?|knows?|builds?|drives?|dug|digs?|floats?|cut|cuts|climbs?|rises?|strips?|banks?|tries|moors?|spins?|feeds?|fires?|covers?|seals?|guards?|come|arrived|never)\b/i;
        return Object.values(P).every(e => !e.ground || FIN.test(String(e.ground).split(/[,.;:]/)[0]));
      },
      got: () => Object.keys(P).length + ' worlds checked' },

    { id: 'one reversal per act', why: 'A hero story needs the floor to drop.',
      check: () => ['05', '15', '25', '35', '45'].every(k => P[k]),
      got: () => 'TITAN, STEROPE, ZETA-2 d, THE DARK LOCKER, THE COMPANION' },

    { id: 'the other four powers are locked until Earth is cleared', why: 'Everyone receives the canon in the order it was written.',
      check: () => /earthCleared\s*\(\)\s*\{/.test(cm) && /earthCleared/.test(ui),
      got: () => 'Meta.earthCleared and the faction grid both present' },

    { id: 'the intro hands straight into the first battle', why: 'Four menus between the panic and the fight throw the opening away.',
      check: () => /coldOpen\s*\(\)\s*\{/.test(ui) && /coldOpen\(\)/.test(ui),
      got: () => 'Ui.coldOpen defined and wired' },

    { id: 'humanity opens Earth then Proxima Centauri', why: 'Its road is a story, not a rotation: the nearest star is the one the Saturn door opens onto.',
      check: () => /human:\s*\[0,\s*3,\s*2,\s*1,\s*4\]/.test(gx),
      got: () => 'GX_ACT_ORDER.human = [0,3,2,1,4]: Earth, Proxima, Zeta, Pleiades, Sirius' },

    /* ---- decided, not yet built. These are the rows that matter. ---- */
    { id: 'Proxima and Sirius plates re-rendered', why: 'The art is still Barnard and Tabby under the new text.',
      check: () => { for (const f of ['human', 'light', 'xeno', 'pirate', 'robot'])
                       for (const si of ['3', '4']) for (let wi = 0; wi < 7; wi++)
                         for (let b = 1; b <= 5; b++)
                           if (artHas('pcut_' + si + wi + '_' + f + '_' + b + '.NEW')) return true;
                     return false; },
      got: () => '350 plates still showing the old systems' },

    { id: 'the fifteen opening plates exist', why: 'Ten of them were only written this session.',
      check: () => intro('human').every(s => artHas(s.key + '.webp')),
      got: () => intro('human').filter(s => artHas(s.key + '.webp')).length + ' of ' +
                 intro('human').length + ' rendered' },

    { id: 'beat 5 sometimes shows the watcher, not the flag', why: 'Some acts should end on doubt rather than a planted banner.',
      check: () => false,
      got: () => 'drafted for 23 of 25 acts, none wired into the game yet' },

    { id: 'the five bonus systems exist', why: 'Kepler, Arcturus, Vega, and the two demoted acts.',
      check: () => !!(HOME.bonus || (G.GX_BONUS_SYSTEMS && G.GX_BONUS_SYSTEMS.length)),
      got: () => 'scoped on paper, 12 worlds, not in the galaxy' },
  ];

  return D.map(d => {
    let ok = false, got = '';
    try { ok = !!d.check(); } catch (e) { ok = false; }
    try { got = String(d.got()); } catch (e) { got = ''; }
    return { id: d.id, why: d.why, ok, got };
  });
}

module.exports = { build };
