# Mechanics Options — from the Tower Defense Mechanics Dossier

> **Three of the fifteen have shipped** — #1 and #4 in Session 21, #8 in
> Session 22. Each is marked at its own heading. The other twelve remain held
> and their reasoning below is unchanged.

Source: *Tower Defense Mechanics Dossier and Master Index* — 31 pages, 75 games,
168 distinct mechanics across 23 categories, 418 game-to-mechanic associations.

Four analysts mined the dossier against this codebase in parallel; a fifth adjudicated,
deduped, and verified every "we already have this" claim against real source lines.

- **16** mechanics were already present and verified in the code
- **10** were unambiguous fits and were built this session
- **15** are held here as options — listed below

These 15 are the ones I deliberately did **not** implement. Each either changes the
game's identity, costs more than a session, or turns on a judgement call that is yours to
make. They are written up rather than built. Say the word on any of them and I will build it.

---

## 1. Recoverable stolen objective — a leak becomes a timed recovery window

> ✅ **SHIPPED, Session 21 round two** (`4a8fd73`). A leak spawns a carrier that
> runs the objective off the board; kill it and the life comes back. Recovery
> and offence became the same action, exactly as argued below.


**Effort** M  ·  **Seen in** Defense Grid: The Awakening (TD-MECH-105). Dossier calls it apparently unique and ranks it #1 'Most innovative'.

**The decision it creates.** A leak is not instantly permanent. The leaker carries the objective away and can be intercepted before it escapes, converting an instantaneous loss into a time-bounded second chance.

**Fit here.** It would make the ~90%-lives 3-star condition skill-expressive rather than near-binary, which is the sharpest complaint-shaped edge in current progression. And it composes unusually well with the signature loop: kill the fleeing carrier and you get the life back AND a reanimate walking into the rival's lane — recovery and offence become the same action. That is a genuine two-consequence design of exactly the kind the dossier keeps arguing for.

**How it would be built.** If pursued: on leak, instead of decrementing lives, spawn a carrier that reverses along the path toward the spawn edge with the life attached; the exit event is what actually decrements. restoreLife already exists at js/game.js:704 and already handles the floater and UI sync, so recovery is a call to shipping code. Enemy already supports reverse travel — reanimates do it — so the movement is not new either. The careful part is campaign scoring via commanders.js recordWorld.

**Why I held it back.** Dossier's stated cost: 'more state and readability burden than simple lives'. Concretely, the player must see at a glance how many lives are in flight versus lost or the HUD lies. Also interacts with the reanimate rule set — a carrier must not itself be reanimatable (set reanimated:true) or killing it produces value twice. And the ENEMY_MODS entry BRUTAL (config.js:948, 'every leak costs two extra lives') needs an explicit interaction rule.

## 2. Persistent battlefield scarring — reanimate wreckage denies rival build tiles

**Effort** M  ·  **Seen in** Dossier white space 'Persistent physical battlefield history' (rated Very High: few TDs let prior waves permanently scar routes and terrain); They Are Billions.

**The decision it creates.** Combat leaves the board permanently changed. A reanimate destroyed deep in enemy territory leaves a wreck occupying that tile for a number of waves, so pushing attacks converts into denying the rival SPACE rather than only into damage.

**Fit here.** It would make the reanimation loop strategic rather than only pressuring. Today a reanimate either leaks (damage) or dies (nothing). A third outcome — dies but takes a tile with it — makes sending waves a spatial investment and gives MASS CONSCRIPTION (config.js:935), NECROTIC SURGE (config.js:934) and the Xeno reanimate-strength bonus a second dimension. It creates an emergent late-battle texture where both boards visibly degrade, which suits the lore.

**How it would be built.** If pursued: on reanimate death, if within N tiles of a rival tower and NOT on a lane tile (check against Path.blockedTiles, entities.js:73), add the key to a per-side `wreck` Map with an expiry wave. canBuild (game.js:524) rejects wrecked tiles; existing towers are unaffected — never destroy owned towers, that is a separate and much larger mechanic. Draw wrecks distinctly from rubble and call renderBackground() (game.js:1370) on change. Expire in startWave. Must be symmetric: the rival AI's reanimates scar the player's board identically.

**Why I held it back.** Snowballing, plus invisibility — a player watching their own board will not see wrecks accumulating on the rival's and will not connect cause to effect. Needs a floater or HUD counter. Cap wrecks per wave and expire within 2-3 waves for a first prototype. Note the renderBackground re-bake makes this cheap per event but it is a full-canvas repaint; batch it to once per wave rather than per death.

## 3. Land as a purchasable or depleting resource (mutable build frontier)

**Effort** M  ·  **Seen in** Axon TD (map-tile expansion), Isle of Arrows (board is a resource), Emberward; dossier white space 'Topology + economy coupling — land as a tradeable/produced/depleting resource', rated High.

**The decision it creates.** Your buildable half stops being fixed. Gold buys the frontier forward toward the centre (or, inverted, tiles deplete with use), converting money directly into board AREA instead of into stats. Space joins towers and base levels in the same budget.

**Fit here.** If the owner wants it, two containable framings exist. DEPLETION rather than purchase pushes the same direction the current design already pushes — tiles wear out with use, the board shrinks over a long run, consolidation into fewer taller towers is forced as a SPATIAL pressure rather than only a price pressure. Or PER-BATTLE ONLY frontier purchase capped at 1-2 columns with a pulled-back start on one or two new maps, so nothing existing is retuned. Note the underlying decision is genuinely valuable: it is the only lever in the game that prices space rather than DPS, and the neutral strip is exactly the ground reanimates cross in both directions, so pushing the frontier would buy defensive reach AND offensive escort in one purchase.

**How it would be built.** If pursued: replace the read of FIELD.buildMax in Game.ownsTile (js/game.js:519-522) with a per-side S.frontier initialised in start(); add Game.buyFrontier(side) beside buyBaseLevel (game.js:562) using the baseLevelCost compounding shape, hard-capped at FIELD.neutral.from/to. The grid renderer at game.js:1393-1400 reads buildMax directly and must read the same S.frontier, then call renderBackground(). AI placement needs no change (ai.js:150 already funnels through canBuild) but wants frontier purchase in bestAction (ai.js:313). For CONFLUENCE, recompute ownerGrid (config.js buildTriField) with a per-side distance weight rather than columns.

**Why I held it back.** A runaway leader buys board faster — cap purchases per battle. The re-tune of all nine maps is the real cost and is why this is not S. Do not implement the purchase version without the owner explicitly reopening 'tiles are finite'.

## 4. Variable tower footprints

> ✅ **SHIPPED, Session 21 round two** (`7523182`). Ten 2x2 heavies plus a
> footprint engine touching 23 call sites; the arsenal went 50 → 60 towers,
> twelve per origin.


**Effort** M  ·  **Seen in** Emberward (unusual tower footprints alongside tetromino walls); dossier Tower Placement row 'variable footprints', ranked top-10 in 'Tower mechanics'.

**The decision it creates.** Not every tower occupies one cell. Heavy towers claim 2x2, so choosing them spends board AREA as well as gold, and the shape of your remaining free ground becomes a planning object.

**Fit here.** It gives the 32-tower roster a second axis of differentiation that survives ascension, and it is the only cost the base-level retrofit cannot solve — base levels raise every tower's power (game.js:562-580) but can never give you a tile back. A VAULT (config.js:596, pure economy) eating four tiles is a real economy-versus-defence BOARD decision rather than a pure gold decision, and a BEACON (config.js:471) whose aura radius is paid for in tiles rather than only in its 2.05 cost growth reads honestly. The contained version is close to shippable: assign 2x2 to VAULT and BEACON only — both optional support towers, so an unplaceable one is a diminished loadout rather than a broken one — plus deploy-time validation.

**How it would be built.** If pursued: add `foot: [w,h]` to tower defs (default [1,1]) in js/config.js. Game.canBuild (game.js:524) loops the footprint rectangle against bounds, ownsTile, this.blocked and towerAt; Game.towerAt (game.js:515) matches any tile inside a footprint. Hover ghost (game.js:1741-1749) and the tower draw scale to the footprint. AI.bestSpotFor (ai.js:289) needs the same scan when scoring candidates; its placement gate (ai.js:150) already calls canBuild so it stays correct.

**Why I held it back.** Unplaceable towers on the two scarcity maps; a loadout chosen pre-battle that turns out not to fit. Ship after rubble clearance so gold is always an escape hatch, and add deploy-time validation. Keep the 2x2 list short — expanding it later is easy, contracting it after players have learned boards is not.

## 5. Economy structures must survive to pay (jam gates VAULT income)

**Effort** S  ·  **Seen in** Thronefall (day economy / night defense; economy buildings must survive to finance later defense); dossier cross-genre import row 'Productive buildings + defense'.

**The decision it creates.** Income-producing structures are exposed to the threat, so where you put your economy is a defensive decision rather than a safe back-corner parking choice. The economy and the front line become the same problem.

**Fit here.** Flipping it means VAULT and TREASURY can no longer be parked in the safe corner; they must sit where the Jammer can reach, which is somewhere your other towers have to protect. That converts the VAULT line from a gold-per-tile calculation into a positional commitment, and gives the Jammer enemy a second job — note THE COIL already declares jammers as its denizens ('The coil crawls with tower-jamming vermin', config.js:72-73). It especially strengthens the branch split: TREASURY (flat 48 income, safe) versus TITHE ('Place it over your killzone', config.js:617) becomes a genuine risk/return choice rather than a stat preference. Cheapest option in this list to prototype.

**How it would be built.** If pursued: in js/entities.js:1258-1263, let the jam check gate the income tick as well as the firing tick — delete the `if (this.def.attack !== 'economy')` escape. Verify the VAULT income bar (entities.js:1823) reflects the stall so the player can see why the money stopped.

**Why I held it back.** Small change, disproportionate balance effect: VAULT already carries the steepest costGrowth in the roster at 2.35 (config.js:597), steepened a further 2.5x on the fractional part by game.js:589, so making it fragile as well may push it out of viability entirely. Measure VAULT pick rate before and after. Also the AI does not model income-tower vulnerability — check ai.js:289 bestSpotFor before shipping or the rival will keep parking vaults badly.

## 6. Commander attention as an economic resource (FOCUS)

**Effort** M  ·  **Seen in** PixelJunk Monsters (TD-MECH-041, avatar-accelerated tower leveling). Dossier ranks it #1 Rarest and top-3 Most Innovative; 'Player movement becomes an economic opportunity cost'.

**The decision it creates.** The player spends their own presence/attention as a currency: parking attention on one tower accelerates its growth at the cost of not having that attention anywhere else. One decision, two consequences.

**Fit here.** The natural attention budget already exists: the Q/E abilities on cooldowns, ticked by tickAbilities (abilities.js:139-151). A FOCUS mode could park the commander on one tower — that tower accelerates toward its next MK or ascension while BOTH ability cooldowns accrue slower for as long as focus is held. That is a clean two-consequence decision (economy vs intervention uptime) using only shipping systems, and it gives the commander a battlefield presence without an avatar entity, pathing or a new control scheme.

**How it would be built.** If pursued: a per-side focusTarget on side state; while set, add progress toward the tower's next upgrade tick and multiply the cooldown decrement in tickAbilities (js/abilities.js:145-149) by <1. Read it in the existing ability runtime rather than adding a new update loop.

**Why I held it back.** The dossier's own warning is busywork. In a 3-7 minute run (ROADMAP:194) with a 7-second build-window floor (config.js:913), a mechanic asking for continuous micro-attention may simply lose to clicking RUSH. It also partially fights base-level retrofit, which deliberately flattens per-tower individuality by raising every PLACED tower to the new floor (game.js:568-570) — if every tower is retrofitted anyway, accelerating one matters less than it should.

## 7. Fog over the rival board / visibility-gated placement

**Effort** M  ·  **Seen in** Arknights (TD-MECH-150 visibility-dependent deployment); dossier white space 'Information as build infrastructure', rated Very High.

**The decision it creates.** You cannot see the rival's defences unless you pay for vision. Scouting becomes infrastructure you build rather than a UI panel you read, and where you can legally build can itself depend on what you can see.

**Fit here.** If it fits, it fits unusually well: this is one of very few TDs with a real second board to hide, and elemental resistances (config.js:705-806 elemResist/elemWeak) mean scouting the rival's tower elements would be actionable information rather than trivia. It would give CONFLUENCE a scouting economy — which rival do I spend vision on? — and give the unbuilt multiplayer layer (ROADMAP:123) a genuine reason to exist beyond a relay.

**How it would be built.** If pursued: a per-side `vision` set of revealed tiles, populated by a scout/relay tower radius, a commander ability, and a small permanent reveal around the rival's base. Game.draw masks unrevealed rival tiles; the rival HUD panel shows only what vision covers. The AI must be given SYMMETRIC ignorance or it becomes unfair in the other direction — ai.js currently reads the full board freely (e.g. profile() and bestSpotFor at ai.js:289).

**Why I held it back.** The dossier's named risk is hidden-information hard-lock and frustration. The specific danger here is that a player who cannot see the rival's board also cannot understand why their reanimates are dying — turning the game's most satisfying feedback loop opaque. Prototype behind a flag and A/B it before committing.

## 8. Mutable destination — or its cheap approximation, a second spawn mouth

> ✅ **SHIPPED, Session 22**, as the cheap approximation this section
> recommends. THE SPLICE: kill a Parallel SPLICER on your ground and it cuts a
> temporary second lane into your board for one wave (`Game.openSplice`). It is
> a rival-triggered event rather than a player-bought one, which keeps the
> pathing cost bounded to a single wave.


**Effort** L  ·  **Seen in** Axon TD (TD-MECH-009 destination relocation); dossier ranks it 'very high' potential and very rare.

**The decision it creates.** Where the attackers are trying to GET stops being permanent. The base moves, or a second objective/spawn opens, and expensive positioning built for the old geometry is partly invalidated.

**Fit here.** The version genuinely worth considering is the cheap approximation, not the real thing: a mid-battle SECOND spawn mouth opening on your own half, announced a wave ahead. VERIFIED this is far less invasive — this.lanes[side] is already an array of Paths, multi-lane is proven on DELTA/CROSSROADS/RIFT, and spawnFromQueue already indexes `lanes[(entry.lane || 0) % lanes.length]` (game.js:497), so it absorbs a new lane with no scheduler change. It produces most of the same decision (your investment now faces the wrong way) at a fraction of the cost, and it would give ARENA_MODS (towers2.js:418) its first spatial entry — all current arena modifiers are stat changes.

**How it would be built.** If pursued as the approximation: an arena modifier that, at a fixed wave, constructs a new Path from an authored secondary lane in the map def and pushes it onto this.lanes[side], with a banner and a wave-preview note. Rebuild this.blocked for the new lane tiles (game.js:149-151) and call renderBackground() (game.js:1370) — note this can strand existing towers on now-blocked tiles, which needs an explicit rule (grandfather them).

**Why I held it back.** Invalidating expensive earlier positioning is the dossier's own stated risk and it is real here because of golden-exponent ascension pricing (config.js:253) — a player cannot cheaply rebuild. Any version must be telegraphed at least one wave ahead through the existing wave preview, and probably arrive with a gold or relocation credit.

## 9. Per-tower usage XP

**Effort** M  ·  **Seen in** Infinitode 2, PixelJunk Monsters, Defender's Quest; dossier ranks tower XP top-5 in 'Tower mechanics'.

**The decision it creates.** Towers level from their own kills rather than only from purchased upgrades, so where you placed a tower on wave 2 compounds by wave 20 and selling it forfeits accumulated history. Early placement becomes a long-horizon commitment.

**Fit here.** The bookkeeping is nearly free — Tower already tracks damageDealt and gold made, and kill attribution flows through killEnemy (game.js:978). The interesting version is XP that SURVIVES retrofit as a separate multiplicative track, so base level sets the floor and usage sets the ceiling; the two then layer instead of fighting. It would also make the 70% sell refund bite harder, since selling a veteran forfeits something gold cannot buy back — which in turn strengthens the relocation mechanic above.

**How it would be built.** If pursued: increment a per-tower xp field in killEnemy (js/game.js:978) where side kill stats are already incremented; fold a small multiplier into effDamage alongside the existing ascDamage and aura terms, capped via the STAT_CEIL pattern already used in applyTech.

**Why I held it back.** It compounds with ascension, which is infinite and golden-exponent priced (config.js:218-256). Two multiplicative progression tracks on the same object is exactly how the ROADMAP's documented Arc chain-lightning blowup happened (78 → 31,223, ROADMAP:195-196), which is why STAT_CEIL exists. Must route through STAT_CEIL. Needs an explicit owner decision on whether base-level retrofit stays as-is.

## 10. Tower upkeep / supply priority

**Effort** M  ·  **Seen in** Mindustry (ammunition logistics, power dependence, TD-MECH-029/136). Dossier white space: 'Traditional towers almost never require crews, wear, maintenance, spare parts or supply priorities' — rated High.

**The decision it creates.** Towers carry a recurring per-wave cost, so a board is not just something you bought once, it is something you are paying to keep. Board size becomes an ongoing time-cost rather than a one-time purchase cost.

**Fit here.** The interesting version is not a flat tax but a PRIORITY decision: when income cannot cover the whole board, the player nominates which towers stay supplied. That gives VAULT a genuine second job and makes 'few and tall vs many and wide' recur every wave instead of being settled at purchase time. It also puts a real cost on base-level retrofit, currently a pure-upside button, since retrofitting every tower would raise total upkeep.

**How it would be built.** If pursued: per-tower upkeep derived from invested gold, deducted in onWaveSpawned (js/game.js:427) before waveReward is paid; unsupplied towers go offline using the existing jam path — entities.js:1258-1263 already implements a fully-offline tower state, so the behavioural machinery is done. Add a supply-priority ordering to the inspector.

**Why I held it back.** High chance it reads as punishment rather than strategy in a game whose runs are 3-7 minutes (ROADMAP:194) — there may not be enough waves for the recurring cost to become interesting before it becomes annoying. Collides with base-level retrofit, a shipped and liked feature. Prototype behind a flag and measure whether median board size actually changes; if it only changes gold-per-wave, it is a tax, not a mechanic.

## 11. Territory-linked income (extraction / holding area pays)

**Effort** L  ·  **Seen in** Mindustry, Infinitode 2 (mining), Gnomes (farming shares the map and time budget with defense). Dossier: 'Few pure TDs make logistics/farming a first-class spatial problem' — rated High.

**The decision it creates.** Income is generated by holding map AREA rather than by holding a building, so the economy and the defensive front become the same object. Pushing the front out is an economic act; losing ground is an income loss before it is a life loss.

**Fit here.** CONFLUENCE already computes a per-tile Voronoi ownership grid for the 3-commander mode (buildTriField, config.js:170-190, consumed by ownsTile at game.js:519-521), so the data structure exists. Making territory pay would give the 3-way mode a distinct economic identity — three commanders contesting AREA rather than three commanders doing the same thing on separate lanes — which is the strongest argument for it. It couples cleanly with the reanimate loop: territory you hold is territory their reanimates must cross.

**How it would be built.** If pursued: generalise the buildTriField ownership computation, then pay per-wave income proportional to held cells in onWaveSpawned (js/game.js:427). Scope to the tri-mode map FIRST rather than all nine — that contains the blast radius and tests the idea where it is most differentiating.

**Why I held it back.** Positional income snowballs harder than flat income: win area → win money → win area. Needs diminishing returns per cell or a cap. Per-map tuning across nine maps of wildly different area is the real cost, which is why this is L not M.

## 12. Checkpoint rewind

**Effort** M  ·  **Seen in** Defense Grid: The Awakening (TD-MECH-122).

**The decision it creates.** The player rolls battle state back to a prior wave and revises the defence, converting failure into rapid experimentation rather than full repetition.

**Fit here.** The one framing that works is rewind as a DIFFICULTY ALLELE rather than a feature: a lower difficulty tier grants N rewinds and caps that world at 2 stars, so the player trades the top reward for the ability to experiment. That keeps commitment intact while giving new players a learning surface — fitting for a game where a novice dies around wave 10 by design (ROADMAP:193-194). Note it is incoherent in CONTESTED 3-way battles and against a live rival AI, so it must be single-front only.

**How it would be built.** If pursued: snapshot side states plus wave/spawnQueue at each onWaveSpawned boundary. The AI already does state save/restore for its own lookahead (js/ai.js:388-395 saves level/branch/asc/stats and Object.assigns them back), so a pattern for cloning tower state exists. Gate on a difficulty flag (DIFFICULTIES at config.js:201-206) and stamp the world's max star rating down when a rewind is used.

**Why I held it back.** Dossier: 'lowers consequence if too generous'. Here the consequence IS the currency, so any leak between rewind and star rating is a progression exploit. Must be enforced at the recordWorld ledger level in commanders.js, not in the UI.

## 13. Open-field shortest-path mazing

**Effort** L  ·  **Seen in** Desktop Tower Defense (TD-MECH-003), Wintermaul, Sanctum 2; the dossier's single most influential and most strategically deep spatial mechanic.

**The decision it creates.** Towers ARE the terrain. Enemies path to the base around whatever you build, so every purchase is simultaneously DPS and route engineering, with a legality rule guaranteeing a path always exists.

**Fit here.** The reanimation loop is what would break first and it is what is worth protecting: a reanimate walking your lane in reverse then the rival's lane forward is only coherent because both lanes are authored objects. If the owner wants this, the containable version is ONE dedicated map with a small mazeable sector between the frontier and the neutral strip, where a local grid path is computed and stitched into the authored lane at both ends — not a global rule change.

**How it would be built.** If pursued: add a per-map `maze: {x0,y0,x1,y1}` sector; run BFS/A* over that sector's free tiles whenever a tower is built or sold inside it; reject any placement that disconnects entry from exit (the standard legality rule); splice the resulting polyline into the authored Path at the sector boundary so Path, Enemy, reanimates and the AI all keep working outside the sector. Cache the route and recompute only on board change.

**Why I held it back.** Pathfinding exploits and degenerate longest-path solutions (the dossier's named risks), plus a per-frame cost the ROADMAP already flags as unbudgeted — REMAINING WORK item 2 (ROADMAP:63-64) notes there is no spatial hash grid yet. Do not attempt this before that performance work exists.

## 14. Deployment points as a second placement currency

**Effort** M  ·  **Seen in** Arknights (TD-MECH-113 deployment-point roster economy, full version).

**The decision it creates.** Placement draws on a separate regenerating pool rather than the same wallet as upgrades, so 'when do I commit this?' becomes as important as 'where?'.

**Fit here.** The genuinely separable and valuable half of this Arknights row is the redeployment cost and cooldown, which is covered by the Tower Relocation SHIP_NOW item above. Take that half; leave the currency.

**How it would be built.** Not recommended. If ever pursued it should arrive as a per-commander ALTERNATE economy (one faction plays on deployment points instead of gold) rather than a universal rule, so the benchmarked curve is untouched for everyone else.

**Why I held it back.** Re-tuning a curve on the ROADMAP's do-not-re-litigate list (ROADMAP:190-204). Two currencies also double the HUD's numeric load on a cockpit strip already compacted for space.

## 15. True 3D / multi-deck vertical mazing

**Effort** L  ·  **Seen in** No Creeps Were Harmed TD (TD-MECH-012); the dossier's top-ranked untapped spatial white space.

**The decision it creates.** Routes and kill zones use a third dimension — decks, ramps, ceilings — so a tower's coverage is a volume rather than a circle.

**Fit here.** The only 2D-tractable reduction is a two-deck board: upper and lower layers connected by ramps, with towers engaging only their own deck. That is a real mechanic and would be genuinely novel, but it is a large rendering, input and readability project, and it collides directly with the mirrored side-by-side presentation that makes the two-commander duel legible at a glance.

**How it would be built.** Not recommended at this stage. If ever attempted it belongs in a dedicated map with its own renderer — a `deck` field on every tile, per-deck blocked sets, ramp tiles connecting them, a deck field on Tower and Enemy gating targeting, and a visual treatment that keeps both decks readable simultaneously.

**Why I held it back.** Readability, on a screen already rendering two boards, a HUD strip, three commander panels on CONFLUENCE, and 106-121 measured peak enemies (ROADMAP:136). Also a straight collision with the ROADMAP's outstanding touch-support work, listed as the largest genuine gap remaining (ROADMAP:61-62).

---

## Built this session, for contrast

- **Interest on banked gold** [S] — Holding currency across a wave boundary pays a return, so not spending becomes an investment. Gold acquires a time value, creating a present-defense v
- **Escalation bidding — player picks the enemy modifier, pays for it with a better draft** [S] — Instead of the run's escalating enemy modifier being dealt to the player at random, the player picks which one lands from three, and taking the harshe
- **Finite block capacity on barricades** [S] — A wall holds a specific NUMBER of attackers, not all of them. The (N+1)th walks past. Blocking becomes a throughput budget you can be overwhelmed on r
- **Tower relocation with a fee and firing downtime** [S] — A placed tower can be picked up and set down elsewhere in your territory for a fraction of its invested value, keeping level, branch and ascensions, b
- **Rubble clearance — gold converts terrain into build space** [S] — Impassable terrain stops being permanent scenery. Paying an escalating price demolishes a rubble tile into buildable ground, so the maps defined by sc
- **Spatial cards in the existing command draft** [S] — The roguelike draft can hand you LAND instead of numbers: a free demolition of rubble, a terrain node placed where you choose. Drafting becomes a choi
- **MUSTER — paid send that also raises your income (offense-linked income)** [M] — Spending on aggression is simultaneously a macro investment: gold buys units that walk into the rival's lane AND permanently raises the buyer's future
- **Aimed commander abilities, delivering a placed construct** [M] — An ability that must be aimed at a tile and drops a temporary construct — a blocker, a minefield, a short-lived turret — rather than applying a number
- **Terrain nodes with elemental affinity** [M] — A small number of authored special tiles per map. Off-lane BUILD nodes grant an element affinity or stat lift to whatever tower stands on them; on-lan
- **Wave enraging — buy a harder wave for a bigger payout** [M] — The player voluntarily makes an upcoming wave stronger in exchange for a larger reward. Difficulty itself becomes an investable resource — the player,

## Verified already present

- Priority targeting rules
- Element / armour / shield / immunity resistance matrix
- Crowd-control grammar (slow / stun / freeze / knockback / pull / hard blocking)
- Threat-variety archetypes (flyers, healers, buffers, splitters, teleporters, summoners, silencers)
- Run-specific enemy modifier evolution with player counter-modifier draft
- Manual wave call with early-call reward
- Radius adjacency amplification
- Dedicated economy towers competing for board space
- Hard structural blocking on the lane
- Territory ownership as a placement rule
- Terrain that removes build space
- Partial resale as a commitment lever
- Mutually exclusive specialization
- Ascension, prestige, and run-tier escalation
- Speed control, pause, and the build/fight phase cycle
- Kill bounty and smooth per-wave reward
