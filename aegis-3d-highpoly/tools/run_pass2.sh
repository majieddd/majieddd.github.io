#!/bin/bash
# HIGHPOLY second pass: gate then visuals, one server lifetime.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly/tools/gate.js http://127.0.0.1:8741 > /tmp/hp_gate2.log 2>&1
GATE=$?
OUT="C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly/qa"
node aegis-3d-highpoly/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly/index.html "$OUT" aegis-3d-highpoly/tools/visual.steps.cjs > /tmp/hp_vis2.log 2>&1
VIS=$?
kill $SRV 2>/dev/null
echo "GATE_EXIT=$GATE VIS_EXIT=$VIS"
grep -E "ok|FAIL|GATE" /tmp/hp_gate2.log | tail -14
exit $((GATE + VIS))
