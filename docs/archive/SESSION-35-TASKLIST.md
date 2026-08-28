# Session 35 task list

Tracked per standing rule: multi-item requests get a tracked list file.
Source: owner's live reaction to the shipped Session 34 HUD, one message,
several distinct asks.

- [x] 1. DONE. Moved play/pause/speed/immersive/battlecard/settings out of
      #hud-rivals into their own #battle-controls bar, bottom right in both
      display modes, same floating-card chrome as #dock. YOU and RIVAL cards
      are now both just a commander card -- measured #hud dead centre (0px
      off viewport centre) before and after, but the two side cards are now
      actually comparable in width, which is what "symmetrical" meant.
      Found a real follow-on bug while checking this at 1366x768 (the
      project's own reference laptop size): #dock and the new bar can
      genuinely overlap below ~1536px wide (measured 85px of horizontal
      overlap, #dock-shop drawn on top and visibly covering the pause/1x
      buttons). Fixed with a `@media (max-width: 1550px)` rule that anchors
      #battle-controls from the top instead of the bottom below that width --
      verified clean (zero real overlap against the visible RIVAL card, the
      dock, and the board) in both modes at 1366x768, and confirmed the rule
      does not affect the normal bottom-right position at 1600x900.
- [x] 2. Bottom dock symmetry -- all sub-items done:
   - [x] 2a. DONE. engineStripHtml() (the "THE PROCESSION" row) is now
         doctrineInfo(), returning a tooltip string instead of dock HTML,
         set on a new #my-cmdr-tag id (YOU's own tag in the top bar) every
         syncLive() tick. #muster-bar no longer renders it at all.
   - [x] 2b. DONE. Root cause was real and specific: .tc-name had no overflow
         handling at all (unlike .tc-role, which already ellipsized), and at
         the dock's 2-column card width only ~35px was left for the name
         column after the hotkey, icon and cost -- HUNGERING VEIL and PRESS
         GANG (real tower names, 14 and 10 characters) could never have fit
         regardless of spacing. Added the same white-space/overflow/
         text-overflow .tc-role already had, plus trimmed .tc-og's margin.
         Verified: RECKONING/CANISTER/ICHOR/PHAROS (the exact names from the
         owner's screenshot) all ellipsize cleanly with zero overlap now.
   - [x] 2c/2d. DONE together. The econ bar (.muster-head) moved from
         #muster-bar to a new #econ-bar div in #dock-inspector, directly
         under BASE LEVEL, rendered by a new syncEconBar(). The "BANKED +N
         interest next wave" row is gone; its number now lives as one more
         compact "◈+N" segment on the relocated bar. Found and fixed a real
         overflow this move caused: the bar picked up a 5th segment while
         moving to a narrower pane (300px vs the old 328px), measured 290px
         of content against 276px available. Tightened gaps/padding for the
         common case AND added flex-wrap as a hard safety net -- verified
         with an artificially maxed economy (wave 40, capped income, 5-digit
         gold) that it wraps to a second line instead of overflowing, while
         the ordinary case still renders on one line.
   - [x] 2e. DONE, the biggest single piece of this session. Dispatched an
         Explore agent first to map the mechanic's full footprint before
         touching anything -- it came back with every touch point across
         config.js (constants), game.js (state + 3 functions + startWave's
         per-side multipliers), ui.js (the button, the live banner, 2 cache
         keys), ai.js (a real rival decision path, unconditional constant
         reads that were NOT actually guarded the way they looked), net.js
         (3 separate wire-protocol registrations plus the per-tick desync
         fingerprint), and both test suites. Removed the whole player-facing
         spend-gold-for-a-harder-wave mechanic end to end. Deliberately KEPT
         the inert `rageMul` plumbing in reanimate/corpseBudget/splitInto
         (entities.js, game.js) rather than chase it through ~9 sites in
         code the project's own comments flag as having shipped the same
         subtle bug seven times -- it now always evaluates to 1, functionally
         a no-op, at zero behavioural risk. Found and fixed a real
         regression from the removal itself: owner-sweep's check 14.1 used
         to scan the bundle's raw innerHTML for the mechanic's name; since
         this build inlines every JS module as an inline <script>, that scan
         also caught this session's own code comments explaining the removal
         and produced a false failure. Rewritten to check real behaviour
         instead (Game.buyEnrage/enrageCost are gone, #btn-enrage never
         renders, Side state carries no enrage field) -- immune to what any
         comment anywhere says. multiplayer_test.js's 'rage' action mapping,
         schedule entries and deepState() comparison removed to match.
   - [x] 2f. DONE as a consequence of 2a-2e, not a separate change. Measured:
         #dock-muster dropped from 234px to 157px tall (at 1600x900, the
         same loadout used throughout this session), and the muster-vs-shop
         height gap the owner flagged shrank from 98px to 29px -- the
         remaining gap is the same honestly-documented, content-driven
         difference noted in SESSION-34-TASKLIST.md (muster cards show one
         more figure per card than a tower card does), now much smaller
         since the two standing header rows are gone.
- [x] 3. DONE. wavePanel()'s roster is now icon+count .mob-chip spans
      (flex-wrap, several per line) instead of one full-width .roster-row
      grid per mob type; name, traits and per-body HP moved into the
      tooltip, same pattern the muster and shop cards already use. Verified
      the chip renders correctly (icon canvas + ×N) with a real wave profile.

Verified throughout with real headless-Chrome screenshots and DOM
measurement at 1600x900 and 1366x768, both display modes, using the exact
loadout (ichor/reckoning/pharos/canister, faction light) from the owner's
own screenshot to reproduce the reported issues before fixing them. Full
gate suite green at the end: owner sweep 61/61 (58 pre-existing + 3 new
behavioural checks replacing the 2 the enrage removal made obsolete), MPT
37/37, mutation detection 8/8 with the clean control staying green, 0 em
dashes, 0 bad bytes across 148 files.
