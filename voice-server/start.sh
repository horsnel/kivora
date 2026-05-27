#!/bin/bash
# Start Kivora Voice Server
cd "$(dirname "$0")"
mkdir -p data logs

echo "Starting Kivora Voice Server on port 3900..."
nohup python3 -m uvicorn backend.main:app \
  --host 0.0.0.0 \
  --port 3900 \
  --log-level info \
  > logs/server.log 2>&1 &

SERVER_PID=$!
echo $SERVER_PID > logs/server.pid
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3900/health > /dev/null 2>&1; then
    echo "Voice server is ready!"
    echo "  Health:  http://127.0.0.1:3900/health"
    echo "  Docs:    http://127.0.0.1:3900/docs"
    echo "  TTS:     POST http://127.0.0.1:3900/v1/audio/speech"
    echo "  STT:     POST http://127.0.0.1:3900/v1/audio/transcriptions"
    exit 0
  fi
  sleep 1
done

echo "Server failed to start. Check logs/server.log"
exit 1
