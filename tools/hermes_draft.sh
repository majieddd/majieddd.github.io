#!/usr/bin/env bash
# Draft the faction dialogue cells for the 14 new core worlds, 10 agents wide.
#
# Division of labour, deliberate: Hermes drafts VOICE, this session writes the
# art-driving strings. The art strings encode measured prompt laws (event nouns
# on assault beats, positively described blank surfaces, per-faction material
# nouns) that a drafting model has no way to know, and getting them wrong costs
# GPU hours. Voice is the part hy3-free demonstrably does well.
#
# Every line that comes back is a DRAFT to be edited for canon before it ships.
# See tools/hermes_fanout.sh for the hy3-free slug trap.

HB="/c/Users/Majied/AppData/Local/hermes/hermes-agent"
OUT="D:/ClaudeProjects/RemoteWorkspace/TowerDefense/_hermes/draft"
mkdir -p "$OUT"

run() {
  name="$1"; shift
  # One line only: cmd.exe hangs on long multi-line arguments. See
  # tools/gen_hermes_tasks.py for the measurement that established this.
  p="$(printf '%s' "$*" | tr '\n' ' ')"
  ( cd "$HB" && timeout 600 ./bin/hermes.cmd -z "$p" -m hy3-free ) > "$OUT/$name.md" 2>&1
  echo "done $name"
}

# The lore contract, prepended to every prompt. Hermes runs outside this repo and
# cannot load the aegis-suite plugin, so the plugin's binding laws are distilled
# into one file and injected instead. Owner directive: the drafting agents are
# held to the same lore rules as the session driving them.
PREAMBLE=$(cat "D:/ClaudeProjects/RemoteWorkspace/TowerDefense/tools/hermes_lore_preamble.txt")
BAR="============================================================"

FORMAT=$(cat <<'EOF'
FORMAT, follow exactly. Output exactly 7 lines, one per world, and nothing else.
No preamble, no numbering, no blank lines, no closing remark.
Each line must be: WORLDNAME | arrival | taken | new order
Three segments separated by the pipe character.
Each segment is one or two sentences, under 32 words, concrete, no marketing copy.
ARRIVAL is spoken on approach, before the fighting, looking at the place.
TAKEN is spoken immediately after winning, standing in it.
NEW ORDER is what the place becomes under this faction afterward.
NEVER use an em dash. Use commas, colons or full stops.
EOF
)

PROXIMA=$(cat <<'EOF'
The system is PROXIMA CENTAURI: a red flare dwarf, the closest star to Earth, and the home of a pirate faction called the Free Roads. Its seven worlds:
PROXIMA d, the wreck yards, a plain of hulls from a hundred different builders
PROXIMA b, the terminator strip, a tide locked world whose only liveable ground is the thin band between endless day and endless night
PROXIMA c, the cold refinery, a frozen super Earth far out where volatiles are cracked
THE FLARE SHELTER, a dug in warren of habs under metres of rock, because the star flares hard enough to strip a surface bare
THE NARROWS, a toll gate, a ring of gun platforms strung on cables across the only clear lane
THE DARK LOCKER, a black market vault hollowed into an unlit rock in the outer dark
PROXIMA GATE, the sanctuary bay, a great interior harbour, the Free Roads capital and the first port out of Sol
EOF
)

SIRIUS=$(cat <<'EOF'
The system is SIRIUS: a binary of a blazing white star and a white dwarf companion, home of an ancient machine faction called the Parallel who gave up physical bodies long ago. Its seven worlds:
SIRIUS A I, the machine garden, terraces of dormant automata standing in rows
SIRIUS A II, the foundry, a canyon of casting halls turning out identical units
THE ASH FIELD, the archive, built in the debris the companion star shed when it collapsed
SIRIUS B I, the quarantine, sealed white halls holding units that failed inspection
THE DIAMOND SHELF, the repair yards, standing on a carbon core that has NOT crystallised yet but one day will, which is what the Parallel named it for
THE COMPANION, the task queue relay, a mast and yard where the standing orders are passed down
THE DOG STAR, the origin, where the orders come from, and the Parallel capital
EOF
)

V_human=$(cat <<'EOF'
VOICE: Humanity. Blunt soldiers, first person plural, short sentences, bitter and tired, no poetry. They have just learned the Apophis asteroid was a Trojan horse and that other powers knew. Sample of the correct voice:
"This is the day. The rock is gravel over our heads and the gravel had passengers. Everything we thought we were surviving was the delivery."
EOF
)

V_light=$(cat <<'EOF'
VOICE: the Federation of Light, the Luminous Accord. Sacred bureaucracy. They speak in registries, mandates, protections flagged and then deferred for decades. Their guilt is paperwork. Never gloating, and they never demand anyone give up their free will: their menace is protecting people who never asked to be protected. Sample of the correct voice:
"Earth. Flagged for protection in 1947, deferred every year since, and we arrive eighty years late with the rock already broken over it."
EOF
)

V_xeno=$(cat <<'EOF'
VOICE: the Xeno, meaning the Extraction Compact. A BUSINESS, not a species: never write it as a race and never call anyone "a Xeno". Livestock and harvest language, cold and proprietary. They speak of herds, yield, pens, stock, quotas and schedules. They are not cruel, they are agricultural. Sample of the correct voice:
"The delivery world. Everything inside that rock was ours, seeded and patient, and the herd broke the package open ahead of schedule. Collect what survived."
EOF
)

V_pirate=$(cat <<'EOF'
VOICE: the Pirates, the Free Captains, who call their territory the Free Roads. Rough, warm, first person, loyal to crews and hostile to authority. Salvage, tolls, debts, no fee. Sample of the correct voice:
"Every crew out here has hauled something OUT of this system and not one of us ever asked what was coming in. Today we go and look at the crate."
EOF
)

V_robot=$(cat <<'EOF'
VOICE: the Parallel, the Continuance coalition, an ancient machine order. It is NOT the Vigil. Clipped site logs. Uses ALL CAPS labels like "SITE:" and "STATUS:" at the start of some segments. Refers to itself as "This unit" and never as "we". Speaks of "the queue", "the core", "standing orders". Its quiet horror is that it does not know who writes the orders. Sample of the correct voice:
"SITE: EARTH, IMPACT DISTRICT. DELIVERY VEHICLE CONTENTS: organic and maker-format units, mixed, pre-positioned. This unit notes that the queue routed the vehicle."
EOF
)

HOME_NOTE="NOTE: this is this faction's OWN home system. The tone is holding, returning, or defending what is already theirs, never conquering a stranger."
AWAY_NOTE="NOTE: this is somebody else's home system. This faction is the outsider arriving in it."

for F in human light xeno pirate robot; do
  eval "V=\$V_$F"
  if [ "$F" = "pirate" ]; then PN="$HOME_NOTE"; else PN="$AWAY_NOTE"; fi
  if [ "$F" = "robot" ];  then SN="$HOME_NOTE"; else SN="$AWAY_NOTE"; fi
  run "prox_$F"   "$PREAMBLE

$BAR

You are writing dialogue for a painted science fiction strategy game. $V

$PROXIMA

$PN

$FORMAT" &
  run "sirius_$F" "$PREAMBLE

$BAR

You are writing dialogue for a painted science fiction strategy game. $V

$SIRIUS

$SN

$FORMAT" &
done

wait
echo "ALL DRAFTS COMPLETE"
wc -l "$OUT"/*.md
