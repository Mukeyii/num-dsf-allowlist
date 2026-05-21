-- 016_ca_blacklist.sql
--
-- A site can upload any PEM today. To prevent uploads issued by CAs we know
-- are weak / compromised / not-trusted-for-DSF, admins maintain a blacklist
-- of CA Subject DNs (optionally pinned by SHA-256 fingerprint). The
-- certificate.service checks the leaf cert's ISSUER against this list during
-- upload and rejects with CA_BLACKLISTED.
--
-- `known_cas` is a cached snapshot of the Mozilla trust store (synced via
-- the npm run sync:cas script — see backend/src/scripts/sync-mozilla-cas.ts).
-- The admin UI surfaces it as a picker so operators do not have to type DNs
-- by hand.

USE `dsf_allowlist`;

CREATE TABLE `ca_blacklist` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `subject_dn`   VARCHAR(500) NOT NULL,
  `fingerprint`  CHAR(64),                                   -- SHA-256 of CA cert if uploaded; nullable for subject-only blacklists
  `reason`       TEXT,
  `added_by`     VARCHAR(255) NOT NULL,
  `added_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cab_subject` (`subject_dn`),
  KEY `idx_cab_fingerprint` (`fingerprint`)
) ENGINE=InnoDB;

CREATE TABLE `known_cas` (
  `fingerprint`  CHAR(64)     NOT NULL,                      -- SHA-256, upper-case hex
  `subject_dn`   VARCHAR(500) NOT NULL,
  `source`       VARCHAR(64)  NOT NULL DEFAULT 'mozilla',    -- "mozilla", "manual", etc.
  `synced_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fingerprint`),
  KEY `idx_known_subject` (`subject_dn`)
) ENGINE=InnoDB;
