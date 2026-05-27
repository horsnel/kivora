#!/bin/bash
# Start Kivora Voice Server — auto-installs missing packages
cd "$(dirname "$0")"
mkdir -p data logs

# ── Auto-setup virtual environment if needed ──
if [ ! -d ".venv" ]; then
    echo "No virtual environment found. Running auto-setup..."
    bash setup-vps.sh
    exit $?
fi

source .venv/bin/activate

# ── Auto-install critical packages if missing ──
MISSING=""
for pkg in fastapi uvicorn faster_whisper edge_tts; do
    python3 -c "import $pkg" 2>/dev/null || MISSING="$MISSING $pkg"
done

if [ -n "$MISSING" ]; then
    echo "Installing missing packages:$MISSING"
    pip install $MISSING python-multipart python-dotenv httpx > /dev/null 2>&1
fi

# ── Stop existing server ──
if [ -f logs/server.pid ]; then
    OLD_PID=$(cat logs/server.pid)
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping existing server (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 2
    fi
    rm -f logs/server.pid
fi

# ── Start server ──
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
