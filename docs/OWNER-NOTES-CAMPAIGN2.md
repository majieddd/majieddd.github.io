# Owner notes: campaign polish batch 2 (2026-08-26)

Tracked per the standing rule. Status moves to done only with the measurement
that proves it. Legend: `[ ]` open, `[~]` in flight, `[x]` done and measured.

## A. Roster and canon alignment

### A1. Ashtar as a selectable commander
`[ ]` The owner expected Ashtar selectable, not only a story figure. Build a
full playable commander: light faction, appended LAST in roster order (the
last Federation commander), kit from existing ability ids, conservative
trait, full tech chart, opener line, procedural portrait until art lands.

### A2. Human commanders represent countries
`[ ]` Rename again, owner spec: a WASHINGTON for America, plus one African,
one European, one Asian, one Latin name. Plan (ids never move):
vess -> MAR. WASHINGTON (America, the Marshal leads the fleet),
korrin -> GEN. OKAFOR (Africa), orin -> CHF. O'RYAN stays (Europe, Irish),
nyx -> DR. TANAKA (Asia), vanta -> DIR. REYES (Latin America).
Blurb name references updated to match.

### A3. ISA, the secret human commander
`[ ]` Unlocked by finishing the game as a human (first galaxy conquered under
the human banner). A wanderer with powers whose followers tie him to the Issa
fragments, the old texts about a teacher who travelled east. In-world it is a
CONTESTED RECORD, per the canon guardrails: the game never asserts real
theology, it presents the mythos the disclosure era argued about. Hidden
until unlocked (a secret that advertises itself is a menu item).

## B. Progression gating

### B1. Commander soul ladder
`[ ]` Each successive commander of your faction becomes purchasable only
after conquering one more solar system (lifetime, this profile). Free
commander at 0; each next roster slot needs one more conquered system.
Ashtar, appended last, lands naturally at the top of the ladder.

### B2. Heavy (2x2) towers gated by galaxies
`[ ]` Per faction: first heavy purchasable after conquering galaxy 1
(galaxyTier >= 1), second after galaxy 3 (galaxyTier >= 3). Grandfather rule
holds: anything already owned stays owned.

### B3. One unit per conquered planet, sometimes none
`[ ]` Conquest currently vaults the world's whole denizen roster. Change to
AT MOST ONE unit per world, deterministic from the world id, with some worlds
paying no unit at all, so the muster vault grows little by little.

## C. Story delivery

### C1. Faction-select cutscenes
`[ ]` Five-scene slideshow on swearing a banner: image fades in, slow zoom,
text appears word by word. All five factions including the secret one. Art in
the house style (Tyranny-inspired duotone cyberpunk comic, per BRAND.md and
the artgen pipeline's own style prompt).

### C2. Post-system cutscenes
`[ ]` After each conquered solar system, a short slideshow advancing that
act of the faction's story, distinct from (and not duplicating) the beat
card on the reward screen.

### C3. Images via Krea 2, within reason
`[ ]` Measure one krea2-turbo render FIRST. If per-image time is sane, batch:
5 intro slides x 5 factions, plus per-system interstitial art, plus
cmd_ashtar and cmd_isa portraits (the commander art class is complete at
26/26 and two new commanders without plates would be a partial-class
violation). If turbo is not sane, fall back to SDXL-Turbo (measured 4.5s).

### C4. Victory dialogue
`[ ]` A short exchange after winning, only where it makes sense: a
commander-led world yields a line, a commanderless world does not.

## D. Generation

### D1. More Vigil neutral worlds
`[ ]` Raise the nest kind weight so Vigil-garrisoned neutral planets actually
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
