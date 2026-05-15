/**
 * auditQuery.service.ts — read-side queries against audit_logs.
 *
 * Extracted from routes/audit.routes.ts and routes/admin.routes.ts.
 * Three call shapes:
 *   - listInstanceAudit:        per-instance, filterable, paginated.
 *   - listCrossInstanceAudit:   joined with instances+organizations;
 *                               admins see all rows, users see their own.
 *   - listAdminAudit:           admin "everything" view, no joins.
 *
 * Audit_logs is append-only at the DB layer (migration 013).
 *
 * Dependencies: db/connection
 */
import { db } from '../db/connection';

export interface AuditQueryParams {
  page: number;
  limit: number;
  resource?: string;
  operation?: string;
}

export interface AuditLogRow {
  id: string;
  timestamp: Date;
  user_email: string | null;
  instance_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  operation: string | null;
  diff_json: unknown;
  ip_address: string | null;
}

export interface CrossInstanceAuditRow extends AuditLogRow {
  instance_label: string | null;
  organization_identifier: string | null;
  organization_name: string | null;
}

export interface AuditPage<T> {
  rows: T[];
  total: number;
}

export async function listInstanceAudit(
  instanceId: string,
  params: AuditQueryParams,
): Promise<AuditPage<AuditLogRow>> {
  const offset = (params.page - 1) * params.limit;
  const query = db<AuditLogRow>('audit_logs')
    .where({ instance_id: instanceId })
    .orderBy('timestamp', 'desc');

  if (params.resource) query.where({ resource_type: params.resource });
  if (params.operation) query.where({ operation: params.operation });

  const [rows, countRows] = await Promise.all([
    query.clone().limit(params.limit).offset(offset),
    query.clone().count<Array<{ count: string | number }>>('id as count'),
  ]);

  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function listCrossInstanceAudit(
  userId: string,
  isAdmin: boolean,
  params: { page: number; limit: number },
): Promise<AuditPage<CrossInstanceAuditRow>> {
  const offset = (params.page - 1) * params.limit;

  const baseQuery = db('audit_logs')
    .leftJoin('instances', 'audit_logs.instance_id', 'instances.id')
    .leftJoin('organizations', 'organizations.instance_id', 'instances.id')
    .select(
      'audit_logs.id',
      'audit_logs.timestamp',
      'audit_logs.user_email',
      'audit_logs.instance_id',
      'audit_logs.resource_type',
      'audit_logs.resource_id',
      'audit_logs.operation',
      'audit_logs.diff_json',
      'audit_logs.ip_address',
      'instances.label as instance_label',
      'organizations.identifier as organization_identifier',
      'organizations.name as organization_name',
    );
  if (!isAdmin) baseQuery.where('instances.user_id', userId);
  const rows: CrossInstanceAuditRow[] = await baseQuery
    .orderBy('audit_logs.timestamp', 'desc')
    .limit(params.limit)
    .offset(offset);

  const totalQuery = db('audit_logs').leftJoin('instances', 'audit_logs.instance_id', 'instances.id');
  if (!isAdmin) totalQuery.where('instances.user_id', userId);
  const totalRow = await totalQuery.count('audit_logs.id as total').first();
  const total = Number(totalRow?.total ?? 0);

  return { rows, total };
}

export async function listAdminAudit(
  params: { page: number; limit: number },
): Promise<AuditPage<AuditLogRow>> {
  const offset = (params.page - 1) * params.limit;
  const [rows, countRows] = await Promise.all([
    db<AuditLogRow>('audit_logs').orderBy('timestamp', 'desc').limit(params.limit).offset(offset),
    db('audit_logs').count<Array<{ count: string | number }>>('id as count'),
  ]);
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}
