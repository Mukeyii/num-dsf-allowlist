# Deployment Guide

## Prerequisites

- Docker Desktop (or Docker Engine + Compose Plugin)
- SSL certificates in `certs/` (server.crt, server.key)
- `.env.prod` filled (from `.env.prod.example`)

## First Production Deploy

```bash
# 1. Clone
git clone <repo-url>
cd dsf-allowlist

# 2. Environment
cp .env.prod.example .env.prod
# Fill .env.prod with real secrets

# 3. Generate keys
bash scripts/generate-keys.sh

# 4. Seed admin email
docker compose -f docker-compose.prod.yml run --rm backend \
  npx ts-node src/db/seed-whitelist.ts admin@imi.uni-muenster.de

# 5. Start
docker compose -f docker-compose.prod.yml up -d --build

# 6. Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

## Update Process

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build --no-deps backend frontend
```

## Backups

### Automated Backup Script

```bash
# Run manually
bash scripts/backup-db.sh

# Run with custom backup directory
bash scripts/backup-db.sh /mnt/backups

# Schedule via cron (daily at 2 AM)
0 2 * * * cd /path/to/dsf-allowlist && bash scripts/backup-db.sh >> /var/log/dsf-backup.log 2>&1
```

The script:
- Creates a gzip-compressed MySQL dump with `--single-transaction` (no locks)
- Retains the last 30 backups, older ones are automatically deleted
- Verifies backup integrity (non-empty file check)
- Uses `docker compose exec` to access the DB container

### Manual Restore

```bash
gunzip < backups/dsf_allowlist_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} dsf_allowlist
```

## Health Check

```bash
curl https://allowlist.imi.uni-muenster.de/health
```
