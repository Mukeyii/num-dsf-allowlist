-- 002_client_cert_thumbprint.sql
-- Adds client_cert_thumbprint column to organizations for mTLS authentication.
-- The DSF BPE process authenticates to the FHIR Bundle endpoint using a client certificate.
-- The SHA-256 thumbprint of that certificate is stored here to verify the identity.

ALTER TABLE organizations ADD COLUMN client_cert_thumbprint VARCHAR(128) DEFAULT NULL;
