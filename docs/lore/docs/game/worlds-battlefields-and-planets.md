---
id: worlds-battlefields-planets
title: Worlds, Battlefields, and Planets
type: game-integration
status: core
evidence: F
last_reviewed: 2026-08-25
---

# Worlds, Battlefields, and Planets

The reviewed game snapshot is `majieddd/majieddd.github.io@046fc38634fadf13148ef9ad3aa208417f28f2de`. It generates five systems, seven worlds per system, two contested worlds per system, one commander seat, and deterministic routes from a campaign seed.

## Names are registries, not random alien syllables

The current system roots (CORVUS, ARDENT, TALLOW REACH, THE SPINDLE, BLACKGLASS, HELIX, MOURNE, VAST) and world roots (Kerath, Vell, Ashkar, Ordos, Myrren, Tessaly, Cauldron, Hollow, Ninefold, Brack, Solace, Ixion, Tarsis, Umber, Perrin, Vaunt, Cinderfall, Quill, Sabre, Threnody, Gallow, Wexen, Orrery, Lume) are **survey registry names**. Some came from early Human astronomy, some from Pirate route ledgers, and some from translated Machine records. They are not claims about the native culture of every world.

A final world name combines:

- registry root;
- system and world index;
- local population name, when known;
- current controlling banner;
- recovered native or precursor name, if authenticated.

The short map can keep the generated registry name. The dossier should show the deeper layers.

## World Identity Packet

Every generated world can receive consistent lore from fields the game already stores:

| Existing field | Lore output |
|---|---|
| `system name` | Which Lattice pentad and route history the world belongs to. |
| `world name/id` | Stable registry identity across saves. |
| `kind` | Civil node, charter fortress, industrial forge, or Vigil nest. |
| `owner` | Current controlling claim, not total cultural identity. |
| `contestedBy` | Which other claim is legally or militarily active. |
| `seat` | Whether the world carries system command authority. |
| `map` | The physical or infrastructural topology that shapes battle. |
| `arena modifier` | A local environmental, economic, or jurisdictional condition. |
| `denizens/roster` | Which Vigil functions still operate there. |
| `boon` | The recoverable institutional or technical advantage the world produces. |
| `stars` | How complete and stable the player's victory was. |

A world blurb should be generated from those facts instead of from an unrelated paragraph.

## World kinds

| Code | Canon identity | Meaning |
|---|---|---|
| `standard` | Civil Node | Ordinary habitation, archive, route, or stewardship jurisdiction. |
| `fortress` | Charter Fortress | Holds defensive depth or a command registry. |
| `forge` | Industrial Forge | Converts local matter and energy into strategic production. |
| `nest` | Vigil Nest | Legacy Old Weather enforcement is dense, active, and indifferent to the banner. |

## Battlefields

| Battlefield | Classification | Canon history |
|---|---|---|
| `spine` **THE SPINE** | Barren survey trunk | A surviving linear Lattice backbone used to teach new commanders the clean geometry of jurisdiction. |
| `delta` **THE DELTA** | Flooded pelagic distributor | Two isolated channels built around an Old Weather water-management bank. |
| `narrows` **THE NARROWS** | Collapsed transit choke | Three surviving emplacement alcoves force local defense without mutual support. |
| `shattered` **SHATTERED** | Severance fracture field | The ground is broken into isolated islands by an ancient gate-shear event. |
| `crossroads` **CROSSROADS** | Dual route interchange | Two claims and two lanes cross around a monument whose original authority is no longer recognized. |
| `coil` **THE COIL** | Reactor cooling loop | A closed industrial circuit where heat, pursuit, and return paths overlap. |
| `expanse` **THE EXPANSE** | Open receiver plain | An exposed survey array with almost no natural cover and unusually long sightlines. |
| `rift` **THE RIFT** | Unstable gate shear | A broken translation channel that creates discontinuous threat geometry. |
| `confluence` **CONFLUENCE** | Three-party jurisdiction junction | Three command records are simultaneously valid and none can erase the others. |
| `crown` **THE CROWN** | Ceremonial command ring | An old authority node designed to place every claimant under observation. |
| `carousel` **CAROUSEL** | Rotating route scheduler | Traffic was once assigned dynamically; modern commanders experience it as shifting pressure. |
| `orrery` **THE ORRERY** | Navigation model made battlefield | A physical model of local orbital and gate relationships that still controls access. |
| `lattice` **THE LATTICE** | Exposed network mesh | The underlying connection graph is visible enough that placement becomes constitutional topology. |
| `causeway` **THE CAUSEWAY** | Archive bridge | A narrow connection between separated jurisdictions whose loss would erase lawful continuity. |
| `anvil` **THE ANVIL** | Foundry plate | A Machine industrial foundation built to survive impacts and continuous heavy manufacture. |
| `lance` **THE LANCE** | Long beamline corridor | An accelerator and calibration route that rewards exact range and alignment. |
| `skew` **THE SKEW** | Misregistered gravity frame | The map and the local field disagree about straight lines. |
| `strait` **THE STRAIT** | Opposed flow corridor | Traffic streams were designed to pass rather than fight; war turns that efficiency against itself. |
| `loom` **THE LOOM** | Route-weaving control plane | Multiple path threads become one legal and logistical fabric. |
| `ossuary` **THE OSSUARY** | State-deletion jurisdiction | Its archive rejects Echo Reversal, so the dead remain dead and every kill loses strategic afterlife. |
| `atoll` **THE ATOLL** | Ring habitat and central citadel | A circular settlement ecology whose center owns the life-support charter. |
| `maelstrom` **THE MAELSTROM** | Generated many-seat overload | A Lattice node that admits too many simultaneous claims and solves the conflict as a twenty-seat arena. |
## Arena modifiers as history

Arena modifiers are not arbitrary difficulty toggles. They are the surviving operating condition of the jurisdiction:

- **Swift Current:** traffic acceleration or local movement field remains active.
- **Ironclad:** the node issues protective matter to every authorized chassis, including the Vigil.
- **Gold Rush:** salvage law pays high bounties for verified removals.
- **Scarcity:** a depleted or embargoed economy cannot pay ordinary recovery rates.
- **Deep War:** the jurisdiction has already escalated before the commanders arrive.

Every modifier should gain one short archival cause and one current political consequence.

## Planet art and environmental identity

Planet portraits should be driven by a compact environmental tag set rather than faction color alone:

- gravity class;
- atmosphere and pressure;
- hydrology;
- biosphere status;
- settlement type;
- industrial signature;
- precursor/Machine signature;
- current faction claim;
- route importance.

Faction-holder variants may add infrastructure and heraldry, but they should not recolor the entire planet as if politics changed geology.
