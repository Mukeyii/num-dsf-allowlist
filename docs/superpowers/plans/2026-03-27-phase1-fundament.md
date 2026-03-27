# Phase 1 – Fundament: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a fully working Docker-based development environment with MySQL schema, Redis, nginx reverse proxy, backend Express skeleton, frontend placeholder, and Mailhog — all communicating and verifiable via `docker-compose up`.

**Architecture:** Six Docker services (nginx, frontend, backend, db, redis, mail) orchestrated via docker-compose. Backend is Node.js/Express/TypeScript with Knex (MySQL) and ioredis. Frontend is a Vite/React placeholder. nginx handles reverse proxying and rate limiting. All secrets come from `.env`.

**Tech Stack:** Docker Compose, Node.js 20, Express 4, TypeScript 5, Knex, MySQL 8, Redis 7, nginx, Vite 5, React 18, Mailhog

---

## File Structure

### New files to create:

| File | Responsibility |
|------|---------------|
| `.gitignore` | Exclude secrets, build artifacts, data volumes |
| `.env.example` | Template for all environment variables |
| `.env` | Local dev copy (gitignored) |
| `scripts/generate-keys.sh` | Generate RS256 JWT keys + TOTP encryption key |
| `docker-compose.yml` | Dev orchestration (6 services) |
| `docker-compose.prod.yml` | Production orchestration (no dev ports) |
| `nginx/nginx.conf` | Reverse proxy, rate limiting, security headers |
| `nginx/Dockerfile` | nginx image with custom config |
| `db/migrations/001_initial_schema.sql` | Full MySQL schema (11 tables) |
| `backend/package.json` | Backend dependencies |
| `backend/tsconfig.json` | TypeScript compiler config |
| `backend/Dockerfile` | Multi-stage build (dev/prod) |
| `backend/src/index.ts` | Express app bootstrap |
| `backend/src/db/connection.ts` | Knex MySQL connection + test function |
| `backend/src/services/redis.service.ts` | Redis connection + OTP/refresh helpers |
| `backend/src/routes/auth.routes.ts` | Auth route placeholder |
| `backend/src/routes/instances.routes.ts` | Instances route placeholder |
| `frontend/package.json` | Frontend dependencies |
| `frontend/index.html` | Vite entry HTML |
| `frontend/src/main.tsx` | Minimal React mount |
| `frontend/vite.config.ts` | Vite config with React plugin |
| `frontend/tsconfig.json` | Frontend TS config |
| `frontend/Dockerfile` | Multi-stage build (dev/prod) |
| `mail/Dockerfile` | Mailhog image |

---

### Task 1: Project Scaffolding — .gitignore, .env, Key Generation

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env`
- Create: `scripts/generate-keys.sh`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
.env
node_modules/
dist/
build/
*.log
.DS_Store
coverage/
.nyc_output/
redis-data/
mysql-data/
certs/server.*
certs/ca.*
```

- [ ] **Step 2: Create `.env.example` with all environment variables**

```bash
# App
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=db
DB_PORT=3306
DB_NAME=dsf_allowlist
DB_USER=dsf
DB_PASSWORD=change_me
DB_ROOT_PASSWORD=root_dev_password

# Redis
REDIS_URL=redis://redis:6379

# JWT RS256 (base64-encoded PEM keys)
JWT_PRIVATE_KEY_BASE64=GENERATE_ME
JWT_PUBLIC_KEY_BASE64=GENERATE_ME
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# TOTP Encryption
TOTP_ENCRYPTION_KEY=GENERATE_32_BYTE_HEX

# Mail (Mailhog in dev)
SMTP_HOST=mail
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM=noreply@dsf-allowlist.local

# DSF Environment
DSF_ENVIRONMENT=TEST
DSF_ENV_COLOR=#63C7A6

# Rate Limiting
RATE_LIMIT_OTP_MAX=5
RATE_LIMIT_OTP_WINDOW_MS=900000
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_WINDOW_MS=60000
```

- [ ] **Step 3: Copy `.env.example` to `.env` with dev defaults**

```bash
cp .env.example .env
```

Then edit `.env` to set:
- `DB_PASSWORD=dev_password_change_me`
- `DB_ROOT_PASSWORD=root_dev_password`

- [ ] **Step 4: Create `scripts/generate-keys.sh`**

```bash
#!/bin/bash
# Generates RS256 JWT keys and TOTP encryption key, writes them to .env
set -e

echo "Generating RS256 key pair..."
openssl genrsa -out /tmp/jwt_private.pem 2048 2>/dev/null
openssl rsa -in /tmp/jwt_private.pem -pubout -out /tmp/jwt_public.pem 2>/dev/null

PRIVATE_B64=$(base64 -w 0 /tmp/jwt_private.pem)
PUBLIC_B64=$(base64 -w 0 /tmp/jwt_public.pem)
TOTP_KEY=$(openssl rand -hex 32)

sed -i "s|JWT_PRIVATE_KEY_BASE64=.*|JWT_PRIVATE_KEY_BASE64=$PRIVATE_B64|" .env
sed -i "s|JWT_PUBLIC_KEY_BASE64=.*|JWT_PUBLIC_KEY_BASE64=$PUBLIC_B64|" .env
sed -i "s|TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$TOTP_KEY|" .env

rm /tmp/jwt_private.pem /tmp/jwt_public.pem
echo "Done. Keys written to .env"
```

- [ ] **Step 5: Make the script executable and verify it runs**

Run: `chmod +x scripts/generate-keys.sh && bash scripts/generate-keys.sh`
Expected: "Done. Keys written to .env" — and `.env` now has real base64 values for JWT keys and a 64-char hex TOTP key.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example scripts/generate-keys.sh
git commit -m "feat: add project scaffolding — .gitignore, .env.example, key generation script"
```

---

### Task 2: nginx — Config and Dockerfile

**Files:**
- Create: `nginx/nginx.conf`
- Create: `nginx/Dockerfile`

- [ ] **Step 1: Create `nginx/nginx.conf`**

```nginx
events {
  worker_connections 1024;
}

http {
  # Security Headers
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self';" always;

  # Rate Limiting Zones
  limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
  limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

  # Logging
  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent"';
  access_log /var/log/nginx/access.log main;

  server {
    listen 80;
    server_name _;

    # Auth routes: strict rate limiting
    location /auth/ {
      limit_req zone=auth burst=3 nodelay;
      limit_req_status 429;
      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # API routes
    location /api/ {
      limit_req zone=api burst=20 nodelay;
      limit_req_status 429;
      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend (dev: proxy to Vite, prod: static files)
    location / {
      proxy_pass http://frontend:5173;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
    }
  }
}
```

- [ ] **Step 2: Create `nginx/Dockerfile`**

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
```

- [ ] **Step 3: Commit**

```bash
git add nginx/
git commit -m "feat: add nginx reverse proxy with rate limiting and security headers"
```

---

### Task 3: MySQL Schema

**Files:**
- Create: `db/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create `db/migrations/001_initial_schema.sql`**

```sql
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `dsf_allowlist`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `dsf_allowlist`;

CREATE TABLE `email_whitelist` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `email`       VARCHAR(255) NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`  VARCHAR(255),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB;

CREATE TABLE `users` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `email`        VARCHAR(255) NOT NULL,
  `totp_secret`  VARCHAR(500),
  `totp_enabled` TINYINT(1)   NOT NULL DEFAULT 0,
  `backup_codes` JSON,
  `last_login`   DATETIME,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB;

CREATE TABLE `refresh_tokens` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)     NOT NULL,
  `token_hash` VARCHAR(64)  NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` DATETIME,
  PRIMARY KEY (`id`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_hash` (`token_hash`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `instances` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)     NOT NULL,
  `label`      VARCHAR(255) NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inst_user` (`user_id`),
  CONSTRAINT `fk_inst_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `organizations` (
  `identifier`   VARCHAR(255) NOT NULL,
  `instance_id`  CHAR(36)     NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `email`        VARCHAR(255) NOT NULL,
  `address_line` VARCHAR(255),
  `postal_code`  VARCHAR(20),
  `city`         VARCHAR(100),
  `country_code` CHAR(2),
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`),
  UNIQUE KEY `uq_org_instance` (`instance_id`),
  CONSTRAINT `fk_org_inst` FOREIGN KEY (`instance_id`) REFERENCES `instances` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `contacts` (
  `id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `organization_id` VARCHAR(255) NOT NULL,
  `types`           JSON         NOT NULL,
  `name`            VARCHAR(255),
  `email`           VARCHAR(255) NOT NULL,
  `email_validated` TINYINT(1)   NOT NULL DEFAULT 0,
  `phone`           VARCHAR(50),
  `address_line`    VARCHAR(255),
  `city`            VARCHAR(100),
  `postal_code`     VARCHAR(20),
  `country_code`    CHAR(2),
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ct_org` (`organization_id`),
  CONSTRAINT `fk_ct_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`identifier`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `endpoints` (
  `identifier`      VARCHAR(255) NOT NULL,
  `organization_id` VARCHAR(255) NOT NULL,
  `name`            VARCHAR(255),
  `address`         VARCHAR(500) NOT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`),
  KEY `idx_ep_org` (`organization_id`),
  CONSTRAINT `fk_ep_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`identifier`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `endpoint_ips` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `endpoint_id` VARCHAR(255) NOT NULL,
  `ip`          VARCHAR(45)  NOT NULL,
  `is_fhir`     TINYINT(1)   NOT NULL DEFAULT 0,
  `is_bpe`      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_eip_ep` (`endpoint_id`),
  CONSTRAINT `fk_eip_ep` FOREIGN KEY (`endpoint_id`) REFERENCES `endpoints` (`identifier`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `certificates` (
  `id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `organization_id` VARCHAR(255) NOT NULL,
  `pem`             TEXT         NOT NULL,
  `subject`         VARCHAR(255),
  `thumbprint`      VARCHAR(64),
  `valid_until`     DATE,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cert_org` (`organization_id`),
  CONSTRAINT `fk_cert_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`identifier`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `memberships` (
  `id`                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  `organization_id`     VARCHAR(255) NOT NULL,
  `parent_organization` VARCHAR(255) NOT NULL,
  `endpoint_id`         VARCHAR(255) NOT NULL,
  `roles`               JSON         NOT NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ms_org` (`organization_id`),
  KEY `idx_ms_ep` (`endpoint_id`),
  CONSTRAINT `fk_ms_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`identifier`) ON DELETE CASCADE,
  CONSTRAINT `fk_ms_ep`  FOREIGN KEY (`endpoint_id`) REFERENCES `endpoints` (`identifier`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `approval_requests` (
  `id`            CHAR(36)  NOT NULL DEFAULT (UUID()),
  `instance_id`   CHAR(36)  NOT NULL,
  `status`        ENUM('DRAFT','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `created_at`    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at`  DATETIME,
  `resolved_at`   DATETIME,
  `resolved_by`   VARCHAR(255),
  `comment`       TEXT,
  `snapshot_json` JSON,
  PRIMARY KEY (`id`),
  KEY `idx_ar_inst` (`instance_id`),
  KEY `idx_ar_status` (`status`),
  CONSTRAINT `fk_ar_inst` FOREIGN KEY (`instance_id`) REFERENCES `instances` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `audit_logs` (
  `id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `timestamp`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_email`    VARCHAR(255),
  `instance_id`   CHAR(36),
  `resource_type` ENUM('ORGANIZATION','CONTACT','ENDPOINT','CERTIFICATE','MEMBERSHIP','AUTH','APPROVAL') NOT NULL,
  `resource_id`   VARCHAR(255),
  `operation`     ENUM('CREATE','UPDATE','DELETE','APPROVE','REJECT','LOGIN','LOGOUT','OTP_REQUEST','OTP_VERIFY','TOTP_SETUP','TOTP_VERIFY','FAILED_LOGIN') NOT NULL,
  `diff_json`     JSON,
  `ip_address`    VARCHAR(45),
  PRIMARY KEY (`id`),
  KEY `idx_al_time` (`timestamp`),
  KEY `idx_al_user` (`user_email`),
  KEY `idx_al_inst` (`instance_id`),
  KEY `idx_al_res` (`resource_type`, `resource_id`)
) ENGINE=InnoDB;
```

Note: `audit_logs.instance_id` intentionally has NO foreign key — logs must survive instance deletion.

- [ ] **Step 2: Commit**

```bash
git add db/
git commit -m "feat: add MySQL schema with all 12 tables for DSF allowlist"
```

---

### Task 4: Backend Project Setup — package.json, tsconfig, Dockerfile

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "dsf-allowlist-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "node -r ts-node/register src/db/migrate.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "rate-limit-redis": "^4.2.0",
    "ioredis": "^5.3.2",
    "mysql2": "^3.6.5",
    "knex": "^3.1.0",
    "jsonwebtoken": "^9.0.2",
    "speakeasy": "^2.0.0",
    "qrcode": "^1.5.3",
    "nodemailer": "^6.9.8",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "uuid": "^9.0.1",
    "exceljs": "^4.4.0",
    "node-forge": "^1.3.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/speakeasy": "^2.0.10",
    "@types/nodemailer": "^6.4.14",
    "@types/bcrypt": "^5.0.2",
    "@types/qrcode": "^1.5.5",
    "@types/uuid": "^9.0.7",
    "@types/node-forge": "^1.3.10",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/Dockerfile
git commit -m "feat: add backend project config — package.json, tsconfig, Dockerfile"
```

---

### Task 5: Backend DB Connection Module

**Files:**
- Create: `backend/src/db/connection.ts`

- [ ] **Step 1: Create `backend/src/db/connection.ts`**

```typescript
/**
 * connection.ts – MySQL connection via Knex
 * Depends on: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD env vars
 */
import knex from 'knex';

export const db = knex({
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME     || 'dsf_allowlist',
    user:     process.env.DB_USER     || 'dsf',
    password: process.env.DB_PASSWORD || '',
    charset:  'utf8mb4',
  },
  pool: { min: 2, max: 10 },
});

export async function testDbConnection(): Promise<void> {
  await db.raw('SELECT 1');
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/connection.ts
git commit -m "feat: add Knex MySQL connection module"
```

---

### Task 6: Backend Redis Service Module

**Files:**
- Create: `backend/src/services/redis.service.ts`

- [ ] **Step 1: Create `backend/src/services/redis.service.ts`**

```typescript
/**
 * redis.service.ts – Redis connection and base functions
 * Key prefixes: otp:{email}, refresh:{tokenHash}, ratelimit:{ip}
 * Depends on: REDIS_URL env var
 */
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis error:', err));

export async function testRedisConnection(): Promise<void> {
  await redis.ping();
}

// OTP helpers
export async function setOtp(email: string, hashedCode: string, ttlSeconds = 600): Promise<void> {
  await redis.setex(`otp:${email}`, ttlSeconds, hashedCode);
}

export async function getOtp(email: string): Promise<string | null> {
  return redis.get(`otp:${email}`);
}

export async function deleteOtp(email: string): Promise<void> {
  await redis.del(`otp:${email}`);
}

// Refresh Token helpers
export async function setRefreshToken(tokenHash: string, userId: string, ttlSeconds: number): Promise<void> {
  await redis.setex(`refresh:${tokenHash}`, ttlSeconds, userId);
}

export async function getRefreshToken(tokenHash: string): Promise<string | null> {
  return redis.get(`refresh:${tokenHash}`);
}

export async function deleteRefreshToken(tokenHash: string): Promise<void> {
  await redis.del(`refresh:${tokenHash}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/redis.service.ts
git commit -m "feat: add Redis service with OTP and refresh token helpers"
```

---

### Task 7: Backend Express Bootstrap + Placeholder Routes

**Files:**
- Create: `backend/src/index.ts`
- Create: `backend/src/routes/auth.routes.ts`
- Create: `backend/src/routes/instances.routes.ts`

- [ ] **Step 1: Create `backend/src/routes/auth.routes.ts`**

```typescript
/**
 * auth.routes.ts – Auth route placeholders
 * Will be fully implemented in Phase 2 (Auth-Backend)
 */
import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/request-otp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/verify-otp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/verify-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/setup-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/confirm-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/logout', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/refresh', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});
```

- [ ] **Step 2: Create `backend/src/routes/instances.routes.ts`**

```typescript
/**
 * instances.routes.ts – Instance route placeholders
 * Will be fully implemented in Phase 3 (Entity-API)
 */
import { Router } from 'express';

export const instancesRouter = Router();

instancesRouter.get('/', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});

instancesRouter.post('/', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});

instancesRouter.get('/:id', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});
```

- [ ] **Step 3: Create `backend/src/index.ts`**

```typescript
/**
 * index.ts – Express App Bootstrap
 * Starts the server, registers middleware and all routes
 * Depends on: dotenv, express, helmet, cors, db/connection, services/redis.service
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { instancesRouter } from './routes/instances.routes';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust nginx proxy
app.set('trust proxy', 1);

// Routes
app.use('/auth', authRouter);
app.use('/api/v1/instances', instancesRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.DSF_ENVIRONMENT || 'UNKNOWN' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Startup
async function start() {
  try {
    await testDbConnection();
    console.log('✓ MySQL connected');
    await testRedisConnection();
    console.log('✓ Redis connected');
    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT} [${process.env.DSF_ENVIRONMENT}]`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/
git commit -m "feat: add Express bootstrap with health check and placeholder routes"
```

---

### Task 8: Frontend Placeholder

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "dsf-allowlist-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.3",
    "@tanstack/react-query": "^5.17.15",
    "react-hook-form": "^7.49.3",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.4",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
```

- [ ] **Step 4: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DSF Allow List Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/src/main.tsx`**

```tsx
/**
 * main.tsx – Minimal React mount (placeholder for Phase 4)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', padding: '2rem', color: '#181c20' }}>
      <h1>DSF Allow List Management</h1>
      <p>Phase 1 – Fundament loaded. Frontend will be built in Phase 4.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: add frontend placeholder with Vite, React, and Dockerfile"
```

---

### Task 9: Mailhog Dockerfile

**Files:**
- Create: `mail/Dockerfile`

- [ ] **Step 1: Create `mail/Dockerfile`**

```dockerfile
# mail/Dockerfile – Mailhog for development email testing
FROM mailhog/mailhog:latest
EXPOSE 1025 8025
```

- [ ] **Step 2: Commit**

```bash
git add mail/
git commit -m "feat: add Mailhog Dockerfile for dev email testing"
```

---

### Task 10: Docker Compose Files

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.yml` (dev)**

```yaml
version: '3.9'

services:
  nginx:
    build: ./nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      target: dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost/api/v1
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      target: dev
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mysql:8.0
    platform: linux/amd64
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-root_dev_password}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./db/migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD:-root_dev_password}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  mail:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"
      - "8025:8025"
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:
```

- [ ] **Step 2: Create `docker-compose.prod.yml`**

```yaml
version: '3.9'

services:
  nginx:
    build: ./nginx
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - backend
    restart: always

  frontend:
    build:
      context: ./frontend
      target: prod
    restart: always

  backend:
    build:
      context: ./backend
      target: prod
    env_file: .env.prod
    depends_on:
      - db
      - redis
    restart: always

  db:
    image: mysql:8.0
    platform: linux/amd64
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    restart: always

volumes:
  mysql-data:
  redis-data:
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml
git commit -m "feat: add Docker Compose for dev and prod environments"
```

---

### Task 11: Full Stack Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Generate keys**

Run: `bash scripts/generate-keys.sh`
Expected: "Done. Keys written to .env"

- [ ] **Step 2: Build and start all services**

Run: `docker-compose up --build -d`
Expected: All 6 services start without errors. Wait for db and redis health checks to pass.

- [ ] **Step 3: Verify backend health endpoint**

Run: `curl http://localhost:3000/health`
Expected: `{"status":"ok","environment":"TEST"}`

- [ ] **Step 4: Verify MySQL schema — all 12 tables present**

Run: `docker-compose exec db mysql -u dsf -pdev_password_change_me dsf_allowlist -e "SHOW TABLES;"`
Expected output listing all 12 tables:
- `approval_requests`
- `audit_logs`
- `certificates`
- `contacts`
- `email_whitelist`
- `endpoint_ips`
- `endpoints`
- `instances`
- `memberships`
- `organizations`
- `refresh_tokens`
- `users`

- [ ] **Step 5: Verify Redis responds**

Run: `docker-compose exec redis redis-cli ping`
Expected: `PONG`

- [ ] **Step 6: Verify Mailhog Web UI is accessible**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8025`
Expected: `200`

- [ ] **Step 7: Verify frontend placeholder loads**

Run: `curl -s http://localhost:5173 | head -5`
Expected: HTML containing "DSF Allow List Management"

- [ ] **Step 8: Verify .env is gitignored**

Run: `git status --short .env`
Expected: No output (file is ignored) or `?? .env` should NOT appear if `.gitignore` is correct.
Actually run: `git check-ignore .env`
Expected: `.env`

- [ ] **Step 9: Verify no hardcoded secrets in source files**

Run: `grep -r "dev_password_change_me\|root_dev_password" --include="*.ts" --include="*.json" --include="*.yml" --include="*.sql" .`
Expected: No matches in source files (only in `.env` which is gitignored).

- [ ] **Step 10: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix: address verification issues from Phase 1 smoke test"
```

Only run this if fixes were needed. If all checks passed, skip this step.

---

## Acceptance Criteria (from spec)

- [ ] `docker-compose up --build` starts without errors
- [ ] `GET /health` responds with `{"status":"ok"}`
- [ ] MySQL: all 12 tables present (including `refresh_tokens`)
- [ ] Redis: responds to PING
- [ ] Mailhog Web UI reachable on port 8025
- [ ] `.env` is in `.gitignore`
- [ ] `scripts/generate-keys.sh` runs without errors
- [ ] No secrets hardcoded in any source file
