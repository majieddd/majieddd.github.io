#!/bin/bash
# Minimal probe run.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv2.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa" aegis-3d-highpoly-v2/tools/probe.steps.cjs > /tmp/hp_probe.log 2>&1
P=$?
kill $SRV 2>/dev/null
echo "PROBE_EXIT=$P"
grep -oE '"value":"[^"]*"|"value": "[^"]*"|exceptionThrown[^,]*' /tmp/hp_probe.log | head -8
tail -c 900 /tmp/hp_probe.log
exit $P
