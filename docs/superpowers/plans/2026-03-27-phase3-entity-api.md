# Phase 3 – Entity API Backend: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete REST API for all 5 entities (Organization, Contacts, Endpoints, Certificates, Memberships) plus Approval workflow, FHIR Bundle download, IP-Address-List Excel export, instance CRUD, and audit log querying — all with ownership checks and audit logging.

**Architecture:** Each entity has a service layer (DB operations + audit logging) and a route layer (HTTP handling). All entity routes live under `/api/v1/instances/:instanceId/` and are protected by `requireAuth` + `requireInstanceOwnership` middleware. The approval service implements a state machine (DRAFT→PENDING→APPROVED/REJECTED). Downloads include FHIR R4 Bundle JSON and Excel IP list.

**Tech Stack:** Express, Knex (MySQL), node-forge (PEM parsing), exceljs (Excel export), uuid

---

## File Structure

### New files to create:

| File | Responsibility |
|------|---------------|
| `backend/src/middleware/instance.middleware.ts` | Instance ownership verification |
| `backend/src/services/organization.service.ts` | Organization CRUD (1:1 per instance) |
| `backend/src/services/contacts.service.ts` | Contacts CRUD (1:N per org) |
| `backend/src/services/certificate.service.ts` | PEM parsing, private key rejection, cert CRUD |
| `backend/src/services/endpoints.service.ts` | Endpoints CRUD with IP addresses |
| `backend/src/services/memberships.service.ts` | Memberships CRUD with role validation |
| `backend/src/services/approval.service.ts` | Approval workflow state machine |
| `backend/src/services/fhir.service.ts` | FHIR R4 Bundle generation |
| `backend/src/services/excel.service.ts` | IP address list Excel export |
| `backend/src/routes/organization.routes.ts` | Organization HTTP routes |
| `backend/src/routes/contacts.routes.ts` | Contacts HTTP routes |
| `backend/src/routes/endpoints.routes.ts` | Endpoints HTTP routes |
| `backend/src/routes/certificates.routes.ts` | Certificates HTTP routes (no PUT) |
| `backend/src/routes/memberships.routes.ts` | Memberships HTTP routes |
| `backend/src/routes/approval.routes.ts` | Approval + admin HTTP routes |
| `backend/src/routes/download.routes.ts` | FHIR Bundle + Excel download routes |
| `backend/src/routes/audit.routes.ts` | Audit log query route |

### Files to modify:

| File | Change |
|------|--------|
| `backend/src/routes/instances.routes.ts` | Replace placeholder with full CRUD |
| `backend/src/index.ts` | Register all new routers |

---

### Task 1: Instance Middleware

**Files:**
- Create: `backend/src/middleware/instance.middleware.ts`

- [ ] **Step 1: Create `backend/src/middleware/instance.middleware.ts`**

```typescript
/**
 * instance.middleware.ts – Checks if the requested instance belongs to the logged-in user.
 * Must be mounted after requireAuth.
 * Injects req.instance into the request.
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';

declare global {
  namespace Express {
    interface Request {
      instance?: { id: string; userId: string; label: string };
    }
  }
}

export async function requireInstanceOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const instanceId = req.params.instanceId || req.params.id;
  if (!instanceId) {
    res.status(400).json({ error: { code: 'MISSING_INSTANCE', message: 'Instance ID required' } });
    return;
  }

  const instance = await db('instances')
    .where({ id: instanceId, user_id: req.user!.id })
    .first();

  if (!instance) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Instance not found or access denied' } });
    return;
  }

  req.instance = instance;
  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/instance.middleware.ts
git commit -m "feat: add instance ownership middleware"
```

---

### Task 2: Organization Service

**Files:**
- Create: `backend/src/services/organization.service.ts`

- [ ] **Step 1: Create `backend/src/services/organization.service.ts`**

```typescript
/**
 * organization.service.ts – CRUD for Organization (1:1 per instance)
 * Deletion only via Request-for-Removal → Approval workflow
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';

export async function getOrganization(instanceId: string) {
  return db('organizations').where({ instance_id: instanceId }).first() ?? null;
}

export async function upsertOrganization(
  instanceId: string,
  data: {
    identifier: string;
    name: string;
    active: boolean;
    email: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
  },
  userEmail: string,
  ipAddress: string
) {
  const existing = await getOrganization(instanceId);
  const now = new Date();

  if (existing) {
    const before = { ...existing };
    await db('organizations')
      .where({ instance_id: instanceId })
      .update({
        name: data.name,
        active: data.active,
        email: data.email,
        address_line: data.addressLine ?? null,
        postal_code: data.postalCode ?? null,
        city: data.city ?? null,
        country_code: data.countryCode ?? null,
        updated_at: now,
      });
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'ORGANIZATION',
      resourceId: existing.identifier,
      operation: 'UPDATE',
      diffJson: { before, after: data },
      ipAddress,
    });
    return getOrganization(instanceId);
  } else {
    await db('organizations').insert({
      identifier: data.identifier,
      instance_id: instanceId,
      name: data.name,
      active: data.active ? 1 : 0,
      email: data.email,
      address_line: data.addressLine ?? null,
      postal_code: data.postalCode ?? null,
      city: data.city ?? null,
      country_code: data.countryCode ?? null,
      created_at: now,
      updated_at: now,
    });
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'ORGANIZATION',
      resourceId: data.identifier,
      operation: 'CREATE',
      diffJson: { after: data },
      ipAddress,
    });
    return getOrganization(instanceId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/organization.service.ts
git commit -m "feat: add organization service with upsert and audit logging"
```

---

### Task 3: Contacts Service

**Files:**
- Create: `backend/src/services/contacts.service.ts`

- [ ] **Step 1: Create `backend/src/services/contacts.service.ts`**

```typescript
/**
 * contacts.service.ts – CRUD for Contacts (1:N per Organization)
 * Contact data is NEVER published in the Allow List.
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getContacts(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('contacts').where({ organization_id: org.identifier }).orderBy('created_at', 'asc');
}

export async function createContact(
  instanceId: string,
  data: {
    types: string[];
    name?: string;
    email: string;
    phone?: string;
    addressLine?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
  },
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  if (!data.types?.length) throw new Error('TYPES_REQUIRED');
  const validTypes = ['MEDIC', 'DSF_ADMIN', 'SECURITY'];
  if (!data.types.every(t => validTypes.includes(t))) throw new Error('INVALID_TYPE');

  const id = uuidv4();
  const now = new Date();
  await db('contacts').insert({
    id,
    organization_id: org.identifier,
    types: JSON.stringify(data.types),
    name: data.name ?? null,
    email: data.email,
    email_validated: 0,
    phone: data.phone ?? null,
    address_line: data.addressLine ?? null,
    city: data.city ?? null,
    postal_code: data.postalCode ?? null,
    country_code: data.countryCode ?? null,
    created_at: now,
    updated_at: now,
  });

  await writeAuditLog({
    userEmail, instanceId, resourceType: 'CONTACT',
    resourceId: id, operation: 'CREATE',
    diffJson: { after: { ...data, email: '[REDACTED]' } },
    ipAddress,
  });

  return db('contacts').where({ id }).first();
}

export async function updateContact(
  instanceId: string,
  contactId: string,
  data: Partial<{
    types: string[];
    name: string;
    email: string;
    phone: string;
    addressLine: string;
    city: string;
    postalCode: string;
    countryCode: string;
  }>,
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const contact = await db('contacts')
    .where({ id: contactId, organization_id: org.identifier })
    .first();
  if (!contact) throw new Error('CONTACT_NOT_FOUND');

  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.types) updates.types = JSON.stringify(data.types);
  if (data.name !== undefined) updates.name = data.name;
  if (data.email) updates.email = data.email;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.addressLine !== undefined) updates.address_line = data.addressLine;
  if (data.city !== undefined) updates.city = data.city;
  if (data.postalCode !== undefined) updates.postal_code = data.postalCode;
  if (data.countryCode !== undefined) updates.country_code = data.countryCode;

  await db('contacts').where({ id: contactId }).update(updates);
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'CONTACT',
    resourceId: contactId, operation: 'UPDATE',
    diffJson: { after: { ...data, email: data.email ? '[REDACTED]' : undefined } },
    ipAddress,
  });

  return db('contacts').where({ id: contactId }).first();
}

export async function deleteContact(
  instanceId: string,
  contactId: string,
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const contact = await db('contacts')
    .where({ id: contactId, organization_id: org.identifier })
    .first();
  if (!contact) throw new Error('CONTACT_NOT_FOUND');

  await db('contacts').where({ id: contactId }).delete();
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'CONTACT',
    resourceId: contactId, operation: 'DELETE', ipAddress,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/contacts.service.ts
git commit -m "feat: add contacts service with CRUD and email redaction in audit"
```

---

### Task 4: Certificate Service

**Files:**
- Create: `backend/src/services/certificate.service.ts`

- [ ] **Step 1: Create `backend/src/services/certificate.service.ts`**

```typescript
/**
 * certificate.service.ts – PEM parsing, private key check, CRUD
 *
 * SECURITY CRITICAL:
 * - Private keys are IMMEDIATELY rejected (400) – never stored, never logged
 * - PEM content is NEVER written to logs
 * - Subject, thumbprint, expiry date extracted from PEM and stored separately
 */
import forge from 'node-forge';
import crypto from 'crypto';
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export function rejectPrivateKey(pem: string): void {
  if (
    pem.includes('PRIVATE KEY') ||
    pem.includes('ENCRYPTED PRIVATE KEY') ||
    pem.includes('RSA PRIVATE KEY') ||
    pem.includes('EC PRIVATE KEY')
  ) {
    throw new Error('PRIVATE_KEY_REJECTED');
  }
}

export function parseCertificate(pem: string): {
  subject: string;
  thumbprint: string;
  validUntil: Date;
} {
  rejectPrivateKey(pem);

  try {
    const cert = forge.pki.certificateFromPem(pem);
    const subject = cert.subject.getField('CN')?.value ||
      cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const thumbprint = crypto
      .createHash('sha256')
      .update(Buffer.from(der, 'binary'))
      .digest('hex')
      .toUpperCase();

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
  return db('certificates')
    .where({ organization_id: org.identifier })
    .select('id', 'organization_id', 'subject', 'thumbprint', 'valid_until', 'created_at')
    .orderBy('created_at', 'desc');
}

export async function createCertificate(
  instanceId: string,
  pem: string,
  userEmail: string,
  ipAddress: string
) {
  rejectPrivateKey(pem);

  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const { subject, thumbprint, validUntil } = parseCertificate(pem.trim());

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
    userEmail, instanceId, resourceType: 'CERTIFICATE',
    resourceId: id, operation: 'CREATE',
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
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const cert = await db('certificates')
    .where({ id: certId, organization_id: org.identifier })
    .first();
  if (!cert) throw new Error('CERTIFICATE_NOT_FOUND');

  await db('certificates').where({ id: certId }).delete();
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'CERTIFICATE',
    resourceId: certId, operation: 'DELETE', ipAddress,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/certificate.service.ts
git commit -m "feat: add certificate service with PEM parsing and private key rejection"
```

---

### Task 5: Endpoints Service

**Files:**
- Create: `backend/src/services/endpoints.service.ts`

- [ ] **Step 1: Create `backend/src/services/endpoints.service.ts`**

```typescript
/**
 * endpoints.service.ts – CRUD for Endpoints including IP addresses
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getEndpoints(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];

  const endpoints = await db('endpoints').where({ organization_id: org.identifier });
  const ips = await db('endpoint_ips').whereIn(
    'endpoint_id',
    endpoints.map((e: any) => e.identifier)
  );

  return endpoints.map((ep: any) => ({
    ...ep,
    ipAddresses: ips
      .filter((ip: any) => ip.endpoint_id === ep.identifier)
      .map((ip: any) => ({ id: ip.id, ip: ip.ip, isFhir: !!ip.is_fhir, isBpe: !!ip.is_bpe })),
  }));
}

export async function createEndpoint(
  instanceId: string,
  data: {
    identifier: string;
    name?: string;
    address: string;
    ipAddresses?: { ip: string; isFhir?: boolean; isBpe?: boolean }[];
  },
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const now = new Date();
  await db('endpoints').insert({
    identifier: data.identifier,
    organization_id: org.identifier,
    name: data.name ?? null,
    address: data.address,
    created_at: now,
    updated_at: now,
  });

  if (data.ipAddresses?.length) {
    await db('endpoint_ips').insert(
      data.ipAddresses.map(ip => ({
        id: uuidv4(),
        endpoint_id: data.identifier,
        ip: ip.ip,
        is_fhir: ip.isFhir ? 1 : 0,
        is_bpe: ip.isBpe ? 1 : 0,
      }))
    );
  }

  await writeAuditLog({
    userEmail, instanceId, resourceType: 'ENDPOINT',
    resourceId: data.identifier, operation: 'CREATE',
    diffJson: { after: data }, ipAddress,
  });

  return (await getEndpoints(instanceId)).find((e: any) => e.identifier === data.identifier);
}

export async function updateEndpoint(
  instanceId: string,
  endpointId: string,
  data: {
    name?: string;
    address?: string;
    ipAddresses?: { ip: string; isFhir?: boolean; isBpe?: boolean }[];
  },
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const endpoint = await db('endpoints')
    .where({ identifier: endpointId, organization_id: org.identifier })
    .first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');

  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.address) updates.address = data.address;

  await db('endpoints').where({ identifier: endpointId }).update(updates);

  if (data.ipAddresses !== undefined) {
    await db('endpoint_ips').where({ endpoint_id: endpointId }).delete();
    if (data.ipAddresses.length) {
      await db('endpoint_ips').insert(
        data.ipAddresses.map(ip => ({
          id: uuidv4(),
          endpoint_id: endpointId,
          ip: ip.ip,
          is_fhir: ip.isFhir ? 1 : 0,
          is_bpe: ip.isBpe ? 1 : 0,
        }))
      );
    }
  }

  await writeAuditLog({
    userEmail, instanceId, resourceType: 'ENDPOINT',
    resourceId: endpointId, operation: 'UPDATE',
    diffJson: { after: data }, ipAddress,
  });

  return (await getEndpoints(instanceId)).find((e: any) => e.identifier === endpointId);
}

export async function deleteEndpoint(
  instanceId: string,
  endpointId: string,
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const endpoint = await db('endpoints')
    .where({ identifier: endpointId, organization_id: org.identifier })
    .first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');

  await db('endpoints').where({ identifier: endpointId }).delete();
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'ENDPOINT',
    resourceId: endpointId, operation: 'DELETE', ipAddress,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/endpoints.service.ts
git commit -m "feat: add endpoints service with IP address management"
```

---

### Task 6: Memberships Service

**Files:**
- Create: `backend/src/services/memberships.service.ts`

- [ ] **Step 1: Create `backend/src/services/memberships.service.ts`**

```typescript
/**
 * memberships.service.ts – CRUD for Memberships
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

const VALID_ROLES = ['DIC', 'HRP', 'DMS', 'AMS'];

export async function getMemberships(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('memberships').where({ organization_id: org.identifier }).orderBy('created_at', 'asc');
}

export async function createMembership(
  instanceId: string,
  data: { parentOrganization: string; endpointId: string; roles: string[] },
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  if (!data.roles?.length || !data.roles.every(r => VALID_ROLES.includes(r))) {
    throw new Error('INVALID_ROLES');
  }

  const endpoint = await db('endpoints')
    .where({ identifier: data.endpointId, organization_id: org.identifier })
    .first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');

  const id = uuidv4();
  const now = new Date();
  await db('memberships').insert({
    id,
    organization_id: org.identifier,
    parent_organization: data.parentOrganization,
    endpoint_id: data.endpointId,
    roles: JSON.stringify(data.roles),
    created_at: now,
    updated_at: now,
  });

  await writeAuditLog({
    userEmail, instanceId, resourceType: 'MEMBERSHIP',
    resourceId: id, operation: 'CREATE', diffJson: { after: data }, ipAddress,
  });

  return db('memberships').where({ id }).first();
}

export async function updateMembership(
  instanceId: string,
  membershipId: string,
  data: { parentOrganization?: string; endpointId?: string; roles?: string[] },
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const membership = await db('memberships')
    .where({ id: membershipId, organization_id: org.identifier })
    .first();
  if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND');

  if (data.roles && !data.roles.every(r => VALID_ROLES.includes(r))) {
    throw new Error('INVALID_ROLES');
  }

  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.parentOrganization) updates.parent_organization = data.parentOrganization;
  if (data.endpointId) updates.endpoint_id = data.endpointId;
  if (data.roles) updates.roles = JSON.stringify(data.roles);

  await db('memberships').where({ id: membershipId }).update(updates);
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'MEMBERSHIP',
    resourceId: membershipId, operation: 'UPDATE', diffJson: { after: data }, ipAddress,
  });

  return db('memberships').where({ id: membershipId }).first();
}

export async function deleteMembership(
  instanceId: string,
  membershipId: string,
  userEmail: string,
  ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const membership = await db('memberships')
    .where({ id: membershipId, organization_id: org.identifier })
    .first();
  if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND');

  await db('memberships').where({ id: membershipId }).delete();
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'MEMBERSHIP',
    resourceId: membershipId, operation: 'DELETE', ipAddress,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/memberships.service.ts
git commit -m "feat: add memberships service with role validation"
```

---

### Task 7: Approval Service

**Files:**
- Create: `backend/src/services/approval.service.ts`

- [ ] **Step 1: Create `backend/src/services/approval.service.ts`**

```typescript
/**
 * approval.service.ts – Approval workflow state machine
 *
 * Status transitions:
 *   DRAFT → PENDING  (via submit)
 *   PENDING → APPROVED | REJECTED  (via GECKO operator)
 *
 * Snapshot: complete data state at submit time
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

async function buildSnapshot(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return null;

  const contacts = await db('contacts')
    .where({ organization_id: org.identifier })
    .select('id', 'types', 'name', 'email_validated', 'phone', 'city', 'country_code');

  const endpoints = await db('endpoints').where({ organization_id: org.identifier });
  const ips = await db('endpoint_ips').whereIn(
    'endpoint_id',
    endpoints.map((e: any) => e.identifier)
  );

  const certificates = await db('certificates')
    .where({ organization_id: org.identifier })
    .select('id', 'subject', 'thumbprint', 'valid_until');

  const memberships = await db('memberships').where({ organization_id: org.identifier });

  return {
    organization: org,
    contacts,
    endpoints: endpoints.map((ep: any) => ({
      ...ep,
      ipAddresses: ips.filter((ip: any) => ip.endpoint_id === ep.identifier),
    })),
    certificates,
    memberships,
    snapshotAt: new Date().toISOString(),
  };
}

export async function submitApproval(instanceId: string, userEmail: string, ipAddress: string) {
  const pending = await db('approval_requests')
    .where({ instance_id: instanceId, status: 'PENDING' })
    .first();
  if (pending) throw new Error('APPROVAL_ALREADY_PENDING');

  const snapshot = await buildSnapshot(instanceId);
  if (!snapshot) throw new Error('ORGANIZATION_NOT_FOUND');

  const id = uuidv4();
  const now = new Date();
  await db('approval_requests').insert({
    id,
    instance_id: instanceId,
    status: 'PENDING',
    created_at: now,
    submitted_at: now,
    snapshot_json: JSON.stringify(snapshot),
  });

  await writeAuditLog({
    userEmail, instanceId, resourceType: 'APPROVAL',
    resourceId: id, operation: 'CREATE', ipAddress,
  });

  return db('approval_requests').where({ id }).first();
}

export async function getApprovalStatus(instanceId: string) {
  const latest = await db('approval_requests')
    .where({ instance_id: instanceId })
    .orderBy('created_at', 'desc')
    .first();
  return latest ?? null;
}

export async function getApprovalHistory(instanceId: string) {
  return db('approval_requests')
    .where({ instance_id: instanceId })
    .select('id', 'status', 'created_at', 'submitted_at', 'resolved_at', 'resolved_by', 'comment')
    .orderBy('created_at', 'desc')
    .limit(20);
}

export async function getPendingApprovals() {
  return db('approval_requests')
    .where({ status: 'PENDING' })
    .orderBy('submitted_at', 'asc');
}

export async function approveRequest(requestId: string, resolvedBy: string, ipAddress: string) {
  const request = await db('approval_requests')
    .where({ id: requestId, status: 'PENDING' })
    .first();
  if (!request) throw new Error('REQUEST_NOT_FOUND');

  await db('approval_requests').where({ id: requestId }).update({
    status: 'APPROVED',
    resolved_at: new Date(),
    resolved_by: resolvedBy,
  });

  await writeAuditLog({
    userEmail: resolvedBy, instanceId: request.instance_id,
    resourceType: 'APPROVAL', resourceId: requestId,
    operation: 'APPROVE', ipAddress,
  });

  return db('approval_requests').where({ id: requestId }).first();
}

export async function rejectRequest(requestId: string, resolvedBy: string, comment: string, ipAddress: string) {
  const request = await db('approval_requests')
    .where({ id: requestId, status: 'PENDING' })
    .first();
  if (!request) throw new Error('REQUEST_NOT_FOUND');

  await db('approval_requests').where({ id: requestId }).update({
    status: 'REJECTED',
    resolved_at: new Date(),
    resolved_by: resolvedBy,
    comment,
  });

  await writeAuditLog({
    userEmail: resolvedBy, instanceId: request.instance_id,
    resourceType: 'APPROVAL', resourceId: requestId,
    operation: 'REJECT', diffJson: { comment }, ipAddress,
  });

  return db('approval_requests').where({ id: requestId }).first();
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/approval.service.ts
git commit -m "feat: add approval service with state machine and snapshot"
```

---

### Task 8: FHIR + Excel Services

**Files:**
- Create: `backend/src/services/fhir.service.ts`
- Create: `backend/src/services/excel.service.ts`

- [ ] **Step 1: Create `backend/src/services/fhir.service.ts`**

```typescript
/**
 * fhir.service.ts – FHIR R4 Bundle generation
 *
 * Generates a FHIR Bundle with:
 * - Organization Resource
 * - Endpoint Resource
 * - Certificate as Extension on Organization
 * - Membership as OrganizationAffiliation Resource
 *
 * Contact data is NOT included in the bundle (GDPR).
 */
import { db } from '../db/connection';

const DSF_BASE_URL = process.env.DSF_FHIR_BASE_URL || 'https://dsf.dev';

export async function generateBundle(instanceId: string, endpointId: string): Promise<object> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

  const endpoint = await db('endpoints')
    .where({ identifier: endpointId, organization_id: org.identifier })
    .first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');

  const ips = await db('endpoint_ips').where({ endpoint_id: endpointId });
  const certs = await db('certificates').where({ organization_id: org.identifier });
  const memberships = await db('memberships').where({ organization_id: org.identifier });

  const orgResource = {
    resourceType: 'Organization',
    id: org.identifier,
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-organization`] },
    identifier: [{ system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: org.identifier }],
    active: org.active === 1,
    name: org.name,
    extension: certs.map((cert: any) => ({
      url: `${DSF_BASE_URL}/fhir/StructureDefinition/dsf-certificate`,
      valueBase64Binary: Buffer.from(cert.pem).toString('base64'),
    })),
  };

  const endpointResource = {
    resourceType: 'Endpoint',
    id: endpoint.identifier,
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-endpoint`] },
    identifier: [{ system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: endpoint.identifier }],
    status: 'active',
    connectionType: { system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type', code: 'hl7-fhir-rest' },
    managingOrganization: { reference: `Organization/${org.identifier}` },
    address: endpoint.address,
    extension: ips.map((ip: any) => ({
      url: `${DSF_BASE_URL}/fhir/StructureDefinition/dsf-extension-endpoint-ip`,
      extension: [
        { url: 'ip', valueString: ip.ip },
        { url: 'isFhir', valueBoolean: ip.is_fhir === 1 },
        { url: 'isBpe', valueBoolean: ip.is_bpe === 1 },
      ],
    })),
  };

  const affiliationResources = memberships.map((ms: any) => ({
    resourceType: 'OrganizationAffiliation',
    id: ms.id,
    active: true,
    organization: { identifier: { system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: ms.parent_organization } },
    participatingOrganization: { reference: `Organization/${org.identifier}` },
    endpoint: [{ reference: `Endpoint/${ms.endpoint_id}` }],
    code: JSON.parse(ms.roles).map((role: string) => ({
      coding: [{ system: `${DSF_BASE_URL}/fhir/CodeSystem/dsf-organization-role`, code: role }],
    })),
  }));

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-allowlist`] },
    entry: [
      { resource: orgResource },
      { resource: endpointResource },
      ...affiliationResources.map((r: any) => ({ resource: r })),
    ],
  };
}
```

- [ ] **Step 2: Create `backend/src/services/excel.service.ts`**

```typescript
/**
 * excel.service.ts – IP Address List export as Excel
 * Contains ALL outgoing IPs of all organizations in the DB.
 * Used for firewall configuration of DSF participants.
 */
import ExcelJS from 'exceljs';
import { db } from '../db/connection';

export async function generateIpAddressListExcel(): Promise<Buffer> {
  const ips = await db('endpoint_ips as eip')
    .join('endpoints as ep', 'eip.endpoint_id', 'ep.identifier')
    .join('organizations as org', 'ep.organization_id', 'org.identifier')
    .select(
      'org.identifier as orgIdentifier',
      'org.name as orgName',
      'ep.identifier as endpointIdentifier',
      'ep.address as endpointAddress',
      'eip.ip',
      'eip.is_fhir as isFhir',
      'eip.is_bpe as isBpe'
    )
    .orderBy(['org.identifier', 'ep.identifier', 'eip.ip']);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DSF Allow List Management';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('IP Address List');

  sheet.columns = [
    { header: 'Organization', key: 'orgIdentifier', width: 30 },
    { header: 'Organization Name', key: 'orgName', width: 40 },
    { header: 'Endpoint', key: 'endpointIdentifier', width: 40 },
    { header: 'Endpoint URL', key: 'endpointAddress', width: 50 },
    { header: 'IP Address', key: 'ip', width: 20 },
    { header: 'FHIR', key: 'isFhir', width: 10 },
    { header: 'BPE', key: 'isBpe', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF6C63FF' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  ips.forEach((row: any) => {
    sheet.addRow({
      ...row,
      isFhir: row.isFhir ? 'Yes' : 'No',
      isBpe: row.isBpe ? 'Yes' : 'No',
    });
  });

  sheet.autoFilter = { from: 'A1', to: 'G1' };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/fhir.service.ts backend/src/services/excel.service.ts
git commit -m "feat: add FHIR bundle generation and Excel IP address list export"
```

---

### Task 9: Entity Routes (Organization, Contacts, Endpoints, Certificates, Memberships)

**Files:**
- Create: `backend/src/routes/organization.routes.ts`
- Create: `backend/src/routes/contacts.routes.ts`
- Create: `backend/src/routes/endpoints.routes.ts`
- Create: `backend/src/routes/certificates.routes.ts`
- Create: `backend/src/routes/memberships.routes.ts`

- [ ] **Step 1: Create `backend/src/routes/organization.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/organization.service';

export const organizationRouter = Router({ mergeParams: true });
organizationRouter.use(requireAuth, requireInstanceOwnership);

organizationRouter.get('/', async (req, res) => {
  const org = await svc.getOrganization(req.instance!.id);
  res.json({ data: org });
});

organizationRouter.put('/', async (req, res) => {
  try {
    const org = await svc.upsertOrganization(
      req.instance!.id, req.body,
      req.user!.email, req.ip || 'unknown'
    );
    res.json({ data: org });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

organizationRouter.post('/request-removal', async (req, res) => {
  const { submitApproval } = await import('../services/approval.service');
  try {
    const request = await submitApproval(req.instance!.id, req.user!.email, req.ip || 'unknown');
    res.json({ data: request });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 2: Create `backend/src/routes/contacts.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/contacts.service';

export const contactsRouter = Router({ mergeParams: true });
contactsRouter.use(requireAuth, requireInstanceOwnership);

contactsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getContacts(req.instance!.id) });
});

contactsRouter.post('/', async (req, res) => {
  try {
    const contact = await svc.createContact(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: contact });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

contactsRouter.put('/:cid', async (req, res) => {
  try {
    const contact = await svc.updateContact(req.instance!.id, req.params.cid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: contact });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

contactsRouter.delete('/:cid', async (req, res) => {
  try {
    await svc.deleteContact(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 3: Create `backend/src/routes/endpoints.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/endpoints.service';

export const endpointsRouter = Router({ mergeParams: true });
endpointsRouter.use(requireAuth, requireInstanceOwnership);

endpointsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getEndpoints(req.instance!.id) });
});

endpointsRouter.post('/', async (req, res) => {
  try {
    const ep = await svc.createEndpoint(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ep });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

endpointsRouter.put('/:eid', async (req, res) => {
  try {
    const ep = await svc.updateEndpoint(req.instance!.id, req.params.eid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ep });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

endpointsRouter.delete('/:eid', async (req, res) => {
  try {
    await svc.deleteEndpoint(req.instance!.id, req.params.eid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 4: Create `backend/src/routes/certificates.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/certificate.service';

export const certificatesRouter = Router({ mergeParams: true });
certificatesRouter.use(requireAuth, requireInstanceOwnership);

certificatesRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getCertificates(req.instance!.id) });
});

certificatesRouter.post('/', async (req, res) => {
  const { pem } = req.body;
  if (!pem || typeof pem !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'PEM content required' } });
  }
  try {
    const cert = await svc.createCertificate(req.instance!.id, pem, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: cert });
  } catch (err: any) {
    if (err.message === 'PRIVATE_KEY_REJECTED') {
      return res.status(400).json({ error: { code: 'PRIVATE_KEY_REJECTED', message: 'Private keys are not allowed' } });
    }
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

certificatesRouter.delete('/:cid', async (req, res) => {
  try {
    await svc.deleteCertificate(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 5: Create `backend/src/routes/memberships.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/memberships.service';

export const membershipsRouter = Router({ mergeParams: true });
membershipsRouter.use(requireAuth, requireInstanceOwnership);

membershipsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getMemberships(req.instance!.id) });
});

membershipsRouter.post('/', async (req, res) => {
  try {
    const ms = await svc.createMembership(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

membershipsRouter.put('/:mid', async (req, res) => {
  try {
    const ms = await svc.updateMembership(req.instance!.id, req.params.mid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

membershipsRouter.delete('/:mid', async (req, res) => {
  try {
    await svc.deleteMembership(req.instance!.id, req.params.mid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/organization.routes.ts backend/src/routes/contacts.routes.ts backend/src/routes/endpoints.routes.ts backend/src/routes/certificates.routes.ts backend/src/routes/memberships.routes.ts
git commit -m "feat: add entity routes for organization, contacts, endpoints, certificates, memberships"
```

---

### Task 10: Approval, Download, Audit Routes

**Files:**
- Create: `backend/src/routes/approval.routes.ts`
- Create: `backend/src/routes/download.routes.ts`
- Create: `backend/src/routes/audit.routes.ts`

- [ ] **Step 1: Create `backend/src/routes/approval.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/approval.service';

export const approvalRouter = Router({ mergeParams: true });

approvalRouter.post('/submit', requireAuth, requireInstanceOwnership, async (req, res) => {
  try {
    const request = await svc.submitApproval(req.instance!.id, req.user!.email, req.ip || 'unknown');
    res.json({ data: request });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

approvalRouter.get('/status', requireAuth, requireInstanceOwnership, async (req, res) => {
  res.json({ data: await svc.getApprovalStatus(req.instance!.id) });
});

approvalRouter.get('/history', requireAuth, requireInstanceOwnership, async (req, res) => {
  res.json({ data: await svc.getApprovalHistory(req.instance!.id) });
});

approvalRouter.get('/admin/pending', requireAuth, async (req, res) => {
  res.json({ data: await svc.getPendingApprovals() });
});

approvalRouter.post('/admin/:rid/approve', requireAuth, async (req, res) => {
  try {
    const result = await svc.approveRequest(req.params.rid, req.user!.email, req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

approvalRouter.post('/admin/:rid/reject', requireAuth, async (req, res) => {
  try {
    const result = await svc.rejectRequest(req.params.rid, req.user!.email, req.body.comment || '', req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
```

- [ ] **Step 2: Create `backend/src/routes/download.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { generateBundle } from '../services/fhir.service';
import { generateIpAddressListExcel } from '../services/excel.service';

export const downloadRouter = Router({ mergeParams: true });

downloadRouter.get('/bundle', requireAuth, requireInstanceOwnership, async (req, res) => {
  const endpointId = req.query.endpointId as string;
  if (!endpointId) {
    return res.status(400).json({ error: { code: 'MISSING_ENDPOINT', message: 'endpointId required' } });
  }
  try {
    const bundle = await generateBundle(req.instance!.id, endpointId);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Content-Disposition', `attachment; filename="allowlist-bundle-${endpointId}.json"`);
    res.json(bundle);
  } catch (err: any) {
    res.status(404).json({ error: { code: err.message, message: err.message } });
  }
});

downloadRouter.get('/ip-address-list', requireAuth, async (req, res) => {
  try {
    const buffer = await generateIpAddressListExcel();
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dsf-ip-address-list-${date}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});
```

- [ ] **Step 3: Create `backend/src/routes/audit.routes.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { db } from '../db/connection';

export const auditRouter = Router({ mergeParams: true });
auditRouter.use(requireAuth, requireInstanceOwnership);

auditRouter.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = (page - 1) * limit;

  const query = db('audit_logs')
    .where({ instance_id: req.instance!.id })
    .orderBy('timestamp', 'desc');

  if (req.query.resource) query.where({ resource_type: req.query.resource });
  if (req.query.operation) query.where({ operation: req.query.operation });

  const [logs, [{ count }]] = await Promise.all([
    query.clone().limit(limit).offset(offset),
    query.clone().count('id as count'),
  ]);

  res.json({
    data: logs,
    meta: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/approval.routes.ts backend/src/routes/download.routes.ts backend/src/routes/audit.routes.ts
git commit -m "feat: add approval, download, and audit routes"
```

---

### Task 11: Update Instances Routes + Wire All Routes in index.ts

**Files:**
- Modify: `backend/src/routes/instances.routes.ts` (full replacement)
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Replace `backend/src/routes/instances.routes.ts`**

```typescript
/**
 * instances.routes.ts – Instance CRUD
 * Dependencies: auth.middleware, db/connection, uuid
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export const instancesRouter = Router();
instancesRouter.use(requireAuth);

instancesRouter.get('/', async (req, res) => {
  const instances = await db('instances')
    .where({ user_id: req.user!.id })
    .orderBy('created_at', 'desc');
  res.json({ data: instances });
});

instancesRouter.post('/', async (req, res) => {
  const { label } = req.body;
  if (!label || typeof label !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Label required' } });
  }
  const id = uuidv4();
  await db('instances').insert({
    id,
    user_id: req.user!.id,
    label,
    created_at: new Date(),
  });
  const instance = await db('instances').where({ id }).first();
  res.status(201).json({ data: instance });
});

instancesRouter.get('/:id', async (req, res) => {
  const instance = await db('instances')
    .where({ id: req.params.id, user_id: req.user!.id })
    .first();
  if (!instance) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Instance not found' } });
  }
  res.json({ data: instance });
});
```

- [ ] **Step 2: Update `backend/src/index.ts` — add all new route imports and mounts**

The full updated file:

```typescript
/**
 * index.ts – Express App Bootstrap
 * Starts the server, registers middleware and all routes
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { instancesRouter } from './routes/instances.routes';
import { organizationRouter } from './routes/organization.routes';
import { contactsRouter } from './routes/contacts.routes';
import { endpointsRouter } from './routes/endpoints.routes';
import { certificatesRouter } from './routes/certificates.routes';
import { membershipsRouter } from './routes/memberships.routes';
import { approvalRouter } from './routes/approval.routes';
import { downloadRouter } from './routes/download.routes';
import { auditRouter } from './routes/audit.routes';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';
import { apiRateLimit } from './middleware/rateLimit.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust nginx proxy
app.set('trust proxy', 1);

// Rate limiting on API routes
app.use('/api', apiRateLimit);

// Routes
app.use('/auth', authRouter);
app.use('/api/v1/instances', instancesRouter);

// Entity routes under /api/v1/instances/:instanceId/
app.use('/api/v1/instances/:instanceId/organization', organizationRouter);
app.use('/api/v1/instances/:instanceId/contacts', contactsRouter);
app.use('/api/v1/instances/:instanceId/endpoints', endpointsRouter);
app.use('/api/v1/instances/:instanceId/certificates', certificatesRouter);
app.use('/api/v1/instances/:instanceId/memberships', membershipsRouter);
app.use('/api/v1/instances/:instanceId/approval', approvalRouter);
app.use('/api/v1/instances/:instanceId/download', downloadRouter);
app.use('/api/v1/instances/:instanceId/audit', auditRouter);

// Download without instance scope (IP address list for all orgs)
app.use('/api/v1/download', downloadRouter);

// Admin (GECKO operator)
app.use('/api/v1/admin', approvalRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.DSF_ENVIRONMENT || 'UNKNOWN' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Startup
async function start() {
  try {
    await testDbConnection();
    console.log('✓ MySQL connected');
    await testRedisConnection();
    console.log('✓ Redis connected');
    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT} [${process.env.DSF_ENVIRONMENT}]`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/instances.routes.ts backend/src/index.ts
git commit -m "feat: replace instance placeholders and wire all entity routes in Express bootstrap"
```

---

## Acceptance Criteria (from spec)

- [ ] Organization: GET / PUT work, no direct DELETE possible
- [ ] Contacts: GET / POST / PUT / DELETE with audit log entries
- [ ] Endpoints: GET / POST / PUT / DELETE, IP addresses stored correctly
- [ ] Certificates: POST with PEM → subject + thumbprint + expiry extracted
- [ ] Certificates: POST with PRIVATE KEY in PEM → immediate 400, no PEM in logs
- [ ] Memberships: GET / POST / PUT / DELETE, role validation
- [ ] Approval: Submit → status PENDING, duplicate submit → 400
- [ ] Approval: Admin approve → APPROVED, Admin reject with comment → REJECTED
- [ ] FHIR Bundle: valid JSON with Organization + Endpoint + OrganizationAffiliation
- [ ] IP Address List: Excel file with headers and filtered rows
- [ ] Audit log: all CREATE/UPDATE/DELETE operations present, PEM content nowhere visible
- [ ] Instance ownership: foreign instance ID → 403
