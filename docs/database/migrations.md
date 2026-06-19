# Migration Catalog

Chronological list of `db/migrations/*.sql`. Purpose taken from each file's leading comment.
All migrations are idempotent (existence-guarded) except 013–018, which run unconditionally.

| # | File | Purpose | Triggers / Constraints |
|---|---|---|---|
| 001 | 001_initial_schema.sql | Create database and base tables: email_whitelist, users, refresh_tokens, instances, organizations, contacts, endpoints, endpoint_ips, certificates, memberships, approval_requests, audit_logs | FKs + unique keys |
| 002 | 002_client_cert_thumbprint.sql | Add organizations.client_cert_thumbprint for mTLS | — |
| 003 | 003_approval_signatures.sql | Create approval_signatures table for 4-eyes approval workflow | FK to approval_requests; unique (request, admin) |
| 004 | 004_memberships_deleted_at.sql | Add memberships.deleted_at soft-delete column + index | — |
| 005 | 005_email_whitelist_lock.sql | Add lock lifecycle columns (locked_at/by/reason) to email_whitelist | — |
| 006 | 006_admin_grants.sql | Create admin_grants table (RS256-signed role assignments) | — |
| 007 | 007_admin_promotion_requests.sql | Create admin_promotion_requests (4-eyes promotion workflow) | — |
| 008 | 008_approval_request_last_reminded_at.sql | Add approval_requests.last_reminded_at to throttle reminders | — |
| 009 | 009_certificates_last_notified_at.sql | Add certificates.last_notified_at to dedupe expiry mail | — |
| 010 | 010_pending_notifications.sql | Create pending_notifications table for delayed-send emails | — |
| 011 | 011_marketplace_entries.sql | Create marketplace_entries; extend audit_logs.resource_type ENUM with MARKETPLACE | ENUM modify |
| 012 | 012_marketplace_extra_fields.sql | Add GitHub metadata columns to marketplace_entries (topics, forks, open_issues, archived, homepage, language) | — |
| 013 | 013_audit_log_immutability.sql | Enforce append-only audit_logs at DB level | Triggers: audit_logs_no_update, audit_logs_no_delete |
| 014 | 014_audit_logs_marketplace_enum.sql | Rewrite audit_logs.resource_type ENUM to include MARKETPLACE (idempotent reapply of 011 change) | ENUM modify |
| 015 | 015_endpoint_org_identifier_immutability.sql | Make endpoint/organization identifier (FQDN) immutable | Triggers: endpoints_identifier_immutable, organizations_identifier_immutable |
| 016 | 016_ca_blacklist.sql | Create ca_blacklist and known_cas tables for CA upload checks | — |
| 017 | 017_bundle_versions.sql | Create bundle_versions table for FHIR bundle snapshots | FK to approval_requests (ON DELETE SET NULL) |
| 018 | 018_contacts_language.sql | Add contacts.language for per-contact notification locale | — |
| 019 | 019_marketplace_v2.sql | Marketplace v2: add DSF metadata, trust-signal, and slug columns to marketplace_entries; create marketplace_releases table for release history (shipped in v0.1.2) | — |
