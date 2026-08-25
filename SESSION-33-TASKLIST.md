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
- [ ] 2. New scenarios for worlds the player's own faction already owns: swarm
      defense, co-op vs a rival faction, renegade/betrayer hunt, and room for more.
      All dialogue and procedurally generated lore must stay consistent with
      whichever scenario is active.
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
