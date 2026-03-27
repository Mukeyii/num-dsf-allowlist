# Masterprompt 01 – Fundament

> Phase 1 von 8. Lies zuerst CLAUDE.md vollständig.
> Ziel dieser Phase: lauffähige Docker-Umgebung mit allen Services,
> vollständiges MySQL-Schema, Redis-Verbindung, .env.example.

---

## Kontext

Du baust das **DSF Allow List Management Portal** – einen Rewrite
eines medizinischen Forschungsnetz-Admin-Tools. Alle Details sind in
CLAUDE.md dokumentiert. Halte dich exakt an den dort definierten Stack
und die Sicherheitsregeln.

---

## Aufgabe

Erstelle die vollständige Projektgrundstruktur und bringe alle
Docker-Services zum Laufen. Am Ende dieser Phase muss `docker-compose up`
fehlerfrei starten und alle Services müssen miteinander kommunizieren können.

---

## Schritt 1 – Verzeichnisstruktur anlegen

Erstelle exakt diese Verzeichnisstruktur (leer, mit .gitkeep wo nötig):

```
dsf-allowlist/
├── CLAUDE.md
├── REQUIREMENTS.md
├── SPEC.md
├── .env.example
├── .env                    ← aus .env.example kopieren, gitignored
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── frontend/
│   ├── Dockerfile
│   └── .gitkeep
├── backend/
│   ├── Dockerfile
│   └── .gitkeep
├── mail/
│   └── Dockerfile
└── db/
    └── migrations/
        └── .gitkeep
```

---

## Schritt 2 – .gitignore

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

---

## Schritt 3 – .env.example

Erstelle `.env.example` mit allen Variablen aus CLAUDE.md (Abschnitt
"Umgebungsvariablen"). Kopiere sie als `.env` und fülle Development-Defaults ein:

```bash
# .env (dev defaults)
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=db
DB_PORT=3306
DB_NAME=dsf_allowlist
DB_USER=dsf
DB_PASSWORD=dev_password_change_me

REDIS_URL=redis://redis:6379

# JWT RS256 – für dev temporär generieren:
# openssl genrsa -out private.pem 2048
# openssl rsa -in private.pem -pubout -out public.pem
# dann base64 -w 0 private.pem und base64 -w 0 public.pem
JWT_PRIVATE_KEY_BASE64=GENERATE_ME
JWT_PUBLIC_KEY_BASE64=GENERATE_ME
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

TOTP_ENCRYPTION_KEY=GENERATE_32_BYTE_HEX

SMTP_HOST=mail
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM=noreply@dsf-allowlist.local

DSF_ENVIRONMENT=TEST
DSF_ENV_COLOR=#63C7A6

RATE_LIMIT_OTP_MAX=5
RATE_LIMIT_OTP_WINDOW_MS=900000
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_WINDOW_MS=60000
```

Füge außerdem ein Skript `scripts/generate-keys.sh` hinzu, das die
RS256-Keys und den TOTP-Key automatisch generiert und in `.env` einträgt:

```bash
#!/bin/bash
# Generiert RS256 JWT Keys und TOTP Encryption Key
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

---

## Schritt 4 – docker-compose.yml (dev)

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
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:
```

---

## Schritt 5 – docker-compose.prod.yml

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
    # Kein Port-Mapping in Prod – nur intern erreichbar

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    restart: always
    # Kein Port-Mapping in Prod

volumes:
  mysql-data:
  redis-data:
```

---

## Schritt 6 – nginx/nginx.conf

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

    # Auth-Routen: streng Rate-Limited
    location /auth/ {
      limit_req zone=auth burst=3 nodelay;
      limit_req_status 429;
      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # API-Routen
    location /api/ {
      limit_req zone=api burst=20 nodelay;
      limit_req_status 429;
      proxy_pass http://backend:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend (dev: proxy zu Vite, prod: static files)
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

---

## Schritt 7 – nginx/Dockerfile

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
```

---

## Schritt 8 – MySQL-Schema (db/migrations/001_initial_schema.sql)

Erstelle das vollständige Schema exakt nach dem Datenmodell aus CLAUDE.md.
Zusätzliche Anforderungen:

```sql
-- Datei: db/migrations/001_initial_schema.sql

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `dsf_allowlist`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `dsf_allowlist`;

-- UUID-Funktion für MySQL 8
-- Alle UUIDs als CHAR(36) speichern

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
  `identifier`  VARCHAR(255) NOT NULL,
  `instance_id` CHAR(36)     NOT NULL,
  `name`        VARCHAR(255) NOT NULL,
  `active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `email`       VARCHAR(255) NOT NULL,
  `address_line` VARCHAR(255),
  `postal_code` VARCHAR(20),
  `city`        VARCHAR(100),
  `country_code` CHAR(2),
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  `id`          CHAR(36)    NOT NULL DEFAULT (UUID()),
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
  -- Kein FOREIGN KEY auf instance_id – Logs bleiben auch nach Instanz-Löschung erhalten
) ENGINE=InnoDB;

-- Seed: erste Admin-E-Mail in Whitelist (aus Env-Variable nicht möglich in SQL,
-- wird per Backend-Seed-Script gesetzt)
-- INSERT INTO email_whitelist (email, created_by) VALUES ('admin@example.com', 'seed');
```

---

## Schritt 9 – Backend-Grundgerüst (Node.js + TypeScript)

Erstelle `backend/package.json`:

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

Erstelle `backend/tsconfig.json`:

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

Erstelle `backend/src/index.ts` – Express-Bootstrap:

```typescript
/**
 * index.ts – Express App Bootstrap
 * Startet den Server, registriert Middleware und alle Routes
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

Erstelle `backend/src/db/connection.ts`:

```typescript
/**
 * connection.ts – MySQL-Verbindung via Knex
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

Erstelle `backend/src/services/redis.service.ts`:

```typescript
/**
 * redis.service.ts – Redis-Verbindung und Basisfunktionen
 * Keys: otp:{email}, refresh:{tokenHash}, ratelimit:{ip}
 */
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis error:', err));

export async function testRedisConnection(): Promise<void> {
  await redis.ping();
}

// OTP
export async function setOtp(email: string, hashedCode: string, ttlSeconds = 600): Promise<void> {
  await redis.setex(`otp:${email}`, ttlSeconds, hashedCode);
}

export async function getOtp(email: string): Promise<string | null> {
  return redis.get(`otp:${email}`);
}

export async function deleteOtp(email: string): Promise<void> {
  await redis.del(`otp:${email}`);
}

// Refresh Token
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

---

## Schritt 10 – Backend/Dockerfile

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

---

## Schritt 11 – Frontend-Placeholder

Erstelle `frontend/Dockerfile` als Placeholder für Phase 4:

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

Erstelle `frontend/package.json` minimal:

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

Erstelle `frontend/index.html` und `frontend/src/main.tsx` als minimale Placeholder,
die nur eine "Loading..." Seite zeigen – wird in Phase 4 vollständig ersetzt.

---

## Schritt 12 – Mailhog Dockerfile

```dockerfile
# mail/Dockerfile
FROM mailhog/mailhog:latest
EXPOSE 1025 8025
```

---

## Schritt 13 – Verifizierung

Nach dem Erstellen aller Dateien:

```bash
# 1. Keys generieren
bash scripts/generate-keys.sh

# 2. Services starten
docker-compose up --build

# 3. Prüfen:
curl http://localhost:3000/health
# → {"status":"ok","environment":"TEST"}

curl http://localhost:8025
# → Mailhog Web-UI

# MySQL direkt testen
docker-compose exec db mysql -u dsf -pdev_password_change_me dsf_allowlist -e "SHOW TABLES;"
# → alle 10 Tabellen müssen erscheinen

# Redis testen
docker-compose exec redis redis-cli ping
# → PONG
```

---

## Abnahmekriterien Phase 1

- [ ] `docker-compose up --build` startet fehlerfrei durch
- [ ] `GET /health` antwortet mit `{"status":"ok"}`
- [ ] MySQL: alle 10 Tabellen vorhanden
- [ ] Redis: antwortet auf PING
- [ ] Mailhog Web-UI erreichbar auf Port 8025
- [ ] `.env` ist in `.gitignore` gelistet
- [ ] `scripts/generate-keys.sh` läuft fehlerfrei
- [ ] Kein Secret ist hardcoded in irgendeiner Quelldatei

---

> Wenn Phase 1 abgeschlossen und verifiziert ist:
> Weiter mit **Masterprompt 02 – Auth-Backend**
> (OTP-Flow, TOTP-Setup, JWT, Rate Limiting, Audit Logging)
