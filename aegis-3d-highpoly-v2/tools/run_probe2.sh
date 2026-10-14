#!/bin/bash
# Bisect run on 8741 with its own server lifecycle.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv3.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa" aegis-3d-highpoly-v2/tools/probe3.steps.cjs > /tmp/hp_probe3.log 2>&1
P=$?
kill $SRV 2>/dev/null
echo "PROBE3_EXIT=$P"
grep -oE '"eval": "[^"]*"|"value": [^,]*|"message": "[^"]*"' /tmp/hp_probe3.log | head -24
exit $P
