#!/bin/bash
# HIGHPOLY v2 FINAL: gate + visual capture + shadow A/B, one server lifetime.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/gate.js http://127.0.0.1:8741 > /tmp/hp_gate_v2f.log 2>&1
GATE=$?
OUT="C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa"
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "$OUT" aegis-3d-highpoly-v2/tools/visual.steps.cjs > /tmp/hp_vis_v2f.log 2>&1
VIS=$?
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "$OUT" aegis-3d-highpoly-v2/tools/shadow.steps.cjs > /tmp/hp_shd_v2f.log 2>&1
SHD=$?
kill $SRV 2>/dev/null
echo "GATE_EXIT=$GATE VIS_EXIT=$VIS SHD_EXIT=$SHD"
grep -E "ok|FAIL|GATE" /tmp/hp_gate_v2f.log | tail -12
exit $((GATE + VIS + SHD))
