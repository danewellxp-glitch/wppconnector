#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting WPPConnector Services...${NC}"

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

# Kill existing processes on ports 4000 (backend) and 3100 (frontend)
kill_port 4000
kill_port 3100

# Start Backend
echo -e "${YELLOW}Starting Backend on port 4000...${NC}"
cd backend
nohup npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID $BACKEND_PID. Logs: backend.log${NC}"
cd ..

# Start Frontend
echo -e "${YELLOW}Starting Frontend on port 3100...${NC}"
cd frontend
nohup npm run dev -- -p 3100 > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started with PID $FRONTEND_PID. Logs: frontend.log${NC}"
cd ..

echo -e "${GREEN}Services started!${NC}"
echo -e "Backend: http://localhost:4000"
echo -e "Frontend: http://localhost:3100"
