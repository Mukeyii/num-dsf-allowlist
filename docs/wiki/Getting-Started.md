# Getting Started

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- Git

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/Mukeyii/num-dsf-allowlist.git
cd num-dsf-allowlist
cp .env.example .env
```

### 2. Generate JWT keys

```bash
bash scripts/generate-keys.sh
```

### 3. Start all services

```bash
docker compose up --build -d
```

This starts 6 containers: nginx (port 80), frontend (Vite), backend (Express), MySQL, Redis, Mailhog.

### 4. Seed admin email

```bash
docker compose exec backend npx ts-node src/db/seed-whitelist.ts your@email.com
```

### 5. (Optional) Seed test data

```bash
docker compose exec backend npx ts-node src/db/seed-testdata.ts
```

Creates 30 fictional organizations with contacts, endpoints, certificates, and memberships.

### 6. Open the app

| Service | URL |
|---------|-----|
| App | http://localhost |
| Mailhog | http://localhost:8025 |

### 7. Log in

1. Enter your email at http://localhost
2. Open Mailhog (http://localhost:8025) to get the 6-digit OTP code
3. First login: scan QR code with an authenticator app (Google Authenticator, Authy)
4. Enter the 6-digit TOTP code
5. Save your backup codes

### Admin Access

To review and approve requests, add your email to `.env`:

```
IMI_ADMIN_EMAILS=your@email.com
```

Then restart the backend: `docker compose restart backend`
