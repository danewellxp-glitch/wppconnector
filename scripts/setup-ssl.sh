#!/bin/bash
# WPPConnect.io - SSL Setup with Let's Encrypt
# Run after docker compose is up (at least nginx)
set -e

DOMAIN=${1:-"seudominio.com.br"}
EMAIL=${2:-"admin@seudominio.com.br"}

echo "Setting up SSL for: $DOMAIN"
echo "Email: $EMAIL"

cd /opt/wppconnect.io

# Create certbot directories
mkdir -p certbot/conf certbot/www

# Get certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email

# Reload nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "SSL certificate installed for $DOMAIN"
echo "Certificate will auto-renew via certbot container."
