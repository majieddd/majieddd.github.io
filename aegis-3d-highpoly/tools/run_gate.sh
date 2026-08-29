#!/bin/bash
# HIGHPOLY FINAL gate, rebuild, bundle refresh, em-dash sweep.
cd "C:/Users/Majied LaFleur/Documents/ClaudeWorkspace/majieddd.github.io"
python -m http.server 8741 --bind 127.0.0.1 > /tmp/hp_srv.log 2>&1 &
SRV=$!
sleep 2
node aegis-3d-highpoly/tools/gate.js http://127.0.0.1:8741 > /tmp/hp_gatef.log 2>&1
GATE=$?
kill $SRV 2>/dev/null
echo "GATE_EXIT=$GATE"
grep -E "ok|FAIL|GATE" /tmp/hp_gatef.log | tail -12
# Refresh the single-file build + narrative copy with the fixed bundle
cd aegis-3d-highpoly && node build.js > /tmp/hp_bld.log 2>&1 && cp cosmic-highpoly.html ../narrative/td_highpoly.html && echo "BUNDLE_REFRESHED=$(wc -c < cosmic-highpoly.html)"
exit $GATE
