#!/bin/bash
# HIGHPOLY v2 perf audit (deterministic renderOnce microbench).
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa" aegis-3d-highpoly-v2/tools/perf.steps.cjs > /tmp/hp_perf_v2.log 2>&1
PERF=$?
kill $SRV 2>/dev/null
echo "PERF_EXIT=$PERF"
grep -oE '"value": "[^"]*"' /tmp/hp_perf_v2.log | head -8
exit $PERF
