#!/bin/bash

echo "Stopping WppConnector PRODUCTION services..."

if [ -f .backend.pid ]; then
  BACKEND_PID=$(cat .backend.pid)
  echo "Stopping Backend (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null || echo "Process $BACKEND_PID not running."
  rm .backend.pid
fi

if [ -f .frontend.pid ]; then
  FRONTEND_PID=$(cat .frontend.pid)
  echo "Stopping Frontend (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID 2>/dev/null || echo "Process $FRONTEND_PID not running."
  rm .frontend.pid
fi

echo "Stopped."
