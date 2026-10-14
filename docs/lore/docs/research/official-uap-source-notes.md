---
id: official-uap-source-notes
title: Official U.S. UAP Source Notes
type: research
status: research
evidence: A-B
last_reviewed: 2026-08-25
---

# Official U.S. UAP Source Notes

## What has actually been provided

The National Archives publishes bulk ZIP downloads for digitized and born-digital UAP-related records. Its bulk page says the packages include image, video, PDF, and JSON metadata and are intended to be updated at least three times per year. The visible bulk snapshot remains dated April 24, 2025.

The live Record Group 615 page is newer and now lists transfers from FAA, NRC, ODNI, OSD, NSA, State, and FBI. This creates a useful research warning: **the catalog can advance before the bulk package does**. A missing bulk ZIP is not evidence that the underlying series does not exist.

This repository includes:

- exact official ZIP and metadata URLs for the established bulk collections;
- a starter tier, medium tier, and very large archival tier;
- resumable Bash and PowerShell scripts;
- an August 2026 delta table for newer catalog-only or secondary-discovery records;
- no claim that every statement inside an authentic government record is accurate.

## High-value starter collections

### ODNI UAP records

Small collection containing official assessments and reporting history. Good for institutional language, uncertainty categories, and timeline design.

### OSD UAP records

The largest starter electronic collection. Useful for AARO policy, case-resolution style, morphology, and reporting systems.

### FAA UAP records

Useful for pilot reports, aviation terminology, time/location formatting, ATC response, air-safety consequences, and the difference between released logs and withheld radar data.

### Project Blue Book administrative and case-series exports

Good for historical bureaucracy and indexing. The tiny 1-3 MB exports are not the complete hundreds-of-gigabytes set of scanned Blue Book case files.

### Newer RG 615 catalog series

NSA, State, and FBI series appear on the live RG 615 page but were not yet represented as electronic-series ZIPs on the older bulk page during this review. Treat them as **catalog-first** collections and preserve the NAID, catalog state, and acquisition date.

## AARO findings useful for grounded lore

- Official reporting covers airborne, maritime, spaceborne, and transmedium observations.
- The FY2025 report said 370 cases were resolved during the reporting cycle when current and older cases were combined, all to prosaic categories.
- It reported no evidence that the U.S. government or a private entity had captured or exploited UAP-derived materials.
- A maritime report involving roughly 100 airborne observations and two likely uncrewed surface systems off Virginia remained under investigation at publication.
- A large share of closed cases are attributed to balloons, satellites, and UAS.
- An unresolved case is often a case without enough information, not a finding of exotic origin.
- A public media item can be native sensor data, a documented export, a screen recording, an altered copy presented as received, an artistic reconstruction, or a narrative-only record. These are not interchangeable.
- A mission report describes what was reported. It is not automatically an analytical conclusion.

## Media Integrity Ladder

Use the following field in every image or video record:

| Level | Evidence object | Main limitation |
|---:|---|---|
| 1 | Native sensor product or validated native export | May still lack range, calibration, environmental, or platform context. |
| 2 | Documented transcode or export | Conversion can change compression, color, frame timing, or metadata. |
| 3 | Secondary recording of a display | Screen refresh, auto-exposure, moire, blur, and camera motion can add artifacts. |
| 4 | Altered copy presented as received | Replay speed, annotations, enhancement, cropping, or edits must be separated from the underlying event. |
| 5 | Artistic reconstruction | Visualizes testimony; it is not event footage. |
| 6 | Narrative-only record | Preserves an account but cannot independently establish visual behavior. |

A lower level is not automatically deceptive. It supports fewer claims.

## Program-status and material-claim controls

### Proposal-Program-Operation Ladder

Record whether a code name identifies a proposal, briefing deck, proposed compartment, approved program, funded operation, or operation that actually received material and produced results. KONA BLUE is the controlling example: AARO says it was proposed but never approved, established, funded, or supplied with material.

### Chain of custody over provenance story

A claimed recovery story does not outrank testable composition. ORNL material analyses are useful because they preserve methodology, chain-of-custody limitations, and ordinary findings even when public allegations were extraordinary.

## Data-quality additions from the 2026 technical literature

### Direct measurement is not derived interpretation

Range, speed, acceleration, size, temperature, reflectivity, and radar cross-section are not raw observations. They are calculations whose reliability depends on geometry, platform motion, calibration, sensor settings, and metadata. Static monocular imagery often cannot determine range; separated sensors can support triangulation and reject near-field confusers.

### Preserve the native master

For visual evidence, retain the original unprocessed file, calculate a SHA-256 hash immediately after capture, preserve UTC/location/equipment metadata, and store edits as separately labeled derivatives. A valid hash proves that a file did not change after intake. It does not prove that the object was extraordinary.

### Unknown is a workflow state

Event-based sensing and the WATCHER pipeline show how a system can detect clusters before identifying them, then characterize motion and periodic signatures as better data arrive. In lore, the Watcher Mesh must not assign a faction, species, or intent merely because a track has not yet been identified.

### Classification may describe the collector

AARO's declassification paper explicitly distinguishes the subject of an image from the sensitive platform, location, metadata, resolution, source, or method that produced it. Writers must not treat withheld imagery as a hidden “alien” content category.

### Refusal is not a negative answer

Reporting systems should preserve distinctions among `no`, `unknown`, `not observed`, `not remembered`, `withheld`, `not applicable`, and `refuse to answer`. Collapsing them manufactures patterns that the witness never reported.


### Narrative data remains its own infrastructure

AARO's 2025 workshop on narrative data treated reporting systems, testimony, metadata, and analytical infrastructure as research problems. Preserve exact wording and interview context, but do not merge narrative claims into sensor-derived quantities.

### Blind metrics and null searches

Evaluation Proposal 585 demonstrates that an audit objective can be public while benefits, vulnerabilities, and methods remain classified. The Immaculate Constellation appeal demonstrates that a denied allegation may still require a records search. Neither condition discloses the hidden answer.

## DIA speculative technology papers

The DIA FOIA reading room includes AAWSAP/AATIP Defense Intelligence Reference Documents on topics such as:

- advanced nuclear propulsion;
- vacuum engineering and metric manipulation;
- programmable matter;
- antigravity concepts;
- quantum-vacuum energy;
- invisibility cloaking;
- metamaterials and metallic glasses;
- negative-mass propulsion;
- traversable wormholes, stargates, and negative energy;
- warp drive, dark energy, and extra dimensions.

Use these as a vocabulary and engineering-imagination library. Their official status shows the papers were commissioned and archived, not that the technologies were demonstrated or recovered from craft.

## How to mine the archives for game design

Tag each item using:

- agency, series, NAID, release batch, and acquisition date;
- original file hash and derivative hash;
- media-integrity level;
- reported shape and light behavior;
- number of objects;
- environmental domain;
- sensor and witness type;
- duration and motion pattern;
- exact original wording and later paraphrase;
- prosaic hypothesis and analytical confidence;
- unresolved information gap;
- proposal, program, or operation status;
- visual, audio, character, or mission potential.

This produces better craft and campaign concepts than searching only for the strangest cases. Normal explanations also reveal what an advanced craft, Xeno disinformation system, or Machine archive would need to imitate in order to remain hidden.

See [UAP Archive Delta - August 2026](archive-delta-2026-08.md) and `data/research/uap-archive-delta-2026-08.csv`.
