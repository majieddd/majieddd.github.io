#!/bin/bash
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv4.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly-v2/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly-v2/index.html "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly-v2/qa" aegis-3d-highpoly-v2/tools/probe4.steps.cjs 2>&1 | tee /tmp/hp_probe3b.log
kill $SRV 2>/dev/null
exit 0
