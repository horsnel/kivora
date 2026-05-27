#!/bin/bash
# Stop Kivora Voice Server
cd "$(dirname "$0")"

if [ -f logs/server.pid ]; then
  PID=$(cat logs/server.pid)
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping voice server (PID $PID)..."
    kill "$PID"
    sleep 2
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID"
    fi
    rm -f logs/server.pid
    echo "Server stopped."
  else
    echo "Server process not found (PID $PID). Cleaning up."
    rm -f logs/server.pid
  fi
else
  echo "No PID file found. Trying to kill by port..."
  pkill -f "uvicorn backend.main:app" 2>/dev/null && echo "Server stopped." || echo "No server running."
fi
