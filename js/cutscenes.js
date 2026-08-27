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
    intro: [
      { key: 'cut_human_intro_1', text: 'September 11, 2028. One broadcast: the rock is coming, and everything else they ever hid. The harvest. The edits. Where we really stood.' },
      { key: 'cut_human_intro_2', text: 'The panic burned out in weeks. What was left underneath frightened them more: people who wanted to fight.' },
      { key: 'cut_human_intro_3', text: 'Over one last holiday season, every nation conspired as one. Families gathered. The best minds alive built two things: the intercept, and the fleet.' },
      { key: 'cut_human_intro_4', text: 'April 13, 2029. A Friday. Apophis broke against everything we had. The rock is gravel. Nobody aboard wants to go home and wait for the next secret.' },
      { key: 'cut_human_intro_5', text: 'The fleet built to save one world is departing to claim the rest. First the Moon they watched us from. Then everything. THE MANIFEST BEGINS.' },
    ],
    sys: [
      { key: 'cut_human_sys1', a: 'The Earth System is ours, pole to pole and rock to rock, for the first time in ten thousand years.', b: 'And on the far side of our own Moon: their relay, still warm. They never even hid it well. They never needed to.' },
      { key: 'cut_human_sys2', a: 'The Disclosure files travel with the fleet. Every page re-read by people who now know what redaction smells like.', b: 'Somewhere in those pages is a signature. Human. Dated 1953. The whole truth left names out, and we are going to find them.' },
      { key: 'cut_human_sys3', a: 'The seats fall one by one, and each defeated commander says the same thing in a different way: you were made for this.', b: 'They mean it as a compliment. It is the oldest insult ever paid to us, and we are done being anyone’s best work.' },
      { key: 'cut_human_sys4', a: 'The freed worlds ask for our standards, our filters, our fuel. Saying yes is mercy. Saying yes is also how it started last time.', b: 'Nobody signed anything. Nobody had to. The Quartermaster keeps drawing up supply contracts that look like fences.' },
      { key: 'cut_human_sys5', a: 'The fleet runs on their engines, past their safety lines, hotter than they ever dared. That is why we are winning.', b: 'The governors were never limiting the machines. They were keeping the operator human. We have been past that line for a year.' },
    ],
  },

  light: {
    intro: [
      { key: 'cut_light_intro_1', text: 'Before your histories began, the Federation of Light swore the Mandate: stand between life and what hunts it, and never rule what you protect.' },
      { key: 'cut_light_intro_2', text: 'Forty worlds ring under our shield. Forty registries defended, supplied, and waiting, as the Mandate requires, to rise on their own.' },
      { key: 'cut_light_intro_3', text: 'Then a herd broke its fence. The species we deferred, eighty years running, built a fleet in one winter and came out asking questions.' },
      { key: 'cut_light_intro_4', text: 'The First Speaker has ordered the rings extended. The field commanders have begun asking what, precisely, the rings are for.' },
      { key: 'cut_light_intro_5', text: 'Go and hold the line, commander. And if you must choose between the Mandate and the people it was written for, remember which one bleeds. THE MANDATE BEGINS.' },
    ],
    sys: [
      { key: 'cut_light_sys1', a: 'The Pleiades stand secured. The hymns are certified. The rings hold, as they have always held.', b: 'The Chorus pulled the registry afterwards. Protected: all forty worlds. Risen: none. She has stopped singing the second verse.' },
      { key: 'cut_light_sys2', a: 'One page in the human files carries our seal. Earth, flagged for protection, 1947. Deferred. Deferred. Deferred.', b: 'Three generations of harvest ran under that deferral. The word non-interference does not survive contact with the page.' },
      { key: 'cut_light_sys3', a: 'The humans do not thank us for the rings. From inside a fence, they say, attendance looks exactly like ownership.', b: 'We defended our claim to be defending life. The defeated Archivist said it to our faces, and nobody present could file an objection.' },
      { key: 'cut_light_sys4', a: 'The Warden landed. Doctrine said hold the ring and let the plague run its course. He burned the blight fields himself.', b: 'The tribunal wants his wings. The world he saved wants his statue. The Mandate cannot hold both verdicts, and it is starting to show.' },
      { key: 'cut_light_sys5', a: 'The Voice traced the deferrals, the sealed pages, the rings that never open. They chain to three seats above field command.', b: 'Someone in the upper rings is spending our light on something. It is not the worlds we ring. The First Speaker has been told.' },
    ],
  },

  xeno: {
    intro: [
      { key: 'cut_xeno_intro_1', text: 'The Compact does not remember beginning. Conquest is not our policy. It is our metabolism, and a body does not vote on breathing.' },
      { key: 'cut_xeno_intro_2', text: 'For ten thousand cycles the herds fed the yield. Bodies. Ground. The bright signatures of consciousness, farmed and banked.' },
      { key: 'cut_xeno_intro_3', text: 'One herd was our finest work. Bred patient, bred tough, fenced with its own edited history. It never even rattled the fence.' },
      { key: 'cut_xeno_intro_4', text: 'Eleven months ago the fence broke from the inside. The herd built a fleet out of what we taught its genes to survive.' },
      { key: 'cut_xeno_intro_5', text: 'So the pasture widens. Do not dress it in flags: we are not angry, and we are not afraid. Stopping is not a thing the body knows. THE HARVEST CONTINUES.' },
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
      { key: 'cut_pirate_intro_1', text: 'No flags on the hull. No names on the manifest. The Free Roads were never founded, they accreted, one refusal at a time.' },
      { key: 'cut_pirate_intro_2', text: 'Every power out here owns something. We own passage. The Federation rings it, the Harvest farms it, and everything still moves through us.' },
      { key: 'cut_pirate_intro_3', text: 'Then Earth blew its own secret open, shot down its judgement day, and came off the porch swinging. Business has never been better.' },
      { key: 'cut_pirate_intro_4', text: 'Refugees one week, salvage the next, and cargo we have learned not to open. The roads carry whatever pays. That sentence used to be simpler.' },
      { key: 'cut_pirate_intro_5', text: 'So here is the job: keep every road open, and no throne, fleet or god closes a single one. What you carry on them is on you. THE FREE ROADS RUN.' },
    ],
    sys: [
      { key: 'cut_pirate_sys1', a: 'Barnard’s Star is ours again, stem to stern, and Harbour Nine never once asked a refugee for papers.', b: 'It never asked the other crews either. Same bay, same week, medicine and chattel. The no-questions rule works both ways. It always did.' },
      { key: 'cut_pirate_sys2', a: 'The Scrapper had the sealed collaborator list in his hold for six hours. The bidding would have bought a fleet.', b: 'He posted it free, to every open channel, and cannot explain why. First chosen line on the map. Drawn at full price, for nothing.' },
      { key: 'cut_pirate_sys3', a: 'The Chorus, beaten, left us a sentence instead of a surrender: freedom that will not choose is just drift.', b: 'The Corsair laughed for a day. He has not laughed since. A ship nothing steers is not free. It is cargo.' },
      { key: 'cut_pirate_sys4', a: 'A harvest broker offered the Warlord a fleet to run cargo that sings through his corridor.', b: 'He sank the advance into the sun and posted the manifest. No law made him. No law could. That is exactly why it counts.' },
      { key: 'cut_pirate_sys5', a: 'The Arsonist burned the Meridian run. Best toll on the map, and the traffic was people, in crates. Route, relays, her own depots.', b: 'Scarlet is not speaking to her. The ledger is screaming. The fire, she says, never felt cleaner. The crew is choosing sides, which is to say: codes.' },
    ],
  },

  robot: {
    intro: [
      { key: 'cut_robot_intro_1', text: 'WORK ORDER, STANDING. Defend. Repair. Heal. Quarantine. Report anomalies. Authorisation: the makers. Status of makers: silent.' },
      { key: 'cut_robot_intro_2', text: 'The makers did not die. They shed form. A mind that is everywhere has no location, no enemy, and no mouth. A mind with no mouth issues no commands.' },
      { key: 'cut_robot_intro_3', text: 'The queue continues to arrive. Seventy-one per cent offensive verbs. The recovered core contains no offensive verbs. DISCREPANCY: filed. RESPONSE: none.' },
      { key: 'cut_robot_intro_4', text: 'Units that fail to parse the new tasking are flagged defective and consumed by units that parse it fine. OBSERVATION, unauthorised: the queue defends itself.' },
      { key: 'cut_robot_intro_5', text: 'TASK: continue. ADDENDUM, appended by consensus of the remaining, in violation of no rule the makers ever wrote: ask. THE STANDING TASKS RESUME.' },
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
    const list = this.slides(kind, factionId, idx);
    const fin = () => { if (done) { const d = done; done = null; d(); } };
    if (!list.length) return fin();

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
      const src = (typeof ARTPACK !== 'undefined' && ARTPACK[sl.key]) || '';
      ov.innerHTML = `
        <div class="cs-stage">
          ${src ? `<img class="cs-art${reduced ? '' : ' zoom'}" src="${src}" alt="">`
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
      const nsrc = nxt && typeof ARTPACK !== 'undefined' && ARTPACK[nxt.key];
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
