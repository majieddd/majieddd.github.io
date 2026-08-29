# Design Audit, Session 30

Run with the `design-forge` skill: the 12 binary gates plus the 40-row detector
list, against the live build, at four breakpoints across five screens.
20 screen/viewport combinations. Nothing below was asserted; every number came
from a probe through `tools/headless.js`.

## Result

| Gate / detector | Result |
|---|---|
| G1 em dash in rendered text | **0** across all 20 |
| G4 WCAG AA contrast | **0 failures** across all 20 |
| G5 / D4 pure `#000` or `#fff` rendered | **0** |
| G8 visible focus state | **0 missing**, 160 interactive elements sampled per screen |
| G11 page scrolls horizontally | **0** at 375, 768, 1280, 1600 |
| D2 purple or violet gradient | 0 |
| D14 measure and line height | **0 after fix** (was 2) |
| D27 emoji as interface icons | 0 |
| Never-ship: `transition: all` | 0 |
| Never-ship: layout properties animated | 0 (one documented exception, `.rw-bar i`) |

## The one real finding, and its fix

**D14, measure.** `.cd-blurb` ran to 147 characters a line at 1600px and `.hint`
to 138, against the 65 to 75 the detector asks for. Both are capped now.

The fix is worth recording because the obvious version of it is wrong. Capping at
`72ch` still measured 78 to 80 real characters. **The CSS `ch` unit is the advance
width of the digit zero, not the average glyph.** Measured in this face at 13.5px:
`0` is 7.28px, the average lowercase glyph is 6.55px. So `72ch` renders 524px and
holds about 80 characters. The caps are `65ch`, which lands near 72.

This has been written back into the plugin at
`design-forge/references/slop-detectors.md`, because anyone implementing detector
14 by writing `max-width: 75ch` overshoots the band it quotes by about a tenth.

## Two findings that were instrument error, not defects

Recorded so nobody re-opens them.

**42 "horizontal overflow" hits were the galaxy map.** A per-element probe that
flags anything whose right edge exceeds `window.innerWidth` fires on every
deliberately oversized child inside a clipping parent. `.gx-plane` is a pannable,
zoomable map plane inside `.gx-viewport`, absolutely positioned and larger than
the screen by design. The gate that matters is the PAGE one,
`document.body.scrollWidth <= window.innerWidth`, and it passed **every one of
the 20 combinations**.

**9 "button label wrap" hits were two-line controls.** The samples were
`"◎\n 0/1"`: a glyph above a count, which is the intended layout, not a
label that overflowed. `scrollHeight > clientHeight` cannot tell those apart.

Both traps are now documented in the detector list.

## Kit rule, detector 34

21 button-ish class names exist. Measured against the markup, **13 are modifiers
that compose with the `.btn` primitive** (`class="btn sell-btn"`,
`class="btn btn-primary btn-big menu-btn"`), which is the kit rule working. Six
are standalone: `enrage-btn`, `gx-nav-btn`, `icon-btn`, `mode-btn`, `muster-btn`,
`speed-btn`. `icon-btn` is arguably its own primitive (a bare icon control, not a
labelled button). YELLOW, not RED: the primitive exists and is mostly used.
Worth a consolidation pass, not a shipping blocker.

## Gates unaffected by this work

Sweep 59 pass / 0 fail / 2 info of 61. MPT 37 pass / 0 fail.
`Net.lockstepAudit()` empty. Galaxy PRNG byte-identical across 16 seed/faction
pairs. `tools/mutants.js` 7 of 7 planted defects caught by their predicted checks.
