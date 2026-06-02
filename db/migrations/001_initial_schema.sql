-- 001_initial_schema.sql
--
-- Base schema: creates the database and the core tables — email_whitelist,
-- users, refresh_tokens, instances, organizations, contacts, endpoints,
-- endpoint_ips, certificates, memberships, approval_requests, audit_logs —
-- with their foreign keys and unique constraints. All later migrations alter
-- or extend these.

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
  `client_cert_thumbprint` VARCHAR(128) DEFAULT NULL,
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
