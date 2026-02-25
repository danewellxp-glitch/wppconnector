#!/bin/bash

# Configuration
FRONTEND_DIR="./frontend"
BACKEND_DIR="./backend"
LOG_DIR="./logs"

# Ensure log directory exists
mkdir -p $LOG_DIR

echo "====================================="
echo "  Starting WppConnector in PRODUCTION"
echo "====================================="

echo "1. Building and Starting Backend..."
cd $BACKEND_DIR
npm run build
# Start backend in production mode using nohup and redirect output to logs
nohup npm run start:prod > ../$LOG_DIR/backend_prod.log 2>&1 &
BACKEND_PID=$!
echo "   Backend running on PID: $BACKEND_PID. Logs at $LOG_DIR/backend_prod.log"
cd ..

echo "2. Building and Starting Frontend..."
cd $FRONTEND_DIR
npm run build
# Start frontend production server using nohup and redirect output to logs
nohup npm run start > ../$LOG_DIR/frontend_prod.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend running on PID: $FRONTEND_PID. Logs at $LOG_DIR/frontend_prod.log"
cd ..

echo "====================================="
echo "  All services started successfully."
echo "  - Backend PID: $BACKEND_PID"
echo "  - Frontend PID: $FRONTEND_PID"
echo "  To stop the services later, run:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo "====================================="

# Optionally save PIDs to a file for easy stopping later
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid
