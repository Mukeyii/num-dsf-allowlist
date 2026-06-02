# Contributing

Thanks for working on the DSF Allow List Management Portal. This guide covers
local setup, the test suites, and the conventions the repository follows.

## Prerequisites

- Docker Desktop 24+
- Node.js 20 LTS (for running the frontend/backend test suites outside Docker)
- Git

## Local setup

```bash
git clone https://github.com/Mukeyii/num-dsf-allowlist.git
cd num-dsf-allowlist
cp .env.example .env
bash scripts/generate-keys.sh          # RS256 JWT keys + TOTP key

docker compose up -d                   # nginx, frontend, backend, MySQL, Redis, Mailhog
docker compose exec backend npx ts-node src/db/seed-whitelist.ts admin@example.com
docker compose exec backend npx ts-node src/db/seed-testdata.ts   # optional fixtures
```

| Service | URL |
|---|---|
| Frontend | <http://localhost> |
| Backend API | <http://localhost/api/v1> |
| Mail UI (Mailhog) | <http://localhost:8025> |

## Tests

```bash
docker compose exec backend npm test     # backend integration tests (Jest, needs DB + Redis)
cd frontend && npm test                   # frontend unit tests (Vitest)
cd frontend && npm run test:e2e           # Playwright E2E (needs the docker stack)
cd frontend && npm run test:contract      # contract suite against the running backend
```

Type-check without running tests:

```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Backend tests that touch the database are easiest to run inside the backend
container, which already reaches MySQL and Redis on the compose network:

```bash
docker compose exec backend npx jest --forceExit <pattern>
```

## Conventions

- **Branches:** never commit feature work directly to `main` in a fork; open a
  branch and a pull request.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
  `refactor:`, `chore:`, `ci:`). Keep each commit to one cohesive change.
- **File headers:** every source file starts with a short comment stating its
  purpose and dependencies.
- **No secrets in git:** `.env`, PEM keys, and TOTP keys are git-ignored. Never
  log PEM contents, passwords, OTP codes, or tokens.
- **Database access** goes through the service layer, never directly from routes.
- **TypeScript:** no `any` in new code where it can be avoided; validate input
  at system boundaries with Zod.

## Pull requests

CI must be green before merge. The pipeline runs backend + frontend lint and
tests, the contract suite, Playwright E2E with visual regression, a bundle-size
check, and a Docker build. See `.github/workflows/ci.yml`.

Architecture decisions are recorded under [`docs/adr/`](docs/adr/); when a change
alters a recorded decision, add or supersede the relevant ADR.
