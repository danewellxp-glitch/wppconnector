#!/bin/bash
set -e

BACKUP_DIR="/opt/wppconnect.io/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Starting backup: $DATE"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker exec wpp-postgres pg_dump -U whatsapp whatsapp_db | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup Redis
echo "Backing up Redis..."
docker exec wpp-redis redis-cli SAVE > /dev/null 2>&1
docker cp wpp-redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Remove backups older than 7 days
echo "Cleaning old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete 2>/dev/null || true
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete 2>/dev/null || true

# Show backup sizes
echo ""
echo "Backup files:"
ls -lh "$BACKUP_DIR"/*$DATE* 2>/dev/null

echo ""
echo "Backup complete: $DATE"
