# Tower uniqueness audit — Session 19

Answers roadmap items **19.19–19.22**: *"Double check all towers are properly
outfitted to be absolutely unique from all other towers in their own way."*

Method: parse every tower's `base` block and count which **mechanic keys** it
carries beyond the five every tower has (`damage`, `range`, `rate`, `projSpeed`,
`dmgType`, `splash`). A tower whose base is only those five has no mechanic of
its own — it is a stat block wearing a name.

---

## Headline: 36 of 39 already carry a unique mechanic

The arsenal is in better shape than the `attack` field suggests. Nine towers
share `attack: 'projectile'`, but seven of those nine differentiate underneath
it — the attack field is a *rendering* mode, not an identity.

### The three that are pure stat blocks

| Tower | Faction | Role today |
|---|---|---|
| `bolt` | human | Rapid single-target |
| `mortar` | human | Ground splash artillery |
| `flak` | human | Anti-air only |

These are the three human starters, and there is a real argument that a game
needs a plain baseline to measure everything else against — `bolt`'s own
description leans on it ("a wall of Bolts is a real strategy"). But *plain* and
*characterless* are different things, and all three are currently the latter.
Each should earn a small signature that does not cost it its simplicity.

---

## The six genuine overlaps

These pairs share the mechanic keys that define them, which is what makes two
towers feel like the same tower.

| Pair | Shared keys | Verdict |
|---|---|---|
| `toxin` ↔ `canister` | `poisonDps`, `poisonPct`, `poisonDur`, `maxStacks` | **Being fixed — roadmap 19.18.** The owner spotted this one unaided. Canister moves to armour-stripping stacks and max-health damage at ~⅓ the damage percentage. |
| `foundry` ↔ `custodian` | `minions`, `minionHp`, `minionDps`, `minionSlow`, `forgeTime` | Two spawners sharing a whole mechanic. One must become something else — see below. |
| `beacon` ↔ `pylon` | `auraDmg`, `auraRange`, `auraRate` | Two support auras with the same three knobs. |
| `vault` ↔ `quartermaster` | `income`, `incomeEvery` | Two economy towers on one timer mechanic. |
| `arc` ↔ `concord` | `chains`, `chainRange`, `falloff` | Concord at least adds `vuln`; arc is the plain one. |
| `pyre` ↔ `ichor` | `cone`, `burn`, `burnDur` | Same cone, same burn, different faction. |

Two lesser ones, both fine as they stand: `railgun` ↔ `reclaimer` share
`pierce`, and `reclaimer` ↔ `concord` share `vuln` — but in both cases it is one
stat inside an otherwise distinct kit, not the identity itself.

---

## Already delivered: the lane-blocking spawner

The owner asked for *"a tower that creates troops that fight against oncoming
troops, stopping them until they die."*

**FOUNDRY already is exactly that** (`towers2.js:71`) — it forges automata that
march onto the lane, grapple the first enemy they meet and grind it down, with
`minionSlow` as the hold and `minionBlast` on the CORE BREACH talent. Its own
description calls it *"the only structure that fights with BODIES instead of
fire"* — which is true of the intent and false of the arsenal, because CUSTODIAN
does the same thing.

So this is not a build request, it is a **differentiation** request. The most
promising split: FOUNDRY keeps the grapple-and-hold identity (a wall of bodies),
and CUSTODIAN — being Federation of Light — becomes something its lore actually
supports: escorts that **shield and buff the player's own mustered units** rather
than blocking enemies. That also serves the owner's "buffing your own
army/troops" ask, and it makes the two minion towers answer opposite questions.

---

## Roster: 39 today, 50 wanted

| Faction | Now | Need | Current roster |
|---|---:|---:|---|
| human | 10 | 0 | bolt, cryo, mortar, arc, flak, canister, reclaimer, quartermaster, rampart, arbalest |
| light | 7 | **+3** | beacon, prism, chrono, shepherd, ward, custodian, concord |
| xeno | 7 | **+3** | toxin, siphon, executioner, siren, alchemist, reckoning, ichor |
| pirate | 7 | **+3** | pyre, tether, sapper, saboteur, glaive, cyclone, capacitor |
| robotic | 8 | **+2** | railgun, singularity, vault, dronebay, foundry, echo, quake, pylon |

**Eleven new towers.** Each needs a mechanic key no existing tower carries, so
the design constraint is explicit: *a new tower is not approved until it names a
`base` key that appears nowhere else in the arsenal.*

Robotic is a special case — roadmap **19.5** makes that whole line story
unlocks, DRONE BAY first, so its two additions are also two more solar-system
rewards and should be paced against how many systems a campaign actually has.

---

## Balance-curve shapes (19.22)

The owner wants towers that are deliberately early- or late-game rather than
uniformly fair. The levers already in the data model, no new machinery needed:

- **`cost` + `costGrowth`** — `bolt` is 115 at 1.50 growth (the gentlest in the
  arsenal, hence the wall strategy); `foundry` is 300 at 1.78. Growth is the
  strongest single knob for when a tower stops being worth it.
- **Time on field** — `forgeTime`, `incomeEvery` and stack builders pay out over
  seconds, so they are structurally weak the wave they are placed and strong on
  a board that has held. That is a late-game curve expressed as a mechanic.
- **Level jumps** — a tower whose MK III is a large multiple is a late-game
  investment; one whose base is already most of its power is an opener.

Each of the eleven new towers should state which shape it is aiming at, and the
pins must be re-measured after they land: fresh loss median 6–7, maxed tier-0
`spine` ~27.

---

## Soul shop inflation (19.9)

Tracked with the unlock work rather than here: each purchase raises every *other*
purchase from that faction by +1 soul. Worth noting the interaction — **eleven
new towers means eleven more purchasables**, so an inflation rule that felt gentle
at seven towers per faction compounds harder at ten. Model the full unlock curve
for one faction before committing the number.
