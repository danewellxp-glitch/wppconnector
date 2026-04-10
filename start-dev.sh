#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting WPPConnector DEV Services...${NC}"

# Check if Docker containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}Docker containers not running. Starting them...${NC}"
    docker-compose up -d
else
    echo -e "${GREEN}Docker containers are running.${NC}"
fi

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -t -i:$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $pid)...${NC}"
        kill -9 $pid
    fi
}

# Kill existing processes on ports 5723 (backend-dev) and 5724 (frontend-dev)
kill_port 5723
kill_port 5724

# Start Backend
echo -e "${YELLOW}Starting Backend on port 5723...${NC}"
cd backend
nohup npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID $BACKEND_PID. Logs: backend.log${NC}"
cd ..

# Start Frontend
echo -e "${YELLOW}Starting Frontend on port 5724...${NC}"
cd frontend
nohup npm run dev -- -p 5724 > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started with PID $FRONTEND_PID. Logs: frontend.log${NC}"
cd ..

echo -e "${GREEN}DEV services started!${NC}"
echo -e "Backend: http://192.168.10.156:5723"
echo -e "Frontend: http://192.168.10.156:5724"
echo -e "WAHA Dashboard: http://192.168.10.156:5722/dashboard"
echo -e "Postgres: 192.168.10.156:5720"
