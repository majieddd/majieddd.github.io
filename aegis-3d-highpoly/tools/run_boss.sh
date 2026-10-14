#!/bin/bash
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
OUT="C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io/aegis-3d-highpoly/qa"
node aegis-3d-highpoly/tools/headless.js http://127.0.0.1:8741/aegis-3d-highpoly/index.html "$OUT" aegis-3d-highpoly/tools/boss.steps.cjs > /tmp/hp_vis4.log 2>&1
VIS=$?
kill $SRV 2>/dev/null
echo "VIS_EXIT=$VIS"
ls -la "$OUT" | tail -4
exit $VIS
