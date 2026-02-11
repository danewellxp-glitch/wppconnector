#!/bin/bash
set -e

echo "========================================="
echo "  WPPConnect.io - Deploy Script"
echo "========================================="

cd /opt/wppconnect.io

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin main

# Build containers
echo "[2/5] Building containers..."
docker compose -f docker-compose.prod.yml build --no-cache

# Stop old containers
echo "[3/5] Stopping old containers..."
docker compose -f docker-compose.prod.yml down

# Start new containers
echo "[4/5] Starting new containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for backend to be ready
echo "[5/5] Waiting for services..."
sleep 10

# Health check
HEALTH=$(curl -s http://localhost:4000/api/health 2>/dev/null || echo '{"status":"error"}')
echo "Health check: $HEALTH"

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "========================================="
echo ""
docker compose -f docker-compose.prod.yml ps
