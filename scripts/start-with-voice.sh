#!/usr/bin/env bash
set -euo pipefail

source .voice-venv/bin/activate

python -m uvicorn voice_engine.app:app \
  --host 127.0.0.1 \
  --port 8100 &

VOICE_ENGINE_PID=$!

node server.js &
NODE_PID=$!

shutdown() {
  kill "$VOICE_ENGINE_PID" "$NODE_PID" 2>/dev/null || true
  wait "$VOICE_ENGINE_PID" "$NODE_PID" 2>/dev/null || true
}

trap shutdown SIGTERM SIGINT EXIT

wait -n "$VOICE_ENGINE_PID" "$NODE_PID"
