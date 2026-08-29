# Session 34 task list

Tracked per standing rule: multi-item requests get a tracked list file.
Source: owner's annotated battle-HUD screenshot, three notes.

- [x] 1. DONE. Squish the bottom-middle (inspector) panel: removed the
      "[X] YOU SENT / INBOUND" attrition row and the ATTRITION hint-block from
      `wavePanel()` (js/ui.js) to reclaim vertical space for the ability bar
      and base-level button being added to the same pane (item 3).
- [x] 2. DONE. Removed `<aside id="sidebar">` from index.html entirely (it
      held only #btn-rush, #ability-bar, #btn-baselvl -- #inspector already
      left it in Session 33). #btn-rush moved into .hud-centre, after the
      chip-rows, so it reads as "under the middle part at the top." Deleted
      every rule and script that only existed for the sidebar: style.css's
      #sidebar rule and its two stale comment blocks, polish.css's whole
      immersive #sidebar card (position/opacity-yield/transition, ~40 lines),
      the density-pass gap line, the ability-bar shrink-budget comment's
      sidebar framing, and game.js's --rail-w measurement block plus the
      SIDEBAR_WIDE_PX fallback in resize()'s unlaid-out path (config.js's
      SIDEBAR_WIDE_PX constant removed outright, now genuinely unused).
      body.immersive #hud's right inset changed from var(--rail-w, 312px) to
      a plain 12px, matching left, since there is no more rail to dodge.
- [x] 3. DONE. #ability-bar and #btn-baselvl now sit inside #dock-inspector,
      above #inspector, exactly per "add the skill to be at the top of the
      bottom middle and the upgrades for the base also there as well."
      #dock-inspector is now `display:flex; flex-direction:column; gap:8px`
      so the three sections stack with even spacing (.dock-pane itself is a
      plain block and provided none).
- [x] 4. DONE, one real bug found and fixed. At 1600x900 all 4 tower cards
      already rendered with zero clipping (measured: scrollHeight ==
      clientHeight). But at 1366x768 -- this codebase's own reference laptop
      size -- a real bug surfaced: #shop-list's `grid-template-columns:
      repeat(2, 1fr)` used bare 1fr, whose minimum is auto (content-sized),
      so the last card's name+role text pushed it 30px past #dock-shop's own
      right border instead of shrinking into its already-wired ellipsis.
      Fixed to `repeat(2, minmax(0, 1fr))`, the standard grid fix; same
      change applied to .muster-bar for the same reason. Re-measured at
      1366x768: last card now sits inside the pane with normal padding, 0
      overflow. Also found #dock-inspector overflowing by 28px at that same
      short viewport once the ability bar + base button joined it (34vh cap
      predates that content); raised to 40vh, which still reads as the
      smallest of the three panes next to muster/shop's shared 42vh but
      comfortably covers the new content down to 640px of viewport height.
- [x] 5. PARTIAL, with an honest scope note. Real, measured gap: at 1600x900
      #dock-muster is 224px tall against #dock-shop's 126px (98px delta).
      Root cause investigated directly rather than guessed: #dock-muster
      carries two full-width rows #dock-shop has no equivalent for
      (.engine-strip: the active doctrine + its live state;
      .muster-head: the econ readout -- base income, %, power multiplier,
      slots left), and each .muster-btn shows one more figure per card
      (cost + power + econ) than a .tower-card does (cost only), so its
      2-line body more easily runs to 3 lines at the same 152px column
      width. Trimmed what was safe to trim without cutting real information:
      .muster-btn's padding matched to .tower-card's (was already the
      short-viewport-only override at max-height:780px; it is the default
      now), saving 4px/card. Did NOT compress .engine-strip/.muster-head or
      strip a figure off .muster-btn to chase pixel parity -- both show
      genuinely different per-wave state a tower card has no equivalent of,
      and the codebase's own standing rule (polish.css, above .panel-action)
      already argues against forcing different controls into one shape.
      "Perfectly symmetrical" in the pixel sense is not achievable here
      without a real information loss; "similar and even" is met at the
      card level (both grids are 2x2, comparable card sizing) even though
      the two header rows keep the panes from matching in total height.
- [x] 6. DONE. Verified centered at 1600x900 (#hud and #dock both measured
      dead centre, 0px off viewport centre) and at the 1366x768 reference
      laptop size, in both normal and immersive mode. Immersive mode's own
      floating-card HUD now spans the full width (left:12px/right:12px)
      instead of stopping short of a rail that no longer exists.
- [x] 7. DONE. Found and fixed a real regression along the way: owner-sweep
      check 25.5 ("the board fills the window and the chrome floats above
      it") threw, because it read `document.getElementById('sidebar')`
      directly -- a check written when the rail was a real floating card in
      immersive mode. Rewritten to measure #hud and #dock instead (the two
      chrome layers that actually exist now), same four assertions (board
      fills window, chrome on top with real z-index, nothing clipped, whole
      board still reachable via resetCam). Final suite state: owner sweep
      59/59 (was 58/59 + 1 throw before the check fix), MPT 37/37, mutation
      detection 8/8 with the clean control staying green, 0 em dashes, 0 bad
      bytes across 147 files. Committed and pushed once every gate was
      green.

Status notes appended below as each item lands.
