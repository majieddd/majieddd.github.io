# DESIGN.md

The brand contract for Cosmic Conquest. It records what the interface **is**, not what
somebody would like it to be: every colour, size and curve below was read out of
`css/style.css`, `css/polish.css` or measured in the running game at 1600x900.

Two documents sit above and beside this one and neither is replaced by it:

- [`docs/BRAND.md`](docs/BRAND.md) is the locked **art** identity, "Neon Reliquary". It
  governs generated assets: portraits, crests, dossiers, world plates. When a colour in
  this file disagrees with that one, that one wins and this file is wrong.
- [`docs/LOOKBOOK.md`](docs/LOOKBOOK.md) carries the per-faction duotone palettes with
  measured hexes, for the commander portrait class.

This file governs the **interface**: the CSS, the type, the motion, the components.

---

## North star

A field console bolted into the wall of a ship that has been in service a long time.
Dark anodised panels with a single hairline of light along the top edge, numbers set in
a real monospace so columns line up, labels stamped in condensed capitals. The only
colour that is allowed to glow is the colour that tells you whose something is. Nothing
is decorative that could instead be a readout.

The two-word test for any new surface: **instrument, not poster.**

## Dials

```
DESIGN_VARIANCE: 4/10   conventional panel layouts; the map and the galaxy carry the variance
MOTION_INTENSITY: 3/10  transitions and arrivals only; the simulation supplies the movement
VISUAL_DENSITY: 8/10    this is a strategy HUD read for an hour at a time, not a landing page
```

VISUAL_DENSITY 8 is why the type scale bottoms out near 9px and why most surfaces get a
hairline instead of a shadow. It is a deliberate setting, not drift.

---

## Colour tokens

One space: sRGB hex for opaque values, `rgba()` for translucent surfaces, `color-mix(in
srgb, ...)` for anything derived from a runtime hue. Do not introduce OKLCH here; a
mixed-space palette in a file this size is a drift generator.

### Ground and surface

| Token | Value | Role |
|---|---|---|
| `--bg` | `#05080e` | Page ground. The only opaque background in the game |
| `--panel` | `rgba(13, 19, 32, 0.72)` | Panels and cards, over the ground |
| `--panel-2` | `rgba(19, 27, 45, 0.82)` | One step up: buttons, raised rows |
| `--line` | `rgba(110, 165, 210, 0.16)` | Hairline dividers and quiet borders |
| `--line-2` | `rgba(110, 165, 210, 0.32)` | Borders that need to be seen |

Note `--panel`, `--panel-2`, `--line` and `--line-2` are declared **twice**: once in
`style.css` and again, with different values, in `polish.css`. The polish values are the
live ones because polish loads second. The style.css block is dead and is kept only so
the base sheet renders standalone.

### Text tiers

| Token | Value | Role | Measured on `--bg` |
|---|---|---|---|
| `--text` | `#e2eefa` | Body and primary | 16.1:1 |
| `--text-dim` | `#a8bdd0` | Secondary, stat labels | 9.4:1 |
| `--text-mute` | `#7e94aa` | Metadata, captions, hints | 5.3:1 |

Three tiers, and there is no fourth. A disabled control drops `opacity` rather than
inventing a fourth grey.

### Signal colours, and the job each one holds

This is the answer to the one-accent gate. The interface uses **five** hues and every one
of them is a readout, not decoration. If a new colour cannot be written into this table
with a job, it does not go in.

| Token | Value | The job, stated |
|---|---|---|
| `--cyan` | `#38e8ff` | **YOU.** Your side, your lane, your towers, your gold. Also the focus ring |
| `--rose` | `#ff6b9d` | **THE RIVAL.** The opposing side's lane, base and readouts. Never used for anything else |
| `--gold` | `#fbbf24` | **ECONOMY AND REWARD.** Gold, souls, XP, unspent points, the build timer |
| `--green` | `#4ade80` | **SAFE OR AVAILABLE.** Wave rush is affordable, a slot is open, a talent is takeable |
| `--red` | `#ef4444` | **LOSS OR REFUSAL.** Damage taken, a leak, an unaffordable price, a destructive control |

Cyan against rose is the single most load-bearing pair in the game: it is why ownership
never needs a label. Do not let a fourth "player" colour in.

Faction identity is a **sixth** channel, but it never competes with the five above
because it never appears as chrome. It arrives as a runtime custom property.

### Runtime hue channels

These are set from JavaScript per element and read by CSS. They are part of the token
system even though they are not in `:root`.

| Property | Set by | Carries |
|---|---|---|
| `--fc` | `js/ui.js` | The faction's identity hue (`FACTIONS[f].color`) |
| `--fa` | `js/ui.js` | The faction's light accent (`FACTIONS[f].accent`) |
| `--tc` | `js/ui.js` | A tower's hue |
| `--cc` | `js/ui.js` | A commander's hue |
| `--el` | `js/ui.js` | An element's hue |
| `--og` | `js/ui.js` | An origin's hue |
| `--nc` | `js/ui.js` | A node's hue |
| `--yc` | `js/ui.js` | Your own banner hue, for comparison against `--fc` |

Faction identity hues, from `js/factions.js` and matching `docs/BRAND.md`:
Humanity `#38e8ff`, Federation of Light `#fbbf24`, The Xeno `#7c3aed`,
The Pirates `#ef4444`, unaligned `#e2e8f0`.

### THE INK RULE, and why it exists

A faction identity hue is chosen to be **saturated**, because its job is to be
recognisable at a glance on a map at 40 percent zoom. A saturated hue is a poor text
colour on a dark ground, and this was not an opinion: measured in the running game, the
Xeno violet `#7c3aed` set as 9.5px label text on the soul shop panel returned **2.88:1**
against a required 4.5:1, and the Pirate crimson `#ef4444` returned **4.36:1**. Eight
distinct label rules failed WCAG AA for the same reason.

So identity hues are split into tiers by what the hue is doing:

- **Fill tier.** Fills, strokes, borders, rings, bars, map dots, and display type at
  24px or over. Use the raw hue: `var(--fc)`.
- **Ink tier.** Any text under 24px. Never use the raw hue. Lift it toward the text
  colour first:

```css
color: color-mix(in srgb, var(--fc) var(--ink-mix), var(--text));      /* under 18.66px */
color: color-mix(in srgb, var(--fc) var(--ink-mix-lg), var(--text));   /* 18.66px and over */
```

Both numbers are measured, not chosen, against the darkest hue in the catalogue,
`#6d28d9`, on the soul-shop panel:

| Token | Value | Threshold it must clear | Measured |
|---|---|---|---|
| `--ink-mix` | `58%` | 4.5:1, text under 18.66px | 5.04:1 |
| `--ink-mix-lg` | `72%` | 3:1, a glyph mark read as a UI component | 3.83:1 |

At 68 percent the small tier lands at 4.13:1 and fails. Raise `--ink-mix` and you
reintroduce the bug.

A glyph mark standing in for an icon counts as a **component**, not as text, which is why
it gets the gentler lift: WCAG asks 3:1 of a non-text UI component and 4.5:1 of body
text. A glyph carrying a word next to it is text and takes `--ink-mix`.

Where a faction's own light accent is already to hand, prefer it: `--fa` exists for
exactly this and is currently read by one rule out of forty-six that read `--fc`.

### Do not

- No `#000` and no `#fff`. Every neutral is tinted toward `--bg`'s hue. There is one
  live violation and it is listed in the audit section below.
- No purple or violet **gradient** as chrome. Violet is the Xeno's identity hue and is
  correct wherever the Xeno owns the thing. It is not a background treatment.
- No hue outside the tables above. If a new state needs a colour, it needs a row here
  first.

---

## Type

Two faces plus a numeric face, and the split is functional.

| Role | Token | Family |
|---|---|---|
| UI text | `--mono` | `'Segoe UI', 'Segoe UI Variable Text', system-ui, -apple-system, Roboto, 'Helvetica Neue', sans-serif` |
| Display, labels, wordmarks | `--display` (alias `--sans`) | `'Bahnschrift SemiCondensed', 'Bahnschrift', 'Avenir Next Condensed', 'Arial Narrow', system-ui, sans-serif` |
| Tabular numbers | `--num` | `ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace` |

`--mono` is a historical name for a face that is no longer monospace. The rename is a
sweep nobody has done yet; the value is correct and the name is a trap. Do not "fix" a
rule by swapping `--mono` for `--num` on the assumption the name is honest.

**The rule that decides the face:** if the thing is a quantity that will sit in a column
next to another quantity, it is `--num`. If it is a stamped label or a heading, it is
`--display`. Everything else, including all prose, is `--mono`.

### Scale

The scale below is the one **declared**. It is not yet the one in use: see the audit.

| Step | px | Role |
|---|---|---|
| `--t-micro` | 9 | Pips, lock stamps, chart axis marks |
| `--t-caption` | 10 | Badge text, sub-labels |
| `--t-label` | 11 | Section labels, chips, tags |
| `--t-body-sm` | 12 | Dense body: card blurbs, stat rows |
| `--t-body` | 13 | Body copy in panels |
| `--t-ui` | 14 | Button labels, control text |
| `--t-title` | 17 | Card titles |
| `--t-head` | 22 | Panel headings |
| `--t-display` | 28 | Screen headings |
| `--t-hero` | 52 | The wordmark only |

Ten steps. Every `font-size` lands on one of them, tolerance 0.5px. The scale stops at
9px: nothing in this game is set smaller than 9px as **text**. A decorative mark drawn
with a font is not text and does not get a step, it gets a comment saying so.

Tracking: display and label type carries `letter-spacing` between `.07em` and `.2em`.
Prose carries none. Tracked capitals are for short system markers only, never a sentence.

Measure: prose caps at `65ch`. Not 72ch and not 75ch, and the difference is measured: the
CSS `ch` unit is the advance width of the digit zero, 7.28px in this face at 13.5px,
against an average lowercase glyph of 6.55px. A `72ch` cap renders 524px and holds about
**80** real characters. `65ch` lands near 72. The comment carrying this measurement lives
above `.hint` in `style.css`; do not delete it.

---

## Space and radius

Spacing steps, declared in `style.css` as `--s1` through `--s7`:
`4, 8, 12, 16, 24, 32, 48`.

**These seven tokens are read by zero rules.** Every spacing value in both stylesheets is
hand-typed. That is recorded here as the state of the world, not endorsed: new work uses
the tokens, and the back-migration is a standing task.

Radius steps: `--r-1: 4px`, `--r-2: 8px`, `--r-3: 10px` (the legacy `--r`), `--r-4: 14px`,
`--r-pill: 999px`.

**Maximum radius on a content container is 14px.** Wide radii read as generated. The
pill radius is for chips and tags only, where the shape is the affordance.

---

## Motion

Three curves, and each one answers "how heavy is this thing?".

| Token | Value | For |
|---|---|---|
| `--e-enter` | `cubic-bezier(0.16, 1, 0.30, 1)` | Panels, cards and overlays arriving |
| `--e-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toggles and buttons. Overshoots by design, so never on a moving layout |
| `--e-tap` | `cubic-bezier(0.22, 0.90, 0.30, 1)` | Sub-200ms hover and press. Crisp, no overshoot |

`--ease` is a legacy alias for `--e-tap`. Every remaining use is tap-scale, so the alias
is safe, but new work names the curve it means.

Rules, all of them checkable:

- Animate `transform` and `opacity` only. Never `width`, `height`, `margin`, `padding`,
  `top` or `left`. The one deliberate exception is `.lo-expand`, which animates
  `grid-template-rows` because there is no transform that opens a grid row.
- Never `transition: all`. Name the properties.
- Never `ease-in` on interface motion. Entrances and exits are `ease-out`.
- Interface motion stays under 300ms. Screen arrival is 380ms and is the ceiling; it
  happens once per screen, not a hundred times a day.
- Anything that animates carries a `prefers-reduced-motion: reduce` variant **and**
  respects `body.rm-user`, the in-game OPTIONS switch for players whose OS setting is out
  of reach. The `body.rm-user` block is one generic dampener plus explicit fixes for the
  few rules whose reduce-block sets more than `animation`. Add to that block, do not
  mirror every new rule into it.
- Canvas and `requestAnimationFrame` work follows the same law restated for a frame loop.
  A frame-loop animation must be verified in a **fronted** tab: a hidden tab throttles
  rAF to zero and every assertion fails with a plausible-looking message.

---

## Primitives

Reach for one of these before inventing a class.

| Primitive | Variants | Notes |
|---|---|---|
| `.btn` | `.btn-primary`, `.btn-wave`, `.btn-sm`, `.btn-big`, `.icon-btn` | The only button. `.btn-wave` is green because it spends nothing and gains gold |
| `.panel` | `.title-panel`, `.talent-panel` | Glass surface, hairline top light |
| `.modal` inside `.overlay` | | Deeper shadow than a panel, that is the whole difference |
| `.screen` | `.hidden` | One per view, exactly one visible |
| `.chip` | `.chip.drift` | A readout in a pill |
| `.tag` | | A static label in a pill |
| `.section-label` | `.gold` | Tracked capitals above a group |
| `.hint` | `.mp-scope`, `.campaign` | Prose. Carries the 65ch measure cap |
| `kbd` | | A key name |
| `.soul-item` | `.cmd`, `.unlock`, `.origin-locked`, `.story-locked` | Shop entry |
| `.lo-card` / `.fac-card` / `.cmd-card` / `.tower-card` | | Selectable cards. All four take the same focus treatment |

**Kit rule.** A new page-specific button class is a defect. `.hero-cta`, `.footer-btn`
and `.section-action-button` are three buttons where one was needed. If `.btn` cannot do
it, add a variant to `.btn`.

## Elevation

Named, and there are three.

| Token | Value | For |
|---|---|---|
| hairline | `1px solid var(--line)` | The default. Most surfaces get this and nothing else |
| `--shadow-lift` | `0 2px 6px rgba(0,0,0,.35), 0 12px 32px rgba(0,0,0,.45)` | A panel that floats over the board |
| `--shadow-deep` | `0 24px 80px rgba(0,0,0,.75)` | Modals only |

`--glow-cyan` (`0 0 24px rgba(56,232,255,.25)`) is **not** elevation. It is the hover
signal on interactive cyan surfaces, and it is the one sanctioned glow.

### The glow exception, stated so it stops being argued

A neon halo around text is normally a generated-design tell. This project is called
"Neon Reliquary" and its glow is deliberate, so the rule is a budget rather than a ban:

- Glow is permitted on **the wordmark**, on **the focus ring**, and on **a signal that
  encodes state** (a lit bar, an armed ability, a hovered own-side card).
- Glow is forbidden on **body text, stat rows, prose, and any label the player reads
  rather than glances at**.
- Never more than one glowing element per panel.

---

## Do not

- No em dash anywhere. Not the character, not its HTML entity, not in code, copy,
  comments, commit messages or docs. Colon, comma, period or parentheses.
  `node tools/emdash.js` is the gate and it must stay clean.
- No description that opens with mood. Anything with behaviour leads with what it
  mechanically does; flavour follows, brief, italic, demarcated.
- No hand-typed colour, size, spacing value or easing curve where a token exists. Read
  the token. If the value is not a token, add it as one or comment the moment as
  deliberately bespoke. Do not type the literal and move on.
- No hand-typed `rgba(56,232,255,...)`. That is `--cyan` with an alpha, and there are 54
  of them. Use `color-mix(in srgb, var(--cyan) N%, transparent)`.
- No new `.hero-cta`-shaped class. See the kit rule.
- No card inside a card. One level of container.
- No glassmorphism as decoration. Translucency belongs to overlays and to the panel
  surface treatment that is already defined; it is not a way to make something look nice.
- No emoji as an interface icon. Emoji render differently per platform and carry tone
  nobody chose. The game's Unicode glyph marks are a knowing exception and are listed in
  the audit as debt, not as licence to add more.
- No `transition: all`, and no `transition-property` list that names a layout property.
- No number printed in the UI that the engine does not compute the same way.
  `Game.waveHpMul` is the definition. Seven desyncs have shipped on this.
- No new key on any config object without a reader you can point to. Five talents, six
  commander traits and nearly a whole boon system shipped inert. In CSS the same bug is
  a token nobody reads: `--s1` through `--s7` are the current example.

---

## Enforcement

Cheap enough to run every time.

```bash
node tools/emdash.js                 # gate 1, must report zero for files you touched
node tools/owner-sweep.js            # regression gate, via tools/headless.js
grep -rn 'rgba\?(56, *232, *255'    --include='*.css' css/    # cyan retyped
grep -rn 'font-size: *[0-9]'        --include='*.css' css/ | grep -v 'var(--t-'
grep -rn '#000\b\|#fff\b'           --include='*.css' css/
```

A design claim is unproven until measured in the browser. Reading the CSS is not
measurement: a rule can be overridden by a later rule, suppressed by a media query, or
constrained by a parent. Measure computed styles and geometry on the rendered page.

Screenshots do not composite in the in-app browser pane. Use `tools/headless.js`, which
drives `chrome.exe --headless=new` over CDP with zero dependencies. Old `--headless` is
not equivalent: it was measured reporting fail=44 against a true fail=1 on this codebase.

---

## Audit, Session 36

Measured in the running game at 1600x900 with `tools/brand_audit.js`, across ten screen
states, and re-measured against an unpatched control build with the same instrument. Kept
here because a contract that does not admit its own violations is decoration.

**Distinct WCAG AA text failures: 23 before, 4 after.**

### Fixed this session

| Finding | Was | Now |
|---|---|---|
| Faction, shop and loadout label text set in the raw identity hue | 2.31:1 to 4.36:1, nineteen distinct failures | Ink tier, `--ink-mix` and `--ink-mix-lg`. Worst surviving faction label 5.31:1 |
| No declared type scale | 29 distinct rendered sizes, eleven of them between 8.5px and 13.5px | Ten steps declared as tokens |
| No radius ceiling | 18 distinct radii, up to 20px on a content container | Five steps declared, ceiling 14px |
| Brand palette absent from CSS | Xeno violet and neon magenta existed only in `docs/BRAND.md` | `--violet`, `--magenta` tokens |
| A hand-typed `#fbbf24` inside a rule this pass already touched | literal | `var(--gold)` |

Rules moved to the ink tier: `.si-ic`, `.si-el`, `.si-og`, `.si-lock`, `.fac-name`,
`.fac-bonus b`, `.lo-el`, `.lo-top b`. Every one is on a screen no other team is
rewriting this round. The identity hue is untouched everywhere it is a fill, a stroke, a
border or a crest, so the faction cards still read as their own colour at a glance.

Regression gate after the change: `tools/owner-sweep.js` reports **pass 61, fail 0,
info 2**.

### The instrument was wrong twice before it was right

Recorded because the next person will build the same probe and get the same two lies.

1. **Focus.** The first probe called `el.focus()` and compared computed styles. It
   reported 100 percent of focusables missing a focus state, on a codebase that has a
   universal `:focus-visible` rule. In a headless page with no window focus, `:focus`
   never matches at all, so nothing changes and everything looks broken. The honest
   check copies the rule's own declarations onto a live element and measures what paints.
2. **color-mix.** Chrome serialises a computed `color-mix()` as `color(srgb 0.62 0.48
   0.90)`, channels in 0 to 1, not as `rgb()`. An `rgb()`-only reader returns transparent
   black, which composites down to the very background it is being compared against, and
   every ratio comes out at exactly **1.00:1**. A wall of identical 1.00:1 results is a
   parser failure, not a design failure. Fixing the reader also raised the control-build
   count from 21 to 23, because several pre-existing translucent `color-mix()` panel
   backgrounds had been silently skipped when compositing the ground.

### Reported, not fixed, owned elsewhere

| Finding | Sev | Location | Owner |
|---|---|---|---|
| `.mu-rolemark` sets `color: rgb(0,0,0)`, measured **1.07:1** | RED | unit card | dock |
| Tower card name clipped to 35px: "MORTAR" renders "MO..." | RED | `.tc-name` | dock |
| Econ bar prints five figures in one strip | YELLOW | `#econ-bar` | inspector |
| Ability bar renders "STEADY AIMQ", label and key with no separator | RED | `.abil` | inspector |
| Em dashes in `js/mapgen.js` (4) and `docs/MAPGEN_DESIGN.md` (2) | RED | those files | mapgen |

### Post-merge re-measurement, 2026-08-26

The gate table above was authored inside the brand lane's own sandbox, BEFORE
the four Session 36 patches were merged. Three of its verdicts were stale in
the build's favour and are corrected above. What actually changed:

- `.mu-rolemark` no longer renders. The dock patch took it off the unit card
  face for owner item A3, which removed both the G5 pure-value case and one of
  the four G4 residuals without the brand lane doing anything.
- `.tal-arrow` now carries `aria-hidden="true"`. It is a decorative edge: the
  `.tal-node` beneath it already renders owned / can / locked / ready and states
  the reason in its own title, so the prerequisite is conveyed independently.
  WCAG 1.4.3 exempts content hidden from assistive technology, which is what
  this contract asked a future maintainer to decide. The dim state stays
  deliberately recessive and lights gold when the parent unlocks.
- The two `.si-ic` glyph marks did not appear in the post-merge sweep at all.

Method, so this is reproducible rather than claimed: `contrast_sweep.js` walks
every element carrying its OWN text, composites translucent ancestors down to
an opaque ground, and applies 3:1 for large text (>=24px, or >=18.66px at
weight >=700) and 4.5:1 otherwise. Elements that are zero-sized, `display:none`,
`visibility:hidden`, under 0.95 opacity or filtered are excluded, because a
reading taken through a filter is a lie. `aria-hidden` subtrees are exempted
but COUNTED, so an exemption can never quietly absorb a real failure.

| Screen | Elements checked | Distinct failures | Pure black/white |
|---|---|---|---|
| screen-title | 5 | 0 | 0 |
| screen-multiverse | 26 | 0 | 0 |
| screen-faction | 20 | 0 | 0 |
| screen-command | 67 (+6 aria-exempt) | 0 | 0 |
| screen-loadout | 10 | 0 | 0 |
| screen-theatre | 55 (+6 aria-exempt) | 0 | 0 |
| screen-game | 70 | 0 | 0 |

One caution for whoever runs this next. An early pass flagged a `<b>` reading
"SCARLET" at 4.06:1. It did not reproduce on two subsequent runs, and the
diagnostic showed why: the node is inside `.overlay.hidden`, its rect is 0x0,
its computed colour is the ordinary `rgb(226,238,250)`, and `elementFromPoint`
at its centre returns `body`. It does not render. That run was competing with a
full disk and a second headless browser. Nothing was changed for it. Reproduce
before you fix, or you will restyle something the player never sees.

### Standing debt, nobody's lane yet

| Finding | Sev | Detail |
|---|---|---|
| `--s1` to `--s7` read by zero rules | RED | Seven dead tokens; all spacing hand-typed |
| `--dim`, `--fg-2`, `--font-ui`, `--accent`, `--lo-expand` referenced with no definition anywhere | YELLOW | Each silently renders its fallback forever. `--font-ui` falls back to `ui-monospace`, so that rule renders in the face the font flip was meant to retire |
| `--fa` set on every faction card, read by one rule out of the forty-six that read `--fc` | YELLOW | The ink rule is the reader it was missing |
| Unicode glyphs used as interface icons | YELLOW | Inconsistent weight and optical grid across a set |
| Card inside a card on the loadout empty states | YELLOW | `.lo-card` contains a bordered panel containing a `.btn` |
| `.tal-arrow` at 1.75:1 | GRAY | Decorative connector on the commander tech chart. Exempt from AA only if it is genuinely decorative; if it is the only cue for a prerequisite, it is not, and it needs `aria-hidden` either way |
| Two `.si-ic` glyph marks at 3.80:1 and 3.83:1 | GRAY | Above the 3:1 this contract sets for a non-text UI component, below the 4.5:1 a text reader would ask of them. The classification is stated in the ink rule; if a future reviewer disagrees, the number to move is `--ink-mix-lg`, not the rule |
| Faction cards lead with a creed and two lines of prose before the mechanic block | YELLOW | Mechanics-first says the behaviour comes first and the flavour follows in italics. The creed is already italic and demarcated; the ordering is inverted |
| Commander bios open with mood ("No doctrine, no appetite, no vow") | YELLOW | Same rule. The mechanic is present, in the named trait block below, but the reader meets the flavour first |
| `.lo-card` empty states put a bordered panel and a `.btn` inside a card | YELLOW | Card inside a card, twice on the loadout screen |

### Slop detector pass, every row that fired

Forty detectors run over the whole interface. Twenty-eight did not fire. The twelve that
did, with where:

| # | Detector | Sev | Where | Verdict |
|---|---|---|---|---|
| 1 | Unowned accent | RED | none | Does not fire. Five hues, five stated jobs, all traceable to `docs/BRAND.md` |
| 2 | Purple or violet gradient | RED | title backdrop, galaxy plates | **Does not fire.** These are generated raster key art in a locked art identity that names violet and magenta, not a CSS gradient nobody chose. The rule generalises to "unowned", and this hue is owned |
| 3 | Neon glow or halo around text | RED | wordmark, `.btn-primary`, lit bars | Fires literally, **accepted under a written budget**. See the glow exception above. Body text and stat rows carry no glow |
| 4 | Pure `#000` or `#fff` | RED | `.mu-rolemark`, plus 9 CSS literals | Fires. One is painted and measured at 1.07:1 |
| 12 | Font sizes off a defined scale | YELLOW | everywhere | Fired. 29 rendered sizes against no declared scale. Scale now declared; the migration is debt |
| 16 | Three equal feature cards in a row | RED | faction screen, tech chart | **Does not fire.** Four faction cards because there are four factions, and a three-column tech chart because the tree has three lines. Structural, not decorative |
| 17 | Card inside a card | RED | loadout empty states | Fires, twice |
| 19 | Corner radius 24px or more | YELLOW | none | Does not fire. Largest content radius measured 20px, now capped at 14px by contract |
| 20 | Drop shadow on every card | YELLOW | one shared selector list, **11 selectors**, `polish.css` line 38 | Fires. `--shadow-lift` reaches `.panel`, `.setup-main`, `.setup-rail .cmd-card`, `.title-panel`, `.theatre-detail`, `.worldmap-wrap`, `.modal`, `.talent-panel`, `.lo-card`, `.diff-pill`, `.fork-card` in one rule. A hairline is the stated default and it is not what most of these get |
| 21 | Glassmorphism as decoration | RED | the same 11-selector rule, `backdrop-filter: blur(14px) saturate(1.15)` | Fires. Justified for `.modal` and the HUD, which sit over a live board. Not justified on `.title-panel` or `.diff-pill`, which sit over a static backdrop |
| 26 | Hand-rolled SVG icons | RED | tech chart and shop glyphs | Fires on the glyph set. **Does not fire on `.title-emblem`**: measured `display: none`, deliberately retired with a comment at `polish.css` line 1240. It is dead weight rather than a design defect, and 46 lines of unused SVG still ship in `index.html` and in both bundles |
| 27 | Emoji as interface icons | RED | soul shop and map nodes | Fires. The fire glyph in the shop and on the board is a colour emoji and renders per platform. The rest of the glyph set is monochrome Unicode |
| 34 | Page-specific button classes | RED | none | Does not fire. One `.btn` with variants, plus `.icon-btn` |
| 36 | Em dash in shipped copy | RED | `js/mapgen.js`, `docs/MAPGEN_DESIGN.md` | Fires, 6 occurrences, outside this lane |
| 37 | Description opening with mood | RED | commander bios, faction cards | Fires |
| 40 | Contrast below AA | RED | 23 sites | Fired. 19 fixed |

### Gates, measured

| Gate | Verdict |
|---|---|
| G1 zero em dashes | PASS. Was FAIL at six in two files outside this lane; closed 2026-08-26, `node tools/emdash.js` reports 0 across the repo |
| G2 one theme per page | PASS, every screen dark, ground never crosses 50% lightness |
| G3 one accent, or a stated job per accent | PASS by the table above, five hues, five jobs |
| G4 WCAG AA on all text | PASS. **23 distinct failures before, 0 after**, re-measured post-merge across all seven screens |
| G5 no pure black or white | PASS. The one live case was `.mu-rolemark`, which the dock patch removed from the card face; 0 pure values measured on all seven screens |
| G6 button labels fit one line | PASS. 127 buttons measured across ten screen states, zero genuine wraps. The nine flagged `.tal-node` hits are a glyph above a count, two lines by design |
| G7 primary nav one line, 80px max | N/A, this game has no nav bar |
| G8 visible focus state | PASS. The universal `:focus-visible` rule paints `2px solid rgb(56,232,255)` at `2px` offset, measured at 13.51:1 against the ground |
| G9 reduced-motion variant | PASS, OS media query plus the in-game `body.rm-user` switch |
| G10 hero resolves in viewport | PASS on the title screen |
| G11 no horizontal page scroll | PASS on every screen at 1600x900 |
| G12 descriptions lead with mechanics | MIXED, tower and unit copy passes, commander bios open with flavour |
