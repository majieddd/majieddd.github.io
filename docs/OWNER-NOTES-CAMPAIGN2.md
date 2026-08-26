# Owner notes: campaign polish batch 2 (2026-08-26)

Tracked per the standing rule. Status moves to done only with the measurement
that proves it. Legend: `[ ]` open, `[~]` in flight, `[x]` done and measured.

## A. Roster and canon alignment

### A1. Ashtar as a selectable commander
`[x]` **MEASURED:** roster is 28. ASHTAR sits LAST on the Federation shelf
with a full kit (sanctify/bulwark, FIRST SPEAKER trait, 9-node chart), an
opener line, and `noSeat`, which keeps every boss and fork pool
byte-identical (fingerprint-verified across 60 generations). NET_PROTOCOL
6 to 7, because a duel across builds desyncs the moment he is fielded. The owner expected Ashtar selectable, not only a story figure. Build a
full playable commander: light faction, appended LAST in roster order (the
last Federation commander), kit from existing ability ids, conservative
trait, full tech chart, opener line, procedural portrait until art lands.

### A2. Human commanders represent countries
`[x]` **MEASURED live:** MAR. WASHINGTON, GEN. OKAFOR, CHF. O'RYAN,
DR. TANAKA, DIR. REYES. Ids untouched; blurbs updated to match. Rename again, owner spec: a WASHINGTON for America, plus one African,
one European, one Asian, one Latin name. Plan (ids never move):
vess -> MAR. WASHINGTON (America, the Marshal leads the fleet),
korrin -> GEN. OKAFOR (Africa), orin -> CHF. O'RYAN stays (Europe, Irish),
nyx -> DR. TANAKA (Asia), vanta -> DIR. REYES (Latin America).
Blurb name references updated to match.

### A3. ISA, the secret human commander
`[x]` **MEASURED:** hidden from the shop until `galaxyTier >= 1` under the
human banner (`commanderSecretLock`), `noSeat`, kit is the pacifist reading
of the engine (THE QUIET WORD: lives, recovery, weaker echoes), opener
written. The Issa fragments are presented as a contested record, per the
canon guardrails. Unlocked by finishing the game as a human (first galaxy conquered under
the human banner). A wanderer with powers whose followers tie him to the Issa
fragments, the old texts about a teacher who travelled east. In-world it is a
CONTESTED RECORD, per the canon guardrails: the game never asserts real
theology, it presents the mythos the disclosure era argued about. Hidden
until unlocked (a secret that advertises itself is a menu item).

## B. Progression gating

### B1. Commander soul ladder
`[x]` **MEASURED on a fresh profile:** aurelia need1, lumen need2, cantor
need3, halder need4, ashtar need5; purchase refused while locked; opens
exactly when `sysTaken` reaches the rung; migration seeds veterans from
`galaxyTier * 5` in RAW FIELDS ONLY, because the first draft called
storyPending() from inside load() and recursed the stack to death. Each successive commander of your faction becomes purchasable only
after conquering one more solar system (lifetime, this profile). Free
commander at 0; each next roster slot needs one more conquered system.
Ashtar, appended last, lands naturally at the top of the ladder.

### B2. Heavy (2x2) towers gated by galaxies
`[x]` **MEASURED:** bombard gal1, coldfront gal3, quadmount gal1, reactor
gal3 (first and second heavy of each origin), purchase refused at tier 0,
shop prints CONQUER GALAXY N (have/need). Grandfathered by construction. Per faction: first heavy purchasable after conquering galaxy 1
(galaxyTier >= 1), second after galaxy 3 (galaxyTier >= 3). Grandfather rule
holds: anything already owned stays owned.

### B3. One unit per conquered planet, sometimes none
`[x]` **MEASURED across a full conquered galaxy:** max 1 unit per world,
zero on non-paying worlds (the Session-29 cadence gate now governs BOTH
tracks), 11 total vaulted where the old rule dumped whole map rosters. The
first cut vaulted a board creature before deciding and paid 2 on one world;
the chain now vaults once, capped inside saveDenizens. Conquest currently vaults the world's whole denizen roster. Change to
AT MOST ONE unit per world, deterministic from the world id, with some worlds
paying no unit at all, so the muster vault grows little by little.

## C. Story delivery

### C1. Faction-select cutscenes
`[x]` **MEASURED in a real browser:** THE OATH, five slides per faction,
plays on swearing a banner and completes exactly once; word-by-word text, a
click lands it, a second turns the page; SKIP fires done exactly once;
reduced motion collapses to instant; missing art degrades to the crest on a
gradient. All five factions including the secret one. Five-scene slideshow on swearing a banner: image fades in, slow zoom,
text appears word by word. All five factions including the secret one. Art in
the house style (Tyranny-inspired duotone cyberpunk comic, per BRAND.md and
the artgen pipeline's own style prompt).

### C2. Post-system cutscenes
`[x]` **MEASURED:** THE TURNING plays on the end screen's continue after a
genuinely conquered system (driven through Meta.recordWorld, not faked) and
routes to the galaxy after. Act index = systemsTaken - 1, the same index the
beat card uses, so the two can never tell different chapters. After each conquered solar system, a short slideshow advancing that
act of the faction's story, distinct from (and not duplicating) the beat
card on the reward screen.

### C3. Images via Krea 2, within reason
`[~]` Catalogue appended: 50 cutscene plates (wide, 576px ship size) + 2
commander portraits through the approved cmd_ composition, prompts composed
under the file's own token-cliff law (subject first, palette second, STYLE
tail last). One-image timing measurement in flight; the batch runs on its
number. Measure one krea2-turbo render FIRST. If per-image time is sane, batch:
5 intro slides x 5 factions, plus per-system interstitial art, plus
cmd_ashtar and cmd_isa portraits (the commander art class is complete at
26/26 and two new commanders without plates would be a partial-class
violation). If turbo is not sane, fall back to SDXL-Turbo (measured 4.5s).

### C4. Victory dialogue
`[x]` **MEASURED:** two lines on a win, one on a loss, keyed by the defeated
banner, silent on commanderless worlds (Game.soloSurvive). A short exchange after winning, only where it makes sense: a
commander-led world yields a line, a commanderless world does not.

## D. Generation

### D1. More Vigil neutral worlds
`[x]` **MEASURED across 12 galaxies:** nests 47 to 69 (+47%) under weight
set v2, pinned per campaign (`c.kindsW = 2` at campaignStart). The v1 path
is byte-identical, so in-flight campaigns regenerate exactly as before. Raise the nest kind weight so Vigil-garrisoned neutral planets actually
appear, especially commanderless swarm worlds. MUST be pinned per campaign
(new campaigns only), because galaxies regenerate from seed and changing
weights under an in-flight save would rewrite its worlds. Same pattern as the
existing mapPool pin.

## E. Cross-checks the batch must not break

- Stable ids never move; new commanders APPEND (wire carries ids).
- New save keys are additive with migration defaults (persistence reference).
- No new Math.random in any presentation path; cutscenes draw nothing.
- Openers exist for every new commander (the 5-missing-openers lesson).
- Fingerprint: naming stays byte-identical; kind weights change ONLY under
  the per-campaign pin, old campaigns regenerate identically.
- Gates green at every commit: gate.js full run.
