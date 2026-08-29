# Mobile audit, Session 37

Every number here was measured in headless Chrome at **390x844**, an
iPhone-class viewport, with each setup screen rendered and driven. The probe is
`{ size: [390, 844] }` plus a steps file that shows each screen, measures
`scrollWidth - clientWidth` on every descendant, locates the primary CTA
relative to the fold, and counts controls under the 44px touch floor.

*A control you cannot find is a control that does not exist.*

## What the owner reported

> I tried choosing a faction but I couldn't actually get to choose. The next
> button should hover and pop up when you've chosen a faction so you don't have
> to scroll.

Reproduced exactly, and the diagnosis was one step off the symptom.
**Selection worked.** Tapping a card set `sel.faction` and enabled
`#btn-faction-go` correctly, every time. What failed was that the button sat at
`y=1286` in an `844px` viewport, **510px below the fold**, with nothing on
screen to say it existed or that the tap had registered. The player had no
feedback and no destination.

## Findings, before and after

| Screen | Defect | Before | After |
|---|---|---|---|
| `screen-faction` | Primary CTA below the fold | **510px** | **0px** |
| `screen-command` | Horizontal overflow | **120px** | 7px |
| `screen-command` | Controls under 44px | 2 | **0** |
| `screen-loadout` | Horizontal overflow | **88px** | 7px |
| `screen-loadout` | Controls under 44px | 10 | 3 |
| `screen-theatre` | Horizontal overflow | **45px** | **0px** |
| `screen-title`, `screen-multiverse` | none found | clean | clean |

The residual 7px is at or below the probe's own noise floor (border and
scrollbar rounding) and is not visible.

## The two root causes

**1. Footers that assume a mouse.** `.setup-foot` is a single flex row. On
`screen-command` it carries four items (back, soul shop, step dots, primary)
which cannot share a 390px row, so it overflowed by 120px and pushed its own
CTA off screen. The fix is one pattern applied to all three scrolling setup
screens: the footer goes `position: sticky; bottom: 0` with a blurred backdrop,
it wraps, and the primary action takes a full-width row of its own.

Sticky rather than pop-up, deliberately. Always visible means the CTA is
discoverable **before** the choice, so the screen reads as "pick one, then
press this" instead of "pick one, then guess". It gains emphasis on `.ready`
in the chosen banner's own colour rather than appearing from nothing, because
an element that materialises under a thumb mid-tap is its own defect.

**2. Grid items default to `min-width: auto`.** This produced every horizontal
overflow measured. `.setup-body` collapses to one column under 900px, but
`.setup-rail` still measured **401px inside a 390px viewport** because a grid
item refuses to shrink below its content's min-content width, and every
descendant inherited the overflow. The same shape appeared in `.cd-head`
(a three-track grid holding a 26px name at `.12em` letter-spacing, 69px over)
and `.lo-col-head` (four tracks plus a fifth child on an implicit row, 88px
over). `min-width: 0` plus `overflow-wrap: anywhere` is the fix in all three.

Horizontal overflow is the worst class of bug here because it is **silent**.
The layout does not visibly break; it just places content past the right edge,
where a player has no reason to look and often cannot scroll to.

## Scope, and what is deliberately not in this pass

Everything lives in `@media (max-width: 860px)` blocks in `css/polish.css`,
plus six lines in `UI.renderFactions` that toggle `.ready` and set `--fc` on
the footer. **Desktop layout is untouched**, which is why owner-sweep and MPT
held at `pass=62 fail=0` and `pass=37 fail=0` across the change.

Still open, and worth a session of its own:

- `[x]` **The in-game HUD at phone width. DONE, Session 38.** Measured and
  rebuilt: chrome was 65% of the viewport in portrait and 93% in landscape,
  the commander cards were 22px wide holding 190px of content, and #hud
  overlapped #battle-controls by 12236px2. See the battle HUD section below.
- `[x]` **Three controls under 44px on the loadout screen. DONE.** They were
  the drawer close and reset icons at 22x44: passing on height, failing on
  width, because the 44px floor is both dimensions. Now 0.
- `[x]` **The inline EQUIP button. DONE.** Measured 177px below the fold at
  390x844, on the screen whose own copy says "press EQUIP on a commander".
  It does not get a sticky bar of its own (a second pinned bar is how a phone
  ends up all chrome); the detail panel became a column and the verb is
  ordered directly under the commander header, where it belongs anyway.
- `[ ]` **Real device testing.** Every number here is Chrome's device emulation
  at one viewport. Touch latency, momentum scrolling, iOS Safari's dynamic
  toolbar and `env(safe-area-inset-bottom)` on a notched device are all
  unverified.

---

## Unrelated finding: owner-sweep 29.1 was flaky. FIXED

Recorded here because a flaky gate is worse than a missing one: it teaches the
next session to re-run until green, which is how a real failure gets waved
through.

`owner-sweep 29.1`, "a campaign battle starts on every scenario, and worlds
differ", failed once in roughly five full gate runs this session with
`identical same-family boards 1/20`, then passed on an immediate re-run with
the working tree untouched. The check samples 20 generated boards and fails if
any two of the same family match, so a collision is a probability, not a
defect: nothing in the run changed between the fail and the pass.

`[x]` **FIXED, same session, by pinning the draw rather than widening the
assertion.** The root cause was upstream of the check: `campaignStart` seeds
with `Math.random` (commanders.js:514), which is right for a campaign and
wrong for a gate, so every run sampled a different set of worlds. The tell was
that the counts moved between runs, 20 battles across 5 scenarios one time and
17 across 15 comparisons the next.

The sweep now assigns `Meta.campaign().seed = 20260827` before reading the
galaxy. `galaxy()` caches on seed plus mapPool, so the assignment both pins
the draw and invalidates the cache. The check is deterministic now: it either
passes every run or fails every run, and a failure means something. Verified
with three consecutive full gate runs, all `pass=62 fail=0`.

Deliberately NOT done: raising the tolerance to allow 1/20 collisions. That is
widening an assertion until it stops failing, which is the thing this entry was
written to warn about.

---

## Session 38 addendum: the audit was run at one width, and a tool existed

The Session 37 pass above measured a single viewport (390x844) with a
hand-written probe. `tools/breakpoint-sweep.js` was already in this repo and
does exactly this across a breakpoint SET, failing on any check whose verdict
diverges by width. It was not run. Running it now:

```
1600x900: pass 64 fail 0 info 2
1024x900: pass 65 fail 0 info 1
768x1024: pass 65 fail 0 info 1
390x844:  pass 64 fail 1 info 1
  FAIL 25.5 the board fills the window and the chrome floats above it
DIVERGES BY WIDTH: 25.5   1600 PASS / 1024 PASS / 768 PASS / 390 FAIL
```

**The failure is REAL and PRE-EXISTING, not a regression from the S37 work.**
Verified by running the same sweep against a worktree at the commit before the
mobile pass: identical numbers (`clipped 7`, home zoom `0.20` showing
1298x2808 of 1064x570). The S37 changes were all scoped inside
`@media (max-width: 860px)` on setup screens and never touched `#screen-game`.

`[ ]` **OPEN, and now measured rather than merely suspected: the in-game board
at phone width.** S37 listed "the in-game HUD at phone width" as unmeasured;
this is that item with a number on it. The canvas fills 390x844 while the home
zoom of 0.20 tries to show a 1298x2808 world in a 1064x570 box, and 7 elements
clip. It is the last width-specific defect standing.

**The process lesson, which is the more valuable half:** `GATE CLEAN` in this
project means "clean at 1600x900", because that is the only width `gate.js`
runs its browser harnesses at. Every session that touches layout should finish
with the breakpoint sweep and report its divergence list, and that rule now
lives in the plugin at `aegis-gamedev/references/verification.md` section 11
so it is not this document's private lesson.

## Session 38: the fold bug HAD a second instance, exactly as the ledger warned

`bug.mobile-fold-two-instances` in the plugin ledger says this defect class
leaves a second live instance at another width after the first fix, and that a
fresh load at that width is what surfaces it. The S37 pass was measured at
390x844 only, so it did not look.

Measured at 900px tall across five widths, running the design-forge Step 1
preflight gates against the shipped CSS:

| Width | CTA visible without scrolling, BEFORE | AFTER |
|---|---|---|
| 390 | yes | yes |
| 640 | yes | yes |
| 858 | yes | yes |
| **862** | **NO** | yes |
| **1024** | **NO** | yes |

The trigger was never the phone. It is the TWO-COLUMN GRID: `.faction-grid`
goes 2-up at `max-width: 1080px` (polish.css:686), the cards are tall, and the
footer lands below the fold on any viewport shorter than the content. The S37
fix was keyed to 860px, an arbitrary phone-ish number, rather than to the
breakpoint of the thing that actually causes the overflow. 861 to 1080px is a
laptop and a tablet in landscape.

The sticky behaviour is now keyed to the same breakpoint as the grid. The
touch-target and wrap rules stay at 860px, because those genuinely are about
fingers.

Also measured on the same pass and passing at every width: the primary label
fits one line, zero labels clip, zero buttons fall under the 44px touch floor,
and the CTA's contrast is 18.97 against a WCAG AA requirement of 4.5.

## Session 38: owner-sweep 25.5 fixed. The in-game board at phone width

The last width-specific defect standing. Diagnosed by arm rather than by
guess: of 25.5's four assertions, `fills`, `onTop` and `wholeBoard` all
PASSED at 390x844 and only `clipped` failed. The board and the chrome
layering were never the problem.

**The cause.** `#dock` is three flex panes authored at 328/300/328
(`--dock-side-w`, and `#dock-inspector`'s own 300px). They shrink, and below
roughly 700px they shrink past what their contents need. Measured, clipped
count from 25.5's own selector set:

| Width | clipped | worst overflow | pane widths |
|---|---|---|---|
| 390 | **7** | 55px | 117 / 108 / 117 |
| 480 | 5 | 44px | 148 / 136 / 148 |
| 600 | 5 | 23px | 189 / 174 / 189 |
| 768 | 0 | 0 | 247 / 226 / 247 |

A tower card is 97px of content and was being given a 42px box, so it was
drawn cut in half. `flex-shrink` was doing the damage; no width value was
wrong.

**The fix**, keyed to 767px so the 768 tablet case that measures clean is
untouched: panes stop shrinking and size to their content, the card grids go
one-up instead of two-up (which is what actually buys the room, since a pane
then needs one card's width rather than two), `BASE LEVEL` wraps its cost
rather than being cut, and `#dock` claims an explicit width because an
absolutely positioned `left:50%` box was shrink-to-fitting to 267px inside a
366px allowance.

**Three panes genuinely do not fit a 390px phone**, and that is geometry, not
a defect: the inspector column alone is 200px of natural content (econ bar,
base level, next-wave line), and the three together need 483px. So the dock
scrolls, with snap, showing 76% at 390 and 100% from 600 up. Nothing is
clipped and nothing is unreachable: one deliberate swipe brings the loadout
cards in whole, verified by screenshot.

**Result: the breakpoint sweep is fully clean for the first time.**

```
1600x900: pass 64 fail 0 info 2
1024x900: pass 65 fail 0 info 1
768x1024: pass 65 fail 0 info 1
390x844:  pass 65 fail 0 info 1
PASS: 4 breakpoints swept
```

### Measured, and NOT a defect: portrait is a small board

| Viewport | clipped | dock visible | board occupies |
|---|---|---|---|
| 390x844 portrait | 0 | 76% | **17% of view** |
| 844x390 landscape | 0 | **100%** | **58% of view** |

The board is 1064x570, a landscape shape. Shown whole on a portrait phone it
can only be as wide as the screen, and the rest is empty vertical space. That
is the `wholeBoard` arm working correctly, not failing. In landscape, the
orientation this board's aspect actually wants, everything is clean at once:
no clipping, the whole dock on screen, and the board at 58% of the view.

`[ ]` **Optional, not done:** a rotate-to-landscape hint on a portrait phone.
It would be a new UI affordance rather than a fix, so it is offered rather
than assumed.

## Session 38, owner report: the CTA was below the fold at EVERY size

> "I could barely see the button to go to the next page or deploy... I can't
> even start a mission because I can't see the deploy button. This is on my
> Google Fold with the open screen."

Reproduced immediately, and the reproduction indicted both earlier fixes in
this document. Pixels BELOW the fold, measuring the footer's own primary:

| viewport | faction | command | loadout |
|---|---|---|---|
| 1000x670 (the Fold) | 0 | **463** | 0 |
| 1280x600 | 70 | **509** | 71 |
| 1440x700 | 0 | **409** | 71 |
| 900x500 | 0 | **902** | 163 |
| **1600x900** (the size the gate runs at) | 0 | **209** | **71** |

`SELECT THEATRE` had been 209px below the fold ON DESKTOP. The screens do
scroll and the buttons were reachable, but a player sees a sliver of a button
at the bottom edge of a screen that looks complete and concludes it is broken.
That is exactly what happened.

**Both earlier fixes were keyed to WIDTH and the cause is HEIGHT.** A footer
goes under the fold when the content is taller than the viewport, and that
happens at any width on a short viewport: a folded phone, a laptop with
browser chrome, a small window. Keying to 860px and then to 1080px was chasing
instances of one bug and finding a new one each time.

So it is not keyed at all now. `position: sticky` costs nothing when the
content fits and holds the CTA on screen the moment it does not, which is
correct at every width and every height. The one unconditional rule REPLACED
both media-query versions rather than joining them, so the duplication those
two passes created is gone.

After: faction, command and loadout all visible with 0px below the fold at all
five viewports above.

### The gap that let it ship

Nothing measured it. Every browser check in the suite looked at the board, the
HUD or a named panel; not one asked whether the control that advances the game
was visible. **owner-sweep 38.3** now does, and `mutants.js` proves it can
fail: planting `position: static` on the setup footers is caught by 38.3 and
by nothing else. Detection is 13 of 13, all by predicted check, control green.

### Also fixed: the tooltip that could not be dismissed

The owner's first screenshot shows a faction tooltip stuck over the cards. The
touch path in `bindChipTips` has promised "a second tap (or tapping elsewhere)
dismisses it" in a comment since it was written, and **no outside-tap handler
existed**. Worse, on this screen the chips ARE the cards, so selecting one
re-renders the grid and destroys the element `_ttFor` holds; after that the
`_ttFor === el` toggle can never match and nothing in the game closes it.

Two fixes: a document-level `pointerdown` dismiss, bound once rather than per
chip, and `renderFactions` now clears a tooltip it is about to orphan.
Verified on five behaviours including the detached-owner case.

## Session 38, third report: it was 100vh all along

The owner reported the same defect a third time, on faction, commander AND
planet select, after two rounds that both measured clean here. The third
report is the one that matters, because it proves the harness was the problem.

**`.screen { height: 100vh }`.** On a phone browser 100vh is the LARGE
viewport: the height the page would have if the URL bar were hidden. While
that bar is showing, which it is in every screenshot the owner sent, 100vh is
TALLER than the visible area. A full-screen box then extends off the bottom of
the screen, and anything pinned to its bottom edge goes with it: the sticky
setup footers from the last fix, and the absolutely positioned theatre footer
on the planet screen. One root cause, all three screens, exactly as reported.

**Headless Chrome has no URL bar, so 100vh EQUALS innerHeight there and the
defect cannot be reproduced by geometry at all.** Every probe run against
these screens was structurally incapable of seeing it. That is why three
rounds of measurement said 0px below the fold while the owner watched the
button sit off screen.

Fixed at all seven full-screen sites by pairing the unit:
`height: 100vh; height: 100dvh;`. The bare line stays first as the fallback;
`dvh` is the dynamic viewport height, what is actually visible right now,
and it tracks the bar as it shows and hides.

### The check, and the bug inside the check

Since geometry cannot see this, **owner-sweep 38.4** reads the CSSOM and
refuses the construct: authored as a fallback pair, a browser supporting dvh
keeps only the winner, so `rule.style.height` reads back `100dvh` and a
revert reads back `100vh`.

Its first version was worthless and said so with a confident pass. It walked
rules as `if (r.cssRules) { recurse; continue; }`, which was correct before
CSS Nesting shipped. Now a plain `CSSStyleRule` also implements
`CSSGroupingRule`, so `r.cssRules` is truthy (an empty list) on EVERY
ordinary rule, and that `continue` skipped every rule that had a declaration
in it. Measured: **1249 of 1291 rules in polish.css walked past, 42
inspected**, and it skipped a bare-vh rule planted directly in front of it.

It was caught because the mutant was written before the check was trusted.
`mutants.js` plants `.screen { height: 100vh }` and 38.4 must fail; on the
first run it did not, which is the only reason any of this was noticed.
Detection is now 14 of 14, all by predicted check, control green.

*A check that has never failed is not a check. It is a hope with a name.*
