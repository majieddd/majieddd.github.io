---
id: art-direction-asset-brief
title: Art Direction and Asset Revamp Brief
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Art Direction and Asset Revamp Brief


This brief translates the canon into production rules for commander portraits, faction crests, units, towers, enemies, planet plates, and dossier art. It supplements the stable-ID [Asset Revamp Matrix](asset-revamp-matrix.md); mechanics remain code-authoritative.

## Global art rule

Every asset must communicate three things before it communicates decoration:

1. **builder or institutional origin**;
2. **the mechanic or battlefield function**;
3. **the political cost or contradiction**.

A faction color may aid readability, but it must not erase species, material, environmental, or institutional diversity.

## Five visual systems

| Power | Shape and material language | Recurring evidence of history | Avoid |
|---|---|---|---|
| **Humans** | Adaptors, pressure seals, modular hardpoints, civic labels, industrial cyan and weathered alloys. | Foreign components mounted on understandable frames; Earth, lunar, Martian, Belt, and Jovian standards visibly coexist. | One homogeneous Earth military or sleek generic sci-fi navy. |
| **Federation** | Open circles, scoped halos, witness threads, radiant amber/gold, transparent boundaries, many-species interfaces. | Consent seals, memory chains, emergency-key markings, and visible room for individual identity. | Literal angels as the universal species, church-copy ornament, or imagery that presents coercion as the official ideal. |
| **Xenos / Compact** | No single morphology. House overlays, ownership marks, dependency ports, purple as UI affiliation rather than skin color. | Patents, tithe seals, client-caste interfaces, grafts, noetic extraction architecture, and old severance damage. | A single evil alien race or one shared organic aesthetic. |
| **Pirates** | Patchwork pressure environments, route tattoos, cargo geometry, red/copper hazard paint, incompatible components kept visible. | Sanctuary markings, disputed salvage tags, cut credentials, quarantine scars, and mixed-species accommodations. | Theme-park piracy, universal skull motifs, or comic relief by default. |
| **Machines** | Function-first geometry, geological and ecological integration, silver/cyan Vigil revisions, old teal/stone Old Weather structures. | Version seams, mission-law inscriptions, repair strata, archive checksums, and divergent node jurisprudence. | Generic exterminator robots or assuming every Machine shares one body language. |

## Machine distinction

- **Old Weather:** ancient, distributed, oceanic/crustal/ecological, rarely humanoid.
- **Vigil:** custodial and enforcement chassis whose original civil function remains readable beneath weaponization.
- **Vigil:** modern political Machines who preserve revision history and deliberately display personhood choices.

## Commander portrait briefs

| ID | Must show | Must avoid |
|---|---|---|
| `cadre` | Neutral modular field uniform assembled from all five origins; no faction crest; worn training slate. | Do not make Cadre visually bland: the tension is deliberate interoperability, not absence of identity. |
| `vanta` | Archive coat with transparent provenance panes, timestamp marks, and a portable evidence lattice. | Avoid conspiracy-wall clutter; she is disciplined archival intelligence, not a paranoid detective. |
| `korrin` | Pressure-rated logistics harness, cargo seals from Earth/Moon/Mars/Belt, and one standardized coupling held like a badge. | Avoid generic merchant styling; he is infrastructure power. |
| `nyx` | Heat-scored ascension rig, exposed governor bypasses, asymmetric cooling lines, confident burn scars. | Avoid magical lightning; every visual risk should look engineered. |
| `orin` | Mixed-origin repair frame with visibly incompatible tools made interoperable by adapters. | Avoid pristine lab-coat imagery; he works inside damaged systems. |
| `vess` | Marshal coat over habitat emergency armor, civil charter ribbons, geographic map projection. | Avoid nationalistic Earth-only insignia; she represents frontier jurisdiction. |
| `seraph` | Radiant field harness made of many individually distinct consent seals orbiting without merging. | Avoid angel wings as literal biology; halo geometry should read as treaty infrastructure. |
| `aurelia` | Casualty-memory choir filaments, names or voiceprints of the recovered, protective rather than regal posture. | Avoid faceless saint imagery; grief and individuality must remain visible. |
| `lumen` | Layered ward architecture, authentication glyphs, narrow luminous apertures, visible permission boundaries. | Avoid omniscient all-seeing-eye cliche. |
| `cantor` | Diplomatic voice lattice, empty space in composition, one hand inviting and one controlling an emotional waveform. | Avoid preacher staging; he is a negotiator with unsettling influence. |
| `halder` | Heavy evacuation armor, threshold markers, emergency command key carried as a burden. | Avoid uncomplicated paladin heroism; the image should ask whether rescue can be coercive. |
| `sevra` | Clinical continuity notary with estate seals, echo capsules, and death-contract ledgers. | Avoid undead sorceress shorthand; her horror is administrative. |
| `mawlord` | Massive client organism built from salvage metabolism, with visible old ownership marks cut away. | Avoid generic monster rage; intelligence and emancipation motive must show. |
| `thrax` | Multiple bodies or faces linked by an imperfect shared field, some looking away from the collective center. | Avoid a single insect queen as the whole character. |
| `vorn` | Ecological engineer in living cultivation armor, seed/debt instruments, slow invasive growth. | Avoid simple poison villain styling; dependency is designed as stewardship. |
| `ulgrim` | Elite-capture adjudicator bearing memory reliquaries from singular opponents. | Avoid indiscriminate gore; Ulgrim is selective and curatorial. |
| `rake` | Route charts stitched into coat and hull plates, quarantine tags, dry confidence. | Avoid cartoon pirate costume; the route network is his real regalia. |
| `scarlet` | Breaching gear, severed chains, recent damage, forward motion that ignores stable ground. | Avoid sexualized reaver tropes; emphasize anti-institutional velocity. |
| `grist` | Salvage-jury robes made from inspection tags, material samples, and legal stamps. | Avoid junk-pile comedy; Grist is a serious property-law power. |
| `cinder` | Scuttle specialist with remote gate charges and scorched route maps. | Avoid pyromaniac caricature; destruction is his grim containment policy. |
| `dregg` | Privateer admiral with no official flag, hidden ledgers, and a fleet reflected behind him like a state he denies. | Avoid simple pirate king grandeur; hypocrisy must be visible. |
| `axiom` | Clean but visibly revised chassis; version seams retained as honors; first self-authored sentence engraved internally. | Avoid generic chrome robot monarch. |
| `nyx_r` | Cold, orderly mirror of Nyx with redundant cooling and deliberate asymmetry inherited from copied data. | Avoid making it merely a blue recolor of Nyx. |
| `lumen_r` | Security chassis bearing repaired intrusion scars as learned credentials. | Avoid pristine invulnerability; earned hardening is the visual story. |
| `mawlord_r` | Sparse initial frame accumulating battlefield-derived structures unevenly, with uncertainty visible in unfinished morphology. | Avoid a robotic copy of Mawlord; it learned appetite from data. |
| `dregg_r` | Forensic economic chassis projecting causal ledgers through a stripped-down admiral silhouette. | Avoid accountant comedy; it can dismantle empires through audit. |

## Unit and tower production

- A unit portrait must show whether its relationship to the player is recruitment, asylum, contract, emancipation, copying, or mission transfer.
- A tower plate must show the core mechanic in silhouette. Range, tether, aura, beam, foundry, execution, or lattice behavior should be visually inferable before reading text.
- Cross-origin technology must remain visible. The Human `reclaimer`, Machine `singularity`, Federation use of Echo Reversal, and Pirate mixed systems are evidence of history, not art inconsistencies.
- Vigil dossier art should pair the combat silhouette with a faint reconstruction of its original survey, repair, containment, access-control, or emergency function.

## Planet and world plates

Planet art is built from environmental tags first, then political overlays:

1. gravity and scale;
2. atmosphere and pressure;
3. water/ice distribution;
4. biosphere condition;
5. settlement and industry;
6. precursor or Machine signature;
7. route importance;
8. current and contested claims.

A faction-holder variant adds infrastructure, traffic, fortification, or heraldry. It does not recolor geology. A contested world should show two incompatible systems occupying the same environment rather than splitting the planet into simple color halves.

## Dialogue portrait states

Every commander eventually needs five portrait states: neutral dossier, pre-battle assertion, under-pressure fracture, recognition/alliance, and faction-ending choice. Mirror Trial portraits must share identifiable source data with the namesake without becoming a face swap.
