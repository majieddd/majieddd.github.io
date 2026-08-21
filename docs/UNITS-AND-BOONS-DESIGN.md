# Units and boons — Session 19 design

Specifies roadmap items **19.10–19.15** (units) and **19.23–19.24** (boons)
before either is built, because both turned out to be *smaller* than they look:
most of the machinery already exists and is simply not wired to each other.

---

# Part 1 — Units

## What already exists

Three findings from reading the code rather than assuming:

1. **Twenty faction units are already defined**, five per power, in
   `js/factions.js` — Trooper / Gunskiff / Linebreaker / Dragoon / Vanguard for
   Humanity, Votary / Censer / Sanctifier / Oriflamme / Luminark for the
   Federation, Chitling / Gnawling / Bloatpod / Hivelord / Broodmother for the
   Xeno, Cutter / Boarder / Scrapjack / Wrecker / Ironhulk for the Pirates.
   They have art in the pack already.
2. **Per-map rescue already works.** All fifteen maps declare `denizens`, and
   `ui.js:1759` already builds the savable list and names which map each unit
   comes home from.
3. **The two have never been connected.** Of the twenty-two denizens across all
   fifteen maps, **none is a faction unit** — every rescue is a neutral machine.

So 19.10 is not "build per-map unlocking"; it is "put the faction units into the
pools that already exist, under the right gate."

## 19.10 / 19.11 — units unlock per map, and belong to their power

Give each map a **second denizen track**: the machine it already offers, plus a
faction unit. Which faction unit is offered depends on the world's owner, so a
Xeno-held world rescues Xeno creatures and a Federation world rescues Federation
ones. That makes the galaxy map's ownership colours mean something concrete: you
can *see* which power's units a world will teach you.

The five units per faction are already tiered by cost and mass, so a map's tier
picks which of the five it can offer — early worlds rescue Chitlings, late
worlds rescue Broodmothers.

## 19.14 — the rescue gate, and the Soul Profile escape hatch

The owner's rule, exactly:

> Each faction in their playthrough can only rescue/unlock their faction's unit
> or machine faction, but if the Soul Profile unlocked it as a whole, you can use
> it with any faction/commander.

Two tiers, and they must not be confused:

| Tier | Scope | Rule |
|---|---|---|
| **Campaign rescue** | that playthrough | May rescue **only** its own faction's units, or neutral machines. A Pirate campaign can never rescue a Votary. |
| **Soul Profile unlock** | the whole install | Once bought outright, usable by **any** faction or commander. |

This mirrors the tower origin law that already exists (`AI.rivalArsenal` relies
on it), so the two systems should read as one rule applied twice — not two rules
that happen to look similar.

### The souls question, settled

This looked like it needed an owner decision. It does not — the answer is
already in the note, and it already matches the architecture.

Measured in `js/commanders.js`:

| Thing | Scope today | Where |
|---|---|---|
| **Souls** | **per profile** | `p.souls` on the active profile |
| **Unlock vault** | **install-wide** | `r.vault`, shared by every profile |

And note 19.14 says a Soul Profile unlock is usable *"with any faction/commander
of course"* — i.e. the vault **stays install-wide**, deliberately. Meanwhile 19.6
says you must be *"logged into the respective faction's profile, and use those
souls"* — i.e. souls **stay per profile**, which they already are.

So neither storage model changes. The only thing that changes is the
**purchase gate**: at the moment of buying, the active profile's faction must
match the tower's origin (with the human and robotic commons still open to all,
per the existing origin law). Everything downstream of the purchase keeps
working exactly as it does now.

That is worth stating explicitly because the tempting "fix" — making the vault
per-profile so factions feel separate — would directly contradict 19.14 and
would retroactively strip every profile of unlocks it currently has.

## 19.12 — the four-column loadout

```
┌───────────────┬───────────────┬───────────────┬───────────────┐
│  UNIT DETAIL  │    UNITS      │    TOWERS     │ TOWER DETAIL  │
│               │               │               │               │
│  talents for  │  pick your    │  pick your    │  talents for  │
│  the selected │  detachment   │  loadout      │  the selected │
│  unit         │               │               │  tower        │
└───────────────┴───────────────┴───────────────┴───────────────┘
        outer          middle          middle          outer
```

The two middle columns are the pickers and must look like **siblings** — same
card shape, same grid, same hover behaviour — because they are the same kind of
decision made twice. The two outer columns are the detail panels: talents, stats
and description for whatever is selected in the column beside it.

Constraint worth stating: four columns is a lot of width. It needs a defined
behaviour when the viewport is narrow — most likely the detail columns collapse
into a drawer rather than the grid reflowing to two, since reflowing would break
the visual pairing that is the entire point.

## 19.13 — talents per unit

Units get their own talent sets, chosen the way tower talents are. The tower
tree is three rows of two, gated by mastery (`Meta.talentMods`,
`Meta.defaultTalents`) — units should reuse that shape and that code rather than
growing a parallel system, so the "pick one per row" rule, the stock-build
fallback and the mastery gate all behave identically.

The trap already documented in `talentMods`: a partial allocation must never be
*worse* than none. Spending one point once discarded the whole three-node stock
build. Whatever unit talents do, they must merge over the stock build the same
way.

## 19.15 — unit cards preview the unit moving

Tower cards show a preview on hover; unit cards should too, showing the unit
**moving and using its signature trait**. Note roadmap **19.8** says that preview
is currently glitchy — fix that first, then reuse it. Building a second preview
system on top of a broken one doubles the bug.

---

# Part 2 — Victory boons

## Why they feel identical

`BOONS` in `towers2.js:527` is **eight global entries**, drawn with
`BOONS[floor(rng() * BOONS.length)]` in `commanders.js:453`. Nothing about the
world you conquered or the power you took it from enters the draw. Every victory
rolls from the same eight.

## 19.23 / 19.24 — the matrix

The owner wants the boon to be *"a reflection of the planet itself"* and, in
multiplayer, to depend on **both the planet and the faction you took it from**.
That is a two-axis lookup, and both axes already exist in the data:

- **Faction** — four powers with sharply different identities:
  Humanity (resilience and breadth: +10 lives, +10% every tower stat),
  Federation (quality: towers start a level higher),
  Xeno (the send: reanimates 25% stronger),
  Pirates (tempo: extra opening gold).
- **World kind** — `standard`, `fortress`, `forge`, `nest` (`galaxy.js`
  `WORLD_KINDS`).

**Five boons per faction, twenty total.** The faction decides *what kind of
advantage* you take — you are looting that power's technology. The world kind
**biases which of its five** is offered, so a forge world yields that faction's
industrial boon and a nest world its swarm one. A player who takes a Xeno forge
world gets something that could only have come from a Xeno forge world, which is
the whole ask.

Design rules for the twenty:

- Each must read as *that power's* advantage, not a generic modifier wearing its
  colour. "+10% gold" is not a Pirate boon; a boon that pays out when you *send*
  is.
- Spread across the axes the game actually has — economy, tower stats,
  reanimates and musters, lives, drafting — so a run stacking five boons does
  not stack five of the same number.
- Multiplayer is the harder case: with up to twenty seats, boons must be
  attributable ("taken from the Xeno seat on a fortress world") and must not
  compound into an unanswerable lead. Cap or diminish stacking of the same boon.

The eight existing global boons are a reasonable starting vocabulary
(VETERANCY, VITALITY, PROSPERITY, FORESIGHT, ARSENAL, MOMENTUM, MASTERY,
BULWARK) but should be **re-authored into the matrix rather than kept alongside
it** — leaving a global pool next to a faction pool means the global one dilutes
exactly the diversity this change exists to create.
