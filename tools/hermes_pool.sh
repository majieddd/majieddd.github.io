#!/usr/bin/env bash
# Bounded-concurrency Hermes worker pool. Queue hundreds of tasks, run N at once.
#
# Why bounded: every hermes.cmd invocation spawns its own Python process, so
# "summon 100 agents" literally means 100 interpreters. Unbounded, the box
# thrashes and the slowest task still gates the batch. A pool of ~12 keeps the
# machine responsive AND keeps the cloud endpoint from rate limiting, while
# still draining a 100-task queue in a handful of waves.
#
# RESUMABLE BY DESIGN. A task whose output file already exists and is non-empty
# is skipped. So a killed batch costs only the tasks that were in flight, and
# re-running is free. Delete an output file to force that one task to re-run.
#
# Usage:
#   write prompts to  _hermes/tasks/<name>.prompt   (one file per agent)
#   bash tools/hermes_pool.sh [concurrency]         (default 12)
#   read results from _hermes/out/<name>.md
#
# The model slug is hy3-free, NOT hy3. See tools/hermes_fanout.sh for why.

set -uo pipefail

N="${1:-12}"
ROOT="D:/ClaudeProjects/RemoteWorkspace/TowerDefense/_hermes"
export HERMES_BIN="/c/Users/Majied/AppData/Local/hermes/hermes-agent"
export TASKS="$ROOT/tasks"
export OUTD="$ROOT/out"
mkdir -p "$TASKS" "$OUTD"

one() {
  f="$1"
  name="$(basename "$f" .prompt)"
  out="$OUTD/$name.md"
  if [ -s "$out" ]; then echo "skip $name"; return 0; fi
  # Write to a temp file first so a killed run never leaves a truncated output
  # that the resume check would then wrongly treat as complete.
  tmp="$out.partial"
  ( cd "$HERMES_BIN" && timeout 900 ./bin/hermes.cmd -z "$(cat "$f")" -m hy3-free ) > "$tmp" 2>&1
  if [ -s "$tmp" ]; then mv -f "$tmp" "$out"; echo "done $name"; else rm -f "$tmp"; echo "FAIL $name"; fi
}
export -f one

total=$(find "$TASKS" -name '*.prompt' | wc -l)
echo "queue: $total tasks, concurrency $N"
find "$TASKS" -name '*.prompt' -print0 | xargs -0 -P "$N" -I{} bash -c 'one "$@"' _ {}

echo "---- pool drained ----"
done_n=$(find "$OUTD" -name '*.md' -size +0 | wc -l)
fail_n=$(find "$OUTD" -name '*.partial' 2>/dev/null | wc -l)
echo "outputs: $done_n   partial/failed: $fail_n   queued: $total"
[ "$done_n" -lt "$total" ] && echo "WARNING: $((total - done_n)) task(s) produced no output; re-run to retry only those."
exit 0
