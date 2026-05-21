-- 017_bundle_versions.sql
--
-- Every approval reshapes the federation-wide allow list. We persist a full
-- snapshot of the generated FHIR bundle whenever an approval transitions to
-- APPROVED so that admins can review, diff against any prior version,
-- download, and (in emergencies) restore a known-good state.
--
-- Storage cost: ~50 KB per snapshot. 10 years of weekly approvals ≈ 25 MB.
-- bundle_json is LONGTEXT so the row can hold a federation-wide bundle even
-- once the network grows past the MEDIUMTEXT 16-MB ceiling.

USE `dsf_allowlist`;

CREATE TABLE `bundle_versions` (
  `id`                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  `version_number`      INT          NOT NULL AUTO_INCREMENT,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `triggered_by`        ENUM('APPROVAL','MANUAL','RESTORE') NOT NULL,
  `approval_request_id` CHAR(36),                              -- FK when triggered_by='APPROVAL'
  `triggered_by_email`  VARCHAR(255) NOT NULL,
  `content_hash`        CHAR(64)     NOT NULL,                 -- SHA-256 of bundle_json
  `signature`           TEXT         NOT NULL,                 -- RS256 JWT of contentHash
  `bundle_json`         LONGTEXT     NOT NULL,                 -- full FHIR Bundle as JSON
  `notes`               TEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bv_version` (`version_number`),
  KEY `idx_bv_created` (`created_at`),
  KEY `idx_bv_approval` (`approval_request_id`),
  CONSTRAINT `fk_bv_approval` FOREIGN KEY (`approval_request_id`) REFERENCES `approval_requests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
