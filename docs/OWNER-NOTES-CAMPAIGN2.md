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
`[~]` Catalogue appended: 50 wide cutscene plates and cmd_ashtar plus
cmd_isa through the approved cmd_ composition (the commander art class is
complete at 26/26; two new commanders without plates would be the
partial-class violation BRAND.md forbids). Prompts follow the file's own
token-cliff law: subject first, faction palette second, STYLE tail last.
One-image timing measurement in flight; the batch runs on its number, with
SDXL-Turbo (measured 4.5s) as the fallback if turbo is not sane.

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
- `[ ]` Cutscene art: verify each rendered plate reads at 576px against its
  slide text, and re-roll the misses by key (`--force cut_...`).

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
