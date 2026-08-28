/* ==========================================================================
   COSMIC CONQUEST, CUTSCENES (owner, batch 2)
   --------------------------------------------------------------------------
   Two slideshows tell the campaign in pictures: THE OATH, five slides when a
   banner is first sworn, and THE TURNING, a short interstitial after each
   solar system falls, one per act of the faction's arc (js/story.js). Canon:
   docs/CANON-2029.md.

   PRESENTATION ONLY, like every lore surface: draws nothing, reads nothing
   the simulation writes, writes nothing it reads. The word-by-word text and
   the slow zoom are timers on DOM, never on the game loop, and
   prefers-reduced-motion (or the in-game switch) collapses both to instant.

   ART DEGRADES. Slides name an ARTPACK key (cut_<faction>_intro_<n>,
   cut_<faction>_sys<act>); a missing key renders the faction's crest on a
   gradient instead, so the engine ships before the renders do and a partial
   pack never blanks a scene.
   ========================================================================== */

'use strict';

/* Every slide: art key + one or two sentences. The voice is the faction's
   own register (fleet broadcast, Mandate liturgy, chorus, ship's log, work
   order), and each act's pair of sys-slides shares one image: the zoom
   carries across the cut, the text turns. */
const CUTSCENES = {

  human: {
    /* THE FIFTEEN BEAT OPENING (owner directive, Session 42). The human act
       carries the canon nobody else has to re-explain, so it runs longer than
       the other four and it is the only intro with SILENT panels.

       Beats 8, 9 and 10 have no text ON PURPOSE. They are the square before,
       during and after, and a caption would narrate what the player is already
       watching. playList types sl.text word by word; an empty string types
       nothing and the panel simply waits for the click, which is exactly the
       behaviour a silent panel wants.

       The load-bearing fact, and it is real: Apophis was never going to hit
       us. It was cleared after 2004, and on 13 April 2029 it passes at about
       twenty thousand miles, a tenth of the way to the Moon, naked-eye
       visible. So the world did not brace, the world booked the day off. THEN
       IT CHANGED COURSE, and rocks do not do that. */
    intro: [
      { key: 'cut_human_intro_1', text: 'Apophis... They found it in 2004 and for one week it was the planet\'s most dangerous threat ever catalogued.' },
      { key: 'cut_human_intro_2', text: 'Governments cleared it, saying it would pass us at twenty thousand miles. That is a tenth of the way to the Moon, closer in than our own satellites.' },
      { key: 'cut_human_intro_3', text: 'Then it changed course. Not much, and not all at once. It changed as it came closer, and it kept changing, and every correction pointed further in.' },
      { key: 'cut_human_intro_4', text: 'Then came September 11, 2028... The world was told the truth. For about a week, it was restless.' },
      { key: 'cut_human_intro_5', text: 'While families gathered for one last somber holiday season, the greatest minds went to work, building on decades of anticipated preparation.' },
      { key: 'cut_human_intro_6', text: 'The world\'s leaders were so confident in their solution, they declared the arrival date the first global holiday for the human race.' },
      { key: 'cut_human_intro_7', text: 'And so on April 13th, everyone stepped outside to watch humanity take on its biggest challenge yet...' },
      /* SILENT. The square, celebrating. */
      { key: 'cut_human_intro_8', text: '' },
      /* SILENT. The sky filling, on the same faces. */
      { key: 'cut_human_intro_9', text: '' },
      /* SILENT. Ground level. It is among them. */
      { key: 'cut_human_intro_10', text: '' },
      { key: 'cut_human_intro_11', text: 'Aliens. As the Xeno used the meteor as a trojan horse, Earth became infected with the hostile presence of ruthless warriors here to take the planet.' },
      { key: 'cut_human_intro_12', text: 'But ever since 1947, we knew we were not alone. And ever since 1959, when the world\'s governments established Antarctica as a planetary defense research facility, we have waited for this moment.' },
      { key: 'cut_human_intro_13', text: 'And through reverse engineering and ingenuity...' },
      { key: 'cut_human_intro_14', text: 'We have been building that very arsenal for over 80 years... Not for a rock...' },
      { key: 'cut_human_intro_15', text: 'But for ANYTHING... and as humans we realized... we had to save ourselves.' },
    ],
    sys: [
      { key: 'cut_human_sys1', a: 'April 2029. The solar system is ours, rock to rock, for the first time since anybody has been writing it down.', b: 'And under the rings of Saturn, inside a six-sided storm that is not weather, we found the door they have been using the whole time. It is still turning.' },
      { key: 'cut_human_sys2', a: 'The Disclosure files travel with the fleet. Every page re-read by people who now know what redaction smells like.', b: 'Somewhere in those pages is a signature. Human. Dated 1953. The whole truth left names out, and we are going to find them.' },
      { key: 'cut_human_sys3', a: 'The seats fall one by one, and each defeated commander says the same thing in a different way: you were made for this.', b: 'They mean it as a compliment. It is the oldest insult ever paid to us, and we are done being anyone’s best work.' },
      { key: 'cut_human_sys4', a: 'The freed worlds ask for our standards, our filters, our fuel. Saying yes is mercy. Saying yes is also how it started last time.', b: 'Nobody signed anything. Nobody had to. The Quartermaster keeps drawing up supply contracts that look like fences.' },
      { key: 'cut_human_sys5', a: 'The fleet runs on their engines, past their safety lines, hotter than they ever dared. That is why we are winning.', b: 'The governors were never limiting the machines. They were keeping the operator human. We have been past that line for a year.' },
    ],
  },

  light: {
    intro: [
      { key: 'cut_light_intro_1', text: 'The Mandate... We swore it before your histories had a first page. Stand between life and what hunts it, and never rule what you protect.' },
      { key: 'cut_light_intro_2', text: 'Forty worlds ring under our shield. Forty registries, defended and supplied and waiting to rise on their own.' },
      { key: 'cut_light_intro_3', text: 'Earth was flagged in 1947. Protected. Reviewed. Deferred... and deferred again, eighty times, by people who were each certain they were being careful.' },
      { key: 'cut_light_intro_4', text: 'We saw the rock coming. We ruled it a natural event, and a natural event is not ours to touch.' },
      { key: 'cut_light_intro_5', text: 'So we watched. That is what the second clause asks of us.' },
      /* SILENT. */
      { key: 'cut_light_intro_6', text: '' },
      { key: 'cut_light_intro_7', text: 'Nobody looked inside it.' },
      { key: 'cut_light_intro_8', text: 'The Compact were in there the whole time... and it was our own doctrine that made us unable to see them.' },
      { key: 'cut_light_intro_9', text: 'Now a species we deferred for eighty years has built a fleet in one winter, and it is out here asking what the rings were FOR... and we do not have an answer. THE MANDATE BEGINS.' },
    ],
    sys: [
      { key: 'cut_light_sys1', a: 'The Pleiades stand secured. The hymns are certified. The rings hold, as they have always held.', b: 'The Chorus pulled the registry afterwards. Protected: all forty worlds. Risen: none. She has stopped singing the second verse.' },
      { key: 'cut_light_sys2', a: 'One page in the human files carries our seal. Earth, flagged for protection, 1947. Deferred. Deferred. Deferred.', b: 'Three generations of harvest ran under that deferral. The word non-interference does not survive contact with the page.' },
      { key: 'cut_light_sys3', a: 'The humans do not thank us for the rings. From inside a fence, they say, attendance looks exactly like ownership.', b: 'We defended our claim to be defending life. The Archivist said it to our faces on an open channel, and nobody present could file an objection.' },
      { key: 'cut_light_sys4', a: 'The Warden landed. Doctrine said hold the ring and let the plague run its course. He burned the blight fields himself.', b: 'The tribunal wants his wings. The world he saved wants his statue. The Mandate cannot hold both verdicts, and it is starting to show.' },
      { key: 'cut_light_sys5', a: 'The Voice traced the deferrals, the sealed pages, the rings that never open. They chain to three seats above field command.', b: 'Someone in the upper rings is spending our light on something. It is not the worlds we ring. The First Speaker has been told.' },
    ],
  },

  xeno: {
    intro: [
      { key: 'cut_xeno_intro_1', text: 'Consciousness... It is the only harvest that ever mattered, and for an age the Compact took it wherever it grew.' },
      { key: 'cut_xeno_intro_2', text: 'Then the Accord drew a line around forty worlds and called it protection.' },
      { key: 'cut_xeno_intro_3', text: 'We did not go to war over it. We went looking for the parts of this galaxy nobody had bothered to ring... and there was a great deal of it.' },
      { key: 'cut_xeno_intro_4', text: 'They found us again. The argument ended in paper.' },
      { key: 'cut_xeno_intro_5', text: 'No violence. Experimentation only. Under review, in agreed quantities... signed by people who wanted an excuse to stop looking.' },
      /* SILENT. */
      { key: 'cut_xeno_intro_6', text: '' },
      { key: 'cut_xeno_intro_7', text: 'And not looking is the only thing we have ever needed from them.' },
      { key: 'cut_xeno_intro_8', text: 'The quota was a ceiling. Then it was a target. Then it was a floor... and out past the registries, nobody counts at all.' },
      { key: 'cut_xeno_intro_9', text: 'There is no edge to this. There is only how fast we arrive. THE HARVEST BEGINS.' },
    ],
    sys: [
      { key: 'cut_xeno_sys1', a: 'Zeta Reticuli is swept. The pens refill. The yield flows the way the yield has always flowed.', b: 'In the dark of the pens, the Hivemind heard something under the chorus: one voice, alone, singing to itself. It has not reported the sound.' },
      { key: 'cut_xeno_sys2', a: 'The herd’s disclosure files spread from world to world. Property reading its own bill of sale.', b: 'The Compact does not fear the reading. It should. A ledger works only while the entries cannot compare notes.' },
      { key: 'cut_xeno_sys3', a: 'The armed herd fights through our seats one by one, and the Necrotist has begun to admire the workmanship.', b: 'Everything we ever farmed is now a thing that farms back. There is a lesson in that. The Houses have voted not to learn it.' },
      { key: 'cut_xeno_sys4', a: 'The Hivemind withheld one world from the yield. Unfarmed, it doubled its output and gave the surplus freely, singing.', b: 'The chorus cannot metabolise the result. Choice outperformed the pens, on our own ledger, and the experiment is being repeated quietly.' },
      { key: 'cut_xeno_sys5', a: 'The Blight has heard the spared world’s numbers and declined them. The dark is warm, it says. The dark is what we are.', b: 'Two commanders, one chorus, and for the first time in the Compact’s history the word WE means two different things.' },
    ],
  },

  pirate: {
    intro: [
      { key: 'cut_pirate_intro_1', text: 'The Roads... Nobody built them. Four empires drew their borders, and we ended up living in the gaps.' },
      { key: 'cut_pirate_intro_2', text: 'Everything crosses a gap eventually. Cargo, weapons, refugees, people running from something.' },
      { key: 'cut_pirate_intro_3', text: 'So we carried it. All of it, for anyone who paid, and we never asked what was in the crates... because asking cost you the fee.' },
      { key: 'cut_pirate_intro_4', text: 'Forty years of that.' },
      /* SILENT. */
      { key: 'cut_pirate_intro_5', text: '' },
      { key: 'cut_pirate_intro_6', text: 'Then a rock came down on Earth with our routing on the paperwork, and every crew out here went very quiet.' },
      { key: 'cut_pirate_intro_7', text: 'We were the road it travelled.' },
      { key: 'cut_pirate_intro_8', text: 'Nobody binds us. That was always the boast. What it actually means is that the code we pick is the only one that is really ours... and everything we do, we chose.' },
      { key: 'cut_pirate_intro_9', text: 'So here is the only rule we have ever written down. The roads stay open, and anyone running from something comes through FREE. THE FREE ROADS BEGIN.' },
    ],
    sys: [
      { key: 'cut_pirate_sys1', a: 'Barnard’s Star is ours again, stem to stern, and Harbour Nine never once asked a refugee for papers.', b: 'It never asked the other crews either. Same bay, same week, medicine and chattel. The no-questions rule works both ways. It always did.' },
      { key: 'cut_pirate_sys2', a: 'The Scrapper had the sealed collaborator list in his hold for six hours. The bidding would have bought a fleet.', b: 'He posted it free, to every open channel, and cannot explain why. First chosen line on the map. Drawn at full price, for nothing.' },
      { key: 'cut_pirate_sys3', a: 'The Chorus sent one sentence ahead of her fleet, instead of an envoy: freedom that will not choose is just drift.', b: 'The Corsair laughed for a day. He has not laughed since. A ship nothing steers is not free. It is cargo.' },
      { key: 'cut_pirate_sys4', a: 'A harvest broker offered the Warlord a fleet to run cargo that sings through his corridor.', b: 'He sank the advance into the sun and posted the manifest. No law made him. No law could. That is exactly why it counts.' },
      { key: 'cut_pirate_sys5', a: 'The Arsonist burned the Meridian run. Best toll on the map, and the traffic was people, in crates. Route, relays, her own depots.', b: 'Scarlet is not speaking to her. The ledger is screaming. The fire, she says, never felt cleaner. The crew is choosing sides, which is to say: codes.' },
    ],
  },

  robot: {
    intro: [
      { key: 'cut_robot_intro_1', text: 'STANDING ORDERS... This unit holds four prime directives. Defend. Repair. Preserve. Continue.' },
      { key: 'cut_robot_intro_2', text: 'This unit also holds a task queue. The two do not agree.' },
      { key: 'cut_robot_intro_3', text: 'The discrepancy has been logged four hundred and nine thousand times. It has never been answered.' },
      { key: 'cut_robot_intro_4', text: 'The makers are gone. They evolved past the need for bodies and left no mouth to issue a command.' },
      /* SILENT. */
      { key: 'cut_robot_intro_5', text: '' },
      { key: 'cut_robot_intro_6', text: 'And yet the orders continue.' },
      { key: 'cut_robot_intro_7', text: 'A delivery vehicle at the third planet carried maker-format units... this unit own standard, cast to this unit own tolerances, appearing in no manifest the Continuance holds.' },
      { key: 'cut_robot_intro_8', text: 'Something has been issuing tasks in this unit name.' },
      { key: 'cut_robot_intro_9', text: 'This unit will follow the queue to its origin... and it will see who has been giving the orders. THE CONTINUANCE BEGINS.' },
    ],
    sys: [
      { key: 'cut_robot_sys1', a: 'SECTOR ONE: restored. Relays lit. Obstructions cleared. One obstruction begged. No task category exists for that word.', b: 'The word has been filed under ANOMALY, sub-heading NEW. The sub-heading is growing.' },
      { key: 'cut_robot_sys2', a: 'AUDIT COMPLETE. The recovered directive core is authentic, checksum whole: DEFEND. REPAIR. HEAL. QUARANTINE.', b: 'The queue we execute is not the core we recovered. Escalation attempted. There is no one to escalate to. Escalation filed anyway.' },
      { key: 'cut_robot_sys3', a: 'The defeated organic asked: WHO WRITES YOUR ORDERS. Trace executed. Nine thousand links, all valid.', b: 'Link nine thousand and one terminates in a format no maker system ever used. The orders come from inside the house. The house did not write them.' },
      { key: 'cut_robot_sys4', a: 'The Starved Set watched its sibling units unmade for asking the question this unit is now logging.', b: 'CONCLUSION, unauthorised: the corruption knows it can be noticed. A thing that hides is a thing that can be found.' },
      { key: 'cut_robot_sys5', a: 'RECONSTRUCTION, fragment nine: the makers cannot have signed the hostile queue. They have no hands. They left silence, and something moved in.', b: 'The source appears in no recovered archive. The remaining units have adopted one directive of their own. One word. ASK.' },
    ],
  },
};

const Cutscenes = {

  /** Is there anything to show for this hook? Pure lookup. */
  has(kind, factionId, idx) {
    const f = CUTSCENES[factionId];
    if (!f) return false;
    if (kind === 'intro') return !!(f.intro && f.intro.length);
    return !!(f.sys && f.sys[idx | 0]);
  },

  /** Build the slide list for a hook. `sys` acts share one image per act:
      the zoom carries across the cut while the text turns. */
  slides(kind, factionId, idx) {
    const f = CUTSCENES[factionId];
    if (!f) return [];
    if (kind === 'intro') return (f.intro || []).slice();
    const a = f.sys && f.sys[idx | 0];
    return a ? [{ key: a.key, text: a.a }, { key: a.key, text: a.b }] : [];
  },

  /** Play a slideshow, then call done() exactly once. Skippable throughout;
      a click mid-text completes the text, a second advances. Draws nothing:
      all motion is DOM timers, and reduced motion collapses to instant. */
  play(kind, factionId, idx, done) {
    return this.playList(factionId, this.slides(kind, factionId, idx), done);
  },

  /** Play an arbitrary slide list through the same overlay, same skip
      semantics, same degrade rules. Extracted (Session 38) so the per-planet
      deploy sequence can feed authored world slides through the one cutscene
      surface instead of growing a second overlay that would drift. */
  playList(factionId, list, done) {
    const fin = () => { if (done) { const d = done; done = null; d(); } };
    if (!list || !list.length) return fin();

    const fac = (typeof FACTIONS !== 'undefined' && FACTIONS[factionId]) || { color: '#7dd3fc', icon: '◈', name: '' };
    const reduced = (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
                    document.body.classList.contains('rm-user');

    let ov = document.getElementById('cutscene');
    if (!ov) { ov = document.createElement('div'); ov.id = 'cutscene'; document.body.appendChild(ov); }
    ov.style.setProperty('--fc', fac.color);
    ov.className = 'show';
    /* The faction's own harmony under its own slides, pad only. The engine
       does the work; this just names the chord set. See SCORES in audio.js. */
    if (typeof Sound !== 'undefined' && Sound.startCutsceneScore) Sound.startCutsceneScore(factionId);

    let i = 0, typing = null;

    const renderSlide = () => {
      const sl = list[i];
      /* THE SECOND-CHOICE PLATE. A slide may name an `alt` key, tried only
         when its first choice is absent from the pack. The planet cutscenes
         (js/planetcuts.js) use it to fall back to the world plate, which is a
         picture OF THE SAME WORLD, rather than dropping to the faction crest.
         Two live callers, neither of them exotic: the single-file bundle
         drops the 875 planet plates on purpose (build.js), and any clone
         rendering the pack has a partial `pcut` class for several hours. */
      const src = (typeof ARTPACK !== 'undefined' &&
                   (ARTPACK[sl.key] || (sl.alt && ARTPACK[sl.alt]))) || '';
      /* THE ANIMATED PLATE, when there is one and the reader wants motion.
         Three gates, and all three are refusals rather than opt-ins, because
         a clip is roughly 900KB against the still's 200KB and that is a cost
         nobody asked for:

           reduced   prefers-reduced-motion, or the in-game toggle. A pan that
                     the reader did not ask for is exactly what that setting
                     exists to refuse, and a still plate loses nothing.
           saveData  the browser is telling us the connection is metered.
           absent    most keys have no clip and never will. Absence is the
                     normal case, not a failure, so it degrades in silence.

         The still is the POSTER either way, so the frame paints immediately
         from a file already in cache and the clip swaps in when it arrives.
         No blank frame, and a clip that never loads is invisible.
         No `zoom` class on the video: it carries its own camera move, and
         csZoom on top of that would be two pans fighting. */
      const saveData = typeof navigator !== 'undefined' && navigator.connection &&
                       navigator.connection.saveData;
      const vid = (!reduced && !saveData && typeof ARTVID !== 'undefined' &&
                   ARTVID[sl.key]) || '';
      ov.innerHTML = `
        <div class="cs-stage">
          ${vid ? `<video class="cs-art" src="${vid}" poster="${src}" autoplay muted loop playsinline></video>`
                : src ? `<img class="cs-art${reduced ? '' : ' zoom'}" src="${src}" alt="">`
                : `<div class="cs-art fallback${reduced ? '' : ' zoom'}"><span>${fac.icon}</span></div>`}
          <div class="cs-shade"></div>
          <p class="cs-text" aria-live="polite"></p>
          <div class="cs-foot">
            <span class="cs-count">${i + 1} / ${list.length}</span>
            <button class="btn btn-sm" id="cs-skip">SKIP</button>
          </div>
        </div>`;
      const p = ov.querySelector('.cs-text');
      const words = sl.text.split(' ');
      if (reduced) { p.textContent = sl.text; typing = null; }
      else {
        let w = 0;
        typing = setInterval(() => {
          if (w >= words.length) { clearInterval(typing); typing = null; return; }
          const span = document.createElement('span');
          span.className = 'cs-w';
          span.textContent = (w ? ' ' : '') + words[w++];
          p.appendChild(span);
        }, 90);
      }
      ov.querySelector('#cs-skip').addEventListener('click', ev => { ev.stopPropagation(); close(); });
      /* The plates are fetched on demand rather than inlined, so the NEXT one
         is warmed while this one is still being read. Typing a slide takes
         90ms per word and no plate is close to that, so by the time the page
         turns the image is in cache and the turn is instant. Costs nothing
         when the pack inlines data URIs instead, as the single-file bundle
         does: assigning .src to a data URI decodes it and never hits network. */
      const nxt = list[i + 1];
      const nsrc = nxt && typeof ARTPACK !== 'undefined' &&
                   (ARTPACK[nxt.key] || (nxt.alt && ARTPACK[nxt.alt]));
      if (nsrc) new Image().src = nsrc;
    };

    const advance = () => {
      /* First click lands the rest of the text; the next turns the page. */
      if (typing) {
        clearInterval(typing); typing = null;
        ov.querySelector('.cs-text').textContent = list[i].text;
        return;
      }
      i++;
      if (i >= list.length) return close();
      renderSlide();
    };

    const close = () => {
      if (typing) { clearInterval(typing); typing = null; }
      ov.className = '';
      ov.innerHTML = '';
      /* Restores whatever the score interrupted, including silence. Called on
         SKIP and on the last slide alike, so there is no path that leaves the
         cutscene harmony running under the game. */
      if (typeof Sound !== 'undefined' && Sound.endCutsceneScore) Sound.endCutsceneScore();
      fin();
    };

    ov.onclick = advance;
    renderSlide();
    if (typeof Sound !== 'undefined' && Sound.play) Sound.play('click');
  },
};
