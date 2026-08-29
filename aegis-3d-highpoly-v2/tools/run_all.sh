#!/bin/bash
# HIGHPOLY v2: gate (functional) + perf audit + visual capture, one server.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/gate.js http://127.0.0.1:8741 > /tmp/hp_gate_v2.log 2>&1
GATE=$?
OUT="C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa"
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "$OUT" aegis-3d-highpoly-v2/tools/perf.steps.cjs > /tmp/hp_perf_v2.log 2>&1
PERF=$?
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "$OUT" aegis-3d-highpoly-v2/tools/visual.steps.cjs > /tmp/hp_vis_v2.log 2>&1
VIS=$?
kill $SRV 2>/dev/null
echo "GATE_EXIT=$GATE PERF_EXIT=$PERF VIS_EXIT=$VIS"
grep -E "ok|FAIL|GATE" /tmp/hp_gate_v2.log | tail -12
echo "=== PERF ==="
grep -oE '"value": "[^"]*"' /tmp/hp_perf_v2.log | head -8
exit $((GATE + PERF + VIS))
