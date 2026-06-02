# Database Schema

MySQL 8 / InnoDB, charset `utf8mb4`, collation `utf8mb4_unicode_ci`, database `dsf_allowlist`.
Derived from `db/migrations/001`–`018`. Columns reflect the final state after all `ALTER TABLE` statements.

## email_whitelist

Auth allow-list of permitted login emails. Lock columns (005) disable a user without deletion.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| email | VARCHAR(255) | no | — | UNIQUE (uq_email) |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| created_by | VARCHAR(255) | yes | NULL | |
| locked_at | TIMESTAMP | yes | NULL | |
| locked_by | VARCHAR(255) | yes | NULL | |
| locked_reason | TEXT | yes | NULL | |

FKs: none.

## users

Authenticated users with TOTP 2FA state.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| email | VARCHAR(255) | no | — | UNIQUE (uq_user_email) |
| totp_secret | VARCHAR(500) | yes | NULL | |
| totp_enabled | TINYINT(1) | no | 0 | |
| backup_codes | JSON | yes | NULL | |
| last_login | DATETIME | yes | NULL | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |

FKs: none.

## refresh_tokens

Persisted refresh tokens (hashed). Mirrors the Redis `refresh:` store.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| user_id | CHAR(36) | no | — | idx_rt_user |
| token_hash | VARCHAR(64) | no | — | idx_rt_hash |
| expires_at | DATETIME | no | — | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| revoked_at | DATETIME | yes | NULL | |

FKs: `user_id` → `users.id` ON DELETE CASCADE (fk_rt_user).

## instances

DSF instances owned by a user.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| user_id | CHAR(36) | no | — | idx_inst_user |
| label | VARCHAR(255) | no | — | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |

FKs: `user_id` → `users.id` ON DELETE CASCADE (fk_inst_user).

## organizations

One organization per instance. PK `identifier` is the FQDN and is immutable (trigger, 015).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| identifier | VARCHAR(255) | no | — | PK |
| instance_id | CHAR(36) | no | — | UNIQUE (uq_org_instance) |
| name | VARCHAR(255) | no | — | |
| active | TINYINT(1) | no | 1 | |
| email | VARCHAR(255) | no | — | |
| address_line | VARCHAR(255) | yes | NULL | |
| postal_code | VARCHAR(20) | yes | NULL | |
| city | VARCHAR(100) | yes | NULL | |
| country_code | CHAR(2) | yes | NULL | |
| client_cert_thumbprint | VARCHAR(128) | yes | NULL | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | no | CURRENT_TIMESTAMP ON UPDATE | |

FKs: `instance_id` → `instances.id` ON DELETE CASCADE (fk_org_inst).

## contacts

Contact persons for an organization. `language` (018) drives notification locale.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| organization_id | VARCHAR(255) | no | — | idx_ct_org |
| types | JSON | no | — | |
| name | VARCHAR(255) | yes | NULL | |
| email | VARCHAR(255) | no | — | |
| email_validated | TINYINT(1) | no | 0 | |
| phone | VARCHAR(50) | yes | NULL | |
| address_line | VARCHAR(255) | yes | NULL | |
| city | VARCHAR(100) | yes | NULL | |
| postal_code | VARCHAR(20) | yes | NULL | |
| country_code | CHAR(2) | yes | NULL | |
| language | CHAR(2) | no | 'en' | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | no | CURRENT_TIMESTAMP ON UPDATE | |

FKs: `organization_id` → `organizations.identifier` ON DELETE CASCADE (fk_ct_org).

## endpoints

FHIR endpoints of an organization. PK `identifier` is the FQDN and is immutable (trigger, 015).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| identifier | VARCHAR(255) | no | — | PK |
| organization_id | VARCHAR(255) | no | — | idx_ep_org |
| name | VARCHAR(255) | yes | NULL | |
| address | VARCHAR(500) | no | — | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | no | CURRENT_TIMESTAMP ON UPDATE | |

FKs: `organization_id` → `organizations.identifier` ON DELETE CASCADE (fk_ep_org).

## endpoint_ips

IP addresses per endpoint, flagged for FHIR / BPE roles.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| endpoint_id | VARCHAR(255) | no | — | idx_eip_ep |
| ip | VARCHAR(45) | no | — | |
| is_fhir | TINYINT(1) | no | 0 | |
| is_bpe | TINYINT(1) | no | 0 | |

FKs: `endpoint_id` → `endpoints.identifier` ON DELETE CASCADE (fk_eip_ep).

## certificates

PEM certificates per organization. `last_notified_at` (009) throttles expiry mail.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| organization_id | VARCHAR(255) | no | — | idx_cert_org |
| pem | TEXT | no | — | |
| subject | VARCHAR(255) | yes | NULL | |
| thumbprint | VARCHAR(64) | yes | NULL | |
| valid_until | DATE | yes | NULL | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| last_notified_at | TIMESTAMP | yes | NULL | |

FKs: `organization_id` → `organizations.identifier` ON DELETE CASCADE (fk_cert_org).

## memberships

Affiliations between an org, a parent org, and an endpoint. `deleted_at` (004) is the soft-delete marker.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| organization_id | VARCHAR(255) | no | — | idx_ms_org |
| parent_organization | VARCHAR(255) | no | — | |
| endpoint_id | VARCHAR(255) | no | — | idx_ms_ep |
| roles | JSON | no | — | |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | no | CURRENT_TIMESTAMP ON UPDATE | |
| deleted_at | TIMESTAMP | yes | NULL | idx_memberships_deleted_at |

FKs: `organization_id` → `organizations.identifier` ON DELETE CASCADE (fk_ms_org); `endpoint_id` → `endpoints.identifier` ON DELETE CASCADE (fk_ms_ep).

## approval_requests

Approval workflow header. Effective status derived from `approval_signatures` (see `lib/approvalState.ts`).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| instance_id | CHAR(36) | no | — | idx_ar_inst |
| status | ENUM('DRAFT','PENDING','APPROVED','REJECTED') | no | 'DRAFT' | idx_ar_status |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | |
| submitted_at | DATETIME | yes | NULL | |
| resolved_at | DATETIME | yes | NULL | |
| resolved_by | VARCHAR(255) | yes | NULL | |
| comment | TEXT | yes | NULL | |
| snapshot_json | JSON | yes | NULL | |
| last_reminded_at | TIMESTAMP | yes | NULL | |

FKs: `instance_id` → `instances.id` ON DELETE CASCADE (fk_ar_inst).

## approval_signatures

Per-admin sign-off rows backing the 4-eyes workflow (003).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | — | PK |
| approval_request_id | CHAR(36) | no | — | idx_signatures_request |
| admin_email | VARCHAR(255) | no | — | UNIQUE w/ request (uq_signatures_request_admin) |
| admin_site | VARCHAR(255) | no | — | |
| decision | ENUM('APPROVE','REJECT') | no | — | idx_signatures_decision |
| signed_at | TIMESTAMP | no | CURRENT_TIMESTAMP | |
| comment | TEXT | yes | NULL | |

FKs: `approval_request_id` → `approval_requests.id` ON DELETE CASCADE (fk_signatures_request). Unique (approval_request_id, admin_email).

## audit_logs

Append-only audit trail. UPDATE/DELETE blocked by triggers (013). `resource_type` extended for MARKETPLACE (011/014).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| timestamp | DATETIME | no | CURRENT_TIMESTAMP | idx_al_time |
| user_email | VARCHAR(255) | yes | NULL | idx_al_user |
| instance_id | CHAR(36) | yes | NULL | idx_al_inst |
| resource_type | ENUM('ORGANIZATION','CONTACT','ENDPOINT','CERTIFICATE','MEMBERSHIP','AUTH','APPROVAL','MARKETPLACE') | no | — | idx_al_res (with resource_id) |
| resource_id | VARCHAR(255) | yes | NULL | idx_al_res |
| operation | ENUM('CREATE','UPDATE','DELETE','APPROVE','REJECT','LOGIN','LOGOUT','OTP_REQUEST','OTP_VERIFY','TOTP_SETUP','TOTP_VERIFY','FAILED_LOGIN') | no | — | |
| diff_json | JSON | yes | NULL | |
| ip_address | VARCHAR(45) | yes | NULL | |

FKs: none declared (instance_id is not a constraint).

## admin_grants

Cryptographically signed admin role assignments (006). RS256 signature verified by the app.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| email | VARCHAR(255) | no | — | PK |
| granted_at | TIMESTAMP | no | — | idx_admin_grants_granted_at |
| granted_by_a | VARCHAR(255) | no | — | |
| granted_by_b | VARCHAR(255) | no | — | |
| signature_hex | TEXT | no | — | |

FKs: none.

## admin_promotion_requests

4-eyes admin promotion workflow (007).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | — | PK |
| target_email | VARCHAR(255) | no | — | |
| requested_by | VARCHAR(255) | no | — | |
| requested_at | TIMESTAMP | no | — | |
| status | ENUM('PENDING','APPROVED','REJECTED','CANCELLED') | no | 'PENDING' | idx_apr_status |
| approver_b | VARCHAR(255) | yes | NULL | |
| approved_at | TIMESTAMP | yes | NULL | |
| rejected_by | VARCHAR(255) | yes | NULL | |
| rejection_reason | TEXT | yes | NULL | |
| resolved_at | TIMESTAMP | yes | NULL | |

FKs: none.

## marketplace_entries

Process marketplace plugin registry (011), with GitHub metadata (012).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | — | PK |
| git_url | VARCHAR(255) | no | — | UNIQUE |
| name | VARCHAR(255) | no | — | |
| description | TEXT | yes | NULL | |
| status | ENUM('APPROVED','EXPERIMENTAL','DEPRECATED') | no | 'APPROVED' | idx_status |
| latest_release_tag | VARCHAR(50) | yes | NULL | |
| last_commit_at | TIMESTAMP | yes | NULL | |
| stars | INT | no | 0 | |
| license | VARCHAR(50) | yes | NULL | |
| sync_at | TIMESTAMP | yes | NULL | idx_sync_at |
| sync_error | TEXT | yes | NULL | |
| added_by | VARCHAR(255) | no | — | |
| added_at | TIMESTAMP | no | — | |
| updated_at | TIMESTAMP | no | — | |
| topics | JSON | yes | NULL | |
| forks | INT | no | 0 | |
| open_issues | INT | no | 0 | |
| archived | TINYINT(1) | no | 0 | |
| homepage | VARCHAR(255) | yes | NULL | |
| language | VARCHAR(50) | yes | NULL | |

FKs: none.

## pending_notifications

Persisted delayed-send emails surviving process restarts (010). Flushed when `send_after <= now`.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | — | PK |
| kind | VARCHAR(64) | no | — | |
| target_email | VARCHAR(255) | no | — | |
| payload_json | JSON | no | — | |
| send_after | TIMESTAMP | no | — | idx_pending_send_after |
| created_at | TIMESTAMP | no | CURRENT_TIMESTAMP | |

FKs: none.

## ca_blacklist

Blacklisted CA Subject DNs checked against a cert's issuer at upload (016).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| subject_dn | VARCHAR(500) | no | — | UNIQUE (uq_cab_subject) |
| fingerprint | CHAR(64) | yes | NULL | idx_cab_fingerprint |
| reason | TEXT | yes | NULL | |
| added_by | VARCHAR(255) | no | — | |
| added_at | DATETIME | no | CURRENT_TIMESTAMP | |

FKs: none.

## known_cas

Cached Mozilla trust-store snapshot for the admin CA picker (016).

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| fingerprint | CHAR(64) | no | — | PK |
| subject_dn | VARCHAR(500) | no | — | idx_known_subject |
| source | VARCHAR(64) | no | 'mozilla' | |
| synced_at | DATETIME | no | CURRENT_TIMESTAMP | |

FKs: none.

## bundle_versions

Full FHIR bundle snapshots persisted on each approval (017). Signed with RS256 over `content_hash`.

| Column | Type | Nullable | Default | Key |
|---|---|---|---|---|
| id | CHAR(36) | no | UUID() | PK |
| version_number | INT | no | AUTO_INCREMENT | UNIQUE (uq_bv_version) |
| created_at | DATETIME | no | CURRENT_TIMESTAMP | idx_bv_created |
| triggered_by | ENUM('APPROVAL','MANUAL','RESTORE') | no | — | |
| approval_request_id | CHAR(36) | yes | NULL | idx_bv_approval |
| triggered_by_email | VARCHAR(255) | no | — | |
| content_hash | CHAR(64) | no | — | |
| signature | TEXT | no | — | |
| bundle_json | LONGTEXT | no | — | |
| notes | TEXT | yes | NULL | |

FKs: `approval_request_id` → `approval_requests.id` ON DELETE SET NULL (fk_bv_approval).
