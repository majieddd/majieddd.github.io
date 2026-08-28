/* DOES probe-s39 ACTUALLY CATCH ANYTHING?

   The suite's standing law: a gate that only ever passes has demonstrated
   nothing. probe-s39 went green 26 times in a row across this session, and it
   was ALSO silently green through two false-green bugs of its own, so its word
   is worth exactly as much as its detection rate. This measures the rate.

   Each mutant plants ONE defect in live page state, re-runs the whole probe,
   and asserts that the PREDICTED check went red and that the control run was
   green. Nothing here touches a file: every plant is an in-memory swap with a
   restore in a finally, so a killed run cannot leave the page poisoned.

   The probe source is fetched with a SYNCHRONOUS XHR on purpose. run_harness
   wants a value, not a promise, and a sync fetch keeps this whole file one
   expression. It is a test harness talking to its own origin, which is the one
   place that deprecation does not matter.

   Returns { pass, fail, checks:[...] } in the same shape as the probe itself.
*/
(() => {
  const SRC = (() => {
    const x = new XMLHttpRequest();
    x.open('GET', 'tools/probe-s39.js', false);
    x.send(null);
    if (x.status !== 200) throw new Error('cannot fetch probe-s39.js: ' + x.status);
    return x.responseText;
  })();

  /* eslint-disable no-eval */
  const runProbe = () => (0, eval)(SRC);

  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });

  /* The control has to be green or every mutant below is meaningless: a probe
     that is already failing would "detect" a defect it cannot see. */
  const control = runProbe();
  record('M0 control run is green before any defect is planted',
         control.fail === 0,
         'pass=' + control.pass + ' fail=' + control.fail +
         (control.fail ? ' :: ' + control.checks.filter(c => !c.ok).map(c => c.name).join(', ') : ''));

  const MUTANTS = [
    {
      id: 'M1', expect: '39.6',
      what: 'two worlds share a faction line, the text form of the hue tint',
      plant() {
        const a = PLANET_CUTS['00'].f.human, b = PLANET_CUTS['01'].f.human;
        const was = b[0]; b[0] = a[0];
        return () => { b[0] = was; };
      },
    },
    {
      id: 'M2', expect: '39.4',
      what: 'an authored world name drifts from GX_HOME_SYSTEMS',
      plant() {
        const e = PLANET_CUTS['06'], was = e.name;
        e.name = 'THE MOON';
        return () => { e.name = was; };
      },
    },
    {
      id: 'M3', expect: '39.5',
      what: 'a faction cell loses one of its three lines',
      plant() {
        const e = PLANET_CUTS['23'].f, was = e.pirate;
        e.pirate = [was[0], was[1]];
        return () => { e.pirate = was; };
      },
    },
    {
      id: 'M4', expect: '39.16',
      what: 'a planet beat falls back to a world plate the pack does not carry',
      plant() {
        const real = UI.worldSlides.bind(UI);
        UI.worldSlides = w => real(w).map(s => Object.assign({}, s, { alt: 'world_does_not_exist' }));
        return () => { UI.worldSlides = real; };
      },
    },
    {
      id: 'M5', expect: '39.12',
      what: 'the outro stops being gated on stars, so a zero-star win plays it',
      plant() {
        const real = UI.outroSlides.bind(UI);
        UI.outroSlides = (w, won, stars) => real(w, won, Math.max(1, stars | 0));
        return () => { UI.outroSlides = real; };
      },
    },
    {
      id: 'M6', expect: '39.14',
      what: 'showEnd opens the result screen twice, once behind the overlay',
      plant() {
        const real = UI.showEnd.bind(UI);
        UI.showEnd = won => { real(won); UI.showEndScreen(won); };
        return () => { UI.showEnd = real; };
      },
    },
    {
      id: 'M7', expect: '39.21',
      what: 'a commander loses the answer that keeps them off the faction pool',
      plant() {
        const was = DIALOGUE.answers.vess;
        delete DIALOGUE.answers.vess;
        return () => { DIALOGUE.answers.vess = was; };
      },
    },
    {
      id: 'M8', expect: '39.23',
      what: 'the fallback reverts to answering with a faction slogan',
      plant() {
        const was = DIALOGUE.answers.vess;
        DIALOGUE.answers.vess = DIALOGUE.replies.human[0];
        return () => { DIALOGUE.answers.vess = was; };
      },
    },
    {
      id: 'M9', expect: '39.9',
      what: 'the three deploy beats collapse onto one shared plate, the exact defect this feature replaced',
      plant() {
        const real = UI.worldSlides.bind(UI);
        UI.worldSlides = w => {
          const s = real(w);
          return s.map(x => Object.assign({}, x, { key: s[0].key }));
        };
        return () => { UI.worldSlides = real; };
      },
    },
    {
      id: 'M11', expect: '39.30',
      what: 'the pirate arc closes act 3 and act 5 on the same line, as it did before Session 39 fixed it',
      plant() {
        const e = PLANET_CUTS['26'].f.pirate, was = e[2];
        /* The literal line that shipped, restored. Act 3 on LUNA already ends
           "Some things you do not sell." */
        e[2] = 'Serpo is rebuilt and the manifest is nailed to the gate. Twelve names, ' +
               'three seals, and no bidding. Some things you do not sell.';
        return () => { e[2] = was; };
      },
    },
    {
      id: 'M12', expect: '39.31',
      what: 'a faction claims a world it is invading',
      plant() {
        const e = PLANET_CUTS['16'].f.human, was = e[2];
        e[2] = 'Alcyone is ours again, our own cathedral, and the seat is gone.';
        return () => { e[2] = was; };
      },
    },
    {
      id: 'M14', expect: '39.32',
      what: 'a TURNING act names a system the player has not reached at that act',
      plant() {
        const a = CUTSCENES.human.sys[2], was = a.a;
        a.a = 'The Pleiades stand secured and the seats fall one by one.';
        return () => { a.a = was; };
      },
    },
    {
      id: 'M15', expect: '39.34',
      what: 'a premature defeat claim returns to a turning slide',
      plant() {
        const sl = CUTSCENES.pirate.sys[2], was = sl.a;
        sl.a = 'The Chorus, beaten, left us a sentence instead of a surrender.';
        return () => { sl.a = was; };
      },
    },
    {
      id: 'M16', expect: '39.33',
      what: 'seat 1 renders THE DEPARTURE again, an act after it played',
      plant() {
        const real = UI.storyBeatHtml.bind(UI);
        const realC = Meta.campaign;
        UI.storyBeatHtml = function () {
          const c = Meta.campaign();
          const taken = ((c && c.systemsTaken) || []).length;
          if (!taken) return '';
          return this.storyBeatCard(Story.beat((c && c.faction) || 'human', taken - 1), false);
        };
        return () => { UI.storyBeatHtml = real; Meta.campaign = realC; };
      },
    },
    {
      id: 'M17', expect: '39.35',
      what: 'a defeat line goes missing for one power',
      plant() {
        const t = PLANET_MOMENTS.defeat, was = t.pirate;
        delete t.pirate;
        return () => { t.pirate = was; };
      },
    },
    {
      id: 'M18', expect: '39.36',
      what: 'the renegade approach falls back to the ordinary line',
      plant() {
        const t = PLANET_MOMENTS.renegade, was = t.human;
        delete t.human;
        return () => { t.human = was; };
      },
    },
    {
      id: 'M10', expect: '39.18',
      what: 'the gallery quietly drops a planet slot',
      /* The first version stripped only gal-missing tiles, which made the
         mutant a NO-OP the moment the render finished: with all 875 plates
         rendered there is nothing carrying that class, the regex removed
         nothing, and M10 reported UNDETECTED against a check that was fine.
         A mutant that depends on transient world-state is a mutant that
         expires; this one now drops the first tile unconditionally, which is
         the same defect (a slot silently missing) in a form that exists at
         every stage of a render. */
      plant() {
        const real = UI.galleryPlanetHtml.bind(UI);
        UI.galleryPlanetHtml = () => real().replace(/<figure class="gal-tile[^"]*">[\s\S]*?<\/figure>/, '');
        return () => { UI.galleryPlanetHtml = real; };
      },
    },
  ];

  MUTANTS.forEach(m => {
    let restore = () => {};
    let res = null;
    try {
      restore = m.plant() || (() => {});
      res = runProbe();
    } catch (e) {
      record(m.id + ' ' + m.what, false, 'the plant itself threw: ' + e.message);
      try { restore(); } catch (e2) { /* best effort, the plant already failed */ }
      return;
    }
    try { restore(); } catch (e) { record(m.id + ' restore', false, e.message); }

    const failed = res.checks.filter(c => !c.ok).map(c => c.name);
    const hitPredicted = failed.some(n => n.indexOf(m.expect) === 0);
    if (!failed.length) {
      record(m.id + ' ' + m.what, false, 'UNDETECTED: probe stayed green with the defect planted');
    } else if (!hitPredicted) {
      record(m.id + ' ' + m.what, false,
             'caught by the WRONG check: expected ' + m.expect + ', got ' + failed.join(', '));
    } else {
      record(m.id + ' ' + m.what, true, 'caught by ' + m.expect + ' (' + failed.length + ' red)');
    }
  });

  /* The restores have to actually restore, or a later session inherits a page
     that lies. Re-run the control and require it green again. */
  const after = runProbe();
  record('M13 every plant was restored and the probe is green again',
         after.fail === 0,
         'pass=' + after.pass + ' fail=' + after.fail +
         (after.fail ? ' :: ' + after.checks.filter(c => !c.ok).map(c => c.name).join(', ') : ''));

  const pass = checks.filter(c => c.ok).length;
  return { pass, fail: checks.length - pass, checks };
})()
