/**
 * certificate.service.ts – PEM parsing, private key check, CRUD
 * SECURITY CRITICAL: Private keys IMMEDIATELY rejected, PEM NEVER in logs
 */
import forge from 'node-forge';
import crypto from 'crypto';
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export function rejectPrivateKey(pem: string): void {
  if (pem.includes('PRIVATE KEY') || pem.includes('ENCRYPTED PRIVATE KEY') || pem.includes('RSA PRIVATE KEY') || pem.includes('EC PRIVATE KEY')) {
    throw new Error('PRIVATE_KEY_REJECTED');
  }
}

export function parseCertificate(pem: string): { subject: string; thumbprint: string; validUntil: Date } {
  rejectPrivateKey(pem);
  try {
    const cert = forge.pki.certificateFromPem(pem);
    const subject = cert.subject.getField('CN')?.value || cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const thumbprint = crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex').toUpperCase();
    const validUntil = cert.validity.notAfter;
    return { subject, thumbprint, validUntil };
  } catch (err: any) {
    if (err.message === 'PRIVATE_KEY_REJECTED') throw err;
    throw new Error('INVALID_PEM');
  }
}

export async function getCertificates(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('certificates').where({ organization_id: org.identifier }).select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at').orderBy('created_at', 'desc');
}

export async function createCertificate(instanceId: string, pem: string, userEmail: string, ipAddress: string) {
  rejectPrivateKey(pem);
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const { subject, thumbprint, validUntil } = parseCertificate(pem.trim());
  const id = uuidv4();
  await db('certificates').insert({ id, organization_id: org.identifier, pem: pem.trim(), subject, thumbprint, valid_until: validUntil, created_at: new Date() });
  await writeAuditLog({ userEmail, instanceId, resourceType: 'CERTIFICATE', resourceId: id, operation: 'CREATE', diffJson: { subject, thumbprint, validUntil }, ipAddress });
  return db('certificates').where({ id }).select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at').first();
}

export async function deleteCertificate(instanceId: string, certId: string, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const cert = await db('certificates').where({ id: certId, organization_id: org.identifier }).first();
  if (!cert) throw new Error('CERTIFICATE_NOT_FOUND');
  await db('certificates').where({ id: certId }).delete();
  await writeAuditLog({ userEmail, instanceId, resourceType: 'CERTIFICATE', resourceId: certId, operation: 'DELETE', ipAddress });
}
