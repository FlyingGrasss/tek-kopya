#!/bin/bash
set -e
cd /app
if [ -n "$SEED_IF_EMPTY" ]; then
  ./node_modules/.bin/tsx server/seed.ts --if-empty || true
fi
./node_modules/.bin/tsx server/index.ts &
API_PID=$!
trap 'kill -TERM $API_PID 2>/dev/null; exit 0' TERM INT
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${API_PORT:-4700}/api/health" 2>/dev/null; then
    break
  fi
  sleep 1
done
./node_modules/.bin/next start -p 3000 &
WEB_PID=$!
wait -n $API_PID $WEB_PID
