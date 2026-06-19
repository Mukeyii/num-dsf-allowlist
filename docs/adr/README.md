# Architecture Decision Records

This directory records the significant architectural and security decisions
behind the DSF Management Portal. Each file uses a MADR-lite format:
a header block (Status, Date, Deciders) followed by **Context**, **Decision**,
and **Consequences** sections.

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-cryptographic-admin-grants.md) | Cryptographically signed admin grants | Accepted |
| [002](002-rs256-over-hs256.md) | RS256 over HS256 for JWTs and bundle signatures | Accepted |
| [003](003-four-eyes-silent-consent.md) | Four-eyes approval with silent consent | Accepted |
| [004](004-mtls-bundle-download.md) | mTLS client-certificate auth for bundle download | Accepted |
| [005](005-audit-log-immutability.md) | Append-only audit log enforced by DB triggers | Accepted |
| [006](006-passwordless-auth.md) | Passwordless authentication (allow-list + OTP + TOTP) | Accepted |
| [007](007-dsf-read-access-tag-and-profile.md) | DSF read-access tag and meta.profile on every resource | Accepted |
| [008](008-fqdn-immutability.md) | Immutable organization and endpoint FQDN identifiers | Accepted |
| [009](009-bundle-versioning.md) | Signed, hashed bundle version snapshots | Accepted |
| [010](010-membership-soft-delete-retention.md) | Membership soft-delete with 90-day retention | Accepted |
| [011](011-redis-keyspace.md) | Redis keyspace layout and TTLs | Accepted |
| [012](012-per-contact-language.md) | Per-contact notification language | Accepted |
| [013](013-redis-failsoft-idle-check.md) | Fail-soft refresh idle check on Redis outage | Accepted |
| [014](014-single-page-entity-graph.md) | Single-page entity canvas | Accepted |
