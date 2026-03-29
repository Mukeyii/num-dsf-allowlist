/**
 * fhir.routes.ts – FHIR-compatible Bundle endpoint for DSF process
 * Authenticates via client certificate thumbprint (mTLS).
 * No JWT auth required — this is a machine-to-machine endpoint.
 * Dependencies: express, fhir.service, audit.service, db/connection, crypto
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/connection';
import { generateBundle } from '../services/fhir.service';
import { writeAuditLog } from '../services/audit.service';

export const fhirRouter = Router();

/**
 * Extract and verify client certificate from the TLS connection.
 * nginx passes the client cert via X-Client-Cert header (PEM-encoded, URL-encoded).
 * Returns thumbprint and subject, or null if no valid cert header is present.
 */
function extractClientCertThumbprint(req: Request): { thumbprint: string; subject: string } | null {
  // nginx passes the client cert as a URL-encoded PEM header
  const certHeader = req.headers['x-client-cert'] || req.headers['x-ssl-client-cert'];
  if (!certHeader) return null;

  try {
    const pem = decodeURIComponent(certHeader as string);
    // Calculate SHA-256 thumbprint of the DER-encoded certificate (base64 body only)
    const certDer = Buffer.from(
      pem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, ''),
      'base64'
    );
    const thumbprint = crypto.createHash('sha256').update(certDer).digest('hex');
    return { thumbprint, subject: 'client-cert' };
  } catch {
    return null;
  }
}

/**
 * Lookup the organization that is registered for the given client cert thumbprint.
 * Returns the org row or null if not found.
 */
async function findOrgByThumbprint(thumbprint: string) {
  return db('organizations').where({ client_cert_thumbprint: thumbprint }).first() ?? null;
}

// GET /fhir/Bundle/:endpointId — Fetch a specific bundle by endpoint identifier
fhirRouter.get('/Bundle/:endpointId', async (req: Request, res: Response) => {
  try {
    const cert = extractClientCertThumbprint(req);
    if (!cert) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'security', diagnostics: 'Client certificate required' }],
      });
    }

    const org = await findOrgByThumbprint(cert.thumbprint);
    if (!org) {
      return res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Client certificate not registered' }],
      });
    }

    const endpointId = req.params.endpointId;
    const bundle = await generateBundle(org.instance_id, endpointId);

    // Audit: record the download (non-blocking — failure must not disrupt the response)
    writeAuditLog({
      userEmail: `cert:${cert.thumbprint.slice(0, 16)}`,
      instanceId: org.instance_id,
      resourceType: 'CERTIFICATE',
      resourceId: endpointId,
      operation: 'CREATE',
      ipAddress: req.ip || 'unknown',
    }).catch(() => {});

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json(bundle);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'ENDPOINT_NOT_FOUND' || message === 'ORGANIZATION_NOT_FOUND') {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: message }],
      });
    }
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: 'Internal server error' }],
    });
  }
});

// GET /fhir/Bundle — Search by client cert; returns first endpoint bundle wrapped in a searchset
fhirRouter.get('/Bundle', async (req: Request, res: Response) => {
  try {
    const cert = extractClientCertThumbprint(req);
    if (!cert) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'security', diagnostics: 'Client certificate required' }],
      });
    }

    const org = await findOrgByThumbprint(cert.thumbprint);
    if (!org) {
      return res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Client certificate not registered' }],
      });
    }

    const endpoints = await db('endpoints').where({ organization_id: org.identifier });
    if (endpoints.length === 0) {
      return res.json({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] });
    }

    const firstEndpoint = endpoints[0];
    const bundle = await generateBundle(org.instance_id, firstEndpoint.identifier);

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [
        {
          fullUrl: `${req.protocol}://${req.get('host')}/fhir/Bundle/${firstEndpoint.identifier}`,
          resource: bundle,
        },
      ],
    });
  } catch {
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: 'Internal server error' }],
    });
  }
});
