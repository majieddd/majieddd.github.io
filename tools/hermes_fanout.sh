#!/usr/bin/env bash
# Fan out research and drafting to Hermes running hy3-free, in parallel.
#
# Why this file exists: the owner asked for ~10 subagents through Hermes so the
# main session orchestrates instead of doing every lookup itself. Hermes is a
# CLOUD harness (opencode-free / https://opencode.ai/zen/v1), so it does NOT
# contend with the local RTX 5090 that renders plates. Both can run at once.
#
# THE SLUG IS "hy3-free", NOT "hy3". A bare "hy3" resolves to provider
# "opencode-go", which demands OPENCODE_GO_API_KEY that this machine does not
# have; "hy3-free" stays on the configured keyless opencode-free provider.
# That one character cost a session once. Do not "simplify" it back.
#
# Outputs are DRAFTS to be verified, never ground truth: hy3-free is a small
# fast model and this suite's standing law is measure, do not assert.

HB="/c/Users/Majied/AppData/Local/hermes/hermes-agent"
OUT="D:/ClaudeProjects/RemoteWorkspace/TowerDefense/_hermes"
mkdir -p "$OUT"

run() {
  name="$1"; shift
  ( cd "$HB" && timeout 900 ./bin/hermes.cmd -z "$*" -m hy3-free ) > "$OUT/$name.md" 2>&1
  echo "done $name"
}

BREV="Answer in under 130 words, plain prose, no preamble, no bullet symbols. State plainly if something is unconfirmed."

run proxima "Astronomy only. Proxima Centauri and its planets Proxima b, Proxima c, Proxima d. For each give mass or minimum mass, orbital distance in AU, orbital period, and whether it is confirmed or a candidate. Also state how often Proxima flares and what that does to a surface. $BREV" &

run sirius "Astronomy only. The Sirius binary. Sirius A spectral type and luminosity. Sirius B as a white dwarf: former mass, current mass and radius, surface gravity. Is it true that its carbon core crystallises, and is calling it a diamond star accurate or journalism? $BREV" &

run tabby "Astronomy only. KIC 8462852, the Tabby Star. Give the depth and dates of the major dimming events, the long term dimming trend, and the current leading natural explanation. State clearly where the megastructure hypothesis now stands. $BREV" &

run barnard "Astronomy only. Barnard Star. Its proper motion in arcseconds per year and why that is notable. Which planets are currently confirmed around it, their masses and periods, and which earlier claimed detections were retracted. $BREV" &

run kepler "Astronomy only. Kepler-186f, Kepler-442b and Kepler-452b. For each give radius relative to Earth, orbital period, host star spectral type, and how strong the habitable zone claim actually is. Note which has the highest habitability index. $BREV" &

run arcturus "Astronomy only. Arcturus, Alpha Bootis. Spectral type, radius and luminosity relative to the Sun, distance in light years, and its unusual halo population velocity. Are any planets confirmed around it? $BREV" &

run vega "Astronomy only. Vega, Alpha Lyrae. Distance, rotation speed and the resulting oblateness, its pole on orientation toward Earth, and its debris disk. Is any planet around Vega confirmed or only a candidate? $BREV" &

run attribution "Source attribution question, answer factually about what each tradition claims, not whether it is true. Which contactee or channeled tradition is the origin of each of these: a Sirius social memory complex, the Arcturians, the Lyran root race of humanity, the Pleiadian contacts, and the Zeta Reticuli grey aliens. Name the specific source for each: the Law of One Ra material, Edgar Cayce, Norma Milanovich, Billy Meier, or the Betty and Barney Hill case. $BREV" &

run cap_proxima "You are writing one line of narration per location for a painted science fiction strategy game. Voice: a human veteran remembering, plain and concrete, never marketing copy, never a database entry. One sentence each, under 20 words. No preamble. The locations, all in the Proxima Centauri system held by a pirate faction called the Free Roads: 1 PROXIMA d, the wreck yards. 2 PROXIMA b, the terminator strip, the only liveable band on a tide locked world. 3 PROXIMA c, the cold refinery. 4 THE FLARE SHELTER, a dug in warren. 5 THE NARROWS, a toll gate. 6 THE DARK LOCKER, a black market vault. 7 PROXIMA GATE, the sanctuary bay and their capital." &

run cap_sirius "You are writing one line of narration per location for a painted science fiction strategy game. Voice: a human veteran remembering, plain and concrete, never marketing copy, never a database entry. One sentence each, under 20 words. No preamble. The locations, all in the Sirius system held by an ancient machine faction called the Parallel who long ago abandoned physical bodies: 1 SIRIUS A I, the machine garden. 2 SIRIUS A II, the foundry. 3 THE ASH FIELD, the archive, built in debris the collapsing companion star shed. 4 SIRIUS B I, the quarantine. 5 THE DIAMOND SHELF, the repair yards on the crystallised carbon core. 6 THE COMPANION, the task queue relay. 7 THE DOG STAR, the origin, where the orders come from." &

wait
echo "ALL HERMES TASKS COMPLETE"
ls -la "$OUT"
