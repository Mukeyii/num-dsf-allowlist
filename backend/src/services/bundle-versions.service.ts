/**
 * bundle-versions.service.ts – persist + diff full federation bundle
 * snapshots. createSnapshot is called from approveRequest after the
 * outer transaction commits, so generateFullBundle sees the new
 * APPROVED state.
 *
 * Diff is computed over bundle.entry, keyed by a STABLE business
 * identity (see keyOf) — NOT resource.id, which generateFullBundle
 * regenerates as a fresh uuid on every run, so id-keyed diffs would
 * report every entry as added+removed. Added / removed / changed
 * buckets are returned as raw FHIR entries so the admin UI can render
 * them inline.
 *
 * Storage: every snapshot stores the full JSON. ~50 KB / approval.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateFullBundle } from './fhir.service';
import { signBundle } from './bundle-signing.service';
import { writeAuditLog } from './audit.service';

export type TriggeredBy = 'APPROVAL' | 'MANUAL' | 'RESTORE';

export interface BundleVersionRow {
  id: string;
  version_number: number;
  created_at: Date;
  triggered_by: TriggeredBy;
  approval_request_id: string | null;
  triggered_by_email: string;
  content_hash: string;
  signature: string;
  bundle_json: string;
  notes: string | null;
}

interface SnapshotArgs {
  triggeredBy: TriggeredBy;
  triggeredByEmail: string;
  approvalRequestId?: string;
  notes?: string;
}

export interface SnapshotResult {
  id: string;
  versionNumber: number;
  contentHash: string;
}

export async function createSnapshot(args: SnapshotArgs): Promise<SnapshotResult> {
  const bundle = await generateFullBundle();
  const { signature, contentHash } = signBundle(bundle);
  const id = uuidv4();
  await db('bundle_versions').insert({
    id,
    triggered_by: args.triggeredBy,
    triggered_by_email: args.triggeredByEmail,
    approval_request_id: args.approvalRequestId ?? null,
    content_hash: contentHash,
    signature,
    bundle_json: JSON.stringify(bundle),
    notes: args.notes ?? null,
  });
  const row = await db<BundleVersionRow>('bundle_versions').where({ id }).first();
  await writeAuditLog({
    userEmail: args.triggeredByEmail,
    resourceType: 'APPROVAL',
    resourceId: id,
    operation: 'CREATE',
    diffJson: {
      action: 'bundle_snapshot',
      versionNumber: row!.version_number,
      triggeredBy: args.triggeredBy,
      approvalRequestId: args.approvalRequestId ?? null,
    },
  });
  return { id, versionNumber: row!.version_number, contentHash };
}

export async function listVersions(opts: { page: number; limit: number }) {
  const { page, limit } = opts;
  const rows = await db<BundleVersionRow>('bundle_versions')
    .select(
      'id',
      'version_number',
      'created_at',
      'triggered_by',
      'triggered_by_email',
      'content_hash',
      'notes',
      'approval_request_id',
    )
    .orderBy('version_number', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);
  const [{ total }] = await db('bundle_versions').count<[{ total: number }]>({ total: '*' });
  return { rows, total: Number(total) };
}

export async function getVersion(id: string) {
  const row = await db<BundleVersionRow>('bundle_versions').where({ id }).first();
  if (!row) throw new Error('NOT_FOUND');
  return { ...row, bundle: JSON.parse(row.bundle_json) };
}

interface FhirEntry {
  resource?: {
    id?: string;
    resourceType?: string;
    identifier?: Array<{ value?: string }>;
  };
  request?: { url?: string };
  fullUrl?: string;
}
interface FhirBundle {
  entry?: FhirEntry[];
}

// Stable identity for an entry, in priority order:
//  1. resource.identifier[0].value — the sid/FQDN of Organization & Endpoint
//     resources (stable across regenerations).
//  2. request.url — the conditional PUT/DELETE URL, built from FQDN
//     identifiers; covers OrganizationAffiliation and DELETE entries that
//     carry no top-level identifier.
//  3. resource.id — only as a fallback (e.g. synthetic test fixtures);
//     real bundle ids are random uuids and must not be the primary key.
//  4. fullUrl — last resort.
function keyOf(entry: FhirEntry): string {
  const r = entry.resource;
  const identValue = r?.identifier?.[0]?.value;
  if (identValue) return `${r?.resourceType ?? 'Unknown'}:${identValue}`;
  if (entry.request?.url) return entry.request.url;
  if (r?.id) return `${r?.resourceType ?? 'Unknown'}:${r.id}`;
  return entry.fullUrl ?? '';
}

// Content fingerprint for change detection. generateFullBundle regenerates
// fullUrl, resource.id, and every urn:uuid: cross-reference built from them
// on each run, so all three are volatile and must be neutralised — otherwise
// two snapshots of unchanged data would report every matched entry as
// changed (the same random-id defect this diff fixes, in the changed bucket).
function stableJson(entry: FhirEntry): string {
  const clone = JSON.parse(JSON.stringify(entry)) as FhirEntry & { fullUrl?: string };
  delete clone.fullUrl;
  if (clone.resource) delete clone.resource.id;
  return JSON.stringify(clone).replace(/urn:uuid:[0-9a-f-]+/gi, 'urn:uuid:*');
}

export async function diffVersions(idA: string, idB: string) {
  const [a, b] = await Promise.all([getVersion(idA), getVersion(idB)]);
  const aMap = new Map<string, FhirEntry>(
    (a.bundle as FhirBundle).entry?.map((e) => [keyOf(e), e]) ?? [],
  );
  const bMap = new Map<string, FhirEntry>(
    (b.bundle as FhirBundle).entry?.map((e) => [keyOf(e), e]) ?? [],
  );
  const added: FhirEntry[] = [];
  const removed: FhirEntry[] = [];
  const changed: Array<{ before: FhirEntry; after: FhirEntry }> = [];
  for (const [k, entry] of bMap) {
    const before = aMap.get(k);
    if (!before) added.push(entry);
    else if (stableJson(before) !== stableJson(entry)) changed.push({ before, after: entry });
  }
  for (const [k, entry] of aMap) {
    if (!bMap.has(k)) removed.push(entry);
  }
  return { added, removed, changed };
}
