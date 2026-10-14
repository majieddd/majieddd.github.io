# Owner notes: campaign polish batch 2 (2026-08-26)

Tracked per the standing rule. Status moves to done only with the measurement
that proves it. Legend: `[ ]` open, `[~]` in flight, `[x]` done and measured.

## A. Roster and canon alignment

### A1. Ashtar as a selectable commander
`[x]` **MEASURED:** roster is 28. ASHTAR sits LAST on the Federation shelf
with a full kit (sanctify/bulwark, FIRST SPEAKER trait, 9-node chart) and an
opener line. `noSeat` keeps every boss and fork pool byte-identical
(fingerprint-verified across 60 generations), which is what makes appending
him safe under in-flight saves. NET_PROTOCOL 6 to 7, because a duel between
a build with him and one without desyncs the moment he is fielded.

### A2. Human commanders represent countries
`[x]` **MEASURED live:** MAR. WASHINGTON (Americas), GEN. OKAFOR (Africa),
CHF. O'RYAN (Europe), DR. TANAKA (Asia), DIR. REYES (Latin America). The
coalition was every nation or it was nothing. Ids untouched; blurbs match.

### A3. ISA, the secret human commander
`[x]` **MEASURED:** hidden from every list until `galaxyTier >= 1` under the
human banner (`commanderSecretLock`), because a secret that advertises
itself is a menu item. Kit is the pacifist reading of the engine (THE QUIET
WORD: lives, recovery, weaker echoes), opener written, `noSeat`. The Issa
fragments are presented as a contested record his followers argue about,
never a verdict about anyone's faith, per the canon guardrails.

## B. Progression gating

### B1. Commander soul ladder
`[x]` **MEASURED on a fresh profile:** each successive commander of the
banner needs one more lifetime conquered system before souls can buy them:
aurelia need1, lumen need2, cantor need3, halder need4, ashtar need5.
Purchase refused while locked, opens exactly on the rung. The migration
seeds veterans from `galaxyTier * 5` using RAW FIELDS ONLY, because the
first draft called storyPending() from inside load() and recursed the stack
to death.

### B2. Heavy (2x2) towers gated by galaxies
`[x]` **MEASURED:** within each origin the first heavy asks a first
conquered galaxy and the second asks a third (bombard gal1, coldfront gal3,
quadmount gal1, reactor gal3). Purchase refused at tier 0, the shop prints
CONQUER GALAXY N (have/need), and anything already owned stays owned.

### B3. One unit per conquered planet, sometimes none
`[x]` **MEASURED across a full conquered galaxy:** max 1 unit per world,
zero on non-paying worlds, 11 total vaulted where the old rule dumped whole
map rosters at once. The Session-29 cadence gate now governs BOTH rescue
tracks, and the pick chain is holder's soldier, else your garrison's, else
the first new board creature, else nothing. The first cut vaulted a creature
before deciding and paid 2 on one world; vaulting now happens once, capped
inside saveDenizens.

## C. Story delivery

### C1. Faction-select cutscenes, THE OATH
`[x]` **MEASURED in a real browser:** five slides per faction on swearing a
banner, all five factions including the secret one. Image fades in and
slow-zooms, text arrives word by word, a click lands the text and a second
turns the page, SKIP fires done exactly once, reduced motion collapses to
instant, and missing art degrades to the faction crest on a gradient so the
engine ships before the renders do.

### C2. Post-system cutscenes, THE TURNING
`[x]` **MEASURED:** plays on the end screen's continue after a genuinely
conquered system (driven through Meta.recordWorld, not faked) and routes to
the galaxy afterward. Act index equals systemsTaken minus one, the same
index the beat card uses, so the two can never tell different chapters.

### C3. Images via Krea 2, within reason
`[x]` **MEASURED, and the answer to "within reason" was to change pipeline.**
52 keys rendered: 50 wide plates plus cmd_ashtar and cmd_isa, closing the
commander class at 28/28 (a partial art class is what BRAND.md forbids
outright). Prompts follow the file's token-cliff law: subject first, faction
palette second, STYLE tail last, and the batch's CLIP warnings confirm it,
only the redundant STYLE tail truncated.

Krea 2 costs ~83 min per image on the 12GB card, so 52 images is three days.
SDXL-Turbo rendered the batch in 43s of GPU time, 0.7s each. The two-tier
pack exists for this: `--pack` prefers `cache_krea/<key>.webp` per key and
falls back to `cache/`, so any single plate upgrades later without touching
the other 51. Krea 2 on stronger hardware is now a handover, see
`docs/HANDOVER-KREA-ART.md`.

Verified in a browser, not by reading the pack: 52/52 decode as images, 0
missing, 0 broken, 50 at 576x324 and 2 at 320x320, and the oath paints a
real `<img class="cs-art">` rather than the crest fallback.

**Session 37: the handover was executed. The interim tier is retired.**

All 52 keys re-rendered on Krea 2 Turbo on Hermes (RTX 5090 Laptop, 24GB,
Blackwell sm_120, torch 2.11.0+cu128). Measured, not estimated:

| Number | Value |
|---|---|
| Per image, 1920x1080 | **48.4s sustained** (44.4s cold), against 83 min on the 12GB 4080 |
| The 48 plate batch | 2315s, 38.6 min wall clock |
| The 2 portraits | 24.0s and 24.7s, square path, out_px 320 unchanged |
| VRAM, whole run | **7.8 / 23.9 GiB after load, 10.2 GiB peak**, 42% of the card |
| Quantisation | 4-bit NF4. 8-bit was tried first and bitsandbytes 0.50.2 int8 is broken on this torch |
| `js/artpack.js` | 9.43MB to **19.54MB** |
| `aegis-protocol.html` | 11.48MB to **22.03MB** |
| Repack | 281 passed through, **0 re-encoded**, so no cumulative requantisation |
| Browser probe | 52 decoded, 0 missing, 0 broken, `naturalWidth` **1920** on all 50 plates, 320 on both portraits, 0 console errors |
| Gate | GATE CLEAN, owner-sweep pass=62 fail=0, mpt pass=37 fail=0 |

Two decisions were taken inside the latitude the handover granted, both
recorded with their evidence in `docs/BRAND.md`:

1. **Render 1920x1080 native, not the 2304x1296 supersample.** Both were
   rendered on the same key and compared. The supersample buys engraved
   linework and costs faction colour: the `{STYLE}` vaporwave tail took the
   frame and hot magenta displaced the human steel blue. These plates are
   backdrops behind dialogue, so faction legibility outranks linework.
2. **WebP quality 82 for the `cut` class.** It had no `QUALITY` entry and was
   silently taking the default 86.

**AVIF was measured and does NOT help this content.** The reference estimated 30
to 50% smaller at matched quality. On a real plate: AVIF q70 is 94% of WebP q82
and AVIF q80 is 125% of it. Only q60 saves anything (71%) and that is a visible
quality drop. Flat painterly art with large uniform regions is what WebP is best
at. The lever is not available; do not re-try it.

**OPEN, and the owner's call: the first-load weight.** See section G below.

Plate width stays 576 deliberately. The art is a full-bleed backdrop, so a
1600px desktop upscales 2.80x, and the byte count predicted softness. The
screenshot refuted it: flat painterly brushwork has no fine detail for an
upscale to lose. Larger is not available on this card regardless, 1152x648
pinned it at 11.9/12.3 GiB and thrashed, the same VRAM cliff krea_gen.py
already documents. artpack 6.66MB to 9.43MB, bundle 11.48MB.

### C4. Victory dialogue, THE LAST WORD
`[x]` **MEASURED:** two lines on a win, one on a loss, keyed by the defeated
banner, deterministic, and silent on commanderless worlds (Game.soloSurvive)
because there is nobody standing there to say anything.

## D. Generation

### D1. More Vigil neutral worlds
`[x]` **MEASURED across 12 galaxies:** nests 47 to 69 (+47%) under kind
weight set v2. The kind roll consumes one rnd() per world either way, so
the stream never moves; outcomes are state, so campaignStart pins
`c.kindsW = 2` and unpinned campaigns regenerate byte-identical v1 forever,
fingerprint-verified.

## E. Follow-ups surfaced by this batch

- `[ ]` The co-contributor's 8 new procedural boards have no worldlore
  entries yet; the briefing falls back to owner/kind lines (nothing blank),
  and authored WAS/NOW records should follow once their board designs
  settle.
- `[ ]` Cutscene art: verify each plate reads against its slide text, and
  re-roll the misses by key (`--force cut_...`). Best done AFTER the HD pass
  rather than against the current 576px interim tier, since re-rendering on a
  different model re-rolls the image anyway and a miss judged now may not
  survive. Owned by the HD handover: `docs/HANDOVER-KREA-ART.md`.
- `[x]` **HD art pass: DONE, Session 37.** 52 keys at 1920x1080 on Krea 2 on
  the 5090, 48.4s per image, gate clean. Numbers in C3, decisions in BRAND.md,
  the one open question in section G.
- `[x]` **Read the fifty plates against their slide text. DONE, Session 38.**
  All 50 read on contact sheets pairing each plate with the line it ships
  under (`artgen/review_sheet.py`, six to a sheet, nine sheets).

  **48 of 50 read correctly**, several of them exactly: `light_sys2` shows a
  page stamped DEFERRED three times, which is its line verbatim;
  `xeno_sys3` shows the matriarch holding the captured human rifle;
  `human_sys4` stacks the supply crates into the fence line the text warns
  about; `pirate_intro_4` splits the hold between medicine and the sealed
  container; `robot_intro_3` is a wall of hostile red glyphs with a few calm
  blue ones left. `pirate_intro_2` is the multi-species free port the owner
  later asked the content law to guarantee, rendered before the law existed.

  **Two missed and were re-rolled.** `robot_intro_4` had rendered humans in
  business suits around a robot, on the one faction that is machines only;
  `pirate_sys3` had no captain and no wheel. Both are now variant 1.

  **Neither re-roll is a clean hit and that is worth saying.**
  `robot_intro_4` v1 replaces the businessmen with hooded figures around a
  standing automaton: better, and still not the "identical siblings" the
  brief asks for. `pirate_sys3` v1 gains the wheel its line is about but is
  still a ship on WATER rather than in space, and no variant will fix that,
  because the prompt never says space. Variant 2 was rendered for both and
  measured worse; v1 is what ships.

  `[ ]` **Owner decision: `pirate_sys3`'s prompt has no space cue.** Fixing
  it properly means editing the prompt, which the class law forbids without
  an owner instruction. Say the word and it is one line.

  Minor, recorded and NOT acted on: a few plates carry incidental lettering
  (a "MEDICE" crate stencil, CJK-looking glyphs on three robot plates)
  against a STYLE that asks for no text, and three plates lean photoreal
  where the rest are flat-painted (`human_intro_5` moon, `human_sys1` Earth,
  `light_intro_2` Earth). All are judgement calls rather than misses.

## F. Cross-checks the batch held to

- Stable ids never move; new commanders APPEND and the wire fence moved
  (NET_PROTOCOL 7).
- New save keys are additive with raw-field migration defaults.
- No new Math.random anywhere in a presentation path; cutscenes draw
  nothing.
- Openers exist for every roster commander, including the two new ones.
- Naming stays byte-identical under the fingerprint; kind weights change
  only under the per-campaign pin.
- gate.js full run green at every commit: owner-sweep 61/0/2, MPT 37/0/2.

## G. RESOLVED: the first-load weight (Session 37)

The HD tier doubled the bytes players download before they see anything. This
is flagged rather than absorbed because `docs/HANDOVER-KREA-ART.md` names it an
owner decision, and because the levers below are not all reversible.

| Path | Today | After the HD tier |
|---|---|---|
| `js/artpack.js`, the FIRST LOAD path | 9.43MB | **19.54MB** |
| `aegis-protocol.html`, a download | 11.48MB | 22.03MB |

The live site has no build step: players load `js/artpack.js` as its own file,
so the first number is the one that matters. The 50 plates are 13.0MB of that
19.54MB, and a player sees each one **at exactly one story moment**.

### The levers, measured

| Lever | Result | Verdict |
|---|---|---|
| Lower WebP quality | q70 saves 3.4MB of 19.54MB, q78 saves 1.4MB | **Poor trade.** It degrades every plate to move the total from very heavy to heavy |
| AVIF | 94% of WebP at matched quality, 125% at q80 | **Not available.** Measured, see C3 |
| Supersample then pack down | No byte change, wrong on art direction | Already rejected, see BRAND.md |
| **On-demand loading of the `cut` class** | Removes **13.0MB** from first load | **The real answer, and an architecture change** |

### Recommendation

**Ship the plates as rendered at q82, and move the `cut` class off the inline
path in a follow-up.** Reasoning:

- Compressing harder is the wrong axis. It pays in visible quality across all
  fifty plates to save a sixth of the weight, and the plates are the deliverable.
- On-demand loading is the only lever with the right shape: it is the whole
  13.0MB, it costs no quality, and full-screen art seen once at a scripted
  moment is the strongest candidate in the catalogue for it.
- It is not a change to make silently: it breaks the single-file bundle promise,
  which is a stated property of this project. That is why it is here and not
  done.

**If the doubled first load is not acceptable even as an interim state**, say so
and the plates stay in `cache_krea/` unpushed until on-demand loading lands. The
art is rendered and cached either way; nothing needs re-rendering.

### Resolved, same session: on-demand loading landed

The owner chose to ship the plates and follow with on-demand loading. It is
done, and the outcome is better than the recommendation predicted.

`write_pack()` now takes an `ONDEMAND_CLASSES` set. A key whose class is in it
is written as a real file under `art/<key>.webp` and referenced from the pack
by URL instead of being base64 inlined. Nothing downstream changed, because
`art(key)` hands whatever string it finds straight to an `<img src>` and a URL
works there exactly as a data URI does. The five other ARTPACK readers test
existence or build a `url()`, and a URL string is truthy and valid in both.

| Path | Before HD | HD inlined | **HD on demand** |
|---|---|---|---|
| `js/artpack.js`, FIRST LOAD | 9.43MB | 19.54MB | **6.44MB** |
| `art/`, fetched per slide | n/a | n/a | 9.83MB across 50 files |
| `aegis-protocol.html`, a download | 11.48MB | 22.03MB | 22.01MB |

**The first-load path is now 32% smaller than it was BEFORE the HD upgrade**,
while the plates carry 11.1x the pixels. Two effects compound: the 50 plates
left the inline path entirely, and what does get fetched is raw bytes rather
than base64, which drops the 4/3 tax.

The single-file promise is kept. `build.js` inlines `art/` back to data URIs
for the bundle and only for the bundle, and refuses to write one that still
references an `art/` URL, because such a bundle would paint the crest fallback
silently. CI runs `build.js` from a fresh checkout, so a missing plate fails
the deploy loudly instead of shipping a hole.

`js/cutscenes.js` warms slide N+1 when slide N renders. Typing a slide costs
90ms per word and no plate approaches that, so the page turn stays instant. The
line is a no-op when the pack is inlined, as it is in the bundle.
