/**
 * certificate.service.ts – PEM parsing, private key check, CRUD
 * SECURITY CRITICAL: Private keys IMMEDIATELY rejected, PEM NEVER in logs
 */
import forge from 'node-forge';
import crypto from 'crypto';
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { isCaBlacklisted } from './ca-blacklist.service';
import { errMessage } from '../lib/errMessage';
import { v4 as uuidv4 } from 'uuid';

// Match BEGIN/END markers for any private-key variant, case-insensitive.
// Substring checks against literal upper-case 'PRIVATE KEY' miss PEMs that
// were lower-cased by an editor, a copy-paste tool, or the OpenSSL output
// of a non-default locale. Pattern intentionally permissive on whitespace
// between PRIVATE and KEY because some tooling emits hyphens or extra spaces.
const PRIVATE_KEY_MARKER =
  /-----BEGIN\s+(?:ENCRYPTED\s+|RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE[\s_-]+KEY-----/i;

/**
 * Guard against a private key reaching storage or logs. SECURITY CRITICAL.
 * @throws PRIVATE_KEY_REJECTED if the PEM contains any private-key block.
 */
export function rejectPrivateKey(pem: string): void {
  if (PRIVATE_KEY_MARKER.test(pem)) {
    throw new Error('PRIVATE_KEY_REJECTED');
  }
}

/**
 * Parse an X.509 PEM into subject, SHA-256 thumbprint, expiry, and issuer DN.
 * Rejects private keys before parsing; never logs the PEM.
 * @throws PRIVATE_KEY_REJECTED if the PEM carries a private key.
 * @throws INVALID_PEM if the certificate cannot be parsed.
 */
export function parseCertificate(pem: string): {
  subject: string;
  thumbprint: string;
  validUntil: Date;
  issuerDn: string;
} {
  rejectPrivateKey(pem);
  try {
    const cert = forge.pki.certificateFromPem(pem);
    const subject =
      cert.subject.getField('CN')?.value ||
      cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const thumbprint = crypto
      .createHash('sha256')
      .update(Buffer.from(der, 'binary'))
      .digest('hex')
      .toUpperCase();
    const validUntil = cert.validity.notAfter;
    // Issuer Subject DN, used by the CA-blacklist gate. shortName falls back
    // to the OID when the attribute has no canonical short form.
    const issuerDn = cert.issuer.attributes
      .map((a: any) => `${a.shortName || a.name || a.type}=${a.value}`)
      .join(',');
    return { subject, thumbprint, validUntil, issuerDn };
  } catch (err: unknown) {
    if (errMessage(err) === 'PRIVATE_KEY_REJECTED') throw err;
    throw new Error('INVALID_PEM');
  }
}

export async function getCertificates(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('certificates')
    .where({ organization_id: org.identifier })
    .select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at')
    .orderBy('created_at', 'desc');
}

/**
 * Validate and store a certificate for the instance's organization.
 * Side-effects: inserts a certificates row and writes a CREATE audit log.
 * @throws PRIVATE_KEY_REJECTED / INVALID_PEM on a bad PEM.
 * @throws ORGANIZATION_NOT_FOUND if the instance has no organization.
 * @throws CA_BLACKLISTED if the issuing CA is blacklisted.
 */
export async function createCertificate(
  instanceId: string,
  pem: string,
  userEmail: string,
  ipAddress: string,
) {
  rejectPrivateKey(pem);
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const { subject, thumbprint, validUntil, issuerDn } = parseCertificate(pem.trim());
  if (await isCaBlacklisted({ subjectDn: issuerDn })) {
    throw new Error('CA_BLACKLISTED');
  }
  const id = uuidv4();
  await db('certificates').insert({
    id,
    organization_id: org.identifier,
    pem: pem.trim(),
    subject,
    thumbprint,
    valid_until: validUntil,
    created_at: new Date(),
  });
  await writeAuditLog({
    userEmail,
    instanceId,
    resourceType: 'CERTIFICATE',
    resourceId: id,
    operation: 'CREATE',
    diffJson: { subject, thumbprint, validUntil },
    ipAddress,
  });
  return db('certificates')
    .where({ id })
    .select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at')
    .first();
}

export async function deleteCertificate(
  instanceId: string,
  certId: string,
  userEmail: string,
  ipAddress: string,
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const cert = await db('certificates')
    .where({ id: certId, organization_id: org.identifier })
    .first();
  if (!cert) throw new Error('CERTIFICATE_NOT_FOUND');
  await db('certificates').where({ id: certId }).delete();
  await writeAuditLog({
    userEmail,
    instanceId,
    resourceType: 'CERTIFICATE',
    resourceId: certId,
    operation: 'DELETE',
    ipAddress,
  });
}

/**
 * Atomically replace a certificate: insert the new PEM and delete the old one.
 * Side-effects: runs in a transaction and writes audit logs for both actions.
 * @throws PRIVATE_KEY_REJECTED / INVALID_PEM on a bad PEM.
 * @throws ORGANIZATION_NOT_FOUND / CERTIFICATE_NOT_FOUND if the org or old cert is missing.
 * @throws CA_BLACKLISTED if the issuing CA is blacklisted.
 */
export async function renewCertificate(
  instanceId: string,
  oldCertId: string,
  body: { pem: string },
  userEmail: string,
  ipAddress: string,
) {
  rejectPrivateKey(body.pem);
  const { subject, thumbprint, validUntil, issuerDn } = parseCertificate(body.pem.trim());
  if (await isCaBlacklisted({ subjectDn: issuerDn })) {
    throw new Error('CA_BLACKLISTED');
  }

  return db.transaction(async (trx) => {
    // Lock old cert row and verify it belongs to this instance's org
    const org = await trx('organizations').where({ instance_id: instanceId }).first();
    if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

    const oldCert = await trx('certificates')
      .where({ id: oldCertId, organization_id: org.identifier })
      .forUpdate()
      .first();
    if (!oldCert) throw new Error('CERTIFICATE_NOT_FOUND');

    // Insert new cert
    const newId = uuidv4();
    await trx('certificates').insert({
      id: newId,
      organization_id: org.identifier,
      pem: body.pem.trim(),
      subject,
      thumbprint,
      valid_until: validUntil,
      created_at: new Date(),
    });

    // Delete old cert
    await trx('certificates').where({ id: oldCertId }).delete();

    // Audit both actions (outside transaction lock; failures must not block)
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'CERTIFICATE',
      resourceId: newId,
      operation: 'CREATE',
      diffJson: { subject, thumbprint, validUntil, renewedFrom: oldCertId },
      ipAddress,
    });
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'CERTIFICATE',
      resourceId: oldCertId,
      operation: 'DELETE',
      diffJson: { replacedBy: newId },
      ipAddress,
    });

    return trx('certificates')
      .where({ id: newId })
      .select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at')
      .first();
  });
}
