/**
 * fhir.routes.ts – FHIR-compatible Bundle endpoint for DSF process
 * Authenticates via client certificate thumbprint (mTLS).
 * No JWT auth required — this is a machine-to-machine endpoint.
 * Dependencies: express, fhir.service, audit.service, db/connection, clientCert lib
 */
import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { generateFullBundle } from '../services/fhir.service';
import { writeAuditLog } from '../services/audit.service';
import { extractClientCert } from '../lib/clientCert';

export const fhirRouter = Router();

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
    const cert = extractClientCert(req);
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

    const bundle = await generateFullBundle();

    // Audit: record the download (non-blocking — failure must not disrupt the response)
    writeAuditLog({
      userEmail: `cert:${cert.thumbprint.slice(0, 16)}`,
      instanceId: org.instance_id,
      resourceType: 'CERTIFICATE',
      resourceId: req.params.endpointId,
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
    const cert = extractClientCert(req);
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

    const bundle = await generateFullBundle();

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json(bundle);
  } catch {
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: 'Internal server error' }],
    });
  }
});
