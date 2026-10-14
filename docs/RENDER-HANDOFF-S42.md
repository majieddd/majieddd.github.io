# RENDER HANDOFF, Session 42

Everything the renderer needs, and nothing else. **Nothing has been rendered
yet.** The words are settled; this is the work order.

Live storyboard, with every panel and its current art:
<https://majieddd.github.io/narrative/>

---

## 1. What to run

```bash
cd <repo>
python artgen/krea_gen.py --only <key>          # one plate
python artgen/krea_gen.py --class pcut          # every planet plate
python artgen/repack.py                         # fold into js/artpack.js
node build.js && node tools/gate.js             # must be clean before pushing
```

Keys are seeded from the key string (FNV-1a), so **re-rendering a key is a
restore, not a re-roll**. Rendering the same key twice gives the same image.
That is what makes a wholesale class re-render safe.

Measured throughput: **47.5 seconds per plate** on the local 5090.

---

## 2. The work, in priority order

| # | Batch | Plates | GPU | Why now |
|---|---|---|---|---|
| 1 | **The human opening, slides 6 to 15** | 10 | 8 min | The opening is the strongest thing in the game and two thirds of it has no art |
| 2 | **EARTH, MERCURY, JUPITER, SATURN** | 100 | 1.3 h | Four Earth System worlds with NO plate at all |
| 3 | **Proxima Centauri, 7 worlds** | 175 | 2.3 h | The system replaced Barnard's Star; every plate is a different place |
| 4 | **Sirius, 7 worlds** | 175 | 2.3 h | The system replaced Tabby's Star; same |
| | | **460** | **6 h** | |

**LUNA, MARS and VENUS are already done.** Their art existed, it was just filed
under the wrong planet after the act was reordered, so it was MOVED rather than
re-rendered: the Luna shots onto Luna, the Venus shots onto Venus. Plates for
worlds that no longer exist (Ceres, Europa, Titan) and Earth's superseded brief
were set aside to `art/_retired/`, not deleted.

That is the cheapest 50 plates in this handoff and it cost no GPU time at all.
Check `art/_retired/` before rendering anything: a shot may already exist under
another world's name.

---

## 3. Batch 1: the opening, and what happened to the old five

The human intro went from 5 slides to 15. The old five plates still exist and
still resolve, and **four of them no longer illustrate the line they sit under**,
because the beats moved. Do not assume a numbered key means what it did before.

| Slide | Beat | Old plate at this key | Action |
|---|---|---|---|
| 1 | Apophis found in 2004, cleared, passes at 20,000 miles | asteroid looming over Earth at night | **RE-RENDER.** It is not a threat yet; it is a spectacle |
| 2 | A second moon, everyone watching together | crowd at a public screen | **RE-RENDER.** Festival, not vigil |
| 3 | Then it changed course | engineers around a blueprint | **RE-RENDER.** Observatory, tracking plot bending inward |
| 4 | The Disclosure. Nobody slept | asteroid shattering | **RE-RENDER.** This is the old slide 2 subject, reused here |
| 5 | Every government opens its drawer | fleet lifting toward the Moon | **RE-RENDER.** This is the old slide 1 subject |
| 6 | Best minds in one room; the holiday stands | none | NEW |
| 7 | The world goes outside to watch | none | NEW |
| **8** | **SILENT** | none | NEW. Square at night, every face up, the intercept flash, celebration |
| **9** | **SILENT** | none | NEW. Same crowd, same faces, sky filling with descending shapes. Cheering and dawning horror in one frame |
| **10** | **SILENT** | none | NEW. Ground level. It is among them |
| 11 | The rock was the delivery | none | NEW |
| 12 | 1947, and not being alone is not being among friends | none | NEW |
| 13 | 1959, the Antarctic pact | none | NEW |
| 14 | Eighty years of arsenal. Not for a rock | none | NEW |
| 15 | For anything | none | NEW |

**Slides 8, 9 and 10 are the ones that matter most.** They carry no caption at
all, so the images do the entire turn on their own. Render them as **one
continuous shot**: same plaza, same crowd, same camera position, three moments.
If they do not read as the same place, the sequence fails.

**Slides 14 and 15 are a matched pair**: the same emplacement and the same crew,
firing up at a fragment, then depressed to fire along the avenue at what came
out of it. Same gun, same people, two targets.

Prompts are already written in `artgen/krea_jobs.py`.

---

## 4. Batch 2: the four Earth System worlds with no art

| Key | World | State | Brief |
|---|---|---|---|
| 00 | EARTH | none | **A New York square**, the same one the opening ends in. Emplacements rising out of the plaza, batteries unshuttering on the rooftops, the crowd becoming a defence. The player is holding the city they just watched break |
| 04 | MERCURY | none | The terminator works: shuttered habs in the crawling band of shade, and a kilometres-wide ring buried in the iron below |
| 05 | JUPITER | none | The storm anchorage. No ground anywhere. Moored hulls strung together above a cloud deck, bands wider than worlds behind them |
| 06 | SATURN | none | **The hexagon.** Hard straight edges, six emitters at the corners, the rings cutting the frame. In the final beat the centre shows a starfield that does not belong to this sky |

EARTH matters most after the opening: it is the first board anyone plays, it
continues directly out of the last silent panel, and it should be recognisably
New York so the player knows exactly where they are standing.

SATURN is the act's climax and the only place in the solar system with corners.

## 5. Who is in each picture

Act one is **authored**, not rolled: the garrison is a story fact and is the
same for every player and every seed. The renderer needs this because it decides
who appears in the frame.

| World | Garrison | Scenario |
|---|---|---|
| EARTH | The Xeno | THE SWARM, survive it |
| LUNA | The Xeno in abandoned far-side depots, then the Vigil wakes and fights both sides | THE LONG VIGIL |
| MARS | The Xeno and the Parallel on the same ground | ASSAULT |
| VENUS | Federation of Light | ASSAULT |
| MERCURY | The Parallel, in numbers, around the ring | THE SWARM |
| JUPITER | Federation of Light, raided by the Parallel | OVERRUN |
| SATURN | The Xeno seat and their commander, hit by the Pirates at the same time, for the door | ASSAULT |

Every other system's garrison is the canon seed's roll and is shown per world on
the storyboard pages.

---

## 6. The identity rule, which is why the pack is consistent

Repeat each power's material nouns **verbatim** in every prompt that power
appears in. Consistency comes from repeated NOUNS, never from a shared adjective.
The dictionaries are in `artgen/planet_jobs.py` (`FLEET`, `FORCE`, `MARK`).

Full method: the `art-catalogue` skill, and `references/media-image.md` section
15 for this game's instantiation.

---

## 7. Before you push

```bash
node tools/gate.js          # parse, em dash, dead fields, planet text,
                            # faction lock, cold open, map geometry, build
node tools/storyboard.js    # rebuild narrative/ so the stale count drops
```

The storyboard index prints the count of panels whose art matches the text. It
should rise by exactly the number of plates rendered. **If it does not, the
render went to the wrong keys**, and that is the single most useful check
available here: existence proves nothing, because every stale key still
resolves.
