#!/usr/bin/env bash
# backup-db.sh – Automated MySQL backup for DSF Allow List
# Usage: bash scripts/backup-db.sh [backup_dir]
# Can be run via cron: 0 2 * * * cd /path/to/dsf-allowlist && bash scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETENTION_COUNT=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="dsf_allowlist_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup to ${BACKUP_DIR}/${FILENAME}..."

# Dump database via Docker exec
docker compose exec -T db mysqldump \
  -u root \
  -p"${DB_ROOT_PASSWORD:-root_dev_password}" \
  --single-transaction \
  --routines \
  --triggers \
  dsf_allowlist | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verify backup is not empty
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
  echo "[backup] ERROR: Backup file is empty!" >&2
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[backup] Backup complete: ${FILENAME} (${SIZE})"

# Retention: keep only the last N backups
BACKUPS=($(ls -1t "${BACKUP_DIR}"/dsf_allowlist_*.sql.gz 2>/dev/null))
if [ ${#BACKUPS[@]} -gt $RETENTION_COUNT ]; then
  for OLD in "${BACKUPS[@]:$RETENTION_COUNT}"; do
    echo "[backup] Removing old backup: $(basename "$OLD")"
    rm -f "$OLD"
  done
fi

echo "[backup] Done. ${#BACKUPS[@]} backups in ${BACKUP_DIR} (max ${RETENTION_COUNT})"
