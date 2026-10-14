# SESSION 42 TASK LIST (owner directives, written down so nothing is lost)

Moved into the repo from a scratch file outside it, because a task list that
lives where git cannot see it is a task list that dies with the session.

Status updated as work lands. Scope lives in `GALAXY-SCOPE-S42.md`.

## A. Galaxy restructure (the big one)

- [ ] **A1. Core five systems become:** THE EARTH SYSTEM, ZETA RETICULI, THE
      PLEIADES, **SIRIUS**, **PROXIMA CENTAURI**.
      Barnard's Star and Tabby's Star are DISPLACED from core.
- [ ] **A2. Reassign the two homeless factions.** Pirates to Proxima Centauri
      (red flare dwarf like Barnard's, so world functions transfer; nearest
      port fits the Free Roads). Parallel to Sirius (Sirius B is a white dwarf,
      a star that shed its own form, which matches makers who evolved past
      physical form).
- [ ] **A3. Write 14 new worlds** (7 Proxima + 7 Sirius) x 5 factions.
      238 new authored lines. Caption drafts exist in `_hermes/cap_*.md`.
- [ ] **A4. Re-render 350 plates** for those 14 worlds. ~4.6 GPU hours.
- [ ] **A5. Bonus systems** (not official acts, extra XP + lore, the neutral
      robotic units and towers live here): KEPLER, ARCTURUS, VEGA/LYRA, plus
      demoted BARNARD'S STAR and TABBY'S STAR. 2 to 3 worlds each, 12 total.

## B. Cutscene quality

- [ ] **B1. Beat 5 variation.** Flag planting stays correct for MOST worlds.
      Some end instead on a commander at a distance WATCHING the flag go in
      and ruminating on whether this was the right thing. Roughly 5 reflective
      against 30 planted per faction. Target the seat worlds and the worlds
      where that faction's arc turns.
- [ ] **B2. Seat climax pass.** Scope seats FIRST. An act must LOOK like it
      has a climactic ending. Every planet should look unique and carry a
      scenario most planets would not have.
- [ ] **B3. Cohesion.** Assembled cutscenes should read like a movie with a
      visible evolution. Owner reports some moments are confusing and should
      be clarified. Fix planets and minor picture details.
- [ ] **B4. Captions must read as human narration**, not database text.
      Hermes drafts in `_hermes/cap_proxima.md` and `_hermes/cap_sirius.md`
      hit this voice. Two known defects to edit out before use: cap_proxima
      duplicates its last line, and calls Proxima c a moon that "they froze"
      when it is a super Earth frozen by being 1.5 AU out.

## C. Tooling / process

- [x] **C1. Hermes identified.** NOT hydra. Nous Research `hermes-agent`,
      Electron app plus CLI at
      `C:\Users\Majied\AppData\Local\hermes\hermes-agent\bin\hermes.cmd`.
      One shot mode is `hermes -z PROMPT -m MODEL`. Cloud, so it does NOT
      contend with the local 5090 that renders plates.
- [x] **C2. Hermes subagents USED.** `tools/hermes_fanout.sh` runs 10 in
      parallel. First run caught THREE factual errors in the scope doc that
      had already been written and would otherwise have shipped.

      **THE MODEL SLUG IS `hy3-free`, NOT `hy3`.** A bare `hy3` resolves to
      provider `opencode-go`, which demands an `OPENCODE_GO_API_KEY` this
      machine does not have. `hy3-free` stays on the configured keyless
      `opencode-free` provider at `https://opencode.ai/zen/v1`. Diagnosing
      this cost most of a session: OpenRouter's key is near exhausted, its
      free daily quota is spent, and Nous Portal is not logged in, so all
      three of those are dead ends and the working path is the configured
      one. Full model list: `curl -s https://opencode.ai/zen/v1/models`.
- [x] **C3. Scope on paper first.** `GALAXY-SCOPE-S42.md` now covers all TEN
      systems world by world, not just the two new ones.

## D. Carried over from the previous prompt (do not drop)

- [x] **D1. Earth as world zero** and the Apophis Trojan Horse. Shipped.
- [x] **D2. Oath rewritten** to the owner's five beats. Shipped.
- [x] **D3. Per act morals** grounded in what each act contains. Shipped.
- [ ] **D4. Moral lesson framing** in the Avatar / Tyranny sense, surfaced so a
      player vicariously learns something per faction. Partially done via
      ACT_MORALS; still needs the per world moral the grade doc asked for.
- [ ] **D5. Adversarial grade defects still open:** identical 5 beat template
      across all worlds (#1), the six moments change words but not pictures
      (#2), beat 5 is flag in rubble 175 times (#4), seats not visually
      distinct (#5), no per world moral (#7).

## E. Corrections to record

- **Sirius B is not a diamond star yet.** At ~25,000 K and ~126 Myr into
  cooling its carbon core has NOT crystallised; the famous crystallised dwarf
  is BPM 37093. THE DIAMOND SHELF is therefore named for what the Parallel
  knows the star WILL become, which is better in character than the error was.
- **Arcturus is Norma Milanovich, not Edgar Cayce.** An earlier pass of the
  scope doc credited Cayce and was wrong. Cayce is not the source for any of
  the five traditions this game uses.
- **Vega has no confirmed planet.** The candidate is a roughly Jupiter mass
  companion inferred from disk asymmetry, never imaged.
- Law of One (Ra, 1981 to 1984) DOES cover a Sirius social memory complex, and
  Ra is described as having evolved on Venus. **Arcturians and the Lyran root
  race are NOT Law of One**; they are Milanovich and Meier respectively.
- An external grading pass proposed 25 act morals; several were off canon
  (sealed machines in the Hungry's Tabby's act, repair yards in Zeta, the
  ledger in Sol). Its STRUCTURAL defects were verified and are real; its per
  act content was not trusted.
