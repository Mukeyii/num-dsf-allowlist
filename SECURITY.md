# Security Policy

The DSF Allow List Management Portal handles sensitive data for the German
Medical Informatics Initiative (MII/NUM): organizational identifiers,
contact details, X.509 certificates, and FHIR endpoint configurations.
Security reports are taken seriously and triaged promptly.

## Reporting a vulnerability

**Please do NOT open a public GitHub issue for security problems.**

Use one of these channels instead:

1. **GitHub Security Advisory** (preferred) — open a private advisory at
   https://github.com/Mukeyii/num-dsf-allowlist/security/advisories/new
   This keeps the report private until a fix is ready.

2. **Email** the Institute of Medical Informatics:
   https://www.medizin.uni-muenster.de/imi/das-institut.html
   (Operator contact via the institute's official channels.)

Please include, where possible:

- A description of the vulnerability and its impact
- Reproduction steps or a proof-of-concept
- The commit / version / deployment in which the issue was found
- Your name and affiliation if you wish to be credited

## Response timeline

- **48 hours** — acknowledgement of receipt
- **7 days** — initial triage, severity assessment, and reproduction
- **30 days** — coordinated disclosure for low/medium severity, faster for high/critical

We will keep you informed throughout the process and credit you in the
release notes when the fix ships, unless you prefer to remain anonymous.

## Scope

In scope:

- The frontend application (`frontend/`)
- The backend API (`backend/`)
- The nginx reverse-proxy configuration (`nginx/`)
- The deployment configuration (`docker-compose.yml`, `docker-compose.prod.yml`)
- The database migration files (`db/migrations/`)
- The CI/CD pipelines (`.github/workflows/`)

Out of scope:

- Vulnerabilities in third-party dependencies that are already publicly
  disclosed and have an upstream fix; please report those upstream
- Issues that require physical access to the deployment server
- Social-engineering attacks against IMI staff
- Self-XSS, CSV injection, or denial-of-service via resource exhaustion
  on the public marketing pages

## Out-of-band coordination

If a vulnerability has potential to affect MII/NUM-wide infrastructure
beyond this single deployment, IMI will coordinate disclosure with the
network operators before public release.
