---
id: boons-modifiers-scenarios
title: Boons, Arena Modifiers, and Scenarios
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Boons, Arena Modifiers, and Scenarios

The campaign's secondary systems should read as consequences of world history, not isolated modifiers. Their stable IDs and mechanics remain code-authoritative.

## Arena modifiers

| ID | Canon condition |
|---|---|
| `swift` **SWIFT CURRENT** | Movement infrastructure remains overdriven; every force inherits the same acceleration risk. |
| `ironclad` **IRONCLAD** | The jurisdiction still issues protective matter to every recognized chassis, including the Vigil. |
| `goldrush` **GOLD RUSH** | Local salvage law pays unusually high recovery bounties, attracting commanders and scavengers alike. |
| `scarcity` **SCARCITY** | Embargo, depletion, or broken accounting reduces what confirmed kills can recover. |
| `deepwar` **DEEP WAR** | The jurisdiction has already escalated before the commanders arrive; legacy threat assumptions begin one step higher. |
| `thinline` **THIN LINE** | Life support, evacuation capacity, or civil legitimacy is already critically depleted. |
| `warchest` **WAR CHEST** | Competing claimants arrive with pre-positioned reserves because the worlds strategic value was known in advance. |
| `frenzy` **FRENZY** | Vigil scheduling has compressed its response intervals after repeated unauthorized access. |

## Victory boons

Boons are institutions, charters, ecological adaptations, and recovered procedures. They are not magical loot detached from the conquered world. The four ordinary map powers each have five boons; the secret Vigil does not normally own campaign worlds, so it recovers other powers' infrastructure instead of supplying a fifth world-boon set.

| ID | Origin | World kind | Canon explanation |
|---|---|---|---|
| `h_refit` **FIELD REFIT** | human | standard | A Human salvage charter makes the first duplicate systems cheap enough to standardize. |
| `h_lastline` **LAST OF THE LINE** | human | fortress | A defense charter converts existential pressure into concentrated combat output. |
| `h_salvage` **SALVAGE RIGHTS** | human | forge | A legal-industrial regime allows rapid sale, reuse, and ascension of captured systems. |
| `h_hardpoints` **HARD POINTS** | human | nest | A Human foothold learns to survive Vigil disruption through redundant physical infrastructure. |
| `h_integration` **INTEGRATION** | human | apex | The decisive Human reward is broader doctrine, not a single alien superweapon. |
| `l_vigil` **THE LONG WATCH** | light | standard | A standing Accord relief network restores defensive depth after each survived wave. |
| `l_oath` **THE OATH** | light | fortress | A precisely scoped survival vow allows one otherwise lethal breach to be absorbed. |
| `l_reliquary` **RELIQUARY** | light | forge | Collective memory makes repeated ascension cheaper and more meaningful. |
| `l_aureole` **AUREOLE** | light | nest | Authenticated support fields extend farther and make status effects more coherent. |
| `l_eternal` **ETERNAL SERVICE** | light | apex | A deliberately controversial continuation charter strengthens echoes while exposing the danger of consent without end dates. |
| `x_digest` **DIGESTION** | xeno | standard | Each death increases the local efficiency of Compact extraction. |
| `x_carapace` **CARAPACE** | xeno | fortress | A repeatedly harvested system evolves resistance to enemy mustering. |
| `x_render` **RENDERING** | xeno | forge | Matter, damage, death, and currency are processed through one extraction economy. |
| `x_brood` **BROODSWELL** | xeno | nest | A local brood converts surplus mass into heavier summoned bodies. |
| `x_consume` **TOTAL CONSUMPTION** | xeno | apex | The Compact identifies the largest surviving assets as the highest-value Yield. |
| `p_plunder` **PLUNDER** | pirate | standard | A route network redirects value before any state can tax or reclaim it. |
| `p_scuttle` **SCUTTLE** | pirate | fortress | Pirate law treats fixed assets as temporary and rewards rapid liquidation. |
| `p_contraband` **CONTRABAND** | pirate | forge | Unofficial supply chains make repetition cheaper than lawful procurement allows. |
| `p_dark` **THE DARK ANSWERS** | pirate | nest | Pirate navigators exploit Vigil timing and swarm paths without truly commanding them. |
| `p_marque` **LETTERS OF MARQUE** | pirate | apex | Unrecognized authority becomes real when enough armed parties honor it. |

## Scenario modes

| ID | Campaign meaning |
|---|---|
| `assault` **ASSAULT** | Seize a jurisdiction from a rival claim while the Vigil treats both sides as unauthorized. |
| `swarm` **SWARM** | Contain a Vigil density surge whose maintenance logic is reproducing faster than either claimant can negotiate. |
| `overrun` **OVERRUN** | Recover a collapsing node after its civil defenses and archive layers have already failed. |
| `vigil` **VIGIL / ENDLESS** | Submit to an open-ended Old Weather audit in which no political victory condition is recognized. |
| `renegade_hunt` **RENEGADE HUNT** | Remove an outlaw commander or corrupted claim operating under your own banners credentials. |
| `swarm_defense` **SWARM DEFENSE** | Defend a world you already hold when its legacy enforcement routines reactivate. |
| `coop_reinforcement` **CO-OP REINFORCEMENT** | Answer an allied request where preserving the partner matters more than replacing their claim. |

## Writing rule

A battle card should state **what changed here**, **who benefits**, and **why the condition persists**. Do not use an arena modifier as a generic adjective when an existing world field can supply a specific cause.
