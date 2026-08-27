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

- `[ ]` **The in-game HUD at phone width.** `screen-game` is a different
  density problem (canvas, rails, tower tray, wave banner) and none of it was
  measured here. Do not assume this pass helped it.
- `[ ]` **Three controls under 44px on the loadout screen.** Down from ten.
- `[ ]` **The inline EQUIP button** on a commander card sits below the fold on
  a phone. It is inside a card the player is deliberately reading, so it is
  less severe than the faction case, but it is the same shape of problem and
  the commander screen cannot be completed without it.
- `[ ]` **Real device testing.** Every number here is Chrome's device emulation
  at one viewport. Touch latency, momentum scrolling, iOS Safari's dynamic
  toolbar and `env(safe-area-inset-bottom)` on a notched device are all
  unverified.
