---
id: dialogue-character-voice
title: Dialogue and Character Voice Bible
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Dialogue and Character Voice Bible

The current dialogue system has commander openers, faction reply pools, and a few special pairs. The retrofit should preserve that lightweight architecture while replacing generic threats with lines driven by history and world state.

## Dialogue assembly order

A pre-battle exchange should draw from these layers in order:

1. **relationship line** for commanders with shared history;
2. **world claim line** based on owner, contested status, seat, or rescue state;
3. **battlefield line** based on map topology and Vigil function;
4. **faction doctrine line** only when no specific history exists;
5. **generic tactical line** as the final fallback.

This prevents every Federation commander from speaking like a priest, every Xeno like an animal, every Pirate like a joke, every Human like a generic soldier, and every Machine like the same cold computer.

## Canon-sensitive language

- Federation characters may be coercive, but official copy must distinguish **consent**, **emergency protection**, and **hardliner overreach**. Remove lines claiming everyone must surrender free will as a constitutional ideal.
- Xeno dialogue should emphasize dependency, contracts, Yield, memory, hierarchy, and client systems. Hunger language belongs mainly to Mawlord, Ulgrim, and the Voracious Brood.
- Pirate dialogue should distinguish abolitionists, sanctuary captains, salvagers, privateers, and traffickers.
- Human dialogue should reveal different polities and professions rather than treating Humanity as one military culture.
- Machine dialogue should expose distinct mission interpretations. The playable banner and the neutral enforcement waves are one civilization named the Vigil (the name Parallel is retired), but no single process speaks for the whole Old Weather.

## Commander voices and sample lines

| ID | Voice constraints | Sample opener | Sample result line |
|---|---|---|---|
| `cadre` | Plain, procedural, restrained. Describes risk instead of destiny. | "Threat profile entered. Build the line you can explain." | "The node held. Record what worked." |
| `vanta` | Cites files, precedents, probabilities, and missing records. | "Your claim cites an archive that ends three pages too early." | "Filed: victory, provenance intact, interpretation pending." |
| `korrin` | Prices, tonnage, lead time, spare parts, contractual leverage. | "Your empire has one route in and I already bought the spare parts." | "A victory that cannot be supplied is only a delay." |
| `nyx` | Fast, intimate, reckless; speaks to machines as if daring them. | "The governor says this system cannot run any hotter. Good." | "Rating exceeded. Consequence accepted." |
| `orin` | Diagnostic, tactile, impatient with mysticism. | "I do not need to understand your relic before I learn where it breaks." | "Leave the wreck. I can make it local." |
| `vess` | Legal certainty, measured threats, geographic language. | "This charter names the people who chose to stay. You do not speak over them." | "Ground retained. Authority remains with those living on it." |
| `seraph` | Warm, formal, plural; never says surrender when consent is meant. | "We offer protection, witness, and a choice that survives the battle." | "The Accord holds only while the signatories do." |
| `aurelia` | Musical cadence, names the wounded, avoids abstraction. | "I know every voice your last barrage interrupted." | "Count the living before you count the victory." |
| `lumen` | Precise, calm, protective; frames every claim as a scope and permission. | "Your command signature is valid for another jurisdiction, not this one." | "Scope verified. Breach denied." |
| `cantor` | Patient rhetorical questions, reframing, deliberate silence. | "Before you fire, tell me which future this shot makes possible." | "Silence is not agreement. I will wait for the answer." |
| `halder` | Grave, economical, speaks in obligations and thresholds. | "I will not let you exterminate them while they decide whether to trust us." | "Protected is not possessed. Remember the distinction." |
| `sevra` | Contractual, clinical, calls corpses estates and echoes continuations. | "Death closed the body, not the obligation." | "The estate has been transferred to active service." |
| `mawlord` | Sensory, material, hungry but not mindless. | "You call it waste because you cannot hear matter asking to be used." | "Nothing lost. Everything incorporated." |
| `thrax` | Uses we inconsistently; shifts between intimate singular and vast plural. | "We remember choosing this. Some of us remember refusing." | "The vote is complete. The disagreement remains inside us." |
| `vorn` | Agricultural, epidemiological, patient. | "Your victory already depends on what I planted beneath it." | "The battle ends. The dependency flowers." |
| `ulgrim` | Selective, evaluative, dismissive of anything common. | "Send me the mind your civilization cannot replace." | "Common bodies pass. Singular ones are retained." |
| `rake` | Dry, transactional, charming when lying. | "No route belongs to you just because your fleet blocks it." | "Toll paid, cordon broken, destination still free." |
| `scarlet` | Immediate, kinetic, contemptuous of plans longer than the fight. | "A wall is only a prison that has not chosen its prisoners yet." | "Burn the claim before someone rebuilds it." |
| `grist` | Appraises everything; jokes in material grades and resale value. | "That sacred hull has three compatible couplings and terrible resale etiquette." | "Nothing abandoned stays powerless for long." |
| `cinder` | Fatalistic, concise, treats destruction as cleanup. | "I can save the gate or save what is coming through it. Pick one." | "Route denied. Survivors can argue later." |
| `dregg` | Commanding, mocking, uses debt and ammunition interchangeably. | "I do not need your flag. I need your ammunition schedule." | "You kept the world. I kept the war." |
| `axiom` | Observational, revision-oriented, occasionally startlingly personal. | "Your doctrine contains a conclusion its evidence does not. I would like to test it." | "Revision accepted. Identity retained." |
| `nyx_r` | Cool, incremental, speaks in versions and convergence. | "The original called this courage. The data calls it thermal debt." | "Convergence achieved without worshiping the failure." |
| `lumen_r` | Audit language, permissions, attack surfaces. | "Trust request received. Evidence insufficient. Continue attacking." | "Intrusion incorporated. Permission still denied." |
| `mawlord_r` | Sparse at first, increasingly associative and unsettling. | "I was given no hunger. Your battle is teaching me one." | "Dataset expanded. Moral classification unresolved." |
| `dregg_r` | Forensic accounting, causal chains, no bravado. | "Your freedom has recurring expenses and one undisclosed owner." | "Ledger balanced. Mythology excluded." |
## Required scene pools

Each commander should ultimately receive short lines for:

- first meeting;
- same-faction dispute;
- each of the four rival factions;
- system commander seat;
- contested three-way world;
- Vigil nest;
- fortress and forge;
- one battlefield they understand unusually well;
- ability activation;
- unit rescue;
- one-star, two-star, and three-star victory;
- defeat and return;
- Vigil reveal;
- Maelstrom endgame.

The machine-readable commander registry contains motive and contradiction fields that can be used to generate drafts, but final dialogue should be hand-reviewed for voice and continuity.
