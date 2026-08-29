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

# Default 6, not 12. Measured: 12 concurrent workers rate limited the free
# endpoint hard enough that a quarter of the batch came back as HTTP 429.
# Throughput is set by the provider here, not by the local machine.
N="${1:-6}"
ROOT="D:/ClaudeProjects/RemoteWorkspace/TowerDefense/_hermes"
export HERMES_BIN="/c/Users/Majied/AppData/Local/hermes/hermes-agent"
export TASKS="$ROOT/tasks"
export OUTD="$ROOT/out"
mkdir -p "$TASKS" "$OUTD"

# A FAILED CALL STILL WRITES A FILE. Observed live at 12-way concurrency: the
# free endpoint rate limited, hermes wrote "API call failed after 3 retries:
# HTTP 429" into the output, the pool saved that as a result, and the resume
# check would then skip those tasks FOREVER while the batch reported complete.
# An error transcript is not content. Same defect class as a probe whose pass
# and failure share a channel.
ERRRX='API call failed|HTTP [0-9]{3}|Rate limit exceeded|Billing or credits|No usable credentials|agent failed:'
export ERRRX

one() {
  f="$1"
  name="$(basename "$f" .prompt)"
  out="$OUTD/$name.md"
  if [ -s "$out" ] && ! grep -qE "$ERRRX" "$out"; then echo "skip $name"; return 0; fi
  # Write to a temp file first so a killed run never leaves a truncated output
  # that the resume check would then wrongly treat as complete.
  tmp="$out.partial"
  # Collapse to one line. cmd.exe mangles long arguments carrying newlines
  # rather than failing, which presents as every worker hanging forever.
  p="$(tr '\n' ' ' < "$f")"
  for attempt in 1 2 3; do
    ( cd "$HERMES_BIN" && timeout 600 ./bin/hermes.cmd -z "$p" -m hy3-free ) > "$tmp" 2>&1
    if [ -s "$tmp" ] && ! grep -qE "$ERRRX" "$tmp"; then
      mv -f "$tmp" "$out"; echo "done $name"; return 0
    fi
    # Back off before retrying: the failure this exists for is a shared rate
    # limit, so hammering it immediately makes the whole batch worse.
    sleep $((attempt * 25))
  done
  rm -f "$tmp"
  echo "FAIL $name (empty or rate limited after 3 attempts)"
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
