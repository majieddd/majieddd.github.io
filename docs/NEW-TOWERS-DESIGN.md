# Eleven new towers — Session 19 design

Closes roadmap **19.21** (ten towers per power) and **19.22** (deliberate,
distinct balance curves).

Current rosters: human 10, light 7, xeno 7, pirate 7, robotic 8. So **+3 light,
+3 xeno, +3 pirate, +2 robotic**.

## The rule these are designed against

The arsenal already carries **70 distinct mechanic keys**. The constraint from
[`TOWER-AUDIT.md`](TOWER-AUDIT.md) is enforced here: *a new tower is not approved
until it names a `base` key that appears nowhere else, and that key has a real
reader.* Every key below was checked against the existing seventy.

The higher bar, from the owner: each must **change how a board is played**, not
adjust a number on it. A tower whose identity is "+X% damage" fails this brief
even if it is perfectly balanced. The reference points are Kingdom Rush and
Bloons TD 6 for tower identity, and Hades for how a small kit can feel
enormously distinct.

Curve shapes are stated per tower, per 19.22: **opener** (strong the wave it is
placed, falls off), **conditional** (strong only when a specific thing is true),
or **investment** (weak on placement, strong on a board that has held).

---

## Federation of Light — *a member surrenders their life eternally to the cause*

The Federation's three are about **service that outlasts the servant**, and
about **giving something up to buy something**.

### SEPULCHRE — *investment*
> When any tower of yours is sold or destroyed, it does not stop firing. It
> keeps the line at reduced power until the wave ends.

`sepulchreDur`, `sepulchreFrac` — **new axis: death-triggered persistence.**
Nothing in the arsenal reacts to your own tower leaving the board. It turns
selling from a pure loss into a tempo play, and it is the faction's tenet stated
as a mechanic: the tower surrendered its existence and kept serving anyway.

*Curve:* an investment. Worthless on an empty board; transformative once you
have towers worth losing, and it rewards the late-game habit of selling into
better placements.

### ORISON — *conditional*
> Each wave it names one enemy the offering. While that enemy lives every tower
> you own hits harder; when it dies you are given back a life.

`offeringDmg`, `offeringLives` — **new axis: a self-imposed priority target.**
It inverts normal tower-defence instinct — you want the marked enemy to live a
little longer, and killing it early costs you the buff. That tension is the
whole tower.

*Curve:* conditional. Enormous on waves with a single fat target, nearly idle on
a swarm — so it argues with your roster rather than scaling with it.

### ANTIPHON — *conditional*
> Every one of your own mustered units that dies on a rival's lane answers here:
> the tower fires a free volley for each loss.

`antiphonPerLoss` — **new axis: the send feeding the defence.** Nothing couples
the two halves of this game. It makes an aggressive muster strategy pay
defensive dividends, and it is the only tower whose output depends on what is
happening on somebody else's board.

*Curve:* conditional, and uniquely PvP — dead weight if you never send, superb
if you send constantly.

---

## The Xeno — *not an alliance, an appetite*

All three turn something consumed into more of themselves.

### GESTALT — *investment, with a threat*
> Grows permanently with every kill in range. If it goes too long without one it
> forgets everything it learned.

`gestaltPerKill`, `gestaltDecay` — **new axis: use-it-or-lose-it growth.** The
existing `ramp`/`rampMax` pair is per-engagement; this is permanent accumulation
that decays. It must be placed where kills are constant, which makes *position*
its real cost rather than gold.

*Curve:* an investment that can be lost. Punishes a board that goes quiet.

### MAW — *conditional*
> Swallows one creature whole. It is simply gone — and digested into gold over
> the next several seconds.

`mawCd`, `mawDigest` — **new axis: removal.** Nothing else deletes an enemy
outright rather than damaging it. Against a single unkillable elite it is the
answer; against a swarm it eats one mite and looks foolish. Its value is
entirely decided by what is walking at it.

*Curve:* conditional, and the hardest counter in the arsenal to a boss the
player cannot out-damage.

### HUNGERING VEIL — *conditional*
> Inside the veil, a creature pays for every point of health it has ever been
> given. Healing is a debt.

`veilHealTax` — **new axis: punishing a specific enemy behaviour.** Menders,
Aegis shields and regenerating bosses become liabilities to their own side. It
is the only tower that reads the enemy's *history* rather than its current
state.

*Curve:* conditional. Near-useless on a wave with no support, decisive on one
built around it.

---

## The Pirates — *no allegiance, and the swarms in the dark answer to them*

Theft, conscription, and a genuinely bad idea.

### PRESS GANG — *opener*
> Kills do not stay dead. It conscripts what it kills into a short-lived fighter
> that holds YOUR lane.

`pressCd`, `pressDur` — **new axis: defensive conscription.** FOUNDRY forges
bodies and SIREN sends them at a rival; nothing turns a corpse into a *defender*
of your own ground. It is the reanimation loop pointed inward.

*Curve:* an opener. Strong early when a single body buys real time, diluted late
when waves are too heavy for one conscript to matter.

### PRIVATEER — *investment, and pure PvP*
> Every kill takes coin out of a rival's pocket and puts it in yours.

`privateerSteal` — **new axis: a tower that reaches the rival's economy.**
Every other tower fights the neutral wave. This one is aimed at the other
commander, which is the premise of the whole game finally expressed as a
building.

*Curve:* an investment that compounds — and in the twenty-seat arena it must
choose a victim, so it inherits the seat logic rather than assuming two sides.

### BLOOD PRICE — *opener, and a real decision*
> It is not bought with gold. It is bought with lives.

`lifeCost` — **new axis: a second currency.** The boldest of the eleven and the
most Pirate thing in the game: enormous power available immediately, paid for
out of the only resource you cannot earn back easily. Building two is a
statement about how the run is going.

*Curve:* an opener by construction — it converts your survival buffer directly
into early tempo, and the bill is permanent.

---

## Robotic — *semi-sentient machines protecting a universe from everyone in it*

The machine line is story-unlocked (19.5), so these two are also two more
solar-system rewards and should sit late in that ladder.

### REPLICATOR — *investment*
> Left alone long enough, it builds another tower. It does not ask which.

`replicateEvery` — **new axis: a tower that places towers.** The purest
expression of a machine that does not need you. Slow enough that it is a bet on
surviving, and it fills tiles you did not choose, which is a real cost on a
tight board.

*Curve:* the longest investment in the arsenal — nothing for several waves, then
compounding.

### NULL FIELD — *conditional*
> Inside it, nothing special works. No healing, no shielding, no blinking, no
> jamming. Only walking, and dying.

`nullRadius` — **new axis: ability suppression.** The arsenal can out-damage a
mechanic but cannot switch one off. Against the enemy classes built entirely on
an ability — menders, wraiths, jammers, blinks — it is total, and against a
plain armoured wave it does nothing at all.

*Curve:* conditional, and the clearest example of the owner's brief that some
towers should be answers rather than upgrades.

---

## Novelty check

Every key here was checked against the seventy already in the arsenal:

`sepulchreDur` · `sepulchreFrac` · `offeringDmg` · `offeringLives` ·
`antiphonPerLoss` · `gestaltPerKill` · `gestaltDecay` · `mawCd` · `mawDigest` ·
`veilHealTax` · `pressCd` · `pressDur` · `privateerSteal` · `lifeCost` ·
`replicateEvery` · `nullRadius`

None collides. Each needs a **reader written in `js/entities.js`** as part of
implementation — the audit rule is that a key without a reader is an inert
tower, and this project has shipped five inert talents and six inert traits
exactly that way.

## Balance

Eleven towers is a large addition to the power budget, and three of them
(PRIVATEER, BLOOD PRICE, ANTIPHON) touch resources rather than damage, which the
pins are least able to see. Re-measure both after landing, and specifically
instrument BLOOD PRICE — a tower that spends lives can make the fresh pin look
*better* while making the game worse, because the mirror-AI will happily trade
its buffer for tempo.
