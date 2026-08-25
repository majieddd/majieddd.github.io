# Session 33 task list

Tracked per standing rule: multi-item requests get a tracked list file.

- [x] 1. DONE. #inspector moved from the sidebar into a new #dock-inspector pane,
      centred between muster (left) and shop (right); id unchanged so
      renderInspector's cached reference needed no JS change. .muster-bar and
      #shop-list are now `display:grid; grid-template-columns:repeat(2,1fr)`,
      an exact fit since LOADOUT_SIZE and MUSTER_LOADOUT_SIZE are both hard
      capped at 4. Muster icon swapped from tier.icon's text glyph to
      this.unitIconHTML(tier.type, 22), same procedural painter towers use.
      Fixed two real bugs found by measurement: .muster-head/.engine-strip/
      .lattice-plate were squeezed into single grid cells until given
      grid-column:1/-1, and a max-height override on #dock-inspector silently
      did nothing until raised to #dock #dock-inspector (the shared
      `#dock .dock-pane` rule outranks a bare id on specificity). Verified:
      screenshot, dock height 378px -> 306px, owner sweep 59/59, MPT 37/37,
      PRNG fingerprint identical.
- [x] 2. DONE, one honest scope note. Investigation found: a conquered world was
      ALREADY clickable and re-enterable today (pick()'s real gate is only
      isSystemOpen+isWorldOpen, no conquest check at all) -- the gap was never
      selectability, only that nothing differentiated what happened once you
      did. New `ownedWorldScenarioOf(w, progress)` in galaxy.js returns null
      for the ordinary world (zero behaviour change) and otherwise resolves:
      RENEGADE_HUNT (a real duel, since worldBossOf already draws a renegade
      world's boss from the PLAYER'S OWN commander pool -- "a splinter of your
      own power" was already mechanically true, just never named) for the
      existing w.renegade worlds; one of two REVISIT scenarios, index-picked
      like every other scenario variant, for a genuinely 3-starred world:
      SWARM DEFENSE (survive, themed as holding ground you already have) and
      REINFORCEMENT LINE. Every caller of worldScenarioOf (preview, battle
      start, star rating) now tries ownedWorldScenarioOf first, so the three
      cannot disagree about which battle this was.

      SCOPE NOTE on "co-op with a faction against another": no ally-AI or
      second friendly side exists anywhere in this engine, and building one
      was out of scope for this pass. REINFORCEMENT LINE is the honest
      substitute: your own power's aid arrives as a real, working mechanic
      (+40 gold every 3rd wave, through the existing awardGold path, stated
      as matériel in its own brief text, not simulated as a commander that
      is not really there).

      Verified: renegade and revisit worlds resolve identically in the
      preview card and the actual Game.start (never two opinions); a normal
      world is provably byte-identical to plain worldScenarioOf; ratingFor
      scores a revisit against ITS OWN thresholds; reinforcement fires at
      exactly waves 3/6/9 for +40 each in a real running battle; neither new
      scenario's briefing card contains the no-commander contradiction fixed
      earlier this session. Galaxy PRNG fingerprint stayed byte-identical
      (index-derived, no fresh draw). Owner sweep 59/59, MPT 37/37, mutation
      detection 8/8, 0 em dashes, 0 bad bytes.
- [x] 3. DONE. Measured: 54/54 enemy types had portraits vs 11/60 towers, the
      exact inverse of the intended parity. Suppressed the two foe_ art call
      sites (loadout detail panel, NEW CONTACT dossier); artpack data
      untouched, one-line reversible. Verified: no art img, icon still shows,
      tower art unaffected.
- [x] 4. DONE. Shared `pickerGroupHTML`/`bindGroupCollapse` wraps each origin/
      allegiance group in a `display:contents` `.lo-group`; collapse state
      persists in `this._loCollapsed` across re-renders. CSS `:has()` hides
      any `.lo-slot` whose card lacks `.on`. Fixed a `:first-child` margin
      regression the new nesting level introduced. Verified: towers (12 cards,
      1 equipped) collapse to exactly 1 visible; a real unlocked unit stays
      visible through its own collapse; state survives a full re-render;
      keyboard toggle works (native button).

Status notes appended below as each item lands.
