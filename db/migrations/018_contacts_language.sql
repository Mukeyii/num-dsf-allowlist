-- 018_contacts_language.sql
--
-- Adds a per-contact language preference so post-approval notification
-- emails are rendered in the recipient's locale (DE or EN). Defaults to
-- 'en' so every existing contact still gets a readable mail.
--
-- The mail template (services/mail-templates/approved-bundle-mail.ts)
-- falls back to English when an unknown locale is supplied, so this
-- column staying at CHAR(2) is safe — even a stray value won't crash
-- the renderer.

USE `dsf_allowlist`;

ALTER TABLE `contacts`
  ADD COLUMN `language` CHAR(2) NOT NULL DEFAULT 'en'
  AFTER `country_code`;
