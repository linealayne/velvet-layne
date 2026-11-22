#!/usr/bin/env bash
# Rebuild and restart the local production server on :3210 (used for screenshots).
PID=$(netstat -ano | grep ":3210 " | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
npm run build >/tmp/vl-build.log 2>&1 || { tail -30 /tmp/vl-build.log; exit 1; }
(npx next start -p 3210 >/tmp/vl-serve.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3210 && break; sleep 0.5; done
echo "serving"
