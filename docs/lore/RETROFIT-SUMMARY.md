# Cosmic Conquest Lore Retrofit 0.5.0

**Game snapshot reviewed:** `majieddd/majieddd.github.io@046fc38634fadf13148ef9ad3aa208417f28f2de`
**Lore baseline:** `0.2.0`
**Game-content retrofit:** `0.3.0`  
**Current lore release:** `0.5.0`  
**Latest non-invasive placement check:** `majieddd/majieddd.github.io@ee86a08e13c23074f8be0aff435e6c35429c2838`


## 0.5.0 chronology and causal-history pass

Release 0.5.0 turns the research corpus into a complete chronological chain rather than a collection of strong isolated modules. It adds the master chronology, causal history, unresolved-mystery register, 17 additional myth systems (M-61 through M-84), 20 operations (MO-101 through MO-130), and a history-to-game mapping for future commander, tower, troop, planet, and dialogue revamps.

The key new causal rule is that high-grade noetic Yield requires meaningful autonomous cognition. That explains why Compact systems preserve choice while manipulating the conditions around choice, unifying elite capture, scarcity, religion-control, genetic dependency, and Loosh-style source lore without making those historical traditions literally one system.

## 0.4.0 mythology, conspiracy, and source-connection pass

Release 0.4.0 adds a controlled mythology layer rather than a claim that every rumor was true. It now maps **60 myth systems**, **27 cross-faction institutions and technologies**, **100 Mythos Operations**, **28 global case dossiers**, **57 source-mutation edges**, and an **18-episode Inside Job design map**. The governing rules are that mega-conspiracy is a historical merger; documented abuse creates Trust Debt but cannot validate unlimited extrapolation; reptiloid is morphology rather than moral alignment; population policy, coercive eugenics, and unsupported depopulation claims remain separate; and temporal claims are divided into retrocognition, information backflow, branch selection, and rare physical transit.

*Inside Job* contributes the **Cognito Principle**—hidden systems require mandates, budgets, staff, procurement, jurisdiction, oversight, succession, rivals, error rates, and failure states. It remains a fictional design corpus, not evidence. See `docs/research/mythos-connection-delta-2026-08.md`, `docs/research/alien-space-mythos-atlas-2026.md`, `docs/research/inside-job-corpus-map.md`, `docs/game/mythos-integration-framework.md`, and `docs/game/mythos-operations.md`.

## 0.3.2 archive fidelity pass

Release 0.3.2 adds no new faction, mechanic, or historical “alien proof.” It strengthens the Archive War with media-provenance classes, archive-version tracking, proposal/program maturity, negative laboratory results, narrative-data infrastructure, diplomatic records, contactee-network records, Measurement Lineage, Native Master preservation, Provisional Unknown states, source-versus-subject classification, analyst abstention, and a fully synchronized 37-mission Archive War deck. See `docs/research/archive-delta-2026-08.md`.

## 0.3.1 archive expansion

Release 0.3.1 does not change the five-faction canon, game IDs, balance, saves, or runtime. It expands the research and Archive War layer with the current NARA Record Group 615 agency inventory, Black Vault UFO Files Releases 1-5, FY2025 AARO case-state logic, Space Tiger Team, withheld-photo and FOIA-appeal records, NASA communications planning, Project Moon Dust, and machine-readable provenance rules. See `docs/research/uap-archive-expansion-2026.md`.

## Purpose

This release turns the research corpus into a game-operational universe bible. It does not replace the live mechanics. It explains why the current mechanics, IDs, commanders, units, towers, enemies, maps, worlds, rewards, and campaign structure exist, so future copy and art can be rebuilt from shared history instead of generated in isolation.

## Canon spine

The playable campaign opens in **2099** after Humanity activates the Sol Gate. The gate exposes five-system Source-Lattice pentads whose seven world-slots preserve ancient civil and jurisdictional functions. The Federation of Light under Ashtar returns to dismantle the Extraction Compact's Earth farm; Human polities reject both alien ownership and protective guardianship; Pirates open routes through quarantine; and the Old Weather begins reproducing beyond Sol. Neutral Vigil systems enforce extinct law while the playable Parallel argues that copied and diverged Machine minds are political persons.

The factions conquer in different ways:

- Humans **Settle** through self-sufficient institutions, industry, and jurisdiction.
- The Federation **Accords** through authenticated consent, shared defense, and social memory.
- Xenos **Bind** through dependency, genetic locks, elite capture, and noetic Yield.
- Pirates **Route** through access, sanctuary, credentials, salvage, and market control.
- Machines **Continue** through replication, repair, archival continuity, and inherited mission.

## Complete live-content coverage

- 5 factions
- 26 commanders
- 19 initial commander relationship seeds
- 25 faction units
- 29 neutral Vigil chassis
- 54 total enemy definitions
- 60 towers
- 12 active abilities
- 21 authored battlefields plus generated Maelstrom
- 20 victory boons
- 8 arena modifiers
- 7 scenario modes
- 5 systems x 7 worlds per generated campaign
- 209-row unified asset revamp matrix
- 26 commander visual briefs
- 37 Archive War missions tied to exact game assets

## Major additions

1. **Campaign-era canon** explaining systems, worlds, commander seats, contested nodes, stars, SOULS, rescues, Echo Reversal, the Ossuary, the Vigil, and the Parallel unlock.
2. **Five faction campaign premises** with public mission, gameplay engine, hidden crisis, and ending choices.
3. **Commander Bible** giving all 26 commanders an operational role, historical origin, present motive, contradiction, and voice foundation.
4. **Relationship map** for rivalry and alliance dialogue that evolves across a campaign.
5. **Troop and Vigil bible** grounding all 25 faction units and all 29 neutral chassis in civil, political, or custodial history.
6. **Tower Arsenal Bible** grounding every one of the 60 towers in builder history and faction doctrine while preserving mechanics.
7. **World and battlefield bible** connecting all authored maps and Maelstrom to Source-Lattice infrastructure and deterministic world dossiers.
8. **Boons, modifiers, abilities, and scenarios** reframed as institutions, environmental conditions, and mission authorizations.
9. **Dialogue/voice system** replacing generic threats with character motive, relationship history, current world claims, and campaign state.
10. **Black Vault/UAP research map** using real cases, archives, names, agencies, and provenance rules without treating unresolved as alien.
11. **Forecast history through 2099** combining current mission plans and scientific uncertainties with explicitly fictional divergence.
12. **Visual production brief** defining faction languages, all commander portrait cues, planet rules, and Machine distinctions.
13. **Archive War mission deck** connecting 37 real case-history problems to exact commanders, maps, towers, and world kinds.
14. **Contributor data layer** with stable-ID JSON registries and a cross-category CSV/JSON revamp matrix.

## Preservation result

Every file path from release 0.2.0 is retained. Research phases one and two, source matrices, xeno taxonomy, UAP manifests, download scripts, prompts, and the full Deep Research report remain archived and nonbinding unless promoted into maintained canon. See `data/preservation-audit.json` and `docs/game/coverage-audit.md`.

## Recommended live-game implementation order

1. Add generated `js/lore.js` records without changing simulation data.
2. Replace faction card and campaign-intro copy.
3. Add commander dossier history, motive, contradiction, and relationship tags.
4. Convert pre-battle dialogue to state-aware pools.
5. Generate world dossiers from system, owner, contender, map, kind, denizens, modifier, and boon.
6. Add one lore sentence and a full dossier link to every tower, unit, and Vigil chassis.
7. Resolve display-name collisions by stable ID, especially Human tower `reclaimer` and Vigil elite `mb_lich`, both displayed as RECLAIMER.
8. Regenerate portraits, faction crests, world plates, tower plates, and enemy dossiers from the canonical art direction.
9. Validate build, save migration, deterministic generation, multiplayer protocol, owner sweep, and visual layout before release.

## Evidence rule

The universe keeps official records, scientific uncertainty, historical belief traditions, fringe claims, contaminated legends, and fictional synthesis separate. A false legend may preserve one displaced operational detail without making the whole legend true. This is the setting's main defense against both indiscriminate conspiracy confirmation and mystery-flattening debunk fiction.
