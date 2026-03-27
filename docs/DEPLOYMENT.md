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
  npx ts-node src/db/seed-whitelist.ts admin@gecko.hs-heilbronn.de

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

## Backup

```bash
docker compose -f docker-compose.prod.yml exec db \
  mysqldump -u root -p${DB_ROOT_PASSWORD} dsf_allowlist > backup_$(date +%Y%m%d).sql
```

## Health Check

```bash
curl https://allowlist.gecko.hs-heilbronn.de/health
```
