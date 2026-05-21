/**
 * bundle-versions.service.ts – persist + diff full federation bundle
 * snapshots. createSnapshot is called from approveRequest after the
 * outer transaction commits, so generateFullBundle sees the new
 * APPROVED state.
 *
 * Diff is computed over bundle.entry: an entry is keyed by
 * `resource.resourceType + '/' + resource.id`. Added / removed /
 * changed buckets are returned as raw FHIR entries so the admin UI
 * can render them inline.
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
    .limit(limit).offset((page - 1) * limit);
  const [{ total }] = await db('bundle_versions').count<[{ total: number }]>({ total: '*' });
  return { rows, total: Number(total) };
}

export async function getVersion(id: string) {
  const row = await db<BundleVersionRow>('bundle_versions').where({ id }).first();
  if (!row) throw new Error('NOT_FOUND');
  return { ...row, bundle: JSON.parse(row.bundle_json) };
}

interface FhirEntry { resource?: { id?: string; resourceType?: string }; fullUrl?: string }
interface FhirBundle { entry?: FhirEntry[] }

function keyOf(entry: FhirEntry): string {
  const r = entry.resource;
  return `${r?.resourceType ?? 'Unknown'}/${r?.id ?? entry.fullUrl ?? ''}`;
}

export async function diffVersions(idA: string, idB: string) {
  const [a, b] = await Promise.all([getVersion(idA), getVersion(idB)]);
  const aMap = new Map<string, FhirEntry>((a.bundle as FhirBundle).entry?.map(e => [keyOf(e), e]) ?? []);
  const bMap = new Map<string, FhirEntry>((b.bundle as FhirBundle).entry?.map(e => [keyOf(e), e]) ?? []);
  const added: FhirEntry[] = [];
  const removed: FhirEntry[] = [];
  const changed: Array<{ before: FhirEntry; after: FhirEntry }> = [];
  for (const [k, entry] of bMap) {
    const before = aMap.get(k);
    if (!before) added.push(entry);
    else if (JSON.stringify(before) !== JSON.stringify(entry)) changed.push({ before, after: entry });
  }
  for (const [k, entry] of aMap) {
    if (!bMap.has(k)) removed.push(entry);
  }
  return { added, removed, changed };
}
