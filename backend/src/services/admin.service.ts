/**
 * admin.service.ts — IMI-admin cross-tenant read queries.
 *
 * Extracted from routes/admin.routes.ts. The audit-log "everything" view
 * lives in auditQuery.service.ts; this service only owns the cross-tenant
 * instances list.
 *
 * Dependencies: db/connection
 */
import { db } from '../db/connection';

export interface AdminInstanceRow {
  id: string;
  label: string;
  created_at: Date;
  user_email: string;
  org_identifier: string | null;
  org_name: string | null;
}

export async function listAllInstances(): Promise<AdminInstanceRow[]> {
  return db('instances as i')
    .join('users as u', 'i.user_id', 'u.id')
    .leftJoin('organizations as o', 'o.instance_id', 'i.id')
    .select(
      'i.id',
      'i.label',
      'i.created_at',
      'u.email as user_email',
      'o.identifier as org_identifier',
      'o.name as org_name',
    )
    .orderBy('i.created_at', 'desc');
}
