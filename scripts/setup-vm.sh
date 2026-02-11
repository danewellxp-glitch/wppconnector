#!/bin/bash
# WPPConnect.io - VM Setup Script
# Run as root on a fresh Ubuntu 22.04 server
set -e

echo "========================================="
echo "  WPPConnect.io - VM Setup"
echo "========================================="

# Update system
echo "[1/6] Updating system..."
apt update && apt upgrade -y

# Install Docker
echo "[2/6] Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose plugin
echo "[3/6] Installing Docker Compose..."
apt install -y docker-compose-plugin

# Install utilities
echo "[4/6] Installing utilities..."
apt install -y git curl wget htop nano ufw

# Configure firewall
echo "[5/6] Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# Clone project
echo "[6/6] Cloning project..."
mkdir -p /opt
cd /opt
# git clone <your-repo-url> wppconnect.io
# cd wppconnect.io
# cp .env.production.example .env

echo ""
echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Clone your repo to /opt/wppconnect.io"
echo "  2. Copy .env.production.example to .env and configure"
echo "  3. Setup SSL: see scripts/setup-ssl.sh"
echo "  4. Run: cd /opt/wppconnect.io && docker compose -f docker-compose.prod.yml up -d"
echo "  5. Setup backup cron:"
echo "     crontab -e"
echo "     0 2 * * * /opt/wppconnect.io/scripts/backup.sh >> /var/log/wpp-backup.log 2>&1"
echo ""
